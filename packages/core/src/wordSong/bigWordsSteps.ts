/**
 * The two Word Song steps of land 6, "Big words" (content wave 1,
 * `design/native/content-wave-1.md` § 3.2 and § 4.2): duck words (ck and ng
 * at the end) and crab words (start blends).
 *
 * THE one place their words and traps live. `wordPack.ts` builds the
 * picture-pack entries and the distractor rows from it, and the server's
 * planner word list (`api/_plannerWordList.ts`) imports it by relative path,
 * so a pedagogy swap (a word, a trap) is one edit here. Keep this module
 * free of imports: the deployed function loads it as plain Node ESM (see
 * `api/_types.ts` for why the path is relative).
 *
 * Each step is served from canon on every session, the same 8 words in the
 * same order (K9), so the row order IS the canon order: P1-P3 play the
 * gentle pair, P4-P8 the trap pair. Every row still carries both pairs,
 * because a review moves blocks to other positions.
 *
 * Every word takes "Yes! That's a <word>." (no celebration exception) and
 * has no blend clip (K11): the letters pulse silently and the 2nd wrong
 * plays the hint line.
 */
/** The land-6 Word Song steps. */
export type BigWordsStep = 'duck-words' | 'crab-words'

/** The `WordCategory` values these words use (a subset; `wordPack.ts`
 *  assigns them to `WordEntry.category`, so tsc checks the subset). */
export type BigWordCategory =
  | 'animal'
  | 'object'
  | 'clothing'
  | 'body-part'
  | 'person'
  | 'household'
  | 'structure'
  | 'food'

export interface BigWordRow {
  word: string
  /** The word's short vowel (every word keeps it in British English too). */
  vowel: 'a' | 'o' | 'u' | 'i'
  category: BigWordCategory
  /** P1-P3: another category, another first sound, another vowel. */
  gentle: readonly [string, string]
  /** P4-P8: the trap that tests this step's new letters. */
  trap: readonly [string, string]
}

/** Steps in tree order. */
export const BIG_WORDS_STEP_IDS: readonly BigWordsStep[] = [
  'duck-words',
  'crab-words',
]

export const BIG_WORDS_STEPS: Readonly<
  Record<BigWordsStep, readonly BigWordRow[]>
> = {
  // § 3.2. Traps: ending twins (lock / log, wing / wig) plus Dave's vowel
  // neighbour (sock / sack); the rest share the ending (rhymes), so she has
  // to read to the end of the word. Dropped from Dave's examples: neck.
  'duck-words': [
    {
      word: 'duck',
      vowel: 'u',
      category: 'animal',
      gentle: ['pen', 'box'],
      trap: ['dog', 'sock'], // same first letter; same ending
    },
    {
      word: 'rock',
      vowel: 'o',
      category: 'object',
      gentle: ['hen', 'cup'],
      trap: ['sock', 'rug'], // rhyme; same first letter
    },
    {
      word: 'ring',
      vowel: 'i',
      category: 'object',
      gentle: ['dog', 'hat'],
      trap: ['king', 'rock'], // rhyme; same first letter
    },
    {
      word: 'sock',
      vowel: 'o',
      category: 'clothing',
      gentle: ['fan', 'bug'],
      trap: ['sack', 'rock'], // Dave's vowel neighbour; rhyme
    },
    {
      word: 'wing',
      vowel: 'i',
      category: 'body-part',
      gentle: ['box', 'pan'],
      trap: ['wig', 'king'], // the same word without the n; rhyme
    },
    {
      word: 'king',
      vowel: 'i',
      category: 'person',
      // Avoids `cup`, whose /k/ matches.
      gentle: ['bus', 'pot'],
      trap: ['ring', 'wing'], // both rhymes: read the first letter
    },
    {
      word: 'lock',
      vowel: 'o',
      category: 'household',
      gentle: ['fan', 'web'],
      trap: ['log', 'rock'], // the same start, g for ck; rhyme
    },
    {
      word: 'sack',
      vowel: 'a',
      category: 'object',
      gentle: ['pig', 'jet'],
      trap: ['sock', 'sun'], // Dave's vowel neighbour; same first letter
    },
  ],
  // § 4.2, with Dave's D4 change (2026-10-16): crab's trap is clock / frog,
  // not cab / frog, and cab is out of the pack. cab is never spoken and an
  // L2 child calls that car "taxi"; clock (cl for cr) tests the second
  // letter, as flag / frog does. The dropped-consonant twins stay where a
  // picture carries them: swing / wing, clock / lock.
  'crab-words': [
    {
      word: 'flag',
      vowel: 'a',
      category: 'object',
      gentle: ['cup', 'web'],
      trap: ['frog', 'bag'], // f with r for l; rhyme with one first letter
    },
    {
      word: 'drum',
      vowel: 'u',
      category: 'object',
      gentle: ['hat', 'fox'],
      trap: ['plum', 'dog'], // rhyme with another blend; d without the r
    },
    {
      word: 'brick',
      vowel: 'i',
      category: 'object',
      gentle: ['sun', 'hat'],
      trap: ['crab', 'clock'], // the same r; the same ending
    },
    {
      word: 'crab',
      vowel: 'a',
      category: 'animal',
      gentle: ['sun', 'pen'],
      trap: ['clock', 'frog'], // cl for cr (D4); another r-blend
    },
    {
      word: 'swing',
      vowel: 'i',
      category: 'structure',
      gentle: ['pot', 'bug'],
      trap: ['wing', 'king'], // swing without the s; rhyme
    },
    {
      word: 'plum',
      vowel: 'u',
      category: 'food',
      gentle: ['cat', 'hen'],
      trap: ['drum', 'pig'], // rhyme with another blend; p without the l
    },
    {
      word: 'clock',
      vowel: 'o',
      category: 'household',
      gentle: ['bun', 'jet'],
      trap: ['lock', 'sock'], // clock without the c; rhyme
    },
    {
      word: 'frog',
      vowel: 'o',
      category: 'animal',
      gentle: ['cup', 'bed'],
      trap: ['dog', 'flag'], // rhyme without the blend; f with l for r
    },
  ],
}

/** A step's 8 words, in canon order. */
export function bigWordsOf(step: BigWordsStep): readonly string[] {
  return BIG_WORDS_STEPS[step].map((row) => row.word)
}
