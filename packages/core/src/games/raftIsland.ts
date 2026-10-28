/**
 * Raft crossing's island goal, the core (`design/native/raft-island-goal.md`
 * § 11.1; the rules are Dave's ruling of 2026-10-25,
 * `design/research/raft-island-goal-2026-10-25.md`): each raft's island
 * keeps the kinds that have come home, and a full 10 island opens the 20
 * raft.
 *
 * The record is toy state, never progress (Dave (1)): one learner key, no
 * mastery, Leitner, stardust, history, streak or sync. It keeps only the
 * kinds home per island: no crossings, trips, shores, totals or times.
 * Which rafts are open is derived from it (`openRafts`), not stored.
 */
import { getKeyValueStore } from '../platform/keyValueStore'
import type { Progress } from '../progress/types'
import {
  openPlayGames,
  RAFT_TARGETS,
  type RaftTarget,
  type RaftWeight,
} from './playPlace'

/** The kinds home on each raft's island, ascending (Dave (1)). */
export interface IslandRecord {
  10: RaftWeight[]
  20: RaftWeight[]
}

/** The nine kinds, bee 1 to pig 9: one home each on every island. */
const KINDS: readonly RaftWeight[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * One of the learner's own keys (`learners/keys.ts` `LEARNER_KEYS`), beside
 * the hunt's. Its value is by raft, `{ "10": [1, 9], "20": [] }`.
 */
export const RAFT_ISLAND_STORAGE_KEY = 'marian-tutor.raft-island.v1'

/** Both islands with nobody home. */
export const emptyIslandRecord = (): IslandRecord => ({ 10: [], 20: [] })

/** The kinds `target`'s island lacks, ascending: `raftShore`'s `missing`. */
export const islandMissing = (
  record: IslandRecord,
  target: RaftTarget,
): RaftWeight[] => KINDS.filter((k) => !record[target].includes(k))

/** All nine kinds are home on `target`'s island. */
export const islandFull = (record: IslandRecord, target: RaftTarget): boolean =>
  islandMissing(record, target).length === 0

/**
 * `record` with `weight`'s kind home on `target`'s island. A kind already
 * home changes nothing (the same object), so a caller writes only when a
 * kind is new (I7). Kinds never leave.
 */
export function islandHome(
  record: IslandRecord,
  target: RaftTarget,
  weight: RaftWeight,
): IslandRecord {
  if (record[target].includes(weight)) return record
  return {
    ...record,
    [target]: [...record[target], weight].sort((a, b) => a - b),
  }
}

/**
 * The rafts the learner has open (Dave (3)): `[]` without the raft (adding
 * to ten not yet current or mastered, or `null`), `[10]`, and `[10, 20]`
 * once the 10 island has all nine kinds, whatever the 20 island holds and
 * whether or not adding to twenty is current. Never `[20]` alone, and,
 * since kinds never leave, never back from `[10, 20]`.
 */
export function openRafts(
  progress: Progress | null,
  record: IslandRecord,
): RaftTarget[] {
  if (!openPlayGames(progress).includes('raft')) return []
  return islandFull(record, 10) ? [10, 20] : [10]
}

/** An island's readable kinds, ascending, once each. */
function kindsOf(v: unknown): RaftWeight[] {
  if (!Array.isArray(v)) return []
  return KINDS.filter((k) => v.includes(k))
}

/**
 * The playing learner's islands. None, or unreadable, reads as empty; a
 * damaged island keeps the kinds it can read.
 */
export function loadIslandRecord(): IslandRecord {
  try {
    const raw = getKeyValueStore()?.getItem(RAFT_ISLAND_STORAGE_KEY) ?? null
    if (raw === null) return emptyIslandRecord()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return emptyIslandRecord()
    const all = parsed as Record<string, unknown>
    const out = emptyIslandRecord()
    for (const t of RAFT_TARGETS) out[t] = kindsOf(all[String(t)])
    return out
  } catch {
    return emptyIslandRecord()
  }
}

/**
 * Writes the playing learner's islands (a kind's first landing, Dave (1)).
 * A storage failure is logged: play never waits on it.
 */
export function saveIslandRecord(record: IslandRecord): void {
  const store = getKeyValueStore()
  if (store === null) return
  try {
    store.setItem(RAFT_ISLAND_STORAGE_KEY, JSON.stringify(record))
  } catch (err) {
    console.warn('[Raft] could not save the island:', err)
  }
}
