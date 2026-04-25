/**
 * Returns true if the URL signals the debug overlay should mount. Centralised
 * so App.tsx and tests share the same predicate.
 *
 * Lives in its own file (rather than alongside DebugOverlay.tsx) so the
 * `react-refresh/only-export-components` rule stays happy — components and
 * non-component exports must not coexist in the same file.
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined' || !window.location) return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  } catch {
    return false
  }
}
