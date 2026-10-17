/**
 * Map tap-to-play, the map half (native spec
 * `design/native/map-tap-to-play.md` §§ 1, 2, 5; AC 3–5): the current stop
 * asks App for the Hub card's session and a mastered stop for a replay,
 * both on release and ~200 ms later; the launch lock holds every stop, gate
 * and Home tap until the route changes; a replay that fails says the
 * stop's name and taps resume; a stop tap within 400 ms of mount, or
 * before the unlock beat's cheer, is ignored. Later stops still peek and
 * gates still say their land. The line player and effects are fakes.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import {
  defaultProgress,
  getSettings,
  type Progress,
  type SkillNode,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
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
  const ids = () => player.play.mock.calls.map(([l]) => l.id)
  return { player, ids }
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

/** A request the test settles by hand (a replay or a peek). */
function fakeRequest() {
  const calls: {
    node: SkillNode
    signal: AbortSignal
    settle: (opened: boolean) => void
  }[] = []
  const fn = jest.fn(
    (node: SkillNode, signal: AbortSignal) =>
      new Promise<boolean>((settle) => {
        calls.push({ node, signal, settle })
      }),
  )
  return { fn, calls }
}

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

async function mount(doc: Progress) {
  const { player, ids } = fakePlayer()
  const onPlay = jest.fn()
  const replay = fakeRequest()
  const peek = fakeRequest()
  const onHome = jest.fn()
  await render(
    <MapScreen
      layout={P}
      world="math"
      onHome={onHome}
      onPlay={onPlay}
      onReplay={replay.fn}
      onPeek={peek.fn}
      readProgress={() => doc}
      createPlayer={() => player}
      createSfx={fakeSfx()}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
      wallClock={() => 42}
    />,
  )
  return { player, ids, onPlay, replay, peek, onHome }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const settle = async (call: { settle: (b: boolean) => void }, ok: boolean) => {
  await act(async () => {
    call.settle(ok)
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

const tap = (node: string) =>
  fireEvent.press(screen.getByTestId(`map-stop-${node}`))

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

it('the timings of § 2 and § 5', () => {
  expect(LAUNCH_DELAY_MS).toBe(200)
  expect(MAP_TAP_ARM_MS).toBe(400)
})

it('AC 1: the current stop cuts the line, pops, and ~200 ms after the release asks App for its session', async () => {
  const h = await mount(progressAtStep('add-to-20'))
  await advance(MAP_TAP_ARM_MS)
  expect(h.ids()).toEqual(['path.open.add-to-20'])
  await tap('add-to-20')
  expect(h.player.cancel).toHaveBeenCalled()
  expect(screen.getByTestId('map-stop-launching-add-to-20')).toBeOnTheScreen()
  await advance(LAUNCH_DELAY_MS - 1)
  expect(h.onPlay).not.toHaveBeenCalled()
  await advance(1)
  expect(h.onPlay.mock.calls).toEqual([['add-to-20']])
  // No map line: the session opens as from the Hub.
  expect(h.ids()).toEqual(['path.open.add-to-20'])
  expect(h.replay.fn).not.toHaveBeenCalled()
  expect(h.peek.fn).not.toHaveBeenCalled()
})

it('AC 4: the launch lock — stop, gate, Home and Android back taps change nothing; exactly one route change', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener')
  const h = await mount(progressAtStep('add-to-20'))
  const androidBack = back.mock.calls.at(-1)![1] as () => boolean
  back.mockRestore()
  await advance(MAP_TAP_ARM_MS)
  await tap('add-to-20')
  await tap('add-to-20')
  await tap('add-to-10')
  await tap('sub-to-10')
  await fireEvent.press(screen.getByTestId('map-gate-2'))
  await fireEvent.press(screen.getByTestId('map-home'))
  await act(async () => {
    // Still consumed (the OS must not close the app), but ignored.
    expect(androidBack()).toBe(true)
  })
  await advance(2000)
  await tap('add-to-10')
  await advance(2000)
  expect(h.onPlay).toHaveBeenCalledTimes(1)
  expect(h.replay.fn).not.toHaveBeenCalled()
  expect(h.peek.fn).not.toHaveBeenCalled()
  expect(h.onHome).not.toHaveBeenCalled()
  expect(h.ids()).toEqual(['path.open.add-to-20'])
})

it('AC 2: a mastered stop asks for a replay ~200 ms after the release; taps wait while it is out', async () => {
  const h = await mount(progressAtStep('add-to-20'))
  await advance(MAP_TAP_ARM_MS)
  await tap('add-to-10')
  expect(h.player.cancel).toHaveBeenCalled()
  expect(screen.getByTestId('map-stop-launching-add-to-10')).toBeOnTheScreen()
  await advance(LAUNCH_DELAY_MS - 1)
  expect(h.replay.fn).not.toHaveBeenCalled()
  await advance(1)
  expect(h.replay.fn).toHaveBeenCalledTimes(1)
  expect(h.replay.calls[0]!.node).toBe('add-to-10')
  await tap('add-to-20')
  await fireEvent.press(screen.getByTestId('map-home'))
  await advance(1000)
  expect(h.onPlay).not.toHaveBeenCalled()
  expect(h.onHome).not.toHaveBeenCalled()
  await settle(h.replay.calls[0]!, true)
  expect(h.ids()).toEqual(['path.open.add-to-20'])
})

it('§ 2.5: a replay that fails says the stop’s name, and taps resume', async () => {
  const h = await mount(progressAtStep('add-to-20'))
  await advance(MAP_TAP_ARM_MS)
  await tap('number-recog')
  await advance(LAUNCH_DELAY_MS)
  await settle(h.replay.calls[0]!, false)
  expect(h.ids()).toEqual(['path.open.add-to-20', 'path.stop.number-recog'])
  expect(
    screen.queryByTestId('map-stop-launching-number-recog'),
  ).not.toBeOnTheScreen()
  await tap('add-to-20')
  await advance(LAUNCH_DELAY_MS)
  expect(h.onPlay.mock.calls).toEqual([['add-to-20']])
})

it('AC 5: a stop tap within 400 ms of mount is ignored', async () => {
  const h = await mount(progressAtStep('add-to-20'))
  await advance(MAP_TAP_ARM_MS - 1)
  await tap('add-to-20')
  await tap('add-to-10')
  await tap('sub-to-10')
  await advance(LAUNCH_DELAY_MS)
  expect(h.onPlay).not.toHaveBeenCalled()
  expect(h.replay.fn).not.toHaveBeenCalled()
  expect(h.peek.fn).not.toHaveBeenCalled()
  await advance(1)
  await tap('add-to-20')
  await advance(LAUNCH_DELAY_MS)
  expect(h.onPlay).toHaveBeenCalledTimes(1)
})

it('AC 5: taps wait for the unlock beat’s cheer; then the current stop plays', async () => {
  const h = await mount(landUnlockDoc())
  await advance(1000)
  await tap('two-digit-addsub-no-regroup')
  await tap('add-to-10')
  await advance(LAUNCH_DELAY_MS)
  expect(h.onPlay).not.toHaveBeenCalled()
  expect(h.replay.fn).not.toHaveBeenCalled()
  await advance(1100) // 2100: Emma's line
  await tap('two-digit-addsub-no-regroup')
  await advance(LAUNCH_DELAY_MS)
  expect(h.onPlay.mock.calls).toEqual([['two-digit-addsub-no-regroup']])
})

it('AC 3: later stops still peek at once, and gates still say their land', async () => {
  const h = await mount(progressAtStep('add-to-20'))
  await advance(MAP_TAP_ARM_MS)
  await fireEvent.press(screen.getByTestId('map-gate-2'))
  expect(h.ids().at(-1)).toBe('path.land.math.2')
  await tap('mult-6-9')
  expect(h.peek.fn).toHaveBeenCalledTimes(1)
  expect(h.peek.calls[0]!.node).toBe('mult-6-9')
  expect(
    screen.queryByTestId('map-stop-launching-mult-6-9'),
  ).not.toBeOnTheScreen()
  expect(h.onPlay).not.toHaveBeenCalled()
  expect(h.replay.fn).not.toHaveBeenCalled()
})

it('a complete world: every stop replays', async () => {
  const p = progressAtStep('div-share')
  p.skillLevels['div-share'] = 'mastered'
  const h = await mount(p)
  await advance(MAP_TAP_ARM_MS)
  await tap('div-share')
  await advance(LAUNCH_DELAY_MS)
  expect(h.replay.calls.map((c) => c.node)).toEqual(['div-share'])
  expect(h.onPlay).not.toHaveBeenCalled()
})
