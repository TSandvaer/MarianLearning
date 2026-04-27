import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useAudioUnlockGate } from '../../lib/audio/useAudioUnlockGate'
import {
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from '../../lib/audio/howlerContext'
import { recordUnlockStateEvent } from '../../lib/debug/audioContextProbe'
import { createSfx, type Sfx } from '../../lib/sfx'
import { pickDistractors } from './wordDistractors'
import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from '../Math/stardust'
import {
  pickStaticWordSongPlan,
  type WordSongSessionPlan,
  type WordSongProblem,
} from './wordSessionPlans'
import { STREAK_BONUS_THRESHOLDS } from './constants'
import { WordPicture } from './wordPictures'
import type { WordEntry } from './wordPack'

/**
 * Screen 4 — Word Song (CVC short-a, picture-discrimination).
 *
 * Spec: design/screen-4-word-song.md is canonical. The picture pack and
 * distractor matrix are in design/word-song-picture-pack.md (merged).
 * Phonics-sequence research is design/research/phonics-sequence-marian.md.
 *
 * Architectural notes
 * -------------------
 * - Pure functions live in sibling files (`wordDistractors.ts`,
 *   `wordSessionPlans.ts`, `wordPack.ts`). This component is the
 *   orchestration layer + the visual choreography. Tests for the data
 *   live with the data; tests for the screen interaction live here.
 * - Audio: same Path A pipeline as Math (`api/_tts.ts` +
 *   `lib/audio/sessionAudio`). Wired by `lib/audio/wordSongPathA.ts`
 *   sibling of mathPathA.ts. Default `playUtterance` is the silent-but-
 *   captioned 165 wpm fallback.
 * - Stardust + streak: SHARED with Math via the Math `stardust.ts`
 *   localStorage helper (key `marian-tutor.stardust.v1`). Per spec
 *   §"Stardust treatment" → "Cross-screen accumulation (locked)".
 *   Streak thresholds: shared `STREAK_BONUS_THRESHOLDS = [3, 5, 8]`.
 * - HUD: per spec line 656 the HUD should be a shared component, but
 *   the spec also says (line 776) "Don't extract MathHud to shared in
 *   this PR — keep Word Song self-contained (own HUD locally). Future
 *   PR can refactor to shared." We honour that — the HUD here is a
 *   local copy of Math's HUD shape with `data-testid="word-song-*"`
 *   attributes. Refactor ticket flagged in PR description.
 * - All animation goes through `<m.*>` under the global LazyMotion at
 *   the App root. Same iPad budget rule.
 * - Reduced-motion: same hook pattern as Math. Skip particle bursts,
 *   snap pose swaps, no stagger.
 */

// ── Constants — single source of truth, mirror the spec --------------------

/** Wrong-attempt count after which the hint utterance fires. Spec §"Wrong-
 *  answer policy" → "After 2 wrong attempts on the same problem". */
const HINT_AFTER_WRONG_COUNT = 2

/** Wrong-attempt count after which the guided-completion path fires. */
const GUIDED_AFTER_WRONG_COUNT = 3

/** Auto-advance delay after a correct answer. Spec §"Audio dispatch
 *  sequence on chip tap (correct)" line 388. */
const ADVANCE_AFTER_CORRECT_MS = 1200

/** Wrong-tap chip shake duration. Spec §"Wrong-answer policy" item 1. */
const WRONG_SHAKE_MS = 400

/** Hint reveal delay after the wrong sequence completes. Spec §"Wrong-answer
 *  policy" hint choreography note. */
const HINT_DELAY_AFTER_WRONG_MS = 600

/** Streak fade-out duration when a wrong tap breaks the streak. */
const STREAK_FADE_OUT_MS = 400

/**
 * Audio-unlock watchdog window — sized to outlast the event-driven
 * AudioContext resume await (5 000 ms) plus the Howler play → onplay
 * settle (~50 ms) plus slack. Phase-7 (ticket 86c9gvd0y) bumped this
 * from 1 500 ms → 6 000 ms; see Greet.tsx FIRST_UTTERANCE_RETRY_MS for
 * the full history.
 */
const FIRST_UTTERANCE_RETRY_MS = 6_000

/** Spring preset — chip tap (matches Math). */
const CHIP_TAP_SPRING = { type: 'spring' as const, stiffness: 300, damping: 18 }

/** Pop tween — used for the 3-keyframe `[1, 1.25, 1]` HUD pop. Same as Math. */
const HUD_POP_TWEEN = {
  type: 'tween' as const,
  duration: 0.25,
  ease: 'easeOut' as const,
}

// ── Public types ----------------------------------------------------------

/** Shape the screen invokes when problem 8 finishes. Per spec §"Transition
 *  out (session end, problem 8 complete)" — emits an
 *  `onSessionComplete({ ... surface: 'word-song' })` callback. */
export interface WordSongSessionResult {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /** Stardust _earned in this session_, not the all-time persisted total. */
  earnedThisSession: number
  /** Surface tag — distinguishes Word Song from Math at the session-end
   *  consumer level (per spec line 540). */
  surface: 'word-song'
}

/** Function signature for playing one canonical Word Song utterance. */
export type PlayWordSongUtteranceFn = (
  text: string,
  opts?: PlayWordSongUtteranceOptions,
) => Promise<void>

export interface PlayWordSongUtteranceOptions {
  /** Fires once when the audio actually begins. */
  onPlay?: () => void
  /** Fires per word; used by the caption ribbon to reveal text. */
  onWordTick?: (wordIndex: number) => void
}

export interface WordSongProps {
  /** Optional: fires when problem 8 finishes (any path). */
  onSessionComplete?: (result: WordSongSessionResult) => void
  /** Optional: override the session plan. Defaults to
   *  `pickStaticWordSongPlan()` until Path A wires Claude into mount. */
  plan?: WordSongSessionPlan
  /** Optional: replace the audio playback function. Default is the
   *  silent-but-captioned 165 wpm fallback. */
  playUtterance?: PlayWordSongUtteranceFn
  /** Optional: sparkle SFX on correct. Default a Howler-backed silent-fallback. */
  sparkle?: Sfx
  /** Optional: poof SFX on wrong. Default a Howler-backed silent-fallback. */
  poof?: Sfx
  /** Optional: stardust grain plink SFX on counter arrival. Silent-fallback. */
  plink?: Sfx
  /** Optional: localStorage adapter for stardust. Defaults to
   *  window.localStorage when present, in-memory shim otherwise. */
  storage?: StorageAdapter
  /** Test seam: clock injection. */
  now?: () => Date
  /** Test seam: spy on the per-gesture `Howler.ctx.resume()` kick. */
  resumeAudioContext?: () => void
  /** Test seam: spy on the per-gesture iOS audio-session unlock. */
  unlockAudioSession?: () => void
}

// ── Default no-op playback (silent-but-captioned fallback) -----------------

/**
 * Default playback. Resolves after the line "would have" finished at ~165
 * wpm. Same shape as Math's defaultPlayUtterance — caption ticks word-by-
 * word even without real audio.
 */
const defaultPlayUtterance: PlayWordSongUtteranceFn = (text, opts) => {
  return new Promise<void>((resolve) => {
    const words = text.split(/\s+/).filter(Boolean)
    const wordCount = Math.max(1, words.length)
    const totalMs = (wordCount / 165) * 60_000
    const intervalMs = totalMs / wordCount

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
  resolved: boolean
  wrongCount: number
  hintPlayed: boolean
  guidedPlayed: boolean
}

const FRESH_PROBLEM_STATE: PerProblemState = {
  resolved: false,
  wrongCount: 0,
  hintPlayed: false,
  guidedPlayed: false,
}

/** Detect prefers-reduced-motion at mount. Same hook shape as Math. */
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

function WordSongScreen({
  onSessionComplete,
  plan: planProp,
  playUtterance = defaultPlayUtterance,
  sparkle,
  poof,
  plink,
  storage,
  now = () => new Date(),
  resumeAudioContext,
  unlockAudioSession,
}: WordSongProps) {
  const reducedMotion = usePrefersReducedMotion()

  const resumeAudioCtx = resumeAudioContext ?? resumeHowlerContextOnGesture
  const unlockAudioSessionFn = unlockAudioSession ?? unlockIosAudioSession

  // Plan captured ONCE per mount.
  const plan = useMemo<WordSongSessionPlan>(
    () => planProp ?? pickStaticWordSongPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Lazy SFX. Same defensive 404 pattern as Math/Greet.
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

  // Audio unlock gate.
  const gate = useAudioUnlockGate({ watchdogMs: FIRST_UTTERANCE_RETRY_MS })

  // ── Persistent state ----------------------------------------------------

  /** All-time stardust total. SHARED key with Math per spec. */
  const [stardust, setStardust] = useState<StardustState>(() =>
    loadStardust(storage),
  )

  /** Always-fresh mirror of `stardust.total`. Same reasoning as Math. */
  const stardustTotalRef = useRef(stardust.total)

  /** Stardust earned this session — for the session-complete callback. */
  const earnedThisSessionRef = useRef(0)

  // ── Per-session state ---------------------------------------------------

  const [problemIndex, setProblemIndex] = useState(0)
  const [problemState, setProblemState] =
    useState<PerProblemState>(FRESH_PROBLEM_STATE)

  /**
   * Always-fresh mirror of `problemState.resolved`. The chip-tap gate must
   * read this synchronously: 5 rapid `fireEvent.click` calls (or 5
   * real-iPad finger-mashes within the same React batch window) all
   * capture the same closure and read the pre-batch `resolved=false`,
   * so without a ref each click runs the full reward path — granting
   * N stardust + crossing streak-bonus thresholds — for a single
   * problem. The ref is flipped synchronously inside `handleCorrectTap`
   * so the very next click in the same gesture tick sees `true` and
   * bails. Visual `data-resolved` continues to derive from React state
   * (used by `disabled` + cursor styling) — only the gate uses the ref.
   * Mirrors Math's PR #66 fix to ticket 86c9gy4mf.
   */
  const resolvedRef = useRef(false)

  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)
  const totalCorrectRef = useRef(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [pose, setPose] = useState<MelodyPose>('idle')
  const [shakingChip, setShakingChip] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [streakFadingOut, setStreakFadingOut] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)

  /** Deterministic chip order per problem — target + 2 distractors,
   *  shuffled by an LCG seeded on the problem index. Same shuffle pattern
   *  as Math, no Math.random for test-stability. */
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
      // Persist on unmount (same defensive write as Math).
      writeStardust(stardustTotalRef.current, storage, now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Audio playback wrapper --------------------------------------------

  const speak = useCallback(
    async (text: string): Promise<void> => {
      setCaptionText(text)
      setCaptionRevealed(0)
      setCaptionVisible(false)

      const words = text.split(/\s+/).filter(Boolean)

      const playOpts: PlayWordSongUtteranceOptions = {
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
        gate.reportSpeechError()
        console.warn(
          `[WordSong] playUtterance rejected for "${text}":`,
          err instanceof Error ? err.message : err,
        )
      } finally {
        setCaptionRevealed(words.length)
      }
    },
    [gate, playUtterance],
  )

  // ── Problem reveal -----------------------------------------------------

  useEffect(() => {
    if (!audioUnlocked) return
    if (guidedActive) return
    const problem = plan.problems[problemIndex]
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void speak(problem.utterances.read)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, audioUnlocked])

  // ── Chip tap handler ---------------------------------------------------

  const advanceToNext = useCallback(() => {
    if (problemIndex < plan.problems.length - 1) {
      setProblemIndex((i) => i + 1)
      setProblemState(FRESH_PROBLEM_STATE)
      // Reset the synchronous resolved gate alongside the React state
      // reset — otherwise the new problem's first chip-tap would see
      // `resolvedRef.current === true` from the previous problem and
      // short-circuit the reward path.
      resolvedRef.current = false
      setShakingChip(null)
      setPose('idle')
      setGuidedActive(false)
      setStreakFadingOut(false)
      setCelebrating(false)
      setCaptionText('')
      setCaptionRevealed(0)
      setCaptionVisible(false)
    } else {
      const finalState = writeStardust(stardustTotalRef.current, storage, now)
      setStardust(finalState)
      onSessionComplete?.({
        totalCorrect: totalCorrectRef.current,
        totalStardust: finalState.total,
        finalStreak: streakRef.current,
        earnedThisSession: earnedThisSessionRef.current,
        surface: 'word-song',
      })
    }
  }, [problemIndex, plan.problems.length, onSessionComplete, storage, now])

  const grantStardust = useCallback(
    (amount: number) => {
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
    (chipWord: string, problem: WordSongProblem) => {
      poofInstance.play()
      setShakingChip(chipWord)
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setShakingChip(null)
        shakeTimerRef.current = null
      }, WRONG_SHAKE_MS)

      setPose('puzzled')
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)

      // Streak break — fade-out + reset.
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
        if (!willTriggerHint && !willTriggerGuided) {
          poseTimerRef.current = setTimeout(() => {
            setPose('idle')
            poseTimerRef.current = null
          }, 0)
        }

        if (willTriggerGuided && !problemState.guidedPlayed) {
          setGuidedActive(true)
          setProblemState((prev) => ({ ...prev, guidedPlayed: true }))
          void speak(problem.utterances.giveAnswer).then(() => {
            poseTimerRef.current = setTimeout(() => {
              setPose('idle')
              poseTimerRef.current = null
            }, 0)
          })
        } else if (willTriggerHint) {
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
    (problem: WordSongProblem) => {
      // Flip the synchronous ref FIRST — before any grant, streak update,
      // or auto-advance schedule — so any same-tick re-entry from a rapid
      // second tap on the correct chip bails at the `onChipTap` gate.
      // React state batching means `setProblemState` below won't be
      // visible until the next render; the ref is the only thing that
      // protects the reward path from compounding. Mirrors Math's PR #66
      // fix to ticket 86c9gy4mf.
      resolvedRef.current = true

      sparkleInstance.play()
      plinkInstance.play()

      setPose('happy')
      setCelebrating(true)
      setProblemState((prev) => ({ ...prev, resolved: true }))

      // Stardust + streak. Same rule as Math: stardust granted even after
      // 1-or-2 wrongs; ONLY the guided-completion path withholds it.
      const isCleanWin =
        problemState.wrongCount === 0 && !problemState.guidedPlayed
      if (!problemState.guidedPlayed) {
        grantStardust(1)
        totalCorrectRef.current += 1
        if (isCleanWin) {
          streakRef.current = streakRef.current + 1
          setStreak(streakRef.current)
          if (
            (STREAK_BONUS_THRESHOLDS as readonly number[]).includes(
              streakRef.current,
            )
          ) {
            grantStardust(1)
          }
        }
      }

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
    (chipWord: string) => {
      const problem = plan.problems[problemIndex]
      // Read the synchronous ref, NOT React state. See `resolvedRef`
      // declaration for the rage-tap rationale (mirrors Math's PR #66
      // fix to ticket 86c9gy4mf).
      if (resolvedRef.current) return

      // Phase-2/5/6 gesture-window fixes (ticket 86c9gvd0y) — same as
      // Math. Pre-call snapshot, then resume + unlock + post-call
      // snapshot. The pre/post pair surfaces the Phase-6 pool refill
      // (pool=N → pool=10) in the iPad export.
      recordUnlockStateEvent()
      resumeAudioCtx()
      unlockAudioSessionFn()
      recordUnlockStateEvent()

      if (!audioUnlocked) {
        setAudioUnlocked(true)
      }

      if (guidedActive && chipWord !== problem.target.word) return

      const isCorrect = chipWord === problem.target.word
      if (isCorrect) {
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
            handleWrongTap(chipWord, problem)
          })
        } else {
          handleWrongTap(chipWord, problem)
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
      // problemState.resolved intentionally omitted — gate reads
      // resolvedRef.current synchronously instead. Mirrors Math's PR #66
      // fix to ticket 86c9gy4mf.
      resumeAudioCtx,
      unlockAudioSessionFn,
    ],
  )

  // ── Render -------------------------------------------------------------

  const currentProblem = plan.problems[problemIndex]
  const showStreak = streak >= 2 || streakFadingOut

  return (
    <m.main
      data-testid="word-song"
      data-problem-index={problemIndex}
      data-streak={streak}
      data-stardust={stardust.total}
      data-pose={pose}
      data-gate-state={gate.state}
      data-guided={guidedActive ? 'true' : 'false'}
      data-target-word={currentProblem.target.word}
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
      {/* Song-scene background — `bg-song.svg` is on assets-todo.md.
          Until it lands, soft pink-cream gradient reads as "song-y" with
          a slightly cooler tint than Math's garden. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(255,210,235,0.55) 0%, rgba(255,245,250,0) 60%), linear-gradient(180deg, #FFF5FA 0%, #FFF8F8 100%)',
        }}
      />

      {/* HUD strip — local copy of Math's HUD shape per spec line 776
          (don't extract to shared in this PR). Same data attrs but namespaced
          `word-song-*` so QA can target them independently. */}
      <div
        data-testid="word-song-hud"
        className="
          flex h-14 w-full items-center justify-between
          px-4
        "
      >
        {/* Stardust counter — left */}
        <div
          data-testid="word-song-stardust"
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
          data-testid="word-song-problem-dots"
          aria-hidden
          className="flex items-center gap-2"
        >
          {plan.problems.map((p, i) => {
            const completed = i < problemIndex
            const current = i === problemIndex
            return (
              <span
                key={p.index}
                data-testid="word-song-problem-dot"
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

        {/* Streak indicator — right. Hidden until streak >= 2. */}
        <div className="flex h-8 w-20 items-center justify-end">
          <AnimatePresence>
            {showStreak && (
              <m.div
                key="streak"
                data-testid="word-song-streak"
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
        {/* Melody — upper-left, ~26vh per spec (slightly smaller than
            Math's 30vh — see spec line 141). */}
        <AnimatePresence initial={false}>
          <m.img
            layoutId="melody"
            key={pose}
            data-testid="word-song-melody"
            data-pose={pose}
            src={`/assets/melody-${pose}.svg`}
            alt="Melody"
            draggable={false}
            className="h-[26vh] w-auto select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>

        {/* Caption ribbon — to Melody's right. Same word-by-word reveal
            as Greet/Math. */}
        {captionVisible && captionText && (
          <m.div
            data-testid="word-song-ribbon"
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
              data-testid="word-song-caption"
              className="font-display text-[1.6rem] leading-snug text-ink"
            >
              {renderCaption(captionText, captionRevealed)}
            </p>
          </m.div>
        )}
      </div>

      {/* Word card — picture above letters (per spec §"Word card composition").
          Picture leads (meaning first), letters below (decoding follows). */}
      <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <div
          data-testid="word-song-word-card"
          data-word={currentProblem.target.word}
          className="flex flex-col items-center gap-2"
        >
          {/* Picture — 180pt square. Renders inline-SVG placeholder until
              real pack ships (see wordPictures.tsx for sourcing posture). */}
          <m.div
            data-testid="word-song-word-picture"
            className="flex items-center justify-center"
            style={{ width: '180px', height: '180px' }}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.2 }
                : { type: 'spring', stiffness: 260, damping: 16 }
            }
          >
            <WordPicture
              pictureKey={currentProblem.target.pictureKey}
              large
              ariaLabel={currentProblem.target.word}
            />
          </m.div>

          {/* Letters — 96pt, ~32pt apart. Each letter is tappable for
              phoneme playback per spec §"Audio dispatch sequence on letter
              tap". v1 keeps letter taps as visual-only (no phoneme audio
              authored yet — phoneme files are pending Matt's pipeline call,
              see spec §"Phoneme audio"). The letter pulse + colour shift
              still fires so the affordance is visible to Marian. */}
          <div
            data-testid="word-song-letters"
            className="flex items-center"
            style={{ gap: '32px' }}
          >
            {currentProblem.target.word.split('').map((letter, i) => (
              <LetterGlyph
                key={`${i}-${letter}`}
                letter={letter}
                index={i}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Picture chips — 3 chips, 96×96pt with 24pt gaps per spec line 143. */}
      <div
        data-testid="word-song-chips"
        className="
          mb-8 flex w-full items-center justify-center px-4
        "
        style={{ gap: '24px' }}
      >
        {chipOrder.map((entry) => {
          const isCorrect = entry.word === currentProblem.target.word
          const isShaking = shakingChip === entry.word
          const dimForGuided = guidedActive && !isCorrect
          const guidedShimmer = guidedActive && isCorrect
          return (
            <m.button
              key={entry.word}
              type="button"
              data-testid="word-song-chip"
              data-word={entry.word}
              data-picture-key={entry.pictureKey}
              data-correct={isCorrect ? 'true' : 'false'}
              data-shaking={isShaking ? 'true' : 'false'}
              aria-label={`Picture of ${entry.word}`}
              onClick={() => onChipTap(entry.word)}
              disabled={problemState.resolved || dimForGuided}
              className={`
                relative flex select-none items-center justify-center
                rounded-2xl border-[3px] border-my-pink bg-white
                transition-opacity
                disabled:cursor-default
                touch-manipulation
                ${dimForGuided ? 'opacity-60' : 'opacity-100'}
                ${guidedShimmer ? 'shadow-[0_0_24px_rgba(244,143,177,0.85)]' : 'shadow-[0_4px_12px_rgba(244,143,177,0.18)]'}
              `}
              style={{
                width: '96px',
                height: '96px',
                minWidth: '60px',
                minHeight: '60px',
                cursor:
                  problemState.resolved || dimForGuided ? 'default' : 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                padding: '8px',
              }}
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={
                isShaking
                  ? reducedMotion
                    ? { scale: 1, opacity: [1, 0.7, 1], y: 0 }
                    : { x: [0, -6, 6, -4, 4, 0], scale: 1, opacity: 1, y: 0 }
                  : { scale: 1, opacity: dimForGuided ? 0.6 : 1, x: 0, y: 0 }
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
              <WordPicture
                pictureKey={entry.pictureKey}
                ariaLabel={entry.word}
              />

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

/** Caption render — same word-by-word reveal pattern as Math/Greet. */
function renderCaption(text: string, revealedCount: number) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <m.span
      key={`${i}-${word}`}
      data-testid="word-song-caption-word"
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

/** A single letter on the word card. Letter taps pulse + shift colour but
 *  do NOT play phoneme audio in v1 — phoneme files (`phoneme-*.mp3`) are
 *  pending Matt's pipeline call (spec §"Phoneme audio"). When the audio
 *  files land, this component grows a `phoneme-{letter}.mp3` Howler call
 *  alongside the existing visual feedback. */
function LetterGlyph({
  letter,
  index,
  reducedMotion,
}: {
  letter: string
  index: number
  reducedMotion: boolean
}) {
  const [tapped, setTapped] = useState(false)

  const handleTap = useCallback(() => {
    setTapped(true)
    // Visual reset after the pulse — independent of any audio event since
    // phoneme audio is not yet wired (see spec §Phoneme audio note).
    window.setTimeout(() => setTapped(false), 400)
  }, [])

  return (
    <m.button
      type="button"
      data-testid="word-song-letter"
      data-letter={letter}
      data-index={index}
      aria-label={`Letter ${letter}`}
      onClick={handleTap}
      className="
        bg-transparent border-0 cursor-pointer select-none
        font-display text-[6rem] leading-none
        touch-manipulation
      "
      style={{
        padding: '8px 4px',
        color: tapped ? '#FFB7C5' : '#3B3B3B',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={
        tapped && !reducedMotion
          ? { scale: [1, 1.2, 1], opacity: 1 }
          : { scale: 1, opacity: 1 }
      }
      transition={
        tapped
          ? { duration: 0.4, ease: 'easeOut' }
          : reducedMotion
            ? { duration: 0.15 }
            : {
                type: 'spring',
                stiffness: 300,
                damping: 18,
                delay: 0.15 * index,
              }
      }
    >
      {letter}
    </m.button>
  )
}

/** Tiny inline-SVG sparkle. Same fallback as Math. */
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

/** Sparkle burst — 6 particles. Same component pattern as Math. */
function SparkleBurst() {
  return (
    <span
      data-testid="word-song-sparkle-burst"
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
            data-testid="word-song-sparkle-particle"
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
 * Build the chip order: target + 2 distractors, shuffled deterministically
 * per problem. Same shuffle pattern as Math (LCG seeded on problem index +
 * a hash of the target word).
 */
function buildChipOrder(problem: WordSongProblem): readonly WordEntry[] {
  const [d1, d2] = pickDistractors(problem.target, problem.index)
  const values = [problem.target, d1, d2]
  // Hash word → number for the seed (so different targets shuffle
  // differently for the same problem index in cross-plan QA replay).
  const wordHash = problem.target.word
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0)
  const seed = (problem.index * 31 + wordHash + 1) >>> 0
  const rng = lcg(seed)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

/** Tiny LCG. Deterministic, no Math.random — same shape as Math's. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export default WordSongScreen
