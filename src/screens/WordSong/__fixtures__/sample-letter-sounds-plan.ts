/**
 * Hand-crafted wire-shape fixture for a `letter-sounds` plan — the
 * phoneme→grapheme tier the parser was widened to accept in Wave 7 A8b
 * (ticket 86c9y6gea).
 *
 * Wire shape conventions:
 *   - Utterance ids use the literal `word.` prefix (same as every other
 *     Word Song tier — `letter-sounds` is a content type, NOT a separate
 *     id namespace). The id discriminant rule is the same as in
 *     `planFromServer.ts` file header.
 *   - Read line: `"Which letter says <MNEMONIC>?"` — the new template
 *     that routes this content to `contentType: 'letter-sounds'`.
 *     `<MNEMONIC>` is a plain-prose English approximation of an
 *     isolated phoneme (e.g. `mmm`, `tuh`, `o`). The TTS render
 *     pipeline (`api/_tts.ts` PHONEME_OVERRIDES tier-aware substitution
 *     shipped via PR #337) wraps each mnemonic in `<phoneme>` SSML at
 *     synthesize time — the canon text stays plain prose.
 *   - Other slots (correct / reprompt / hint / giveAnswer) carry the
 *     shape Kyle's A5 spec §2.2 pins. The `correct` and `giveAnswer`
 *     slots mention the target LETTER NAME alongside the mnemonic
 *     (e.g. `"Yes! M says mmm."`) — the letter mention is plain prose
 *     (no `<phoneme>` wrap, per spec §2.3 anti-rule).
 *
 * Mnemonics are drawn to exercise both consonant + vowel branches and
 * to cover the b/d/p/q confusion-class carrier (per Kyle's A5 spec
 * §1.2 + §3 — the b/d/p/q load-bearing concept transferred from A1).
 * The parser does not consult mnemonic-class or pedagogical band
 * membership — it only checks `LETTER_SOUND_MNEMONIC_POOL`.
 * Pedagogical tier bands are a planner-side concern, not a parser-side
 * concern.
 *
 * Mnemonic → target letter mapping used here (matches Kyle's A5 §2.3
 * table + the live canon at `public/canon/word-song/level-1/letter-
 * sounds.json` shipped via PR #337):
 *
 *   mmm → M, sss → S, hhh → H, a → A, tuh → T, o → O, lll → L, buh → B
 */

import type { ServerPlan } from '../planFromServer'

/** 8-problem `letter-sounds` plan in the exact wire shape the planner emits. */
export const SAMPLE_LETTER_SOUNDS_PLAN: ServerPlan = {
  id: 'haiku-word-letter-sounds-001',
  label: 'Letter Sounds — consonants + vowels mix (fixture)',
  utterances: [
    { mnemonic: 'mmm', letter: 'M' },
    { mnemonic: 'sss', letter: 'S' },
    { mnemonic: 'hhh', letter: 'H' },
    { mnemonic: 'a', letter: 'A' },
    { mnemonic: 'tuh', letter: 'T' },
    { mnemonic: 'o', letter: 'O' },
    { mnemonic: 'lll', letter: 'L' },
    { mnemonic: 'buh', letter: 'B' },
  ].flatMap(({ mnemonic, letter }, i) => {
    const n = i + 1
    return [
      { id: `word.p${n}.read`, text: `Which letter says ${mnemonic}?` },
      { id: `word.p${n}.correct`, text: `Yes! ${letter} says ${mnemonic}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: `Listen. ${mnemonic}.` },
      {
        id: `word.p${n}.giveAnswer`,
        text: `This one is ${letter}. ${letter} says ${mnemonic}.`,
      },
    ]
  }),
}
