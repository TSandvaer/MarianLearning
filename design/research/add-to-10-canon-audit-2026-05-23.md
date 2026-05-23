# add-to-10 pedagogical + directive audit (Wave 7 Track B1)

**Ticket:** `86c9y49g5` — Track B1, add-to-10 pedagogical audit
**Date:** 2026-05-23
**Author:** Dave (research / pedagogical-fit persona)
**Wave 7 plan:** `design/wave-7-plan.md` (Matt, branch `matt/wave-7-plan`) §"Track B"
**Audit target:** `api/_planner.ts:933-975` (add-to-10 MATH_TRACK_GUIDE block) + `public/canon/math/level-1/add-to-10.json` + `scripts/compositionLint.ts:594-720` (ADD_TO_TEN binding)
**Authority benchmarks:** `[[feedback_haiku_directive_sharpening]]` (7 patterns) and `[[feedback_distractor_class_pedagogical_gates_mechanical]]`

---

## Question

Does the shipped add-to-10 directive + canon honour the post-Wave-6 sharpening playbook AND the locked pedagogical decisions from `design/math/add-to-10-content.md` (PR #251 + #254), and if not, what gaps remain?

## Bottom line

**Directive-sharpen-in-place is sufficient. No spec refresh needed. No re-bake needed today.**

The add-to-10 directive at `api/_planner.ts:933-975` has already been substantially sharpened beyond the one-line state described in the spec (§4 of `design/math/add-to-10-content.md` is now historical). It honours Patterns 1, 2, 4 + a self-check echo of Pattern 5. The current canon is clean against the existing compositionLint binding (which exists, contra spec §9.3's "the lint config (`ADD_TO_TEN_POOL` + `ADD_TO_TEN_RULES`) is the authoritative implementation" — confirmed). The remaining gaps are exclusively in `[[feedback_haiku_directive_sharpening]]` Patterns 3 + 6 + 7 (hoisted CATEGORY-MIX BUDGET first, FAILURE MODES BOTH WAYS commentary, WORKED EXAMPLE block, RULE_IDENTITY+SPEC+LINT triple-pin). These are inexpensive prophylactic improvements; absence is NOT today a violation but IS a known-latent risk for the doubles-prior failure mode flagged in `.claude/docs/planner-and-canon.md` § "Haiku has a strong 'doubles' prior under sharpened add-to-10 directive."

**Recommendation:** ship Track B3 (Kevin directive sharpen) WITHOUT B2 (Kyle spec refresh) AND WITHOUT B4 (Jessica regression spec) — confidence HIGH. Re-bake fires only IF Kevin's sharpening triggers it; if the existing canon is already clean against the lint (it is), an immediate re-bake is not load-bearing.

---

## § 1 — Empirical pre-audit: 7-pattern playbook vs current directive

Source: `api/_planner.ts:933-975` (read in this session).

| # | Pattern (from `[[feedback_haiku_directive_sharpening]]`) | Honored? | Evidence (file:line) |
|---|---|---|---|
| 1 | Inline band labels per fact, not just grouped under band headers | ⚠️ PARTIAL | `_planner.ts:936-949` groups facts UNDER band+category headers (`- EASY band (sum 3-5; 9 facts):` then `· plus-one: 1+2, 2+1, ...`), but does NOT carry an inline `[BAND/category]` tag on each fact the way sub-to-10 does (`_planner.ts:1063` `· 5-5=0   [EASY/subtract-self]`). The category names ARE inline within each sub-bullet, so Haiku has the binding — but the visual encoding is one level less explicit. **Verdict:** functionally equivalent for this pool; sub-to-10's inline-per-fact pattern is the stronger shape and worth promoting at the next directive-touch. |
| 2 | Negative anchors over positive quantifiers | ✅ HONORED | `_planner.ts:954-957` explicit `NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS` block listing the only 9 facts allowed at P1-P3 (`1+2, 2+1, 1+3, 3+1, 1+4, 4+1, 2+2, 2+3, 3+2`) and forbidding MEDIUM/HARD-band placement. This is the strong shape. |
| 3 | Per-rule self-check anchored against attention-budget-shift | ❌ MISSING | `_planner.ts:950` has a single `POOL-MEMBERSHIP SELF-CHECK`. There is NO `DOUBLES-CAP SELF-CHECK`, no `SUMS-TO-10-CAP SELF-CHECK`, no `CATEGORY-MIX BUDGET` block hoisted FIRST. Per `planner-and-canon.md` § "Haiku has a strong 'doubles' prior" — PR #266 add-to-10 re-bake observed attempts 1 + 2 BOTH violating doubles ≤ 2 (full trifecta of `2+2, 3+3, 4+4`). Composition-lint caught both at bake-time, but the directive itself had no inline self-check rejection. This is the **highest-leverage missing pattern** for add-to-10 specifically — the failure mode is documented, the playbook prescription exists, and it isn't applied here. |
| 4 | Drift-guard tests rotate with sharpening; preserve semantic invariant | ✅ N/A IN DIRECTIVE | This pattern lives in `_planner.test.ts`, not in the directive prose. Not in scope for this audit. Drift-guard test coverage for the existing directive blocks is presumed (sub-to-10 has a multi-assertion drift-guard at `_planner.test.ts:3289-3332`; symmetrical coverage for add-to-10 was not verified in this audit pass — flag as B3 sub-task for Kevin). |
| 5 | `*_SELF-CHECK` negative-anchor blocks for cap-violation rules | ❌ MISSING | Same gap as Pattern 3. Sub-to-10 has `GENERAL-CATEGORY CAP SELF-CHECK`, `DOUBLES-CAP SELF-CHECK`, `SUBTRACT-ONE-CAP SELF-CHECK`, `SUBTRACT-TWO-CAP SELF-CHECK` blocks at `_planner.ts:1086-1089`. add-to-10 has none. The category caps live ONLY as rule 6 (`_planner.ts:961`) without per-cap self-check rejection examples. |
| 6 | Hoisted CATEGORY-MIX BUDGET block FIRST + name both failure modes + worked example | ❌ MISSING | This is the strongest Wave-6 pattern (validated on add-to-20 PR #280 across 4 bake attempts). add-to-20 at `_planner.ts:1011-1016` has `CATEGORY-MIX BUDGET (apply BEFORE selecting any facts — this is the FIRST rule because Haiku's prior empirically saturates make-ten-bridge OR doubles when the cap is buried late in the rule list)`. add-to-10 has nothing equivalent. add-to-20 also has a verbatim WORKED EXAMPLE block at `_planner.ts:1034-1043` showing a clean 8-problem session with counts called out per category — add-to-10 has no WORKED EXAMPLE block. **This is the second highest-leverage missing pattern.** |
| 7 | Triple-pin drift-guard (`RULE_IDENTITY` + `SPEC` + `LINT`) | ❌ MISSING | Validated 2026-05-23 on Dave's `-with-regroup` directive (PR #314); not yet applied anywhere else. add-to-10 has no `<drift-guard>` tag. Low-cost prophylactic addition. |

**Net pattern coverage:** 2 of 7 fully honored (#2 negative anchors; #4 not in directive scope); 1 of 7 partial (#1 inline tags — sub-to-10 stronger shape); 4 of 7 missing (#3, #5, #6, #7 — the post-Wave-6 sharpening cluster).

---

## § 2 — Pedagogical-fit audit: shipped canon problems vs Marian's error pattern

Source: `public/canon/math/level-1/add-to-10.json` (extracted in this session via `grep -oE '"math\.p[0-9]\.read","text":"[^"]+"'`). The 8 problems classified against the spec's pool / category taxonomy:

| Slot | Read text | Fact | Band | Category | Pedagogical fit for Marian (per `[[project_diagnostic_results]]`) |
|---|---|---|---|---|---|
| P1 | "One plus two. How many?" | 1+2 = 3 | EASY | plus-one | ✅ Gentle warm-up. Counting-on-one is the easiest retrieval path; opens session with confidence preservation. |
| P2 | "Two plus two. How many?" | 2+2 = 4 | EASY | doubles | ✅ Doubles anchor early in session — Dave's Intervention D (doubles strategy) instantiated. |
| P3 | "Three plus two. How many?" | 3+2 = 5 | EASY | near-doubles | ✅ Near-doubles in gentle ramp; bridges to doubles-plus-one strategy (3+2 = 2+2+1). End of gentle ramp at correct band. |
| P4 | "Two plus four. How many?" | 2+4 = 6 | MEDIUM | general | ✅ First discriminate-tier problem at MEDIUM (HARD-band forbidden at P4 per directive). General-category at MEDIUM is exactly the "retrieval-pathway category" the spec § 1.2 calls out as highest-need for Marian. |
| P5 | "Four plus four. How many?" | 4+4 = 8 | MEDIUM | doubles | ✅ Second doubles fact in session (at cap of 2). Doubles trifecta NOT delivered (`3+3` absent — exactly the doubles-prior-prevention behaviour the cap exists to enforce). |
| P6 | "Five plus five. How many?" | 5+5 = 10 | HARD | sums-to-10 | ✅ The single most important add-to-10 fact per Dave's Source 10 (the "anchor to 10"). Delivered at P6 in the discriminate tier — exactly where the spec § 2.4 wants it. |
| P7 | "Three plus seven. How many?" | 3+7 = 10 | HARD | sums-to-10 | ✅ Complementary-pair sums-to-10. Second sums-to-10 fact (at cap of 2 per spec § 2.2). Reinforces the make-10 mental model. |
| P8 | "Four plus five. How many?" | 4+5 = 9 | HARD | near-doubles | ✅ HARD-band near-doubles closer; doubles-plus-one derivation in the discriminate tier. |

**Category cap check:** plus-one=1, doubles=2, near-doubles=2, sums-to-10=2, general=1 — every category ≤ its cap (spec § 2.2). Total = 8 ✓.

**Band-by-slot check:** P1-P3 EASY-only ✓; P4 MEDIUM (no HARD) ✓; P5-P8 mix of MEDIUM and HARD ✓; HARD only at P5+ ✓.

**Coverage check:** ≥1 sums-to-10 in P4-P8 — satisfied with 2 (P6, P7) ✓.

**Duplicates:** No (a, b) ordered pair appears twice ✓.

**Distractor-class check (render-side):** Per spec § 3.4 + § 1.6.3 + `Math.tsx:2559-2560`, `op === '+'` defaults `distractorClass` to `undefined`, falling through to gentle (P1-P3) + off-by-one (P4-P8). No Class 2 wrong-op (correctly rejected per § 3.2). No Class 3 answer-equals-operand (correctly rejected per § 1.6.3 — would collide with Class 1 off-by-one for many pool facts e.g. `4+1=5` where operand 4 IS the `correct-1` chip).

**Updated diagnostic context (May 2026 in-app observations from `[[project_diagnostic_results]]` Update §):**

> "100% finger reliance" from the April diagnostic is OUTDATED. Marian no longer finger-counts on sums ≤ 10. She uses the on-screen flowers as a visual scaffold sometimes, but very fast — closer to subitising/recall than to procedural counting. Sums ≤ 10 (entire add-to-10 surface) are "easy" per Thomas's observation. One iPad session: 100% successRate.

This update means add-to-10 may auto-promote sooner than the original drill plan assumed (per spec § 6, accuracy gate `95/3`). It does NOT change the pool or composition rules — the high-leverage anchors (sums-to-10, doubles) remain the right targets right up until promotion. **No pedagogical-fit gap surfaced by the audit.** Every problem in the shipped canon serves a clear, documented purpose.

---

## § 3 — Composition-lint binding gap

**Spec § 9.3 claim, empirically verified:** the lint binding for add-to-10 ALREADY EXISTS, contra Matt's pre-audit observation in the dispatch brief.

- `scripts/compositionLint.ts:594-720` defines `ADD_TO_TEN_POOL` (44-fact factory build), `AddToTenBand`, `AddToTenCategory`, `ADD_TO_TEN_RULES` config (`categoryCaps`, `bandAllowedSlots`, `sumsToTenInP4ToP8Min`, `totalProblems`).
- `scripts/compositionLint.ts:764` defines `lintAddToTenComposition()`.
- `scripts/compositionLint.ts:894` defines `assertAddToTenCompositionClean()`.
- `scripts/compositionLint.ts:4049` wires `lintAddToTenComposition` into the bake-time / CI tier dispatcher.
- `scripts/generateSessionCanon.ts:400-402` gates the assertion on `combo.track === 'math' && combo.focusNode === 'add-to-10'`.
- `scripts/compositionLint.test.ts:1656-2011` provides ~7 `describe` blocks covering clean-canon, pool-membership, category-cap, band-by-slot, sums-to-10-coverage, no-duplicates, unparseable-problem, plus the `assertAddToTenCompositionClean` wrapper.

**Composition-lint propose-its-shape:** N/A — the shape exists and mirrors the sub-to-10 binding. No proposal needed.

**Sub-finding:** Matt's pre-audit observation in the dispatch brief ("AND has NO compositionLint binding (only sub-to-10 has one today)") is empirically inaccurate. The binding shipped in Kevin's PR #248 (per spec § 0 attribution chain). Track B3's brief should be updated to NOT include "extend `scripts/compositionLint.ts` with a `TierLintBinding` for add-to-10" — that work is already done. Track B3 reduces to **directive sharpening only**.

---

## § 4 — Risk register: what could a re-bake under sharpened directive break?

**Marian-active-tier risk:** add-to-10 IS the tier Marian uses today. Per `[[project_marian_not_using_yet]]` she is NOT actually using the app on her iPad yet (Thomas's call 2026-05-14 — content + polish phase). So canon-swap blast radius today is **purely Jessica E2E specs + Devon design-review screenshots**, NOT real-Marian disruption. This lowers the re-bake risk substantially.

| Risk | Likelihood | Blast radius | Mitigation |
|---|---|---|---|
| Re-bake produces a doubles-prior violation (PR #266 attempt 1-2 failure mode reappears) | HIGH for first-attempt; LOW for second-attempt | Bake-time rejection by `assertAddToTenCompositionClean` (no production impact). Bake-cost ~$0.005 per attempt per `planner-and-canon.md`. | Apply Pattern 6 (hoist CATEGORY-MIX BUDGET) + Pattern 5 (DOUBLES-CAP SELF-CHECK) BEFORE attempting re-bake — these are the empirically-validated cures for this exact failure mode. Budget 2-4 bake attempts per `[[feedback_haiku_directive_sharpening]]` Pattern 6. |
| Sharpened directive disturbs other tiers via attention-budget shift | LOW | sub-to-10 / add-to-20 / sub-to-20 directives are independent blocks in `MATH_TRACK_GUIDE`; sharpening add-to-10 affects only add-to-10 bakes. | None needed; cross-tier independence verified in directive structure. |
| E2E specs hard-code the exact fact sequence (P1=1+2, ..., P8=4+5) and break on re-bake | UNKNOWN | Jessica spec failures at next bake. | Per Wave 7 plan B4 brief, regression spec is conditional. If existing specs assert on fact-sequence, they need adjustment regardless. **B3 should grep `e2e/` and `src/screens/Math/*.test.*` for hard-coded chip values from the current canon BEFORE re-baking.** |
| Sharpened directive emits a fact in the pool but outside the canon's recent rotation (e.g., `3+3` instead of `4+4` as second doubles) | LIKELY (Haiku non-determinism) | If shipped, the new canon differs from existing in 1-3 facts. No semantic break — both fact sets honour all rules. | Acceptable as long as composition-lint passes; no special mitigation. Per spec § 1.5, no fact-stability commitment. |
| Pattern 7 (triple-pin) edit introduces typo in SPEC or LINT pointer | LOW | Drift-guard test catches it. | Verify SPEC path = `design/math/add-to-10-content.md§2.2` (or the actual sharpened section) + LINT path = `scripts/compositionLint.ts:704` (`ADD_TO_TEN_RULES` declaration) before commit. |
| Re-bake propagates to canon and lint changes; both touch the same module → reviewer conflict | LOW | Single-author (Kevin) for B3; no parallel-author risk in the wave. | Already mitigated by track-based decomposition. |

**Overall risk verdict:** Re-bake is LOW-risk given (a) Marian not actively using the app, (b) composition-lint catches violations at bake-time before disk write, (c) bake-cost is trivial. The dominant risk is bake-attempt cost ($0.02 max per Pattern 6 budgeting) and Kevin's time.

---

## § 5 — Recommendation

**SHIP Track B3 (Kevin directive sharpen). SKIP B2 (Kyle spec refresh). SKIP B4 (Jessica regression spec).**

**Confidence: HIGH.**

### Why skip B2

`design/math/add-to-10-content.md` is current, comprehensive (510 lines), and pinned to Kevin's PR #248 lint config which itself is current and correct. The spec § 4.1 already contains a draft of the sharpened structured directive block; Kevin can lift it forward with the 4 Pattern additions below. Re-spec'ing would be doc churn without informational content change.

### Why skip B4

Per Wave 7 plan: "re-bake without behaviour change doesn't need a new spec." A sharpened directive that produces a different-but-still-compliant canon is a behaviour-preserving change (composition rules unchanged; pool unchanged; promotion gate unchanged). No new invariant to test. Existing canon-aware E2E coverage (per `.claude/docs/testing-and-ci.md`) is sufficient. **Caveat:** if any existing E2E spec hard-codes the current canon's specific fact sequence, that spec is a maintenance liability regardless of this sharpening — Kevin should flag any such spec to Jessica during B3 for independent cleanup, NOT block B3 on it.

### Sharpened directive must include (synthesized from § 1 + § 2)

The minimum additive sharpening cluster, in priority order:

1. **(Pattern 6) Hoist a `CATEGORY-MIX BUDGET` block FIRST**, before SESSION COMPOSITION RULES, explicitly naming BOTH failure modes:
   - **doubles-prior** (PR #266 attempts 1-2 produced full doubles trifecta) — empirically observed for add-to-10
   - **plus-one-saturation** (LATENT — plus-one pool has 14 facts, the largest category; if doubles cap binds and discriminate tier loses headroom, plus-one is structurally the next attention sink)
   With explicit caps re-stated: doubles ≤ 2, plus-one ≤ 2, near-doubles ≤ 3, sums-to-10 ≤ 2, general ≤ 2. Total cap-sum = 11, slack = 3 over the 8-slot session.

2. **(Pattern 6) Verbatim WORKED EXAMPLE block** showing a clean 8-problem session with per-fact band/category annotations and per-category counts. Use the current canon's mix as the worked example (P1=1+2 plus-one EASY ... P8=4+5 near-doubles HARD), since it's already-clean against all rules. This grounds Haiku on the target distribution.

3. **(Pattern 5) `DOUBLES-CAP SELF-CHECK` block** with negative anchor enumerating forbidden combinations: "FORBIDDEN to place `2+2` AND `3+3` AND `4+4` in the same session (doubles trifecta — known failure mode per PR #266 attempts 1-2)." Mirror the structural shape of sub-to-10's `DOUBLES-CAP SELF-CHECK` at `_planner.ts:1087`.

4. **(Pattern 7) Triple-pin drift-guard tag** at the start of the add-to-10 block:
   ```
   <drift-guard RULE_IDENTITY=add-to-10-composition SPEC=design/math/add-to-10-content.md§2 LINT=scripts/compositionLint.ts:704>
   ```

5. **(Pattern 1, optional but cheap) Promote sub-bullet category labels to inline `[BAND/category]` tags per fact**, matching sub-to-10's stronger shape. E.g.:
   ```
   - EASY band (sum 3-5; 9 facts):
     · 1+2 [EASY/plus-one]
     · 2+1 [EASY/plus-one]
     · 2+2 [EASY/doubles]
     ...
   ```
   This is the most invasive of the 5 additions (touches 44 lines of fact enumeration); land it only if Kevin agrees the cost is worth it. Functionally Patterns 3 + 5 + 6 already address the same failure mode (cap awareness during composition). Pattern 1 here is defense-in-depth, not load-bearing.

**Pattern 3 (per-rule self-check anchored against attention-budget-shift):** structurally honored by adding Patterns 5 + 6 above. No separate edit needed.

**Pattern 2 (negative anchors):** already honored. No change.

**Pattern 4 (drift-guard tests):** B3 sub-task — Kevin to extend `_planner.test.ts` with a drift-guard covering the new `CATEGORY-MIX BUDGET` block header + 3+ assertions on its content (per Pattern 5 caveat: "not just `.toContain(blockTitle)` — assert on multiple substrings"). Mirror the sub-to-10 test at `_planner.test.ts:3289-3332`.

### Bake-cost expectation

Per `[[feedback_haiku_directive_sharpening]]` Pattern 6: 2-4 attempts; ~$0.02 max spend. Composition-lint catches violations pre-disk-write. If first bake is clean (possible given how thin the changes are), commit immediately; if not, iterate per Pattern 3's per-rule self-checks added in this PR.

### Re-bake decision

**Re-bake the canon as part of B3? RECOMMENDED YES.** The current canon is clean but was produced under the pre-Wave-6-playbook directive. A clean re-bake under the sharpened directive validates the sharpening landed correctly AND refreshes the canon under the current playbook — both small wins. If the new canon equals the old canon, ship the old; if it differs but is clean, ship the new. **NOT a blocker if Kevin's bake-time budget is tight** — directive sharpening alone is the load-bearing deliverable.

---

## Cross-references

- **Spec** — `design/math/add-to-10-content.md` (Kyle, PR #251 + #254; comprehensive 510-line spec ratifying Kevin's lint config + locking distractor-class decisions).
- **Sibling directive (target shape)** — `api/_planner.ts:1011-1054` (add-to-20 — already on the Wave-6 playbook with CATEGORY-MIX BUDGET FIRST + WORKED EXAMPLE).
- **Sibling directive (cap-self-check target shape)** — `api/_planner.ts:1086-1090` (sub-to-10 — has DOUBLES-CAP, SUBTRACT-ONE-CAP, SUBTRACT-TWO-CAP SELF-CHECK blocks).
- **Composition-lint binding** — `scripts/compositionLint.ts:594-720` (`ADD_TO_TEN_POOL` + `ADD_TO_TEN_RULES`); `scripts/compositionLint.ts:764` (`lintAddToTenComposition`); tests at `scripts/compositionLint.test.ts:1656-2011`.
- **Bake-time wiring** — `scripts/generateSessionCanon.ts:400-402` (`assertAddToTenCompositionClean` gated on `combo.focusNode === 'add-to-10'`).
- **Marian diagnostic update** — `[[project_diagnostic_results]]` Update May 2026 (Marian no longer finger-counts on sums ≤ 10; sums-to-10 surface is "easy" per Thomas).
- **Doubles-prior failure mode** — `.claude/docs/planner-and-canon.md` § "Haiku has a strong 'doubles' prior under sharpened add-to-10 directive" (PR #266 attempts 1-2).
- **Sharpening playbook** — `[[feedback_haiku_directive_sharpening]]` (7 patterns).
- **Distractor-class principle** — `[[feedback_distractor_class_pedagogical_gates_mechanical]]` (pedagogical fit gates mechanical fit).
- **Canon-state empirical verification** — `[[feedback_canon_state_empirical_verification]]` (any "ships with X facts of Y" claim must be paired with verifying grep/cat output — applied throughout this audit's § 2 + § 3).

---

## Non-obvious findings for orchestrator routing

1. **The add-to-10 compositionLint binding ALREADY EXISTS** (`scripts/compositionLint.ts:594-720`, wired at `generateSessionCanon.ts:400`). Matt's pre-audit observation in the dispatch brief is empirically inaccurate. Track B3's brief should be reduced to directive-sharpening only; binding-creation work is done.
2. **The directive at `api/_planner.ts:933-975` has already been substantially sharpened** beyond the one-line state described in spec § 4. Spec § 4 + § 9.1 are historical; the actual directive already carries FACT POOL + NEGATIVE ANCHOR + BAND-BY-SLOT + category caps + sums-to-10 anchor rule. The remaining gaps are exclusively the post-Wave-6 cluster (Patterns 3 + 5 + 6 + 7 from `[[feedback_haiku_directive_sharpening]]`).
3. **The shipped canon is composition-lint-clean** against the existing binding (verified by classifying all 8 problems in § 2; every category cap respected, every band-by-slot rule honored, sums-to-10 coverage = 2 ≥ 1, no duplicates). A re-bake under the sharpened directive is a refresh, not a fix.
4. **`[[project_diagnostic_results]]` carries a May 2026 update** invalidating "100% finger reliance" from the April diagnostic. Marian is observed to be at near-retrieval speed on sums ≤ 10. This does NOT change the audit recommendation but DOES mean the Leitner box + slow-fact directive (both active for add-to-10) are the higher-leverage tools today; directive sharpening is a defense-in-depth investment, not a Marian-blocking improvement.
5. **Pattern 7 (triple-pin drift-guard) has only one production exemplar** today (Dave's `-with-regroup` directive at PR #314, 2026-05-23). Applying it to add-to-10 is the second exemplar and would help the pattern crystallize as fleet-wide.
