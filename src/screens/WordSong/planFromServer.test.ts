import { describe, expect, it } from 'vitest'
import {
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
