/**
 * The play door is gone (`design/native/flower-bed-into-add-to-10.md` § 6,
 * N10): the flower bed moved into adding to ten, so no Map shows a door,
 * whatever the progress. The line player and the effects are fakes.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import {
  defaultProgress,
  MATH_TREE,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import { render, screen } from '@testing-library/react-native'
import type { Sfx } from '../../audio'
import { mapScreenLayout } from '../../layout/mapScreenLayout'
import type { MapLinePlayer } from './mapAudio'
import { MapScreen } from './MapScreen'

const P = mapScreenLayout({
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})

async function mount(doc: Progress | null, world: MasteryTrack = 'math') {
  const player = {
    play: jest.fn<Promise<void>, [PathLine]>(() => new Promise<void>(() => {})),
    cancel: jest.fn(),
    unload: jest.fn(),
  } satisfies MapLinePlayer
  await render(
    <MapScreen
      layout={P}
      world={world}
      onHome={jest.fn()}
      onPlay={jest.fn(() => true)}
      readProgress={() => doc}
      createPlayer={() => player}
      createSfx={jest.fn(
        (): Sfx => ({
          play: jest.fn(() => true),
          unload: jest.fn(),
          missedPlays: 0,
          loadFailed: false,
        }),
      )}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
      wallClock={() => 42}
    />,
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  const store = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  })
})
afterEach(() => jest.useRealTimers())

describe('N10: no Map shows a play door', () => {
  it.each(MATH_TREE.map((n) => [n]))(
    'the Number Garden Map at %s',
    async (step) => {
      await mount(progressAtStep(step))
      expect(screen.getByTestId('map')).toBeOnTheScreen()
      expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
    },
  )

  it('a fresh doc, no doc, and the Word Song Map', async () => {
    for (const [doc, world] of [
      [defaultProgress(), 'math'],
      [null, 'math'],
      [progressAtStep('add-to-20'), 'word-song'],
    ] as const) {
      await mount(doc, world)
      expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
    }
  })
})
