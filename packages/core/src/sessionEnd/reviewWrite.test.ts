/**
 * `recordReviewOnSessionEnd` — a same-day review's Session End write
 * (native spec `design/native/review-mode-and-warmup-native.md` § 7.5,
 * AC 8): Leitner and `profile.lastPlayedISO` change, one save, one cloud
 * push; history, good days and skill levels stay byte-identical.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() =>
  vi.fn<(deviceId: string, progress: unknown) => Promise<'skipped'>>(() =>
    Promise.resolve('skipped'),
  ),
)
vi.mock('../progress/cloudSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../progress/cloudSync')>()),
  pushProgressToCloud: push,
}))

import { progressAtStep } from '../debug/stepProgress'
import { loadProgress, saveProgress, type Progress } from '../progress'
import { recordReviewOnSessionEnd } from './progressHistory'

const DATE = '2026-10-13T16:00:00.000Z'

function seeded(): Progress {
  const p = progressAtStep('sub-to-10')
  return {
    ...p,
    history: [
      {
        dateISO: '2026-10-13T07:00:00.000Z',
        skillFocus: ['sub-to-10'],
        successRate: 0.875,
      },
    ],
    goodDays: { 'add-to-10': ['2026-10-01', '2026-10-02', '2026-10-03'] },
    mathFactsLeitner: {
      items: [
        { item: { a: 9, b: 2, op: '+' }, box: 2, lastSeen: 0 },
        { item: { a: 1, b: 2, op: '+' }, box: 3, lastSeen: 0 },
      ],
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
  push.mockClear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('recordReviewOnSessionEnd', () => {
  it('AC8: history, goodDays and skillLevels byte-identical; Leitner + lastPlayedISO updated; one push', () => {
    saveProgress(seeded())
    const before = loadProgress()!
    const result = recordReviewOnSessionEnd({
      surface: 'math',
      dateISO: DATE,
      leitnerOutcomes: [
        { fact: { a: 9, b: 2, op: '+' }, correct: true },
        { fact: { a: 1, b: 2, op: '+' }, correct: false },
        { fact: { a: 6, b: 6, op: '+' }, correct: true },
      ],
    })
    const after = loadProgress()!
    expect(after).toEqual(result)
    expect(JSON.stringify(after.history)).toBe(JSON.stringify(before.history))
    expect(JSON.stringify(after.goodDays)).toBe(JSON.stringify(before.goodDays))
    expect(JSON.stringify(after.skillLevels)).toBe(
      JSON.stringify(before.skillLevels),
    )
    expect(after.profile.lastPlayedISO).toBe(DATE)
    const seen = new Date(DATE).getTime()
    expect(after.mathFactsLeitner.items).toEqual([
      { item: { a: 9, b: 2, op: '+' }, box: 3, lastSeen: seen },
      { item: { a: 1, b: 2, op: '+' }, box: 1, lastSeen: seen },
      { item: { a: 6, b: 6, op: '+' }, box: 2, lastSeen: seen },
    ])
    expect(push).toHaveBeenCalledTimes(1)
    expect(push.mock.calls[0]![1]).toEqual(after)
  })

  it('Word Song: no Leitner change, still stamps lastPlayedISO and pushes once', () => {
    saveProgress(seeded())
    const before = loadProgress()!
    recordReviewOnSessionEnd({ surface: 'word-song', dateISO: DATE })
    const after = loadProgress()!
    expect(after.mathFactsLeitner).toEqual(before.mathFactsLeitner)
    expect(after.history).toEqual(before.history)
    expect(after.profile.lastPlayedISO).toBe(DATE)
    expect(push).toHaveBeenCalledTimes(1)
  })
})
