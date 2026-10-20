/**
 * The play door on the Map (mini-game spec `design/native/mini-game-flower-bed.md`
 * § 1.2; N2, N3): the Number Garden Map shows it exactly when a game is open
 * for the learner, decided once at mount; a tap follows the Map's stop
 * rules (armed after 400 ms, held through an unlock beat until the cheer,
 * ignored under the launch lock), cuts the line in flight and asks App for
 * the game once, ~200 ms after the release. The line player and effects
 * are fakes.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import type { GameId } from '@marian/core/games/miniGames'
import {
  defaultProgress,
  getSettings,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler, PixelRatio } from 'react-native'
import { pathArtAsset } from '../../assets'
import type { Sfx } from '../../audio'
import { mapScreenLayout } from '../../layout/mapScreenLayout'
import type { MapLinePlayer } from './mapAudio'
import { MapScreen } from './MapScreen'
import { LAUNCH_DELAY_MS, MAP_TAP_ARM_MS } from './useMapVisit'

const P = mapScreenLayout({
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})

function fakePlayer() {
  const player = {
    play: jest.fn<Promise<void>, [PathLine]>(() => new Promise<void>(() => {})),
    cancel: jest.fn(),
    unload: jest.fn(),
  } satisfies MapLinePlayer
  return player
}

function fakeSfx() {
  return jest.fn(
    (): Sfx => ({
      play: jest.fn(() => true),
      unload: jest.fn(),
      missedPlays: 0,
      loadFailed: false,
    }),
  )
}

/** sub-to-20 mastered since the marker was seeded: land 3 opens (a beat). */
function landUnlockDoc(): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'intro',
    },
    unlocksCelebrated: [...seedUnlocksCelebrated(base), 'add-to-20'],
    parentSettings: { ...getSettings(base), showLevelToMarian: true },
  }
}

async function mount(doc: Progress | null, world: MasteryTrack = 'math') {
  const player = fakePlayer()
  const onGame = jest.fn<boolean, [GameId]>(() => true)
  const onHome = jest.fn()
  // The current stop's session: `true` once the route changed.
  const onPlay = jest.fn(() => true)
  const readProgress = jest.fn(() => doc)
  await render(
    <MapScreen
      layout={P}
      world={world}
      onHome={onHome}
      onGame={onGame}
      onPlay={onPlay}
      readProgress={readProgress}
      createPlayer={() => player}
      createSfx={fakeSfx()}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
      wallClock={() => 42}
    />,
  )
  return { player, onGame, onHome, onPlay, readProgress }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const door = () => screen.getByTestId('map-game-door')
const tapDoor = () => fireEvent.press(door())

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

describe('N2: the door shows exactly when a game is open', () => {
  it('adding to ten current: the Number Garden Map shows the door', async () => {
    await mount(progressAtStep('add-to-10'))
    expect(door()).toBeOnTheScreen()
    expect(door().props.accessibilityRole).toBe('button')
    expect(door().props.accessibilityLabel).toBe('Fill the flower bed')
  })

  it('adding to ten mastered (adding to twenty current): still there', async () => {
    await mount(progressAtStep('add-to-20'))
    expect(door()).toBeOnTheScreen()
  })

  it('numbers not mastered yet: no door', async () => {
    await mount(progressAtStep('number-recog'))
    expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
  })

  it('no progress: no door', async () => {
    await mount(null)
    expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
  })

  it('the Word Song Map never shows one', async () => {
    await mount(progressAtStep('add-to-20'), 'word-song')
    expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
  })

  it('decided once at mount, from the same read as the visit', async () => {
    const h = await mount(progressAtStep('add-to-10'))
    expect(h.readProgress).toHaveBeenCalledTimes(1)
    await advance(5000)
    expect(door()).toBeOnTheScreen()
    expect(h.readProgress).toHaveBeenCalledTimes(1)
  })

  it('sits at the layout’s door rect, holding the ui-flower-bed clay piece at Math.round(68 × k) pt, no FlowerBed and no text', async () => {
    await mount(progressAtStep('add-to-10'))
    expect(door()).toHaveStyle({
      left: P.door.x,
      top: P.door.y,
      width: P.door.width,
      height: P.door.height,
    })
    // § 1.2.1 (T6, Thomas's pick): drawn as Home draws its house.
    const HIDDEN = { includeHiddenElements: true }
    const art = screen.getByTestId('map-game-door-art', HIDDEN)
    const px = Math.round(68 * P.homeScale)
    expect(art).toHaveStyle({ width: px, height: px })
    // expo-image hands its host the source as a list.
    expect(art.props.source).toEqual([
      pathArtAsset('ui-flower-bed', px * PixelRatio.get() > 256 ? 512 : 256),
    ])
    expect(
      screen.queryAllByTestId(/^map-game-door-(flower|slot|hole)/, HIDDEN),
    ).toHaveLength(0)
    expect(screen.queryByText(/flower/i)).not.toBeOnTheScreen()
  })
})

describe('N3: a door tap follows the Map’s stop rules', () => {
  it('ignored within MAP_TAP_ARM_MS of mount', async () => {
    const h = await mount(progressAtStep('add-to-10'))
    await advance(MAP_TAP_ARM_MS - 1)
    await tapDoor()
    await advance(LAUNCH_DELAY_MS + 100)
    expect(h.onGame).not.toHaveBeenCalled()
  })

  it('an armed tap cuts the line and asks App once, LAUNCH_DELAY_MS after the release', async () => {
    const h = await mount(progressAtStep('add-to-10'))
    await advance(MAP_TAP_ARM_MS)
    expect(h.player.play).toHaveBeenCalledTimes(1)
    await tapDoor()
    expect(h.player.cancel).toHaveBeenCalled()
    await advance(LAUNCH_DELAY_MS - 1)
    expect(h.onGame).not.toHaveBeenCalled()
    await advance(1)
    expect(h.onGame.mock.calls).toEqual([['flower-bed']])
    // No Map line names the game.
    expect(h.player.play).toHaveBeenCalledTimes(1)
  })

  it('the launch lock: door, stop, Home and Android back taps change nothing', async () => {
    const back = jest.spyOn(BackHandler, 'addEventListener')
    const h = await mount(progressAtStep('add-to-10'))
    const androidBack = back.mock.calls.at(-1)![1] as () => boolean
    back.mockRestore()
    await advance(MAP_TAP_ARM_MS)
    await tapDoor()
    await tapDoor()
    await fireEvent.press(screen.getByTestId('map-stop-number-recog'))
    await fireEvent.press(screen.getByTestId('map-home'))
    await act(async () => {
      expect(androidBack()).toBe(true)
    })
    await advance(2000)
    expect(h.onGame).toHaveBeenCalledTimes(1)
    expect(h.onHome).not.toHaveBeenCalled()
  })

  it('a stop launch locks the door too', async () => {
    const h = await mount(progressAtStep('add-to-10'))
    await advance(MAP_TAP_ARM_MS)
    await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
    await tapDoor()
    await advance(2000)
    expect(h.onPlay).toHaveBeenCalledTimes(1)
    expect(h.onGame).not.toHaveBeenCalled()
  })

  it('held until the unlock beat’s cheer', async () => {
    const h = await mount(landUnlockDoc())
    await advance(1000)
    await tapDoor()
    await advance(LAUNCH_DELAY_MS)
    expect(h.onGame).not.toHaveBeenCalled()
    await advance(1100) // 2100: Emma's line
    await tapDoor()
    await advance(LAUNCH_DELAY_MS)
    expect(h.onGame.mock.calls).toEqual([['flower-bed']])
  })

  it('when App does not open the game, the lock lifts and Home works', async () => {
    const h = await mount(progressAtStep('add-to-10'))
    h.onGame.mockReturnValueOnce(false)
    await advance(MAP_TAP_ARM_MS)
    await tapDoor()
    await advance(LAUNCH_DELAY_MS)
    expect(h.onGame).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByTestId('map-home'))
    expect(h.onHome).toHaveBeenCalledTimes(1)
  })
})
