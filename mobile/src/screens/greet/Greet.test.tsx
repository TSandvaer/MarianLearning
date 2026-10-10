/**
 * Greet's contract (web `src/screens/Greet.tsx` + the native spec
 * `design/native/greet-math-native.md`), driven through a fake of the
 * 4-clip audio port: the test decides when a line starts, ticks its words,
 * ends or fails. Silent: no player exists in this file.
 */
import {
  GREET_LINES,
  LINE_GAP_MS,
  REPROMPT_AFTER_MS,
} from '@marian/core/greet/greetSequence'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { GreetLineKey, LineCallbacks } from '../../audio'
import { CAPTION_WALK_MS_PER_WORD } from '../../audio'
import { greetLayout } from '../../layout/greetLayout'
import type { Viewport } from '../../layout/layout'
import {
  Greet,
  HEART_TAP_TRANSITION_MS,
  WAKE_REPROMPT_AFTER_MS,
  type GreetAudioPort,
} from './Greet'
import { ICON_TOTAL_MS } from './WakeNudgeIcon'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
const PHONE_PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }
const PHONE_LANDSCAPE: Viewport = {
  width: 667,
  height: 375,
  insets: NO_INSETS,
}

const KEYS: GreetLineKey[] = ['hi', 'imEmma', 'niceToMeet', 'tapHeart']
const words = (i: number) => GREET_LINES[i].split(/\s+/).filter(Boolean)

interface Call {
  key: GreetLineKey
  opts: LineCallbacks
  resolve: () => void
  reject: (err: Error) => void
}

function fakeAudio() {
  const calls: Call[] = []
  const port: GreetAudioPort & {
    load: jest.Mock
    cancel: jest.Mock
    unload: jest.Mock
  } = {
    load: jest.fn(),
    unload: jest.fn(),
    cancel: jest.fn(() => {
      for (const c of calls) c.reject(new Error('cancelled'))
    }),
    play: jest.fn(
      (key: GreetLineKey, opts: LineCallbacks = {}) =>
        new Promise<void>((resolve, reject) => {
          calls.push({ key, opts, resolve, reject })
        }),
    ),
  }
  return { port, calls, keys: () => calls.map((c) => c.key) }
}

type Audio = ReturnType<typeof fakeAudio>

async function setup(viewport: Viewport = PHONE_PORTRAIT) {
  const audio = fakeAudio()
  const onAdvance = jest.fn()
  const element = (v: Viewport) => (
    <Greet layout={greetLayout(v)} onAdvance={onAdvance} audio={audio.port} />
  )
  const utils = await render(element(viewport))
  return {
    audio,
    onAdvance,
    rotate: (v: Viewport) => utils.rerender(element(v)),
    unmount: utils.unmount,
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function wakeTap() {
  await fireEvent(screen.getByTestId('greet-wake-tap-target'), 'pressIn')
}

/** Line `n` (0-based call) starts and ticks its words; optionally ends. */
async function speak(audio: Audio, n: number, { end = true } = {}) {
  const call = audio.calls[n]
  const count = words(KEYS.indexOf(call.key)).length
  await act(async () => {
    call.opts.onPlay?.()
    for (let i = 0; i < count; i++) call.opts.onWordTick?.(i)
    if (end) call.resolve()
  })
}

/** Play the 4 lines through, with the 400 ms gaps. */
async function speakAll(audio: Audio) {
  for (let n = 0; n < 4; n++) {
    await speak(audio, n)
    if (n < 3) await advance(LINE_GAP_MS)
  }
}

function revealedWords(): string[] {
  return screen
    .queryAllByTestId('caption-word-revealed')
    .map((w) => String(w.props.children))
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('Wake', () => {
  it('plays nothing before the tap; the players are created on mount', async () => {
    const { audio } = await setup()
    expect(audio.port.load).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('greet-ready-ring')).toBeOnTheScreen()
    await advance(WAKE_REPROMPT_AFTER_MS - 1)
    expect(audio.port.play).not.toHaveBeenCalled()
    expect(screen.queryByTestId('greet-ribbon')).toBeNull()
    expect(screen.queryByTestId('greet-heart')).toBeNull()
  })

  it('nudges once at 8 s (finger icon only), silently, never again', async () => {
    const { audio } = await setup()
    await advance(WAKE_REPROMPT_AFTER_MS - 1)
    expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    await advance(1)
    expect(screen.getByTestId('greet-wake-icon')).toBeOnTheScreen()
    await advance(ICON_TOTAL_MS)
    expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    await advance(60_000)
    expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    expect(audio.port.play).not.toHaveBeenCalled()
  })

  it('the tap starts "Hi!" in the same tick, with no delay', async () => {
    const { audio } = await setup()
    await wakeTap()
    expect(audio.keys()).toEqual(['hi'])
    expect(screen.queryByTestId('greet-wake-tap-target')).toBeNull()
    expect(screen.getByTestId('greet-ready-ring-leaving')).toBeOnTheScreen()
  })

  it('a second touch event of the same tap does not start a second line', async () => {
    const { audio } = await setup()
    const target = screen.getByTestId('greet-wake-tap-target')
    await fireEvent(target, 'pressIn')
    await fireEvent(target, 'press')
    expect(audio.keys()).toEqual(['hi'])
  })

  it('a tap cancels the pending nudge', async () => {
    await setup()
    await advance(WAKE_REPROMPT_AFTER_MS / 2)
    await wakeTap()
    await advance(WAKE_REPROMPT_AFTER_MS)
    expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
  })
})

describe('Intro', () => {
  it('plays the 4 lines in order, 400 ms apart', async () => {
    const { audio } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS - 1)
    expect(audio.keys()).toEqual(['hi'])
    await advance(1)
    expect(audio.keys()).toEqual(['hi', 'imEmma'])
    await speak(audio, 1)
    await advance(LINE_GAP_MS)
    await speak(audio, 2)
    await advance(LINE_GAP_MS)
    expect(audio.keys()).toEqual(['hi', 'imEmma', 'niceToMeet', 'tapHeart'])
  })

  it('reveals the caption word by word, and only once Emma starts', async () => {
    const { audio } = await setup()
    await wakeTap()
    expect(screen.queryByTestId('greet-ribbon')).toBeNull()
    await speak(audio, 0, { end: false })
    expect(screen.getByTestId('greet-ribbon')).toBeOnTheScreen()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    const call = audio.calls[1]
    await act(async () => {
      call.opts.onPlay?.()
      call.opts.onWordTick?.(0)
    })
    expect(revealedWords()).toEqual(["I'm"])
    expect(screen.getAllByTestId('caption-word-hidden')).toHaveLength(1)
  })

  it('shows the heart after line 3 ends, not before', async () => {
    const { audio } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    await speak(audio, 1)
    await advance(LINE_GAP_MS)
    await speak(audio, 2, { end: false })
    expect(screen.queryByTestId('greet-heart')).toBeNull()
    await act(async () => audio.calls[2].resolve())
    expect(screen.getByTestId('greet-heart')).toBeOnTheScreen()
  })

  it('keeps line 4 on the ribbon after it ends, while the heart waits', async () => {
    const { audio } = await setup()
    await wakeTap()
    await speakAll(audio)
    await advance(REPROMPT_AFTER_MS - LINE_GAP_MS - 1)
    expect(screen.getByTestId('greet-ribbon')).toHaveAccessibleName(
      GREET_LINES[3],
    )
    expect(revealedWords()).toEqual(words(3))
    expect(screen.queryAllByTestId('caption-word-hidden')).toEqual([])
  })

  it('replays line 4 once, 20 s after the heart appears', async () => {
    const { audio } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    await speak(audio, 1)
    await advance(LINE_GAP_MS)
    await speak(audio, 2) // the heart appears; the 20 s start
    await advance(LINE_GAP_MS)
    await speak(audio, 3)
    await advance(REPROMPT_AFTER_MS - LINE_GAP_MS - 1)
    expect(audio.keys()).toHaveLength(4)
    await advance(1)
    expect(audio.keys()).toEqual([
      'hi',
      'imEmma',
      'niceToMeet',
      'tapHeart',
      'tapHeart',
    ])
    // The replay reveals afresh.
    expect(revealedWords()).toEqual([])
    await speak(audio, 4)
    expect(revealedWords()).toEqual(words(3))
    await advance(REPROMPT_AFTER_MS * 3)
    expect(audio.keys()).toHaveLength(5)
  })

  it('a line that fails to start walks its caption, and the sequence goes on', async () => {
    const { audio } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    await act(async () => audio.calls[1].reject(new Error('start-timeout')))
    expect(revealedWords()).toEqual(["I'm"])
    await advance(CAPTION_WALK_MS_PER_WORD)
    expect(revealedWords()).toEqual(words(1))
    await advance(LINE_GAP_MS)
    expect(audio.keys()).toEqual(['hi', 'imEmma', 'niceToMeet'])
  })
})

describe('heart tap', () => {
  it('stops Emma and hands over to Math 400 ms later', async () => {
    const { audio, onAdvance } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    await speak(audio, 1)
    await advance(LINE_GAP_MS)
    await speak(audio, 2)
    await advance(LINE_GAP_MS)
    await speak(audio, 3, { end: false }) // tapped mid line 4

    await fireEvent.press(screen.getByTestId('greet-heart'))
    expect(audio.port.cancel).toHaveBeenCalledTimes(1)
    await advance(HEART_TAP_TRANSITION_MS - 1)
    expect(onAdvance).not.toHaveBeenCalled()
    await advance(1)
    expect(onAdvance).toHaveBeenCalledTimes(1)

    // Nothing else plays: no next line, no re-prompt, no second advance.
    await fireEvent.press(screen.getByTestId('greet-heart'))
    await advance(REPROMPT_AFTER_MS * 2)
    expect(audio.keys()).toHaveLength(4)
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})

describe('QA auto-tap (debug only, for simulators nothing can tap)', () => {
  it('fires the wake tap once, at the given time', async () => {
    const audio = fakeAudio()
    await render(
      <Greet
        layout={greetLayout(PHONE_PORTRAIT)}
        onAdvance={() => {}}
        audio={audio.port}
        qaAutoTapAfterMs={3_000}
      />,
    )
    await advance(2_999)
    expect(audio.keys()).toEqual([])
    await advance(1)
    expect(audio.keys()).toEqual(['hi'])
  })
})

describe('lifecycle', () => {
  it('unmounting mid-line stops Emma, frees the players, and queues nothing', async () => {
    const { audio, unmount } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    await speak(audio, 1, { end: false })
    await unmount()
    expect(audio.port.cancel).toHaveBeenCalledTimes(1)
    expect(audio.port.unload).toHaveBeenCalledTimes(1)
    await advance(REPROMPT_AFTER_MS * 2)
    expect(audio.keys()).toEqual(['hi', 'imEmma'])
  })

  it('rotating mid-line restarts nothing: the line, caption, state and timers carry on', async () => {
    const { audio, rotate } = await setup()
    await wakeTap()
    await speak(audio, 0)
    await advance(LINE_GAP_MS)
    const call = audio.calls[1]
    await act(async () => {
      call.opts.onPlay?.()
      call.opts.onWordTick?.(0)
    })
    await rotate(PHONE_LANDSCAPE)
    expect(audio.port.load).toHaveBeenCalledTimes(1)
    expect(audio.port.cancel).not.toHaveBeenCalled()
    expect(audio.keys()).toEqual(['hi', 'imEmma'])
    expect(revealedWords()).toEqual(["I'm"])
    expect(screen.queryByTestId('greet-wake-tap-target')).toBeNull()

    await act(async () => {
      call.opts.onWordTick?.(1)
      call.resolve()
    })
    await advance(LINE_GAP_MS)
    expect(audio.keys()).toEqual(['hi', 'imEmma', 'niceToMeet'])
  })
})
