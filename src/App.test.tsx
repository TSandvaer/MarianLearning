import { act, fireEvent, render, screen } from '@testing-library/react'
import { Howler } from 'howler'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { _resetAudioContextProbeForTests } from './lib/debug'

// Greet creates a chime SFX on mount; jsdom has no audio backend. Stub the
// factory so we don't pay an XHR + console.warn on every test render.
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

function restoreSearch(): void {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: ORIGINAL_LOCATION,
  })
}

describe('App routing skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreSearch()
    // The audio-context probe is a module-level singleton (`?debug=1`
    // path). Reset it between tests so the timer/listener it owns
    // doesn't leak into the next case.
    _resetAudioContextProbeForTests()
  })

  it('starts on Splash and auto-advances to the Greet screen', async () => {
    render(<App />)
    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(screen.queryByTestId('greet')).toBeNull()

    // Cold start by default in jsdom — wait the cold cap.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    // AnimatePresence may keep the splash element in the tree briefly while
    // its exit animation runs; advance enough for that to finish too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByTestId('greet')).toBeInTheDocument()
  })

  describe('Math Path A wiring', () => {
    // Sanity-check: the /api/claude POST is gated on the user actually
    // beginning a session. While App is on Splash, no fetch should be
    // issued — the splash screen is a brief auto-advance hold and the user
    // hasn't committed to the session yet. Once route flips to Greet
    // (`route === 'greet'`), the fetch starts so the audio is ready by
    // the time Math mounts (ticket 86c9hjnn8).
    it('does NOT POST to /api/claude on initial mount (route=splash)', () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}'))
      render(<App />)
      // Splash mount only — no Greet/Math route visited yet.
      expect(fetchSpy).not.toHaveBeenCalledWith(
        '/api/claude',
        expect.anything(),
      )
      fetchSpy.mockRestore()
    })

    // Pre-warm fix for ticket 86c9hjnn8: on direct ?route=greet launch
    // (and equivalently the Splash → Greet auto-advance), App fires the
    // /api/claude POST immediately so the audio is loaded by the time
    // Math mounts. Without this, the cold-mount first read-aloud races
    // the network fetch and the first problem plays silent — the bug
    // Thomas captured on production deploy b6df65b.
    it('POSTs to /api/claude on entering Greet (pre-warm for Math) — ticket 86c9hjnn8', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        // Hand back a response shape that prepareMathPathA will reject
        // as `invalid-response` (no utterances field). The test only
        // cares that the POST was issued, not that it succeeded — the
        // failure path is exercised by lib/audio/mathPathA.test.ts.
        new Response('{}', { status: 200 }),
      )
      setSearch('?route=greet')
      render(<App />)

      // Expect at least one fetch to /api/claude with a session-start body.
      const calls = fetchSpy.mock.calls.filter((c) => c[0] === '/api/claude')
      expect(calls.length).toBeGreaterThanOrEqual(1)
      // Verify it's the session-start kind (not some other future use).
      const body = calls[0][1]?.body
      expect(typeof body).toBe('string')
      expect(JSON.parse(body as string)).toMatchObject({
        kind: 'session-start',
      })

      // Drain the fetch's .then/.catch so the resulting setState (the
      // audio-ready flip in the catch path) commits inside act() rather
      // than escaping the test boundary.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      fetchSpy.mockRestore()
    })

    // Regression test for Kevin's PR #92 review (ticket 86c9hjnn8):
    //
    // The fetch effect's deps `[route, mathPlan]` previously caused React
    // to run the cleanup of the prior effect run on greet → math route
    // flip. Cleanup called `controller.abort()` and set a local
    // `cancelled = true`. The fetch then rejected with `AbortError`; the
    // `.catch` saw `cancelled === true` and skipped the unblocking
    // `setMathAudioReady(true)`. The latch prevented re-issue. Net
    // result: `audioReady` stuck false, Math fully bricked — strictly
    // worse than the original silent-first-problem bug the pre-warm was
    // meant to fix.
    //
    // Asserts:
    //   (i)  exactly ONE /api/claude POST is issued (no abort + re-issue)
    //   (ii) `audioReady` ends `true` after the fetch resolves, even
    //        though the route flipped greet → math while the fetch was
    //        in flight (the slow-network case the pre-warm covers)
    it("greet → math during in-flight fetch lands audioReady=true (Kevin's PR #92 regression)", async () => {
      // Hold the fetch open so the route flip happens mid-flight.
      let resolveFetch!: (r: Response) => void
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockReturnValue(fetchPromise as Promise<Response>)

      // Mock Math to surface `audioReady` via a data attribute. We don't
      // need the real screen for this test — the App-side gate is what
      // we're validating.
      vi.doMock('./screens/Math', async () => {
        const actual: Record<string, unknown> =
          await vi.importActual('./screens/Math')
        return {
          ...actual,
          default: ({ audioReady }: { audioReady?: boolean }) => (
            <div
              data-testid="math-mock"
              data-audio-ready={audioReady === true ? 'true' : 'false'}
            />
          ),
        }
      })
      // Mock Greet to a one-button shim so we can drive greet → math
      // synchronously without walking the real 4-line intro timeline.
      vi.doMock('./screens/Greet', () => ({
        default: ({ onAdvance }: { onAdvance: () => void }) => (
          <button
            type="button"
            data-testid="greet-mock-advance"
            onClick={onAdvance}
          />
        ),
      }))

      vi.resetModules()
      const { default: AppFresh } = await import('./App')

      setSearch('?route=greet')
      render(<AppFresh />)

      // The pre-warm fetch fires on greet mount.
      let claudeCalls = fetchSpy.mock.calls.filter(
        (c) => c[0] === '/api/claude',
      )
      expect(claudeCalls.length).toBe(1)

      // Drive greet → math while the fetch is still pending. This is the
      // slow-network case: the fetch hasn't resolved yet when route
      // flips. Pre-fix, this triggered the abort+brick chain. Post-fix,
      // the fetch keeps running and settles cleanly against Math.
      await act(async () => {
        fireEvent.click(screen.getByTestId('greet-mock-advance'))
        await Promise.resolve()
      })

      // Math is now mounted, audioReady still false (fetch hasn't
      // settled).
      const math = screen.getByTestId('math-mock')
      expect(math).toHaveAttribute('data-audio-ready', 'false')

      // Verify NO duplicate fetch was issued by the route flip — exactly
      // one /api/claude call total.
      claudeCalls = fetchSpy.mock.calls.filter((c) => c[0] === '/api/claude')
      expect(claudeCalls.length).toBe(1)

      // Resolve the fetch with an invalid-shape response (the soft-fail
      // path, identical to the existing pre-warm test). What matters is
      // that EITHER settle path flips audioReady to true. Pre-fix, the
      // catch's `if (!cancelled)` guard skipped the flip and
      // audioReady stayed false forever.
      await act(async () => {
        resolveFetch(new Response('{}', { status: 200 }))
        // Drain microtasks: fetch.then → response.json → catch in
        // prepareMathPathA → catch in App → setMathAudioReady(true).
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      // The fix: audioReady ends true after the in-flight fetch settles
      // post route flip.
      expect(screen.getByTestId('math-mock')).toHaveAttribute(
        'data-audio-ready',
        'true',
      )

      // Still exactly one fetch — no abort + re-issue path.
      claudeCalls = fetchSpy.mock.calls.filter((c) => c[0] === '/api/claude')
      expect(claudeCalls.length).toBe(1)

      vi.doUnmock('./screens/Math')
      vi.doUnmock('./screens/Greet')
      fetchSpy.mockRestore()
    })
  })

  describe('Session-End handoff wiring (App ↔ screens)', () => {
    // Unit-shape check: App passes `onSessionComplete` to both screens.
    // We render with the screen modules mocked to a tiny shim that
    // synchronously fires the callback on mount; that's the cleanest
    // way to exercise App's routing behaviour without coupling to
    // either screen's internal 8-problem flow + animation timing.
    //
    // The full integration walk (8 problems → session-end) is covered
    // at the screen level in WordSong.test.tsx + Math.test.tsx; what
    // matters here is that App reacts to the callback by flipping the
    // route to 'session-end' and forwarding the payload's surface tag.

    it('flips to session-end with surface=word-song when WordSong reports complete', async () => {
      vi.doMock('./screens/WordSong', async () => {
        const actual: Record<string, unknown> =
          await vi.importActual('./screens/WordSong')
        return {
          ...actual,
          default: ({
            onSessionComplete,
          }: {
            onSessionComplete?: (r: {
              totalCorrect: number
              totalStardust: number
              finalStreak: number
              earnedThisSession: number
              surface: 'word-song'
            }) => void
          }) => {
            return (
              <button
                type="button"
                data-testid="word-song-mock-complete"
                onClick={() =>
                  onSessionComplete?.({
                    totalCorrect: 8,
                    totalStardust: 11,
                    finalStreak: 8,
                    earnedThisSession: 11,
                    surface: 'word-song',
                  })
                }
              >
                complete
              </button>
            )
          },
        }
      })
      // Re-import App after the mock so it picks up the shim. Same
      // pattern as the existing debug-overlay tests above.
      vi.resetModules()
      const { default: AppFresh } = await import('./App')

      setSearch('?route=literacy')
      render(<AppFresh />)

      await act(async () => {
        fireEvent.click(screen.getByTestId('word-song-mock-complete'))
        await Promise.resolve()
      })

      const sessionEnd = screen.getByTestId('session-end')
      expect(sessionEnd).toHaveAttribute('data-surface', 'word-song')
      expect(sessionEnd).toHaveAttribute('data-earned', '11')
      expect(sessionEnd).toHaveAttribute('data-total-stardust', '11')

      vi.doUnmock('./screens/WordSong')
    })

    it('flips to session-end with surface=math when Math reports complete', async () => {
      vi.doMock('./screens/Math', async () => {
        const actual: Record<string, unknown> =
          await vi.importActual('./screens/Math')
        return {
          ...actual,
          default: ({
            onSessionComplete,
          }: {
            onSessionComplete?: (r: {
              totalCorrect: number
              totalStardust: number
              finalStreak: number
              earnedThisSession: number
            }) => void
          }) => {
            return (
              <button
                type="button"
                data-testid="math-mock-complete"
                onClick={() =>
                  onSessionComplete?.({
                    totalCorrect: 8,
                    totalStardust: 11,
                    finalStreak: 8,
                    earnedThisSession: 11,
                  })
                }
              >
                complete
              </button>
            )
          },
        }
      })
      vi.resetModules()
      const { default: AppFresh } = await import('./App')

      setSearch('?route=math')
      render(<AppFresh />)

      await act(async () => {
        fireEvent.click(screen.getByTestId('math-mock-complete'))
        await Promise.resolve()
      })

      const sessionEnd = screen.getByTestId('session-end')
      // Math's payload omits `surface` — App's handler defaults to 'math'
      // per the backwards-compat shim (screen-5-session-end.md:96-102).
      expect(sessionEnd).toHaveAttribute('data-surface', 'math')
      expect(sessionEnd).toHaveAttribute('data-earned', '11')

      vi.doUnmock('./screens/Math')
    })
  })

  describe('Session-End handoff routing', () => {
    // Per the Word Song UX bug ticket: completing problem 8 on either
    // Math or Word Song must transition the route to 'session-end' so
    // Marian sees a celebratory close-out screen instead of the frozen
    // resolved-problem view Thomas reported on iPad. The full Session-End
    // screen is gated on Thomas's CTA decision (86c9gugm7); until then
    // a placeholder mounts so the transition itself is observable.

    it('mounts the Session-End placeholder on direct ?route=session-end launch', () => {
      setSearch('?route=session-end')
      render(<App />)
      expect(screen.getByTestId('session-end')).toBeInTheDocument()
      // Cold-launched (no payload): zeros across the board.
      expect(screen.getByTestId('session-end')).toHaveAttribute(
        'data-earned',
        '0',
      )
    })

    // Note: end-to-end "walk 8 problems → route flips" coverage lives
    // at the screen level (WordSong.test.tsx + Math.test.tsx already
    // assert onSessionComplete fires with the right payload after the
    // 8th problem). The wiring-shape coverage above is the App-side
    // half of that contract — they meet in the middle. Adding a third
    // copy at the App layer adds rAF-flake risk under jsdom without
    // covering anything new.
  })

  describe('Hub navigation contract (#86c9j53ra)', () => {
    // Source-of-truth: design/screen-hub.md § "Navigation contract".
    // The dynamic Splash → Hub branching covered separately at the
    // session-history layer (`nextAfterSplash` keys on
    // `sessionCount`); these App-level tests cover the direct-route
    // mount + first-visit fallback shape.

    it('mounts Hub directly on ?route=hub', () => {
      setSearch('?route=hub')
      render(<App />)
      expect(screen.getByTestId('hub')).toBeInTheDocument()
      expect(
        screen.getAllByTestId('hub-tree-node').length,
      ).toBeGreaterThanOrEqual(2)
    })

    it('mounts Hub gracefully on a fresh state (Emma-idle, both nodes visible)', () => {
      // Spec § "Empty / first-visit edge case": Hub renders correctly
      // even if it somehow mounts on a fresh state — both nodes are
      // tappable, Emma is in idle, the screen is functional.
      setSearch('?route=hub')
      render(<App />)
      expect(screen.getByTestId('hub')).toBeInTheDocument()
      expect(screen.getByTestId('hub-emma')).toBeInTheDocument()
    })
  })

  describe('debug overlay', () => {
    // The overlay is gated on `?debug=1`. Without it, normal sessions never
    // see (or pay for) the panel — critical because we ship debug to prod and
    // rely on the URL flag as the only opt-in.
    it('does NOT mount the debug overlay without ?debug=1', () => {
      setSearch('')
      render(<App />)
      expect(screen.queryByTestId('debug-overlay')).toBeNull()
    })

    it('mounts the debug overlay when ?debug=1 is present', () => {
      setSearch('?debug=1')
      render(<App />)
      expect(screen.getByTestId('debug-overlay')).toBeInTheDocument()
    })

    it('does NOT mount the overlay for any other debug value', () => {
      setSearch('?debug=true')
      render(<App />)
      expect(screen.queryByTestId('debug-overlay')).toBeNull()
    })
  })

  describe('Phase-8 (ticket 86c9gvd0y) — Howler autoSuspend disable on app boot', () => {
    // App.tsx calls `disableHowlerAutoSuspend()` at module top level, so
    // by the time any test imports App the side effect has already run.
    // Asserting the resulting state both (a) confirms the boot effect
    // landed and (b) catches any future regression that re-enables
    // autoSuspend (the 30-second iPad audio-decay bug shape).
    it('Howler.autoSuspend is false after App is imported', () => {
      // No render needed — the side effect ran when the test file
      // imported App at the top. We just observe the resulting state.
      expect(Howler.autoSuspend).toBe(false)
    })
  })
})
