// @vitest-environment node
/**
 * Learner profiles: the scoped store, isolation between learners, Remove
 * and the list guard (`design/native/learner-profiles.md` §§ 4.2–4.5,
 * ACs 6, 7, 8, 15, 21, 25).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOWER_WAKE_STORAGE_KEY } from '../hub/hubGuidance'
import {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import {
  setCloudSyncAuthSecretSource,
  setCloudSyncSuccessListener,
} from '../progress/cloudSync'
import { DEVICE_ID_STORAGE_KEY, readStoredDeviceId } from '../progress/deviceId'
import { LAST_SYNC_STORAGE_KEY } from '../progress/lastSync'
import { STORAGE_KEY, loadProgress } from '../progress/storage'
import { NOT_YET_NUDGE_STORAGE_KEY } from '../sessionEnd/notYetNudge'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import {
  SESSION_HISTORY_KEY,
  readSessionHistory,
  recordSessionEnd,
} from '../sessionEnd/sessionHistory'
import { STARDUST_STORAGE_KEY } from '../shared/stardust'
import {
  LEARNERS_STORAGE_KEY,
  LEARNER_KEYS,
  activateLearner,
  activeLearner,
  addLearner,
  ensureLearnerList,
  isLearnerList,
  learnerKey,
  learnerScopedStore,
  loadLearnerList,
  removeLearner,
  resetLearnersForTests,
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

const PLAYED_AT = '2026-10-19T17:00:00.000Z'

function legacyKeys(store: MapStore): Map<string, string | undefined> {
  return new Map(LEARNER_KEYS.map((k) => [k, store.data.get(k)]))
}

/** A migrated device (learner 1 "Marian" has played) plus learner B. */
function twoLearners(): {
  store: MapStore
  one: LearnerEntry
  b: LearnerEntry
} {
  const store = new MapStore()
  setKeyValueStore(store)
  ensureLearnerList()
  recordProgressOnSessionEnd({
    surface: 'math',
    totalCorrect: 7,
    dateISO: '2026-10-18T17:00:00.000Z',
    focusNode: 'number-recog',
  })
  const one = activeLearner()!
  const b = addLearner({
    name: 'Sam',
    avatarId: 'owl',
    start: { math: 1, wordSong: 1 },
  })
  activateLearner(one.id)
  return { store, one, b }
}

beforeEach(() => {
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

describe('the 7 per-learner keys (§ 4.2)', () => {
  it('are the modules’ own keys', () => {
    expect([...LEARNER_KEYS]).toEqual([
      STORAGE_KEY,
      SESSION_HISTORY_KEY,
      STARDUST_STORAGE_KEY,
      NOT_YET_NUDGE_STORAGE_KEY,
      FLOWER_WAKE_STORAGE_KEY,
      DEVICE_ID_STORAGE_KEY,
      LAST_SYNC_STORAGE_KEY,
    ])
  })
})

describe('learnerScopedStore (AC 6)', () => {
  it('learner 1 maps each key to itself; learner B to <key>:<B.id>; others pass through', () => {
    const { store, one, b } = twoLearners()
    for (const key of LEARNER_KEYS) {
      expect(learnerKey(key, one)).toBe(key)
      expect(learnerKey(key, b)).toBe(`${key}:${b.id}`)
    }
    const scoped = learnerScopedStore(store, b)
    scoped.setItem(SESSION_HISTORY_KEY, 'h')
    expect(store.data.get(`${SESSION_HISTORY_KEY}:${b.id}`)).toBe('h')
    expect(scoped.getItem(SESSION_HISTORY_KEY)).toBe('h')
    scoped.setItem('some-other-key', 'x')
    expect(store.data.get('some-other-key')).toBe('x')
    expect(scoped.getItem(LEARNERS_STORAGE_KEY)).toBe(
      store.data.get(LEARNERS_STORAGE_KEY),
    )
    scoped.removeItem(SESSION_HISTORY_KEY)
    expect(store.data.has(`${SESSION_HISTORY_KEY}:${b.id}`)).toBe(false)
  })

  it('activateLearner installs that learner’s scoped store', () => {
    const { store, b } = twoLearners()
    activateLearner(b.id)
    getKeyValueStore()!.setItem(STARDUST_STORAGE_KEY, '7')
    expect(store.data.get(`${STARDUST_STORAGE_KEY}:${b.id}`)).toBe('7')
    expect(loadLearnerList()?.activeLearnerId).toBe(b.id)
  })
})

describe('isolation (AC 7, AC 8)', () => {
  it("a Session End write for B changes only B's keys; learner 1's 7 keys stay byte-equal", () => {
    const { store, b } = twoLearners()
    activateLearner(b.id)
    const before = legacyKeys(store)
    const otherBefore = new Map(store.data)

    recordSessionEnd(2, undefined, () => new Date(PLAYED_AT), 3)
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: PLAYED_AT,
      focusNode: 'number-recog',
    })

    expect(legacyKeys(store)).toEqual(before)
    const changed = [...store.data.keys()].filter(
      (k) => store.data.get(k) !== otherBefore.get(k),
    )
    expect(changed.length).toBeGreaterThan(0)
    for (const key of changed) expect(key.endsWith(`:${b.id}`)).toBe(true)
    expect(loadProgress()?.history).toHaveLength(1)
    expect(readSessionHistory().sessionCount).toBe(1)
  })

  it("B's session-end push goes to B's sync ID, with B's carrier", async () => {
    const { b } = twoLearners()
    activateLearner(b.id)
    setCloudSyncAuthSecretSource(() => 's3cret')
    const fetchSpy = vi.fn(async () => new Response('{"ok":true}'))
    vi.stubGlobal('fetch', fetchSpy)

    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: PLAYED_AT,
      focusNode: 'number-recog',
    })
    for (let i = 0; i < 10; i++) await Promise.resolve()

    const bSync = readStoredDeviceId()!
    expect(bSync).toMatch(/^[0-9a-f-]{36}$/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ) as { deviceId: string; blob: { learner?: unknown; profile: unknown } }
    expect(body.deviceId).toBe(bSync)
    expect(body.blob.learner).toEqual({
      syncId: bSync,
      avatarId: 'owl',
      language: 'en',
    })
    expect(body.blob.profile).toMatchObject({ childName: 'Sam' })
  })

  it('the stored doc carries its own learner’s carrier on every save', () => {
    const { store, one, b } = twoLearners()
    const oneDoc = JSON.parse(store.data.get(STORAGE_KEY)!) as {
      learner: unknown
    }
    expect(oneDoc.learner).toEqual({
      syncId: store.data.get(DEVICE_ID_STORAGE_KEY),
      avatarId: one.avatarId,
      language: 'en',
    })
    const bDoc = JSON.parse(store.data.get(`${STORAGE_KEY}:${b.id}`)!) as {
      learner: unknown
    }
    expect(bDoc.learner).toEqual({
      syncId: store.data.get(`${DEVICE_ID_STORAGE_KEY}:${b.id}`),
      avatarId: 'owl',
      language: 'en',
    })
  })
})

describe('removeLearner (AC 15)', () => {
  it("B removed → B's 7 keys gone, the list without B, learner 1 byte-equal", () => {
    const { store, one, b } = twoLearners()
    activateLearner(b.id)
    recordSessionEnd(1, undefined, () => new Date(PLAYED_AT), 1)
    activateLearner(one.id)
    const before = legacyKeys(store)

    expect(removeLearner(b.id)).toBe(true)

    for (const key of LEARNER_KEYS) {
      expect(store.data.has(`${key}:${b.id}`)).toBe(false)
    }
    expect(loadLearnerList()?.learners.map((l) => l.id)).toEqual([one.id])
    expect(legacyKeys(store)).toEqual(before)
  })

  it("the last learner can't be removed", () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const only = activeLearner()!
    const before = new Map(store.data)
    expect(removeLearner(only.id)).toBe(false)
    expect(store.data).toEqual(before)
  })

  it('removing the playing learner makes the first remaining one active', () => {
    const { store, one, b } = twoLearners()
    const c = addLearner({
      name: 'Ana',
      avatarId: 'frog',
      start: { math: 1, wordSong: 1 },
    })
    activateLearner(one.id)
    expect(removeLearner(one.id)).toBe(true)
    expect(activeLearner()?.id).toBe(b.id)
    expect(loadLearnerList()?.activeLearnerId).toBe(b.id)
    // The playing learner's store is B's now.
    getKeyValueStore()!.setItem(STARDUST_STORAGE_KEY, '1')
    expect(store.data.get(`${STARDUST_STORAGE_KEY}:${b.id}`)).toBe('1')
    expect(c.id).not.toBe(b.id)
    // The legacy slot is never reused.
    const d = addLearner({
      name: 'Leo',
      avatarId: 'bear',
      start: { math: 1, wordSong: 1 },
    })
    expect(d.legacySlot).toBe(false)
    expect(learnerKey(STORAGE_KEY, d)).toBe(`${STORAGE_KEY}:${d.id}`)
  })
})

describe('addLearner', () => {
  it('writes the start doc and the entry, and makes the new learner the one playing', () => {
    const { store, b } = twoLearners()
    activateLearner(b.id)
    expect(activeLearner()?.id).toBe(b.id)
    expect(store.data.has(`${STORAGE_KEY}:${b.id}`)).toBe(true)
    expect(b).toMatchObject({
      name: 'Sam',
      avatarId: 'owl',
      language: 'en',
      legacySlot: false,
      start: { math: 1, wordSong: 1 },
    })
  })

  it('refuses a bad name, a taken picture, a fifth learner and an unknown land', () => {
    twoLearners()
    const start = { math: 1, wordSong: 1 }
    expect(() => addLearner({ name: ' ', avatarId: 'frog', start })).toThrow()
    expect(() =>
      addLearner({ name: 'x'.repeat(25), avatarId: 'frog', start }),
    ).toThrow()
    expect(() => addLearner({ name: 'A<b', avatarId: 'frog', start })).toThrow()
    expect(() => addLearner({ name: 'Ana', avatarId: 'owl', start })).toThrow()
    expect(() =>
      addLearner({
        name: 'Ana',
        avatarId: 'frog',
        start: { math: 6, wordSong: 1 },
      }),
    ).toThrow()
    addLearner({ name: 'Ana', avatarId: 'frog', start })
    addLearner({ name: 'Leo', avatarId: 'bear', start })
    expect(() => addLearner({ name: 'Zoë', avatarId: 'lion', start })).toThrow()
  })
})

describe('isLearnerList (AC 21)', () => {
  const entry = (i: number, extra: Partial<LearnerEntry> = {}) => ({
    id: `0000000${i}-1111-4222-8333-444444444444`,
    name: `L${i}`,
    avatarId: 'fox',
    language: 'en',
    legacySlot: i === 0,
    start: i === 0 ? 'legacy-default' : { math: 1, wordSong: 1 },
    createdAtISO: PLAYED_AT,
    ...extra,
  })
  const list = (n: number) => ({
    schemaVersion: 1,
    learners: Array.from({ length: n }, (_, i) => entry(i)),
    activeLearnerId: entry(0).id,
  })

  it('accepts 5 entries, and unknown avatar and language strings', () => {
    expect(isLearnerList(list(5))).toBe(true)
    const odd = list(2)
    odd.learners[1] = entry(1, {
      avatarId: 'unicorn' as LearnerEntry['avatarId'],
      language: 'da' as LearnerEntry['language'],
    })
    expect(isLearnerList(odd)).toBe(true)
  })

  it('rejects a missing activeLearnerId, one not in the list, and schemaVersion 2', () => {
    const noActive: Record<string, unknown> = { ...list(2) }
    delete noActive.activeLearnerId
    expect(isLearnerList(noActive)).toBe(false)
    expect(isLearnerList({ ...list(2), activeLearnerId: 'nope' })).toBe(false)
    expect(isLearnerList({ ...list(2), schemaVersion: 2 })).toBe(false)
  })

  it('rejects no learners, two legacy slots and a repeated id', () => {
    expect(isLearnerList({ ...list(1), learners: [] })).toBe(false)
    const two = list(2)
    two.learners[1] = entry(1, { legacySlot: true })
    expect(isLearnerList(two)).toBe(false)
    const dup = list(2)
    dup.learners[1] = { ...dup.learners[1]!, id: dup.learners[0]!.id }
    expect(isLearnerList(dup)).toBe(false)
  })
})

describe('no list installed: the web (AC 25)', () => {
  it('every key as today', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    recordSessionEnd(1, undefined, () => new Date(PLAYED_AT), 1)
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: PLAYED_AT,
      focusNode: 'add-to-10',
    })
    expect(activeLearner()).toBeNull()
    expect([...store.data.keys()].sort()).toEqual(
      [
        SESSION_HISTORY_KEY,
        STARDUST_STORAGE_KEY,
        STORAGE_KEY,
        DEVICE_ID_STORAGE_KEY,
      ].sort(),
    )
    expect(store.data.has(LEARNERS_STORAGE_KEY)).toBe(false)
    const doc = JSON.parse(store.data.get(STORAGE_KEY)!) as Record<
      string,
      unknown
    >
    expect('learner' in doc).toBe(false)
  })
})
