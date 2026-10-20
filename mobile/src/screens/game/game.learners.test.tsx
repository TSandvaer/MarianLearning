/**
 * Mini-games per learner (mini-game spec § 1.1, § 1.5; N15): over the real
 * learner-scoped store (`@marian/core/learners`, PR #622), learner A on
 * adding to ten sees the door on her Number Garden Map and learner B on
 * numbers does not; a whole round as A writes no key of either learner.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  activateLearner,
  activeLearner,
  addLearner,
  ensureLearnerList,
  resetLearnersForTests,
  type LearnerEntry,
} from '@marian/core/learners'
import { STORAGE_KEY } from '@marian/core/progress'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Sfx } from '../../audio'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import { mapScreenLayout } from '../../layout/mapScreenLayout'
import { mathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import type { MapLinePlayer } from '../map/mapAudio'
import { MapScreen } from '../map/MapScreen'
import type { GameLinePlayer } from './gameLines'
import { GameScreen } from './GameScreen'

const VIEWPORT = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

class CountingStore {
  readonly data = new Map<string, string>()
  readonly writes: string[] = []
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.writes.push(key)
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.writes.push(key)
    this.data.delete(key)
  }
}

const sfx = (): Sfx => ({
  play: jest.fn(() => true),
  unload: jest.fn(),
  missedPlays: 0,
  loadFailed: false,
})

const mapPlayer = (): MapLinePlayer => ({
  play: jest.fn<Promise<void>, [PathLine]>(() => Promise.resolve()),
  cancel: jest.fn(),
  unload: jest.fn(),
})

/** Every line starts and ends at once. */
const instantLines = (): GameLinePlayer => ({
  playLine: (_id, opts = {}) => {
    opts.onPlay?.()
    opts.onWordTick?.(0)
    return Promise.resolve()
  },
  cancelActive: jest.fn(),
  unload: jest.fn(),
})

const VISIBLE: AppVisibility = {
  getIsHidden: () => false,
  subscribe: () => () => {},
}

async function settle(ms: number) {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(50)
      for (let i = 0; i < 6; i++) await Promise.resolve()
    })
  }
}

let store: CountingStore
let a: LearnerEntry
let b: LearnerEntry

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  store = new CountingStore()
  // Learner A: today's child, on adding to ten.
  store.data.set(STORAGE_KEY, JSON.stringify(progressAtStep('add-to-10')))
  setKeyValueStore(store)
  ensureLearnerList()
  a = activeLearner()!
  // Learner B starts on land 1: numbers, not yet mastered.
  b = addLearner({
    name: 'Sam',
    avatarId: 'owl',
    start: { math: 1, wordSong: 1 },
  })
  activateLearner(a.id)
})
afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

async function mapAs(learner: LearnerEntry) {
  activateLearner(learner.id)
  const view = await render(
    <MapScreen
      layout={mapScreenLayout(VIEWPORT)}
      world="math"
      onHome={jest.fn()}
      onGame={jest.fn(() => true)}
      createPlayer={mapPlayer}
      createSfx={sfx}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
    />,
  )
  const door = screen.queryByTestId('map-game-door') !== null
  await act(async () => {
    await view.unmount()
  })
  return door
}

it('N15: A (adding to ten) has the door on her Number Garden Map; B (numbers) does not', async () => {
  expect(await mapAs(a)).toBe(true)
  expect(await mapAs(b)).toBe(false)
  expect(await mapAs(a)).toBe(true)
})

it('N15: a whole round as A writes no key of either learner', async () => {
  activateLearner(a.id)
  const before = new Map(store.data)
  const writes = store.writes.length
  const onExit = jest.fn()
  await render(
    <GameScreen
      layout={mathLayout(VIEWPORT)}
      game="flower-bed"
      onExit={onExit}
      linePlayer={instantLines()}
      sfx={{ sparkle: sfx(), plink: sfx(), poof: sfx() }}
      visibility={VISIBLE}
    />,
  )
  const chipsOpen = () =>
    screen
      .queryAllByTestId(/^math-chip-\d+$/)
      .some((c) => c.props.accessibilityState?.disabled === false)
  for (let k = 0; k < 6; k++) {
    for (let t = 0; t < 5000 && !chipsOpen(); t += 50) await settle(50)
    const given = screen.getAllByTestId('game-bed-flower', HIDDEN).length
    await fireEvent.press(screen.getByTestId(`math-chip-${10 - given}`))
  }
  await settle(3000)
  expect(onExit).toHaveBeenCalledTimes(1)
  expect(store.writes.length).toBe(writes)
  expect(new Map(store.data)).toEqual(before)
})
