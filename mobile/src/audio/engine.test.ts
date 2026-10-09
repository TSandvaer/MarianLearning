import {
  FakePlayer,
  fakePlayerFactory,
  fakePlayers,
  flush,
  resetFakePlayers,
} from '../../test/fakeAudio'
import { _resetAudioLogForTests, readAudioLog } from './audioLog'
import { createAudioEngine, type AudioEngine } from './engine'
import { START_TIMEOUT_MS } from './linePlayback'

const SRC = 101 // a bundled module id; the fake ignores it

function setup(): { engine: AudioEngine; clock: { t: number } } {
  const clock = { t: 1_000 }
  const engine = createAudioEngine({
    createPlayer: fakePlayerFactory,
    now: () => clock.t,
  })
  return { engine, clock }
}

describe('audio engine: speak contract', () => {
  beforeEach(() => {
    resetFakePlayers()
    _resetAudioLogForTests()
    jest.useFakeTimers()
  })
  afterEach(() => jest.useRealTimers())

  it('fires onPlay on the first playing status, ticks words on the audio clock, resolves at the end', async () => {
    const { engine, clock } = setup()
    const ticks: number[] = []
    const onPlay = jest.fn()
    const done = engine.speak('greet:niceToMeet', SRC, {
      text: "It's so nice to meet you.",
      label: 'greet:niceToMeet',
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    const p = fakePlayers[0]
    expect(p.calls).toEqual(['play'])
    expect(onPlay).not.toHaveBeenCalled()

    clock.t += 42
    p.start(1.8) // 6 words → 300 ms per word
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([0])

    p.emit({ currentTime: 0.29 })
    expect(ticks).toEqual([0])
    p.emit({ currentTime: 0.31 })
    expect(ticks).toEqual([0, 1])
    p.emit({ currentTime: 0.95 }) // a starved update catches up in order
    expect(ticks).toEqual([0, 1, 2, 3])

    p.finish()
    await expect(done).resolves.toBeUndefined()
    expect(ticks).toEqual([0, 1, 2, 3, 4, 5])
    expect(p.listenerCount).toBe(0)
    expect(readAudioLog()).toEqual([
      { kind: 'onplay', label: 'greet:niceToMeet', ms: 42 },
    ])
  })

  it('a new line cancels the one in flight (one Emma line at a time, across sources)', async () => {
    const { engine } = setup()
    const hub = engine.speak('hub:hub.welcome.what-today', SRC, {
      text: 'Hi! What today?',
      label: 'hub:hub.welcome.what-today',
    })
    fakePlayers[0].start(1.2)
    const math = engine.speak('session:s1:p1.read', SRC, {
      text: 'Three plus two. How many?',
      label: 'session:p1.read',
    })
    await expect(hub).rejects.toThrow('cancelled')
    expect(fakePlayers[0].calls).toEqual(['play', 'pause'])
    expect(engine.voice.activeLabel).toBe('session:p1.read')
    fakePlayers[1].start(2)
    fakePlayers[1].finish()
    await expect(math).resolves.toBeUndefined()
    expect(engine.voice.activeLabel).toBeNull()
  })

  it('rejects with start-timeout when the clip never starts', async () => {
    const { engine } = setup()
    const done = engine.speak('greet:hi', SRC, {
      text: 'Hi!',
      label: 'greet:hi',
    })
    jest.advanceTimersByTime(START_TIMEOUT_MS - 1)
    fakePlayers[0].emit({ playing: false })
    jest.advanceTimersByTime(1)
    await expect(done).rejects.toThrow('start-timeout')
  })

  it('rejects with the player error', async () => {
    const { engine } = setup()
    const done = engine.speak('greet:hi', SRC, {
      text: 'Hi!',
      label: 'greet:hi',
    })
    fakePlayers[0].emit({ error: 'decode failed' })
    await expect(done).rejects.toThrow('decode failed')
  })

  it('replays a line by rewinding its cached player', async () => {
    const { engine } = setup()
    const first = engine.speak('greet:hi', SRC, { text: 'Hi!', label: 'a' })
    const p = fakePlayers[0]
    p.start(0.6)
    p.finish()
    await first
    const again = engine.speak('greet:hi', SRC, { text: 'Hi!', label: 'b' })
    await flush()
    expect(fakePlayers).toHaveLength(1)
    expect(p.calls).toEqual(['play', 'seekTo(0)', 'play'])
    p.start(0.6)
    p.finish()
    await expect(again).resolves.toBeUndefined()
  })

  it('a clip that finishes between two status updates still reports onPlay and every word', async () => {
    const { engine } = setup()
    const ticks: number[] = []
    const onPlay = jest.fn()
    const done = engine.speak('hub:x', SRC, {
      text: 'Word Song!',
      label: 'hub:x',
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    fakePlayers[0].emit({
      duration: 0.4,
      currentTime: 0.4,
      didJustFinish: true,
    })
    await done
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([0, 1])
  })

  it('release() removes the native player; the next use creates a fresh one', () => {
    const { engine } = setup()
    engine.preload('greet:hi', SRC)
    expect(engine.loadedKeys()).toEqual(['greet:hi'])
    engine.release('greet:hi')
    expect(fakePlayers[0].removed).toBe(true)
    engine.preload('greet:hi', SRC)
    expect(fakePlayers).toHaveLength(2)
  })

  it('releasePrefix() removes only the matching clips', () => {
    const { engine } = setup()
    engine.preload('session:a:1', SRC)
    engine.preload('session:a:2', SRC)
    engine.preload('greet:hi', SRC)
    engine.releasePrefix('session:a:')
    expect(engine.loadedKeys()).toEqual(['greet:hi'])
    expect(fakePlayers.map((p: FakePlayer) => p.removed)).toEqual([
      true,
      true,
      false,
    ])
  })
})
