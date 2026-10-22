/**
 * The Play place (play-place spec §§ 1.3-1.5, AC N4): one tile per open
 * game at § 1.3's rects (one game: centred), the Home disc at the Map's
 * Home rect; from the Hub Emma says "What shall we play?", back from a
 * game nothing; a tile plinks, cuts the line and picks its game ~200 ms
 * after the release; Home (or Android back) goes to the Hub.
 */
import { setKeyValueStore } from '@marian/core'
import {
  defaultProgress,
  saveProgress,
  type Progress,
} from '@marian/core/progress'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import { playPlaceLayout } from '../../layout/playPlaceLayout'
import { PlayPlace, PLAY_OPEN_DELAY_MS, PLAY_PICK_MS } from './PlayPlace'
import type { PlayLinePlayer } from './playLines'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const P = playPlaceLayout({ width: 375, height: 667, insets: NO_INSETS })

function fakePlayer(): PlayLinePlayer {
  return {
    playLine: jest.fn(() => new Promise<void>(() => {})),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
}

function seed(levels: Partial<Progress['skillLevels']> = {}) {
  const p = defaultProgress()
  saveProgress({ ...p, skillLevels: { ...p.skillLevels, ...levels } })
}

async function mount(quiet = false) {
  const h = {
    onHome: jest.fn(),
    onPickGame: jest.fn(),
    plink: jest.fn(),
    player: fakePlayer(),
  }
  await render(<PlayPlace layout={P} quiet={quiet} {...h} />)
  await act(async () => {})
  return h
}

const rectOf = (id: string) => {
  const s = screen.getByTestId(id).props.style
  const flat = Object.assign({}, ...[s].flat(3).filter(Boolean))
  return { x: flat.left, y: flat.top, width: flat.width, height: flat.height }
}

beforeEach(() => {
  jest.useFakeTimers()
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
})
afterEach(() => jest.useRealTimers())

it('N4: one open game, one tile, centred; Home at the Map’s Home rect', async () => {
  // On numbers: the raft is not open yet, the critters always are.
  seed({ 'number-recog': 'practicing', 'add-to-10': 'locked' })
  await mount()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(1)
  expect(rectOf('play-tile-critters')).toEqual(P.single)
  expect(rectOf('play-home')).toEqual(P.home)
  expect(screen.getByTestId('play-home').props.accessibilityLabel).toBe('Home')
  expect(
    screen.getByTestId('play-tile-critters').props.accessibilityLabel,
  ).toBe('Letter critters')
  expect(screen.getAllByTestId('play-tile-critters-art')).toHaveLength(1)
})

it('N4 (Thomas 2026-10-22): a learner on letter names and adding to ten has both tiles', async () => {
  seed({
    'letter-names': 'practicing',
    'letter-sounds': 'locked',
    'blending-cv': 'locked',
  })
  await mount()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(2)
  expect(rectOf('play-tile-raft')).toEqual(P.tiles[0])
  expect(rectOf('play-tile-critters')).toEqual(P.tiles[1])
})

it('N4: two open games, a tile per card column, in tile order', async () => {
  seed({ 'letter-sounds': 'mastered' })
  await mount()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(2)
  expect(rectOf('play-tile-raft')).toEqual(P.tiles[0])
  expect(rectOf('play-tile-critters')).toEqual(P.tiles[1])
  expect(
    screen.getByTestId('play-tile-critters').props.accessibilityLabel,
  ).toBe('Letter critters')
})

it('N4: from the Hub, Emma says the open line after the fade-in, once', async () => {
  seed()
  const h = await mount(false)
  await act(async () => {
    jest.advanceTimersByTime(PLAY_OPEN_DELAY_MS - 1)
  })
  expect(h.player.playLine).not.toHaveBeenCalled()
  await act(async () => {
    jest.advanceTimersByTime(1)
  })
  expect(h.player.playLine).toHaveBeenCalledTimes(1)
  expect((h.player.playLine as jest.Mock).mock.calls[0]![0]).toBe(
    'guide.play.open',
  )
})

it('N4: back from a game, nothing is said', async () => {
  seed()
  const h = await mount(true)
  await act(async () => {
    jest.advanceTimersByTime(10_000)
  })
  expect(h.player.playLine).not.toHaveBeenCalled()
})

it('§ 1.4: a tile plinks, cuts the line, and picks its game 200 ms later, once', async () => {
  seed()
  const h = await mount()
  await fireEvent.press(screen.getByTestId('play-tile-raft'))
  await fireEvent.press(screen.getByTestId('play-tile-raft'))
  expect(h.plink).toHaveBeenCalledTimes(1)
  expect(h.player.cancelActive).toHaveBeenCalled()
  expect(h.onPickGame).not.toHaveBeenCalled()
  await act(async () => {
    jest.advanceTimersByTime(PLAY_PICK_MS)
  })
  expect(h.onPickGame).toHaveBeenCalledTimes(1)
  expect(h.onPickGame).toHaveBeenCalledWith('raft')
  // A tap during the pick's wait opens nothing else.
  await fireEvent.press(screen.getByTestId('play-home'))
  expect(h.onHome).not.toHaveBeenCalled()
})

it('§ 1.4: Home, or Android back, goes to the Hub', async () => {
  seed()
  const add = jest.spyOn(BackHandler, 'addEventListener')
  const h = await mount()
  const back = add.mock.calls.find(
    ([e]) => e === 'hardwareBackPress',
  )![1] as unknown as () => boolean | null | undefined
  let handled: boolean | null | undefined
  await act(async () => {
    handled = back()
  })
  expect(handled).toBe(true)
  expect(h.onHome).toHaveBeenCalledTimes(1)
  expect(h.player.cancelActive).toHaveBeenCalled()
  add.mockRestore()
})

it('§ 1.4: the Home disc goes to the Hub', async () => {
  seed()
  const h = await mount()
  await fireEvent.press(screen.getByTestId('play-home'))
  expect(h.onHome).toHaveBeenCalledTimes(1)
})

it('§ 1.5: a visit writes nothing', async () => {
  seed()
  const writes: string[] = []
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k)
      map.set(k, v)
    },
    removeItem: (k) => {
      writes.push(k)
      map.delete(k)
    },
  })
  saveProgress(defaultProgress())
  writes.length = 0
  await mount()
  await fireEvent.press(screen.getByTestId('play-tile-raft'))
  await act(async () => {
    jest.advanceTimersByTime(1_000)
  })
  expect(writes).toEqual([])
})
