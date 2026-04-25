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
export type Route = 'splash' | 'greet' | 'math' | 'literacy' | 'reward'

export const FIRST_ROUTE: Route = 'splash'
