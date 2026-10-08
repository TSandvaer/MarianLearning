/**
 * Map unlock beat — the session-end unlock moment, played on the map
 * (Emma's Path 9/10, ClickUp 123jpnbc3dt; spec
 * `design/emmas-path/emmas-path-spec.md` §6 steps 3–4, §4.4 lines, §7).
 *
 * The map plays it when `pendingUnlock(progress, world)` is set on mount
 * and marks it celebrated straight away (`persistUnlockCelebrated`), so a
 * reload, Home → Map, or a cloud restore never replays it.
 */

import { pathLine, type PathLine } from '../emmasPath/pathLines'
import {
  getOrCreateDeviceId,
  loadProgress,
  pushProgressToCloud,
  saveProgress,
  type MasteryTrack,
} from '../progress'
import { markUnlockCelebrated, type PendingUnlock } from '../progress/pathBeats'

/** Choreography phases, in order. `gate` only on a land beat. */
export type UnlockPhase = 'bloom' | 'hop' | 'pop' | 'gate' | 'cheer'

/** Phase start times in ms from map mount (spec §6). */
export function unlockTimeline(
  unlock: PendingUnlock,
): { phase: UnlockPhase; at: number }[] {
  return unlock.land === null
    ? [
        { phase: 'hop', at: 400 },
        { phase: 'pop', at: 1100 },
        { phase: 'cheer', at: 1500 },
      ]
    : [
        { phase: 'hop', at: 400 },
        { phase: 'pop', at: 1100 },
        // Gate swing (600 ms) between padlock-pop and the line.
        { phase: 'gate', at: 1500 },
        { phase: 'cheer', at: 2100 },
      ]
}

/** Phase order, for "has phase X started yet?" checks. */
const ORDER: readonly UnlockPhase[] = ['bloom', 'hop', 'pop', 'gate', 'cheer']
export function reached(
  phase: UnlockPhase | null,
  target: UnlockPhase,
): boolean {
  return phase === null || ORDER.indexOf(phase) >= ORDER.indexOf(target)
}

/**
 * The line Emma says at `cheer`: `end.unlock.{node}`, or `end.land.*` when
 * a gate opened (the no-number variant when land numbers are hidden).
 */
export function unlockLine(
  unlock: PendingUnlock,
  showLandNumber: boolean,
): PathLine {
  const id =
    unlock.land === null
      ? `end.unlock.${unlock.unlocked}`
      : `end.land.${unlock.world}.${unlock.land.number}${
          showLandNumber ? '' : '.no-number'
        }`
  const line = pathLine(id)
  if (line === undefined) throw new Error(`No Emma's Path line '${id}'`)
  return line
}

/** Save the seen-marker for `world` (and back it up to the cloud). */
export function persistUnlockCelebrated(world: MasteryTrack): void {
  try {
    const progress = loadProgress()
    if (progress === null) return
    const marked = markUnlockCelebrated(progress, world)
    if (marked === progress) return
    saveProgress(marked)
    void pushProgressToCloud(getOrCreateDeviceId(), marked)
  } catch (err) {
    console.warn('[Map] could not save the unlock seen-marker:', err)
  }
}
