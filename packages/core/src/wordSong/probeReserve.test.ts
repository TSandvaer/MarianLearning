/**
 * The cvc-words probe reserve (Dave 2026-10-24, msg_135871ebd91e and
 * msg_cb57033a73c9; `design/research/no-claude-variety-2026-10-23.md`
 * § 2.4): each attempt chooses its 6 of 8 words once, by tier (never met,
 * met only in Letter Critters, last check right, last check missed with the
 * oldest miss first), ties in reserve order; two sessions of 3.
 */
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { wordSeenKey } from '../progress/seenItems'
import type {
  Progress,
  SeenItems,
  SessionHistoryEntry,
} from '../progress/types'
import { PROBE_RESERVE_WORDS } from './novelProbeWords'
import {
  GRADUATION_CHECK_WORDS,
  chooseCheckWords,
  graduationCheckWords,
  probeStanding,
  remainingCheckWords,
  reserveCheckReady,
  reserveCheckWords,
} from './probeReserve'

const met = (day = '2026-10-20') => ({ day, count: 1, correct: null })
const checked = (check: 'right' | 'missed', checkDay = '2026-10-21') => ({
  day: checkDay,
  count: 1,
  correct: check === 'right',
  check,
  checkDay,
})
const seenOf = (records: Record<string, object>): SeenItems =>
  Object.fromEntries(
    Object.entries(records).map(([w, r]) => [wordSeenKey(w), r]),
  ) as SeenItems

const entry = (
  extra: Partial<SessionHistoryEntry> = {},
): SessionHistoryEntry => ({
  dateISO: '2026-10-24T09:00:00.000Z',
  skillFocus: ['cvc-words'],
  successRate: 1,
  ...extra,
})
const progressWith = (
  seen: SeenItems,
  history: SessionHistoryEntry[] = [],
): Progress => ({ ...defaultProgress(), seenItems: seen, history })

describe('the reserve', () => {
  it('is Dave’s 8 words: map, nap and rat kept, tap dropped, 5 new', () => {
    expect(PROBE_RESERVE_WORDS).toEqual([
      'map',
      'nap',
      'rat',
      'ham',
      'cab',
      'rag',
      'ram',
      'pad',
    ])
    expect(GRADUATION_CHECK_WORDS).toBe(6)
  })
})

describe('probeStanding', () => {
  it('reads the word’s seen-record: none, met, last check right, last check missed; a newer value counts as met', () => {
    const seen = seenOf({
      ham: met(),
      cab: checked('right'),
      rag: checked('missed'),
      ram: { ...met(), check: 'skipped' },
    })
    expect(probeStanding(seen, 'map')).toBe('new')
    expect(probeStanding(seen, 'ham')).toBe('met')
    expect(probeStanding(seen, 'cab')).toBe('right')
    expect(probeStanding(seen, 'rag')).toBe('missed')
    expect(probeStanding(seen, 'ram')).toBe('met')
  })
})

describe('chooseCheckWords (Dave’s ruling, msg_cb57033a73c9)', () => {
  it('tier 1, never met: in reserve order (a learner who met none gets the first 6)', () => {
    expect(chooseCheckWords({})).toEqual([
      'map',
      'nap',
      'rat',
      'ham',
      'cab',
      'rag',
    ])
  })

  it('tier 2, met only in Letter Critters, after every never-met word', () => {
    const seen = seenOf({ map: met(), nap: met(), rat: met() })
    expect(chooseCheckWords(seen)).toEqual([
      'ham',
      'cab',
      'rag',
      'ram',
      'pad',
      'map',
    ])
  })

  it('tier 3, last check right, after tier 2; ties keep reserve order', () => {
    const seen = seenOf({
      map: checked('right'),
      nap: met(),
      rat: checked('right'),
      ham: met(),
      cab: met(),
      rag: met(),
      ram: met(),
    })
    expect(chooseCheckWords(seen)).toEqual([
      'pad',
      'nap',
      'ham',
      'cab',
      'rag',
      'ram',
    ])
    const rights = seenOf({
      map: checked('right'),
      nap: checked('right'),
      rat: checked('right'),
      ham: checked('right'),
      cab: checked('right'),
      rag: checked('right'),
      ram: checked('right'),
      pad: checked('right'),
    })
    expect(chooseCheckWords(rights)).toEqual(PROBE_RESERVE_WORDS.slice(0, 6))
  })

  it('tier 4, last check missed, only when tiers 1-3 hold fewer than 6: the oldest most-recent miss first', () => {
    const seen = seenOf({
      map: checked('missed', '2026-10-22'),
      nap: checked('missed', '2026-10-10'),
      rat: checked('missed', '2026-10-22'),
      ham: checked('missed', '2026-10-15'),
      cab: checked('right'),
      rag: checked('right'),
    })
    expect(chooseCheckWords(seen)).toEqual([
      'ram',
      'pad',
      'cab',
      'rag',
      'nap',
      'ham',
    ])
    // Same miss day: reserve order.
    const sameDay = seenOf({
      map: checked('missed', '2026-10-22'),
      nap: checked('right'),
      rat: checked('missed', '2026-10-22'),
      ham: checked('right'),
      cab: checked('missed', '2026-10-22'),
      rag: checked('right'),
      ram: checked('right'),
      pad: checked('missed', '2026-10-22'),
    })
    expect(chooseCheckWords(sameDay)).toEqual([
      'nap',
      'ham',
      'rag',
      'ram',
      'map',
      'rat',
    ])
  })

  it('a missed word later read right is tier 3 again (the most recent result counts)', () => {
    const seen = seenOf({
      map: checked('right', '2026-10-24'),
      nap: met(),
      rat: met(),
      ham: met(),
      cab: met(),
      rag: met(),
      ram: met(),
      pad: met(),
    })
    expect(chooseCheckWords(seen).at(-1)).toBe('ram')
    expect(chooseCheckWords(seen)).not.toContain('map')
  })

  it('a retake after a check with 2 misses: 2 fresh words plus 4 she read right', () => {
    const seen = seenOf({
      map: checked('right'),
      nap: checked('missed'),
      rat: checked('right'),
      ham: checked('right'),
      cab: checked('missed'),
      rag: checked('right'),
    })
    expect(chooseCheckWords(seen)).toEqual([
      'ram',
      'pad',
      'map',
      'rat',
      'ham',
      'rag',
    ])
  })

  it('a second failed retake: still 6 words, the oldest misses come back', () => {
    const seen = seenOf({
      map: checked('missed', '2026-10-28'),
      nap: checked('missed', '2026-10-21'),
      rat: checked('right'),
      ham: checked('missed', '2026-10-28'),
      cab: checked('missed', '2026-10-21'),
      rag: checked('right'),
      ram: checked('right'),
      pad: checked('right'),
    })
    expect(chooseCheckWords(seen)).toEqual([
      'rat',
      'rag',
      'ram',
      'pad',
      'nap',
      'cab',
    ])
  })
})

describe('reserveCheckWords and remainingCheckWords: the attempt is chosen once', () => {
  it('a new attempt: the first 3 of the 6; the session end keeps the other 3', () => {
    expect(reserveCheckWords(progressWith({}), 'cvc-words')).toEqual([
      'map',
      'nap',
      'rat',
    ])
    expect(remainingCheckWords({}, ['map', 'nap', 'rat'])).toEqual([
      'ham',
      'cab',
      'rag',
    ])
  })

  it('the second session serves the 3 chosen at the start, whatever the first session’s results did to the ranking', () => {
    const afterFirst = seenOf({
      map: checked('missed', '2026-10-24'),
      nap: checked('missed', '2026-10-24'),
      rat: checked('missed', '2026-10-24'),
    })
    const first = entry({
      novelPoolPart: {
        words: ['map', 'nap', 'rat'],
        correct: 0,
        next: ['ham', 'cab', 'rag'],
      },
    })
    expect(
      reserveCheckWords(progressWith(afterFirst, [first]), 'cvc-words'),
    ).toEqual(['ham', 'cab', 'rag'])
  })

  it('a part record without next: a fresh choice minus the words shown', () => {
    const first = entry({
      novelPoolPart: { words: ['map', 'nap', 'rat'], correct: 3 },
    })
    expect(reserveCheckWords(progressWith({}, [first]), 'cvc-words')).toEqual([
      'ham',
      'cab',
      'rag',
    ])
  })

  it('a part record on another step, under a later session, or malformed, is no first half', () => {
    const part = {
      words: ['map', 'nap', 'rat'],
      correct: 3,
      next: ['ram', 'pad', 'ham'],
    }
    for (const history of [
      [entry({ skillFocus: ['cvc-words-short-o'], novelPoolPart: part })],
      [entry({ novelPoolPart: part }), entry()],
      [
        entry({
          novelPoolPart: { words: 'map' } as unknown as typeof part,
        }),
      ],
    ]) {
      expect(reserveCheckWords(progressWith({}, history), 'cvc-words')).toEqual(
        ['map', 'nap', 'rat'],
      )
    }
  })

  it('a doc without the seen-record (older builds, the web) ranks as never met', () => {
    const p: Progress = { ...defaultProgress(), history: [] }
    expect(reserveCheckWords(p, 'cvc-words')).toEqual(['map', 'nap', 'rat'])
  })
})

describe('graduationCheckWords: no unrendered word is ever served', () => {
  const TODAY = new Set(['nap', 'rat', 'map', 'tap'])
  const ALL = new Set([...TODAY, ...PROBE_RESERVE_WORDS])
  const failedChecks = (n: number) =>
    Array.from({ length: n }, () => entry({ novelPoolSuccessRate: 0.5 }))

  it('the reserve waits for all 8 words’ audio', () => {
    expect(reserveCheckReady(TODAY)).toBe(false)
    expect(reserveCheckReady(new Set([...PROBE_RESERVE_WORDS]))).toBe(true)
    expect(
      reserveCheckReady(
        new Set(PROBE_RESERVE_WORDS.filter((w) => w !== 'pad')),
      ),
    ).toBe(false)
  })

  it('until then: today’s check, three of nap, rat, map and tap by attempt', () => {
    expect(graduationCheckWords(progressWith({}), 'cvc-words', TODAY)).toEqual([
      'nap',
      'rat',
      'map',
    ])
    expect(
      graduationCheckWords(
        progressWith({}, failedChecks(1)),
        'cvc-words',
        TODAY,
      ),
    ).toEqual(['rat', 'map', 'tap'])
  })

  it('every attempt and seen-record, with today’s audio: only rendered words', () => {
    const seen = seenOf({ ham: met(), cab: checked('missed'), map: met() })
    for (const progress of [progressWith({}), progressWith(seen)]) {
      for (let n = 0; n < 6; n++) {
        const p = { ...progress, history: failedChecks(n) }
        const words = graduationCheckWords(p, 'cvc-words', TODAY)
        expect(words).toHaveLength(3)
        for (const w of words!) expect(TODAY.has(w)).toBe(true)
      }
    }
  }, 30_000)

  it('with every word rendered: the reserve check', () => {
    expect(graduationCheckWords(progressWith({}), 'cvc-words', ALL)).toEqual([
      'map',
      'nap',
      'rat',
    ])
  })

  it('one reserve word without audio keeps today’s check; a pick with an unrendered word is no check', () => {
    const noPad = new Set([...ALL].filter((w) => w !== 'pad'))
    expect(graduationCheckWords(progressWith({}), 'cvc-words', noPad)).toEqual([
      'nap',
      'rat',
      'map',
    ])
    const noMap = new Set([...TODAY].filter((w) => w !== 'map'))
    expect(
      graduationCheckWords(progressWith({}), 'cvc-words', noMap),
    ).toBeUndefined()
  })
})
