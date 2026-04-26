/**
 * In-memory `Storage` shim for vitest under Node 25 + jsdom.
 *
 * Why this exists
 * ---------------
 * Node 25 (verified on 25.6.1, 2026-04) ships an experimental built-in
 * `localStorage`/`sessionStorage` that activates inside vitest's worker
 * processes. It pre-empts jsdom's Storage and surfaces in `window` as a
 * null-prototype object with no methods — `setItem`, `getItem`, `clear`
 * etc. are all `undefined`. Any code that touches `window.localStorage`
 * (the real progress storage; the stardust persistence; iOS-private-mode
 * defenses) crashes the moment it runs.
 *
 * Originally added in PR #5 (ticket 86c9gkkyb). This module formalises it,
 * extends coverage to `sessionStorage`, and adds a configurable quota so
 * the QuotaExceededError path the iOS Safari private-mode handlers depend
 * on can be exercised end-to-end (not just via a `vi.spyOn`).
 *
 * When to delete
 * --------------
 * If `node --version` advances and `globalThis.localStorage?.setItem` is
 * a function on a fresh process, the experimental built-in has either
 * been removed or fixed. Re-run `installStorageShim()` from a vitest
 * test, observe whether `isStorageBroken()` returns `false`, and delete
 * this module + its hookup in `src/test/setup.ts`. Track that work in
 * ClickUp 86c9gn9th.
 */

/**
 * A spec-faithful in-memory `Storage`. Methods live on the prototype so
 * test code that does `vi.spyOn(window.localStorage.__proto__, 'setItem')`
 * keeps working — that's how `progress.test.ts` exercises the quota path.
 */
export class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>()

  /**
   * Soft byte-budget for all keys+values in this instance combined. When
   * a `setItem` would push the total above this number, we throw a
   * `DOMException('…', 'QuotaExceededError')` — same shape Safari throws.
   * `Number.POSITIVE_INFINITY` (the default) disables the limit.
   *
   * Tests that want to exercise quota-exceeded recovery can construct
   * a MemoryStorage with a small quota and install it ad-hoc, or call
   * `setQuota()` on the existing window.localStorage.
   */
  private quotaBytes: number = Number.POSITIVE_INFINITY

  setQuota(bytes: number): void {
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new RangeError(`MemoryStorage.setQuota: invalid quota ${bytes}`)
    }
    this.quotaBytes = bytes
  }

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    // Map.get returns undefined for absent keys; Storage spec demands null.
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    if (!Number.isInteger(index) || index < 0) return null
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    const k = String(key)
    const v = String(value)
    if (Number.isFinite(this.quotaBytes)) {
      const projected = this.projectedSize(k, v)
      if (projected > this.quotaBytes) {
        // Match the browser shape: a DOMException whose `.name` is
        // 'QuotaExceededError'. Code paths that grep on `err.name` (the
        // common pattern) will treat this exactly like Safari's throw.
        throw new DOMException(
          `MemoryStorage quota exceeded (${projected} > ${this.quotaBytes} bytes)`,
          'QuotaExceededError',
        )
      }
    }
    this.store.set(k, v)
  }

  /** UTF-16 byte size of all keys + values, with the candidate key
   *  swapped in. Cheap approximation — good enough to drive the quota
   *  branch in tests. */
  private projectedSize(candidateKey: string, candidateValue: string): number {
    let total = 0
    for (const [k, v] of this.store.entries()) {
      if (k === candidateKey) continue // existing entry will be replaced
      total += k.length * 2 + v.length * 2
    }
    total += candidateKey.length * 2 + candidateValue.length * 2
    return total
  }
}

/**
 * Returns true if the host's `Storage` (likely Node 25's experimental
 * built-in) is missing the methods our app depends on. The feature check
 * is intentionally narrow — we want the shim to disappear automatically
 * as soon as the platform fixes itself.
 */
export function isStorageBroken(storage: Storage | null | undefined): boolean {
  if (storage == null) return true
  return (
    typeof storage.setItem !== 'function' ||
    typeof storage.getItem !== 'function' ||
    typeof storage.clear !== 'function' ||
    typeof storage.removeItem !== 'function' ||
    typeof storage.key !== 'function'
  )
}

/**
 * Idempotently install the shim on the given window object for whichever
 * of `localStorage` / `sessionStorage` is currently broken. Returns the
 * names of the slots actually replaced — handy for assertions in the
 * regression test.
 */
export function installStorageShim(
  target: Window,
): Array<'localStorage' | 'sessionStorage'> {
  const replaced: Array<'localStorage' | 'sessionStorage'> = []
  for (const slot of ['localStorage', 'sessionStorage'] as const) {
    if (isStorageBroken(target[slot])) {
      Object.defineProperty(target, slot, {
        configurable: true,
        value: new MemoryStorage(),
      })
      replaced.push(slot)
    }
  }
  return replaced
}
