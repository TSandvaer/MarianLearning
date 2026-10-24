/**
 * The Hub prefetch of the Math session (Emma's Path 2/10, hub-native § 5):
 * `prefetch()` starts the request through the prefetcher; the card tap's
 * `kick()` adopts it when its focus still matches, else discards it and
 * starts fresh. `startSession` is faked: no network, no audio.
 */
import {
  mathSessionPlanToUtteranceSources,
  STATIC_SESSION_PLANS,
} from '@marian/core/math/sessionPlans'
import {
  createSessionPrefetcher,
  SessionStartError,
  type LoadedSessionAudio,
  type PreparedSession,
  type SessionStartArgs,
} from '../audio'
import {
  createMathSessionController,
  type MathProgressHints,
} from './mathSession'

const SERVER_PLAN = {
  id: 'canon-add-to-10-a',
  label: 'Canon',
  utterances: mathSessionPlanToUtteranceSources(STATIC_SESSION_PLANS[1]),
}

const ADD_10: MathProgressHints = {
  focusNode: 'add-to-10',
  focusMode: 'forward',
  recentSuccessRate: 0.75,
  lifetimeFirstEncounters: ['add-to-10'],
  planKind: { kind: 'forward', warmup: [] },
}

function fakeAudio(): LoadedSessionAudio & { unload: jest.Mock } {
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
  aborted: boolean
  resolve: (p: PreparedSession) => void
}

function harness(timeoutMs?: number) {
  let hints = ADD_10
  const calls: Call[] = []
  const start = jest.fn(
    (args: SessionStartArgs) =>
      new Promise<PreparedSession>((resolve, reject) => {
        const call: Call = { args, aborted: false, resolve }
        calls.push(call)
        args.signal?.addEventListener('abort', () => {
          call.aborted = true
          reject(new SessionStartError('aborted', 'aborted'))
        })
      }),
  )
  const prefetcher = createSessionPrefetcher({ start })
  const session = createMathSessionController({
    start,
    prefetcher,
    readHints: () => hints,
    fallbackPlanId: () => 'sums-to-10-B',
    timeoutMs,
    now: () => 1000,
  })
  const prepared = () => {
    const audio = fakeAudio()
    const value: PreparedSession = {
      sessionId: 'x',
      track: 'math',
      plan: SERVER_PLAN,
      audio,
      fetchMs: 5,
    }
    return { audio, value }
  }
  return {
    calls,
    start,
    prefetcher,
    session,
    prepared,
    setHints: (h: MathProgressHints) => {
      hints = h
    },
  }
}

const settle = () => new Promise((r) => setImmediate(r))

it('the tap adopts a prefetch in flight: one request, and Math gets its plan', async () => {
  const h = harness()
  h.session.prefetch()
  expect(h.calls).toHaveLength(1)
  expect(h.calls[0]!.args.payload).toMatchObject({
    track: 'math',
    progress: { focusNode: 'add-to-10' },
  })
  h.session.kick()
  expect(h.calls).toHaveLength(1)
  expect(h.prefetcher.pendingKey).toBeNull()
  h.calls[0]!.resolve(h.prepared().value)
  await settle()
  expect(h.session.getSnapshot()).toMatchObject({ audioReady: true })
  expect(h.session.getSnapshot().plan?.id).toBe(SERVER_PLAN.id)
})

it('a settled prefetch is ready right after the tap (no visible wait)', async () => {
  const h = harness()
  h.session.prefetch()
  h.calls[0]!.resolve(h.prepared().value)
  await settle()
  h.session.kick()
  await settle()
  expect(h.calls).toHaveLength(1)
  expect(h.session.getSnapshot().audioReady).toBe(true)
})

it('a stale prefetch (the focus moved) is discarded and a fresh request starts', async () => {
  const h = harness()
  h.session.prefetch()
  h.setHints({ ...ADD_10, focusNode: 'add-to-20' })
  h.session.kick()
  expect(h.calls).toHaveLength(2)
  expect(h.calls[0]!.aborted).toBe(true)
  expect(h.calls[1]!.args.payload).toMatchObject({
    progress: { focusNode: 'add-to-20' },
  })
})

it('no prefetch while a session is latched', () => {
  const h = harness()
  h.session.kick()
  h.session.prefetch()
  expect(h.calls).toHaveLength(1)
  expect(h.prefetcher.pendingKey).toBeNull()
})

it('a picked session (phase 3) rides the prefetch with its pick and never races a 5 s fallback', async () => {
  jest.useFakeTimers()
  try {
    const h = harness(5000)
    const mathPick = {
      step: 'add-to-10' as const,
      leitner: { items: [] },
      seen: {},
      previous: null,
      slow: [],
      warmup: [],
      nowMs: 0,
      today: '2026-10-24',
      seed: 0,
    }
    h.setHints({ ...ADD_10, mathPick })
    h.session.prefetch()
    h.session.kick()
    h.session.startWaitTimer()
    jest.advanceTimersByTime(5000)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.aborted).toBe(false)
    expect(h.calls[0]!.args.mathPick).toEqual(mathPick)
    expect(h.calls[0]!.args.payload).not.toHaveProperty('progress.leitner')
    expect(h.calls[0]!.args.payload).not.toHaveProperty('mathPick')
  } finally {
    jest.useRealTimers()
  }
})

it('a tear-down aborts the adopted request in flight', async () => {
  const h = harness()
  h.session.prefetch()
  h.session.kick()
  expect(h.calls[0]!.aborted).toBe(false)
  h.session.tearDown()
  expect(h.calls[0]!.aborted).toBe(true)
  await settle()
  expect(h.session.getSnapshot().audioReady).toBe(false)
})

it('a tear-down after the adopted request settled unloads its audio', async () => {
  const h = harness()
  h.session.prefetch()
  const { audio, value } = h.prepared()
  h.calls[0]!.resolve(value)
  await settle()
  h.session.kick()
  await settle()
  expect(h.session.getSnapshot().audioReady).toBe(true)
  h.session.tearDown()
  expect(audio.unload).toHaveBeenCalledTimes(1)
})
