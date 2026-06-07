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
 * Server pipeline locks to whatever `EMMA_VOICE_CONFIG` declares in
 * `api/_session.ts`. Phase 3a (ticket 86c9hjnq1, 2026-04-28) moved that
 * to `en-GB-OliviaNeural` rate `-10%`; same config applies to
 * Greet's bundled MP3s. Frontend has no voice config to manage — the
 * audio is already rendered.
 */

import { Howl } from 'howler'
import type { Utterance } from '../../../api/_types'
import {
  recordHowlEndEventEvent,
  recordHowlLoaderrorEventEvent,
  recordHowlPlayCallEvent,
  recordHowlPlayEventEvent,
  recordOnplayWatchdogMissedEvent,
} from '../debug/audioContextProbe'
import { enqueueOnResume, isPendingResume } from './pendingResumeGate'

/**
 * Onplay watchdog deadline (ticket 86c9kxtmu round 2). If Howler's
 * `'play'` event hasn't fired this many ms after `howl.play()`, we
 * record an `'onplay-watchdog-missed'` row in the audioCtxLog. Pure
 * diagnostic — does NOT abort or retry playback. The deadline is
 * deliberately conservative: the cold-mount onplay latency on real
 * iPad is typically under 200 ms; 800 ms is well past where the
 * onplay event SHOULD have fired but short enough that the watchdog
 * fires within the same problem window. iPad PWA WebAudio
 * interruption (the round-2 hypothesis) drops the play event entirely;
 * this watchdog is the negative diagnostic for that.
 */
const ONPLAY_WATCHDOG_MS = 800

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
 * fires `onupgradeneeded`, which deletes the old store.
 *  - v1 = pre-PR-#82 (plain text → AnaNeural).
 *  - v2 = post-PR-#82 (digit-by-digit SSML for two-digit numbers, AnaNeural).
 *  - v3 = post-PR for ticket 86c9hjnq1 (Phase 3a, 2026-04-28): voice swap
 *    Ana → Emma multilingual. The SSML strategy is unchanged, but the
 *    rendered audio bytes differ entirely (different voice timbre), so
 *    every cached row from v2 must be invalidated.
 *  - v4 = British-voice rollout (2026-06-06, Thomas directive): voice swap
 *    en-US-EmmaMultilingualNeural → en-GB-OliviaNeural, PLUS a per-sound-
 *    class SSML treatment for the letter-sounds tier (300ms break before
 *    each isolated phoneme; question-prosody wrapper no longer applied to
 *    letter-sounds reads). Every cached row from v3 was rendered on the US
 *    voice and must be invalidated.
 */
export const CACHE_VERSION = 4
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

/**
 * Diagnostic helper (ticket 86c9hjnn8 follow-up). Reads Howler's
 * non-public `_src` and `_state` properties defensively. Howler's
 * public API doesn't expose `_src` (the internal source list it picks
 * from to feed `<audio>` / WebAudio) — but it's stable across versions
 * and is exactly the field we want for the audioCtxLog row. Truncated
 * to the first 80 chars to avoid 4 KB blob URLs blowing the storage
 * budget.
 *
 * Returns a normalised shape so the caller never has to inspect the
 * Howl internals. All reads are wrapped in try/catch — if Howler
 * renames a field we degrade to `'unknown'` rather than crash.
 */
export function readHowlInternals(howl: HowlLike): {
  howlSrc: string
  howlState: 'unloaded' | 'loading' | 'loaded' | 'unknown'
  howlDuration: number
} {
  let howlSrc = ''
  try {
    const raw = (howl as unknown as { _src?: unknown })._src
    if (typeof raw === 'string') {
      howlSrc = raw
    } else if (Array.isArray(raw) && typeof raw[0] === 'string') {
      howlSrc = raw[0]
    }
  } catch {
    // best-effort
  }
  // Truncate to the first 80 chars. Blob URLs run ~70 chars; remote
  // MP3 paths fit comfortably. Keeps the JSON tight.
  if (howlSrc.length > 80) howlSrc = howlSrc.slice(0, 80)

  let howlState: 'unloaded' | 'loading' | 'loaded' | 'unknown' = 'unknown'
  try {
    if (typeof howl.state === 'function') {
      const s = howl.state()
      if (s === 'unloaded' || s === 'loading' || s === 'loaded') howlState = s
    }
  } catch {
    // best-effort
  }

  let howlDuration = 0
  try {
    const d = howl.duration()
    if (typeof d === 'number' && Number.isFinite(d)) howlDuration = d
  } catch {
    // best-effort
  }

  return { howlSrc, howlState, howlDuration }
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
      // semantic as preRecorded — only one Emma utterance plays at a
      // time).
      if (activeStop) {
        activeStop()
        activeStop = null
      }

      // PR #137 round 2 (ticket 86c9kxtmu) — gesture-deferred recovery.
      // If the visibility-recovery gate is pending (iOS handed us a
      // suspended/interrupted ctx on the visible edge and we deferred
      // the resume to the next user gesture), DO NOT dispatch the play
      // here. Howler would return a sound id but the OS audio session
      // is still preempted; the play emits no audio (Thomas's PR #137
      // iPad capture proved this). Enqueue the dispatch instead — the
      // most-recent enqueue wins, and the next chip-tap / hub-node tap
      // / "tap to continue" affordance fires `drainOnGesture()` which
      // runs resume + unlock + invokes our queued thunk.
      //
      // The Promise returned by this function resolves/rejects on the
      // queued play's own settle path. If a NEWER play call replaces
      // ours in the queue, our promise stays pending until cancel()
      // settles it as 'cancelled' (per the existing single-line
      // semantic). Marian's Math/WordSong screens consume that
      // rejection-on-cancel via the read-aloud effect's catch.
      if (isPendingResume()) {
        enqueueOnResume({
          label: `sessionAudio:${utteranceId}`,
          run: () => {
            // The recursive call lands AFTER the gate has cleared
            // (drainOnGesture() clears affordance to 'idle' before
            // running queued handlers — but the order is: resume →
            // unlock → drain → clear). Wait, see pendingResumeGate.ts:
            // drain runs handlers BEFORE clear so the handler sees the
            // gate still as 'pending'. To avoid re-enqueue, we use a
            // direct `playRunSynchronously` path below. Easier: just
            // dispatch directly here, knowing the gate's drain runs us
            // inside the gesture window.
            //
            // We can't simply call `playSessionUtterance` recursively
            // — it would see `isPendingResume()` still true and re-
            // queue forever. Instead, dispatch the inner play synchronously
            // by re-entering the play body via `playSessionUtteranceImmediate`.
            playSessionUtteranceImmediate(utteranceId, playOpts).then(
              resolve,
              reject,
            )
          },
        })
        return
      }

      // Fallthrough — gate is idle, dispatch immediately.
      runImmediate(utteranceId, entry, playOpts, resolve, reject)
    })
  }

  /**
   * Internal — re-enter the play body without the pending-resume gate
   * check. Called by the `enqueueOnResume` thunk above; the gate's
   * `drainOnGesture` invokes us inside the user-gesture's tick, AFTER
   * the resume + silent-buffer kick. By that point the OS audio session
   * is re-engaged and the play call can dispatch normally.
   *
   * Mirrors the public `playSessionUtterance` shape (returns a Promise)
   * because the outer queued thunk wires resolve/reject to this
   * promise's settle path.
   */
  function playSessionUtteranceImmediate(
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
      if (activeStop) {
        activeStop()
        activeStop = null
      }
      runImmediate(utteranceId, entry, playOpts, resolve, reject)
    })
  }

  /**
   * Shared body for the "actually dispatch the howl" path. Pulled out
   * so the public entry point and the gesture-drain re-entry both run
   * the same listener-attach + watchdog + play sequence.
   */
  function runImmediate(
    utteranceId: string,
    entry: LoadedHowl,
    playOpts: PlaySessionUtteranceOptions,
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    {
      const { howl, text } = entry
      const wordCount = Math.max(1, countWords(text))

      const schedule =
        playOpts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
      const cancelSchedule =
        playOpts.cancelSchedule ?? ((h) => window.clearInterval(h as number))

      let tickHandle: unknown = null
      let watchdogHandle: ReturnType<typeof setTimeout> | null = null
      let onplaySeen = false
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
        if (watchdogHandle !== null) {
          clearTimeout(watchdogHandle)
          watchdogHandle = null
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

      // Diagnostic instrumentation (ticket 86c9hjnn8 follow-up). Capture
      // the play-call timestamp so each Howl event row carries a delta —
      // the iPad export shows whether play() → onPlay landed within ms,
      // seconds, or never.
      let playCallTimestamp = 0

      howl.on('play', () => {
        if (resolved || stopped) return
        onplaySeen = true
        if (watchdogHandle !== null) {
          clearTimeout(watchdogHandle)
          watchdogHandle = null
        }
        recordHowlPlayEventEvent(utteranceId, Date.now() - playCallTimestamp)
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
        recordHowlEndEventEvent(utteranceId, Date.now() - playCallTimestamp)
        settleResolve()
      })

      howl.on('loaderror', () => {
        recordHowlLoaderrorEventEvent(
          utteranceId,
          Date.now() - playCallTimestamp,
          `loaderror for utterance "${utteranceId}"`,
        )
        settleReject(
          new Error(`[sessionAudio] loaderror for utterance "${utteranceId}"`),
        )
      })

      howl.on('playerror', () => {
        // playerror also lands as a loaderror-class diagnostic — the
        // distinction (couldn't decode vs. couldn't play a decoded
        // sample) is iPad-significant and the Howler-side error
        // message is the only signal we have. Reuse the loaderror row
        // to keep the export schema small.
        recordHowlLoaderrorEventEvent(
          utteranceId,
          Date.now() - playCallTimestamp,
          `playerror for utterance "${utteranceId}"`,
        )
        settleReject(
          new Error(`[sessionAudio] playerror for utterance "${utteranceId}"`),
        )
      })

      try {
        // Diagnostic snapshot taken immediately before the play call so
        // the row in the audioCtxLog reflects the engine state Howler
        // saw at dispatch time.
        const internals = readHowlInternals(howl)
        playCallTimestamp = Date.now()
        recordHowlPlayCallEvent({
          utteranceId,
          howlSrc: internals.howlSrc,
          howlState: internals.howlState,
          howlDuration: internals.howlDuration,
        })
        howl.play()
        // Onplay watchdog (ticket 86c9kxtmu round 2). Pure diagnostic
        // — does NOT abort or retry. iPad PWA WebAudio interruption
        // surfaces here as `play()` returning a sound id but the
        // `'play'` event never firing; the audioCtxLog will then
        // carry a `'howl-play-call'` row with no matching
        // `'howl-play-event'` row, plus this watchdog row at +800 ms.
        // The pre-existing `recordHowlPlayCallEvent` row pairs by
        // `utteranceId`.
        watchdogHandle = setTimeout(() => {
          watchdogHandle = null
          if (resolved || stopped || onplaySeen) return
          recordOnplayWatchdogMissedEvent(utteranceId)
        }, ONPLAY_WATCHDOG_MS)
      } catch (err) {
        settleReject(
          err instanceof Error
            ? err
            : new Error(`[sessionAudio] play() threw: ${String(err)}`),
        )
      }
    }
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
