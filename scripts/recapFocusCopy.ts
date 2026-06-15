/**
 * Session-End focus-recap COPY — bake-side mirror (M5, ticket 86c9kmwh0).
 *
 * Zero-import pure-data module. It MIRRORS the client's spoken friendly-name
 * map (`FRIENDLY_NODE_NAMES` in `src/screens/SessionEnd/friendlyNodeName.ts`),
 * which is itself mirrored by the planner directive's per-node phrase table
 * (`api/_planner.ts` SYSTEM_PREAMBLE `session.end.recap.focus` bullet). All
 * three MUST stay in sync.
 *
 * Why a SEPARATE zero-import module (not importing the client map):
 *   - Importing `friendlyNodeName.ts` drags the `src/lib/progress` barrel
 *     (DOM/Vite-typed runtime values) into the scripts tsconfig (api project,
 *     `lib: ["ES2023"]`, no DOM) and breaks `tsc -b`. `rebakeThreeHint.ts` set
 *     the precedent of inlining cross-tsconfig constants.
 *   - Keeping it import-free means BOTH `scripts/bakeRecapFocus.ts` (api
 *     tsconfig) AND the app-side drift-guard test (app tsconfig) can import it
 *     cleanly, with no DOM/Node lib leakage either direction.
 *
 * The drift-guard test `src/screens/SessionEnd/recapFocusBakeMirror.test.ts`
 * pins this map === the client map at vitest time, so an edit to one side
 * fails CI until the other follows.
 */

/**
 * SPOKEN child-facing focus phrase keyed by wire-side `SkillNode` literal.
 * Mirror of `FRIENDLY_NODE_NAMES` in `friendlyNodeName.ts`. The
 * `two-digit-addsub-no-regroup` wire literal is the bake-side focus node that
 * maps to the legacy `two-digit-addsub.json` disk file via `canonFileTierFor`.
 */
export const RECAP_FRIENDLY_NODE_NAMES: Record<string, string> = {
  // Number Garden (math)
  'number-recog': 'your numbers',
  'add-to-10': 'adding to ten',
  'add-to-20': 'adding to twenty',
  'sub-to-10': 'taking away to ten',
  'sub-to-20': 'taking away to twenty',
  'two-digit-addsub-no-regroup': 'bigger numbers',
  'two-digit-addsub-with-regroup': 'bigger numbers',
  'skip-counting': 'skip counting',
  'mult-2-5-10': 'counting in groups',
  'mult-3-4': 'counting in groups',
  'mult-6-9': 'counting in groups',
  // Word Song (literacy)
  'letter-names': 'your letters',
  'letter-sounds': 'letter sounds',
  'blending-cv': 'blending sounds',
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

/** Generic fallback — mirrors `FRIENDLY_NODE_NAME_FALLBACK`. Should never fire
 *  (every active combo is in the map); defends the bake against an unexpected
 *  focus literal. */
export const RECAP_FRIENDLY_NODE_NAME_FALLBACK = 'your learning'

/** Compose the recap line — mirrors `focusRecapLine()` so the spoken clip and
 *  the client caption stay phrased identically. */
export function recapFocusLine(node: string): string {
  const friendly =
    RECAP_FRIENDLY_NODE_NAMES[node] ?? RECAP_FRIENDLY_NODE_NAME_FALLBACK
  return `You worked on ${friendly} today!`
}
