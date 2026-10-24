/**
 * Which short vowel a letter-sounds session practises (Wave 9 W9.4 —
 * ticket 86c9ya3r9). One rule, shared by the native app (core
 * `session/composeSession.ts`, which builds the session on the device) and
 * the server (`api/_planner.ts`, `api/claude.ts`, where the frozen web's
 * request still arrives). Moved here from `api/_planner.ts` unchanged
 * (no-Claude plan phase 4, `design/native/no-claude-sizing.md` § 1 row 3).
 *
 * No imports: the deployed functions load packages/core/src/wire as plain
 * Node ESM (see `api/_types.ts`).
 */

/** A letter-sounds vowel in the persisted slash notation (`'/o/'`). */
export type LetterSoundsVowelSlash = '/o/' | '/u/' | '/i/' | '/e/'

/** A vowel's sub-mastery state (core `progress/types.ts`). */
export type VowelSubMasteryState = 'intro' | 'practicing' | 'mastered'

/**
 * The locked vowel ladder in slash notation (Wave 9 W9.4 — ticket
 * 86c9ya3r9). Order is load-bearing: the derivation walks it in this
 * exact sequence per `design/word-song/letter-sounds-content.md §1.4`
 * (`/o/ → /u/ → /i/ → /e/`). `/a/` (short-a) is excluded — it's the
 * mastered anchor, never a current-target.
 */
export const LETTER_SOUNDS_VOWEL_LADDER: readonly LetterSoundsVowelSlash[] = [
  '/o/',
  '/u/',
  '/i/',
  '/e/',
]

/**
 * Derive the current-target vowel from per-vowel sub-mastery state
 * (Wave 9 W9.4 — ticket 86c9ya3r9). Implements the Kyle §1.4 algorithm
 * as a HARD runtime gate (replaces the Wave-7 directive-level
 * approximation). Returns the slash-notation vowel, or `null` when the
 * tier is fully mastered (all four vowels `'mastered'`) — the caller
 * treats `null` as "no current-target emission; tier-mastered".
 *
 * Algorithm (locked, `design/word-song/letter-sounds-content.md §1.4`):
 *   1. Walk the ladder `/o/ → /u/ → /i/ → /e/`.
 *   2. First vowel in `'practicing'` state is current-target (common
 *      case — the child mid-stream on a vowel).
 *   3. If no vowel is `'practicing'`, the first `'intro'` (unintroduced)
 *      vowel becomes current-target (emission begins; W9.3 mastery rule
 *      flips it to `'practicing'` on session-end).
 *   4. `/e/` adjacency guard: if step 2 or 3 would pick `/e/` while
 *      `/i/` is not yet `'mastered'`, skip to the next `'mastered'`
 *      vowel for review-mode emission. Under the locked sequence this
 *      is unreachable in normal play (steps 2-3 stop at the first
 *      practicing/intro vowel, which precedes `/e/`); it is belt-and-
 *      braces against a debug seed / state-mutation bug that skips
 *      `/i/`. Implements the cross-session `/i/ → /e/` ban (§1.2 #2).
 *   5. All four `'mastered'` → return `null` (tier-mastered, the
 *      composite `letter-sounds` node will promote via the W9.3
 *      AND-of-four gate).
 *
 * Pure function; no I/O.
 */
export function deriveCurrentTargetVowel(
  states: Readonly<Record<LetterSoundsVowelSlash, VowelSubMasteryState>>,
): LetterSoundsVowelSlash | null {
  // Step 2: first 'practicing' in ladder order.
  const practicing = LETTER_SOUNDS_VOWEL_LADDER.find(
    (v) => states[v] === 'practicing',
  )
  // Step 3: else first 'intro' (unintroduced) in ladder order.
  const candidate =
    practicing ??
    LETTER_SOUNDS_VOWEL_LADDER.find((v) => states[v] === 'intro') ??
    null

  // Step 5: nothing practicing or intro → all four mastered → tier-mastered.
  if (candidate === null) return null

  // Step 4: /e/ adjacency guard. If we'd pick /e/ while /i/ is not yet
  // mastered, skip to the next mastered vowel for review-mode emission.
  if (candidate === '/e/' && states['/i/'] !== 'mastered') {
    const masteredReview = LETTER_SOUNDS_VOWEL_LADDER.find(
      (v) => states[v] === 'mastered',
    )
    return masteredReview ?? null
  }

  return candidate
}
