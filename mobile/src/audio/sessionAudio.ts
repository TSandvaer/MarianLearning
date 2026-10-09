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
 * Eager files, lazy players (measured; see the PR):
 * - All files are written when the session loads. The response is already
 *   parsed into JS strings by then; writing them all releases ~1.7 MB of
 *   base64 from the JS heap at once and keeps the write off every play.
 * - Players are created on first play (or `prewarm`), never all 76 up
 *   front: a native player per utterance costs memory and a decoder for
 *   lines that are never heard (a session plays ~30–40 of its 76).
 *
 * Duplicate texts (e.g. "Hmm... try again?" rendered once per problem)
 * resolve to their first id, exactly like `mathPathA.ts`; the extra files
 * are still written so `playUtteranceById` works for every id.
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
  /** Create a line's player ahead of its first play. */
  prewarm(text: string): void
  readonly textToId: ReadonlyMap<string, string>
  readonly utteranceCount: number
  readonly bytesWritten: number
  /** Stop this session's line, release its players, delete its files. */
  unload(): void
}

export interface SessionAudioDeps {
  engine?: AudioEngine
  files?: SessionFileStore
  now?: () => number
}

let defaultFiles: SessionFileStore | null = null
const filesOrDefault = (files?: SessionFileStore) =>
  files ?? (defaultFiles ??= createExpoSessionFileStore())

/** The session whose files are on disk right now (one at a time). */
let current: LoadedSessionAudio | null = null

/**
 * Write a session's MP3s and return its player. Replaces (unloads) any
 * other loaded session: session audio is a singleton, like the web's.
 */
export function loadSessionAudio(
  sessionId: string,
  utterances: readonly Utterance[],
  deps: SessionAudioDeps = {},
): LoadedSessionAudio {
  const engine = deps.engine ?? audioEngine
  const files = filesOrDefault(deps.files)
  const now = deps.now ?? Date.now
  if (current && current.sessionId !== sessionId) current.unload()

  const keyPrefix = `session:${safeName(sessionId)}:`
  const uris = new Map<string, string>()
  const texts = new Map<string, string>()
  const textToId = new Map<string, string>()
  let bytesWritten = 0

  const t0 = now()
  for (const u of utterances) {
    const { uri, bytes } = files.write(sessionId, u.id, u.audio.base64)
    uris.set(u.id, uri)
    texts.set(u.id, u.text)
    bytesWritten += bytes
    if (!textToId.has(u.text)) textToId.set(u.text, u.id)
  }
  recordAudio({
    kind: 'session-load',
    label: 'session-files',
    ms: now() - t0,
    detail: `${utterances.length} files ${bytesWritten} bytes`,
  })

  let unloaded = false

  function playUtteranceById(
    id: string,
    opts: LineCallbacks = {},
  ): Promise<void> {
    const uri = uris.get(id)
    const text = texts.get(id)
    if (unloaded || uri === undefined || text === undefined) {
      return Promise.reject(
        new Error(
          `[sessionAudio] no utterance "${id}" in session ${sessionId}`,
        ),
      )
    }
    return engine.speak(
      `${keyPrefix}${id}`,
      { uri },
      {
        text,
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
      const uri = id === undefined ? undefined : uris.get(id)
      if (!unloaded && id !== undefined && uri !== undefined) {
        engine.preload(`${keyPrefix}${id}`, { uri })
      }
    },
    textToId,
    utteranceCount: utterances.length,
    bytesWritten,
    unload() {
      if (unloaded) return
      unloaded = true
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
