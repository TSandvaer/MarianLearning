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
  LetterSoundsVowel,
  Progress,
  SessionHistoryEntry,
  SkillLevel,
  SkillLevels,
  SkillNode,
  VowelSubMasteryState,
} from './types'

const SKILL_NODES: ReadonlySet<SkillNode> = new Set<SkillNode>([
  // Number Garden
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  // Wave 5 (ticket 86c9y0bvc) split `'two-digit-addsub'` into adjacent
  // no-regroup + with-regroup tiers. The legacy literal is dropped from
  // the persisted-blob allow-list here; the read-path defaulter at
  // `storage.ts:withDefaultedSkillLevels` carries a one-time
  // `two-digit-addsub → two-digit-addsub-no-regroup` remap so existing
  // blobs (Marian had it at `'locked'` per defaults; QA hand-edits land
  // in the remap branch) round-trip cleanly post-merge.
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
  // Sequential isolation: sh masters → ch unlocks 'intro'; ch masters
  // → th-voiceless unlocks 'intro'. Voiced /ð/ is NOT here — it
  // routes to the `sight-words` tier (Dave's research §Q2/§Q3).
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
  'sight-words',
  'simple-sentences',
])

const SKILL_LEVELS: ReadonlySet<SkillLevel> = new Set<SkillLevel>([
  'locked',
  'intro',
  'practicing',
  'mastered',
])

// Wave 9 W9.2 (ticket 86c9ya3gd) — letter-sounds per-vowel sub-mastery.
// The four trackable short vowels (short-/a/ excluded — already mastered)
// and their sub-mastery states (no 'locked' — the parent letter-sounds
// node owns the lock gate).
const LETTER_SOUNDS_VOWELS: ReadonlySet<LetterSoundsVowel> =
  new Set<LetterSoundsVowel>(['/o/', '/u/', '/i/', '/e/'])

const VOWEL_SUB_MASTERY_STATES: ReadonlySet<VowelSubMasteryState> =
  new Set<VowelSubMasteryState>(['intro', 'practicing', 'mastered'])

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
  // mathFacts is optional (M4.x slow-fact directive — additive, no
  // schemaVersion bump; same precedent as `latencyMs`). When present
  // each entry must be `{ a, b, op }` with `a`/`b` integer in [0, 99]
  // and `op ∈ {+, -, *}` — same bounds the server-side
  // `parseLeitnerHint` enforces, so on-disk facts always round-trip
  // the wire.
  if ('mathFacts' in v && v.mathFacts !== undefined) {
    if (!Array.isArray(v.mathFacts)) return false
    for (const f of v.mathFacts) {
      if (!isObject(f)) return false
      const a = f.a
      const b = f.b
      const op = f.op
      if (
        typeof a !== 'number' ||
        !Number.isInteger(a) ||
        a < 0 ||
        a > 99 ||
        typeof b !== 'number' ||
        !Number.isInteger(b) ||
        b < 0 ||
        b > 99 ||
        (op !== '+' && op !== '-' && op !== '*')
      ) {
        return false
      }
    }
  }
  // perProblemAnswerValue is optional (Kevin schema-first PR,
  // 2026-05-21 — additive, no schemaVersion bump; same precedent as
  // `latencyMs` and `mathFacts`). When present each entry must be
  // either `null` (no chip tapped) or a finite integer in [0, 99]
  // (the legitimate chip-value range — current tiers cap at 20, but
  // the future two-digit-addsub tier extends the upper bound; we
  // mirror `mathFacts.a / .b` bounds for forward compatibility).
  if ('perProblemAnswerValue' in v && v.perProblemAnswerValue !== undefined) {
    if (!Array.isArray(v.perProblemAnswerValue)) return false
    for (const n of v.perProblemAnswerValue) {
      if (n === null) continue
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 99) {
        return false
      }
    }
  }
  // perProblemAnswerWord is optional (Kevin schema-first PR,
  // 2026-05-21 — surface parity with `perProblemAnswerValue`). When
  // present each entry must be either `null` or a string. No further
  // shape constraint — the word pack widens with each new vowel tier
  // and a strict allow-list here would force a guard update on every
  // canon expansion.
  if ('perProblemAnswerWord' in v && v.perProblemAnswerWord !== undefined) {
    if (!Array.isArray(v.perProblemAnswerWord)) return false
    for (const w of v.perProblemAnswerWord) {
      if (w !== null && typeof w !== 'string') return false
    }
  }
  // perProblemDistractorClass is optional (Kevin schema-first PR,
  // 2026-05-22 — Wave 5 prereq pairing with Dave's PR #300 two-digit
  // add/sub WITH-regroup research). Same additive posture as
  // `perProblemAnswerWord`: present-but-not-array rejects; non-null
  // entries must be strings; null entries are legitimate (no class
  // applies for that problem). No enum allow-list — Wave 5 spec
  // pins the taxonomy in canon prompts, and constraining the guard
  // here would force a re-release on every taxonomy widening.
  if (
    'perProblemDistractorClass' in v &&
    v.perProblemDistractorClass !== undefined
  ) {
    if (!Array.isArray(v.perProblemDistractorClass)) return false
    for (const c of v.perProblemDistractorClass) {
      if (c !== null && typeof c !== 'string') return false
    }
  }
  // currentTargetVowel is optional (Wave 9 W9.3 — ticket 86c9ya3m6;
  // additive, no schemaVersion bump). Letter-sounds sessions only. When
  // present + not undefined it must be one of the four KNOWN trackable
  // short vowels (`/o/ /u/ /i/ /e/`). An invalid vowel string is a real
  // corruption signal → reject so the upstream loader falls back to
  // defaults rather than carrying a bogus vowel tag into the per-vowel
  // mastery scan. We do NOT cross-check `skillFocus` here — a stray vowel
  // on a math entry is harmless (the mastery scan filters on
  // `skillFocus.includes('letter-sounds')` before reading the field) and
  // a strict membership check would over-constrain the loose persistence
  // boundary.
  if ('currentTargetVowel' in v && v.currentTargetVowel !== undefined) {
    if (
      typeof v.currentTargetVowel !== 'string' ||
      !LETTER_SOUNDS_VOWELS.has(v.currentTargetVowel as LetterSoundsVowel)
    ) {
      return false
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

/**
 * Validate the optional `literacy` namespace (Wave 9 W9.2 — ticket
 * 86c9ya3gd).
 *
 * The only field today is `letterSoundsVowelStates`, itself optional +
 * partial. Validation rule (per AC):
 *
 *  - `literacy` must be an object.
 *  - `letterSoundsVowelStates`, when present + not undefined, must be an
 *    object whose KNOWN-vowel keys (`/o/ /u/ /i/ /e/`) carry a valid
 *    `VowelSubMasteryState` value. A key declared on the map that isn't a
 *    known vowel is tolerated (round-trips silently) — same forward-compat
 *    posture as the loose persistence boundary elsewhere in this module;
 *    a future fifth vowel or a stray key never forces a v1→v2 bump.
 *  - A KNOWN-vowel key with an INVALID value (not intro/practicing/
 *    mastered) is a real corruption signal → reject.
 *
 * Absent / undefined `letterSoundsVowelStates` is fine — the read-path
 * defaulter (`storage.ts:withDefaultedLetterSoundsVowelStates`) fills the
 * missing keys at load time.
 */
export function isLiteracyProgress(v: unknown): boolean {
  if (!isObject(v)) return false
  const states = v.letterSoundsVowelStates
  if (states !== undefined) {
    if (!isObject(states)) return false
    for (const key of Object.keys(states)) {
      // Tolerate keys we don't recognise (forward-compat); only
      // validate the value when the key IS a known vowel.
      if (!LETTER_SOUNDS_VOWELS.has(key as LetterSoundsVowel)) continue
      const state = states[key]
      if (
        typeof state !== 'string' ||
        !VOWEL_SUB_MASTERY_STATES.has(state as VowelSubMasteryState)
      ) {
        return false
      }
    }
  }
  return true
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
  // subitisingScaffoldSessionsObserved (ticket 86c9ur1zr) is an OPTIONAL
  // additive field on `Profile`. Pre-86c9ur1zr blobs predate it; absent
  // is the normal greenfield state and the read-path defaulter
  // (`readSubitisingScaffoldSessionsObserved` in
  // `src/screens/Math/subitisingScaffold.ts`) treats missing as 0.
  // When present, must be a non-negative finite number — non-integer /
  // negative / NaN values are rejected so the upstream loader falls
  // back to defaults rather than carrying a corrupted counter forward.
  if (
    'subitisingScaffoldSessionsObserved' in v.profile &&
    v.profile.subitisingScaffoldSessionsObserved !== undefined
  ) {
    const n = v.profile.subitisingScaffoldSessionsObserved
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return false
  }
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
  // SkillNode strings. Type widened from `WordSongNode[]` to
  // `SkillNode[]` by Wave 3.4 so math focus nodes (`'sub-to-10'`)
  // round-trip without the prior runtime-only widening dance. The
  // producers today are still word-song-only (see
  // `lifetimeFirstEncounters.ts` for why); the guard accepts any
  // SkillNode so a future math-track producer needs no schema work.
  // Duplicates are tolerated — the read-time predicate uses Set
  // semantics. An empty array is the normal greenfield state.
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
  // literacy is optional (Wave 9 W9.2 — ticket 86c9ya3gd; additive, no
  // schemaVersion bump). When present + not undefined it must pass
  // isLiteracyProgress. Absent is the normal pre-W9.2 state and the
  // read-path defaulter fills `letterSoundsVowelStates` at load time.
  if ('literacy' in v && v.literacy !== undefined) {
    if (!isLiteracyProgress(v.literacy)) return false
  }
  return true
}

/** Reads schemaVersion off any plausibly-shaped object, else null. */
export function readSchemaVersion(v: unknown): number | null {
  if (!isObject(v)) return null
  const sv = v.schemaVersion
  return typeof sv === 'number' && Number.isInteger(sv) ? sv : null
}
