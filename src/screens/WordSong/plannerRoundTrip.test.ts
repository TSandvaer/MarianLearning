/**
 * Round-trip tests for the planner-parser contract on the word-song
 * track — step 2 (ticket 86c9kxu07).
 *
 * Step 1 (PR #132 / ticket 86c9kxp08) widened the BROWSER PARSER to
 * accept "Read the <word>." → cvc-word content alongside the existing
 * "Tap the <word>." → blending-cv. Step 2 widens the PLANNER to emit
 * either content mode based on the requested focus node. This file
 * exercises the integration: a Haiku-mocked response shaped per the
 * new system prompt routes cleanly through `generateSessionPlan` AND
 * `wordSongSessionPlanFromServer`, with the right contentType
 * discriminant on every problem.
 *
 * Strategy
 * --------
 * The Anthropic SDK is mocked (same pattern as `api/_planner.test.ts`).
 * For each test we hand-craft a wire-shape response that mirrors what
 * the new prompt instructs Haiku to emit, feed it through the planner,
 * then through the parser, and assert the per-problem contentType
 * matches the requested focus node.
 *
 * Why here (src/) and not in api/_planner.test.ts
 * -----------------------------------------------
 * api/ runs under a server-only tsconfig that doesn't drag in the
 * frontend module graph (see api/_plannerWordList.ts header comment).
 * The parser lives under src/. This file lives on the src/ side so the
 * cross-module import is one-directional (src → api), matching every
 * other src/ test that pulls api/_types or api/_planner directly.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  generateSessionPlan,
  type PlannerAnthropicClient,
} from '../../../api/_planner'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../../../api/_plannerWordList'
import { wordSongSessionPlanFromServer } from './planFromServer'
import { pickDistractors } from './wordDistractors'
import {
  defaultProgress,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  saveProgress,
  type SessionHistoryEntry,
} from '../../lib/progress'
import {
  recordProgressOnSessionEnd,
  type GraduationSessionSplit,
} from '../SessionEnd/progressHistory'
import { SAMPLE_CV_BLEND_PLAN } from './__fixtures__/sample-cv-blend-plan'
import { SAMPLE_CVC_WORD_PLAN } from './__fixtures__/sample-cvc-word-plan'

function makeMockClient(responseText: string): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: responseText }],
      })),
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

describe('planner → parser round-trip — blending-cv (step 2 ticket 86c9kxu07)', () => {
  it('a Haiku-mocked blending-cv plan parses cleanly with contentType=blending-cv on every problem', async () => {
    // The fixture mirrors what the new prompt instructs Haiku to emit
    // for `focusNode: 'blending-cv'`: 8 problems, each with a "Tap the
    // <word>." read line and `word.p<N>.<slot>` ids.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'blending-cv',
    })

    // Browser parser round-trip — the planner output must be a valid
    // input for the parser, and every problem must carry
    // contentType=blending-cv (the discriminant the parser derives from
    // the read-line template).
    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toBe('blending-cv')
      expect(problem.utterances.read).toMatch(/^Tap the [a-z]+\.$/)
    }
  })
})

describe('planner → parser round-trip — cvc-words (the August unblock — step 2 ticket 86c9kxu07)', () => {
  it('a Haiku-mocked cvc-words plan parses cleanly with contentType=cvc-word on every problem', async () => {
    // The fixture mirrors what the new prompt instructs Haiku to emit
    // for `focusNode: 'cvc-words'`: 8 problems, each with a "Read the
    // <word>." read line and `word.p<N>.<slot>` ids — wire shape is
    // identical to blending-cv; only the read-line verb differs.
    const client = makeMockClient(JSON.stringify(SAMPLE_CVC_WORD_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toBe('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
    }
  })

  it('every cvc-words read-line word resolves to a known target in the wordPack', async () => {
    // Pin that the planner's word pool stays aligned with the parser's
    // TARGET_WORD_SET. If the planner widens to a vowel the wordPack
    // doesn't carry yet, this surfaces immediately as a parse error.
    const client = makeMockClient(JSON.stringify(SAMPLE_CVC_WORD_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    const targets = rebuilt.problems.map((p) => p.target.word)
    // 8 distinct targets (the prompt forbids repeats within a plan).
    expect(new Set(targets).size).toBe(8)
    // All targets carry isTarget=true (the parser already enforces
    // this; we re-assert here to make the contract loud).
    for (const problem of rebuilt.problems) {
      expect(problem.target.isTarget).toBe(true)
    }
  })
})

describe('planner → parser round-trip — untuned tier stub fallback (step 2 ticket 86c9kxu07)', () => {
  it('a digraphs-requested call falls back to blending-cv content (the stub-fallback contract)', async () => {
    // Per `effectiveFocusNode` in api/_planner.ts: untuned tiers
    // (letter-sounds / digraphs / sight-words / simple-sentences) fall
    // back to blending-cv content so the screen always renders. The
    // mocked Haiku response below is what the planner WOULD ask Haiku
    // for in that case (a blending-cv plan); we just need to confirm
    // the planner accepts the request and the parser stamps it as
    // blending-cv. Future tier tickets refine these to first-class
    // content.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      // Stub-fallback content is blending-cv shape.
      expect(problem.contentType).toBe('blending-cv')
    }
  })
})

/**
 * Cross-module integration — novel-word generalization check on cvc-words
 * mastery graduation (ticket 86c9m3aec).
 *
 * Per the AC: "Round-trip integration test."
 *   1. Simulate 3 sessions of canonical 8 cvc-words at 100% → assert
 *      next session is flagged as graduation.
 *   2. Simulate graduation session with novel words at 100% → assert
 *      pickFocusNode('word-song') advances past cvc-words to the next
 *      node.
 *   3. Simulate graduation session with novel words at 50% → assert
 *      promotion does NOT fire; focus stays on cvc-words.
 *
 * The test covers the full surface: detection helper
 * (`isGraduationSessionPending`), planner-side directive emission,
 * parser-side acceptance of novel words (via `wordPack` extension),
 * `pickDistractors` for novel-word chip rendering (proves the
 * `TARGET_PAIRINGS` rows added in this ticket render real chip
 * trios), and the post-record promotion gate via `pickFocusNode`
 * + `applyMasteryRule` (executed inside `recordProgressOnSessionEnd`).
 */
describe('graduation-session round-trip — cvc-words generalization check (ticket 86c9m3aec)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  /**
   * Seed the persisted Progress with `cvc-words` at 'practicing' plus
   * three cross-day canonical sessions all at 100%. This is the
   * "graduation-pending" state — the next session should fire as a
   * graduation run.
   */
  function seedGraduationPendingProgress(): void {
    const seed = defaultProgress()
    const history: SessionHistoryEntry[] = [
      {
        dateISO: '2026-04-29T10:00:00.000Z',
        skillFocus: ['cvc-words'],
        successRate: 1.0,
      },
      {
        dateISO: '2026-04-30T10:00:00.000Z',
        skillFocus: ['cvc-words'],
        successRate: 1.0,
      },
      {
        dateISO: '2026-05-01T10:00:00.000Z',
        skillFocus: ['cvc-words'],
        successRate: 1.0,
      },
    ]
    saveProgress({
      ...seed,
      skillLevels: {
        ...seed.skillLevels,
        // Mirror the debug-seed `cvc-words` recipe: every preceding
        // word-song node is mastered, cvc-words is at 'practicing'.
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'practicing',
      },
      history,
    })
  }

  it('AC#4 part 1: 3 canonical sessions at 100% flag the next session as graduation', () => {
    seedGraduationPendingProgress()
    const progress = loadProgress()!
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      true,
    )
  })

  it('AC#4 part 2: graduation session with novel words at 100% advances focus past cvc-words', () => {
    seedGraduationPendingProgress()

    // Run the graduation session (mocked Anthropic with a wire-shape
    // response that mixes 6 canonical + 2 novel words). We don't
    // need to test the planner branch here — we test it elsewhere —
    // but we DO want to prove the parser accepts a real graduation
    // wire shape with novel-pool words. So construct the mocked plan
    // directly and feed it through the parser.
    const graduationWirePlan = makeGraduationWirePlan(
      ['cat', 'hat', 'bat', 'mat', 'bag', 'fan'], // 6 canonical
      ['nap', 'rat'], // 2 novel
    )
    const rebuilt = wordSongSessionPlanFromServer(graduationWirePlan)
    expect(rebuilt.problems).toHaveLength(8)

    // The parser accepts novel words as targets — `pickDistractors`
    // resolves their pairings without throwing. Pin both the gentle
    // tier (problem 1) and the trap tier (problem 5) for each novel
    // entry so a missing TARGET_PAIRINGS row would surface here.
    for (const novelWord of ['nap', 'rat']) {
      const novelEntry = rebuilt.problems.find(
        (p) => p.target.word === novelWord,
      )
      expect(novelEntry).toBeDefined()
      expect(() => pickDistractors(novelEntry!.target, 1)).not.toThrow()
      expect(() => pickDistractors(novelEntry!.target, 5)).not.toThrow()
    }

    // Now simulate Marian completing the graduation session with
    // perfect canonical + perfect novel performance. The split is:
    // 6 canonical correct out of 6, 2 novel correct out of 2.
    const split: GraduationSessionSplit = {
      canonicalCorrect: 6,
      canonicalCount: 6,
      novelCorrect: 2,
      novelCount: 2,
    }
    recordProgressOnSessionEnd({
      surface: 'word-song',
      totalCorrect: 8,
      dateISO: '2026-05-02T10:00:00.000Z',
      focusNode: 'cvc-words',
      graduationSplit: split,
    })

    // Promotion fires: cvc-words → mastered, downstream digraphs
    // moves locked → intro. pickFocusNode walks past cvc-words.
    const after = loadProgress()!
    expect(after.skillLevels['cvc-words']).toBe('mastered')
    expect(after.skillLevels['digraphs']).toBe('intro')
    expect(pickFocusNode(after, 'word-song')).not.toBe('cvc-words')
    // Picker walks past cvc-words and lands on digraphs (the next
    // word-song node, now at 'intro' so non-mastered).
    expect(pickFocusNode(after, 'word-song')).toBe('digraphs')
  })

  it('AC#4 part 3: graduation session with novel words at 50% does NOT promote; focus stays on cvc-words', () => {
    seedGraduationPendingProgress()

    // Same canonical performance (perfect) but novel pool fails
    // (1/2 = 0.50 < NOVEL_POOL_THRESHOLD 0.80).
    const split: GraduationSessionSplit = {
      canonicalCorrect: 6,
      canonicalCount: 6,
      novelCorrect: 1,
      novelCount: 2,
    }
    recordProgressOnSessionEnd({
      surface: 'word-song',
      totalCorrect: 7,
      dateISO: '2026-05-02T10:00:00.000Z',
      focusNode: 'cvc-words',
      graduationSplit: split,
    })

    const after = loadProgress()!
    // Promotion blocked at the novel-pool gate.
    expect(after.skillLevels['cvc-words']).toBe('practicing')
    // Downstream stays locked.
    expect(after.skillLevels['digraphs']).toBe('locked')
    // Picker stays on cvc-words.
    expect(pickFocusNode(after, 'word-song')).toBe('cvc-words')
    // ALSO: per the AC contract, the next session is a regular
    // cvc-words session — NOT a re-graduation. The detector reads
    // false because the most recent entry has novelPoolSuccessRate
    // set (0.5).
    expect(isGraduationSessionPending(after, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })

  it('AC#4 corollary: a graduation-marked plan rebuilds with novel-word targets that resolve via the parser', async () => {
    // Pin that the parser's TARGET_WORD_SET is wide enough to accept
    // every word in WORD_SONG_NOVEL_PROBE_WORDS — a missing
    // wordPack.ts entry would surface here as a parse error, BEFORE
    // any planner change ships to production.
    for (const novelWord of WORD_SONG_NOVEL_PROBE_WORDS) {
      const wirePlan = makeGraduationWirePlan(
        ['cat', 'hat', 'bat', 'mat', 'bag', 'fan', 'man'], // 7 canonical
        [novelWord], // 1 novel — different per iteration
      )
      const rebuilt = wordSongSessionPlanFromServer(wirePlan)
      expect(rebuilt.problems).toHaveLength(8)
      expect(rebuilt.problems.map((p) => p.target.word)).toContain(novelWord)
    }
  })
})

/**
 * Build a wire-shape plan that mixes canonical + novel words. Used by
 * the graduation round-trip suite to simulate what the live planner
 * would emit when `isGraduationSession=true`. Mirrors the existing
 * `SAMPLE_CVC_WORD_PLAN` shape — same id namespace, same templates.
 */
function makeGraduationWirePlan(
  canonical: readonly string[],
  novel: readonly string[],
): {
  id: string
  label: string
  utterances: ReadonlyArray<{ id: string; text: string }>
} {
  // Interleave canonical + novel so they don't cluster — the planner
  // directive instructs Haiku to spread novel words across problems
  // 1–8. For test determinism we just append, then renumber.
  const words = [...canonical, ...novel]
  if (words.length !== 8) {
    throw new Error(
      `[plannerRoundTrip test] graduation plan needs 8 words; got ${words.length}`,
    )
  }
  return {
    id: 'haiku-word-grad-roundtrip-001',
    label: 'graduation roundtrip fixture',
    utterances: words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    }),
  }
}
