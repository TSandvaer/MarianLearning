/**
 * Default Progress document for a brand-new profile.
 *
 * Initial skill levels reflect Marian's April 2026 diagnostic in CLAUDE.md.
 * Anything she has demonstrated is `practicing` (or `mastered` where the
 * diagnostic explicitly says so); everything else stays `locked` until the
 * tree unlocks it.
 */

import { emptyLeitner } from './leitner'
import { DEFAULT_PARENT_SETTINGS } from './parentSettings'
import type { Progress, SkillLevels } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

const DEFAULT_SKILL_LEVELS: SkillLevels = {
  // Number Garden — math
  'number-recog': 'mastered',
  'add-to-10': 'practicing', // sums to 10, drive automaticity
  'add-to-20': 'locked',
  'sub-to-10': 'mastered', // within 15 confident => sub-to-10 is solid
  'sub-to-20': 'intro', // diagnostic says extend to 20 no-borrow next — introduced
  'two-digit-addsub': 'locked',
  'skip-counting': 'locked',
  'mult-2-5-10': 'intro', // repeated addition concept, no x symbol
  'mult-3-4': 'locked',
  'mult-6-9': 'locked',

  // Word Song — literacy
  'letter-names': 'mastered', // alphabet mastered (minor b/d confusion)
  'letter-sounds': 'practicing', // consonants mastered, vowels mid-flight (only short a)
  'blending-cv': 'practicing', // CV confident
  'cvc-words': 'intro', // emerging
  // cvc-words-short-o is the next-vowel sibling tier. Locked at v1 default
  // — unlocks to 'intro' when cvc-words (short-a) is mastered. See
  // design/word-song/short-o-pool-expansion.md §2 + §4.
  'cvc-words-short-o': 'locked',
  digraphs: 'locked',
  'sight-words': 'intro', // introduce gradually
  'simple-sentences': 'locked',
}

export function defaultProgress(childName = 'Marian'): Progress {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      childName,
      // Schema v1 stores this literal verbatim. The visible character is
      // Emma post-Phase-3b — the on-disk identifier is unchanged on
      // purpose; see `Character` type doc in ./types.ts and ticket
      // 86c9jccp7 for the rationale (no schema bump for Phase 3b).
      character: 'melody',
      lastPlayedISO: null,
    },
    skillLevels: { ...DEFAULT_SKILL_LEVELS },
    mathFactsLeitner: emptyLeitner(),
    history: [],
    // Seed parent settings with the Thomas-locked defaults. Field is
    // optional on the persisted shape (old blobs predate this milestone),
    // so include it on fresh defaults but rely on `getSettings()` to
    // fill it in for any blob that doesn't carry it. See
    // `./parentSettings.ts`.
    parentSettings: {
      ...DEFAULT_PARENT_SETTINGS,
      masteryThreshold: { ...DEFAULT_PARENT_SETTINGS.masteryThreshold },
    },
  }
}
