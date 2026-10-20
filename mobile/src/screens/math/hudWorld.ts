/**
 * What differs between the worlds' HUDs (`./MathHud.tsx`): the test-ID
 * prefix and the pop. Math: `HUD_POP_TWEEN` 250 ms to 1.25. Word Song: the
 * web's local HUD copy pops 400 ms to 1.3 (`HUD_POP_MS`, the "reward
 * visible window" fix).
 */
export interface HudWorld {
  idPrefix: string
  popMs: number
  popScale: number
}

export const MATH_HUD: HudWorld = {
  idPrefix: 'math',
  popMs: 250,
  popScale: 1.25,
}

export const WORD_SONG_HUD: HudWorld = {
  idPrefix: 'word-song',
  popMs: 400,
  popScale: 1.3,
}

/** The side mini-games (mini-game spec § 1.4): Math's pop, `game-*` test IDs. */
export const GAME_HUD: HudWorld = {
  idPrefix: 'game',
  popMs: 250,
  popScale: 1.25,
}
