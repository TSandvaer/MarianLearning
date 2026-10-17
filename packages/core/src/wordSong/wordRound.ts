/**
 * One Word Song round (a problem on screen): what it shows, when Emma reads
 * it, how a tap is judged and what the second wrong tap plays.
 *
 * Moved out of the web screen (`src/screens/WordSong/WordSong.tsx`) so the
 * native Word Song runs the same rules; the web consumes these unchanged
 * (`src/screens/WordSong/wordRoundParity.test.tsx`). Pure: no React, no
 * storage, no timers. Reasons for each rule stay in the web screen's
 * comments and its tickets; the short version is beside each export.
 */
import {
  GUIDED_AFTER_WRONG_COUNT,
  HINT_AFTER_WRONG_COUNT,
} from '../shared/gameplayConstants'
import { buildBlendHighlightSteps } from './blendHighlight'
import { storyWordCount } from './littleStories'
import { buildWordChipOrder } from './wordChips'
import type { WordEntry } from './wordPack'
import type { WordSongContentType, WordSongProblem } from './wordSessionPlans'

// ── What the round shows ───────────────────────────────────────────────

/**
 * The card above the chips:
 * - `picture`: the CVC word card (picture, then its letters).
 * - `letter` / `letter-sound`: one large letter glyph.
 * - `sentence`: the gapped sentence panel (+ the gentle-phase scene).
 * - `none`: sight words (the written word IS the chip; no picture).
 * - `story`: a little story's card (content wave 3 § 4.2; native only).
 */
export type WordCard =
  | 'picture'
  | 'letter'
  | 'letter-sound'
  | 'sentence'
  | 'none'
  | 'story'

/** What a chip shows. Written words: sight words and simple sentences. */
export type ChipFace = 'picture' | 'letter' | 'letter-sound' | 'written-word'

export function wordCardFor(contentType?: WordSongContentType): WordCard {
  switch (contentType) {
    case 'letter-names':
      return 'letter'
    case 'letter-sounds':
      return 'letter-sound'
    case 'simple-sentence':
      return 'sentence'
    case 'sight-word':
      return 'none'
    case 'little-story':
      return 'story'
    default:
      return 'picture'
  }
}

export function chipFaceFor(contentType?: WordSongContentType): ChipFace {
  switch (contentType) {
    case 'letter-names':
      return 'letter'
    case 'letter-sounds':
      return 'letter-sound'
    case 'sight-word':
    case 'simple-sentence':
      return 'written-word'
    default:
      return 'picture'
  }
}

/** The chip's accessible name (web `aria-label`). */
export function chipLabel(face: ChipFace, word: string): string {
  if (face === 'letter' || face === 'letter-sound') return `Letter ${word}`
  if (face === 'written-word') return `Word ${word}`
  return `Picture of ${word}`
}

// ── When Emma reads it ─────────────────────────────────────────────────

/**
 * `cvc-word` ("Read the cat."): the word shows at once and Emma reads it
 * this much later, a silent beat to sound it out (ticket 86c9m3ae6). Not
 * skipped under Reduce Motion: it is decoding time, not motion. Sight
 * words never get it (whole-word recognition; decoding "was" is wrong).
 */
export const SILENT_TEXT_WINDOW_MS = 1500

export function readAloudDelayMs(problem: WordSongProblem): number {
  if (problem.contentType === 'little-story') return storyReadBeatMs(problem)
  return problem.contentType === 'cvc-word' ? SILENT_TEXT_WINDOW_MS : 0
}

/**
 * A little story's reading beat (content wave 3 § 4.4 step 3, D3): the
 * story shows, and the question comes this long after "Read the story."
 * ends, 1500 ms a word, never under 12 s or over 21 s (15 s for 10 words,
 * 21 s for 14: 40 words a minute). A word tap holds the question to at
 * least `STORY_TAP_HOLD_MS` after the tap, never past
 * `STORY_BEAT_CEILING_MS` from the beat's start. Foreground time only;
 * nothing on screen counts down.
 */
export const STORY_READ_MS_PER_WORD = 1500
export const STORY_BEAT_MIN_MS = 12000
export const STORY_BEAT_MAX_MS = 21000
export const STORY_TAP_HOLD_MS = 2000
export const STORY_BEAT_CEILING_MS = 30000

export function storyReadBeatMs(problem: WordSongProblem): number {
  const words = storyWordCount(problem.story ?? problem.utterances.hint)
  return Math.min(
    STORY_BEAT_MAX_MS,
    Math.max(STORY_BEAT_MIN_MS, STORY_READ_MS_PER_WORD * words),
  )
}

// ── How a tap is judged ────────────────────────────────────────────────

export function isCorrectChip(problem: WordSongProblem, word: string): boolean {
  return word === problem.target.word
}

/** The per-problem counters a wrong tap reads (the screen's sync refs). */
export interface WrongTapState {
  wrongCount: number
  hintPlayed: boolean
  guidedPlayed: boolean
}

export interface WrongTapOutcome {
  wrongCount: number
  /** This tap is the 2nd wrong: schedule the blend / hint (once). */
  scheduleHint: boolean
  /** This tap is the 3rd wrong: Emma gives the answer (once). */
  scheduleGuided: boolean
}

/**
 * One wrong tap. Each beat is owned by the tap that crosses its threshold,
 * so a burst of taps schedules it once.
 */
export function wrongTapOutcome(state: WrongTapState): WrongTapOutcome {
  const wrongCount = state.wrongCount + 1
  return {
    wrongCount,
    scheduleHint: wrongCount === HINT_AFTER_WRONG_COUNT && !state.hintPlayed,
    scheduleGuided:
      wrongCount >= GUIDED_AFTER_WRONG_COUNT && !state.guidedPlayed,
  }
}

/**
 * A right tap counts toward `totalCorrect` / `perProblemCorrect` unless
 * Emma gave the answer (ever-correct: a wrong-then-right retry counts).
 */
export function countsAsCorrect(state: Pick<WrongTapState, 'guidedPlayed'>) {
  return !state.guidedPlayed
}

/** A clean win (no wrong tap, no given answer) grows the streak. */
export function isCleanWin(
  state: Pick<WrongTapState, 'wrongCount' | 'guidedPlayed'>,
): boolean {
  return state.wrongCount === 0 && !state.guidedPlayed
}

// ── The second wrong tap: blend or hint ────────────────────────────────

/**
 * What the 2nd wrong tap plays (ticket 86c9qa6n3): on a `cvc-word` problem
 * with a baked `blend` line, the sound-out ("c - a - t ... cat") with the
 * letter highlight per token (`steps`, see `buildBlendHighlightSteps`);
 * otherwise the `hint` line (graceful skip, never a silent beat).
 */
export type SecondWrongPrompt =
  | { kind: 'blend'; text: string; steps: readonly (number | undefined)[] }
  | { kind: 'hint'; text: string }

export function secondWrongPrompt(problem: WordSongProblem): SecondWrongPrompt {
  const blend =
    problem.contentType === 'cvc-word' ? problem.utterances.blend : undefined
  if (blend !== undefined) {
    return {
      kind: 'blend',
      text: blend,
      steps: buildBlendHighlightSteps(blend, problem.target.word),
    }
  }
  return { kind: 'hint', text: problem.utterances.hint }
}

/**
 * Is letter `i` lit? During the blend each grapheme lights in turn; the
 * whole-word beat (`active === wordLength`) lights them all at once.
 */
export function letterHighlighted(
  i: number,
  active: number | null,
  wordLength: number,
): boolean {
  return active === i || active === wordLength
}

// ── The simple-sentence panel ──────────────────────────────────────────

/** The gap in a `sentenceFrame` (`"The cat ___ the mat."`). */
export const SENTENCE_GAP_TOKEN = '___'

/** One word of the sentence, or the gap with the punctuation around it. */
export type SentenceToken =
  | { kind: 'word'; text: string }
  | { kind: 'gap'; before: string; after: string }

/**
 * The frame split on whitespace (the gap counts as one token for the
 * word-by-word reveal). The gap may carry punctuation ("___." / "___?"),
 * so it is found as a substring and the rest is peeled off; a plain
 * `token === '___'` misses it (the W13-05 bug).
 */
export function sentenceTokens(frame: string): SentenceToken[] {
  return frame
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const at = token.indexOf(SENTENCE_GAP_TOKEN)
      if (at === -1) return { kind: 'word', text: token }
      return {
        kind: 'gap',
        before: token.slice(0, at),
        after: token.slice(at + SENTENCE_GAP_TOKEN.length),
      }
    })
}

/** The finished sentence (the scene's accessible name). */
export function filledSentence(frame: string, word: string): string {
  return frame.replace(SENTENCE_GAP_TOKEN, word)
}

// ── The round ──────────────────────────────────────────────────────────

export interface WordRound {
  card: WordCard
  chipFace: ChipFace
  /** Target + 2 distractors, in the order the chips show. */
  chips: readonly WordEntry[]
  /** Silent beat before the read-aloud (0 = read at once). */
  readAloudDelayMs: number
}

/** Everything a screen needs to lay out problem `problem`. */
export function buildWordRound(
  problem: WordSongProblem,
  opts: { crossVowel: boolean },
): WordRound {
  return {
    card: wordCardFor(problem.contentType),
    chipFace: chipFaceFor(problem.contentType),
    chips: buildWordChipOrder(problem, opts.crossVowel),
    readAloudDelayMs: readAloudDelayMs(problem),
  }
}
