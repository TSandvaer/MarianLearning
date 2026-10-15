/**
 * The Map peek (native spec `design/native/fast-track-native.md` § 6,
 * Thomas 2026-10-14: "She wants to see what's in the game, but we should
 * still keep track on her level."): on the Map she can tap any later step,
 * locked ones too, and try 3 of its problems. A peek is explore, not
 * progress: it counts toward nothing and writes nothing (§ 11).
 *
 * Pure. Which stops peek, and which canon blocks a peek plays; the request,
 * the screen and the no-write rule live in the native app.
 */
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import type { CanonBlockRef } from '../progress/reviewPlan'
import type { SkillNode } from '../progress/types'
import { PEEK_BLOCK_COUNT } from '../wire/types'
import type { MapModel, MapStop } from './mapModel'

/**
 * § 6.2: the step's first 3 canon problems, in canon order — the same 3
 * every time, so a peek is predictable.
 */
export function pickPeekBlocks(node: SkillNode): CanonBlockRef[] {
  return Array.from({ length: PEEK_BLOCK_COUNT }, (_, i) => ({
    node,
    problem: i + 1,
  }))
}

/**
 * § 6.1: a stop after the current step in tree order that is not mastered,
 * every locked stop included. A complete world has none; the current stop
 * and the steps before it keep their tap (the stop's name).
 */
export function isPeekableStop(model: MapModel, stop: MapStop): boolean {
  if (model.complete || stop.state === 'mastered') return false
  const tree: readonly SkillNode[] =
    model.world === 'math' ? MATH_TREE : LITERACY_TREE
  return tree.indexOf(stop.node) > tree.indexOf(model.current)
}
