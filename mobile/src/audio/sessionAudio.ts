/**
 * Native port of the Path A session-audio path (`src/lib/audio/sessionAudio.ts`
 * + the text-keyed lookup in `mathPathA.ts`).
 *
 * Web: base64 -> Blob -> blob: URL -> Howl({ format: ['mp3'] }).
 * Native: base64 -> file in the cache directory (expo-file-system) -> file://
 * URI -> expo-audio player. No IndexedDB cache layer in the spike.
 */
import type { AudioPlayer } from 'expo-audio'
import { Directory, File, Paths } from 'expo-file-system'
import type { Utterance } from '../reuse'
import {
  countWords,
  makePlayer,
  playWithCaptions,
  type Playback,
  type PlayOptions,
} from './captionPlayer'

let textToPlayer = new Map<string, AudioPlayer>()
let allPlayers: AudioPlayer[] = []
let active: Playback | null = null

function safeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Write each utterance's MP3 to `<cache>/session-audio/<id>.mp3` and build
 * one player per file. Duplicate texts resolve to the first id, exactly
 * like `mathPathA.ts` (the server renders byte-identical MP3s for them).
 * Returns the files written, for the on-screen debug line.
 */
export function loadSessionAudio(utterances: readonly Utterance[]): {
  files: number
  bytes: number
} {
  releaseSessionAudio()
  const dir = new Directory(Paths.cache, 'session-audio')
  dir.create({ intermediates: true, idempotent: true })
  let bytes = 0
  for (const u of utterances) {
    const file = new File(dir, `${safeName(u.id)}.mp3`)
    file.create({ overwrite: true })
    file.write(u.audio.base64, { encoding: 'base64' })
    bytes += file.size
    const player = makePlayer({ uri: file.uri })
    allPlayers.push(player)
    if (!textToPlayer.has(u.text)) textToPlayer.set(u.text, player)
  }
  return { files: utterances.length, bytes }
}

/**
 * Same contract as the web's `playUtterance(text, { onPlay, onWordTick })`.
 * Unknown text fails soft like the web: ticks every word, resolves silently.
 */
export function playSessionText(
  text: string,
  opts?: PlayOptions,
): Promise<void> {
  cancelSessionAudio()
  const player = textToPlayer.get(text)
  if (!player) {
    opts?.onPlay?.()
    for (let i = 0; i < countWords(text); i++) opts?.onWordTick?.(i)
    return Promise.resolve()
  }
  const playback = playWithCaptions(player, countWords(text), opts)
  active = playback
  return playback.done.finally(() => {
    if (active === playback) active = null
  })
}

export function cancelSessionAudio(): void {
  active?.cancel()
  active = null
}

export function releaseSessionAudio(): void {
  cancelSessionAudio()
  for (const p of allPlayers) p.remove()
  allPlayers = []
  textToPlayer = new Map()
}
