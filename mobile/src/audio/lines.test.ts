import { GREET_LINES } from '@marian/core/greet/greetSequence'
import {
  fakePlayerFactory,
  fakePlayers,
  resetFakePlayers,
} from '../../test/fakeAudio'
import { countWords } from './captionClock'
import { createAudioEngine } from './engine'
import {
  GREET_LINE_SOURCES,
  GREET_LINE_TEXT,
  createGreetAudio,
  type GreetLineKey,
} from './greetAudio'
import { START_TIMEOUT_MS } from './linePlayback'
import {
  CAPTION_WALK_MS_PER_WORD,
  createManifestLinePlayer,
  createPathLinePlayer,
  type ManifestLine,
} from './manifestLines'

const engine = () => createAudioEngine({ createPlayer: fakePlayerFactory })

beforeEach(() => {
  resetFakePlayers()
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

describe('Greet lines (web preRecorded.ts contract)', () => {
  it('speaks core GREET_LINES with the web word counts (1, 2, 6, 6)', () => {
    expect(Object.values(GREET_LINE_TEXT)).toEqual([...GREET_LINES])
    const counts = (Object.keys(GREET_LINE_TEXT) as GreetLineKey[]).map((k) =>
      countWords(GREET_LINE_TEXT[k]),
    )
    expect(counts).toEqual([1, 2, 6, 6])
    expect(GREET_LINE_SOURCES.imEmma).toBe(
      '/assets/audio/greet/greet-02-im-emma.mp3',
    )
  })

  it('loadGreetAudio creates the 4 players up front, once', () => {
    const greet = createGreetAudio(engine())
    greet.loadGreetAudio()
    greet.loadGreetAudio()
    expect(fakePlayers).toHaveLength(4)
  })

  it('resolves at the end and rejects on cancel (the caller attaches .catch)', async () => {
    const greet = createGreetAudio(engine())
    const ticks: number[] = []
    const first = greet.playGreetLine('imEmma', {
      onWordTick: (i) => ticks.push(i),
    })
    fakePlayers[0].start(1)
    fakePlayers[0].finish()
    await expect(first).resolves.toBeUndefined()
    expect(ticks).toEqual([0, 1])

    const second = greet.playGreetLine('tapHeart')
    greet.cancel()
    await expect(second).rejects.toThrow('cancelled')
  })

  it('cancel() leaves a non-Greet line alone', async () => {
    const e = engine()
    const greet = createGreetAudio(e)
    const hub = e.speak('hub:x', 9, { text: 'Hi again!', label: 'hub:x' })
    greet.cancel()
    expect(e.voice.activeLabel).toBe('hub:x')
    e.cancelVoice()
    await expect(hub).rejects.toThrow('cancelled')
  })

  it('unload releases the Greet players', () => {
    const greet = createGreetAudio(engine())
    greet.loadGreetAudio()
    greet.unload()
    expect(fakePlayers.every((p) => p.removed)).toBe(true)
  })
})

describe('manifest lines (web playHubLine.ts contract)', () => {
  const LINES: Record<'ok' | 'missing' | 'captionOnly', ManifestLine> = {
    ok: {
      src: '/assets/audio/hub/hub-welcome-pick-again.mp3',
      text: 'Pick again?',
    },
    missing: { src: '/assets/audio/hub/not-there.mp3', text: 'One two three.' },
    captionOnly: { src: null, text: 'One two three.' },
  }

  it('plays a bundled clip and resolves at its end', async () => {
    const player = createManifestLinePlayer('hub', LINES, engine())
    const onPlay = jest.fn()
    const done = player.playLine('ok', { onPlay })
    fakePlayers[0].start(1)
    fakePlayers[0].finish()
    await expect(done).resolves.toBeUndefined()
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it.each(['missing', 'captionOnly'] as const)(
    'no clip (%s): walks the caption at 165 wpm and resolves, silently',
    async (id) => {
      const player = createManifestLinePlayer('hub', LINES, engine())
      const ticks: number[] = []
      const onPlay = jest.fn()
      const done = player.playLine(id, {
        onPlay,
        onWordTick: (i) => ticks.push(i),
      })
      expect(onPlay).toHaveBeenCalledTimes(1)
      expect(ticks).toEqual([0])
      jest.advanceTimersByTime(CAPTION_WALK_MS_PER_WORD)
      expect(ticks).toEqual([0, 1])
      jest.advanceTimersByTime(CAPTION_WALK_MS_PER_WORD)
      await expect(done).resolves.toBeUndefined()
      expect(ticks).toEqual([0, 1, 2])
      expect(fakePlayers).toHaveLength(0)
    },
  )

  it('never rejects: a clip that fails to start falls back to the caption walk', async () => {
    const player = createManifestLinePlayer('hub', LINES, engine())
    const ticks: number[] = []
    const done = player.playLine('ok', { onWordTick: (i) => ticks.push(i) })
    jest.advanceTimersByTime(START_TIMEOUT_MS)
    await Promise.resolve()
    await Promise.resolve()
    jest.advanceTimersByTime(CAPTION_WALK_MS_PER_WORD)
    await expect(done).resolves.toBeUndefined()
    expect(ticks).toEqual([0, 1])
  })

  it('a clip that errors mid-line walks only the remaining words', async () => {
    const player = createManifestLinePlayer('hub', LINES, engine())
    const ticks: number[] = []
    const onPlay = jest.fn()
    const done = player.playLine('ok', {
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    fakePlayers[0].start(1)
    fakePlayers[0].emit({ error: 'decoder died' })
    await Promise.resolve()
    await Promise.resolve()
    jest.advanceTimersByTime(CAPTION_WALK_MS_PER_WORD)
    await expect(done).resolves.toBeUndefined()
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([0, 1])
  })

  it('cancelActive() stops the clip and resolves without further ticks (web 86c9m4afh)', async () => {
    const player = createManifestLinePlayer('hub', LINES, engine())
    const ticks: number[] = []
    const done = player.playLine('ok', { onWordTick: (i) => ticks.push(i) })
    fakePlayers[0].start(1)
    player.cancelActive()
    await expect(done).resolves.toBeUndefined()
    expect(fakePlayers[0].calls).toEqual(['play', 'pause', 'remove', 'release'])
    fakePlayers[0].emit({ currentTime: 0.9 })
    expect(ticks).toEqual([0])
  })

  it('cancelActive() also stops a caption walk', async () => {
    const player = createManifestLinePlayer('hub', LINES, engine())
    const ticks: number[] = []
    const done = player.playLine('captionOnly', {
      onWordTick: (i) => ticks.push(i),
    })
    player.cancelActive()
    jest.advanceTimersByTime(10 * CAPTION_WALK_MS_PER_WORD)
    await expect(done).resolves.toBeUndefined()
    expect(ticks).toEqual([0])
  })
})

describe('path lines (web playMapLine.ts contract)', () => {
  it('a deferred line (src null) resolves at once and creates no player', async () => {
    const player = createPathLinePlayer(engine())
    await expect(
      player.play({ id: 'path.locked.later.x.y', src: null, text: 'Not yet.' }),
    ).resolves.toBeUndefined()
    expect(fakePlayers).toHaveLength(0)
  })

  it('plays a baked line; a newer line cancels it; neither rejects', async () => {
    const player = createPathLinePlayer(engine())
    const a = player.play({
      id: 'path.open.add-to-10',
      src: '/assets/audio/path/path-open-add-to-10.mp3',
      text: 'Here is your path!',
    })
    fakePlayers[0].start(2)
    const b = player.play({
      id: 'path.stop.add-to-10',
      src: '/assets/audio/path/path-stop-add-to-10.mp3',
      text: 'Adding.',
    })
    await expect(a).resolves.toBeUndefined()
    fakePlayers[1].start(1)
    fakePlayers[1].emit({ error: 'gone' })
    await expect(b).resolves.toBeUndefined()
  })
})
