/**
 * The first mini-game end to end on an in-memory store (native spec
 * `design/native/mini-game-flower-bed.md`; N2, N4, N5, N6): Hub → the
 * Number Garden Map → the play door → six beds → the same Map, quiet. The
 * round makes zero key-value writes: the progress JSON and the session
 * history are byte-identical, stardust is unchanged, nothing reaches the
 * network and no Session End mounts. Back mid-line, Back mid-hop and a trip
 * to the background keep all of that. The game's lines await their render,
 * so they walk their captions silently (no clip plays).
 */
import { STORAGE_KEY } from '@marian/core/progress'
import { SESSION_HISTORY_KEY } from '@marian/core/sessionEnd/sessionHistory'
import { loadStardust } from '@marian/core/shared/stardust'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { flush, resetFakePlayers } from '../test/fakeAudio'
import App from './App'
import { sessionPrefetcher } from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { LAUNCH_DELAY_MS, MAP_TAP_ARM_MS } from './screens/map/useMapVisit'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

const HIDDEN = { includeHiddenElements: true }

// A hand-driven AppState, in place before the app's visibility store
// attaches (on its first subscriber, in the first render below).
let appState = 'active'
const appStateListeners: ((state: string) => void)[] = []
beforeAll(() => {
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: string) => void)
      return { remove: () => {} } as ReturnType<
        typeof AppState.addEventListener
      >
    })
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => appState,
  })
})

async function setAppState(state: string) {
  await act(async () => {
    appState = state
    for (const l of [...appStateListeners]) l(state)
    await flush()
  })
}

let store = new Map<string, string>()
const writes: string[] = []

function boot(): void {
  store = new Map<string, string>()
  writes.length = 0
  const backend: SyncKeyValueBackend = {
    getItemSync: (key) => store.get(key) ?? null,
    setItemSync: (key, value) => {
      writes.push(key)
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
    // Adding to ten mastered, adding to twenty current: the door is open.
    flags: { debug: true, seed: 'add-to-20', qaStep: null, dayOffset: null },
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** Timers and the promises they settle, in 100 ms steps. */
async function settle(total: number) {
  for (let t = 0; t < total; t += 100) {
    await advance(Math.min(100, total - t))
    await act(async () => {
      await flush()
    })
  }
}

/** Settle until `cond` holds (at most `maxMs`). */
async function until(cond: () => boolean, maxMs = 20_000) {
  for (let t = 0; t < maxMs && !cond(); t += 100) await settle(100)
  expect(cond()).toBe(true)
}

const chipsOpen = () =>
  screen
    .queryAllByTestId(/^math-chip-\d+$/)
    .some((c) => c.props.accessibilityState?.disabled === false)
const given = () => screen.getAllByTestId('game-bed-flower', HIDDEN).length
const onQuietMap = () =>
  screen.queryByTestId('map-math-beat-none') !== null &&
  screen.queryByTestId('map-ribbon') === null

/** Hub → the Number Garden Map, armed and quiet. */
async function toMap() {
  await render(<App />)
  await advance(WARM_CAP_MS)
  await advance(SPLASH_FADE_OUT_MS)
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  // N2: the Hub never shows a door.
  expect(screen.queryByTestId('map-game-door')).not.toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('hub-map-math'))
  expect(screen.getByTestId('map-math-beat-none')).toBeOnTheScreen()
  await advance(MAP_TAP_ARM_MS)
}

/** Everything a game could touch, as it stands now. */
function snapshot() {
  return {
    progress: store.get(STORAGE_KEY),
    history: store.get(SESSION_HISTORY_KEY),
    stardust: loadStardust().total,
    writes: writes.length,
    fetches: (globalThis.fetch as jest.Mock).mock.calls.length,
  }
}

/** The door → the game screen, its first ask playing. */
async function openGame() {
  await fireEvent.press(screen.getByTestId('map-game-door'))
  await advance(LAUNCH_DELAY_MS)
  await settle(300)
  expect(screen.getByTestId('game')).toBeOnTheScreen()
  expect(screen.queryByTestId('map')).not.toBeOnTheScreen()
}

/** Bed by bed: the right chip once the ask opens the chips. */
async function playBeds(count: number) {
  for (let k = 0; k < count; k++) {
    await until(chipsOpen)
    await fireEvent.press(screen.getByTestId(`math-chip-${10 - given()}`))
    await settle(100)
  }
}

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
})

it('N5: a full round writes nothing, calls nothing, and ends on the quiet Map; no Session End', async () => {
  boot()
  await toMap()
  const before = snapshot()
  expect(before.progress).toBeDefined()

  await openGame()
  // N16 at the App: 6 beads, no stardust pill; Emma is on the stage.
  expect(screen.getAllByTestId(/^game-problem-dot-/, HIDDEN)).toHaveLength(6)
  expect(screen.queryByTestId('game-stardust')).not.toBeOnTheScreen()
  await playBeds(6)
  await until(onQuietMap)

  expect(screen.queryByTestId('session-end')).not.toBeOnTheScreen()
  expect(screen.queryByTestId('game')).not.toBeOnTheScreen()
  expect(snapshot()).toEqual(before)
  // N4: the Map's Home still goes where it went before the game.
  await fireEvent.press(screen.getByTestId('map-home'))
  await settle(300)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
})

it('N6: Back at bed 3 during a line returns to the quiet Map at once, writing nothing', async () => {
  boot()
  await toMap()
  const before = snapshot()
  await openGame()
  await playBeds(2)
  // Bed 3's ask is walking its caption: Back mid-line.
  await until(chipsOpen)
  await fireEvent.press(screen.getByTestId('game-back-to-hub'))
  await settle(300)
  expect(onQuietMap()).toBe(true)
  await settle(5000)
  expect(onQuietMap()).toBe(true)
  expect(snapshot()).toEqual(before)
})

it('N6: Back during a hop returns to the quiet Map, writing nothing', async () => {
  boot()
  await toMap()
  const before = snapshot()
  await openGame()
  await until(chipsOpen)
  await fireEvent.press(screen.getByTestId(`math-chip-${10 - given()}`))
  expect(
    screen.queryAllByTestId(/^game-hop-\d$/, HIDDEN).length,
  ).toBeGreaterThan(0)
  await fireEvent.press(screen.getByTestId('game-back-to-hub'))
  await settle(300)
  expect(onQuietMap()).toBe(true)
  expect(snapshot()).toEqual(before)
})

it('N6: a trip to the background mid-round: the round waits, then finishes, writing nothing', async () => {
  boot()
  await toMap()
  const before = snapshot()
  await openGame()
  await until(chipsOpen)
  const first = given()
  await fireEvent.press(screen.getByTestId(`math-chip-${10 - first}`))
  await setAppState('background')
  await settle(10_000)
  // Still on bed 1 (a round's givens are distinct): the advance waited.
  expect(screen.getByTestId('game')).toBeOnTheScreen()
  expect(given()).toBe(first)
  await setAppState('active')
  await until(() => given() !== first)
  await playBeds(5)
  await until(onQuietMap)
  expect(snapshot()).toEqual(before)
})
