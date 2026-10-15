/**
 * Tiny in-app route state for Session 1.
 *
 * We deliberately do NOT pull react-router for v1: the entire session is a
 * fixed linear sequence (Splash → Greet → Math → Literacy → Reward), there
 * are no URLs to address, no back button, no deep-linking, no auth, and no
 * shared/embedded state. A full router buys complexity we don't need and
 * costs bundle weight we don't want on iPad.
 *
 * Trade-off captured in the PR body. If/when we need addressable routes
 * (parental dashboard, return-user flow), swap this for react-router and
 * keep the route names — they map 1:1 to path segments.
 */
export type Route =
  | 'splash'
  | 'greet'
  /**
   * Hub — landing / skill-tree picker. Reached on:
   *   - app-open with `sessionCount >= 1` (Splash → Hub branch)
   *   - Session-End "All done!" tap (post-route-flip per ticket 86c9j53ra)
   *   - mid-skill back-arrow tap from Math/WordSong
   *
   * Source-of-truth: `design/screen-hub.md`.
   */
  | 'hub'
  | 'math'
  | 'literacy'
  | 'session-end'
  | 'reward'
  /**
   * Parent-only settings surface (M2.5 — ticket 86c9kpjc7). Reached
   * exclusively via the 3-second long-press on Hub character art;
   * never linked from a Marian-facing surface.
   *
   * Source-of-truth: `design/adaptive-engine-one-pager.md` §
   * "Parent settings (v1 scope)".
   */
  | 'parent-settings'
  /**
   * One world's Emma's Path map (Emma's Path 8/10, ClickUp 123jpnbc3dr).
   * Reached from the Hub card's map button; Home returns to the Hub.
   * The world lives in App state (`mapWorld`), not in the route.
   *
   * Source-of-truth: `design/emmas-path/emmas-path-spec.md` §3.
   */
  | 'map'
  /**
   * Native only: a Map peek, 3 problems of a later step (fast-track spec
   * `design/native/fast-track-native.md` § 6.3). Reached from a stop tap
   * on the map once the peek's session start answered; it always returns
   * to the map. The world and step live in App state, not in the route.
   * The web never routes here.
   */
  | 'peek'

export const FIRST_ROUTE: Route = 'splash'
