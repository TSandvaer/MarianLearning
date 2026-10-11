/**
 * The app end to end on an in-memory store: Splash branches on the
 * persisted sessionCount exactly like the web, Greet runs on the real
 * audio engine (over the fake expo-audio, so silent) and hands over to
 * Math, Math hands its result to Session End, and the placeholders walk
 * the rest of core's route state machine.
 */
import { LINE_GAP_MS } from '@marian/core/greet/greetSequence'
import { defaultProgress, saveProgress } from '@marian/core/progress'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import {
  fakePlayers,
  flush,
  resetFakePlayers,
  type FakePlayer,
} from '../test/fakeAudio'
import App from './App'
import { mathLayout } from './layout/mathLayout'
import { NO_LAUNCH_FLAGS, type LaunchFlags } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import {
  HEART_TAP_TRANSITION_MS,
  WAKE_REPROMPT_AFTER_MS,
} from './screens/greet/Greet'
import { CHIME_TAIL_MS, LEAVE_DELAY_MS } from './screens/sessionEnd/SessionEnd'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

function boot(flags: LaunchFlags = NO_LAUNCH_FLAGS): void {
  const map = new Map<string, string>()
  const backend: SyncKeyValueBackend = {
    getItemSync: (key) => map.get(key) ?? null,
    setItemSync: (key, value) => {
      map.set(key, value)
    },
    removeItemSync: (key) => map.delete(key),
  }
  bootNative({
    backend,
    env: {
      apiBase: undefined,
      progressApiSecret: undefined,
      debug: undefined,
      seed: undefined,
      dayOffset: undefined,
      mute: undefined,
      audioCheck: undefined,
      qaAutoTapMs: undefined,
      qaRoute: undefined,
    },
    flags,
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function renderPastSplash(): Promise<void> {
  await render(<App />)
  expect(await screen.findByTestId('route-splash')).toBeOnTheScreen()
  await advance(WARM_CAP_MS)
  // Splash fades out before the route changes (web: AnimatePresence "wait").
  expect(screen.getByTestId('route-splash')).toBeOnTheScreen()
  await advance(SPLASH_FADE_OUT_MS)
}

/** The fake player Greet's engine is playing now. */
function playing(): FakePlayer {
  const p = fakePlayers.find(
    (f) => f.calls.at(-1) === 'play' && !f.released && f.listenerCount > 0,
  )
  if (!p) throw new Error('no Greet line is playing')
  return p
}

async function finishLine(): Promise<void> {
  const p = playing()
  await act(async () => {
    p.start(0.8)
    p.finish()
    await flush()
  })
}

beforeEach(() => {
  resetFakePlayers()
  jest.useFakeTimers()
  ;(globalThis.fetch as jest.Mock).mockClear()
})

/** The session-start POSTs App made (jest is offline: each one fails). */
function sessionStarts(): unknown[] {
  return (globalThis.fetch as jest.Mock).mock.calls
    .filter(([url]) => String(url).endsWith('/api/claude'))
    .map(([, init]) => JSON.parse(String((init as { body: string }).body)))
}

/** The problem on screen, from the equation's numerals. */
function problemOnScreen(): { a: number; b: number } {
  const [a, b] = within(screen.getByTestId('math-symbolic'))
    .getAllByText(/^\d+$/)
    .map((t) => Number(t.props.children))
  return { a, b }
}

/** Silent fallback: the chips open at once; tap after 1 s, wait out "Yes!". */
async function answerRight(): Promise<void> {
  await advance(1000)
  const { a, b } = problemOnScreen()
  await fireEvent.press(screen.getByTestId(`math-chip-${a + b}`))
  await advance(ADVANCE_AFTER_CORRECT_MS)
  await flushAll()
}

async function flushAll(): Promise<void> {
  await act(async () => {
    await flush()
  })
}

/** Timers and the promises they settle, in 100 ms steps. */
async function settle(total: number): Promise<void> {
  for (let t = 0; t < total; t += 100) {
    await advance(Math.min(100, total - t))
    await flushAll()
  }
}

/**
 * Silent fallback: three wrong taps (re-prompt, hint, Emma gives the
 * answer), then the right one. Guided: no stardust, not counted correct.
 */
async function answerGuided(): Promise<void> {
  await advance(1000)
  const { a, b } = problemOnScreen()
  const wrong = screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    .find((v) => v !== a + b)!
  for (let i = 0; i < 3; i++) {
    await fireEvent.press(screen.getByTestId(`math-chip-${wrong}`))
    await settle(6000)
  }
  await fireEvent.press(screen.getByTestId(`math-chip-${a + b}`))
  await advance(ADVANCE_AFTER_CORRECT_MS)
  await flushAll()
}

/** Session End: Emma's clips never end on the fake players; buttons up. */
async function sessionEndSettles(): Promise<void> {
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  await settle(16_000)
}

async function greetToMath(): Promise<void> {
  await renderPastSplash()
  await fireEvent(screen.getByTestId('greet-wake-tap-target'), 'pressIn')
  for (let line = 0; line < 3; line++) {
    await finishLine()
    await advance(LINE_GAP_MS)
  }
  await fireEvent.press(screen.getByTestId('greet-heart'))
  await advance(HEART_TAP_TRANSITION_MS)
  await flushAll()
}

afterEach(() => {
  jest.useRealTimers()
})

it('first launch (sessionCount 0): Splash → Greet, and Splash is silent', async () => {
  boot()
  await render(<App />)
  await advance(WARM_CAP_MS + SPLASH_FADE_OUT_MS - 1)
  expect(screen.getByTestId('route-splash')).toBeOnTheScreen()
  expect(fakePlayers).toEqual([])
  await advance(1)
  expect(screen.getByTestId('greet')).toBeOnTheScreen()
  expect(screen.getByTestId('greet-wake-tap-target')).toBeOnTheScreen()
  expect(readSessionHistory().sessionCount).toBe(0)
})

it('returning (sessionCount ≥ 1, via a debug seed): Splash → Hub', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  await renderPastSplash()
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.queryByTestId('greet')).toBeNull()
  expect(screen.getByTestId('status')).toHaveTextContent(
    'route hub · sessionCount 1 · debug seed add-to-20',
  )
})

it('Greet → heart → Math (offline: the static plan, silent captions) → 8 problems → Session End (a good day) → All done → Hub', async () => {
  boot()
  await greetToMath()

  // The session start was kicked on Greet (one request, the web's payload);
  // offline, Math runs the fallback plan with silent captions.
  expect(sessionStarts()).toEqual([
    {
      kind: 'session-start',
      payload: { track: 'math', level: 1, childName: 'Marian' },
    },
  ])
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(screen.queryByTestId('math-getting-ready')).toBeNull()
  // Greet freed its 4 players; the 4 live ones are Math's effects.
  expect(fakePlayers.filter((p) => !p.released)).toHaveLength(4)

  for (let i = 0; i < 8; i++) await answerRight()

  // Session End got Math's result and made the one write.
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  expect(readSessionHistory().sessionCount).toBe(1)
  expect(
    screen.getAllByTestId('session-end-star', { includeHiddenElements: true }),
  ).toHaveLength(8)
  // 8 of 8 on day one: a flower, Emma cheers.
  expect(screen.getByTestId('emma-cheering')).toBeOnTheScreen()
  expect(screen.queryByTestId('session-end-cta')).toBeNull()

  await sessionEndSettles()
  expect(screen.getByTestId('session-end-cta').props.accessibilityLabel).toBe(
    'All done!',
  )
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.queryByTestId('exit-greet')).toBeNull()
  // Every player is released once the chime has rung out.
  await advance(CHIME_TAIL_MS)
  expect(fakePlayers.filter((p) => !p.released)).toEqual([])
})

it('3rd good day: All done opens the map (an unlock waits there)', async () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
  boot()
  saveProgress({
    ...defaultProgress(),
    history: [
      { dateISO: day(2), skillFocus: ['add-to-10'], successRate: 1 },
      { dateISO: day(1), skillFocus: ['add-to-10'], successRate: 1 },
    ],
  })
  await greetToMath()
  for (let i = 0; i < 8; i++) await answerRight()
  await sessionEndSettles()
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  expect(screen.getByTestId('route-map')).toBeOnTheScreen()
})

it('not-yet day → Again → Math: nothing is read before the new session settles, then problem 1 is', async () => {
  boot()
  await greetToMath()
  // Two guided problems: 6 of 8, not yet today's flower.
  await answerGuided()
  await answerGuided()
  for (let i = 2; i < 8; i++) await answerRight()
  await sessionEndSettles()
  expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
  expect(screen.getByTestId('session-end-cta').props.accessibilityLabel).toBe(
    'Home',
  )

  // The next session start hangs until the test lets it fail (offline).
  let failStart: (err: Error) => void = () => {}
  ;(globalThis.fetch as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failStart = reject
      }),
  )
  await fireEvent.press(screen.getByTestId('session-end-again'))
  await advance(LEAVE_DELAY_MS)
  await flushAll()
  await advance(3000)
  expect(sessionStarts()).toHaveLength(2)
  expect(screen.getByTestId('math-getting-ready')).toBeOnTheScreen()
  // The old session must not read problem 1 behind "getting ready".
  expect(screen.queryByTestId('math-ribbon')).toBeNull()

  await act(async () => failStart(new TypeError('offline')))
  await flushAll()
  expect(screen.queryByTestId('math-getting-ready')).toBeNull()
  expect(screen.getByTestId('math-ribbon')).toBeOnTheScreen()
  expect(screen.getAllByTestId('caption-word-revealed').length).toBeGreaterThan(
    0,
  )
})

it('Math drives Emma: listening while reading, puzzled-tilt on a wrong answer, celebration on a right one', async () => {
  boot()
  await greetToMath()
  expect(screen.getByTestId('emma-listening')).toBeOnTheScreen()
  // Layouts use the safe-area provider's measured frame (the jest mock:
  // 320×640), not the window (on Android the window omits the nav bar).
  const frame = mathLayout({
    width: 320,
    height: 640,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  }).emma
  expect(screen.getByTestId('emma-listening')).toHaveStyle({
    left: frame.x,
    top: frame.y,
    width: frame.width,
  })
  await advance(1000)
  const { a, b } = problemOnScreen()
  const wrong = screen
    .getAllByTestId(/^math-chip-/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
    .find((v) => v !== a + b)!
  await fireEvent.press(screen.getByTestId(`math-chip-${wrong}`))
  expect(screen.getByTestId('emma-puzzled-tilt')).toBeOnTheScreen()
  await advance(5000)
  await fireEvent.press(screen.getByTestId(`math-chip-${a + b}`))
  expect(screen.getByTestId('emma-celebration')).toBeOnTheScreen()
})

it('back to the Hub tears the session down; Math again starts a fresh one', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  await renderPastSplash()
  expect(sessionStarts()).toHaveLength(0)
  await fireEvent.press(screen.getByTestId('exit-math'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(sessionStarts()).toHaveLength(1)
  // The seeded progress rides along (focus node, first encounters).
  expect(sessionStarts()[0]).toMatchObject({
    payload: { track: 'math', progress: { focusNode: 'add-to-20' } },
  })

  await fireEvent.press(screen.getByTestId('math-back-to-hub'))
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('exit-math'))
  await flushAll()
  expect(sessionStarts()).toHaveLength(2)
})

it('Emma stays calm (idle) through the whole Greet: the nudge, "Hi!" and the heart tap', async () => {
  // Native-only (Thomas, device check of #531): no celebration pose on
  // Greet. The web swaps idle → celebration on all three moments.
  boot()
  await renderPastSplash()
  const calm = () => {
    expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
    expect(screen.queryByTestId('emma-celebration')).toBeNull()
  }
  calm()

  await advance(WAKE_REPROMPT_AFTER_MS) // the one 8 s nudge
  expect(screen.getByTestId('greet-wake-icon')).toBeOnTheScreen()
  calm()

  await fireEvent(screen.getByTestId('greet-wake-tap-target'), 'pressIn')
  const hi = playing()
  await act(async () => {
    hi.start(0.8) // "Hi!" starts: its first (only) word ticks
    await flush()
  })
  calm()
  await act(async () => {
    hi.finish()
    await flush()
  })
  await advance(LINE_GAP_MS)
  for (let line = 1; line < 3; line++) {
    await finishLine()
    await advance(LINE_GAP_MS)
  }
  calm()

  await fireEvent.press(screen.getByTestId('greet-heart'))
  calm()
  await advance(HEART_TAP_TRANSITION_MS - 1)
  calm()
})
