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
    // Stopped, and released even though the app is visible: a cached,
    // OS-flagged player would be auto-resumed by expo-audio later.
    expect(fakePlayers[0].calls).toEqual(['play', 'pause', 'remove', 'release'])
    expect(engine.loadedKeys()).toEqual(['session:s1:p1.read'])
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

  it('a start-timeout stops the clip and releases its player, so a late start cannot play over the next line', async () => {
    const { engine } = setup()
    const ticks: number[] = []
    const onPlay = jest.fn()
    const timedOut = engine.speak('greet:hi', SRC, {
      text: 'Hi!',
      label: 'greet:hi',
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    const stalled = fakePlayers[0]
    jest.advanceTimersByTime(START_TIMEOUT_MS)
    await expect(timedOut).rejects.toThrow('start-timeout')
    // Paused BEFORE the release, synchronously with the settle.
    expect(stalled.calls).toEqual(['play', 'pause', 'remove', 'release'])
    expect(engine.loadedKeys()).toEqual([])
    expect(engine.voice.activeLabel).toBeNull()

    // The next line (here: the same clip) gets a fresh player...
    const next = engine.speak('greet:hi', SRC, { text: 'Hi!', label: 'next' })
    expect(fakePlayers).toHaveLength(2)
    // ...and a late status from the dead player changes nothing.
    stalled.emit({ playing: true, currentTime: 0.2, duration: 0.6 })
    expect(onPlay).not.toHaveBeenCalled()
    expect(ticks).toEqual([])
    expect(engine.voice.activeLabel).toBe('next')
    fakePlayers[1].start(0.6)
    fakePlayers[1].finish()
    await expect(next).resolves.toBeUndefined()
  })

  it('rejects with the player error, pausing and releasing the player', async () => {
    const { engine } = setup()
    const done = engine.speak('greet:hi', SRC, {
      text: 'Hi!',
      label: 'greet:hi',
    })
    fakePlayers[0].emit({ error: 'decode failed' })
    await expect(done).rejects.toThrow('decode failed')
    expect(fakePlayers[0].calls).toEqual(['play', 'pause', 'remove', 'release'])
    expect(engine.loadedKeys()).toEqual([])
  })

  it('a play() that throws rejects and releases the player', async () => {
    const throwing = (src: Parameters<typeof fakePlayerFactory>[0]) => {
      const p = fakePlayerFactory(src) as FakePlayer
      p.play = () => {
        p.calls.push('play!')
        throw new Error('session inactive')
      }
      return p
    }
    const engine = createAudioEngine({ createPlayer: throwing })
    const done = engine.speak('greet:hi', SRC, { text: 'Hi!', label: 'x' })
    await expect(done).rejects.toThrow('session inactive')
    expect(fakePlayers[0].calls).toEqual([
      'play!',
      'pause',
      'remove',
      'release',
    ])
    expect(engine.loadedKeys()).toEqual([])
  })

  it('a natural end keeps the player cached (no release) for a replay', async () => {
    const { engine } = setup()
    const done = engine.speak('greet:hi', SRC, { text: 'Hi!', label: 'x' })
    fakePlayers[0].start(0.6)
    fakePlayers[0].finish()
    await done
    expect(fakePlayers[0].released).toBe(false)
    expect(engine.loadedKeys()).toEqual(['greet:hi'])
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
    expect(fakePlayers[0].calls).toEqual(['remove', 'release'])
    engine.preload('greet:hi', SRC)
    expect(fakePlayers).toHaveLength(2)
  })

  it('caps live players (Android: one MP3 decoder each) by releasing the least recently used', () => {
    const engine = createAudioEngine({
      createPlayer: fakePlayerFactory,
      maxPlayers: 3,
    })
    engine.preload('a', SRC)
    engine.preload('b', SRC)
    engine.preload('c', SRC)
    engine.preload('a', SRC) // a is now the most recently used
    engine.preload('d', SRC)
    expect(engine.loadedKeys()).toEqual(['c', 'a', 'd'])
    // Evicted = out of the registry AND native player (decoder) freed.
    expect(fakePlayers.map((p) => p.calls)).toEqual([
      [],
      ['remove', 'release'],
      [],
      [],
    ])
  })

  it('never evicts the line in flight', async () => {
    const engine = createAudioEngine({
      createPlayer: fakePlayerFactory,
      maxPlayers: 2,
    })
    const line = engine.speak('a', SRC, { text: 'One two.', label: 'a' })
    fakePlayers[0].start(1)
    engine.preload('b', SRC)
    engine.preload('c', SRC) // over the cap: b goes, a is playing
    expect(engine.loadedKeys()).toEqual(['a', 'c'])
    expect(fakePlayers[0].removed).toBe(false)
    fakePlayers[0].finish()
    await line
    engine.preload('d', SRC) // a has finished: now it is evictable
    expect(engine.loadedKeys()).toEqual(['c', 'd'])
  })

  it('the default cap is 4 live voice players', () => {
    const { engine } = setup()
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) engine.preload(k, SRC)
    expect(engine.loadedKeys()).toEqual(['c', 'd', 'e', 'f'])
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
