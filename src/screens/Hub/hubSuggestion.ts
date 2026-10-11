/**
 * Soft-suggestion algorithm for the Hub picker (Guidance G1, ClickUp
 * 123jpnbca4r). The adapter lives in `@marian/core/hub/hubSuggestion`,
 * shared with the native Hub; this module re-exports it for the web.
 */

export {
  computeSuggestion,
  recordSuggestionOutcome,
} from '@marian/core/hub/hubSuggestion'
export type {
  SuggestionOutcomePatch,
  SuggestionTarget,
} from '@marian/core/hub/hubSuggestion'
