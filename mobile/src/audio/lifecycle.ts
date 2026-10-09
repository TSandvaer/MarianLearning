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
 *
 * Lifecycle (semantics in `voiceChannel.ts`):
 * - Phase 2a's `appVisibility` (hidden ⇔ AppState `background`) parks and
 *   resumes the voice line, and queues lines requested while hidden.
 * - The `active` AppState edge resumes a line an interruption left paused
 *   (Siri / a call can end with the app `inactive` → `active`, which
 *   `appVisibility` deliberately does not report).
 */
import { setAudioModeAsync } from 'expo-audio'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import {
  appVisibility,
  type AppStateSource,
  type AppVisibility,
} from '../lifecycle/appVisibility'
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

/** Test seam. */
export function _resetAudioSessionForTests(): void {
  audioModeSet = null
}

/**
 * Bridge the app lifecycle to the voice channel. Returns the uninstall.
 */
export function installAudioLifecycle(
  voice: VoiceChannel,
  visibility: AppVisibility = appVisibility,
  appState: AppStateSource = AppState,
): () => void {
  voice.setHidden(visibility.getIsHidden())
  const offVisibility = visibility.subscribe(() =>
    voice.setHidden(visibility.getIsHidden()),
  )
  let last = appState.currentState
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active' && last !== 'active') voice.onActive()
    last = state
  })
  return () => {
    offVisibility()
    sub.remove()
  }
}

/** Mount once at the App root. */
export function useAudioEngine(debug: boolean): void {
  useEffect(() => {
    setAudioLogConsole(debug)
  }, [debug])
  useEffect(() => {
    void configureAudioSession()
    sweepSessionAudioCache()
    return installAudioLifecycle(audioEngine.voice)
  }, [])
}
