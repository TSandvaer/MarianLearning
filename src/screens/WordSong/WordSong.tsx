import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useAudioUnlockGate } from '../../lib/audio/useAudioUnlockGate'
import { cancelSessionAudio } from '../../lib/audio'
import {
  readHowlerContextRunning,
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from '../../lib/audio/howlerContext'
import {
  recordAudioReadyStateEvent,
  recordPlayUtteranceDispatchEvent,
  recordUnlockStateEvent,
} from '../../lib/debug/audioContextProbe'
import { getPlayerKind } from '../../lib/debug/playerKind'
import { createSfx, type Sfx } from '../../lib/sfx'
import type { EmmaPose } from '../../lib/character/emmaPose'
import { pickDistractors } from './wordDistractors'
import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from '../_shared/stardust'
import {
  pickStaticWordSongPlan,
  type WordSongSessionPlan,
  type WordSongProblem,
} from './wordSessionPlans'
import {
  ADVANCE_AFTER_CORRECT_MS,
  ADVANCE_HARD_CEILING_MS,
  CHIP_TAP_SPRING,
  FIRST_UTTERANCE_RETRY_MS,
  GUIDED_AFTER_WRONG_COUNT,
  HINT_AFTER_WRONG_COUNT,
  HINT_DELAY_AFTER_WRONG_MS,
  STREAK_BONUS_THRESHOLDS,
  STREAK_FADE_OUT_MS,
  WRONG_SHAKE_MS,
} from '../_shared/gameplayConstants'
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

// ── Constants ── Shared gameplay constants imported from _shared/gameplayConstants.
// Screen-specific constants remain inline below.

/** Ear-wiggle rotation duration on a correct tap. Bumped from the implicit
 *  pose-swap (~200ms cross-fade) to a visible keyframed rotation per the
 *  Word Song UX bug ticket — Thomas reports the celebration is "practically
 *  not visible" on iPad with the silent-but-captioned default audio path
 *  (no real TTS to fill the 1200ms auto-advance window).
 *
 *  Constraints:
 *  - Must be ≥600ms (ticket acceptance criterion)
 *  - Must complete strictly before ADVANCE_AFTER_CORRECT_MS (1200ms)
 *  - Skipped on prefers-reduced-motion — the static pose swap remains
 *
 *  600ms gives a clear two-tilt wiggle that lands well inside the budget. */
const EAR_WIGGLE_MS = 600

/** Sparkle-burst total reveal duration on a correct tap. Bumped from the
 *  default 0.6s spring tail to 0.85s so the stardust grant + sparkle reads
 *  as a clear ≥800ms beat per the UX bug ticket. Particles still travel
 *  the same distance; the spring is just stiffer-tail-damped to extend
 *  visible time. Stays under the 1200ms advance window. */
const SPARKLE_BURST_MS = 850

/** HUD pop duration (stardust counter + streak indicator) on a correct
 *  tap. Bumped from 250ms to 400ms per the UX bug acceptance criterion
 *  ("streak pulse ≥400ms"). Same value drives the stardust counter pop
 *  and the streak-bonus pulse — both are part of the unified "reward
 *  visible window" Thomas observed as too fast.
 *
 *  Note: Math intentionally still uses 250ms — the brief was scoped to
 *  Word Song only and Matt explicitly forbade touching Math.tsx beyond
 *  reading values. If Math users report the same complaint, file a
 *  separate Math ticket. */
const HUD_POP_MS = 400

/** Pop tween — drives the 3-keyframe `[1, 1.3, 1]` HUD pop. Duration is
 *  HUD_POP_MS (400ms) — bumped from the prior 250ms per the UX bug
 *  ticket. The peak scale is also slightly larger (1.3 vs 1.25) so the
 *  pop is unmistakable on iPad at viewing distance. */
const HUD_POP_TWEEN = {
  type: 'tween' as const,
  duration: HUD_POP_MS / 1000,
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
  /**
   * Optional: fires when Marian taps the mid-skill back-arrow. The
   * orchestrator routes back to Hub on this signal. Mirrored shape
   * with `Math.tsx` `onRequestExit`; same per-spec contract from
   * `design/screen-hub.md` § "Mid-skill exit contract".
   */
  onRequestExit?: () => void
  /** Optional: override the session plan. Defaults to
   *  `pickStaticWordSongPlan()` until Path A wires Claude into mount. */
  plan?: WordSongSessionPlan
  /** Optional: replace the audio playback function. Default is the
   *  silent-but-captioned 165 wpm fallback. */
  playUtterance?: PlayWordSongUtteranceFn
  /**
   * Optional: parent-driven gate for the cold-mount first read-aloud.
   * When `false`, the cold-mount fast path waits; when flipped to `true`
   * the effect re-runs and the read-aloud fires. `undefined` (no value
   * passed) preserves backwards-compatible "fire immediately" behaviour.
   *
   * See `Math.tsx` for the full rationale — mirrored shape. Ticket
   * 86c9hjnn8: on cold mount the read-aloud fires before
   * `prepareWordSongPathA` resolves, so the first problem walks the
   * caption against the silent `defaultPlayUtterance` and never plays
   * audibly. This prop lets the parent hold the read-aloud until the
   * Path A fetch settles.
   */
  audioReady?: boolean
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
  /**
   * Test seam: spy on the per-gesture iOS audio-session unlock.
   *
   * Optional Phase-8 (ticket 86c9gvd0y) return shape carrying
   * `howlerUnlockMethodCalled` for the unlock-state probe row.
   */
  unlockAudioSession?: () => {
    howlerUnlockMethodCalled?: 'called' | 'missing' | 'threw'
  } | void
  /**
   * Test seam: returns whether `Howler.ctx` is currently `'running'`.
   * Defaults to the real `readHowlerContextRunning` from
   * `lib/audio/howlerContext`. Production callers should never override
   * this. Mirrors the same seam on `Math` — see Math.tsx and ticket
   * 86c9hf4ef for the cold-mount flow rationale.
   */
  getHowlerRunning?: () => boolean
  /**
   * Test seam ONLY — pre-arms `audioUnlocked` and `readAloudPlayed` so the
   * chips render enabled on first paint and tests can `fireEvent.click`
   * without first having to bypass the `disabled` DOM attribute.
   *
   * Production must NEVER pass this. See `Math.tsx` for the full rationale
   * (mirrored seam). Ticket 86c9guh4y test fix-forward.
   */
  __testInitiallyAudioUnlocked?: boolean
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

// Phase 3b (ticket 86c9jccp7): the inlined `MelodyPose = 'idle' | 'happy'
// | 'puzzled'` union has been replaced by the shared `EmmaPose` union
// from `lib/character/emmaPose`. WordSong currently exercises a subset
// (`idle | celebration | puzzled-tilt`); the broader pose space
// (`listening`, `attentive-pointing`, etc.) is wired in follow-up tickets.

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

function WordSongScreen({
  onSessionComplete,
  onRequestExit,
  plan: planProp,
  playUtterance = defaultPlayUtterance,
  audioReady,
  sparkle,
  poof,
  plink,
  storage,
  now = () => new Date(),
  resumeAudioContext,
  unlockAudioSession,
  getHowlerRunning,
  __testInitiallyAudioUnlocked = false,
}: WordSongProps) {
  const reducedMotion = usePrefersReducedMotion()

  const resumeAudioCtx = resumeAudioContext ?? resumeHowlerContextOnGesture
  const unlockAudioSessionFn = unlockAudioSession ?? unlockIosAudioSession
  // Ticket 86c9hf4ef — see Math.tsx for the cold-mount fast-path rationale.
  const getHowlerRunningFn = getHowlerRunning ?? readHowlerContextRunning

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

  /**
   * Always-fresh mirrors of `problemState.{wrongCount,hintPlayed,guidedPlayed}`.
   * Same closure-stale risk as `resolvedRef` (above) but on the wrong-tap
   * path: 5 rapid taps on the SAME wrong picture chip all capture the
   * pre-batch `wrongCount=0` / `hintPlayed=false` / `guidedPlayed=false`
   * and each compute `nextWrongCount=1`, then on subsequent renders cross
   * the hint/guided thresholds together — queueing duplicate hint
   * utterances and duplicate guided-completion entries even though the
   * existing `!hintPlayed` / `!guidedPlayed` guards absorb most damage.
   *
   * Refs are flipped synchronously inside `handleWrongTap` BEFORE any
   * `speak()` schedule or `setTimeout` callback, so the very next tap in
   * the same gesture tick sees the updated counter and the latched
   * hint/guided flags and bails out of the duplicate-side-effect path.
   *
   * Visual rendering (the chip `disabled` state, the guided-completion
   * dimming, the data-* attributes) continues to derive from React
   * `problemState`. Only the synchronous gates inside the handlers read
   * the refs. See ticket 86c9gyb2v (mirrors Math 86c9gy7ju / PR #74).
   */
  const wrongCountRef = useRef(0)
  const hintPlayedRef = useRef(false)
  const guidedPlayedRef = useRef(false)

  /**
   * Cross-problem staleness guard. Set true before `speak(reprompt)`,
   * read inside the `.then()` to skip hint/guided dispatch if the
   * problem advanced while the reprompt was in-flight. Cleared in the
   * finally path. Does NOT block concurrent taps from firing their own
   * reprompts — dedup is at the hint/guided ref-gate level.
   */
  const repromptInFlightRef = useRef(false)

  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)
  const totalCorrectRef = useRef(0)
  /** Test seam: when `__testInitiallyAudioUnlocked` is set, this starts
   *  true so chips render tappable from first paint. See `WordSongProps`. */
  const [audioUnlocked, setAudioUnlocked] = useState(
    __testInitiallyAudioUnlocked,
  )

  /**
   * True once the per-problem read-aloud has completed. Chips are disabled
   * until this flips to `true` so Marian cannot tap a chip before hearing
   * the question — fixing the Session-2+ race where the deferred
   * `audioUnlocked` effect queued the read-aloud AFTER the user had
   * already tapped a chip and heard the result utterance.
   *
   * Reset to `false` on every problem advance. The ref mirror
   * (`readAloudPlayedRef`) is the synchronous gate read in `onChipTap`;
   * the React state drives the visual `disabled` prop on chips.
   *
   * See ticket 86c9guh4y.
   */
  const [readAloudPlayed, setReadAloudPlayed] = useState(
    __testInitiallyAudioUnlocked,
  )
  const readAloudPlayedRef = useRef(__testInitiallyAudioUnlocked)

  /**
   * Synchronous double-speak latch. See Math.tsx for the long-form
   * rationale (ticket 86c9hf4ef). Flipped synchronously inside the
   * read-aloud microtask before `speak()` is called; reset on every
   * problem advance.
   */
  const spokeReadAloudRef = useRef(__testInitiallyAudioUnlocked)

  const [pose, setPose] = useState<EmmaPose>('idle')
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
  const advanceCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streakFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Synchronous gates for the chained advance after a correct answer.
   * See Math.tsx for the long-form rationale — mirrored shape. Ticket
   * 86c9j60qr (celebration-audio cutoff after Emma voice swap).
   */
  const minDwellElapsedRef = useRef(false)
  const correctSpeakResolvedRef = useRef(false)
  const advanceFiredRef = useRef(false)

  /**
   * Unmount latch and problem-index mirror for the read-aloud `.then()`
   * resolution path. See Math.tsx for the long-form rationale — mirrored
   * shape. Ticket 86c9hf4ef round 2 (production cancelled-flag race fix).
   */
  const unmountedRef = useRef(false)
  const problemIndexRef = useRef(problemIndex)

  const clearAllTimers = useCallback(() => {
    for (const ref of [
      advanceTimerRef,
      advanceCeilingTimerRef,
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
      unmountedRef.current = true
      clearAllTimers()
      sparkleInstance.unload()
      poofInstance.unload()
      plinkInstance.unload()
      // Persist on unmount (same defensive write as Math).
      writeStardust(stardustTotalRef.current, storage, now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Diagnostic instrumentation (ticket 86c9hjnn8 follow-up) ------------

  /**
   * Mirror every change of the `audioReady` prop to the audioCtxLog.
   * See Math.tsx for the rationale.
   */
  useEffect(() => {
    recordAudioReadyStateEvent('wordSong', audioReady)
  }, [audioReady])

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

      // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). See
      // Math.tsx for the rationale.
      recordPlayUtteranceDispatchEvent('wordSong', getPlayerKind(playUtterance))

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

  // ── Audio-unlock gate-state mirror (ticket 86c9hf4ef) ------------------

  /**
   * Drive `audioUnlocked` from gate-state transitions. See Math.tsx for
   * the full rationale — mirrored shape. setState deferred to a
   * microtask to satisfy react-hooks/set-state-in-effect.
   */
  useEffect(() => {
    if (gate.state !== 'unlocked' || audioUnlocked) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setAudioUnlocked(true)
    })
    return () => {
      cancelled = true
    }
  }, [gate.state, audioUnlocked])

  // ── Problem reveal -----------------------------------------------------

  // Keep `problemIndexRef` in sync on every render so the read-aloud
  // effect's deferred `.then()` reads the latest value. Refs are written
  // here (post-render) rather than during render to satisfy the
  // "no ref mutation during render" lint guidance.
  useEffect(() => {
    problemIndexRef.current = problemIndex
  }, [problemIndex])

  /**
   * Fire the per-problem read-aloud. Two preconditions can authorise this:
   *
   *   1. `audioUnlocked` (local React state) is true.
   *   2. `getHowlerRunningFn()` returns `true` — Greet's wake-tap +
   *      heart-tap already unlocked Howler before WordSong mounted.
   *
   * See Math.tsx for the full rationale — mirrored shape. Tickets
   * 86c9hf4ef (round 1: cold-mount fast path) and 86c9hf4ef (round 2:
   * production cancelled-flag race fix; the .then() now bails on
   * unmount or problem-advance only, never on same-problem re-runs).
   *
   * After the read-aloud completes, flip `readAloudPlayed` so chips
   * become tappable. Closes the Session-2+ race (ticket 86c9guh4y).
   */
  useEffect(() => {
    if (guidedActive) return

    const howlerRunning = !audioUnlocked && getHowlerRunningFn()
    if (!audioUnlocked && !howlerRunning) return

    // Audio-ready gate (ticket 86c9hjnn8). When the parent passes
    // `audioReady={false}` (Path A fetch still in flight), wait — firing
    // now would walk the caption against `defaultPlayUtterance` and the
    // first problem would never play audibly. `undefined` preserves the
    // legacy "fire immediately" behaviour for callers that don't track
    // audio readiness. See Math.tsx for the long-form rationale.
    if (audioReady === false) return

    const problem = plan.problems[problemIndex]
    const myProblemIndex = problemIndex
    queueMicrotask(() => {
      if (unmountedRef.current) return
      if (problemIndexRef.current !== myProblemIndex) return
      // Synchronous double-speak latch (ticket 86c9hf4ef). Flips before
      // any setState/speak so that the re-render triggered by the
      // cold-mount fast path's `setAudioUnlocked(true)` cannot schedule
      // a second microtask that re-speaks the same line. See Math.tsx
      // for the long-form rationale.
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      // Mirror `audioUnlocked` inside the microtask so the setState lands
      // outside the effect body (react-hooks/set-state-in-effect).
      if (howlerRunning) setAudioUnlocked(true)
      void speak(problem.utterances.read).then(() => {
        // See Math.tsx for the bail-criteria rationale: unmount and
        // problem-advance only. Same-problem re-runs MUST resolve the
        // .then() so chips unlock. The previous closure-cancelled flag
        // bricked this in production (ticket 86c9hf4ef round 2).
        if (unmountedRef.current) return
        if (problemIndexRef.current !== myProblemIndex) return
        readAloudPlayedRef.current = true
        setReadAloudPlayed(true)
      })
    })
    // `audioReady` IS in the deps so the effect re-runs when the parent
    // flips it from `false` → `true` (Path A fetch settled). The
    // `spokeReadAloudRef` latch ensures a re-run after read-aloud fired
    // is a no-op. Ticket 86c9hjnn8 — see Math.tsx for the rationale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, audioUnlocked, audioReady])

  // ── Chip tap handler ---------------------------------------------------

  const advanceToNext = useCallback(() => {
    if (problemIndex < plan.problems.length - 1) {
      setProblemIndex((i) => i + 1)
      setProblemState(FRESH_PROBLEM_STATE)
      // Reset the synchronous gates alongside the React state reset —
      // otherwise the new problem's first taps would see the previous
      // problem's latched ref values (resolved=true / hintPlayed=true /
      // etc.) and short-circuit the reward + hint/guided dispatch paths.
      // Mirrors `FRESH_PROBLEM_STATE` field-for-field. The reprompt
      // in-flight lock also resets — it should only ever be true while a
      // reprompt is mid-await, but resetting defensively guards against
      // a worst-case advance that fires while a prior speak() hung.
      resolvedRef.current = false
      wrongCountRef.current = 0
      hintPlayedRef.current = false
      guidedPlayedRef.current = false
      repromptInFlightRef.current = false
      // Reset the read-aloud gate so chips are disabled until the next
      // problem's read-aloud completes. See ticket 86c9guh4y.
      readAloudPlayedRef.current = false
      setReadAloudPlayed(false)
      // Reset the synchronous double-speak latch so the next problem's
      // read-aloud effect can fire. See ticket 86c9hf4ef.
      spokeReadAloudRef.current = false
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
   * shake the chip, swap Emma to puzzled-tilt, fire SFX + reprompt utterance,
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

      setPose('puzzled-tilt')
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

      // Read + bump the wrong-count via the synchronous ref. The state
      // setter still fires for visual consistency, but the threshold
      // arithmetic must use the ref or 5 rapid taps on the same wrong
      // chip all see `wrongCount=0` from the captured closure and each
      // compute `nextWrongCount=1` — never crossing the hint/guided
      // thresholds, or all crossing them simultaneously on a later batch.
      // See `wrongCountRef` declaration (ticket 86c9gyb2v).
      const nextWrongCount = wrongCountRef.current + 1
      wrongCountRef.current = nextWrongCount
      setProblemState((prev) => ({ ...prev, wrongCount: nextWrongCount }))

      // Latch the hint/guided "scheduled" flags synchronously NOW —
      // before the reprompt promise resolves and before the 600ms hint
      // timer elapses — so the next rapid tap in the same gesture tick
      // (or any tap that lands during the pending hint timer window)
      // observes the latched flag and skips the duplicate-schedule path.
      //
      // The local `didScheduleHint` / `didScheduleGuided` snapshots
      // capture whether THIS specific tap is the one that crossed the
      // threshold (and therefore owns the dispatch). Subsequent rapid
      // taps recompute the threshold predicate too — but the ref read
      // (`!hintPlayedRef.current`) returns false on the second tap, so
      // they do not schedule the dispatch.
      //
      // The React state setters for `hintPlayed=true` / `guidedPlayed=true`
      // are still kicked downstream (visual consistency), but the gate
      // that prevents queuing reads the ref.
      const didScheduleHint =
        nextWrongCount === HINT_AFTER_WRONG_COUNT && !hintPlayedRef.current
      if (didScheduleHint) {
        hintPlayedRef.current = true
      }
      const didScheduleGuided =
        nextWrongCount >= GUIDED_AFTER_WRONG_COUNT && !guidedPlayedRef.current
      if (didScheduleGuided) {
        guidedPlayedRef.current = true
      }

      // In-flight reprompt lock — set BEFORE the speak() call, cleared in
      // .finally(). The .then() body reads it: if the lock has been
      // cleared between speak() and resolve() (only `advanceToNext`
      // clears it externally, on a problem-advance), the reprompt has
      // gone stale — the user advanced past this problem while the
      // reprompt was mid-air — and the hint/guided dispatch must NOT run
      // on the now-current (different) problem. The synchronous
      // ref-mirror gates above already deduplicate within a single
      // problem; the lock closes the cross-problem race that those gates
      // can't see. See ticket 86c9gyb2v (the shape difference vs Math
      // 86c9gy7ju / PR #74).
      repromptInFlightRef.current = true

      void speak(problem.utterances.reprompt)
        .then(() => {
          // Stale-resolve guard: if the lock was cleared while we were
          // awaiting (advanceToNext fired between speak() and resolve()),
          // bail. Without this, a hint/guided utterance for problem N
          // could fire while problem N+1 is on screen.
          if (!repromptInFlightRef.current) return

          // Return to idle pose unless this tap scheduled a hint/guided
          // line — in which case the next utterance owns the pose.
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
              poseTimerRef.current = setTimeout(() => {
                setPose('idle')
                poseTimerRef.current = null
              }, 0)
            })
          } else if (didScheduleHint) {
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
        .finally(() => {
          repromptInFlightRef.current = false
        })
    },
    // problemState.{wrongCount,hintPlayed,guidedPlayed} intentionally
    // omitted from deps — the gates read the synchronous refs instead.
    // See ref declarations for the rage-tap rationale (ticket 86c9gyb2v).
    [poofInstance, speak, streak],
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

      setPose('celebration')
      setCelebrating(true)
      setProblemState((prev) => ({ ...prev, resolved: true }))

      // Stardust + streak. Same rule as Math: stardust granted even after
      // 1-or-2 wrongs; ONLY the guided-completion path withholds it.
      //
      // Read from the synchronous refs (not React state). In normal play
      // the gates between wrong-then-correct span gestures and React has
      // committed prior state batches, so state would also work — but
      // the refs are the single source of truth for "what does the gate
      // see right now", and using them here keeps `handleCorrectTap`
      // symmetric with the wrong-tap latches above. See ticket 86c9gyb2v.
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
          }
        }
      }

      // Chain the auto-advance on max(min-dwell, speak.onend) with a hard
      // ceiling fallback. Mirrors Math.tsx — see ticket 86c9j60qr.
      minDwellElapsedRef.current = false
      correctSpeakResolvedRef.current = false
      advanceFiredRef.current = false

      const tryAdvance = () => {
        if (advanceFiredRef.current) return
        if (!minDwellElapsedRef.current || !correctSpeakResolvedRef.current) {
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
        correctSpeakResolvedRef.current = true
        poseTimerRef.current = setTimeout(() => {
          setPose('idle')
          poseTimerRef.current = null
        }, 0)
        tryAdvance()
      })

      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current)
      }
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        minDwellElapsedRef.current = true
        tryAdvance()
      }, ADVANCE_AFTER_CORRECT_MS)

      // Hard-ceiling fallback. See Math.tsx for the long rationale.
      if (advanceCeilingTimerRef.current !== null) {
        clearTimeout(advanceCeilingTimerRef.current)
      }
      advanceCeilingTimerRef.current = setTimeout(() => {
        advanceCeilingTimerRef.current = null
        if (advanceFiredRef.current) return
        advanceFiredRef.current = true
        if (advanceTimerRef.current !== null) {
          clearTimeout(advanceTimerRef.current)
          advanceTimerRef.current = null
        }
        setCelebrating(false)
        advanceToNext()
      }, ADVANCE_HARD_CEILING_MS)
    },
    // problemState.{wrongCount,guidedPlayed} intentionally omitted from
    // deps — the cleanWin computation reads the synchronous refs instead
    // (see `wrongCountRef` declaration; ticket 86c9gyb2v).
    [advanceToNext, grantStardust, plinkInstance, sparkleInstance, speak],
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
      const unlockResult = unlockAudioSessionFn()
      // Phase-8 (ticket 86c9gvd0y): thread the helper's
      // `howlerUnlockMethodCalled` outcome through.
      recordUnlockStateEvent({
        howlerUnlockMethodCalled: unlockResult?.howlerUnlockMethodCalled,
      })

      // First-tap audio unlock: the very first user gesture sets
      // `audioUnlocked` which triggers the read-aloud effect. We
      // return immediately WITHOUT dispatching the correct/wrong
      // handler — chips stay disabled until the read-aloud completes
      // and flips `readAloudPlayed`. This closes the Session-2+ race
      // where a chip tap could fire before the question was read aloud,
      // producing overlapping audio. See ticket 86c9guh4y.
      if (!audioUnlocked) {
        setAudioUnlocked(true)
        return
      }

      // Read-aloud gate: block taps until the per-problem read-aloud
      // has completed. The read-aloud effect flips this ref after
      // speak() resolves. See ticket 86c9guh4y.
      if (!readAloudPlayedRef.current) return

      // Block guided-completion path on non-correct chips.
      if (guidedActive && chipWord !== problem.target.word) return

      const isCorrect = chipWord === problem.target.word
      if (isCorrect) {
        handleCorrectTap(problem)
      } else {
        handleWrongTap(chipWord, problem)
      }
    },
    [
      audioUnlocked,
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
      data-read-aloud-played={readAloudPlayed ? 'true' : 'false'}
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
        {/* Mid-skill back-arrow — top-left, leads the HUD. Mirrored
            shape with Math.tsx; see `design/screen-hub.md`
            § "Mid-skill exit contract". Hidden when no
            `onRequestExit` handler is provided so existing direct-
            route WordSong tests render the same shape they always did. */}
        {onRequestExit && (
          <button
            type="button"
            data-testid="word-song-back-to-hub"
            aria-label="Back"
            onClick={() => {
              try {
                cancelSessionAudio()
              } catch {
                // Best-effort.
              }
              onRequestExit()
            }}
            className="
              flex items-center justify-center
              text-my-rose
              touch-manipulation select-none
            "
            style={{ width: '56pt', height: '56pt' }}
          >
            <svg
              viewBox="0 0 28 28"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 L9 14 L18 22" />
            </svg>
          </button>
        )}
        {/* Stardust counter — left */}
        <div
          data-testid="word-song-stardust"
          data-total={stardust.total}
          className="flex items-center gap-2 font-display text-3xl text-ink"
        >
          <m.span
            key={stardust.total}
            initial={{ scale: 1 }}
            animate={celebrating ? { scale: [1, 1.3, 1] } : { scale: 1 }}
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
                      ? [1, 1.3, 1]
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

      {/* Emma + ribbon row */}
      <div className="relative flex w-full items-start gap-4 px-4">
        {/* Emma — upper-left, ~26vh per spec (slightly smaller than
            Math's 30vh — see spec line 141).
            Celebration wiggle: on a correct tap (`pose === 'celebration'`)
            Emma plays a 600ms rotation keyframe wiggle so the celebration
            is visibly punchy on iPad even when the Path A audio path is
            the silent-but-captioned fallback. Skipped under
            prefers-reduced-motion; the static-pose cross-fade still reads.
            (The legacy ear-wiggle moniker pre-dated Emma — same animation,
            renamed semantics.) */}
        <AnimatePresence initial={false}>
          <m.img
            layoutId="emma"
            key={pose}
            data-testid="word-song-emma"
            data-pose={pose}
            data-wiggling={
              pose === 'celebration' && !reducedMotion ? 'true' : 'false'
            }
            src={`/assets/emma-${pose}.svg`}
            alt="Emma"
            draggable={false}
            className="h-[26vh] w-auto select-none origin-bottom"
            initial={{ opacity: 0, rotate: 0 }}
            animate={
              pose === 'celebration' && !reducedMotion
                ? { opacity: 1, rotate: [0, -8, 8, -5, 5, 0] }
                : { opacity: 1, rotate: 0 }
            }
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={
              pose === 'celebration' && !reducedMotion
                ? {
                    opacity: { duration: 0.2 },
                    rotate: {
                      duration: EAR_WIGGLE_MS / 1000,
                      ease: 'easeInOut',
                      times: [0, 0.2, 0.45, 0.65, 0.85, 1],
                    },
                  }
                : { duration: 0.2 }
            }
          />
        </AnimatePresence>

        {/* Caption ribbon — to Emma's right. Same word-by-word reveal
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
              disabled={
                problemState.resolved || dimForGuided || !readAloudPlayed
              }
              className={`
                relative flex select-none items-center justify-center
                rounded-2xl border-[3px] border-my-pink bg-white
                transition-opacity
                disabled:cursor-default
                touch-manipulation
                ${dimForGuided || !readAloudPlayed ? 'opacity-60' : 'opacity-100'}
                ${guidedShimmer ? 'shadow-[0_0_24px_rgba(244,143,177,0.85)]' : 'shadow-[0_4px_12px_rgba(244,143,177,0.18)]'}
              `}
              style={{
                width: '96px',
                height: '96px',
                minWidth: '60px',
                minHeight: '60px',
                cursor:
                  problemState.resolved || dimForGuided || !readAloudPlayed
                    ? 'default'
                    : 'pointer',
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
                  : {
                      scale: 1,
                      opacity: dimForGuided || !readAloudPlayed ? 0.6 : 1,
                      x: 0,
                      y: 0,
                    }
              }
              whileTap={
                problemState.resolved || dimForGuided || !readAloudPlayed
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

/** Sparkle burst — 6 particles. Diverged from Math's identical-shape
 *  helper per the UX bug ticket: particles travel 25% farther (75pt vs
 *  60pt) and the spring is tuned for a softer landing so the burst
 *  reads for ~850ms (≥800ms acceptance criterion) instead of Math's
 *  ~600ms. The total visible window still lands inside the 1200ms
 *  auto-advance budget. */
function SparkleBurst() {
  return (
    <span
      data-testid="word-song-sparkle-burst"
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2
        const dx = Math.cos(angle) * 75
        const dy = Math.sin(angle) * 75
        return (
          <m.span
            key={i}
            data-testid="word-song-sparkle-particle"
            className="absolute"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: 'tween',
              ease: 'easeOut',
              duration: SPARKLE_BURST_MS / 1000,
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
