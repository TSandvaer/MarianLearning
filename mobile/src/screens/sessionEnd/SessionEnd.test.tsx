/**
 * Session End's contract (web `src/screens/SessionEnd/SessionEnd.test.tsx`
 * "Guidance G2 beats"), on an in-memory store. Emma's lines go through a
 * fake path player that ends each clip at once, so each beat costs its
 * real clip length (the floor), as in the web test. Silent: no player.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import type { EmmaPose } from '@marian/core/character/emmaPose'
import { defaultProgress, saveProgress } from '@marian/core/progress'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import type { PathLinePlayer, PlayablePathLine, Sfx } from '../../audio'
import type { Viewport } from '../../layout/layout'
import { sessionEndLayout } from '../../layout/sessionEndLayout'
import type { SessionEndPayload } from '../../session/sessionEndPayload'
import {
  CHIME_TAIL_MS,
  LEAVE_DELAY_MS,
  SessionEnd,
  type SessionEndProps,
} from './SessionEnd'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const MATH: SessionEndPayload = {
  totalCorrect: 7,
  totalStardust: 9,
  finalStreak: 5,
  earnedThisSession: 9,
  surface: 'math',
}
const NOON = new Date('2026-10-10T12:00:00')
const daysAgo = (d: number) =>
  new Date(NOON.getTime() - d * 86_400_000).toISOString()

function fakeSfx() {
  const one = (): Sfx & { play: jest.Mock; unload: jest.Mock } => ({
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  })
  return { chime: one(), sparkle: one() }
}

/** Ends every clip at once; `hang` never ends one (a stuck clip). */
function fakePlayer({ hang = false } = {}) {
  const played: string[] = []
  const player: PathLinePlayer & { cancel: jest.Mock; unload: jest.Mock } = {
    play: (line: PlayablePathLine) => {
      played.push(line.id)
      return hang ? new Promise<void>(() => {}) : Promise.resolve()
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

/** Timers and the promises they settle, in 100 ms steps (web `advanceSequence`). */
async function advance(total: number) {
  for (let t = 0; t < total; t += 100) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, total - t))
    })
    await flush()
  }
}

async function setup(
  payload: SessionEndPayload | null,
  overrides: Partial<SessionEndProps> = {},
  opts: { hang?: boolean; viewport?: Viewport } = {},
) {
  const sfx = fakeSfx()
  const { player, played } = fakePlayer(opts)
  const poses: EmmaPose[] = []
  const onAllDone = jest.fn()
  const onAgain = jest.fn()
  const utils = await render(
    <SessionEnd
      layout={sessionEndLayout(opts.viewport ?? PORTRAIT)}
      payload={payload}
      onAllDone={onAllDone}
      onAgain={onAgain}
      onPoseChange={(p) => poses.push(p)}
      sfx={sfx}
      createPlayer={() => player}
      clock={() => NOON}
      {...overrides}
    />,
  )
  await flush()
  return { sfx, player, played, poses, onAllDone, onAgain, ...utils }
}

const day = () =>
  String(screen.getByTestId('session-end-panel').props.nativeID).split(':')
const slots = () =>
  screen
    .queryAllByTestId(/^session-end-slot-/)
    .map((n) => String(n.props.testID).replace('session-end-slot-', ''))
const caption = () =>
  screen.getByTestId('session-end-caption').props.children as string
const ctaLabel = () =>
  screen.getByTestId('session-end-cta').props.accessibilityLabel as string

it('good day: praise → flower flies in → "1 of 3" → sleeps tonight; buttons wait for the last line', async () => {
  const h = await setup(MATH)
  expect(day()[0]).toBe('good-day')
  expect(h.poses.at(-1)).toBe('cheering')
  expect(slots()).toEqual(['empty', 'empty', 'empty'])
  expect(caption()).toBe('Seven right! You worked hard!')
  expect(screen.queryByTestId('session-end-cta')).toBeNull()

  // The praise clip is 3.12 s: the flower is not out before it ends.
  await advance(3000)
  expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
  await advance(600)
  expect(screen.getByTestId('session-end-new-flower')).toBeOnTheScreen()
  expect(caption()).toBe('You got a flower!')
  // It lands ≈ the end of the 1.52 s clip, asleep in slot 1.
  await advance(1600)
  expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
  expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
  expect(screen.getByTestId('session-end-count').props.children).toBe('1 of 3')
  expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)

  await advance(3000)
  expect(caption()).toBe('It sleeps tonight. Come back tomorrow for one more.')
  expect(ctaLabel()).toBe('All done!')
  expect(screen.queryByTestId('session-end-again')).toBeNull()
  await advance(5000)
  expect(day()).toEqual(['good-day', 'settled'])
  expect(h.played).toEqual([
    'guide.end.right.7',
    'guide.end.flower',
    'guide.end.count.1',
    'guide.end.sleeps',
  ])
})

it('3rd good day: "3 of 3!", "A new path opens. Look!"; All done leaves once, 300 ms after the chime', async () => {
  saveProgress({
    ...defaultProgress(),
    history: [
      { dateISO: daysAgo(2), skillFocus: ['add-to-10'], successRate: 1 },
      { dateISO: daysAgo(1), skillFocus: ['add-to-10'], successRate: 1 },
    ],
  })
  const h = await setup({ ...MATH, totalCorrect: 8 })
  expect(day()[0]).toBe('unlock')
  expect(slots()).toEqual(['grown', 'grown', 'empty'])
  await advance(15_000)
  expect(slots()).toEqual(['grown', 'grown', 'grown'])
  expect(screen.getByTestId('session-end-count').props.children).toBe('3 of 3!')
  expect(h.played).toEqual([
    'guide.end.right.8',
    'guide.end.flower',
    'guide.end.count.3',
    'guide.end.path-opens',
  ])
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  expect(h.sfx.chime.play).toHaveBeenCalledTimes(1)
  expect(h.player.cancel).toHaveBeenCalled()
  await advance(LEAVE_DELAY_MS - 100)
  expect(h.onAllDone).not.toHaveBeenCalled()
  await advance(100)
  expect(h.onAllDone).toHaveBeenCalledTimes(1)
})

it('not-yet day: warm praise, tray untouched, "Play again…"; Again + Home; never a negative word', async () => {
  const h = await setup({ ...MATH, totalCorrect: 5 })
  expect(day()[0]).toBe('not-yet')
  expect(h.poses.at(-1)).toBe('idle')
  await advance(10_000)
  expect(h.played).toEqual([
    'guide.end.not-yet.praise',
    'guide.end.not-yet.again',
  ])
  expect(slots()).toEqual(['empty', 'empty', 'empty'])
  expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
  expect(screen.queryByTestId('session-end-count')).toBeNull()
  expect(screen.getByTestId('session-end-again').props.accessibilityLabel).toBe(
    'Again',
  )
  expect(ctaLabel()).toBe('Home')
  expect(
    screen.queryAllByText(/wrong|fail|oops|missed|try again|✗|❌/i),
  ).toEqual([])
  await fireEvent.press(screen.getByTestId('session-end-again'))
  await advance(LEAVE_DELAY_MS)
  expect(h.onAgain).toHaveBeenCalledTimes(1)
  expect(h.onAllDone).not.toHaveBeenCalled()
})

it('a second not-yet session the same day gets the practice line only', async () => {
  const first = await setup({ ...MATH, totalCorrect: 4 })
  await advance(10_000)
  await first.unmount()
  const second = await setup({ ...MATH, totalCorrect: 4 })
  await advance(10_000)
  expect(second.played).toEqual(['guide.end.not-yet.praise'])
})

it('same-day replay after today’s flower: practice, no new flower, the flower still sleeps', async () => {
  saveProgress({
    ...defaultProgress(),
    history: [
      {
        dateISO: NOON.toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 1,
      },
    ],
  })
  const h = await setup({ ...MATH, totalCorrect: 8 })
  expect(day()[0]).toBe('practice')
  await advance(10_000)
  expect(h.played).toEqual(['guide.end.not-yet.praise'])
  expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
  expect(screen.queryByTestId('session-end-count')).toBeNull()
  expect(ctaLabel()).toBe('All done!')
})

it('stars are one per right answer, with no number; no stardust total', async () => {
  await setup({ ...MATH, totalStardust: 36 })
  // Decorative, hidden from screen readers (web `aria-hidden`).
  expect(
    screen.getAllByTestId('session-end-star', { includeHiddenElements: true }),
  ).toHaveLength(7)
  expect(screen.queryAllByText(/36/)).toEqual([])
})

it('writes once per mount: sessionCount 1 after re-renders', async () => {
  const h = await setup(MATH)
  await h.rerender(
    <SessionEnd
      layout={sessionEndLayout(PORTRAIT)}
      payload={MATH}
      onAllDone={h.onAllDone}
      sfx={h.sfx}
      createPlayer={() => h.player}
      clock={() => NOON}
    />,
  )
  expect(readSessionHistory().sessionCount).toBe(1)
})

it('a clip that never ends is given up 1.5 s after its length', async () => {
  await setup(MATH, {}, { hang: true })
  // Praise 3.12 s + 1.5 s slack + the 300 ms gap = 4.92 s.
  await advance(4800)
  expect(caption()).toBe('Seven right! You worked hard!')
  await advance(200)
  expect(caption()).toBe('You got a flower!')
})

it('Reduce Motion: the flower is in its slot at once, no flight and no sparkle', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  const h = await setup(MATH)
  await advance(3500)
  expect(screen.getByTestId('session-end-new-flower')).toBeOnTheScreen()
  await advance(300)
  expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
  expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
  expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
})

it('on unmount: Emma stops, the players go; the chime rings out first', async () => {
  const h = await setup(MATH)
  await h.unmount()
  expect(h.player.unload).toHaveBeenCalled()
  expect(h.sfx.sparkle.unload).toHaveBeenCalled()
  expect(h.sfx.chime.unload).not.toHaveBeenCalled()
  jest.advanceTimersByTime(CHIME_TAIL_MS)
  expect(h.sfx.chime.unload).toHaveBeenCalled()
})

it('a null payload is a zero math session: not-yet, Home only without Again', async () => {
  await setup(null, { onAgain: undefined })
  expect(day()[0]).toBe('not-yet')
  await advance(10_000)
  expect(screen.queryByTestId('session-end-again')).toBeNull()
  expect(ctaLabel()).toBe('Home')
})

it.each([
  ['phone landscape', { width: 667, height: 375, insets: NO_INSETS }],
  ['tablet portrait', { width: 820, height: 1180, insets: NO_INSETS }],
  ['tablet landscape', { width: 1180, height: 820, insets: NO_INSETS }],
])('%s: the panel sits where the layout puts it', async (_n, viewport) => {
  await setup(MATH, {}, { viewport })
  const { panel } = sessionEndLayout(viewport)
  expect(screen.getByTestId('session-end-panel')).toHaveStyle({
    left: panel.x,
    top: panel.y,
    width: panel.width,
    height: panel.height,
  })
})
