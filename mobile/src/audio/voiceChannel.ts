/**
 * Emma's voice: one line at a time, across every source (Greet, Hub, path
 * and guidance lines, session lines). Starting a line cancels the one in
 * flight, so a Hub line can never leak into Math's read-aloud (the web's
 * ticket 86c9m4afh bug, fixed there per module with `cancelActive()`).
 *
 * Lifecycle, mirroring the web (`useHowlerSuspendOnHide` +
 * `pendingResumeGate`), minus the gesture the web needs only because
 * WebKit binds `AudioContext.resume()` to a user gesture:
 *
 * | Event                      | Web                                     | Native (here)                                   |
 * | -------------------------- | --------------------------------------- | ----------------------------------------------- |
 * | app hidden                 | `ctx.suspend()`: the line parks         | the line parks (paused; captions freeze)        |
 * | play() while hidden        | `enqueueOnResume`, most recent wins     | queued, most recent wins; the parked line is    |
 * |                            |                                         | cancelled and its player released               |
 * | app visible again          | gate pending → next tap resumes ctx,    | the parked line continues where it stopped,     |
 * |                            | the parked line continues, queue drains | then the queued line (if any) replaces it       |
 * | call / Siri (interruption) | same path as hidden (`interrupted`)     | the OS pauses the clip (`doNotMix` session) and |
 * |                            |                                         | resumes it on "should resume"; otherwise the    |
 * |                            |                                         | next `active` AppState edge resumes it          |
 *
 * Why every cancelled line's player is released (registry `remove()` +
 * native `release()`): expo-audio itself pauses playing players and flags
 * them for its own later resume, then plays every flagged player again:
 * - app background → foreground (`OnAppEntersBackground` /
 *   `OnAppEntersForeground`, both platforms);
 * - iOS route change `.oldDeviceUnavailable` (headphones out) sets
 *   `wasPlaying`, resumed at the next foreground;
 * - Android `AUDIOFOCUS_LOSS_TRANSIENT[_CAN_DUCK]` sets `isPaused`,
 *   resumed on `AUDIOFOCUS_GAIN` or the next foreground.
 * JS `pause()` clears none of those flags, so a cancelled line whose
 * player stayed cached would come back over whatever plays next (the web's
 * 86c9m4afh leak class). A start-timeout / player error releases its
 * player too (`linePlayback.ts` `onAbort`).
 */
import type { LineHandle } from './linePlayback'

export interface VoiceRequest {
  label: string
  /** Start the line now. Called at most once. */
  start: () => LineHandle
  /** The line was superseded before it started (queued while hidden). */
  onSuperseded: () => void
  /** Release the native player behind this line; called on every cancel. */
  release: () => void
}

export interface VoiceChannel {
  /** Play a line, cancelling the one in flight (or queue it while hidden). */
  play(request: VoiceRequest): void
  /** Cancel the line in flight and any queued line. Idempotent. */
  cancelAll(): void
  /** Lifecycle: app hidden (`true`) / visible (`false`). */
  setHidden(hidden: boolean): void
  /** Lifecycle: AppState returned to `active` (interruption recovery). */
  onActive(): void
  readonly hidden: boolean
  /** Label of the line in flight, for diagnostics and tests. */
  readonly activeLabel: string | null
}

export function createVoiceChannel(): VoiceChannel {
  let active: { request: VoiceRequest; handle: LineHandle } | null = null
  let queued: VoiceRequest | null = null
  let hidden = false

  function cancelActive(): void {
    if (!active) return
    const { request, handle } = active
    active = null
    handle.cancel()
    // Always, not only while hidden: the library also flags players for
    // its own auto-resume while visible (see header).
    request.release()
  }

  function startNow(request: VoiceRequest): void {
    cancelActive()
    const handle = request.start()
    const entry = { request, handle }
    active = entry
    const clear = () => {
      if (active === entry) active = null
    }
    handle.done.then(clear, clear)
  }

  return {
    play(request) {
      if (!hidden) {
        startNow(request)
        return
      }
      cancelActive()
      queued?.onSuperseded()
      queued = request
    },
    cancelAll() {
      cancelActive()
      const q = queued
      queued = null
      q?.onSuperseded()
    },
    setHidden(next) {
      if (next === hidden) return
      hidden = next
      if (hidden) {
        active?.handle.park()
        return
      }
      active?.handle.unpark()
      const q = queued
      queued = null
      if (q) startNow(q)
    },
    onActive() {
      if (!hidden) active?.handle.unpark()
    },
    get hidden() {
      return hidden
    },
    get activeLabel() {
      return active?.request.label ?? null
    },
  }
}
