/**
 * Word Song's tap sounds: a window of a clip on its own player, outside
 * Emma's voice channel; a new tap or `cut()` stops it, `release()` frees it.
 */
import {
  fakePlayers,
  flush,
  resetFakePlayers,
  type FakePlayer,
} from '../../test/fakeAudio'
import { createAudioEngine } from './engine'
import { createTapClipPlayer } from './tapClip'

beforeEach(() => resetFakePlayers())

function setup() {
  const engine = createAudioEngine()
  const tap = createTapClipPlayer(engine)
  return { engine, tap }
}

const last = (): FakePlayer => fakePlayers.at(-1)!

it('seeks to the window, plays, and stops at its end', async () => {
  const { engine, tap } = setup()
  const onEnd = jest.fn()
  tap.play('file:///blend.mp3', 855, 1244, onEnd)
  await flush()
  const p = last()
  expect(p.calls).toEqual(['seekTo(0.855)', 'play'])
  // Never through Emma's voice channel.
  expect(engine.voice.activeLabel).toBeNull()
  p.emit({ playing: true, currentTime: 1.2 })
  expect(onEnd).not.toHaveBeenCalled()
  p.emit({ playing: true, currentTime: 1.25 })
  expect(p.calls.at(-1)).toBe('pause')
  expect(onEnd).toHaveBeenCalledTimes(1)
  expect(tap.playing).toBe(false)
})

it('a whole-word window plays to the clip end', async () => {
  const { tap } = setup()
  const onEnd = jest.fn()
  tap.play('file:///blend.mp3', 2631, null, onEnd)
  await flush()
  last().emit({ playing: true, currentTime: 3.5 })
  expect(onEnd).not.toHaveBeenCalled()
  last().emit({ playing: false, currentTime: 3.6, didJustFinish: true })
  expect(onEnd).toHaveBeenCalledTimes(1)
})

it('a new tap cuts the sound in flight; one player per clip', async () => {
  const { tap } = setup()
  const first = jest.fn()
  tap.play('file:///blend.mp3', 0, 380, first)
  await flush()
  tap.play('file:///blend.mp3', 855, 1244)
  await flush()
  expect(first).toHaveBeenCalledTimes(1)
  expect(fakePlayers).toHaveLength(1)
  expect(last().calls).toEqual([
    'seekTo(0)',
    'play',
    'pause',
    'seekTo(0.855)',
    'play',
  ])
})

it('cut before the seek settles never starts the sound', async () => {
  const { tap } = setup()
  tap.play('file:///blend.mp3', 855, 1244)
  tap.cut()
  await flush()
  expect(last().calls).not.toContain('play')
})

it('release stops and frees the player (no auto-resume)', async () => {
  const { tap } = setup()
  tap.play('file:///blend.mp3', 0, 380)
  await flush()
  tap.release()
  expect(last().released).toBe(true)
  expect(last().removed).toBe(true)
})
