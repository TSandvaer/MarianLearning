import { afterEach, describe, expect, it, vi } from 'vitest'
import { getKeyValueStore, setKeyValueStore } from '@marian/core'
import {
  browserLocalStorage,
  installWebPlatform,
  readProgressApiSecret,
} from './web'

afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllEnvs()
  installWebPlatform()
})

describe('web platform for @marian/core', () => {
  it('the test setup installs window.localStorage as the store (same as boot)', () => {
    expect(getKeyValueStore()).toBe(browserLocalStorage)
  })

  it('installWebPlatform re-installs after an uninstall', () => {
    setKeyValueStore(null)
    installWebPlatform()
    expect(getKeyValueStore()).toBe(browserLocalStorage)
  })

  it('reads and writes window.localStorage', () => {
    browserLocalStorage.setItem('k', 'v')
    expect(window.localStorage.getItem('k')).toBe('v')
    window.localStorage.setItem('k2', 'v2')
    expect(browserLocalStorage.getItem('k2')).toBe('v2')
    browserLocalStorage.removeItem('k2')
    expect(window.localStorage.getItem('k2')).toBeNull()
  })

  it('resolves window.localStorage per call, not once at install', () => {
    const original = window.localStorage
    const swapped = new Map<string, string>([['k', 'from-swapped']])
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => swapped.get(key) ?? null,
        setItem: (key: string, value: string) => swapped.set(key, value),
        removeItem: (key: string) => swapped.delete(key),
      },
    })
    try {
      expect(browserLocalStorage.getItem('k')).toBe('from-swapped')
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: original,
      })
    }
  })

  it('reads the cloud-sync secret from the Vite env at call time', () => {
    vi.stubEnv('VITE_PROGRESS_API_SECRET', 'first')
    expect(readProgressApiSecret()).toBe('first')
    vi.stubEnv('VITE_PROGRESS_API_SECRET', 'second')
    expect(readProgressApiSecret()).toBe('second')
  })
})
