# Wave 9 — Literacy continuation: per-vowel `letterSoundsVowelStates`

**Status:** plan — pre-dispatch
**Date drafted:** 2026-05-24
**Author:** Matt (planning role; orchestrator dispatches)
**Sponsor decision:** Wave 9 = literacy continuation (Thomas, 2026-05-24, accepting Wave 7 retro / Wave 8 sequencing).
**Foundation:** parent ticket `86c9y5d9x` (filed 2026-05-23 alongside Q4 resolution); Kyle A5 spec `design/word-song/letter-sounds-content.md` §5.3 Option A + §6 + §1.4 + §1.2; Wave 7 retro `retro-2026-05-23-wave-7-literacy-bookend-shipped.md`; `[[feedback_track_based_wave_decomposition]]`; `[[feedback_no_sponsor_as_expert]]`; `[[feedback_progression_e2e_mandatory]]`.

---

## TL;DR

Wave 9 closes the open Wave 7 deferral on letter-sounds. Wave 7 shipped **Option B composite-tier mastery** for letter-sounds (the simpler shape that fit the Wave 7 ship window). Wave 9 ships **Option A per-vowel sub-mastery** — the pedagogically correct shape per Dave's memo (anchored to `phonics-sequence-marian.md` §Q1 + Kyle A5 §5.3).

The core change: add `progress.literacy.letterSoundsVowelStates: { '/o/' | '/u/' | '/i/' | '/e/': 'intro' | 'practicing' | 'mastered' }` and convert Kyle A5 §1.2 constraint #2 (the cross-session `/i/ → /e/` adjacency ban) from a Wave-7 directive-level approximation into a **hard runtime gate** on `letterSoundsVowelStates['/i/'] === 'mastered'`.

The wave has **5 tickets** across **5 tracks** (spec / progress-shape / mastery-rule / planner-integration / E2E). One ticket is a markdown-only spec hygiene pass (Kyle, parallel-dispatchable); the other four form a dependency chain (Kevin types → Devon mastery → Kevin planner → Jessica E2E) with Jessica's failing-first authoring possible in parallel.

This is a **progress-shape migration** wave — biggest blast radius since PR #160 (cloud-sync) and PR #243 (lifetime-first-encounter gate). Both precedents established the "additive optional field + read-path defaulter + cloudSync parity test" pattern this wave reuses verbatim. No new SkillNode literal added; no v1→v2 schema bump.

Math pivot (subitising / sub-to-20 directive sharpening) and digraphs-ch / digraphs-th literacy continuation are explicitly **deferred to Wave 10+**. The `/i/ → /e/` runtime gate is the single load-bearing pedagogical fix this wave; everything else rides on it.

---

## Scope

### Drives

1. **Convert Wave 7's Option B approximation into Option A enforcement.** The cross-session `/i/ → /e/` adjacency ban currently lives in the planner's directive prose (turn-order + ≥2-session-gap rule). Migrate it to a state predicate — `letterSoundsVowelStates['/i/'] === 'mastered'` — so the engine refuses to introduce `/e/` adjacent to a non-mastered `/i/` regardless of how Marian's session cadence ends up.
2. **Per-vowel sub-mastery surfaces stuck vowels.** Under Option B, a struggling `/ɪ/` is invisible to the engine; the composite-tier 90/3 measures whole-pool accuracy and Marian could mass `/ɛ/` while `/ɪ/` stays at 4/8. Under Option A, `letterSoundsVowelStates['/i/']` stays at `'practicing'` until that vowel specifically hits 90/3, giving the engine + orchestrator visibility to dispatch targeted intervention if a vowel sticks (per Kyle §5.4 risk mitigation).
3. **Establish per-sub-skill state as a reusable pattern.** This is the first per-sub-skill granularity below the SkillNode level. The shape (`progress.literacy.<tierKey>States`) generalises to any future tier that wants sub-tracking (e.g. digraphs-th by `phoneme === /θ/ vs /ð/`, if voiced-th ever ships; cvc-words by `pictureKey === <novel-probe-word>` if novel-probe per-word tracking is added). Establishing the shape with discipline this wave pays forward.

### Success criteria

- All 5 wave tickets shipped to main with green CI (fast-gate: typecheck + lint + canon-lint + vitest; e2e: Playwright chromium + webkit).
- `progress.literacy.letterSoundsVowelStates` field present on `Progress` with full defaulter + cloudSync parity (W9.2).
- `applyMasteryRule` correctly promotes per-vowel + tier-composite (W9.3); regression-pin test for composite-tier fallback when field absent.
- `letter-sounds.json` carries `bakeMetadata.perVowelTrackingActive: true` (W9.3).
- `api/_planner.ts` letter-sounds directive consumes `letterSoundsVowelStates` + emits `currentTargetVowel` per Kyle §1.4 algorithm; canon + cache bypass when non-fallback state present (W9.4).
- Failing-first E2E spec covers all 5 per-vowel transitions + composite fallback (W9.5); assertion-sensitivity sub-test included per Wave 7 retro Pattern 3.
- `letter-sounds-content.md` reflects Option A as the ship target (W9.1).

### Ship target

Wave 9 closure within ~2-3 dispatch arcs (1-2 days of orchestration). Larger scope than Wave 8 — this is a progress-shape migration with a dependency chain (W9.2 → W9.3 → W9.4 → W9.5 green) — but smaller scope than Wave 7's 10-PR arc.

---

## Ticket inventory

### Primary

| #     | Ticket          | Title                                                                                                   | Assignee | Track             |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------- | -------- | ----------------- |
| —     | **86c9y5d9x**   | Wave 9 (parent): Option A per-vowel `letterSoundsVowelStates` for letter-sounds tier                    | (epic)   | (parent)          |
| W9.1  | **86c9ya3dk**   | Spec refresh — lock §5.3/§6/§1.4 to Option A predicate in `letter-sounds-content.md`                    | Kyle     | spec              |
| W9.2  | **86c9ya3gd**   | Progress shape — add `letterSoundsVowelStates` field + types + read-path migration + cloudSync parity   | Kevin    | progress-shape    |
| W9.3  | **86c9ya3m6**   | Mastery rule — per-vowel M3 branch + bake-metadata flag in `letter-sounds.json`                         | Devon    | mastery-engine    |
| W9.4  | **86c9ya3r9**   | Picker / planner integration — `/i/ → /e/` runtime gate via `letterSoundsVowelStates` predicate         | Kevin    | planner-wire      |
| W9.5  | **86c9ya3vk**   | Failing-first E2E — per-vowel transitions + `/i/ → /e/` gate + composite fallback                       | Jessica  | e2e               |

### Documentation (orchestrator at retro / maintain-docs time)

W9.6 — Update `.claude/docs/progress-and-persistence.md` with the new `progress.literacy.letterSoundsVowelStates` section. This is **not a ticket**; the `maintain-docs` Stop hook will elevate it organically after the W9.2 + W9.3 PRs land. If maintain-docs misses it, the orchestrator opens a one-line doc PR at retro time.

### Out of scope for Wave 9

- No new SkillNode literals.
- No `letter-sounds.json` utterance content re-bake (only `bakeMetadata.perVowelTrackingActive` flag is added).
- No `letter-names` per-letter sub-mastery (d9x out-of-scope explicit).
- No first-time-experience iPad smoke for letter-sounds (a parallel candidate to W8.5's letter-names smoke — deferred unless capacity allows mid-wave).
- No sub-to-20 directive sharpening / math pivot (Wave 10 candidate per Wave 7 retro Open call thread 2).
- No digraphs-ch / digraphs-th content tiers (Wave 10 candidate per Wave 7 retro Open call thread 1).
- No sight-words tier (Wave 11+ per CLAUDE.md skill-tree order).
- No simple-sentences tier (Wave 11+).

---

## Track recommendations (grouped by surface)

Per `[[feedback_track_based_wave_decomposition]]` — tracks reflect the file/system surface each ticket touches, making parallel-author conflict prediction explicit.

### Track 1 — Spec (Kyle)

- **W9.1 (86c9ya3dk)** — Markdown-only spec hygiene. Touches `design/word-song/letter-sounds-content.md` exclusively.
- No code, no conflicts with any other track. Dispatchable **immediately and in parallel** with W9.2.
- Mergeable orchestrator-direct per `[[feedback_pr_review_routing]]` (Dave research-PR precedent for markdown-only changes).

### Track 2 — Progress shape (Kevin)

- **W9.2 (86c9ya3gd)** — Additive optional field + type guard + read-path defaulter + cloudSync mirror + parity test.
- Touches `src/lib/progress/types.ts`, `defaults.ts`, `guards.ts`, `storage.ts`, `cloudSync.ts` + tests + `e2e/_helpers/seedStorage.ts`.
- Precedent: PR #160 (`withDefaultedSkillLevels` + cloudSync), PR #243 (lifetime-first-encounter gate).
- **No conflict surface** with W9.1 (different files), with W9.3 (Devon reads W9.2's types but doesn't edit them), with W9.4 (Kevin reads on a different commit), or with W9.5 (Jessica seeds via the helper W9.2 widens).

### Track 3 — Mastery engine + canon metadata (Devon)

- **W9.3 (86c9ya3m6)** — Per-vowel M3 branch in `mastery.ts` + `SessionHistoryEntry.currentTargetVowel` + bake-metadata flag in `letter-sounds.json`.
- Touches `src/lib/progress/mastery.ts`, `types.ts` (additive field), `guards.ts` (validator widening), `src/screens/SessionEnd/progressHistory.ts`, `public/canon/word-song/level-1/letter-sounds.json` (one-line bake-metadata).
- **Hard dependency on W9.2.** Devon can author against the unmerged W9.2 branch (cross-worktree detach-checkout per testing-and-ci.md §2.4.2 (a)) for tightness, but the merge order is W9.2 first.
- **Predicted rebase conflict surface:** `types.ts` if Kevin's W9.2 PR added new fields above the `SessionHistoryEntry` block — mechanical merge per `[[feedback_sibling_tier_rebase_mechanical]]`, accept both additions.

### Track 4 — Planner wire + directive (Kevin)

- **W9.4 (86c9ya3r9)** — Browser ships field on `/api/claude` payload; server's letter-sounds directive consumes field + emits `currentTargetVowel` per Kyle §1.4 algorithm; canon + cache bypass rule extended; response carries derived vowel for the session-end write loop.
- Touches `src/App.tsx readProgressHintsForTrack`, `api/_planner.ts` (letter-sounds directive block + new `parseLetterSoundsVowelStates` soft-validator), `api/_planner.test.ts`, possibly `api/_session.ts`.
- **Hard dependency on W9.2 + W9.3.** W9.2 provides the wire shape; W9.3 provides the `currentTargetVowel` write-path on the session-end side.
- **Predicted rebase conflict surface:** `api/_planner.ts` `WORD_SONG_TRACK_GUIDE` block — same shape as Wave 7's sibling-tier conflicts; resolve via `[[feedback_sibling_tier_rebase_mechanical]]`.

### Track 5 — E2E (Jessica)

- **W9.5 (86c9ya3vk)** — Failing-first spec covering 5 progression behaviours + assertion-sensitivity sub-test.
- Touches `e2e/letter-sounds-per-vowel-progression.spec.ts` (NEW), `e2e/_helpers/mockClaude.ts` (extension for per-vowel canon-bytes mock).
- **Soft dependency on W9.2** (Jessica can author RED in parallel — the spec text references the field shape before code lands per `.claude/docs/testing-and-ci.md` §4.1.1a typing-contract precedent).
- **Hard dependency for GREEN on W9.3 + W9.4** — Jessica's attestation is "I stacked W9.2+3+4 locally and got GREEN; here's the commit SHA."
- Per `[[feedback_failing_first_must_prove_green]]`: the spec must prove it can be MADE GREEN, not just verified RED. The Wave 7 retro Pattern 3 assertion-sensitivity sub-test is the load-bearing inclusion.
- Per `.claude/docs/testing-and-ci.md` §4.1.1d + §4.1.1e: the spec uses canon-bytes mocking and positive discriminators on captured request bodies — NOT `failNetwork: true` with negative-membership assertions.

---

## Sequencing

### Round 1 (immediate parallel dispatch)

```
W9.1 Kyle  spec refresh    (parallel — no code deps)
W9.2 Kevin progress shape  (foundation — must merge first for code chain)
W9.5 Jessica E2E author RED (parallel — references types in W9.2 before merge)
```

Three agents in flight from the start. Kyle and Jessica are not blocked on Kevin; Kyle is markdown-only, Jessica authors RED against the unmerged W9.2 branch and validates the typing-contract precedent.

### Round 2 (fires when W9.2 merges)

```
W9.3 Devon mastery rule    (needs W9.2 types + defaulter merged)
```

Round 2 is a single dispatch; Devon's PR pairs with the W9.2 baseline. Kevin reviews per `[[feedback_pr_review_routing]]`.

### Round 3 (fires when W9.3 merges)

```
W9.4 Kevin planner wire    (needs W9.3 SessionHistoryEntry shape + bake-metadata flag)
```

Round 3 is also a single dispatch. Devon reviews per the cross-pair rule.

### Round 4 (fires when W9.4 merges)

```
W9.5 Jessica E2E GREEN attestation + merge
```

Jessica's RED spec from Round 1 is now backed by the full W9 stack on main. She runs her local stack-verify, posts the GREEN attestation comment with commit SHA, Devon reviews, orchestrator merges.

### Dispatch density

- Peak in-flight: 3 agents (Kyle + Kevin + Jessica in Round 1).
- Median in-flight: 1-2 (single-dispatch rounds in 2/3/4).
- Per `[[feedback_dispatch_density_vs_gate]]`: gate-actor is CI for all four code rounds, so density matches the chain depth. No Thomas surface for any of the rounds — all CI/peer-review gated.

### Conflict surface

| File                                           | Touched by    | Conflict risk                                                                                              |
| ---------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `design/word-song/letter-sounds-content.md`    | W9.1          | None — only Kyle's branch                                                                                  |
| `src/lib/progress/types.ts`                    | W9.2, W9.3    | **Predictable** — both add new types; W9.3 rebases onto W9.2 (sibling-tier mechanical resolve)             |
| `src/lib/progress/guards.ts`                   | W9.2, W9.3    | **Predictable** — both extend `isProgressV1`; W9.3 rebases onto W9.2 (mechanical resolve)                  |
| `src/lib/progress/mastery.ts`                  | W9.3          | None — sole editor                                                                                          |
| `src/lib/progress/storage.ts`                  | W9.2          | None — sole editor                                                                                          |
| `src/lib/progress/cloudSync.ts`                | W9.2          | None — sole editor                                                                                          |
| `src/lib/progress/defaults.ts`                 | W9.2          | None — sole editor                                                                                          |
| `src/screens/SessionEnd/progressHistory.ts`    | W9.3          | None — sole editor                                                                                          |
| `src/App.tsx`                                  | W9.4          | None — sole editor                                                                                          |
| `api/_planner.ts`                              | W9.4          | None this wave — but a math-pivot Wave 10 ticket would conflict on the same letter-sounds-adjacent block   |
| `public/canon/word-song/level-1/letter-sounds.json` | W9.3       | None — sole editor (one-line `bakeMetadata` addition)                                                       |
| `e2e/_helpers/seedStorage.ts`                  | W9.2          | None — Jessica's W9.5 spec consumes the helper but doesn't edit it; W9.2's widening lands the field        |
| `e2e/letter-sounds-per-vowel-progression.spec.ts` | W9.5       | None — NEW file                                                                                             |
| `e2e/_helpers/mockClaude.ts`                   | W9.5          | None — extension only                                                                                       |

**Net:** Wave 9 has **two predictable inter-ticket conflicts** (`types.ts` + `guards.ts`, both W9.2 ↔ W9.3 on the linear chain). The conflicts are mechanical sibling-tier rebases per `[[feedback_sibling_tier_rebase_mechanical]]`; the orchestrator resolves in-lane on Devon's rebase (accept both additions, no semantic merge call required).

---

## Peer-review pairs

Per `[[feedback_pr_review_routing]]` + Wave 7 retro Pattern B (10/10 routing-correct):

| Ticket | Author  | Reviewer | Routing rule                                                                                                              |
| ------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| W9.1   | Kyle    | (none — markdown-only direct merge) | Dave research-PR / spec-only precedent — orchestrator merges direct after CI fast-gate passes        |
| W9.2   | Kevin   | Devon    | Standard Kevin↔Devon cross-pair                                                                                            |
| W9.3   | Devon   | Kevin    | Standard Kevin↔Devon cross-pair                                                                                            |
| W9.4   | Kevin   | Devon    | Standard Kevin↔Devon cross-pair                                                                                            |
| W9.5   | Jessica | Devon    | Jessica's specs route to Devon for objective layout/numeric assertions per `[[feedback_jessica_audio_visual_gate_narrowed]]` |

No Thomas-surface routing predicted. The wave is mechanical infrastructure + pedagogically-locked predicate; no SSML/utterance-text changes (W9.3 only touches `bakeMetadata`, not utterance text), no subjective-visual surface, no real-iPad-only behaviour. If a Thomas surface emerges mid-wave (e.g. an unexpected audio path change), the orchestrator routes per the load-bearing-gates list in `matt.md` step 6.

---

## Risk register

Mechanical risks dominate; one pedagogical surface.

| #   | Risk                                                                                                                                                                         | Mitigation                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Progress-shape migration silently regresses Marian's existing state.** The W9.2 defaulter must run BEFORE `isProgressV1` validation; a reversed order silently wipes progress (PR #151 lesson). | Acceptance criteria pin the ordering invariant in `loadProgress()`. Schema-floor coverage test in `storage.test.ts` extended to cover the new field. cloudSync parity test mirrors the storage-side defaulter. Three regression layers; same shape PR #160 + #243 used successfully. |
| R2  | **`letterSoundsVowelStates` absent on a real iPad load** (forward-compat).                                                                                                   | Two layers: the W9.2 read-path defaulter fills the field on first read; the W9.3 fallback path runs Wave-7 composite-tier 90/3 when the field is absent. Pinned with regression tests in `mastery.test.ts`. cloudSync round-trip preserves the field on re-install.                                                                                              |
| R3  | **Conflict on `types.ts` + `guards.ts` between W9.2 and W9.3.**                                                                                                              | Predicted at planning time. Devon rebases per `[[feedback_sibling_tier_rebase_mechanical]]` — accept both additions, no semantic merge call required. Orchestrator resolves in-lane if needed.                                                                                                                                                                            |
| R4  | **W9.5 E2E timeout sizing.** Multi-session progression specs systematically blow Playwright's default 90s budget per `.claude/docs/testing-and-ci.md` §4.1.1b.                | W9.5 acceptance criteria explicit: `test.setTimeout(240_000)` minimum (3+ sessions × 50s + headroom). Same precedent as PR #206 (short-e progression spec).                                                                                                                                                                                                                |
| R5  | **W9.5 trivially-green trap.** Per `.claude/docs/testing-and-ci.md` §4.1.1d + §4.1.1e: `failNetwork: true` + negative-membership assertions pass for the wrong reason.       | W9.5 acceptance criteria pin canon-bytes mocking + positive discriminators on captured request bodies. The assertion-sensitivity sub-test (Wave 7 retro Pattern 3) provides mutation-testing-equivalent confidence.                                                                                                                                                       |
| R6  | **Canon + cache bypass cost ceiling.** Letter-sounds requests with non-empty `letterSoundsVowelStates` bypass canon + cache → live Haiku call per session.                  | Per `progress-and-persistence.md` §"Canon + cache bypass posture": cost surface = one Haiku call + N Azure TTS renders ≈ $0.0022, capped per-IP by 6/60s rate limiter. Mirrors existing graduation-session and leitner-active-session bypass cost. **Greenfield Marian's first letter-sounds session is canon-served** (all-intro state preserves canon hit).      |
| R7  | **Pedagogical risk: Option A surface bug introduces a regression Marian can't recover from.** A `/o/` session that incorrectly fails to flip `letterSoundsVowelStates['/o/']` would freeze the planner cycling. | W9.3's intro→practicing scan is keyed off `successRate > 0`, the same robust gate as the existing post-#201 rule (`mastery.ts` §"intro → practicing transition"). Self-healing on next session-end. W9.5 spec includes a regression-pin test asserting the intro→practicing transition. |
| R8  | **MCP ClickUp auth expiry mid-wave.** Wave 7 retro flagged this; tickets may stall on status flips.                                                                          | Out of Matt's hands; orchestrator handles re-auth when it surfaces. Plan does not depend on mid-wave ticket-flip latency for correctness.                                                                                                                                                                                                                              |
| R9  | **Wave 9 is markdown-heavy on this plan PR.** This PR itself is markdown-only and merges direct per `[[feedback_pr_review_routing]]`.                                       | No peer review needed for this wave-plan PR; orchestrator can direct-merge once CI fast-gate passes (typecheck + lint trivially pass for a docs-only change).                                                                                                                                                                                                            |

---

## Defer-list (Wave 10+)

- **Math pivot — subitising / sub-to-20 directive sharpening + canon re-bake.** Per Wave 7 retro Open call thread 2. Dave's sub-to-20 audit (PR #327) is merged + ready to spec. Wave 10 candidate; fundable in ~4-6 PRs (directive sharpening + re-bake + sibling-tier composition-lint extension).
- **Digraphs-ch + digraphs-th content tiers.** Per Wave 7 retro Open call thread 1. Same 6-surface shape as Wave 7's letter-sounds bookend; estimated 8-10 PRs. Wave 10 or Wave 11 candidate. Note: `digraphs-ch` and `digraphs-th-voiceless` SkillNode literals already exist in the union (PR #211 digraph split) — the wave is content-side only, no sibling-tier widening required.
- **Sight-words content tier.** CLAUDE.md skill-tree order says sight-words is after digraphs. Per `phonics-sequence-marian.md` §Q4: the Shanahan 10-word core set (`the, a, I, to, and, was, for, you, is, of`) is the right starting point. Wave 11+ candidate.
- **Simple-sentences content tier.** Final word-song tier per CLAUDE.md skill-tree order. Wave 12+ candidate — Marian's ship date is August 2026, so simple-sentences may or may not land pre-ship depending on her real-iPad cadence.
- **First-time-experience iPad smoke for letter-sounds.** Parallel candidate to W8.5's letter-names smoke (PR #349 lineage). NOT in Wave 9 scope — the focus this wave is the per-vowel state surface, not screen-render integration. Defer unless capacity surfaces mid-wave; otherwise file a follow-up after W9 closes.
- **Letter-names per-letter sub-mastery.** d9x out-of-scope explicit ("leave A1 on composite"). Not a credible Wave 10+ candidate either; per Dave's memo, letter-name recognition has different mastery semantics than letter-sound mapping — composite tier mastery is the right shape for letter-names.

---

## Memory promotion candidates (this wave)

Patterns to watch for during Wave 9 dispatch that may warrant promotion at retro time:

- **Per-sub-skill state pattern.** If `progress.literacy.letterSoundsVowelStates` ships clean and proves the per-sub-skill-state shape works, that's a candidate retro pattern — generalizes to digraphs voicing variants, novel-probe per-word tracking, future sub-skill granularity.
- **Progress-shape migration discipline.** PR #160 + PR #243 established the additive-optional-field + read-path-defaulter + cloudSync-parity pattern. This wave is the third application; promote to `[[feedback_progress_shape_additive_pattern]]` if W9.2 ships clean with no production-side regressions.
- **`/i/ → /e/` runtime gate as a load-bearing pedagogical predicate.** If the gate ships clean and the assertion-sensitivity sub-test catches a real bug in W9.5 development, that's a calibration data point for the "directive-level approximation vs runtime state gate" trade-off — promotes to the Haiku-directive-sharpening pattern catalog.

---

## Cross-references

- `[[project_content_tier_ships_6_surfaces]]` — Wave 7 lesson; informs why Wave 9 is **not** a 6-surface content-tier wave (the letter-sounds tier was bookended in Wave 7; Wave 9 is a state-shape extension underneath the existing tier).
- `[[feedback_sibling_tier_rebase_mechanical]]` — informs § Conflict surface; W9.2 ↔ W9.3 mechanical resolves.
- `[[feedback_track_based_wave_decomposition]]` — per-track assignee_recommendation pattern; informs § Track recommendations.
- `[[feedback_pr_review_routing]]` — Kevin↔Devon cross-review + Jessica→Devon routing; informs § Peer-review pairs.
- `[[feedback_no_sponsor_as_expert]]` — Q4/Q6 resolution 2026-05-23 (Dave + Kyle team rec; Thomas accepted) is what made Wave 9 a clean follow-up rather than a re-litigation.
- `[[feedback_progression_e2e_mandatory]]` — multi-session progression specs require timeout sizing per `.claude/docs/testing-and-ci.md` §4.1.1b.
- `[[feedback_failing_first_must_prove_green]]` — W9.5 must demonstrate GREEN, not just RED.
- `[[feedback_always_parallel_dispatch]]` — informs Round 1's 3-in-flight dispatch density.
- `[[feedback_dispatch_density_vs_gate]]` — CI is the gate-actor for all four code rounds.
- `[[feedback_canon_state_empirical_verification]]` — bake-metadata flag claims must be verified pre-merge.
- `[[project_marian_not_using_yet]]` — Marian is in content + polish phase; Playwright is the integration surface, not real-child observation.
- `.claude/docs/progress-and-persistence.md`:
  - §"Schema version" — additive optional field precedent.
  - §"`withDefaultedSkillLevels`" — read-path defaulter ordering invariant; informs W9.2.
  - §"Lifetime-first-encounter gate" — closest existing precedent (additive optional + defaulter + cloudSync parity).
  - §"Mastery rule (M3)" — promotion behaviour, cross-day dedupe; informs W9.3.
  - §"intro → practicing transition" — same shape applied per-vowel; informs W9.3.
  - §"Canon + cache bypass posture" — the table W9.4 extends.
  - §"Cloud sync" §"Schema floor at install time" — the cloudSync parity test pattern W9.2 reuses.
- `.claude/docs/testing-and-ci.md`:
  - §4.1.1a — failing-first typing contract (loose `Record<string, string>` overrides).
  - §4.1.1b — failing-first timeout sizing (240s minimum for W9.5).
  - §4.1.1d — trivially-green trap with `failNetwork`.
  - §4.1.1e — negative-membership trivially-green trap.
  - §2.2 — webkit AudioContext caveat.
  - §2.4.2 — per-role worktree gotchas (detach-checkout for cross-worktree review).
- `.claude/docs/skill-trees-and-content.md` — Word Song tree promotion order; informs Defer-list ordering.
- `.claude/docs/sibling-tier-checklist.md` — NOT applicable to Wave 9 (no SkillNode widening); referenced here only to explicitly document non-application.
- `design/word-song/letter-sounds-content.md` — Kyle A5 spec; §1.2 + §1.4 + §5.3 Option A + §5.4 timeline + §6 mastery rule + §7 Q4/Q6 resolution.
- `design/research/phonics-sequence-marian.md` §Q1 — locked `/o/ → /u/ → /i/ → /e/` sequence + `/i/`-`/e/` acoustic similarity ban.
- `.claude/retros/retro-2026-05-23-wave-7-literacy-bookend-shipped.md` — Wave 7 retro Pattern 3 (assertion-sensitivity sub-test) + Pattern B (10/10 routing-correct).
- `design/wave-7-plan.md` — structural precedent for this plan (track decomposition shape).
- `design/wave-8-plan.md` — structural precedent for this plan (mini-wave shape; Wave 9 is a heavier wave but the format mirrors).
