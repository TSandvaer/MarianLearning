/**
 * Math's Map peek and the "You just knew that one!" remark (native spec
 * `design/native/fast-track-native.md` §§ 6.3, 7; AC 14, 17, 19), driven
 * through fakes of Emma's session voice and of the session-guide player.
 * Silent: no player exists here.
 */
import type {
  ExtendedMathProblem,
  ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { STATIC_SESSION_PLANS } from '@marian/core/math/sessionPlans'
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  KNEW_GAP_MS,
  PEEK_CLOSE_GAP_MS,
  SESSION_GUIDE_GAP_MS,
  type SessionGuideLineId,
  type SessionGuidePlayer,
  type Sfx,
} from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import { MathScreen, type MathProps, type MathSfx } from './Math'
import type { MathSessionResult, PlayMathUtteranceOptions } from './mathTypes'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

const PLAN = STATIC_SESSION_PLANS[0]
const arith = (i: number, index = i + 1): ExtendedMathProblem => ({
  ...PLAN.problems[i]!,
  index,
  kind: 'arithmetic',
})
const SCORED: ExtendedMathProblem[] = PLAN.problems.map((_, i) => arith(i))
/** A peek: 3 problems of one step. */
const PEEK_PLAN: ExtendedMathSessionPlan = {
  id: 'peek-math',
  label: 'Peek',
  problems: [arith(0), arith(1), arith(2)],
}
/** One warm-up heart (scored #3 again), then the 8. */
const ROUND: ExtendedMathSessionPlan = {
  id: PLAN.id,
  label: PLAN.label,
  problems: [arith(2, 1), ...SCORED],
}

interface VoiceLine {
  text: string
  opts: PlayMathUtteranceOptions
  resolve: () => void
}

function fakeVoice() {
  const lines: VoiceLine[] = []
  const play = jest.fn(
    (text: string, opts: PlayMathUtteranceOptions = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ text, opts, resolve })
      }),
  )
  return { lines, play, last: () => lines.at(-1)! }
}

interface GuideLine {
  id: SessionGuideLineId
  opts: LineCallbacks
  resolve: () => void
}

function fakeGuide() {
  const lines: GuideLine[] = []
  const player: SessionGuidePlayer & { cancelActive: jest.Mock } = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player, ids: () => lines.map((l) => l.id) }
}

function fakeSfx(): MathSfx &
  Record<keyof MathSfx, Sfx & { play: jest.Mock; unload: jest.Mock }> {
  const one = () => ({
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  })
  return { sparkle: one(), poof: one(), plink: one(), chime: one() }
}

function spyStorage(): StorageAdapter & { setItem: jest.Mock } {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: jest.fn((k: string, v: string) => {
      map.set(k, v)
    }),
  }
}

const VISIBLE: AppVisibility = {
  getIsHidden: () => false,
  subscribe: () => () => {},
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flush()
}

async function startAndEnd(line: {
  opts: { onPlay?: () => void; onWordTick?: (i: number) => void }
  resolve: () => void
}) {
  await act(async () => {
    line.opts.onPlay?.()
    line.opts.onWordTick?.(0)
    line.resolve()
  })
  await flush()
}

async function setup(overrides: Partial<MathProps>) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const sfx = fakeSfx()
  const storage = spyStorage()
  const onSessionComplete = jest.fn<void, [MathSessionResult]>()
  const onPeekEnd = jest.fn()
  const onRequestExit = jest.fn()
  const cancelLine = jest.fn()
  const utils = await render(
    <MathScreen
      layout={mathLayout(PORTRAIT)}
      playUtterance={voice.play}
      audioReady
      sfx={sfx}
      storage={storage}
      visibility={VISIBLE}
      sessionGuide={guide.player}
      onSessionComplete={onSessionComplete}
      onRequestExit={onRequestExit}
      onPeekEnd={onPeekEnd}
      cancelLine={cancelLine}
      {...overrides}
    />,
  )
  await flush()
  return {
    voice,
    guide,
    sfx,
    storage,
    onSessionComplete,
    onPeekEnd,
    onRequestExit,
    cancelLine,
    ...utils,
  }
}

type H = Awaited<ReturnType<typeof setup>>

/** The read starts; `waitMs` later she taps `values` (the last the right one). */
async function answer(
  h: H,
  problem: ExtendedMathProblem,
  values: number[],
  waitMs = 0,
) {
  const read = h.voice.last()
  expect(read.text).toBe(problem.utterances.read)
  await act(async () => {
    read.opts.onPlay?.()
  })
  await flush()
  if (waitMs > 0) await advance(waitMs)
  for (const value of values) {
    await fireEvent.press(screen.getByTestId(`math-chip-${value}`))
    await flush()
    await startAndEnd(h.voice.last())
  }
}

const wrongFor = (p: ExtendedMathProblem) =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
    (v) => v !== p.correct && screen.queryByTestId(`math-chip-${v}`) !== null,
  )!

const HIDDEN = { includeHiddenElements: true }

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('peek (AC 17, 18)', () => {
  it('3 beads, no stardust pill, no streak; the opener over an empty stage, the read 400 ms after it', async () => {
    const h = await setup({ plan: PEEK_PLAN, peek: 'add-to-20' })
    expect(screen.getAllByTestId(/^math-problem-dot-/, HIDDEN)).toHaveLength(3)
    expect(screen.queryByTestId('math-stardust')).toBeNull()
    expect(screen.queryByTestId('math-streak')).toBeNull()
    expect(h.guide.ids()).toEqual(['guide.session.peek-open.add-to-20'])
    expect(h.voice.lines).toHaveLength(0)
    expect(screen.queryByTestId('math-chips')).toBeNull()
    await startAndEnd(h.guide.lines[0]!)
    expect(screen.getAllByTestId('math-peek-stage')).toHaveLength(1)
    expect(screen.getAllByTestId('math-chips')).toHaveLength(1)
    await advance(SESSION_GUIDE_GAP_MS - 1)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.last().text).toBe(PEEK_PLAN.problems[0]!.utterances.read)
  })

  it('a third wrong tap gives the answer; right answers grant nothing; after problem 3: 400 ms → the closer → 400 ms → onPeekEnd; nothing written', async () => {
    const h = await setup({ plan: PEEK_PLAN, peek: 'add-to-20' })
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)

    // Problem 1: wrong, wrong (hint), wrong (the given answer), then right.
    const p1 = PEEK_PLAN.problems[0]!
    const wrong = wrongFor(p1)
    await answer(h, p1, [wrong, wrong])
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe(p1.utterances.hint)
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId(`math-chip-${wrong}`))
    await flush()
    await startAndEnd(h.voice.last()) // "try again?"
    expect(h.voice.last().text).toBe(p1.utterances.giveAnswer)
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId(`math-chip-${p1.correct}`))
    await flush()
    await startAndEnd(h.voice.last())
    await advance(ADVANCE_AFTER_CORRECT_MS)

    // Problems 2 and 3, right at once.
    for (const i of [1, 2]) {
      const p = PEEK_PLAN.problems[i]!
      await answer(h, p, [p.correct])
      if (i === 1) await advance(ADVANCE_AFTER_CORRECT_MS)
    }
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(3)
    expect(h.sfx.chime.play).not.toHaveBeenCalled()
    expect(h.guide.ids()).toEqual(['guide.session.peek-open.add-to-20'])

    // Problem 3's dwell ends → 400 ms → the closer.
    await advance(ADVANCE_AFTER_CORRECT_MS)
    expect(h.guide.ids()).toEqual(['guide.session.peek-open.add-to-20'])
    await advance(PEEK_CLOSE_GAP_MS)
    expect(h.guide.ids()).toEqual([
      'guide.session.peek-open.add-to-20',
      'guide.session.peek-close.add-to-20',
    ])
    expect(h.onPeekEnd).not.toHaveBeenCalled()
    await startAndEnd(h.guide.lines[1]!)
    await advance(PEEK_CLOSE_GAP_MS - 1)
    expect(h.onPeekEnd).not.toHaveBeenCalled()
    await advance(1)
    expect(h.onPeekEnd).toHaveBeenCalledTimes(1)
    expect(h.onSessionComplete).not.toHaveBeenCalled()
    await h.unmount()
    // No stardust grant, no stardust write, not even at unmount.
    expect(h.storage.setItem).not.toHaveBeenCalled()
  })

  it('a step without peek lines (a world’s first): no opener, no closer, still back to the Map', async () => {
    const h = await setup({ plan: PEEK_PLAN, peek: 'number-recog' })
    expect(h.guide.ids()).toEqual([])
    expect(screen.getAllByTestId('math-chips')).toHaveLength(1)
    for (const p of PEEK_PLAN.problems) {
      await answer(h, p, [p.correct])
      await advance(ADVANCE_AFTER_CORRECT_MS)
    }
    // 400 ms → (no closer) → 400 ms → back.
    await advance(PEEK_CLOSE_GAP_MS)
    expect(h.onPeekEnd).not.toHaveBeenCalled()
    await advance(PEEK_CLOSE_GAP_MS)
    expect(h.guide.ids()).toEqual([])
    expect(h.onPeekEnd).toHaveBeenCalledTimes(1)
  })

  it('the back button cuts the line and fires onPeekEnd at once (never onRequestExit)', async () => {
    const h = await setup({ plan: PEEK_PLAN, peek: 'add-to-20' })
    await fireEvent.press(screen.getByTestId('math-back-to-hub'))
    expect(h.onPeekEnd).toHaveBeenCalledTimes(1)
    expect(h.onRequestExit).not.toHaveBeenCalled()
    expect(h.cancelLine).toHaveBeenCalled()
    expect(h.guide.player.cancelActive).toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('math-back-to-hub'))
    expect(h.onPeekEnd).toHaveBeenCalledTimes(1)
  })
})

describe('"You just knew that one!" (AC 19)', () => {
  async function warmup(waitMs: number) {
    const h = await setup({ plan: ROUND, warmupCount: 1 })
    expect(h.guide.ids()).toEqual(['guide.session.warmup'])
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    await answer(h, ROUND.problems[0]!, [ROUND.problems[0]!.correct], waitMs)
    return h
  }

  it('a warm-up heart right on the first tap at 3000 ms: the remark 300 ms after the correct line; the advance waits for it', async () => {
    const h = await warmup(3000)
    await advance(KNEW_GAP_MS - 1)
    expect(h.guide.ids()).toEqual(['guide.session.warmup'])
    await advance(1)
    expect(h.guide.ids()).toEqual([
      'guide.session.warmup',
      'guide.session.knew',
    ])
    // The dwell is long over; problem 1 waits for the remark.
    await advance(ADVANCE_AFTER_CORRECT_MS)
    expect(h.voice.last().text).toBe(ROUND.problems[0]!.utterances.correct)
    await startAndEnd(h.guide.lines[1]!)
    expect(h.voice.last().text).toBe(SCORED[0]!.utterances.read)
  })

  it('at 6000 ms: no remark', async () => {
    const h = await warmup(6000)
    await advance(ADVANCE_AFTER_CORRECT_MS)
    expect(h.guide.ids()).toEqual(['guide.session.warmup'])
    expect(h.voice.last().text).toBe(SCORED[0]!.utterances.read)
  })

  it('a scored problem never gets it, however quick; the result carries the 8 first taps (AC 14)', async () => {
    const h = await setup({ plan: { ...ROUND, problems: SCORED } })
    for (let i = 0; i < 8; i++) {
      const p = SCORED[i]!
      await answer(h, p, i === 2 ? [wrongFor(p), p.correct] : [p.correct], 1000)
      await advance(ADVANCE_AFTER_CORRECT_MS + KNEW_GAP_MS)
    }
    expect(h.guide.ids()).toEqual([])
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.firstTapCorrect).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
    ])
  })
})
