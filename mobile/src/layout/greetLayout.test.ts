import {
  CAPTION_LINE_HEIGHT,
  FIGURE_BAND,
  greetLayout,
  PHONE_CAPTION_PT,
  PHONE_HEART,
  RIBBON_MAX_WIDTH,
  TABLET_CAPTION_PT,
  TABLET_HEART,
  type GreetLayout,
} from './greetLayout'
import { safeRect, type Rect, type Viewport } from './layout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

const PHONES: Record<string, Viewport> = {
  'iPhone SE portrait (spec floor)': {
    width: 375,
    height: 667,
    insets: NO_INSETS,
  },
  'iPhone SE landscape (spec floor)': {
    width: 667,
    height: 375,
    insets: NO_INSETS,
  },
  'notched phone portrait': {
    width: 402,
    height: 874,
    insets: { top: 62, bottom: 34, left: 0, right: 0 },
  },
  'notched phone landscape': {
    width: 874,
    height: 402,
    insets: { top: 0, bottom: 21, left: 62, right: 62 },
  },
  'Android 411x914 portrait': {
    width: 411,
    height: 914,
    insets: { top: 52, bottom: 24, left: 0, right: 0 },
  },
}

const TABLETS: Record<string, Viewport> = {
  'iPad (A16) portrait': {
    width: 820,
    height: 1180,
    insets: { top: 24, bottom: 20, left: 0, right: 0 },
  },
  'iPad (A16) landscape': {
    width: 1180,
    height: 820,
    insets: { top: 24, bottom: 20, left: 0, right: 0 },
  },
  'iPad mini portrait': { width: 744, height: 1133, insets: NO_INSETS },
}

const EPS = 0.001

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  )
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    b.x < a.x + a.width - EPS &&
    a.y < b.y + b.height - EPS &&
    b.y < a.y + a.height - EPS
  )
}

const bottom = (r: Rect) => r.y + r.height
const centreX = (r: Rect) => r.x + r.width / 2
const centreY = (r: Rect) => r.y + r.height / 2

function slotFor(l: GreetLayout): number {
  return (
    2 * l.captionFontSize * CAPTION_LINE_HEIGHT +
    2 * l.ribbonPadding.vertical +
    6
  )
}

describe.each(Object.entries({ ...PHONES, ...TABLETS }))('%s', (_, v) => {
  const l = greetLayout(v)
  const safe = safeRect(v)

  it('keeps Emma (her figure band), the ribbon slot and the heart in the safe area, apart', () => {
    // Her frame may overhang the sides (transparent art); her figure may not.
    const band = {
      x: centreX(l.emma) - (l.emma.width * FIGURE_BAND) / 2,
      y: l.emma.y,
      width: l.emma.width * FIGURE_BAND,
      height: l.emma.height,
    }
    expect(inside(band, safe)).toBe(true)
    expect(inside(l.ring, safe)).toBe(true)
    expect(inside(l.ribbonSlot, safe)).toBe(true)
    expect(inside(l.heart, safe)).toBe(true)
    expect(overlaps(l.emma, l.ribbonSlot)).toBe(false)
    expect(overlaps(l.emma, l.heart)).toBe(false)
    expect(overlaps(l.ribbonSlot, l.heart)).toBe(false)
    expect(l.safe).toEqual(safe)
  })

  it('reserves a 2-line ribbon slot, at most max-w-2xl wide', () => {
    expect(l.ribbonSlot.height).toBeCloseTo(slotFor(l))
    expect(l.ribbonSlot.width).toBeLessThanOrEqual(RIBBON_MAX_WIDTH)
    expect(l.captionLineHeight).toBeCloseTo(
      l.captionFontSize * CAPTION_LINE_HEIGHT,
    )
  })

  it('centres the wake ring on Emma at 0.8 of her frame (within the screen)', () => {
    expect(centreX(l.ring)).toBeCloseTo(centreX(l.emma))
    expect(centreY(l.ring)).toBeCloseTo(centreY(l.emma))
    expect(l.ring.width).toBeCloseTo(
      Math.min(l.emma.width * 0.8, safe.width - 16),
    )
    expect(l.ring.width).toBe(l.ring.height)
    expect(l.ringStroke).toBeCloseTo((l.ring.width * 3) / 92)
  })

  it('draws Emma square (her art is 2000×2000)', () => {
    expect(l.emma.width).toBe(l.emma.height)
  })
})

describe.each(Object.entries(PHONES))('phone: %s', (_, v) => {
  const l = greetLayout(v)

  it('uses the phone heart (120×88, never smaller) and the 26 pt caption', () => {
    expect(l.tablet).toBe(false)
    expect(l.heart.width).toBe(PHONE_HEART.width)
    expect(l.heart.height).toBe(PHONE_HEART.height)
    expect(l.captionFontSize).toBe(PHONE_CAPTION_PT)
  })

  it('keeps at least 16 pt between the ribbon slot and the heart', () => {
    expect(l.heart.y - bottom(l.ribbonSlot)).toBeGreaterThanOrEqual(16 - EPS)
  })
})

describe('phone portrait (native spec § 4)', () => {
  const v = PHONES['iPhone SE portrait (spec floor)']
  const l = greetLayout(v)
  const safe = safeRect(v)

  it('puts the heart’s bottom edge 32 pt above the safe bottom', () => {
    expect(bottom(l.heart)).toBeCloseTo(bottom(safe) - 32)
    expect(centreX(l.heart)).toBeCloseTo(centreX(safe))
  })

  it('caps Emma at 60 % of the safe height and splits the spare evenly', () => {
    expect(l.emma.height).toBeLessThanOrEqual(safe.height * 0.6 + EPS)
    const above = l.emma.y - safe.y - 8 // minimum top gap
    const between = l.heart.y - bottom(l.ribbonSlot) - 16 // minimum gap
    expect(above).toBeCloseTo(between)
    expect(above).toBeGreaterThanOrEqual(0)
  })

  it('hangs the ribbon slot 8 pt under Emma', () => {
    expect(l.ribbonSlot.y - bottom(l.emma)).toBeCloseTo(8)
  })

  it('a notched phone gets the same shape inside its safe area', () => {
    const n = PHONES['notched phone portrait']
    const ln = greetLayout(n)
    expect(bottom(ln.heart)).toBeCloseTo(bottom(safeRect(n)) - 32)
    expect(ln.emma.height).toBeLessThanOrEqual(safeRect(n).height * 0.6 + EPS)
  })
})

describe('phone landscape (native spec § 4)', () => {
  const v = PHONES['iPhone SE landscape (spec floor)']
  const l = greetLayout(v)
  const safe = safeRect(v)
  const half = safe.x + safe.width / 2

  it('Emma takes 85 % of the safe height, centred in the left half', () => {
    expect(l.emma.height).toBeCloseTo(safe.height * 0.85)
    expect(l.emma.x + l.emma.width).toBeLessThanOrEqual(half + EPS)
    expect(centreX(l.emma)).toBeCloseTo(safe.x + safe.width / 4)
    expect(centreY(l.emma)).toBeCloseTo(centreY(safe))
  })

  it('ribbon + heart sit in the right half, centred together vertically', () => {
    expect(l.ribbonSlot.x).toBeGreaterThanOrEqual(half)
    expect(l.heart.x).toBeGreaterThanOrEqual(half)
    const top = l.ribbonSlot.y - safe.y
    const below = bottom(safe) - bottom(l.heart)
    expect(top).toBeCloseTo(below)
  })
})

describe.each(Object.entries(TABLETS))(
  'tablet: %s (follows the web)',
  (_, v) => {
    const l = greetLayout(v)

    it('uses the web heart (160×117) and the 38.4 px caption', () => {
      expect(l.tablet).toBe(true)
      expect(l.heart.width).toBe(TABLET_HEART.width)
      expect(l.heart.height).toBe(TABLET_HEART.height)
      expect(l.captionFontSize).toBe(TABLET_CAPTION_PT)
    })
  },
)

describe('tablet layouts', () => {
  it('portrait: ribbon is 88 % wide up to 672, the heart box mb-8', () => {
    const v = TABLETS['iPad mini portrait']
    const l = greetLayout(v)
    expect(l.ribbonSlot.width).toBeCloseTo(Math.min(744 * 0.88, 672))
    // h-[12vh] box (136 pt here), heart centred in it, 32 pt above bottom.
    const box = 1133 * 0.12
    expect(bottom(l.heart) + (box - 117) / 2).toBeCloseTo(1133 - 32)
  })

  it('landscape: Emma is min(80vh, 50vw) in the left half', () => {
    const v = TABLETS['iPad (A16) landscape']
    const l = greetLayout(v)
    expect(l.emma.width).toBeCloseTo(Math.min(820 * 0.8, 1180 * 0.5))
    expect(l.emma.x + l.emma.width).toBeLessThanOrEqual(1180 / 2 + EPS)
    expect(l.ribbonSlot.x).toBeGreaterThanOrEqual(1180 / 2)
  })
})
