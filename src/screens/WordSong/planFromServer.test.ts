import { describe, expect, it } from 'vitest'
import {
  LETTER_GLYPH_PICTURE_KEY_PREFIX,
  LETTER_GLYPH_POOL,
  PlanFromServerError,
  parseReadLine,
  parseReadTarget,
  wordSongSessionPlanFromServer,
} from './planFromServer'
import {
  STATIC_WORD_SONG_PLANS,
  wordSongSessionPlanToUtteranceSources,
} from './wordSessionPlans'
import { SAMPLE_CV_BLEND_PLAN } from './__fixtures__/sample-cv-blend-plan'
import {
  SAMPLE_CVC_WORD_PLAN,
  SAMPLE_MIXED_PLAN,
} from './__fixtures__/sample-cvc-word-plan'
import { SAMPLE_LETTER_NAMES_PLAN } from './__fixtures__/sample-letter-names-plan'

function staticPlanAsServerShape(planIndex = 0) {
  const plan = STATIC_WORD_SONG_PLANS[planIndex]!
  return {
    id: plan.id,
    label: plan.label,
    utterances: wordSongSessionPlanToUtteranceSources(plan).map((u) => ({
      id: u.id,
      text: u.text,
    })),
  }
}

describe('parseReadTarget', () => {
  it('parses canonical "Tap the cat."', () => {
    const entry = parseReadTarget('Tap the cat.')
    expect(entry.word).toBe('cat')
  })

  it('is case-insensitive on the leading word', () => {
    const entry = parseReadTarget('tap the bat.')
    expect(entry.word).toBe('bat')
  })

  it('throws on non-template lines', () => {
    expect(() => parseReadTarget('Where is the cat?')).toThrow(
      PlanFromServerError,
    )
  })

  it('throws on words outside the target list', () => {
    // After the short-e promotion (ticket 86c9teua2), `pen` flipped to
    // `isTarget: true` and `DISTRACTOR_ONLY_WORDS` is now empty — there
    // are no in-pack distractor-only entries to exercise the non-target
    // rejection path. We use a plausibly-CVC English word that is NOT
    // in any of the target pools: `'ten'` — explicitly rejected from
    // short-e per spec §1 audit (abstract number, no stable noun-form
    // picture) and not in any other vowel pool.
    expect(() => parseReadTarget('Tap the ten.')).toThrow(/non-target word/)
  })
})

describe('wordSongSessionPlanFromServer — happy path', () => {
  it('rebuilds a WordSongSessionPlan that matches the static plan it came from', () => {
    const wire = staticPlanAsServerShape(0)
    const rebuilt = wordSongSessionPlanFromServer(wire)
    const original = STATIC_WORD_SONG_PLANS[0]!

    expect(rebuilt.id).toBe(original.id)
    expect(rebuilt.label).toBe(original.label)
    expect(rebuilt.problems).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      const got = rebuilt.problems[i]!
      const want = original.problems[i]!
      expect(got.index).toBe(want.index)
      expect(got.target.word).toBe(want.target.word)
      expect(got.utterances).toEqual(want.utterances)
    }
  })

  it('preserves server-supplied id/label even when novel', () => {
    const wire = {
      ...staticPlanAsServerShape(0),
      id: 'haiku-shorta',
      label: 'Word Song: CVC short-a',
    }
    const rebuilt = wordSongSessionPlanFromServer(wire)
    expect(rebuilt.id).toBe('haiku-shorta')
    expect(rebuilt.label).toBe('Word Song: CVC short-a')
  })
})

describe('wordSongSessionPlanFromServer — failure paths', () => {
  it('throws when the blob is the wrong shape', () => {
    expect(() => wordSongSessionPlanFromServer(null)).toThrow(
      PlanFromServerError,
    )
    expect(() => wordSongSessionPlanFromServer({})).toThrow(PlanFromServerError)
  })

  it('skips utterances with ids outside the word.p<N>.<slot> namespace, but still rejects when that leaves a slot missing', () => {
    // Replace word.p1.read with a malformed (in-namespace but bad slot)
    // id. Under the skip-not-throw contract the parser ignores it, but
    // problem 1's `read` slot is now genuinely missing — which the
    // completeness check still catches with the clearer "missing slot"
    // error.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: [
        { id: 'word.p1.notaslot', text: 'x' },
        ...wire.utterances.slice(1),
      ],
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })

  it('throws when a problem is missing entirely', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => !u.id.startsWith('word.p3.')),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing problem index 3/,
    )
  })

  it('throws when a slot is missing for a problem', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => u.id !== 'word.p2.correct'),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing slot "correct"/,
    )
  })

  it('throws when the read line drifts off template', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'word.p1.read' ? { ...u, text: 'Find the cat.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(/template/)
  })

  it('throws when the read line yields a non-target word', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        // Post the short-e promotion (ticket 86c9teua2), `pen` flipped
        // to `isTarget: true` and `DISTRACTOR_ONLY_WORDS` is empty.
        // Use `'ten'` (rejected from short-e audit §1; not in any pool)
        // so the negative path still surfaces.
        u.id === 'word.p1.read' ? { ...u, text: 'Tap the ten.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /non-target word/,
    )
  })
})

// Regression tests for ticket 86c9kj2u6 — same shape as the Math sibling.
// The planner emits `session.end.*` ids for both Math and WordSong
// sessions; this parser must skip them rather than throw.
describe('wordSongSessionPlanFromServer — skip-not-throw on out-of-namespace ids (86c9kj2u6)', () => {
  /** The 19 session.end.* ids the planner emits today. Texts are
   *  placeholders; the parser only inspects ids. */
  const SESSION_END_UTTERANCES: ReadonlyArray<{ id: string; text: string }> = [
    { id: 'session.end.opener', text: 'You did it!' },
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `session.end.recap.${i + 1}`,
      text: `recap-${i + 1}`,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `session.end.streak.${i + 3}`,
      text: `streak-${i + 3}`,
    })),
    { id: 'session.end.goodbye', text: 'See you soon.' },
  ]

  it('returns the same plan whether or not session.end.* ids are present', () => {
    const baseline = staticPlanAsServerShape(0)
    const additive = {
      ...baseline,
      utterances: [...baseline.utterances, ...SESSION_END_UTTERANCES],
    }
    expect(additive.utterances.length).toBe(40 + 19)
    const fromBaseline = wordSongSessionPlanFromServer(baseline)
    const fromAdditive = wordSongSessionPlanFromServer(additive)
    expect(fromAdditive).toEqual(fromBaseline)
  })

  it('still rejects malformed-but-namespaced ids by surfacing the missing-slot error downstream', () => {
    // `word.p1.bogus` is in the word.* namespace but its slot doesn't
    // match read|correct|reprompt|hint|giveAnswer. Skip-not-throw drops
    // it; the completeness check then surfaces the missing slot.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'word.p1.read' ? { id: 'word.p1.bogus', text: u.text } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      PlanFromServerError,
    )
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })
})

/**
 * P0 regression — ticket 86c9kt47v.
 *
 * Pin that a wire shape MATCHING the server planner's post-fix output
 * round-trips cleanly through this parser. Three failure modes silenced
 * WordSong on prod after M2 (PR #117):
 *   1. ids prefixed `cvc.*` instead of `word.*`
 *   2. read text "Tap the letter that says /m/." instead of
 *      "Tap the <word>."
 *   3. `focusNode: 'blending-cv'` returning planner-failed
 *
 * The post-fix planner contract is single-mode CVC: every problem
 * utterance starts with "word.", every read line is "Tap the <word>.",
 * regardless of focusNode. This test simulates the exact wire shape the
 * fixed planner emits and confirms the parser accepts it. Pairs with
 * `api/_planner.test.ts` describe block "word-song single-mode P0
 * regression (86c9kt47v)".
 */
describe('wordSongSessionPlanFromServer — round-trips post-fix planner output (P0 86c9kt47v)', () => {
  /** Build a synthetic 8-problem CVC plan in the EXACT shape the fixed
   *  planner promises to emit: word.p<N>.<slot> ids + "Tap the <word>."
   *  read lines, drawn from the canonical 14-target list. */
  function buildPostFixPlannerWire() {
    // Use 8 distinct words from the target list — same set the planner
    // is told to use in WORD_SONG_TARGET_WORDS_FOR_PROMPT.
    const words = ['cat', 'hat', 'bat', 'mat', 'bag', 'fan', 'man', 'pan']
    return {
      id: 'haiku-word-cvc-001',
      label: 'CVC short-a — Haiku-generated',
      utterances: words.flatMap((word, i) => {
        const n = i + 1
        const cap = word.charAt(0).toUpperCase() + word.slice(1)
        return [
          { id: `word.p${n}.read`, text: `Tap the ${word}.` },
          { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
          { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
          { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
          { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
        ]
      }),
    }
  }

  it('parses a synthetic 8-problem post-fix planner response cleanly', () => {
    const wire = buildPostFixPlannerWire()
    const plan = wordSongSessionPlanFromServer(wire)
    expect(plan.id).toBe('haiku-word-cvc-001')
    expect(plan.problems).toHaveLength(8)
    // Every target resolves to a known WordEntry in the wordPack —
    // pre-fix the parser would have thrown PlanFromServerError before
    // reaching this assertion.
    const targetWords = plan.problems.map((p) => p.target.word)
    expect(targetWords).toEqual([
      'cat',
      'hat',
      'bat',
      'mat',
      'bag',
      'fan',
      'man',
      'pan',
    ])
  })

  it('rejects the prod-incident "letter-sounds" content shape (the original silence)', () => {
    // Pre-fix, the planner with focusNode=letter-sounds emitted
    // "Tap the letter that says /m/." — parser rejected → silent.
    // The fixed planner can't emit this shape (single-mode prompt), but
    // the parser still rejects it as a backstop. Pin the backstop so a
    // future planner regression that re-introduces letter-sounds content
    // triggers a loud parser error instead of silent failure.
    const wire = buildPostFixPlannerWire()
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'word.p1.read'
          ? { ...u, text: 'Tap the letter that says /m/.' }
          : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      PlanFromServerError,
    )
  })

  it('rejects the prod-incident "cvc.*" id namespace (the case-1 silence)', () => {
    // Pre-fix, the no-progress default emitted `cvc.p1.read` etc. —
    // parser's anchored regex skipped them all → bucket map was empty
    // → "missing problem index 1" error. Pin that contract: any
    // non-word.* prefix on a problem utterance is silently dropped, and
    // the resulting empty plan throws a clear missing-problem error
    // (rather than coincidentally succeeding via partial parse).
    const wire = buildPostFixPlannerWire()
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) => ({
        ...u,
        id: u.id.replace(/^word\./, 'cvc.'),
      })),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing problem index 1/,
    )
  })
})

/**
 * Parser widening — ticket 86c9kxp08, planner-parser contract step 1.
 *
 * The browser parser is widened to accept a second content type
 * (`cvc-word`, "Read the <word>." template) in addition to the existing
 * `blending-cv` ("Tap the <word>."). The PLANNER does not emit
 * `cvc-word` content yet — that's step 2. These tests pin the parser
 * surface so when the planner widens later, this side is already proven.
 *
 * See `design/word-song/parser-widening-plan.md` for the full plan and
 * `project_planner_parser_contract` memory for the binding ordering.
 */
describe('parseReadLine — content-type discriminant routing (86c9kxp08)', () => {
  it('routes "Tap the <word>." to contentType: blending-cv', () => {
    const result = parseReadLine('Tap the cat.')
    expect(result.entry.word).toBe('cat')
    expect(result.contentType).toBe('blending-cv')
  })

  it('routes "Read the <word>." to contentType: cvc-word', () => {
    const result = parseReadLine('Read the cat.')
    expect(result.entry.word).toBe('cat')
    expect(result.contentType).toBe('cvc-word')
  })

  it('is case-insensitive on both templates', () => {
    expect(parseReadLine('tap the bat.').contentType).toBe('blending-cv')
    expect(parseReadLine('READ THE BAT.').contentType).toBe('cvc-word')
  })

  it('rejects words outside the target list on both templates', () => {
    // After the short-e promotion (ticket 86c9teua2) flipped `pen` to
    // `isTarget: true`, `DISTRACTOR_ONLY_WORDS` is empty. Use `'ten'`
    // (rejected from the short-e audit §1; not in any vowel pool) as
    // the in-shape non-target.
    expect(() => parseReadLine('Tap the ten.')).toThrow(/non-target word/)
    expect(() => parseReadLine('Read the ten.')).toThrow(/non-target word/)
  })

  it('rejects unrecognised templates with a helpful message', () => {
    expect(() => parseReadLine('Find the cat.')).toThrow(PlanFromServerError)
    expect(() => parseReadLine('Find the cat.')).toThrow(
      /did not match any known template/,
    )
    // Error message should mention BOTH accepted templates so a future
    // dev grepping for the template form discovers both surfaces.
    expect(() => parseReadLine('Find the cat.')).toThrow(/Tap the/)
    expect(() => parseReadLine('Find the cat.')).toThrow(/Read the/)
  })
})

describe('wordSongSessionPlanFromServer — cv-blend fixture (regression)', () => {
  it('parses sample-cv-blend-plan and stamps contentType: blending-cv on every problem', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_CV_BLEND_PLAN)
    expect(plan.id).toBe('haiku-word-cvblend-001')
    expect(plan.problems).toHaveLength(8)
    for (const problem of plan.problems) {
      expect(problem.contentType).toBe('blending-cv')
    }
    // Spot-check the target words round-trip via the wordPack.
    expect(plan.problems.map((p) => p.target.word)).toEqual([
      'cat',
      'hat',
      'bat',
      'mat',
      'bag',
      'fan',
      'man',
      'pan',
    ])
  })
})

describe('wordSongSessionPlanFromServer — cvc-word fixture (new acceptance)', () => {
  it('parses sample-cvc-word-plan and stamps contentType: cvc-word on every problem', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_CVC_WORD_PLAN)
    expect(plan.id).toBe('haiku-word-cvcword-001')
    expect(plan.problems).toHaveLength(8)
    for (const problem of plan.problems) {
      expect(problem.contentType).toBe('cvc-word')
    }
    // Targets resolve to known wordPack entries — same canonical pool.
    expect(plan.problems.map((p) => p.target.word)).toEqual([
      'cat',
      'hat',
      'bat',
      'mat',
      'bag',
      'fan',
      'man',
      'pan',
    ])
    // Read text is preserved verbatim — important for the audio script
    // / on-screen caption mirror principle.
    expect(plan.problems[0]!.utterances.read).toBe('Read the cat.')
  })

  it('rejects a cvc-word entry with a missing target word slot', () => {
    // Drop the read line for problem 1 entirely — the completeness
    // check should surface "missing slot read".
    const broken: typeof SAMPLE_CVC_WORD_PLAN = {
      ...SAMPLE_CVC_WORD_PLAN,
      utterances: SAMPLE_CVC_WORD_PLAN.utterances.filter(
        (u) => u.id !== 'word.p1.read',
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })

  it('rejects a cvc-word entry with type-confused fields', () => {
    // Replace the read line text with a non-string. The shape guard at
    // the top of `wordSongSessionPlanFromServer` rejects the whole blob
    // because the inner utterance no longer matches { id:string, text:string }.
    const broken = {
      ...SAMPLE_CVC_WORD_PLAN,
      utterances: SAMPLE_CVC_WORD_PLAN.utterances.map((u) =>
        u.id === 'word.p1.read'
          ? { id: u.id, text: 12345 as unknown as string }
          : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      PlanFromServerError,
    )
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /server plan did not match/,
    )
  })

  it('rejects a cvc-word entry with a malformed read template', () => {
    // "Show the cat." is neither "Tap the" nor "Read the" — should
    // surface the unknown-template error.
    const broken = {
      ...SAMPLE_CVC_WORD_PLAN,
      utterances: SAMPLE_CVC_WORD_PLAN.utterances.map((u) =>
        u.id === 'word.p1.read' ? { ...u, text: 'Show the cat.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /did not match any known template/,
    )
  })

  it('rejects a cvc-word entry whose word is not in the target pool', () => {
    // Post the short-e promotion (ticket 86c9teua2), `pen` is now
    // `isTarget: true` and `DISTRACTOR_ONLY_WORDS` is empty. Substitute
    // `'ten'` — explicitly rejected from short-e §1 audit (abstract
    // number, no stable noun-form picture) and not in any vowel pool.
    // The membership check is shared across templates by design.
    const broken = {
      ...SAMPLE_CVC_WORD_PLAN,
      utterances: SAMPLE_CVC_WORD_PLAN.utterances.map((u) =>
        u.id === 'word.p1.read' ? { ...u, text: 'Read the ten.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /non-target word "ten"/,
    )
  })
})

/**
 * Letter-names parser widen — Wave 7 A4b (ticket 86c9y6nc7).
 *
 * The browser parser accepts a third content type (`letter-names`,
 * `"Tap the letter <X>."` template). The PLANNER already emits this shape
 * (PR #335 / Wave 7 A3 / ticket 86c9y4960 baked it into
 * `public/canon/word-song/level-1/letter-names.json` and registered it as
 * first-class), but until A4b the browser silently demoted to the
 * blending-cv stub because the parser had no template for it.
 *
 * See `design/word-song/letter-names-content.md` for the spec and
 * `public/canon/word-song/level-1/letter-names.json` for the live canon.
 */
describe('parseReadLine — letter-names content-type routing (Wave 7 A4b, 86c9y6nc7)', () => {
  it('routes "Tap the letter A." to contentType: letter-names', () => {
    const result = parseReadLine('Tap the letter A.')
    expect(result.contentType).toBe('letter-names')
    expect(result.entry.word).toBe('A')
    expect(result.entry.isTarget).toBe(true)
    expect(result.entry.pictureKey).toBe(`${LETTER_GLYPH_PICTURE_KEY_PREFIX}A`)
  })

  it('preserves case on the letter glyph (uppercase A is not the same target as lowercase a)', () => {
    expect(parseReadLine('Tap the letter A.').entry.word).toBe('A')
    expect(parseReadLine('Tap the letter a.').entry.word).toBe('a')
    expect(parseReadLine('Tap the letter A.').entry.pictureKey).toBe(
      `${LETTER_GLYPH_PICTURE_KEY_PREFIX}A`,
    )
    expect(parseReadLine('Tap the letter a.').entry.pictureKey).toBe(
      `${LETTER_GLYPH_PICTURE_KEY_PREFIX}a`,
    )
  })

  it('accepts all 26 uppercase + 26 lowercase ASCII letters (52-glyph pool)', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const result = parseReadLine(`Tap the letter ${letter}.`)
      expect(result.contentType).toBe('letter-names')
      expect(result.entry.word).toBe(letter)
    }
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const result = parseReadLine(`Tap the letter ${letter}.`)
      expect(result.contentType).toBe('letter-names')
      expect(result.entry.word).toBe(letter)
    }
  })

  it('LETTER_GLYPH_POOL contains exactly the 52 ASCII letters and nothing else', () => {
    expect(LETTER_GLYPH_POOL.size).toBe(52)
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') {
      expect(LETTER_GLYPH_POOL.has(letter)).toBe(true)
    }
    // Spot-check a handful of non-letter tokens that the regex would reject
    // anyway, but the pool guard exists in case the regex is ever widened.
    for (const nonLetter of ['1', '0', ' ', '!', 'AA', 'á']) {
      expect(LETTER_GLYPH_POOL.has(nonLetter)).toBe(false)
    }
  })

  it('rejects multi-character tokens via the regex anchor (single letter only)', () => {
    // "Tap the letter AB." — the regex requires a single [A-Za-z] character
    // followed immediately by optional whitespace and `.`. A two-character
    // token does not match the letter-names template AND would also not
    // match `"Tap the <word>."` (blending-cv) because `AB` is not in the
    // wordPack TARGET_WORD_SET. So it falls through to the unrecognised-
    // template error.
    expect(() => parseReadLine('Tap the letter AB.')).toThrow(
      PlanFromServerError,
    )
  })

  it('rejects non-ASCII letter tokens (the pool is ASCII-only)', () => {
    // `á` is not in `LETTER_GLYPH_POOL`. The regex `[A-Za-z]` would also
    // reject it, so this falls through to the unrecognised-template error.
    expect(() => parseReadLine('Tap the letter á.')).toThrow(
      /did not match any known template/,
    )
  })

  it('is case-insensitive on the "Tap the letter" preamble but case-PRESERVING on the captured letter', () => {
    // The regex `/i` flag makes "tap the letter" / "TAP THE LETTER" / etc.
    // valid preambles. The capture group preserves the original letter
    // case so the target chip case is faithful to the read-line.
    expect(parseReadLine('tap the letter X.').entry.word).toBe('X')
    expect(parseReadLine('TAP THE LETTER y.').entry.word).toBe('y')
    expect(parseReadLine('Tap the letter Q.').entry.word).toBe('Q')
  })

  it('the new template is reported in the error message alongside the existing templates', () => {
    // The error message must surface ALL accepted templates so a future
    // dev grepping for the template form discovers all three surfaces.
    expect(() => parseReadLine('Find the cat.')).toThrow(/Tap the letter/)
    expect(() => parseReadLine('Find the cat.')).toThrow(/Tap the/)
    expect(() => parseReadLine('Find the cat.')).toThrow(/Read the/)
  })

  it('letter-names parser does NOT consult the wordPack TARGET_WORD_SET', () => {
    // Letter glyphs are NOT in `wordPack.ts` — the parser must bypass
    // the wordPack lookup entirely for letter-names. This pin guards
    // against a refactor that accidentally routes letter-names through
    // `getWordEntry` (which would throw).
    const result = parseReadLine('Tap the letter q.')
    expect(result.entry.word).toBe('q')
    // The wordPack does not have a `q` entry, but the parser still
    // succeeds — proof the wordPack lookup is bypassed.
    expect(result.entry.pictureKey).toBe(`${LETTER_GLYPH_PICTURE_KEY_PREFIX}q`)
  })
})

describe('wordSongSessionPlanFromServer — letter-names fixture (Wave 7 A4b)', () => {
  it('parses sample-letter-names-plan and stamps contentType: letter-names on every problem', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_LETTER_NAMES_PLAN)
    expect(plan.id).toBe('haiku-word-letter-names-001')
    expect(plan.problems).toHaveLength(8)
    for (const problem of plan.problems) {
      expect(problem.contentType).toBe('letter-names')
    }
    // Targets are single letters case-preserved.
    expect(plan.problems.map((p) => p.target.word)).toEqual([
      'C',
      'e',
      'G',
      'J',
      'O',
      'b',
      'W',
      'd',
    ])
  })

  it('synthesizes a sentinel pictureKey on every letter target (letter:<X>)', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_LETTER_NAMES_PLAN)
    for (const problem of plan.problems) {
      expect(problem.target.pictureKey).toBe(
        `${LETTER_GLYPH_PICTURE_KEY_PREFIX}${problem.target.word}`,
      )
      // isTarget is true so downstream invariants that assume the
      // target is in the target pool continue to hold.
      expect(problem.target.isTarget).toBe(true)
    }
  })

  it('preserves the read text verbatim (audio-script / on-screen-caption mirror)', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_LETTER_NAMES_PLAN)
    expect(plan.problems[0]!.utterances.read).toBe('Tap the letter C.')
    expect(plan.problems[5]!.utterances.read).toBe('Tap the letter b.')
  })

  it('rejects a letter-names entry whose token is outside the 52-glyph pool', () => {
    const broken: typeof SAMPLE_LETTER_NAMES_PLAN = {
      ...SAMPLE_LETTER_NAMES_PLAN,
      utterances: SAMPLE_LETTER_NAMES_PLAN.utterances.map((u) =>
        // `1` is not a letter — the [A-Za-z] anchor in the template
        // rejects it. The error surfaces as "no matching template" rather
        // than "outside the pool" (the regex never matches in the first
        // place).
        u.id === 'word.p1.read' ? { ...u, text: 'Tap the letter 1.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /did not match any known template/,
    )
  })

  it('rejects a letter-names entry with a malformed template', () => {
    // "Read the letter A." is neither "Tap the" / "Tap the letter" / "Read the".
    // The "Read the" template captures `letter` as the WORD (case-insensitive
    // [a-z]+) — which is NOT in `TARGET_WORD_SET` — so the error path goes
    // through non-target word rather than no-template. Both are legitimate
    // rejections; pin the one that fires.
    const broken: typeof SAMPLE_LETTER_NAMES_PLAN = {
      ...SAMPLE_LETTER_NAMES_PLAN,
      utterances: SAMPLE_LETTER_NAMES_PLAN.utterances.map((u) =>
        u.id === 'word.p1.read' ? { ...u, text: 'Show the letter A.' } : u,
      ),
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /did not match any known template/,
    )
  })
})

/**
 * Back-compat regression — letter-names addition must NOT shadow the
 * existing word-tier templates. The `"Tap the letter <X>."` template is
 * a strict refinement of `"Tap the <word>."` (the latter would
 * greedy-match `"letter"` as the word) — verify the template ordering in
 * `READ_LINE_TEMPLATES` keeps the word-tier templates working for every
 * CVC target the wordPack carries.
 */
describe('parseReadLine — letter-names template does NOT shadow word-tier templates (back-compat)', () => {
  it('still routes "Tap the cat." to contentType: blending-cv', () => {
    expect(parseReadLine('Tap the cat.').contentType).toBe('blending-cv')
    expect(parseReadLine('Tap the cat.').entry.word).toBe('cat')
  })

  it('still routes "Read the cat." to contentType: cvc-word', () => {
    expect(parseReadLine('Read the cat.').contentType).toBe('cvc-word')
    expect(parseReadLine('Read the cat.').entry.word).toBe('cat')
  })

  it('still rejects non-target words on word-tier templates', () => {
    expect(() => parseReadLine('Tap the ten.')).toThrow(/non-target word/)
    expect(() => parseReadLine('Read the ten.')).toThrow(/non-target word/)
  })

  it('parses every CVC target word in the pack via the blending-cv template', () => {
    for (const word of [
      'cat',
      'hat',
      'bat',
      'mat',
      'bag',
      'fan',
      'man',
      'pan',
    ]) {
      const result = parseReadLine(`Tap the ${word}.`)
      expect(result.contentType).toBe('blending-cv')
      expect(result.entry.word).toBe(word)
    }
  })
})

describe('wordSongSessionPlanFromServer — mixed cv-blend + cvc-word (sanity)', () => {
  it('routes per-problem contentType correctly within a single plan', () => {
    const plan = wordSongSessionPlanFromServer(SAMPLE_MIXED_PLAN)
    expect(plan.problems).toHaveLength(8)
    // First 4 problems use "Tap the" → blending-cv.
    for (const problem of plan.problems.slice(0, 4)) {
      expect(problem.contentType).toBe('blending-cv')
    }
    // Last 4 problems use "Read the" → cvc-word.
    for (const problem of plan.problems.slice(4)) {
      expect(problem.contentType).toBe('cvc-word')
    }
    // Every target still resolves cleanly via the wordPack.
    expect(plan.problems.map((p) => p.target.word)).toEqual([
      'cat',
      'hat',
      'bat',
      'mat',
      'bag',
      'fan',
      'man',
      'pan',
    ])
  })
})
