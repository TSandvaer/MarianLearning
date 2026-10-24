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
 *
 * On the device these four are today's check (`graduationProbeWords`), kept
 * until every word of {@link PROBE_RESERVE_WORDS} has its Lily audio.
 */
export const NOVEL_PROBE_WORDS: readonly string[] = ['nap', 'rat', 'map', 'tap']

/**
 * The cvc-words probe reserve (Dave 2026-10-24, run run_3d3d82fb3b65
 * message msg_135871ebd91e; `design/research/no-claude-variety-2026-10-23.md`
 * § 2.4): 8 short-a words, in Dave's order. Each learner's check draws the
 * best 6 of them across two sessions and passes at 5 of 6
 * (`probeReserve.ts`). tap is out: every learner meets it before cvc-words
 * ("Tap the letter C."). None of the 8 is in a canon plan; map, nap, rat,
 * ham, cab, ram and pad are Letter Critters said words, so the picker
 * skips per learner (the seen-record), not for everyone.
 */
export const PROBE_RESERVE_WORDS: readonly string[] = [
  'map',
  'nap',
  'rat',
  'ham',
  'cab',
  'rag',
  'ram',
  'pad',
]

/**
 * Every word a check can serve, today's four and the reserve: the probe
 * canon's blocks (`scripts/spliceGraduationProbeCanon.ts`), the swap's
 * allow-list (`withGraduationProbes`) and the session-end split.
 */
export const GRADUATION_PROBE_WORDS: readonly string[] = [
  ...new Set([...NOVEL_PROBE_WORDS, ...PROBE_RESERVE_WORDS]),
]
