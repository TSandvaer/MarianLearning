// Word lists embedded in the planner's system prompt. Lifted out of
// `_planner.ts` so the prompt copy stays scannable and so the (rare)
// future case of "Marian outgrew short-a, add short-o" is a single-file
// edit.
//
// IMPORTANT: this list MUST stay aligned with the canonical client-side
// pack in `src/screens/WordSong/wordPack.ts`. If the client doesn't have a
// picture for a word, the model handing back that word will crash the
// chip render. The list of 14 targets here is exactly the 14 entries with
// `isTarget: true` in wordPack.ts as of the Phase 3a freeze.
//
// We DELIBERATELY don't import wordPack.ts here — that would pull frontend
// code into the api/ tsconfig surface (which is server-only). Instead, the
// alignment is a static contract enforced by code review + a smoke test
// in claude.test.ts that asserts every model-generated word is in this
// list. If the client adds a 15th target word, this file gets a
// corresponding edit; the smoke test fails until both move together.

/** The 14 target words available for word-song level 1. Formatted for
 *  embedding directly inside a Markdown-list-style prompt block. */
export const WORD_SONG_TARGET_WORDS_FOR_PROMPT = [
  'cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van',
].join('\n')

/**
 * The 11 target words for the short-o sibling tier (`cvc-words-short-o`).
 *
 * v1 (PR #150, locked 2026-05-04 per
 * `design/word-song/short-o-pool-expansion.md`): 8 words —
 * `dog, mop, log, pot, box, fox, mom, hot`. §10 Q1/Q2 decisions applied
 * (keep box+fox with first-encounter scaffolding, `hot` over `dot` for
 * the 8th slot — steaming-bowl picture is a stronger anchor for an L2
 * 8-year-old than an abstract circle).
 *
 * v2 (ticket 86c9teu2e, this PR — `short-o-pool-extension.md`): pool
 * extended 8 → 11 to match short-u parity and unblock the cross-vowel
 * mode pool-size floor (≥ 11 per `cross-vowel-mix-spec.md` §6 +
 * `cross-vowel-discrimination-threshold.md` §"Recommendations"). The
 * 3 new entries are `cot, top, pop` — all wholly-new, all CVC short-o,
 * adding two new rhyme triplets to the pool: `/ɒt/` (`pot, hot, cot`)
 * and `/ɒp/` (`mop, top, pop`). See spec §3 audit for the per-word
 * rationale.
 *
 * Pool composition:
 *  - 4 promoted from the v1 distractor-only pool: `dog, log, pot, fox`
 *    (their `WordEntry.isTarget` flips to true in `wordPack.ts` while
 *    they remain valid distractors for short-a sessions — the two
 *    flags are independent).
 *  - 4 wholly new in v1: `mop, box, mom, hot`.
 *  - 3 wholly new in v2 (this PR): `cot, top, pop`.
 *
 * Same alignment contract as `WORD_SONG_TARGET_WORDS_FOR_PROMPT`: the
 * client-side `wordPack.ts` MUST carry every word here as
 * `isTarget: true` plus a `TARGET_PAIRINGS` row. The round-trip suite
 * in `src/screens/WordSong/plannerRoundTrip.test.ts` + the planner
 * unit tests in `api/_planner.test.ts` enforce that.
 */
export const WORD_SONG_TARGET_WORDS_SHORT_O =
  'dog, mop, log, pot, box, fox, mom, hot, cot, top, pop'

/**
 * The 11 target words for the short-u sibling tier (`cvc-words-short-u`).
 * Locked by Thomas 2026-05-09 per
 * `design/word-song/short-u-pool-expansion.md` §1 / §10 Q1=A. Eleven
 * entries spanning seven rhyme families (`/ʌn/`, `/ʌp/`, `/ʌs/`,
 * `/ʌg/`, `/ʌt/`, `/ʌb/`, `/ʌm/`) with the `/ʌg/` triplet
 * (`bug, jug, rug`) as the densest cluster — a deliberate trap-window
 * lever for Haiku's distractor-window guidance.
 *
 * Pool composition:
 *  - 3 promoted from the v1 distractor-only pool: `sun, cup, bus`
 *    (their `WordEntry.isTarget` flips to true in `wordPack.ts`).
 *  - 8 wholly new entries: `bug, nut, tub, bun, jug, rug, hut, gum`.
 *
 * Same alignment contract as `WORD_SONG_TARGET_WORDS_FOR_PROMPT` /
 * `WORD_SONG_TARGET_WORDS_SHORT_O`: the client-side `wordPack.ts`
 * MUST carry every word here as `isTarget: true` plus a
 * `TARGET_PAIRINGS` row. The round-trip suite in
 * `src/screens/WordSong/plannerRoundTrip.test.ts` enforces it.
 */
export const WORD_SONG_TARGET_WORDS_SHORT_U =
  'sun, cup, bus, bug, nut, tub, bun, jug, rug, hut, gum'

/**
 * The 8 target words for the short-i sibling tier (`cvc-words-short-i`).
 * Locked by Thomas 2026-05-09 per
 * `design/word-song/short-i-pool-expansion.md` §1 / §10 Q1=A
 * (recommended 11-word pool with Phase-2 fallback). Phase-2 voluntary
 * drop: `hip` and `rim` removed from the recommended pool for vocab
 * unfamiliarity (rosehip + bicycle wheel rim were both Phase-2-flagged
 * in the spec audit). Final ship pool is 8 entries spanning four rhyme
 * families (`/ɪg/`, `/ɪn/`, `/ɪb/`, `/ɪd/`) plus a singleton `/ɪp/`
 * (sip). The `/ɪg/` triplet (`pig, wig, fig`) is the densest cluster —
 * a deliberate trap-window lever for Haiku's distractor-window guidance,
 * mirroring short-u's `/ʌg/` triplet (`bug, jug, rug`) and short-a's
 * `/æt/` cluster.
 *
 * Pool composition:
 *  - 0 promoted from the v1 distractor-only pool. Short-i had no
 *    candidates that survived the strict audit for distractor-only use
 *    (verbs/digraphs/picture-instability dominated the rejected pool).
 *  - 8 wholly new entries: `pig, pin, bin, wig, bib, fig, lid, sip`.
 *
 * Same alignment contract as the prior tiers: the client-side
 * `wordPack.ts` MUST carry every word here as `isTarget: true` plus a
 * `TARGET_PAIRINGS` row. The round-trip suite in
 * `src/screens/WordSong/plannerRoundTrip.test.ts` enforces it.
 */
export const WORD_SONG_TARGET_WORDS_SHORT_I =
  'pig, pin, bin, wig, bib, fig, lid, sip'

/**
 * The 9 target words for the short-e sibling tier (`cvc-words-short-e`).
 * Locked by Thomas 2026-05-09 per
 * `design/word-song/short-e-pool-expansion.md` §1 / §10 Q1 = A
 * (audit-derived 9-word ship pool). The final single-vowel tier in
 * the o → u → i → e canonical arc — after short-e masters, the
 * literacy track moves to digraphs.
 *
 * Pool composition:
 *  - 1 promoted from the v1 distractor-only pool: `pen`
 *    (its `WordEntry.isTarget` flips to true in `wordPack.ts` while
 *    it remains valid as a distractor for short-a / short-o /
 *    short-u / short-i sessions — the two flags are independent).
 *  - 8 wholly new entries: `bed, leg, hen, web, net, jet, gem, egg`.
 *
 * Phonetic spread (6 distinct codas across 9 words):
 *  - /ɛd/: bed
 *  - /ɛg/: leg, egg  (densest cluster after /ɛn/ + /ɛt/)
 *  - /ɛn/: hen, pen
 *  - /ɛb/: web
 *  - /ɛt/: net, jet
 *  - /ɛm/: gem
 *
 * Note: `egg` is 3-letter spelling-CVC with geminate `gg` decoding
 * as a single /g/ phoneme — applies the short-o `box`/`fox` precedent
 * (practitioner curricula universally list as short-e CVC). No
 * first-encounter scaffolding line is needed for `egg` specifically
 * (its decoding load is fractional, not load-bearing); the spec's
 * §4 `bed/bid` minimal-pair opener is the load-bearing scaffolding,
 * but that opener is INTENTIONALLY OUT OF SCOPE for this canon-wire
 * ticket per Matt's brief — a follow-up ticket lands the
 * lifetime-first-encounter wiring if real-iPad observation surfaces
 * /ɛ/–/ɪ/ confusion.
 *
 * Same alignment contract as the prior tiers: the client-side
 * `wordPack.ts` MUST carry every word here as `isTarget: true` plus a
 * `TARGET_PAIRINGS` row. The round-trip suite in
 * `src/screens/WordSong/plannerRoundTrip.test.ts` enforces it.
 */
export const WORD_SONG_TARGET_WORDS_SHORT_E =
  'bed, leg, hen, pen, web, net, jet, gem, egg'

/**
 * The 7 target words for the digraphs-sh tier (`digraphs-sh`) — the
 * FIRST digraph tier, sitting between `cvc-words-short-e` and
 * `sight-words` in `WordSongNode` / `LITERACY_TREE` (PR #217's
 * 3-sibling digraph split — `digraphs-sh` / `digraphs-ch` /
 * `digraphs-th-voiceless`).
 *
 * Locked 2026-05-14 per `design/word-song/digraphs-sh-word-list.md` §1
 * (Option C-minus, via Dave's long-vowel addendum). Seven sh-initial
 * words:
 *  - 4 conventional sh-CVC: `ship, shell, shed, shop` — the `/ʃ/`
 *    digraph onset + a single short vowel inside.
 *  - 3 long-vowel sight-word-hybrids: `shoe` (/uː/), `sheep` (/iː/),
 *    `shark` (/ɑːr/) — their rest-of-word vowel is OUTSIDE Marian's
 *    formal short-vowel phonics tiers. These carry `hybridMode: true`
 *    in `wordPack.ts`; the planner reads that flag (via
 *    `DIGRAPHS_SH_HYBRID_MODE_WORDS` below) to SUPPRESS
 *    segmentation / spelling / decode-from-phoneme problem types for
 *    them — they are chip-tap-only, picture+audio scaffold, never
 *    decoded or segmented (Kyle's spec §6.1 + Dave addendum §Q7d).
 *
 * Order MUST match the `isTarget: true` sh-tier rows in `wordPack.ts`
 * (Devon's parallel PR #220): `ship, shell, shoe, sheep, shark, shed,
 * shop`. `shore` was deliberately dropped from the pool.
 *
 * Unlike the short-vowel tiers, the sh-tier is classified by the
 * digraph phoneme `/ʃ/`, not by a short-vowel code — so there is no
 * `vowel` field on these `wordPack.ts` entries and no rhyme-family
 * block in `WORD_SONG_DISTRACTOR_HINTS` below.
 *
 * Same alignment contract as the prior tiers: the client-side
 * `wordPack.ts` MUST carry every word here as `isTarget: true` plus a
 * `TARGET_PAIRINGS` row. The round-trip suite in
 * `src/screens/WordSong/plannerRoundTrip.test.ts` + the planner unit
 * tests in `api/_planner.test.ts` enforce that.
 */
export const WORD_SONG_TARGET_WORDS_DIGRAPHS_SH =
  'ship, shell, shoe, sheep, shark, shed, shop'

/**
 * The subset of the digraphs-sh pool whose `wordPack.ts` entries carry
 * `hybridMode: true` — long / r-controlled vowels outside Marian's
 * formal phonics tiers (`shoe` /uː/, `sheep` /iː/, `shark` /ɑːr/).
 *
 * The planner consumes this list as the hybridMode GATE: when the
 * focus node is `digraphs-sh`, the system prompt instructs Haiku that
 * these three words are chip-tap recognition ONLY — no segmentation,
 * no spelling, no decode-from-phoneme prompt shapes. The 4
 * conventional sh-CVC words (`ship, shell, shed, shop`) take the full
 * decode treatment.
 *
 * MUST stay aligned with the `hybridMode: true` rows in `wordPack.ts`.
 * Enforced by code review + `api/_planner.test.ts`.
 */
export const WORD_SONG_TARGET_WORDS_DIGRAPHS_SH_HYBRID: readonly string[] = [
  'shoe',
  'sheep',
  'shark',
] as const

/** Hint shown to the model so it knows the broader pack — even though it
 *  isn't authoring distractors, knowing the rhyme families helps it order
 *  the gentle-vs-trap window correctly (per Kyle's distractor spec).
 *
 *  Short-a rhyme block stays unconditioned for now — it's harmless on
 *  short-o, short-u, and short-i sessions because those tracks override
 *  the pool upstream in the system prompt. The short-u block (ticket
 *  86c9q9ben / AC3b) was included to give Haiku explicit cluster
 *  guidance on the /ʌg/ triplet (`bug, jug, rug`) which is the densest
 *  rhyme family in the v3 short-u pool — same shape and motivation as
 *  short-a's `/æt/` cluster. The short-i block (ticket 86c9qdba4) is
 *  included for the same reason: the `/ɪg/` triplet (`pig, wig, fig`)
 *  is the densest rhyme family in the v4 short-i pool.
 *
 *  Short-o rhyme block added with the v2 pool extension (ticket
 *  86c9teu2e, `design/word-song/short-o-pool-extension.md` AC5). The
 *  pool extension to 11 entries (`+ cot, top, pop`) emerges two new
 *  rhyme triplets — `/ɒt/` (`pot, hot, cot`) and `/ɒp/` (`mop, top,
 *  pop`) — which parallel short-u's `/ʌg/` triplet and short-i's
 *  `/ɪg/` triplet as the densest clusters in their pools. Surfacing
 *  the rhyme families lets Haiku exploit them as trap-window levers,
 *  mirroring the short-u/short-i precedents.
 *
 *  The short-e block (ticket 86c9teua2 / AC3b) carries 6 rhyme-family
 *  lines for the 9-word short-e pool — three doublets (`/ɛg/` leg+egg,
 *  `/ɛn/` hen+pen, `/ɛt/` net+jet) give Haiku explicit trap-window
 *  guidance in the same shape as the prior tiers' densest clusters. */
export const WORD_SONG_DISTRACTOR_HINTS = [
  '- /æt/ rhyme family: cat, hat, bat, mat — pack these in the trap window when one is the target.',
  '- /æn/ rhyme family: fan, man, pan, can, van — same.',
  '- /æg/ rhyme family: bag, tag — same.',
  '- /æp/ rhyme family: cap.',
  '- /æd/ rhyme family: dad.',
  '- /æm/ rhyme family: jam.',
  '- /ɒg/ rhyme family: dog, log — pack these in the trap window when one is the target.',
  '- /ɒp/ rhyme family: mop, top, pop — pack these in the trap window when one is the target.',
  '- /ɒt/ rhyme family: pot, hot, cot — pack these in the trap window when one is the target.',
  '- /ɒks/ rhyme family: box, fox — same.',
  '- /ɒm/ rhyme family: mom.',
  '- /ʌn/ rhyme family: sun, bun — pack these in the trap window when one is the target.',
  '- /ʌp/ rhyme family: cup.',
  '- /ʌs/ rhyme family: bus.',
  '- /ʌg/ rhyme family: bug, jug, rug — pack these in the trap window when one is the target.',
  '- /ʌt/ rhyme family: nut, hut.',
  '- /ʌb/ rhyme family: tub.',
  '- /ʌm/ rhyme family: gum.',
  '- /ɪg/ rhyme family: pig, wig, fig — pack these in the trap window when one is the target.',
  '- /ɪn/ rhyme family: pin, bin — same.',
  '- /ɪb/ rhyme family: bib.',
  '- /ɪd/ rhyme family: lid.',
  '- /ɪp/ rhyme family: sip.',
  '- /ɛd/ rhyme family: bed.',
  '- /ɛg/ rhyme family: leg, egg — pack these in the trap window when one is the target.',
  '- /ɛn/ rhyme family: hen, pen — pack these in the trap window when one is the target.',
  '- /ɛb/ rhyme family: web.',
  '- /ɛt/ rhyme family: net, jet — pack these in the trap window when one is the target.',
  '- /ɛm/ rhyme family: gem.',
].join('\n')

/**
 * Novel short-a CVC probe words used on the cvc-words graduation
 * session (ticket 86c9m3aec). These are NOT in the canonical 14-word
 * pack — Marian must decode them cold. Source: Dave's developmental
 * review § P1 + Kyle's short-o pool spec recommendation
 * (`design/word-song/short-o-pool-expansion.md` § 4 Stage 2).
 *
 * `cap` was excluded from the spec's tentative `nap, cap, rat, map,
 * tap` list because it already lives in the canonical 14-word pack —
 * using it as a "novel" probe would defeat the generalization signal.
 *
 * IMPORTANT: this list MUST stay aligned with the client-side
 * `wordPack.ts` — every novel probe needs a matching `WordEntry`
 * (`isTarget: true`) and a `TARGET_PAIRINGS` row, otherwise the
 * browser parser rejects the read line ("non-target word") and
 * `pickDistractors` throws on a missing pairing. The pair is
 * enforced by code review + the round-trip test
 * `src/screens/WordSong/plannerRoundTrip.test.ts`.
 */
export const WORD_SONG_NOVEL_PROBE_WORDS: readonly string[] = [
  'nap',
  'rat',
  'map',
  'tap',
] as const

/** Same shape as WORD_SONG_TARGET_WORDS_FOR_PROMPT — comma-joined for
 *  embedding inside a Markdown list. The graduation prompt names this
 *  list explicitly so Haiku knows which words count as "novel". */
export const WORD_SONG_NOVEL_PROBE_WORDS_FOR_PROMPT =
  WORD_SONG_NOVEL_PROBE_WORDS.join(', ')
