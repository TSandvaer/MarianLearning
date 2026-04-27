import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
} from 'motion/react'
import Splash from './screens/Splash'
import Greet from './screens/Greet'
import Math, { pickStaticSessionPlan } from './screens/Math'
import type {
  MathSessionPlan,
  MathSessionResult,
  PlayMathUtteranceFn,
} from './screens/Math'
import WordSong, { pickStaticWordSongPlan } from './screens/WordSong'
import type {
  PlayWordSongUtteranceFn,
  WordSongSessionPlan,
  WordSongSessionResult,
} from './screens/WordSong'
import SessionEnd from './screens/SessionEnd'
import type { SessionEndPayload } from './screens/SessionEnd'
import {
  DebugOverlay,
  activateAudioContextProbe,
  isDebugEnabled,
} from './lib/debug'
import { disableHowlerAutoSuspend } from './lib/audio'
import { prepareMathPathA } from './lib/audio/mathPathA'
import { prepareWordSongPathA } from './lib/audio/wordSongPathA'
import type { Route } from './router/route'
import { FIRST_ROUTE } from './router/route'

/**
 * Phase-8 fix (ticket 86c9gvd0y) — disable Howler's internal `_autoSuspend`
 * timer ONCE at module load.
 *
 * The 30-second iPad audio-decay bug Thomas reproduced is caused by
 * Howler's own `_autoSuspend` mechanism (howler.js line 461-505): after
 * 30 s with no sound playing, Howler flips `Howler.state` to `'suspending'`
 * → `'suspended'` and calls `Howler.ctx.suspend()`. On the next gesture,
 * `Howl.play()` checks `Howler.state === 'running'` (line 886) — finds
 * it `'suspended'` — and defers playback to a `'resume'` event that, on
 * iPad PWA after long idle, sometimes never fires.
 *
 * `Howler.autoSuspend = false` (the public, documented option from the
 * library) suppresses the entire timer. `Howler.state` never leaves
 * `'running'` after the first play, `play()` always takes the synchronous
 * fast path, and `_emit('play', id)` always fires — fixing exactly the
 * "speak-call lands but speak-onplay never fires" symptom Phase-7's iPad
 * capture localized.
 *
 * Done at module top level (not inside React) for two reasons:
 *
 *   1. Howler's `_autoSuspend` runs as soon as a sound finishes. The
 *      Greet chime at line 0 plays on splash auto-advance — we want
 *      `autoSuspend` already disabled by then. A `useEffect` after first
 *      render is a microtask too late.
 *   2. The setting is global to the Howler singleton; running it once at
 *      module load is sufficient for the lifetime of the page.
 *
 * No production cost: one boolean property write at startup. Power impact
 * of leaving the WebAudio graph alive is negligible (Safari parks the
 * audio thread when no nodes are connected; our session has nothing
 * connected when idle).
 */
disableHowlerAutoSuspend()

/**
 * Optional initial-route override via `?route=literacy` etc. Used for
 * QA-direct-launch into the Word Song surface (or any future screen)
 * before the orchestrator's session-sequencer wires the auto-handoff
 * from Math → Word Song. Falls back to FIRST_ROUTE on missing /
 * unrecognised values.
 */
function getInitialRoute(): Route {
  if (typeof window === 'undefined') return FIRST_ROUTE
  try {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('route')
    if (
      v === 'splash' ||
      v === 'greet' ||
      v === 'math' ||
      v === 'literacy' ||
      v === 'session-end' ||
      v === 'reward'
    ) {
      return v
    }
  } catch {
    // URLSearchParams should not throw on a string, but be defensive.
  }
  return FIRST_ROUTE
}

/**
 * App shell.
 *
 * Routing is intentionally a tiny piece of local state — see
 * `src/router/route.ts` for the rationale. Session 1 is a fixed linear
 * sequence; we don't pay the bundle cost of react-router until URLs become
 * a real requirement (parental dashboard / return-user flow).
 *
 * Motion is wrapped here so every screen can use `<m.*>` without each one
 * paying the LazyMotion init cost. Reduce-motion is honoured globally:
 * iPad's "Reduce Motion" accessibility toggle collapses springs to fades
 * and freezes infinite-repeat pulses. Each screen still gets the same
 * markup — no per-screen branching for the a11y path.
 */
export default function App() {
  const [route, setRoute] = useState<Route>(() => getInitialRoute())

  const goGreet = useCallback(() => setRoute('greet'), [])
  const goMath = useCallback(() => setRoute('math'), [])
  // No `goLiteracy` callback wired today — the Math→Word Song handoff
  // contract belongs to the Session-end ticket 86c9grnjd which
  // generalises the post-problem-8 transition. The literacy route is
  // reachable directly via `?route=literacy` (see `getInitialRoute`)
  // for QA, and the orchestrator's session-sequencer ticket will wire
  // the auto-handoff when it lands.

  /**
   * Session-End handoff state. Captured from the originating screen's
   * `onSessionComplete({ ... surface })` callback and surfaced to the
   * Session-End screen on mount. Persisted in component state (not a
   * ref) because the screen reads it during render and we want
   * React-driven re-render parity with the route flip.
   *
   * The full Session-End screen (ticket 86c9hb2r6) replaces the
   * earlier placeholder. Thomas decided Option C for the CTA
   * destination: "Come back soon" sleep splash.
   */
  const [sessionEndPayload, setSessionEndPayload] =
    useState<SessionEndPayload | null>(null)

  const handleMathComplete = useCallback((result: MathSessionResult) => {
    // Math's existing payload omits the `surface` discriminant per
    // PR #54 / screen-3-math.md:411 — the Session-End spec's
    // backwards-compat shim defaults missing `surface` to `'math'`
    // (screen-5-session-end.md:96-102). We materialise the default
    // here so downstream consumers always see a complete payload.
    setSessionEndPayload({
      totalCorrect: result.totalCorrect,
      totalStardust: result.totalStardust,
      finalStreak: result.finalStreak,
      earnedThisSession: result.earnedThisSession,
      surface: 'math',
    })
    setRoute('session-end')
  }, [])

  const handleWordSongComplete = useCallback(
    (result: WordSongSessionResult) => {
      setSessionEndPayload({
        totalCorrect: result.totalCorrect,
        totalStardust: result.totalStardust,
        finalStreak: result.finalStreak,
        earnedThisSession: result.earnedThisSession,
        surface: result.surface,
      })
      setRoute('session-end')
    },
    [],
  )

  // Capture once on mount — flipping debug mid-session would tear the
  // overlay in/out and isn't worth the complexity. To enable, append
  // `?debug=1` to the URL (works in Safari tab and PWA install both).
  const debugOn = useMemo(() => isDebugEnabled(), [])

  // Phase-1 instrumentation for ticket 86c9gvd0y (iOS audio-context
  // decay). The probe is started exactly once when debug is enabled and
  // intentionally NOT torn down — the React tree may unmount on
  // hot-reload, but the probe outlives that and keeps the localStorage
  // log contiguous across screen navigations.
  //
  // No production cost: when `debugOn` is false the effect is a no-op
  // and the probe module never instantiates a poller, listener, or
  // localStorage handle.
  useEffect(() => {
    if (!debugOn) return
    activateAudioContextProbe()
    // Deliberate: no cleanup. See above for rationale.
  }, [debugOn])

  // ── Math screen — Path A live audio wiring (ticket 86c9gumgk item F) ──
  //
  // Pick the math plan ONCE per app session — shared between the fetch
  // below and the <Math> prop, so the screen's `useMemo([])` plan capture
  // matches the plan we asked the server to render. Picked even when the
  // user never reaches Math; the cost is a single deterministic function
  // call against `Date.now()`.
  const mathPlan = useMemo<MathSessionPlan>(() => pickStaticSessionPlan(), [])

  // The live `playUtterance` becomes non-null once the /api/claude fetch
  // resolves and the audio is loaded. Until then (or on any failure),
  // <Math> renders without the prop and falls back to its silent-but-
  // captioned default (165 wpm). No error chime, no nag copy — Marian
  // sees text. See `lib/audio/mathPathA.ts` for the full failure-mode
  // surface and the wire-shape adapter rationale.
  const [mathPlay, setMathPlay] = useState<PlayMathUtteranceFn | null>(null)
  const mathUnloadRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (route !== 'math') return

    const controller = new AbortController()
    let cancelled = false

    void prepareMathPathA(mathPlan, mathPlan.id, { signal: controller.signal })
      .then((prepared) => {
        if (cancelled) {
          prepared.unload()
          return
        }
        mathUnloadRef.current = prepared.unload
        // Wrap in a thunk so React doesn't call the function before storing
        // it (useState treats function arg as a lazy initializer).
        setMathPlay(() => prepared.playUtterance)
      })
      .catch((err: unknown) => {
        // Soft-fail: keep playUtterance null, Math falls back to silent
        // default. Log so the QA pass can attribute the fallback if it
        // bites a captured iPad session.
        if (!cancelled) {
          console.warn(
            '[App] Math Path A unavailable; using silent fallback:',
            err,
          )
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      // Tear down any howls registered while we were on Math, so a future
      // re-entry rebuilds cleanly. Idempotent if no fetch ever resolved.
      if (mathUnloadRef.current) {
        mathUnloadRef.current()
        mathUnloadRef.current = null
      }
      setMathPlay(null)
    }
  }, [route, mathPlan])

  // ── Word Song screen — Path A live audio wiring ──
  //
  // Mirrors Math's wiring above. Picked once per app session; the fetch
  // fires lazily when the user actually navigates to the literacy
  // surface. On any failure, <WordSong> renders without the prop and
  // falls back to its silent-but-captioned default. No nag copy.
  const wordSongPlan = useMemo<WordSongSessionPlan>(
    () => pickStaticWordSongPlan(),
    [],
  )
  const [wordSongPlay, setWordSongPlay] =
    useState<PlayWordSongUtteranceFn | null>(null)
  const wordSongUnloadRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (route !== 'literacy') return

    const controller = new AbortController()
    let cancelled = false

    void prepareWordSongPathA(wordSongPlan, wordSongPlan.id, {
      signal: controller.signal,
    })
      .then((prepared) => {
        if (cancelled) {
          prepared.unload()
          return
        }
        wordSongUnloadRef.current = prepared.unload
        setWordSongPlay(() => prepared.playUtterance)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.warn(
            '[App] Word Song Path A unavailable; using silent fallback:',
            err,
          )
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      if (wordSongUnloadRef.current) {
        wordSongUnloadRef.current()
        wordSongUnloadRef.current = null
      }
      setWordSongPlay(null)
    }
  }, [route, wordSongPlan])

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          {route === 'splash' && <Splash key="splash" onAdvance={goGreet} />}
          {route === 'greet' && <Greet key="greet" onAdvance={goMath} />}
          {route === 'math' && (
            <Math
              key="math"
              plan={mathPlan}
              playUtterance={mathPlay ?? undefined}
              onSessionComplete={handleMathComplete}
            />
          )}
          {route === 'literacy' && (
            <WordSong
              key="literacy"
              plan={wordSongPlan}
              playUtterance={wordSongPlay ?? undefined}
              onSessionComplete={handleWordSongComplete}
            />
          )}
          {route === 'session-end' && (
            <SessionEnd key="session-end" payload={sessionEndPayload} />
          )}
        </AnimatePresence>
        {/* Debug overlay sits outside AnimatePresence so it persists across
            screen transitions. Gated on `?debug=1` so it never ships visibly
            in normal sessions. See lib/debug/DebugOverlay.tsx for the iPad
            QA usage notes. */}
        {debugOn && <DebugOverlay />}
      </MotionConfig>
    </LazyMotion>
  )
}
