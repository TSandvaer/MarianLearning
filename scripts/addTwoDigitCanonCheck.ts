/**
 * Canon check for the adding-big-numbers step, `add-two-digit` (content
 * wave 5, `design/native/content-wave-5.md` § 3.7: "binding: the splice
 * writes exactly this").
 *
 * Adding big numbers is served from canon on every session, the same 8
 * problems in the same order, and every line is fixed by the spec. So the
 * canon is written by `spliceContentWave5MathCanon.ts`, never Haiku-baked
 * (`PENDING_CANON_NODES`; the planner has no prompt block for it), and this
 * module holds it to the spec twice:
 *
 * - {@link addTwoDigitRuleViolations}: § 3.7's lint (Dave's rules). Both
 *   addends 11–89 with no zero digit; answers 21–99 with no zero digit;
 *   P1–P2 without a new ten, P3–P8 with one, their ones summing to 12–14;
 *   at most 9 rods (the answer's) and 14 cubes (before the bundle); 8
 *   different answers; every read parses back to its row as today's
 *   addition; the chips (core's `addTwoDigitDistractors`) equal the
 *   table's.
 * - {@link addTwoDigitCanonViolations}: every `math.p*` line and the recap
 *   line equal the § 3.7 table.
 *
 * Per problem N (A + B = C, numbers in British words, Cap = capitalised):
 *   math.pN.read        "Cap(A) plus B. How many?"
 *   math.pN.correct     "Yes! Cap(C)!"
 *   math.pN.reprompt    "Hmm... try again?"
 *   math.pN.hint1       "Look at the ones."
 *   math.pN.hint2       "Look at the tens." (P1–P2) / "Ten ones make a ten."
 *   math.pN.hint3       "How many?"
 *   math.pN.giveAnswer  "This one is C."
 */
import { addTwoDigitDistractors } from '@marian/core/math/extendedDistractors'
import {
  numberToWords,
  parseReadOperands,
  PlanFromServerError,
} from '@marian/core/math/planFromServer'
import {
  HUNDREDS_REPROMPT,
  HUNDREDS_SLOTS,
  PLACE_HINTS,
} from './hundredsCanonCheck.ts'

/** One sum: its two addends. */
export interface AddTwoDigitSpec {
  addendA: number
  addendB: number
}

const sum = (addendA: number, addendB: number): AddTwoDigitSpec => ({
  addendA,
  addendB,
})

/** § 3.7, problems 1..8. */
export const ADD_TWO_DIGIT_PLAN: readonly AddTwoDigitSpec[] = [
  sum(34, 25),
  sum(42, 36),
  sum(28, 35),
  sum(47, 26),
  sum(39, 44),
  sum(56, 28),
  sum(29, 33),
  sum(65, 27),
]

/** § 3.7's chips, the answer first. */
export const ADD_TWO_DIGIT_CHIPS: readonly (readonly [
  number,
  number,
  number,
])[] = [
  [59, 39, 79],
  [78, 58, 98],
  [63, 43, 83],
  [73, 63, 74],
  [83, 73, 82],
  [84, 74, 85],
  [62, 52, 61],
  [92, 82, 93],
]

export const ADD_TWO_DIGIT_RECAP_FOCUS =
  'You worked on adding big numbers today!'

/** Hint 2 from P3 on (§ 3.4): the new ten named. */
export const NEW_TEN_HINT = 'Ten ones make a ten.'
/** Hint 3, the multiplication canon's. */
export const HOW_MANY = 'How many?'

/** The problems without a new ten (§ 3.7: P1–P2). */
const NO_NEW_TEN_THROUGH = 2
/** The layout's maxima (§ 3.3): the answer's rods, the cubes before the
 *  bundle. */
const MAX_RODS = 9
const MAX_CUBES = 14

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hasZeroDigit = (n: number) => String(n).includes('0')

/** A spec's answer. */
export const addTwoDigitAnswer = (spec: AddTwoDigitSpec): number =>
  spec.addendA + spec.addendB

/** The 7 lines of one problem, in slot order (read … giveAnswer). */
export function addTwoDigitLines(spec: AddTwoDigitSpec, n: number): string[] {
  const answer = numberToWords(addTwoDigitAnswer(spec))
  return [
    `${cap(numberToWords(spec.addendA))} plus ${numberToWords(spec.addendB)}. ${HOW_MANY}`,
    `Yes! ${cap(answer)}!`,
    HUNDREDS_REPROMPT,
    PLACE_HINTS[2],
    n <= NO_NEW_TEN_THROUGH ? PLACE_HINTS[1] : NEW_TEN_HINT,
    HOW_MANY,
    `This one is ${answer}.`,
  ]
}

interface UtteranceLike {
  id: string
  text: string
}

/** The exact `math.p*` lines the canon must carry, canon order. */
export function expectedAddTwoDigitLines(
  plan: readonly AddTwoDigitSpec[] = ADD_TWO_DIGIT_PLAN,
): readonly UtteranceLike[] {
  return plan.flatMap((spec, i) => {
    const lines = addTwoDigitLines(spec, i + 1)
    return HUNDREDS_SLOTS.map((slot, k) => ({
      id: `math.p${i + 1}.${slot}`,
      text: lines[k]!,
    }))
  })
}

/** Every way `plan` breaks § 3.7's lint; `[]` = clean. */
export function addTwoDigitRuleViolations(
  plan: readonly AddTwoDigitSpec[],
  chips: readonly (readonly number[])[] = ADD_TWO_DIGIT_CHIPS,
): string[] {
  const out: string[] = []
  if (plan.length !== 8) out.push(`${plan.length} problems, expected 8`)
  const answers = new Set<number>()
  plan.forEach((spec, i) => {
    const n = i + 1
    const { addendA: a, addendB: b } = spec
    const answer = addTwoDigitAnswer(spec)
    if (answers.has(answer)) out.push(`P${n}: the answer ${answer} repeats`)
    answers.add(answer)
    for (const x of [a, b])
      if (x < 11 || x > 89 || hasZeroDigit(x))
        out.push(`P${n}: the addend ${x} (11-89, no zero digit)`)
    if (answer < 21 || answer > 99 || hasZeroDigit(answer))
      out.push(`P${n}: the answer ${answer} (21-99, no zero digit)`)
    const ones = (a % 10) + (b % 10)
    if (n <= NO_NEW_TEN_THROUGH) {
      if (ones >= 10) out.push(`P${n}: makes a new ten (P1-P2 make none)`)
    } else if (ones < 12 || ones > 14) {
      out.push(`P${n}: the ones make ${ones} (P3-P8: a new ten, 12-14)`)
    }
    if (Math.floor(answer / 10) > MAX_RODS)
      out.push(`P${n}: ${Math.floor(answer / 10)} rods (at most ${MAX_RODS})`)
    if (ones > MAX_CUBES)
      out.push(`P${n}: ${ones} cubes (at most ${MAX_CUBES})`)
    const read = addTwoDigitLines(spec, n)[0]!
    try {
      const parsed = parseReadOperands(read)
      if (parsed.op !== '+' || parsed.addendA !== a || parsed.addendB !== b)
        out.push(`P${n}: "${read}" parses to another problem`)
    } catch (err) {
      if (!(err instanceof PlanFromServerError)) throw err
      out.push(`P${n}: "${read}" does not parse`)
    }
    const want = chips[i]
    if (want !== undefined) {
      const got = [answer, ...addTwoDigitDistractors(answer, n)]
      const same =
        got[0] === want[0] &&
        [...got.slice(1)].sort().join() === [...want.slice(1)].sort().join()
      if (!same)
        out.push(
          `P${n}: chips ${got.join(', ')}, the table says ${want.join(', ')}`,
        )
    }
  })
  return out
}

/** Every way `utterances` departs from the canon; `[]` = clean. */
export function addTwoDigitCanonViolations(
  utterances: readonly UtteranceLike[],
): string[] {
  const out = addTwoDigitRuleViolations(ADD_TWO_DIGIT_PLAN).map(
    (v) => `rule: ${v}`,
  )
  const problemLines = utterances.filter((u) => u.id.startsWith('math.'))
  const expected = expectedAddTwoDigitLines()
  const got = new Map(problemLines.map((u) => [u.id, u.text]))
  for (const e of expected) {
    const text = got.get(e.id)
    if (text === undefined) out.push(`missing ${e.id} ("${e.text}")`)
    else if (text !== e.text)
      out.push(`${e.id} is "${text}", expected "${e.text}"`)
  }
  const known = new Set(expected.map((e) => e.id))
  for (const u of problemLines)
    if (!known.has(u.id)) out.push(`unexpected ${u.id} ("${u.text}")`)
  const recap = utterances.find((u) => u.id === 'session.end.recap.focus')
  if (recap?.text !== ADD_TWO_DIGIT_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap?.text}", expected "${ADD_TWO_DIGIT_RECAP_FOCUS}"`,
    )
  return out
}
