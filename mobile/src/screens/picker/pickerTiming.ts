/**
 * The picker's timings (learner profiles § 1.3, § 1.4), shared by the
 * screen and its tests.
 */
/** Emma's Hub entrance (her fade) before the first tile moves. */
export const TILES_IN_AT_MS = 250
export const TILE_STAGGER_MS = 60
/** A tile's spring has landed this long after it starts. */
export const TILE_LAND_MS = 400
/** Reduce Motion: every tile fades in at once over this long. */
export const TILE_FADE_MS = 200
/** The line starts this long after the last tile lands. */
export const LINE_AFTER_TILES_MS = 300
/** No tap this long after the line ends: the line once more. */
export const PICKER_REPROMPT_AFTER_MS = 20_000
/** A pick changes the route this long after the tap (Greet's heart). */
export const PICK_ROUTE_DELAY_MS = 400
export const PICK_PULSE_MS = 300

/** When "Who is playing?" starts, ms after mount. */
export function pickerLineAt(count: number, reducedMotion: boolean): number {
  const landed = reducedMotion
    ? TILES_IN_AT_MS + TILE_FADE_MS
    : TILES_IN_AT_MS + Math.max(0, count - 1) * TILE_STAGGER_MS + TILE_LAND_MS
  return landed + LINE_AFTER_TILES_MS
}
