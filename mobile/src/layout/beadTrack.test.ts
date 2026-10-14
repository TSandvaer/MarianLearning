/**
 * The bead track with a review's moon or a warm-up's hearts (native spec
 * `design/native/review-mode-and-warmup-native.md` § 3.2): the worst-case
 * widths of the spec's table, and the tight form's 4 pt gap.
 */
import type { Viewport } from './layout'
import { beadTrackWidth, trackBeadGap } from './beadTrack'
import { extendedMathLayout, mathLayout } from './mathLayout'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PHONE_PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const PHONE_LANDSCAPE: Viewport = { width: 667, height: 375, insets: NO_INSETS }
const TABLET: Viewport = { width: 1024, height: 768, insets: NO_INSETS }

const FORWARD = { scored: 8, warmups: 0, review: false }
const REVIEW = { scored: 8, warmups: 0, review: true }
const WARMUP = { scored: 8, warmups: 2, review: false }

it('matches § 3.2’s worst-case widths (phone 172 / 194 / 218, tablet 258 / 290 / 326)', () => {
  const phone = mathLayout(PHONE_PORTRAIT).hudMetrics
  const tablet = mathLayout(TABLET).hudMetrics
  expect(
    [FORWARD, REVIEW, WARMUP].map((s) => beadTrackWidth(phone, s)),
  ).toEqual([172, 194, 218])
  expect(
    [FORWARD, REVIEW, WARMUP].map((s) => beadTrackWidth(tablet, s)),
  ).toEqual([258, 290, 326])
})

it('phone landscape, chip-column frame: only the warm-up track closes to 4 pt', () => {
  const layout = extendedMathLayout(PHONE_LANDSCAPE, 'multiply')
  expect(layout.hud.kind).toBe('split')
  const m = layout.hudMetrics
  expect(trackBeadGap(m, layout.hud, true, FORWARD)).toBe(6)
  expect(trackBeadGap(m, layout.hud, true, REVIEW)).toBe(6)
  expect(trackBeadGap(m, layout.hud, true, WARMUP)).toBe(4)
  // 4 pt saves 20 pt on the warm-up track.
  expect(beadTrackWidth(m, WARMUP, 4)).toBe(198)
})

it('never closes the gaps in phone portrait (its own row) or on a tablet', () => {
  const portrait = mathLayout(PHONE_PORTRAIT)
  expect(trackBeadGap(portrait.hudMetrics, portrait.hud, false, WARMUP)).toBe(6)
  const tablet = mathLayout(TABLET)
  expect(trackBeadGap(tablet.hudMetrics, tablet.hud, true, WARMUP)).toBe(8)
})
