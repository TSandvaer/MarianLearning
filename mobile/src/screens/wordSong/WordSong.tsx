/**
 * Screen 4, Word Song: 8 problems with Emma. Native port of
 * `src/screens/WordSong/WordSong.tsx` (web, the source of truth; spec
 * `design/screen-4-word-song.md`) with the native calls of
 * `design/native/word-song-native.md`. Each round is core's
 * (`@marian/core/wordSong/wordRound`, via `./nativeRound.ts`).
 *
 * Kept from the web, behaviour for behaviour:
 * - **Read-aloud** per problem once the session start settled, Emma
 *   `listening`; on `cvc-word` after the silent beat (`./silentBeat.ts`).
 * - **Chips** answer only after the read-aloud ENDS.
 * - **Right**: sparkle + plink, Emma `celebration`, the sentence gap fills;
 *   counted unless Emma gave the answer (ever-correct), the streak grows
 *   on a clean win; no stardust (Session End's +5). Advance after
 *   max(1.2 s, "Yes!") with a 4 s ceiling.
 * - **Wrong**: poof, shake, Emma `puzzled-tilt` (never a red X), the
 *   streak breaks, "try again?"; at 2 wrongs (600 ms later) the blend or
 *   the hint, Emma `attentive-pointing`; at 3 she gives the answer and
 *   only that chip stays tappable.
 * - **Result** (`WordSongSessionResult`) to App after problem 8.
 *
 * Native (spec): the blend's letters light on the clip's measured marks;
 * letters play their own sounds and the picture says its word (cut from
 * the blend clip, `../../audio/tapClip.ts`); letter taps hold the silent
 * beat (≤ 5 s), which counts foreground time only; a word without art
 * draws as a written-word problem; the th cue sits beside the picture;
 * Android back = the back arrow; an advance due while hidden waits for the
 * return (as Math); a re-prompt that ends after a right answer schedules no
 * hint (it would cut "Yes!" off). Dropped (web-only): the WebKit audio
 * unlock machinery and the audioCtx probes.
 *
 * Native-only, same-day review and daily warm-up (spec
 * `design/native/review-mode-and-warmup-native.md`), as Math's: a review's
 * opener plays over an empty stage, which mounts at its end and fades in;
 * "Remember this one?" plays before each warm-up problem (the stage up);
 * line end → 400 ms → the problem's read (after the silent beat on a CVC
 * card). The HUD shows the moon or the hearts. Warm-up problems never touch
 * the score or the streak; their first taps go to `warmupCorrect`.
 *
 * Native-only, the fast track and the Map peek (spec
 * `design/native/fast-track-native.md`): the result carries the 8 scored
 * problems' first taps (`firstTapCorrect`, § 3.2; a problem solved after a
 * wrong tap is `false` there and `true` in `perProblemCorrect`). A peek
 * (`peek` = the step, § 6.3) plays 3 of its problems: the opener "Let's look
 * at <name>!" over an empty stage, no stardust pill and no streak, and
 * after problem 3 400 ms → the closer "<Name> is for later. You will learn
 * it!" → 400 ms → `onPeekEnd`; the back
 * arrow (and Android back) cuts the line and calls `onPeekEnd` at once. A
 * peek writes nothing and hands no result over.
 *
 * Emma is App's `EmmaStage`; this screen reports her pose (`onPoseChange`).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { SkillLevel, SkillNode } from '@marian/core/progress'
import {
  ADVANCE_AFTER_CORRECT_MS,
  ADVANCE_HARD_CEILING_MS,
  HINT_DELAY_AFTER_WRONG_MS,
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
  chipLabel,
  countsAsCorrect,
  isCleanWin,
  isCorrectChip,
  secondWrongPrompt,
  wrongTapOutcome,
} from '@marian/core/wordSong/wordRound'
import {
  pickStaticWordSongPlan,
  type WordSongProblem,
  type WordSongSessionPlan,
} from '@marian/core/wordSong/wordSessionPlans'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  audioEngine,
  blendMarksFor,
  blendRevealAt,
  createSfx,
  createTapClipPlayer,
  letterWindow,
  litAt,
  PEEK_CLOSE_GAP_MS,
  peekGuideLines,
  SESSION_GUIDE_GAP_MS,
  sessionGuideLine,
  sessionGuidePlayer,
  SFX_SOURCES,
  wordWindow,
  type Segment,
  type SessionGuideLineId,
  type SessionGuidePlayer,
  type Sfx,
  type TapClipPlayer,
} from '../../audio'
import { CaptionRibbon } from '../../components/CaptionRibbon'
import type { WordSongLayout } from '../../layout/wordSongLayout'
import {
  appVisibility,
  useIsAppHidden,
  type AppVisibility,
} from '../../lifecycle/appVisibility'
import { colors, FILL } from '../../theme'
import { GettingReady } from '../math/GettingReady'
import { WORD_SONG_HUD } from '../math/hudWorld'
import { MathHud } from '../math/MathHud'
import {
  createSilentMathPlayer,
  type SilentMathPlayer,
} from '../math/silentPlayer'
import { nativeRound } from './nativeRound'
import { startSilentBeat, type SilentBeat } from './silentBeat'
import { ThIntroPanel } from './ThCue'
import { useLineSpeaker, type SpeakHooks } from './useLineSpeaker'
import { WordChip } from './WordChip'
import type {
  ClipFileFn,
  PlayWordSongUtteranceFn,
  WordSongSessionResult,
} from './wordSongTypes'
import { WordStage } from './WordStage'

/** Word Song fades out over 250 ms (web `exit`). */
export const WORD_SONG_EXIT_MS = 250
/** A letter tap lights its letter at least this long (web pulse). */
export const TAP_LIGHT_MIN_MS = 400
/** Review spec § 5: the stage fades in over 200 ms after the opener. */
export const STAGE_FADE_MS = 200
const STAGE_EASE = Easing.bezier(0, 0, 0.58, 1)

/** The three effects, with the web's volumes. Test seam. */
export interface WordSongSfx {
  sparkle: Sfx
  poof: Sfx
  plink: Sfx
}

function createWordSongSfx(): WordSongSfx {
  return {
    sparkle: createSfx({ src: SFX_SOURCES.sparkle, volume: 0.85 }),
    poof: createSfx({ src: SFX_SOURCES.poof, volume: 0.7 }),
    plink: createSfx({ src: SFX_SOURCES.plink, volume: 0.7 }),
  }
}

/** Stop Emma's line if it is a session line (Word Song's own lines are). */
function cancelSessionLine(): void {
  if (audioEngine.voice.activeLabel?.startsWith('session:')) {
    audioEngine.cancelVoice()
  }
}

/** Run `fn` in a microtask (web: `queueMicrotask`, not in RN's typings). */
const microtask = (fn: () => void): void => {
  void Promise.resolve().then(fn)
}

export interface WordSongProps {
  layout: WordSongLayout
  /** The session plan: the server's once it settled, else the static one. */
  plan?: WordSongSessionPlan
  /** The session audio's player; without it the captions walk silently. */
  playUtterance?: PlayWordSongUtteranceFn
  /** The session's clip files (tap sounds, blend marks). */
  clipFor?: ClipFileFn
  /** `false` while the session start is in flight ("getting ready"). */
  audioReady?: boolean
  /** Cross-vowel distractors, uniform for the session. */
  crossVowelMixing?: boolean
  digraphsThNodeLevel?: SkillLevel
  digraphsThFirstEncounter?: boolean
  onSessionComplete?: (result: WordSongSessionResult) => void
  /** The back arrow and Android back (to the Hub). */
  onRequestExit: () => void
  onPoseChange?: (pose: EmmaPose) => void
  /** Stops Emma's line in flight (exit, unmount). Default: the engine's. */
  cancelLine?: () => void
  sfx?: WordSongSfx
  /** Test seam: the tap-sound player. */
  tapPlayer?: TapClipPlayer
  storage?: StorageAdapter
  now?: () => Date
  visibility?: AppVisibility
  /**
   * QA only (debug + `EXPO_PUBLIC_QA_AUTOTAP_MS`): answer this long after
   * the chips open. Problem 1 gets three wrong answers (re-prompt, blend or
   * hint, the answer), problem 2 one, the rest the right one.
   */
  qaAutoAnswerAfterMs?: number
  /** Test seam: the silent caption walk used without a player. */
  silentPlayer?: SilentMathPlayer
  /** A same-day review: the opener over an empty stage, the moon. */
  review?: boolean
  /** The first `warmupCount` problems of `plan` are the warm-up (0–2). */
  warmupCount?: number
  /** Test seam: the opener / warm-up line player. Default: the app's. */
  sessionGuide?: SessionGuidePlayer
  /**
   * A Map peek on this step (fast-track spec § 6.3): 3 of its problems,
   * nothing scored or written. Fixed for the mount.
   */
  peek?: SkillNode
  /** The peek is over (after the closer, or the back arrow at once). */
  onPeekEnd?: () => void
}

interface PerProblemState {
  resolved: boolean
  wrongCount: number
  hintPlayed: boolean
  guidedPlayed: boolean
}

const FRESH: PerProblemState = {
  resolved: false,
  wrongCount: 0,
  hintPlayed: false,
  guidedPlayed: false,
}

type Timer = ReturnType<typeof setTimeout> | null

/** The blend clip of a `cvc-word` problem and its marks, when measured. */
function blendOf(problem: WordSongProblem, clipFor: ClipFileFn | undefined) {
  const text =
    problem.contentType === 'cvc-word' ? problem.utterances.blend : undefined
  const clip = text !== undefined ? clipFor?.(text) : undefined
  const marks =
    text !== undefined && clip ? blendMarksFor(text, clip.bytes) : null
  return { text, uri: clip?.uri, marks }
}

export function WordSong({
  layout,
  plan: planProp,
  playUtterance,
  clipFor,
  audioReady,
  crossVowelMixing = false,
  digraphsThNodeLevel = 'locked',
  digraphsThFirstEncounter = false,
  onSessionComplete,
  onRequestExit,
  onPoseChange,
  cancelLine = cancelSessionLine,
  sfx: sfxProp,
  tapPlayer,
  storage,
  now = () => new Date(),
  visibility = appVisibility,
  qaAutoAnswerAfterMs,
  silentPlayer,
  review = false,
  warmupCount = 0,
  sessionGuide,
  peek,
  onPeekEnd,
}: WordSongProps) {
  const appHidden = useIsAppHidden(visibility)
  const reducedMotion = useReducedMotion()
  // Web: the plan follows `planProp` (the server's swaps in for the static
  // one while the stage still shows "getting ready").
  const plan = useMemo<WordSongSessionPlan>(
    () => planProp ?? pickStaticWordSongPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: `now` only seeds the fallback
    [planProp],
  )

  // Fixed at mount: the effects, the players, the line canceller.
  const [sfx] = useState<WordSongSfx>(() => sfxProp ?? createWordSongSfx())
  const [silent] = useState(() => silentPlayer ?? createSilentMathPlayer())
  const [tap] = useState(() => tapPlayer ?? createTapClipPlayer(audioEngine))
  const [cancelEmmaLine] = useState(() => cancelLine)
  const [guide] = useState(() => sessionGuide ?? sessionGuidePlayer())
  const playRef = useRef<PlayWordSongUtteranceFn>(silent.play)
  const clipForRef = useRef(clipFor)
  const onSessionCompleteRef = useRef(onSessionComplete)
  const onPoseChangeRef = useRef(onPoseChange)
  const onRequestExitRef = useRef(onRequestExit)
  const onPeekEndRef = useRef(onPeekEnd)
  useLayoutEffect(() => {
    playRef.current = playUtterance ?? silent.play
    clipForRef.current = clipFor
    onSessionCompleteRef.current = onSessionComplete
    onPoseChangeRef.current = onPoseChange
    onRequestExitRef.current = onRequestExit
    onPeekEndRef.current = onPeekEnd
  })
  /** A peek is fixed for the mount (App mounts a fresh screen per peek). */
  const [peekNode] = useState(peek)
  const isPeek = peekNode !== undefined
  /** The step's opener and closer (§ 8); none for a step without lines. */
  const [peekLines] = useState(() =>
    peekNode === undefined ? null : peekGuideLines(peekNode),
  )
  /** `onPeekEnd` fires once. */
  const peekEndedRef = useRef(false)
  const line = useLineSpeaker(playRef)
  const { caption, speaking, clearCaption, linesInFlight, unmounted } = line
  const speakLine = line.speak
  // The round's shape, read by the tap handlers (review spec § 7.4).
  const warmups = Math.min(Math.max(0, warmupCount), plan.problems.length)
  const warmupsRef = useRef(warmups)
  useLayoutEffect(() => {
    warmupsRef.current = warmups
  })
  /**
   * The line over the empty stage before problem 1's read: a review's
   * opener or a peek's (same behaviour). `null` for every other session.
   */
  const opener: SessionGuideLineId | null = review
    ? 'guide.session.review'
    : (peekLines?.open ?? null)
  /** The opener has played (the stage mounts at its end). */
  const [openerDone, setOpenerDone] = useState(false)
  const openerStartedRef = useRef(false)
  /** The problem whose guide line has started (one per problem). */
  const leadForRef = useRef(-1)
  const leadInTimerRef = useRef<Timer>(null)
  /** A peek's gaps around its closer (§ 6.3). */
  const closerTimerRef = useRef<Timer>(null)

  // ── State (web names) ────────────────────────────────────────────────

  const [stardust, setStardust] = useState<StardustState>(() =>
    loadStardust(storage),
  )
  const stardustTotalRef = useRef(stardust.total)
  const [problemIndex, setProblemIndex] = useState(0)
  const [problemState, setProblemState] = useState<PerProblemState>(FRESH)
  // Synchronous mirrors: a burst of taps in one tick must see the latest.
  const resolvedRef = useRef(false)
  const wrongCountRef = useRef(0)
  const hintPlayedRef = useRef(false)
  const guidedPlayedRef = useRef(false)
  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)
  const totalCorrectRef = useRef(0)
  const perProblemCorrectRef = useRef<boolean[]>(plan.problems.map(() => false))
  const perProblemAnswerWordRef = useRef<(string | null)[]>(
    plan.problems.map(() => null),
  )
  /** Per problem of the round: was the first tap right (the warm-up's result). */
  const firstTapCorrectRef = useRef<boolean[]>(plan.problems.map(() => false))
  const firstTapRecordedRef = useRef(false)
  /** The read-aloud ENDED: the chips answer (web `readAloudPlayed`). */
  const [readAloudPlayed, setReadAloudPlayed] = useState(false)
  const readAloudPlayedRef = useRef(false)
  /** "speak() already started for this problem" (no double read-aloud). */
  const spokeReadAloudRef = useRef(false)
  const [pose, setPose] = useState<EmmaPose>('idle')
  const [shakingChip, setShakingChip] = useState<string | null>(null)
  /** The lit letter (blend or tap); `word.length` lights them all. */
  const [lit, setLit] = useState<number | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [streakFadingOut, setStreakFadingOut] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)

  const advanceTimerRef = useRef<Timer>(null)
  const ceilingTimerRef = useRef<Timer>(null)
  const shakeTimerRef = useRef<Timer>(null)
  const hintTimerRef = useRef<Timer>(null)
  const poseTimerRef = useRef<Timer>(null)
  const streakFadeTimerRef = useRef<Timer>(null)
  const litTimerRef = useRef<Timer>(null)
  const beatRef = useRef<SilentBeat | null>(null)
  /** Bumped by every tap sound; a stale one never darkens a newer light. */
  const tapTokenRef = useRef(0)
  const minDwellElapsedRef = useRef(false)
  const correctSpeakResolvedRef = useRef(false)
  const advanceFiredRef = useRef(false)
  const pendingAdvanceRef = useRef(false)
  const problemIndexRef = useRef(problemIndex)

  const round = useMemo(
    () => nativeRound(plan.problems[problemIndex]!, crossVowelMixing),
    [plan, problemIndex, crossVowelMixing],
  )

  const clearTimers = useCallback(() => {
    for (const ref of [
      advanceTimerRef,
      ceilingTimerRef,
      shakeTimerRef,
      hintTimerRef,
      poseTimerRef,
      streakFadeTimerRef,
      litTimerRef,
      leadInTimerRef,
      closerTimerRef,
    ]) {
      if (ref.current !== null) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
    beatRef.current?.cancel()
    beatRef.current = null
  }, [])

  useEffect(() => {
    // Read at unmount on purpose: the latest line count.
    const lines = linesInFlight
    return () => {
      clearTimers()
      // No audio leak: Emma's line, a silent walk and a tap sound stop.
      silent.cancel()
      if (lines.current > 0) cancelEmmaLine()
      guide.cancelActive()
      tap.release()
      sfx.sparkle.unload()
      sfx.poof.unload()
      sfx.plink.unload()
      // No stardust write here (the web's defensive unmount write): Word
      // Song grants none, and natively Session End mounts (and grants its
      // +5) before this cleanup runs, so a write of the total read at
      // mount would take the bonus back.
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

  useEffect(() => {
    problemIndexRef.current = problemIndex
  }, [problemIndex])

  // Every Emma line cuts a tap sound in flight and its light (§ 6); a tap
  // never cuts her. (The blend lights its own letters as it plays.)
  const speak = useCallback(
    (text: string, hooks?: SpeakHooks) => {
      tapTokenRef.current += 1
      tap.cut()
      if (litTimerRef.current !== null) {
        clearTimeout(litTimerRef.current)
        litTimerRef.current = null
      }
      setLit(null)
      return speakLine(text, hooks)
    },
    [tap, speakLine],
  )

  // ── The read-aloud (+ the silent beat) ───────────────────────────────

  useEffect(() => {
    if (guidedActive) return // the guided line owns the audio
    if (audioReady === false) return // session start in flight
    const problem = plan.problems[problemIndex]!
    const my = problemIndex
    const dispatch = () => {
      if (unmounted.current || problemIndexRef.current !== my) return
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      setPose('listening')
      void speak(problem.utterances.read).then(() => {
        if (unmounted.current || problemIndexRef.current !== my) return
        readAloudPlayedRef.current = true
        setReadAloudPlayed(true)
        setPose((c) => (c === 'listening' ? 'idle' : c))
      })
    }
    // Review spec § 4: the opener where problem 1's read would start; the
    // warm-up line before each warm-up read. Line end → 400 ms → the read
    // (a CVC card's silent beat, then its read).
    const lead: SessionGuideLineId | null =
      opener !== null && my === 0 && !openerStartedRef.current
        ? opener
        : my < warmups
          ? 'guide.session.warmup'
          : null
    if (lead === null && round.readAloudDelayMs === 0) {
      microtask(dispatch)
      return
    }
    let cancelled = false
    let beat: SilentBeat | null = null
    const stale = () =>
      cancelled || unmounted.current || problemIndexRef.current !== my
    const read = () => {
      if (stale()) return
      if (round.readAloudDelayMs === 0) {
        dispatch()
        return
      }
      const b = startSilentBeat(
        round.readAloudDelayMs,
        visibility.getIsHidden(),
        () => {
          if (beatRef.current === b) beatRef.current = null
          dispatch()
        },
      )
      beat = b
      beatRef.current = b
    }
    if (lead === null) {
      read()
    } else {
      microtask(() => {
        if (stale() || leadForRef.current === my) return
        leadForRef.current = my
        if (lead === opener) openerStartedRef.current = true
        setPose('listening')
        void speak(sessionGuideLine(lead).text, {
          play: (_text, opts) => guide.playLine(lead, opts),
        }).then(() => {
          if (stale()) return
          if (lead === opener) setOpenerDone(true)
          setPose((c) => (c === 'listening' ? 'idle' : c))
          leadInTimerRef.current = setTimeout(() => {
            leadInTimerRef.current = null
            read()
          }, SESSION_GUIDE_GAP_MS)
        })
      })
    }
    return () => {
      cancelled = true
      if (beat !== null) {
        beat.cancel()
        if (beatRef.current === beat) beatRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- web parity: re-run on problem / readiness only
  }, [problemIndex, audioReady])

  // Background: the beat pauses; a tap sound stops for good (its own end
  // callback, or its light's timer, puts the light out).
  useEffect(() => {
    beatRef.current?.setHidden(appHidden)
    if (appHidden) tap.release()
  }, [appHidden, tap])

  // ── Tap-to-hear (§ 4) ────────────────────────────────────────────────

  /** Light letter `i` (or all) for `ms`, unless a newer tap took over. */
  const lightFor = useCallback((i: number, ms: number, token: number) => {
    setLit(i)
    if (litTimerRef.current !== null) clearTimeout(litTimerRef.current)
    litTimerRef.current = setTimeout(() => {
      litTimerRef.current = null
      if (tapTokenRef.current === token) setLit(null)
    }, ms)
  }, [])

  // (Plain functions: they read the in-flight line count, a ref.)
  const onLetterPress = (i: number) => {
    // Inert once solved, and while Emma speaks.
    if (resolvedRef.current || linesInFlight.current > 0) return
    beatRef.current?.letterTapped()
    const token = ++tapTokenRef.current
    const problem = plan.problems[problemIndexRef.current]!
    const { uri, marks } = blendOf(problem, clipForRef.current)
    const seg: Segment | undefined = marks !== null ? marks[i] : undefined
    if (uri !== undefined && seg !== undefined && i < 3) {
      const w = letterWindow(seg)
      tap.play(uri, w.from, w.to)
      lightFor(i, Math.max(TAP_LIGHT_MIN_MS, w.to - w.from), token)
    } else {
      tap.cut()
      lightFor(i, TAP_LIGHT_MIN_MS, token)
    }
  }

  /** Picture, glyph and scene taps: after the read, until solved, not over Emma. */
  const tapsOpen = readAloudPlayed && !problemState.resolved && !speaking

  const onReplayRead = () => {
    if (!readAloudPlayedRef.current || resolvedRef.current) return
    if (linesInFlight.current > 0) return
    const problem = plan.problems[problemIndexRef.current]!
    setPose('listening')
    void speak(problem.utterances.read).then(() => {
      setPose((c) => (c === 'listening' ? 'idle' : c))
    })
  }

  const onPicturePress = () => {
    if (!readAloudPlayedRef.current || resolvedRef.current) return
    if (linesInFlight.current > 0) return
    const problem = plan.problems[problemIndexRef.current]!
    const { uri, marks } = blendOf(problem, clipForRef.current)
    if (uri === undefined || marks === null) {
      onReplayRead()
      return
    }
    const token = ++tapTokenRef.current
    const w = wordWindow(marks)
    setLit(problem.target.word.length)
    tap.play(uri, w.from, w.to, () => {
      if (tapTokenRef.current === token) setLit(null)
    })
  }

  // ── Advance / complete ───────────────────────────────────────────────

  const planLength = plan.problems.length
  useEffect(() => {
    // The server plan may swap in with another length (web keeps 8).
    const resize = <T,>(arr: T[], fill: T): T[] =>
      arr.length === planLength
        ? arr
        : Array.from({ length: planLength }, (_, i) => arr[i] ?? fill)
    perProblemCorrectRef.current = resize(perProblemCorrectRef.current, false)
    perProblemAnswerWordRef.current = resize<string | null>(
      perProblemAnswerWordRef.current,
      null,
    )
    firstTapCorrectRef.current = resize(firstTapCorrectRef.current, false)
  }, [planLength])

  const advanceToNext = useCallback(() => {
    if (problemIndex < plan.problems.length - 1) {
      clearTimers()
      setProblemIndex((i) => i + 1)
      setProblemState(FRESH)
      resolvedRef.current = false
      wrongCountRef.current = 0
      hintPlayedRef.current = false
      guidedPlayedRef.current = false
      readAloudPlayedRef.current = false
      setReadAloudPlayed(false)
      spokeReadAloudRef.current = false
      firstTapRecordedRef.current = false
      tapTokenRef.current += 1
      tap.cut()
      setShakingChip(null)
      setLit(null)
      setPose('idle')
      setGuidedActive(false)
      setStreakFadingOut(false)
      setCelebrating(false)
      clearCaption()
      return
    }
    if (isPeek) {
      // Peek § 6.3: 400 ms → the closer → 400 ms → back to the Map. No
      // Session End, no result, no write.
      setPose('listening')
      const closer = peekLines?.close
      closerTimerRef.current = setTimeout(() => {
        closerTimerRef.current = null
        if (unmounted.current) return
        const said =
          closer === undefined
            ? Promise.resolve()
            : speak(sessionGuideLine(closer).text, {
                play: (_text, opts) => guide.playLine(closer, opts),
              })
        void said.then(() => {
          if (unmounted.current) return
          setPose('idle')
          closerTimerRef.current = setTimeout(() => {
            closerTimerRef.current = null
            if (unmounted.current || peekEndedRef.current) return
            peekEndedRef.current = true
            onPeekEndRef.current?.()
          }, PEEK_CLOSE_GAP_MS)
        })
      }, PEEK_CLOSE_GAP_MS)
      return
    }
    const finalState = writeStardust(stardustTotalRef.current, storage, now)
    setStardust(finalState)
    // The arrays cover the round; the result's cover the 8 scored
    // problems, and the warm-up's first taps go apart (§ 7.4).
    const w = warmupsRef.current
    onSessionCompleteRef.current?.({
      totalCorrect: totalCorrectRef.current,
      totalStardust: finalState.total,
      finalStreak: streakRef.current,
      earnedThisSession: 0,
      surface: 'word-song',
      perProblemCorrect: perProblemCorrectRef.current.slice(w),
      targetWords: plan.problems.slice(w).map((p) => p.target.word),
      perProblemAnswerWord: perProblemAnswerWordRef.current.slice(w),
      warmupCorrect: firstTapCorrectRef.current.slice(0, w),
      firstTapCorrect: firstTapCorrectRef.current.slice(w),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` seeds the write only
  }, [
    problemIndex,
    plan,
    storage,
    clearTimers,
    clearCaption,
    tap,
    isPeek,
    peekLines,
    speak,
    guide,
  ])

  // Back from the background: run the advance that waited for it.
  useEffect(() => {
    if (appHidden || !pendingAdvanceRef.current) return
    pendingAdvanceRef.current = false
    advanceFiredRef.current = true
    microtask(() => {
      if (unmounted.current) return
      setCelebrating(false)
      advanceToNext()
    })
  }, [appHidden, advanceToNext, unmounted])

  // ── Taps ─────────────────────────────────────────────────────────────

  const backToIdleSoon = useCallback(() => {
    poseTimerRef.current = setTimeout(() => {
      setPose('idle')
      poseTimerRef.current = null
    }, 0)
  }, [])

  /** The 2nd wrong's blend (letters on the marks) or the hint line. */
  const playSecondWrong = useCallback(
    (problem: WordSongProblem) => {
      setPose('attentive-pointing')
      const prompt = secondWrongPrompt(problem)
      if (prompt.kind === 'hint') {
        void speak(prompt.text).then(backToIdleSoon)
        return
      }
      const { marks } = blendOf(problem, clipForRef.current)
      const word = problem.target.word.length
      const hooks: SpeakHooks =
        marks !== null
          ? {
              onTime: (ms) => setLit(litAt(marks, ms, word)),
              revealAt: (ms) => blendRevealAt(prompt.text, marks, ms),
            }
          : {
              onWordTick: (i) => {
                const next = prompt.steps[i]
                if (next !== undefined) setLit(next)
              },
            }
      void speak(prompt.text, hooks).then(() => {
        setLit(null)
        setPose((c) => (c === 'attentive-pointing' ? 'idle' : c))
      })
    },
    [speak, backToIdleSoon],
  )

  const handleWrongTap = useCallback(
    (word: string, problem: WordSongProblem) => {
      sfx.poof.play()
      setShakingChip(word)
      if (shakeTimerRef.current !== null) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setShakingChip(null)
        shakeTimerRef.current = null
      }, WRONG_SHAKE_MS)
      setPose('puzzled-tilt')
      if (poseTimerRef.current !== null) clearTimeout(poseTimerRef.current)

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

      const outcome = wrongTapOutcome({
        wrongCount: wrongCountRef.current,
        hintPlayed: hintPlayedRef.current,
        guidedPlayed: guidedPlayedRef.current,
      })
      wrongCountRef.current = outcome.wrongCount
      setProblemState((prev) => ({ ...prev, wrongCount: outcome.wrongCount }))
      if (outcome.scheduleHint) hintPlayedRef.current = true
      if (outcome.scheduleGuided) guidedPlayedRef.current = true

      // Stale-resolve guard (web `repromptInFlightRef`), per problem: a
      // re-prompt that ends after the advance schedules nothing. Native
      // keys it on the problem, so a second wrong tap's re-prompt cutting
      // the first cannot clear the second's own beat.
      const myProblem = problemIndexRef.current
      void speak(problem.utterances.reprompt).then(() => {
        if (unmounted.current || problemIndexRef.current !== myProblem) return
        // Native-only: solved meanwhile, so no hint over "Yes!".
        if (resolvedRef.current) return
        if (!outcome.scheduleHint && !outcome.scheduleGuided) {
          backToIdleSoon()
        }
        if (outcome.scheduleGuided) {
          setGuidedActive(true)
          setProblemState((prev) => ({ ...prev, guidedPlayed: true }))
          void speak(problem.utterances.giveAnswer).then(backToIdleSoon)
        } else if (outcome.scheduleHint) {
          hintTimerRef.current = setTimeout(() => {
            hintTimerRef.current = null
            if (resolvedRef.current || guidedPlayedRef.current) return
            setProblemState((prev) => ({ ...prev, hintPlayed: true }))
            playSecondWrong(problem)
          }, HINT_DELAY_AFTER_WRONG_MS)
        }
      })
    },
    [sfx, speak, streak, unmounted, backToIdleSoon, playSecondWrong, isPeek],
  )

  const handleCorrectTap = useCallback(
    (problem: WordSongProblem) => {
      resolvedRef.current = true
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
      sfx.sparkle.play()
      sfx.plink.play()
      setPose('celebration')
      setCelebrating(true)
      setProblemState((prev) => ({ ...prev, resolved: true }))

      const counters = {
        wrongCount: wrongCountRef.current,
        guidedPlayed: guidedPlayedRef.current,
      }
      // The round's index (a forward round's `problem.index - 1`); a
      // warm-up answer never counts toward the score or the streak.
      const i = problemIndexRef.current
      const warm = i < warmupsRef.current
      if (countsAsCorrect(counters)) {
        if (i >= 0 && i < perProblemCorrectRef.current.length) {
          perProblemCorrectRef.current[i] = true
        }
        if (!warm) totalCorrectRef.current += 1
        if (!warm && !isPeek && isCleanWin(counters)) {
          streakRef.current += 1
          setStreak(streakRef.current)
        }
      }

      minDwellElapsedRef.current = false
      correctSpeakResolvedRef.current = false
      advanceFiredRef.current = false
      const fire = () => {
        advanceFiredRef.current = true
        if (ceilingTimerRef.current !== null) {
          clearTimeout(ceilingTimerRef.current)
          ceilingTimerRef.current = null
        }
        if (advanceTimerRef.current !== null) {
          clearTimeout(advanceTimerRef.current)
          advanceTimerRef.current = null
        }
        setCelebrating(false)
        advanceToNext()
      }
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
        fire()
      }
      void speak(problem.utterances.correct).then(() => {
        if (unmounted.current) return
        correctSpeakResolvedRef.current = true
        backToIdleSoon()
        tryAdvance()
      })
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        minDwellElapsedRef.current = true
        tryAdvance()
      }, ADVANCE_AFTER_CORRECT_MS)
      ceilingTimerRef.current = setTimeout(() => {
        ceilingTimerRef.current = null
        if (advanceFiredRef.current) return
        if (visibility.getIsHidden()) {
          pendingAdvanceRef.current = true
          return
        }
        fire()
      }, ADVANCE_HARD_CEILING_MS)
    },
    [sfx, speak, advanceToNext, visibility, unmounted, backToIdleSoon, isPeek],
  )

  const onChipTap = useCallback(
    (word: string) => {
      if (resolvedRef.current) return
      // Before Emma has read the problem, a tap is not an answer.
      if (!readAloudPlayedRef.current) return
      const problem = plan.problems[problemIndex]!
      const isCorrect = isCorrectChip(problem, word)
      // Web: the first tap's word, right or wrong, once per problem.
      if (!firstTapRecordedRef.current) {
        firstTapRecordedRef.current = true
        if (problemIndex < perProblemAnswerWordRef.current.length) {
          perProblemAnswerWordRef.current[problemIndex] = word
        }
        if (problemIndex < firstTapCorrectRef.current.length) {
          firstTapCorrectRef.current[problemIndex] = isCorrect
        }
      }
      if (guidedActive && !isCorrect) return
      // A chip tap cuts a tap sound in flight (§ 6).
      tapTokenRef.current += 1
      tap.cut()
      if (isCorrect) handleCorrectTap(problem)
      else handleWrongTap(word, problem)
    },
    [plan, problemIndex, guidedActive, tap, handleCorrectTap, handleWrongTap],
  )

  // QA autoplay (debug only), see `qaAutoAnswerAfterMs`.
  const onChipTapRef = useRef(onChipTap)
  useLayoutEffect(() => {
    onChipTapRef.current = onChipTap
  })
  useEffect(() => {
    if (qaAutoAnswerAfterMs === undefined) return
    if (!readAloudPlayed || problemState.resolved) return
    const target = plan.problems[problemIndex]!.target.word
    // The scored problems' first two, as before; warm-ups answered right.
    const scored = problemIndex - warmups
    const wanted = scored === 0 ? 3 : scored === 1 ? 1 : 0
    const wrong = round.chips.find((e) => e.word !== target)?.word
    const word =
      problemState.wrongCount < wanted && wrong !== undefined ? wrong : target
    const id = setTimeout(() => onChipTapRef.current(word), qaAutoAnswerAfterMs)
    return () => clearTimeout(id)
  }, [
    qaAutoAnswerAfterMs,
    readAloudPlayed,
    problemState.resolved,
    problemState.wrongCount,
    problemIndex,
    plan,
    round,
    warmups,
  ])

  // Back arrow and Android back: silence, then the Hub (no Session End);
  // in a peek, `onPeekEnd` at once (§ 6.3).
  const exit = useCallback(() => {
    tapTokenRef.current += 1
    tap.cut()
    cancelEmmaLine()
    if (isPeek) {
      if (peekEndedRef.current) return
      peekEndedRef.current = true
      clearTimers()
      silent.cancel()
      guide.cancelActive()
      onPeekEndRef.current?.()
      return
    }
    onRequestExitRef.current()
  }, [tap, cancelEmmaLine, isPeek, clearTimers, silent, guide])
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit()
      return true
    })
    return () => sub.remove()
  }, [exit])

  // ── Render ───────────────────────────────────────────────────────────

  const problem = plan.problems[problemIndex]!
  const showStreak = streak >= 2 || streakFadingOut
  const showThCorner =
    digraphsThNodeLevel === 'intro' || digraphsThNodeLevel === 'practicing'
  const showThIntro = digraphsThFirstEncounter && audioReady !== true
  const { stage, chips, ribbon, ribbonPadding } = layout
  // A review's or a peek's stage waits for its opener (review spec § 3.3,
  // fast-track spec § 6.3).
  const stageShown = opener === null || openerDone
  const ribbonLines = Math.max(
    1,
    Math.floor(
      (ribbon.maxHeight - ribbonPadding.vertical * 2) /
        layout.captionLineHeight,
    ),
  )

  return (
    <>
      <Animated.View
        testID="word-song-background"
        exiting={FadeOut.duration(WORD_SONG_EXIT_MS)}
        style={styles.background}
      />
      <Animated.View
        testID="word-song"
        exiting={FadeOut.duration(WORD_SONG_EXIT_MS)}
        style={styles.foreground}
      >
        <MathHud
          world={WORD_SONG_HUD}
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
          onBack={exit}
          review={review}
          warmupCount={warmups}
          peek={isPeek}
        />

        {caption.visible && caption.text !== '' && (
          <CaptionRibbon
            testID="word-song-ribbon"
            text={caption.text}
            revealedCount={caption.revealed}
            lineKey={`${caption.generation}`}
            fontSize={layout.captionFontSize}
            lineHeight={layout.captionLineHeight}
            padding={ribbonPadding}
            maxLines={ribbonLines}
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
              styles.center,
              {
                left: stage.x,
                top: stage.y,
                width: stage.width,
                height: stage.height,
              },
            ]}
          >
            {showThIntro && !layout.tablet && (
              <ThIntroPanel size={layout.picture} />
            )}
            <GettingReady testID="word-song-getting-ready" />
          </View>
        ) : !stageShown ? null : (
          <StageLayer
            fade={opener === null ? null : isPeek ? 'peek' : 'review'}
            reducedMotion={reducedMotion}
          >
            <WordStage
              key={`stage-${problemIndex}`}
              round={round}
              problem={problem}
              layout={layout}
              lit={lit}
              revealedCount={caption.revealed}
              resolved={problemState.resolved}
              showThCue={showThCorner}
              tapsOpen={tapsOpen}
              onLetterPress={onLetterPress}
              onPicturePress={onPicturePress}
              onReplayRead={onReplayRead}
            />
            <View
              testID="word-song-chips"
              style={[
                styles.abs,
                styles.center,
                {
                  left: chips.rect.x,
                  top: chips.rect.y,
                  width: chips.rect.width,
                  height: chips.rect.height,
                  flexDirection: chips.axis === 'row' ? 'row' : 'column',
                  gap: chips.gap,
                },
              ]}
            >
              {round.chips.map((entry) => {
                const isCorrect = isCorrectChip(problem, entry.word)
                return (
                  <WordChip
                    key={entry.word}
                    entry={entry}
                    face={round.chipFace}
                    label={chipLabel(round.chipFace, entry.word)}
                    size={chips.size}
                    ready={readAloudPlayed}
                    resolved={problemState.resolved}
                    dimForGuided={guidedActive && !isCorrect}
                    glow={guidedActive && isCorrect}
                    shaking={shakingChip === entry.word}
                    bursting={celebrating && isCorrect}
                    onTap={onChipTap}
                  />
                )
              })}
            </View>
          </StageLayer>
        )}

        {showThIntro && layout.tablet && (
          // Tablet (web): beside Emma, 22vh (her frame is 26vh).
          <View style={[styles.abs, { left: ribbon.x, top: ribbon.y }]}>
            <ThIntroPanel size={(layout.emma.height * 22) / 26} />
          </View>
        )}
      </Animated.View>
    </>
  )
}

/**
 * The card and the chips. A review's or a peek's stage mounts at its
 * opener's end and fades in, 200 ms ease-out, or appears at once with
 * Reduce Motion (review spec § 5, fast-track spec § 9); every other session
 * renders them as before.
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
      testID={`word-song-${fade}-stage`}
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
  // Web: a pink glow at 50 % / 30 % over a cream-pink gradient.
  background: {
    ...FILL,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundColor: colors.myCream,
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 30%, rgba(255, 210, 235, 0.55) 0%, rgba(255, 245, 250, 0) 60%), linear-gradient(180deg, #FFF5FA 0%, #FFF8F8 100%)',
  },
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  stageLayer: { ...FILL, pointerEvents: 'box-none' },
  abs: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Web `.clay-ribbon`: a cream clay speech slab, no outline (Math's).
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
