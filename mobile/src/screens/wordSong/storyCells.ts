/**
 * A little story's words as the card lays them out (content wave 3 § 4.2):
 * in order, each with its sentence (each sentence starts a new line) and
 * its spoken key (`"rug."` → `rug`, the one-word clip's id).
 */
import {
  storySentences,
  storyWordKey,
} from '@marian/core/wordSong/littleStories'

/** A story's words in order, each with its sentence. */
export interface StoryWordCell {
  index: number
  sentence: number
  written: string
  key: string
}

export function storyCells(story: string): StoryWordCell[] {
  const cells: StoryWordCell[] = []
  storySentences(story).forEach((words, sentence) =>
    words.forEach((written) =>
      cells.push({
        index: cells.length,
        sentence,
        written,
        key: storyWordKey(written),
      }),
    ),
  )
  return cells
}
