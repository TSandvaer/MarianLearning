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
  /**
   * Native only: "Who is playing?", the learner picker
   * (`design/native/learner-profiles.md` § 1). Reached with 2 or more
   * learners on the device: after Splash, from the Hub badge, Session
   * End's handover, the return rule and Parent Settings' Done. A tap goes
   * to Greet or the Hub. The web never routes here.
   */
  | 'picker'
  /**
   * Native only: the Play place (`design/native/play-place.md` § 1.3), the
   * shared place for the games outside the path. Reached from the Hub's
   * Play disc; Home returns to the Hub. Not `play`: that already names
   * the Map's current-stop start.
   */
  | 'play-place'
  /**
   * Native only: a Play-place game (`design/native/play-place.md` § 1.7),
   * Raft crossing or Letter critters. Reached from a Play place tile; it
   * always returns to the Play place. The game id lives in App state.
   */
  | 'play-game'

export const FIRST_ROUTE: Route = 'splash'
