/**
 * Sessions built on the device, end to end (no-Claude plan phase 2,
 * `./session/localSession.ts`): on an offline device (jest's `fetch`
 * rejects), the Hub's Number Garden and Word Song cards start the step's
 * canon session from the bundled canon text and audio. No request goes
 * out, and the session is ready at once: the same plan the server's canon
 * gives (`tests/noClaude/localSessionParity.test.ts` proves that half).
 */
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import type { CanonText } from '@marian/core/session/composeSession'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import canonText from '../assets/canon/canon-text.json'
import { flush, resetFakePlayers } from '../test/fakeAudio'
import App from './App'
import { readAudioLog, sessionPrefetcher } from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

const CANON = canonText as unknown as Readonly<Record<string, CanonText>>

function boot(): void {
  const store = new Map<string, string>()
  const backend: SyncKeyValueBackend = {
    getItemSync: (key) => store.get(key) ?? null,
    setItemSync: (key, value) => {
      store.set(key, value)
    },
    removeItemSync: (key) => store.delete(key),
  }
  bootNative({
    backend,
    env: {
      apiBase: undefined,
      progressApiSecret: undefined,
      debug: undefined,
      seed: undefined,
      qaStep: undefined,
      dayOffset: undefined,
      mute: undefined,
      audioCheck: undefined,
      qaAutoTapMs: undefined,
      qaRoute: undefined,
    },
    flags: { debug: true, seed: 'add-to-20', qaStep: null, dayOffset: null },
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function settle(total: number) {
  for (let t = 0; t < total; t += 100) {
    await advance(Math.min(100, total - t))
    await act(async () => {
      await flush()
    })
  }
}

const apiCalls = () =>
  (globalThis.fetch as jest.Mock).mock.calls.filter(([url]) =>
    String(url).endsWith('/api/claude'),
  )

/** The `[audio]` rows this test's sessions logged. */
function sessionRows(label: string) {
  return readAudioLog().filter(
    (r) => r.kind !== 'onplay' && r.label === label,
  ) as { label: string; detail: string }[]
}

/** `ready (<plan id>...)` from a session controller's note. */
const readyPlanId = (label: string) =>
  sessionRows(label)
    .map((r) => /^ready \(([^,)]+)/.exec(r.detail)?.[1])
    .find((id) => id !== undefined)

beforeEach(() => {
  resetHubAudioForTests()
  sessionPrefetcher.discard()
  resetLaunchReconcileForTests()
  resetFakePlayers()
  jest.useFakeTimers()
  ;(globalThis.fetch as jest.Mock).mockClear()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

async function toHub() {
  boot()
  await render(<App />)
  await advance(WARM_CAP_MS)
  await advance(SPLASH_FADE_OUT_MS)
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
}

it('offline, Number Garden plays the step’s canon session, built on the device: no request', async () => {
  await toHub()
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await settle(300)
  expect(screen.getByTestId('math')).toBeOnTheScreen()

  const local = sessionRows('session-local math')
  expect(local.length).toBeGreaterThan(0)
  expect(local.at(-1)!.detail).toBe('canon add-to-20, 76 utterances')
  const canon = CANON['math/level-1/add-to-20']!
  expect(readyPlanId('math-session')).toBe((canon.plan as { id: string }).id)

  // The step's canon problem 1 is on screen, not the static plan's.
  await settle(15_000)
  const p1 = mathSessionPlanFromServer(canon.plan, { extendedKinds: true })
    .problems[0]! as { addendA: number; addendB: number }
  const numerals = within(screen.getByTestId('math-symbolic'))
    .getAllByText(/^\d+$/)
    .map((t) => Number(t.props.children))
  expect(numerals.slice(0, 2)).toEqual([p1.addendA, p1.addendB])
  expect(apiCalls()).toEqual([])
})

it('offline, Word Song plays its step’s canon session, built on the device: no request', async () => {
  await toHub()
  await fireEvent.press(screen.getByTestId('hub-card-word-song'))
  await settle(300)
  expect(screen.getByTestId('word-song')).toBeOnTheScreen()

  const row = sessionRows('session-local word-song').at(-1)
  expect(row).toBeDefined()
  const focus = /^canon (\S+),/.exec(row!.detail)?.[1]
  expect(focus).toBeDefined()
  const canon = CANON[`word-song/level-1/${focus}`]!
  expect(readyPlanId('word-song-session')).toBe(
    (canon.plan as { id: string }).id,
  )
  expect(apiCalls()).toEqual([])
})
