/**
 * Math's same-day review and daily warm-up (native spec
 * `design/native/review-mode-and-warmup-native.md` § 9, AC 12–14), driven
 * through fakes of Emma's session voice and of the session-guide player
 * (the opener and "Remember this one?"). Silent: no player exists here.
 */
import type {
  ExtendedMathProblem,
  ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { STATIC_SESSION_PLANS } from '@marian/core/math/sessionPlans'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  SESSION_GUIDE_GAP_MS,
  type SessionGuideLineId,
  type SessionGuidePlayer,
  type Sfx,
} from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import {
  MathScreen,
  STREAK_CHIME_STAGGER_MS,
  type MathProps,
  type MathSfx,
} from './Math'
import type { MathSessionResult, PlayMathUtteranceOptions } from './mathTypes'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

/** 3+2, 1+4, 4+2, 5+3, 2+5, 6+3, 4+4, 5+5. */
const PLAN = STATIC_SESSION_PLANS[0]
const arith = (i: number, index = i + 1): ExtendedMathProblem => ({
  ...PLAN.problems[i]!,
  index,
  kind: 'arithmetic',
})
const SCORED: ExtendedMathProblem[] = PLAN.problems.map((_, i) => arith(i))
/** Warm-up hearts that repeat scored #3 (4+2) and #4 (5+3). */
const ROUND: ExtendedMathSessionPlan = {
  id: PLAN.id,
  label: PLAN.label,
  problems: [arith(2, 1), arith(3, 2), ...SCORED],
}
const REVIEW_PLAN: ExtendedMathSessionPlan = {
  id: 'review-math',
  label: 'Review',
  problems: SCORED,
}

interface VoiceLine {
  text: string
  opts: PlayMathUtteranceOptions
  resolve: () => void
  reject: (err: Error) => void
}

function fakeVoice() {
  const lines: VoiceLine[] = []
  const play = jest.fn(
    (text: string, opts: PlayMathUtteranceOptions = {}) =>
      new Promise<void>((resolve, reject) => {
        lines.push({ text, opts, resolve, reject })
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
  const player: SessionGuidePlayer & {
    cancelActive: jest.Mock
    unload: jest.Mock
  } = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player }
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

function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
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
  const onSessionComplete = jest.fn<void, [MathSessionResult]>()
  await render(
    <MathScreen
      layout={mathLayout(PORTRAIT)}
      playUtterance={voice.play}
      audioReady
      sfx={sfx}
      storage={memoryStorage()}
      visibility={VISIBLE}
      sessionGuide={guide.player}
      onSessionComplete={onSessionComplete}
      onRequestExit={jest.fn()}
      cancelLine={jest.fn()}
      {...overrides}
    />,
  )
  await flush()
  return { voice, guide, sfx, onSessionComplete }
}

type H = Awaited<ReturnType<typeof setup>>

/** The read starts; she taps `values` in order (the last the right one). */
async function answer(h: H, problem: ExtendedMathProblem, values: number[]) {
  const read = h.voice.last()
  expect(read.text).toBe(problem.utterances.read)
  await act(async () => {
    read.opts.onPlay?.()
  })
  await flush()
  for (const value of values) {
    await fireEvent.press(screen.getByTestId(`math-chip-${value}`))
    await flush()
    const line = h.voice.last()
    if (value === problem.correct) {
      expect(line.text).toBe(problem.utterances.correct)
      await startAndEnd(line)
    } else {
      expect(line.text).toBe(problem.utterances.reprompt)
      await startAndEnd(line)
    }
  }
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

const wrongFor = (p: ExtendedMathProblem) =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
    (v) => v !== p.correct && screen.queryByTestId(`math-chip-${v}`) !== null,
  )!

/** The track is hidden from accessibility (§ 3.2): query it anyway. */
const HIDDEN = { includeHiddenElements: true }

const stardust = () =>
  screen.getByTestId('math-stardust').props.accessibilityLabel as string

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('review (AC 12)', () => {
  it('the opener plays over an empty stage; the stage mounts at its end; the read 400 ms later', async () => {
    const h = await setup({ plan: REVIEW_PLAN, review: true })
    expect(screen.getAllByTestId('math-review-moon', HIDDEN)).toHaveLength(1)
    expect(screen.getAllByTestId(/^math-problem-dot-/, HIDDEN)).toHaveLength(8)
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    expect(h.voice.lines).toHaveLength(0)
    expect(screen.queryByTestId('math-problem')).toBeNull()
    expect(screen.queryByTestId('math-chips')).toBeNull()

    await startAndEnd(h.guide.lines[0]!)
    expect(screen.getAllByTestId('math-review-stage')).toHaveLength(1)
    expect(screen.getAllByTestId('math-chips')).toHaveLength(1)
    expect(h.voice.lines).toHaveLength(0)
    await advance(SESSION_GUIDE_GAP_MS - 1)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.lines.map((l) => l.text)).toEqual([
      PLAN.problems[0]!.utterances.read,
    ])
    // The opener plays once, never again.
    expect(h.guide.lines).toHaveLength(1)
  })

  it('the streak chimes at 3 but grants no +1: 3 right → 3 stardust', async () => {
    const h = await setup({ plan: REVIEW_PLAN, review: true })
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    for (let i = 0; i < 3; i++)
      await answer(h, SCORED[i]!, [SCORED[i]!.correct])
    await advance(STREAK_CHIME_STAGGER_MS)
    expect(h.sfx.chime.play).toHaveBeenCalledTimes(1)
    expect(stardust()).toBe('Stardust: 3')
    expect(h.guide.lines).toHaveLength(1)
  })
})

describe('warm-up (AC 13, 14)', () => {
  it('2 hearts precede 8 beads; "Remember this one?" before each warm-up read, never a scored one; the result counts the 8 only', async () => {
    const h = await setup({ plan: ROUND, warmupCount: 2 })
    expect(screen.getAllByTestId(/^math-warmup-dot-/, HIDDEN)).toHaveLength(2)
    expect(screen.getAllByTestId(/^math-problem-dot-/, HIDDEN)).toHaveLength(8)
    expect(screen.queryByTestId('math-review-moon', HIDDEN)).toBeNull()
    // The stage is up while the warm-up line plays; its chips stay shut.
    expect(screen.getAllByTestId('math-chips')).toHaveLength(1)
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
    expect(h.voice.lines).toHaveLength(0)

    const round = ROUND.problems
    // Warm-up 1 (4+2): wrong first, then right. Warm-up 2 (5+3): right.
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    await answer(h, round[0]!, [wrongFor(round[0]!), round[0]!.correct])
    expect(h.guide.lines).toHaveLength(2)
    await startAndEnd(h.guide.lines[1]!)
    await advance(SESSION_GUIDE_GAP_MS)
    await answer(h, round[1]!, [round[1]!.correct])
    // The 8 scored, all right on the first tap (the repeats of 4+2 / 5+3
    // included, which differ from warm-up 1's first tap).
    for (let i = 2; i < 10; i++) await answer(h, round[i]!, [round[i]!.correct])

    expect(h.guide.lines).toHaveLength(2)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.totalCorrect).toBe(8)
    expect(result.perProblemCorrect).toHaveLength(8)
    expect(result.perProblemCorrect.every(Boolean)).toBe(true)
    expect(result.latencyMs).toHaveLength(8)
    expect(result.perProblemAnswerValue).toEqual(SCORED.map((p) => p.correct))
    expect(result.warmupCorrect).toEqual([false, true])
    // The warm-up's wrong tap broke no streak: 8 in a row.
    expect(result.finalStreak).toBe(8)
    // 8 scored + 3 streak bonuses + 2 warm-up answers.
    expect(result.earnedThisSession).toBe(13)
  })
})
