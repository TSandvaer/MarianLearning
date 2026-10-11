/**
 * The Word Song session start ("Path A"): App's half of the web's Word
 * Song wiring (`src/App.tsx` kick-effect + `src/lib/audio/wordSongPathA.ts`),
 * on the native engine's `startSession`. Same contract as Math's
 * (`./mathSession.ts`), with Word Song's hints (`./wordSongHints.ts`):
 *
 * - **Kick once** (`kick()`, latched): the Hub's card tap, or the route
 *   effect (QA route, Session End's "Again"). Reads the hints, freezes the
 *   session-start extras (cross-vowel, the th cue) and publishes them at
 *   once, then starts the request.
 * - **Visible-wait fallback** (`startWaitTimer()`): a hinted request
 *   (graduation probe, vowel map: live planner) gets 5 s once Word Song
 *   is on screen and waiting, then a hint-free canon request replaces it.
 * - **Settle**: resolve → core's `wordSongSessionPlanFromServer` plan, the
 *   session audio's text-keyed player and the server's letter-sounds
 *   target vowel; reject → no plan, no player (static plan, silent
 *   captions). Either way `audioReady` flips, releasing problem 1.
 * - **Tear down** (`tearDown()`): abort a request in flight (it must not
 *   outlive the screen), unload the session audio, reset the latch.
 * - **Hub prefetch** (`prefetch()`): while Word Song glows, the same
 *   request starts through the app's `sessionPrefetcher`; `kick()` adopts
 *   it when its focus still matches, else a fresh request starts.
 *
 * The Claude key never reaches the app: `/api/claude` is the Vercel function.
 */
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import type { FocusMode, SkillNode } from '@marian/core/progress'
import {
  recordAudio,
  startSession,
  type LoadedSessionAudio,
  type SessionPrefetcher,
} from '../audio'
import type {
  ClipFileFn,
  PlayWordSongUtteranceFn,
} from '../screens/wordSong/wordSongTypes'
import {
  startSessionWithFallback,
  type SessionStartFallbackHandle,
} from './sessionStartFallback'
import {
  buildWordSongSessionPayload,
  hasCanonBypassingHints,
  narrowTargetVowel,
  NO_EXTRAS,
  readWordSongProgressHints,
  readWordSongSessionExtras,
  wordSongPrefetchKey,
  type TargetVowel,
  type WordSongProgressHints,
  type WordSongSessionExtras,
} from './wordSongHints'

export interface WordSongSessionSnapshot extends WordSongSessionExtras {
  /** The server plan; `null` until resolved, and on any failure. */
  plan: WordSongSessionPlan | null
  /** The session audio's player; `null` = the silent caption walk. */
  playUtterance: PlayWordSongUtteranceFn | null
  /** A line's file on disk (tap sounds, blend marks); `null` = none. */
  clipFor: ClipFileFn | null
  /** The start settled (either way): problem 1 may be read aloud. */
  audioReady: boolean
}

export interface WordSongSessionFocus {
  node: SkillNode
  mode: FocusMode
}

export interface WordSongSessionController {
  kick(): void
  prefetch(): void
  startWaitTimer(): void
  /** Abort, unload, reset the latch and the snapshot. Idempotent. */
  tearDown(): void
  /** Focus picked at kick time, frozen at settle (`null` without progress). */
  readonly sessionFocus: WordSongSessionFocus | null
  /** The server's letter-sounds target vowel, frozen at settle. */
  readonly currentTargetVowel: TargetVowel | null
  getSnapshot(): WordSongSessionSnapshot
  subscribe(listener: () => void): () => void
}

export interface WordSongSessionDeps {
  start?: typeof startSession
  readHints?: () => WordSongProgressHints
  readExtras?: (hints: WordSongProgressHints) => WordSongSessionExtras
  /** Id of the static fallback plan (names the session, as on the web). */
  fallbackPlanId: () => string
  now?: () => number
  timeoutMs?: number
  prefetcher?: SessionPrefetcher
}

interface Loaded {
  plan: WordSongSessionPlan
  audio: LoadedSessionAudio
  vowel: TargetVowel | undefined
}

const IDLE: WordSongSessionSnapshot = {
  plan: null,
  playUtterance: null,
  clipFor: null,
  audioReady: false,
  ...NO_EXTRAS,
}

export function createWordSongSessionController(
  deps: WordSongSessionDeps,
): WordSongSessionController {
  const start = deps.start ?? startSession
  const readHints = deps.readHints ?? readWordSongProgressHints
  const readExtras = deps.readExtras ?? readWordSongSessionExtras
  const now = deps.now ?? Date.now
  const listeners = new Set<() => void>()
  let snapshot = IDLE
  let started = false
  let controller: AbortController | null = null
  let unload: (() => void) | null = null
  let handle: SessionStartFallbackHandle<Loaded> | null = null
  let sessionFocus: WordSongSessionFocus | null = null
  let vowel: TargetVowel | null = null

  const publish = (next: WordSongSessionSnapshot) => {
    snapshot = next
    for (const l of Array.from(listeners)) l()
  }
  const sessionIdNow = () => `word-song-${deps.fallbackPlanId()}-${now()}`
  const note = (detail: string) =>
    recordAudio({ kind: 'note', label: 'word-song-session', detail })

  return {
    prefetch() {
      if (started || !deps.prefetcher) return
      const hints = readHints()
      deps.prefetcher.prefetch(wordSongPrefetchKey(hints), {
        sessionId: sessionIdNow(),
        payload: buildWordSongSessionPayload(hints, true),
      })
    },
    kick() {
      if (started) return
      started = true
      const abort = new AbortController()
      controller = abort
      const hints = readHints()
      const extras = readExtras(hints)
      publish({ ...IDLE, ...extras })
      const prefetchKey = wordSongPrefetchKey(hints)
      const focus: WordSongSessionFocus | null =
        hints.focusNode !== undefined && hints.focusMode !== undefined
          ? { node: hints.focusNode, mode: hints.focusMode }
          : null
      const sessionId = sessionIdNow()
      let firstRun = true

      const run = async (
        withHints: boolean,
        signal: AbortSignal,
      ): Promise<Loaded> => {
        // The prefetch stands in for the first request only; its signal is
        // linked, so the fallback and a tear-down abort it too.
        const adopted = firstRun
          ? (deps.prefetcher?.take(prefetchKey, signal) ?? null)
          : null
        firstRun = false
        if (adopted !== null) note('adopting the Hub prefetch')
        const prepared = await (adopted ??
          start({
            sessionId: withHints ? sessionId : `${sessionId}-fallback`,
            payload: buildWordSongSessionPayload(hints, withHints),
            signal,
          }))
        try {
          return {
            plan: wordSongSessionPlanFromServer(prepared.plan),
            audio: prepared.audio,
            vowel: narrowTargetVowel(prepared.currentTargetVowel),
          }
        } catch (err) {
          // A plan core cannot read: its audio must not stay on disk.
          prepared.audio.unload()
          throw err
        }
      }

      handle = startSessionWithFallback({
        hasHints: hasCanonBypassingHints(hints),
        timeoutMs: deps.timeoutMs,
        signal: abort.signal,
        run,
        onFallback: () => note('slow; re-requesting without planner hints'),
      })
      handle.promise.then(
        ({ prepared, usedFallback }) => {
          if (abort.signal.aborted) {
            prepared.audio.unload()
            return
          }
          unload = () => prepared.audio.unload()
          sessionFocus = focus
          vowel = prepared.vowel ?? null
          note(
            `ready (${prepared.plan.id}${usedFallback ? ', hint-free fallback' : ''})`,
          )
          publish({
            ...extras,
            plan: prepared.plan,
            playUtterance: (text, opts) =>
              prepared.audio.playUtterance(text, opts),
            clipFor: (text) => prepared.audio.fileFor(text),
            audioReady: true,
          })
        },
        (err: unknown) => {
          if (abort.signal.aborted) return
          sessionFocus = focus
          note(
            `unavailable, silent fallback: ${err instanceof Error ? err.message : String(err)}`,
          )
          publish({ ...IDLE, ...extras, audioReady: true })
        },
      )
    },
    startWaitTimer() {
      handle?.startWaitTimer()
    },
    tearDown() {
      controller?.abort()
      controller = null
      handle = null
      unload?.()
      unload = null
      started = false
      sessionFocus = null
      vowel = null
      if (snapshot !== IDLE) publish(IDLE)
    },
    get sessionFocus() {
      return sessionFocus
    },
    get currentTargetVowel() {
      return vowel
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
