/**
 * Gameplay constants shared between Math and Word Song screens.
 *
 * These constants define the shared UX contract for the problem-solving
 * screens: wrong-answer escalation policy, timing, streak thresholds,
 * and animation presets. Previously duplicated inline in Math.tsx and
 * WordSong.tsx; extracted here as the single source of truth.
 *
 * Screen-specific constants (e.g. Word Song's EAR_WIGGLE_MS, HUD_POP_MS,
 * SPARKLE_BURST_MS) remain local to their screen files.
 */

// ── Wrong-answer escalation policy ──────────────────────────────────────

/** Wrong-attempt count after which the hint utterance fires.
 *  Spec: "After 2 wrong attempts on the same problem." */
export const HINT_AFTER_WRONG_COUNT = 2

/** Wrong-attempt count after which the guided-completion path fires. */
export const GUIDED_AFTER_WRONG_COUNT = 3

// ── Timing ──────────────────────────────────────────────────────────────

/** Auto-advance delay (ms) after a correct answer.
 *  Spec §"Audio dispatch sequence on chip tap (correct)".
 *
 *  This is the MINIMUM dwell on the celebration state. The actual advance
 *  also waits for the celebration utterance (`speak(utterances.correct)`)
 *  to resolve — see `ADVANCE_HARD_CEILING_MS` for the upper bound. The
 *  pattern is `max(animationDuration, audioDuration)` so the celebration
 *  audio is always heard in full while the visual cadence stays predictable.
 *
 *  Provenance: ticket 86c9j60qr. Pre-fix this was a fixed setTimeout that
 *  cut Emma's longer renders mid-utterance ("Yes!" cut before "[number]").
 *  The voice swap to Emma in PR #99 surfaced a pre-existing race — the
 *  advance was never gated on celebration-audio completion; it just
 *  happened to align when audio was Ana-short. */
export const ADVANCE_AFTER_CORRECT_MS = 1200

/** Hard upper bound (ms) on the celebration-state dwell after a correct
 *  answer. Even if the celebration `speak()` promise never resolves
 *  (audio engine wedged, network blob fetch hung, etc.), the advance
 *  fires at this point so the screen never bricks. Sized to comfortably
 *  outlast Emma's longest correct utterance (~2.1s) plus slack for the
 *  natural end-gap and any post-onend microtask lag.
 *
 *  Provenance: ticket 86c9j60qr. Mirrors the "audio failed but UI must
 *  still proceed" defence pattern from PR #88/#89 (ticket 86c9hf4ef
 *  round 2), where a missing `onend` event would otherwise lock chips. */
export const ADVANCE_HARD_CEILING_MS = 4000

/** Wrong-tap chip shake duration (ms). Spec §"Wrong-answer policy" item 1. */
export const WRONG_SHAKE_MS = 400

/** Hint reveal delay (ms) after the wrong sequence completes. */
export const HINT_DELAY_AFTER_WRONG_MS = 600

/** Streak fade-out duration (ms) when a wrong tap breaks the streak. */
export const STREAK_FADE_OUT_MS = 400

/**
 * Audio-unlock watchdog window (ms).
 *
 * Sized to outlast the event-driven AudioContext resume await (5 000 ms)
 * plus the Howler play -> onplay settle (~50 ms) plus slack. Phase-7
 * (ticket 86c9gvd0y) bumped this from 1 500 ms -> 6 000 ms.
 *
 * Used by Greet, Math, and Word Song screens identically.
 */
export const FIRST_UTTERANCE_RETRY_MS = 6_000

// ── Streak / stardust ───────────────────────────────────────────────────

/**
 * Streak thresholds that earn a bonus stardust (Dave-locked at [3, 5, 8]).
 *
 * See `design/research/math-distractor-and-streak-decisions.md` for the
 * developmental-psychology justification. If Thomas ever wants to revisit,
 * this is the single source of truth.
 */
export const STREAK_BONUS_THRESHOLDS = [3, 5, 8] as const

// ── Animation presets ───────────────────────────────────────────────────

/** Spring preset for chip tap animations. Shared between Math and Word Song. */
export const CHIP_TAP_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 18,
}
