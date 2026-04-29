import { describe, expect, it } from 'vitest'
import {
  STATIC_WORD_SONG_PLANS,
  pickStaticWordSongPlan,
  wordSongSessionPlanFromWire,
  wordSongSessionPlanToUtteranceSources,
  wordSongUtteranceId,
  type WordSongSessionPlan,
  type WordSongUtteranceSlot,
} from './wordSessionPlans'
import type { Utterance } from '../../../api/_types'

const ALL_SLOTS: readonly WordSongUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

function fakeUtterance(id: string, text: string): Utterance {
  return {
    id,
    text,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

describe('wordSongUtteranceId', () => {
  it('matches the spec id template `word.p{N}.{slot}`', () => {
    expect(wordSongUtteranceId(1, 'read')).toBe('word.p1.read')
    expect(wordSongUtteranceId(8, 'giveAnswer')).toBe('word.p8.giveAnswer')
  })
})

describe('STATIC_WORD_SONG_PLANS', () => {
  it('every plan has exactly 8 problems', () => {
    for (const plan of STATIC_WORD_SONG_PLANS) {
      expect(plan.problems).toHaveLength(8)
    }
  })

  it('every problem has a target word and the 5 utterance lines', () => {
    for (const plan of STATIC_WORD_SONG_PLANS) {
      for (let i = 0; i < plan.problems.length; i++) {
        const p = plan.problems[i]
        expect(p.index).toBe(i + 1)
        expect(p.target.word).toMatch(/^[a-z]{3,4}$/)
        expect(p.target.isTarget).toBe(true)
        expect(p.utterances.read).toMatch(/^Tap the .+\.$/)
        expect(p.utterances.correct).toMatch(/^Yes! .+\.$/)
        expect(p.utterances.reprompt).toBe('Hmm... try again?')
        expect(p.utterances.hint).toMatch(/^Let's look\. .+\.$/)
        expect(p.utterances.giveAnswer).toMatch(/^This one is .+\.$/)
      }
    }
  })

  it('no plan repeats a target word within itself', () => {
    for (const plan of STATIC_WORD_SONG_PLANS) {
      const words = plan.problems.map((p) => p.target.word)
      expect(new Set(words).size).toBe(words.length)
    }
  })

  it("captioned utterances stay within the spec's vocabulary cap", () => {
    // Per CLAUDE.md "Emma's vocabulary capped to ~200 core English words".
    // We can\'t enforce a 200-word global vocabulary here without a list,
    // but we can confirm Word Song doesn\'t introduce utterance shapes
    // outside the spec\'s sample text. Check that the utterance text uses
    // only the spec-mandated phrases plus a target word.
    for (const plan of STATIC_WORD_SONG_PLANS) {
      for (const p of plan.problems) {
        // Read template: "Tap the {word}."
        expect(p.utterances.read).toBe(`Tap the ${p.target.word}.`)
        // Correct: "Yes! {Word}."
        const Word = p.target.word[0].toUpperCase() + p.target.word.slice(1)
        expect(p.utterances.correct).toBe(`Yes! ${Word}.`)
        // Hint: "Let's look. {Word}." (Kyle\'s spec sample)
        expect(p.utterances.hint).toBe(`Let's look. ${Word}.`)
        // Give-answer: "This one is {word}." (Kyle's spec sample)
        expect(p.utterances.giveAnswer).toBe(`This one is ${p.target.word}.`)
      }
    }
  })
})

describe('pickStaticWordSongPlan', () => {
  it('rotates through the static plans by minute', () => {
    const minute0 = new Date(0)
    const minute1 = new Date(60_000)
    const minute2 = new Date(120_000)
    const minute3 = new Date(180_000)

    const p0 = pickStaticWordSongPlan(() => minute0)
    const p1 = pickStaticWordSongPlan(() => minute1)
    const p2 = pickStaticWordSongPlan(() => minute2)
    const p3 = pickStaticWordSongPlan(() => minute3)

    expect(p0.id).not.toBe(p1.id)
    expect(p1.id).not.toBe(p2.id)
    // p3 should wrap back to p0 (3 plans in rotation).
    expect(p3.id).toBe(p0.id)
  })

  it('is deterministic for the same minute', () => {
    const t = new Date(1_000_000_000_000)
    expect(pickStaticWordSongPlan(() => t).id).toBe(
      pickStaticWordSongPlan(() => t).id,
    )
  })
})

describe('wordSongSessionPlanToUtteranceSources', () => {
  it('emits exactly 8 problems × 5 slots = 40 utterance sources', () => {
    const plan = STATIC_WORD_SONG_PLANS[0]
    const sources = wordSongSessionPlanToUtteranceSources(plan)
    expect(sources).toHaveLength(8 * 5)
  })

  it('order is problem-major then slot-order', () => {
    const plan = STATIC_WORD_SONG_PLANS[0]
    const sources = wordSongSessionPlanToUtteranceSources(plan)
    let cursor = 0
    for (const problem of plan.problems) {
      for (const slot of ALL_SLOTS) {
        expect(sources[cursor].id).toBe(
          wordSongUtteranceId(problem.index, slot),
        )
        expect(sources[cursor].text).toBe(problem.utterances[slot])
        cursor++
      }
    }
  })
})

describe('wordSongSessionPlanFromWire', () => {
  it('rebuilds the plan from utterances by id', () => {
    const skeleton = STATIC_WORD_SONG_PLANS[0]
    const sources = wordSongSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) => fakeUtterance(s.id, s.text))

    const rebuilt = wordSongSessionPlanFromWire(skeleton, utterances)
    expect(rebuilt.id).toBe(skeleton.id)
    expect(rebuilt.problems).toHaveLength(skeleton.problems.length)
    for (let i = 0; i < rebuilt.problems.length; i++) {
      const r = rebuilt.problems[i]
      const orig = skeleton.problems[i]
      expect(r.target.word).toBe(orig.target.word)
      for (const slot of ALL_SLOTS) {
        expect(r.utterances[slot]).toBe(orig.utterances[slot])
      }
    }
  })

  it('lets server text win over skeleton text', () => {
    const skeleton = STATIC_WORD_SONG_PLANS[0]
    const sources = wordSongSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) =>
      fakeUtterance(s.id, `[modified] ${s.text}`),
    )
    const rebuilt = wordSongSessionPlanFromWire(skeleton, utterances)
    for (const problem of rebuilt.problems) {
      for (const slot of ALL_SLOTS) {
        expect(problem.utterances[slot]).toMatch(/^\[modified\] /)
      }
    }
  })

  it('throws when an expected utterance is missing', () => {
    const skeleton = STATIC_WORD_SONG_PLANS[0]
    const sources = wordSongSessionPlanToUtteranceSources(skeleton)
    // Drop one utterance.
    const utterances = sources
      .slice(0, -1)
      .map((s) => fakeUtterance(s.id, s.text))
    expect(() => wordSongSessionPlanFromWire(skeleton, utterances)).toThrow(
      /missing utterance/,
    )
  })

  it('plans built from wire round-trip cleanly', () => {
    // From-wire then to-wire then from-wire again should yield a plan
    // with the same ids + texts.
    const skeleton = STATIC_WORD_SONG_PLANS[1]
    const sources = wordSongSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) => fakeUtterance(s.id, s.text))
    const round1 = wordSongSessionPlanFromWire(skeleton, utterances)
    const sources2 = wordSongSessionPlanToUtteranceSources(round1)
    expect(sources2).toEqual(sources)
  })
})

// Smoke: every plan in the rotation can be flattened + rebuilt.
describe('round-trip every static plan', () => {
  for (const plan of STATIC_WORD_SONG_PLANS) {
    it(`plan ${plan.id} round-trips through the wire shape`, () => {
      const sources = wordSongSessionPlanToUtteranceSources(plan)
      const utterances = sources.map((s) => fakeUtterance(s.id, s.text))
      const rebuilt: WordSongSessionPlan = wordSongSessionPlanFromWire(
        plan,
        utterances,
      )
      expect(rebuilt.problems).toHaveLength(plan.problems.length)
    })
  }
})
