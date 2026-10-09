import { apiUrl, getKeyValueStore, setApiBase } from '@marian/core'
import { DEBUG_SEED_NAMES } from '@marian/core/debug/seeds'
import { loadProgress } from '@marian/core/progress'
import { dayOffset } from '@marian/core/progress/clock'
import { pushProgressToCloud } from '@marian/core/progress/cloudSync'
import { defaultProgress } from '@marian/core/progress/defaults'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
import {
  SESSION_HISTORY_KEY,
  readSessionHistory,
} from '@marian/core/sessionEnd/sessionHistory'
import type { BuildEnv } from './buildEnv'
import { NO_LAUNCH_FLAGS, type LaunchFlags } from './launchFlags'
import {
  DEFAULT_API_BASE,
  bootNative,
  installNativePlatform,
  resolveApiBase,
  sqliteKeyValueStore,
  type SyncKeyValueBackend,
} from './native'

/** An in-memory stand-in for expo-sqlite's synchronous kv-store API. */
function memoryBackend(): SyncKeyValueBackend & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItemSync: (key) => map.get(key) ?? null,
    setItemSync: (key, value) => {
      map.set(key, value)
    },
    removeItemSync: (key) => map.delete(key),
  }
}

const EMPTY_ENV: BuildEnv = {
  apiBase: undefined,
  progressApiSecret: undefined,
  debug: undefined,
  seed: undefined,
  dayOffset: undefined,
  mute: undefined,
  audioCheck: undefined,
  qaAutoTapMs: undefined,
}

const DEBUG_FLAGS: LaunchFlags = { debug: true, seed: null, dayOffset: null }

afterEach(() => {
  setApiBase('')
  jest.restoreAllMocks()
})

describe('sqliteKeyValueStore', () => {
  it('delegates to the synchronous kv-store methods', () => {
    const backend = memoryBackend()
    const store = sqliteKeyValueStore(backend)
    store.setItem('k', 'v')
    expect(backend.map.get('k')).toBe('v')
    expect(store.getItem('k')).toBe('v')
    store.removeItem('k')
    expect(store.getItem('k')).toBeNull()
  })

  it('lets backend errors reach core (whose readers catch them)', () => {
    const store = sqliteKeyValueStore({
      getItemSync: () => {
        throw new Error('db closed')
      },
      setItemSync: () => {},
      removeItemSync: () => true,
    })
    expect(() => store.getItem('k')).toThrow('db closed')
  })
})

describe('resolveApiBase', () => {
  it.each([undefined, '', '   '])('%j → production', (raw) => {
    expect(resolveApiBase(raw)).toBe(DEFAULT_API_BASE)
  })

  it('uses EXPO_PUBLIC_API_BASE when set', () => {
    expect(resolveApiBase(' http://localhost:3000 ')).toBe(
      'http://localhost:3000',
    )
  })
})

describe('installNativePlatform', () => {
  it('installs the sqlite store as core’s store', () => {
    const backend = memoryBackend()
    installNativePlatform({ backend, env: EMPTY_ENV, flags: NO_LAUNCH_FLAGS })
    getKeyValueStore()?.setItem('probe', '1')
    expect(backend.map.get('probe')).toBe('1')
  })

  it('points /api/* at production by default', () => {
    installNativePlatform({
      backend: memoryBackend(),
      env: EMPTY_ENV,
      flags: NO_LAUNCH_FLAGS,
    })
    expect(apiUrl('/api/claude')).toBe(
      'https://marian-learning.vercel.app/api/claude',
    )
  })

  it('points /api/* at EXPO_PUBLIC_API_BASE when set', () => {
    installNativePlatform({
      backend: memoryBackend(),
      env: { ...EMPTY_ENV, apiBase: 'https://preview.example.app/' },
      flags: NO_LAUNCH_FLAGS,
    })
    expect(apiUrl('/api/progress')).toBe(
      'https://preview.example.app/api/progress',
    )
  })

  it('feeds the debug day offset to the progress clock', () => {
    installNativePlatform({
      backend: memoryBackend(),
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, dayOffset: '3' },
    })
    expect(dayOffset()).toBe(3)
    installNativePlatform({
      backend: memoryBackend(),
      env: EMPTY_ENV,
      flags: NO_LAUNCH_FLAGS,
    })
    expect(dayOffset()).toBe(0)
  })

  it('cloud sync is skipped without EXPO_PUBLIC_PROGRESS_API_SECRET', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    installNativePlatform({
      backend: memoryBackend(),
      env: EMPTY_ENV,
      flags: NO_LAUNCH_FLAGS,
    })
    await expect(
      pushProgressToCloud(
        '11111111-2222-4333-8444-555555555555',
        defaultProgress(),
      ),
    ).resolves.toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('cloud sync sends the secret, to the configured base', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    installNativePlatform({
      backend: memoryBackend(),
      env: { ...EMPTY_ENV, progressApiSecret: 's3cret' },
      flags: NO_LAUNCH_FLAGS,
    })
    await expect(
      pushProgressToCloud(
        '11111111-2222-4333-8444-555555555555',
        defaultProgress(),
      ),
    ).resolves.toBe('sent')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://marian-learning.vercel.app/api/progress')
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer s3cret',
    )
  })
})

describe('bootNative', () => {
  it('fresh install, no debug: Splash goes to Greet', () => {
    const backend = memoryBackend()
    bootNative({ backend, env: EMPTY_ENV, flags: NO_LAUNCH_FLAGS })
    expect(nextAfterSplash()).toBe('greet')
    expect(backend.map.size).toBe(0)
  })

  it('applies a debug seed through the sqlite store before any read', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const backend = memoryBackend()
    bootNative({
      backend,
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, seed: 'cvc-words' },
    })
    expect(readSessionHistory().sessionCount).toBe(1)
    expect(nextAfterSplash()).toBe('hub')
    expect(loadProgress()?.skillLevels['cvc-words']).toBe('practicing')
    expect(backend.map.has(SESSION_HISTORY_KEY)).toBe(true)
  })

  it('an unknown seed warns, writes nothing, and Splash goes to Greet', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const backend = memoryBackend()
    bootNative({
      backend,
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, seed: 'banana' },
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('Unknown seed value: "banana"')
    expect(backend.map.size).toBe(0)
    expect(nextAfterSplash()).toBe('greet')
  })

  it('every core seed applies natively', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(DEBUG_SEED_NAMES.length).toBeGreaterThan(10)
    for (const seed of DEBUG_SEED_NAMES) {
      const backend = memoryBackend()
      bootNative({ backend, env: EMPTY_ENV, flags: { ...DEBUG_FLAGS, seed } })
      expect(loadProgress()).not.toBeNull()
    }
  })
})
