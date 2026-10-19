/**
 * The persistence seam for `@marian/core`.
 *
 * Core never touches `window.localStorage` (or any other storage API)
 * directly. The host installs a synchronous key-value store once at boot:
 *
 *   - web: `window.localStorage` (`src/platform/web.ts`, installed before
 *     the first render so `useState(loadProgress)` boot reads still work)
 *   - React Native: a synchronous store (expo-sqlite's localStorage
 *     polyfill or MMKV), Phase 2
 *
 * The interface is the synchronous subset of the Web Storage API, so
 * `window.localStorage` satisfies it as-is.
 *
 * With no store installed (SSR, a test in the node environment, a
 * browser where storage is disabled), every core reader behaves exactly
 * as it did when `window.localStorage` was unavailable: reads return
 * "nothing stored", writes are dropped.
 */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /**
   * Every stored key. Optional: native's sqlite store has it
   * (`getAllKeysSync`), the web's `localStorage` adapter needs none. Only
   * the learner list's rebuild reads it (`learners/learners.ts`).
   */
  keys?(): string[]
}

let installed: KeyValueStore | null = null

/** Install the host's store. `null` uninstalls it (tests). */
export function setKeyValueStore(store: KeyValueStore | null): void {
  installed = store
}

/** The installed store, or `null` when the host has none. */
export function getKeyValueStore(): KeyValueStore | null {
  return installed
}

/**
 * Run `fn` with `store` installed, then put the previous store back.
 * Synchronous only: nothing else runs in between, so every core reader
 * and writer `fn` calls sees `store`. Learner profiles use it to read and
 * write one learner's keys whoever is playing (`learners/learners.ts`
 * `boundLearner`).
 */
export function withKeyValueStore<T>(
  store: KeyValueStore | null,
  fn: () => T,
): T {
  const previous = installed
  installed = store
  try {
    return fn()
  } finally {
    installed = previous
  }
}
