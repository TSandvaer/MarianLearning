/**
 * The little stories' read-along (`design/native/content-wave-3.md`
 * § 4.5): one measured segment per sentence, each word placed by its
 * characters, lit 40 ms early; a mark is used only on its own clip; and
 * the generated table holds only stories, one segment per sentence.
 */
import {
  LITTLE_STORIES,
  storySentences,
} from '@marian/core/wordSong/littleStories'
import {
  STORY_MARK_LEAD_MS,
  sentenceOfWord,
  storyLitAt,
  storyMarksFor,
  storyWordStarts,
} from './storyMarks'
import { STORY_MARKS } from './storyMarks.generated'

const FOX_1 = 'The fox sat on the rug. It has a cup.'

describe('storyWordStarts (§ 4.5)', () => {
  it('word k starts at on + (off − on) × characters before k ÷ the sentence', () => {
    // "The fox sat on the rug." is 23 characters; "It has a cup." 13.
    const starts = storyWordStarts(FOX_1, [
      [100, 2400],
      [3000, 4300],
    ])
    expect(starts).toHaveLength(10)
    expect(starts[0]).toBe(100)
    expect(starts[1]).toBeCloseTo(100 + (2300 * 4) / 23)
    expect(starts[5]).toBeCloseTo(100 + (2300 * 19) / 23)
    expect(starts[6]).toBe(3000)
    expect(starts[9]).toBeCloseTo(3000 + (1300 * 9) / 13)
  })

  it('lights a word 40 ms before its start; nothing before the first', () => {
    const starts = [100, 500, 900]
    expect(storyLitAt(starts, 0)).toBeNull()
    expect(storyLitAt(starts, 100 - STORY_MARK_LEAD_MS)).toBe(0)
    expect(storyLitAt(starts, 459)).toBe(0)
    expect(storyLitAt(starts, 460)).toBe(1)
    expect(storyLitAt(starts, 5000)).toBe(2)
  })

  it('sentenceOfWord gives the words of the sentence a word is in', () => {
    expect(sentenceOfWord(FOX_1, 2)).toEqual([0, 1, 2, 3, 4, 5])
    expect(sentenceOfWord(FOX_1, 7)).toEqual([6, 7, 8, 9])
  })
})

describe('the marks table', () => {
  it('a story without an entry, or a clip of another length, has no marks', () => {
    expect(storyMarksFor('Not a story.', 1000)).toBeNull()
    for (const [text, entry] of Object.entries(STORY_MARKS))
      expect(storyMarksFor(text, entry.bytes + 1)).toBeNull()
  })

  it('holds only stories, one segment per sentence', () => {
    const stories = new Set(LITTLE_STORIES.map((s) => s.story))
    for (const [text, entry] of Object.entries(STORY_MARKS)) {
      expect(stories.has(text)).toBe(true)
      expect(entry.segments).toHaveLength(storySentences(text).length)
      expect(storyMarksFor(text, entry.bytes)).toEqual(entry.segments)
    }
  })
})
