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
