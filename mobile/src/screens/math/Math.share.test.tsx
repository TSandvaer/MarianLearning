/**
 * Sharing on Math's screen (content wave 2 `design/native/content-wave-2.md`
 * § 2.2–§ 2.5, AC 8, AC 9, AC 11) with the committed div-share canon: the
 * pile, the "?" plates, P1–P3's own deal 300 ms after the read, the hint
 * deals of P4–P8, the fast deal and the fill on a right answer, the given
 * answer's instant deal and rings, and Reduce Motion's fades. Driven
 * through fakes of Emma's voice and the session-guide player; silent.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
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
import { AUTO_DEAL_DELAY_MS } from './shareDeal'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

function canonPlan(): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(
        REPO_ROOT,
        'public',
        'canon',
        'math',
        'level-1',
        'div-share.json',
      ),
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

async function setup(overrides: Partial<MathProps> = {}) {
  const voice = fakeVoice()
  const guide = fakeGuide()
  const poses: EmmaPose[] = []
  const onSessionComplete = jest.fn<void, [MathSessionResult]>()
  await render(
    <MathScreen
      layout={extendedMathLayout(PORTRAIT, 'divide')}
      plan={PLAN}
      playUtterance={voice.play}
      audioReady
      focusNode="div-share"
      planFocusNode="div-share"
      sfx={fakeSfx()}
      storage={memoryStorage()}
      visibility={VISIBLE}
      sessionGuide={guide.player}
      onSessionComplete={onSessionComplete}
      onPoseChange={(p) => poses.push(p)}
      onRequestExit={jest.fn()}
      cancelLine={jest.fn()}
      {...overrides}
    />,
  )
  await flush()
  return { voice, guide, poses, onSessionComplete }
}

type H = Awaited<ReturnType<typeof setup>>

/** Each dealt flower's plate (1-based), in deal order k. */
function dealtPlates(): number[] {
  return screen
    .queryAllByTestId(/^math-share-flower-\d+-plate-\d+$/, HIDDEN)
    .map((n) => String(n.props.testID).match(/-(\d+)-plate-(\d+)$/)!)
    .map((m) => [Number(m[1]), Number(m[2])] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, plate]) => plate)
}

const chipValues = () =>
  screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    .sort((a, b) => a - b)

const tagIds = () =>
  screen
    .getAllByTestId(/^math-share-tag-\d+(-filled)?$/, HIDDEN)
    .map((n) => String(n.props.testID))

/** The read plays out; then the right chip, its line and the dwell. */
async function answerRight(h: H, i: number) {
  const read = h.voice.last()
  expect(read.text).toBe(PLAN.problems[i]!.utterances.read)
  await speakAll(read)
  await fireEvent.press(
    screen.getByTestId(`math-chip-${PLAN.problems[i]!.correct}`),
  )
  await flush()
  await speakAll(h.voice.last())
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

async function toP4(h: H) {
  for (let i = 0; i < 3; i++) await answerRight(h, i)
  const read = h.voice.last()
  expect(read.text).toBe(
    'Twelve flowers, three plates. How many on each plate?',
  )
  await speakAll(read)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('P1: 6 flowers, 2 plates (AC 8)', () => {
  it('shows the pile with its "6" tag, two "?" plates, no equation, chips 1 3 10', async () => {
    await setup()
    const stage = screen.getByTestId('math-share')
    expect(stage.props.accessibilityLabel).toBe(
      'Six flowers, two plates. How many on each plate?',
    )
    expect(screen.queryByTestId('math-symbolic')).toBeNull()
    expect(screen.getByTestId('math-share-cloth', HIDDEN)).toBeOnTheScreen()
    expect(
      screen.getAllByTestId(/^math-share-flower-\d+$/, HIDDEN),
    ).toHaveLength(6)
    expect(
      screen.getAllByTestId(/^math-share-plate-\d+$/, HIDDEN),
    ).toHaveLength(2)
    expect(tagIds()).toEqual(['math-share-tag-0', 'math-share-tag-1'])
    expect(chipValues()).toEqual([1, 3, 10])
  })

  it('the read pulses the "6" tag on "Six"', async () => {
    const h = await setup()
    const read = h.voice.last()
    expect(screen.getByTestId('math-share-total', HIDDEN)).toBeOnTheScreen()
    await act(async () => {
      read.opts.onPlay?.()
      read.opts.onWordTick?.(0)
    })
    await flush()
    expect(
      screen.getByTestId('math-share-total-pulsed', HIDDEN),
    ).toBeOnTheScreen()
  })

  it('300 ms after the read ends, the 6 flowers deal plate 1, 2, 1, 2, 1, 2; Emma points during the deal, then listens', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await advance(AUTO_DEAL_DELAY_MS - 1)
    expect(dealtPlates()).toEqual([])
    expect(h.poses.at(-1)).not.toBe('attentive-pointing')
    await advance(1)
    expect(dealtPlates()).toEqual([1, 2, 1, 2, 1, 2])
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    // 6 on 2 lands about 1.12 s later (§ 2.5).
    await advance(1119)
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    await advance(1)
    expect(h.poses.at(-1)).toBe('listening')
    // The tags read "?" until the right tap.
    expect(tagIds()).toEqual(['math-share-tag-0', 'math-share-tag-1'])
  })

  it('a right tap fills both tags with 3', async () => {
    const h = await setup()
    await speakAll(h.voice.last())
    await advance(AUTO_DEAL_DELAY_MS)
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Three on each plate!')
    expect(tagIds()).toEqual([
      'math-share-tag-0-filled',
      'math-share-tag-1-filled',
    ])
  })

  it('a right tap during the read deals the pile fast and fills the tags', async () => {
    const h = await setup()
    const read = h.voice.last()
    await act(async () => {
      read.opts.onPlay?.()
    })
    await flush()
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    expect(dealtPlates()).toEqual([1, 2, 1, 2, 1, 2])
    expect(tagIds()).toEqual([
      'math-share-tag-0-filled',
      'math-share-tag-1-filled',
    ])
  })

  it('the lead "Let\'s share the flowers!" plays before P1’s read when the session has it', async () => {
    const h = await setup({ sessionIntro: 'guide.session.intro.div-share' })
    expect(h.guide.lines.map((l) => l.id)).toEqual([
      'guide.session.intro.div-share',
    ])
    expect(h.voice.lines).toHaveLength(0)
    await speakAll(h.guide.lines[0]!)
    await advance(SESSION_GUIDE_GAP_MS)
    expect(h.voice.last().text).toBe(
      'Six flowers, two plates. How many on each plate?',
    )
  })
})

describe('P4: 12 flowers, 3 plates (AC 9)', () => {
  it('nothing deals before the hints; hint 2 deals one round, hint 3 the other 9', async () => {
    const h = await setup()
    await toP4(h)
    await advance(5000)
    expect(dealtPlates()).toEqual([])
    expect(chipValues()).toEqual([3, 4, 5])
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await speakAll(h.voice.last())
    await fireEvent.press(screen.getByTestId('math-chip-5'))
    await speakAll(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(dealtPlates()).toEqual([])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('One for each plate.')
    expect(dealtPlates()).toEqual([1, 2, 3])
    await speakAll(h.voice.last())
    expect(h.voice.last().text).toBe('How many on each plate?')
    expect(dealtPlates()).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3])
    expect(tagIds()).toEqual([
      'math-share-tag-0',
      'math-share-tag-1',
      'math-share-tag-2',
    ])
  })

  it('a right tap with flowers left deals them all and fills every tag with 4', async () => {
    const h = await setup()
    await toP4(h)
    await fireEvent.press(screen.getByTestId('math-chip-4'))
    await flush()
    expect(h.voice.last().text).toBe('Yes! Four on each plate!')
    expect(dealtPlates()).toHaveLength(12)
    expect(tagIds()).toEqual([
      'math-share-tag-0-filled',
      'math-share-tag-1-filled',
      'math-share-tag-2-filled',
    ])
  })

  it('the given answer lands every flower and rings every tag', async () => {
    const h = await setup()
    await toP4(h)
    for (const chip of [3, 5, 3]) {
      await fireEvent.press(screen.getByTestId(`math-chip-${chip}`))
      await speakAll(h.voice.last())
    }
    expect(h.voice.lines.map((l) => l.text)).toContain('This one is four.')
    expect(dealtPlates()).toHaveLength(12)
    for (let k = 0; k < 3; k++) {
      expect(
        screen.getByTestId(`math-share-tag-ring-${k}`, HIDDEN),
      ).toBeOnTheScreen()
    }
    // The guided tap then plays the correct moment.
    await fireEvent.press(screen.getByTestId('math-chip-4'))
    await flush()
    expect(tagIds()).toEqual([
      'math-share-tag-0-filled',
      'math-share-tag-1-filled',
      'math-share-tag-2-filled',
    ])
  })

  it('a session end records the 8 tapped shares', async () => {
    const h = await setup()
    for (let i = 0; i < 8; i++) await answerRight(h, i)
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    expect(h.onSessionComplete.mock.calls[0]![0].perProblemAnswerValue).toEqual(
      [3, 4, 5, 4, 2, 3, 5, 6],
    )
  })
})

/** A host view's flattened static transform (no animated values). */
const transformOf = (id: string) =>
  JSON.stringify(
    (
      [screen.getByTestId(id, HIDDEN).props.style].flat(Infinity) as {
        transform?: unknown[]
      }[]
    )
      .filter(Boolean)
      .flatMap((st) => st.transform ?? []),
  )

describe('Reduce Motion (AC 11)', () => {
  it('normal motion has one moving flower each, no cell copies', async () => {
    await setup()
    expect(
      screen.queryAllByTestId(/^math-share-flower-\d+-cell$/, HIDDEN),
    ).toHaveLength(0)
  })

  it('the deal is fades only: a pile copy and a cell copy per flower, neither moves', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const h = await setup()
    expect(
      screen.getAllByTestId(/^math-share-flower-\d+-cell$/, HIDDEN),
    ).toHaveLength(6)
    const pileBefore = transformOf('math-share-flower-0')
    const cellBefore = transformOf('math-share-flower-0-cell')
    expect(pileBefore).toContain('translateX')
    expect(cellBefore).toContain('translateX')
    expect(cellBefore).not.toBe(pileBefore)
    await speakAll(h.voice.last())
    await advance(AUTO_DEAL_DELAY_MS)
    expect(dealtPlates()).toEqual([1, 2, 1, 2, 1, 2])
    expect(transformOf('math-share-flower-0-plate-1')).toBe(pileBefore)
    expect(transformOf('math-share-flower-0-cell')).toBe(cellBefore)
    // The tags still fill on a right tap (a crossfade).
    await fireEvent.press(screen.getByTestId('math-chip-3'))
    await flush()
    expect(tagIds()).toEqual([
      'math-share-tag-0-filled',
      'math-share-tag-1-filled',
    ])
  })
})
