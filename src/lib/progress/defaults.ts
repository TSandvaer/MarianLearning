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
import type {
  LetterSoundsVowel,
  Progress,
  SkillLevels,
  SkillNode,
  VowelSubMasteryState,
} from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

/**
 * The trackable short vowels for `letter-sounds` per-vowel mastery, in
 * teaching order (Wave 9 W9.2 — ticket 86c9ya3gd). Order matches
 * `design/research/phonics-sequence-marian.md` §Q1 (o → u → i → e); short
 * -/a/ is excluded (already mastered per the April 2026 diagnostic).
 *
 * Single source of truth for "every letter-sounds vowel the schema knows
 * about" — walked by `DEFAULT_LETTER_SOUNDS_VOWEL_STATES` here and by the
 * read-path defaulter (`storage.ts:withDefaultedLetterSoundsVowelStates`)
 * / its cloudSync mirror to fill missing keys.
 */
export const LETTER_SOUNDS_VOWELS: readonly LetterSoundsVowel[] = [
  '/o/',
  '/u/',
  '/i/',
  '/e/',
] as const

/**
 * Default per-vowel sub-mastery for a brand-new profile: all four short
 * vowels at `'intro'` (Wave 9 W9.2 — ticket 86c9ya3gd). Greenfield Marian
 * starts every trackable vowel at first-exposure scaffolding; the (W9.3)
 * mastery rule promotes them independently as she practises.
 *
 * Returns a FRESH object each call so callers can spread + mutate without
 * touching the singleton — mirrors `defaultLockedSkillLevels()`.
 */
export function defaultLetterSoundsVowelStates(): Record<
  LetterSoundsVowel,
  VowelSubMasteryState
> {
  const out = {} as Record<LetterSoundsVowel, VowelSubMasteryState>
  for (const vowel of LETTER_SOUNDS_VOWELS) {
    out[vowel] = 'intro'
  }
  return out
}

/**
 * Frozen literal form of the per-vowel default, for tests + call-sites
 * that want the canonical shape without a function call. Prefer
 * `defaultLetterSoundsVowelStates()` when you need a mutable copy.
 */
export const DEFAULT_LETTER_SOUNDS_VOWEL_STATES: Readonly<
  Record<LetterSoundsVowel, VowelSubMasteryState>
> = {
  '/o/': 'intro',
  '/u/': 'intro',
  '/i/': 'intro',
  '/e/': 'intro',
}

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
  // Wave 5 (ticket 86c9y0bvc) sibling-tier split of `'two-digit-addsub'`.
  // The schema floor maps both new literals to `'locked'`; the
  // read-path remap in `storage.ts:withDefaultedSkillLevels` moves any
  // legacy `'two-digit-addsub': <level>` key on a persisted blob into
  // the no-regroup tier before the strict guard runs.
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
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
  'cvc-words-short-e',
  // Digraphs split into 3 sequential sibling nodes per PR #211.
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
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
  // sub-to-10: re-baselined to 'practicing' (was 'mastered' from the
  // April 2026 diagnostic — "subtraction within 15 confident"). Per
  // Dave's research (design/research/sub-to-10-fact-sequencing-marian.md)
  // and the sub-to-10 content tier spec (design/math/sub-to-10-content.md,
  // §6 advancement gate), the conceptual confidence she showed in the
  // diagnostic does NOT translate to retrieval automaticity on the
  // 4-chip abstract format. The new tier exists to drill the retrieval
  // pathway; baseline starts at 'practicing' so the picker lands here
  // after add-to-20 (existing tree order, no curriculum reorder).
  'sub-to-10': 'practicing', // retrieval-automaticity drill, not concept
  'sub-to-20': 'intro', // diagnostic says extend to 20 no-borrow next — introduced
  // Wave 5 (ticket 86c9y0bvc) sibling-tier split. Both tiers default
  // to 'locked'; the existing `'two-digit-addsub'` literal was at
  // 'locked' before the split, so the no-regroup tier inheriting
  // 'locked' preserves Marian's diagnostic baseline exactly. The
  // with-regroup tier unlocks to 'intro' via the normal cascade once
  // no-regroup masters — same shape as the CVC sibling-vowel cascade.
  'two-digit-addsub-no-regroup': 'locked',
  'two-digit-addsub-with-regroup': 'locked',
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
  // cvc-words-short-e is the fifth (and final single-vowel) tier sibling
  // (ticket 86c9teua2). Locked at v1 default — unlocks to 'intro' when
  // cvc-words-short-i is mastered. After short-e masters, downstream is
  // `digraphs-sh`. See design/word-song/short-e-pool-expansion.md §1 + §4.
  // Note: the spec § 5 flagged a "2-session-gap rule between short-i
  // mastery and short-e introduction" for /ɛ/-vs-/ɪ/ discrimination
  // hygiene; that scaffolding mechanism (AC10b) is INTENTIONALLY OUT OF
  // SCOPE for this canon-wire ticket per Matt's brief — the v1 unlock
  // path uses the standard `locked → intro` cascade with no extra gate.
  // A follow-up ticket (TBD — Matt to file) lands the `canIntroduceShortE`
  // helper if real-iPad observation surfaces /ɛ/–/ɪ/ confusion.
  'cvc-words-short-e': 'locked',
  // Digraphs split into 3 sequential sibling nodes per PR #211. Each
  // tier unlocks 'intro' only when its predecessor masters. The dead
  // single `digraphs` literal that previously sat here was never seen
  // above 'locked' by any real user (verified in proposal §2.6). The
  // read-path defaulter at storage.ts:withDefaultedSkillLevels carries
  // a one-time `digraphs → digraphs-sh` remap for the QA hand-edit case.
  'digraphs-sh': 'locked',
  'digraphs-ch': 'locked',
  'digraphs-th-voiceless': 'locked',
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
    // Literacy namespace (Wave 9 W9.2 — ticket 86c9ya3gd). Greenfield
    // Marian starts every trackable short vowel at 'intro'. The field is
    // additive + optional on the persisted shape; include it on fresh
    // defaults and rely on `withDefaultedLetterSoundsVowelStates` to fill
    // it in for any blob that predates the field. See types.ts comment.
    literacy: {
      letterSoundsVowelStates: defaultLetterSoundsVowelStates(),
    },
    // CVC graduation-review latch (ticket 86c9qa6n3). Greenfield Marian
    // has not fired the one-shot CVC graduation review yet. Additive +
    // optional on the persisted shape; include it on fresh defaults and
    // rely on `withDefaultedCvcGraduationSessionFired` to fill it for any
    // blob that predates the field. See types.ts comment.
    cvcGraduationSessionFired: false,
  }
}
