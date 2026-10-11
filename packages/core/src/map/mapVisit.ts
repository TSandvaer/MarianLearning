/**
 * One map visit, decided once on mount, and what the unlock beat shows at
 * each phase. Emma's Path 8/10 + 9/10 (ClickUp 123jpnbc3dr, 123jpnbc3dt;
 * spec `design/emmas-path/emmas-path-spec.md` §3, §6).
 *
 * Moved out of the web map screen (`src/screens/Map/MapScreen.tsx`) so the
 * native map mounts from the same rules: the final model, the unlock still
 * to celebrate (frozen at mount), the first caption and Emma's resting
 * pose; then, per beat phase, the model as the beat shows it (the new stop
 * still frosted before the pop, its land's gate still closed before the
 * swing), where Emma's badge stands and whether taps wait. The web screen
 * consumes these unchanged (`src/screens/Map/mapVisitParity.test.tsx`).
 *
 * Pure: no storage access. The seen-marker write stays with the screen
 * (`persistUnlockCelebrated`).
 */

import type { EmmaPose } from '../character/emmaPose'
import type { PathLine } from '../emmasPath/pathLines'
import type { MasteryTrack, Progress, SkillNode } from '../progress'
import { pendingUnlock, type PendingUnlock } from '../progress/pathBeats'
import { openLine } from './mapLines'
import { buildMapModel, type MapModel } from './mapModel'
import { reached, type UnlockPhase } from './unlockBeat'

/** `none`, a stop unlock, or a land unlock (a gate opens too). */
export type MapBeat = 'none' | 'unlock' | 'land'

export interface MapVisit {
  world: MasteryTrack
  /** The map once every beat has played. */
  model: MapModel
  /** The unlock this visit celebrates, frozen at mount; null = none. */
  unlock: PendingUnlock | null
  beat: MapBeat
  /** The phase the visit opens on: `bloom` for a beat, else null. */
  phase: UnlockPhase | null
  /**
   * Caption from the first frame: the open line ("Here is your path! You
   * are on {name}."). Null during a beat: the ribbon waits for Emma's line.
   */
  caption: PathLine | null
  /** Emma's pose at rest: cheering once the world is complete. */
  restPose: EmmaPose
  /**
   * Stops whose land also gets Emma's badge room for the whole visit (the
   * just-mastered stop, where the beat starts), so nothing jumps when she
   * hops. Pass to `layoutMap` / `badgeLands`.
   */
  alsoBadged: SkillNode[]
}

export function planMapVisit(
  progress: Progress | null,
  world: MasteryTrack,
): MapVisit {
  const model = buildMapModel(progress, world)
  const unlock = progress === null ? null : pendingUnlock(progress, world)
  return {
    world,
    model,
    unlock,
    beat: unlock === null ? 'none' : unlock.land !== null ? 'land' : 'unlock',
    phase: unlock === null ? null : 'bloom',
    caption: unlock === null ? openLine(model) : null,
    restPose: model.complete ? 'cheering' : 'idle',
    alsoBadged: unlock === null ? [] : [unlock.mastered],
  }
}

/**
 * The model as the unlock beat shows it at `phase`: before the pop the new
 * stop is still locked (frost + padlock, no buds); before the swing its
 * land's gate is still closed. The final model itself once both are past.
 */
export function beatModel(
  model: MapModel,
  unlock: PendingUnlock | null,
  phase: UnlockPhase | null,
): MapModel {
  if (unlock === null) return model
  const stillLocked = !reached(phase, 'pop')
  const gateClosed = unlock.land !== null && !reached(phase, 'gate')
  if (!stillLocked && !gateClosed) return model
  return {
    ...model,
    lands: model.lands.map((land) => ({
      ...land,
      open:
        gateClosed && land.number === unlock.land?.number ? false : land.open,
      stops: land.stops.map((stop) =>
        stillLocked && stop.node === unlock.unlocked
          ? { ...stop, state: 'locked' as const, buds: [], nearlyThere: false }
          : stop,
      ),
    })),
  }
}

/** What the map shows at one beat phase (`null` = no beat, or played). */
export interface MapBeatView {
  model: MapModel
  /** The stop Emma's badge marks: the just-mastered one until she hops. */
  emmaNode: SkillNode
  /** Taps wait until the beat reaches Emma's line. */
  tapsWait: boolean
  /** She is hopping to the new stop. */
  hopping: boolean
  /** The just-mastered stop whose flower badge blooms in. */
  bloomNode: SkillNode | null
  /** The stop whose padlock pops right now. */
  poppingNode: SkillNode | null
  /** The land whose gate swings open right now. */
  swingingLand: number | null
  /** The new land's band, faded until its gate swings. */
  fadedLand: number | null
}

export function mapBeatView(
  visit: Pick<MapVisit, 'model' | 'unlock'>,
  phase: UnlockPhase | null,
): MapBeatView {
  const { unlock } = visit
  const model = beatModel(visit.model, unlock, phase)
  const newLand = unlock?.land?.number ?? null
  return {
    model,
    emmaNode:
      unlock !== null && !reached(phase, 'hop')
        ? unlock.mastered
        : model.current,
    tapsWait: phase !== null && phase !== 'cheer',
    hopping: phase === 'hop',
    bloomNode: unlock?.mastered ?? null,
    poppingNode: unlock !== null && phase === 'pop' ? unlock.unlocked : null,
    swingingLand: phase === 'gate' ? newLand : null,
    fadedLand: newLand !== null && !reached(phase, 'gate') ? newLand : null,
  }
}

/** A sound effect: the web URL path and its volume. */
export interface MapSfx {
  src: string
  volume: number
}

/** Beat effects (spec §6): the padlock pops, the gate swings. */
export const UNLOCK_SFX: Readonly<Partial<Record<UnlockPhase, MapSfx>>> = {
  pop: { src: '/assets/sfx-chime-soft.mp3', volume: 0.85 },
  gate: { src: '/assets/sfx-cheer.mp3', volume: 0.7 },
}

/** A locked stop's "not yet" poof (spec §3.5). */
export const LOCKED_TAP_SFX: MapSfx = {
  src: '/assets/sfx-poof.mp3',
  volume: 0.45,
}

/** A locked-stop tap: Emma points this long, then rests. */
export const POINTING_MS = 1500
