/**
 * Per-learner keys and the scoped store (`design/native/learner-profiles.md`
 * §§ 4.2, 4.4, 4.5).
 *
 * The learner in the legacy slot (learner 1, today's child) keeps today's
 * 8 keys; every other learner has the same keys with a `:<id>` suffix. The
 * scoped store rewrites those 8 keys and passes every other key (the list
 * itself included) through, so the 8 modules that own them work unchanged.
 *
 * It is also where a learner's doc is stamped with its carrier: every
 * write of a learner's progress key carries that learner's sync ID,
 * picture and language, and their list name as `profile.childName`. One
 * place, whoever saves: Session End, a bound reconcile install, Parent
 * Settings, a seed.
 */
import {
  withKeyValueStore,
  type KeyValueStore,
} from '../platform/keyValueStore'
import { getOrCreateDeviceId } from '../progress/deviceId'
import { listedLearner } from './state'
import type { LearnerEntry } from './types'

/**
 * Today's 8 per-child keys (§ 4.2), owned by their modules: the 7 of § 4.2
 * and Letter critters' word hunt round (critters-word-hunt.md § 1).
 */
export const LEARNER_KEYS = [
  'marian-tutor:progress:v1', // progress/storage.ts STORAGE_KEY
  'marian-tutor.session-history.v1', // sessionEnd/sessionHistory.ts
  'marian-tutor.stardust.v1', // shared/stardust.ts
  'session-end-not-yet-nudge.v1', // sessionEnd/notYetNudge.ts
  'hub-flower-wake.v1', // hub/hubGuidance.ts
  'marian-tutor:device-id', // progress/deviceId.ts: the sync ID
  'marian-tutor:last-sync', // progress/lastSync.ts
  'marian-tutor.critter-hunt.v1', // games/critterHunt.ts HUNT_STORAGE_KEY
] as const

const PROGRESS_KEY = LEARNER_KEYS[0]
const SYNC_ID_KEY = LEARNER_KEYS[5]
const PER_LEARNER: ReadonlySet<string> = new Set(LEARNER_KEYS)

/** `base` for the legacy slot, `<base>:<id>` for everyone else. */
export function learnerKey(baseKey: string, entry: LearnerEntry): string {
  return entry.legacySlot ? baseKey : `${baseKey}:${entry.id}`
}

/** Scoped store → the raw store under it. */
const RAW_OF = new WeakMap<KeyValueStore, KeyValueStore>()

/** The raw store under `store` (itself when it isn't a scoped store). */
export function rawOf(store: KeyValueStore): KeyValueStore {
  return RAW_OF.get(store) ?? store
}

/** `entry`'s 8 keys over `raw`; every other key passes through. */
export function learnerScopedStore(
  raw: KeyValueStore,
  entry: LearnerEntry,
): KeyValueStore {
  const base = rawOf(raw)
  const map = (key: string) =>
    PER_LEARNER.has(key) ? learnerKey(key, entry) : key
  const scoped: KeyValueStore = {
    getItem: (key) => base.getItem(map(key)),
    setItem: (key, value) => {
      const out =
        key === PROGRESS_KEY ? stampSerializedDoc(value, scoped, entry) : value
      base.setItem(map(key), out)
    },
    removeItem: (key) => base.removeItem(map(key)),
  }
  RAW_OF.set(scoped, base)
  return scoped
}

/** The doc's carrier fields, as stamped (§ 4.5). */
export interface Carrier {
  syncId: string
  avatarId: string
  language: string
}

/**
 * `doc` stamped as `entry`'s: the carrier, and `profile.childName` set to
 * the list name. An unnamed learner keeps a name the doc already has, so a
 * Restore into an unnamed learner 1 never blanks it.
 */
export function stampDoc<T extends { profile: { childName: string } }>(
  doc: T,
  entry: LearnerEntry,
  syncId: string,
): T & { learner: Carrier } {
  const childName = entry.name !== '' ? entry.name : doc.profile.childName
  return {
    ...doc,
    profile: { ...doc.profile, childName },
    learner: { syncId, avatarId: entry.avatarId, language: entry.language },
  }
}

function stampSerializedDoc(
  value: string,
  scoped: KeyValueStore,
  captured: LearnerEntry,
): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return value
  }
  if (!isDocLike(parsed)) return value
  const entry = listedLearner(captured.id) ?? captured
  // getOrCreateDeviceId on this learner's own sync-ID key.
  const syncId = withKeyValueStore(scoped, getOrCreateDeviceId)
  return JSON.stringify(stampDoc(parsed, entry, syncId))
}

function isDocLike(v: unknown): v is { profile: { childName: string } } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const profile = (v as { profile?: unknown }).profile
  return (
    typeof profile === 'object' && profile !== null && !Array.isArray(profile)
  )
}

/** The sync ID stored for `entry` (raw read, no create), or null. */
export function storedSyncId(
  raw: KeyValueStore,
  entry: LearnerEntry,
): string | null {
  try {
    return rawOf(raw).getItem(learnerKey(SYNC_ID_KEY, entry))
  } catch {
    return null
  }
}
