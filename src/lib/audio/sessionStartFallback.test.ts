import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_START_WAIT_TIMEOUT_MS,
  startSessionWithFallback,
} from './sessionStartFallback'

/** A `run` stub whose calls are recorded and settled by hand. */
function controllableRun() {
  const calls: {
    withHints: boolean
    signal: AbortSignal
    resolve: (v: string) => void
    reject: (e: unknown) => void
  }[] = []
  const run = vi.fn(
    (withHints: boolean, signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ withHints, signal, resolve, reject })
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      }),
  )
  return { run, calls }
}

describe('startSessionWithFallback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('uses a 5 s visible-wait budget', () => {
    expect(SESSION_START_WAIT_TIMEOUT_MS).toBe(5000)
  })

  it('resolves with the hinted plan when it beats the timer', async () => {
    const { run, calls } = controllableRun()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: new AbortController().signal,
    })
    h.startWaitTimer()
    await vi.advanceTimersByTimeAsync(4999)
    calls[0].resolve('hinted')
    await expect(h.promise).resolves.toEqual({
      prepared: 'hinted',
      usedFallback: false,
    })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('aborts the hinted request and re-requests without hints after the timeout', async () => {
    const { run, calls } = controllableRun()
    const onFallback = vi.fn()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: new AbortController().signal,
      onFallback,
    })
    h.startWaitTimer()
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).toHaveBeenCalledTimes(2)
    expect(calls.map((c) => c.withHints)).toEqual([true, false])
    expect(calls[0].signal.aborted).toBe(true)
    expect(onFallback).toHaveBeenCalledTimes(1)
    calls[1].resolve('canon')
    await expect(h.promise).resolves.toEqual({
      prepared: 'canon',
      usedFallback: true,
    })
  })

  it('does not start the timer until startWaitTimer is called (pre-warm time is free)', async () => {
    const { run, calls } = controllableRun()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: new AbortController().signal,
    })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(1)
    calls[0].resolve('hinted')
    await expect(h.promise).resolves.toEqual({
      prepared: 'hinted',
      usedFallback: false,
    })
  })

  it('never re-requests when the request carried no hints', async () => {
    const { run, calls } = controllableRun()
    const h = startSessionWithFallback({
      hasHints: false,
      run,
      signal: new AbortController().signal,
    })
    h.startWaitTimer()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(calls[0].withHints).toBe(false)
    calls[0].resolve('canon')
    await expect(h.promise).resolves.toEqual({
      prepared: 'canon',
      usedFallback: false,
    })
  })

  it('ignores a late hinted result once the fallback has started', async () => {
    const { run, calls } = controllableRun()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: new AbortController().signal,
    })
    h.startWaitTimer()
    await vi.advanceTimersByTimeAsync(5000)
    calls[0].resolve('late-hinted')
    calls[1].resolve('canon')
    await expect(h.promise).resolves.toEqual({
      prepared: 'canon',
      usedFallback: true,
    })
  })

  it('propagates a hinted-request error that lands before the timer', async () => {
    const { run, calls } = controllableRun()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: new AbortController().signal,
    })
    h.startWaitTimer()
    calls[0].reject(new Error('planner-failed'))
    await expect(h.promise).rejects.toThrow('planner-failed')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('parent abort aborts the in-flight fallback request and stops the timer', async () => {
    const { run, calls } = controllableRun()
    const parent = new AbortController()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: parent.signal,
    })
    h.promise.catch(() => {})
    h.startWaitTimer()
    await vi.advanceTimersByTimeAsync(5000)
    parent.abort()
    expect(calls[1].signal.aborted).toBe(true)
    await expect(h.promise).rejects.toThrow('aborted')
  })

  it('parent abort before the timer fires prevents the fallback request', async () => {
    const { run } = controllableRun()
    const parent = new AbortController()
    const h = startSessionWithFallback({
      hasHints: true,
      run,
      signal: parent.signal,
    })
    h.promise.catch(() => {})
    h.startWaitTimer()
    parent.abort()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })
})
