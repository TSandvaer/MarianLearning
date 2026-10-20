/**
 * The mini-games' words (mini-game spec `design/native/mini-game-flower-bed.md`
 * § 3): every spoken line is a core `GUIDANCE_LINES` row of kind `'game'`
 * (`guide.game.*`, Lily, `/assets/audio/path/guide-game-*.mp3`), played
 * through one manifest line player (`game`) with word ticks for the ribbon.
 * The player never rejects; without a clip (a line awaiting its render) it
 * walks the caption at 165 wpm, so the chip gate always opens. The labels
 * nobody speaks (VoiceOver only, § 3.2) sit here too, so a language version
 * swaps rows, not screens.
 */
import { GUIDANCE_LINES } from '@marian/core/emmasPath/guidanceLines'
import type { GameId } from '@marian/core/games/miniGames'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from '../../audio/manifestLines'

/** A bed's given part, 1-9. */
type Given = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type GameLineId =
  | 'guide.game.again'
  | `guide.game.this-is.${Given}`
  | 'guide.game.bed.open'
  | `guide.game.bed.ask.${Given}`
  | `guide.game.bed.yes.${Given}`
  | 'guide.game.bed.close'

export const GAME_LINE_MANIFEST: Readonly<Record<GameLineId, ManifestLine>> =
  Object.fromEntries(
    GUIDANCE_LINES.filter((l) => l.kind === 'game').map((l) => [
      l.id,
      { src: l.src, text: l.text },
    ]),
  ) as Record<GameLineId, ManifestLine>

export type GameLinePlayer = ManifestLinePlayer<GameLineId>

export function createGameLinePlayer(): GameLinePlayer {
  return createManifestLinePlayer<GameLineId>('game', GAME_LINE_MANIFEST)
}

/** Fill the flower bed's lines for a bed of `given` (1-9). */
export const bedLines = (given: number) => ({
  ask: `guide.game.bed.ask.${given}` as GameLineId,
  yes: `guide.game.bed.yes.${given}` as GameLineId,
})

/** The guided answer, "This one is <n>." (any game). */
export const thisIsLine = (n: number) => `guide.game.this-is.${n}` as GameLineId

/** § 3.2: the play door's VoiceOver label, per game. */
export const GAME_DOOR_LABELS: Readonly<Record<GameId, string>> = {
  'flower-bed': 'Fill the flower bed',
}
