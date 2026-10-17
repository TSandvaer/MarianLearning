/**
 * A little story's read-along (`design/native/content-wave-3.md` § 4.5):
 * while Emma reads the story, the spotlight walks its words.
 *
 * The marks (`./storyMarks.generated.ts`, from `export-assets.mjs`) give
 * one measured segment `[on, off]` per sentence of each baked story clip.
 * Word k of a sentence starts at
 *
 *   on + (off − on) × (characters before k) ÷ (the sentence's characters)
 *
 * and lights `STORY_MARK_LEAD_MS` early (early, not late, as the blend).
 * A mark is used only on a clip of the same text and byte length; without
 * one the caller follows the line's own word ticks (the clip split evenly
 * by words over its duration, or the silent caption walk).
 *
 * Prediction (hypothesis, § 4.5): words land within about ±150 ms of the
 * voice. If the device check sees them out of step, `STORY_READ_ALONG`
 * becomes `'sentence'`: each sentence lights for its segment.
 */
import { storySentences } from '@marian/core/wordSong/littleStories'
import type { Segment } from './blendMarks'
import { STORY_MARKS } from './storyMarks.generated'

export const STORY_MARK_LEAD_MS = 40

/** `'word'` walks the words; `'sentence'` lights a sentence at a time. */
export const STORY_READ_ALONG: 'word' | 'sentence' = 'word'

/** One segment per sentence of `text`'s clip, when `bytes` is its length. */
export function storyMarksFor(
  text: string,
  bytes: number | undefined,
): readonly Segment[] | null {
  if (!Object.prototype.hasOwnProperty.call(STORY_MARKS, text)) return null
  const entry = STORY_MARKS[text]!
  if (bytes !== entry.bytes) return null
  if (entry.segments.length !== storySentences(text).length) return null
  return entry.segments as readonly Segment[]
}

/** Each word's start (ms into the clip), in story order. */
export function storyWordStarts(
  text: string,
  segments: readonly Segment[],
): number[] {
  const starts: number[] = []
  storySentences(text).forEach((words, s) => {
    const [on, off] = segments[s]!
    const chars = words.join(' ').length
    let before = 0
    for (const w of words) {
      starts.push(
        STORY_READ_ALONG === 'sentence'
          ? on
          : on + ((off - on) * before) / Math.max(1, chars),
      )
      before += w.length + 1
    }
  })
  return starts
}

/** The lit word `ms` into the clip, or null before the first. */
export function storyLitAt(
  starts: readonly number[],
  ms: number,
): number | null {
  let lit: number | null = null
  for (let k = 0; k < starts.length; k++) {
    if (ms >= starts[k]! - STORY_MARK_LEAD_MS) lit = k
  }
  return lit
}

/** The words of sentence `s`'s range (for `'sentence'` read-along). */
export function sentenceOfWord(text: string, word: number): readonly number[] {
  let first = 0
  for (const words of storySentences(text)) {
    if (word < first + words.length) return words.map((_, i) => first + i)
    first += words.length
  }
  return []
}
