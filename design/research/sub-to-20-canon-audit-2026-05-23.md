# sub-to-20 pedagogical + directive audit (Wave 7 Track B5)

**Ticket:** `86c9y49ve` — Track B5, sub-to-20 pedagogical audit (lighter pass)
**Date:** 2026-05-23
**Author:** Dave (research / pedagogical-fit persona)
**Wave 7 plan:** `design/wave-7-plan.md` (Matt) §"Track B"
**Audit target:** `api/_planner.ts:1112-1187` (sub-to-20 MATH_TRACK_GUIDE block) + `public/canon/math/level-1/sub-to-20.json` + `scripts/compositionLint.ts:905-1451` (SUB_TO_TWENTY binding)
**Authority benchmarks:** `[[feedback_haiku_directive_sharpening]]` (7 patterns) and `[[feedback_distractor_class_pedagogical_gates_mechanical]]`
**Sibling precedent:** `design/research/add-to-10-canon-audit-2026-05-23.md` (Dave B1, same wave) — same shape applied here.

---

## Question

Does the shipped sub-to-20 directive + canon honour the post-Wave-6 sharpening playbook AND the locked pedagogical decisions from `design/math/sub-to-20-content.md` (Kyle's PR #269), and if not, what gaps remain?

## Bottom line

**Close-audit. No re-bake needed. Two narrow defense-in-depth additions worth filing as deferred follow-ups, NOT as blockers.**

The sub-to-20 directive at `api/_planner.ts:1112-1187` is materially the sharpest math-track directive in the codebase as of 2026-05-23, modulo the post-Wave-6 stylistic refinements Pattern 6 + Pattern 7 introduced (CATEGORY-MIX BUDGET hoisted FIRST + FAILURE MODES BOTH WAYS + WORKED EXAMPLE block + `<drift-guard RULE_IDENTITY=…>` tag). It already honours Patterns 1, 2, 4 (lint-side), 5 (the CATEGORY-CAP SELF-CHECK with worked rejection examples at `_planner.ts:1163-1170` IS this pattern in a slightly different visual shape), and DISTRACTOR-COVERAGE SELF-CHECK + READ-LINE NEGATIVE ANCHOR (sub-to-20-specific extensions of Pattern 2). The composition-lint binding EXISTS and is comprehensive (22-fact pool + 6 cap rules + take-to-decade coverage rule + sub-to-20-specific Class-B-coverage rule + path-binding wired at bake-time and CI, plus POOL ↔ directive drift-guard AND bandAllowedSlots ↔ directive drift-guard tests). The shipped canon is composition-lint-clean against every rule.

**Empirical contradiction of Matt's pre-audit framing — flagged in § 3 below:** Matt's dispatch brief states "no compositionLint binding exists for sub-to-20 today; the cap rules sit only in the directive prose, not as a mechanical gate." This is empirically inaccurate — the binding shipped via the sub-to-20 re-bake PR (`86c9utet9`, comment-cited at `scripts/compositionLint.ts:3893-3905`). This is the SECOND consecutive cycle where Matt's pre-audit binding-status claim was wrong (B1 add-to-10 had the same pattern). The audit cycle continues to be the load-bearing check on planner-state claims, per `[[feedback_canon_state_empirical_verification]]`.

**Recommendation:** SHIP NOTHING from B5. SKIP B6 (Devon directive sharpen) AND SKIP B7 (Jessica regression spec). The two defense-in-depth additions (Pattern 6 stylistic-refresh + Pattern 7 drift-guard tag + the missing `api/_planner.test.ts` sub-to-20 directive-side test coverage) belong in their own follow-up tickets at lower priority than the next math-tier content work. Confidence HIGH.

---

## § 1 — Empirical pre-audit: 7-pattern playbook vs current directive

Source: `api/_planner.ts:1112-1187` (read in this session, full block scanned line-by-line).

| # | Pattern (from `[[feedback_haiku_directive_sharpening]]`) | Honored? | Evidence (file:line) |
|---|---|---|---|
| 1 | Inline band labels per fact, not just grouped under band headers | ✅ HONORED | `_planner.ts:1118-1142` — every one of the 22 facts carries inline `[BAND/category]` tag PLUS the sub-to-20-specific `(DEC=10 ALIAS\|BOUNDARY\|CLEAN)` distractor-status annotation. This is the strongest shape of Pattern 1 in the codebase — even sub-to-10 doesn't carry the extra DEC annotation per fact. |
| 2 | Negative anchors over positive quantifiers | ✅ HONORED | Three explicit NEGATIVE ANCHOR blocks: (a) `_planner.ts:1147-1150` P1/P2/P3 PLACEMENT BANS with the explicit "ONLY facts allowed at P1, P2, P3 are: 11-1, 12-2, 13-3, 12-1, 13-2, 13-1" enumeration; (b) `_planner.ts:1177` DISTRACTOR-COVERAGE SELF-CHECK includes "NEGATIVE ANCHOR: it is FORBIDDEN to fill P4-P8 entirely with ALIAS- or BOUNDARY-annotated facts when ≥2 CLEAN-annotated facts are still available"; (c) `_planner.ts:1181` READ-LINE NEGATIVE ANCHOR with the "minus" verbatim requirement + worked rejection of "Eleven take away one. How many are left?". The READ-LINE anchor is novel to sub-to-20 — adopted as defense-in-depth against the two-digit-addsub Wave-4 silent-wrong-tier-misrender failure mode (per `planner-and-canon.md` § "Sibling failure mode — Planner directive vs canon read-line template divergence"). |
| 3 | Per-rule self-check anchored against attention-budget-shift | ⚠️ PARTIAL | The CATEGORY-CAP SELF-CHECK at `_planner.ts:1163-1170` carries explicit worked-rejection examples for EVERY interaction-failure mode (P1=11-1 AND P3=13-1 → subtract-one cap = 2 violation; P3=13-3 AND P5=15-5 AND P8=18-8 → take-to-decade cap = 3 violation; P1=11-1, P2=12-1, P3=13-1 → subtract-one cap = 3 violation; the P3=13-3 take-to-decade-budget interaction with rule 4 spelled out separately). This is structurally Pattern 3 — per-interaction worked rejection. **What's missing** vs add-to-20's freshest version (`_planner.ts:1011-1016`): the CATEGORY-MIX BUDGET is not hoisted FIRST as its own pre-composition block. Currently it's rule 7 inside the SESSION COMPOSITION RULES enumeration. This is the Pattern 6 cluster (see row 6). Not a Pattern 3 deficiency per se — the worked rejections ARE there. |
| 4 | Drift-guard tests rotate with sharpening; preserve semantic invariant | ✅ HONORED (lint-side); ❌ MISSING (planner-side) | Lint-side: TWO drift-guards in `scripts/compositionLint.test.ts` — `SUB_TO_TWENTY_POOL` drift-guard at `:3649-3694` (mirrors the 22-fact POOL + runtime parses the FACT POOL bullet block + asserts equality both ways, including the "drop the DEC annotation" mutation-detection test at `:3680-3694`) AND `SUB_TO_TWENTY_RULES.bandAllowedSlots` drift-guard at `:3715-3771` (parses the "Problems 1-3" + "MEDIUM only appears at P4 or later" + "HARD only appears at P5 or later" rule prose). The `extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')` tier-scoping helper handles sibling-block disambiguation per the methodology in `planner-and-canon.md` §"Drift-guard tests extend to RULE identity". **Planner-side gap:** `api/_planner.test.ts` has ZERO mentions of `sub-to-20` — no Haiku-stub plan composition test, no per-rule-emission assertion. The lint drift-guards cover prose drift; they do NOT cover whether the directive PRODUCES correct plans against a stubbed Haiku. See § 4 risk register row "no planner-test sub-to-20 coverage". |
| 5 | `*_SELF-CHECK` negative-anchor blocks for cap-violation rules | ✅ HONORED | The CATEGORY-CAP SELF-CHECK at `_planner.ts:1163-1170` IS this pattern, applied as ONE consolidated cap block with worked rejection examples for every category rather than per-category siblings (sub-to-10's shape is one block per category: GENERAL-CATEGORY CAP SELF-CHECK, DOUBLES-CAP SELF-CHECK, SUBTRACT-ONE-CAP SELF-CHECK, SUBTRACT-TWO-CAP SELF-CHECK). Both shapes are functionally equivalent — sub-to-20's consolidated form is actually MORE economical with attention-budget because all six caps share the worked-rejection scaffolding rather than each owning its own block. Not a regression. Per `[[feedback_haiku_directive_sharpening]]` Pattern 5 — the negative-anchor pattern is the load-bearing prophylactic; the visual shape (one block vs many) is a stylistic choice. |
| 6 | Hoisted CATEGORY-MIX BUDGET block FIRST + name BOTH failure modes + WORKED EXAMPLE | ❌ MISSING | This is the strongest Wave-6 pattern (validated on add-to-20 PR #280 across 4 bake attempts; described in `planner-and-canon.md` § "Haiku has a strong 'doubles' prior under sharpened add-to-10 directive" and inlined verbatim at `_planner.ts:1011-1016` for add-to-20). sub-to-20 has the CATEGORY-CAP SELF-CHECK (rule 7 inside SESSION COMPOSITION RULES, with worked rejection examples) but DOES NOT have: (a) a hoisted CATEGORY-MIX BUDGET block BEFORE SESSION COMPOSITION RULES; (b) explicit "FAILURE MODES BOTH WAYS" framing naming Haiku's specific empirical priors for this tier; (c) a WORKED EXAMPLE block showing a clean 8-problem session with per-category counts called out. **Risk profile is LOWER for sub-to-20 than for add-to-10 / add-to-20 because:** the sub-to-20 pool category distribution is naturally less prone to saturation — take-to-decade is the dominant category (7 of 22 pool facts) and is intentionally given the relaxed cap of 2, so Haiku's prior here cannot saturate the way it does on add-to-10's doubles (4 of 14 EASY) or add-to-20's make-ten-bridge (13 of 22 total). There is no documented Haiku-prior-saturation failure mode for sub-to-20 (compare: PR #266 attempts 1-2 for add-to-10; PR #280 attempts 1-4 for add-to-20). The Pattern 6 cluster is defense-in-depth for sub-to-20, not load-bearing. |
| 7 | Triple-pin drift-guard tag `<drift-guard RULE_IDENTITY=…; SPEC=…; LINT=…>` | ❌ MISSING | Validated 2026-05-23 on Dave's `two-digit-addsub-with-regroup` directive (`_planner.ts:1306` is the lone production exemplar today). sub-to-20 has no `<drift-guard>` tag. Low-cost prophylactic addition. Note: sub-to-20 has STRONGER drift-guard coverage at the LINT-side than two-digit-addsub-with-regroup does (two-sided POOL + bandAllowedSlots tests), so the absence of the inline tag is the documentation-coordination gap, not a verification gap. |

**Net pattern coverage:** 4 of 7 fully honored (Patterns 1, 2, 4 lint-side, 5); 1 of 7 partial (Pattern 3 — worked rejections present but not in the Pattern-6-hoisted shape); 2 of 7 missing (Pattern 6 cluster + Pattern 7 drift-guard tag). The 2 missing patterns are the post-Wave-6 cluster — same shape as the B1 add-to-10 audit finding.

**Additional sub-to-20-specific patterns NOT in the 7-pattern playbook (but worth noting as exemplary):**

- **DISTRACTOR-COVERAGE SELF-CHECK** (`_planner.ts:1177`) — sub-to-20-specific extension covering Class B (decade-anchor miss) trap coverage. Documents the render-side silent-downgrade behaviour AND biases P4-P8 fact selection toward CLEAN-annotated facts with explicit category-cap arithmetic. This is the SHARPEST distractor-coverage shape in the codebase — sub-to-10's equivalent (`_planner.ts:1090`) is structurally similar but does not pre-compute the "maximum achievable" target.
- **READ-LINE NEGATIVE ANCHOR** (`_planner.ts:1181`) — sub-to-20-specific extension preventing planner-directive vs canon read-line template divergence (the failure mode that surfaced as the two-digit-addsub silent-wrong-tier-misrender). Per `planner-and-canon.md` § "Sibling failure mode" this anchor SHOULD eventually exist for every tier; sub-to-20 has it; sub-to-10 + add-to-10 + add-to-20 do not (latent risk in those tiers, NOT in scope for this audit).
- **PER-PROBLEM SHAPE block** (`_planner.ts:1179`) — explicitly documents that `distractorClass` is render-time, NOT planner-emitted, in plain prose. Inoculates against the Devon NOF #1 / Kevin NOF #1 failure mode pattern from PR #240/#241 (sub-to-10). The MAY-mention-MUST-qualify pattern from `planner-and-canon.md` §"Drift-guard shape for these locks" applies — the prose here both names the field AND qualifies it as render-time in the same sentence.

These three blocks are reasons to consider the sub-to-20 directive a candidate **reference template** for future tier directives. The 7-pattern playbook is a floor, not a ceiling.

---

## § 2 — Pedagogical-fit audit: shipped canon problems vs Marian's level

Source: `public/canon/math/level-1/sub-to-20.json` — extracted via `jq -r '.utterances[] | select(.id | test("^math\\\\.p[0-9]+\\\\.read$")) | "\\(.id): \\(.text)"'`. 8 problems classified against `SUB_TO_TWENTY_POOL` (`scripts/compositionLint.ts:968-1148`).

| Slot | Read text | Fact | Band | Category | DEC status | Pedagogical fit for Marian (April 2026 diagnostic: "subtract-to-15 confident, extend to 20 no-borrow") |
|---|---|---|---|---|---|---|
| P1 | "Eleven minus one. How many are left?" | 11-1=10 | EASY | subtract-one | DEC=10 ALIAS | ✅ Confidence-preserving opener. Single-step count-back; result lands exactly on the decade — the take-to-decade strategy intuited from the bare minimum. Class B aliases correct → silent downgrade to off-by-one chips. No surprise; chip values {9, 10, 11} are the gentle three-way separation. |
| P2 | "Twelve minus two. How many are left?" | 12-2=10 | EASY | doubles-anchor | DEC=10 ALIAS | ✅ Doubles-analog scaffold (Marian knows 2+2=4 from add-to-10 doubles — subtract-self structure at teen level). Single-step count-back, decade-anchor result. Class B aliases correct → off-by-one chips. |
| P3 | "Thirteen minus three. How many are left?" | 13-3=10 | EASY | take-to-decade | DEC=10 ALIAS | ✅ Three-step count-back; first explicit take-to-decade exemplar of the session — sets up the strategy Marian will need for the discriminate tier. Class B aliases correct → off-by-one chips. End of gentle ramp on the correct band. |
| P4 | "Fourteen minus two. How many are left?" | 14-2=12 | MEDIUM | subtract-two | DEC=10 CLEAN sep 2 | ✅ First discriminate-tier problem. MEDIUM-band, two-step count-back, CLEAN Class B. Chip values {10, 12, 13} — the child who decade-anchors at 10 picks the trap; the child off-by-one picks 13. Genuine diagnostic. |
| P5 | "Fifteen minus five. How many are left?" | 15-5=10 | MEDIUM | take-to-decade | DEC=10 ALIAS | ✅ Dave § 4.2 names this exemplar by name ("result = 10 — especially memorable and should be present in the pool"). Marian knows 5+5=10 from add-to-10 sums-to-10 — the bridge mental model is right there. Five-step count-back at MEDIUM; result-equals-decade anchor. This is the session's high-leverage anchor (rule 4: ≥1 take-to-decade in P4-P8 satisfied). |
| P6 | "Fifteen minus three. How many are left?" | 15-3=12 | MEDIUM | subtract-three | DEC=10 CLEAN sep 2 | ✅ Three-step count-back at MEDIUM. CLEAN Class B → chip values {10, 12, 13}. The same chip distribution as P4 (12 correct, 10 trap, 13 off-by-one), allowing the child to re-encounter the decade-anchor lure pattern on a different operand triple — reinforcement of the discrimination skill. |
| P7 | "Seventeen minus five. How many are left?" | 17-5=12 | HARD | general | DEC=10 CLEAN sep 2 | ✅ First HARD-band entry. Five-step count-back from a 17-minuend. Dave § 4.2 calls 5-step count-backs "the threshold where decade-anchor miss is most relevant." CLEAN Class B; chip values {10, 12, 13}. Marian's canonical "anchored at 10 instead of counting through" diagnostic surface. |
| P8 | "Eighteen minus six. How many are left?" | 18-6=12 | HARD | general | DEC=10 CLEAN sep 2 | ✅ Six-step count-back from an 18-minuend. HARD-band closer; CLEAN Class B. Same chip values {10, 12, 13} as P4/P6/P7 — quadruple exposure to the decade-anchor lure pattern across the discriminate tier (P4, P6, P7, P8) is intentional reinforcement, not monotony — each fact's operand triple is distinct, only the chip-value structure recurs. |

**Mechanical rule checks:**

- **Category caps** (`SUB_TO_TWENTY_RULES.categoryCaps`): subtract-one=1 ✓ (cap 1), doubles-anchor=1 ✓ (cap 1), take-to-decade=2 ✓ (cap 2; 13-3 EASY + 15-5 MEDIUM), subtract-two=1 ✓ (cap 1), subtract-three=1 ✓ (cap 1), general=2 ✓ (cap 2; 17-5 + 18-6). **Every cap at-or-below — sum 8 of 8 slots accounted for.**
- **Band-by-slot** (`SUB_TO_TWENTY_RULES.bandAllowedSlots`): EASY at P1-P3 only ✓ (P1, P2, P3); MEDIUM at P4-P8 ✓ (P4, P5, P6); HARD at P5-P8 ✓ (P7, P8). **No band violations.**
- **Take-to-decade coverage** (`SUB_TO_TWENTY_RULES.takeToDecadeInP4ToP8Min`): 1 in P4-P8 (15-5 at P5) ✓ (min 1).
- **Class B CLEAN coverage** (`SUB_TO_TWENTY_RULES.cleanClassBInP4ToP8Min`): **4** CLEAN-annotated facts in P4-P8 (P4 14-2, P6 15-3, P7 17-5, P8 18-6) ✓ (min 2). Strongly over-delivers — every discriminate-tier problem except P5 (the take-to-decade anchor) is Class B CLEAN.
- **No duplicates** ✓ (8 distinct facts).
- **Dual-exposure rule** ✓ (vacuously satisfied in pure-`−` v1 session).
- **No-borrow** ✓ (every minuend's ones-digit ≥ subtrahend by construction; verified per fact: ones(11)=1≥1, ones(12)=2≥2, ones(13)=3≥3, ones(14)=4≥2, ones(15)=5≥5, ones(15)=5≥3, ones(17)=7≥5, ones(18)=8≥6).

**Pedagogical-fit verdict:** The shipped canon is **pedagogically excellent**. The 4-CLEAN-facts-in-P4-P8 distribution (well above the 2 minimum) means Marian encounters the decade-anchor-miss diagnostic surface on the maximum proportion of discriminate problems the pool can deliver — exactly the "Class B is the sub-to-20-specific learning surface" thesis from Dave's research note `sub-to-20-pedagogical-sequence.md` § 3 / Class B. The single take-to-decade anchor at P5 (15-5, Dave's named exemplar) bridges Marian's add-to-10 sums-to-10 fluency into the subtract-down-to-decade strategy without leaning on it across multiple problems. The HARD-band closers (17-5, 18-6) deliver high-WM-load count-backs Marian will use her counting-back strategy on, both with CLEAN Class B — exactly where the discrimination skill matters most.

**No pedagogical-fit gap surfaced by the audit.**

**Marian-readiness context** (per `[[project_marian_not_using_yet]]`): Marian is not actively using the app on her iPad as of 2026-05-23 (Thomas's call 2026-05-14, content + polish phase). sub-to-20 will not surface in her sessions until after she promotes through sub-to-10. The canon is shipped for Jessica's E2E + Devon's screenshot review — not for live-tier use — so any re-bake (if recommended) would have ZERO Marian-disruption blast radius. This lowers the calculus on Pattern 6 / Pattern 7 additions: they are pure defense-in-depth investments.

---

## § 3 — Composition-lint binding — EXISTS, comprehensive, drift-guarded

**Matt's pre-audit claim, empirically verified to be inaccurate.** The dispatch brief states: "no compositionLint binding exists for sub-to-20 today; the cap rules sit only in the directive prose, not as a mechanical gate." This is false.

**Evidence of the existing binding:**

- `scripts/compositionLint.ts:931-955` — `SubToTwentyBand` + `SubToTwentyCategory` + `SubToTwentyDecStatus` types, plus the `SubToTwentyPoolFact` interface (`id`, `a`, `b`, `band`, `category`, `decStatus`).
- `scripts/compositionLint.ts:968-1148` — `SUB_TO_TWENTY_POOL` — all 22 facts with full annotation (band, category, DEC status).
- `scripts/compositionLint.ts:1152-1186` — `SUB_TO_TWENTY_RULES` config (pool reference + categoryCaps + bandAllowedSlots + takeToDecadeInP4ToP8Min + cleanClassBInP4ToP8Min + totalProblems).
- `scripts/compositionLint.ts:1209-1216` — `parseSubToTwentyReadLine` (exported, teen-extended NUMBER_WORDS at `:1221-1242`).
- `scripts/compositionLint.ts:1247-1271` — `extractSubToTwentyProblems` (reads `math.pN.read` utterances, parses, pool-matches).
- `scripts/compositionLint.ts:1279-1433` — `lintSubToTwentyComposition` — full lint with 6 violation classes: `unparseable-problem`, `pool-membership`, `band-by-slot`, `category-cap`, `high-leverage-coverage` (covering BOTH take-to-decade and Class-B-CLEAN), `no-duplicates`.
- `scripts/compositionLint.ts:1442-1451` — `assertSubToTwentyCompositionClean` — throwing wrapper used at bake-time.
- `scripts/compositionLint.ts:3893-3905` — `resolveTierBinding` wires `math/level-1/sub-to-20.json` to `{ tier: 'sub-to-20', config: SUB_TO_TWENTY_RULES }`. The inline comment at `:3893-3899` reads: "sub-to-20 binding ACTIVATED in the rebake PR (ticket 86c9utet9). The committed `public/canon/math/level-1/sub-to-20.json` was rebaked from a stub fixture into a clean Haiku-baked plan…" — so the binding has been live since the rebake PR.
- `scripts/compositionLint.ts:4054-4055` — dispatch case for `'sub-to-20'` calls `lintSubToTwentyComposition`.

**Drift-guard test coverage:**

- `scripts/compositionLint.test.ts:3649-3694` — `SUB_TO_TWENTY_POOL drift-guard against MATH_TRACK_GUIDE directive prose` — parses the FACT POOL block out of the directive at runtime + asserts deep equality with the mirror constant + includes the "drop the DEC annotation" mutation-detection test (a sanity check that confirms the parser actually catches drift, not just confirms two snapshots match).
- `scripts/compositionLint.test.ts:3715-3771` — `SUB_TO_TWENTY_RULES.bandAllowedSlots drift-guard against directive prose` — parses the "Problems 1-3" + MEDIUM + HARD band rule prose, mirror constant, two-sided equality, plus a `extractTierBlock` sanity test (`:3763-3771`) that confirms the tier-scoping helper isolates the sub-to-20 block from sub-to-10's `take away` prose and add-to-10's `plus` prose.

**Unit-test coverage:**

- `scripts/compositionLint.test.ts:2664-2769` — `SUB_TO_TWENTY_POOL` sanity (22-fact length, unique ids, every fact's category in pool, every fact respects no-borrow, EASY/MEDIUM/HARD counts, DEC-status counts, REJECT case for known borrow facts NOT in pool).
- `scripts/compositionLint.test.ts:2775-2815` — `SUB_TO_TWENTY_RULES` sanity (totalProblems=8, category caps individually, bandAllowedSlots per band, takeToDecadeInP4ToP8Min, cleanClassBInP4ToP8Min).
- `scripts/compositionLint.test.ts:~2820-3389` — `lintSubToTwentyComposition` behaviour tests covering every violation class (clean canon, pool-membership reject, category-cap violation, band-by-slot violation, take-to-decade-coverage violation, Class-B-coverage violation, no-duplicates violation), plus `assertSubToTwentyCompositionClean` wrapper tests.
- `scripts/compositionLint.test.ts:3398-3415` — `resolveTierBinding — sub-to-20` confirming the path-binding wiring (both separator flavours).

**Net:** the sub-to-20 lint is the MOST comprehensive tier binding in the codebase. It has rules that don't exist for any other tier (Class-B-coverage), drift-guards that match sub-to-10's (POOL + bandAllowedSlots), and a working tier-scoped extractor for the sibling-block-disambiguation problem identified in `planner-and-canon.md`.

**The audit cycle continues to be load-bearing as a check on planner-state claims.** This is the SECOND consecutive cycle where Matt's pre-audit binding-status claim was empirically wrong (B1 add-to-10 had the same shape: Matt said "no binding"; binding existed at `scripts/compositionLint.ts:594-720`). Per `[[feedback_canon_state_empirical_verification]]` this is exactly the failure mode the audit cycle exists to catch. Pattern strong enough to recommend Matt's dispatch briefs include a self-check before stating binding existence: a `git grep -l "SUB_TO_TWENTY\|SubToTwenty"` (or equivalent for the relevant tier) takes 5 seconds and would catch this every cycle.

**Sub-finding for Track B5 scope:** Matt's pre-audit hypothesis ("the most likely gap: triple-pin coordinate; no compositionLint binding exists") had ONE element correct (Pattern 7 triple-pin is missing) and ONE element wrong (the binding exists). The remaining cap-binding-creation work the brief implies for B6 is already done.

---

## § 4 — Risk register: what could a re-bake under sharpened directive break?

**Marian-active-tier risk:** sub-to-20 IS NOT the tier Marian is on today (per `[[project_marian_not_using_yet]]` she is not on the app at all). Even when she does start, sub-to-20 is two promotions away (add-to-10 → add-to-20 → sub-to-10 → sub-to-20). Re-bake blast radius today is **purely Jessica E2E specs + Devon design-review screenshots**, NOT live-tier disruption.

| Risk | Likelihood | Blast radius | Mitigation |
|---|---|---|---|
| Re-bake produces a Haiku-prior-saturation violation (analog of PR #266 add-to-10 doubles trifecta) | LOW | Bake-time rejection by `assertSubToTwentyCompositionClean` (no production impact). Bake-cost ~$0.005 per attempt per `planner-and-canon.md`. | sub-to-20 has no documented Haiku-prior-saturation failure mode (compare: PR #266 attempts 1-2 for add-to-10's doubles trifecta; PR #280 attempts 1-4 for add-to-20's make-ten-bridge saturation). The pool category distribution naturally resists saturation — take-to-decade is the dominant category (7 of 22 facts) and has the relaxed cap of 2. Risk is LOW empirically. |
| Sharpened directive (Pattern 6 hoist) disturbs other tier blocks via attention-budget shift | LOW | sub-to-10 / add-to-10 / add-to-20 / two-digit-addsub directives are independent blocks; sharpening sub-to-20 affects only sub-to-20 bakes. | None needed; cross-tier independence verified in `MATH_TRACK_GUIDE` block structure. |
| E2E specs hard-code the exact fact sequence (P1=11-1, ..., P8=18-6) and break on re-bake | UNKNOWN | Jessica spec failures at next bake. | If existing E2E specs assert on fact-sequence (rather than on band/category invariants), they need adjustment regardless. **Spot-check** `e2e/` for any `Fourteen minus two` / `Eighteen minus six` literal-string assertion before triggering a re-bake. If found, refactor to assert on rule-class-level invariants (band, no-borrow, ≥1 take-to-decade in P4-P8, etc.) — these are what the lint already covers and what a re-bake preserves. |
| Sharpened directive emits a fact in the pool but outside the canon's current rotation (e.g., picks 16-4 CLEAN instead of 14-2 CLEAN as the MEDIUM/CLEAN P4) | LIKELY (Haiku non-determinism) | If shipped, the new canon differs from existing in 1-3 facts. No semantic break — both fact sets honour all rules. | Acceptable as long as composition-lint passes; no special mitigation. The canon is regenerated, not fact-stable. |
| Pattern 7 triple-pin edit introduces typo in SPEC or LINT pointer | LOW | Drift-guard test catches it. | Verify SPEC path = `design/math/sub-to-20-content.md§1.1` (or `§2.2` for Class-B-coverage); LINT path = `scripts/compositionLint.ts:968` (POOL) + `:1165` (RULES) + `:3900` (BINDING). |
| **No planner-test sub-to-20 coverage** — directive-side regression goes undetected | MEDIUM (today) | A future directive edit that, e.g., flips a number-word lookup or breaks the read-line template would be caught by lint drift-guards ONLY if it crosses a POOL or bandAllowedSlots boundary. Subtle prose drift (e.g. accidentally re-introducing a `take away` template option) would surface only at Haiku-emission time. | **Defense-in-depth follow-up (not a B5 blocker):** add a planner-test stubbing Haiku, returning a sub-to-20 plan, asserting (a) every read-line matches the "minus" template; (b) no read-line contains "take away"; (c) every (a, b) pair is in the 22-fact pool; (d) ≥1 take-to-decade in P4-P8; (e) ≥2 CLEAN at P4-P8; (f) the directive includes the `[BAND/category]` + `DEC=` annotations (`expect(systemText).toContain('14-2=12  [MEDIUM/subtract-two]')`); (g) the per-tier `not.toMatch(/emit\s+distractorClass/i)` per `planner-and-canon.md` § "Drift-guard shape for these locks" (currently sub-to-10 has this assertion at `_planner.test.ts:3289-3332`; sub-to-20 does not). |

**Overall risk verdict:** Re-bake is LOW-risk and LOW-value. (a) Marian not on the tier, (b) composition-lint catches violations at bake-time before disk write, (c) no documented Haiku-prior-saturation failure mode for this tier, (d) the existing canon is rule-clean and pedagogically excellent. **Don't re-bake**.

---

## § 5 — Recommendation

**SHIP NOTHING FROM B5. Audit closes with "no drift; close audit" verdict. SKIP B6 (Devon directive sharpen). SKIP B7 (Jessica regression spec). File two deferred follow-up tickets at LOWER priority than the next math-tier content work.**

**Confidence: HIGH.**

### Why close-audit

The sub-to-20 directive at `api/_planner.ts:1112-1187` is materially the sharpest math-track directive in the codebase as of 2026-05-23. It honours Patterns 1, 2, 4, 5 of the playbook, plus three sub-to-20-specific extensions (DISTRACTOR-COVERAGE SELF-CHECK, READ-LINE NEGATIVE ANCHOR, PER-PROBLEM SHAPE qualifier) that should arguably be promoted to the playbook itself. The composition-lint binding is the most comprehensive in the codebase. The shipped canon is rule-clean and pedagogically excellent.

The two missing Pattern items (6 + 7) are:

1. **Pattern 6 cluster** (CATEGORY-MIX BUDGET hoisted FIRST + FAILURE MODES BOTH WAYS + WORKED EXAMPLE) — defense-in-depth against a Haiku-prior-saturation failure mode this tier has no empirical history of exhibiting. Low value relative to the directive-touch cost. The CATEGORY-CAP SELF-CHECK at `_planner.ts:1163-1170` already covers the same rule-enforcement work in a different visual shape (consolidated, with worked rejections covering every cap interaction). Stylistic harmonisation worth doing eventually for fleet-wide consistency, NOT load-bearing for this tier's correctness.
2. **Pattern 7 triple-pin drift-guard tag** — single-character documentation coordination tag. Validated 2026-05-23 on `two-digit-addsub-with-regroup` (Dave's PR #314); not yet rolled out elsewhere. Cost: 1 line. Value: visibility into rule-config ↔ spec ↔ lint coordination for future maintainers. Low-priority addition; not a quality gate.

### Why skip B6

Re-baking just to land Pattern 6 / Pattern 7 cosmetic improvements (with no documented Haiku-prior-saturation failure mode to correct on this tier) is **directive churn without informational content change**. The shipped canon is already clean. The directive is already the sharpest. The investment is better spent on tiers that DO have documented saturation failures (add-to-10 per PR #266; add-to-20 has its hoist).

### Why skip B7

Per Wave 7 plan logic: "re-bake without behaviour change doesn't need a new spec." If B6 is skipped (which it is here), B7 (regression spec) is structurally moot — there is no behaviour change to regress against. Existing lint drift-guards + the §6.5 canon-lint CI gate already cover the rule-class-level invariants.

### Deferred follow-ups (file as separate tickets, lower priority than next math-tier content)

1. **`api/_planner.test.ts` — add a sub-to-20 directive-side test suite.** Mirror `_planner.test.ts:3289-3332` shape (the sub-to-10 distractorClass drift-guard). Assertions: (a) every directive-emitted plan's read-lines match the "minus" template; (b) no "take away" in any read-line; (c) every (a, b) pair is in the 22-fact pool; (d) ≥1 take-to-decade in P4-P8; (e) ≥2 CLEAN at P4-P8; (f) the directive systemText contains the `[BAND/category]` + `DEC=10` annotations; (g) the directive does NOT instruct Haiku to emit `distractorClass` (`not.toMatch(/emit\s+distractorClass/i)` + the MAY-mention-MUST-qualify variant). **Estimated effort:** 1 hour. **Owner:** Kevin or any persona — pure test-authoring work, no directive edit. **Risk this addresses:** subtle directive prose drift that crosses neither POOL nor bandAllowedSlots boundary (and thus escapes existing lint drift-guards) but breaks plan composition.
2. **`api/_planner.ts:1112` — add `<drift-guard RULE_IDENTITY=sub-to-20; SPEC=design/math/sub-to-20-content.md§1.1; LINT=scripts/compositionLint.ts:968 (POOL) + 1165 (RULES) + 3900 (BINDING)>` tag at the start of the block.** Mirror two-digit-addsub-with-regroup's `_planner.ts:1306` shape. **Estimated effort:** 1 minute. **Owner:** any persona on a future sub-to-20-touching PR (don't open a one-line PR for it; bundle into the next sub-to-20 work). **Risk this addresses:** future maintainer doesn't know where to look for the rule-config and spec.
3. **Cross-cycle Matt pre-audit hygiene.** Ask Matt to grep for the relevant `<TIER>_POOL` / `<TIER>_RULES` symbols before declaring "binding doesn't exist" in dispatch briefs. Two consecutive cycles (B1 add-to-10 + B5 sub-to-20) have surfaced this. **Estimated effort:** 0 (briefing change). **Owner:** orchestrator / Matt. **Risk this addresses:** audit cycle continues to absorb the empirical-verification burden Matt's brief should be carrying.

### Bake-cost expectation

**Zero — no re-bake recommended.**

### Re-bake decision

**Do NOT re-bake.** The shipped canon is composition-lint-clean and pedagogically excellent. A re-bake under stylistic Pattern 6 / Pattern 7 additions has no informational content change and risks the LIKELY-row-risk above (canon differs in 1-3 facts; E2E specs that hard-code values break). The follow-up tickets above capture the long-tail improvements without forcing a re-bake.

---

## Cross-references

- **Spec** — `design/math/sub-to-20-content.md` (Kyle, PR #269; 689-line comprehensive 22-fact-pool spec).
- **Research** — `design/research/sub-to-20-pedagogical-sequence.md` (Dave, 2026-05-16, PR #267 — the curriculum authority).
- **Sibling audit precedent** — `design/research/add-to-10-canon-audit-2026-05-23.md` (Dave B1, same wave; same shape applied here).
- **Sibling directive (Pattern 6 reference)** — `api/_planner.ts:1011-1054` (add-to-20 — CATEGORY-MIX BUDGET first + WORKED EXAMPLE).
- **Sibling directive (Pattern 5 cap-self-check, multi-block shape)** — `api/_planner.ts:1086-1090` (sub-to-10 — per-category self-check blocks: GENERAL-CATEGORY CAP, DOUBLES-CAP, SUBTRACT-ONE-CAP, SUBTRACT-TWO-CAP).
- **Sibling directive (Pattern 7 triple-pin reference)** — `api/_planner.ts:1306` (two-digit-addsub-with-regroup — Dave's PR #314 exemplar).
- **Composition-lint binding** — `scripts/compositionLint.ts:905-1451` (`SUB_TO_TWENTY_POOL`, `SUB_TO_TWENTY_RULES`, `lintSubToTwentyComposition`, `assertSubToTwentyCompositionClean`); path-binding at `:3893-3905`; dispatch case at `:4054-4055`.
- **Drift-guard tests** — `scripts/compositionLint.test.ts:3649-3694` (POOL) + `:3715-3771` (bandAllowedSlots).
- **Bake-time wiring** — `scripts/generateSessionCanon.ts` — `assertSubToTwentyCompositionClean` gated on `focusNode === 'sub-to-20'`.
- **Marian level** — `CLAUDE.md` line "Subtraction — Within 15 confident, extend to 20 no-borrow" (April 2026 diagnostic).
- **Marian-app-status** — `[[project_marian_not_using_yet]]` (Thomas's call 2026-05-14; content + polish phase).
- **Sharpening playbook** — `[[feedback_haiku_directive_sharpening]]` (7 patterns).
- **Distractor-class principle** — `[[feedback_distractor_class_pedagogical_gates_mechanical]]` (pedagogical fit gates mechanical fit — applied throughout § 2).
- **Canon-state empirical verification** — `[[feedback_canon_state_empirical_verification]]` (any "ships with X facts of Y" claim must be paired with verifying grep/cat output — applied throughout § 2 + § 3).
- **Wire shape utterance-only invariant** — `.claude/docs/planner-and-canon.md` § "Wire shape is utterance-only — invariant" + § "Drift-guard shape for these locks" (informs the §4 deferred-follow-up #1 test assertions).

---

## Non-obvious findings for orchestrator routing

1. **The sub-to-20 compositionLint binding ALREADY EXISTS** (`scripts/compositionLint.ts:905-1451` + path binding at `:3893-3905`). Matt's pre-audit dispatch brief claim is empirically inaccurate. **This is the SECOND consecutive cycle** (B1 add-to-10 had the same empirical-inaccuracy on Matt's binding-existence claim). Recommend a hygiene addition to Matt's dispatch-brief workflow: grep for `<TIER>_POOL` / `<TIER>_RULES` symbols before claiming binding absence.
2. **The sub-to-20 directive is materially the sharpest math-track directive in the codebase** — it carries the most-elaborate FACT POOL inline annotation (`[BAND/category] (DEC=…)`), the most-explicit DISTRACTOR-COVERAGE SELF-CHECK (with pre-computed maximum-achievable target arithmetic), and a READ-LINE NEGATIVE ANCHOR that other tiers should arguably inherit (the latent silent-wrong-tier-misrender risk applies to add-to-10 / add-to-20 / sub-to-10 too — see `planner-and-canon.md` § "Sibling failure mode"). Consider promoting these three patterns to the 7-pattern playbook as Patterns 8/9/10.
3. **`api/_planner.test.ts` has ZERO sub-to-20 coverage.** All sub-to-20 directive-side regression protection lives in `scripts/compositionLint.test.ts` drift-guards (POOL + bandAllowedSlots prose). The lint drift-guards catch prose drift that crosses a POOL or RULES boundary; they do NOT catch a Haiku-stub plan-composition regression that lands inside-bounds-but-wrong. Filing this as a deferred follow-up (§ 5 deferred follow-up #1).
4. **The shipped canon over-delivers on the Class-B-CLEAN coverage rule** — 4 CLEAN at P4-P8 vs minimum 2. This is structurally the maximum the pool can deliver under category caps (per spec §1.1 "Maximum achievable Class-B-CLEAN count in P4-P8: 5 minus the take-to-decade-required slot at P4-P8 = 4"). The shipped canon is at the pedagogical ceiling for the decade-anchor-miss diagnostic surface — there is no realistic re-bake that would IMPROVE this.
5. **Sub-to-20 has no documented Haiku-prior-saturation failure mode**, unlike add-to-10 (PR #266 doubles trifecta) and add-to-20 (PR #280 make-ten-bridge saturation). The pool's category distribution (take-to-decade as dominant category with the relaxed cap of 2) naturally resists the saturation failure modes the Pattern 6 hoist exists to correct. This is WHY Pattern 6 is defense-in-depth, not load-bearing, for this specific tier.
