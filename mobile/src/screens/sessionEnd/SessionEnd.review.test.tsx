/**
 * Session End after a same-day review (native spec
 * `design/native/review-mode-and-warmup-native.md` § 3.1 / § 7.5, AC 16):
 * the practice day of the current step, one line, "All done" only; no
 * history entry and no Word Song +5. Silent: a fake path player.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { loadProgress, saveProgress } from '@marian/core/progress'
import { loadStardust } from '@marian/core/shared/stardust'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { PathLinePlayer, PlayablePathLine, Sfx } from '../../audio'
import type { Viewport } from '../../layout/layout'
import { sessionEndLayout } from '../../layout/sessionEndLayout'
import type { SessionEndPayload } from '../../session/sessionEndPayload'
import { LEAVE_DELAY_MS, SessionEnd } from './SessionEnd'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const NOON = new Date(2026, 9, 10, 12, 0)
const MORNING = new Date(2026, 9, 10, 8, 0)

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

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

async function advance(total: number) {
  for (let t = 0; t < total; t += 100) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, total - t))
    })
    await flush()
  }
}

/** The step's first good day banked this morning: today's flower sleeps. */
function seed(node: 'sub-to-10' | 'cvc-words-short-o') {
  saveProgress({
    ...progressAtStep(node),
    history: [
      {
        dateISO: MORNING.toISOString(),
        skillFocus: [node],
        successRate: 7 / 8,
      },
    ],
  })
}

async function setup(payload: SessionEndPayload) {
  const { player, played } = fakePlayer()
  const onAllDone = jest.fn()
  const onAgain = jest.fn()
  await render(
    <SessionEnd
      layout={sessionEndLayout(PORTRAIT)}
      payload={payload}
      onAllDone={onAllDone}
      onAgain={onAgain}
      sfx={fakeSfx()}
      createPlayer={() => player}
      clock={() => NOON}
    />,
  )
  await flush()
  return { played, onAllDone, onAgain }
}

const day = () =>
  String(screen.getByTestId('session-end-panel').props.nativeID).split(':')[0]
const slots = () =>
  screen
    .queryAllByTestId(/^session-end-slot-/)
    .map((n) => String(n.props.testID).replace('session-end-slot-', ''))

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
afterEach(() => jest.useRealTimers())

it('AC16 (math): practice day, the current step’s sleeping flower, one line, All done → Hub; no history entry', async () => {
  seed('sub-to-10')
  const before = loadProgress()!
  const h = await setup({
    totalCorrect: 6,
    totalStardust: 20,
    finalStreak: 2,
    earnedThisSession: 6,
    surface: 'math',
    review: true,
    perProblemCorrect: [true, true, false, true, true, false, true, true],
    problemFacts: [
      { a: 9, b: 2, op: '+' },
      { a: 1, b: 2, op: '+' },
      null,
      { a: 6, b: 6, op: '+' },
      { a: 2, b: 2, op: '+' },
      { a: 8, b: 3, op: '+' },
      { a: 3, b: 2, op: '+' },
      { a: 9, b: 4, op: '+' },
    ],
  })
  expect(day()).toBe('practice')
  expect(screen.getAllByTestId('session-end-step-sub-to-10')).toHaveLength(1)
  expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
  await advance(10_000)
  expect(h.played).toEqual(['guide.end.not-yet.praise'])
  expect(screen.getByTestId('session-end-caption').props.children).toBe(
    'You practised hard! Good work!',
  )
  expect(screen.queryByTestId('session-end-again')).toBeNull()

  const after = loadProgress()!
  expect(after.history).toEqual(before.history)
  expect(after.skillLevels).toEqual(before.skillLevels)
  // Seven facts recorded (the null one left out), at their first taps.
  expect(after.mathFactsLeitner.items).toHaveLength(7)
  expect(after.mathFactsLeitner.items.find((i) => i.item.a === 8)!.box).toBe(1)
  expect(after.profile.lastPlayedISO).toBe(NOON.toISOString())

  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  expect(h.onAllDone).toHaveBeenCalledTimes(1)
  expect(h.onAgain).not.toHaveBeenCalled()
})

it('AC16 (Word Song): practice day and no +5 completion bonus', async () => {
  seed('cvc-words-short-o')
  const stardust = loadStardust().total
  await setup({
    totalCorrect: 8,
    totalStardust: stardust,
    finalStreak: 8,
    earnedThisSession: 0,
    surface: 'word-song',
    review: true,
    perProblemCorrect: Array(8).fill(true),
  })
  expect(day()).toBe('practice')
  expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
  expect(loadStardust().total).toBe(stardust)
  expect(loadProgress()!.history).toHaveLength(1)
})
