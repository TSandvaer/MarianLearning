import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { cancel as cancelTts, speak } from '../lib/tts'
import { createSfx, type Sfx } from '../lib/sfx'
import { useAudioUnlockGate } from '../lib/audio'
import { recordTap } from '../lib/debug'
import {
  GREET_LINES,
  REPROMPT_AFTER_MS,
  runGreetSequence,
  speakReprompt,
  type GreetSequenceHandle,
  type SpeakFn,
} from './greetSequence'

/**
 * Screen 2 — First Greeting (Meet Melody).
 *
 * Spec: design/session-1.md §"Screen 2 — First Greeting (Meet Melody)" — the
 * AC bullets at lines 202–223 are the contract this component implements.
 *
 * State machine (post-86c9gp99a)
 * ------------------------------
 * The screen has two visible phases:
 *
 *   `wake`  — initial state on mount. Audio context is locked. Melody is
 *             on-screen, idle and breathing; a soft pink ready ring pulses
 *             around her; the entire viewport is a transparent tap target.
 *             No TTS. No SFX. No speech ribbon. No heart. After 8s of no
 *             tap, a finger-tap icon and ear-wiggle play once as a
 *             low-arousal nudge — but the screen sits patiently after that;
 *             no nag loop.
 *
 *   `intro` — post-tap. The same tap that flipped this state synchronously
 *             dispatched `speak(line0)`, unlocking iPad Safari's audio
 *             context (the whole point of Wake). The 4-line greeting plays
 *             with ~400ms gaps; captions reveal word-by-word; the heart
 *             appears after line 3 completes.
 *
 * iPad Safari audio unlock (the bug this ticket fixes)
 * ----------------------------------------------------
 * Splash auto-advances into Greet without a tap. Without this Wake state,
 * Greet's first `speak()` ran inside a useEffect on the screen-mount tick,
 * which iPad Safari treats as a fresh execution context with no user
 * gesture — so the call was silently rejected and the entire greeting died.
 * We fix that by:
 *
 *   1. Constructing the sequence handle on mount but NOT calling start()
 *      until the Wake-tap fires.
 *   2. Calling `handle.start()` synchronously inside the Wake-tap handler
 *      — same JS tick as the gesture, no awaited promises.
 *   3. Also kicking the chime SFX synchronously to unlock the WebAudio
 *      context (Howler bridges to Web Audio for sub-frame latency on
 *      subsequent SFX plays).
 *
 * First-utterance retry (Dave's contract)
 * ---------------------------------------
 * Even with the gesture in the right place, iPadOS occasionally rejects the
 * very first call. `useAudioUnlockGate` arms a 2s watchdog around the
 * speak; if onstart never fires we surface the Wake ring again silently and
 * the next gesture re-fires speak(line0) inside its own synchronous tick.
 * No copy is shown — Marian sees a slightly delayed Melody, not an error.
 *
 * Reduced motion: the global `MotionConfig reducedMotion="user"` collapses
 * spring entrances and stops infinite loops. We additionally branch on
 * `prefers-reduced-motion` here to skip cloud-drift, Melody slide, ring
 * pulse, and heart bob — spec lines 167 and 220 want an explicit absence,
 * not just softer easing.
 */

const HEART_TAP_TRANSITION_MS = 400 // spec line 217: ≤400ms heart-tap → screen 3
const HEART_SQUISH_MS = 250 // spec line 185
const EAR_WIGGLE_MS = 600 // spec line 169
const CLOUD_FADE_MS = 600 // spec line 159
const CLOUD_DRIFT_S = 20 // spec line 159

// Wake state timings (spec lines 166–169, 183, 209)
/** How long after mount the ring fades in. */
const RING_REVEAL_DELAY_MS = 900 // spec line 167
/** Ring fade-in duration. */
const RING_REVEAL_MS = 200
/** How long after the last tap before the wake re-prompt fires. Spec line 183. */
const WAKE_REPROMPT_AFTER_MS = 8_000
/** Finger-tap icon fade-in duration on the wake re-prompt. */
const ICON_FADE_IN_MS = 300
/** Finger-tap icon pulse (`scale: 1 → 1.1 → 1`) duration. */
const ICON_PULSE_MS = 600
/** How long the icon stays at full opacity before fading out. */
const ICON_HOLD_AFTER_PULSE_MS = 2_500
/** Finger-tap icon fade-out duration. */
const ICON_FADE_OUT_MS = 400
/** Watchdog window for "did the engine actually start speaking" — Dave's contract. */
const FIRST_UTTERANCE_RETRY_MS = 2_000
/** Melody's breathing loop period (spec line 166). */
const BREATHING_PERIOD_S = 2.4
/** Ring pulse loop period (spec line 167). */
const RING_PULSE_PERIOD_S = 1.4

const MELODY_ENTRANCE_SPRING = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 22,
  delay: 0.3,
}

const HEART_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 15,
}

const RIBBON_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 20,
}

export type ScreenState = 'wake' | 'intro'

export interface GreetProps {
  /** Called when the heart-tap → Math hand-off should happen. */
  onAdvance: () => void
  /**
   * Test seam: replace the live `speak` with a fake. Defaults to the real
   * lib/tts speak() so the screen mounts in production without ceremony.
   */
  speakFn?: SpeakFn
  /**
   * Test seam: replace the chime SFX. Defaults to a Howler-backed chime
   * tolerant of the asset being absent (see assets-todo.md).
   */
  chime?: Sfx
}

/**
 * Detect prefers-reduced-motion at mount. We rely on the global MotionConfig
 * for the actual easing collapse — this hook just lets us turn OFF
 * infinite-loop animations entirely, which Framer Motion's reduced-motion
 * mode on its own doesn't always do for `animate.x: [0, 10, 0]` arrays.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (ev: MediaQueryListEvent) => setReduced(ev.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return undefined
  }, [])

  return reduced
}

export default function Greet({
  onAdvance,
  speakFn = speak,
  chime,
}: GreetProps) {
  const reducedMotion = usePrefersReducedMotion()

  // Audio unlock gate — wraps line 0's speak with a 2s watchdog. If the
  // engine doesn't actually start speaking within the window, we surface
  // the Wake ring again so the next tap can retry synchronously.
  const gate = useAudioUnlockGate({ watchdogMs: FIRST_UTTERANCE_RETRY_MS })

  // Lazy-init: createSfx kicks off an XHR; we only want one per mount.
  // TODO(86c9gnhez/sfx-chime-soft): asset is pending Thomas — see
  // public/assets/assets-todo.md. createSfx will warn once and play() will
  // be a silent no-op until the file lands.
  const [chimeInstance] = useState<Sfx>(
    () =>
      chime ??
      createSfx({
        src: '/assets/sfx-chime-soft.mp3',
        volume: 0.85,
      }),
  )

  // Top-level screen phase.
  const [screenState, setScreenState] = useState<ScreenState>('wake')

  // Wake re-prompt: shows the finger-tap icon + ear-wiggle once at 8s.
  const [showWakeIcon, setShowWakeIcon] = useState(false)

  // Caption state: one revealed-word count per line. We render the spoken
  // text in a stable speech ribbon underneath Melody; revealing word-by-word
  // mirrors the spec's "passive reading exposure" goal (line 30 + 214).
  const [activeLine, setActiveLine] = useState(0)
  const [revealedByLine, setRevealedByLine] = useState<number[]>(() =>
    GREET_LINES.map(() => 0),
  )
  const [heartReady, setHeartReady] = useState(false)
  const [heartSquishing, setHeartSquishing] = useState(false)
  const [pose, setPose] = useState<'idle' | 'happy'>('idle')
  const [advancing, setAdvancing] = useState(false)

  const earWiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repromptUsedRef = useRef(false)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapHandledRef = useRef(false)
  const wakeRepromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const wakeIconHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const wakeIconRepromptUsedRef = useRef(false)
  const sequenceRef = useRef<GreetSequenceHandle | null>(null)
  /**
   * Same-tick wake-tap guard. Because we bind THREE event handlers
   * (onClick + onTouchEnd + onPointerDown) on the wake-tap target for
   * maximum iPad Safari compatibility, a single user tap can fire the
   * handler up to three times before React commits the state transition
   * out of `wake`. This ref short-circuits all but the first call until
   * the state machine actually advances. Cleared in the relock retry
   * path so a second tap after a silent fail still fires speak() again.
   */
  const wakeTapInFlightRef = useRef(false)

  /** Tear down any timers — used by both unmount cleanup and heart-tap. */
  const clearAllTimers = useCallback(() => {
    if (earWiggleTimerRef.current !== null) {
      clearTimeout(earWiggleTimerRef.current)
      earWiggleTimerRef.current = null
    }
    if (repromptTimerRef.current !== null) {
      clearTimeout(repromptTimerRef.current)
      repromptTimerRef.current = null
    }
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    if (wakeRepromptTimerRef.current !== null) {
      clearTimeout(wakeRepromptTimerRef.current)
      wakeRepromptTimerRef.current = null
    }
    if (wakeIconHideTimerRef.current !== null) {
      clearTimeout(wakeIconHideTimerRef.current)
      wakeIconHideTimerRef.current = null
    }
  }, [])

  const triggerEarWiggle = useCallback(() => {
    setPose('happy')
    if (earWiggleTimerRef.current !== null) {
      clearTimeout(earWiggleTimerRef.current)
    }
    earWiggleTimerRef.current = setTimeout(() => {
      setPose('idle')
      earWiggleTimerRef.current = null
    }, EAR_WIGGLE_MS)
  }, [])

  // --- Re-prompt timer (post-line-4, 20s no-heart-tap) ----------------------

  const scheduleReprompt = useCallback(() => {
    if (repromptUsedRef.current) return
    if (repromptTimerRef.current !== null) {
      clearTimeout(repromptTimerRef.current)
    }
    repromptTimerRef.current = setTimeout(() => {
      repromptTimerRef.current = null
      repromptUsedRef.current = true
      // Re-show line 3's caption. Reset its revealed count so the word-by-word
      // animation re-fires. Spec line 186 reuses the same line.
      const lastIdx = GREET_LINES.length - 1
      setActiveLine(lastIdx)
      setRevealedByLine((prev) => {
        const next = prev.slice()
        next[lastIdx] = 0
        return next
      })
      void speakReprompt({
        speak: speakFn,
        onBoundary: (ev) => {
          setRevealedByLine((prev) => {
            const next = prev.slice()
            next[lastIdx] = Math.max(next[lastIdx], ev.wordIndex + 1)
            return next
          })
        },
      })
    }, REPROMPT_AFTER_MS)
  }, [speakFn])

  // --- Sequence factory -----------------------------------------------------
  //
  // Building the handle is cheap (no speak() until start() is called), so we
  // can rebuild on retry without any teardown ceremony beyond a cancel().

  const buildSequence = useCallback((): GreetSequenceHandle => {
    return runGreetSequence({
      speak: speakFn,
      onLineStart: (i) => {
        setActiveLine(i)
      },
      onLine0Start: () => {
        // The engine actually started speaking — clear the watchdog so we
        // don't surface the relock ring spuriously.
        gate.reportSpeechStart()
      },
      onWordBoundary: (lineIndex, ev) => {
        // Reveal up to and including this word index. Using max() guards
        // against a late native boundary arriving after the synthetic
        // fallback already painted past it (hybrid-recovery path in
        // boundary.ts can briefly double-stamp during catch-up).
        setRevealedByLine((prev) => {
          const next = prev.slice()
          next[lineIndex] = Math.max(next[lineIndex], ev.wordIndex + 1)
          return next
        })
        // Some engines skip onstart entirely but do fire onboundary for the
        // first word — treat the first word boundary as a backup
        // speech-start signal.
        if (lineIndex === 0 && ev.wordIndex === 0) {
          gate.reportSpeechStart()
        }
        // Ear-wiggle on the very first "Hi!" word (line 0). Spec line 169.
        if (lineIndex === 0 && ev.word === 'Hi!') {
          triggerEarWiggle()
        }
      },
      onLineEnd: (i) => {
        // Defensive: if the engine never gave us a boundary for a word
        // (e.g. punctuation-only token), force the line fully revealed at
        // its end. Acceptable per spec line 759's ±2-word tolerance.
        setRevealedByLine((prev) => {
          const total = GREET_LINES[i].split(/\s+/).filter(Boolean).length
          if (prev[i] >= total) return prev
          const next = prev.slice()
          next[i] = total
          return next
        })
      },
      onHeartReady: () => {
        setHeartReady(true)
        // Start the 20s no-tap re-prompt timer once the heart is interactive.
        scheduleReprompt()
      },
    })
  }, [gate, scheduleReprompt, speakFn, triggerEarWiggle])

  // Build the sequence handle on mount; do NOT start() it. Mounting a sequence
  // costs nothing — speak() is only called when start() runs.
  useEffect(() => {
    sequenceRef.current = buildSequence()
    return () => {
      sequenceRef.current?.cancel()
      sequenceRef.current = null
      cancelTts()
      clearAllTimers()
      chimeInstance.unload()
    }
    // We deliberately rebuild only on speakFn / chime changes — the rest of
    // the deps are stable identities from this component's own state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Wake re-prompt (8s no-tap) ------------------------------------------

  const scheduleWakeReprompt = useCallback(() => {
    if (wakeIconRepromptUsedRef.current) return
    if (wakeRepromptTimerRef.current !== null) {
      clearTimeout(wakeRepromptTimerRef.current)
    }
    wakeRepromptTimerRef.current = setTimeout(() => {
      wakeRepromptTimerRef.current = null
      wakeIconRepromptUsedRef.current = true
      // Surface the icon + ear-wiggle wave. No TTS — context is still locked.
      setShowWakeIcon(true)
      triggerEarWiggle()
      // Hide the icon after pulse completes (600ms) + 2.5s hold + 400ms fade.
      wakeIconHideTimerRef.current = setTimeout(() => {
        wakeIconHideTimerRef.current = null
        setShowWakeIcon(false)
      }, ICON_PULSE_MS + ICON_HOLD_AFTER_PULSE_MS)
    }, WAKE_REPROMPT_AFTER_MS)
  }, [triggerEarWiggle])

  const cancelWakeReprompt = useCallback(() => {
    if (wakeRepromptTimerRef.current !== null) {
      clearTimeout(wakeRepromptTimerRef.current)
      wakeRepromptTimerRef.current = null
    }
    if (wakeIconHideTimerRef.current !== null) {
      clearTimeout(wakeIconHideTimerRef.current)
      wakeIconHideTimerRef.current = null
    }
    setShowWakeIcon(false)
  }, [])

  // Arm the 8s wake-reprompt timer on Wake-state mount only. Once Marian taps
  // (screenState moves to 'intro') OR the timer fires, we don't re-arm.
  useEffect(() => {
    if (screenState !== 'wake') return
    scheduleWakeReprompt()
    return cancelWakeReprompt
  }, [cancelWakeReprompt, scheduleWakeReprompt, screenState])

  // --- Wake-tap handler -----------------------------------------------------
  //
  // This is the load-bearing function for the whole iPad Safari fix. The
  // critical contract:
  //
  //   1. It is a synchronous handler (onPointerDown / onClick — no
  //      setTimeout, no Promise, no useEffect dispatch).
  //   2. Inside its body, before any awaited work, it calls
  //      `handle.start()` which synchronously calls `speak(line0)`.
  //   3. It also kicks the chime SFX (silent unlock for the WebAudio context).
  //
  // The reason for the awkward shape (`gate.wrapSpeak(() => start())` with the
  // closure) is that the gate watchdog needs to be armed in the same tick as
  // the speak — otherwise a fast onstart (in tests, mostly) could land before
  // the watchdog even existed.

  const handleWakeTap = useCallback(() => {
    // Idempotent — double-taps are common and we don't want to double-fire.
    if (screenState !== 'wake') {
      // Soft re-gate retry path: if the gate is showing (relock state), this
      // tap is the gesture that retries speak(line0). Let the gate route it.
      if (gate.dispatchGesture()) return
      return
    }

    // Same-tick guard — see wakeTapInFlightRef declaration for why.
    if (wakeTapInFlightRef.current) return
    wakeTapInFlightRef.current = true

    // Cancel the 8s wake re-prompt — she tapped, no nudge needed.
    cancelWakeReprompt()

    // Build a fresh sequence (the one from mount may already be running if
    // we're recovering from a relock state) and kick it off synchronously.
    sequenceRef.current?.cancel()
    cancelTts()
    const handle = buildSequence()
    sequenceRef.current = handle

    // Wrap the synchronous speak with the gate's watchdog. The arrow body
    // runs *before* wrapSpeak returns, so handle.start() — and therefore
    // speak(line0) — sits in the same JS tick as this tap. That's the whole
    // shape iPad Safari requires.
    gate.wrapSpeak(() => {
      handle.start()
      // Silent unlock for the WebAudio (Howler) context — covers the chime
      // we'll need on the heart tap. .play() is defensive: if the asset
      // 404'd, this is a silent no-op; if the engine throws (unlikely),
      // we eat it and move on.
      try {
        chimeInstance.play()
      } catch {
        // Howler can throw synchronously if no audio backend is available.
        // The chime missing isn't a blocker for the unlock pathway.
      }
    })

    // Register a synchronous retry: if the gate watchdog expires, the next
    // user gesture will run this callback inside its own tap handler. We
    // cancel the in-flight (silent) sequence and start a fresh one.
    gate.registerRetry(() => {
      sequenceRef.current?.cancel()
      cancelTts()
      const retryHandle = buildSequence()
      sequenceRef.current = retryHandle
      gate.wrapSpeak(() => {
        retryHandle.start()
      })
    })

    setScreenState('intro')
  }, [buildSequence, cancelWakeReprompt, chimeInstance, gate, screenState])

  // --- Heart tap -------------------------------------------------------------

  const handleHeartTap = useCallback(() => {
    if (!heartReady || tapHandledRef.current) return

    // Heart tap is itself a user-gesture handler. If the audio gate is in a
    // relock state (extremely rare path: the wake speak silently failed AND
    // somehow the heart still appeared — we keep the path symmetrical for
    // future re-use even though Greet's onHeartReady wouldn't fire without
    // line 2 actually being spoken), route through the gate first.
    if (gate.dispatchGesture()) {
      // Don't consume the heart tap on a retry — let the user tap again
      // when Melody has caught up. The retry doesn't advance the screen.
      return
    }

    tapHandledRef.current = true

    // Cancel any in-flight TTS so Melody isn't talking over the chime.
    cancelTts()
    // Cancel the re-prompt — she tapped, no nag needed.
    if (repromptTimerRef.current !== null) {
      clearTimeout(repromptTimerRef.current)
      repromptTimerRef.current = null
    }

    // Wave! Ear-wiggle on transition out per spec line 189.
    triggerEarWiggle()

    // Defensive chime: silent no-op if asset is missing (assets-todo.md).
    chimeInstance.play()

    setHeartSquishing(true)
    setAdvancing(true)

    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      onAdvance()
    }, HEART_TAP_TRANSITION_MS)
  }, [chimeInstance, gate, heartReady, onAdvance, triggerEarWiggle])

  // --- Render ----------------------------------------------------------------

  const heartButtonLabel = useMemo(
    () => GREET_LINES[GREET_LINES.length - 1], // "Tap the heart when you're ready."
    [],
  )

  // The ring is shown during Wake state AND during the 'relock' gate state
  // (silent first-utterance retry). Spec lines 167 + 754.
  const showRing = screenState === 'wake' || gate.showGate

  // The full-viewport tap target is hot during Wake state OR when the gate
  // is asking for a retry. Once we're in `intro` and the gate is happy, the
  // overlay disappears so heart taps and other intra-screen UI work normally.
  const tapTargetActive = screenState === 'wake' || gate.showGate

  // Ribbon visibility guard (post-#86c9gp99a-real iPad fix). The ribbon
  // mounts the moment we have *evidence* that speech actually started:
  //  - Either the gate observed an `onstart` (state === 'unlocked'), or
  //  - At least one word boundary has fired for the active line (covers
  //    engines that skip onstart but emit boundaries — see lib/tts/tts.ts
  //    comment on the onboundary-as-fallback start signal).
  // While the gate is still `pending`, we suppress the ribbon so an empty
  // rounded-rectangle never appears under Melody on a silent-fail iPad path.
  // Once any speech has been heard we keep it mounted across gate re-arms
  // so a successful intro doesn't briefly un-mount the ribbon mid-line.
  const hasRevealedAnyWord = revealedByLine.some((count) => count > 0)
  const shouldShowRibbon = gate.state === 'unlocked' || hasRevealedAnyWord

  return (
    <m.main
      data-testid="greet"
      data-screen-state={screenState}
      data-active-line={activeLine}
      data-heart-ready={heartReady ? 'true' : 'false'}
      data-gate-state={gate.state}
      className="
        relative flex h-full w-full flex-col items-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      {/* Cloud background. Sits behind everything; fades in over 600ms; drifts
          horizontally on a 20s loop unless reduced-motion is set. */}
      <m.div
        data-testid="greet-clouds"
        aria-hidden
        className="
          pointer-events-none absolute inset-0 -z-10
          bg-no-repeat bg-cover bg-center
        "
        style={{ backgroundImage: 'url(/assets/bg-clouds.svg)' }}
        initial={{ opacity: 0, x: 0 }}
        animate={
          reducedMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: [0, 10, 0] }
        }
        transition={
          reducedMotion
            ? { opacity: { duration: CLOUD_FADE_MS / 1000, ease: 'easeOut' } }
            : {
                opacity: { duration: CLOUD_FADE_MS / 1000, ease: 'easeOut' },
                x: {
                  duration: CLOUD_DRIFT_S,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                },
              }
        }
      />

      {/* Melody. Sized to fill ~60% of viewport height per spec line 136.
          AnimatePresence cross-fades idle ↔ happy on the ear-wiggle cue.
          We use the default (non-wait) mode so both poses briefly co-exist
          during the swap — that's the soft cross-fade Kyle's spec calls for
          (line 169, "sprite swap idle → happy for 600ms then back"), and it
          also keeps tests deterministic because the new element mounts
          immediately rather than waiting on the previous one's exit anim.
          layoutId="melody" is set so Screen 3+ can shared-element-transition
          her position (spec line 757).

          Wake state: she breathes (`scale: [1, 1.05, 1]` over 2.4s, infinite
          loop). Spec line 166 — the value 1.05 was specifically chosen
          (Dave's consult: 1.015 was rejected as imperceptibly subtle on
          iPad scale and read as frozen). */}
      <div
        data-testid="greet-melody-slot"
        className="relative flex h-[60vh] w-full flex-1 items-center justify-center"
      >
        {/* Ready ring — Wake state only (or the silent retry relock state).
            Pure SVG, no asset file. Spec line 198 documents this is inline. */}
        <AnimatePresence>
          {showRing && (
            <m.div
              key="ring"
              data-testid="greet-ready-ring"
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={
                reducedMotion
                  ? { scale: 1, opacity: 0.5 }
                  : {
                      scale: 1,
                      opacity: [0.4, 0.9, 0.4],
                    }
              }
              exit={{ opacity: 0, scale: 0.95 }}
              transition={
                reducedMotion
                  ? {
                      delay: RING_REVEAL_DELAY_MS / 1000,
                      duration: RING_REVEAL_MS / 1000,
                    }
                  : {
                      scale: {
                        delay: RING_REVEAL_DELAY_MS / 1000,
                        duration: RING_REVEAL_MS / 1000,
                        ease: 'easeOut',
                      },
                      opacity: {
                        delay: RING_REVEAL_DELAY_MS / 1000,
                        duration: RING_PULSE_PERIOD_S,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
              }
            >
              {/* The ring itself: a circle ~24pt outside Melody's bounding
                  silhouette. We render relative to her viewport slot; the
                  `60vh` Melody bounding box puts her circumscribed circle
                  at roughly 30vh radius, so the ring sits at ~32vh radius
                  (24pt extra). Drawn with a viewBox so it scales cleanly
                  on iPad portrait. */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                className="h-[64vh] w-[64vh]"
                role="presentation"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#FFC0CB"
                  strokeWidth="3"
                  strokeOpacity="1"
                />
              </svg>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          <m.img
            layoutId="melody"
            key={pose}
            data-testid="greet-melody"
            data-pose={pose}
            src={`/assets/melody-${pose}.svg`}
            alt="Melody"
            draggable={false}
            className="absolute h-full w-auto select-none"
            initial={
              reducedMotion ? { opacity: 0 } : { x: -120, y: 60, opacity: 0 }
            }
            animate={
              reducedMotion
                ? { opacity: 1, scale: 1 }
                : {
                    x: 0,
                    y: 0,
                    opacity: 1,
                    scale: [1, 1.05, 1],
                  }
            }
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : {
                    ...MELODY_ENTRANCE_SPRING,
                    scale: {
                      duration: BREATHING_PERIOD_S,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      // Delay so breathing only starts after the slide-in lands.
                      delay: 0.3 + 0.7,
                    },
                  }
            }
          />
        </AnimatePresence>

        {/* Wake re-prompt: finger-tap icon centered on the ring. Fades in,
            pulses once, fades out. Triggered exactly once at 8s of no tap.
            Spec lines 195 + 209.

            Inlined-SVG (post-#86c9gp99a-real iPad fix)
            -------------------------------------------
            We render the icon as inline SVG markup rather than as an
            `<img src="/assets/icon-finger-tap.svg">`. Thomas's real-device
            iPad install showed a broken-image glyph here even though the
            asset itself serves cleanly (HTTP 200, correct content-type,
            valid XML). iPad Safari standalone PWA mode has documented
            quirks fetching/decoding SVGs via `<img>` — likely a service
            worker / cache interaction or the leading XML declaration
            tripping the image sniffer. Inlining sidesteps the entire
            class of bug and saves an HTTP request. The markup mirrors
            `public/assets/icon-finger-tap.svg` byte-for-byte (sans the
            authoring comment block); keep the two in sync if either
            changes — they're both shipped because the standalone-asset
            file is also referenced by the PWA precache manifest. */}
        <AnimatePresence>
          {showWakeIcon && (
            <m.svg
              key="wake-icon"
              data-testid="greet-wake-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              role="img"
              aria-label="Tap here"
              className="pointer-events-none absolute select-none"
              style={{
                // 48pt at 1.333px/pt ≈ 64px. Matches the icon's native viewBox.
                width: '64px',
                height: '64px',
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={
                reducedMotion
                  ? { opacity: [0, 1, 1, 0], scale: 1 }
                  : { opacity: [0, 1, 1, 0], scale: [1, 1.1, 1, 1] }
              }
              exit={{ opacity: 0 }}
              transition={
                reducedMotion
                  ? {
                      opacity: {
                        duration:
                          (ICON_FADE_IN_MS +
                            ICON_PULSE_MS +
                            ICON_HOLD_AFTER_PULSE_MS +
                            ICON_FADE_OUT_MS) /
                          1000,
                        times: [
                          0,
                          ICON_FADE_IN_MS /
                            (ICON_FADE_IN_MS +
                              ICON_PULSE_MS +
                              ICON_HOLD_AFTER_PULSE_MS +
                              ICON_FADE_OUT_MS),
                          (ICON_FADE_IN_MS +
                            ICON_PULSE_MS +
                            ICON_HOLD_AFTER_PULSE_MS) /
                            (ICON_FADE_IN_MS +
                              ICON_PULSE_MS +
                              ICON_HOLD_AFTER_PULSE_MS +
                              ICON_FADE_OUT_MS),
                          1,
                        ],
                      },
                    }
                  : {
                      // Spec line 209: 300ms fade-in, 600ms pulse, 2500ms hold,
                      // 400ms fade-out. Use keyframe times so we don't need
                      // multiple chained transitions.
                      duration:
                        (ICON_FADE_IN_MS +
                          ICON_PULSE_MS +
                          ICON_HOLD_AFTER_PULSE_MS +
                          ICON_FADE_OUT_MS) /
                        1000,
                      times: [
                        0,
                        ICON_FADE_IN_MS /
                          (ICON_FADE_IN_MS +
                            ICON_PULSE_MS +
                            ICON_HOLD_AFTER_PULSE_MS +
                            ICON_FADE_OUT_MS),
                        (ICON_FADE_IN_MS + ICON_PULSE_MS) /
                          (ICON_FADE_IN_MS +
                            ICON_PULSE_MS +
                            ICON_HOLD_AFTER_PULSE_MS +
                            ICON_FADE_OUT_MS),
                        1,
                      ],
                      ease: 'easeInOut',
                    }
              }
            >
              <title>Tap here</title>
              {/* Soft target dot beneath fingertip */}
              <circle cx="32" cy="50" r="6" fill="#F48FB1" opacity="0.35" />
              <circle cx="32" cy="50" r="3" fill="#F48FB1" opacity="0.55" />
              {/* Hand + extended index finger, single closed path. Mirrors
                  public/assets/icon-finger-tap.svg verbatim — keep in sync. */}
              <path
                d="M 32 44 C 28.5 44, 27 41, 27 37 L 27 24 C 27 20.5, 29 18, 32 18 C 35 18, 37 20.5, 37 24 L 37 33 C 39 32, 42 33, 43 36 L 44.5 41 C 46 45, 46 49, 44 52 C 42 55, 38 56, 34 56 L 28 56 C 23 56, 20 53, 20 48 L 20 41 C 20 37, 22 35, 25 35 C 26.5 35, 27 36, 27 37 Z"
                fill="#F48FB1"
                stroke="#3D2B3D"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Soft highlight on the finger pad for volume */}
              <ellipse
                cx="30"
                cy="24"
                rx="2.2"
                ry="3.2"
                fill="#FFC0CB"
                opacity="0.6"
              />
              {/* Wrist hint: subtle rounded base under the fist */}
              <path
                d="M 24 55 C 24 58, 27 59, 32 59 C 37 59, 40 58, 40 55 Z"
                fill="#F48FB1"
              />
            </m.svg>
          )}
        </AnimatePresence>
      </div>

      {/* Speech ribbon. White rounded rect, 88% viewport width, pink border.
          Hidden during Wake state (spec line 137). Scales in from 0.9 → 1
          on first mount per spec line 170.

          Additionally hidden while the audio-unlock gate is still `pending`
          OR `relock` AND no words have been revealed yet — i.e. when iPad
          Safari silently rejected the speak() call and we have nothing to
          show. Without this guard, the ribbon mounts as an empty rounded
          rectangle the moment we transition to `intro`, which Thomas saw
          on the real-device PWA after the first iPad QA run. The condition
          is permissive once any speech has been heard (revealedByLine > 0),
          so an in-flight retry that landed at least one word still keeps
          the ribbon mounted across re-arms of the gate. */}
      {screenState === 'intro' && shouldShowRibbon && (
        <m.div
          data-testid="greet-ribbon"
          role="status"
          aria-live="polite"
          className="
            mx-auto mt-2 mb-6 w-[88%] max-w-2xl
            rounded-3xl border-[3px] border-my-pink bg-white
            px-6 py-4
            shadow-[0_8px_24px_rgba(244,143,177,0.18)]
            text-center
          "
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0.3 } : RIBBON_SPRING}
        >
          <p
            data-testid="greet-caption"
            // ≥28pt body text per spec AC line 221 (1pt ≈ 1.333px → ≥37px).
            // Tailwind's text-[2.4rem] = 38.4px, comfortably above the floor.
            className="font-display text-[2.4rem] leading-snug text-ink"
          >
            {renderCaption(activeLine, revealedByLine[activeLine] ?? 0)}
          </p>
        </m.div>
      )}

      {/* Heart CTA. Hidden until line 3 (HEART_REVEAL_AFTER_LINE_INDEX)
          completes, then springs in. Idle bob (y: [0, -6, 0]) on a 2s loop
          unless reduced-motion. Tap → squish + chime + advance. */}
      <div className="mb-8 flex h-[12vh] w-full items-center justify-center">
        <AnimatePresence>
          {heartReady && (
            <m.button
              key="heart"
              data-testid="greet-heart"
              type="button"
              aria-label={heartButtonLabel}
              onClick={handleHeartTap}
              disabled={advancing}
              className="
                relative flex select-none items-center justify-center
                bg-transparent border-0 p-0 cursor-pointer
                disabled:cursor-default
                touch-manipulation
              "
              style={{
                // Spec line 138: 88pt tall × 120pt wide. 1pt ≈ 1.333px →
                // 117px tall × 160px wide. Above the 60pt minimum touch
                // target (spec line 19) by a wide margin.
                width: '160px',
                height: '117px',
                minWidth: '60px',
                minHeight: '60px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={
                heartSquishing
                  ? { scale: [1, 1.15, 0.95, 1], opacity: 1 }
                  : reducedMotion
                    ? { scale: 1, opacity: 1, y: 0 }
                    : { scale: 1, opacity: 1, y: [0, -6, 0] }
              }
              exit={{ scale: 0, opacity: 0 }}
              transition={
                heartSquishing
                  ? { duration: HEART_SQUISH_MS / 1000, ease: 'easeOut' }
                  : reducedMotion
                    ? { scale: { duration: 0.3 }, opacity: { duration: 0.3 } }
                    : {
                        scale: HEART_SPRING,
                        opacity: HEART_SPRING,
                        y: {
                          duration: 2,
                          repeat: Infinity,
                          repeatType: 'mirror',
                          ease: 'easeInOut',
                        },
                      }
              }
            >
              <img
                src="/assets/heart-button.svg"
                alt=""
                aria-hidden
                draggable={false}
                className="h-full w-full pointer-events-none"
              />
            </m.button>
          )}
        </AnimatePresence>
      </div>

      {/* Full-viewport tap target. Sits ABOVE everything else when active
          (Wake state or relock retry) so any pixel inside safe-area is the
          gesture trigger. Spec line 140 + 210.

          Event binding (post-#86c9gp99a-real iPad fix)
          ---------------------------------------------
          We bind THREE handlers, all wired to the same idempotent
          `handleWakeTap`:

            - `onClick` — load-bearing for iPad Safari standalone PWA. This
              is the gesture event Webkit reliably honours as a user
              activation for `speechSynthesis.speak()`. The previous
              implementation was `onPointerDown`-only, which Thomas saw
              fail silently on a real iPad install.
            - `onTouchEnd` — backup for any iPad-Safari quirk where the
              synthesized click after pointerdown→pointerup gets eaten
              by the button unmounting itself in the same tick (we flip
              `tapTargetActive` to false the moment we transition to
              `intro`). Touchend fires earlier in the gesture flow and
              is also a known-good user-activation event.
            - `onPointerDown` — kept for snappy desktop / Chromium response
              and for any gesture path where pointerdown does count.

          The handler is idempotent (it early-returns when `screenState !==
          'wake'` and the gate isn't in retry mode) so multiple events
          firing in quick succession don't double-fire speak() or chime. */}
      {tapTargetActive && (
        <button
          type="button"
          data-testid="greet-wake-tap-target"
          aria-label="Tap to start"
          // Each handler records its event type to the debug bus BEFORE
          // delegating to the shared (idempotent) wake-tap logic. The bus
          // is a no-op without the `?debug=1` overlay subscribed, so this
          // is free in normal sessions but priceless when Thomas needs to
          // confirm that touchend / click / pointerdown are actually
          // firing on his iPad.
          onClick={() => {
            recordTap('click', 'greet-wake-tap-target')
            handleWakeTap()
          }}
          onTouchEnd={() => {
            recordTap('touchend', 'greet-wake-tap-target')
            handleWakeTap()
          }}
          onPointerDown={() => {
            recordTap('pointerdown', 'greet-wake-tap-target')
            handleWakeTap()
          }}
          className="
            absolute inset-0 z-50
            cursor-pointer
            border-0 bg-transparent p-0
            touch-manipulation
          "
          style={{
            // Cover the safe-area rect, not the whole viewport — spec line 140.
            top: 'env(safe-area-inset-top)',
            bottom: 'env(safe-area-inset-bottom)',
            left: 'env(safe-area-inset-left)',
            right: 'env(safe-area-inset-right)',
            // No outline — invisible affordance. The ring + Melody carry the read.
            outline: 'none',
          }}
        />
      )}
    </m.main>
  )
}

/**
 * Render the caption for `lineIndex`, revealing the first `revealedCount`
 * words. Each word is its own `<m.span>` so word-by-word fade-in animates
 * cleanly and so tests can assert on individual words.
 */
function renderCaption(lineIndex: number, revealedCount: number) {
  const text = GREET_LINES[lineIndex] ?? ''
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <m.span
      key={`${lineIndex}-${i}`}
      data-testid="greet-caption-word"
      data-revealed={i < revealedCount ? 'true' : 'false'}
      data-word={word}
      className="inline-block"
      style={{ marginRight: i === words.length - 1 ? 0 : '0.4em' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: i < revealedCount ? 1 : 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {word}
    </m.span>
  ))
}
