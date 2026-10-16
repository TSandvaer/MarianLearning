/**
 * Same-day mixed review and the daily warm-up: which canon blocks a
 * session plays (native spec `design/native/review-mode-and-warmup-native.md`
 * §§ 2, 7.1–7.4, approved by Thomas 2026-10-14 after Dave's pacing
 * consult).
 *
 * - **Review** (D1): today's flower in a world is asleep and the child
 *   plays that world again. The session is 8 canon problems from the steps
 *   she has mastered beyond the diagnostic baseline, mixed across steps
 *   (Taylor & Rohrer 2010), with no flower and no bonus.
 * - **Warm-up** (D4, D5): the first session of each calendar day in a
 *   world opens with up to 2 problems she has seen before. Math picks the
 *   most overdue DUE Leitner facts a canon block can serve (the current
 *   step included); Word Song picks 2 items of the most recently mastered
 *   step (never the current one).
 *
 * Core only picks `(step, problem 1–8)` references. The server copies those
 * blocks out of the canon files with their baked audio (`api/_review.ts`):
 * `api/` can import nothing from core but the import-free `wire/` modules,
 * so every choice lives here, and the server never picks.
 *
 * Pure: no storage, no clock. Callers pass the progress doc, the progress
 * clock's `nowMs()` / `todayKey()` and a seed (the session count at kick
 * time, so back-to-back reviews draw different blocks).
 */
import { buildHubCardModel, currentStepOf } from '../hub/hubCardModel'
import {
  MIX_BLOCK_COUNT,
  MIX_SOURCE_STEPS as WIRE_MIX_SOURCE_STEPS,
  REVIEW_BLOCK_COUNT,
  WARMUP_BLOCK_MAX,
  type CanonBlockRef as WireCanonBlockRef,
} from '../wire/types'
import { CANON_MATH_FACTS } from './canonMathFacts.generated'
import { localDateKey } from './clock'
import { defaultProgress } from './defaults'
import {
  buildLeitnerSessionHint,
  dueLeitnerItems,
  LEITNER_DUE_PER_SESSION_CAP,
  leitnerBoxForFocus,
  leitnerOverdueDays,
  type LeitnerSessionHintItem,
} from './leitner'
import { LITERACY_TREE, MATH_TREE, type MasteryTrack } from './mastery'
import type {
  LeitnerBox,
  LeitnerBoxIndex,
  MathFact,
  NumberGardenNode,
  Progress,
  SkillNode,
} from './types'

/** A review is always 8 problems. */
export const REVIEW_PROBLEMS = REVIEW_BLOCK_COUNT
/** A warm-up plays at most 2 problems. */
export const WARMUP_PROBLEMS = 2
/** The wire's cap on warm-up refs; never exceeded. */
export const WARMUP_MAX = WARMUP_BLOCK_MAX

/** One canon problem: step `node`, problem `problem` (1..8) of its canon file. */
export interface CanonBlockRef extends WireCanonBlockRef {
  node: SkillNode
  problem: number
}

/** What a session start asks the server for (§ 2). A forward session on
 *  the times-mix step also names its 8 blocks (content wave 1 § 2.4). */
export type SessionPlanKind =
  | { kind: 'review'; blocks: CanonBlockRef[] }
  | { kind: 'forward'; warmup: CanonBlockRef[]; mix?: CanonBlockRef[] }

function treeOf(world: MasteryTrack): readonly SkillNode[] {
  return world === 'math' ? MATH_TREE : LITERACY_TREE
}

let baseline: ReadonlySet<SkillNode> | null = null

/**
 * The steps that are `'mastered'` in `defaultProgress()` (D2): Marian's
 * diagnostic baseline, never reviewed and never a Word Song warm-up
 * source. Computed from the defaults, so a baseline change follows.
 */
export function reviewBaseline(): ReadonlySet<SkillNode> {
  if (baseline === null) {
    const levels = defaultProgress().skillLevels
    baseline = new Set(
      [...MATH_TREE, ...LITERACY_TREE].filter((n) => levels[n] === 'mastered'),
    )
  }
  return baseline
}

/**
 * The steps a review draws from: mastered and not baseline, in tree order
 * (so the last is the most recently mastered). `[]` for a complete world,
 * which has no sleeping flower.
 */
export function reviewPool(p: Progress, world: MasteryTrack): SkillNode[] {
  const tree = treeOf(world)
  if (tree.every((n) => p.skillLevels[n] === 'mastered')) return []
  const base = reviewBaseline()
  return tree.filter((n) => p.skillLevels[n] === 'mastered' && !base.has(n))
}

/**
 * D1: today's flower in `world` is asleep (`buildHubCardModel`'s
 * `earnedToday && !complete`) and there is something to review. Off when
 * the parent switched the separate-days rule off (nothing sleeps then).
 */
export function isReviewSession(
  p: Progress,
  world: MasteryTrack,
  today: string,
): boolean {
  const card = buildHubCardModel(p, world, today)
  return card.earnedToday && !card.complete && reviewPool(p, world).length > 0
}

/** The mastery rule's local-day key of a history timestamp. */
function historyDayKey(dateISO: string): string {
  const ms = Date.parse(dateISO)
  return Number.isNaN(ms) ? dateISO : localDateKey(new Date(ms))
}

/**
 * § 7.3: no `progress.history` entry for `world` is dated `today`. Reviews
 * write no history, but a review always follows that world's forward
 * entry of the same day, so it never makes a later session look first.
 */
export function isFirstSessionToday(
  p: Progress,
  world: MasteryTrack,
  today: string,
): boolean {
  const steps = new Set<SkillNode>(treeOf(world))
  return !p.history.some(
    (entry) =>
      entry.skillFocus.some((n) => steps.has(n)) &&
      historyDayKey(entry.dateISO) === today,
  )
}

/** `rot(seed)`: the 8 problem numbers, starting at `seed % 8 + 1`. */
function rot(seed: number): number[] {
  const s = ((Math.trunc(seed) % 8) + 8) % 8
  return Array.from({ length: 8 }, (_, i) => ((s + i) % 8) + 1)
}

const factKey = (f: MathFact): string => `${f.a}${f.op}${f.b}`

function isMathStep(node: SkillNode): node is NumberGardenNode {
  return (MATH_TREE as readonly SkillNode[]).includes(node)
}

/** The canon fact of a math block, `null` for a non-fact problem. */
function canonFact(ref: CanonBlockRef): MathFact | null {
  if (!isMathStep(ref.node)) return null
  return CANON_MATH_FACTS[ref.node][ref.problem - 1] ?? null
}

/** The first block of `steps` whose canon problem is `fact`, else `null`. */
function blockFor(
  fact: MathFact,
  steps: readonly SkillNode[],
): CanonBlockRef | null {
  const key = factKey(fact)
  for (const node of steps) {
    if (!isMathStep(node)) continue
    const j = CANON_MATH_FACTS[node].findIndex(
      (f) => f !== null && factKey(f) === key,
    )
    if (j >= 0) return { node, problem: j + 1 }
  }
  return null
}

interface RankedFact {
  fact: MathFact
  box: LeitnerBoxIndex
}

/**
 * The box's DUE facts, most overdue first (§ 7.2 rank): overdue days
 * descending, then box ascending, then the key `${a}${op}${b}`.
 */
function rankedDueFacts(p: Progress, nowMs: number): RankedFact[] {
  return p.mathFactsLeitner.items
    .map((entry) => ({
      fact: entry.item,
      box: entry.box,
      overdue: leitnerOverdueDays(entry, nowMs),
      key: factKey(entry.item),
    }))
    .filter((r) => r.overdue >= 0)
    .sort(
      (x, y) =>
        y.overdue - x.overdue ||
        x.box - y.box ||
        (x.key < y.key ? -1 : x.key > y.key ? 1 : 0),
    )
    .map(({ fact, box }) => ({ fact, box }))
}

const sameRef = (a: CanonBlockRef, b: CanonBlockRef) =>
  a.node === b.node && a.problem === b.problem

/**
 * § 7.2: the review's 8 blocks, or `[]` when there is nothing to review.
 *
 * 1. Math only: up to `LEITNER_DUE_PER_SESSION_CAP` due facts, most
 *    overdue first, each as the first block of the review steps (newest
 *    step first) that serves it.
 * 2. Fill round-robin over the steps, newest first, each offering its next
 *    problem in `rot(seed)` order, skipping a block already picked or
 *    (Math) a fact already picked, until 8.
 * 3. Order: group by step (due picks first in a group), then emit one per
 *    step per cycle, newest step first.
 */
export function pickReviewBlocks(
  p: Progress,
  world: MasteryTrack,
  nowMs: number,
  seed: number,
): CanonBlockRef[] {
  const pool = reviewPool(p, world)
  if (pool.length === 0) return []
  const steps = [...pool].reverse()
  const math = world === 'math'
  const picked: { ref: CanonBlockRef; due: boolean }[] = []
  const pickedFacts = new Set<string>()
  const has = (ref: CanonBlockRef) => picked.some((x) => sameRef(x.ref, ref))

  if (math) {
    for (const { fact } of rankedDueFacts(p, nowMs)) {
      if (picked.length >= LEITNER_DUE_PER_SESSION_CAP) break
      if (pickedFacts.has(factKey(fact))) continue
      const ref = blockFor(fact, steps)
      if (ref === null || has(ref)) continue
      picked.push({ ref, due: true })
      pickedFacts.add(factKey(fact))
    }
  }

  const order = rot(seed)
  const cursor = new Map<SkillNode, number>(steps.map((s) => [s, 0]))
  let active = [...steps]
  while (picked.length < REVIEW_PROBLEMS && active.length > 0) {
    const exhausted = new Set<SkillNode>()
    for (const node of active) {
      if (picked.length >= REVIEW_PROBLEMS) break
      let offered = false
      let i = cursor.get(node)!
      while (i < order.length) {
        const ref: CanonBlockRef = { node, problem: order[i]! }
        i += 1
        if (has(ref)) continue
        const fact = math ? canonFact(ref) : null
        if (fact !== null && pickedFacts.has(factKey(fact))) continue
        picked.push({ ref, due: false })
        if (fact !== null) pickedFacts.add(factKey(fact))
        offered = true
        break
      }
      cursor.set(node, i)
      if (!offered) exhausted.add(node)
    }
    active = active.filter((n) => !exhausted.has(n))
  }

  const groups = new Map<SkillNode, CanonBlockRef[]>(steps.map((s) => [s, []]))
  for (const due of [true, false]) {
    for (const x of picked)
      if (x.due === due) groups.get(x.ref.node)!.push(x.ref)
  }
  const out: CanonBlockRef[] = []
  while (out.length < picked.length) {
    for (const node of steps) {
      const next = groups.get(node)!.shift()
      if (next !== undefined) out.push(next)
    }
  }
  return out
}

/**
 * § 7.2: the warm-up's 0–2 blocks; `[]` unless this is the first session
 * today in `world` (D5).
 *
 * - Math: the due facts a block of the current step or a review step
 *   serves (current step first, then newest step first), most overdue
 *   first. Heart 1 is the top one in box 2 or higher, a fact she got right
 *   last time (else simply the top one); heart 2 the next. Never a
 *   not-yet-due fact, and no fill.
 * - Word Song: the first 2 of `rot(seed)` from the most recently mastered
 *   review step, never the current step; `[]` without one.
 */
export function pickWarmupBlocks(
  p: Progress,
  world: MasteryTrack,
  nowMs: number,
  today: string,
  seed: number,
): CanonBlockRef[] {
  if (!isFirstSessionToday(p, world, today)) return []
  const pool = reviewPool(p, world)
  if (world === 'word-song') {
    const newest = pool[pool.length - 1]
    if (newest === undefined) return []
    return rot(seed)
      .slice(0, WARMUP_PROBLEMS)
      .map((problem) => ({ node: newest, problem }))
  }
  const steps = [currentStepOf(p, world), ...[...pool].reverse()]
  const candidates: { ref: CanonBlockRef; box: LeitnerBoxIndex }[] = []
  for (const { fact, box } of rankedDueFacts(p, nowMs)) {
    const ref = blockFor(fact, steps)
    if (ref !== null && !candidates.some((c) => sameRef(c.ref, ref))) {
      candidates.push({ ref, box })
    }
  }
  const first = candidates.find((c) => c.box >= 2) ?? candidates[0]
  if (first === undefined) return []
  const second = candidates.find((c) => c !== first)
  return second === undefined ? [first.ref] : [first.ref, second.ref]
}

/**
 * § 2: what the session start asks for. A review when today's flower is
 * asleep and 8 blocks can be picked; otherwise the forward session with
 * its warm-up (0–2 blocks). A review and a warm-up never meet: a review
 * needs today's history entry, a warm-up its absence. A forward session
 * whose focus is the times-mix step carries its 8 blocks too (content
 * wave 1 § 2.4), picked after the warm-up so they share one due cap.
 *
 * `focus` is the session's forward focus step (`pickFocusNode`'s); without
 * it, the world's current step.
 */
export function sessionPlanKind(
  p: Progress,
  world: MasteryTrack,
  nowMs: number,
  today: string,
  seed: number,
  focus?: SkillNode,
): SessionPlanKind {
  if (isReviewSession(p, world, today)) {
    const blocks = pickReviewBlocks(p, world, nowMs, seed)
    if (blocks.length === REVIEW_PROBLEMS) return { kind: 'review', blocks }
  }
  const warmup = pickWarmupBlocks(p, world, nowMs, today, seed)
  const step = focus ?? currentStepOf(p, world)
  if (world === 'math' && step === MIX_STEP) {
    const mix = pickMixBlocks(p, nowMs, seed, warmup)
    if (mix.length === MIX_BLOCK_COUNT) return { kind: 'forward', warmup, mix }
  }
  return { kind: 'forward', warmup }
}

// ── Times mix (content wave 1 § 2.2–§ 2.3) ──────────────────────────────

/** The times-mix step. */
const MIX_STEP: NumberGardenNode = 'mult-mix'

/**
 * The steps a times mix draws its blocks from, in pool order (the first
 * block of a fact wins). The wire's list, typed (the server validates refs
 * against it).
 */
export const MIX_SOURCE_STEPS: readonly NumberGardenNode[] =
  WIRE_MIX_SOURCE_STEPS as readonly NumberGardenNode[]

/**
 * The pool's group sizes (A, the number in each group) and group counts
 * (B). Up to 5 groups: the plates picture holds at most 5 plates (§ 2.2,
 * K6). One place: Dave's marks (§ 12 D2) may widen it.
 */
export const MIX_GROUP_SIZE = { min: 2, max: 9 } as const
export const MIX_GROUP_COUNT = { min: 2, max: 5 } as const

/** One pool fact and the canon block that serves it. */
export interface MixPoolFact {
  fact: MathFact
  ref: CanonBlockRef
}

let mixPool: readonly MixPoolFact[] | null = null

/**
 * § 2.2: every canon block of `MIX_SOURCE_STEPS` whose fact is `A * B` with
 * A in `MIX_GROUP_SIZE` and B in `MIX_GROUP_COUNT`, once per fact (the
 * first block in step order). 28 facts with today's canon.
 */
export function mixFactPool(): readonly MixPoolFact[] {
  if (mixPool !== null) return mixPool
  const out: MixPoolFact[] = []
  const seen = new Set<string>()
  for (const node of MIX_SOURCE_STEPS) {
    CANON_MATH_FACTS[node].forEach((fact, i) => {
      if (fact === null || fact.op !== '*') return
      if (fact.a < MIX_GROUP_SIZE.min || fact.a > MIX_GROUP_SIZE.max) return
      if (fact.b < MIX_GROUP_COUNT.min || fact.b > MIX_GROUP_COUNT.max) return
      const key = factKey(fact)
      if (seen.has(key)) return
      seen.add(key)
      out.push({ fact, ref: { node, problem: i + 1 } })
    })
  }
  mixPool = out
  return out
}

/** P1–P3 of a times mix: the gentle opening. */
const MIX_OPENING = 3
/** P1–P3 open on facts she got right before: box 2 or higher. */
const MIX_KNOWN_MIN_BOX = 2

const product = (f: MathFact) => f.a * f.b
const byKey = (x: MathFact, y: MathFact) => {
  const a = factKey(x)
  const b = factKey(y)
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * § 2.3 step 3 (Kyle, 2026-10-16): of all orders of `picks`, the one with
 * the fewest neighbours sharing A (`before`, P3's A, neighbours the first);
 * ties go to the order that comes first compared pick by pick in pick
 * order. When a no-repeat order exists this is the first one, which is the
 * greedy pass ("take the next pick whose A differs") whenever that pass
 * finishes without a repeat; e.g. after a 3, A 4, 2, 3, 4, 4 plays as
 * 4, 2, 4, 3, 4. A depth-first search in pick order (at most 120 orders
 * for five picks) that keeps the first order with the fewest repeats and
 * prunes branches that can no longer beat it.
 */
export function orderByTable(
  picks: readonly MixPoolFact[],
  before: number | undefined,
): MixPoolFact[] {
  let best: MixPoolFact[] = [...picks]
  let bestRepeats = Number.POSITIVE_INFINITY
  const walk = (
    left: readonly MixPoolFact[],
    prev: number | undefined,
    path: MixPoolFact[],
    repeats: number,
  ): void => {
    if (repeats >= bestRepeats) return
    if (left.length === 0) {
      best = path
      bestRepeats = repeats
      return
    }
    for (let i = 0; i < left.length && bestRepeats > 0; i++) {
      const x = left[i]!
      walk(
        left.filter((_, j) => j !== i),
        x.fact.a,
        [...path, x],
        repeats + (x.fact.a === prev ? 1 : 0),
      )
    }
  }
  walk(picks, before, [], 0)
  return best
}

/**
 * § 2.3: the 8 blocks of a times-mix session.
 *
 * `strength(f)` = the fact's Leitner box (1–5), or 0 when it has none.
 *
 * 1. P1–P3: the 3 facts with strength ≥ 2 and the highest strength (ties:
 *    the smaller product, then the key `${a}*${b}`); fewer than 3 → the
 *    smallest products fill. Played in product order, smallest first.
 * 2. P4–P8: the due facts first, ranked as `rankedDueFacts`, up to
 *    `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's fact count,
 *    skipping warm-up facts and P1–P3; then the lowest strength first,
 *    ties by pool index rotated by `seed`.
 * 3. P4–P8 in pick order, except that when the next pick has the same A as
 *    the problem before it (P3 included), the first later pick with
 *    another A goes first (`orderByTable`).
 *
 * `seed` is the session count at kick time (as for reviews), so the
 * prefetch and the tap ask for the same refs. Pure.
 */
export function pickMixBlocks(
  p: Progress,
  nowMs: number,
  seed: number,
  warmup: readonly CanonBlockRef[],
): CanonBlockRef[] {
  const pool = mixFactPool()
  const box = new Map(
    p.mathFactsLeitner.items.map((e) => [factKey(e.item), e.box as number]),
  )
  const strength = (f: MathFact) => box.get(factKey(f)) ?? 0
  const picked = new Set<string>()

  // 1. The opening.
  const known = pool
    .filter((x) => strength(x.fact) >= MIX_KNOWN_MIN_BOX)
    .sort(
      (x, y) =>
        strength(y.fact) - strength(x.fact) ||
        product(x.fact) - product(y.fact) ||
        byKey(x.fact, y.fact),
    )
  const smallest = [...pool].sort(
    (x, y) => product(x.fact) - product(y.fact) || byKey(x.fact, y.fact),
  )
  const opening: MixPoolFact[] = []
  for (const x of [...known, ...smallest]) {
    if (opening.length >= MIX_OPENING) break
    if (picked.has(factKey(x.fact))) continue
    opening.push(x)
    picked.add(factKey(x.fact))
  }
  opening.sort(
    (x, y) => product(x.fact) - product(y.fact) || byKey(x.fact, y.fact),
  )

  // 2. The weak facts: due first (one cap shared with the warm-up), then
  //    the lowest strength.
  const warmFacts = new Set(warmupFactsOf(warmup).map(factKey))
  const byFact = new Map(pool.map((x) => [factKey(x.fact), x]))
  const cap = Math.max(0, LEITNER_DUE_PER_SESSION_CAP - warmFacts.size)
  const rest: MixPoolFact[] = []
  for (const { fact } of rankedDueFacts(p, nowMs)) {
    if (rest.length >= cap) break
    const key = factKey(fact)
    const x = byFact.get(key)
    if (x === undefined || picked.has(key) || warmFacts.has(key)) continue
    rest.push(x)
    picked.add(key)
  }
  const rotated = (i: number) => (i + seed) % pool.length
  const fill = pool
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => !picked.has(factKey(x.fact)))
    .sort(
      (u, v) =>
        strength(u.x.fact) - strength(v.x.fact) || rotated(u.i) - rotated(v.i),
    )
  for (const { x } of fill) {
    if (rest.length >= MIX_BLOCK_COUNT - opening.length) break
    rest.push(x)
  }

  // 3. Neighbours from different tables whenever possible.
  const ordered = orderByTable(rest, opening[opening.length - 1]?.fact.a)
  return [...opening, ...ordered].map((x) => ({ ...x.ref }))
}

/** The canon facts of a math warm-up's blocks (non-fact blocks dropped). */
export function warmupFactsOf(blocks: readonly CanonBlockRef[]): MathFact[] {
  return blocks.flatMap((ref) => {
    const fact = canonFact(ref)
    return fact === null ? [] : [fact]
  })
}

/**
 * The forward request's Leitner hint when a math warm-up rides along
 * (§ 7.4, one shared cap of 3 overdue facts per session): the due box
 * without the warm-up's facts, narrowed to the focus step's facts, capped
 * at `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's fact count. The
 * planner is never steered to a warm-up fact. Without a warm-up it is
 * exactly the hint the session start sent before.
 */
export function forwardLeitnerHint(
  box: LeitnerBox<MathFact>,
  nowMs: number,
  focusNode: SkillNode | undefined,
  warmup: readonly CanonBlockRef[],
): LeitnerSessionHintItem[] {
  const facts = warmupFactsOf(warmup)
  const taken = new Set(facts.map(factKey))
  const due = dueLeitnerItems(box, nowMs)
  const rest: LeitnerBox<MathFact> =
    taken.size === 0
      ? due
      : { items: due.items.filter((e) => !taken.has(factKey(e.item))) }
  return buildLeitnerSessionHint(
    leitnerBoxForFocus(rest, focusNode),
    Math.max(0, LEITNER_DUE_PER_SESSION_CAP - facts.length),
  )
}
