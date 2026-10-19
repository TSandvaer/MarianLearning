// @vitest-environment node
/**
 * Learner profiles, the migration (`design/native/learner-profiles.md`
 * § 4.3, ACs 1–5 and 22). Today's device becomes learner 1 with nothing
 * moved: the list is the only new key, "fresh install" is decided from the
 * raw progress key (X1), and nothing here ever writes a progress key that
 * holds anything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import { recordSessionEnd } from '../sessionEnd/sessionHistory'
import { markNudgeSaid } from '../sessionEnd/notYetNudge'
import { writeStardust } from '../shared/stardust'
import { writeFlowerWake } from '../hub/hubGuidance'
import {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import { getOrCreateDeviceId } from '../progress/deviceId'
import { recordLastSync } from '../progress/lastSync'
import { STORAGE_KEY, loadProgress } from '../progress/storage'
import { defaultProgress } from '../progress/defaults'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import {
  LEARNERS_STORAGE_KEY,
  activeLearner,
  ensureLearnerList,
  learnerKey,
  resetLearnersForTests,
  type LearnerList,
} from './index'
/** expo-sqlite's store in memory; `listable` adds `keys()` (native has it). */
class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  keys?: () => string[]
  constructor({ listable = false }: { listable?: boolean } = {}) {
    if (listable) this.keys = () => [...this.data.keys()]
  }
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

const LEGACY_KEYS = [
  'marian-tutor:progress:v1',
  'marian-tutor.session-history.v1',
  'marian-tutor.stardust.v1',
  'session-end-not-yet-nudge.v1',
  'hub-flower-wake.v1',
  'marian-tutor:device-id',
  'marian-tutor:last-sync',
] as const

const PLAYED_AT = '2026-10-18T17:00:00.000Z'

/** Today's 7 keys, written by today's own writers (no list installed). */
function storeWithTodaysKeys(): MapStore {
  const store = new MapStore()
  setKeyValueStore(store)
  recordProgressOnSessionEnd({
    surface: 'math',
    totalCorrect: 7,
    dateISO: PLAYED_AT,
    focusNode: 'add-to-10',
  })
  recordSessionEnd(3, store, () => new Date(PLAYED_AT), 4)
  writeStardust(12, store)
  markNudgeSaid('math', '2026-10-18', store)
  writeFlowerWake({ math: '2026-10-18' }, store)
  getOrCreateDeviceId()
  recordLastSync(new Date('2026-10-18T17:01:00.000Z'))
  setKeyValueStore(null)
  return store
}

function bytes(store: MapStore): Map<string, string> {
  return new Map(store.data)
}

function storedList(store: MapStore): LearnerList {
  return JSON.parse(store.data.get(LEARNERS_STORAGE_KEY)!) as LearnerList
}

afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
})

describe('ensureLearnerList: upgrade (AC 1)', () => {
  it("today's 7 keys → exactly one key added, every other key byte-equal", () => {
    const store = storeWithTodaysKeys()
    expect([...store.data.keys()].sort()).toEqual([...LEGACY_KEYS].sort())
    const before = bytes(store)
    setKeyValueStore(store)

    ensureLearnerList()

    const added = [...store.data.keys()].filter((k) => !before.has(k))
    expect(added).toEqual([LEARNERS_STORAGE_KEY])
    for (const [key, value] of before) {
      expect(store.data.get(key)).toBe(value)
    }
  })

  it('one learner: legacy slot, named from profile.childName, legacy-default start, active', () => {
    const store = storeWithTodaysKeys()
    setKeyValueStore(store)
    ensureLearnerList()

    const list = storedList(store)
    expect(list.schemaVersion).toBe(1)
    expect(list.learners).toHaveLength(1)
    const [learner] = list.learners
    expect(learner).toMatchObject({
      name: 'Marian',
      avatarId: 'fox',
      language: 'en',
      legacySlot: true,
      start: 'legacy-default',
    })
    expect(list.activeLearnerId).toBe(learner!.id)
    expect(activeLearner()?.id).toBe(learner!.id)
  })

  it('learner 1 keeps every key: the installed store reads today’s doc and device ID', () => {
    const store = storeWithTodaysKeys()
    const doc = store.data.get(STORAGE_KEY)
    const deviceId = store.data.get('marian-tutor:device-id')
    setKeyValueStore(store)
    ensureLearnerList()

    const entry = activeLearner()!
    for (const key of LEGACY_KEYS) expect(learnerKey(key, entry)).toBe(key)
    expect(JSON.stringify(loadProgress()?.history)).toBe(
      JSON.stringify((JSON.parse(doc!) as { history: unknown }).history),
    )
    expect(getOrCreateDeviceId()).toBe(deviceId)
  })

  it('a name over 24 characters is cut, and surrounding spaces trimmed', () => {
    const store = new MapStore()
    store.data.set(
      STORAGE_KEY,
      JSON.stringify(defaultProgress('  Maria Anna Theresa Josefina  ')),
    )
    setKeyValueStore(store)
    ensureLearnerList()
    expect(storedList(store).learners[0]!.name).toBe('Maria Anna Theresa Josef')
  })
})

describe('ensureLearnerList: a present but unreadable doc is kept (AC 2, X1)', () => {
  it.each([
    ['invalid JSON', '{not json'],
    [
      'a doc that fails the guard',
      JSON.stringify({ ...defaultProgress(), schemaVersion: 1, history: 'x' }),
    ],
  ])('%s: the list is added, the progress key is byte-equal', (_, raw) => {
    const store = new MapStore()
    store.data.set(STORAGE_KEY, raw)
    store.data.set(
      'marian-tutor:device-id',
      '11111111-2222-4333-8444-555555555555',
    )
    const before = bytes(store)
    setKeyValueStore(store)

    ensureLearnerList()

    expect(store.data.get(STORAGE_KEY)).toBe(raw)
    for (const [key, value] of before) expect(store.data.get(key)).toBe(value)
    expect([...store.data.keys()].filter((k) => !before.has(k))).toEqual([
      LEARNERS_STORAGE_KEY,
    ])
    const list = storedList(store)
    expect(list.learners).toHaveLength(1)
    expect(list.learners[0]).toMatchObject({
      name: '',
      legacySlot: true,
      start: 'legacy-default',
    })
  })
})

describe('ensureLearnerList: idempotent (AC 3)', () => {
  it('a second call writes nothing', () => {
    const store = storeWithTodaysKeys()
    setKeyValueStore(store)
    ensureLearnerList()
    const after = bytes(store)
    let writes = 0
    const setItem = store.setItem.bind(store)
    store.setItem = (k, v) => {
      writes++
      setItem(k, v)
    }

    ensureLearnerList()

    expect(writes).toBe(0)
    expect(bytes(store)).toEqual(after)
  })
})

describe('ensureLearnerList: fresh install (AC 4, T7)', () => {
  it('no progress key → learner 1 unnamed at land 1 in both worlds', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()

    const [learner] = storedList(store).learners
    expect(learner).toMatchObject({
      name: '',
      legacySlot: true,
      start: { math: 1, wordSong: 1 },
    })
    expect([...store.data.keys()].sort()).toEqual(
      [LEARNERS_STORAGE_KEY, STORAGE_KEY].sort(),
    )
  })

  it('the legacy progress key holds the floor start: number-recog and letter-names intro, the rest locked', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()

    const doc = loadProgress()!
    for (const node of [...MATH_TREE, ...LITERACY_TREE]) {
      const want =
        node === 'number-recog' || node === 'letter-names' ? 'intro' : 'locked'
      expect([node, doc.skillLevels[node]]).toEqual([node, want])
    }
    expect(doc.history).toEqual([])
  })
})

describe('ensureLearnerList: never throws (AC 5, K12)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a raw store whose getItem throws → returns, and the raw store is installed', () => {
    const raw = new MapStore()
    raw.getItem = () => {
      throw new Error('db closed')
    }
    setKeyValueStore(raw)
    expect(() => ensureLearnerList()).not.toThrow()
    expect(getKeyValueStore()).toBe(raw)
    expect(activeLearner()).toBeNull()
  })

  it('a raw store whose setItem throws → returns, raw installed, nothing half-written', () => {
    const raw = new MapStore()
    raw.setItem = () => {
      throw new Error('disk full')
    }
    setKeyValueStore(raw)
    expect(() => ensureLearnerList()).not.toThrow()
    expect(getKeyValueStore()).toBe(raw)
    expect(raw.data.size).toBe(0)
  })

  it('no store installed (SSR, a node test) → returns null, installs nothing', () => {
    expect(ensureLearnerList()).toBeNull()
    expect(getKeyValueStore()).toBeNull()
  })
})

describe('an older build after the migration (P5, § 4.7)', () => {
  it('reads learner 1 through the raw store, as today', () => {
    const store = storeWithTodaysKeys()
    const before = loadProgressFrom(store)
    setKeyValueStore(store)
    ensureLearnerList()
    // A play on the profiles build: the doc gains the carrier.
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: '2026-10-19T17:00:00.000Z',
      focusNode: 'add-to-10',
    })
    resetLearnersForTests()

    // The older build installs the raw store and knows no list.
    const after = loadProgressFrom(store)
    expect(after).not.toBeNull()
    expect(after!.history).toHaveLength(before!.history.length + 1)
    expect(after!.profile.childName).toBe('Marian')
  })
})

describe('rebuild (AC 22, K11)', () => {
  const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const C = '12345678-1234-4234-8234-123456789abc'

  function docNamed(name: string, avatarId?: string): string {
    return JSON.stringify({
      ...defaultProgress(name),
      ...(avatarId ? { learner: { syncId: B, avatarId, language: 'en' } } : {}),
    })
  }

  it('a corrupt list with keys(): learner 1 from the legacy slot, plus one learner per suffixed doc', () => {
    const store = new MapStore({ listable: true })
    store.data.set(LEARNERS_STORAGE_KEY, '{corrupt')
    store.data.set(STORAGE_KEY, docNamed('Marian'))
    store.data.set(`${STORAGE_KEY}:${B}`, docNamed('Sam', 'owl'))
    store.data.set(`${STORAGE_KEY}:${C}`, docNamed('Ana', 'owl'))
    const progressBefore = [...store.data].filter(([k]) =>
      k.startsWith(STORAGE_KEY),
    )
    setKeyValueStore(store)

    ensureLearnerList()

    const list = storedList(store)
    expect(list.learners.map((l) => [l.name, l.legacySlot])).toEqual([
      ['Marian', true],
      ['Sam', false],
      ['Ana', false],
    ])
    expect(list.learners[1]!.id).toBe(B)
    expect(list.learners[2]!.id).toBe(C)
    // Sam's carrier picture is free; Ana's (owl) is Sam's now.
    expect(list.learners[1]!.avatarId).toBe('owl')
    expect(list.learners[2]!.avatarId).not.toBe('owl')
    expect(new Set(list.learners.map((l) => l.avatarId)).size).toBe(3)
    expect(list.learners[1]!.start).toEqual({ math: 1, wordSong: 1 })
    for (const [key, value] of progressBefore) {
      expect(store.data.get(key)).toBe(value)
    }
    expect(list.activeLearnerId).toBe(list.learners[0]!.id)
  })

  it('a rebuild with no legacy doc makes no learner 1 when others are found', () => {
    const store = new MapStore({ listable: true })
    store.data.set(LEARNERS_STORAGE_KEY, '[]')
    store.data.set(`${STORAGE_KEY}:${B}`, docNamed('Sam'))
    setKeyValueStore(store)
    ensureLearnerList()
    const list = storedList(store)
    expect(list.learners.map((l) => [l.id, l.legacySlot])).toEqual([[B, false]])
    expect(store.data.has(STORAGE_KEY)).toBe(false)
  })

  it('a list with schemaVersion 2 is used in memory; its stored bytes are unchanged', () => {
    const store = new MapStore({ listable: true })
    const newer = JSON.stringify({ schemaVersion: 2, learners: [], x: 1 })
    store.data.set(LEARNERS_STORAGE_KEY, newer)
    store.data.set(STORAGE_KEY, docNamed('Marian'))
    store.data.set(`${STORAGE_KEY}:${B}`, docNamed('Sam'))
    const before = bytes(store)
    setKeyValueStore(store)

    const list = ensureLearnerList()

    expect(bytes(store)).toEqual(before)
    expect(list?.learners.map((l) => l.name)).toEqual(['Marian', 'Sam'])
    expect(activeLearner()?.name).toBe('Marian')
  })
})

function loadProgressFrom(store: MapStore) {
  const prev = getKeyValueStore()
  setKeyValueStore(store)
  try {
    return loadProgress()
  } finally {
    setKeyValueStore(prev)
  }
}
