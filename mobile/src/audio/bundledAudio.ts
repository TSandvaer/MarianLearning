/**
 * Bundled MP3s, looked up by the URL path the web uses (`/assets/audio/
 * greet/greet-01-hi.mp3`, `HUB_LINES[id].src`, `PathLine.src`, ...), so
 * native code passes core's manifest values straight through; and the
 * bundled canon clips, looked up by the text they speak.
 */
import { WEB_AUDIO_MODULES } from './audioRegistry'
import {
  CANON_AUDIO_BYTES,
  CANON_AUDIO_HASHES,
  CANON_AUDIO_MODULES,
} from './canonAudioRegistry'

/** A bundled audio module (`require('…mp3')`). */
export type NativeAudio = number

export function audioForWebPath(webPath: string): NativeAudio | undefined {
  return Object.prototype.hasOwnProperty.call(WEB_AUDIO_MODULES, webPath)
    ? WEB_AUDIO_MODULES[webPath]
    : undefined
}

/** A bundled canon clip, its byte length and its {@link clipHash}. */
export interface BundledClip {
  module: NativeAudio
  bytes: number
  hash: number
}

/** The bundled canon clip that speaks `text` (one per text). */
export function canonClipFor(text: string): BundledClip | undefined {
  return Object.prototype.hasOwnProperty.call(CANON_AUDIO_MODULES, text)
    ? {
        module: CANON_AUDIO_MODULES[text]!,
        bytes: CANON_AUDIO_BYTES[text]!,
        hash: CANON_AUDIO_HASHES[text]!,
      }
    : undefined
}

/**
 * A clip's content hash: 32-bit FNV-1a over its base64 string, the form
 * the server sends (canon base64 verbatim), so nothing is decoded on
 * device. `scripts/export-audio.mjs` has the same function for the
 * registry; `audioRegistry.test.ts` checks the two agree on every line.
 */
export function clipHash(base64: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < base64.length; i++) {
    h = Math.imul(h ^ base64.charCodeAt(i), 0x01000193)
  }
  return h >>> 0
}
