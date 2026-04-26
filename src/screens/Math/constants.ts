/**
 * Math screen constants — extracted from Math.tsx so they can be exported
 * without tripping `react-refresh/only-export-components` (which forbids
 * non-component exports from a file that also exports a React component).
 *
 * Anything externally observable (test asserts, debug overlay, future
 * progress-model integration) lives here. Internal-only timings and
 * spring presets stay in Math.tsx where they're used.
 */

/**
 * Streak thresholds that earn a bonus stardust (Dave-locked at [3, 5, 8]).
 *
 * See `design/research/math-distractor-and-streak-decisions.md` for the
 * developmental-psychology justification (denser early acknowledgment is
 * appropriate for an 8-year-old still building automaticity). If Thomas
 * ever wants to revisit, this is the single source of truth — change here
 * and the screen, the test sweeps, and the audit trail all follow.
 */
export const STREAK_BONUS_THRESHOLDS = [3, 5, 8] as const
