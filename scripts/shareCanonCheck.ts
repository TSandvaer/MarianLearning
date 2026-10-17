/**
 * Canon check for the sharing step, `div-share` (content wave 2,
 * `design/native/content-wave-2.md` § 2.7: "binding: the bake writes
 * exactly this").
 *
 * Sharing is served from canon on every session, the same 8 problems in the
 * same order, and every line is fixed by the spec. So the canon is written
 * by `spliceContentWave2Canon.ts`, never Haiku-baked (`PENDING_CANON_NODES`),
 * and this module holds it to the spec twice:
 *
 * - {@link shareRuleViolations}: the § 2.7 rules a sharing plan must meet
 *   (the "bake lint"): 2–5 plates, a share of 2–6, at most 20 flowers;
 *   P1–P3 on 2 plates; P4–P8 on 3–5 plates, a share that is never the plate
 *   count, and five different shares; no (pile, plates) pair twice.
 * - {@link shareCanonViolations}: every `math.p*` line and the recap line
 *   equal the § 2.7 table. `bakeOne` (`generateSessionCanon.ts`) refuses a
 *   drifted plan, and `spliceContentWave2Canon.test.ts` runs it over the
 *   committed file.
 *
 * Per problem N (pile T, plates B, share S = T / B; Cap = capitalised):
 *   math.pN.read        "Cap(T) flowers, B plates. How many on each plate?"
 *   math.pN.correct     "Yes! Cap(S) on each plate!"
 *   math.pN.reprompt    "Hmm... try again?"
 *   math.pN.hint1       "Look at the flowers."
 *   math.pN.hint2       "One for each plate."
 *   math.pN.hint3       "How many on each plate?"
 *   math.pN.giveAnswer  "This one is S."
 */

/** One sharing problem: `total` flowers dealt onto `plates` plates. */
export interface ShareSpec {
  total: number
  plates: number
}

/** § 2.7, problems 1..8 (pile, plates). */
export const SHARE_PLAN: readonly ShareSpec[] = [
  { total: 6, plates: 2 },
  { total: 8, plates: 2 },
  { total: 10, plates: 2 },
  { total: 12, plates: 3 },
  { total: 8, plates: 4 },
  { total: 15, plates: 5 },
  { total: 20, plates: 4 },
  { total: 18, plates: 3 },
]

/** § 2.7's rule bounds (D2, confirmed by Dave 2026-10-16). */
export const SHARE_RULES = {
  problems: 8,
  platesMin: 2,
  platesMax: 5,
  shareMin: 2,
  shareMax: 6,
  totalMax: 20,
  /** P1..this have exactly 2 plates (the concrete model, every session). */
  twoPlatesThrough: 3,
  /** P4..P8 have 3..5 plates. */
  laterPlatesMin: 3,
} as const

const WORDS = [
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
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

/** "six", "twenty" (0..20: a sharing pile is at most 20). */
export function shareWord(n: number): string {
  const w = WORDS[n]
  if (w === undefined) throw new Error(`no sharing word for ${n}`)
  return w
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const SHARE_REPROMPT = 'Hmm... try again?'
export const SHARE_HINT1 = 'Look at the flowers.'
export const SHARE_HINT2 = 'One for each plate.'
export const SHARE_HINT3 = 'How many on each plate?'
export const SHARE_RECAP_FOCUS = 'You worked on sharing today!'

/** The 7 lines of one sharing problem, in slot order (read … giveAnswer). */
export function shareLines({ total, plates }: ShareSpec): string[] {
  const share = total / plates
  return [
    `${cap(shareWord(total))} flowers, ${shareWord(plates)} plates. How many on each plate?`,
    `Yes! ${cap(shareWord(share))} on each plate!`,
    SHARE_REPROMPT,
    SHARE_HINT1,
    SHARE_HINT2,
    SHARE_HINT3,
    `This one is ${shareWord(share)}.`,
  ]
}

export const SHARE_SLOTS = [
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

/** The exact `math.p*` lines the sharing canon must carry, in canon order. */
export function expectedShareLines(
  plan: readonly ShareSpec[] = SHARE_PLAN,
): readonly UtteranceLike[] {
  return plan.flatMap((spec, i) => {
    const lines = shareLines(spec)
    return SHARE_SLOTS.map((slot, k) => ({
      id: `math.p${i + 1}.${slot}`,
      text: lines[k]!,
    }))
  })
}

/** Every way `plan` breaks § 2.7's rules; `[]` = clean. */
export function shareRuleViolations(plan: readonly ShareSpec[]): string[] {
  const r = SHARE_RULES
  const out: string[] = []
  if (plan.length !== r.problems)
    out.push(`${plan.length} problems, expected ${r.problems}`)
  const seen = new Set<string>()
  const laterShares = new Set<number>()
  plan.forEach(({ total, plates }, i) => {
    const n = i + 1
    const share = total / plates
    if (!Number.isInteger(share))
      out.push(`P${n}: ${total} does not share evenly onto ${plates} plates`)
    if (plates < r.platesMin || plates > r.platesMax)
      out.push(`P${n}: ${plates} plates (${r.platesMin}-${r.platesMax})`)
    if (share < r.shareMin || share > r.shareMax)
      out.push(`P${n}: a share of ${share} (${r.shareMin}-${r.shareMax})`)
    if (total > r.totalMax)
      out.push(`P${n}: ${total} flowers (at most ${r.totalMax})`)
    if (n <= r.twoPlatesThrough && plates !== 2)
      out.push(`P${n}: ${plates} plates; P1-P${r.twoPlatesThrough} have 2`)
    if (n > r.twoPlatesThrough) {
      if (plates < r.laterPlatesMin)
        out.push(
          `P${n}: ${plates} plates; P${r.twoPlatesThrough + 1}-P8 have ` +
            `${r.laterPlatesMin}-${r.platesMax}`,
        )
      if (share === plates)
        out.push(`P${n}: the share ${share} is the plate count`)
      if (laterShares.has(share))
        out.push(`P${n}: the share ${share} repeats in P4-P8`)
      laterShares.add(share)
    }
    const key = `${total}/${plates}`
    if (seen.has(key)) out.push(`P${n}: ${total} on ${plates} plates again`)
    seen.add(key)
  })
  return out
}

/** Every way `utterances` departs from the sharing canon; `[]` = clean. */
export function shareCanonViolations(
  utterances: readonly UtteranceLike[],
): string[] {
  const out = shareRuleViolations(SHARE_PLAN).map((v) => `rule: ${v}`)
  const problemLines = utterances.filter((u) => u.id.startsWith('math.'))
  const expected = expectedShareLines()
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
  if (recap?.text !== SHARE_RECAP_FOCUS)
    out.push(
      `session.end.recap.focus is "${recap?.text}", expected "${SHARE_RECAP_FOCUS}"`,
    )
  return out
}
