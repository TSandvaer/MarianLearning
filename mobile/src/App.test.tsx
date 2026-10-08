/**
 * The shell end to end on an in-memory store: Splash branches on the
 * persisted sessionCount exactly like the web, then the placeholders walk
 * core's route state machine.
 */
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import App from './App'
import { NO_LAUNCH_FLAGS, type LaunchFlags } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'

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
    },
    flags,
  })
}

async function renderPastSplash(): Promise<void> {
  await render(<App />)
  expect(await screen.findByTestId('route-splash')).toBeOnTheScreen()
  await act(async () => {
    jest.advanceTimersByTime(WARM_CAP_MS)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('first launch: Splash → Greet', async () => {
  boot()
  await renderPastSplash()
  expect(screen.getByTestId('route-greet')).toBeOnTheScreen()
  expect(screen.getByTestId('status')).toHaveTextContent(
    'route greet · sessionCount 0',
  )
})

it('returning (sessionCount ≥ 1, via a debug seed): Splash → Hub', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  await renderPastSplash()
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.getByTestId('status')).toHaveTextContent(
    'route hub · sessionCount 1 · debug seed add-to-20',
  )
})

it('the placeholders walk the first-launch sequence to the Hub', async () => {
  boot()
  await renderPastSplash()
  await fireEvent.press(screen.getByTestId('exit-math'))
  expect(screen.getByTestId('route-math')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('exit-session-end'))
  expect(screen.getByTestId('route-session-end')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('exit-hub'))
  expect(screen.getByTestId('route-hub')).toBeOnTheScreen()
  expect(screen.queryByTestId('exit-greet')).toBeNull()
})
