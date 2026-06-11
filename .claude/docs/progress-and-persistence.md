# Progress & Persistence

What this doc covers: the persisted `Progress` document model, its localStorage adapter, the type guards that defend the read path, the M3 mastery promotion rule, focus-node selection, the Leitner spaced-review box, parent-tunable settings, the session-end write path that connects screens to the model, and the debug-seed system that QA uses to deep-launch into specific learning states. Source of truth lives under [`MarianLearning/src/lib/progress/`](MarianLearning/src/lib/progress/).

## Module layout

| File                                                                     | Role                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`types.ts`](MarianLearning/src/lib/progress/types.ts)                   | Type definitions for the persisted shape; schema version literal.                      |
| [`defaults.ts`](MarianLearning/src/lib/progress/defaults.ts)             | `defaultProgress()` factory seeded with Marian's April 2026 diagnostic baseline.       |
| [`guards.ts`](MarianLearning/src/lib/progress/guards.ts)                 | `isProgressV1`, `readSchemaVersion`. Hand-rolled type guards (no zod).                 |
| [`storage.ts`](MarianLearning/src/lib/progress/storage.ts)               | `loadProgress`, `saveProgress`, `clearProgress`, `STORAGE_KEY`, `MAX_SESSION_HISTORY`. |
| [`migrate.ts`](MarianLearning/src/lib/progress/migrate.ts)               | Schema migration framework (v1-only today).                                            |
| [`mastery.ts`](MarianLearning/src/lib/progress/mastery.ts)               | `applyMasteryRule`, `MATH_TREE`, `LITERACY_TREE`, graduation-gate helpers.             |
| [`focusNode.ts`](MarianLearning/src/lib/progress/focusNode.ts)           | `pickFocusNode`, `pickRecentSuccessRate`, in-order node lists.                         |
| [`leitner.ts`](MarianLearning/src/lib/progress/leitner.ts)               | Pure-function 5-box spaced-repetition helpers.                                         |
| [`parentSettings.ts`](MarianLearning/src/lib/progress/parentSettings.ts) | `getSettings`, defaults, threshold presets.                                            |
| [`index.ts`](MarianLearning/src/lib/progress/index.ts)                   | Public surface. App code imports from here, never reaches inside.                      |

The session-end write path lives one directory over in [`src/screens/SessionEnd/progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts), and the debug-seed module lives at [`src/lib/debug/debugSeed.ts`](MarianLearning/src/lib/debug/debugSeed.ts).

## The `Progress` document shape

The top-level persisted envelope is `Progress`, declared at [`types.ts:245`](MarianLearning/src/lib/progress/types.ts#L245). It always carries `schemaVersion: 1`, plus `profile`, `skillLevels`, `mathFactsLeitner`, `history`, optional `parentSettings`, and optional `pendingPromotion`.

```ts
interface Progress {
  schemaVersion: 1
  profile: Profile
  skillLevels: SkillLevels
  mathFactsLeitner: LeitnerBox<MathFact>
  history: SessionHistory
  parentSettings?: ParentSettings
  pendingPromotion?: SkillNode
}
```

`CURRENT_SCHEMA_VERSION = 1` is the export every other module imports — when a v2 migration ships, this is the literal that flips. See [`types.ts:282`](MarianLearning/src/lib/progress/types.ts#L282).

### `Profile`

Defined at [`types.ts:149`](MarianLearning/src/lib/progress/types.ts#L149):

| Field           | Type                       | Notes                                                                                                                                                                                                                                              |
| --------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `childName`     | `string`                   | Capped to 24 chars at write time.                                                                                                                                                                                                                  |
| `character`     | `Character` (= `'melody'`) | The schema literal still says `'melody'` post-Phase-3b character pivot. The visible character is Emma; renaming the literal to `'emma'` would force a v1→v2 migration with no Marian-visible benefit. See `Character` type doc + ticket 86c9jccp7. |
| `lastPlayedISO` | `string \| null`           | ISO 8601 timestamp; updated by `recordProgressOnSessionEnd`.                                                                                                                                                                                       |

### `SkillNode` and `SkillLevels`

Two string-literal unions compose the `SkillNode` namespace, declared at [`types.ts:15`](MarianLearning/src/lib/progress/types.ts#L15) and [`types.ts:30`](MarianLearning/src/lib/progress/types.ts#L30):

- `NumberGardenNode`: `number-recog | add-to-10 | add-to-20 | sub-to-10 | sub-to-20 | two-digit-addsub | skip-counting | mult-2-5-10 | mult-3-4 | mult-6-9`
- `WordSongNode`: `letter-names | letter-sounds | blending-cv | cvc-words | cvc-words-short-o | digraphs | sight-words | simple-sentences`

`cvc-words` is implicitly the short-a CVC node; subsequent vowels get sibling nodes (`cvc-words-short-o`, future `cvc-words-short-u`, etc.). This was a deliberate backward-compat choice so Marian's existing localStorage `cvc-words` entry never needed migrating — see `design/word-song/short-o-pool-expansion.md` §2 and `project_spec_drift_decisions` (sibling vs rename, locked 2026-05-04).

`SkillLevels` is `Record<SkillNode, SkillLevel>`. The four `SkillLevel` values, defined at [`types.ts:51`](MarianLearning/src/lib/progress/types.ts#L51):

| Level        | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `locked`     | Not yet unlocked in the tree.                         |
| `intro`      | Unlocked, first exposure, heavy scaffolding.          |
| `practicing` | In active rotation, accuracy below mastery threshold. |
| `mastered`   | Above threshold; goes into Leitner spaced review.     |

### `SessionHistoryEntry`

Defined at [`types.ts:81`](MarianLearning/src/lib/progress/types.ts#L81). Each entry captures one completed session:

```ts
interface SessionHistoryEntry {
  dateISO: string
  skillFocus: SkillNode[]
  successRate: number // 0..1
  novelPoolSuccessRate?: number // present only on graduation entries
  latencyMs?: number[] // per-problem first-tap latency (added PR #164)
  mathFacts?: MathFact[] // per-problem fact, math only (added M4.x slow-fact directive)
}
```

For non-graduation sessions, `successRate = correct / 8` over the full 8-problem pool. For graduation sessions (cvc-words generalization probe per ticket 86c9m3aec), `successRate = canonicalCorrect / canonicalCount` over only the canonical-pool slice (5–6 of 8 problems), and `novelPoolSuccessRate = novelCorrect / novelCount` over the 2–3 novel-probe slice. The two pools are evaluated as independent gates by the mastery rule.

`latencyMs` is the per-problem first-tap latency in milliseconds. Detailed capture mechanics + caveats live below at § "Latency capture (M4 — diagnostic, no consumer yet)".

`mathFacts` is the parallel per-problem math fact array — same length as `latencyMs`, indexed identically. Math only; word-song doesn't ship the field. Without this companion array, latency on its own can't be attributed to a specific Leitner-key fact (`skillFocus` only names the focus node). Added by the M4.x slow-fact directive — see § "Slow-fact directive (M4.x — accurate-but-slow surfacing)" below.

### `LeitnerBox` and `LeitnerItem`

Defined at [`types.ts:61`](MarianLearning/src/lib/progress/types.ts#L61):

```ts
type LeitnerBoxIndex = 1 | 2 | 3 | 4 | 5

interface LeitnerItem<T> {
  item: T
  box: LeitnerBoxIndex
  lastSeen: number // ms since epoch; 0 = never shown
}

interface LeitnerBox<T> {
  items: LeitnerItem<T>[]
}
```

The `Progress.mathFactsLeitner` field is a `LeitnerBox<MathFact>`. Literacy uses sight-word lists later — there is no Leitner box on the literacy track in v1.

### Schema version

`CURRENT_SCHEMA_VERSION = 1`. The literal is exported as `as const` so changes here are TypeScript-visible everywhere. Adding a v2 means:

1. Bumping the union in `types.ts` (`schemaVersion: 1 | 2`).
2. Adding a `MigrationStep` for `1` to `STEPS` in [`migrate.ts:20`](MarianLearning/src/lib/progress/migrate.ts#L20).
3. Bumping `CURRENT_SCHEMA_VERSION` to `2`.

Both `parentSettings` and `pendingPromotion` are additive optional fields — they were added without bumping the schema version. Old blobs are still valid v1 documents; readers fill defaults at the read path. See storage.ts's `withDefaultedSettings` pattern below.

### Read-path remap migrations (prefer over v1→v2 schema bumps for SkillNode rename/removal)

When **removing or renaming** a `SkillNode` literal — i.e. the union loses a member, or one member's identity changes — prefer a localStorage-read-path remap (an idempotent transform applied inside `loadProgress()`) over a `v1 → v2` schema bump (full migration step with version stamping). Two precedents now establish the pattern:

1. **PR #211 digraph split (2026-05-14)** — the dead `digraphs` literal was retired in favour of the three `digraphs-{sh,ch,th-voiceless}` siblings. The K2 remap in [`src/lib/progress/storage.ts`](MarianLearning/src/lib/progress/storage.ts) silently rewrites any persisted `'digraphs': <SkillLevel>` key into the chosen replacement sibling at load time.
2. **PR #308 two-digit-addsub split (2026-05-22)** — the dead `two-digit-addsub` literal was retired in favour of `two-digit-addsub-no-regroup` + `two-digit-addsub-with-regroup`. The same K2 remap in [`src/lib/progress/storage.ts`](MarianLearning/src/lib/progress/storage.ts) targets `-no-regroup` (the lower-difficulty sibling — default new arrivals into intro on the easier tier).

Properties of the pattern:

- Transform applies on the read path (inside `loadProgress()`), not on write. No call site needs to know about it.
- **Idempotent** — running twice on already-migrated data is a no-op (the old key is absent on second pass).
- No `schemaVersion` bump. The type-guard's `SKILL_NODES` set just carries the new literals in the union; the old literal disappears.
- The old → new mapping is a **policy decision**, not a mechanical one. For PR #308 the K2 remap targets `-no-regroup` because it is the lower-difficulty sibling and we default arriving users into the easier intro experience.
- Pre-existing `SchemaFloor` defaulter (§"Sync points when widening `SkillNode`") still walks `SKILL_NODES` and fills missing keys to `'locked'` — the remap runs first so the old key contributes its level to the new key before the floor adds the _other_ sibling at `'locked'`.

When to reach for a real `v1 → v2` schema bump instead: when the shape of the document itself changes (a field type changes, a sub-object is added that needs a non-default initial value derived from other state, a key is moved across nesting boundaries). Pure literal-rename/removal within `SkillLevels` is the K2 remap's domain.

### Producer-strict / boundary-loose persistence pattern

The persistence path has an **asymmetric type discipline** worth naming explicitly: producers + in-app middle hops are strict-typed; the persistence boundary is intentionally loose, with documented rationale. Tightening the boundary is an anti-pattern that has bitten the project before and will keep being tempting if not named.

The three-layer chain (concrete example: per-problem distractor class on math sessions):

1. **Producer — strict.** [`src/screens/Math/Math.tsx`](MarianLearning/src/screens/Math/Math.tsx) constructs `MathSessionResult` with a precise per-problem field (`perProblemDistractorClass: DistractorClass[]`). The producer knows exactly which `DistractorClass` literal each chip row was rendered against — there is no widening reason at the source.
2. **In-app middle hop — strict.** [`src/screens/SessionEnd/SessionEnd.tsx`](MarianLearning/src/screens/SessionEnd/SessionEnd.tsx) forwards the array into `SessionEndPayload` and on to the `recordProgressOnSessionEnd` call site. Each hop carries the strict `DistractorClass[]` type. Middle-hop hopholes (typing the field as `string[]` to "be flexible") have shipped before and are the recurring failure mode — see PR #316 NIT 3 (Wave 6, 2026-05-23) which closed the `SessionEndPayload.perProblemDistractorClass` hole that had widened the field to `string[]` between producer and boundary.
3. **Persistence boundary — intentionally loose.** [`src/lib/progress/guards.ts:184-200`](MarianLearning/src/lib/progress/guards.ts#L184) accepts `string[]` (or absent) for the persisted field, with an inline comment explaining the policy: **no enum allow-list at the read path**. Future tier additions or distractor-class renames don't force a v1→v2 schema bump; old blobs round-trip cleanly.

**The structural-subtype passthrough is the load-bearing mechanic that makes the asymmetry painless.** TypeScript treats `DistractorClass[]` as a structural subtype of `string[]` — every value the strict producer emits is also a valid value at the loose boundary, with zero coercion or runtime cost. The boundary widening is purely on the read side: producers can keep using their narrow types; the boundary just doesn't insist on it.

**Anti-pattern to avoid: tightening the persistence boundary.** Future-Devon will look at the loose `string[]` in `guards.ts` and think "let's just type this as `DistractorClass[]` for safety." Don't. That change forces:

- A parse-on-read normalizer for every existing localStorage blob that carried older `DistractorClass` literals (renames, removed tiers).
- A migration step (effectively a v1→v2 schema bump in spirit if not in name) for every distractor-class change.
- A blast radius across `cloudSync.ts` install-time validation, debug seeds, and e2e fixtures.

The `guards.ts:184-200` comment block names this trade-off in-line; the comment is load-bearing, not decorative. Reviewers should push back on any PR that proposes narrowing the persistence boundary without a written migration plan.

**Concrete reference:** PR #316 NIT 3 (Wave 6, 2026-05-23) closed the middle-hop hole on `SessionEndPayload.perProblemDistractorClass` (widened `string[]` → strict `DistractorClass[]`) without touching the boundary in `guards.ts`. The fix was producer-strict propagation only; the structural subtype passthrough meant zero changes downstream of the persistence boundary.

## localStorage adapter

### Storage key and load/save

The single key is `STORAGE_KEY = 'marian-tutor:progress:v1'` ([`storage.ts:17`](MarianLearning/src/lib/progress/storage.ts#L17)).

`loadProgress()` returns one of:

- `null` if nothing is stored, the storage backend is unavailable (SSR / private mode / locked-down iframe), or the blob isn't valid JSON.
- `null` if the JSON is shaped wrong and cannot be migrated.
- A fully-shaped `Progress` (with `parentSettings` defaulted in via `withDefaultedSettings`) when the read succeeds.

`saveProgress(p)` trims `history` to `MAX_SESSION_HISTORY = 30` entries (oldest dropped) and persists. Storage failures (quota, private mode) are silently swallowed — progress is best-effort, never a blocker for play. See [`storage.ts:83`](MarianLearning/src/lib/progress/storage.ts#L83).

`clearProgress()` removes the key. Used by reset flows and tests.

Every localStorage touch goes through `safeGetItem` / `safeSetItem` / `safeRemoveItem` so SSR and private-mode browsers don't crash boot.

### `withDefaultedSettings` (read-path defaulter)

[`storage.ts:72`](MarianLearning/src/lib/progress/storage.ts#L72). Layered post-parse so callers of `loadProgress()` always see a `parentSettings` field even on pre-M2.5 blobs that predate it. Implementation just runs `getSettings(p)` and merges the result back. Old blobs round-trip lossless: a fully-shaped input produces deep-equal output.

### `withDefaultedSkillLevels` (schema-floor defaulter)

[`storage.ts`](MarianLearning/src/lib/progress/storage.ts). Added in PR #159 as the second layer of the hardened read path. Mirrors `withDefaultedSettings` but for `skillLevels`.

When a saved blob's `skillLevels` is missing one or more keys — typically because a new `SkillNode` was added to the union after the blob was written — this defaulter fills each missing key with `'locked'` from `defaultLockedSkillLevels()`. Without this step, `isProgressV1` rejects the whole blob, `loadProgress()` returns `null`, and the app falls back to `defaultProgress()` — silently clobbering Marian's progress.

**`defaultLockedSkillLevels()` is NOT `defaultProgress()`.** This distinction is load-bearing. `defaultProgress()` carries Marian's April 2026 diagnostic (e.g. `add-to-10: 'practicing'`, `cvc-words: 'intro'`); using it as the read-path floor would silently grant un-earned access to nodes missing from older saved blobs. The schema floor must be a true minimum — every known node defaults to `'locked'`. `defaultLockedSkillLevels()` in [`defaults.ts`](MarianLearning/src/lib/progress/defaults.ts) is that factory; `SCHEMA_FLOOR_NODES` (same file) is the canonical "every node the schema knows about" list the defaulter walks.

**Ordering invariant**: `withDefaultedSkillLevels` MUST run BEFORE `isProgressV1` validation. If reversed, the strict `isSkillLevels` guard rejects the under-keyed blob before the defaulter can fill it. The full layered sequence inside `loadProgress()` is now:

1. `migrate()` — version-handling.
2. `withDefaultedSkillLevels()` — fill missing skill-level keys to `'locked'`.
3. `isProgressV1` — guard validates the now-fully-keyed blob.
4. `withDefaultedSettings()` — fill missing `parentSettings` with defaults.

The new `storage.test.ts` schema-floor-coverage test enumerates every key in `defaultProgress().skillLevels` and asserts each defaults to `'locked'` on an empty-`skillLevels` fixture — automated regression guard for `SCHEMA_FLOOR_NODES` drift.

## Type guards

[`guards.ts`](MarianLearning/src/lib/progress/guards.ts) exports `isProgressV1` and `readSchemaVersion`. Hand-rolled — no runtime schema dependency (zod / valibot / etc.). The Progress module is on the hot path for app boot and the bundle budget says "earn every kilobyte."

### `SKILL_NODES` set — the load-bearing widening hazard

[`guards.ts:19`](MarianLearning/src/lib/progress/guards.ts#L19) declares a frozen `Set<SkillNode>` listing every node the schema knows about. `isSkillLevels` walks this set and requires every node to appear as a key in the candidate `skillLevels` object with a valid `SkillLevel` value:

```ts
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
```

**Critical gotcha — when `SKILL_NODES` widens, every persisted blob without the new key fails the guard.** When `cvc-words-short-o` was added to the union in PR #151, every existing localStorage blob that didn't carry that key failed `isSkillLevels`, `loadProgress()` returned `null`, and the app fell back to defaults. **Test fixtures (and debug seeds) must mirror the `SKILL_NODES` set or seeded state silently disappears.** This was the load-bearing bug fixed in PR #151's e2e fixture commit `1ed9857`. The `defaultProgress()` factory in [`defaults.ts`](MarianLearning/src/lib/progress/defaults.ts) is the canonical reference shape — debug seeds and test fixtures should derive from it via spread, not hand-build.

**Production-side hardening** (PR #159) added `withDefaultedSkillLevels` upstream of the guard so future `SKILL_NODES` widenings no longer wipe Marian's progress at runtime. The guard is still strict; the defaulter just fills missing keys to `'locked'` first. See `withDefaultedSkillLevels` above for the full ordering contract. **The widening hazard for test fixtures still applies** — `seedStorage.ts`'s `DEFAULT_SKILL_LEVELS` does NOT route through the defaulter at seed time.

#### Sync points when widening `SkillNode`

Wider context: PR #160 framed this as "five places," but inspection during ticket 86c9q9ben (PR #174 — short-u tier) showed the actual surface is **three independently-editable places (1-3 + 4) and one auto-syncing consumer (5)**. The "five places" framing is preserved below for historical accuracy of how the work was originally scoped, but the editing pattern is simpler than that count implies.

| #   | Location                                                                                                                                                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                      | Editing posture                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SkillNode` union in [`types.ts`](MarianLearning/src/lib/progress/types.ts)                                                                                                            | TypeScript source of truth for the node literal.                                                                                                                                                                                                                                                                                                                             | **Edit per node addition.**                                                                                                                                                                                                                                                                                                              |
| 2   | `SKILL_NODES` set in [`guards.ts`](MarianLearning/src/lib/progress/guards.ts)                                                                                                          | Required-key set for `isSkillLevels` (strict guard).                                                                                                                                                                                                                                                                                                                         | **Edit per node addition.**                                                                                                                                                                                                                                                                                                              |
| 3   | `SCHEMA_FLOOR_NODES` list in [`defaults.ts`](MarianLearning/src/lib/progress/defaults.ts)                                                                                              | Walked by `storage.ts:withDefaultedSkillLevels` AND `cloudSync.ts:withDefaultedSkillLevels` (via `defaultLockedSkillLevels()`) to fill missing keys with `'locked'` at load / install time.                                                                                                                                                                                  | **Edit per node addition** — also updates place 5 automatically.                                                                                                                                                                                                                                                                         |
| 4   | `DEFAULT_SKILL_LEVELS` in [`e2e/_helpers/seedStorage.ts`](MarianLearning/e2e/_helpers/seedStorage.ts)                                                                                  | E2e fixture baseline; missing keys here fail the guard at seed time (the production defaulter is NOT in the seed path).                                                                                                                                                                                                                                                      | **Edit per node addition** (independent — no shared module with place 3).                                                                                                                                                                                                                                                                |
| 5   | `cloudSync.ts`'s private `withDefaultedSkillLevels` mirror                                                                                                                             | 1:1 replica of place 3's defaulter; runs before the strict guard when installing a cloud-fetched blob. The mirror **walks `defaultLockedSkillLevels()` rather than a hand-mirrored list**, so a place-3 update propagates here automatically. The `cloudSync.test.ts` `withDefaultedSkillLevels parity` test is the regression guard against any future static-mirror drift. | **No edit needed when adding a node** — the function reads `SCHEMA_FLOOR_NODES` indirectly via `defaultLockedSkillLevels()`.                                                                                                                                                                                                             |
| 6   | `STAGE_LABEL` in [`stageIcons.tsx`](MarianLearning/src/screens/Hub/stageIcons.tsx)                                                                                                     | `Record<StageId, string>` mapping stage-id to display label for Hub. Added to the "5 sync points" list 2026-05-10 after PR #190 (short-i tier widening) confirmed typecheck-fails-on-omission.                                                                                                                                                                               | **Edit per node addition** (when the new node introduces a new Hub stage).                                                                                                                                                                                                                                                               |
| 7   | `WORD_SONG_LABELS` in [`progressProjection.ts`](MarianLearning/src/screens/Hub/progressProjection.ts)                                                                                  | `Record<WordSongNode, string>` mapping skill-node to display label for the path-strip projection. Added 2026-05-10 after PR #190 confirmed typecheck-fails-on-omission.                                                                                                                                                                                                      | **Edit per WordSongNode addition** (analogous map exists for math nodes if they widen).                                                                                                                                                                                                                                                  |
| 8   | Sibling regression-spec seeds asserting picker-walk endpoints (e.g. [`cvc-cross-vowel-mix-regression.spec.ts`](MarianLearning/e2e/cvc-cross-vowel-mix-regression.spec.ts) tests 1 + 3) | Tests that seed `'mastered'` up to tier N + `'practicing'` on tier N+1 to assert focusNode lands on N+1 must add the new sibling tier as `'mastered'` when widening **intermediate** tiers. Caught by Playwright at CI time, **invisible to typecheck**.                                                                                                                     | **Edit per intermediate-tier addition** (skip for terminal tier additions). Added 2026-05-10 after PR #190's CI break exposed the gap — the only spec in the e2e set that asserts post-CVC-graduation focusNode endpoint; same vulnerability will recur for short-e (between short-i and digraphs) and any future intermediate widening. |

The `storage.test.ts` schema-floor-coverage test catches drift at place 3 first; e2e specs catch drift at place 4; the cloudSync parity test catches drift at place 5; **TypeScript typecheck catches drift at places 6-7** (`Record<...>` exhaustiveness check fires immediately when the union widens). Places 6-7 were originally undocumented because the typecheck gate makes them self-correcting at edit time, but they show up in the diff of any tier-widening PR (confirmed PR #174 short-u and PR #190 short-i both touched them). **Place 8 is the only one that's invisible to all static checks** — Playwright is the only safety net, so dispatch briefs for tier widenings should explicitly call out the sibling-spec audit. Per Kevin's PR #190 fix audit (`46b9c9f`): all other CVC-tier-targeting specs are safe by construction (they target earlier tiers with `'practicing'`, so the picker stops there before reaching the new tier); only `cvc-cross-vowel-mix-regression.spec.ts` is in the at-risk pattern today.

**Follow-up flagged in PR #160's findings**: surface a public `withDefaultedSkillLevels` from the progress module index so `cloudSync.ts` can import the storage adapter's defaulter rather than holding a private mirror. Today the place-5 mirror is dynamic (walks `defaultLockedSkillLevels()`) so it can't actually drift in shape — only in behavior, if a future change adds extra logic to the storage-side function. The follow-up would lock the implementations together.

### `isProgressV1` exact-shape check

[`guards.ts:148`](MarianLearning/src/lib/progress/guards.ts#L148). Validates:

- `schemaVersion === 1`
- `profile.childName` is a string
- `profile.character === 'melody'` (the literal — see `Character` type note above)
- `profile.lastPlayedISO` is `null` or a string
- `skillLevels` passes `isSkillLevels`
- `mathFactsLeitner` passes `isLeitnerBox`
- `history` is an array, every entry passes `isHistoryEntry`
- `parentSettings`, when present and not undefined, passes `isParentSettings`
- `pendingPromotion`, when present and not undefined, is a known `SkillNode` string

`isParentSettings` accepts both the new per-track `masteryThreshold` shape and the legacy single shape — see [`guards.ts:119`](MarianLearning/src/lib/progress/guards.ts#L119). The legacy → per-track promotion happens at the read path (`getSettings`), not at guard time, so old blobs remain valid v1 documents.

`readSchemaVersion(v)` reads `schemaVersion` off any plausibly-shaped object, returns `null` otherwise. Used by `migrate()` to dispatch.

## Defaults — Marian's April 2026 baseline

> **2026-05-08 caveat:** the April baselines hardcoded below are **observationally outdated** — Marian's first iPad session post-#164 deploy showed she's already past concrete-counting on sums ≤ 10 (visual-scaffold + near-retrieval, not finger-counting). Source-of-truth code defaults are unchanged because (a) defaults only affect fresh-storage first-launch, and (b) bumping defaults mid-flight would clobber her real progress. See memory `project_diagnostic_results` § "Update — May 2026" for the live-state observation. **When recommending interventions, check that section before invoking April-baseline framing — most "she's still finger-counting" claims are stale.**

[`defaults.ts:42`](MarianLearning/src/lib/progress/defaults.ts#L42) returns a fresh `Progress` document seeded from Marian's diagnostic results (per `project_diagnostic_results` memory and `CLAUDE.md` `## Marian's current levels`).

Math:

| Node                              | Default      | Rationale                                                 |
| --------------------------------- | ------------ | --------------------------------------------------------- |
| `number-recog`                    | `mastered`   | Diagnostic baseline.                                      |
| `add-to-10`                       | `practicing` | Sums to 10, drive automaticity (100% finger reliance).    |
| `add-to-20`                       | `locked`     | Unlocks when `add-to-10` masters.                         |
| `sub-to-10`                       | `mastered`   | Within 15 confident → sub-to-10 is solid.                 |
| `sub-to-20`                       | `intro`      | Diagnostic says extend to 20 no-borrow next — introduced. |
| `two-digit-addsub` ... `mult-6-9` | `locked`     | Downstream.                                               |
| `mult-2-5-10`                     | `intro`      | Repeated addition concept, no `×` symbol.                 |
| `mult-3-4`, `mult-6-9`            | `locked`     | Downstream.                                               |

Word Song:

| Node                | Default      | Rationale                                              |
| ------------------- | ------------ | ------------------------------------------------------ |
| `letter-names`      | `mastered`   | Alphabet mastered (minor b/d confusion).               |
| `letter-sounds`     | `practicing` | Consonants mastered, vowels mid-flight (only short-a). |
| `blending-cv`       | `practicing` | CV confident.                                          |
| `cvc-words`         | `intro`      | Emerging — short-a CVC.                                |
| `cvc-words-short-o` | `locked`     | Sibling tier, unlocks when `cvc-words` masters.        |
| `digraphs`          | `locked`     | Downstream.                                            |
| `sight-words`       | `intro`      | Introduce gradually.                                   |
| `simple-sentences`  | `locked`     | Downstream.                                            |

`mathFactsLeitner` defaults to `emptyLeitner()` (empty `items` array). `parentSettings` defaults to a clone of `DEFAULT_PARENT_SETTINGS`.

## Migration framework

[`migrate.ts`](MarianLearning/src/lib/progress/migrate.ts). v1 is the only version today; the framework exists so v2+ has a place to land without rewriting the adapter. Each step is a `(input: unknown) => unknown | null` keyed by source version in `STEPS`.

`migrate(oldData)` reads the version, walks `STEPS[version]` until it reaches `CURRENT_SCHEMA_VERSION`, then validates against `isProgressV1`. Returns `null` on any unrecoverable input — the adapter treats that as corrupt data and falls back to defaults.

Future-version data (`version > CURRENT_SCHEMA_VERSION`) is refused rather than guessed — see [`migrate.ts:49`](MarianLearning/src/lib/progress/migrate.ts#L49).

## Lifetime-first-encounter gate (ticket 86c9q9ben)

`Progress.lifetimeFirstEncounters?: SkillNode[]` (additive, no schemaVersion bump — same precedent as `parentSettings` and `pendingPromotion`). The persisted list of skill nodes the child has already seen tier-specific first-encounter scaffolding for. **Storage-shape vs helper-API asymmetry is deliberate** (PR #243, 2026-05-15): the static storage type spans both tracks (`SkillNode = NumberGardenNode | WordSongNode`) so a math node ID round-trips cleanly when the math-producer follow-up lands, but the helper-API in [`lifetimeFirstEncounters.ts`](MarianLearning/src/lib/progress/lifetimeFirstEncounters.ts) (`isFirstEncounter` / `markFirstEncounterSeen` / `inferLifetimeFirstEncountersFromProgress`) intentionally stays `WordSongNode`-scoped. Two reasons: (a) the only producer call at [`progressHistory.ts:264`](MarianLearning/src/screens/SessionEnd/progressHistory.ts#L264) is gated by `isWordSongNode(input.focusNode)` — widening helpers without widening the producer gate would create type/runtime drift; (b) the migration inference rule (any non-locked node = already-encountered) only fits word-song scaffolding semantics — naively walking math nodes would replay tier scaffolding inappropriately. Widen helpers + producer gate together when the math first-encounter follow-up ships. Today consumed by the server-side `session.end.opener` rewrite at [`api/_firstEncounterGate.ts`](MarianLearning/api/_firstEncounterGate.ts):

- `cvc-words-short-u`: when the focus node is **NOT** in the list, the canon's `/u/` vs `/ʌ/` minimal-pair contrast opener (`"You did it! Listen carefully: 'sun' — not 'soon.' Sun! /s/ /ʌ/ /n/."`) is delivered as canon ships it. When the node **IS** in the list, the server rewrites the opener to vanilla `"You did it!"` by sourcing both text + audio from `cvc-words.json` (the short-a canon's vanilla opener).
- `cvc-words-short-o`: infrastructure-ready under the same gate. The short-o canon currently ships vanilla `"You did it!"` as its opener; when a future canon re-bake adds the `box`/`fox` `/ks/` first-encounter line, the same gate fires for it without code changes — the gate's `FIRST_ENCOUNTER_GATED_NODES` set already includes `cvc-words-short-o`.

### Append-on-session-end

`progressHistory.recordProgressOnSessionEnd` calls `markFirstEncounterSeen(progress, focusNode)` after the session-end save lands when `focusNode` is a `WordSongNode`. Idempotent — second session on the same node is a no-op append. Math focus nodes are not appended (no math first-encounter scaffolding today).

### Read-time gate

The browser ships `progress.lifetimeFirstEncounters` on the `/api/claude` request payload for word-song requests (always — even empty `[]` is meaningful, signalling greenfield Marian). The server's `applyFirstEncounterGate` consults this on the way out (after canon-hit / cache-hit / live-pipeline) and rewrites `session.end.opener` if the node is gated AND already encountered.

### Migration: read-path defaulter

`storage.ts:withDefaultedLifetimeFirstEncounters` runs after `isProgressV1` validation when the field is undefined. Inference rule (in [`lifetimeFirstEncounters.ts:inferLifetimeFirstEncountersFromProgress`](MarianLearning/src/lib/progress/lifetimeFirstEncounters.ts)): every word-song node whose `skillLevels[node]` is **NOT** `'locked'` is treated as already-encountered. Rationale:

- A node at `'mastered'` clearly has been seen.
- A node at `'practicing'` has been delivered to Marian via session-start at least once.
- A node at `'intro'` is in the trees the engine considers fair game; if the diagnostic baseline set this flag, the engine would have fired any tier-specific scaffolding in earlier sessions.
- A node at `'locked'` is genuinely unseen — the gate fires on her first session at that tier.

Conservative posture: better to miss the scaffolding once on a Marian who's been mid-tier when this code shipped than to replay it on someone who already had her contrast-line moment. Real Marian's 2026-05-09 shape (cvc-words at `'intro'`, short-o at `'locked'`, short-u at `'locked'`) post-migration: list = `['letter-names', 'letter-sounds', 'blending-cv', 'cvc-words', 'sight-words']`. Short-o + short-u stay greenfield, so her real first short-o session AND first short-u session both fire scaffolding correctly.

### Cloud-sync parity

`cloudSync.ts:installCloudBlob` mirrors the storage-side defaulter. A cloud blob written by an older device that doesn't carry `lifetimeFirstEncounters` gets the field inferred at install time using the SAME rule. Pinned by the `cloudSync.test.ts` `lifetimeFirstEncounters parity` test.

### Gate at the NODE level, not the WORD level

Per Dave's PR #173 §4 recommendation. Future cross-vowel mixing (#86c9m3aek) won't accidentally re-fire when a short-u word surfaces in a mixed-vowel session: the gate keys on `focusNode`, which is set once-per-session at session-start fetch time. A short-u target that appears in a short-a (`focusNode === 'cvc-words'`) trio under cross-vowel mixing would NOT re-fire short-u scaffolding — the focus node is `cvc-words`, which is not in the gated set.

## Per-vowel letter-sounds sub-mastery (Wave 9 — PRs #357 / #358 / #359)

Tracks independent mastery for each short vowel on the `letter-sounds` tier. Layers _under_ the composite `skillLevels['letter-sounds']` without changing any downstream contract (focus-picker / Hub unlock / planner-first-class all still read the composite). Closest precedent is the [Lifetime-first-encounter gate](#lifetime-first-encounter-gate-ticket-86c9q9ben) — additive optional field + read-path defaulter + cloudSync parity.

### Field shape

`Progress.literacy?.letterSoundsVowelStates` — additive optional, **no `schemaVersion` bump**.

```ts
type LetterSoundsVowel = '/o/' | '/u/' | '/i/' | '/e/' // slash-LETTER notation
type LetterSoundsVowelState = 'intro' | 'practicing' | 'mastered'
// progress.literacy.letterSoundsVowelStates: Record<LetterSoundsVowel, LetterSoundsVowelState>
```

Four vowels per `phonics-sequence-marian.md` §Q1 (`/o/ → /u/ → /i/ → /e/`); `/a/` excluded (mastered at diagnostic baseline). Greenfield default is all-four-`'intro'`.

### Read-path defaulter ordering — load-bearing

`storage.ts:withDefaultedLetterSoundsVowelStates` runs **after `withDefaultedSkillLevels`, before `isProgressV1`** inside `loadProgress()`: `migrate → withDefaultedSkillLevels → withDefaultedLetterSoundsVowelStates → isProgressV1 → withDefaultedSettings`. If it ran after the guard, `isProgressV1` would reject pre-W9 blobs before the field could be filled (same failure mode as the original `withDefaultedSkillLevels` ordering).

### Hand-mirror hazard (adding a 5th vowel)

`DEFAULT_LETTER_SOUNDS_VOWEL_STATES` (frozen literal) and `LETTER_SOUNDS_VOWELS` (set) in `guards.ts`, plus the `cloudSync.ts:installCloudBlob` defaulter mirror, are **hand-mirrored** — NOT derived from the type union, so TypeScript won't catch a gap. Adding a vowel means manually extending all three. The `cloudSync.test.ts` `letterSoundsVowelStates parity` test guards storage↔cloudSync drift.

### Activation gate — supersedes composite when active (W9.3)

`perVowelTrackingActive(progress)` is true only when **BOTH** hold: (1) `literacy.letterSoundsVowelStates` is present, AND (2) at least one `SessionHistoryEntry` carries `currentTargetVowel`. When active, `applyMasteryRule` **skips `letter-sounds` in the standard 90/3 `qualifies()` walk** and promotes the composite only via an **AND-of-four-vowels gate** (all four `'mastered'` → `skillLevels['letter-sounds']='mastered'` → `pendingPromotion`). Either condition missing → unchanged Wave-7 composite 90/3 fallback. The all-intro defaulter alone does NOT activate it — a `currentTargetVowel`-tagged session must have been played first.

### `SessionHistoryEntry.currentTargetVowel`

Additive optional `LetterSoundsVowel`; written by `recordProgressOnSessionEnd` **only when `focusNode === 'letter-sounds'`**. Its presence is the detection signal for activation condition (2). Per-vowel promotion filters history by `currentTargetVowel === <vowel>` (cross-day-deduped, same as per-node) — a `/o/`-tagged session never counts toward `/u/`'s 90/3.

### Current-target derivation (§1.4 walk)

Walk `/o/ → /u/ → /i/ → /e/`: first `'practicing'` vowel is the target; all-mastered → next unintroduced. **`/e/` gate:** if `/e/` would be picked but `/i/` is not yet `'mastered'`, skip to a `'mastered'` vowel for review (`/e/`≈`/i/` acoustically — don't introduce `/e/` before `/i/` is consolidated). The planner derives this server-side; see `planner-and-canon.md` § "Per-vowel letter-sounds bypass" for the slash-LETTER↔bare-IPA bridge and the canon/cache bypass shape.

## Subitising-scaffold counters — default-at-consumer-read-site (deliberate divergence)

`Profile.subitisingScaffoldSessionsObserved` (add-to-10) and `Profile.subitisingScaffoldSubSessionsObserved` (sub-to-10, Wave 10 PR #369) deliberately do NOT follow the heavier per-vowel pattern above: they appear in **no** `defaults.ts` seed, **no** storage-side `withDefaulted*` defaulter, and **no** cloudSync mirror. They ride through as additive-optional fields validated inline by `isProgressV1` (one gate covers both the local-load and `installCloudBlob` paths, which spread unknown fields through) and **default at the consumer read sites** (`readSubitising…` helpers).

**Why this matters for reviewers:** the absence of these fields from `defaults.ts` / `seedStorage.ts` / the cloudSync mirror is NOT a gap against the sibling-tier checklist — it is the established precedent for scaffold counters (verified in the W10.3 cross-review, PR #369, 2026-06-11). E2e specs seed them by raw-spreading onto `profile`; per `testing-and-ci.md` §4.1.1c, a third raw-spread adopter triggers the `SeedProgressOptions` widening follow-up (2 adopters as of Wave 10).

## Mastery rule (M3)

[`mastery.ts`](MarianLearning/src/lib/progress/mastery.ts). The first PR where the app actually changes Marian's curriculum based on her performance. Pure module; the single public entry point is `applyMasteryRule(progress) → Progress`, which returns a NEW document (no mutation).

### Tree adjacency

Two ordered constants declare the curriculum graph in one place. `MATH_TREE` ([`mastery.ts:100`](MarianLearning/src/lib/progress/mastery.ts#L100)) and `LITERACY_TREE` ([`mastery.ts:121`](MarianLearning/src/lib/progress/mastery.ts#L121)) mirror the declaration order in `NumberGardenNode` / `WordSongNode`.

`focusNode.ts` keeps its own `MATH_NODES_IN_ORDER` / `WORD_SONG_NODES_IN_ORDER` copies (predates `mastery.ts`); the `mastery.test.ts` regression locks the two declarations against each other so silent drift fails CI.

`nextNode(track, current)` returns the next downstream node, or `null` when `current` is the last in the tree or doesn't appear in the named track.

### intro → practicing transition (ticket 86c9qu91g, 2026-05-13)

**Root cause confirmed via Thomas's iPhone state export:** `skillLevels['cvc-words'] === 'intro'` after 4 consecutive 100% sessions. The mastery engine previously only walked nodes at `'practicing'`; nodes stuck at `'intro'` were permanently invisible regardless of session history. Affected nodes in `defaultProgress()`: `cvc-words`, `sub-to-20`, `mult-2-5-10`, `sight-words`.

**Transition rule (runs BEFORE the practicing → mastered scan in every `applyMasteryRule` call):**

For every node whose current `skillLevels[node]` is `'intro'`: if `progress.history` contains at least one entry where `skillFocus` includes the node AND `successRate > 0`, advance the node to `'practicing'`. A session where Marian got 0/8 does NOT clear the intro gate.

**No downstream cascade:** the `locked → intro` downstream unlock only fires when a node reaches `'mastered'`, not `'practicing'`.

**Same-call traversal:** the `practicing → mastered` scan below runs against the updated `out.skillLevels`, so a node can traverse `intro → practicing → mastered` in a single `applyMasteryRule` call when history is sufficient (e.g. Thomas's iPhone self-heals on the next session-end without a manual data fix).

**Retroactive self-healing:** users with nodes stuck at `'intro'` advance on the NEXT session-end without any manual data migration, because the prior session history already satisfies the `successRate > 0` check.

#### N+1-session cascade — focus lands downstream after the mastery threshold (post-#201, 2026-05-14)

Running N+1 sessions past the mastery threshold lands the focus-node picker on the freshly-unlocked downstream node — NOT on the upstream node at `intro`. The unlock cascade fires inside the same `applyMasteryRule` pass that masters the upstream node, and the post-#201 `intro → practicing` rule then fires on that downstream node in the same call.

**Walk-through example** (`cvc-words` mastery → `cvc-words-short-o` unlock):

1. Sessions 1–N: `cvc-words` at `'practicing'`, every session has `skillFocus: ['cvc-words']` because `pickFocusNode` lands there. Threshold is `90/3` (word-song default).
2. Session N (the qualifying session): `applyMasteryRule` runs at session-end:
   - First pass: `intro → practicing` scan — no-op (everything was already at `practicing` or beyond).
   - Second pass: `practicing → mastered` — `cvc-words` qualifies, flips to `'mastered'`. The `locked → intro` downstream cascade fires in the SAME call, flipping `cvc-words-short-o` from `'locked'` to `'intro'`.
   - Third pass (post-#201): `intro → practicing` scan runs AGAIN against the updated `skillLevels`. But `cvc-words-short-o`'s `successRate > 0` check needs an entry where `skillFocus` includes it — and there isn't one yet. So it stays at `'intro'`.
3. Session N+1: `pickFocusNode` walks past `cvc-words` (`'mastered'`) and lands on `cvc-words-short-o` (`'intro'`). The session runs with `focusNode: 'cvc-words-short-o'`. At session-end, `recordProgressOnSessionEnd` writes a history entry with `skillFocus: ['cvc-words-short-o']`. Then `applyMasteryRule`'s `intro → practicing` pass finds the matching entry with `successRate > 0` and flips `cvc-words-short-o` to `'practicing'`.

**Net for the test fixture builder.** After N+1 perfect sessions on `cvc-words`, the persisted state is:

- `skillLevels['cvc-words'] === 'mastered'`
- `skillLevels['cvc-words-short-o'] === 'practicing'` (NOT `'intro'`)
- `history.tail` entry is on `cvc-words-short-o`, NOT on `cvc-words` (the session that promoted `cvc-words` from `'practicing'` to `'mastered'` was session N, which is now history.length-2; session N+1 is on the downstream node)

**Common misread.** Reading the history tail as "the entry that triggered the promotion" — it isn't. The promotion-triggering entry sits one back; the tail entry is the first downstream-node session that immediately followed. Specs that seed N+1 perfect cross-day sessions and assert `history.tail.skillFocus === ['cvc-words']` will fail; the correct assertion is `history.tail.skillFocus === ['cvc-words-short-o']`.

**Why this matters for debugging.** When triaging "the picker is on the wrong node after N+1 sessions," the chain to walk is: did the upstream node master in session N? did the downstream node unlock to `intro` in the same call? did session N+1 record on the downstream node? The intro→practicing flip on the downstream node is the third event in that chain — its absence usually means session N+1 hasn't completed yet, not that the engine is broken.

### The rule (per-track)

For every node whose current `skillLevels[node]` is `'practicing'`:

1. Filter `progress.history` to entries whose `skillFocus` includes this node.
2. If `parentSettings.crossDayEnforcement === true`, dedupe to one entry per local-time calendar day (LATEST entry wins).
3. Take the last `parentSettings.masteryThreshold[track].sessions` entries.
4. If fewer than required, no promotion.
5. If every retained entry has `successRate >= parentSettings.masteryThreshold[track].percent`, the node qualifies.

Per-track defaults (locked 2026-05-02, ticket 86c9kwvy0):

- math: 95/3 (over-practice durability hypothesis on math-fact automaticity)
- word-song: 90/3 (Pickering et al. PMC5843573 — 90% over-learning is the durable plateau; 95% buys practice time without measurable benefit, and Marian's August timeline can't afford the slack)

### Calendar-day dedupe

[`mastery.ts:417`](MarianLearning/src/lib/progress/mastery.ts#L417). Day key is computed in **local time** (`getFullYear/getMonth/getDate`), matching the streak counter's convention in `sessionHistory.ts`. Two semantics for the same `dateISO` would otherwise be observable to Marian — the streak band counts a Manila-evening + Manila-morning pair as two days while the mastery rule used to collapse them to one (UTC offset = 8h). The `slice(0, 10)` UTC-prefix shape was the pre-PR-120 implementation; under Manila (UTC+8) the 22:00–06:00 window collapsed across UTC midnight and `add-to-20`'s 3-session requirement could never accumulate. Audit: `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md` § P0.3.

### Promotion behaviour

When a node qualifies and `parentSettings.autoPromote === true`:

- Mark `node` as `'mastered'` on a fresh `skillLevels`.
- If `nextNode(track, node)` is currently `'locked'`, move it to `'intro'`. Already-`intro`/`practicing`/`mastered` downstream nodes stay (no demotion).
- Set `progress.pendingPromotion = <earliest-tree-order-node-that-promoted-this-call>` so the Hub celebration overlay fires on next mount (ticket 86c9m3brc).

When `autoPromote === false`:

- Queue `progress.pendingPromotion = node` and do NOT mutate `skillLevels`. The parent confirms (or implicitly approves by flipping `autoPromote` back to `true`) before the node is moved. If multiple nodes qualify in one call, the earliest in tree order wins (math first, then literacy; within a track, root-to-leaf order).

`pendingPromotion` is transient under `autoPromote=true`: the first call sets it, the next call's stale-clear branch ([`mastery.ts:247`](MarianLearning/src/lib/progress/mastery.ts#L247)) deletes it because the queued node is no longer `'practicing'`. The flag exists to drive a single Hub celebration; cleanup happens on the next session-end. Tests on idempotence assert on `skillLevels` shape, not on `pendingPromotion` — see header at [`mastery.ts:202`](MarianLearning/src/lib/progress/mastery.ts#L202).

### Auto-promote re-entry

If `pendingPromotion` is set AND `autoPromote === true` on entry, the rule applies the queued promotion immediately and clears the field. This lets the parent flip the toggle in Settings and have a queued promotion take effect on the next session-end.

### Graduation gate (cvc-words generalization probe)

[`mastery.ts:73`](MarianLearning/src/lib/progress/mastery.ts#L73). Graduation-gated nodes are listed in `WORD_SONG_GRADUATION_GATED_NODES` — only `cvc-words` today. For these nodes, the standard 90/3 rule is **necessary but not sufficient**: the most recent qualifying entry must additionally carry `novelPoolSuccessRate >= NOVEL_POOL_THRESHOLD` (`0.8`, [`mastery.ts:92`](MarianLearning/src/lib/progress/mastery.ts#L92)).

Per Dave's developmental review (`design/research/cvc-words-developmental-review.md` § P1.2), a 90/3 mastery threshold over a fixed 8-word canonical pool can reflect item familiarity rather than decoding ability. The novel-pool gate verifies that Marian generalises her decoding to 2–3 novel short-a words she has not seen in the canonical pool.

`isGraduationSessionPending(progress, node, track)` ([`mastery.ts:528`](MarianLearning/src/lib/progress/mastery.ts#L528)) is the predicate the planner reads at session-start to decide whether to mix novel-probe words into the 8-problem set. All four conditions must hold:

1. `node` is in `WORD_SONG_GRADUATION_GATED_NODES`.
2. `node` is currently at `'practicing'`.
3. The last `threshold.sessions` qualifying entries (cross-day-deduped) all hit `successRate >= threshold.percent`.
4. NONE of those tail entries already carries a `novelPoolSuccessRate` — i.e., graduation hasn't happened yet, or the previous attempt's novel-tagged entry has aged out.

Rule (4) is the "engine waits for canonical 90/3 to reset" guarantee from the AC. After a failed graduation (novel < 80%), the failed entry sits at the tail of the qualifying window with `novelPoolSuccessRate` set — the predicate returns false, so the next session is a regular cvc-words session. Only after `threshold.sessions` fresh non-graduation sessions push the failed entry out of the tail does the predicate flip true again.

**`WORD_SONG_GRADUATION_GATED_NODES` is intentionally `{ 'cvc-words' }` only — new sibling vowel tiers must NOT be added.** The graduation gate exists because `cvc-words` (short-a) is the _first_ CVC tier, and the novel-pool probe verifies that Marian has acquired a generalised decoding skill rather than item familiarity with the 14 canonical words. Subsequent vowel tiers (`cvc-words-short-o`, `cvc-words-short-u`, `cvc-words-short-i`, `cvc-words-short-e`) build on a generalised decoder that the `cvc-words` gate already established — they are vocabulary-extension nodes, not decoding-acquisition gates. Adding them to `WORD_SONG_GRADUATION_GATED_NODES` would impose a novel-pool graduation on tier transitions that have no novel-probe pool, no developmental justification, and no planner support. The set stays at `{ 'cvc-words' }` unless Dave's developmental review explicitly prescribes a new gate. Canon-wire PRs for new sibling tiers must NOT add the new node to this set. Verified 2026-05-13 during PR #206 (Jessica's failing-first short-e E2E spec) — adding short-e to the gated set would flip the spec from RED to GREEN for the wrong reason, silently reversing the safety net.

## Focus-node picker

[`focusNode.ts`](MarianLearning/src/lib/progress/focusNode.ts). Pure read of `skillLevels` filtered by track ordering — belongs next to the data, not in the audio-wiring layer where the `/api/claude` POST happens. Browser calls these once at session-start fetch time and ships the result on the `/api/claude` payload.

`pickFocusNode(progress, track)` walks `MATH_NODES_IN_ORDER` or `WORD_SONG_NODES_IN_ORDER` and returns the first node whose `skillLevels[node]` is anything other than `'mastered'`. Falls back to the LAST node in the track if all are mastered (won't happen in v1 — `add-to-20` and downstream are still `locked`).

`pickRecentSuccessRate(progress, track)` averages `successRate` across the last 3 history entries that touched any node in `track`. Returns `null` when zero matching entries — distinguishes "no data" from "abysmal (0.0)".

### Sibling-tier transition is in-band

When `cvc-words` (short-a) masters and `cvc-words-short-o` flips from `locked` to `intro`, the picker handles the transition with no special-case logic — it just walks past `cvc-words` (now `mastered`) and lands on `cvc-words-short-o` (now `intro`, so non-mastered). This is the entire point of the sibling-node design (per `design/word-song/short-o-pool-expansion.md` §2): subsequent vowels add nodes to the union without forcing a localStorage migration shim.

### Word-song un-clamp (planner-parser contract step 2)

The picker used to be clamped to `blending-cv` for the word-song track while the browser parser only accepted the CVC "Tap the <word>." template. PR #132 widened the parser to also accept "Read the <word>." → cvc-word; PR step 2 (ticket 86c9kxu07) widened the planner to emit that content. Picker is now safe to walk the full LITERACY_TREE — same shape as the math walker. See header comment at [`focusNode.ts:88`](MarianLearning/src/lib/progress/focusNode.ts#L88).

Untuned tier coverage today: `letter-sounds`, `digraphs`, `sight-words`, `simple-sentences` produce stub plans (planner falls back to blending-cv content with a non-error log). Future tier-content tickets refine these. The stub fallback is what makes it safe to surface those nodes from the picker in v1 — a wrong-tier walk yields a working session, not a silent screen.

## Leitner box (math facts)

[`leitner.ts`](MarianLearning/src/lib/progress/leitner.ts). Five-box spaced repetition. Pure functions only; every helper returns a new box and never mutates input (avoids React strict-mode double-invocation surprises).

| Function                         | Behaviour                                                               |
| -------------------------------- | ----------------------------------------------------------------------- |
| `findItem(box, key, target)`     | Locate an item by deep-equality of payload via caller-supplied key fn.  |
| `addItem(box, key, item)`        | Insert a new item at box 1 if not already present (by key). Idempotent. |
| `promote(box, key, target, now)` | Advance one box, capped at 5; updates `lastSeen`.                       |
| `demote(box, key, target, now)`  | Reset to box 1; updates `lastSeen`.                                     |
| `emptyLeitner()`                 | Empty box constant for fresh profiles.                                  |

Promotion rule: a correct answer advances one box (cap at 5). A wrong answer demotes back to box 1. Box 1 = seen most often; box 5 = long review.

`Progress.mathFactsLeitner` is the only Leitner box in the model — literacy uses sight-word lists later.

### M4 session-gen wiring (ticket 86c9pwgc8 — shipped)

The browser ships a compact Leitner hint on the `/api/claude` payload, the planner weights box-1 facts toward problems 4-8, and session-end promotes / demotes the per-problem facts. Three modules carry the change:

1. **Hint construction**: `buildLeitnerSessionHint(progress.mathFactsLeitner)` in [`leitner.ts`](MarianLearning/src/lib/progress/leitner.ts) flattens the box into `{a, b, op, box}[]` sorted box-ascending, capped at `LEITNER_HINT_MAX_ITEMS = 60`. Empty box → empty array.
2. **Wire surface**: `App.tsx#readProgressHintsForTrack('math')` calls the helper and ships the result on the `progress.leitner` block of the session-start payload via `prepareMathPathA`. Empty arrays are OMITTED entirely — that's the gate that keeps canon-served first sessions free of charge.
3. **Server directive**: `/api/claude` extracts + soft-validates the field via `parseLeitnerHint` (any malformed item drops the whole array). Non-empty leitner BYPASSES BOTH canon AND the in-memory cache (mirrors graduation-session bypass), forcing a live Haiku run that emits a directive into the user message — `LEITNER PRIORITY DIRECTIVE` lists facts grouped by box-level ascending and tells Haiku to forbid box-1 facts from problems 1-3 (gentle ramp) and lean into them on problems 4-8.

Active scope (v1): math + add-to-10 only. Misrouted leitner on word-song / other math nodes is silently ignored at the planner. The constraint mirrors v1's only Leitner box (math facts) and the focus node Marian is on today.

### Session-end promotion

`progressHistory.ts#applyLeitnerOutcomes` runs inside `recordProgressOnSessionEnd` whenever `surface === 'math'` AND the caller supplies `leitnerOutcomes: { fact, correct }[]`. For each outcome:

- `addItem` runs first so brand-new facts land at box 1 before the rank step (otherwise `promote` / `demote` would be no-ops on missing items per the existing `leitner.ts` contract).
- `correct === true` → `promote` (cap 5). `correct === false` → `demote` (back to box 1). `correct === undefined` → fact added at box 1, rank unchanged. The `undefined` sentinel handles screen-abandonment cases.

The screen-side wiring runs inside `Math.tsx`'s `onChipTap`: a once-per-problem latch (`firstTapRecordedRef`) records the FIRST tap's correctness against `perProblemCorrectRef`. Subsequent retry taps within the same problem don't update the array — matches the streak counter's "consecutive clean wins" semantics. The `MathSessionResult` carries the array; `App.tsx#handleMathComplete` zips it with the active math plan's facts (read from `activeMathPlanRef`) into `SessionEndPayload.mathFacts` + `perProblemCorrect`, which `SessionEnd.tsx` then converts to `LeitnerOutcome[]` for `recordProgressOnSessionEnd`.

### Latency capture (M4 — diagnostic, no consumer yet)

`SessionHistoryEntry.latencyMs?: number[]` (additive optional field, no schema bump) records per-problem first-tap wall-clock latency. Captured in `Math.tsx`:

- `chipReadyAtRef` is set to `performance.now()` in a `useLayoutEffect` keyed on `[readAloudPlayed]` (ticket 86c9q5au3 — the anchor was originally inside the read-aloud `.then()` body, see § "Anchor-moment fix history" below). The layout effect runs synchronously after React commits the render that flips the chip's `disabled` to `false`, so the latency window starts at the chip-paint moment Marian actually perceives — not microseconds earlier inside the .then() callback.
- The first chip tap that passes the read-aloud gate computes `performance.now() - chipReadyAtRef.current`, sanity-bounds the value, and writes the result into `latencyMsByProblemRef[problemIndex]`:
  - `[LATENCY_FLOOR_MS, LATENCY_CEILING_MS]` = `[250, 60_000]` ms → persisted as the raw value.
  - sub-floor (touchstart-pre-queued race producing physically-impossible reaction times) → folded to the existing `-1` "not measured" sentinel.
  - above-ceiling (user walked away — 3-minute-class values) → folded to `-1`.
- `MathSessionResult.latencyMs` ships through `SessionEndPayload.latencyMs` to `recordProgressOnSessionEnd`, which clones it onto the rolling `SessionHistoryEntry`.

`performance.now()` (monotonic clock) immunises the math against wall-clock skew during a session.

No consumer reads `latencyMs` today. M4.x work that surfaces "accurate but slow" facts to the planner is the future read site (per Dave's research deliverable §6 P3 — the counting → retrieval transition diagnostic). The future consumer can rely on every persisted entry being either in `[250, 60000]` ms or the explicit `-1` sentinel — sub-floor noise no longer pollutes the field.

#### Anchor-moment fix history (ticket 86c9q5au3, fix-PR follow-up to PR #164)

Real-iPad data 2026-05-08 (Marian's first session post-#164 deploy) showed values like `[181331, 12236, 69, 602, 654, 178, 9, 275]`. The 9 / 69 / 178 ms entries are below the human-reaction-time floor for an 8-yo on a choice-reaction task (Kail 1991 meta-analysis; Whetstone et al. 2017: empirical floor ~250-280 ms). The 181 331 ms (3 min) entry is a session-abandonment signal, not a "decision time."

Root cause: `chipReadyAtRef.current = performance.now()` ran inside the `speak().then()` callback, which fires BEFORE React schedules the `setReadAloudPlayed(true)` commit. On iPad Safari, touchstart events queued during the `disabled → enabled` transition can dispatch their click handler within microseconds of the disabled flip — so the click handler's `performance.now()` reads a value barely later than the .then()-entry timestamp.

Fix (committed in the same PR as the regression-pin tests):

1. Move the anchor capture from inside `.then()` to a `useLayoutEffect([readAloudPlayed])` block. Layout effects run synchronously after DOM mutation but before the browser paints — closest JS can get to the chip-paint event.
2. Sanity-bound the captured value at write time: sub-floor and above-ceiling collapse to `-1`. Dropped values are observable via the `-1` sentinel; the future M4.x consumer can skip them.

The Leitner promotion path was UNAFFECTED throughout this incident — it consumes `firstTapRecordedRef` (correctness), not `latencyMs`.

**Verified on real iPad 2026-05-09** post-merge of the fix-PR. Marian's session captured `latencyMs = [2475, 651, 444, 753, 285, -1, 575, 277]` — every value either in `[250, 60000]` ms or the explicit `-1` sentinel. The pre-fix sub-reaction-time shape (9 / 69 / 178 ms) did not recur.

### Slow-fact directive (M4.x — accurate-but-slow surfacing)

Follow-up to PR #164/#167. The latency capture infrastructure shipped in those PRs sat unconsumed — M4.x adds the consumer. A threshold-based predicate over `progress.history` surfaces "accurate but slow" facts (Marian gets them right reliably but answers slowly — the canary for finger-counting dependency per Dave's research § 6 P3) to the planner so Haiku can dose them in for automaticity-building practice.

#### Schema addition

`SessionHistoryEntry.mathFacts?: MathFact[]` — additive optional, no schemaVersion bump (same precedent as `latencyMs`). Math only; word-song doesn't ship it. Indexed parallel to `latencyMs`: `mathFacts[i]` is the fact problem `i` targeted, joined element-wise with `latencyMs[i]`. The aggregator can't attribute latency to a specific fact without this companion array — `skillFocus` only names the focus node, not the per-problem pair.

The `SessionEndPayload` already carries `mathFacts` (originally for Leitner promotion); M4.x extends `RecordProgressInput` and `buildEntry` in [`progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts) to forward it onto the persisted entry alongside `latencyMs`. Per-element shallow-cloned at write time; guard validates per-item shape on read (`{a, b, op}` with bounds matching the wire-side `parseLeitnerHint`).

#### Predicate

[`slowFacts.ts`](MarianLearning/src/lib/progress/slowFacts.ts) — `buildSlowFactSessionHint(progress: Progress): SlowFactHint[]` walks `history` entries, joins `mathFacts[i]` and `latencyMs[i]`, and applies a threshold predicate per fact key. Threshold defaults (tunable based on real-Marian signal — not yet calibrated):

| Constant                          | Default | Rationale                                                                                                                                                             |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SLOW_FACT_MIN_ATTEMPTS`          | 5       | Below this we don't have enough samples for a stable median.                                                                                                          |
| `SLOW_FACT_MIN_CORRECT_RATE`      | 0.8     | Below this is a Leitner-box concern (correctness gap), not a slowness concern. The Leitner directive (box-1 priority) handles it.                                     |
| `SLOW_FACT_MIN_MEDIAN_LATENCY_MS` | 5000    | 5s is the rough cut-off for "still finger-counting" on add-to-10 per Dave's research § 6 P3 — sub-2s is automatic retrieval; 2-5s is mixed; 5s+ is reliably counting. |
| `SLOW_FACT_HINT_MAX_ITEMS`        | 8       | Cap output for prompt-budget bound. Sorted median-latency-DESC, so the trim drops the least-needed.                                                                   |

The `-1` sentinel ("not measured") is excluded from BOTH the latency aggregation AND the attempts counter — a regression that counted `-1` toward attempts would inflate the threshold pass.

Active scope: math + add-to-10 only (mirrors `buildLeitnerSessionHint`). Entries on other focus nodes are skipped at the predicate level. Empty result → caller (`App.tsx#readProgressHintsForTrack`) maps to `undefined` so the wire field is omitted entirely and the canon-served free path stays active.

#### Wire shape

`progress.slowFacts: SlowFactHintItem[]` on the `/api/claude` payload. Each item:

```ts
{
  fact: { a: number; b: number; op: '+' | '-' | '*' },
  attempts: number,           // counted attempts (excludes -1 sentinels)
  correctRate: number,         // 0..1
  medianLatencyMs: number,     // computed over counted attempts only
}
```

Verbose deliberately — the planner directive composes human-readable bullet copy ("4+2 — answers ~6.2s; over 7 attempts, 100% correct.") without the server re-deriving stats.

Note on `correctRate` approximation: `SessionHistoryEntry` doesn't currently persist per-problem correctness — that lives only in `LeitnerOutcome[]` at write time and is not round-tripped onto history. For v1 we approximate per-fact correctness via the per-session `successRate`: a fact appearing in a session counts toward `correctSum` weighted by the session's overall success rate. Conservative — Marian's add-to-10 success rate is high (90%+) so the approximation rarely flips a slow fact off the list. A future tightening adds `perProblemCorrect: boolean[]` to `SessionHistoryEntry`; gated on real-Marian signal.

#### Server-side directive

[`api/_planner.ts`](MarianLearning/api/_planner.ts) — `buildSlowFactDirective(items)` produces a multi-line block in the user message. Active only on math + add-to-10 — same gating posture as Leitner. Cache-prefix invariant preserved: directive lives in user message, system prompt unchanged.

The directive's actionable rule: "Include 1 to 2 facts from the slow list above when choosing the problems for this session, mixed in with the rest of the focus-node fact pool. Prefer the shorter-latency-but-still-slow facts (closer to the counting → retrieval flip) over the deepest-counting facts." It explicitly tells Haiku these are NOT stumbles (no hint/giveAnswer presumption) — the load-bearing distinction from Leitner's box-1 priority directive.

The two directives (Leitner and slow-fact) can both fire on the same session. They don't conflict on fact selection: the Leitner box-1 predicate (low correctness, demoted to box 1 by recent wrong taps) and the slow-fact predicate (≥80% correctness) are mutually exclusive by construction.

#### Canon + cache bypass

Same posture as Leitner (and graduation-session) — a non-empty `slowFacts` field forces a bypass of both canon and the in-memory session cache, since neither is keyed on slow-fact state. See § "Canon + cache bypass posture" below for the unified table.

### Canon + cache bypass posture

Same shape as graduation-session bypass:

| Signal                            | Canon hit | Cache hit | Cache write |
| --------------------------------- | --------- | --------- | ----------- |
| No flag, no leitner, no slowFacts | served    | served    | yes         |
| `isGraduationSession=true`        | bypass    | bypass    | skipped     |
| `leitner` non-empty               | bypass    | bypass    | skipped     |
| `slowFacts` non-empty (M4.x)      | bypass    | bypass    | skipped     |

Combined: the cost surface for a Leitner-active session is one Anthropic Haiku call + 59 Azure TTS renders ≈ ~$0.0022 — same as a graduation session, capped per-IP by the existing 6/60s rate limiter.

**Developmental backing (2026-05-08):** Dave's research deliverable [`MarianLearning/design/research/add-to-10-counting-to-recall.md`](MarianLearning/design/research/add-to-10-counting-to-recall.md) (ticket `86c9pr4t8`, PR #161) ranks the M4 Leitner-session-gen wiring as the **single highest-ROI intervention** for nudging Marian's counting → retrieval transition on `add-to-10`. Spaced retrieval has the strongest meta-analytic evidence base of any candidate (Dunlosky 2013; Nature Reviews Psychology 2022 review).

## Parent settings (M2.5)

[`parentSettings.ts`](MarianLearning/src/lib/progress/parentSettings.ts). Five parent-tunable knobs. Defaults locked by Thomas on 2026-05-01.

```ts
interface ParentSettings {
  autoPromote: boolean
  sessionModePicker: 'off' | 'on'
  masteryThreshold: PerTrackMasteryThreshold
  crossDayEnforcement: boolean
  showLevelToMarian: boolean
}
```

Defaults (`DEFAULT_PARENT_SETTINGS` at [`parentSettings.ts:76`](MarianLearning/src/lib/progress/parentSettings.ts#L76)):

| Setting                         | Default                          | Notes                                                                                           |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `autoPromote`                   | `true`                           | Mastery rule mutates `skillLevels` directly.                                                    |
| `sessionModePicker`             | `'off'`                          | Engine selects mode autonomously (`'on'` shows a Marian-facing review/focus/mixed picker — M4). |
| `masteryThreshold.math`         | `{ percent: 0.95, sessions: 3 }` | Over-practice durability for math-fact automaticity.                                            |
| `masteryThreshold['word-song']` | `{ percent: 0.9, sessions: 3 }`  | Pickering et al. — 90% over-learning is the durable plateau.                                    |
| `crossDayEnforcement`           | `true`                           | PMC8164994 sleep-consolidation evidence; stays on for both tracks regardless of percent.        |
| `showLevelToMarian`             | `false`                          | M5 surfaces this.                                                                               |

### Per-track mastery threshold shape

[`types.ts:211`](MarianLearning/src/lib/progress/types.ts#L211). `PerTrackMasteryThreshold = Record<MasteryTrackKey, MasteryThreshold>` where `MasteryTrackKey = 'math' | 'word-song'`.

The shape was widened from a single `MasteryThreshold` to a per-track map on 2026-05-02 (ticket 86c9kwvy0). Backward-compat for old single-shape blobs is handled at the read path in `getSettings` — no schema bump.

### `getSettings(progress)` — the SINGLE read API

[`parentSettings.ts:99`](MarianLearning/src/lib/progress/parentSettings.ts#L99). Adaptive-engine rules MUST consult this helper rather than reaching into `progress.parentSettings` directly. Contract:

- `progress` is null/undefined → returns `DEFAULT_PARENT_SETTINGS` clone
- `progress.parentSettings` is missing → returns DEFAULT clone
- `progress.parentSettings` is partial → defaults fill every missing key (per-key, including nested `masteryThreshold`)
- `progress.parentSettings` is fully present → returns it shallow-cloned (with `masteryThreshold` cloned)

Every call returns a FRESH object — callers may mutate the result without affecting the source-of-truth defaults.

### Three input shapes accepted on `masteryThreshold`

`mergePerTrackMasteryThreshold` ([`parentSettings.ts:169`](MarianLearning/src/lib/progress/parentSettings.ts#L169)) accepts:

1. **New per-track shape** (`{ math, 'word-song' }`) — each track's value is shape-validated and per-key defaulted; missing tracks default. What fresh writes produce.
2. **Old single shape** (`{ percent, sessions }`) — pre-2026-05-02 blobs and pre-86c9kwvy0 fresh writes used a single threshold for both tracks. The legacy value is **applied to BOTH tracks** so a parent who explicitly chose 80/2 isn't silently bumped back to defaults.
3. **Malformed / null / wrong type** — fall back to per-track defaults entirely.

### Threshold presets

[`parentSettings.ts:48`](MarianLearning/src/lib/progress/parentSettings.ts#L48). Three v1 presets exposed for the Settings UI:

```ts
;[
  { percent: 0.8, sessions: 2 },
  { percent: 0.9, sessions: 3 }, // word-song default
  { percent: 0.95, sessions: 3 }, // math default
]
```

The middle preset went from 90/2 → 90/3 on 2026-05-02 to pair with the per-track defaults — both defaults are now available as presets without inventing a fourth.

## Backup export & storage persistence (PR #159)

Two layered defenses against losing Marian's progress: a runtime persistence-hint hook, and a manual-recovery escape hatch in Parent Settings.

### `useRequestPersistentStorageOnGesture`

[`src/lib/lifecycle/useRequestPersistentStorageOnGesture.ts`](MarianLearning/src/lib/lifecycle/useRequestPersistentStorageOnGesture.ts). Calls `navigator.storage.persist()` once on the first user gesture (document-level `pointerdown`, `{ once: true }` listener with a sentinel ref guard for React 19 StrictMode double-invoke). Wired in `App.tsx`.

The hook exists because browsers may evict non-persistent localStorage under storage pressure. Requesting persistence on first gesture signals that this origin's data is user-engaged.

**Platform behaviour:**

| Platform                   | Behaviour                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Chrome (desktop / Android) | Auto-grants on engagement heuristics; Promise resolves `true` quickly.                           |
| Firefox                    | Permission prompt.                                                                               |
| iOS Safari                 | Decides opaquely — no public spec for the heuristics. May resolve `true` silently or be ignored. |

**The only way to verify the grant on iOS is Safari Web Inspector → Storage → Persistent**, measured post-engagement on Marian's actual iPad. Vercel preview URLs are auth-gated; agents cannot reach them. Do not assume the Promise's resolved value as a correctness signal in jsdom or headless tests — it degrades silently.

**React 19 ref-from-prop constraint**: the implementation binds prop-derived ref values inside a `useEffect`, not during render — the React 19 `react-hooks/refs` ESLint rule blocks `ref.current = opts.value` at render time. Canonical fix pattern for that error class.

### Backup payload schema

[`src/screens/ParentSettings/ParentSettings.tsx`](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx) renders a "Backup" section: a read-only `<textarea>` containing a JSON export, plus a Copy button. This is the v1 manual-recovery path if Safari clears origin storage.

The exported payload uses a **versioned wrapper schema** distinct from the inner `Progress.schemaVersion`:

```ts
{
  kind: 'marian-tutor.backup',
  version: 1,
  exportedAtISO: string,        // ISO 8601 wall-clock at export
  progress: Progress,           // schemaVersion: 1 inside
  sessionHistory: SessionHistoryV2,
}
```

The `kind` + `version` envelope lets a future restore-from-paste UI validate provenance before installing arbitrary JSON. **Do not conflate `version: 1` here with `schemaVersion: 1` inside `progress`** — they version different schemas. Inner blob versions remain independent.

### `ParentSettingsStorage` test seams

`ParentSettingsStorage` exposes two optional seams for testing:

- `loadSessionHistory?: () => SessionHistoryV2 | null` — defaults to canonical `readSessionHistory()` in `DEFAULT_STORAGE`.
- `writeClipboard?: (text: string) => Promise<void>` — defaults to `navigator.clipboard.writeText()`. Jsdom has no `navigator.clipboard`; the seam degrades gracefully (logs "Couldn't copy" rather than throwing).

Optional typing means existing test fixtures that don't need the seams keep working without churn. Pattern worth lifting for any future ParentSettings storage features.

## Session-end write path

[`src/screens/SessionEnd/progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts). The production write path into the Progress blob — until ticket 86c9kmu63 the only callers of `saveProgress` were tests, so Marian's accumulating learning state was never being collected. M3 (ticket 86c9kmwd0) layers `applyMasteryRule` on top.

### Why the call site is in `SessionEnd.tsx`, not `App.tsx`

`SessionEnd.tsx` already owns one persistence side-effect on mount via `recordSessionEnd` (writing to `marian-tutor.session-history.v1`). Adding a sibling write to a different storage key in the same effect keeps both "session-end persistence" concerns co-located and avoids threading the payload shape through App's route-flip handler.

Note the storage-key distinction: this module writes `marian-tutor:progress:v1` (adaptive engine), while `sessionHistory.ts` writes `marian-tutor.session-history.v1` (Hub stats / streak / sessionCount). Co-located write callers, separate storage payloads.

### `recordProgressOnSessionEnd(input)`

[`progressHistory.ts:160`](MarianLearning/src/screens/SessionEnd/progressHistory.ts#L160).

```ts
interface RecordProgressInput {
  surface: SessionEndSurface
  totalCorrect: number // 0..8
  dateISO: string // ISO 8601, injected for test seam
  focusNode: SkillNode // derived via pickFocusNode at session-end mount
  graduationSplit?: GraduationSessionSplit
}
```

Steps:

1. `loadProgress() ?? defaultProgress()` — seed a fresh document if none exists.
2. Build the `SessionHistoryEntry` (branches on whether `graduationSplit` was supplied and both counts are positive).
3. Append entry, update `profile.lastPlayedISO`.
4. Run `applyMasteryRule(next)` — promotion logic, possibly setting `pendingPromotion`.
5. Single `saveProgress(promoted)` — no observable mid-state in localStorage, no double IO.

Returns the persisted document for tests; production callers ignore it.

`focusNode` is the load-bearing field. **Audit follow-up to PR #120 (M3 wiring) — P0.2 fix:** the earlier shape hardcoded `skillFocus` per `surface` (`['add-to-10']` for math, `['blending-cv']` for word-song). That worked for the very first session but silently broke M3: once `add-to-10` was promoted to `'mastered'` and the planner moved Marian onto `add-to-20`, every subsequent history entry STILL recorded `skillFocus: ['add-to-10']`, so `applyMasteryRule()` saw zero matching entries for `add-to-20` and could never promote it. The promotion chain capped after the first hop. The caller now derives this via `pickFocusNode(loadProgress() ?? defaultProgress(), trackForSurface)` at session-end mount — same function the App.tsx fetch effects use at session-start, and because `applyMasteryRule()` only runs at session-end, `skillLevels` at session-end mount are identical to what they were at session-start.

### `GraduationSessionSplit`

[`progressHistory.ts:75`](MarianLearning/src/screens/SessionEnd/progressHistory.ts#L75):

```ts
interface GraduationSessionSplit {
  canonicalCorrect: number
  canonicalCount: number // 5 or 6
  novelCorrect: number
  novelCount: number // 2 or 3
}
```

Caller decides whether to supply this by reading `isGraduationSessionPending(loadProgress(), focusNode, track)` BEFORE recording the new entry. When supplied AND both counts are positive:

- Recorded entry's `successRate = canonicalCorrect / canonicalCount`
- Recorded entry gains `novelPoolSuccessRate = novelCorrect / novelCount`

When omitted or one count is 0: legacy `totalCorrect / 8` shape, no `novelPoolSuccessRate`. The defensive zero-handling protects against an upstream bug computing a 0-count slice — better to under-promote than feed garbage into the mastery rule.

## E2e returning-user seed pattern — `buildSeedSessionHistory({ sessionCount: 5 })`

E2e specs that need to start on the Hub (skipping the first-ever Greet path) seed `sessionCount: 5` via [`buildSeedSessionHistory`](MarianLearning/e2e/_helpers/seedStorage.ts) and pass it to `seedLocalStorage(page, { sessionHistory })`. The Splash advance handler ([App.tsx:290-308](MarianLearning/src/App.tsx#L290-L308)) routes `sessionCount === 0 → greet` and `sessionCount ≥ 1 → hub`, so any non-zero seed lands the spec on Hub.

**Canonical example:**

```ts
await seedLocalStorage(page, {
  progress: buildSeedProgress({ skillLevelOverrides: { ... } }),
  sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
})
await page.goto('/')
await forceHowlerUnlock(page)
await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
```

**Universal-seed fragility warning.** This seed pattern is the load-bearing precondition for _every_ returning-user e2e spec in the repo (audit-9 from the `forceHowlerUnlock` audit, plus the `leitner-directive-injection` / `slow-fact-directive-injection` specs from the 2026-05-16 follow-up audit, plus the broader CVC / digraph content specs that don't directly need it but use it for harness uniformity). If a future regression breaks the `sessionCount`-based Splash routing — predicate moves to a different field, threshold changes from `≥ 1` to something else, the seed key migrates, the SessionHistory schema bumps and the seeder's blob no longer round-trips through the type guard — **every spec using this seed fails together**. Triage will chase N false leads (looks like "all my spec changes broke things") before recognising the shared root cause is the Splash router.

If you change `handleSplashAdvance` or the `SessionHistoryV2` schema, the same change MUST update `buildSeedSessionHistory` in lockstep, and confirm at least one returning-user spec runs green locally before committing. The seeder mirror is silent: there is no type relation between the route predicate and the seed shape that would surface drift at compile time. (Lift from `feedback_no_fabrication.md` discipline: the cost of pinning this here once is low; the cost of a stuck-spec triage cascade chasing the wrong PR is high.)

## Debug-seed integration

[`src/lib/debug/debugSeed.ts`](MarianLearning/src/lib/debug/debugSeed.ts). One-shot localStorage seeder for QA / iPad ear-test workflows. When the URL has `?debug=1&seed=<value>`, this module pre-populates the Progress + SessionHistory blobs so a fresh browser can deep-launch into a specific learning state.

`?debug=1` is the gate — the same predicate that drives `DebugOverlay`. Marian's normal app-open never sets it. `maybeApplyDebugSeed()` runs at module-load time (before the React tree imports), mirroring the `disableHowlerAutoSuspend()` pattern at the top of `App.tsx`. This guarantees the seed lands BEFORE any `useState(loadProgress)` initialiser, `getInitialRoute()`, or `nextAfterSplash()` runs.

### Type-driven schema sharing (post 2026-05-02 rework)

The original 2026-05-02 implementation hand-mirrored the on-disk shape (`{version: 2, sessions: [...]}`) — wrong format for the canonical reader (which expects a flat `SessionHistoryV2` with `schemaVersion: 2`), so the reader fell back to `emptySessionHistory()` with `sessionCount: 0`, defeating the skip-Greet behaviour. Thomas caught the regression on iPad. The rework imports `SessionHistoryV2`, `emptySessionHistory()`, `writeSessionHistory()`, `defaultProgress()`, and `saveProgress()` from the canonical modules so schema drift becomes a TypeScript error, not a silent runtime bug. **No import cycle:** the canonical modules do not import anything under `lib/debug/` (verified 2026-05-02 with a one-way grep before the rework).

### Recognized seeds

[`debugSeed.ts:187`](MarianLearning/src/lib/debug/debugSeed.ts#L187). Seven today:

| Seed value                   | skillLevels patch                                                                                                                                                                                                           | History seed                                    | Skip Greet |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| `cvc-words`                  | `letter-names/letter-sounds/blending-cv` → `mastered`; `cvc-words` → `practicing`                                                                                                                                           | —                                               | yes        |
| `cvc-words-graduation-ready` | same as above                                                                                                                                                                                                               | 3 cross-day cvc-words entries at 100% canonical | yes        |
| `cvc-words-short-o`          | `letter-names/letter-sounds/blending-cv/cvc-words` → `mastered`; `cvc-words-short-o` → `practicing`                                                                                                                         | —                                               | yes        |
| `cvc-words-short-u`          | all preceding + `cvc-words-short-o` → `mastered`; `cvc-words-short-u` → `practicing`                                                                                                                                        | —                                               | yes        |
| `cvc-words-short-i`          | all preceding + `cvc-words-short-u` → `mastered`; `cvc-words-short-i` → `practicing`                                                                                                                                        | —                                               | yes        |
| `cross-vowel-mixing`         | all four CVC vowel tiers + preceding word-song nodes → `mastered`; `digraphs` → `practicing` (focus lands on digraphs, not a CVC tier — see `screens-and-flows.md` for the predicate-true-but-chips-don't-render rationale) | —                                               | yes        |
| `add-to-20`                  | `number-recog/add-to-10` → `mastered`; `add-to-20` → `practicing` (math track)                                                                                                                                              | —                                               | yes        |

Adding a new seed: extend `SEEDS`. Each entry declares the `skillLevels` patch and whether to skip Greet. **Mark ALL preceding nodes in the relevant track as `'mastered'`** — `pickFocusNode()` walks left-to-right in declaration order and stops at the first non-mastered node, so a half-patched track lands on the wrong focus.

### Idempotency

Reload-safe.

- For progress: applying the same skillLevels patch a second time short-circuits via the `changed` flag in `applySkillLevelsPatch` ([`debugSeed.ts:275`](MarianLearning/src/lib/debug/debugSeed.ts#L275)).
- For session-history: `bumpSessionCountIfZero` only writes when the existing `sessionCount` is 0. A real returning user with `sessionCount > 0` is never displaced — the seeder MUST NOT overwrite Marian's actual progress on a real device that happens to load a `?debug=1&seed=...` URL.

History-seed application is non-idempotent (a second invocation appends again). Acceptable for a debug fixture — testers re-launch on a fresh storage clear.

## Cloud sync (PR #160 — ticket 86c9pkfyu)

> **Merged 2026-05-08 (commit `647d797`).** iPad smoke-tested by Thomas: Push now → cloud round-trip → Restore-on-second-device all worked.

T2 of the "make Marian's progress survive future updates and iPad-loss" arc. localStorage stays the **source of truth**; the cloud is a best-effort backup keyed by a per-device UUID so a dropped iPad / app deletion / factory reset is recoverable.

### Wire shape

`/api/progress` (Vercel Function, Node runtime):

| Method                 | Body / params                         | Response                                                                  |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `GET ?deviceId=<uuid>` | —                                     | 200 `{ ok: true, blob, lastModifiedISO }` or 404 `{ error: 'not-found' }` |
| `POST`                 | `{ deviceId, blob, lastModifiedISO }` | 200 `{ ok: true }`                                                        |

Both require `Authorization: Bearer <PROGRESS_API_SECRET>`. The browser sends `VITE_PROGRESS_API_SECRET` from the Vite env — yes, it ships in the bundle. The protection model is "make casual abuse non-trivial," NOT zero-trust auth. Acceptable per ticket lock; if the blob ever carries sensitive data, swap to magic-link auth.

KV backing: **Upstash Redis** via `@upstash/redis` SDK with `Redis.fromEnv()`. Vercel KV is being deprecated under the Marketplace migration; Upstash is the canonical replacement and exposes the same `KV_REST_API_URL` / `KV_REST_API_TOKEN` env-var pair for compatibility. Path: `progress:<uuid>`.

### Per-deviceId rate limit

60 GET/min, 30 POST/min, keyed by `deviceId` (NOT IP). Reuses the `_rateLimit.ts` sliding-window deque module — same shape as `/api/claude`'s 6 calls / 60 s. **Per-deviceId keying is deliberate**: iPads behind shared NAT (school WiFi later) MUST NOT collide. Two separate limiter instances (GET + POST) so a chatty boot-reconcile never starves a legitimate session-end push.

Cold containers reset the buckets — that's acceptable given the threat model, mirroring the `/api/claude` posture.

### Browser surface

[`MarianLearning/src/lib/progress/deviceId.ts`](MarianLearning/src/lib/progress/deviceId.ts) generates + persists the UUID under `marian-tutor:device-id`. `crypto.randomUUID()` (iOS Safari 15.4+) with a Math.random fallback for older browsers. `isValidUuid` is the public predicate the Restore-from-device-id flow runs against parent paste input.

[`MarianLearning/src/lib/progress/cloudSync.ts`](MarianLearning/src/lib/progress/cloudSync.ts) exposes three callables — none ever throw:

- `pushProgressToCloud(deviceId, progress, opts?)` → `'sent' | 'failed' | 'skipped'`. Used by `progressHistory.ts:recordProgressOnSessionEnd` as fire-and-forget after every save. Failures land as `console.warn`. `'skipped'` means `VITE_PROGRESS_API_SECRET` was unset — the local save still succeeded.
- `fetchProgressFromCloud(deviceId, opts?)` → `{kind:'found',...} | {kind:'not-found'} | {kind:'error',...}`. 3 s timeout via `AbortController`. 404 is the **normal** first-launch case, not an error.
- `reconcileWithCloud(deviceId, currentLocal, opts?)` → structured `ReconcileOutcome`. Boot-time reconcile.

### Boot-time reconcile

App.tsx fires `reconcileWithCloud` once per app mount in a `useEffect` (right after the persistent-storage hook). Decision tree:

1. Cloud GET errors / times out → log warn, proceed with local (no-op).
2. Cloud says 404 → push local to cloud if local exists, else no-op (genuine first launch).
3. Cloud has a record:
   - Local has no `lastPlayedISO` → cloud wins (install).
   - Cloud's `lastModifiedISO` > local's `profile.lastPlayedISO` → cloud wins (install).
   - Local's `lastPlayedISO` > cloud's `lastModifiedISO` → local wins (push).
   - Equal → no-op.
4. On cloud-wins install: blob runs through `withDefaultedSkillLevels` (T1 read-path defaulter) BEFORE `isProgressV1`. This heals older-schema cloud blobs (e.g. one device on schema with `cvc-words-short-o`, the other not yet) before install. Validation-fail ⇒ `cloud-blob-rejected`, local kept.

The reconcile NEVER blocks UI — the entire React tree boots in parallel and the worst case is a delayed install AFTER Splash → Greet/Hub. App.tsx refreshes `hubProgressSnapshot` post-install so any active Hub render re-projects.

### Source-of-truth invariant

localStorage is authoritative; cloud is a backup. A failed cloud op NEVER blocks Marian. Concurrent writes are last-write-wins on the cloud side — that's safe because the cloud is a backup, not the operative state.

### Schema floor at install time

`cloudSync.ts` replicates `storage.ts:withDefaultedSkillLevels` 1:1 in a private function (`installCloudBlob` runs the defaulter before the strict guard). Replication rather than import — the storage adapter's defaulter is file-local. **If either drifts, the cloud-installed blob and the locally-loaded blob would default different keys, which is exactly the four-place-sync hazard T1 was supposed to prevent.** The cloudSync test pins the parity (`withDefaultedSkillLevels parity` test); add a regression test if a future change touches the storage version.

### Parent Settings — Cloud Backup section

A new `<section data-testid="parent-settings-cloud-backup">` below the existing Backup section in `ParentSettings.tsx`:

- **Device ID** — read-only display + Copy button. Uses `getOrCreateDeviceId()` so it shows even if the boot reconcile hasn't run yet.
- **Last synced** — reads `progress.profile.lastPlayedISO` (the value the session-end push stamps). "Never" when null.
- **Push now** — manual fire of the same POST `recordProgressOnSessionEnd` runs automatically. Useful for debugging.
- **Restore from device ID** — paste a UUID, validate, run `reconcileWithCloud(uuid, loadProgress())`. Cloud-newer → install + UI refresh.

`ParentSettingsStorage` gained three optional seams (`getDeviceId`, `pushNow`, `restoreFromDeviceId`) so tests don't touch the network. Defaults wire to the canonical helpers.

### Files in play

Server:

- [`MarianLearning/api/progress.ts`](MarianLearning/api/progress.ts) — handler.
- [`MarianLearning/api/_progressStore.ts`](MarianLearning/api/_progressStore.ts) — KV wrapper.
- [`MarianLearning/api/progress.test.ts`](MarianLearning/api/progress.test.ts) — 24 tests.

Browser:

- [`MarianLearning/src/lib/progress/deviceId.ts`](MarianLearning/src/lib/progress/deviceId.ts) + `.test.ts` (10 tests).
- [`MarianLearning/src/lib/progress/cloudSync.ts`](MarianLearning/src/lib/progress/cloudSync.ts) + `.test.ts` (22 tests).
- [`MarianLearning/src/App.tsx`](MarianLearning/src/App.tsx) — boot-time reconcile effect.
- [`MarianLearning/src/screens/SessionEnd/progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts) — fire-and-forget after save.
- [`MarianLearning/src/screens/ParentSettings/ParentSettings.tsx`](MarianLearning/src/screens/ParentSettings/ParentSettings.tsx) — Cloud Backup section + 8 new tests.

Config:

- [`MarianLearning/.env.example`](MarianLearning/.env.example) — KV/Upstash + secret env vars.
- [`MarianLearning/package.json`](MarianLearning/package.json) — `@upstash/redis ^1.38`.

## Cross-references

- Source files: [`MarianLearning/src/lib/progress/`](MarianLearning/src/lib/progress/), [`MarianLearning/src/screens/SessionEnd/progressHistory.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.ts), [`MarianLearning/src/lib/debug/debugSeed.ts`](MarianLearning/src/lib/debug/debugSeed.ts).
- Tests: [`mastery.test.ts`](MarianLearning/src/lib/progress/mastery.test.ts), [`focusNode.test.ts`](MarianLearning/src/lib/progress/focusNode.test.ts), [`parentSettings.test.ts`](MarianLearning/src/lib/progress/parentSettings.test.ts), [`progress.test.ts`](MarianLearning/src/lib/progress/progress.test.ts), [`progressHistory.test.ts`](MarianLearning/src/screens/SessionEnd/progressHistory.test.ts).
- Skill-tree content: see [`skill-trees-and-content.md`](skill-trees-and-content.md) for the curriculum graph, word packs, distractors, and session plans.
- Diagnostic baseline: `project_diagnostic_results` auto-memory + `CLAUDE.md` `## Marian's current levels`.
- Sibling-node design rationale: `design/word-song/short-o-pool-expansion.md` §2.
- Spec drift decisions (G/H/K/L/M, locked thresholds): `project_spec_drift_decisions` auto-memory.
- Out of scope here: app entry / route state machine (Agent A's `architecture-overview.md`), per-screen lifecycle (Agent A's `screens-and-flows.md`), audio system (Agent B's `audio-system.md`), planner / canon (Agent B's `planner-and-canon.md`).
