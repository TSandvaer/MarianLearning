/**
 * Canon check for the hundreds step, `hundreds` (content wave 3,
 * `design/native/content-wave-3.md` § 3.7: "binding: the splice writes
 * exactly this").
 *
 * Hundreds is served from canon on every session, the same 8 problems in
 * the same order, and every line is fixed by the spec. So the canon is
 * written by `spliceContentWave3Canon.ts`, never Haiku-baked
 * (`PENDING_CANON_NODES`; the planner has no hundreds prompt), and this
 * module holds it to the spec twice:
 *
 * - {@link hundredsRuleViolations}: § 3.7's lint. Place-value digits 2–9,
 *   all different, P1–P4 in place order; more-problems with no zero and no
 *   regrouping; 8 different answers; the chips per § 3.6 (core's
 *   `hundredsDistractors`) equal the table's.
 * - {@link hundredsCanonViolations}: every `math.p*` line and the recap
 *   line equal the § 3.7 table. `bakeOne` (`generateSessionCanon.ts`)
 *   refuses a drifted plan, and the splice test runs it over the committed
 *   file.
 *
 * Per problem N (answer A in British words, Cap = capitalised):
 *   math.pN.read        "Two hundreds, three tens and four ones. What number
 *                        is it?" / "Two hundred and forty-three. What is ten
 *                        more?"
 *   math.pN.correct     "Yes! Cap(A)!"
 *   math.pN.reprompt    "Hmm... try again?"
 *   math.pN.hint1..3    place-value: "Look at the hundreds." / "Look at the
 *                        tens." / "Look at the ones."; +10: "Look at the
 *                        tens." / "One more ten." / "What is ten more?";
 *                        +100: "Look at the hundreds." / "One more
 *                        hundred." / "What is one hundred more?"
 *   math.pN.giveAnswer  "This one is A."
 */
import { hundredsDistractors } from '@marian/core/math/extendedDistractors'
import {
  PLACE_DIGIT_MAX,
  PLACE_DIGIT_MIN,
  PLACE_PARTS,
  placeDigits,
  type HundredsProblem,
  type PlacePart,
} from '@marian/core/math/extendedProblems'
import { numberToWords } from '@marian/core/math/planFromServer'

/** A place-value problem: the digits, named in `order`. */
export interface PlaceValueSpec {
  kind: 'place-value'
  hundreds: number
  tens: number
  ones: number
  order: readonly PlacePart[]
}

/** A "ten / one hundred more" problem. */
export interface MoreSpec {
  kind: 'more'
  start: number
  step: 10 | 100
}

export type HundredsSpec = PlaceValueSpec | MoreSpec

const PLACE: readonly PlacePart[] = PLACE_PARTS
const pv = (
  hundreds: number,
  tens: number,
  ones: number,
  order: readonly PlacePart[] = PLACE,
): PlaceValueSpec => ({ kind: 'place-value', hundreds, tens, ones, order })

/** § 3.7, problems 1..8. */
export const HUNDREDS_PLAN: readonly HundredsSpec[] = [
  pv(2, 3, 4),
  pv(3, 5, 2),
  pv(4, 2, 6),
  pv(5, 3, 7),
  pv(3, 2, 6, ['hundreds', 'ones', 'tens']),
  { kind: 'more', start: 243, step: 10 },
  { kind: 'more', start: 465, step: 100 },
  { kind: 'more', start: 728, step: 10 },
]

/** § 3.7's chips, the answer first. */
export const HUNDREDS_CHIPS: readonly (readonly [number, number, number])[] = [
  [234, 434, 634],
  [352, 552, 752],
  [426, 626, 826],
  [537, 573, 547],
  [326, 362, 336],
  [253, 244, 343],
  [565, 475, 466],
  [738, 729, 828],
]

const DIGIT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const HUNDREDS_REPROMPT = 'Hmm... try again?'
export const HUNDREDS_RECAP_FOCUS = 'You worked on hundreds today!'
/** The place-value hints, one per tray, in place order. */
export const PLACE_HINTS: readonly [string, string, string] = [
  'Look at the hundreds.',
  'Look at the tens.',
  'Look at the ones.',
]
export const TEN_MORE_HINTS: readonly [string, string, string] = [
  'Look at the tens.',
  'One more ten.',
  'What is ten more?',
]
export const HUNDRED_MORE_HINTS: readonly [string, string, string] = [
  'Look at the hundreds.',
  'One more hundred.',
  'What is one hundred more?',
]

/** A spec's answer. */
export function hundredsAnswer(spec: HundredsSpec): number {
  return spec.kind === 'more'
    ? spec.start + spec.step
    : 100 * spec.hundreds + 10 * spec.tens + spec.ones
}

/** A spec's read line. */
export function hundredsRead(spec: HundredsSpec): string {
  if (spec.kind === 'more')
    return `${cap(numberToWords(spec.start))}. What is ${
      spec.step === 10 ? 'ten' : 'one hundred'
    } more?`
  const [a, b, c] = spec.order.map((p) => `${DIGIT_WORDS[spec[p]]} ${p}`)
  return `${cap(a!)}, ${b} and ${c}. What number is it?`
}

/** The 7 lines of one hundreds problem, in slot order (read … giveAnswer). */
export function hundredsLines(spec: HundredsSpec): string[] {
  const answer = numberToWords(hundredsAnswer(spec))
  const hints =
    spec.kind === 'place-value'
      ? PLACE_HINTS
      : spec.step === 10
        ? TEN_MORE_HINTS
        : HUNDRED_MORE_HINTS
  return [
    hundredsRead(spec),
    `Yes! ${cap(answer)}!`,
    HUNDREDS_REPROMPT,
    ...hints,
    `This one is ${answer}.`,
  ]
}

export const HUNDREDS_SLOTS = [
  'read',
  'correct',
  'reprompt',
  'hint1',
  'hint2',
  'hint3',
  'giveAnswer',
] as const

interface UtteranceLike {
  id: string
  text: string
}

/** The exact `math.p*` lines the hundreds canon must carry, canon order. */
export function expectedHundredsLines(
  plan: readonly HundredsSpec[] = HUNDREDS_PLAN,
): readonly UtteranceLike[] {
  return plan.flatMap((spec, i) => {
    const lines = hundredsLines(spec)
    return HUNDREDS_SLOTS.map((slot, k) => ({
      id: `math.p${i + 1}.${slot}`,
      text: lines[k]!,
    }))
  })
}

/** A spec as core's problem (for the chip picker). */
function asProblem(spec: HundredsSpec, index: number): HundredsProblem {
  const utterances = { read: '', correct: '', reprompt: '', giveAnswer: '' }
  return spec.kind === 'more'
    ? { ...spec, index, correct: hundredsAnswer(spec), utterances }
    : {
        kind: 'place-value',
        index,
        hundreds: spec.hundreds,
        tens: spec.tens,
        ones: spec.ones,
        spokenOrder: spec.order,
        correct: hundredsAnswer(spec),
        utterances,
      }
}

/** Every way `plan` breaks § 3.7's lint; `[]` = clean. */
export function hundredsRuleViolations(
  plan: readonly HundredsSpec[],
  chips: readonly (readonly number[])[] = HUNDREDS_CHIPS,
): string[] {
  const out: string[] = []
  if (plan.length !== 8) out.push(`${plan.length} problems, expected 8`)
  const answers = new Set<number>()
  plan.forEach((spec, i) => {
    const n = i + 1
    const answer = hundredsAnswer(spec)
    if (answers.has(answer)) out.push(`P${n}: the answer ${answer} repeats`)
    answers.add(answer)
    if (spec.kind === 'place-value') {
      const digits = PLACE.map((p) => spec[p])
      for (const [k, d] of digits.entries())
        if (d < PLACE_DIGIT_MIN || d > PLACE_DIGIT_MAX)
          out.push(
            `P${n}: ${d} ${PLACE[k]} (${PLACE_DIGIT_MIN}-${PLACE_DIGIT_MAX})`,
          )
      if (new Set(digits).size !== 3) out.push(`P${n}: a digit repeats`)
      if (
        spec.order.length !== 3 ||
        new Set(spec.order).size !== 3 ||
        !PLACE.every((p) => spec.order.includes(p))
      )
        out.push(`P${n}: the read must name each place once`)
      if (n <= 4 && spec.order.some((p, k) => p !== PLACE[k]))
        out.push(`P${n}: P1-P4 name the places in place order`)
    } else {
      const d = placeDigits(spec.start)
      if (spec.start < 100 || d.tens === 0 || d.ones === 0)
        out.push(`P${n}: ${spec.start} has a zero digit`)
      if (spec.step === 10 ? d.tens > 8 : d.hundreds > 8)
        out.push(`P${n}: ${spec.start} + ${spec.step} regroups`)
      if (answer > 999) out.push(`P${n}: ${answer} is above 999`)
    }
    const want = chips[i]
    if (want !== undefined) {
      const got = [answer, ...hundredsDistractors(asProblem(spec, n))]
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

/** Every way `utterances` departs from the hundreds canon; `[]` = clean. */
export function hundredsCanonViolations(
  utterances: readonly UtteranceLike[],
): string[] {
  const out = hundredsRuleViolations(HUNDREDS_PLAN).map((v) => `rule: ${v}`)
  const problemLines = utterances.filter((u) => u.id.startsWith('math.'))
  const expected = expectedHundredsLines()
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
  if (recap?.text !== HUNDREDS_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap?.text}", expected "${HUNDREDS_RECAP_FOCUS}"`,
    )
  return out
}
