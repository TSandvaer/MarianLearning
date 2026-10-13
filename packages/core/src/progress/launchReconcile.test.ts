// @vitest-environment node
/**
 * The launch-time cloud reconcile: off without a secret, the web's three
 * steps with one, never rejecting. Web parity runs end to end: the web's
 * boot-effect body (`src/App.tsx`, frozen) and `reconcileAtLaunch` against
 * the same stubbed `/api/progress` must send the same requests, return
 * the same outcome and leave the same bytes in storage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import {
  isCloudSyncConfigured,
  reconcileWithCloud,
  setCloudSyncAuthSecretSource,
  type ReconcileOutcome,
} from './cloudSync'
import { defaultProgress } from './defaults'
import { DEVICE_ID_STORAGE_KEY, getOrCreateDeviceId } from './deviceId'
import {
  reconcileAtLaunch,
  type LaunchReconcileDeps,
  type LaunchReconcileResult,
} from './launchReconcile'
import { loadProgress, STORAGE_KEY } from './storage'
import type { Progress } from './types'

const DEVICE_ID = '11111111-2222-4333-8444-555555555555'
const LOCAL_ISO = '2026-10-12T08:00:00.000Z'
const CLOUD_ISO = '2026-10-13T08:00:00.000Z'

afterEach(() => {
  setKeyValueStore(null)
  setCloudSyncAuthSecretSource(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** A memory store that counts writes per key. */
function memoryStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  const writes = new Map<string, number>()
  const store: KeyValueStore = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes.set(k, (writes.get(k) ?? 0) + 1)
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
  return { store, map, writes }
}

function progressPlayedAt(iso: string, childName: string): Progress {
  const base = defaultProgress()
  return {
    ...base,
    profile: { ...base.profile, lastPlayedISO: iso, childName },
  }
}

/** Deps that record each step; `reconcile` answers `outcome`. */
function recordingDeps(
  configured: boolean,
  outcome: ReconcileOutcome = { kind: 'noop', reason: 'equal' },
) {
  const order: string[] = []
  const deps: LaunchReconcileDeps = {
    configured: () => {
      order.push('configured')
      return configured
    },
    getDeviceId: () => {
      order.push('deviceId')
      return DEVICE_ID
    },
    loadLocal: () => {
      order.push('load')
      return null
    },
    reconcile: async (id) => {
      order.push(`reconcile:${id}`)
      return outcome
    },
  }
  return { order, deps }
}

describe('reconcileAtLaunch', () => {
  it('off without a secret: no ID, no read, no request', async () => {
    const { order, deps } = recordingDeps(false)
    await expect(reconcileAtLaunch(deps)).resolves.toEqual({ kind: 'off' })
    expect(order).toEqual(['configured'])
  })

  it("with a secret: the web's three steps, in its order, once each", async () => {
    const outcome: ReconcileOutcome = {
      kind: 'installed-from-cloud',
      progress: defaultProgress(),
    }
    const { order, deps } = recordingDeps(true, outcome)
    await expect(reconcileAtLaunch(deps)).resolves.toBe(outcome)
    expect(order).toEqual([
      'configured',
      'deviceId',
      'load',
      `reconcile:${DEVICE_ID}`,
    ])
  })

  it('a throwing step resolves to threw, and nothing after it runs', async () => {
    const { order, deps } = recordingDeps(true)
    deps.getDeviceId = () => {
      order.push('deviceId')
      throw new Error('storage gone')
    }
    await expect(reconcileAtLaunch(deps)).resolves.toEqual({ kind: 'threw' })
    expect(order).toEqual(['configured', 'deviceId'])

    const rejecting = recordingDeps(true)
    rejecting.deps.reconcile = () => Promise.reject(new Error('bug'))
    await expect(reconcileAtLaunch(rejecting.deps)).resolves.toEqual({
      kind: 'threw',
    })
  })
})

describe('isCloudSyncConfigured', () => {
  it('follows the host secret source: only a non-empty string is on', () => {
    expect(isCloudSyncConfigured()).toBe(false)
    for (const secret of [undefined, null, '', 42]) {
      setCloudSyncAuthSecretSource(() => secret)
      expect(isCloudSyncConfigured()).toBe(false)
    }
    setCloudSyncAuthSecretSource(() => 's3cret')
    expect(isCloudSyncConfigured()).toBe(true)
  })
})

describe('the default steps', () => {
  it('no secret source: off, and nothing is sent or written (not even a device ID)', async () => {
    const { store, writes } = memoryStore()
    setKeyValueStore(store)
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(reconcileAtLaunch()).resolves.toEqual({ kind: 'off' })
    expect(fetchStub).toHaveBeenCalledTimes(0)
    expect([...writes.values()].reduce((a, b) => a + b, 0)).toBe(0)
  })

  type Cloud =
    | { status: 404 }
    | { status: 200; blob: Progress; lastModifiedISO: string }

  /** `/api/progress` answering `cloud` to GET and `ok` to POST. */
  function cloudStub(cloud: Cloud) {
    return vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (cloud.status === 404) {
        return new Response(JSON.stringify({ error: 'not-found' }), {
          status: 404,
        })
      }
      return new Response(
        JSON.stringify({
          ok: true,
          blob: cloud.blob,
          lastModifiedISO: cloud.lastModifiedISO,
        }),
        { status: 200 },
      )
    })
  }

  /** The requests a stub saw, without the abort signal. */
  function requests(stub: ReturnType<typeof cloudStub>) {
    return stub.mock.calls.map(([url, init]) => ({
      url,
      method: init?.method,
      body: init?.body,
    }))
  }

  /** Run `launch` on a fresh store holding `local`; report what it did. */
  async function runOn(
    local: Progress,
    cloud: Cloud,
    launch: () => Promise<LaunchReconcileResult>,
  ) {
    const mem = memoryStore({
      [DEVICE_ID_STORAGE_KEY]: DEVICE_ID,
      [STORAGE_KEY]: JSON.stringify(local),
    })
    setKeyValueStore(mem.store)
    const stub = cloudStub(cloud)
    vi.stubGlobal('fetch', stub)
    const outcome = await launch()
    return {
      outcome,
      requests: requests(stub),
      stored: mem.map.get(STORAGE_KEY),
      progressWrites: mem.writes.get(STORAGE_KEY) ?? 0,
    }
  }

  /** The web's boot effect body (`src/App.tsx`, frozen). */
  async function webBootReconcile(): Promise<LaunchReconcileResult> {
    const deviceId = getOrCreateDeviceId()
    const local = loadProgress()
    return reconcileWithCloud(deviceId, local)
  }

  const local = progressPlayedAt(LOCAL_ISO, 'Local')

  it.each<[string, Cloud, LaunchReconcileResult['kind'], number]>([
    [
      'cloud newer: installed',
      {
        status: 200,
        blob: progressPlayedAt(CLOUD_ISO, 'Cloud'),
        lastModifiedISO: CLOUD_ISO,
      },
      'installed-from-cloud',
      1,
    ],
    [
      'local newer: pushed',
      {
        status: 200,
        blob: progressPlayedAt('2026-10-01T08:00:00.000Z', 'Older'),
        lastModifiedISO: '2026-10-01T08:00:00.000Z',
      },
      'pushed-to-cloud',
      0,
    ],
    ['no cloud record: pushed', { status: 404 }, 'pushed-to-cloud', 0],
  ])('web parity, %s', async (_name, cloud, expectedKind, expectedWrites) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-13T09:00:00.000Z'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setCloudSyncAuthSecretSource(() => 's3cret')

    const web = await runOn(local, cloud, webBootReconcile)
    const native = await runOn(local, cloud, () => reconcileAtLaunch())

    expect(native.outcome.kind).toBe(expectedKind)
    expect(native.outcome).toEqual(web.outcome)
    expect(native.requests).toEqual(web.requests)
    expect(native.stored).toBe(web.stored)
    expect(native.progressWrites).toBe(expectedWrites)
    expect(web.progressWrites).toBe(expectedWrites)
    expect(JSON.parse(native.stored!).profile.childName).toBe(
      expectedKind === 'installed-from-cloud' ? 'Cloud' : 'Local',
    )
  })

  it('a failed cloud read keeps local as it was: no write', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setCloudSyncAuthSecretSource(() => 's3cret')
    const mem = memoryStore({
      [DEVICE_ID_STORAGE_KEY]: DEVICE_ID,
      [STORAGE_KEY]: JSON.stringify(local),
    })
    setKeyValueStore(mem.store)
    const stub = vi.fn(() =>
      Promise.reject(new TypeError('Network request failed')),
    )
    vi.stubGlobal('fetch', stub)
    await expect(reconcileAtLaunch()).resolves.toEqual({
      kind: 'cloud-error',
      reason: 'network-error',
    })
    expect(stub).toHaveBeenCalledTimes(1)
    expect(mem.writes.get(STORAGE_KEY) ?? 0).toBe(0)
    expect(mem.map.get(STORAGE_KEY)).toBe(JSON.stringify(local))
  })
})
