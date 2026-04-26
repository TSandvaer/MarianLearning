export { default as DebugOverlay } from './DebugOverlay'
export { isDebugEnabled } from './isDebugEnabled'
export {
  recordSpeakAttempt,
  recordSpeakStatus,
  recordTap,
  recordRawTapEvent,
  recordGateState,
  recordAudioCtxEvent,
  readGateState,
  subscribe,
  snapshot,
  _resetForTests,
} from './debugBus'
export type {
  DebugSnapshot,
  SpeakAttemptRecord,
  SpeakStatus,
  TapEventRecord,
  TapEventType,
  RawTapEventRecord,
  RawTapEventType,
  GateStateName,
  AudioCtxState,
  AudioCtxEventRecord,
} from './debugBus'
export {
  startAudioContextProbe,
  activateAudioContextProbe,
  sampleAudioCtxOnTap,
  recordSpeakCallEvent,
  recordSpeakOnPlayEvent,
  recordSpeakSkippedEvent,
  recordHandlerErrorEvent,
  AUDIO_CTX_LOG_STORAGE_KEY,
  _resetAudioContextProbeForTests,
} from './audioContextProbe'
export type {
  AudioContextProbeHandle,
  AudioContextProbeOptions,
} from './audioContextProbe'
