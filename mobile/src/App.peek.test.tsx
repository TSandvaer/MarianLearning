/**
 * The Map peek end to end on an in-memory store (native spec
 * `design/native/fast-track-native.md` §§ 6.3–6.5, AC 18): Hub → map → a
 * locked stop → its name and "This one is locked. Want to try it?" → the
 * prompt's button (`locked-stop-peek-prompt.md` AC 13) → Emma's opener → the step's 3 problems → the closer → the
 * same map, quiet. The persisted progress JSON and the session-history
 * store are byte-identical before and after, and nothing reaches the
 * network but the (stubbed) peek request.
 *
 * The peek's session start is stubbed (`requestPeek`): its plan is the
 * committed canon's sub-to-10 problems 1–3, its audio a fake that starts
 * and ends each line at once. Emma's opener and closer name the step
 * (fast-track spec § 8). With a bundled clip they play on the fake
 * expo-audio players, and the test starts and ends each one
 * (`finishGuideLine`, as App.test.tsx's `finishLine()` does for Greet);
 * while a clip awaits its render, the line walks its caption instead.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { STORAGE_KEY } from '@marian/core/progress'
import { SESSION_HISTORY_KEY } from '@marian/core/sessionEnd/sessionHistory'
import { loadStardust } from '@marian/core/shared/stardust'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { fakePlayers, flush, resetFakePlayers } from '../test/fakeAudio'
import { REPO_ROOT } from '../test/webSource'
import App from './App'
import { sessionPrefetcher, type LoadedSessionAudio } from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { MAP_TAP_ARM_MS, PEEK_ASK_GAP_MS } from './screens/map/useMapVisit'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'
import * as peekSession from './session/peekSession'

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

/**
 * The guide line in flight plays its bundled clip: start it and end it.
 * The newest playing player: an earlier one also sits in `play` here.
 */
async function finishGuideLine(): Promise<void> {
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

/** Emma's line on Math's ribbon. */
const ribbon = () =>
  screen.getByTestId('math-ribbon').props.accessibilityLabel as string

/** sub-to-10's problems 1–3, as the server's peek answer carries them. */
function peekPlan(): ExtendedMathSessionPlan {
  const canon = JSON.parse(
    readFileSync(
      join(REPO_ROOT, 'public/canon/math/level-1/sub-to-10.json'),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  return mathSessionPlanFromServer(
    {
      id: 'peek-math',
      label: 'Peek',
      utterances: canon.plan.utterances.filter((u) =>
        /^math\.p[1-3]\./.test(u.id),
      ),
    },
    { extendedKinds: true, problemCount: 3 },
  )
}

function fakePeekAudio(): LoadedSessionAudio & { unload: jest.Mock } {
  return {
    sessionId: 'peek-sub-to-10-test',
    playUtterance: jest.fn((_text: string, opts = {}) => {
      opts.onPlay?.()
      opts.onWordTick?.(0)
      return Promise.resolve()
    }),
    playUtteranceById: jest.fn(() => Promise.resolve()),
    prewarm: jest.fn(),
    fileFor: () => undefined,
    textToId: new Map(),
    utteranceCount: 0,
    fileCount: 0,
    bundledCount: 0,
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
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
  jest.restoreAllMocks()
})

it('AC 18: a full peek writes nothing — progress JSON and session history byte-identical, no push — and returns to a quiet map', async () => {
  boot()
  const plan = peekPlan()
  const audio = fakePeekAudio()
  const request = jest
    .spyOn(peekSession, 'requestPeek')
    .mockImplementation(async ({ node }) => ({
      mode: 'peek',
      world: 'math',
      node,
      plan,
      audio,
    }))

  await render(<App />)
  await advance(WARM_CAP_MS)
  await advance(SPLASH_FADE_OUT_MS)
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()

  await fireEvent.press(screen.getByTestId('hub-map-math'))
  expect(screen.getByTestId('map-math-beat-none')).toBeOnTheScreen()
  // Stop taps count once the map has been up 400 ms (map-tap-to-play § 5).
  await advance(MAP_TAP_ARM_MS)
  // The map is open and quiet: everything a peek could touch is on disk.
  const progressBefore = store.get(STORAGE_KEY)
  const historyBefore = store.get(SESSION_HISTORY_KEY)
  const stardustBefore = loadStardust().total
  expect(progressBefore).toBeDefined()
  const writesBefore = writes.length
  const fetchesBefore = (globalThis.fetch as jest.Mock).mock.calls.length

  await fireEvent.press(screen.getByTestId('map-stop-sub-to-10'))
  await act(async () => {
    await flush()
  })
  // The prompt asks first (locked-stop-peek-prompt § 2): the name, 250 ms,
  // the question and the button.
  expect(request).not.toHaveBeenCalled()
  expect(screen.getByTestId('map-caption').props.children).toBe(
    'Taking away to ten. This one is locked. Want to try it?',
  )
  await finishGuideLine()
  await advance(PEEK_ASK_GAP_MS)
  await fireEvent.press(screen.getByTestId('map-peek-button'))
  await act(async () => {
    await flush()
  })
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]![0]).toMatchObject({
    world: 'math',
    node: 'sub-to-10',
  })
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(
    screen.getAllByTestId(/^math-problem-dot-/, {
      includeHiddenElements: true,
    }),
  ).toHaveLength(3)
  expect(screen.queryByTestId('math-stardust')).toBeNull()
  // The opener names the step (§ 8); the stage waits for it.
  expect(screen.queryByTestId('math-chips')).toBeNull()
  await finishGuideLine()
  expect(ribbon()).toBe("Let's look at taking away to ten!")
  await settle(3000)

  for (const problem of plan.problems) {
    await fireEvent.press(screen.getByTestId(`math-chip-${problem.correct}`))
    await settle(2000)
  }
  // The closer names the step too, then the map comes back.
  await settle(1000)
  await finishGuideLine()
  expect(ribbon()).toBe('Taking away to ten is for later. You will learn it!')
  await settle(5000)
  expect(screen.getByTestId('map-math-beat-none')).toBeOnTheScreen()
  expect(screen.queryByTestId('map-ribbon')).toBeNull()
  expect(audio.unload).toHaveBeenCalledTimes(1)

  expect(store.get(STORAGE_KEY)).toBe(progressBefore)
  expect(store.get(SESSION_HISTORY_KEY)).toBe(historyBefore)
  expect(loadStardust().total).toBe(stardustBefore)
  expect(
    writes
      .slice(writesBefore)
      .filter((k) => k === STORAGE_KEY || k === SESSION_HISTORY_KEY),
  ).toEqual([])
  expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(fetchesBefore)
})
