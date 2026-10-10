/**
 * Math's contract (web `src/screens/Math/Math.tsx`), driven through a fake
 * of Emma's voice: the test decides when a line starts, ticks its words
 * and ends. Silent: no player exists in this file; the effects are fakes.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import {
  STATIC_SESSION_PLANS,
  type MathSessionPlan,
} from '@marian/core/math/sessionPlans'
import {
  ADVANCE_AFTER_CORRECT_MS,
  ADVANCE_HARD_CEILING_MS,
  HINT_DELAY_AFTER_WRONG_MS,
  STREAK_FADE_OUT_MS,
} from '@marian/core/shared/gameplayConstants'
import type { StorageAdapter } from '@marian/core/shared/stardust'
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_HOLD_MS,
} from '@marian/core/math/dotCard'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { CAPTION_WALK_MS_PER_WORD } from '../../audio'
import type { Sfx } from '../../audio'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import {
  CHIP_GATE_FALLBACK_MS,
  MathScreen,
  STREAK_CHIME_STAGGER_MS,
  type MathProps,
  type MathSfx,
} from './Math'
import type { PlayMathUtteranceOptions } from './mathTypes'
import { createSilentMathPlayer } from './silentPlayer'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const LANDSCAPE: Viewport = { width: 667, height: 375, insets: NO_INSETS }

/** 3+2, 1+4, 4+2, 5+3, 2+5, 6+3, 4+4, 5+5. */
const PLAN = STATIC_SESSION_PLANS[0]

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
    texts: () => lines.map((l) => l.text),
    last: () => {
      const l = lines.at(-1)
      if (!l) throw new Error('no line yet')
      return l
    },
  }
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
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flush()
}

/** The line starts, ticks every word; optionally ends. */
async function say(line: Line, { end = true } = {}) {
  const words = line.text.split(/\s+/).filter(Boolean)
  await act(async () => {
    line.opts.onPlay?.()
    for (let i = 0; i < words.length; i++) line.opts.onWordTick?.(i)
    if (end) line.resolve()
  })
  await flush()
}

async function tap(value: number) {
  await fireEvent.press(screen.getByTestId(`math-chip-${value}`))
  await flush()
}

const chipDisabled = (value: number): boolean =>
  screen.getByTestId(`math-chip-${value}`).props.accessibilityState
    ?.disabled === true

function revealedWords(): string[] {
  return screen
    .queryAllByTestId('caption-word-revealed')
    .map((w) => String(w.props.children))
}

async function setup(overrides: Partial<MathProps> = {}, viewport = PORTRAIT) {
  const voice = fakeVoice()
  const sfx = fakeSfx()
  const visibility = fakeVisibility()
  const poses: EmmaPose[] = []
  const onPoseChange = jest.fn((p: EmmaPose) => {
    poses.push(p)
  })
  const onSessionComplete = jest.fn()
  const onRequestExit = jest.fn()
  const cancelLine = jest.fn()
  const props = (v: Viewport): MathProps => ({
    layout: mathLayout(v),
    plan: PLAN,
    playUtterance: voice.play,
    audioReady: true,
    sfx,
    storage: memoryStorage(),
    visibility: visibility.store,
    onPoseChange,
    onSessionComplete,
    onRequestExit,
    cancelLine,
    ...overrides,
  })
  const utils = await render(<MathScreen {...props(viewport)} />)
  await flush()
  return {
    voice,
    sfx,
    visibility,
    poses,
    pose: () => poses.at(-1),
    onSessionComplete,
    onRequestExit,
    cancelLine,
    rerender: (v: Viewport, extra: Partial<MathProps> = {}) =>
      utils.rerender(<MathScreen {...props(v)} {...extra} />),
    unmount: utils.unmount,
  }
}

type Harness = Awaited<ReturnType<typeof setup>>

/** The dot card's three phases (each timer is armed when its phase starts). */
async function dotCardRunsOut() {
  await advance(DOT_CARD_FADE_IN_MS)
  await advance(DOT_CARD_HOLD_MS)
  await advance(DOT_CARD_FADE_OUT_MS)
}

/** Read-aloud starts, she thinks `thinkMs`, taps right, "Yes!" ends, advance. */
async function answerRight(h: Harness, index: number, thinkMs = 1000) {
  const problem = PLAN.problems[index]
  const read = h.voice.last()
  expect(read.text).toBe(problem.utterances.read)
  await say(read, { end: false })
  await advance(thinkMs)
  await tap(problem.correct)
  read.reject(new Error('cancelled')) // the engine replaces the line
  await flush()
  const yes = h.voice.last()
  expect(yes.text).toBe(problem.utterances.correct)
  await say(yes)
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('the problem loop', () => {
  it('reads each problem, takes the right answer, advances, and hands the result over after 8', async () => {
    const h = await setup()
    for (let i = 0; i < 8; i++) {
      expect(screen.getByTestId('math-symbolic').props.accessibilityLabel).toBe(
        PLAN.problems[i].utterances.read,
      )
      await answerRight(h, i)
    }
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    expect(h.onSessionComplete).toHaveBeenCalledWith({
      totalCorrect: 8,
      // +1 per right answer, +1 at a streak of 3, 5 and 8.
      totalStardust: 11,
      finalStreak: 8,
      earnedThisSession: 11,
      perProblemCorrect: Array(8).fill(true),
      latencyMs: Array(8).fill(1000),
      perProblemAnswerValue: PLAN.problems.map((p) => p.correct),
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
    })
    // Sparkle + plink on every right answer; the chime only at 3, 5, 8.
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(8)
    expect(h.sfx.plink.play).toHaveBeenCalledTimes(8)
    expect(h.sfx.chime.play).toHaveBeenCalledTimes(3)
    expect(h.sfx.poof.play).not.toHaveBeenCalled()
  })

  it('chips stay closed until the read-aloud STARTS, then open (latency counts from there)', async () => {
    const h = await setup()
    const read = h.voice.last()
    expect(h.pose()).toBe('listening')
    expect(chipDisabled(PLAN.problems[0].correct)).toBe(true)
    await say(read, { end: false })
    expect(chipDisabled(PLAN.problems[0].correct)).toBe(false)
    expect(revealedWords()).toEqual(read.text.split(' '))
    // The read-aloud's end puts Emma back to idle.
    await act(async () => read.resolve())
    await flush()
    expect(h.pose()).toBe('idle')
  })

  it('the gate fails open after 2 s when the read-aloud never starts', async () => {
    const h = await setup()
    expect(h.voice.lines).toHaveLength(1)
    await advance(CHIP_GATE_FALLBACK_MS - 1)
    expect(chipDisabled(PLAN.problems[0].correct)).toBe(true)
    await advance(1)
    expect(chipDisabled(PLAN.problems[0].correct)).toBe(false)
  })

  it('right answer: celebration, beads move on, the streak shows from 2', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    await tap(PLAN.problems[0].correct)
    expect(h.pose()).toBe('celebration')
    expect(screen.getByTestId('math-sparkle-burst')).toBeOnTheScreen()
    expect(screen.getByTestId('math-stardust')).toHaveProp(
      'accessibilityLabel',
      'Stardust: 1',
    )
    await say(h.voice.last())
    await advance(0)
    expect(h.pose()).toBe('idle')
    await advance(ADVANCE_AFTER_CORRECT_MS)
    expect(
      screen.getAllByTestId('math-problem-dot-completed', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1)
    expect(
      screen.getAllByTestId('math-problem-dot-current', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1)
    expect(screen.queryByTestId('math-streak')).toBeNull()
    await answerRight(h, 1)
    expect(screen.getByTestId('math-streak')).toHaveProp(
      'accessibilityLabel',
      'Streak: 2',
    )
  })

  it('"Yes!" ending after the 1.2 s dwell: the next read-aloud still has Emma listening', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    await tap(PLAN.problems[0].correct)
    await advance(ADVANCE_AFTER_CORRECT_MS) // dwell over, "Yes!" still playing
    await say(h.voice.last()) // "Yes!" ends → advance → next read
    await advance(0)
    expect(h.voice.last().text).toBe(PLAN.problems[1].utterances.read)
    expect(h.pose()).toBe('listening')
  })

  it('advances at the 4 s ceiling when "Yes!" never ends', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    await tap(PLAN.problems[0].correct)
    await advance(ADVANCE_HARD_CEILING_MS - 1)
    expect(h.voice.last().text).toBe(PLAN.problems[0].utterances.correct)
    await advance(1)
    expect(h.voice.last().text).toBe(PLAN.problems[1].utterances.read)
  })

  it('more taps on the right chip pay nothing more', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    const chip = screen.getByTestId(`math-chip-${PLAN.problems[0].correct}`)
    await fireEvent.press(chip)
    await fireEvent.press(chip)
    await fireEvent.press(chip)
    await flush()
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('math-stardust')).toHaveProp(
      'accessibilityLabel',
      'Stardust: 1',
    )
  })
})

describe('wrong answers', () => {
  const wrongValue = (index: number): number => {
    const correct = PLAN.problems[index].correct
    const chips = screen
      .getAllByTestId(/^math-chip-/)
      .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    const wrong = chips.find((v) => v !== correct)
    if (wrong === undefined) throw new Error('no wrong chip')
    return wrong
  }

  it('poof, a shake, Emma puzzled (never a red X), "try again?", then idle; the chip stays tappable', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    const wrong = wrongValue(0)
    await tap(wrong)
    expect(h.sfx.poof.play).toHaveBeenCalledTimes(1)
    expect(h.pose()).toBe('puzzled-tilt')
    const reprompt = h.voice.last()
    expect(reprompt.text).toBe('Hmm... try again?')
    expect(screen.queryByText(/✗|❌|wrong/i)).toBeNull()
    await say(reprompt)
    await advance(0)
    expect(h.pose()).toBe('idle')
    expect(chipDisabled(wrong)).toBe(false)
    expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
  })

  it('a wrong answer breaks the streak: the indicator fades out over 400 ms', async () => {
    const h = await setup()
    await answerRight(h, 0)
    await answerRight(h, 1)
    expect(screen.getByTestId('math-streak')).toBeOnTheScreen()
    await say(h.voice.last(), { end: false })
    await tap(wrongValue(2))
    expect(screen.getByTestId('math-streak')).toBeOnTheScreen()
    await advance(STREAK_FADE_OUT_MS)
    expect(screen.queryByTestId('math-streak')).toBeNull()
  })

  it('the hint ladder: 2 wrongs → the hint (Emma points), 3 → she gives the answer; no stardust for it', async () => {
    const h = await setup()
    const problem = PLAN.problems[0]
    await say(h.voice.last(), { end: false })
    const wrong = wrongValue(0)

    await tap(wrong)
    await say(h.voice.last())
    await tap(wrong)
    await say(h.voice.last())
    // The hint waits 600 ms after the re-prompt.
    await advance(HINT_DELAY_AFTER_WRONG_MS - 1)
    expect(h.voice.last().text).toBe('Hmm... try again?')
    await advance(1)
    expect(h.voice.last().text).toBe(problem.utterances.hint)
    expect(h.pose()).toBe('attentive-pointing')
    await say(h.voice.last())
    await advance(0)
    expect(h.pose()).toBe('idle')

    await tap(wrong)
    await say(h.voice.last()) // "try again?"
    expect(h.voice.last().text).toBe(problem.utterances.giveAnswer)
    await say(h.voice.last())
    // Only the right chip still answers; it glows, the others dim.
    for (const c of screen.getAllByTestId(/^math-chip-/)) {
      const v = Number(String(c.props.testID).replace('math-chip-', ''))
      expect(chipDisabled(v)).toBe(v !== problem.correct)
    }
    await tap(problem.correct)
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('math-stardust')).toHaveProp(
      'accessibilityLabel',
      'Stardust: 0',
    )
    await say(h.voice.last())
    await advance(ADVANCE_AFTER_CORRECT_MS)
    expect(h.voice.last().text).toBe(PLAN.problems[1].utterances.read)
    // Every hint line is said once, in order.
    expect(
      h.voice.texts().filter((t) => t === problem.utterances.hint),
    ).toHaveLength(1)
  })

  it('three-beat hint: hint1 + hint2 pulse group A, hint3 pulses group B, strictly in order', async () => {
    const triple: MathSessionPlan = {
      ...PLAN,
      problems: PLAN.problems.map((p, i) =>
        i === 0
          ? {
              ...p,
              utterances: {
                ...p.utterances,
                hint: undefined,
                hint1: 'Look at the flowers.',
                hint2: 'Three flowers.',
                hint3: 'And two more. How many?',
              },
            }
          : p,
      ),
    }
    const h = await setup({ plan: triple })
    await dotCardRunsOut() // the dot card (3 + 2) has gone
    await say(h.voice.last(), { end: false })
    const wrong = wrongValue(0)
    await tap(wrong)
    await say(h.voice.last())
    await tap(wrong)
    await say(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)

    expect(h.voice.last().text).toBe('Look at the flowers.')
    expect(
      screen.getByTestId('math-flower-group-a-pulsing', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    await say(h.voice.last())
    expect(h.voice.last().text).toBe('Three flowers.')
    expect(
      screen.getByTestId('math-flower-group-a-pulsing', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    await say(h.voice.last())
    expect(h.voice.last().text).toBe('And two more. How many?')
    expect(
      screen.getByTestId('math-flower-group-b-pulsing', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    expect(
      screen.getByTestId('math-flower-group-a', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    await say(h.voice.last())
    await advance(0)
    expect(
      screen.getByTestId('math-flower-group-b', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    expect(h.pose()).toBe('idle')
  })

  it('a third wrong answer during the hint: the hint stops, "This one is …" is said in full', async () => {
    const triple: MathSessionPlan = {
      ...PLAN,
      problems: PLAN.problems.map((p, i) =>
        i === 0
          ? {
              ...p,
              utterances: {
                ...p.utterances,
                hint: undefined,
                hint1: 'Look at the flowers.',
                hint2: 'Three flowers.',
                hint3: 'And two more. How many?',
              },
            }
          : p,
      ),
    }
    const h = await setup({ plan: triple })
    await say(h.voice.last(), { end: false })
    const wrong = wrongValue(0)
    await tap(wrong)
    await say(h.voice.last())
    await tap(wrong)
    await say(h.voice.last())
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    const hint1 = h.voice.last()
    expect(hint1.text).toBe('Look at the flowers.')
    await say(hint1, { end: false })
    await tap(wrong) // the third: re-prompt replaces hint1
    await act(async () => hint1.reject(new Error('cancelled')))
    await say(h.voice.last()) // "Hmm... try again?"
    const give = h.voice.last()
    expect(give.text).toBe(PLAN.problems[0].utterances.giveAnswer)
    await say(give)
    await advance(1000)
    expect(h.voice.texts()).not.toContain('Three flowers.')
    expect(h.voice.texts()).not.toContain('And two more. How many?')
    expect(
      screen.queryByTestId('math-flower-group-a-pulsing', {
        includeHiddenElements: true,
      }),
    ).toBeNull()
  })

  it('a wrong-then-right problem: first-tap false, the first value kept, no streak', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    const wrong = wrongValue(0)
    await tap(wrong)
    await say(h.voice.last())
    await tap(PLAN.problems[0].correct)
    await say(h.voice.last())
    await advance(ADVANCE_AFTER_CORRECT_MS)
    for (let i = 1; i < 8; i++) await answerRight(h, i)
    const result = h.onSessionComplete.mock.calls[0][0]
    expect(result.perProblemCorrect[0]).toBe(false)
    expect(result.perProblemAnswerValue[0]).toBe(wrong)
    expect(result.totalCorrect).toBe(8)
    expect(result.finalStreak).toBe(7)
  })
})

describe('session start (App passes audioReady / the player)', () => {
  it('while the start is in flight: "getting ready", Emma listens, nothing is read', async () => {
    const h = await setup({ audioReady: false })
    expect(screen.getByTestId('math-getting-ready')).toBeOnTheScreen()
    expect(screen.queryByTestId('math-chips')).toBeNull()
    expect(h.voice.lines).toHaveLength(0)
    expect(h.pose()).toBe('listening')
    await h.rerender(PORTRAIT, { audioReady: true })
    await flush()
    expect(h.voice.texts()).toEqual([PLAN.problems[0].utterances.read])
  })

  it('fetch failed (no player): the captions walk silently at 165 wpm and the chips open at once', async () => {
    await setup({ playUtterance: undefined })
    const words = PLAN.problems[0].utterances.read.split(' ')
    expect(revealedWords()).toEqual([words[0]])
    expect(chipDisabled(PLAN.problems[0].correct)).toBe(false)
    await advance(CAPTION_WALK_MS_PER_WORD)
    expect(revealedWords()).toEqual(words.slice(0, 2))
    await advance(CAPTION_WALK_MS_PER_WORD * words.length)
    expect(revealedWords()).toEqual(words)
  })
})

describe('lifecycle', () => {
  it('unmount stops Emma’s line, the pending chime and the effects: no audio leak', async () => {
    const h = await setup()
    await answerRight(h, 0)
    await answerRight(h, 1)
    await say(h.voice.last(), { end: false })
    await tap(PLAN.problems[2].correct) // streak 3: chime due in 320 ms
    await advance(STREAK_CHIME_STAGGER_MS - 1)
    await h.unmount()
    await advance(STREAK_CHIME_STAGGER_MS)
    expect(h.sfx.chime.play).not.toHaveBeenCalled()
    expect(h.cancelLine).toHaveBeenCalledTimes(1)
    for (const s of Object.values(h.sfx))
      expect(s.unload).toHaveBeenCalledTimes(1)
    // Nothing else is said or played afterwards.
    const lines = h.voice.lines.length
    await advance(10_000)
    expect(h.voice.lines).toHaveLength(lines)
    for (const s of Object.values(h.sfx)) {
      expect(s.play.mock.calls.length).toBeLessThanOrEqual(3)
    }
    expect(h.pose()).toBe('idle')
  })

  it('unmount stops a silent caption walk too', async () => {
    const silentPlayer = createSilentMathPlayer()
    const cancel = jest.spyOn(silentPlayer, 'cancel')
    const h = await setup({ playUtterance: undefined, silentPlayer })
    const before = revealedWords().length
    await h.unmount()
    await advance(CAPTION_WALK_MS_PER_WORD * 10)
    expect(before).toBe(1)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('rotating mid-problem keeps the problem, the caption and the line (no re-read)', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    const wrong = screen
      .getAllByTestId(/^math-chip-/)
      .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
      .find((v) => v !== PLAN.problems[0].correct)!
    await tap(wrong)
    await h.rerender(LANDSCAPE)
    await flush()
    expect(h.voice.texts()).toEqual([
      PLAN.problems[0].utterances.read,
      'Hmm... try again?',
    ])
    expect(h.pose()).toBe('puzzled-tilt')
    await h.rerender(PORTRAIT)
    await flush()
    expect(h.voice.lines).toHaveLength(2)
  })

  it('an advance due while the app is in the background waits for its return', async () => {
    const h = await setup()
    await say(h.voice.last(), { end: false })
    await tap(PLAN.problems[0].correct)
    await act(async () => h.visibility.set(true))
    await say(h.voice.last())
    await advance(ADVANCE_HARD_CEILING_MS)
    expect(h.voice.last().text).toBe(PLAN.problems[0].utterances.correct)
    await act(async () => h.visibility.set(false))
    await flush()
    expect(h.voice.last().text).toBe(PLAN.problems[1].utterances.read)
  })

  it('back: the arrow asks App to go to the Hub', async () => {
    const h = await setup()
    await fireEvent.press(screen.getByTestId('math-back-to-hub'))
    expect(h.onRequestExit).toHaveBeenCalledTimes(1)
  })
})

describe('scaffolds (core gates)', () => {
  it('add-to-10 + scaffold day: the dot card flashes on 3 + 2, then the flowers; the result says so', async () => {
    const h = await setup({
      focusNode: 'add-to-10',
      subitisingScaffoldActive: true,
      subitisingSubScaffoldActive: false,
    })
    expect(
      screen.getByTestId('math-dot-card', { includeHiddenElements: true }),
    ).toBeOnTheScreen()
    expect(
      screen.getAllByTestId('math-dot-card-cell', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2)
    await dotCardRunsOut()
    expect(
      screen.queryByTestId('math-dot-card', { includeHiddenElements: true }),
    ).toBeNull()
    for (let i = 0; i < 8; i++) await answerRight(h, i)
    expect(
      h.onSessionComplete.mock.calls[0][0].subitisingScaffoldRendered,
    ).toBe(true)
  })

  it('not a scaffold day: no dot card', async () => {
    await setup({
      focusNode: 'add-to-10',
      subitisingScaffoldActive: false,
      subitisingSubScaffoldActive: false,
    })
    expect(
      screen.queryByTestId('math-dot-card', { includeHiddenElements: true }),
    ).toBeNull()
  })

  it('sub-to-10: no flowers; the minuend cell (ten-frame for 7) flashes', async () => {
    const sub: MathSessionPlan = {
      id: 'sub',
      label: 'sub',
      problems: PLAN.problems.map((p) => ({
        ...p,
        addendA: 7,
        addendB: 3,
        correct: 4,
        op: '-' as const,
        utterances: {
          ...p.utterances,
          read: 'Seven minus three. How many are left?',
          correct: 'Yes! Four!',
          giveAnswer: 'This one is four.',
        },
      })),
    }
    await setup({
      plan: sub,
      focusNode: 'sub-to-10',
      subitisingScaffoldActive: false,
      subitisingSubScaffoldActive: true,
    })
    expect(
      screen.queryByTestId('math-visual-groups', {
        includeHiddenElements: true,
      }),
    ).toBeNull()
    expect(
      screen.getByTestId('math-sub-minuend-card', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('−')).toBeOnTheScreen()
  })
})
