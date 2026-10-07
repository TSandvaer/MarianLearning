/**
 * Map model, layout and line picker (Emma's Path 8/10, 123jpnbc3dr).
 * Per-step expectations are checked against `nodeProgress()` and the
 * line catalogue so the map cannot drift from either.
 */
import { describe, expect, it } from 'vitest'
import {
  LITERACY_TREE,
  MATH_TREE,
  defaultProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillLevels,
  type SkillNode,
} from '../../lib/progress'
import { nodeProgress } from '../../lib/progress/nodeProgress'
import { pathLine } from '../../lib/emmasPath/pathLines'
import { currentStepOf } from '../Hub/hubCardModel'
import { buildMapModel, stopsInOrder } from './mapModel'
import {
  BAND_GAP,
  badgeLands,
  CURRENT_SCALE,
  emmaBadge,
  GATE_TAP,
  LANDSCAPE_BAND,
  LANDSCAPE_TRAY_ROOM,
  landscapeScale,
  layoutMap,
  MIN_STOP,
} from './mapLayout'
import { gateLine, openLine, stopLine } from './mapLines'

/** Mastered before index `cur`, practicing at it, locked after; -1 = all mastered. */
function seed(
  tree: readonly SkillNode[],
  cur: number,
  extra: Partial<Progress> = {},
): Progress {
  const p = defaultProgress()
  const levels = { ...p.skillLevels } as SkillLevels
  tree.forEach((n, i) => {
    levels[n] =
      cur < 0 || i < cur ? 'mastered' : i === cur ? 'practicing' : 'locked'
  })
  return { ...p, skillLevels: levels, ...extra }
}

function entry(d: number, node: SkillNode, rate: number): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 4, d, 12).toISOString(),
    skillFocus: [node],
    successRate: rate,
  }
}

describe('buildMapModel', () => {
  it('11 math stops in 4 lands, 13 word stops in 5 lands, tree order', () => {
    const math = buildMapModel(seed(MATH_TREE, 0), 'math')
    expect(math.lands.map((l) => l.stops.length)).toEqual([1, 4, 3, 3])
    expect(stopsInOrder(math).map((s) => s.node)).toEqual([...MATH_TREE])
    const word = buildMapModel(seed(LITERACY_TREE, 0), 'word-song')
    expect(word.lands.map((l) => l.stops.length)).toEqual([2, 1, 5, 3, 2])
    expect(stopsInOrder(word).map((s) => s.node)).toEqual([...LITERACY_TREE])
  })

  it('current = first not-mastered step (same rule as the Hub / picker)', () => {
    for (let cur = 0; cur < MATH_TREE.length; cur++) {
      const p = seed(MATH_TREE, cur)
      const m = buildMapModel(p, 'math')
      expect(m.current).toBe(MATH_TREE[cur])
      expect(m.current).toBe(currentStepOf(p, 'math'))
      const states = stopsInOrder(m).map((s) => s.state)
      expect(states).toEqual(
        MATH_TREE.map((_, i) =>
          i < cur ? 'mastered' : i === cur ? 'current' : 'locked',
        ),
      )
    }
  })

  it('buds come from nodeProgress and only sit under open/current stops', () => {
    const p = seed(MATH_TREE, 1, {
      history: [entry(1, 'add-to-10', 1), entry(2, 'add-to-10', 1)],
    })
    const np = nodeProgress(p, 'add-to-10')
    const stops = stopsInOrder(buildMapModel(p, 'math'))
    const cur = stops.find((s) => s.node === 'add-to-10')!
    expect(cur.buds).toEqual([
      Array.from({ length: np.requiredDays }, (_, i) => i < np.goodDays),
    ])
    expect(np.goodDays).toBe(2)
    for (const s of stops) {
      if (s.state === 'mastered' || s.state === 'locked')
        expect(s.buds).toEqual([])
    }
  })

  it('gate open iff the land first step is not locked; land 1 always open', () => {
    const m = buildMapModel(seed(MATH_TREE, 4), 'math') // sub-to-20 current
    expect(m.lands.map((l) => l.open)).toEqual([true, true, false, false])
    const p = seed(MATH_TREE, 5)
    expect(buildMapModel(p, 'math').lands.map((l) => l.open)).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('whole world mastered: complete, Emma on the last step, no current state', () => {
    const m = buildMapModel(seed(MATH_TREE, -1), 'math')
    expect(m.complete).toBe(true)
    expect(m.current).toBe('mult-6-9')
    expect(stopsInOrder(m).every((s) => s.state === 'mastered')).toBe(true)
  })

  it('showLandNumber mirrors showLevelToMarian', () => {
    const p = seed(MATH_TREE, 1)
    const off: Progress = {
      ...p,
      parentSettings: {
        ...(p.parentSettings ?? {}),
        showLevelToMarian: false,
      } as Progress['parentSettings'],
    }
    expect(buildMapModel(off, 'math').showLandNumber).toBe(false)
  })
})

describe('layoutMap', () => {
  const W = 820
  const H = 928
  const worlds = [
    ['math', MATH_TREE],
    ['word-song', LITERACY_TREE],
  ] as const

  type Box = { l: number; t: number; r: number; b: number }
  const boxOf = (x: number, y: number, size: number): Box => ({
    l: x - size / 2,
    t: y - size / 2,
    r: x + size / 2,
    b: y + size / 2,
  })
  const overlap = (a: Box, c: Box) =>
    a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b

  it('land 1 at the bottom, a 40px gap (gate) between bands', () => {
    for (const [world, tree] of worlds) {
      const l = layoutMap(buildMapModel(seed(tree, 0), world), W, H)
      const bands = l.bands
      expect(bands[0]!.top + bands[0]!.height).toBeCloseTo(H)
      expect(bands[bands.length - 1]!.top).toBeCloseTo(0)
      for (let i = 1; i < bands.length; i++) {
        expect(
          bands[i - 1]!.top - (bands[i]!.top + bands[i]!.height),
        ).toBeCloseTo(BAND_GAP)
      }
      expect(l.gates).toHaveLength(bands.length - 1)
      expect(l.pills).toHaveLength(bands.length)
    }
  })

  it('every stop and gate: ≥ 88px target, inside the region, no two overlap', () => {
    for (const [world, tree] of worlds) {
      for (let cur = -1; cur < tree.length; cur++) {
        const l = layoutMap(buildMapModel(seed(tree, cur), world), W, H)
        const boxes = [
          ...l.stops.map((s) => boxOf(s.x, s.y, s.size)),
          ...l.gates.map((g) => boxOf(g.x, g.y, GATE_TAP)),
        ]
        for (const s of l.stops) expect(s.size).toBeGreaterThanOrEqual(MIN_STOP)
        // Pills (≈ 140×50, at the band's side edge) clear every gate.
        for (const p of l.pills) {
          const pill =
            p.side === 'left'
              ? { l: 30, t: p.top, r: 170, b: p.top + 50 }
              : { l: W - 170, t: p.top, r: W - 30, b: p.top + 50 }
          for (const g of l.gates)
            expect(overlap(pill, boxOf(g.x, g.y, GATE_TAP))).toBe(false)
        }
        for (const b of boxes) {
          expect(b.l).toBeGreaterThanOrEqual(0)
          expect(b.r).toBeLessThanOrEqual(W)
          expect(b.t).toBeGreaterThanOrEqual(0)
          expect(b.b).toBeLessThanOrEqual(H)
        }
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            expect(overlap(boxes[i]!, boxes[j]!)).toBe(false)
      }
    }
  })

  it('the current stop is bigger; a complete map has no current size', () => {
    const m = buildMapModel(seed(MATH_TREE, 2), 'math')
    const l = layoutMap(m, W, H)
    const cur = l.stops.find((s) => s.node === m.current)!
    expect(cur.size).toBe(Math.round(l.stopSize * CURRENT_SCALE))
    expect(l.stops.filter((s) => s.size !== l.stopSize)).toEqual([cur])
    const done = layoutMap(buildMapModel(seed(MATH_TREE, -1), 'math'), W, H)
    expect(done.stops.every((s) => s.size === done.stopSize)).toBe(true)
  })

  it('snakes: land 1 starts left, each land starts where the last one ended', () => {
    for (const [world, tree] of worlds) {
      const m = buildMapModel(seed(tree, 0), world)
      const l = layoutMap(m, W, H)
      let side: 'left' | 'right' = 'left'
      for (const land of m.lands) {
        const xs = l.stops.filter((s) => s.land === land.number).map((s) => s.x)
        const pill = l.pills.find((p) => p.land === land.number)!
        expect(pill.side).toBe(
          land.stops.length > 1 ? side : side === 'left' ? 'right' : 'left',
        )
        expect(xs[0]! < W / 2 ? 'left' : 'right').toBe(side)
        const gate = l.gates.find((g) => g.land === land.number)
        if (gate) expect(gate.x < W / 2 ? 'left' : 'right').toBe(side)
        if (xs.length > 1) {
          const sorted = [...xs].sort((a, b) => a - b)
          expect(xs).toEqual(side === 'left' ? sorted : sorted.reverse())
          side = side === 'left' ? 'right' : 'left'
        }
      }
    }
  })

  it('stepping stones: walked up to the current stop, ahead after it', () => {
    const m = buildMapModel(seed(MATH_TREE, 5), 'math')
    const l = layoutMap(m, W, H)
    expect(l.stones.length).toBeGreaterThan(8)
    const walked = l.stones.filter((s) => s.walked)
    expect(walked.length).toBeGreaterThan(0)
    expect(walked.length).toBeLessThan(l.stones.length)
    // Stones are laid in path order: every walked stone comes first.
    const firstAhead = l.stones.findIndex((s) => !s.walked)
    expect(l.stones.slice(firstAhead).every((s) => !s.walked)).toBe(true)
    const done = layoutMap(buildMapModel(seed(MATH_TREE, -1), 'math'), W, H)
    expect(done.stones.every((s) => s.walked)).toBe(true)
  })

  // Thomas (2026-10-07): the stop's art hid Emma's body, and the standing
  // art has no legs. A "you are here" badge marks her stop instead, above
  // it, all of it inside her (taller) band.
  it("Emma's badge sits above her stop: clear of every stop and gate, inside her band, her face big enough", () => {
    for (const [world, tree] of worlds) {
      for (let cur = -1; cur < tree.length; cur++) {
        const m = buildMapModel(seed(tree, cur), world)
        const l = layoutMap(m, W, H)
        const stop = l.stops.find((s) => s.node === m.current)!
        const e = emmaBadge(stop)
        expect(e.left + e.size / 2).toBeCloseTo(stop.x)
        // Portrait: 72-96 px, her face recognisable.
        expect(e.size).toBeGreaterThanOrEqual(72)
        expect(e.size).toBeLessThanOrEqual(96)
        expect(e.height).toBeGreaterThan(e.size)
        // The whole badge, tail included, is above her stop's box.
        const box = {
          l: e.left,
          t: e.top,
          r: e.left + e.size,
          b: e.top + e.height,
        }
        expect(box.b).toBeLessThanOrEqual(stop.y - stop.size / 2)
        for (const s of l.stops)
          expect(overlap(box, boxOf(s.x, s.y, s.size))).toBe(false)
        for (const g of l.gates)
          expect(overlap(box, boxOf(g.x, g.y, GATE_TAP))).toBe(false)
        const band = l.bands.find((b) => b.land === stop.land)!
        expect(box.t).toBeGreaterThanOrEqual(band.top)
      }
    }
  })
  // Unlock beat (PR #522 review): the badge stays on the just-mastered
  // stop until Emma hops. When the unlock opens a new land, that stop sits
  // in a different land from the current one; it gets badge room too, so
  // the frosted new stop above it never covers her face.
  it('unlock beat: the badge on the just-mastered stop clears every stop and gate and stays in its band (portrait + landscape)', () => {
    const regions = [
      { w: W, h: H, landscape: false },
      { w: 760, h: 654, landscape: true },
      { w: 821, h: 624, landscape: true },
      { w: 897, h: 664, landscape: true },
      { w: 1000, h: 560, landscape: true },
      { w: 1038, h: 884, landscape: true },
    ] as const
    let crossings = 0
    for (const [world, tree] of worlds) {
      for (let i = 1; i < tree.length; i++) {
        const mastered = tree[i - 1]!
        const m = buildMapModel(seed(tree, i), world)
        const landOf = (n: SkillNode) =>
          m.lands.find((l) => l.stops.some((s) => s.node === n))!.number
        if (landOf(mastered) !== landOf(m.current)) crossings++
        const rooms = badgeLands(m, [mastered]).size
        for (const r of regions) {
          const k = r.landscape ? landscapeScale(m.lands.length, r.h, rooms) : 1
          const h = r.landscape ? r.h / k - LANDSCAPE_TRAY_ROOM : r.h
          const l = layoutMap(m, r.w / k, h, [mastered])
          if (r.landscape)
            for (const b of l.bands)
              expect(b.height).toBeGreaterThanOrEqual(LANDSCAPE_BAND - 0.01)
          // Before the hop (on the mastered stop) and after it (on the new one).
          for (const node of [mastered, m.current]) {
            const stop = l.stops.find((s) => s.node === node)!
            const e = emmaBadge(stop)
            const box = {
              l: e.left,
              t: e.top,
              r: e.left + e.size,
              b: e.top + e.height,
            }
            const where = `${world} ${mastered}->${m.current} @${node} ${r.w}x${r.h}`
            expect(box.b, where).toBeLessThanOrEqual(stop.y - stop.size / 2)
            for (const s of l.stops)
              expect(overlap(box, boxOf(s.x, s.y, s.size)), where).toBe(false)
            for (const g of l.gates)
              expect(overlap(box, boxOf(g.x, g.y, GATE_TAP)), where).toBe(false)
            const band = l.bands.find((b) => b.land === stop.land)!
            expect(box.t, where).toBeGreaterThanOrEqual(band.top)
            expect(box.l, where).toBeGreaterThanOrEqual(0)
            expect(box.r, where).toBeLessThanOrEqual(r.w / k)
          }
        }
      }
    }
    // Every land after the first is entered once per world.
    expect(crossings).toBe(
      worlds.reduce(
        (n, [world, tree]) =>
          n + buildMapModel(seed(tree, 0), world).lands.length - 1,
        0,
      ),
    )
  })

  it('no unlock beat: the layout is the steady-state one', () => {
    for (const [world, tree] of worlds) {
      const m = buildMapModel(seed(tree, 3), world)
      expect(layoutMap(m, W, H, [])).toEqual(layoutMap(m, W, H))
      // A mastered stop in the current land adds no room.
      expect(layoutMap(m, W, H, [m.current])).toEqual(layoutMap(m, W, H))
    }
  })

  // Landscape path regions: Thomas's iPad in Safari (1000x670) and the
  // other landscape sizes, after the left header column and margins.
  it("landscape: scaled to fit, Emma's badge and the bud tray clear every other stop", () => {
    const regions = [
      [760, 654],
      [821, 624],
      [897, 664],
      [1038, 884],
    ] as const
    for (const [rw, rh] of regions) {
      for (const [world, tree] of worlds) {
        for (let cur = 0; cur < tree.length; cur++) {
          const m = buildMapModel(seed(tree, cur), world)
          const k = landscapeScale(m.lands.length, rh)
          const h = rh / k - LANDSCAPE_TRAY_ROOM
          const l = layoutMap(m, rw / k, h)
          // Tap targets stay ≥ 44 px on screen.
          expect(l.stopSize * k).toBeGreaterThanOrEqual(44)
          expect(GATE_TAP * k).toBeGreaterThanOrEqual(44)
          const stop = l.stops.find((s) => s.node === m.current)!
          const e = emmaBadge(stop)
          const emma = {
            l: e.left,
            t: e.top,
            r: e.left + e.size,
            b: e.top + e.height,
          }
          // Her face stays recognisable on screen: badge >= 56 px.
          expect(e.size * k).toBeGreaterThanOrEqual(56)
          // BudTray: top at 1.02 × size inside the stop box, 3 × 42 px
          // holes + padding ≈ 160 × 55 px.
          const trayTop = stop.y - stop.size / 2 + stop.size * 1.02
          const tray = {
            l: stop.x - 80,
            t: trayTop,
            r: stop.x + 80,
            b: trayTop + 55,
          }
          expect(emma.t).toBeGreaterThanOrEqual(0)
          expect(tray.b).toBeLessThanOrEqual(h + LANDSCAPE_TRAY_ROOM)
          expect(overlap(emma, tray)).toBe(false)
          // Bands stay at least LANDSCAPE_BAND tall (her own is taller).
          for (const b of l.bands)
            expect(b.height).toBeGreaterThanOrEqual(LANDSCAPE_BAND - 0.01)
          for (const s of l.stops) {
            const box = boxOf(s.x, s.y, s.size)
            // Emma clears every stop, her own included.
            expect(overlap(emma, box)).toBe(false)
            if (s.node !== stop.node) expect(overlap(tray, box)).toBe(false)
          }
          for (const g of l.gates)
            expect(overlap(tray, boxOf(g.x, g.y, GATE_TAP))).toBe(false)
        }
      }
    }
  })
})

describe('map lines', () => {
  it('open line names the current step; complete → open.done', () => {
    expect(openLine(buildMapModel(seed(MATH_TREE, 2), 'math')).id).toBe(
      'path.open.add-to-20',
    )
    expect(openLine(buildMapModel(seed(MATH_TREE, -1), 'math')).id).toBe(
      'path.open.done.math',
    )
  })

  it('every stop / gate tap in every state resolves to a catalogued line', () => {
    for (const [world, tree] of [
      ['math', MATH_TREE],
      ['word-song', LITERACY_TREE],
    ] as const) {
      for (let cur = -1; cur < tree.length; cur++) {
        const m = buildMapModel(seed(tree, cur), world)
        for (const s of stopsInOrder(m)) {
          const line = stopLine(m, s)
          expect(pathLine(line.id)).toBe(line)
          expect(line.text).not.toMatch(/\d|day/i)
        }
        for (const land of m.lands.filter((l) => l.number > 1)) {
          expect(pathLine(gateLine(m, land).id)).toBeDefined()
        }
      }
    }
  })

  it('locked stop: next when its predecessor is current, else later naming current', () => {
    const m = buildMapModel(seed(MATH_TREE, 1), 'math') // add-to-10 current
    const stop = (n: SkillNode) => stopsInOrder(m).find((s) => s.node === n)!
    const next = stopLine(m, stop('add-to-20'))
    expect(next.id).toBe('path.locked.next.add-to-20')
    expect(next.src).not.toBeNull()
    const later = stopLine(m, stop('mult-6-9'))
    expect(later.id).toBe('path.locked.later.mult-6-9.add-to-10')
    expect(later.src).toBeNull() // deferred (DECISIONS 2026-10-05)
    expect(later.text).toBe('Big groups! Not yet. First, adding to ten.')
    expect(stopLine(m, stop('number-recog')).id).toBe('path.stop.number-recog')
    expect(stopLine(m, stop('add-to-10')).id).toBe('path.stop.add-to-10')
  })

  it('gate: open → land line; closed → deferred gate.locked naming current', () => {
    const m = buildMapModel(seed(MATH_TREE, 1), 'math')
    expect(gateLine(m, m.lands[1]!).id).toBe('path.land.math.2')
    const closed = gateLine(m, m.lands[3]!)
    expect(closed.id).toBe('path.gate.locked.math.4.add-to-10')
    expect(closed.src).toBeNull()
  })
})
