/**
 * Hand-crafted wire-shape fixture for a `letter-names` plan — the
 * alphabet tier the parser was widened to accept in Wave 7 A4b (ticket
 * 86c9y6nc7).
 *
 * Wire shape conventions:
 *   - Utterance ids use the literal `word.` prefix (same as every other
 *     Word Song tier — `letter-names` is a content type, NOT a separate
 *     id namespace). The id discriminant rule is the same as in
 *     `planFromServer.ts` file header.
 *   - Read line: `"Tap the letter <X>."` — the new template that routes
 *     this content to `contentType: 'letter-names'`. `<X>` is a single
 *     ASCII letter (uppercase or lowercase, A-Z + a-z = 52 glyphs).
 *   - Other slots (correct / reprompt / hint / giveAnswer) carry the
 *     shape Kyle's A1 spec §2.3 pins; reused verbatim from the
 *     production canon at
 *     `public/canon/word-song/level-1/letter-names.json`.
 *
 * Letters are drawn from the 26-letter pool to exercise both the
 * uppercase + lowercase ASCII branches and the b/d/p/q confusion-class
 * carrier (Kyle's A1 spec §1.2 load-bearing concept). The parser does
 * not consult letter-frequency or band membership — it only checks
 * `LETTER_GLYPH_POOL`. Pedagogical tier bands are a planner-side
 * concern, not a parser-side concern.
 */

import type { ServerPlan } from '../planFromServer'

/** 8-problem `letter-names` plan in the exact wire shape the planner emits. */
export const SAMPLE_LETTER_NAMES_PLAN: ServerPlan = {
  id: 'haiku-word-letter-names-001',
  label: 'Letter Names — uppercase + lowercase mix (fixture)',
  utterances: ['C', 'e', 'G', 'J', 'O', 'b', 'W', 'd'].flatMap((letter, i) => {
    const n = i + 1
    return [
      { id: `word.p${n}.read`, text: `Tap the letter ${letter}.` },
      { id: `word.p${n}.correct`, text: `Yes! That's the letter ${letter}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: `Let's look. ${letter}.` },
      {
        id: `word.p${n}.giveAnswer`,
        text: `This one is the letter ${letter}.`,
      },
    ]
  }),
}
