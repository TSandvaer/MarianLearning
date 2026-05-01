import { describe, expect, it } from 'vitest'
import {
  PlanFromServerError,
  parseReadTarget,
  wordSongSessionPlanFromServer,
} from './planFromServer'
import {
  STATIC_WORD_SONG_PLANS,
  wordSongSessionPlanToUtteranceSources,
} from './wordSessionPlans'

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
    expect(() => parseReadTarget('Tap the bus.')).toThrow(/non-target word/)
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
        u.id === 'word.p1.read' ? { ...u, text: 'Tap the bus.' } : u,
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
