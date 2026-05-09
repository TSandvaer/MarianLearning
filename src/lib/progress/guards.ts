/**
 * Hand-rolled type guards for the persisted Progress document.
 *
 * No runtime schema dep (zod/valibot/etc) — this module is on the hot path
 * for app boot and the bundle budget says "earn every kilobyte". A targeted
 * guard set is plenty for our shape.
 */

import type {
  LeitnerBox,
  LeitnerItem,
  Progress,
  SessionHistoryEntry,
  SkillLevel,
  SkillLevels,
  SkillNode,
} from './types'

const SKILL_NODES: ReadonlySet<SkillNode> = new Set<SkillNode>([
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
  'digraphs',
  'sight-words',
  'simple-sentences',
])

const SKILL_LEVELS: ReadonlySet<SkillLevel> = new Set<SkillLevel>([
  'locked',
  'intro',
  'practicing',
  'mastered',
])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isSkillLevels(v: unknown): v is SkillLevels {
  if (!isObject(v)) return false
  for (const node of SKILL_NODES) {
    const lvl = v[node]
    if (typeof lvl !== 'string' || !SKILL_LEVELS.has(lvl as SkillLevel)) {
      return false
    }
  }
  return true
}

function isLeitnerItem(v: unknown): v is LeitnerItem<unknown> {
  if (!isObject(v)) return false
  if (!('item' in v)) return false
  const box = v.box
  if (typeof box !== 'number' || box < 1 || box > 5 || !Number.isInteger(box)) {
    return false
  }
  if (typeof v.lastSeen !== 'number' || !Number.isFinite(v.lastSeen)) {
    return false
  }
  return true
}

function isLeitnerBox(v: unknown): v is LeitnerBox<unknown> {
  if (!isObject(v)) return false
  return Array.isArray(v.items) && v.items.every(isLeitnerItem)
}

function isHistoryEntry(v: unknown): v is SessionHistoryEntry {
  if (!isObject(v)) return false
  if (typeof v.dateISO !== 'string') return false
  if (
    typeof v.successRate !== 'number' ||
    !Number.isFinite(v.successRate) ||
    v.successRate < 0 ||
    v.successRate > 1
  ) {
    return false
  }
  if (!Array.isArray(v.skillFocus)) return false
  if (
    !v.skillFocus.every(
      (n) => typeof n === 'string' && SKILL_NODES.has(n as SkillNode),
    )
  ) {
    return false
  }
  // latencyMs is optional (ticket 86c9pwgc8 — additive, no schemaVersion
  // bump). When present it must be an array of finite numbers; the `-1`
  // sentinel for "no measurement" is allowed (so we accept any finite
  // numeric — negative-or-positive — rather than forcing >= 0).
  if ('latencyMs' in v && v.latencyMs !== undefined) {
    if (!Array.isArray(v.latencyMs)) return false
    for (const n of v.latencyMs) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return false
    }
  }
  return true
}

function isMasteryThresholdShape(v: unknown): boolean {
  if (!isObject(v)) return false
  if (
    typeof v.percent !== 'number' ||
    !Number.isFinite(v.percent) ||
    v.percent < 0 ||
    v.percent > 1
  ) {
    return false
  }
  if (
    typeof v.sessions !== 'number' ||
    !Number.isInteger(v.sessions) ||
    v.sessions <= 0
  ) {
    return false
  }
  return true
}

function isParentSettings(v: unknown): boolean {
  if (!isObject(v)) return false
  if (typeof v.autoPromote !== 'boolean') return false
  if (v.sessionModePicker !== 'on' && v.sessionModePicker !== 'off')
    return false
  if (typeof v.crossDayEnforcement !== 'boolean') return false
  if (typeof v.showLevelToMarian !== 'boolean') return false
  // crossVowelMixingEnabled (ticket 86c9qa0kf) is an OPTIONAL additive
  // field. Old blobs (pre-86c9qa0kf) won't carry it; the read-path
  // defaulter in parentSettings.ts fills it to `true`. We accept
  // `undefined` (legitimately absent) OR a boolean here. Anything else
  // (`null`, string, number) is malformed → reject so the upstream
  // fallback fires.
  if (
    v.crossVowelMixingEnabled !== undefined &&
    typeof v.crossVowelMixingEnabled !== 'boolean'
  ) {
    return false
  }
  const mt = v.masteryThreshold
  if (!isObject(mt)) return false
  // Accept BOTH the new per-track shape (math + word-song each have a
  // valid threshold) AND the legacy single shape (percent + sessions).
  // The read-side defaulter (`getSettings()` in `parentSettings.ts`)
  // promotes a legacy single shape to per-track at load time, so an
  // old persisted blob remains a valid Progress document under the
  // new code — no schema bump required (ticket 86c9kwvy0).
  const hasPerTrack = 'math' in mt || 'word-song' in mt
  const hasSingle = 'percent' in mt || 'sessions' in mt
  if (hasPerTrack) {
    if (!isMasteryThresholdShape(mt.math)) return false
    if (!isMasteryThresholdShape(mt['word-song'])) return false
    return true
  }
  if (hasSingle) {
    return isMasteryThresholdShape(mt)
  }
  return false
}

/** True iff `v` matches the v1 Progress shape exactly. */
export function isProgressV1(v: unknown): v is Progress {
  if (!isObject(v)) return false
  if (v.schemaVersion !== 1) return false
  if (!isObject(v.profile)) return false
  if (typeof v.profile.childName !== 'string') return false
  if (v.profile.character !== 'melody') return false
  const last = v.profile.lastPlayedISO
  if (last !== null && typeof last !== 'string') return false
  if (!isSkillLevels(v.skillLevels)) return false
  if (!isLeitnerBox(v.mathFactsLeitner)) return false
  if (!Array.isArray(v.history)) return false
  if (!v.history.every(isHistoryEntry)) return false
  // parentSettings is optional (M2.5 — additive, no schemaVersion bump).
  // Reject only on a malformed value; absent is fine and `loadProgress`
  // injects defaults at read time.
  if ('parentSettings' in v && v.parentSettings !== undefined) {
    if (!isParentSettings(v.parentSettings)) return false
  }
  // pendingPromotion is optional (M3 — additive, no schemaVersion bump).
  // When present it must be a known SkillNode string; an empty / missing
  // field is the normal state and means "no queued promotion".
  if ('pendingPromotion' in v && v.pendingPromotion !== undefined) {
    if (
      typeof v.pendingPromotion !== 'string' ||
      !SKILL_NODES.has(v.pendingPromotion as SkillNode)
    ) {
      return false
    }
  }
  // lifetimeFirstEncounters is optional (ticket 86c9q9ben — additive,
  // no schemaVersion bump). When present it must be an array of known
  // SkillNode strings (typed as WordSongNode[] in types.ts; we widen
  // to SKILL_NODES here because the runtime guard set is already
  // shaped that way and the WordSongNode subset is structurally
  // enforced by the producers). Duplicates are tolerated — the
  // read-time predicate uses Set semantics. An empty array is the
  // normal greenfield state.
  if (
    'lifetimeFirstEncounters' in v &&
    v.lifetimeFirstEncounters !== undefined
  ) {
    if (!Array.isArray(v.lifetimeFirstEncounters)) return false
    for (const node of v.lifetimeFirstEncounters) {
      if (typeof node !== 'string' || !SKILL_NODES.has(node as SkillNode)) {
        return false
      }
    }
  }
  return true
}

/** Reads schemaVersion off any plausibly-shaped object, else null. */
export function readSchemaVersion(v: unknown): number | null {
  if (!isObject(v)) return null
  const sv = v.schemaVersion
  return typeof sv === 'number' && Number.isInteger(sv) ? sv : null
}
