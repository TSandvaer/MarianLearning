export { default as DebugOverlay } from './DebugOverlay'
export { isDebugEnabled } from './isDebugEnabled'
export { emitBundleInit } from './bundleInit'
export { getPlayerKind } from './playerKind'
export type { PlayerKindTagged } from './playerKind'
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
  recordUnlockStateEvent,
  recordBundleInitEvent,
  recordAudioReadyStateEvent,
  recordPathASettleEvent,
  recordPlayUtteranceDispatchEvent,
  recordHowlPlayCallEvent,
  recordHowlPlayEventEvent,
  recordHowlEndEventEvent,
  recordHowlLoaderrorEventEvent,
  AUDIO_CTX_LOG_STORAGE_KEY,
  _resetAudioContextProbeForTests,
} from './audioContextProbe'
export type {
  AudioContextProbeHandle,
  AudioContextProbeOptions,
  UnlockStateExtra,
  BundleInitInfo,
  HowlPlayCallInfo,
} from './audioContextProbe'
