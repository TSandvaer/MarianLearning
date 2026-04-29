import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
} from 'motion/react'
import Splash from './screens/Splash'
import Greet from './screens/Greet'
import Hub from './screens/Hub'
import type { HubEntryPath } from './screens/Hub'
import MathScreen, { pickStaticSessionPlan } from './screens/Math'
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
  readSessionHistory,
  type SkillTreeId,
} from './screens/SessionEnd/sessionHistory'
import {
  DebugOverlay,
  activateAudioContextProbe,
  emitBundleInit,
  isDebugEnabled,
  recordPathASettleEvent,
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
      v === 'hub' ||
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
 * Compute the post-Splash route per `design/screen-hub.md` § "Navigation
 * contract" Q1:
 *   - `sessionCount === 0` (first-ever launch) → Greet (then Math →
 *     SessionEnd → Hub via the standard flow).
 *   - `sessionCount >= 1` → Hub directly. Greet is a once-ever moment
 *     and never re-shows on subsequent launches.
 *
 * Reads `marian-tutor.session-history.v1` (now v2-aware via the lazy
 * migration in `screens/SessionEnd/sessionHistory.ts`) — a missing /
 * malformed key reads as `sessionCount === 0`, so the first-ever path
 * is the safe default if storage is unavailable.
 */
function nextAfterSplash(): Route {
  try {
    const history = readSessionHistory()
    return history.sessionCount === 0 ? 'greet' : 'hub'
  } catch {
    return 'greet'
  }
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

  /**
   * Hub-entry path tracked in state so Hub mounts know which welcome-back
   * variant to play and whether the audio gate is needed. Updated by the
   * route transitions below: Splash → Hub sets 'app-open' (or
   * 'app-open-recent' if the last session was within 6h); Session-End →
   * Hub sets 'session-end'; mid-skill back-arrow sets 'mid-skill-back';
   * the once-ever first Hub mount post-Greet sets 'first-ever'.
   */
  const [hubEntryPath, setHubEntryPath] = useState<HubEntryPath>('app-open')

  /**
   * Splash advance — branches on session-history per the Hub navigation
   * contract (`design/screen-hub.md` § Q1):
   *   - `sessionCount === 0` → Greet (first-ever Session 1 path)
   *   - `sessionCount >= 1` → Hub (returning launches)
   */
  const handleSplashAdvance = useCallback(() => {
    const next = nextAfterSplash()
    if (next === 'hub') {
      // Determine whether to surface the 'app-open-recent' anchor
      // ("Back so soon!" within ~6h) or the standard 'app-open'
      // anchor.
      try {
        const history = readSessionHistory()
        const last = new Date(history.lastSessionCompletedAt)
        const recent =
          !Number.isNaN(last.getTime()) &&
          Date.now() - last.getTime() < 6 * 60 * 60 * 1000
        setHubEntryPath(recent ? 'app-open-recent' : 'app-open')
      } catch {
        setHubEntryPath('app-open')
      }
    }
    setRoute(next)
  }, [])

  /**
   * Greet → Math handoff. The first-ever flow lands on Math directly
   * (Session 1's fixed sequence per `design/session-1.md`). Greet is
   * never re-shown — when Marian returns to Hub via Session-End the
   * Splash router branches based on `sessionCount`.
   */
  const handleGreetAdvance = useCallback(() => {
    setRoute('math')
  }, [])

  /**
   * Hub → Math/WordSong handoff. The Hub component owns the
   * suggestion-outcome write to localStorage; this orchestrator just
   * routes.
   */
  const handleHubPickTree = useCallback((tree: SkillTreeId) => {
    setRoute(tree === 'number-garden' ? 'math' : 'literacy')
  }, [])

  /** Hub parent-gate completion — v1 no-op (console.log inside the hook). */
  const handleHubParentGate = useCallback(() => {
    // v2 will navigate to a real parent area here. v1 ships invisible.
  }, [])

  /**
   * Mid-skill back-arrow → Hub. Wired into Math/WordSong via their
   * `onRequestExit` callback (added in slice 4).
   */
  const handleBackToHub = useCallback(() => {
    setHubEntryPath('mid-skill-back')
    setRoute('hub')
  }, [])

  /**
   * Session-End "All done!" → Hub. Wired into SessionEnd via the new
   * `onAllDone` prop (slice 6 ties the route flip; spec calls for a
   * one-line change in SessionEnd.tsx, this orchestrator-side handler
   * is the receiving side of that handoff).
   */
  const handleSessionEndAllDone = useCallback(() => {
    setHubEntryPath('session-end')
    setRoute('hub')
  }, [])

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

    // Bundle / cache sanity probe (ticket 86c9hjnn8 follow-up). Emitted
    // once per App mount, AFTER the probe is active so the bundle-init
    // row lands at the top of Thomas's audioCtxLog export. The async
    // reads (IDB schema version, SW script URL) are best-effort; the
    // probe handles any partial result gracefully.
    void emitBundleInit()
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
  /**
   * Aborts the in-flight `prepareMathPathA` fetch on session end / route
   * leave. Held in a ref because the leave-effect needs to access it
   * without depending on `controller` being recreated (the fetch effect
   * is one-shot, gated by `mathFetchStartedRef`).
   */
  const mathAbortRef = useRef<AbortController | null>(null)
  /**
   * Audio-ready gate for Math (ticket 86c9hjnn8). Flipped to `true` once
   * `prepareMathPathA` settles — resolve OR reject. Math reads this prop
   * to hold the cold-mount first read-aloud until the real `playUtterance`
   * is bound (or until we know we're going to use the silent fallback,
   * which is the same result either way: don't fire the read-aloud while
   * `playUtterance` is still in transition).
   *
   * Why both branches flip it to `true`
   * -----------------------------------
   * On resolve, `mathPlay` becomes the real Path A player; firing the
   * read-aloud now will play audibly. On reject, `mathPlay` stays null
   * and Math falls back to its silent-but-captioned `defaultPlayUtterance`;
   * we still want chips to unlock via that fallback's word-tick walk
   * (otherwise a Path A failure would brick the screen). The bug we're
   * fixing is specifically the WINDOW between mount and fetch settle —
   * once we're past that window in either direction, the existing
   * behaviour is correct.
   *
   * Reset to `false` whenever the route leaves Math so a re-entry
   * (Math → SessionEnd → Math via QA flow) restarts the gate cleanly.
   */
  const [mathAudioReady, setMathAudioReady] = useState(false)

  /**
   * Once-per-app-session latch for the Math Path A fetch (ticket 86c9hjnn8).
   *
   * Without this latch, including `route` and `mathPlay` in the fetch
   * effect's deps caused the greet → math transition to abort the
   * still-in-flight fetch and re-start a fresh one — burning a duplicate
   * server TTS render and delaying resolution by however long the first
   * fetch had already been running. The ref pins the fetch to the FIRST
   * route entering [greet, math] and the rest of the lifecycle is driven
   * by the leave-effect below (which also resets the latch on session
   * end so a future session re-fetches).
   */
  const mathFetchStartedRef = useRef(false)

  /**
   * Kick the Math Path A fetch as soon as Greet mounts (ticket 86c9hjnn8).
   * Greet's wake + 4-line intro + heart-tap window is ~8-15s on real
   * Marian-paced flows; that's plenty of time for the /api/claude POST to
   * settle before Math mounts. Starting on `route === 'math'` (the prior
   * behaviour) made the cold-mount race tight: fetch began at mount and
   * resolved seconds later, well after the read-aloud had already fired
   * silently against `defaultPlayUtterance`.
   *
   * Direct `?route=math` QA launches also trigger the fetch (the latch
   * fires the first time route is greet OR math, whichever comes first).
   *
   * Why no cleanup-on-deps-change here (Kevin's PR #92 review)
   * ----------------------------------------------------------
   * Earlier shape returned a cleanup that ran `controller.abort()` and set
   * a local `cancelled = true`. With `route` in the deps, that cleanup
   * fires on every greet → math transition — exactly the slow-network case
   * the pre-warm was meant to cover. The fetch then rejected with
   * `AbortError`; the `.catch` saw `cancelled === true` and skipped the
   * unblocking `setMathAudioReady(true)`; the latch prevented re-issue;
   * Math's cold-mount gate held forever. Empirical reproduction: hold the
   * fetch open, fire greet → math; observe `started=1, aborted=1,
   * audioReady=false`.
   *
   * Fix: route-change cleanup must NOT touch the in-flight pre-warm. The
   * leave-effect below owns the abort surface (greet/math → non-audio
   * route via `mathAbortRef`); the unmount-effect further down owns the
   * full-App-unmount abort. The settle handlers below check
   * `controller.signal.aborted` to short-circuit when the leave-effect or
   * the unmount-effect has decided we're tearing down — that's the
   * authoritative "should I publish state?" signal under the new shape.
   */
  useEffect(() => {
    if (route !== 'greet' && route !== 'math') return
    if (mathFetchStartedRef.current) return
    mathFetchStartedRef.current = true

    const controller = new AbortController()

    void prepareMathPathA(mathPlan, mathPlan.id, { signal: controller.signal })
      .then((prepared) => {
        if (controller.signal.aborted) {
          // Leave-effect (or unmount-effect) aborted us mid-flight. Drop
          // the loaded howls so we don't leak — the next greet/math entry
          // will fetch fresh per the latch reset in the leave-effect.
          prepared.unload()
          return
        }
        mathUnloadRef.current = prepared.unload
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up).
        // Records the resolve in the audioCtxLog timeline so the iPad
        // export shows when the pre-warm finished. Fires BEFORE the
        // setStates so the timestamp pairs with the prop flip cleanly.
        recordPathASettleEvent('math', 'resolve')
        // Wrap in a thunk so React doesn't call the function before storing
        // it (useState treats function arg as a lazy initializer).
        setMathPlay(() => prepared.playUtterance)
        setMathAudioReady(true)
      })
      .catch((err: unknown) => {
        // Soft-fail: keep playUtterance null, Math falls back to silent
        // default. Log so the QA pass can attribute the fallback if it
        // bites a captured iPad session.
        if (controller.signal.aborted) {
          // Aborted by leave/unmount — settling state would either be
          // ignored (post-unmount setState no-op) or stomp the leave
          // effect's reset to false. Silent.
          return
        }
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up).
        // Records the rejection with its message so the iPad export
        // attributes the silent-fallback path to a concrete cause.
        recordPathASettleEvent(
          'math',
          'reject',
          err instanceof Error ? err.message : String(err),
        )
        console.warn(
          '[App] Math Path A unavailable; using silent fallback:',
          err,
        )
        // Even on failure, unblock Math's cold-mount read-aloud — the
        // silent fallback at least walks the caption + unlocks chips,
        // which is better than leaving the screen permanently waiting.
        setMathAudioReady(true)
      })

    // Capture the controller so the leave-effect below can abort if Marian
    // bails the session (greet/math → non-audio surface) before the fetch
    // resolves. The latch ref keeps THIS effect from re-firing, so a
    // per-run cleanup would hurt (see header comment) — we deliberately
    // omit it.
    //
    // Why no full-App-unmount cleanup either
    // --------------------------------------
    // A separate `[]`-deps cleanup would seem to handle the "tab closed
    // mid-fetch" case, but its cleanup also fires on StrictMode's
    // simulated unmount (dev only). Combined with the latch persisting
    // in the ref, the simulated remount short-circuits the body and the
    // fetch never resumes — re-creating the same brick-shape we're
    // fixing here. In practice the browser cancels in-flight fetches
    // on real tab close, and tests that unmount during fetch let the
    // promise settle into the post-unmount setState no-op (React 18+
    // is silent about that). Net: leaving the abort path solely with
    // the leave-effect is safe and avoids the StrictMode foot-gun.
    mathAbortRef.current = controller
    // mathPlan is captured ONCE per app session by useMemo, so it's
    // effectively stable — listing it satisfies eslint without changing
    // semantics. Route is in deps so the effect is allowed to fire on the
    // first transition into greet/math even if App mounted on splash.
  }, [route, mathPlan])

  /**
   * Tear-down on session-end / cold-restart. Runs only when route leaves
   * Math AND Greet — i.e. the user has either completed the session or
   * navigated to a non-audio surface. Releases the howls, resets the
   * latch so a future session re-fetches, and clears the audio-ready
   * gate so the next Math mount holds again until its real player binds.
   *
   * setState calls deferred to a microtask to satisfy
   * `react-hooks/set-state-in-effect` — same pattern as the screen-level
   * audio-unlock effects (see Math.tsx / WordSong.tsx).
   */
  useEffect(() => {
    if (route === 'math' || route === 'greet') return
    const hadAudio =
      mathUnloadRef.current !== null || mathPlay !== null || mathAudioReady
    if (!hadAudio) return
    if (mathUnloadRef.current) {
      mathUnloadRef.current()
      mathUnloadRef.current = null
    }
    if (mathAbortRef.current) {
      mathAbortRef.current.abort()
      mathAbortRef.current = null
    }
    mathFetchStartedRef.current = false
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setMathPlay(null)
      setMathAudioReady(false)
    })
    return () => {
      cancelled = true
    }
  }, [route, mathPlay, mathAudioReady])

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
  const wordSongAbortRef = useRef<AbortController | null>(null)
  const wordSongFetchStartedRef = useRef(false)
  /**
   * Audio-ready gate for Word Song (ticket 86c9hjnn8). Same shape as
   * `mathAudioReady` above — flipped to `true` once
   * `prepareWordSongPathA` settles so the cold-mount read-aloud waits
   * for a real `playUtterance` before firing. See the Math gate's
   * documentation for the long-form rationale.
   */
  const [wordSongAudioReady, setWordSongAudioReady] = useState(false)

  /**
   * Same shape as the Math fetch-effect above (no cleanup; settle
   * handlers gate on `controller.signal.aborted`). The Word Song
   * deps `[route, wordSongPlan]` would have caused literacy →
   * non-literacy transitions to abort an in-flight fetch and brick
   * `wordSongAudioReady`. See the Math fetch-effect's header for the
   * full rationale.
   */
  useEffect(() => {
    if (route !== 'literacy') return
    if (wordSongFetchStartedRef.current) return
    wordSongFetchStartedRef.current = true

    const controller = new AbortController()

    void prepareWordSongPathA(wordSongPlan, wordSongPlan.id, {
      signal: controller.signal,
    })
      .then((prepared) => {
        if (controller.signal.aborted) {
          prepared.unload()
          return
        }
        wordSongUnloadRef.current = prepared.unload
        // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). See
        // the Math fetch-effect for the rationale.
        recordPathASettleEvent('wordSong', 'resolve')
        setWordSongPlay(() => prepared.playUtterance)
        setWordSongAudioReady(true)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        recordPathASettleEvent(
          'wordSong',
          'reject',
          err instanceof Error ? err.message : String(err),
        )
        console.warn(
          '[App] Word Song Path A unavailable; using silent fallback:',
          err,
        )
        // Even on failure, unblock the cold-mount read-aloud so the
        // silent fallback walks the caption + unlocks chips. See the
        // Math gate's docstring above for the same-shape rationale.
        setWordSongAudioReady(true)
      })

    wordSongAbortRef.current = controller
    // No cleanup — see the Math fetch-effect for the why (route changes
    // must NOT abort, and adding a `[]`-deps unmount cleanup re-creates
    // the StrictMode-double-mount bug shape).
  }, [route, wordSongPlan])

  /**
   * Tear-down effect for Word Song. Same shape as Math's tear-down above.
   * setState calls deferred to a microtask to satisfy the
   * `react-hooks/set-state-in-effect` rule.
   */
  useEffect(() => {
    if (route === 'literacy') return
    const hadAudio =
      wordSongUnloadRef.current !== null ||
      wordSongPlay !== null ||
      wordSongAudioReady
    if (!hadAudio) return
    if (wordSongUnloadRef.current) {
      wordSongUnloadRef.current()
      wordSongUnloadRef.current = null
    }
    if (wordSongAbortRef.current) {
      wordSongAbortRef.current.abort()
      wordSongAbortRef.current = null
    }
    wordSongFetchStartedRef.current = false
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setWordSongPlay(null)
      setWordSongAudioReady(false)
    })
    return () => {
      cancelled = true
    }
  }, [route, wordSongPlay, wordSongAudioReady])

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          {route === 'splash' && (
            <Splash key="splash" onAdvance={handleSplashAdvance} />
          )}
          {route === 'greet' && (
            <Greet key="greet" onAdvance={handleGreetAdvance} />
          )}
          {route === 'hub' && (
            <Hub
              key="hub"
              path={hubEntryPath}
              onPickTree={handleHubPickTree}
              onParentGate={handleHubParentGate}
            />
          )}
          {route === 'math' && (
            <MathScreen
              key="math"
              plan={mathPlan}
              playUtterance={mathPlay ?? undefined}
              audioReady={mathAudioReady}
              onSessionComplete={handleMathComplete}
              onRequestExit={handleBackToHub}
            />
          )}
          {route === 'literacy' && (
            <WordSong
              key="literacy"
              plan={wordSongPlan}
              playUtterance={wordSongPlay ?? undefined}
              audioReady={wordSongAudioReady}
              onSessionComplete={handleWordSongComplete}
              onRequestExit={handleBackToHub}
            />
          )}
          {route === 'session-end' && (
            <SessionEnd
              key="session-end"
              payload={sessionEndPayload}
              onAllDone={handleSessionEndAllDone}
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
