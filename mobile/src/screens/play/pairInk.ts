/**
 * A digraph critter's pair, measured (`design/native/critters-digraph.md`
 * § 2.2): which critters are pairs, the pair's text line from Fredoka 700's
 * own line metrics, and its bar from the pair's ink. `CritterPair.tsx`
 * draws them.
 */
import type { HuntDigraph } from '@marian/core/games/playPlace'
import { HUNT_DIGRAPHS } from '@marian/core/games/playPlace'
import type { Rect } from '../../layout/layout'

/**
 * Fredoka 700's ascent and line height per em (hhea 974, −236, gap 0, in
 * the bundled file, shasum 077ce632). A line box of exactly the font's
 * line height puts the baseline at its ascent (Q42).
 */
export const FREDOKA_ASCENT = 0.974
export const FREDOKA_LINE = 1.21

/**
 * The pair's ink per 1000 em (§ 2.2, Chromium's canvas on the app's
 * file): its width, and how far its lowest ink falls below the baseline.
 */
const PAIR_INK: Readonly<
  Record<HuntDigraph, { width: number; descent: number }>
> = {
  sh: { width: 897, descent: 14 },
  ch: { width: 956, descent: 15 },
  th: { width: 850, descent: 13 },
  ng: { width: 1018, descent: 208 },
}

/** A digraph critter: two letters, one critter (D1). */
export const isPair = (unit: string): unit is HuntDigraph =>
  (HUNT_DIGRAPHS as readonly string[]).includes(unit)

/**
 * The bar under `pair` at font size `f`, its baseline `baseline` from the
 * top, centred on `centreX` (§ 2.2): `max(1.5, 0.11 f)` thick, `0.085 f`
 * under the pair's lowest ink, as wide as its ink.
 */
export function pairBar(
  pair: HuntDigraph,
  f: number,
  baseline: number,
  centreX: number,
): Rect {
  const ink = PAIR_INK[pair]
  const width = (ink.width / 1000) * f
  return {
    x: centreX - width / 2,
    y: baseline + (ink.descent / 1000) * f + 0.085 * f,
    width,
    height: Math.max(1.5, 0.11 * f),
  }
}
