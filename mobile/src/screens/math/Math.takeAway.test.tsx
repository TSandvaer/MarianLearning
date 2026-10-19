/**
 * The take-away picture on Math's screen (`design/native/take-away-picture.md`
 * K1–K9, § 3–§ 6, AC 4–13) with the committed `sub-to-10` and `sub-to-20`
 * canon: the minuend's flowers in a ten-frame (a double ten-frame on
 * sub-to-20, its ten never moving), the taken flowers lifting on the read's
 * "away" / "minus" in P1–P3 of a forward session and at hint 3 everywhere
 * else, fast on a right tap, at once on the given answer, and staying pale
 * at 0.35. Ripples on hints 1–2 (sub-to-20's ten as one beat), the flash
 * first, a wrong tap that cuts the read, Reduce Motion, rotation, the
 * background and a mount before the session is ready. Driven through fakes
 * of Emma's voice and the session-guide player; silent.
 *
 * Failing-first: written before the picture existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_HOLD_MS,
} from '@marian/core/math/dotCard'
import type {
  ExtendedMathProblem,
  ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  STATIC_SESSION_PLANS,
  type MathSessionPlan,
} from '@marian/core/math/sessionPlans'
import type { SkillNode } from '@marian/core/progress'
import { HINT_DELAY_AFTER_WRONG_MS } from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { REPO_ROOT } from '../../../test/webSource'
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
import { MathScreen, type MathProps, type MathSfx } from './Math'
import type { PlayMathUtteranceOptions } from './mathTypes'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const LANDSCAPE: Viewport = { width: 667, height: 375, insets: NO_INSETS }
const IPAD: Viewport = {
  width: 744,
  height: 1133,
  insets: { top: 24, bottom: 20, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

function canonPlan(stem: string): MathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan)
}
/** 5−5, 6−3, 9−1, 8−2, 10−3, 10−7, 7−3, 6−4. */
const SUB10 = canonPlan('sub-to-10')
/** 11−1, 12−2, 13−3, 14−2, 15−5, 15−3, 17−5, 18−6. */
const SUB20 = canonPlan('sub-to-20')
/** P3 is "Fifteen minus three.", a two-digit step's problem. */
const TWO_DIGIT = canonPlan('two-digit-addsub')
/** 3+2, …: addition keeps its counting row. */
const ADD = STATIC_SESSION_PLANS[0]!

type ArithProblem = Extract<ExtendedMathProblem, { kind: 'arithmetic' }>
const arith = (p: MathSessionPlan['problems'][number], index: number) =>
  ({ ...p, index, kind: 'arithmetic' }) as ArithProblem
function round(
  problems: ExtendedMathProblem[],
  id = 'round',
): ExtendedMathSessionPlan {
  return { id, label: id, problems }
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

function fakeGuide() {
  const lines: {
    id: SessionGuideLineId
    opts: LineCallbacks
    resolve: () => void
  }[] = []
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

function fakeSfx(): MathSfx & Record<keyof MathSfx, Sfx & { play: jest.Mock }> {
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

function fakeVisibility() {
  let hidden = false
  const listeners = new Set<() => void>()
  const store: AppVisibility = {
    getIsHidden: () => hidden,
    subscribe(l) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
  return {
    store,
    set(next: boolean) {
      hidden = next
      for (const l of Array.from(listeners)) l()
    },
  }
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

type Line = {
  text?: string
  opts: { onPlay?: () => void; onWordTick?: (i: number) => void }
  resolve: () => void
}

/** A line starts, ticks every word, and ends. */
async function speakAll(line: Line) {
  await act(async () => {
    line.opts.onPlay?.()
    const words = (line.text ?? '').split(/\s+/).filter(Boolean)
    for (let i = 0; i < Math.max(1, words.length); i++)
      line.opts.onWordTick?.(i)
    line.resolve()
  })
  await flush()
}

/** The line starts and ticks words 0..`through`. */
async function tickTo(line: Line, through: number) {
  await act(async () => {
    line.opts.onPlay?.()
    for (let i = 0; i <= through; i++) line.opts.onWordTick?.(i)
  })
  await flush()
}

/** One more word tick of a line already playing. */
async function tickOnly(line: Line, i: number) {
  await act(async () => {
    line.opts.onWordTick?.(i)
  })
  await flush()
}

async function setup(
  overrides: Partial<MathProps> = {},
  viewport: Viewport = PORTRAIT,
) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const sfx = fakeSfx()
  const visibility = fakeVisibility()
  const props = (v: Viewport): MathProps => ({
    layout: mathLayout(v),
    plan: SUB10,
    audioReady: true,
    focusNode: 'sub-to-10',
    playUtterance: voice.play,
    sessionGuide: guide.player,
    sfx,
    storage: memoryStorage(),
    visibility: visibility.store,
    onRequestExit: jest.fn(),
    cancelLine: jest.fn(),
    ...overrides,
  })
  const utils = await render(<MathScreen {...props(viewport)} />)
  await flush()
  return {
    voice,
    guide,
    sfx,
    visibility,
    rerender: (v: Viewport) => utils.rerender(<MathScreen {...props(v)} />),
    unmount: utils.unmount,
  }
}

type H = Awaited<ReturnType<typeof setup>>

/** Every flower: `<frame>-<slot>` plus its `-taken` / `-pulsing` marks. */
function flowerIds(): {
  id: string
  taken: boolean
  pulsing: boolean
}[] {
  return screen
    .queryAllByTestId(/^math-take-away-flower-/, HIDDEN)
    .map((el) => {
      const m =
        /^math-take-away-flower-(ten|ones)-(\d+)(-taken)?(-pulsing)?$/.exec(
          String(el.props.testID),
        )
      if (m === null) throw new Error(`bad testID ${el.props.testID}`)
      return {
        id: `${m[1]}-${m[2]}`,
        taken: m[3] !== undefined,
        pulsing: m[4] !== undefined,
      }
    })
}
const sortIds = (ids: string[]) =>
  [...ids].sort((a, b) => {
    const [fa, sa] = a.split('-')
    const [fb, sb] = b.split('-')
    return fa === fb ? Number(sa) - Number(sb) : fa === 'ten' ? -1 : 1
  })
const all = () => sortIds(flowerIds().map((f) => f.id))
const taken = () =>
  sortIds(
    flowerIds()
      .filter((f) => f.taken)
      .map((f) => f.id),
  )
const pulsing = () =>
  sortIds(
    flowerIds()
      .filter((f) => f.pulsing)
      .map((f) => f.id),
  )
const ones = (...slots: number[]) => slots.map((s) => `ones-${s}`)
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
const tens = () => range(1, 10).map((s) => `ten-${s}`)

const chipValues = () =>
  screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))

/** Long enough for any answer to move on (the 1.2 s dwell, < 4 s). */
const SETTLE_MS = 2500

async function answerRight(h: H, problem: ExtendedMathProblem | undefined) {
  const read = h.voice.last()
  expect(read.text).toBe(problem!.utterances.read)
  await speakAll(read)
  await fireEvent.press(screen.getByTestId(`math-chip-${problem!.correct}`))
  await flush()
  await speakAll(h.voice.last())
  await advance(SETTLE_MS)
}

async function toProblem(h: H, plan: MathSessionPlan, n: number) {
  for (let i = 0; i < n - 1; i++)
    await answerRight(h, arith(plan.problems[i]!, i + 1))
}

async function tapWrong(h: H, correct: number) {
  const wrong = chipValues().find((v) => v !== correct)!
  await fireEvent.press(screen.getByTestId(`math-chip-${wrong}`))
  await flush()
  expect(h.voice.last().text).toBe('Hmm... try again?')
}

/** Two wrong taps, each re-prompt said; hint 1 is due. */
async function twoWrongTaps(h: H, correct: number) {
  for (let i = 0; i < 2; i++) {
    await tapWrong(h, correct)
    await speakAll(h.voice.last())
  }
}

/** Two wrong taps, then hint 1 starts. */
async function twoWrongs(h: H, correct: number) {
  await twoWrongTaps(h, correct)
  await advance(HINT_DELAY_AFTER_WRONG_MS)
}

/** The guide's line (an opener, a heart's "Remember this one?"), if any,
 *  then the gap before the read. */
async function pastGuide(h: H) {
  if (h.guide.lines.length === 0) return
  await speakAll(h.guide.lines.at(-1)!)
  await advance(SESSION_GUIDE_GAP_MS)
}

/** What the spied `withSequence` returns for a flower's ripple (1 → 1.1 →
 *  1), so its `withDelay` can be told from the chips' and the HUD's. */
const RIPPLE = 1.1

function spies() {
  const timings = jest.spyOn(Reanimated, 'withTiming')
  const delays = jest.spyOn(Reanimated, 'withDelay')
  jest
    .spyOn(Reanimated, 'withSequence')
    .mockImplementation(((...anims: unknown[]) =>
      anims[0] === 1.1 && anims[1] === 1
        ? RIPPLE
        : 0) as unknown as typeof Reanimated.withSequence)
  const delayed = (next: number) =>
    delays.mock.calls.filter(([, n]) => n === next).map(([ms]) => ms)
  return {
    clear: () => [timings, delays].forEach((s) => s.mockClear()),
    /** [to, duration] of every timing. */
    timings: () =>
      timings.mock.calls.map(([to, cfg]) => [to, cfg?.duration] as const),
    count: (to: number, ms: number) =>
      timings.mock.calls.filter(([t, cfg]) => t === to && cfg?.duration === ms)
        .length,
    /** Each flower's ripple delay, one per flower that ripples. */
    ripples: () => delayed(RIPPLE),
    /** Each lifted flower's delay (its pale fade). */
    lifts: () => delayed(0.35),
  }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('K1: where the picture draws (AC 5)', () => {
  it('a sub-to-10 problem: one ten-frame with the minuend’s flowers', async () => {
    await setup()
    expect(screen.getByTestId('math-take-away', HIDDEN)).toBeOnTheScreen()
    expect(screen.getByTestId('math-take-away-frame', HIDDEN)).toBeOnTheScreen()
    expect(screen.queryByTestId('math-take-away-frame-ten', HIDDEN)).toBeNull()
    expect(all()).toEqual(ones(1, 2, 3, 4, 5))
    expect(screen.queryByTestId('math-visual-groups', HIDDEN)).toBeNull()
    // The equation keeps its "−".
    expect(screen.getByText('−')).toBeOnTheScreen()
  })

  it('a sub-to-20 problem: a full ten and the ones digit’s frame', async () => {
    await setup({ plan: SUB20, focusNode: 'sub-to-20' })
    expect(
      screen.getByTestId('math-take-away-frame-ten', HIDDEN),
    ).toBeOnTheScreen()
    expect(
      screen.getByTestId('math-take-away-frame-ones', HIDDEN),
    ).toBeOnTheScreen()
    expect(all()).toEqual([...tens(), ...ones(1)])
  })

  it('two-digit-addsub’s "Fifteen minus three." draws nothing', async () => {
    const p3 = arith(TWO_DIGIT.problems[2]!, 3)
    expect(p3.utterances.read).toBe('Fifteen minus three. How many are left?')
    await setup({
      plan: round([p3]),
      focusNode: 'two-digit-addsub' as SkillNode,
    })
    expect(screen.getByText('−')).toBeOnTheScreen()
    expect(screen.queryByTestId('math-take-away', HIDDEN)).toBeNull()
  })

  it('in a review, a sub-to-20 block draws and a two-digit block doesn’t', async () => {
    const h = await setup({
      plan: round(
        [arith(SUB20.problems[5]!, 1), arith(TWO_DIGIT.problems[2]!, 2)],
        'review',
      ),
      review: true,
      problemNodes: ['sub-to-20', 'two-digit-addsub' as SkillNode],
      focusNode: 'add-to-10',
    })
    await pastGuide(h)
    expect(h.voice.last().text).toBe('Fifteen minus three. How many are left?')
    expect(all()).toEqual([...tens(), ...ones(1, 2, 3, 4, 5)])
    await answerRight(h, arith(SUB20.problems[5]!, 1))
    expect(h.voice.last().text).toBe('Fifteen minus three. How many are left?')
    expect(screen.queryByTestId('math-take-away', HIDDEN)).toBeNull()
  })

  it('addition still draws its counting row', async () => {
    await setup({ plan: ADD, focusNode: 'add-to-10' })
    expect(screen.getByTestId('math-visual-groups', HIDDEN)).toBeOnTheScreen()
    expect(screen.queryByTestId('math-take-away', HIDDEN)).toBeNull()
  })
})

describe('AC 4: the equation never moves on a phone', () => {
  const rowHeight = () =>
    StyleSheet.flatten(
      screen.getByTestId('math-visual-row', HIDDEN).props.style,
    ).height

  it.each([
    ['portrait', PORTRAIT, 80],
    ['landscape', LANDSCAPE, 64],
  ] as const)(
    '%s: add-to-10, sub-to-10 and sub-to-20 keep the same row height',
    async (_name, v, slot) => {
      const heights: number[] = []
      for (const [plan, focusNode] of [
        [ADD, 'add-to-10'],
        [SUB10, 'sub-to-10'],
        [SUB20, 'sub-to-20'],
      ] as const) {
        const h = await setup({ plan, focusNode }, v)
        heights.push(rowHeight())
        await act(async () => h.unmount())
      }
      expect(heights).toEqual([slot, slot, slot])
    },
  )

  it('tablet: the row takes the frame’s height (sub-to-10 120, sub-to-20 104)', async () => {
    const h = await setup({}, IPAD)
    expect(rowHeight()).toBe(120)
    await act(async () => h.unmount())
    await setup({ plan: SUB20, focusNode: 'sub-to-20' }, IPAD)
    expect(rowHeight()).toBe(104)
  })
})

describe('sub-to-10 P2, 6 − 3, forward, no flash (AC 6)', () => {
  it('6 flowers from the first frame; slots 6, 5, 4 lift on the read’s "away", 90 ms apart, and stay pale at 0.35', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 2)
    expect(all()).toEqual(ones(1, 2, 3, 4, 5, 6))
    expect(taken()).toEqual([])
    const read = h.voice.last()
    expect(read.text).toBe('Six take away three. How many are left?')
    // Six(0) take(1) away(2) three.(3)
    await tickTo(read, 1)
    expect(taken()).toEqual([])
    s.clear()
    await tickOnly(read, 2)
    expect(taken()).toEqual(ones(4, 5, 6))
    // A copy rises 24 pt and fades 1 → 0 over 250 ms; the cell's flower
    // fades 0 → 0.35 over the same 250 ms.
    expect(s.count(-24, 250)).toBe(3)
    expect(s.count(0, 250)).toBe(3)
    expect(s.count(0.35, 250)).toBe(3)
    // In slot order 4, 5, 6: the last placed (6) lifts first.
    expect(s.lifts()).toEqual([180, 90, 0])
    // The flowers that stay never move.
    await speakAll(read)
    expect(taken()).toEqual(ones(4, 5, 6))
    expect(all()).toEqual(ones(1, 2, 3, 4, 5, 6))
  })
})

describe('the flash first (AC 7)', () => {
  it('the frame is at opacity 0 under the minuend card; a tick that came during it lifts after the frame fades in', async () => {
    const h = await setup({ subitisingSubScaffoldActive: true })
    expect(
      screen.getByTestId('math-sub-minuend-card', HIDDEN),
    ).toBeOnTheScreen()
    const rowOpacity = () =>
      StyleSheet.flatten(
        screen.getByTestId('math-take-away', HIDDEN).props.style,
      ).opacity
    expect(rowOpacity()).toBe(0)
    // Five(0) take(1) away(2): the tick comes while the card shows.
    await tickTo(h.voice.last(), 2)
    expect(taken()).toEqual([])
    await advance(DOT_CARD_FADE_IN_MS)
    await advance(DOT_CARD_HOLD_MS)
    await advance(DOT_CARD_FADE_OUT_MS)
    expect(screen.queryByTestId('math-sub-minuend-card', HIDDEN)).toBeNull()
    // The frame fades in over 250 ms first.
    expect(taken()).toEqual([])
    await advance(250)
    expect(taken()).toEqual(ones(1, 2, 3, 4, 5))
  })
})

describe('sub-to-10 P4, 8 − 2: the faded form (AC 8)', () => {
  it('nothing lifts on the read; hints 1 and 2 ripple all 8; hint 3 lifts slots 8 and 7 on its "away"', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 4)
    await speakAll(h.voice.last())
    expect(taken()).toEqual([])
    await twoWrongTaps(h, 6)
    s.clear()
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(pulsing()).toEqual(ones(...range(1, 8)))
    // One by one in reading order, 150 ms apart.
    expect(s.ripples()).toEqual(range(0, 7).map((k) => k * 150))
    s.clear()
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Eight flowers.')
    expect(pulsing()).toEqual(ones(...range(1, 8)))
    expect(s.ripples()).toEqual(range(0, 7).map((k) => k * 150))
    await speakAll(h.voice.last())
    const hint3 = h.voice.last()
    expect(hint3.text).toBe('Take away two. How many now?')
    // Hint 3 lifts; nothing ripples.
    expect(pulsing()).toEqual([])
    await tickTo(hint3, 0)
    expect(taken()).toEqual([])
    await tickOnly(hint3, 1)
    expect(taken()).toEqual(ones(7, 8))
  })

  it('P2: after the read’s lift, hint 3 ripples slots 1–3 and nothing lifts again', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 2)
    await speakAll(h.voice.last())
    expect(taken()).toEqual(ones(4, 5, 6))
    await twoWrongs(h, 3)
    // Hint 1 ripples the pale flowers too.
    expect(pulsing()).toEqual(ones(...range(1, 6)))
    await speakAll(h.voice.last())
    s.clear()
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Take away three. How many now?')
    expect(pulsing()).toEqual(ones(1, 2, 3))
    expect(s.ripples()).toEqual([0, 150, 300])
    s.clear()
    await speakAll(h.voice.last())
    expect(taken()).toEqual(ones(4, 5, 6))
    expect(s.count(0.35, 250)).toBe(0)
  })

  it('P1, 5 − 5: after the lift, hint 3 has nothing left to ripple', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    expect(taken()).toEqual(ones(1, 2, 3, 4, 5))
    await twoWrongs(h, 0)
    await speakAll(h.voice.last())
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Take away five. How many now?')
    expect(pulsing()).toEqual([])
  })
})

describe('sub-to-20 (AC 9)', () => {
  it('P1, 11 − 1: the ones frame’s slot 1 lifts on "minus"; the ten never moves', async () => {
    const h = await setup({ plan: SUB20, focusNode: 'sub-to-20' })
    const read = h.voice.last()
    expect(read.text).toBe('Eleven minus one. How many are left?')
    await tickTo(read, 0)
    expect(taken()).toEqual([])
    await tickOnly(read, 1)
    expect(taken()).toEqual(ones(1))
  })

  it('P8, 18 − 6: nothing on the read; hints 1–2 pulse the ten together, then the ones one by one; hint 3 lifts slots 8 to 3', async () => {
    const s = spies()
    const h = await setup({ plan: SUB20, focusNode: 'sub-to-20' })
    await toProblem(h, SUB20, 8)
    expect(h.voice.last().text).toBe('Eighteen minus six. How many are left?')
    await speakAll(h.voice.last())
    expect(taken()).toEqual([])
    await twoWrongTaps(h, 12)
    s.clear()
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(pulsing()).toEqual([...tens(), ...ones(...range(1, 8))])
    // The ten pulses as one beat at 0 ms, then the ones from 150 ms.
    const tenThenOnes = [
      ...Array<number>(10).fill(0),
      ...range(1, 8).map((k) => k * 150),
    ]
    expect([...s.ripples()].sort((a, b) => a - b)).toEqual(tenThenOnes)
    s.clear()
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Eighteen flowers.')
    expect([...s.ripples()].sort((a, b) => a - b)).toEqual(tenThenOnes)
    await speakAll(h.voice.last())
    const hint3 = h.voice.last()
    expect(hint3.text).toBe('Take away six. How many now?')
    await tickTo(hint3, 1)
    expect(taken()).toEqual(ones(3, 4, 5, 6, 7, 8))
    expect(
      flowerIds().filter((f) => f.id.startsWith('ten-') && f.taken),
    ).toEqual([])
  })
})

describe('fading: reviews, peeks and warm-up hearts lift at hint 3 (AC 10)', () => {
  async function liftsAtHint3(h: H, problem: ArithProblem) {
    await pastGuide(h)
    expect(h.voice.last().text).toBe(problem.utterances.read)
    expect(problem.index).toBeLessThanOrEqual(3)
    await speakAll(h.voice.last())
    expect(taken()).toEqual([])
    await twoWrongs(h, problem.correct)
    await speakAll(h.voice.last())
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe(problem.utterances.hint3)
    await tickTo(h.voice.last(), 1)
    expect(taken().length).toBe(problem.addendB)
  }

  it('a review', async () => {
    const p = arith(SUB10.problems[1]!, 2)
    const h = await setup({ plan: round([p], 'review'), review: true })
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    await liftsAtHint3(h, p)
  })

  it('a peek', async () => {
    const problems = SUB10.problems.slice(0, 3).map((p, i) => arith(p, i + 1))
    const h = await setup({
      plan: round(problems, 'peek'),
      peek: 'sub-to-10',
      problemNodes: problems.map(() => 'sub-to-10' as const),
    })
    await liftsAtHint3(h, problems[0]!)
  })

  it('a warm-up heart', async () => {
    const heart = arith(SUB10.problems[1]!, 1)
    const scored = SUB10.problems.map((p, i) => arith(p, i + 1))
    const h = await setup({
      plan: round([heart, ...scored]),
      warmupCount: 1,
    })
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
    await liftsAtHint3(h, heart)
  })
})

describe('taps (AC 11, K9)', () => {
  it('a wrong tap that cuts a P1–P3 read before "away" lifts nothing; hint 3 lifts', async () => {
    const h = await setup()
    const read = h.voice.last()
    // Five(0) take(1)
    await tickTo(read, 1)
    await tapWrong(h, 0)
    // A straggler tick from the cut read lifts nothing.
    await tickOnly(read, 2)
    await act(async () => read.reject(new Error('cancelled')))
    await flush()
    expect(taken()).toEqual([])
    await speakAll(h.voice.last())
    expect(taken()).toEqual([])
    await tapWrong(h, 0)
    await speakAll(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    await speakAll(h.voice.last())
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Take away five. How many now?')
    expect(taken()).toEqual([])
    await tickTo(h.voice.last(), 1)
    expect(taken()).toEqual(ones(1, 2, 3, 4, 5))
  })

  it('a right tap before any lift lifts fast (150 ms), 90 ms apart; the celebration is as today', async () => {
    const s = spies()
    const h = await setup()
    await tickTo(h.voice.last(), 0)
    s.clear()
    await fireEvent.press(screen.getByTestId('math-chip-0'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Zero!')
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(taken()).toEqual(ones(1, 2, 3, 4, 5))
    expect(s.count(0.35, 150)).toBe(5)
    expect(s.count(-24, 150)).toBe(5)
    // Slots 1–5: slot 5 first.
    expect(s.lifts()).toEqual([360, 270, 180, 90, 0])
  })

  it('a 3rd wrong during hint 1 lands the taken flowers pale at once', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 4)
    await speakAll(h.voice.last())
    await twoWrongs(h, 6)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    s.clear()
    await tapWrong(h, 6)
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('This one is six.')
    expect(taken()).toEqual(ones(7, 8))
    expect(pulsing()).toEqual([])
    expect(s.timings().filter(([to]) => to === 0.35 || to === -24)).toEqual([])
  })
})

describe('Reduce Motion (AC 12)', () => {
  it('no rise and no ripple: the taken flowers turn pale in place over 200 ms, 90 ms apart', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 2)
    await tickTo(h.voice.last(), 1)
    s.clear()
    await tickOnly(h.voice.last(), 2)
    expect(taken()).toEqual(ones(4, 5, 6))
    expect(s.count(0, 200)).toBe(3)
    expect(s.count(0.35, 200)).toBe(3)
    expect(s.timings().filter(([to]) => to === -24)).toEqual([])
    expect(s.lifts()).toEqual([180, 90, 0])
    await speakAll(h.voice.last())
    await twoWrongTaps(h, 3)
    s.clear()
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(pulsing()).toEqual(ones(...range(1, 6)))
    expect(s.ripples()).toEqual([])
  })
})

describe('rotation and the background (AC 13)', () => {
  it('a rotation mid-lift keeps every flower’s end state and replays nothing', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 2)
    await tickTo(h.voice.last(), 2)
    expect(taken()).toEqual(ones(4, 5, 6))
    s.clear()
    await h.rerender(LANDSCAPE)
    await flush()
    expect(taken()).toEqual(ones(4, 5, 6))
    expect(all()).toEqual(ones(1, 2, 3, 4, 5, 6))
    expect(s.count(0.35, 250)).toBe(0)
    expect(s.timings().filter(([to]) => to === -24 || to === -16)).toEqual([])
  })

  it('the app going to the background mid-lift replays nothing; a lift not started yet starts on its word after the return', async () => {
    const s = spies()
    const h = await setup()
    await toProblem(h, SUB10, 2)
    await tickTo(h.voice.last(), 2)
    s.clear()
    await act(async () => h.visibility.set(true))
    await flush()
    await act(async () => h.visibility.set(false))
    await flush()
    expect(taken()).toEqual(ones(4, 5, 6))
    expect(s.count(0.35, 250)).toBe(0)
    // The next problem's lift still plays on its word.
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    await speakAll(h.voice.last())
    await advance(SETTLE_MS)
    const read = h.voice.last()
    expect(read.text).toBe('Nine take away one. How many are left?')
    await act(async () => h.visibility.set(true))
    await act(async () => h.visibility.set(false))
    await flush()
    s.clear()
    await tickTo(read, 2)
    expect(taken()).toEqual(ones(9))
    expect(s.count(0.35, 250)).toBe(1)
  })
})

describe('a mount before the session is ready (lesson)', () => {
  it('Math mounts with audio not ready on the static plan; the sub-to-10 plan then draws its frame and lifts on its read', async () => {
    const voice = fakeVoice()
    const guide = fakeGuide()
    const base = {
      layout: mathLayout(PORTRAIT),
      focusNode: 'sub-to-10' as const,
      playUtterance: voice.play,
      sessionGuide: guide.player,
      sfx: fakeSfx(),
      storage: memoryStorage(),
      visibility: fakeVisibility().store,
      onRequestExit: jest.fn(),
      cancelLine: jest.fn(),
    }
    const view = await render(
      <MathScreen {...base} plan={undefined} audioReady={false} />,
    )
    await flush()
    expect(screen.getByTestId('math-getting-ready')).toBeOnTheScreen()
    await view.rerender(<MathScreen {...base} plan={SUB10} audioReady />)
    await flush()
    expect(all()).toEqual(ones(1, 2, 3, 4, 5))
    const read = voice.last()
    expect(read.text).toBe('Five take away five. How many are left?')
    await tickTo(read, 2)
    expect(taken()).toEqual(ones(1, 2, 3, 4, 5))
  })
})
