/**
 * Caption word-tick formula, shared by every Emma line player.
 *
 * Web contract (`src/lib/audio/preRecorded.ts`, `sessionAudio.ts`,
 * `playHubLine.ts`): `onPlay` fires on Howler's `play` event, word 0
 * ticks at once, then word i ticks at `i * duration / wordCount`. When the
 * duration is not known yet (0) the cadence falls back to 165 wpm.
 *
 * Native: the same formula, evaluated against the player's own
 * `currentTime` in its status listener instead of a free-running
 * `setInterval`. The tick times are identical, but they follow the audio
 * clock, so a pause (background, call) freezes the caption with the voice.
 */

/** Web fallback cadence when the clip's duration is not known yet. */
export const FALLBACK_WPM = 165

/**
 * expo-audio's status `updateInterval`. It DEFAULTS TO 500 ms, which would
 * reveal the second word of "I'm Emma." up to half a second late; 50 ms
 * keeps each tick within one interval of the web's.
 */
export const STATUS_INTERVAL_MS = 50

/** Whitespace-split word count, as the web counts it. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Index of the last word that should be visible `currentTimeS` seconds
 * into a clip of `durationS` seconds with `wordCount` words. Pure.
 */
export function wordIndexAt(
  currentTimeS: number,
  durationS: number,
  wordCount: number,
): number {
  if (wordCount <= 1) return 0
  const totalMs =
    durationS > 0 ? durationS * 1000 : (wordCount / FALLBACK_WPM) * 60_000
  const intervalMs = totalMs / wordCount
  const idx = Math.floor((Math.max(0, currentTimeS) * 1000) / intervalMs)
  return Math.min(wordCount - 1, idx)
}
