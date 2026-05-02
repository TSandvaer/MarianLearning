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
import { EmmaCharacter } from '../../components/EmmaCharacter'
import { pickDistractors } from './distractors'
import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from '../_shared/stardust'
import {
  pickStaticSessionPlan,
  type MathSessionPlan,
  type MathProblem,
} from './sessionPlans'
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
 *   here to skip the chip sparkle burst on reduce, and snap Emma pose
 *   swaps without cross-fade — same reasons as Greet.
 */

// ── Constants ── Shared gameplay constants imported from _shared/gameplayConstants.
// Screen-specific constants remain inline below.

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
  /**
   * Optional: fires when Marian taps the mid-skill back-arrow. The
   * orchestrator routes back to Hub on this signal. Per
   * `design/screen-hub.md` § "Mid-skill exit contract", in-flight
   * Math progress is silently invalidated if she picks the OTHER
   * tree from Hub afterwards (recommendation (a) in the spec); the
   * stardust she earned per-problem is already preserved by
   * `stardust.v1` write moments.
   *
   * Bundled into the Hub-implementation PR per Q4=A
   * (Thomas-locked, 2026-04-28). Without this, Hub is reachable
   * only via Session-End — Marian would be trapped in a session if
   * she just wants to switch trees.
   */
  onRequestExit?: () => void
  /** Optional: override the session plan. Defaults to a hardcoded rotation
   *  via `pickStaticSessionPlan()` until Path A wires Claude into Math mount. */
  plan?: MathSessionPlan
  /** Optional: replace the audio playback function. Default no-ops the audio
   *  but still fires `onPlay` + word ticks at ~165 wpm so the caption ribbon
   *  reveals normally even without real TTS. */
  playUtterance?: PlayMathUtteranceFn
  /**
   * Optional: parent-driven gate for the cold-mount first read-aloud. When
   * present and `false`, the cold-mount fast path WAITS — it does not call
   * `speak()` on mount. When the prop flips to `true`, the effect re-runs
   * and the read-aloud fires.
   *
   * Why this exists (ticket 86c9hjnn8)
   * ----------------------------------
   * On cold mount Math fires the first read-aloud the moment Howler's ctx
   * is observed `'running'` — but at that moment the parent's
   * `prepareMathPathA` POST to `/api/claude` has not yet resolved, so
   * `playUtterance` is still the silent `defaultPlayUtterance`. The first
   * problem's "speak" walks the caption at 165 wpm in silence; once Path A
   * resolves several seconds later, the prop flips to the real player but
   * the synchronous `spokeReadAloudRef` latch has already fired, so the
   * line never plays audibly. Subsequent problems work because by then the
   * real prop is wired.
   *
   * Empirical: Thomas's 2026-04-27 iPad QA on production deploy `b6df65b`.
   * Caption renders correctly (proves speak() ran), no audio for problem 1,
   * chips become tappable after the silent fallback's 165-wpm walk
   * completes (~3 s), problem 2 onward reads aloud normally.
   *
   * The fix: parent (App.tsx) tracks `mathAudioReady` and only flips it to
   * `true` once `prepareMathPathA` settles (resolve OR reject — both
   * unblock; on reject we use the silent fallback intentionally). Math
   * waits for the flip before firing the first read-aloud.
   *
   * Backwards-compatible: when this prop is `undefined` (no value passed),
   * the cold-mount fast path fires immediately as it did pre-fix —
   * preserves every existing test that doesn't know about audio readiness.
   */
  audioReady?: boolean
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
  /**
   * Test seam: spy on the per-gesture iOS audio-session unlock added in
   * Phase 5 of ticket 86c9gvd0y. Defaults to the real
   * `unlockIosAudioSession` from `lib/audio/howlerContext`. Mirrors the
   * same seam on `Greet`. Production callers should never override this.
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
   * this. Tests inject a stub (returning `true`) to simulate the
   * Splash → Greet → Math cold-mount handoff where Greet's wake-tap +
   * heart-tap have already unlocked Howler before Math mounts.
   *
   * Provenance: ticket 86c9hf4ef. Kevin's PR #87 review flagged this
   * cold-mount path as a future concern; Thomas's iPad audioCtxLog from
   * 2026-04-27 confirmed it bites in the real Splash → Greet → Math flow.
   * Math's local `audioUnlocked` defaults to `false`, the read-aloud
   * effect short-circuits, `readAloudPlayed` never flips, chips stay
   * `disabled`, the screen is unreachable.
   */
  getHowlerRunning?: () => boolean
  /**
   * Test seam ONLY — pre-arms `audioUnlocked` and `readAloudPlayed` so the
   * chips render enabled on first paint and tests can `fireEvent.click`
   * without first having to bypass the `disabled` DOM attribute.
   *
   * Production must NEVER pass this. The Session-1 audio-unlock contract
   * (first chip tap unlocks audio + queues read-aloud; chips stay disabled
   * until read-aloud completes) is what ticket 86c9guh4y added in PR #83
   * to close the audio race; this seam exists purely so the unit-test
   * suite can assert behaviour AT and AFTER that point without trying to
   * dispatch click events on `<button disabled>` (which jsdom + React 19
   * silently swallow). See ticket 86c9guh4y test fix-forward.
   */
  __testInitiallyAudioUnlocked?: boolean
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

// Phase 3b (ticket 86c9jccp7): the inlined `MelodyPose = 'idle' | 'happy'
// | 'puzzled'` union has been replaced by the shared `EmmaPose` union in
// `lib/character/emmaPose`. Math currently exercises a subset
// (`idle | celebration | puzzled-tilt`); the broader pose space
// (`listening`, `attentive-pointing`, etc.) is wired in follow-up tickets.

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
 * The component is named `MathScreen` internally to avoid shadowing the
 * built-in `Math` global within this module — the file uses `Math.cos` /
 * `Math.PI` / `Math.floor` for layout math, and naming the React component
 * `Math` would hide the global. The default export keeps the screen-style
 * `Math` name for symmetry with `Greet` / `Splash` at call sites.
 */
function MathScreen({
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
}: MathProps) {
  const reducedMotion = usePrefersReducedMotion()

  // Bind the per-gesture audio-context resume kick. Defaults to the real
  // helper from `lib/audio/howlerContext`. See Greet.tsx for the shape
  // rationale (Phase-2 fix for ticket 86c9gvd0y).
  const resumeAudioCtx = resumeAudioContext ?? resumeHowlerContextOnGesture
  // Phase-5 (ticket 86c9gvd0y): per-gesture iOS audio-session unlock.
  // See Greet.tsx + howlerContext.ts for the rationale.
  const unlockAudioSessionFn = unlockAudioSession ?? unlockIosAudioSession
  // Ticket 86c9hf4ef: detect "Howler already unlocked by a previous screen's
  // gesture" so the read-aloud effect can fire on cold mount even when
  // Math's local `audioUnlocked` defaults to false. Production reads the
  // real `Howler.ctx`; tests inject a stub.
  const getHowlerRunningFn = getHowlerRunning ?? readHowlerContextRunning

  // Plan re-derives whenever `planProp` flips — critical for the Path A
  // race (ticket 86c9jteud): App.tsx mounts Math with the static fallback
  // plan, fires `prepareMathPathA()`, and once that resolves swaps the prop
  // to the server-derived plan. If we captured `plan` once at mount the
  // screen would stick on the static plan AND every `playUtterance(text)`
  // lookup would miss the server-rendered audio (textToId is keyed on the
  // Haiku-rendered text). We exclude `now` from the deps because (a) the
  // static fallback is deterministic per-minute so re-rolling on a same-
  // minute `now` ref-change is pointless, (b) once `planProp` is non-null
  // (the production case after fetch settles), `now` is unused. The
  // parent's `key="math"` on the AnimatePresence child guarantees a fresh
  // mount on track-change, so we can't leak a plan across screens. Within
  // a stable `planProp`, the value is referentially stable thanks to
  // `useMemo` — downstream `useMemo`/effect deps that key on `plan` keep
  // working.
  const plan = useMemo<MathSessionPlan>(
    () => planProp ?? pickStaticSessionPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
    [planProp],
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
   * See ticket 86c9gy4mf.
   */
  const resolvedRef = useRef(false)

  /**
   * Always-fresh mirrors of `problemState.{wrongCount,hintPlayed,guidedPlayed}`.
   * Same closure-stale risk as `resolvedRef` (above) but on the wrong-tap
   * path: 5 rapid taps on the SAME wrong chip all capture the pre-batch
   * `wrongCount=0` / `hintPlayed=false` / `guidedPlayed=false` and each
   * compute `nextWrongCount=1`, then on subsequent renders cross the
   * hint/guided thresholds together — queueing duplicate hint utterances
   * and duplicate guided-completion entries even though the existing
   * `!hintPlayed` / `!guidedPlayed` guards absorb most damage.
   *
   * Refs are flipped synchronously inside `handleWrongTap` BEFORE any
   * `speak()` schedule or `setTimeout` callback, so the very next tap in
   * the same gesture tick sees the updated counter and the latched
   * hint/guided flags and bails out of the duplicate-side-effect path.
   *
   * Visual rendering (the chip `disabled` state, the guided-completion
   * dimming, the data-* attributes) continues to derive from React
   * `problemState`. Only the synchronous gates inside the handlers read
   * the refs. See ticket 86c9gy7ju (mirrors the PR #66 pattern for
   * `resolvedRef`).
   */
  const wrongCountRef = useRef(0)
  const hintPlayedRef = useRef(false)
  const guidedPlayedRef = useRef(false)

  /** Streak of consecutive clean wins (correct-on-first-tap). */
  const [streak, setStreak] = useState(0)
  /** Always-fresh mirror of `streak` — same reasoning as `stardustTotalRef`.
   *  The auto-advance timer for problem 8 reads the final streak value to
   *  pass into `onSessionComplete`; without the ref it captures stale state. */
  const streakRef = useRef(0)

  /** Total clean-correct answers; used for the session-complete callback. */
  const totalCorrectRef = useRef(0)

  /** True while the screen is in the "first tap unlocks audio" window —
   *  we keep this one-shot so we don't kick the unlock gate on every chip tap.
   *
   *  Test seam: when `__testInitiallyAudioUnlocked` is set, this starts true
   *  so chips render tappable from first paint. See `MathProps` doc. */
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
   * Synchronous "we already kicked off speak() for this problem" latch.
   * Flipped to `true` inside the read-aloud microtask BEFORE the `speak()`
   * call. Reset to `false` on every problem advance.
   *
   * Why this exists (ticket 86c9hf4ef, Kevin's review of PR #88):
   * The cold-mount effect's deps are `[problemIndex, audioUnlocked]`.
   * On cold mount Run 1 sees `audioUnlocked=false` + `howlerRunning=true`,
   * schedules a microtask, and inside that microtask flips
   * `setAudioUnlocked(true)` and calls `speak()`. The state change triggers
   * a re-render → effect Run 2 sees `audioUnlocked=true`, evaluates
   * `!audioUnlocked && !howlerRunning` as `false && (whatever) = false`,
   * does NOT early-return, schedules a SECOND microtask, calls `speak()`
   * AGAIN. `readAloudPlayedRef` doesn't catch it because it only flips
   * after the first `speak().then(...)` resolves — the second microtask
   * fires before that promise settles.
   *
   * The latch fixes this by being purely synchronous: the moment Run 1's
   * microtask starts, it flips the ref. Run 2's microtask checks the ref
   * first and bails. No double-speak.
   */
  const spokeReadAloudRef = useRef(__testInitiallyAudioUnlocked)

  /** Emma's current pose. Driven by tap outcomes + the auto-return timer. */
  const [pose, setPose] = useState<EmmaPose>('idle')

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
  const advanceCeilingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streakFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Synchronous gates for the chained advance after a correct answer.
   *
   * The advance is gated on `max(ADVANCE_AFTER_CORRECT_MS, speak.onend)`
   * so the celebration audio is always heard in full while the visual
   * cadence stays predictable. A separate hard-ceiling timer at
   * `ADVANCE_HARD_CEILING_MS` is the "audio engine wedged" escape valve;
   * if either it OR (minDwell AND speakResolved) trips, the advance fires.
   *
   * Provenance: ticket 86c9j60qr. Pre-fix `setTimeout(..., 1200)` cut
   * Emma's longer renders; the advance was never gated on speak's onend.
   */
  const minDwellElapsedRef = useRef(false)
  const correctSpeakResolvedRef = useRef(false)
  /** True once the auto-advance has actually been dispatched for this
   *  correct answer. Prevents a double-fire when both gates flip in the
   *  same tick (e.g. min-dwell timer firing exactly when speak resolves).
   *  Reset alongside the gate refs in `advanceToNext`. */
  const advanceFiredRef = useRef(false)

  /**
   * Unmount latch for the read-aloud `.then()` resolution path. Set to
   * `true` inside the lifetime cleanup effect; the read-aloud effect's
   * deferred `.then()` reads this to bail before calling
   * `setReadAloudPlayed(true)` on an unmounted component.
   *
   * Replaces the per-effect-run `let cancelled = false` closure-flag the
   * read-aloud effect previously used. That flag was the actual production
   * bug surfaced by Thomas's 2026-04-27 iPad capture (ticket 86c9hf4ef
   * round 2): on cold mount the read-aloud microtask flips
   * `setAudioUnlocked(true)`, the resulting React commit re-runs the
   * effect, the previous run's cleanup sets `cancelled = true`, and when
   * `speak()` finally resolves seconds later the `.then()` sees the
   * stale `cancelled=true` and skips the `setReadAloudPlayed(true)` call
   * that unlocks chips. Tests passed because the test `playUtterance`
   * harness resolves the speak() promise on a single microtask — too fast
   * for React to commit the audioUnlocked flip and run the cleanup
   * before the .then() fires. Production audio takes seconds to resolve,
   * so the cancel-vs-then race always lost.
   */
  const unmountedRef = useRef(false)

  /**
   * Always-fresh mirror of `problemIndex` for the read-aloud `.then()`'s
   * "are we still on the same problem?" check. The read-aloud effect's
   * `.then()` callback runs after `speak()` resolves (potentially seconds
   * later in production). If the user has advanced to the next problem in
   * the meantime, the new problem's read-aloud effect owns its own
   * `setReadAloudPlayed(true)` call; the old `.then()` must NOT stomp it.
   * Capturing `myProblemIndex` at effect-run time and comparing against
   * this ref at .then-time keeps stale resolutions from leaking forward.
   * Updated synchronously inside the effect body each run.
   */
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
      // Persist any stardust earned this session — defensive in case the
      // session ends via unmount (e.g. parent-driven route change) before
      // we run the explicit on-complete write. Read from the ref so we
      // see grants that React hasn't committed to state yet.
      writeStardust(stardustTotalRef.current, storage, now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Diagnostic instrumentation (ticket 86c9hjnn8 follow-up) ------------

  /**
   * Mirror every change of the `audioReady` prop to the audioCtxLog so
   * the iPad export shows whether Math saw the parent flip the gate to
   * `true` for the screen the user sat on. Includes the very first
   * render's value (mount push) — that's the load-bearing case for
   * cold-mount diagnosis.
   *
   * No production cost: `recordAudioReadyStateEvent` short-circuits
   * with a single null-check when no debug probe is active.
   */
  useEffect(() => {
    recordAudioReadyStateEvent('math', audioReady)
  }, [audioReady])

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

      // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). Records
      // whether the function we're about to invoke is the real Path A
      // player or the silent fallback. The audioCtxLog row pairs by
      // timestamp with the next `howl-play-call` (real path) or with
      // a silent-walk caption tick (fallback path).
      recordPlayUtteranceDispatchEvent('math', getPlayerKind(playUtterance))

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

  // ── Audio-unlock gate-state mirror (ticket 86c9hf4ef) ------------------

  /**
   * Drive `audioUnlocked` from gate-state transitions. When the gate
   * reaches `'unlocked'` (the gate's `runSpeak` callback's `onPlay`
   * observed a successful audio start), flip `audioUnlocked` to `true`
   * so the rest of the screen (chip tappability, subsequent renders)
   * stays consistent with the gate.
   *
   * On cold-mount Math after Greet has already unlocked Howler, this
   * effect is a no-op (the gate stays `idle` because Math's own
   * `runSpeak` hasn't fired yet — that's what the read-aloud effect
   * below kicks off via the Howler-running fast path). But once the
   * read-aloud effect calls `speak()`, the gate transitions to `pending`
   * and then `unlocked` on `onPlay`, and this effect catches the second
   * transition to keep state consistent.
   *
   * Provenance: ticket 86c9hf4ef Option-3 fix from Kevin's PR #87 review.
   *
   * The setState is deferred to a microtask to satisfy
   * react-hooks/set-state-in-effect — same pattern as the read-aloud
   * effect below (and Greet's first-line effect).
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

  // ── Problem reveal: speak the read-aloud line on each problem entry ---

  /**
   * Fire the per-problem read-aloud. Two preconditions can authorise this:
   *
   *   1. `audioUnlocked` (local React state) is true. Set by a chip tap
   *      on Math itself (Session-2+ entry path) or by the gate-state
   *      mirror effect above when `gate.state === 'unlocked'`.
   *
   *   2. `getHowlerRunningFn()` returns `true` — meaning a previous
   *      screen's gesture (Greet's wake-tap or heart-tap) already
   *      unlocked Howler's `AudioContext` before Math mounted. This is
   *      the cold-mount real-flow path (Splash → Greet → Math). On
   *      this path Math's `audioUnlocked` starts `false` and the gate
   *      starts `idle`; without this branch the read-aloud effect
   *      would never fire and chips would stay `disabled` forever.
   *      See ticket 86c9hf4ef.
   *
   * When the Howler-running branch fires, we synchronously flip
   * `audioUnlocked` to `true` inside the effect so subsequent gestures
   * on this screen behave the same as if Math's own first-tap had been
   * the unlocker — chip-tap path skips the `if (!audioUnlocked)` early
   * return, the gate-state mirror sees a consistent picture, etc.
   *
   * After the read-aloud completes, flip `readAloudPlayed` so chips
   * become tappable. This closes the Session-2+ race where a chip tap
   * could fire before the question was read. See ticket 86c9guh4y.
   */
  // Keep `problemIndexRef` in sync on every render so the read-aloud
  // effect's deferred `.then()` reads the latest value. Refs are written
  // here (post-render) rather than during render to satisfy the standard
  // "no ref mutation during render" lint guidance.
  useEffect(() => {
    problemIndexRef.current = problemIndex
  }, [problemIndex])

  useEffect(() => {
    if (guidedActive) return // mid-guided playback owns the audio

    // Cold-mount fast path: Howler already unlocked by a previous screen's
    // gesture. Drive the read-aloud now; mirror `audioUnlocked` for
    // downstream consistency. We check this BEFORE the audioUnlocked
    // short-circuit because on cold mount audioUnlocked is false but
    // Howler is running — that's the exact case the bug was hiding.
    const howlerRunning = !audioUnlocked && getHowlerRunningFn()
    if (!audioUnlocked && !howlerRunning) return

    // Audio-ready gate (ticket 86c9hjnn8). When the parent passes
    // `audioReady={false}` (Path A fetch still in flight), wait — firing
    // the read-aloud now would walk the caption against the silent
    // `defaultPlayUtterance` and the first problem would never play
    // audibly. Once App.tsx flips the prop to `true` (fetch settled,
    // resolve OR reject), this effect re-runs and the read-aloud fires
    // against whatever `playUtterance` is bound at that moment.
    //
    // `undefined` (no prop passed by the caller) is treated as "not
    // applicable, fire immediately" — preserves backwards compatibility
    // with every existing test/caller that pre-dates this gate. Production
    // App.tsx always passes a boolean.
    if (audioReady === false) return

    const problem = plan.problems[problemIndex]
    // Capture the problem index this effect run owns. The deferred
    // `.then()` below compares against `problemIndexRef.current` to bail
    // if Marian has advanced to a new problem before the speak() resolved
    // — the new problem's effect run owns its own setReadAloudPlayed.
    const myProblemIndex = problemIndex

    // Defer to a microtask so the setState calls (audioUnlocked mirror,
    // and the caption setStates inside `speak`) don't fire synchronously
    // inside the effect body — satisfies react-hooks/set-state-in-effect
    // and matches the React recommendation for "kick off async work from
    // an effect".
    queueMicrotask(() => {
      if (unmountedRef.current) return
      // If Marian has already advanced past the problem this run was
      // scheduled for, skip — the new problem's effect owns its own
      // read-aloud. Same-problem re-runs (e.g. from the cold-mount
      // audioUnlocked flip below) fall through to the
      // `spokeReadAloudRef` latch, which absorbs them.
      if (problemIndexRef.current !== myProblemIndex) return
      // Synchronous double-speak latch (ticket 86c9hf4ef). Must flip
      // BEFORE `speak()` is called and BEFORE any setState — when the
      // cold-mount fast path triggers `setAudioUnlocked(true)`, the
      // resulting re-render re-runs this effect; the second microtask
      // sees the ref and bails here. `readAloudPlayedRef` cannot serve
      // this role because it only flips after `speak()` resolves.
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      // Mirror `audioUnlocked` for downstream consistency BEFORE the
      // first speak() resolves. The chip-tap path's `if (!audioUnlocked)`
      // early-return reads this; flipping it now means a chip tap that
      // arrives mid-read-aloud falls through to the
      // `!readAloudPlayedRef.current` gate (correct behaviour) rather
      // than re-firing the unlock branch.
      if (howlerRunning) setAudioUnlocked(true)
      void speak(problem.utterances.read).then(() => {
        // Bail ONLY if the component unmounted, or we've moved on to a
        // new problem (the new problem's read-aloud owns
        // `setReadAloudPlayed`). Do NOT bail just because the effect
        // re-ran for the same problem — that's exactly the cancelled-flag
        // race the production bug fix removed (ticket 86c9hf4ef round 2).
        if (unmountedRef.current) return
        if (problemIndexRef.current !== myProblemIndex) return
        readAloudPlayedRef.current = true
        setReadAloudPlayed(true)
      })
    })
    // We don't include `speak` because it's stable enough — and including
    // it would re-trigger on every render that touches `gate`, which would
    // re-speak the line repeatedly. `getHowlerRunningFn` is also omitted —
    // it's the test seam binding, stable per mount.
    //
    // `audioReady` IS in the deps so the effect re-runs when the parent
    // flips it from `false` → `true` (Path A fetch settled). The
    // `spokeReadAloudRef` latch ensures that a re-run after the read-aloud
    // already fired is a no-op.
    //
    // No cleanup function: the previous version's `let cancelled = false`
    // / cleanup `cancelled = true` pair was load-bearing for two cases:
    //   (a) component unmount — now handled by `unmountedRef`.
    //   (b) effect re-run on the same problem (e.g. audioUnlocked flip) —
    //       previously bailed the .then(); but the .then() RESOLVING is
    //       what unlocks chips, and bailing it on a same-problem re-run
    //       is what bricked Math on cold mount in production. The
    //       `spokeReadAloudRef` latch already prevents double-speak; we
    //       want the speak() promise's .then() to ALWAYS run for the
    //       problem it owns. The `myProblemIndex` capture handles the
    //       advance-past-it case.
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
      // Mirrors `FRESH_PROBLEM_STATE` field-for-field.
      resolvedRef.current = false
      wrongCountRef.current = 0
      hintPlayedRef.current = false
      guidedPlayedRef.current = false
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
   * shake the chip, swap Emma to puzzled-tilt, fire SFX + reprompt utterance,
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

      setPose('puzzled-tilt')
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

      // Read + bump the wrong-count via the synchronous ref. The state
      // setter still fires for visual consistency, but the threshold
      // arithmetic must use the ref or 5 rapid taps on the same wrong
      // chip all see `wrongCount=0` from the captured closure and each
      // compute `nextWrongCount=1` — never crossing the hint/guided
      // thresholds, or all crossing them simultaneously on a later batch.
      // See `wrongCountRef` declaration (ticket 86c9gy7ju).
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

      void speak(problem.utterances.reprompt).then(() => {
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
          // Speak the give-answer line; on completion the correct chip is
          // the only tappable one (per spec, all others dim to 0.6 and
          // become non-interactive).
          void speak(problem.utterances.giveAnswer).then(() => {
            poseTimerRef.current = setTimeout(() => {
              setPose('idle')
              poseTimerRef.current = null
            }, 0)
          })
        } else if (didScheduleHint) {
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
    // problemState.{wrongCount,hintPlayed,guidedPlayed} intentionally
    // omitted from deps — the gates read the synchronous refs instead.
    // See ref declarations for the rage-tap rationale (ticket 86c9gy7ju).
    [poofInstance, speak, streak],
  )

  /**
   * Handle a correct tap. Sequenced per spec §Audio dispatch (correct path):
   * celebration pose, sparkle + plink SFX, grant stardust (unless this is
   * the guided-completion flow), update streak, schedule auto-advance.
   */
  const handleCorrectTap = useCallback(
    (problem: MathProblem) => {
      sparkleInstance.play()
      plinkInstance.play()

      setPose('celebration')
      setCelebrating(true)
      // Flip the synchronous ref FIRST — before any grant or streak
      // update — so any same-tick re-entry from a rapid second tap on
      // the correct chip bails at the `onChipTap` gate. React state
      // batching means `setProblemState` below won't be visible until
      // the next render; the ref is the only thing that protects the
      // reward path from compounding.
      resolvedRef.current = true
      setProblemState((prev) => ({ ...prev, resolved: true }))

      // Stardust + streak. Spec line 162-164: stardust is awarded even after
      // 1-or-2 wrongs; ONLY the guided-completion path withholds it.
      // Streak is "consecutive CLEAN wins" — any prior wrong taps reset
      // streak to 0 already, so we only ++ on a clean problem.
      //
      // Read from the synchronous refs (not React state). In normal play
      // the gates between wrong-then-correct span gestures and React has
      // committed prior state batches, so state would also work — but
      // the refs are the single source of truth for "what does the gate
      // see right now", and using them here keeps `handleCorrectTap`
      // symmetric with the wrong-tap latches above. See ticket 86c9gy7ju.
      const isCleanWin = wrongCountRef.current === 0 && !guidedPlayedRef.current
      if (!guidedPlayedRef.current) {
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

      // Speak the celebration utterance, then chain the auto-advance on
      // BOTH the minimum dwell timer AND the speak() resolution. Whichever
      // is later wins — `max(animationDuration, audioDuration)`. A hard
      // ceiling timer fires the advance unconditionally if speak() never
      // resolves (audio engine wedged, blob fetch hung, etc.). See
      // ticket 86c9j60qr for the empirical evidence.
      //
      // Reset the gate refs synchronously here so a re-entrant correct tap
      // (rage-tap protection notwithstanding) sees a clean slate. The
      // `advanceFiredRef` latch makes `tryAdvance` idempotent.
      minDwellElapsedRef.current = false
      correctSpeakResolvedRef.current = false
      advanceFiredRef.current = false

      const tryAdvance = () => {
        if (advanceFiredRef.current) return
        if (!minDwellElapsedRef.current || !correctSpeakResolvedRef.current) {
          return
        }
        advanceFiredRef.current = true
        // Clear the hard-ceiling timer — we're advancing on the normal path.
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

      // Hard-ceiling fallback. If `speak()` never resolves (rare but
      // observed in PR #88/#89's chip-lock saga — ticket 86c9hf4ef round
      // 2), force the advance so the screen never bricks. The `advanceFiredRef`
      // latch absorbs the case where this fires concurrently with a
      // late-arriving onend.
      if (advanceCeilingTimerRef.current !== null) {
        clearTimeout(advanceCeilingTimerRef.current)
      }
      advanceCeilingTimerRef.current = setTimeout(() => {
        advanceCeilingTimerRef.current = null
        if (advanceFiredRef.current) return
        advanceFiredRef.current = true
        // Clear the (likely already-fired) min-dwell timer for tidiness.
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
    // (see `wrongCountRef` declaration; ticket 86c9gy7ju).
    [advanceToNext, grantStardust, plinkInstance, sparkleInstance, speak],
  )

  const onChipTap = useCallback(
    (chipValue: number) => {
      const problem = plan.problems[problemIndex]
      // Read the synchronous ref, NOT React state. See `resolvedRef`
      // declaration for the rage-tap rationale (ticket 86c9gy4mf).
      if (resolvedRef.current) return

      // Phase-6 instrumentation: pre-call snapshot of Howler's flags
      // inside the chip-tap gesture window. Pairs with the post-call row
      // below; the iPad export shows pool=N → pool=10 across the helper.
      recordUnlockStateEvent()
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
      // Phase-5 fix for ticket 86c9gvd0y. Re-engage the OS-level iOS
      // audio session by playing a 1-sample silent buffer in the
      // gesture window. AudioContext.state being `running` is necessary
      // but not sufficient on iOS — after >60s of audio idle iOS
      // releases the OS audio session even while WebAudio's context
      // stays running, and Howler caches its own `_audioUnlocked` flag
      // so won't re-run its scratch-buffer trick. We play a 1-sample
      // silent buffer in this gesture handler to re-engage the OS
      // audio session every chip-tap. See `lib/audio/howlerContext.ts`
      // → `unlockIosAudioSession` for the full rationale. Phase-6
      // extension: this also refills `Howler._html5AudioPool`
      // synchronously inside the gesture (see howlerContext.ts).
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
      if (guidedActive && chipValue !== problem.correct) return

      const isCorrect = chipValue === problem.correct
      if (isCorrect) {
        handleCorrectTap(problem)
      } else {
        handleWrongTap(chipValue, problem)
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
      // resolvedRef.current synchronously instead. See ticket 86c9gy4mf.
      resumeAudioCtx,
      unlockAudioSessionFn,
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
      data-read-aloud-played={readAloudPlayed ? 'true' : 'false'}
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
        {/* Mid-skill back-arrow — top-left, leads the HUD. 28pt visible
            glyph in a 56pt expanded touch zone (per design/screen-hub.md
            § "Mid-skill exit contract"). Hidden when no `onRequestExit`
            handler is provided so existing direct-route Math tests
            (no Hub) render the same shape they always did. */}
        {onRequestExit && (
          <button
            type="button"
            data-testid="math-back-to-hub"
            aria-label="Back"
            onClick={() => {
              // Cancel any in-flight TTS so the next screen doesn't
              // hear bleed. Mirrors the Greet → Math handoff cleanup.
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

      {/* Emma + ribbon row */}
      <div className="relative flex w-full items-start gap-4 px-4">
        {/* Emma — upper-left.
            Phase 3b motion brief (ticket 86c9kwvza): pose swaps now go
            through `EmmaCharacter`, which carries the rotateZ tilt
            spring (+breathing on idle) per `design/character/motion-
            brief.md` §3.2-§3.5. Reduce-motion is honoured via the
            shared component. */}
        <EmmaCharacter
          pose={pose}
          layoutId="emma"
          data-testid="math-emma"
          className="h-[26vh] w-auto select-none"
        />

        {/* Caption ribbon — to Emma's right. Same word-by-word reveal
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
              disabled={
                problemState.resolved || dimForGuided || !readAloudPlayed
              }
              className={`
                relative flex select-none items-center justify-center
                rounded-3xl border-[3px] border-my-pink bg-white
                font-display text-5xl text-ink
                transition-opacity
                disabled:cursor-default
                touch-manipulation
                ${dimForGuided || !readAloudPlayed ? 'opacity-60' : 'opacity-100'}
                ${guidedShimmer ? 'shadow-[0_0_24px_rgba(244,143,177,0.85)]' : 'shadow-[0_4px_12px_rgba(244,143,177,0.18)]'}
              `}
              style={{
                width: '120px',
                height: '120px',
                minWidth: '60px',
                minHeight: '60px',
                cursor:
                  problemState.resolved || dimForGuided || !readAloudPlayed
                    ? 'default'
                    : 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={
                isShaking
                  ? reducedMotion
                    ? { scale: 1, opacity: [1, 0.7, 1] }
                    : { x: [0, -6, 6, -4, 4, 0], scale: 1, opacity: 1 }
                  : {
                      scale: 1,
                      opacity: dimForGuided || !readAloudPlayed ? 0.6 : 1,
                      x: 0,
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
