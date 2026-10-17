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
export { createTapClipPlayer } from './tapClip'
export type { TapClipPlayer } from './tapClip'
export {
  blendMarksFor,
  blendRevealAt,
  letterWindow,
  litAt,
  wordWindow,
} from './blendMarks'
export type { Segment } from './blendMarks'
export {
  sentenceOfWord,
  STORY_MARK_LEAD_MS,
  STORY_READ_ALONG,
  storyLitAt,
  storyMarksFor,
  storyWordStarts,
} from './storyMarks'
export {
  STORY_READ_LINE,
  storyGuidePlayer,
  storyWordLineId,
  storyWordPlayer,
} from './storyGuide'
export type { StoryGuideLineId, StoryGuidePlayer } from './storyGuide'
export { useAudioEngine, configureAudioSession, AUDIO_MODE } from './lifecycle'
export { isAudioMuted } from './mute'
export { readAudioLog, recordAudio } from './audioLog'
export type { AudioLogRow } from './audioLog'
export {
  introGuideLine,
  KNEW_GAP_MS,
  leadLinesForRound,
  PEEK_CLOSE_GAP_MS,
  peekGuideLines,
  replayGuideLines,
  sessionGuideLine,
  sessionGuidePlayer,
  SESSION_GUIDE_GAP_MS,
  SESSION_GUIDE_MANIFEST,
} from './sessionGuide'
export type {
  IntroGuideLineId,
  PeekGuideLineId,
  ReplayGuideLineId,
  RoundLeadContext,
  SessionGuideLineId,
  SessionGuidePlayer,
} from './sessionGuide'
