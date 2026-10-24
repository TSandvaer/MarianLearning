/**
 * The cvc-words probe reserve (Dave 2026-10-24, msg_135871ebd91e;
 * `design/research/no-claude-variety-2026-10-23.md` § 2.4): per learner,
 * the best 6 of 8 words across two check sessions, ranked never met, then
 * met only in Letter Critters, then read right in a check; never a word
 * missed in a check while 6 others remain (coordinator 2026-10-24).
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
  graduationCheckWords,
  probeStanding,
  rankProbeReserve,
  readmitMissedWords,
  reserveCheckReady,
  reserveCheckWords,
} from './probeReserve'

const met = (day = '2026-10-20') => ({ day, count: 1, correct: null })
const checked = (check: 'right' | 'missed', day = '2026-10-21') => ({
  day,
  count: 1,
  correct: check === 'right',
  check,
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
  it('reads the word’s seen-record: none, met, right, missed; a newer value counts as met', () => {
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

describe('rankProbeReserve', () => {
  it('a learner who met none: Dave’s order', () => {
    expect(rankProbeReserve({})).toEqual(PROBE_RESERVE_WORDS)
  })

  it('never met first, then met only in Critters, then read right; a missed word is left out', () => {
    const seen = seenOf({
      map: met(),
      nap: met(),
      rat: checked('right'),
      ham: checked('missed'),
      cab: met(),
    })
    expect(rankProbeReserve(seen)).toEqual([
      'rag',
      'ram',
      'pad',
      'map',
      'nap',
      'cab',
      'rat',
    ])
  })
})

describe('readmitMissedWords (the rule when fewer than 6 remain; coordinator 2026-10-24, Dave asked)', () => {
  it('6 or more eligible: the ranking as it is, no missed word', () => {
    const seen = seenOf({ ham: checked('missed'), cab: checked('missed') })
    const ranked = rankProbeReserve(seen)
    expect(ranked).toHaveLength(6)
    expect(readmitMissedWords(ranked, PROBE_RESERVE_WORDS, seen, 6)).toEqual(
      ranked,
    )
  })

  it('fewer than 6: missed words come back after the ranked ones, the one met longest ago first', () => {
    const seen = seenOf({
      map: checked('missed', '2026-10-22'),
      nap: checked('missed', '2026-10-10'),
      rat: checked('missed', '2026-10-22'),
      ham: checked('missed', '2026-10-15'),
      cab: checked('right'),
      rag: checked('right'),
    })
    const ranked = rankProbeReserve(seen)
    expect(ranked).toEqual(['ram', 'pad', 'cab', 'rag'])
    expect(readmitMissedWords(ranked, PROBE_RESERVE_WORDS, seen, 6)).toEqual([
      'ram',
      'pad',
      'cab',
      'rag',
      'nap',
      'ham',
    ])
  })
})

describe('reserveCheckWords', () => {
  it('a first check: the best 3 of the best 6', () => {
    expect(reserveCheckWords(progressWith({}), 'cvc-words')).toEqual([
      'map',
      'nap',
      'rat',
    ])
    const seen = seenOf({ map: met(), nap: met(), rat: met(), ham: met() })
    expect(reserveCheckWords(progressWith(seen), 'cvc-words')).toEqual([
      'cab',
      'rag',
      'ram',
    ])
  })

  it('the check’s second session: the best 3 not shown in the first (its part record)', () => {
    const seen = seenOf({
      map: checked('right', '2026-10-24'),
      nap: checked('missed', '2026-10-24'),
      rat: checked('right', '2026-10-24'),
    })
    const first = entry({
      successRate: 1,
      novelPoolPart: { words: ['map', 'nap', 'rat'], correct: 2 },
    })
    expect(reserveCheckWords(progressWith(seen, [first]), 'cvc-words')).toEqual(
      ['ham', 'cab', 'rag'],
    )
  })

  it('a retake after a failed check (2 missed): 2 fresh words plus 4 she read right', () => {
    const seen = seenOf({
      map: checked('right'),
      nap: checked('missed'),
      rat: checked('right'),
      ham: checked('right'),
      cab: checked('missed'),
      rag: checked('right'),
    })
    const failed = entry({ novelPoolSuccessRate: 4 / 6 })
    const p = progressWith(seen, [failed, entry(), entry(), entry()])
    const firstHalf = reserveCheckWords(p, 'cvc-words')!
    expect(firstHalf).toEqual(['ram', 'pad', 'map'])
    const second = reserveCheckWords(
      progressWith(seen, [
        ...p.history,
        entry({ novelPoolPart: { words: firstHalf, correct: 3 } }),
      ]),
      'cvc-words',
    )
    expect(second).toEqual(['rat', 'ham', 'rag'])
  })

  it('a second failed retake: the check is still 6 words (the readmit rule), never stuck', () => {
    const seen = seenOf({
      map: checked('missed'),
      nap: checked('missed'),
      rat: checked('right'),
      ham: checked('missed'),
      cab: checked('missed'),
      rag: checked('right'),
      ram: checked('right'),
      pad: checked('right'),
    })
    const words = reserveCheckWords(progressWith(seen), 'cvc-words')
    expect(words).toEqual(['rat', 'rag', 'ram'])
    const second = reserveCheckWords(
      progressWith(seen, [
        entry({ novelPoolPart: { words: words!, correct: 3 } }),
      ]),
      'cvc-words',
    )
    expect(second).toHaveLength(3)
    expect(second![0]).toBe('pad')
  })

  it('a part record on another step, or under a later session, is not this check’s first half', () => {
    const part = { words: ['map', 'nap', 'rat'], correct: 3 }
    const otherStep = entry({
      skillFocus: ['cvc-words-short-o'],
      novelPoolPart: part,
    })
    expect(
      reserveCheckWords(progressWith({}, [otherStep]), 'cvc-words'),
    ).toEqual(['map', 'nap', 'rat'])
    const broken = [entry({ novelPoolPart: part }), entry()]
    expect(reserveCheckWords(progressWith({}, broken), 'cvc-words')).toEqual([
      'map',
      'nap',
      'rat',
    ])
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
