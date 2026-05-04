/**
 * Page-visibility lifecycle module.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B). Source-of-truth for
 * "is the PWA tab currently hidden?" — backgrounded via homescreen,
 * app-switcher, lock-screen, sibling snatching the iPad, etc. iPad
 * Safari fires `visibilitychange` on all of these (along with
 * `pagehide` for full app-switch / tab close).
 *
 * Why this lives in `lib/lifecycle/`
 * ----------------------------------
 * App.tsx wires the side-effects (Howler.ctx.suspend / resume); the
 * Math screen reads the hidden flag to gate its advance timers; future
 * Word Song / Hub timers will do the same. Every consumer hits the
 * same module-level subscription so we install exactly ONE
 * document-level listener regardless of how many components ask.
 *
 * Defensive posture
 * -----------------
 * - SSR-safe: when `document` is undefined the helpers are no-ops and
 *   `getIsPageHidden()` returns `false` (the safe default — we'd rather
 *   over-fire timers than freeze them on a server render).
 * - Test-friendly: `_resetForTests()` blows away the listener + the
 *   subscriber set so each unit test starts from a clean slate. Vitest
 *   reuses the same module instance across tests so without this the
 *   subscriber list grows unbounded.
 *
 * Browser support
 * ---------------
 * `document.visibilityState === 'hidden'` is the canonical signal on
 * both Chromium and WebKit. Legacy `webkitvisibilitychange` is not
 * dispatched by modern WebKit; we listen only to the standard event.
 * `pagehide` is dispatched on full navigation away — out of scope for
 * the in-session pause/resume story; the suspend/resume on `hidden` is
 * sufficient because iOS pauses the JS event loop on full app-switch
 * anyway.
 */

type Listener = () => void

let listeners = new Set<Listener>()
let attached = false

function readHidden(): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.visibilityState === 'hidden'
  } catch {
    return false
  }
}

function handleVisibilityChange(): void {
  // Snapshot subscribers BEFORE iteration in case a callback unsubscribes
  // mid-walk (the tear-down case for a screen exiting on
  // visibilitychange — unlikely in v1 but cheap to defend against).
  for (const cb of Array.from(listeners)) {
    try {
      cb()
    } catch {
      // Subscribers must not crash the dispatch loop. A throwing
      // callback gets swallowed; the rest still run.
    }
  }
}

function attachIfNeeded(): void {
  if (attached) return
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', handleVisibilityChange)
  attached = true
}

/**
 * Read the current visibility state. Cheap — direct DOM read.
 *
 * Returns `true` when the tab/window is currently hidden (backgrounded,
 * locked, app-switched). `false` when visible.
 *
 * In SSR / no-DOM environments returns `false` (treat as visible — the
 * safer default for timer logic).
 */
export function getIsPageHidden(): boolean {
  return readHidden()
}

/**
 * Subscribe to visibility changes. Returns an unsubscribe function.
 *
 * The listener is dispatched whenever the standard `visibilitychange`
 * event fires on `document`. Read the current state inside the
 * callback via `getIsPageHidden()` — we don't pass the new state as an
 * argument because the callback ALWAYS needs to consult the live state
 * (in case a debounced rapid-flip lands during the dispatch window).
 *
 * Idempotent: subscribing the same callback twice still produces one
 * dispatch per visibilitychange (Set semantics). Unsubscribing more
 * than once is a no-op.
 */
export function subscribeToVisibilityChange(cb: Listener): () => void {
  attachIfNeeded()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Test seam — drop the document listener, clear all subscribers, reset
 * the attach latch. Production code never calls this. Each Vitest case
 * that touches the module should `afterEach(_resetPageVisibilityForTests)`
 * to avoid leaking subscribers and double-attaching the listener
 * across test runs.
 */
export function _resetPageVisibilityForTests(): void {
  if (attached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  listeners = new Set()
  attached = false
}
