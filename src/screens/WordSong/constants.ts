/**
 * Word Song screen constants — extracted from WordSong.tsx so they can be
 * exported without tripping `react-refresh/only-export-components`.
 *
 * Same pattern as Math's `constants.ts`. The streak threshold value is
 * shared with Math (per spec §"Streak treatment" → "Same threshold values
 * as Math: bonuses at 3, 5, 8") — we re-export from Math's constants
 * file so there's a single source of truth and a Thomas decision lands
 * in one place if he ever wants to revisit.
 */

export { STREAK_BONUS_THRESHOLDS } from '../Math/constants'
