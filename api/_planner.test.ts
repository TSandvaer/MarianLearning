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
  generateSessionPlan,
  PlannerError,
  stripMarkdownFence,
  type GenerateSessionPlanArgs,
  type PlannerAnthropicClient,
} from './_planner.js'

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
    expect(prompt).toContain('session.end.recap.1')
    expect(prompt).toContain('session.end.recap.11')
    expect(prompt).toContain('session.end.streak.3')
    expect(prompt).toContain('session.end.streak.8')
    expect(prompt).toContain('session.end.goodbye')
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

  it('omits focusNode for word-song → defaults to cvc-words', async () => {
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
    expect(args.messages[0]!.content).toContain('cvc-words')
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
