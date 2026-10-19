/**
 * Canon check for the more-and-less step, `hundreds-addsub` (content wave
 * 4, `design/native/content-wave-4.md` § 2.7: "binding: the splice writes
 * exactly this").
 *
 * More and less is served from canon on every session, the same 8
 * problems in the same order, and every line is fixed by the spec. So the
 * canon is written by `spliceContentWave4MathCanon.ts`, never Haiku-baked
 * (`PENDING_CANON_NODES`; the planner has no more-and-less prompt), and
 * this module holds it to the spec twice:
 *
 * - {@link hundredsAddsubRuleViolations}: § 2.7's lint (Dave's rules). No
 *   zero in any start or answer; all digits of each start and answer
 *   differ; no regrouping; at most 7 flats, 6 rods and 8 cubes (hundreds'
 *   maxima, so § 3.3's sizes stand); count 2–4 (the per-file rule:
 *   hundreds holds count 1, 'more' only); P1–P5 add and P6 first takes
 *   away; 8 different answers; every read parses back to its row; the
 *   chips per § 2.6 (core's `hundredsDistractors`) equal the table's.
 * - {@link hundredsAddsubCanonViolations}: every `math.p*` line and the
 *   recap line equal the § 2.7 table. `bakeOne` (`generateSessionCanon.ts`)
 *   refuses a drifted plan, and the splice test runs it over the committed
 *   file.
 *
 * Per problem N (start S, answer A in British words, Cap = capitalised,
 * the change C = "two hundred" / "thirty", its count K = "two" / "three"):
 *   math.pN.read        "Cap(S). What is C more?" / "… less?"
 *   math.pN.correct     "Yes! Cap(A)!"
 *   math.pN.reprompt    "Hmm... try again?"
 *   math.pN.hint1       "Look at the hundreds." / "Look at the tens."
 *   math.pN.hint2       "Cap(K) more hundreds." / "Take away K tens."
 *   math.pN.hint3       "What is C more?" (the read's question)
 *   math.pN.giveAnswer  "This one is A."
 */
import { hundredsDistractors } from '@marian/core/math/extendedDistractors'
import {
  moreChange,
  placeDigits,
  PLACE_PARTS,
  type MoreCount,
  type MoreDirection,
  type MoreProblem,
} from '@marian/core/math/extendedProblems'
import {
  numberToWords,
  parseMoreRead,
  PlanFromServerError,
} from '@marian/core/math/planFromServer'
import {
  HUNDREDS_REPROMPT,
  HUNDREDS_SLOTS,
  PLACE_HINTS,
} from './hundredsCanonCheck.ts'

/** A more-and-less problem: the start and its change. */
export interface MoreAndLessSpec {
  start: number
  step: 10 | 100
  count: MoreCount
  direction: MoreDirection
}

const more = (
  start: number,
  step: 10 | 100,
  count: MoreCount,
): MoreAndLessSpec => ({ start, step, count, direction: 'more' })
const less = (
  start: number,
  step: 10 | 100,
  count: MoreCount,
): MoreAndLessSpec => ({ start, step, count, direction: 'less' })

/** § 2.7, problems 1..8. */
export const HUNDREDS_ADDSUB_PLAN: readonly MoreAndLessSpec[] = [
  more(235, 100, 2),
  more(324, 10, 3),
  more(426, 100, 3),
  more(532, 10, 3),
  more(245, 100, 4),
  less(653, 100, 2),
  less(765, 10, 3),
  less(368, 10, 4),
]

/** § 2.7's chips, the answer first. */
export const HUNDREDS_ADDSUB_CHIPS: readonly (readonly [
  number,
  number,
  number,
])[] = [
  [435, 635, 835],
  [354, 374, 394],
  [726, 526, 326],
  [562, 535, 526],
  [645, 285, 654],
  [453, 853, 435],
  [735, 795, 753],
  [328, 364, 382],
]

export const HUNDREDS_ADDSUB_RECAP_FOCUS = 'You worked on more and less today!'

/** The problem where taking away starts (core's
 *  `MORE_AND_LESS_FIRST_LESS_INDEX`: it moves its blocks on the read). */
const FIRST_LESS = 6

/** Hundreds' maxima (content wave 3 § 3.3): flats, rods, cubes. */
const MAX_BLOCKS: Readonly<Record<(typeof PLACE_PARTS)[number], number>> = {
  hundreds: 7,
  tens: 6,
  ones: 8,
}
const BLOCK_NAMES = { hundreds: 'flats', tens: 'rods', ones: 'cubes' }

const COUNT_WORDS = ['', 'one', 'two', 'three', 'four'] as const
const TENS_WORDS = ['', 'ten', 'twenty', 'thirty', 'forty'] as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A spec's answer. */
export function hundredsAddsubAnswer(spec: MoreAndLessSpec): number {
  return spec.start + moreChange(spec)
}

/** The change in words: "two hundred", "thirty". */
const changeWords = (spec: MoreAndLessSpec) =>
  spec.step === 10
    ? TENS_WORDS[spec.count]
    : `${COUNT_WORDS[spec.count]} hundred`

/** A spec's question, the read's second sentence and hint 3. */
export function hundredsAddsubQuestion(spec: MoreAndLessSpec): string {
  return `What is ${changeWords(spec)} ${spec.direction}?`
}

/** The 7 lines of one problem, in slot order (read … giveAnswer). */
export function hundredsAddsubLines(spec: MoreAndLessSpec): string[] {
  const answer = numberToWords(hundredsAddsubAnswer(spec))
  const question = hundredsAddsubQuestion(spec)
  const place = spec.step === 10 ? 'tens' : 'hundreds'
  const count = COUNT_WORDS[spec.count]
  return [
    `${cap(numberToWords(spec.start))}. ${question}`,
    `Yes! ${cap(answer)}!`,
    HUNDREDS_REPROMPT,
    spec.step === 10 ? PLACE_HINTS[1] : PLACE_HINTS[0],
    spec.direction === 'more'
      ? `${cap(count)} more ${place}.`
      : `Take away ${count} ${place}.`,
    question,
    `This one is ${answer}.`,
  ]
}

interface UtteranceLike {
  id: string
  text: string
}

/** The exact `math.p*` lines the canon must carry, canon order. */
export function expectedHundredsAddsubLines(
  plan: readonly MoreAndLessSpec[] = HUNDREDS_ADDSUB_PLAN,
): readonly UtteranceLike[] {
  return plan.flatMap((spec, i) => {
    const lines = hundredsAddsubLines(spec)
    return HUNDREDS_SLOTS.map((slot, k) => ({
      id: `math.p${i + 1}.${slot}`,
      text: lines[k]!,
    }))
  })
}

/** A spec as core's problem (for the chip picker). */
function asProblem(spec: MoreAndLessSpec, index: number): MoreProblem {
  return {
    kind: 'more',
    index,
    ...spec,
    correct: hundredsAddsubAnswer(spec),
    utterances: { read: '', correct: '', reprompt: '', giveAnswer: '' },
  }
}

/** Every way `plan` breaks § 2.7's lint; `[]` = clean. */
export function hundredsAddsubRuleViolations(
  plan: readonly MoreAndLessSpec[],
  chips: readonly (readonly number[])[] = HUNDREDS_ADDSUB_CHIPS,
): string[] {
  const out: string[] = []
  if (plan.length !== 8) out.push(`${plan.length} problems, expected 8`)
  const answers = new Set<number>()
  plan.forEach((spec, i) => {
    const n = i + 1
    const answer = hundredsAddsubAnswer(spec)
    if (answers.has(answer)) out.push(`P${n}: the answer ${answer} repeats`)
    answers.add(answer)
    if (spec.count < 2 || spec.count > 4)
      out.push(`P${n}: count ${spec.count} (more and less changes 2-4)`)
    const adds = n < FIRST_LESS
    if ((spec.direction === 'more') !== adds)
      out.push(`P${n}: P1-P5 add, P6-P8 take away`)
    const s = placeDigits(spec.start)
    const a = placeDigits(answer)
    if (spec.start < 100 || spec.start > 999 || s.tens === 0 || s.ones === 0)
      out.push(`P${n}: ${spec.start} has a zero digit`)
    const place = spec.step === 10 ? 'tens' : 'hundreds'
    const digit =
      s[place] + (spec.direction === 'less' ? -spec.count : spec.count)
    const valid = digit >= 1 && digit <= 9
    if (digit < 0 || digit > 9)
      out.push(
        `P${n}: ${spec.start} ${spec.direction === 'less' ? '−' : '+'} ` +
          `${spec.count * spec.step} regroups`,
      )
    else if (!valid || a.tens === 0 || a.ones === 0)
      out.push(`P${n}: the answer ${answer} has a zero digit`)
    for (const d of [s, a])
      if (new Set(PLACE_PARTS.map((p) => d[p])).size !== 3) {
        out.push(`P${n}: a digit repeats`)
        break
      }
    for (const p of PLACE_PARTS) {
      const most = Math.max(s[p], valid ? a[p] : 0)
      if (most > MAX_BLOCKS[p])
        out.push(`P${n}: ${most} ${BLOCK_NAMES[p]} (at most ${MAX_BLOCKS[p]})`)
    }
    const read = hundredsAddsubLines(spec)[0]!
    try {
      const parsed = parseMoreRead(read)
      if (
        parsed.start !== spec.start ||
        parsed.step !== spec.step ||
        parsed.count !== spec.count ||
        parsed.direction !== spec.direction
      )
        out.push(`P${n}: "${read}" parses to another problem`)
    } catch (err) {
      if (!(err instanceof PlanFromServerError)) throw err
      out.push(`P${n}: "${read}" does not parse`)
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

/** Every way `utterances` departs from the more-and-less canon; `[]` =
 *  clean. */
export function hundredsAddsubCanonViolations(
  utterances: readonly UtteranceLike[],
): string[] {
  const out = hundredsAddsubRuleViolations(HUNDREDS_ADDSUB_PLAN).map(
    (v) => `rule: ${v}`,
  )
  const problemLines = utterances.filter((u) => u.id.startsWith('math.'))
  const expected = expectedHundredsAddsubLines()
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
  if (recap?.text !== HUNDREDS_ADDSUB_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap?.text}", expected "${HUNDREDS_ADDSUB_RECAP_FOCUS}"`,
    )
  return out
}
