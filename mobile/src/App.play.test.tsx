/**
 * The Play place end to end on an in-memory store (play-place spec § 1.4,
 * § 1.6; ACs N4, N5, N6, N16): Hub → Play → a full Raft crossing trip →
 * the Play place, quiet → Letter critters with a word, a non-word and a
 * pair → Back → Home → the Hub. Zero key-value writes: progress, the
 * session history and stardust are byte-identical, nothing reaches the
 * network and no Session End mounts. Back mid-drag, mid-crossing, while a
 * word's picture shows, and a trip to the background keep that.
 *
 * Lines play their bundled clips on the fake expo-audio players; the test
 * starts and ends each (`finishPlayLine`, as App.game's `finishGameLine`).
 */
import { CRITTER_PICTURE_WORDS } from '@marian/core/games/playPlace'
import { loadProgress, saveProgress, STORAGE_KEY } from '@marian/core/progress'
import { SESSION_HISTORY_KEY } from '@marian/core/sessionEnd/sessionHistory'
import { loadStardust } from '@marian/core/shared/stardust'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

type ReactTestInstance = ReturnType<typeof screen.getByTestId>
import { AppState } from 'react-native'
import { fakePlayers, flush, resetFakePlayers } from '../test/fakeAudio'
import App from './App'
import { audioEngine, sessionPrefetcher } from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { resetDragForTests } from './screens/play/dragLock'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

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

function boot(seed: string): void {
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
    flags: { debug: true, seed, qaStep: null, dayOffset: null },
  })
}

/** On top of the seed: adding to ten current, so the raft is open too. */
function withRaft(): void {
  const p = loadProgress()!
  saveProgress({
    ...p,
    skillLevels: {
      ...p.skillLevels,
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
    },
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function settle(total: number) {
  for (let t = 0; t < total; t += 50) {
    await advance(Math.min(50, total - t))
    await act(async () => {
      await flush()
    })
  }
}

const playLine = () => {
  const label = audioEngine.voice.activeLabel
  return label?.startsWith('play:') ? label : null
}

/** The Play line in flight plays its bundled clip: start it and end it. */
async function finishPlayLine(): Promise<void> {
  if (playLine() === null) return
  const p = [...fakePlayers]
    .reverse()
    .find(
      (f) => f.calls.at(-1) === 'play' && !f.released && f.listenerCount > 0,
    )
  if (!p) return
  await act(async () => {
    p.start(1.5)
    p.finish()
    await flush()
  })
}

async function until(cond: () => boolean, maxMs = 30_000) {
  for (let t = 0; t < maxMs && !cond(); t += 50) {
    await finishPlayLine()
    await settle(50)
  }
  expect(cond()).toBe(true)
}

function snapshot() {
  return {
    progress: store.get(STORAGE_KEY),
    history: store.get(SESSION_HISTORY_KEY),
    stardust: loadStardust().total,
    writes: writes.length,
    fetches: (globalThis.fetch as jest.Mock).mock.calls.length,
  }
}

const touch = (x: number, y: number) => {
  const t = { identifier: '1', pageX: x, pageY: y }
  return { nativeEvent: { ...t, changedTouches: [t], touches: [t] } }
}
async function send(el: ReactTestInstance, name: string, x = 0, y = 0) {
  await act(async () => {
    ;(el.props[name] as (e: unknown) => void)(touch(x, y))
  })
}
async function tap(id: string) {
  const el = screen.getByTestId(id)
  await send(el, 'onResponderGrant')
  await send(el, 'onResponderRelease')
}

async function toHub() {
  await render(<App />)
  await advance(WARM_CAP_MS)
  await advance(SPLASH_FADE_OUT_MS)
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
}

async function toPlace() {
  await fireEvent.press(screen.getByTestId('hub-play'))
  await settle(400)
  expect(screen.getByTestId('play-place')).toBeOnTheScreen()
  expect(screen.queryByTestId('map')).not.toBeOnTheScreen()
}

async function open(game: 'raft' | 'critters') {
  await fireEvent.press(screen.getByTestId(`play-tile-${game}`))
  await settle(300)
  expect(screen.getByTestId('play-game')).toBeOnTheScreen()
}

const NUMBER = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
]
function shore(): { id: string; w: number }[] {
  return screen.queryAllByTestId(/^raft-animal-\d+$/).map((el) => ({
    id: String(el.props.testID),
    w: NUMBER.indexOf(String(el.props.accessibilityLabel).split(', ')[1]!),
  }))
}
async function loadTen() {
  const s = shore()
  for (const a of s) {
    for (const b of s) {
      if (a.id !== b.id && a.w + b.w === 10) {
        await tap(a.id)
        await tap(b.id)
        return
      }
    }
  }
  throw new Error('no pair')
}

beforeEach(() => {
  resetHubAudioForTests()
  resetDragForTests()
  sessionPrefetcher.discard()
  resetLaunchReconcileForTests()
  resetFakePlayers()
  jest.useFakeTimers()
  ;(globalThis.fetch as jest.Mock).mockClear()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
})

it('N4, N5: a full raft trip and a critters visit write nothing and call nothing', async () => {
  boot('cvc-words')
  withRaft()
  await toHub()
  const before = snapshot()
  expect(before.progress).toBeDefined()
  await toPlace()
  // From the Hub, Emma says the open line.
  await until(() => playLine() === 'play:guide.play.open')
  await finishPlayLine()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(2)

  await open('raft')
  for (let k = 0; k < 3; k++) {
    await until(() => shore().length === 6)
    await loadTen()
    await until(() =>
      k === 2
        ? screen.queryByTestId('play-place') !== null
        : screen.queryAllByTestId(/^raft-animal-\d+$/).length === 6 &&
          screen.queryByTestId('raft-rowing') === null &&
          screen.queryAllByTestId(/^raft-scene-/).length === 0,
    )
  }
  // The natural stop: the Play place, silent.
  expect(screen.queryByTestId('play-game')).not.toBeOnTheScreen()
  await settle(1500)
  expect(playLine()).toBeNull()
  expect(screen.queryByTestId('play-bubble')).not.toBeOnTheScreen()

  await open('critters')
  // A word, a non-word and a pair, from the letters this visit shows (16 of
  // the 22: every picture word for every learner, Thomas 2026-10-22).
  const here = (l: string) => screen.queryByTestId(`critter-${l}`) !== null
  const picture = CRITTER_PICTURE_WORDS.find((w) => [...w].every(here))!
  const nonWord = [...'bcdfghjklmnprstvwxz'].filter(here).slice(0, 3).join('')
  expect(nonWord).toHaveLength(3)
  for (const word of [picture, nonWord]) {
    for (const letter of word) {
      await fireEvent(
        screen.getByTestId(`critter-${letter}`),
        'accessibilityAction',
        {
          nativeEvent: { actionName: 'activate' },
        },
      )
    }
    await settle(8000)
    await finishPlayLine()
    for (let i = 0; i < 3; i++) {
      const seat = screen.queryByTestId(`critter-seat-${i}`)
      if (seat) {
        await fireEvent(seat, 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        })
      }
    }
  }
  for (const letter of picture.slice(0, 2)) {
    await fireEvent(
      screen.getByTestId(`critter-${letter}`),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    )
  }
  await settle(3000)
  await fireEvent.press(screen.getByTestId('play-game-back'))
  await settle(300)
  expect(screen.getByTestId('play-place')).toBeOnTheScreen()
  expect(screen.queryByTestId('session-end')).not.toBeOnTheScreen()
  // Everything from the Hub's Play tap to here wrote and fetched nothing.
  expect(snapshot()).toEqual(before)
  // Home: the Hub (which decides its own visit on mount, as on any return).
  await fireEvent.press(screen.getByTestId('play-home'))
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
})

it('N6: Back mid-drag, mid-crossing and while a picture shows, and a background mid-crossing, write nothing', async () => {
  boot('cvc-words')
  withRaft()
  await toHub()
  const before = snapshot()
  await toPlace()
  await open('raft')
  // Mid-drag.
  const first = shore()[0]!.id
  await send(screen.getByTestId(first), 'onResponderGrant')
  await send(screen.getByTestId(first), 'onResponderMove', 40, 40)
  await fireEvent.press(screen.getByTestId('play-game-back'))
  await settle(300)
  expect(screen.getByTestId('play-place')).toBeOnTheScreen()
  resetDragForTests()
  // Mid-crossing, with a trip to the background first.
  await open('raft')
  await loadTen()
  await settle(1000)
  await setAppState('background')
  await settle(10_000)
  expect(screen.getByTestId('play-game')).toBeOnTheScreen()
  await setAppState('active')
  await settle(500)
  await fireEvent.press(screen.getByTestId('play-game-back'))
  await settle(300)
  expect(screen.getByTestId('play-place')).toBeOnTheScreen()
  // While a picture shows: a picture word from the letters this visit
  // shows. A phone's meadow holds 16 letters drawn with Math.random
  // (`critterSet`), so a fixed word ('cat') missed 1 visit in 4.
  await open('critters')
  const here = (l: string) => screen.queryByTestId(`critter-${l}`) !== null
  const picture = CRITTER_PICTURE_WORDS.find((w) => [...w].every(here))!
  for (const letter of picture) {
    await fireEvent(
      screen.getByTestId(`critter-${letter}`),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    )
  }
  await until(() => screen.queryByTestId('critter-picture') !== null, 5000)
  await fireEvent.press(screen.getByTestId('play-game-back'))
  await settle(3000)
  expect(screen.getByTestId('play-place')).toBeOnTheScreen()
  expect(snapshot()).toEqual(before)
})

it('N16: a learner on numbers and letter names has the Play disc and the critters (Thomas 2026-10-22)', async () => {
  boot('letter-names')
  await toHub()
  expect(screen.getByTestId('hub-play')).toBeOnTheScreen()
  await toPlace()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(1)
  expect(screen.getByTestId('play-tile-critters')).toBeOnTheScreen()
})
