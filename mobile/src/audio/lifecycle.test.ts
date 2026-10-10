import {
  createAppVisibility,
  type AppStateSource,
} from '../lifecycle/appVisibility'
import {
  fakePlayerFactory,
  fakePlayers,
  resetFakePlayers,
  setAudioModeAsync,
} from '../../test/fakeAudio'
import { createAudioEngine } from './engine'
import {
  AUDIO_MODE,
  _resetAudioSessionForTests,
  configureAudioSession,
  installAudioLifecycle,
  releaseAudioSession,
} from './lifecycle'
import { START_TIMEOUT_MS } from './linePlayback'

/** A hand-driven React Native AppState. */
function fakeAppState(initial = 'active') {
  const listeners = new Set<(s: string) => void>()
  let current: string = initial
  const source: AppStateSource & { set(s: string): void } = {
    get currentState() {
      return current
    },
    addEventListener(_type, listener) {
      listeners.add(listener)
      return { remove: () => listeners.delete(listener) }
    },
    set(state: string) {
      current = state
      for (const l of Array.from(listeners)) l(state)
    },
  }
  return source
}

function setup() {
  const engine = createAudioEngine({ createPlayer: fakePlayerFactory })
  const appState = fakeAppState()
  const visibility = createAppVisibility(appState)
  const uninstall = installAudioLifecycle(engine.voice, visibility, appState)
  const speak = (
    key: string,
    text = 'One two three four.',
    onWordTick?: (i: number) => void,
  ) => engine.speak(key, 7, { text, label: key, onWordTick })
  return { engine, appState, uninstall, speak }
}

describe('audio session', () => {
  beforeEach(() => {
    _resetAudioSessionForTests()
    setAudioModeAsync.mockClear()
  })

  it('plays in silent mode, does not mix (pause/resume on calls), never in the background', async () => {
    await configureAudioSession()
    await configureAudioSession()
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1)
    expect(setAudioModeAsync).toHaveBeenCalledWith(AUDIO_MODE)
    expect(AUDIO_MODE).toMatchObject({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
      allowsRecording: false,
    })
  })

  it('retries the audio mode after a failure', async () => {
    setAudioModeAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('session busy')),
    )
    await configureAudioSession()
    await configureAudioSession()
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2)
  })
})

describe('audio lifecycle (web: useHowlerSuspendOnHide + pendingResumeGate)', () => {
  beforeEach(() => {
    resetFakePlayers()
    jest.useFakeTimers()
  })
  afterEach(() => jest.useRealTimers())

  it('background parks the line and freezes its caption; foreground resumes it where it stopped', async () => {
    const { appState, speak } = setup()
    const ticks: number[] = []
    const done = speak('session:s:p1', 'One two three four.', (i) =>
      ticks.push(i),
    )
    const p = fakePlayers[0]
    p.start(2) // 4 words, 500 ms each
    p.emit({ currentTime: 0.6 })
    expect(ticks).toEqual([0, 1])

    appState.set('inactive') // Control Center etc.: still visible
    expect(p.calls).toEqual(['play'])
    appState.set('background')
    expect(p.calls).toEqual(['play', 'pause'])
    p.emit({ playing: false, currentTime: 0.6 })
    jest.advanceTimersByTime(60_000)
    expect(ticks).toEqual([0, 1])

    appState.set('active')
    expect(p.calls).toEqual(['play', 'pause', 'play'])
    p.emit({ playing: true, currentTime: 1.1 })
    expect(ticks).toEqual([0, 1, 2])
    p.finish()
    await expect(done).resolves.toBeUndefined()
    expect(ticks).toEqual([0, 1, 2, 3])
  })

  it('does not double-play when expo-audio already resumed the clip on foreground', () => {
    const { appState, speak } = setup()
    void speak('greet:hi', 'Hi!')
    const p = fakePlayers[0]
    p.start(0.6)
    appState.set('background')
    p.emit({ playing: true }) // the native foreground resume landed first
    appState.set('active')
    expect(p.calls).toEqual(['play', 'pause'])
  })

  it('the start timeout is frozen while hidden', async () => {
    const { appState, speak } = setup()
    const done = speak('greet:hi', 'Hi!')
    appState.set('background')
    jest.advanceTimersByTime(START_TIMEOUT_MS * 3)
    appState.set('active')
    const p = fakePlayers[0]
    expect(p.calls).toEqual(['play', 'pause', 'play'])
    p.start(0.6)
    p.finish()
    await expect(done).resolves.toBeUndefined()
  })

  it('a line requested while hidden waits for the foreground; the parked line is cancelled and its player released', async () => {
    const { engine, appState, speak } = setup()
    const hub = speak('hub:a', 'Hi! What today?')
    fakePlayers[0].start(1.2)
    appState.set('background')

    const math = speak('session:s:p1', 'Three plus two.')
    await expect(hub).rejects.toThrow('cancelled')
    // Released: expo-audio's own foreground resume can't bring it back.
    expect(fakePlayers[0].calls.slice(-2)).toEqual(['remove', 'release'])
    expect(fakePlayers).toHaveLength(1) // the queued line hasn't started
    expect(engine.voice.activeLabel).toBeNull()

    appState.set('active')
    expect(fakePlayers).toHaveLength(2)
    expect(engine.voice.activeLabel).toBe('session:s:p1')
    fakePlayers[1].start(1)
    fakePlayers[1].finish()
    await expect(math).resolves.toBeUndefined()
  })

  it('while hidden only the most recent request survives (web: most-recent-only queue)', async () => {
    const { engine, appState, speak } = setup()
    appState.set('background')
    const first = speak('session:s:p1', 'One.')
    const second = speak('session:s:p2', 'Two.')
    await expect(first).rejects.toThrow('cancelled')
    appState.set('active')
    expect(engine.voice.activeLabel).toBe('session:s:p2')
    fakePlayers[0].start(0.5)
    fakePlayers[0].finish()
    await expect(second).resolves.toBeUndefined()
  })

  it('cancelVoice() while hidden also drops the queued line', async () => {
    const { engine, appState, speak } = setup()
    appState.set('background')
    const queued = speak('session:s:p1', 'One.')
    engine.cancelVoice()
    await expect(queued).rejects.toThrow('cancelled')
    appState.set('active')
    expect(fakePlayers).toHaveLength(0)
  })

  it('interruption (call / Siri): the OS pause holds the line; the active edge resumes it if the OS did not', async () => {
    const { appState, speak } = setup()
    const ticks: number[] = []
    const done = speak('session:s:p1', 'One two three four.', (i) =>
      ticks.push(i),
    )
    const p = fakePlayers[0]
    p.start(2)
    p.emit({ currentTime: 0.6 })

    // Interruption began: the app goes inactive, the OS pauses the clip.
    appState.set('inactive')
    p.emit({ playing: false, currentTime: 0.6 })
    jest.advanceTimersByTime(60_000) // a long call: nothing settles
    expect(ticks).toEqual([0, 1])

    // Ended without "should resume": the active edge restarts the clip.
    appState.set('active')
    expect(p.calls).toEqual(['play', 'play'])
    p.emit({ playing: true, currentTime: 1.1 })
    p.finish()
    await expect(done).resolves.toBeUndefined()
    expect(ticks).toEqual([0, 1, 2, 3])
  })

  it('interruption that the OS resumes itself: the active edge is a no-op', () => {
    const { appState, speak } = setup()
    void speak('session:s:p1')
    const p = fakePlayers[0]
    p.start(2)
    appState.set('inactive')
    p.emit({ playing: false })
    p.emit({ playing: true }) // "should resume" from the OS
    appState.set('active')
    expect(p.calls).toEqual(['play'])
  })

  it('a line the OS paused while visible (headphones out) and then cancelled is released, so no later resume can bring it back', async () => {
    const { appState, speak } = setup()
    const hub = speak('hub:a', 'Hi! What today?')
    const hubPlayer = fakePlayers[0]
    hubPlayer.start(1.2)
    // iOS .oldDeviceUnavailable: expo-audio pauses it and flags wasPlaying.
    hubPlayer.emit({ playing: false, currentTime: 0.4 })

    // The child taps into Math: the Hub line is cancelled while visible.
    const math = speak('session:s:p1', 'Three plus two.')
    await expect(hub).rejects.toThrow('cancelled')
    expect(hubPlayer.calls).toEqual(['play', 'pause', 'remove', 'release'])

    // An app switch and return (where expo-audio resumes flagged players)
    // only touches Math's line.
    const mathPlayer = fakePlayers[1]
    mathPlayer.start(1)
    appState.set('background')
    appState.set('active')
    expect(hubPlayer.calls).toEqual(['play', 'pause', 'remove', 'release'])
    mathPlayer.finish()
    await expect(math).resolves.toBeUndefined()
  })

  it('uninstall stops following the app state', () => {
    const { appState, speak, uninstall } = setup()
    void speak('greet:hi', 'Hi!')
    fakePlayers[0].start(0.6)
    uninstall()
    appState.set('background')
    expect(fakePlayers[0].calls).toEqual(['play'])
  })
})

describe('held audio session (native spec § 3)', () => {
  it('is released when the app goes to the background, not on inactive or foreground', () => {
    const engine = createAudioEngine({ createPlayer: fakePlayerFactory })
    const appState = fakeAppState()
    const visibility = createAppVisibility(appState)
    const release = jest.fn()
    installAudioLifecycle(engine.voice, visibility, appState, release)

    appState.set('inactive') // Control Center: still visible
    expect(release).not.toHaveBeenCalled()
    appState.set('background')
    expect(release).toHaveBeenCalledTimes(1)
    appState.set('active')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases through setIsAudioActiveAsync(false) on iOS only', () => {
    const setActive = jest.fn(() => Promise.resolve())
    releaseAudioSession('ios', setActive)
    expect(setActive).toHaveBeenCalledTimes(1)
    expect(setActive).toHaveBeenCalledWith(false)
    // Android: the option is iOS-only, and setIsAudioActiveAsync(false)
    // would disable playback there until re-enabled.
    releaseAudioSession('android', setActive)
    expect(setActive).toHaveBeenCalledTimes(1)
  })
})
