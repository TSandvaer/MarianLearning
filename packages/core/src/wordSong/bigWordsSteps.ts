/**
 * The Word Song word steps in land 6's format. Land 6, "Big words": duck
 * words (ck and ng at the end) and crab words (start blends) from content
 * wave 1 (`design/native/content-wave-1.md` § 3.2 and § 4.2); tent words
 * (end blends) and cake words (magic e) from content wave 2
 * (`design/native/content-wave-2.md` § 3.2 and § 4.2). Land 8, "Words and
 * stories": bee words (ee / ea) and car words (ar) from content wave 4
 * (`design/native/content-wave-4.md` § 3.2 and § 4.2). Land 9, "More words
 * and stories": snail words (ai / ay and oa) and moon words (long oo) from
 * content wave 5 (`design/native/content-wave-5.md` § 4.2 and § 5.2).
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
/** The land-6-format Word Song steps. */
export type BigWordsStep =
  | 'duck-words'
  | 'crab-words'
  | 'tent-words'
  | 'cake-words'
  | 'bee-words'
  | 'car-words'
  | 'snail-words'
  | 'moon-words'

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
  // Content wave 2: pond and pine (§ 3.2, § 4.2), bike.
  | 'nature'
  | 'vehicle'
  // Content wave 4: star (§ 4.2; the pack's sun is celestial already).
  | 'celestial'
  // Content wave 5: spoon (§ 5.2; the pack's pan and pot are kitchen).
  | 'kitchen'

export interface BigWordRow {
  word: string
  /**
   * The word's vowel letter. Duck, crab and tent words: its short vowel
   * (every word keeps it in British English too). Cake words: the letter
   * that says its name (content wave 2 § 4.2); nothing on the land-6 path
   * reads it as a short sound. Bee words: 'e', the team's first letter,
   * which says its name; car words: 'a' (content wave 4 § 3.2, § 4.2).
   * Snail words: 'a' for ai / ay, 'o' for oa, the team's first letter,
   * which says its name; moon words: 'o' (content wave 5 § 4.2, § 5.2).
   */
  vowel: 'a' | 'e' | 'i' | 'o' | 'u'
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
  'tent-words',
  'cake-words',
  'bee-words',
  'car-words',
  'snail-words',
  'moon-words',
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
  // Content wave 2 § 3.2 (Dave's D7): end blends, 8 of Dave's 10 words
  // (jump and milk dropped: "Yes! That's a jump." breaks; mask and raft
  // kept out: a long vowel in British English). Traps: Dave's twin where
  // it has a picture (nest / net), otherwise the same start with a short
  // vowel (hand / hat, belt / bed, pond / pot), so she reads to the end.
  'tent-words': [
    {
      word: 'tent',
      vowel: 'e',
      category: 'structure',
      gentle: ['dog', 'cup'],
      trap: ['nest', 'tap'], // same vowel and last letter; the same t
    },
    {
      word: 'hand',
      vowel: 'a',
      category: 'body-part',
      gentle: ['bus', 'pot'],
      trap: ['hat', 'pond'], // the same start ha; the same ending nd
    },
    {
      word: 'gift',
      vowel: 'i',
      category: 'object',
      gentle: ['sun', 'pot'],
      trap: ['gem', 'fig'], // the same g; f, i, g in another order
    },
    {
      word: 'nest',
      vowel: 'e',
      category: 'structure',
      gentle: ['cup', 'fox'],
      trap: ['net', 'tent'], // nest without the s (Dave's twin); end t
    },
    {
      word: 'desk',
      vowel: 'e',
      category: 'household',
      gentle: ['sun', 'cat'],
      trap: ['duck', 'nest'], // same first and last sound; s and one more
    },
    {
      word: 'belt',
      vowel: 'e',
      category: 'clothing',
      gentle: ['sun', 'fox'],
      trap: ['bed', 'tent'], // the same start be; same vowel and end t
    },
    {
      word: 'lamp',
      vowel: 'a',
      category: 'household',
      gentle: ['bus', 'dog'],
      trap: ['lock', 'hand'], // l and four letters; same vowel, four letters
    },
    {
      word: 'pond',
      vowel: 'o',
      category: 'nature',
      gentle: ['cup', 'hen'],
      trap: ['pot', 'hand'], // the same start po; the same ending nd
    },
  ],
  // Content wave 2 § 4.2 (Dave's D8): magic e, all CVCe (vowel = cell 2,
  // e = cell 4). The trap is the short twin she already reads where it has
  // a picture (cape / cap, pine / pin, tube / tub), otherwise a short word
  // with the same start; the second trap shares the pattern, so "it has an
  // e" alone doesn't decide. 8 of Dave's 12 (nose, cube, five, nine out).
  'cake-words': [
    {
      word: 'cake',
      vowel: 'a',
      category: 'food',
      gentle: ['dog', 'pen'],
      trap: ['cape', 'cat'], // same start and pattern; short ca
    },
    {
      word: 'kite',
      vowel: 'i',
      category: 'object',
      gentle: ['sun', 'hen'],
      trap: ['king', 'bike'], // the same start ki, short; the same i_e
    },
    {
      word: 'bone',
      vowel: 'o',
      category: 'object',
      gentle: ['jet', 'sun'],
      trap: ['box', 'rope'], // the same start bo, short; the same o_e
    },
    {
      word: 'cape',
      vowel: 'a',
      category: 'clothing',
      gentle: ['dog', 'bus'],
      trap: ['cap', 'cake'], // cape without the e (Dave's twin); a_e
    },
    {
      word: 'pine',
      vowel: 'i',
      category: 'nature',
      gentle: ['dog', 'cup'],
      trap: ['pin', 'kite'], // pine without the e; the same i_e
    },
    {
      word: 'rope',
      vowel: 'o',
      category: 'object',
      gentle: ['hen', 'sun'],
      trap: ['rock', 'bone'], // the same start ro, short; the same o_e
    },
    {
      word: 'tube',
      vowel: 'u',
      category: 'object',
      gentle: ['hen', 'cat'],
      trap: ['tub', 'top'], // tube without the e; t with a short vowel
    },
    {
      word: 'bike',
      vowel: 'i',
      category: 'vehicle',
      gentle: ['dog', 'pen'],
      trap: ['bib', 'kite'], // the same start bi, short; the same i_e
    },
  ],
  // Content wave 4 § 3.2 (Dave's words and traps, D5's gentle pairs): ee
  // and ea both say E's name. Gentle pairs: another category, first sound
  // and vowel letter (none has an e). sheep is also an sh-step target with
  // its own matrix row, so this row rides on the problem (§ 5, `chipRow`).
  'bee-words': [
    {
      word: 'bee',
      vowel: 'e',
      category: 'animal',
      gentle: ['cup', 'fan'],
      trap: ['bed', 'tree'], // the short word she reads; the same ee
    },
    {
      word: 'tree',
      vowel: 'e',
      category: 'nature',
      gentle: ['dog', 'cap'],
      trap: ['tent', 'bee'], // t and a short e; the same ee
    },
    {
      word: 'leaf',
      vowel: 'e',
      category: 'nature',
      gentle: ['box', 'hat'],
      trap: ['leg', 'seal'], // the short word; the same ea
    },
    {
      word: 'sheep',
      vowel: 'e',
      category: 'animal',
      gentle: ['pot', 'map'],
      trap: ['ship', 'jeep'], // Dave's R8 contrast; rhyme
    },
    {
      word: 'jeep',
      vowel: 'e',
      category: 'vehicle',
      gentle: ['pig', 'sun'],
      trap: ['jet', 'sheep'], // the short word; rhyme
    },
    {
      word: 'seal',
      vowel: 'e',
      category: 'animal',
      gentle: ['mop', 'cap'],
      trap: ['sun', 'seed'], // s and a short vowel; read to the end
    },
    {
      word: 'peach',
      vowel: 'e',
      category: 'food',
      gentle: ['dog', 'bus'],
      trap: ['pen', 'leaf'], // the short word; the same ea
    },
    {
      word: 'seed',
      vowel: 'e',
      category: 'nature',
      gentle: ['cat', 'cup'],
      trap: ['sock', 'seal'], // s and a short vowel; the same s, e, e
    },
  ],
  // Content wave 4 § 4.2: ar says /ɑː/ (Lily is British: no r sound).
  // Gentle pairs as bee words', with no a, and no c or k sound for car,
  // cart and card. Never put bath in a car-words trio (the British /ɑː/).
  // shark is also an sh-step target, so its row rides on the problem.
  'car-words': [
    {
      word: 'car',
      vowel: 'a',
      category: 'vehicle',
      gentle: ['dog', 'pen'],
      trap: ['cat', 'star'], // the short word; rhyme
    },
    {
      word: 'star',
      vowel: 'a',
      category: 'celestial',
      gentle: ['hen', 'cup'],
      trap: ['sun', 'car'], // s and a short vowel; rhyme
    },
    {
      word: 'barn',
      vowel: 'a',
      category: 'structure',
      gentle: ['fox', 'pen'],
      trap: ['bag', 'harp'], // the short word; the same ar
    },
    {
      word: 'cart',
      vowel: 'a',
      category: 'vehicle',
      gentle: ['sun', 'hen'],
      trap: ['cat', 'car'], // cart without the r; read to the end
    },
    {
      word: 'shark',
      vowel: 'a',
      category: 'animal',
      gentle: ['pot', 'bed'],
      trap: ['ship', 'star'], // sh and a short vowel; the same ar
    },
    {
      word: 'scarf',
      vowel: 'a',
      category: 'clothing',
      gentle: ['dog', 'bun'],
      trap: ['sack', 'shark'], // s and a short a; the same ar
    },
    {
      word: 'card',
      vowel: 'a',
      category: 'object',
      gentle: ['pig', 'hen'],
      trap: ['cap', 'cart'], // the short start; only the last letter differs
    },
    {
      word: 'harp',
      vowel: 'a',
      category: 'object',
      gentle: ['fox', 'bus'],
      trap: ['hat', 'barn'], // the short word; the same ar
    },
  ],
  // Content wave 5 § 4.2 (Dave's words and traps, D5's gentle pairs): ai /
  // ay and oa say the first letter's name, the teams alternating a, o, a,
  // o … Gentle pairs: another category and first sound, and no letter of
  // the target's team (every one has e or u as its vowel). P1 is tray, the
  // only word ending in its team, so the lead's ending-pair cue lights a y.
  'snail-words': [
    {
      word: 'tray',
      vowel: 'a',
      category: 'household',
      gentle: ['hen', 'cup'],
      trap: ['tree', 'train'], // ay against ee; read on
    },
    {
      word: 'boat',
      vowel: 'o',
      category: 'vehicle',
      gentle: ['sun', 'jug'],
      trap: ['bat', 'bone'], // boat without the o; o_e
    },
    {
      word: 'snail',
      vowel: 'a',
      category: 'animal',
      gentle: ['cup', 'bed'],
      trap: ['seal', 'sack'], // s…l, ai against ea; short a
    },
    {
      word: 'coat',
      vowel: 'o',
      category: 'clothing',
      gentle: ['hen', 'bus'],
      trap: ['cot', 'goat'], // coat without the a; rhyme
    },
    {
      word: 'train',
      vowel: 'a',
      category: 'vehicle',
      gentle: ['nut', 'pen'],
      trap: ['chain', 'tray'], // rhyme; the same start
    },
    {
      word: 'loaf',
      vowel: 'o',
      category: 'food',
      gentle: ['sun', 'bed'],
      trap: ['leaf', 'log'], // oa against ea; l, short o
    },
    {
      word: 'goat',
      vowel: 'o',
      category: 'animal',
      gentle: ['cup', 'net'],
      trap: ['gum', 'coat'], // g, short u; rhyme
    },
    {
      word: 'chain',
      vowel: 'a',
      category: 'object',
      gentle: ['bug', 'sun'],
      trap: ['can', 'train'], // ch as c, ai as short a; rhyme
    },
  ],
  // Content wave 5 § 5.2: oo says /uː/ (Lily is British: roof is /ruːf/,
  // never /rʊf/). Gentle pairs as snail words', with no o. P1 is moon; no
  // picturable oo word ends in oo, so its lead lights the team where it is
  // ('team-pair').
  'moon-words': [
    {
      word: 'moon',
      vowel: 'o',
      category: 'celestial',
      gentle: ['hen', 'cup'],
      trap: ['mop', 'spoon'], // m, short o; rhyme
    },
    {
      word: 'spoon',
      vowel: 'o',
      category: 'kitchen',
      gentle: ['bug', 'jet'],
      trap: ['sock', 'moon'], // s, short o; rhyme
    },
    {
      word: 'boot',
      vowel: 'o',
      category: 'clothing',
      gentle: ['fan', 'pig'],
      trap: ['box', 'bone'], // b, short o; o_e
    },
    {
      word: 'broom',
      vowel: 'o',
      category: 'household',
      gentle: ['hen', 'sun'],
      trap: ['brick', 'boot'], // br, short i; the team
    },
    {
      word: 'tooth',
      vowel: 'o',
      category: 'body-part',
      gentle: ['cup', 'pig'],
      trap: ['top', 'boot'], // t, short o; the team
    },
    {
      word: 'stool',
      vowel: 'o',
      category: 'household',
      gentle: ['jet', 'hen'],
      trap: ['star', 'spoon'], // st, ar against oo; the team
    },
    {
      word: 'hoop',
      vowel: 'o',
      category: 'object',
      gentle: ['bus', 'cup'],
      trap: ['hot', 'roof'], // h, short o; the team
    },
    {
      word: 'roof',
      vowel: 'o',
      category: 'structure',
      gentle: ['bed', 'fan'],
      trap: ['rock', 'rope'], // r, short o; o_e
    },
  ],
}

/** A step's 8 words, in canon order. */
export function bigWordsOf(step: BigWordsStep): readonly string[] {
  return BIG_WORDS_STEPS[step].map((row) => row.word)
}

/**
 * `word`'s row in `step`, or undefined when `step` is not one of these
 * steps or has no such word. A problem of these steps carries its own
 * step's row (content wave 4 § 5, K4): sheep and shark are also sh-step
 * targets, whose matrix rows stay theirs.
 */
export function bigWordRowOf(
  step: string,
  word: string,
): BigWordRow | undefined {
  if (!(BIG_WORDS_STEP_IDS as readonly string[]).includes(step))
    return undefined
  return BIG_WORDS_STEPS[step as BigWordsStep].find((r) => r.word === word)
}
