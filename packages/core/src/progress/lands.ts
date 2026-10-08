/**
 * Lands — the "level" a child sees on Emma's Path
 * (design/progression-emmas-path.md, decision 2, Thomas 2026-10-04).
 *
 * Each world's steps are grouped into lands in ONE table. Order inside
 * each land and across lands follows `MATH_TREE` / `LITERACY_TREE`;
 * `lands.test.ts` locks the flattened table against the trees so a new
 * SkillNode that is not placed in a land fails CI.
 */

import type { MasteryTrack } from './mastery'
import type { SkillNode } from './types'

export interface Land {
  world: MasteryTrack
  /** 1-based land number inside its world — the level shown to Marian. */
  number: number
  name: string
  nodes: readonly SkillNode[]
}

export const LANDS: readonly Land[] = [
  { world: 'math', number: 1, name: 'Counting', nodes: ['number-recog'] },
  {
    world: 'math',
    number: 2,
    name: 'Adding & taking away',
    nodes: ['add-to-10', 'add-to-20', 'sub-to-10', 'sub-to-20'],
  },
  {
    world: 'math',
    number: 3,
    name: 'Big numbers',
    nodes: [
      'two-digit-addsub-no-regroup',
      'two-digit-addsub-with-regroup',
      'skip-counting',
    ],
  },
  {
    world: 'math',
    number: 4,
    name: 'Groups',
    nodes: ['mult-2-5-10', 'mult-3-4', 'mult-6-9'],
  },
  {
    world: 'word-song',
    number: 1,
    name: 'Letters',
    nodes: ['letter-names', 'letter-sounds'],
  },
  { world: 'word-song', number: 2, name: 'Blending', nodes: ['blending-cv'] },
  {
    world: 'word-song',
    number: 3,
    name: 'Words',
    nodes: [
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
    ],
  },
  {
    world: 'word-song',
    number: 4,
    name: 'Sound pairs',
    nodes: ['digraphs-sh', 'digraphs-ch', 'digraphs-th-voiceless'],
  },
  {
    world: 'word-song',
    number: 5,
    name: 'Sentences',
    nodes: ['sight-words', 'simple-sentences'],
  },
]

/** The lands of one world, in order. */
export function landsOf(world: MasteryTrack): readonly Land[] {
  return LANDS.filter((land) => land.world === world)
}

/** The land a step belongs to. Every SkillNode is in exactly one land. */
export function landOf(node: SkillNode): Land {
  const land = LANDS.find((l) => l.nodes.includes(node))
  if (land === undefined) {
    throw new Error(`SkillNode '${node}' is not placed in any land`)
  }
  return land
}
