/**
 * The Play place end to end on an in-memory store (play-place spec § 1.4,
 * § 1.6; ACs N4, N5, N6, N16): Hub → Play → a full Raft crossing trip →
 * the Play place, quiet → Letter critters with a word, a non-word and a
 * pair → Back → Home → the Hub. The Raft writes only its island, once per
 * new kind (raft-island-goal I7). Letter critters
 * writes each word Emma says into the progress doc's seen-record (Dave
 * 2026-10-24: the cvc-words probe reserve skips a word she met there) and,
 * past blending sounds, its word hunt round (critters-word-hunt.md § 1,
 * AC H21: at the deal and at each new find); everything else in the doc,
 * the session history and stardust are byte-identical, nothing reaches the
 * network and no Session End mounts.
 * Back mid-drag, mid-crossing, while a word's picture shows, and a trip to
 * the background keep that.
 *
 * Lines play their bundled clips on the fake expo-audio players; the test
 * starts and ends each (`finishPlayLine`, as App.game's `finishGameLine`).
 */
import { HUNT_STORAGE_KEY } from '@marian/core/games/critterHunt'
import { RAFT_ISLAND_STORAGE_KEY } from '@marian/core/games/raftIsland'
import { CRITTER_PICTURE_WORDS } from '@marian/core/games/playPlace'
import {
  loadProgress,
  saveProgress,
  seenItemsOf,
  STORAGE_KEY,
  type Progress,
} from '@marian/core/progress'
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

/**
 * Since `before`, the only changes are Letter critters' seen-record write:
 * `words` (the words Emma said) under `word:` keys, the math records as they
 * were (seeded when the doc had none); and `huntWrites` writes of the word
 * hunt's round. No other key, no fetch, no history or stardust change.
 */
function expectOnlyWordsMet(
  before: ReturnType<typeof snapshot>,
  words: readonly string[],
  huntWrites = 0,
) {
  const now = snapshot()
  expect({ ...now, progress: null, writes: null }).toEqual({
    ...before,
    progress: null,
    writes: null,
  })
  const was = JSON.parse(before.progress!) as Progress
  const is = JSON.parse(now.progress!) as Progress
  const { seenItems: seenNow, ...restNow } = is
  expect({ ...restNow, seenItems: undefined }).toEqual({
    ...was,
    seenItems: undefined,
  })
  const wordKeys = Object.keys(seenNow ?? {}).filter((k) =>
    k.startsWith('word:'),
  )
  expect(wordKeys.sort()).toEqual(words.map((w) => `word:${w}`).sort())
  const math = Object.fromEntries(
    Object.entries(seenNow ?? {}).filter(([k]) => !k.startsWith('word:')),
  )
  expect(math).toEqual(seenItemsOf(was))
  const since = writes.slice(before.writes)
  expect(since.filter((k) => k === HUNT_STORAGE_KEY)).toHaveLength(huntWrites)
  expect(since.filter((k) => k !== HUNT_STORAGE_KEY)).toHaveLength(words.length)
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

it('N4, N5, I7: a raft trip writes only its island; a critters visit writes only the words Emma says; neither calls anything', async () => {
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
  // No crossing cap (raft-island-goal § 6): every crossing comes back.
  for (let k = 0; k < 3; k++) {
    await until(() => shore().length === 6)
    await loadTen()
    await until(
      () =>
        screen.queryAllByTestId(/^raft-animal-\d+$/).length === 6 &&
        screen.queryAllByTestId(/^raft-aboard-\d+$/).length === 0 &&
        screen.queryByTestId('raft-rowing') === null &&
        screen.queryAllByTestId(/^raft-scene-/).length === 0,
    )
  }
  expect(screen.queryByTestId('play-game')).toBeOnTheScreen()
  // Back: the Play place, silent.
  await fireEvent.press(screen.getByTestId('play-game-back'))
  await until(() => screen.queryByTestId('play-place') !== null)
  expect(screen.queryByTestId('play-game')).not.toBeOnTheScreen()
  await settle(1500)
  expect(playLine()).toBeNull()
  expect(screen.queryByTestId('play-bubble')).not.toBeOnTheScreen()
  // The trip wrote its island only, at least its first two kinds, and
  // fetched nothing (I7).
  const afterRaft = snapshot()
  expect({ ...afterRaft, writes: null }).toEqual({ ...before, writes: null })
  const raftWrites = writes.slice(before.writes)
  expect(raftWrites.length).toBeGreaterThanOrEqual(2)
  expect(raftWrites.every((k) => k === RAFT_ISLAND_STORAGE_KEY)).toBe(true)

  await open('critters')
  // A word, a non-word and a pair, from the letters this visit shows: a
  // cvc-words learner is past blending sounds, so a word hunt round (her
  // vowel and five consonants, critters-word-hunt.md § 1).
  const here = (l: string) => screen.queryByTestId(`critter-${l}`) !== null
  expect(screen.queryAllByTestId(/^critter-[a-z]$/)).toHaveLength(6)
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
  // A pair of consonants (the hunt's vowel has no twin; it may still sit).
  for (const letter of nonWord.slice(0, 2)) {
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
  // From the Hub's Play tap to here: only the picture word Emma said, in
  // the seen-record, and the hunt's round (its deal and the new find); no
  // fetch.
  expectOnlyWordsMet(afterRaft, [picture], 2)
  // Home: the Hub (which decides its own visit on mount, as on any return).
  await fireEvent.press(screen.getByTestId('play-home'))
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  // Three crossings with their walks home, then the critters: past
  // jest's 5 s on CI.
}, 30_000)

it('N6: Back mid-drag, mid-crossing and while a picture shows, and a background mid-crossing, write nothing but the word Emma said', async () => {
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
  // The word Emma said, and the hunt's round: its deal and the find.
  expectOnlyWordsMet(before, [picture], 2)
})

it('N16: a learner on numbers and letter names has the Play disc and the critters (Thomas 2026-10-22)', async () => {
  boot('letter-names')
  await toHub()
  expect(screen.getByTestId('hub-play')).toBeOnTheScreen()
  await toPlace()
  expect(screen.getAllByTestId(/^play-tile-(raft|critters)$/)).toHaveLength(1)
  expect(screen.getByTestId('play-tile-critters')).toBeOnTheScreen()
})
