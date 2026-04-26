import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useAudioUnlockGate } from '../../lib/audio/useAudioUnlockGate'
import { resumeHowlerContextOnGesture } from '../../lib/audio/howlerContext'
import { createSfx, type Sfx } from '../../lib/sfx'
import { pickDistractors } from './distractors'
import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from './stardust'
import {
  pickStaticSessionPlan,
  type MathSessionPlan,
  type MathProblem,
} from './sessionPlans'
import { STREAK_BONUS_THRESHOLDS } from './constants'

/**
 * Screen 3 — Math (Number Garden, sums to 10).
 *
 * Spec: design/screen-3-math.md is canonical. Session-1 walkthrough
 * (one-problem version) is described in design/session-1.md §"Screen 3";
 * everything beyond that — full 8-problem flow, distractor ramp, stardust
 * HUD, streak indicator, audio Path A integration — lives here.
 *
 * Architectural notes
 * -------------------
 * - Pure functions live in sibling files (`distractors.ts`, `stardust.ts`,
 *   `sessionPlans.ts`). This component is the orchestration layer + the
 *   visual choreography. Tests for the math live with the math; tests for
 *   the screen interaction live with this file.
 * - Audio: the Path A pipeline (`api/_tts.ts` + `lib/audio/sessionAudio`)
 *   is the production target. Until `ANTHROPIC_API_KEY` is configured in
 *   Vercel env, we fall back to the hardcoded `pickStaticSessionPlan()`
 *   factory + the test-injectable `playUtterance` prop. The default
 *   `playUtterance` resolves immediately and walks the caption text
 *   word-by-word at ~165 wpm so Marian sees something even without TTS.
 *   When the key lands, App.tsx will wire the live Path A play function
 *   in here; the screen contract doesn't change.
 * - All animation goes through `<m.*>` under the global LazyMotion at the
 *   App root. We never import bare `motion`. Same iPad budget rule as
 *   everywhere else.
 * - Reduced-motion: the global `MotionConfig reducedMotion="user"`
 *   collapses springs and stops infinite loops. We additionally branch
 *   here to skip the chip sparkle burst on reduce, and snap Melody pose
 *   swaps without cross-fade — same reasons as Greet.
 */

// ── Constants — single source of truth, mirror the spec --------------------
// Externally-observable constants live in `./constants.ts` so this file can
// re-export only the React component (react-refresh requires that).

/** Wrong-attempt count after which the hint utterance fires. */
const HINT_AFTER_WRONG_COUNT = 2

/** Wrong-attempt count after which the guided-completion path fires. */
const GUIDED_AFTER_WRONG_COUNT = 3

/** Auto-advance delay after a correct answer (spec §Audio dispatch). */
const ADVANCE_AFTER_CORRECT_MS = 1200

/** Wrong-tap chip shake duration (spec §Wrong-answer policy item 1). */
const WRONG_SHAKE_MS = 400

/** Hint reveal delay after the wrong sequence completes. */
const HINT_DELAY_AFTER_WRONG_MS = 600

/** Streak fade-out duration when a wrong tap breaks the streak. */
const STREAK_FADE_OUT_MS = 400

/** Audio-unlock watchdog window — same as Greet post-Howler era. */
const FIRST_UTTERANCE_RETRY_MS = 1_500

/**
 * Spring preset — mirrors the spec's §Implementation pointers list.
 * NOTE: HUD pop animations use a tween (HUD_POP_TWEEN below) instead of
 * a spring, because Framer Motion springs only support 2-keyframe
 * arrays and the pop pattern is `[1, 1.25, 1]` (3 keyframes).
 */
const CHIP_TAP_SPRING = { type: 'spring' as const, stiffness: 300, damping: 18 }

/**
 * Pop tween — used for the 3-keyframe `[1, 1.25, 1]` HUD pop. Framer
 * Motion's spring physics only supports 2-keyframe arrays; for the
 * "pop" pattern we use a short tween instead. Duration matches the
 * spec's 250ms target for the stardust-counter pop animation.
 */
const HUD_POP_TWEEN = {
  type: 'tween' as const,
  duration: 0.25,
  ease: 'easeOut' as const,
}

// ── Public types ----------------------------------------------------------

/** Shape the screen invokes when problem 8 finishes. Out-of-screen handler. */
export interface MathSessionResult {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /** Stardust _earned in this session_, not the all-time persisted total. */
  earnedThisSession: number
}

/** Function signature for playing one canonical Math utterance. */
export type PlayMathUtteranceFn = (
  text: string,
  opts?: PlayMathUtteranceOptions,
) => Promise<void>

export interface PlayMathUtteranceOptions {
  /** Fires once when the audio actually begins. */
  onPlay?: () => void
  /** Fires per word; used by the caption ribbon to reveal text. */
  onWordTick?: (wordIndex: number) => void
}

export interface MathProps {
  /** Optional: fires when problem 8 finishes (any path). */
  onSessionComplete?: (result: MathSessionResult) => void
  /** Optional: override the session plan. Defaults to a hardcoded rotation
   *  via `pickStaticSessionPlan()` until Path A wires Claude into Math mount. */
  plan?: MathSessionPlan
  /** Optional: replace the audio playback function. Default no-ops the audio
   *  but still fires `onPlay` + word ticks at ~165 wpm so the caption ribbon
   *  reveals normally even without real TTS. */
  playUtterance?: PlayMathUtteranceFn
  /** Optional: sparkle SFX on correct. Default a Howler-backed silent-fallback. */
  sparkle?: Sfx
  /** Optional: poof SFX on wrong. Default a Howler-backed silent-fallback. */
  poof?: Sfx
  /** Optional: stardust grain plink SFX on counter arrival. Silent-fallback. */
  plink?: Sfx
  /** Optional: localStorage adapter for stardust. Defaults to window.localStorage
   *  when present, in-memory shim otherwise. Same pattern as `stardust.ts`. */
  storage?: StorageAdapter
  /** Test seam: clock injection — used by both `pickStaticSessionPlan()` and
   *  `writeStardust()` so two callers can share a deterministic timeline. */
  now?: () => Date
  /**
   * Test seam: spy on the per-gesture `Howler.ctx.resume()` kick added in
   * Phase 2 of ticket 86c9gvd0y. Defaults to the real
   * `resumeHowlerContextOnGesture` from `lib/audio/howlerContext`. Production
   * callers should never override this. Mirrors the same seam on `Greet`
   * (kept identical so future audio-active screens — Word Song, Session End —
   * follow the same shape).
   */
  resumeAudioContext?: () => void
}

// ── Default no-op playback (spec note: silent-but-captioned fallback) ------

/**
 * Default playback. Resolves after the line "would have" finished at ~165
 * wpm (the same fallback rate used by `sessionAudio.ts` when Howler can't
 * read a duration). Fires `onPlay` synchronously so the gate's watchdog
 * sees the engine started, and ticks `onWordTick` at the per-word interval
 * so the caption reveals word-by-word even without real audio.
 *
 * This isn't a fake — it's the deliberate v1 fallback while the Anthropic
 * key is unavailable. Marian sees text, no voice. Better than crashing.
 */
const defaultPlayUtterance: PlayMathUtteranceFn = (text, opts) => {
  return new Promise<void>((resolve) => {
    const words = text.split(/\s+/).filter(Boolean)
    const wordCount = Math.max(1, words.length)
    const totalMs = (wordCount / 165) * 60_000
    const intervalMs = totalMs / wordCount

    // Synchronous onPlay — keeps the unlock-gate watchdog happy.
    opts?.onPlay?.()
    opts?.onWordTick?.(0)

    if (wordCount <= 1) {
      window.setTimeout(resolve, intervalMs)
      return
    }

    let nextWord = 1
    const handle = window.setInterval(() => {
      if (nextWord >= wordCount) {
        window.clearInterval(handle)
        // Small tail to mimic real audio's natural end gap.
        window.setTimeout(resolve, intervalMs)
        return
      }
      opts?.onWordTick?.(nextWord)
      nextWord += 1
    }, intervalMs)
  })
}

// ── Component -------------------------------------------------------------

type MelodyPose = 'idle' | 'happy' | 'puzzled'

/** Per-problem state machine. Resets on problem advance. */
interface PerProblemState {
  /** Has the chip been tapped on the correct answer yet? */
  resolved: boolean
  /** Wrong-tap count for this problem. Drives hint + guided thresholds. */
  wrongCount: number
  /** True once the hint utterance has played for this problem. */
  hintPlayed: boolean
  /** True once the guided-completion utterance has played. */
  guidedPlayed: boolean
}

const FRESH_PROBLEM_STATE: PerProblemState = {
  resolved: false,
  wrongCount: 0,
  hintPlayed: false,
  guidedPlayed: false,
}

/**
 * Detect prefers-reduced-motion at mount. Same hook shape as Greet — we
 * could factor it out to `lib/usePrefersReducedMotion.ts` but Kyle flagged
 * that as a Devon-judgement-call refactor; deferring to keep this PR
 * focused on the Math screen. Filed mentally as a follow-up.
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

/**
 * The component is named `MathScreen` internally to avoid shadowing the
 * built-in `Math` global within this module — the file uses `Math.cos` /
 * `Math.PI` / `Math.floor` for layout math, and naming the React component
 * `Math` would hide the global. The default export keeps the screen-style
 * `Math` name for symmetry with `Greet` / `Splash` at call sites.
 */
function MathScreen({
  onSessionComplete,
  plan: planProp,
  playUtterance = defaultPlayUtterance,
  sparkle,
  poof,
  plink,
  storage,
  now = () => new Date(),
  resumeAudioContext,
}: MathProps) {
  const reducedMotion = usePrefersReducedMotion()

  // Bind the per-gesture audio-context resume kick. Defaults to the real
  // helper from `lib/audio/howlerContext`. See Greet.tsx for the shape
  // rationale (Phase-2 fix for ticket 86c9gvd0y).
  const resumeAudioCtx = resumeAudioContext ?? resumeHowlerContextOnGesture

  // Plan is captured ONCE per mount — we never re-roll mid-session even if
  // the parent re-renders with a fresh `now`. Tests pin via the prop.
  const plan = useMemo<MathSessionPlan>(
    () => planProp ?? pickStaticSessionPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Lazy SFX. Same defensive 404 pattern as Greet — the assets are still
  // pending Thomas (assets-todo.md). createSfx will warn-once and play()
  // will be a silent no-op until the files land.
  const [sparkleInstance] = useState<Sfx>(
    () =>
      sparkle ?? createSfx({ src: '/assets/sfx-sparkle.mp3', volume: 0.85 }),
  )
  const [poofInstance] = useState<Sfx>(
    () => poof ?? createSfx({ src: '/assets/sfx-poof.mp3', volume: 0.7 }),
  )
  const [plinkInstance] = useState<Sfx>(
    () => plink ?? createSfx({ src: '/assets/sfx-plink.mp3', volume: 0.7 }),
  )

  // Audio unlock gate — same watchdog window as Greet post-Howler era.
  // Wraps the very first utterance synchronously so iPad Safari sees the
  // gesture context.
  const gate = useAudioUnlockGate({ watchdogMs: FIRST_UTTERANCE_RETRY_MS })

  // ── Persistent state -----------------------------------------------------

  /** All-time stardust total. Loaded once on mount; updated on every grant. */
  const [stardust, setStardust] = useState<StardustState>(() =>
    loadStardust(storage),
  )

  /**
   * Always-fresh mirror of `stardust.total`. We need a ref because chained
   * grants within the same gesture (per-correct +1, then immediately
   * streak-bonus +1) and the deferred session-complete writeback all need
   * the latest total — React state batches grants so a closure-captured
   * `stardust.total` reads the pre-grant value. The ref is updated
   * synchronously alongside the setState call, so the next read in the
   * same tick sees the latest.
   */
  const stardustTotalRef = useRef(stardust.total)

  /** Stardust earned _this session_ — used for the session-complete callback
   *  so the parent can show "you earned X today" without diffing the persisted
   *  total against itself. */
  const earnedThisSessionRef = useRef(0)

  // ── Per-session state ---------------------------------------------------

  /** 0-based problem cursor (0..7). Public-facing index is `problemIndex+1`. */
  const [problemIndex, setProblemIndex] = useState(0)

  /** Per-problem state — resets on advance via setProblemState(FRESH). */
  const [problemState, setProblemState] =
    useState<PerProblemState>(FRESH_PROBLEM_STATE)

  /** Streak of consecutive clean wins (correct-on-first-tap). */
  const [streak, setStreak] = useState(0)
  /** Always-fresh mirror of `streak` — same reasoning as `stardustTotalRef`.
   *  The auto-advance timer for problem 8 reads the final streak value to
   *  pass into `onSessionComplete`; without the ref it captures stale state. */
  const streakRef = useRef(0)

  /** Total clean-correct answers; used for the session-complete callback. */
  const totalCorrectRef = useRef(0)

  /** True while the screen is in the "first tap unlocks audio" window —
   *  we keep this one-shot so we don't kick the unlock gate on every chip tap. */
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  /** Melody's current pose. Driven by tap outcomes + the auto-return timer. */
  const [pose, setPose] = useState<MelodyPose>('idle')

  /** Chip currently shaking (after a wrong tap) — set to its value while
   *  the shake animation plays so we can target the keyframe. */
  const [shakingChip, setShakingChip] = useState<number | null>(null)

  /** Caption ribbon state: the line text + how many words have been revealed. */
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(false)

  /** True while the celebration burst on a correct tap is animating. */
  const [celebrating, setCelebrating] = useState(false)

  /** When set, the streak indicator is fading out (after a break). */
  const [streakFadingOut, setStreakFadingOut] = useState(false)

  /** Whether the guided completion has highlighted the correct chip. */
  const [guidedActive, setGuidedActive] = useState(false)

  /** Stable seed for `Math.random` substitute on chip-position shuffle. We
   *  avoid Math.random because it makes tests flaky; instead we shuffle
   *  deterministically per problemIndex via a tiny LCG. */
  const chipOrder = useMemo(
    () => buildChipOrder(plan.problems[problemIndex]),
    [plan, problemIndex],
  )

  // ── Refs for in-flight cleanup -----------------------------------------

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streakFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAllTimers = useCallback(() => {
    for (const ref of [
      advanceTimerRef,
      shakeTimerRef,
      hintTimerRef,
      poseTimerRef,
      streakFadeTimerRef,
    ]) {
      if (ref.current !== null) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      clearAllTimers()
      sparkleInstance.unload()
      poofInstance.unload()
      plinkInstance.unload()
      // Persist any stardust earned this session — defensive in case the
      // session ends via unmount (e.g. parent-driven route change) before
      // we run the explicit on-complete write. Read from the ref so we
      // see grants that React hasn't committed to state yet.
      writeStardust(stardustTotalRef.current, storage, now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Audio playback wrapper --------------------------------------------

  /**
   * Speak one line, drive the caption ribbon, and (if this is the very
   * first utterance) thread the gate's watchdog around it.
   *
   * Returns the playback promise so callers that want to chain (hint →
   * after) can await it.
   */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      setCaptionText(text)
      setCaptionRevealed(0)
      setCaptionVisible(false)

      const words = text.split(/\s+/).filter(Boolean)

      const playOpts: PlayMathUtteranceOptions = {
        onPlay: () => {
          setCaptionVisible(true)
          gate.reportSpeechStart()
        },
        onWordTick: (wordIndex) => {
          setCaptionRevealed((prev) => Math.max(prev, wordIndex + 1))
        },
      }

      try {
        await playUtterance(text, playOpts)
      } catch (err) {
        // Most paths swallow this. Surface as a relock signal so the gate
        // can re-arm if it was the very first utterance and the user can
        // tap to retry. Mid-sequence failures just complete the caption
        // and continue.
        gate.reportSpeechError()

        console.warn(
          `[Math] playUtterance rejected for "${text}":`,
          err instanceof Error ? err.message : err,
        )
      } finally {
        // Defensive — make sure the caption ends fully revealed even if
        // the playback engine skipped the last tick.
        setCaptionRevealed(words.length)
      }
    },
    [gate, playUtterance],
  )

  // ── Problem reveal: speak the read-aloud line on each problem entry ---

  /**
   * Fire the per-problem read-aloud. We do this on every problem-index
   * transition AS LONG AS audio has been unlocked — for the very first
   * problem, the unlock happens via the first chip tap (or via the gate's
   * dispatchGesture path), so the read-aloud is delayed until then.
   */
  useEffect(() => {
    if (!audioUnlocked) return
    if (guidedActive) return // mid-guided playback owns the audio
    const problem = plan.problems[problemIndex]
    // Defer to a microtask so the setState calls inside `speak` (caption
    // text/visible) don't fire synchronously inside the effect body —
    // satisfies react-hooks/set-state-in-effect and matches the React
    // recommendation for "kick off async work from an effect".
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void speak(problem.utterances.read)
    })
    return () => {
      cancelled = true
    }
    // We don't include `speak` because it's stable enough — and including
    // it would re-trigger on every render that touches `gate`, which would
    // re-speak the line repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, audioUnlocked])

  // ── Chip tap handler ---------------------------------------------------

  const advanceToNext = useCallback(() => {
    if (problemIndex < plan.problems.length - 1) {
      setProblemIndex((i) => i + 1)
      setProblemState(FRESH_PROBLEM_STATE)
      setShakingChip(null)
      setPose('idle')
      setGuidedActive(false)
      setStreakFadingOut(false)
      setCelebrating(false)
      setCaptionText('')
      setCaptionRevealed(0)
      setCaptionVisible(false)
    } else {
      // Session complete. Persist the final total + invoke the callback.
      // Read from the ref — chained grants in the gesture that triggered
      // this auto-advance may have bumped the total without React having
      // committed the state yet.
      const finalState = writeStardust(stardustTotalRef.current, storage, now)
      setStardust(finalState)
      onSessionComplete?.({
        totalCorrect: totalCorrectRef.current,
        totalStardust: finalState.total,
        finalStreak: streakRef.current,
        earnedThisSession: earnedThisSessionRef.current,
      })
    }
  }, [problemIndex, plan.problems.length, onSessionComplete, storage, now])

  const grantStardust = useCallback(
    (amount: number) => {
      // Update the ref synchronously so back-to-back grants within the
      // same tick (per-correct then streak-bonus) both see the latest
      // total without waiting on React's state batch.
      stardustTotalRef.current += amount
      const next = writeStardust(stardustTotalRef.current, storage, now)
      setStardust(next)
      earnedThisSessionRef.current += amount
    },
    [storage, now],
  )

  /**
   * Handle a wrong tap. Sequenced per spec §Audio dispatch (wrong path):
   * shake the chip, swap Melody to puzzled, fire SFX + reprompt utterance,
   * then either schedule the hint (after 2 wrongs) or return to idle.
   */
  const handleWrongTap = useCallback(
    (chipValue: number, problem: MathProblem) => {
      // Sound + visual immediately, in the gesture tick.
      poofInstance.play()
      setShakingChip(chipValue)
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setShakingChip(null)
        shakeTimerRef.current = null
      }, WRONG_SHAKE_MS)

      setPose('puzzled')
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)

      // Streak break — fade out the indicator, then reset.
      // Reset the ref synchronously regardless of fade timing — the ref is
      // the source of truth for "what does the next chip-tap closure see",
      // and we want subsequent taps in the same problem to read 0 even
      // before the fade-out completes.
      const wasOnStreak = streak >= 2
      streakRef.current = 0
      if (wasOnStreak) {
        setStreakFadingOut(true)
        if (streakFadeTimerRef.current !== null) {
          clearTimeout(streakFadeTimerRef.current)
        }
        streakFadeTimerRef.current = setTimeout(() => {
          setStreak(0)
          setStreakFadingOut(false)
          streakFadeTimerRef.current = null
        }, STREAK_FADE_OUT_MS)
      } else {
        setStreak(0)
      }

      const nextWrongCount = problemState.wrongCount + 1
      setProblemState((prev) => ({ ...prev, wrongCount: nextWrongCount }))

      const willTriggerGuided = nextWrongCount >= GUIDED_AFTER_WRONG_COUNT
      const willTriggerHint =
        nextWrongCount === HINT_AFTER_WRONG_COUNT && !problemState.hintPlayed

      void speak(problem.utterances.reprompt).then(() => {
        // Return to idle pose unless we're about to play the hint or guided
        // line — in which case the next utterance owns the pose.
        if (!willTriggerHint && !willTriggerGuided) {
          poseTimerRef.current = setTimeout(() => {
            setPose('idle')
            poseTimerRef.current = null
          }, 0)
        }

        if (willTriggerGuided && !problemState.guidedPlayed) {
          setGuidedActive(true)
          setProblemState((prev) => ({ ...prev, guidedPlayed: true }))
          // Speak the give-answer line; on completion the correct chip is
          // the only tappable one (per spec, all others dim to 0.6 and
          // become non-interactive).
          void speak(problem.utterances.giveAnswer).then(() => {
            poseTimerRef.current = setTimeout(() => {
              setPose('idle')
              poseTimerRef.current = null
            }, 0)
          })
        } else if (willTriggerHint) {
          // Schedule the hint after a 600ms beat (spec §Wrong path note).
          hintTimerRef.current = setTimeout(() => {
            hintTimerRef.current = null
            setProblemState((prev) => ({ ...prev, hintPlayed: true }))
            void speak(problem.utterances.hint).then(() => {
              poseTimerRef.current = setTimeout(() => {
                setPose('idle')
                poseTimerRef.current = null
              }, 0)
            })
          }, HINT_DELAY_AFTER_WRONG_MS)
        }
      })
    },
    [
      poofInstance,
      problemState.wrongCount,
      problemState.hintPlayed,
      problemState.guidedPlayed,
      speak,
      streak,
    ],
  )

  /**
   * Handle a correct tap. Sequenced per spec §Audio dispatch (correct path):
   * happy pose, sparkle + plink SFX, grant stardust (unless this is the
   * guided-completion flow), update streak, schedule auto-advance.
   */
  const handleCorrectTap = useCallback(
    (problem: MathProblem) => {
      sparkleInstance.play()
      plinkInstance.play()

      setPose('happy')
      setCelebrating(true)
      setProblemState((prev) => ({ ...prev, resolved: true }))

      // Stardust + streak. Spec line 162-164: stardust is awarded even after
      // 1-or-2 wrongs; ONLY the guided-completion path withholds it.
      // Streak is "consecutive CLEAN wins" — any prior wrong taps reset
      // streak to 0 already, so we only ++ on a clean problem.
      const isCleanWin =
        problemState.wrongCount === 0 && !problemState.guidedPlayed
      if (!problemState.guidedPlayed) {
        grantStardust(1)
        totalCorrectRef.current += 1
        if (isCleanWin) {
          // Synchronous ref update so the auto-advance timer (which fires
          // after this gesture's React state batch) sees the latest streak.
          streakRef.current = streakRef.current + 1
          setStreak(streakRef.current)
          // Streak bonus stardust at 3, 5, 8.
          if (
            (STREAK_BONUS_THRESHOLDS as readonly number[]).includes(
              streakRef.current,
            )
          ) {
            grantStardust(1)
          }
        } else {
          // Wrong-then-correct: still earned, but no streak progression.
          // Streak was already broken at the wrong tap; nothing to do.
        }
      }

      // Speak the celebration utterance and schedule the auto-advance.
      void speak(problem.utterances.correct).then(() => {
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
      })

      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current)
      }
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        setCelebrating(false)
        advanceToNext()
      }, ADVANCE_AFTER_CORRECT_MS)
    },
    [
      advanceToNext,
      grantStardust,
      plinkInstance,
      problemState.guidedPlayed,
      problemState.wrongCount,
      sparkleInstance,
      speak,
    ],
  )

  const onChipTap = useCallback(
    (chipValue: number) => {
      const problem = plan.problems[problemIndex]
      if (problemState.resolved) return

      // Phase-2 fix for ticket 86c9gvd0y. Kick `Howler.ctx.resume()`
      // synchronously inside this user-gesture handler. Splash → Greet →
      // Math navigation can leave the Howler context in `'suspended'`
      // state when the user lingered on Greet for >30s before tapping —
      // and even after Greet's wake-tap resumed the context, iOS can
      // re-suspend it on screen transition / page-visibility events.
      // Resuming here unconditionally guarantees the chip-tap's result
      // audio (correct/wrong SFX + spoken read-aloud) plays without
      // racing the suspended → running transition. No-op when ctx is
      // already running. See `lib/audio/howlerContext.ts` for the full
      // rationale.
      resumeAudioCtx()

      // First-tap audio unlock: route the very first user gesture through
      // the gate and trigger the read-aloud after this tap (the chip-tap
      // result audio fires in the same handler, so the gate's watchdog
      // sees an utterance start either way).
      if (!audioUnlocked) {
        setAudioUnlocked(true)
        // The read-aloud will fire from the audioUnlocked effect; the
        // chip-result audio (correct / wrong) is what the gate's watchdog
        // observes, and that's also kicked synchronously below via speak().
      }

      // Block guided-completion path on non-correct chips.
      if (guidedActive && chipValue !== problem.correct) return

      const isCorrect = chipValue === problem.correct
      if (isCorrect) {
        // Wrap the speak call with the gate so the very first chip-tap
        // utterance is watchdog-tracked. Subsequent calls just speak.
        if (!audioUnlocked) {
          gate.wrapSpeak(() => {
            handleCorrectTap(problem)
          })
        } else {
          handleCorrectTap(problem)
        }
      } else {
        if (!audioUnlocked) {
          gate.wrapSpeak(() => {
            handleWrongTap(chipValue, problem)
          })
        } else {
          handleWrongTap(chipValue, problem)
        }
      }
    },
    [
      audioUnlocked,
      gate,
      guidedActive,
      handleCorrectTap,
      handleWrongTap,
      plan,
      problemIndex,
      problemState.resolved,
      resumeAudioCtx,
    ],
  )

  // ── Render -------------------------------------------------------------

  const currentProblem = plan.problems[problemIndex]
  const showStreak = streak >= 2 || streakFadingOut

  return (
    <m.main
      data-testid="math"
      data-problem-index={problemIndex}
      data-streak={streak}
      data-stardust={stardust.total}
      data-pose={pose}
      data-gate-state={gate.state}
      data-guided={guidedActive ? 'true' : 'false'}
      className="
        relative flex h-full w-full flex-col
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      {/* Garden background — `bg-garden.svg` is on assets-todo.md.
          Until it lands, fall back to a soft pink-cream gradient so the
          screen still reads as "garden-y" without a broken-image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(255,224,230,0.55) 0%, rgba(255,245,240,0) 60%), linear-gradient(180deg, #FFF5F0 0%, #FFF8F2 100%)',
        }}
      />

      {/* HUD strip */}
      <div
        data-testid="math-hud"
        className="
          flex h-14 w-full items-center justify-between
          px-4
        "
      >
        {/* Stardust counter — left */}
        <div
          data-testid="math-stardust"
          data-total={stardust.total}
          className="flex items-center gap-2 font-display text-3xl text-ink"
        >
          <m.span
            key={stardust.total}
            initial={{ scale: 1 }}
            animate={celebrating ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={celebrating ? HUD_POP_TWEEN : { duration: 0 }}
            className="inline-flex items-center"
            aria-hidden
          >
            <SparkleGlyph />
          </m.span>
          <span aria-label={`Stardust: ${stardust.total}`}>
            {stardust.total}
          </span>
        </div>

        {/* Problem dots — center */}
        <div
          data-testid="math-problem-dots"
          aria-hidden
          className="flex items-center gap-2"
        >
          {plan.problems.map((p, i) => {
            const completed = i < problemIndex
            const current = i === problemIndex
            return (
              <span
                key={p.index}
                data-testid="math-problem-dot"
                data-state={
                  completed ? 'completed' : current ? 'current' : 'upcoming'
                }
                className={
                  current
                    ? 'block h-3 w-3 rounded-full bg-my-rose ring-2 ring-my-pink ring-offset-2 ring-offset-transparent'
                    : completed
                      ? 'block h-3 w-3 rounded-full bg-my-rose'
                      : 'block h-3 w-3 rounded-full border border-my-pink bg-transparent'
                }
              />
            )
          })}
        </div>

        {/* Streak indicator — right. Hidden until streak >= 2 (spec line 98). */}
        <div className="flex h-8 w-20 items-center justify-end">
          <AnimatePresence>
            {showStreak && (
              <m.div
                key="streak"
                data-testid="math-streak"
                data-count={streak}
                className="flex items-center gap-1 font-display text-2xl text-my-rose"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: streakFadingOut ? 0 : 1,
                  scale:
                    celebrating &&
                    (STREAK_BONUS_THRESHOLDS as readonly number[]).includes(
                      streak,
                    )
                      ? [1, 1.25, 1]
                      : 1,
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, ease: 'easeOut' },
                }}
                transition={
                  streakFadingOut
                    ? { duration: STREAK_FADE_OUT_MS / 1000, ease: 'easeOut' }
                    : HUD_POP_TWEEN
                }
              >
                <SparkleGlyph />
                <span>{streak}</span>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Melody + ribbon row */}
      <div className="relative flex w-full items-start gap-4 px-4">
        {/* Melody — upper-left */}
        <AnimatePresence initial={false}>
          <m.img
            layoutId="melody"
            key={pose}
            data-testid="math-melody"
            data-pose={pose}
            src={`/assets/melody-${pose}.svg`}
            alt="Melody"
            draggable={false}
            className="h-[26vh] w-auto select-none"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={reducedMotion ? { duration: 0.2 } : { duration: 0.2 }}
          />
        </AnimatePresence>

        {/* Caption ribbon — to Melody's right. Same word-by-word reveal
            pattern as Greet (spec §Audio integration "Caption rendering"). */}
        {captionVisible && captionText && (
          <m.div
            data-testid="math-ribbon"
            role="status"
            aria-live="polite"
            className="
              mt-4 flex-1
              rounded-2xl border-[3px] border-my-pink bg-white
              px-4 py-3
              shadow-[0_8px_24px_rgba(244,143,177,0.18)]
            "
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.2 }
                : { type: 'spring', stiffness: 260, damping: 20 }
            }
          >
            <p
              data-testid="math-caption"
              className="font-display text-[1.6rem] leading-snug text-ink"
            >
              {renderCaption(captionText, captionRevealed)}
            </p>
          </m.div>
        )}
      </div>

      {/* Problem display — symbolic + visual flowers */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <div
          data-testid="math-symbolic"
          className="flex items-center gap-4 font-display text-[6rem] leading-none"
        >
          <span data-testid="math-addend-a">{currentProblem.addendA}</span>
          <span aria-hidden>+</span>
          <span data-testid="math-addend-b">{currentProblem.addendB}</span>
          <span aria-hidden>=</span>
          <span data-testid="math-result-placeholder" aria-hidden>
            ?
          </span>
        </div>

        {/* Visual groups — flower glyphs. The asset is pending (see
            assets-todo.md); render an inline SVG fallback so the screen
            still reads even before Thomas drops the file. */}
        <div
          data-testid="math-visual-groups"
          aria-hidden
          className="flex items-center gap-6 text-[3.2rem]"
        >
          <FlowerGroup count={currentProblem.addendA} />
          <span>+</span>
          <FlowerGroup count={currentProblem.addendB} />
        </div>
      </div>

      {/* Answer chips */}
      <div
        data-testid="math-chips"
        className="
          mb-8 flex w-full items-center justify-center gap-8 px-4
        "
      >
        {chipOrder.map((value) => {
          const isCorrect = value === currentProblem.correct
          const isShaking = shakingChip === value
          const dimForGuided = guidedActive && !isCorrect
          const guidedShimmer = guidedActive && isCorrect
          return (
            <m.button
              key={value}
              type="button"
              data-testid="math-chip"
              data-value={value}
              data-correct={isCorrect ? 'true' : 'false'}
              data-shaking={isShaking ? 'true' : 'false'}
              aria-label={`Answer ${value}`}
              onClick={() => onChipTap(value)}
              disabled={problemState.resolved || dimForGuided}
              className={`
                relative flex select-none items-center justify-center
                rounded-3xl border-[3px] border-my-pink bg-white
                font-display text-5xl text-ink
                transition-opacity
                disabled:cursor-default
                touch-manipulation
                ${dimForGuided ? 'opacity-60' : 'opacity-100'}
                ${guidedShimmer ? 'shadow-[0_0_24px_rgba(244,143,177,0.85)]' : 'shadow-[0_4px_12px_rgba(244,143,177,0.18)]'}
              `}
              style={{
                width: '120px',
                height: '120px',
                minWidth: '60px',
                minHeight: '60px',
                cursor:
                  problemState.resolved || dimForGuided ? 'default' : 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={
                isShaking
                  ? reducedMotion
                    ? { scale: 1, opacity: [1, 0.7, 1] }
                    : { x: [0, -6, 6, -4, 4, 0], scale: 1, opacity: 1 }
                  : { scale: 1, opacity: dimForGuided ? 0.6 : 1, x: 0 }
              }
              whileTap={
                problemState.resolved || dimForGuided
                  ? undefined
                  : { scale: 0.92 }
              }
              transition={
                isShaking
                  ? reducedMotion
                    ? { duration: WRONG_SHAKE_MS / 1000 }
                    : { duration: WRONG_SHAKE_MS / 1000, ease: 'easeOut' }
                  : CHIP_TAP_SPRING
              }
            >
              {value}

              {/* Sparkle burst on correct tap. AnimatePresence so the
                  particles unmount cleanly after the burst. Skipped
                  entirely on reduced-motion. */}
              <AnimatePresence>
                {celebrating && isCorrect && !reducedMotion && (
                  <SparkleBurst key="burst" />
                )}
              </AnimatePresence>
            </m.button>
          )
        })}
      </div>
    </m.main>
  )
}

// ── Render helpers --------------------------------------------------------

/**
 * Render the caption text word-by-word via `<m.span>` per word with
 * `data-revealed` for tests / styling. Mirrors the Greet pattern verbatim.
 */
function renderCaption(text: string, revealedCount: number) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <m.span
      key={`${i}-${word}`}
      data-testid="math-caption-word"
      data-revealed={i < revealedCount ? 'true' : 'false'}
      data-word={word}
      className="inline-block"
      style={{ marginRight: i === words.length - 1 ? 0 : '0.3em' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: i < revealedCount ? 1 : 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {word}
    </m.span>
  ))
}

/** Tiny inline-SVG sparkle. Fallback while `sparkle-particle.svg` is on
 *  assets-todo.md. Sized 1em so it inherits parent font-size. */
function SparkleGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role="presentation"
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Inline flower-glyph fallback while `flower-glyph.svg` is on assets-todo.md.
 *  Rendered N times for the visual-groups row. */
function FlowerGroup({ count }: { count: number }) {
  return (
    <span
      data-testid="math-flower-group"
      data-count={count}
      className="inline-flex items-center gap-1"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} role="presentation" aria-hidden>
          <FlowerGlyph />
        </span>
      ))}
    </span>
  )
}

function FlowerGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      role="presentation"
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* 5 petals around a yellow centre */}
      {[0, 72, 144, 216, 288].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const cx = 16 + Math.cos(rad - Math.PI / 2) * 7
        const cy = 16 + Math.sin(rad - Math.PI / 2) * 7
        return (
          <circle
            key={angle}
            cx={cx}
            cy={cy}
            r="6"
            fill="#FFC0CB"
            stroke="#F48FB1"
            strokeWidth="0.6"
          />
        )
      })}
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
      />
    </svg>
  )
}

/** Sparkle burst — 6 particles that spring out from the chip centre. */
function SparkleBurst() {
  // 6 particles arranged in a circle. Same particle component pattern as
  // Session-1 Screen 5 (per spec §Stardust treatment).
  return (
    <span
      data-testid="math-sparkle-burst"
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2
        const dx = Math.cos(angle) * 60
        const dy = Math.sin(angle) * 60
        return (
          <m.span
            key={i}
            data-testid="math-sparkle-particle"
            className="absolute"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 120,
              damping: 18,
              duration: 0.6,
            }}
          >
            <SparkleGlyph />
          </m.span>
        )
      })}
    </span>
  )
}

// ── Chip-order shuffle (deterministic per problem) -----------------------

/**
 * Build the chip order: correct + 2 distractors, shuffled deterministically
 * per problem. Determinism matters for tests (no Math.random seeding) and
 * for the QA-replay pattern (same plan + same problem index → same chip
 * positions). The shuffle uses a tiny LCG seeded from the problem index +
 * the correct answer so two different problems with the same correct value
 * produce different orderings.
 */
function buildChipOrder(problem: MathProblem): readonly number[] {
  const [d1, d2] = pickDistractors(problem.correct, problem.index)
  const values = [problem.correct, d1, d2]
  // Deterministic Fisher-Yates with a per-problem seed.
  const seed = (problem.index * 31 + problem.correct * 17 + 1) >>> 0
  const rng = lcg(seed)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

/** Tiny linear-congruential RNG. Deterministic, no Math.random. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export default MathScreen
