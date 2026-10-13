/**
 * Math with core's extended kinds (Number Garden 1 and 8–11), on the
 * committed canon: what each problem shows, its chips, the hint beats
 * (spec `design/native/math-skip-counting-multiplication-native.md` § 5,
 * § 10), the frames (§ 6) and the result. Emma's voice is a fake the test
 * drives; nothing plays.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import type { SkillNode } from '@marian/core/progress'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { REPO_ROOT } from '../../../test/webSource'
import { CAPTION_WALK_MS_PER_WORD, type Sfx } from '../../audio'
import type { Viewport } from '../../layout/layout'
import { extendedMathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import { MathScreen, TIMES_GLYPH, type MathProps, type MathSfx } from './Math'
import type { MathSessionResult, PlayMathUtteranceOptions } from './mathTypes'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const LANDSCAPE: Viewport = { width: 667, height: 375, insets: NO_INSETS }

function canon(node: string): ExtendedMathSessionPlan {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${node}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}

interface Line {
  text: string
  opts: PlayMathUtteranceOptions
  resolve: () => void
  reject: (err: Error) => void
}

function fakeVoice() {
  const lines: Line[] = []
  const play = jest.fn(
    (text: string, opts: PlayMathUtteranceOptions = {}) =>
      new Promise<void>((resolve, reject) => {
        lines.push({ text, opts, resolve, reject })
      }),
  )
  return {
    lines,
    play,
    last: () => {
      const l = lines.at(-1)
      if (!l) throw new Error('no line yet')
      return l
    },
  }
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

const visible: AppVisibility = {
  getIsHidden: () => false,
  subscribe: () => () => {},
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flush()
}

/** The line starts and ticks `words` words (all by default); maybe ends. */
async function say(
  line: Line,
  { end = true, words }: { end?: boolean; words?: number } = {},
) {
  const all = line.text.split(/\s+/).filter(Boolean)
  await act(async () => {
    line.opts.onPlay?.()
    for (let i = 0; i < (words ?? all.length); i++) line.opts.onWordTick?.(i)
    if (end) line.resolve()
  })
  await flush()
}

async function tap(value: number) {
  await fireEvent.press(screen.getByTestId(`math-chip-${value}`))
  await flush()
}

/** The groups row is hidden from accessibility (like `CountingRow`). */
const HIDDEN = { includeHiddenElements: true }
const group = (id: string) => screen.queryByTestId(id, HIDDEN)

/** The ribbon's slot height when it is capped (`maxLines`), else `null`. */
function ribbonCap(): number | null {
  const lines = screen.queryByTestId(/^caption-lines-up-/)
  if (lines === null) return null
  return StyleSheet.flatten(lines.parent?.props.style).maxHeight as number
}

function chipValues(): number[] {
  return within(screen.getByTestId('math-chips'))
    .getAllByTestId(/^math-chip-\d+$/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
}

async function setup(
  plan: ExtendedMathSessionPlan,
  {
    viewport = PORTRAIT,
    planFocusNode,
    onSessionComplete = jest.fn(),
    silent = false,
  }: {
    viewport?: Viewport
    planFocusNode?: SkillNode
    onSessionComplete?: (r: MathSessionResult) => void
    /** No player: Math's silent caption walk. */
    silent?: boolean
  } = {},
) {
  const voice = fakeVoice()
  const kind = plan.problems[0]!.kind
  const props: MathProps = {
    layout: extendedMathLayout(viewport, kind),
    plan,
    planFocusNode,
    playUtterance: silent ? undefined : voice.play,
    audioReady: true,
    sfx: fakeSfx(),
    storage: memoryStorage(),
    visibility: visible,
    onRequestExit: jest.fn(),
    cancelLine: jest.fn(),
    onSessionComplete,
  }
  await render(<MathScreen {...props} />)
  await flush()
  return { voice, plan }
}

type Harness = Awaited<ReturnType<typeof setup>>

/** She answers problem `index` right (first tap), "Yes!" ends, it advances. */
async function answerRight(h: Harness, index: number) {
  const problem = h.plan.problems[index]!
  const read = h.voice.last()
  expect(read.text).toBe(problem.utterances.read)
  await say(read, { end: false })
  await advance(1000)
  await tap(problem.correct)
  read.reject(new Error('cancelled'))
  await flush()
  await say(h.voice.last())
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

/** Two wrong taps on the current problem; the hint's first line is next. */
async function twoWrongs(h: Harness, index: number) {
  const problem = h.plan.problems[index]!
  const read = h.voice.last()
  await say(read)
  const wrong = chipValues().filter((v) => v !== problem.correct)
  await tap(wrong[0]!)
  await say(h.voice.last()) // reprompt
  await tap(wrong[1]!)
  await say(h.voice.last()) // reprompt
  await advance(HINT_DELAY_AFTER_WRONG_MS)
  expect(h.voice.last().text).toBe(problem.utterances.hint1)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('skip counting', () => {
  it('P1 shows the stones 2 4 6 8 and "?", no equation, chips 2 / 10 / 12', async () => {
    await setup(canon('skip-counting'))
    const track = screen.getByTestId('math-skip-track')
    expect(track.props.accessibilityLabel).toBe(
      'Two, four, six, eight. What is next?',
    )
    for (const n of [2, 4, 6, 8]) {
      expect(screen.getByTestId(`math-skip-stone-${n}`)).toBeTruthy()
    }
    expect(screen.getByTestId('math-skip-gap')).toBeTruthy()
    expect(screen.queryByTestId('math-symbolic')).toBeNull()
    expect(screen.queryByTestId('math-visual-groups')).toBeNull()
    expect(chipValues().sort((a, b) => a - b)).toEqual([2, 10, 12])
  })

  it('hint 2 shows the hops between the given stones, hint 3 the last; the guided answer rings "?"', async () => {
    const h = await setup(canon('skip-counting'))
    await twoWrongs(h, 0)
    await say(h.voice.last(), { end: false }) // hint 1 playing
    expect(screen.queryByTestId('math-skip-hop-1')).toBeNull()
    await say(h.voice.last()) // hint 1 ends; hint 2 starts
    expect(h.voice.last().text).toBe('We add two each time.')
    for (const k of [1, 2, 3]) {
      expect(screen.getByTestId(`math-skip-hop-${k}`)).toBeTruthy()
    }
    expect(screen.queryByTestId('math-skip-hop-last')).toBeNull()
    await say(h.voice.last()) // hint 2 ends; hint 3 starts
    expect(h.voice.last().text).toBe('Eight and two more is what?')
    expect(screen.getByTestId('math-skip-hop-last')).toBeTruthy()
    await say(h.voice.last()) // hint 3 ends
    // The hops stay; the third wrong tap brings the guided answer.
    await tap(2)
    await say(h.voice.last()) // reprompt
    expect(h.voice.last().text).toBe('This one is ten.')
    expect(screen.getByTestId('math-skip-gap-ring')).toBeTruthy()
    expect(screen.getByTestId('math-skip-hop-1')).toBeTruthy()
  })

  it('a correct tap fills "?" with the answer', async () => {
    const h = await setup(canon('skip-counting'))
    await say(h.voice.last(), { end: false })
    await tap(10)
    expect(screen.getByTestId('math-skip-gap-answered')).toBeTruthy()
  })

  it('all 8 problems use one stone size; 6–9 cells take two rows', async () => {
    const h = await setup(canon('skip-counting'))
    const sizes: number[] = []
    for (let i = 0; i < 8; i++) {
      const first = h.plan.problems[i]
      if (first?.kind !== 'skip-count') throw new Error('not skip')
      const stone = screen.getByTestId(
        `math-skip-stone-${first.sequence.at(-1)}`,
      )
      sizes.push(StyleSheet.flatten(stone.props.style).width as number)
      if (i < 7) await answerRight(h, i)
    }
    expect(new Set(sizes).size).toBe(1)
    expect(sizes[0]).toBe(55)
  })
})

describe('multiplication', () => {
  it('mult-2-5-10 P4 shows 2 × 3 = ? over 3 plates of 2, tags + "+" from the reveal', async () => {
    const h = await setup(canon('mult-2-5-10'), {
      planFocusNode: 'mult-2-5-10',
    })
    for (let i = 0; i < 3; i++) await answerRight(h, i)
    const tokens = within(screen.getByTestId('math-symbolic'))
      .getAllByText(/.+/)
      .map((t) => String(t.props.children))
    expect(tokens).toEqual(['2', TIMES_GLYPH, '3', '=', '?'])
    expect(TIMES_GLYPH).toBe('×')
    for (const k of [0, 1, 2]) {
      expect(group(`math-group-plate-${k}`)).toBeTruthy()
      expect(group(`math-group-tag-${k}`)).toBeTruthy()
    }
    expect(group('math-group-plate-3')).toBeNull()
    expect(group('math-group-plus-1')).toBeTruthy()
    expect(group('math-group-plus-2')).toBeTruthy()
    expect(chipValues().sort((a, b) => a - b)).toEqual([5, 6, 7])
  })

  it('mult-3-4: tags hidden at the reveal; hint 2 lights plate k at the k-th "two"', async () => {
    const h = await setup(canon('mult-3-4'), { planFocusNode: 'mult-3-4' })
    // P1: "Two times three." → 3 plates of 2.
    expect(group('math-group-tag-0')).toBeNull()
    await twoWrongs(h, 0)
    await say(h.voice.last()) // hint 1
    const hint2 = h.voice.last()
    expect(hint2.text).toBe('Two, then two, then two.')
    await say(hint2, { end: false, words: 1 }) // "Two,"
    expect(group('math-group-tag-0')).toBeTruthy()
    expect(group('math-group-plate-0-lit')).toBeTruthy()
    expect(group('math-group-tag-1')).toBeNull()
    await say(hint2, { end: false, words: 3 }) // "… then two,"
    expect(group('math-group-tag-1')).toBeTruthy()
    expect(group('math-group-plus-1')).toBeTruthy()
    expect(group('math-group-tag-2')).toBeNull()
    await say(hint2) // the line ends
    expect(group('math-group-tag-2')).toBeTruthy()
    expect(group('math-group-plus-2')).toBeTruthy()
  })

  it('mult-3-4 with silent captions: the caption walk lights the plates too', async () => {
    await setup(canon('mult-3-4'), { planFocusNode: 'mult-3-4', silent: true })
    const W = CAPTION_WALK_MS_PER_WORD
    // "Two times three. How many?" walks; its chips are open at once.
    await tap(1)
    await advance(4 * W) // "Hmm... try again?" ends
    await tap(20)
    await advance(4 * W)
    await advance(HINT_DELAY_AFTER_WRONG_MS) // "Look at the groups." starts
    await advance(5 * W) // … ends; "Two, then two, then two." starts
    expect(group('math-group-tag-0')).toBeTruthy()
    expect(group('math-group-tag-1')).toBeNull()
    await advance(2 * W) // "… then two,"
    expect(group('math-group-tag-1')).toBeTruthy()
    expect(group('math-group-tag-2')).toBeNull()
    await advance(2 * W) // "… then two."
    expect(group('math-group-tag-2')).toBeTruthy()
  })

  it('mult-3-4: the guided answer shows every tag and "+"', async () => {
    const h = await setup(canon('mult-3-4'), { planFocusNode: 'mult-3-4' })
    const read = h.voice.last()
    await say(read)
    const wrong = chipValues().filter((v) => v !== 6)
    await tap(wrong[0]!)
    await say(h.voice.last())
    await tap(wrong[1]!)
    // The third wrong lands before the hint starts.
    await tap(wrong[0]!)
    await say(h.voice.last())
    await say(h.voice.last()) // reprompt → guided
    expect(h.voice.last().text).toBe('This one is six.')
    for (const k of [0, 1, 2]) {
      expect(group(`math-group-tag-${k}`)).toBeTruthy()
    }
  })

  it('mult-6-9 P5 7 × 3: 3 plates, each a column of 5 + a column of 2', async () => {
    const h = await setup(canon('mult-6-9'), { planFocusNode: 'mult-6-9' })
    for (let i = 0; i < 4; i++) await answerRight(h, i)
    expect(h.voice.last().text).toBe('Seven times three. How many?')
    type Node = {
      type: string
      props: Record<string, unknown>
      children: (Node | string)[] | null
    }
    const find = (n: Node | string, id: string): Node | null => {
      if (typeof n === 'string') return null
      if (n.props.testID === id) return n
      for (const c of n.children ?? []) {
        const hit = find(c, id)
        if (hit) return hit
      }
      return null
    }
    const flowers = (n: Node | string): number =>
      typeof n === 'string'
        ? 0
        : (n.type === 'RNSVGSvgView' ? 1 : 0) +
          (n.children ?? []).reduce((sum, c) => sum + flowers(c), 0)
    const tree = screen.toJSON() as unknown as Node
    for (const k of [0, 1, 2]) {
      const plate = find(tree, `math-group-plate-${k}`)
      expect(plate).not.toBeNull()
      // The plate's children: its flower columns, then the tag box.
      const columns = (plate!.children ?? []).slice(0, -1)
      expect(columns.map(flowers)).toEqual([5, 2])
    }
    expect(find(tree, 'math-group-plate-3')).toBeNull()
  })

  it('mult-6-9: tags from the reveal', async () => {
    await setup(canon('mult-6-9'), { planFocusNode: 'mult-6-9' })
    expect(group('math-group-tag-0')).toBeTruthy()
    expect(group('math-group-tag-1')).toBeTruthy()
  })

  it('phone landscape: the chip column and a 1-line ribbon', async () => {
    const h = await setup(canon('mult-6-9'), {
      viewport: LANDSCAPE,
      planFocusNode: 'mult-6-9',
    })
    await say(h.voice.last(), { end: false })
    const chips = screen.getByTestId('math-chips')
    expect(StyleSheet.flatten(chips.props.style).flexDirection).toBe('column')
    expect(ribbonCap()).toBe(1 * 22 * 1.375)
  })

  it('phone portrait: the ribbon is capped at 4 lines', async () => {
    const h = await setup(canon('skip-counting'))
    await say(h.voice.last(), { end: false })
    expect(ribbonCap()).toBe(4 * 22 * 1.375)
  })
})

describe('number recognition', () => {
  it('P1 shows the strip with ten dots, no numerals, and the chips 1, 3, 10', async () => {
    await setup(canon('number-recog'))
    expect(
      screen.getByTestId('math-number-strip').props.accessibilityLabel,
    ).toBe('Tap the one.')
    for (let n = 1; n <= 10; n++) {
      expect(screen.getByTestId(`math-strip-cell-${n}-dot`)).toBeTruthy()
    }
    expect(screen.queryByTestId('math-symbolic')).toBeNull()
    expect(chipValues().sort((a, b) => a - b)).toEqual([1, 3, 10])
  })

  it('a correct tap before hint 1 shows only the target, filled', async () => {
    const h = await setup(canon('number-recog'))
    await say(h.voice.last(), { end: false })
    await tap(1)
    expect(screen.getByTestId('math-strip-cell-1-lit')).toBeTruthy()
    expect(screen.getByTestId('math-strip-cell-2-dot')).toBeTruthy()
    expect(screen.getByTestId('math-strip-cell-10-dot')).toBeTruthy()
  })

  it('P5 "Tap the seven.": hint 1 shows the numerals, hint 2 lights 5', async () => {
    const h = await setup(canon('number-recog'))
    for (let i = 0; i < 4; i++) await answerRight(h, i)
    expect(h.voice.last().text).toBe('Tap the seven.')
    expect(screen.getByTestId('math-strip-cell-7-dot')).toBeTruthy()
    await twoWrongs(h, 4) // hint 1 starts: the numerals come in
    for (let n = 1; n <= 10; n++) {
      expect(screen.queryByTestId(`math-strip-cell-${n}-dot`)).toBeNull()
    }
    expect(screen.queryByTestId('math-strip-cell-5-lit')).toBeNull()
    await say(h.voice.last()) // hint 1 ends; hint 2 starts
    expect(h.voice.last().text).toBe('Seven is bigger than five.')
    expect(screen.getByTestId('math-strip-cell-5-lit')).toBeTruthy()
    expect(screen.getByTestId('math-strip-cell-7')).toBeTruthy()
  })
})

describe('the result', () => {
  it.each([
    ['number-recog', 'off-by-one'],
    ['skip-counting', 'count-by-one'],
    ['mult-6-9', 'wrong-op'],
  ] as const)(
    '%s: the offered class is null on P1–P3, %s on P4–P8',
    async (node, offered) => {
      const onSessionComplete = jest.fn()
      const h = await setup(canon(node), {
        onSessionComplete,
        planFocusNode: node,
      })
      for (let i = 0; i < 8; i++) await answerRight(h, i)
      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const result = onSessionComplete.mock.calls[0]![0] as MathSessionResult
      expect(result.perProblemDistractorClass).toEqual([
        null,
        null,
        null,
        ...Array(5).fill(offered),
      ])
      expect(result.perProblemCorrect).toEqual(Array(8).fill(true))
      expect(result.subitisingScaffoldRendered).toBe(false)
    },
  )
})
