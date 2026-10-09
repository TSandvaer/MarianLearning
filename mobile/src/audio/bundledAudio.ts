/**
 * Bundled MP3s, looked up by the URL path the web uses (`/assets/audio/
 * greet/greet-01-hi.mp3`, `HUB_LINES[id].src`, `PathLine.src`, ...), so
 * native code passes core's manifest values straight through.
 */
import { WEB_AUDIO_MODULES } from './audioRegistry'

/** A bundled audio module (`require('…mp3')`). */
export type NativeAudio = number

export function audioForWebPath(webPath: string): NativeAudio | undefined {
  return Object.prototype.hasOwnProperty.call(WEB_AUDIO_MODULES, webPath)
    ? WEB_AUDIO_MODULES[webPath]
    : undefined
}
