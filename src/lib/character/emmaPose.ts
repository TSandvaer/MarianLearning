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
 * Per-pose spring config for the rotateZ tilt animation.
 *
 * Spec: `design/character/motion-brief.md` §3.2-§3.3.
 *
 * Default house spring is `stiffness: 260, damping: 20` — the same
 * config used on Math's ribbon scale-in, so Emma's motion vocabulary
 * stays coherent across the app.
 *
 * `puzzled-tilt` uses a softer spring (`stiffness: 220`) — 18% softer
 * than the default. The puzzled tilt arrives with a hair more lag and
 * reads as "considering" rather than "reacting". On iPad the difference
 * is small but legible.
 *
 * `celebration` is the one pose that does NOT use a spring transition —
 * see the `CELEBRATION_*` keyframe constants below. Iteration #1 on
 * 2026-05-01 (ticket 86c9kxmqb) softened the spring to 200/22, but
 * Thomas's iPad Pro re-test still reported "I hardly see the second
 * pose" — the symptom of an instantaneous apex with no hold beat.
 * Iteration #2 (same ticket) replaces the spring with a keyframed
 * tilt-out → hold → tilt-back so the celebrate pose is visibly held at
 * the apex for ~250ms. The spring config below is kept for non-keyframe
 * fallback paths only; the active path is keyframes.
 */
export interface TiltSpring {
  readonly stiffness: number
  readonly damping: number
}

export const TILT_SPRING_BY_POSE: Record<EmmaPose, TiltSpring> = {
  idle: { stiffness: 260, damping: 20 },
  listening: { stiffness: 260, damping: 20 },
  // Kept for documentation / fallback. The active celebration motion is
  // keyframed — see CELEBRATION_* constants below. Iteration #2 raised
  // the firmness from 200 → 220 because the hold beat is doing the
  // visibility work; the spring just needs to feel deliberate.
  celebration: { stiffness: 220, damping: 22 },
  'puzzled-tilt': { stiffness: 220, damping: 20 }, // softer — "considering"
  'attentive-pointing': { stiffness: 260, damping: 20 },
  sleepy: { stiffness: 260, damping: 20 },
  cheering: { stiffness: 260, damping: 20 },
  waving: { stiffness: 260, damping: 20 },
}

/**
 * Celebration tilt — keyframed sequence (iteration #2, ticket 86c9kxmqb).
 *
 * Why keyframes instead of a single spring
 * ----------------------------------------
 * Iteration #1 (PR #131) softened the spring to 200/22. Thomas's iPad
 * Pro re-test still reported "I hardly see the second pose" — the
 * symptom of an instantaneous apex with no hold beat. A spring-out
 * + spring-back motion has no time AT the celebrate pose; the user
 * sees the start of the tilt and then it's already returning.
 *
 * Iteration #2 inserts a hold beat at the apex. Sequence:
 *
 *   1. Tilt out: rotate 0 → -6° over ~200ms (`easeOut`)
 *   2. Hold:    rotate stays at -6° for 250ms (`linear`)
 *   3. Tilt back: rotate -6 → 0° over ~250ms (`easeInOut`)
 *
 * Total motion duration: 700ms. Hold = ~36% of total — plenty of apex
 * visibility per Thomas's feedback while staying under the 800ms
 * upper bound (above which the motion starts to feel laggy).
 *
 * Implementation in EmmaCharacter.tsx uses Framer Motion's keyframe
 * + `times` form rather than a multi-segment animate sequence — same
 * shape, simpler component, and compatible with the existing per-pose
 * `animate.rotate` driven by `TILT_BY_POSE`.
 *
 * Reduce-motion path: keyframes collapse to `rotate: 0` (no tilt, no
 * hold) — same as the spring path before iteration #2.
 */
export const CELEBRATION_HOLD_MS = 250
export const CELEBRATION_DURATION_MS = 700
export const CELEBRATION_DURATION_S = CELEBRATION_DURATION_MS / 1000

/**
 * Keyframe timing as fractions of `CELEBRATION_DURATION_MS`. The middle
 * two keyframes (`-6, -6`) bracket the hold beat — the segment between
 * `times[1]` and `times[2]` is the linear hold at the apex.
 *
 * Math: 200ms tilt-out + 250ms hold + 250ms tilt-back = 700ms total.
 *   times[1] = 200 / 700   ≈ 0.286
 *   times[2] = (200+250)/700 ≈ 0.643
 */
export const CELEBRATION_TILT_KEYFRAMES = [0, -6, -6, 0] as const
export const CELEBRATION_TILT_TIMES = [0, 0.286, 0.643, 1] as const
export const CELEBRATION_TILT_EASES = ['easeOut', 'linear', 'easeInOut'] as const

/**
 * Idle breathing scale loop. Spec: `design/character/motion-brief.md`
 * §3.5. Scales `[1, 1.02, 1]` over 4s, ease-in-out, infinite. Only
 * applies while pose === 'idle'; non-idle poses are short and breathing
 * during them dilutes the celebration / puzzled beats.
 *
 * Reduce-motion path collapses this to `scale: 1` (no keyframe array).
 */
export const BREATHING_SCALE_KEYFRAMES = [1, 1.02, 1] as const
export const BREATHING_PERIOD_S = 4

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
