# Number Garden — `add-to-20` content tier (cross-10-bridge focus, 22-fact pool, doubles-prior correction, parallel-with-`sub-to-20`)

**Status:** SPEC — draft for Thomas review. Implementation blocked on this PR merging. Kevin/Devon pick up impl after spec approval.
**Ticket:** TBD — orchestrator to file in ClickUp `list_id: 901523003843`. Kyle's MCP scope is read-only on ClickUp; ticket creation routed via orchestrator (per `[[feedback_clickup_forward_only_default]]`).
**Authority chain.**
- Pedagogical baseline: [`design/research/sub-to-20-pedagogical-sequence.md`](../research/sub-to-20-pedagogical-sequence.md) (Dave, 2026-05-16, PR #267) — § 1.2 establishes add-to-20 ↔ sub-to-20 as **parallel acquisition targets** per Illustrative Mathematics K–5, McNeil et al. 2025, Fuson & Kwon 1992; § 2 establishes the L2 Tagalog teen-number transparency note that also applies here.
- Predecessor research: [`design/research/add-to-10-counting-to-recall.md`](../research/add-to-10-counting-to-recall.md) (Dave, 2026-04-29) — Marian's finger-counting profile, doubles + sums-to-10 anchors. add-to-10 mastery is the strategy substrate for add-to-20's make-ten / doubles-plus-N derivations.
- Distractor baseline: [`design/research/math-distractor-and-streak-decisions.md`](../research/math-distractor-and-streak-decisions.md) (Dave, 2026-04-25) — gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`.
- Doubles-prior correction: `.claude/docs/planner-and-canon.md` § "Haiku doubles prior" (Kevin's NOF #1 from PR #266) — confirmed by the current `add-to-20.json` canon (`6+6, 7+7, 8+8, 9+9, 6+7, 7+8, 8+9, 5+9` is doubles-saturated 4-of-8). This spec sharpens directive-side to break that bias.
**Predecessor content specs (structural template):**
- [`design/math/sub-to-20-content.md`](./sub-to-20-content.md) (Kyle, 2026-05-17, PR #269) — section-for-section parallel; deviations called out inline. Same §0–§9 shape.
- [`design/math/add-to-10-content.md`](./add-to-10-content.md) (Kyle, 2026-05-15 / amended 2026-05-16) — the 44-fact factory pool + 5 category caps precedent; this spec adopts the same `sums-to-10 → doubles → plus-one → near-doubles → general` priority pattern, re-anchored on the cross-10-bridge surface.

**Parallel-sequencing positioning (Thomas confirmation pending — see §7.3):** `add-to-20` and `sub-to-20` are parallel tiers per Dave § 1.2. Both unlock once `add-to-10` is mastered. The `MATH_TREE` order today threads them sequentially (`add-to-20 → sub-to-10 → sub-to-20`); the research recommends interleaving once both are conceptually established. **This spec inherits the existing `MATH_TREE` order** — re-sequencing is out of scope (it would be a progression-state-machine PR per `[[feedback_progression_e2e_mandatory]]`).

---

## 0. Why this spec, why now

- `add-to-20` is currently a **doubles-heavy directive at [`api/_planner.ts:964`](../../api/_planner.ts#L964)** — it has good FORBIDDEN guards (sums ∈ [11, 20], both addends ∈ [1, 9], no `10 + n`) but lacks a structured fact pool, band/category taxonomy, distractor-coverage rules, or compositionLint binding. The current baked canon at [`public/canon/math/level-1/add-to-20.json`](../../public/canon/math/level-1/add-to-20.json) reads `6+6, 7+7, 6+7, 8+8, 7+8, 9+9, 8+9, 5+9` — **4 of 8 problems are doubles** (`6+6, 7+7, 8+8, 9+9`) and the remaining 4 are all near-doubles or one general. The bake is "passes the FORBIDDEN guards by happy accident" not "structurally correct by design," exactly the situation Kevin's PR #248 NOF #1 flagged for `add-to-10` and that Kevin's PR #266 NOF #1 named "Haiku doubles prior."
- **Marian's April 2026 diagnostic:** "Sums to 10, drive automaticity (100% finger reliance)." Once `add-to-10` accuracy hits 95/3 and she promotes, `add-to-20` is the natural next addition tier. She has the **doubles anchor** from `add-to-10` (`2+2, 3+3, 4+4, 5+5`) and the **sums-to-10 anchor** (the 9 complementary pairs). The pedagogical job of `add-to-20` is to teach the **cross-10-bridge** — facts where `addendA + addendB > 10` and the child must mentally decompose one addend to reach 10 first (e.g. `8 + 5 = 8 + 2 + 3 = 10 + 3 = 13`). That is the actual learning target; doubles in the teen sum range (`6+6, 7+7, 8+8, 9+9`) are a **distractor from the target**, not the target itself.
- **`add-to-10` shipped its content-tier spec 2026-05-16** (PR #266 ratification); `sub-to-10` and `sub-to-20` shipped their full spec → impl → canon waves on 2026-05-16/17. `add-to-20` is the last untouched in-range tier and the doubles-prior canon empirically argues this spec is overdue.
- **Dave's sub-to-20 research** (`sub-to-20-pedagogical-sequence.md` § 1.2) is the curriculum-side authority for the parallel-acquisition framing AND the cross-10 strategy ladder rationale. This spec consumes it where it speaks; flags one gap to Dave in §7.6.
- **Dave's verdict on visual scaffolding** (sub-to-20 research § 4.5): skip the CRA visual detour entirely. Same ruling carries to `add-to-20` — the 4-chip recognition format IS the representational layer for a child with addition concept. Emma's read-aloud is the anchor. No screen-layer redesign.
- **Dave's verdict on speed-feedback UX** (sub-to-20 research § 4.5, citing `speed-feedback-automaticity-marian.md`): no speed-feedback UI. Slow-fact directive is backend re-targeting only. Same ruling carries to `add-to-20`.

**Scope of this spec:**

- The 22-fact ordered pool (§1) with band + category + per-fact teaching note, prioritising **cross-10-bridge** facts over doubles.
- The problem-mix rules for an 8-problem session drawn from the pool (§2).
- The two distractor classes for `add-to-20` (gentle + off-by-one) — **NO new distractor class** (§3); the open question on a possible Class B "dropped-carry" trap is surfaced in §7.4 (recommendation: REJECT).
- The read-line template + per-slot utterance templates (§4) — reuses the existing `"<addend-A> plus <addend-B>. How many?"` template; no first-encounter variant.
- The schema posture — `add-to-20` reuses `MathFact { a, b, op: '+' }` with no new infrastructure (§5).
- The advancement gate (`add-to-10 → add-to-20`) — accuracy-only per the existing math default `95/3` (§5).
- The dual-exposure rule placeholder for future fact-family interleaving (§5).
- The op- AND tier-aware slow-fact threshold posture — `add-to-20` uses the addition default 5000 ms (§5).
- The wire-up checklist for Kevin (§6).
- Acceptance criteria for Jessica's E2E + Kevin's vitest suites (§6).
- Open questions for Thomas's decision (§7).
- Tracked follow-ups (§8).

**Out-of-scope:**

- **Implementation.** This spec hands off to Kevin (directive sharpening + canon rebake + compositionLint extension) and Devon if any render-side change surfaces (none expected — see §3 + §5).
- **2-digit + 1-digit addition** (e.g. `12 + 5 = 17`, `15 + 3 = 18`). FORBIDDEN here. Belongs in a future `two-digit-addsub` tier (per the existing `MATH_TREE` order). The current directive at `_planner.ts:964` already FORBIDS `10 + n`; this spec preserves and extends that ban to `11 + n` … `19 + n`. See §7.1 for the explicit Thomas decision.
- **Sums > 20** (`9 + 12 = 21`, etc.). FORBIDDEN — out of pool entirely.
- **Sums ≤ 10** (`5 + 5 = 10`, `4 + 6 = 10`, etc.). FORBIDDEN — that is `add-to-10`'s territory. The current directive already says this; spec re-affirms.
- **Mixed `+`/`−` fact-family sessions.** Out for v1. Dual-exposure rule reserves the placeholder; per Dave § 1.2 fact-family interleaving is the natural endpoint, deferred to a future sibling spec.
- **CRA visual scaffolding detour.** Same out-of-scope ruling as sub-to-10 / sub-to-20.
- **Speed-feedback UX.** Same out-of-scope ruling.
- **First-encounter framing variant.** Marian has run dozens of `add-to-10` sessions by the time she reaches `add-to-20`; the `"plus" / "how many?"` template is fully internalised. No "and" → "plus" first-session variant needed. See §7.5 for the explicit Thomas decision.
- **`Math.tsx` UI redesign.** Addition renders through the existing chip-tap pipeline; the screen is operation-agnostic. `chipMaxAnswerForCorrects` already widens to `ANSWER_RANGE_MAX_TO_20 = 20` for any correct ≥ 11 (verified `distractors.ts:107-110`), so `add-to-20` callers inherit `maxAnswer = 20` without code change.
- **Subitising-scaffold extension to `add-to-20` cross-10-bridge.** Per `subitising-scaffold-content.md` §7.2 — open question, deferred to its own future sibling spec.

---

## 1. The 22-fact pool — ordered, banded, categorised, cross-10-bridge prioritised

The pool below is the union of facts Haiku may draw from for any `add-to-20` session. The full surface for `a + b ∈ [11, 20], a ∈ [1, 9], b ∈ [1, 9]` contains **49 ordered facts** (commutative pairs distinct). The 22 below cover every band Dave names and the conceptual categories that index Marian's available strategies, with **deliberate de-emphasis of doubles to correct Haiku's doubles prior** (see §1.4).

> **Out-of-pool reminder.** Every fact in this pool satisfies `a + b ∈ [11, 20], a ∈ [1, 9], b ∈ [1, 9]`. Concretely: `5 + 5 = 10` is FORBIDDEN (sum = 10; belongs in `add-to-10`); `10 + 5 = 15` is FORBIDDEN (`a = 10` exceeds addend range); `12 + 5 = 17` is FORBIDDEN (`a = 12` exceeds addend range). The current directive at `_planner.ts:964` already encodes these guards; the pool below is the curated subset enforced by compositionLint.

### 1.1 Pool table (LOCKED — band structure mirrors `sub-to-20`'s EASY/MEDIUM/HARD ladder; per-fact curation owned by Kyle)

Each fact is annotated with strategy category (the mental-arithmetic pathway Marian is most likely to use). Categories mirror `add-to-10`'s `sums-to-10 → doubles → plus-one → near-doubles → general` priority order, adapted for the cross-10-bridge surface and the doubles-prior correction:

- `doubles` — `a == b` (4 pool facts: `6+6, 7+7, 8+8, 9+9`). High retrieval salience BUT over-represented by Haiku's prior; capped tight.
- `near-doubles` — `|a − b| == 1` AND `min(a, b) ≥ 5` (6 pool facts: `5+6, 6+5, 6+7, 7+6, 7+8, 8+7, 8+9, 9+8` — selected subset below). Doubles-plus-one derivation; the natural bridge strategy. **High pedagogical priority for this tier.**
- `make-ten-bridge` — facts where `addendA + addendB` decomposes naturally through 10 with one addend being a sums-to-10 complement of 10 (e.g. `8 + 5`: decompose 5 as 2 + 3, then `8 + 2 + 3 = 10 + 3 = 13`). Includes the canonical `8+3, 9+2, 9+3, 9+4, 7+4` etc. **The actual learning target of this tier per Dave § 1.2 and the doubles-prior correction.** 8 pool facts.
- `near-ten` — `min(a, b) == 1 AND a+b ≥ 11` (count-on-one from a teen-anchor; trivial). 2 pool facts (`9+2` lives in `make-ten-bridge` per priority; `8+3` similarly).
- `general` — everything else (cross-10 facts with no single dominant strategy). 4 pool facts.

| #   | Fact          | Band   | Category           | Teaching note                                                                                                                                                       |
| --- | ------------- | ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `9 + 2 = 11`  | easy   | make-ten-bridge    | Smallest cross-10-bridge. Marian decomposes 2 as 1 + 1: `9 + 1 + 1 = 10 + 1 = 11`. Lowest WM load in the tier. (Sub-to-20 § 4.2 EASY analog: `11-1=10` opens.)       |
| 2   | `2 + 9 = 11`  | easy   | make-ten-bridge    | Commutative pair. Marian may flip to `9 + 2` mentally (commutativity is well-internalised by the time she reaches add-to-20). Reinforces order-irrelevance.         |
| 3   | `8 + 3 = 11`  | easy   | make-ten-bridge    | Decompose 3 as 2 + 1: `8 + 2 + 1 = 10 + 1 = 11`. The canonical "bridge-through-10" model with 8 as the anchor (one of the highest-leverage anchors per Dave § 1.2).  |
| 4   | `3 + 8 = 11`  | easy   | make-ten-bridge    | Commutative pair.                                                                                                                                                   |
| 5   | `9 + 3 = 12`  | easy   | make-ten-bridge    | Decompose 3 as 1 + 2: `9 + 1 + 2 = 10 + 2 = 12`. Bridges to 12, the doubles `6+6` partner — pedagogically connects make-ten-bridge to doubles.                       |
| 6   | `6 + 6 = 12`  | easy   | doubles            | Smallest teen-doubles. Marian retrieves; doesn't decompose. Anchor for `near-doubles` derivations (`6+7 = 6+6+1`).                                                  |
| 7   | `9 + 4 = 13`  | medium | make-ten-bridge    | Decompose 4 as 1 + 3: `9 + 1 + 3 = 10 + 3 = 13`. Canonical cross-10 with 9 as anchor (smallest decomposition step). High pedagogical priority.                       |
| 8   | `4 + 9 = 13`  | medium | make-ten-bridge    | Commutative pair.                                                                                                                                                   |
| 9   | `8 + 5 = 13`  | medium | make-ten-bridge    | Decompose 5 as 2 + 3: `8 + 2 + 3 = 10 + 3 = 13`. The canonical worked example in Dave § 1.2; iconic cross-10-bridge teaching fact.                                  |
| 10  | `5 + 8 = 13`  | medium | make-ten-bridge    | Commutative pair.                                                                                                                                                   |
| 11  | `6 + 7 = 13`  | medium | near-doubles       | Doubles-plus-one: `6 + 6 = 12, + 1 = 13`. Derives from #6 (which appears in EASY); high-leverage if doubles is retrieved.                                           |
| 12  | `7 + 6 = 13`  | medium | near-doubles       | Commutative pair.                                                                                                                                                   |
| 13  | `7 + 7 = 14`  | medium | doubles            | Teen-double anchor; retrieved not derived. Doubles cap is 2; this is the only MEDIUM-band double.                                                                   |
| 14  | `9 + 5 = 14`  | medium | make-ten-bridge    | Decompose 5 as 1 + 4: `9 + 1 + 4 = 10 + 4 = 14`. Bridges to 14, the `7+7` partner.                                                                                  |
| 15  | `7 + 8 = 15`  | hard   | near-doubles       | Doubles-plus-one: `7 + 7 = 14, + 1 = 15`. The 7-double anchor (#13) carries this; high-leverage derivation.                                                          |
| 16  | `8 + 7 = 15`  | hard   | near-doubles       | Commutative pair.                                                                                                                                                   |
| 17  | `9 + 6 = 15`  | hard   | make-ten-bridge    | Decompose 6 as 1 + 5: `9 + 1 + 5 = 10 + 5 = 15`. Bridges to 15, sums-to-15 anchor.                                                                                  |
| 18  | `9 + 7 = 16`  | hard   | make-ten-bridge    | Decompose 7 as 1 + 6: `9 + 1 + 6 = 10 + 6 = 16`. Cross-10 with 9 as anchor; commutes with `7+9`.                                                                    |
| 19  | `8 + 8 = 16`  | hard   | doubles            | Teen-double anchor; retrieved. Doubles cap is 2; co-occurs with #6 OR #13 OR #20 but never more than 2 across the session.                                          |
| 20  | `9 + 8 = 17`  | hard   | make-ten-bridge    | Decompose 8 as 1 + 7: `9 + 1 + 7 = 10 + 7 = 17`. Largest cross-10 with 9 as anchor.                                                                                 |
| 21  | `8 + 9 = 17`  | hard   | near-doubles       | Doubles-plus-one from `8+8=16`: derivation chain (#19 → #21). Commutes with #20 conceptually but the *strategy* differs — make-ten-bridge vs near-doubles.            |
| 22  | `9 + 9 = 18`  | hard   | doubles            | Highest teen-double. Anchor for the future `9+10=19` mental model. Retrieved.                                                                                       |

**Band counts:**
- `easy` — 6 facts (#1–6): make-ten-bridge ×5 (#1, #2, #3, #4, #5), doubles ×1 (#6).
- `medium` — 8 facts (#7–14): make-ten-bridge ×5 (#7, #8, #9, #10, #14), near-doubles ×2 (#11, #12), doubles ×1 (#13).
- `hard` — 8 facts (#15–22): make-ten-bridge ×3 (#17, #18, #20), near-doubles ×3 (#15, #16, #21), doubles ×2 (#19, #22).

**Category counts:** make-ten-bridge ×13 (largest — the actual learning target) · near-doubles ×5 · doubles ×4 · general ×0 (in this curation; see §1.4 for why). **Total: 22 facts.**

> **Sanity-check note on category math.** The total of make-ten-bridge ×13 + near-doubles ×5 + doubles ×4 = 22 facts, balancing the §1.1 table. Verify against §1.1 row-by-row: the 13 make-ten-bridge facts are #1, #2, #3, #4, #5, #7, #8, #9, #10, #14, #17, #18, #20; the 5 near-doubles are #11, #12, #15, #16, #21; the 4 doubles are #6, #13, #19, #22. No `general`-category facts in v1 (rationale §1.4).

### 1.2 Pool-composition cross-check

- **Answer range:** `[11, 18]`. The chip-range ceiling is `maxAnswer = ANSWER_RANGE_MAX_TO_20 = 20`, threaded automatically by `chipMaxAnswerForCorrects` (`distractors.ts:107-110`) for any correct ≥ 11. **No code change required.**
- **`correct ≥ 11` is the existing add-to-20 widening surface** — sub-to-20 already validated the same ceiling on `op === '-'`; `add-to-20` continues the same behaviour on `op === '+'`.
- **`correct ∈ {11, 12, 13, ..., 18}` only** — no correct = 19 or 20 in v1 pool (the only candidates would be `9+10=19` or `10+10=20` which violate the `addend ≤ 9` ban). If Thomas re-opens the `10 + n` ban (§7.1), the pool widens to include 19-correct facts; the chip ceiling of 20 already accommodates them.
- **Addend range:** `[1, 9]` for both `a` and `b`. Strict — no `10 + n` (current directive `_planner.ts:964` already FORBIDS this; spec re-affirms).
- **`MathFact` representation:** every pool fact maps cleanly to `{ a: addendA, b: addendB, op: '+' }`. No schema changes; reuses the `op: '+'` field threaded through `MathProblem` post-PR #241.
- **Commutativity:** ordered pairs are DISTINCT facts (matching the `add-to-10` precedent §2.6). `9 + 2` and `2 + 9` are two separate pool entries. Read-lines speak differently; chip-tap order is audio-sensitive. The dual-exposure rule (§5.3) treats them as a single operand triple for cross-`+`/`−` pairing purposes.

### 1.3 Why these 22, not more (or fewer)

The 49-fact full surface contains many redundant facts (e.g. all 7 commutative pairs of `1+n` and `n+1` for `n ∈ [10, 19]` — wait, `n` would have to ≤ 9 per the addend ban, so `1+10` etc. are out; what remains are `2+9, 9+2, 3+8, 8+3, 4+7, 7+4, 5+6, 6+5`). The 22-fact curation:

1. **Prioritises `make-ten-bridge` facts** (13 of 22, 59%) — the actual pedagogical target of the tier per Dave § 1.2. This is the **doubles-prior correction lever**: by composing the pool so over half the facts are make-ten-bridge, even random Haiku selection produces a make-ten-heavy session.
2. **Caps `doubles` at 4 pool entries** (`6+6, 7+7, 8+8, 9+9`) with a session cap of 2 (§2.2). The current canon (`6+6, 7+7, 8+8, 9+9` all present) is 100% saturation of the doubles surface; the v1 spec halves that to ≤2 per session.
3. **Includes both commutative pairs for every `make-ten-bridge` fact** — Marian's commutativity intuition is well-established by `add-to-10` mastery; including both orders reinforces that `9+2 = 2+9` rather than treating them as separate learning targets. This also doubles the available `make-ten-bridge` pool surface without inventing new conceptual facts.
4. **Excludes `4+7, 7+4, 5+6, 6+5, 4+8, 8+4`** — these are valid cross-10 facts but their bridge strategy is less clean than the canonical `8+5, 9+4` family (decomposing 7 as 3+4 is harder than decomposing 5 as 2+3). Marian may use a count-on strategy for these instead of bridging through 10, which is pedagogically OK but less aligned with the tier's stated learning target. Tracked in §8 follow-ups as a v2 widening once make-ten-bridge is fluent.
5. **Excludes `7+5, 5+7, 4+8, 8+4, 4+9` and similar** — same rationale; pool extension deferred.
6. **No `general` category in v1** — every fact in the pool maps to one of doubles / near-doubles / make-ten-bridge. The "everything else" bucket would dilute the doubles-prior correction by giving Haiku a slop bucket. If a future pool widening (§8) adds the excluded facts, those become the `general` bucket and the category cap kicks in.

**The non-redundancy argument.** A pool of 22 facts for 8-problem sessions gives a soak factor of 22/8 = 2.75×. Across 5–6 sessions, every pool fact is seen on average twice. That is the right intensity for retrieval automaticity per the `add-to-10` 44/8 = 5.5× soak (which was audited HOLD in `add-to-10-content.md` §1.6). add-to-20 ships at a tighter pool because the per-fact pedagogical weight is higher (each fact represents a deliberate cross-10 strategy moment, not a fact-family closure exercise).

### 1.4 The doubles-prior correction — why `general = 0` and why the pool is small

Kevin's PR #266 NOF #1 ("Haiku doubles prior") identified that Haiku, when prompted with a generic "addition with sums 11-20" instruction and no structured pool, gravitates to doubles and near-doubles. The empirical evidence is the current `add-to-20.json` canon: `6+6, 7+7, 6+7, 8+8, 7+8, 9+9, 8+9, 5+9` — **4 doubles, 3 near-doubles, 1 general** in an 8-problem session.

The correction strategy mirrors `feedback_haiku_directive_sharpening`'s validated patterns (see `.claude/docs/planner-and-canon.md` § "Haiku directive-sharpening patterns"):

1. **Inline band tags** (`[EASY/make-ten-bridge]`) per `add-to-10` and `sub-to-20` precedents — gives Haiku per-fact context about pedagogical role at the point of selection.
2. **Negative anchors over positive quantifiers** — instead of "lean on cross-10-bridge facts," the directive (§4.1) explicitly says "DO NOT place more than 2 doubles in a session" and lists the 4 doubles facts that compete for those 2 slots.
3. **Per-rule self-checks against attention-budget-shift** — the DISTRACTOR-COVERAGE SELF-CHECK and DOUBLES-CAP SELF-CHECK explicitly walk Haiku through counting category fills before finalising.
4. **Drift-guard wording** — the rule wording is positive ("Pick exactly 2 make-ten-bridge facts from #1–5 for P1–P3") rather than aspirational ("favour make-ten-bridge"). Self-checks make the rule self-enforcing.

The `general = 0` choice is part of the same correction: if the pool offers no slop bucket, Haiku cannot over-select facts whose pedagogical role is unclear. Every pool fact is unambiguously categorised; Haiku's job is selection within tight categorical structure.

### 1.5 Pool-extension policy

Pool extensions beyond 22 are deferred (§8 follow-ups):

- **Cross-10-bridge widening** — once Marian's empirical data shows the 13 make-ten-bridge facts are fluent, widen to include `7+4, 4+7, 5+6, 6+5, 7+5, 5+7, 4+8, 8+4` (the secondary bridge facts). These are valid cross-10 facts; deferred until v1 pool stabilises.
- **Sums-to-20 widening** — facts like `9+10=19, 10+10=20` are FORBIDDEN here per the addend ban. A v2 spec ("add-to-20-with-tens") could widen `addend ≤ 10`; out of scope for v1.
- **Mixed `+`/`−` fact-family interleaving** — Dave § 1.2 supports it as the natural endpoint; deferred to a future sibling spec post-sub-to-20 wave settlement.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 22-fact pool above. Identical structural shape to `sub-to-20-content.md` §2 + `add-to-10-content.md` §2: warm-up gentle ramp on EASY, discriminate tier on MEDIUM + HARD with category caps and high-leverage coverage.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source             | Distractor class (§3)                      | Why                                                                                                                                                          |
| ------------- | ------------ | ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1            | gentle       | `easy` band only        | Class 0 — gentle (≥2 away, range extremes) | Session opener. Same posture as add-to-10 / sub-to-20. `GENTLE_RAMP_THROUGH = 3` cutoff preserved verbatim (Dave's 2026-04-25 anxiety-window evidence).      |
| P2            | gentle       | `easy` band only        | Class 0 — gentle                           | Calibration continues. Make-ten-bridge anchored from session start (5 of 6 EASY facts are make-ten-bridge).                                                  |
| P3            | gentle       | `easy` band only        | Class 0 — gentle                           | Three successful experiences before discriminate trap distractors arrive.                                                                                    |
| P4            | discriminate | `medium` band only      | Class 1 — off-by-one                       | First diagnostic. MEDIUM-band entry; HARD-band forbidden at P4 (mirrors add-to-10 §2.1).                                                                     |
| P5            | discriminate | `medium` or `hard` band | Class 1 — off-by-one                       | HARD-band first-permitted slot.                                                                                                                              |
| P6            | discriminate | `medium` or `hard` band | Class 1 — off-by-one                       | "                                                                                                                                                            |
| P7            | discriminate | `medium` or `hard` band | Class 1 — off-by-one                       | "                                                                                                                                                            |
| P8            | discriminate | `medium` or `hard` band | Class 1 — off-by-one                       | Closer. Full discriminative pressure. At least ONE make-ten-bridge fact MUST appear in P5–P8 per §2.4 (the high-leverage coverage rule, analog of `add-to-10` sums-to-10 coverage). |

**Band-by-slot rule (LOCKED, mirrors `add-to-10` §2.1 + `sub-to-20` §2.1):**

- EASY (#1–6): allowed at any slot P1–P8 (gentle ramp anchor; also permitted as a discriminate-tier fallback when recent-score modulation biases easy — see §2.3).
- MEDIUM (#7–14): allowed at P4–P8.
- HARD (#15–22): allowed at P5–P8 only. **HARD must NOT appear at P1–P4.**

### 2.2 Category caps (LOCKED — doubles cap is the doubles-prior correction lever)

Across the 8-problem set:

| Category          | Cap | Rationale                                                                                                                                                                                                                                                                                                                                |
| ----------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doubles`         | 2   | Pool has 4 doubles facts (`6+6, 7+7, 8+8, 9+9`); cap at 2 cuts the current canon's 4-of-8 saturation in half. This is the **doubles-prior correction lever**. Marian retrieves doubles fluently from `add-to-10`; teen-doubles are extensions, not new conceptual ground.                                                                |
| `near-doubles`    | 2   | Pool has 5 near-doubles. Cap at 2 prevents the discriminate tier from over-relying on doubles-plus-one derivations (which require `doubles` to be retrieved first — chained dependency). Two per session is the calibration anchor.                                                                                                       |
| `make-ten-bridge` | 5   | Pool has 13 make-ten-bridge facts (largest category). Cap at 5 is **deliberately generous** — make-ten-bridge IS the tier's learning target. A typical session under recent-score-mid will contain 4–5 make-ten-bridge facts (P1–P3 EASY are mostly make-ten-bridge; P4–P8 will pull 1–2 more). Cap binds only on doubles-leaning sessions. |
| `general`         | 0   | No `general` facts in v1 pool (§1.4). The cap is structurally zero; included for forward-compat with §8 pool widening.                                                                                                                                                                                                                   |

**Caps are mutually exclusive** (each fact maps to exactly one category per the §1.1 priority pattern). A single 8-problem session sums to at most `2 + 2 + 5 = 9` permits, which comfortably accommodates the 8-slot session.

### 2.3 Recent-score modulation

Per `_planner.ts:buildUserMessage`, the user message ships a `recentSuccessRate` for the focus node. Haiku biases band selection:

- **Low score (`< 0.5`)** → favour EASY band for discriminate slots (substitute EASY make-ten-bridge facts for MEDIUM/HARD); reduce doubles to ≤ 1 (doubles are pedagogically lower-leverage; the make-ten-bridge work is where retrieval pays off long-term). Mirrors `add-to-10` §2.3 confidence-preservation posture.
- **High score (`≥ 0.85`)** → push into HARD band for discriminate slots; ensure ≥1 make-ten-bridge fact in P5–P8 (high-leverage coverage rule); doubles cap stays at 2 (do not raise doubles even on high score — that re-introduces the doubles prior the directive is correcting).
- **Mid score or no data** → balanced mix per §2.1 default distribution.

### 2.4 Make-ten-bridge coverage (the high-leverage rule)

> **At least one `make-ten-bridge` fact MUST appear in P5–P8.**

This is the analog of:
- `add-to-10` §2.4 "≥1 sums-to-10 fact in P4–P8" (the make-10 mental model for add-to-10),
- `sub-to-20` §2.3 "≥1 take-to-decade fact in P4–P8" (the take-from-decade strategy for sub-to-20),
- `sub-to-10` §2.3 "≥1 take-from-10 fact in P4–P8" (the take-from-10 strategy for sub-to-10).

Naming choice: this spec uses the lint-rule literal `'high-leverage-coverage'` to share the rule across tiers (mechanical rename history is tracked in `add-to-10-content.md` §9.4; the literal is tier-agnostic, the semantic per tier is set by the rule wiring).

**Why P5–P8 not P4–P8?** P4 is the first discriminate slot but is restricted to MEDIUM-band only. The make-ten-bridge category spans EASY (#1–5), MEDIUM (#7–10, #14), and HARD (#17, #18, #20). If P4 carries a MEDIUM make-ten-bridge fact (#7, #8, #9, #10, or #14), the rule is trivially satisfied. P5–P8 is the strictest framing because it forces the coverage rule to bind even when P4 happens to be a near-doubles or doubles fact. **Lint enforces P5–P8 ≥ 1 make-ten-bridge.**

### 2.5 No-duplicates rule

No `(a, b)` ordered pair may repeat within the 8-problem session. Note: `9 + 2` and `2 + 9` are NOT duplicates — they are distinct ordered pairs (same as `add-to-10` §2.6). This matches Kevin's `add-to-10` lint behaviour for parallel implementation.

### 2.6 Leitner / slow-fact directive (forward-looking)

`add-to-20` is **NOT** Leitner-active in v1. The Leitner gate in `_planner.ts:isLeitnerActive` is currently scoped `track === 'math' && focusNode === 'add-to-10'`. A future Leitner widening to `add-to-20` can use the same machinery once Marian has 5+ sessions of latency + accuracy data on the tier. **Out of scope for this spec.** Kevin's §6 wire-up flags the gate scope as a TODO once data accumulates.

`add-to-20` slow-fact threshold uses the global default 5000 ms (`SLOW_FACT_MIN_MEDIAN_LATENCY_MS` in `slowFacts.ts:69`) — addition retrieval is the baseline; no op-parameterisation needed (contrast: sub-to-10 §8 and sub-to-20 §5.4 widened the threshold for `op === '-'`). `add-to-20` is **NOT** slow-fact-active in v1 (`isSlowFactsActive` scope is `add-to-10` only). Future widening shares the same `slowFactLatencyThresholdMs` accessor proposed in sub-to-20 §5.4.

---

## 3. Distractor design — two classes (gentle + off-by-one), NO new class

`add-to-20` reuses the existing two-class distractor model unchanged from the `add-to-10` baseline. **No new distractor classes for this tier.**

### 3.1 Class 0 — gentle (P1–P3) — unchanged

Algorithm: two distractor values, each ≥ 2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in `distractors.ts:gentleDistractors`. **No code change for `add-to-20`** — same algorithm fires on `op === '+'` problems for `problemIndex ∈ {1, 2, 3}` with the wider `maxAnswer = 20`.

**Range note.** `add-to-20` callers pass `minAnswer = 1` (default) and `maxAnswer = 20` (via `chipMaxAnswerForCorrects` widening). The gentle distractor's "range extreme" bias targets `1` (low) and `19`/`20` (high); both anchors are pedagogically sensible (1 is the count-one-finger anchor; 19/20 are the chip-range ceiling). No range widening needed.

### 3.2 Class 1 — off-by-one (P4–P8) — unchanged

Algorithm: `[correct − 1, correct + 1]` clamped to `[minAnswer, maxAnswer]`. Already implemented in `distractors.ts:offByOneDistractors`. **No code change for `add-to-20`** — same algorithm fires for `problemIndex ∈ [4, 8]`. For `correct = 18` (the HARD max in v1 pool), the OOR clamp produces chips `{17, 18, 19}` cleanly; no degeneration cases.

### 3.3 No Class 2 wrong-operation distractor for `add-to-20`

Same rationale as `add-to-10-content.md` §3.2: wrong-op (`a − b`) on `op === '+'` is pedagogically inert because:
- Addition-direction confusion is not a documented error pattern in 7–9 year olds the way subtract-direction confusion is.
- For `a + b ∈ [11, 20]`, `a − b` is in `[−8, 8]` — half the trap values are negative (out of chip range entirely); the other half overlap with off-by-one neighbours in many pool facts.

`add-to-20` keeps the two-class model. See §7.4 for the "dropped-carry" Class B open question (recommendation: also REJECT).

### 3.4 No Class B "dropped-carry" distractor for `add-to-20` v1

The dispatch brief flagged "dropped-carry" as a candidate Class B distractor (e.g. `8 + 5 = 12` instead of `13` — child carries the +5 but drops the +1 from the bridge decomposition `8 + 2 + 3 = 13`).

**This spec does NOT include Class B.** Rationale in §7.4: the error pattern is real for *written multi-digit addition* but is not well-documented for *mental cross-10-bridge errors* in 7–9 year olds. The likely error mode at this tier is off-by-one in the bridge step (`8 + 5 = 12` or `8 + 5 = 14`), which is already covered by Class 1. Adding Class B would (a) target a thinly-documented error pattern and (b) overlap with Class 1 in many pool facts. Dave's research has not yet weighed this specific class; recommendation is REJECT pending Dave dispatch. See §7.4 + §7.6.

### 3.5 Distractor-class field — render-side ONLY (continues sub-to-10 / sub-to-20 pattern)

Per `planner-and-canon.md` § "Wire shape is utterance-only — invariant": the `MathProblem.distractorClass` field is render-derived, not planner-emitted. For `add-to-20`, `Math.tsx` defaults `distractorClass` to `undefined` for `op === '+'` (existing behaviour from `add-to-10`); `pickDistractors` uses Class 0 (gentle, P1–P3) and Class 1 (off-by-one, P4–P8) by default. **No code change.** No widening of the `distractorClass` union for `add-to-20`.

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `add-to-20` block

Replace the current single-line-with-FORBIDDEN-guards directive at [`api/_planner.ts:964`](../../api/_planner.ts#L964) with the structured pool directive below. The block follows the same shape as `add-to-10`'s structured block (per `add-to-10-content.md` §4.1) and `sub-to-20`'s 22-fact pool directive plus the doubles-prior correction self-check.

### 4.1 Block text (literal — Kevin's copy)

> ```
> - add-to-20: addition with sums STRICTLY in [11, 20] and BOTH addends in [1, 9]. NO TEN-PLUS-SINGLE (10+n, n+10 FORBIDDEN — that's two-digit-addsub territory); NO sums ≤ 10 (that's add-to-10's territory). read: "<addend-A> plus <addend-B>. How many?" e.g. "Eight plus five. How many?"
>
>   SUM-RANGE SELF-CHECK (apply before emitting every problem): for chosen (addendA a, addendB b), COMPUTE a + b and CONFIRM that 11 <= a + b <= 18. (V1 pool excludes 19 and 20 — see addend range below.) If the sum is < 11, the problem belongs in add-to-10 and is FORBIDDEN here; if > 18, the (a, b) pair is OUT of the v1 pool. Worked example: 8+3=11 is OK (11 in range). 5+5=10 is FORBIDDEN (sum < 11). 9+10=19 is FORBIDDEN (addend = 10 violates next check).
>
>   ADDEND-RANGE SELF-CHECK (apply before emitting every problem): for chosen (a, b), CONFIRM that a in [1, 9] AND b in [1, 9]. If either addend is 10 or greater, the problem is FORBIDDEN (belongs in a future two-digit tier). Worked example: 9+8=17 is OK (both addends in [1, 9]). 10+8=18 is FORBIDDEN (a = 10). 12+5=17 is FORBIDDEN (a > 9).
>
>   FACT POOL (22 facts; pick exactly 8 distinct ordered pairs from this pool per session, no duplicates; commutative pairs are DISTINCT facts — e.g. "9+2" and "2+9" are separate pool entries):
>   Each fact is annotated with [BAND/category]. Categories: make-ten-bridge (the actual learning target of this tier — child decomposes one addend to reach 10 first); doubles (retrieved; do NOT over-pick — see DOUBLES-CAP SELF-CHECK below); near-doubles (doubles-plus-one derivation; requires doubles to be retrieved).
>   - Easy band (P1-P3 eligible, also P4-P8 fallback):
>     · 9+2=11  [EASY/make-ten-bridge]
>     · 2+9=11  [EASY/make-ten-bridge]
>     · 8+3=11  [EASY/make-ten-bridge]
>     · 3+8=11  [EASY/make-ten-bridge]
>     · 9+3=12  [EASY/make-ten-bridge]
>     · 6+6=12  [EASY/doubles]
>   - Medium band (P4-P8 eligible):
>     · 9+4=13  [MEDIUM/make-ten-bridge]
>     · 4+9=13  [MEDIUM/make-ten-bridge]
>     · 8+5=13  [MEDIUM/make-ten-bridge]
>     · 5+8=13  [MEDIUM/make-ten-bridge]
>     · 6+7=13  [MEDIUM/near-doubles]
>     · 7+6=13  [MEDIUM/near-doubles]
>     · 7+7=14  [MEDIUM/doubles]
>     · 9+5=14  [MEDIUM/make-ten-bridge]
>   - Hard band (P5-P8 eligible):
>     · 7+8=15  [HARD/near-doubles]
>     · 8+7=15  [HARD/near-doubles]
>     · 9+6=15  [HARD/make-ten-bridge]
>     · 9+7=16  [HARD/make-ten-bridge]
>     · 8+8=16  [HARD/doubles]
>     · 9+8=17  [HARD/make-ten-bridge]
>     · 8+9=17  [HARD/near-doubles]
>     · 9+9=18  [HARD/doubles]
>   POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b) pair appears verbatim above. The 22 listed ordered pairs are the ONLY allowed facts. Common FORBIDDEN candidates to REJECT (valid by sum and addend range but NOT in v1 pool): 4+7, 7+4, 5+6, 6+5, 4+8, 8+4, 5+7, 7+5, 6+8, 8+6, 5+9 (and any other (a, b) with a in [1,9], b in [1,9], 11 <= a+b <= 20 not on the list above). These are deferred to a future pool widening; not part of v1.
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window.
>   2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
>      · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
>      · DO NOT place any HARD-band fact at P1, P2, P3, or P4. HARD-band only appears at P5 or later.
>      · The ONLY facts allowed at P1, P2, P3 are: 9+2, 2+9, 8+3, 3+8, 9+3, 6+6.
>   3. Problem 4: MEDIUM-band only (HARD-band still forbidden at P4).
>   4. Problems 5-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) → bias toward medium and REDUCE doubles to ≤1 across the session; high score (>= 0.85) → push toward hard with ≥1 make-ten-bridge in P5-P8; mid score → balanced.
>   5. HIGH-LEVERAGE COVERAGE RULE: at least one make-ten-bridge fact MUST appear in P5-P8 (drawn from: 9+4, 4+9, 8+5, 5+8, 9+5, 9+6, 9+7, 9+8). This is the actual learning target of the tier; Dave's sub-to-20 research § 1.2 frames cross-10-bridge as parallel to take-from-decade for sub-to-20.
>   6. DOUBLES-CAP SELF-CHECK: AT MOST TWO problems across the entire 8-problem session may carry the doubles category (i.e. AT MOST TWO facts drawn from {6+6, 7+7, 8+8, 9+9}). Before emitting a third doubles fact, REJECT it. NEGATIVE ANCHOR — it is FORBIDDEN to place 6+6, 7+7, 8+8, AND 9+9 in the same session (that exceeds the cap by 2). The current canon ships with all four doubles present — that is the failure mode this cap corrects. Pick at most 2; let the other 2 lie unused for this session.
>   7. NEAR-DOUBLES-CAP SELF-CHECK: AT MOST TWO problems across the entire 8-problem session may carry the near-doubles category (drawn from {6+7, 7+6, 7+8, 8+7, 8+9}). Before emitting a third near-doubles fact, REJECT it.
>   8. NO duplicate (a, b) ordered pairs within the 8-problem set. "9+2" and "2+9" are NOT duplicates — they are distinct ordered pairs with distinct read-line text.
>   9. DUAL-EXPOSURE RULE (forward-compat scaffold): never pair an addition fact and its subtraction inverse in the same session. E.g. if 8+5=13 is included, 13-5=8 and 13-8=5 are both FORBIDDEN (vacuously satisfied in pure-+ v1 sessions; rule binds once mixed +/- sessions arrive). This rule is forward-compatible with future add-to-20 / sub-to-20 fact-family interleaving.
>
>   DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8): the render pipeline (src/screens/Math/Math.tsx) uses Class 1 (off-by-one) for every op:'+' P4-P8 problem and does NOT apply a Class 2 (wrong-op) or Class B (dropped-carry) trap — see design/math/add-to-20-content.md §3.3 and §3.4. No coverage self-check needed for distractor classes; the high-leverage coverage rule (Rule 5 above) carries the pedagogical-coverage burden for this tier.
>
>   PROSODY: numbers are spelled out as words ("one", "two", ... "nine", "ten", "eleven", ... "eighteen"). Capitalize the first word of each sentence. The "plus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10% for all values in [1, 18]; no SSML overrides required (validated by sub-to-20 §4 for the same teen-number range). Do NOT verbally decompose the addends (e.g. do NOT say "eight plus two plus three" instead of "eight plus five") — per Dave § 2 (L2 context note, sub-to-20 research), verbal decomposition adds L2 cognitive load without pedagogical benefit. The decomposition IS the mental work Marian does to bridge; it stays internal.
> ```

> **Note on "and" framing.** No first-encounter "and" → "plus" variant for `add-to-20`. By the time Marian reaches `add-to-20`, she has run dozens of `add-to-10` sessions; the "plus" framing is internalised. See §7.5 for the explicit Thomas decision.

### 4.2 Per-slot utterance templates

| Slot         | Template                                                          | Example for `8 + 5 = 13`                              | Notes                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `read`       | `"<addend-A> plus <addend-B>. How many?"`                         | `"Eight plus five. How many?"`                        | Same template as `add-to-10`; commutative pairs read distinctly.                                                                                       |
| `correct`    | `"Yes! <answer>!"`                                                | `"Yes! Thirteen!"`                                    | Number-celebration template; teen numbers render cleanly (validated for sub-to-20).                                                                    |
| `reprompt`   | `"Hmm... try again?"` (verbatim)                                  | `"Hmm... try again?"`                                 | Locked phrasing — do NOT vary.                                                                                                                         |
| `hint`       | `"Look. <addend-A>. And <addend-B> more. How many now?"`          | `"Look. Eight. And five more. How many now?"`         | Mirrors `add-to-10` hint structure. "And N more" framing is the count-on scaffold; the make-ten-bridge decomposition is left to Marian's mental work.  |
| `giveAnswer` | `"This one is <answer>."`                                         | `"This one is thirteen."`                             | Locked.                                                                                                                                                |

**Teen-number prosody.** All results land in `[11, 18]`. The Azure Emma multilingual voice renders "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen" cleanly at rate −10% (validated for `sub-to-20` and the existing add-to-20 canon). No SSML overrides required.

### 4.3 First-encounter scaffolding gate — NOT REQUIRED for `add-to-20`

Per §4.1 directive note: `add-to-20` uses the "plus" template from session 1 (same template Marian has internalised from `add-to-10`). **No entry added to `FIRST_ENCOUNTER_GATED_NODES`** in [`api/_firstEncounterGate.ts`](../../api/_firstEncounterGate.ts).

If Thomas re-opens §7.5 (first-session "and" warmup), this section + §6.4 gain an `add-to-20` gate entry.

---

## 5. Schema posture, advancement gate, dual-exposure rule, slow-fact request

### 5.1 Schema posture — `MathFact` reuse, no new infrastructure

`add-to-20` introduces NO new TypeScript types. Every fact uses the existing `MathFact` shape with `op: '+'` (default for additions; threaded through `MathProblem` since PR #241).

**No wire-shape changes.** The `distractorClass` union does NOT widen for `add-to-20` (no Class B; see §3.3, §3.4). The `MathProblem.op` field is REQUIRED and value `'+'` for all `add-to-20` problems.

**Browser parser adapter.** No change. [`planFromServer.ts`](../../src/screens/Math/planFromServer.ts) already parses `"X plus Y. How many?"` with teen-number `NUMBER_WORDS` entries (added for the existing add-to-20 baseline). Sub-to-20 PR #272 confirmed entries for `eleven`–`nineteen` are present.

**`distractors.ts` extension.** No change. The widening for `correct ≥ 11` is already in place via `chipMaxAnswerForCorrects` (`distractors.ts:107-110`).

**`maxAnswer` widening for `add-to-20` callers.** `Math.tsx` invokes `pickDistractors` with `maxAnswer = chipMaxAnswerForCorrects(allCorrects)`. The existing function returns `ANSWER_RANGE_MAX_TO_20 = 20` for any correct ≥ 11 (`distractors.ts:107-110`). add-to-20 results are in `[11, 18]` so this widens automatically. **No code change required.**

**No screen-side changes.** `Math.tsx` is operation-agnostic; chip-rendering and gesture handling consume `MathProblem` without inspecting `op` or `focusNode`. The audio path consumes `read` text verbatim; "plus" + teen-number renders cleanly without phoneme overrides.

### 5.2 Advancement gate — `add-to-10 → add-to-20` (ACCURACY ONLY)

Per the existing math curriculum order (locked in sub-to-10 §11 Q1, Thomas 2026-05-15): `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → …`. The advancement gate is `add-to-10 → add-to-20`. Dave's general framing (sub-to-20 § 4.4, ratified for sub-to-10 → sub-to-20 in `sub-to-10-content.md` §6) carries to `add-to-10 → add-to-20`:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default threshold `95/3` locked 2026-05-02, ticket 86c9kwvy0; see `progress-and-persistence.md` § "Mastery rule").

**Explicitly NOT a gate:**

- ❌ Leitner box drainage state. The Leitner box is a session-generation steering tool, not a promotion gate. Holding Marian on `add-to-10` past 95% waiting for box-1 to drain is counterproductive — fact-family exposure via `add-to-20` (and the cross-10-bridge work) is itself therapeutic for `add-to-10` retrieval (McNeil et al. 2025 cited in `add-to-10-content.md` §6).
- ❌ Slow-fact list length. Same logic as sub-to-10 §6 + add-to-10 §6.
- ❌ Latency median. Slow-fact directive is backend re-targeting, not promotion signal.

**Hard stop (parent / observation gate, NOT algorithmic):** standard `autoPromote: false` Parent Settings flag.

**Code implication.** NO code change to `applyMasteryRule` or `pickFocusNode`. The existing rule already promotes on accuracy alone. This spec affirms the existing behaviour is correct for the `add-to-10 → add-to-20` transition.

### 5.3 Advancement gate — `add-to-20 → sub-to-10` is already in production

The `add-to-20 → sub-to-10` gate is the post-add-to-20 transition; ratified in `sub-to-10-content.md` §6. Accuracy-only, math default `95/3`. **This spec re-affirms; no code change.**

### 5.4 Parallel-acquisition note — `add-to-20` ↔ `sub-to-20`

Per Dave's sub-to-20 research § 1.2: `add-to-20` and `sub-to-20` are **parallel acquisition targets**, not sequential. The `MATH_TREE` order today threads them as `add-to-20 → sub-to-10 → sub-to-20` (Thomas locked 2026-05-15, sub-to-10 §11 Q1). Practical implication for Marian: she will advance to `sub-to-20` while `add-to-20` is still at `practicing`, and the fact-family inverse exposure will help both. This is correct per the research but counterintuitive from a "finish one thing before moving to the next" perspective.

**This spec inherits the existing `MATH_TREE` order.** Re-sequencing to make `add-to-20` and `sub-to-20` parallel-unlocked (both from `add-to-10` mastery) would be a progression-state-machine PR requiring a paired failing-first E2E spec per `[[feedback_progression_e2e_mandatory]]`. Out of scope here. See §7.3 for the explicit Thomas decision.

### 5.5 Dual-exposure rule — placeholder for future `+`/`−` interleaving

**Rule (LOCKED — forward-compat with sub-to-20 §5.3).**

> Within an 8-problem `add-to-20` session, no addition fact and its subtraction inverse may co-occur.

**Definition.** For an addition fact `a + b = c`, the subtraction inverses are `c − a = b` and `c − b = a`. Both orderings are FORBIDDEN in the same session as the addition fact.

**Examples (forward-compat scaffold):**

- ✅ Session contains `8 + 5 = 13`; `13 − 5 = 8` and `13 − 8 = 5` are both FORBIDDEN.
- ✅ Session contains `9 + 9 = 18`; `18 − 9 = 9` is FORBIDDEN (note: `18 − 9 = 9` is FORBIDDEN under sub-to-20 v1's strict no-borrow rule too — sub-to-20 §7.1 carve-out — so this is doubly safe).

**V1 enforcement scope.** `add-to-20` sessions are pure-addition in v1 (all 8 problems use `op === '+'`). The dual-exposure rule applies to `+` ↔ `−` cross-operation pairing, which is vacuously satisfied in pure-`+` sessions. **Rule is forward-compatibility scaffolding** for the future mixed-operation session shape per Dave § 1.2.

### 5.6 Slow-fact threshold — `add-to-20` uses the global default

`add-to-20` uses the global `SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000` (`slowFacts.ts:69`). No op-parameterisation needed (contrast: sub-to-10 §8 and sub-to-20 §5.4 widened the threshold for `op === '-'`). `add-to-20` is **NOT** slow-fact-active in v1; future activation extends the `slowFactLatencyThresholdMs` accessor proposed in sub-to-20 §5.4 trivially:

```ts
// hypothetical extension once add-to-20 widens
if (op === '+' && focusNode === 'add-to-20') {
  if (nodeSessionCount < 5) return null // suppress (mirror sub-to-20 warmup)
  return 5000 // addition baseline, no widening
}
```

**Out of scope for this spec.** Flagged in §6.7 as a Kevin follow-up if needed.

---

## 6. Wire-up checklist for Kevin / Devon

This is the ONLY actionable list for the implementing developers. Everything above is rationale + content; everything below is what changes in code.

> **Dependency order is load-bearing.** Per `project_planner_parser_contract.md`: widen the browser parser BEFORE widening the planner. For `add-to-20` this is a no-op — the existing canon already exercises the parser with teen-number reads, and the parser handles them. Items below are numbered in safe-merge order. **PR split: SINGLE PR** (content + canon + lint in one — no render-side change needed for this spec, so the sub-to-20 two-PR split does NOT apply).

### 6.1 Parser verification (FIRST — should be a no-op confirmation, no code change expected)

- [ ] **`src/screens/Math/planFromServer.ts:NUMBER_WORDS`** — verify entries for `'eleven'`–`'eighteen'` are present (confirmed for sub-to-20 PR #272; verify again as smoke-check).
- [ ] **`src/screens/Math/planFromServer.ts`** — verify the existing `"X plus Y. How many?"` regex parses add-to-20 read-lines correctly across the entire 22-fact pool. Add explicit fixtures for `9+2=11` (the smallest cross-10) and `9+9=18` (the largest) in `planFromServer.test.ts`.
- [ ] **CI gate** — vitest passes locally (`npx vitest run` per `[[feedback_run_vitest_before_merge]]`).

### 6.2 Distractor — NO CHANGE for `add-to-20`

- [ ] **`src/screens/Math/distractors.ts`** — confirm no widening needed. `add-to-20` keeps the two-class (gentle + off-by-one) model. The `chipMaxAnswerForCorrects` already widens to 20 for any correct ≥ 11.
- [ ] **`src/screens/Math/Math.tsx`** — confirm the P4–P8 distractor-class derivation defaults `distractorClass` to `undefined` for `op === '+'` (existing behaviour from `add-to-10`); `pickDistractors` falls through to gentle (P1–P3) + off-by-one (P4–P8). Sanity-check, no change.
- [ ] **`src/screens/Math/distractors.test.ts`** — add a fixture confirming a representative add-to-20 plan (one EASY, one MEDIUM, one HARD) produces off-by-one chips correctly at P4, P5, P6. Vitest pin.

### 6.3 Planner directive — `MATH_TRACK_GUIDE` `add-to-20` block

- [ ] **`api/_planner.ts:964`** — replace the current single-line directive with the structured pool directive in §4.1, including:
  - The SUM-RANGE SELF-CHECK + ADDEND-RANGE SELF-CHECK blocks with worked examples.
  - The 22-fact FACT POOL annotated with `[BAND/category]`.
  - SESSION COMPOSITION RULES (1–9) per §4.1.
  - The DOUBLES-CAP and NEAR-DOUBLES-CAP self-checks (the doubles-prior correction).
  - The HIGH-LEVERAGE COVERAGE RULE (≥1 make-ten-bridge in P5–P8).
  - PROSODY block (teen-number rendering, no verbal decomposition).
- [ ] **`scripts/compositionLint.ts`** — add `ADD_TO_TWENTY_POOL` and `ADD_TO_TWENTY_RULES` configs mirroring the `ADD_TO_TEN_RULES` + `SUB_TO_TWENTY_RULES` pattern. Rule set:
  1. Pool membership — every fact must be one of the 22 ordered `(a, b)` pairs in §1.1.
  2. Category caps: `doubles ≤ 2`, `near-doubles ≤ 2`, `make-ten-bridge ≤ 5` (cap is generous because make-ten-bridge IS the target).
  3. Band-by-slot: P1–P3 EASY only; P4 MEDIUM only; P5–P8 MEDIUM or HARD; HARD FORBIDDEN at P1–P4.
  4. High-leverage coverage: ≥1 make-ten-bridge fact in P5–P8 (lint rule literal `'high-leverage-coverage'`, shared with `add-to-10` and `sub-to-20`).
  5. No duplicate ordered pairs.
  6. Dual-exposure rule (forward-compat; vacuously satisfied in v1 since sessions are pure-`+`; lint rule fires only when a future spec widens to mixed sessions).
- [ ] **`scripts/compositionLint.ts:resolveTierBinding`** — add an `add-to-20` branch routing to `ADD_TO_TWENTY_RULES`.
- [ ] **`scripts/compositionLint.test.ts`** — fixtures exercising the new pool entries + composition rules. Include positive tests: a baked plan with P1=`9+2`, P2=`8+3`, P3=`6+6`, P4=`9+4`, P5=`8+5`, P6=`6+7`, P7=`7+8`, P8=`9+8` passes lint (3 make-ten-bridge in P4–P8; doubles cap of 1 used; near-doubles cap of 2 used). Include negative tests:
  - A plan with `6+6, 7+7, 8+8` (3 doubles) fails doubles cap.
  - A plan with no make-ten-bridge in P5–P8 fails high-leverage coverage.
  - A plan with `5+5=10` fails pool membership (sum out of range).
  - A plan with `10+8=18` fails pool membership (addend out of range).
- [ ] **`api/_planner.ts`** — verify the system-prompt JSON contract carries `op: '+'` in the emitted `MathProblem` shape for `add-to-20` (already true; sanity-check).
- [ ] **`api/_planner.test.ts`** — add a focused test: stub Haiku, feed back an `add-to-20` plan, assert: (a) every problem has `op: '+'`; (b) every problem has `(a, b)` in the 22-fact pool; (c) every problem satisfies `11 ≤ a + b ≤ 18` and `1 ≤ a ≤ 9` and `1 ≤ b ≤ 9`; (d) at least one make-ten-bridge fact appears in P5–P8; (e) doubles count ≤ 2; (f) near-doubles count ≤ 2; (g) no duplicate ordered pairs; (h) no `+`/`−` inverse co-occurrence (vacuously true in v1).

### 6.4 First-encounter gate — NOT REQUIRED for `add-to-20`

Per §4.3: `add-to-20` uses the "plus" template from session 1. No entry added to `FIRST_ENCOUNTER_GATED_NODES`. The existing `_firstEncounterGate.test.ts` negative-assertion for math nodes other than `sub-to-10` remains TRUE for `add-to-20`. **Sanity-check the test file lists `add-to-20` as not-gated.**

If §7.5 re-opens this (Thomas requests an "and" warmup), this section + §6.3 directive variant gain an `add-to-20` gate entry mirroring the `sub-to-10` pattern.

### 6.5 Canon prebake

- [ ] **`scripts/generateSessionCanon.ts:activeCombos()`** — confirm `add-to-20` is in `MATH_FOCUS_NODES` iteration set (it is; verified by existence of `public/canon/math/level-1/add-to-20.json`).
- [ ] **`npm run canon:regen`** — incremental regen for `add-to-20` only:
  ```
  rm public/canon/math/level-1/add-to-20.json
  cp .env.local <worktree>/.env.local           # canon-bake needs the keys
  yarn install --frozen-lockfile               # worktree needs node_modules
  npx tsx scripts/generateSessionCanon.ts --require-keys
  ```
  Per `planner-and-canon.md` § "Incremental-by-default trick". Bake produces ~25s of work and ~$0.005 of Haiku + Azure spend. Commit the JSON diff in the same PR.
- [ ] **Canon-lint gate** — `npm run canon:lint` must pass (text-encoding + composition lint chained). Composition lint will exercise the new `ADD_TO_TWENTY_RULES`.
- [ ] **Post-bake doubles-cap spot-check** — `jq '.utterances | map(select(.id | test("p[0-9]+.read"))) | map(.text)' public/canon/math/level-1/add-to-20.json` then count facts in the doubles category `{6+6, 7+7, 8+8, 9+9}`; assert ≤ 2. This is the empirical proof the doubles-prior correction landed. (Lint already enforces this; the manual check is for confidence on first bake.)
- [ ] **Post-bake make-ten-bridge coverage spot-check** — same `jq` query; verify at least one make-ten-bridge fact is in P5–P8 (slot positions 5–8 in the read-line array).
- [ ] **`scripts/generateSessionCanon.test.ts`** — combo-count regression should already cover `add-to-20`; sanity-check.

### 6.6 Mastery / focus-node picker — NO CHANGE

Per the existing curriculum order: `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → …`. NO CHANGE to `MATH_TREE` in [`src/lib/progress/mastery.ts:103`](../../src/lib/progress/mastery.ts#L103) or `MATH_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts:48`](../../src/lib/progress/focusNode.ts#L48). The promotion rule applies as-is.

- [ ] **`src/lib/progress/defaults.ts:DEFAULT_SKILL_LEVELS`** — check the current default for `'add-to-20'`. Marian has not yet promoted from `add-to-10` (she is currently in the `add-to-10` tier per diagnostic). The default should be `'locked'` or `'practicing'` (depending on the existing pattern); **sanity-check the current value and confirm it matches the parallel-sequencing note in §7.3.** If `add-to-20` is `'locked'` until `add-to-10` masters, the current promotion machinery handles unlock; no change.

### 6.7 Leitner / Slow-fact widening — DEFERRED FOLLOW-UP

- [ ] **(FOLLOW-UP PR)** Implement Leitner activation for `add-to-20` once Marian has 5+ sessions of accuracy + latency data. Mirror the `add-to-10` precedent. NOT in this PR.
- [ ] **(FOLLOW-UP PR)** Slow-fact threshold for `add-to-20` is the addition default 5000 ms — no op-parameterisation needed. Just widen `isSlowFactsActive` scope to include `add-to-20` when Leitner activates. NOT in this PR.

### 6.8 Test coverage minimums

- [ ] Unit: parser (every pool fact's read-line parses with correct `op`), planner stub (composition rules #1–9 from §4.1 enforced), composition lint (add-to-20 pool + caps + band-by-slot + high-leverage coverage + dual-exposure forward-compat).
- [ ] E2E (Jessica): Per `[[feedback_progression_e2e_mandatory]]` — `add-to-20` is a math focus node and shipping this spec touches no progression-state-machine files (no `mastery.ts` / `focusNode.ts` / `firstEncounterGate.ts` / `parentSettings.ts` changes). **Verify with Matt at dispatch time whether an E2E spec is required.** If yes, Jessica authors `e2e/add-to-20-composition.spec.ts` covering: (a) seeded `add-to-20` focus node renders 8 problems from the 22-fact pool; (b) all problems satisfy sum + addend ranges; (c) doubles count ≤ 2; (d) at least one make-ten-bridge fact appears in P5–P8.
- [ ] Self-test report on the PR per `[[feedback_self_test_report]]`: AC walkthrough + side-effect inventory.

### 6.9 Docs

- [ ] **`.claude/docs/skill-trees-and-content.md`** — extend the "Math distractors" section with an `add-to-20` row clarifying the two-class model (no Class 2, no Class B) and the doubles-prior correction.
- [ ] **`.claude/docs/planner-and-canon.md`** — update the "Haiku doubles prior" subsection with a note that `add-to-20` v1 ships with structural correction via category caps. The existing NOF #1 entry from Kevin's PR #266 should be cross-referenced.
- [ ] **`.claude/docs/progress-and-persistence.md`** — under "Mastery rule" or "Focus-node picker", extend the existing footnote: "Promotion is accuracy-only for `add-to-10 → add-to-20` as well; do NOT introduce a Leitner-drainage or slow-fact-list-length gate (Dave's sub-to-20 research § 4.4 grounds the same fact-family-exposure rationale for the parallel addition tier)."

---

## Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite.

- [ ] **AC1**: The 22-fact pool (§1.1) is faithfully encoded in `MATH_TRACK_GUIDE`'s `add-to-20` block AND in `scripts/compositionLint.ts:ADD_TO_TWENTY_POOL` (vitest snapshot on the directive block; planner-test asserts pool membership; compositionLint drift-guard catches any mismatch).
- [ ] **AC2**: Every Haiku-generated `add-to-20` plan composition rule from §4.1 holds: P1–P3 from `easy` band, P4 MEDIUM-only, ≥1 make-ten-bridge fact in P5–P8, doubles count ≤ 2, near-doubles count ≤ 2, no duplicate ordered pairs, no operand-triple `+`/`−` co-occurrence within the 8-problem set (vacuously true in v1 pure-`+` sessions), EVERY problem satisfies `11 ≤ a + b ≤ 18` AND `a ∈ [1, 9]` AND `b ∈ [1, 9]`.
- [ ] **AC3**: Distractor rendering uses Class 0 (gentle) at P1–P3 and Class 1 (off-by-one) at P4–P8 for all `add-to-20` problems. No Class 2 wrong-op trap fires for `op === '+'` (existing behaviour; sanity-checked).
- [ ] **AC4**: All teen-number chip values render and play correctly. Emma says "Yes! Thirteen!", "Yes! Fifteen!", etc. naturally on the cheerful celebration prosody. No SSML overrides required for any chip value in `[1, 20]`.
- [ ] **AC5**: Read-line parser accepts add-to-20 read templates with teen-result reads and tags problems with `op: '+'`; existing `add-to-10`, `sub-to-10`, `sub-to-20` templates continue to parse correctly.
- [ ] **AC6**: Advancement gate — `add-to-10 → add-to-20` fires on accuracy threshold alone (math default `95/3`), NOT influenced by Leitner box state or slow-fact list length. Verified via existing mastery tests; no new gate added.
- [ ] **AC7**: Dual-exposure rule — within any single 8-problem session, no operand triple appears in both `+` and `-` forms. Vacuously true in v1 (pure-`+` sessions); covered by the planner test enumerating all 8 problems.
- [ ] **AC8**: Slow-fact and Leitner directives remain DISABLED for `add-to-20` in v1 (`isSlowFactsActive` / `isLeitnerActive` predicates unchanged); future activation lands in a follow-up PR after Marian generates ≥5 sessions of data.
- [ ] **AC9**: Canon JSON `public/canon/math/level-1/add-to-20.json` re-baked and committed. Canon-lint passes (ASCII-7, no slash-IPA, no angle tags, composition rules satisfied). File parses via `isSessionStartResponse`. **Doubles count in the canon is ≤ 2** (the empirical proof the doubles-prior correction landed; supersedes the current 4-doubles canon).
- [ ] **AC10**: At least one make-ten-bridge fact appears in slots P5–P8 of the re-baked canon (the high-leverage coverage rule empirically satisfied).

---

## 7. Open questions for Thomas

These are decision-stack items the spec cannot self-resolve. Orchestrator routes to Thomas.

### 7.1 The `addend ≤ 9` ban and 2-digit-plus-1-digit scope — strict or loose?

**The tension.** The current directive at `_planner.ts:964` already FORBIDS `10 + n` ("ten-plus-single is pedagogically easier than cross-10-bridge"). This spec preserves and *extends* the ban to `11 + n, 12 + n, …, 19 + n` — any `addend ≥ 10` is FORBIDDEN.

The pedagogical question: are facts like `12 + 5 = 17` part of `add-to-20`'s teaching surface, or do they belong in `two-digit-addsub`?

**This spec's default.** EXTEND the ban. `addend ∈ [1, 9]` for both addends. Rationale:
- `12 + 5 = 17` is conceptually 2-digit-plus-1-digit; the child reads the 12 as a teen number and adds 5 directly (no cross-10-bridge work). The mental strategy is different from `8 + 5 = 13`. Conflating them in one tier muddies the learning target.
- Place-value reasoning (recognising "12 = ten + two, so 12 + 5 = ten + 7 = 17") is a separate skill that the `two-digit-addsub` tier teaches deliberately.
- Marian has the foundation but has not been drilled on 2-digit-plus-1-digit; including these facts here would conflate two pedagogical jobs.

**The decision Thomas must make.** Two options:

- **Option A (this spec's default, conservative):** Keep the strict `addend ≤ 9` ban. `add-to-20` v1 ships with the 22-fact pool, all cross-10-bridge facts. 2-digit-plus-1-digit waits for `two-digit-addsub`.
- **Option B (re-open):** Widen `addend ≤ 19` to include `11+5, 12+3, 14+4, …, 19+1` facts. The pool grows substantially (~25 new facts). New conceptual category needed (`teen-plus-single`). Place-value scaffolding might need explicit copy. Dave dispatch likely needed before locking the pedagogical fit.

**Recommendation.** Option A. The cross-10-bridge work is the right job for `add-to-20`; 2-digit work is a separate tier. Re-open at the `two-digit-addsub` spec time if Marian's data shows demand.

### 7.2 Sums to 19 and 20 — pool extension or v1 omission?

**The tension.** The current directive permits sums `[11, 20]` inclusive. This spec's pool maxes at sum = 18 (`9 + 9 = 18`); no fact in v1 produces sum = 19 or 20. Why? Because the only candidates would be `9+10=19`, `10+9=19`, `10+10=20` — all FORBIDDEN by the `addend ≤ 9` ban (§7.1).

**This spec's default.** Pool maxes at sum = 18. Rationale: with the `addend ≤ 9` ban locked, sums 19 and 20 are mechanically unreachable. The directive's stated upper bound of 20 is a forward-compat ceiling; the v1 pool covers `[11, 18]`.

**The decision Thomas must make.** Two options:

- **Option A (this spec's default):** Pool maxes at sum = 18. Accept that "add-to-20" is colloquial; the actual sum ceiling is 18 because `9 + 9` is the largest fact with both addends ≤ 9. Re-name the tier? (Possibly. Out of scope; the tier name is locked via skill-tree taxonomy.)
- **Option B (re-open §7.1):** Widen `addend ≤ 10` to allow `9 + 10 = 19` and `10 + 10 = 20`. Adds 3 facts (`9+10, 10+9, 10+10`). Re-introduces the "pedagogically easier than cross-10-bridge" tension the current directive correctly identifies and FORBIDS. **Same as §7.1.**

**Recommendation.** Option A. The "add-to-20" tier name refers to the sum *target range* (up to 20), not the requirement that 20 itself be in the pool. Mirrors how "sub-to-20" pool maxes at result = 18 by no-borrow constraint, not at 19 or 20.

### 7.3 Parallel-sequencing — should `add-to-20` and `sub-to-20` unlock together from `add-to-10` mastery?

Per Dave § 1.2 (sub-to-20 research): `add-to-20` and `sub-to-20` are parallel acquisition targets. The `MATH_TREE` today threads them as `add-to-20 → sub-to-10 → sub-to-20`, meaning Marian advances:

1. `add-to-10` masters → `add-to-20` becomes focus.
2. `add-to-20` masters → `sub-to-10` becomes focus.
3. `sub-to-10` masters → `sub-to-20` becomes focus.

Under this order, Marian completes `add-to-20` BEFORE starting `sub-to-10`. But per Dave's research she should be interleaving `add-to-20` and `sub-to-20` once both are conceptually established. The current order is not wrong (it's a defensible "finish one thing first" pedagogy), but it leaves the McNeil interleaving benefit on the table.

**The decision Thomas must make.** Three options:

- **Option A (this spec's default, no change):** Keep the existing `MATH_TREE` order. `add-to-20` ships, Marian works through it linearly. `sub-to-20` arrives later. Interleaving deferred to a future "mixed `+`/`−` sessions" spec (post-fact-family interleaving v2).
- **Option B (parallel-unlock):** Re-wire `MATH_TREE` so `add-to-20` and `sub-to-20` both unlock when `add-to-10` masters; both become focus candidates. Picker (`pickFocusNode`) rotates between them per session based on the existing `todayTreesTouched` mechanic. **This is a progression-state-machine change** — requires a paired failing-first E2E spec per `[[feedback_progression_e2e_mandatory]]`. Estimated 1–2 day Devon + Jessica effort.
- **Option C (defer to data):** Ship `add-to-20` v1 under current order. Observe Marian's session arc. If she stalls on `add-to-20` (cross-10-bridge is genuinely hard without sub-to-20's inverse exposure), revisit Option B at that point.

**Recommendation.** Option C. Ship the structural-correction spec first; let real-Marian data inform the sequencing question rather than re-wiring `MATH_TREE` speculatively. If she breezes through `add-to-20` in 5–7 sessions, the sequencing was fine; if she stalls past 10 sessions at low accuracy, re-open Option B with empirical evidence.

### 7.4 Class B "dropped-carry" distractor — include or reject?

**The candidate.** For `8 + 5 = 13`, child decomposes as `8 + 2 + 3 = 10 + 3`, then mis-tracks the bridge step: drops the +3 entirely and answers `10` (or carries only 2 and answers `12`, or carries only +4 and answers `14`). The "dropped-carry" distractor would deliberately offer `10` or `12` as a chip alongside the correct `13`.

**Pedagogical fit per `[[feedback_distractor_class_pedagogical_gates_mechanical]]`.**

- **Documented error pattern?** Sketchy. The dropped-carry error is well-documented for *written multi-digit addition* (the child writes the units digit but forgets to carry the tens). For *mental cross-10-bridge* in 7–9 year olds, the literature describes errors as **off-by-one in the bridge step** ("8 + 5 = 12" or "8 + 5 = 14" — child counts one too few or one too many across the decade boundary). These off-by-one errors are already covered by Class 1.
- **Dave's research?** Sub-to-20 § 3 (sub-to-20 research) introduces the analog "decade-anchor miss" (Class B) for subtraction across the decade boundary. The mechanism is the same — child anchors at 10 and miscounts the remaining steps — but for *subtraction*, the error mode is "stops counting back at 10 instead of continuing to the result." For *addition cross-10-bridge*, the analog would be "stops at 10 after the bridge step and forgets to add the remainder." Is this a documented error or speculative? **Dave has not weighed this for the add-to-20 surface.** See §7.6 for the explicit Dave-research gap.
- **Mechanical fit?** Distractor value would be `10` for any cross-10-bridge fact. For `8 + 5 = 13`, chip `{10, 13, 14}` (Class 1 secondary on opposite side). For `9 + 2 = 11`, chip `{10, 11, 12}` — but `10` is `correct - 1` (degenerate; aliases Class 1). For `9 + 9 = 18`, chip `{10, 17, 18}` — but `10` is 8 away from correct, *too distant* to be a plausible trap (children don't drop 8 in a carry). **Mechanical fit is patchy** — only the EASY/medium make-ten-bridge facts (sum ≤ 13) would carry plausible dropped-carry traps.

**Recommendation.** REJECT for v1. Two reasons:
1. The error pattern is not yet documented for mental cross-10-bridge in 7–9 year olds (Dave gap, §7.6).
2. Mechanical fit is patchy (only ~5 of 22 facts produce a plausible Class B trap, and those overlap with Class 1 in 2 cases).

If Thomas wants to re-open, the dispatch path is: dispatch Dave for an `add-to-20-cross-10-bridge-errors-marian.md` research note (mirror sub-to-20 § 3). Until that note exists, this spec's recommendation is REJECT. See §7.6.

### 7.5 First-encounter "and" → "plus" framing — should `add-to-20` inherit `sub-to-10`'s first-session variant?

`sub-to-10` ships with a first-session "take away" warmup that flips to "minus" on session 2+ (sub-to-10 §4.3 + §11 Q4, Thomas 2026-05-15). `sub-to-20` does NOT carry the variant (sub-to-20 §4.3 + §7.2, locked: "Marian has internalised 'minus' by then"). `add-to-10` does NOT carry the variant (add-to-10 §4.3, locked: "tier predates the gate; Marian has run dozens of sessions").

**The candidate.** First-session `add-to-20` "and" warmup: `"Eight and five. How many?"` flipping to `"Eight plus five. How many?"` on session 2+. Same shape as sub-to-10's "take away" → "minus" gate.

**Pedagogical argument for variant.** Cross-10-bridge is *conceptually* new for `add-to-20` (Marian has not bridged across 10 before). The "and" framing (concrete combination) might feel less arithmetic-symbolic than "plus" — easing the cognitive overhead of the bridge work.

**Pedagogical argument against variant.** By the time Marian reaches `add-to-20`, she has run dozens of `add-to-10` sessions where every problem used "plus." She has internalised the framing. Introducing "and" at `add-to-20` onset re-litigates the same cognitive-load tradeoff and *adds* novelty to a tier whose conceptual newness (cross-10-bridge) is already the main load. Two new things at once is worse than one.

**Recommendation.** No variant. Inherit sub-to-20 §7.2's posture: Marian's "plus" model is well-anchored from `add-to-10`; the cross-10-bridge novelty is enough. Re-open at the post-v1 ear-test stage if real-Marian iPad data shows hesitation on the first `add-to-20` session.

### 7.6 Dave-research gap — cross-10-bridge error patterns in 7–9 year olds

This spec INFERS Marian's likely error patterns on `add-to-20` cross-10-bridge from:
- Dave's `add-to-10-counting-to-recall.md` (the finger-counting profile and doubles-anchor reasoning).
- Dave's `sub-to-20-pedagogical-sequence.md` (the parallel-acquisition framing and the L2 Tagalog note).
- Off-by-one as the catch-all error mode (Robinson et al. 2013 — for subtraction; the addition analog is inferential).

**The gap.** Dave has NOT yet researched:
1. **Add-to-20-specific cross-10-bridge error patterns** — what are the documented error modes for a 7-9-year-old doing mental `8 + 5`? Is "stops at 10" (the dropped-carry candidate in §7.4) a real error, or is the literature dominated by off-by-one in the bridge step?
2. **Doubles-saturation effect** — does drilling doubles excessively (the current canon's failure mode) actually harm cross-10-bridge acquisition, or does it just waste pool real-estate? The "doubles prior" correction in §1.4 assumes the former; Dave could confirm.
3. **Order-irrelevance for commutative pairs** — Marian's `add-to-10` commutativity is well-internalised, but does that carry through to the cross-10-bridge surface? Or does she perceive `8 + 5` (large + small, retrieve the large then count) as easier than `5 + 8` (small + large, must decompose the 5 mentally)?

**This spec's recommendation to Matt / orchestrator.** Dispatch Dave for an `add-to-20-cross-10-bridge-errors-marian.md` research note BEFORE Kevin lands the directive + canon rebake. The note would:
- Confirm (or revise) the §1.4 doubles-prior correction (caps at 2).
- Confirm (or revise) the §3.4 Class B rejection.
- Confirm (or revise) the §1.3 (re: §1.1) commutative-pairs-as-distinct-facts choice.
- Confirm (or revise) the §2.4 make-ten-bridge coverage rule (≥1 in P5–P8).

**Without the note.** This spec is implementable as-is — it inherits Dave's adjacent research and applies the precedents from add-to-10 + sub-to-20. The risk is that Dave's actual research surfaces a corrective that ripples through the pool or caps. If the spec ships before Dave dispatch, the correction lands as a v2 amendment.

**Recommendation order.** Surface this to Matt / orchestrator. If Dave dispatch is cheap (≤ 1 day), do it first. If it would block the spec ship by >2 days, ship v1 as-is and amend post-research.

### 7.7 Pool-size sanity-check — 22 facts the right breadth?

The pool is deliberately smaller than `add-to-10`'s 44 facts (22/8 = 2.75× soak vs 44/8 = 5.5× soak). Rationale (§1.3): each `add-to-20` fact carries higher per-fact pedagogical weight (it represents a deliberate cross-10 strategy moment, not a fact-family closure exercise).

**The question.** Is 22 the right number? Two candidate alternatives:
- **18 facts** — drop 4 redundant commutative pairs (e.g. keep `8 + 5` and drop `5 + 8`). Cuts the soak factor to 2.25×. Risk: under-drilling.
- **30 facts** — widen to include the deferred `4+7, 7+4, 5+6, 6+5, 4+8, 8+4` secondary bridge facts. Soak factor 3.75×. Risk: dilutes the high-leverage focus.

**Recommendation.** Lock at 22 tentatively. Re-audit at the 5-session-post-promotion mark (same trigger as add-to-10 §9.4's pool-extension-audit ticket). If Marian's session histories show every pool fact has been seen ≥3 times AND she still has not promoted, widen toward 30. If she promotes in 3–4 sessions, the pool size is fine.

---

## 8. Tracked follow-ups (post-merge)

What this spec implies for code (Kevin) and content (canon). PR split per §6: **SINGLE PR** (content + canon + lint in one PR; no render-side change needed).

**This PR — content + canon + lint (Kevin):**

- `api/_planner.ts:964` — `MATH_TRACK_GUIDE` `add-to-20` block expanded to 22-fact pool with annotations + DOUBLES-CAP / NEAR-DOUBLES-CAP / HIGH-LEVERAGE COVERAGE self-checks (per §4.1).
- `scripts/compositionLint.ts` — new `ADD_TO_TWENTY_POOL` + `ADD_TO_TWENTY_RULES`; new branch in `resolveTierBinding`.
- `scripts/compositionLint.test.ts` — fixtures for the new pool entries + rules.
- `public/canon/math/level-1/add-to-20.json` — re-baked canon via `npm run canon:regen` per §6.5; supersedes the current doubles-saturated bake.
- `src/lib/progress/defaults.ts` — sanity-check `'add-to-20'` default level.
- `api/_planner.test.ts` — add-to-20 plan composition tests (§6.3).
- `src/screens/Math/distractors.test.ts` — representative add-to-20 distractor pin-tests (§6.2).
- `src/screens/Math/planFromServer.test.ts` — add-to-20 read-line parser fixtures (§6.1).

**Test changes (covered in single PR):**

- `_planner.test.ts` add-to-20 plan composition tests.
- `compositionLint.test.ts` fixtures.
- `planFromServer.test.ts` parser fixtures.
- `distractors.test.ts` representative pin-tests.
- Cross-PR (Jessica E2E): `e2e/add-to-20-composition.spec.ts` (only if §6.8 confirms requirement at dispatch).

**Doc changes:**

- `.claude/docs/skill-trees-and-content.md` — `add-to-20` row in "Math distractors" subsection (post-merge; `maintain-docs` may auto-route).
- `.claude/docs/planner-and-canon.md` — "Haiku doubles prior" subsection updated with the structural-correction note.
- `.claude/docs/progress-and-persistence.md` — promotion-gate footnote extended for `add-to-10 → add-to-20`.

**Out of this PR's scope (follow-up):**

- `src/lib/progress/slowFacts.ts` + `_planner.ts:isSlowFactsActive` — widen scope to include `add-to-20` once Marian generates ≥5 sessions of data. Mirrors the `add-to-10` precedent.
- Leitner box activation for `add-to-20` — same trigger as slow-fact activation.
- v2 pool widening: secondary cross-10-bridge facts (`4+7, 7+4, 5+6, 6+5, 4+8, 8+4`) — re-audit at the 5-session-post-promotion mark per §7.7.
- Parallel-sequencing re-wire (§7.3 Option B) — if Marian's data shows `add-to-20` stalling, dispatch a paired progression-state-machine PR + Jessica E2E.
- Subitising-scaffold extension to `add-to-20` cross-10-bridge per `subitising-scaffold-content.md` §7.2 (separate sibling spec).
- v2 spec: "add-to-20-with-tens" widening `addend ≤ 10` per §7.1 / §7.2 Option B (only if Thomas re-opens; recommendation Option A locks them out for v1).
- Dave research dispatch — `add-to-20-cross-10-bridge-errors-marian.md` per §7.6. May surface amendments to this spec.

---

## 9. Cross-references

- **Dave's sub-to-20 research** — `design/research/sub-to-20-pedagogical-sequence.md` (the parallel-acquisition framing; the cross-10-bridge strategy ladder rationale; the L2 Tagalog note).
- **Dave's add-to-10 research** — `design/research/add-to-10-counting-to-recall.md` (Marian's finger-counting profile; doubles + sums-to-10 anchors; subitising priority).
- **Dave's distractor research** — `design/research/math-distractor-and-streak-decisions.md` (gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Sibling content spec (predecessor structure)** — `design/math/sub-to-20-content.md` (Kyle, 2026-05-17; the 22-fact-pool + band-by-slot + category-cap structural template that this spec mirrors).
- **Sibling content spec (predecessor tier)** — `design/math/add-to-10-content.md` (Kyle, 2026-05-15 / amended 2026-05-16; the addition-tier precedent; the no-Class-2 decision precedent; the 44-fact-pool audit precedent).
- **Sibling content spec (other sub-tier)** — `design/math/sub-to-10-content.md` (Kyle, 2026-05-15; the dual-exposure rule + accuracy-only-advancement origin).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md` (Haiku doubles prior NOF; canon prebake; Leitner box scoping; slow-fact directive scope).
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md` (mastery rule `95/3`; promotion-gate-do-NOT-include-Leitner-or-slow-fact footnote).
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md` (math node ladder; distractor classes per tier).
- **Memory: distractor-class pedagogical-gates-mechanical** — `feedback_distractor_class_pedagogical_gates_mechanical` (the lens applied to §3.3 + §3.4 + §7.4 — pedagogical fit gates mechanical fit; Class B rejection grounded in the developmental-psychology gap).
- **Memory: Haiku directive sharpening** — `feedback_haiku_directive_sharpening` (validated patterns for inline-band-tagging + per-rule self-checks + negative anchors; applied throughout §4.1).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (Jessica E2E required for any progression-state-machine PR; §7.3 Option B would trigger this; §7.3 Option A / Option C do NOT).
- **Memory: clickup forward-only default** — `feedback_clickup_forward_only_default` (ticket filing routed via orchestrator).
