/**
 * The device's math picker (no-Claude plan phase 3,
 * `design/native/no-claude-sizing.md` § 2 "How the picker rules plug in"
 * item 1, § 4 row 3): the 8 problems of an add-to-10 or sub-to-10 session,
 * picked from the step's canon blocks with the learner's Leitner box, where
 * the live planner's Leitner and slow-fact directives used to pick them.
 *
 * Dave's rules (`design/research/no-claude-variety-2026-10-23.md` § 2.2 and
 * § 2.1, with his 2026-10-24 rulings Q1–Q4), inside the step's composition
 * rules (`../math/compositionRules.ts`), which every pick passes. The
 * composition rules decide the slot; Leitner decides what gets in.
 *
 * - P1–P3 open on facts she answers reliably (known: box ≥ 3, or a slow
 *   fact), easy band, in ramp order (smallest answer first).
 * - P4–P8 take, in this order: the due box-1/2 facts, most overdue first
 *   (at most `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's facts, a cap
 *   that counts them wherever they sit); the slow facts (accurate but slow:
 *   the old slow-fact directive's 1–2); at most 2 new facts; the due
 *   box-3–5 facts, most overdue first; then the not-due facts from the
 *   lowest box, those not met today first, then the least recently met
 *   (`Progress.seenItems`). Another easy fact sits here only when nothing
 *   else fits (§ 2.1 rule 3, "keep each step's ramp").
 * - Q1: a due box-1/2 fact whose band is barred from P4–P8 (sub-to-10's
 *   easy band; add-to-10's through today's fixed blocks) still gets in: it
 *   plays in P2 or P3, never P1 while a box ≥ 2 fact can open the session.
 * - At least 3 of the 8 are known. No fact twice; on + no turnaround or
 *   missing-number twin either (the composition rules' same-bond rule, Q3);
 *   − bars only the same fact. A fact the warm-up just played plays last.
 *   Never the same facts in the same order as her previous session of the
 *   step.
 * - Q3, dual exposure (`design/math/sub-to-10-content.md` § 7): a − fact
 *   never shares a session with its + inverse. The 8 are single-operation,
 *   so this binds the warm-up: the 8 avoid a warm-up fact's inverse; when no
 *   legal 8 can, that warm-up block is dropped (`dropWarmup`).
 *
 * The five rules a learner's box or the pool can make impossible (an
 * all-new or all-due learner; today's 8 blocks, which all play) are listed
 * in `MATH_PICK_SOFT_RULES` in the order they give way (Q2). Giving way
 * means coming as close as the pool allows (2 known when only 2 exist),
 * not dropping the rule; box-2 facts count toward the known floor only
 * once box ≥ 3 cannot meet it.
 *
 * With today's canon every block plays every session and the rules set the
 * order. A bigger pool (plan phase 5a: more blocks in the step's canon
 * file) gets the selection with no change here.
 *
 * The search fills P4, P5, P6, P7, P8 and then the opening's 3, each slot
 * trying the blocks its band allows in rank order and backtracking on a
 * cap, a bond or a rule, so the first session found is the best in rank
 * order. A node budget bounds each search; past it, the search counts as
 * failed.
 *
 * Pure: no I/O, no clock.
 */
import {
  ADD_TO_TEN_POOL,
  ADD_TO_TEN_RULES,
  SUB_TO_TEN_POOL,
  SUB_TO_TEN_RULES,
  mathCompositionViolations,
  parseAddToTenReadLine,
  parseMissingNumberReadLine,
  parseSubToTenReadLine,
  type ComposedMathStep,
} from '../math/compositionRules'
import {
  LEITNER_DUE_PER_SESSION_CAP,
  leitnerOverdueDays,
} from '../progress/leitner'
import { mathSeenKey } from '../progress/seenItems'
import type {
  LeitnerBox,
  LeitnerItem,
  MathFact,
  SeenItems,
} from '../progress/types'
import {
  MISSING_NUMBER_SLOTS,
  bondKey,
  missingNumberFits,
} from '../wire/missingNumbers'
import type { CanonText } from './composeSession'

/** The steps the picker composes. */
export const MATH_PICK_STEPS: readonly ComposedMathStep[] = [
  'add-to-10',
  'sub-to-10',
]

/** What the picker reads: plain data from the learner's progress doc. */
export interface MathPickRequest {
  step: ComposedMathStep
  leitner: LeitnerBox<MathFact>
  /** Her seen-record (`seenItems.ts` `seenItemsOf`). */
  seen: SeenItems
  /** The facts of her previous session of the step, P1–P8, or `null`. */
  previous: readonly MathFact[] | null
  /** Her slow facts (accurate but slow), the one to dose first first. */
  slow: readonly MathFact[]
  /** The facts of the session's warm-up blocks (0–2), in ref order. */
  warmup: readonly MathFact[]
  /** The progress clock's now and local day. */
  nowMs: number
  today: string
  /** The session count at kick time (the review picker's seed). */
  seed: number
}

/**
 * The rules a session keeps whenever a legal one can, in the order they
 * give way when none can keep them all (Dave, Q2: a 3rd new fact does less
 * harm than a 4th weak one):
 * - `new-cap`: at most `MATH_PICK_NEW_CAP` new facts in P4–P8 (§ 2.2.2.ii);
 * - `due-cap`: at most `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's
 *   facts due box-1/2 facts in the 8 (§ 2.2.2.i, Q1);
 * - `known-floor`: at least `MATH_PICK_KNOWN_FLOOR` known facts (§ 2.2.2.iv);
 * - `slow-dose`: a slow fact plays when one has a block (the old directive);
 * - `new-order`: not her previous session's facts in its order (§ 2.1.1).
 */
export const MATH_PICK_SOFT_RULES = [
  'new-cap',
  'due-cap',
  'known-floor',
  'slow-dose',
  'new-order',
] as const
export type MathPickSoftRule = (typeof MATH_PICK_SOFT_RULES)[number]

/** At most 2 new facts in P4–P8 (§ 2.2.2.ii). */
export const MATH_PICK_NEW_CAP = 2
/** At least 3 of the 8 are known facts (§ 2.2.2.iv). */
export const MATH_PICK_KNOWN_FLOOR = 3
/** A known fact is in box 3 or higher (§ 2.2.1, Q2). */
export const MATH_PICK_KNOWN_MIN_BOX = 3
/** The slow facts that lead P4–P8 (the old directive's "1 to 2"). */
export const MATH_PICK_SLOW_DOSE = 2

const PROBLEMS = 8
const OPENING_SLOTS = [1, 2, 3] as const
const TRAP_SLOTS = [4, 5, 6, 7, 8] as const
/** Search nodes per search. */
const SEARCH_BUDGET = 50_000

/**
 * A pick: the step's canon problem numbers for P1–P8, the rules it could
 * not fully keep (in `MATH_PICK_SOFT_RULES` order), and the warm-up refs
 * (0-based, into `request.warmup`) that must not play (dual exposure).
 */
export interface MathPick {
  problems: number[]
  relaxed: MathPickSoftRule[]
  dropWarmup: number[]
}

/** One canon block of the step, as the rules see it. */
interface Block {
  /** Its canon problem number (`math.p<problem>.*`). */
  problem: number
  /** Its place in the pool, for the seed's rotation. */
  index: number
  /** The Leitner fact: a missing number's is given + missing. */
  fact: MathFact
  key: string
  /** The same-bond key: `{3, 4}` for 3+4, 4+3 and 3+?=7; the fact for −. */
  bond: string
  /** The dual-exposure key: 7+3, 3+7, 10−3 and 10−7 share `10:3+7`. */
  family: string
  missing: boolean
  easy: boolean
  /** The category a cap counts (plain problems only). */
  category: string | null
  slots: ReadonlySet<number>
  /** The ramp's order: the answer the child taps. */
  answer: number
  read: string
}

const factKey = (f: MathFact) => `${f.a}${f.op}${f.b}`
const bondOf = (f: MathFact) => (f.op === '+' ? bondKey(f.a, f.b) : factKey(f))
/** A − fact a−b=c and the + facts b+c, c+b share a family (the sum and
 *  its two parts); × facts have none. */
function familyOf(f: MathFact): string | null {
  if (f.op === '+') return `${f.a + f.b}:${bondKey(f.a, f.b)}`
  if (f.op === '-') return `${f.a}:${bondKey(f.b, f.a - f.b)}`
  return null
}

const READ_ID = /^math\.p(\d+)\.read$/

/** The step's blocks the rules can place (an unparseable or off-pool read
 *  line is left out: no session could pass the lint with it). */
function blocksOf(step: ComposedMathStep, canon: CanonText): Block[] {
  const reads = canon.utterances
    .flatMap((u) => {
      const m = READ_ID.exec(u.id)
      return m === null ? [] : [{ problem: Number(m[1]), text: u.text }]
    })
    .sort((x, y) => x.problem - y.problem)
  const out: Omit<Block, 'index'>[] = []
  for (const { problem, text } of reads) {
    const block = blockOf(step, problem, text)
    if (block !== null) out.push(block)
  }
  const indexed = (bs: Omit<Block, 'index'>[]) =>
    bs.map((b, index) => ({ ...b, index }))
  if (step !== 'add-to-10') return indexed(out)
  // A session with missing numbers has one at each missing-number slot
  // (content wave 1 § 1.2), and the planner always wrote them: with enough
  // bond-distinct missing blocks they own those slots; without, none play.
  const missingBonds = new Set(out.filter((b) => b.missing).map((b) => b.bond))
  const useMissing = missingBonds.size >= MISSING_NUMBER_SLOTS.length
  const missingSlots = new Set(MISSING_NUMBER_SLOTS)
  return indexed(
    out
      .filter((b) => useMissing || !b.missing)
      .map((b) =>
        b.missing || !useMissing
          ? b
          : {
              ...b,
              slots: new Set([...b.slots].filter((s) => !missingSlots.has(s))),
            },
      ),
  )
}

function blockOf(
  step: ComposedMathStep,
  problem: number,
  read: string,
): Omit<Block, 'index'> | null {
  const block = (
    fact: MathFact,
    shape: Pick<Block, 'missing' | 'easy' | 'category' | 'slots' | 'answer'>,
  ): Omit<Block, 'index'> => ({
    problem,
    fact,
    key: factKey(fact),
    bond: bondOf(fact),
    family: familyOf(fact)!,
    read,
    ...shape,
  })
  if (step === 'add-to-10') {
    const m = parseMissingNumberReadLine(read)
    if (m !== null) {
      if (!missingNumberFits('add-to-10', m.given, m.missing)) return null
      return block(
        { a: m.given, b: m.missing, op: '+' },
        {
          missing: true,
          easy: false,
          category: null,
          slots: new Set(MISSING_NUMBER_SLOTS),
          answer: m.missing,
        },
      )
    }
    const p = parseAddToTenReadLine(read)
    const pool =
      p === null
        ? undefined
        : ADD_TO_TEN_POOL.find((x) => x.a === p.a && x.b === p.b)
    if (pool === undefined) return null
    return block(
      { a: pool.a, b: pool.b, op: '+' },
      {
        missing: false,
        easy: pool.band === 'EASY',
        category: pool.category,
        slots: new Set(ADD_TO_TEN_RULES.bandAllowedSlots[pool.band]),
        answer: pool.a + pool.b,
      },
    )
  }
  const p = parseSubToTenReadLine(read)
  const pool =
    p === null
      ? undefined
      : SUB_TO_TEN_POOL.find((x) => x.a === p.a && x.b === p.b)
  if (pool === undefined) return null
  return block(
    { a: pool.a, b: pool.b, op: '-' },
    {
      missing: false,
      easy: pool.band === 'EASY',
      category: pool.category,
      slots: new Set(SUB_TO_TEN_RULES.bandAllowedSlots[pool.band]),
      answer: pool.a - pool.b,
    },
  )
}

/** A block with the learner's state. */
interface Ranked extends Block {
  box: number
  /** Days past due (≥ 0 = due); `null` = not in the box (new). */
  overdue: number | null
  isNew: boolean
  /** Box ≥ 3 or slow (Q2). */
  known: boolean
  /** Box ≥ 2 or slow: counts toward the floor once box ≥ 3 cannot. */
  knownish: boolean
  dueLow: boolean
  warm: boolean
  slowRank: number | null
  seenToday: boolean
  /** Her last day with it ('' = no record: the longest ago). */
  seenDay: string
  rot: number
  /** The P4–P8 tier: 0 due box-1/2 under the cap, 1 slow, 2 new under the
   *  cap, 3 due box 3–5, 4 not due, 5 new over the cap, 6 due over the
   *  cap, 7 the warm-up's. */
  tier: number
}

const cmp = (x: number, y: number) => x - y
const cmpStr = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0)

function rank(
  blocks: readonly Block[],
  r: MathPickRequest,
  warmup: readonly MathFact[],
): Ranked[] {
  const entries = new Map<string, LeitnerItem<MathFact>>(
    r.leitner.items.map((e) => [factKey(e.item), e]),
  )
  const warmBonds = new Set(warmup.map(bondOf))
  const slowKeys = new Set(r.slow.map(factKey))
  const n = blocks.length
  const seed = ((Math.trunc(r.seed) % n) + n) % n
  const base = blocks.map((b) => {
    const entry = entries.get(b.key)
    const overdue = entry ? leitnerOverdueDays(entry, r.nowMs) : null
    const box = entry?.box ?? 0
    const seen = r.seen[mathSeenKey(b.fact)]
    const slow = slowKeys.has(b.key)
    return {
      ...b,
      box,
      overdue,
      isNew: entry === undefined,
      known: box >= MATH_PICK_KNOWN_MIN_BOX || slow,
      knownish: box >= 2 || slow,
      dueLow: overdue !== null && overdue >= 0 && box <= 2,
      warm: warmBonds.has(b.bond),
      seenToday: seen?.day === r.today,
      seenDay: seen?.day ?? '',
      rot: (b.index + seed) % n,
    }
  })
  type Base = (typeof base)[number]
  const firstKeys = (
    xs: readonly Base[],
    order: (x: Base, y: Base) => number,
    limit: number,
  ) => {
    const keys = new Set<string>()
    for (const x of [...xs].sort(order)) {
      if (keys.size >= limit) break
      keys.add(x.key)
    }
    return keys
  }
  const dueCapped = firstKeys(
    base.filter((b) => b.dueLow && !b.warm),
    (x, y) =>
      cmp(y.overdue!, x.overdue!) || cmp(x.box, y.box) || cmpStr(x.key, y.key),
    dueCapOf(warmup),
  )
  const slowOrder = r.slow
    .map(factKey)
    .filter((k) => base.some((b) => b.key === k && !b.warm))
    .slice(0, MATH_PICK_SLOW_DOSE)
  const newCapped = firstKeys(
    base.filter((b) => b.isNew && !b.warm),
    (x, y) => cmp(Number(x.easy), Number(y.easy)) || cmp(x.rot, y.rot),
    MATH_PICK_NEW_CAP,
  )
  return base.map((b) => {
    const slowRank = slowOrder.indexOf(b.key)
    const tier = b.warm
      ? 7
      : b.dueLow
        ? dueCapped.has(b.key)
          ? 0
          : 6
        : slowRank >= 0
          ? 1
          : b.isNew
            ? newCapped.has(b.key)
              ? 2
              : 5
            : b.overdue! >= 0
              ? 3
              : 4
    return { ...b, slowRank: slowRank >= 0 ? slowRank : null, tier }
  })
}

/** The due cap left after the warm-up (one shared cap of 3, § 7.4). */
const dueCapOf = (warmup: readonly MathFact[]) =>
  Math.max(0, LEITNER_DUE_PER_SESSION_CAP - warmup.length)

/** P4–P8's order: Dave's tiers; an easy fact that is not a capped due one
 *  only after every other (keep the ramp, § 2.1.3). */
function trapOrder(x: Ranked, y: Ranked): number {
  const late = (b: Ranked) => Number(b.easy && b.tier !== 0)
  const byTier = cmp(late(x), late(y)) || cmp(x.tier, y.tier)
  if (byTier !== 0) return byTier
  switch (x.tier) {
    case 0:
    case 3:
    case 6:
      return (
        cmp(y.overdue!, x.overdue!) || cmp(x.box, y.box) || cmp(x.rot, y.rot)
      )
    case 1:
      return cmp(x.slowRank!, y.slowRank!)
    case 4:
      return (
        cmp(x.box, y.box) ||
        cmp(Number(x.seenToday), Number(y.seenToday)) ||
        cmpStr(x.seenDay, y.seenDay) ||
        cmp(x.rot, y.rot)
      )
    default:
      return cmp(x.rot, y.rot)
  }
}

/** The opening's choice: the capped due facts its band keeps out of P4–P8
 *  first (Q1: Leitner decides what gets in), then known, box 2, new, box 1,
 *  the warm-up's. */
function openingClass(b: Ranked): number {
  if (b.warm) return 5
  if (b.tier === 0) return 0
  if (b.known) return 1
  if (b.box === 2) return 2
  if (b.isNew) return 3
  return 4
}

function openingOrder(x: Ranked, y: Ranked): number {
  return (
    cmp(openingClass(x), openingClass(y)) ||
    cmp(x.slowRank ?? Infinity, y.slowRank ?? Infinity) ||
    cmp(y.box, x.box) ||
    cmp(Number(x.seenToday), Number(y.seenToday)) ||
    cmpStr(x.seenDay, y.seenDay) ||
    cmp(x.rot, y.rot)
  )
}

const ramp = (x: Ranked, y: Ranked) =>
  cmp(x.answer, y.answer) || cmpStr(x.key, y.key)

/** P1–P3 in ramp order, except that a due box-1/2 fact never opens the
 *  session while a box ≥ 2 fact that is not due can (Q1). */
function openingPlayOrder(chosen: readonly Ranked[]): Ranked[] {
  const order = [...chosen].sort(ramp)
  if (!order[0]!.dueLow) return order
  const opener = order.find((b) => !b.dueLow && b.box >= 2)
  return opener === undefined
    ? order
    : [opener, ...order.filter((b) => b !== opener)]
}

/** How far a session is from each soft rule (0 = kept). */
interface Shortfall {
  newExcess: number
  /** Due box-1/2 facts over the cap, and capped ones left out (Q1: what
   *  gets in is Leitner's). Both are the due rule. */
  dueExcess: number
  dueMissing: number
  /** Known facts missing from the floor, then box ≥ 2 ones (Q2 b). */
  known: number
  knownish: number
  slow: number
  sameOrder: number
}

/** The shortfalls, most important first: a search fixes them in this
 *  order, so the earliest-given-up rule (`new-cap`) is the last fixed. */
const SHORTFALL_ORDER: readonly (keyof Shortfall)[] = [
  'sameOrder',
  'slow',
  'known',
  'knownish',
  'dueMissing',
  'dueExcess',
  'newExcess',
]
const SHORTFALL_MAX: Readonly<Record<keyof Shortfall, number>> = {
  sameOrder: 1,
  slow: 1,
  known: MATH_PICK_KNOWN_FLOOR,
  knownish: MATH_PICK_KNOWN_FLOOR,
  dueMissing: LEITNER_DUE_PER_SESSION_CAP,
  dueExcess: PROBLEMS,
  newExcess: TRAP_SLOTS.length,
}
const STRICT: Shortfall = {
  newExcess: 0,
  dueExcess: 0,
  dueMissing: 0,
  known: 0,
  knownish: 0,
  slow: 0,
  sameOrder: 0,
}
const RELAXED_BY: Readonly<Record<keyof Shortfall, MathPickSoftRule>> = {
  newExcess: 'new-cap',
  dueExcess: 'due-cap',
  dueMissing: 'due-cap',
  known: 'known-floor',
  knownish: 'known-floor',
  slow: 'slow-dose',
  sameOrder: 'new-order',
}

class OverBudget extends Error {}

interface Context {
  r: MathPickRequest
  blocks: readonly Ranked[]
  warmup: readonly MathFact[]
}

/** The first legal session in rank order whose shortfalls stay within
 *  `limits`, or `null`. Each slot's choice is pruned as soon as the best
 *  the rest of the session could still do misses a limit. */
function search(ctx: Context, limits: Shortfall): Ranked[] | null {
  const { r, blocks } = ctx
  const config = r.step === 'add-to-10' ? ADD_TO_TEN_RULES : SUB_TO_TEN_RULES
  const caps = config.categoryCaps as Readonly<Record<string, number>>
  const coverage = (b: Ranked) =>
    r.step === 'add-to-10'
      ? b.missing || b.category === 'sums-to-10'
      : b.category === 'take-from-10'
  const coverageMin =
    r.step === 'add-to-10'
      ? ADD_TO_TEN_RULES.sumsToTenInP4ToP8Min
      : SUB_TO_TEN_RULES.takeFromTenInP4ToP8Min
  const dueMax = dueCapOf(ctx.warmup) + limits.dueExcess
  const newMax = MATH_PICK_NEW_CAP + limits.newExcess
  const knownMin = MATH_PICK_KNOWN_FLOOR - limits.known
  const knownishMin = MATH_PICK_KNOWN_FLOOR - limits.knownish
  const slowAvailable = blocks.some((b) => b.tier === 1)
  const needSlow = slowAvailable && limits.slow === 0
  const previous = r.previous?.map(factKey).join(',') ?? null
  // Dual exposure (Q3): a warm-up fact's inverse never plays.
  const warmFamilies = new Set(
    ctx.warmup
      .filter((f) => f.op !== blocks[0]!.fact.op)
      .map(familyOf)
      .filter((k): k is string => k !== null),
  )
  const allowed = blocks.filter((b) => !warmFamilies.has(b.family))
  const cappedKeys = new Set(
    blocks.filter((b) => b.tier === 0).map((b) => b.key),
  )

  const byTrapSlot = TRAP_SLOTS.map((slot) =>
    allowed.filter((b) => b.slots.has(slot)).sort(trapOrder),
  )
  const openers = allowed
    .filter((b) => OPENING_SLOTS.every((s) => b.slots.has(s)))
    .sort(openingOrder)
  const isOpener = new Set(openers)

  const trap: Ranked[] = []
  const opening: Ranked[] = []
  const placed = new Set<Ranked>()
  const bonds = new Set<string>()
  const counts = new Map<string, number>()
  let due = 0
  let nodes = 0

  const fits = (b: Ranked) =>
    !placed.has(b) &&
    !bonds.has(b.bond) &&
    (b.category === null ||
      (counts.get(b.category) ?? 0) < (caps[b.category] ?? Infinity)) &&
    (!b.dueLow || due < dueMax)
  const put = (b: Ranked) => {
    placed.add(b)
    bonds.add(b.bond)
    if (b.category !== null)
      counts.set(b.category, (counts.get(b.category) ?? 0) + 1)
    if (b.dueLow) due += 1
  }
  const take = (b: Ranked) => {
    placed.delete(b)
    bonds.delete(b.bond)
    if (b.category !== null) counts.set(b.category, counts.get(b.category)! - 1)
    if (b.dueLow) due -= 1
  }

  /**
   * Can the session still keep the limits? `trapLeft` = the trap slots
   * still open (P4–P8 order), `openLeft` = the opening's. Optimistic: a
   * block that fits now counts as placeable in any open slot it allows.
   */
  const hopeful = (trapLeft: readonly number[], openLeft: number): boolean => {
    const room = trapLeft.length + openLeft
    const placeable = (b: Ranked) =>
      fits(b) &&
      (trapLeft.some((s) => b.slots.has(s)) ||
        (openLeft > 0 && isOpener.has(b)))
    const session = [...placed]
    const could = (want: (b: Ranked) => boolean) =>
      Math.min(room, allowed.filter((b) => want(b) && placeable(b)).length)
    const has = (want: (b: Ranked) => boolean) => session.filter(want).length
    if (has((b) => b.known) + could((b) => b.known) < knownMin) return false
    if (has((b) => b.knownish) + could((b) => b.knownish) < knownishMin)
      return false
    if (needSlow && has((b) => b.tier === 1) + could((b) => b.tier === 1) === 0)
      return false
    const inKeys = new Set(session.map((b) => b.key))
    const cappedLeft = [...cappedKeys].filter((k) => !inKeys.has(k))
    const cappedPlaceable = new Set(
      allowed
        .filter((b) => cappedKeys.has(b.key) && placeable(b))
        .map((b) => b.key),
    )
    const missing =
      cappedLeft.filter((k) => !cappedPlaceable.has(k)).length +
      Math.max(
        0,
        cappedLeft.filter((k) => cappedPlaceable.has(k)).length - room,
      )
    if (missing > limits.dueMissing) return false
    if (trapLeft.length > 0 || openLeft === OPENING_SLOTS.length) {
      const trapRoom = trapLeft.length
      const cover =
        trap.filter(coverage).length +
        Math.min(
          trapRoom,
          allowed.filter(
            (b) =>
              coverage(b) && fits(b) && trapLeft.some((s) => b.slots.has(s)),
          ).length,
        )
      if (cover < coverageMin) return false
    }
    return true
  }

  const leaf = (): Ranked[] | null => {
    const session = [...openingPlayOrder(opening), ...trap]
    const s = shortfallOf(
      session,
      slowAvailable,
      previous,
      ctx.warmup,
      cappedKeys,
    )
    if (SHORTFALL_ORDER.some((k) => s[k] > limits[k])) return null
    const lines = {
      utterances: session.map((b, i) => ({
        id: `math.p${i + 1}.read`,
        text: b.read,
      })),
    }
    return mathCompositionViolations(r.step, lines).length === 0
      ? session
      : null
  }

  const fillOpening = (from: number): Ranked[] | null => {
    if (opening.length === OPENING_SLOTS.length) return leaf()
    for (let j = from; j < openers.length; j++) {
      if (++nodes > SEARCH_BUDGET) throw new OverBudget()
      const b = openers[j]!
      if (!fits(b)) continue
      put(b)
      opening.push(b)
      if (hopeful([], OPENING_SLOTS.length - opening.length)) {
        const found = fillOpening(j + 1)
        if (found !== null) return found
      }
      opening.pop()
      take(b)
    }
    return null
  }

  const fillTrap = (i: number): Ranked[] | null => {
    if (i === TRAP_SLOTS.length) {
      if (trap.filter(coverage).length < coverageMin) return null
      return fillOpening(0)
    }
    const fresh = trap.filter((b) => b.isNew).length
    const rest = TRAP_SLOTS.slice(i + 1)
    for (const b of byTrapSlot[i]!) {
      if (++nodes > SEARCH_BUDGET) throw new OverBudget()
      if (!fits(b)) continue
      if (b.isNew && fresh >= newMax) continue
      put(b)
      trap.push(b)
      if (hopeful(rest, OPENING_SLOTS.length)) {
        const found = fillTrap(i + 1)
        if (found !== null) return found
      }
      trap.pop()
      take(b)
    }
    return null
  }

  try {
    return hopeful(TRAP_SLOTS, OPENING_SLOTS.length) ? fillTrap(0) : null
  } catch (err) {
    if (err instanceof OverBudget) return null
    throw err
  }
}

function shortfallOf(
  session: readonly Ranked[],
  slowAvailable: boolean,
  previous: string | null,
  warmup: readonly MathFact[],
  cappedKeys: ReadonlySet<string>,
): Shortfall {
  const trap = session.slice(OPENING_SLOTS.length)
  const keys = new Set(session.map((b) => b.key))
  return {
    newExcess: Math.max(
      0,
      trap.filter((b) => b.isNew).length - MATH_PICK_NEW_CAP,
    ),
    dueExcess: Math.max(
      0,
      session.filter((b) => b.dueLow).length - dueCapOf(warmup),
    ),
    dueMissing: [...cappedKeys].filter((k) => !keys.has(k)).length,
    known: Math.max(
      0,
      MATH_PICK_KNOWN_FLOOR - session.filter((b) => b.known).length,
    ),
    knownish: Math.max(
      0,
      MATH_PICK_KNOWN_FLOOR - session.filter((b) => b.knownish).length,
    ),
    slow: slowAvailable && !session.some((b) => b.tier === 1) ? 1 : 0,
    sameOrder:
      previous !== null && session.map((b) => b.key).join(',') === previous
        ? 1
        : 0,
  }
}

/**
 * The best session for `ctx`: each shortfall, most important first, as
 * small as the pool allows with the ones before it fixed (Q2 a); `null`
 * when no legal session exists at all.
 */
function best(ctx: Context): { session: Ranked[]; limits: Shortfall } | null {
  const strict = search(ctx, STRICT)
  if (strict !== null) return { session: strict, limits: STRICT }
  const limits: Shortfall = { ...SHORTFALL_MAX }
  if (search(ctx, limits) === null) return null
  for (const k of SHORTFALL_ORDER) {
    for (let v = 0; v < SHORTFALL_MAX[k]; v++) {
      if (search(ctx, { ...limits, [k]: v }) !== null) {
        limits[k] = v
        break
      }
    }
  }
  const session = search(ctx, limits)
  return session === null ? null : { session, limits }
}

/**
 * The 8 problems of `request.step`'s session from `canon` (the step's canon
 * file: its `math.p<N>.read` lines are the pool), P1–P8; the rules it could
 * not fully keep; and the warm-up refs that must not play. Throws when no
 * legal session exists (fewer than 8 usable blocks, or none passes the
 * composition rules): the caller asks the server.
 */
export function pickMathProblems(
  request: MathPickRequest,
  canon: CanonText,
): MathPick {
  const blocks = blocksOf(request.step, canon)
  if (blocks.length < PROBLEMS) {
    throw new Error(
      `${request.step}: ${blocks.length} usable canon blocks, a session needs ${PROBLEMS}`,
    )
  }
  const pick = (dropWarmup: number[]): MathPick | null => {
    const warmup = request.warmup.filter((_, i) => !dropWarmup.includes(i))
    const found = best({
      r: request,
      blocks: rank(blocks, request, warmup),
      warmup,
    })
    if (found === null) return null
    const relaxed = MATH_PICK_SOFT_RULES.filter((rule) =>
      SHORTFALL_ORDER.some(
        (k) => RELAXED_BY[k] === rule && found.limits[k] > 0,
      ),
    )
    return {
      problems: found.session.map((b) => b.problem),
      relaxed,
      dropWarmup,
    }
  }
  // Dual exposure: when no legal 8 avoids every warm-up fact's inverse,
  // the warm-up facts whose inverse is in the step's pool give way.
  const op = blocks[0]!.fact.op
  const families = new Set(blocks.map((b) => b.family))
  const crossing = request.warmup.flatMap((f, i) => {
    const family = familyOf(f)
    return f.op !== op && family !== null && families.has(family) ? [i] : []
  })
  const picked = pick([]) ?? (crossing.length > 0 ? pick(crossing) : null)
  if (picked === null) {
    throw new Error(`${request.step}: no session passes the composition rules`)
  }
  return picked
}
