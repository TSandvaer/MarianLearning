/**
 * Bundle / cache sanity probe (ticket 86c9hjnn8 follow-up).
 *
 * Reads:
 *   - `CACHE_VERSION` + `STORE_NAME` from `lib/audio/sessionAudio.ts`
 *   - The IndexedDB schema version actually opened (post-onsuccess)
 *   - `import.meta.env.VITE_COMMIT_SHA` (injected by `vite.config.ts`)
 *   - The active service-worker registration's `scriptURL`, when present
 *
 * Why this exists
 * ---------------
 * Tomorrow's iPad QA needs a load-bearing line at the top of Thomas's
 * audioCtxLog export confirming he is running the new bundle. PWA
 * service-worker caching can pin a stale bundle for hours after a
 * deploy; without this probe a "still robotic, still no first-problem
 * audio" report could simply mean the new fix never reached the device.
 *
 * Behavior-neutral
 * ----------------
 * The probe is read-only. It opens an IndexedDB connection in
 * read-only-equivalent mode (no upgrade) just to read the version
 * number, then closes it immediately. It awaits the SW
 * `navigator.serviceWorker.ready` promise but does not register or
 * mutate anything. All failures (no IDB, no SW, throw on access) are
 * caught and recorded as `null`/`undefined` so a partial picture is
 * still better than no log.
 */

import { CACHE_VERSION, DB_NAME, STORE_NAME } from '../audio/sessionAudio'
import { recordBundleInitEvent, type BundleInitInfo } from './audioContextProbe'

/** Read the IndexedDB schema version actually persisted on disk. Returns
 *  `null` when IndexedDB is unavailable or the open call fails (Safari
 *  private mode, sandboxed iframe). Does NOT trigger an upgrade — opens
 *  with no version arg so the request resolves with whatever version is
 *  on disk. */
async function readIdbSchemaVersion(): Promise<number | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const version = await new Promise<number | null>((resolve) => {
      // No version arg → IDB resolves with the existing on-disk version
      // (or 1 if the DB is brand new). Wrapping in a separate promise so
      // a rejection from `req.onerror` doesn't fail the whole probe.
      let req: IDBOpenDBRequest
      try {
        req = indexedDB.open(DB_NAME)
      } catch {
        resolve(null)
        return
      }
      req.onsuccess = () => {
        const v = req.result.version
        try {
          req.result.close()
        } catch {
          // best-effort
        }
        resolve(typeof v === 'number' ? v : null)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    })
    return version
  } catch {
    return null
  }
}

/** Read the service-worker active registration's `scriptURL`, if any.
 *  Returns `null` when no SW is registered, or when the SW API throws. */
async function readServiceWorkerScriptUrl(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    // Use `getRegistration` rather than `ready` — `ready` waits forever
    // for a controlling SW which may never arrive in dev. A registered
    // but not-yet-active SW shows up here too.
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    const sw = reg.active ?? reg.installing ?? reg.waiting
    return sw?.scriptURL ?? null
  } catch {
    return null
  }
}

/** Read the build-time injected commit SHA. `'unknown'` when the env
 *  var was unset during the build (local dev, etc). */
function readCommitSha(): string {
  try {
    const sha = import.meta.env.VITE_COMMIT_SHA
    return typeof sha === 'string' && sha.length > 0 ? sha : 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Gather bundle-sanity info and emit the `bundle-init` row. Best-effort
 * — every async read is independently null-safe so a partial result
 * still lands in the audioCtxLog.
 *
 * Call exactly once per App mount, after `activateAudioContextProbe()`.
 * The probe being inactive is fine — the singleton wrapper is a no-op
 * in that case.
 */
export async function emitBundleInit(): Promise<void> {
  const info: BundleInitInfo = {
    cacheVersion: CACHE_VERSION,
    storeName: STORE_NAME,
    commitSha: readCommitSha(),
  }
  // Run the two async reads in parallel — they're independent and the
  // SW lookup can occasionally take a beat on iPad PWA.
  const [idbSchemaVersion, serviceWorkerScriptUrl] = await Promise.all([
    readIdbSchemaVersion(),
    readServiceWorkerScriptUrl(),
  ])
  info.idbSchemaVersion = idbSchemaVersion
  info.serviceWorkerScriptUrl = serviceWorkerScriptUrl
  recordBundleInitEvent(info)
}
