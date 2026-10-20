/**
 * The Play place's frames (play-place § 1.3, AC N4): the Hub's frames as
 * they are, the Map's Home rect, and the tiles at the card columns' foot.
 */
import { hubLayout } from './hubLayout'
import type { Viewport } from './layout'
import { mapScreenLayout } from './mapScreenLayout'
import { playPlaceLayout, playTiles } from './playPlaceLayout'

const vp = (
  width: number,
  height: number,
  insets: Partial<Viewport['insets']> = {},
): Viewport => ({
  width,
  height,
  insets: { top: 0, bottom: 0, left: 0, right: 0, ...insets },
})

describe.each([
  ['375×667', vp(375, 667), 163.5],
  ['667×375', vp(667, 375), 166.5],
  ['820×1180 (t24 b20)', vp(820, 1180, { top: 24, bottom: 20 }), 364],
  ['1180×820 (b20)', vp(1180, 820, { bottom: 20 }), 378],
])('%s', (_n, v, t) => {
  const l = playPlaceLayout(v)
  const hub = hubLayout(v)

  it('keeps the Hub frames, and Home at the Map’s Home rect', () => {
    expect(l.hub).toEqual(hub)
    expect(l.home).toEqual(mapScreenLayout(v).home)
    expect(l.home.width).toBe(v.width < 768 && v.height < 768 ? 56 : 96)
  })

  it(`two tiles of ${t}, bottom-aligned in the card columns`, () => {
    hub.cards.forEach((card, i) => {
      const tile = l.tiles[i]!
      expect(tile.width).toBeCloseTo(t, 0)
      expect(tile.height).toBe(tile.width)
      expect(tile.x).toBe(card.x)
      expect(tile.y + tile.height).toBeCloseTo(card.y + card.height, 5)
    })
    expect(playTiles(l, 2)).toEqual([...l.tiles])
  })

  it('one tile: centred between the columns, at the same y', () => {
    const [a, b] = hub.cards
    const [one] = playTiles(l, 1)
    expect(playTiles(l, 1)).toHaveLength(1)
    expect(one!.x + one!.width / 2).toBeCloseTo((a.x + b.x + b.width) / 2, 5)
    expect(one!.y).toBe(l.tiles[0].y)
  })
})
