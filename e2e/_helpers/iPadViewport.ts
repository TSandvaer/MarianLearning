/**
 * iPad-portrait viewport helper for layout-fit specs.
 *
 * Ticket 86c9q7tpu (regression-spec drain). PR #166 shipped add-to-20
 * content with addends that pushed the math-visual-groups flower row
 * past the right edge of iPad portrait — a viewport-width regression
 * that should have been pinned by Playwright before reaching Thomas's
 * iPad. The retroactive fix-and-pin is this ticket.
 *
 * Why this helper exists
 * ----------------------
 * `playwright.config.ts` already pins both projects (chromium + webkit)
 * to `1024 × 1366` (`IPAD_PRO_PORTRAIT`), so the default viewport for
 * every spec already matches Marian's device. The helper formalises
 * that constant so specs that assert on viewport-relative layout
 * invariants — "row stays inside viewport", "chip stays above the fold",
 * "Emma's body doesn't clip" — can read the dimensions explicitly
 * rather than hardcoding magic numbers in spec bodies.
 *
 * Future layout-relevant work should default to this helper for any
 * `getBoundingClientRect`-style assertion, and document any deviation
 * (e.g. iPad mini at 768 × 1024) in the spec header rather than at the
 * call site.
 *
 * Why 1024 × 1366 (and not 820 × 1180)
 * ------------------------------------
 * The project's canonical iPad-portrait viewport is iPad Pro 12.9″
 * (`1024 × 1366` logical points). It is the wider end of the iPad
 * portrait spectrum. A row that fits at this viewport is NOT guaranteed
 * to fit at a narrower iPad mini portrait; the project has chosen the
 * larger device as the primary target, with iPad mini coverage tracked
 * separately if it ever ships. Don't introduce a second viewport in
 * this helper — match the project default unless the ticket explicitly
 * asks for a narrower-device pin.
 *
 * Note on viewport.width semantics
 * --------------------------------
 * Playwright's `viewport.width` is the layout viewport — the value the
 * page sees as `window.innerWidth`. `getBoundingClientRect().right`
 * returns CSS-pixel coordinates relative to the same coordinate space.
 * Comparing the two is direct: an element with `right > viewport.width`
 * spills past the right edge of the layout viewport, which is the iPad
 * Safari rendering surface.
 */

/**
 * Project-canonical iPad-portrait viewport. Mirrors `IPAD_PRO_PORTRAIT`
 * in `playwright.config.ts`. The two should never drift; if you change
 * one, change the other.
 */
export const IPAD_PORTRAIT_VIEWPORT = {
  width: 1024,
  height: 1366,
} as const
