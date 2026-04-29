/**
 * Emma pose state machine + animation primitives.
 *
 * Source of truth: `design/character-emma.md` §5 ("Animation hooks contract").
 *
 * Phase 3b (ticket 86c9jccp7) introduces this shared module so each screen
 * can import the same `EmmaPose` union, tilt mapping, and hold-window table.
 * The pre-Emma codebase inlined `MelodyPose = 'idle' | 'happy' | 'puzzled'`
 * in each screen; that is replaced by the wider `EmmaPose` union below.
 *
 * Notes
 * -----
 * - Existing `setPose('happy')` callsites now route to `'celebration'` for
 *   correct-answer reactions. The historical `melody-happy.svg` asset was
 *   overloaded for both correct + waving; Emma splits those into
 *   `'celebration'` (correct-answer) and `'waving'` (Session-End goodbye).
 * - `'puzzled-tilt'` replaces the legacy `'puzzled'` — the spec renames it
 *   to make the sideways-tilt-not-downward-pitch contract obvious in code.
 * - New poses (`'listening'`, `'attentive-pointing'`, `'sleepy'`,
 *   `'cheering'`, `'waving'`) are net-additions for future wiring; existing
 *   call sites do not need to use them.
 */

export type EmmaPose =
  | 'idle'
  | 'listening'
  | 'celebration'
  | 'puzzled-tilt'
  | 'attentive-pointing'
  | 'sleepy'
  | 'cheering'
  | 'waving'

/**
 * Per-pose `rotateZ` value applied via Framer Motion's pose-swap transform.
 * Spec §5.2 — direction matters: celebration tilts LEFT (-6) and
 * puzzled-tilt tilts RIGHT (+10) so the two states read at a glance from
 * Emma's upper-left perch on Math/Word Song. All values are pure rotateZ;
 * never animate `rotateX` (downward head pitch is on Dave's forbidden list
 * per §6.1 — reads as judging).
 *
 * Reduce-motion branch in screen code collapses these to 0.
 */
export const TILT_BY_POSE: Record<EmmaPose, number> = {
  idle: 0,
  listening: 2, // tiny lean toward ribbon
  celebration: -6, // tilt LEFT (correct-answer reaction)
  'puzzled-tilt': 10, // tilt RIGHT (curious — sideways only, never down)
  'attentive-pointing': 0, // wand carries direction
  sleepy: 8, // gentle forward-and-down (eyes closed, no upward gaze)
  cheering: 0,
  waving: 0,
}

/**
 * How long a pose holds before auto-returning to `idle`.
 *
 * `null` ⇒ never auto-returns; the call site clears the pose another way
 * (typically on audio onEnd or on the next user gesture).
 *
 * Values lifted from the legacy Math/Word Song timings so Phase 3b doesn't
 * regress the felt pacing of correct/wrong reactions.
 */
export const POSE_HOLD_MS: Record<EmmaPose, number | null> = {
  idle: null, // baseline; never auto-returns
  listening: null, // returns on caption/audio onEnd
  celebration: 600, // matches legacy ear-wiggle window
  'puzzled-tilt': 1500, // matches legacy puzzled hold
  'attentive-pointing': null, // returns on hint TTS onEnd
  sleepy: null, // sticky on Session-End / Hub idle
  cheering: 1200, // "you did it!" line duration
  waving: 1500, // "Bye for now!" line duration
}
