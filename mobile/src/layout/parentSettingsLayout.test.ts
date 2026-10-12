import type { Viewport } from './layout'
import { parentSettingsLayout } from './parentSettingsLayout'

function vp(
  width: number,
  height: number,
  insets: Partial<Viewport['insets']> = {},
): Viewport {
  return {
    width,
    height,
    insets: { top: 0, bottom: 0, left: 0, right: 0, ...insets },
  }
}

// The spec's size table (parent-settings-native.md § 1).
const TABLE: [string, Viewport, number, number, 'compact' | 'wide', number][] =
  [
    ['375×667', vp(375, 667), 343, 301, 'compact', 56],
    ['390×844', vp(390, 844, { top: 47, bottom: 34 }), 358, 316, 'compact', 56],
    ['430×932', vp(430, 932, { top: 59, bottom: 34 }), 398, 356, 'compact', 56],
    ['667×375', vp(667, 375), 635, 593, 'wide', 56],
    [
      '844×390',
      vp(844, 390, { left: 47, right: 47, bottom: 21 }),
      718,
      676,
      'wide',
      56,
    ],
    ['744×1133', vp(744, 1133, { top: 24, bottom: 20 }), 696, 654, 'wide', 72],
    ['820×1180', vp(820, 1180, { bottom: 20 }), 720, 678, 'wide', 72],
    ['1180×820', vp(1180, 820, { bottom: 20 }), 720, 678, 'wide', 72],
  ]

describe('parentSettingsLayout', () => {
  it.each(TABLE)(
    '%s: column, card inner, form and header match the spec',
    (_, viewport, column, inner, form, header) => {
      const l = parentSettingsLayout(viewport, 1)
      expect(l.column.width).toBe(column)
      expect(l.cardInner).toBe(inner)
      expect(l.compact).toBe(form === 'compact')
      expect(l.headerHeight).toBe(header)
    },
  )

  it('centres the column in the safe rect', () => {
    const l = parentSettingsLayout(
      vp(844, 390, { left: 47, right: 47, bottom: 21 }),
      1,
    )
    expect(l.column.x).toBe(47 + (750 - 718) / 2)
    const tablet = parentSettingsLayout(vp(1180, 820, { bottom: 20 }), 1)
    expect(tablet.column.x).toBe((1180 - 720) / 2)
  })

  it('goes compact on any device when the system text is large', () => {
    expect(parentSettingsLayout(vp(820, 1180), 1.3).compact).toBe(true)
    expect(parentSettingsLayout(vp(820, 1180), 1.2).compact).toBe(false)
  })

  it('pads the content and sizes the header text per form factor', () => {
    const phone = parentSettingsLayout(vp(390, 844, { top: 47, bottom: 34 }), 1)
    expect(phone).toMatchObject({
      tablet: false,
      safeTop: 47,
      safeBottom: 34,
      contentPadTop: 20,
      contentPadBottom: 66,
      titleSize: 20,
      subtitleSize: 13,
    })
    const tablet = parentSettingsLayout(vp(820, 1180, { bottom: 20 }), 1)
    expect(tablet).toMatchObject({
      tablet: true,
      contentPadTop: 32,
      contentPadBottom: 52,
      titleSize: 24,
      subtitleSize: 14,
    })
  })
})
