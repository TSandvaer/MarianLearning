/**
 * Howler-backed default player for Hub welcome-back lines.
 *
 * Why this module
 * ---------------
 * Hub.tsx ships with a `playLineFn` prop that defaults to a silent
 * caption-walk-only fallback (165 wpm). That was correct when the Hub
 * MP3 binaries had not yet shipped — Marian saw the ribbon walk word-by-
 * word with no audio, which was the planned v1 behaviour while Kyle's
 * asset-queue ticket (`86c9j53yx`) was outstanding.
 *
 * Kyle shipped the 18 MP3s in the same branch as PR #133. Thomas's iPad
 * ear-test (2026-05-02) flagged "no greet when I return to hub, just
 * text 'pick again'" — confirming the Hub was still running on the
 * silent fallback because no production caller was wiring `playLineFn`.
 * This module is the missing default: a Howler-backed player that loads
 * the manifest's MP3 lazily and resolves on the audio's `end` event,
 * driving caption ticks against the real audio duration when available.
 *
 * Design choices
 * --------------
 * - **Singleton-by-default.** Howl construction triggers an XHR for the
 *   asset; we cache one Howl per `HubLineId` so repeat playbacks don't
 *   re-fetch. The Hub component lives for the entire app session, so
 *   the cache cost is bounded by the manifest size (18 entries × small
 *   MP3s).
 * - **Soft-fail to caption-walk.** If the Howl fails to load (404,
 *   decode error, or CI without an audio backend), `playHubLine`
 *   resolves the same way the silent fallback does — `onWordTick` walks
 *   at 165 wpm and the promise settles. The screen never bricks.
 * - **One-line-at-a-time.** Hub plays at most one welcome-back line per
 *   mount, so we don't need the `cancel()` / `activeStop` plumbing the
 *   Greet `preRecorded.ts` carries. The `cancel()` helper exists for
 *   completeness but Hub never calls it (the cancel-on-node-tap path is
 *   handled at the consumer level via `cancelledRef`).
 * - **Test seam.** `createHubLinePlayer({ HowlCtor })` lets tests inject
 *   a fake Howl — same shape as `lib/sfx/sfx.ts` and
 *   `lib/audio/preRecorded.ts`. Production callers use the module-level
 *   `playHubLine` export.
 *
 * Mirrors `lib/audio/preRecorded.ts`'s shape but trimmed to Hub's needs.
 * Phase-3/4/5 audio-context-resume helpers from preRecorded.ts are
 * intentionally NOT replicated here: Hub mounts after the user has
 * already produced multiple gestures (Splash → Greet → Math/WordSong →
 * SessionEnd → Hub), so by the time a welcome-back line plays, the
 * Howler context has been running for minutes. The first-tap iOS unlock
 * is gated by `gestureUnlocked` in Hub.tsx; if Hub is the first screen
 * the user lands on (`path === 'app-open'`), the gate awaits the first
 * pointerdown before we ever call into this module.
 */

import { Howl } from 'howler'
import { HUB_LINES, HUB_LINE_WORD_COUNTS, type HubLineId } from './hubLines'

/** Minimal Howl shape we depend on — keeps the test surface tiny. */
export interface HubHowlLike {
  play: () => number
  stop: () => void
  duration: () => number
  on: (
    event: 'play' | 'end' | 'loaderror' | 'playerror',
    cb: (id?: number, err?: unknown) => void,
  ) => unknown
  off: (event: string) => unknown
  unload?: () => void
  state?: () => 'unloaded' | 'loading' | 'loaded'
}

export interface PlayHubLineOptions {
  /** Fires once when Howl emits `play`. Mirrors Math/Greet shape. */
  onPlay?: () => void
  /** Fires for each word as the linear timer advances. */
  onWordTick?: (wordIndex: number) => void
  /** Test seam — defaults to `window.setInterval`. */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearInterval`. */
  cancelSchedule?: (handle: unknown) => void
}

export interface HubLinePlayer {
  /**
   * Play one Hub line by id. Resolves on `end` (or on the caption-walk
   * fallback's last tick if the Howl failed to load). Never rejects —
   * load/play failures degrade to silent caption-walk so the screen
   * always finishes.
   */
  playHubLine: (id: HubLineId, opts?: PlayHubLineOptions) => Promise<void>
  /** Tear down all cached Howls. Idempotent. */
  unload: () => void
}

export interface CreateHubLinePlayerOptions {
  /** Test seam: Howl constructor. Production omits, real Howl is used. */
  HowlCtor?: typeof Howl
}

/**
 * Caption-walk fallback. Same 165 wpm shape Hub.tsx had inline before
 * this module landed; lifted here so both the no-Howl path and the
 * load-failure path call the same code.
 */
function walkCaption(id: HubLineId, opts: PlayHubLineOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    opts.onPlay?.()
    const wordCount = HUB_LINE_WORD_COUNTS[id]
    const totalMs = (wordCount / 165) * 60_000
    const interval = wordCount > 0 ? totalMs / wordCount : 0
    opts.onWordTick?.(0)
    if (wordCount <= 1) {
      resolve()
      return
    }
    const schedule = opts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
    const cancelSchedule =
      opts.cancelSchedule ?? ((h) => window.clearInterval(h as number))
    let i = 0
    const handle = schedule(() => {
      i += 1
      opts.onWordTick?.(i)
      if (i >= wordCount - 1) {
        cancelSchedule(handle)
        resolve()
      }
    }, interval)
  })
}

/**
 * Build a Howler-backed Hub-line player. Howls are constructed lazily on
 * first `playHubLine(id)`; subsequent calls reuse the cached instance.
 */
export function createHubLinePlayer(
  opts: CreateHubLinePlayerOptions = {},
): HubLinePlayer {
  const HowlCtor = opts.HowlCtor ?? Howl
  const cache = new Map<HubLineId, HubHowlLike>()
  // Latches per-line so a load failure produces exactly one console.warn
  // and the next play of the same line jumps straight to the caption-
  // walk fallback without re-attempting the Howl.
  const failed = new Set<HubLineId>()
  let warnedHowlerUnavailable = false

  function ensureHowl(id: HubLineId): HubHowlLike | null {
    if (failed.has(id)) return null
    const cached = cache.get(id)
    if (cached) return cached
    try {
      const howl = new HowlCtor({
        src: [HUB_LINES[id].src],
        preload: true,
      }) as unknown as HubHowlLike
      cache.set(id, howl)
      return howl
    } catch (err) {
      failed.add(id)
      if (!warnedHowlerUnavailable) {
        warnedHowlerUnavailable = true
        console.warn(
          `[playHubLine] Howler unavailable for "${HUB_LINES[id].src}" (${
            err instanceof Error ? err.message : 'unknown'
          }) — playing silently.`,
        )
      }
      return null
    }
  }

  function playHubLine(
    id: HubLineId,
    playOpts: PlayHubLineOptions = {},
  ): Promise<void> {
    const howl = ensureHowl(id)
    if (!howl) return walkCaption(id, playOpts)

    return new Promise<void>((resolve) => {
      const schedule =
        playOpts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
      const cancelSchedule =
        playOpts.cancelSchedule ?? ((h) => window.clearInterval(h as number))

      let tickHandle: unknown = null
      let resolved = false

      const detach = () => {
        try {
          howl.off('play')
          howl.off('end')
          howl.off('loaderror')
          howl.off('playerror')
        } catch {
          // best-effort
        }
        if (tickHandle !== null) {
          cancelSchedule(tickHandle)
          tickHandle = null
        }
      }

      const settle = () => {
        if (resolved) return
        resolved = true
        detach()
        resolve()
      }

      const fallbackToWalk = (reason: string) => {
        if (resolved) return
        if (!failed.has(id)) {
          failed.add(id)
          console.warn(
            `[playHubLine] ${reason} for "${HUB_LINES[id].src}" — falling back to silent caption-walk.`,
          )
        }
        // Drain any pending tick handle before we hand off to the walker
        // (which schedules its own interval).
        detach()
        resolved = true
        walkCaption(id, playOpts).then(resolve)
      }

      howl.on('play', () => {
        if (resolved) return
        playOpts.onPlay?.()
        const wordCount = HUB_LINE_WORD_COUNTS[id]
        playOpts.onWordTick?.(0)
        if (wordCount <= 1) return
        const duration = howl.duration()
        const totalMs =
          duration > 0 ? duration * 1000 : (wordCount / 165) * 60_000
        const intervalMs = totalMs / wordCount
        let nextWord = 1
        tickHandle = schedule(() => {
          if (resolved) return
          if (nextWord >= wordCount) {
            if (tickHandle !== null) {
              cancelSchedule(tickHandle)
              tickHandle = null
            }
            return
          }
          playOpts.onWordTick?.(nextWord)
          nextWord += 1
        }, intervalMs)
      })

      howl.on('end', () => {
        settle()
      })

      howl.on('loaderror', () => {
        fallbackToWalk('loaderror')
      })

      howl.on('playerror', () => {
        fallbackToWalk('playerror')
      })

      try {
        howl.play()
      } catch (err) {
        fallbackToWalk(
          `play() threw (${err instanceof Error ? err.message : 'unknown'})`,
        )
      }
    })
  }

  function unload(): void {
    for (const howl of cache.values()) {
      try {
        howl.unload?.()
      } catch {
        // best-effort
      }
    }
    cache.clear()
    failed.clear()
  }

  return { playHubLine, unload }
}

/** Module-level singleton — the default Hub.tsx wires in. */
const defaultPlayer = createHubLinePlayer()
export const playHubLine = defaultPlayer.playHubLine
export const unloadHubLines = defaultPlayer.unload
