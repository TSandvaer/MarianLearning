/**
 * Manifest line player: the native port of the web's `playHubLine.ts`
 * (Hub welcome lines, and the Hub guidance lines through
 * `createHubLinePlayer({ lines })`) and `playMapLine.ts` (Emma's Path).
 *
 * Contract (same as the web):
 * - `playLine(id, { onPlay, onWordTick })` NEVER rejects. It resolves at the
 *   clip's end, on cancel, or after a silent caption walk at 165 wpm when
 *   the clip cannot play (no bundled copy, `src: null`, start timeout,
 *   player error). The screen always finishes its line.
 * - `cancelActive()` stops the line in flight (clip or caption walk) and
 *   resolves its promise without further ticks (web ticket 86c9m4afh).
 * - A line with `src: null` (the deferred `locked-later` / `gate-locked`
 *   path lines) plays nothing and walks its caption.
 */
import { HUB_LINES, type HubLineId } from '@marian/core/hub/hubLines'
import { audioForWebPath } from './bundledAudio'
import { FALLBACK_WPM, countWords } from './captionClock'
import { audioEngine, type AudioEngine } from './engine'
import type { LineCallbacks } from './linePlayback'

export interface ManifestLine {
  /** Web URL path of the bundled MP3, or `null` for caption-only. */
  src: string | null
  text: string
}

export interface ManifestLinePlayer<Id extends string> {
  playLine(id: Id, opts?: LineCallbacks): Promise<void>
  cancelActive(): void
  /** Release this manifest's players. */
  unload(): void
}

/** ms per word of the silent caption walk (web: 165 wpm). */
export const CAPTION_WALK_MS_PER_WORD = 60_000 / FALLBACK_WPM

export function createManifestLinePlayer<Id extends string>(
  name: string,
  lines: Readonly<Record<Id, ManifestLine>>,
  engine: AudioEngine = audioEngine,
): ManifestLinePlayer<Id> {
  const prefix = `${name}:`
  let cancelWalk: (() => void) | null = null
  let activeId: Id | null = null

  /** Silent caption walk, cancellable through `cancelActive()`. */
  function walk(
    text: string,
    opts: LineCallbacks,
    fromWord: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const wordCount = Math.max(1, countWords(text))
      const timers: ReturnType<typeof setTimeout>[] = []
      const finish = () => {
        timers.forEach(clearTimeout)
        if (cancelWalk === finish) cancelWalk = null
        resolve()
      }
      cancelWalk = finish
      if (fromWord === 0) {
        opts.onPlay?.()
        opts.onWordTick?.(0)
      }
      const first = Math.max(1, fromWord)
      if (first >= wordCount) {
        finish()
        return
      }
      for (let i = first; i < wordCount; i++) {
        timers.push(
          setTimeout(
            () => {
              opts.onWordTick?.(i)
              if (i === wordCount - 1) finish()
            },
            (i - first + 1) * CAPTION_WALK_MS_PER_WORD,
          ),
        )
      }
    })
  }

  function cancelActive(): void {
    cancelWalk?.()
    if (activeId !== null && engine.voice.activeLabel?.startsWith(prefix)) {
      engine.cancelVoice()
    }
    activeId = null
  }

  function playLine(id: Id, opts: LineCallbacks = {}): Promise<void> {
    cancelActive()
    const line = lines[id]
    const source = line.src === null ? undefined : audioForWebPath(line.src)
    if (source === undefined) return walk(line.text, opts, 0)

    activeId = id
    let ticked = -1
    return engine
      .speak(`${prefix}${id}`, source, {
        text: line.text,
        label: `${prefix}${id}`,
        onPlay: opts.onPlay,
        onWordTick: (i) => {
          ticked = i
          opts.onWordTick?.(i)
        },
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === 'cancelled') return
        // Clip failed: walk the rest of the caption silently.
        return walk(line.text, opts, ticked + 1)
      })
      .finally(() => {
        if (activeId === id) activeId = null
      })
  }

  return {
    playLine,
    cancelActive,
    unload() {
      cancelActive()
      engine.releasePrefix(prefix)
    },
  }
}

/** What the path player needs from a line (web: `PlayableLine`). */
export interface PlayablePathLine {
  id: string
  src: string | null
  text: string
}

export interface PathLinePlayer {
  /** Resolves when the line ends, fails or is cancelled; at once for
   *  `src: null` (the caller shows the caption only). Never rejects. */
  play(line: PlayablePathLine): Promise<void>
  cancel(): void
  unload(): void
}

/**
 * Emma's Path / map lines (web `playMapLine.ts`). A `PathLine` or a
 * guidance line from `@marian/core/emmasPath/*` can be passed as is.
 */
export function createPathLinePlayer(
  engine: AudioEngine = audioEngine,
): PathLinePlayer {
  const prefix = 'path:'
  function cancel(): void {
    if (engine.voice.activeLabel?.startsWith(prefix)) engine.cancelVoice()
  }
  return {
    play(line) {
      cancel()
      if (line.src === null) return Promise.resolve()
      const source = audioForWebPath(line.src)
      if (source === undefined) return Promise.resolve()
      return engine
        .speak(`${prefix}${line.id}`, source, {
          text: line.text,
          label: `${prefix}${line.id}`,
        })
        .catch(() => {
          // Caption is already shown; the web resolves quietly too.
        })
    },
    cancel,
    unload() {
      cancel()
      engine.releasePrefix(prefix)
    },
  }
}

/** Hub welcome-back + node-tap lines (`@marian/core/hub/hubLines`). */
const hubLines = createManifestLinePlayer<HubLineId>('hub', HUB_LINES)
export const playHubLine = hubLines.playLine
export const cancelActiveHubLine = hubLines.cancelActive
export const unloadHubLines = hubLines.unload
