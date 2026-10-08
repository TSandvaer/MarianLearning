import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetSessionStartTimingsForTests,
  isPrefetchStale,
  markSessionScreenShown,
  markSessionStartBegin,
  markSessionStartSettled,
  prefetchTrackFor,
  summarizeTiming,
  useHubSessionPrefetch,
  type SessionStartTiming,
} from './hubSessionPrefetch'
import {
  emptySessionHistory,
  SESSION_HISTORY_KEY,
} from '@marian/core/sessionEnd/sessionHistory'

describe('prefetchTrackFor', () => {
  it('maps the Hub suggestion to a track; no suggestion keeps the Word Song pre-warm', () => {
    expect(prefetchTrackFor('number-garden')).toBe('math')
    expect(prefetchTrackFor('word-song')).toBe('word-song')
    expect(prefetchTrackFor(null)).toBe('word-song')
  })
})

describe('useHubSessionPrefetch', () => {
  beforeEach(() => window.localStorage.clear())

  it('is null off-Hub', () => {
    const { result } = renderHook(() => useHubSessionPrefetch(false))
    expect(result.current).toBeNull()
  })

  it('follows the Hub suggestion (alternation from lastSuggestion)', () => {
    window.localStorage.setItem(
      SESSION_HISTORY_KEY,
      JSON.stringify({ ...emptySessionHistory(), lastSuggestion: 'word-song' }),
    )
    const { result } = renderHook(() => useHubSessionPrefetch(true))
    expect(result.current).toBe('math')
  })

  it('both worlds touched today → no suggestion → Word Song', () => {
    const now = new Date(2026, 9, 5, 9)
    window.localStorage.setItem(
      SESSION_HISTORY_KEY,
      JSON.stringify({
        ...emptySessionHistory(),
        todayTreesTouched: {
          date: '2026-10-05',
          trees: ['number-garden', 'word-song'],
        },
      }),
    )
    const { result } = renderHook(() => useHubSessionPrefetch(true, () => now))
    expect(result.current).toBe('word-song')
  })
})

describe('isPrefetchStale', () => {
  it('is stale when the focus node or mode changed', () => {
    const a = { node: 'add-to-10', mode: 'forward' }
    expect(isPrefetchStale(a, { ...a })).toBe(false)
    expect(isPrefetchStale(a, { node: 'add-to-20', mode: 'forward' })).toBe(
      true,
    )
    expect(isPrefetchStale(a, { node: 'add-to-10', mode: 'cvc-review' })).toBe(
      true,
    )
  })
})

describe('session-start timing', () => {
  afterEach(() => {
    _resetSessionStartTimingsForTests()
    vi.restoreAllMocks()
  })

  it('splits fetch time into hidden (Hub dwell) and visible wait', () => {
    const t: SessionStartTiming = {
      track: 'math',
      origin: 'hub',
      startedAt: 1000,
      shownAt: 4000,
      settledAt: 9000,
    }
    expect(summarizeTiming(t)).toEqual({
      fetchMs: 8000,
      dwellMs: 3000,
      visibleWaitMs: 5000,
      hiddenMs: 3000,
    })
    // Settled before the tap → the whole fetch was hidden.
    expect(summarizeTiming({ ...t, settledAt: 2500 })).toMatchObject({
      visibleWaitMs: 0,
      hiddenMs: 1500,
    })
    expect(summarizeTiming({ ...t, settledAt: undefined })).toBeUndefined()
  })

  it('publishes one record per request on window and logs once complete', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    markSessionStartBegin('math', 'hub')
    markSessionStartSettled('math', 'resolve', false)
    markSessionScreenShown('math')
    markSessionScreenShown('math') // idempotent
    const list = (
      window as unknown as { __sessionStartTimings: SessionStartTiming[] }
    ).__sessionStartTimings
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ origin: 'hub', outcome: 'resolve' })
    expect(info).toHaveBeenCalledTimes(1)
    expect(String(info.mock.calls[0]![0])).toContain(
      '[session-start] math origin=hub',
    )
  })
})
