/**
 * Distractor generation for the Word Song screen (CVC short-a).
 *
 * Pure functions, fully unit-testable. No DOM, no React, no audio.
 *
 * Spec
 * ----
 * `design/screen-4-word-song.md` §"Distractor policy" + the picture-pack
 * matrix in `design/word-song-picture-pack.md`. Two tiers:
 *
 *   - **gentle** (problems 1-3): distractors are clearly different from
 *     target — different category, different starting consonant,
 *     different vowel sound. Three banked wins to open the session.
 *   - **trap** (problems 4-8): distractors share at least one axis with
 *     the target (rhyme, alliteration, same vowel, same ending). Forces
 *     the whole-word read instead of first-letter pattern-match.
 *
 * Constraint set (must hold for both tiers):
 *
 *   1. Distractors must be from Marian's known vocabulary (the curated
 *      picture pool).
 *   2. All three picture chips must be visually distinct at 96pt — no
 *      forbidden-pair silhouette collisions (see `wordPack.FORBIDDEN_PAIRS`).
 *   3. The two distractors must be distinct from each other and from the
 *      target.
 *   4. The correct word's CVC structure must match the session's vowel
 *      (v1 = short-a). Distractor _words_ don't have to be CVC short-a;
 *      what matters is their _picture_ is recognisable.
 *
 * Cutoff
 * ------
 * Cutoff at problem 3, locked, mirrors Math's `GENTLE_RAMP_THROUGH = 3`.
 * Per Kyle's spec line 184: "Do not parameterise."
 *
 * How distractors are chosen
 * --------------------------
 * Kyle's pack-doc encodes the per-target gentle + trap pairs as a master
 * table (§"Distractor pairing matrix"). We honour the matrix — it's the
 * pedagogical source of truth, hand-curated for silhouette-distinctness,
 * vocabulary fit, and trap-tier discrimination quality. We don't second-
 * guess it at runtime.
 *
 * The forbidden-pair check (`assertNotForbidden`) acts as a defensive
 * assertion — if Kyle's matrix were ever to drift and pair `cat` with
 * `dog`, the assertion catches it immediately. Dev/test crash, no silent
 * ship of a bad chip trio.
 */

import {
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  getWordEntry,
  isForbiddenPair,
  type WordEntry,
} from './wordPack'

/** The two distractor flavours. */
export type DistractorTier = 'gentle' | 'trap'

/**
 * Last problem index (1-based) that uses gentle-tier distractors. Problems
 * 1..GENTLE_RAMP_THROUGH use 'gentle'; the rest use 'trap'. Matches Math's
 * GENTLE_RAMP_THROUGH = 3 — both screens share the cutoff.
 */
export const GENTLE_RAMP_THROUGH = 3

/**
 * Decide which distractor tier applies for the given problem index.
 *
 * @param problemIndex 1-based; out-of-range upper values fall through to
 *                     'trap' which is the safe default beyond warm-up.
 */
export function pickTier(problemIndex: number): DistractorTier {
  return problemIndex <= GENTLE_RAMP_THROUGH ? 'gentle' : 'trap'
}

/**
 * Pick two distinct distractors for a given target word.
 *
 * Deterministic per (target, problemIndex) pair — the matrix in
 * `wordPack.TARGET_PAIRINGS` carries the per-tier pair, and the tier
 * comes from the problem index. The position of the correct chip among
 * the three rendered chips is randomised separately at render time
 * (deterministic per problem via the same LCG pattern Math uses).
 *
 * @param target The right answer's word entry.
 * @param problemIndex 1-based session position. Drives the tier choice.
 * @returns A tuple [d1, d2] of distractor entries, both distinct from
 *          each other and from the target, both passing the forbidden-
 *          pair check against the target and against each other.
 *
 * @throws if the matrix doesn't have a pairing for `target.word`, or if
 *         the matrix's pair somehow violates the forbidden-pair rule
 *         (defensive — should never happen since the matrix is curated).
 */
export function pickDistractors(
  target: WordEntry,
  problemIndex: number,
): [WordEntry, WordEntry] {
  const tier = pickTier(problemIndex)
  const pairings = TARGET_PAIRINGS[target.word]
  if (!pairings) {
    throw new Error(
      `[wordDistractors] no pairing matrix entry for target "${target.word}" — ` +
        'every TARGET_WORDS entry must have a TARGET_PAIRINGS entry',
    )
  }

  const [d1Word, d2Word] = tier === 'gentle' ? pairings.gentle : pairings.trap

  const d1 = getWordEntry(d1Word)
  const d2 = getWordEntry(d2Word)

  // Defensive — if Kyle's matrix ever drifts, fail loudly. Order matters
  // here for the assertion message but not for the actual rule.
  assertNotForbidden(target.word, d1.word)
  assertNotForbidden(target.word, d2.word)
  assertNotForbidden(d1.word, d2.word)
  if (
    d1.word === target.word ||
    d2.word === target.word ||
    d1.word === d2.word
  ) {
    throw new Error(
      `[wordDistractors] distractor pair for "${target.word}" violates distinctness: ` +
        `[${d1.word}, ${d2.word}]`,
    )
  }

  return [d1, d2]
}

function assertNotForbidden(a: string, b: string): void {
  if (isForbiddenPair(a, b)) {
    throw new Error(
      `[wordDistractors] forbidden pair surfaced in distractor matrix: ` +
        `${a}/${b} — silhouette-similarity rule (see wordPack.FORBIDDEN_PAIRS)`,
    )
  }
}

/** Re-export for tests / debug overlay. */
export { FORBIDDEN_PAIRS }
