/**
 * Native port of the web's `src/lib/sfx/sfx.ts`: short sound effects
 * (chime, sparkle, plink, poof, cheer).
 *
 * Same contract: `createSfx({ src, volume })` → `{ play, unload,
 * missedPlays, loadFailed }`. `src` is the web URL path
 * (`/assets/sfx-sparkle.mp3`). A clip that is not bundled or fails to load
 * plays silently: `play()` returns `false`, bumps `missedPlays`, and one
 * `console.warn` per asset says so.
 *
 * Native specifics:
 * - One player per SFX, created at `createSfx` time (like the web's
 *   `preload: true`). SFX are not on Emma's voice channel: a chime may
 *   sound over her, as on the web.
 * - The player rewinds itself when a clip ends, so the next `play()` is a
 *   plain `play()`. A `play()` during playback restarts the clip (Howler
 *   would overlap a second copy; for 0.1–0.7 s effects the restart is
 *   inaudible as a difference).
 * - While the app is hidden `play()` drops the effect (returns `false`,
 *   not counted as a miss): an effect answers a tap, and no tap happens in
 *   the background.
 */
import { recordAudio } from './audioLog'
import { audioForWebPath } from './bundledAudio'
import { audioEngine, type AudioEngine } from './engine'
import { disposePlayer, type PlayerLike, type PlayerStatus } from './playerPort'

export interface SfxOptions {
  /** Web URL path of the effect, e.g. `/assets/sfx-chime-soft.mp3`. */
  src: string
  /** 0..1, default 1. */
  volume?: number
  /** Test seam. */
  engine?: AudioEngine
}

export interface Sfx {
  play(): boolean
  unload(): void
  readonly missedPlays: number
  readonly loadFailed: boolean
}

export function createSfx(opts: SfxOptions): Sfx {
  const engine = opts.engine ?? audioEngine
  let missedPlays = 0
  let loadFailed = false
  let warned = false
  let player: PlayerLike | null = null
  let sub: { remove(): void } | null = null
  /** `Date.now()` of the last play() still waiting for `playing`. */
  let pendingPlayAt: number | null = null
  const label = `sfx:${opts.src.replace(/^.*\/sfx-|\.mp3$/g, '')}`

  const warn = (why: string) => {
    if (warned) return
    warned = true
    console.warn(`[sfx] ${why} for "${opts.src}" — playing silently.`)
  }

  const source = audioForWebPath(opts.src)
  if (source === undefined) {
    loadFailed = true
    warn('no bundled clip')
  } else {
    try {
      player = engine.createPlayer(source)
      player.volume = opts.volume ?? 1
      sub = player.addListener('playbackStatusUpdate', (s: PlayerStatus) => {
        if (s.error) {
          loadFailed = true
          warn(`load error (${s.error})`)
          return
        }
        if (pendingPlayAt !== null && (s.playing || s.didJustFinish)) {
          recordAudio({ kind: 'onplay', label, ms: Date.now() - pendingPlayAt })
          pendingPlayAt = null
        }
        if (s.didJustFinish) {
          void player?.seekTo(0).catch(() => {})
        }
      })
    } catch (err) {
      loadFailed = true
      player = null
      warn(
        `player unavailable (${err instanceof Error ? err.message : 'unknown'})`,
      )
    }
  }

  return {
    play() {
      if (loadFailed || !player) {
        missedPlays += 1
        return false
      }
      if (engine.voice.hidden) return false
      const p = player
      pendingPlayAt = Date.now()
      try {
        if (p.playing || p.currentTime > 0) {
          void p
            .seekTo(0)
            .then(() => p.play())
            .catch(() => {})
        } else {
          p.play()
        }
        return true
      } catch (err) {
        missedPlays += 1
        warn(`play() threw (${err instanceof Error ? err.message : 'unknown'})`)
        return false
      }
    },
    unload() {
      sub?.remove()
      sub = null
      // Registry out and native player (Android: MP3 decoder) freed now.
      if (player) disposePlayer(player)
      player = null
    },
    get missedPlays() {
      return missedPlays
    },
    get loadFailed() {
      return loadFailed
    },
  }
}

/** The five effects the web uses, by name. */
export const SFX_SOURCES = {
  cheer: '/assets/sfx-cheer.mp3',
  chime: '/assets/sfx-chime-soft.mp3',
  plink: '/assets/sfx-plink.mp3',
  poof: '/assets/sfx-poof.mp3',
  sparkle: '/assets/sfx-sparkle.mp3',
} as const
