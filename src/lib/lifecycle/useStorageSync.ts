/**
 * Cross-tab `storage` event sync hook.
 *
 * Ticket 86c9kxtn1 (Jessica e2e batch — Bug C). When Marian (or her
 * sibling) has the PWA open in two tabs / two windows on the same
 * origin, writes to localStorage in tab A do not propagate to tab B's
 * in-memory React state. The browser DOES fire the standard `storage`
 * event in tab B (DOM standard, dispatched only on cross-tab same-
 * origin writes — never in the writing tab itself); we just have to
 * subscribe.
 *
 * Why a tiny per-key hook (not one big context provider)
 * ------------------------------------------------------
 * Each consumer cares about a different shape — Hub watches the
 * session-history blob, future Math/WordSong consumers might watch
 * the progress blob. A focused per-key hook keeps the API small and
 * lets each consumer parse the stored value into their own React
 * state. The cost is one document-level listener per call site, which
 * is negligible for the v1 read surface (Hub + the App-level progress
 * mirror = two listeners total).
 *
 * Defensive posture
 * -----------------
 * - The `storage` event fires only for OTHER tabs — but we still
 *   defensively check `event.key === watchedKey`. A future global
 *   `localStorage.clear()` from any tab fires `storage` with
 *   `key === null` and `newValue === null`; consumers want to react
 *   to that ("storage was wiped, re-read defaults").
 * - We pass the raw storage event to the callback so the consumer
 *   can decide how to project the new value (parse JSON, fall back
 *   to defaults, etc.). The hook does not parse — that's the caller's
 *   contract.
 * - SSR-safe: when `window` is undefined the effect body is a no-op
 *   and no listener is installed.
 */

import { useEffect } from 'react'

/**
 * Re-export the canonical storage keys so callers don't have to
 * reach into deep modules. These match the e2e helpers' literals
 * exactly — keep them in sync with `e2e/_helpers/seedStorage.ts`
 * (the e2e specs reference them as ground truth).
 */
export const PROGRESS_STORAGE_KEY = 'marian-tutor:progress:v1'
export const SESSION_HISTORY_STORAGE_KEY = 'marian-tutor.session-history.v1'

export interface UseStorageSyncOptions {
  /**
   * The localStorage key to watch. Required — the hook does not match
   * on `null` (global wipe) by default; callers that want that
   * behaviour can pass `null` to disable the key filter.
   */
  key: string | null
  /**
   * Invoked on a matching `storage` event from another tab. Called
   * with the raw event so the caller can read `newValue`, `oldValue`,
   * etc.
   */
  onChange: (event: StorageEvent) => void
}

/**
 * Subscribe to cross-tab `storage` events for a single key. Returns
 * nothing; the effect body owns the listener lifecycle.
 *
 * Note on event semantics: the standard `storage` event ONLY fires
 * for cross-tab same-origin writes. The writing tab does NOT see its
 * own write. This means the hook is the canonical hook for "another
 * tab updated my data" and never needs to filter out same-tab echoes.
 */
export function useStorageSync({ key, onChange }: UseStorageSyncOptions): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: StorageEvent): void => {
      // `event.key === null` happens on `localStorage.clear()` —
      // when watching a specific key, ignore that case (the caller
      // can opt in by passing `key: null`).
      if (key !== null && event.key !== key) return
      try {
        onChange(event)
      } catch {
        // Subscribers must not crash the dispatch loop. A throwing
        // callback gets swallowed; the rest of the page keeps
        // working.
      }
    }

    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [key, onChange])
}
