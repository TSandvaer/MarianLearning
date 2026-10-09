import {
  createAudioPlayer,
  fakePlayerFactory,
  fakePlayers,
  flush,
  resetFakePlayers,
} from '../../test/fakeAudio'
import { createAudioEngine } from './engine'
import { setAudioMutedForTests } from './mute'
import { createExpoPlayer } from './playerPort'
import { SFX_SOURCES, createSfx } from './sfx'

const engine = () => createAudioEngine({ createPlayer: fakePlayerFactory })

beforeEach(() => {
  resetFakePlayers()
  createAudioPlayer.mockClear()
  setAudioMutedForTests(null)
})

describe('SFX (web sfx.ts contract)', () => {
  it('creates its player up front with the requested volume and plays it', () => {
    const sfx = createSfx({
      src: SFX_SOURCES.sparkle,
      volume: 0.55,
      engine: engine(),
    })
    expect(fakePlayers).toHaveLength(1)
    expect(fakePlayers[0].volume).toBe(0.55)
    expect(sfx.play()).toBe(true)
    expect(fakePlayers[0].calls).toEqual(['play'])
  })

  it('rewinds itself at the end so the next play() is immediate', async () => {
    const sfx = createSfx({ src: SFX_SOURCES.plink, engine: engine() })
    const p = fakePlayers[0]
    sfx.play()
    p.start(0.2)
    p.finish()
    await flush()
    expect(p.calls).toEqual(['play', 'seekTo(0)'])
    sfx.play()
    expect(p.calls).toEqual(['play', 'seekTo(0)', 'play'])
  })

  it('a play() during playback restarts the effect from the top', async () => {
    const sfx = createSfx({ src: SFX_SOURCES.chime, engine: engine() })
    const p = fakePlayers[0]
    sfx.play()
    p.start(0.7)
    p.emit({ currentTime: 0.3 })
    expect(sfx.play()).toBe(true)
    await flush()
    expect(p.calls).toEqual(['play', 'seekTo(0)', 'play'])
  })

  it('an effect not bundled plays silently: false, missedPlays, loadFailed', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const sfx = createSfx({ src: '/assets/sfx-nope.mp3', engine: engine() })
    expect(sfx.play()).toBe(false)
    expect(sfx.play()).toBe(false)
    expect(sfx.missedPlays).toBe(2)
    expect(sfx.loadFailed).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('a load error latches loadFailed and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const sfx = createSfx({ src: SFX_SOURCES.poof, engine: engine() })
    fakePlayers[0].emit({ error: 'decode' })
    fakePlayers[0].emit({ error: 'decode' })
    expect(sfx.play()).toBe(false)
    expect(sfx.loadFailed).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('drops the effect while the app is hidden (not counted as a miss)', () => {
    const e = engine()
    const sfx = createSfx({ src: SFX_SOURCES.cheer, engine: e })
    e.voice.setHidden(true)
    expect(sfx.play()).toBe(false)
    expect(sfx.missedPlays).toBe(0)
    expect(fakePlayers[0].calls).toEqual([])
    e.voice.setHidden(false)
    expect(sfx.play()).toBe(true)
  })

  it('unload releases the player', () => {
    const sfx = createSfx({ src: SFX_SOURCES.sparkle, engine: engine() })
    sfx.unload()
    expect(fakePlayers[0].removed).toBe(true)
  })
})

describe('player factory (silent everywhere automated)', () => {
  it('creates players with the 50 ms status interval', () => {
    createExpoPlayer(5)
    expect(createAudioPlayer).toHaveBeenCalledWith(5, { updateInterval: 50 })
    expect(fakePlayers[0].muted).toBe(false)
  })

  it('EXPO_PUBLIC_MUTE=1 mutes every player it creates', () => {
    setAudioMutedForTests(true)
    createExpoPlayer(5)
    createExpoPlayer({ uri: 'file:///x.mp3' })
    expect(fakePlayers.map((p) => p.muted)).toEqual([true, true])
  })

  it('the default engine and SFX go through the muting factory', () => {
    setAudioMutedForTests(true)
    createSfx({ src: SFX_SOURCES.plink })
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(fakePlayers[0].muted).toBe(true)
  })
})
