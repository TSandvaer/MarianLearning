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
import { GATE_STRIP, layoutMap } from './mapLayout'
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
  const H = 952

  it('land 1 at the bottom, 40px gate strip between bands, no overlap', () => {
    for (const [world, tree] of [
      ['math', MATH_TREE],
      ['word-song', LITERACY_TREE],
    ] as const) {
      const l = layoutMap(buildMapModel(seed(tree, 0), world), W, H)
      const bands = l.bands
      expect(bands[0]!.top + bands[0]!.height).toBeCloseTo(H)
      expect(bands[bands.length - 1]!.top).toBeCloseTo(0)
      for (let i = 1; i < bands.length; i++) {
        expect(
          bands[i - 1]!.top - (bands[i]!.top + bands[i]!.height),
        ).toBeCloseTo(GATE_STRIP)
      }
      expect(l.gates).toHaveLength(bands.length - 1)
      // Every stop's 88px target fits inside the region.
      for (const s of l.stops) {
        expect(s.x - 44).toBeGreaterThanOrEqual(0)
        expect(s.x + 44).toBeLessThanOrEqual(W)
        expect(s.y - 44).toBeGreaterThanOrEqual(0)
        expect(s.y + 44).toBeLessThanOrEqual(H)
      }
    }
  })

  it('stops snake: left→right on odd lands, right→left on even lands', () => {
    const l = layoutMap(buildMapModel(seed(MATH_TREE, 0), 'math'), W, H)
    const xs = (land: number) =>
      l.stops.filter((s) => s.land === land).map((s) => s.x)
    const land2 = xs(2)
    expect([...land2].sort((a, b) => b - a)).toEqual(land2)
    const land3 = xs(3)
    expect([...land3].sort((a, b) => a - b)).toEqual(land3)
  })

  it('walked trail ends at the current stop', () => {
    const m = buildMapModel(seed(MATH_TREE, 5), 'math')
    const l = layoutMap(m, W, H)
    const cur = l.stops.find((s) => s.node === m.current)!
    expect(l.walked[l.walked.length - 1]).toBe(cur)
    // 6 stops + 2 gates walked.
    expect(l.walked).toHaveLength(8)
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
