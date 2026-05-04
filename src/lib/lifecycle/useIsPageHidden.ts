/**
 * React hook — current page-visibility state, with subscription.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B). Re-renders the consumer
 * on every `visibilitychange`. Implemented over `useSyncExternalStore`
 * which is the canonical React hook for "subscribe to a non-React
 * source and surface its value". Avoids the
 * `react-hooks/set-state-in-effect` foot-gun that the manual
 * useState + useEffect shape triggered.
 *
 * SSR-safe: the third argument (`getServerSnapshot`) returns `false`
 * (the safe default — treat the page as visible until the client
 * mounts and reads the real `document.visibilityState`).
 */

import { useSyncExternalStore } from 'react'

import { getIsPageHidden, subscribeToVisibilityChange } from './pageVisibility'

function getServerSnapshot(): boolean {
  return false
}

/**
 * Subscribe to page-visibility changes and return the current hidden
 * flag. Re-renders the calling component on every visibilitychange.
 *
 * On SSR / no-DOM environments returns `false` (the safe default —
 * treat the page as visible until proven otherwise).
 */
export function useIsPageHidden(): boolean {
  return useSyncExternalStore(
    subscribeToVisibilityChange,
    getIsPageHidden,
    getServerSnapshot,
  )
}
