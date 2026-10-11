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

// § 1 sizes table (Word Song, the worst world).
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
  ['375×667', vp(375, 667), 'P', 0.457, 40.2, 48.5, 42.1, null],
  [
    '430×932 (t59 b34)',
    vp(430, 932, 59, 34),
    'P',
    0.524,
    51.9,
    62.4,
    48.2,
    null,
  ],
  ['667×375', vp(667, 375), 'L', 0.45, 39.6, 47.7, 41.4, 448],
  ['820×1180 (t24 b20)', vp(820, 1180, 24, 20), 'W', 1, 88, 106, 92, null],
  [
    '744×1133 (t24 b20)',
    vp(744, 1133, 24, 20),
    'W',
    0.907,
    79.8,
    96.2,
    83.5,
    null,
  ],
  ['1180×820 (b20)', vp(1180, 820, 0, 20), 'TL', 0.787, 69.3, 83.4, 72.4, null],
  ['1133×744 (b20)', vp(1133, 744, 0, 20), 'TL', 0.711, 62.5, 75.3, 65.4, null],
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

  it('Number Garden scrolls less in L (369 pt content)', () => {
    expect(Math.round(worst(vp(667, 375), 'math').scroll!)).toBe(369)
  })

  it('only phone landscape scrolls', () => {
    for (const [, v] of TABLE) {
      const w = worst(v, 'word-song')
      expect(w.scroll !== null).toBe(w.form === 'L')
    }
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
