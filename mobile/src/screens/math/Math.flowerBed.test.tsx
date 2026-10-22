/**
 * The flower bed on adding to ten's missing numbers
 * (`design/native/flower-bed-into-add-to-10.md` § 7.2, N1-N7, N9): the bed
 * in the counting row's place on every missing number whose whole is ten
 * (canon P4, P6, P8, and in review, warm-up, peek and replay), sized to the
 * row's flowers; the empty part bare soil until hint 3, the guided answer
 * or a landing bud opens its holes (Dave's D1); hint 1's by-row ripple; the
 * hop from the right chip; nothing on a tap on the bed; Reduce Motion's
 * fades. Adding to twenty keeps the counting row. Driven through fakes of
 * Emma's voice and the session-guide player; silent.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  ExtendedMathProblem,
  ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
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
import { HOP_MS, HOP_STAGGER_MS } from './BudHop'
import { ROW_RIPPLE_GAP_MS } from './FlowerBed'
import { MathScreen, type MathProps, type MathSfx } from './Math'
import { BLOOM_FADE_MS } from './MissingNumber'
import type { PlayMathUtteranceOptions } from './mathTypes'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const LANDSCAPE: Viewport = { width: 667, height: 375, insets: NO_INSETS }
const TABLET: Viewport = {
  width: 820,
  height: 1180,
  insets: { top: 24, bottom: 20, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

function canonPlan(stem: string): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}
/** 1+2, 2+2, 3+2, 7+?=10, 4+4, 6+?=10, 4+5, 8+?=10. */
const ADD10 = canonPlan('add-to-10')
const ADD20 = canonPlan('add-to-20')
const P4 = ADD10.problems[3]!

const at = (p: ExtendedMathProblem, index: number): ExtendedMathProblem => ({
  ...p,
  index,
})
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

async function setup(
  overrides: Partial<MathProps> = {},
  viewport: Viewport = PORTRAIT,
) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const sfx = fakeSfx()
  await render(
    <MathScreen
      layout={mathLayout(viewport)}
      plan={ADD10}
      playUtterance={voice.play}
      audioReady
      focusNode="add-to-10"
      sfx={sfx}
      storage={memoryStorage()}
      visibility={VISIBLE}
      sessionGuide={guide.player}
      onRequestExit={jest.fn()}
      cancelLine={jest.fn()}
      {...overrides}
    />,
  )
  await flush()
  return { voice, guide, sfx }
}

type H = Awaited<ReturnType<typeof setup>>

/** Let every guide line queued so far play through, then start the read. */
async function toRead(h: H, seen: { guide: number }) {
  while (h.guide.lines.length > seen.guide) {
    await startAndEnd(h.guide.lines[seen.guide]!)
    seen.guide += 1
    await advance(SESSION_GUIDE_GAP_MS)
  }
  const read = h.voice.last()
  await act(async () => {
    read.opts.onPlay?.()
  })
  await flush()
  return read
}

async function answerRight(h: H, correct: number) {
  await fireEvent.press(screen.getByTestId(`math-chip-${correct}`))
  await flush()
  await startAndEnd(h.voice.last())
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

/** Straight to add-to-10's P4 ("Seven and what make ten?"), read started. */
async function toP4(h: H) {
  const seen = { guide: 0 }
  for (let i = 0; i < 3; i++) {
    await toRead(h, seen)
    await answerRight(h, ADD10.problems[i]!.correct)
  }
  const read = await toRead(h, seen)
  expect(read.text).toBe('Seven and what make ten?')
}

async function tap(value: number) {
  await fireEvent.press(screen.getByTestId(`math-chip-${value}`))
  await flush()
}

const bed = () => screen.queryByTestId('math-bed', HIDDEN)
const flowers = () => screen.queryAllByTestId('math-bed-flower', HIDDEN).length
const blooms = () =>
  screen.queryAllByTestId(/^math-bed-bloom-\d$/, HIDDEN).length
/** Slot i's opened hole, whatever its suffix; `null` while it is soil. */
const hole = (i: number) => {
  const found = screen.queryAllByTestId(
    new RegExp(`^math-bed-hole-${i}(-|$)`),
    HIDDEN,
  )
  return found.length === 0 ? null : String(found[0]!.props.testID)
}
const hops = () => screen.queryAllByTestId(/^math-hop-\d$/, HIDDEN)
const pulsedGiven = () =>
  screen
    .queryAllByTestId(/^math-bed-given-\d-pulsed$/, HIDDEN)
    .map((n) => Number(String(n.props.testID).split('-')[3]))
    .sort((a, b) => a - b)
const box = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id, HIDDEN).props.style)

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('N1: the bed on add-to-10 canon P4, P6 and P8 only', () => {
  it('P4, P6, P8 draw math-bed and no counting row group; the others draw the row and no bed', async () => {
    const h = await setup()
    const seen = { guide: 0 }
    for (let i = 0; i < 8; i++) {
      const p = ADD10.problems[i]!
      const read = await toRead(h, seen)
      expect(read.text).toBe(p.utterances.read)
      if ([3, 5, 7].includes(i)) {
        expect(bed()).not.toBeNull()
        expect(screen.queryAllByTestId(/^math-missing-group-/, HIDDEN)).toEqual(
          [],
        )
        expect(screen.queryAllByTestId(/^math-flower-group-/, HIDDEN)).toEqual(
          [],
        )
      } else {
        expect(bed()).toBeNull()
        expect(
          screen.getByTestId('math-flower-group-a', HIDDEN),
        ).toBeOnTheScreen()
      }
      if (i === 3) {
        expect(
          screen.getByTestId('math-symbolic').props.accessibilityLabel,
        ).toBe('Seven and what make ten?')
      }
      await answerRight(h, p.correct)
    }
  })
})

describe('N2: adding to twenty keeps the counting row', () => {
  it('its P4 draws the row and the "?" stone, no bed', async () => {
    const h = await setup({ plan: ADD20, focusNode: 'add-to-20' })
    const seen = { guide: 0 }
    for (let i = 0; i < 3; i++) {
      await toRead(h, seen)
      await answerRight(h, ADD20.problems[i]!.correct)
    }
    await toRead(h, seen)
    expect(ADD20.problems[3]!.kind).toBe('missing-addend')
    expect(screen.getByTestId('math-missing-stone', HIDDEN)).toBeOnTheScreen()
    expect(bed()).toBeNull()
  })
})

describe('N3: 7 full slots, 3 of bare soil, at the row’s size', () => {
  it.each([
    ['375 × 667', PORTRAIT, 156, 72],
    ['667 × 375', LANDSCAPE, 138.7, 64],
    // The tablet: no reserved slot; the row's 51.2 pt flowers (§ 3).
    ['820 × 1180 (t24 b20)', TABLET, 332.8, 153.6],
  ] as const)('%s', async (_, viewport, width, height) => {
    const h = await setup({}, viewport)
    const seen = { guide: 0 }
    for (let i = 0; i < 2; i++) {
      await toRead(h, seen)
      await answerRight(h, ADD10.problems[i]!.correct)
    }
    await toRead(h, seen)
    const rowAtP3 = box('math-visual-row').height
    await answerRight(h, ADD10.problems[2]!.correct)
    await toRead(h, seen)
    expect(flowers()).toBe(7)
    for (const i of [7, 8, 9]) expect(hole(i)).toBeNull()
    const b = box('math-bed')
    expect(b.width).toBeCloseTo(width, 1)
    expect(b.height).toBeCloseTo(height, 1)
    // A phone's visual row keeps its height, so the equation does not
    // move; a tablet's row is the bed's height (the row's, before).
    if (viewport === TABLET)
      expect(box('math-visual-row').height).toBe(b.height)
    else expect(box('math-visual-row').height).toBe(rowAtP3)
  })
})

describe('N4: the right tap hops the buds in', () => {
  it('3 buds in a touchless layer; hole 7 + j opens as bud j lands; 10 full slots; the advance comes after the last bloom', async () => {
    const h = await setup()
    await toP4(h)
    await tap(3)
    expect(hops()).toHaveLength(3)
    expect(screen.getByTestId('math-hop', HIDDEN).props.pointerEvents).toBe(
      'none',
    )
    const land = (j: number) => HOP_MS + HOP_STAGGER_MS * j
    let t = 0
    for (let j = 0; j < 3; j++) {
      await advance(land(j) - 1 - t)
      expect(hole(7 + j)).toBeNull()
      await advance(1)
      t = land(j)
      expect(hole(7 + j)).toBe(`math-bed-hole-${7 + j}`)
    }
    expect(flowers() + blooms()).toBe(10)
    // The correct line ends at once here; the advance is 1,200 ms after it.
    const lastBloomEnd = land(2) + BLOOM_FADE_MS
    expect(lastBloomEnd).toBeLessThan(ADVANCE_AFTER_CORRECT_MS)
    const reads = h.voice.lines.length
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('Yes! Seven and three make ten!')
    await advance(ADVANCE_AFTER_CORRECT_MS - t - 1)
    expect(h.voice.lines).toHaveLength(reads)
    await advance(t + 1)
    expect(h.voice.last().text).toBe(ADD10.problems[4]!.utterances.read)
  })
})

describe('N5: wrong taps, the hints and the guided answer on the bed', () => {
  it('1st wrong: nothing moves; hint 1 ripples by row; hint 3 opens and pulses the holes; no bud', async () => {
    const h = await setup()
    await toP4(h)
    await tap(2)
    expect(hops()).toEqual([])
    expect(flowers()).toBe(7)
    for (const i of [7, 8, 9]) expect(hole(i)).toBeNull()
    await startAndEnd(h.voice.last())
    await tap(4)
    await startAndEnd(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(pulsedGiven()).toEqual([0, 1, 2, 3, 4])
    await advance(ROW_RIPPLE_GAP_MS)
    expect(pulsedGiven()).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const i of [7, 8, 9]) expect(hole(i)).toBeNull()
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('Seven flowers.')
    for (const i of [7, 8, 9]) expect(hole(i)).toBeNull()
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('How many more make ten?')
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-pulsed`)
    expect(hops()).toEqual([])
    expect(blooms()).toBe(0)
  })

  it('3rd wrong after hint 3: the guided answer; the holes do not pulse again', async () => {
    const sequences = jest.spyOn(Reanimated, 'withSequence')
    const h = await setup()
    await toP4(h)
    await tap(2)
    await startAndEnd(h.voice.last())
    await tap(4)
    await startAndEnd(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    for (let k = 0; k < 3; k++) await startAndEnd(h.voice.last())
    await advance(0)
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-pulsed`)
    // Each hole's pulse is one withSequence; count them from here on.
    const holePulse = (calls: unknown[][]) =>
      calls.filter(([a, b]) => a === 1.1 && b === 1).length
    const before = holePulse(sequences.mock.calls)
    // Hint 3 pulsed the three holes (and hint 1 the seven flowers).
    expect(before).toBeGreaterThanOrEqual(3)
    await tap(2)
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('This one is three.')
    expect(screen.getByTestId('math-equation-gap-ring')).toBeOnTheScreen()
    expect(holePulse(sequences.mock.calls)).toBe(before)
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-pulsed`)
    expect(hops()).toEqual([])
  })

  it('3rd wrong that cuts the hint before hint 3: the holes open and pulse once at the guided start; the glowing chip hops', async () => {
    const h = await setup()
    await toP4(h)
    await tap(2)
    await startAndEnd(h.voice.last())
    await tap(4)
    await startAndEnd(h.voice.last())
    // Before the hint starts.
    await tap(2)
    await startAndEnd(h.voice.last()) // "Hmm... try again?"
    expect(h.voice.last().text).toBe('This one is three.')
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-pulsed`)
    expect(hops()).toEqual([])
    await startAndEnd(h.voice.last())
    await tap(3)
    expect(hops()).toHaveLength(3)
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-pulsed`)
  })
})

describe('N6: the bed is not a target', () => {
  it('a tap on the bed or a planted hole plays nothing and changes nothing', async () => {
    const h = await setup()
    await toP4(h)
    const lines = h.voice.lines.length
    await fireEvent.press(screen.getByTestId('math-bed', HIDDEN))
    await fireEvent.press(screen.getByTestId('math-bed-hole-0', HIDDEN))
    await advance(1000)
    expect(h.voice.lines).toHaveLength(lines)
    expect(h.sfx.poof.play).not.toHaveBeenCalled()
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(3)
    expect(flowers()).toBe(7)
    for (const i of [7, 8, 9]) expect(hole(i)).toBeNull()
  })
})

describe('N7: Reduce Motion', () => {
  beforeEach(() => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  })

  it('a right tap before hint 3: no hop; hole j fades in with bud j', async () => {
    const h = await setup()
    await toP4(h)
    await tap(3)
    expect(hops()).toEqual([])
    expect(screen.queryByTestId('math-hop', HIDDEN)).toBeNull()
    await advance(0)
    expect(hole(7)).toBe('math-bed-hole-7')
    expect(hole(8)).toBeNull()
    await advance(80)
    expect(hole(8)).toBe('math-bed-hole-8')
    expect(hole(9)).toBeNull()
    await advance(80)
    expect(hole(9)).toBe('math-bed-hole-9')
    expect(h.voice.last().text).toBe('Yes! Seven and three make ten!')
  })

  it('hint 3: the holes fade in and dip; no ripple on hint 1', async () => {
    const h = await setup()
    await toP4(h)
    await tap(2)
    await startAndEnd(h.voice.last())
    await tap(4)
    await startAndEnd(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(pulsedGiven()).toEqual([])
    await startAndEnd(h.voice.last())
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('How many more make ten?')
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-dipped`)
  })

  it('the guided start when hint 3 was cut: the holes fade in and dip', async () => {
    const h = await setup()
    await toP4(h)
    await tap(2)
    await startAndEnd(h.voice.last())
    await tap(4)
    await startAndEnd(h.voice.last())
    await tap(2)
    await startAndEnd(h.voice.last())
    expect(h.voice.last().text).toBe('This one is three.')
    for (const i of [7, 8, 9]) expect(hole(i)).toBe(`math-bed-hole-${i}-dipped`)
  })
})

describe('N9: the bed wherever an adding-to-ten missing number plays', () => {
  async function bedOnFirst(h: H) {
    const read = await toRead(h, { guide: 0 })
    expect(read.text).toBe('Seven and what make ten?')
    expect(bed()).not.toBeNull()
    expect(flowers()).toBe(7)
  }

  it('a review', async () => {
    const h = await setup({
      plan: round([at(P4, 1), ...ADD10.problems.slice(0, 7)], 'review-math'),
      review: true,
    })
    await bedOnFirst(h)
  })

  it('a warm-up heart', async () => {
    const h = await setup({
      plan: round([at(P4, 1), ...ADD10.problems]),
      warmupCount: 1,
    })
    expect(h.guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
    await bedOnFirst(h)
  })

  it('a Map peek', async () => {
    const problems = [at(P4, 1), ...ADD10.problems.slice(0, 2)]
    const h = await setup({
      plan: round(problems, 'peek'),
      peek: 'add-to-10',
      problemNodes: problems.map(() => 'add-to-10' as const),
    })
    await bedOnFirst(h)
  })

  it('a replay of adding to ten', async () => {
    const problems = [at(P4, 1), ...ADD10.problems.slice(0, 7)]
    const h = await setup({
      plan: round(problems, 'replay'),
      peek: 'add-to-10',
      replay: true,
      problemNodes: problems.map(() => 'add-to-10' as const),
    })
    expect(h.guide.lines.map((l) => l.id)).toEqual([
      'guide.session.replay-open.add-to-10',
    ])
    await bedOnFirst(h)
  })
})

const N8_ON_MAIN = {
  result: {
    totalCorrect: 7,
    totalStardust: 8,
    finalStreak: 2,
    earnedThisSession: 8,
    perProblemCorrect: [true, true, true, false, true, false, true, true],
    latencyMs: [-1, -1, -1, -1, -1, -1, -1, -1],
    perProblemAnswerValue: [3, 4, 5, 2, 8, 3, 9, 2],
    perProblemDistractorClass: [
      null,
      null,
      null,
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
    ],
    subitisingScaffoldRendered: false,
    subitisingScaffoldSubRendered: false,
    warmupCorrect: [],
    firstTapCorrect: [true, true, true, false, true, false, true, true],
  },
  writes: [
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
    'marian-tutor.stardust.v1',
  ],
  stardust: 'Stardust: 8',
}

describe('N8: scoring parity', () => {
  it('a session with right, hinted and guided bed problems scores as on 2f851274', async () => {
    const storage = memoryStorage()
    const writes: [string, string][] = []
    const spyStorage: StorageAdapter = {
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => {
        writes.push([k, v])
        storage.setItem(k, v)
      },
    }
    const onSessionComplete = jest.fn()
    const h = await setup({ storage: spyStorage, onSessionComplete })
    const seen = { guide: 0 }
    for (let i = 0; i < 8; i++) {
      const p = ADD10.problems[i]!
      await toRead(h, seen)
      if (i === 3) {
        // P4: two wrongs, the full hint, then right.
        await tap(2)
        await startAndEnd(h.voice.last())
        await tap(4)
        await startAndEnd(h.voice.last())
        await advance(HINT_DELAY_AFTER_WRONG_MS)
        for (let k = 0; k < 3; k++) await startAndEnd(h.voice.last())
      }
      if (i === 5) {
        // P6: three wrongs before the hint, the guided answer, then right.
        const wrong = [3, 5].find((v) =>
          screen.queryByTestId(`math-chip-${v}`),
        )!
        await tap(wrong)
        await startAndEnd(h.voice.last())
        await tap(wrong)
        await startAndEnd(h.voice.last())
        await tap(wrong)
        await startAndEnd(h.voice.last())
        await startAndEnd(h.voice.last())
      }
      await answerRight(h, p.correct)
    }
    expect(onSessionComplete).toHaveBeenCalledTimes(1)
    const result = onSessionComplete.mock.calls[0]![0]
    // Recorded by running this same session on origin/main's Math.tsx
    // (2f851274's scoring, no bed): byte-identical.
    expect({
      result,
      writes: writes.map(([k]) => k),
      stardust: screen.getByTestId('math-stardust').props.accessibilityLabel,
    }).toEqual(N8_ON_MAIN)
  })
})
