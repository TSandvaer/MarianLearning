/**
 * Sound-effects helper, backed by Howler.
 *
 * Howler is preferred over `<audio>` for two reasons:
 *  1. iPad Safari's HTMLAudioElement has notoriously high first-tap latency;
 *     Howler routes through Web Audio when available, which is sub-frame.
 *  2. Howler's `onloaderror` lets us treat a missing file as a soft warning
 *     instead of an unhandled rejection.
 *
 * Defensive 404 handling
 * ----------------------
 * Some Session 1 SFX assets are still pending Thomas's audio sourcing pass —
 * notably `sfx-chime-soft.mp3` (see `public/assets/assets-todo.md`). Until they
 * land, the screen logic must work without audio: silence is the correct
 * fallback, not a thrown error. Each `Sfx` instance loads lazily on first
 * `play()` and remembers its load state. If load fails (HTTP 404, decode
 * error), `play()` becomes a no-op that increments a missed-play counter the
 * tests can assert against, and we log a single console.warn pointing at the
 * TODO doc — one warning per asset, not per play, so this never spams the dev
 * console during a session.
 */

import { Howl } from 'howler'

export interface SfxOptions {
  /** Public-relative URL. Howler will fetch this on first play(). */
  src: string
  /** Volume 0..1. Defaults to 1.0. */
  volume?: number
  /**
   * Test seam: factory that produces a Howl-shaped object. Production code
   * passes the real Howl constructor; tests inject a fake.
   */
  HowlCtor?: typeof Howl
}

/**
 * Minimal Howl-shape we depend on. Avoids leaking the entire howler type
 * surface into call sites and gives tests a tiny target to fake.
 */
export interface HowlLike {
  play: () => number
  unload?: () => void
  state?: () => 'unloaded' | 'loading' | 'loaded'
}

export interface Sfx {
  /**
   * Play the SFX. Returns true if the play call was issued to the audio
   * engine, false if the asset failed to load (or the engine is unavailable).
   */
  play: () => boolean
  /** Tear down the Howl, releasing the decoded buffer. Idempotent. */
  unload: () => void
  /**
   * For tests / observability: number of `play()` calls that no-oped because
   * the asset was missing.
   */
  readonly missedPlays: number
  /** True once we've observed a load error. Latches; never flips back. */
  readonly loadFailed: boolean
}

/**
 * Create a lazy SFX handle. Howl construction triggers an immediate XHR for
 * the asset — that's fine on app boot for assets we know exist, and benign
 * for assets we don't (we just log + remember the failure).
 */
export function createSfx(opts: SfxOptions): Sfx {
  const HowlCtor = opts.HowlCtor ?? Howl
  let missedPlays = 0
  let loadFailed = false
  let warned = false

  let howl: HowlLike | null = null
  try {
    howl = new HowlCtor({
      src: [opts.src],
      volume: opts.volume ?? 1.0,
      preload: true,
      // Howler's typings call this "loaderror" — payload is (id, err).
      onloaderror: () => {
        loadFailed = true
        if (!warned) {
          warned = true
          console.warn(
            `[sfx] Failed to load "${opts.src}" — playing silently. ` +
              `See public/assets/assets-todo.md for sourcing notes.`,
          )
        }
      },
    }) as unknown as HowlLike
  } catch (err) {
    // Howler can throw synchronously if no audio backend is available
    // (vitest jsdom, locked-down CI). Same behaviour as a load failure.
    loadFailed = true
    if (!warned) {
      warned = true
      console.warn(
        `[sfx] Howler unavailable for "${opts.src}" (${
          err instanceof Error ? err.message : 'unknown'
        }) — playing silently.`,
      )
    }
  }

  return {
    play(): boolean {
      if (loadFailed || !howl) {
        missedPlays += 1
        return false
      }
      try {
        howl.play()
        return true
      } catch (err) {
        // A play() throwing here is unusual but possible if the engine
        // was torn down mid-session. Treat as a missed play.
        missedPlays += 1
        if (!warned) {
          warned = true
          console.warn(
            `[sfx] play() threw for "${opts.src}" (${
              err instanceof Error ? err.message : 'unknown'
            }) — continuing silently.`,
          )
        }
        return false
      }
    },
    unload(): void {
      howl?.unload?.()
      howl = null
    },
    get missedPlays() {
      return missedPlays
    },
    get loadFailed() {
      return loadFailed
    },
  }
}
