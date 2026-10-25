/**
 * Learner profiles in the app, end to end on an in-memory store
 * (`design/native/learner-profiles.md` §§ 1–3, ACs 29, 31–33, 37): one
 * learner sees no picker and no badge; 2+ learners get "Who is playing?"
 * after Splash, and a pick switches the store and mounts their Greet or
 * Hub; the badge switches back, and the next learner's Hub speaks even
 * within 30 s (K2); the return rule after 10 minutes hidden; Session End
 * returns to the learner's own Hub; Parent Settings' Done opens the picker
 * after a change.
 */
import {
  LEARNERS_STORAGE_KEY,
  activateLearner,
  activeLearner,
  resetLearnersForTests,
} from '@marian/core/learners'
import { defaultProgress, saveProgress } from '@marian/core/progress'
import { localDateKey } from '@marian/core/progress/clock'
import {
  readSessionHistory,
  writeSessionHistory,
} from '@marian/core/sessionEnd/sessionHistory'
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { Alert } from 'react-native'
import { flush, resetFakePlayers } from '../test/fakeAudio'
import App from './App'
import { audioEngine, sessionPrefetcher } from './audio'
import { resetLaunchReconcileForTests } from './lifecycle/launchReconcile'
import { PICKER_AFTER_HIDDEN_MS } from './lifecycle/pickerReturn'
import { NO_LAUNCH_FLAGS } from './platform/launchFlags'
import { bootNative, type SyncKeyValueBackend } from './platform/native'
import { resetHubAudioForTests } from './screens/hub/hubAudio'
import { resetPickerAudioForTests } from './screens/picker/pickerAudio'
import { PICK_ROUTE_DELAY_MS } from './screens/picker/pickerTiming'
import { LEAVE_DELAY_MS } from './screens/sessionEnd/SessionEnd'
import { SPLASH_FADE_OUT_MS } from './screens/Splash'

// These flows play core's static plan on an offline device and read each
// session start from its request. The canon text is left out of the app
// here, so every session start goes to the (offline) server as it did
// before no-Claude phase 2 (`./session/localSession.ts`); sessions built on
// the device are `App.localSessions.test.tsx`'s.
jest.mock('../assets/canon/canon-text.json', () => ({}))

// A hand-driven AppState behind the app's visibility store, so a test can
// send the app to the background and back.
jest.mock('./lifecycle/appVisibility', () => {
  const mockActual = jest.requireActual('./lifecycle/appVisibility')
  let mockState = 'active'
  const mockListeners = new Set<(mockNext: string) => void>()
  const mockStore = mockActual.createAppVisibility({
    get currentState() {
      return mockState
    },
    addEventListener: (
      _mockType: 'change',
      mockListener: (mockNext: string) => void,
    ) => {
      mockListeners.add(mockListener)
      return { remove: () => mockListeners.delete(mockListener) }
    },
  })
  return {
    ...mockActual,
    appVisibility: mockStore,
    useAppVisibilityChange: (mockCb: (mockHidden: boolean) => void) =>
      mockActual.useAppVisibilityChange(mockCb, mockStore),
    useIsAppHidden: () => mockActual.useIsAppHidden(mockStore),
    mockSetAppState: (mockNext: string) => {
      mockState = mockNext
      for (const mockL of Array.from(mockListeners)) mockL(mockNext)
    },
  }
})
const { mockSetAppState } = jest.requireMock<{
  mockSetAppState: (s: string) => void
}>('./lifecycle/appVisibility')

const MARIAN = {
  id: '5f3c2a10-8b1e-4c2d-9a7f-1e2d3c4b5a69',
  name: 'Marian',
  avatarId: 'fox',
  language: 'en',
  legacySlot: true,
  start: 'legacy-default',
  createdAtISO: '2026-10-19T00:00:00.000Z',
} as const
const SAM = {
  id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  name: 'Sam',
  avatarId: 'owl',
  language: 'en',
  legacySlot: false,
  start: { math: 2, wordSong: 1 },
  createdAtISO: '2026-10-19T00:00:01.000Z',
} as const
const ANA = {
  id: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c',
  name: 'Ana',
  avatarId: 'frog',
  language: 'en',
  legacySlot: false,
  start: { math: 1, wordSong: 1 },
  createdAtISO: '2026-10-19T00:00:02.000Z',
} as const

type Entry = typeof MARIAN | typeof SAM | typeof ANA

/** Boot on a device holding `learners`, the first one playing. */
function boot(learners: readonly Entry[] = [MARIAN, SAM]): void {
  const map = new Map<string, string>()
  map.set(
    LEARNERS_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      learners,
      activeLearnerId: learners[0]!.id,
    }),
  )
  const backend: SyncKeyValueBackend = {
    getItemSync: (key) => map.get(key) ?? null,
    setItemSync: (key, value) => {
      map.set(key, value)
    },
    removeItemSync: (key) => map.delete(key),
    getAllKeysSync: () => [...map.keys()],
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
    flags: NO_LAUNCH_FLAGS,
  })
}

/** `id` has played before (their Hub, not Greet, after a pick). */
function hasPlayed(id: string): void {
  const before = activeLearner()!.id
  activateLearner(id)
  writeSessionHistory({ ...readSessionHistory(), sessionCount: 2 })
  activateLearner(before)
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

async function settle(total: number): Promise<void> {
  for (let t = 0; t < total; t += 100) {
    await advance(Math.min(100, total - t))
    await flushAll()
  }
}

async function renderPastSplash(): Promise<void> {
  await render(<App />)
  expect(await screen.findByTestId('route-splash')).toBeOnTheScreen()
  await advance(WARM_CAP_MS + SPLASH_FADE_OUT_MS)
}

async function pick(id: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(`picker-tile-${id}`))
  await advance(PICK_ROUTE_DELAY_MS)
  await flushAll()
}

/** Hidden for `ms`, then back. */
async function background(ms: number): Promise<void> {
  await act(async () => mockSetAppState('background'))
  await advance(ms)
  await act(async () => mockSetAppState('active'))
  await flushAll()
}

const voiceLine = () => audioEngine.voice.activeLabel

/** The problem on screen, from the equation's numerals. */
function problemOnScreen(): { a: number; b: number } {
  const [a, b] = within(screen.getByTestId('math-symbolic'))
    .getAllByText(/^\d+$/)
    .map((t) => Number(t.props.children))
  return { a, b }
}

async function answerRight(): Promise<void> {
  await advance(1000)
  const { a, b } = problemOnScreen()
  await fireEvent.press(screen.getByTestId(`math-chip-${a + b}`))
  await advance(ADVANCE_AFTER_CORRECT_MS)
  await flushAll()
}

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

/** Marian's Hub → Number Garden → 8 problems (`guided` of them guided) → Session End. */
async function playMathSession(guided = 0): Promise<void> {
  await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
  await flushAll()
  expect(screen.getByTestId('math')).toBeOnTheScreen()
  for (let i = 0; i < 8; i++) {
    if (i < guided) await answerGuided()
    else await answerRight()
  }
  expect(screen.getByTestId('session-end')).toBeOnTheScreen()
  await settle(16_000)
}

beforeEach(() => {
  resetLearnersForTests()
  resetHubAudioForTests()
  resetPickerAudioForTests()
  sessionPrefetcher.discard()
  resetLaunchReconcileForTests()
  resetFakePlayers()
  jest.useFakeTimers()
  ;(globalThis.fetch as jest.Mock).mockClear()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('AC 29: one learner sees no change', () => {
  it('Splash → Hub, no picker, no badge', async () => {
    boot([MARIAN])
    hasPlayed(MARIAN.id)
    await renderPastSplash()
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(screen.queryByTestId('picker')).toBeNull()
    expect(screen.queryByTestId('hub-learner-badge')).toBeNull()
  })

  it('Session End → All done → the Hub, as today', async () => {
    boot([MARIAN])
    hasPlayed(MARIAN.id)
    await renderPastSplash()
    await settle(2000)
    await playMathSession()
    await fireEvent.press(screen.getByTestId('session-end-cta'))
    await advance(LEAVE_DELAY_MS)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
  })
})

describe('Who is playing?', () => {
  it('2 learners: Splash opens the picker in add order; a pick mounts that learner’s Hub with their badge', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    expect(screen.getByTestId('picker')).toBeOnTheScreen()
    expect(screen.getByTestId('emma-idle')).toBeOnTheScreen()
    expect(
      screen.getAllByTestId(/^picker-tile-/).map((t) => String(t.props.testID)),
    ).toEqual([`picker-tile-${MARIAN.id}`, `picker-tile-${SAM.id}`])
    await pick(SAM.id)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(activeLearner()?.id).toBe(SAM.id)
    expect(
      screen.getByTestId('hub-learner-badge').props.accessibilityLabel,
    ).toBe('Sam')
    // Sam's Hub is Sam's: Number Garden at his land 2 start.
    expect(screen.getByTestId('hub-card-current-add-to-10')).toBeOnTheScreen()
  })

  it('a learner who never played: the pick opens Greet', async () => {
    boot([MARIAN, ANA])
    hasPlayed(MARIAN.id)
    await renderPastSplash()
    await pick(ANA.id)
    expect(screen.getByTestId('greet')).toBeOnTheScreen()
    expect(activeLearner()?.id).toBe(ANA.id)
  })

  it('AC 32: badge → picker → another learner within 30 s: their Hub plays its line (K2)', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await flushAll()
    expect(voiceLine()).toMatch(/^hub-guide:/)
    await settle(2000)
    await fireEvent.press(screen.getByTestId('hub-learner-badge'))
    expect(screen.getByTestId('picker')).toBeOnTheScreen()
    // The badge stopped Emma's line.
    expect(voiceLine()).toBeNull()
    await pick(SAM.id)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(activeLearner()?.id).toBe(SAM.id)
    await flushAll()
    expect(voiceLine()).toMatch(/^hub-guide:/)
  })
})

describe('AC 31: the return rule', () => {
  it('Hub: hidden 9 min 59 s → no change; hidden 10 min → the picker', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await background(PICKER_AFTER_HIDDEN_MS - 1000)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    await background(PICKER_AFTER_HIDDEN_MS)
    expect(screen.getByTestId('picker')).toBeOnTheScreen()
  })

  it('Math: hidden 10 min → the session goes on', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await fireEvent.press(screen.getByTestId('hub-card-number-garden'))
    await flushAll()
    expect(screen.getByTestId('math')).toBeOnTheScreen()
    await background(PICKER_AFTER_HIDDEN_MS * 2)
    expect(screen.getByTestId('math')).toBeOnTheScreen()
    expect(screen.queryByTestId('picker')).toBeNull()
  })

  it('a switch from the Map drops the Hub’s prefetch: the next learner’s Hub requests their own session (§ 2.3 step 1)', async () => {
    // Marian's twin on the same baseline: their Hubs prefetch under the
    // same key, so only a discard keeps Marian's request from them.
    const twin = {
      ...SAM,
      start: 'legacy-default',
    } as unknown as typeof SAM
    const sessionStarts = () =>
      (globalThis.fetch as jest.Mock).mock.calls.filter(([url]) =>
        String(url).endsWith('/api/claude'),
      ).length
    // Held open: Marian's request is still pending at the pick.
    ;(globalThis.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    )
    try {
      boot([MARIAN, twin])
      hasPlayed(MARIAN.id)
      hasPlayed(twin.id)
      await renderPastSplash()
      await pick(MARIAN.id)
      await settle(2000)
      expect(sessionStarts()).toBe(1)
      await fireEvent.press(screen.getByTestId('hub-map-math'))
      await settle(3000)
      await background(PICKER_AFTER_HIDDEN_MS)
      expect(screen.getByTestId('picker')).toBeOnTheScreen()
      await pick(twin.id)
      expect(screen.getByTestId('hub')).toBeOnTheScreen()
      expect(activeLearner()?.id).toBe(twin.id)
      await settle(2000)
      expect(sessionStarts()).toBe(2)
      await fireEvent.press(screen.getByTestId('hub-card-word-song'))
      await flushAll()
      // The tap takes their own request, not a third one.
      expect(sessionStarts()).toBe(2)
    } finally {
      ;(globalThis.fetch as jest.Mock).mockImplementation(() =>
        Promise.reject(
          new TypeError('Network request failed (jest is offline)'),
        ),
      )
    }
  })

  it('one learner: hidden 10 min on the Hub → no change', async () => {
    boot([MARIAN])
    hasPlayed(MARIAN.id)
    await renderPastSplash()
    await background(PICKER_AFTER_HIDDEN_MS)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
  })
})

describe('AC 33: Session End returns to the learner’s own Hub (Thomas 2026-10-25)', () => {
  it('2+ learners: All done opens that learner’s Hub, never the picker', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(SAM.id)
    await settle(2000)
    await playMathSession()
    await fireEvent.press(screen.getByTestId('session-end-cta'))
    await advance(LEAVE_DELAY_MS)
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(screen.queryByTestId('picker')).toBeNull()
    expect(activeLearner()?.id).toBe(SAM.id)
    expect(
      screen.getByTestId('hub-learner-badge').props.accessibilityLabel,
    ).toBe('Sam')
  })

  it('with an unlock waiting: All done opens the Map, and its Home opens the Hub', async () => {
    const day = (d: number) =>
      localDateKey(new Date(Date.now() - d * 86_400_000))
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    // Two earlier good days on add-to-10: today's is the 3rd.
    saveProgress({
      ...defaultProgress(),
      goodDays: { 'add-to-10': [day(2), day(1)] },
    })
    await renderPastSplash()
    await pick(MARIAN.id)
    await settle(2000)
    await playMathSession()
    await fireEvent.press(screen.getByTestId('session-end-cta'))
    await advance(LEAVE_DELAY_MS)
    expect(screen.getByTestId('map-math-beat-unlock')).toBeOnTheScreen()
    await settle(4000)
    await fireEvent.press(screen.getByTestId('map-home'))
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(screen.queryByTestId('picker')).toBeNull()
    expect(activeLearner()?.id).toBe(MARIAN.id)
  })

  it('a Map reached from the Hub keeps Home → Hub', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await settle(2000)
    await fireEvent.press(screen.getByTestId('hub-map-math'))
    await settle(3000)
    await fireEvent.press(screen.getByTestId('map-home'))
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
  })

  it('Again starts the same learner’s next session', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await settle(2000)
    // Two guided problems: 6 of 8, not yet today's flower.
    await playMathSession(2)
    await fireEvent.press(screen.getByTestId('session-end-again'))
    await advance(LEAVE_DELAY_MS)
    await flushAll()
    expect(screen.getByTestId('math')).toBeOnTheScreen()
    expect(activeLearner()?.id).toBe(MARIAN.id)
  })
})

describe('AC 37: Parent Settings’ Done', () => {
  async function openParentSettings() {
    await fireEvent(screen.getByTestId('hub-emma-long-press'), 'longPress')
    expect(screen.getByTestId('parent-settings')).toBeOnTheScreen()
  }

  it('the playing learner changed → the picker; nothing changed → the Hub', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(MARIAN.id)
    await settle(2000)
    await openParentSettings()
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(screen.getByTestId('hub')).toBeOnTheScreen()

    await openParentSettings()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM.id}`))
    expect(activeLearner()?.id).toBe(SAM.id)
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(screen.getByTestId('picker')).toBeOnTheScreen()
  })

  it('one learner left after a removal → their Hub, mounted on their store', async () => {
    boot([MARIAN, SAM])
    hasPlayed(MARIAN.id)
    hasPlayed(SAM.id)
    await renderPastSplash()
    await pick(SAM.id)
    await settle(2000)
    await openParentSettings()
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _body, buttons) => {
        buttons?.find((b) => b.text === 'Remove')?.onPress?.()
      })
    await fireEvent.press(screen.getByTestId('ps-learner-remove'))
    alert.mockRestore()
    expect(activeLearner()?.id).toBe(MARIAN.id)
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    await flushAll()
    expect(screen.getByTestId('hub')).toBeOnTheScreen()
    expect(screen.queryByTestId('hub-learner-badge')).toBeNull()
    // Marian's Hub (her letter-sounds), not Sam's (letter names).
    expect(
      screen.getByTestId('hub-card-current-letter-sounds'),
    ).toBeOnTheScreen()
  })
})
