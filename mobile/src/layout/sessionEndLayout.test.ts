import type { Rect, Viewport } from './layout'
import {
  PHONE_BUTTON_MIN,
  PHONE_CAPTION_PT,
  WEB_HOLE,
  flowerFlight,
  holeRects,
  sessionEndLayout,
  twoLineRibbon,
  type SessionEndLayout,
} from './sessionEndLayout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const vp = (width: number, height: number, insets = NO_INSETS): Viewport => ({
  width,
  height,
  insets,
})

const CASES: [string, Viewport, SessionEndLayout['form']][] = [
  ['iPhone SE portrait (floor)', vp(375, 667), 'phone-portrait'],
  [
    'notched phone portrait',
    vp(402, 874, { top: 62, bottom: 34, left: 0, right: 0 }),
    'phone-portrait',
  ],
  ['Android reference portrait', vp(411, 914), 'phone-portrait'],
  ['iPhone SE landscape (floor)', vp(667, 375), 'phone-landscape'],
  [
    'floor landscape + home indicator',
    vp(667, 375, { top: 0, bottom: 21, left: 0, right: 0 }),
    'phone-landscape',
  ],
  [
    'notched phone landscape',
    vp(874, 402, { top: 0, bottom: 21, left: 62, right: 62 }),
    'phone-landscape',
  ],
  ['iPad portrait (web frame)', vp(820, 1180), 'tablet-portrait'],
  ['iPad mini portrait', vp(744, 1133), 'tablet-portrait'],
  ['iPad landscape', vp(1180, 820), 'tablet-landscape'],
  ['iPad mini landscape', vp(1133, 744), 'tablet-landscape'],
]

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width
const inside = (outer: Rect, r: Rect) =>
  r.x >= outer.x - 0.5 &&
  r.y >= outer.y - 0.5 &&
  right(r) <= right(outer) + 0.5 &&
  bottom(r) <= bottom(outer) + 0.5

describe.each(CASES)('%s', (_name, viewport, form) => {
  const l = sessionEndLayout(viewport)

  it(`is ${form}`, () => {
    expect(l.form).toBe(form)
  })

  it('stacks panel → buttons → caption inside the safe area, no overlaps', () => {
    expect(l.panel.y).toBeGreaterThanOrEqual(l.safe.y)
    // The panel's slab sits in the gap above the buttons.
    expect(bottom(l.panel) + l.panelSlab).toBeLessThanOrEqual(l.buttons.y)
    expect(bottom(l.buttons)).toBeLessThanOrEqual(l.captionSlot.y + 0.5)
    expect(bottom(l.captionSlot)).toBeLessThanOrEqual(bottom(l.safe))
    expect(inside(l.safe, l.panel)).toBe(true)
    expect(inside(l.safe, l.buttons)).toBe(true)
    expect(inside(l.safe, l.captionSlot)).toBe(true)
  })

  it('Emma is inside the safe area and clear of the panel column', () => {
    expect(inside(l.safe, l.emma)).toBe(true)
    if (l.landscape) {
      expect(right(l.emma)).toBeLessThanOrEqual(l.panel.x)
    } else {
      expect(bottom(l.emma)).toBeLessThanOrEqual(l.panel.y)
    }
  })

  it('the caption slot always holds a two-line ribbon, never below 22 pt', () => {
    expect(l.captionSlot.height).toBeGreaterThanOrEqual(
      twoLineRibbon(l.caption),
    )
    expect(l.caption.font).toBeGreaterThanOrEqual(PHONE_CAPTION_PT)
  })

  it('the stars, the step + tray row and the count fit inside the panel', () => {
    const panel = { x: 0, y: 0, width: l.panel.width, height: l.panel.height }
    expect(inside(panel, l.inner.stars.rect)).toBe(true)
    expect(inside(panel, l.inner.step)).toBe(true)
    expect(inside(panel, l.inner.tray.rect)).toBe(true)
    expect(inside(panel, l.inner.count.rect)).toBe(true)
    expect(right(l.inner.step)).toBeLessThanOrEqual(l.inner.tray.rect.x)
  })

  it('the buttons fit the row: All done, and Again + Home side by side', () => {
    const b = l.button
    expect(b.widths.allDone).toBeLessThanOrEqual(l.buttons.width)
    expect(b.widths.homeAlone).toBeLessThanOrEqual(l.buttons.width)
    expect(b.widths.again + b.gap + b.widths.homeWithAgain).toBeLessThanOrEqual(
      l.buttons.width,
    )
    expect(b.height).toBeLessThanOrEqual(l.buttons.height)
    if (!l.tablet) expect(b.height).toBeGreaterThanOrEqual(PHONE_BUTTON_MIN)
  })

  it("today's flower flies to the centre of its hole at the hole's size", () => {
    for (const count of [2, 3]) {
      const holes = holeRects(l.inner.tray.rect, l.inner.hole, count)
      for (let slot = 0; slot < count; slot++) {
        const f = flowerFlight(l.inner, slot, count)
        const from = l.inner.newFlower
        const h = holes[slot]!
        const tray = l.inner.tray.rect
        expect(from.x + from.width / 2 + f.x).toBeCloseTo(
          tray.x + h.x + h.width / 2,
        )
        expect(from.y + from.height / 2 + f.y).toBeCloseTo(
          tray.y + h.y + h.height / 2,
        )
        expect(from.width * f.scale).toBeCloseTo(l.inner.hole, -1)
      }
    }
  })
})

it('tablet portrait at the web frame (820×1180) uses the web numbers', () => {
  const l = sessionEndLayout(vp(820, 1180))
  expect(l.emma.height).toBeCloseTo(0.33 * 1180)
  expect(l.panel.width).toBe(720)
  expect(l.panel.height).toBe(430)
  expect(l.inner.hole).toBe(WEB_HOLE)
  expect(l.inner.stars.size).toBe(46)
  expect(l.inner.tray.rect.width).toBe(350)
  expect(l.inner.tray.rect.height).toBe(116)
  expect(l.inner.newFlower.width).toBe(120)
  expect(l.button.height).toBe(112)
  expect(l.button.widths).toEqual({
    allDone: 360,
    again: 330,
    homeWithAgain: 220,
    homeAlone: 300,
  })
  expect(l.caption.font).toBe(29)
})

it('phone landscape gives the tray what height is left, down to the floor', () => {
  const se = sessionEndLayout(vp(667, 375))
  const inset = sessionEndLayout(
    vp(667, 375, { top: 0, bottom: 21, left: 0, right: 0 }),
  )
  expect(inset.inner.hole).toBeLessThan(se.inner.hole)
  expect(inset.inner.hole).toBeGreaterThanOrEqual(40)
})

it('holeRects spaces the holes around (web `space-around`)', () => {
  const holes = holeRects({ x: 0, y: 0, width: 350, height: 116 }, 86, 3)
  expect(holes.map((h) => Math.round(h.x))).toEqual([15, 132, 249])
  expect(holes.every((h) => h.y === 15)).toBe(true)
})
