/**
 * Map line player — plays Emma's Path Lily lines on the map screen.
 * Ticket 123jpnbc3dr (Emma's Path 8/10).
 *
 * Same shape as `playHubLine.ts`, reduced to what the map needs:
 *   - One Howl per bundled MP3, built lazily on first play and kept for
 *     the map's lifetime; `unload()` releases them all when the map leaves.
 *   - A new line stops the one in flight (taps can come fast).
 *   - A line with `src === null` (deferred `locked-later` / `gate-locked`,
 *     Thomas 2026-10-05) builds no Howl and plays nothing — the caller
 *     shows its caption only. Never falls back to browser speech.
 *   - Load / play errors resolve quietly; the caption is already shown.
 *   - Pending-resume gate: while iOS is recovering the audio session the
 *     play is queued and runs on the next gesture's drain.
 */

import { Howl } from 'howler'
import {
  enqueueOnResume,
  isPendingResume,
} from '../../lib/audio/pendingResumeGate'
import type { PathLine } from '../../lib/emmasPath/pathLines'

/** What the player needs from a line: a path line, or a guidance line
 *  (session end, Guidance G2) — both carry an id and a bundled src. */
export type PlayableLine = Pick<PathLine, 'id' | 'src'>

export interface MapHowlLike {
  play: () => number
  stop: () => void
  on: (event: 'end' | 'loaderror' | 'playerror', cb: () => void) => unknown
  off: (event: string) => unknown
  unload?: () => void
}

export interface MapLinePlayer {
  /** Resolves when the line ends, fails, is cancelled — or at once for `src: null`. */
  play: (line: PlayableLine) => Promise<void>
  cancel: () => void
  unload: () => void
}

export interface CreateMapLinePlayerOptions {
  HowlCtor?: new (opts: { src: string[]; preload: boolean }) => MapHowlLike
}

/** One entry per `play()` call, read on a preview / in e2e via
 *  `window.__mapLinePlays` (the MP3 fetch itself is served by the PWA
 *  service worker, which the page's request log does not see). */
export interface MapLinePlayRecord {
  id: string
  src: string | null
}

const MAX_RECORDS = 50

function record(line: PlayableLine): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __mapLinePlays?: MapLinePlayRecord[] }
  const log = (w.__mapLinePlays ??= [])
  log.push({ id: line.id, src: line.src })
  if (log.length > MAX_RECORDS) log.shift()
}

export function createMapLinePlayer(
  opts: CreateMapLinePlayerOptions = {},
): MapLinePlayer {
  const HowlCtor =
    opts.HowlCtor ??
    (Howl as unknown as NonNullable<CreateMapLinePlayerOptions['HowlCtor']>)
  const cache = new Map<string, MapHowlLike>()
  let active: { cancel: () => void } | null = null
  let unloaded = false

  function howlFor(src: string): MapHowlLike | null {
    const cached = cache.get(src)
    if (cached) return cached
    try {
      const howl = new HowlCtor({ src: [src], preload: true })
      cache.set(src, howl)
      return howl
    } catch (err) {
      console.warn(
        `[playMapLine] Howler unavailable for "${src}" (${
          err instanceof Error ? err.message : 'unknown'
        }) — caption only.`,
      )
      return null
    }
  }

  function cancel(): void {
    active?.cancel()
    active = null
  }

  function run(src: string): Promise<void> {
    if (unloaded) return Promise.resolve()
    const howl = howlFor(src)
    if (!howl) return Promise.resolve()
    return new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        try {
          howl.off('end')
          howl.off('loaderror')
          howl.off('playerror')
        } catch {
          // Howler detach on an unloaded howl is a no-op.
        }
        if (active === handle) active = null
        resolve()
      }
      const handle = {
        cancel: () => {
          try {
            howl.stop()
          } catch {
            // Already stopped / unloaded.
          }
          finish()
        },
      }
      active = handle
      howl.on('end', finish)
      howl.on('loaderror', () => {
        console.warn(`[playMapLine] loaderror for "${src}" — caption only.`)
        finish()
      })
      howl.on('playerror', () => {
        console.warn(`[playMapLine] playerror for "${src}" — caption only.`)
        finish()
      })
      try {
        howl.play()
      } catch {
        finish()
      }
    })
  }

  function play(line: PlayableLine): Promise<void> {
    cancel()
    record(line)
    // Deferred line: caption only — never load a null src.
    if (line.src === null) return Promise.resolve()
    const src = line.src
    if (isPendingResume()) {
      return new Promise<void>((resolve) => {
        enqueueOnResume({
          label: `mapLine:${line.id}`,
          run: () => {
            run(src).then(resolve)
          },
        })
      })
    }
    return run(src)
  }

  function unload(): void {
    cancel()
    unloaded = true
    for (const howl of cache.values()) {
      try {
        howl.unload?.()
      } catch {
        // Best effort.
      }
    }
    cache.clear()
  }

  return { play, cancel, unload }
}
