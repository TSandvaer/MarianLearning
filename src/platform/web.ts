/**
 * The web host for `@marian/core`: the browser implementations of core's
 * platform seams.
 *
 * `installWebPlatform()` runs once per module graph, before anything
 * reads storage. In the app that is `./boot.ts` (imported first by
 * `App.tsx`); in unit tests it is `src/test/setup.ts`. A React Native
 * host installs its own implementations of the same seams.
 *
 * The API base (`setApiBase`) is not set here: the web app is served
 * from the same origin as its functions, so `apiUrl('/api/claude')`
 * stays relative.
 */
import {
  setKeyValueStore,
  type KeyValueStore,
} from '@marian/core/platform/keyValueStore'
import { setDayOffsetSource } from '@marian/core/progress/clock'
import { setCloudSyncAuthSecretSource } from '@marian/core/progress/cloudSync'
import { isDebugEnabled } from '../lib/debug/isDebugEnabled'

/** The current `window.localStorage`, or `null` where it is missing. The
 *  getter can throw (locked-down iframes); core's callers catch it. */
function currentLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  return window.localStorage
}

/**
 * `window.localStorage` as core's `KeyValueStore`.
 *
 * It resolves `window.localStorage` on every call instead of capturing it
 * once, which is exactly what core's readers did before the seam
 * existed: a missing store reads as "nothing stored" and drops writes,
 * and a getter that throws is caught by the caller's try/catch. Per-call
 * resolution also keeps parity when something swaps `window.localStorage`
 * at runtime (a test fake, a sandbox revoking access).
 */
export const browserLocalStorage: KeyValueStore = {
  getItem(key) {
    const storage = currentLocalStorage()
    return storage ? storage.getItem(key) : null
  },
  setItem(key, value) {
    currentLocalStorage()?.setItem(key, value)
  },
  removeItem(key) {
    currentLocalStorage()?.removeItem(key)
  },
}

/** The raw `dayOffset` query value, gated on `?debug=1`. Read per call. */
export function readDayOffsetParam(): string | null {
  if (!isDebugEnabled()) return null
  return new URLSearchParams(window.location.search).get('dayOffset')
}

/** The cloud-sync secret Vite bakes in at build. Read per call, so unit
 *  tests can flip it with `vi.stubEnv`. */
export function readProgressApiSecret(): unknown {
  return (import.meta.env as Record<string, unknown>).VITE_PROGRESS_API_SECRET
}

export function installWebPlatform(): void {
  // No `window` (SSR, Vitest's node environment): no store, so core falls
  // back exactly as it did when it checked `typeof window` itself.
  setKeyValueStore(typeof window === 'undefined' ? null : browserLocalStorage)
  setDayOffsetSource(readDayOffsetParam)
  setCloudSyncAuthSecretSource(readProgressApiSecret)
}
