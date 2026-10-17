/**
 * The letter cues that go with a Word Song step's intro lead line
 * (`design/native/content-wave-1.md` § 3.3, § 4.3; `content-wave-2.md`
 * § 3.3, § 4.3). While Emma says the intro, the word card's cells light on
 * `LetterRow`'s rose spotlight (120 ms fade in, the pulse unless Reduce
 * Motion), and all go back to normal `INTRO_SPOT_OFF_MS` after the line
 * ends (the 1500 ms silent beat runs from the line's end, so they settle
 * inside it).
 *
 * - Duck words, "Two letters, one sound!": the word's last two cells (c k /
 *   n g) light together.
 * - Crab words, "Read all the letters!": every cell lights, one after
 *   another from the left, `INTRO_STAGGER_MS` apart; with Reduce Motion
 *   they light at once.
 * - Tent words, "Read to the end!": crab words' lighting, then the last two
 *   cells (n t) pulse once together (`introEndPulse`) once the last cell has
 *   lit, i.e. after its own lit pulse; with Reduce Motion they light at
 *   once, with no pulse.
 * - Cake words, "The E is quiet. It makes the A say its name.": nothing at
 *   the start; on the word tick "quiet" the e cell goes quiet, on the tick
 *   "A" the vowel cell lights (`introTickCue`).
 *
 * The quiet-E cue (`quietECue`) also shows on the 2nd wrong of every
 * cake-words card (content wave 2 § 4.3, D8), never from reveal.
 *
 * Pure: the screen holds the results while the line plays.
 */
import { bigWordsOf } from '@marian/core/wordSong/bigWordsSteps'
import type { IntroGuideLineId } from '../../audio'

type Pattern = 'ending-pair' | 'left-to-right'

const PATTERNS: Readonly<Partial<Record<IntroGuideLineId, Pattern>>> = {
  'guide.session.intro.duck-words': 'ending-pair',
  'guide.session.intro.crab-words': 'left-to-right',
  'guide.session.intro.tent-words': 'left-to-right',
}

/** The intros whose last two cells pulse once after the stagger. */
const END_PULSE_LINES: ReadonlySet<IntroGuideLineId> = new Set([
  'guide.session.intro.tent-words',
])

/** The intro whose ticks drive the quiet-E cue. */
const QUIET_E_LINE: IntroGuideLineId = 'guide.session.intro.cake-words'

/** Crab and tent words: cell k lights k × this after the line starts. */
export const INTRO_STAGGER_MS = 150
/** The cells go back to normal this long after the intro line ends. */
export const INTRO_SPOT_OFF_MS = 200
/**
 * A cell's own lit pulse in `LetterRow` (1 → 1.2 → 1, 2 × 200 ms). Tent
 * words' end pulse starts when the last cell's has finished, so the two
 * never fight over its scale.
 */
export const LIT_PULSE_MS = 400

/**
 * Per letter of `word`: the delay (ms after the intro starts) before its
 * spotlight lights, or `null` for a cell that stays dark. `null` overall
 * for an intro with no spotlight at its start.
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

/**
 * Tent words (content wave 2 § 3.3): per letter, the delay (ms after the
 * intro starts) before its one end pulse (1 → 1.08 → 1 over 300 ms,
 * `LetterRow`), or `null`. The last two cells pulse together once the last
 * cell has lit. `null` overall for any other intro, and with Reduce Motion
 * (no pulse).
 */
export function introEndPulse(
  line: IntroGuideLineId,
  word: string,
  reducedMotion: boolean,
): readonly (number | null)[] | null {
  if (!END_PULSE_LINES.has(line) || reducedMotion) return null
  const n = word.length
  const at = (n - 1) * INTRO_STAGGER_MS + LIT_PULSE_MS
  return Array.from({ length: n }, (_, i) => (i >= n - 2 ? at : null))
}

/** A cake-words card's quiet-E cells: the vowel (cell 2) and the e (cell 4). */
export interface QuietECue {
  vowel: number
  quiet: number
}

/**
 * The quiet-E cue of `word` (content wave 2 § 4.3): every cake word is CVCe,
 * so the vowel is cell 2 and the e cell 4. `null` for any other word.
 */
export function quietECue(word: string): QuietECue | null {
  if (!bigWordsOf('cake-words').includes(word)) return null
  if (word.length !== 4 || word[3] !== 'e') return null
  return { vowel: 1, quiet: 3 }
}

/** What a word tick of an intro line does to the card's cells. */
export type IntroTickCue = { quiet: number } | { light: number } | null

/**
 * Cake words' lead (§ 4.3): on the tick of the word "quiet" the e cell goes
 * quiet; on the tick of the letter "A" the vowel cell lights. Found by the
 * words of `text`, so the fallback "The E is quiet. A says its name." works
 * too. `null` for every other tick, intro or word.
 */
export function introTickCue(
  line: IntroGuideLineId,
  text: string,
  word: string,
  tick: number,
): IntroTickCue {
  if (line !== QUIET_E_LINE) return null
  const cue = quietECue(word)
  if (cue === null) return null
  const said = text.split(/\s+/).filter(Boolean)[tick]
  if (said === undefined) return null
  const bare = said.replace(/[^A-Za-z]/g, '')
  if (bare.toLowerCase() === 'quiet') return { quiet: cue.quiet }
  if (bare === 'A') return { light: cue.vowel }
  return null
}
