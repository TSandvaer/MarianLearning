/**
 * localStorage adapter for the Progress document.
 *
 * Single key (`STORAGE_KEY`). Always JSON. Versioned via `schemaVersion`
 * inside the document — if the version doesn't match, we route through
 * `migrate()` instead of bumping the key.
 *
 * Pure module: zero React, zero side effects beyond `window.localStorage`.
 */

import { LETTER_SOUNDS_VOWELS, defaultLockedSkillLevels } from './defaults'
import { isProgressV1, readSchemaVersion } from './guards'
import { inferLifetimeFirstEncountersFromProgress } from './lifetimeFirstEncounters'
import { migrate } from './migrate'
import { getSettings } from './parentSettings'
import type {
  LetterSoundsVowel,
  Progress,
  SkillLevels,
  VowelSubMasteryState,
} from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

export const STORAGE_KEY = 'marian-tutor:progress:v1'

/** Cap on `Progress.history.length`. Older entries drop on save. */
export const MAX_SESSION_HISTORY = 30

/**
 * Load the persisted progress document.
 *
 * Returns:
 * - `null` if nothing is stored, or the storage backend is unavailable
 * - `null` if the stored blob is not valid JSON
 * - `null` if the blob is JSON but cannot be migrated to the current shape
 * - the parsed `Progress` otherwise
 */
export function loadProgress(): Progress | null {
  const raw = safeGetItem(STORAGE_KEY)
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const version = readSchemaVersion(parsed)
  if (version === null) return null

  if (version === CURRENT_SCHEMA_VERSION) {
    // Defaulter runs BEFORE the strict guard (ticket 86c9pkfth). Filling
    // missing skill-level keys with the schema-floor 'locked' value lets a
    // pre-node-addition blob round-trip cleanly post-addition; the strict
    // guard stays strict and rejects truly-corrupt input.
    //
    // Ordering is load-bearing (Wave 9 W9.2 — ticket 86c9ya3gd):
    //   withDefaultedSkillLevels → withDefaultedLetterSoundsVowelStates →
    //   isProgressV1. The per-vowel defaulter runs AFTER the skill-level
    //   floor (so the guard sees a fully-populated skillLevels) and
    //   BEFORE the strict guard (so a pre-W9.2 blob that carries a
    //   partial `literacy.letterSoundsVowelStates` — or none at all —
    //   never trips the guard once the field IS present).
    const defaulted = withDefaultedLetterSoundsVowelStates(
      withDefaultedSkillLevels(parsed),
    )
    if (!isProgressV1(defaulted)) return null
    // Two layered post-guard defaulters: first parentSettings (M2.5),
    // then lifetimeFirstEncounters (ticket 86c9q9ben). Both are
    // additive-no-bump optional fields whose absence on a pre-feature
    // blob is fine but whose presence is preferred by downstream
    // consumers (the planner-side gate doesn't have to short-circuit
    // a missing list when the field is always set after load).
    return withDefaultedCvcGraduationSessionFired(
      withDefaultedLifetimeFirstEncounters(withDefaultedSettings(defaulted)),
    )
  }

  // Different version (older or newer) — route through migrate.
  const migrated = migrate(parsed)
  if (migrated === null) return null
  return withDefaultedCvcGraduationSessionFired(
    withDefaultedLifetimeFirstEncounters(withDefaultedSettings(migrated)),
  )
}

/**
 * Read-path skill-level defaulter (ticket 86c9pkfth).
 *
 * Fills missing keys on the parsed `skillLevels` object with the
 * schema-floor value `'locked'`. Mirror-of-shape for `withDefaultedSettings`
 * below: layered post-parse so the strict `isProgressV1` guard never sees
 * a missing-key shape it would reject.
 *
 * The trip-wire it defends against: `isSkillLevels` in `guards.ts`
 * requires every node in the current `SKILL_NODES` set to appear as a
 * key. When a new skill node lands (next short vowel, future digraphs
 * tier, etc.), Marian's existing localStorage blob would otherwise
 * fail the guard, `loadProgress()` would return null, and defaults
 * would clobber her progress. PR #151 hit this on test fixtures; the
 * defaulter prevents production from ever hitting it.
 *
 * Implementation notes:
 *
 * 1. The fill SOURCE is `defaultLockedSkillLevels()` (schema-floor),
 *    NOT `defaultProgress().skillLevels` (Marian's diagnostic
 *    baseline). The diagnostic carries `'practicing'`/`'intro'` for
 *    several nodes; using it as a fill-source could silently grant
 *    access a user hasn't earned. The schema-floor is a true minimum.
 *
 * 2. Defaulter ONLY fills missing keys. A present-but-invalid value
 *    (`add-to-10: 'super-mastered'`) is left untouched so the
 *    downstream guard rejects the blob. We don't want silent
 *    coercion to mask real corruption.
 *
 * 3. Defaulter is a no-op when `skillLevels` is not an object —
 *    `null`, `undefined`, an array, a string. The guard rejects those
 *    cases verbatim; recovering from them would mean fabricating data.
 *
 * 4. Returns a fresh `Progress`-shaped object on the modified path
 *    so the input parsed value is never mutated. When no fill is
 *    needed, returns the input unchanged.
 *
 * Input is `unknown` because this runs BEFORE `isProgressV1`. We
 * downcast defensively and only touch the `skillLevels` field.
 */
function withDefaultedSkillLevels(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed
  }
  const obj = parsed as Record<string, unknown>
  const skillLevels = obj.skillLevels
  if (
    typeof skillLevels !== 'object' ||
    skillLevels === null ||
    Array.isArray(skillLevels)
  ) {
    // Truly corrupt — let the guard reject. We don't fabricate
    // skillLevels from thin air.
    return parsed
  }
  const present = skillLevels as Record<string, unknown>

  // Dead-letter remap: `digraphs` → `digraphs-sh` (PR #211).
  //
  // The single `digraphs` SkillNode was dropped when the digraph tier
  // was split into three sequential sibling nodes
  // (`digraphs-sh` / `digraphs-ch` / `digraphs-th-voiceless`). No real
  // user ever had `digraphs` above `'locked'` (verified in the
  // proposal §2.6 — Marian's defaultProgress had it at 'locked' and
  // no canon shipped for the node), so for production users the
  // remap is a no-op. The branch exists to cover the QA hand-edit
  // case (e.g. someone setting `digraphs: 'practicing'` via DevTools)
  // so that progress isn't silently dropped. When both the legacy
  // and the new key are present in the same blob, the new key wins
  // — the new key is the source of truth post-PR.
  let withRemap = present
  if ('digraphs' in present && !('digraphs-sh' in present)) {
    const { digraphs: legacyDigraphsLevel, ...rest } = present
    withRemap = { ...rest, 'digraphs-sh': legacyDigraphsLevel }
  } else if ('digraphs' in present) {
    // Both keys present — strip the legacy literal so the strict
    // guard's downstream check doesn't see an unrecognised key on a
    // best-effort load path. The new key's value is preserved as-is.
    const rest = { ...present }
    delete rest['digraphs']
    withRemap = rest
  }

  // Dead-letter remap: `two-digit-addsub` → `two-digit-addsub-no-regroup`
  // (Wave 5 — ticket 86c9y0bvc).
  //
  // The single `two-digit-addsub` SkillNode was split into adjacent
  // no-regroup + with-regroup sibling tiers in Wave 5. The no-regroup
  // tier preserves the existing pedagogical band (no carrying /
  // borrowing); the with-regroup tier is new (carry / borrow taught
  // explicitly per Dave's research deliverable, ticket epic 86c9xwjtr).
  // Marian's `defaultProgress` had `two-digit-addsub: 'locked'`, so
  // for production users the remap is a no-op. The branch covers the
  // QA hand-edit case + any session-history records (note: history
  // entries carry SkillNode strings on `skillFocus`, but the storage
  // guard tolerates unknown SkillNode strings inside history strings
  // — see `isHistoryEntry` — only `skillLevels` keys are floor-checked).
  // When both legacy and new keys are present (post-PR-B QA edits),
  // the new key wins; the legacy literal is stripped so the strict
  // guard's downstream check doesn't see an unrecognised key.
  if (
    'two-digit-addsub' in withRemap &&
    !('two-digit-addsub-no-regroup' in withRemap)
  ) {
    const { 'two-digit-addsub': legacyTwoDigitLevel, ...rest } = withRemap
    withRemap = { ...rest, 'two-digit-addsub-no-regroup': legacyTwoDigitLevel }
  } else if ('two-digit-addsub' in withRemap) {
    const rest = { ...withRemap }
    delete rest['two-digit-addsub']
    withRemap = rest
  }

  const floor = defaultLockedSkillLevels()
  let mutated = withRemap !== present
  const filled: SkillLevels = { ...floor }
  for (const key of Object.keys(floor) as Array<keyof SkillLevels>) {
    if (key in withRemap && withRemap[key] !== undefined) {
      // Preserve the existing value verbatim — even if invalid; the
      // guard catches that downstream.
      filled[key] = withRemap[key] as SkillLevels[typeof key]
    } else {
      mutated = true
    }
  }
  // Preserve any additional keys the parsed blob carried (forward-
  // compat: if a future schema added keys we don't know about yet,
  // leaving them in lets the guard surface them as a real error
  // rather than silently dropping them). This is parallel to how
  // `withDefaultedSettings` is non-destructive.
  for (const key of Object.keys(withRemap)) {
    if (!(key in floor)) {
      ;(filled as Record<string, unknown>)[key] = withRemap[key]
    }
  }
  if (!mutated) return parsed
  return { ...obj, skillLevels: filled }
}

/**
 * Read-path defaulter for `literacy.letterSoundsVowelStates` (Wave 9
 * W9.2 — ticket 86c9ya3gd).
 *
 * Fills any missing per-vowel key with `'intro'` so downstream consumers
 * (W9.3 mastery rule, W9.4 focus-picker) always see a fully-populated
 * map. Runs BEFORE the strict guard, mirroring `withDefaultedSkillLevels`
 * and `withDefaultedLifetimeFirstEncounters`. Input is `unknown` because
 * it runs pre-guard; we downcast defensively and only touch the
 * `literacy.letterSoundsVowelStates` field.
 *
 * Three input shapes the defaulter heals:
 *
 *  1. No `literacy` field at all (pre-W9.2 blob) → add
 *     `literacy.letterSoundsVowelStates` with all four vowels at
 *     `'intro'`.
 *  2. `literacy` present, `letterSoundsVowelStates` absent/undefined →
 *     same fill.
 *  3. `letterSoundsVowelStates` present but PARTIAL (missing one or more
 *     vowels — e.g. a blob written before a vowel was added to the map)
 *     → fill only the missing vowels with `'intro'`; existing per-vowel
 *     values round-trip verbatim.
 *
 * Like the sibling defaulters:
 *  - It ONLY fills missing keys. A present-but-invalid value (e.g.
 *    `'/o/': 'super-mastered'`) is left untouched so the strict guard
 *    rejects it downstream — no silent coercion masking corruption.
 *  - It is a no-op (returns input unchanged) when `parsed`,
 *    `literacy`, or `letterSoundsVowelStates` is present-but-not-an-object
 *    in a way the guard would reject — except the genuinely-absent cases
 *    above, which it heals. A `literacy` that is non-object (string,
 *    array, number) is left for the guard to reject.
 *  - Extra (non-vowel) keys on the map are preserved (forward-compat),
 *    parallel to `withDefaultedSkillLevels`.
 *  - Returns a fresh object on the modified path; never mutates input.
 */
function withDefaultedLetterSoundsVowelStates(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed
  }
  const obj = parsed as Record<string, unknown>

  const literacyRaw = obj.literacy
  // `literacy` present but a non-object (string / array / number) is
  // corrupt — leave it for the strict guard to reject rather than
  // papering over it.
  if (
    literacyRaw !== undefined &&
    (typeof literacyRaw !== 'object' ||
      literacyRaw === null ||
      Array.isArray(literacyRaw))
  ) {
    return parsed
  }

  const literacy = (literacyRaw ?? {}) as Record<string, unknown>
  const statesRaw = literacy.letterSoundsVowelStates
  // Same guard as above for the inner map: a present-but-non-object
  // value is corrupt; defer to the strict guard.
  if (
    statesRaw !== undefined &&
    (typeof statesRaw !== 'object' ||
      statesRaw === null ||
      Array.isArray(statesRaw))
  ) {
    return parsed
  }

  const present = (statesRaw ?? {}) as Record<string, unknown>
  let mutated = literacyRaw === undefined || statesRaw === undefined
  const filled: Record<string, unknown> = { ...present }
  for (const vowel of LETTER_SOUNDS_VOWELS) {
    if (vowel in present && present[vowel] !== undefined) {
      // Preserve verbatim — even if invalid; the guard catches that.
      continue
    }
    filled[vowel] = 'intro' satisfies VowelSubMasteryState
    mutated = true
  }

  if (!mutated) return parsed

  return {
    ...obj,
    literacy: {
      ...literacy,
      letterSoundsVowelStates: filled as Record<
        LetterSoundsVowel,
        VowelSubMasteryState
      >,
    },
  }
}

/**
 * Inject defaults for `parentSettings` post-parse (M2.5 — ticket
 * 86c9kpjc7).
 *
 * The field is OPTIONAL on the persisted shape (additive,
 * backward-compatible) so old blobs that predate M2.5 are valid v1
 * documents. We layer defaults here — at the read path — so every
 * caller of `loadProgress()` sees a fully-shaped result. The
 * alternative (bake it into `migrate()`) is awkward because there's
 * no actual schemaVersion bump and `migrate()` is reserved for
 * cross-version transformations.
 *
 * Returns a fresh object with `parentSettings` populated; never
 * mutates the input. If the input already carries a fully-shaped
 * `parentSettings`, `getSettings()` returns its value verbatim
 * (with masteryThreshold cloned), so the round-trip stays
 * deep-equal.
 */
function withDefaultedSettings(p: Progress): Progress {
  return { ...p, parentSettings: getSettings(p) }
}

/**
 * Inject defaults for `lifetimeFirstEncounters` post-parse (ticket
 * 86c9q9ben — additive, no schemaVersion bump).
 *
 * The field is OPTIONAL on the persisted shape — pre-86c9q9ben blobs
 * predate it. We layer the defaulter at the read path so every
 * caller of `loadProgress()` sees a fully-shaped result and the
 * downstream planner-gate (`isFirstEncounter`) doesn't need to
 * short-circuit a missing list.
 *
 * Inference rule: any non-locked word-song node is treated as
 * already-encountered. Pre-86c9q9ben Marians whose
 * `cvc-words: 'practicing'` (or higher) means the migration does
 * NOT replay short-a scaffolding for them on next session-start.
 * See `inferLifetimeFirstEncountersFromProgress` for the full
 * rationale.
 *
 * Idempotent: when the input already carries the field (any value,
 * including empty), pass it through untouched. The "fresh-blob
 * default to []" semantic comes from `defaultProgress()`, not from
 * this defaulter — which means a fresh-storage Marian created via
 * `defaultProgress()` and saved gets `[]` on disk, while an old
 * pre-86c9q9ben blob gets the inferred list filled in here at
 * read time.
 */
function withDefaultedLifetimeFirstEncounters(p: Progress): Progress {
  if (p.lifetimeFirstEncounters !== undefined) return p
  return {
    ...p,
    lifetimeFirstEncounters: inferLifetimeFirstEncountersFromProgress(p),
  }
}

/**
 * Inject the default for `cvcGraduationSessionFired` post-parse (ticket
 * 86c9qa6n3 — CVC review mode; additive, no schemaVersion bump).
 *
 * The field is OPTIONAL on the persisted shape — pre-86c9qa6n3 blobs
 * predate it. We layer the defaulter at the read path so every caller of
 * `loadProgress()` sees a concrete boolean and the picker
 * (`pickCvcReviewNode`) doesn't have to treat missing and `false`
 * differently.
 *
 * Default is `false` ("graduation review has not fired yet"). This is the
 * correct semantic for ANY pre-existing user when the feature ships: a
 * Marian who already mastered all three CVC tiers before this code landed
 * should still get her one-shot graduation review on the next eligible
 * session, not have it silently skipped. Mirrors
 * `withDefaultedLifetimeFirstEncounters` in shape; idempotent (a blob that
 * already carries the field — `true` OR `false` — passes through
 * untouched).
 */
function withDefaultedCvcGraduationSessionFired(p: Progress): Progress {
  if (p.cvcGraduationSessionFired !== undefined) return p
  return { ...p, cvcGraduationSessionFired: false }
}

/**
 * Persist the progress document.
 *
 * Trims `history` to `MAX_SESSION_HISTORY` to keep the blob small.
 * Throws nothing — storage failures (quota, private mode) are swallowed
 * because progress is best-effort, never a blocker for play.
 */
export function saveProgress(p: Progress): void {
  const trimmed: Progress =
    p.history.length > MAX_SESSION_HISTORY
      ? { ...p, history: p.history.slice(-MAX_SESSION_HISTORY) }
      : p

  let serialized: string
  try {
    serialized = JSON.stringify(trimmed)
  } catch {
    return
  }

  safeSetItem(STORAGE_KEY, serialized)
}

/** Remove the stored progress document. Used by reset flows / tests. */
export function clearProgress(): void {
  safeRemoveItem(STORAGE_KEY)
}

// --------------------------------------------------------------------------
// internals — every localStorage touch goes through these so SSR / private
// mode / locked-down iframes don't crash the boot.
// --------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, value)
  } catch {
    // Quota exceeded, private mode, etc. — silently drop.
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
