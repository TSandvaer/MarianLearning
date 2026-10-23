/**
 * Bundled MP3s, looked up by the URL path the web uses (`/assets/audio/
 * greet/greet-01-hi.mp3`, `HUB_LINES[id].src`, `PathLine.src`, ...), so
 * native code passes core's manifest values straight through; and the
 * bundled canon clips, looked up by the text they speak.
 */
import { WEB_AUDIO_MODULES } from './audioRegistry'
import { CANON_AUDIO_BYTES, CANON_AUDIO_MODULES } from './canonAudioRegistry'

/** A bundled audio module (`require('…mp3')`). */
export type NativeAudio = number

export function audioForWebPath(webPath: string): NativeAudio | undefined {
  return Object.prototype.hasOwnProperty.call(WEB_AUDIO_MODULES, webPath)
    ? WEB_AUDIO_MODULES[webPath]
    : undefined
}

/** A bundled canon clip and its byte length. */
export interface BundledClip {
  module: NativeAudio
  bytes: number
}

/** The bundled canon clip that speaks `text` (one per text). */
export function canonClipFor(text: string): BundledClip | undefined {
  return Object.prototype.hasOwnProperty.call(CANON_AUDIO_MODULES, text)
    ? { module: CANON_AUDIO_MODULES[text]!, bytes: CANON_AUDIO_BYTES[text]! }
    : undefined
}
