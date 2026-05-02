/**
 * Hand-crafted wire-shape fixture for a `cvc-word` plan — the next-tier
 * content type accepted by the widened parser (ticket 86c9kxp08, step 1
 * of the planner-parser contract).
 *
 * Important
 * ---------
 * The PLANNER does not emit this shape yet. This fixture exists purely
 * to exercise the BROWSER PARSER's new accept path. Step 2 of the
 * contract widens the planner system prompt to actually emit
 * `cvc-word` content; until then, this plan is synthetic test material.
 *
 * Wire shape conventions (kept identical to `blending-cv`):
 *   - Utterance ids use the literal `word.` prefix per the planner-parser
 *     contract (see file header in `planFromServer.ts`). The
 *     content-type discriminant lives on the read-line template, NOT on
 *     the id namespace. `cvc.*` ids are explicitly rejected — that was
 *     the case-1 prod incident in PR #117.
 *   - Read line: `"Read the <word>."` — the new template that routes
 *     this content to `contentType: 'cvc-word'`.
 *   - Other slots (correct / reprompt / hint / giveAnswer) carry the
 *     same shape as `blending-cv` plans. Matching audio copy is not
 *     pinned by this fixture — that's a step-2 concern.
 *
 * Words are drawn from the canonical 14 CVC short-a target list — the
 * same pool the planner already knows about. The parser does not infer
 * "is this a CVC word?" from spelling; it only checks membership against
 * `TARGET_WORD_SET`, which is the right surface area for a content-
 * agnostic step-1 widening.
 */

import type { ServerPlan } from '../planFromServer'

/** 8-problem `cvc-word` plan in the wire shape the future planner will emit. */
export const SAMPLE_CVC_WORD_PLAN: ServerPlan = {
  id: 'haiku-word-cvcword-001',
  label: 'CVC short-a — cvc-word (read-the-word fixture)',
  utterances: ['cat', 'hat', 'bat', 'mat', 'bag', 'fan', 'man', 'pan'].flatMap(
    (word, i) => {
      const n = i + 1
      const cap = word.charAt(0).toUpperCase() + word.slice(1)
      return [
        { id: `word.p${n}.read`, text: `Read the ${word}.` },
        { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
        { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
        { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
        { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
      ]
    },
  ),
}

/**
 * 8-problem MIXED plan — first 4 problems are `blending-cv`, last 4 are
 * `cvc-word`. Sanity check that the discriminant routes per-problem
 * correctly within a single plan. Real plans are unlikely to mix today
 * (step-2 planner will likely emit homogeneous content per session), but
 * the parser must not assume homogeneity.
 */
export const SAMPLE_MIXED_PLAN: ServerPlan = {
  id: 'haiku-word-mixed-001',
  label: 'CVC short-a — mixed cv-blend + cvc-word (synthetic test)',
  utterances: [
    { word: 'cat', verb: 'Tap' },
    { word: 'hat', verb: 'Tap' },
    { word: 'bat', verb: 'Tap' },
    { word: 'mat', verb: 'Tap' },
    { word: 'bag', verb: 'Read' },
    { word: 'fan', verb: 'Read' },
    { word: 'man', verb: 'Read' },
    { word: 'pan', verb: 'Read' },
  ].flatMap(({ word, verb }, i) => {
    const n = i + 1
    const cap = word.charAt(0).toUpperCase() + word.slice(1)
    return [
      { id: `word.p${n}.read`, text: `${verb} the ${word}.` },
      { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: `Let's look. ${cap}.` },
      { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
    ]
  }),
}
