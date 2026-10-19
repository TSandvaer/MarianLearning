/**
 * Learner profiles (`design/native/learner-profiles.md` § 4): 1 to 4
 * children on one device, each with their own progress, keys and cloud
 * record. Native only: the web installs no list and stays single-learner.
 *
 * Today's child becomes learner 1 in the legacy slot with nothing moved:
 * the migration (`ensureLearnerList`) writes one new key, the list, and
 * decides "fresh install" from the raw progress key, never from a parse
 * (X1). Every other learner's 7 keys carry a `:<id>` suffix (`./keys.ts`).
 *
 * Whoever is playing has their scoped store installed as core's store, so
 * the modules that own the keys need no change. Work that outlives a
 * switch (a reconcile, a Restore, Parent Settings) goes through
 * `boundLearner(entry)` and reaches only that learner's keys.
 */
import {
  getKeyValueStore,
  setKeyValueStore,
  withKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import { adoptDeviceIdAfterRead } from '../parentSettings/cloudBackup'
import {
  fetchProgressFromCloud,
  installCloudBlob,
  isCloudSyncConfigured,
  isOtherLearnersRecord,
  reconcileWithCloud,
  setCloudPushStamp,
  type CloudErrorReason,
  type ReconcileOutcome,
} from '../progress/cloudSync'
import { now as progressNow } from '../progress/clock'
import {
  generateUuid,
  getOrCreateDeviceId,
  isValidUuid,
  writeStoredDeviceId,
} from '../progress/deviceId'
import { recordLastSync } from '../progress/lastSync'
import type { LaunchReconcileDeps } from '../progress/launchReconcile'
import { landsOf } from '../progress/lands'
import {
  MATH_TREE,
  LITERACY_TREE,
  type MasteryTrack,
} from '../progress/mastery'
import { STORAGE_KEY, loadProgress, saveProgress } from '../progress/storage'
import type { Progress } from '../progress/types'
import { readSessionHistory } from '../sessionEnd/sessionHistory'
import { isLearnerList, isNewerLearnerList } from './guards'
import {
  LEARNER_KEYS,
  learnerKey,
  learnerScopedStore,
  rawOf,
  stampDoc,
  storedSyncId,
} from './keys'
import {
  currentLand,
  landAt,
  learnerStartProgress,
  placeAtStep,
} from './startDoc'
import {
  activeLearner,
  getLearnersState,
  listedLearner,
  setLearnersState,
} from './state'
import {
  AVATAR_IDS,
  LEARNERS_STORAGE_KEY,
  LEARNER_NAME_MAX,
  MAX_LEARNERS,
  type AvatarId,
  type LearnerEntry,
  type LearnerIo,
  type LearnerList,
} from './types'

// ── Names and pictures ──────────────────────────────────────────────────

/** Letters, digits, spaces, `'`, `.`, `-`: the planner sanitiser's set. */
const NAME_CHARS = /^[\p{L}\p{N}\s'.-]+$/u

/** A name a parent may type: 1–24 characters after trimming, § 3.2's set. */
export function isValidLearnerName(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= 1 &&
    trimmed.length <= LEARNER_NAME_MAX &&
    NAME_CHARS.test(trimmed)
  )
}

/** A stored name as a list name: trimmed and cut to 24 characters. */
function listName(raw: unknown): string {
  return typeof raw === 'string'
    ? raw.trim().slice(0, LEARNER_NAME_MAX).trim()
    : ''
}

function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === 'string' && (AVATAR_IDS as readonly string[]).includes(v)
}

function freeAvatars(learners: readonly LearnerEntry[]): AvatarId[] {
  const taken = new Set<string>(learners.map((l) => l.avatarId))
  return AVATAR_IDS.filter((a) => !taken.has(a))
}

/** The doc's carrier picture when it is one of ours and free, else the first free. */
function pictureFor(
  doc: Progress | null,
  learners: readonly LearnerEntry[],
): AvatarId {
  const free = freeAvatars(learners)
  const carried = doc?.learner?.avatarId
  if (isAvatarId(carried) && free.includes(carried)) return carried
  return free[0] ?? 'fox'
}

// ── State helpers ───────────────────────────────────────────────────────

function requireState() {
  const s = getLearnersState()
  if (s === null) throw new Error('learners: no learner list is installed')
  return s
}

/**
 * Use `next` as the list; written back unless it came from a newer build.
 * A failed write keeps the change for this launch (storage errors never
 * block play, as everywhere in core) and is logged.
 */
function commit(next: LearnerList): void {
  const s = requireState()
  setLearnersState({ ...s, list: next })
  if (!s.writable) return
  try {
    s.raw.setItem(LEARNERS_STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[learners] could not save the learner list — ${message}`)
  }
}

function installActive(): void {
  const s = requireState()
  const active = activeLearner()
  if (active !== null) setKeyValueStore(learnerScopedStore(s.raw, active))
}

function rawStore(): KeyValueStore | null {
  const s = getLearnersState()
  if (s !== null) return s.raw
  const installed = getKeyValueStore()
  return installed === null ? null : rawOf(installed)
}

function scopedFor(entry: LearnerEntry): KeyValueStore | null {
  const raw = rawStore()
  return raw === null ? null : learnerScopedStore(raw, entry)
}

// ── The list ────────────────────────────────────────────────────────────

/** The stored list, if it passes the guard (no install, no write). */
export function loadLearnerList(): LearnerList | null {
  const raw = rawStore()
  if (raw === null) return null
  try {
    const stored = raw.getItem(LEARNERS_STORAGE_KEY)
    if (stored === null) return null
    const parsed: unknown = JSON.parse(stored)
    return isLearnerList(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Use and store `list` (a newer build's list is used in memory only). */
export function saveLearnerList(list: LearnerList): void {
  if (!isLearnerList(list)) throw new Error('learners: not a learner list')
  commit(list)
  installActive()
}

/** The stored doc at `entry`'s progress key, loaded as today (null if unreadable). */
function loadDocAt(raw: KeyValueStore, entry: LearnerEntry): Progress | null {
  return withKeyValueStore(learnerScopedStore(raw, entry), loadProgress)
}

function legacyEntry(name: string, fresh: boolean, at: string): LearnerEntry {
  return {
    id: generateUuid(),
    name,
    avatarId: 'fox', // T3: Marian picks hers in Parent Settings later
    language: 'en',
    legacySlot: true,
    start: fresh ? { math: 1, wordSong: 1 } : 'legacy-default',
    createdAtISO: at,
  }
}

/** The suffixed progress keys `keys()` lists, as learner ids, in key order. */
function scanLearnerIds(raw: KeyValueStore): string[] {
  if (typeof raw.keys !== 'function') return []
  const prefix = `${STORAGE_KEY}:`
  return raw
    .keys()
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
    .filter((id) => isValidUuid(id))
}

/**
 * Build learner 1 (and, on a rebuild, everyone the key scan finds) from
 * what is stored (§ 4.3 steps 3–4). Reads only.
 */
function buildList(
  raw: KeyValueStore,
  rebuild: boolean,
): { list: LearnerList; fresh: boolean } {
  const at = progressNow().toISOString()
  const legacyRaw = raw.getItem(STORAGE_KEY)
  const scanned = rebuild ? scanLearnerIds(raw) : []
  const learners: LearnerEntry[] = []
  const makeLegacy = !rebuild || legacyRaw !== null || scanned.length === 0
  const fresh = makeLegacy && legacyRaw === null
  if (makeLegacy) {
    const name = fresh
      ? ''
      : listName(withKeyValueStore(raw, loadProgress)?.profile.childName)
    learners.push(legacyEntry(name, fresh, at))
  }
  for (const id of scanned) {
    const probe: LearnerEntry = {
      id,
      name: '',
      avatarId: 'fox',
      language: 'en',
      legacySlot: false,
      start: { math: 1, wordSong: 1 },
      createdAtISO: at,
    }
    const doc = loadDocAt(raw, probe)
    learners.push({
      ...probe,
      name: listName(doc?.profile.childName),
      avatarId: pictureFor(doc, learners),
    })
  }
  return {
    list: { schemaVersion: 1, learners, activeLearnerId: learners[0]!.id },
    fresh,
  }
}

/**
 * The migration (§ 4.3), run by native boot right after the sqlite store
 * is installed. Reads the list; on a first run makes today's child learner
 * 1 (one write, the list, plus a fresh install's start doc); on a corrupt
 * list rebuilds it from the stored keys. Then installs the playing
 * learner's scoped store and the cloud push stamp.
 *
 * Never throws: boot runs at import. On any error it installs the raw
 * store, today's behaviour, and returns null.
 */
export function ensureLearnerList(): LearnerList | null {
  const installed = getKeyValueStore()
  if (installed === null) return null
  const raw = rawOf(installed)
  try {
    const stored = raw.getItem(LEARNERS_STORAGE_KEY)
    let parsed: unknown = undefined
    if (stored !== null) {
      try {
        parsed = JSON.parse(stored)
      } catch {
        parsed = undefined
      }
    }
    let list: LearnerList
    let writable = true
    if (isLearnerList(parsed)) {
      list = parsed
    } else {
      const built = buildList(raw, stored !== null)
      list = built.list
      if (isNewerLearnerList(parsed)) {
        // A newer build's list: use what we can in memory, write nothing.
        writable = false
      } else {
        raw.setItem(LEARNERS_STORAGE_KEY, JSON.stringify(list))
        // Only now, and only into a key that holds nothing: a crash
        // between the two writes leaves a learner with no doc, which the
        // readers' fallback rebuilds as this same start doc.
        if (built.fresh && raw.getItem(STORAGE_KEY) === null) {
          raw.setItem(
            STORAGE_KEY,
            JSON.stringify(learnerStartProgress(list.learners[0]!)),
          )
        }
      }
    }
    setLearnersState({ raw, list, writable })
    installActive()
    setCloudPushStamp(stampForPush)
    return list
  } catch (err) {
    setLearnersState(null)
    setCloudPushStamp(null)
    setKeyValueStore(raw)
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[learners] migration skipped — ${message}`)
    return null
  }
}

/** Make `id` the learner playing: saves the list and installs their store. */
export function activateLearner(id: string): LearnerEntry | null {
  const s = requireState()
  const entry = s.list.learners.find((l) => l.id === id)
  if (entry === undefined) return null
  if (s.list.activeLearnerId !== id) commit({ ...s.list, activeLearnerId: id })
  installActive()
  return entry
}

/**
 * Add a learner (§ 3.2): their start doc, then the list entry, and they
 * become the one playing. Throws on input the sheet never sends: a bad
 * name, a taken or unknown picture, a land that doesn't exist, a fifth
 * learner.
 */
export function addLearner(input: {
  name: string
  avatarId: AvatarId
  start: { math: number; wordSong: number }
}): LearnerEntry {
  const s = requireState()
  const learners = s.list.learners
  if (learners.length >= MAX_LEARNERS)
    throw new Error('learners: the device is full')
  if (!isValidLearnerName(input.name)) throw new Error('learners: invalid name')
  if (
    !isAvatarId(input.avatarId) ||
    !freeAvatars(learners).includes(input.avatarId)
  ) {
    throw new Error('learners: that picture is taken')
  }
  if (
    !isLandOf('math', input.start.math) ||
    !isLandOf('word-song', input.start.wordSong)
  ) {
    throw new Error('learners: no such land')
  }
  const entry: LearnerEntry = {
    id: generateUuid(),
    name: input.name.trim(),
    avatarId: input.avatarId,
    language: 'en',
    legacySlot: false,
    start: { math: input.start.math, wordSong: input.start.wordSong },
    createdAtISO: progressNow().toISOString(),
  }
  // The doc first: a crash before the list leaves unlisted keys, never a
  // listed learner without a doc.
  boundLearner(entry).save(learnerStartProgress(entry))
  commit({
    ...s.list,
    learners: [...learners, entry],
    activeLearnerId: entry.id,
  })
  installActive()
  return entry
}

function isLandOf(world: MasteryTrack, n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= landsOf(world).length
}

function replaceEntry(id: string, patch: Partial<LearnerEntry>): LearnerEntry {
  const s = requireState()
  const current = s.list.learners.find((l) => l.id === id)
  if (current === undefined) throw new Error('learners: no such learner')
  const next = { ...current, ...patch }
  commit({
    ...s.list,
    learners: s.list.learners.map((l) => (l.id === id ? next : l)),
  })
  return next
}

/** Re-save `entry`'s doc so it carries their current name and picture. */
function restamp(entry: LearnerEntry): void {
  const io = boundLearner(entry)
  const doc = io.load()
  if (doc !== null) io.save(doc)
}

/** Rename a learner (1–24 characters, § 3.2's set). */
export function renameLearner(id: string, name: string): void {
  if (!isValidLearnerName(name)) throw new Error('learners: invalid name')
  restamp(replaceEntry(id, { name: name.trim() }))
  installActive()
}

/** Give a learner another free picture. */
export function setLearnerAvatar(id: string, avatarId: AvatarId): void {
  const s = requireState()
  const others = s.list.learners.filter((l) => l.id !== id)
  if (!isAvatarId(avatarId) || !freeAvatars(others).includes(avatarId)) {
    throw new Error('learners: that picture is taken')
  }
  restamp(replaceEntry(id, { avatarId }))
  installActive()
}

/**
 * Move one world of a learner's start (§ 4.9, D1), down or up: that
 * world's steps are rebuilt for `land`, a pending promotion in it is
 * cleared, and everything banked stays (the other world, history, the
 * Leitner box, good and secure days, pace holds, unlock markers,
 * settings, stardust and session history). The entry's start follows, so
 * a lost doc and the review baseline follow the move. Stamped as this
 * learner's newest progress, like a QA jump, so the next reconcile pushes
 * it rather than an older cloud doc undoing it.
 */
export function setLearnerStart(
  id: string,
  world: MasteryTrack,
  land: number,
): void {
  if (!isLandOf(world, land)) throw new Error('learners: no such land')
  const s = requireState()
  const entry = s.list.learners.find((l) => l.id === id)
  if (entry === undefined) throw new Error('learners: no such learner')
  const io = boundLearner(entry)
  const doc = io.load() ?? learnerStartProgress(entry)
  const placed = placeAtStep(doc, landAt(world, land).nodes[0]!)
  const tree: readonly string[] = world === 'math' ? MATH_TREE : LITERACY_TREE
  const moved: Progress = { ...placed }
  if (
    moved.pendingPromotion !== undefined &&
    tree.includes(moved.pendingPromotion)
  ) {
    delete moved.pendingPromotion
  }
  moved.profile = {
    ...moved.profile,
    lastPlayedISO: progressNow().toISOString(),
  }
  const start =
    entry.start === 'legacy-default'
      ? legacyStartAfterMove(entry, world, land)
      : { ...entry.start, [world === 'math' ? 'math' : 'wordSong']: land }
  io.save(moved)
  replaceEntry(id, { start })
  installActive()
}

/**
 * A migrated learner's start after one world moves: that world's land,
 * and the other world's current land in Marian's diagnostic (Number
 * Garden 2, Word Song 1), so a lost doc rebuilds near where she began.
 */
function legacyStartAfterMove(
  entry: LearnerEntry,
  world: MasteryTrack,
  land: number,
): { math: number; wordSong: number } {
  const diagnostic = learnerStartProgress(entry)
  return world === 'math'
    ? { math: land, wordSong: currentLand(diagnostic, 'word-song').number }
    : { math: currentLand(diagnostic, 'math').number, wordSong: land }
}

/**
 * Remove a learner (§ 3.5): their list entry and their 7 keys. Their cloud
 * record is kept. The last learner can't be removed (false). If they were
 * playing, the first remaining learner plays next.
 */
export function removeLearner(id: string): boolean {
  const s = requireState()
  const entry = s.list.learners.find((l) => l.id === id)
  if (entry === undefined || s.list.learners.length <= 1) return false
  const learners = s.list.learners.filter((l) => l.id !== id)
  const activeLearnerId =
    s.list.activeLearnerId === id ? learners[0]!.id : s.list.activeLearnerId
  commit({ ...s.list, learners, activeLearnerId })
  for (const key of LEARNER_KEYS) {
    try {
      s.raw.removeItem(learnerKey(key, entry))
    } catch {
      // A key left behind is unlisted and unread; the list no longer has them.
    }
  }
  installActive()
  return true
}

// ── Bound I/O ───────────────────────────────────────────────────────────

/**
 * One learner's storage, whoever is playing (§ 4.4): load, save, the sync
 * ID and Last synced, all through `entry`'s scoped store. Async writers
 * (a reconcile's install, a Restore's ID write) and Parent Settings use
 * it, so a switch mid-flight can't land one learner's data on another.
 */
export function boundLearner(entry: LearnerEntry): LearnerIo {
  const run = <T>(fn: () => T): T => withKeyValueStore(scopedFor(entry), fn)
  return {
    load: () => run(loadProgress),
    save: (doc) => run(() => saveProgress(doc)),
    syncId: () => run(getOrCreateDeviceId),
    writeSyncId: (id) => run(() => writeStoredDeviceId(id)),
    recordLastSync: () => run(() => recordLastSync()),
  }
}

/** Where Splash or the picker goes for `entry` (§ 6.1): Greet only if they never played. */
export function nextAfterPick(entry: LearnerEntry): 'greet' | 'hub' {
  const store = scopedFor(entry)
  if (store === null) return 'greet'
  if (readSessionHistory(store).sessionCount > 0) return 'hub'
  const doc = boundLearner(entry).load()
  return doc !== null && doc.history.length > 0 ? 'hub' : 'greet'
}

// ── Cloud ───────────────────────────────────────────────────────────────

/** Sync IDs a Restore is adopting right now → the learner adopting it. */
const adopting = new Map<string, string>()

/** The listed learner whose sync-ID key holds `syncId` (raw read), if any. */
function learnerHoldingSyncId(
  syncId: string,
  exceptId?: string,
): LearnerEntry | null {
  const s = getLearnersState()
  if (s === null) return null
  const want = syncId.toLowerCase()
  for (const entry of s.list.learners) {
    if (entry.id === exceptId) continue
    if (storedSyncId(s.raw, entry)?.toLowerCase() === want) return entry
  }
  return null
}

/** The learner a sync for `syncId` belongs to: its holder, or a Restore adopting it. */
function learnerForSyncId(syncId: string): LearnerEntry | null {
  const held = learnerHoldingSyncId(syncId)
  if (held !== null) return held
  const adopter = adopting.get(syncId.toLowerCase())
  return adopter === undefined ? null : listedLearner(adopter)
}

/** The push stamp (§ 4.5): the carrier of the learner the record is theirs. */
function stampForPush(syncId: string, doc: Progress): Progress {
  const owner = learnerForSyncId(syncId)
  if (owner !== null) return stampDoc(doc, owner, syncId)
  return { ...doc, learner: { ...doc.learner, syncId } }
}

/**
 * Native's sync-success listener (K3): "Last synced" for the learner
 * whose sync ID it is, or nothing when no learner holds it. With no list
 * installed (a failed boot) it records as today.
 */
export function recordLastSyncForSyncId(syncId: string): void {
  if (getLearnersState() === null) {
    recordLastSync()
    return
  }
  const owner = learnerForSyncId(syncId)
  if (owner !== null) boundLearner(owner).recordLastSync()
}

/** The launch reconcile for `entry`, bound to them (§ 2.3 step 4, § 4.4). */
export function launchReconcileDeps(entry: LearnerEntry): LaunchReconcileDeps {
  const io = boundLearner(entry)
  return {
    configured: isCloudSyncConfigured,
    getDeviceId: io.syncId,
    loadLocal: io.load,
    reconcile: (deviceId, local) =>
      reconcileWithCloud(deviceId, local, {
        installLocally: io.save,
        requireCarrier: !entry.legacySlot,
      }),
  }
}

export type LearnerRestoreOutcome =
  | ReconcileOutcome
  /** The code is another learner's on this device (K8): nothing sent. */
  | { kind: 'code-held'; learner: LearnerEntry }

/**
 * Parent Settings' Restore for one learner (§ 3.4): read first, then
 * adopt the code as their sync ID (`adoptDeviceIdAfterRead`), every step
 * bound to `entry`. Refused with nothing written: a code another learner
 * here holds, before any network call (K8); a record that holds another
 * learner's doc (X3, `cloud-learner-mismatch`).
 */
export async function restoreLearnerFromCode(
  entry: LearnerEntry,
  code: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<LearnerRestoreOutcome> {
  const held = learnerHoldingSyncId(code, entry.id)
  if (held !== null) return { kind: 'code-held', learner: held }
  const io = boundLearner(entry)
  const key = code.toLowerCase()
  adopting.set(key, entry.id)
  try {
    return await adoptDeviceIdAfterRead(code, {
      writeDeviceId: io.writeSyncId,
      loadLocal: io.load,
      reconcile: (id, local) =>
        reconcileWithCloud(id, local, {
          fetchImpl: opts.fetchImpl,
          installLocally: io.save,
          requireCarrier: !entry.legacySlot,
        }),
    })
  } finally {
    if (adopting.get(key) === entry.id) adopting.delete(key)
  }
}

export type AddFromBackupOutcome =
  | { kind: 'added'; learner: LearnerEntry }
  /** The code is a learner here already: nothing written, nothing sent. */
  | { kind: 'already-here'; learner: LearnerEntry }
  /** The record's carrier names another code (X3): nothing written. */
  | { kind: 'other-learner-record' }
  | { kind: 'not-found' }
  /** The record fails this build's guard: nothing written. */
  | { kind: 'rejected' }
  | { kind: 'error'; reason: CloudErrorReason }
  | { kind: 'invalid-code' }
  /** Already 4 learners. */
  | { kind: 'full' }

/**
 * Add from a code (§ 3.3, K8): a new learner from a cloud record, never
 * over an existing one. The code is checked against every learner's sync
 * ID before any network call; then the record is read and installed with
 * no local merge, never through a reconcile (which on a 404 or an older
 * record would push the playing learner's doc to that code). A record
 * with no carrier is accepted (another device's learner 1 from before
 * profiles). The new learner becomes the one playing.
 */
export async function addLearnerFromBackup(
  code: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<AddFromBackupOutcome> {
  const trimmed = code.trim()
  if (!isValidUuid(trimmed)) return { kind: 'invalid-code' }
  const before = precheckAdd(trimmed)
  if (before !== null) return before

  const fetched = await fetchProgressFromCloud(trimmed, {
    fetchImpl: opts.fetchImpl,
  })
  if (fetched.kind === 'error') return { kind: 'error', reason: fetched.reason }
  if (fetched.kind === 'not-found') return { kind: 'not-found' }
  if (isOtherLearnersRecord(fetched.blob, trimmed, false)) {
    return { kind: 'other-learner-record' }
  }
  const doc = installCloudBlob(fetched.blob)
  if (doc === null) return { kind: 'rejected' }

  // The list may have changed while the read was in flight.
  const after = precheckAdd(trimmed)
  if (after !== null) return after
  const s = requireState()
  const entry: LearnerEntry = {
    id: generateUuid(),
    name: listName(doc.profile.childName),
    avatarId: pictureFor(doc, s.list.learners),
    language: 'en',
    legacySlot: false,
    start: { math: 1, wordSong: 1 },
    createdAtISO: progressNow().toISOString(),
  }
  const io = boundLearner(entry)
  io.writeSyncId(trimmed)
  io.save(doc)
  commit({
    ...s.list,
    learners: [...s.list.learners, entry],
    activeLearnerId: entry.id,
  })
  installActive()
  return { kind: 'added', learner: entry }
}

function precheckAdd(code: string): AddFromBackupOutcome | null {
  const s = requireState()
  const held = learnerHoldingSyncId(code)
  if (held !== null) return { kind: 'already-here', learner: held }
  if (s.list.learners.length >= MAX_LEARNERS) return { kind: 'full' }
  return null
}

// ── Tests ───────────────────────────────────────────────────────────────

/** Tests: forget the list and the push stamp (the installed store stays). */
export function resetLearnersForTests(): void {
  setLearnersState(null)
  setCloudPushStamp(null)
  adopting.clear()
}
