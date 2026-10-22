/**
 * Reduce Motion in both games (play-place § 2.5, § 3.7, AC N12): no
 * wobble, rowing, scene or tumble starts; the dim fades run; lines and
 * sounds are unchanged; a drag still follows the finger.
 */
import { CRITTER_WORDS_BY_STEP } from '@marian/core/games/playPlace'
import { screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import { mathLayout } from '../../layout/mathLayout'
import {
  activate,
  advance,
  byId,
  dragTo,
  fakeSounds,
  has,
  mountGame,
  PHONE_P,
  tap,
} from '../../../test/playHarness'
import { CRITTERS_OPEN_DELAY_MS, SING_AFTER_MS } from './LetterCritters'
import { centre, playArea, raftScene } from './playGeometry'
import { REDUCED_SPLASH_END_MS, ROW_AT_MS, SCENE_AT_MS } from './RaftCrossing'

const BLENDING_WORDS = CRITTER_WORDS_BY_STEP['blending-cv']!

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it('raft: a splash dims instead of wobbling, with the same sound and line; a crossing has no rowing or scene', async () => {
  const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
  const l = mathLayout(PHONE_P)
  const deck = centre(raftScene(playArea(l), l.tablet, l.landscape).dock)
  await tap(byId('raft-animal-0'))
  await dragTo(byId('raft-animal-2'), deck)
  expect(has('raft-wobble')).toBe(false)
  expect(has('raft-dim')).toBe(true)
  await advance(REDUCED_SPLASH_END_MS)
  expect(g.sfx.splash.play).toHaveBeenCalledTimes(1)
  expect(g.lines).toContain('guide.play.raft.splash')
  expect(has('raft-animal-2')).toBe(true)
  // The drag followed the finger and boarded: the drop still works.
  await dragTo(byId('raft-animal-1'), deck)
  expect(g.lines.at(-1)).toBe('guide.play.raft.go')
  await advance(ROW_AT_MS + 10)
  expect(has('raft-rowing')).toBe(false)
  await advance(400 + SCENE_AT_MS + 10)
  expect(g.lines.at(-1)).toBe('guide.play.raft.silly')
  expect(screen.queryAllByTestId(/^raft-scene-/)).toHaveLength(0)
})

it('critters: a non-word dims instead of tumbling; the boing and the line play', async () => {
  const s = fakeSounds(() => 2000)
  const g = await mountGame('critters', {
    words: BLENDING_WORDS,
    sounds: s.sounds,
  })
  await advance(CRITTERS_OPEN_DELAY_MS + 20)
  for (const letter of ['b', 'g', 'f'])
    await activate(byId(`critter-${letter}`))
  await advance(SING_AFTER_MS + 3 * 1000)
  expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
  expect(has('critter-tumble')).toBe(false)
  expect(has('critter-dim')).toBe(true)
  expect(g.lines.at(-1)).toBe('guide.play.critters.funny.1')
})
