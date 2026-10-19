/**
 * Adding big numbers on Math's screen (content wave 5
 * `design/native/content-wave-5.md` § 3.2–§ 3.6, D4, D6, AC 12, AC 13)
 * with the committed `add-two-digit` canon: today's equation, then
 * `PlaceValueStage`'s two trays (tens, ones) with the first number's blocks
 * from the first frame and "?" under both. What moves goes by position
 * (D6): P1–P3 drop the second number on its word tick and P3 bundles a new
 * ten; P4–P5 drop on the read and bundle on hint 2's "make"; P6–P8 move
 * nothing until hint 2, which drops and bundles. The bundle: ten cubes
 * gather into one column, fuse into a rod, carry to the tens tray, and the
 * cubes left over settle. Plus the frame report, a review block on another
 * step's session, the chips and session end, Reduce Motion and rotation
 * mid-bundle. Driven through fakes of Emma's voice and the session-guide
 * player; silent.
 *
 * Failing-first: written before the two-tray stage existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  ArithmeticProblem,
  ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { HINT_DELAY_AFTER_WRONG_MS } from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import { REPO_ROOT } from '../../../test/webSource'
import {
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
import {
  BUNDLE_MS,
  BUNDLE_FAST_MS,
  BUNDLE_FAST_STEPS,
  BUNDLE_REDUCED_MS,
  sumDropMs,
} from './placeValueTiming'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }
const LEAD = 'guide.session.intro.add-two-digit' as SessionGuideLineId

interface CanonLine {
  id: string
  text: string
}

function canonJson(stem: string): { plan: { utterances: CanonLine[] } } {
  return JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: { utterances: CanonLine[] } }
}

function canonPlan(stem: string): ExtendedMathSessionPlan {
  return mathSessionPlanFromServer(canonJson(stem).plan, {
    extendedKinds: true,
  })
}
const PLAN = canonPlan('add-two-digit')
const SUMS = PLAN.problems as readonly ArithmeticProblem[]

/** A review's copy of the canon: slot i + 1 serves canon block `from[i]`
 *  (the server renames each block's `math.p<n>.` by its slot,
 *  `api/_review.ts`). */
function reviewPlan(from: readonly number[]): ExtendedMathSessionPlan {
  const { plan } = canonJson('add-two-digit')
  const slotOf = new Map(from.map((p, i) => [p, i + 1]))
  return mathSessionPlanFromServer(
    {
      ...plan,
      utterances: plan.utterances.map((l) => ({
        ...l,
        id: l.id.replace(
          /^math\.p(\d+)\./,
          (_, p: string) => `math.p${slotOf.get(Number(p))}.`,
        ),
      })),
    },
    { extendedKinds: true },
  )
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
    focusNode: 'add-two-digit' as const,
    planFocusNode: 'add-two-digit' as const,
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
const rods = () => count(/^math-pv-rod-\d+$/)
const cubes = () => count(/^math-pv-cube-\d+$/)
const tagText = (place: string) =>
  String(
    screen.getByTestId(`math-pv-tag-${place}-value`, HIDDEN).props.children,
  )
const tags = () => ['tens', 'ones'].map(tagText)
/** The bundle's phase marker (`idle`, `gather`, `fuse`, `carry`, `settle`,
 *  `done`), or `null` when the ones make no ten. */
const bundle = () => {
  const el = screen.queryByTestId(
    /^math-pv-bundle-(idle|gather|fuse|carry|settle|fade|done)$/,
    HIDDEN,
  )
  return el === null
    ? null
    : String(el.props.testID).replace('math-pv-bundle-', '')
}
const equation = () =>
  within(screen.getByTestId('math-symbolic'))
    .getAllByText(/.+/)
    .map((t) => String(t.props.children))
    .join(' ')

const chipValues = () =>
  screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    .sort((a, b) => a - b)

/** Long enough for any answer to move on (the 1.2 s dwell, < 4 s). */
const SETTLE_MS = 2500

async function answerRight(h: H, i: number, plan = PLAN) {
  const read = h.voice.last()
  expect(read.text).toBe(plan.problems[i]!.utterances.read)
  await speakAll(read)
  await fireEvent.press(
    screen.getByTestId(`math-chip-${plan.problems[i]!.correct}`),
  )
  await flush()
  await speakAll(h.voice.last())
  await advance(SETTLE_MS)
}

async function toProblem(h: H, n: number, plan = PLAN) {
  for (let i = 0; i < n - 1; i++) await answerRight(h, i, plan)
}

/** Ripples' and pulses' scale peaks (1 → 1.06 → 1) among `withTiming`'s
 *  calls. */
const ripplesIn = (timings: jest.SpyInstance) =>
  timings.mock.calls.filter(([to]) => to === 1.06).length

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

describe('the two trays under the equation (§ 3.2, § 3.3)', () => {
  it('P1: "34 + 25 = ?" over two trays, tens and ones, with the first number (3 rods, 4 cubes) and "?" under both; no hundreds tray, no number tag; chips 39 59 79', async () => {
    const onKind = jest.fn()
    await setup({ onProblemKindChange: onKind })
    expect(equation()).toBe('34 + 25 = ?')
    expect(screen.getByTestId('math-place-value', HIDDEN)).toBeOnTheScreen()
    expect(count(/^math-pv-tray-hundreds/)).toBe(0)
    expect(screen.queryByTestId('math-pv-number-value', HIDDEN)).toBeNull()
    expect([rods(), cubes()]).toEqual([3, 4])
    expect(tags()).toEqual(['?', '?'])
    expect(bundle()).toBeNull()
    expect(chipValues()).toEqual([39, 59, 79])
    // The frame follows the stage, not the kind (§ 3.3).
    expect(onKind).toHaveBeenLastCalledWith('place-value')
  })

  it('the lead "Tens and ones!" pulses the two trays left to right', async () => {
    const h = await setup({ sessionIntro: LEAD })
    const lead = h.guide.lines[0]!
    expect(lead.id).toBe(LEAD)
    // Tens(0) and(1) ones!(2)
    await tickTo(lead, 0)
    expect(count(/^math-pv-tray-tens-pulsed$/)).toBe(1)
    expect(count(/^math-pv-tray-ones-pulsed$/)).toBe(0)
    await tickTo(lead, 2)
    expect(count(/^math-pv-tray-ones-pulsed$/)).toBe(1)
  })

  it('P1 makes no ten: its 2 rods and 5 cubes drop on "twenty-five"; nothing bundles', async () => {
    const h = await setup()
    const read = h.voice.last()
    // Thirty-four(0) plus(1) twenty-five.(2)
    await tickTo(read, 1)
    expect([rods(), cubes()]).toEqual([3, 4])
    await tickTo(read, 2)
    expect([rods(), cubes()]).toEqual([5, 9])
    await advance(3000)
    expect([rods(), cubes()]).toEqual([5, 9])
    expect(bundle()).toBeNull()
  })

  it("a review block on another step's session draws the trays (its step travels with it)", async () => {
    await setup({
      focusNode: 'add-to-10',
      planFocusNode: 'add-to-10',
      problemNodes: PLAN.problems.map(() => 'add-two-digit'),
    })
    expect(screen.getByTestId('math-place-value', HIDDEN)).toBeOnTheScreen()
  })

  it('the same sums on another step draw no trays', async () => {
    await setup({ focusNode: 'add-to-20', planFocusNode: 'add-to-20' })
    expect(screen.queryByTestId('math-place-value', HIDDEN)).toBeNull()
  })

  it('a review block keeps its hint 2 at any slot: P1 (34 + 25, no ten) at slot 6 ripples the tens tray\'s rods on "Look at the tens."', async () => {
    const plan = reviewPlan([6, 2, 3, 4, 5, 1, 7, 8])
    const timings = jest.spyOn(Reanimated, 'withTiming')
    const h = await setup({ plan })
    await toProblem(h, 6, plan)
    expect(equation()).toBe('34 + 25 = ?')
    await speakAll(h.voice.last())
    const [a, b] = chipValues().filter((v) => v !== 59)
    await twoWrongs(h, [a!, b!])
    expect(h.voice.last().text).toBe('Look at the ones.')
    timings.mockClear()
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Look at the tens.')
    // The first number's 3 rods ripple; the second's 2 drop in.
    expect(ripplesIn(timings)).toBe(3)
    expect([rods(), cubes()]).toEqual([5, 9])
    expect(bundle()).toBeNull()
  })
})

describe('P3: 28 + 35, the worked example (AC 12)', () => {
  it('the first frame: 2 rods and 8 cubes; on "thirty-five" 3 rods and 5 cubes drop in 90 ms apart; then ten cubes gather, become a rod and go to the tens tray, leaving 6 rods and 3 cubes; both tags "?"', async () => {
    const delays = jest.spyOn(Reanimated, 'withDelay')
    const h = await setup()
    await toProblem(h, 3)
    expect(equation()).toBe('28 + 35 = ?')
    expect([rods(), cubes()]).toEqual([2, 8])
    expect(chipValues()).toEqual([43, 63, 83])
    const read = h.voice.last()
    // Twenty-eight(0) plus(1) thirty-five.(2)
    await tickTo(read, 1)
    delays.mockClear()
    await tickTo(read, 2)
    expect([rods(), cubes()]).toEqual([5, 13])
    const d = delays.mock.calls.map(([ms]) => ms)
    for (let k = 0; k < 8; k++) expect(d).toContain(k * 90)
    expect(bundle()).toBe('idle')
    // The bundle starts when the cubes have landed.
    await advance(sumDropMs(SUMS[2]!) - 1)
    expect(bundle()).toBe('idle')
    await advance(1)
    expect(bundle()).toBe('gather')
    await advance(BUNDLE_MS.gather)
    expect(bundle()).toBe('fuse')
    await advance(BUNDLE_MS.fuse)
    expect(bundle()).toBe('carry')
    // The ten cubes are one rod now.
    expect(cubes()).toBe(3)
    expect(count(/^math-pv-bundle-rod$/)).toBe(1)
    await advance(BUNDLE_MS.carry)
    expect(bundle()).toBe('settle')
    await advance(BUNDLE_MS.settle)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([6, 3])
    expect(count(/^math-pv-bundle-rod$/)).toBe(0)
    expect(tags()).toEqual(['?', '?'])
  })

  it('the bundle takes about 1.1 s', () => {
    expect(
      BUNDLE_MS.gather + BUNDLE_MS.fuse + BUNDLE_MS.carry + BUNDLE_MS.settle,
    ).toBe(1100)
  })

  it('hint 2 "Ten ones make a ten." ripples the tens tray (already bundled) and fills the ones tag 3; hint 3 the tens tag 6', async () => {
    const h = await setup()
    await toProblem(h, 3)
    await speakAll(h.voice.last())
    await advance(3000)
    expect(bundle()).toBe('done')
    await twoWrongs(h, [43, 83])
    expect(h.voice.last().text).toBe('Look at the ones.')
    expect(tags()).toEqual(['?', '?'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('Ten ones make a ten.')
    expect(tags()).toEqual(['?', '3'])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('How many?')
    expect(tags()).toEqual(['6', '3'])
  })

  it('a right tap during the read moves what has not moved fast, and bundles in 250 ms', async () => {
    const springs = jest.spyOn(Reanimated, 'withSpring')
    const h = await setup()
    await toProblem(h, 3)
    await tickTo(h.voice.last(), 0)
    springs.mockClear()
    await fireEvent.press(screen.getByTestId('math-chip-63'))
    await flush()
    expect([rods(), cubes()]).toEqual([5, 13])
    expect(
      springs.mock.calls.filter(
        ([, cfg]) => cfg?.stiffness === 300 && cfg?.damping === 22,
      ).length,
    ).toBeGreaterThanOrEqual(8)
    expect(tags()).toEqual(['6', '3'])
    await advance(sumDropMs(SUMS[2]!, 'fast') + BUNDLE_FAST_MS)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([6, 3])
  })

  it("the fast bundle is § 3.5's: its four beats in 250 ms on spring 300 / 22, and no ripple, though the read ends after the tap", async () => {
    const springs = jest.spyOn(Reanimated, 'withSpring')
    const timings = jest.spyOn(Reanimated, 'withTiming')
    const spring = (stiffness: number, damping: number) =>
      springs.mock.calls.filter(
        ([, cfg]) => cfg?.stiffness === stiffness && cfg?.damping === damping,
      ).length
    const timed = (ms: number) =>
      timings.mock.calls.filter(([, cfg]) => cfg?.duration === ms).length
    expect(
      BUNDLE_FAST_STEPS.gather +
        BUNDLE_FAST_STEPS.fuse +
        BUNDLE_FAST_STEPS.carry +
        BUNDLE_FAST_STEPS.settle,
    ).toBe(BUNDLE_FAST_MS)
    const h = await setup()
    await toProblem(h, 3)
    const read = h.voice.last()
    await tickTo(read, 0)
    await fireEvent.press(screen.getByTestId('math-chip-63'))
    await flush()
    // The read ends after the tap (her answer's line cuts it).
    await act(async () => read.resolve())
    await flush()
    springs.mockClear()
    timings.mockClear()
    await advance(sumDropMs(SUMS[2]!, 'fast'))
    expect(bundle()).toBe('gather')
    // The second column's 5 cubes gather (x and y each).
    expect(spring(300, 22)).toBe(10)
    expect(spring(260, 20)).toBe(0)
    await advance(BUNDLE_FAST_STEPS.gather)
    expect(bundle()).toBe('fuse')
    // The ten cubes fade as the rod fades in.
    expect(timed(BUNDLE_FAST_STEPS.fuse)).toBe(11)
    expect(timed(BUNDLE_MS.fuse)).toBe(0)
    await advance(BUNDLE_FAST_STEPS.fuse)
    expect(bundle()).toBe('carry')
    expect(spring(300, 22)).toBe(12)
    await advance(BUNDLE_FAST_STEPS.carry)
    expect(bundle()).toBe('settle')
    // The 3 cubes left over slide into the first column.
    expect(timed(BUNDLE_FAST_STEPS.settle)).toBe(6)
    await advance(BUNDLE_FAST_STEPS.settle)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([6, 3])
    expect(ripplesIn(timings)).toBe(0)
  })
})

describe('P4: 47 + 26, the bundle at hint 2 (D6, AC 12)', () => {
  it('the read drops 2 rods and 6 cubes, 13 loose cubes and no bundle; hint 2 bundles on "make", leaving 7 rods and 3 cubes', async () => {
    const h = await setup()
    await toProblem(h, 4)
    await speakAll(h.voice.last())
    await advance(3000)
    expect([rods(), cubes()]).toEqual([6, 13])
    expect(bundle()).toBe('idle')
    expect(chipValues()).toEqual([63, 73, 74])
    await twoWrongs(h, [63, 74])
    await speakAll(h.voice.last())
    const hint2 = h.voice.last()
    expect(hint2.text).toBe('Ten ones make a ten.')
    // Ten(0) ones(1) make(2)
    await tickTo(hint2, 1)
    expect(bundle()).toBe('idle')
    await tickTo(hint2, 2)
    // The drop landed long ago: the bundle starts on the tick.
    await advance(0)
    expect(bundle()).toBe('gather')
    await advance(1100)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([7, 3])
    expect(tags()).toEqual(['?', '3'])
  })
})

describe('P6: 56 + 28, from the tags (D6, AC 12)', () => {
  it('nothing moves on the read; hint 2 drops the second number and bundles on "make", leaving 8 rods and 4 cubes', async () => {
    const h = await setup()
    await toProblem(h, 6)
    await speakAll(h.voice.last())
    await advance(3000)
    expect([rods(), cubes()]).toEqual([5, 6])
    await twoWrongs(h, [74, 85])
    await speakAll(h.voice.last())
    const hint2 = h.voice.last()
    expect(hint2.text).toBe('Ten ones make a ten.')
    expect([rods(), cubes()]).toEqual([7, 14])
    await tickTo(hint2, 2)
    // The bundle waits for the drop to land.
    expect(bundle()).toBe('idle')
    await advance(sumDropMs(SUMS[5]!))
    expect(bundle()).toBe('gather')
    await advance(1100)
    expect([rods(), cubes()]).toEqual([8, 4])
  })

  it('the given answer lands everything in its end state at once, both tags ringed', async () => {
    const h = await setup()
    await toProblem(h, 6)
    await speakAll(h.voice.last())
    for (const chip of [74, 85]) {
      await fireEvent.press(screen.getByTestId(`math-chip-${chip}`))
      await speakAll(h.voice.last())
    }
    await fireEvent.press(screen.getByTestId('math-chip-74'))
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('This one is eighty-four.')
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([8, 4])
    expect(tags()).toEqual(['8', '4'])
    expect(count(/^math-pv-tag-ring-(tens|ones)$/)).toBe(2)
  })
})

describe('the session end (§ 3.6, AC 3)', () => {
  it('records the 8 taps, null on P1–P3 and the forgotten carry on P4–P8', async () => {
    const h = await setup()
    for (let i = 0; i < 8; i++) await answerRight(h, i)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemAnswerValue).toEqual([
      59, 78, 63, 73, 83, 84, 62, 92,
    ])
    expect(result.perProblemDistractorClass).toEqual([
      null,
      null,
      null,
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
    ])
  })
})

describe('a mount before the session is ready (wave 3 lesson 2)', () => {
  it('Math mounts on the static plan with audio not ready and no session step; the adding-big-numbers plan then draws its trays', async () => {
    const voice = fakeVoice()
    const guide = fakeGuide()
    const view = await render(
      <MathScreen
        {...stageProps({
          plan: undefined,
          planFocusNode: undefined,
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
        })}
      />,
    )
    await flush()
    expect(screen.getByTestId('math-place-value', HIDDEN)).toBeOnTheScreen()
    expect([rods(), cubes()]).toEqual([3, 4])
    await speakAll(voice.last())
    expect([rods(), cubes()]).toEqual([5, 9])
  })
})

describe('Reduce Motion and rotation (§ 3.5 brackets, AC 13)', () => {
  it('the drop is a 200 ms crossfade per block; the bundle a 200 ms fade, ending as the full one does', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const timings = jest.spyOn(Reanimated, 'withTiming')
    const h = await setup()
    await toProblem(h, 3)
    timings.mockClear()
    await speakAll(h.voice.last())
    expect(
      timings.mock.calls.filter(([, cfg]) => cfg?.duration === 200).length,
    ).toBeGreaterThanOrEqual(8)
    await advance(sumDropMs(SUMS[2]!, 'reduced'))
    expect(bundle()).toBe('fade')
    expect(BUNDLE_REDUCED_MS).toBe(200)
    await advance(BUNDLE_REDUCED_MS)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([6, 3])
  })

  it('rotation mid-bundle lands the end state', async () => {
    const voice = fakeVoice()
    const guide = fakeGuide()
    const props = {
      playUtterance: voice.play,
      sessionGuide: guide.player,
    }
    const view = await render(<MathScreen {...stageProps(props)} />)
    await flush()
    const h = { voice, guide, onSessionComplete: jest.fn() }
    await toProblem(h as H, 3)
    await speakAll(voice.last())
    await advance(sumDropMs(SUMS[2]!) + BUNDLE_MS.gather)
    expect(bundle()).toBe('fuse')
    await view.rerender(
      <MathScreen
        {...stageProps({
          ...props,
          layout: extendedMathLayout(
            {
              width: 667,
              height: 375,
              insets: { top: 0, bottom: 21, left: 0, right: 0 },
            },
            'place-value',
          ),
        })}
      />,
    )
    await flush()
    await advance(0)
    expect(bundle()).toBe('done')
    expect([rods(), cubes()]).toEqual([6, 3])
  })
})
