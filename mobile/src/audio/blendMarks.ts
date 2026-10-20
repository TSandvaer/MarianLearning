/**
 * Word Song's blend marks (`design/native/word-song-native.md` § 4, § 5):
 * the measured sound segments of each baked blend clip
 * (`./blendMarks.generated.ts`) and what they drive.
 *
 * - The highlight: letter k lights 40 ms before its sound, every letter 40
 *   ms before the whole word (a sound after its picture is noticed later
 *   than one before it).
 * - The caption: each grapheme token appears at its mark, a separator
 *   (`-`, `...`) with the token after it.
 * - Tap sounds: a letter plays its segment from 30 ms before to 80 ms
 *   after (every segment is followed by ≥ 300 ms of silence); the picture
 *   plays the whole word to the clip's end.
 *
 * At runtime a mark is used only on a clip with the same text and byte
 * length (spec § 5). That length alone cannot catch a re-bake: the clips
 * are CBR, so many share a length. Each entry therefore also carries the
 * clip's content hash, and `blendMarks.test.ts` fails on any re-bake until
 * `npm run export-assets` runs again.
 */
import { BLEND_MARKS } from './blendMarks.generated'

export type Segment = readonly [onMs: number, offMs: number]

export const MARK_LEAD_MS = 40
export const TAP_LEAD_MS = 30
export const TAP_TAIL_MS = 80

/** The 4 segments of `text`'s clip, when `bytes` is that clip's length. */
export function blendMarksFor(
  text: string,
  bytes: number | undefined,
): readonly Segment[] | null {
  if (!Object.prototype.hasOwnProperty.call(BLEND_MARKS, text)) return null
  const entry = BLEND_MARKS[text]!
  if (bytes !== entry.bytes || entry.segments.length !== 4) return null
  return entry.segments as readonly Segment[]
}

/**
 * The lit letter `ms` into the clip: k (0..2, clamped to the word), the
 * whole word (`wordLength`), or null before the first sound.
 */
export function litAt(
  segments: readonly Segment[],
  ms: number,
  wordLength: number,
): number | null {
  if (ms >= segments[3]![0] - MARK_LEAD_MS) return wordLength
  for (let k = 2; k >= 0; k--) {
    if (ms >= segments[k]![0] - MARK_LEAD_MS) {
      return Math.min(k, Math.max(0, wordLength - 1))
    }
  }
  return null
}

/**
 * Real blending's cut (`design/native/real-blending.md` § 4, § 8): the
 * sounds end 80 ms after the 3rd, before the silence and the word.
 */
export function soundsCutMs(segments: readonly Segment[]): number {
  return segments[2]![1] + TAP_TAIL_MS
}

/**
 * How many of the 3 sounds have lit `ms` into the clip; each lights 40 ms
 * before its sound and stays lit (real blending's sounds, § 4). The word is
 * not a sound.
 */
export function soundsHeldAt(segments: readonly Segment[], ms: number): number {
  let held = 0
  for (let k = 0; k < 3; k++) {
    if (ms >= segments[k]![0] - MARK_LEAD_MS) held = k + 1
  }
  return held
}

const SEPARATOR = /^(?:-+|\.{2,}|—|…)$/

/** How many of the blend line's caption tokens show `ms` into the clip. */
export function blendRevealAt(
  text: string,
  segments: readonly Segment[],
  ms: number,
): number {
  const tokens = text.split(/\s+/).filter(Boolean)
  const content: number[] = []
  tokens.forEach((t, i) => {
    if (!SEPARATOR.test(t)) content.push(i)
  })
  let reached = 0
  for (let k = 0; k < Math.min(segments.length, content.length); k++) {
    if (ms >= segments[k]![0] - MARK_LEAD_MS) reached = k + 1
  }
  return reached === 0 ? 0 : content[reached - 1]! + 1
}

/** A letter's tap window, ms into the clip. */
export function letterWindow(seg: Segment): { from: number; to: number } {
  return { from: Math.max(0, seg[0] - TAP_LEAD_MS), to: seg[1] + TAP_TAIL_MS }
}

/** The picture's tap window: the whole word, to the clip's end. */
export function wordWindow(segments: readonly Segment[]): {
  from: number
  to: null
} {
  return { from: Math.max(0, segments[3]![0] - TAP_LEAD_MS), to: null }
}
