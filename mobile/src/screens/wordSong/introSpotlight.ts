/**
 * The letter spotlight that goes with a Word Song step's intro lead line
 * (`design/native/content-wave-1.md` § 3.3, § 4.3). While Emma says the
 * intro, the word card's cells light on `LetterRow`'s rose spotlight
 * (120 ms fade in, the pulse unless Reduce Motion), and all go dark
 * `INTRO_SPOT_OFF_MS` after the line ends (the 1500 ms silent beat runs
 * from the line's end, so they go dark inside it).
 *
 * - Duck words, "Two letters, one sound!": the word's last two cells (c k /
 *   n g) light together.
 * - Crab words, "Read all the letters!": every cell lights, one after
 *   another from the left, `INTRO_STAGGER_MS` apart; with Reduce Motion
 *   they light at once.
 *
 * Pure: the screen holds the result while the line plays.
 */
import type { IntroGuideLineId } from '../../audio'

type Pattern = 'ending-pair' | 'left-to-right'

const PATTERNS: Readonly<Partial<Record<IntroGuideLineId, Pattern>>> = {
  'guide.session.intro.duck-words': 'ending-pair',
  'guide.session.intro.crab-words': 'left-to-right',
}

/** Crab words: cell k lights k × this after the line starts (§ 4.3). */
export const INTRO_STAGGER_MS = 150
/** The cells go dark this long after the intro line ends (§ 3.3, § 4.3). */
export const INTRO_SPOT_OFF_MS = 200

/**
 * Per letter of `word`: the delay (ms after the intro starts) before its
 * spotlight lights, or `null` for a cell that stays dark. `null` overall
 * for an intro with no spotlight (any line but the two land-6 intros).
 */
export function introSpotlight(
  line: IntroGuideLineId,
  word: string,
  reducedMotion: boolean,
): readonly (number | null)[] | null {
  const pattern = PATTERNS[line]
  if (pattern === undefined) return null
  const n = word.length
  if (pattern === 'ending-pair')
    return Array.from({ length: n }, (_, i) => (i >= n - 2 ? 0 : null))
  return Array.from({ length: n }, (_, i) =>
    reducedMotion ? 0 : i * INTRO_STAGGER_MS,
  )
}
