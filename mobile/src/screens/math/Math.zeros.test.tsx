/**
 * Zeros on Math's screen (content wave 5 `design/native/content-wave-5.md`
 * § 2.2–§ 2.5, D1, D3, AC 10, AC 11, AC 13) with the committed
 * `hundreds-zeros` canon: an empty place is an empty tray (no "0" drawn
 * in it) whose tag reads "?" until hint 2 fills it "0"; the read builds the
 * other places and pulses the empty tray on its word tick; the lead "No
 * tens? Zero tens!" pulses the empty tens tray on both "tens"; P5's name
 * read builds nothing until hint 1, which builds the number and then
 * ripples the empty ones tray; P8 lifts one rod at hint 2 under its "−10"
 * pill. Plus the session end (zero-drop taps, § 2.7's classes), a mount
 * before the session is ready (wave 3 lesson 2) and Reduce Motion's forms.
 * Driven through fakes of Emma's voice and the session-guide player;
 * silent.
 *
 * Failing-first: written before the stage knew zeros.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { HINT_DELAY_AFTER_WRONG_MS } from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
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
import { placeValueHintBuildMs } from './placeValueTiming'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }
const LEAD = 'guide.session.intro.hundreds-zeros' as SessionGuideLineId

function canonPlan(stem: string): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}
const PLAN = canonPlan('hundreds-zeros')

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

function stageProps(overrides: Partial<MathProps> = {}) {
  return {
    layout: extendedMathLayout(PORTRAIT, 'place-value'),
    plan: PLAN,
    audioReady: true,
    focusNode: 'hundreds-zeros' as const,
    planFocusNode: 'hundreds-zeros' as const,
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
const flats = () => count(/^math-pv-flat-\d+$/)
const rods = () => count(/^math-pv-rod-\d+$/)
const cubes = () => count(/^math-pv-cube-\d+$/)
const tagText = (place: string) =>
  String(
    screen.getByTestId(`math-pv-tag-${place}-value`, HIDDEN).props.children,
  )
const tags = () => ['hundreds', 'tens', 'ones'].map(tagText)
/** An empty place's marker: `-ticked` (its read tick), `-rippled` (hint 1),
 *  `-pulsed` (hint 2). */
const zero = (place: string) =>
  String(
    screen.getByTestId(new RegExp(`^math-pv-zero-${place}`), HIDDEN).props
      .testID,
  )
const trayID = (place: string) =>
  String(
    screen.getByTestId(
      new RegExp(`^math-pv-tray-${place}(-pulsed\\d*)?$`),
      HIDDEN,
    ).props.testID,
  )
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

/** Two wrong taps (re-prompt each), then the hint's first step starts. */
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

describe('P1: three hundreds, no tens and five ones (AC 10)', () => {
  it('the first frame: three empty trays, three "?" tags, no "0" drawn; chips 305 505 705', async () => {
    await setup()
    expect([flats(), rods(), cubes()]).toEqual([0, 0, 0])
    expect(tags()).toEqual(['?', '?', '?'])
    expect(zero('tens')).toBe('math-pv-zero-tens')
    // Only the tens place is empty.
    expect(count(/^math-pv-zero-(hundreds|ones)/)).toBe(0)
    expect(chipValues()).toEqual([305, 505, 705])
  })

  it('the lead "No tens? Zero tens!" pulses the empty tens tray on both "tens", and no other tray', async () => {
    const h = await setup({ sessionIntro: LEAD })
    expect(h.guide.lines.map((l) => l.id)).toEqual([LEAD])
    const lead = h.guide.lines[0]!
    // No(0) tens?(1) Zero(2) tens!(3)
    await tickTo(lead, 0)
    expect(trayID('tens')).toBe('math-pv-tray-tens')
    await tickTo(lead, 1)
    expect(trayID('tens')).toBe('math-pv-tray-tens-pulsed')
    await tickTo(lead, 3)
    expect(trayID('tens')).toBe('math-pv-tray-tens-pulsed2')
    expect(trayID('hundreds')).toBe('math-pv-tray-hundreds')
    expect(trayID('ones')).toBe('math-pv-tray-ones')
    await act(async () => lead.resolve())
    await flush()
    await advance(SESSION_GUIDE_GAP_MS)
    expect(h.voice.last().text).toBe(PLAN.problems[0]!.utterances.read)
  })

  it('the read drops 3 flats on "hundreds", pulses the empty tens tray on "tens" and drops 5 cubes on "ones"; the tags stay "?"', async () => {
    const pulses = jest.spyOn(Reanimated, 'withSequence')
    const h = await setup()
    const read = h.voice.last()
    // Three(0) hundreds,(1) no(2) tens(3) and(4) five(5) ones.(6)
    await tickTo(read, 0)
    expect(flats()).toBe(0)
    await tickTo(read, 1)
    expect(flats()).toBe(3)
    await tickTo(read, 2)
    expect(zero('tens')).toBe('math-pv-zero-tens')
    pulses.mockClear()
    await tickTo(read, 3)
    expect(zero('tens')).toBe('math-pv-zero-tens-ticked')
    expect(rods()).toBe(0)
    // The tray's pulse and its tag's, at once on the tick.
    expect(pulses).toHaveBeenCalled()
    await tickTo(read, 6)
    expect(cubes()).toBe(5)
    await speakAll(read)
    expect(tags()).toEqual(['?', '?', '?'])
  })

  it('the zero ladder (D1): hint 1 ripples the empty tens tray; hint 2 "Zero tens." fills its tag "0"; hint 3 fills the others, so the tags read 3, 0, 5', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await twoWrongs(h, [505, 705])
    expect(h.voice.last().text).toBe('Look at the tens.')
    expect(zero('tens')).toMatch(/-rippled$/)
    expect(tags()).toEqual(['?', '?', '?'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Zero tens.')
    expect(zero('tens')).toMatch(/-rippled-pulsed$/)
    expect(tags()).toEqual(['?', '0', '?'])
    // The empty tray holds no block, and no "0" is drawn in it.
    expect(rods()).toBe(0)
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('What number is it?')
    expect(tags()).toEqual(['3', '0', '5'])
  })

  it('a right tap fills the tags 3, 0, 5', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-305'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Three hundred and five!')
    expect(tags()).toEqual(['3', '0', '5'])
  })
})

describe('P3: seven hundreds, no tens and no ones', () => {
  it('both empty trays tick on the read; hint 2 "Zero tens and zero ones." fills both tags "0"', async () => {
    const h = await setup()
    await toProblem(h, 3)
    await speakAll(h.voice.last())
    expect(flats()).toBe(7)
    expect(zero('tens')).toBe('math-pv-zero-tens-ticked')
    expect(zero('ones')).toBe('math-pv-zero-ones-ticked')
    await twoWrongs(h, [500, 300])
    // Hint 1 ripples the first empty place only.
    expect(zero('tens')).toMatch(/-rippled$/)
    expect(zero('ones')).toBe('math-pv-zero-ones-ticked')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Zero tens and zero ones.')
    expect(tags()).toEqual(['?', '0', '0'])
  })
})

describe('P5: "Find one hundred and ninety." (D3, AC 11)', () => {
  it('nothing is built on the read; hint 1 builds 1 flat and 9 rods, then ripples the empty ones tray on "Look at the ones."; hint 2 fills the ones tag "0"', async () => {
    const h = await setup()
    await toProblem(h, 5)
    const read = h.voice.last()
    expect(read.text).toBe('Find one hundred and ninety.')
    await speakAll(read)
    expect([flats(), rods(), cubes()]).toEqual([0, 0, 0])
    expect(tags()).toEqual(['?', '?', '?'])
    expect(chipValues()).toEqual([19, 109, 190])
    for (const chip of [19, 109]) {
      await fireEvent.press(screen.getByTestId(`math-chip-${chip}`))
      await speakAll(h.voice.last())
    }
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    // The number builds first: 1 flat, then 9 rods (one stagger).
    expect([flats(), rods()]).toEqual([1, 9])
    expect(h.voice.last().text).toBe('Hmm... try again?')
    expect(zero('ones')).toBe('math-pv-zero-ones')
    const build = placeValueHintBuildMs(PLAN.problems[4]!, false)
    expect(build).toBe(9 * 90 + 300)
    await advance(build)
    expect(h.voice.last().text).toBe('Look at the ones.')
    expect(zero('ones')).toMatch(/-rippled$/)
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Zero ones.')
    expect(tags()).toEqual(['?', '?', '0'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Find one hundred and ninety.')
    expect(tags()).toEqual(['1', '9', '0'])
  })

  it('a right tap on the read builds it at once and fills 1, 9, 0', async () => {
    const h = await setup()
    await toProblem(h, 5)
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-190'))
    await flush()
    expect([flats(), rods(), cubes()]).toEqual([1, 9, 0])
    expect(tags()).toEqual(['1', '9', '0'])
  })
})

describe('P6–P8: one ten or hundred more or less', () => {
  it('P6 305 + 10: the empty tens tray reads "0" from the first frame; hint 2 drops one rod with its "+10" pill and ticks it to 1', async () => {
    const h = await setup()
    await toProblem(h, 6)
    expect(tags()).toEqual(['3', '0', '5'])
    expect(rods()).toBe(0)
    expect(pill()).toHaveTextContent('+10')
    await speakAll(h.voice.last())
    await twoWrongs(h, [306, 405])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('One more ten.')
    expect(screen.getByTestId('math-pv-added-tens', HIDDEN)).toBeOnTheScreen()
    expect(tags()).toEqual(['3', '1', '5'])
  })

  it('P8 416 − 10: the "−10" pill from the first frame; hint 2 lifts one rod and turns the tens tag "?"; a right tap ticks it to "0"', async () => {
    const h = await setup()
    await toProblem(h, 8)
    expect(pill()).toHaveTextContent('−10')
    expect(tags()).toEqual(['4', '1', '6'])
    expect(rods()).toBe(1)
    expect(chipValues()).toEqual([316, 406, 415])
    await speakAll(h.voice.last())
    await twoWrongs(h, [415, 316])
    expect(h.voice.last().text).toBe('Look at the tens.')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Take away one ten.')
    expect(count(/^math-pv-rod-0-lifted$/)).toBe(1)
    expect(tags()).toEqual(['4', '?', '6'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('What is ten less?')
    await fireEvent.press(screen.getByTestId('math-chip-406'))
    await flush()
    expect(tags()).toEqual(['4', '0', '6'])
  })
})

describe('the session end (§ 2.6, AC 2)', () => {
  it('records § 2.7’s classes and a zero-drop tap as a two-digit value', async () => {
    const h = await setup()
    for (let i = 0; i < 3; i++) await answerRight(h, i)
    // P4: a zero-drop tap first, then the answer.
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-18'))
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-108'))
    await flush()
    await speakAll(h.voice.last())
    await advance(SETTLE_MS)
    for (let i = 4; i < 8; i++) await answerRight(h, i)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemAnswerValue).toEqual([
      305, 460, 700, 18, 190, 315, 740, 406,
    ])
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
    expect(result.perProblemDistractorClass).toEqual([
      'gentle',
      'gentle',
      'gentle',
      'zero-drop',
      'zero-drop',
      'wrong-place',
      'wrong-place',
      'wrong-place',
    ])
  })
})

describe('a mount before the session is ready (wave 3 lesson 2)', () => {
  it('Math mounts on the static plan with audio not ready; the zeros plan then shows its empty tray and ticks it on the read', async () => {
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
    expect(tags()).toEqual(['?', '?', '?'])
    // No(0) tens?(1) Zero(2) tens!(3)
    await tickTo(guide.lines[0]!, 3)
    await act(async () => guide.lines[0]!.resolve())
    await flush()
    expect(trayID('tens')).toBe('math-pv-tray-tens-pulsed2')
    await advance(SESSION_GUIDE_GAP_MS)
    await speakAll(voice.last())
    expect(zero('tens')).toBe('math-pv-zero-tens-ticked')
    expect([flats(), rods(), cubes()]).toEqual([3, 0, 5])
  })
})

describe('Reduce Motion (§ 2.5 brackets, AC 13)', () => {
  it('P5: the hint-1 build fades the trays in over 150 ms; the hint line waits that long', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const pulses = jest.spyOn(Reanimated, 'withSequence')
    const h = await setup()
    await toProblem(h, 5)
    await speakAll(h.voice.last())
    for (const chip of [19, 109]) {
      await fireEvent.press(screen.getByTestId(`math-chip-${chip}`))
      await speakAll(h.voice.last())
    }
    pulses.mockClear()
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(
      screen.getByTestId('math-pv-tray-hundreds-fade', HIDDEN),
    ).toBeOnTheScreen()
    expect(
      screen.getByTestId('math-pv-tray-tens-fade', HIDDEN),
    ).toBeOnTheScreen()
    expect(placeValueHintBuildMs(PLAN.problems[4]!, true)).toBe(150)
    await advance(150)
    expect(h.voice.last().text).toBe('Look at the ones.')
    // No pulses or ripples.
    expect(pulses).not.toHaveBeenCalled()
  })
})
