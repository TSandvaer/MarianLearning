/**
 * Reduce Motion in both games (play-place § 2.5, § 3.7, AC N12): no
 * wobble, rowing, scene or tumble starts; the dim fades run; lines and
 * sounds are unchanged; a drag still follows the finger.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { CRITTER_WORDS_BY_STEP } from '@marian/core/games/playPlace'
import { saveProgress } from '@marian/core/progress'
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
import { DRAG_HINT_MS } from './DragHintHand'
import {
  CRITTERS_OPEN_DELAY_MS,
  DIM_MS,
  PICTURE_HOLD_MS,
  SHELF_FADE_MS,
  SHELF_HOLD_MS,
  SING_AFTER_MS,
} from './LetterCritters'
import { centre, playArea, raftScene } from './playGeometry'
import { REDUCED_SPLASH_END_MS, ROW_AT_MS, SCENE_AT_MS } from './RaftCrossing'

const BLENDING_WORDS = CRITTER_WORDS_BY_STEP['blending-cv']!

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  // A learner on blending sounds: a non-word boings (Dave's safeguard).
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  saveProgress(progressAtStep('blending-cv'))
})
afterEach(() => {
  setKeyValueStore(null)
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
    hunt: false,
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

it('critters (Thomas 2026-10-23): the shelf clears with a fade back, no drop; the drag hint still shows', async () => {
  const s = fakeSounds(() => 2000)
  await mountGame('critters', {
    hunt: false,
    words: BLENDING_WORDS,
    sounds: s.sounds,
  })
  await advance(CRITTERS_OPEN_DELAY_MS)
  // The hand is hidden from VoiceOver; under Reduce Motion it only fades.
  const hidden = { includeHiddenElements: true } as const
  expect(screen.queryByTestId('critter-drag-hint', hidden)).not.toBeNull()
  await advance(DRAG_HINT_MS)
  expect(screen.queryByTestId('critter-drag-hint', hidden)).toBeNull()
  for (const letter of ['b', 'g', 'f'])
    await activate(byId(`critter-${letter}`))
  const fading = () => screen.queryAllByTestId(/^critter-fade-\d$/).length
  // To the dim, then on until the shelf starts to clear.
  let t = 0
  while (!has('critter-dim') && t < 10_000) {
    await advance(10)
    t += 10
  }
  expect(has('critter-dim')).toBe(true)
  await advance(DIM_MS + SHELF_HOLD_MS - 20)
  expect(fading()).toBe(0)
  await advance(30)
  expect(fading()).toBe(3)
  expect(screen.queryAllByTestId(/^critter-drop-\d$/)).toHaveLength(0)
  expect(screen.queryAllByTestId(/^critter-seat-\d$/)).toHaveLength(0)
  await advance(SHELF_FADE_MS)
  expect(screen.queryAllByTestId(/^critter-fade-\d$/)).toHaveLength(0)
  // The log is ready.
  await activate(byId('critter-c'))
  expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
    'Letter c, on the log',
  )
})

it('critters (Thomas 2026-10-23, build 20): a said word’s picture fades in after Emma says it and out over 300 ms, then the shelf fades back', async () => {
  const s = fakeSounds(() => 2000)
  const g = await mountGame('critters', {
    hunt: false,
    words: ['rug', 'cat'],
    sounds: s.sounds,
  })
  await advance(CRITTERS_OPEN_DELAY_MS + 20)
  for (const letter of ['r', 'a', 't'])
    await activate(byId(`critter-${letter}`))
  let t = 0
  while (!has('critter-picture-rat') && t < 20_000) {
    await advance(10)
    t += 10
  }
  expect(has('critter-picture-rat')).toBe(true)
  expect(g.lines.at(-1)).toBe('guide.play.critters.word.rat')
  await advance(PICTURE_HOLD_MS + 300 - 20)
  expect(has('critter-picture')).toBe(true)
  await advance(30)
  expect(has('critter-picture')).toBe(false)
  await advance(SHELF_HOLD_MS)
  expect(screen.queryAllByTestId(/^critter-fade-\d$/)).toHaveLength(3)
  expect(screen.queryAllByTestId(/^critter-drop-\d$/)).toHaveLength(0)
})
