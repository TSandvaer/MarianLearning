/**
 * The little stories' own Lily lines (`design/native/content-wave-3.md`
 * § 4.4, § 5.1): "Read the story." before a story card's reading beat, and
 * the one-word clips a word tap plays ("Fox."). Both are guidance lines
 * (`guide.story.*` in core's `GUIDANCE_LINES`), bundled like the session
 * guide's; a clip not rendered yet walks its caption silently, so a tapped
 * word without its clip just lights (§ 7).
 *
 * Two players on the one manifest: Emma's "Read the story." is a line of
 * hers (the screen counts it as speaking), a word tap is not (it never
 * cuts her, and a new tap cuts the last).
 */
import {
  GUIDANCE_LINES,
  storyWordLine,
} from '@marian/core/emmasPath/guidanceLines'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from './manifestLines'

export type StoryGuideLineId = 'guide.story.read' | `guide.story.word.${string}`

export const STORY_READ_LINE: StoryGuideLineId = 'guide.story.read'

export const STORY_GUIDE_MANIFEST: Readonly<Record<string, ManifestLine>> =
  Object.fromEntries(
    GUIDANCE_LINES.filter((l) => l.id.startsWith('guide.story.')).map((l) => [
      l.id,
      { src: l.src, text: l.text },
    ]),
  )

/** A story word's clip id (`"Fox,"` → `guide.story.word.fox`), or null. */
export function storyWordLineId(key: string): StoryGuideLineId | null {
  const line = storyWordLine(key)
  return line === undefined ? null : (line.id as StoryGuideLineId)
}

export type StoryGuidePlayer = ManifestLinePlayer<StoryGuideLineId>

let reader: StoryGuidePlayer | null = null
let words: StoryGuidePlayer | null = null

/** Emma's "Read the story." (made on first use). */
export function storyGuidePlayer(): StoryGuidePlayer {
  reader ??= createManifestLinePlayer<StoryGuideLineId>(
    'story-guide',
    STORY_GUIDE_MANIFEST as Record<StoryGuideLineId, ManifestLine>,
  )
  return reader
}

/** The word taps' clips (made on first use). */
export function storyWordPlayer(): StoryGuidePlayer {
  words ??= createManifestLinePlayer<StoryGuideLineId>(
    'story-word',
    STORY_GUIDE_MANIFEST as Record<StoryGuideLineId, ManifestLine>,
  )
  return words
}
