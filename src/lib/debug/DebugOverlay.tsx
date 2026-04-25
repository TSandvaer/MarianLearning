import { useEffect, useState } from 'react'
import {
  subscribe,
  type DebugSnapshot,
  type RawTapEventRecord,
  type SpeakAttemptRecord,
  type TapEventRecord,
} from './debugBus'

/**
 * On-screen debug panel for iPad QA.
 *
 * Mounted by `App.tsx` only when `?debug=1` is in the URL. Without that flag
 * the component never mounts, so debug is invisible in normal sessions.
 *
 * What it shows
 * -------------
 *  - Live `speechSynthesis` state (`speaking`, `pending`, `paused`) polled
 *    every 200ms. These three booleans are the iPad-Safari-specific signal
 *    we care about: a "paused" engine is the most common silent-fail mode.
 *  - Voice list length + first voice's `lang`. If voices.length === 0 by
 *    the time the user taps Wake, the speak() that follows will be silently
 *    rejected on most iPad WebKit builds.
 *  - The last `speak()` call: text (truncated to 40 chars), wall-clock
 *    timestamp, and current status (queued → started → ended, or errored).
 *  - The last error message, if any.
 *  - The last 5 tap events: timestamp + event type. Confirms the multi-event
 *    binding (click/touchend/pointerdown) is actually firing on the iPad
 *    via React's synthetic-event system.
 *  - The last 8 raw DOM events on the wake-tap target, captured via
 *    `addEventListener` BEFORE React sees them. Diagnostic line for the
 *    iPad-tap-not-firing investigation: if `taps (0)` but
 *    `raw events (>0)`, React's synthetic binding is broken; if both are
 *    zero, iPad isn't delivering events to the element at all (CSS
 *    hit-testing issue).
 *  - The audio-unlock-gate state: idle / pending / unlocked / relock.
 *
 * iPad QA usage
 * -------------
 * Test in Safari tab mode only — DO NOT install to home screen for debug
 * runs. The PWA manifest's `start_url` is `/` (no query string), so an
 * installed-from-home-screen tile will strip `?debug=1` and launch the
 * production build with no overlay. (`scope` only constrains service-worker
 * interception; it does not preserve query strings on the launcher.) Since
 * the iPad TTS bug repros in BOTH Safari tab and installed PWA modes
 * (Thomas confirmed this 2026-04-25), Safari-tab-only testing loses no
 * diagnostic signal.
 *
 *  1. Open https://marian-learning.vercel.app/?debug=1 (or the PR-preview
 *     URL with `?debug=1` appended) in a Safari TAB on iPad. Do not Add to
 *     Home Screen.
 *  2. Walk through Splash → Greet → tap the wake target.
 *  3. Watch the bottom-left overlay panel. Screenshot it if TTS doesn't fire.
 *
 * Reading the panel after a silent fail
 * -------------------------------------
 *  - Recent tap shows `click` / `touchend` / `pointerdown` → the binding is
 *    firing. If only `pointerdown` shows, the multi-event fix isn't taking
 *    effect (regression).
 *  - lastSpeak.status stuck on `queued` → engine accepted the call but never
 *    started. Check `paused` (likely true) and voice count (likely zero).
 *  - lastSpeak.status === `errored` with error `not-allowed` → gesture-gate
 *    rejection; the tap didn't land in the same JS task as speak().
 *  - lastSpeak.status === `errored` with error `synthesis-failed` → engine
 *    rejected the utterance config (try simplifying pitch/rate further).
 *  - gateState stuck on `pending` → speak() returned but no onstart fired
 *    within the watchdog window; will flip to `relock` on next poll.
 */

const POLL_MS = 200
const TEXT_TRUNCATE_AT = 40

interface SynthSnapshot {
  speaking: boolean
  pending: boolean
  paused: boolean
  voiceCount: number
  firstVoiceLang: string | null
}

function readSynth(): SynthSnapshot {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return {
      speaking: false,
      pending: false,
      paused: false,
      voiceCount: 0,
      firstVoiceLang: null,
    }
  }
  const synth = window.speechSynthesis
  let voices: SpeechSynthesisVoice[]
  try {
    voices = synth.getVoices()
  } catch {
    voices = []
  }
  return {
    speaking: synth.speaking,
    pending: synth.pending,
    paused: synth.paused,
    voiceCount: voices.length,
    firstVoiceLang: voices[0]?.lang ?? null,
  }
}

function truncate(text: string, at: number): string {
  if (text.length <= at) return text
  return `${text.slice(0, at - 1)}…`
}

function formatTimestamp(ts: number): string {
  // Wall-clock HH:MM:SS.mmm — easy to match against a stopwatch / video
  // recording during iPad QA.
  const d = new Date(ts)
  const pad2 = (n: number) => n.toString().padStart(2, '0')
  const pad3 = (n: number) => n.toString().padStart(3, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`
}

function renderSpeak(s: SpeakAttemptRecord | null): string {
  if (!s) return '(none)'
  const base = `[${formatTimestamp(s.timestamp)}] ${s.status}: "${truncate(
    s.text,
    TEXT_TRUNCATE_AT,
  )}"`
  return s.error ? `${base} — ${s.error}` : base
}

function renderTap(t: TapEventRecord): string {
  return `[${formatTimestamp(t.timestamp)}] ${t.type} → ${t.target}`
}

function renderRawTap(t: RawTapEventRecord): string {
  return `[${formatTimestamp(t.timestamp)}] ${t.type} → ${t.target}`
}

export interface DebugOverlayProps {
  /**
   * Test seam — overrides the polling read of `speechSynthesis`. Defaults to
   * the live engine. Tests pass a stub so they don't depend on jsdom.
   */
  readSynthFn?: () => SynthSnapshot
}

export default function DebugOverlay({
  readSynthFn = readSynth,
}: DebugOverlayProps) {
  const [bus, setBus] = useState<DebugSnapshot>({
    lastSpeak: null,
    recentTaps: [],
    recentRawEvents: [],
    gateState: null,
  })
  const [synth, setSynth] = useState<SynthSnapshot>(() => readSynthFn())

  // Subscribe to the bus on mount.
  useEffect(() => {
    return subscribe(setBus)
  }, [])

  // Poll `speechSynthesis` every POLL_MS so the engine's live state stays
  // visible without callers needing to push it to the bus. The engine doesn't
  // expose change events for `paused` / `speaking` / `pending`, so polling is
  // the only honest option. 200ms is a reasonable refresh on a debug panel
  // and the cost (one property read + a setState) is negligible.
  useEffect(() => {
    const id = window.setInterval(() => {
      setSynth(readSynthFn())
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [readSynthFn])

  return (
    <div
      data-testid="debug-overlay"
      // Bottom-left, semi-transparent black, white text, monospace, 12px.
      // `pointer-events-none` so the panel never intercepts a tap meant for
      // the screen — critical, since one of the things we're debugging is
      // tap routing.
      // z-[9999] so it sits above the absolute Greet wake-tap target (z-50).
      className="
        fixed bottom-0 left-0 z-[9999]
        max-w-[60vw] m-2
        rounded
        bg-black/70 text-white
        font-mono text-[12px] leading-tight
        px-2 py-1
        pointer-events-none
        select-none
      "
      role="status"
      aria-hidden="true"
    >
      <div data-testid="debug-overlay-synth">
        <strong>synth</strong> speaking={String(synth.speaking)} pending=
        {String(synth.pending)} paused={String(synth.paused)}
      </div>
      <div data-testid="debug-overlay-voices">
        <strong>voices</strong> count={synth.voiceCount} lang=
        {synth.firstVoiceLang ?? '(none)'}
      </div>
      <div data-testid="debug-overlay-gate">
        <strong>gate</strong> {bus.gateState ?? '(unmounted)'}
      </div>
      <div data-testid="debug-overlay-speak">
        <strong>speak</strong> {renderSpeak(bus.lastSpeak)}
      </div>
      <div data-testid="debug-overlay-taps">
        <strong>taps ({bus.recentTaps.length})</strong>
        {bus.recentTaps.length === 0 ? (
          <div>(none)</div>
        ) : (
          bus.recentTaps
            .slice()
            .reverse()
            .map((t, i) => (
              <div key={`${t.timestamp}-${i}`} data-testid="debug-overlay-tap">
                {renderTap(t)}
              </div>
            ))
        )}
      </div>
      <div data-testid="debug-overlay-raw-events">
        <strong>raw events ({bus.recentRawEvents.length})</strong>
        {bus.recentRawEvents.length === 0 ? (
          <div>(none)</div>
        ) : (
          bus.recentRawEvents
            .slice()
            .reverse()
            .map((t, i) => (
              <div
                key={`${t.timestamp}-${i}`}
                data-testid="debug-overlay-raw-event"
              >
                {renderRawTap(t)}
              </div>
            ))
        )}
      </div>
    </div>
  )
}
