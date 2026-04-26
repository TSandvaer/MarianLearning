import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_CTX_LOG_STORAGE_KEY } from './audioContextProbe'
import {
  subscribe,
  type AudioCtxEventRecord,
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
 *  - The most-recent AudioContext.state (running / suspended / interrupted /
 *    closed / unavailable). Driven by the audio-context probe — see
 *    `audioContextProbe.ts` for the polling cadence and statechange capture.
 *  - The last 6 audio-context samples (poll, statechange, tap), each with
 *    a wall-clock timestamp and the optional `speechSynthesis.paused`
 *    co-reading. The full timeline is mirrored to localStorage under
 *    `debug:audioCtxLog:v1` for paste-back from iPad.
 *  - An "Export log" button + entry counter that lets Thomas capture the
 *    full localStorage timeline directly from the iPad (no Mac / Web
 *    Inspector required). Primary path uses `navigator.clipboard.writeText`
 *    on a user gesture (HTTPS + tap satisfies iOS Safari requirements).
 *    Fallback path renders a monospace, scrollable `<textarea>` so Thomas
 *    can long-press → Select All → Copy. The exported payload is a
 *    self-describing JSON object containing `userAgent`, `exportedAt`,
 *    `pageUrl`, the storage key, and the parsed log array.
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
 *  - audioCtx flips from `running` → `suspended` / `interrupted` mid-idle,
 *    AND the next tap shows `cause: tap, ctxState: suspended` — that's the
 *    iOS audio-session decay fingerprint for ticket 86c9gvd0y. If the tap
 *    sample shows `running` instead, the bug is somewhere else (Howler
 *    bookkeeping, our retry path, or a different layer).
 */

const POLL_MS = 200
const TEXT_TRUNCATE_AT = 40

/**
 * How long the transient "Copied" confirmation stays visible after a
 * successful clipboard write. Two seconds is enough for Thomas to register
 * the success on the iPad without making the panel feel sticky.
 */
const COPIED_CONFIRMATION_MS = 2000

/**
 * Rows on the fallback `<textarea>`. Big enough that the JSON is scrollable
 * and readable in one piece, small enough that the overlay still fits on an
 * iPad in landscape without dominating the screen.
 */
const FALLBACK_TEXTAREA_ROWS = 12

interface ExportPayload {
  /** ISO timestamp of the export call. */
  exportedAt: string
  /** `Date.now()` of the export call (matches probe sample timestamps). */
  exportedAtMs: number
  /** `navigator.userAgent` so we can confirm iPad model / iOS version. */
  userAgent: string
  /** `window.location.href` so we can tell PR-preview from production. */
  pageUrl: string
  /** Storage key the log was read from — explicit so paste is self-describing. */
  storageKey: string
  /** The parsed log array, or `null` if the buffer was empty / malformed. */
  log: unknown
  /** Count of rows in `log`, or 0 if the buffer was empty / malformed. */
  logEntryCount: number
}

/**
 * Read the audio-context log from localStorage and parse it as JSON.
 * Returns `null` if the key is missing, the value is empty, or parsing
 * fails. Test seam — pass via props so the component is exercisable
 * without poking at jsdom's localStorage shim.
 */
function readAudioCtxLog(): unknown {
  if (typeof window === 'undefined' || !window.localStorage) return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    // Surface the raw string so Thomas can still paste something useful
    // even if the buffer got corrupted. Better than swallowing it.
    return raw
  }
}

/**
 * Build the self-describing export payload that Thomas pastes back to the
 * ticket. Wrapped in a function so tests can assert the shape without
 * reaching into the component.
 */
function buildExportPayload(
  log: unknown,
  now: number = Date.now(),
): ExportPayload {
  // Defensive reads: jsdom and certain test harnesses may leave
  // `window.location.href` or `navigator.userAgent` as `undefined`. We
  // never want an export call to throw — the whole point is paste-back.
  let pageUrl = '(unknown)'
  try {
    if (typeof window !== 'undefined' && window.location?.href) {
      pageUrl = window.location.href
    }
  } catch {
    // some sandboxes throw on cross-origin reads — keep the default.
  }
  let userAgent = '(unknown)'
  try {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      userAgent = navigator.userAgent
    }
  } catch {
    // ignore
  }
  return {
    exportedAt: new Date(now).toISOString(),
    exportedAtMs: now,
    userAgent,
    pageUrl,
    storageKey: AUDIO_CTX_LOG_STORAGE_KEY,
    log: log ?? null,
    logEntryCount: Array.isArray(log) ? log.length : 0,
  }
}

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

function renderAudioCtxEvent(e: AudioCtxEventRecord): string {
  const synth =
    e.synthPaused === undefined ? '' : ` synthPaused=${String(e.synthPaused)}`
  // Phase-3 (ticket 86c9gvd0y) extension. Surface the gate state mirror
  // and the speak-call / speak-skipped / handler-error companion fields
  // on the on-screen panel so iPad QA can read them at a glance. The
  // localStorage export already carries them via the JSON record shape.
  const gate = e.gateState ? ` gate=${e.gateState}` : ''
  const speakResult =
    e.speakResult === undefined
      ? ''
      : ` soundId=${e.speakResult === null ? 'null' : String(e.speakResult)}`
  const reason = e.skipReason ? ` reason=${e.skipReason}` : ''
  const error = e.errorMessage ? ` error="${e.errorMessage}"` : ''
  return `[${formatTimestamp(e.timestamp)}] ${e.cause}: ${e.ctxState}${gate}${synth}${speakResult}${reason}${error}`
}

export interface DebugOverlayProps {
  /**
   * Test seam — overrides the polling read of `speechSynthesis`. Defaults to
   * the live engine. Tests pass a stub so they don't depend on jsdom.
   */
  readSynthFn?: () => SynthSnapshot
  /**
   * Test seam — overrides the localStorage read for the audio-context log.
   * Defaults to reading `debug:audioCtxLog:v1`. Tests pass a stub so they
   * don't have to populate jsdom's localStorage to exercise the export UI.
   */
  readAudioCtxLogFn?: () => unknown
  /**
   * Test seam — overrides the clipboard write. Defaults to
   * `navigator.clipboard.writeText`. Tests pass a stub that resolves or
   * rejects to exercise both the primary path and the textarea fallback.
   * If clipboard is unavailable in the host (e.g. older iPad WebKit), pass
   * a function that always rejects to force the fallback path.
   */
  writeClipboardFn?: (text: string) => Promise<void>
  /**
   * Test seam — overrides `Date.now()` used in the export payload.
   */
  nowFn?: () => number
}

export default function DebugOverlay({
  readSynthFn = readSynth,
  readAudioCtxLogFn = readAudioCtxLog,
  writeClipboardFn,
  nowFn,
}: DebugOverlayProps) {
  const [bus, setBus] = useState<DebugSnapshot>({
    lastSpeak: null,
    recentTaps: [],
    recentRawEvents: [],
    gateState: null,
    audioCtxState: null,
    audioCtxEvents: [],
  })
  const [synth, setSynth] = useState<SynthSnapshot>(() => readSynthFn())
  const [exportText, setExportText] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>(
    'idle',
  )
  const [logEntryCount, setLogEntryCount] = useState<number>(() => {
    const log = readAudioCtxLogFn()
    return Array.isArray(log) ? log.length : 0
  })
  const copyTimerRef = useRef<number | null>(null)

  // Subscribe to the bus on mount.
  useEffect(() => {
    return subscribe(setBus)
  }, [])

  // Clear any pending "Copied" timer on unmount so we never call setState
  // after the component has been torn down (?debug=1 toggled off mid-flight,
  // hot reload, etc.).
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  // Re-read the log entry count alongside the synth poll so the counter
  // stays roughly fresh as the probe pushes new samples. Cheap: one
  // localStorage read + JSON.parse every 200ms, only under ?debug=1.
  useEffect(() => {
    const id = window.setInterval(() => {
      const log = readAudioCtxLogFn()
      setLogEntryCount(Array.isArray(log) ? log.length : 0)
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [readAudioCtxLogFn])

  const handleExport = useCallback(async () => {
    const log = readAudioCtxLogFn()
    const payload = buildExportPayload(log, nowFn ? nowFn() : Date.now())
    const json = JSON.stringify(payload, null, 2)

    // Resolve the clipboard writer. Prefer the prop (test seam) but fall
    // back to the platform API. Wrap in a function rather than reading
    // navigator.clipboard inline so a missing API takes the fallback path
    // immediately rather than throwing TypeError on `.writeText`.
    const writer =
      writeClipboardFn ??
      (typeof navigator !== 'undefined' && navigator.clipboard
        ? (text: string) => navigator.clipboard.writeText(text)
        : null)

    if (writer) {
      try {
        await writer(json)
        setCopyState('copied')
        setExportText(null)
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = window.setTimeout(() => {
          setCopyState('idle')
          copyTimerRef.current = null
        }, COPIED_CONFIRMATION_MS)
        return
      } catch {
        // Fall through to textarea fallback. Older iPad WebKit + permission
        // rejection both land here.
      }
    }

    setCopyState('fallback')
    setExportText(json)
  }, [readAudioCtxLogFn, writeClipboardFn, nowFn])

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
      <div data-testid="debug-overlay-audio-ctx">
        <strong>audioCtx</strong> {bus.audioCtxState ?? '(no probe)'}
      </div>
      <div data-testid="debug-overlay-audio-ctx-events">
        <strong>audioCtx events ({bus.audioCtxEvents.length})</strong>
        {bus.audioCtxEvents.length === 0 ? (
          <div>(none)</div>
        ) : (
          // Render only the most-recent few in the on-screen panel so the
          // overlay stays compact. The full timeline is mirrored to
          // localStorage by the probe (see audioContextProbe.ts) — Thomas
          // pastes that back via Safari Web Inspector or the
          // localStorage.getItem('debug:audioCtxLog:v1') console call.
          bus.audioCtxEvents
            .slice(-6)
            .reverse()
            .map((e, i) => (
              <div
                key={`${e.timestamp}-${i}`}
                data-testid="debug-overlay-audio-ctx-event"
              >
                {renderAudioCtxEvent(e)}
              </div>
            ))
        )}
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
      {/*
        Export block. The overlay container is `pointer-events-none` so it
        never intercepts taps meant for the screen — but the export button
        and the fallback textarea must accept input, so the wrapper switches
        `pointer-events-auto` back on for this region only. `aria-hidden`
        stays true on the parent (debug noise must not reach a screen
        reader); the button is reachable by touch regardless.
      */}
      <div
        data-testid="debug-overlay-export"
        className="pointer-events-auto mt-1"
      >
        <strong>log entries: {logEntryCount}</strong>
        <button
          type="button"
          data-testid="debug-overlay-export-button"
          onClick={() => {
            void handleExport()
          }}
          className="
            ml-2 px-2 py-0.5
            rounded border border-white/40
            bg-white/10 hover:bg-white/20
            text-white text-[12px]
            font-mono
          "
        >
          Export log
        </button>
        {copyState === 'copied' && (
          <span
            data-testid="debug-overlay-export-confirm"
            className="ml-2 text-green-300"
          >
            Copied
          </span>
        )}
        {copyState === 'fallback' && exportText !== null && (
          <textarea
            data-testid="debug-overlay-export-textarea"
            readOnly
            rows={FALLBACK_TEXTAREA_ROWS}
            value={exportText}
            // Keep the fallback inside the same panel so Thomas doesn't
            // have to hunt for it. Monospace + full width of the overlay
            // so JSON wraps predictably; long-press → Select All → Copy
            // is the iOS-native interaction we're targeting.
            className="
              mt-1 block w-full
              bg-black/60 text-white
              font-mono text-[11px] leading-tight
              border border-white/30 rounded
              p-1
              resize-y
            "
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </div>
    </div>
  )
}
