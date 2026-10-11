/**
 * The Hub's frames against `design/native/hub-native.md` §§ 1-3: the
 * worked numbers at the phone floor, the wider-phone and iPad examples,
 * and the room every card needs around it.
 */
import {
  CARD_ROOM_BOTTOM,
  CARD_ROOM_SIDE,
  CARD_ROOM_TOP,
  hubLayout,
  mapHitSlop,
  type HubLayout,
} from './hubLayout'
import { safeRect, type Rect, type Viewport } from './layout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

function vp(
  width: number,
  height: number,
  insets: Partial<Viewport['insets']> = {},
): Viewport {
  return { width, height, insets: { ...NO_INSETS, ...insets } }
}

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width

/** Every card keeps its crown/bob, ring and shadow room on screen. */
function expectCardRoom(l: HubLayout, v: Viewport) {
  const safe = safeRect(v)
  for (const card of l.cards) {
    expect(card.y - CARD_ROOM_TOP * l.s).toBeGreaterThanOrEqual(safe.y - 0.01)
    expect(bottom(card) + CARD_ROOM_BOTTOM * l.s).toBeLessThanOrEqual(
      bottom(safe) + 0.01,
    )
    expect(card.x - CARD_ROOM_SIDE * l.s).toBeGreaterThanOrEqual(-0.01)
    expect(right(card) + CARD_ROOM_SIDE * l.s).toBeLessThanOrEqual(
      v.width + 0.01,
    )
  }
}

describe('P · phone portrait (375×667 floor)', () => {
  const v = vp(375, 667)
  const l = hubLayout(v)

  it('cards side by side at 163.5 × 290.6 (s 0.4325), 16 pt apart, 24 pt above the bottom', () => {
    expect(l.form).toBe('P')
    const [ng, ws] = l.cards
    expect(ng.width).toBeCloseTo(163.5, 1)
    expect(ng.height).toBeCloseTo(290.67, 2)
    expect(l.s).toBeCloseTo(0.4325, 4)
    expect(ws.x - right(ng)).toBeCloseTo(16, 5)
    expect(bottom(ng)).toBeCloseTo(667 - 24, 5)
    expect(ws.y).toBe(ng.y)
    expectCardRoom(l, v)
  })

  it('Emma 204 pt, centred; the 100 pt bubble slot 12 pt under her, full width', () => {
    expect(l.emma.width).toBeCloseTo(204.2, 1)
    expect(l.emma.x + l.emma.width / 2).toBeCloseTo(375 / 2, 5)
    expect(l.emma.y).toBeCloseTo(8, 5)
    expect(l.bubble.y - bottom(l.emma)).toBeCloseTo(12, 5)
    expect(l.bubble.slotHeight).toBe(100)
    expect(l.bubble.width).toBe(343)
    expect(l.bubble.fontSize).toBe(22)
    expect(l.bubble.tail.side).toBe('top')
    // The slot clears the crown room above the cards by 16 pt.
    expect(l.cards[0].y - CARD_ROOM_TOP * l.s - (l.bubble.y + 100)).toBeCloseTo(
      16,
      5,
    )
  })

  it('a tall screen caps Emma at 40 % of the safe height and splits the rest', () => {
    const tall = vp(375, 900, { top: 20, bottom: 20 })
    const t = hubLayout(tall)
    const safe = safeRect(tall)
    expect(t.emma.width).toBeCloseTo(0.4 * safe.height, 5)
    const above = t.emma.y - (safe.y + 8)
    const below = t.cards[0].y - CARD_ROOM_TOP * t.s - (t.bubble.y + 100) - 16
    expect(above).toBeGreaterThan(0)
    expect(above).toBeCloseTo(below, 5)
    expectCardRoom(t, tall)
  })

  it('map hit area ≥ 56 × 56 and titles ≥ 22 pt at the floor', () => {
    expect(118 * l.s + 2 * mapHitSlop(l.s)).toBeGreaterThanOrEqual(56)
    expect(52 * l.s).toBeGreaterThanOrEqual(22)
  })
})

describe('L · landscape', () => {
  it('phone floor 667×375: s 0.4405, cards 166.5 × 296, column 262, Emma 247', () => {
    const v = vp(667, 375)
    const l = hubLayout(v)
    expect(l.form).toBe('L')
    expect(l.s).toBeCloseTo(0.4405, 4)
    expect(l.cards[0].width).toBeCloseTo(166.5, 1)
    expect(l.cards[0].height).toBeCloseTo(296, 0)
    expect(right(l.cards[1])).toBeCloseTo(667 - 16, 5)
    expect(l.cards[1].x - right(l.cards[0])).toBeCloseTo(16, 5)
    expect(l.bubble.x).toBe(16)
    expect(l.bubble.width).toBeCloseTo(262, 1)
    expect(l.cards[0].x - right({ ...l.bubble, height: 0 })).toBeCloseTo(24, 5)
    expect(l.emma.width).toBeCloseTo(247, 5)
    expect(l.bubble.fontSize).toBe(22)
    expect(l.bubble.slotHeight).toBe(100)
    expect(118 * l.s + 2 * mapHitSlop(l.s)).toBeGreaterThanOrEqual(56)
    expectCardRoom(l, v)
  })

  it('Emma + gap + slot are centred in the safe height', () => {
    const v = vp(844, 390, { left: 47, right: 47, bottom: 21 })
    const l = hubLayout(v)
    const safe = safeRect(v)
    const stack = l.bubble.y + 100 - l.emma.y
    expect(l.emma.y - safe.y).toBeCloseTo(bottom(safe) - (l.emma.y + stack), 5)
  })

  it('844×390 (47 pt sides, 21 pt bottom): s 0.494, column 304', () => {
    const v = vp(844, 390, { left: 47, right: 47, bottom: 21 })
    const l = hubLayout(v)
    expect(l.s).toBeCloseTo(0.494, 3)
    expect(l.bubble.width).toBeCloseTo(304, 0)
    expectCardRoom(l, v)
  })

  it('iPad Air 11" 1180×820 (bottom 20): web-size cards, caption 30, column 352, Emma 440', () => {
    const v = vp(1180, 820, { bottom: 20 })
    const l = hubLayout(v)
    expect(l.form).toBe('L')
    expect(l.tablet).toBe(true)
    expect(l.s).toBe(1)
    expect(l.cards[0]).toMatchObject({ width: 378, height: 672 })
    expect(l.bubble.fontSize).toBe(30)
    expect(l.bubble.slotHeight).toBe(132)
    expect(l.bubble.width).toBeCloseTo(352, 5)
    expect(l.emma.width).toBeCloseTo(440, 5)
    expectCardRoom(l, v)
  })

  it('iPad 10.2" 1080×810: width-bound, s 0.87, column 350, Emma 437', () => {
    const v = vp(1080, 810)
    const l = hubLayout(v)
    expect(l.s).toBeCloseTo(0.87, 2)
    expect(l.cards[0].width).toBeCloseTo(329, 0)
    expect(l.cards[0].height).toBeCloseTo(585, 0)
    expect(l.bubble.width).toBeCloseTo(350, 5)
    expect(Math.floor(l.emma.width)).toBe(437)
    expectCardRoom(l, v)
  })
})

describe('W · tablet portrait = the web stage', () => {
  it('820×1180: every web position at u = 1', () => {
    const l = hubLayout(vp(820, 1180))
    expect(l.form).toBe('W')
    expect(l.s).toBe(1)
    expect(l.emma).toEqual({ x: 200, y: -6, width: 520, height: 520 })
    expect(l.light).toEqual({ x: 250, y: 40, width: 420, height: 420 })
    expect(l.cards).toEqual([
      { x: 24, y: 470, width: 378, height: 672 },
      { x: 418, y: 470, width: 378, height: 672 },
    ])
    expect(l.bubble).toMatchObject({
      x: 26,
      y: 120,
      width: 330,
      slotHeight: null,
      fontSize: 30,
      radius: 34,
      padding: { horizontal: 18, vertical: 14 },
    })
    expect(l.bubble.tail).toMatchObject({ side: 'right', x: 312, y: 34 })
  })

  it('a taller safe area keeps the 820:1180 stage, top-aligned and centred', () => {
    const v = vp(834, 1194, { top: 24, bottom: 20 })
    const l = hubLayout(v)
    const u = ((1194 - 44) * 820) / 1180 / 820
    expect(l.s).toBeCloseTo(u, 6)
    expect(l.garden.origin.y).toBe(24)
    expect(l.garden.origin.x + l.garden.origin.width / 2).toBeCloseTo(417, 5)
    expect(l.emma.y).toBeCloseTo(24 - 6 * u, 5)
  })
})
