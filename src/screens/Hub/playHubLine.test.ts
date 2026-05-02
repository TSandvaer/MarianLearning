/**
 * Tests for the Howler-backed default Hub-line player.
 *
 * Wired in ticket 86c9kxv47 to fix Thomas's iPad ear-test report ("no
 * greet when I return to hub, just text 'pick again'") — Hub had been
 * running on the silent caption-walk-only fallback because no caller was
 * supplying a `playLineFn` prop. This module is the missing default.
 *
 * Test surface — the contracts that matter:
 *   - On a successful Howl load+play, `onPlay` and `onWordTick(0..N-1)`
 *     fire and the promise resolves on the Howl `end` event.
 *   - On a `loaderror`, the player soft-falls-back to a 165-wpm caption-
 *     walk and still resolves. Hub never bricks on a 404.
 *   - Howl construction is cached: replaying the same line reuses the
 *     same instance (no repeat XHR).
 *   - The Howl is built with the correct src from the line manifest.
 *
 * jsdom has no audio backend, so we inject a fake Howl ctor — same
 * pattern as `lib/audio/preRecorded.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHubLinePlayer } from './playHubLine'
import { HUB_LINES } from './hubLines'
import type { Howl } from 'howler'

interface FakeHowlInstance {
  src: string[]
  preload?: boolean
  play: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  duration: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  state: ReturnType<typeof vi.fn>
  _handlers: Record<string, Array<(...args: unknown[]) => void>>
  _emit: (event: string, ...args: unknown[]) => void
}

function makeFakeHowl(): {
  HowlCtor: typeof Howl
  instances: FakeHowlInstance[]
} {
  const instances: FakeHowlInstance[] = []
  const HowlCtor = vi.fn((opts: { src: string[]; preload?: boolean }) => {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    const inst: FakeHowlInstance = {
      src: opts.src,
      preload: opts.preload,
      play: vi.fn(() => 1),
      stop: vi.fn(),
      duration: vi.fn(() => 0.5), // 500ms — short fake clip
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] ??= []
        handlers[event].push(cb)
      }),
      off: vi.fn((event: string) => {
        delete handlers[event]
      }),
      unload: vi.fn(),
      state: vi.fn(() => 'loaded'),
      _handlers: handlers,
      _emit: (event: string, ...args: unknown[]) => {
        for (const cb of handlers[event] ?? []) cb(...args)
      },
    }
    instances.push(inst)
    return inst
  }) as unknown as typeof Howl
  return { HowlCtor, instances }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createHubLinePlayer', () => {
  it('builds a Howl with the correct src for the requested line id', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })

    const promise = player.playHubLine('hub.welcome.pick-again')
    // Synchronously after the call, the Howl was constructed with the
    // manifest src. We don't await — the promise awaits the `end` event.
    expect(instances).toHaveLength(1)
    expect(instances[0].src).toEqual([HUB_LINES['hub.welcome.pick-again'].src])
    expect(instances[0].preload).toBe(true)

    // Drain by emitting `end` so the promise resolves.
    instances[0]._emit('play')
    instances[0]._emit('end')
    await promise
  })

  it('fires onPlay and onWordTick(0) when Howl emits play', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })
    const onPlay = vi.fn()
    const onWordTick = vi.fn()

    const promise = player.playHubLine('hub.welcome.what-today', {
      onPlay,
      onWordTick,
    })

    expect(onPlay).not.toHaveBeenCalled()
    instances[0]._emit('play')
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onWordTick).toHaveBeenCalledWith(0)

    instances[0]._emit('end')
    await promise
  })

  it('walks subsequent word ticks across the audio duration when Howl reports a positive duration', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })
    const onWordTick = vi.fn()

    // "Hi! What today?" has 3 words.
    const promise = player.playHubLine('hub.welcome.what-today', {
      onWordTick,
    })

    instances[0]._emit('play')
    // Word 0 fires synchronously on play.
    expect(onWordTick).toHaveBeenCalledWith(0)

    // Duration 500ms / 3 words → 166.67 ms per tick. Drain a generous
    // window to surface ticks 1 + 2.
    await vi.advanceTimersByTimeAsync(700)
    const indices = onWordTick.mock.calls.map((c) => c[0] as number)
    expect(indices).toContain(1)
    expect(indices).toContain(2)

    instances[0]._emit('end')
    await promise
  })

  it('soft-falls-back to caption-walk on loaderror and still resolves', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })
    const onWordTick = vi.fn()

    const promise = player.playHubLine('hub.welcome.what-today', {
      onWordTick,
    })

    // Simulate a 404: the loaderror event fires before any play event.
    instances[0]._emit('loaderror')

    // The fallback walker fires onWordTick(0) synchronously and then the
    // remaining ticks via setInterval. Drain until promise resolves.
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    const indices = onWordTick.mock.calls.map((c) => c[0] as number)
    expect(indices).toContain(0)
    expect(indices).toContain(2)
  })

  it('caches the Howl per line id — repeat plays do not construct a new instance', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })

    const p1 = player.playHubLine('hub.welcome.pick-again')
    instances[0]._emit('play')
    instances[0]._emit('end')
    await p1

    const p2 = player.playHubLine('hub.welcome.pick-again')
    instances[0]._emit('play')
    instances[0]._emit('end')
    await p2

    expect(instances).toHaveLength(1)
    // Howl.play() invoked twice — one per request.
    expect(instances[0].play).toHaveBeenCalledTimes(2)
  })

  it('on a HowlCtor throw, falls back to caption-walk and warns once', async () => {
    const HowlCtor = vi.fn(() => {
      throw new Error('audio backend unavailable')
    }) as unknown as typeof Howl
    const player = createHubLinePlayer({ HowlCtor })
    const onWordTick = vi.fn()

    const promise = player.playHubLine('hub.welcome.what-today', {
      onWordTick,
    })

    // Walker fires word 0 synchronously, then advances on the timer.
    expect(onWordTick).toHaveBeenCalledWith(0)
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(
      /Howler unavailable/,
    )
  })

  it('unload() tears down all cached Howls and is idempotent', async () => {
    const { HowlCtor, instances } = makeFakeHowl()
    const player = createHubLinePlayer({ HowlCtor })

    const p = player.playHubLine('hub.welcome.pick-again')
    instances[0]._emit('play')
    instances[0]._emit('end')
    await p

    player.unload()
    expect(instances[0].unload).toHaveBeenCalledTimes(1)

    // Second unload is a no-op — cache cleared, no double-unload.
    player.unload()
    expect(instances[0].unload).toHaveBeenCalledTimes(1)
  })
})
