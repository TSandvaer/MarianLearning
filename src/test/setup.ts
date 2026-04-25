import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 25 ships an experimental built-in `localStorage` that pre-empts
// jsdom's Storage in vitest's environment, leaving us with an empty
// null-prototype object missing `getItem`/`setItem`/`clear`. Install a
// minimal in-memory Storage so progress tests (and anything else that
// touches storage) work the same way they will in Safari on the iPad.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

if (
  typeof window.localStorage?.setItem !== 'function' ||
  typeof window.localStorage?.clear !== 'function'
) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })
}

// Ensure every test teardown unmounts React trees.
afterEach(() => {
  cleanup()
})
