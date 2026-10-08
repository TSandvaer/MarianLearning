/**
 * Map line player (Emma's Path 8/10, 123jpnbc3dr): Howls per bundled MP3,
 * nothing at all for a deferred (`src: null`) line, unload on leave.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pathLine, type PathLine } from '@marian/core/emmasPath/pathLines'
import { createMapLinePlayer, type MapHowlLike } from './playMapLine'

class FakeHowl implements MapHowlLike {
  static instances: FakeHowl[] = []
  handlers = new Map<string, () => void>()
  play = vi.fn(() => 1)
  stop = vi.fn()
  unload = vi.fn()
  opts: { src: string[]; preload: boolean }
  constructor(opts: { src: string[]; preload: boolean }) {
    this.opts = opts
    FakeHowl.instances.push(this)
  }
  on(event: string, cb: () => void) {
    this.handlers.set(event, cb)
    return this
  }
  off(event: string) {
    this.handlers.delete(event)
    return this
  }
  fire(event: string) {
    this.handlers.get(event)?.()
  }
}

const line = (id: string): PathLine => pathLine(id)!

afterEach(() => {
  FakeHowl.instances = []
})

describe('createMapLinePlayer', () => {
  it('plays a baked line through a Howl on its MP3 and resolves on end', async () => {
    const player = createMapLinePlayer({ HowlCtor: FakeHowl })
    const done = player.play(line('path.stop.add-to-10'))
    expect(FakeHowl.instances).toHaveLength(1)
    expect(FakeHowl.instances[0]!.opts.src).toEqual([
      '/assets/audio/path/path-stop-add-to-10.mp3',
    ])
    expect(FakeHowl.instances[0]!.play).toHaveBeenCalledTimes(1)
    FakeHowl.instances[0]!.fire('end')
    await expect(done).resolves.toBeUndefined()
  })

  it('deferred line (src null): builds no Howl, plays nothing, never uses browser speech', async () => {
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak })
    const player = createMapLinePlayer({ HowlCtor: FakeHowl })
    const deferred = line('path.locked.later.mult-6-9.add-to-10')
    expect(deferred.src).toBeNull()
    await expect(player.play(deferred)).resolves.toBeUndefined()
    const gate = line('path.gate.locked.math.4.add-to-10')
    expect(gate.src).toBeNull()
    await player.play(gate)
    expect(FakeHowl.instances).toHaveLength(0)
    expect(speak).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('a new line stops the one in flight; Howls are reused per MP3', () => {
    const player = createMapLinePlayer({ HowlCtor: FakeHowl })
    void player.play(line('path.stop.add-to-10'))
    void player.play(line('path.stop.add-to-20'))
    expect(FakeHowl.instances).toHaveLength(2)
    expect(FakeHowl.instances[0]!.stop).toHaveBeenCalledTimes(1)
    void player.play(line('path.stop.add-to-10'))
    expect(FakeHowl.instances).toHaveLength(2)
    expect(FakeHowl.instances[0]!.play).toHaveBeenCalledTimes(2)
  })

  it('load error resolves quietly (caption only)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const player = createMapLinePlayer({ HowlCtor: FakeHowl })
    const done = player.play(line('path.land.math.2'))
    FakeHowl.instances[0]!.fire('loaderror')
    await expect(done).resolves.toBeUndefined()
    warn.mockRestore()
  })

  it('unload releases every Howl and silences later plays', async () => {
    const player = createMapLinePlayer({ HowlCtor: FakeHowl })
    void player.play(line('path.stop.add-to-10'))
    void player.play(line('path.stop.add-to-20'))
    player.unload()
    expect(
      FakeHowl.instances.every((h) => h.unload.mock.calls.length === 1),
    ).toBe(true)
    await player.play(line('path.stop.sub-to-10'))
    expect(FakeHowl.instances).toHaveLength(2)
  })
})
