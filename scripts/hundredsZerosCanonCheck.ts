/**
 * Canon check for the zeros step, `hundreds-zeros` (content wave 5,
 * `design/native/content-wave-5.md` § 2.7: "binding: the splice writes
 * exactly this").
 *
 * Zeros is served from canon on every session, the same 8 problems in the
 * same order, and every line is fixed by the spec. So the canon is written
 * by `spliceContentWave5MathCanon.ts`, never Haiku-baked
 * (`PENDING_CANON_NODES`; the planner has no zeros prompt), and this module
 * holds it to the spec twice:
 *
 * - {@link hundredsZerosRuleViolations}: § 2.7's lint (Dave's rules). A
 *   zero in every start or answer; no regrouping; at most 7 flats, 9 rods
 *   (P5's 190; § 2.3 says 6) and 8 cubes; in the
 *   build reads (P1–P4) a 1 only in the hundreds; P1–P4 build, P5 names,
 *   P6–P8 change one ten or hundred; 8 different answers; every read
 *   parses back to its row; the chips per § 2.6 (core's
 *   `hundredsDistractors`) equal the table's, all three different.
 * - {@link hundredsZerosCanonViolations}: every `math.p*` line and the
 *   recap line equal the § 2.7 table. `bakeOne` (`generateSessionCanon.ts`)
 *   refuses a drifted plan, and the splice test runs it over the committed
 *   file.
 *
 * Per problem N (answer A in British words, Cap = capitalised):
 *   math.pN.read        "Three hundreds, no tens and five ones. What number
 *                        is it?" / "Find Cap(A)." / "Cap(S). What is ten
 *                        more?" (one hundred more, ten less)
 *   math.pN.correct     "Yes! Cap(A)!"
 *   math.pN.reprompt    "Hmm... try again?"
 *   math.pN.hint1..3    P1–P5 (Dave's zero ladder, D1): "Look at the <first
 *                        zero place>." / "Zero tens." ("Zero ones.", "Zero
 *                        tens and zero ones.") / the read's question; P6–P8
 *                        hundreds' and more and less's ladders
 *   math.pN.giveAnswer  "This one is A."
 */
import { hundredsDistractors } from '@marian/core/math/extendedDistractors'
import {
  PLACE_PARTS,
  placeDigits,
  type HundredsProblem,
  type PlacePart,
} from '@marian/core/math/extendedProblems'
import {
  mathSessionPlanFromServer,
  numberToWords,
  PlanFromServerError,
} from '@marian/core/math/planFromServer'
import {
  HUNDRED_MORE_HINTS,
  HUNDREDS_REPROMPT,
  HUNDREDS_SLOTS,
  PLACE_HINTS,
  TEN_MORE_HINTS,
} from './hundredsCanonCheck.ts'

/** A build ('places') or name ('name') problem: its digits. */
export interface ZerosPlaceSpec {
  kind: 'place-value'
  form: 'places' | 'name'
  hundreds: number
  tens: number
  ones: number
}

/** One ten or one hundred more or less. */
export interface ZerosMoreSpec {
  kind: 'more'
  start: number
  step: 10 | 100
  direction: 'more' | 'less'
}

export type ZerosSpec = ZerosPlaceSpec | ZerosMoreSpec

const places = (
  hundreds: number,
  tens: number,
  ones: number,
): ZerosPlaceSpec => ({
  kind: 'place-value',
  form: 'places',
  hundreds,
  tens,
  ones,
})

/** § 2.7, problems 1..8. */
export const HUNDREDS_ZEROS_PLAN: readonly ZerosSpec[] = [
  places(3, 0, 5),
  places(4, 6, 0),
  places(7, 0, 0),
  places(1, 0, 8),
  { kind: 'place-value', form: 'name', hundreds: 1, tens: 9, ones: 0 },
  { kind: 'more', start: 305, step: 10, direction: 'more' },
  { kind: 'more', start: 640, step: 100, direction: 'more' },
  { kind: 'more', start: 416, step: 10, direction: 'less' },
]

/** § 2.7's chips, the answer first. */
export const HUNDREDS_ZEROS_CHIPS: readonly (readonly [
  number,
  number,
  number,
])[] = [
  [305, 505, 705],
  [460, 660, 860],
  [700, 500, 300],
  [108, 18, 180],
  [190, 19, 109],
  [315, 306, 405],
  [740, 641, 650],
  [406, 415, 316],
]

export const HUNDREDS_ZEROS_RECAP_FOCUS = 'You worked on zeros today!'

/** The build reads' question, and hint 3 of P1–P4. */
export const PLACE_VALUE_QUESTION = 'What number is it?'

/** Dave's zero ladder, hint 2 (D1): the zero places named. */
const ZERO_HINTS: Readonly<Record<string, string>> = {
  tens: 'Zero tens.',
  ones: 'Zero ones.',
  'tens,ones': 'Zero tens and zero ones.',
}
/** More and less's ladder at count 1, taking a ten away (wave 4 § 2.4). */
export const TEN_LESS_HINTS: readonly [string, string, string] = [
  'Look at the tens.',
  'Take away one ten.',
  'What is ten less?',
]

/** The most blocks a tray holds: hundreds' maxima (content wave 3 § 3.3),
 *  but 9 rods, P5's 190 (§ 2.7, binding; § 2.3 counts 6). The layout sizes
 *  u from the plan's own counts (`placeValueMetrics`), so the tens tray is
 *  9 rods wide on zeros. */
const MAX_BLOCKS: Readonly<Record<PlacePart, number>> = {
  hundreds: 7,
  tens: 9,
  ones: 8,
}
const BLOCK_NAMES = { hundreds: 'flats', tens: 'rods', ones: 'cubes' }

const DIGIT_WORDS = [
  'no',
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

/** A spec's answer. */
export function hundredsZerosAnswer(spec: ZerosSpec): number {
  if (spec.kind === 'more')
    return spec.start + (spec.direction === 'less' ? -spec.step : spec.step)
  return 100 * spec.hundreds + 10 * spec.tens + spec.ones
}

/** The places a build or name problem leaves empty (tens, ones). */
const zeroPlaces = (spec: ZerosPlaceSpec): PlacePart[] =>
  PLACE_PARTS.filter((p) => spec[p] === 0)

/** A place in a build read: "no tens", "One hundred", "five ones". */
function placeWords(spec: ZerosPlaceSpec, place: PlacePart): string {
  const d = spec[place]
  if (place === 'hundreds' && d === 1) return 'one hundred'
  return `${DIGIT_WORDS[d]} ${place}`
}

/** A spec's read line. */
export function hundredsZerosRead(spec: ZerosSpec): string {
  if (spec.kind === 'more')
    return `${cap(numberToWords(spec.start))}. ${moreQuestion(spec)}`
  if (spec.form === 'name')
    return `Find ${numberToWords(hundredsZerosAnswer(spec))}.`
  const [a, b, c] = PLACE_PARTS.map((p) => placeWords(spec, p))
  return `${cap(a!)}, ${b} and ${c}. ${PLACE_VALUE_QUESTION}`
}

const moreQuestion = (spec: ZerosMoreSpec) =>
  `What is ${spec.step === 10 ? 'ten' : 'one hundred'} ${spec.direction}?`

/** A spec's three hints, in order. */
function hints(spec: ZerosSpec): readonly [string, string, string] {
  if (spec.kind === 'more') {
    if (spec.direction === 'less') return TEN_LESS_HINTS
    return spec.step === 10 ? TEN_MORE_HINTS : HUNDRED_MORE_HINTS
  }
  const zeros = zeroPlaces(spec)
  return [
    PLACE_HINTS[PLACE_PARTS.indexOf(zeros[0]!)]!,
    ZERO_HINTS[zeros.join(',')]!,
    spec.form === 'name' ? hundredsZerosRead(spec) : PLACE_VALUE_QUESTION,
  ]
}

/** The 7 lines of one zeros problem, in slot order (read … giveAnswer). */
export function hundredsZerosLines(spec: ZerosSpec): string[] {
  const answer = numberToWords(hundredsZerosAnswer(spec))
  return [
    hundredsZerosRead(spec),
    `Yes! ${cap(answer)}!`,
    HUNDREDS_REPROMPT,
    ...hints(spec),
    `This one is ${answer}.`,
  ]
}

interface UtteranceLike {
  id: string
  text: string
}

/** The exact `math.p*` lines the zeros canon must carry, canon order. */
export function expectedHundredsZerosLines(
  plan: readonly ZerosSpec[] = HUNDREDS_ZEROS_PLAN,
): readonly UtteranceLike[] {
  return plan.flatMap((spec, i) => {
    const lines = hundredsZerosLines(spec)
    return HUNDREDS_SLOTS.map((slot, k) => ({
      id: `math.p${i + 1}.${slot}`,
      text: lines[k]!,
    }))
  })
}

/** Parse one read through core's extended parser (as the app does), as
 *  problem `index` of a plan that reads it 8 times. */
function parseOne(read: string, index: number): HundredsProblem {
  const utterances = Array.from({ length: 8 }, (_, i) =>
    HUNDREDS_SLOTS.map((slot) => ({
      id: `math.p${i + 1}.${slot}`,
      text: slot === 'read' ? read : HUNDREDS_REPROMPT,
    })),
  ).flat()
  const plan = mathSessionPlanFromServer(
    { id: 'zeros-lint', label: 'Zeros', utterances },
    { extendedKinds: true },
  )
  return plan.problems[index - 1] as HundredsProblem
}

/** Every way `plan` breaks § 2.7's lint; `[]` = clean. */
export function hundredsZerosRuleViolations(
  plan: readonly ZerosSpec[],
  chips: readonly (readonly number[])[] = HUNDREDS_ZEROS_CHIPS,
): string[] {
  const out: string[] = []
  if (plan.length !== 8) out.push(`${plan.length} problems, expected 8`)
  const answers = new Set<number>()
  plan.forEach((spec, i) => {
    const n = i + 1
    const answer = hundredsZerosAnswer(spec)
    if (answers.has(answer)) out.push(`P${n}: the answer ${answer} repeats`)
    answers.add(answer)
    const wanted =
      n <= 4
        ? 'places'
        : n === 5
          ? 'name'
          : ('more' as 'places' | 'name' | 'more')
    const got = spec.kind === 'more' ? 'more' : spec.form
    if (got !== wanted)
      out.push(`P${n}: P1-P4 build, P5 names, P6-P8 change (got ${got})`)
    const shown =
      spec.kind === 'more'
        ? [placeDigits(spec.start), placeDigits(answer)]
        : [placeDigits(answer)]
    if (!shown.some((d) => d.tens === 0 || d.ones === 0))
      out.push(`P${n}: no zero in the start or the answer`)
    if (answer < 100 || answer > 999)
      out.push(`P${n}: ${answer} is not 100-999`)
    if (spec.kind === 'more') {
      const s = placeDigits(spec.start)
      const place = spec.step === 10 ? 'tens' : 'hundreds'
      const digit = s[place] + (spec.direction === 'less' ? -1 : 1)
      if (digit < 0 || digit > 9 || (place === 'hundreds' && digit < 1))
        out.push(
          `P${n}: ${spec.start} ${spec.direction === 'less' ? '−' : '+'} ` +
            `${spec.step} regroups`,
        )
    } else if (n <= 4 && (spec.tens === 1 || spec.ones === 1)) {
      out.push(`P${n}: a 1 outside the hundreds`)
    }
    for (const p of PLACE_PARTS) {
      const most = Math.max(...shown.map((d) => d[p]))
      if (most > MAX_BLOCKS[p])
        out.push(`P${n}: ${most} ${BLOCK_NAMES[p]} (at most ${MAX_BLOCKS[p]})`)
    }
    const read = hundredsZerosRead(spec)
    let parsed: HundredsProblem | null = null
    try {
      parsed = parseOne(read, n)
      const same =
        parsed.correct === answer &&
        (spec.kind === 'more'
          ? parsed.kind === 'more' &&
            parsed.start === spec.start &&
            parsed.step === spec.step &&
            parsed.count === 1 &&
            parsed.direction === spec.direction
          : parsed.kind === 'place-value' && parsed.form === spec.form)
      if (!same) out.push(`P${n}: "${read}" parses to another problem`)
    } catch (err) {
      if (!(err instanceof PlanFromServerError)) throw err
      out.push(`P${n}: "${read}" does not parse`)
    }
    const want = chips[i]
    if (want !== undefined && parsed !== null) {
      const got = [answer, ...hundredsDistractors(parsed)]
      if (new Set(got).size !== 3) out.push(`P${n}: two chips are the same`)
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

/** Every way `utterances` departs from the zeros canon; `[]` = clean. */
export function hundredsZerosCanonViolations(
  utterances: readonly UtteranceLike[],
): string[] {
  const out = hundredsZerosRuleViolations(HUNDREDS_ZEROS_PLAN).map(
    (v) => `rule: ${v}`,
  )
  const problemLines = utterances.filter((u) => u.id.startsWith('math.'))
  const expected = expectedHundredsZerosLines()
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
  if (recap?.text !== HUNDREDS_ZEROS_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap?.text}", expected "${HUNDREDS_ZEROS_RECAP_FOCUS}"`,
    )
  return out
}
