/**
 * PREREQUISITES — "what must be mastered before this step unlocks"
 * (design/progression-emmas-path.md, "What changes underneath").
 *
 * Derived from the mastery rule's own tree order (`MATH_TREE` /
 * `LITERACY_TREE`): `applyMasteryRule` unlocks a step only when the step
 * directly before it in its tree is mastered, so each step's single
 * prerequisite is its tree predecessor and each tree's first step has
 * none. Deriving it here (instead of hand-writing a table) means the
 * lookup cannot disagree with the rule.
 */

import { LITERACY_TREE, MATH_TREE } from './mastery'
import type { SkillNode } from './types'

function fromTree(tree: readonly SkillNode[]): [SkillNode, SkillNode[]][] {
  return tree.map((node, idx) => [node, idx === 0 ? [] : [tree[idx - 1]!]])
}

// Every SkillNode sits in exactly one tree (locked by mastery.test.ts and
// prerequisites.test.ts), so the entries cover the whole Record.
export const PREREQUISITES: Readonly<Record<SkillNode, SkillNode[]>> =
  Object.freeze(
    Object.fromEntries([...fromTree(MATH_TREE), ...fromTree(LITERACY_TREE)]),
  ) as unknown as Record<SkillNode, SkillNode[]>
