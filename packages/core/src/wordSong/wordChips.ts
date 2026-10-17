/**
 * The three chips of a Word Song problem: the target plus two distractors,
 * in a deterministic per-problem order.
 *
 * Moved out of the web screen (`src/screens/WordSong/WordSong.tsx`, where
 * it was the private `buildChipOrder`) so the native Word Song builds the
 * same trio in the same order. The web screen consumes it unchanged
 * (`src/screens/WordSong/wordRoundParity.test.tsx`).
 *
 * Per content type:
 * - CVC / sight words / simple sentences: core's `pickDistractors` (the
 *   curated gentle / trap matrix; `crossVowel` reads the cross-vowel
 *   matrix, uniform per session).
 * - `letter-names`: two case-matched letters from the 52-glyph pool.
 * - `letter-sounds`: two letters from `LETTER_SOUNDS_POOL`.
 * - `little-story`: its `LITTLE_STORIES` row's two wrong chips (words of
 *   the story; content wave 3 § 4.6), not `pickDistractors`.
 *
 * The letter picks are render-time placeholders, not band-tuned to the
 * specs' trap windows (that needs the planner to emit distractor letters;
 * see the history in the web screen's git log, Wave 7 A4b / A8b).
 *
 * No `Math.random`: an LCG seeded on the problem index and the target, so
 * the order is stable across remounts and tests.
 */
import { LETTER_SOUNDS_POOL } from './letterSoundsPool'
import { littleStoryForText } from './littleStories'
import { getWordEntry, type WordEntry } from './wordPack'
import { pickDistractors } from './wordDistractors'
import type { WordSongProblem } from './wordSessionPlans'

/** The 52-glyph ASCII pool for the `letter-names` distractors. */
export const LETTER_DISTRACTOR_POOL: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
]

/**
 * Target + 2 distractors, shuffled deterministically per problem (LCG
 * seeded on the problem index + a hash of the target word, so different
 * targets shuffle differently at the same index).
 */
export function buildWordChipOrder(
  problem: WordSongProblem,
  crossVowel: boolean,
): readonly WordEntry[] {
  const [d1, d2] =
    problem.contentType === 'little-story'
      ? storyDistractors(problem)
      : problem.contentType === 'letter-names'
        ? pickLetterDistractors(problem.target, problem.index)
        : problem.contentType === 'letter-sounds'
          ? pickSoundDistractors(problem.target, problem.index)
          : pickDistractors(problem.target, problem.index, { crossVowel })
  const values = [problem.target, d1, d2]
  const wordHash = problem.target.word
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0)
  const seed = (problem.index * 31 + wordHash + 1) >>> 0
  const rng = lcg(seed)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

/** A little story's two wrong chips, from its row (by the story text). */
function storyDistractors(
  problem: WordSongProblem,
): readonly [WordEntry, WordEntry] {
  const row = littleStoryForText(problem.story ?? problem.utterances.hint)
  if (row === undefined) {
    throw new Error(`no little story for problem ${problem.index}`)
  }
  return [getWordEntry(row.wrong[0]), getWordEntry(row.wrong[1])]
}

/**
 * Two distractor letters for a `letter-names` problem: the target's case
 * (a mixed-case trio would give the answer away), distinct from the target
 * and each other, from {@link LETTER_DISTRACTOR_POOL}.
 */
function pickLetterDistractors(
  target: WordEntry,
  problemIndex: number,
): readonly [WordEntry, WordEntry] {
  const letter = target.word
  const isUpper = letter === letter.toUpperCase()
  const caseFilteredPool = LETTER_DISTRACTOR_POOL.filter(
    (g) => (g === g.toUpperCase()) === isUpper && g !== letter,
  )
  const seed = (problemIndex * 31 + letter.charCodeAt(0) + 0xa5) >>> 0
  const rng = lcg(seed)
  const pool = caseFilteredPool.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const [g1, g2] = pool
  return [letterToTargetEntry(g1!), letterToTargetEntry(g2!)]
}

/** A distractor letter as a `WordEntry` (mirrors the parser's sentinel). */
function letterToTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `letter:${letter}`,
    category: 'object',
    isTarget: false,
  }
}

/**
 * Two distractor letters for a `letter-sounds` problem, from the 19-letter
 * `LETTER_SOUNDS_POOL` (uppercase, so the trio is case-uniform).
 */
function pickSoundDistractors(
  target: WordEntry,
  problemIndex: number,
): readonly [WordEntry, WordEntry] {
  const letter = target.word
  const pool = LETTER_SOUNDS_POOL.filter((g) => g !== letter)
  const seed = (problemIndex * 31 + letter.charCodeAt(0) + 0xb7) >>> 0
  const rng = lcg(seed)
  const shuffled = pool.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const [g1, g2] = shuffled
  return [soundLetterToTargetEntry(g1!), soundLetterToTargetEntry(g2!)]
}

/** A letter-sounds distractor (sentinel `letter-sounds:<X>` picture key). */
function soundLetterToTargetEntry(letter: string): WordEntry {
  return {
    word: letter,
    pictureKey: `letter-sounds:${letter}`,
    category: 'object',
    isTarget: false,
  }
}

/** Tiny LCG. Deterministic, no Math.random (same shape as Math's). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
