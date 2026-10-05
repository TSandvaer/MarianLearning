/**
 * Emma's Path 2/10 (123jpnbc3dj) — Hub prefetch of the suggested world's
 * session. App-level wiring: which request the Hub starts, reuse on tap
 * (no double request), stale discard, abort when the other world is
 * picked, and adoption by the 1/10 visible-wait timer.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptySessionHistory,
  SESSION_HISTORY_KEY as HISTORY_KEY,
} from './screens/SessionEnd/sessionHistory'
import { defaultProgress } from './lib/progress/defaults'
import { STORAGE_KEY as PROGRESS_KEY } from './lib/progress/storage'
import type { Progress } from './lib/progress'
import { SESSION_START_WAIT_TIMEOUT_MS } from './lib/audio/sessionStartFallback'

vi.mock('./lib/sfx', () => ({
  createSfx: vi.fn(() => ({
    play: vi.fn(() => true),
    unload: vi.fn(),
    missedPlays: 0,
    loadFailed: false,
  })),
}))

const ORIGINAL_LOCATION = window.location

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...ORIGINAL_LOCATION, search },
  })
}

/** Rule 4 of computeSuggestion: nothing touched today, last suggestion
 *  was Word Song → the Hub suggests Number Garden. */
function seedHubSuggests(tree: 'number-garden' | 'word-song'): void {
  window.localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify({
      ...emptySessionHistory(),
      sessionCount: 3,
      lastSuggestion: tree === 'number-garden' ? 'word-song' : 'number-garden',
    }),
  )
}

function seedProgress(mutate?: (p: Progress) => void): void {
  const p = defaultProgress()
  mutate?.(p)
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
}

interface Call {
  track: string
  body: { payload?: { track?: string; progress?: Record<string, unknown> } }
  signal: AbortSignal | undefined
}

function claudeCalls(spy: { mock: { calls: unknown[][] } }): Call[] {
  return spy.mock.calls
    .filter((c) => c[0] === '/api/claude')
    .map((c) => {
      const init = c[1] as RequestInit | undefined
      const body = JSON.parse(String(init?.body)) as Call['body']
      return {
        track: body.payload?.track ?? '',
        body,
        signal: init?.signal ?? undefined,
      }
    })
}

const byTrack = (calls: Call[], track: string) =>
  calls.filter((c) => c.track === track)

/** fetch that never settles but rejects on abort, like the real one. */
function pendingFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
    return new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () =>
        rej(new DOMException('aborted', 'AbortError')),
      )
    })
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

async function renderAppWithShims(): Promise<void> {
  vi.doMock('./screens/Hub', () => ({
    default: ({
      onPickTree,
      onCharacterLongPress,
    }: {
      onPickTree?: (tree: 'number-garden' | 'word-song') => void
      onCharacterLongPress?: () => void
    }) => (
      <div data-testid="hub-mock">
        <button
          type="button"
          data-testid="pick-math"
          onClick={() => onPickTree?.('number-garden')}
        />
        <button
          type="button"
          data-testid="pick-word-song"
          onClick={() => onPickTree?.('word-song')}
        />
        <button
          type="button"
          data-testid="long-press"
          onClick={() => onCharacterLongPress?.()}
        />
      </div>
    ),
  }))
  vi.doMock('./screens/Math', async () => {
    const actual: Record<string, unknown> =
      await vi.importActual('./screens/Math')
    return {
      ...actual,
      default: ({ onRequestExit }: { onRequestExit?: () => void }) => (
        <div data-testid="math-mock">
          <button
            type="button"
            data-testid="math-exit"
            onClick={() => onRequestExit?.()}
          />
        </div>
      ),
    }
  })
  vi.doMock('./screens/WordSong', async () => {
    const actual: Record<string, unknown> =
      await vi.importActual('./screens/WordSong')
    return { ...actual, default: () => <div data-testid="word-song-mock" /> }
  })
  vi.resetModules()
  const { default: AppFresh } = await import('./App')
  setSearch('?route=hub')
  render(<AppFresh />)
  await flush()
}

describe("Hub prefetch (Emma's Path 2/10)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.doUnmock('./screens/Hub')
    vi.doUnmock('./screens/Math')
    vi.doUnmock('./screens/WordSong')
    vi.restoreAllMocks()
    vi.useRealTimers()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: ORIGINAL_LOCATION,
    })
  })

  it('prefetches the MATH session on Hub entry when the Hub suggests Number Garden — and only math', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()

    const calls = claudeCalls(spy)
    expect(byTrack(calls, 'math')).toHaveLength(1)
    expect(byTrack(calls, 'word-song')).toHaveLength(0)
  })

  it('prefetches Word Song (not math) when the Hub suggests Word Song', async () => {
    seedHubSuggests('word-song')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()

    const calls = claudeCalls(spy)
    expect(byTrack(calls, 'word-song')).toHaveLength(1)
    expect(byTrack(calls, 'math')).toHaveLength(0)
  })

  it('tapping Number Garden REUSES the in-flight prefetch — no second request', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()
    // The request is already in flight while the child is on the Hub.
    expect(byTrack(claudeCalls(spy), 'math')).toHaveLength(1)

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-math'))
    })
    await flush()

    expect(screen.getByTestId('math-mock')).toBeInTheDocument()
    const math = byTrack(claudeCalls(spy), 'math')
    expect(math).toHaveLength(1)
    expect(math[0]!.signal?.aborted).toBe(false)
  })

  it('discards a STALE prefetch (focus node changed) and re-requests once on tap', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()
    const first = byTrack(claudeCalls(spy), 'math')
    expect(first).toHaveLength(1)
    expect(first[0]!.body.payload?.progress?.focusNode).toBe('add-to-10')

    // A progress write lands while the Hub is up (e.g. cloud-sync install):
    // add-to-10 is now mastered, so the math focus moves on.
    seedProgress((p) => {
      p.skillLevels['add-to-10'] = 'mastered'
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-math'))
    })
    await flush()

    const math = byTrack(claudeCalls(spy), 'math')
    expect(math).toHaveLength(2)
    expect(math[0]!.signal?.aborted).toBe(true)
    expect(math[1]!.signal?.aborted).toBe(false)
    expect(math[1]!.body.payload?.progress?.focusNode).not.toBe('add-to-10')
  })

  it('tapping the OTHER world aborts the math prefetch and requests Word Song once', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-word-song'))
    })
    await flush()

    const calls = claudeCalls(spy)
    expect(byTrack(calls, 'math')).toHaveLength(1)
    expect(byTrack(calls, 'math')[0]!.signal?.aborted).toBe(true)
    expect(byTrack(calls, 'word-song')).toHaveLength(1)
  })

  it('hub → parent-settings aborts the prefetch', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()

    await act(async () => {
      fireEvent.click(screen.getByTestId('long-press'))
    })
    await flush()
    const math = byTrack(claudeCalls(spy), 'math')
    expect(math).toHaveLength(1)
    expect(math[0]!.signal?.aborted).toBe(true)
  })

  it('back-arrow from Math tears down and the Hub prefetches a fresh session', async () => {
    seedHubSuggests('number-garden')
    seedProgress()
    const spy = pendingFetch()
    await renderAppWithShims()

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-math'))
    })
    await flush()
    // pick-math marks number-garden touched today → the Hub now suggests
    // Word Song, so the return trip prefetches Word Song.
    await act(async () => {
      fireEvent.click(screen.getByTestId('math-exit'))
    })
    await flush()

    expect(screen.getByTestId('hub-mock')).toBeInTheDocument()
    const calls = claudeCalls(spy)
    expect(byTrack(calls, 'math')).toHaveLength(1)
    expect(byTrack(calls, 'math')[0]!.signal?.aborted).toBe(true)
    expect(byTrack(calls, 'word-song')).toHaveLength(1)
  })

  it('Hub dwell does not count toward the 5 s timeout: a hinted prefetch is adopted, timer starts at Math mount', async () => {
    seedHubSuggests('number-garden')
    seedProgress((p) => {
      p.mathFactsLeitner = {
        items: [{ item: { a: 3, b: 4, op: '+' }, box: 1, lastSeen: 0 }],
      }
    })
    const spy = pendingFetch()
    await renderAppWithShims()
    const first = byTrack(claudeCalls(spy), 'math')
    expect(first).toHaveLength(1)
    expect(first[0]!.body.payload?.progress?.leitner).toBeDefined()

    // Marian dwells on the Hub far longer than the timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_START_WAIT_TIMEOUT_MS * 3)
    })
    expect(byTrack(claudeCalls(spy), 'math')).toHaveLength(1)

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-math'))
    })
    await flush()

    // Just under the budget after the tap: still the one hinted request.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_START_WAIT_TIMEOUT_MS - 100)
    })
    expect(byTrack(claudeCalls(spy), 'math')).toHaveLength(1)

    // Budget spent on VISIBLE wait → hint-free canon fallback.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    const math = byTrack(claudeCalls(spy), 'math')
    expect(math).toHaveLength(2)
    expect(math[0]!.signal?.aborted).toBe(true)
    expect(math[1]!.body.payload?.progress?.leitner).toBeUndefined()
  })
})
