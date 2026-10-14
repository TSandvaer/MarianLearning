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

/** What a session start asks the server for (§ 2). */
export type SessionPlanKind =
  | { kind: 'review'; blocks: CanonBlockRef[] }
  | { kind: 'forward'; warmup: CanonBlockRef[] }

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
 * needs today's history entry, a warm-up its absence.
 */
export function sessionPlanKind(
  p: Progress,
  world: MasteryTrack,
  nowMs: number,
  today: string,
  seed: number,
): SessionPlanKind {
  if (isReviewSession(p, world, today)) {
    const blocks = pickReviewBlocks(p, world, nowMs, seed)
    if (blocks.length === REVIEW_PROBLEMS) return { kind: 'review', blocks }
  }
  return {
    kind: 'forward',
    warmup: pickWarmupBlocks(p, world, nowMs, today, seed),
  }
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
