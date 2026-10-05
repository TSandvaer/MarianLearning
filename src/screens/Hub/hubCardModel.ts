/**
 * Hub card model — the data behind one world's Hub card (land number,
 * hero row, bead row) per `design/emmas-path/emmas-path-spec.md` §1
 * "Data contract" + §2 "Hub card". Ticket 123jpnbc3dq (Emma's Path 7/10).
 *
 * Pure. Every per-step fact comes from `nodeProgress()` so the card
 * cannot drift from the mastery rule; this module never reads raw
 * mastery history. The current-step rule (first not-mastered step in
 * tree order; last step when all mastered) is spec §1.
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
import { landOf, landsOf } from '../../lib/progress/lands'
import { nodeProgress } from '../../lib/progress/nodeProgress'

export type BeadState = 'mastered' | 'current' | 'next' | 'open' | 'locked'

export interface Bead {
  node: SkillNode
  state: BeadState
}

export interface BeadLand {
  number: number
  beads: Bead[]
}

export interface HubCardModel {
  world: MasteryTrack
  /** `landOf(current).number`. */
  landNumber: number
  /** `getSettings(p).showLevelToMarian`. */
  showLandNumber: boolean
  current: SkillNode
  /** `nodeProgress(p, current).unlocksNext` — null on a tree's last step. */
  unlocksNext: SkillNode | null
  goodDays: number
  requiredDays: number
  /** goodDays / requiredDays, clamped to 0..1. */
  fill: number
  /**
   * Bud rows under the hero icon: one group of `requiredDays` for a plain
   * step; for letter-sounds with per-vowel tracking, one group of
   * `requiredDays` per vowel from `nodeProgress().vowels` (spec §3.4).
   * true = open (a banked good day).
   */
  buds: boolean[][]
  /** True when every step of the world is mastered. */
  complete: boolean
  lands: BeadLand[]
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
  const unlocksNext = complete ? null : cur.unlocksNext

  const lands = landsOf(world).map(
    (land): BeadLand => ({
      number: land.number,
      beads: land.nodes.map((node): Bead => {
        if (node === current && !complete) return { node, state: 'current' }
        const level = nodeProgress(p, node).level
        if (level === 'mastered') return { node, state: 'mastered' }
        if (node === unlocksNext) return { node, state: 'next' }
        if (level === 'locked') return { node, state: 'locked' }
        return { node, state: 'open' }
      }),
    }),
  )

  const requiredDays = cur.requiredDays
  const fill =
    requiredDays > 0 ? Math.min(1, Math.max(0, cur.goodDays / requiredDays)) : 0

  const budRow = (good: number, required: number): boolean[] =>
    Array.from({ length: required }, (_, i) => i < good)
  const buds =
    cur.vowels !== undefined
      ? cur.vowels.map((v) => budRow(v.goodDays, v.requiredDays))
      : [budRow(cur.goodDays, cur.requiredDays)]

  return {
    world,
    landNumber: landOf(current).number,
    showLandNumber: getSettings(p).showLevelToMarian,
    current,
    unlocksNext,
    goodDays: cur.goodDays,
    requiredDays,
    fill,
    buds,
    complete,
    lands,
  }
}
