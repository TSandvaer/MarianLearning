/**
 * Word Song's same-day review and daily warm-up (native spec
 * `design/native/review-mode-and-warmup-native.md` §§ 3–6): the opener over
 * an empty stage, the hearts and "Remember this one?", and a result that
 * counts the 8 scored problems only. Fakes for Emma's voice and the guide.
 */
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen } from '@testing-library/react-native'
import {
  SESSION_GUIDE_GAP_MS,
  type SessionGuideLineId,
  type SessionGuidePlayer,
} from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import {
  advance,
  BLENDING,
  flush,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'
import type { WordSongSessionResult } from './wordSongTypes'

const HIDDEN = { includeHiddenElements: true }

function fakeGuide() {
  const lines: {
    id: SessionGuideLineId
    opts: LineCallbacks
    end: () => void
  }[] = []
  const player: SessionGuidePlayer = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, end: resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player }
}

async function endGuide(line: { opts: LineCallbacks; end: () => void }) {
  await act(async () => {
    line.opts.onPlay?.()
    line.end()
  })
  await flush()
}

/** Two warm-up cards (the plan's #3 and #4 again), then the 8. */
const ROUND: WordSongSessionPlan = {
  ...BLENDING,
  problems: [
    { ...BLENDING.problems[2]!, index: 1 },
    { ...BLENDING.problems[3]!, index: 2 },
    ...BLENDING.problems,
  ],
}

type Harness = Awaited<ReturnType<typeof renderWordSong>>

/** The read plays and ends; she taps `words` (the last the right one). */
async function answer(h: Harness, i: number, words: string[]) {
  const problem = ROUND.problems[i]!
  const read = h.voice.lines.at(-1)!
  expect(read.text).toBe(problem.utterances.read)
  await say(read)
  for (const word of words) {
    await fireEvent.press(screen.getByTestId(`word-song-chip-${word}`))
    await flush()
    await say(h.voice.lines.at(-1)!)
  }
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('review: the opener over an empty stage, the moon; the card mounts at its end, the read 400 ms later', async () => {
  const guide = fakeGuide()
  const h = await renderWordSong({ review: true, sessionGuide: guide.player })
  expect(screen.getAllByTestId('word-song-review-moon', HIDDEN)).toHaveLength(1)
  expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
  expect(h.voice.lines).toHaveLength(0)
  expect(screen.queryByTestId('word-song-chips')).toBeNull()
  await endGuide(guide.lines[0]!)
  expect(screen.getAllByTestId('word-song-review-stage')).toHaveLength(1)
  expect(screen.getAllByTestId('word-song-chips')).toHaveLength(1)
  await advance(SESSION_GUIDE_GAP_MS - 1)
  expect(h.voice.lines).toHaveLength(0)
  await advance(1)
  expect(h.voice.texts()).toEqual([BLENDING.problems[0]!.utterances.read])
})

it('warm-up: 2 hearts + 8 beads; the line before each warm-up read only; the result counts the 8', async () => {
  const guide = fakeGuide()
  const h = await renderWordSong({
    plan: ROUND,
    warmupCount: 2,
    sessionGuide: guide.player,
  })
  expect(screen.getAllByTestId(/^word-song-warmup-dot-/, HIDDEN)).toHaveLength(
    2,
  )
  expect(screen.getAllByTestId(/^word-song-problem-dot-/, HIDDEN)).toHaveLength(
    8,
  )
  expect(guide.lines).toHaveLength(1)
  expect(h.voice.lines).toHaveLength(0)

  const word = (i: number) => ROUND.problems[i]!.target.word
  const wrong = (i: number) =>
    screen
      .getAllByTestId(/^word-song-chip-[a-z]+$/)
      .map((n) => String(n.props.testID).replace('word-song-chip-', ''))
      .find((w) => w !== word(i))!

  await endGuide(guide.lines[0]!)
  await advance(SESSION_GUIDE_GAP_MS)
  await answer(h, 0, [wrong(0), word(0)]) // warm-up 1: wrong first
  expect(guide.lines).toHaveLength(2)
  await endGuide(guide.lines[1]!)
  await advance(SESSION_GUIDE_GAP_MS)
  await answer(h, 1, [word(1)])
  for (let i = 2; i < 10; i++) await answer(h, i, [word(i)])

  expect(guide.lines).toHaveLength(2)
  expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  const result = h.onSessionComplete.mock.calls[0]![0] as WordSongSessionResult
  expect(result.totalCorrect).toBe(8)
  expect(result.finalStreak).toBe(8)
  expect(result.perProblemCorrect).toEqual(Array(8).fill(true))
  expect(result.targetWords).toEqual(
    BLENDING.problems.map((p) => p.target.word),
  )
  expect(result.perProblemAnswerWord).toHaveLength(8)
  expect(result.warmupCorrect).toEqual([false, true])
})
