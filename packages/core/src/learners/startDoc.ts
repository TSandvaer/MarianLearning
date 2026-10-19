/**
 * A learner's start doc (`design/native/learner-profiles.md` § 4.8): the
 * doc a learner begins with, and the one any reader rebuilds when the doc
 * is missing. It replaces `defaultProgress()` (Marian's April diagnostic)
 * at every production fallback, so a missing doc is never rebuilt as
 * Marian's levels for another child (K7). This file and `defaults.ts` are
 * the only production callers of `defaultProgress()`
 * (`learners.start.test.ts` scans for it).
 */
import {
  defaultLetterSoundsVowelStates,
  defaultLockedSkillLevels,
  defaultProgress,
  LETTER_SOUNDS_VOWELS,
} from '../progress/defaults'
import { landsOf, landOf, type Land } from '../progress/lands'
import {
  LITERACY_TREE,
  MATH_TREE,
  trackOf,
  type MasteryTrack,
} from '../progress/mastery'
import type { Progress, SkillNode, WordSongNode } from '../progress/types'
import { activeLearner } from './state'
import type { LearnerEntry } from './types'

function treeOf(world: MasteryTrack): readonly SkillNode[] {
  return world === 'math' ? MATH_TREE : LITERACY_TREE
}

/** Land `n` of `world`, clamped to the lands this build knows. */
export function landAt(world: MasteryTrack, n: number): Land {
  const lands = landsOf(world)
  const i = Math.min(Math.max(Math.trunc(n), 1), lands.length) - 1
  return lands[i]!
}

/**
 * `progress` with `node`'s world placed at `node`: every earlier step of
 * the world `'mastered'`, `node` `'intro'`, every later step `'locked'`,
 * plus the per-step detail the gates read in Word Song (the letter-sounds
 * vowels, mastered past letter-sounds and back at their defaults at or
 * before it; the earlier steps listed as first-encountered). The other
 * world is untouched. Pure. The QA jump (`debug/stepProgress.ts`) and
 * `setLearnerStart` share it.
 */
export function placeAtStep(progress: Progress, node: SkillNode): Progress {
  const world = trackOf(node)
  if (world === null) {
    throw new Error(`placeAtStep: '${node}' is not a step of either tree`)
  }
  const tree = treeOf(world)
  const at = tree.indexOf(node)
  const skillLevels = { ...progress.skillLevels }
  tree.forEach((step, i) => {
    skillLevels[step] = i < at ? 'mastered' : i === at ? 'intro' : 'locked'
  })
  const out: Progress = { ...progress, skillLevels }
  if (world === 'word-song') {
    const pastLetterSounds = at > LITERACY_TREE.indexOf('letter-sounds')
    const states = defaultLetterSoundsVowelStates()
    if (pastLetterSounds) {
      for (const vowel of LETTER_SOUNDS_VOWELS) states[vowel] = 'mastered'
    }
    out.literacy = { ...progress.literacy, letterSoundsVowelStates: states }
    out.lifetimeFirstEncounters = LITERACY_TREE.slice(0, at) as WordSongNode[]
  }
  return out
}

/**
 * The doc `entry` starts with. `'legacy-default'` (the migrated learner 1)
 * is `defaultProgress()`, Marian's baseline as today. A land start is
 * built from the schema floor, both worlds placed at their land's first
 * step: no diagnostic level carries over. Settings are the defaults;
 * history, the Leitner box and good days are empty.
 */
export function learnerStartProgress(entry: LearnerEntry): Progress {
  const base = defaultProgress(entry.name)
  if (entry.start === 'legacy-default') return base
  const floor: Progress = { ...base, skillLevels: defaultLockedSkillLevels() }
  const math = placeAtStep(floor, landAt('math', entry.start.math).nodes[0]!)
  return placeAtStep(math, landAt('word-song', entry.start.wordSong).nodes[0]!)
}

/**
 * The playing learner's start doc, or `defaultProgress()` with no list
 * installed (the web, which stays single-learner). Every production
 * reader that falls back when the doc is missing uses this.
 */
export function startProgressForActive(): Progress {
  const active = activeLearner()
  return active === null ? defaultProgress() : learnerStartProgress(active)
}

/**
 * The land a learner is on in `world`: the land of the world's first step
 * in tree order that isn't `'mastered'`; a finished world shows its last
 * land (Parent Settings' Where to start row, § 3.1).
 */
export function currentLand(progress: Progress, world: MasteryTrack): Land {
  const open = treeOf(world).find((n) => progress.skillLevels[n] !== 'mastered')
  if (open !== undefined) return landOf(open)
  const lands = landsOf(world)
  return lands[lands.length - 1]!
}
