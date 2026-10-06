/**
 * "Play again to get today's flower." is said at most once a day per
 * world (Guidance G2, mockup screen f risk note): a second not-yet
 * session the same day gets the practice line only.
 *
 * Stored per world as the local day key it was last said on. Storage
 * failures fall back to "not said", so at worst the line repeats.
 */

import type { MasteryTrack } from '../../lib/progress'
import type { StorageAdapter } from '../Math/stardust'

export const NOT_YET_NUDGE_STORAGE_KEY = 'session-end-not-yet-nudge.v1'

type NudgeRecord = Partial<Record<MasteryTrack, string>>

function defaultStorage(): StorageAdapter | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function read(storage: StorageAdapter | null): NudgeRecord {
  try {
    const raw = storage?.getItem(NOT_YET_NUDGE_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: NudgeRecord = {}
    for (const world of ['math', 'word-song'] as const) {
      const v = (parsed as Record<string, unknown>)[world]
      if (typeof v === 'string') out[world] = v
    }
    return out
  } catch {
    return {}
  }
}

export function nudgeSaidToday(
  world: MasteryTrack,
  today: string,
  storage?: StorageAdapter,
): boolean {
  return read(storage ?? defaultStorage())[world] === today
}

export function markNudgeSaid(
  world: MasteryTrack,
  today: string,
  storage?: StorageAdapter,
): void {
  const s = storage ?? defaultStorage()
  try {
    s?.setItem(
      NOT_YET_NUDGE_STORAGE_KEY,
      JSON.stringify({ ...read(s), [world]: today }),
    )
  } catch {
    // Private mode / quota: the line may be said again; nothing breaks.
  }
}
