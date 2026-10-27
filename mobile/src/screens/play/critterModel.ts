/**
 * Letter critters' model (play-place spec § 3.3): which critters sit on
 * the log's seats (3, or 4 in a four-letter round), and what they sing.
 * Pure; the visit only.
 */
import { BLEND_MARKS } from '../../audio/blendMarks.generated'
import type { Segment } from '../../audio/blendMarks'

/** The letter on each seat, or null. */
export type Seats = readonly (string | null)[]

export const EMPTY_SEATS: Seats = [null, null, null]

/** A log of `n` empty seats. */
export const emptySeats = (n: number): Seats =>
  Array.from({ length: n }, () => null)

/**
 * The seated run, when the seated critters form one unbroken run of 2 or
 * 3 (seats 1-2, 2-3 or 1-2-3): its seat indices. Seats 1 and 3 with the
 * middle empty are not a run: they wait.
 */
export function seatedRun(seats: Seats): number[] | null {
  const filled = seats.flatMap((x, i) => (x === null ? [] : [i]))
  if (filled.length < 2) return null
  for (let i = 1; i < filled.length; i++) {
    if (filled[i] !== filled[i - 1]! + 1) return null
  }
  return filled
}

/**
 * The seated critters as groups of neighbours, left to right: each group a
 * run of adjacent seats. A group of 2 or more leans together (§ 3.3).
 */
export function seatGroups(seats: Seats): number[][] {
  const groups: number[][] = []
  seats.forEach((x, i) => {
    if (x === null) return
    const last = groups.at(-1)
    if (last !== undefined && last.at(-1) === i - 1) last.push(i)
    else groups.push([i])
  })
  return groups
}

/**
 * A partial run on a four-seat log, as a log tap sings it
 * (critters-four-letter.md § 4.1): the seated critters left to right, each
 * with the empty seats between it and the one before (a rest each). Empty
 * seats at either end are skipped.
 */
export function seatedWithGaps(
  seats: Seats,
): { seat: number; emptyBefore: number }[] {
  const out: { seat: number; emptyBefore: number }[] = []
  let prev = -1
  seats.forEach((x, i) => {
    if (x === null) return
    out.push({ seat: i, emptyBefore: prev < 0 ? 0 : i - prev - 1 })
    prev = i
  })
  return out
}

/** Seat a critter on `seat`; the one there (if any) goes home. */
export function seatAt(seats: Seats, seat: number, letter: string): Seats {
  return seats.map((x, i) => (i === seat ? letter : x))
}

/** A seated critter goes home. */
export function unseat(seats: Seats, seat: number): Seats {
  return seats.map((x, i) => (i === seat ? null : x))
}

/** Two seated critters swap seats (one may be empty). */
export function swapSeats(seats: Seats, a: number, b: number): Seats {
  const next = [...seats]
  ;[next[a], next[b]] = [next[b]!, next[a]!]
  return next
}

/** The blend clip's text for a CVC word: "f - a - n ... fan". */
export const blendText = (word: string) =>
  `${word[0]} - ${word[1]} - ${word[2]} ... ${word}`

/** The bundled clip's web path (play-place § 3.4, K1). */
export const blendClipPath = (word: string) => `/native/blend/${word}.mp3`

/** The measured segments of `word`'s clip, read straight from `BLEND_MARKS` (K2). */
export function blendSegments(word: string): readonly Segment[] | null {
  const text = blendText(word)
  if (!Object.prototype.hasOwnProperty.call(BLEND_MARKS, text)) return null
  const segments = BLEND_MARKS[text]!.segments as readonly Segment[]
  return segments.length === 4 ? segments : null
}
