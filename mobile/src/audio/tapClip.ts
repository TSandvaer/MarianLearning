/**
 * Word Song's tap sounds (`design/native/word-song-native.md` § 4): a
 * stretch of a session clip (a letter's segment of the blend, or its whole
 * word), played on its own player OUTSIDE Emma's voice channel, so it has
 * no queue and never cuts her. The screen cuts it before Emma's next line
 * and on a chip tap; a new tap cuts the sound in flight.
 *
 * It stops, and does not resume, when the app goes to the background: the
 * player is released (out of expo-audio's registry), so the library's own
 * foreground auto-resume cannot bring it back.
 *
 * The stop lands up to one status interval (50 ms) after `toMs`; the
 * windows end 80 ms into ≥ 300 ms of silence, so it lands in silence.
 */
import type { AudioEngine } from './engine'
import {
  disposePlayer,
  type PlayerLike,
  type PlayerSubscription,
} from './playerPort'

export interface TapClipPlayer {
  /**
   * Play `uri` from `fromMs` to `toMs` (null: to its end). Cuts a sound in
   * flight. `onEnd` runs once when this sound stops for any reason.
   */
  play(
    uri: string,
    fromMs: number,
    toMs: number | null,
    onEnd?: () => void,
  ): void
  /** Stop the sound in flight (no-op when silent). */
  cut(): void
  /** Stop and free the player (background, unmount). */
  release(): void
  readonly playing: boolean
}

export function createTapClipPlayer(engine: AudioEngine): TapClipPlayer {
  let player: PlayerLike | null = null
  let playerUri: string | null = null
  let sub: PlayerSubscription | null = null
  let onEndCurrent: (() => void) | null = null
  let token = 0

  const finish = () => {
    sub?.remove()
    sub = null
    const end = onEndCurrent
    onEndCurrent = null
    end?.()
  }

  const cut = () => {
    if (onEndCurrent === null && sub === null) return
    token += 1
    try {
      player?.pause()
    } catch {
      // A released player may refuse; nothing plays either way.
    }
    finish()
  }

  return {
    play(uri, fromMs, toMs, onEnd) {
      cut()
      if (player === null || playerUri !== uri) {
        if (player) disposePlayer(player)
        player = engine.createPlayer({ uri })
        playerUri = uri
      }
      const p = player
      const mine = ++token
      onEndCurrent = onEnd ?? null
      sub = p.addListener('playbackStatusUpdate', (status) => {
        if (mine !== token) return
        const reachedEnd =
          status.didJustFinish ||
          (toMs !== null && status.playing && status.currentTime * 1000 >= toMs)
        if (!reachedEnd) return
        token += 1
        try {
          p.pause()
        } catch {
          // Already stopped.
        }
        finish()
      })
      void p
        .seekTo(fromMs / 1000)
        .catch(() => {})
        .then(() => {
          if (mine !== token) return
          try {
            p.play()
          } catch {
            token += 1
            finish()
          }
        })
    },
    cut,
    release() {
      cut()
      if (player) disposePlayer(player)
      player = null
      playerUri = null
    },
    get playing() {
      return onEndCurrent !== null || sub !== null
    },
  }
}
