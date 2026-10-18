/**
 * The native map against design/native/map-native.md's acceptance list:
 * the open line at mount with no tap, every tap speaks (a locked stop
 * poofs, wiggles and tilts Emma; a deferred line is caption-only), the
 * unlock beat's timeline (one seen-marker write, taps wait, phone
 * landscape doesn't scroll until Emma speaks), Home / Android back at any
 * time, the 44 pt hit areas, and the release on unmount. The line player
 * and the effects are fakes; no audio plays.
 */
import { setKeyValueStore } from '@marian/core'
import { pathLine, type PathLine } from '@marian/core/emmasPath/pathLines'
import {
  defaultProgress,
  getSettings,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import type { Sfx } from '../../audio'
import { mapScreenLayout, MAP_MIN_HIT } from '../../layout/mapScreenLayout'
import type { MapLinePlayer } from './mapAudio'
import { MapScreen } from './MapScreen'
import { MAP_TAP_ARM_MS } from './useMapVisit'

const P = mapScreenLayout({
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})
const L = mapScreenLayout({
  width: 667,
  height: 375,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
})

/** sub-to-20 mastered since the marker was seeded: land 3 opened. */
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

function fakePlayer() {
  const ends: (() => void)[] = []
  const player = {
    play: jest.fn<Promise<void>, [PathLine]>(
      () => new Promise<void>((end) => void ends.push(end)),
    ),
    cancel: jest.fn(),
    unload: jest.fn(),
  } satisfies MapLinePlayer
  const ids = () => player.play.mock.calls.map(([l]) => l.id)
  return { player, ids, endLast: () => ends.at(-1)?.() }
}

function fakeSfx() {
  const made: {
    src: string
    volume: number
    sfx: Sfx & { play: jest.Mock; unload: jest.Mock }
  }[] = []
  const create = jest.fn((effect: { src: string; volume: number }) => {
    const sfx = {
      play: jest.fn(() => true),
      unload: jest.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    made.push({ ...effect, sfx })
    return sfx
  })
  const played = () =>
    made.flatMap((m) => m.sfx.play.mock.calls.map(() => m.src))
  return { create, made, played }
}

async function mount(
  doc: Progress | null,
  opts: { layout?: typeof P; world?: MasteryTrack } = {},
) {
  const { player, ids, endLast } = fakePlayer()
  const sfx = fakeSfx()
  const markUnlockCelebrated = jest.fn()
  const markLeft = jest.fn()
  const onHome = jest.fn()
  const utils = await render(
    <MapScreen
      layout={opts.layout ?? P}
      world={opts.world ?? 'math'}
      onHome={onHome}
      readProgress={() => doc}
      createPlayer={() => player}
      createSfx={sfx.create}
      markUnlockCelebrated={markUnlockCelebrated}
      markLeft={markLeft}
      wallClock={() => 42}
    />,
  )
  return {
    player,
    ids,
    endLast,
    sfx,
    markUnlockCelebrated,
    markLeft,
    onHome,
    ...utils,
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const caption = () => screen.getByTestId('map-caption').props.children

beforeEach(() => {
  jest.useFakeTimers()
  const store = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  })
})

afterEach(() => {
  jest.useRealTimers()
})

it('opens on the open line at mount, whole, with no tap and no write', async () => {
  const h = await mount(defaultProgress())
  expect(h.ids()).toEqual(['path.open.add-to-10'])
  expect(caption()).toBe(pathLine('path.open.add-to-10')!.text)
  expect(screen.getByTestId('map-math-beat-none')).toBeOnTheScreen()
  expect(screen.getByTestId('map-path-fits')).toBeOnTheScreen()
  expect(screen.getByTestId('map-emma-at-add-to-10')).toBeOnTheScreen()
  expect(h.markUnlockCelebrated).not.toHaveBeenCalled()
})

it('taps speak: a stop its name, a gate its land; a deferred line is caption-only', async () => {
  const h = await mount(defaultProgress())
  await advance(MAP_TAP_ARM_MS)
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  await fireEvent.press(screen.getByTestId('map-gate-2'))
  // mult-6-9 is two steps away: its "later" line is deferred (no MP3).
  await fireEvent.press(screen.getByTestId('map-stop-mult-6-9'))
  expect(h.ids()).toEqual([
    'path.open.add-to-10',
    'path.stop.add-to-10',
    'path.land.math.2',
    'path.locked.later.mult-6-9.add-to-10',
  ])
  expect(h.player.play.mock.calls.at(-1)![0].src).toBeNull()
  expect(caption()).toBe(pathLine('path.locked.later.mult-6-9.add-to-10')!.text)
})

it('a locked stop poofs (0.45), wiggles, tilts Emma for 1.5 s and says what opens it', async () => {
  const h = await mount(defaultProgress())
  await advance(MAP_TAP_ARM_MS)
  await fireEvent.press(screen.getByTestId('map-stop-add-to-20'))
  expect(h.sfx.made.map(({ src, volume }) => [src, volume])).toEqual([
    ['/assets/sfx-poof.mp3', 0.45],
  ])
  expect(h.sfx.played()).toEqual(['/assets/sfx-poof.mp3'])
  expect(h.ids().at(-1)).toBe('path.locked.next.add-to-20')
  expect(screen.getByTestId('map-emma-attentive-pointing')).toBeOnTheScreen()
  await advance(1499)
  expect(screen.getByTestId('map-emma-attentive-pointing')).toBeOnTheScreen()
  await advance(1)
  expect(screen.getByTestId('map-emma-idle')).toBeOnTheScreen()
  // An open stop's tap makes no sound effect.
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.sfx.played()).toEqual(['/assets/sfx-poof.mp3'])
})

it('the land beat: one marker write at mount, 0 / 400 / 1100 / 1500 / 2100 ms, taps wait for her line', async () => {
  const h = await mount(landUnlockDoc())
  expect(screen.getByTestId('map-math-beat-land')).toBeOnTheScreen()
  expect(h.markUnlockCelebrated.mock.calls).toEqual([['math']])
  // Chime and cheer are loaded at mount, silent until their beat.
  expect(h.sfx.made.map((m) => m.src)).toEqual([
    '/assets/sfx-chime-soft.mp3',
    '/assets/sfx-cheer.mp3',
  ])
  expect(h.ids()).toEqual([])
  expect(screen.queryByTestId('map-ribbon')).toBeNull()
  expect(screen.getByTestId('map-emma-at-sub-to-20')).toBeOnTheScreen()
  const newStop = () =>
    within(screen.getByTestId('map-stop-two-digit-addsub-no-regroup'))
  expect(newStop().getByTestId('map-stop-state-locked')).toBeOnTheScreen()

  await advance(400)
  expect(
    screen.getByTestId('map-emma-at-two-digit-addsub-no-regroup'),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.ids()).toEqual([])

  await advance(700) // 1100: padlock pop + chime
  expect(screen.getByTestId('map-padlock-pop')).toBeOnTheScreen()
  expect(newStop().getByTestId('map-stop-state-current')).toBeOnTheScreen()
  expect(h.sfx.played()).toEqual(['/assets/sfx-chime-soft.mp3'])
  // Land 3's gate (land 5's stays closed too, content wave 3).
  expect(
    within(screen.getByTestId('map-gate-3')).getByTestId('map-gate-closed'),
  ).toBeOnTheScreen()

  await advance(400) // 1500: gate swings + cheer
  expect(screen.getByTestId('map-gate-swing')).toBeOnTheScreen()
  expect(h.sfx.played()).toEqual([
    '/assets/sfx-chime-soft.mp3',
    '/assets/sfx-cheer.mp3',
  ])
  expect(h.ids()).toEqual([])

  await advance(600) // 2100: Emma cheers and names the land
  expect(h.ids()).toEqual(['end.land.math.3'])
  expect(caption()).toBe('A new land! Land 3: Big numbers!')
  expect(screen.getByTestId('map-emma-cheering')).toBeOnTheScreen()
  await act(async () => h.endLast())
  expect(screen.getByTestId('map-emma-idle')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.ids()).toEqual(['end.land.math.3', 'path.stop.add-to-10'])
  expect(h.markUnlockCelebrated).toHaveBeenCalledTimes(1)
})

it('phone landscape: the pane scrolls, but not until the beat reaches her line', async () => {
  await mount(landUnlockDoc(), { layout: L })
  expect(screen.getByTestId('map-path-scrolls')).toBeOnTheScreen()
  expect(screen.queryByTestId('map-title')).toBeNull()
  expect(screen.getByTestId('map-path').props.scrollEnabled).toBe(false)
  await advance(2100)
  expect(screen.getByTestId('map-path').props.scrollEnabled).toBe(true)
})

it('Home works mid-beat: the line stops and the Hub clock is stamped before the route flips', async () => {
  const h = await mount(landUnlockDoc())
  await advance(500)
  await fireEvent.press(screen.getByTestId('map-home'))
  await fireEvent.press(screen.getByTestId('map-home'))
  expect(h.onHome).toHaveBeenCalledTimes(1)
  expect(h.player.cancel).toHaveBeenCalled()
  expect(h.markLeft).toHaveBeenCalledWith(42)
  expect(h.markLeft.mock.invocationCallOrder[0]).toBeLessThan(
    h.onHome.mock.invocationCallOrder[0]!,
  )
})

it('Android back = Home', async () => {
  const add = jest.spyOn(BackHandler, 'addEventListener')
  const h = await mount(defaultProgress())
  const handler = add.mock.calls.at(-1)![1] as () => boolean
  expect(handler()).toBe(true)
  expect(h.onHome).toHaveBeenCalledTimes(1)
  add.mockRestore()
})

it('every stop and gate hit area is at least 44 pt at the phone floor; the current tray is inside its stop', async () => {
  await mount(defaultProgress(), { world: 'word-song' })
  const targets = screen
    .getAllByRole('button')
    .filter((b) => b.props.testID !== 'map-home')
  expect(targets.length).toBeGreaterThan(10)
  for (const t of targets) {
    const { width, height } = Object.assign({}, ...[t.props.style].flat(3))
    const slop = t.props.hitSlop
    const h =
      typeof slop === 'number'
        ? { left: slop, right: slop, top: slop, bottom: slop }
        : slop
    expect(width + h.left + h.right).toBeGreaterThanOrEqual(MAP_MIN_HIT - 0.001)
    expect(height + h.top + h.bottom).toBeGreaterThanOrEqual(
      MAP_MIN_HIT - 0.001,
    )
  }
  // The current stop's tray hangs below its box: the bottom slop reaches
  // the tray's bottom edge.
  const current = targets.find(
    (t) => within(t).queryByTestId('map-buds') !== null,
  )!
  const tray = Object.assign(
    {},
    ...[within(current).getByTestId('map-buds').props.style].flat(3),
  )
  const box = Object.assign({}, ...[current.props.style].flat(3))
  const holes = within(current).getAllByTestId(/^map-bud(-open)?$/)
  expect(holes.length).toBeGreaterThan(0)
  const hole = Object.assign({}, ...[holes[0]!.props.style].flat(3)).height
  const trayBottom = tray.top + hole + 2 * tray.paddingVertical
  expect(box.height + current.props.hitSlop.bottom).toBeCloseTo(trayBottom, 3)
})

it('unmount releases the player and the effects, and stamps the Hub clock', async () => {
  const h = await mount(landUnlockDoc())
  await advance(1100)
  await h.unmount()
  expect(h.player.unload).toHaveBeenCalledTimes(1)
  for (const m of h.sfx.made) expect(m.sfx.unload).toHaveBeenCalledTimes(1)
  expect(h.markLeft).toHaveBeenCalledWith(42)
})
