/**
 * Hundreds on Math's screen (content wave 3 `design/native/content-wave-3.md`
 * § 3.2–§ 3.5, D11, AC 9, AC 14) with the committed hundreds canon: the
 * trays build on the read's word ticks ("hundreds", "tens", "ones"; P5's
 * cubes before its rods), the "?" tags fill on hints, on a right tap and at
 * once on the given answer; P6–P8 show their start blocks, the number tag
 * and its "+10" / "+100" pill from the first frame, hint 2 drops the added
 * block in, and a right tap shows the answer as the pill fades. Plus the
 * session end (3-digit taps, the chip classes) and a mount before the
 * session is ready (wave 3 lesson 2). Driven through fakes of Emma's voice
 * and the session-guide player; silent.
 *
 * Failing-first: written before `PlaceValueStage` existed.
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

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

function canonPlan(): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', 'hundreds.json'),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}
const PLAN = canonPlan()

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

/** The read starts and ticks words 0..`through`. */
async function tickTo(line: VoiceLine, through: number) {
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
    focusNode: 'hundreds' as const,
    planFocusNode: 'hundreds' as const,
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
const numberText = () =>
  String(screen.getByTestId('math-pv-number-value', HIDDEN).props.children)

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

describe('P1: 234 (AC 9)', () => {
  it('shows three empty trays with "?" tags, no equation, chips 234 434 634', async () => {
    await setup()
    const stage = screen.getByTestId('math-place-value')
    expect(stage.props.accessibilityLabel).toBe(
      'Two hundreds, three tens and four ones. What number is it?',
    )
    expect(stage.props.pointerEvents).toBe('none')
    expect(screen.queryByTestId('math-symbolic')).toBeNull()
    for (const place of ['hundreds', 'tens', 'ones'])
      expect(
        screen.getByTestId(`math-pv-tray-${place}`, HIDDEN),
      ).toBeOnTheScreen()
    expect([flats(), rods(), cubes()]).toEqual([0, 0, 0])
    expect(tags()).toEqual(['?', '?', '?'])
    expect(screen.queryByTestId('math-pv-number', HIDDEN)).toBeNull()
    expect(chipValues()).toEqual([234, 434, 634])
  })

  it('flats, rods and cubes appear on the ticks of "hundreds", "tens", "ones"', async () => {
    const h = await setup()
    const read = h.voice.last()
    // Two(0) hundreds,(1) three(2) tens(3) and(4) four(5) ones.(6)
    await tickTo(read, 0)
    expect([flats(), rods(), cubes()]).toEqual([0, 0, 0])
    await tickTo(read, 1)
    expect([flats(), rods(), cubes()]).toEqual([2, 0, 0])
    await tickTo(read, 3)
    expect([flats(), rods(), cubes()]).toEqual([2, 3, 0])
    await tickTo(read, 6)
    expect([flats(), rods(), cubes()]).toEqual([2, 3, 4])
    expect(tags()).toEqual(['?', '?', '?'])
  })

  it('a right tap fills the tags 2, 3, 4', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-234'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Two hundred and thirty-four!')
    expect(tags()).toEqual(['2', '3', '4'])
    expect(
      screen.getAllByTestId(/^math-pv-tag-\w+-filled$/, HIDDEN),
    ).toHaveLength(3)
  })

  it('a right tap during the read lands every block at once', async () => {
    const h = await setup()
    await tickTo(h.voice.last(), 1)
    await fireEvent.press(screen.getByTestId('math-chip-234'))
    await flush()
    expect([flats(), rods(), cubes()]).toEqual([2, 3, 4])
    expect(tags()).toEqual(['2', '3', '4'])
  })

  it('the hints fill one tag each; after hint 3 the tags read the answer', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await twoWrongs(h, [434, 634])
    expect(h.voice.last().text).toBe('Look at the hundreds.')
    expect(tags()).toEqual(['2', '?', '?'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Look at the tens.')
    expect(tags()).toEqual(['2', '3', '?'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Look at the ones.')
    expect(tags()).toEqual(['2', '3', '4'])
  })

  it('the given answer fills every "?" tag at once with a ring', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-434'))
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-634'))
    await speakAll(h.voice.last())
    // The hint is cut by the third wrong.
    await fireEvent.press(screen.getByTestId('math-chip-434'))
    await speakAll(h.voice.last())
    expect(h.voice.lines.map((l) => l.text)).toContain(
      'This one is two hundred and thirty-four.',
    )
    expect(tags()).toEqual(['2', '3', '4'])
    for (const place of ['hundreds', 'tens', 'ones'])
      expect(
        screen.getByTestId(`math-pv-tag-ring-${place}`, HIDDEN),
      ).toBeOnTheScreen()
  })

  it('the lead "Hundreds, tens and ones!" plays before P1’s read, pulsing the trays', async () => {
    const h = await setup({ sessionIntro: 'guide.session.intro.hundreds' })
    expect(h.guide.lines.map((l) => l.id)).toEqual([
      'guide.session.intro.hundreds',
    ])
    expect(h.voice.lines).toHaveLength(0)
    // Hundreds,(0) tens(1) and(2) ones!(3): each tray pulses on its word.
    const lead = { ...h.guide.lines[0]!, text: 'Hundreds, tens and ones!' }
    const pulsed = () =>
      screen
        .queryAllByTestId(/^math-pv-tray-\w+-pulsed$/, HIDDEN)
        .map((n) => String(n.props.testID))
    await act(async () => {
      lead.opts.onPlay?.()
      lead.opts.onWordTick?.(0)
    })
    await flush()
    expect(pulsed()).toEqual(['math-pv-tray-hundreds-pulsed'])
    await speakAll(lead)
    expect(pulsed()).toEqual([
      'math-pv-tray-hundreds-pulsed',
      'math-pv-tray-tens-pulsed',
      'math-pv-tray-ones-pulsed',
    ])
    await advance(SESSION_GUIDE_GAP_MS)
    expect(h.voice.last().text).toBe(
      'Two hundreds, three tens and four ones. What number is it?',
    )
  })
})

describe('P5: Danish order (AC 9)', () => {
  it('the cubes land before the rods, each in its own tray', async () => {
    const h = await setup()
    await toProblem(h, 5)
    const read = h.voice.last()
    expect(read.text).toBe(
      'Three hundreds, six ones and two tens. What number is it?',
    )
    expect(chipValues()).toEqual([326, 336, 362])
    // Three(0) hundreds,(1) six(2) ones(3) and(4) two(5) tens.(6)
    await tickTo(read, 3)
    expect([flats(), rods(), cubes()]).toEqual([3, 0, 6])
    await tickTo(read, 6)
    expect([flats(), rods(), cubes()]).toEqual([3, 2, 6])
  })
})

describe('P6: 243, ten more (AC 9, D11)', () => {
  it('the start blocks, the filled tags, the number tag and its "+10" pill are up from the first frame', async () => {
    const h = await setup()
    await toProblem(h, 6)
    expect(h.voice.last().text).toBe(
      'Two hundred and forty-three. What is ten more?',
    )
    expect([flats(), rods(), cubes()]).toEqual([2, 4, 3])
    expect(tags()).toEqual(['2', '4', '3'])
    expect(numberText()).toBe('243')
    const pill = screen.getByTestId('math-pv-number-pill', HIDDEN)
    expect(pill).toHaveTextContent('+10')
    expect(screen.queryByTestId(/^math-pv-added-/, HIDDEN)).toBeNull()
    expect(chipValues()).toEqual([244, 253, 343])
  })

  it('the read pulses the number tag on its first word and the pill on "ten"', async () => {
    const h = await setup()
    await toProblem(h, 6)
    const read = h.voice.last()
    await tickTo(read, 0)
    expect(
      screen.getByTestId('math-pv-number-pulsed', HIDDEN),
    ).toBeOnTheScreen()
    expect(
      screen.queryByTestId('math-pv-number-pill-pulsed', HIDDEN),
    ).toBeNull()
    // Two(0) hundred(1) and(2) forty-three.(3) What(4) is(5) ten(6) more?(7)
    await tickTo(read, 6)
    expect(
      screen.getByTestId('math-pv-number-pill-pulsed', HIDDEN),
    ).toBeOnTheScreen()
  })

  it('hint 2: a rod with "+10" drops in and the tens tag goes 4 → 5', async () => {
    const h = await setup()
    await toProblem(h, 6)
    await speakAll(h.voice.last())
    await twoWrongs(h, [244, 343])
    expect(h.voice.last().text).toBe('Look at the tens.')
    expect(screen.queryByTestId(/^math-pv-added-/, HIDDEN)).toBeNull()
    expect(tagText('tens')).toBe('4')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('One more ten.')
    expect(screen.getByTestId('math-pv-added-tens', HIDDEN)).toBeOnTheScreen()
    expect(screen.getByTestId('math-pv-added-pill', HIDDEN)).toHaveTextContent(
      '+10',
    )
    expect(tagText('tens')).toBe('5')
    // The number tag keeps the start until the answer.
    expect(numberText()).toBe('243')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('What is ten more?')
  })

  it('a right tap shows 253 and the number tag’s pill fades', async () => {
    const h = await setup()
    await toProblem(h, 6)
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-253'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Two hundred and fifty-three!')
    expect(numberText()).toBe('253')
    expect(
      screen.getByTestId('math-pv-number-pill-faded', HIDDEN),
    ).toBeOnTheScreen()
    expect(screen.queryByTestId('math-pv-number-pill', HIDDEN)).toBeNull()
    // The added rod dropped in fast (no pill of its own), its tag ticked.
    expect(screen.getByTestId('math-pv-added-tens', HIDDEN)).toBeOnTheScreen()
    expect(screen.queryByTestId('math-pv-added-pill', HIDDEN)).toBeNull()
    expect(tagText('tens')).toBe('5')
  })
})

describe('P7: 465, one hundred more', () => {
  it('"+100": hint 2 drops a flat in and the hundreds tag goes 4 → 5', async () => {
    const h = await setup()
    await toProblem(h, 7)
    expect(numberText()).toBe('465')
    expect(screen.getByTestId('math-pv-number-pill', HIDDEN)).toHaveTextContent(
      '+100',
    )
    await speakAll(h.voice.last())
    await twoWrongs(h, [466, 475])
    expect(h.voice.last().text).toBe('Look at the hundreds.')
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('One more hundred.')
    expect(
      screen.getByTestId('math-pv-added-hundreds', HIDDEN),
    ).toBeOnTheScreen()
    expect(tagText('hundreds')).toBe('5')
  })
})

describe('the session end (§ 3.6, AC 4)', () => {
  it('records the 8 three-digit taps and the chip classes', async () => {
    const h = await setup()
    for (let i = 0; i < 8; i++) await answerRight(h, i)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemAnswerValue).toEqual([
      234, 352, 426, 537, 326, 253, 565, 738,
    ])
    expect(result.perProblemDistractorClass).toEqual([
      'gentle',
      'gentle',
      'gentle',
      'digit-swap',
      'spoken-order',
      'wrong-place',
      'wrong-place',
      'wrong-place',
    ])
    expect(result.firstTapCorrect).toEqual(Array(8).fill(true))
  })
})

describe('a mount before the session is ready (wave 3 lesson 2)', () => {
  it('Math mounts on the static plan with audio not ready; the hundreds plan then builds on its read', async () => {
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
          sessionIntro: 'guide.session.intro.hundreds',
        })}
      />,
    )
    await flush()
    expect(guide.lines.map((l) => l.id)).toEqual([
      'guide.session.intro.hundreds',
    ])
    await speakAll(guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    const read = voice.last()
    expect(read.text).toBe(
      'Two hundreds, three tens and four ones. What number is it?',
    )
    expect(chipValues()).toEqual([234, 434, 634])
    await speakAll(read)
    expect([flats(), rods(), cubes()]).toEqual([2, 3, 4])
  })
})

describe('Reduce Motion (§ 3.5 brackets, AC 14)', () => {
  it('normal motion drops each block (no tray fade)', async () => {
    const h = await setup()
    await tickTo(h.voice.last(), 1)
    expect(screen.queryByTestId(/^math-pv-tray-\w+-fade$/, HIDDEN)).toBeNull()
    expect(
      screen.getAllByTestId(/^math-pv-flat-\d+$/, HIDDEN)[0],
    ).toBeOnTheScreen()
  })

  it('a tray fades in instead of dropping its blocks; the tags still fill', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const h = await setup()
    await tickTo(h.voice.last(), 1)
    expect(
      screen.getByTestId('math-pv-tray-hundreds-fade', HIDDEN),
    ).toBeOnTheScreen()
    expect(flats()).toBe(2)
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-234'))
    await flush()
    expect(tags()).toEqual(['2', '3', '4'])
  })
})
