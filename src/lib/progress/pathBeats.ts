/**
 * Emma's Path progress beats — which celebration a session earned
 * (Emma's Path 9/10, ClickUp 123jpnbc3dt; spec
 * `design/emmas-path/emmas-path-spec.md` §1 data contract + §6).
 *
 * - Bud beat (SessionEnd): the session's focus step banked a good day
 *   (`nodeProgress(after).goodDays > nodeProgress(before).goodDays`) and
 *   nothing unlocked. Derived from the one session-end write, so it is
 *   computed once per session and never replays.
 * - Unlock / land beat (map): PERSISTED seen-marker,
 *   `progress.unlocksCelebrated` — the steps whose opening is accounted
 *   for. A step that is open but not on the list is an unlock still to
 *   celebrate. The map celebrates it and adds it, so a reload, a second
 *   map visit or a cloud restore (lists union, `cloudSync.ts`) never
 *   replays it. A rule derived from levels alone cannot tell
 *   "celebrated" from "not seen yet" across a reload — hence the marker.
 *
 * The marker is a set, not "furthest step": real progress docs have open
 * steps past locked ones (the diagnostic baseline opens `sub-to-10` and
 * `mult-2-5-10` while `add-to-20` is locked), so "furthest" would miss
 * the add-to-20 unlock.
 *
 * Steps are only ever added. An absent list means "nothing pending"; the
 * session-end write seeds it from the pre-session doc so a blob that
 * predates the marker never replays old unlocks.
 *
 * Pure: no storage access.
 */

import { landOf, landsOf, type Land } from './lands'
import { trackOf, type MasteryTrack } from './mastery'
import { nodeProgress, type NodeProgress } from './nodeProgress'
import type { Progress, SkillNode } from './types'

const WORLDS: readonly MasteryTrack[] = ['math', 'word-song']

/** One world's steps in tree order (the land table, flattened). */
function stepsOf(world: MasteryTrack): readonly SkillNode[] {
  return landsOf(world).flatMap((land) => land.nodes)
}

/** Every open (not locked) step of `worlds`, in tree order. */
function openSteps(
  progress: Progress,
  worlds: readonly MasteryTrack[] = WORLDS,
): SkillNode[] {
  return worlds.flatMap((world) =>
    stepsOf(world).filter((node) => progress.skillLevels[node] !== 'locked'),
  )
}

/**
 * The marker to save with a session-end write: the existing list, or —
 * when the doc has none yet — every step open right now ("everything
 * unlocked so far counts as celebrated"). Same array when present.
 */
export function seedUnlocksCelebrated(progress: Progress): SkillNode[] {
  return progress.unlocksCelebrated ?? openSteps(progress)
}

export interface PendingUnlock {
  world: MasteryTrack
  /** The unlocked step's tree predecessor — the step just mastered. */
  mastered: SkillNode
  /** The step that opened. */
  unlocked: SkillNode
  /** Set when the unlocked step is the first of its land: a gate opened. */
  land: Land | null
}

/**
 * The unlock the map still has to celebrate for `world`, or null: the
 * first open step in tree order that is not on the list. Two unlocks
 * banked at once get one beat (the map then marks both).
 */
export function pendingUnlock(
  progress: Progress,
  world: MasteryTrack,
): PendingUnlock | null {
  const seen = progress.unlocksCelebrated
  if (seen === undefined) return null
  const steps = stepsOf(world)
  const index = steps.findIndex(
    (node, i) =>
      i > 0 && progress.skillLevels[node] !== 'locked' && !seen.includes(node),
  )
  if (index < 0) return null
  const unlocked = steps[index]!
  const land = landOf(unlocked)
  return {
    world,
    mastered: steps[index - 1]!,
    unlocked,
    land: land.number > 1 && land.nodes[0] === unlocked ? land : null,
  }
}

/** Mark every open step of `world` celebrated. Same doc when nothing changes. */
export function markUnlockCelebrated(
  progress: Progress,
  world: MasteryTrack,
): Progress {
  const seen = progress.unlocksCelebrated ?? []
  const added = openSteps(progress, [world]).filter((n) => !seen.includes(n))
  if (added.length === 0 && progress.unlocksCelebrated !== undefined) {
    return progress
  }
  return { ...progress, unlocksCelebrated: [...seen, ...added] }
}

/**
 * Union of two marker lists — the cloud-restore rule (a celebrated unlock
 * stays celebrated). Returns `a` itself when `b` adds nothing.
 */
export function mergeUnlocksCelebrated(
  a: SkillNode[] | undefined,
  b: SkillNode[] | undefined,
): SkillNode[] | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const added = b.filter((n) => !a.includes(n))
  return added.length === 0 ? a : [...a, ...added]
}

export type SessionEndBeat =
  | { kind: 'none' }
  | {
      kind: 'bud'
      node: SkillNode
      before: NodeProgress
      after: NodeProgress
    }
  | { kind: 'unlock'; unlock: PendingUnlock }

/**
 * What the session earned. `before` = the doc the session started from,
 * `after` = the doc the session-end write saved (history + mastery rule
 * applied, marker seeded).
 *
 * Unlock wins over bud: the unlock moment is the map's (spec §6 step 3).
 * A bad day, or a second good session on the same day, is `none`.
 */
export function sessionEndBeat(
  before: Progress,
  after: Progress,
  focusNode: SkillNode,
): SessionEndBeat {
  const world = trackOf(focusNode)
  if (world === null) return { kind: 'none' }
  const unlock = pendingUnlock(after, world)
  if (unlock !== null) return { kind: 'unlock', unlock }
  const was = nodeProgress(before, focusNode)
  const now = nodeProgress(after, focusNode)
  if (now.goodDays > was.goodDays) {
    return { kind: 'bud', node: focusNode, before: was, after: now }
  }
  return { kind: 'none' }
}
