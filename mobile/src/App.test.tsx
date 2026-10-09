/**
 * The app end to end on an in-memory store: Splash branches on the
 * persisted sessionCount exactly like the web, Greet runs on the real
 * audio engine (over the fake expo-audio, so silent) and hands over to
 * Math, and the placeholders walk the rest of core's route state machine.
 */
import { LINE_GAP_MS } from '@marian/core/greet/greetSequence'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  fakePlayers,
  flush,
  resetFakePlayers,
  type FakePlayer,
} from '../test/fakeAudio'
import App from './App'
import { NO_LAUNCH_FLAGS, type LaunchFlags } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { HEART_TAP_TRANSITION_MS } from './screens/greet/Greet'
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
})

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

it('Greet → heart → Math, leaving sessionCount at 0; then the placeholders walk to the Hub', async () => {
  boot()
  await renderPastSplash()
  await fireEvent(screen.getByTestId('greet-wake-tap-target'), 'pressIn')
  for (let line = 0; line < 3; line++) {
    await finishLine()
    await advance(LINE_GAP_MS)
  }
  await fireEvent.press(screen.getByTestId('greet-heart'))
  await advance(HEART_TAP_TRANSITION_MS)

  expect(screen.getByTestId('route-math')).toBeOnTheScreen()
  expect(screen.getByTestId('status')).toHaveTextContent(
    'route math · sessionCount 0',
  )
  // Greet freed its 4 players on the way out.
  expect(fakePlayers.filter((p) => !p.released)).toEqual([])

  await fireEvent.press(screen.getByTestId('exit-session-end'))
  expect(screen.getByTestId('route-session-end')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('exit-hub'))
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.queryByTestId('exit-greet')).toBeNull()
})
