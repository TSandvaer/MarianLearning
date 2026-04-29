/**
 * Rapid re-mount suppression for the Hub welcome-back greeting.
 *
 * Source-of-truth: `design/screen-hub.md` § "Rapid-re-mount suppression"
 * (Dave Q5 verbatim): "Suppress the greeting on rapid re-mounts (if the
 * child returns to Hub within 30 seconds of leaving, Melody is already
 * visible in idle pose — no re-greeting)."
 *
 * Implementation
 * --------------
 * On Hub mount:
 *   1. Read `sessionStorage.lastUnmountAt` (ms epoch).
 *   2. If now - lastUnmountAt < 30_000 → suppress this mount's greeting.
 *   3. Otherwise → fire the greeting normally.
 *
 * On Hub unmount: write `sessionStorage.lastUnmountAt = now`.
 *
 * Why sessionStorage and not a module-level variable: the spec requires
 * the suppression to survive across `<AnimatePresence>` exit/enter cycles
 * (which fully unmount/remount the component). A module-level singleton
 * also works for this case; sessionStorage is the same conceptually but
 * survives a hot-reload during development too.
 */

import { useEffect, useState } from 'react'

/** SessionStorage key for the last Hub unmount timestamp. */
export const HUB_LAST_UNMOUNT_KEY = 'marian-tutor.hub.lastUnmountAt'

/** Suppression window — re-mounts within this delta skip the greeting. */
export const RAPID_REMOUNT_THRESHOLD_MS = 30_000

export interface UseRapidRemountSuppressionOptions {
  /** Test seam: returns the wall clock in ms. */
  now?: () => number
  /** Test seam: storage adapter. Defaults to `window.sessionStorage`. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

/**
 * Determine whether the current Hub mount should suppress its
 * welcome-back greeting. Returns a stable boolean for the lifetime of
 * the mount; the unmount-side write happens via the returned cleanup.
 *
 * The hook reads sessionStorage exactly once on first render (via a
 * lazy ref initialiser) so the decision is stable even if the parent
 * causes a re-render before the unmount lands.
 */
export function useRapidRemountSuppression(
  opts: UseRapidRemountSuppressionOptions = {},
): boolean {
  const now = opts.now ?? (() => Date.now())
  const storage = opts.storage ?? readSessionStorage()

  // Decide once on first render via lazy useState initialiser — the
  // value is stable for the mount lifetime even if parents re-render.
  const [suppressed] = useState<boolean>(() =>
    computeSuppressed(storage, now()),
  )

  useEffect(() => {
    return () => {
      // On unmount: stash the timestamp so the next mount can decide.
      try {
        storage?.setItem(HUB_LAST_UNMOUNT_KEY, String(now()))
      } catch {
        // Storage failures are non-fatal — we'll just not suppress
        // on the next mount, which is the safer default.
      }
    }
    // Effect runs once per mount; storage / now are stable for the
    // mount lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return suppressed
}

/** Pure decision function — exposed for unit tests. */
export function computeSuppressed(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  nowMs: number,
): boolean {
  if (!storage) return false
  let raw: string | null
  try {
    raw = storage.getItem(HUB_LAST_UNMOUNT_KEY)
  } catch {
    return false
  }
  if (raw === null) return false
  const last = Number.parseInt(raw, 10)
  if (!Number.isFinite(last)) return false
  return nowMs - last < RAPID_REMOUNT_THRESHOLD_MS
}

function readSessionStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
