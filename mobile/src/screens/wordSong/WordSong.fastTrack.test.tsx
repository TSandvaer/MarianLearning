/**
 * Word Song's first taps and Map peek (native spec
 * `design/native/fast-track-native.md` §§ 3.2, 6.3; AC 14, 17). Fakes for
 * Emma's voice and the session-guide player.
 */
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen } from '@testing-library/react-native'
import {
  PEEK_CLOSE_GAP_MS,
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
  const player: SessionGuidePlayer & { cancelActive: jest.Mock } = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, end: resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player, ids: () => lines.map((l) => l.id) }
}

async function endGuide(line: { opts: LineCallbacks; end: () => void }) {
  await act(async () => {
    line.opts.onPlay?.()
    line.end()
  })
  await flush()
}

type Harness = Awaited<ReturnType<typeof renderWordSong>>

/** The read plays and ends; she taps `words` (the last the right one). */
async function answer(
  h: Harness,
  plan: WordSongSessionPlan,
  i: number,
  words: string[],
) {
  const read = h.voice.lines.at(-1)!
  expect(read.text).toBe(plan.problems[i]!.utterances.read)
  await say(read)
  for (const word of words) {
    await fireEvent.press(screen.getByTestId(`word-song-chip-${word}`))
    await flush()
    await say(h.voice.lines.at(-1)!)
  }
}

const wrongFor = (plan: WordSongSessionPlan, i: number) =>
  screen
    .getAllByTestId(/^word-song-chip-[a-z]+$/)
    .map((n) => String(n.props.testID).replace('word-song-chip-', ''))
    .find((w) => w !== plan.problems[i]!.target.word)!

const PEEK: WordSongSessionPlan = {
  id: 'peek-word-song',
  label: 'Peek',
  problems: BLENDING.problems.slice(0, 3),
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('AC 14: a problem solved after a wrong tap is firstTapCorrect false, perProblemCorrect true', async () => {
  const h = await renderWordSong()
  for (let i = 0; i < 8; i++) {
    const word = BLENDING.problems[i]!.target.word
    await answer(
      h,
      BLENDING,
      i,
      i === 3 ? [wrongFor(BLENDING, i), word] : [word],
    )
    await advance(ADVANCE_AFTER_CORRECT_MS)
  }
  expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  const result = h.onSessionComplete.mock.calls[0]![0] as WordSongSessionResult
  expect(result.perProblemCorrect).toEqual(Array(8).fill(true))
  expect(result.firstTapCorrect).toEqual([
    true,
    true,
    true,
    false,
    true,
    true,
    true,
    true,
  ])
})

it('AC 17 peek: 3 beads, no stardust, no streak; opener → card → read; closer after problem 3 → onPeekEnd; no result', async () => {
  const guide = fakeGuide()
  const onPeekEnd = jest.fn()
  const h = await renderWordSong({
    plan: PEEK,
    peek: true,
    onPeekEnd,
    sessionGuide: guide.player,
  })
  expect(screen.getAllByTestId(/^word-song-problem-dot-/, HIDDEN)).toHaveLength(
    3,
  )
  expect(screen.queryByTestId('word-song-stardust')).toBeNull()
  expect(guide.ids()).toEqual(['guide.session.peek-open'])
  expect(screen.queryByTestId('word-song-chips')).toBeNull()
  await endGuide(guide.lines[0]!)
  expect(screen.getAllByTestId('word-song-peek-stage')).toHaveLength(1)
  await advance(SESSION_GUIDE_GAP_MS)
  for (let i = 0; i < 3; i++) {
    await answer(h, PEEK, i, [PEEK.problems[i]!.target.word])
    await advance(ADVANCE_AFTER_CORRECT_MS)
  }
  expect(screen.queryByTestId('word-song-streak')).toBeNull()
  expect(guide.ids()).toEqual(['guide.session.peek-open'])
  await advance(PEEK_CLOSE_GAP_MS)
  expect(guide.ids()).toEqual([
    'guide.session.peek-open',
    'guide.session.peek-close',
  ])
  await endGuide(guide.lines[1]!)
  expect(onPeekEnd).not.toHaveBeenCalled()
  await advance(PEEK_CLOSE_GAP_MS)
  expect(onPeekEnd).toHaveBeenCalledTimes(1)
  expect(h.onSessionComplete).not.toHaveBeenCalled()
  expect(h.onRequestExit).not.toHaveBeenCalled()
})

it('AC 17 peek: the back arrow cuts the line and fires onPeekEnd at once', async () => {
  const guide = fakeGuide()
  const onPeekEnd = jest.fn()
  const h = await renderWordSong({
    plan: PEEK,
    peek: true,
    onPeekEnd,
    sessionGuide: guide.player,
  })
  await fireEvent.press(screen.getByTestId('word-song-back-to-hub'))
  expect(onPeekEnd).toHaveBeenCalledTimes(1)
  expect(h.cancelLine).toHaveBeenCalled()
  expect(guide.player.cancelActive).toHaveBeenCalled()
  expect(h.onRequestExit).not.toHaveBeenCalled()
})
