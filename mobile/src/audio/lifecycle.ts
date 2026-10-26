/**
 * Audio session + app lifecycle wiring. `useAudioEngine()` is mounted once
 * at the App root (where Phase 2a left the hook point).
 *
 * Audio session (`setAudioModeAsync`):
 * - `playsInSilentMode: true`: the iPad's silent switch must not mute Emma
 *   (Marian will not know about it).
 * - `interruptionMode: 'doNotMix'`: the only mode in which expo-audio
 *   pauses the clip on a call / Siri and resumes it on "should resume"
 *   (iOS `handleInterruptionBegan/Ended`; Android audio-focus loss/gain).
 *   `'duckOthers'` only halves the volume on iOS and never resumes;
 *   `'mixWithOthers'` requests no audio focus on Android, so a call would
 *   not pause Emma there.
 * - `shouldPlayInBackground: false`: Emma stops when the app is hidden.
 * - Held across lines: every player is created with
 *   `keepAudioSessionActive: true` (`playerPort.ts`), so the session stays
 *   active between Emma's lines and other audio stays paused while her
 *   screens are up. It is released (`setIsAudioActiveAsync(false)`) when
 *   the app goes to the background (`design/native/greet-math-native.md`
 *   § 3) and while Parent Settings is up (`parent-settings-native.md`
 *   § 6), on iOS only.
 * - Released means silenced: since expo-audio 58, on iOS as on Android,
 *   `setIsAudioActiveAsync(false)` makes every `play()` a no-op until
 *   `setIsAudioActiveAsync(true)` (`ios/AudioModule.swift`
 *   `setIsAudioActive` writes `audioEnabled`; `Function("play")` returns
 *   on `canStartPlayback()`). So every release is paired with a
 *   re-enable: on the visible edge, and when Parent Settings is left. The
 *   call runs on expo-modules' serial async queue, but `play()` runs on
 *   the JS thread at once, so nothing may play until the `true` call's
 *   promise has resolved: the voice line un-parks only then.
 *
 * Lifecycle (semantics in `voiceChannel.ts`):
 * - Phase 2a's `appVisibility` (hidden ⇔ AppState `background`) parks and
 *   resumes the voice line, and queues lines requested while hidden.
 * - The `active` AppState edge resumes a line an interruption left paused
 *   (Siri / a call can end with the app `inactive` → `active`, which
 *   `appVisibility` deliberately does not report).
 */
import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio'
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import {
  appVisibility,
  type AppStateSource,
  type AppVisibility,
} from '../lifecycle/appVisibility'
import { readBuildEnv } from '../platform/buildEnv'
import { recordAudio, setAudioLogConsole } from './audioLog'
import { audioEngine } from './engine'
import { sweepSessionAudioCache } from './sessionAudio'
import type { VoiceChannel } from './voiceChannel'

export const AUDIO_MODE = {
  playsInSilentMode: true,
  interruptionMode: 'doNotMix',
  shouldPlayInBackground: false,
  allowsRecording: false,
  shouldRouteThroughEarpiece: false,
} as const

let audioModeSet: Promise<void> | null = null

/** Idempotent; a failed attempt is retried on the next call. */
export function configureAudioSession(
  setMode: typeof setAudioModeAsync = setAudioModeAsync,
): Promise<void> {
  audioModeSet ??= setMode(AUDIO_MODE).catch((err: unknown) => {
    audioModeSet = null
    recordAudio({
      kind: 'note',
      label: 'audio-mode',
      detail: `failed: ${err instanceof Error ? err.message : String(err)}`,
    })
  })
  return audioModeSet
}

/** iOS: the last `setIsAudioActiveAsync` call was `false`. */
let released = false
/** The last `setIsAudioActiveAsync` call; resolves once it has run. */
let lastActiveCall: Promise<void> = Promise.resolve()
/** Screens up that play nothing and keep the session released. */
let quietScreens = 0

/** Test seam. */
export function _resetAudioSessionForTests(): void {
  audioModeSet = null
  released = false
  lastActiveCall = Promise.resolve()
  quietScreens = 0
}

function callSetActive(
  active: boolean,
  setActive: typeof setIsAudioActiveAsync,
): Promise<void> {
  released = !active
  lastActiveCall = setActive(active).catch((err: unknown) => {
    recordAudio({
      kind: 'note',
      label: 'audio-session',
      detail: `${active ? 're-enable' : 'release'} failed: ${err instanceof Error ? err.message : String(err)}`,
    })
  })
  return lastActiveCall
}

/**
 * Release the held iOS audio session (other audio may resume). Called
 * when the app goes to the background, after the voice line is parked.
 * Playback stays off until {@link reactivateAudioSession}. No-op on
 * Android: see the header.
 */
export function releaseAudioSession(
  platform: string = Platform.OS,
  setActive: typeof setIsAudioActiveAsync = setIsAudioActiveAsync,
): void {
  if (platform !== 'ios') return
  void callSetActive(false, setActive)
}

/**
 * Re-enable playback after a release. Resolves once `play()` is allowed
 * again (never rejects); play nothing before. Stays released while a
 * quiet screen is up ({@link quietAudioSession}).
 */
export function reactivateAudioSession(
  platform: string = Platform.OS,
  setActive: typeof setIsAudioActiveAsync = setIsAudioActiveAsync,
): Promise<void> {
  if (platform !== 'ios' || !released || quietScreens > 0) {
    return lastActiveCall
  }
  return callSetActive(true, setActive)
}

/**
 * A screen that plays nothing (Parent Settings, § 6): releases the
 * session while it is up, so music Emma paused can resume, including
 * after a background and return. The returned end re-enables playback;
 * the next screen may play once it resolves. Calling it again is a no-op.
 */
export function quietAudioSession(
  platform: string = Platform.OS,
  setActive: typeof setIsAudioActiveAsync = setIsAudioActiveAsync,
): () => Promise<void> {
  quietScreens += 1
  releaseAudioSession(platform, setActive)
  let ended = false
  return () => {
    if (ended) return lastActiveCall
    ended = true
    quietScreens -= 1
    return reactivateAudioSession(platform, setActive)
  }
}

/**
 * Bridge the app lifecycle to the voice channel. Returns the uninstall.
 */
export function installAudioLifecycle(
  voice: VoiceChannel,
  visibility: AppVisibility = appVisibility,
  appState: AppStateSource = AppState,
  release: () => void = releaseAudioSession,
  reactivate: () => Promise<void> = reactivateAudioSession,
): () => void {
  let installed = true
  voice.setHidden(visibility.getIsHidden())
  const offVisibility = visibility.subscribe(() => {
    if (visibility.getIsHidden()) {
      voice.setHidden(true)
      release()
      return
    }
    // Un-park (and drain the queue) only once play() is allowed again;
    // lines requested meanwhile queue as while hidden.
    void reactivate().then(() => {
      if (installed && !visibility.getIsHidden()) voice.setHidden(false)
    })
  })
  // Interruption recovery only: `inactive → active`. The `background →
  // active` return is the visibility edge above (unpark + queue drain).
  let last = appState.currentState
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active' && last === 'inactive') voice.onActive()
    last = state
  })
  return () => {
    installed = false
    offVisibility()
    sub.remove()
  }
}

/** Delay before the debug audio check runs (after Splash settles). */
const AUDIO_CHECK_DELAY_MS = 2_000

/** Mount once at the App root. */
export function useAudioEngine(debug: boolean): void {
  const audioCheck = readBuildEnv().audioCheck === '1'
  useEffect(() => {
    setAudioLogConsole(debug || audioCheck)
  }, [debug, audioCheck])
  useEffect(() => {
    void configureAudioSession()
    sweepSessionAudioCache()
    const uninstall = installAudioLifecycle(audioEngine.voice)
    if (!audioCheck) return uninstall
    const timer = setTimeout(() => {
      // Loaded on demand: a normal launch never evaluates the check.
      void import('./debug/audioCheck').then((m) => m.runAudioCheck())
    }, AUDIO_CHECK_DELAY_MS)
    return () => {
      clearTimeout(timer)
      uninstall()
    }
  }, [audioCheck])
}
