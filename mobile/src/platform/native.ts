/**
 * The native host for `@marian/core`: React Native implementations of
 * core's platform seams (the web host is `src/platform/web.ts` at the
 * repo root).
 *
 *   - storage:    a synchronous `KeyValueStore` on expo-sqlite
 *   - API base:   `EXPO_PUBLIC_API_BASE`, default production
 *   - cloud sync: `EXPO_PUBLIC_PROGRESS_API_SECRET`
 *   - day offset: the debug launch flag
 *
 * `bootNative()` installs them and then applies a debug seed, in that
 * order, before anything reads storage. `./boot.ts` calls it with the
 * real dependencies; tests call it with fakes.
 */
import {
  setApiBase,
  setCloudSyncAuthSecretSource,
  setDayOffsetSource,
  setKeyValueStore,
  type KeyValueStore,
} from '@marian/core'
import { applyDebugSeed } from '@marian/core/debug/seeds'
import type { BuildEnv } from './buildEnv'
import { setLaunchFlags, type LaunchFlags } from './launchFlags'

/** The production deployment that serves `/api/*`. */
export const DEFAULT_API_BASE = 'https://marian-learning.vercel.app'

/**
 * The synchronous half of expo-sqlite's `SQLiteStorage`
 * (`expo-sqlite/kv-store`). Sync is the point: core's boot reads
 * (`useState(loadProgress)`, `nextAfterSplash()`) are synchronous.
 */
export interface SyncKeyValueBackend {
  getItemSync(key: string): string | null
  setItemSync(key: string, value: string): void
  removeItemSync(key: string): unknown
}

/**
 * Core's `KeyValueStore` over expo-sqlite's synchronous key-value API.
 *
 * The default `Storage` instance is the same database expo-sqlite's
 * `localStorage` polyfill writes to (`ExpoSQLiteStorage`), but this app
 * does not install that global: storage goes through core's seam only.
 * Errors propagate; core's readers and writers already catch them.
 */
export function sqliteKeyValueStore(
  backend: SyncKeyValueBackend,
): KeyValueStore {
  return {
    getItem: (key) => backend.getItemSync(key),
    setItem: (key, value) => backend.setItemSync(key, value),
    removeItem: (key) => {
      backend.removeItemSync(key)
    },
  }
}

/** `EXPO_PUBLIC_API_BASE` when set (trailing slashes are fine), else production. */
export function resolveApiBase(raw: string | undefined): string {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : DEFAULT_API_BASE
}

export interface NativePlatformDeps {
  backend: SyncKeyValueBackend
  env: BuildEnv
  flags: LaunchFlags
}

/** Install the native implementations of every core seam. */
export function installNativePlatform({
  backend,
  env,
  flags,
}: NativePlatformDeps): void {
  setKeyValueStore(sqliteKeyValueStore(backend))
  setApiBase(resolveApiBase(env.apiBase))
  setCloudSyncAuthSecretSource(() => env.progressApiSecret)
  // `flags.dayOffset` is already null unless debug is on.
  setDayOffsetSource(() => flags.dayOffset)
}

/**
 * Install the platform, record the launch flags (`getLaunchFlags()`),
 * then apply the debug seed (if any) through the freshly installed
 * store. Must run before any core storage read.
 */
export function bootNative(deps: NativePlatformDeps): void {
  installNativePlatform(deps)
  setLaunchFlags(deps.flags)
  if (deps.flags.seed !== null) {
    if (applyDebugSeed(deps.flags.seed)) {
      console.log(`[debugSeed] applied "${deps.flags.seed}"`)
    }
  }
}
