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
 *
 * Native-only, the take-away picture (`design/native/take-away-picture.md`):
 * a subtraction on its own step `sub-to-10` / `sub-to-20` draws `TakeAwayRow`
 * in the counting row's place, the minuend's flowers in a ten-frame (a
 * double one on sub-to-20). The taken flowers lift on the read's "away" /
 * "minus" in P1–P3 of a forward session or an explore peek, at hint 3
 * everywhere else (reviews, replays, warm-up hearts), fast on a right tap
 * and at once on the given answer; hints 1–2 ripple them. A wrong tap that
 * cuts the read never lifts them (K9), and the minuend flash plays first.
 *
 * Native-only, Number Garden 1 and 8–11 (core's extended kinds; spec
 * `design/native/math-skip-counting-multiplication-native.md`): a number-
 * recognition problem shows `NumberStrip`, a skip-count problem `SkipTrack`,
 * both in place of the equation; a multiplication problem shows
 * `A × B = ?` over `GroupsRow`; a sharing problem (content wave 2 § 2)
 * shows `ShareStage`, a pile dealt onto plates with no equation, its P1–P3
 * dealing on their own 300 ms after the read (Emma `attentive-pointing`
 * during the deal, then `listening`); a hundreds problem (content wave 3
 * § 3) shows `PlaceValueStage`, trays of flats, rods and cubes that the
 * read builds on its word ticks (P6–P8: a number tag with its "+10" /
 * "+100" pill), the lead "Hundreds, tens and ones!" pulsing the trays.
 * Their chips come from `buildExtendedChipOrder` (a 3-digit numeral steps
 * its font down to fit, `chipNumeralFont`), their hint lines set
 * `hintStep` (arithmetic keeps `hintBeat`), and the subitising scaffolds
 * never run for them.
 * - Background: an advance due while the app is hidden waits for its
 *   return; the dot card's timers pause.
 *
 * Dropped (web-only): the WebKit audio-unlock gate, the Howler context
 * resume / iOS session unlock per tap, the first-tap-unlocks-audio branch
 * and the audioCtx probes. Native audio needs no gesture: the read-aloud
 * starts as soon as the session start settles.
 *
 * Native-only, same-day review and daily warm-up (spec
 * `design/native/review-mode-and-warmup-native.md`):
 * - **Review** (`review`): Emma's opener ("Your flower is sleeping. Let's
 *   play the ones you know!") plays where problem 1's read would start, over
 *   an empty stage; the problem and chips mount at its end and fade in
 *   (200 ms; at once with Reduce Motion), and problem 1's read starts 400 ms
 *   later. The track opens with a moon. Streaks still chime, but their +1
 *   grants are off.
 * - **Warm-up** (`warmupCount`): the first problems of the round are hearts
 *   on the track; "Remember this one?" plays before each one's read (400 ms
 *   gap), with the stage up. They earn +1 stardust when right, but never
 *   touch the score, the streak or the scored per-problem arrays; their
 *   first-tap results go to `warmupCorrect`.
 * - **Mixed steps** (`problemNodes`): each problem's chips, chip ceiling and
 *   multiplication tags follow its own step, the subitising scaffolds never
 *   run for review or warm-up problems, and the current problem's kind goes
 *   to App (`onProblemKindChange`) so the frame follows it.
 *
 * Native-only, the fast track and the Map peek (spec
 * `design/native/fast-track-native.md`):
 * - **First taps** (`firstTapCorrect` in the result): the 8 scored problems'
 *   first-tap correctness, for the secure-day rule (§ 3.2).
 * - **"You just knew that one!"** (§ 7): a warm-up heart right on the first
 *   tap within 5 s of the read's start gets the remark 300 ms after its
 *   correct line; the advance waits for it. Never on a scored problem, in a
 *   review or in a peek; the celebration itself is the same for every answer.
 * - **Peek** (`peek` = the step, § 6.3): 3 problems of a later step from
 *   the Map. The opener "Let's look at <name>!" plays over an empty stage
 *   (the review opener's behaviour); no stardust pill, no streak, no grant, no scaffold;
 *   after problem 3's answer (its correct line and the usual dwell), 400 ms
 *   → the closer "<Name> is for later. You will learn it!" → 400 ms →
 *   `onPeekEnd`. The back button cuts the line and
 *   calls `onPeekEnd` at once. Nothing is written: no stardust write, no
 *   `onSessionComplete`.
 * - **Replay** (`replay` with `peek`, `design/native/map-tap-to-play.md`
 *   § 3): a mastered step's 8 canon problems from the Map, under the same
 *   rules, opened by "Let's play <name> again!" and closed by "You know
 *   <name>!". Nothing is written either.
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
import {
  isHundredsProblem,
  type ExtendedMathProblem,
  type ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { GENTLE_RAMP_THROUGH } from '@marian/core/math/distractors'
import {
  pickStaticSessionPlan,
  type MathProblem,
  type MathSessionPlan,
} from '@marian/core/math/sessionPlans'
import {
  shouldShowSubitisingScaffold,
  shouldShowSubitisingSubScaffold,
} from '@marian/core/math/subitisingScaffold'
import { takeAwayTickIndex } from '@marian/core/math/takeAway'
import {
  SLOW_FACT_MIN_MEDIAN_LATENCY_MS,
  type SkillNode,
} from '@marian/core/progress'
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
  type ReactNode,
} from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  audioEngine,
  createSfx,
  KNEW_GAP_MS,
  leadLinesForRound,
  PEEK_CLOSE_GAP_MS,
  peekGuideLines,
  replayGuideLines,
  recordAudio,
  SESSION_GUIDE_GAP_MS,
  sessionGuideLine,
  sessionGuidePlayer,
  SFX_SOURCES,
  type SessionGuideLineId,
  type SessionGuidePlayer,
  type Sfx,
} from '../../audio'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import {
  chipNumeralFont,
  countingMetrics,
  groupsAreDrawn,
  groupsMetrics,
  numberStripMetrics,
  placeValueMetrics,
  shareMetrics,
  skipTrackMetrics,
  takeAwayMetrics,
  type ExtendedMathLayout,
  type MathLayout,
} from '../../layout/mathLayout'
import {
  appVisibility,
  useIsAppHidden,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { colors, FILL, fonts } from '../../theme'
import { AnswerChip } from './AnswerChip'
import { CountingRow } from './CountingRow'
import type { MathOfferedClass } from './extendedChipOrder'
import { GettingReady } from './GettingReady'
import { countSpokenFactor } from './extendedHints'
import { GroupsRow } from './GroupsRow'
import { MathHud } from './MathHud'
import { EquationGap, MissingGroup, type BudReveal } from './MissingNumber'
import { problemChips, type ProblemChips } from './problemChips'
import type {
  MathSessionResult,
  PlayMathUtteranceFn,
  PlayMathUtteranceOptions,
} from './mathTypes'
import { NumberStrip } from './NumberStrip'
import { PlaceValueStage } from './PlaceValueStage'
import { ScaffoldFlash } from './ScaffoldFlash'
import { ShareStage } from './ShareStage'
import { AUTO_DEAL_DELAY_MS, FILL_HOLD_MS } from './shareDeal'
import { createSilentMathPlayer, type SilentMathPlayer } from './silentPlayer'
import { SkipTrack } from './SkipTrack'
import {
  strongerLift,
  takeAwayPicture,
  type TakeAwayLift,
  type TakeAwayRippleScope,
} from './takeAwayPicture'
import { TakeAwayRow } from './TakeAwayRow'

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
/** Multiplication's sign (U+00D7; Fredoka has the glyph). Spec § 3. */
export const TIMES_GLYPH = '×'
/** A missing number's "?" token in the equation (it fills; § 1.4). */
const GAP = Symbol('gap')
/** Review spec § 5: the stage fades in over 200 ms after the opener. */
export const STAGE_FADE_MS = 200
/** The HUD's ease-out (MathHud `EASE_OUT`). */
const STAGE_EASE = Easing.bezier(0, 0, 0.58, 1)

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
  /** Math's frames; for the extended kinds, `extendedMathLayout` (the chip
   *  column and the ribbon cap). */
  layout: MathLayout &
    Partial<Pick<ExtendedMathLayout, 'chipsAxis' | 'ribbonLines'>>
  /** The session plan: the server's once it settled, else the static one. */
  plan?: MathSessionPlan | ExtendedMathSessionPlan
  /** The session audio's player; without it the captions walk silently. */
  playUtterance?: PlayMathUtteranceFn
  /**
   * `false` while the session start is in flight: the problem area shows
   * "getting ready", Emma listens, and problem 1 is not read yet.
   * `undefined` = not applicable (read at once).
   */
  audioReady?: boolean
  focusNode?: SkillNode
  /**
   * The focus node the server plan was made for (the session focus). On
   * `mult-3-4` the plates' tags and "+" wait for hint 2; every other
   * multiplication step shows them from the reveal (spec § 3).
   */
  planFocusNode?: SkillNode
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
  /**
   * A same-day review (review spec D1): the opener over an empty stage, the
   * moon, no streak +1 grants. Only once its plan has settled.
   */
  review?: boolean
  /** The first `warmupCount` problems of `plan` are the warm-up (0–2). */
  warmupCount?: number
  /**
   * Each problem's source step (review / warm-up); an entry left `null`
   * or `undefined` (and every entry without the prop) is `focusNode`.
   */
  problemNodes?: readonly (SkillNode | null | undefined)[]
  /** The current problem's kind, for App's frame (review spec § 3.4). */
  onProblemKindChange?: (kind: ExtendedMathProblem['kind']) => void
  /** Test seam: the opener / warm-up line player. Default: the app's. */
  sessionGuide?: SessionGuidePlayer
  /**
   * A Map peek on this step (fast-track spec § 6.3): the plan is 3 of its
   * problems; nothing is scored, granted or written. Fixed for the mount.
   */
  peek?: SkillNode
  /** The peek is over (after the closer, or the back button at once). */
  onPeekEnd?: () => void
  /**
   * With `peek`: a Map replay of this mastered step (map-tap-to-play § 3),
   * under the peek's rules for its 8 canon problems, with the replay's
   * opener "Let's play <name> again!" and closer "You know <name>!".
   * Fixed for the mount.
   */
  replay?: boolean
  /**
   * The focus step's intro lead line (content wave 1 § 6.1), before the
   * scored problem 1's read; `null` / unset = none. The session start
   * decides (a forward session on a step that is not mastered).
   */
  sessionIntro?: SessionGuideLineId | null
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

/** Every problem with its `kind`: a plain (static, arithmetic) plan's
 *  problems get `'arithmetic'`. */
function withKinds(
  plan: MathSessionPlan | ExtendedMathSessionPlan,
): ExtendedMathSessionPlan {
  const problems: readonly (MathProblem | ExtendedMathProblem)[] = plan.problems
  return {
    id: plan.id,
    label: plan.label,
    problems: problems.map(
      (p): ExtendedMathProblem =>
        'kind' in p ? p : { ...p, kind: 'arithmetic' },
    ),
  }
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
  planFocusNode,
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
  review = false,
  warmupCount = 0,
  problemNodes,
  onProblemKindChange,
  sessionGuide,
  peek,
  onPeekEnd,
  replay = false,
  sessionIntro = null,
}: MathProps) {
  const appHidden = useIsAppHidden(visibility)
  const reducedMotion = useReducedMotion()

  // Same as the web: the plan follows `planProp` (the server plan swaps in
  // for the static one while the problem area still shows "getting ready").
  const plan = useMemo<ExtendedMathSessionPlan>(
    () => withKinds(planProp ?? pickStaticSessionPlan(now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: `now` only seeds the fallback
    [planProp],
  )

  // Fixed at mount: the effects, the silent player, the line canceller.
  const [sfx] = useState<MathSfx>(() => sfxProp ?? createMathSfx())
  const [silent] = useState(() => silentPlayer ?? createSilentMathPlayer())
  const [cancelEmmaLine] = useState(() => cancelLine)
  const [guide] = useState(() => sessionGuide ?? sessionGuidePlayer())
  const playRef = useRef<PlayMathUtteranceFn>(silent.play)
  useLayoutEffect(() => {
    playRef.current = playUtterance ?? silent.play
  })
  const onSessionCompleteRef = useRef(onSessionComplete)
  const onPoseChangeRef = useRef(onPoseChange)
  const onProblemKindChangeRef = useRef(onProblemKindChange)
  const onPeekEndRef = useRef(onPeekEnd)
  useLayoutEffect(() => {
    onSessionCompleteRef.current = onSessionComplete
    onPoseChangeRef.current = onPoseChange
    onProblemKindChangeRef.current = onProblemKindChange
    onPeekEndRef.current = onPeekEnd
  })
  /** A peek is fixed for the mount (App mounts a fresh screen per peek). */
  const [peekNode] = useState(peek)
  const isPeek = peekNode !== undefined
  /** The step's opener and closer (§ 8); none for a step without lines. */
  const [peekLines] = useState(() =>
    peekNode === undefined
      ? null
      : replay
        ? replayGuideLines(peekNode)
        : peekGuideLines(peekNode),
  )
  /** `onPeekEnd` fires once. */
  const peekEndedRef = useRef(false)
  // The round's shape, read by the tap handlers (review spec § 7.4).
  const warmups = Math.min(Math.max(0, warmupCount), plan.problems.length)
  const warmupsRef = useRef(warmups)
  const reviewRef = useRef(review)
  useLayoutEffect(() => {
    warmupsRef.current = warmups
    reviewRef.current = review
  })
  /**
   * The line over the empty stage before problem 1's read: a review's
   * opener, or a peek's (the same behaviour: review spec § 3.3, fast-track
   * spec § 6.3). `null` for every other session.
   */
  const opener: SessionGuideLineId | null = review
    ? 'guide.session.review'
    : (peekLines?.open ?? null)
  /** The opener has played (the stage mounts at its end). */
  const [openerDone, setOpenerDone] = useState(false)
  const openerStartedRef = useRef(false)
  /**
   * The line before each problem's read (content wave 1 § 6.1): the
   * opener, a warm-up heart's line, the step intro, the hiding line; at
   * most one per problem. Missing-number problems join with their kind.
   */
  const leads = useMemo(
    () =>
      leadLinesForRound(plan.problems.length, {
        opener,
        warmupCount: warmups,
        intro: sessionIntro,
        hiding: plan.problems.map((p) => p.kind === 'missing-addend'),
        peek: isPeek,
      }),
    [plan, opener, warmups, sessionIntro, isPeek],
  )

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
  const perProblemDistractorClassRef = useRef<(MathOfferedClass | null)[]>(
    plan.problems.map(() => null),
  )
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
  /** The extended kinds' hint line (1 / 2 / 3), kept until the problem ends
   *  (their hint visuals stay); `null` before hint 1. */
  const [hintStep, setHintStep] = useState<1 | 2 | 3 | null>(null)
  /** Hint 2 has ended: every plate not lit by a word yet lights. */
  const [hint2Done, setHint2Done] = useState(false)
  /** Plates hint 2's words have lit so far. Only goes up within a problem:
   *  a line that takes the ribbon mid-hint (her answer's "Yes!", a third
   *  wrong's re-prompt) must not unlight them (spec § 3: after hint 2 the
   *  tags stay). */
  const [hint2Lit, setHint2Lit] = useState(0)
  /** A missing number's hidden part: shown from hint 3 (content wave 1
   *  § 1.5); stays until the problem ends. The guided answer shows it too. */
  const [budReveal, setBudReveal] = useState<BudReveal>('hidden')
  /** Sharing (content wave 2 § 2.4): the read's words revealed so far (its
   *  ticks pulse the total tag and ripple the plates), and P1–P3's own
   *  deal, raised 300 ms after the read ends. Both reset per problem. */
  const [readRevealed, setReadRevealed] = useState(0)
  const [autoDeal, setAutoDeal] = useState(false)
  /** Hundreds (content wave 3 § 3.4): the step lead's words revealed so
   *  far; its ticks pulse the trays. Reset per problem. */
  const [leadRevealed, setLeadRevealed] = useState(0)
  /** The take-away picture (`take-away-picture.md` § 3): what lifted its
   *  taken flowers besides a P1–P3 read (hint 3, a right tap, the given
   *  answer), and the hint lines' ripples. Reset per problem. */
  const [takeAwayLift, setTakeAwayLift] = useState<TakeAwayLift | null>(null)
  const [takeAwayRipple, setTakeAwayRipple] = useState(0)
  const [takeAwayRippleScope, setTakeAwayRippleScope] =
    useState<TakeAwayRippleScope | null>(null)
  /** A wrong tap cut the read: its later ticks lift nothing (K9). */
  const takeAwayReadCutRef = useRef(false)
  /** The taken flowers have lifted (or are due to), for hint 3. */
  const takeAwayLiftedRef = useRef(false)
  const [shakingChip, setShakingChip] = useState<number | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [captionVisible, setCaptionVisible] = useState(false)
  const [captionGeneration, setCaptionGeneration] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const [streakFadingOut, setStreakFadingOut] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)

  // The chips follow each problem's own step (review spec § 7.4); see
  // `problemChips.ts`.
  const chipOrderWithClass = useMemo<ProblemChips>(
    () => problemChips(plan.problems, problemIndex, focusNode, problemNodes),
    [plan, problemIndex, problemNodes, focusNode],
  )
  useEffect(() => {
    perProblemDistractorClassRef.current[problemIndex] =
      chipOrderWithClass.offeredClass
  }, [problemIndex, chipOrderWithClass.offeredClass])
  /** Problem i's take-away picture: a subtraction on its own step, sub-to-10
   *  or sub-to-20 (`take-away-picture.md` K1); else `null`. */
  const takeAwayOf = useCallback(
    (i: number) =>
      takeAwayPicture(plan.problems[i], problemNodes?.[i] ?? focusNode),
    [plan, problemNodes, focusNode],
  )

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
  /** The gap between a guide line and the read. */
  const leadInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The gap before "You just knew that one!" (§ 7). */
  const knewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A peek's gaps around its closer (§ 6.3). */
  const closerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Sharing: the 300 ms before P1–P3's deal, and the deal's end (Emma
   *  goes from attentive-pointing back to listening). */
  const autoDealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dealPoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Sharing's right answer (Kyle's call 4 on #587): the advance also waits
   *  until every plate tag shows the share, plus a 400 ms hold. `true` from
   *  the tap until that timer fires. */
  const shareHoldRef = useRef(false)
  const shareHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The current answer's advance check, for the share hold's timer. */
  const tryAdvanceRef = useRef<(() => void) | null>(null)
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
      leadInTimerRef,
      knewTimerRef,
      closerTimerRef,
      autoDealTimerRef,
      dealPoseTimerRef,
      shareHoldTimerRef,
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
      guide.cancelActive()
      sfx.sparkle.unload()
      sfx.poof.unload()
      sfx.plink.unload()
      sfx.chime.unload()
      // A peek writes nothing (fast-track spec § 6.5).
      if (!isPeek) writeStardust(stardustTotalRef.current, storage, now)
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
    async (
      text: string,
      isReadAloud = false,
      /** Called with the count of words revealed so far, per word tick. */
      onWords?: (revealed: number) => void,
      /** Another player for this line (the session guide). */
      play?: PlayMathUtteranceFn,
    ): Promise<void> => {
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
          onWords?.(i + 1)
        },
      }
      const myLine = ++lineGenerationRef.current
      linesInFlightRef.current += 1
      try {
        await (play ?? playRef.current)(text, opts)
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
    perProblemDistractorClassRef.current = resize<MathOfferedClass | null>(
      perProblemDistractorClassRef.current,
      null,
    )
  }, [planLength])

  /** A guide line through the ribbon (never rejects); `onWords` gets its
   *  word ticks. */
  const speakGuide = useCallback(
    (id: SessionGuideLineId, onWords?: (revealed: number) => void) =>
      speak(sessionGuideLine(id).text, false, onWords, (_text, opts) =>
        guide.playLine(id, opts),
      ),
    [speak, guide],
  )

  useEffect(() => {
    if (guidedActive) return // the guided line owns the audio
    if (audioReady === false) return // session start in flight
    const problem = plan.problems[problemIndex]
    const myProblemIndex = problemIndex
    const live = () =>
      !unmountedRef.current && problemIndexRef.current === myProblemIndex
    // Review spec § 4: the opener where problem 1's read would start; the
    // warm-up line before each warm-up read; content wave 1 § 6.1: the step
    // intro and the hiding line. Line end → 400 ms → the read.
    const planned = leads[myProblemIndex] ?? null
    const lead: SessionGuideLineId | null =
      planned !== null && planned === opener && openerStartedRef.current
        ? null
        : planned
    microtask(() => {
      if (!live()) return
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      setPose('listening')
      void (async () => {
        if (lead !== null) {
          if (lead === opener) openerStartedRef.current = true
          // Hundreds' lead pulses the trays on its word ticks (§ 3.4).
          await speakGuide(
            lead,
            lead === sessionIntro && isHundredsProblem(problem)
              ? setLeadRevealed
              : undefined,
          )
          if (!live()) return
          if (lead === opener) setOpenerDone(true)
          await new Promise<void>((resolve) => {
            leadInTimerRef.current = setTimeout(() => {
              leadInTimerRef.current = null
              resolve()
            }, SESSION_GUIDE_GAP_MS)
          })
          if (!live()) return
        }
        // The watchdog counts from the read, never from a guide line: no
        // chip opens during "Remember this one?" or the opener.
        if (!chipGateOpenRef.current && chipGateWatchdogRef.current === null) {
          chipGateWatchdogRef.current = setTimeout(() => {
            chipGateWatchdogRef.current = null
            if (!live()) return
            openChipGate('fallback')
          }, CHIP_GATE_FALLBACK_MS)
        }
        // Sharing's and hundreds' reads drive their stages (the total tag
        // and the plates; the trays' build, the number tag and its pill),
        // and a take-away read its lift, until a wrong tap cuts it (K9).
        const drivesStage =
          problem.kind === 'divide' || isHundredsProblem(problem)
        await speak(
          problem.utterances.read,
          true,
          drivesStage
            ? setReadRevealed
            : takeAwayOf(myProblemIndex) !== null
              ? (revealed) => {
                  if (!takeAwayReadCutRef.current) setReadRevealed(revealed)
                }
              : undefined,
        )
        if (!live()) return
        // A read that ended without its ticks still builds the trays.
        if (isHundredsProblem(problem)) {
          const words = problem.utterances.read.split(/\s+/).filter(Boolean)
          setReadRevealed((r) => Math.max(r, words.length))
        }
        readAloudPlayedRef.current = true
        setReadAloudPlayed(true)
        setPose((current) => (current === 'listening' ? 'idle' : current))
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: re-run on problem / readiness only
  }, [problemIndex, audioReady])

  // The current problem's kind, for App's frame (review spec § 3.4).
  const currentKind = plan.problems[problemIndex].kind
  useEffect(() => {
    onProblemKindChangeRef.current?.(currentKind)
  }, [currentKind])

  // Sharing (content wave 2 § 2.4): P1–P3 deal on their own 300 ms after
  // the read ends. The rule is the problem's index ≤ 3, the chip tier's, so
  // a review block at P2 deals too. Every flower then flies on the UI thread.
  useEffect(() => {
    const p = plan.problems[problemIndex]
    if (
      !readAloudPlayed ||
      p === undefined ||
      p.kind !== 'divide' ||
      p.index > GENTLE_RAMP_THROUGH
    ) {
      return
    }
    autoDealTimerRef.current = setTimeout(() => {
      autoDealTimerRef.current = null
      if (unmountedRef.current) return
      setAutoDeal(true)
    }, AUTO_DEAL_DELAY_MS)
    return () => {
      if (autoDealTimerRef.current !== null) {
        clearTimeout(autoDealTimerRef.current)
        autoDealTimerRef.current = null
      }
    }
  }, [readAloudPlayed, problemIndex, plan])

  /** Emma is attentive-pointing while P1–P3's own deal runs, then listening
   *  (§ 2.4). An answer, a hint or the given answer owns her pose instead. */
  const onShareAutoDeal = useCallback((ms: number) => {
    if (
      resolvedRef.current ||
      hintPlayedRef.current ||
      guidedPlayedRef.current
    ) {
      return
    }
    setPose((c) =>
      c === 'idle' || c === 'listening' ? 'attentive-pointing' : c,
    )
    if (dealPoseTimerRef.current !== null) {
      clearTimeout(dealPoseTimerRef.current)
    }
    dealPoseTimerRef.current = setTimeout(() => {
      dealPoseTimerRef.current = null
      if (
        unmountedRef.current ||
        resolvedRef.current ||
        hintPlayedRef.current ||
        guidedPlayedRef.current
      ) {
        return
      }
      setPose((c) => (c === 'attentive-pointing' ? 'listening' : c))
    }, ms)
  }, [])

  /** Sharing's right answer (call 4): the tags fill `ms` from now; Math
   *  moves on no sooner than that plus a 400 ms hold of the full picture.
   *  The 4 s advance ceiling still applies. */
  const onShareFillScheduled = useCallback((ms: number) => {
    if (!shareHoldRef.current) return
    if (shareHoldTimerRef.current !== null) {
      clearTimeout(shareHoldTimerRef.current)
    }
    shareHoldTimerRef.current = setTimeout(
      () => {
        shareHoldTimerRef.current = null
        if (unmountedRef.current) return
        shareHoldRef.current = false
        tryAdvanceRef.current?.()
      },
      Math.ceil(ms + FILL_HOLD_MS),
    )
  }, [])

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
      setHintStep(null)
      setHint2Done(false)
      setHint2Lit(0)
      setBudReveal('hidden')
      setReadRevealed(0)
      setLeadRevealed(0)
      setTakeAwayLift(null)
      setTakeAwayRipple(0)
      setTakeAwayRippleScope(null)
      takeAwayReadCutRef.current = false
      setAutoDeal(false)
      shareHoldRef.current = false
      tryAdvanceRef.current = null
      for (const ref of [
        autoDealTimerRef,
        dealPoseTimerRef,
        shareHoldTimerRef,
      ]) {
        if (ref.current !== null) {
          clearTimeout(ref.current)
          ref.current = null
        }
      }
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
    } else if (isPeek) {
      // Peek § 6.3: 400 ms → the closer → 400 ms → back to the Map. No
      // Session End, no result, no write.
      setPose('listening')
      const closer = peekLines?.close
      closerTimerRef.current = setTimeout(() => {
        closerTimerRef.current = null
        if (unmountedRef.current) return
        const said =
          closer === undefined ? Promise.resolve() : speakGuide(closer)
        void said.then(() => {
          if (unmountedRef.current) return
          setPose('idle')
          closerTimerRef.current = setTimeout(() => {
            closerTimerRef.current = null
            if (unmountedRef.current || peekEndedRef.current) return
            peekEndedRef.current = true
            onPeekEndRef.current?.()
          }, PEEK_CLOSE_GAP_MS)
        })
      }, PEEK_CLOSE_GAP_MS)
    } else {
      const finalState = writeStardust(stardustTotalRef.current, storage, now)
      setStardust(finalState)
      // The per-problem arrays cover the round; the result's cover the 8
      // scored problems, and the warm-up's first taps go apart (§ 7.4).
      const w = warmupsRef.current
      onSessionCompleteRef.current?.({
        totalCorrect: totalCorrectRef.current,
        totalStardust: finalState.total,
        finalStreak: streakRef.current,
        earnedThisSession: earnedThisSessionRef.current,
        perProblemCorrect: perProblemCorrectRef.current.slice(w),
        latencyMs: latencyMsByProblemRef.current.slice(w),
        perProblemAnswerValue: perProblemAnswerValueRef.current.slice(w),
        perProblemDistractorClass:
          perProblemDistractorClassRef.current.slice(w),
        subitisingScaffoldRendered: subitisingScaffoldRenderedRef.current,
        subitisingScaffoldSubRendered: subitisingScaffoldSubRenderedRef.current,
        warmupCorrect: perProblemCorrectRef.current.slice(0, w),
        // Already first-tap (set once per problem in `onChipTap`).
        firstTapCorrect: perProblemCorrectRef.current.slice(w),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` seeds the write only
  }, [
    problemIndex,
    plan.problems.length,
    storage,
    isPeek,
    peekLines,
    speakGuide,
  ])

  /**
   * Peek § 6.3: the back button, at any time. Emma's line stops, and
   * `onPeekEnd` fires at once (once).
   */
  const endPeekNow = useCallback(() => {
    if (peekEndedRef.current) return
    peekEndedRef.current = true
    clearAllTimers()
    silent.cancel()
    cancelEmmaLine()
    guide.cancelActive()
    onPeekEndRef.current?.()
  }, [clearAllTimers, silent, cancelEmmaLine, guide])

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
      // A peek grants nothing (fast-track spec § 6.3, E2).
      if (isPeek) return
      stardustTotalRef.current += amount
      setStardust(writeStardust(stardustTotalRef.current, storage, now))
      earnedThisSessionRef.current += amount
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` stamps the write only
    [storage, isPeek],
  )

  // ── The hint ─────────────────────────────────────────────────────────

  const runHintSequence = useCallback(
    async (problem: ExtendedMathProblem) => {
      const myIndex = problemIndex
      // Native-only: a third wrong answer (the guided answer) ends the
      // hint. On the web the remaining hint beats go on and cancel "This
      // one is …" (seen on the iOS simulator with QA autoplay; see the PR).
      const stillLive = () =>
        !unmountedRef.current &&
        problemIndexRef.current === myIndex &&
        !guidedPlayedRef.current
      const returnToIdle = () => {
        if (!stillLive()) return
        setHintBeat(null)
        setTakeAwayRippleScope(null)
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
      }
      if (!stillLive()) return
      setPose('attentive-pointing')
      // The extended kinds' visuals follow `hintStep`; arithmetic's flower
      // groups follow `hintBeat` (web W12-02), and so do a missing number's
      // (group A ripples on hints 1–2; hint 3 shows the buds).
      const missing = problem.kind === 'missing-addend'
      const extended = problem.kind !== 'arithmetic' && !missing
      // The take-away picture (§ 3): hints 1–2 ripple every flower at the
      // line's start; hint 3 lifts on its "away", or ripples what is left.
      const takeAway = takeAwayOf(myIndex)
      const rippleTakeAway = (scope: TakeAwayRippleScope) => {
        setTakeAwayRippleScope(scope)
        setTakeAwayRipple((n) => n + 1)
      }
      const triple = resolveHintTriple(problem.utterances)
      if (triple === null) {
        const legacy = problem.utterances.hint
        if (extended) setHintStep(1)
        if (typeof legacy === 'string') await speak(legacy)
        returnToIdle()
        return
      }
      if (extended) setHintStep(1)
      else setHintBeat('group-a')
      if (takeAway !== null) rippleTakeAway('all')
      await speak(triple.hint1)
      if (!stillLive()) return
      if (extended) setHintStep(2)
      if (takeAway !== null) rippleTakeAway('all')
      // Multiplication: Emma's k-th spoken group size lights plate k (the
      // same word ticks that drive the ribbon, so the silent walk lights
      // them too). The count only goes up.
      const lightPlates =
        problem.kind === 'multiply'
          ? (revealed: number) =>
              setHint2Lit((lit) =>
                Math.max(
                  lit,
                  countSpokenFactor(
                    triple.hint2,
                    revealed,
                    problem.factorA,
                    problem.factorB,
                  ),
                ),
              )
          : undefined
      await speak(triple.hint2, false, lightPlates)
      if (!stillLive()) return
      if (extended) {
        setHint2Done(true)
        setHintStep(3)
      } else if (missing) {
        setHintBeat(null)
        setBudReveal((r) => (r === 'hidden' ? 'hint' : r))
      } else {
        setHintBeat('group-b')
      }
      let liftOnWords: ((revealed: number) => void) | undefined
      if (takeAway !== null) {
        if (takeAwayLiftedRef.current || takeAway.slots.taken.length === 0) {
          rippleTakeAway('left')
        } else {
          setTakeAwayRippleScope(null)
          const tick = takeAwayTickIndex(triple.hint3)
          liftOnWords = (revealed) => {
            if (revealed > tick)
              setTakeAwayLift((l) => strongerLift(l, 'normal'))
          }
        }
      }
      await speak(triple.hint3, false, liftOnWords)
      returnToIdle()
    },
    [speak, problemIndex, takeAwayOf],
  )

  // ── Taps ─────────────────────────────────────────────────────────────

  const handleWrongTap = useCallback(
    (chipValue: number, problem: ExtendedMathProblem) => {
      sfx.poof.play()
      setShakingChip(chipValue)
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setShakingChip(null)
        shakeTimerRef.current = null
      }, WRONG_SHAKE_MS)

      setPose('puzzled-tilt')
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)
      // A wrong tap never moves the take-away picture (K9).
      takeAwayReadCutRef.current = true

      // A warm-up problem never touches the streak (review spec § 6); a
      // peek has none.
      if (!isPeek && problemIndexRef.current >= warmupsRef.current) {
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
          setHintBeat(null) // a hint it interrupted stops pulsing
          setTakeAwayRippleScope(null)
          // The taken flowers land pale at once (§ 3).
          setTakeAwayLift((l) => strongerLift(l, 'instant'))
          // A missing number's buds show if hint 3 didn't (§ 1.5).
          setBudReveal((r) => (r === 'hidden' ? 'guided' : r))
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
    [sfx, speak, streak, runHintSequence, isPeek],
  )

  const handleCorrectTap = useCallback(
    (problem: ExtendedMathProblem) => {
      sfx.sparkle.play()
      sfx.plink.play()
      setPose('celebration')
      setCelebrating(true)
      // The taken flowers not lifted yet lift fast (§ 3).
      setTakeAwayLift((l) => strongerLift(l, 'fast'))
      resolvedRef.current = true
      setProblemState((prev) => ({ ...prev, resolved: true }))
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }

      const isCleanWin = wrongCountRef.current === 0 && !guidedPlayedRef.current
      // Review spec § 6: a warm-up answer earns its +1 and nothing else; a
      // review's streak chimes but grants no +1.
      const warm = problemIndexRef.current < warmupsRef.current
      // § 7: a warm-up heart right on the first tap within 5 s of the
      // read's start (a measured latency: -1 is touch noise or unmeasured).
      const latency = latencyMsByProblemRef.current[problemIndexRef.current]
      const knew =
        warm &&
        isCleanWin &&
        !isPeek &&
        !reviewRef.current &&
        latency !== undefined &&
        latency >= 0 &&
        latency < SLOW_FACT_MIN_MEDIAN_LATENCY_MS
      if (!guidedPlayedRef.current) {
        grantStardust(1)
        if (!warm) totalCorrectRef.current += 1
        // A peek keeps no streak (fast-track spec § 6.3).
        if (isCleanWin && !warm && !isPeek) {
          streakRef.current = streakRef.current + 1
          setStreak(streakRef.current)
          if (
            (STREAK_BONUS_THRESHOLDS as readonly number[]).includes(
              streakRef.current,
            )
          ) {
            if (!reviewRef.current) grantStardust(1)
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
      // Sharing: also hold until the tags have filled (`onShareFillScheduled`).
      shareHoldRef.current = problem.kind === 'divide'

      const tryAdvance = () => {
        if (advanceFiredRef.current) return
        if (!minDwellElapsedRef.current || !correctSpeakResolvedRef.current) {
          return
        }
        if (shareHoldRef.current) return
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
      tryAdvanceRef.current = tryAdvance

      /** The 4 s ceiling: the advance fires even if a line never ends. */
      const armCeiling = () => {
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
      }

      const myIndex = problemIndexRef.current
      void speak(problem.utterances.correct).then(async () => {
        if (unmountedRef.current) return
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
        if (knew && !advanceFiredRef.current) {
          // § 7: line end → 300 ms → "You just knew that one!"; the advance
          // waits for it (the ceiling counts from the remark's gap).
          armCeiling()
          await new Promise<void>((resolve) => {
            knewTimerRef.current = setTimeout(() => {
              knewTimerRef.current = null
              resolve()
            }, KNEW_GAP_MS)
          })
          if (unmountedRef.current || problemIndexRef.current !== myIndex)
            return
          if (advanceFiredRef.current) return
          await speakGuide('guide.session.knew')
          if (unmountedRef.current || problemIndexRef.current !== myIndex)
            return
        }
        correctSpeakResolvedRef.current = true
        tryAdvance()
      })

      if (advanceTimerRef.current !== null)
        clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        minDwellElapsedRef.current = true
        tryAdvance()
      }, ADVANCE_AFTER_CORRECT_MS)

      armCeiling()
    },
    [advanceToNext, grantStardust, sfx, speak, speakGuide, visibility, isPeek],
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
    // The scored problems' first two, as before; warm-ups answered right.
    const scored = problemIndex - warmups
    const wrongsWanted = scored === 0 ? 3 : scored === 1 ? 1 : 0
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
    warmups,
  ])

  // ── Scaffolds (core's gates, as on the web) ──────────────────────────

  const currentProblem = plan.problems[problemIndex]
  // The arithmetic problem on screen; `null` for the extended kinds, which
  // never run the subitising scaffolds (spec § 1).
  const arith = currentProblem.kind === 'arithmetic' ? currentProblem : null
  // A missing number (content wave 1 § 1): `A + ? = T` over group A and the
  // hidden part; never a dot card (it would show both parts).
  const missing =
    currentProblem.kind === 'missing-addend' ? currentProblem : null
  const showStreak = streak >= 2 || streakFadingOut
  // The subitising scaffolds never run for review, warm-up or peek problems.
  const scaffoldsAllowed = !review && !isPeek && problemIndex >= warmups

  const useScaffoldGate =
    focusNode !== undefined && subitisingScaffoldActive !== undefined
  const dotCardInScope =
    scaffoldsAllowed &&
    arith !== null &&
    (useScaffoldGate
      ? shouldShowSubitisingScaffold(focusNode, arith, subitisingScaffoldActive)
      : shouldShowDotCard(arith))
  const dotCardPips =
    dotCardInScope && arith !== null ? pipsFromProblem(arith) : null
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
  const subMinuendInScope =
    scaffoldsAllowed && arith !== null && useSubScaffoldGate
      ? shouldShowSubitisingSubScaffold(
          focusNode,
          arith,
          subitisingSubScaffoldActive,
        )
      : false
  const subMinuendValue =
    subMinuendInScope && arith !== null ? subMinuendFromProblem(arith) : null
  const subMinuendDismissed =
    !subMinuendInScope || subMinuendDismissForIndex === problemIndex
  const showSubMinuendOverlay =
    subMinuendInScope && !subMinuendDismissed && subMinuendValue !== null

  useLayoutEffect(() => {
    if (useSubScaffoldGate && showSubMinuendOverlay) {
      subitisingScaffoldSubRenderedRef.current = true
    }
  }, [useSubScaffoldGate, showSubMinuendOverlay])

  // The take-away picture (`take-away-picture.md` K1, K6): P1–P3 of a
  // forward session or an explore peek (Dave, 2026-10-19) lift on the
  // read's "away" / "minus"; hint 3, a right tap and the given answer lift
  // everywhere (reviews, replays and warm-up hearts wait for hint 3).
  const takeAway = takeAwayOf(problemIndex)
  const takeAwayReadLift =
    takeAway !== null &&
    arith !== null &&
    (scaffoldsAllowed || (isPeek && !replay)) &&
    arith.index <= GENTLE_RAMP_THROUGH &&
    readRevealed > takeAwayTickIndex(arith.utterances.read)
  const takeAwayLiftNow = strongerLift(
    takeAwayReadLift ? 'normal' : null,
    takeAwayLift,
  )
  useLayoutEffect(() => {
    takeAwayLiftedRef.current = takeAwayLiftNow !== null
  })

  // ── Render ───────────────────────────────────────────────────────────

  const { problem: area, chips, ribbon, ribbonPadding } = layout
  // A review's or a peek's stage waits for its opener (review spec § 3.3,
  // fast-track spec § 6.3).
  const stageShown = opener === null || openerDone
  const counting =
    arith !== null && arith.op === '+'
      ? countingMetrics(layout, arith.addendA, arith.addendB, area.width)
      : missing !== null
        ? countingMetrics(layout, missing.addendA, missing.correct, area.width)
        : null
  // Phone: the counting slot is always reserved, so the equation never
  // moves between problems (mixed-op and two-digit tiers included).
  // Tablet (web): the row is there with counters or the minuend cell.
  const takeAwaySize =
    takeAway === null
      ? null
      : takeAwayMetrics(layout, takeAway.step, area.width)
  const visualHeight =
    layout.visualSlot ??
    (counting !== null
      ? counting.height
      : takeAwaySize !== null
        ? Math.max(
            takeAwaySize.height,
            subMinuendInScope ? layout.dotCard.cell : 0,
          )
        : subMinuendInScope
          ? layout.dotCard.cell
          : 0)
  const showVisualRow =
    (arith !== null || missing !== null) &&
    (layout.visualSlot !== null ||
      counting !== null ||
      subMinuendInScope ||
      takeAwaySize !== null)

  // The extended kinds' visuals, sized once per plan (spec decision 10).
  const skipMetrics = useMemo(
    () =>
      skipTrackMetrics(
        layout,
        plan.problems.flatMap((p) => (p.kind === 'skip-count' ? [p] : [])),
      ),
    [layout, plan],
  )
  const groups = useMemo(
    () =>
      groupsMetrics(
        layout,
        plan.problems.flatMap((p) => (p.kind === 'multiply' ? [p] : [])),
      ),
    [layout, plan],
  )
  const share = useMemo(
    () =>
      shareMetrics(
        layout,
        plan.problems.flatMap((p) => (p.kind === 'divide' ? [p] : [])),
      ),
    [layout, plan],
  )
  const hundreds = useMemo(
    () => placeValueMetrics(layout, plan.problems.filter(isHundredsProblem)),
    [layout, plan],
  )
  // A 3-digit numeral steps the chips' font down to fit (§ 3.3).
  const chipFont = useMemo(
    () => chipNumeralFont(chipOrderWithClass.values, chips.size, chips.font),
    [chipOrderWithClass.values, chips.size, chips.font],
  )
  const strip = numberStripMetrics(layout)
  const multiply = currentProblem.kind === 'multiply' ? currentProblem : null
  const groupsDrawn =
    multiply !== null && groupsAreDrawn(multiply.factorA, multiply.factorB)
  const litCount =
    multiply === null ? 0 : hint2Done ? multiply.factorB : hint2Lit
  useEffect(() => {
    if (multiply === null || groupsDrawn) return
    recordAudio({
      kind: 'note',
      label: 'math',
      detail: `no groups for ${multiply.factorA} × ${multiply.factorB} (drawn for 1–10 × 1–5)`,
    })
  }, [multiply, groupsDrawn])
  // The equation's tokens; `GAP` is a missing number's "?" (§ 1.4), the
  // only one that fills. Every other equation ends "= ?" as before.
  const equation: readonly (string | typeof GAP)[] | null =
    multiply !== null
      ? [
          String(multiply.factorA),
          TIMES_GLYPH,
          String(multiply.factorB),
          '=',
          '?',
        ]
      : arith !== null
        ? [
            String(arith.addendA),
            arith.op === '-' ? '−' : '+',
            String(arith.addendB),
            '=',
            '?',
          ]
        : missing !== null
          ? [String(missing.addendA), '+', GAP, '=', String(missing.total)]
          : null

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
          onBack={isPeek ? endPeekNow : onRequestExit}
          review={review}
          warmupCount={warmups}
          peek={isPeek}
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
            maxLines={layout.ribbonLines}
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
        ) : !stageShown ? null : (
          <StageLayer
            fade={opener === null ? null : isPeek ? 'peek' : 'review'}
            reducedMotion={reducedMotion}
          >
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
              {currentProblem.kind === 'recognize' && (
                <NumberStrip
                  key={`strip-${problemIndex}`}
                  target={currentProblem.correct}
                  metrics={strip}
                  label={currentProblem.utterances.read}
                  hintStep={hintStep}
                  guided={guidedActive}
                  answered={problemState.resolved}
                />
              )}
              {currentProblem.kind === 'skip-count' && (
                <SkipTrack
                  key={`skip-${problemIndex}`}
                  problem={currentProblem}
                  metrics={skipMetrics}
                  hintStep={hintStep}
                  guided={guidedActive}
                  answered={problemState.resolved}
                />
              )}
              {currentProblem.kind === 'divide' && (
                <ShareStage
                  key={`share-${problemIndex}`}
                  problem={currentProblem}
                  metrics={share}
                  width={area.width}
                  readRevealed={readRevealed}
                  autoDeal={autoDeal}
                  hintStep={hintStep}
                  guided={guidedActive}
                  answered={problemState.resolved}
                  onAutoDeal={onShareAutoDeal}
                  onFillScheduled={onShareFillScheduled}
                />
              )}
              {isHundredsProblem(currentProblem) && (
                <PlaceValueStage
                  key={`hundreds-${problemIndex}`}
                  problem={currentProblem}
                  metrics={hundreds}
                  width={area.width}
                  readRevealed={readRevealed}
                  leadRevealed={leadRevealed}
                  hintStep={hintStep}
                  guided={guidedActive}
                  answered={problemState.resolved}
                />
              )}
              {equation !== null && (
                <View
                  testID="math-symbolic"
                  accessible
                  accessibilityLabel={currentProblem.utterances.read}
                  style={[styles.equation, { gap: layout.equationGap }]}
                >
                  {equation.map((token, i) =>
                    token === GAP && missing !== null ? (
                      <EquationGap
                        key={`gap-${problemIndex}`}
                        answer={missing.correct}
                        answered={problemState.resolved}
                        guided={guidedActive}
                        font={layout.equationFont}
                        lineHeight={layout.equationLineHeight}
                      />
                    ) : (
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
                        {token as string}
                      </Text>
                    ),
                  )}
                </View>
              )}

              {multiply !== null && groups.slot > 0 && (
                <View style={[styles.visual, { height: groups.slot }]}>
                  {groupsDrawn && (
                    <GroupsRow
                      key={`groups-${problemIndex}`}
                      factorA={multiply.factorA}
                      factorB={multiply.factorB}
                      metrics={groups}
                      width={area.width}
                      tagsFromReveal={
                        (problemNodes?.[problemIndex] ?? planFocusNode) !==
                        'mult-3-4'
                      }
                      hintStep={hintStep}
                      litCount={litCount}
                      guided={guidedActive}
                    />
                  )}
                </View>
              )}

              {showVisualRow && (
                <View
                  testID="math-visual-row"
                  style={[styles.visual, { height: visualHeight }]}
                >
                  {counting !== null && arith !== null && (
                    <CountingRow
                      addendA={arith.addendA}
                      addendB={arith.addendB}
                      metrics={counting}
                      visible={flowersVisible}
                      hintBeat={hintBeat}
                    />
                  )}
                  {counting !== null && missing !== null && (
                    <CountingRow
                      key={`missing-${problemIndex}`}
                      addendA={missing.addendA}
                      addendB={missing.correct}
                      metrics={counting}
                      visible
                      hintBeat={hintBeat}
                      groupB={
                        <MissingGroup
                          count={missing.correct}
                          metrics={counting}
                          reveal={budReveal}
                          answered={problemState.resolved}
                        />
                      }
                    />
                  )}
                  {takeAway !== null && takeAwaySize !== null && (
                    <TakeAwayRow
                      key={`take-away-${problemIndex}`}
                      picture={takeAway}
                      metrics={takeAwaySize}
                      visible={!showSubMinuendOverlay}
                      lift={takeAwayLiftNow}
                      ripple={takeAwayRipple}
                      rippleScope={takeAwayRippleScope}
                      appHidden={appHidden}
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
                  flexDirection:
                    layout.chipsAxis === 'column' ? 'column' : 'row',
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
                    font={chipFont}
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
          </StageLayer>
        )}
      </Animated.View>
    </>
  )
}

/**
 * The problem and the chips. A review's or a peek's stage mounts at its
 * opener's end and fades in, 200 ms ease-out, or appears at once with
 * Reduce Motion (review spec § 5, fast-track spec § 9); every other
 * session renders them as before.
 */
function StageLayer({
  fade,
  reducedMotion,
  children,
}: {
  /** Which opener the stage waited for; `null` = none. */
  fade: 'review' | 'peek' | null
  reducedMotion: boolean
  children: ReactNode
}) {
  if (fade === null) return <>{children}</>
  return (
    <Animated.View
      testID={`math-${fade}-stage`}
      entering={
        reducedMotion
          ? undefined
          : FadeIn.duration(STAGE_FADE_MS).easing(STAGE_EASE)
      }
      style={styles.stageLayer}
    >
      {children}
    </Animated.View>
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
  stageLayer: { ...FILL, pointerEvents: 'box-none' },
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
