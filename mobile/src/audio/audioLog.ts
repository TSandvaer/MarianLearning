/**
 * Audio diagnostics: onPlay latency (play() → first `playing` status) and
 * session-load timings. Kept in a small ring buffer; with debug on
 * (`-debug 1` / `EXPO_PUBLIC_DEBUG=1`) every row is also logged to Metro
 * as `[audio] ...`, which is how the Phase 2b latencies were read.
 */
export type AudioLogRow =
  | { kind: 'onplay'; label: string; ms: number }
  | { kind: 'session-load'; label: string; ms: number; detail: string }
  | { kind: 'note'; label: string; detail: string }

const MAX_ROWS = 100
const rows: AudioLogRow[] = []
let consoleEnabled = false

export function setAudioLogConsole(enabled: boolean): void {
  consoleEnabled = enabled
}

export function recordAudio(row: AudioLogRow): void {
  rows.push(row)
  if (rows.length > MAX_ROWS) rows.shift()
  if (!consoleEnabled) return
  if (row.kind === 'onplay') {
    console.log(`[audio] onPlay +${Math.round(row.ms)} ms ${row.label}`)
  } else if (row.kind === 'session-load') {
    console.log(`[audio] ${row.label} ${Math.round(row.ms)} ms ${row.detail}`)
  } else {
    console.log(`[audio] ${row.label} ${row.detail}`)
  }
}

export function readAudioLog(): readonly AudioLogRow[] {
  return rows.slice()
}

/** Test seam. */
export function _resetAudioLogForTests(): void {
  rows.length = 0
  consoleEnabled = false
}
