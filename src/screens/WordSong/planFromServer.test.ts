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

  it('throws when an utterance id misses the word.p<N>.<slot> template', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: [
        { id: 'word.p1.notaslot', text: 'x' },
        ...wire.utterances.slice(1),
      ],
    }
    expect(() => wordSongSessionPlanFromServer(broken)).toThrow(
      /word\.p<N>\.<slot>/,
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
