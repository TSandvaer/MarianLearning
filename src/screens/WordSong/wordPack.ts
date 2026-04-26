/**
 * Short-a CVC picture pack for the Word Song screen v1.
 *
 * Spec sources of truth:
 *   - design/word-song-picture-pack.md (Kyle, merged) — canonical pack:
 *     14 target words + 8 distractor-only pictures, with the per-target
 *     distractor pairing matrix (gentle vs trap tier) and the
 *     forbidden-pair silhouette-similarity exclusions.
 *   - design/screen-4-word-song.md §"Distractor policy" — tier rule,
 *     constraint set, and the §"Audio integration contract" utterance ids.
 *   - design/research/phonics-sequence-marian.md — confirms short-a CVC as
 *     the right v1 surface.
 *
 * What lives here vs. wordDistractors.ts
 *   - This file is the static content layer: the word→picture map, the
 *     per-target distractor pairings, and the forbidden-pair list. Pure
 *     data, no logic.
 *   - `wordDistractors.ts` is the thin functional layer: `pickTier(N)` and
 *     `pickDistractors(target, N, pool)` that consume this data + Kyle's
 *     constraint set to emit the trio for a problem.
 *
 * Picture assets — placeholder posture
 *   - Real picture SVGs (per Kyle's pack `picture-{word}.svg`) are not yet
 *     authored — sourcing is deferred to Thomas (Open Q #1 in the
 *     picture-pack doc, defaults to Option A — commission once budget is
 *     approved).
 *   - For v1 ship, we render stylized inline-SVG placeholders via the
 *     `pictureKey` (see `wordPictures.tsx`). When real assets land they
 *     drop in at `/assets/pictures/picture-{key}.svg` and the renderer
 *     swaps to `<img src=...>` without touching this file.
 */

/** A picture-pack entry — target word OR distractor-only picture. */
export interface WordEntry {
  /** The word, lowercase, no punctuation. Identifier across the pack. */
  word: string
  /** Picture key — used by `wordPictures.tsx` to render the placeholder
   *  SVG and (when real assets land) to resolve `picture-{key}.svg`. */
  pictureKey: string
  /** Short-vowel sound. Target words are all 'a' (v1 scope). Distractor-
   *  only words carry their actual short-vowel for the trap-tier
   *  same-vowel/different-vowel discrimination check (spec §Distractor
   *  policy → Trap tier). */
  vowel: 'a' | 'o' | 'u' | 'i' | 'e'
  /** Coarse category — used by the gentle-tier filter. */
  category: WordCategory
  /** Whether this entry can appear as a target word. Distractor-only
   *  entries (like `bus`, `sun`) have `isTarget: false`. */
  isTarget: boolean
}

export type WordCategory =
  | 'animal'
  | 'vehicle'
  | 'celestial'
  | 'clothing'
  | 'household'
  | 'food'
  | 'kitchen'
  | 'stationery'
  | 'person'
  | 'object'
  | 'vessel'

/**
 * The 14 target words — all CVC short-a, in Marian's likely vocabulary.
 * Per `design/word-song-picture-pack.md` §"Per-word picture briefs".
 */
export const TARGET_WORDS: readonly WordEntry[] = [
  {
    word: 'cat',
    pictureKey: 'cat',
    vowel: 'a',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'hat',
    pictureKey: 'hat',
    vowel: 'a',
    category: 'clothing',
    isTarget: true,
  },
  {
    word: 'bat',
    pictureKey: 'bat',
    vowel: 'a',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'mat',
    pictureKey: 'mat',
    vowel: 'a',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'bag',
    pictureKey: 'bag',
    vowel: 'a',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'fan',
    pictureKey: 'fan',
    vowel: 'a',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'man',
    pictureKey: 'man',
    vowel: 'a',
    category: 'person',
    isTarget: true,
  },
  {
    word: 'pan',
    pictureKey: 'pan',
    vowel: 'a',
    category: 'kitchen',
    isTarget: true,
  },
  {
    word: 'cap',
    pictureKey: 'cap',
    vowel: 'a',
    category: 'clothing',
    isTarget: true,
  },
  {
    word: 'can',
    pictureKey: 'can',
    vowel: 'a',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'tag',
    pictureKey: 'tag',
    vowel: 'a',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'dad',
    pictureKey: 'dad',
    vowel: 'a',
    category: 'person',
    isTarget: true,
  },
  {
    word: 'jam',
    pictureKey: 'jam',
    vowel: 'a',
    category: 'food',
    isTarget: true,
  },
  {
    word: 'van',
    pictureKey: 'van',
    vowel: 'a',
    category: 'vehicle',
    isTarget: true,
  },
] as const

/**
 * The 8 distractor-only pictures — never appear as the target word, only
 * as the distractor chips. These have non-short-a vowels (per spec
 * §Distractor policy constraint #4 — distractor _words_ don't have to be
 * CVC short-a; what matters is their _picture_ is recognisable).
 */
export const DISTRACTOR_ONLY_WORDS: readonly WordEntry[] = [
  {
    word: 'bus',
    pictureKey: 'bus',
    vowel: 'u',
    category: 'vehicle',
    isTarget: false,
  },
  {
    word: 'sun',
    pictureKey: 'sun',
    vowel: 'u',
    category: 'celestial',
    isTarget: false,
  },
  {
    word: 'dog',
    pictureKey: 'dog',
    vowel: 'o',
    category: 'animal',
    isTarget: false,
  },
  {
    word: 'fox',
    pictureKey: 'fox',
    vowel: 'o',
    category: 'animal',
    isTarget: false,
  },
  {
    word: 'cup',
    pictureKey: 'cup',
    vowel: 'u',
    category: 'vessel',
    isTarget: false,
  },
  {
    word: 'pen',
    pictureKey: 'pen',
    vowel: 'e',
    category: 'stationery',
    isTarget: false,
  },
  {
    word: 'log',
    pictureKey: 'log',
    vowel: 'o',
    category: 'object',
    isTarget: false,
  },
  {
    word: 'pot',
    pictureKey: 'pot',
    vowel: 'o',
    category: 'kitchen',
    isTarget: false,
  },
] as const

/** All entries (targets + distractor-only), the full pool for distractor picking. */
export const ALL_WORDS: readonly WordEntry[] = [
  ...TARGET_WORDS,
  ...DISTRACTOR_ONLY_WORDS,
] as const

/**
 * Forbidden pairs — words whose pictures share a primary silhouette at
 * 96pt and therefore must not appear in the same trio. Per
 * `design/word-song-picture-pack.md` §"Distractor pairing matrix"
 * implementation hand-off note.
 *
 * Stored as an unordered-pair set: `{a, b}` matches in either direction.
 */
export const FORBIDDEN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['cat', 'dog'], // both four-legged animals in side profile
  ['bus', 'van'], // both vehicles in side view
  ['pan', 'pot'], // both cooking vessels in three-quarter view
  ['cap', 'hat'], // both head-coverings, similar mass at 96pt
  ['man', 'dad'], // both human figures
] as const

/** True if `a` and `b` are a forbidden silhouette-similar pair. */
export function isForbiddenPair(a: string, b: string): boolean {
  for (const [x, y] of FORBIDDEN_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return true
  }
  return false
}

/**
 * Per-target distractor pairings (gentle + trap tier) per Kyle's matrix.
 * Source of truth: `design/word-song-picture-pack.md` §"Distractor
 * pairing matrix (master table)".
 *
 * Storing as a typed map gives `wordDistractors.ts` a deterministic
 * lookup (no runtime computation, no random shuffles). Distractors are
 * always picked as a pair from the same tier — the matrix is the
 * pedagogical source of truth and we don't second-guess it.
 */
export interface TargetPairings {
  /** Problems 1-3 distractor pair. Both clearly different from target. */
  gentle: readonly [string, string]
  /** Problems 4-8 distractor pair. Both share at least one axis (rhyme,
   *  alliteration, vowel) with target. */
  trap: readonly [string, string]
}

export const TARGET_PAIRINGS: Readonly<Record<string, TargetPairings>> = {
  cat: { gentle: ['bus', 'sun'], trap: ['bat', 'cap'] },
  hat: { gentle: ['dog', 'cup'], trap: ['cat', 'bag'] },
  bat: { gentle: ['sun', 'cup'], trap: ['cat', 'hat'] },
  mat: { gentle: ['pen', 'dog'], trap: ['cat', 'man'] },
  bag: { gentle: ['bus', 'pen'], trap: ['tag', 'bat'] },
  fan: { gentle: ['dog', 'bus'], trap: ['man', 'pan'] },
  man: { gentle: ['cup', 'log'], trap: ['fan', 'pan'] },
  pan: { gentle: ['dog', 'pen'], trap: ['fan', 'man'] },
  cap: { gentle: ['dog', 'bus'], trap: ['cat', 'bag'] },
  can: { gentle: ['sun', 'dog'], trap: ['fan', 'man'] },
  tag: { gentle: ['pen', 'cup'], trap: ['bag', 'bat'] },
  dad: { gentle: ['bus', 'cup'], trap: ['bag', 'bat'] },
  jam: { gentle: ['bus', 'dog'], trap: ['bag', 'pan'] },
  van: { gentle: ['pen', 'cup'], trap: ['man', 'fan'] },
} as const

/** Look up a word entry by word string. Throws on missing — every word in
 *  the pack matrix must resolve. */
export function getWordEntry(word: string): WordEntry {
  for (const entry of ALL_WORDS) {
    if (entry.word === word) return entry
  }
  throw new Error(
    `[wordPack] No entry for word "${word}" — must be in TARGET_WORDS or DISTRACTOR_ONLY_WORDS`,
  )
}
