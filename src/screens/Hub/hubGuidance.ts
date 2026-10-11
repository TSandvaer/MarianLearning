/**
 * Hub guidance — Guidance G1 (ClickUp 123jpnbca4r), web side.
 *
 * The pure helpers (lines, suggestion rule, morning wake-up) live in
 * `@marian/core/hub/hubGuidance` and are shared with the native Hub; this
 * module re-exports them and keeps the web's line player. Emma's lines
 * play the Lily recordings from Guidance G3 through the Hub's Howler line
 * player (`playHubLine.ts`), with the caption walking alongside; the Hub
 * waits for the iOS first-gesture unlock on app-open
 * (`guidanceNeedsGesture`). A line with no recording (`audioSrc: null`)
 * walks its caption at 165 wpm.
 */

import {
  GUIDANCE_LINES,
  type GuidanceLineId,
} from '@marian/core/hub/hubGuidance'
import { createHubLinePlayer } from './playHubLine'

export {
  FLOWER_WAKE_STORAGE_KEY,
  GUIDANCE_CLIP_IDS,
  GUIDANCE_LINES,
  canEarnToday,
  flowerWakeFor,
  pickGuidanceLines,
  readFlowerWake,
  suggestWorld,
  writeFlowerWake,
} from '@marian/core/hub/hubGuidance'
export type {
  FlowerWakeRecord,
  GuidanceLine,
  GuidanceLineId,
} from '@marian/core/hub/hubGuidance'

/** True when any line has a recording, so the app-open path must wait
 *  for the first tap (iOS audio unlock) before Emma speaks. */
export function guidanceNeedsGesture(
  lines: readonly GuidanceLineId[],
): boolean {
  return lines.some((id) => GUIDANCE_LINES[id].audioSrc !== null)
}

// ── Line player ──────────────────────────────────────────────────────

/** Same pace as the Hub's silent caption walk (165 wpm). */
export const CAPTION_MS_PER_WORD = Math.round(60_000 / 165)

export interface PlayGuidanceLineOptions {
  onPlay?: () => void
  onWordTick?: (wordIndex: number) => void
}

let activeCancel: (() => void) | null = null

/** Lines with a recording, as the Howler player's manifest. */
const CLIP_MANIFEST = Object.fromEntries(
  Object.entries(GUIDANCE_LINES).flatMap(([id, line]) =>
    line.audioSrc === null
      ? []
      : [[id, { src: line.audioSrc, text: line.text }]],
  ),
) as Record<GuidanceLineId, { src: string; text: string }>

const clipPlayer = createHubLinePlayer<GuidanceLineId>({
  lines: CLIP_MANIFEST,
})

/**
 * Speak one guidance line. A recorded line plays through the Hub's
 * Howler player (pending-resume gate, caption ticks against the clip's
 * duration, caption walk if the clip fails to load); a line without a
 * recording reveals its words at 165 wpm. Resolves when the line ends.
 */
export function playGuidanceLine(
  id: GuidanceLineId,
  opts: PlayGuidanceLineOptions = {},
): Promise<void> {
  cancelGuidanceLine()
  if (GUIDANCE_LINES[id].audioSrc !== null && id in CLIP_MANIFEST) {
    return clipPlayer.playHubLine(id, opts)
  }
  const words = GUIDANCE_LINES[id].text.split(/\s+/).filter(Boolean)
  return new Promise<void>((resolve) => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const cancel = () => {
      timers.forEach(clearTimeout)
      if (activeCancel === cancel) activeCancel = null
      resolve()
    }
    activeCancel = cancel
    opts.onPlay?.()
    words.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          opts.onWordTick?.(i)
          if (i === words.length - 1) cancel()
        }, i * CAPTION_MS_PER_WORD),
      )
    })
    if (words.length === 0) cancel()
  })
}

/** Stop the line in flight (card tap, unmount). Idempotent. */
export function cancelGuidanceLine(): void {
  activeCancel?.()
  clipPlayer.cancelActive()
}

/** Release the recorded lines' Howls (Hub leaves). Idempotent. */
export function unloadGuidanceLines(): void {
  clipPlayer.unload()
}
