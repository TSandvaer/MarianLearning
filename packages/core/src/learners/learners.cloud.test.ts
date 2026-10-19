// @vitest-environment node
/**
 * Learner profiles and the cloud backup (`design/native/learner-profiles.md`
 * §§ 3.3–3.4, 4.4–4.7, ACs 9–14 and 20): async writers bound to the learner
 * they started for, the sync-ID uniqueness check (K8), Add from a code, and
 * the carrier refusal (X3) that keeps an older build or the web from
 * pushing one learner's doc into another's record.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import {
  installCloudBlob,
  reconcileWithCloud,
  setCloudSyncAuthSecretSource,
  setCloudSyncSuccessListener,
} from '../progress/cloudSync'
import { defaultProgress } from '../progress/defaults'
import {
  DEVICE_ID_STORAGE_KEY,
  getOrCreateDeviceId,
} from '../progress/deviceId'
import { isProgressV1 } from '../progress/guards'
import { LAST_SYNC_STORAGE_KEY } from '../progress/lastSync'
import { reconcileAtLaunch } from '../progress/launchReconcile'
import { STORAGE_KEY, loadProgress, saveProgress } from '../progress/storage'
import type { Progress } from '../progress/types'
import {
  adoptDeviceId,
  adoptDeviceIdAfterRead,
} from '../parentSettings/cloudBackup'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import {
  LEARNERS_STORAGE_KEY,
  LEARNER_KEYS,
  activateLearner,
  activeLearner,
  addLearner,
  addLearnerFromBackup,
  boundLearner,
  ensureLearnerList,
  launchReconcileDeps,
  loadLearnerList,
  recordLastSyncForSyncId,
  resetLearnersForTests,
  restoreLearnerFromCode,
  type LearnerEntry,
} from './index'

class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

/** `/api/progress` in memory: records by ID, last write wins. */
class FakeCloud {
  readonly records = new Map<
    string,
    { blob: unknown; lastModifiedISO: string }
  >()
  readonly calls: Array<{ method: string; deviceId: string }> = []
  /** A held response for the next matching call, if any. */
  hold: { method: string; gate: Deferred<void> } | null = null

  readonly fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const deviceId =
      method === 'GET'
        ? decodeURIComponent(String(url).split('deviceId=')[1] ?? '')
        : (JSON.parse(init!.body as string) as { deviceId: string }).deviceId
    this.calls.push({ method, deviceId })
    if (this.hold && this.hold.method === method) {
      const { gate } = this.hold
      this.hold = null
      await gate.promise
      if (init?.signal?.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      }
    }
    if (method === 'GET') {
      const rec = this.records.get(deviceId)
      if (!rec) return new Response('', { status: 404 })
      return new Response(JSON.stringify({ ok: true, ...rec }))
    }
    const body = JSON.parse(init!.body as string) as {
      blob: unknown
      lastModifiedISO: string
    }
    this.records.set(deviceId, {
      blob: body.blob,
      lastModifiedISO: body.lastModifiedISO,
    })
    return new Response('{"ok":true}')
  })

  posts(): number {
    return this.calls.filter((c) => c.method === 'POST').length
  }
}

const T0 = '2026-10-18T17:00:00.000Z'
const T1 = '2026-10-19T09:00:00.000Z'
const T2 = '2026-10-19T18:00:00.000Z'

function played(
  at: string,
  name = 'Marian',
  extra: Partial<Progress> = {},
): Progress {
  const p = defaultProgress(name)
  return { ...p, profile: { ...p.profile, lastPlayedISO: at }, ...extra }
}

function withCarrier(p: Progress, syncId: string, avatarId = 'fox'): Progress {
  return { ...p, learner: { syncId, avatarId, language: 'en' } }
}

let cloud: FakeCloud
let store: MapStore
let synced: string[]

function setup(): { one: LearnerEntry; b: LearnerEntry } {
  // An upgrade: Marian's doc is there before the migration names her.
  store = new MapStore()
  store.data.set(STORAGE_KEY, JSON.stringify(played(T0)))
  setKeyValueStore(store)
  ensureLearnerList()
  const one = activeLearner()!
  const b = addLearner({
    name: 'Sam',
    avatarId: 'owl',
    start: { math: 1, wordSong: 1 },
  })
  activateLearner(one.id)
  return { one, b }
}

function keysOf(entry: LearnerEntry): Map<string, string | undefined> {
  return new Map(
    LEARNER_KEYS.map((k) => {
      const key = entry.legacySlot ? k : `${k}:${entry.id}`
      return [key, store.data.get(key)]
    }),
  )
}

function syncIdOf(entry: LearnerEntry): string {
  return boundLearner(entry).syncId()
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => {
  cloud = new FakeCloud()
  vi.stubGlobal('fetch', cloud.fetch)
  setCloudSyncAuthSecretSource(() => 's3cret')
  synced = []
  setCloudSyncSuccessListener((id) => {
    synced.push(id)
    recordLastSyncForSyncId(id)
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
  setCloudSyncAuthSecretSource(null)
  setCloudSyncSuccessListener(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('bound reconcile (AC 9)', () => {
  it("A's reconcile held open, switch to B, release → A's key gets the cloud doc; B untouched; Last synced for A only", async () => {
    const { one, b } = setup()
    const aSync = syncIdOf(one)
    cloud.records.set(aSync, {
      blob: withCarrier(played(T2, 'Marian'), aSync),
      lastModifiedISO: T2,
    })
    const bBefore = keysOf(b)
    const gate = deferred<void>()
    cloud.hold = { method: 'GET', gate }

    const run = reconcileAtLaunch(launchReconcileDeps(one))
    await flush()
    activateLearner(b.id)
    gate.resolve()
    const result = await run

    expect(result.kind).toBe('installed-from-cloud')
    expect(boundLearner(one).load()?.profile.lastPlayedISO).toBe(T2)
    expect(keysOf(b)).toEqual(bBefore)
    expect(synced).toEqual([aSync])
    expect(store.data.has(LAST_SYNC_STORAGE_KEY)).toBe(true)
    expect(store.data.has(`${LAST_SYNC_STORAGE_KEY}:${b.id}`)).toBe(false)
  })

  it('a sync for an ID no learner holds writes no Last synced', () => {
    setup()
    recordLastSyncForSyncId('99999999-9999-4999-8999-999999999999')
    expect(
      [...store.data.keys()].some((k) => k.startsWith(LAST_SYNC_STORAGE_KEY)),
    ).toBe(false)
  })
})

describe('bound Restore (AC 10)', () => {
  it("adoptDeviceIdAfterRead for A, switch mid-flight, abort → A's sync-ID key holds the code, B's unchanged", async () => {
    const { one, b } = setup()
    const code = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    // The other device's record is older: the reconcile pushes A's doc.
    cloud.records.set(code, {
      blob: withCarrier(played('2026-10-01T09:00:00.000Z'), code),
      lastModifiedISO: '2026-10-01T09:00:00.000Z',
    })
    const bSyncBefore = store.data.get(`${DEVICE_ID_STORAGE_KEY}:${b.id}`)
    const controller = new AbortController()
    const gate = deferred<void>()
    cloud.hold = { method: 'POST', gate }
    const io = boundLearner(one)

    const restore = adoptDeviceIdAfterRead(code, {
      writeDeviceId: io.writeSyncId,
      loadLocal: io.load,
      reconcile: (id, local) =>
        reconcileWithCloud(id, local, {
          fetchImpl: (u, init) =>
            cloud.fetch(String(u), { ...init, signal: controller.signal }),
          installLocally: io.save,
        }),
    })
    await flush()
    activateLearner(b.id)
    controller.abort()
    gate.resolve()
    await restore

    expect(store.data.get(DEVICE_ID_STORAGE_KEY)).toBe(code)
    expect(store.data.get(`${DEVICE_ID_STORAGE_KEY}:${b.id}`)).toBe(bSyncBefore)
  })

  it('restoreLearnerFromCode does the same, bound to its learner', async () => {
    const { one, b } = setup()
    const code = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    cloud.records.set(code, {
      blob: withCarrier(played(T2, 'Marian'), code),
      lastModifiedISO: T2,
    })
    const gate = deferred<void>()
    cloud.hold = { method: 'GET', gate }
    const restore = restoreLearnerFromCode(one, code)
    await flush()
    activateLearner(b.id)
    gate.resolve()
    expect((await restore).kind).toBe('installed-from-cloud')
    expect(store.data.get(DEVICE_ID_STORAGE_KEY)).toBe(code)
    expect(boundLearner(one).load()?.profile.lastPlayedISO).toBe(T2)
    // Today's Restore records Last synced; it still does, for A.
    expect(store.data.has(LAST_SYNC_STORAGE_KEY)).toBe(true)
    expect(store.data.has(`${LAST_SYNC_STORAGE_KEY}:${b.id}`)).toBe(false)
  })
})

describe('bound carrier (AC 11)', () => {
  it("a reconcile install for A while B plays → A's doc carries A's carrier and A's name", async () => {
    const { one, b } = setup()
    const aSync = syncIdOf(one)
    // A cloud doc that still says another name and no avatar.
    cloud.records.set(aSync, {
      blob: { ...played(T2, 'Someone'), learner: { syncId: aSync } },
      lastModifiedISO: T2,
    })
    activateLearner(b.id)
    await reconcileAtLaunch(launchReconcileDeps(one))
    const doc = JSON.parse(store.data.get(STORAGE_KEY)!) as Progress
    expect(doc.learner).toEqual({
      syncId: aSync,
      avatarId: 'fox',
      language: 'en',
    })
    expect(doc.profile.childName).toBe('Marian')
  })
})

describe('sync-ID uniqueness (AC 12, K8)', () => {
  it('Restore with a code another learner holds → refused, nothing written, no fetch', async () => {
    const { one, b } = setup()
    const bSync = syncIdOf(b)
    const before = new Map(store.data)
    cloud.fetch.mockClear()
    const outcome = await restoreLearnerFromCode(one, bSync.toUpperCase())
    expect(outcome).toEqual({
      kind: 'code-held',
      learner: expect.objectContaining({ id: b.id }),
    })
    expect(store.data).toEqual(before)
    expect(cloud.fetch).not.toHaveBeenCalled()
  })

  it('Add from a code with a code a learner here holds → refused, nothing written, no fetch', async () => {
    const { one } = setup()
    const oneSync = syncIdOf(one)
    const before = new Map(store.data)
    cloud.fetch.mockClear()
    const outcome = await addLearnerFromBackup(oneSync)
    expect(outcome).toEqual({
      kind: 'already-here',
      learner: expect.objectContaining({ id: one.id }),
    })
    expect(store.data).toEqual(before)
    expect(cloud.fetch).not.toHaveBeenCalled()
  })
})

describe('Add from a code (AC 13)', () => {
  const CODE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

  it('a found record → a new learner, doc under their keys, sync ID = the code; the playing learner untouched', async () => {
    const { one } = setup()
    const oneBefore = keysOf(one)
    cloud.records.set(CODE, {
      blob: withCarrier(
        played(T1, '  Ana Maria Theresa Josefina Luz '),
        CODE,
        'frog',
      ),
      lastModifiedISO: T1,
    })

    const outcome = await addLearnerFromBackup(CODE)

    expect(outcome.kind).toBe('added')
    const ana = (outcome as { learner: LearnerEntry }).learner
    expect(ana).toMatchObject({
      name: 'Ana Maria Theresa Josefi',
      avatarId: 'frog',
      legacySlot: false,
      start: { math: 1, wordSong: 1 },
    })
    expect(store.data.get(`${DEVICE_ID_STORAGE_KEY}:${ana.id}`)).toBe(CODE)
    expect(boundLearner(ana).load()?.profile.lastPlayedISO).toBe(T1)
    expect(keysOf(one)).toEqual(oneBefore)
    expect(loadLearnerList()?.learners.map((l) => l.id)).toContain(ana.id)
    expect(cloud.posts()).toBe(0)
  })

  it('a taken carrier picture → the first free one', async () => {
    setup()
    cloud.records.set(CODE, {
      blob: withCarrier(played(T1, 'Ana'), CODE, 'owl'),
      lastModifiedISO: T1,
    })
    const outcome = await addLearnerFromBackup(CODE)
    expect((outcome as { learner: LearnerEntry }).learner.avatarId).toBe('lion')
  })

  it('a 404 writes and pushes nothing', async () => {
    setup()
    const before = new Map(store.data)
    expect(await addLearnerFromBackup(CODE)).toEqual({ kind: 'not-found' })
    expect(store.data).toEqual(before)
    expect(cloud.posts()).toBe(0)
  })

  it('a record that fails the guard is rejected, nothing written', async () => {
    setup()
    cloud.records.set(CODE, { blob: { schemaVersion: 1 }, lastModifiedISO: T1 })
    const before = new Map(store.data)
    expect(await addLearnerFromBackup(CODE)).toEqual({ kind: 'rejected' })
    expect(store.data).toEqual(before)
  })

  it('a network error writes nothing', async () => {
    setup()
    cloud.fetch.mockRejectedValueOnce(new Error('offline'))
    const before = new Map(store.data)
    expect((await addLearnerFromBackup(CODE)).kind).toBe('error')
    expect(store.data).toEqual(before)
  })
})

describe('mismatched record (AC 14, X3)', () => {
  const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

  it('reconcile: a carrier naming another code → cloud-learner-mismatch, nothing written or pushed', async () => {
    const { one } = setup()
    const aSync = syncIdOf(one)
    cloud.records.set(aSync, {
      blob: withCarrier(played(T2), OTHER),
      lastModifiedISO: T2,
    })
    const before = new Map(store.data)
    const result = await reconcileAtLaunch(launchReconcileDeps(one))
    expect(result).toEqual({ kind: 'cloud-learner-mismatch' })
    expect(store.data).toEqual(before)
    expect(cloud.posts()).toBe(0)
  })

  it('a carrier naming another code, older than local → still refused, no push', async () => {
    const { one } = setup()
    const aSync = syncIdOf(one)
    cloud.records.set(aSync, {
      blob: withCarrier(played('2026-10-01T00:00:00.000Z'), OTHER),
      lastModifiedISO: '2026-10-01T00:00:00.000Z',
    })
    expect(await reconcileAtLaunch(launchReconcileDeps(one))).toEqual({
      kind: 'cloud-learner-mismatch',
    })
    expect(cloud.posts()).toBe(0)
  })

  it('Restore and Add from a code refuse it with nothing written', async () => {
    const { one } = setup()
    const CODE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    cloud.records.set(CODE, {
      blob: withCarrier(played(T2), OTHER),
      lastModifiedISO: T2,
    })
    const before = new Map(store.data)
    expect(await restoreLearnerFromCode(one, CODE)).toEqual({
      kind: 'cloud-learner-mismatch',
    })
    expect(await addLearnerFromBackup(CODE)).toEqual({
      kind: 'other-learner-record',
    })
    expect(store.data).toEqual(before)
  })

  it('no carrier: refused for a non-legacy learner, installed for the legacy one', async () => {
    const { one, b } = setup()
    const aSync = syncIdOf(one)
    const bSync = syncIdOf(b)
    cloud.records.set(aSync, {
      blob: played(T2, 'Marian'),
      lastModifiedISO: T2,
    })
    cloud.records.set(bSync, { blob: played(T2, 'Sam'), lastModifiedISO: T2 })
    const bBefore = keysOf(b)

    expect(await reconcileAtLaunch(launchReconcileDeps(b))).toEqual({
      kind: 'cloud-learner-mismatch',
    })
    expect(keysOf(b)).toEqual(bBefore)
    expect((await reconcileAtLaunch(launchReconcileDeps(one))).kind).toBe(
      'installed-from-cloud',
    )

    const CODE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    cloud.records.set(CODE, { blob: played(T2, 'Leo'), lastModifiedISO: T2 })
    expect(await restoreLearnerFromCode(b, CODE)).toEqual({
      kind: 'cloud-learner-mismatch',
    })
    expect(store.data.get(`${DEVICE_ID_STORAGE_KEY}:${b.id}`)).toBe(bSync)
    expect((await addLearnerFromBackup(CODE)).kind).toBe('added')
  })

  it("the web restoring B's code cannot push learner 1's doc into B's slot", async () => {
    const { b } = setup()
    // B plays on the profiles device: their record carries their stamp.
    activateLearner(b.id)
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: T1,
      focusNode: 'number-recog',
    })
    await flush()
    const bSync = syncIdOf(b)
    expect(cloud.records.has(bSync)).toBe(true)
    const bBefore = keysOf(b)

    // The web (or a build from before profiles) holds Marian's doc, newer,
    // and a parent pastes B's Backup code into its Restore.
    const web = new MapStore()
    resetLearnersForTests()
    setKeyValueStore(web)
    saveProgress(played(T2, 'Marian'))
    getOrCreateDeviceId()
    await adoptDeviceId(bSync)
    expect((cloud.records.get(bSync)!.blob as Progress).profile.childName).toBe(
      'Marian',
    )

    // Back on the profiles device, B's next launch reconcile refuses it.
    resetLearnersForTests()
    setKeyValueStore(store)
    ensureLearnerList()
    const bAgain = loadLearnerList()!.learners.find((l) => l.id === b.id)!
    expect(await reconcileAtLaunch(launchReconcileDeps(bAgain))).toEqual({
      kind: 'cloud-learner-mismatch',
    })
    expect(keysOf(b)).toEqual(bBefore)
  })
})

describe('forward compatibility (AC 20)', () => {
  const carrier = {
    syncId: '11111111-2222-4333-8444-555555555555',
    avatarId: 'unicorn',
    language: 'da',
  }

  it('a doc with an unknown avatar and language round-trips through local load + save', () => {
    const raw = new MapStore()
    setKeyValueStore(raw)
    saveProgress({ ...played(T1), learner: carrier })
    const loaded = loadProgress()
    expect(loaded?.learner).toEqual(carrier)
    saveProgress(loaded!)
    expect(
      (JSON.parse(raw.data.get(STORAGE_KEY)!) as Progress).learner,
    ).toEqual(carrier)
  })

  it('and through a cloud install', () => {
    const installed = installCloudBlob({ ...played(T1), learner: carrier })
    expect(installed?.learner).toEqual(carrier)
  })

  it("learner: 'x' rejects; non-string fields reject", () => {
    expect(isProgressV1({ ...played(T1), learner: 'x' })).toBe(false)
    expect(isProgressV1({ ...played(T1), learner: { syncId: 3 } })).toBe(false)
    expect(isProgressV1({ ...played(T1), learner: {} })).toBe(true)
  })
})

describe('the list key is never sent', () => {
  it('no push body carries the list or a learner id', async () => {
    const { b } = setup()
    activateLearner(b.id)
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: T1,
      focusNode: 'number-recog',
    })
    await flush()
    const bodies = cloud.fetch.mock.calls
      .map((c) => (c[1] as RequestInit | undefined)?.body)
      .filter((x): x is string => typeof x === 'string')
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      expect(body).not.toContain(b.id)
      expect(body).not.toContain(LEARNERS_STORAGE_KEY)
    }
  })
})
