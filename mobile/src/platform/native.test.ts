import { apiUrl, getKeyValueStore, setApiBase } from '@marian/core'
import { DEBUG_SEED_NAMES } from '@marian/core/debug/seeds'
import { QA_STEPS } from '@marian/core/debug/stepProgress'
import { currentStepOf } from '@marian/core/hub/hubCardModel'
import {
  LEARNERS_STORAGE_KEY,
  activeLearner,
  resetLearnersForTests,
} from '@marian/core/learners'
import {
  LAST_SYNC_STORAGE_KEY,
  STORAGE_KEY,
  getOrCreateDeviceId,
  loadProgress,
  readLastSyncISO,
  reconcileAtLaunch,
  saveProgress,
  type Progress,
} from '@marian/core/progress'
import { dayOffset } from '@marian/core/progress/clock'
import { pushProgressToCloud } from '@marian/core/progress/cloudSync'
import { defaultProgress } from '@marian/core/progress/defaults'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
import { recordProgressOnSessionEnd } from '@marian/core/sessionEnd/progressHistory'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  readSessionHistory,
} from '@marian/core/sessionEnd/sessionHistory'
import type { BuildEnv } from './buildEnv'
import {
  buildMathSessionPayload,
  readMathProgressHints,
} from '../session/mathSession'
import {
  buildWordSongSessionPayload,
  readWordSongProgressHints,
} from '../session/wordSongHints'
import {
  NO_LAUNCH_FLAGS,
  buildEnvSource,
  resolveLaunchFlags,
  type LaunchFlags,
  type LaunchFlagSource,
} from './launchFlags'
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
    getAllKeysSync: () => [...map.keys()],
  }
}

/**
 * What a fresh install's boot writes (learner profiles § 4.3, T7): the
 * learner list and learner 1's floor start doc, nothing else.
 */
const FRESH_INSTALL_KEYS = [LEARNERS_STORAGE_KEY, STORAGE_KEY].sort()

const EMPTY_ENV: BuildEnv = {
  apiBase: undefined,
  progressApiSecret: undefined,
  debug: undefined,
  seed: undefined,
  qaStep: undefined,
  dayOffset: undefined,
  mute: undefined,
  audioCheck: undefined,
  qaAutoTapMs: undefined,
  qaRoute: undefined,
}

const DEBUG_FLAGS: LaunchFlags = {
  debug: true,
  seed: null,
  qaStep: null,
  dayOffset: null,
}

afterEach(() => {
  setApiBase('')
  resetLearnersForTests()
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

  it('lists keys through getAllKeysSync when the backend has it', () => {
    const backend = memoryBackend()
    const store = sqliteKeyValueStore(backend)
    store.setItem('a', '1')
    expect(store.keys?.()).toEqual(['a'])
    const noKeys: SyncKeyValueBackend = { ...memoryBackend() }
    delete noKeys.getAllKeysSync
    expect(sqliteKeyValueStore(noKeys).keys).toBeUndefined()
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

  describe('records each successful cloud sync as "Last synced"', () => {
    const SYNC_AT = '2026-10-13T09:41:00.000Z'
    const PLAYED_AT = '2026-10-12T18:00:00.000Z'
    const SECRET_ENV: BuildEnv = { ...EMPTY_ENV, progressApiSecret: 's3cret' }

    function install(env: BuildEnv = SECRET_ENV) {
      const backend = memoryBackend()
      installNativePlatform({ backend, env, flags: NO_LAUNCH_FLAGS })
      return backend
    }

    function played(): Progress {
      const p = defaultProgress()
      return { ...p, profile: { ...p.profile, lastPlayedISO: PLAYED_AT } }
    }

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(SYNC_AT) })
      jest.spyOn(console, 'warn').mockImplementation(() => {})
      // `fetch` is the setup file's jest.fn, which restoreAllMocks leaves
      // alone: clear its calls so each test counts its own.
      jest.mocked(globalThis.fetch).mockClear()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    it('a push the server accepts (Push now, session end)', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
      const backend = install()
      // The playing learner's own sync ID (learner 1: today's device ID).
      await expect(
        pushProgressToCloud(getOrCreateDeviceId(), defaultProgress()),
      ).resolves.toBe('sent')
      expect(backend.map.get(LAST_SYNC_STORAGE_KEY)).toBe(SYNC_AT)
      expect(readLastSyncISO()).toBe(SYNC_AT)
    })

    it('a push to an ID no learner here holds records nothing (K3)', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
      const backend = install()
      await expect(
        pushProgressToCloud(
          '11111111-2222-4333-8444-555555555555',
          defaultProgress(),
        ),
      ).resolves.toBe('sent')
      expect(backend.map.has(LAST_SYNC_STORAGE_KEY)).toBe(false)
    })

    it("the session-end write's own push", async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
      const backend = install()
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: PLAYED_AT,
        focusNode: 'add-to-10',
      })
      expect(backend.map.has(LAST_SYNC_STORAGE_KEY)).toBe(false)
      // The write doesn't await its push; let it settle.
      for (let i = 0; i < 10; i++) await Promise.resolve()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(backend.map.get(LAST_SYNC_STORAGE_KEY)).toBe(SYNC_AT)
    })

    it('a launch reconcile that finds the cloud copy equal', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            blob: played(),
            lastModifiedISO: PLAYED_AT,
          }),
          { status: 200 },
        ),
      )
      const backend = install()
      saveProgress(played())
      await expect(reconcileAtLaunch()).resolves.toEqual({
        kind: 'noop',
        reason: 'equal',
      })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(backend.map.get(LAST_SYNC_STORAGE_KEY)).toBe(SYNC_AT)
    })

    it('a push the server refuses records nothing', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('', { status: 503 }))
      const backend = install()
      await expect(
        pushProgressToCloud(
          '11111111-2222-4333-8444-555555555555',
          defaultProgress(),
        ),
      ).resolves.toBe('failed')
      expect(backend.map.has(LAST_SYNC_STORAGE_KEY)).toBe(false)
    })

    it('without the secret, Push now and the launch reconcile record nothing', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const backend = install(EMPTY_ENV)
      saveProgress(played())
      await expect(
        pushProgressToCloud('11111111-2222-4333-8444-555555555555', played()),
      ).resolves.toBe('skipped')
      await expect(reconcileAtLaunch()).resolves.toEqual({ kind: 'off' })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(backend.map.has(LAST_SYNC_STORAGE_KEY)).toBe(false)
    })
  })
})

describe('bootNative', () => {
  it('fresh install, no debug: Splash goes to Greet, at land 1 in both worlds (T7)', () => {
    const backend = memoryBackend()
    bootNative({ backend, env: EMPTY_ENV, flags: NO_LAUNCH_FLAGS })
    expect(nextAfterSplash()).toBe('greet')
    expect([...backend.map.keys()].sort()).toEqual(FRESH_INSTALL_KEYS)
    expect(currentStepOf(loadProgress()!, 'math')).toBe('number-recog')
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe('letter-names')
    expect(activeLearner()).toMatchObject({ legacySlot: true, name: '' })
  })

  it("an upgrade keeps today's keys byte-equal and adds only the list (P3)", () => {
    const backend = memoryBackend()
    const played: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-10-18T17:00:00.000Z',
      },
    }
    backend.map.set(STORAGE_KEY, JSON.stringify(played))
    backend.map.set(
      SESSION_HISTORY_KEY,
      JSON.stringify({ ...emptySessionHistory(), sessionCount: 40 }),
    )
    backend.map.set(
      'marian-tutor:device-id',
      '11111111-2222-4333-8444-555555555555',
    )
    const before = new Map(backend.map)
    bootNative({ backend, env: EMPTY_ENV, flags: NO_LAUNCH_FLAGS })
    for (const [key, value] of before) expect(backend.map.get(key)).toBe(value)
    expect([...backend.map.keys()].filter((k) => !before.has(k))).toEqual([
      LEARNERS_STORAGE_KEY,
    ])
    expect(nextAfterSplash()).toBe('hub')
    expect(loadProgress()?.skillLevels['add-to-10']).toBe('practicing')
    expect(activeLearner()).toMatchObject({ legacySlot: true, name: 'Marian' })
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
    expect([...backend.map.keys()].sort()).toEqual(FRESH_INSTALL_KEYS)
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

  it('-qaStep: progress at that step through the sqlite store, and Splash goes to the Hub', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const backend = memoryBackend()
    bootNative({
      backend,
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, qaStep: 'mult-6-9' },
    })
    expect(currentStepOf(loadProgress()!, 'math')).toBe('mult-6-9')
    // The other world keeps the learner's start: a fresh install's land 1.
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe('letter-names')
    expect(readSessionHistory().sessionCount).toBe(1)
    expect(nextAfterSplash()).toBe('hub')
    expect(log).toHaveBeenCalledWith('[qaStep] jumped to "mult-6-9"')
  })

  it('an unknown qaStep warns once, writes nothing, and Splash goes to Greet', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const backend = memoryBackend()
    bootNative({
      backend,
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, qaStep: 'digraphs' },
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('Unknown step: "digraphs"')
    expect([...backend.map.keys()].sort()).toEqual(FRESH_INSTALL_KEYS)
    expect(nextAfterSplash()).toBe('greet')
  })

  it('qaStep is written on every launch: play made since is reset', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const backend = memoryBackend()
    const flags = { ...DEBUG_FLAGS, qaStep: 'cvc-words' }
    bootNative({ backend, env: EMPTY_ENV, flags })
    const played = loadProgress()!
    saveProgress({
      ...played,
      skillLevels: { ...played.skillLevels, 'cvc-words': 'mastered' },
    })
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe(
      'cvc-words-short-o',
    )
    bootNative({ backend, env: EMPTY_ENV, flags })
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe('cvc-words')
  })

  it('a seed given with qaStep patches on top of the jump', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    bootNative({
      backend: memoryBackend(),
      env: EMPTY_ENV,
      flags: { ...DEBUG_FLAGS, qaStep: 'mult-6-9', seed: 'cvc-words' },
    })
    expect(currentStepOf(loadProgress()!, 'math')).toBe('mult-6-9')
    expect(currentStepOf(loadProgress()!, 'word-song')).toBe('cvc-words')
  })

  it('every step (15 + 23): qaStep lands the Hub and the session start on it', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const landed: string[] = []
    for (const { node, world } of QA_STEPS) {
      bootNative({
        backend: memoryBackend(),
        env: EMPTY_ENV,
        flags: { ...DEBUG_FLAGS, qaStep: node },
      })
      expect(currentStepOf(loadProgress()!, world)).toBe(node)
      const payload =
        world === 'math'
          ? buildMathSessionPayload(readMathProgressHints(), true)
          : buildWordSongSessionPayload(readWordSongProgressHints(), true)
      expect(payload.track).toBe(world)
      expect((payload.progress as { focusNode?: string }).focusNode).toBe(node)
      landed.push(node)
    }
    expect(landed).toEqual(QA_STEPS.map((s) => s.node))
    expect(landed).toHaveLength(38)
  })

  it('release safety: without debug 1, a qaStep from either source writes nothing', () => {
    const backend = memoryBackend()
    const launchArgs: LaunchFlagSource = (name) =>
      name === 'qaStep' ? 'mult-6-9' : undefined
    const flags = resolveLaunchFlags([
      launchArgs,
      buildEnvSource({ ...EMPTY_ENV, qaStep: 'simple-sentences' }),
    ])
    bootNative({ backend, env: EMPTY_ENV, flags })
    expect(flags.qaStep).toBeNull()
    expect([...backend.map.keys()].sort()).toEqual(FRESH_INSTALL_KEYS)
    expect(nextAfterSplash()).toBe('greet')
  })
})
