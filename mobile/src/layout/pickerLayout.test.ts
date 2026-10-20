/**
 * "Who is playing?" geometry (learner profiles § 1.2) and the Hub badge
 * (§ 2.1): tiles in the Hub's card area, the spec's smallest tiles, the
 * badge top-left with a 56 × 56 target, and the rect Emma's press leaves
 * out.
 */
import { hubLayout } from './hubLayout'
import type { Rect, Viewport } from './layout'
import {
  BADGE_HIT,
  BADGE_SIZE,
  TILE_GAP,
  badgeExclusion,
  cardArea,
  containsPoint,
  hubBadge,
  pickerGrid,
  pickerLayout,
} from './pickerLayout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PHONE_P: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const PHONE_L: Viewport = { width: 667, height: 375, insets: NO_INSETS }
const TABLET_P: Viewport = { width: 820, height: 1180, insets: NO_INSETS }
const NOTCHED_L: Viewport = {
  width: 852,
  height: 393,
  insets: { top: 0, bottom: 21, left: 59, right: 59 },
}

const inside = (r: Rect, outer: Rect) =>
  r.x >= outer.x - 1e-6 &&
  r.y >= outer.y - 1e-6 &&
  r.x + r.width <= outer.x + outer.width + 1e-6 &&
  r.y + r.height <= outer.y + outer.height + 1e-6

describe('the picker grid', () => {
  it('puts 2 or 3 learners in one row and 4 in 2 × 2', () => {
    expect(pickerGrid(2)).toEqual({ columns: 2, rows: 1 })
    expect(pickerGrid(3)).toEqual({ columns: 3, rows: 1 })
    expect(pickerGrid(4)).toEqual({ columns: 2, rows: 2 })
  })

  it('the smallest tiles: 103 × 130 at 3 on the 375 floor, 166 × 140 at 4 on the 667 × 375 floor', () => {
    const p3 = pickerLayout(PHONE_P, 3).tiles[0]!
    expect(Math.floor(p3.width)).toBe(103)
    expect(Math.round(p3.height)).toBe(130)
    const l4 = pickerLayout(PHONE_L, 4).tiles[0]!
    expect(Math.floor(l4.width)).toBe(166)
    expect(Math.round(l4.height)).toBe(140)
  })

  it.each([
    ['phone portrait', PHONE_P],
    ['phone landscape', PHONE_L],
    ['tablet portrait', TABLET_P],
    ['notched landscape', NOTCHED_L],
  ])(
    '%s: Emma and her bubble keep the Hub frame; tiles sit in R, bottom-anchored, 16 pt apart',
    (_name, v) => {
      const hub = hubLayout(v)
      for (const n of [2, 3, 4]) {
        const layout = pickerLayout(v, n)
        expect(layout.emma).toEqual(hub.emma)
        expect(layout.bubble).toEqual(hub.bubble)
        const r = cardArea(hub)
        expect(layout.tiles).toHaveLength(n)
        for (const t of layout.tiles) expect(inside(t, r)).toBe(true)
        const bottom = Math.max(...layout.tiles.map((t) => t.y + t.height))
        expect(bottom).toBeCloseTo(r.y + r.height, 6)
        const [a, b] = layout.tiles
        expect(b!.x - (a!.x + a!.width)).toBeCloseTo(TILE_GAP, 6)
        // The disc fits the tile, with the name line and its room.
        expect(layout.disc).toBeLessThanOrEqual(0.72 * a!.width + 1e-6)
        expect(layout.disc).toBeGreaterThan(0)
      }
    },
  )

  it('keeps add order in reading order (4: two rows of two)', () => {
    const [a, b, c, d] = pickerLayout(PHONE_L, 4).tiles
    expect(a!.y).toBe(b!.y)
    expect(c!.y).toBe(d!.y)
    expect(c!.y).toBeGreaterThan(a!.y)
    expect(a!.x).toBe(c!.x)
    expect(b!.x).toBeGreaterThan(a!.x)
  })

  it('names at the Hub caption size: 22 pt on phones, 30 pt on tablets', () => {
    expect(pickerLayout(PHONE_P, 2).nameSize).toBe(22)
    expect(pickerLayout(TABLET_P, 2).nameSize).toBe(30)
  })
})

describe('the Hub badge', () => {
  it.each([
    ['P', PHONE_P],
    ['L', PHONE_L],
    ['W', TABLET_P],
    ['notched L', NOTCHED_L],
  ])(
    '%s: a 48 pt disc at safe top + 8, safe left + 16, in a 56 × 56 target',
    (_name, v) => {
      const hub = hubLayout(v)
      const { disc, hit } = hubBadge(hub)
      expect(disc).toEqual({
        x: hub.safe.x + 16,
        y: hub.safe.y + 8,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
      })
      expect(hit.width).toBe(BADGE_HIT)
      expect(hit.height).toBe(BADGE_HIT)
      expect(hit.x + hit.width / 2).toBe(disc.x + disc.width / 2)
      expect(hit.y + hit.height / 2).toBe(disc.y + disc.height / 2)
    },
  )

  it('P: clears Emma (her frame starts at x 85.5 on the 375 floor)', () => {
    const hub = hubLayout(PHONE_P)
    expect(hub.emma.x).toBeCloseTo(85.5, 0)
    const { disc } = hubBadge(hub)
    expect(disc.x + disc.width).toBeLessThan(hub.emma.x)
  })

  it("Emma's press leaves out the badge's target plus 8 pt", () => {
    const hub = hubLayout(PHONE_L)
    const { hit } = hubBadge(hub)
    const out = badgeExclusion(hub)
    expect(containsPoint(out, hit.x - 8, hit.y - 8)).toBe(true)
    expect(containsPoint(out, hit.x + hit.width + 8, hit.y)).toBe(true)
    expect(containsPoint(out, hit.x + hit.width + 9, hit.y)).toBe(false)
  })
})
