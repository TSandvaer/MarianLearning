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
// (cvc-words-short-o, cvc-words-short-u, cvc-words-short-i,
// cvc-words-short-e, …). This was a deliberate backward-compat choice
// — see design/word-song/short-o-pool-expansion.md §2 (and the
// analogous short-u spec at design/word-song/short-u-pool-expansion.md
// §2 / §10 Q1 lock for the 11-word short-u pool, ticket 86c9q5q2d; the
// short-i spec at design/word-song/short-i-pool-expansion.md §2 / §10
// Q1 lock for the 8-word ship pool — drop hip+rim per Thomas's Phase-2
// voluntary fallback for vocab unfamiliarity, ticket 86c9qdba4; and
// the short-e spec at design/word-song/short-e-pool-expansion.md
// §1 / §10 Q1 lock for the 9-word ship pool, ticket 86c9teua2 — the
// final single-vowel tier in the o → u → i → e canonical arc).
//
// Digraphs are split into three sequential sibling nodes
// (digraphs-sh → digraphs-ch → digraphs-th-voiceless) per the
// architecture proposal PR #211 (Thomas-locked K1–K6, 2026-05-14). The
// single dead `digraphs` literal that previously sat between the CVC
// tiers and `sight-words` is dropped — no real user ever had it above
// `'locked'` (verified in proposal §2.6). A read-path remap in
// defaults.ts covers the QA hand-edit case. Sequential isolation
// (3 cross-day ≥90% sessions per digraph before the next unlocks) is
// enforced by the existing mastery rule walking the new sibling tier,
// identical in shape to the CVC sibling-tier cascade. Voiced /ð/ is
// NOT a digraph node — it routes to the `sight-words` tier per Dave's
// research (`design/research/digraph-acquisition-marian.md` §Q2/§Q3).
export type WordSongNode =
  | 'letter-names'
  | 'letter-sounds'
  | 'blending-cv'
  | 'cvc-words'
  | 'cvc-words-short-o'
  | 'cvc-words-short-u'
  | 'cvc-words-short-i'
  | 'cvc-words-short-e'
  | 'digraphs-sh'
  | 'digraphs-ch'
  | 'digraphs-th-voiceless'
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

/**
 * Per-screen `perProblemCorrect` semantic asymmetry — DESIGN NOTE.
 *
 * `SessionHistoryEntry` itself does NOT persist a `perProblemCorrect`
 * field today (see `slowFacts.ts` for the v1 approximation that joins
 * per-session `successRate` against `mathFacts` instead). However, the
 * in-flight `MathSessionResult.perProblemCorrect` and
 * `WordSongSessionResult.perProblemCorrect` arrays — both surfaced
 * via `SessionEndPayload.perProblemCorrect` — carry DIVERGENT
 * per-screen semantics that any future consumer reading the field
 * must understand:
 *
 *   - **Math** writes `perProblemCorrect[i]` inside the once-per-
 *     problem `firstTapRecordedRef` latch. Semantics: **first-tap
 *     correctness**. Wrong-then-correct retries record `false` even
 *     though the problem eventually resolved. Drives Leitner box
 *     promotion / demotion at session-end via `buildLeitnerOutcomes`
 *     (gated on `surface === 'math'`).
 *
 *   - **WordSong** writes `perProblemCorrect[i]` inside
 *     `handleCorrectTap`, AFTER the wrong-tap path has already had a
 *     chance to fire. Semantics: **ever-correct**. Wrong-then-correct
 *     retries record `true` because the write happens on the correct
 *     resolution, not on the first tap. The "ever-correct" framing is
 *     intentional: word-song's pedagogical role is re-encouragement
 *     and decoding practice, not fact-automaticity retrieval, so
 *     downstream graduation accounting via `computeGraduationSplit`
 *     (gated on `track === 'word-song'`) credits any eventual correct.
 *
 * Both arrays are forwarded onto the SAME `SessionEndPayload.perProblemCorrect`
 * field. Current consumers are surface-gated and safe:
 *   - `buildLeitnerOutcomes` (math only) reads first-tap semantics.
 *   - `computeGraduationSplit` (word-song only) reads ever-correct
 *     semantics.
 *
 * This asymmetry was flagged by Devon on PR #286 review and confirmed
 * by Jessica on PR #288; Thomas decided 2026-05-21 to accept the
 * divergence rather than align write-points (option (a) per the
 * session queue). The "ever-correct" semantics on WordSong may be
 * intentional for re-encouragement.
 *
 * NOTE FOR FUTURE WORK — DO NOT consolidate the two latches without
 * coordinating across both screens. A symmetric refactor would
 * silently change the persisted-meaning of `perProblemCorrect` for
 * one track. If a future ticket persists `perProblemCorrect[]` onto
 * `SessionHistoryEntry`, that field MUST either (a) carry the surface
 * tag so consumers can apply the right semantics, or (b) be split
 * into two distinct fields (`firstTapCorrect` vs `everCorrect`) to
 * remove the ambiguity at the shape level.
 */
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
  /**
   * Per-problem math fact, indexed 0..N-1 — math sessions only (M4.x
   * slow-fact directive follow-up to 86c9pwgc8). Each entry mirrors the
   * fact the corresponding problem targeted (`{ a, b, op }`), so the
   * future "accurate but slow" surfacing can join `latencyMs[i]` to a
   * specific Leitner-key without re-deriving from the audio plan.
   *
   * Without this parallel array, latency on its own can't be attributed
   * to a fact — `skillFocus` only names the focus node, not the per-
   * problem pair. Word-song sessions don't carry this field (no Leitner
   * box on literacy in v1).
   *
   * Optional + additive — pre-M4.x entries do not carry it; the field
   * is omitted on read. Same precedent as `latencyMs` itself: an
   * additive optional field, no `schemaVersion` bump.
   */
  mathFacts?: { a: number; b: number; op: '+' | '-' | '*' }[]
  /**
   * Per-problem first-tap chip value, indexed 0..N-1 — math sessions
   * only (Kevin schema-first PR, 2026-05-21, pairing with Dave's
   * PR #284 two-digit add/sub research).
   *
   * Each entry is the literal numeric value Marian tapped on her FIRST
   * chip-tap for that problem, regardless of correctness. `null` when
   * no chip was tapped on that problem (session abandoned mid-problem,
   * or the guided-completion give-answer path completed without a
   * tap). Length matches `latencyMs` / `mathFacts` when present.
   *
   * No current consumer; persisted so a future tier-ship PR (two-digit-
   * addsub) can classify wrong-tap patterns post-hoc. The classification
   * is pedagogical, not mechanical — knowing the literal value lets the
   * consumer derive whichever class taxonomy a given tier defines
   * (off-by-one, wrong-op, decade-anchor, column-cross /
   * concatenated-single-digit, etc.) without the screen having to
   * pre-classify at chip-tap time.
   *
   * Optional + additive — pre-PR entries do not carry it; the field is
   * omitted on read. Same additive precedent as `latencyMs` and
   * `mathFacts`. No `schemaVersion` bump. Word-song sessions persist
   * the parallel `perProblemAnswerWord` field instead.
   */
  perProblemAnswerValue?: (number | null)[]
  /**
   * Per-problem first-tap chip word, indexed 0..N-1 — word-song sessions
   * only (Kevin schema-first PR, 2026-05-21, surface parity with
   * `perProblemAnswerValue`).
   *
   * Each entry is the literal word string Marian tapped on her FIRST
   * chip-tap for that problem, regardless of correctness. `null` when
   * no chip was tapped on that problem.
   *
   * No current consumer; persisted for future word-song error-pattern
   * classification (mid-vowel substitution, onset/coda substitution,
   * etc.). Optional + additive — pre-PR entries do not carry it.
   */
  perProblemAnswerWord?: (string | null)[]
  /**
   * Per-problem distractor-class tag, indexed 0..N-1 — Wave 5 schema
   * prereq (Kevin schema-first PR, 2026-05-22, pairing with Dave's
   * PR #300 two-digit add/sub WITH-regroup research).
   *
   * Each entry is a short string identifying which distractor class
   * Marian's wrong answer landed on for that problem (e.g.
   * `'forgotten-carry'`, `'smaller-from-larger'`, `'column-reversal'`
   * — the exact taxonomy is Wave 5 spec / Kyle's lane, not pinned by
   * this schema). `null` when no class applies — either Marian got
   * the problem correct, no chip was tapped, or the tier's distractor
   * pool doesn't yet have classification metadata (current
   * pre-Wave-5 tiers). Length matches `perProblemAnswerValue` /
   * `latencyMs` / `mathFacts` when present.
   *
   * Why a separate field instead of joining `perProblemAnswerValue`
   * to a per-tier classifier post-hoc: the planner authors
   * distractor-class metadata at session-build time (Wave 5 prompt
   * directive); persisting the chosen-class-tag avoids having to
   * round-trip the full distractor pool + per-tier classifier
   * through the post-session feedback path. The literal-value field
   * stays as the mechanical evidence; this field is the pedagogical
   * label.
   *
   * No current writer beyond the schema-floor (this PR plumbs
   * persistence only). The Wave 5 render-side wiring is Devon's
   * lane (paired ticket 86c9xxhyz). No `schemaVersion` bump — same
   * additive precedent as `perProblemAnswerValue` /
   * `perProblemAnswerWord`. Math sessions only in practice; the
   * type does not constrain surface because future word-song
   * distractor-class work may reuse the same field name.
   */
  perProblemDistractorClass?: (string | null)[]
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
  /**
   * Subitising-scaffold first-encounter counter (ticket 86c9ur1zr —
   * `design/math/subitising-scaffold-content.md` §2.2). Increments
   * once per session where the dot-card scaffold actually rendered
   * (i.e. on an `add-to-10` math session where at least one in-scope
   * problem mounted the overlay). Persists across sessions.
   *
   * Range: `[0, SCAFFOLD_SESSIONS_OBSERVED_CAP]` (4). We only care
   * about the boundary at `FIRST_ENCOUNTER_SESSIONS` (3) — sessions
   * 1, 2, 3 fire the scaffold unconditionally; session 4+ transitions
   * to the `easyBandLeitnerMeanBox`-driven fluency-fade schedule. The
   * cap at 4 keeps the persisted value bounded so future migrations /
   * read-path defaulters have a known finite range.
   *
   * Optional on the stored shape because pre-86c9ur1zr blobs predate
   * the field. Missing → defaulted to 0 at read time (which means
   * "first encounter, unconditional scaffold" — correct semantics for
   * any pre-existing user when the scaffold ships). Field is additive
   * and backward-compatible — schema stays at v1, same precedent as
   * `parentSettings` and `lifetimeFirstEncounters`.
   *
   * The counter measures EXPOSURE TO THE SCAFFOLD, not exposure to
   * the tier. Marian has run dozens of `add-to-10` sessions before
   * this ships; the scaffold is new to her on day 1 of the rollout,
   * so the counter starts at 0 and her first 3 post-merge sessions
   * are first-encounter regardless of `history` length.
   */
  subitisingScaffoldSessionsObserved?: number
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
 * Parent-tunable settings — six knobs that drive the adaptive
 * engine's behaviour. Defaults locked by Thomas on 2026-05-01;
 * `crossVowelMixingEnabled` added 2026-05-09 per ticket 86c9qa0kf
 * (cross-vowel mix v1 impl).
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
  /**
   * Cross-vowel distractor mixing toggle (ticket 86c9qa0kf, default
   * `true` per spec §10 Q1 lock 2026-05-09). When `true` AND all three
   * CVC tiers (`cvc-words`, `cvc-words-short-o`, `cvc-words-short-u`)
   * are `'mastered'`, sessions on any of those tiers can pull
   * distractors from any vowel pool, exercising vowel-discrimination
   * as a deliberate skill. When `false`, sessions stay same-vowel-only
   * regardless of mastery state — the parent-facing escape valve per
   * cross-vowel-mix-spec.md §2 + Dave's research (PR #175) §4.4.
   *
   * Field is additive and backward-compatible — old blobs predate it,
   * `getSettings()` defaults missing values to `true`. Schema
   * stays at v1 (same precedent as `masteryThreshold` per-track shape
   * widening, ticket 86c9kwvy0).
   */
  crossVowelMixingEnabled: boolean
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
  /**
   * Lifetime-first-encounter gate (ticket 86c9q9ben AC9c; Wave 3.4
   * widened the static type from `WordSongNode[]` to `SkillNode[]`).
   *
   * List of `SkillNode` ids the child has already seen the
   * tier-specific first-encounter scaffolding for. Spans BOTH skill
   * trees — word-song first-encounter scaffolding ships today and
   * math first-encounter scaffolding is infrastructure-ready per
   * Kyle's sub-to-10 content spec §4.3 (the `sub-to-10` `take away` →
   * `minus` read-line variant). Currently consumed by the
   * `session.end.opener` rewrite at /api/claude render time:
   *   - `cvc-words-short-u`: the /u/ vs /ʌ/ minimal-pair contrast
   *     opener ("Listen carefully: 'sun' — not 'soon.' …") fires
   *     ONLY when this list does NOT contain `cvc-words-short-u`.
   *   - `cvc-words-short-o`: the box/fox /ks/ first-encounter line
   *     uses the same gate — infrastructure-ready; the canon variant
   *     ships in a future PR.
   *   - `sub-to-10`: the "take away" first-session read-line variant
   *     (Kyle's spec §4.3) — infrastructure-ready at the gate-set
   *     level; the actual session-end append-on-math behavioural
   *     change ships in a follow-up ticket. The static type widening
   *     here unblocks that follow-up; persisted shape now legally
   *     accepts math node ids.
   *
   * Rendered + appended at session-end: when the session-start fetch
   * fired the first-encounter scaffolding for `focusNode`,
   * `progressHistory.recordProgressOnSessionEnd` adds `focusNode` to
   * this list so subsequent sessions on the same focus node skip the
   * scaffolding. The append today is word-song-only (gated by
   * `isWordSongNode(input.focusNode)` in `progressHistory.ts`); the
   * math-track append lands with the follow-up that activates the
   * `sub-to-10` rewrite.
   *
   * Optional on the persisted shape because pre-86c9q9ben blobs
   * predate the field. The migration framework + read-path defaulter
   * fills it from the existing `history` + `skillLevels` shape (any
   * non-locked word-song node is treated as already-encountered, so
   * the migration doesn't replay first-encounter scaffolding the
   * child has missed by virtue of having already passed the tier).
   * Field is additive and backward-compatible (no schemaVersion bump
   * — same precedent as `parentSettings` and `pendingPromotion`).
   *
   * Gate at the NODE level, not the word level — Dave's PR #173 §4
   * recommendation. Future cross-vowel mixing (#86c9m3aek) won't
   * accidentally re-fire when a short-u word surfaces in a mixed-
   * vowel session: the gate keys on `focusNode`, which is set
   * once-per-session at session-start fetch time.
   */
  lifetimeFirstEncounters?: SkillNode[]
}

export const CURRENT_SCHEMA_VERSION = 1 as const
