/**
 * Session audio: the server-rendered MP3s in a `/api/claude` session-start
 * response (Math / Word Song reads, hints, correct/re-prompt lines, the
 * Session End utterances).
 *
 * Web: base64 → Blob → `blob:` URL → one Howl per utterance, cached in
 * IndexedDB (`src/lib/audio/sessionAudio.ts`, `mathPathA.ts`).
 * Native: base64 → one MP3 file per utterance under
 * `<cache>/session-audio/<sessionId>/` (expo-file-system decodes the base64
 * natively, off the JS heap) → expo-audio player on the `file://` URI.
 *
 * Files eager in the background, players lazy (measured in Expo Go; see
 * the PR):
 * - Files: one per distinct text (53 of a 76-utterance math session),
 *   written in plan order in slices of ≤ {@link WRITE_SLICE_MS} ms that
 *   yield to the JS thread between slices. All 76 written synchronously
 *   took 183 ms on the iOS 27 simulator but 9.2–14.8 s on the Android API
 *   37 emulator, which would freeze the UI that long. A line played before
 *   its file is written gets it written on the spot. Written base64 strings
 *   are dropped, so the ~1.3 MB of audio leaves the JS heap as it goes.
 * - Players: created on first play (or `prewarm`) and capped by the
 *   engine's LRU (`MAX_LIVE_VOICE_PLAYERS`); on Android each live player
 *   holds an MP3 decoder, and 53 at once failed to initialise.
 *
 * Bundled lines (no-Claude plan phase 1, `design/native/no-claude-sizing.md`
 * § 4): the app ships every canon clip, one per text (`npm run
 * export-audio`, `./canonAudioRegistry.ts`). A server line whose text the
 * app bundles, with the same bytes, plays the bundled clip and writes no
 * file; so does a `bundled` AudioRef. Other bytes are a re-render this
 * build does not have, so the server's bytes play, as before. "The same
 * bytes" is the same length and the same `clipHash` of the base64: a
 * re-take can keep its length (PR #558's "Read the fig." stayed 11492
 * bytes). Only a text's first line is hashed, and only when its length
 * matches. The `session-files` log row gives the time ("ms matching"): a
 * cvc-words session (62 lines, ~1.5 M base64 characters) took 57–69 ms on
 * the iOS 27 iPad simulator (Expo Go development bundle); each match saves
 * a file write.
 *
 * Duplicate texts (e.g. "Hmm... try again?" rendered once per problem)
 * resolve to their first id, exactly like `mathPathA.ts`, and every id of
 * that text plays the same file.
 *
 * Cleanup: `unload()` stops a playing session line, releases the
 * session's players and deletes its directory. `sweepSessionAudioCache()`
 * deletes directories left by a killed app (called at boot).
 */
import { Directory, File, Paths } from 'expo-file-system'
import type { PlayableUtterance } from '@marian/core/wire/types'
import { recordAudio } from './audioLog'
import { canonClipFor, clipHash, type BundledClip } from './bundledAudio'
import { audioEngine, type AudioEngine } from './engine'
import type { LineCallbacks } from './linePlayback'
import type { PlayerSource } from './playerPort'

/** File-system seam: the jest suite uses an in-memory store. */
export interface SessionFileStore {
  /** Write one utterance's MP3 (base64), returning its URI and size. */
  write(
    sessionId: string,
    utteranceId: string,
    base64: string,
  ): { uri: string; bytes: number }
  /** Delete one session's files. Best effort. */
  removeSession(sessionId: string): void
  /** Delete every session directory not in `keep`; returns how many. */
  removeAllExcept(keep: readonly string[]): number
}

const ROOT_NAME = 'session-audio'

/** File/dir names from server ids (`p1.read`, `end.opener`) — keep it safe. */
export function safeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function createExpoSessionFileStore(): SessionFileStore {
  const root = () => new Directory(Paths.cache, ROOT_NAME)
  const sessionDir = (sessionId: string) =>
    new Directory(Paths.cache, ROOT_NAME, safeName(sessionId))

  return {
    write(sessionId, utteranceId, base64) {
      const dir = sessionDir(sessionId)
      dir.create({ intermediates: true, idempotent: true })
      const file = new File(dir, `${safeName(utteranceId)}.mp3`)
      file.create({ overwrite: true })
      // SDK 58 made File.write() async; writeSync keeps the size read below
      // after the bytes are on disk.
      file.writeSync(base64, { encoding: 'base64' })
      return { uri: file.uri, bytes: file.size ?? 0 }
    },
    removeSession(sessionId) {
      try {
        const dir = sessionDir(sessionId)
        if (dir.exists) dir.delete()
      } catch {
        // The OS may purge caches on its own; nothing to do.
      }
    },
    removeAllExcept(keep) {
      let removed = 0
      try {
        const dir = root()
        if (!dir.exists) return 0
        const kept = new Set(keep.map(safeName))
        for (const entry of dir.list()) {
          if (entry instanceof Directory && !kept.has(entry.name)) {
            entry.delete()
            removed += 1
          }
        }
      } catch {
        // Best effort.
      }
      return removed
    },
  }
}

export interface LoadedSessionAudio {
  readonly sessionId: string
  /**
   * Text-keyed play, the screens' `playUtterance` contract (web
   * `PlayMathUtteranceFn`): resolves at the line's end, rejects with
   * `Error('cancelled')` when replaced. Text the server never rendered
   * fails soft: `onPlay` + every word tick at once, then resolves silently.
   */
  playUtterance(text: string, opts?: LineCallbacks): Promise<void>
  playUtteranceById(id: string, opts?: LineCallbacks): Promise<void>
  /** Write (if needed) and create a line's player ahead of its first play. */
  prewarm(text: string): void
  /**
   * A line's MP3, on disk (written now if needed) or bundled (its module),
   * and its byte length, for players outside the voice channel (Word Song's
   * tap sounds) and for matching a clip to its measured marks. `undefined`:
   * no such line.
   */
  fileFor(text: string): { uri: string | number; bytes: number } | undefined
  readonly textToId: ReadonlyMap<string, string>
  readonly utteranceCount: number
  /** Distinct texts this session writes as files (not bundled). */
  readonly fileCount: number
  /** Distinct texts played from the app's bundled clips (no file). */
  readonly bundledCount: number
  readonly filesWritten: number
  readonly bytesWritten: number
  /** Resolves once every file is written (or the session is unloaded). */
  readonly ready: Promise<void>
  /** Stop this session's line, release its players, delete its files. */
  unload(): void
}

/** Max JS-thread time per background write slice before yielding. */
export const WRITE_SLICE_MS = 8

export interface SessionAudioDeps {
  engine?: AudioEngine
  files?: SessionFileStore
  now?: () => number
  /** Yield to the JS thread, then run `fn` (default `setTimeout(fn, 0)`). */
  yieldThen?: (fn: () => void) => void
  /**
   * Load beside the current session instead of replacing it: the current
   * one is not unloaded and this one does not become current. The Map peek
   * (fast-track spec `design/native/fast-track-native.md` § 6.5): a peek
   * leaves the Hub's prefetched session alone. Its owner unloads it.
   */
  alongside?: boolean
  /** The app's bundled canon clips by text (default `canonClipFor`). */
  bundled?: (text: string) => BundledClip | undefined
}

let defaultFiles: SessionFileStore | null = null
const filesOrDefault = (files?: SessionFileStore) =>
  files ?? (defaultFiles ??= createExpoSessionFileStore())

/** The byte length `base64` decodes to. */
function base64Bytes(base64: string): number {
  const pad = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - pad
}

/** `u`'s bundled clip: its `bundled` ref, or the same text with the same bytes. */
function bundledClipOf(
  u: PlayableUtterance,
  bundled: (text: string) => BundledClip | undefined,
): BundledClip | undefined {
  if (u.audio.kind === 'bundled') return bundled(u.audio.key)
  const clip = bundled(u.text)
  return clip !== undefined &&
    clip.bytes === base64Bytes(u.audio.base64) &&
    clip.hash === clipHash(u.audio.base64)
    ? clip
    : undefined
}

/** The session whose files are on disk right now (one at a time). */
let current: LoadedSessionAudio | null = null

/**
 * Bind a session's MP3s and return its player; the files are written in
 * the background (see header). Replaces (unloads) any other loaded
 * session: session audio is a singleton, like the web's.
 */
export function loadSessionAudio(
  sessionId: string,
  utterances: readonly PlayableUtterance[],
  deps: SessionAudioDeps = {},
): LoadedSessionAudio {
  const engine = deps.engine ?? audioEngine
  const files = filesOrDefault(deps.files)
  const bundled = deps.bundled ?? canonClipFor
  const now = deps.now ?? Date.now
  const yieldThen = deps.yieldThen ?? ((fn: () => void) => setTimeout(fn, 0))
  if (!deps.alongside && current && current.sessionId !== sessionId) {
    current.unload()
  }

  const keyPrefix = `session:${safeName(sessionId)}:`
  /** id → its text; text → the first id with that text (the file's id). */
  const texts = new Map<string, string>()
  const textToId = new Map<string, string>()
  /** First id → base64 still to write, in plan order. */
  const pending = new Map<string, string>()
  /** First id → its bundled clip (nothing to write). */
  const bundledClips = new Map<string, BundledClip>()
  const uris = new Map<string, string>()
  const fileBytes = new Map<string, number>()
  const matchStart = now()
  for (const u of utterances) {
    // A duplicate's own inline audio is never played (its text's first id
    // owns the file), so only a first id is hashed.
    const first = !textToId.has(u.text)
    const clip =
      first || u.audio.kind === 'bundled'
        ? bundledClipOf(u, bundled)
        : undefined
    const base64 = u.audio.kind === 'inline' ? u.audio.base64 : ''
    // A line whose audio is not rendered yet (an empty clip in the canon,
    // e.g. content wave 1 before its Lily render) or a bundled ref this
    // build lacks: no file and no id, so `playUtterance` walks its caption
    // silently, as for any unknown text.
    if (clip === undefined && base64 === '') continue
    texts.set(u.id, u.text)
    if (first) {
      textToId.set(u.text, u.id)
      if (clip !== undefined) bundledClips.set(u.id, clip)
      else pending.set(u.id, base64)
    }
  }
  /** Time spent matching lines to bundled clips (the hashing, see header). */
  const matchMs = now() - matchStart
  const fileCount = pending.size

  let unloaded = false
  let bytesWritten = 0
  let busyMs = 0
  const t0 = now()
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  /** File ids whose write threw (full disk, ...): soft-failed, not retried. */
  const failed = new Set<string>()

  /**
   * Write one file now (background slice or on demand). Never throws: a
   * failed write (expo-file-system throws on a full disk) is recorded and
   * the line falls back to the web's soft paths (caption walk / reject).
   */
  function writeOne(fileId: string): string | undefined {
    const done = uris.get(fileId)
    if (done !== undefined) return done
    const base64 = pending.get(fileId)
    if (base64 === undefined) return undefined
    pending.delete(fileId)
    const start = now()
    try {
      const { uri, bytes } = files.write(sessionId, fileId, base64)
      uris.set(fileId, uri)
      fileBytes.set(fileId, bytes)
      bytesWritten += bytes
      return uri
    } catch (err) {
      failed.add(fileId)
      recordAudio({
        kind: 'note',
        label: 'session-file-write',
        detail: `failed for "${fileId}": ${err instanceof Error ? err.message : String(err)}`,
      })
      return undefined
    } finally {
      busyMs += now() - start
      if (pending.size === 0) finishWrites()
    }
  }

  let finished = false
  function finishWrites(): void {
    if (finished) return
    finished = true
    recordAudio({
      kind: 'session-load',
      label: 'session-files',
      ms: now() - t0,
      detail:
        `${uris.size} files ${bytesWritten} bytes, ${Math.round(busyMs)} ms writing` +
        (failed.size > 0 ? `, ${failed.size} failed` : '') +
        (bundledClips.size > 0
          ? `, ${bundledClips.size} bundled (${Math.round(matchMs)} ms matching)`
          : ''),
    })
    resolveReady()
  }

  function slice(): void {
    if (unloaded) return
    const start = now()
    for (const fileId of Array.from(pending.keys())) {
      writeOne(fileId)
      if (now() - start >= WRITE_SLICE_MS) break
    }
    if (pending.size > 0) yieldThen(slice)
  }
  if (fileCount === 0) finishWrites()
  else yieldThen(slice)

  /**
   * A file id's clip: its bundled module, or its file (written now if
   * needed). `undefined`: the write failed.
   */
  function clipOf(
    fileId: string,
  ): { uri: string | number; bytes: number } | undefined {
    const clip = bundledClips.get(fileId)
    if (clip !== undefined) return { uri: clip.module, bytes: clip.bytes }
    const uri = writeOne(fileId)
    return uri === undefined
      ? undefined
      : { uri, bytes: fileBytes.get(fileId) ?? 0 }
  }
  const sourceOf = (uri: string | number): PlayerSource =>
    typeof uri === 'number' ? uri : { uri }

  /** The file id for an utterance id (duplicates share the first id's). */
  const fileIdOf = (id: string): string | undefined => {
    const text = texts.get(id)
    return text === undefined ? undefined : textToId.get(text)
  }

  function playUtteranceById(
    id: string,
    opts: LineCallbacks = {},
  ): Promise<void> {
    const fileId = fileIdOf(id)
    if (unloaded || fileId === undefined) {
      return Promise.reject(
        new Error(
          `[sessionAudio] no utterance "${id}" in session ${sessionId}`,
        ),
      )
    }
    const clip = clipOf(fileId)
    if (clip === undefined) {
      return Promise.reject(
        new Error(
          `[sessionAudio] no audio file for "${id}" in session ${sessionId} (write failed)`,
        ),
      )
    }
    return engine.speak(`${keyPrefix}${fileId}`, sourceOf(clip.uri), {
      text: texts.get(id) ?? '',
      label: `session:${id}`,
      onPlay: opts.onPlay,
      onWordTick: opts.onWordTick,
      onTime: opts.onTime,
      endAtMs: opts.endAtMs,
    })
  }

  const session: LoadedSessionAudio = {
    sessionId,
    playUtterance(text, opts = {}) {
      const id = textToId.get(text)
      // Unknown text, an unloaded session or a file that could not be
      // written: caption only, resolve silently (web mathPathA.ts:415-429).
      if (id === undefined || unloaded || clipOf(id) === undefined) {
        opts.onPlay?.()
        const words = text.split(/\s+/).filter(Boolean)
        for (let i = 0; i < words.length; i++) opts.onWordTick?.(i)
        return Promise.resolve()
      }
      return playUtteranceById(id, opts)
    },
    playUtteranceById,
    prewarm(text) {
      const id = textToId.get(text)
      if (unloaded || id === undefined) return
      const clip = clipOf(id)
      if (clip !== undefined) {
        engine.preload(`${keyPrefix}${id}`, sourceOf(clip.uri))
      }
    },
    fileFor(text) {
      const id = textToId.get(text)
      if (unloaded || id === undefined) return undefined
      return clipOf(id)
    },
    textToId,
    utteranceCount: utterances.length,
    fileCount,
    bundledCount: bundledClips.size,
    get filesWritten() {
      return uris.size
    },
    get bytesWritten() {
      return bytesWritten
    },
    ready,
    unload() {
      if (unloaded) return
      unloaded = true
      pending.clear()
      resolveReady()
      if (engine.voice.activeLabel?.startsWith('session:')) {
        engine.cancelVoice()
      }
      engine.releasePrefix(keyPrefix)
      files.removeSession(sessionId)
      if (current === session) current = null
    },
  }
  if (!deps.alongside) current = session
  return session
}

/** The loaded session, if any. */
export function currentSessionAudio(): LoadedSessionAudio | null {
  return current
}

/** Delete session directories a killed app left behind. Call at boot. */
export function sweepSessionAudioCache(files?: SessionFileStore): number {
  const keep = current ? [current.sessionId] : []
  return filesOrDefault(files).removeAllExcept(keep)
}
