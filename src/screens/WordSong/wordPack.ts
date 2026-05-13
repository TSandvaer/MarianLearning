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
  // ── Short-o pool extension (ticket 86c9teu2e, v2 pool extension) ────
  // Per `design/word-song/short-o-pool-extension.md` §3 with Thomas's
  // 2026-05-09 lock (Q1=A, Q2=A): 3 wholly-new short-o words extending
  // the v1 8-word pool to 11 entries, matching short-u parity and
  // unblocking the cross-vowel mode pool-size floor (≥ 11 per
  // `cross-vowel-mix-spec.md` §6). All three add new rhyme partners:
  //   - cot — /ɒt/ rhyme triplet completion (pot, hot, cot)
  //   - top — /ɒp/ rhyme expansion (mop, top)
  //   - pop — /ɒp/ rhyme triplet completion (mop, top, pop)
  //
  // Picture pack ships in Devon's parallel ticket 86c9teu03 (Phase 3
  // PNG-in-SVG embed via `yarn embed-pictures`). Until that lands the
  // chips fall back to the unknown-key silhouette in `wordPictures.tsx`
  // (rounded rectangle + word text) — graceful, not crashing.
  //
  // Same-vowel-only distractor rule (spec §8) preserved: every
  // distractor for a short-o target is drawn from the now-11-word
  // short-o pool itself. Cross-vowel matrix is intentionally NOT
  // widened here — that's a separate downstream ticket (86c9m3aek);
  // the cross-vowel exhaustiveness test in `wordDistractors.test.ts`
  // is scoped to exclude these 3 extension words via the same
  // `POOL_EXTENSION_PENDING_CROSSVOWEL` exclusion pattern used for
  // probes.
  {
    word: 'cot',
    pictureKey: 'cot',
    vowel: 'o',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'top',
    pictureKey: 'top',
    vowel: 'o',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'pop',
    pictureKey: 'pop',
    vowel: 'o',
    category: 'food',
    isTarget: true,
  },
  // ── Short-u pool (ticket 86c9q5q2d / 86c9q9ben, v3 vowel tier) ──────
  // Per `design/word-song/short-u-pool-expansion.md` §1 with Thomas's
  // 2026-05-09 lock (Q1=A): 11 short-u target words spanning seven
  // rhyme families (/ʌn/, /ʌp/, /ʌs/, /ʌg/, /ʌt/, /ʌb/, /ʌm/). Pool
  // reaches Marian only when the planner emits content for
  // `cvc-words-short-u` (the next-vowel sibling node added between
  // `cvc-words-short-o` and `digraphs` in WordSongNode / LITERACY_TREE).
  // Short-a / short-o sessions continue to draw from their own pools and
  // short-u words don't leak into them (planner-side guarantee — see
  // `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts`).
  //
  // Three of the entries (`sun, cup, bus`) USED to live in
  // `DISTRACTOR_ONLY_WORDS` (see git blame); per Q2=A (2026-05-09) they
  // are promoted target → distractor with `isTarget: true` flipped on.
  // They retain their distractor pictures (re-traced in Phase 3 of the
  // short-u pack — see `design/word-song/short-u-pool-expansion.md`
  // §3 Q2 lock). They remain pickable as distractors in short-a /
  // short-o sessions (the two flags are independent) — same precedent
  // as the short-o promotions of `dog, log, pot, fox`.
  //
  // Same-vowel-only rule (spec §8): every distractor for a short-u
  // target is drawn from the short-u pool itself. No cross-vowel mixing
  // in v1 — that's a separate downstream ticket (`86c9m3aek`).
  {
    word: 'sun',
    pictureKey: 'sun',
    vowel: 'u',
    category: 'celestial',
    isTarget: true,
  },
  {
    word: 'cup',
    pictureKey: 'cup',
    vowel: 'u',
    category: 'vessel',
    isTarget: true,
  },
  {
    word: 'bus',
    pictureKey: 'bus',
    vowel: 'u',
    category: 'vehicle',
    isTarget: true,
  },
  {
    word: 'bug',
    pictureKey: 'bug',
    vowel: 'u',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'nut',
    pictureKey: 'nut',
    vowel: 'u',
    category: 'food',
    isTarget: true,
  },
  {
    word: 'tub',
    pictureKey: 'tub',
    vowel: 'u',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'bun',
    pictureKey: 'bun',
    vowel: 'u',
    category: 'food',
    isTarget: true,
  },
  {
    word: 'jug',
    pictureKey: 'jug',
    vowel: 'u',
    category: 'vessel',
    isTarget: true,
  },
  {
    word: 'rug',
    pictureKey: 'rug',
    vowel: 'u',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'hut',
    pictureKey: 'hut',
    vowel: 'u',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'gum',
    pictureKey: 'gum',
    vowel: 'u',
    category: 'food',
    isTarget: true,
  },
  // ── Short-i pool (ticket 86c9qdba4, v4 vowel tier) ─────────────────
  // Per `design/word-song/short-i-pool-expansion.md` §1 with Thomas's
  // 2026-05-09 lock (Q1=A — recommended 11-word pool with Phase-2
  // fallbacks). Phase-2 voluntary drop: hip + rim removed for vocab
  // unfamiliarity (rosehip + bicycle wheel rim were both Phase-2-flagged
  // for picture-stability + vocab risk in the spec audit). Final ship
  // pool is **8 words** spanning four rhyme families (`/ɪg/`, `/ɪn/`,
  // `/ɪb/`, `/ɪd/`) plus a singleton `/ɪp/` (sip). Pool reaches Marian
  // only when the planner emits content for `cvc-words-short-i` (the
  // fourth-vowel sibling node added between `cvc-words-short-u` and
  // `digraphs` in WordSongNode / LITERACY_TREE). Short-a / short-o /
  // short-u sessions continue to draw from their own pools and short-i
  // words don't leak into them (planner-side guarantee — see
  // `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts`).
  //
  // All 8 entries are wholly-new — none re-purposes an existing
  // distractor or canonical-pack picture (verified against pre-86c9qdba4
  // `TARGET_WORDS` + `DISTRACTOR_ONLY_WORDS`). PNG-in-SVG embed via
  // `yarn embed-pictures` shipped in PR #188 (ticket 86c9qdb95).
  //
  // Same-vowel-only rule (spec §8): every distractor for a short-i
  // target is drawn from the short-i pool itself. No cross-vowel mixing
  // in v1 — that's a separate downstream ticket (`86c9m3aek`). The
  // `crossVowelMixingActive` predicate gate at `mastery.ts
  // CVC_CROSS_VOWEL_NODES` is intentionally NOT widened to include
  // `cvc-words-short-i` in this PR — adding short-i to that set would
  // require corresponding `TARGET_PAIRINGS_CROSSVOWEL` rows for every
  // short-i target, which is out of scope per the dispatch contract
  // (cross-vowel matrix updates separately ticketed).
  {
    word: 'pig',
    pictureKey: 'pig',
    vowel: 'i',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'pin',
    pictureKey: 'pin',
    vowel: 'i',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'bin',
    pictureKey: 'bin',
    vowel: 'i',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'wig',
    pictureKey: 'wig',
    vowel: 'i',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'bib',
    pictureKey: 'bib',
    vowel: 'i',
    category: 'clothing',
    isTarget: true,
  },
  {
    word: 'fig',
    pictureKey: 'fig',
    vowel: 'i',
    category: 'food',
    isTarget: true,
  },
  {
    word: 'lid',
    pictureKey: 'lid',
    vowel: 'i',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'sip',
    pictureKey: 'sip',
    vowel: 'i',
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
 * with `isTarget: true`. They still appear in spirit because the
 * v1 short-a `TARGET_PAIRINGS` rows reference them as gentle-tier
 * distractors; `getWordEntry()` resolves them from `TARGET_WORDS` now,
 * so the matrix continues to work unchanged. The "DISTRACTOR_ONLY"
 * label still holds — these pictures cannot serve as the right answer
 * in a short-a session (`WORD_SONG_TARGET_WORDS_FOR_PROMPT` doesn't
 * list them) and the planner's pool-by-focus-node split keeps the
 * vowel tiers from cross-pollinating.
 *
 * v3 note (ticket 86c9q5q2d / 86c9q9ben, short-u pool expansion):
 * three more entries — `sun, cup, bus` — were promoted distractor →
 * target by Thomas's 2026-05-09 Q2=A lock. They now live in
 * `TARGET_WORDS` with `isTarget: true` and `vowel: 'u'`. They remain
 * pickable as distractors in short-a / short-o sessions because
 * `getWordEntry()` resolves them from `TARGET_WORDS` and the existing
 * `TARGET_PAIRINGS` rows for short-a (e.g. `cat: { gentle: ['bus',
 * 'sun'], … }`) point at them by string — same shape as the short-o
 * promotion handled `dog/log/pot/fox`.
 *
 * v4 note (ticket 86c9qdba4, short-i pool expansion): no further
 * distractor-only promotions. All 8 short-i entries (`pig, pin, bin,
 * wig, bib, fig, lid, sip`) are wholly-new in `TARGET_WORDS` — short-i
 * had no existing distractor-only candidates per spec §1 audit
 * (verbs/digraphs/picture-instability dominated the rejected pool).
 * `pen` (short-e) remains the only distractor-only entry today.
 */
export const DISTRACTOR_ONLY_WORDS: readonly WordEntry[] = [
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
  // Short-u pool additions (ticket 86c9q5q2d / 86c9q9ben, §3 / §10 Q3
  // LOCKED 2026-05-08 per Devon's review). The same-vowel-only rule
  // (spec §8) keeps both pairs from co-occurring in v1 trios anyway,
  // but the entries are cheap insurance against future cross-vowel
  // mixing (ticket 86c9m3aek) and against a Phase-2 picture-pack
  // review showing the discriminators don't hold at 96pt.
  ['rug', 'mat'], // flat-rectangular floor coverings (rug fringed, mat plain)
  ['tub', 'cup'], // vessels in side profile (tub footed, cup handled)
  // Short-i pool additions (ticket 86c9qdba4, §3 / §10 Q2 LOCKED 2026-05-09).
  // Same posture as the short-u additions: same-vowel-only rule (spec §8)
  // keeps these pairs from co-occurring in v1 trios anyway, but the entries
  // are cheap insurance against future cross-vowel mixing (ticket
  // 86c9m3aek) — when cross-vowel fires across all four CVC tiers, a
  // short-i target landing alongside a short-a/short-o distractor must
  // not collide on silhouette. Per Kyle's spec §3, only `[fig, bun]` is
  // mandatory for the 8-word ship; `[pig, dog]` and `[pig, cat]` are
  // recommended forward-looking insurance against animal-pack collision.
  // The conditional `[lid, mat]` from spec §3 is INTENTIONALLY OMITTED —
  // `lid` shipped as oval (not rectangular) per spec §2.7 + Phase 2 PR
  // #188's actual asset, and the conditional only applied to the
  // rectangular rendering. If a future re-trace ships a rectangular `lid`,
  // add the pair then.
  ['fig', 'bun'], // both round food with top-feature (stem-cap vs score-mark)
  ['pig', 'dog'], // both four-legged mammals; snout/curly-tail vs ears/non-curly-tail
  ['pig', 'cat'], // both four-legged animals; snout/curly-tail vs whiskers/pointed-ears
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
  // ── Short-o pool extension (ticket 86c9teu2e) ─────────────────────
  // Per `design/word-song/short-o-pool-extension.md` §5: same-vowel
  // only — every distractor for the 3 new short-o targets is drawn
  // from the 11-word short-o pool. Trap-tier pairs lean on the new
  // rhyme triplets emerging from the extension:
  //   - /ɒt/ triplet (pot, hot, cot) → cot's trap is its rhyme cluster
  //   - /ɒp/ triplet (mop, top, pop) → top's and pop's trap is theirs
  // Gentle-tier pairs cross category (object ↔ animal ↔ person ↔
  // household) to keep the gentle-tier "clearly different" gate honest.
  //
  // FORBIDDEN_PAIRS audit — none of the rows below trigger. The new
  // entries are not involved in any existing forbidden pair (cat-dog,
  // bus-van, pan-pot, cap-hat, man-dad, mom-dad, rug-mat, tub-cup,
  // fig-bun, pig-dog, pig-cat); none of those pairs surfaces in a
  // short-o trio under the same-vowel-only rule either.
  cot: { gentle: ['box', 'fox'], trap: ['pot', 'hot'] }, // /ɒt/ rhyme triplet trap (cot/pot/hot)
  top: { gentle: ['dog', 'mom'], trap: ['mop', 'pop'] }, // /ɒp/ rhyme triplet trap (top/mop/pop)
  pop: { gentle: ['fox', 'log'], trap: ['mop', 'top'] }, // /ɒp/ rhyme triplet trap (pop/mop/top)
  // ── Short-u pool (ticket 86c9q5q2d / 86c9q9ben) ────────────────────
  // Per `design/word-song/short-u-pool-expansion.md` §2.4 matrix
  // preview + §8 same-vowel-only rule: every distractor for a short-u
  // target is drawn from the short-u pool itself (`sun, cup, bus, bug,
  // nut, tub, bun, jug, rug, hut, gum`). No cross-vowel mixing in v1;
  // that's a separate ticket (`86c9m3aek`).
  //
  // Trap-tier pairs lean on the rhyme families enumerated in spec §1
  // (`/ʌn/`, `/ʌp/`, `/ʌs/`, `/ʌg/`, `/ʌt/`, `/ʌb/`, `/ʌm/`); the
  // /ʌg/ triplet (bug/jug/rug) is the densest cluster and is
  // intentionally exploited as the trap-tier pair when one of the
  // three is the target. Gentle-tier pairs are visually /
  // categorically distinct from the target (object vs. food vs.
  // vehicle vs. animal).
  //
  // FORBIDDEN_PAIRS audit — none of the rows below trigger.
  //   - `[tub, cup]`: `tub` row's trap is `['bug', 'jug']` and `cup`'s
  //     trap is `['nut', 'jug']`; neither row co-pairs them.
  //   - `[rug, mat]`: `mat` is short-a — the same-vowel rule keeps it
  //     out of any short-u trio.
  //   - all other existing forbidden pairs (cat-dog, bus-van, pan-pot,
  //     cap-hat, man-dad, mom-dad) involve at least one non-short-u
  //     word and so are unreachable here.
  sun: { gentle: ['hut', 'rug'], trap: ['bun', 'jug'] }, // /ʌn/ rhyme + cross-category
  cup: { gentle: ['bug', 'rug'], trap: ['nut', 'jug'] }, // vessel trap (jug); tub excluded per [tub,cup] FORBIDDEN_PAIR
  bus: { gentle: ['nut', 'sun'], trap: ['hut', 'bug'] }, // /ʌs/ has no rhyme partner; near-miss /ʌt/ + /ʌg/ trap
  bug: { gentle: ['tub', 'sun'], trap: ['jug', 'rug'] }, // /ʌg/ rhyme triplet trap
  nut: { gentle: ['rug', 'cup'], trap: ['hut', 'bun'] }, // /ʌt/ rhyme + /ʌn/ near-miss
  tub: { gentle: ['hut', 'sun'], trap: ['bug', 'jug'] }, // vessel/vowel trap; cup excluded per [tub,cup] FORBIDDEN_PAIR
  bun: { gentle: ['rug', 'tub'], trap: ['sun', 'gum'] }, // /ʌn/ rhyme + /ʌm/ near-miss
  jug: { gentle: ['nut', 'sun'], trap: ['bug', 'rug'] }, // /ʌg/ rhyme triplet trap
  rug: { gentle: ['cup', 'sun'], trap: ['bug', 'jug'] }, // /ʌg/ rhyme triplet trap (mat is FORBIDDEN_PAIR + cross-vowel)
  hut: { gentle: ['cup', 'sun'], trap: ['nut', 'bun'] }, // /ʌt/ rhyme + /ʌn/ near-miss
  gum: { gentle: ['bug', 'rug'], trap: ['bun', 'sun'] }, // /ʌm/ has no in-pool rhyme partner; /ʌn/ near-miss
  // ── Short-i pool (ticket 86c9qdba4) ─────────────────────────────────
  // Per `design/word-song/short-i-pool-expansion.md` §2.1 matrix preview
  // + §8 same-vowel-only rule: every distractor for a short-i target is
  // drawn from the short-i pool itself (`pig, pin, bin, wig, bib, fig,
  // lid, sip`). No cross-vowel mixing in v1; that's a separate ticket
  // (`86c9m3aek`).
  //
  // Phase-2 voluntary drop: Thomas dropped `hip` and `rim` from the
  // 11-word recommended pool for vocab unfamiliarity (rosehip + bicycle
  // wheel rim were both Phase-2-flagged for picture-stability). The
  // matrix below is the spec preview matrix MINUS `hip`/`rim` references
  // — wherever the spec preview used `hip` or `rim` as a distractor, a
  // pool-internal substitute was chosen following the same rhyme/category
  // logic. Specifically:
  //  - `bib` trap was `['hip', 'wig']` (clothing/fabric trap with hip).
  //    Replaced with `['pig', 'wig']` — pig/bib share /b/ onset (bib) +
  //    /p/ onset (pig); /-ib/ + /-ig/ near-coda. Same-tier insurance.
  //  - `lid` trap was `['bin', 'rim']` (container-top + metal-near-miss).
  //    Replaced with `['bin', 'sip']` — keeps the bin container trap, and
  //    sip is /-ip/ near-/-id/ coda (alveolar stop variation).
  //  - `sip` gentle was `['fig', 'wig']`, trap was `['hip', 'rim']`.
  //    Trap replaced with `['pin', 'lid']` — without an in-pool /ɪp/
  //    rhyme partner (hip dropped), the trap leans on minimal-pair-ish
  //    coda contrast.
  //
  // Trap-tier pairs lean on the rhyme families enumerated in spec §1
  // (`/ɪg/`, `/ɪn/`, `/ɪb/`, `/ɪd/`, `/ɪp/`); the /ɪg/ triplet
  // (pig/wig/fig) is the densest cluster and is intentionally exploited
  // as the trap-tier pair when one of the three is the target. Gentle-
  // tier pairs are visually / categorically distinct from the target
  // (animal vs. household vs. food vs. clothing).
  //
  // FORBIDDEN_PAIRS audit — none of the rows below trigger:
  //  - new short-i additions `[fig, bun]`, `[pig, dog]`, `[pig, cat]`
  //    are all cross-vowel — same-vowel-only rule keeps them apart.
  //  - all existing forbidden pairs (cat-dog, bus-van, pan-pot, cap-hat,
  //    man-dad, mom-dad, rug-mat, tub-cup) involve at least one
  //    non-short-i word and so are unreachable here.
  pig: { gentle: ['lid', 'bin'], trap: ['wig', 'fig'] }, // /ɪg/ rhyme triplet trap
  pin: { gentle: ['fig', 'bib'], trap: ['bin', 'wig'] }, // /ɪn/ rhyme + /ɪg/ near-miss
  bin: { gentle: ['fig', 'pig'], trap: ['pin', 'lid'] }, // /ɪn/ rhyme + container trap (bin/lid)
  wig: { gentle: ['bib', 'pin'], trap: ['pig', 'fig'] }, // /ɪg/ rhyme triplet trap
  bib: { gentle: ['lid', 'pin'], trap: ['pig', 'wig'] }, // /ɪb/ has no in-pool rhyme; /b/-onset (bib/pig) + /-ig/-near-/-ib/-coda
  fig: { gentle: ['lid', 'bin'], trap: ['pig', 'wig'] }, // /ɪg/ rhyme triplet trap
  lid: { gentle: ['wig', 'pig'], trap: ['bin', 'sip'] }, // /ɪd/ has no in-pool rhyme; container/coda trap
  sip: { gentle: ['fig', 'wig'], trap: ['pin', 'lid'] }, // /ɪp/ singleton (hip dropped); coda-contrast trap
} as const

/**
 * Cross-vowel distractor matrix (ticket 86c9qa0kf — cross-vowel mix v1
 * impl). Active when `crossVowelMixingActive(progress, parentSettings)`
 * returns `true` AND the focus is one of the three CVC tiers.
 *
 * Source-of-truth: `design/word-song/cross-vowel-mix-spec.md` §4
 * (constraints) + Dave's research at
 * `design/research/cross-vowel-discrimination-threshold.md` §3
 * (predicate-shape pin).
 *
 * Each row carries a `gentle` pair (problems 1-3) + a `trap` pair
 * (problems 4-8) for one target across the three CVC tiers (14 short-a
 * canonical + 8 short-o + 11 short-u = 33 rows). The 4 short-a
 * novel-pool probes (`nap, rat, map, tap`) are EXCLUDED — they remain
 * graduation-session-only emit-paths (per spec §4 rule 4 +
 * `cvc-words-developmental-review.md`); accidentally surfacing them as
 * cross-vowel distractors would break their generalization-probe-only
 * invariant.
 *
 * Authoring constraints (each row honours all five):
 *
 *   1. **Vowel-mix preference** — each row's two distractors should
 *      EACH carry a *different* vowel from the target. Trap-tier
 *      prefers a vowel-contrast pair (e.g. `[short-o, short-u]` for a
 *      short-a target) because that maximises discriminative pressure
 *      on Marian's reading of the vowel as a load-bearing decoding
 *      dimension. Where the matrix author can hit a clean cross-vowel
 *      minimal triplet (`hat / hot / hut`, `bag / dog / bug`), they do
 *      — those are the textbook 3-vowel discrimination drills.
 *   2. **FORBIDDEN_PAIRS** — honoured strictly. The 8 existing entries
 *      cover all hard collisions; the 3 borderline pairs flagged by
 *      spec §5 (`[cat, fox]`, `[mom, man]`, `[pot, tub]`) are
 *      matrix-author-avoided per the spec note.
 *   3. **Distinctness** — `target ≠ d1 ≠ d2`.
 *   4. **Picture availability** — every word here resolves via
 *      `getWordEntry()` (33-word effective pool). Probe words excluded.
 *   5. **Category-spread for gentle** — gentle-tier distractors are
 *      clearly different from target on category + onset axes; the
 *      cross-vowel difference replaces the same-vowel "different vowel
 *      sound" axis automatically. Trap-tier may share category or
 *      onset since the vowel difference is the load.
 *
 * Spec §4 example rows used as templates: `hat`, `dog`, `sun` — see
 * the spec for the full tradeoff discussion (especially `sun`'s case
 * where `/ʌn/` rhyme doesn't extend to short-o in the v1 pool).
 *
 * Pool-size-floor caveat (spec §6): short-o pool is 8 entries (under
 * the spec's "≥11" floor); short-o targets pull from 7 same-tier
 * candidates if a same-tier distractor is needed. Cross-vowel firing
 * with an 8-word short-o pool is graceful degradation, not a bug —
 * Dave's research §3 supports this. Kyle's short-o expansion ticket is
 * in flight; the matrix below works regardless of whether/when that
 * lands.
 */
export const TARGET_PAIRINGS_CROSSVOWEL: Readonly<
  Record<string, TargetPairings>
> = {
  // ── Short-a targets (cross-vowel distractors from short-o + short-u) ──
  // Trap-tier prefers cross-three-vowel rhyme triplets where the pack
  // supports them (hat/hot/hut for /-t/-coda; bag/dog/bug for /-g/-coda;
  // man/mom/bun for human-or-food /m-/-onset).
  cat: { gentle: ['log', 'cup'], trap: ['hot', 'nut'] }, // /-t/ coda + cross-vowel; [cat,dog] FORBIDDEN, [cat,fox] avoided per spec §5
  hat: { gentle: ['log', 'bug'], trap: ['hot', 'hut'] }, // textbook hat/hot/hut minimal triplet (spec §4 example 1)
  bat: { gentle: ['mom', 'cup'], trap: ['hot', 'hut'] }, // /-t/ coda cross-vowel (avoid [bat,rat] probe)
  mat: { gentle: ['fox', 'jug'], trap: ['hot', 'nut'] }, // /-t/ coda + cross-vowel; [rug,mat] FORBIDDEN
  bag: { gentle: ['mom', 'sun'], trap: ['dog', 'bug'] }, // textbook bag/dog/bug minimal triplet (/-g/ coda)
  fan: { gentle: ['box', 'tub'], trap: ['sun', 'bun'] }, // /-n/ coda cross-vowel
  man: { gentle: ['box', 'jug'], trap: ['sun', 'bun'] }, // /-n/ coda; [man,dad]/[mom,man] FORBIDDEN/avoided
  pan: { gentle: ['mom', 'sun'], trap: ['mop', 'cup'] }, // /p-/ alliteration cross-vowel; [pan,pot] FORBIDDEN
  cap: { gentle: ['log', 'bug'], trap: ['mop', 'cup'] }, // /-p/ coda cross-vowel; [cap,hat] FORBIDDEN
  can: { gentle: ['fox', 'rug'], trap: ['sun', 'bun'] }, // /-n/ coda cross-vowel
  tag: { gentle: ['mom', 'cup'], trap: ['dog', 'bug'] }, // /-g/ coda cross-vowel
  dad: { gentle: ['box', 'sun'], trap: ['hot', 'gum'] }, // [man,dad]/[mom,dad] FORBIDDEN — keep both distractors cross-vowel
  jam: { gentle: ['log', 'bus'], trap: ['mom', 'gum'] }, // /-m/ coda cross-vowel
  van: { gentle: ['mom', 'rug'], trap: ['fox', 'sun'] }, // /-n/ coda; [bus,van] FORBIDDEN
  // ── Short-o targets (cross-vowel distractors from short-a + short-u) ──
  // Trap-tier prefers cross-vowel rhyme bridges where the pack offers
  // them; gentle-tier reaches across category + vowel.
  dog: { gentle: ['hat', 'cup'], trap: ['bag', 'bug'] }, // textbook bag/dog/bug minimal triplet; [cat,dog] FORBIDDEN
  mop: { gentle: ['cat', 'sun'], trap: ['cap', 'cup'] }, // /-p/ coda cross-vowel
  log: { gentle: ['cat', 'cup'], trap: ['bag', 'bug'] }, // /-g/ coda cross-vowel rhyme bridge
  pot: { gentle: ['cat', 'sun'], trap: ['hat', 'nut'] }, // /-t/ coda cross-vowel; [pan,pot] FORBIDDEN, [pot,tub] avoided
  box: { gentle: ['cat', 'cup'], trap: ['bag', 'bug'] }, // /-g/-ish-coda fallback (no clean /-ks/ cross-vowel partner in pool)
  fox: { gentle: ['hat', 'sun'], trap: ['bag', 'bug'] }, // /-g/-ish-coda fallback; [cat,fox] avoided
  mom: { gentle: ['cat', 'cup'], trap: ['jam', 'gum'] }, // /-m/ coda cross-vowel; [mom,dad]/[mom,man] FORBIDDEN/avoided
  hot: { gentle: ['cat', 'sun'], trap: ['hat', 'hut'] }, // textbook hat/hot/hut minimal triplet
  // ── Short-u targets (cross-vowel distractors from short-a + short-o) ──
  // /ʌn/ has no short-o partner (con/son not in pack); /ʌm/ has only
  // mom; /ʌg/ bridges to short-a `bag` and short-o `dog`. Author leans
  // on what the pack offers, prefers minimal triplets where they exist.
  sun: { gentle: ['cat', 'mom'], trap: ['fan', 'man'] }, // /-n/ coda cross-vowel (mom is /-m/ but onset-share, gentle-tier OK)
  cup: { gentle: ['cat', 'mom'], trap: ['cap', 'mop'] }, // /-p/ coda cross-vowel; [tub,cup] FORBIDDEN
  bus: { gentle: ['cat', 'mom'], trap: ['bag', 'box'] }, // /b-/ alliteration cross-vowel; [bus,van] FORBIDDEN
  bug: { gentle: ['hat', 'mom'], trap: ['bag', 'dog'] }, // textbook bag/dog/bug minimal triplet
  nut: { gentle: ['mom', 'cat'], trap: ['hat', 'hot'] }, // /-t/ coda cross-vowel
  tub: { gentle: ['cat', 'mom'], trap: ['bag', 'dog'] }, // /-g/-ish coda fallback; [tub,cup]/[pot,tub] FORBIDDEN/avoided
  bun: { gentle: ['cat', 'mom'], trap: ['fan', 'man'] }, // /-n/ coda cross-vowel
  jug: { gentle: ['hat', 'mom'], trap: ['bag', 'dog'] }, // /-g/ coda cross-vowel
  rug: { gentle: ['cat', 'mom'], trap: ['bag', 'dog'] }, // /-g/ coda; [rug,mat] FORBIDDEN
  hut: { gentle: ['cat', 'mom'], trap: ['hat', 'hot'] }, // textbook hat/hot/hut minimal triplet
  gum: { gentle: ['hat', 'dog'], trap: ['jam', 'mom'] }, // /-m/ coda cross-vowel ([cat,dog] FORBIDDEN, [cat,fox] avoided per spec §5)
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
