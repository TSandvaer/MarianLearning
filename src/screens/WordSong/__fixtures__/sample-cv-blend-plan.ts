/**
 * Hand-crafted wire-shape fixture for a `blending-cv` plan.
 *
 * Used by the parser-widening test suite (ticket 86c9kxp08) to pin that
 * the existing `"Tap the <word>."` template continues to parse cleanly
 * after the parser is widened to accept additional content types. Mirrors
 * the post-fix planner output shape that `wordSongSessionPlanFromServer
 *  — round-trips post-fix planner output (P0 86c9kt47v)` already covers,
 * but lifted into a reusable fixture so the new content-type tests can
 * combine cv-blend + cvc-word entries in a single plan.
 *
 * Words are drawn from the canonical 14 CVC short-a target list (see
 * `wordPack.ts`) so they round-trip through the wordPack lookup. No
 * picture-asset assumption — the parser is asset-agnostic by design.
 */

import type { ServerPlan } from '../planFromServer'

/** 8-problem `blending-cv` plan in the exact wire shape the planner emits. */
export const SAMPLE_CV_BLEND_PLAN: ServerPlan = {
  id: 'haiku-word-cvblend-001',
  label: 'CVC short-a — blending-cv (cv-blend fixture)',
  utterances: ['cat', 'hat', 'bat', 'mat', 'bag', 'fan', 'man', 'pan'].flatMap(
    (word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Tap the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    },
  ),
}
