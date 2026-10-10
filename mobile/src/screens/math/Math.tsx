/**
 * Screen 3, Math (Number Garden): 8 problems with Emma. Native port of
 * `src/screens/Math/Math.tsx` (web, the source of truth; spec
 * `design/screen-3-math.md`) with the phone layouts of
 * `design/native/greet-math-native.md` § 4.
 *
 * Kept from the web, behaviour for behaviour:
 * - **Read-aloud** per problem, held until the session start settles
 *   (`audioReady`); Emma `listening` while she reads; captions word by word.
 * - **Chip tap-gate**: chips open when the read-aloud STARTS (`onPlay`),
 *   on a speech error at once, or after a 2 s watchdog; a tap before that
 *   does nothing (no score, no attempt).
 * - **Right answer**: sparkle + plink, Emma `celebration`, +1 stardust
 *   (not after the guided answer), streak +1 on a clean win with +1 and a
 *   chime 320 ms later at 3 / 5 / 8, then advance after
 *   max(1.2 s, the "Yes!" line) with a 4 s ceiling.
 * - **Wrong answer**: poof, the chip shakes, Emma `puzzled-tilt` (never a
 *   red X), the streak breaks (fades from 2+), "try again?"; at 2 wrongs
 *   the hint (three-beat with the flower groups pulsing, or the legacy
 *   single hint) with Emma `attentive-pointing`; at 3 wrongs she gives the
 *   answer and only that chip stays tappable (no stardust for it).
 * - **Scaffolds**: the subitising dot card (add) and the minuend cell
 *   (sub-to-10) under core's gates, once per problem.
 * - **Result**: first-tap correctness / value / latency and the offered
 *   distractor class per problem, the scaffold flags, stardust and streak
 *   (`MathSessionResult`), handed to App after problem 8.
 * - Background: an advance due while the app is hidden waits for its
 *   return; the dot card's timers pause.
 *
 * Dropped (web-only): the WebKit audio-unlock gate, the Howler context
 * resume / iOS session unlock per tap, the first-tap-unlocks-audio branch
 * and the audioCtx probes. Native audio needs no gesture: the read-aloud
 * starts as soon as the session start settles.
 *
 * Emma herself is App's hoisted `EmmaStage`; this screen reports her pose
 * through `onPoseChange`. Layers: the garden background (below Emma), the
 * HUD, ribbon, problem and chips (above her).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import {
  pipsFromProblem,
  shouldShowDotCard,
  subMinuendFromProblem,
} from '@marian/core/math/dotCard'
import { chipMaxAnswerForCorrects } from '@marian/core/math/distractors'
import {
  pickStaticSessionPlan,
  type MathProblem,
  type MathSessionPlan,
} from '@marian/core/math/sessionPlans'
import {
  shouldShowSubitisingScaffold,
  shouldShowSubitisingSubScaffold,
} from '@marian/core/math/subitisingScaffold'
import type { SkillNode } from '@marian/core/progress'
import {
  ADVANCE_AFTER_CORRECT_MS,
  ADVANCE_HARD_CEILING_MS,
  GUIDED_AFTER_WRONG_COUNT,
  HINT_AFTER_WRONG_COUNT,
  HINT_DELAY_AFTER_WRONG_MS,
  STREAK_BONUS_THRESHOLDS,
  STREAK_FADE_OUT_MS,
  WRONG_SHAKE_MS,
} from '@marian/core/shared/gameplayConstants'
import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from '@marian/core/shared/stardust'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import {
  audioEngine,
  createSfx,
  recordAudio,
  SFX_SOURCES,
  type Sfx,
} from '../../audio'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import { countingMetrics, type MathLayout } from '../../layout/mathLayout'
import {
  appVisibility,
  useIsAppHidden,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { colors, FILL, fonts } from '../../theme'
import { AnswerChip } from './AnswerChip'
import { buildChipOrder, type OfferedDistractorClass } from './chipOrder'
import { CountingRow } from './CountingRow'
import { GettingReady } from './GettingReady'
import { MathHud } from './MathHud'
import type {
  MathSessionResult,
  PlayMathUtteranceFn,
  PlayMathUtteranceOptions,
} from './mathTypes'
import { ScaffoldFlash } from './ScaffoldFlash'
import { createSilentMathPlayer, type SilentMathPlayer } from './silentPlayer'

/** Web: the chime lands 320 ms after sparkle + plink (#133 follow-up). */
export const STREAK_CHIME_STAGGER_MS = 320
/** Web: first-tap latency below this is touch noise (-1). */
export const LATENCY_FLOOR_MS = 250
/** Web: above this she walked away (-1). */
export const LATENCY_CEILING_MS = 60_000
/** Web: the chip gate fails open this long after the read-aloud starts. */
export const CHIP_GATE_FALLBACK_MS = 2000
/** Math fades out over 250 ms (web `exit`). */
export const MATH_EXIT_MS = 250

/** The four effects, with the web's volumes. Test seam. */
export interface MathSfx {
  sparkle: Sfx
  poof: Sfx
  plink: Sfx
  chime: Sfx
}

function createMathSfx(): MathSfx {
  return {
    sparkle: createSfx({ src: SFX_SOURCES.sparkle, volume: 0.55 }),
    poof: createSfx({ src: SFX_SOURCES.poof, volume: 0.45 }),
    plink: createSfx({ src: SFX_SOURCES.plink, volume: 0.3 }),
    chime: createSfx({ src: SFX_SOURCES.chime, volume: 0.7 }),
  }
}

/** Stop Emma's line if it is a session line (Math's own lines are). */
function cancelSessionLine(): void {
  if (audioEngine.voice.activeLabel?.startsWith('session:')) {
    audioEngine.cancelVoice()
  }
}

export interface MathProps {
  layout: MathLayout
  /** The session plan: the server's once it settled, else the static one. */
  plan?: MathSessionPlan
  /** The session audio's player; without it the captions walk silently. */
  playUtterance?: PlayMathUtteranceFn
  /**
   * `false` while the session start is in flight: the problem area shows
   * "getting ready", Emma listens, and problem 1 is not read yet.
   * `undefined` = not applicable (read at once).
   */
  audioReady?: boolean
  focusNode?: SkillNode
  subitisingScaffoldActive?: boolean
  subitisingSubScaffoldActive?: boolean
  onSessionComplete?: (result: MathSessionResult) => void
  /** The back arrow (to the Hub). */
  onRequestExit: () => void
  /** Emma's pose, for App's `EmmaStage`. */
  onPoseChange?: (pose: EmmaPose) => void
  /** Stops Emma's line in flight (on unmount). Default: the engine's. */
  cancelLine?: () => void
  sfx?: MathSfx
  storage?: StorageAdapter
  now?: () => Date
  visibility?: AppVisibility
  /**
   * QA only (debug + `EXPO_PUBLIC_QA_AUTOTAP_MS`), for simulators nothing
   * can tap: answer this long after each chip gate opens. Problem 1 gets
   * three wrong answers (re-prompt, hint, guided answer), problem 2 one,
   * the rest the right one.
   */
  qaAutoAnswerAfterMs?: number
  /** Test seam: the silent caption walk used without a player. */
  silentPlayer?: SilentMathPlayer
}

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

/** hint1/2/3 all present, else `null` (the legacy single hint). */
function resolveHintTriple(
  u: MathProblem['utterances'],
): { hint1: string; hint2: string; hint3: string } | null {
  if (
    typeof u.hint1 === 'string' &&
    typeof u.hint2 === 'string' &&
    typeof u.hint3 === 'string'
  ) {
    return { hint1: u.hint1, hint2: u.hint2, hint3: u.hint3 }
  }
  return null
}

/**
 * Monotonic ms for the latency capture (web: `performance.now()`). React
 * Native provides `performance` at runtime; its typings do not declare it.
 */
const nowMs = (): number =>
  (globalThis as { performance?: { now(): number } }).performance?.now() ??
  Date.now()

/** Run `fn` in a microtask (web: `queueMicrotask`, not in RN's typings). */
const microtask = (fn: () => void): void => {
  void Promise.resolve().then(fn)
}

export function MathScreen({
  layout,
  plan: planProp,
  playUtterance,
  audioReady,
  focusNode,
  subitisingScaffoldActive,
  subitisingSubScaffoldActive,
  onSessionComplete,
  onRequestExit,
  onPoseChange,
  cancelLine = cancelSessionLine,
  sfx: sfxProp,
  storage,
  now = () => new Date(),
  visibility = appVisibility,
  qaAutoAnswerAfterMs,
  silentPlayer,
}: MathProps) {
  const appHidden = useIsAppHidden(visibility)

  // Same as the web: the plan follows `planProp` (the server plan swaps in
  // for the static one while the problem area still shows "getting ready").
  const plan = useMemo<MathSessionPlan>(
    () => planProp ?? pickStaticSessionPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: `now` only seeds the fallback
    [planProp],
  )

  // Fixed at mount: the effects, the silent player, the line canceller.
  const [sfx] = useState<MathSfx>(() => sfxProp ?? createMathSfx())
  const [silent] = useState(() => silentPlayer ?? createSilentMathPlayer())
  const [cancelEmmaLine] = useState(() => cancelLine)
  const playRef = useRef<PlayMathUtteranceFn>(silent.play)
  useLayoutEffect(() => {
    playRef.current = playUtterance ?? silent.play
  })
  const onSessionCompleteRef = useRef(onSessionComplete)
  const onPoseChangeRef = useRef(onPoseChange)
  useLayoutEffect(() => {
    onSessionCompleteRef.current = onSessionComplete
    onPoseChangeRef.current = onPoseChange
  })

  // ── Persistent + per-session state (web names) ───────────────────────

  const [stardust, setStardust] = useState<StardustState>(() =>
    loadStardust(storage),
  )
  const stardustTotalRef = useRef(stardust.total)
  const earnedThisSessionRef = useRef(0)

  const [problemIndex, setProblemIndex] = useState(0)
  const [activeDismissForIndex, setActiveDismissForIndex] = useState<
    number | null
  >(null)
  const [subMinuendDismissForIndex, setSubMinuendDismissForIndex] = useState<
    number | null
  >(null)
  const subitisingScaffoldRenderedRef = useRef(false)
  const subitisingScaffoldSubRenderedRef = useRef(false)

  const [problemState, setProblemState] =
    useState<PerProblemState>(FRESH_PROBLEM_STATE)
  // Synchronous mirrors: a burst of taps in one tick must see the latest.
  const resolvedRef = useRef(false)
  const wrongCountRef = useRef(0)
  const hintPlayedRef = useRef(false)
  const guidedPlayedRef = useRef(false)

  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)
  const totalCorrectRef = useRef(0)

  const perProblemCorrectRef = useRef<boolean[]>(plan.problems.map(() => false))
  const perProblemAnswerValueRef = useRef<(number | null)[]>(
    plan.problems.map(() => null),
  )
  const perProblemDistractorClassRef = useRef<
    (OfferedDistractorClass | null)[]
  >(plan.problems.map(() => null))
  const latencyMsByProblemRef = useRef<number[]>(plan.problems.map(() => -1))
  const chipReadyAtRef = useRef<number | null>(null)
  const firstTapRecordedRef = useRef(false)

  /** Completion of the read-aloud (not the chip gate). */
  const [readAloudPlayed, setReadAloudPlayed] = useState(false)
  const readAloudPlayedRef = useRef(false)

  /** The chip tap-gate (opens at the read-aloud's START). */
  const [chipGateOpen, setChipGateOpen] = useState(false)
  const chipGateOpenRef = useRef(false)
  const chipGateWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openChipGate = useCallback((via: 'tts-start' | 'fallback') => {
    if (chipGateWatchdogRef.current !== null) {
      clearTimeout(chipGateWatchdogRef.current)
      chipGateWatchdogRef.current = null
    }
    if (chipGateOpenRef.current) return
    chipGateOpenRef.current = true
    // Latency anchor at TTS start; the fallback path anchors on completion.
    if (via === 'tts-start' && chipReadyAtRef.current === null) {
      chipReadyAtRef.current = nowMs()
    }
    setChipGateOpen(true)
  }, [])

  /** "speak() already started for this problem" (no double read-aloud). */
  const spokeReadAloudRef = useRef(false)

  const [pose, setPose] = useState<EmmaPose>('idle')
  const [hintBeat, setHintBeat] = useState<'group-a' | 'group-b' | null>(null)
  const [shakingChip, setShakingChip] = useState<number | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(false)
  const [captionGeneration, setCaptionGeneration] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const [streakFadingOut, setStreakFadingOut] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)

  const planMaxAnswer = useMemo(
    () => chipMaxAnswerForCorrects(plan.problems.map((p) => p.correct)),
    [plan],
  )
  const chipOrderWithClass = useMemo(
    () => buildChipOrder(plan.problems[problemIndex], planMaxAnswer, focusNode),
    [plan, problemIndex, planMaxAnswer, focusNode],
  )
  useEffect(() => {
    perProblemDistractorClassRef.current[problemIndex] =
      chipOrderWithClass.offeredClass
  }, [problemIndex, chipOrderWithClass.offeredClass])

  // ── Timers + lifetime ────────────────────────────────────────────────

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streakFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minDwellElapsedRef = useRef(false)
  const correctSpeakResolvedRef = useRef(false)
  const advanceFiredRef = useRef(false)
  const pendingAdvanceRef = useRef(false)
  const unmountedRef = useRef(false)
  const problemIndexRef = useRef(problemIndex)
  /** Math lines in flight (to stop them on unmount). */
  const linesInFlightRef = useRef(0)
  /** The newest line's number: only it may finish the caption. */
  const lineGenerationRef = useRef(0)

  const clearAllTimers = useCallback(() => {
    for (const ref of [
      advanceTimerRef,
      advanceCeilingTimerRef,
      shakeTimerRef,
      hintTimerRef,
      poseTimerRef,
      streakFadeTimerRef,
      chimeTimerRef,
      chipGateWatchdogRef,
    ]) {
      if (ref.current !== null) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      unmountedRef.current = true
      clearAllTimers()
      // No audio leak: Emma's line (and a silent caption walk) stop here.
      silent.cancel()
      if (linesInFlightRef.current > 0) cancelEmmaLine()
      sfx.sparkle.unload()
      sfx.poof.unload()
      sfx.plink.unload()
      sfx.chime.unload()
      writeStardust(stardustTotalRef.current, storage, now)
      // Emma is App's: hand her back calm.
      onPoseChangeRef.current?.('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, [])

  // Emma's pose for App: `listening` while the session start is in flight.
  const effectivePose: EmmaPose =
    audioReady === false && pose === 'idle' ? 'listening' : pose
  useEffect(() => {
    onPoseChange?.(effectivePose)
  }, [effectivePose, onPoseChange])

  // ── Speaking ─────────────────────────────────────────────────────────

  /**
   * Speak one line and drive the ribbon. `isReadAloud` (only the
   * per-problem read) opens the chip gate on the line's start, and at
   * once if it fails. Never rejects.
   */
  const speak = useCallback(
    async (text: string, isReadAloud = false): Promise<void> => {
      setCaptionText(text)
      setCaptionRevealed(0)
      setCaptionVisible(false)
      setCaptionGeneration((g) => g + 1)
      const words = text.split(/\s+/).filter(Boolean)
      const opts: PlayMathUtteranceOptions = {
        onPlay: () => {
          if (unmountedRef.current) return
          setCaptionVisible(true)
          if (isReadAloud) openChipGate('tts-start')
        },
        onWordTick: (i) => {
          if (unmountedRef.current) return
          setCaptionRevealed((prev) => Math.max(prev, i + 1))
        },
      }
      const myLine = ++lineGenerationRef.current
      linesInFlightRef.current += 1
      try {
        await playRef.current(text, opts)
      } catch (err) {
        if (isReadAloud) openChipGate('fallback')
        recordAudio({
          kind: 'note',
          label: 'math',
          detail: `line ended early (${err instanceof Error ? err.message : String(err)}): "${text}"`,
        })
      } finally {
        linesInFlightRef.current -= 1
        // The caption ends fully shown, unless a newer line owns the
        // ribbon now (a replaced line must not touch the new caption).
        if (!unmountedRef.current && myLine === lineGenerationRef.current) {
          setCaptionVisible(true)
          setCaptionRevealed(words.length)
        }
      }
    },
    [openChipGate],
  )

  // ── Problem reveal: the read-aloud ───────────────────────────────────

  useEffect(() => {
    problemIndexRef.current = problemIndex
  }, [problemIndex])

  const planLength = plan.problems.length
  useEffect(() => {
    const resize = <T,>(arr: T[], fill: T): T[] => {
      if (arr.length === planLength) return arr
      const next = new Array<T>(planLength).fill(fill)
      for (let i = 0; i < Math.min(arr.length, planLength); i++)
        next[i] = arr[i]
      return next
    }
    perProblemCorrectRef.current = resize(perProblemCorrectRef.current, false)
    latencyMsByProblemRef.current = resize(latencyMsByProblemRef.current, -1)
    perProblemAnswerValueRef.current = resize<number | null>(
      perProblemAnswerValueRef.current,
      null,
    )
    perProblemDistractorClassRef.current =
      resize<OfferedDistractorClass | null>(
        perProblemDistractorClassRef.current,
        null,
      )
  }, [planLength])

  useEffect(() => {
    if (guidedActive) return // the guided line owns the audio
    if (audioReady === false) return // session start in flight
    const problem = plan.problems[problemIndex]
    const myProblemIndex = problemIndex
    microtask(() => {
      if (unmountedRef.current) return
      if (problemIndexRef.current !== myProblemIndex) return
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      setPose('listening')
      if (!chipGateOpenRef.current && chipGateWatchdogRef.current === null) {
        chipGateWatchdogRef.current = setTimeout(() => {
          chipGateWatchdogRef.current = null
          if (unmountedRef.current) return
          if (problemIndexRef.current !== myProblemIndex) return
          openChipGate('fallback')
        }, CHIP_GATE_FALLBACK_MS)
      }
      void speak(problem.utterances.read, true).then(() => {
        if (unmountedRef.current) return
        if (problemIndexRef.current !== myProblemIndex) return
        readAloudPlayedRef.current = true
        setReadAloudPlayed(true)
        setPose((current) => (current === 'listening' ? 'idle' : current))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: re-run on problem / readiness only
  }, [problemIndex, audioReady])

  // Fallback-path latency anchor (completion) + re-arm per problem.
  useLayoutEffect(() => {
    if (readAloudPlayed) {
      if (chipReadyAtRef.current === null) chipReadyAtRef.current = nowMs()
    } else {
      chipReadyAtRef.current = null
    }
  }, [readAloudPlayed])

  // ── Advance / complete ───────────────────────────────────────────────

  const advanceToNext = useCallback(() => {
    if (problemIndex < plan.problems.length - 1) {
      setProblemIndex((i) => i + 1)
      setProblemState(FRESH_PROBLEM_STATE)
      setHintBeat(null)
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
      resolvedRef.current = false
      wrongCountRef.current = 0
      hintPlayedRef.current = false
      guidedPlayedRef.current = false
      readAloudPlayedRef.current = false
      setReadAloudPlayed(false)
      if (chipGateWatchdogRef.current !== null) {
        clearTimeout(chipGateWatchdogRef.current)
        chipGateWatchdogRef.current = null
      }
      chipGateOpenRef.current = false
      setChipGateOpen(false)
      spokeReadAloudRef.current = false
      chipReadyAtRef.current = null
      firstTapRecordedRef.current = false
      setShakingChip(null)
      // Native-only: drop a pending "back to idle" (set when "Yes!" ended).
      // It would land after the next read-aloud's `listening` and clobber
      // it; the web has the same timer (seen natively, see the PR).
      if (poseTimerRef.current !== null) {
        clearTimeout(poseTimerRef.current)
        poseTimerRef.current = null
      }
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
      onSessionCompleteRef.current?.({
        totalCorrect: totalCorrectRef.current,
        totalStardust: finalState.total,
        finalStreak: streakRef.current,
        earnedThisSession: earnedThisSessionRef.current,
        perProblemCorrect: perProblemCorrectRef.current.slice(),
        latencyMs: latencyMsByProblemRef.current.slice(),
        perProblemAnswerValue: perProblemAnswerValueRef.current.slice(),
        perProblemDistractorClass: perProblemDistractorClassRef.current.slice(),
        subitisingScaffoldRendered: subitisingScaffoldRenderedRef.current,
        subitisingScaffoldSubRendered: subitisingScaffoldSubRenderedRef.current,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` seeds the write only
  }, [problemIndex, plan.problems.length, storage])

  // Back from the background: run the advance that waited for it.
  useEffect(() => {
    if (appHidden || !pendingAdvanceRef.current) return
    pendingAdvanceRef.current = false
    if (advanceCeilingTimerRef.current !== null) {
      clearTimeout(advanceCeilingTimerRef.current)
      advanceCeilingTimerRef.current = null
    }
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    advanceFiredRef.current = true
    microtask(() => {
      if (unmountedRef.current) return
      setCelebrating(false)
      advanceToNext()
    })
  }, [appHidden, advanceToNext])

  const grantStardust = useCallback(
    (amount: number) => {
      stardustTotalRef.current += amount
      setStardust(writeStardust(stardustTotalRef.current, storage, now))
      earnedThisSessionRef.current += amount
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` stamps the write only
    [storage],
  )

  // ── The hint ─────────────────────────────────────────────────────────

  const runHintSequence = useCallback(
    async (problem: MathProblem) => {
      const myIndex = problemIndex
      const stillLive = () =>
        !unmountedRef.current && problemIndexRef.current === myIndex
      const returnToIdle = () => {
        if (!stillLive()) return
        setHintBeat(null)
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
      }
      setPose('attentive-pointing')
      const triple = resolveHintTriple(problem.utterances)
      if (triple === null) {
        const legacy = problem.utterances.hint
        if (typeof legacy === 'string') await speak(legacy)
        returnToIdle()
        return
      }
      setHintBeat('group-a')
      await speak(triple.hint1)
      if (!stillLive()) return
      await speak(triple.hint2)
      if (!stillLive()) return
      setHintBeat('group-b')
      await speak(triple.hint3)
      returnToIdle()
    },
    [speak, problemIndex],
  )

  // ── Taps ─────────────────────────────────────────────────────────────

  const handleWrongTap = useCallback(
    (chipValue: number, problem: MathProblem) => {
      sfx.poof.play()
      setShakingChip(chipValue)
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setShakingChip(null)
        shakeTimerRef.current = null
      }, WRONG_SHAKE_MS)

      setPose('puzzled-tilt')
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)

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

      const nextWrongCount = wrongCountRef.current + 1
      wrongCountRef.current = nextWrongCount
      setProblemState((prev) => ({ ...prev, wrongCount: nextWrongCount }))

      const didScheduleHint =
        nextWrongCount === HINT_AFTER_WRONG_COUNT && !hintPlayedRef.current
      if (didScheduleHint) hintPlayedRef.current = true
      const didScheduleGuided =
        nextWrongCount >= GUIDED_AFTER_WRONG_COUNT && !guidedPlayedRef.current
      if (didScheduleGuided) guidedPlayedRef.current = true

      void speak(problem.utterances.reprompt).then(() => {
        if (unmountedRef.current) return
        if (!didScheduleHint && !didScheduleGuided) {
          poseTimerRef.current = setTimeout(() => {
            setPose('idle')
            poseTimerRef.current = null
          }, 0)
        }
        if (didScheduleGuided) {
          setGuidedActive(true)
          setProblemState((prev) => ({ ...prev, guidedPlayed: true }))
          void speak(problem.utterances.giveAnswer).then(() => {
            if (unmountedRef.current) return
            poseTimerRef.current = setTimeout(() => {
              setPose('idle')
              poseTimerRef.current = null
            }, 0)
          })
        } else if (didScheduleHint) {
          hintTimerRef.current = setTimeout(() => {
            hintTimerRef.current = null
            setProblemState((prev) => ({ ...prev, hintPlayed: true }))
            void runHintSequence(problem)
          }, HINT_DELAY_AFTER_WRONG_MS)
        }
      })
    },
    [sfx, speak, streak, runHintSequence],
  )

  const handleCorrectTap = useCallback(
    (problem: MathProblem) => {
      sfx.sparkle.play()
      sfx.plink.play()
      setPose('celebration')
      setCelebrating(true)
      resolvedRef.current = true
      setProblemState((prev) => ({ ...prev, resolved: true }))
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }

      const isCleanWin = wrongCountRef.current === 0 && !guidedPlayedRef.current
      if (!guidedPlayedRef.current) {
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
            if (chimeTimerRef.current !== null) {
              clearTimeout(chimeTimerRef.current)
            }
            chimeTimerRef.current = setTimeout(() => {
              chimeTimerRef.current = null
              sfx.chime.play()
            }, STREAK_CHIME_STAGGER_MS)
          }
        }
      }

      minDwellElapsedRef.current = false
      correctSpeakResolvedRef.current = false
      advanceFiredRef.current = false

      const tryAdvance = () => {
        if (advanceFiredRef.current) return
        if (!minDwellElapsedRef.current || !correctSpeakResolvedRef.current) {
          return
        }
        // Live read: the app may have gone to the background a moment ago.
        if (visibility.getIsHidden()) {
          pendingAdvanceRef.current = true
          return
        }
        advanceFiredRef.current = true
        if (advanceCeilingTimerRef.current !== null) {
          clearTimeout(advanceCeilingTimerRef.current)
          advanceCeilingTimerRef.current = null
        }
        if (advanceTimerRef.current !== null) {
          clearTimeout(advanceTimerRef.current)
          advanceTimerRef.current = null
        }
        setCelebrating(false)
        advanceToNext()
      }

      void speak(problem.utterances.correct).then(() => {
        if (unmountedRef.current) return
        correctSpeakResolvedRef.current = true
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
        tryAdvance()
      })

      if (advanceTimerRef.current !== null)
        clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        minDwellElapsedRef.current = true
        tryAdvance()
      }, ADVANCE_AFTER_CORRECT_MS)

      if (advanceCeilingTimerRef.current !== null) {
        clearTimeout(advanceCeilingTimerRef.current)
      }
      advanceCeilingTimerRef.current = setTimeout(() => {
        advanceCeilingTimerRef.current = null
        if (advanceFiredRef.current) return
        if (visibility.getIsHidden()) {
          pendingAdvanceRef.current = true
          return
        }
        advanceFiredRef.current = true
        if (advanceTimerRef.current !== null) {
          clearTimeout(advanceTimerRef.current)
          advanceTimerRef.current = null
        }
        setCelebrating(false)
        advanceToNext()
      }, ADVANCE_HARD_CEILING_MS)
    },
    [advanceToNext, grantStardust, sfx, speak, visibility],
  )

  const onChipTap = useCallback(
    (chipValue: number) => {
      const problem = plan.problems[problemIndex]
      if (resolvedRef.current) return
      // Before Emma starts reading, a tap is not an answer.
      if (!chipGateOpenRef.current) return

      const isCorrect = chipValue === problem.correct
      if (!firstTapRecordedRef.current) {
        firstTapRecordedRef.current = true
        const idx = problemIndex
        if (idx >= 0 && idx < perProblemCorrectRef.current.length) {
          perProblemCorrectRef.current[idx] = isCorrect
        }
        if (
          idx >= 0 &&
          idx < latencyMsByProblemRef.current.length &&
          chipReadyAtRef.current !== null
        ) {
          const raw = nowMs() - chipReadyAtRef.current
          const inBand = raw >= LATENCY_FLOOR_MS && raw <= LATENCY_CEILING_MS
          latencyMsByProblemRef.current[idx] = inBand ? raw : -1
        }
        if (idx >= 0 && idx < perProblemAnswerValueRef.current.length) {
          perProblemAnswerValueRef.current[idx] = chipValue
        }
      }

      if (guidedActive && chipValue !== problem.correct) return
      if (isCorrect) handleCorrectTap(problem)
      else handleWrongTap(chipValue, problem)
    },
    [guidedActive, handleCorrectTap, handleWrongTap, plan, problemIndex],
  )

  // QA autoplay (debug only), see `qaAutoAnswerAfterMs`.
  const onChipTapRef = useRef(onChipTap)
  useLayoutEffect(() => {
    onChipTapRef.current = onChipTap
  })
  useEffect(() => {
    if (qaAutoAnswerAfterMs === undefined) return
    if (!chipGateOpen || problemState.resolved) return
    const { correct } = plan.problems[problemIndex]
    const wrongsWanted = problemIndex === 0 ? 3 : problemIndex === 1 ? 1 : 0
    const wrong = chipOrderWithClass.values.find((v) => v !== correct)
    const value =
      problemState.wrongCount < wrongsWanted && wrong !== undefined
        ? wrong
        : correct
    const id = setTimeout(
      () => onChipTapRef.current(value),
      qaAutoAnswerAfterMs,
    )
    return () => clearTimeout(id)
  }, [
    qaAutoAnswerAfterMs,
    chipGateOpen,
    problemState.resolved,
    problemState.wrongCount,
    problemIndex,
    plan,
    chipOrderWithClass,
  ])

  // ── Scaffolds (core's gates, as on the web) ──────────────────────────

  const currentProblem = plan.problems[problemIndex]
  const showStreak = streak >= 2 || streakFadingOut

  const useScaffoldGate =
    focusNode !== undefined && subitisingScaffoldActive !== undefined
  const dotCardInScope = useScaffoldGate
    ? shouldShowSubitisingScaffold(
        focusNode,
        currentProblem,
        subitisingScaffoldActive,
      )
    : shouldShowDotCard(currentProblem)
  const dotCardPips = dotCardInScope ? pipsFromProblem(currentProblem) : null
  const dotCardDismissed =
    !dotCardInScope || activeDismissForIndex === problemIndex
  const showDotCardOverlay =
    dotCardInScope && !dotCardDismissed && dotCardPips !== null
  const flowersVisible = !showDotCardOverlay

  useLayoutEffect(() => {
    if (useScaffoldGate && showDotCardOverlay) {
      subitisingScaffoldRenderedRef.current = true
    }
  }, [useScaffoldGate, showDotCardOverlay])

  const useSubScaffoldGate =
    focusNode !== undefined && subitisingSubScaffoldActive !== undefined
  const subMinuendInScope = useSubScaffoldGate
    ? shouldShowSubitisingSubScaffold(
        focusNode,
        currentProblem,
        subitisingSubScaffoldActive,
      )
    : false
  const subMinuendValue = subMinuendInScope
    ? subMinuendFromProblem(currentProblem)
    : null
  const subMinuendDismissed =
    !subMinuendInScope || subMinuendDismissForIndex === problemIndex
  const showSubMinuendOverlay =
    subMinuendInScope && !subMinuendDismissed && subMinuendValue !== null

  useLayoutEffect(() => {
    if (useSubScaffoldGate && showSubMinuendOverlay) {
      subitisingScaffoldSubRenderedRef.current = true
    }
  }, [useSubScaffoldGate, showSubMinuendOverlay])

  // ── Render ───────────────────────────────────────────────────────────

  const { problem: area, chips, ribbon, ribbonPadding } = layout
  const counting =
    currentProblem.op === '+'
      ? countingMetrics(
          layout,
          currentProblem.addendA,
          currentProblem.addendB,
          area.width,
        )
      : null
  const visualHeight =
    layout.visualSlot ??
    (currentProblem.op === '+'
      ? (counting?.height ?? 0)
      : subMinuendInScope
        ? layout.dotCard.cell
        : 0)
  const showVisualRow = currentProblem.op === '+' || subMinuendInScope

  return (
    <>
      <Animated.View
        testID="math-background"
        exiting={FadeOut.duration(MATH_EXIT_MS)}
        style={styles.background}
      />
      <Animated.View
        testID="math"
        exiting={FadeOut.duration(MATH_EXIT_MS)}
        style={styles.foreground}
      >
        <MathHud
          hud={layout.hud}
          landscape={layout.form === 'phone-landscape'}
          metrics={layout.hudMetrics}
          problemCount={plan.problems.length}
          problemIndex={problemIndex}
          stardust={stardust.total}
          streak={streak}
          showStreak={showStreak}
          streakFadingOut={streakFadingOut}
          celebrating={celebrating}
          onBack={onRequestExit}
        />

        {captionVisible && captionText !== '' && (
          <CaptionRibbon
            testID="math-ribbon"
            text={captionText}
            revealedCount={captionRevealed}
            lineKey={`${captionGeneration}`}
            fontSize={layout.captionFontSize}
            lineHeight={layout.captionLineHeight}
            padding={ribbonPadding}
            style={[
              styles.clayRibbon,
              { left: ribbon.x, top: ribbon.y, width: ribbon.width },
            ]}
          />
        )}

        {audioReady === false ? (
          <View
            style={[
              styles.abs,
              {
                left: area.x,
                top: area.y,
                width: area.width,
                height: chips.rect.y + chips.size - area.y,
              },
            ]}
          >
            <GettingReady testID="math-getting-ready" />
          </View>
        ) : (
          <>
            <View
              testID="math-problem"
              style={[
                styles.abs,
                styles.problem,
                {
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                  gap: layout.problemGap,
                },
              ]}
            >
              <View
                testID="math-symbolic"
                accessible
                accessibilityLabel={currentProblem.utterances.read}
                style={[styles.equation, { gap: layout.equationGap }]}
              >
                {[
                  String(currentProblem.addendA),
                  currentProblem.op === '-' ? '−' : '+',
                  String(currentProblem.addendB),
                  '=',
                  '?',
                ].map((token, i) => (
                  <Text
                    key={i}
                    allowFontScaling={false}
                    style={[
                      styles.equationText,
                      {
                        fontSize: layout.equationFont,
                        lineHeight: layout.equationLineHeight,
                      },
                    ]}
                  >
                    {token}
                  </Text>
                ))}
              </View>

              {showVisualRow && (
                <View style={[styles.visual, { height: visualHeight }]}>
                  {counting !== null && (
                    <CountingRow
                      addendA={currentProblem.addendA}
                      addendB={currentProblem.addendB}
                      metrics={counting}
                      visible={flowersVisible}
                      hintBeat={hintBeat}
                    />
                  )}
                  {showDotCardOverlay && dotCardPips !== null && (
                    <ScaffoldFlash
                      key={`dot-${problemIndex}`}
                      content={{
                        kind: 'dot-card',
                        pipsA: dotCardPips[0],
                        pipsB: dotCardPips[1],
                      }}
                      cell={layout.dotCard.cell}
                      gap={layout.dotCard.gap}
                      appHidden={appHidden}
                      onComplete={() => setActiveDismissForIndex(problemIndex)}
                    />
                  )}
                  {showSubMinuendOverlay && subMinuendValue !== null && (
                    <ScaffoldFlash
                      key={`sub-${problemIndex}`}
                      content={{
                        kind: 'sub-minuend',
                        minuend: subMinuendValue,
                      }}
                      cell={layout.dotCard.cell}
                      gap={layout.dotCard.gap}
                      appHidden={appHidden}
                      onComplete={() =>
                        setSubMinuendDismissForIndex(problemIndex)
                      }
                    />
                  )}
                </View>
              )}
            </View>

            <View
              testID="math-chips"
              accessibilityState={{ disabled: !chipGateOpen }}
              style={[
                styles.abs,
                styles.chips,
                {
                  left: chips.rect.x,
                  top: chips.rect.y,
                  width: chips.rect.width,
                  height: chips.rect.height,
                  gap: chips.gap,
                },
              ]}
            >
              {chipOrderWithClass.values.map((value) => {
                const isCorrect = value === currentProblem.correct
                return (
                  <AnswerChip
                    key={value}
                    value={value}
                    size={chips.size}
                    font={chips.font}
                    radius={chips.radius}
                    gateOpen={chipGateOpen}
                    resolved={problemState.resolved}
                    dimForGuided={guidedActive && !isCorrect}
                    glow={guidedActive && isCorrect}
                    shaking={shakingChip === value}
                    bursting={celebrating && isCorrect}
                    onTap={onChipTap}
                  />
                )
              })}
            </View>
          </>
        )}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  // Web: a soft pink glow at 50 % / 30 % over a cream gradient.
  background: {
    ...FILL,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundColor: colors.myCream,
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 30%, rgba(255, 224, 230, 0.55) 0%, rgba(255, 245, 240, 0) 60%), linear-gradient(180deg, #FFF5F0 0%, #FFF8F2 100%)',
  },
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  abs: { position: 'absolute' },
  problem: { alignItems: 'center', justifyContent: 'center' },
  equation: { flexDirection: 'row', alignItems: 'center' },
  equationText: { fontFamily: fonts.bold, color: colors.ink },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Web `.clay-ribbon`: a cream clay speech slab, no outline.
  clayRibbon: {
    position: 'absolute',
    borderWidth: 0,
    borderRadius: 32,
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 3px 0 #ffffff, 0 8px 0 #efcfb4, 0 14px 22px rgba(90, 45, 20, 0.16)',
  },
})
