/**
 * Map model — the data behind one world's map screen per
 * `design/emmas-path/emmas-path-spec.md` §1 "Data contract" + §3 "Map
 * screen". Ticket 123jpnbc3dr (Emma's Path 8/10).
 *
 * Pure. Every per-step fact comes from `nodeProgress()` so the map cannot
 * drift from the mastery rule. The current step is the Hub card's
 * `currentStepOf` (first not-mastered step in tree order — the same
 * forward rule as `pickFocusNode`; the last step when all are mastered).
 */

import {
  defaultProgress,
  getSettings,
  type MasteryTrack,
  type Progress,
  type SkillNode,
} from '../progress'
import { landsOf } from '../progress/lands'
import { nodeProgress } from '../progress/nodeProgress'
import { currentStepOf } from '../hub/hubCardModel'

export type StopState = 'mastered' | 'current' | 'open' | 'locked'

export interface MapStop {
  node: SkillNode
  state: StopState
  /**
   * Bud groups under the stop (spec §3.4): one group of `requiredDays`;
   * letter-sounds with per-vowel tracking = one group per vowel.
   * true = open (a banked good day). Empty for mastered / locked stops.
   */
  buds: boolean[][]
  /** cvc-words with every bud open but the novel-word check pending. */
  nearlyThere: boolean
}

export interface MapLand {
  number: number
  name: string
  /** Gate open = the land's first step is not locked (spec §1). Land 1 is always open. */
  open: boolean
  stops: MapStop[]
}

export interface MapModel {
  world: MasteryTrack
  current: SkillNode
  /** Every step mastered — Emma cheers on the last stop (spec §3.6). */
  complete: boolean
  showLandNumber: boolean
  /** Land 1 first (bottom of the map). */
  lands: MapLand[]
}

const budRow = (good: number, required: number): boolean[] =>
  Array.from({ length: required }, (_, i) => i < good)

export function buildMapModel(
  progress: Progress | null,
  world: MasteryTrack,
): MapModel {
  const p = progress ?? defaultProgress()
  const current = currentStepOf(p, world)
  const worldLands = landsOf(world)
  const complete = worldLands.every((land) =>
    land.nodes.every((node) => p.skillLevels[node] === 'mastered'),
  )

  const lands = worldLands.map((land): MapLand => {
    const stops = land.nodes.map((node): MapStop => {
      const np = nodeProgress(p, node)
      let state: StopState
      if (node === current && !complete) state = 'current'
      else if (np.level === 'mastered') state = 'mastered'
      else if (np.level === 'locked') state = 'locked'
      else state = 'open'
      const showBuds = state === 'current' || state === 'open'
      const buds = !showBuds
        ? []
        : np.vowels !== undefined
          ? np.vowels.map((v) => budRow(v.goodDays, v.requiredDays))
          : [budRow(np.goodDays, np.requiredDays)]
      return {
        node,
        state,
        buds,
        nearlyThere: showBuds && np.awaitingNovelWordCheck,
      }
    })
    const open =
      land.number === 1 || nodeProgress(p, land.nodes[0]!).level !== 'locked'
    return { number: land.number, name: land.name, open, stops }
  })

  return {
    world,
    current,
    complete,
    showLandNumber: getSettings(p).showLevelToMarian,
    lands,
  }
}

/** All stops in path order (land 1 first). */
export function stopsInOrder(model: MapModel): MapStop[] {
  return model.lands.flatMap((land) => land.stops)
}
