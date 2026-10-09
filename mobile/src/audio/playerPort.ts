/**
 * The slice of expo-audio's `AudioPlayer` the engine uses, plus the one
 * factory that creates real players. Everything else in `src/audio/`
 * depends on `PlayerLike` / `PlayerFactory`, so jest drives the engine
 * with a fake player and no native module.
 */
import {
  createAudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio'
import { isAudioMuted } from './mute'
import { STATUS_INTERVAL_MS } from './captionClock'

/** The status fields the engine reads (a subset of expo-audio's). */
export type PlayerStatus = Pick<
  AudioStatus,
  'playing' | 'currentTime' | 'duration' | 'didJustFinish' | 'isLoaded'
> & { error?: string | null }

export interface PlayerSubscription {
  remove(): void
}

export interface PlayerLike {
  play(): void
  pause(): void
  seekTo(seconds: number): Promise<void>
  /**
   * Drop the player from expo-audio's registry, so the library's own
   * foreground / focus-gain auto-resume skips it. Does NOT free the native
   * player (AVPlayer / ExoPlayer and its Android MP3 decoder): that is
   * `release()`. Use {@link disposePlayer}, which calls both.
   */
  remove(): void
  /** `SharedObject.release()`: frees the native player now, not at GC. */
  release(): void
  readonly playing: boolean
  readonly currentTime: number
  readonly duration: number
  muted: boolean
  volume: number
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: PlayerStatus) => void,
  ): PlayerSubscription
}

/** A bundled asset (`require('x.mp3')`) or a `file://` URI. */
export type PlayerSource = number | { uri: string }

export type PlayerFactory = (source: PlayerSource) => PlayerLike

/**
 * Dispose a player for good: out of expo-audio's registry (no native
 * auto-resume) and its native player freed (iOS
 * `sharedObjectWillRelease`, Android `releasePlayer()` → ExoPlayer
 * `release()`, which frees the MP3 decoder). Best effort, never throws.
 */
export function disposePlayer(player: PlayerLike): void {
  try {
    player.remove()
  } catch {
    // Already out of the registry.
  }
  try {
    player.release()
  } catch {
    // Already released.
  }
}

/**
 * Production factory: a 50 ms status interval (the caption clock needs
 * it) and the mute flag applied to every player it creates.
 */
export const createExpoPlayer: PlayerFactory = (source) => {
  const player = createAudioPlayer(source as AudioSource, {
    updateInterval: STATUS_INTERVAL_MS,
  })
  if (isAudioMuted()) player.muted = true
  return player as unknown as PlayerLike
}
