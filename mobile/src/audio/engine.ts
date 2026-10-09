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

/**
 * Live voice players at most (least recently used ones are released).
 *
 * On Android every prepared expo-audio player holds its own MP3 decoder
 * (`c2.android.mp3.decoder`). On the API 37 emulator, 53 players created
 * at once failed with `Decoder init failed` in logcat, and a one-by-one
 * probe loaded 11 before the 12th stalled. 4 voice players plus the ≤5
 * SFX a screen holds stays under that. Greet's 4 lines fit exactly.
 */
export const MAX_LIVE_VOICE_PLAYERS = 4

export interface CreateAudioEngineOptions {
  createPlayer?: PlayerFactory
  voice?: VoiceChannel
  now?: () => number
  /** Default {@link MAX_LIVE_VOICE_PLAYERS}. */
  maxPlayers?: number
}

export function createAudioEngine(
  opts: CreateAudioEngineOptions = {},
): AudioEngine {
  const createPlayer = opts.createPlayer ?? createExpoPlayer
  const voice = opts.voice ?? createVoiceChannel()
  const maxPlayers = Math.max(1, opts.maxPlayers ?? MAX_LIVE_VOICE_PLAYERS)
  /** Insertion order = recency: the first key is the least recently used. */
  const players = new Map<string, PlayerLike>()
  /** The clip of the line in flight; never evicted. */
  let activeKey: string | null = null
  let activeToken: object | null = null

  function playerFor(key: string, source: PlayerSource): PlayerLike {
    const cached = players.get(key)
    if (cached) {
      players.delete(key)
      players.set(key, cached)
      return cached
    }
    for (const lru of Array.from(players.keys())) {
      if (players.size < maxPlayers) break
      if (lru !== activeKey) release(lru)
    }
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
            const token = {}
            activeKey = key
            activeToken = token
            const handle = startLine(playerFor(key, source), {
              text: speakOpts.text,
              label: speakOpts.label,
              onPlay: speakOpts.onPlay,
              onWordTick: speakOpts.onWordTick,
              now: opts.now,
              onLatency: (ms, label) =>
                recordAudio({ kind: 'onplay', label, ms }),
            })
            const settled = () => {
              if (activeToken !== token) return
              activeKey = null
              activeToken = null
            }
            handle.done.then(settled, settled)
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
