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
 *   - Read line: `"Which letter says <MNEMONIC><TERM>"` — the template
 *     that routes this content to `contentType: 'letter-sounds'`.
 *     `<MNEMONIC>` is a plain-prose English approximation of an
 *     isolated phoneme (e.g. `mmm`, `tuh`, `o`). `<TERM>` is
 *     SOUND-CLASS-DEPENDENT after the British-voice rollout
 *     (2026-06-06): `.` (declarative) for VOICED sounds, `?` (question)
 *     for VOICELESS sounds — see `api/_planner.ts` SOUND-CLASS
 *     CLASSIFICATION. The TTS render pipeline (`api/_tts.ts`
 *     PHONEME_OVERRIDES tier-aware substitution) wraps each mnemonic in
 *     `<phoneme>` SSML at synthesize time — the canon text stays plain
 *     prose.
 *   - Other slots (correct / reprompt / hint / giveAnswer) carry the
 *     shape Kyle's A5 spec §2.2 pins, as amended by the British-voice
 *     rollout: the `hint` is `"It says <MNEMONIC>?"` for FRICATIVES
 *     (s/f/h/v/z) and `"Listen. <MNEMONIC>."` otherwise. The `correct`
 *     and `giveAnswer` slots mention the target LETTER NAME alongside
 *     the mnemonic (e.g. `"Yes! M says mmm."`) — the letter mention is
 *     plain prose (no `<phoneme>` wrap, per spec §2.3 anti-rule).
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
 *   mmm → M, sss → S, hhh → H, aaa → A, tuh → T, ooo → O, lll → L, buh → B
 *   (vowel mnemonics are TRIPLETS — the vowel double-wrap fix)
 */

import type { ServerPlan } from '../planFromServer'

/** 8-problem `letter-sounds` plan in the exact wire shape the planner emits. */
export const SAMPLE_LETTER_SOUNDS_PLAN: ServerPlan = {
  id: 'haiku-word-letter-sounds-001',
  label: 'Letter Sounds — consonants + vowels mix (fixture)',
  utterances: (
    [
      // readTerm: round-2 partition. hint: 'It says X?' = FRICATIVE,
      // 'Listen. X.' = non-fricative. fric: true = round-2 "says it"
      // correct/give lead-in (S/F/H/V). Vowel mnemonics are TRIPLETS.
      { mnemonic: 'mmm', letter: 'M', readTerm: '.', hint: 'Listen. mmm.', fric: false }, // prettier-ignore
      { mnemonic: 'sss', letter: 'S', readTerm: '?', hint: 'It says sss?', fric: true }, // prettier-ignore
      { mnemonic: 'hhh', letter: 'H', readTerm: '?', hint: 'It says hhh?', fric: true }, // prettier-ignore
      { mnemonic: 'aaa', letter: 'A', readTerm: '.', hint: 'Listen. aaa.', fric: false }, // prettier-ignore
      { mnemonic: 'tuh', letter: 'T', readTerm: '?', hint: 'Listen. tuh.', fric: false }, // prettier-ignore
      { mnemonic: 'ooo', letter: 'O', readTerm: '.', hint: 'Listen. ooo.', fric: false }, // prettier-ignore
      { mnemonic: 'lll', letter: 'L', readTerm: '.', hint: 'Listen. lll.', fric: false }, // prettier-ignore
      { mnemonic: 'buh', letter: 'B', readTerm: '.', hint: 'Listen. buh.', fric: false }, // prettier-ignore
    ] as const
  ).flatMap(({ mnemonic, letter, readTerm, hint, fric }, i) => {
    const n = i + 1
    const correct = fric
      ? `Yes. ${letter} says it. ${mnemonic}?`
      : `Yes. ${letter}. ${mnemonic}.`
    const giveAnswer = fric
      ? `This one is ${letter}. ${letter} says it. ${mnemonic}?`
      : `This one is ${letter}. ${mnemonic}.`
    return [
      {
        id: `word.p${n}.read`,
        text: `Which letter says ${mnemonic}${readTerm}`,
      },
      { id: `word.p${n}.correct`, text: correct },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: hint },
      { id: `word.p${n}.giveAnswer`, text: giveAnswer },
    ]
  }),
}
