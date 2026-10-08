/**
 * Storage round-trip for the spike, through expo-sqlite's synchronous
 * `localStorage` polyfill (installed in index.ts). Same API surface the
 * web app's progress module uses, so the sync boot read
 * (`useState(() => readSessionCount())`) carries over unchanged.
 */
const SESSION_COUNT_KEY = 'marian.mobile.sessionCount'

export function readSessionCount(): number {
  const raw = globalThis.localStorage.getItem(SESSION_COUNT_KEY)
  const n = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Increments and returns the new count. */
export function bumpSessionCount(): number {
  const next = readSessionCount() + 1
  globalThis.localStorage.setItem(SESSION_COUNT_KEY, String(next))
  return next
}

/** Dev reset so Thomas can re-run the first-launch path without reinstalling. */
export function resetSessionCount(): void {
  globalThis.localStorage.removeItem(SESSION_COUNT_KEY)
}
