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
import {
  WORD_SONG_NOVEL_PROBE_WORDS,
  WORD_SONG_SIMPLE_SENTENCES,
} from '../../../api/_plannerWordList'
import { wordSongSessionPlanFromServer } from './planFromServer'
import { pickDistractors } from './wordDistractors'
import {
  SIMPLE_SENTENCE_SCENES,
  SIMPLE_SENTENCE_TARGET_SET,
  getWordEntry,
  normalizeSentenceFrame,
} from './wordPack'
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

/**
 * Short-o sibling tier round-trip (ticket 86c9m3ae3, extended by
 * 86c9teu2e). The planner emits `cvc-words-short-o` content with a
 * short-o pool; the parser already accepts `"Read the <word>."` per
 * PR #132. This suite pins the round-trip end-to-end:
 *
 * Pool history:
 *  - v1 (ticket 86c9m3ae3, PR #150): 8 words —
 *    `dog, mop, log, pot, box, fox, mom, hot`.
 *  - v2 (ticket 86c9teu2e): 11 words — added `cot, top, pop` to
 *    match short-u parity and unblock the cross-vowel mode pool-size
 *    floor.
 *
 *   1. A wire-shape response with 8 short-o "Read the <word>."
 *      problems parses without throwing.
 *   2. Every problem carries `contentType: 'cvc-word'` (same as the
 *      short-a sibling — the discriminant is the read-line template,
 *      not the focus-node name).
 *   3. The 11 target words resolve via `getWordEntry` (the wordPack
 *      carries every short-o entry with `isTarget: true`), and
 *      `pickDistractors` resolves trios for both gentle and trap
 *      tiers including the 3 v2 extension rows.
 *   4. Same-vowel-only rule (spec §8): every distractor for a
 *      short-o target is drawn from the short-o pool itself —
 *      pinned across all 11 targets including cot/top/pop.
 *   5. Bit-for-bit isolation: short-a sessions never see short-o
 *      words leak into them (planner-side guarantee).
 */
describe('planner → parser round-trip — cvc-words-short-o (ticket 86c9m3ae3 / 86c9teu2e)', () => {
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

  /** The full 11-word short-o pool (v2, ticket 86c9teu2e). Used for
   *  the same-vowel-rule matrix scan + the extension-word round-trip
   *  pin below. */
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

  /** Build a wire-shape response that mirrors what the live planner
   *  would emit for `focusNode: 'cvc-words-short-o'`. */
  function makeShortOWirePlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(
        `[plannerRoundTrip test] short-o plan needs 8 words; got ${words.length}`,
      )
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
      label: 'CVC short-o roundtrip fixture',
      utterances,
    })
  }

  it('parses cleanly with contentType=cvc-word on every short-o problem', async () => {
    const client = makeMockClient(makeShortOWirePlan(SHORT_O_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      // Same content-type as cvc-words (short-a) — the discriminant
      // is the read-line template, not the focus-node name.
      expect(problem.contentType).toEqual('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
      // Every target is from the 11-word short-o pool (no short-a /
      // short-u / short-i leakage). Per spec §AC9: round-trip widened
      // from the v1 8-word pool to the v2 11-word pool.
      expect(FULL_SHORT_O_POOL.has(problem.target.word)).toBe(true)
      // Vowel field carries 'o' on every short-o target.
      expect(problem.target.vowel).toEqual('o')
      // isTarget=true on every target (the parser already enforces
      // this; re-asserted for loudness).
      expect(problem.target.isTarget).toBe(true)
    }
    // 8 distinct targets — no repeats within a session.
    const targets = rebuilt.problems.map((p) => p.target.word)
    expect(new Set(targets).size).toEqual(8)
    // Equality check of the sorted targets vs the sorted sample —
    // the fixture fed in 8 v1 words, so we expect those 8 back.
    expect(targets.slice().sort()).toEqual(SHORT_O_WORDS.slice().sort())
  })

  it('parses cleanly when the plan uses the 3 v2 extension words (cot/top/pop)', async () => {
    // Pool-extension coverage: a wire response that includes the 3
    // new v2 extension words alongside 5 v1 words round-trips
    // cleanly. Exercises AC4 — Haiku may emit the new words as the
    // planner's emitted target.
    const planWords = ['cot', 'top', 'pop', 'dog', 'mom', 'pot', 'log', 'fox']
    const client = makeMockClient(makeShortOWirePlan(planWords))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    const targets = rebuilt.problems.map((p) => p.target.word)
    // Exact membership — sorted equality so the 3 extension words
    // round-trip alongside the 5 v1 words.
    expect(targets.slice().sort()).toEqual(planWords.slice().sort())
    // Every target carries vowel: 'o' (no cross-vowel leakage during
    // parsing — the wordPack rows for cot/top/pop are correctly
    // typed).
    for (const problem of rebuilt.problems) {
      expect(problem.target.vowel).toEqual('o')
    }
  })

  it('every short-o target resolves a gentle + trap distractor pair without throwing', async () => {
    // Pin that `TARGET_PAIRINGS` carries a row for every word in
    // `WORD_SONG_TARGET_WORDS_SHORT_O`. Missing rows surface here as
    // a `pickDistractors` throw; matrix drift surfaces immediately.
    const client = makeMockClient(makeShortOWirePlan(SHORT_O_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      // Problem 1 = gentle tier, Problem 5 = trap tier — exercise
      // both code paths.
      expect(() => pickDistractors(problem.target, 1)).not.toThrow()
      expect(() => pickDistractors(problem.target, 5)).not.toThrow()
    }
  })

  it('short-o trios draw distractors only from the 11-word short-o pool (same-vowel rule, spec §8)', () => {
    // For each of the 11 short-o targets (v2 pool, ticket 86c9teu2e),
    // both tiers' distractor pairs must come from the short-o pool.
    // This is a pure read of the matrix — no planner involved.
    // Iterating over FULL_SHORT_O_POOL ensures the 3 new TARGET_PAIRINGS
    // rows (cot, top, pop) are exercised — missing rows would surface
    // here as a `pickDistractors` throw.
    for (const target of FULL_SHORT_O_POOL) {
      // gentle (problem index 1)
      const [g1, g2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'o',
          category: 'object',
          isTarget: true,
        },
        1,
      )
      expect(FULL_SHORT_O_POOL.has(g1.word)).toBe(true)
      expect(FULL_SHORT_O_POOL.has(g2.word)).toBe(true)
      // trap (problem index 5)
      const [t1, t2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'o',
          category: 'object',
          isTarget: true,
        },
        5,
      )
      expect(FULL_SHORT_O_POOL.has(t1.word)).toBe(true)
      expect(FULL_SHORT_O_POOL.has(t2.word)).toBe(true)
    }
  })
})

/**
 * Short-u sibling tier round-trip (ticket 86c9q9ben). Mirrors the
 * short-o block above, one tier further down the literacy ladder.
 * The planner widens to emit `cvc-words-short-u` content with an
 * 11-word short-u pool (`sun, cup, bus, bug, nut, tub, bun, jug,
 * rug, hut, gum`); the parser already accepts `"Read the <word>."`
 * per PR #132. This suite pins the round-trip end-to-end:
 *
 *   1. A wire-shape response with 8 short-u "Read the <word>."
 *      problems parses without throwing.
 *   2. Every problem carries `contentType: 'cvc-word'` (same as the
 *      short-a / short-o siblings — the discriminant is the read-line
 *      template, not the focus-node name).
 *   3. The 8 targets resolve via `getWordEntry` (the wordPack carries
 *      the new 11 entries with `isTarget: true`), and `pickDistractors`
 *      resolves trios for both gentle and trap tiers.
 *   4. Distractor pool isolation: same-vowel-only rule (spec §8) —
 *      every distractor for a short-u target is drawn from the
 *      short-u pool itself.
 */
describe('planner → parser round-trip — cvc-words-short-u (ticket 86c9q9ben)', () => {
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

  const FULL_SHORT_U_POOL: ReadonlySet<string> = new Set([
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

  /** Build a wire-shape response that mirrors what the live planner
   *  would emit for `focusNode: 'cvc-words-short-u'`. */
  function makeShortUWirePlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(
        `[plannerRoundTrip test] short-u plan needs 8 words; got ${words.length}`,
      )
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
      label: 'CVC short-u roundtrip fixture',
      utterances,
    })
  }

  it('parses cleanly with contentType=cvc-word on every short-u problem', async () => {
    const client = makeMockClient(makeShortUWirePlan(SHORT_U_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toEqual('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
      // Every target is from the short-u pool (no short-a / short-o
      // leakage at the planner-output level).
      expect(FULL_SHORT_U_POOL.has(problem.target.word)).toBe(true)
      // Vowel field carries 'u' on every short-u target.
      expect(problem.target.vowel).toEqual('u')
      // isTarget=true on every target.
      expect(problem.target.isTarget).toBe(true)
    }
    // 8 distinct targets — no repeats within a session.
    const targets = rebuilt.problems.map((p) => p.target.word)
    expect(new Set(targets).size).toEqual(8)
  })

  it('every short-u target resolves a gentle + trap distractor pair without throwing', async () => {
    // Pin that `TARGET_PAIRINGS` carries a row for every word in the
    // 11-word short-u pool. Missing rows surface here as a
    // `pickDistractors` throw; matrix drift surfaces immediately.
    const client = makeMockClient(makeShortUWirePlan(SHORT_U_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-u',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      expect(() => pickDistractors(problem.target, 1)).not.toThrow()
      expect(() => pickDistractors(problem.target, 5)).not.toThrow()
    }
  })

  it('short-u trios draw distractors only from the short-u pool (same-vowel rule, spec §8)', () => {
    // For each of the 11 short-u targets, both tiers' distractor pairs
    // must come from the short-u pool. Pure read of the matrix —
    // exercises every TARGET_PAIRINGS row including `rug, hut, gum`
    // which aren't in the SHORT_U_WORDS sample above.
    for (const target of FULL_SHORT_U_POOL) {
      const [g1, g2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'u',
          category: 'object',
          isTarget: true,
        },
        1,
      )
      expect(FULL_SHORT_U_POOL.has(g1.word)).toBe(true)
      expect(FULL_SHORT_U_POOL.has(g2.word)).toBe(true)
      const [t1, t2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'u',
          category: 'object',
          isTarget: true,
        },
        5,
      )
      expect(FULL_SHORT_U_POOL.has(t1.word)).toBe(true)
      expect(FULL_SHORT_U_POOL.has(t2.word)).toBe(true)
    }
  })

  it('every short-u target resolves via getWordEntry with isTarget=true AND vowel="u" (alignment contract)', () => {
    // Defensive contract pin: the wordPack must carry every entry in
    // `WORD_SONG_TARGET_WORDS_SHORT_U` as `isTarget: true` with
    // `vowel: 'u'`. Drift between _plannerWordList.ts and wordPack.ts
    // would surface as either a missing entry (getWordEntry throws)
    // or a false isTarget flag (the parser would reject it as a
    // "non-target word"). Direct read of the wordPack — no planner
    // mock needed.
    for (const word of FULL_SHORT_U_POOL) {
      const entry = getWordEntry(word)
      expect(entry.isTarget).toBe(true)
      expect(entry.vowel).toBe('u')
    }
    // Sanity: exactly 11 short-u entries.
    expect(FULL_SHORT_U_POOL.size).toEqual(11)
  })
})

/**
 * Short-i sibling tier round-trip (ticket 86c9qdba4). Mirrors the
 * short-o / short-u blocks above, one tier further down the literacy
 * ladder. The planner widens to emit `cvc-words-short-i` content with
 * an 8-word short-i pool (`pig, pin, bin, wig, bib, fig, lid, sip`);
 * the parser already accepts `"Read the <word>."` per PR #132. This
 * suite pins the round-trip end-to-end:
 *
 *   1. A wire-shape response with 8 short-i "Read the <word>."
 *      problems parses without throwing.
 *   2. Every problem carries `contentType: 'cvc-word'` (same as the
 *      short-a / short-o / short-u siblings — the discriminant is the
 *      read-line template, not the focus-node name).
 *   3. The 8 targets resolve via `getWordEntry` (the wordPack carries
 *      the new 8 entries with `isTarget: true`), and `pickDistractors`
 *      resolves trios for both gentle and trap tiers.
 *   4. Distractor pool isolation: same-vowel-only rule (spec §8) —
 *      every distractor for a short-i target is drawn from the
 *      short-i pool itself.
 *
 * Phase-2 voluntary drop note: the short-i recommended pool was 11
 * words per `design/word-song/short-i-pool-expansion.md` §1, but
 * Thomas dropped `hip` and `rim` for vocab unfamiliarity, leaving
 * the 8-word ship pool below. The remaining 8 cover four rhyme
 * families (`/ɪg/`, `/ɪn/`, `/ɪb/`, `/ɪd/`) plus a `/ɪp/` singleton.
 */
describe('planner → parser round-trip — cvc-words-short-i (ticket 86c9qdba4)', () => {
  const SHORT_I_WORDS = [
    'pig',
    'pin',
    'bin',
    'wig',
    'bib',
    'fig',
    'lid',
    'sip',
  ] as const

  const FULL_SHORT_I_POOL: ReadonlySet<string> = new Set(SHORT_I_WORDS)

  /** Build a wire-shape response that mirrors what the live planner
   *  would emit for `focusNode: 'cvc-words-short-i'`. */
  function makeShortIWirePlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(
        `[plannerRoundTrip test] short-i plan needs 8 words; got ${words.length}`,
      )
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
      id: 'haiku-word-short-i-001',
      label: 'CVC short-i roundtrip fixture',
      utterances,
    })
  }

  it('parses cleanly with contentType=cvc-word on every short-i problem', async () => {
    const client = makeMockClient(makeShortIWirePlan(SHORT_I_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-i',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toEqual('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
      // Every target is from the short-i pool (no other-vowel leakage
      // at the planner-output level).
      expect(FULL_SHORT_I_POOL.has(problem.target.word)).toBe(true)
      // Vowel field carries 'i' on every short-i target.
      expect(problem.target.vowel).toEqual('i')
      // isTarget=true on every target.
      expect(problem.target.isTarget).toBe(true)
    }
    // 8 distinct targets — no repeats within a session. Equality
    // check (count-based assertion per
    // feedback_count_assertions_on_regression_tests.md).
    const targets = rebuilt.problems.map((p) => p.target.word)
    expect(new Set(targets).size).toEqual(8)
    // Sorted-equality of pool — exact membership, not "contains".
    expect(targets.slice().sort()).toEqual([...SHORT_I_WORDS].sort())
  })

  it('every short-i target resolves a gentle + trap distractor pair without throwing', async () => {
    // Pin that `TARGET_PAIRINGS` carries a row for every word in the
    // 8-word short-i pool. Missing rows surface here as a
    // `pickDistractors` throw; matrix drift surfaces immediately.
    const client = makeMockClient(makeShortIWirePlan(SHORT_I_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-i',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      expect(() => pickDistractors(problem.target, 1)).not.toThrow()
      expect(() => pickDistractors(problem.target, 5)).not.toThrow()
    }
  })

  it('short-i trios draw distractors only from the short-i pool (same-vowel rule, spec §8)', () => {
    // For each of the 8 short-i targets, both tiers' distractor pairs
    // must come from the short-i pool. Pure read of the matrix —
    // exercises every TARGET_PAIRINGS row.
    for (const target of FULL_SHORT_I_POOL) {
      const [g1, g2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'i',
          category: 'object',
          isTarget: true,
        },
        1,
      )
      expect(FULL_SHORT_I_POOL.has(g1.word)).toBe(true)
      expect(FULL_SHORT_I_POOL.has(g2.word)).toBe(true)
      const [t1, t2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'i',
          category: 'object',
          isTarget: true,
        },
        5,
      )
      expect(FULL_SHORT_I_POOL.has(t1.word)).toBe(true)
      expect(FULL_SHORT_I_POOL.has(t2.word)).toBe(true)
    }
  })

  it('every short-i target resolves via getWordEntry with isTarget=true AND vowel="i" (alignment contract)', () => {
    // Defensive contract pin: the wordPack must carry every entry in
    // `WORD_SONG_TARGET_WORDS_SHORT_I` as `isTarget: true` with
    // `vowel: 'i'`. Drift between _plannerWordList.ts and wordPack.ts
    // would surface as either a missing entry (getWordEntry throws)
    // or a false isTarget flag (the parser would reject it as a
    // "non-target word"). Direct read of the wordPack — no planner
    // mock needed.
    for (const word of FULL_SHORT_I_POOL) {
      const entry = getWordEntry(word)
      expect(entry.isTarget).toBe(true)
      expect(entry.vowel).toBe('i')
    }
    // Sanity: exactly 8 short-i entries (Phase-2 voluntary drop of
    // hip + rim from the recommended 11-word pool).
    expect(FULL_SHORT_I_POOL.size).toEqual(8)
  })
})

/**
 * Short-e sibling tier round-trip (ticket 86c9teua2). Mirrors the
 * short-o / short-u / short-i blocks above, one tier further down the
 * literacy ladder — and the FINAL single-vowel tier in the
 * o → u → i → e canonical arc. The planner widens to emit
 * `cvc-words-short-e` content with a 9-word short-e pool (`bed, leg,
 * hen, pen, web, net, jet, gem, egg`); the parser already accepts
 * `"Read the <word>."` per PR #132. This suite pins the round-trip
 * end-to-end:
 *
 *   1. A wire-shape response with 8 short-e "Read the <word>."
 *      problems parses without throwing (pool is 9; planner picks 8
 *      distinct per the standard rule).
 *   2. Every problem carries `contentType: 'cvc-word'` (same as the
 *      short-a / short-o / short-u / short-i siblings — the discriminant
 *      is the read-line template, not the focus-node name).
 *   3. The 8 sampled targets resolve via `getWordEntry` (the wordPack
 *      carries all 9 entries with `isTarget: true`), and
 *      `pickDistractors` resolves trios for both gentle and trap tiers.
 *   4. Distractor pool isolation: same-vowel-only rule (spec §8) —
 *      every distractor for a short-e target is drawn from the
 *      short-e pool itself.
 */
describe('planner → parser round-trip — cvc-words-short-e (ticket 86c9teua2)', () => {
  const SHORT_E_WORDS = [
    'bed',
    'leg',
    'hen',
    'pen',
    'web',
    'net',
    'jet',
    'gem',
  ] as const

  const FULL_SHORT_E_POOL: ReadonlySet<string> = new Set([
    ...SHORT_E_WORDS,
    'egg',
  ])

  /** Build a wire-shape response that mirrors what the live planner
   *  would emit for `focusNode: 'cvc-words-short-e'`. Uses 8 of the 9
   *  short-e pool entries — the planner picks 8 distinct per session. */
  function makeShortEWirePlan(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(
        `[plannerRoundTrip test] short-e plan needs 8 words; got ${words.length}`,
      )
    }
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      // egg uses the bang-fallback celebration template per the
      // planner directive's vowel-initial exception (ticket 86c9teua2);
      // other short-e words use the default "That's a <word>." form.
      const correctText =
        word === 'egg' ? `Yes! ${cap}!` : `Yes! That's a ${word}.`
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: correctText },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-short-e-001',
      label: 'CVC short-e roundtrip fixture',
      utterances,
    })
  }

  it('parses cleanly with contentType=cvc-word on every short-e problem', async () => {
    const client = makeMockClient(makeShortEWirePlan(SHORT_E_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-e',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    expect(rebuilt.problems).toHaveLength(8)
    for (const problem of rebuilt.problems) {
      expect(problem.contentType).toEqual('cvc-word')
      expect(problem.utterances.read).toMatch(/^Read the [a-z]+\.$/)
      // Every target is from the short-e pool (no other-vowel leakage
      // at the planner-output level).
      expect(FULL_SHORT_E_POOL.has(problem.target.word)).toBe(true)
      // Vowel field carries 'e' on every short-e target.
      expect(problem.target.vowel).toEqual('e')
      // isTarget=true on every target.
      expect(problem.target.isTarget).toBe(true)
    }
    // 8 distinct targets — no repeats within a session. Equality
    // check (count-based assertion per
    // feedback_count_assertions_on_regression_tests.md).
    const targets = rebuilt.problems.map((p) => p.target.word)
    expect(new Set(targets).size).toEqual(8)
    // Sorted-equality on the 8 we fed in — exact membership, not "contains".
    expect(targets.slice().sort()).toEqual([...SHORT_E_WORDS].sort())
  })

  it('every short-e target resolves a gentle + trap distractor pair without throwing', async () => {
    // Pin that `TARGET_PAIRINGS` carries a row for every word in the
    // 9-word short-e pool. Missing rows surface here as a
    // `pickDistractors` throw; matrix drift surfaces immediately.
    const client = makeMockClient(makeShortEWirePlan(SHORT_E_WORDS))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-e',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      expect(() => pickDistractors(problem.target, 1)).not.toThrow()
      expect(() => pickDistractors(problem.target, 5)).not.toThrow()
    }
  })

  it('short-e trios draw distractors only from the short-e pool (same-vowel rule, spec §8)', () => {
    // For each of the 9 short-e targets, both tiers' distractor pairs
    // must come from the short-e pool. Pure read of the matrix —
    // exercises every TARGET_PAIRINGS row.
    for (const target of FULL_SHORT_E_POOL) {
      const [g1, g2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'e',
          category: 'object',
          isTarget: true,
        },
        1,
      )
      expect(FULL_SHORT_E_POOL.has(g1.word)).toBe(true)
      expect(FULL_SHORT_E_POOL.has(g2.word)).toBe(true)
      const [t1, t2] = pickDistractors(
        {
          word: target,
          pictureKey: target,
          vowel: 'e',
          category: 'object',
          isTarget: true,
        },
        5,
      )
      expect(FULL_SHORT_E_POOL.has(t1.word)).toBe(true)
      expect(FULL_SHORT_E_POOL.has(t2.word)).toBe(true)
    }
  })

  it('every short-e target resolves via getWordEntry with isTarget=true AND vowel="e" (alignment contract)', () => {
    // Defensive contract pin: the wordPack must carry every entry in
    // `WORD_SONG_TARGET_WORDS_SHORT_E` as `isTarget: true` with
    // `vowel: 'e'`. Drift between _plannerWordList.ts and wordPack.ts
    // would surface as either a missing entry (getWordEntry throws)
    // or a false isTarget flag (the parser would reject it as a
    // "non-target word"). Direct read of the wordPack — no planner
    // mock needed.
    for (const word of FULL_SHORT_E_POOL) {
      const entry = getWordEntry(word)
      expect(entry.isTarget).toBe(true)
      expect(entry.vowel).toBe('e')
    }
    // Sanity: exactly 9 short-e entries (audit-derived ship pool per
    // spec §1 / §10 Q1 = A).
    expect(FULL_SHORT_E_POOL.size).toEqual(9)
  })
})

/**
 * CVC phoneme-blend slot round-trip (ticket 86ca8t8xx — the light-up).
 *
 * The planner now emits a 6th OPTIONAL `blend` utterance on every
 * cvc-word problem (`word.p<N>.blend`). The browser parser carries it
 * through in-namespace (NOT required — see `planFromServer.ts`
 * `parseUtteranceId`). This suite pins the AC the canon layer owns:
 *
 *   - Every cvc-word problem in a baked session carries a `blend`
 *     utterance.
 *   - The `blend` text tokenizes to EXACTLY `target.word.length + 1`
 *     tokens (graphemes + whole word). `box`/`fox` still tokenize to 4
 *     because `x` is ONE grapheme token (the /ks/ cluster), not two.
 *   - Non-cvc-word tiers do NOT carry a `blend` slot.
 *
 * Tokenization mirrors the screen-side caption walk (Kyle spec
 * §"Letter-highlight timing"): split the stored text on whitespace and
 * drop the ` - ` / ` ... ` ASCII-7 separators — the remaining tokens are
 * `[g1, g2, ..., word]`.
 */
describe('planner → parser round-trip — cvc-word blend slot (ticket 86ca8t8xx)', () => {
  /** Tokenize a stored blend canon text the way the caption walk does:
   *  whitespace-split, then drop the `-` and `...` separator tokens. */
  function tokenizeBlend(text: string): string[] {
    return text
      .trim()
      .split(/\s+/)
      .filter((t) => t !== '-' && t !== '...')
  }

  /** Build a cvc-word wire plan that ALSO emits the blend slot per
   *  problem — mirrors what the live planner directive now instructs
   *  Haiku to emit. `x` words (box/fox) keep `x` as one grapheme token. */
  function makeCvcWordPlanWithBlend(words: readonly string[]): string {
    if (words.length !== 8) {
      throw new Error(
        `[plannerRoundTrip test] cvc-word blend plan needs 8 words; got ${words.length}`,
      )
    }
    const utterances = words.flatMap((word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      // ASCII-7 segmented form: graphemes joined by " - ", then " ... ",
      // then the whole word. CVC words are 3 single-letter graphemes.
      const blend = `${word.split('').join(' - ')} ... ${word}`
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
        { id: `word.p${n}.blend`, text: blend },
      ]
    })
    return JSON.stringify({
      id: 'haiku-word-cvc-blend-001',
      label: 'CVC blend roundtrip fixture',
      utterances,
    })
  }

  it('every cvc-word problem carries a blend whose text tokenizes to word.length + 1', async () => {
    const words = ['cat', 'hat', 'bag', 'man', 'jam', 'van', 'dog', 'mop']
    const client = makeMockClient(makeCvcWordPlanWithBlend(words))

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
      const blend = problem.utterances.blend
      // The blend slot is carried through the parser.
      expect(typeof blend).toBe('string')
      const tokens = tokenizeBlend(blend!)
      // graphemes + whole word = word.length + 1.
      expect(tokens).toHaveLength(problem.target.word.length + 1)
      // Last token is the whole word; leading tokens are the graphemes.
      expect(tokens[tokens.length - 1]).toBe(problem.target.word)
      expect(tokens.slice(0, -1).join('')).toBe(problem.target.word)
    }
  })

  it('box/fox keep x as ONE grapheme token — blend still tokenizes to 4 (the /ks/ exception)', async () => {
    // box/fox decode `x` as the cluster /ks/ but stay ONE grapheme token,
    // so the count is wordLength + 1 = 4, NOT 5. The directive forbids
    // splitting `x` into `k - s`.
    const words = ['box', 'fox', 'dog', 'mop', 'log', 'pot', 'hot', 'mom']
    const client = makeMockClient(makeCvcWordPlanWithBlend(words))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'cvc-words-short-o',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      const tokens = tokenizeBlend(problem.utterances.blend!)
      // Every short-o word here is 3 letters → 4 tokens, x counts as one.
      expect(tokens).toHaveLength(4)
      expect(tokens[tokens.length - 1]).toBe(problem.target.word)
    }
  })

  it('a non-cvc-word tier (blending-cv) carries NO blend slot', async () => {
    // blending-cv must stay at the 5 required slots — the planner directive
    // scopes blend to cvc-word tiers only. The fixture (SAMPLE_CV_BLEND_PLAN)
    // emits no blend lines, mirroring the directive.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'blending-cv',
    })

    const rebuilt = wordSongSessionPlanFromServer(plan)
    for (const problem of rebuilt.problems) {
      expect(problem.utterances.blend).toBeUndefined()
    }
  })
})

describe('planner → parser round-trip — untuned tier stub fallback (step 2 ticket 86c9kxu07)', () => {
  it('a digraphs-sh-requested call falls back to blending-cv content (the stub-fallback contract)', async () => {
    // Per `effectiveFocusNode` in api/_planner.ts: untuned tiers
    // (letter-sounds / digraphs-sh / digraphs-ch / digraphs-th-voiceless
    // / sight-words / simple-sentences) fall back to blending-cv
    // content so the screen always renders. The mocked Haiku response
    // below is what the planner WOULD ask Haiku for in that case (a
    // blending-cv plan); we just need to confirm the planner accepts
    // the request and the parser stamps it as blending-cv. Future tier
    // tickets refine these to first-class content. The digraph
    // SkillNode split (PR #211) replaces the single `digraphs` literal
    // with three sequential sibling nodes; this test pins the
    // stub-fallback for the leading sibling.
    const client = makeMockClient(JSON.stringify(SAMPLE_CV_BLEND_PLAN))

    const plan = await generateSessionPlan({
      client,
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'digraphs-sh',
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

    // Promotion fires: cvc-words → mastered, downstream
    // cvc-words-short-o moves locked → intro (ticket 86c9m3ae3
    // inserted the sibling between cvc-words and digraphs-sh; the
    // first digraph sibling stays locked until short-e promotes).
    // pickFocusNode walks past cvc-words and lands on
    // cvc-words-short-o. (PR #211 split the dead `digraphs` literal
    // into 3 sequential sibling nodes; `digraphs-sh` is the leading
    // digraph node, still far downstream of the short-o cascade.)
    const after = loadProgress()!
    expect(after.skillLevels['cvc-words']).toBe('mastered')
    expect(after.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(after.skillLevels['digraphs-sh']).toBe('locked')
    expect(pickFocusNode(after, 'word-song')).not.toBe('cvc-words')
    // Picker walks past cvc-words and lands on cvc-words-short-o (the
    // next word-song node, now at 'intro' so non-mastered).
    expect(pickFocusNode(after, 'word-song')).toBe('cvc-words-short-o')
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
    expect(after.skillLevels['digraphs-sh']).toBe('locked')
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

// ── Simple-sentences tier alignment + round-trip (Wave 13, 86ca8e6fr) ──
//
// The canonical sentence pool lives server-side (`WORD_SONG_SIMPLE_SENTENCES`
// in `api/_plannerWordList.ts`); the parser (src/) cannot import it, so it
// relies on two browser-side mirrors in `wordPack.ts`:
//   - `SIMPLE_SENTENCE_TARGET_SET` (membership the parser checks the
//     `correct`-resolved target against), and
//   - `SIMPLE_SENTENCE_SCENES` (gentle-frame → sceneId derivation table).
// These tests lock the mirrors against the canonical pool so they never
// drift. This file is the right home (src/ may import api/, but api/ may
// not import src/ — one-directional, same as every other round-trip lock).
describe('simple-sentences tier — canonical pool ↔ browser-mirror alignment (W13, 86ca8e6fr)', () => {
  it('every canonical pool target is in SIMPLE_SENTENCE_TARGET_SET and resolves via getWordEntry', () => {
    const offSet: string[] = []
    const unresolved: string[] = []
    for (const row of WORD_SONG_SIMPLE_SENTENCES) {
      if (!SIMPLE_SENTENCE_TARGET_SET.has(row.target)) offSet.push(row.target)
      try {
        getWordEntry(row.target)
      } catch {
        unresolved.push(row.target)
      }
    }
    // Count-based — the failure names exactly which targets drifted.
    expect(offSet).toEqual([])
    expect(unresolved).toEqual([])
  })

  it('SIMPLE_SENTENCE_TARGET_SET contains no word absent from the canonical pool', () => {
    const poolTargets = new Set(WORD_SONG_SIMPLE_SENTENCES.map((r) => r.target))
    const orphans = [...SIMPLE_SENTENCE_TARGET_SET].filter(
      (w) => !poolTargets.has(w),
    )
    expect(orphans).toEqual([])
  })

  it('every gentle-phase pool row maps to its id in SIMPLE_SENTENCE_SCENES (and vice versa)', () => {
    const gentle = WORD_SONG_SIMPLE_SENTENCES.filter(
      (r) => r.phase === 'gentle',
    )
    // Forward: each gentle row's normalized frame → its id in the registry.
    for (const row of gentle) {
      const key = normalizeSentenceFrame(row.frame)
      expect(SIMPLE_SENTENCE_SCENES[key]).toBe(row.id)
    }
    // Reverse: the registry has exactly the gentle rows — no extra, none missing.
    const registryIds = Object.values(SIMPLE_SENTENCE_SCENES).sort()
    const gentleIds = gentle.map((r) => r.id).sort()
    expect(registryIds).toEqual(gentleIds)
  })

  it('trap-phase pool rows are NOT in the scene registry (text-only render)', () => {
    const trap = WORD_SONG_SIMPLE_SENTENCES.filter((r) => r.phase === 'trap')
    const leaked = trap.filter(
      (r) =>
        SIMPLE_SENTENCE_SCENES[normalizeSentenceFrame(r.frame)] !== undefined,
    )
    // Some trap frames intentionally share a surface shape with a gentle
    // frame (e.g. "The dog ___." appears in both phases with different
    // gaps) — but the gentle one OWNS the normalized key. Assert no trap
    // frame whose normalized key is NOT also a gentle frame leaks a scene.
    const gentleKeys = new Set(
      WORD_SONG_SIMPLE_SENTENCES.filter((r) => r.phase === 'gentle').map((r) =>
        normalizeSentenceFrame(r.frame),
      ),
    )
    const trueLeaks = leaked.filter(
      (r) => !gentleKeys.has(normalizeSentenceFrame(r.frame)),
    )
    expect(trueLeaks).toEqual([])
  })

  it('a Haiku-mocked simple-sentences plan round-trips: target-from-correct, frame, sceneId', async () => {
    // Mirror the canon wire shape: read carries "blank" (TTS form); the
    // parser splits on the displayed ___ frame — but the PLANNER emits the
    // ___ data form in the read for the browser to render the styled gap.
    // Here we emit the ___ form (what the canon stores) so the parser
    // exercise matches production. Pick 3 gentle + 5 trap rows.
    const gentle = WORD_SONG_SIMPLE_SENTENCES.filter(
      (r) => r.phase === 'gentle',
    ).slice(0, 3)
    const trap = WORD_SONG_SIMPLE_SENTENCES.filter(
      (r) => r.phase === 'trap',
    ).slice(0, 5)
    const rows = [...gentle, ...trap]
    const response = JSON.stringify({
      id: 'haiku-simple-sentences-roundtrip-001',
      label: 'simple-sentences roundtrip fixture',
      utterances: rows.flatMap((row, i) => {
        const n = i + 1
        const cap = row.target.charAt(0).toUpperCase() + row.target.slice(1)
        return [
          { id: `word.p${n}.read`, text: `Finish the sentence: ${row.frame}` },
          { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
          { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
          {
            id: `word.p${n}.hint`,
            text: `Listen. ${row.frame.replace('___', row.target)}`,
          },
          { id: `word.p${n}.giveAnswer`, text: `This one is ${row.target}.` },
        ]
      }),
    })

    const plan = await generateSessionPlan({
      client: makeMockClient(response),
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'simple-sentences',
    })

    const parsed = wordSongSessionPlanFromServer(plan)
    expect(parsed.problems).toHaveLength(8)
    parsed.problems.forEach((problem, i) => {
      const row = rows[i]!
      expect(problem.contentType).toBe('simple-sentence')
      // Target resolved from `correct`, NOT the gapped read.
      expect(problem.target.word).toBe(row.target)
      // Frame carries ___ verbatim.
      expect(problem.sentenceFrame).toBe(row.frame)
      // sceneId derives for gentle rows, undefined for trap.
      if (row.phase === 'gentle') {
        expect(problem.sceneId).toBe(row.id)
      } else {
        expect(problem.sceneId).toBeUndefined()
      }
    })
  })
})
