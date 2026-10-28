/**
 * The Play place per learner (play-place § 1.5, AC N16), over the real
 * learner-scoped store: learner A on adding to ten and letter sounds sees
 * the Play disc and both games; learner B on numbers and letter names sees
 * the Play disc and the critters only (Thomas 2026-10-22); a visit as A
 * (the place and a raft trip's first crossing) writes only A's island key,
 * once per new kind (raft-island-goal I7).
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
import { RAFT_ISLAND_STORAGE_KEY } from '@marian/core/games/raftIsland'
import { STORAGE_KEY } from '@marian/core/progress'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { advance, byId, mountGame, tap } from '../../../test/playHarness'
import { hubLayout } from '../../layout/hubLayout'
import { playPlaceLayout } from '../../layout/playPlaceLayout'
import { Hub } from '../hub/Hub'
import { resetHubAudioForTests, type GuidancePlayer } from '../hub/hubAudio'
import { PlayPlace } from './PlayPlace'
import type { PlayLinePlayer } from './playLines'

const VIEWPORT = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

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

const silent = (): GuidancePlayer & PlayLinePlayer => ({
  playLine: jest.fn(() => Promise.resolve()),
  cancelActive: jest.fn(),
  unload: jest.fn(),
})

let store: CountingStore
let a: LearnerEntry
let b: LearnerEntry

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  resetHubAudioForTests()
  store = new CountingStore()
  store.data.set(STORAGE_KEY, JSON.stringify(progressAtStep('add-to-10')))
  setKeyValueStore(store)
  ensureLearnerList()
  a = activeLearner()!
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

async function hubAs(learner: LearnerEntry) {
  activateLearner(learner.id)
  await render(
    <Hub
      layout={hubLayout(VIEWPORT)}
      onPickTree={jest.fn()}
      onOpenMap={jest.fn()}
      onParentLongPress={jest.fn()}
      onOpenPlay={jest.fn()}
      player={silent()}
      plink={jest.fn()}
      clock={() => new Date(2026, 9, 20, 15)}
      wallClock={() => 1_000_000}
    />,
  )
  await act(async () => {})
}

it('N16: A sees the Play disc', async () => {
  await hubAs(a)
  expect(screen.getByTestId('hub-play')).toBeOnTheScreen()
})

async function placeAs(learner: LearnerEntry) {
  activateLearner(learner.id)
  await render(
    <PlayPlace
      layout={playPlaceLayout(VIEWPORT)}
      quiet
      onHome={jest.fn()}
      onPickGame={jest.fn()}
      player={silent()}
      plink={jest.fn()}
    />,
  )
}

const tiles = () =>
  screen
    .getAllByTestId(/^play-tile-(raft|critters)$/)
    .map((el) => el.props.testID)

it('N16: A’s Play place has both games', async () => {
  await placeAs(a)
  expect(tiles()).toEqual(['play-tile-raft', 'play-tile-critters'])
})

it('N16 (Thomas 2026-10-22): B sees the Play disc', async () => {
  await hubAs(b)
  expect(screen.getByTestId('hub-play')).toBeOnTheScreen()
})

it('N16 (Thomas 2026-10-22): B’s Play place has the critters only', async () => {
  await placeAs(b)
  expect(tiles()).toEqual(['play-tile-critters'])
})

it('N16, I7: a visit as A writes only A’s island key, once per new kind', async () => {
  activateLearner(a.id)
  const before = store.writes.length
  await render(
    <PlayPlace
      layout={playPlaceLayout(VIEWPORT)}
      quiet={false}
      onHome={jest.fn()}
      onPickGame={jest.fn()}
      player={silent()}
      plink={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByTestId('play-tile-raft'))
  await advance(1000)
  screen.unmount()
  await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
  await tap(byId('raft-animal-0'))
  await tap(byId('raft-animal-1'))
  await advance(10_000)
  // The dog (7) and the hen (3) fill their homes: one write each.
  expect(store.writes.slice(before)).toEqual([
    RAFT_ISLAND_STORAGE_KEY,
    RAFT_ISLAND_STORAGE_KEY,
  ])
  expect(JSON.parse(store.data.get(RAFT_ISLAND_STORAGE_KEY)!)).toEqual({
    10: [3, 7],
    20: [],
  })
})
