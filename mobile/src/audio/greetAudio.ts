/**
 * Native port of `src/lib/audio/preRecorded.ts` (552 lines; ~300 of them are
 * Howler / iOS-WebKit unlock instrumentation that has no native equivalent).
 *
 * Same contract: `playGreetLine(key, { onPlay, onWordTick })` returns a
 * promise that resolves at the line's end and rejects on cancel/failure.
 * The text-keyed `speakGreetLine` adapter is what the web Greet's
 * `playLineAdapter` does, so the reused `runGreetSequence` can drive it.
 */
import type { AudioPlayer } from 'expo-audio'
import { GREET_LINES, type SpeakFn } from '../reuse'
import {
  countWords,
  makePlayer,
  playWithCaptions,
  type Playback,
  type PlayOptions,
} from './captionPlayer'

export type GreetLineKey = 'hi' | 'imEmma' | 'niceToMeet' | 'tapHeart'

const SOURCES: Record<GreetLineKey, number> = {
  hi: require('../../assets/audio/greet/greet-01-hi.mp3'),
  imEmma: require('../../assets/audio/greet/greet-02-im-emma.mp3'),
  niceToMeet: require('../../assets/audio/greet/greet-03-nice-to-meet-you.mp3'),
  tapHeart: require('../../assets/audio/greet/greet-04-tap-the-heart.mp3'),
}

/** Same bridge as the web Greet's LINE_TEXT_TO_KEY. */
const LINE_TEXT_TO_KEY: Record<string, GreetLineKey> = {
  [GREET_LINES[0]]: 'hi',
  [GREET_LINES[1]]: 'imEmma',
  [GREET_LINES[2]]: 'niceToMeet',
  [GREET_LINES[3]]: 'tapHeart',
}

let players: Record<GreetLineKey, AudioPlayer> | null = null
let active: Playback | null = null

/**
 * Create (and start loading) the four players. Called by App during Splash
 * so the files are decoded before Greet's first line.
 */
export function preloadGreetAudio(): void {
  if (players) return
  players = {
    hi: makePlayer(SOURCES.hi),
    imEmma: makePlayer(SOURCES.imEmma),
    niceToMeet: makePlayer(SOURCES.niceToMeet),
    tapHeart: makePlayer(SOURCES.tapHeart),
  }
}

export function playGreetLine(
  key: GreetLineKey,
  text: string,
  opts?: PlayOptions,
): Promise<void> {
  preloadGreetAudio()
  cancelGreetAudio()
  const playback = playWithCaptions(players![key], countWords(text), opts)
  active = playback
  return playback.done.finally(() => {
    if (active === playback) active = null
  })
}

/** `SpeakFn` for the reused `runGreetSequence` / `speakReprompt`. */
export const speakGreetLine: SpeakFn = (text, opts) => {
  const key = LINE_TEXT_TO_KEY[text]
  if (!key) {
    return Promise.reject(new Error(`[greetAudio] no key for "${text}"`))
  }
  const words = text.split(/\s+/).filter(Boolean)
  return playGreetLine(key, text, {
    onPlay: opts?.onStart,
    onWordTick: opts?.onBoundary
      ? (wordIndex) =>
          opts.onBoundary?.({
            wordIndex,
            word: words[wordIndex] ?? '',
            charIndex: 0,
          })
      : undefined,
  })
}

export function cancelGreetAudio(): void {
  active?.cancel()
  active = null
}

export function releaseGreetAudio(): void {
  cancelGreetAudio()
  if (!players) return
  for (const p of Object.values(players)) p.remove()
  players = null
}
