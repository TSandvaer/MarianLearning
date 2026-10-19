/**
 * The map's forms and scale rule (`design/native/map-native.md` §§ 1-2):
 * `mapPathScale` reproduces the spec's sizes table, worst case over every
 * current step (Word Song is the worst world), and the chrome sits where
 * § 2 puts it.
 */
import {
  emmaBadge,
  landscapeNeed,
  landscapeScale,
  layoutMap,
  PORTRAIT_FIT_LANDS,
} from '@marian/core/map/mapLayout'
import { buildMapModel } from '@marian/core/map/mapModel'
import {
  defaultProgress,
  LITERACY_TREE,
  MATH_TREE,
  type MasteryTrack,
  type Progress,
  type SkillLevels,
  type SkillNode,
} from '@marian/core/progress'
import type { Viewport } from './layout'
import {
  focusBox,
  hitSlopFor,
  mapPathScale,
  mapScreenLayout,
  MAP_MIN_HIT,
  openingOffset,
} from './mapScreenLayout'

/** Mastered before `cur`, practicing at it, locked after. */
function seed(tree: readonly SkillNode[], cur: number): Progress {
  const p = defaultProgress()
  const levels = { ...p.skillLevels } as SkillLevels
  tree.forEach((n, i) => {
    levels[n] = i < cur ? 'mastered' : i === cur ? 'practicing' : 'locked'
  })
  return { ...p, skillLevels: levels }
}

function vp(width: number, height: number, top = 0, bottom = 0): Viewport {
  return { width, height, insets: { top, bottom, left: 0, right: 0 } }
}

/** The smallest stop, current stop and badge (pt) over every current step. */
function worst(v: Viewport, world: MasteryTrack) {
  const layout = mapScreenLayout(v)
  const tree = world === 'math' ? MATH_TREE : LITERACY_TREE
  let stop = Infinity
  let current = Infinity
  let badge = Infinity
  let s = 0
  let scroll: number | null = null
  for (let cur = 0; cur < tree.length; cur++) {
    const model = buildMapModel(seed(tree, cur), world)
    const k = mapPathScale(layout.pane, model, [], layout.landscape)
    const geo = layoutMap(model, k.virtualW, k.virtualH)
    const at = geo.stops.find((x) => x.node === model.current)!
    s = k.s
    stop = Math.min(stop, geo.stopSize * k.s)
    current = Math.min(current, at.size * k.s)
    badge = Math.min(badge, emmaBadge(at).size * k.s)
    scroll = k.scrolls ? k.contentH : null
  }
  return { form: layout.form, s, stop, current, badge, scroll }
}

const close = (a: number, b: number) => Math.abs(a - b) <= 0.051

// § 1 sizes table (Word Song, the worst world). Content wave 1 added Word
// Song land 6 (`design/native/content-wave-1.md` § 5.2): the 430×932 row
// and the L / TL rows shrink with the 6th band; 375×667 and both W rows
// keep their sizes. Content wave 3 added land 7 (`content-wave-3.md` § 1):
// the 7 bands miss the portrait bars, so (T6) the P and W forms lay Word
// Song out on landscape's bands and scroll (their sizes stay; the last
// column is the scrolled path's height), L scrolls further, and TL shrinks
// again (measured, 2026-10-17). Content wave 4 added land 8
// (`content-wave-4.md` § 1, T6): the scrolled paths grow by one band (176
// virtual px × s) and TL shrinks again (measured, 2026-10-18).
const TABLE: [
  string,
  Viewport,
  string,
  number,
  number,
  number,
  number,
  number | null,
][] = [
  ['375×667', vp(375, 667), 'P', 0.457, 40.2, 48.5, 42.1, 697],
  [
    '430×932 (t59 b34)',
    vp(430, 932, 59, 34),
    'P',
    0.524,
    46.15,
    55.6,
    48.2,
    799,
  ],
  ['667×375', vp(667, 375), 'L', 0.45, 39.6, 47.7, 41.4, 686],
  ['820×1180 (t24 b20)', vp(820, 1180, 24, 20), 'W', 1, 88, 106, 92, 1524],
  [
    '744×1133 (t24 b20)',
    vp(744, 1133, 24, 20),
    'W',
    0.907,
    79.8,
    96.2,
    83.5,
    1383,
  ],
  [
    '1180×820 (b20)',
    vp(1180, 820, 0, 20),
    'TL',
    0.514,
    45.27,
    54.53,
    47.32,
    null,
  ],
  [
    '1133×744 (b20)',
    vp(1133, 744, 0, 20),
    'TL',
    0.465,
    40.88,
    49.24,
    42.74,
    null,
  ],
]

describe('mapPathScale: the § 1 sizes table', () => {
  it.each(TABLE)('%s', (_name, v, form, s, stop, current, badge, scroll) => {
    const w = worst(v, 'word-song')
    expect(w.form).toBe(form)
    expect([w.s, close(w.s, s)]).toEqual([w.s, true])
    expect([w.stop, close(w.stop, stop)]).toEqual([w.stop, true])
    expect([w.current, close(w.current, current)]).toEqual([w.current, true])
    expect([w.badge, close(w.badge, badge)]).toEqual([w.badge, true])
    if (scroll === null) expect(w.scroll).toBeNull()
    else expect(Math.round(w.scroll!)).toBe(scroll)
  })

  // Content wave 3 added Number Garden land 5 (`content-wave-3.md` § 1):
  // L scrolls further (369 → 448 pt, measured 2026-10-18). Content wave 5
  // added land 6 (`content-wave-5.md` § 1 predicted 527 pt; measured
  // 2026-10-19: 527).
  it('Number Garden scrolls less in L (527 pt content)', () => {
    expect(Math.round(worst(vp(667, 375), 'math').scroll!)).toBe(527)
  })

  // Content wave 3 § 1 ("Map fit, not measured"): Number Garden's 5 lands
  // were predicted to fit the portrait forms. Measured 2026-10-18: no
  // portrait form scrolls, the sizes are the Word Song table's or larger,
  // and the current stop's worst overhang is +0.8 pt at 820×1180 (the bar
  // is 14). Content wave 5 § 1 (T6) added land 6 = PORTRAIT_FIT_LANDS and
  // predicted 13.6 pt at 820×1180 (Word Song's 6-land figure); measured
  // 2026-10-19: 13.6, inside the bar, so Number Garden still fits.
  it('Number Garden: 6 lands fit every portrait form; the current stop ends ≤ 14 pt below the pane', () => {
    const overhangs: Record<string, number> = {}
    for (const [name, v] of TABLE) {
      const layout = mapScreenLayout(v)
      if (layout.form !== 'P' && layout.form !== 'W') continue
      let worstPt = -Infinity
      for (let cur = 0; cur < MATH_TREE.length; cur++) {
        const model = buildMapModel(seed(MATH_TREE, cur), 'math')
        expect(model.lands).toHaveLength(6)
        const k = mapPathScale(layout.pane, model, [], layout.landscape)
        expect(k.scrolls).toBe(false)
        const geo = layoutMap(model, k.virtualW, k.virtualH)
        const at = geo.stops.find((x) => x.node === model.current)!
        worstPt = Math.max(worstPt, (at.y + at.size / 2 - k.virtualH) * k.s)
      }
      overhangs[name] = Math.round(worstPt * 10) / 10
    }
    expect(Object.keys(overhangs)).toHaveLength(4)
    for (const pt of Object.values(overhangs))
      expect(pt).toBeLessThanOrEqual(14)
    expect(overhangs['820×1180 (t24 b20)']).toBe(13.6)
  })

  it('Word Song scrolls on every form but tablet landscape (T6); Number Garden only in phone landscape', () => {
    for (const [, v] of TABLE) {
      const w = worst(v, 'word-song')
      expect(w.scroll !== null).toBe(w.form !== 'TL')
      const m = worst(v, 'math')
      expect(m.scroll !== null).toBe(m.form === 'L')
    }
  })

  // Content wave 4 § 1 (T6) predicted by hand that 8 lands drop 1133×744
  // under MAP_MIN_SCALE (0.449, 0.422 in an unlock beat). Measured
  // 2026-10-18: with Emma in one land it fits at 0.4645; only the beat that
  // crosses into land 8 (Emma's badge in lands 7 and 8) scrolls, at the
  // 0.45 floor, a 729 pt path in the 708 pt pane. 1180×820 fits both ways.
  it('T6, 8 lands: tablet landscape scrolls only in the 1133×744 unlock beat into land 8', () => {
    const cur = LITERACY_TREE.indexOf('bee-words')
    const model = buildMapModel(seed(LITERACY_TREE, cur), 'word-song')
    expect(model.lands).toHaveLength(8)
    const at = (v: Viewport, badged: SkillNode[]) =>
      mapPathScale(mapScreenLayout(v).pane, model, badged, true)
    const big = vp(1180, 820, 0, 20)
    const mini = vp(1133, 744, 0, 20)
    expect(at(big, []).scrolls).toBe(false)
    expect(at(big, ['bug-stories'])).toMatchObject({ scrolls: false })
    expect(at(big, ['bug-stories']).s).toBeCloseTo(0.4839, 3)
    expect(at(mini, []).scrolls).toBe(false)
    expect(at(mini, []).s).toBeCloseTo(0.4645, 3)
    const beat = at(mini, ['bug-stories'])
    expect(beat.scrolls).toBe(true)
    expect(beat.s).toBe(0.45)
    expect(Math.round(beat.contentH)).toBe(729)
    expect(mapScreenLayout(mini).pane.height).toBe(708)
  })

  it('T6: a portrait world scrolls only past PORTRAIT_FIT_LANDS lands, and keeps its portrait scale', () => {
    expect(PORTRAIT_FIT_LANDS).toBe(6)
    const layout = mapScreenLayout(vp(375, 667))
    const ws = buildMapModel(seed(LITERACY_TREE, 0), 'word-song')
    const ng = buildMapModel(seed(MATH_TREE, 0), 'math')
    expect(ws.lands).toHaveLength(8)
    const k = mapPathScale(layout.pane, ws, [], false)
    expect(k.scrolls).toBe(true)
    expect(k.s).toBeCloseTo(375 / 820)
    expect(k.contentH).toBeGreaterThan(layout.pane.height)
    expect(mapPathScale(layout.pane, ng, [], false).scrolls).toBe(false)
    // A 6-land world fits, as before content wave 3.
    const six = { ...ws, lands: ws.lands.slice(0, 6) }
    expect(mapPathScale(layout.pane, six, [], false).scrolls).toBe(false)
  })

  it('T6: the portrait path opens with the current stop in its middle third', () => {
    for (const v of [vp(375, 667), vp(820, 1180, 24, 20)]) {
      const layout = mapScreenLayout(v)
      for (let cur = 0; cur < LITERACY_TREE.length; cur++) {
        const model = buildMapModel(seed(LITERACY_TREE, cur), 'word-song')
        const k = mapPathScale(layout.pane, model, [], false)
        const geo = layoutMap(model, k.virtualW, k.virtualH)
        const at = geo.stops.find((x) => x.node === model.current)!
        const y = openingOffset(
          [focusBox(at)],
          k.s,
          layout.pane.height,
          k.contentH,
        )
        const onScreen = at.y * k.s - y
        expect(onScreen).toBeGreaterThanOrEqual(0)
        expect(onScreen).toBeLessThanOrEqual(layout.pane.height)
        // Clamped at the path's ends only; else the middle third.
        if (y > 0 && y < k.contentH - layout.pane.height) {
          expect(onScreen).toBeGreaterThanOrEqual(layout.pane.height / 3)
          expect(onScreen).toBeLessThanOrEqual((2 * layout.pane.height) / 3)
        }
      }
    }
  })

  // Content wave 1 (Kyle's call on PR #575, option (a)): with Word Song's
  // 6th land, land 1's bands are too short for the stop at its row, so on
  // the portrait forms the current stop's box may end a little below the
  // pane (toward the caption slot). Worst measured: 13.6 pt at 820×1180,
  // current in land 1. Device check: no caption text covered. Content wave
  // 3's 7th land would make it 22 pt; with T6's scroll every current stop
  // ends inside the path (worst -4.1 pt at 820×1180, measured 2026-10-17).
  it('portrait: the current stop never ends more than 14 pt below the pane', () => {
    const overhangs: Record<string, number> = {}
    for (const [name, v] of TABLE) {
      const layout = mapScreenLayout(v)
      if (layout.form !== 'P' && layout.form !== 'W') continue
      let worstPt = -Infinity
      for (let cur = 0; cur < LITERACY_TREE.length; cur++) {
        const model = buildMapModel(seed(LITERACY_TREE, cur), 'word-song')
        const k = mapPathScale(layout.pane, model, [], layout.landscape)
        const geo = layoutMap(model, k.virtualW, k.virtualH)
        const at = geo.stops.find((x) => x.node === model.current)!
        worstPt = Math.max(worstPt, (at.y + at.size / 2 - k.virtualH) * k.s)
      }
      overhangs[name] = Math.round(worstPt * 10) / 10
    }
    expect(Object.keys(overhangs)).toHaveLength(4)
    for (const pt of Object.values(overhangs))
      expect(pt).toBeLessThanOrEqual(14)
    expect(overhangs['820×1180 (t24 b20)']).toBe(-4.1)
  })
})

describe('mapScreenLayout: chrome per form (§ 2)', () => {
  it('P floor: Home 56 at (16, 8), 28 pt title, 124 pt slot, pane 375 × 447', () => {
    const l = mapScreenLayout(vp(375, 667))
    expect(l.home).toEqual({ x: 16, y: 8, width: 56, height: 56 })
    expect(l.title?.fontSize).toBe(28)
    expect(l.caption.slot).toEqual({ x: 16, y: 527, width: 343, height: 124 })
    expect(l.caption.metrics.font).toBe(22)
    expect(l.pane).toEqual({ x: 0, y: 72, width: 375, height: 447 })
  })

  it('L floor: no title, a 72 pt slot across the base, pane 563 × 271', () => {
    const l = mapScreenLayout(vp(667, 375))
    expect(l.title).toBeNull()
    expect(l.home).toEqual({ x: 16, y: 8, width: 56, height: 56 })
    expect(l.caption.slot).toEqual({ x: 16, y: 287, width: 635, height: 72 })
    expect(l.pane).toEqual({ x: 88, y: 8, width: 563, height: 271 })
  })

  it('TL: a 350 pt column (title 52 at y 124, a 192 pt slot at the bottom)', () => {
    const l = mapScreenLayout(vp(1180, 820, 0, 20))
    expect(l.home).toEqual({ x: 24, y: 14, width: 96, height: 96 })
    expect(l.title).toMatchObject({ x: 16, y: 124, width: 350, fontSize: 52 })
    expect(l.caption.slot).toEqual({ x: 16, y: 584, width: 350, height: 192 })
    expect(l.caption.align).toBe('end')
    expect(l.caption.metrics.font).toBe(28)
    expect(l.pane).toEqual({ x: 390, y: 8, width: 774, height: 784 })
  })

  it('W: the web portrait (header 124, caption row 128, slab 80 narrower)', () => {
    const l = mapScreenLayout(vp(820, 1180, 24, 20))
    expect(l.home).toEqual({ x: 24, y: 38, width: 96, height: 96 })
    expect(l.title).toMatchObject({ y: 24, height: 124, fontSize: 52 })
    expect(l.caption.slot).toEqual({ x: 40, y: 1032, width: 740, height: 128 })
    expect(l.pane).toEqual({ x: 0, y: 148, width: 820, height: 884 })
  })
})

describe('phone landscape opening offset (§ 2 L)', () => {
  const v = vp(667, 375)
  const layout = mapScreenLayout(v)

  it.each(['math', 'word-song'] as const)(
    '%s: every current stop, its tray and Emma are fully on screen',
    (world) => {
      const tree = world === 'math' ? MATH_TREE : LITERACY_TREE
      for (let cur = 0; cur < tree.length; cur++) {
        const model = buildMapModel(seed(tree, cur), world)
        const k = mapPathScale(layout.pane, model, [], true)
        const geo = layoutMap(model, k.virtualW, k.virtualH)
        const stop = geo.stops.find((x) => x.node === model.current)!
        const box = focusBox(stop)
        const y = openingOffset([box], k.s, layout.pane.height, k.contentH)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(k.contentH - layout.pane.height)
        expect([cur, box.top * k.s >= y]).toEqual([cur, true])
        expect([cur, box.bottom * k.s <= y + layout.pane.height]).toEqual([
          cur,
          true,
        ])
      }
    },
  )

  it('a land beat: both stops and Emma fit, the union ≤ 238 pt', () => {
    const tree = LITERACY_TREE
    // blending-cv (land 2) just mastered: cvc-words opens land 3.
    const cur = tree.indexOf('cvc-words')
    const model = buildMapModel(seed(tree, cur), 'word-song')
    const also: SkillNode[] = ['blending-cv']
    const k = mapPathScale(layout.pane, model, also, true)
    const geo = layoutMap(model, k.virtualW, k.virtualH, also)
    const boxes = (['blending-cv', 'cvc-words'] as const).map((n) =>
      focusBox(geo.stops.find((x) => x.node === n)!),
    )
    const top = Math.min(...boxes.map((b) => b.top)) * k.s
    const bottom = Math.max(...boxes.map((b) => b.bottom)) * k.s
    expect(bottom - top).toBeLessThanOrEqual(238.5)
    const y = openingOffset(boxes, k.s, layout.pane.height, k.contentH)
    expect(top).toBeGreaterThanOrEqual(y)
    expect(bottom).toBeLessThanOrEqual(y + layout.pane.height)
  })

  it('the offset is clamped to the content', () => {
    expect(openingOffset([{ top: 0, bottom: 10 }], 1, 271, 448)).toBe(0)
    expect(openingOffset([{ top: 990, bottom: 996 }], 0.45, 271, 448)).toBe(
      448 - 271,
    )
  })
})

describe('core landscapeNeed (the need inside landscapeScale)', () => {
  it('NG 4 lands ≈ 820, WS 5 lands ≈ 996 virtual px with one badge land', () => {
    expect(landscapeNeed(4, 1)).toBeCloseTo(820.12)
    expect(landscapeNeed(5, 1)).toBeCloseTo(996.12)
    expect(landscapeScale(5, 498.06, 1)).toBeCloseTo(0.5)
  })
})

describe('hit areas (§ 1)', () => {
  it('lift every stop and gate to 44 pt, never shrink one', () => {
    expect(hitSlopFor(40.2)).toBeCloseTo(1.9)
    expect(hitSlopFor(MAP_MIN_HIT)).toBe(0)
    expect(hitSlopFor(88)).toBe(0)
  })

  it('at the floors the slop is at most 2.2 pt', () => {
    for (const v of [vp(375, 667), vp(667, 375)]) {
      expect(hitSlopFor(worst(v, 'word-song').stop)).toBeLessThanOrEqual(2.2)
    }
  })
})
