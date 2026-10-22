/**
 * The extended Math plan model: Number Garden step 1 (`number-recog`) and
 * steps 8–11 (`skip-counting`, `mult-2-5-10`, `mult-3-4`, `mult-6-9`) on top
 * of the arithmetic (`+` / `−`) problems of {@link MathProblem}.
 *
 * Opt-in, native only
 * -------------------
 * The web app is frozen and reads plans through the same core parser. It
 * calls `mathSessionPlanFromServer(plan)` with no options and keeps getting a
 * plain {@link MathSessionPlan}: a number-recognition, skip-count or
 * multiplication read line still throws there, so those five steps keep
 * their silent static fallback on the web, exactly as before this model
 * existed. Only a caller that passes
 * `{ extendedKinds: true }` (the React Native app) gets an
 * {@link ExtendedMathSessionPlan}, whose problems are a discriminated union
 * on `kind`.
 *
 * Read-line shapes (the committed canon, `public/canon/math/level-1/*.json`,
 * and the planner's generic-tier hint templates in `api/_planner.ts`):
 *
 *  - recognize: `"Tap the seven."` — a number word in 1..10; the answer is
 *    that number.
 *  - skip-count: `"Two, four, six, eight. What is next?"` (or "What's
 *    next?") — three or more number words with one common positive step; the
 *    answer is the next term.
 *  - multiply: `"Two times three. How many?"` — the answer is the product.
 *    Operand order is meaningful: the canon and the planner read it as
 *    `factorB` copies of `factorA` ("Two times three" → hint "Two, then two,
 *    then two."), with no commutative flip.
 *  - missing-addend: `"Seven and what make ten?"` — the answer is the
 *    missing part (content wave 1 § 1.6). Lives inside add-to-10 and
 *    add-to-20 (P4, P6, P8), so the web's silent fallback now covers those
 *    two steps too (§ 1.9).
 *  - divide: `"Twelve flowers, three plates. How many on each plate?"` —
 *    the answer is the share, total / plates (content wave 2 § 2.6). Only
 *    in the sharing step (`div-share`); there is no division sign on
 *    screen and no Leitner fact.
 *  - place-value: `"Two hundreds, three tens and four ones. What number is
 *    it?"` — the answer is the number the three places build (content wave
 *    3 § 3.6). In hundreds (`hundreds`) and zeros (`hundreds-zeros`, content
 *    wave 5 § 2.6: "no tens", "One hundred"), whose name read `"Find one
 *    hundred and ninety."` is a place-value problem too (`form: 'name'`).
 *  - more: `"Two hundred and forty-three. What is ten more?"` — the answer
 *    is the number plus ten or one hundred (§ 3.6). In hundreds, more and
 *    less and zeros. Neither hundreds kind has a Leitner fact or an
 *    equation on screen.
 *
 *  Adding big numbers (`add-two-digit`, content wave 5 § 3.6) reads as
 *  plain addition (`kind: 'arithmetic'`); its step draws the place-value
 *  trays ({@link PLACE_VALUE_ARITHMETIC_NODES}).
 *
 * Answer chips
 * ------------
 * `extendedDistractors.ts` picks the two wrong chips for these kinds (native
 * spec `design/native/math-skip-counting-multiplication-native.md` § 4 and
 * § 10); `pickDistractors` stays arithmetic-only.
 *
 * Pure types plus type guards: no I/O, no React.
 */

import type { MathFact, SkillNode } from '../progress/types'
import { GENTLE_RAMP_THROUGH } from './distractors'
import type { MathProblem, MathProblemUtterances } from './sessionPlans'

/**
 * The largest answer (and chip) an extended problem may have: 999, the
 * hundreds step's (`design/native/content-wave-3.md` § 2, G4). The progress
 * guard reads any whole number from 0 up since G, which is on both devices
 * before any build with hundreds (T5); a build before G accepted 0..99 only.
 */
export const EXTENDED_ANSWER_MAX = 999

/**
 * The two-digit kinds' cap (G4): skip counting and multiplication keep
 * their answers and chips in 1..99, as before G (their track and groups are
 * drawn for two digits), so a read above it still goes to the static
 * fallback and their chips do not change.
 */
export const TWO_DIGIT_CHIP_MAX = 99

/** The problem kinds of an {@link ExtendedMathSessionPlan}. */
export type ExtendedMathProblemKind =
  | 'arithmetic'
  | 'recognize'
  | 'skip-count'
  | 'multiply'
  | 'missing-addend'
  | 'divide'
  | 'place-value'
  | 'more'

/** An addition or subtraction problem in an extended plan: a
 *  {@link MathProblem}, tagged so the union can discriminate. Assignable to
 *  `MathProblem`, so arithmetic code paths keep taking it unchanged. */
export interface ArithmeticProblem extends MathProblem {
  kind: 'arithmetic'
}

/** A number-recognition problem: Emma names a number, the child taps it.
 *  e.g. "Tap the seven." → correct 7. */
export interface NumberRecogProblem {
  kind: 'recognize'
  /** 1-based position in the session (1..8). */
  index: number
  /** The number Emma names (1..10). */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** A skip-count problem: Emma reads a sequence, the child picks the next term.
 *  e.g. "Two, four, six, eight. What is next?" → sequence [2, 4, 6, 8],
 *  step 2, correct 10. */
export interface SkipCountProblem {
  kind: 'skip-count'
  /** 1-based position in the session (1..8). */
  index: number
  /** The terms read aloud, in order (at least three). */
  sequence: readonly number[]
  /** The common difference between consecutive terms (always > 0). */
  step: number
  /** The expected next term: the last term plus `step`. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** A multiplication problem. e.g. "Two times three. How many?" →
 *  factorA 2, factorB 3, correct 6. */
export interface MultiplyProblem {
  kind: 'multiply'
  /** 1-based position in the session (1..8). */
  index: number
  /** The first number read: the size of each group (the repeated quantity). */
  factorA: number
  /** The second number read: how many groups (copies of `factorA`). */
  factorB: number
  /** The product, `factorA * factorB`. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** The largest whole a missing-addend read may name (content wave 1
 *  § 1.6: 1 ≤ A < T ≤ 20, the add-to-20 range). */
export const MISSING_ADDEND_TOTAL_MAX = 20

/**
 * A missing-addend problem (content wave 1 § 1, NG-A): Emma names one part
 * and the whole, the child taps the other part. e.g. "Seven and what make
 * ten?" → addendA 7, total 10, correct 3; the screen shows `7 + ? = 10`.
 * It practises the same bond as `7 + 3`, so it records the same Leitner
 * fact, `{ a: addendA, b: correct, op: '+' }` (K4).
 */
export interface MissingAddendProblem {
  kind: 'missing-addend'
  /** 1-based position in the session (1..8). */
  index: number
  /** The given part (1..19). */
  addendA: number
  /** The whole (2..{@link MISSING_ADDEND_TOTAL_MAX}). */
  total: number
  /** The missing part, `total − addendA` (≥ 1). */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** Sharing's ranges (content wave 2 § 2.6, K4, D2): 2–5 plates (one plate
 *  row), a share of 2–6 (the round plate has a die face for each; Kyle's
 *  plate call on #587), at most 20 flowers (two pile rows of 10). */
export const DIVIDE_PLATES_MIN = 2
export const DIVIDE_PLATES_MAX = 5
export const DIVIDE_SHARE_MIN = 2
export const DIVIDE_SHARE_MAX = 6
export const DIVIDE_TOTAL_MAX = 20

/**
 * A sharing problem (content wave 2 § 2, NG-C): a pile of `total` flowers
 * is dealt one for each plate in turn onto `plates` plates; the child taps
 * how many land on each. e.g. "Twelve flowers, three plates. How many on
 * each plate?" → total 12, plates 3, correct 4. It records no Leitner
 * fact (K6): its time includes the deal, so it would mark × facts slow.
 */
export interface DivideProblem {
  kind: 'divide'
  /** 1-based position in the session (1..8). */
  index: number
  /** Flowers in the pile ({@link DIVIDE_PLATES_MIN} × {@link DIVIDE_SHARE_MIN}
   *  .. {@link DIVIDE_TOTAL_MAX}). */
  total: number
  /** How many plates ({@link DIVIDE_PLATES_MIN}..{@link DIVIDE_PLATES_MAX}). */
  plates: number
  /** The share, `total / plates` (a whole number). */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** Hundreds' digits (content wave 3 § 3.6, D8): every place 2..9, so no
 *  zero and no "one hundred" in hundreds' canon (its lint). Zeros, the
 *  deepening (content wave 5 § 2.6), reads a place as "no" (0) and the
 *  hundreds as "One hundred": the parser takes hundreds 1..9 and tens and
 *  ones 0..9. */
export const PLACE_DIGIT_MIN = 2
export const PLACE_DIGIT_MAX = 9

/** A place of a three-digit number, largest first. */
export type PlacePart = 'hundreds' | 'tens' | 'ones'

/** The places in place order (hundreds, tens, ones). */
export const PLACE_PARTS: readonly PlacePart[] = ['hundreds', 'tens', 'ones']

/**
 * A place-value problem (content wave 3 § 3, NG-D): Emma builds a number
 * from hundred-flats, ten-rods and one-cubes as she names each place; the
 * child taps the number. e.g. "Two hundreds, three tens and four ones. What
 * number is it?" → hundreds 2, tens 3, ones 4, correct 234. Hundreds' P5
 * names the places out of order ("Three hundreds, six ones and two
 * tens."): an expanded form (2.NBT.A.3) that can't be solved by copying the
 * digits in the order heard. Zeros (content wave 5 § 2.6) names an empty
 * place "no tens", and its name read "Find one hundred and ninety." asks
 * for the number by name (`form: 'name'`).
 */
export interface PlaceValueProblem {
  kind: 'place-value'
  /** 1-based position in the session (1..8). */
  index: number
  /** The hundreds digit, 1..9 (hundreds keeps 2..9 by its lint). */
  hundreds: number
  /** The tens and ones digits, 0..9 (0: "no tens"). */
  tens: number
  ones: number
  /** The places in the order the read names them, e.g. `['hundreds',
   *  'ones', 'tens']`; the name form's are {@link PLACE_PARTS}. */
  spokenOrder: readonly PlacePart[]
  /** `'places'`: the read names the places ("Three hundreds, no tens and
   *  five ones."); `'name'`: "Find <number>." (content wave 5 § 2.6). */
  form: PlaceValueForm
  /** `100 × hundreds + 10 × tens + ones`. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** How a place-value read gives its number (content wave 5 § 2.6). */
export type PlaceValueForm = 'places' | 'name'

/** The places a place-value problem leaves empty (zeros' "no tens"), in
 *  place order; `[]` for hundreds' own problems. */
export function zeroPlaces(
  problem: Pick<PlaceValueProblem, PlacePart>,
): PlacePart[] {
  return PLACE_PARTS.filter((p) => problem[p] === 0)
}

/**
 * A "more" or "less" problem: Emma names a number shown in blocks and asks
 * for some tens or hundreds more or less. Hundreds (content wave 3 § 3,
 * D10) asks ten or one hundred more: "Two hundred and forty-three. What is
 * ten more?" → start 243, step 10, count 1, 'more', correct 253. More and
 * less (content wave 4 § 2.6) asks 2–4 of them, added or taken away: "Six
 * hundred and fifty-three. What is two hundred less?" → start 653, step
 * 100, count 2, 'less', correct 453. No regrouping. Zeros (content wave 5
 * § 2.6) lets a zero sit in `start` or `correct`, and the changed digit
 * become 0 ("Four hundred and sixteen. What is ten less?" → 406); hundreds'
 * and more and less's canon keep no zero by their lints.
 */
export interface MoreProblem {
  kind: 'more'
  /** 1-based position in the session (1..8). */
  index: number
  /** The number read, 100..999. */
  start: number
  /** The place that changes: the tens or the hundreds. */
  step: 10 | 100
  /** How many tens or hundreds change; hundreds' problems are 1. */
  count: MoreCount
  /** Added or taken away; hundreds' problems are 'more'. */
  direction: MoreDirection
  /** `start ± count × step`, in 100..{@link EXTENDED_ANSWER_MAX}. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** How many tens or hundreds a "more" problem changes (content wave 4
 *  § 2.6: 1 in hundreds, 2–4 in more and less). */
export type MoreCount = 1 | 2 | 3 | 4

/** A "more" problem adds or takes away. */
export type MoreDirection = 'more' | 'less'

/** One problem in an extended plan. Switch on `kind`. */
export type ExtendedMathProblem =
  | ArithmeticProblem
  | NumberRecogProblem
  | SkipCountProblem
  | MultiplyProblem
  | MissingAddendProblem
  | DivideProblem
  | PlaceValueProblem
  | MoreProblem

/** A Math session plan with the extended problem kinds: exactly 8 problems. */
export interface ExtendedMathSessionPlan {
  /** Stable id for the plan (used by the audio cache and the audit trail). */
  id: string
  /** Human-readable label for QA / debug overlay. */
  label: string
  /** Exactly 8 problems. */
  problems: readonly ExtendedMathProblem[]
}

export function isArithmeticProblem(
  problem: ExtendedMathProblem,
): problem is ArithmeticProblem {
  return problem.kind === 'arithmetic'
}

export function isNumberRecogProblem(
  problem: ExtendedMathProblem,
): problem is NumberRecogProblem {
  return problem.kind === 'recognize'
}

export function isSkipCountProblem(
  problem: ExtendedMathProblem,
): problem is SkipCountProblem {
  return problem.kind === 'skip-count'
}

/** Also takes a plain (kind-less) `MathProblem`, which is never one. */
export function isMissingAddendProblem(
  problem: MathProblem | ExtendedMathProblem,
): problem is MissingAddendProblem {
  return 'kind' in problem && problem.kind === 'missing-addend'
}

/** A missing number whose whole is ten: the flower bed's problem
 *  (`design/native/flower-bed-into-add-to-10.md` § 1). Only adding to ten's
 *  missing numbers have one; adding to twenty's wholes are 11–14. */
export function isBondToTenProblem(
  problem: MathProblem | ExtendedMathProblem,
): problem is MissingAddendProblem {
  return isMissingAddendProblem(problem) && problem.total === 10
}

export function isMultiplyProblem(
  problem: ExtendedMathProblem,
): problem is MultiplyProblem {
  return problem.kind === 'multiply'
}

export function isDivideProblem(
  problem: ExtendedMathProblem,
): problem is DivideProblem {
  return problem.kind === 'divide'
}

export function isPlaceValueProblem(
  problem: ExtendedMathProblem,
): problem is PlaceValueProblem {
  return problem.kind === 'place-value'
}

export function isMoreProblem(
  problem: ExtendedMathProblem,
): problem is MoreProblem {
  return problem.kind === 'more'
}

/** A hundreds problem: a place-value read or a ten / one hundred more. */
export type HundredsProblem = PlaceValueProblem | MoreProblem

/** A "more" problem's change, signed: +200, +30, −200, −30. */
export function moreChange(
  problem: Pick<MoreProblem, 'step' | 'count' | 'direction'>,
): number {
  const size = problem.count * problem.step
  return problem.direction === 'less' ? -size : size
}

/** More and less's problem (content wave 4 § 2): anything but hundreds'
 *  own ten / one hundred more (count 1, 'more'), which keeps its look and
 *  its chips. */
export function isMoreAndLess(
  problem: Pick<MoreProblem, 'count' | 'direction'>,
): boolean {
  return !(problem.count === 1 && problem.direction === 'more')
}

/** The problem where more and less first takes away, and so moves its
 *  blocks on the read once more (content wave 4 § 2.4, D2). */
export const MORE_AND_LESS_FIRST_LESS_INDEX = 6

/**
 * Whether a more-and-less problem's change blocks move on the read (on its
 * "more" / "less"), else at hint 2 (content wave 4 § 2.4, D1, D2): P1–P3
 * (the concrete model) and P6, the first taking away. On those the changed
 * tray's tag is "?" from the first frame. Like sharing's deal, the rule is
 * the problem's position, so a review block at P2 moves too. Hundreds'
 * own problems never move on the read (content wave 3, D11).
 */
export function moreBlocksMoveOnRead(problem: MoreProblem): boolean {
  if (!isMoreAndLess(problem)) return false
  return (
    problem.index <= GENTLE_RAMP_THROUGH ||
    (problem.direction === 'less' &&
      problem.index === MORE_AND_LESS_FIRST_LESS_INDEX)
  )
}

/**
 * The steps whose arithmetic problems draw the place-value trays (content
 * wave 5 § 3.6, K2): two trays, tens and ones, under today's equation, and
 * the place-value frame and chips. A problem's step is its `problemNodes`
 * entry, else the focus node. A later `sub-two-digit` joins the list.
 */
export const PLACE_VALUE_ARITHMETIC_NODES: readonly SkillNode[] = [
  'add-two-digit',
]

/** Whether `problem` draws the place-value trays: an arithmetic problem of
 *  a {@link PLACE_VALUE_ARITHMETIC_NODES} step. (Not a type guard: `false`
 *  says nothing of the kind, since it also depends on `node`.) */
export function isPlaceValueArithmetic(
  problem: MathProblem | ExtendedMathProblem,
  node: SkillNode | null | undefined,
): boolean {
  return (
    (!('kind' in problem) || problem.kind === 'arithmetic') &&
    node !== null &&
    node !== undefined &&
    PLACE_VALUE_ARITHMETIC_NODES.includes(node)
  )
}

/** What an adding-big-numbers problem moves on the read (content wave 5
 *  § 3.4, § 3.6, D6). */
export type AddTwoDigitReadMotion = 'drop-and-bundle' | 'drop' | 'none'

/** The problems that drop the second number on the read and keep the
 *  bundle for hint 2 (D6: backward fading, the bundle first). */
const ADD_TWO_DIGIT_DROP_THROUGH = 5

/**
 * What moves on an adding-big-numbers read, by the problem's position (as
 * {@link moreBlocksMoveOnRead}, so a review block keeps its slot's rule;
 * content wave 5 § 3.6, D6): P1–P3 drop the second number's blocks and
 * bundle a new ten (P3 is the session's one worked example; P1–P2 make
 * none), P4–P5 drop them and keep the bundle for hint 2, P6–P8 move
 * nothing.
 */
export function addTwoDigitReadMotion(index: number): AddTwoDigitReadMotion {
  if (index <= GENTLE_RAMP_THROUGH) return 'drop-and-bundle'
  if (index <= ADD_TWO_DIGIT_DROP_THROUGH) return 'drop'
  return 'none'
}

export function isHundredsProblem(
  problem: ExtendedMathProblem,
): problem is HundredsProblem {
  return problem.kind === 'place-value' || problem.kind === 'more'
}

/** The three digits of a number in 0..999, place order. */
export function placeDigits(n: number): Record<PlacePart, number> {
  return {
    hundreds: Math.floor(n / 100) % 10,
    tens: Math.floor(n / 10) % 10,
    ones: n % 10,
  }
}

/**
 * The Leitner fact a problem practises, or `null` for one that is not an
 * a/b fact (number recognition, skip counting, sharing, hundreds). Arithmetic is `a ± b`;
 * multiplication `A * B` in read order (`2*3` is not `3*2`); a missing
 * number is the bond it completes, `{ a: addendA, b: correct, op: '+' }`,
 * the key plain addition uses (content wave 1 K4). Sharing records none
 * (content wave 2 K6), nor does hundreds (content wave 3 K7). One reading
 * for the session end, the canon fact table and the review picker.
 */
export function problemFact(
  problem: MathProblem | ExtendedMathProblem,
): MathFact | null {
  if (!('kind' in problem) || problem.kind === 'arithmetic') {
    return { a: problem.addendA, b: problem.addendB, op: problem.op }
  }
  switch (problem.kind) {
    case 'multiply':
      return { a: problem.factorA, b: problem.factorB, op: '*' }
    case 'missing-addend':
      return { a: problem.addendA, b: problem.correct, op: '+' }
    case 'recognize':
    case 'skip-count':
    case 'divide':
    case 'place-value':
    case 'more':
      return null
  }
}
