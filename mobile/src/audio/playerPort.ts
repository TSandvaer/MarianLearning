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
  /** Release the native player. Removed players are dropped from
   *  expo-audio's registry, so its foreground auto-resume skips them. */
  remove(): void
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
