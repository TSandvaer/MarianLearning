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
  /** Short-vowel sound. v1 targets were all 'a'; v2 adds 'o' (short-o
   *  sibling tier — see `design/word-song/short-o-pool-expansion.md`).
   *  Distractor-only words carry their actual short-vowel for the
   *  trap-tier same-vowel/different-vowel discrimination check (spec
   *  §Distractor policy → Trap tier). */
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
  // ── Novel-pool probe words (ticket 86c9m3aec) ──────────────────────
  // These four short-a CVC words are NOT part of the canonical 14-word
  // pack — they are emitted ONLY by the planner on a graduation-session
  // run (`isGraduationSession=true` in the request). The mastery
  // engine reads novel-pool accuracy as a second gate on cvc-words
  // promotion (`NOVEL_POOL_THRESHOLD = 0.80`).
  //
  // Picture chips fall back to silhouette placeholders rendered by
  // `wordPictures.tsx` for v1 (per the ticket recommendation: "ship
  // with silhouettes and file a follow-up Kyle ticket"). Real
  // illustrations are blocked on the probe-word picture-pack ticket
  // Kyle owns; the silhouette path is the same path the canonical
  // pack used pre-Phase-3 Midjourney pipeline.
  //
  // The static `STATIC_WORD_SONG_PLANS` rotation in `wordSessionPlans`
  // does NOT pick from these — only the live planner can route a
  // novel word into a chip render, and only when the graduation flag
  // is set. The Hub's local fallback path stays canonical-only.
  {
    word: 'nap',
    pictureKey: 'nap',
    vowel: 'a',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'rat',
    pictureKey: 'rat',
    vowel: 'a',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'map',
    pictureKey: 'map',
    vowel: 'a',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'tap',
    pictureKey: 'tap',
    vowel: 'a',
    category: 'household',
    isTarget: true,
  },
  // ── Short-o pool (ticket 86c9m3ae3, v2 vowel tier) ──────────────────
  // Per `design/word-song/short-o-pool-expansion.md` §1 with Thomas's
  // 2026-05-04 lock: 8 short-o words drawn from a mix of promoted v1
  // distractors (`dog, log, pot, fox`) + 4 wholly new entries
  // (`mop, box, mom, hot`). Pool reaches Marian only when the planner
  // emits content for `cvc-words-short-o` (the sibling node added to
  // `WordSongNode` / `LITERACY_TREE` between `cvc-words` and
  // `digraphs`); short-a sessions continue to draw from the canonical
  // 14-word pool above and short-o words don't leak into them
  // (planner-side guarantee — see `WORD_SONG_TRACK_GUIDE` in
  // `api/_planner.ts`).
  //
  // The 4 promoted entries USED to live in `DISTRACTOR_ONLY_WORDS`
  // (see git blame). They retain their distractor pictures
  // (`pic-{key}.svg` placeholder until Kyle's Midjourney trace
  // ships) — `getWordEntry()` reads whichever array carries them, so
  // the v1 short-a `TARGET_PAIRINGS` rows that point to `dog`/`log`/
  // `pot`/`fox` continue to resolve unchanged.
  //
  // Picture-pack note: `mop, box, mom, hot` fall back to silhouettes
  // in `wordPictures.tsx` for v1 (per the dispatch brief — real
  // Midjourney → SVG illustrations land in a separate Kyle ticket).
  {
    word: 'dog',
    pictureKey: 'dog',
    vowel: 'o',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'mop',
    pictureKey: 'mop',
    vowel: 'o',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'log',
    pictureKey: 'log',
    vowel: 'o',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'pot',
    pictureKey: 'pot',
    vowel: 'o',
    category: 'kitchen',
    isTarget: true,
  },
  {
    word: 'box',
    pictureKey: 'box',
    vowel: 'o',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'fox',
    pictureKey: 'fox',
    vowel: 'o',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'mom',
    pictureKey: 'mom',
    vowel: 'o',
    category: 'person',
    isTarget: true,
  },
  {
    word: 'hot',
    pictureKey: 'hot',
    vowel: 'o',
    category: 'object',
    isTarget: true,
  },
] as const

/**
 * The distractor-only pictures — never appear as the target word, only
 * as the distractor chips. These carry non-short-a vowels (per spec
 * §Distractor policy constraint #4 — distractor _words_ don't have to be
 * CVC short-a; what matters is their _picture_ is recognisable).
 *
 * v2 note (ticket 86c9m3ae3, short-o pool expansion): four entries —
 * `dog, log, pot, fox` — moved out of this array into `TARGET_WORDS`
 * with `isTarget: true`. They still appear here in spirit because the
 * v1 short-a `TARGET_PAIRINGS` rows reference them as gentle-tier
 * distractors; `getWordEntry()` resolves them from `TARGET_WORDS` now,
 * so the matrix continues to work unchanged. The "DISTRACTOR_ONLY"
 * label still holds — these 4 pictures cannot serve as the right
 * answer in a short-a session (`WORD_SONG_TARGET_WORDS_FOR_PROMPT`
 * doesn't list them) and the planner's pool-by-focus-node split keeps
 * short-a + short-o sessions from cross-pollinating.
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
  // Short-o pool additions (ticket 86c9m3ae3) — composition collisions:
  ['mom', 'dad'], // parent-with-child compositions; differ on hair/outfit
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
  // ── Novel-pool probes (ticket 86c9m3aec) ──────────────────────────
  // Distractor pairs use existing canonical/distractor pictures so the
  // chip render works without new picture assets. Trap-tier pairs lean
  // on rhyme/alliteration with the novel target where pedagogically
  // apt; gentle-tier pairs use clearly-different distractor-only
  // pictures. Forbidden-pair audit verified against
  // `FORBIDDEN_PAIRS` above (cat-dog, bus-van, pan-pot, cap-hat,
  // man-dad) — none of the pairs below trigger.
  //
  // The novel words can land in ANY problem index 1-8 per the
  // graduation directive in `_planner.ts`, so each gets BOTH a
  // gentle-tier pair (for problems 1-3) and a trap-tier pair (for
  // problems 4-8). The runtime tier-from-index logic in
  // `pickDistractors` reads `wordDistractors.pickTier(problemIndex)`
  // — the same path the canonical pack uses.
  nap: { gentle: ['bus', 'sun'], trap: ['fan', 'pan'] }, // /æn/ trap
  rat: { gentle: ['bus', 'cup'], trap: ['bat', 'mat'] }, // /æt/ trap
  map: { gentle: ['dog', 'sun'], trap: ['cap', 'mat'] }, // /æp/ + /æt/ trap
  tap: { gentle: ['dog', 'cup'], trap: ['cap', 'pan'] }, // /æp/ + /p/-alliteration
  // ── Short-o pool (ticket 86c9m3ae3) ───────────────────────────────
  // Per `design/word-song/short-o-pool-expansion.md` §8: same-vowel
  // only — every distractor for a short-o target is drawn from the
  // short-o pool itself (`dog, mop, log, pot, box, fox, mom, hot`).
  // No cross-vowel mixing in v1; that's a separate downstream ticket
  // (Dave §6 P2). Trap-tier pairs lean on /ɒ/ rhyme or alliteration
  // with the target where one exists; gentle-tier pairs are visually
  // / categorically distinct (animal vs. object vs. person).
  //
  // FORBIDDEN_PAIRS audit — none of the pairs below trigger. The new
  // mom-dad pair added in this ticket is intra-cross-vowel (`dad` is
  // short-a, not in this pool), so it never surfaces in a short-o
  // trio. The other existing forbidden pairs (cat-dog, bus-van,
  // pan-pot, cap-hat, man-dad) are all cross-vowel from a short-o
  // target's perspective.
  dog: { gentle: ['box', 'hot'], trap: ['log', 'fox'] }, // /ɒg/ rhyme + animal trap
  mop: { gentle: ['dog', 'fox'], trap: ['mom', 'hot'] }, // m-alliteration + /ɒ/ vowel trap
  log: { gentle: ['box', 'mom'], trap: ['dog', 'fox'] }, // /ɒg/ rhyme + animal trap
  pot: { gentle: ['dog', 'mom'], trap: ['hot', 'mop'] }, // /ɒt/ rhyme + p-/m- alliteration trap
  box: { gentle: ['mom', 'hot'], trap: ['fox', 'log'] }, // /ɒks/ rhyme trap
  fox: { gentle: ['pot', 'mom'], trap: ['box', 'dog'] }, // /ɒks/ rhyme + animal trap
  mom: { gentle: ['box', 'hot'], trap: ['mop', 'log'] }, // m-alliteration + /ɒ/ vowel trap
  hot: { gentle: ['dog', 'fox'], trap: ['pot', 'mop'] }, // /ɒt/ rhyme + p-/m- alliteration trap
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
