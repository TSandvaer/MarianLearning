/**
 * What the game frame (`PlayGameScreen`) hands each Play-place game: its
 * play area, Emma's lines and poses, the effects, and beats that the frame
 * clears on Back and that wait while the app is hidden (play-place § 1.7).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { Rect, Viewport } from '../../layout/layout'
import { createSfx, SFX_SOURCES, type Sfx } from '../../audio'
import type { PlayLineId } from './playLines'

/**
 * The two new effects (§ 5.3, T5). Not bundled yet: until the files land
 * in `public/assets/` (and `npm run export-audio` registers them),
 * `createSfx` warns once and plays nothing.
 */
export const PLAY_SFX_SOURCES = {
  splash: '/assets/sfx-splash.mp3',
  boing: '/assets/sfx-boing.mp3',
} as const

/** § 1.7: the shipped plink, sparkle and cheer, plus splash and boing. */
export interface PlaySfx {
  plink: Sfx
  sparkle: Sfx
  cheer: Sfx
  splash: Sfx
  boing: Sfx
}

export function createPlaySfx(): PlaySfx {
  return {
    plink: createSfx({ src: SFX_SOURCES.plink, volume: 0.3 }),
    sparkle: createSfx({ src: SFX_SOURCES.sparkle, volume: 0.55 }),
    cheer: createSfx({ src: SFX_SOURCES.cheer, volume: 0.5 }),
    splash: createSfx({ src: PLAY_SFX_SOURCES.splash }),
    boing: createSfx({ src: PLAY_SFX_SOURCES.boing }),
  }
}

export function unloadPlaySfx(sfx: PlaySfx): void {
  Object.values(sfx).forEach((s: Sfx) => s.unload())
}

export interface GameKit {
  /** The play area `A` (§ 1.7), and the frame's form. */
  area: Rect
  tablet: boolean
  landscape: boolean
  /** The screen the frame is laid out from (the critters' fit, § 3.2). */
  viewport: Viewport
  /** Back's disc (§ 1.7): the word hunt's New letters sits beside it. */
  back: Rect
  reducedMotion: boolean
  /**
   * Plays a line, cutting the one before it; resolves `true` when it ended
   * as itself (not cut, not left).
   */
  speak: (id: PlayLineId) => Promise<boolean>
  /** Cuts the line in flight. */
  cutLine: () => void
  setPose: (pose: EmmaPose) => void
  /** A timer the frame clears when the game is left. */
  later: (fn: () => void, ms: number) => void
  /** A beat that, falling due while the app is hidden, waits for its return. */
  advance: (fn: () => void, ms: number) => void
  sfx: PlaySfx
  /** Changes on a background or a new layout: drags in flight spring home. */
  cancelKey: string
  /** The natural stop: back to the Play place, silent. */
  done: () => void
  rng: () => number
}
