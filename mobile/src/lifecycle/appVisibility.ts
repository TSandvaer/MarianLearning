/**
 * App visibility: the native counterpart of the web's page-visibility
 * module (`src/lib/lifecycle/pageVisibility.ts`), built on React
 * Native's `AppState` instead of `document.visibilitychange`.
 *
 * "Hidden" means `AppState` is `background`: home screen, app switch,
 * lock screen — the cases the PWA sees as `visibilityState === 'hidden'`.
 * iOS also reports `inactive` (Control Center, Notification Center, the
 * app-switcher preview, an incoming-call banner, and the hop on the way
 * to `background`). The page stays visible in those cases on the web, so
 * `inactive` counts as visible here too, and a `active ↔ inactive` flip
 * notifies nobody. Audio interruptions (calls, Siri) are the audio
 * session's job (Phase 2b), not this module's.
 *
 * One `AppState` subscription per store, attached on the first
 * subscriber, shared by every consumer (same posture as the web module).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

/** The subset of React Native's `AppState` this module uses. */
export interface AppStateSource {
  readonly currentState: string | null
  addEventListener(
    type: 'change',
    listener: (state: string) => void,
  ): { remove(): void }
}

export function isHiddenAppState(state: string | null): boolean {
  return state === 'background'
}

export interface AppVisibility {
  /** `true` while the app is in the background. */
  getIsHidden(): boolean
  /** Called on every hidden ↔ visible change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

export function createAppVisibility(source: AppStateSource): AppVisibility {
  const listeners = new Set<() => void>()
  let hidden = isHiddenAppState(source.currentState)
  let attached = false

  function onChange(state: string): void {
    const next = isHiddenAppState(state)
    if (next === hidden) return
    hidden = next
    for (const listener of Array.from(listeners)) {
      try {
        listener()
      } catch {
        // One consumer's bug must not starve the others.
      }
    }
  }

  return {
    getIsHidden: () => hidden,
    subscribe(listener) {
      if (!attached) {
        attached = true
        hidden = isHiddenAppState(source.currentState)
        source.addEventListener('change', onChange)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The app-wide store over React Native's `AppState`. */
export const appVisibility: AppVisibility = createAppVisibility(AppState)

/** Re-renders on every hidden ↔ visible change (web: `useIsPageHidden`). */
export function useIsAppHidden(store: AppVisibility = appVisibility): boolean {
  return useSyncExternalStore(store.subscribe, store.getIsHidden)
}

/**
 * Calls `onChange(hidden)` on every hidden ↔ visible change, without
 * re-rendering the caller. For side effects (pause/resume work).
 */
export function useAppVisibilityChange(
  onChange: (hidden: boolean) => void,
  store: AppVisibility = appVisibility,
): void {
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  }, [onChange])
  useEffect(
    () => store.subscribe(() => latest.current(store.getIsHidden())),
    [store],
  )
}
