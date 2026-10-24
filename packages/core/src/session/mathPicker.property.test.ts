/**
 * Property test (no-Claude plan phase 3 gate,
 * `design/native/no-claude-sizing.md` § 4 "Risks": the device now composes
 * the sessions Haiku composed, so the rules must hold every time).
 *
 * Over many seeds × progress docs (empty, all due, all new, random, and
 * two learners' docs side by side), for add-to-10 and sub-to-10 on the
 * bundled canon, every session the device builds (`composeSession` with
 * `mathPickRequestFor`'s request) must:
 *
 * 1. pass the step's composition rules (core's lint, on the built lines);
 * 2. keep Dave's § 2.2 slot rules as far as the 8 blocks allow. An oracle
 *    enumerates every lint-legal order of the 8 blocks and checks, with
 *    its own counting, that the pick is no further from each rule than the
 *    best legal order (the rules give way in Q2's order), that a due
 *    box-1/2 fact (under the cap) is never behind a fact it could swap
 *    with, that a due box-3–5 fact is never behind a not-due one, that a
 *    warm-up fact is never ahead of one it could swap with, and that the
 *    opening is the ramp with Q1's exception;
 * 3. never repeat the learner's previous session of the step in order;
 * 4. never pair a − fact with its + inverse from the warm-up (Q3).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  mathCompositionViolations,
  parseAddToTenReadLine,
  parseMissingNumberReadLine,
  parseSubToTenReadLine,
  type ComposedMathStep,
} from '../math/compositionRules'
import { localDateKey } from '../progress/clock'
import { defaultProgress } from '../progress/defaults'
import {
  LEITNER_DUE_PER_SESSION_CAP,
  leitnerOverdueDays,
} from '../progress/leitner'
import type { CanonBlockRef } from '../progress/reviewPlan'
import type {
  LeitnerBoxIndex,
  MathFact,
  Progress,
  SessionHistoryEntry,
} from '../progress/types'
import { bondKey } from '../wire/missingNumbers'
import {
  composeSession,
  type CanonText,
  type CanonTextResolver,
} from './composeSession'
import { mathPickRequestFor } from './mathPickRequest'
import type { MathPickRequest } from './mathPicker'

/** The loop tests' budget (`.claude/docs/testing-and-ci.md` § 1.1: a sweep
 *  gets an explicit one; the 5 s default timed out on the hosted runner). */
const LOOP_BUDGET_MS = 60_000

const CANON = JSON.parse(
  readFileSync('mobile/assets/canon/canon-text.json', 'utf8'),
) as Record<string, CanonText>
const resolve: CanonTextResolver = (key) =>
  CANON[`${key.track}/level-${key.level}/${key.focusNode}`] ?? null

// ── A seeded generator (mulberry32) ───────────────────────────────────────

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const NOW = new Date('2026-10-24T09:00:00.000Z').getTime()
const TODAY = localDateKey(new Date(NOW))
const DAY = 86_400_000

const key = (f: MathFact) => `${f.a}${f.op}${f.b}`
const bond = (f: MathFact) => (f.op === '+' ? bondKey(f.a, f.b) : key(f))
const family = (f: MathFact) =>
  f.op === '+'
    ? `${f.a + f.b}:${bondKey(f.a, f.b)}`
    : `${f.a}:${bondKey(f.b, f.a - f.b)}`

/** A canon block's fact (a missing number: given + missing). */
function readFact(text: string): MathFact {
  const missing = parseMissingNumberReadLine(text)
  if (missing !== null) return { a: missing.given, b: missing.missing, op: '+' }
  const add = parseAddToTenReadLine(text)
  if (add !== null) return { a: add.a, b: add.b, op: '+' }
  const sub = parseSubToTenReadLine(text)!
  return { a: sub.a, b: sub.b, op: '-' }
}

interface Step {
  step: ComposedMathStep
  /** The 8 blocks' read lines and facts, canon problem order. */
  reads: string[]
  facts: MathFact[]
  /** Every lint-legal order of the 8 blocks (indices 0..7). */
  legal: number[][]
}

function permutations(n: number): number[][] {
  const out: number[][] = []
  const walk = (left: number[], path: number[]) => {
    if (left.length === 0) out.push(path)
    left.forEach((x, i) =>
      walk([...left.slice(0, i), ...left.slice(i + 1)], [...path, x]),
    )
  }
  walk([...Array(n).keys()], [])
  return out
}

const linesOf = (reads: readonly string[], order: readonly number[]) => ({
  utterances: order.map((j, i) => ({
    id: `math.p${i + 1}.read`,
    text: reads[j]!,
  })),
})

function stepOf(step: ComposedMathStep): Step {
  const canon = CANON[`math/level-1/${step}`]!
  const reads = [1, 2, 3, 4, 5, 6, 7, 8].map(
    (n) => canon.utterances.find((u) => u.id === `math.p${n}.read`)!.text,
  )
  const legal = permutations(8).filter(
    (order) =>
      mathCompositionViolations(step, linesOf(reads, order)).length === 0,
  )
  return { step, reads, facts: reads.map(readFact), legal }
}

const STEPS = {
  'add-to-10': stepOf('add-to-10'),
  'sub-to-10': stepOf('sub-to-10'),
}

// ── Progress docs ─────────────────────────────────────────────────────────

/** Facts of other steps a box may hold (a warm-up may play them). */
const OTHER: MathFact[] = [
  { a: 9, b: 2, op: '+' },
  { a: 7, b: 3, op: '+' },
  { a: 6, b: 4, op: '+' },
  { a: 9, b: 1, op: '-' },
  { a: 10, b: 3, op: '-' },
  { a: 12, b: 2, op: '-' },
]

/** Facts no block of add-to-10 or sub-to-10 asks. */
const NO_BLOCK: MathFact[] = [
  { a: 1, b: 1, op: '+' },
  { a: 9, b: 2, op: '+' },
  { a: 12, b: 2, op: '-' },
]

type Kind = 'empty' | 'all-due' | 'all-new' | 'random'

function entry(
  item: MathFact,
  box: LeitnerBoxIndex,
  daysAgo: number,
): Progress['mathFactsLeitner']['items'][number] {
  return { item, box, lastSeen: daysAgo < 0 ? 0 : NOW - daysAgo * DAY }
}

function docOf(s: Step, kind: Kind, r: () => number): Progress {
  const base = defaultProgress()
  const pickBox = () => (1 + Math.floor(r() * 5)) as LeitnerBoxIndex
  let items: Progress['mathFactsLeitner']['items'] = []
  if (kind === 'all-due') {
    items = s.facts.map((f) => entry(f, pickBox(), 20))
  } else if (kind === 'all-new') {
    // Only facts with no block: every block of this step is new, and the
    // box still holds a due fact (so today's request would be hinted).
    items = NO_BLOCK.map((f) => entry(f, 1, 1))
  } else if (kind === 'random') {
    items = [...s.facts, ...OTHER].flatMap((f) =>
      r() < 0.2 ? [] : [entry(f, pickBox(), Math.floor(r() * 12) - 1)],
    )
  }
  const history: SessionHistoryEntry[] = []
  if (kind !== 'empty' && r() < 0.7) {
    const order = s.legal[Math.floor(r() * s.legal.length)]!
    history.push({
      dateISO: new Date(NOW - DAY).toISOString(),
      skillFocus: [s.step],
      successRate: 1,
      mathFacts: order.map((j) => s.facts[j]!),
      latencyMs: order.map(() => 2000),
    })
  }
  const seenItems: Progress['seenItems'] = {}
  for (const f of s.facts) {
    if (r() < 0.5) {
      seenItems[`math:${key(f)}`] = {
        day: r() < 0.5 ? TODAY : '2026-10-1' + Math.floor(r() * 10),
        count: 1 + Math.floor(r() * 5),
        correct: r() < 0.7,
      }
    }
  }
  return { ...base, mathFactsLeitner: { items }, history, seenItems }
}

/** Slow facts ride in from the history; the request builder reads them. */
function slowHistory(s: Step, r: () => number): SessionHistoryEntry[] {
  const slow = s.facts.filter(() => r() < 0.3)
  return Array.from({ length: slow.length > 0 ? 5 : 0 }, (_, i) => ({
    dateISO: new Date(NOW - (10 + i) * DAY).toISOString(),
    skillFocus: [s.step],
    successRate: 1,
    mathFacts: slow,
    latencyMs: slow.map(() => 8000),
  }))
}

/** Up to 2 warm-up blocks: a step's own block, or another step's (whose
 *  fact can be the inverse of one of this step's). */
function warmupOf(s: Step, r: () => number): CanonBlockRef[] {
  const refs: CanonBlockRef[] = []
  const pool: CanonBlockRef[] = [
    { node: s.step, problem: 1 + Math.floor(r() * 8) },
    { node: 'add-to-10', problem: 4 }, // 7 + 3: 10 - 3 and 10 - 7's inverse
    { node: 'sub-to-10', problem: 5 }, // 10 - 3: 7 + 3's inverse
    { node: 'add-to-20', problem: 1 },
  ]
  const n = Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const ref = pool[Math.floor(r() * pool.length)]!
    if (!refs.some((x) => x.node === ref.node && x.problem === ref.problem)) {
      refs.push(ref)
    }
  }
  return refs
}

// ── The oracle ────────────────────────────────────────────────────────────

interface Facts {
  box: number
  due: boolean
  overdue: number
  isNew: boolean
}

function oracle(s: Step, req: MathPickRequest) {
  const byKey = new Map(req.leitner.items.map((e) => [key(e.item), e]))
  const state = (f: MathFact): Facts => {
    const e = byKey.get(key(f))
    if (e === undefined) return { box: 0, due: false, overdue: -1, isNew: true }
    const overdue = leitnerOverdueDays(e, NOW)
    return { box: e.box, due: overdue >= 0, overdue, isNew: false }
  }
  const warmBonds = new Set(req.warmup.map(bond))
  const warm = (f: MathFact) => warmBonds.has(bond(f))
  const slowKeys = new Set(req.slow.map(key))
  const dueLow = (f: MathFact) => state(f).due && state(f).box <= 2
  const cap = Math.max(0, LEITNER_DUE_PER_SESSION_CAP - req.warmup.length)
  const capped = new Set(
    s.facts
      .filter((f) => dueLow(f) && !warm(f))
      .sort(
        (x, y) =>
          state(y).overdue - state(x).overdue ||
          state(x).box - state(y).box ||
          (key(x) < key(y) ? -1 : 1),
      )
      .slice(0, cap)
      .map(key),
  )
  const slowCounted = req.slow
    .map(key)
    .filter((k) => s.facts.some((f) => key(f) === k && !warm(f) && !dueLow(f)))
    .slice(0, 2)
  const known = (f: MathFact) => state(f).box >= 3 || slowKeys.has(key(f))
  const knownish = (f: MathFact) => state(f).box >= 2 || slowKeys.has(key(f))
  const previous = req.previous?.map(key).join(',') ?? null
  /** Dave's shortfalls, most important first (Q2). */
  const shortfall = (order: readonly MathFact[]) => {
    const trap = order.slice(3)
    const keys = new Set(order.map(key))
    return [
      previous !== null && order.map(key).join(',') === previous ? 1 : 0,
      slowCounted.length > 0 && !slowCounted.some((k) => keys.has(k)) ? 1 : 0,
      Math.max(0, 3 - order.filter(known).length),
      Math.max(0, 3 - order.filter(knownish).length),
      [...capped].filter((k) => !keys.has(k)).length,
      Math.max(0, order.filter(dueLow).length - cap),
      Math.max(0, trap.filter((f) => state(f).isNew).length - 2),
    ]
  }
  /** Q1's opening: the ramp, but a due box-1/2 fact opens only when no
   *  box >= 2 fact that is not due can. */
  const opening = (three: readonly MathFact[]) => {
    const answer = (f: MathFact) => (f.op === '+' ? f.a + f.b : f.a - f.b)
    const rampOrder = [...three].sort(
      (x, y) => answer(x) - answer(y) || (key(x) < key(y) ? -1 : 1),
    )
    if (!dueLow(rampOrder[0]!)) return rampOrder
    const opener = rampOrder.find((f) => !dueLow(f) && state(f).box >= 2)
    return opener === undefined
      ? rampOrder
      : [opener, ...rampOrder.filter((f) => f !== opener)]
  }
  return { state, warm, capped, dueLow, shortfall, opening }
}

const lex = (x: readonly number[], y: readonly number[]) => {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!
  return 0
}

function check(s: Step, p: Progress, warmup: CanonBlockRef[], seed: number) {
  const req = mathPickRequestFor(
    p,
    s.step,
    { kind: 'forward', warmup },
    NOW,
    TODAY,
    seed,
  )
  if (req === null) return 'not picked'
  const payload = {
    track: 'math',
    level: 1,
    childName: 'friend',
    progress: { focusNode: s.step },
    ...(warmup.length > 0 ? { warmup: { blocks: warmup } } : {}),
  }
  const out = composeSession(payload, resolve, { mathPick: req })
  expect(out.kind).toBe('local')
  if (out.kind !== 'local') throw new Error(out.kind)
  expect(out.served).toBe('pick')
  // 1. The composition rules, on the lines the device plays.
  expect(mathCompositionViolations(s.step, out.session)).toEqual([])
  const reads = [1, 2, 3, 4, 5, 6, 7, 8].map(
    (n) => out.session.utterances.find((u) => u.id === `math.p${n}.read`)!.text,
  )
  const order = reads.map((text) => s.reads.indexOf(text))
  expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  const facts = order.map((j) => s.facts[j]!)

  // 4. Dual exposure against the warm-up blocks that play.
  const played = warmup.filter((_, i) =>
    out.session.utterances.some((u) => u.id.startsWith(`math.w${i + 1}.`)),
  )
  const playedFacts = played.map((ref) => {
    const canon = resolve({ track: 'math', level: 1, focusNode: ref.node })!
    return readFact(
      canon.utterances.find((u) => u.id === `math.p${ref.problem}.read`)!.text,
    )
  })
  // A dropped warm-up block is one whose inverse is in the step's pool.
  for (const ref of warmup.filter((x) => !played.includes(x))) {
    const canon = resolve({ track: 'math', level: 1, focusNode: ref.node })!
    const w = readFact(
      canon.utterances.find((u) => u.id === `math.p${ref.problem}.read`)!.text,
    )
    expect(w.op).not.toBe(s.facts[0]!.op)
    expect(s.facts.map(family)).toContain(family(w))
  }
  // The rules count the warm-up that plays.
  const o = oracle(s, { ...req, warmup: playedFacts })
  for (const w of playedFacts) {
    if (w.op === facts[0]!.op) continue
    expect(facts.map(family)).not.toContain(family(w))
  }

  // 2. Dave's slot rules, against every legal order.
  const best = s.legal
    .map((ord) => ord.map((j) => s.facts[j]!))
    .filter((ord) => {
      const three = o.opening(ord.slice(0, 3))
      return three.every((f, i) => f === ord[i])
    })
    .map(o.shortfall)
    .sort(lex)[0]!
  expect(o.shortfall(facts)).toEqual(best)
  expect(facts.slice(0, 3)).toEqual(o.opening(facts.slice(0, 3)))
  const legalSwap = (i: number, j: number) => {
    const swapped = [...order]
    ;[swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!]
    const ord = swapped.map((x) => s.facts[x]!)
    return (
      mathCompositionViolations(s.step, linesOf(s.reads, swapped)).length ===
        0 && lex(o.shortfall(ord), o.shortfall(facts)) <= 0
    )
  }
  for (let i = 3; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      const [x, y] = [facts[i]!, facts[j]!]
      const capX = o.capped.has(key(x))
      const capY = o.capped.has(key(y))
      // A capped due fact leads every fact it could swap with.
      if (capY && !capX && legalSwap(i, j)) {
        throw new Error(`${key(y)} (due) behind ${key(x)} at P${i + 1}`)
      }
      // A due box-3-5 fact leads a not-due one.
      const sx = o.state(x)
      const sy = o.state(y)
      const plainNotDue = (f: MathFact, st: Facts) =>
        !st.isNew &&
        !st.due &&
        !o.warm(f) &&
        !req.slow.some((z) => key(z) === key(f))
      if (
        sy.due &&
        sy.box >= 3 &&
        !o.warm(y) &&
        plainNotDue(x, sx) &&
        legalSwap(i, j)
      ) {
        throw new Error(`${key(y)} (due box ${sy.box}) behind ${key(x)}`)
      }
      // A warm-up fact plays after every fact it could swap with.
      if (o.warm(x) && !o.warm(y) && legalSwap(i, j)) {
        throw new Error(`${key(x)} (warm-up) ahead of ${key(y)}`)
      }
    }
  }
  // 3. Never the previous session's order.
  if (req.previous !== null) {
    expect(facts.map(key)).not.toEqual(req.previous.map(key))
  }
  return 'picked'
}

describe('every session the device picks keeps the composition and § 2.2 rules', () => {
  for (const step of ['add-to-10', 'sub-to-10'] as const) {
    it(
      `${step}: ${STEPS[step].legal.length} legal orders; 4 doc kinds × 40 docs × 3 seeds`,
      () => {
        const s = STEPS[step]
        const r = rng(step === 'add-to-10' ? 10 : 20)
        let picked = 0
        for (const kind of ['empty', 'all-due', 'all-new', 'random'] as const) {
          for (let d = 0; d < 40; d++) {
            const doc = docOf(s, kind, r)
            const p: Progress = {
              ...doc,
              history: [...slowHistory(s, r), ...doc.history],
            }
            const warmup = warmupOf(s, r)
            for (const seed of [0, 3, 11]) {
              if (check(s, p, warmup, seed) === 'picked') picked += 1
            }
          }
        }
        // Not vacuous: most docs carry a hint, so the device picks them.
        expect(picked).toBeGreaterThan(300)
      },
      LOOP_BUDGET_MS,
    )
  }

  it(
    'two learners: each pick follows that learner’s own box and previous session',
    () => {
      const r = rng(30)
      for (const step of ['add-to-10', 'sub-to-10'] as const) {
        const s = STEPS[step]
        for (let d = 0; d < 40; d++) {
          const a = docOf(s, 'random', r)
          const b = docOf(s, 'all-due', r)
          const req = (p: Progress) =>
            mathPickRequestFor(
              p,
              step,
              { kind: 'forward', warmup: [] },
              NOW,
              TODAY,
              d,
            )
          const first = req(a)
          const other = req(b)
          // Learner B's state never reaches A's request (and back).
          expect(req(a)).toEqual(first)
          expect(req(b)).toEqual(other)
          for (const p of [a, b]) check(s, p, [], d)
        }
      }
    },
    LOOP_BUDGET_MS,
  )
})
