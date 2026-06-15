/**
 * Spoken friendly-name map for the Session-End recap line (M5, ticket
 * 86c9kmwh0).
 *
 * Powers Emma's recap utterance "You worked on <friendly-name> today!" at
 * the end of a session. The friendly name is the SPOKEN, child-facing
 * phrasing of the session's focus `SkillNode`.
 *
 * --- Why this is a SEPARATE map from `progressProjection.labelForSkillNode`
 *
 * `labelForSkillNode` (in `src/screens/Hub/progressProjection.ts`) already
 * maps every `SkillNode` to a human-readable string — but its audience and
 * rendering rules are different, so reusing it here would put the wrong
 * words in Emma's mouth:
 *
 *   - `labelForSkillNode` is WRITTEN and PARENT-facing — it appears in the
 *     Hub celebration caption ("You unlocked add to 20!"). It uses digits
 *     ("add to 10"), curriculum jargon ("CVC words", "digraphs (sh)"), and
 *     band qualifiers ("(no carrying)"). All correct for a parent reading a
 *     caption; all wrong for Emma to SPEAK to Marian.
 *   - This map is SPOKEN and CHILD-facing — Emma says it aloud via TTS to an
 *     8-year-old. Numbers are spelled out ("adding to ten" — Azure TTS reads
 *     digits inconsistently in mid-sentence), the phrasing is gentle and
 *     concrete ("reading words", "taking away"), and curriculum jargon is
 *     dropped entirely. Marian never hears "CVC" or "digraph".
 *
 * The ticket's worked example pins this divergence: `add-to-10` →
 * "adding to ten" (NOT "add to 10"). Keeping the two maps separate lets each
 * evolve for its own audience without one breaking the other.
 *
 * Many leaf nodes intentionally collapse to the same warm phrase (every CVC
 * vowel tier + the digraph tiers all read as "reading words"): Marian
 * doesn't need to hear the tier taxonomy, only "you did the reading thing."
 *
 * The map is exhaustive over `SkillNode` (TypeScript `Record<SkillNode, ...>`
 * enforces this — a new node added to the union fails typecheck here until a
 * phrase is supplied, which is the desired tripwire). `friendlyNodeName()`
 * additionally falls back to a generic phrase on any unexpected string so a
 * mis-derived focus node never bricks the celebration.
 */

import type { SkillNode } from '../../lib/progress'

/**
 * Generic fallback phrase. Used when a focus node can't be resolved to a
 * specific phrase (should not happen in practice — the map is exhaustive —
 * but defends the celebration against a future-node / corrupt-state race).
 */
export const FRIENDLY_NODE_NAME_FALLBACK = 'your learning'

/**
 * Spoken child-facing phrase per `SkillNode`. Exported so the bake-side copy
 * mirror (`scripts/recapFocusCopy.ts`) can be drift-guarded against it in
 * `recapFocusBakeMirror.test.ts` — the bake must voice exactly what the caption
 * shows.
 */
export const FRIENDLY_NODE_NAMES: Record<SkillNode, string> = {
  // ── Number Garden (math) ──────────────────────────────────────────────
  'number-recog': 'your numbers',
  'add-to-10': 'adding to ten',
  'add-to-20': 'adding to twenty',
  'sub-to-10': 'taking away to ten',
  'sub-to-20': 'taking away to twenty',
  // Both two-digit bands read the same to Marian; the no-carry/carry
  // distinction is a parent/curriculum concern, not a spoken-recap one.
  'two-digit-addsub-no-regroup': 'bigger numbers',
  'two-digit-addsub-with-regroup': 'bigger numbers',
  'skip-counting': 'skip counting',
  // Multiplication is taught as repeated addition with no × symbol yet
  // (per CLAUDE.md "Repeated addition concept, no x symbol"); "counting
  // in groups" matches how Marian experiences it on screen.
  'mult-2-5-10': 'counting in groups',
  'mult-3-4': 'counting in groups',
  'mult-6-9': 'counting in groups',

  // ── Word Song (literacy) ──────────────────────────────────────────────
  'letter-names': 'your letters',
  'letter-sounds': 'letter sounds',
  'blending-cv': 'blending sounds',
  // Every CVC vowel tier + every digraph tier collapses to "reading words"
  // — Marian hears the activity, not the phonics taxonomy.
  'cvc-words': 'reading words',
  'cvc-words-short-o': 'reading words',
  'cvc-words-short-u': 'reading words',
  'cvc-words-short-i': 'reading words',
  'cvc-words-short-e': 'reading words',
  'digraphs-sh': 'reading words',
  'digraphs-ch': 'reading words',
  'digraphs-th-voiceless': 'reading words',
  'sight-words': 'reading words',
  'simple-sentences': 'reading sentences',
}

/**
 * Spoken child-facing phrase for `node`, e.g. `add-to-10` → "adding to ten".
 * Falls back to `FRIENDLY_NODE_NAME_FALLBACK` for any value outside the
 * `SkillNode` union (defensive — never throws, so a corrupt / future focus
 * node can't brick the Session-End celebration).
 */
export function friendlyNodeName(node: SkillNode | string): string {
  return FRIENDLY_NODE_NAMES[node as SkillNode] ?? FRIENDLY_NODE_NAME_FALLBACK
}

/**
 * Compose the full recap line for `node`:
 *   `add-to-10` → "You worked on adding to ten today!"
 *
 * Single source of truth for the copy so the caption (rendered client-side
 * via the silent-fallback `onWordTick`) and any future planner-emitted
 * audio for `session.end.recap.focus` stay phrased identically.
 */
export function focusRecapLine(node: SkillNode | string): string {
  return `You worked on ${friendlyNodeName(node)} today!`
}
