/**
 * Times mix (`mult-mix`, content wave 1 `design/native/content-wave-1.md`
 * § 2.2–§ 2.3, AC 5): core composes the session from canon blocks of the
 * multiplication steps. P1–P3 open on facts she got right before; P4–P8
 * bring the due facts, then the weakest; neighbours come from different
 * tables whenever they can.
 *
 * Local wall-clock timestamps throughout (see `reviewPlan.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import {
  MIX_BLOCK_COUNT,
  MIX_SOURCE_STEPS as WIRE_SOURCES,
} from '../wire/types'
import { CANON_MATH_FACTS } from './canonMathFacts.generated'
import { defaultProgress } from './defaults'
import { LEITNER_DUE_PER_SESSION_CAP } from './leitner'
import {
  MIX_SOURCE_STEPS,
  mixFactPool,
  orderByTable,
  pickMixBlocks,
  type CanonBlockRef,
  type MixPoolFact,
} from './reviewPlan'
import type { LeitnerBoxIndex, LeitnerItem, MathFact, Progress } from './types'

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m)
const MON = 12
const TUE = 13
const NOW_MS = at(TUE, 8).getTime()

function item(
  a: number,
  b: number,
  box: LeitnerBoxIndex,
  lastSeen: Date,
): LeitnerItem<MathFact> {
  return { item: { a, b, op: '*' }, box, lastSeen: lastSeen.getTime() }
}

const withBox = (...items: LeitnerItem<MathFact>[]): Progress => ({
  ...defaultProgress(),
  mathFactsLeitner: { items },
})

const factOf = (ref: CanonBlockRef): MathFact =>
  (CANON_MATH_FACTS as Record<string, readonly (MathFact | null)[]>)[ref.node]![
    ref.problem - 1
  ]!
const key = (f: MathFact) => `${f.a}*${f.b}`
const keys = (refs: readonly CanonBlockRef[]) => refs.map((r) => key(factOf(r)))

/** § 2.3's worked example: three box-3 facts, two box-1 facts due. */
const example = () =>
  withBox(
    item(4, 4, 3, at(MON, 17)),
    item(2, 5, 3, at(MON, 17)),
    item(3, 3, 3, at(MON, 17)),
    item(9, 3, 1, at(MON, 18)),
    item(7, 3, 1, at(MON, 18)),
  )

describe('the times-mix fact pool (§ 2.2)', () => {
  it('is the 28 × facts with A 2–9 and B 2–5 of the four source files, once per fact, first block in step order', () => {
    expect(MIX_SOURCE_STEPS).toEqual([
      'mult-2-5-10',
      'mult-3-4',
      'mult-6-9',
      'mult-mix',
    ])
    expect(WIRE_SOURCES).toEqual(MIX_SOURCE_STEPS)
    const pool = mixFactPool()
    expect(pool).toHaveLength(28)
    expect(new Set(pool.map((p) => key(p.fact))).size).toBe(28)
    for (const { fact, ref } of pool) {
      expect(fact.op).toBe('*')
      expect(fact.a).toBeGreaterThanOrEqual(2)
      expect(fact.a).toBeLessThanOrEqual(9)
      expect(fact.b).toBeGreaterThanOrEqual(2)
      expect(fact.b).toBeLessThanOrEqual(5)
      expect(factOf(ref)).toEqual(fact)
    }
    // 2×3 is in mult-2-5-10 and mult-3-4: the first file wins.
    expect(pool.find((p) => key(p.fact) === '2*3')!.ref.node).toBe(
      'mult-2-5-10',
    )
    // 5×1, 10×1, 10×2 are left out; 6×5–9×5 are not in any file yet.
    for (const k of ['5*1', '10*1', '10*2', '6*5', '9*5'])
      expect(pool.map((p) => key(p.fact))).not.toContain(k)
    // Per source file: 5, 7, 8, 8 (the § 2.2 table).
    const per = (node: string) => pool.filter((p) => p.ref.node === node).length
    expect(MIX_SOURCE_STEPS.map(per)).toEqual([5, 7, 8, 8])
  })
})

describe('pickMixBlocks (§ 2.3, AC 5)', () => {
  it('returns 8 refs with 8 distinct facts, all from the pool', () => {
    for (const p of [example(), defaultProgress()]) {
      for (const seed of [0, 1, 7, 28, 103]) {
        const refs = pickMixBlocks(p, NOW_MS, seed, [])
        expect(refs).toHaveLength(MIX_BLOCK_COUNT)
        expect(new Set(keys(refs)).size).toBe(8)
        const pool = new Set(mixFactPool().map((x) => key(x.fact)))
        for (const k of keys(refs)) expect(pool.has(k)).toBe(true)
        for (const r of refs) expect(MIX_SOURCE_STEPS).toContain(r.node)
      }
    }
  })

  it('the worked example: P1–P3 are 3×3, 2×5, 4×4; P4–P8 include 7×3 and 9×3', () => {
    const refs = pickMixBlocks(example(), NOW_MS, 0, [])
    expect(keys(refs).slice(0, 3)).toEqual(['3*3', '2*5', '4*4'])
    expect(keys(refs).slice(3)).toEqual(expect.arrayContaining(['7*3', '9*3']))
  })

  it('P1–P3 with fewer than 3 known facts: the smallest products, in product order', () => {
    const refs = pickMixBlocks(defaultProgress(), NOW_MS, 0, [])
    // Products 4 (2×2), 6 (2×3, 3×2): 2×3 before 3×2 by key.
    expect(keys(refs).slice(0, 3)).toEqual(['2*2', '2*3', '3*2'])
    const one = pickMixBlocks(
      withBox(item(9, 4, 4, at(MON, 17))),
      NOW_MS,
      0,
      [],
    )
    expect(keys(one).slice(0, 3)).toEqual(['2*2', '2*3', '9*4'])
  })

  it('a strength-1 fact never opens: P1–P3 need box ≥ 2', () => {
    const refs = pickMixBlocks(
      withBox(item(7, 3, 1, at(MON, 18))),
      NOW_MS,
      0,
      [],
    )
    expect(keys(refs).slice(0, 3)).not.toContain('7*3')
    expect(keys(refs).slice(3)[0]).toBe('7*3') // due, so P4–P8 leads with it
  })

  it('no two neighbours share A when the picks allow it', () => {
    for (const p of [example(), defaultProgress()]) {
      for (const seed of [0, 1, 2, 3, 5, 8, 13, 21]) {
        const facts = pickMixBlocks(p, NOW_MS, seed, []).map(factOf)
        for (let i = 3; i < facts.length; i++) {
          expect(facts[i]!.a).not.toBe(facts[i - 1]!.a)
        }
      }
    }
  })

  it('the same inputs give the same refs; another seed varies P4–P8', () => {
    const a = pickMixBlocks(example(), NOW_MS, 4, [])
    expect(pickMixBlocks(example(), NOW_MS, 4, [])).toEqual(a)
    const seeds = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7].map((s) =>
        keys(pickMixBlocks(defaultProgress(), NOW_MS, s, [])).join(','),
      ),
    )
    expect(seeds.size).toBeGreaterThan(1)
  })

  it('due picks never include a warm-up fact and never exceed 3 minus the warm-up facts', () => {
    // Four due box-1 facts; a warm-up that carries one of them.
    const p = withBox(
      item(7, 3, 1, at(MON, 18)),
      item(9, 3, 1, at(MON, 18)),
      item(8, 4, 1, at(MON, 18)),
      item(6, 4, 1, at(MON, 18)),
    )
    const warmup: CanonBlockRef[] = [{ node: 'mult-6-9', problem: 5 }] // 7×3
    expect(key(factOf(warmup[0]!))).toBe('7*3')
    const refs = pickMixBlocks(p, NOW_MS, 0, warmup)
    const scored = keys(refs).slice(3)
    expect(scored).not.toContain('7*3')
    // Cap 3 − 1 warm-up fact = 2 due picks lead P4–P8 (equally overdue
    // box-1 facts rank by key: 6*4, 8*4; 9*3 waits).
    expect(LEITNER_DUE_PER_SESSION_CAP).toBe(3)
    expect(scored.slice(0, 2).sort()).toEqual(['6*4', '8*4'])
    expect(scored).not.toContain('9*3')
    // Without the warm-up: the first 3 due facts lead.
    const free = keys(pickMixBlocks(p, NOW_MS, 0, [])).slice(3, 6)
    expect(free.sort()).toEqual(['6*4', '7*3', '8*4'])
  })
})

describe('orderByTable: the P4–P8 order (§ 2.3 step 3, Kyle 2026-10-16)', () => {
  /** Picks with these A values, in pick order (B tells them apart). */
  const picks = (...as: number[]): MixPoolFact[] =>
    as.map((a, i) => ({
      fact: { a, b: i + 2, op: '*' },
      ref: { node: 'mult-mix', problem: i + 1 },
    }))
  const order = (before: number | undefined, ...as: number[]) =>
    orderByTable(picks(...as), before).map((x) => x.fact.a)
  const ids = (before: number | undefined, ...as: number[]) =>
    orderByTable(picks(...as), before).map((x) => x.fact.b - 2)
  const repeats = (before: number, seq: number[]) =>
    [before, ...seq].filter((a, i, all) => i > 0 && a === all[i - 1]).length

  it('the greedy pass when it finishes without a repeat', () => {
    expect(order(3, 4, 2, 5, 6, 7)).toEqual([4, 2, 5, 6, 7])
    expect(order(4, 4, 2, 5, 6, 7)).toEqual([2, 4, 5, 6, 7])
  })

  it("the first no-repeat order where greedy can't finish (the spec's example: after a 3, 4 2 3 4 4 → 4 2 4 3 4)", () => {
    expect(order(3, 4, 2, 3, 4, 4)).toEqual([4, 2, 4, 3, 4])
  })

  it('no order avoids a repeat: the fewest repeats, ties to the first order pick by pick', () => {
    // After a 3, one 2 and four 4s: at least 2 repeats. Greedy (2 first)
    // would make 3. Of the 2-repeat orders, the first in pick order puts
    // pick 1 (a 4) first, then the 2.
    const seq = order(3, 2, 4, 4, 4, 4)
    expect(repeats(3, seq)).toBe(2)
    expect(seq).toEqual([4, 2, 4, 4, 4])
    expect(ids(3, 2, 4, 4, 4, 4)).toEqual([1, 0, 2, 3, 4])
    // All the same table: the pick order itself.
    expect(ids(5, 5, 5, 5, 5, 5)).toEqual([0, 1, 2, 3, 4])
    // Devon's case (PR #576 review): after a 3, picks 3 3 3 3 5. Greedy gave
    // 5 3 3 3 3; both that and 3 3 3 5 3 have 3 repeats, and the pick-by-pick
    // tie-break keeps the 3s' picks first.
    const devon = order(3, 3, 3, 3, 3, 5)
    expect(devon).toEqual([3, 3, 3, 5, 3])
    expect(repeats(3, devon)).toBe(3)
    expect(ids(3, 3, 3, 3, 3, 5)).toEqual([0, 1, 2, 4, 3])
  })
})

describe('warm-up facts in a times mix (§ 2.3, Kyle 2026-10-16)', () => {
  // 7×3 is mult-6-9 #5: the warm-up heart.
  const HEART: CanonBlockRef = { node: 'mult-6-9', problem: 5 }

  it('a heart she got right may open the mix (P1–P3 skip nothing)', () => {
    const p = withBox(
      item(7, 3, 4, at(MON, 17)),
      item(2, 2, 2, at(MON, 17)),
      item(2, 3, 2, at(MON, 17)),
    )
    expect(keys(pickMixBlocks(p, NOW_MS, 0, [HEART])).slice(0, 3)).toContain(
      '7*3',
    )
  })

  it('a heart she missed skips the due picks but comes back in the fill when the rest are stronger', () => {
    // Every pool fact known and not due (box 2, seen today), but the
    // heart: box 1, due.
    const today = at(TUE, 7)
    const p = withBox(
      ...mixFactPool()
        .filter((x) => key(x.fact) !== '7*3')
        .map((x) => item(x.fact.a, x.fact.b, 2, today)),
      item(7, 3, 1, at(MON, 18)),
    )
    const scored = keys(pickMixBlocks(p, NOW_MS, 0, [HEART])).slice(3)
    // Not a due pick (its share of the cap is the heart's)…
    expect(keys(pickMixBlocks(p, NOW_MS, 0, [HEART]))).toHaveLength(8)
    // …but the weakest fact, so the fill brings it back once.
    expect(scored.filter((k) => k === '7*3')).toHaveLength(1)
    // Without the warm-up it is the due pick, P4 itself.
    expect(keys(pickMixBlocks(p, NOW_MS, 0, []))[3]).toBe('7*3')
  })
})
