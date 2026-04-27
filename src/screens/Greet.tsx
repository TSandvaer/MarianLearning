import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { createSfx, type Sfx } from '../lib/sfx'
import {
  cancelPreRecorded,
  playGreetLine as defaultPlayGreetLine,
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
  useAudioUnlockGate,
  type GreetLineKey,
  type PlayGreetLineOptions,
} from '../lib/audio'
import {
  recordHandlerErrorEvent,
  recordRawTapEvent,
  recordSpeakAttempt,
  recordSpeakSkippedEvent,
  recordTap,
  recordUnlockStateEvent,
  sampleAudioCtxOnTap,
} from '../lib/debug'
import {
  GREET_LINES,
  REPROMPT_AFTER_MS,
  runGreetSequence,
  speakReprompt,
  type GreetSequenceHandle,
  type SpeakFn,
  type SpeakLikeOptions,
} from './greetSequence'

/**
 * Map line text → pre-recorded key. The text strings are owned by
 * `greetSequence.GREET_LINES`; this map is the bridge between the
 * orchestrator (text-based) and the new pre-recorded engine (key-based).
 * Built off GREET_LINES at module load so any future drift is a compile-
 * time-detectable mismatch.
 */
const LINE_TEXT_TO_KEY: Record<string, GreetLineKey> = {
  [GREET_LINES[0]]: 'hi',
  [GREET_LINES[1]]: 'imMelody',
  [GREET_LINES[2]]: 'niceToMeet',
  [GREET_LINES[3]]: 'tapHeart',
}

/**
 * Type for the pre-recorded playback function — exposed as a Greet prop
 * test seam (mirrors the now-removed `speakFn` seam).
 */
export type PlayGreetLineFn = (
  key: GreetLineKey,
  opts?: PlayGreetLineOptions,
) => Promise<void>

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
 * Greet's first audio call ran inside a useEffect on the screen-mount tick,
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
 * Pre-recorded MP3s (post-86c9gqprh)
 * ----------------------------------
 * The 4 fixed Greet lines play through Howler.js (`lib/audio/preRecorded`),
 * not the old Web Speech path. This was the architectural pivot after 5
 * rounds of band-aiding iPad Safari's "first-speak unreliable" pattern
 * (PRs #18, #21, #22, #23, #24). All TTS now uses server-side Azure
 * Speech (Path A) via `lib/audio/`; the old `lib/tts/` module is removed.
 *
 * First-utterance retry (Dave's contract)
 * ---------------------------------------
 * Even with the gesture in the right place, iPadOS can occasionally reject
 * the very first audio call (e.g. WebAudio context warm-up). `useAudioUnlockGate`
 * arms a 6s watchdog around the play; if `onPlay` never fires we surface
 * the Wake ring again silently and the next gesture re-fires line 0 inside
 * its own synchronous tick. No copy is shown — Marian sees a slightly
 * delayed Melody, not an error. (Window was 1.5s during the early
 * pre-recorded MP3 era because Howler `onplay` fires ~50ms after `play()`;
 * Phase-7 of ticket 86c9gvd0y bumped it to 6s to outlast the event-driven
 * AudioContext resume await for cold-iPad audio-session resumption. See
 * FIRST_UTTERANCE_RETRY_MS below.)
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
/**
 * Watchdog window for "did the audio engine actually start playing" — Dave's
 * contract.
 *
 * Phase-7 (ticket 86c9gvd0y, 2026-04-26): bumped 1_500 → 6_000 ms.
 * `awaitHowlerContextResume` now waits up to 5_000 ms for the AudioContext
 * to actually transition from `'suspended'` → `'running'` (event-driven on
 * `statechange`, sized against the worst-observed 3.6 s cold-iPad latency
 * after long idle). The watchdog must outlast that resume wait plus the
 * ~50 ms Howler play → `onplay` settle time, otherwise the gate relocks
 * before play() ever runs. 6 s is the resume-await ceiling + 1 s slack.
 *
 * The cost: Marian could see up to 6 s of silence between her tap and
 * audio on a worst-case cold-resume. The follow-up (ticket TBD) is to
 * surface a "loading" indicator during the wait — out of scope for this
 * patch; the relock ring remains the safety net.
 *
 * History
 * -------
 *   - 2_000 ms (PRs #18-#22): original Web Speech sizing.
 *   - 5_000 ms (PR #24, round 5): bumped because Web Speech had 3-5 s
 *     first-utterance latency on iPad.
 *   - 1_500 ms (ticket 86c9gqprh): shrunk after the pre-recorded MP3
 *     pivot. Howler `onplay` fires ~50 ms after `play()` once unlocked;
 *     1.5 s was generous for cold-cache decode.
 *   - 6_000 ms (Phase-7, ticket 86c9gvd0y): bumped to accommodate the
 *     event-driven resume await for cold-iPad audio-session resumption.
 */
const FIRST_UTTERANCE_RETRY_MS = 6_000
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
   * Test seam: replace the live pre-recorded playback with a fake.
   * Defaults to the real `lib/audio.playGreetLine()` so the screen mounts
   * in production without ceremony.
   *
   * Why this is shaped (key, opts) and not (text, opts): post-86c9gqprh
   * the Greet lines are pre-recorded MP3s identified by stable keys, not
   * Web Speech utterances identified by their text. The orchestrator
   * (`greetSequence.ts`) still works in text-space; this component bridges
   * via `LINE_TEXT_TO_KEY` inside `playLineAdapter`.
   */
  playGreetLineFn?: PlayGreetLineFn
  /**
   * Test seam: replace the chime SFX. Defaults to a Howler-backed chime
   * tolerant of the asset being absent (see assets-todo.md).
   */
  chime?: Sfx
  /**
   * Test seam: spy on the per-gesture `Howler.ctx.resume()` kick added in
   * Phase 2 of ticket 86c9gvd0y. Defaults to the real
   * `resumeHowlerContextOnGesture` from `lib/audio`. Tests use this to
   * assert the call lands synchronously on every gesture path (wake-tap,
   * relock-retry-tap, heart-tap) without standing up a fake `Howler.ctx`.
   *
   * Production callers should never override this — the helper is a safe,
   * idempotent no-op when no audio context exists, so plumbing the real
   * one is correct for every shipping path.
   */
  resumeAudioContext?: () => void
  /**
   * Test seam: spy on the per-gesture iOS audio-session unlock added in
   * Phase 5 of ticket 86c9gvd0y. Defaults to the real
   * `unlockIosAudioSession` from `lib/audio`. Tests use this to assert
   * the silent-buffer kick lands synchronously inside the gesture
   * handler tick, alongside `resumeAudioContext`.
   *
   * Production callers should never override this — like the resume
   * kick, the helper is a safe no-op when no audio context exists.
   *
   * Returns optional Phase-8 (ticket 86c9gvd0y) result fields used to
   * thread `howlerUnlockMethodCalled` into the unlock-state probe row;
   * test spies that return undefined are tolerated via optional
   * chaining at the call site.
   */
  unlockAudioSession?: () => {
    howlerUnlockMethodCalled?: 'called' | 'missing' | 'threw'
  } | void
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
  playGreetLineFn = defaultPlayGreetLine,
  chime,
  resumeAudioContext,
  unlockAudioSession,
}: GreetProps) {
  // Bind the per-gesture audio-context resume kick. Defaults to the real
  // helper from `lib/audio`; tests can inject a spy to observe call
  // ordering. We deliberately do NOT call this lazily on each tap — the
  // identity is stable across renders so the same default reference flows
  // through every gesture handler closure without re-creating the kick.
  const resumeAudioCtx = resumeAudioContext ?? resumeHowlerContextOnGesture
  // Phase-5 (ticket 86c9gvd0y): per-gesture iOS audio-session unlock kick.
  // Same identity-stable shape as `resumeAudioCtx`. Tests inject a spy.
  const unlockAudioSessionFn = unlockAudioSession ?? unlockIosAudioSession
  const reducedMotion = usePrefersReducedMotion()

  // Audio unlock gate — wraps line 0's play with a 1.5s watchdog. If the
  // Howl `onplay` event doesn't fire within the window, we surface the
  // Wake ring again so the next tap can retry synchronously.
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
   * Index of the most recent line whose `playGreetLine` rejected. The relock
   * retry path reads this so the next gesture re-fires the failed line, not
   * line 0 — Marian shouldn't have to listen to "Hi!" again every time a
   * mid-sequence MP3 fails (ticket 86c9gr43t).
   *
   * Reset to `null` after a successful retry registration consumes it. We
   * use a ref (not state) because the gate's retry callback closes over the
   * value and a stale render would re-fire the wrong line. A ref is read
   * fresh on every dispatch.
   */
  const lastFailedLineRef = useRef<number | null>(null)
  /**
   * DOM ref for the wake-tap target. We attach native `addEventListener`
   * handlers directly (in addition to React's onClick / onTouchEnd /
   * onPointerDown) for two distinct reasons:
   *
   *   1. **Raw-event diagnostics.** The native handler fires BEFORE
   *      React's synthetic-event system runs. Recording into the debug
   *      bus from there lets us tell apart "iPad isn't delivering events
   *      to this element at all" from "events arrive but React's binding
   *      isn't catching them" — a distinction that's been load-bearing in
   *      this ticket's debugging.
   *   2. **iPad Safari touch-handling 'wake-up'.** A documented Webkit
   *      quirk: certain elements only start receiving touch events
   *      reliably once *some* listener has been attached via the native
   *      `addEventListener('touchstart', ...)` API. The React synthetic
   *      `onTouchStart` doesn't always trigger this internal wake-up.
   *      A no-op native touchstart listener is the standard workaround.
   */
  const wakeTapTargetRef = useRef<HTMLButtonElement | null>(null)
  /**
   * Same-tick wake-tap guard. Because we bind THREE event handlers
   * (onClick + onTouchEnd + onPointerDown) on the wake-tap target for
   * maximum iPad Safari compatibility, a single user tap can fire the
   * handler up to three times before React commits the state transition
   * out of `wake`. This ref short-circuits all but the first call until
   * the state machine actually advances. Cleared via the screenState-
   * change effect so a second tap after a silent fail still fires
   * speak() again, and via a microtask in the relock retry branch so
   * the same physical tap can't queue multiple retry-speak() calls.
   *
   * Round 5 (ticket 86c9gp99a) extension: this guard now also gates the
   * relock-retry branch (`screenState !== 'wake'` → `gate.dispatchGesture`).
   * Without that, a single physical tap during the relock state could
   * fire `dispatchGesture` three times (once per synthetic event), all
   * three reading `gate.state === 'relock'` from the same render closure
   * and each invoking the registered retry callback — that's the
   * "queues behind the in-flight one" pattern Thomas reported.
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

  // --- SpeakFn adapter ------------------------------------------------------
  //
  // The orchestrator (`runGreetSequence`) and the re-prompt helper still work
  // in text-space — same shape as the Web Speech-era contract. We bridge to
  // the key-based pre-recorded engine here. Two responsibilities:
  //
  //   1. Map line text → GreetLineKey via LINE_TEXT_TO_KEY (module-scope).
  //   2. Translate the orchestrator's onStart/onBoundary callbacks onto the
  //      pre-recorded engine's onPlay/onWordTick events. The shape match is
  //      1:1 by design — both sides describe "audio started" and "advance
  //      to word index N", just with different transport.
  //
  // This adapter is the ONLY production caller into `playGreetLineFn`; tests
  // mock the prop and so they never see the adapter directly.

  const playLineAdapter: SpeakFn = useCallback(
    (text: string, opts?: SpeakLikeOptions) => {
      const key = LINE_TEXT_TO_KEY[text]
      if (!key) {
        // Unknown line — should be impossible given GREET_LINES is the
        // single source of truth on both sides, but reject loudly so a
        // future drift surfaces in the failing-promise path the
        // orchestrator already handles (silent halt, no auto-retry).
        return Promise.reject(
          new Error(`[Greet] no pre-recorded key for line "${text}"`),
        )
      }
      return playGreetLineFn(key, {
        onPlay: opts?.onStart,
        onWordTick: opts?.onBoundary
          ? (wordIndex) => {
              const words = text.split(/\s+/).filter(Boolean)
              opts.onBoundary?.({
                wordIndex,
                word: words[wordIndex] ?? '',
                charIndex: 0,
              })
            }
          : undefined,
      })
    },
    [playGreetLineFn],
  )

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
        speak: playLineAdapter,
        onBoundary: (ev) => {
          setRevealedByLine((prev) => {
            const next = prev.slice()
            next[lastIdx] = Math.max(next[lastIdx], ev.wordIndex + 1)
            return next
          })
        },
      })
    }, REPROMPT_AFTER_MS)
  }, [playLineAdapter])

  // --- Sequence factory -----------------------------------------------------
  //
  // Building the handle is cheap (no speak() until start() is called), so we
  // can rebuild on retry without any teardown ceremony beyond a cancel().

  const buildSequence = useCallback((): GreetSequenceHandle => {
    return runGreetSequence({
      speak: playLineAdapter,
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
      onLineError: (i, err) => {
        // Ticket 86c9gr43t (GBUG-7): a Howler `loaderror` / `playerror`
        // rejected the line. Surface to the debug overlay so iPad QA can
        // see WHICH MP3 failed without console access; flip the gate to
        // `relock` so the ring re-appears; mark the failed line so the
        // next gesture retries it (rather than restarting at line 0).
        // The retry callback itself is registered in handleWakeTap and
        // closes over buildSequence + reads `lastFailedLineRef.current`
        // to decide where to start.
        recordSpeakAttempt(
          GREET_LINES[i] ?? `(line ${i})`,
          'errored',
          err.message,
        )
        lastFailedLineRef.current = i
        gate.reportSpeechError()
      },
    })
  }, [gate, scheduleReprompt, playLineAdapter, triggerEarWiggle])

  // Build the sequence handle on mount; do NOT start() it. Mounting a sequence
  // costs nothing — speak() is only called when start() runs.
  useEffect(() => {
    sequenceRef.current = buildSequence()
    return () => {
      sequenceRef.current?.cancel()
      sequenceRef.current = null
      // Cancel any in-flight pre-recorded playback.
      cancelPreRecorded()
      clearAllTimers()
      chimeInstance.unload()
    }
    // We deliberately rebuild only when the playback-fn / chime change —
    // the rest of the deps are stable identities from this component's own
    // state setters.
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

  // Belt-and-braces reset of the same-tick wake-tap guard (Kevin's NIT 1
  // from PR #21 review). The ref is cleared here on every screen-state
  // transition so a future refactor — or some unanticipated mount-time
  // synthetic event — can't leave it stuck `true` and silently swallow
  // every subsequent user tap. Functionally redundant on the happy path
  // (the only writer is `handleWakeTap` itself) but cheap insurance for
  // an iPad-Safari path we've already been bitten by once. The ref is
  // also reset by the gate-driven retry pathway, so this effect doesn't
  // override that — it just ensures any state transition (wake → intro,
  // intro → wake on relock-and-back, etc.) starts with a clean slate.
  useEffect(() => {
    wakeTapInFlightRef.current = false
  }, [screenState])

  // --- Raw-event shadow-recording on the wake-tap target -------------------
  //
  // Diagnostic-only. Whenever the wake-tap target is mounted, attach native
  // listeners that record each event to the debug bus BEFORE React's
  // synthetic-event system runs. The handlers themselves are no-ops (the
  // actual tap logic still flows through React's onClick/onTouchEnd/
  // onPointerDown), so this is purely additive — it cannot suppress or
  // alter the synthetic-event path.
  //
  // The native touchstart handler also serves as the iPad-Safari "wake-up"
  // workaround: a documented Webkit quirk where certain elements only
  // start delivering touch events reliably once a native (not React-
  // synthetic) listener has been attached.
  useEffect(() => {
    const node = wakeTapTargetRef.current
    if (!node) return

    const onTouchStart = () => {
      recordRawTapEvent('touchstart', 'greet-wake-tap-target')
    }
    const onTouchEnd = () => {
      recordRawTapEvent('touchend', 'greet-wake-tap-target')
    }
    const onPointerDown = () => {
      recordRawTapEvent('pointerdown', 'greet-wake-tap-target')
    }
    const onClick = () => {
      recordRawTapEvent('click', 'greet-wake-tap-target')
    }

    // `passive: true` so the native listener never blocks the browser's
    // default touch handling. We don't preventDefault from these listeners
    // in any case — we only observe.
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchend', onTouchEnd, { passive: true })
    node.addEventListener('pointerdown', onPointerDown, { passive: true })
    node.addEventListener('click', onClick)

    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('click', onClick)
    }
    // Re-bind whenever the target's mount state flips so the listeners are
    // attached to the live DOM node, not a stale ref. The conditional
    // render gates on `screenState === 'wake' || gate.showGate` (see
    // tapTargetActive below); we depend on the same inputs so this effect
    // re-runs across mount/unmount cycles and any intervening re-render
    // doesn't leave dangling listeners. (gate.showGate is a derived
    // boolean stable across renders within a state.)
  }, [screenState, gate.showGate])

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
    // Phase-3 (ticket 86c9gvd0y) instrumentation. The whole body is
    // wrapped in a try/catch so any throw — from gate calls, from
    // resumeAudioCtx, from buildSequence, from chimeInstance.play —
    // gets a row in the audio-ctx log before it propagates. We
    // re-throw at the end of the catch block to preserve production
    // behaviour (React's error boundary still gets the error).
    //
    // The `recordSpeakSkippedEvent` calls below land at every early-
    // return. Together with `recordSpeakCall` from preRecorded.ts and
    // the pre-existing `sampleAudioCtxOnTap` call from the onClick /
    // onTouchEnd / onPointerDown bindings, the iPad export-log will
    // now show, per tap:
    //
    //   - whether the handler entered (sampleAudioCtxOnTap rows)
    //   - whether the handler short-circuited and why
    //     (speak-skipped rows)
    //   - whether speak() was actually called (speak-call rows)
    //   - whether the handler threw (handler-error rows)
    //
    // The probe is `?debug=1`-gated — production sessions pay one
    // null check per record call.
    try {
      // Idempotent — double-taps are common and we don't want to double-fire.
      if (screenState !== 'wake') {
        // Soft re-gate retry path: if the gate is showing (relock state),
        // this tap is the gesture that retries speak(line0). Let the gate
        // route it.
        //
        // Same-tick guard applies HERE too (round 5, ticket 86c9gp99a). A
        // single physical tap during relock fires three synthetic events
        // (touchend + pointerdown + click); without the guard, all three
        // see `gate.state === 'relock'` from the same render closure and
        // each runs the registered retry callback, queuing three speak()
        // calls that compete on the engine. Microtask reset clears the
        // guard once the React render cycle has commited the new state.
        if (wakeTapInFlightRef.current) {
          recordSpeakSkippedEvent('non-wake-in-flight-guard')
          return
        }
        wakeTapInFlightRef.current = true
        // Phase-6 instrumentation: snapshot Howler's internal unlock
        // flags BEFORE the unlock helper runs. Pairs with the post-call
        // row below; the iPad export shows pool=0 → pool=10 across the
        // helper, confirming the pool-refill fix landed in this gesture.
        recordUnlockStateEvent()
        // Phase-2 fix for ticket 86c9gvd0y: kick `Howler.ctx.resume()`
        // synchronously inside the gesture, BEFORE the registered retry
        // (which goes through `gate.wrapSpeak` → `playGreetLine` → Howler
        // `play()` in a microtask). The retry path is the very case where
        // a previous tap landed on a suspended context and Howler's
        // implicit gesture-unlock left the buffer source stalled. By
        // resuming explicitly here we put the context into a transitioning
        // state during the gesture window, so the microtask `play()` runs
        // against a context that's already moving toward `running`.
        resumeAudioCtx()
        // Phase-5 fix for ticket 86c9gvd0y: re-engage the OS-level iOS
        // audio session by playing a 1-sample silent buffer in the
        // gesture window. Howler's `_audioUnlocked` flag latches `true`
        // on the first gesture and never re-runs Howler's own scratch-
        // buffer unlock; iOS releases the audio session every long-idle
        // window regardless. Calling this every gesture re-engages the
        // session so subsequent `Howl.play()` lands in a live output
        // graph. Idempotent + safe no-op when no ctx exists.
        //
        // Phase-6 (ticket 86c9gvd0y) extension: this same helper now
        // also refills `Howler._html5AudioPool` synchronously inside
        // the gesture, mirroring the pool-fill loop Howler runs in its
        // own first-gesture unlock handler. Long-idle iPad reproduces
        // showed pool=0 at gesture time when Howler's capture-phase
        // listener never fired — pushing fresh `new Audio()` objects
        // here re-engages the iOS audio session even when Howler's
        // internal unlock didn't.
        const unlockResult = unlockAudioSessionFn()
        // Phase-5 / Phase-6 instrumentation: snapshot Howler's internal
        // unlock flags AFTER the helper. Only meaningful in `?debug=1`
        // sessions; production sessions pay one null check.
        // Phase-8 (ticket 86c9gvd0y): thread the helper's
        // `howlerUnlockMethodCalled` outcome into the row so the iPad
        // export pairs the snapshot with whether the Howler-internal
        // unlock method actually ran in this gesture window.
        recordUnlockStateEvent({
          howlerUnlockMethodCalled: unlockResult?.howlerUnlockMethodCalled,
        })
        const dispatched = gate.dispatchGesture()
        // Reset on a microtask so the next physical tap is not blocked.
        // Microtask (queueMicrotask) drains after the current synchronous
        // batch but before the next event-loop tick — exactly when React's
        // state has been re-committed and a new physical tap is the next
        // expected input.
        queueMicrotask(() => {
          wakeTapInFlightRef.current = false
        })
        // Phase-3 instrumentation: tell the export-log whether the
        // gate consumed the gesture or bounced it. `dispatched=false`
        // is the "gate not in relock state" outcome — exactly the
        // shape we expect to see when the user taps during `pending`
        // (watchdog hasn't fired yet) or `unlocked` (sequence already
        // running). If we see this row immediately followed by no
        // speak-call rows, the bug is "gate sat in pending while
        // user tapped, taps bounced silently".
        if (!dispatched) {
          recordSpeakSkippedEvent('non-wake-dispatch-not-consumed')
        }
        return
      }

      // Same-tick guard — see wakeTapInFlightRef declaration for why.
      if (wakeTapInFlightRef.current) {
        recordSpeakSkippedEvent('wake-in-flight-guard')
        return
      }
      wakeTapInFlightRef.current = true

      // Phase-2 fix for ticket 86c9gvd0y. Resume `Howler.ctx` SYNCHRONOUSLY
      // inside the gesture handler, BEFORE we call into Howler's `play()`
      // path via wrapSpeak → handle.start() → playGreetLine. The Phase-1
      // iPad export-log proved that:
      //
      //   1. Howler creates `Howler.ctx` in `'suspended'` state at Greet
      //      mount time (chime SFX construction triggers lazy init, but
      //      Splash → Greet auto-advances without a user gesture so the
      //      context is born suspended).
      //   2. The context stays suspended until a tap. iOS does not decay
      //      it; it has just never been unlocked.
      //   3. The tap successfully resumes the context (statechange to
      //      `running` ~185 ms post-tap, observed in the iPad export).
      //   4. But Howler's `onplay` event never fires — the gate watchdog
      //      times out to `relock` and Marian sees no Melody, no heart.
      //
      // Empirical hypothesis: Howler's implicit gesture-unlock (called
      // inside `Howl.play()` when ctx is suspended) races with the buffer
      // source binding for a Howl that was preloaded against a suspended
      // context. The fix is to resume the context EXPLICITLY here, in the
      // gesture tick, so by the time `play()` runs (in a microtask via
      // `ensureLoaded.then` inside `playGreetLine`) the context is already
      // moving toward running and the source binding doesn't stall.
      //
      // The helper is a no-op when the context is already running, when
      // Howler hasn't lazy-initted, or when the context is closed — safe
      // to call unconditionally on every tap.
      // Phase-6 instrumentation: pre-call snapshot of Howler's internal
      // unlock flags. The export pairs this with the post-call snapshot
      // below to confirm the Phase-6 pool-fill ran (pool=0 → pool=10).
      recordUnlockStateEvent()
      resumeAudioCtx()
      // Phase-5 fix for ticket 86c9gvd0y: see relock-branch comment above
      // for the full rationale. Same call, same gesture-window contract;
      // we kick this even on the cold first wake-tap because Howler's
      // own internal scratch-buffer plays once-only on its first gesture
      // listener but we want the silent buffer ALSO inside our handler
      // tick — belt-and-braces is cheap on a 1-sample buffer. Phase-6
      // extension: this also fills the HTML5 pool inside the gesture
      // window (see lib/audio/howlerContext.ts for full rationale).
      const unlockResult = unlockAudioSessionFn()
      // Phase-8 (ticket 86c9gvd0y): thread `howlerUnlockMethodCalled`
      // through so the iPad export records whether
      // `Howler._unlockAudio()` was reachable / called / threw on this
      // wake-tap.
      recordUnlockStateEvent({
        howlerUnlockMethodCalled: unlockResult?.howlerUnlockMethodCalled,
      })

      // Cancel the 8s wake re-prompt — she tapped, no nudge needed.
      cancelWakeReprompt()

      // Fresh wake-tap → no failed line yet. Clearing the ref ensures any
      // stale value from a prior mount/recovery doesn't leak into the
      // initial play.
      lastFailedLineRef.current = null

      // Build a fresh sequence (the one from mount may already be running
      // if we're recovering from a relock state) and kick it off
      // synchronously.
      sequenceRef.current?.cancel()
      cancelPreRecorded()
      const handle = buildSequence()
      sequenceRef.current = handle

      // Wrap the synchronous speak with the gate's watchdog. The arrow body
      // runs *before* wrapSpeak returns, so handle.start() — and therefore
      // speak(line0) — sits in the same JS tick as this tap. That's the
      // whole shape iPad Safari requires.
      gate.wrapSpeak(() => {
        handle.start()
        // Silent unlock for the WebAudio (Howler) context — covers the
        // chime we'll need on the heart tap. .play() is defensive: if the
        // asset 404'd, this is a silent no-op; if the engine throws
        // (unlikely), we eat it and move on.
        try {
          chimeInstance.play()
        } catch {
          // Howler can throw synchronously if no audio backend is
          // available. The chime missing isn't a blocker for the unlock
          // pathway.
        }
      })

      // Register a synchronous retry: if the gate watchdog expires (silent
      // first-utterance miss) OR a playGreetLine rejects (Howler load/play
      // failure — ticket 86c9gr43t), the next user gesture will run this
      // callback inside its own tap handler. `lastFailedLineRef.current`
      // decides whether to restart from line 0 (ref is null — silent miss)
      // or to retry the failed line (ref carries the index — MP3 failure).
      //
      // The retry callback ALSO kicks `resumeHowlerContextOnGesture` — the
      // outer dispatchGesture branch above calls it synchronously when the
      // gesture arrives, so by the time this callback runs the context
      // resume is already in flight; this second kick is belt-and-braces
      // against any future caller that triggers a retry through a different
      // dispatch path. Idempotent, so safe to repeat.
      gate.registerRetry(() => {
        // Phase-6 instrumentation: pre-call snapshot of Howler's flags
        // inside the retry-tap gesture window.
        recordUnlockStateEvent()
        resumeAudioCtx()
        // Phase-5 (ticket 86c9gvd0y). Retry callbacks run inside the
        // user's retry-tap handler — same gesture-window contract.
        // Phase-6 extension: pool refill happens here too.
        const unlockResult = unlockAudioSessionFn()
        // Phase-8 (ticket 86c9gvd0y): thread the helper's
        // `howlerUnlockMethodCalled` outcome through.
        recordUnlockStateEvent({
          howlerUnlockMethodCalled: unlockResult?.howlerUnlockMethodCalled,
        })
        sequenceRef.current?.cancel()
        cancelPreRecorded()
        const retryHandle = buildSequence()
        sequenceRef.current = retryHandle
        const fromIndex = lastFailedLineRef.current ?? 0
        // Consume the failed-line marker — if THIS retry also fails, the
        // orchestrator's onLineError will re-set it.
        lastFailedLineRef.current = null
        gate.wrapSpeak(() => {
          retryHandle.start(fromIndex)
        })
      })

      setScreenState('intro')
    } catch (err) {
      // Phase-3 (ticket 86c9gvd0y) instrumentation. Record the throw to
      // the audio-ctx log under `cause: 'handler-error'` so the iPad
      // export-log surfaces any in-handler exception that would
      // otherwise just blow past the React error boundary without a
      // diagnostic trace. Then re-throw so production behaviour is
      // unchanged — the error still bubbles, the boundary still sees
      // it, no swallowing.
      recordHandlerErrorEvent(err)
      throw err
    }
  }, [
    buildSequence,
    cancelWakeReprompt,
    chimeInstance,
    gate,
    resumeAudioCtx,
    screenState,
    unlockAudioSessionFn,
  ])

  // --- Heart tap -------------------------------------------------------------

  const handleHeartTap = useCallback(() => {
    if (!heartReady || tapHandledRef.current) return

    // Phase-6 instrumentation: pre-call snapshot of Howler's flags
    // (heart-tap gesture window). Pairs with the post-call row below.
    recordUnlockStateEvent()
    // Phase-2 fix for ticket 86c9gvd0y. Heart tap is a user gesture, so
    // it's the right place to make sure the audio context is running
    // before the chime plays. iOS can suspend the context if the user
    // received a phone call / Siri / system audio interruption between
    // line 2 ending and the heart tap — calling resume() here covers
    // that path even though we're not actively reproducing it.
    resumeAudioCtx()
    // Phase-5 (ticket 86c9gvd0y): re-engage the OS audio session in the
    // gesture window so the chime that fires below lands in a live
    // output graph after >60s of idle. Same belt-and-braces shape as
    // wake-tap; cost is one 1-sample silent buffer per heart tap.
    // Phase-6 extension: also refills the HTML5 pool synchronously.
    const unlockResult = unlockAudioSessionFn()
    // Phase-8 (ticket 86c9gvd0y): thread the helper's
    // `howlerUnlockMethodCalled` outcome through.
    recordUnlockStateEvent({
      howlerUnlockMethodCalled: unlockResult?.howlerUnlockMethodCalled,
    })

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
    cancelPreRecorded()
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
  }, [
    chimeInstance,
    gate,
    heartReady,
    onAdvance,
    resumeAudioCtx,
    triggerEarWiggle,
    unlockAudioSessionFn,
  ])

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
  //    engines that skip onstart but emit boundaries).
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
      {/*
        `pointer-events: none` on the melody-slot wrapper (post-iPad-tap
        investigation, ticket 86c9gp99a). The slot is decorative — Melody
        herself, the ready ring, and the wake-tap finger-tap nudge are all
        eye-candy, not interactive surfaces. Without this, iPad Safari's
        hit-testing can land taps on the inner <m.img> (Melody) before they
        reach the absolutely-positioned full-viewport <button> below. With
        it, every pixel inside the slot's box transparently passes through
        to whatever is actually tappable underneath — namely the wake-tap
        target during Wake state, or the screen background during intro.
       */}
      <div
        data-testid="greet-melody-slot"
        className="pointer-events-none relative flex h-[60vh] w-full flex-1 items-center justify-center"
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
              activation for audio playback. The previous implementation
              was `onPointerDown`-only, which Thomas saw fail silently on
              a real iPad install.
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
          ref={wakeTapTargetRef}
          type="button"
          data-testid="greet-wake-tap-target"
          aria-label="Tap to start"
          // Each handler records its event type to the debug bus BEFORE
          // delegating to the shared (idempotent) wake-tap logic. The bus
          // is a no-op without the `?debug=1` overlay subscribed, so this
          // is free in normal sessions but priceless when Thomas needs to
          // confirm that touchend / click / pointerdown are actually
          // firing on his iPad.
          //
          // Native shadow listeners (touchstart / touchend / pointerdown /
          // click) are also bound via `addEventListener` in a useEffect
          // above — those record into a separate "raw events" debug-bus
          // line so we can tell apart "iPad delivers events but React
          // doesn't catch them" from "iPad never delivers events to this
          // element". The native touchstart attachment also doubles as
          // the iPad-Safari touch-handler "wake-up" workaround.
          onClick={() => {
            // sampleAudioCtxOnTap MUST run synchronously inside the
            // gesture-handler tick — the whole point of the Phase-1
            // diagnostic for ticket 86c9gvd0y is to record what the
            // AudioContext.state IS at the moment the tap arrives,
            // before any async work or audio play call. No-op when
            // the probe is inactive (production / no `?debug=1`).
            sampleAudioCtxOnTap()
            recordTap('click', 'greet-wake-tap-target')
            handleWakeTap()
          }}
          onTouchEnd={() => {
            sampleAudioCtxOnTap()
            recordTap('touchend', 'greet-wake-tap-target')
            handleWakeTap()
          }}
          onPointerDown={() => {
            sampleAudioCtxOnTap()
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
            // Belt-and-braces — `cursor-pointer` Tailwind class covers
            // the desktop case but iPad Safari has a documented quirk
            // where `<div>`/`<button>` taps without `cursor: pointer` in
            // the inline style fail to fire `onClick` on touch. The
            // Tailwind class compiles to CSS that should win, but the
            // inline form is the strictest possible signal to Webkit's
            // hit-testing layer that this element is interactive.
            cursor: 'pointer',
            // `touch-action: manipulation` disables the OS-level
            // double-tap-to-zoom and 300ms click delay. The Tailwind
            // class above ships the same value; the inline declaration
            // is defensive against any future class-purge / specificity
            // surprise. Critical on iPad: the 300ms delay can interact
            // with the wake-tap-target unmounting (`tapTargetActive`
            // flips to false on transition to intro) and eat the click.
            touchAction: 'manipulation',
            // Webkit-only: explicitly opt out of the tap-highlight
            // grey flash. Pure cosmetic; no behavioural impact, but
            // since we're touching the inline style block anyway it
            // keeps everything in one place.
            WebkitTapHighlightColor: 'transparent',
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
