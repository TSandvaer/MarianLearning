/**
 * The Math session start ("Path A"): App's half of the web's Math wiring
 * (`src/App.tsx` kick-effect + `src/lib/audio/mathPathA.ts`), on the 2b
 * engine's `startSession`.
 *
 * Contract, same as the web:
 * - **Kick once** (`kick()`, latched): App kicks on Greet so Greet's intro
 *   hides the request, or on Math for a returning child. The payload is the
 *   web's: `{ track: 'math', level: 1, childName: 'Marian', progress? }`
 *   with the focus node, recent success rate, Leitner and slow-fact hints
 *   and the lifetime first encounters from the persisted progress.
 * - **Visible-wait fallback** (`startWaitTimer()`, Emma's Path 1/10): once
 *   Math is on screen and still waiting, a hinted request (Leitner /
 *   slow facts: live planner, ~15 s) gets 5 s, then a hint-free canon
 *   request replaces it.
 * - **Settle**: resolve → the server plan (core's
 *   `mathSessionPlanFromServer`) and the session audio's text-keyed
 *   `playUtterance`; reject (network, server error, a plan core cannot
 *   read) → no plan and no player, so Math runs the static fallback plan
 *   with silent captions. Either way `audioReady` flips to `true`, which
 *   releases Math's first read-aloud.
 * - **Tear down** (`tearDown()`): abort a request in flight, unload the
 *   session audio (stops a session line, deletes its files) and reset the
 *   latch so the next session fetches fresh.
 *
 * The Claude key never reaches the app: `/api/claude` is the Vercel
 * function. App subscribes with `useSyncExternalStore`.
 */
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import type { MathSessionPlan } from '@marian/core/math/sessionPlans'
import {
  createSubitisingRng,
  easyBandLeitnerMeanBox,
  easyBandSubLeitnerMeanBox,
  readSubitisingScaffoldSessionsObserved,
  readSubitisingScaffoldSubSessionsObserved,
  shouldScaffoldThisSession,
} from '@marian/core/math/subitisingScaffold'
import {
  buildLeitnerSessionHint,
  buildSlowFactSessionHint,
  dueLeitnerItems,
  loadProgress,
  pickFocusNode,
  pickRecentSuccessRate,
  type FocusMode,
  type LeitnerSessionHintItem,
  type SkillNode,
  type SlowFactHint,
} from '@marian/core/progress'
import { nowMs as progressNowMs } from '@marian/core/progress/clock'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import {
  recordAudio,
  startSession,
  type LoadedSessionAudio,
  type SessionStartPayload,
} from '../audio'
import type { PlayMathUtteranceFn } from '../screens/math/mathTypes'
import {
  startSessionWithFallback,
  type SessionStartFallbackHandle,
} from './sessionStartFallback'

/** The progress hints the Math request carries (web `readProgressHintsForTrack('math')`). */
export interface MathProgressHints {
  focusNode: SkillNode | undefined
  focusMode: FocusMode | undefined
  recentSuccessRate: number | null | undefined
  leitner: LeitnerSessionHintItem[] | undefined
  slowFacts: SlowFactHint[] | undefined
  lifetimeFirstEncounters: readonly string[] | undefined
}

/** Read the hints from the persisted progress, exactly as the web does. */
export function readMathProgressHints(): MathProgressHints {
  const progress = loadProgress()
  if (progress === null) {
    return {
      focusNode: undefined,
      focusMode: undefined,
      recentSuccessRate: undefined,
      leitner: undefined,
      slowFacts: undefined,
      lifetimeFirstEncounters: undefined,
    }
  }
  const sessionCount = readSessionHistory().sessionCount
  const { node, mode } = pickFocusNode(progress, 'math', sessionCount)
  const leitner = buildLeitnerSessionHint(
    dueLeitnerItems(progress.mathFactsLeitner, progressNowMs()),
  )
  const slowFacts = buildSlowFactSessionHint(progress)
  return {
    focusNode: node,
    focusMode: mode,
    recentSuccessRate: pickRecentSuccessRate(progress, 'math'),
    leitner: leitner.length > 0 ? leitner : undefined,
    slowFacts: slowFacts.length > 0 ? slowFacts : undefined,
    lifetimeFirstEncounters: progress.lifetimeFirstEncounters ?? [],
  }
}

/** Leitner or slow-fact hints bypass canon (live planner, slow). */
export function hasCanonBypassingHints(hints: MathProgressHints): boolean {
  return (hints.leitner?.length ?? 0) > 0 || (hints.slowFacts?.length ?? 0) > 0
}

/**
 * The `session-start` payload (web `prepareMathPathA`). `withHints: false`
 * strips the canon-bypassing hints (the visible-wait fallback request).
 */
export function buildMathSessionPayload(
  hints: MathProgressHints,
  withHints: boolean,
): SessionStartPayload {
  const leitner = withHints ? hints.leitner : undefined
  const slowFacts = withHints ? hints.slowFacts : undefined
  const hasLeitner = leitner !== undefined && leitner.length > 0
  const hasSlowFacts = slowFacts !== undefined && slowFacts.length > 0
  const hasFirstEncounters = hints.lifetimeFirstEncounters !== undefined
  const progressBlock =
    hints.focusNode !== undefined ||
    hints.recentSuccessRate !== undefined ||
    hasLeitner ||
    hasSlowFacts ||
    hasFirstEncounters
      ? {
          progress: {
            ...(hints.focusNode !== undefined
              ? { focusNode: hints.focusNode }
              : {}),
            ...(hints.recentSuccessRate !== undefined
              ? { recentSuccessRate: hints.recentSuccessRate }
              : {}),
            ...(hasLeitner ? { leitner } : {}),
            ...(hasSlowFacts ? { slowFacts } : {}),
            ...(hasFirstEncounters
              ? { lifetimeFirstEncounters: [...hints.lifetimeFirstEncounters!] }
              : {}),
          },
        }
      : {}
  return { track: 'math', level: 1, childName: 'Marian', ...progressBlock }
}

/**
 * The math focus node for the static fallback plan and Math's scaffold
 * gates (web `mathFallbackFocusNode`: no session count, forward pick).
 */
export function mathFallbackFocusNode(): SkillNode | undefined {
  const progress = loadProgress()
  return progress === null ? undefined : pickFocusNode(progress, 'math').node
}

/**
 * The per-session subitising-scaffold decisions (web App.tsx: once per
 * App mount, seeded by the mount time and the focus node).
 */
export function mathScaffoldDecisions(sessionStartISO: string): {
  add: boolean
  sub: boolean
} {
  const progress = loadProgress()
  if (progress === null) return { add: false, sub: false }
  const focusNode = pickFocusNode(progress, 'math').node
  return {
    add: shouldScaffoldThisSession(
      easyBandLeitnerMeanBox(progress.mathFactsLeitner),
      readSubitisingScaffoldSessionsObserved(progress),
      createSubitisingRng(sessionStartISO, focusNode),
    ),
    sub: shouldScaffoldThisSession(
      easyBandSubLeitnerMeanBox(progress.mathFactsLeitner),
      readSubitisingScaffoldSubSessionsObserved(progress),
      createSubitisingRng(sessionStartISO, focusNode),
    ),
  }
}

export interface MathSessionSnapshot {
  /** The server plan; `null` until resolved, and on any failure. */
  plan: MathSessionPlan | null
  /** The session audio's player; `null` = Math's silent caption walk. */
  playUtterance: PlayMathUtteranceFn | null
  /** The start settled (either way): Math may read problem 1 aloud. */
  audioReady: boolean
}

export interface MathSessionFocus {
  node: SkillNode
  mode: FocusMode
}

export interface MathSessionController {
  /** Start the session start; a no-op while one is latched. */
  kick(): void
  /** Math is visible and waiting: start the hinted request's 5 s budget. */
  startWaitTimer(): void
  /** Abort, unload, reset the latch and the snapshot. Idempotent. */
  tearDown(): void
  /** Focus picked at kick time, frozen at settle (`null` without progress). */
  readonly sessionFocus: MathSessionFocus | null
  getSnapshot(): MathSessionSnapshot
  subscribe(listener: () => void): () => void
}

interface Loaded {
  plan: MathSessionPlan
  audio: LoadedSessionAudio
}

export interface MathSessionDeps {
  start?: typeof startSession
  readHints?: () => MathProgressHints
  /** Id of the static fallback plan (names the session, as on the web). */
  fallbackPlanId: () => string
  now?: () => number
  /** Test override for the visible-wait budget. */
  timeoutMs?: number
}

const IDLE: MathSessionSnapshot = {
  plan: null,
  playUtterance: null,
  audioReady: false,
}

export function createMathSessionController(
  deps: MathSessionDeps,
): MathSessionController {
  const start = deps.start ?? startSession
  const readHints = deps.readHints ?? readMathProgressHints
  const now = deps.now ?? Date.now
  const listeners = new Set<() => void>()
  let snapshot = IDLE
  let started = false
  let controller: AbortController | null = null
  let handle: SessionStartFallbackHandle<Loaded> | null = null
  let unload: (() => void) | null = null
  let sessionFocus: MathSessionFocus | null = null

  const publish = (next: MathSessionSnapshot) => {
    snapshot = next
    for (const l of Array.from(listeners)) l()
  }

  return {
    kick() {
      if (started) return
      started = true
      const abort = new AbortController()
      controller = abort
      const hints = readHints()
      const focus: MathSessionFocus | null =
        hints.focusNode !== undefined && hints.focusMode !== undefined
          ? { node: hints.focusNode, mode: hints.focusMode }
          : null
      const sessionId = `math-${deps.fallbackPlanId()}-${now()}`

      const run = async (
        withHints: boolean,
        signal: AbortSignal,
      ): Promise<Loaded> => {
        const prepared = await start({
          sessionId: withHints ? sessionId : `${sessionId}-fallback`,
          payload: buildMathSessionPayload(hints, withHints),
          signal,
        })
        try {
          return {
            plan: mathSessionPlanFromServer(prepared.plan),
            audio: prepared.audio,
          }
        } catch (err) {
          // A plan core cannot read: its audio must not stay on disk.
          prepared.audio.unload()
          throw err
        }
      }

      handle = startSessionWithFallback({
        hasHints: hasCanonBypassingHints(hints),
        signal: abort.signal,
        run,
        onFallback: () =>
          recordAudio({
            kind: 'note',
            label: 'math-session',
            detail: 'slow; re-requesting without planner hints',
          }),
      })
      handle.promise.then(
        ({ prepared, usedFallback }) => {
          if (abort.signal.aborted) {
            prepared.audio.unload()
            return
          }
          unload = () => prepared.audio.unload()
          sessionFocus = focus
          recordAudio({
            kind: 'note',
            label: 'math-session',
            detail: `ready (${prepared.plan.id}${usedFallback ? ', hint-free fallback' : ''})`,
          })
          publish({
            plan: prepared.plan,
            playUtterance: (text, opts) =>
              prepared.audio.playUtterance(text, opts),
            audioReady: true,
          })
        },
        (err: unknown) => {
          if (abort.signal.aborted) return
          sessionFocus = focus
          recordAudio({
            kind: 'note',
            label: 'math-session',
            detail: `unavailable, silent fallback: ${err instanceof Error ? err.message : String(err)}`,
          })
          publish({ plan: null, playUtterance: null, audioReady: true })
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
      if (snapshot !== IDLE) publish(IDLE)
    },
    get sessionFocus() {
      return sessionFocus
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
