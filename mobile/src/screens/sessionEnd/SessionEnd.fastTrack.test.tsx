/**
 * Session End on the fast-track day (native spec
 * `design/native/fast-track-native.md` §§ 4, 9, AC 14's write half and
 * AC 15): yesterday was a secure day, today's first session is 8/8 on the
 * first tap, so today's flower flies into slot 2 and slot 3 grows in place
 * 500 ms later. In-memory store, a fake path player that ends every clip
 * at once (each beat costs its clip-length floor), fake effects.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
} from '@marian/core/progress'
import { act, render, screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import type { PathLinePlayer, PlayablePathLine, Sfx } from '../../audio'
import type { Viewport } from '../../layout/layout'
import { sessionEndLayout } from '../../layout/sessionEndLayout'
import type { SessionEndPayload } from '../../session/sessionEndPayload'
import { SessionEnd } from './SessionEnd'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const NOON = new Date('2026-10-10T12:00:00')
const YESTERDAY = new Date('2026-10-09T12:00:00')
const ALL = Array<boolean>(8).fill(true)

const PERFECT: SessionEndPayload = {
  totalCorrect: 8,
  totalStardust: 11,
  finalStreak: 8,
  earnedThisSession: 11,
  surface: 'math',
  perProblemCorrect: ALL,
  firstTapCorrect: ALL,
}

function fakeSfx() {
  const one = (): Sfx & { play: jest.Mock; unload: jest.Mock } => ({
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  })
  return { chime: one(), sparkle: one() }
}

function fakePlayer() {
  const played: string[] = []
  const player: PathLinePlayer = {
    play: (line: PlayablePathLine) => {
      played.push(line.id)
      return Promise.resolve()
    },
    cancel: jest.fn(),
    unload: jest.fn(),
  }
  return { player, played }
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
  setDayOffsetSource(null)
  // Yesterday: add-to-10's first session, 8/8 on the first tap.
  saveProgress({
    ...defaultProgress(),
    history: [
      {
        dateISO: YESTERDAY.toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 1,
      },
    ],
    secureDays: { 'add-to-10': ['2026-10-09'] },
  })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

/** Timers and the promises they settle, in 100 ms steps. */
async function advance(total: number) {
  for (let t = 0; t < total; t += 100) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, total - t))
    })
    await flush()
  }
}

async function setup(payload: SessionEndPayload) {
  const sfx = fakeSfx()
  const { player, played } = fakePlayer()
  await render(
    <SessionEnd
      layout={sessionEndLayout(PORTRAIT)}
      payload={payload}
      onAllDone={jest.fn()}
      sfx={sfx}
      createPlayer={() => player}
      clock={() => NOON}
    />,
  )
  await flush()
  return { sfx, played }
}

const panelId = () =>
  String(screen.getByTestId('session-end-panel').props.nativeID)
const slots = () =>
  screen
    .queryAllByTestId(/^session-end-slot-/)
    .map((n) => String(n.props.testID).replace('session-end-slot-', ''))
const caption = () =>
  screen.getByTestId('session-end-caption').props.children as string
const FAST_TRACK = 'You know this! All your flowers grew!'

/** Step until the fast-track line is up: the flower beat's start. */
async function untilFlowerBeat() {
  for (let i = 0; i < 100 && caption() !== FAST_TRACK; i++) await advance(100)
  expect(caption()).toBe(FAST_TRACK)
}

it('AC 15: grown ×1 → ×2 at 1450 ms → ×3 at 1950 ms, two sparkles, the badge after the third hole; unlock', async () => {
  const h = await setup(PERFECT)
  expect(panelId().startsWith('unlock:')).toBe(true)
  expect(slots()).toEqual(['grown', 'empty', 'empty'])
  await untilFlowerBeat()
  await advance(1400)
  expect(slots()).toEqual(['grown', 'empty', 'empty'])
  expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
  await advance(100)
  expect(slots()).toEqual(['grown', 'grown', 'empty'])
  expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('session-end-count')).toBeNull()
  await advance(400)
  expect(slots()).toEqual(['grown', 'grown', 'empty'])
  await advance(100)
  expect(slots()).toEqual(['grown', 'grown', 'grown'])
  expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('session-end-count').props.children).toBe('3 of 3!')
  await advance(15_000)
  expect(h.played).toEqual([
    'guide.end.right.8',
    'guide.end.fast-track',
    'guide.end.count.3',
    'guide.end.path-opens',
  ])
  expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(2)
})

it('AC 14: the write forwards the first taps; today is the second secure day and add-to-10 masters', async () => {
  await setup(PERFECT)
  const p = loadProgress()!
  expect(p.secureDays?.['add-to-10']).toEqual(['2026-10-09', '2026-10-10'])
  expect(p.skillLevels['add-to-10']).toBe('mastered')
  expect(p.skillLevels['add-to-20']).toBe('intro')
})

it('AC 14: a review end writes no secureDays', async () => {
  await setup({ ...PERFECT, review: true, problemFacts: Array(8).fill(null) })
  expect(loadProgress()!.secureDays).toEqual({ 'add-to-10': ['2026-10-09'] })
})

it('one wrong first tap: a normal 2nd good day, no bonus', async () => {
  await setup({
    ...PERFECT,
    totalCorrect: 7,
    firstTapCorrect: [false, ...ALL.slice(1)],
  })
  expect(panelId().startsWith('good-day:')).toBe(true)
  await advance(15_000)
  expect(slots()).toEqual(['grown', 'sleeping', 'empty'])
})

it('AC 15 Reduce Motion: no flight, no sparkle, holes at 300 and 700 ms', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  const h = await setup(PERFECT)
  await untilFlowerBeat()
  await advance(200)
  expect(slots()).toEqual(['grown', 'empty', 'empty'])
  await advance(100)
  expect(slots()).toEqual(['grown', 'grown', 'empty'])
  expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
  expect(screen.queryByTestId('session-end-count')).toBeNull()
  await advance(300)
  expect(slots()).toEqual(['grown', 'grown', 'empty'])
  await advance(100)
  expect(slots()).toEqual(['grown', 'grown', 'grown'])
  expect(screen.getByTestId('session-end-count')).toBeOnTheScreen()
  await advance(10_000)
  expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
})
