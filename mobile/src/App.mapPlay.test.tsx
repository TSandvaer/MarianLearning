/**
 * Map tap-to-play end to end on an in-memory store (native spec
 * `design/native/map-tap-to-play.md`, AC 1, 2, 6):
 *
 * - the current stop starts exactly the Hub card's session (the same
 *   session-start request, built by the same controller kick) and records
 *   the world as played today, as the Hub card does;
 * - a mastered stop's replay plays the opener, the step's 8 problems with
 *   no stardust pill, and the closer, then returns to a quiet map: no
 *   Session End, and the progress JSON, the session history and stardust
 *   are byte-identical before and after;
 * - Back from either Map start, and "All done" after a current-stop
 *   session, return to the same world's map with no open line (a pending
 *   unlock still plays its beat); Hub starts still return to the Hub.
 *
 * jest is offline: a session start fails and Math / Word Song play their
 * silent fallback plan. The replay request is stubbed (`requestReplay`):
 * its plan is the committed canon's add-to-10 problems 1–8, its audio a
 * fake that starts and ends each line at once. Emma's opener and closer
 * play their bundled clips; the test starts and ends each one.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { currentStepOf } from '@marian/core/hub/hubCardModel'
import type { ExtendedMathSessionPlan } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
  STORAGE_KEY,
} from '@marian/core/progress'
import { now as progressNow } from '@marian/core/progress/clock'
import {
  isoDate,
  readSessionHistory,
  SESSION_HISTORY_KEY,
  writeSessionHistory,
} from '@marian/core/sessionEnd/sessionHistory'
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { loadStardust } from '@marian/core/shared/stardust'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { fakePlayers, flush, resetFakePlayers } from '../test/fakeAudio'
import { REPO_ROOT } from '../test/webSource'
import App from './App'
import {
  audioEngine,
  sessionPrefetcher,
  type LoadedSessionAudio,
} from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import type { LaunchFlags } from './platform/launchFlags'
import { NO_LAUNCH_FLAGS } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { LAUNCH_DELAY_MS, MAP_TAP_ARM_MS } from './screens/map/useMapVisit'
import { LEAVE_DELAY_MS } from './screens/sessionEnd/SessionEnd'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'
import * as peekSession from './session/peekSession'

let store = new Map<string, string>()
const writes: string[] = []

const SEED: LaunchFlags = {
  debug: true,
  seed: 'add-to-20',
  qaStep: null,
  dayOffset: null,
}

function boot(flags: LaunchFlags = SEED): void {
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
    flags,
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function flushAll(): Promise<void> {
  await act(async () => {
    await flush()
  })
}

/** Timers and the promises they settle, in 100 ms steps. */
async function settle(total: number) {
  for (let t = 0; t < total; t += 100) {
    await advance(Math.min(100, total - t))
    await flushAll()
  }
}

async function renderToHub(): Promise<Awaited<ReturnType<typeof render>>> {
  const utils = await render(<App />)
  await advance(WARM_CAP_MS)
  await advance(SPLASH_FADE_OUT_MS)
  await settle(500)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  return utils
}

/** Hub → the world's map, past the 400 ms tap guard. */
async function openMap(world: 'math' | 'word-song'): Promise<void> {
  await fireEvent.press(screen.getByTestId(`hub-map-${world}`))
  expect(screen.getByTestId('map')).toBeOnTheScreen()
  await advance(MAP_TAP_ARM_MS)
}

/** Tap a stop and let the launch run (~200 ms). */
async function tapStop(node: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(`map-stop-${node}`))
  await advance(LAUNCH_DELAY_MS)
  await flushAll()
}

/** The session-start payloads App sent for `track`. */
function payloadsFor(track: string): Record<string, unknown>[] {
  return (globalThis.fetch as jest.Mock).mock.calls
    .filter(([url]) => String(url).endsWith('/api/claude'))
    .map(
      ([, init]) =>
        JSON.parse(String((init as { body: string }).body)) as {
          payload: Record<string, unknown>
        },
    )
    .map((b) => b.payload)
    .filter((p) => p.track === track)
}

/** The line on Emma's voice channel now (`<player>:<line id>`), or null. */
const voiceLine = () => audioEngine.voice.activeLabel

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

/** Silent fallback: the chips open at once; tap after 1 s, wait out "Yes!". */
async function answerRight(): Promise<void> {
  await advance(1000)
  const [a, b] = within(screen.getByTestId('math-symbolic'))
    .getAllByText(/^\d+$/)
    .map((t) => Number(t.props.children))
  await fireEvent.press(screen.getByTestId(`math-chip-${a! + b!}`))
  await advance(ADVANCE_AFTER_CORRECT_MS)
  await flushAll()
}

/** A quiet map: no open line said, no caption. */
async function expectQuietMap(world: 'math' | 'word-song'): Promise<void> {
  expect(screen.getByTestId(`map-${world}-beat-none`)).toBeOnTheScreen()
  await settle(1000)
  expect(screen.queryByTestId('map-ribbon')).toBeNull()
  expect(voiceLine() ?? '').not.toMatch(/^map:/)
}

/** add-to-10's problems 1–8, as the server's replay answer carries them. */
function replayPlan(): ExtendedMathSessionPlan {
  const canon = JSON.parse(
    readFileSync(
      join(REPO_ROOT, 'public/canon/math/level-1/add-to-10.json'),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  return mathSessionPlanFromServer(
    {
      id: 'replay-math',
      label: 'Replay',
      utterances: canon.plan.utterances.filter((u) =>
        /^math\.p[1-8]\./.test(u.id),
      ),
    },
    { extendedKinds: true, problemCount: 8 },
  )
}

function fakeAudio(): LoadedSessionAudio & { unload: jest.Mock } {
  return {
    sessionId: 'replay-add-to-10-test',
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
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
  }
}

function stubReplay() {
  const plan = replayPlan()
  const audio = fakeAudio()
  const request = jest
    .spyOn(peekSession, 'requestReplay')
    .mockImplementation(async ({ node }) => ({
      mode: 'replay',
      world: 'math',
      node,
      plan,
      audio,
    }))
  return { plan, audio, request }
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

it('AC 1: the current stop starts exactly the Hub card’s session — the same request — and records the world as played today', async () => {
  // The Map: Hub → map → the current stop, no Hub card between.
  boot()
  const first = await renderToHub()
  await openMap('math')
  await tapStop('add-to-20')
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  const fromMap = payloadsFor('math').at(-1)
  expect(fromMap).toMatchObject({ progress: { focusNode: 'add-to-20' } })
  expect(readSessionHistory().todayTreesTouched).toEqual({
    date: isoDate(progressNow()),
    trees: ['number-garden'],
  })
  await first.unmount()

  // The Hub card, from the same stored progress.
  resetHubAudioForTests()
  sessionPrefetcher.discard()
  resetLaunchReconcileForTests()
  ;(globalThis.fetch as jest.Mock).mockClear()
  boot()
  await renderToHub()
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(payloadsFor('math').at(-1)).toEqual(fromMap)
  // A Hub start's Back still goes to the Hub.
  await fireEvent.press(screen.getByTestId('math-back-to-hub'))
  await flushAll()
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
})

it('AC 2: a mastered stop replays — opener, 8 problems with no stardust pill, closer, a quiet map — and writes nothing', async () => {
  boot()
  const { plan, audio, request } = stubReplay()
  await renderToHub()
  await openMap('math')
  const progressBefore = store.get(STORAGE_KEY)
  const historyBefore = store.get(SESSION_HISTORY_KEY)
  const stardustBefore = loadStardust().total
  expect(progressBefore).toBeDefined()
  const writesBefore = writes.length
  const fetchesBefore = (globalThis.fetch as jest.Mock).mock.calls.length

  await tapStop('add-to-10')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]![0]).toMatchObject({
    world: 'math',
    node: 'add-to-10',
  })
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(
    screen.getAllByTestId(/^math-problem-dot-/, {
      includeHiddenElements: true,
    }),
  ).toHaveLength(8)
  expect(screen.queryByTestId('math-stardust')).toBeNull()
  // The opener over the empty stage.
  expect(screen.queryByTestId('math-chips')).toBeNull()
  await settle(300)
  await finishGuideLine()
  expect(ribbon()).toBe("Let's play adding to ten again!")
  await settle(3000)

  for (const problem of plan.problems) {
    await fireEvent.press(screen.getByTestId(`math-chip-${problem.correct}`))
    await settle(2000)
  }
  expect(screen.queryByTestId('math-stardust')).toBeNull()
  await settle(700)
  await finishGuideLine()
  expect(ribbon()).toBe('You know adding to ten!')
  await settle(5000)
  expect(screen.queryByTestId('session-end')).toBeNull()
  await expectQuietMap('math')
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

it('AC 6: Back from a replay returns to the same map at once, silent, and writes nothing', async () => {
  boot()
  const { audio } = stubReplay()
  await renderToHub()
  await openMap('math')
  const progressBefore = store.get(STORAGE_KEY)
  await tapStop('number-recog')
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  await settle(1000)
  await fireEvent.press(screen.getByTestId('math-back-to-hub'))
  await flushAll()
  await expectQuietMap('math')
  expect(audio.unload).toHaveBeenCalledTimes(1)
  expect(store.get(STORAGE_KEY)).toBe(progressBefore)
})

it('AC 6: Back from a current-stop session returns to the same map, silent (Number Garden and Word Song)', async () => {
  boot()
  await renderToHub()
  await openMap('math')
  await tapStop('add-to-20')
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  await settle(1000)
  await fireEvent.press(screen.getByTestId('math-back-to-hub'))
  await flushAll()
  await expectQuietMap('math')
  expect(screen.queryByTestId('session-end')).toBeNull()

  // Home → Hub → Word Song's map → its current stop → Back.
  await fireEvent.press(screen.getByTestId('map-home'))
  await flushAll()
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  await openMap('word-song')
  const node = currentStepOf(loadProgress()!, 'word-song')
  await tapStop(node)
  expect(screen.getByTestId('word-song')).toBeOnTheScreen()
  await settle(1000)
  await fireEvent.press(screen.getByTestId('word-song-back-to-hub'))
  await flushAll()
  await expectQuietMap('word-song')
})

it('AC 6: "All done" after a current-stop session returns to the same map, with no open line', async () => {
  boot()
  await renderToHub()
  await openMap('math')
  await tapStop('add-to-20')
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  for (let i = 0; i < 8; i++) await answerRight()
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  await settle(16_000)
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  await flushAll()
  expect(screen.queryByTestId('hub')).toBeNull()
  await expectQuietMap('math')
})

it('AC 6: "All done" with a pending unlock opens the map on its beat', async () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
  boot(NO_LAUNCH_FLAGS)
  saveProgress({
    ...defaultProgress(),
    history: [
      { dateISO: day(2), skillFocus: ['add-to-10'], successRate: 1 },
      { dateISO: day(1), skillFocus: ['add-to-10'], successRate: 1 },
    ],
  })
  writeSessionHistory({ ...readSessionHistory(), sessionCount: 2 })
  await renderToHub()
  await openMap('math')
  await tapStop('add-to-10')
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  for (let i = 0; i < 8; i++) await answerRight()
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  await settle(16_000)
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  await flushAll()
  expect(screen.getByTestId('map-math-beat-unlock')).toBeOnTheScreen()
})
