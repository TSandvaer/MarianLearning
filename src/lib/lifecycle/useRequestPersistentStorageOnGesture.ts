/**
 * React hook — request `navigator.storage.persist()` ONCE on the first
 * user gesture (ticket 86c9pkfth — harden progress localStorage).
 *
 * Why
 * ---
 * The browser's storage manager treats localStorage / IndexedDB / Cache
 * Storage as "best-effort" by default — under iOS Safari pressure
 * (low disk, long-idle PWA, "Clear data" cleanup heuristics, etc.) the
 * site's storage can be evicted without warning. Marian's progress
 * blob is small (KB) so disk pressure isn't the common case, but the
 * 7-day Intelligent Tracking Prevention bucket on iOS Safari has been
 * observed evicting standalone PWAs that don't meet the engagement
 * heuristic. Calling `navigator.storage.persist()` at least signals
 * the browser that we'd like the storage to stick; the browser may
 * grant it silently (Chrome/Edge after engagement signals) or prompt
 * the user once (Firefox).
 *
 * Why "first gesture" not "boot"
 * ------------------------------
 * Calling `persist()` from a `useEffect` at app boot has two failure
 * modes:
 *
 *   1. Some browsers REQUIRE the call to happen inside a user-
 *      activation context. Chrome's heuristics changed in 86 to grant
 *      `persisted` automatically once engagement metrics are met, but
 *      Firefox still surfaces a permission prompt and treats non-
 *      gesture calls as auto-deny.
 *
 *   2. Marian taps the splash, hears Emma greet her, taps the heart.
 *      A permission prompt mid-Greet would shred the experience. By
 *      deferring the request to the FIRST gesture, the prompt (if any)
 *      lands at the moment Marian is already actively interacting —
 *      and only ONCE per page lifetime, never repeated.
 *
 * Fire-and-forget
 * ---------------
 * Result is logged at debug-level, never surfaced as UI. Rejection or
 * the API being unavailable is a no-op — Marian's experience is
 * unaffected. iOS Safari < 16.4 doesn't expose `navigator.storage.persist`
 * at all; the typeof guard handles that case.
 *
 * Idempotent
 * ----------
 * The hook installs ONE document-level pointerdown listener with
 * `{ once: true }`. After the first gesture fires, the listener
 * removes itself and `persist()` is dispatched exactly once. A
 * sentinel ref also guards against StrictMode double-invocation in
 * development.
 */

import { useEffect, useRef } from 'react'

interface NavigatorStorageWithPersist {
  persist?: () => Promise<boolean>
}

/**
 * Mount-once hook. Subscribes to the document's first pointerdown and
 * calls `navigator.storage.persist()`. Returns nothing.
 *
 * Test seam: `requestPersist` overrides the default `navigator.storage`
 * lookup so unit tests can assert dispatch shape without touching real
 * navigator APIs.
 */
export function useRequestPersistentStorageOnGesture(opts?: {
  requestPersist?: () => Promise<boolean> | boolean | undefined
}): void {
  const requestRef = useRef(opts?.requestPersist)
  const firedRef = useRef(false)

  // Re-bind seam after each render (effect runs after commit, mirroring
  // the canonical "ref-from-prop" pattern). This is the lint-clean form
  // — assigning to ref.current during render breaks the
  // `react-hooks/refs` rule.
  useEffect(() => {
    requestRef.current = opts?.requestPersist
  })

  useEffect(() => {
    if (firedRef.current) return
    if (typeof document === 'undefined') return

    const handler = (): void => {
      if (firedRef.current) return
      firedRef.current = true
      // Resolve the request fn at gesture-time so a swapped seam still
      // wins. Production path: read `navigator.storage.persist` if it
      // exists; otherwise no-op.
      const seam = requestRef.current
      const dispatch =
        seam ??
        (() => {
          if (typeof navigator === 'undefined') return undefined
          const storage = (
            navigator as Navigator & {
              storage?: NavigatorStorageWithPersist
            }
          ).storage
          if (!storage || typeof storage.persist !== 'function')
            return undefined
          try {
            return storage.persist()
          } catch {
            return undefined
          }
        })

      let result: Promise<boolean> | boolean | undefined
      try {
        result = dispatch()
      } catch {
        return
      }
      if (result === undefined) return
      Promise.resolve(result).catch(() => {
        // Swallow — never surface as UI. The caller has no way to
        // recover and Marian doesn't need to know.
      })
    }

    document.addEventListener('pointerdown', handler, {
      once: true,
      capture: true,
    })
    return () => {
      document.removeEventListener('pointerdown', handler, { capture: true })
    }
  }, [])
}
