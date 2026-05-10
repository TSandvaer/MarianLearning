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
 * The 8 target words for the short-o sibling tier (`cvc-words-short-o`).
 * Locked by Thomas 2026-05-04 per
 * `design/word-song/short-o-pool-expansion.md` §1 with the §10 Q1/Q2
 * decisions applied (keep box+fox with first-encounter scaffolding,
 * `hot` over `dot` for the 8th slot — steaming-bowl picture is a
 * stronger anchor for an L2 8-year-old than an abstract circle).
 *
 * Pool composition:
 *  - 4 promoted from the v1 distractor-only pool: `dog, log, pot, fox`
 *    (their `WordEntry.isTarget` flips to true in `wordPack.ts` while
 *    they remain valid distractors for short-a sessions — the two
 *    flags are independent).
 *  - 4 wholly new entries: `mop, box, mom, hot`.
 *
 * Same alignment contract as `WORD_SONG_TARGET_WORDS_FOR_PROMPT`: the
 * client-side `wordPack.ts` MUST carry every word here as
 * `isTarget: true` plus a `TARGET_PAIRINGS` row. The smoke test in
 * `claude.test.ts` round-trips this list to enforce that.
 */
export const WORD_SONG_TARGET_WORDS_SHORT_O =
  'dog, mop, log, pot, box, fox, mom, hot'

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
 *  is the densest rhyme family in the v4 short-i pool. */
export const WORD_SONG_DISTRACTOR_HINTS = [
  '- /æt/ rhyme family: cat, hat, bat, mat — pack these in the trap window when one is the target.',
  '- /æn/ rhyme family: fan, man, pan, can, van — same.',
  '- /æg/ rhyme family: bag, tag — same.',
  '- /æp/ rhyme family: cap.',
  '- /æd/ rhyme family: dad.',
  '- /æm/ rhyme family: jam.',
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
