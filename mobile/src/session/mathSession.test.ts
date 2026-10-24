/**
 * The Math session start: payload, kick latch, settle (resolve, network
 * failure, unreadable plan), the visible-wait fallback and tear-down.
 * `startSession` is faked: no network, no audio.
 */
import {
  mathSessionPlanToUtteranceSources,
  STATIC_SESSION_PLANS,
} from '@marian/core/math/sessionPlans'
import type { LoadedSessionAudio, PreparedSession } from '../audio'
import { SessionStartError, type SessionStartArgs } from '../audio'
import {
  buildMathSessionPayload,
  createMathSessionController,
  type MathProgressHints,
} from './mathSession'
import { SESSION_START_WAIT_TIMEOUT_MS } from './sessionStartFallback'

const PLAN = STATIC_SESSION_PLANS[1]
const SERVER_PLAN = {
  id: 'canon-add-to-10-a',
  label: 'Canon',
  utterances: mathSessionPlanToUtteranceSources(PLAN),
}

const NO_HINTS: MathProgressHints = {
  focusNode: undefined,
  focusMode: undefined,
  recentSuccessRate: undefined,
  lifetimeFirstEncounters: undefined,
  planKind: { kind: 'forward', warmup: [] },
}

const HINTS: MathProgressHints = {
  focusNode: 'add-to-10',
  focusMode: 'forward',
  recentSuccessRate: 0.75,
  lifetimeFirstEncounters: ['add-to-10'],
  planKind: { kind: 'forward', warmup: [] },
  // No-Claude phase 3: the device picks it (core `mathPickRequestFor`).
  mathPick: {
    step: 'add-to-10',
    leitner: {
      items: [{ item: { a: 3, b: 4, op: '+' }, box: 1, lastSeen: 0 }],
    },
    seen: {},
    previous: null,
    slow: [],
    warmup: [],
    nowMs: 0,
    today: '2026-10-24',
    seed: 0,
  },
}

function fakeAudio(): LoadedSessionAudio & {
  playUtterance: jest.Mock
  unload: jest.Mock
} {
  return {
    sessionId: 's',
    playUtterance: jest.fn(() => Promise.resolve()),
    playUtteranceById: jest.fn(() => Promise.resolve()),
    prewarm: jest.fn(),
    fileFor: jest.fn(() => undefined),
    textToId: new Map(),
    utteranceCount: 0,
    fileCount: 0,
    bundledCount: 0,
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
  }
}

interface Call {
  args: SessionStartArgs
  resolve: (p: PreparedSession) => void
  reject: (e: Error) => void
}

function harness(hints: MathProgressHints = NO_HINTS, timeoutMs?: number) {
  const calls: Call[] = []
  const start = jest.fn(
    (args: SessionStartArgs) =>
      new Promise<PreparedSession>((resolve, reject) => {
        calls.push({ args, resolve, reject })
        args.signal?.addEventListener('abort', () =>
          reject(new SessionStartError('aborted', 'aborted')),
        )
      }),
  )
  const session = createMathSessionController({
    start,
    readHints: () => hints,
    fallbackPlanId: () => 'sums-to-10-B',
    timeoutMs,
    now: () => 1000,
  })
  const prepared = (plan: unknown = SERVER_PLAN) => {
    const audio = fakeAudio()
    return {
      audio,
      value: {
        sessionId: 'x',
        track: 'math' as const,
        plan,
        audio,
        fetchMs: 5,
      },
    }
  }
  return { calls, start, session, prepared }
}

const settle = () => new Promise((r) => setImmediate(r))

describe('payload (web prepareMathPathA)', () => {
  it('no progress: track, level 1 and the name only', () => {
    expect(buildMathSessionPayload(NO_HINTS)).toEqual({
      track: 'math',
      level: 1,
      childName: 'friend',
    })
  })

  it('with progress: the progress block, never a Leitner or slow-fact hint (phase 3)', () => {
    expect(buildMathSessionPayload(HINTS)).toEqual({
      track: 'math',
      level: 1,
      childName: 'friend',
      progress: {
        focusNode: 'add-to-10',
        recentSuccessRate: 0.75,
        lifetimeFirstEncounters: ['add-to-10'],
      },
    })
  })
})

describe('the session start', () => {
  it('kick is latched; resolve publishes the server plan and its player', async () => {
    const { calls, start, session, prepared } = harness()
    const listener = jest.fn()
    session.subscribe(listener)
    session.kick()
    session.kick()
    expect(start).toHaveBeenCalledTimes(1)
    // Web parity: a request without hints is named like the fallback one.
    expect(calls[0].args.sessionId).toBe('math-sums-to-10-B-1000-fallback')
    expect(session.getSnapshot().audioReady).toBe(false)

    const p = prepared()
    calls[0].resolve(p.value)
    await settle()
    const snap = session.getSnapshot()
    expect(snap.audioReady).toBe(true)
    expect(snap.plan?.id).toBe('canon-add-to-10-a')
    expect(snap.plan?.problems.map((x) => x.correct)).toEqual(
      PLAN.problems.map((x) => x.correct),
    )
    expect(listener).toHaveBeenCalledTimes(1)
    const onPlay = jest.fn()
    await snap.playUtterance?.('Two plus three. How many?', { onPlay })
    expect(p.audio.playUtterance).toHaveBeenCalledWith(
      'Two plus three. How many?',
      { onPlay },
    )
  })

  it('a network failure falls back: ready, no plan, no player', async () => {
    const { calls, session } = harness(HINTS)
    session.kick()
    calls[0].reject(new SessionStartError('network-error', 'offline'))
    await settle()
    expect(session.getSnapshot()).toEqual({
      plan: null,
      playUtterance: null,
      audioReady: true,
      review: false,
      warmupCount: 0,
      problemNodes: null,
      intro: null,
      mix: false,
    })
    expect(session.sessionFocus).toEqual({ node: 'add-to-10', mode: 'forward' })
  })

  it('a plan core cannot read falls back and deletes that session audio', async () => {
    const { calls, session, prepared } = harness()
    session.kick()
    const p = prepared({ id: 'bad', label: 'bad', utterances: [] })
    calls[0].resolve(p.value)
    await settle()
    expect(p.audio.unload).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toEqual({
      plan: null,
      playUtterance: null,
      audioReady: true,
      review: false,
      warmupCount: 0,
      problemNodes: null,
      intro: null,
      mix: false,
    })
  })

  it('tear-down mid-flight aborts; nothing is published; the next kick fetches again', async () => {
    const { calls, start, session } = harness()
    session.kick()
    session.tearDown()
    expect(calls[0].args.signal?.aborted).toBe(true)
    await settle()
    expect(session.getSnapshot().audioReady).toBe(false)
    session.kick()
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('tear-down after resolve unloads the session audio and resets the snapshot', async () => {
    const { calls, session, prepared } = harness()
    session.kick()
    const p = prepared()
    calls[0].resolve(p.value)
    await settle()
    session.tearDown()
    expect(p.audio.unload).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toEqual({
      plan: null,
      playUtterance: null,
      audioReady: false,
      review: false,
      warmupCount: 0,
      problemNodes: null,
      intro: null,
      mix: false,
    })
  })

  it('a picked session asks once, with its pick, and never races the 5 s budget', async () => {
    jest.useFakeTimers()
    try {
      const { calls, session, prepared } = harness(HINTS, 100)
      session.kick()
      session.startWaitTimer()
      jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS)
      expect(calls).toHaveLength(1)
      // The hint-free request's id, as for every hint-free session.
      expect(calls[0].args.sessionId).toBe('math-sums-to-10-B-1000-fallback')
      expect(calls[0].args.mathPick).toEqual(HINTS.mathPick)
      expect(calls[0].args.payload).not.toHaveProperty('progress.leitner')
      calls[0].resolve(prepared().value)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(session.getSnapshot().audioReady).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
})
