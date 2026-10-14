/**
 * Which Leitner facts a session-start request may carry for its focus step.
 * One rule, shared by the native app (core `progress/leitner.ts`
 * `leitnerBoxForFocus`, where it builds the request) and the server
 * (`api/claude.ts`, where every client's request arrives, the frozen web's
 * included).
 *
 * A multiplication fact (`op: '*'`) belongs only to a multiplication step.
 * The native app records `*` facts for multiplication sessions (native
 * spec `design/native/math-skip-counting-multiplication-native.md` § 8), and
 * a progress blob can reach the web through cloud sync. The planner's
 * Leitner directive runs for `add-to-10` and asks Haiku to use the Box-1
 * facts it is sent, whatever their op (`api/_planner.ts`
 * `isLeitnerDirectiveActive`, `buildLeitnerDirective`). Without this rule an
 * add-to-10 session could be planned with "Two times three". Addition and
 * subtraction facts pass for every step, as before.
 *
 * No imports: the deployed functions load packages/core/src/wire as plain
 * Node ESM (see `api/_types.ts`).
 */

/** The math steps whose sessions practise multiplication facts. */
export const MULTIPLICATION_FOCUS_NODES: readonly string[] = [
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

/** May a fact with `op` ride on a request for `focusNode`? */
export function leitnerFactAllowedForFocus(
  op: string,
  focusNode: string | undefined,
): boolean {
  return (
    op !== '*' ||
    (focusNode !== undefined && MULTIPLICATION_FOCUS_NODES.includes(focusNode))
  )
}
