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
 * Duplicate texts (e.g. "Hmm... try again?" rendered once per problem)
 * resolve to their first id, exactly like `mathPathA.ts`, and every id of
 * that text plays the same file.
 *
 * Cleanup: `unload()` stops a playing session line, releases the
 * session's players and deletes its directory. `sweepSessionAudioCache()`
 * deletes directories left by a killed app (called at boot).
 */
import { Directory, File, Paths } from 'expo-file-system'
import type { Utterance } from '@marian/core/wire/types'
import { recordAudio } from './audioLog'
import { audioEngine, type AudioEngine } from './engine'
import type { LineCallbacks } from './linePlayback'

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
      file.write(base64, { encoding: 'base64' })
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
  readonly textToId: ReadonlyMap<string, string>
  readonly utteranceCount: number
  /** Distinct texts = files this session writes. */
  readonly fileCount: number
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
}

let defaultFiles: SessionFileStore | null = null
const filesOrDefault = (files?: SessionFileStore) =>
  files ?? (defaultFiles ??= createExpoSessionFileStore())

/** The session whose files are on disk right now (one at a time). */
let current: LoadedSessionAudio | null = null

/**
 * Bind a session's MP3s and return its player; the files are written in
 * the background (see header). Replaces (unloads) any other loaded
 * session: session audio is a singleton, like the web's.
 */
export function loadSessionAudio(
  sessionId: string,
  utterances: readonly Utterance[],
  deps: SessionAudioDeps = {},
): LoadedSessionAudio {
  const engine = deps.engine ?? audioEngine
  const files = filesOrDefault(deps.files)
  const now = deps.now ?? Date.now
  const yieldThen = deps.yieldThen ?? ((fn: () => void) => setTimeout(fn, 0))
  if (current && current.sessionId !== sessionId) current.unload()

  const keyPrefix = `session:${safeName(sessionId)}:`
  /** id → its text; text → the first id with that text (the file's id). */
  const texts = new Map<string, string>()
  const textToId = new Map<string, string>()
  /** First id → base64 still to write, in plan order. */
  const pending = new Map<string, string>()
  const uris = new Map<string, string>()
  for (const u of utterances) {
    texts.set(u.id, u.text)
    if (!textToId.has(u.text)) {
      textToId.set(u.text, u.id)
      pending.set(u.id, u.audio.base64)
    }
  }
  const fileCount = pending.size

  let unloaded = false
  let bytesWritten = 0
  let busyMs = 0
  const t0 = now()
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  /** Write one file now (background slice or on demand). */
  function writeOne(fileId: string): string | undefined {
    const done = uris.get(fileId)
    if (done !== undefined) return done
    const base64 = pending.get(fileId)
    if (base64 === undefined) return undefined
    pending.delete(fileId)
    const start = now()
    const { uri, bytes } = files.write(sessionId, fileId, base64)
    busyMs += now() - start
    uris.set(fileId, uri)
    bytesWritten += bytes
    if (pending.size === 0) finishWrites()
    return uri
  }

  function finishWrites(): void {
    recordAudio({
      kind: 'session-load',
      label: 'session-files',
      ms: now() - t0,
      detail: `${uris.size} files ${bytesWritten} bytes, ${Math.round(busyMs)} ms writing`,
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
  if (fileCount === 0) resolveReady()
  else yieldThen(slice)

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
    const uri = unloaded || fileId === undefined ? undefined : writeOne(fileId)
    if (fileId === undefined || uri === undefined) {
      return Promise.reject(
        new Error(
          `[sessionAudio] no utterance "${id}" in session ${sessionId}`,
        ),
      )
    }
    return engine.speak(
      `${keyPrefix}${fileId}`,
      { uri },
      {
        text: texts.get(id) ?? '',
        label: `session:${id}`,
        onPlay: opts.onPlay,
        onWordTick: opts.onWordTick,
      },
    )
  }

  const session: LoadedSessionAudio = {
    sessionId,
    playUtterance(text, opts = {}) {
      const id = textToId.get(text)
      if (id === undefined || unloaded) {
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
      const uri = writeOne(id)
      if (uri !== undefined) engine.preload(`${keyPrefix}${id}`, { uri })
    },
    textToId,
    utteranceCount: utterances.length,
    fileCount,
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
  current = session
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
