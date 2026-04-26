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
import type { MathSessionPlan, PlayMathUtteranceFn } from './screens/Math'
import {
  DebugOverlay,
  activateAudioContextProbe,
  isDebugEnabled,
} from './lib/debug'
import { prepareMathPathA } from './lib/audio/mathPathA'
import type { Route } from './router/route'
import { FIRST_ROUTE } from './router/route'

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
  const [route, setRoute] = useState<Route>(FIRST_ROUTE)

  const goGreet = useCallback(() => setRoute('greet'), [])
  const goMath = useCallback(() => setRoute('math'), [])

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
