import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MemoryStorage,
  installStorageShim,
  isStorageBroken,
} from './storageShim'

/**
 * Regression coverage for the Node 25 / jsdom Storage shim.
 *
 * The shim is set up in `src/test/setup.ts`; if a future toolchain
 * upgrade (or a misguided refactor) breaks it, every test that touches
 * `window.localStorage` would silently start using the platform default
 * again — which on Node 25 is the broken null-prototype object. These
 * assertions catch that regression before it ships.
 */

describe('storage shim — installed window state', () => {
  it('window.localStorage exposes the full Storage API', () => {
    const ls = window.localStorage
    expect(typeof ls.setItem).toBe('function')
    expect(typeof ls.getItem).toBe('function')
    expect(typeof ls.removeItem).toBe('function')
    expect(typeof ls.clear).toBe('function')
    expect(typeof ls.key).toBe('function')
    expect(typeof ls.length).toBe('number')
  })

  it('window.sessionStorage exposes the full Storage API', () => {
    const ss = window.sessionStorage
    expect(typeof ss.setItem).toBe('function')
    expect(typeof ss.getItem).toBe('function')
    expect(typeof ss.removeItem).toBe('function')
    expect(typeof ss.clear).toBe('function')
    expect(typeof ss.key).toBe('function')
  })

  it('round-trips a value through the installed localStorage', () => {
    window.localStorage.clear()
    window.localStorage.setItem('shim-test', 'hello')
    expect(window.localStorage.getItem('shim-test')).toBe('hello')
    window.localStorage.removeItem('shim-test')
    expect(window.localStorage.getItem('shim-test')).toBeNull()
  })

  it('localStorage and sessionStorage are independent stores', () => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem('k', 'local')
    window.sessionStorage.setItem('k', 'session')
    expect(window.localStorage.getItem('k')).toBe('local')
    expect(window.sessionStorage.getItem('k')).toBe('session')
  })

  it('exposes setItem on the prototype so vi.spyOn works', () => {
    // progress.test.ts spies on `window.localStorage.__proto__.setItem` to
    // exercise the QuotaExceededError path. If this assertion fails, that
    // test will silently no-op.
    const proto = Object.getPrototypeOf(window.localStorage) as Storage
    expect(typeof proto.setItem).toBe('function')
    expect(Object.prototype.hasOwnProperty.call(proto, 'setItem')).toBe(true)
  })
})

describe('isStorageBroken', () => {
  it('returns true for null/undefined', () => {
    expect(isStorageBroken(null)).toBe(true)
    expect(isStorageBroken(undefined)).toBe(true)
  })

  it('returns true for an object missing setItem', () => {
    const partial = {
      getItem: () => null,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as unknown as Storage
    expect(isStorageBroken(partial)).toBe(true)
  })

  it('returns true for the Node 25 null-prototype object shape', () => {
    // Reproduces what Node 25 hands jsdom: an empty object with no proto.
    const broken = Object.create(null) as Storage
    expect(isStorageBroken(broken)).toBe(true)
  })

  it('returns false for a fully implemented Storage', () => {
    expect(isStorageBroken(new MemoryStorage())).toBe(false)
  })
})

describe('installStorageShim', () => {
  it('is idempotent — re-running on an already-shimmed window is a no-op', () => {
    // `setup.ts` already installed the shim on `window`. A second call
    // should detect the working Storage and replace nothing.
    const replaced = installStorageShim(window)
    expect(replaced).toEqual([])
  })

  it('installs both slots on a fresh fake window with broken storage', () => {
    const fake = {
      localStorage: Object.create(null) as Storage,
      sessionStorage: Object.create(null) as Storage,
    } as unknown as Window
    const replaced = installStorageShim(fake)
    expect(replaced.sort()).toEqual(['localStorage', 'sessionStorage'])
    expect(typeof fake.localStorage.setItem).toBe('function')
    expect(typeof fake.sessionStorage.setItem).toBe('function')
  })
})

describe('MemoryStorage', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('starts with length 0 and null reads', () => {
    expect(storage.length).toBe(0)
    expect(storage.getItem('missing')).toBeNull()
    expect(storage.key(0)).toBeNull()
  })

  it('coerces non-string values to strings, like spec Storage', () => {
    storage.setItem('n', 42 as unknown as string)
    expect(storage.getItem('n')).toBe('42')
  })

  it('replaces values on duplicate setItem without growing length', () => {
    storage.setItem('k', 'one')
    storage.setItem('k', 'two')
    expect(storage.length).toBe(1)
    expect(storage.getItem('k')).toBe('two')
  })

  it('clear() empties the store', () => {
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
    expect(storage.getItem('a')).toBeNull()
  })

  it('key(index) returns insertion order, null for out-of-range', () => {
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    expect(storage.key(0)).toBe('first')
    expect(storage.key(1)).toBe('second')
    expect(storage.key(2)).toBeNull()
    expect(storage.key(-1)).toBeNull()
  })

  describe('quota simulation', () => {
    it('throws DOMException with name QuotaExceededError when over budget', () => {
      storage.setQuota(20) // ~10 UTF-16 chars combined
      expect(() => {
        storage.setItem('long-key-name', 'long-value-that-exceeds')
      }).toThrow(DOMException)

      try {
        storage.setItem('long-key-name', 'long-value-that-exceeds')
      } catch (err) {
        expect(err).toBeInstanceOf(DOMException)
        expect((err as DOMException).name).toBe('QuotaExceededError')
      }
    })

    it('allows writes that fit within quota', () => {
      storage.setQuota(200)
      expect(() => storage.setItem('k', 'v')).not.toThrow()
      expect(storage.getItem('k')).toBe('v')
    })

    it('replacing an existing key does not double-count its old value', () => {
      // 4 chars total in the store at all times — well under 100 bytes.
      storage.setQuota(100)
      storage.setItem('k', 'aaaa')
      expect(() => storage.setItem('k', 'bbbb')).not.toThrow()
      expect(storage.getItem('k')).toBe('bbbb')
    })

    it('rejects nonsensical quota values', () => {
      expect(() => storage.setQuota(-1)).toThrow(RangeError)
      expect(() => storage.setQuota(NaN)).toThrow(RangeError)
    })

    it('quota of POSITIVE_INFINITY (default) never throws', () => {
      const s = new MemoryStorage()
      // 10 KB write
      const big = 'x'.repeat(10_000)
      expect(() => s.setItem('huge', big)).not.toThrow()
      expect(s.getItem('huge')).toBe(big)
    })
  })

  // Sanity: leave the global storage clean for whatever runs next.
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
})
