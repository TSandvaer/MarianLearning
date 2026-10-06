/**
 * Hub card model — the data behind one world's clay Hub card (Redesign
 * R2, ClickUp 123jpnbc68z): the current step, the padlocked next step,
 * the land, and the seed holes. The full all-steps overview lives on the
 * map, not the Hub (quality bar 9), so this model carries no bead row.
 *
 * Pure. Every per-step fact comes from `nodeProgress()` so the card
 * cannot drift from the mastery rule; this module never reads raw
 * mastery history. The current-step rule (first not-mastered step in
 * tree order; last step when all mastered) is
 * `design/emmas-path/emmas-path-spec.md` §1.
 */

import {
  LITERACY_TREE,
  MATH_TREE,
  defaultProgress,
  getSettings,
  type MasteryTrack,
  type Progress,
  type SkillNode,
} from '../../lib/progress'
import { landOf } from '../../lib/progress/lands'
import { nodeProgress } from '../../lib/progress/nodeProgress'
import { landArtId, type LandArtId } from '../../lib/emmasPath/pathArt'

export interface HubCardModel {
  world: MasteryTrack
  /** `landOf(current).number`. */
  landNumber: number
  /** Clay emblem of the current step's land. */
  landArt: LandArtId
  /** `getSettings(p).showLevelToMarian` — gates the land pill only. */
  showLandNumber: boolean
  current: SkillNode
  /** `nodeProgress(p, current).unlocksNext` — null on a tree's last step. */
  unlocksNext: SkillNode | null
  goodDays: number
  requiredDays: number
  /**
   * Seed holes, one per required good day; true = a banked good day.
   * Letter sounds with per-vowel tracking shows the vowel being worked
   * on (the first not-yet-full vowel), so the Hub keeps one row of 3
   * instead of the spec's 12 per-vowel buds (redesign README).
   */
  holes: boolean[]
  /** True when every step of the world is mastered. */
  complete: boolean
}

function treeOf(world: MasteryTrack): readonly SkillNode[] {
  return world === 'math' ? MATH_TREE : LITERACY_TREE
}

export function currentStepOf(
  progress: Progress,
  world: MasteryTrack,
): SkillNode {
  const tree = treeOf(world)
  const first = tree.find((node) => progress.skillLevels[node] !== 'mastered')
  return first ?? tree[tree.length - 1]!
}

function holeRow(good: number, required: number): boolean[] {
  return Array.from({ length: required }, (_, i) => i < good)
}

export function buildHubCardModel(
  progress: Progress | null,
  world: MasteryTrack,
): HubCardModel {
  const p = progress ?? defaultProgress()
  const current = currentStepOf(p, world)
  const cur = nodeProgress(p, current)
  const complete = treeOf(world).every(
    (node) => p.skillLevels[node] === 'mastered',
  )
  const land = landOf(current)

  let holes: boolean[]
  if (cur.vowels !== undefined && cur.vowels.length > 0) {
    const working =
      cur.vowels.find((v) => v.goodDays < v.requiredDays) ??
      cur.vowels[cur.vowels.length - 1]!
    holes = holeRow(working.goodDays, working.requiredDays)
  } else {
    holes = holeRow(cur.goodDays, cur.requiredDays)
  }
  if (complete) holes = holes.map(() => true)

  return {
    world,
    landNumber: land.number,
    landArt: landArtId(land),
    showLandNumber: getSettings(p).showLevelToMarian,
    current,
    unlocksNext: complete ? null : cur.unlocksNext,
    goodDays: cur.goodDays,
    requiredDays: cur.requiredDays,
    holes,
    complete,
  }
}
