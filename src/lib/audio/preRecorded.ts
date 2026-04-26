/**
 * Pre-recorded audio playback for fixed Greet lines.
 *
 * Background — why this module exists alongside `lib/tts`
 * -------------------------------------------------------
 * After 5 rounds of band-aiding iPad Safari's Web Speech API (ticket
 * 86c9gp99a, PRs #18, #21, #22, #23, #24), real-device QA on 2026-04-25
 * confirmed the documented "first-speak unreliable" pattern is not solvable
 * within Web Speech itself: a single tap → `speechSynthesis.speak()` is
 * silently rejected by the engine 4-5 times over ~25s before one finally
 * fires. Once one fires, the rest of the session works.
 *
 * The 4 Greet lines are FIXED text (never change session-to-session), so
 * pre-recorded MP3s through Howler.js sidesteps the whole synthesis-engine
 * flakiness. Howler still requires a user gesture for the first play on
 * iOS, but once that lands the `onplay` event fires within ~50ms — a 100×
 * improvement on first-utterance latency vs Web Speech.
 *
 * Web Speech (`lib/tts/*`) stays untouched: Math + Word Song lines are
 * dynamic (Claude-generated per session) and pre-recording isn't viable
 * there. This module is a SIBLING, not a replacement.
 *
 * Caption sync without `onboundary`
 * ---------------------------------
 * Pre-recorded audio doesn't fire word-boundary events the way Web Speech
 * does (when it works). We compensate with a linear timer: when playback
 * starts, divide `howl.duration()` by the word count and fire
 * `onWordTick(i)` at each interval. Spec design/session-1.md already
 * accepts a word-paced fallback at 165 wpm (boundary.ts FALLBACK_ARM_MS
 * lineage); we now have exact audio duration upfront so timing is more
 * accurate than the WPM heuristic.
 *
 * Voice provenance
 * ----------------
 * MP3s in `public/assets/audio/greet/` were generated 2026-04-25 with
 * `edge-tts` using voice `en-US-AnaNeural` (Microsoft's child-coded female
 * voice) at -10% rate. Tone approved by Thomas. To regenerate:
 *
 *   edge-tts --voice en-US-AnaNeural --rate=-10% \
 *     --text "Hi!" --write-media greet-01-hi.mp3
 *
 * Total asset budget: ~56 KB across the 4 lines, well under the ticket's
 * 200 KB ceiling.
 */

import { Howl } from 'howler'
import {
  recordSpeakCallEvent,
  recordSpeakOnPlayEvent,
} from '../debug/audioContextProbe'
import {
  awaitHowlerContextResume,
  type AwaitResumeOptions,
} from './howlerContext'

/**
 * Stable identifiers for the 4 fixed Greet lines. The orchestrator
 * (`greetSequence.ts`) maps line text → key via `GREET_LINE_KEYS`; this
 * keeps the line strings as the single source of truth in one place
 * (greetSequence) while letting this module key on a small enum.
 */
export type GreetLineKey = 'hi' | 'imMelody' | 'niceToMeet' | 'tapHeart'

/**
 * Source URL for each line. Public-relative paths so Vite's static-asset
 * pipeline serves them as-is (no bundler transform — they're real MP3s).
 */
const SOURCES: Record<GreetLineKey, string> = {
  hi: '/assets/audio/greet/greet-01-hi.mp3',
  imMelody: '/assets/audio/greet/greet-02-im-melody.mp3',
  niceToMeet: '/assets/audio/greet/greet-03-nice-to-meet-you.mp3',
  tapHeart: '/assets/audio/greet/greet-04-tap-the-heart.mp3',
}

/**
 * Word count per line — used to drive the caption tick interval. Must
 * match the GREET_LINES strings in `greetSequence.ts`. Tested-against to
 * prevent drift.
 */
const WORD_COUNTS: Record<GreetLineKey, number> = {
  hi: 1, // "Hi!"
  imMelody: 2, // "I'm Melody."
  niceToMeet: 6, // "It's so nice to meet you."
  tapHeart: 6, // "Tap the heart when you're ready."
}

/**
 * Minimal Howl-shape we depend on. Mirrors `lib/sfx/sfx.ts`'s `HowlLike`
 * but with the larger surface needed for full playback control: event
 * handlers, duration query, stop/play.
 */
export interface HowlLike {
  play: () => number
  stop: () => void
  duration: () => number
  on: (
    event: 'play' | 'end' | 'loaderror' | 'playerror',
    cb: (id?: number, err?: unknown) => void,
  ) => unknown
  off: (event: string) => unknown
  unload?: () => void
  state?: () => 'unloaded' | 'loading' | 'loaded'
}

export interface PlayGreetLineOptions {
  /**
   * Fires once when the Howl `play` event fires — i.e. the audio engine
   * has actually started decoding/emitting samples. Used by Greet to
   * clear the audio-unlock-gate watchdog without waiting for the line
   * to finish.
   */
  onPlay?: () => void
  /**
   * Fires for each word in the line as the linear timer advances. The
   * first tick (i=0) fires immediately on `play`, subsequent ticks at
   * `duration / wordCount` intervals.
   */
  onWordTick?: (wordIndex: number) => void
  /**
   * Test seam — defaults to `window.setInterval`.
   */
  schedule?: (cb: () => void, ms: number) => unknown
  /**
   * Test seam — defaults to `window.clearInterval`.
   */
  cancelSchedule?: (handle: unknown) => void
}

export interface PreRecordedAudio {
  loadGreetAudio: () => Promise<Record<GreetLineKey, HowlLike>>
  /**
   * Play a single Greet line by key. Returns a promise that resolves on
   * Howl `end` and rejects on `loaderror` / `playerror` / synchronous
   * `play()` throw / cancellation.
   *
   * **Caller responsibility for rejections (ticket 86c9gr43t).** This module
   * is intentionally minimal — it does not retry, fall back, or surface UI
   * on a load/play failure. The caller MUST attach a `.catch` (or surface
   * via an orchestrator hook like `runGreetSequence.onLineError`) and
   * decide the recovery story. Pre-86c9gr43t callers swallowed the
   * rejection in an empty catch, which produced GBUG-7's silent-halt
   * behaviour: a single bad MP3 froze the entire Greet sequence with no
   * UI signal.
   *
   * The rejection's `Error.message` includes the offending source URL
   * (e.g. `[preRecorded] loaderror for "/assets/audio/greet/greet-02-im-melody.mp3"`)
   * so iPad QA can trace which file failed without console access.
   */
  playGreetLine: (
    key: GreetLineKey,
    opts?: PlayGreetLineOptions,
  ) => Promise<void>
  cancel: () => void
  /** Tear down all cached Howls. Idempotent. Mostly for tests / unmount. */
  unload: () => void
}

export interface CreatePreRecordedOptions {
  /**
   * Test seam — Howl constructor. Production passes the real Howl ctor;
   * tests inject a fake.
   */
  HowlCtor?: typeof Howl
  /**
   * Test seam — Phase-4 (ticket 86c9gvd0y) audio-context-resume helper.
   * Awaited once per `playGreetLine` immediately before `Howl.play()` so
   * the buffer source binds against a `running` context, not a still-
   * suspended one. Production omits this and we use the real
   * `awaitHowlerContextResume` from `./howlerContext`.
   *
   * Tests inject a stub to (a) skip the real Howler/AudioContext (jsdom
   * has neither), and (b) assert call ordering against `Howl.play()`.
   */
  awaitContextResume?: (opts?: AwaitResumeOptions) => Promise<unknown> | unknown
}

/**
 * Build a pre-recorded-audio handle. Howl instances are created lazily on
 * the first `loadGreetAudio()` call and cached; subsequent calls return
 * the same map.
 *
 * Why not eagerly construct on module load? `new Howl({ src })` triggers
 * an immediate XHR for the asset. Doing that at module-import time would
 * couple Greet's audio to the entire app's startup cost (and to vitest's
 * jsdom which has no audio backend). Lazy-on-first-call lets Splash mount
 * before any audio I/O fires.
 */
export function createPreRecorded(
  opts: CreatePreRecordedOptions = {},
): PreRecordedAudio {
  const HowlCtor = opts.HowlCtor ?? Howl
  const awaitContextResume = opts.awaitContextResume ?? awaitHowlerContextResume

  let howls: Record<GreetLineKey, HowlLike> | null = null
  let loadPromise: Promise<Record<GreetLineKey, HowlLike>> | null = null

  // Track the in-flight playback so cancel() can interrupt it. Only one
  // line plays at a time in Greet's orchestration, so a single ref is fine.
  let activeStop: (() => void) | null = null

  function constructHowls(): Record<GreetLineKey, HowlLike> {
    const entries = (Object.keys(SOURCES) as GreetLineKey[]).map((key) => {
      const howl = new HowlCtor({
        src: [SOURCES[key]],
        // Preload so the first play() doesn't pay decode latency. The 4
        // files together are ~56 KB; preloading all of them on first
        // gesture is cheap.
        preload: true,
        // HTML5 audio is required on iOS for files >some-threshold but
        // for our short clips Web Audio is fine and gives sub-frame
        // latency. Howler defaults to Web Audio when available.
      }) as unknown as HowlLike
      return [key, howl] as const
    })
    return Object.fromEntries(entries) as Record<GreetLineKey, HowlLike>
  }

  function loadGreetAudio(): Promise<Record<GreetLineKey, HowlLike>> {
    if (howls) return Promise.resolve(howls)
    if (loadPromise) return loadPromise

    loadPromise = new Promise((resolve, reject) => {
      try {
        const built = constructHowls()
        howls = built
        // We don't wait for `load` events here — Howler's `preload: true`
        // schedules the fetch but `play()` will queue and start as soon
        // as the buffer is ready. Caller resolves when the map is built;
        // per-line load failures surface via `playGreetLine`'s reject.
        resolve(built)
      } catch (err) {
        loadPromise = null
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })

    return loadPromise
  }

  function playGreetLine(
    key: GreetLineKey,
    playOpts: PlayGreetLineOptions = {},
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Cancel any prior in-flight playback before starting a new line.
      // (Greet's orchestrator gaps lines by 400ms, so this is a defensive
      // double-cancel in normal flow; load-bearing if a caller fires
      // playGreetLine twice in quick succession.)
      if (activeStop) {
        activeStop()
        activeStop = null
      }

      const ensureLoaded = howls ? Promise.resolve(howls) : loadGreetAudio()

      ensureLoaded
        .then((map) => {
          const howl = map[key]
          if (!howl) {
            reject(new Error(`[preRecorded] no Howl for key "${key}"`))
            return
          }

          const schedule =
            playOpts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
          const cancelSchedule =
            playOpts.cancelSchedule ??
            ((h) => window.clearInterval(h as number))

          let tickHandle: unknown = null
          let resolved = false
          let stopped = false

          const detach = () => {
            // Howler's `off` without an id removes ALL listeners for the
            // event we registered — fine because each playGreetLine call
            // attaches its own short-lived set.
            try {
              howl.off('play')
              howl.off('end')
              howl.off('loaderror')
              howl.off('playerror')
            } catch {
              // Defensive: some Howl fakes may not implement off()
              // robustly. We don't depend on it for correctness.
            }
            if (tickHandle !== null) {
              cancelSchedule(tickHandle)
              tickHandle = null
            }
            activeStop = null
          }

          const settleResolve = () => {
            if (resolved) return
            resolved = true
            detach()
            resolve()
          }

          const settleReject = (err: Error) => {
            if (resolved) return
            resolved = true
            detach()
            reject(err)
          }

          // Register the cancel hook BEFORE play() so a synchronous
          // cancel() from the same tick (rare but possible) is honoured.
          activeStop = () => {
            if (resolved) return
            stopped = true
            try {
              howl.stop()
            } catch {
              // Stop on a not-yet-loaded Howl can throw on some impls.
            }
            settleReject(new Error('cancelled'))
          }

          howl.on('play', () => {
            // Phase-3 (ticket 86c9gvd0y) instrumentation. Record that
            // Howler emitted the `'play'` event — this is the missing
            // signal from the Phase-2 data round, where we saw `tap →
            // statechange → running` but never knew whether `onplay`
            // actually fired (pre-recorded audio doesn't push to the
            // existing `lastSpeak` bus channel). If we see speak-call
            // rows but no matching speak-onplay rows, the bug is the
            // Howler-on-iOS play-to-onplay stall.
            //
            // Logged BEFORE the resolved/stopped guard because we want
            // to know whenever Howler fired the event, even if a
            // concurrent stop() suppressed the user-visible effect.
            recordSpeakOnPlayEvent(key)
            if (resolved || stopped) return
            playOpts.onPlay?.()

            // Linear caption timer — see module docstring for rationale.
            // Fire word 0 immediately (the spoken word coincides with
            // playback start), then schedule the rest at evenly-spaced
            // intervals across the audio duration.
            const wordCount = WORD_COUNTS[key]
            playOpts.onWordTick?.(0)

            if (wordCount > 1) {
              const duration = howl.duration() // seconds
              // Defensive: if Howler reports 0 (asset not yet probed),
              // fall back to 165 wpm — same fallback the Web Speech
              // boundary path uses (see lib/tts/boundary.ts DEFAULT_WPM).
              const totalMs =
                duration > 0 ? duration * 1000 : (wordCount / 165) * 60_000
              const intervalMs = totalMs / wordCount
              let nextWord = 1
              tickHandle = schedule(() => {
                if (resolved || stopped) return
                if (nextWord >= wordCount) {
                  // All words ticked; stop the interval. We don't resolve
                  // here — the `end` event is the canonical line-complete
                  // signal so caption-final-frame stays in sync with
                  // audio's actual end.
                  if (tickHandle !== null) {
                    cancelSchedule(tickHandle)
                    tickHandle = null
                  }
                  return
                }
                playOpts.onWordTick?.(nextWord)
                nextWord += 1
              }, intervalMs)
            }
          })

          howl.on('end', () => {
            settleResolve()
          })

          howl.on('loaderror', () => {
            settleReject(
              new Error(`[preRecorded] loaderror for "${SOURCES[key]}"`),
            )
          })

          howl.on('playerror', () => {
            settleReject(
              new Error(`[preRecorded] playerror for "${SOURCES[key]}"`),
            )
          })

          // Phase-4 fix (ticket 86c9gvd0y): await the AudioContext resume
          // BEFORE calling Howl.play(). The Phase-3 iPad data showed that
          // when the context is `'suspended'` at play() time, Howler
          // binds its buffer source against the suspended state and the
          // play silently drops — `onplay` never fires, the gate
          // watchdog catches it 250 ms later as a relock, and Marian
          // sees no Melody. Awaiting the resume promise (bounded by a
          // 500 ms timeout) ensures the context is `'running'` by the
          // time we call play(), so the buffer source binds against a
          // live state. ~140 ms latency on tap-after-idle.
          //
          // Caller MUST still invoke playGreetLine inside a user-gesture
          // handler on iOS for the first call — the gesture authorizes
          // the resume; this helper just waits for it to settle.
          //
          // The Phase-2 helper (`resumeHowlerContextOnGesture`) STAYS
          // upstream in the gesture-tick callers; it kicks resume()
          // synchronously inside the gesture window, which is the most
          // robust gesture-context association on iOS. This await is
          // the second half: don't proceed until resume actually
          // settled.
          //
          // Sync-fast-path: when the helper returns a non-Promise (e.g.
          // a test stub, or the production helper hitting the
          // already-running short-circuit) we run play() in the same
          // tick. Production iPad-suspended path hits the async branch
          // and pays the bounded resume await before play.
          //
          // Phase-3 (ticket 86c9gvd0y) instrumentation: record the
          // synchronous return of `howl.play()` to the audio-ctx log
          // under `cause: 'speak-call'`. The `speakResult` field carries
          // the Howler sound id (number) on success, or `null` when
          // play() threw. Together with the corresponding
          // `'speak-onplay'` rows (or absence thereof) we can localize
          // whether the failure is at play-call time or at play-emit
          // time.
          const callPlay = () => {
            // If cancel() ran during the await window, the activeStop
            // handler already settled the rejection. Don't double-play.
            if (resolved || stopped) return
            try {
              const soundId = howl.play()
              recordSpeakCallEvent(
                typeof soundId === 'number' ? soundId : null,
                key,
              )
            } catch (err) {
              recordSpeakCallEvent(null, key)
              settleReject(
                err instanceof Error
                  ? err
                  : new Error(`[preRecorded] play() threw: ${String(err)}`),
              )
            }
          }

          let resumeReturn: Promise<unknown> | unknown
          try {
            resumeReturn = awaitContextResume()
          } catch {
            // Defensive: if a custom seam throws synchronously, fall
            // through to play() — production helper never throws.
            resumeReturn = undefined
          }

          if (
            resumeReturn &&
            typeof (resumeReturn as Promise<unknown>).then === 'function'
          ) {
            ;(resumeReturn as Promise<unknown>)
              .catch(() => {
                // The await helper swallows resume failures internally
                // and resolves; this catch is purely defensive against
                // custom seams that reject. Either way, proceed to
                // play() — we're never worse than pre-fix.
              })
              .then(callPlay)
          } else {
            // Synchronous return (production short-circuit or test
            // stub) — play in the same tick.
            callPlay()
          }
        })
        .catch((err) => {
          reject(
            err instanceof Error
              ? err
              : new Error(`[preRecorded] load failed: ${String(err)}`),
          )
        })
    })
  }

  function cancel(): void {
    if (activeStop) {
      activeStop()
      activeStop = null
    }
  }

  function unload(): void {
    cancel()
    if (howls) {
      for (const key of Object.keys(howls) as GreetLineKey[]) {
        try {
          howls[key].unload?.()
        } catch {
          // best-effort cleanup
        }
      }
      howls = null
      loadPromise = null
    }
  }

  return {
    loadGreetAudio,
    playGreetLine,
    cancel,
    unload,
  }
}

/**
 * Module-level singleton, mirroring the `lib/tts/tts.ts` pattern. Most
 * callers use these functions directly; tests construct their own via
 * `createPreRecorded({ HowlCtor })`.
 */
const defaultInstance = createPreRecorded()

export const loadGreetAudio = defaultInstance.loadGreetAudio
export const playGreetLine = defaultInstance.playGreetLine
export const cancel = defaultInstance.cancel
export const unload = defaultInstance.unload

/**
 * Word-count export for tests / sanity checks against `greetSequence.GREET_LINES`.
 */
export const GREET_LINE_WORD_COUNTS = WORD_COUNTS
export const GREET_LINE_SOURCES = SOURCES
