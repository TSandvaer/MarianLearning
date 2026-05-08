/**
 * Progress model types for Marian Tutor.
 *
 * Source of truth for the persisted shape stored in localStorage under
 * `marian-tutor:progress:v1`. Changes here are schema changes — bump
 * `CURRENT_SCHEMA_VERSION` and add a migration step in `migrate.ts` rather
 * than mutating the v1 contract.
 */

// --------------------------------------------------------------------------
// Skill nodes — names mirror CLAUDE.md `## Two skill trees` exactly.
// String-literal unions keep the type system honest about which nodes exist.
// --------------------------------------------------------------------------

export type NumberGardenNode =
  | 'number-recog'
  | 'add-to-10'
  | 'add-to-20'
  | 'sub-to-10'
  | 'sub-to-20'
  | 'two-digit-addsub'
  | 'skip-counting'
  | 'mult-2-5-10'
  | 'mult-3-4'
  | 'mult-6-9'

// cvc-words = short-a CVC. Subsequent vowels get sibling nodes
// (cvc-words-short-o, cvc-words-short-u, …). This was a deliberate
// backward-compat choice — see design/word-song/short-o-pool-expansion.md §2.
export type WordSongNode =
  | 'letter-names'
  | 'letter-sounds'
  | 'blending-cv'
  | 'cvc-words'
  | 'cvc-words-short-o'
  | 'digraphs'
  | 'sight-words'
  | 'simple-sentences'

export type SkillNode = NumberGardenNode | WordSongNode

/**
 * Coarse mastery level on a skill node. We deliberately keep this small —
 * the adaptive engine reads it as a hint, not a grade.
 *
 * - `locked`: not yet unlocked in the tree
 * - `intro`: unlocked, first exposure, heavy scaffolding
 * - `practicing`: in active rotation, accuracy below mastery threshold
 * - `mastered`: above threshold; goes into Leitner spaced review
 */
export type SkillLevel = 'locked' | 'intro' | 'practicing' | 'mastered'

export type SkillLevels = Record<SkillNode, SkillLevel>

// --------------------------------------------------------------------------
// Leitner box — five-box spaced repetition over math facts (or anything).
// Pure data; helpers live in `leitner.ts`.
// --------------------------------------------------------------------------

/** Leitner box index, 1..5. Box 1 = seen most often, Box 5 = long review. */
export type LeitnerBoxIndex = 1 | 2 | 3 | 4 | 5

export interface LeitnerItem<T> {
  /** Domain payload — e.g. a math fact `{ a: 3, b: 4, op: '+' }`. */
  item: T
  /** Current box, 1..5. */
  box: LeitnerBoxIndex
  /** ms since epoch the item was last shown. 0 = never shown. */
  lastSeen: number
}

export interface LeitnerBox<T> {
  items: LeitnerItem<T>[]
}

// --------------------------------------------------------------------------
// Session history — rolling list of recent sessions for the adaptive model.
// We cap it (see `MAX_SESSION_HISTORY` in adapter) so localStorage stays small.
// --------------------------------------------------------------------------

export interface SessionHistoryEntry {
  /** ISO 8601 date-time the session started. */
  dateISO: string
  /** Skill nodes this session focused on. */
  skillFocus: SkillNode[]
  /**
   * Success rate over the session, 0..1.
   * `correct / attempts`. Sessions with zero attempts are not recorded.
   *
   * For non-graduation sessions: `correct / 8` over the full 8-problem
   * pool — the existing semantics, unchanged.
   *
   * For graduation sessions (ticket 86c9m3aec, novel-word generalization
   * check on cvc-words): `canonicalCorrect / canonicalCount` over ONLY
   * the canonical-pool slice (5–6 problems). The novel-pool slice (2–3
   * problems drawn from `nap, rat, map, tap`) is recorded separately on
   * `novelPoolSuccessRate` below. The split is required because the
   * canonical 90/3 mastery rule per PR #127 gates on the canonical pool
   * only; the novel pool gates promotion separately at ≥80%.
   */
  successRate: number
  /**
   * Novel-pool accuracy on a graduation session, 0..1, or absent for
   * non-graduation sessions (ticket 86c9m3aec).
   *
   * Present only on entries written for a graduation-session run —
   * those are the cvc-words sessions where the planner mixed 2–3 novel
   * short-a probe words into the 8-problem set to verify
   * generalization. The mastery engine reads this field as a second
   * gate: even when `successRate` (canonical) clears the per-track
   * threshold, promotion of a graduation-gated node only fires when
   * `novelPoolSuccessRate >= 0.80`.
   *
   * Absence is meaningful: it signals "this was a regular (non-
   * graduation) session" to the graduation-pending detector. Once a
   * graduation entry has been recorded, the next `threshold.sessions`
   * cross-day qualifying entries must again all be regular (no
   * `novelPoolSuccessRate`) before the engine reflags graduation —
   * matches the AC contract that a failed graduation doesn't
   * immediately re-trigger another attempt.
   */
  novelPoolSuccessRate?: number
  /**
   * Per-problem first-tap latency in milliseconds (ticket 86c9pwgc8 — M4
   * Leitner wiring). Length matches the number of problems Marian saw
   * (8 in v1).
   *
   * Each entry measures wall-clock ms from when the chip row first
   * became tappable for that problem (the read-aloud completed →
   * `readAloudPlayed` flipped to `true`) to the FIRST chip tap on the
   * problem, regardless of correctness. Subsequent retry taps within
   * the same problem are NOT captured here. Sentinel `-1` means the
   * problem was abandoned / never tapped.
   *
   * This is the "decision time" diagnostic Dave's research deliverable
   * flagged as the actionable signal for the counting → retrieval
   * transition (see
   * `MarianLearning/design/research/add-to-10-counting-to-recall.md`):
   * an "accurate but slow" fact is the canary for finger-counting
   * dependency. M4 ships latency capture without yet wiring a consumer;
   * the future M4.x work that surfaces "slow facts" to the planner
   * reads from this field directly.
   *
   * Optional + additive — pre-86c9pwgc8 entries do not carry it; the
   * field is omitted on read. Word-song captures latency too (same
   * shape) for forward compatibility, even though no current consumer
   * reads it.
   */
  latencyMs?: number[]
}

export type SessionHistory = SessionHistoryEntry[]

// --------------------------------------------------------------------------
// Profile + top-level Progress envelope.
// --------------------------------------------------------------------------

/**
 * Character ID stored in the progress profile.
 *
 * v1 = `'melody'`. The Phase 3b character pivot (ticket 86c9jccp7,
 * 2026-04-29) intentionally does NOT change this literal — renaming it
 * to `'emma'` would require a v1 → v2 schema migration with a Leitner
 * + history round-trip, and the field is invisible to Marian (no UI
 * reads it; the character art and audio are governed by the screen-
 * level constants, not by this profile field).
 *
 * The literal is kept here as a forward-compat seam: when v2 ships
 * (skin selection, multiple characters, etc.), the union widens and
 * a `migrateV1ToV2` step in `migrate.ts` rewrites stored documents
 * to the new shape. Until then, the on-disk identifier remains
 * `'melody'` and the visible character is Emma.
 */
export type Character = 'melody'

export interface Profile {
  /** Display name, child-controlled. Capped to 24 chars at write time. */
  childName: string
  character: Character
  /** ISO 8601 timestamp of the last completed session, or null if never. */
  lastPlayedISO: string | null
}

/**
 * Math-fact payload type kept open for now; the adaptive engine will
 * narrow it. Stored as an opaque object so the schema doesn't need to
 * bump every time a fact shape changes.
 */
export interface MathFact {
  a: number
  b: number
  op: '+' | '-' | '*'
}

// --------------------------------------------------------------------------
// Parent settings (M2.5 — ticket 86c9kpjc7).
// Defaults + read helper live in ./parentSettings.ts so the data shape stays
// here (with the rest of the persisted Progress shape) and the runtime
// API stays where it can be tree-shaken if a consumer only needs types.
// --------------------------------------------------------------------------

/**
 * Mastery threshold preset. v1 UI exposes exactly three presets — the
 * type widens to the shape so a forward-looking change can add more
 * without rewriting consumers.
 */
export interface MasteryThreshold {
  /** Required success rate, 0..1. */
  percent: number
  /** Required consecutive sessions at or above `percent` to promote. */
  sessions: number
}

/**
 * Track key used to address a per-track mastery threshold. Mirrors the
 * `MasteryTrack` union in `./mastery.ts`; declared here on the data side
 * so the shape of `ParentSettings.masteryThreshold` doesn't pull a
 * runtime module into pure type imports.
 */
export type MasteryTrackKey = 'math' | 'word-song'

/**
 * Per-track mastery threshold map (ticket 86c9kwvy0, locked 2026-05-02).
 *
 * Math and word-song each carry their own threshold:
 *  - math: 95/3 default — math-fact automaticity benefits from
 *    over-practice; the durability gain at 95% vs 90% may be real even
 *    if the literature doesn't quantify it cleanly.
 *  - word-song: 90/3 default — per Pickering et al. (PMC5843573), 90%
 *    over-learning produces durable maintenance; 95% adds practice
 *    time without clear benefit. Marian's August timeline makes
 *    literacy progression the binding constraint.
 *
 * Cross-day enforcement (PMC8164994: sleep consolidation) stays on for
 * BOTH tracks regardless of percent threshold — see
 * `parentSettings.crossDayEnforcement`.
 */
export type PerTrackMasteryThreshold = Record<MasteryTrackKey, MasteryThreshold>

/**
 * Session-mode picker. `'off'` (default) means the engine selects mode
 * autonomously. `'on'` means the Hub surfaces a Marian-facing
 * review | focus | mixed picker (M4 implements the Hub UI).
 */
export type SessionModePicker = 'off' | 'on'

/**
 * Parent-tunable settings — five knobs that drive the adaptive
 * engine's behaviour. Defaults locked by Thomas on 2026-05-01.
 *
 * Read via `getSettings(progress)` from `./parentSettings.ts` —
 * never reach into `progress.parentSettings` directly. The helper
 * fills defaults for missing / partial fields so old blobs (and
 * forward-compat changes that add fields) don't crash readers.
 */
export interface ParentSettings {
  autoPromote: boolean
  sessionModePicker: SessionModePicker
  /**
   * Per-track mastery threshold (ticket 86c9kwvy0, locked 2026-05-02).
   * Was a single `MasteryThreshold` prior; widened to a per-track map
   * so math and word-song can carry distinct values. Backward-compat
   * for old single-shape blobs is handled at the read path
   * (`getSettings()` in `./parentSettings.ts`); no schema bump.
   */
  masteryThreshold: PerTrackMasteryThreshold
  crossDayEnforcement: boolean
  showLevelToMarian: boolean
}

/** Top-level persisted document. Always carries `schemaVersion`. */
export interface Progress {
  schemaVersion: 1
  profile: Profile
  skillLevels: SkillLevels
  /** Leitner box for math facts only (literacy uses sight-word lists later). */
  mathFactsLeitner: LeitnerBox<MathFact>
  history: SessionHistory
  /**
   * Parent-tunable settings (M2.5 — ticket 86c9kpjc7). Optional on the
   * stored shape because pre-M2.5 blobs predate the field; readers
   * obtain a fully-shaped result via `getSettings()` from
   * `./parentSettings.ts`, never by reaching directly. Field is
   * additive and backward-compatible; schemaVersion stays at 1.
   */
  parentSettings?: ParentSettings
  /**
   * Pending promotion queue (M3 — ticket 86c9kmwd0). Set by
   * `applyMasteryRule()` when the rule qualifies a node for promotion
   * AND `parentSettings.autoPromote === false` — the parent confirms
   * (or implicitly approves by flipping `autoPromote` back to `true`)
   * before the node is moved on `skillLevels`. Cleared by
   * `applyMasteryRule()` once the queued promotion has been applied.
   *
   * Optional on the stored shape because pre-M3 blobs predate the
   * field; this field is additive and backward-compatible (no
   * schemaVersion bump — same precedent as `parentSettings`).
   *
   * If multiple nodes qualify for promotion in a single
   * `applyMasteryRule()` call, the EARLIEST node in tree order wins
   * (math tree before word-song tree; within a track, nearer-to-the-
   * root nodes first). The other qualifying nodes are evaluated again
   * on the next session-end run, when one promotion will have already
   * been applied (or remains queued for the same parent confirmation).
   */
  pendingPromotion?: SkillNode
}

export const CURRENT_SCHEMA_VERSION = 1 as const
