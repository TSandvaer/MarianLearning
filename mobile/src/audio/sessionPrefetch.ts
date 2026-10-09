/**
 * Session prefetch for the Hub (native counterpart of the web's
 * `hubSessionPrefetch.ts` + App.tsx's kick latch). Not wired to a screen
 * yet; Phase 3's Hub calls it.
 *
 * Contract (same as the web):
 * - On Hub entry, `prefetch(key, args)` starts the session-start request for
 *   the world the Hub suggests. Only ONE prefetch exists: session audio is a
 *   singleton, so a second world would evict the first. A prefetch for a
 *   different key aborts and discards the previous one.
 * - On the world tap, `take(key)` returns the in-flight or settled request
 *   when its key still matches (track + focus node + mode), so the child
 *   never waits for a request that was already running. A stale key (a
 *   cloud-sync install or a parent-settings change landed while the Hub was
 *   up) or another world discards it and returns `null`; the caller then
 *   starts its own request.
 * - `discard()` aborts an in-flight prefetch and unloads a settled one.
 */
import {
  startSession,
  type PreparedSession,
  type SessionStartArgs,
  type SessionStartDeps,
  type SessionTrack,
} from './sessionStart'

/** Identity a session was prefetched under. */
export interface PrefetchKey {
  track: SessionTrack
  /** Focus node (`add-to-10`, `cvc-words`, ...). */
  node?: string
  /** Planner mode, when the caller has one. */
  mode?: string
}

export function samePrefetchKey(a: PrefetchKey, b: PrefetchKey): boolean {
  return a.track === b.track && a.node === b.node && a.mode === b.mode
}

export interface SessionPrefetcher {
  prefetch(key: PrefetchKey, args: Omit<SessionStartArgs, 'signal'>): void
  take(key: PrefetchKey): Promise<PreparedSession> | null
  discard(): void
  /** The key in flight or settled, for diagnostics. */
  readonly pendingKey: PrefetchKey | null
}

interface Pending {
  key: PrefetchKey
  controller: AbortController
  promise: Promise<PreparedSession>
  settled: PreparedSession | null
  discarded: boolean
}

export function createSessionPrefetcher(
  deps: SessionStartDeps & {
    start?: typeof startSession
  } = {},
): SessionPrefetcher {
  const start = deps.start ?? startSession
  let pending: Pending | null = null

  function discard(): void {
    const p = pending
    pending = null
    if (!p) return
    p.discarded = true
    p.controller.abort()
    p.settled?.audio.unload()
  }

  return {
    prefetch(key, args) {
      if (pending && samePrefetchKey(pending.key, key)) return
      discard()
      const controller = new AbortController()
      const entry: Pending = {
        key,
        controller,
        settled: null,
        discarded: false,
        promise: start({ ...args, signal: controller.signal }, deps),
      }
      entry.promise.then(
        (prepared) => {
          entry.settled = prepared
          // Discarded after its audio loaded: drop it here.
          if (entry.discarded) prepared.audio.unload()
        },
        () => {
          if (pending === entry) pending = null
        },
      )
      pending = entry
    },
    take(key) {
      const p = pending
      if (!p) return null
      if (!samePrefetchKey(p.key, key)) {
        discard()
        return null
      }
      // Hand it over: the taker owns the session (and its unload) now.
      pending = null
      return p.promise
    },
    discard,
    get pendingKey() {
      return pending?.key ?? null
    },
  }
}

/** The app's prefetcher. */
export const sessionPrefetcher: SessionPrefetcher = createSessionPrefetcher()
