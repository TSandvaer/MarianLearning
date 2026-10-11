/**
 * The cvc-words graduation probe words (ticket 86c9m3aec): short-a CVC
 * words outside the canonical 14-word pack that the planner mixes into a
 * graduation session. Session End splits that session's score into
 * canonical vs novel with this list (`computeGraduationSplit`).
 *
 * The planner's copy is `WORD_SONG_NOVEL_PROBE_WORDS` in
 * `api/_plannerWordList.ts`, which Metro cannot bundle (server code), so
 * the native Session End reads this one. The web suite's
 * `src/screens/WordSong/wordRoundParity.test.tsx` fails when they drift.
 */
export const NOVEL_PROBE_WORDS: readonly string[] = ['nap', 'rat', 'map', 'tap']
