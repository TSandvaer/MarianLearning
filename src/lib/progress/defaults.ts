/**
 * Default Progress document for a brand-new profile.
 *
 * Initial skill levels reflect Marian's April 2026 diagnostic in CLAUDE.md.
 * Anything she has demonstrated is `practicing` (or `mastered` where the
 * diagnostic explicitly says so); everything else stays `locked` until the
 * tree unlocks it.
 */

import { emptyLeitner } from './leitner'
import type { Progress, SkillLevels } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

const DEFAULT_SKILL_LEVELS: SkillLevels = {
  // Number Garden — math
  'number-recog': 'mastered',
  'add-to-10': 'practicing', // sums to 10, drive automaticity
  'add-to-20': 'locked',
  'sub-to-10': 'practicing', // within 15 confident => sub-to-10 in active practice
  'sub-to-20': 'locked', // diagnostic says extend to 20 no-borrow next
  'two-digit-addsub': 'locked',
  'skip-counting': 'locked',
  'mult-2-5-10': 'intro', // repeated addition concept, no x symbol
  'mult-3-4': 'locked',
  'mult-6-9': 'locked',

  // Word Song — literacy
  'letter-names': 'mastered', // alphabet mastered (minor b/d confusion)
  'letter-sounds': 'mastered', // consonant sounds mastered; vowels in flight
  'blending-cv': 'practicing', // CV confident
  'cvc-words': 'intro', // emerging
  digraphs: 'locked',
  'sight-words': 'intro', // introduce gradually
  'simple-sentences': 'locked',
}

export function defaultProgress(childName = 'Marian'): Progress {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      childName,
      character: 'melody',
      lastPlayedISO: null,
    },
    skillLevels: { ...DEFAULT_SKILL_LEVELS },
    mathFactsLeitner: emptyLeitner(),
    history: [],
  }
}
