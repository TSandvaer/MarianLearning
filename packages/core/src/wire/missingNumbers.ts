/**
 * Missing-number problems' session rules (content wave 1
 * `design/native/content-wave-1.md` § 1.2, NG-A): where they sit in an
 * adding session and which bonds they use. The ONE place these numbers
 * live: Dave's pedagogy marks (§ 12 D1) may change the share, the slots or
 * the ranges, and the canon splice (`scripts/spliceContentWave1Canon.ts`),
 * the composition lint (`scripts/compositionLint.ts`) and the planner's
 * add-to-10 directive (`api/_planner.ts`) all read them from here.
 *
 * No imports: the deployed functions load packages/core/src/wire as plain
 * Node ESM (see `api/_types.ts`).
 */

/** The problems (1-based) of an add-to-10 / add-to-20 session that are
 *  missing numbers: 3 of 8, the opening (P1–P3) and P5, P7 stay plain. */
export const MISSING_NUMBER_SLOTS: readonly number[] = [4, 6, 8]

/** A step's missing-number bonds: `given + missing = total`. */
export interface MissingNumberRange {
  totalMin: number
  totalMax: number
  /** The part Emma names. */
  givenMin: number
  givenMax: number
  /** The part the child taps. */
  missingMin: number
  missingMax: number
}

/**
 * - add-to-10: the whole is always ten (bonds to ten), any given part.
 * - add-to-20: A 6–9 and a missing part of 2–5, so the whole is 11–14:
 *   every problem crosses ten and the count-on fits on one hand.
 */
export const MISSING_NUMBER_RANGES: Readonly<
  Record<'add-to-10' | 'add-to-20', MissingNumberRange>
> = {
  'add-to-10': {
    totalMin: 10,
    totalMax: 10,
    givenMin: 1,
    givenMax: 9,
    missingMin: 1,
    missingMax: 9,
  },
  'add-to-20': {
    totalMin: 11,
    totalMax: 14,
    givenMin: 6,
    givenMax: 9,
    missingMin: 2,
    missingMax: 5,
  },
}

/** Is `given + missing` a missing-number bond `step` may use? */
export function missingNumberFits(
  step: keyof typeof MISSING_NUMBER_RANGES,
  given: number,
  missing: number,
): boolean {
  const r = MISSING_NUMBER_RANGES[step]
  const total = given + missing
  return (
    given >= r.givenMin &&
    given <= r.givenMax &&
    missing >= r.missingMin &&
    missing <= r.missingMax &&
    total >= r.totalMin &&
    total <= r.totalMax
  )
}

/** The unordered bond of `a + b`: `{7, 3}` and `{3, 7}` are one key. */
export function bondKey(a: number, b: number): string {
  return a <= b ? `${a}+${b}` : `${b}+${a}`
}
