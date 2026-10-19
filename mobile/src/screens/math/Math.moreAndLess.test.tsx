/**
 * More and less on Math's screen (content wave 4
 * `design/native/content-wave-4.md` § 2.2–§ 2.5, D1, D3, D4, AC 10, AC 11)
 * with the committed `hundreds-addsub` canon: the start blocks, the number
 * tag and its "+200" / "−30" pill are up from the first frame; on P1–P3
 * and P6 the change blocks drop in or lift out on the read's "more" /
 * "less" and the changed tray's tag reads "?" from the first frame; on P4,
 * P5, P7, P8 nothing moves on the read, every tag shows its start digit,
 * and hint 2 moves the blocks and turns the tag "?". The lead "More and
 * less!" pulses the pill on "More" only. Plus the session end (3-digit
 * taps, § 2.7's classes), a mount before the session is ready (wave 3
 * lesson 2) and Reduce Motion's forms. Driven through fakes of Emma's
 * voice and the session-guide player; silent.
 *
 * Failing-first: written before the stage knew more and less.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
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
import { extendedMathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import { MathScreen, type MathProps, type MathSfx } from './Math'
import type { MathSessionResult, PlayMathUtteranceOptions } from './mathTypes'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }
const LEAD = 'guide.session.intro.hundreds-addsub' as SessionGuideLineId

function canonPlan(stem: string): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}
const PLAN = canonPlan('hundreds-addsub')

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

function fakeSfx(): MathSfx {
  const one = (): Sfx => ({
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

/** A line starts, ticks every word, and ends. */
async function speakAll(line: {
  text?: string
  opts: { onPlay?: () => void; onWordTick?: (i: number) => void }
  resolve: () => void
}) {
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
async function tickTo(
  line: {
    opts: { onPlay?: () => void; onWordTick?: (i: number) => void }
  },
  through: number,
) {
  await act(async () => {
    line.opts.onPlay?.()
    for (let i = 0; i <= through; i++) line.opts.onWordTick?.(i)
  })
  await flush()
}

/** One more word tick of a line already playing (no second `onPlay`). */
async function tickOnly(
  line: { opts: { onWordTick?: (i: number) => void } },
  i: number,
) {
  await act(async () => {
    line.opts.onWordTick?.(i)
  })
  await flush()
}

function stageProps(overrides: Partial<MathProps> = {}) {
  return {
    layout: extendedMathLayout(PORTRAIT, 'more'),
    plan: PLAN,
    audioReady: true,
    focusNode: 'hundreds-addsub' as const,
    planFocusNode: 'hundreds-addsub' as const,
    sfx: fakeSfx(),
    storage: memoryStorage(),
    visibility: VISIBLE,
    onRequestExit: jest.fn(),
    cancelLine: jest.fn(),
    ...overrides,
  }
}

async function setup(overrides: Partial<MathProps> = {}) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const onSessionComplete = jest.fn<void, [MathSessionResult]>()
  await render(
    <MathScreen
      {...stageProps({
        playUtterance: voice.play,
        sessionGuide: guide.player,
        onSessionComplete,
        ...overrides,
      })}
    />,
  )
  await flush()
  return { voice, guide, onSessionComplete }
}

type H = Awaited<ReturnType<typeof setup>>

const count = (re: RegExp) => screen.queryAllByTestId(re, HIDDEN).length
/** The start blocks still in their tray (a lifted one is `-lifted`). */
const flats = () => count(/^math-pv-flat-\d+$/)
const rods = () => count(/^math-pv-rod-\d+$/)
const cubes = () => count(/^math-pv-cube-\d+$/)
const lifted = (kind: string) =>
  count(new RegExp(`^math-pv-${kind}-\\d+-lifted$`))
const dropped = (place: string) =>
  count(new RegExp(`^math-pv-added-${place}-\\d+$`))
const tagText = (place: string) =>
  String(
    screen.getByTestId(`math-pv-tag-${place}-value`, HIDDEN).props.children,
  )
const tags = () => ['hundreds', 'tens', 'ones'].map(tagText)
const numberText = () =>
  String(screen.getByTestId('math-pv-number-value', HIDDEN).props.children)
const pill = () => screen.getByTestId(/^math-pv-number-pill/, HIDDEN)

const chipValues = () =>
  screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    .sort((a, b) => a - b)

/** Long enough for any answer to move on (the 1.2 s dwell, < 4 s). */
const SETTLE_MS = 2500

async function answerRight(h: H, i: number) {
  const read = h.voice.last()
  expect(read.text).toBe(PLAN.problems[i]!.utterances.read)
  await speakAll(read)
  await fireEvent.press(
    screen.getByTestId(`math-chip-${PLAN.problems[i]!.correct}`),
  )
  await flush()
  await speakAll(h.voice.last())
  await advance(SETTLE_MS)
}

async function toProblem(h: H, n: number) {
  for (let i = 0; i < n - 1; i++) await answerRight(h, i)
}

/** Two wrong taps (re-prompt each), then the hint's first line starts. */
async function twoWrongs(h: H, wrong: [number, number]) {
  for (const chip of wrong) {
    await fireEvent.press(screen.getByTestId(`math-chip-${chip}`))
    await speakAll(h.voice.last())
  }
  await advance(HINT_DELAY_AFTER_WRONG_MS)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('P1: 235, two hundred more (AC 10)', () => {
  it('the start blocks, the "+200" pill and the tags 2 → "?", 3, 5 are up from the first frame; chips 435 635 835', async () => {
    await setup()
    const stage = screen.getByTestId('math-place-value')
    expect(stage.props.accessibilityLabel).toBe(
      'Two hundred and thirty-five. What is two hundred more?',
    )
    expect([flats(), rods(), cubes()]).toEqual([2, 3, 5])
    expect(dropped('hundreds')).toBe(0)
    expect(numberText()).toBe('235')
    expect(pill()).toHaveTextContent('+200')
    expect(tags()).toEqual(['?', '3', '5'])
    expect(
      screen.queryByTestId('math-pv-tag-hundreds-filled', HIDDEN),
    ).toBeNull()
    expect(
      screen.getByTestId('math-pv-tag-tens-filled', HIDDEN),
    ).toBeOnTheScreen()
    expect(chipValues()).toEqual([435, 635, 835])
  })

  it('the lead "More and less!" pulses the pill on "More", not on "less"; no tray pulses', async () => {
    const pulses = jest.spyOn(Reanimated, 'withSequence')
    const h = await setup({ sessionIntro: LEAD })
    expect(h.guide.lines.map((l) => l.id)).toEqual([LEAD])
    expect(h.voice.lines).toHaveLength(0)
    pulses.mockClear()
    // More(0) and(1) less!(2)
    await tickTo(h.guide.lines[0]!, 0)
    expect(pulses).toHaveBeenCalledTimes(1)
    await tickTo(h.guide.lines[0]!, 2)
    expect(pulses).toHaveBeenCalledTimes(1)
    expect(count(/^math-pv-tray-\w+-pulsed$/)).toBe(0)
    await act(async () => h.guide.lines[0]!.resolve())
    await flush()
    await advance(SESSION_GUIDE_GAP_MS)
    expect(h.voice.last().text).toBe(PLAN.problems[0]!.utterances.read)
  })

  it('two flats drop in on the tick of "more", 90 ms apart, with no pill of their own', async () => {
    const delays = jest.spyOn(Reanimated, 'withDelay')
    const springs = jest.spyOn(Reanimated, 'withSpring')
    const h = await setup()
    const read = h.voice.last()
    // Two(0) hundred(1) and(2) thirty-five.(3) What(4) is(5) two(6)
    // hundred(7) more?(8)
    await tickTo(read, 6)
    expect(pill().props.testID).toBe('math-pv-number-pill')
    await tickTo(read, 7)
    // The pill pulses on the change word, "hundred".
    expect(pill().props.testID).toBe('math-pv-number-pill-pulsed')
    expect(dropped('hundreds')).toBe(0)
    delays.mockClear()
    springs.mockClear()
    await tickTo(read, 8)
    expect(dropped('hundreds')).toBe(2)
    expect(flats()).toBe(2)
    expect(screen.queryByTestId('math-pv-added-pill', HIDDEN)).toBeNull()
    // hundreds' added-block spring per block, 90 ms apart.
    expect(
      springs.mock.calls.filter(([, cfg]) => cfg?.stiffness === 220),
    ).toHaveLength(2)
    const d = delays.mock.calls.map(([ms]) => ms)
    expect(d).toContain(0)
    expect(d).toContain(90)
    // The tag stays "?" until her answer.
    expect(tagText('hundreds')).toBe('?')
  })

  it('a right tap ticks the tag to 4 and the number tag to 435 as its pill fades', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-435'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Four hundred and thirty-five!')
    expect(tags()).toEqual(['4', '3', '5'])
    expect(numberText()).toBe('435')
    expect(
      screen.getByTestId('math-pv-number-pill-faded', HIDDEN),
    ).toBeOnTheScreen()
  })

  it('a right tap during the read drops the flats fast', async () => {
    const springs = jest.spyOn(Reanimated, 'withSpring')
    const h = await setup()
    await tickTo(h.voice.last(), 3)
    springs.mockClear()
    await fireEvent.press(screen.getByTestId('math-chip-435'))
    await flush()
    expect(dropped('hundreds')).toBe(2)
    expect(
      springs.mock.calls.filter(
        ([, cfg]) => cfg?.stiffness === 300 && cfg?.damping === 22,
      ),
    ).toHaveLength(2)
    expect(tags()).toEqual(['4', '3', '5'])
  })

  it('hint 2 ripples the tray instead (the flats already moved)', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await twoWrongs(h, [635, 835])
    expect(h.voice.last().text).toBe('Look at the hundreds.')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Two more hundreds.')
    expect(dropped('hundreds')).toBe(2)
    expect(tagText('hundreds')).toBe('?')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('What is two hundred more?')
  })
})

describe('P2: 324, thirty more (D3)', () => {
  it('three rods drop in on "more"; the tens tag is "?"; chips 354 374 394', async () => {
    const h = await setup()
    await toProblem(h, 2)
    expect(tags()).toEqual(['3', '?', '4'])
    expect(pill()).toHaveTextContent('+30')
    expect(chipValues()).toEqual([354, 374, 394])
    await speakAll(h.voice.last())
    expect(dropped('tens')).toBe(3)
    expect(rods()).toBe(2)
  })
})

describe('P4: 532, thirty more, worked from the tag (AC 11)', () => {
  it('nothing moves on the read and the tags read 5, 3, 2; a right tap ticks the tens 3 → 6', async () => {
    const h = await setup()
    await toProblem(h, 4)
    expect(tags()).toEqual(['5', '3', '2'])
    await speakAll(h.voice.last())
    expect(dropped('tens')).toBe(0)
    expect(tags()).toEqual(['5', '3', '2'])
    await fireEvent.press(screen.getByTestId('math-chip-562'))
    await flush()
    expect(tags()).toEqual(['5', '6', '2'])
    expect(dropped('tens')).toBe(3)
    expect(numberText()).toBe('562')
  })
})

describe('P6: 653, two hundred less (AC 11)', () => {
  it('the hundreds tag reads "?" from the first frame; the "−200" pill; two flats lift out on "less"', async () => {
    const h = await setup()
    await toProblem(h, 6)
    const read = h.voice.last()
    expect(read.text).toBe(
      'Six hundred and fifty-three. What is two hundred less?',
    )
    expect(tags()).toEqual(['?', '5', '3'])
    expect(pill()).toHaveTextContent('−200')
    expect([flats(), rods(), cubes()]).toEqual([6, 5, 3])
    expect(chipValues()).toEqual([435, 453, 853])
    // Six(0) hundred(1) and(2) fifty-three.(3) What(4) is(5) two(6)
    // hundred(7) less?(8)
    await tickTo(read, 7)
    expect(lifted('flat')).toBe(0)
    await tickTo(read, 8)
    expect(lifted('flat')).toBe(2)
    expect(flats()).toBe(4)
  })

  it('the lift-out: each block rises 24 pt and fades over 250 ms, the top one first', async () => {
    const timings = jest.spyOn(Reanimated, 'withTiming')
    const delays = jest.spyOn(Reanimated, 'withDelay')
    const h = await setup()
    await toProblem(h, 6)
    timings.mockClear()
    delays.mockClear()
    await speakAll(h.voice.last())
    const calls = timings.mock.calls.map(([to, cfg]) => [to, cfg?.duration])
    expect(calls.filter(([to, ms]) => to === -24 && ms === 250)).toHaveLength(2)
    expect(calls.filter(([to, ms]) => to === 0 && ms === 250)).toHaveLength(2)
    expect(delays.mock.calls.map(([ms]) => ms)).toContain(90)
  })

  it('"−" is drawn as the "+" is: the same face and size (D4)', async () => {
    const h = await setup()
    const plus = StyleSheet.flatten(
      screen.getByText('+200', HIDDEN).props.style,
    )
    await toProblem(h, 6)
    const minus = StyleSheet.flatten(
      screen.getByText('−200', HIDDEN).props.style,
    )
    expect(minus.fontFamily).toBe(plus.fontFamily)
    expect(minus.fontSize).toBe(plus.fontSize)
    expect(minus.fontWeight).toBe(plus.fontWeight)
    expect(minus.color).toBe(plus.color)
  })
})

describe('P7: 765, thirty less, worked from the tag (AC 11)', () => {
  it('nothing moves on the read; the tags read 7, 6, 5; hint 2 lifts three rods and turns the tens tag "?"', async () => {
    const h = await setup()
    await toProblem(h, 7)
    expect(tags()).toEqual(['7', '6', '5'])
    expect(pill()).toHaveTextContent('−30')
    await speakAll(h.voice.last())
    expect(lifted('rod')).toBe(0)
    expect(tags()).toEqual(['7', '6', '5'])
    await twoWrongs(h, [795, 753])
    expect(h.voice.last().text).toBe('Look at the tens.')
    expect(tags()).toEqual(['7', '6', '5'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Take away three tens.')
    expect(lifted('rod')).toBe(3)
    expect(rods()).toBe(3)
    expect(tags()).toEqual(['7', '?', '5'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('What is thirty less?')
  })

  it('the given answer lifts the rods at once and rings the tens tag', async () => {
    const h = await setup()
    await toProblem(h, 7)
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-795'))
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-753'))
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-795'))
    await speakAll(h.voice.last())
    expect(h.voice.lines.map((l) => l.text)).toContain(
      'This one is seven hundred and thirty-five.',
    )
    expect(lifted('rod')).toBe(3)
    expect(
      screen.getByTestId('math-pv-tag-ring-tens', HIDDEN),
    ).toBeOnTheScreen()
    expect(screen.queryByTestId('math-pv-tag-ring-hundreds', HIDDEN)).toBeNull()
    expect(screen.queryByTestId('math-pv-tag-ring-ones', HIDDEN)).toBeNull()
    expect(tagText('tens')).toBe('3')
  })
})

describe('the session end (§ 2.6, AC 3)', () => {
  it('records the 8 three-digit taps and § 2.7’s classes', async () => {
    const h = await setup()
    for (let i = 0; i < 8; i++) await answerRight(h, i)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemAnswerValue).toEqual([
      435, 354, 726, 562, 645, 453, 735, 328,
    ])
    expect(result.perProblemDistractorClass).toEqual([
      'gentle',
      'gentle',
      'gentle',
      'wrong-place',
      'wrong-place',
      'wrong-op',
      'wrong-op',
      'wrong-place',
    ])
    expect(result.firstTapCorrect).toEqual(Array(8).fill(true))
  })
})

describe('a mount before the session is ready (wave 3 lesson 2)', () => {
  it('Math mounts on the static plan with audio not ready; the more-and-less plan then shows "?" and drops on its read', async () => {
    const voice = fakeVoice()
    const guide = fakeGuide()
    const view = await render(
      <MathScreen
        {...stageProps({
          plan: undefined,
          audioReady: false,
          playUtterance: voice.play,
          sessionGuide: guide.player,
        })}
      />,
    )
    await flush()
    expect(screen.getByTestId('math-getting-ready')).toBeOnTheScreen()
    await view.rerender(
      <MathScreen
        {...stageProps({
          playUtterance: voice.play,
          sessionGuide: guide.player,
          sessionIntro: LEAD,
        })}
      />,
    )
    await flush()
    expect(guide.lines.map((l) => l.id)).toEqual([LEAD])
    expect(tags()).toEqual(['?', '3', '5'])
    await speakAll(guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    const read = voice.last()
    expect(read.text).toBe(PLAN.problems[0]!.utterances.read)
    expect(chipValues()).toEqual([435, 635, 835])
    await speakAll(read)
    expect(dropped('hundreds')).toBe(2)
  })
})

describe('Reduce Motion (§ 2.5 brackets)', () => {
  /** [to, duration] of every timing; [delay, target] of every delay (the
   *  mock's withTiming returns its target). */
  function spies() {
    const timings = jest.spyOn(Reanimated, 'withTiming')
    const delays = jest.spyOn(Reanimated, 'withDelay')
    const springs = jest.spyOn(Reanimated, 'withSpring')
    return {
      clear: () => [timings, delays, springs].forEach((s) => s.mockClear()),
      timings: () => timings.mock.calls.map(([to, cfg]) => [to, cfg?.duration]),
      delays: () => delays.mock.calls.map(([ms, next]) => [ms, next]),
      springs: () => springs.mock.calls.map(([, cfg]) => cfg?.stiffness),
    }
  }

  it('a drop-in is a 200 ms crossfade per block, 90 ms apart, no fall', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const s = spies()
    const h = await setup()
    // Up to "hundred", then "more?" alone.
    await tickTo(h.voice.last(), 7)
    s.clear()
    await tickOnly(h.voice.last(), 8)
    expect(dropped('hundreds')).toBe(2)
    expect(
      s.timings().filter(([to, ms]) => to === 1 && ms === 200).length,
    ).toBeGreaterThanOrEqual(2)
    expect(s.delays()).toContainEqual([90, 1])
    expect(s.springs()).not.toContain(220)
  })

  it('a lift-out is a 200 ms fade, 90 ms apart, no rise', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const s = spies()
    const h = await setup()
    await toProblem(h, 6)
    await tickTo(h.voice.last(), 7)
    s.clear()
    await tickOnly(h.voice.last(), 8)
    expect(lifted('flat')).toBe(2)
    expect(
      s.timings().filter(([to, ms]) => to === 0 && ms === 200).length,
    ).toBeGreaterThanOrEqual(2)
    expect(s.delays()).toContainEqual([90, 0])
    expect(s.timings().filter(([to]) => to === -24)).toHaveLength(0)
    expect(
      s.timings().filter(([to, ms]) => to === 0 && ms === 250),
    ).toHaveLength(0)
  })
})

describe("hundreds' own P6 is unchanged", () => {
  it('the start digits and the "+10" pill, no drop on the read; hint 2 drops one rod with its own pill', async () => {
    const hundreds = canonPlan('hundreds')
    const h = await setup({
      plan: hundreds,
      focusNode: 'hundreds',
      planFocusNode: 'hundreds',
    })
    for (let i = 0; i < 5; i++) {
      await speakAll(h.voice.last())
      await fireEvent.press(
        screen.getByTestId(`math-chip-${hundreds.problems[i]!.correct}`),
      )
      await flush()
      await speakAll(h.voice.last())
      await advance(SETTLE_MS)
    }
    expect(tags()).toEqual(['2', '4', '3'])
    expect(pill()).toHaveTextContent('+10')
    await speakAll(h.voice.last())
    expect(screen.queryByTestId(/^math-pv-added-/, HIDDEN)).toBeNull()
    await twoWrongs(h, [244, 343])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('One more ten.')
    expect(screen.getByTestId('math-pv-added-tens', HIDDEN)).toBeOnTheScreen()
    expect(screen.getByTestId('math-pv-added-pill', HIDDEN)).toHaveTextContent(
      '+10',
    )
    expect(tagText('tens')).toBe('5')
  })
})
