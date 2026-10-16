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
 * - **Hub prefetch** (`prefetch()`, Emma's Path 2/10, hub-native § 5): on
 *   the Hub, while Number Garden glows, the same request starts through
 *   the app's `sessionPrefetcher`. The card tap kicks, and `kick()` adopts
 *   it (`take()`) when its key (focus node + mode) still matches the
 *   focus it would pick now, so the child never waits for a request that
 *   was already running; a stale one is discarded and a fresh request
 *   starts. The visible-wait timer still starts on Math, so Hub dwell
 *   never counts toward its 5 s budget.
 *
 * - **Review and warm-up** (native spec
 *   `design/native/review-mode-and-warmup-native.md` §§ 2, 7.4): the hints
 *   carry core's `sessionPlanKind`. A review asks for 8 canon blocks
 *   (`payload.review`; no hints, so no 5 s fallback) and is accepted only
 *   when the plan id starts `review-` and the plan reads; anything else is a
 *   failure (the static same-step plan, recorded as a forward session). A
 *   warm-up's refs ride on the forward request (both of its requests), its
 *   facts leave the Leitner hint (one shared cap of 3), and its blocks come
 *   back as `math.w<i>.*`, parsed into the round ahead of the 8 scored
 *   problems; a block that is missing or unreadable is dropped.
 *
 * The Claude key never reaches the app: `/api/claude` is the Vercel
 * function. App subscribes with `useSyncExternalStore`.
 */
import {
  mathSessionPlanFromServer,
  mathWarmupFromServer,
} from '@marian/core/math/planFromServer'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import {
  createSubitisingRng,
  easyBandLeitnerMeanBox,
  easyBandSubLeitnerMeanBox,
  readSubitisingScaffoldSessionsObserved,
  readSubitisingScaffoldSubSessionsObserved,
  shouldScaffoldThisSession,
} from '@marian/core/math/subitisingScaffold'
import {
  buildSlowFactSessionHint,
  loadProgress,
  pickFocusNode,
  pickRecentSuccessRate,
  type FocusMode,
  type LeitnerSessionHintItem,
  type SkillNode,
  type SlowFactHint,
} from '@marian/core/progress'
import { localDateKey, now as progressNow } from '@marian/core/progress/clock'
import {
  forwardLeitnerHint,
  sessionPlanKind,
  WARMUP_PROBLEMS,
  type SessionPlanKind,
} from '@marian/core/progress/reviewPlan'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import {
  recordAudio,
  startSession,
  type IntroGuideLineId,
  type LoadedSessionAudio,
  type PrefetchKey,
  type SessionPrefetcher,
  type SessionStartPayload,
} from '../audio'
import type { PlayMathUtteranceFn } from '../screens/math/mathTypes'
import {
  isReviewPlan,
  planKindFields,
  planModeOf,
  sessionIntroFor,
} from './reviewSession'
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
  /** Review, or forward with its warm-up refs (core `sessionPlanKind`). */
  planKind: SessionPlanKind
  /** The focus step's intro lead line (content wave 1 § 6.1), if it plays. */
  intro?: IntroGuideLineId | null
}

const FORWARD: SessionPlanKind = { kind: 'forward', warmup: [] }

/** The times-mix step (content wave 1 § 2). */
const MIX_STEP: SkillNode = 'mult-mix'

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
      planKind: FORWARD,
    }
  }
  const sessionCount = readSessionHistory().sessionCount
  const { node, mode } = pickFocusNode(progress, 'math', sessionCount)
  const now = progressNow()
  const planKind = sessionPlanKind(
    progress,
    'math',
    now.getTime(),
    localDateKey(now),
    sessionCount,
    node,
  )
  // A times mix (content wave 1 § 2.4) sends no Leitner or slow-fact hint:
  // its blocks already carry the due facts.
  const mix = planKind.kind === 'forward' && planKind.mix !== undefined
  // The due box without the warm-up's facts, then the multiplication rule
  // (core `leitnerBoxForFocus`: the planner's add-to-10 Leitner directive
  // would plan "Two times three" into an addition session), capped at 3
  // minus the warm-up's facts (core `forwardLeitnerHint`, § 7.4).
  const leitner = forwardLeitnerHint(
    progress.mathFactsLeitner,
    now.getTime(),
    node,
    planKind.kind === 'forward' ? planKind.warmup : [],
  )
  const slowFacts = mix ? [] : buildSlowFactSessionHint(progress)
  return {
    intro: sessionIntroFor(progress, node, planKind),
    focusNode: node,
    focusMode: mode,
    recentSuccessRate: pickRecentSuccessRate(progress, 'math'),
    leitner: !mix && leitner.length > 0 ? leitner : undefined,
    slowFacts: slowFacts.length > 0 ? slowFacts : undefined,
    lifetimeFirstEncounters: progress.lifetimeFirstEncounters ?? [],
    planKind,
  }
}

/**
 * Leitner or slow-fact hints bypass canon (live planner, slow). A review
 * sends neither, so it never takes the 5 s fallback.
 */
export function hasCanonBypassingHints(hints: MathProgressHints): boolean {
  if (hints.planKind.kind === 'review') return false
  if (hints.planKind.mix !== undefined) return false
  return (hints.leitner?.length ?? 0) > 0 || (hints.slowFacts?.length ?? 0) > 0
}

/**
 * The `session-start` payload (web `prepareMathPathA`). `withHints: false`
 * strips the canon-bypassing hints (the visible-wait fallback request); the
 * warm-up refs ride on both. A review sends its 8 blocks and the focus node
 * (the sweep reads it); the server ignores every other hint for it.
 */
export function buildMathSessionPayload(
  hints: MathProgressHints,
  withHints: boolean,
): SessionStartPayload {
  if (hints.planKind.kind === 'review') {
    return {
      track: 'math',
      level: 1,
      childName: 'Marian',
      ...(hints.focusNode !== undefined
        ? { progress: { focusNode: hints.focusNode } }
        : {}),
      ...planKindFields(hints.planKind),
    }
  }
  return {
    ...forwardPayload(hints, withHints),
    ...planKindFields(hints.planKind),
  }
}

function forwardPayload(
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
 * A Math session's prefetch identity: the focus node and the mode it asks
 * for (`review` for a review, `<mode>+warmup` with warm-up refs, § 7.4).
 */
export function mathPrefetchKey(hints: MathProgressHints): PrefetchKey {
  return { track: 'math', node: hints.focusNode, mode: planModeOf(hints) }
}

/** The round a settled response gives: what Math plays, in order. */
export interface MathRound {
  /** The warm-up problems first, then the 8 scored ones. */
  plan: ExtendedMathSessionPlan
  review: boolean
  /** The first `warmupCount` problems of `plan` are the warm-up (0–2). */
  warmupCount: number
  /** Each problem's source step; `null` = the session's focus step. */
  problemNodes: readonly (SkillNode | null)[]
  /** The step intro before the scored problem 1 (§ 6.1); `null` = none. */
  intro: IntroGuideLineId | null
  /** A times-mix session (content wave 1 § 2.4): every scored problem is
   *  the times-mix step's, whichever canon file its block came from. */
  mix: boolean
}

/**
 * Read a settled response for the session the hints asked for. A review
 * needs a `review-` plan id and 8 readable problems, else it throws (the
 * caller's failure path). A forward plan reads as before, and the warm-up
 * blocks that parse (`math.w<i>`, `i` = the ref's position) go in front.
 */
export function mathRoundFromServer(
  serverPlan: unknown,
  hints: Pick<MathProgressHints, 'planKind' | 'intro'>,
): MathRound {
  if (hints.planKind.kind === 'review') {
    if (!isReviewPlan(serverPlan)) {
      throw new Error('the review request was answered with a forward plan')
    }
    return {
      plan: mathSessionPlanFromServer(serverPlan, { extendedKinds: true }),
      review: true,
      warmupCount: 0,
      problemNodes: hints.planKind.blocks.map((b) => b.node),
      intro: null,
      mix: false,
    }
  }
  // A times mix accepts a `mix-` plan (the 8 blocks core picked) and any
  // other forward plan as-is: an older server serves mult-mix's own canon,
  // still times mix, the same 8 every day.
  const forward = mathSessionPlanFromServer(serverPlan, { extendedKinds: true })
  const mix = hints.planKind.mix !== undefined
  const refs = hints.planKind.warmup
  const warmup = mathWarmupFromServer(serverPlan)
    .filter((w) => w.block >= 1 && w.block <= refs.length)
    .slice(0, WARMUP_PROBLEMS)
  return {
    plan: {
      ...forward,
      problems: [...warmup.map((w) => w.problem), ...forward.problems],
    },
    review: false,
    warmupCount: warmup.length,
    problemNodes: [
      ...warmup.map((w) => refs[w.block - 1]!.node),
      ...forward.problems.map(() => (mix ? MIX_STEP : null)),
    ],
    intro: hints.intro ?? null,
    mix,
  }
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
  /** The server plan (warm-ups first); `null` until resolved, and on any
   *  failure. Read with core's extended kinds (number recognition, skip
   *  counting, multiplication), which only the native app opts in to. */
  plan: ExtendedMathSessionPlan | null
  /** The session audio's player; `null` = Math's silent caption walk. */
  playUtterance: PlayMathUtteranceFn | null
  /** The start settled (either way): Math may read problem 1 aloud. */
  audioReady: boolean
  /** A same-day review (only once its plan settled). */
  review: boolean
  /** How many of `plan`'s first problems are the warm-up (0–2). */
  warmupCount: number
  /** Each problem's source step (`null` = the session focus); `null`
   *  without a server plan. */
  problemNodes: readonly (SkillNode | null)[] | null
  /** The step intro before the scored problem 1 (content wave 1 § 6.1);
   *  `null` without one, and without a server plan. */
  intro: IntroGuideLineId | null
  /** A times-mix session (only once its plan settled). */
  mix: boolean
}

export interface MathSessionFocus {
  node: SkillNode
  mode: FocusMode
}

export interface MathSessionController {
  /** Start the session start; a no-op while one is latched. Adopts a
   *  matching Hub prefetch. */
  kick(): void
  /** The Hub's prefetch of the next session; a no-op while one is latched
   *  or without a prefetcher. */
  prefetch(): void
  /** Math is visible and waiting: start the hinted request's 5 s budget. */
  startWaitTimer(): void
  /** Abort, unload, reset the latch and the snapshot. Idempotent. */
  tearDown(): void
  /** Focus picked at kick time, frozen at settle (`null` without progress). */
  readonly sessionFocus: MathSessionFocus | null
  getSnapshot(): MathSessionSnapshot
  subscribe(listener: () => void): () => void
}

interface Loaded extends MathRound {
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
  /** The Hub prefetch (App: the app's `sessionPrefetcher`). */
  prefetcher?: SessionPrefetcher
}

const IDLE: MathSessionSnapshot = {
  plan: null,
  playUtterance: null,
  audioReady: false,
  review: false,
  warmupCount: 0,
  problemNodes: null,
  intro: null,
  mix: false,
}

/** Settled without a server plan: the static plan, silent captions. */
const FAILED: MathSessionSnapshot = { ...IDLE, audioReady: true }

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

  const sessionIdNow = () => `math-${deps.fallbackPlanId()}-${now()}`

  return {
    prefetch() {
      if (started || !deps.prefetcher) return
      const hints = readHints()
      deps.prefetcher.prefetch(mathPrefetchKey(hints), {
        sessionId: sessionIdNow(),
        payload: buildMathSessionPayload(hints, true),
      })
    },
    kick() {
      if (started) return
      started = true
      const abort = new AbortController()
      controller = abort
      const hints = readHints()
      // A Hub prefetch with the same focus is this session's first request.
      const prefetchKey = mathPrefetchKey(hints)
      let firstRun = true
      const focus: MathSessionFocus | null =
        hints.focusNode !== undefined && hints.focusMode !== undefined
          ? { node: hints.focusNode, mode: hints.focusMode }
          : null
      const sessionId = sessionIdNow()

      const run = async (
        withHints: boolean,
        signal: AbortSignal,
      ): Promise<Loaded> => {
        // The prefetch stands in for the first request only (its payload is
        // this one's); the hint-free fallback is always a new request. The
        // run's signal is linked to it, so the 5 s fallback and a tear-down
        // abort it as they abort a request of their own. Taken here, inside
        // the card tap's kick (`startSessionWithFallback` runs it at once).
        const adopted = firstRun
          ? (deps.prefetcher?.take(prefetchKey, signal) ?? null)
          : null
        firstRun = false
        if (adopted !== null) {
          recordAudio({
            kind: 'note',
            label: 'math-session',
            detail: 'adopting the Hub prefetch',
          })
        }
        const prepared = await (adopted ??
          start({
            sessionId: withHints ? sessionId : `${sessionId}-fallback`,
            payload: buildMathSessionPayload(hints, withHints),
            signal,
          }))
        try {
          return {
            ...mathRoundFromServer(prepared.plan, hints),
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
        timeoutMs: deps.timeoutMs,
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
            detail: `ready (${prepared.plan.id}${usedFallback ? ', hint-free fallback' : ''}${prepared.warmupCount > 0 ? `, ${prepared.warmupCount} warm-up` : ''})`,
          })
          publish({
            plan: prepared.plan,
            playUtterance: (text, opts) =>
              prepared.audio.playUtterance(text, opts),
            audioReady: true,
            review: prepared.review,
            warmupCount: prepared.warmupCount,
            problemNodes: prepared.problemNodes,
            intro: prepared.intro,
            mix: prepared.mix,
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
          publish(FAILED)
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
