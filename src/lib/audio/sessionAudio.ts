/**
 * Session-supplied audio playback.
 *
 * Sibling to `preRecorded.ts` (which serves Greet's 4 fixed bundled MP3s).
 * This module handles per-session, server-rendered MP3s that arrive in the
 * session-start API response — Math problems, Word Song words, hint
 * prompts, etc. The rendering happens in the Vercel function via Edge
 * AnaNeural at session-start time; this module just plays back what the
 * server sent.
 *
 * Why a separate module from preRecorded
 * --------------------------------------
 * Greet's audio is keyed on a 4-element enum and lives in `public/`;
 * session audio is keyed on a string id supplied by the server and lives
 * in IndexedDB. The playback core (Howler + linear caption-tick timer) is
 * the same, but the lifecycle, caching, and source-resolution are
 * different enough that smushing them together would obscure both. They
 * share the LinearTickPlayer pattern via duplication, not abstraction —
 * the duplicated surface is small (~40 lines) and the abstraction cost
 * (an extra layer of indirection in tests) is higher than the duplication
 * cost.
 *
 * Caching
 * -------
 * Each session's audio is keyed by a sessionId the caller supplies. We
 * persist the inline base64 to IndexedDB (under store name
 * `session-audio-v${CACHE_VERSION}`, one row per sessionId carrying a
 * Map<utteranceId, base64>) so that a full-app reload mid-session doesn't
 * re-fetch from the network. Cleared on `clearSessionAudio(sessionId)` —
 * the session-end orchestrator calls that. Quota errors fall back
 * gracefully to in-memory only.
 *
 * Cache invalidation
 * ------------------
 * The cache key is `sessionId` only — it does NOT fingerprint the SSML,
 * voice, or prosody settings used to render the audio. When the
 * server-side TTS rendering shape changes (e.g. PR #82 introduced
 * digit-by-digit SSML for two-digit numbers), pre-existing cached audio
 * keyed by the same `sessionId` becomes stale. To invalidate the bucket,
 * bump `CACHE_VERSION` below; that changes both `STORE_NAME` and the
 * IndexedDB `DB_VERSION` integer, which fires `onupgradeneeded` and drops
 * every prior store. One cold session-start refetch is the cost; it is
 * cheap on F0 Azure (20 tx/s) for a single-user app.
 *
 * Voice consistency
 * -----------------
 * Server pipeline locks to `en-US-AnaNeural` rate `-10%`, identical to
 * Greet's Plan B voice. Frontend has no voice config to manage — the audio
 * is already rendered.
 */

import { Howl } from 'howler'
import type { Utterance } from '../../../api/_types'

/** Minimal Howl-shape we depend on. Identical to preRecorded.HowlLike;
 *  duplicated rather than imported to keep the modules independent. */
export interface HowlLike {
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

export interface PlaySessionUtteranceOptions {
  /** Fires once when Howler emits `play`. */
  onPlay?: () => void
  /**
   * Linear word-tick callback. The text from the matched Utterance is
   * split on whitespace; word 0 fires immediately on play, the rest fire
   * at `duration / wordCount` intervals. If `duration()` returns 0 we
   * fall back to 165 wpm — matching `preRecorded.ts` and `boundary.ts`.
   */
  onWordTick?: (wordIndex: number) => void
  /** Test seam — defaults to `window.setInterval`. */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearInterval`. */
  cancelSchedule?: (handle: unknown) => void
}

/** Minimal IndexedDB-shape we depend on. The standard IDBDatabase has a
 *  large surface; we only need open / get / put / delete on a single store. */
export interface SessionAudioCache {
  get: (sessionId: string) => Promise<Map<string, string> | null>
  put: (sessionId: string, audios: Map<string, string>) => Promise<void>
  remove: (sessionId: string) => Promise<void>
}

export interface SessionAudio {
  /**
   * Bind a session's utterance list. Reads any cached base64 from
   * IndexedDB, falls back to the supplied utterances, builds Howls for
   * each, and resolves with the loaded map. Subsequent calls with the
   * same sessionId return the cached in-memory map.
   */
  loadSessionAudio: (
    sessionId: string,
    utterances: Utterance[],
  ) => Promise<Map<string, HowlLike>>
  /** Play a previously-loaded utterance. Rejects with `Error('cancelled')`
   *  if cancel() or another play call interrupts it. */
  playSessionUtterance: (
    utteranceId: string,
    opts?: PlaySessionUtteranceOptions,
  ) => Promise<void>
  /** Cancel any in-flight playback. */
  cancel: () => void
  /** Tear down all cached Howls + revoke their blob URLs. */
  unload: () => void
  /** Drop the session's audio from the IndexedDB cache. */
  clearSessionAudio: (sessionId: string) => Promise<void>
}

export interface CreateSessionAudioOptions {
  /** Test seam — Howl constructor. */
  HowlCtor?: typeof Howl
  /** Test seam — IndexedDB cache adapter. Defaults to the production
   *  adapter built on `indexedDB` if available; falls back to a no-op
   *  in-memory adapter when absent (jsdom, restrictive iPad PWA). */
  cache?: SessionAudioCache
  /** Test seam — blob URL generator. Defaults to `URL.createObjectURL`. */
  createBlobUrl?: (blob: Blob) => string
  /** Test seam — blob URL revoker. Defaults to `URL.revokeObjectURL`. */
  revokeBlobUrl?: (url: string) => void
}

/**
 * Bump this whenever the server-side TTS rendering shape changes — SSML
 * strategy, voice, prosody attrs, etc. — so the IndexedDB-cached MP3s from
 * the previous shape are dropped on next load. The store name and the
 * IndexedDB schema version both derive from this constant; bumping it
 * fires `onupgradeneeded`, which deletes the old store. v1 = pre-PR-#82
 * (plain text → AnaNeural). v2 = post-PR-#82 (digit-by-digit SSML for
 * two-digit numbers).
 */
export const CACHE_VERSION = 2
export const STORE_NAME = `session-audio-v${CACHE_VERSION}`
export const DB_NAME = 'marian-tutor-session-audio'
/** Tied to CACHE_VERSION so `onupgradeneeded` fires on any bump. The IDB
 *  spec only triggers upgrades when the integer goes UP relative to the
 *  on-disk version; bumping in lockstep with CACHE_VERSION keeps that
 *  contract automatic. */
export const DB_VERSION = CACHE_VERSION

/** Production IndexedDB cache. Returns a no-op adapter when IndexedDB is
 *  unavailable or any operation throws — failing soft is correct because
 *  the in-memory map already gives us a working session. */
export function createIndexedDbCache(): SessionAudioCache {
  const noop: SessionAudioCache = {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  }

  if (typeof indexedDB === 'undefined') return noop

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        // Drop any store from a prior CACHE_VERSION. Keeps the DB tidy
        // and — critically — guarantees stale audio rendered with the
        // previous SSML/voice/prosody shape can never be served.
        for (const name of Array.from(db.objectStoreNames)) {
          if (name !== STORE_NAME) {
            db.deleteObjectStore(name)
          }
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () =>
        reject(req.error ?? new Error('indexedDB open failed'))
    })
  }

  return {
    async get(sessionId: string): Promise<Map<string, string> | null> {
      let db: IDBDatabase | null = null
      try {
        db = await openDb()
        const result = await new Promise<Map<string, string> | null>(
          (resolve, reject) => {
            const tx = db!.transaction(STORE_NAME, 'readonly')
            const req = tx.objectStore(STORE_NAME).get(sessionId)
            req.onsuccess = () => {
              const v = req.result
              if (!v || !(v instanceof Map)) {
                resolve(null)
                return
              }
              resolve(v as Map<string, string>)
            }
            req.onerror = () => reject(req.error)
          },
        )
        return result
      } catch {
        return null
      } finally {
        // Close the connection so a subsequent open with a higher version
        // (or a deleteDatabase in tests) is not blocked by stale handles.
        try {
          db?.close()
        } catch {
          // best-effort
        }
      }
    },
    async put(sessionId: string, audios: Map<string, string>): Promise<void> {
      let db: IDBDatabase | null = null
      try {
        db = await openDb()
        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).put(audios, sessionId)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      } catch {
        // QuotaExceededError or similar — the in-memory copy is still good.
      } finally {
        try {
          db?.close()
        } catch {
          // best-effort
        }
      }
    },
    async remove(sessionId: string): Promise<void> {
      let db: IDBDatabase | null = null
      try {
        db = await openDb()
        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).delete(sessionId)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      } catch {
        // Swallow — caller treats "could not remove" as best-effort.
      } finally {
        try {
          db?.close()
        } catch {
          // best-effort
        }
      }
    },
  }
}

/** Decode a base64 string into a Uint8Array. Browser-side only — uses
 *  `atob`. Pulled out as a helper so tests can sanity-check. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Count the words in a text string the same way the Greet sequence does:
 *  split on whitespace, drop empty tokens. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

interface LoadedHowl {
  howl: HowlLike
  text: string
  blobUrl: string
}

export function createSessionAudio(
  opts: CreateSessionAudioOptions = {},
): SessionAudio {
  const HowlCtor = opts.HowlCtor ?? Howl
  const cache = opts.cache ?? createIndexedDbCache()
  const createBlobUrl =
    opts.createBlobUrl ??
    ((blob: Blob) => {
      if (typeof URL === 'undefined' || !URL.createObjectURL) {
        // jsdom may lack URL.createObjectURL — return a placeholder. The
        // Howl will fail to load, which the caller's error path handles.
        return `blob:noop-${Math.random().toString(36).slice(2)}`
      }
      return URL.createObjectURL(blob)
    })
  const revokeBlobUrl =
    opts.revokeBlobUrl ??
    ((url: string) => {
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(url)
      }
    })

  let loaded: Map<string, LoadedHowl> | null = null
  let activeSessionId: string | null = null
  let activeStop: (() => void) | null = null

  function buildHowls(
    utterances: Utterance[],
    cachedBase64: Map<string, string>,
  ): Map<string, LoadedHowl> {
    const map = new Map<string, LoadedHowl>()
    for (const u of utterances) {
      const b64 = cachedBase64.get(u.id) ?? u.audio.base64
      const bytes = base64ToBytes(b64)
      // Some bundlers complain about ArrayBufferLike vs ArrayBuffer for
      // Blob; slice() narrows to a fresh ArrayBuffer.
      const blob = new Blob([bytes.slice().buffer], { type: u.audio.mime })
      const blobUrl = createBlobUrl(blob)
      const howl = new HowlCtor({
        src: [blobUrl],
        format: ['mp3'],
        // Blob URLs need explicit format hint; without it Howler's
        // extension-from-URL probe fails on `blob:` schemes.
        preload: true,
      }) as unknown as HowlLike
      map.set(u.id, { howl, text: u.text, blobUrl })
    }
    return map
  }

  async function loadSessionAudio(
    sessionId: string,
    utterances: Utterance[],
  ): Promise<Map<string, HowlLike>> {
    // Same session, already loaded → return the existing map.
    if (loaded && activeSessionId === sessionId) {
      return new Map(Array.from(loaded.entries()).map(([k, v]) => [k, v.howl]))
    }

    // Different session, or first load → tear down any prior state.
    if (loaded) doUnload()

    activeSessionId = sessionId

    // Try the cache first; if absent, use the inline base64 the server
    // sent and write that to the cache for next time.
    const cached = (await cache.get(sessionId)) ?? new Map<string, string>()
    const built = buildHowls(utterances, cached)
    loaded = built

    // Persist a fresh map of {id -> base64} so a full reload mid-session
    // can rehydrate without a network round-trip. We always rewrite — the
    // server is the source of truth, and the payload is small enough that
    // re-serialising once per session-start is cheap.
    const toPersist = new Map<string, string>()
    for (const u of utterances) {
      toPersist.set(u.id, cached.get(u.id) ?? u.audio.base64)
    }
    // Fire-and-forget — the in-memory copy is sufficient for playback.
    void cache.put(sessionId, toPersist)

    return new Map(Array.from(built.entries()).map(([k, v]) => [k, v.howl]))
  }

  function playSessionUtterance(
    utteranceId: string,
    playOpts: PlaySessionUtteranceOptions = {},
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!loaded) {
        reject(
          new Error(
            '[sessionAudio] loadSessionAudio() must be called before play',
          ),
        )
        return
      }
      const entry = loaded.get(utteranceId)
      if (!entry) {
        reject(
          new Error(
            `[sessionAudio] no utterance with id "${utteranceId}" — call load again?`,
          ),
        )
        return
      }

      // Cancel any prior in-flight playback first (same single-line
      // semantic as preRecorded — only one Melody utterance plays at a
      // time).
      if (activeStop) {
        activeStop()
        activeStop = null
      }

      const { howl, text } = entry
      const wordCount = Math.max(1, countWords(text))

      const schedule =
        playOpts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
      const cancelSchedule =
        playOpts.cancelSchedule ?? ((h) => window.clearInterval(h as number))

      let tickHandle: unknown = null
      let resolved = false
      let stopped = false

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
        activeStop = null
      }

      const settleResolve = () => {
        if (resolved) return
        resolved = true
        detach()
        resolve()
      }

      const settleReject = (err: Error) => {
        if (resolved) return
        resolved = true
        detach()
        reject(err)
      }

      activeStop = () => {
        if (resolved) return
        stopped = true
        try {
          howl.stop()
        } catch {
          // best-effort
        }
        settleReject(new Error('cancelled'))
      }

      howl.on('play', () => {
        if (resolved || stopped) return
        playOpts.onPlay?.()
        playOpts.onWordTick?.(0)
        if (wordCount > 1) {
          const duration = howl.duration()
          const totalMs =
            duration > 0 ? duration * 1000 : (wordCount / 165) * 60_000
          const intervalMs = totalMs / wordCount
          let nextWord = 1
          tickHandle = schedule(() => {
            if (resolved || stopped) return
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
        }
      })

      howl.on('end', () => {
        settleResolve()
      })

      howl.on('loaderror', () => {
        settleReject(
          new Error(`[sessionAudio] loaderror for utterance "${utteranceId}"`),
        )
      })

      howl.on('playerror', () => {
        settleReject(
          new Error(`[sessionAudio] playerror for utterance "${utteranceId}"`),
        )
      })

      try {
        howl.play()
      } catch (err) {
        settleReject(
          err instanceof Error
            ? err
            : new Error(`[sessionAudio] play() threw: ${String(err)}`),
        )
      }
    })
  }

  function cancel(): void {
    if (activeStop) {
      activeStop()
      activeStop = null
    }
  }

  function doUnload(): void {
    cancel()
    if (loaded) {
      for (const entry of loaded.values()) {
        try {
          entry.howl.unload?.()
        } catch {
          // best-effort
        }
        try {
          revokeBlobUrl(entry.blobUrl)
        } catch {
          // best-effort
        }
      }
      loaded = null
      activeSessionId = null
    }
  }

  function unload(): void {
    doUnload()
  }

  function clearSessionAudio(sessionId: string): Promise<void> {
    if (activeSessionId === sessionId) {
      doUnload()
    }
    return cache.remove(sessionId)
  }

  return {
    loadSessionAudio,
    playSessionUtterance,
    cancel,
    unload,
    clearSessionAudio,
  }
}

/** Module-level singleton — most callers use these functions directly. */
const defaultInstance = createSessionAudio()

export const loadSessionAudio = defaultInstance.loadSessionAudio
export const playSessionUtterance = defaultInstance.playSessionUtterance
export const cancelSessionAudio = defaultInstance.cancel
export const unloadSessionAudio = defaultInstance.unload
export const clearSessionAudio = defaultInstance.clearSessionAudio
