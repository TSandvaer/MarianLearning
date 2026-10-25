/**
 * The order a word step's served 8 play in (Dave 2026-10-25, 5b ruling
 * (6e) and "SHUFFLE NOW"; Thomas, build 22: "every cat word session starts
 * with 'read the hat'"). Every forward session of a canon step played the
 * same 8 words in the same order; the device now plays them in a new order
 * each session.
 *
 * Each slot keeps its band:
 * - CVC steps (blending sounds to short e): P1-P3 a continuant onset
 *   (f v s m n l r h w y, the server's `reorderContinuantOnsetFirst`,
 *   `api/_planner.ts`), P4-P8 any word: the stops and the continuant P1-P3
 *   leaves out.
 * - Digraphs: a hybrid (`hybridMode`) or an sh-final word P4-P8 only.
 * - Letter names: the canon's gentle P1-P3, middle P4-P5 and trap P6-P8
 *   letters each stay in their slots (`LETTER_NAMES_RULES`,
 *   `scripts/compositionLint.ts`: CLEAN letters only in P1-P3, a b/d/p/q
 *   in P6-P8).
 * - Sight words: P1-P3 a safe opener (the, a, go, see, can: the planner's
 *   sight-words directive (7), `api/_planner.ts`).
 * - Sentences: the canon's gentle P1-P3 and trap P4-P8 stay in their bands
 *   (the planner's simple-sentences directive (8)).
 * - Big words: any slot. Every row carries both chip pairs
 *   (`bigWordsSteps.ts`).
 *
 * Within the bands: P1 is never the last session's P1, the order never
 * repeats, as few words as the bands allow keep their slot (none for
 * today's served 8), and a word served twice (ship, chin, thin) is never in
 * adjacent slots. The session-count seed picks one of the orders left. A
 * step's first session plays the canon order when it meets the bands:
 * sounding-out opens on two words she met in blending sounds (Dave (6d),
 * `design/native/real-blending.md` § 6).
 *
 * Chips follow the slot: the parser numbers problems by position (gentle
 * P1-P3, trap P4-P8). A check swaps problems 2, 5 and 7 afterwards
 * (`withGraduationProbes`), so its probes stay there and never at P1.
 *
 * Not here: a review, a peek and a replay (none writes history), letter
 * sounds (its own composer, `letterSoundsSession.ts`) and the little
 * stories.
 *
 * Pure: no I/O, no clock.
 */
import type { Progress, SkillNode } from '../progress/types'
import { BIG_WORDS_STEP_IDS } from './bigWordsSteps'
import {
  isServerPlan,
  wordSongSessionPlanFromServer,
  type ServerPlan,
} from './planFromServer'
import type { WordEntry } from './wordPack'

const CVC_STEPS: ReadonlySet<SkillNode> = new Set<SkillNode>([
  'blending-cv',
  'sounding-out',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
])

const DIGRAPH_STEPS: ReadonlySet<SkillNode> = new Set<SkillNode>([
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
])

/** The steps whose forward session the device orders. */
export const WORD_ORDER_STEPS: ReadonlySet<SkillNode> = new Set<SkillNode>([
  ...CVC_STEPS,
  ...DIGRAPH_STEPS,
  'letter-names',
  'sight-words',
  'simple-sentences',
  ...BIG_WORDS_STEP_IDS,
])

/** `api/_planner.ts` `CONTINUANT_ONSET_GRAPHEMES` (`api/` imports nothing
 *  from core, nor core from it). */
const CONTINUANT_ONSETS: ReadonlySet<string> = new Set([
  'f',
  'v',
  's',
  'm',
  'n',
  'l',
  'r',
  'h',
  'w',
  'y',
])

/** The planner's safe sight-word openers for P1-P3. */
const SIGHT_WORD_OPENERS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'go',
  'see',
  'can',
])

const ANY = [1, 2, 3, 4, 5, 6, 7, 8]
const GENTLE = [1, 2, 3]
const TRAP = [4, 5, 6, 7, 8]
const LETTER_MIDDLE = [4, 5]
const LETTER_TRAP = [6, 7, 8]

/**
 * The slots (1-based) `entry`, the canon's problem `served`, may play at in
 * a `step` session (the bands in the header).
 */
export function wordSlots(
  step: SkillNode,
  entry: Pick<WordEntry, 'word' | 'hybridMode'>,
  served: number,
): readonly number[] {
  const word = entry.word
  if (CVC_STEPS.has(step)) {
    return CONTINUANT_ONSETS.has(word[0] ?? '') && entry.hybridMode !== true
      ? ANY
      : TRAP
  }
  if (DIGRAPH_STEPS.has(step)) {
    const shFinal = step === 'digraphs-sh' && !word.startsWith('sh')
    return entry.hybridMode === true || shFinal ? TRAP : ANY
  }
  if (step === 'letter-names') {
    return served <= 3 ? GENTLE : served <= 5 ? LETTER_MIDDLE : LETTER_TRAP
  }
  if (step === 'sight-words') {
    return SIGHT_WORD_OPENERS.has(word) ? ANY : TRAP
  }
  if (step === 'simple-sentences') return served <= 3 ? GENTLE : TRAP
  return ANY
}

/**
 * The learner's last session of `step`, as its order is known: the 8 words
 * it stored, in order; `'canon'` for an entry from before the order was
 * stored (every such session played the canon order); `null` when no
 * history entry is for `step` (her first session of it, or one trimmed
 * away).
 */
export type LastWordOrder = readonly string[] | 'canon' | null

/** What a session start passes to {@link orderWordSession}. */
export interface WordOrderHint {
  /** The session count at kick time (the Hub prefetch and the tap agree). */
  seed: number
  last: LastWordOrder
}

/** The last session of `step` in `progress`'s history (latest `dateISO`). */
export function lastWordOrder(
  progress: Pick<Progress, 'history'>,
  step: SkillNode,
): LastWordOrder {
  let latest: Progress['history'][number] | undefined
  for (const entry of progress.history) {
    if (!entry.skillFocus.includes(step)) continue
    if (latest === undefined || entry.dateISO >= latest.dateISO) latest = entry
  }
  if (latest === undefined) return null
  const stored = latest.targetWords
  return stored !== undefined && stored.length > 0 ? stored : 'canon'
}

/** A 32-bit integer mix (murmur3's finaliser), so consecutive seeds pick
 *  orders far apart. */
function mix(seed: number): number {
  let h = (seed + 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * The order of a `step` session: `order[slot]` is the canon problem
 * (0-based) that plays at `slot`. `entries` are the canon's targets in
 * order, `last` the last session's words in order (`null`: her first
 * session of the step). `null` when no order meets the rules; the caller
 * then plays the canon order.
 */
export function pickWordOrder(
  step: SkillNode,
  entries: readonly Pick<WordEntry, 'word' | 'hybridMode'>[],
  last: readonly string[] | null,
  seed: number,
): number[] | null {
  const n = entries.length
  if (n === 0 || n > 30) return null
  const words = entries.map((e) => e.word)
  const allowed = entries.map((e, i) => new Set(wordSlots(step, e, i + 1)))
  const adjacentTwin = (order: readonly number[], slot: number) =>
    slot > 0 && words[order[slot - 1]!] === words[order[slot]!]

  if (last === null) {
    const canon = words.map((_, i) => i)
    const fits = canon.every(
      (c, slot) => allowed[c]!.has(slot + 1) && !adjacentTwin(canon, slot),
    )
    if (fits) return canon
  }

  // A word served twice is placed in served order, so each order of words
  // is counted once.
  const twinBefore = words.map((w, i) =>
    i === 0 ? -1 : words.lastIndexOf(w, i - 1),
  )
  const order: number[] = new Array<number>(n)
  const kept = (slot: number, c: number) =>
    last !== null && last[slot] === words[c] ? 1 : 0
  const sameAsLast = () =>
    last !== null &&
    last.length === n &&
    order.every((c, slot) => words[c] === last[slot])

  /** Visit every order keeping at most `maxKept` words in their slot. */
  const walk = (
    slot: number,
    used: number,
    keptSoFar: number,
    maxKept: number,
    leaf: () => boolean,
  ): boolean => {
    if (slot === n) return sameAsLast() ? false : leaf()
    for (let c = 0; c < n; c++) {
      if ((used & (1 << c)) !== 0) continue
      const twin = twinBefore[c]!
      if (twin >= 0 && (used & (1 << twin)) === 0) continue
      if (!allowed[c]!.has(slot + 1)) continue
      if (slot > 0 && words[order[slot - 1]!] === words[c]) continue
      if (slot === 0 && last !== null && last[0] === words[c]) continue
      const k = keptSoFar + kept(slot, c)
      if (k > maxKept) continue
      order[slot] = c
      if (walk(slot + 1, used | (1 << c), k, maxKept, leaf)) return true
    }
    return false
  }

  for (let maxKept = 0; maxKept <= n; maxKept++) {
    let count = 0
    walk(0, 0, 0, maxKept, () => {
      count += 1
      return false
    })
    if (count === 0) continue
    let pick = mix(seed) % count
    let chosen: number[] | null = null
    walk(0, 0, 0, maxKept, () => {
      if (pick-- > 0) return false
      chosen = order.slice()
      return true
    })
    return chosen
  }
  return null
}

const PROBLEM_LINE = /^word\.p(\d+)\.(.+)$/

/**
 * `plan` with its problems in `order` (`order[slot]` = the canon problem,
 * 0-based, at `slot`): each problem's `word.p<N>.*` lines renamed to their
 * new slot, in slot order, then every other line as it was.
 */
export function withWordOrder(
  plan: ServerPlan,
  order: readonly number[],
): ServerPlan {
  const byProblem = new Map<number, { slot: string; text: string }[]>()
  const rest: { id: string; text: string }[] = []
  for (const u of plan.utterances) {
    const m = PROBLEM_LINE.exec(u.id)
    const problem = m === null ? null : Number(m[1])
    if (m === null || problem === null || problem > order.length) {
      rest.push(u)
      continue
    }
    const lines = byProblem.get(problem) ?? []
    lines.push({ slot: m[2]!, text: u.text })
    byProblem.set(problem, lines)
  }
  const ordered = order.flatMap((served, i) =>
    (byProblem.get(served + 1) ?? []).map((l) => ({
      id: `word.p${i + 1}.${l.slot}`,
      text: l.text,
    })),
  )
  return { id: plan.id, label: plan.label, utterances: [...ordered, ...rest] }
}

/**
 * A forward `step` session's plan in this session's order
 * ({@link pickWordOrder}). The plan itself when that order is the canon's,
 * for a step not ordered here, a plan the parser cannot read, or no order
 * that meets the rules.
 */
export function orderWordSession(
  plan: unknown,
  step: SkillNode,
  hint: WordOrderHint,
): unknown {
  if (!WORD_ORDER_STEPS.has(step) || !isServerPlan(plan)) return plan
  let entries: WordEntry[]
  try {
    entries = wordSongSessionPlanFromServer(plan, {
      littleStories: true,
      blendReads: true,
      step,
    }).problems.map((p) => p.target)
  } catch {
    return plan
  }
  const last = hint.last === 'canon' ? entries.map((e) => e.word) : hint.last
  const order = pickWordOrder(step, entries, last, hint.seed)
  if (order === null || order.every((c, slot) => c === slot)) return plan
  return withWordOrder(plan, order)
}
