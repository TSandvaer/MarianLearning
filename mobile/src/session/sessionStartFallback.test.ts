import { resolve } from 'node:path'
import { functionSource, REPO_ROOT } from '../../test/webSource'
import {
  SESSION_START_WAIT_TIMEOUT_MS,
  startSessionWithFallback,
} from './sessionStartFallback'

const WEB = resolve(REPO_ROOT, 'src', 'lib', 'audio', 'sessionStartFallback.ts')

describe('the web copy', () => {
  it.each(['startSessionWithFallback', 'linkedController'])(
    '%s matches src/lib/audio/sessionStartFallback.ts',
    (name) => {
      expect(
        functionSource(resolve(__dirname, 'sessionStartFallback.ts'), name),
      ).toBe(functionSource(WEB, name))
    },
  )
})

interface Deferred {
  withHints: boolean
  signal: AbortSignal
  resolve: (v: string) => void
  reject: (e: Error) => void
}

function harness(hasHints: boolean) {
  const runs: Deferred[] = []
  const parent = new AbortController()
  const onFallback = jest.fn()
  const handle = startSessionWithFallback<string>({
    hasHints,
    signal: parent.signal,
    onFallback,
    run: (withHints, signal) =>
      new Promise<string>((resolve, reject) => {
        runs.push({ withHints, signal, resolve, reject })
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      }),
  })
  return { runs, parent, onFallback, handle }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('a hinted request that settles in time is used as is', async () => {
  const { runs, handle } = harness(true)
  handle.startWaitTimer()
  runs[0].resolve('hinted')
  await expect(handle.promise).resolves.toEqual({
    prepared: 'hinted',
    usedFallback: false,
  })
  jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS)
  expect(runs).toHaveLength(1)
})

it('5 s of visible wait aborts the hinted request and re-requests without hints', async () => {
  const { runs, handle, onFallback } = harness(true)
  expect(runs[0].withHints).toBe(true)
  handle.startWaitTimer()
  jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS - 1)
  expect(runs).toHaveLength(1)
  jest.advanceTimersByTime(1)
  expect(runs[0].signal.aborted).toBe(true)
  expect(onFallback).toHaveBeenCalledTimes(1)
  expect(runs).toHaveLength(2)
  expect(runs[1].withHints).toBe(false)
  runs[1].resolve('canon')
  await expect(handle.promise).resolves.toEqual({
    prepared: 'canon',
    usedFallback: true,
  })
})

it('no hints: no timer, the one request is the answer', () => {
  const { runs, handle } = harness(false)
  handle.startWaitTimer()
  jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS * 3)
  expect(runs).toHaveLength(1)
  expect(runs[0].withHints).toBe(false)
})

it('the parent abort reaches the request in flight', async () => {
  const { runs, parent, handle } = harness(true)
  parent.abort()
  expect(runs[0].signal.aborted).toBe(true)
  await expect(handle.promise).rejects.toThrow('aborted')
})
