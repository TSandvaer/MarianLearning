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
import type { Progress, SkillLevels, SkillNode } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

/**
 * Schema-floor skill-level keys (ticket 86c9pkfth).
 *
 * Single source of truth for "every node the schema knows about". Used by
 * the storage read-path defaulter (`withDefaultedSkillLevels`) to fill
 * missing keys on persisted blobs that predate a node addition. Lives
 * here rather than `guards.ts` so the defaulter and the guard share the
 * same enumeration without an import cycle (guards.ts already imports
 * types.ts, and the defaulter would be importing both).
 *
 * IMPORTANT: when a new skill node is added to the `SkillNode` union,
 * extend this list AND the `SKILL_NODES` set in `guards.ts` in the same
 * change. The `schema-floor coverage` regression in `storage.test.ts`
 * fails first if they drift.
 */
const SCHEMA_FLOOR_NODES: readonly SkillNode[] = [
  // Number Garden
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
  // Word Song
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'digraphs',
  'sight-words',
  'simple-sentences',
] as const

/**
 * Schema-floor skill levels — every node `'locked'` (ticket 86c9pkfth).
 *
 * NOT the same as `defaultProgress().skillLevels` — that factory carries
 * Marian's April 2026 diagnostic baseline (`add-to-10: practicing`,
 * `cvc-words: intro`, etc.) which is correct for a brand-new profile
 * but WRONG as a fill-source for the read-path defaulter. If the
 * defaulter merged the diagnostic baseline over a partially-corrupt
 * blob, a missing `add-to-10` key would silently grant Marian
 * `'practicing'` access she never earned (or, in a forward-compat
 * scenario, that the blob's owner had already mastered past).
 *
 * The schema floor is the SAFE fill: a missing key cannot grant access
 * the user didn't have. Every node defaults to `'locked'`. The
 * downstream tree-walking logic (`pickFocusNode`, `applyMasteryRule`)
 * then unlocks adjacency in the normal way once Marian completes a
 * session.
 *
 * Returns a fresh object each call so callers can spread + mutate
 * without touching the singleton.
 */
export function defaultLockedSkillLevels(): SkillLevels {
  const out = {} as SkillLevels
  for (const node of SCHEMA_FLOOR_NODES) {
    out[node] = 'locked'
  }
  return out
}

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
  // cvc-words-short-u is the third vowel-tier sibling (ticket 86c9q5q2d /
  // 86c9q9ben). Locked at v1 default — unlocks to 'intro' when
  // cvc-words-short-o is mastered. See
  // design/word-song/short-u-pool-expansion.md §2 + §4.
  'cvc-words-short-u': 'locked',
  // cvc-words-short-i is the fourth vowel-tier sibling (ticket 86c9qdba4).
  // Locked at v1 default — unlocks to 'intro' when cvc-words-short-u is
  // mastered. See design/word-song/short-i-pool-expansion.md §2 + §4.
  'cvc-words-short-i': 'locked',
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
    // Lifetime-first-encounter gate (ticket 86c9q9ben). Greenfield
    // Marian sees every tier's first-encounter scaffolding the first
    // time her session-start request lands on it; the field is
    // appended at session-end. See types.ts comment + the migration
    // path in `migrate.ts` for the existing-blob fill rule.
    lifetimeFirstEncounters: [],
  }
}
