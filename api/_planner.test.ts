/**
 * @vitest-environment node
 *
 * Unit tests for the session-plan generator (`generateSessionPlan`).
 *
 * The Anthropic SDK is dependency-injected so we can mock the
 * `messages.create` response and assert request shape (model, system prompt,
 * cache-control breakpoints) + response parsing in isolation. Real network
 * calls happen only in the manual smoke-test path, never in CI.
 *
 * What we DO test here:
 *   - Request shape: model is pinned to claude-haiku-4-5-20251001
 *   - Prompt caching: system prompt has cache_control on its last block
 *   - Track branching: math vs word-song use different prompts + shapes
 *   - Response parsing: well-formed JSON → typed plan
 *   - Bad-shape responses are rejected with a typed error
 *   - Missing API key is surfaced as a typed error (not an SDK throw)
 *
 * What we do NOT test here (covered by claude.test.ts integration tests):
 *   - End-to-end /api/claude POST flow
 *   - TTS rendering (renderSessionAudio is its own pure function)
 *   - Rate-limit middleware
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTINUANT_ONSET_GRAPHEMES,
  deriveCurrentTargetVowel,
  generateSessionPlan,
  letterSoundsStatesAreNonFallback,
  parseLetterSoundsVowelStates,
  pinCvcRecapFocus,
  PlannerError,
  reorderContinuantOnsetFirst,
  slashVowelToIpa,
  STOP_ONSET_GRAPHEMES,
  stripMarkdownFence,
  VALID_WORD_SONG_FOCUS_NODES,
  type GenerateSessionPlanArgs,
  type LetterSoundsVowelStatesHint,
  type PlannerAnthropicClient,
} from './_planner.js'
// W12-03: the round-trip test proves a planner-emitted three-hint plan
// parses through W12-01's widened math parser. Pure module, no DOM deps.
import { mathSessionPlanFromServer } from '../src/screens/Math/planFromServer.js'

/**
 * Factory for a mock Anthropic client. The SDK exposes `client.messages.create`
 * which returns a Message object; we narrow the surface to just what the
 * planner uses so the mock is shape-stable.
 */
function makeMockClient(
  responseText: string,
  opts: { capture?: { lastArgs?: unknown } } = {},
): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async (args: unknown) => {
        if (opts.capture) opts.capture.lastArgs = args
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: responseText }],
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }
      }),
    },
  }
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  vi.restoreAllMocks()
})

describe('generateSessionPlan — math track', () => {
  // A well-formed math plan response that the planner should accept and parse.
  // Mirrors the shape declared by mathSessionPlanToUtteranceSources: the model
  // returns an object with `id`, `label`, and `utterances: { id, text }[]`.
  const MATH_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-math-001',
    label: 'Sums to 10 — Haiku-generated',
    utterances: [
      { id: 'math.p1.read', text: 'Three plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Five!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Three. And two more. How many now?' },
      { id: 'math.p1.giveAnswer', text: 'This one is five.' },
    ],
  })

  it('calls Anthropic with the pinned Haiku model id', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as { model: string }
    // Pinned model id — never `claude-haiku-latest`, never an alias. Per the
    // ticket and `feedback_run_vitest_before_merge.md` style: model swaps are
    // a deliberate code change, not an at-runtime concern.
    expect(args.model).toBe('claude-haiku-4-5-20251001')
  })

  it('caches the system prompt (cache_control on the last system block)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as {
      system: Array<{ type: string; text: string; cache_control?: unknown }>
    }
    // System must be an array (not a bare string) so we can attach
    // cache_control. The LAST block carries the breakpoint (per
    // shared/prompt-caching.md — render order is tools → system → messages,
    // and a marker on the last system block caches everything before it).
    expect(Array.isArray(args.system)).toBe(true)
    expect(args.system.length).toBeGreaterThan(0)
    const last = args.system[args.system.length - 1]!
    expect(last.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('parses a well-formed math plan response into utterance sources', async () => {
    const client = makeMockClient(MATH_PLAN_RESPONSE)

    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-math-001')
    expect(plan.label).toBe('Sums to 10 — Haiku-generated')
    expect(plan.utterances).toHaveLength(5)
    expect(plan.utterances[0]).toEqual({
      id: 'math.p1.read',
      text: 'Three plus two. How many?',
    })
  })

  it('passes the track + level + childName into the user prompt', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 2,
      childName: 'Marian',
    })

    const args = capture.lastArgs as {
      messages: Array<{ role: string; content: string }>
    }
    expect(args.messages).toHaveLength(1)
    const userPrompt = args.messages[0]!.content
    // Volatile per-call inputs sit in the user message, not the system prompt
    // — keeps the prompt-cache prefix stable across calls.
    expect(userPrompt).toMatch(/math/i)
    expect(userPrompt).toMatch(/level\s*2/i)
    expect(userPrompt).toMatch(/Marian/)
  })
})

describe('generateSessionPlan — word-song track', () => {
  const WORDSONG_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-word-001',
    label: 'CVC short-a — Haiku-generated',
    utterances: [
      { id: 'word.p1.read', text: 'Tap the cat.' },
      { id: 'word.p1.correct', text: 'Yes! Cat.' },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Cat." },
      { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
    ],
  })

  it('parses a well-formed word-song plan response', async () => {
    const client = makeMockClient(WORDSONG_PLAN_RESPONSE)

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-word-001')
    expect(plan.utterances[0]!.id).toBe('word.p1.read')
  })

  it('uses a different prompt for word-song vs math', async () => {
    const captureMath: { lastArgs?: unknown } = {}
    const captureWord: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(
        JSON.stringify({
          id: 'm',
          label: 'm',
          utterances: [{ id: 'math.p1.read', text: 'one plus one' }],
        }),
        { capture: captureMath },
      ),
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    await generateSessionPlan({
      client: makeMockClient(
        JSON.stringify({
          id: 'w',
          label: 'w',
          utterances: [{ id: 'word.p1.read', text: 'tap the cat' }],
        }),
        { capture: captureWord },
      ),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    const mathSys = (
      captureMath.lastArgs as { system: Array<{ text: string }> }
    ).system
      .map((b) => b.text)
      .join('\n')
    const wordSys = (
      captureWord.lastArgs as { system: Array<{ text: string }> }
    ).system
      .map((b) => b.text)
      .join('\n')

    // Different track → different system prompt content. We don't assert on
    // exact prose (that would couple the test to copy edits), just that the
    // two prompts are not byte-identical.
    expect(mathSys).not.toBe(wordSys)
  })
})

describe('generateSessionPlan — Session-End utterance schema (ticket 86c9kj2u6)', () => {
  // Provenance: ticket 86c9kj2u6. Bug 2 root cause was the planner emitted
  // only the 8 problems × 5 slot ids; the Session-End screen looks up
  // session.end.opener / session.end.recap.{N} / session.end.streak.{N} /
  // session.end.goodbye and fell back to its silent shim on every miss.
  // Fix: the system prompt now instructs Haiku to append all 19 Session-End
  // entries (1 opener + 11 recap + 6 streak + 1 goodbye) to the flat
  // utterances array. These tests pin two contracts:
  //   1. The planner accepts a wire response that includes the new ids
  //      (round-trip through the response validator).
  //   2. The system prompt names every Session-End id family so the model
  //      sees them deterministically.

  // A response with the full 8 × 5 problem ids + the 19 Session-End ids.
  // We don't enumerate all 59 lines individually; we list every Session-End
  // id we expect SessionEnd.tsx to look up and a representative problem
  // utterance, and assert the planner round-trips them unchanged.
  const SESSION_END_IDS_MATH = [
    'session.end.opener',
    'session.end.recap.1',
    'session.end.recap.2',
    'session.end.recap.3',
    'session.end.recap.4',
    'session.end.recap.5',
    'session.end.recap.6',
    'session.end.recap.7',
    'session.end.recap.8',
    'session.end.recap.9',
    'session.end.recap.10',
    'session.end.recap.11',
    'session.end.streak.3',
    'session.end.streak.4',
    'session.end.streak.5',
    'session.end.streak.6',
    'session.end.streak.7',
    'session.end.streak.8',
    'session.end.goodbye',
  ]

  function makePlanWithSessionEnd(track: 'math' | 'word'): string {
    const problemUtterances = [
      { id: `${track}.p1.read`, text: 'Three plus two. How many?' },
      { id: `${track}.p1.correct`, text: 'Yes! Five!' },
      { id: `${track}.p1.reprompt`, text: 'Hmm... try again?' },
      { id: `${track}.p1.hint`, text: 'Look. Three. And two more.' },
      { id: `${track}.p1.giveAnswer`, text: 'This one is five.' },
    ]
    const sessionEndUtterances = [
      { id: 'session.end.opener', text: 'You did it!' },
      ...Array.from({ length: 11 }, (_, i) => {
        const n = i + 1
        const word = [
          'one',
          'two',
          'three',
          'four',
          'five',
          'six',
          'seven',
          'eight',
          'nine',
          'ten',
          'eleven',
        ][i]!
        return {
          id: `session.end.recap.${n}`,
          text: n === 1 ? 'You earned one star!' : `You earned ${word} stars!`,
        }
      }),
      ...Array.from({ length: 6 }, (_, i) => {
        const n = i + 3
        const word = ['three', 'four', 'five', 'six', 'seven', 'eight'][i]!
        return {
          id: `session.end.streak.${n}`,
          text: `${word.charAt(0).toUpperCase() + word.slice(1)} in a row! Wow!`,
        }
      }),
      { id: 'session.end.goodbye', text: 'See you soon.' },
    ]
    return JSON.stringify({
      id: `haiku-${track}-001`,
      label: 'with-session-end',
      utterances: [...problemUtterances, ...sessionEndUtterances],
    })
  }

  it('round-trips Session-End utterance ids unchanged for math', async () => {
    const client = makeMockClient(makePlanWithSessionEnd('math'))
    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })
    const ids = plan.utterances.map((u) => u.id)
    for (const expected of SESSION_END_IDS_MATH) {
      expect(ids).toContain(expected)
    }
  })

  it('round-trips Session-End utterance ids unchanged for word-song', async () => {
    const client = makeMockClient(makePlanWithSessionEnd('word'))
    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })
    const ids = plan.utterances.map((u) => u.id)
    for (const expected of SESSION_END_IDS_MATH) {
      expect(ids).toContain(expected)
    }
  })

  it('system prompt names every Session-End id family the screen looks up', async () => {
    // The screen reads: session.end.opener, session.end.recap.<N>,
    // session.end.streak.<N>, session.end.goodbye. The prompt must name
    // each family explicitly so Haiku emits all 19 deterministically. We
    // assert against the rendered system prompt content (not the rendered
    // model response) so the contract is enforced at prompt-build time
    // even when we mock the SDK.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makePlanWithSessionEnd('math'), { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })
    const args = capture.lastArgs as {
      system: Array<{ text: string }>
    }
    const prompt = args.system.map((b) => b.text).join('\n')
    expect(prompt).toContain('session.end.opener')
    // M5 focus-recap line (ticket 86c9kmwh0). Drift-guard: a future
    // "simplify the prompt" edit must not silently drop the directive that
    // teaches Haiku to emit the per-focus-node recap line.
    expect(prompt).toContain('session.end.recap.focus')
    expect(prompt).toContain('session.end.recap.1')
    expect(prompt).toContain('session.end.recap.11')
    expect(prompt).toContain('session.end.streak.3')
    expect(prompt).toContain('session.end.streak.8')
    expect(prompt).toContain('session.end.goodbye')
  })
})

describe('generateSessionPlan — Wave 12 three-hint math directive (ticket 86ca8702v)', () => {
  // Wave 12 splits the single math `hint` utterance into three escalating
  // sub-steps (hint1/hint2/hint3). These tests pin two contracts:
  //   AC #3 — round-trip: a planner-emitted three-hint plan parses through
  //           W12-01's widened math parser with three hint ids per problem.
  //   AC #4 — drift-guard: the system prompt carries the header-shaped
  //           THREE-HINT SLOT DIRECTIVE so a future "simplify this prompt"
  //           edit cannot silently collapse the triple back to one hint.

  /** Build a full three-hint math wire plan (8 problems × 7 slots + 19
   *  session-end) as the JSON string a Haiku response would carry. */
  function makeThreeHintMathPlan(): string {
    const addends = [
      ['one', 'one', 'two'],
      ['two', 'one', 'three'],
      ['two', 'two', 'four'],
      ['three', 'two', 'five'],
      ['four', 'two', 'six'],
      ['three', 'four', 'seven'],
      ['four', 'four', 'eight'],
      ['five', 'four', 'nine'],
    ] as const
    const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
    // hint2 names the first group's count; the noun is singular when that
    // count is exactly 1 ("One flower.", not "One flowers.") — the
    // SINGULAR-PLURAL RULE the add-to-10 directive carries (Devon NIT-1,
    // ticket 86ca8704f). Mirror it here so the round-trip fixture models
    // grammatical canon.
    const flowers = (word: string) => (word === 'one' ? 'flower' : 'flowers')
    const problemUtterances = addends.flatMap(([a, b, sum], i) => {
      const n = i + 1
      return [
        { id: `math.p${n}.read`, text: `${cap(a)} plus ${b}. How many?` },
        { id: `math.p${n}.correct`, text: `Yes! ${cap(sum)}!` },
        { id: `math.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `math.p${n}.hint1`, text: 'Look at the flowers.' },
        { id: `math.p${n}.hint2`, text: `${cap(a)} ${flowers(a)}.` },
        { id: `math.p${n}.hint3`, text: `And ${b} more. How many now?` },
        { id: `math.p${n}.giveAnswer`, text: `This one is ${sum}.` },
      ]
    })
    const sessionEnd = [
      { id: 'session.end.opener', text: 'You did it!' },
      ...Array.from({ length: 11 }, (_, i) => ({
        id: `session.end.recap.${i + 1}`,
        text: i === 0 ? 'You earned one star!' : 'You earned two stars!',
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `session.end.streak.${i + 3}`,
        text: 'Three in a row! Wow!',
      })),
      { id: 'session.end.goodbye', text: 'See you soon.' },
    ]
    return JSON.stringify({
      id: 'sums-three-hint',
      label: 'three-hint round-trip',
      utterances: [...problemUtterances, ...sessionEnd],
    })
  }

  it('AC#3 — a generated three-hint plan parses through the W12-01 parser with three hint ids per problem', async () => {
    const client = makeMockClient(makeThreeHintMathPlan())
    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })

    // The planner round-trips the wire shape unchanged; feed it straight
    // into the browser parser that Math.tsx consumes.
    const session = mathSessionPlanFromServer(plan)
    expect(session.problems).toHaveLength(8)
    for (const problem of session.problems) {
      // Every problem carries the full hint triple…
      expect(typeof problem.utterances.hint1).toBe('string')
      expect(typeof problem.utterances.hint2).toBe('string')
      expect(typeof problem.utterances.hint3).toBe('string')
      // …and NO legacy single hint.
      expect(problem.utterances.hint).toBeUndefined()
    }
    // Spot-check P1's per-step wording maps to the three sub-steps. P1's
    // addend-A is 1, so hint2 uses the SINGULAR noun ("One flower.") per the
    // directive's SINGULAR-PLURAL RULE (Devon NIT-1, ticket 86ca8704f).
    const p1 = session.problems[0]!
    expect(p1.utterances.hint1).toBe('Look at the flowers.')
    expect(p1.utterances.hint2).toBe('One flower.')
    expect(p1.utterances.hint3).toBe('And one more. How many now?')
  })

  it('AC#4 — the math system prompt carries the THREE-HINT SLOT DIRECTIVE header and a confirming self-check', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThreeHintMathPlan(), { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')

    // Header-shaped drift-guard (uniquely-titled block — won't trip on
    // documentary prose; mirrors the DISTRACTOR-CLASS HINT / GRADUATION
    // SESSION ban convention).
    expect(systemText).toContain('THREE-HINT SLOT DIRECTIVE')
    // The directive must name all three sub-step ids explicitly.
    expect(systemText).toContain('math.p<N>.hint1')
    expect(systemText).toContain('math.p<N>.hint2')
    expect(systemText).toContain('math.p<N>.hint3')
    // And forbid the collapse back to a single hint.
    expect(systemText).toMatch(/NEVER emit a single "math\.p<N>\.hint" id/)
    // The SYSTEM_PREAMBLE math slot list must enumerate the seven slots.
    expect(systemText).toContain(
      'read, correct, reprompt, hint1, hint2, hint3, giveAnswer',
    )
  })

  it('the add-to-10 and sub-to-10 hint2 templates carry the SINGULAR-PLURAL RULE (Devon NIT-1, ticket 86ca8704f)', async () => {
    // The hint2 quantity template "<X> flowers." bakes ungrammatical
    // "One flowers." when the first operand is 1 (REAL in live add-to-10
    // canon: P1 "One plus two"). The directive must instruct the singular
    // "One flower." form at the two exposed tiers (add-to-10 + sub-to-10).
    // Drift-guard so a future prompt-simplification can't silently drop it.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThreeHintMathPlan(), { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')

    // The block-header-shaped rule must be present and must name the
    // singular noun form explicitly.
    expect(systemText).toContain('SINGULAR-PLURAL RULE')
    expect(systemText).toContain('One flower.')
    // And it must forbid the ungrammatical plural with operand 1.
    expect(systemText).toMatch(/NOT "One flowers\."/)
    // Both exposed tiers carry the rule — count must be >= 2 (add-to-10 +
    // sub-to-10). add-to-20/sub-to-20/two-digit are not exposed (operand-A
    // is never 1 by their range rules), so the rule is intentionally only
    // at the two exposed sites.
    const occurrences = systemText.split('SINGULAR-PLURAL RULE').length - 1
    expect(occurrences).toBe(2)
  })

  it('the GENERIC-TIER HINT TEMPLATES block pins number-recog / skip-counting / mult-* templates (PR #413 NIT, ticket 86ca8a8h6)', async () => {
    // The W12-03 directive carries per-operand hint templates for the 6
    // arithmetic tiers; the GENERIC-TIER block carries the remaining 5
    // (number-recog lookup table, skip-counting step template, mult-*
    // case-split). These templates trace to Dave's authoritative note
    // design/research/w12-generic-tier-hint-templates.md and were baked
    // into the generic-tier canon. The existing W12 drift-guards covered
    // only the THREE-HINT SLOT and SINGULAR-PLURAL rules — this block had
    // no header-shaped guard, so a future prompt-simplification could
    // silently diverge the directive from the canon the templates baked.
    // Header-shaped per the SELF-CHECK convention (planner-and-canon.md
    // § "Drift-guard shape for these locks" — uniquely-titled tokens that
    // won't trip on documentary prose).
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThreeHintMathPlan(), { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')

    // Block header (uniquely-titled) + Dave's source-note pointer.
    expect(systemText).toContain('GENERIC-TIER HINT TEMPLATES')
    expect(systemText).toContain(
      'design/research/w12-generic-tier-hint-templates.md',
    )

    // number-recog — hint1 verbatim + hint3 interrogative form + every
    // entry of the 10-row topological-fact LOOKUP TABLE (Dave §Tier 1:
    // semantic topology Haiku cannot derive; must be embedded verbatim).
    expect(systemText).toContain('Look at the numbers.')
    expect(systemText).toContain('Which one is <number-word>?')
    expect(systemText).toContain('1 -> "One is the smallest."')
    expect(systemText).toContain('2 -> "Two comes right after one."')
    expect(systemText).toContain('3 -> "Three comes after two."')
    expect(systemText).toContain('4 -> "Four comes after three."')
    expect(systemText).toContain('5 -> "Five is in the middle."')
    expect(systemText).toContain('6 -> "Six comes after five."')
    expect(systemText).toContain('7 -> "Seven is bigger than five."')
    expect(systemText).toContain('8 -> "Eight comes after seven."')
    expect(systemText).toContain('9 -> "Nine is close to ten."')
    expect(systemText).toContain('10 -> "Ten is the biggest."')

    // skip-counting — hint2 step template + hint3 last-term restate.
    expect(systemText).toContain('We add <step-word> each time.')
    expect(systemText).toContain(
      '"<last-term-word> and <step-word> more is what?"',
    )

    // mult-* — hint1 verbatim + every factor-b case-split form + hint3.
    // The case-split follows read-line operand order (factor-b copies of
    // factor-a, NO commutative flip — Dave §Tier 3 P6 ruling).
    expect(systemText).toContain('Look at the groups.')
    expect(systemText).toContain(
      'factor-b 1 -> "One group of <factor-a-word>."',
    )
    expect(systemText).toContain(
      'factor-b 2 -> "<factor-a-word> and <factor-a-word> more."',
    )
    expect(systemText).toContain(
      'factor-b 3 -> "<factor-a-word>, then <factor-a-word>, then <factor-a-word>."',
    )
    expect(systemText).toContain(
      'factor-b 4 -> "<factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>."',
    )
    expect(systemText).toContain(
      'factor-b 5 -> "<factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>."',
    )
    // mult hint3 is the verbatim read-line question clause; assert the
    // NO-commutative-flip guard prose so a future "natural grouping" reword
    // can't silently re-enable the commuted form Dave rejected.
    expect(systemText).toMatch(/NO commutative flip/i)
  })

  it('AC#1 — the SYSTEM_PREAMBLE keeps word-song at 5 REQUIRED slots + the optional cvc-word-only blend slot — Wave 12 three-hint stays math-only', async () => {
    // The slot-count language is track-shared in SYSTEM_PREAMBLE. The
    // word-song REQUIRED slot set must NOT widen (no word-song three-hint
    // in v1). The ONLY word-song widening is the optional 6th `blend`
    // slot, and it is scoped to cvc-word tiers ONLY (ticket 86ca8t8xx) —
    // every other tier stays at exactly 5. This drift-guard pins both the
    // "5 REQUIRED" wording AND the cvc-word-only blend scoping so a future
    // edit can't (a) re-widen the required set or (b) leak the blend slot
    // onto a non-cvc-word tier.
    const wordPlan = JSON.stringify({
      id: 'cvc-warm',
      label: 'cvc',
      utterances: [
        { id: 'word.p1.read', text: 'Tap the cat.' },
        { id: 'word.p1.correct', text: 'Yes! Cat.' },
        { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
        { id: 'word.p1.hint', text: "Let's look. Cat." },
        { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
      ],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(wordPlan, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // The 5 REQUIRED slots are unchanged.
    expect(systemText).toContain(
      'WORD-SONG track — exactly 5 REQUIRED utterances with these slot names: read, correct, reprompt, hint, giveAnswer',
    )
    // The blend slot is the optional 6th, scoped to cvc-word tiers only.
    expect(systemText).toMatch(
      /6th OPTIONAL slot[\s\S]*cvc-word problems[\s\S]*"blend" utterance/,
    )
    // Non-cvc-word tiers must be explicitly told to stay at 5 (no blend).
    expect(systemText).toMatch(
      /Every OTHER word-song tier[\s\S]*stays at exactly 5[\s\S]*NEVER emit a "blend" slot/,
    )
    // The math count math is also present (76 entries) but the word-song
    // count (60 for non-cvc-word, 68 for cvc-word) must survive for the
    // word-song flat array. The +1 over the pre-M5 count is the
    // focus-recap line (session.end.recap.focus, ticket 86c9kmwh0).
    expect(systemText).toContain('8 × 5 + 20 = 60 entries for the WORD-SONG')
    expect(systemText).toContain('8 × 6 + 20 = 68 on the cvc-word tier')
  })
})

describe('generateSessionPlan — error paths', () => {
  it('throws PlannerError("config-missing") when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY
    // The handler in claude.ts presence-checks the env BEFORE calling the
    // planner, but the planner double-checks defensively so any caller (e.g.
    // a future cron job) gets the same error class.
    const client = makeMockClient('{}')
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'config-missing',
    })
  })

  it('throws PlannerError("invalid-response") when the model returns non-JSON', async () => {
    const client = makeMockClient('not json at all, sorry')
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-response',
    })
  })

  it('throws PlannerError("invalid-response") when the JSON has a wrong shape', async () => {
    // Missing `utterances` field — server can't render audio without one.
    const client = makeMockClient(
      JSON.stringify({ id: 'x', label: 'y' /* no utterances */ }),
    )
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-response',
    })
  })

  it('throws PlannerError("invalid-response") when an utterance is malformed', async () => {
    const client = makeMockClient(
      JSON.stringify({
        id: 'x',
        label: 'y',
        utterances: [{ id: 'p1.read' /* missing text */ }],
      }),
    )
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toBeInstanceOf(PlannerError)
  })

  it('throws PlannerError("upstream-error") when the SDK call rejects', async () => {
    const client: PlannerAnthropicClient = {
      messages: {
        create: vi.fn(async () => {
          throw new Error('upstream 500')
        }),
      },
    }
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'upstream-error',
    })
  })

  it('rejects unknown track values', async () => {
    const client = makeMockClient('{}')
    // Cast through `unknown` so TypeScript's narrowed PlannerTrack can't
    // catch this at compile time — the runtime guard inside
    // generateSessionPlan is what we're exercising. Real callers reach
    // this path only via raw HTTP into /api/claude with a malformed body.
    const args = {
      client,
      track: 'banana-track',
      level: 1,
      childName: 'Marian',
    } as unknown as GenerateSessionPlanArgs
    await expect(generateSessionPlan(args)).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-request',
    })
  })
})

/**
 * Regression: ticket 86c9jrwb4
 *
 * `claude-haiku-4-5-20251001` empirically returns the JSON wrapped in a
 * triple-backtick fence (```json\n...\n```) on every call, despite the
 * system prompt asking it not to. The pure `stripMarkdownFence` helper
 * unwraps the fence before `JSON.parse`. These tests pin the contract on
 * both the helper and the integration through `generateSessionPlan`.
 */
describe('stripMarkdownFence — pure helper', () => {
  const PAYLOAD = '{"id":"x","label":"y","utterances":[]}'

  it('unwraps a fence with the json language tag', () => {
    const wrapped = '```json\n' + PAYLOAD + '\n```'
    expect(stripMarkdownFence(wrapped)).toBe(PAYLOAD)
  })

  it('unwraps a fence with no language tag', () => {
    const wrapped = '```\n' + PAYLOAD + '\n```'
    expect(stripMarkdownFence(wrapped)).toBe(PAYLOAD)
  })

  it('passes bare JSON through unchanged', () => {
    expect(stripMarkdownFence(PAYLOAD)).toBe(PAYLOAD)
  })

  it('tolerates surrounding whitespace around the fence', () => {
    const wrapped = '   \n```json\n' + PAYLOAD + '\n```   \n'
    expect(stripMarkdownFence(wrapped)).toBe(PAYLOAD)
  })

  it('leaves a partial/torn fence alone (no opening fence)', () => {
    // Only a trailing ``` — not a complete fence block. The helper must NOT
    // mangle this; let JSON.parse surface the real error downstream.
    const torn = PAYLOAD + '\n```'
    expect(stripMarkdownFence(torn)).toBe(torn)
  })
})

describe('generateSessionPlan — focusNode + recentSuccessRate (M2, ticket 86c9kmwba)', () => {
  // The planner accepts an optional `progress`-derived pair: focusNode
  // (string, must belong to the requested track) and recentSuccessRate
  // (0..1 or null). Both are routed into the user message — system
  // prompt stays static across calls so the prompt-cache prefix
  // remains stable.

  const MATH_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-math-001',
    label: 'M2 — focus node test',
    utterances: [
      { id: 'math.p1.read', text: 'Three plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Five!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Three. And two more.' },
      { id: 'math.p1.giveAnswer', text: 'This one is five.' },
    ],
  })

  it('places focusNode in the USER message (not the system block — keeps the cache prefix stable)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })

    const args = capture.lastArgs as {
      system: Array<{ text: string }>
      messages: Array<{ role: string; content: string }>
    }
    const systemText = args.system.map((b) => b.text).join('\n')
    const userText = args.messages[0]!.content

    // The user message names the chosen focus node verbatim — that's the
    // signal Haiku reads to decide which slice to generate.
    expect(userText).toContain('add-to-20')
    expect(userText).toMatch(/focus skill node/i)

    // The system block enumerates the FULL focus-node menu (so the model
    // knows what each one means), but does NOT shift its shape based on
    // the per-call value — that would invalidate the prompt-cache
    // prefix. Sanity: both add-to-10 and add-to-20 appear in the menu
    // because the menu is static.
    expect(systemText).toContain('add-to-10')
    expect(systemText).toContain('add-to-20')
  })

  it('two calls with different focusNodes share the same SYSTEM prompt text (cache invariant)', async () => {
    // Pin the prompt-cache invariant: the system block is byte-stable
    // across calls that vary only in focusNode / recentSuccessRate.
    // shared/prompt-caching.md requires the cached prefix to be
    // identical — this test fails if a future edit accidentally weaves
    // the per-call values into the system text.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('omits focusNode → falls back to the level-1 default for the track', async () => {
    // M2 backwards-compat: callers that don't yet ship `focusNode` must
    // continue to work. The planner picks the level-1 default
    // (math: add-to-10) and routes that into the user message, so
    // Haiku's behavior matches the pre-M2 contract for those callers.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      // focusNode deliberately omitted
    })

    const args = capture.lastArgs as {
      messages: Array<{ content: string }>
    }
    expect(args.messages[0]!.content).toContain('add-to-10')
  })

  it('omits focusNode for word-song → defaults to blending-cv (the level-1 default)', async () => {
    // Backwards-compat: callers that don't ship `focusNode` (legacy
    // browser shape) get blending-cv content. Step 2 (ticket 86c9kxu07)
    // un-clamped the server side, but the level-1 default is still
    // blending-cv so legacy clients get the same content they always
    // got.
    const WORD_RESPONSE = JSON.stringify({
      id: 'haiku-word-001',
      label: 'M2 word default',
      utterances: [{ id: 'word.p1.read', text: 'Tap the cat.' }],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).toContain('blending-cv')
  })

  it('rejects a focusNode that does not belong to the requested track', async () => {
    // {track: math, focusNode: cvc-words} is malformed input — the
    // planner enumerates one track's menu at a time so the model is
    // unambiguously instructed. Cross-track focus is a 4xx-shape error.
    const client = makeMockClient(MATH_PLAN_RESPONSE)
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
        focusNode: 'cvc-words',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-request',
    })
  })

  it('rejects an unknown focusNode (not in the valid set)', async () => {
    const client = makeMockClient(MATH_PLAN_RESPONSE)
    await expect(
      generateSessionPlan({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
        focusNode: 'banana-skill',
      }),
    ).rejects.toMatchObject({
      name: 'PlannerError',
      code: 'invalid-request',
    })
  })

  it('places recentSuccessRate in the user message when supplied', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      recentSuccessRate: 0.42,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    // The user line phrases it with two decimals so a 0.42 round-trips
    // identifiably. The exact text is implementation detail; we just pin
    // that the value appears.
    expect(user).toMatch(/0\.42/)
    expect(user).toMatch(/recent score/i)
  })

  it('reports "no data" in the user message when recentSuccessRate is null', async () => {
    // Distinct from a 0.0 score — the planner needs to know "I have no
    // history" so it picks a balanced mix instead of conditioning on a
    // misleading low score.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      recentSuccessRate: null,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).toMatch(/no data/i)
  })

  it('reports "no data" when recentSuccessRate is omitted', async () => {
    // Omitted == undefined; same UX as null on the wire.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      // recentSuccessRate intentionally omitted
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).toMatch(/no data/i)
  })
})

describe('generateSessionPlan — Haiku fence-stripping (regression for 86c9jrwb4)', () => {
  const MATH_PLAN = {
    id: 'haiku-math-001',
    label: 'Sums to 10 — Haiku-generated',
    utterances: [
      { id: 'math.p1.read', text: 'Three plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Five!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Three. And two more. How many now?' },
      { id: 'math.p1.giveAnswer', text: 'This one is five.' },
    ],
  }

  it('parses a fence-wrapped response with the json language tag', async () => {
    // Exact wire shape Haiku 4.5 emits in production (per the Vercel
    // function log on dpl_CLKpx1aQXiBaWHyJDfR3ijECdtLf).
    const wrapped = '```json\n' + JSON.stringify(MATH_PLAN) + '\n```'
    const client = makeMockClient(wrapped)

    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-math-001')
    expect(plan.utterances).toHaveLength(5)
  })

  it('parses a fence-wrapped response with no language tag', async () => {
    const wrapped = '```\n' + JSON.stringify(MATH_PLAN) + '\n```'
    const client = makeMockClient(wrapped)

    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-math-001')
    expect(plan.utterances).toHaveLength(5)
  })

  it('still parses a bare-JSON response (system prompt honored)', async () => {
    // If/when Haiku starts honoring the "no fences" instruction, the bare
    // path must continue to work. Regression guard against an over-eager
    // fence-strip that requires fences.
    const client = makeMockClient(JSON.stringify(MATH_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
    })

    expect(plan.id).toBe('haiku-math-001')
    expect(plan.utterances).toHaveLength(5)
  })
})

/**
 * P0 regression suite — ticket 86c9kt47v (original P0) +
 * ticket 86c9kxu07 (step 2 widening).
 *
 * Pin the planner-side invariants that broke WordSong on prod in PR #117
 * and that the contract widening must continue to honour. The original
 * P0 fix (PR #118) shipped THREE invariants; step 2 (ticket 86c9kxu07)
 * preserves them while widening the supported content surface:
 *
 *   1. Word-song problem utterance ids ALWAYS use the literal "word."
 *      prefix, regardless of focusNode value (the prod incident emitted
 *      "cvc.*" when focusNode was omitted, breaking the browser parser).
 *      STILL HOLDS — the content-type discriminant lives on the read-line
 *      template, not the id namespace.
 *   2. Word-song read text uses one of the parser-accepted templates:
 *      "Tap the <word>." (blending-cv) OR "Read the <word>." (cvc-words).
 *      Step 2 added the second template; both are now first-class.
 *   3. The word-song system prompt names ONLY the parser-accepted content
 *      modes — no menu enumeration that nudges Haiku into the failed
 *      pre-fix templates ("Tap the letter that says /m/." etc.).
 *
 * Strategy: mock Anthropic to capture the request shape; the model itself
 * isn't exercised here. We're pinning the PROMPT contract + the
 * response-validation contract (a mocked response with `word.*` ids
 * round-trips cleanly).
 */
describe('generateSessionPlan — word-song P0 regression + step-2 widening (86c9kt47v, 86c9kxu07)', () => {
  const VALID_WORD_RESPONSE = JSON.stringify({
    id: 'haiku-word-001',
    label: 'CVC short-a — Haiku-generated',
    utterances: [
      { id: 'word.p1.read', text: 'Tap the cat.' },
      { id: 'word.p1.correct', text: 'Yes! Cat.' },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Cat." },
      { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
    ],
  })

  it('system prompt instructs the model to ALWAYS use "word." id prefix', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // Pin the explicit "ALWAYS" guidance so a future prompt edit can't
    // silently drop it. The browser parser regex is anchored on
    // /^word\.p\d+\.<slot>$/; the prompt must reflect that exactly.
    expect(prompt).toMatch(/word\.p<N>\.<slot>/)
    expect(prompt).toMatch(/ALWAYS use the literal prefix "word\."/i)
  })

  it('system prompt does NOT enumerate the failed pre-fix content modes (letter-names / letter-sounds / sight-words)', async () => {
    // Pre-fix prompt (PR #117) enumerated 7 word-song nodes as content
    // modes; that nudged Haiku into producing "Tap the letter that says
    // /m/." for letter-sounds and `cvc.*` id prefixes for cvc-words.
    // Step 2 (ticket 86c9kxu07) widens the prompt to TWO first-class
    // content modes (blending-cv "Tap the <word>." + cvc-words "Read the
    // <word>.") but does NOT reintroduce the per-letter / per-sight-word
    // templates that broke prod. This test pins that the failed
    // templates stay out.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The first-class content modes must be described.
    expect(prompt).toMatch(/Tap the <word>\./)
    expect(prompt).toMatch(/Read the <word>\./)
    // The pre-fix per-node menu lines MUST be absent. We assert against
    // the specific phrasings that named non-blending-cv modes as separate
    // content templates — the new prompt may still mention these node
    // names in a comment, so we anchor on the menu-entry format.
    expect(prompt).not.toMatch(/letter-sounds:.*Tap the letter that says/i)
    expect(prompt).not.toMatch(/letter-names:.*Tap the letter <Letter>/i)
    expect(prompt).not.toMatch(/sight-words:.*Tap the word/i)
    // Mode-count drift-guard (batched ticket 86ca7yg0r; Wave 13 → 13):
    // the in-prompt first-class-content-modes header count must match the
    // 13 actual bullets (letter-names, letter-sounds, blending-cv,
    // cvc-words +4 vowel siblings, 3 digraph tiers, sight-words,
    // simple-sentences). The stale "Ten"/"Twelve" were fixed alongside
    // W12-03 / W13-03; this pin stops it regressing.
    expect(prompt).toContain('Thirteen first-class content modes today')
    expect(prompt).not.toContain('Twelve first-class content modes today')
    expect(prompt).not.toContain('Ten first-class content modes today')
  })

  it('routes focusNode "letter-sounds" verbatim as a FIRST-CLASS tier in the user message (Wave 7 Track A7 — ticket 86c9y49cd)', async () => {
    // Wave 7 Track A7 (ticket 86c9y49cd) promoted letter-sounds from
    // the stub-fallback (which routed to blending-cv) to first-class:
    // the planner emits dedicated letter-sounds session content per
    // Dave's directive in `WORD_SONG_TRACK_GUIDE`, and `_planner.ts`
    // injects the `LETTER-SOUNDS DIRECTIVE` (with current-target-vowel)
    // into the user message. Pre-Wave 7 this test asserted the
    // stub-fallback to blending-cv — flipped here to assert verbatim
    // routing + directive presence.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    // The focus skill node line carries the verbatim requested
    // tier name — no stub remap.
    expect(user).toMatch(/Focus skill node: letter-sounds\./)
    expect(user).not.toMatch(/Focus skill node: blending-cv\./)
    // The LETTER-SOUNDS DIRECTIVE is the deterministic anchor for the
    // Wave 7 A7 wiring — its presence proves the injection seam fired.
    expect(user).toContain('LETTER-SOUNDS DIRECTIVE')
  })

  it('routes first-class focus nodes (blending-cv, cvc-words) verbatim; falls back untuned tiers to blending-cv (sweep)', async () => {
    // Step 2 (ticket 86c9kxu07) widened the planner to first-class
    // emit `cvc-words` content alongside `blending-cv`. After Wave 11
    // (sight-words first-class — ticket 86ca7xmr8) the sole untuned tier
    // (simple-sentences) falls back to blending-cv per the contract doc's
    // §"Tier coverage today" section. This sweep pins the routing table so a future regression
    // on either side surfaces here. (PR #211: dead `digraphs` literal
    // dropped; replaced by 3 sequential sibling nodes. `digraphs-sh`
    // went FIRST-CLASS first — its content tier wired the /ʃ/ digraph
    // pool + hybridMode gate. `digraphs-ch` went FIRST-CLASS second —
    // its content tier wired the /tʃ/ digraph pool (ZERO hybridMode
    // words). `digraphs-th-voiceless` is now ALSO FIRST-CLASS — its
    // content tier wires the voiceless-/θ/ digraph pool + REUSES the
    // sh-tier hybridMode gate for thick/cloth. Wave 7 Track A3 made
    // `letter-names` FIRST-CLASS — its content tier wires the 52-glyph
    // alphabet pool with b/d/p/q CIRCLE-STICK trap-class composition
    // per `design/word-song/letter-names-content.md` Kyle A1 + Dave A2
    // PR #329 directive.)
    const expectations: ReadonlyArray<[string, string]> = [
      ['letter-names', 'letter-names'], // first-class (Wave 7 Track A3 content tier)
      ['letter-sounds', 'letter-sounds'], // first-class (Wave 7 Track A7 — ticket 86c9y49cd)
      ['blending-cv', 'blending-cv'], // first-class
      ['cvc-words', 'cvc-words'], // first-class (the unblock)
      ['digraphs-sh', 'digraphs-sh'], // first-class (sh content tier)
      ['digraphs-ch', 'digraphs-ch'], // first-class (ch content tier)
      ['digraphs-th-voiceless', 'digraphs-th-voiceless'], // first-class (th content tier)
      ['sight-words', 'sight-words'], // first-class (Wave 11 — ticket 86ca7xmr8, whole-word recognition tier)
      ['simple-sentences', 'simple-sentences'], // first-class (Wave 13 — ticket 86ca8e6fr, sentence-completion cloze tier; LAST word-song tier)
    ]
    for (const [requested, effective] of expectations) {
      const capture: { lastArgs?: unknown } = {}
      const client = makeMockClient(VALID_WORD_RESPONSE, { capture })
      await generateSessionPlan({
        client,
        track: 'word-song',
        level: 1,
        childName: 'Marian',
        focusNode: requested,
      })
      const args = capture.lastArgs as { messages: Array<{ content: string }> }
      const user = args.messages[0]!.content
      expect(user).toMatch(new RegExp(`Focus skill node: ${effective}\\.`))
      // For first-class nodes the requested name appears (it IS the
      // effective name). For fallback nodes the requested untuned-tier
      // name must NOT appear as a focus directive — it's silently
      // remapped to blending-cv. Asserting non-presence catches a future
      // edit that accidentally weaves the requested node back in.
      if (requested !== effective) {
        expect(user).not.toMatch(
          new RegExp(`Focus skill node: ${requested}\\.`),
        )
      }
    }
  })

  it('word-song does NOT touch math focus selection (defense-in-depth: math still walks the tree)', async () => {
    // Pin that the clamp is word-song-only. Math must continue to honour
    // caller-supplied focusNode verbatim — that's M2's whole point.
    const MATH_RESPONSE = JSON.stringify({
      id: 'haiku-math-001',
      label: 'm',
      utterances: [{ id: 'math.p1.read', text: 'Seven plus six. How many?' }],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: add-to-20\./)
  })

  it('round-trips a mocked response with word.p<N>.<slot> ids unchanged (parser-compatible shape)', async () => {
    // Pin that the planner's response validator accepts the exact shape
    // the browser parser (`wordSongSessionPlanFromServer`) consumes.
    // This pairs with the parser-side regression test in
    // src/screens/WordSong/planFromServer.test.ts.
    const FULL_8_PROBLEM_RESPONSE = JSON.stringify({
      id: 'haiku-word-cvc',
      label: 'CVC sweep',
      utterances: Array.from({ length: 8 }, (_, i) => i + 1).flatMap((n) => [
        { id: `word.p${n}.read`, text: 'Tap the cat.' },
        { id: `word.p${n}.correct`, text: 'Yes! Cat.' },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: "Let's look. Cat." },
        { id: `word.p${n}.giveAnswer`, text: 'This one is cat.' },
      ]),
    })
    const client = makeMockClient(FULL_8_PROBLEM_RESPONSE)

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
    })

    // Every problem utterance has the literal "word." prefix — the
    // browser parser's anchor.
    const problemIds = plan.utterances.map((u) => u.id)
    expect(problemIds.length).toBeGreaterThanOrEqual(40) // 8 × 5
    for (const id of problemIds) {
      expect(id).toMatch(
        /^word\.p\d+\.(read|correct|reprompt|hint|giveAnswer)$/,
      )
    }

    // Every read line matches the "Tap the <word>." template the parser
    // expects. We only check read slots (the others have different
    // templates). One read per problem index (1..8).
    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads.length).toBe(8)
    for (const r of reads) {
      expect(r.text).toMatch(/^Tap the [a-z]+\.$/)
    }
  })

  it('a no-progress (no focusNode) word-song call hits the same clamp + emits "word." ids', async () => {
    // Reproduces the exact prod incident "Case 1" — backwards-compat
    // request shape with no progress block. Pre-fix this emitted
    // `cvc.*` ids and silenced the browser. Post-fix the user message
    // routes to blending-cv and the system prompt instructs "word." ids.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      // focusNode + recentSuccessRate omitted (legacy browser shape)
    })

    const args = capture.lastArgs as {
      system: Array<{ text: string }>
      messages: Array<{ content: string }>
    }
    expect(args.messages[0]!.content).toMatch(/Focus skill node: blending-cv\./)
    const prompt = args.system.map((b) => b.text).join('\n')
    expect(prompt).toMatch(/ALWAYS use the literal prefix "word\."/i)
  })
})

/**
 * Graduation-session directive (ticket 86c9m3aec).
 *
 * The planner accepts an optional `isGraduationSession: boolean`. When
 * true AND the effective focus node is `cvc-words`, the user message
 * gains a directive instructing Haiku to mix 2–3 words from the novel
 * pool (`nap, rat, map, tap`) into the 8-problem set. Other tracks /
 * focus nodes ignore the flag silently.
 *
 * The system prompt acknowledges the graduation exception so Haiku
 * doesn't refuse the novel words under the "do not invent new words"
 * rule. The system text stays byte-stable across calls — the
 * cache-prefix invariant is preserved.
 */
describe('generateSessionPlan — graduation-session directive (ticket 86c9m3aec)', () => {
  const VALID_WORD_RESPONSE = JSON.stringify({
    id: 'haiku-word-grad-001',
    label: 'graduation session',
    utterances: [
      { id: 'word.p1.read', text: 'Read the cat.' },
      { id: 'word.p1.correct', text: 'Yes! Cat.' },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Cat." },
      { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
    ],
  })

  it('places the GRADUATION SESSION directive in the user message when isGraduationSession=true on cvc-words', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as {
      messages: Array<{ content: string }>
    }
    const user = args.messages[0]!.content
    // The directive header is the deterministic anchor.
    expect(user).toContain('GRADUATION SESSION')
    // The novel pool must be enumerated verbatim — Haiku needs the
    // exact word list to obey the "novel pool" instruction.
    expect(user).toContain('nap')
    expect(user).toContain('rat')
    expect(user).toContain('map')
    expect(user).toContain('tap')
    // 2 or 3 problems is the spec's fence — pin it as a regex anchor
    // so a future copy edit that drops the count fails this test.
    expect(user).toMatch(/2 or 3 problems/i)
  })

  it('omits the graduation directive when isGraduationSession is false / undefined', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
      // isGraduationSession omitted (undefined)
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('ignores isGraduationSession=true on the math track (graduation is cvc-words-only today)', async () => {
    // Defense-in-depth: graduation is currently scoped to cvc-words.
    // A misrouted flag on a math request must not leak the novel-pool
    // directive (which would be nonsensical for math problems).
    const MATH_RESPONSE = JSON.stringify({
      id: 'haiku-math-001',
      label: 'm',
      utterances: [{ id: 'math.p1.read', text: 'Three plus two. How many?' }],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('ignores isGraduationSession=true on non-cvc-words word-song tiers (graduation is cvc-words-gated)', async () => {
    // The graduation directive is gated on the EFFECTIVE focus node being
    // cvc-words (the only tier with a novel-pool probe), so a request on
    // ANY other word-song tier with the flag set must not carry the
    // directive — the session would otherwise emit graduation content
    // under a non-graduation focus. simple-sentences is used here as a
    // representative non-cvc-words tier. (Wave 13 made simple-sentences
    // first-class — the LAST word-song tier; EVERY word-song node is now
    // first-class. The gate is still cvc-words-only, so this assertion
    // holds: first-class != graduation-eligible.)
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'simple-sentences',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('a graduation call shares the same SYSTEM prompt text as a non-graduation call (cache invariant)', async () => {
    // Pin the prompt-cache invariant: the graduation flag is
    // user-message-only. Two calls that differ only in the flag must
    // produce byte-identical system text.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(VALID_WORD_RESPONSE, { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(VALID_WORD_RESPONSE, { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
      isGraduationSession: true,
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('the system prompt acknowledges the graduation exception (Haiku will not refuse novel words)', async () => {
    // Defensive prompt-content pin: the system prompt must mention
    // the graduation exception so Haiku doesn't enforce the "do not
    // invent new words" rule against the novel pool. We anchor on a
    // deterministic substring rather than the full block to keep the
    // test robust against benign copy edits.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
      isGraduationSession: true,
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    expect(prompt).toMatch(/GRADUATION-SESSION EXCEPTION/i)
  })
})

/**
 * Letter-sounds directive — current-target-vowel hint injection (Wave 7
 * Track A7 — Amendment 2 of ticket 86c9y49cd; Devon NOF on PR #332).
 *
 * The planner accepts an optional `currentTargetVowel: string` IPA hint
 * on `GenerateSessionPlanArgs`. When set AND the effective focus node is
 * `letter-sounds`, the user message gains a `LETTER-SOUNDS DIRECTIVE`
 * block carrying `current-target-vowel=<IPA>`. The block cycles through
 * /æ (mastered) → /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/ as the locked vowel ladder
 * (per `design/word-song/letter-sounds-content.md §1.4`).
 *
 * Without the hint, the directive falls back to /ɒ/ — Marian's next-
 * vowel-to-master. /æ/ is the mastered anchor (NOT a current-target
 * candidate); unrecognised IPAs fall through to /ɒ/ defensively.
 */
describe('generateSessionPlan — letter-sounds current-target-vowel hint (Wave 7 Track A7 Amendment 2, ticket 86c9y49cd)', () => {
  const VALID_LETTER_SOUNDS_RESPONSE = JSON.stringify({
    id: 'haiku-letter-sounds-001',
    label: 'letter-sounds short-o session',
    utterances: [
      { id: 'word.p1.read', text: 'Which letter says mmm?' },
      { id: 'word.p1.correct', text: 'Yes! M says mmm.' },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: 'Listen. mmm.' },
      { id: 'word.p1.giveAnswer', text: 'This one is M. M says mmm.' },
    ],
  })

  it('emits the LETTER-SOUNDS DIRECTIVE block on letter-sounds tier with the supplied current-target vowel', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
      currentTargetVowel: 'ɒ',
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toContain('LETTER-SOUNDS DIRECTIVE')
    expect(user).toContain('current-target-vowel=ɒ')
  })

  it('cycles the current-target vowel through /ɒ/ → /ʌ/ → /ɪ/ → /ɛ/ (the locked ladder)', async () => {
    // Each call carries a different supplied vowel. The directive
    // emission must mirror the input verbatim — the planner does NOT
    // re-validate or coerce within the locked candidate set (the
    // sanity check IS the candidate filter — only valid IPAs fall
    // through to the directive; unknowns drop to /ɒ/).
    const ladder = ['ɒ', 'ʌ', 'ɪ', 'ɛ'] as const
    for (const ipa of ladder) {
      const capture: { lastArgs?: unknown } = {}
      const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
      await generateSessionPlan({
        client,
        track: 'word-song',
        level: 1,
        childName: 'Marian',
        focusNode: 'letter-sounds',
        currentTargetVowel: ipa,
      })
      const args = capture.lastArgs as { messages: Array<{ content: string }> }
      const user = args.messages[0]!.content
      expect(user).toContain(`current-target-vowel=${ipa}`)
      expect(user).toContain(`This session's LIFT vowel is ${ipa}.`)
    }
  })

  it("falls back to /ɒ/ when currentTargetVowel is omitted (safe default — Marian's next-vowel-to-master)", async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
      // currentTargetVowel omitted
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toContain('LETTER-SOUNDS DIRECTIVE')
    expect(user).toContain('current-target-vowel=ɒ')
  })

  it("falls back to /ɒ/ when currentTargetVowel is an unrecognised value (defensive — directive's ADJACENT-VOWEL-BAN SELF-CHECK enforces the ban)", async () => {
    // /æ/ is NOT a current-target candidate (it's the mastered anchor).
    // Unrecognised input falls through to /ɒ/.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
      currentTargetVowel: 'æ', // not a current-target candidate
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toContain('current-target-vowel=ɒ')
    expect(user).not.toContain('current-target-vowel=æ')
  })

  it('omits the directive on non-letter-sounds tiers (cvc-words ignores the field silently)', async () => {
    const CVC_RESPONSE = JSON.stringify({
      id: 'haiku-cvc-001',
      label: 'cvc-words session',
      utterances: [
        { id: 'word.p1.read', text: 'Read the cat.' },
        { id: 'word.p1.correct', text: 'Yes! Cat.' },
        { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
        { id: 'word.p1.hint', text: "Let's look. Cat." },
        { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
      ],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(CVC_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
      currentTargetVowel: 'ɒ', // ignored on a non-letter-sounds tier
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).not.toContain('LETTER-SOUNDS DIRECTIVE')
    expect(user).not.toContain('current-target-vowel=')
  })

  it('omits the directive on the math track (defense-in-depth: letter-sounds is word-song-only)', async () => {
    const MATH_RESPONSE = JSON.stringify({
      id: 'haiku-math-001',
      label: 'm',
      utterances: [{ id: 'math.p1.read', text: 'Three plus two. How many?' }],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      currentTargetVowel: 'ɒ',
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).not.toContain('LETTER-SOUNDS DIRECTIVE')
  })

  it('cache prefix (system prompt) stays byte-stable across different current-target-vowel calls', async () => {
    // Cache-prefix invariant — two letter-sounds calls with different
    // vowel hints must share the system prompt bytes so prompt-cache
    // hits are not invalidated by per-session vowel cycling.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}
    await generateSessionPlan({
      client: makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
      currentTargetVowel: 'ɒ',
    })
    await generateSessionPlan({
      client: makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'letter-sounds',
      currentTargetVowel: 'ɪ',
    })
    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })
})

/**
 * Letter-sounds per-vowel runtime gate (Wave 9 W9.4 — ticket
 * 86c9ya3r9). The planner consumes `letterSoundsVowelStates` (per-vowel
 * sub-mastery, slash notation) and derives the current-target vowel via
 * the Kyle §1.4 algorithm — a HARD runtime gate replacing the Wave-7
 * directive-level approximation. Covers:
 *   - the four current-target derivations (all-intro→/o/, /o/-mastered→
 *     /u/, /i/-not-mastered+/e/-would-pick→skip-to-mastered-review,
 *     all-mastered→tier-mastered null);
 *   - the soft-validator (full-map required, any malformed value drops
 *     the whole field);
 *   - the non-fallback bypass predicate (all-intro = fallback);
 *   - the slash↔IPA notation translation;
 *   - the `CURRENT TARGET VOWEL: /<vowel>/` directive line.
 */
describe('letter-sounds per-vowel derivation (Wave 9 W9.4 — ticket 86c9ya3r9)', () => {
  const allIntro: LetterSoundsVowelStatesHint = {
    '/o/': 'intro',
    '/u/': 'intro',
    '/i/': 'intro',
    '/e/': 'intro',
  }

  describe('deriveCurrentTargetVowel — §1.4 algorithm', () => {
    it('all-intro (greenfield) → /o/ (first unintroduced in ladder order)', () => {
      expect(deriveCurrentTargetVowel(allIntro)).toBe('/o/')
    })

    it('/o/-mastered, rest intro → /u/ (first unintroduced after the mastered head)', () => {
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'intro',
          '/i/': 'intro',
          '/e/': 'intro',
        }),
      ).toBe('/u/')
    })

    it('first practicing vowel wins over a later intro vowel (common mid-stream case)', () => {
      // /o/ mastered, /u/ practicing → /u/ is current-target even though
      // /i/ and /e/ are still intro (step 2 before step 3).
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'practicing',
          '/i/': 'intro',
          '/e/': 'intro',
        }),
      ).toBe('/u/')
    })

    it('/i/-not-mastered + /e/ would be picked → skip to a mastered vowel for review (the /e/ adjacency gate)', () => {
      // Contrived state that forces the guard: /o/, /u/ mastered, /i/
      // practicing, /e/ intro. Normal walk stops at /i/ (practicing) —
      // that's the expected current-target, NOT /e/. The guard never
      // fires here because /i/ precedes /e/ and is practicing.
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'mastered',
          '/i/': 'practicing',
          '/e/': 'intro',
        }),
      ).toBe('/i/')
    })

    it('/e/ adjacency guard: a mutated state that would pick /e/ while /i/ is unmastered skips to a mastered review vowel', () => {
      // Belt-and-braces branch (debug-seed / state-mutation bug):
      // /o/ mastered, /u/ mastered, /i/ intro (NOT mastered), /e/
      // practicing. Step 2 finds /e/ practicing first in the practicing
      // scan? No — /i/ is intro not practicing, so step 2 finds /e/.
      // The guard catches /e/ + /i/ !== mastered → skip to the first
      // mastered vowel (/o/) for review-mode emission. This enforces the
      // cross-session /i/ → /e/ ban (§1.2 #2) even under a corrupt seed.
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'mastered',
          '/i/': 'intro',
          '/e/': 'practicing',
        }),
      ).toBe('/o/')
    })

    it('all-mastered → null (tier-mastered, no current-target emission)', () => {
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'mastered',
          '/i/': 'mastered',
          '/e/': 'mastered',
        }),
      ).toBeNull()
    })

    it('/i/ mastered unlocks /e/ as the legitimate current-target', () => {
      // /o/, /u/, /i/ mastered, /e/ intro → /e/ is now allowed (the
      // adjacency gate clears once /i/ is mastered).
      expect(
        deriveCurrentTargetVowel({
          '/o/': 'mastered',
          '/u/': 'mastered',
          '/i/': 'mastered',
          '/e/': 'intro',
        }),
      ).toBe('/e/')
    })
  })

  describe('parseLetterSoundsVowelStates — soft-validator (sibling of parseLeitnerHint)', () => {
    it('accepts a full valid 4-vowel map', () => {
      expect(parseLetterSoundsVowelStates(allIntro)).toEqual(allIntro)
    })

    it('accepts all three sub-states', () => {
      const mixed = {
        '/o/': 'mastered',
        '/u/': 'practicing',
        '/i/': 'intro',
        '/e/': 'intro',
      }
      expect(parseLetterSoundsVowelStates(mixed)).toEqual(mixed)
    })

    it('rejects a partial map (missing a ladder vowel) → null', () => {
      expect(
        parseLetterSoundsVowelStates({
          '/o/': 'intro',
          '/u/': 'intro',
          '/i/': 'intro',
          // /e/ missing
        }),
      ).toBeNull()
    })

    it('rejects an invalid sub-state value → null (whole field dropped)', () => {
      expect(
        parseLetterSoundsVowelStates({
          '/o/': 'locked', // not a valid sub-state (no locked arm)
          '/u/': 'intro',
          '/i/': 'intro',
          '/e/': 'intro',
        }),
      ).toBeNull()
    })

    it('rejects non-object / null / array inputs → null', () => {
      expect(parseLetterSoundsVowelStates(null)).toBeNull()
      expect(parseLetterSoundsVowelStates('intro')).toBeNull()
      expect(parseLetterSoundsVowelStates([])).toBeNull()
      expect(parseLetterSoundsVowelStates(42)).toBeNull()
    })
  })

  describe('letterSoundsStatesAreNonFallback — canon/cache bypass predicate', () => {
    it('all-intro is FALLBACK (false) — derives /o/ identical to canon default → canon-served', () => {
      expect(letterSoundsStatesAreNonFallback(allIntro)).toBe(false)
    })

    it('any practicing vowel is NON-FALLBACK (true) — bypass canon + cache', () => {
      expect(
        letterSoundsStatesAreNonFallback({
          '/o/': 'practicing',
          '/u/': 'intro',
          '/i/': 'intro',
          '/e/': 'intro',
        }),
      ).toBe(true)
    })

    it('any mastered vowel is NON-FALLBACK (true)', () => {
      expect(
        letterSoundsStatesAreNonFallback({
          '/o/': 'mastered',
          '/u/': 'intro',
          '/i/': 'intro',
          '/e/': 'intro',
        }),
      ).toBe(true)
    })
  })

  describe('slashVowelToIpa — notation translation', () => {
    it('maps each ladder vowel to its bare IPA', () => {
      expect(slashVowelToIpa('/o/')).toBe('ɒ')
      expect(slashVowelToIpa('/u/')).toBe('ʌ')
      expect(slashVowelToIpa('/i/')).toBe('ɪ')
      expect(slashVowelToIpa('/e/')).toBe('ɛ')
    })
  })

  describe('CURRENT TARGET VOWEL directive line (slash notation)', () => {
    const VALID_LETTER_SOUNDS_RESPONSE = JSON.stringify({
      id: 'ls-001',
      label: 'ls',
      utterances: [{ id: 'word.p1.read', text: 'Which letter says mmm?' }],
    })

    it('emits "CURRENT TARGET VOWEL: /o/" for the /ɒ/ bare-IPA hint', async () => {
      const capture: { lastArgs?: unknown } = {}
      const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
      await generateSessionPlan({
        client,
        track: 'word-song',
        level: 1,
        childName: 'Marian',
        focusNode: 'letter-sounds',
        currentTargetVowel: 'ɒ',
      })
      const args = capture.lastArgs as { messages: Array<{ content: string }> }
      const user = args.messages[0]!.content
      expect(user).toContain('CURRENT TARGET VOWEL: /o/')
    })

    it('emits the matching slash line for each ladder vowel', async () => {
      const cases: Array<[string, string]> = [
        ['ɒ', '/o/'],
        ['ʌ', '/u/'],
        ['ɪ', '/i/'],
        ['ɛ', '/e/'],
      ]
      for (const [ipa, slash] of cases) {
        const capture: { lastArgs?: unknown } = {}
        const client = makeMockClient(VALID_LETTER_SOUNDS_RESPONSE, { capture })
        await generateSessionPlan({
          client,
          track: 'word-song',
          level: 1,
          childName: 'Marian',
          focusNode: 'letter-sounds',
          currentTargetVowel: ipa,
        })
        const args = capture.lastArgs as {
          messages: Array<{ content: string }>
        }
        expect(args.messages[0]!.content).toContain(
          `CURRENT TARGET VOWEL: ${slash}`,
        )
      }
    })
  })
})

/**
 * Short-o sibling tier (ticket 86c9m3ae3, extended by 86c9teu2e). The
 * planner emits `cvc-words-short-o` content using the same "Read the
 * <word>." template as `cvc-words`, but the word pool is short-o.
 *
 * Pool history:
 *  - v1 (PR #150, ticket 86c9m3ae3): 8 words —
 *    `dog, mop, log, pot, box, fox, mom, hot`.
 *  - v2 (this PR's predecessor 86c9teu2e): 11 words — added
 *    `cot, top, pop` to match short-u parity and unblock the
 *    cross-vowel mode pool-size floor (≥ 11 per
 *    `cross-vowel-mix-spec.md` §6).
 *
 * Coverage strategy:
 *  - (a) System prompt acknowledges the new node + names all 11
 *    pool words.
 *  - (b) User message routes `cvc-words-short-o` through verbatim
 *    (first-class, no stub-fallback).
 *  - (c) Round-trip: a wire-shape response with 8 short-o "Read the
 *    <word>." problems parses cleanly via toEqual on the count;
 *    every target is in the 11-word pool.
 *  - (d) No short-a leakage: pool isolation is enforced upstream by
 *    the prompt + downstream by the wordPack; the short-o pool list
 *    itself in the system prompt contains no short-a words.
 *  - (e) Cache invariant: two calls differing only in focusNode
 *    (cvc-words vs cvc-words-short-o) share byte-identical system
 *    text. Per shared/prompt-caching.md, focusNode lives in the user
 *    message, not the cache prefix.
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: count-based
 * assertions (`.toEqual([…])`, `.toHaveLength(N)`, `.toEqual(N)`) —
 * never `.toContain` for the round-trip pool checks.
 */
describe('generateSessionPlan — cvc-words-short-o sibling tier (ticket 86c9m3ae3 / 86c9teu2e)', () => {
  /** The 8 words baked into the test plan factory below — a stable
   *  sample of the 11-word pool used to drive the round-trip path.
   *  The planner only emits 8 problems per session, so the wire-shape
   *  factory always produces 8; the 11-word pool below is the full
   *  set the planner may draw from. */
  const SHORT_O_WORDS = [
    'dog',
    'mop',
    'log',
    'pot',
    'box',
    'fox',
    'mom',
    'hot',
  ] as const

  /** The full 11-word short-o pool (v2, ticket 86c9teu2e). Membership
   *  checks pin that the planner's emitted targets fall inside this
   *  pool — they may be ANY 8 of these 11. */
  const FULL_SHORT_O_POOL: ReadonlySet<string> = new Set([
    'dog',
    'mop',
    'log',
    'pot',
    'box',
    'fox',
    'mom',
    'hot',
    'cot',
    'top',
    'pop',
  ])

  /** Build an 8-problem cvc-words-short-o wire response in template form. */
  function makeShortOPlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(`makeShortOPlan needs 8 words; got ${words.length}`)
    }
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-short-o-001',
      label: 'CVC short-o',
      utterances,
    })
  }

  it('routes cvc-words-short-o focus verbatim into the user message (first-class, no stub-fallback)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortOPlan(SHORT_O_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    // First-class node: the user message names it verbatim (vs a
    // stub-fallback tier which would name `blending-cv`).
    expect(user).toMatch(/Focus skill node: cvc-words-short-o\./)
  })

  it('system prompt names the 11-word short-o pool', async () => {
    // Pin the pool enumeration so a future copy edit can't silently
    // drop a word and cause Haiku to emit something the wordPack
    // doesn't carry. v2 pool (ticket 86c9teu2e) is 11 entries.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortOPlan(SHORT_O_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // Pool literal — the comma-joined list as embedded in the prompt.
    expect(prompt).toContain(
      'dog, mop, log, pot, box, fox, mom, hot, cot, top, pop',
    )
    // The third content-mode header.
    expect(prompt).toMatch(/cvc-words-short-o:/)
    // The label is updated to reflect the expanded pool size.
    expect(prompt).toContain('11-word short-o CVC')
  })

  it('round-trips a wire response with exactly 8 short-o problems drawn from the 11-word pool', async () => {
    // Count-based assertion per
    // `feedback_count_assertions_on_regression_tests.md` — `.toEqual`
    // / `.toHaveLength`, never `.toContain` for the pool check.
    // The wire response only contains 8 problems (planner contract);
    // pool membership is checked against the full 11-word v2 pool.
    const client = makeMockClient(makeShortOPlan(SHORT_O_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    // Every read-line word must be in the 11-word short-o pool —
    // exact membership, not "contains".
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    expect(readWords).toHaveLength(8)
    for (const word of readWords) {
      expect(FULL_SHORT_O_POOL.has(word)).toBe(true)
    }
    // Distinct targets (no repeats within a session).
    expect(new Set(readWords).size).toEqual(8)
  })

  it('round-trips a wire response that uses the 3 v2 extension words (cot/top/pop)', async () => {
    // Pool-extension coverage: a wire response built with the new
    // v2 extension words (cot, top, pop) round-trips cleanly. This
    // exercises the AC4 contract that the 3 new words can each
    // appear as the planner's emitted target.
    const planWords = ['cot', 'top', 'pop', 'dog', 'mom', 'pot', 'log', 'fox']
    const client = makeMockClient(makeShortOPlan(planWords))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    // Pin that the 3 extension words round-trip. Count-assertion via
    // sorted equality on the input planWords set — exact match, no
    // "contains" looseness.
    expect(readWords.slice().sort()).toEqual(
      ['cot', 'top', 'pop', 'dog', 'mom', 'pot', 'log', 'fox'].slice().sort(),
    )
    // And the pool-isolation invariant still holds.
    for (const word of readWords) {
      expect(FULL_SHORT_O_POOL.has(word)).toBe(true)
    }
  })

  it('every read line uses the "Read the <word>." template (no "Tap the" leakage from blending-cv)', async () => {
    const client = makeMockClient(makeShortOPlan(SHORT_O_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    for (const r of reads) {
      // Anchored regex — not contains. Drift would surface as a
      // failed match here.
      expect(r.text).toMatch(/^Read the [a-z]+\.$/)
      expect(r.text).not.toMatch(/^Tap the/)
    }
  })

  it('two calls differing only in focusNode (cvc-words vs cvc-words-short-o) share byte-identical system text (cache invariant)', async () => {
    // Per shared/prompt-caching.md: focusNode lives in the user
    // message, not the system block. The new sibling tier must not
    // cause a cache-prefix delta vs cvc-words.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(makeShortOPlan(SHORT_O_WORDS), { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(makeShortOPlan(SHORT_O_WORDS), { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toEqual(sys2)
  })

  it('graduation directive does NOT leak into a cvc-words-short-o session even with isGraduationSession=true', async () => {
    // The graduation gate is currently cvc-words-only (short-a) per
    // `WORD_SONG_GRADUATION_GATED_NODES` in mastery.ts. A misrouted
    // flag on a short-o request must not carry the directive — the
    // session would otherwise receive novel short-a words alongside
    // its short-o pool, which is nonsense for the new tier.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortOPlan(SHORT_O_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('cvc-words-short-o is in VALID_WORD_SONG_FOCUS_NODES (drift tripwire)', () => {
    // Direct contract pin: the planner's accept-set must include the
    // new sibling node. Without this, the handler would 4xx every
    // short-o request before reaching the planner.
    expect(VALID_WORD_SONG_FOCUS_NODES.includes('cvc-words-short-o')).toBe(true)
  })
})

/**
 * Short-u sibling tier (ticket 86c9q9ben). Mirrors the short-o block
 * above one tier further down the literacy ladder. The planner gains
 * `cvc-words-short-u` as a fourth first-class word-song content mode —
 * same "Read the <word>." template as `cvc-words` and
 * `cvc-words-short-o`, but the word pool shifts to the 11-word
 * short-u pool (`sun, cup, bus, bug, nut, tub, bun, jug, rug, hut,
 * gum`).
 *
 * Coverage strategy mirrors the short-o block:
 *  - (a) System prompt acknowledges the new node + names its 11 words.
 *  - (b) User message routes `cvc-words-short-u` through verbatim
 *    (first-class, no stub-fallback).
 *  - (c) Round-trip: a wire-shape response with 8 short-u "Read the
 *    <word>." problems parses cleanly via toEqual on the count.
 *  - (d) Cache invariant: two calls differing only in focusNode
 *    (cvc-words vs cvc-words-short-u) share byte-identical system
 *    text. focusNode lives in the user message, not the cache prefix.
 *  - (e) Graduation directive does not leak into a short-u session
 *    (the gate is currently cvc-words-only per
 *    `WORD_SONG_GRADUATION_GATED_NODES`).
 *  - (f) Direct membership pin in VALID_WORD_SONG_FOCUS_NODES.
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: count-based
 * assertions (`.toEqual([…])`, `.toHaveLength(N)`, `.toEqual(N)`) —
 * never `.toContain` for the round-trip pool checks.
 */
describe('generateSessionPlan — cvc-words-short-u sibling tier (ticket 86c9q9ben)', () => {
  const SHORT_U_WORDS = [
    'sun',
    'cup',
    'bus',
    'bug',
    'nut',
    'tub',
    'bun',
    'jug',
  ] as const

  /** Build an 8-problem cvc-words-short-u wire response in template
   *  form. The pool has 11 entries; we sample 8 distinct ones for the
   *  fixture (matching the planner's "exactly 8 distinct words"
   *  rule). */
  function makeShortUPlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(`makeShortUPlan needs 8 words; got ${words.length}`)
    }
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-short-u-001',
      label: 'CVC short-u',
      utterances,
    })
  }

  it('routes cvc-words-short-u focus verbatim into the user message (first-class, no stub-fallback)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: cvc-words-short-u\./)
  })

  it('system prompt names the 11-word short-u pool', async () => {
    // Pin the pool enumeration so a future copy edit can't silently
    // drop a word and cause Haiku to emit something the wordPack
    // doesn't carry.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // Pool literal — the comma-joined list as embedded in the prompt.
    expect(prompt).toContain(
      'sun, cup, bus, bug, nut, tub, bun, jug, rug, hut, gum',
    )
    // The fourth content-mode header.
    expect(prompt).toMatch(/cvc-words-short-u:/)
  })

  it('system prompt does NOT contain any short-u phonics scaffolding (stripped ticket 86c9qkf3v)', async () => {
    // Ticket 86c9qkf3v (2026-05-11): the contrast opener pattern is
    // dead — Azure renders phoneme-demonstration tokens as syllabic
    // noise regardless of orthography (slash-IPA, English spellouts,
    // inline IPA wraps all failed). The SHORT-U FIRST-ENCOUNTER
    // SCAFFOLDING block has been stripped. The planner must NOT
    // mandate any special opener text for cvc-words-short-u; it
    // should receive the same vanilla "You did it!" that every other
    // word-song focus node gets from the default Session-End contract.
    // Per `feedback_count_assertions_on_regression_tests.md`: count-
    // based (toHaveLength / not.toContain) not .toContain.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // Scaffolding directive and ALL its historical forms must be absent.
    expect(prompt).not.toContain('SHORT-U FIRST-ENCOUNTER SCAFFOLDING')
    expect(prompt).not.toContain('Sss, uh, nnn')
    expect(prompt).not.toContain('Sun, not soon')
    expect(prompt).not.toContain('/s/ /ʌ/ /n/')
    // Vanilla opener contract still applies: the system-preamble
    // session.end.opener is "You did it!" for all focus nodes.
    expect(prompt).toContain('"You did it!"')
  })

  it('round-trips a wire response with exactly 8 short-u problems', async () => {
    // Count-based assertion per
    // `feedback_count_assertions_on_regression_tests.md`.
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    expect(readWords).toHaveLength(8)
    const poolSet = new Set<string>([
      'sun',
      'cup',
      'bus',
      'bug',
      'nut',
      'tub',
      'bun',
      'jug',
      'rug',
      'hut',
      'gum',
    ])
    for (const word of readWords) {
      expect(poolSet.has(word)).toBe(true)
    }
    // Distinct targets (no repeats within a session).
    expect(new Set(readWords).size).toEqual(8)
  })

  it('every read line uses the "Read the <word>." template (no "Tap the" leakage from blending-cv)', async () => {
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    for (const r of reads) {
      expect(r.text).toMatch(/^Read the [a-z]+\.$/)
      expect(r.text).not.toMatch(/^Tap the/)
    }
  })

  it('two calls differing only in focusNode (cvc-words vs cvc-words-short-u) share byte-identical system text (cache invariant)', async () => {
    // Per shared/prompt-caching.md: focusNode lives in the user
    // message, not the system block. The new sibling tier must not
    // cause a cache-prefix delta vs cvc-words.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toEqual(sys2)
  })

  it('graduation directive does NOT leak into a cvc-words-short-u session even with isGraduationSession=true', async () => {
    // The graduation gate is currently cvc-words-only (short-a) per
    // `WORD_SONG_GRADUATION_GATED_NODES` in mastery.ts. A misrouted
    // flag on a short-u request must not carry the directive — the
    // session would otherwise receive novel short-a words alongside
    // its short-u pool, which is nonsense for the new tier.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShortUPlan(SHORT_U_WORDS), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('cvc-words-short-u is in VALID_WORD_SONG_FOCUS_NODES (drift tripwire)', () => {
    expect(VALID_WORD_SONG_FOCUS_NODES.includes('cvc-words-short-u')).toBe(true)
  })
})

/**
 * digraphs-sh content tier (the FIRST digraph tier — sits between
 * `cvc-words-short-e` and `sight-words` in `WordSongNode` /
 * `LITERACY_TREE` per PR #217's 3-sibling digraph split). The planner
 * emits `digraphs-sh` content using the same "Read the <word>."
 * template as `cvc-words`, but the word pool is the 7 sh-digraph words
 * (`ship, shell, shoe, sheep, shark, shed, shop`).
 *
 * Spec: `design/word-song/digraphs-sh-word-list.md` (Option C-minus,
 * locked 2026-05-14). Pairs with Devon's PR #220 (client-side
 * wordPack rows + `hybridMode` flags). Unblocks #219.
 *
 * Coverage strategy (mirrors the short-o / short-u sibling-tier blocks,
 * plus two digraphs-sh-specific concerns):
 *  - (a) User message routes `digraphs-sh` through verbatim
 *    (first-class, no stub-fallback to blending-cv).
 *  - (b) System prompt names the new node + the 7-word pool.
 *  - (c) Round-trip: a wire-shape response with 8 "Read the <word>."
 *    problems parses cleanly; every target is in the 7-word pool.
 *  - (d) Cache invariant: a `digraphs-sh` call shares byte-identical
 *    system text with a `cvc-words` call (focusNode lives in the user
 *    message, not the cache prefix).
 *  - (e) Graduation directive does NOT leak into a `digraphs-sh`
 *    session — the graduation gate is `cvc-words`-only.
 *  - (f) hybridMode problem-type GATE: the system prompt names the 3
 *    hybridMode words (`shoe, sheep, shark`) and forbids
 *    segmentation / spelling / decode-from-phoneme prompt types for
 *    them — Kyle's spec §6.1 + Dave addendum §Q7d / AC12.
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: count-based
 * assertions (`.toHaveLength(N)`, `.toEqual(N)`) — never `.toContain`
 * for the round-trip pool checks.
 */
describe('generateSessionPlan — digraphs-sh content tier (FIRST digraph tier)', () => {
  /** The full 7-word sh-digraph pool, in wordPack.ts row order. */
  const SH_POOL = [
    'ship',
    'shell',
    'shoe',
    'sheep',
    'shark',
    'shed',
    'shop',
  ] as const

  /** The 3 hybridMode words — long / r-controlled vowels outside
   *  Marian's formal phonics tiers. Chip-tap recognition ONLY. */
  const SH_HYBRID_WORDS = ['shoe', 'sheep', 'shark'] as const

  /** Build an 8-problem digraphs-sh wire response in template form.
   *  The sh pool has only 7 words, so the 8th problem repeats one
   *  conventional sh-CVC word (`ship`) — matching the planner's
   *  digraphs-sh EXCEPTION ("each of the 7 at least once, repeat ONE
   *  conventional sh-CVC word for the 8th"). */
  function makeShPlan(): string {
    const words = [...SH_POOL, 'ship'] // 8 entries, 7 distinct
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! That's a ${word}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-digraphs-sh-001',
      label: 'Digraphs sh',
      utterances,
    })
  }

  it('routes digraphs-sh focus verbatim into the user message (first-class, no stub-fallback)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: digraphs-sh\./)
    // It must NOT have been remapped to the blending-cv stub.
    expect(user).not.toMatch(/Focus skill node: blending-cv\./)
  })

  it('system prompt names the digraphs-sh content mode + the 7-word pool', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The content-mode header.
    expect(prompt).toMatch(/digraphs-sh:/)
    // Pool literal — the comma-joined list as embedded in the prompt.
    expect(prompt).toContain('ship, shell, shoe, sheep, shark, shed, shop')
  })

  it('system prompt carries the hybridMode problem-type GATE for shoe/sheep/shark (spec §6.1 / AC12)', async () => {
    // The hybridMode gate is the load-bearing digraphs-sh-specific
    // planner directive: shoe/sheep/shark are sight-word-hybrids whose
    // inside vowel is outside Marian's phonics tiers. The planner must
    // forbid segmentation / spelling / decode-from-phoneme prompt types
    // for those 3 words. v1 only emits chip-tap "Read the <word>."
    // anyway, but the gate is forward-compatible guidance.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The gate block header.
    expect(prompt).toContain('HYBRIDMODE PROBLEM-TYPE GATE')
    // All 3 hybridMode words named in the gate.
    for (const word of SH_HYBRID_WORDS) {
      expect(prompt).toContain(word)
    }
    // The gate must forbid the three disallowed problem-type classes.
    expect(prompt).toMatch(/segmentation/i)
    expect(prompt).toMatch(/spelling/i)
    expect(prompt).toMatch(/decode-from-letters/i)
    // And it must say MUST NOT (the prohibition, not a soft preference).
    expect(prompt).toMatch(/MUST NOT/)
  })

  it('round-trips a wire response with 8 problems drawn from the 7-word sh pool', async () => {
    // Count-based assertions per
    // `feedback_count_assertions_on_regression_tests.md`. digraphs-sh
    // is the ONE focus node where a target may legitimately appear
    // twice (7-word pool, 8-problem session) — so the assertion is
    // "8 reads, all from the pool, >= 7 distinct", NOT "8 distinct".
    const client = makeMockClient(makeShPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    expect(readWords).toHaveLength(8)
    const poolSet = new Set<string>(SH_POOL)
    for (const word of readWords) {
      expect(poolSet.has(word)).toBe(true)
    }
    // Every one of the 7 sh-words appears at least once.
    expect(new Set(readWords).size).toEqual(7)
  })

  it('every read line uses the "Read the <word>." template (no "Tap the" leakage from blending-cv)', async () => {
    const client = makeMockClient(makeShPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    for (const r of reads) {
      expect(r.text).toMatch(/^Read the [a-z]+\.$/)
      expect(r.text).not.toMatch(/^Tap the/)
    }
  })

  it('two calls differing only in focusNode (cvc-words vs digraphs-sh) share byte-identical system text (cache invariant)', async () => {
    // Per shared/prompt-caching.md: focusNode lives in the user
    // message, not the system block. The new digraph tier must not
    // cause a cache-prefix delta vs cvc-words.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(makeShPlan(), { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(makeShPlan(), { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toEqual(sys2)
  })

  it('graduation directive does NOT leak into a digraphs-sh session even with isGraduationSession=true', async () => {
    // The graduation gate is `cvc-words`-only (short-a) per
    // `WORD_SONG_GRADUATION_GATED_NODES` in mastery.ts. A misrouted
    // flag on a digraphs-sh request must not carry the directive — the
    // session would otherwise receive novel short-a words alongside
    // its sh-digraph pool, which is nonsense for the digraph tier.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeShPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('digraphs-sh is in VALID_WORD_SONG_FOCUS_NODES (drift tripwire)', () => {
    expect(VALID_WORD_SONG_FOCUS_NODES.includes('digraphs-sh')).toBe(true)
  })
})

/**
 * digraphs-ch content tier (the SECOND digraph tier — sits between
 * `digraphs-sh` and `digraphs-th-voiceless` in `WordSongNode` /
 * `LITERACY_TREE` per PR #211's 3-sibling digraph split). The planner
 * emits `digraphs-ch` content using the same "Read the <word>."
 * template as `cvc-words` / `digraphs-sh`, but the word pool is the 7
 * ch-digraph words (`chin, chip, chop, chat, chest, chug, chick`).
 *
 * Spec: `design/word-song/digraphs-ch-word-list.md` (Dave's §3c locked
 * inventory, 2026-05-14). Pairs with Devon's `feat/digraphs-ch-wordpack`
 * PR (client-side wordPack rows). Unblocks the ch-tier E2E spec.
 *
 * STRUCTURAL DIVERGENCE FROM digraphs-sh — covered explicitly below:
 *  - ZERO hybridMode words. Unlike the sh tier (`shoe/sheep/shark`
 *    flagged `hybridMode: true`), all 7 ch-words are fully decodable
 *    short-vowel words. The system prompt must NOT carry a ch-tier
 *    hybridMode problem-type gate. Dave addendum §3d / non-obvious
 *    finding #1 + Kyle spec §6.1 / AC12.
 *  - The ch tier instead carries the c-says-/k/ orthographic-trap
 *    framing — Marian already knows `c` says /k/, so `ch` saying /tʃ/
 *    must be named explicitly. Dave §1c / non-obvious finding #2.
 *
 * Coverage strategy (mirrors the digraphs-sh sibling-tier block):
 *  - (a) User message routes `digraphs-ch` through verbatim
 *    (first-class, no stub-fallback to blending-cv).
 *  - (b) System prompt names the new node + the 7-word pool.
 *  - (c) System prompt carries the c-says-/k/ framing AND does NOT
 *    carry a ch-tier hybridMode gate.
 *  - (d) Round-trip: a wire-shape response with 8 "Read the <word>."
 *    problems parses cleanly; every target is in the 7-word pool.
 *  - (e) Cache invariant: a `digraphs-ch` call shares byte-identical
 *    system text with a `cvc-words` call (focusNode lives in the user
 *    message, not the cache prefix).
 *  - (f) Graduation directive does NOT leak into a `digraphs-ch`
 *    session — the graduation gate is `cvc-words`-only.
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: count-based
 * assertions (`.toHaveLength(N)`, `.toEqual(N)`) — never `.toContain`
 * for the round-trip pool checks.
 */
describe('generateSessionPlan — digraphs-ch content tier (SECOND digraph tier)', () => {
  /** The full 7-word ch-digraph pool, in wordPack.ts row order. */
  const CH_POOL = [
    'chin',
    'chip',
    'chop',
    'chat',
    'chest',
    'chug',
    'chick',
  ] as const

  /** Build an 8-problem digraphs-ch wire response in template form.
   *  The ch pool has only 7 words, so the 8th problem repeats one
   *  ch-word (`chin`) — matching the planner's digraphs-ch EXCEPTION
   *  ("each of the 7 at least once, repeat ONE for the 8th"). */
  function makeChPlan(): string {
    const words = [...CH_POOL, 'chin'] // 8 entries, 7 distinct
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! That's a ${word}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-digraphs-ch-001',
      label: 'Digraphs ch',
      utterances,
    })
  }

  it('routes digraphs-ch focus verbatim into the user message (first-class, no stub-fallback)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeChPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: digraphs-ch\./)
    // It must NOT have been remapped to the blending-cv stub.
    expect(user).not.toMatch(/Focus skill node: blending-cv\./)
  })

  it('system prompt names the digraphs-ch content mode + the 7-word pool', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeChPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The content-mode header.
    expect(prompt).toMatch(/digraphs-ch:/)
    // Pool literal — the comma-joined list as embedded in the prompt.
    expect(prompt).toContain('chin, chip, chop, chat, chest, chug, chick')
  })

  it('system prompt carries the c-says-/k/ framing and NO ch-tier hybridMode gate (spec §6.1 / AC12)', async () => {
    // The ch tier's load-bearing planner directive is the OPPOSITE of
    // the sh tier's: it carries the c-says-/k/ orthographic-trap
    // framing (Dave §1c) and deliberately has ZERO hybridMode words —
    // the system prompt must NOT introduce a ch-tier hybridMode gate.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeChPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The c-says-/k/ framing block — ch's distinctive teaching point.
    expect(prompt).toContain('CH-DIGRAPH C-SAYS-/k/ FRAMING')
    // It must name the trap explicitly: ch is NOT the /k/ sound.
    expect(prompt).toMatch(/NOT the \/k\/ sound/)
    // The framing must reference "cat" — the word Marian already
    // decodes where `c` says /k/ (Dave §Recommendations-to-Kyle #1).
    expect(prompt).toMatch(/cat/)
    // The prompt explicitly states the ch tier has NO hybridMode gate.
    expect(prompt).toContain('NO HYBRIDMODE GATE for digraphs-ch')
    // And it must NOT carry a ch-tier hybridMode word list — the
    // HYBRIDMODE PROBLEM-TYPE GATE covers the sh AND th tiers, never
    // ch. (The string "HYBRIDMODE PROBLEM-TYPE GATE" still appears in
    // the prompt; what must be absent is the ch pool being subjected
    // to it.) The hybridMode gate block (from its header to the
    // "NO HYBRIDMODE GATE for digraphs-ch" disclaimer) must not name
    // `digraphs-ch` nor carry the ch pool literal.
    // Anchor on the fuller gate-block header — the bare string
    // "HYBRIDMODE PROBLEM-TYPE GATE" also appears in the digraphs-sh
    // mode-list description ("See the HYBRIDMODE PROBLEM-TYPE GATE
    // block below"), which would over-widen the slice.
    const gateBlock = prompt.slice(
      prompt.indexOf('HYBRIDMODE PROBLEM-TYPE GATE (digraphs-sh AND'),
      prompt.indexOf('NO HYBRIDMODE GATE for digraphs-ch'),
    )
    expect(gateBlock.includes('digraphs-ch')).toBe(false)
    expect(
      gateBlock.includes('chin, chip, chop, chat, chest, chug, chick'),
    ).toBe(false)
    // The gate names the 3 sh-hybrid words + the 2 th-hybrid words —
    // none of the ch pool. (sh+th hybrid list is the authoritative
    // gated set.)
    for (const gatedWord of ['shoe', 'sheep', 'shark', 'thick', 'cloth']) {
      expect(gateBlock).toContain(gatedWord)
    }
  })

  it('round-trips a wire response with 8 problems drawn from the 7-word ch pool', async () => {
    // Count-based assertions per
    // `feedback_count_assertions_on_regression_tests.md`. digraphs-ch
    // (like digraphs-sh) is a focus node where a target may legitimately
    // appear twice (7-word pool, 8-problem session) — so the assertion
    // is "8 reads, all from the pool, exactly 7 distinct", NOT "8
    // distinct".
    const client = makeMockClient(makeChPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    expect(readWords).toHaveLength(8)
    const poolSet = new Set<string>(CH_POOL)
    for (const word of readWords) {
      expect(poolSet.has(word)).toBe(true)
    }
    // Every one of the 7 ch-words appears at least once.
    expect(new Set(readWords).size).toEqual(7)
  })

  it('every read line uses the "Read the <word>." template (no "Tap the" leakage from blending-cv)', async () => {
    const client = makeMockClient(makeChPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    for (const r of reads) {
      expect(r.text).toMatch(/^Read the [a-z]+\.$/)
      expect(r.text).not.toMatch(/^Tap the/)
    }
  })

  it('two calls differing only in focusNode (cvc-words vs digraphs-ch) share byte-identical system text (cache invariant)', async () => {
    // Per shared/prompt-caching.md: focusNode lives in the user
    // message, not the system block. The new digraph tier must not
    // cause a cache-prefix delta vs cvc-words.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(makeChPlan(), { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(makeChPlan(), { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toEqual(sys2)
  })

  it('graduation directive does NOT leak into a digraphs-ch session even with isGraduationSession=true', async () => {
    // The graduation gate is `cvc-words`-only (short-a) per
    // `WORD_SONG_GRADUATION_GATED_NODES` in mastery.ts. A misrouted
    // flag on a digraphs-ch request must not carry the directive — the
    // session would otherwise receive novel short-a words alongside
    // its ch-digraph pool, which is nonsense for the digraph tier.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeChPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-ch',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('digraphs-ch is in VALID_WORD_SONG_FOCUS_NODES (drift tripwire)', () => {
    expect(VALID_WORD_SONG_FOCUS_NODES.includes('digraphs-ch')).toBe(true)
  })
})

/*
 * digraphs-th content tier (the THIRD and final digraph tier — sits
 * after `digraphs-ch` in `WordSongNode` / `LITERACY_TREE` per PR #211's
 * 3-sibling digraph split). The planner emits `digraphs-th-voiceless`
 * content using the same "Read the <word>." template as `cvc-words` /
 * `digraphs-sh` / `digraphs-ch`, but the word pool is the 7 voiceless-th
 * words (`thin, thick, path, bath, math, moth, cloth`).
 *
 * Spec: `design/word-song/digraphs-th-word-list.md` §1 (RECONCILED
 * against Dave's `design/research/digraph-th-addendum.md` §3f,
 * 2026-05-14). Pairs with Devon's `feat/digraphs-th-wordpack` PR
 * (client-side wordPack rows). Unblocks the th-tier E2E spec.
 *
 * STRUCTURAL SHAPE — covered explicitly below:
 *  - TWO hybridMode words (`thick`, `cloth`) — REUSES the sh-tier
 *    hybridMode problem-type gate, NOT a new one. `thick` is a
 *    double-digraph (`th` + `ck`); `cloth` carries a `/kl/` onset
 *    blend. Dave th-addendum §3e/§3f + Kyle spec §6.2. This is the
 *    OPPOSITE of the ch tier (ZERO hybridMode).
 *  - The th tier carries TWO teaching points neither sh nor ch needed:
 *    the tongue-between-teeth articulation cue (the /θ/→/t/
 *    substitution has no L1 anchor for a Tagalog-L1 learner — Dave
 *    §1a/§1b/§5b), and the voiceless-vs-voiced disambiguation (`th`
 *    spells both /θ/ and /ð/; voiced /ð/ function words are EXCLUDED —
 *    Dave §2a/§2b/§4a, Kyle §1.4).
 *
 * Coverage strategy (mirrors the digraphs-sh / digraphs-ch blocks):
 *  - (a) User message routes `digraphs-th-voiceless` through verbatim
 *    (first-class, no stub-fallback to blending-cv).
 *  - (b) System prompt names the new node + the 7-word pool.
 *  - (c) System prompt carries the voiceless-/θ/ framing AND extends
 *    the hybridMode gate to the th pool (thick, cloth).
 *  - (d) Round-trip: a wire-shape response with 8 "Read the <word>."
 *    problems parses cleanly; every target is in the 7-word pool.
 *  - (e) Cache invariant: a `digraphs-th-voiceless` call shares
 *    byte-identical system text with a `cvc-words` call.
 *  - (f) Graduation directive does NOT leak into a th session.
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: count-based
 * assertions (`.toHaveLength(N)`, `.toEqual(N)`) — never `.toContain`
 * for the round-trip pool checks.
 */
describe('generateSessionPlan — digraphs-th content tier (THIRD digraph tier)', () => {
  /** The full 7-word voiceless-th pool, in wordPack.ts row order. */
  const TH_POOL = [
    'thin',
    'thick',
    'path',
    'bath',
    'math',
    'moth',
    'cloth',
  ] as const

  /** Words whose correct-slot line uses the "Yes! <Word>!" bang
   *  fallback rather than the article-led "Yes! That's a <word>."
   *  template — adjectives (thin, thick) and the non-count domain noun
   *  (math) cannot take an indefinite article. */
  const TH_BANG_WORDS = new Set<string>(['thin', 'thick', 'math'])

  /** Build an 8-problem digraphs-th wire response in template form.
   *  The th pool has only 7 words, so the 8th problem repeats one
   *  fully-decodable th-word (`thin`) — matching the planner's
   *  digraphs-th-voiceless EXCEPTION ("each of the 7 at least once,
   *  repeat ONE fully-decodable word for the 8th"). */
  function makeThPlan(): string {
    const words = [...TH_POOL, 'thin'] // 8 entries, 7 distinct
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      const correct = TH_BANG_WORDS.has(word)
        ? `Yes! ${cap}!`
        : `Yes! That's a ${word}.`
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: correct },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-digraphs-th-001',
      label: 'Digraphs th',
      utterances,
    })
  }

  it('routes digraphs-th-voiceless focus verbatim into the user message (first-class, no stub-fallback)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: digraphs-th-voiceless\./)
    // It must NOT have been remapped to the blending-cv stub.
    expect(user).not.toMatch(/Focus skill node: blending-cv\./)
  })

  it('system prompt names the digraphs-th-voiceless content mode + the 7-word pool', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The content-mode header.
    expect(prompt).toMatch(/digraphs-th-voiceless:/)
    // Pool literal — the comma-joined list as embedded in the prompt.
    expect(prompt).toContain('thin, thick, path, bath, math, moth, cloth')
  })

  it('system prompt carries the voiceless-/θ/ framing and extends the hybridMode gate to thick + cloth (spec §6.2)', async () => {
    // The th tier's load-bearing planner directives: (1) the
    // voiceless-/θ/ articulation framing (tongue-between-teeth cue +
    // voiced-vs-voiceless disambiguation — Dave th-addendum §1/§2/§5b),
    // and (2) the hybridMode gate REUSED from the sh tier, extended to
    // cover thick + cloth.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')
    // The voiceless-/θ/ framing block — th's distinctive teaching point.
    expect(prompt).toContain('TH-DIGRAPH VOICELESS-/θ/ FRAMING')
    // It must name the tongue-between-teeth articulation cue.
    expect(prompt).toMatch(/tongue between your teeth/)
    // It must flag the voiced-vs-voiceless split (without teaching it).
    expect(prompt).toMatch(/some other "th" words sound different/)
    // The hybridMode gate must now name BOTH sh-tier and th-tier in its
    // header, and the th-tier hybrid words thick + cloth.
    expect(prompt).toContain(
      'HYBRIDMODE PROBLEM-TYPE GATE (digraphs-sh AND digraphs-th-voiceless',
    )
    // The hybridMode gate block must name thick and cloth as the gated
    // th-tier words. Slice from the gate header to the
    // "NO HYBRIDMODE GATE for digraphs-ch" disclaimer.
    const gateBlock = prompt.slice(
      prompt.indexOf('HYBRIDMODE PROBLEM-TYPE GATE (digraphs-sh AND'),
      prompt.indexOf('NO HYBRIDMODE GATE for digraphs-ch'),
    )
    expect(gateBlock).toContain('thick')
    expect(gateBlock).toContain('cloth')
    // The sh-hybrid words are still gated too.
    for (const shWord of ['shoe', 'sheep', 'shark']) {
      expect(gateBlock).toContain(shWord)
    }
    // The fully-decodable th-words must NOT be in the gated set.
    for (const decodable of ['thin', 'path', 'bath', 'math', 'moth']) {
      // they appear in the pool list elsewhere, but the gate block's
      // explicit gated-word enumeration names only thick + cloth.
      // Assert the gate block's gated-list sentence (the
      // `_HYBRID.join(', ')` interpolation) is exactly "thick, cloth".
      expect(gateBlock).not.toMatch(
        new RegExp(`seven th-words — [^\\n]*\\b${decodable}\\b`),
      )
    }
  })

  it('round-trips a wire response with 8 problems drawn from the 7-word th pool', async () => {
    // Count-based assertions per
    // `feedback_count_assertions_on_regression_tests.md`.
    // digraphs-th-voiceless (like digraphs-sh / digraphs-ch) is a focus
    // node where a target may legitimately appear twice (7-word pool,
    // 8-problem session) — so the assertion is "8 reads, all from the
    // pool, exactly 7 distinct", NOT "8 distinct".
    const client = makeMockClient(makeThPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    const reReadLine = /^Read the ([a-z]+)\.$/
    const readWords = reads.map((u) => u.text.match(reReadLine)![1]!)
    expect(readWords).toHaveLength(8)
    const poolSet = new Set<string>(TH_POOL)
    for (const word of readWords) {
      expect(poolSet.has(word)).toBe(true)
    }
    // Every one of the 7 th-words appears at least once.
    expect(new Set(readWords).size).toEqual(7)
  })

  it('every read line uses the "Read the <word>." template (no "Tap the" leakage from blending-cv)', async () => {
    const client = makeMockClient(makeThPlan())

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const reads = plan.utterances.filter((u) => u.id.endsWith('.read'))
    expect(reads).toHaveLength(8)
    for (const r of reads) {
      expect(r.text).toMatch(/^Read the [a-z]+\.$/)
      expect(r.text).not.toMatch(/^Tap the/)
    }
  })

  it('two calls differing only in focusNode (cvc-words vs digraphs-th-voiceless) share byte-identical system text (cache invariant)', async () => {
    // Per shared/prompt-caching.md: focusNode lives in the user
    // message, not the system block. The new digraph tier must not
    // cause a cache-prefix delta vs cvc-words.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(makeThPlan(), { capture: cap1 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    await generateSessionPlan({
      client: makeMockClient(makeThPlan(), { capture: cap2 }),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toEqual(sys2)
  })

  it('graduation directive does NOT leak into a digraphs-th-voiceless session even with isGraduationSession=true', async () => {
    // The graduation gate is `cvc-words`-only (short-a) per
    // `WORD_SONG_GRADUATION_GATED_NODES` in mastery.ts. A misrouted
    // flag on a th request must not carry the directive — the session
    // would otherwise receive novel short-a words alongside its
    // th-digraph pool, which is nonsense for the digraph tier.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(makeThPlan(), { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-th-voiceless',
      isGraduationSession: true,
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('GRADUATION SESSION')
  })

  it('digraphs-th-voiceless is in VALID_WORD_SONG_FOCUS_NODES (drift tripwire)', () => {
    expect(VALID_WORD_SONG_FOCUS_NODES.includes('digraphs-th-voiceless')).toBe(
      true,
    )
  })
})

describe('generateSessionStartResponse — combined planner + TTS callable (D, 86c9kwhbc)', () => {
  // Pre-86c9kwhbc the HTTP handler awaited generateSessionPlan and
  // renderSessionAudio in succession. The build-time canon-generator
  // wants the same composition without HTTP scaffolding, so the pair
  // is wrapped in `generateSessionStartResponse`. These tests pin:
  //   1. It composes planner + TTS in one call.
  //   2. Args route through to the planner unchanged.
  //   3. The render seam is honoured (build script can mock TTS).
  //   4. Planner errors propagate as PlannerError (not swallowed).
  //
  // We import the function dynamically inside the describe so the
  // outer afterEach `vi.restoreAllMocks` doesn't tear down the
  // module-loaded function between tests.

  const VALID_PLAN = JSON.stringify({
    id: 'gsr-test',
    label: 'gsr test',
    utterances: [{ id: 'math.p1.read', text: 'Three plus two. How many?' }],
  })

  it('returns a SessionStartResponse merging planner output with rendered audio', async () => {
    const { generateSessionStartResponse } = await import('./_planner.js')
    const client = makeMockClient(VALID_PLAN)
    const synthCalls: Array<{ text: string; voice?: string }> = []
    const fakeSynth = async (req: { text: string; voice?: string }) => {
      synthCalls.push(req)
      return { audio: new Uint8Array([0xff, 0xfb, 0x00]) }
    }

    const response = await generateSessionStartResponse({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      renderOptions: { synth: fakeSynth },
    })

    expect(response.ok).toBe(true)
    expect(response.kind).toBe('session-start')
    expect(response.utterances).toHaveLength(1)
    expect(response.utterances[0]!.id).toBe('math.p1.read')
    expect(response.utterances[0]!.audio.kind).toBe('inline')
    expect(response.utterances[0]!.audio.base64.length).toBeGreaterThan(0)
    // Synth was invoked exactly once for the one planned utterance.
    expect(synthCalls).toHaveLength(1)
    expect(synthCalls[0]).toMatchObject({
      text: 'Three plus two. How many?',
      voice: 'en-GB-OliviaNeural',
    })
  })

  it('forwards focusNode + recentSuccessRate to the planner unchanged', async () => {
    const { generateSessionStartResponse } = await import('./_planner.js')
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_PLAN, { capture })
    const fakeSynth = async () => ({ audio: new Uint8Array([1, 2]) })

    await generateSessionStartResponse({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      recentSuccessRate: 0.7,
      renderOptions: { synth: fakeSynth },
    })

    const args = capture.lastArgs as {
      messages: Array<{ content: string }>
    }
    expect(args.messages[0]!.content).toContain('add-to-20')
    expect(args.messages[0]!.content).toMatch(/0\.70/)
  })

  it('propagates PlannerError from the underlying generateSessionPlan', async () => {
    const { generateSessionStartResponse, PlannerError } =
      await import('./_planner.js')
    const client = makeMockClient('not json at all')
    let synthCalled = false
    const fakeSynth = async () => {
      synthCalled = true
      return { audio: new Uint8Array([1, 2]) }
    }

    await expect(
      generateSessionStartResponse({
        client,
        track: 'math',
        level: 1,
        childName: 'Marian',
        renderOptions: { synth: fakeSynth },
      }),
    ).rejects.toBeInstanceOf(PlannerError)
    // TTS pipeline never invoked when planner fails.
    expect(synthCalled).toBe(false)
  })
})

/**
 * M4 Leitner-wiring directive tests (ticket 86c9pwgc8).
 *
 * The Leitner directive sits in the user message (volatile per call)
 * so the system prefix stays cache-stable. Active only on math +
 * add-to-10 with a non-empty array; ignored otherwise.
 */
describe('generateSessionPlan — Leitner directive (ticket 86c9pwgc8 — M4)', () => {
  const MATH_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-math-leitner',
    label: 'leitner-weighted',
    utterances: [
      { id: 'math.p1.read', text: 'Three plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Five!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Three. And two more. How many now?' },
      { id: 'math.p1.giveAnswer', text: 'This one is five.' },
    ],
  })

  it('places the LEITNER PRIORITY DIRECTIVE in the user message when leitner is non-empty (math+add-to-10)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      leitner: [
        { a: 6, b: 4, op: '+', box: 1 },
        { a: 5, b: 5, op: '+', box: 1 },
        { a: 3, b: 2, op: '+', box: 3 },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toContain('LEITNER PRIORITY DIRECTIVE')
    // Each box is enumerated by its facts, in `a±b` form.
    expect(user).toContain('Box 1: 6+4, 5+5.')
    expect(user).toContain('Box 3: 3+2.')
    // The "weight box-1 toward problems 4-8" rule is the actionable
    // guidance — pin its presence so a future copy edit that drops
    // it fails this test.
    expect(user).toMatch(/problems? 4-8/i)
    // The "forbidden in problems 1-3" rule is the gentle-ramp
    // guarantee from AC #2/#3.
    expect(user).toMatch(/problems? 1-3/i)
  })

  it('omits the directive when leitner is undefined (default, back-compat)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      // leitner omitted
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain(
      'LEITNER PRIORITY DIRECTIVE',
    )
  })

  it('omits the directive when leitner is empty', async () => {
    // Empty array reads "I have a Leitner box but nothing in it" — same
    // semantics as undefined for the planner. The browser is supposed
    // to omit the field entirely on the wire when the box is empty
    // (so the canon-served free path stays active), but the planner
    // defends in depth.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      leitner: [],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain(
      'LEITNER PRIORITY DIRECTIVE',
    )
  })

  it('ignores the directive on the word-song track (Leitner is math-only today)', async () => {
    const WORD_RESPONSE = JSON.stringify({
      id: 'haiku-word-001',
      label: 'word session',
      utterances: [
        { id: 'word.p1.read', text: 'Tap the cat.' },
        { id: 'word.p1.correct', text: 'Yes! Cat.' },
        { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
        { id: 'word.p1.hint', text: "Let's look. Cat." },
        { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
      ],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'blending-cv',
      // Misrouted leitner — should be silently ignored.
      leitner: [{ a: 3, b: 2, op: '+', box: 1 }],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain(
      'LEITNER PRIORITY DIRECTIVE',
    )
  })

  it('ignores the directive on math focus nodes other than add-to-10', async () => {
    // Defense-in-depth: Leitner-driven session generation is currently
    // add-to-10-only because that's the only level/node Marian is
    // touching today. A misrouted leitner on add-to-20 must not leak
    // the directive (which would reference add-to-10-shaped facts on
    // an add-to-20 problem set).
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      leitner: [{ a: 3, b: 2, op: '+', box: 1 }],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain(
      'LEITNER PRIORITY DIRECTIVE',
    )
  })

  it('a Leitner-active call shares the SAME system prompt as a Leitner-off call (cache invariant)', async () => {
    // Pin: the leitner field is user-message-only. Two calls that
    // differ only in `leitner` MUST produce byte-identical system
    // text so prompt-cache hits stay maximal.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      leitner: [{ a: 6, b: 4, op: '+', box: 1 }],
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('groups facts by box level, listing box 1 first', async () => {
    // The directive composition rule: emit one line per non-empty
    // box level, ascending. This pins the format Haiku is reading.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      leitner: [
        { a: 1, b: 1, op: '+', box: 4 },
        { a: 2, b: 2, op: '+', box: 1 },
        { a: 3, b: 3, op: '+', box: 2 },
        { a: 4, b: 4, op: '+', box: 1 },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    // Box 1 line lists both facts; box 2 lists one; box 4 lists one.
    expect(user).toContain('Box 1: 2+2, 4+4.')
    expect(user).toContain('Box 2: 3+3.')
    expect(user).toContain('Box 4: 1+1.')
    // Box 1 appears before box 2 in the directive body.
    const idxB1 = user.indexOf('Box 1:')
    const idxB2 = user.indexOf('Box 2:')
    const idxB4 = user.indexOf('Box 4:')
    expect(idxB1).toBeGreaterThanOrEqual(0)
    expect(idxB2).toBeGreaterThan(idxB1)
    expect(idxB4).toBeGreaterThan(idxB2)
  })
})

// ── add-to-20 prompt tightening (ticket 86c9q5q13) ─────────────────────

describe('generateSessionPlan — add-to-20 prompt content (ticket 86c9q5q13)', () => {
  // Pins the prompt's add-to-20 directive language. The May 2026 canon
  // bake had Haiku emit a 4+4=8 problem under the previous looser
  // wording — that's add-to-10's territory, not add-to-20's. The
  // tightened prompt forbids it explicitly. These tests pin the load-
  // bearing phrases so a future "let me simplify the prompt" edit can't
  // accidentally relax the constraint.

  const STUB_RESPONSE = JSON.stringify({
    id: 'haiku-add20',
    label: 'a',
    utterances: [{ id: 'math.p1.read', text: 'Seven plus six. How many?' }],
  })

  it('the add-to-20 menu line forbids sums <= 10 explicitly (system prompt)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')

    // The tightened phrasing — Haiku has misfired here before, so we
    // pin both the strict-range and the FORBIDDEN markers. PR B
    // (ticket follow-up to 86c9uuqzu) tightened the bracket form
    // ("[11, 20]"); the prior shipped form was the bare-range
    // "11-20". The pin intent is unchanged: lock the load-bearing
    // strict-range language.
    expect(systemText).toContain('sums STRICTLY in [11, 20]')
    expect(systemText).toContain('FORBIDDEN here')
    // The cross-10-bridge guidance is the heart of the tier; pin it so
    // a future prompt slimming pass can't drop it accidentally.
    expect(systemText).toContain('cross-10-bridge')
  })

  it('the add-to-20 menu line forbids ten-plus-single (10+5=15) and any addend = 10 (system prompt)', async () => {
    // Devon's PR #166 review (2026-05-08): aligns the canon prompt with
    // the static-fallback rotation, which already holds both addends in
    // 1-9. Reasons for forbidding ten-plus-single:
    //
    //   1. Visual: a 10-flower row at text-[3.2rem] overflows the iPad
    //      portrait safe area when paired with the second-addend group
    //      (canon's pre-fix P2 "Ten plus five" sat ~52rem wide vs ~752pt
    //      available). Single visual contract across canon + fallback.
    //   2. Pedagogy: 10+5=15 is *easier* than cross-10-bridge 8+5=13;
    //      the actual learning target at this tier is cross-10-bridge.
    //   3. Distractor scoping: keeping `correct` in the same range the
    //      fallback emits simplifies threading `maxAnswer` through
    //      `pickDistractors`; the boundary stays at the natural [1, 20]
    //      tier ceiling without further branching.
    //
    // These pins lock the tightened phrasing so a future "let me
    // simplify this prompt" pass can't accidentally re-allow ten-plus-
    // single forms.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // Both addends must be in 1-9; ten-plus-single is explicitly forbidden.
    // Phrasing updated in the PR B directive sharpening (ticket follow-up
    // to 86c9uuqzu): the prior single-line directive at `:964` was
    // replaced with a structured FACT POOL block per Kyle's spec §4.1;
    // the ten-plus-single ban moved to the opener sentence + the
    // dedicated ADDEND-RANGE SELF-CHECK block. The pin intent is
    // unchanged (lock the load-bearing ten-plus-single language).
    expect(systemText).toContain('BOTH addends in [1, 9]')
    expect(systemText).toContain(
      "NO TEN-PLUS-SINGLE (10+n, n+10 FORBIDDEN — that's two-digit-addsub territory)",
    )
    expect(systemText).toMatch(/either addend is 10 or greater/)
    // The COMPUTE+CONFIRM directive that drove the earlier sums fix is
    // extended to also confirm addend bounds; pin that load-bearing
    // language too. The structured ADDEND-RANGE SELF-CHECK block names
    // the same constraint with a different verb shape.
    expect(systemText).toContain('CONFIRM that a in [1, 9] AND b in [1, 9]')
    // Concrete forbidden-addend exemplars exist in the prompt (now in
    // the ADDEND-RANGE SELF-CHECK worked-example block).
    expect(systemText).toContain('10+8=18 is FORBIDDEN')
    expect(systemText).toContain('12+5=17 is FORBIDDEN')
    // And the prompt must NOT lean back into the previous phrasing — the
    // earlier draft said "exactly one addend = 10" was permitted.
    expect(systemText).not.toMatch(/exactly one addend\s*=\s*10/)
  })

  it('add-to-20 prompt is byte-stable across calls (cache prefix invariant)', async () => {
    // Same shape pin as the focusNode test block. The system prompt MUST
    // NOT change between successive add-to-20 calls — otherwise Anthropic
    // prompt caching would break across calls and the per-session cost
    // would jump.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      recentSuccessRate: 0.5,
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('add-to-20 user message names the focus node and preserves the shape', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      recentSuccessRate: 0.85,
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: add-to-20\./)
    expect(user).toContain('Marian')
    expect(user).toContain('0.85')
  })

  it('Leitner directive is NOT injected for add-to-20 (active scope = add-to-10 only)', async () => {
    // M4 wiring (ticket 86c9pwgc8) is currently scoped to add-to-10.
    // A future ticket will widen Leitner to add-to-20 once Marian has
    // accumulated enough box content there — but for now a misrouted
    // leitner array must be silently ignored (not added to the user
    // message, not throwing). This is the same posture as in the
    // existing add-to-20 / two-digit-addsub Leitner tests above.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      leitner: [{ a: 8, b: 5, op: '+', box: 1 }],
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).not.toContain('LEITNER PRIORITY DIRECTIVE')
    expect(user).not.toContain('Box 1:')
  })
})

// ── add-to-10 prompt directive (Wave-6 playbook sharpening, Wave 7 B3) ──

describe('generateSessionPlan — add-to-10 prompt content (Wave 7 Track B3, Dave audit 2026-05-23)', () => {
  // Drift-guard for the post-Wave-6 sharpening of the add-to-10
  // directive at api/_planner.ts:933+. Source of truth: Dave's audit at
  // design/research/add-to-10-canon-audit-2026-05-23.md §5.
  //
  // The audit identified 4 missing playbook patterns from
  // [[feedback_haiku_directive_sharpening]]:
  //   - Pattern 3: per-rule self-check blocks
  //   - Pattern 5: DOUBLES-CAP SELF-CHECK (Haiku's strong doubles prior;
  //                PR #266 attempts 1-2 BOTH produced 2+2 + 3+3 + 4+4
  //                trifecta — composition-lint caught both pre-disk)
  //   - Pattern 6: hoisted CATEGORY-MIX BUDGET with both failure modes
  //                + WORKED EXAMPLE block
  //   - Pattern 7: RULE_IDENTITY+SPEC+LINT triple-pin drift-guard tag
  //
  // These assertions lock the load-bearing block headers and negative
  // anchors so a future "let me simplify this prompt" edit cannot
  // silently strip a cap-self-check and reintroduce the doubles-prior
  // failure mode.

  const STUB_RESPONSE = JSON.stringify({
    id: 'haiku-add-to-10',
    label: 'a',
    utterances: [
      {
        id: 'math.p1.read',
        text: 'One plus two. How many?',
      },
    ],
  })

  it('carries a triple-pin drift-guard tag naming RULE_IDENTITY + SPEC + LINT (Pattern 7)', async () => {
    // Mirrors Dave's with-regroup drift-guard at PR #314. Single canon
    // exemplar today; this is the second.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('RULE_IDENTITY=add-to-10-composition')
    expect(systemText).toContain('SPEC=design/math/add-to-10-content.md§2')
    expect(systemText).toContain('LINT=scripts/compositionLint.ts:704')
    expect(systemText).toContain('ADD_TO_TEN_RULES')
    expect(systemText).toContain('ADD_TO_TEN_POOL')
    expect(systemText).toContain('lintAddToTenComposition')
    // The drift-guard must explicitly forbid silent rule re-naming.
    expect(systemText).toContain(
      'Do NOT rename, re-band, re-cap, or substitute facts',
    )
  })

  it('hoists a CATEGORY-MIX BUDGET block FIRST naming both failure modes (Pattern 6)', async () => {
    // The CATEGORY-MIX BUDGET must precede the SESSION COMPOSITION RULES
    // block so Haiku reads the caps BEFORE attention saturates on
    // doubles or plus-one. Both failure modes must be named explicitly.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('CATEGORY-MIX BUDGET')
    expect(systemText).toContain('apply BEFORE selecting any facts')
    // Both failure modes must be named (Dave audit §5 recommendation 1).
    expect(systemText).toContain('FAILURE MODES BOTH WAYS')
    expect(systemText).toContain('doubles-prior')
    expect(systemText).toContain('plus-one-saturation')
    expect(systemText).toContain('PR #266')
    // All five caps must be re-stated in the budget block.
    expect(systemText).toMatch(/sums-to-10:\s+AT MOST 2/)
    expect(systemText).toMatch(/doubles:\s+AT MOST 2/)
    expect(systemText).toMatch(/plus-one:\s+AT MOST 2/)
    expect(systemText).toMatch(/near-doubles:\s+AT MOST 3/)
    expect(systemText).toMatch(/general:\s+AT MOST 2/)
    // Structural ordering: CATEGORY-MIX BUDGET must precede the
    // SESSION COMPOSITION RULES heading.
    const budgetIdx = systemText.indexOf('CATEGORY-MIX BUDGET')
    const rulesIdx = systemText.indexOf(
      'SESSION COMPOSITION RULES (apply IN ORDER, AFTER the CATEGORY-MIX BUDGET',
    )
    expect(budgetIdx).toBeGreaterThan(-1)
    expect(rulesIdx).toBeGreaterThan(budgetIdx)
  })

  it('carries a DOUBLES-CAP SELF-CHECK negative-anchored block (Pattern 5)', async () => {
    // Mirrors sub-to-10's DOUBLES-CAP SELF-CHECK at _planner.ts:1087.
    // The negative anchor must name the full forbidden trifecta — this
    // is the EMPIRICALLY-OBSERVED failure mode from PR #266 attempts 1-2
    // (both bakes shipped 2+2, 3+3, 4+4 in the same session before
    // composition-lint caught them).
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('DOUBLES-CAP SELF-CHECK')
    expect(systemText).toContain('AT MOST TWO')
    expect(systemText).toContain('{2+2, 3+3, 4+4}')
    // The full forbidden trifecta must be named explicitly.
    expect(systemText).toContain('FORBIDDEN to place 2+2 AND 3+3 AND 4+4')
    // 5+5 must be explicitly carved out as sums-to-10 (priority order),
    // NOT doubles — otherwise Haiku may double-count it.
    expect(systemText).toContain('5+5 is sums-to-10 by priority, NOT doubles')
  })

  it('carries per-rule self-check tags anchored against attention-budget-shift (Pattern 3)', async () => {
    // Pattern 3 manifests as <self-check>...</self-check> annotations
    // attached to each load-bearing rule (CATEGORY-MIX BUDGET, the
    // HIGH-LEVERAGE COVERAGE RULE, DOUBLES-CAP, etc.). At minimum we
    // require ≥4 self-check annotations across the add-to-10 block —
    // matching the with-regroup template (PR #314) and Dave's audit §5.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // Isolate the add-to-10 block so we don't accidentally count
    // self-check tags from sibling tiers (sub-to-10, with-regroup,
    // add-to-20 all carry their own self-checks).
    const addToTenStart = systemText.indexOf('- add-to-10:')
    const addToTwentyStart = systemText.indexOf('- add-to-20:')
    expect(addToTenStart).toBeGreaterThan(-1)
    expect(addToTwentyStart).toBeGreaterThan(addToTenStart)
    const block = systemText.slice(addToTenStart, addToTwentyStart)
    const selfCheckMatches = block.match(/<self-check>/g) ?? []
    expect(selfCheckMatches.length).toBeGreaterThanOrEqual(4)
    // <rule band="hard"> annotations on the load-bearing rules.
    const ruleBandMatches = block.match(/<rule band="hard">/g) ?? []
    expect(ruleBandMatches.length).toBeGreaterThanOrEqual(4)
  })

  it('carries a WORKED EXAMPLE block showing a clean 8-problem session (Pattern 6 second half)', async () => {
    // The worked example grounds Haiku on the target distribution.
    // Mirrors add-to-20 at _planner.ts:1034 + with-regroup at :1393.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('WORKED EXAMPLE')
    // The worked example must show inline [BAND/category] tags per fact
    // (the strong shape per [[feedback_haiku_directive_sharpening]]
    // Pattern 1).
    expect(systemText).toMatch(/P1=\d\+\d \[EASY\/[a-z-]+\]/)
    expect(systemText).toMatch(/P8=\d\+\d \[HARD\/[a-z-]+\]/)
    // The example must explicitly call out per-category counts so Haiku
    // can verify against the cap budget.
    expect(systemText).toMatch(/Counts:\s+plus-one=/)
    expect(systemText).toContain('doubles=2 (AT CAP)')
    expect(systemText).toContain('sums-to-10=2 (AT CAP)')
  })

  it('names the 44-fact canonical pool with band groupings (drift-guard)', async () => {
    // Pin every pool fact (sampled) appears in the prompt. Drift-guards
    // the pool — a "let me trim this list" edit fails on the first
    // missing entry. Sample representative facts from each band +
    // category.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // Pool size header.
    expect(systemText).toContain('FACT POOL (44 facts')
    // EASY-band facts (the gentle-ramp pool, 9 facts).
    for (const fact of [
      '1+2',
      '2+1',
      '1+3',
      '3+1',
      '1+4',
      '4+1',
      '2+2',
      '2+3',
      '3+2',
    ]) {
      expect(systemText).toContain(fact)
    }
    // HARD-band sums-to-10 (the highest-leverage category, 9 facts).
    for (const fact of [
      '1+9',
      '9+1',
      '2+8',
      '8+2',
      '3+7',
      '7+3',
      '4+6',
      '6+4',
      '5+5',
    ]) {
      expect(systemText).toContain(fact)
    }
    // Band labels (every fact carries a band binding either inline in
    // the WORKED EXAMPLE or under the band header in the FACT POOL).
    expect(systemText).toContain('EASY band (sum 3-5')
    expect(systemText).toContain('MEDIUM band (sum 6-8')
    expect(systemText).toContain('HARD band (sum 9-10')
  })

  it('preserves the HIGH-LEVERAGE COVERAGE RULE (≥1 sums-to-10 in P4-P8)', async () => {
    // The make-10 anchor is the single most important add-to-10
    // pedagogical commitment (Dave audit §2 + spec §2.4). Lock the
    // load-bearing language even though the sharpening reordered the
    // rule numbers.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('HIGH-LEVERAGE COVERAGE RULE')
    expect(systemText).toContain('at least one sums-to-10 fact')
    expect(systemText).toContain('MUST appear somewhere in problems 4-8')
  })

  it('the add-to-10 prompt is byte-stable across calls (cache prefix invariant)', async () => {
    // Same shape pin as sub-to-10 / add-to-20 / with-regroup: the
    // sharpening MUST NOT introduce any per-call variability that would
    // break Anthropic's prompt cache and inflate per-session cost.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      recentSuccessRate: 0.5,
    })
    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })
})

// ── sub-to-10 prompt directive (Kyle's spec §4.1 + Dave's research) ─────

describe('generateSessionPlan — sub-to-10 prompt content (Kyle spec §4.1, Dave research §Q4)', () => {
  // Pins the load-bearing phrases of the sub-to-10 directive — the
  // first MATH content tier spec since add-to-20. Mirrors the
  // add-to-20 pin shape: any "let me simplify the prompt" edit that
  // drops one of these breaks CI.

  const STUB_RESPONSE = JSON.stringify({
    id: 'haiku-sub-to-10',
    label: 'a',
    utterances: [
      {
        id: 'math.p1.read',
        text: 'Seven minus three. How many are left?',
      },
    ],
  })

  it('the sub-to-10 menu line uses the "How many are left?" read template (Dave §Q2)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // The "are left" framing follows Dave § Q2 — concrete-removal mental
    // model, distinct from add-to-10's "How many?" template.
    expect(systemText).toContain('How many are left?')
    expect(systemText).toContain('Seven minus three. How many are left?')
  })

  it('the sub-to-10 menu line ships the first-session "take away" variant (Kyle spec §4.3)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('take away')
    expect(systemText).toContain("lifetimeFirstEncounters['sub-to-10']")
  })

  it('the sub-to-10 menu line scopes the read-line template choice to the WHOLE session (not per-problem)', async () => {
    // Sharpening post-PR-240 — Haiku-3 violation was per-problem template
    // drift. The directive now frames the choice as session-level + bans
    // mixing templates within a session.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('SESSION-LEVEL TEMPLATE CHOICE')
    expect(systemText).toContain(
      'USE THE CHOSEN TEMPLATE ACROSS ALL 8 PROBLEMS',
    )
    expect(systemText).toContain(
      'DO NOT mix "take away" and "minus" within a single session',
    )
  })

  it('the sub-to-10 menu line names the 22-fact canonical pool (Dave §"Concrete fact ordering"; post-PR #249 MEDIUM + PR #252 HARD/general amendments)', async () => {
    // Pin every pool fact's a-b=c notation appears literally in the
    // prompt. This drift-guards the pool — a "let me trim this list"
    // edit fails on the first missing entry. Post-2026-05-16 amendments:
    //   PR #249: +4 MEDIUM facts (8-1, 7-1, 8-2, 6-2) for in-range
    //            wrong-op coverage.
    //   PR #252: +2 HARD/general facts (7-3, 6-4) for makes-ten lure.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    for (const fact of [
      // EASY (8): rules + doubles + subtract-one
      '5-5=0',
      '8-8=0',
      '7-0=7',
      '9-0=9',
      '10-5=5',
      '8-4=4',
      '6-3=3',
      '9-1=8',
      // MEDIUM (8): subtract-one ×3, subtract-two ×3, take-from-10 ×2
      '10-1=9',
      '8-1=7', // ← added PR #249
      '7-1=6', // ← added PR #249
      '10-2=8',
      '8-2=6', // ← added PR #249
      '6-2=4', // ← added PR #249
      '10-3=7',
      '10-7=3',
      // HARD (6): general
      '9-4=5',
      '8-3=5',
      '7-4=3',
      '9-6=3',
      '7-3=4', // ← added PR #252
      '6-4=2', // ← added PR #252
    ]) {
      expect(systemText).toContain(fact)
    }
  })

  it('the sub-to-10 menu line names the band structure (Dave §"Concrete fact ordering")', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // The three bands are the spine of the sequencing.
    // Each fact carries an inline [BAND/category] tag in the FACT POOL so
    // Haiku doesn't lose the band binding when composing the 8-problem
    // sequence (sharpening per PR #240 follow-up — Haiku-3 violations).
    expect(systemText).toContain('[EASY/')
    expect(systemText).toContain('[MEDIUM/')
    expect(systemText).toContain('[HARD/')
    // Subcategory names (Dave's research §"Concrete fact ordering").
    expect(systemText).toContain('subtract-self')
    expect(systemText).toContain('subtract-zero')
    expect(systemText).toContain('doubles')
    expect(systemText).toContain('take-from-10')
  })

  it('the sub-to-10 menu line enforces the DUAL-EXPOSURE rule (never pair −fact with its + inverse)', async () => {
    // Dave §Q3 / Risks — the inverse-principle interference rule.
    // Kyle's spec §7. Lock the load-bearing phrasing.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('DUAL-EXPOSURE RULE')
    expect(systemText).toContain(
      'never pair a subtraction fact and its addition inverse',
    )
  })

  it('the sub-to-10 directive does NOT instruct Haiku to emit distractorClass — distractor selection is render-time derived (planner wire is utterance-only)', async () => {
    // Drift-guard: the wire shape is utterance-only and cannot carry
    // a per-problem `distractorClass` tag. Distractor selection lives
    // entirely in `src/screens/Math/Math.tsx`'s deterministic default
    // (every P4-P8 op:"-" problem attempts 'wrong-op'; pickDistractors
    // silently downgrades to off-by-one when the trap is OOR or aliases
    // the correct answer). A future Haiku-tuning pass that re-adds a
    // "tag each problem with distractorClass" line would re-introduce
    // ignored wire emissions (Haiku-3 NOFs from PR #240 + PR #241) —
    // this test locks the reword.
    //
    // 2026-05-16: tightened from a bare `not.toContain('distractorClass')`
    // to instruction-shaped checks. Thomas's Option A amendment
    // (ClickUp 86c9upc98) added explanatory prose to the directive that
    // names `distractorClass` while making it explicit that the field
    // is a RENDER-TIME default, NOT a Haiku-emitted wire field. The
    // bare string-ban was over-broad for the actual regression class
    // (Haiku-instruction phrasing); the negative anchors below target
    // the failure mode directly.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).not.toContain('DISTRACTOR-CLASS HINT')
    expect(systemText).not.toMatch(/emit\s+distractorClass/i)
    expect(systemText).not.toMatch(
      /tag\s+each\s+problem\s+with\s+distractorClass/i,
    )
    expect(systemText).not.toMatch(/set\s+distractorClass\s+(to|on)/i)
    expect(systemText).not.toMatch(/include\s+distractorClass/i)
    // The directive MAY mention distractorClass as render-time
    // explanation; if it does, it MUST also carry the "render-time"
    // qualifier so the framing stays unambiguous.
    if (systemText.includes('distractorClass')) {
      expect(systemText).toMatch(/distractorClass[^.]*RENDER-TIME/i)
    }
  })

  it('the sub-to-10 directive carries a DOUBLES-CAP SELF-CHECK (mirrors GENERAL-CATEGORY CAP pattern; doubles-halving cap=1)', async () => {
    // Devon REQUEST_CHANGES on PR #244: positively-worded "at most 1
    // doubles fact per session" inline pool tags were silently violated
    // in two consecutive bakes (P2=6-3 + P3=10-5, then P2=6-3 + P3=10-5
    // again on re-bake). The pattern from `feedback_haiku_directive_sharpening`
    // (negative anchors over positive quantifiers + explicit self-check
    // blocks) demands a structurally parallel negative-anchored block.
    // This test locks the block in place so a future cleanup doesn't
    // silently strip it and re-introduce the failure mode.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('DOUBLES-CAP SELF-CHECK')
    expect(systemText).toContain('AT MOST ONE')
    expect(systemText).toContain('[EASY/doubles-halving]')
    // The three doubles facts are the pool; the negative anchor names
    // every forbidden pair explicitly.
    expect(systemText).toContain('{10-5, 8-4, 6-3}')
    expect(systemText).toContain('FORBIDDEN to place 10-5 AND 8-4')
    expect(systemText).toContain('FORBIDDEN to place 10-5 AND 6-3')
    expect(systemText).toContain('FORBIDDEN to place 8-4 AND 6-3')
  })

  it('the sub-to-10 menu line requires at least one take-from-10 fact in P4-P8 (Dave §"session design rules" #2)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toMatch(/at least one take-from-10 fact/i)
    // The MUST is load-bearing — high-leverage pedagogy per Dave's
    // research, anchors the make-10 mental model add-to-20 will use.
    expect(systemText).toContain('MUST appear somewhere in problems 4-8')
  })

  it('the sub-to-10 menu line specifies the gentle ramp (P1-P3 from easy band only)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toMatch(/Problems 1-3 \(gentle ramp\)/)
    // Wording sharpened post-PR-240 (band-binding inlined per fact) — the
    // semantic invariant is "P1-P3 are EASY-band only".
    expect(systemText).toContain('EXCLUSIVELY EASY-band facts')
    // Negative-anchor block paired with the positive directive — explicit
    // placement bans for HARD-band facts at P1-P3 (sharpening rationale).
    expect(systemText).toContain('NEGATIVE ANCHOR')
    // Post-PR #252: the HARD-band ban list grew from 4 to 6 facts
    // (7-3, 6-4 added). The "DO NOT place ..." line lists every
    // HARD-band fact by id; assert all six are named.
    expect(systemText).toContain(
      'DO NOT place 8-3, 9-4, 7-4, 9-6, 7-3, or 6-4 at P1, P2, or P3',
    )
  })

  it('the sub-to-10 menu line emits op:"-" on every problem (wire-shape contract per Kyle spec §5)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    expect(systemText).toContain('every problem MUST emit op: "-"')
  })

  it('the sub-to-10 menu line includes the per-slot utterance templates including correct=0 form', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const systemText = args.system.map((b) => b.text).join('\n')
    // Each slot's example carries the "are left" / "Take away" form.
    expect(systemText).toContain('"Yes! <answer>!"')
    expect(systemText).toContain('"Hmm... try again?"')
    // Wave 12 (ticket 86ca8702v) split the single sub-to-10 hint into the
    // hint1/hint2/hint3 triple; the "Take away" scaffold framing now lives
    // in hint3. Pin the three sub-step examples.
    expect(systemText).toContain(
      'hint1 (attention-direction): "Look at the flowers."',
    )
    expect(systemText).toContain(
      'hint2 (quantity-A): "<minuend> flowers." e.g. "Ten flowers."',
    )
    expect(systemText).toContain(
      'hint3 (take away + question): "Take away <subtrahend>. How many now?" e.g. "Take away two. How many now?"',
    )
    // correct=0 forms — Emma must spell "zero" in both correct and
    // giveAnswer slots.
    expect(systemText).toContain('"Yes! Zero!"')
    expect(systemText).toContain('"This one is zero."')
  })

  it('the sub-to-10 prompt is byte-stable across calls (cache prefix invariant)', async () => {
    // Same shape pin as add-to-10 / add-to-20: the system prompt MUST
    // NOT change between successive sub-to-10 calls, else Anthropic's
    // prompt caching breaks and per-session cost jumps.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
    })
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
      recentSuccessRate: 0.5,
    })
    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('slow-fact directive scope now includes sub-to-10 (Kyle spec §8 + Thomas 2026-05-15 lock)', async () => {
    // The directive injects on math + add-to-10 OR sub-to-10 when
    // slowFacts is non-empty. Pin that sub-to-10 with non-empty
    // slowFacts triggers the directive.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
      slowFacts: [
        {
          fact: { a: 10, b: 2, op: '-' },
          attempts: 7,
          correctRate: 1,
          medianLatencyMs: 6500,
        },
      ],
    })
    const args = capture.lastArgs as {
      messages: Array<{ content: string }>
    }
    const user = args.messages[0]!.content
    expect(user).toContain('SLOW-FACT')
    expect(user).toContain('10-2')
  })

  it('the sub-to-10 user message names the focus node and preserves the shape', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-10',
      recentSuccessRate: 0.85,
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: sub-to-10\./)
    expect(user).toContain('Marian')
    expect(user).toContain('0.85')
  })
})

// ── sub-to-20 prompt directive (Kyle's spec §1.1/§4.1 + Dave PR #327) ───

describe('generateSessionPlan — sub-to-20 prompt content (Kyle spec §1.1/§4.1, Dave PR #327 audit follow-ups a+b, W10.4)', () => {
  // Directive-side defense-in-depth for the sub-to-20 tier. Mirrors the
  // sub-to-10 distractorClass drift-guard suite above (and the broader
  // add-to-20 / sub-to-10 pin shape): any "let me simplify the prompt"
  // edit that drops a load-bearing rule, pool fact, annotation, or
  // negative anchor breaks CI here — BEFORE a re-bake could silently
  // ship an inside-bounds-but-wrong canon. Per `planner-and-canon.md`
  // § "Wire shape is utterance-only — invariant": these assertions pin
  // the DIRECTIVE TEXT (`systemText`), not Haiku's emitted plan; the
  // baked-canon composition rules are mechanically enforced by the
  // sub-to-20 compositionLint binding (`scripts/compositionLint.ts`
  // SUB_TO_TWENTY_RULES + lintSubToTwentyComposition + resolveTierBinding).
  // This suite is the missing planner-test coverage Dave PR #327 § 4
  // risk-register flagged ("no planner-test sub-to-20 coverage", MEDIUM).
  //
  // NO RE-BAKE: this ticket (W10.4) adds test coverage + a one-line
  // directive drift-guard tag only — zero canon bytes touched (Dave
  // PR #327 verdict "do NOT re-bake; close audit").

  const STUB_RESPONSE = JSON.stringify({
    id: 'haiku-sub-to-20',
    label: 'a',
    utterances: [
      {
        id: 'math.p1.read',
        text: 'Seventeen minus five. How many are left?',
      },
    ],
  })

  // Helper: capture the joined system-prompt text for a sub-to-20 call.
  async function captureSubToTwentySystemText(): Promise<string> {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-20',
    })
    const args = capture.lastArgs as { system: Array<{ text: string }> }
    return args.system.map((b) => b.text).join('\n')
  }

  // Slice `systemText` to the sub-to-20 directive block so block-scoped
  // assertions don't leak into a sibling tier's directive. The block
  // runs from the `- sub-to-20:` header to the next tier header
  // (`- two-digit-addsub-no-regroup:`). Per `planner-and-canon.md`
  // § "Block-scoped count assertions must slice systemText to the tier's
  // directive block (Kevin NOF #4 on PR #330)".
  function sliceSubToTwentyBlock(systemText: string): string {
    const start = systemText.indexOf('- sub-to-20:')
    expect(start, 'sub-to-20 directive header not found').toBeGreaterThan(-1)
    const next = systemText.indexOf('- two-digit-addsub-no-regroup:', start)
    expect(
      next,
      'next-tier header (two-digit-addsub-no-regroup) not found after sub-to-20',
    ).toBeGreaterThan(start)
    return systemText.slice(start, next)
  }

  it('AC1 — the sub-to-20 read-line uses the "minus … How many are left?" template (Kyle §4.1/§4.2)', async () => {
    // The directive's read-line example + per-slot template both carry the
    // "minus" + "How many are left?" shape. The browser parser
    // (planFromServer.ts) rejects any other shape into silent static, so
    // this is the load-bearing read-line contract.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('minus')
    expect(block).toContain('How many are left?')
    expect(block).toContain(
      '"<minuend> minus <subtrahend>. How many are left?"',
    )
    expect(block).toContain('Seventeen minus five. How many are left?')
  })

  it('AC2 — the sub-to-20 directive bans "take away" in the READ-LINE (READ-LINE NEGATIVE ANCHOR)', async () => {
    // The directive INTENTIONALLY uses "take away" in the HINT scaffold
    // (concrete-removal mental model) — so a blanket "no take away" ban is
    // wrong. The drift this AC guards against is "take away" leaking into
    // the read-line. The directive locks this with a READ-LINE NEGATIVE
    // ANCHOR (§4.1 directive note + design/math/sub-to-20-content.md §4.3).
    // Pinning that anchor's phrasing is the directive-side lock that keeps
    // a future re-bake from emitting "Eleven take away one. How many are
    // left?" as a read-line.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('READ-LINE NEGATIVE ANCHOR')
    expect(block).toContain('the read-line MUST use the word "minus" verbatim')
    expect(block).toContain('DO NOT substitute "take away" here')
    // The "take away" string DOES appear in the block — but only in the
    // hint scaffold, never as the read-line template. Confirm the hint
    // carries it (so we're guarding the right surface, not a typo). Wave 12
    // (ticket 86ca8702v) split the single hint into hint1/hint2/hint3; the
    // "take away" framing now lives in hint3.
    expect(block).toContain(
      'hint3 (take away + question): "Take away <subtrahend>. How many now?"',
    )
  })

  it('AC3 — every (a, b) pair in the directive FACT POOL is one of the 22 SUB_TO_TWENTY_POOL facts', async () => {
    // Pin every pool fact's a-b=c notation appears literally in the
    // prompt — drift-guards the 22-fact pool. A "let me trim this list"
    // edit fails on the first missing entry. The 22 facts below are the
    // EXACT pool from design/math/sub-to-20-content.md §1.1 (LOCKED) and
    // SUB_TO_TWENTY_POOL in scripts/compositionLint.ts.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    const POOL_22 = [
      // EASY (6)
      '11-1=10',
      '12-2=10',
      '13-3=10',
      '12-1=11',
      '13-2=11',
      '13-1=12',
      // MEDIUM (10)
      '14-4=10',
      '14-3=11',
      '14-2=12',
      '15-5=10',
      '15-4=11',
      '15-3=12',
      '15-2=13',
      '16-6=10',
      '16-5=11',
      '16-4=12',
      // HARD (6)
      '17-7=10',
      '17-5=12',
      '18-8=10',
      '18-6=12',
      '19-9=10',
      '19-7=12',
    ] as const
    expect(POOL_22).toHaveLength(22)
    for (const fact of POOL_22) {
      expect(block, `pool fact ${fact} missing from directive`).toContain(fact)
    }
  })

  it('AC4a — the directive requires >=1 take-to-decade fact in P4-P8 (Dave §4.2 high-leverage anchors)', async () => {
    // The take-to-decade facts (results land exactly on the decade) are
    // the highest-leverage facts; Dave §4.2 names them by name. The
    // directive's rule 4 makes >=1 in P4-P8 a hard requirement.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toMatch(/at least one take-to-decade fact MUST appear/i)
    expect(block).toContain('MUST appear in P4-P8')
    // The take-to-decade pool is named explicitly so Haiku can satisfy
    // the rule without inventing.
    expect(block).toContain('14-4, 15-5, 16-6, 17-7, 18-8, 19-9')
  })

  it('AC4b — the directive requires >=2 CLEAN Class-B facts available across P4-P8 (DISTRACTOR-COVERAGE SELF-CHECK)', async () => {
    // The Class B (decade-anchor miss) distractor is the sub-to-20-specific
    // error mode (no sub-to-10 analog). Without a >=2 CLEAN minimum, the
    // renderer can silently downgrade every P4-P8 Class B attempt to
    // off-by-one when traps alias/degenerate — leaving the new class dead
    // at render time. The directive biases selection toward CLEAN facts.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('DISTRACTOR-COVERAGE SELF-CHECK')
    expect(block).toMatch(/>=\s*2 in-range Class B traps across P4-P8/i)
    // The CLEAN-annotated facts are enumerated so the bias is actionable.
    expect(block).toContain(
      'CLEAN-annotated MEDIUM facts: 14-2, 15-3, 15-2, 16-4',
    )
    expect(block).toContain(
      'CLEAN-annotated HARD/general facts: 17-5, 18-6, 19-7',
    )
    // NEGATIVE ANCHOR: forbidding an all-ALIAS/BOUNDARY P4-P8 set when
    // CLEAN facts remain available is the structural lock.
    expect(block).toContain(
      'it is FORBIDDEN to fill P4-P8 entirely with ALIAS- or BOUNDARY-annotated facts',
    )
  })

  it('AC5 — the directive carries the [BAND/category] + DEC= per-fact annotations', async () => {
    // Each pool fact is inline-tagged with its band, category, and DEC
    // (decade-anchor-miss trap value) so Haiku keeps the band/category
    // binding while composing the 8-problem sequence and so the
    // CLEAN/ALIAS/BOUNDARY status is legible. Stripping these annotations
    // silently weakens cap + Class-B awareness (the annotation-style-switch
    // load-bearing trap, `planner-and-canon.md` § "Annotation-style
    // switches must audit which old annotations were structurally
    // load-bearing on Haiku attention").
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    // Band tags.
    expect(block).toContain('[EASY/')
    expect(block).toContain('[MEDIUM/')
    expect(block).toContain('[HARD/')
    // DEC= annotation + its three status words.
    expect(block).toContain('DEC=10')
    expect(block).toContain('ALIAS')
    expect(block).toContain('BOUNDARY')
    expect(block).toContain('CLEAN')
    // Representative inline-annotated pool lines (band + category + DEC
    // status on one fact each).
    expect(block).toContain('[EASY/subtract-one]')
    expect(block).toContain('[MEDIUM/take-to-decade]')
    expect(block).toContain('[HARD/general]')
    expect(block).toContain('[EASY/doubles-anchor]')
  })

  it('AC6 — the sub-to-20 directive does NOT instruct Haiku to emit distractorClass (wire is utterance-only)', async () => {
    // Sibling of the sub-to-10 distractorClass drift-guard at the top of
    // this file (mirrors _planner.test.ts sub-to-10 suite). The wire shape
    // is utterance-only and cannot carry a per-problem `distractorClass`
    // tag — distractor selection (incl. the Class B decade-anchor trap)
    // lives entirely in src/screens/Math/Math.tsx's render-time default.
    // A future Haiku-tuning pass that re-adds a "tag each problem with
    // distractorClass" line would re-introduce ignored wire emissions
    // (the exact Haiku-3 NOF class from PR #240/#241). The negative anchors
    // below target the Haiku-instruction phrasing directly (per
    // `planner-and-canon.md` § "Drift-guard shape for these locks" —
    // name-shaped bans need instruction-anchored regex).
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).not.toContain('DISTRACTOR-CLASS HINT')
    expect(block).not.toMatch(/emit\s+distractorClass/i)
    expect(block).not.toMatch(/tag\s+each\s+problem\s+with\s+distractorClass/i)
    expect(block).not.toMatch(/set\s+distractorClass\s+(to|on)/i)
    expect(block).not.toMatch(/include\s+distractorClass/i)
    // The directive MAY mention distractorClass as render-time
    // explanation; if it does, it MUST also carry the "RENDER-TIME"
    // qualifier (MAY-mention-MUST-qualify pattern). Same-sentence
    // proximity is enforced by `[^.]*`.
    if (block.includes('distractorClass')) {
      expect(block).toMatch(/distractorClass[^.]*RENDER-TIME/i)
    }
  })

  it('AC7 — the sub-to-20 block head carries the Pattern 7 triple-pin <drift-guard> tag', async () => {
    // The triple-pin tag links the directive block to its SPEC §1.1 and
    // the three compositionLint binding sites (RULES + lint fn + path
    // BINDING). It is the Pattern 7 (per-tier drift-guard tag) annotation
    // from `feedback_haiku_directive_sharpening` — the cheap, greppable
    // anchor that makes the directive ↔ spec ↔ lint coupling explicit for
    // any future editor. Mirrors the add-to-10 / two-digit-addsub-with-
    // regroup tags already present in MATH_TRACK_GUIDE.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('<drift-guard')
    expect(block).toContain('RULE_IDENTITY=sub-to-20')
    expect(block).toContain('SPEC=design/math/sub-to-20-content.md§1.1')
    expect(block).toContain('scripts/compositionLint.ts')
  })

  it('the sub-to-20 NO-BORROW SELF-CHECK + POOL-MEMBERSHIP SELF-CHECK are present (defense-in-depth against borrow-fact drift)', async () => {
    // Borrow facts (ones-digit(minuend) < subtrahend) are the hard
    // pedagogical line (Dave §4.5). The directive's two self-checks are
    // the directive-side defense-in-depth that keeps a re-bake from
    // hallucinating a borrow fact off the skeleton.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('NO-BORROW SELF-CHECK')
    expect(block).toContain('ones-digit(a) >= b')
    expect(block).toContain('POOL-MEMBERSHIP SELF-CHECK')
    expect(block).toContain('22 listed pairs are the ONLY allowed facts')
  })

  it('the sub-to-20 directive enforces the DUAL-EXPOSURE rule + category caps', async () => {
    // Dual-exposure (never pair a − fact with its + inverse) is
    // forward-compat scaffolding for mixed +/- sessions; category caps
    // keep the 8-problem set from monotony. Both are load-bearing
    // composition rules the compositionLint binding also enforces at bake.
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('DUAL-EXPOSURE RULE')
    expect(block).toContain(
      'never pair a subtraction fact and its addition inverse',
    )
    expect(block).toContain('Category caps')
    expect(block).toContain('CATEGORY-CAP SELF-CHECK')
  })

  it('the sub-to-20 directive emits op:"-" on every problem (wire-shape contract)', async () => {
    const block = sliceSubToTwentyBlock(await captureSubToTwentySystemText())
    expect(block).toContain('every problem MUST emit op: "-"')
  })

  it('the sub-to-20 prompt is byte-stable across calls (cache prefix invariant)', async () => {
    // Same shape pin as add-to-10 / sub-to-10: the system prompt MUST NOT
    // change between successive sub-to-20 calls, else Anthropic's prompt
    // caching breaks and per-session cost jumps.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-20',
    })
    await generateSessionPlan({
      client: makeMockClient(STUB_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-20',
      recentSuccessRate: 0.5,
    })
    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('the sub-to-20 user message names the focus node and preserves the shape', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(STUB_RESPONSE, { capture })
    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'sub-to-20',
      recentSuccessRate: 0.85,
    })
    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toMatch(/Focus skill node: sub-to-20\./)
    expect(user).toContain('Marian')
    expect(user).toContain('0.85')
  })
})

/**
 * M4.x slow-fact directive tests (follow-up to ticket 86c9pwgc8).
 *
 * The slow-fact directive sits in the user message (volatile per
 * call) — same posture as the Leitner directive. Active only on
 * math + add-to-10 with a non-empty array; ignored otherwise.
 */
describe('generateSessionPlan — slow-fact directive (M4.x)', () => {
  const MATH_PLAN_RESPONSE = JSON.stringify({
    id: 'haiku-math-slow',
    label: 'slow-fact-weighted',
    utterances: [
      { id: 'math.p1.read', text: 'Four plus two. How many?' },
      { id: 'math.p1.correct', text: 'Yes! Six!' },
      { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'math.p1.hint', text: 'Look. Four. And two more. How many now?' },
      { id: 'math.p1.giveAnswer', text: 'This one is six.' },
    ],
  })

  it('places the SLOW-FACT DIRECTIVE in the user message when slowFacts is non-empty (math+add-to-10)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      slowFacts: [
        {
          fact: { a: 4, b: 2, op: '+' },
          attempts: 7,
          correctRate: 1,
          medianLatencyMs: 6200,
        },
        {
          fact: { a: 7, b: 1, op: '+' },
          attempts: 5,
          correctRate: 0.8,
          medianLatencyMs: 5400,
        },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    expect(user).toContain('SLOW-FACT DIRECTIVE')
    // Bullet copy includes the per-fact stats verbatim.
    expect(user).toContain(
      '- 4+2 — answers ~6.2s; over 7 attempts, 100% correct.',
    )
    expect(user).toContain(
      '- 7+1 — answers ~5.4s; over 5 attempts, 80% correct.',
    )
    // Actionable rule — pin presence so a future copy edit fails this
    // test if it drops the dosing rule.
    expect(user).toMatch(/Include 1 to 2 facts/i)
    // The "not stumbles" guidance is the load-bearing distinction
    // from Leitner — pin it so a future merge of the two directives
    // doesn't lose this nuance.
    expect(user).toMatch(/correct[- ]but[- ]slow/i)
  })

  it('omits the directive when slowFacts is undefined (default, back-compat)', async () => {
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      // slowFacts omitted
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('SLOW-FACT DIRECTIVE')
    expect(args.messages[0]!.content).not.toContain('Practice list')
  })

  it('omits the directive when slowFacts is empty', async () => {
    // The browser is supposed to omit the field entirely on the wire
    // when the predicate finds no qualifying facts; the planner
    // defends in depth.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      slowFacts: [],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('SLOW-FACT DIRECTIVE')
  })

  it('ignores the directive on the word-song track (slow-facts is math-only today)', async () => {
    const WORD_RESPONSE = JSON.stringify({
      id: 'haiku-word-001',
      label: 'word session',
      utterances: [
        { id: 'word.p1.read', text: 'Tap the cat.' },
        { id: 'word.p1.correct', text: 'Yes! Cat.' },
        { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
        { id: 'word.p1.hint', text: "Let's look. Cat." },
        { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
      ],
    })
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'blending-cv',
      // Misrouted slowFacts — should be silently ignored.
      slowFacts: [
        {
          fact: { a: 4, b: 2, op: '+' },
          attempts: 5,
          correctRate: 1,
          medianLatencyMs: 6000,
        },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('SLOW-FACT DIRECTIVE')
  })

  it('ignores the directive on math focus nodes other than add-to-10', async () => {
    // Defense-in-depth: slow-fact directive is currently add-to-10-
    // only because that's the only Leitner-bearing tier Marian is
    // touching today. A misrouted slowFacts array on add-to-20 must
    // not leak the directive.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
      slowFacts: [
        {
          fact: { a: 8, b: 5, op: '+' },
          attempts: 5,
          correctRate: 1,
          medianLatencyMs: 6000,
        },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    expect(args.messages[0]!.content).not.toContain('SLOW-FACT DIRECTIVE')
  })

  it('a slow-fact-active call shares the SAME system prompt as a slow-fact-off call (cache invariant)', async () => {
    // Pin: the slowFacts field is user-message-only. Two calls that
    // differ only in `slowFacts` MUST produce byte-identical system
    // text so prompt-cache hits stay maximal.
    const cap1: { lastArgs?: unknown } = {}
    const cap2: { lastArgs?: unknown } = {}

    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap1 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    await generateSessionPlan({
      client: makeMockClient(MATH_PLAN_RESPONSE, { capture: cap2 }),
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      slowFacts: [
        {
          fact: { a: 4, b: 2, op: '+' },
          attempts: 5,
          correctRate: 1,
          medianLatencyMs: 6000,
        },
      ],
    })

    const sys1 = (cap1.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    const sys2 = (cap2.lastArgs as { system: Array<{ text: string }> }).system
      .map((b) => b.text)
      .join('\n')
    expect(sys1).toBe(sys2)
  })

  it('formats latency as one-decimal seconds, correctRate as integer percent', async () => {
    // Pin the bullet-line shape Haiku reads. A regression that
    // emitted `6200ms` (raw) or `1.0` (correctRate as float) would
    // produce noisier directive copy and could confuse Haiku's
    // selection heuristic.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(MATH_PLAN_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
      slowFacts: [
        {
          fact: { a: 3, b: 5, op: '+' },
          attempts: 6,
          correctRate: 0.8333,
          medianLatencyMs: 5750,
        },
      ],
    })

    const args = capture.lastArgs as { messages: Array<{ content: string }> }
    const user = args.messages[0]!.content
    // 5750ms → ~5.8s (toFixed(1) rounds half-to-even on most engines
    // but consistently to 5.8 for 5750/1000 = 5.75 → 5.8).
    expect(user).toContain(
      '- 3+5 — answers ~5.8s; over 6 attempts, 83% correct.',
    )
  })
})

/**
 * Drift-guard tests for the celebration-prosody fix (ticket 86c9qkf2w,
 * Option A1 from Devon's audit). The word-song correct-slot template
 * changed from "Yes! <Word>." to "Yes! That's a <word>." with a
 * per-word exception list for relational/mass nouns (mom, dad, jam)
 * that cannot take an indefinite article.
 *
 * Rationale documented in:
 *   - design/audio-celebration-prosody-audit-2026-05-10.md
 *   - .claude/docs/planner-and-canon.md §"Template-structural prosody clip"
 *
 * Per `feedback_count_assertions_on_regression_tests.md`: the prompt
 * assertions below use count-based or equality forms — never `.toContain`
 * alone for the template literal itself (we check exact occurrence count
 * of the default template and exact membership of the exception list).
 */
describe('celebration-prosody fix — word-song correct-slot template (ticket 86c9qkf2w)', () => {
  /** Minimal valid word-song wire response. */
  const VALID_WORD_RESPONSE = JSON.stringify({
    id: 'prosody-test',
    label: 'prosody test',
    utterances: [
      { id: 'word.p1.read', text: 'Read the cat.' },
      { id: 'word.p1.correct', text: "Yes! That's a cat." },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Cat." },
      { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
    ],
  })

  it('system prompt carries the new article-led correct template', async () => {
    // Pin the exact template string so future planner refactors that
    // revert to "Yes! <Word>." are caught at vitest time, not at
    // Thomas's ear-test time.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')

    // Default template — pin the exact directive header line that
    // defines the correct slot's default template. The string also
    // appears once in the surrounding prose (where the directive
    // refers back to itself); we anchor on the "default template is"
    // phrasing so this test catches drift in the canonical
    // definition without false-matching the prose callout.
    const defaultTemplateMatches = (
      prompt.match(/default template is "Yes! That's a <word>\."/g) ?? []
    ).length
    expect(defaultTemplateMatches).toEqual(1)

    // Exception fallback template — anchor on the "fall back to"
    // phrasing so the test pins the directive line, not a prose
    // mention of the same string.
    const exceptionTemplateMatches = (
      prompt.match(/fall back to "Yes! <Word>!"/g) ?? []
    ).length
    expect(exceptionTemplateMatches).toEqual(1)
  })

  it('system prompt names the per-word exception list (mom, dad, jam, gum, hot, egg, thin, thick, math)', async () => {
    // Pin the exception list contents. If a word is added to or
    // removed from the list in the planner directive without updating
    // this test, the test fails — ensuring the author audits the
    // canon re-bake implications before silently expanding scope.
    //
    // The exception list covers chip words that cannot take an
    // indefinite article: mom/dad (relational), jam/gum (mass nouns),
    // hot/thin/thick (adjectives), egg (vowel-initial — "a egg" is
    // ungrammatical; ticket 86c9teua2), math (non-count domain noun).
    // The audit explicitly documented mom/dad/jam; hot was added at
    // first canon-bake when the default template produced
    // ungrammatical "That's a hot." in the short-o pool; gum was added
    // on Devon's review of PR #198 (same grammatical issue as jam —
    // mass noun in the short-u pool); egg was added alongside the
    // short-e tier (vowel-initial noun, ticket 86c9teua2); thin/thick/
    // math were added alongside the digraphs-th tier — "That's a thin."
    // / "That's a thick." / "That's a math." are all ungrammatical
    // English.
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')

    // Pin the canonical exception list line — count-based assertion
    // (per `feedback_count_assertions_on_regression_tests.md`) on the
    // exact list-naming sentence. If the list grows or shrinks, the
    // count drops to 0 and the test fails.
    // Tolerate the directive's hard line-wrap between list members
    // (`thin,\n  thick, math.`) — collapse runs of whitespace first.
    const exceptionListMatches = (
      prompt
        .replace(/\s+/g, ' ')
        .match(
          /exception list is exactly: mom, dad, jam, gum, hot, egg, thin, thick, math\./g,
        ) ?? []
    ).length
    expect(exceptionListMatches).toEqual(1)
  })

  it('system prompt does NOT contain the old bare "Yes! <Word>." correct-slot directive', async () => {
    // Regression guard: the old directive line was
    //   `- correct: "Yes! <Word>." (capitalised target) e.g. ...`
    // which triggered list-final / declarative-tag intonation on
    // Azure. If someone reverts the planner directive, this test
    // catches the headline-form drift. We anchor on the directive's
    // "- correct:" prefix so this assertion ignores prose callouts
    // (the new directive's prose intentionally cites the old form
    // when explaining why it changed).
    const capture: { lastArgs?: unknown } = {}
    const client = makeMockClient(VALID_WORD_RESPONSE, { capture })

    await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const args = capture.lastArgs as { system: Array<{ text: string }> }
    const prompt = args.system.map((b) => b.text).join('\n')

    // Count-based: the literal directive header for the OLD template
    // must not appear at all. The new directive uses
    // `- correct: default template is "Yes! That's a <word>."` so the
    // OLD `- correct: "Yes! <Word>."` pattern would be a clear revert.
    const oldDirectiveMatches = (
      prompt.match(/- correct: "Yes! <Word>\."/g) ?? []
    ).length
    expect(oldDirectiveMatches).toEqual(0)
  })
})

describe('reorderContinuantOnsetFirst — continuant-onset CVC reorder (Q1)', () => {
  // Build a CVC-tier flat plan: one problem group per word (read/correct/
  // reprompt/hint/giveAnswer/blend slots) in the given order, plus a couple of
  // session.end.* tail utterances that must stay untouched at the end.
  function makeCvcPlan(words: string[]): {
    id: string
    label: string
    utterances: { id: string; text: string }[]
  } {
    const utterances: { id: string; text: string }[] = []
    words.forEach((word, i) => {
      const p = i + 1
      const cap = word[0]!.toUpperCase() + word.slice(1)
      utterances.push(
        { id: `word.p${p}.read`, text: `Read the ${word}.` },
        { id: `word.p${p}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${p}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${p}.hint`, text: `Look. ${cap}.` },
        { id: `word.p${p}.giveAnswer`, text: `This one is ${word}.` },
        {
          id: `word.p${p}.blend`,
          text: `${word.split('').join(' - ')} ... ${word}`,
        },
      )
    })
    // Tail (non-problem) utterances — must be left exactly where they are.
    utterances.push(
      { id: 'session.end.opener', text: 'Wow! You did it!' },
      { id: 'session.end.goodbye', text: 'See you soon!' },
    )
    return { id: 'cvc-test', label: 'CVC test', utterances }
  }

  /** Read back the word order from a reordered plan (by p-index ascending). */
  function wordOrder(plan: {
    utterances: { id: string; text: string }[]
  }): string[] {
    const byIndex = new Map<number, string>()
    for (const u of plan.utterances) {
      const m = u.id.match(/^word\.p(\d+)\.read$/)
      if (!m) continue
      const word = u.text.match(/^Read the ([a-z]+)\.$/i)?.[1]
      if (word) byIndex.set(Number.parseInt(m[1]!, 10), word)
    }
    return [...byIndex.keys()].sort((a, b) => a - b).map((k) => byIndex.get(k)!)
  }

  it('the continuant/stop onset sets are disjoint and cover the CVC onset alphabet', () => {
    // Contract pin: the two classes partition the consonant onset alphabet
    // (vowels never lead a CVC word). Disjoint + complete.
    for (const g of CONTINUANT_ONSET_GRAPHEMES) {
      expect(STOP_ONSET_GRAPHEMES.has(g)).toBe(false)
    }
    const union = new Set([
      ...CONTINUANT_ONSET_GRAPHEMES,
      ...STOP_ONSET_GRAPHEMES,
    ])
    // Every single-consonant CVC onset used by the word pools (incl. the
    // glides w/y, classed as continuants).
    for (const g of 'bcdfghjklmnprstvwy') {
      expect(union.has(g)).toBe(true)
    }
  })

  it('emits continuant-onset words BEFORE stop-onset words, preserving order within each class', () => {
    // Input mixes stop + continuant onsets.
    const input = ['cat', 'man', 'bag', 'fan', 'dad', 'van', 'jam', 'hat']
    const plan = makeCvcPlan(input)
    const out = reorderContinuantOnsetFirst(plan, 'cvc-words')
    // Continuants (input order): man, fan, van, hat. Stops (input order):
    // cat, bag, dad, jam. (h is a continuant onset; j/dʒ sequences with stops.)
    expect(wordOrder(out)).toEqual([
      'man',
      'fan',
      'van',
      'hat',
      'cat',
      'bag',
      'dad',
      'jam',
    ])
  })

  it('renumbers ids and keeps each problem slot bundle intact', () => {
    const plan = makeCvcPlan(['cat', 'man']) // stop, continuant
    const out = reorderContinuantOnsetFirst(plan, 'cvc-words')
    // man (continuant) -> p1, cat (stop) -> p2.
    const p1 = out.utterances.filter((u) => u.id.startsWith('word.p1.'))
    const p2 = out.utterances.filter((u) => u.id.startsWith('word.p2.'))
    expect(p1.find((u) => u.id === 'word.p1.read')!.text).toBe('Read the man.')
    expect(p1.find((u) => u.id === 'word.p1.correct')!.text).toBe('Yes! Man.')
    expect(p1.find((u) => u.id === 'word.p1.blend')!.text).toBe(
      'm - a - n ... man',
    )
    expect(p2.find((u) => u.id === 'word.p2.read')!.text).toBe('Read the cat.')
    expect(p2.find((u) => u.id === 'word.p2.blend')!.text).toBe(
      'c - a - t ... cat',
    )
    // Every original slot survives (6 slots x 2 problems = 12 problem utterances).
    expect(out.utterances.filter((u) => /^word\.p/.test(u.id))).toHaveLength(12)
  })

  it('leaves session.end.* tail utterances untouched at the end', () => {
    const plan = makeCvcPlan(['cat', 'fan'])
    const out = reorderContinuantOnsetFirst(plan, 'cvc-words')
    const tail = out.utterances.slice(-2)
    expect(tail).toEqual([
      { id: 'session.end.opener', text: 'Wow! You did it!' },
      { id: 'session.end.goodbye', text: 'See you soon!' },
    ])
  })

  it('is a no-op (byte-identical) for an already-continuant-first session', () => {
    // man, fan (continuants) then cat, bag (stops) — already ordered.
    const plan = makeCvcPlan(['man', 'fan', 'cat', 'bag'])
    const out = reorderContinuantOnsetFirst(plan, 'cvc-words')
    expect(out.utterances).toEqual(plan.utterances)
  })

  it('fires on every CVC vowel tier', () => {
    for (const tier of [
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
    ]) {
      const plan = makeCvcPlan(['cat', 'man']) // stop, continuant
      const out = reorderContinuantOnsetFirst(plan, tier)
      expect(wordOrder(out)).toEqual(['man', 'cat'])
    }
  })

  it('passes through unchanged for a non-CVC tier (blending-cv / digraphs / letter-sounds)', () => {
    const plan = makeCvcPlan(['cat', 'man'])
    for (const tier of [
      'blending-cv',
      'digraphs-sh',
      'letter-sounds',
      'simple-sentences',
    ]) {
      expect(reorderContinuantOnsetFirst(plan, tier).utterances).toEqual(
        plan.utterances,
      )
    }
  })

  it('passes through unchanged when a read line is not the "Read the <word>." shape (defensive)', () => {
    const plan = makeCvcPlan(['cat', 'man'])
    // Corrupt p1's read into a blending-cv "Tap the" shape — the reorder can't
    // classify it, so it must NOT reshuffle.
    plan.utterances = plan.utterances.map((u) =>
      u.id === 'word.p1.read' ? { ...u, text: 'Tap the cat.' } : u,
    )
    expect(reorderContinuantOnsetFirst(plan, 'cvc-words').utterances).toEqual(
      plan.utterances,
    )
  })

  it('integrates with generateSessionPlan — a CVC-words plan is reordered post-Haiku', async () => {
    // Haiku returns a mixed-onset plan; the planner reorders it before return.
    const words = ['cat', 'fan', 'bag', 'man'] // stop, cont, stop, cont
    const utterances: { id: string; text: string }[] = []
    words.forEach((word, i) => {
      const p = i + 1
      const cap = word[0]!.toUpperCase() + word.slice(1)
      utterances.push(
        { id: `word.p${p}.read`, text: `Read the ${word}.` },
        { id: `word.p${p}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${p}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${p}.hint`, text: `Look. ${cap}.` },
        { id: `word.p${p}.giveAnswer`, text: `This one is ${word}.` },
      )
    })
    const client = makeMockClient(
      JSON.stringify({ id: 'h', label: 'l', utterances }),
    )
    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })
    const order = [...plan.utterances]
      .filter((u) => /^word\.p\d+\.read$/.test(u.id))
      .sort((a, b) => {
        const ai = Number.parseInt(a.id.match(/p(\d+)/)![1]!, 10)
        const bi = Number.parseInt(b.id.match(/p(\d+)/)![1]!, 10)
        return ai - bi
      })
      .map((u) => u.text.match(/^Read the ([a-z]+)\.$/)![1])
    // Continuants fan, man first (input order); stops cat, bag after.
    expect(order).toEqual(['fan', 'man', 'cat', 'bag'])
  })
})

describe('pinCvcRecapFocus — deterministic session.end.recap.focus pin (PR #484)', () => {
  const CANONICAL = 'You worked on reading words today!'

  // Minimal plan: one cvc-word problem + the session-end tail (recap.focus is
  // what we pin; everything else must round-trip untouched).
  function makePlan(recapFocusText: string): {
    id: string
    label: string
    utterances: { id: string; text: string }[]
  } {
    return {
      id: 'p',
      label: 'l',
      utterances: [
        { id: 'word.p1.read', text: 'Read the cat.' },
        { id: 'word.p1.correct', text: 'Yes! Cat.' },
        { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
        { id: 'word.p1.hint', text: 'Look. Cat.' },
        { id: 'word.p1.giveAnswer', text: 'This one is cat.' },
        { id: 'session.end.opener', text: 'You did it!' },
        { id: 'session.end.recap.focus', text: recapFocusText },
        { id: 'session.end.recap.1', text: 'You earned one star!' },
        { id: 'session.end.goodbye', text: 'See you soon.' },
      ],
    }
  }

  function recapFocus(plan: { utterances: { id: string; text: string }[] }) {
    return plan.utterances.find((u) => u.id === 'session.end.recap.focus')!.text
  }

  it('overwrites a drifted recap.focus on EVERY cvc-words* tier (e.g. short-u "short u words" → "reading words")', () => {
    for (const tier of [
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
    ]) {
      const plan = makePlan('You worked on short u words today!')
      const out = pinCvcRecapFocus(plan, tier)
      expect(recapFocus(out)).toBe(CANONICAL)
    }
  })

  it('is a no-op (byte-identical) when recap.focus is already canonical — the 4 correct tiers do NOT churn', () => {
    const plan = makePlan(CANONICAL)
    const out = pinCvcRecapFocus(plan, 'cvc-words-short-o')
    // Reference equality: the function returns the SAME object when no pin is
    // needed, so the canon bytes for already-correct tiers are untouched.
    expect(out).toBe(plan)
    expect(out.utterances).toEqual(plan.utterances)
  })

  it('touches ONLY recap.focus — every other utterance is byte-identical', () => {
    const plan = makePlan('You worked on short e words today!')
    const out = pinCvcRecapFocus(plan, 'cvc-words-short-e')
    for (const u of plan.utterances) {
      if (u.id === 'session.end.recap.focus') continue
      expect(out.utterances.find((x) => x.id === u.id)).toEqual(u)
    }
    // id order preserved.
    expect(out.utterances.map((u) => u.id)).toEqual(
      plan.utterances.map((u) => u.id),
    )
  })

  it('passes through unchanged for a non-cvc-words* tier (digraphs / sight-words / simple-sentences / blending-cv)', () => {
    // Even though the directive maps digraphs* + sight-words to "reading words"
    // too, the PIN is scoped to the 5 cvc-words* tiers — other tiers keep
    // whatever Haiku emitted (their own recap phrases differ, e.g.
    // simple-sentences -> "reading sentences").
    const plan = makePlan('You worked on reading sentences today!')
    for (const tier of [
      'digraphs-sh',
      'sight-words',
      'simple-sentences',
      'blending-cv',
      'letter-sounds',
    ]) {
      const out = pinCvcRecapFocus(plan, tier)
      expect(out).toBe(plan)
    }
  })

  it('integrates with generateSessionPlan — a drifted cvc-words-short-u recap.focus is pinned post-Haiku', async () => {
    const utterances: { id: string; text: string }[] = []
    for (let p = 1; p <= 2; p++) {
      const word = p === 1 ? 'sun' : 'cup'
      const cap = word[0]!.toUpperCase() + word.slice(1)
      utterances.push(
        { id: `word.p${p}.read`, text: `Read the ${word}.` },
        { id: `word.p${p}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${p}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${p}.hint`, text: `Look. ${cap}.` },
        { id: `word.p${p}.giveAnswer`, text: `This one is ${word}.` },
      )
    }
    // Haiku drifts the recap.focus to a tier-specific phrase.
    utterances.push({
      id: 'session.end.recap.focus',
      text: 'You worked on short u words today!',
    })
    const client = makeMockClient(
      JSON.stringify({ id: 'h', label: 'l', utterances }),
    )
    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })
    expect(recapFocus(plan)).toBe(CANONICAL)
  })
})
