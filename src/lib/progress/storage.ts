/**
 * localStorage adapter for the Progress document.
 *
 * Single key (`STORAGE_KEY`). Always JSON. Versioned via `schemaVersion`
 * inside the document — if the version doesn't match, we route through
 * `migrate()` instead of bumping the key.
 *
 * Pure module: zero React, zero side effects beyond `window.localStorage`.
 */

import { defaultLockedSkillLevels } from './defaults'
import { isProgressV1, readSchemaVersion } from './guards'
import { migrate } from './migrate'
import { getSettings } from './parentSettings'
import type { Progress, SkillLevels } from './types'
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
    const defaulted = withDefaultedSkillLevels(parsed)
    return isProgressV1(defaulted) ? withDefaultedSettings(defaulted) : null
  }

  // Different version (older or newer) — route through migrate.
  const migrated = migrate(parsed)
  return migrated === null ? null : withDefaultedSettings(migrated)
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
  const floor = defaultLockedSkillLevels()
  let mutated = false
  const filled: SkillLevels = { ...floor }
  for (const key of Object.keys(floor) as Array<keyof SkillLevels>) {
    if (key in present && present[key] !== undefined) {
      // Preserve the existing value verbatim — even if invalid; the
      // guard catches that downstream.
      filled[key] = present[key] as SkillLevels[typeof key]
    } else {
      mutated = true
    }
  }
  // Preserve any additional keys the parsed blob carried (forward-
  // compat: if a future schema added keys we don't know about yet,
  // leaving them in lets the guard surface them as a real error
  // rather than silently dropping them). This is parallel to how
  // `withDefaultedSettings` is non-destructive.
  for (const key of Object.keys(present)) {
    if (!(key in floor)) {
      ;(filled as Record<string, unknown>)[key] = present[key]
    }
  }
  if (!mutated) return parsed
  return { ...obj, skillLevels: filled }
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
