/**
 * The Play place's frames (play-place spec § 1.3): the Hub's frames as
 * they are (Emma, her light and the bubble do not move when the place
 * opens), plus the Map's Home disc and one square tile per open game.
 *
 * A tile's side `t` is the Hub card's width; tile i sits in card i's
 * column at that card's bottom (the thumb zone). With one game, its tile
 * sits centred between the two columns at the same y.
 */
import { hubLayout, type HubLayout } from './hubLayout'
import type { Rect, Viewport } from './layout'
import { mapScreenLayout } from './mapScreenLayout'

export interface PlayPlaceLayout {
  hub: HubLayout
  /** The Map's Home rect: 56 pt on phones, 96 pt on tablets. */
  home: Rect
  /** Two games: one tile per card column. */
  tiles: readonly [Rect, Rect]
  /** One game: its tile, centred between the columns. */
  single: Rect
}

export function playPlaceLayout(v: Viewport): PlayPlaceLayout {
  const hub = hubLayout(v)
  const [a, b] = hub.cards
  const t = a.width
  const tileIn = (card: Rect): Rect => ({
    x: card.x,
    y: card.y + card.height - t,
    width: t,
    height: t,
  })
  const tiles = [tileIn(a), tileIn(b)] as const
  return {
    hub,
    home: mapScreenLayout(v).home,
    tiles,
    single: { ...tiles[0], x: (a.x + b.x + b.width) / 2 - t / 2 },
  }
}

/** The tiles for `count` open games (1 or 2), in tile order. */
export function playTiles(l: PlayPlaceLayout, count: number): Rect[] {
  return count === 1 ? [l.single] : [...l.tiles].slice(0, count)
}
