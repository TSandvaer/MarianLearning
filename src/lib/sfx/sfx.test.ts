import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSfx } from './sfx'

/**
 * Lightweight Howl fake. Each instance records its constructor opts and
 * exposes a hook to simulate a load error. Behaviour mirrors the slice of
 * Howler's surface area `createSfx` actually depends on.
 */
interface FakeOpts {
  src: string[]
  volume?: number
  preload?: boolean
  onloaderror?: (id: number, err: unknown) => void
}

class FakeHowl {
  static instances: FakeHowl[] = []
  opts: FakeOpts
  playSpy = vi.fn()
  unloadSpy = vi.fn()

  constructor(opts: FakeOpts) {
    this.opts = opts
    FakeHowl.instances.push(this)
  }

  play(): number {
    this.playSpy()
    return 1
  }
  unload(): void {
    this.unloadSpy()
  }

  /** Test helper: simulate the engine reporting a load failure. */
  failLoad(message = '404'): void {
    this.opts.onloaderror?.(0, message)
  }
}

describe('createSfx', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    FakeHowl.instances = []
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('plays through Howler when the asset loads successfully', () => {
    const sfx = createSfx({
      src: '/assets/sfx-chime-soft.mp3',
      HowlCtor: FakeHowl as unknown as typeof import('howler').Howl,
    })

    const fired = sfx.play()

    expect(fired).toBe(true)
    expect(FakeHowl.instances).toHaveLength(1)
    expect(FakeHowl.instances[0].playSpy).toHaveBeenCalledTimes(1)
    expect(sfx.missedPlays).toBe(0)
    expect(sfx.loadFailed).toBe(false)
  })

  it('forwards the requested volume to Howler', () => {
    createSfx({
      src: '/assets/sfx-chime-soft.mp3',
      volume: 0.6,
      HowlCtor: FakeHowl as unknown as typeof import('howler').Howl,
    })

    expect(FakeHowl.instances[0].opts.volume).toBe(0.6)
  })

  it('treats a missing asset as a soft failure: no throw, no audio, single warn', () => {
    const sfx = createSfx({
      src: '/assets/sfx-missing.mp3',
      HowlCtor: FakeHowl as unknown as typeof import('howler').Howl,
    })

    // Simulate Howler reporting a 404 / decode failure.
    FakeHowl.instances[0].failLoad('404')

    const fired = sfx.play()

    expect(fired).toBe(false)
    expect(sfx.loadFailed).toBe(true)
    expect(sfx.missedPlays).toBe(1)
    expect(FakeHowl.instances[0].playSpy).not.toHaveBeenCalled()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/sfx-missing\.mp3/)
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/assets-todo\.md/)
  })

  it('only warns once even if play() is called many times after a load failure', () => {
    const sfx = createSfx({
      src: '/assets/sfx-missing.mp3',
      HowlCtor: FakeHowl as unknown as typeof import('howler').Howl,
    })
    FakeHowl.instances[0].failLoad()

    sfx.play()
    sfx.play()
    sfx.play()

    expect(sfx.missedPlays).toBe(3)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back silently when the Howl constructor throws synchronously', () => {
    class ThrowingHowl {
      constructor() {
        throw new Error('no audio backend')
      }
    }

    const sfx = createSfx({
      src: '/assets/sfx-chime-soft.mp3',
      HowlCtor: ThrowingHowl as unknown as typeof import('howler').Howl,
    })

    const fired = sfx.play()

    expect(fired).toBe(false)
    expect(sfx.loadFailed).toBe(true)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('unload() releases the underlying Howl and survives double-call', () => {
    const sfx = createSfx({
      src: '/assets/sfx-chime-soft.mp3',
      HowlCtor: FakeHowl as unknown as typeof import('howler').Howl,
    })
    const howlInstance = FakeHowl.instances[0]

    sfx.unload()
    sfx.unload() // idempotent — second call must not throw

    expect(howlInstance.unloadSpy).toHaveBeenCalledTimes(1)
  })
})
