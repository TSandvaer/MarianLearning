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
    nodes: ['mult-2-5-10', 'mult-3-4', 'mult-6-9', 'mult-mix', 'div-share'],
  },
  // Content wave 3 (design/native/content-wave-3.md § 1, K6): a new land,
  // since Groups is full. Content wave 4 § 1 (K1): step 15, more and
  // less, is its 2nd stop; content wave 5 § 1 (K1): step 16, zeros, its
  // 3rd.
  {
    world: 'math',
    number: 5,
    name: 'Hundreds',
    nodes: ['hundreds', 'hundreds-addsub', 'hundreds-zeros'],
  },
  // Content wave 5 (design/native/content-wave-5.md § 1, K2): adding big
  // numbers opens a new land; "Bigger numbers" is the two-digit steps'
  // recap phrase, and follows land 3 "Big numbers".
  {
    world: 'math',
    number: 6,
    name: 'Bigger numbers',
    nodes: ['add-two-digit'],
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
  // Content wave 1 (design/native/content-wave-1.md § 5.1). A new land,
  // not land 5 "Sentences": the land name is spoken, and these steps
  // aren't sentences. Content wave 2 (design/native/content-wave-2.md § 1,
  // K8) adds Dave's next two phonics steps as its 3rd and 4th stops.
  {
    world: 'word-song',
    number: 6,
    name: 'Big words',
    nodes: ['duck-words', 'crab-words', 'tent-words', 'cake-words'],
  },
  // Content wave 3 (design/native/content-wave-3.md § 1, K6): the three
  // little-story steps. "Big words" isn't stories.
  {
    world: 'word-song',
    number: 7,
    name: 'Stories',
    nodes: ['fox-stories', 'hen-stories', 'bug-stories'],
  },
  // Content wave 4 (design/native/content-wave-4.md § 1, K6): bee words,
  // car words and sheep stories. Land 7 is full of its own kind.
  {
    world: 'word-song',
    number: 8,
    name: 'Words and stories',
    nodes: ['bee-words', 'car-words', 'sheep-stories'],
  },
  // Content wave 5 (design/native/content-wave-5.md § 1, K6): snail words,
  // moon words and goat stories. Land 8 is a full trio.
  {
    world: 'word-song',
    number: 9,
    name: 'More words and stories',
    nodes: ['snail-words', 'moon-words', 'goat-stories'],
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
