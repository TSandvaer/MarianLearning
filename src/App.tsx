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
import SessionEndPlaceholder from './screens/SessionEndPlaceholder'
import type { SessionEndPayload } from './screens/SessionEndPlaceholder'
import {
  DebugOverlay,
  activateAudioContextProbe,
  isDebugEnabled,
} from './lib/debug'
import { prepareMathPathA } from './lib/audio/mathPathA'
import { prepareWordSongPathA } from './lib/audio/wordSongPathA'
import type { Route } from './router/route'
import { FIRST_ROUTE } from './router/route'

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
   * ref) because the placeholder screen reads it during render and we
   * want React-driven re-render parity with the route flip.
   *
   * Until the full Session-End screen lands (blocked on Thomas's CTA
   * decision in 86c9gugm7), the route resolves to a minimal
   * `SessionEndPlaceholder` so Marian sees SOMETHING after problem 8
   * instead of the resolved-but-frozen problem view Thomas reported.
   * The full screen will replace the placeholder under its own ticket.
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
            <SessionEndPlaceholder
              key="session-end"
              payload={sessionEndPayload}
            />
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
