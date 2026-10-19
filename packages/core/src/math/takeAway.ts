/**
 * The take-away picture (`design/native/take-away-picture.md`, Dave's
 * research #618): a take-away problem's minuend as flowers in a ten-frame
 * (sub-to-10) or a double ten-frame (sub-to-20, the left frame a full ten
 * that never moves), the taken flowers lifting away and staying pale. Pure:
 * which slots fill, which lift and in what order, and which word of a line
 * lifts them. The native screen draws it (`TakeAwayRow`).
 */

/**
 * The words whose tick lifts the taken flowers (§ 7), matched lower-cased,
 * letters only. The single place a language version adds its words; a line
 * without one lifts on its last word, so nothing breaks before it does.
 */
export const TAKE_AWAY_TICK_WORDS: readonly string[] = ['away', 'minus']

export interface TakeAwaySlots {
  /** One ten-frame (minuend ≤ 10), or a full ten plus a ones frame. */
  frames: 1 | 2
  /** Flowers in the frame that holds the taken ones (the ones frame). */
  filled: number
  /** The taken flowers' slots (1 = top-left, reading order), in lift
   *  order: the last placed first. */
  taken: number[]
}

/**
 * The picture of `minuend − subtrahend` (§ 1, K3): slots fill top row left
 * to right, then the bottom row, and the last `subtrahend` filled lift.
 * `null` when it can't be drawn: a minuend over 19, a borrow (the taken
 * flowers would reach the ten), a negative answer or a non-integer. The
 * no-borrow pool never serves one.
 */
export function takeAwaySlots(
  minuend: number,
  subtrahend: number,
): TakeAwaySlots | null {
  if (!Number.isInteger(minuend) || !Number.isInteger(subtrahend)) return null
  if (minuend < 0 || subtrahend < 0 || subtrahend > minuend) return null
  if (minuend > 19) return null
  const frames = minuend <= 10 ? 1 : 2
  const filled = frames === 1 ? minuend : minuend - 10
  if (subtrahend > filled) return null
  const taken = Array.from({ length: subtrahend }, (_, i) => filled - i)
  return { frames, filled, taken }
}

const normalise = (word: string): string =>
  word.toLowerCase().replace(/[^\p{L}]/gu, '')

/**
 * The 0-based index of the word whose tick lifts the taken flowers (§ 4):
 * the first {@link TAKE_AWAY_TICK_WORDS} word ("Six take away three." → 2,
 * "Fifteen minus three." → 1), else the line's last word.
 */
export function takeAwayTickIndex(text: string): number {
  const words = text.split(/\s+/).filter(Boolean)
  const i = words.findIndex((w) => TAKE_AWAY_TICK_WORDS.includes(normalise(w)))
  return i >= 0 ? i : words.length - 1
}
