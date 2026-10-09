/**
 * The native audio engine (Phase 2b). Screens import from here only.
 *
 * | Web module                          | Native                                   |
 * | ----------------------------------- | ---------------------------------------- |
 * | `lib/audio/preRecorded.ts`          | `playGreetLine`, `loadGreetAudio`, ...   |
 * | `screens/Hub/playHubLine.ts`        | `playHubLine`, `createManifestLinePlayer`|
 * | `screens/Map/playMapLine.ts`        | `createPathLinePlayer`                   |
 * | `lib/audio/sessionAudio.ts` +       | `startSession`, `loadSessionAudio`,      |
 * | `mathPathA.ts` / `wordSongPathA.ts` | `LoadedSessionAudio.playUtterance`       |
 * | `lib/audio/hubSessionPrefetch.ts`   | `sessionPrefetcher`                      |
 * | `lib/sfx/sfx.ts`                    | `createSfx`, `SFX_SOURCES`               |
 * | `useHowlerSuspendOnHide` +          | `useAudioEngine` (lifecycle + session)   |
 * | `pendingResumeGate.ts`              |                                          |
 */
export { countWords, wordIndexAt, STATUS_INTERVAL_MS } from './captionClock'
export type { LineCallbacks } from './linePlayback'
export { audioEngine, createAudioEngine } from './engine'
export type { AudioEngine } from './engine'
export {
  playGreetLine,
  loadGreetAudio,
  cancelGreetAudio,
  unloadGreetAudio,
  createGreetAudio,
  GREET_LINE_SOURCES,
  GREET_LINE_TEXT,
} from './greetAudio'
export type { GreetLineKey, GreetAudio } from './greetAudio'
export {
  playHubLine,
  cancelActiveHubLine,
  unloadHubLines,
  createManifestLinePlayer,
  createPathLinePlayer,
  CAPTION_WALK_MS_PER_WORD,
} from './manifestLines'
export type {
  ManifestLine,
  ManifestLinePlayer,
  PathLinePlayer,
  PlayablePathLine,
} from './manifestLines'
export { createSfx, SFX_SOURCES } from './sfx'
export type { Sfx, SfxOptions } from './sfx'
export {
  loadSessionAudio,
  currentSessionAudio,
  sweepSessionAudioCache,
} from './sessionAudio'
export type { LoadedSessionAudio } from './sessionAudio'
export { startSession, SessionStartError } from './sessionStart'
export type {
  PreparedSession,
  SessionStartArgs,
  SessionStartErrorCode,
  SessionStartPayload,
  SessionTrack,
} from './sessionStart'
export {
  sessionPrefetcher,
  createSessionPrefetcher,
  samePrefetchKey,
} from './sessionPrefetch'
export type { PrefetchKey, SessionPrefetcher } from './sessionPrefetch'
export { useAudioEngine, configureAudioSession, AUDIO_MODE } from './lifecycle'
export { isAudioMuted } from './mute'
export { readAudioLog } from './audioLog'
export type { AudioLogRow } from './audioLog'
