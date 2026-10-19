/**
 * The take-away picture's sizes (`design/native/take-away-picture.md` § 2,
 * AC 3): one ten-frame for sub-to-10, a double ten-frame for sub-to-20, in
 * the counting row's slot. Pins § 2's hand-computed table.
 *
 * Failing-first: written before `takeAwayMetrics` existed.
 */
import type { Viewport } from './layout'
import { mathLayout, takeAwayMetrics } from './mathLayout'

const insets = (top = 0, bottom = 0, left = 0, right = 0) => ({
  top,
  bottom,
  left,
  right,
})

const PORTRAIT: Viewport = { width: 375, height: 667, insets: insets() }
/** The floor in landscape: the 64 pt slot. */
const LANDSCAPE_64: Viewport = { width: 667, height: 375, insets: insets() }
/** A home indicator takes the slot down to 56 pt. */
const LANDSCAPE_56: Viewport = {
  width: 667,
  height: 375,
  insets: insets(0, 21),
}
const IPAD_PORTRAIT: Viewport = {
  width: 744,
  height: 1133,
  insets: insets(24, 20),
}
const IPAD_LANDSCAPE: Viewport = {
  width: 1133,
  height: 744,
  insets: insets(24, 20),
}

const PHONES: Record<string, Viewport> = {
  'floor portrait 375×667': PORTRAIT,
  'floor landscape 667×375': LANDSCAPE_64,
  'floor landscape + 21 pt home indicator': LANDSCAPE_56,
  'iPhone 17e portrait': { width: 390, height: 844, insets: insets(47, 34) },
  'iPhone 17e landscape': {
    width: 844,
    height: 390,
    insets: insets(0, 21, 47, 47),
  },
  'Android 411×914 portrait': {
    width: 411,
    height: 914,
    insets: insets(24, 24),
  },
  'Android 914×411 landscape': {
    width: 914,
    height: 411,
    insets: insets(0, 0, 24, 24),
  },
}

function metrics(v: Viewport, step: 'sub-to-10' | 'sub-to-20') {
  const l = mathLayout(v)
  return takeAwayMetrics(l, step, l.problem.width)
}

/** [flower, frame W, frame H] for sub-to-10; plus the pair's width for
 *  sub-to-20; and the lift's rise. */
const TABLE: [
  string,
  Viewport,
  number | null,
  [number, number, number],
  [number, number, number, number],
  number,
][] = [
  [
    'phone portrait 375×667',
    PORTRAIT,
    80,
    [24, 168, 72],
    [20, 148, 64, 320],
    24,
  ],
  [
    'phone landscape, 64 pt slot',
    LANDSCAPE_64,
    64,
    [23, 151, 64],
    [20, 136, 58, 296],
    16,
  ],
  [
    'phone landscape, 56 pt slot',
    LANDSCAPE_56,
    56,
    [19, 131, 56],
    [19, 131, 56, 286],
    16,
  ],
  [
    'tablet portrait 744×1133',
    IPAD_PORTRAIT,
    null,
    [48, 288, 120],
    [40, 248, 104, 528],
    32,
  ],
  [
    'tablet landscape 1133×744',
    IPAD_LANDSCAPE,
    null,
    [48, 288, 120],
    [40, 248, 104, 528],
    32,
  ],
]

describe.each(TABLE)(
  '§ 2 table: %s',
  (_name, v, slot, [f10, w10, h10], [f20, w20, h20, pair], rise) => {
    it('sits in the expected slot', () => {
      expect(mathLayout(v).visualSlot).toBe(slot)
    })

    it(`sub-to-10: ${f10} pt flowers in a ${w10}×${h10} frame`, () => {
      const m = metrics(v, 'sub-to-10')
      expect(m.frames).toBe(1)
      expect(m.flower).toBe(f10)
      expect([m.frameWidth, m.frameHeight]).toEqual([w10, h10])
      expect([m.width, m.height]).toEqual([w10, h10])
      expect(m.liftRise).toBe(rise)
    })

    it(`sub-to-20: ${f20} pt flowers in two ${w20}×${h20} frames, ${pair} wide`, () => {
      const m = metrics(v, 'sub-to-20')
      expect(m.frames).toBe(2)
      expect(m.flower).toBe(f20)
      expect([m.frameWidth, m.frameHeight]).toEqual([w20, h20])
      expect(m.width).toBe(pair)
      expect(m.height).toBe(h20)
      expect(m.liftRise).toBe(rise)
    })
  },
)

it('the gaps: 8 pt (6 in phone landscape), 24 pt between frames (tablet 32)', () => {
  expect(metrics(PORTRAIT, 'sub-to-20')).toMatchObject({ gap: 8, between: 24 })
  expect(metrics(LANDSCAPE_64, 'sub-to-20')).toMatchObject({
    gap: 6,
    between: 24,
  })
  expect(metrics(IPAD_PORTRAIT, 'sub-to-20')).toMatchObject({
    gap: 8,
    between: 32,
  })
})

it('the card: a 2 pt border (tablet 3), corners round(0.27 × height)', () => {
  const phone = metrics(PORTRAIT, 'sub-to-10')
  expect(phone.border).toBe(2)
  expect(phone.radius).toBe(Math.round(0.27 * 72))
  const tablet = metrics(IPAD_PORTRAIT, 'sub-to-10')
  expect(tablet.border).toBe(3)
  expect(tablet.radius).toBe(Math.round(0.27 * 120))
})

it('flower k sits g from its neighbours and from the frame’s edge', () => {
  const m = metrics(PORTRAIT, 'sub-to-10')
  const c = m.flower + m.gap
  // Slot 1: top-left; slot 6: bottom-left; slot 10: bottom-right.
  expect(m.slotCentre(1)).toEqual({
    x: m.gap / 2 + c / 2,
    y: m.gap / 2 + c / 2,
  })
  expect(m.slotCentre(5).x).toBe(m.gap / 2 + 4.5 * c)
  expect(m.slotCentre(6)).toEqual({
    x: m.gap / 2 + c / 2,
    y: m.gap / 2 + 1.5 * c,
  })
  expect(m.slotCentre(10).x + m.flower / 2 + m.gap).toBe(m.frameWidth)
  expect(m.slotCentre(10).y + m.flower / 2 + m.gap).toBe(m.frameHeight)
})

describe.each(Object.entries(PHONES))('AC 3, phone %s', (_name, v) => {
  const l = mathLayout(v)
  it.each(['sub-to-10', 'sub-to-20'] as const)(
    '%s: the frame fits the visual slot and the problem’s width',
    (step) => {
      const m = takeAwayMetrics(l, step, l.problem.width)
      expect(m.height).toBeLessThanOrEqual(l.visualSlot!)
      expect(m.width).toBeLessThanOrEqual(l.problem.width)
    },
  )
})

it('AC 3: a sub-to-20 pair fits 343 pt (the 375 pt floor’s content width)', () => {
  const l = mathLayout(PORTRAIT)
  expect(takeAwayMetrics(l, 'sub-to-20', 343).width).toBeLessThanOrEqual(343)
})
