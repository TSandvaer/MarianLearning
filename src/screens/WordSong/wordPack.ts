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
   *  §Distractor policy → Trap tier).
   *
   *  OPTIONAL since the digraphs-sh tier. The 7 sh-tier `isTarget` entries
   *  OMIT `vowel` entirely: they are NOT classified by short-vowel tier —
   *  they are classified by the digraph phoneme `/ʃ/` (carried in
   *  `phoneme` below). The same-vowel-only distractor rule does not apply
   *  to the sh-tier (it is sh-pool-only — see
   *  `design/word-song/digraphs-sh-word-list.md` §6); the `vowel` field is
   *  never consulted for sh-tier distractor logic, and 3 of the 7 sh words
   *  (`shoe`/`sheep`/`shark`) carry long / r-controlled vowels the
   *  short-vowel union cannot express anyway (spec §10 finding #11).
   *  Omitting it on all 7 — rather than widening the union with long-vowel
   *  codes — keeps the union honest (it means "short-vowel CVC tier") and
   *  avoids the digraph-tier sh words tripping the cross-vowel
   *  exhaustiveness scan in `wordDistractors.test.ts` (whose `vowel`-based
   *  filter would otherwise pick up `shop`'s `'o'`). Resolution path (c)
   *  per the dispatch brief; verified against Kyle's spec §6.1 + §10
   *  finding #11 + Dave's §Q8c ("developmentally invisible").
   *  Distractor-only CVC entries (`sell` /ɛ/, `sop` /ɒ/) keep their real
   *  short-vowel — they ARE short-vowel CVC words, just not sh-tier
   *  targets. */
  vowel?: 'a' | 'o' | 'u' | 'i' | 'e'
  /** Coarse category — used by the gentle-tier filter. */
  category: WordCategory
  /** Whether this entry can appear as a target word. Distractor-only
   *  entries (like `sell`, `sop`) have `isTarget: false`. */
  isTarget: boolean
  /**
   * Sight-word-hybrid flag (digraphs-sh tier — Kyle's spec §6.1, Dave
   * addendum 2026-05-14 §Q7d). `true` for the 3 long-vowel hybrid sh-tier
   * words (`shoe` /uː/, `sheep` /iː/, `shark` /ɑːr/) whose rest-of-word
   * vowel pattern is outside Marian's formal phonics tiers. The planner
   * (Kevin's parallel `feat/digraphs-sh-content-planner` PR) reads this
   * flag to suppress segmentation / spelling / decode-from-phoneme prompts
   * for these words — only chip-tap recognition and picture-retrieval are
   * valid problem types for `hybridMode` entries.
   *
   * Default-absent === `false` (the conventional decodable case — every
   * pre-sh-tier entry and the 4 conventional sh-CVC words `ship`/`shell`/
   * `shed`/`shop`). Read-only at the data layer; orthogonal to the
   * SkillNode-split (#217) and phoneme-tag (#215) — independent of
   * either's landing order. See
   * `design/word-song/digraphs-sh-word-list.md` §6.1 + AC12.
   */
  hybridMode?: boolean
  /**
   * Optional phoneme tag (IPA, content phoneme only). Used for
   * distractor-selection scoping when a grapheme covers multiple
   * phonemes (e.g. `th` → /θ/ vs /ð/, `g` → /g/ vs /dʒ/). For words
   * where the grapheme→phoneme mapping is unambiguous (most of the
   * pack), this is `undefined` — `vowel` already carries the
   * discriminating phonological dimension and the word's identity
   * fully determines the consonant phonemes.
   *
   * Annotate when a word's onset/digraph grapheme is shared with a
   * pack-resident word that carries a DIFFERENT phoneme — the
   * phoneme-scoping branch in `pickDistractors` then prevents
   * cross-phoneme co-occurrence in a chip trio. See
   * `design/architecture/digraph-architecture-proposal.md` §3.
   */
  phoneme?: string
  /**
   * Sight-word flag (sight-words tier — Wave 11, ticket 86ca7xmr8).
   * `true` for the 20 high-frequency sight-word targets (the, a, was,
   * said, he, ...). These are whole-word-RECOGNITION targets, NOT
   * phonics-decoded CVC words: they carry NO `vowel` (most are not
   * single-short-vowel CVC) and a `sight:` sentinel `pictureKey` (no
   * picture-pack asset — the chip renders the WRITTEN word as text per
   * Dave's W11-01 mechanic; Devon's W11-03 owns that render branch).
   *
   * Default-absent === `false` (every decoding-tier entry). The flag is
   * the data-layer discriminant the render/distractor paths key on to
   * avoid running CVC same-vowel distractor logic (which would consult
   * `vowel`, undefined here) against a sight word. See the
   * `WordSongContentType` `'sight-word'` docstring in `wordSessionPlans.ts`.
   */
  sightWord?: boolean
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
  // 'structure' added with the digraphs-sh tier — `shed` + `shop` are
  // small outbuildings/storefronts, a category absent from the CVC pack.
  // Per Kyle's spec §1 final-pool table (`design/word-song/
  // digraphs-sh-word-list.md`).
  | 'structure'
  // 'body-part' + 'action' added with the digraphs-ch tier — `chin` is a
  // body part, `chat` + `chug` are familiar actions (social /
  // onomatopoeic). Neither category existed in the CVC or sh packs. Per
  // the digraphs-ch picture-pack prompt sheet §2.1 / §2.4 / §2.6 headers
  // (`design/word-song/digraphs-ch-picture-pack-prompts.md`) and the
  // word-list §1 final-pool table category column.
  | 'body-part'
  | 'action'
  // 'function-word' added with the sight-words tier (Wave 11, ticket
  // 86ca7xmr8) — articles, pronouns, prepositions, auxiliaries, and
  // high-frequency verbs (the, a, I, was, he, for, ...) that have no
  // picturable referent. The gentle-tier category filter in
  // `wordDistractors.ts` is NEVER consulted for sight words (they carry
  // `sightWord: true` + no `vowel`, and their distractor selection is
  // whole-word visual-shape per Dave's W11-01 mechanic, not category-
  // based), but `category` is a required field on every WordEntry, so a
  // dedicated self-documenting bucket beats overloading 'object'.
  | 'function-word'

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
    // /g/ — hard-g onset. Paired against `gem` (/dʒ/) below in the
    // short-e pool: the `g` grapheme covers two phonemes in this pack.
    // Same-vowel-only rule keeps them apart in v1 sessions, but the
    // phoneme tag is the architectural floor that prevents a future
    // cross-vowel matrix author from accidentally pairing them. See
    // `design/architecture/digraph-architecture-proposal.md` §3.5.
    phoneme: '/g/',
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
    // DUAL-ROLE — cross-vowel-tier load-bearing distractor.
    // `sip` is a short-i target (its own tier) AND the sh/s-contrast trap
    // distractor for `ship` in the digraphs-sh `TARGET_PAIRINGS` row
    // below. `getWordEntry('sip')` must keep resolving for BOTH the
    // short-i target lookup AND the sh-tier distractor lookup. The two
    // flags (`isTarget`, distractor-eligibility) are independent — same
    // precedent as `pen` (short-e target, short-a distractor) and the
    // short-o/short-u promotions (`dog`/`log`/`cup`/`sun`). Per
    // `.claude/docs/skill-trees-and-content.md` §"Cross-vowel-tier
    // load-bearing — generalization": before any future removal of `sip`
    // from `TARGET_WORDS`, grep `TARGET_PAIRINGS` for the `sip` string
    // token and either retain this entry or substitute every reference.
    // The `ship/sip` minimal pair is the single strongest sh-vs-s
    // diagnostic in the sh-tier (Kyle's spec §2 + Dave §Recommendations-
    // to-Kyle #4) — substituting another short-i word would lose the
    // `/ʃ/`-vs-`/s/` test, so the dual-role pattern is the correct
    // resolution. `sip` is NOT phoneme-tagged: tagging it `/s/` would make
    // the sh-tier `ship` row throw the phoneme-mismatch defensive check in
    // `pickDistractors` (target `/ʃ/` vs distractor `/s/`). The phoneme
    // tag is opt-in; an untagged distractor passes through.
    word: 'sip',
    pictureKey: 'sip',
    vowel: 'i',
    category: 'object',
    isTarget: true,
  },
  // ── Short-e pool (ticket 86c9teua2, v5 vowel tier — FINAL single-vowel) ──
  // Per `design/word-song/short-e-pool-expansion.md` §1 with Thomas's
  // 2026-05-09 lock (Q1=A — audit-derived 9-word ship pool). Pool reaches
  // Marian only when the planner emits content for `cvc-words-short-e`
  // (the fifth-vowel sibling node added between `cvc-words-short-i` and
  // `digraphs` in WordSongNode / LITERACY_TREE). Short-a / short-o /
  // short-u / short-i sessions continue to draw from their own pools
  // and short-e words don't leak into them (planner-side guarantee —
  // see `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts`).
  //
  // One of the entries (`pen`) USED to live in `DISTRACTOR_ONLY_WORDS`
  // (see git blame); per Q2=A (2026-05-09) it is promoted distractor →
  // target with `isTarget: true` flipped on. It retains its distractor
  // picture (re-trace pending Phase 3 of the short-e pack — see
  // `design/word-song/short-e-pool-expansion.md` §10 Q2). It remains
  // pickable as a distractor in short-a / short-o / short-u / short-i
  // sessions (the two flags are independent) — same precedent as the
  // short-o promotion of `dog/log/pot/fox` and the short-u promotion
  // of `sun/cup/bus`.
  //
  // Same-vowel-only rule (spec §8): every distractor for a short-e
  // target is drawn from the short-e pool itself. No cross-vowel mixing
  // in v1 — that's a separate downstream ticket (`86c9m3aek`). The
  // `crossVowelMixingActive` predicate gate at `mastery.ts
  // CVC_CROSS_VOWEL_NODES` is intentionally NOT widened to include
  // `cvc-words-short-e` in this PR — adding short-e to that set would
  // require corresponding `TARGET_PAIRINGS_CROSSVOWEL` rows for every
  // short-e target, which is out of scope per the dispatch contract
  // (cross-vowel matrix updates separately ticketed).
  {
    word: 'bed',
    pictureKey: 'bed',
    vowel: 'e',
    category: 'household',
    isTarget: true,
  },
  {
    word: 'leg',
    pictureKey: 'leg',
    vowel: 'e',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'hen',
    pictureKey: 'hen',
    vowel: 'e',
    category: 'animal',
    isTarget: true,
  },
  {
    word: 'pen',
    pictureKey: 'pen',
    vowel: 'e',
    category: 'stationery',
    isTarget: true,
  },
  {
    word: 'web',
    pictureKey: 'web',
    vowel: 'e',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'net',
    pictureKey: 'net',
    vowel: 'e',
    category: 'object',
    isTarget: true,
  },
  {
    word: 'jet',
    pictureKey: 'jet',
    vowel: 'e',
    category: 'vehicle',
    isTarget: true,
  },
  {
    word: 'gem',
    pictureKey: 'gem',
    vowel: 'e',
    category: 'object',
    isTarget: true,
    // /dʒ/ — soft-g onset. Paired against `gum` (/g/) above in the
    // short-u pool: the `g` grapheme covers two phonemes in this pack.
    // Same-vowel-only rule keeps them apart in v1 sessions, but the
    // phoneme tag is the architectural floor that prevents a future
    // cross-vowel matrix author from accidentally pairing them. See
    // `design/architecture/digraph-architecture-proposal.md` §3.5.
    phoneme: '/dʒ/',
  },
  {
    word: 'egg',
    pictureKey: 'egg',
    vowel: 'e',
    category: 'food',
    isTarget: true,
  },
  // ── Digraphs-sh pool (ticket digraphs-sh wordPack — FIRST digraph tier) ──
  // Per `design/word-song/digraphs-sh-word-list.md` §1 (Option C-minus,
  // LOCKED 2026-05-14 via Dave's long-vowel addendum): 7 sh-initial words
  // — 4 conventional sh-CVC (`ship, shell, shed, shop`) + 3 long-vowel
  // sight-word-hybrids (`shoe, sheep, shark`). Pool reaches Marian only
  // when the planner emits content for the `digraphs-sh` SkillNode (added
  // in PR #217's 3-sibling split — `digraphs-sh` / `digraphs-ch` /
  // `digraphs-th-voiceless`, between `cvc-words-short-e` and
  // `sight-words`). Kevin's parallel `feat/digraphs-sh-content-planner` PR
  // wires the planner side (`WORD_SONG_TARGET_WORDS_DIGRAPHS_SH`,
  // first-class focus node, canon bake).
  //
  // `vowel` is OMITTED on all 7 (see the `WordEntry.vowel` doc above): the
  // sh-tier is classified by the digraph phoneme `/ʃ/`, not by short-vowel
  // tier. All 7 carry `phoneme: '/ʃ/'` — the canonical disambiguator per
  // spec §10 finding #11 resolution path (iii), consuming the
  // phoneme-tag infrastructure shipped in #215.
  //
  // `hybridMode: true` on `shoe`/`sheep`/`shark` ONLY (Kyle's spec §6.1 +
  // Dave addendum §Q7d) — long / r-controlled vowels outside Marian's
  // formal phonics tiers; Kevin's planner reads the flag to suppress
  // segmentation / spelling / decode-from-phoneme prompts. The 4
  // conventional sh-CVC words default-absent (=== `false`).
  //
  // Cross-tier hygiene (spec §6): sh-trios contain ONLY sh-pool words +
  // s-contrast traps — no CVC short-vowel words leak in. The sh-tier
  // `TARGET_PAIRINGS` rows below reference only sh-pool neighbours and the
  // 3 s-contrast distractors (`sip` dual-role + `sell`/`sop` new
  // distractor-only entries). Picture pack ships in a separate ticket
  // (`digraphs-sh-picture-pack-prompts.md` — 7 wholly-new pictures); until
  // then chips fall back to the unknown-key silhouette in
  // `wordPictures.tsx`.
  {
    word: 'ship',
    pictureKey: 'ship',
    category: 'vehicle',
    isTarget: true,
    // /ʃ/ — digraph onset. The cleanest sh-CVC anchor (3-letter pattern,
    // short-i inside). `vowel` omitted — sh-tier is phoneme-classified.
    phoneme: '/ʃ/',
  },
  {
    word: 'shell',
    pictureKey: 'shell',
    category: 'object',
    isTarget: true,
    // /ʃ/ — digraph onset. 3-phoneme geminate-CVC under the `egg`/`box`
    // precedent (the `ll` decodes as a single /l/).
    phoneme: '/ʃ/',
  },
  {
    word: 'shoe',
    pictureKey: 'shoe',
    category: 'object',
    isTarget: true,
    // /ʃ/ — digraph onset. Long-vowel /uː/ inside — outside Marian's
    // formal phonics tiers, so `hybridMode: true` (Kyle's spec §6.1):
    // picture+audio scaffold carries the long-vowel decode; the planner
    // emits only chip-tap recognition / picture-retrieval prompts.
    phoneme: '/ʃ/',
    hybridMode: true,
  },
  {
    word: 'sheep',
    pictureKey: 'sheep',
    category: 'animal',
    isTarget: true,
    // /ʃ/ — digraph onset. Long-vowel /iː/ + vowel digraph `ee` —
    // outside Marian's formal phonics tiers, so `hybridMode: true`.
    phoneme: '/ʃ/',
    hybridMode: true,
  },
  {
    word: 'shark',
    pictureKey: 'shark',
    category: 'animal',
    isTarget: true,
    // /ʃ/ — digraph onset. R-controlled /ɑːr/ — outside Marian's formal
    // phonics tiers, so `hybridMode: true`. Strongest pick in the
    // long-vowel-allowance set (universal vocabulary + PH-cultural
    // context per spec §10 finding #5).
    phoneme: '/ʃ/',
    hybridMode: true,
  },
  {
    word: 'shed',
    pictureKey: 'shed',
    category: 'structure',
    isTarget: true,
    // /ʃ/ — digraph onset. Short-e sh-CVC. Vocab register marginally
    // Filipino-English but learnable via the picture+audio scaffold (spec
    // §1 + §10 finding #4).
    phoneme: '/ʃ/',
  },
  {
    word: 'shop',
    pictureKey: 'shop',
    category: 'structure',
    isTarget: true,
    // /ʃ/ — digraph onset. Short-o sh-CVC. Vocab register marginally
    // Filipino-English but learnable via scaffold; British-English
    // high-frequency word — useful advance-vocabulary anchor for Marian's
    // August 2026 Danish-school transition (spec §7 Q3).
    phoneme: '/ʃ/',
  },
  // ── Digraphs-ch pool (ticket digraphs-ch wordPack — SECOND digraph tier) ──
  // Per `design/word-song/digraphs-ch-word-list.md` §1 (Dave's §3c locked
  // inventory, reconciled against `design/research/digraph-ch-addendum.md`):
  // 7 ch-initial words — `chin, chip, chop, chat, chest, chug, chick`. Pool
  // reaches Marian only when the planner emits content for the
  // `digraphs-ch` SkillNode (added in PR #211's 3-sibling split —
  // `digraphs-sh` / `digraphs-ch` / `digraphs-th-voiceless`). Kevin's
  // parallel planner PR wires the planner side (first-class focus node,
  // canon bake, 3-place sync contract).
  //
  // STRUCTURALLY UNLIKE THE SH TIER on three points (spec §0):
  //   1. `vowel` is SET on all 7 (not omitted as on sh-tier entries).
  //      Every ch-word uses a short vowel Marian has formally covered
  //      (short-i, -o, -a, -e, -u) — the ch grapheme is the digraph
  //      lesson, but the rest-of-word vowel is in-tier, so `vowel`
  //      carries the real phonological dimension. The CVC-tier
  //      gentle/trap axis tests in `wordDistractors.test.ts` DO apply to
  //      these entries (unlike sh, which the tests skip via the
  //      `vowel !== undefined` filter) — the §2 matrix pairings are
  //      authored to satisfy them.
  //   2. NO `phoneme` field. The sh tier carried `phoneme: '/ʃ/'` to
  //      drive cross-phoneme distractor scoping; the ch pool needs no
  //      such scoping (no pack-resident word shares the `ch` grapheme
  //      with a different phoneme), so the field is omitted and the
  //      opt-in phoneme-scoping branch in `pickDistractors` stays inert.
  //   3. ZERO `hybridMode: true` entries — see spec §6.1 + AC12 + Dave
  //      non-obvious finding #1. The sh tier set `hybridMode: true` on 3
  //      long-vowel hybrids (`shoe/sheep/shark`) whose vowel pattern was
  //      outside Marian's formal phonics; the ch short-vowel word stock
  //      is rich enough that no long-vowel inclusions are needed, so
  //      every ch-word is fully decodable and `hybridMode` is absent
  //      (=== `false` default) on all 7. Stating this explicitly
  //      prevents future misapplication of the `hybridMode` pattern to
  //      ch. `chest`'s short-e is "emerging" not "unlearned" — it needs
  //      a conservative planner weighting (Kevin's ticket, spec §6
  //      constraint #5 / AC13), NOT a `hybridMode` flag.
  //
  // Cross-tier hygiene (spec §6): ch-trios contain ONLY ch-pool words +
  // ch/s-contrast traps — no CVC short-vowel words, no sh-tier words, and
  // no c-initial /k/-words leak in. The ch-tier `TARGET_PAIRINGS` rows
  // below reference only ch-pool neighbours and the 3 s-contrast
  // distractors (`sip` dual-role + `sat`/`sick` new distractor-only
  // entries). Picture pack ships via `yarn embed-pictures` from the
  // companion prompt sheet (`digraphs-ch-picture-pack-prompts.md` — 7
  // wholly-new pictures); until then chips fall back to the unknown-key
  // silhouette in `wordPictures.tsx`.
  {
    word: 'chin',
    pictureKey: 'chin',
    vowel: 'i',
    category: 'body-part',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-i, mastered. Dave's "ideal anchor" —
    // body parts are the highest-familiarity vocabulary class. Lead word.
  },
  {
    word: 'chip',
    pictureKey: 'chip',
    vowel: 'i',
    category: 'food',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-i, mastered. Universal Filipino-English
    // loanword. `chip`/`ship` minimal-pair anchor with the sh tier (spec
    // §6 constraint #6 — annotation only in the introduction tier; the
    // pair is NOT yet used as a cross-pool distractor).
  },
  {
    word: 'chop',
    pictureKey: 'chop',
    vowel: 'o',
    category: 'object',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-o, mastered. `chop`/`shop` minimal-pair
    // anchor with the sh tier (spec §6 constraint #6). Picture brief is
    // load-bearing: a chopped/split log + small axe — the concrete-result
    // depiction, not the bare verb (spec §3 / AC7).
  },
  {
    word: 'chat',
    pictureKey: 'chat',
    vowel: 'a',
    category: 'action',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-a, mastered. "The best short-a ch word
    // that is picturable" (Dave §3a). Picture brief is load-bearing: two
    // simple figures + a speech bubble between them; must read as
    // "talking" (spec §3 / AC7).
  },
  {
    word: 'chest',
    pictureKey: 'chest',
    vowel: 'e',
    category: 'object',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-e, emerging (the short-e tier shipped
    // 2026-05-14). `st` coda is acoustically inert for chip-tap
    // recognition. The short-e emerging-vowel entry — planner weights it
    // conservatively in introduction sessions (like `gem`/`web` in the
    // short-e tier; spec §6 constraint #5 / AC13). Fully decodable —
    // emerging is not unlearned, so NO `hybridMode` flag.
  },
  {
    word: 'chug',
    pictureKey: 'chug',
    vowel: 'u',
    category: 'action',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-u, mastered. Dave's replacement for the
    // dropped `much` (`much` is an unpicturable function word). Picture
    // brief is load-bearing: a train or a bottle being gulped, mid-motion
    // (spec §3 / AC7) — the picture+audio scaffold carries the moderate
    // label-familiarity.
  },
  {
    word: 'chick',
    pictureKey: 'chick',
    vowel: 'i',
    category: 'animal',
    isTarget: true,
    // /tʃ/ — digraph onset. Short-i, mastered. `ck` coda spells /k/ she
    // already decodes — acoustically inert for chip-tap recognition.
    // Storybook-universal; Tagalog "sisiw" is everyday vocab. Picture
    // brief: baby-bird roundness + no comb, to stay distinct from `hen`
    // (short-e target).
  },
  // ── Digraphs-th pool (ticket digraphs-th wordPack — THIRD digraph tier) ──
  // Per `design/word-song/digraphs-th-word-list.md` §1 (RECONCILED against
  // `design/research/digraph-th-addendum.md`, commit `8c43395`): 7
  // voiceless-/θ/ words — `thin, bath, math, path, moth, thick, cloth`.
  // Pool reaches Marian only when the planner emits content for the
  // `digraphs-th-voiceless` SkillNode (added in PR #211's 3-sibling split
  // — `digraphs-sh` / `digraphs-ch` / `digraphs-th-voiceless`). Kevin's
  // parallel planner PR wires the planner side (first-class focus node,
  // canon bake, 3-place sync contract).
  //
  // STRUCTURALLY: th is a HYBRID of the sh and ch postures (spec §0):
  //   1. `vowel` is SET on all 7 (like ch, unlike sh). Every th-word uses
  //      a short vowel Marian has formally covered (short-i ×2, short-a
  //      ×3, short-o ×2) — the th grapheme is the digraph lesson, the
  //      rest-of-word vowel is in-tier, so `vowel` carries the real
  //      phonological dimension. Because th SETS `vowel`, the th-tier
  //      words must be added to the `DIGRAPH_TIER_WORDS` exclusion Set in
  //      `wordDistractors.test.ts` (same gap the ch tier hit) so they do
  //      not false-fail the cross-vowel exhaustiveness scan.
  //   2. `phoneme: '/θ/'` IS set on all 7 (like sh's `/ʃ/`, UNLIKE ch
  //      which omitted `phoneme`). `th` is THE canonical multi-phoneme
  //      grapheme — voiceless /θ/ (`thin`, `bath`) vs voiced /ð/ (`the`,
  //      `this`). Setting `phoneme: '/θ/'` is the architectural floor
  //      that lets a future voiced-/ð/ sight-word tier coexist without
  //      cross-phoneme chip-trio co-occurrence bugs (spec §6.1). The
  //      opt-in phoneme-scoping branch in `pickDistractors` is
  //      reactivated for th-tier targets — but every th-tier distractor
  //      is either a `/θ/`-tagged th-pool neighbour (matches) or an
  //      UNTAGGED t-contrast trap (`tin`/`tick`/`pat`/`bat`/`mat` — the
  //      branch does not fire), so it never rejects a v1 th-tier pairing.
  //   3. TWO `hybridMode: true` entries — `thick` (th-onset + `ck`-coda
  //      double-digraph) and `cloth` (`/kl/` onset blend). Both exceed
  //      CVC scope, so they ship recognition-only: Kevin's planner reads
  //      the flag to suppress segmentation / spelling / decode-from-
  //      phoneme prompts (the sh-tier `hybridMode` guard from PR #220 is
  //      consumed, not rebuilt). The other 5 (`thin, bath, math, path,
  //      moth`) are fully decodable (`hybridMode` absent === `false`).
  //      th resembles the SH tier's structure (decodable + hybrid mix),
  //      NOT ch's clean zero-`hybridMode` pool (spec §6.2 / AC13).
  //
  // Cross-tier hygiene (spec §6): th-trios contain ONLY th-pool words +
  // th/t-contrast traps. No generic CVC short-vowel words, no sh-tier or
  // ch-tier words, and no voiced-/ð/ words leak in — EXCEPT the t-contrast
  // minimal-pair partner of a th-target (`bat` for `bath`, `mat` for
  // `math`), which IS the diagnostic distractor, not generic filler. The
  // th-tier `TARGET_PAIRINGS` rows below reference only th-pool neighbours
  // and the 5 t-contrast distractors (`bat`/`mat` dual-role existing +
  // `tin`/`tick`/`pat` new distractor-only entries). Picture pack ships
  // via `yarn embed-pictures` from the companion prompt sheet
  // (`digraphs-th-picture-pack-prompts.md` — 7 wholly-new pictures);
  // until then chips fall back to the unknown-key silhouette in
  // `wordPictures.tsx`.
  {
    word: 'thin',
    pictureKey: 'thin',
    vowel: 'i',
    category: 'object',
    isTarget: true,
    // /θ/ — voiceless-th digraph ONSET. Short-i, mastered. Canonical
    // word-initial /θ/ anchor (Dave §3f); lead word, introduced session
    // 1. Forms the `thin`/`tin` th/t-contrast minimal pair the §2
    // distractor matrix is built around. Picture brief is load-bearing:
    // an adjective — the "thinness" PROPERTY must be the salient picture
    // feature (Dave Recommendation 3 — contrast-pair composition).
    phoneme: '/θ/',
  },
  {
    word: 'bath',
    pictureKey: 'bath',
    vowel: 'a',
    category: 'household',
    isTarget: true,
    // /θ/ — voiceless-th digraph CODA (word-final). Short-a, mastered.
    // Fully decodable; highest-familiarity th word in the pool (Dave
    // §3f). Forms the `bath`/`bat` th/t-contrast minimal pair — `bat` is
    // a shipped short-a CVC target, the strongest possible real-word
    // trap. Picture: a bathtub, no child in the tub (Dave Recommendation
    // 3).
    phoneme: '/θ/',
  },
  {
    word: 'math',
    pictureKey: 'math',
    vowel: 'a',
    category: 'object',
    isTarget: true,
    // /θ/ — voiceless-th digraph CODA (word-final). Short-a, mastered.
    // Fully decodable; strong cross-language anchor (matematika). Forms
    // the `math`/`mat` th/t-contrast minimal pair — `mat` is a shipped
    // short-a CVC target. Picture brief is load-bearing: a chalkboard /
    // notebook with numerals (a `2 + 2`-type sum), NOT "school" (Dave
    // Recommendation 3).
    phoneme: '/θ/',
  },
  {
    word: 'path',
    pictureKey: 'path',
    vowel: 'a',
    category: 'object',
    isTarget: true,
    // /θ/ — voiceless-th digraph CODA (word-final). Short-a, mastered.
    // Fully decodable. Forms the `path`/`pat` th/t-contrast minimal pair.
    // Picture: a simple winding trail — must read as "path" not "road"
    // (Dave Recommendation 3).
    phoneme: '/θ/',
  },
  {
    word: 'moth',
    pictureKey: 'moth',
    vowel: 'o',
    category: 'animal',
    isTarget: true,
    // /θ/ — voiceless-th digraph CODA (word-final). Short-o, mastered.
    // Fully decodable. No clean real-word t-contrast (`/θ/`→`/t/` gives
    // the non-word "mot") — weak-trap subset, paired with th-pool
    // neighbours. Picture brief is load-bearing: fuzzy body + drab/muted
    // colour + flat/folded wings + feathery antennae, to stay distinct
    // from a butterfly (Dave Recommendation 3).
    phoneme: '/θ/',
  },
  {
    word: 'thick',
    pictureKey: 'thick',
    vowel: 'i',
    category: 'object',
    isTarget: true,
    // /θ/ — voiceless-th digraph ONSET. Short-i, mastered. `hybridMode:
    // true` (RECONCILED — Dave §3d/§3e): `thick` is a DOUBLE-DIGRAPH word
    // — `th` (this tier's target) AND `ck` (a separate digraph not yet
    // formally taught). In the chip-tap recognition format the `ck` is
    // not a decoding burden, but `hybridMode: true` is the correct flag:
    // the planner must never ask Marian to decode or spell `thick`. Forms
    // the `thick`/`tick` th/t-contrast minimal pair. Picture brief:
    // contrast-pair composition, "thickness" the salient property (Dave
    // Recommendation 3).
    phoneme: '/θ/',
    hybridMode: true,
  },
  {
    word: 'cloth',
    pictureKey: 'cloth',
    vowel: 'o',
    category: 'object',
    isTarget: true,
    // /θ/ — voiceless-th digraph CODA (word-final). Short-o, mastered.
    // `hybridMode: true` (RECONCILED — Dave §3d/§3e): `cloth` carries a
    // `/kl/` ONSET BLEND that exceeds CVC scope — recognition-only, the
    // planner emits no decode/spell prompts. No clean real-word
    // t-contrast (`/kl/` onset has no single t-substitutable consonant) —
    // weak-trap subset, paired with th-pool neighbours. Gives the pool a
    // 2nd short-o word-final entry alongside `moth`. Picture brief: a
    // clean single fabric square — must read as "cloth" not
    // "blanket"/"fabric" (Dave §3d / Recommendation 3).
    phoneme: '/θ/',
    hybridMode: true,
  },
  // ── Sight-words tier (Wave 11, ticket 86ca7xmr8) ──────────────────────
  // 20 high-frequency sight-word targets — Dave's W11-01 starter set
  // (Dolch Pre-Primer + Primer subset), aligned 1:1 with
  // `WORD_SONG_TARGET_WORDS_SIGHT` in `api/_plannerWordList.ts` and
  // Jessica's `SIGHT_WORDS_POOL` in `e2e/sight-words-content.spec.ts`.
  //
  // These are whole-word RECOGNITION targets, NOT phonics-decoded CVC
  // words. They carry NO `vowel` (most are not single-short-vowel CVC),
  // a `sight:` sentinel `pictureKey` (no picture-pack asset — the chip
  // renders the WRITTEN word as text per Dave's mechanic; Devon's W11-03
  // owns that render branch), `category: 'function-word'`, and
  // `sightWord: true` so the render/distractor paths skip CVC same-vowel
  // logic. `getWordEntry` resolves them like any other target.
  //
  // Batch 1 — Pre-Primer function words.
  {
    word: 'the',
    pictureKey: 'sight:the',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'a',
    pictureKey: 'sight:a',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'i',
    pictureKey: 'sight:i',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'is',
    pictureKey: 'sight:is',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'it',
    pictureKey: 'sight:it',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'in',
    pictureKey: 'sight:in',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'to',
    pictureKey: 'sight:to',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'go',
    pictureKey: 'sight:go',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'no',
    pictureKey: 'sight:no',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'do',
    pictureKey: 'sight:do',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  // Batch 2 — Primer / Grade-1 function words + common verbs.
  {
    word: 'was',
    pictureKey: 'sight:was',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'see',
    pictureKey: 'sight:see',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'said',
    pictureKey: 'sight:said',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'he',
    pictureKey: 'sight:he',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'she',
    pictureKey: 'sight:she',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'we',
    pictureKey: 'sight:we',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'for',
    pictureKey: 'sight:for',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'on',
    pictureKey: 'sight:on',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  {
    word: 'not',
    pictureKey: 'sight:not',
    category: 'function-word',
    isTarget: true,
    sightWord: true,
  },
  // NOTE: 'can' is INTENTIONALLY absent here. It already exists above as
  // a short-a CVC target (`word: 'can', vowel: 'a'`), so adding a second
  // entry would duplicate the `getWordEntry('can')` key. 'can' is
  // dual-role (CVC target AND sight-word target — Dave's W11-01 §"Note on
  // overlap" calls this an asset: Marian has phonics-grounded prior
  // exposure that anchors the orthographic mapping). The sight-word RENDER
  // is driven by the per-problem `contentType: 'sight-word'` the parser
  // sets from the "Find the word: can." read line — NOT by an entry flag
  // — so the existing CVC `can` entry serves both tiers. Same dual-role
  // precedent as `sip` (short-i target reused by digraphs-ch). The other
  // pool words (the/a/is/it/in/to/go/no/do/was/see/said/he/she/we/for/
  // on/not) are net-new and added above; only 'can' pre-existed.
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
 * `pen` (short-e) remained as the lone distractor-only entry until
 * the short-e tier shipped.
 *
 * v5 note (ticket 86c9teua2, short-e pool expansion): the lone `pen`
 * entry is promoted distractor → target by Thomas's 2026-05-09 Q2=A
 * lock and now lives in `TARGET_WORDS` with `isTarget: true` and
 * `vowel: 'e'`. It remains pickable as a distractor in short-a /
 * short-o / short-u / short-i sessions because `getWordEntry()`
 * resolves it from `TARGET_WORDS` and the existing `TARGET_PAIRINGS`
 * rows for short-a (e.g. `mat: { gentle: ['pen', 'dog'], … }`) point
 * at it by string — same shape as the short-u / short-o promotion
 * patterns. With the `pen` promotion this array was briefly empty.
 *
 * v6 note (digraphs-sh tier): the array is re-populated with the 2
 * sh/s-contrast trap distractors `sell` (/sɛl/) and `sop` (/sɒp/) —
 * the s-onset minimal-pair partners of `shell` and `shop`. These are
 * genuine short-vowel CVC words (so they keep their real `vowel`) but
 * they are NOT sh-tier targets and they appear ONLY as sh-trio
 * distractors — cross-tier hygiene rule (Kyle's spec §6) keeps them out
 * of any short-i/short-e/short-o CVC trio. They are NOT phoneme-tagged:
 * the `/ʃ/`-vs-`/s/` contrast is the diagnostic the sh-tier is testing,
 * so the sh-target rows reference them as untagged distractors (an
 * untagged distractor passes the `pickDistractors` phoneme-scoping check
 * by design). `ship`'s s-contrast trap `sip` is NOT here — it is a
 * dual-role short-i `TARGET_WORDS` entry referenced by string (see the
 * `sip` row comment). `sue/seep/sark/sed` were rejected as too weak and
 * `sore` is not needed (its target `shore` was dropped from the pool
 * per Dave's Option C-minus addendum). Per Kyle's spec §6.1 + AC2.
 *
 * v7 note (digraphs-ch tier): two more sh-style s-contrast trap
 * distractors are added — `sat` (/sæt/) and `sick` (/sɪk/) — the s-onset
 * minimal-pair partners of `chat` and `chick`. Same posture as `sell` /
 * `sop`: genuine short-vowel CVC words (so they keep their real `vowel`)
 * but NOT ch-tier targets, appearing ONLY as ch-trio distractors —
 * cross-tier hygiene rule (`digraphs-ch-word-list.md` §6 constraint #2)
 * keeps them out of any CVC / sh trio. They are NOT phoneme-tagged: the
 * /tʃ/-vs-/s/ contrast is the diagnostic the ch-tier tests, so the
 * ch-target rows reference them as untagged distractors (an untagged
 * distractor passes the `pickDistractors` phoneme-scoping check — and ch
 * targets carry no `phoneme` either, so the branch never runs). `chip`'s
 * s-contrast trap `sip` is NOT here — it is a dual-role short-i
 * `TARGET_WORDS` entry referenced by string (now load-bearing across
 * THREE tiers: short-i own, sh `ship`'s trap, ch `chip`'s trap — see the
 * `sip` row comment). Weak-trap s-contrast words (`sin`, `sop` reused as
 * `chop`'s? no — `sin`/`sop`/`sest`/`sug`) are NOT shipped: `sin` is
 * adult-register, `sop` already exists for sh but is obscure for an 8yo
 * ch trap, `sest`/`sug` are non-words. Per `digraphs-ch-word-list.md`
 * §2 + AC2.
 *
 * v8 note (digraphs-th tier): three NEW t-contrast trap distractors are
 * added — `tin` (/tɪn/), `tick` (/tɪk/), `pat` (/pæt/) — the t-onset
 * (word-initial) and t-coda (word-final) minimal-pair partners of `thin`,
 * `thick`, and `path` respectively. They are genuine short-vowel CVC
 * words (so they keep their real `vowel` — `tin`/`tick` /ɪ/, `pat` /æ/)
 * but they are NOT th-tier targets and appear ONLY as th-trio distractors
 * — cross-tier hygiene (`digraphs-th-word-list.md` §6 constraint #2)
 * keeps them out of any CVC / sh / ch trio. They are NOT phoneme-tagged:
 * the /θ/-vs-/t/ contrast is the diagnostic the th-tier tests by chip
 * SELECTION, not by phoneme-scoping — tagging them `/t/` would make every
 * th-tier `TARGET_PAIRINGS` row trip the phoneme-mismatch defensive check
 * in `pickDistractors` (target `/θ/` vs distractor `/t/`). An untagged
 * distractor passes the phoneme-scoping check by design — the same
 * posture sh used for `sip` and ch used for `sat`/`sick`. The other two
 * th-tier strong-trap distractors — `bath`'s `bat` and `math`'s `mat` —
 * are NOT here: they are dual-role existing short-a CVC `TARGET_WORDS`
 * entries referenced by string (now load-bearing across short-a own +
 * th). `moth` and `cloth` have NO clean real-word t-contrast (`moth`→"mot"
 * non-word; `cloth`'s `/kl/` onset has no single t-substitutable
 * consonant) — their th-tier rows use th-pool neighbours as traps. Per
 * `digraphs-th-word-list.md` §2 + AC2.
 */
export const DISTRACTOR_ONLY_WORDS: readonly WordEntry[] = [
  {
    word: 'sell',
    pictureKey: 'sell',
    vowel: 'e',
    category: 'object',
    isTarget: false,
    // s-onset minimal pair for `shell` — the sh/s contrast trap. NOT
    // phoneme-tagged (see the array doc above). Picture: silhouette
    // placeholder acceptable for distractor-only entries until a vector
    // trace lands in the polish backlog (spec §10 finding #13).
  },
  {
    word: 'sop',
    pictureKey: 'sop',
    vowel: 'o',
    category: 'object',
    isTarget: false,
    // s-onset minimal pair for `shop` — the sh/s contrast trap. NOT
    // phoneme-tagged. Picture: silhouette placeholder acceptable for
    // distractor-only entries (spec §10 finding #13).
  },
  {
    word: 'sat',
    pictureKey: 'sat',
    vowel: 'a',
    category: 'object',
    isTarget: false,
    // s-onset minimal pair for `chat` — the ch/s contrast trap
    // (digraphs-ch tier, `digraphs-ch-word-list.md` §2). NOT
    // phoneme-tagged. Picture: silhouette placeholder acceptable for
    // distractor-only entries until a vector trace lands in the polish
    // backlog (spec §3 — `picture-sat.svg` is a new distractor-only
    // asset).
  },
  {
    word: 'sick',
    pictureKey: 'sick',
    vowel: 'i',
    category: 'object',
    isTarget: false,
    // s-onset minimal pair for `chick` — the ch/s contrast trap
    // (digraphs-ch tier, `digraphs-ch-word-list.md` §2). NOT
    // phoneme-tagged. Picture: silhouette placeholder acceptable for
    // distractor-only entries (spec §3 — `picture-sick.svg` is a new
    // distractor-only asset).
  },
  {
    word: 'tin',
    pictureKey: 'tin',
    vowel: 'i',
    category: 'object',
    isTarget: false,
    // t-onset minimal pair for `thin` — the th/t contrast trap
    // (digraphs-th tier, `digraphs-th-word-list.md` §2). NOT
    // phoneme-tagged (see the array doc above — tagging it `/t/` would
    // trip the phoneme-mismatch check against the `/θ/`-tagged `thin`
    // target). Picture: silhouette placeholder acceptable for
    // distractor-only entries (spec §3 — `picture-tin.svg` is a new
    // distractor-only asset; vector trace deferred to polish backlog).
  },
  {
    word: 'tick',
    pictureKey: 'tick',
    vowel: 'i',
    category: 'object',
    isTarget: false,
    // t-onset minimal pair for `thick` — the th/t contrast trap
    // (digraphs-th tier, `digraphs-th-word-list.md` §2). NOT
    // phoneme-tagged. Picture: silhouette placeholder acceptable for
    // distractor-only entries (spec §3 — `picture-tick.svg` is a new
    // distractor-only asset).
  },
  {
    word: 'pat',
    pictureKey: 'pat',
    vowel: 'a',
    category: 'object',
    isTarget: false,
    // t-coda minimal pair for `path` — the th/t contrast trap
    // (digraphs-th tier, `digraphs-th-word-list.md` §2). NOT
    // phoneme-tagged. Picture: silhouette placeholder acceptable for
    // distractor-only entries (spec §3 — `picture-pat.svg` is a new
    // distractor-only asset).
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
  // Short-e pool additions (ticket 86c9teua2, §3 / §5 LOCKED 2026-05-09).
  // Same posture as the short-u + short-i additions: same-vowel-only rule
  // (spec §8) keeps these pairs from co-occurring in v1 trios anyway, but
  // the entries are cheap insurance against future cross-vowel mixing
  // (ticket 86c9m3aek) — when cross-vowel fires, a short-e target
  // landing alongside a short-a/short-u distractor must not collide on
  // silhouette. Per Kyle's spec §3 + §6, all three are cross-vowel pairs:
  //   - [net, bag]: both fabric-with-handle objects. Discriminator is
  //     mesh-vs-solid; load-bearing for net's chip-readability at 96pt.
  //   - [egg, nut]: both ovals. Discriminator is smooth-ovoid (egg)
  //     vs vertical-seam (nut). At 96pt with PNG-embed compression the
  //     seam can collapse — cheap insurance.
  //   - [egg, bun]: both round food. Discriminator is smooth-ovoid (egg)
  //     vs horizontal-score-mark (bun). Cheap insurance.
  ['net', 'bag'],
  ['egg', 'nut'],
  ['egg', 'bun'],
  // Digraphs-sh pool additions (Kyle's spec §6 + §2 FORBIDDEN_PAIRS
  // pre-check, LOCKED 2026-05-14). All three are silhouette-collision
  // hygiene; the sh-tier sh-pool-only rule already keeps the first two
  // from co-occurring (both members are sh-pool), but the entries are the
  // architectural floor that keeps the §2 distractor matrix honest and
  // protects future cross-pool digraph work:
  //   - [shed, shop]: both small-structure silhouettes — the only 96pt
  //     discriminator is awning-vs-roof, too fine. In-pool hygiene; the
  //     §2 matrix routes `shed`/`shop` sh-neighbour pairs around each
  //     other (e.g. `shop.gentle = ['shark','shell']`, NOT `shed`).
  //   - [shoe, shop]: if the `shop` picture leans toward "shoe store" the
  //     silhouette could collide. In-pool hygiene.
  //   - [ship, tub]: both vessel-like silhouettes at 96pt. `tub` is a
  //     short-u target — cross-pool only; the sh-tier rule already
  //     prevents this pair in a v1 trio, but the entry documents the
  //     silhouette risk for future cross-pool work.
  ['shed', 'shop'],
  ['shoe', 'shop'],
  ['ship', 'tub'],
  // Digraphs-ch pool additions (`digraphs-ch-word-list.md` §"FORBIDDEN_PAIRS
  // additions" + §6, LOCKED 2026-05-14). All three are silhouette-collision
  // hygiene; the ch-tier ch-pool-only rule already keeps the first two from
  // co-occurring (both members are ch-pool), but the entries are the
  // architectural floor that keeps the §2 distractor matrix honest and
  // protect future cross-pool digraph work:
  //   - [chest, chip]: at 96pt a small flat `chip` could read against a
  //     small `chest` with insufficient mass contrast if the chest is
  //     drawn small. In-pool hygiene; the §2 matrix routes `chip`/`chest`
  //     around each other (`chip.gentle = ['chop','chug']`, NOT `chest`).
  //   - [chick, chin]: `chick` (small round bird) and `chin`
  //     (face-with-prominent-chin) are both small rounded-form
  //     silhouettes at 96pt — the discriminator is real but in-pool
  //     hygiene keeps them out of the same trio so the load doesn't stack.
  //   - [chest, box]: cross-pool silhouette hygiene — `chest` (treasure
  //     trunk) vs `box` (short-o target, plain cuboid). The
  //     hinged-lid/bands detail distinguishes them; the ch-tier
  //     ch-pool-only rule already prevents `box` appearing in a ch-trio,
  //     so this entry documents the risk for future interleaving work.
  ['chest', 'chip'],
  ['chick', 'chin'],
  ['chest', 'box'],
  // Digraphs-th pool additions (`digraphs-th-word-list.md` §"FORBIDDEN_PAIRS
  // additions" + §6, RECONCILED against Dave's th-addendum 2026-05-14). All
  // three are silhouette-collision hygiene; the th-tier th-pool-only rule
  // already keeps the first two from co-occurring (both members are
  // th-pool), but the entries are the architectural floor that keeps the §2
  // distractor matrix honest and protect future cross-pool digraph work:
  //   - [thin, thick]: an antonym pair whose pictures are deliberately the
  //     SAME object class at opposite extremes of one property
  //     (slenderness). At 96pt a "thin X" and a "thick X" could read as
  //     near-identical silhouettes differing only in width — stacking them
  //     in one trio over-loads the property-contrast. In-pool hygiene; the
  //     §2 matrix routes `thin`/`thick` th-neighbour pairs around each
  //     other (`thin.gentle = ['bath','math']`, NOT `thick`).
  //   - [path, moth]: both low-mass, irregular-outline silhouettes (`path`
  //     a thin winding trail, `moth` a small drab insect) — neither has a
  //     bold blocky silhouette, so the contrast is insufficient at 96pt.
  //     In-pool hygiene keeps them out of the same trio.
  //   - [bath, box]: cross-pool silhouette hygiene — `bath` (a tub —
  //     open-topped rounded vessel) vs `box` (short-o target, plain closed
  //     cuboid). The open-top/rounded vs closed/cuboid detail distinguishes
  //     them; the th-tier th-pool-only rule already prevents `box`
  //     appearing in a th-trio, so this entry documents the risk for future
  //     interleaving work. The th-tier analogue of `[chest, box]`.
  ['thin', 'thick'],
  ['path', 'moth'],
  ['bath', 'box'],
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
  // ── Short-e pool (ticket 86c9teua2) ─────────────────────────────────
  // Per `design/word-song/short-e-pool-expansion.md` §2.4 matrix preview
  // + §8 same-vowel-only rule: every distractor for a short-e target is
  // drawn from the short-e pool itself (`bed, leg, hen, pen, web, net,
  // jet, gem, egg`). No cross-vowel mixing in v1; that's a separate
  // ticket (`86c9m3aek`).
  //
  // Trap-tier pairs lean on the rhyme families enumerated in spec §1
  // (`/ɛg/`, `/ɛn/`, `/ɛt/` are the three doublets, plus `/ɛd/`,
  // `/ɛb/`, `/ɛm/` singletons). The three doublets carry the trap-tier
  // pressure: leg+egg, hen+pen, net+jet — same trap-cluster pattern as
  // the prior tiers' densest rhyme groups (short-a /æt/, short-u /ʌg/,
  // short-i /ɪg/). Gentle-tier pairs are visually / categorically
  // distinct from the target (animal vs household vs object vs
  // stationery vs vehicle vs food).
  //
  // Author-latitude note (Kevin, 2026-05-13): the spec preview at §2.4
  // flagged `pen`'s row as illustrative with a `hen`-duplicate; the
  // final row below uses distinct distractors per row. The constraint
  // (gentle = clearly different category; trap = same rhyme or same
  // near-coda) is the design lock, not the exact pair assignments.
  //
  // FORBIDDEN_PAIRS audit — none of the rows below trigger:
  //  - new short-e additions `[net, bag]`, `[egg, nut]`, `[egg, bun]`
  //    are all cross-vowel — same-vowel-only rule keeps them apart.
  //  - all existing forbidden pairs (cat-dog, bus-van, pan-pot, cap-hat,
  //    man-dad, mom-dad, rug-mat, tub-cup, fig-bun, pig-dog, pig-cat)
  //    involve at least one non-short-e word and so are unreachable
  //    here under the same-vowel rule.
  bed: { gentle: ['hen', 'gem'], trap: ['leg', 'egg'] }, // /ɛd/ singleton; /ɛg/ doublet trap (cross-coda)
  leg: { gentle: ['hen', 'net'], trap: ['egg', 'gem'] }, // /ɛg/ rhyme partner (leg+egg) + /ɛm/ near-rhyme
  hen: { gentle: ['web', 'gem'], trap: ['pen', 'jet'] }, // /ɛn/ rhyme partner (hen+pen) + /ɛt/ near-rhyme
  pen: { gentle: ['gem', 'bed'], trap: ['hen', 'net'] }, // /ɛn/ rhyme partner (pen+hen) + /ɛt/ near-rhyme (-n vs -t coda contrast)
  web: { gentle: ['hen', 'jet'], trap: ['bed', 'gem'] }, // /ɛb/ singleton; near-codas (-d, -m) for trap-density
  net: { gentle: ['bed', 'gem'], trap: ['jet', 'pen'] }, // /ɛt/ rhyme partner (net+jet) + /ɛn/ near-rhyme
  jet: { gentle: ['hen', 'gem'], trap: ['net', 'pen'] }, // /ɛt/ rhyme partner (jet+net) + /ɛn/ near-rhyme
  gem: { gentle: ['hen', 'net'], trap: ['jet', 'web'] }, // /ɛm/ singleton; -t + -b near-coda trap
  egg: { gentle: ['hen', 'web'], trap: ['leg', 'gem'] }, // /ɛg/ rhyme partner (egg+leg) + /ɛm/ near-rhyme
  // ── Digraphs-sh pool (ticket digraphs-sh wordPack) ──────────────────
  // Per `design/word-song/digraphs-sh-word-list.md` §2: structurally
  // DIFFERENT from the same-vowel-only CVC tiers. The sh-tier distractor
  // rule is sh-pool-only + sh/s-contrast:
  //   - gentle (problems 1-3): BOTH entries are sh-pool neighbours —
  //     Marian distinguishes by picture, builds sh-pool cohesion.
  //   - trap (problems 4-8): for the strong-trap subset (`ship`, `shell`,
  //     `shop` — the 3 targets with a real-English-word s-contrast
  //     partner) one trap entry is the sh/s-contrast distractor
  //     (`sip`/`sell`/`sop`) + one sh-pool neighbour; for the weak-trap
  //     subset (`shoe`, `sheep`, `shark`, `shed` — no good s-contrast
  //     word, see spec §2 / §10 finding #3) BOTH trap entries are
  //     sh-pool neighbours.
  // No CVC short-vowel words appear in any sh-trio (cross-tier hygiene,
  // spec §6). FORBIDDEN_PAIRS pre-checked: `[shed,shop]`, `[shoe,shop]`,
  // `[ship,tub]` — no row below pairs a target with a forbidden
  // silhouette neighbour. Phoneme-scoping: every sh-word distractor
  // carries `phoneme: '/ʃ/'` (matches the sh target); `sip`/`sell`/`sop`
  // are untagged and pass the opt-in phoneme check by design.
  //
  // Strong-trap subset — sh/s contrast trap + sh-pool neighbour:
  ship: { gentle: ['shell', 'shark'], trap: ['sip', 'sheep'] }, // sh/s minimal pair (sip) + sh-neighbour
  shell: { gentle: ['ship', 'shoe'], trap: ['sell', 'sheep'] }, // sh/s minimal pair (sell) + sh-neighbour
  shop: { gentle: ['shark', 'shell'], trap: ['sop', 'sheep'] }, // sh/s minimal pair (sop) + sh-neighbour; gentle avoids shed/shoe (FORBIDDEN_PAIRS)
  // Weak-trap subset — sh-pool neighbours both tiers (no strong s-contrast
  // word: sue too adult-vocab, seep too obscure, sark/sed non-words):
  shoe: { gentle: ['ship', 'shark'], trap: ['shell', 'sheep'] }, // sh-pool only; shoe+shop avoided (FORBIDDEN_PAIR)
  sheep: { gentle: ['shark', 'shoe'], trap: ['ship', 'shell'] }, // sh-pool only
  shark: { gentle: ['ship', 'sheep'], trap: ['shoe', 'shell'] }, // sh-pool only
  shed: { gentle: ['shark', 'sheep'], trap: ['ship', 'shell'] }, // sh-pool only; shed+shop avoided (FORBIDDEN_PAIR)
  // ── Digraphs-ch pool (ticket digraphs-ch wordPack) ──────────────────
  // Per `design/word-song/digraphs-ch-word-list.md` §2: structurally the
  // SAME as the sh tier's cross-orthography distractor pattern (ch reuses
  // that machinery — no new architecture). The ch-tier distractor rule is
  // ch-pool-only + ch/s-contrast:
  //   - gentle (problems 1-3): BOTH entries are ch-pool neighbours —
  //     Marian distinguishes by picture, builds ch-pool cohesion.
  //   - trap (problems 4-8): for the strong-trap subset (`chip`, `chat`,
  //     `chick` — the 3 targets with a real-English-word, 8yo-appropriate
  //     s-contrast partner) one trap entry is the ch/s-contrast distractor
  //     (`sip`/`sat`/`sick`) + one ch-pool neighbour; for the weak-trap
  //     subset (`chin`, `chop`, `chest`, `chug` — `sin` adult-register,
  //     `sop` obscure, `sest`/`sug` non-words; spec §2) BOTH trap entries
  //     are ch-pool neighbours.
  // No CVC short-vowel words, NO sh-tier words, and NO c-initial /k/-words
  // appear in any ch-trio (cross-tier hygiene, spec §6 — the c-says-/k/
  // trap is handled by Emma's intro script, NOT a /k/-onset distractor).
  // FORBIDDEN_PAIRS pre-checked: `[chest,chip]`, `[chick,chin]`,
  // `[chest,box]` — no row below pairs a target with a forbidden
  // silhouette neighbour. Unlike the sh tier, ch entries carry NO
  // `phoneme` tag (the /tʃ/-vs-/s/ contrast is tested by chip selection,
  // not phoneme-scoping) — `sip`/`sat`/`sick` stay untagged and the
  // opt-in phoneme-scoping branch in `pickDistractors` never runs for
  // ch-tier rows.
  //
  // The §2 matrix pairings also satisfy the CVC-tier gentle/trap axis
  // tests in `wordDistractors.test.ts` (which DO apply to ch entries
  // because they set `vowel`, unlike sh): every gentle distractor differs
  // from its target on vowel; every trap distractor shares an axis
  // (ch-pool neighbours share the `c` onset, s-contrast traps share the
  // vowel + ending consonant).
  //
  // Strong-trap subset — ch/s contrast trap + ch-pool neighbour:
  chip: { gentle: ['chop', 'chug'], trap: ['sip', 'chick'] }, // ch/s minimal pair (sip) + ch-neighbour; chest avoided (FORBIDDEN_PAIR)
  chat: { gentle: ['chop', 'chug'], trap: ['sat', 'chest'] }, // ch/s minimal pair (sat) + ch-neighbour
  chick: { gentle: ['chop', 'chug'], trap: ['sick', 'chest'] }, // ch/s minimal pair (sick) + ch-neighbour; chin avoided (FORBIDDEN_PAIR)
  // Weak-trap subset — ch-pool neighbours both tiers (no shippable
  // s-contrast word: sin adult-register, sop obscure, sest/sug non-words):
  chin: { gentle: ['chop', 'chug'], trap: ['chest', 'chat'] }, // ch-pool only; chick avoided (FORBIDDEN_PAIR)
  chop: { gentle: ['chug', 'chest'], trap: ['chin', 'chat'] }, // ch-pool only
  chest: { gentle: ['chop', 'chug'], trap: ['chat', 'chick'] }, // ch-pool only; chip avoided (FORBIDDEN_PAIR)
  chug: { gentle: ['chop', 'chest'], trap: ['chin', 'chat'] }, // ch-pool only
  // ── Digraphs-th pool (ticket digraphs-th wordPack) ──────────────────
  // Per `design/word-song/digraphs-th-word-list.md` §2 (RECONCILED against
  // Dave's th-addendum): structurally REUSES the sh + ch cross-orthography
  // distractor machinery — no new architecture. The th-tier distractor
  // rule is th-pool-only + th/t-contrast:
  //   - gentle (problems 1-3): BOTH entries are th-pool neighbours —
  //     Marian distinguishes by picture, builds th-pool cohesion.
  //   - trap (problems 4-8): for the strong-trap subset (`thin`, `thick`,
  //     `path`, `bath`, `math` — the 5 targets with a real-English-word,
  //     8yo-appropriate t-contrast partner) one trap entry is the
  //     th/t-contrast distractor (`tin`/`tick`/`pat`/`bat`/`mat`) + one
  //     th-pool neighbour; for the weak-trap subset (`moth`, `cloth` — no
  //     clean real-word t-contrast: `moth`→"mot" non-word, `cloth` has a
  //     `/kl/` onset) BOTH trap entries are th-pool neighbours.
  // No generic CVC short-vowel words, NO sh-tier or ch-tier words, and NO
  // voiced-/ð/ words appear in any th-trio (cross-tier hygiene, spec §6) —
  // EXCEPT `bat`/`mat`, which are dual-role: they are shipped short-a CVC
  // `TARGET_WORDS` entries referenced here by string as `bath`'s/`math`'s
  // diagnostic t-contrast trap (the minimal-pair partner IS the trap, not
  // generic filler — same posture as sh's `sip`).
  // FORBIDDEN_PAIRS pre-checked: `[thin,thick]`, `[path,moth]`,
  // `[bath,box]` — no row below pairs a target with a forbidden silhouette
  // neighbour.
  //
  // Phoneme-scoping: every th-word distractor carries `phoneme: '/θ/'`
  // (matches the th target); `tin`/`tick`/`pat` (new distractor-only) and
  // `bat`/`mat` (dual-role) are UNTAGGED and pass the opt-in phoneme check
  // by design — the same posture sh used for `sip`. The phoneme-scoping
  // branch in `pickDistractors` is reactivated for th-tier targets (it was
  // inert for ch) but never rejects a v1 th-tier pairing.
  //
  // NOTE — unlike the sh + ch tiers, the th-tier rows are NOT guaranteed
  // to satisfy the generic CVC-tier gentle/trap axis tests in
  // `wordDistractors.test.ts`: th-pool neighbours used as traps (e.g.
  // `bath`'s trap `thin`, `moth`'s trap `thin`/`thick`) share the `th`
  // grapheme / `/θ/` phoneme but NOT a starting char, ending char, vowel,
  // or category. ch passed those generic tests only coincidentally (every
  // ch word starts `c`). The generic axis tests are therefore scoped to
  // exclude all digraph-tier words via `DIGRAPH_TIER_WORDS`; the th-tier
  // distractor rule (th/t contrast OR th-pool neighbour) is asserted in
  // the dedicated 'digraphs-th tier' describe block instead — the same
  // posture the sh-tier comment block already documents.
  //
  // Strong-trap subset — th/t contrast trap + th-pool neighbour:
  thin: { gentle: ['bath', 'math'], trap: ['tin', 'path'] }, // th/t minimal pair (tin) + th-neighbour; thick avoided (FORBIDDEN_PAIR)
  thick: { gentle: ['bath', 'math'], trap: ['tick', 'path'] }, // th/t minimal pair (tick) + th-neighbour; thin avoided (FORBIDDEN_PAIR)
  path: { gentle: ['bath', 'cloth'], trap: ['pat', 'thick'] }, // th/t minimal pair (pat) + th-neighbour; moth avoided (FORBIDDEN_PAIR)
  bath: { gentle: ['path', 'math'], trap: ['bat', 'thin'] }, // th/t minimal pair (bat — dual-role) + th-neighbour
  math: { gentle: ['path', 'bath'], trap: ['mat', 'thick'] }, // th/t minimal pair (mat — dual-role) + th-neighbour
  // Weak-trap subset — th-pool neighbours both tiers (no clean real-word
  // t-contrast: `moth`→"mot" non-word; `cloth`'s `/kl/` onset has no
  // single t-substitutable consonant):
  //
  // SPEC-DEVIATION (flagged to Matt): the spec §2 illustrative matrix
  // gives `moth: trap: ['thin', 'thick']`, but `[thin, thick]` is itself
  // a FORBIDDEN_PAIR (spec §"FORBIDDEN_PAIRS additions" + §6) — so that
  // pair would trip `pickDistractors`' `assertNotForbidden(d1, d2)` check
  // and throw at runtime. The spec explicitly labels its §2 matrix as
  // "illustrative; Kevin owns the final TARGET_PAIRINGS rows" and names
  // "No FORBIDDEN_PAIR adjacency" as a load-bearing constraint, so the
  // FORBIDDEN_PAIRS rule wins: `moth`'s trap uses two th-pool neighbours
  // that are NOT a forbidden pair with `moth` (`[path, moth]` is
  // forbidden, so `path` is excluded) nor with each other. `['thin',
  // 'math']` — both th-pool, both `/θ/`-tagged, no forbidden adjacency,
  // distinct from `moth`'s gentle pair. See PR description + ClickUp
  // comment.
  moth: { gentle: ['bath', 'cloth'], trap: ['thin', 'math'] }, // th-pool only; path avoided (FORBIDDEN_PAIR); spec's [thin,thick] is itself a FORBIDDEN_PAIR — see deviation note above
  cloth: { gentle: ['bath', 'math'], trap: ['thin', 'moth'] }, // th-pool only
  // ── Sight-words tier (Wave 11, ticket 86ca7xmr8) ──────────────────────
  // Per Dave's W11-01 §"Distractor pairing reference". GENTLE distractors
  // (P1-3) are visually + categorically distinct from the target
  // (different length / first letter). TRAP distractors (P4-8) are
  // visual-shape / high-frequency confusables (was/saw-class, the/he,
  // he/she, do/to/go/no) — forcing TRUE whole-word discrimination, the
  // axis Dave specifies (visual-structural, NOT phonics rhyme/onset).
  //
  // SCOPE NOTE (Kevin → Devon W11-03): every distractor here resolves via
  // `getWordEntry` so the `wordDistractors.test.ts` "every target has a
  // deterministic gentle+trap pair" regression stays green. Distractors
  // are drawn ONLY from resolvable pack words: the 20 sight-pool words +
  // the existing CVC words `cat`/`hot`/`man`. Dave's matrix names a few
  // out-of-pack confusables (saw, off, an, at) as the IDEAL trap chips;
  // those are NOT pack entries, so this data-layer matrix substitutes the
  // nearest resolvable in-pool confusable. If Devon's W11-03 visual-shape
  // distractor model needs the true out-of-pack confusables (saw/off/an/
  // at), they're his to add as sight-word DISTRACTOR_ONLY_WORDS rows in
  // the render PR — flagged in the PR body. No FORBIDDEN_PAIR adjacency;
  // all pairs distinct from target and from each other (verified).
  the: { gentle: ['cat', 'go'], trap: ['he', 'she'] },
  a: { gentle: ['is', 'see'], trap: ['i', 'it'] },
  i: { gentle: ['go', 'see'], trap: ['in', 'it'] },
  is: { gentle: ['go', 'cat'], trap: ['in', 'it'] },
  it: { gentle: ['go', 'see'], trap: ['in', 'is'] },
  in: { gentle: ['go', 'cat'], trap: ['it', 'is'] },
  to: { gentle: ['cat', 'see'], trap: ['do', 'no'] },
  go: { gentle: ['cat', 'is'], trap: ['no', 'do'] },
  no: { gentle: ['cat', 'is'], trap: ['go', 'do'] },
  do: { gentle: ['cat', 'is'], trap: ['go', 'no'] },
  was: { gentle: ['cat', 'go'], trap: ['see', 'said'] },
  see: { gentle: ['go', 'cat'], trap: ['she', 'he'] },
  said: { gentle: ['go', 'cat'], trap: ['see', 'was'] },
  he: { gentle: ['cat', 'go'], trap: ['she', 'the'] },
  she: { gentle: ['cat', 'go'], trap: ['he', 'see'] },
  we: { gentle: ['cat', 'go'], trap: ['he', 'she'] },
  for: { gentle: ['cat', 'is'], trap: ['on', 'not'] },
  on: { gentle: ['go', 'see'], trap: ['in', 'not'] },
  not: { gentle: ['go', 'see'], trap: ['hot', 'man'] },
  // NOTE: 'can' is INTENTIONALLY absent from this sight-word block. It is
  // dual-role and its `TARGET_PAIRINGS['can']` row already exists above as
  // the short-a CVC pairing (`gentle: ['sun','dog'], trap: ['fan','man']`)
  // — `can` carries `vowel: 'a'`, so the CVC gentle/trap-AXIS regression
  // tests run on it and require that CVC row. Overwriting it with a
  // sight-word visual-shape pairing breaks the CVC axis test. The
  // sight-word render for `can` is driven by the per-problem
  // `contentType: 'sight-word'` (parser-set from "Find the word: can.")
  // + Devon's W11-03 distractor model — NOT this CVC matrix lookup — so
  // no sight-word `can` row is needed here. Same dual-role discipline as
  // the `can` TARGET_WORDS note above.
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
