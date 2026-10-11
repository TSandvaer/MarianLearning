/**
 * The app end to end on an in-memory store: Splash branches on the
 * persisted sessionCount exactly like the web, Greet runs on the real
 * audio engine (over the fake expo-audio, so silent) and hands over to
 * Math, Math hands its result to Session End, Session End and Splash hand
 * over to the Hub, and the placeholders walk the rest of core's route
 * state machine.
 */
import { LINE_GAP_MS } from '@marian/core/greet/greetSequence'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
  STORAGE_KEY,
  type Progress,
} from '@marian/core/progress'
import { seedUnlocksCelebrated } from '@marian/core/progress/pathBeats'
import {
  readSessionHistory,
  writeSessionHistory,
} from '@marian/core/sessionEnd/sessionHistory'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { loadStardust } from '@marian/core/shared/stardust'
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
import { audioEngine, sessionPrefetcher } from './audio'
import { mathLayout } from './layout/mathLayout'
import * as buildEnv from './platform/buildEnv'
import { NO_LAUNCH_FLAGS, type LaunchFlags } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import {
  HEART_TAP_TRANSITION_MS,
  WAKE_REPROMPT_AFTER_MS,
} from './screens/greet/Greet'
import { PARENT_LONG_PRESS_MS } from './screens/hub/Hub'
import { PLINK_VOLUME, resetHubAudioForTests } from './screens/hub/hubAudio'
import { CHIME_TAIL_MS, LEAVE_DELAY_MS } from './screens/sessionEnd/SessionEnd'
import { unlockTimeline } from '@marian/core/map/unlockBeat'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

/** Every write to the progress doc since the last `boot()`. */
let progressWrites = 0

function boot(flags: LaunchFlags = NO_LAUNCH_FLAGS): void {
  const map = new Map<string, string>()
  progressWrites = 0
  const backend: SyncKeyValueBackend = {
    getItemSync: (key) => map.get(key) ?? null,
    setItemSync: (key, value) => {
      if (key === STORAGE_KEY) progressWrites += 1
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

/** The stop-unlock beat's line starts this long after the map mounts. */
const MAP_CHEER_AT_MS = unlockTimeline({
  world: 'math',
  mastered: 'add-to-10',
  unlocked: 'add-to-20',
  land: null,
}).at(-1)!.at

/** The line on Emma's voice channel now (`<player>:<line id>`), or null. */
const voiceLine = () => audioEngine.voice.activeLabel

beforeEach(() => {
  // Module state that outlives a render: the Hub's line player and 30 s
  // remount clock, and the app's session prefetch.
  resetHubAudioForTests()
  sessionPrefetcher.discard()
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

it('returning (sessionCount ≥ 1, via a debug seed): Splash → Hub, and Emma speaks with no tap', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  await renderPastSplash()
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  expect(screen.queryByTestId('greet')).toBeNull()
  // Idle, with the Hub's baked shadow.
  expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
  expect(screen.getByTestId('emma-shadow')).toBeOnTheScreen()
  // A tie on a fresh day: Word Song glows, and her line is already playing.
  await flushAll()
  expect(voiceLine()).toBe('hub-guide:guide.grow.word-song')
  expect(readSessionHistory().sessionCount).toBe(1)
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
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  // Today's flower sleeps, so Emma names the other world.
  await flushAll()
  expect(screen.getByTestId('hub-slot-sleeping')).toBeOnTheScreen()
  // Once the chime has rung out, the only live player is her Hub line.
  await advance(CHIME_TAIL_MS)
  expect(voiceLine()).toBe('hub-guide:guide.sleeping.word-song')
  const live = fakePlayers.filter((p) => !p.released)
  expect(live).toHaveLength(1)
  expect(live[0]!.calls).toContain('play')
})

/** Word Song, offline (static plan, silent captions): the read ends, the
 *  right chip, "Yes!", the next problem. */
async function answerWordRight(): Promise<void> {
  await settle(2000)
  const word = screen.getByTestId('word-song-word-picture').props
    .accessibilityLabel as string
  await fireEvent.press(screen.getByTestId(`word-song-chip-${word}`))
  await settle(ADVANCE_AFTER_CORRECT_MS + 400)
}

it('Session End writes once per session: Math → Session End → Hub → Word Song → Session End (+5), and nothing replays after', async () => {
  boot()
  await greetToMath()
  for (let i = 0; i < 8; i++) await answerRight()
  await sessionEndSettles()
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  expect(loadProgress()?.history).toHaveLength(1)
  const stardustBefore = loadStardust().total

  await fireEvent.press(screen.getByTestId('hub-card-word-song'))
  await flushAll()
  expect(screen.getByTestId('word-song')).toBeOnTheScreen()
  expect(sessionStarts().at(-1)).toMatchObject({
    payload: { track: 'word-song', level: 1, childName: 'Marian' },
  })
  for (let i = 0; i < 8; i++) await answerWordRight()

  // Word Song handed its result over: the one write, the +5 bonus.
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  expect(readSessionHistory().sessionCount).toBe(2)
  expect(loadProgress()?.history).toHaveLength(2)
  // Recorded under the Word Song focus picked at the kick (the diagnostic
  // baseline's), even though offline the static plan ran.
  expect(loadProgress()?.history.at(-1)?.skillFocus).toEqual(['letter-sounds'])
  expect(loadStardust().total).toBe(stardustBefore + 5)

  await sessionEndSettles()
  await fireEvent.press(screen.getByTestId('session-end-cta'))
  await advance(LEAVE_DELAY_MS)
  await settle(1000)
  expect(readSessionHistory().sessionCount).toBe(2)
  expect(loadProgress()?.history).toHaveLength(2)
})

it('QA route literacy: Word Song runs at once, and its Session End writes exactly once', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  const env = jest.spyOn(buildEnv, 'readBuildEnv').mockReturnValue({
    apiBase: undefined,
    progressApiSecret: undefined,
    debug: '1',
    seed: undefined,
    dayOffset: undefined,
    mute: undefined,
    audioCheck: undefined,
    qaAutoTapMs: undefined,
    qaRoute: 'literacy',
  })
  try {
    boot({ debug: true, seed: null, dayOffset: null })
    await render(<App />)
    await flushAll()
    expect(screen.getByTestId('word-song')).toBeOnTheScreen()
    // Mounting wrote nothing; the session start was kicked once.
    expect(progressWrites).toBe(0)
    expect(sessionStarts()).toHaveLength(1)
    for (let i = 0; i < 8; i++) await answerWordRight()
    expect(screen.getByTestId('session-end')).toBeOnTheScreen()
    expect(readSessionHistory().sessionCount).toBe(1)
    expect(loadProgress()?.history).toHaveLength(1)
    await sessionEndSettles()
    await fireEvent.press(screen.getByTestId('session-end-cta'))
    await advance(LEAVE_DELAY_MS)
    await settle(1000)
    expect(loadProgress()?.history).toHaveLength(1)
  } finally {
    env.mockRestore()
  }
})

it('Word Song → back: the Hub at once, no Session End, no write, the request aborted', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'cvc-words', dayOffset: null })
  // Every request hangs until it is aborted.
  ;(globalThis.fetch as jest.Mock).mockImplementation(
    (_url: string, init: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        )
      }),
  )
  await renderPastSplash()
  const writes = progressWrites
  await fireEvent.press(screen.getByTestId('hub-card-word-song'))
  await flushAll()
  expect(screen.getByTestId('word-song-getting-ready')).toBeOnTheScreen()
  const calls = (globalThis.fetch as jest.Mock).mock.calls
  const signal = (calls.at(-1)![1] as { signal: AbortSignal }).signal
  expect(signal.aborted).toBe(false)
  await fireEvent.press(screen.getByTestId('word-song-back-to-hub'))
  await flushAll()
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  expect(signal.aborted).toBe(true)
  expect(screen.queryByTestId('session-end')).toBeNull()
  expect(progressWrites).toBe(writes)
  ;(globalThis.fetch as jest.Mock).mockImplementation(() =>
    Promise.reject(new TypeError('Network request failed (jest is offline)')),
  )
})

it('QA route session-end without a session: the placeholder, and nothing is written', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  const env = jest.spyOn(buildEnv, 'readBuildEnv').mockReturnValue({
    apiBase: undefined,
    progressApiSecret: undefined,
    debug: '1',
    seed: undefined,
    dayOffset: undefined,
    mute: undefined,
    audioCheck: undefined,
    qaAutoTapMs: undefined,
    qaRoute: 'session-end',
  })
  try {
    boot({ debug: true, seed: null, dayOffset: null })
    await render(<App />)
    await settle(1000)
    expect(readSessionHistory().sessionCount).toBe(0)
    expect(loadProgress()?.history ?? []).toHaveLength(0)
    expect(screen.getByTestId('route-session-end')).toBeOnTheScreen()
    expect(screen.queryByTestId('session-end')).toBeNull()
  } finally {
    env.mockRestore()
  }
})

it('3rd good day: All done opens the map, which plays the unlock once; Home → Hub → map again plays no beat and writes nothing', async () => {
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

  // The beat: Emma's badge on the stop just mastered, the new one frosted.
  expect(screen.getByTestId('map-math-beat-unlock')).toBeOnTheScreen()
  expect(screen.getByTestId('map-emma-at-add-to-10')).toBeOnTheScreen()
  expect(
    within(screen.getByTestId('map-stop-add-to-20')).getByTestId(
      'map-stop-state-locked',
    ),
  ).toBeOnTheScreen()
  // App's Emma is hidden: the badge is the map's Emma.
  expect(screen.queryByTestId('emma-idle')).toBeNull()
  // The seen-marker is the mount's one write.
  expect(loadProgress()?.unlocksCelebrated).toContain('add-to-20')
  const writesAfterBeat = progressWrites
  await advance(MAP_CHEER_AT_MS)
  await flushAll()
  expect(screen.getByTestId('map-emma-at-add-to-20')).toBeOnTheScreen()
  expect(screen.getByTestId('map-emma-cheering')).toBeOnTheScreen()
  expect(voiceLine()).toBe('map:end.unlock.add-to-20')

  // Home → Hub (quiet) → the map button: the same map, no beat.
  await fireEvent.press(screen.getByTestId('map-home'))
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('hub-map-math'))
  expect(screen.getByTestId('map-math-beat-none')).toBeOnTheScreen()
  expect(screen.getByTestId('map-emma-at-add-to-20')).toBeOnTheScreen()
  await settle(3000)
  expect(voiceLine()).toBe('map:path.open.add-to-20')
  expect(progressWrites).toBe(writesAfterBeat)
})

/** A stored doc with an unlock the map has not celebrated (add-to-20). */
function pendingUnlockDoc(): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'add-to-10': 'mastered',
      'add-to-20': 'intro',
    },
    unlocksCelebrated: seedUnlocksCelebrated(base),
  }
}

it('QA route map without a handoff: the placeholder, no beat, and nothing is written', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  const env = jest.spyOn(buildEnv, 'readBuildEnv').mockReturnValue({
    apiBase: undefined,
    progressApiSecret: undefined,
    debug: '1',
    seed: undefined,
    dayOffset: undefined,
    mute: undefined,
    audioCheck: undefined,
    qaAutoTapMs: undefined,
    qaRoute: 'map',
  })
  try {
    boot({ debug: true, seed: null, dayOffset: null })
    saveProgress(pendingUnlockDoc())
    const before = loadProgress()?.unlocksCelebrated
    const writes = progressWrites
    await render(<App />)
    await settle(3000)
    expect(screen.getByTestId('route-map')).toBeOnTheScreen()
    expect(screen.queryByTestId('map')).toBeNull()
    expect(progressWrites).toBe(writes)
    expect(loadProgress()?.unlocksCelebrated).toEqual(before)
    expect(voiceLine()).toBeNull()
  } finally {
    env.mockRestore()
  }
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
  // Word Song glows (a tie): the Hub prefetches Word Song's session.
  expect(sessionStarts()).toEqual([
    expect.objectContaining({
      payload: expect.objectContaining({ track: 'word-song' }),
    }),
  ])
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(sessionStarts()).toHaveLength(2)
  // The seeded progress rides along (focus node, first encounters).
  expect(sessionStarts()[1]).toMatchObject({
    payload: { track: 'math', progress: { focusNode: 'add-to-20' } },
  })

  await fireEvent.press(screen.getByTestId('math-back-to-hub'))
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
  // The tap recorded Word Song as shown, so the tie now alternates to
  // Number Garden: the Hub prefetches its session (offline: it fails, and
  // the tap starts its own).
  await flushAll()
  expect(screen.getByTestId('hub-card-suggested')).toBeOnTheScreen()
  expect(sessionStarts()).toHaveLength(3)
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(sessionStarts()).toHaveLength(4)
})

it('Number Garden glowing: the Hub prefetches its session and the tap adopts it', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  // The tie alternates from Word Song: Number Garden glows.
  writeSessionHistory({ ...readSessionHistory(), lastSuggestion: 'word-song' })
  // The prefetch is still in flight when she taps.
  ;(globalThis.fetch as jest.Mock).mockImplementationOnce(
    () => new Promise(() => {}),
  )
  await renderPastSplash()
  expect(screen.getByTestId('hub-card-suggested')).toBeOnTheScreen()
  expect(sessionStarts()).toEqual([
    expect.objectContaining({
      payload: expect.objectContaining({
        track: 'math',
        progress: expect.objectContaining({ focusNode: 'add-to-20' }),
      }),
    }),
  ])
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  // Adopted: no second request.
  expect(sessionStarts()).toHaveLength(1)
  expect(readSessionHistory().lastSuggestion).toBe('number-garden')
})

it('the Hub prefetch survives a map visit: Number Garden glowing → map → Home → tap adopts it', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  writeSessionHistory({ ...readSessionHistory(), lastSuggestion: 'word-song' })
  ;(globalThis.fetch as jest.Mock).mockImplementationOnce(
    () => new Promise(() => {}),
  )
  await renderPastSplash()
  expect(sessionStarts()).toHaveLength(1)
  await fireEvent.press(screen.getByTestId('hub-map-math'))
  expect(screen.getByTestId('map')).toBeOnTheScreen()
  await fireEvent.press(screen.getByTestId('map-home'))
  await flushAll()
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  expect(sessionStarts()).toHaveLength(1)
})

it("Hub: the map button opens that world's map, Home returns to a quiet Hub, a 3 s press on Emma opens Parent Settings", async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  boot({ debug: true, seed: 'add-to-20', dayOffset: null })
  await renderPastSplash()
  await flushAll()
  expect(voiceLine()).toMatch(/^hub-guide:/)
  await fireEvent.press(screen.getByTestId('hub-map-word-song'))
  expect(screen.getByTestId('map-word-song-beat-none')).toBeOnTheScreen()
  // The plink rang (it outlives the Hub); the Hub line stopped and the
  // map's open line took the voice.
  const plink = fakePlayers.filter(
    (p) => p.volume === PLINK_VOLUME && !p.released,
  )
  expect(plink).toHaveLength(1)
  expect(plink[0]!.calls).toEqual(['play'])
  await flushAll()
  expect(voiceLine()).toMatch(/^map:path\.open\./)
  expect(screen.getByTestId('map-ribbon')).toBeOnTheScreen()

  // However long the map was open, the Hub stays quiet (web parity).
  await advance(60_000)
  await fireEvent.press(screen.getByTestId('map-home'))
  expect(screen.getByTestId('hub')).toBeOnTheScreen()
  await settle(2000)
  expect(voiceLine()).toBeNull()
  await fireEvent(screen.getByTestId('hub-emma-long-press'), 'longPress')
  expect(screen.getByTestId('route-parent-settings')).toBeOnTheScreen()
  expect(PARENT_LONG_PRESS_MS).toBe(3000)
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
