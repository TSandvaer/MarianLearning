import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { cancel as cancelTts, speak } from '../lib/tts'
import { createSfx, type Sfx } from '../lib/sfx'
import {
  GREET_LINES,
  REPROMPT_AFTER_MS,
  runGreetSequence,
  speakReprompt,
  type SpeakFn,
} from './greetSequence'

/**
 * Screen 2 — First Greeting (Meet Melody).
 *
 * Spec: design/session-1.md §"Screen 2 — First Greeting (Meet Melody)" — the
 * 12 AC bullets at lines 192–203 are the contract this component implements.
 *
 * Architectural shape
 * -------------------
 *  - Sequence orchestration (which line to speak, when the heart appears) is
 *    the pure state machine in `./greetSequence.ts`. This component is a thin
 *    wrapper that wires that machine to:
 *      * Framer Motion (clouds drift, Melody slide, heart pulse, ear-wiggle)
 *      * the TTS utility (live Web Speech)
 *      * the SFX helper (heart-tap chime — defensive against missing asset)
 *      * a 20s no-tap re-prompt timer
 *  - Captions live in a single `revealedByLine[i]` count per line. The TTS
 *    boundary hook (PR #11) advances this in lockstep with the speech engine
 *    on Chrome and via the synthetic word-paced fallback on iPad Safari.
 *  - Melody's pose swap (idle ↔ happy) drives the ear-wiggle. We watch for
 *    `BoundaryEvent.word === 'Hi!'` on line 0 and flip to happy for ~600ms.
 *  - Reduced motion: the global `MotionConfig reducedMotion="user"` collapses
 *    spring entrances to fades and stops `repeat: Infinity` loops. We
 *    additionally branch on `prefers-reduced-motion` here to skip arming the
 *    cloud-drift `animate.x` array, the Melody slide, and the heart bob —
 *    spec line 202 calls for an explicit absence, not just a softer ease.
 */

const HEART_TAP_TRANSITION_MS = 400 // spec line 199: ≤400ms heart-tap → screen 3
const HEART_SQUISH_MS = 250 // spec line 175
const EAR_WIGGLE_MS = 600 // spec line 161
const CLOUD_FADE_MS = 600 // spec line 153
const CLOUD_DRIFT_S = 20 // spec line 153 + ticket: ~20s repeating mirror drift

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

  // Caption state: one revealed-word count per line. We render the spoken
  // text in a stable speech ribbon underneath Melody; revealing word-by-word
  // mirrors the spec's "passive reading exposure" goal (line 28 + 196).
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

  // --- Re-prompt timer -------------------------------------------------------

  const scheduleReprompt = useCallback(() => {
    if (repromptUsedRef.current) return
    if (repromptTimerRef.current !== null) {
      clearTimeout(repromptTimerRef.current)
    }
    repromptTimerRef.current = setTimeout(() => {
      repromptTimerRef.current = null
      repromptUsedRef.current = true
      // Re-show line 3's caption. Reset its revealed count so the word-by-word
      // animation re-fires. Spec line 176 reuses the same line.
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

  // --- Sequence playback -----------------------------------------------------

  useEffect(() => {
    let mounted = true

    const handle = runGreetSequence({
      speak: speakFn,
      onLineStart: (i) => {
        if (!mounted) return
        setActiveLine(i)
      },
      onWordBoundary: (lineIndex, ev) => {
        if (!mounted) return
        // Reveal up to and including this word index. Using max() guards
        // against a late native boundary arriving after the synthetic
        // fallback already painted past it (hybrid-recovery path in
        // boundary.ts can briefly double-stamp during catch-up).
        setRevealedByLine((prev) => {
          const next = prev.slice()
          next[lineIndex] = Math.max(next[lineIndex], ev.wordIndex + 1)
          return next
        })
        // Ear-wiggle on the very first "Hi!" word (line 0). Spec line 142.
        if (lineIndex === 0 && ev.word === 'Hi!') {
          triggerEarWiggle()
        }
      },
      onLineEnd: (i) => {
        if (!mounted) return
        // Defensive: if the engine never gave us a boundary for a word
        // (e.g. punctuation-only token), force the line fully revealed at
        // its end. Acceptable per spec line 723's ±2-word tolerance.
        setRevealedByLine((prev) => {
          const total = GREET_LINES[i].split(/\s+/).filter(Boolean).length
          if (prev[i] >= total) return prev
          const next = prev.slice()
          next[i] = total
          return next
        })
      },
      onHeartReady: () => {
        if (!mounted) return
        setHeartReady(true)
        // Start the 20s no-tap re-prompt timer once the heart is interactive.
        scheduleReprompt()
      },
    })

    return () => {
      mounted = false
      handle.cancel()
      cancelTts()
      clearAllTimers()
      chimeInstance.unload()
    }
  }, [
    speakFn,
    chimeInstance,
    clearAllTimers,
    scheduleReprompt,
    triggerEarWiggle,
  ])

  // --- Heart tap -------------------------------------------------------------

  const handleHeartTap = useCallback(() => {
    if (!heartReady || tapHandledRef.current) return
    tapHandledRef.current = true

    // Cancel any in-flight TTS so Melody isn't talking over the chime.
    cancelTts()
    // Cancel the re-prompt — she tapped, no nag needed.
    if (repromptTimerRef.current !== null) {
      clearTimeout(repromptTimerRef.current)
      repromptTimerRef.current = null
    }

    // Wave! Ear-wiggle on transition out per spec line 179.
    triggerEarWiggle()

    // Defensive chime: silent no-op if asset is missing (assets-todo.md).
    chimeInstance.play()

    setHeartSquishing(true)
    setAdvancing(true)

    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      onAdvance()
    }, HEART_TAP_TRANSITION_MS)
  }, [heartReady, chimeInstance, onAdvance, triggerEarWiggle])

  // --- Render ----------------------------------------------------------------

  const heartButtonLabel = useMemo(
    () => GREET_LINES[GREET_LINES.length - 1], // "Tap the heart when you're ready."
    [],
  )

  return (
    <m.main
      data-testid="greet"
      data-active-line={activeLine}
      data-heart-ready={heartReady ? 'true' : 'false'}
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

      {/* Melody. Sized to fill ~60% of viewport height per spec line 117.
          AnimatePresence cross-fades idle ↔ happy on the ear-wiggle cue.
          layoutId="melody" is set so Screen 3+ can shared-element-transition
          her position (spec line 696). */}
      <div
        data-testid="greet-melody-slot"
        className="relative flex h-[60vh] w-full flex-1 items-center justify-center"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.img
            layoutId="melody"
            key={pose}
            data-testid="greet-melody"
            data-pose={pose}
            src={`/assets/melody-${pose}.svg`}
            alt="Melody"
            draggable={false}
            className="h-full w-auto select-none"
            initial={
              reducedMotion ? { opacity: 0 } : { x: -120, y: 60, opacity: 0 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 }
            }
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={
              reducedMotion ? { duration: 0.3 } : MELODY_ENTRANCE_SPRING
            }
          />
        </AnimatePresence>
      </div>

      {/* Speech ribbon. White rounded rect, 88% viewport width, pink border.
          Scales in from 0.9 → 1 on first mount per spec line 162. */}
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
          // ≥28pt body text per spec AC line 203 (1pt ≈ 1.333px → ≥37px).
          // Tailwind's text-[2.4rem] = 38.4px, comfortably above the floor.
          className="font-display text-[2.4rem] leading-snug text-ink"
        >
          {renderCaption(activeLine, revealedByLine[activeLine] ?? 0)}
        </p>
      </m.div>

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
                // Spec line 136: 88pt tall × 120pt wide. 1pt ≈ 1.333px →
                // 117px tall × 160px wide. Above the 60pt minimum touch
                // target (spec line 17) by a wide margin.
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
