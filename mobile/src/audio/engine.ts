/**
 * The native audio engine: a player cache per clip plus Emma's voice
 * channel. Greet, Hub/path lines and session audio all speak through one
 * engine, so one line plays at a time across them; SFX use the engine's
 * player factory but not the voice channel (a chime may sound over Emma,
 * as on the web).
 *
 * Every dependency is injectable (`createAudioEngine({ createPlayer })`);
 * the app uses the module-level `audioEngine`.
 */
import { recordAudio } from './audioLog'
import { startLine, type LineCallbacks, type LineHandle } from './linePlayback'
import {
  createExpoPlayer,
  type PlayerFactory,
  type PlayerLike,
  type PlayerSource,
} from './playerPort'
import { createVoiceChannel, type VoiceChannel } from './voiceChannel'

export interface SpeakOptions extends LineCallbacks {
  /** Caption text (drives the word ticks). */
  text: string
  /** Diagnostic label for the latency log. */
  label: string
}

export interface AudioEngine {
  /** The engine's player factory (mute flag + 50 ms status interval). */
  readonly createPlayer: PlayerFactory
  readonly voice: VoiceChannel
  /** Create (and start loading) the player for a clip, without playing. */
  preload(key: string, source: PlayerSource): void
  /**
   * Speak a clip as Emma's line. Resolves at the clip's end; rejects with
   * `Error('cancelled')` when another line or `cancelVoice()` replaces it,
   * `Error('start-timeout')` or the player's error otherwise.
   */
  speak(key: string, source: PlayerSource, opts: SpeakOptions): Promise<void>
  /** Stop Emma (the line in flight and any queued line). */
  cancelVoice(): void
  /** Release one clip's player (it is recreated on the next use). */
  release(key: string): void
  /** Release every clip whose key starts with `prefix`. */
  releasePrefix(prefix: string): void
  /** Keys with a live player, for tests and diagnostics. */
  loadedKeys(): string[]
}

export interface CreateAudioEngineOptions {
  createPlayer?: PlayerFactory
  voice?: VoiceChannel
  now?: () => number
}

export function createAudioEngine(
  opts: CreateAudioEngineOptions = {},
): AudioEngine {
  const createPlayer = opts.createPlayer ?? createExpoPlayer
  const voice = opts.voice ?? createVoiceChannel()
  const players = new Map<string, PlayerLike>()

  function playerFor(key: string, source: PlayerSource): PlayerLike {
    const cached = players.get(key)
    if (cached) return cached
    const player = createPlayer(source)
    players.set(key, player)
    return player
  }

  function release(key: string): void {
    const player = players.get(key)
    if (!player) return
    players.delete(key)
    try {
      player.remove()
    } catch {
      // Already released.
    }
  }

  return {
    createPlayer,
    voice,
    preload(key, source) {
      playerFor(key, source)
    },
    speak(key, source, speakOpts) {
      return new Promise<void>((resolve, reject) => {
        voice.play({
          label: speakOpts.label,
          start: (): LineHandle => {
            const handle = startLine(playerFor(key, source), {
              text: speakOpts.text,
              label: speakOpts.label,
              onPlay: speakOpts.onPlay,
              onWordTick: speakOpts.onWordTick,
              now: opts.now,
              onLatency: (ms, label) =>
                recordAudio({ kind: 'onplay', label, ms }),
            })
            handle.done.then(resolve, reject)
            return handle
          },
          onSuperseded: () => reject(new Error('cancelled')),
          release: () => release(key),
        })
      })
    },
    cancelVoice() {
      voice.cancelAll()
    },
    release,
    releasePrefix(prefix) {
      for (const key of Array.from(players.keys())) {
        if (key.startsWith(prefix)) release(key)
      }
    },
    loadedKeys() {
      return Array.from(players.keys())
    },
  }
}

/** The app's engine. */
export const audioEngine: AudioEngine = createAudioEngine()
