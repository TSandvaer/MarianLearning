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

/** Hint shown to the model so it knows the broader pack — even though it
 *  isn't authoring distractors, knowing the rhyme families helps it order
 *  the gentle-vs-trap window correctly (per Kyle's distractor spec). */
export const WORD_SONG_DISTRACTOR_HINTS = [
  '- /æt/ rhyme family: cat, hat, bat, mat — pack these in the trap window when one is the target.',
  '- /æn/ rhyme family: fan, man, pan, can, van — same.',
  '- /æg/ rhyme family: bag, tag — same.',
  '- /æp/ rhyme family: cap.',
  '- /æd/ rhyme family: dad.',
  '- /æm/ rhyme family: jam.',
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
