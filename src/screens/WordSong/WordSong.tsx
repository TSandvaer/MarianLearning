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
import { drainOnGesture } from '../../lib/audio/pendingResumeGate'
import {
  recordAudioReadyStateEvent,
  recordPlayUtteranceDispatchEvent,
  recordUnlockStateEvent,
} from '../../lib/debug/audioContextProbe'
import { getPlayerKind } from '../../lib/debug/playerKind'
import { createSfx, type Sfx } from '../../lib/sfx'
import type { EmmaPose } from '../../lib/character/emmaPose'
import { EmmaCharacter } from '../../components/EmmaCharacter'
import { pickDistractors } from './wordDistractors'
import { buildBlendHighlightSteps } from './blendHighlight'
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
import { ScenePanel } from './scenePictures'
import type { WordEntry } from './wordPack'
import { LETTER_SOUNDS_POOL } from './letterSoundsPool'
import type { SkillLevel } from '../../lib/progress'

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

/**
 * Silent-text window for `cvc-word` problems (ticket 86c9m3ae6).
 *
 * On a `cvc-word` problem mount the word text renders immediately, but
 * Emma's read-aloud is delayed by this many milliseconds. The intent is
 * to preserve a decoding opportunity: Marian sees "cat" silently, has
 * a beat to sound it out, THEN hears Emma read the line. Without this
 * window, hearing the word converts the phonics task into a listening
 * task (Dave's developmental review on PR #135 / PR #139).
 *
 * Scope: applies ONLY to `cvc-word` content (the "Read the X." template).
 * `blending-cv` problems ("Tap the X.") fire audio immediately as before
 * — that flow is recognise-by-name and doesn't benefit from a silent
 * decode beat.
 *
 * Reduced-motion: `prefers-reduced-motion: reduce` does NOT skip this
 * window. The silent beat is a *cognitive* affordance (decoding time),
 * not a motion affordance. Skipping it for reduced-motion users would
 * degrade the phonics value of the screen for the population the setting
 * targets (vestibular sensitivity), which has no relation to phonics
 * decoding speed. Document-here choice; revisit if user research surfaces
 * a different signal.
 *
 * Visibility: if the page is hidden when the window elapses, fire the
 * read-aloud on the next `visibilitychange → visible`. Same `unmount /
 * problem-advance / spokeReadAloudRef` guards apply, so a re-arm cannot
 * double-fire. The simpler "check at window-end" pattern was preferred
 * over a tick-by-tick pause/resume — the silent window is short (1.5s)
 * and the round-trip via the visibility listener is functionally
 * indistinguishable to a user.
 *
 * Tuning: 1500ms is the starting value per Thomas's brief; iterate via
 * iPad ear-test if the beat reads as too short or too long.
 */
const SILENT_TEXT_WINDOW_MS = 1500

// ── Public types ----------------------------------------------------------

/** Shape the screen invokes when problem 8 finishes. Per spec §"Transition
 *  out (session end, problem 8 complete)" — emits an
 *  `onSessionComplete({ ... surface: 'word-song' })` callback. */
export interface WordSongSessionResult {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  /**
   * Stardust _earned in this session by Marian's chip-tap activity_, not
   * the all-time persisted total. Per ticket 86c9kwvza this is always `0`
   * for word-song now: per-correct grants were removed, and the flat
   * completion bonus (+5) is granted later, inside SessionEnd's mount
   * effect via `grantWordSongCompletionBonus`. The field is retained for
   * payload-shape symmetry with Math (which still grants per-correct).
   */
  earnedThisSession: number
  /** Surface tag — distinguishes Word Song from Math at the session-end
   *  consumer level (per spec line 540). */
  surface: 'word-song'
  /**
   * Per-problem outcome — `true` if Marian got the problem correct
   * without a 3-strike give-answer (same definition `totalCorrect`
   * counts). Length always 8.
   *
   * Added 2026-05-02 for the cvc-words graduation gate (ticket
   * 86c9m3aec). SessionEnd cross-references this against
   * `targetWords` to compute the canonical/novel split for a
   * graduation-session entry.
   *
   * Optional on the public type for back-compat with hand-built
   * test fixtures; the live screen always sets it.
   *
   * Per-screen semantic asymmetry (see `src/lib/progress/types.ts`
   * "DESIGN NOTE" near `SessionHistoryEntry`)
   * --------------------------------------------------------------
   * WordSong: **ever-correct**. The write happens inside
   * `handleCorrectTap`, AFTER the wrong-tap path has already had a
   * chance to fire. Wrong-then-correct retries record `true` because
   * the latch fires on the correct resolution, not on the first tap.
   * Pedagogically intentional: word-song's role is decoding practice
   * and re-encouragement, so the graduation accounting via
   * `computeGraduationSplit` credits any eventual correct.
   *
   * Math's same-named `perProblemCorrect` field is written with
   * **first-tap** semantics (in `onChipTap`'s `firstTapRecordedRef`
   * latch). The two payloads land on the same
   * `SessionEndPayload.perProblemCorrect` field; only the
   * surface-gated consumers (`buildLeitnerOutcomes` for math,
   * `computeGraduationSplit` for word-song) make this safe today.
   * DO NOT refactor the write-point without reading the design note
   * in `types.ts`.
   */
  perProblemCorrect?: readonly boolean[]
  /**
   * Target word per problem (lowercase, length always 8). Mirrors
   * `plan.problems[i].target.word`. Same back-compat caveat as
   * `perProblemCorrect`.
   *
   * Added for the graduation gate (ticket 86c9m3aec) — SessionEnd
   * detects which problems used novel-pool words by intersecting
   * this list with `WORD_SONG_NOVEL_PROBE_WORDS`.
   */
  targetWords?: readonly string[]
  /**
   * Per-problem FIRST-tap chip word, indexed 0..N-1 (parallel to
   * `plan.problems`). Records the literal word string Marian tapped
   * on her FIRST chip-tap for each problem, regardless of correctness.
   * `null` when no chip was ever tapped on that problem (e.g. session
   * abandoned, or guided-completion give-answer path completed
   * without a tap).
   *
   * Length matches `plan.problems.length`. Subsequent retry taps
   * within the same problem are NOT captured (mirrors the once-per-
   * problem latch used by `perProblemCorrect`).
   *
   * Added 2026-05-21 for surface parity with
   * `MathSessionResult.perProblemAnswerValue` (Kevin schema-first PR
   * pairing with Dave's PR #284 two-digit add/sub research). No
   * current word-song consumer; plumbed so future word-song error-
   * pattern classification (e.g. mid-vowel substitution, onset/coda
   * substitution) can build on accumulated history.
   *
   * Optional on the public type for back-compat with hand-built test
   * fixtures predating this PR; the live screen always sets it.
   */
  perProblemAnswerWord?: readonly (string | null)[]
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
  /**
   * Cross-vowel distractor mix mode (ticket 86c9qa0kf — cross-vowel mix
   * v1 impl). When `true`, every `pickDistractors` call in the session
   * threads `{ crossVowel: true }` and reads from
   * `TARGET_PAIRINGS_CROSSVOWEL` instead of the same-vowel
   * `TARGET_PAIRINGS`. The session is uniformly cross-vowel or uniformly
   * same-vowel — never half-and-half (per `cross-vowel-mix-spec.md` §4).
   *
   * Default: `false` (same-vowel only — back-compat).
   *
   * The parent (`App.tsx`) computes this once at session-start by
   * calling `crossVowelMixingActive(progress, parentSettings)` from
   * `lib/progress`. The predicate gates on (a) all three CVC tiers
   * `'mastered'`, (b) `parentSettings.crossVowelMixingEnabled === true`.
   * The CVC-tier-focus check (the third gate per spec §2) is the
   * caller's responsibility — App.tsx only passes `true` when the
   * focus is one of `cvc-words`, `cvc-words-short-o`,
   * `cvc-words-short-u`.
   */
  crossVowelMixing?: boolean
  /**
   * Skill level of the `digraphs-th-voiceless` node at session-start
   * (spec #231). Used to decide whether to show the `emma-th-mouth.svg`
   * mouth-cue:
   *   - `'intro'` | `'practicing'` → Placement B corner cue visible.
   *   - `'intro'` + `digraphsThFirstEncounter` → Placement A panel also.
   *   - `'locked'` | `'mastered'` | absent → no cue rendered.
   *
   * Defaults to `'locked'` (no cue). App.tsx computes and freezes this
   * once at session-start, same as `crossVowelMixing`.
   *
   * The cue is inert to answer outcomes — it never reacts to `pose` or
   * `problemState`. It is never added to `EmmaPose`; it consumes
   * `/assets/emma-th-mouth.svg` by direct path.
   */
  digraphsThNodeLevel?: SkillLevel
  /**
   * True iff `digraphs-th-voiceless` is `'intro'` AND absent from
   * `lifetimeFirstEncounters` — gates the Placement A first-encounter
   * intro panel (mounts before `audioReady`, exits when problem area
   * gates open). Only meaningful when `digraphsThNodeLevel === 'intro'`.
   *
   * Defaults to `false`.
   */
  digraphsThFirstEncounter?: boolean
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
  crossVowelMixing = false,
  digraphsThNodeLevel = 'locked',
  digraphsThFirstEncounter = false,
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

  // #231 — digraphs-th mouth-cue visibility derivations.
  // Placement B: persistent corner cue; shown whenever node is intro or practicing.
  const showThCornerCue =
    digraphsThNodeLevel === 'intro' || digraphsThNodeLevel === 'practicing'
  // Placement A: first-encounter intro panel; shown until audioReady flips.
  // Mounts before the problem area gate; exits when the gate opens.
  const showThIntroPanelA = digraphsThFirstEncounter && audioReady !== true

  // Plan re-derives whenever `planProp` flips — see Math.tsx for the full
  // rationale (ticket 86c9jteud). Short version: App.tsx swaps `planProp`
  // from the static fallback to the server-derived plan once
  // `prepareWordSongPathA()` resolves; if we captured `plan` once at mount
  // the screen would stick on the fallback and `playUtterance(text)`
  // lookups would miss the server-rendered audio. The parent's
  // `key="literacy"` ensures a fresh mount on track-change so cross-screen
  // plan leaks aren't possible. `now` is excluded from deps because the
  // static fallback is deterministic per-minute and `now` is unused once
  // `planProp` is non-null.
  const plan = useMemo<WordSongSessionPlan>(
    () => planProp ?? pickStaticWordSongPlan(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
    [planProp],
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
  /**
   * Per-problem clean-win outcome (ticket 86c9m3aec). Mirrors what
   * `totalCorrectRef` counts (correct on first/subsequent tap WITHOUT
   * the 3-strike guided completion firing) but indexed per problem.
   * SessionEnd cross-references this against the plan's target words
   * to compute the canonical/novel split for a graduation-session
   * entry. Indexed 0..7; `false` until the problem resolves with a
   * clean correct.
   */
  const perProblemCorrectRef = useRef<boolean[]>(
    Array.from({ length: plan.problems.length }, () => false),
  )
  /**
   * Per-problem first-tap chip-word mirror (2026-05-21, surface parity
   * with `MathSessionResult.perProblemAnswerValue`; Kevin schema-first
   * PR pairing with Dave's PR #284 two-digit add/sub research).
   *
   * Indexed 0..N-1; entry N is the literal word string Marian tapped
   * on her FIRST chip-tap for problem N, regardless of correctness.
   * Initialised to `null` per problem (sentinel for "no chip tapped
   * yet"). Flipped exactly once per problem inside `onChipTap`'s
   * first-tap latch (mirrors the math screen's
   * `perProblemAnswerValueRef`).
   *
   * SessionEnd reads this via
   * `WordSongSessionResult.perProblemAnswerWord` — see the result-type
   * doc for the design rationale. No current word-song consumer;
   * plumbed for future error-pattern classification.
   */
  const perProblemAnswerWordRef = useRef<(string | null)[]>(
    Array.from({ length: plan.problems.length }, () => null),
  )
  /**
   * Word-song once-per-problem first-tap latch (Kevin schema-first
   * PR, 2026-05-21). Mirrors Math's `firstTapRecordedRef` BY NAME but
   * NOT by responsibility. Flipped `true` after the per-problem
   * `perProblemAnswerWordRef.current[idx] = chipWord` write so retry
   * taps within the same problem don't overwrite the first-tap value.
   * Reset to `false` on problem advance (see the cleanup block in the
   * auto-advance effect).
   *
   * Gates ONE capture (`perProblemAnswerWordRef`):
   *   - Word-song does NOT capture latency (no `latencyMs` field on
   *     `WordSongSessionResult`).
   *   - Word-song's `perProblemCorrectRef` is written ELSEWHERE — in
   *     `handleCorrectTap`, NOT inside this latch — giving it
   *     **ever-correct** semantics (wrong-then-correct retries record
   *     `true`). Math's same-named latch gates THREE writes including
   *     `perProblemCorrectRef`, producing **first-tap** semantics
   *     instead.
   *
   * The two `perProblemCorrect` arrays land on the same
   * `SessionEndPayload.perProblemCorrect` wire field with divergent
   * semantics. The asymmetry is intentional (pedagogical role
   * differs: math = automaticity retrieval; word-song = decoding
   * practice + re-encouragement). DO NOT consolidate this latch with
   * the `handleCorrectTap` write — it would silently flip word-song
   * to first-tap semantics. See `src/lib/progress/types.ts` DESIGN
   * NOTE near `SessionHistoryEntry` for the cross-screen design
   * rationale and Thomas's 2026-05-21 accept call.
   */
  const firstTapRecordedRef = useRef(false)
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
  /**
   * CVC phoneme-blend prompt (ticket 86c9qa6n3): which `LetterGlyph` is
   * highlighted during the 2nd-wrong blend sound-out, driven off the blend
   * utterance's own `onWordTick` events. `null` = no highlight (default /
   * not in a blend). Indices `0..wordLength-1` highlight that letter; index
   * `wordLength` (the whole-word token) clears the per-letter highlight and
   * pulses ALL letters together once (the "blended" beat). Reset to `null`
   * on the blend's onEnd and on problem advance. See Kyle's spec
   * §"Letter-highlight timing".
   */
  const [blendActiveLetterIndex, setBlendActiveLetterIndex] = useState<
    number | null
  >(null)
  /** Synchronous 2nd-wrong blend latch (ticket 86c9qa6n3). The
   *  rename/repurpose of the 2nd-wrong beat — reuses `hintPlayedRef`'s gate
   *  (one latch, set synchronously when the 2nd wrong tap is counted) so 5
   *  rapid finger-mashes queue exactly ONE blend prompt. NO parallel ref —
   *  the blend fires inside the same `didScheduleHint` branch that the hint
   *  used. See Kyle's spec §"Where this slots into the existing state
   *  machine" → "State definition". */
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
    () => buildChipOrder(plan.problems[problemIndex], crossVowelMixing),
    [plan, problemIndex, crossVowelMixing],
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
   * Silent-text window timer (cvc-word problems only). Cleared on
   * unmount, problem advance, or replaced by a re-arm fired from
   * `visibilitychange → visible`. Ticket 86c9m3ae6.
   */
  const silentTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Subscription handle for the `visibilitychange` re-arm listener used
   * by the silent-text window when the page is hidden at window-end.
   * Cleared in `clearAllTimers` so a unit-test or unmount path tears it
   * down deterministically. Ticket 86c9m3ae6.
   */
  const silentTextVisibilityListenerRef = useRef<(() => void) | null>(null)

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
      silentTextTimerRef,
    ]) {
      if (ref.current !== null) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
    if (silentTextVisibilityListenerRef.current !== null) {
      silentTextVisibilityListenerRef.current()
      silentTextVisibilityListenerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      unmountedRef.current = true
      clearAllTimers()
      sparkleInstance.unload()
      poofInstance.unload()
      plinkInstance.unload()
      // Persist on unmount (same defensive write as Math). Reading the ref
      // at cleanup-time is intentional — we want the LATEST stardust total,
      // including grants made between mount and unmount that React may not
      // have committed to state yet. Snapshotting at mount would write the
      // initial total and lose the session's earnings.
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
    async (
      text: string,
      hooks?: {
        /** Per-call extra word-tick hook (CVC blend prompt drives the
         *  per-letter highlight off this). Fires in addition to the caption
         *  reveal, with the same `wordIndex` the caption uses. */
        onWordTick?: (wordIndex: number) => void
      },
    ): Promise<void> => {
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
          hooks?.onWordTick?.(wordIndex)
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

    /**
     * Actually fire the read-aloud microtask. Lifted out of the
     * synchronous effect body so the silent-text window (cvc-word only)
     * can defer this through a `setTimeout` while sharing the exact same
     * dispatch path with the immediate (`blending-cv`) flow. Ticket
     * 86c9m3ae6.
     */
    const dispatchReadAloud = () => {
      if (unmountedRef.current) return
      if (problemIndexRef.current !== myProblemIndex) return
      // Synchronous double-speak latch (ticket 86c9hf4ef). Flips before
      // any setState/speak so that the re-render triggered by the
      // cold-mount fast path's `setAudioUnlocked(true)` cannot schedule
      // a second microtask that re-speaks the same line. See Math.tsx
      // for the long-form rationale.
      if (spokeReadAloudRef.current) return
      spokeReadAloudRef.current = true
      // Emma adopts the `listening` pose for the read-aloud / speaking beat
      // (Wave 14 Track B, ticket 86ca8kq7r). POSE_HOLD_MS.listening is
      // `null`, so it never auto-returns — the speak() onEnd `.then()` below
      // clears it back to `idle`. Reduce-motion is handled entirely by the
      // shared EmmaCharacter (SVG swap, no tilt) — no screen branch needed.
      setPose('listening')
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
        // Clear the `listening` pose on the read-aloud onEnd (Wave 14
        // Track B). Guard against clobbering a reaction that fired while
        // the read-aloud was in flight (chip tap mid-read-aloud could have
        // already set `celebration` / `puzzled-tilt`); only return to idle
        // if Emma is still `listening`.
        setPose((current) => (current === 'listening' ? 'idle' : current))
      })
    }

    // Silent-text window for `cvc-word` problems (ticket 86c9m3ae6).
    // The word text is already on screen — only the read-aloud is
    // delayed so Marian gets a decoding beat to sound the word out.
    // `blending-cv` (and any future content type that lacks the
    // discriminant) keeps the legacy immediate-fire behaviour. `contentType`
    // is optional on the public type for back-compat with hand-built static
    // plans, hence the explicit equality check.
    //
    // `sight-word` (Wave 11 W11-03, ticket 86ca7xmvz) deliberately stays
    // OUT of this gate — sight words are whole-word RECOGNITION, not
    // decoding. A silent "sound it out" beat is actively WRONG here:
    // applying GPC rules to "was" yields the non-word /wæs/ (Dave's W11-01
    // §"Recognition mechanic" point 2). Sight-word read-aloud must fire
    // immediately, which the `!isCvcWord` branch below already does. Do
    // NOT widen `isCvcWord` to include `sight-word`.
    const isCvcWord = problem.contentType === 'cvc-word'

    if (!isCvcWord) {
      queueMicrotask(dispatchReadAloud)
      // `audioReady` IS in the deps so the effect re-runs when the parent
      // flips it from `false` → `true` (Path A fetch settled). The
      // `spokeReadAloudRef` latch ensures a re-run after read-aloud fired
      // is a no-op. Ticket 86c9hjnn8 — see Math.tsx for the rationale.
      return
    }

    /**
     * Fire the read-aloud iff the page is currently visible. If hidden
     * (Marian backgrounded the iPad mid-window), attach a one-shot
     * `visibilitychange` listener that re-fires this same fn when the
     * page comes back. Ticket 86c9m3ae6 AC #5.
     *
     * The double-speak latch (`spokeReadAloudRef`) and the unmount /
     * problem-advance refs guard against duplicate dispatch — a re-arm
     * is safe to fire even if the user un-hides quickly after the timer
     * already elapsed once. (Effect cleanup also detaches the listener.)
     */
    const fireOrReArmOnVisibility = () => {
      if (unmountedRef.current) return
      if (problemIndexRef.current !== myProblemIndex) return
      if (typeof document !== 'undefined' && document.hidden) {
        const onVisible = () => {
          if (typeof document !== 'undefined' && document.hidden) return
          document.removeEventListener('visibilitychange', onVisible)
          silentTextVisibilityListenerRef.current = null
          fireOrReArmOnVisibility()
        }
        document.addEventListener('visibilitychange', onVisible)
        silentTextVisibilityListenerRef.current = () => {
          document.removeEventListener('visibilitychange', onVisible)
        }
        return
      }
      dispatchReadAloud()
    }

    silentTextTimerRef.current = setTimeout(() => {
      silentTextTimerRef.current = null
      fireOrReArmOnVisibility()
    }, SILENT_TEXT_WINDOW_MS)

    return () => {
      // Cleanup on problem-advance / unmount / dep-change. Clears the
      // pending silent-text timer and any visibility re-arm so a stale
      // window can never fire against the next problem's state.
      if (silentTextTimerRef.current !== null) {
        clearTimeout(silentTextTimerRef.current)
        silentTextTimerRef.current = null
      }
      if (silentTextVisibilityListenerRef.current !== null) {
        silentTextVisibilityListenerRef.current()
        silentTextVisibilityListenerRef.current = null
      }
    }
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
      // Reset the once-per-problem first-tap latch (Kevin schema-first
      // PR, 2026-05-21) so the next problem's chip-tap can record into
      // `perProblemAnswerWordRef`.
      firstTapRecordedRef.current = false
      setShakingChip(null)
      // Clear the CVC blend prompt's per-letter highlight on advance
      // (ticket 86c9qa6n3) — the `blendPlayedRef` equivalent is the reused
      // `hintPlayedRef`, already reset above. See Kyle's spec §States →
      // "Transition in/out".
      setBlendActiveLetterIndex(null)
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
        // Per-problem outcome + target word vector (ticket
        // 86c9m3aec). SessionEnd uses these to compute the
        // canonical/novel split when the just-completed session
        // was a graduation run for cvc-words. We slice the per-
        // problem array (a snapshot — the ref is mutable by
        // construction) and read targets straight from the plan.
        perProblemCorrect: perProblemCorrectRef.current.slice(),
        targetWords: plan.problems.map((p) => p.target.word),
        // Per-problem first-tap chip word (Kevin schema-first PR,
        // 2026-05-21, surface parity with
        // MathSessionResult.perProblemAnswerValue). Sliced so
        // downstream consumers can't mutate the screen's internal
        // state. No current word-song consumer; plumbed for future
        // error-pattern classification.
        perProblemAnswerWord: perProblemAnswerWordRef.current.slice(),
      })
    }
  }, [problemIndex, plan.problems, onSessionComplete, storage, now])

  // Per-correct stardust grants were intentionally REMOVED from word-song
  // in ticket 86c9kwvza (Thomas locked 2026-05-02). Reasoning per Dave's
  // audit, grounded in Deci, Koestner & Ryan (1999): performance-contingent
  // rewards undermine intrinsic motivation on intrinsically-interesting
  // tasks. Word-learning at 8 (especially for an L2 learner like Marian) is
  // intrinsically interesting. Math is unchanged — drilled fact-recall is a
  // different class of task and benefits from per-correct reinforcement.
  //
  // The completion bonus (+5 stardust) is granted at session-end inside
  // SessionEnd's mount effect via `grantWordSongCompletionBonus`. Sensory
  // rewards on chip-tap (sparkle, plink, celebration tilt, streak band)
  // remain — those are not points-rewards.

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
              // Emma adopts the `attentive-pointing` pose for the 2nd-wrong
              // beat (Wave 14 Track B, ticket 86ca8kq7r). The wand carries
              // the direction (tilt 0°); POSE_HOLD_MS['attentive-pointing']
              // is `null`, so the TTS onEnd `.then()` below clears it.
              setPose('attentive-pointing')

              // CVC phoneme-blend prompt (ticket 86c9qa6n3) — the MVP
              // REPLACES the empty 2nd-wrong `hint` beat with a real
              // sound-out for `cvc-word` problems that carry a baked
              // `blend` utterance. GRACEFUL-SKIP: when the blend slot is
              // absent (every tier pre-bake, every non-CVC tier), fall
              // back to the existing `hint` line — no silent/dead beat,
              // audio-first. See Kyle's spec §"Where this slots in" + §GRACEFUL-SKIP.
              const blendText =
                problem.contentType === 'cvc-word'
                  ? problem.utterances.blend
                  : undefined

              if (blendText !== undefined) {
                // Build the raw-token-index → letter-highlight-index map so
                // the per-letter reveal sequences over the grapheme tokens
                // (positions 0..n-1) and the whole-word token pulses ALL
                // letters once (index === word.length). Tokenizer-robust:
                // the ASCII separators (`-`, `...`) are their own tokens.
                const highlightSteps = buildBlendHighlightSteps(
                  blendText,
                  problem.target.word,
                )
                void speak(blendText, {
                  onWordTick: (wordIndex) => {
                    const next = highlightSteps[wordIndex]
                    if (next !== undefined) setBlendActiveLetterIndex(next)
                  },
                }).then(() => {
                  // Blend onEnd: clear the per-letter highlight, return Emma
                  // to idle (functional-updater guarded so a mid-blend
                  // correct/wrong tap that set celebration/puzzled-tilt is
                  // never clobbered — mirrors the read-aloud onEnd guard).
                  setBlendActiveLetterIndex(null)
                  setPose((current) =>
                    current === 'attentive-pointing' ? 'idle' : current,
                  )
                })
              } else {
                void speak(problem.utterances.hint).then(() => {
                  poseTimerRef.current = setTimeout(() => {
                    setPose('idle')
                    poseTimerRef.current = null
                  }, 0)
                })
              }
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

      // Streak counter still advances on a clean correct (no wrongs, no
      // guided completion). The streak band is a sensory reward — visible
      // momentum, not points — and it stays. What we removed (ticket
      // 86c9kwvza) is the stardust grant on every correct tap and the
      // streak-threshold stardust bonus. The HUD pop, sparkle burst, and
      // celebration tilt all still fire below.
      //
      // Reads from the synchronous refs (not React state); see ref
      // declarations for the rage-tap rationale (ticket 86c9gyb2v).
      const isCleanWin = wrongCountRef.current === 0 && !guidedPlayedRef.current
      if (!guidedPlayedRef.current) {
        totalCorrectRef.current += 1
        // Mark this problem as a non-guided correct on the per-problem
        // outcome ref (ticket 86c9m3aec). Index is 0-based; `problem.index`
        // is 1-based per the spec.
        //
        // PER-SCREEN ASYMMETRY: this write site gives word-song's
        // `perProblemCorrect` **ever-correct** semantics — the latch
        // fires on the correct resolution, NOT on the first tap, so
        // wrong-then-correct retries record `true`. Math's same-named
        // `perProblemCorrectRef` is written under the `firstTapRecordedRef`
        // once-per-problem latch in `onChipTap`, producing **first-tap**
        // semantics on the same `SessionEndPayload.perProblemCorrect`
        // wire field. The divergence is intentional (Thomas accepted
        // 2026-05-21): word-song's pedagogical role is decoding
        // practice + re-encouragement, so eventual-correct credit is
        // the right semantic for `computeGraduationSplit`. DO NOT
        // move this write into the `firstTapRecordedRef` latch
        // without coordinating across both screens — it would
        // silently flip word-song to first-tap semantics. See
        // `src/lib/progress/types.ts` DESIGN NOTE near
        // `SessionHistoryEntry`.
        if (
          problem.index >= 1 &&
          problem.index <= perProblemCorrectRef.current.length
        ) {
          perProblemCorrectRef.current[problem.index - 1] = true
        }
        if (isCleanWin) {
          streakRef.current = streakRef.current + 1
          setStreak(streakRef.current)
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
    [advanceToNext, plinkInstance, sparkleInstance, speak],
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
      // PR #137 round 2 (ticket 86c9kxtmu) — gesture-deferred recovery
      // drain. Mirrors Math's drain call. See Math.tsx onChipTap for
      // the full rationale.
      drainOnGesture(resumeAudioCtx, unlockAudioSessionFn)
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

      // First-tap capture for the current problem (Kevin schema-first
      // PR, 2026-05-21, surface parity with Math). Records the
      // literal word string Marian tapped, regardless of correctness.
      // The capture happens BEFORE the correct/wrong dispatch below
      // so retry taps that re-enter `handleCorrectTap` after a wrong
      // (which sets resolved = true) still see the latch and skip re-
      // recording. `firstTapRecordedRef` is the once-per-problem
      // latch; reset to `false` on problem advance.
      //
      // PER-SCREEN ASYMMETRY: this latch gates ONLY the answer-word
      // capture. WordSong's `perProblemCorrectRef` is written in
      // `handleCorrectTap` (not here), giving word-song
      // **ever-correct** semantics — wrong-then-correct retries
      // record `true`. Math's same-named `firstTapRecordedRef` gates
      // THREE writes including `perProblemCorrectRef`, producing
      // **first-tap** semantics for the math array on the same wire
      // field (`SessionEndPayload.perProblemCorrect`). DO NOT add a
      // `perProblemCorrectRef` write here without coordinating across
      // screens — it would silently flip word-song to first-tap
      // semantics. See `src/lib/progress/types.ts` DESIGN NOTE near
      // `SessionHistoryEntry`.
      if (!firstTapRecordedRef.current) {
        firstTapRecordedRef.current = true
        const idx = problemIndex
        if (idx >= 0 && idx < perProblemAnswerWordRef.current.length) {
          perProblemAnswerWordRef.current[idx] = chipWord
        }
      }

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

            Phase 3b motion brief (ticket 86c9kwvza, locked 2026-05-02):
            the legacy 600ms keyframe wiggle on celebration is replaced
            by the canonical spring-tilt rotateZ (+breathing on idle)
            inside `EmmaCharacter`. Per `design/character/motion-brief.md`
            §3.2 celebration tilts LEFT (rotateZ -6) with stiffness 200
            damping 22 (softened from the original 260/20 per Thomas's
            iPad-Pro feedback, ticket 86c9kxmqb 2026-05-01); puzzled-tilt
            tilts RIGHT (rotateZ +10) with stiffness 220 damping 20. The
            data-wiggling marker is preserved on the rendered element
            for the existing QA selectors — semantics widened from "the
            celebration keyframe wiggle is firing" to "Emma is in a
            non-idle motion-bearing pose with motion enabled". */}
        <EmmaCharacter
          pose={pose}
          layoutId="emma"
          data-testid="word-song-emma"
          className="h-[26vh] w-auto select-none"
        />

        {/* Placement A — digraphs-th first-encounter intro panel.
            Spec #231 §4.1. Mounts alongside Emma during the fetch wait
            (NOT gated on audioReady). Exits via opacity fade when
            the problem area gate opens.
            - ~22vh square, th label below image
            - spring 260/20 in; 200ms opacity out
            - reduce-motion: plain opacity fade in
            - pointer-events-none, aria-hidden; cue is inert to outcomes */}
        <AnimatePresence>
          {showThIntroPanelA && (
            <m.div
              data-testid="th-intro-panel"
              aria-hidden
              className="pointer-events-none flex flex-col items-center gap-1"
              style={{ width: '22vh', flexShrink: 0 }}
              initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={
                reducedMotion
                  ? { duration: 0.2 }
                  : { type: 'spring', stiffness: 260, damping: 20 }
              }
            >
              <img
                src="/assets/emma-th-mouth.svg"
                alt=""
                aria-hidden
                className="h-[22vh] w-[22vh] select-none object-contain"
                draggable={false}
              />
              <span className="font-display text-2xl font-bold text-ink">
                th
              </span>
            </m.div>
          )}
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

      {/*
       * Render gate (ticket 86c9kxb5q) — when `audioReady === false`, the
       * parent's Path A fetch is still in flight. Rendering the problem
       * area now would paint the static-fallback Q1's picture+letters,
       * then visibly swap to the canon-derived Q1 when the prop flips
       * ~1.3s later. Holding the problem area off-DOM until
       * `audioReady !== false` eliminates the swap-jolt Thomas reported
       * on production. The Emma + HUD chrome above stays mounted so the
       * screen never goes blank — Marian sees her teacher idle while the
       * line is fetched, then the word card appears with audio firing
       * per the existing read-aloud gate.
       *
       * `audioReady === undefined` (no prop passed by the caller) is
       * treated as "show the problem" — preserves backwards-compat with
       * every test/caller that pre-dates this gate. App.tsx always passes
       * a boolean in production. Mirrors Math.tsx's gate.
       */}
      {audioReady !== false && (
        <>
          {/* Word card — picture above letters (per spec §"Word card composition").
          Picture leads (meaning first), letters below (decoding follows).

          Letter-names tier (Wave 7 A4b, ticket 86c9y6nc7) and
          letter-sounds tier (Wave 7 A8b, ticket 86c9y6gea) BOTH skip
          this card entirely — the chip strip below carries the
          assessment in full via letter glyphs. Per Kyle's A1 spec §4
          "Visual / render contract (no picture pack)" (which A5 §4
          adopts): letter glyphs are the chip content; no picture-pack
          asset, no letters-of-the-word breakdown beneath.

          Sight-words tier (Wave 11 W11-03, ticket 86ca7xmvz) ALSO skips
          this card. Sight words are whole-word RECOGNITION, not phonics
          decoding — "the"/"was"/"said" have no picturable referent
          (Dave's W11-01 §"Recognition mechanic" point 1; E4 Conners 2012
          shows pictures actively SLOW non-picturable word learning). The
          written word IS the chip; there is no picture meaning-anchor and
          no letters-of-the-word decode breakdown.

          Simple-sentences tier (Wave 13 W13-03/04, ticket 86ca8e6fr) ALSO
          skips this card. The reading surface is the SENTENCE PANEL (below)
          — a full gapped sentence, not a single word card. The gentle-phase
          SCENE panel (also below) carries comprehension context. There is
          no single-word picture card and no per-word decode breakdown
          (Kyle §3.2 — the cloze mechanic transfers the sight-words
          written-word chip, NOT the CVC picture card). */}
          {currentProblem.contentType !== 'letter-names' &&
            currentProblem.contentType !== 'letter-sounds' &&
            currentProblem.contentType !== 'sight-word' &&
            currentProblem.contentType !== 'simple-sentence' && (
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
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }
                    }
                    animate={
                      reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                    }
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
                tap". v1 keeps letter taps as visual-only. During the CVC
                phoneme-blend prompt (ticket 86c9qa6n3) the letters are driven
                instead by `highlighted` off `blendActiveLetterIndex`: index i
                highlights letter[i] as its phoneme plays; the whole-word beat
                (index === word.length) pulses ALL letters together once. */}
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
                        // Per-letter highlight during the blend: this letter
                        // when its index is active, OR every letter on the
                        // whole-word beat (active index === word length).
                        highlighted={
                          blendActiveLetterIndex === i ||
                          blendActiveLetterIndex ===
                            currentProblem.target.word.length
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

          {/* Letter-names word card — single large glyph centered, in the
          slot the picture would occupy on CVC tiers. Marian sees only the
          chips below, but the centered glyph reinforces the read-line
          target while Emma speaks. Kyle's A1 spec §4.1 frames this as
          "the chip glyph IS the assessment" — the centered card glyph is
          a visual reading-anchor mirroring the picture role on CVC. */}
          {currentProblem.contentType === 'letter-names' && (
            <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-2 px-4">
              <div
                data-testid="word-song-letter-card"
                data-letter={currentProblem.target.word}
                className="flex flex-col items-center gap-2"
              >
                <m.div
                  data-testid="word-song-letter-glyph"
                  className="flex items-center justify-center"
                  style={{ width: '180px', height: '180px' }}
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }
                  }
                  animate={
                    reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 260, damping: 16 }
                  }
                >
                  <span
                    style={{
                      fontSize: '128px',
                      lineHeight: 1,
                      fontWeight: 700,
                      color: '#1F2937',
                      // System sans-serif stack; Kyle's A1 spec §4.2 recommends
                      // Atkinson Hyperlegible but project design-tokens have
                      // not landed that font yet — pending Devon. System
                      // sans-serif disambiguates Il1 + bdpq adequately on iPad
                      // at 128px scale.
                      fontFamily:
                        'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    }}
                    aria-label={`Letter ${currentProblem.target.word}`}
                  >
                    {currentProblem.target.word}
                  </span>
                </m.div>
              </div>
            </div>
          )}

          {/* Letter-sounds word card — single large glyph centered, in
          the slot the picture would occupy on CVC tiers. The chip strip
          below carries the answer; this centered glyph is a visual
          reading-anchor mirroring the picture role on CVC. Sized to
          180pt to match the picture footprint. */}
          {currentProblem.contentType === 'letter-sounds' && (
            <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-2 px-4">
              <div
                data-testid="word-song-letter-sound-card"
                data-letter={currentProblem.target.word}
                className="flex flex-col items-center gap-2"
              >
                <m.div
                  data-testid="word-song-letter-sound-glyph"
                  className="flex items-center justify-center"
                  style={{ width: '180px', height: '180px' }}
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }
                  }
                  animate={
                    reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 260, damping: 16 }
                  }
                >
                  <span
                    style={{
                      fontSize: '128px',
                      lineHeight: 1,
                      fontWeight: 700,
                      color: '#1F2937',
                      // System sans-serif stack; Kyle's A5 spec §4.2
                      // (adopting A1's recommendation) calls for
                      // Atkinson Hyperlegible but project design-tokens
                      // have not landed that font yet — pending Devon.
                      // System sans-serif disambiguates Il1 + bdpq
                      // adequately on iPad at 128px scale.
                      fontFamily:
                        'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    }}
                    aria-label={`Letter ${currentProblem.target.word}`}
                  >
                    {currentProblem.target.word}
                  </span>
                </m.div>
              </div>
            </div>
          )}

          {/* Simple-sentences reading surface (Wave 13 W13-03/04, ticket
          86ca8e6fr): a gentle-phase SCENE illustration above the SENTENCE
          PANEL (the net-new center-stage gapped-sentence card). The scene
          renders only when a scene asset is registered for the problem's
          `sceneId` (gentle phase + asset shipped) — otherwise it renders
          nothing (trap phase OR not-yet-shipped MJ asset → graceful
          text-only fallback, Kyle §1.3 / §8.2). The sentence panel always
          renders for this tier; its words reveal word-by-word synced to
          Emma's read (same `captionRevealed` tick as the caption ribbon),
          and the gap fills with the target word once the problem resolves
          (the closure beat, Kyle §3.2 / sponsor Q2). */}
          {currentProblem.contentType === 'simple-sentence' && (
            <div className="mt-2 flex flex-1 flex-col items-center justify-start gap-3 px-4">
              <ScenePanel
                sceneId={currentProblem.sceneId}
                ariaLabel={
                  currentProblem.sentenceFrame?.replace(
                    SENTENCE_GAP_TOKEN,
                    currentProblem.target.word,
                  ) ?? currentProblem.target.word
                }
              />
              {currentProblem.sentenceFrame !== undefined && (
                <SentencePanel
                  frame={currentProblem.sentenceFrame}
                  targetWord={currentProblem.target.word}
                  revealedCount={captionRevealed}
                  filled={problemState.resolved}
                  reducedMotion={reducedMotion}
                />
              )}
            </div>
          )}

          {/* Picture chips — 3 chips, 96×96pt with 24pt gaps per spec line 143.
          For `letter-names` and `letter-sounds` the chip CONTENT swaps
          from `<WordPicture>` to a centered letter glyph; the chip FRAME
          (size, border, spring, hit area, shake animation) is unchanged.
          Kyle's A1 spec §4.1 (which A5 §4.1 adopts) requires the
          chip-frame contract stay identical to the CVC chips. */}
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
              const isLetterNames =
                currentProblem.contentType === 'letter-names'
              const isLetterSounds =
                currentProblem.contentType === 'letter-sounds'
              const isLetterTier = isLetterNames || isLetterSounds
              // Sight-words tier (Wave 11 W11-03): the chip presents the
              // WRITTEN word as text (no picture), per Dave's W11-01
              // audio-first whole-word-matching mechanic. The chip FRAME
              // (size, border, spring, hit area, shake) is identical to the
              // CVC chips — only the CONTENT swaps from <WordPicture> to a
              // text glyph, the same seam the letter tiers use.
              const isSightWord = currentProblem.contentType === 'sight-word'
              // Simple-sentences tier (Wave 13 W13-03/04): the chip is the
              // WRITTEN word as text — the EXACT sight-words written-word
              // chip (Kyle §3.3, "reuse the isSightWord text-glyph chip").
              // Same frame, same 36px text; only the gate widens. Render
              // dispatch keys on this combined predicate so both tiers
              // share one branch.
              const isWrittenWordChip =
                isSightWord || currentProblem.contentType === 'simple-sentence'
              return (
                <m.button
                  key={entry.word}
                  type="button"
                  data-testid="word-song-chip"
                  data-word={entry.word}
                  data-picture-key={entry.pictureKey}
                  data-correct={isCorrect ? 'true' : 'false'}
                  data-shaking={isShaking ? 'true' : 'false'}
                  aria-label={
                    isLetterTier
                      ? `Letter ${entry.word}`
                      : isWrittenWordChip
                        ? `Word ${entry.word}`
                        : `Picture of ${entry.word}`
                  }
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
                        : {
                            x: [0, -6, 6, -4, 4, 0],
                            scale: 1,
                            opacity: 1,
                            y: 0,
                          }
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
                  {isLetterTier ? (
                    <span
                      data-testid={
                        isLetterSounds
                          ? 'word-song-chip-letter-sound'
                          : 'word-song-chip-letter'
                      }
                      style={{
                        fontSize: '64px',
                        lineHeight: 1,
                        fontWeight: 700,
                        color: '#1F2937',
                        fontFamily:
                          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                        userSelect: 'none',
                      }}
                    >
                      {entry.word}
                    </span>
                  ) : isWrittenWordChip ? (
                    /* Written-word chip — the WRITTEN word as text, the chip
                       target itself. Shared by the sight-words tier (Dave's
                       W11-01 mechanic) AND the simple-sentences cloze tier
                       (Kyle W13-02 §3.3 — the sight-words chip transfers
                       verbatim). 36px is the sight-words default; for
                       simple-sentences it keeps the longest deferral word
                       ("there"/"where", 5 letters) inside the 96pt chip's
                       ~80pt content box (Kyle §7 Q3 — drop to 32px if a
                       5-letter word clips; 36px measured clear here). The
                       rendered text IS the chip's accessible/visible word
                       (Jessica W11-04 / W13-05 test 3 assert chip innerText
                       contains data-word). The shared `word-song-chip-sight-word`
                       testid is retained (it names the chip SHAPE, not the
                       tier — Kyle §7 Q5). */
                    <span
                      data-testid="word-song-chip-sight-word"
                      style={{
                        fontSize: entry.word.length >= 5 ? '32px' : '36px',
                        lineHeight: 1,
                        fontWeight: 700,
                        color: '#1F2937',
                        fontFamily:
                          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                        userSelect: 'none',
                      }}
                    >
                      {entry.word}
                    </span>
                  ) : (
                    <WordPicture
                      pictureKey={entry.pictureKey}
                      ariaLabel={entry.word}
                    />
                  )}

                  <AnimatePresence>
                    {celebrating && isCorrect && !reducedMotion && (
                      <SparkleBurst key="burst" />
                    )}
                  </AnimatePresence>
                </m.button>
              )
            })}
          </div>
        </>
      )}

      {/* Placement B — persistent th mouth-cue corner stamp.
          Spec #231 §4.2. Absolute top-right, below HUD strip (h-14 = 3.5rem).
          Present whenever digraphsThNodeLevel is intro or practicing.
          - 64×88pt per spec
          - 200ms opacity fade in, static thereafter (no exit animation)
          - reduce-motion: same opacity fade (no difference from normal here)
          - pointer-events-none, aria-hidden; inert to answer outcomes */}
      <AnimatePresence>
        {showThCornerCue && (
          <m.div
            data-testid="th-corner-cue"
            aria-hidden
            className="pointer-events-none absolute right-3 flex flex-col items-center gap-0.5"
            style={{
              top: 'calc(3.5rem + env(safe-area-inset-top))',
              width: '64pt',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <img
              src="/assets/emma-th-mouth.svg"
              alt=""
              aria-hidden
              className="select-none object-contain"
              style={{ width: '64pt', height: '88pt' }}
              draggable={false}
            />
            <span className="font-display text-base font-bold text-ink">
              th
            </span>
          </m.div>
        )}
      </AnimatePresence>
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

/** The literal gap token in a simple-sentence `sentenceFrame`. */
const SENTENCE_GAP_TOKEN = '___'

/**
 * Sentence panel for the simple-sentences cloze tier (Wave 13 W13-03/04,
 * Kyle §3.2 — NET-NEW component). Renders the gapped sentence as a
 * prominent center-stage card above the chips. The `___` gap token renders
 * as a styled blank underline (`word-song-sentence-gap`); the surrounding
 * words reveal word-by-word synced to Emma's read (the same `captionRevealed`
 * tick the caption ribbon uses). On `filled`, the blank fills IN PLACE with
 * the target word (spring scale-in) so Marian SEES the completed sentence
 * before advancing — the closure beat (Kyle §3.2 / sponsor Q2).
 *
 * Reveal model: the frame is split into tokens; the gap counts as one
 * token for reveal sequencing. `revealedCount` words (incl. the gap) are
 * visible. When `filled`, the gap shows `targetWord` instead of the blank
 * underline and `data-gap-filled="true"`.
 */
function SentencePanel({
  frame,
  targetWord,
  revealedCount,
  filled,
  reducedMotion,
}: {
  frame: string
  targetWord: string
  revealedCount: number
  filled: boolean
  reducedMotion: boolean
}) {
  // Split the frame into whitespace tokens. The gap token "___" may carry
  // ATTACHED punctuation when it sits at a clause edge — e.g. "The dog ___."
  // → ["The","dog","___."] (trailing period) or a question frame's gap may
  // carry a trailing "?". Splitting only on whitespace keeps each visual
  // word as one token; the per-token render below detects the "___"
  // SUBSTRING and peels the surrounding punctuation off so the styled blank
  // renders with the punctuation as plain text beside it. (A naive
  // `token === '___'` equality misses "___." — the bug Jessica's W13-05
  // test 3 catches.)
  const tokens = frame.split(/\s+/).filter(Boolean)
  return (
    <m.div
      data-testid="word-song-sentence-panel"
      role="status"
      aria-live="polite"
      className="
        mx-auto mt-2 max-w-[90%]
        rounded-2xl border-[3px] border-my-pink bg-white
        px-6 py-4 text-center
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
        className="font-display text-[2rem] leading-relaxed text-ink"
        style={{ wordSpacing: '0.1em' }}
      >
        {tokens.map((token, i) => {
          const revealed = i < revealedCount
          const gapAt = token.indexOf(SENTENCE_GAP_TOKEN)
          const isGap = gapAt !== -1
          const marginRight = i === tokens.length - 1 ? 0 : '0.3em'
          if (isGap) {
            // Peel any punctuation attached to the gap token (e.g. the
            // trailing "." in "___." or "?" in "___?") so the styled blank
            // renders, then the punctuation as plain text after it.
            const before = token.slice(0, gapAt)
            const after = token.slice(gapAt + SENTENCE_GAP_TOKEN.length)
            return (
              <m.span
                key={`gap-${i}`}
                data-testid="word-song-sentence-gap"
                data-gap-filled={filled ? 'true' : 'false'}
                className="inline-block"
                style={{ marginRight }}
                initial={{ opacity: 0 }}
                animate={{ opacity: revealed ? 1 : 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {before}
                {filled ? (
                  /* Gap fills with the target word in place — the closure
                     beat (Kyle §3.2). Same ink weight as the rest of the
                     sentence (it is now part of the sentence, not a chip). */
                  <m.span
                    data-testid="word-song-sentence-word"
                    data-revealed="true"
                    data-word={targetWord}
                    className="inline-block text-ink"
                    initial={
                      reducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }
                    }
                    animate={
                      reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
                    }
                    transition={
                      reducedMotion
                        ? { duration: 0.2 }
                        : { type: 'spring', stiffness: 260, damping: 16 }
                    }
                  >
                    {targetWord}
                  </m.span>
                ) : (
                  /* Styled blank underline — NOT the literal "___" (Kyle
                     §3.2: "a blank underline inside the sentence text"). */
                  <span
                    className="inline-block border-b-[3px] border-ink align-baseline"
                    style={{ width: '3.5ch' }}
                    aria-label="blank"
                  >
                    {' '}
                  </span>
                )}
                {after}
              </m.span>
            )
          }
          return (
            <m.span
              key={`${i}-${token}`}
              data-testid="word-song-sentence-word"
              data-revealed={revealed ? 'true' : 'false'}
              data-word={token}
              className="inline-block"
              style={{ marginRight }}
              initial={{ opacity: 0 }}
              animate={{ opacity: revealed ? 1 : 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {token}
            </m.span>
          )
        })}
      </p>
    </m.div>
  )
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
  highlighted = false,
}: {
  letter: string
  index: number
  reducedMotion: boolean
  /**
   * Driven highlight for the CVC phoneme-blend prompt (ticket 86c9qa6n3).
   * When true, the glyph shows the same rose pulse the tap affordance uses
   * (colour shift `#FFB7C5` + `scale [1,1.2,1]`), but driven by the prop
   * (the blend's `onWordTick`) instead of a local tap. Reduce-motion:
   * colour-only, no scale pulse. Default false (back-compat — the
   * letter-tap affordance still works via local `tapped` state).
   */
  highlighted?: boolean
}) {
  const [tapped, setTapped] = useState(false)

  const handleTap = useCallback(() => {
    setTapped(true)
    // Visual reset after the pulse — independent of any audio event since
    // phoneme audio is not yet wired (see spec §Phoneme audio note).
    window.setTimeout(() => setTapped(false), 400)
  }, [])

  // The glyph reads as "active" (rose colour + pulse) when EITHER the local
  // tap fired OR the blend prompt is highlighting it. The two share the
  // exact same visual so Marian sees a pulse she has seen before (Kyle spec
  // §"Letter-highlight timing").
  const active = tapped || highlighted
  const animate =
    active && !reducedMotion
      ? { scale: [1, 1.2, 1], opacity: 1 }
      : { scale: 1, opacity: 1 }

  return (
    <m.button
      type="button"
      data-testid="word-song-letter"
      data-letter={letter}
      data-index={index}
      // Expose the blend-driven highlight for e2e/unit assertions (Kyle's
      // AC: "data-highlighted='true' walks index 0→1→2 in step with
      // onWordTick"). Only reflects the blend-driven prop, NOT the local tap.
      data-highlighted={highlighted ? 'true' : 'false'}
      aria-label={`Letter ${letter}`}
      onClick={handleTap}
      className="
        bg-transparent border-0 cursor-pointer select-none
        font-display text-[6rem] leading-none
        touch-manipulation
      "
      style={{
        padding: '8px 4px',
        color: active ? '#FFB7C5' : '#3B3B3B',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={animate}
      transition={
        active
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
 *
 * `crossVowel` (ticket 86c9qa0kf) — when `true`, distractors are drawn
 * from `TARGET_PAIRINGS_CROSSVOWEL` (cross-vowel mix mode). When
 * `false`, the existing same-vowel `TARGET_PAIRINGS` matrix is read.
 * The parent (`WordSongScreen`) computes this once per session from
 * `crossVowelMixingActive(progress, parentSettings)` and passes the
 * boolean down — uniform per session, never per-problem (per spec §4
 * "uniform per session" rule).
 */
function buildChipOrder(
  problem: WordSongProblem,
  crossVowel: boolean,
): readonly WordEntry[] {
  const [d1, d2] =
    problem.contentType === 'letter-names'
      ? pickLetterDistractors(problem.target, problem.index)
      : problem.contentType === 'letter-sounds'
        ? pickSoundDistractors(problem.target, problem.index)
        : pickDistractors(problem.target, problem.index, { crossVowel })
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

/**
 * The 52-glyph ASCII letter pool for the `letter-names` tier (Wave 7
 * A4b, ticket 86c9y6nc7). Mirrors `LETTER_GLYPH_POOL` in
 * `planFromServer.ts` — kept local here to avoid a cross-module import
 * for chip-render code (the parser owns the pool as the wire-validation
 * source of truth; this is the screen-side render pool).
 */
const LETTER_DISTRACTOR_POOL: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
]

/**
 * Pick 2 distractor letters for a letter-names problem. Deterministic
 * per problem index (no `Math.random`) so chip layout is stable across
 * remounts and unit tests. Constraints honoured: (a) distractor case
 * matches the target's case so the trio is case-uniform (avoids the
 * "spot the odd-cased chip" shortcut Kyle's A1 spec §3.2 flags as a
 * giveaway), (b) distractors are distinct from target and from each
 * other, (c) distractors are drawn from `LETTER_DISTRACTOR_POOL` (no
 * digits, no whitespace).
 *
 * This is a render-time placeholder; the canon already encodes Kyle's
 * §1.3 / §3 pedagogical band rules (gentle/trap, b/d/p/q cap, etc.) on
 * the SERVED side and the planner emits the target letter per problem.
 * The screen-side distractor pool here is a graceful default: chips
 * stay distinct + case-uniform, but they are NOT band-tuned to the
 * spec's trap-window rules — that pedagogical layer would require the
 * server to start emitting distractor letters per problem (a wire-shape
 * widening out of A4b scope). Until then this gives a usable chip trio
 * for any in-pool target.
 */
function pickLetterDistractors(
  target: WordEntry,
  problemIndex: number,
): readonly [WordEntry, WordEntry] {
  const letter = target.word
  const isUpper = letter === letter.toUpperCase()
  const caseFilteredPool = LETTER_DISTRACTOR_POOL.filter(
    (g) => (g === g.toUpperCase()) === isUpper && g !== letter,
  )
  // Deterministic two-letter pick. Seed on problem index + a hash of the
  // target letter so different targets at the same index pick different
  // distractor pairs.
  const seed = (problemIndex * 31 + letter.charCodeAt(0) + 0xa5) >>> 0
  const rng = lcg(seed)
  const pool = caseFilteredPool.slice()
  // Fisher-Yates partial shuffle — take the first two after shuffling.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const [g1, g2] = pool
  return [letterToTargetEntry(g1!), letterToTargetEntry(g2!)]
}

/**
 * Build a render-side synthetic `WordEntry` for a distractor letter
 * glyph. Mirrors the parser's `makeLetterTargetEntry` so the
 * letter-names chip pipeline is uniform — chips that compare
 * `entry.word === problem.target.word` continue to work bit-identically
 * to the word-tier chips.
 */
function letterToTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `letter:${letter}`,
    category: 'object',
    isTarget: false,
  }
}

/**
 * Pick 2 distractor letters for a letter-sounds problem. Deterministic
 * per problem index (no `Math.random`) so chip layout is stable across
 * remounts and unit tests. Constraints honoured: (a) distractors are
 * drawn from `LETTER_SOUNDS_POOL` (the 19-letter Wave-7 pool per spec
 * §1.1 — single source of truth in `letterSoundsPool.ts`, shared with
 * the wire parser in `planFromServer.ts`), (b) distractors are
 * distinct from target and from each other, (c) distractors share the
 * target's case (the pool is uppercase, so this is implicit today —
 * pool-case-equality is asserted in the test suite).
 *
 * This is a render-time placeholder; Kyle's A5 spec §3 calls for
 * band-aware distractor selection (gentle = clean-distinct, gentle-
 * mixed = within-class trap, trap = voiced/unvoiced pair) but that
 * pedagogical layer requires the planner to emit distractor letters
 * per problem (a wire-shape widening out of A8b scope per the Wave 7
 * dispatch brief). Mirrors A4b's `pickLetterDistractors` posture —
 * usable chip trio with case-uniform distinct letters, but NOT band-
 * tuned. The /i/-/e/ adjacency ban from spec §3.2 is also a planner
 * concern, not a render concern.
 */
function pickSoundDistractors(
  target: WordEntry,
  problemIndex: number,
): readonly [WordEntry, WordEntry] {
  const letter = target.word
  const pool = LETTER_SOUNDS_POOL.filter((g) => g !== letter)
  // Deterministic two-letter pick. Seed on problem index + a hash of
  // the target letter so different targets at the same index pick
  // different distractor pairs.
  const seed = (problemIndex * 31 + letter.charCodeAt(0) + 0xb7) >>> 0
  const rng = lcg(seed)
  const shuffled = pool.slice()
  // Fisher-Yates partial shuffle — take the first two after shuffling.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const [g1, g2] = shuffled
  return [soundLetterToTargetEntry(g1!), soundLetterToTargetEntry(g2!)]
}

/**
 * Build a render-side synthetic `WordEntry` for a distractor letter
 * glyph in the letter-sounds tier. Mirrors the parser's
 * `makeLetterSoundTargetEntry` so the letter-sounds chip pipeline is
 * uniform — chips that compare `entry.word === problem.target.word`
 * continue to work bit-identically to the word-tier chips.
 *
 * Sentinel `pictureKey` uses the `letter-sounds:<X>` prefix (same as
 * the parser's sentinel) so logging + test assertions can identify the
 * tier from any chip entry without consulting `contentType`.
 */
function soundLetterToTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `letter-sounds:${letter}`,
    category: 'object',
    isTarget: false,
  }
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
