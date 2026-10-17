/**
 * The Map peek's map half (native spec `design/native/fast-track-native.md`
 * §§ 6.1, 6.4; AC 16): a later stop's tap asks for a peek instead of the
 * locked response, taps wait while the request is out, a failure says the
 * stop's name, Home aborts it, and the map back from a peek opens quiet.
 * The line player and the effects are fakes; no audio plays.
 */
import { setKeyValueStore } from '@marian/core'
import { pathLine, type PathLine } from '@marian/core/emmasPath/pathLines'
import {
  defaultProgress,
  getSettings,
  type Progress,
  type SkillNode,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Sfx } from '../../audio'
import { mapScreenLayout } from '../../layout/mapScreenLayout'
import type { MapLinePlayer } from './mapAudio'
import { MapScreen } from './MapScreen'
import { MAP_TAP_ARM_MS } from './useMapVisit'

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
  const played: string[] = []
  const create = jest.fn((effect: { src: string; volume: number }) => {
    const sfx: Sfx = {
      play: jest.fn(() => {
        played.push(effect.src)
        return true
      }),
      unload: jest.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    return sfx
  })
  return { create, played }
}

/** A peek request the test settles by hand. */
function fakePeek() {
  const calls: {
    node: SkillNode
    signal: AbortSignal
    settle: (opened: boolean) => void
  }[] = []
  const peek = jest.fn(
    (node: SkillNode, signal: AbortSignal) =>
      new Promise<boolean>((settle) => {
        calls.push({ node, signal, settle })
      }),
  )
  return { peek, calls }
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

async function mount(doc: Progress, opts: { quietReturn?: boolean } = {}) {
  const { player, ids } = fakePlayer()
  const sfx = fakeSfx()
  const fake = fakePeek()
  const onHome = jest.fn()
  await render(
    <MapScreen
      layout={P}
      world="math"
      onHome={onHome}
      onPeek={fake.peek}
      quietReturn={opts.quietReturn}
      readProgress={() => doc}
      createPlayer={() => player}
      createSfx={sfx.create}
      markUnlockCelebrated={jest.fn()}
      markLeft={jest.fn()}
      wallClock={() => 42}
    />,
  )
  // Stop taps count once the map has been up 400 ms (map-tap-to-play § 5).
  await act(async () => {
    jest.advanceTimersByTime(MAP_TAP_ARM_MS)
  })
  return { player, ids, sfx, ...fake, onHome }
}

const settle = async (call: { settle: (b: boolean) => void }, ok: boolean) => {
  await act(async () => {
    call.settle(ok)
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
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

it('AC 16: a locked stop asks for a peek, cuts the line, no poof, no wiggle, no pointing', async () => {
  const h = await mount(defaultProgress())
  expect(h.ids()).toEqual(['path.open.add-to-10'])
  await fireEvent.press(screen.getByTestId('map-stop-mult-6-9'))
  expect(h.peek).toHaveBeenCalledTimes(1)
  expect(h.calls[0]!.node).toBe('mult-6-9')
  expect(h.player.cancel).toHaveBeenCalled()
  expect(h.sfx.played).toEqual([])
  expect(screen.getByTestId('map-emma-idle')).toBeOnTheScreen()
  expect(h.ids()).toEqual(['path.open.add-to-10'])
})

it('AC 16: stop and gate taps wait while the request is out; success leaves the map quiet', async () => {
  const h = await mount(defaultProgress())
  await fireEvent.press(screen.getByTestId('map-stop-add-to-20'))
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  await fireEvent.press(screen.getByTestId('map-gate-2'))
  await fireEvent.press(screen.getByTestId('map-stop-sub-to-10'))
  expect(h.peek).toHaveBeenCalledTimes(1)
  expect(h.ids()).toEqual(['path.open.add-to-10'])
  await settle(h.calls[0]!, true)
  expect(h.ids()).toEqual(['path.open.add-to-10'])
})

it('AC 16: a failed request says the stop’s name, and taps resume', async () => {
  const h = await mount(defaultProgress())
  await fireEvent.press(screen.getByTestId('map-stop-add-to-20'))
  await settle(h.calls[0]!, false)
  expect(h.ids()).toEqual(['path.open.add-to-10', 'path.stop.add-to-20'])
  expect(screen.getByTestId('map-caption').props.children).toBe(
    pathLine('path.stop.add-to-20')!.text,
  )
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.ids().at(-1)).toBe('path.stop.add-to-10')
})

it('AC 16: the current stop still says its name (no peek)', async () => {
  const h = await mount(defaultProgress())
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.peek).not.toHaveBeenCalled()
  expect(h.ids()).toEqual(['path.open.add-to-10', 'path.stop.add-to-10'])
})

it('AC 16: taps during the unlock beat are ignored; at her line a later stop peeks', async () => {
  const h = await mount(landUnlockDoc())
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  await fireEvent.press(screen.getByTestId('map-stop-mult-6-9'))
  expect(h.peek).not.toHaveBeenCalled()
  await act(async () => {
    jest.advanceTimersByTime(1100) // 2100: Emma's line
  })
  await fireEvent.press(screen.getByTestId('map-stop-mult-6-9'))
  expect(h.peek).toHaveBeenCalledTimes(1)
})

it('Home aborts the request in flight; its failure then says nothing', async () => {
  const h = await mount(defaultProgress())
  await fireEvent.press(screen.getByTestId('map-stop-add-to-20'))
  await fireEvent.press(screen.getByTestId('map-home'))
  expect(h.onHome).toHaveBeenCalledTimes(1)
  expect(h.calls[0]!.signal.aborted).toBe(true)
  await settle(h.calls[0]!, false)
  expect(h.ids()).toEqual(['path.open.add-to-10'])
})

it('§ 6.4: back from a peek, no open line and an empty caption; every stop tappable once the 400 ms tap guard is past', async () => {
  const h = await mount(defaultProgress(), { quietReturn: true })
  expect(h.ids()).toEqual([])
  expect(screen.queryByTestId('map-ribbon')).toBeNull()
  await fireEvent.press(screen.getByTestId('map-stop-add-to-10'))
  expect(h.ids()).toEqual(['path.stop.add-to-10'])
})
