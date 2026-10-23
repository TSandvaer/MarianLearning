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
 *   (the vowel map: live planner) gets 5 s once Word Song is on screen and
 *   waiting, then a hint-free canon request replaces it.
 * - **Graduation check** (Thomas 2026-10-23): when one is due, the canon
 *   plan's problems 2, 5 and 7 become probe words (core
 *   `withGraduationProbes`), their lines played from the bundled probe
 *   audio (`./graduationCheck.ts`). No planner, no wait.
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
 * - **Review and warm-up** (native spec
 *   `design/native/review-mode-and-warmup-native.md` § 7.4), as Math's: a
 *   review is accepted only with a `review-` plan id and 8 readable
 *   problems; the warm-up's `word.w<i>` blocks that parse go in front of
 *   the 8 scored problems.
 *
 * The Claude key never reaches the app: `/api/claude` is the Vercel function.
 */
import { WARMUP_PROBLEMS } from '@marian/core/progress/reviewPlan'
import { withGraduationProbes } from '@marian/core/wordSong/graduationCheck'
import {
  wordSongSessionPlanFromServer,
  wordSongWarmupFromServer,
} from '@marian/core/wordSong/planFromServer'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import type { FocusMode, SkillNode } from '@marian/core/progress'
import {
  recordAudio,
  startSession,
  type IntroGuideLineId,
  type LoadedSessionAudio,
  type SessionPrefetcher,
} from '../audio'
import type {
  ClipFileFn,
  PlayWordSongUtteranceFn,
} from '../screens/wordSong/wordSongTypes'
import {
  GRADUATION_PROBE_PLAN,
  loadGraduationProbeAudio,
  withProbeAudio,
  type RoundAudio,
} from './graduationCheck'
import { isReviewPlan } from './reviewSession'
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

/**
 * The native app plays content wave 3's little stories (content-wave-3.md
 * § 4.6) and real blending's two reads, "Listen." and "What is it?"
 * (real-blending.md § 8); the frozen web parses without these, so a story
 * or a real-blending problem throws there.
 */
const NATIVE_PARSE = { littleStories: true, blendReads: true } as const

export interface WordSongSessionSnapshot extends WordSongSessionExtras {
  /** The server plan (warm-ups first); `null` until resolved, and on any
   *  failure. */
  plan: WordSongSessionPlan | null
  /** A same-day review (only once its plan settled). */
  review: boolean
  /** How many of `plan`'s first problems are the warm-up (0–2). */
  warmupCount: number
  /** The step intro before the scored problem 1 (content wave 1 § 6.1);
   *  `null` without one, and without a server plan. */
  intro: IntroGuideLineId | null
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
  /** A graduation check's probe plan and audio (default: the bundled ones). */
  probePlan?: unknown
  loadProbeAudio?: (sessionId: string) => LoadedSessionAudio
}

/** The round a settled response gives: what Word Song plays, in order. */
export interface WordSongRound {
  /** The warm-up problems first, then the 8 scored ones. */
  plan: WordSongSessionPlan
  review: boolean
  warmupCount: number
  /** The step intro before the scored problem 1 (§ 6.1); `null` = none. */
  intro: IntroGuideLineId | null
}

/**
 * Read a settled response for the session the hints asked for: a review
 * needs a `review-` plan id and 8 readable problems, else it throws (the
 * failure path); a forward plan reads as before, with the warm-up blocks
 * that parse (`word.w<i>`, `i` = the ref's position) in front.
 *
 * Each problem learns its step (content wave 4 § 5): a review's from its
 * block ref, a warm-up's from its ref, the forward plan's from the focus.
 * A bee-words or car-words problem then carries its own step's chip row.
 */
export function wordSongRoundFromServer(
  serverPlan: unknown,
  hints: Pick<WordSongProgressHints, 'planKind' | 'intro'> &
    Partial<Pick<WordSongProgressHints, 'focusNode'>>,
): WordSongRound {
  if (hints.planKind.kind === 'review') {
    if (!isReviewPlan(serverPlan)) {
      throw new Error('the review request was answered with a forward plan')
    }
    return {
      plan: wordSongSessionPlanFromServer(serverPlan, {
        ...NATIVE_PARSE,
        step: hints.planKind.blocks.map((b) => b.node),
      }),
      review: true,
      warmupCount: 0,
      intro: null,
    }
  }
  const forward = wordSongSessionPlanFromServer(serverPlan, {
    ...NATIVE_PARSE,
    step: hints.focusNode,
  })
  const refs = hints.planKind.warmup
  const warmup = wordSongWarmupFromServer(serverPlan, {
    ...NATIVE_PARSE,
    step: refs.map((r) => r.node),
  })
    .filter((w) => w.block >= 1 && w.block <= refs.length)
    .slice(0, WARMUP_PROBLEMS)
  return {
    plan: {
      ...forward,
      problems: [...warmup.map((w) => w.problem), ...forward.problems],
    },
    review: false,
    warmupCount: warmup.length,
    intro: hints.intro ?? null,
  }
}

interface Loaded extends WordSongRound {
  audio: RoundAudio
  vowel: TargetVowel | undefined
  /** The round is a graduation check (probe words swapped in). */
  check: boolean
}

const IDLE: WordSongSessionSnapshot = {
  plan: null,
  playUtterance: null,
  clipFor: null,
  audioReady: false,
  review: false,
  warmupCount: 0,
  intro: null,
  ...NO_EXTRAS,
}

export function createWordSongSessionController(
  deps: WordSongSessionDeps,
): WordSongSessionController {
  const start = deps.start ?? startSession
  const readHints = deps.readHints ?? readWordSongProgressHints
  const readExtras = deps.readExtras ?? readWordSongSessionExtras
  const probePlan = deps.probePlan ?? GRADUATION_PROBE_PLAN
  const loadProbeAudio = deps.loadProbeAudio ?? loadGraduationProbeAudio
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
        // A due check on a forward session: the canon plan with probe
        // words swapped in (`null`: the plan is played as it is).
        const check =
          hints.planKind.kind === 'forward' && hints.probeWords !== undefined
            ? withGraduationProbes(prepared.plan, probePlan, hints.probeWords)
            : null
        try {
          return {
            ...wordSongRoundFromServer(check ?? prepared.plan, hints),
            audio:
              check === null
                ? prepared.audio
                : withProbeAudio(
                    prepared.audio,
                    loadProbeAudio(prepared.sessionId),
                  ),
            vowel: narrowTargetVowel(prepared.currentTargetVowel),
            check: check !== null,
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
            `ready (${prepared.plan.id}${usedFallback ? ', hint-free fallback' : ''}${prepared.warmupCount > 0 ? `, ${prepared.warmupCount} warm-up` : ''}${prepared.check ? ', graduation check' : ''})`,
          )
          publish({
            ...extras,
            plan: prepared.plan,
            review: prepared.review,
            warmupCount: prepared.warmupCount,
            intro: prepared.intro,
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
