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
 *   mount, but the in-flight utterance MUST be cancellable mid-play —
 *   when Marian taps a skill-tree chip, the Hub line has to stop cleanly
 *   so it doesn't leak into Math/WordSong's read-aloud (ticket
 *   86c9m4afh, surfaced 2026-05-03). `cancelActive()` stops the
 *   most-recently-played Howl AND short-circuits the caption-walk
 *   fallback path (which was the audible source on a load-error path).
 *   Mirrors the `activeStop` plumbing in `lib/audio/preRecorded.ts`.
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
  /**
   * Cancel the most-recently-started Hub utterance. Stops the in-flight
   * Howl and any pending caption-walk fallback timer; resolves the
   * outstanding `playHubLine` promise without firing further `onWordTick`
   * callbacks. Idempotent — calling when nothing is playing is a no-op.
   *
   * Wired in ticket 86c9m4afh (2026-05-03) — Thomas's iPad ear-test
   * confirmed the Hub line was leaking past the route-flip into
   * Math/WordSong's read-aloud, because `Hub.tsx`'s old `cancelledRef`
   * only short-circuited caption-tick state updates and never told the
   * Howl to stop.
   */
  cancelActive: () => void
  /** Tear down all cached Howls. Idempotent. */
  unload: () => void
}

export interface CreateHubLinePlayerOptions {
  /** Test seam: Howl constructor. Production omits, real Howl is used. */
  HowlCtor?: typeof Howl
}

/**
 * Internal handle used by `cancelActive()` to stop whatever play path is
 * currently in flight. Either path (Howl or caption-walk) registers a
 * single one of these into the player's `activeHandle` slot when it
 * starts and clears it when it settles naturally.
 */
interface ActivePlayHandle {
  /** Stop the underlying audio + timers and resolve the outer promise. */
  cancel: () => void
}

/**
 * Caption-walk fallback. Same 165 wpm shape Hub.tsx had inline before
 * this module landed; lifted here so both the no-Howl path and the
 * load-failure path call the same code.
 *
 * `registerHandle` is invoked synchronously with a cancel handle so the
 * caller (createHubLinePlayer) can wire it into the active-play slot.
 * On normal completion the walker clears its own slot via the supplied
 * `onSettle` callback so a stale `cancelActive()` after natural end is
 * a no-op.
 */
function walkCaption(
  id: HubLineId,
  opts: PlayHubLineOptions,
  registerHandle?: (handle: ActivePlayHandle) => void,
  onSettle?: () => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    opts.onPlay?.()
    const wordCount = HUB_LINE_WORD_COUNTS[id]
    const totalMs = (wordCount / 165) * 60_000
    const interval = wordCount > 0 ? totalMs / wordCount : 0
    opts.onWordTick?.(0)
    if (wordCount <= 1) {
      onSettle?.()
      resolve()
      return
    }
    const schedule = opts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
    const cancelSchedule =
      opts.cancelSchedule ?? ((h) => window.clearInterval(h as number))
    let cancelled = false
    let i = 0
    const handle = schedule(() => {
      if (cancelled) return
      i += 1
      opts.onWordTick?.(i)
      if (i >= wordCount - 1) {
        cancelSchedule(handle)
        onSettle?.()
        resolve()
      }
    }, interval)
    registerHandle?.({
      cancel: () => {
        if (cancelled) return
        cancelled = true
        cancelSchedule(handle)
        onSettle?.()
        resolve()
      },
    })
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
  // Most-recently-started utterance, or null when nothing is playing.
  // `playHubLine` writes here on dispatch; both the natural-end path and
  // the explicit `cancelActive()` clear it. Hub plays at most one line
  // at a time so a single slot is sufficient (no FIFO queue).
  let activeHandle: ActivePlayHandle | null = null

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

  function clearActive(handle: ActivePlayHandle): void {
    if (activeHandle === handle) activeHandle = null
  }

  function playHubLine(
    id: HubLineId,
    playOpts: PlayHubLineOptions = {},
  ): Promise<void> {
    const howl = ensureHowl(id)
    if (!howl) {
      // No Howl path — register the walker's cancel directly.
      let walkHandle: ActivePlayHandle | null = null
      const promise = walkCaption(
        id,
        playOpts,
        (h) => {
          walkHandle = h
          activeHandle = h
        },
        () => {
          if (walkHandle) clearActive(walkHandle)
        },
      )
      return promise
    }

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

      const handle: ActivePlayHandle = {
        cancel: () => {
          if (resolved) return
          resolved = true
          // Stop the Howl FIRST so the audio actually goes silent on iPad.
          // `Howl.stop()` synchronously kills any in-flight playback;
          // detach() then nukes the event listeners so a late `end` event
          // (some Howler versions emit one on stop) doesn't double-resolve
          // or refire onWordTick callbacks.
          try {
            howl.stop()
          } catch {
            // best-effort — never throw on cancel
          }
          detach()
          clearActive(handle)
          resolve()
        },
      }
      activeHandle = handle

      const settle = () => {
        if (resolved) return
        resolved = true
        detach()
        clearActive(handle)
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
        // Hand the active-slot to the walker's own cancel handle so a
        // subsequent cancelActive() during the fallback walk also works.
        let walkHandle: ActivePlayHandle | null = null
        walkCaption(
          id,
          playOpts,
          (h) => {
            walkHandle = h
            activeHandle = h
          },
          () => {
            if (walkHandle) clearActive(walkHandle)
          },
        ).then(resolve)
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

  function cancelActive(): void {
    const handle = activeHandle
    if (!handle) return
    activeHandle = null
    handle.cancel()
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

  return { playHubLine, cancelActive, unload }
}

/** Module-level singleton — the default Hub.tsx wires in. */
const defaultPlayer = createHubLinePlayer()
export const playHubLine = defaultPlayer.playHubLine
export const cancelActiveHubLine = defaultPlayer.cancelActive
export const unloadHubLines = defaultPlayer.unload
