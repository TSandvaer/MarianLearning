/**
 * Missing numbers on Math's screen (content wave 1
 * `design/native/content-wave-1.md` §§ 1.1–1.5, AC 11): `7 + ? = 10`, the
 * hiding lead line, the hint, the bloom and the fill on a right answer, the
 * ring on the given answer, and no dot card. A whole of ten draws the flower
 * bed in the counting row's place (`design/native/flower-bed-into-add-to-10.md`,
 * N8: these expectations stand with the bed's test IDs); `3 + ? = 5` keeps
 * group A and the "?" stone. Driven through fakes of Emma's voice and the
 * session-guide player; silent.
 */
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
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
import type { MathSessionResult, PlayMathUtteranceOptions } from './mathTypes'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

/** One problem's lines: a read and the canon's slot texts for it. */
interface Spec {
  read: string
  correct: string
  hint1: string
  hint2: string
  hint3: string
  giveAnswer: string
}

/** `w` = the two addends and the sum, spelled. */
const plain = (w: [string, string, string]): Spec => ({
  read: `${w[0]} plus ${w[1]}. How many?`,
  correct: `Yes! ${w[2]}!`,
  hint1: 'Look at the flowers.',
  hint2: `${w[0]} flowers.`,
  hint3: `And ${w[1].toLowerCase()} more. How many now?`,
  giveAnswer: `This one is ${w[2].toLowerCase()}.`,
})
const miss = (a: string, b: string, t: string): Spec => ({
  read: `${a} and what make ${t}?`,
  correct: `Yes! ${a} and ${b} make ${t}!`,
  hint1: 'Look at the flowers.',
  hint2: `${a} flowers.`,
  hint3: `How many more make ${t}?`,
  giveAnswer: `This one is ${b}.`,
})

/** The § 1.8 add-to-10 shape: 6+1, 6+2, 6+3, 7+?=10, 4+4, 6+?=10, 4+5, 8+?=10. */
const SPECS: Spec[] = [
  plain(['Six', 'One', 'Seven']),
  plain(['Six', 'Two', 'Eight']),
  plain(['Six', 'Three', 'Nine']),
  miss('Seven', 'three', 'ten'),
  plain(['Four', 'Four', 'Eight']),
  miss('Six', 'four', 'ten'),
  plain(['Four', 'Five', 'Nine']),
  miss('Eight', 'two', 'ten'),
]

function planOf(specs: readonly Spec[]): ExtendedMathSessionPlan {
  return mathSessionPlanFromServer(
    {
      id: 'canon-add-to-10',
      label: 'Add to 10',
      utterances: specs.flatMap((s, i) =>
        (
          [
            ['read', s.read],
            ['correct', s.correct],
            ['reprompt', 'Hmm... try again?'],
            ['hint1', s.hint1],
            ['hint2', s.hint2],
            ['hint3', s.hint3],
            ['giveAnswer', s.giveAnswer],
          ] as const
        ).map(([slot, text]) => ({ id: `math.p${i + 1}.${slot}`, text })),
      ),
    },
    { extendedKinds: true },
  )
}

const PLAN = planOf(SPECS)

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

async function setup(overrides: Partial<MathProps> = {}) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const onSessionComplete = jest.fn<void, [MathSessionResult]>()
  await render(
    <MathScreen
      layout={mathLayout(PORTRAIT)}
      plan={PLAN}
      playUtterance={voice.play}
      audioReady
      focusNode="add-to-10"
      sfx={fakeSfx()}
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
  return { voice, guide, onSessionComplete }
}

type H = Awaited<ReturnType<typeof setup>>

/** The read starts; the right chip; its line; the dwell. */
async function answerRight(h: H, i: number) {
  const read = h.voice.last()
  expect(read.text).toBe(PLAN.problems[i]!.utterances.read)
  await act(async () => {
    read.opts.onPlay?.()
  })
  await flush()
  await fireEvent.press(
    screen.getByTestId(`math-chip-${PLAN.problems[i]!.correct}`),
  )
  await flush()
  await startAndEnd(h.voice.last())
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

/** Answer P1–P3; then the hiding line plays and is let through. */
async function toP4(h: H) {
  for (let i = 0; i < 3; i++) await answerRight(h, i)
  expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.hiding'])
  await startAndEnd(h.guide.lines[0]!)
  await advance(SESSION_GUIDE_GAP_MS)
  const read = h.voice.last()
  expect(read.text).toBe('Seven and what make ten?')
  await act(async () => {
    read.opts.onPlay?.()
  })
  await flush()
}

/** The equation's text tokens, in order (the gap's "?" and answer included). */
const equationTokens = () =>
  within(screen.getByTestId('math-symbolic'))
    .getAllByText(/./)
    .map((n) => String(n.props.children))

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('add-to-10 P4: 7 + ? = 10 (AC 11)', () => {
  it('shows 7 + ? = 10, 7 flowers in the bed, bare soil for the rest and chips 2 3 4', async () => {
    const h = await setup()
    await toP4(h)
    // The gap holds "?" and, faded out until a right tap, the answer.
    expect(equationTokens()).toEqual(['7', '+', '?', '3', '=', '10'])
    expect(screen.getByTestId('math-equation-gap')).toBeOnTheScreen()
    expect(screen.getAllByTestId('math-bed-flower', HIDDEN)).toHaveLength(7)
    expect(screen.queryAllByTestId(/^math-bed-hole-[789]/, HIDDEN)).toEqual([])
    const chips = screen
      .getAllByTestId(/^math-chip-/)
      .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
      .sort((a, b) => a - b)
    expect(chips).toEqual([2, 3, 4])
  })

  it("\"Some flowers are hiding!\" plays before P4's read (400 ms gap), not before P6's or P8's", async () => {
    const h = await setup()
    for (let i = 0; i < 3; i++) await answerRight(h, i)
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.hiding'])
    // The stage is up while it plays; no read yet.
    expect(screen.getAllByTestId('math-chips')).toHaveLength(1)
    const readsBefore = h.voice.lines.length
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS - 1)
    expect(h.voice.lines).toHaveLength(readsBefore)
    await advance(1)
    expect(h.voice.last().text).toBe('Seven and what make ten?')
    for (let i = 3; i < 8; i++) await answerRight(h, i)
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.hiding'])
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemAnswerValue).toEqual([7, 8, 9, 3, 8, 4, 9, 2])
    expect(result.totalCorrect).toBe(8)
  })

  it('hint 3 opens the 3 holes; the planted flowers ripple on hint 1', async () => {
    const h = await setup()
    await toP4(h)
    await fireEvent.press(screen.getByTestId('math-chip-2'))
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-4'))
    await startAndEnd(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(
      screen.getByTestId('math-bed-given-0-pulsed', HIDDEN),
    ).toBeOnTheScreen()
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('Seven flowers.')
    expect(screen.queryAllByTestId(/^math-bed-hole-[789]/, HIDDEN)).toEqual([])
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('How many more make ten?')
    expect(
      screen.getAllByTestId(/^math-bed-hole-[789]-pulsed$/, HIDDEN),
    ).toHaveLength(3)
    await startAndEnd(h.voice.last())
    await advance(0)
    // The holes stay open after the hint ends.
    expect(
      screen.getAllByTestId(/^math-bed-hole-[789]-pulsed$/, HIDDEN),
    ).toHaveLength(3)
  })

  it('a right tap fills the "?" with 3 and blooms the buds', async () => {
    const h = await setup()
    await toP4(h)
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Seven and three make ten!')
    expect(screen.getByTestId('math-equation-gap-answered')).toBeOnTheScreen()
    expect(
      screen.getAllByTestId(/^math-bed-bloom-[789]$/, HIDDEN),
    ).toHaveLength(3)
  })

  it('the 3rd wrong opens the holes and rings the "?"', async () => {
    const h = await setup()
    await toP4(h)
    // Two wrongs, then a third before the hint starts.
    await fireEvent.press(screen.getByTestId('math-chip-2'))
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-4'))
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-2'))
    await startAndEnd(h.voice.last()) // "Hmm... try again?"
    expect(h.voice.last().text).toBe('This one is three.')
    expect(screen.getByTestId('math-equation-gap-ring')).toBeOnTheScreen()
    expect(
      screen.getAllByTestId(/^math-bed-hole-[789]-pulsed$/, HIDDEN),
    ).toHaveLength(3)
    await startAndEnd(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    expect(
      screen.getAllByTestId(/^math-bed-bloom-[789]$/, HIDDEN),
    ).toHaveLength(3)
  })
})

describe('no dot card on a missing number (§ 1.4, AC 11)', () => {
  it('3 + ? = 5 on a scaffold day (both parts dice-sized): no card, the stone instead', async () => {
    const specs = [...SPECS]
    specs[3] = miss('Three', 'two', 'five')
    const plan = planOf(specs)
    const h = await setup({
      plan,
      subitisingScaffoldActive: true,
      subitisingSubScaffoldActive: false,
    })
    for (let i = 0; i < 3; i++) await answerRight(h, i)
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    expect(h.voice.last().text).toBe('Three and what make five?')
    expect(screen.queryByTestId('math-dot-card', HIDDEN)).toBeNull()
    expect(screen.getByTestId('math-missing-stone', HIDDEN)).toBeOnTheScreen()
  })
})

describe('the hiding line in a review (§ 6.1)', () => {
  it('a review without a missing-number block plays no hiding line', async () => {
    const plainPlan = planOf(
      SPECS.map((s, i) =>
        i === 3 || i === 5 || i === 7 ? plain(['Four', 'Four', 'Eight']) : s,
      ),
    )
    const h = await setup({
      plan: { ...plainPlan, id: 'review-math' },
      review: true,
    })
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    await startAndEnd(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    for (let i = 0; i < 8; i++) {
      const read = h.voice.last()
      expect(read.text).toBe(plainPlan.problems[i]!.utterances.read)
      await act(async () => {
        read.opts.onPlay?.()
      })
      await flush()
      await fireEvent.press(
        screen.getByTestId(`math-chip-${plainPlan.problems[i]!.correct}`),
      )
      await flush()
      await startAndEnd(h.voice.last())
      await advance(ADVANCE_AFTER_CORRECT_MS)
    }
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
  })
})
