# Number Garden — `two-digit-addsub` content tier (no-regroup, place-value preservation, 36-fact pool, mixed `+`/`−` within session, parallel-sequencing cycle 4)

**Status:** SPEC — draft for Thomas review. Implementation blocked on this PR merging. Kevin/Devon pick up impl after spec approval.
**Ticket:** TBD — orchestrator to file in ClickUp `list_id: 901523003843`. Kyle's MCP scope is read-only on ClickUp; ticket creation routed via orchestrator (per `[[feedback_clickup_forward_only_default]]`).

**Authority chain.**
- **Primary pedagogical authority (THIS TIER):** [`design/research/two-digit-addsub-error-patterns.md`](../research/two-digit-addsub-error-patterns.md) (Dave, 2026-05-21, PR opening alongside this spec) — concatenated-single-digit-processing error pattern (Fuson 1990/1997; Brown-VanLehn repair theory); the structural false-positive problem on no-regroup tiers (a child treating each digit independently produces correct answers on every no-regroup fact); Class 2 column-cross distractor as the diagnostic lever; Class 3 phantom-borrow distractor on the `−` side; Tagalog L1 as mild protective factor; digit-by-digit TTS prohibition; no make-ten-bridge bleed-through. This spec consumes Dave's findings throughout; load-bearing references called out inline.
- Pedagogical baseline: [`design/research/sub-to-20-pedagogical-sequence.md`](../research/sub-to-20-pedagogical-sequence.md) §1.3 (Dave, 2026-05-16, PR #267) — frames sub-to-20 as the bridge to two-digit arithmetic, with no-regroup as the correct developmental sequence per Clements & Sarama 2009/2020. The same rationale applies for the `add` side of this tier.
- Predecessor research: [`design/research/add-to-20-cross-10-bridge-errors-marian.md`](../research/add-to-20-cross-10-bridge-errors-marian.md) (Dave, 2026-05-17, PR #277) — cross-10-bridge error taxonomy + wrong-by-5 finger-boundary error + tie-effect / doubles-prior calibration. **CAUTION:** the make-ten-bridge strategy from add-to-20 must NOT bleed into this tier (Dave NOF #4 — bridge-style reasoning teaches a conflicting strategy at the place-value surface). See §4.1 directive PROHIBITION block.
- Distractor baseline: [`design/research/math-distractor-and-streak-decisions.md`](../research/math-distractor-and-streak-decisions.md) (Dave, 2026-04-25) — gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`.
- Doubles-prior correction precedent: applied (and confirmed by Dave) in `add-to-20-content.md` §1.4 + add-to-20-cross-10-bridge research §3; analogised in this spec as a "round-ten-anchor prior" correction.

**Predecessor content specs (structural template):**
- [`design/math/add-to-20-content.md`](./add-to-20-content.md) (Kyle, 2026-05-17, PR #276) — primary structural template; 22-fact pool + band-by-slot + category caps + high-leverage-coverage rule + dual-exposure-rule forward-compat. This spec follows the same §0–§9 shape.
- [`design/math/sub-to-20-content.md`](./sub-to-20-content.md) (Kyle, 2026-05-17, PR #269) — the `op === '-'` precedent including Class B (decade-anchor) distractor; this spec inherits Class B as a real (not forward-compat-only) distractor on the subtraction half of its pool.
- [`design/math/add-to-10-content.md`](./add-to-10-content.md) + [`design/math/sub-to-10-content.md`](./sub-to-10-content.md) — earlier addition and subtraction patterns; cited where they ground per-rule decisions.

**Parallel-sequencing positioning (Thomas decision-stack — see §7.1):** `two-digit-addsub` is the FIRST tier in the Number Garden that ships **mixed-operation** sessions (both `op === '+'` AND `op === '-'` problems in the same 8-problem set). Until now, each tier has been pure-op (add-to-10 / add-to-20 = pure `+`; sub-to-10 / sub-to-20 = pure `-`). The dual-exposure rule scaffolded by every prior content spec (sub-to-10 §7, sub-to-20 §5.3, add-to-20 §5.5) **binds at this tier** for the first time. This spec ratifies the mixed-op session shape and the dual-exposure rule as load-bearing.

**The no-regroup constraint is the structural correction lever.** Just as add-to-20 ships with a doubles-prior correction (cap doubles at 2/8 so Haiku doesn't over-pick the easy retrieval bucket), two-digit-addsub ships with a **no-regroup-only** constraint that excludes every fact requiring carry or borrow. Regrouping (carry on `+`, borrow on `−`) introduces a new conceptual operation — decomposing the ten — that belongs in a future tier (cycle 5: `two-digit-addsub-regroup` or similar). The v1 pool is **structurally regrouping-free**: pool-membership-by-construction means Haiku cannot accidentally emit a regrouping fact even with a poorly tuned directive.

---

> ## ⚠️ Structural false-positive warning (Dave NOF #1 — LOUD)
>
> **The no-regroup tier has a STRUCTURAL FALSE-POSITIVE PROBLEM.** A child executing "concatenated-single-digit processing" (treating each digit as an independent single-digit problem — Fuson 1990/1997, Brown-VanLehn repair theory) produces **CORRECT answers on every single no-regroup problem in this tier's pool.** Example: for `23 + 14 = 37`, the concatenated processor computes `2 + 1 = 3` (tens), `3 + 4 = 7` (units), concatenates to `37` — correct answer, wrong process. The child has not learned place value; she has learned to apply add-to-10 twice and concatenate.
>
> **The 95%/3-session promotion gate (`sub-to-20 → two-digit-addsub` AND `two-digit-addsub → skip-counting`) will promote her even if she never understood place value.** The gate is structurally insufficient on this tier because correct/incorrect alone does not discriminate place-value-understanding from concatenated-single-digit-processing.
>
> **This spec addresses the false positive in two places:**
>
> 1. **§3 distractor design** — Class 2 (column-cross) distractor at P4–P8 deliberately targets the concatenated-single-digit error. A child tapping the Class 2 trap is exhibiting the diagnostic error pattern; a child consistently rejecting it is exhibiting genuine place-value understanding. Class 2 IS the diagnostic instrument.
> 2. **§5 advancement gate + schema-extension dependency** — the gate must observe *which distractor was tapped*, not just whether the answer was right. This requires extending `MathSessionResult` (and the matching localStorage schema) to carry `perProblemDistractorClass` (or equivalent). **Schema-extension PR is in-flight (Kevin, dispatched 2026-05-21 in parallel with this spec)** — Thomas confirmed "schema first, canon second" sequencing. This spec proceeds as planned without blocking; the schema PR + this spec land in parallel, then Kevin's canon-rebake + lint binding wave consumes both.
>
> **Sequencing summary (per Thomas 2026-05-21):**
>
> 1. **Parallel wave 1:** Kyle spec PR (this doc) + Kevin schema-extension PR (`MathSessionResult.perProblemDistractorClass` field).
> 2. **Wave 2 (Kevin):** canon rebake + planner directive + compositionLint binding (consumes both wave-1 PRs).
> 3. **Wave 3 (Devon):** render-side widening — parser + chip-range + chip-derivation + distractorClass union extension.
> 4. **Wave 4 (Jessica):** E2E spec + sign-off.
>
> Wave-3 (Devon) can run parallel to Wave-2 (Kevin) once wave-1 lands — see §6 for the file-level division. The parser + chip-range widening from Devon is required BEFORE Marian can launch the tier on iPad, regardless of whether the canon has been rebaked.

---

## 0. Why this spec, why now

- `two-digit-addsub` is currently a **single-line directive** at [`api/_planner.ts:1176`](../../api/_planner.ts#L1176): `"addition or subtraction with at least one two-digit addend. read: 'Twenty-three plus four. How many?' Answer < 100, no carrying/borrowing in this slice."` There is no structured fact pool, no band/category taxonomy, no distractor-coverage rules, no compositionLint binding. The current baked canon at [`public/canon/math/level-1/two-digit-addsub.json`](../../public/canon/math/level-1/two-digit-addsub.json) reads `Twenty plus three; Fifteen plus two; Thirty-one plus four; Twenty-six plus five; Twenty-eight minus three; Thirty-four minus two; Forty-two plus six; Thirty-nine minus seven` — **functional by happy accident** (the no-regroup constraint is preserved per-fact via the operand range), but with no protective lint and an empirical signal that Haiku will reach for facts whose first operand is a "round-ten" anchor (`20+, 30+, 40+`) more than mid-decade anchors. Same pattern as the add-to-20 doubles-prior — Haiku gravitates to the easiest representational instance of the tier.
- **Marian's April 2026 diagnostic + projected trajectory.** Once `sub-to-20` masters (cycle 3 ships this session), Marian's working surface is `[0, 20]` with both operations confident in no-regroup form. The next pedagogical job is **place-value preservation under operation** — the insight that adding a one-digit number to a two-digit number does NOT change the tens place (when no carry occurs), and similarly for subtraction without borrow. This is the conceptual prerequisite for two-digit-and-two-digit operations later (and for the regrouping tier after).
- **Predecessor pattern.** Every prior content-tier spec shipped with: a structured pool, a category-cap directive (the Haiku-prior correction lever), a compositionLint binding, a re-baked canon. This spec follows the same shape with two material additions:
  1. **First tier with mixed-op sessions.** Every prior tier has been pure-op. The mixed-op directive shape is new; distractor wiring needs to be op-aware on the chip side.
  2. **First tier requiring parser widening.** The current `planFromServer.ts` regex `[a-z]+` does NOT match hyphenated number words like `"twenty-three"`. The existing two-digit-addsub canon **already contains** un-parseable read lines (e.g. `"Thirty-one plus four. How many?"`); if Marian were to launch this tier today, the screen would throw `PlanFromServerError` on parse and fall back to a silent static plan. Parser widening is a hard prerequisite, not a polish item.
- **Dave's add-to-20 research already covers most of the cognitive ground.** §1.6 wrong-by-5 finger-boundary, §1.2 off-by-one bridge-step error, §3 doubles-prior correction — these all carry through to two-digit-addsub. The new cognitive surface for this tier is **place-value preservation** (does Marian recognise that `23 + 4 = 27` does NOT touch the tens digit?). Whether that warrants its own research note is §7.6.
- **Dave's verdict on visual scaffolding** (sub-to-20 research § 4.5) carries: skip the CRA visual detour. The 3-chip recognition format IS the representational layer. No screen-layer redesign.
- **Dave's verdict on speed-feedback UX** carries: no speed-feedback UI. Slow-fact directive is backend re-targeting only.

**Scope of this spec:**

- The 36-fact ordered pool (§1) — 25 addition + 11 subtraction facts — banded by difficulty and categorised by place-value pattern. Pool is **structurally regrouping-free**: every fact's units column adds/subtracts without crossing a decade.
- Problem-mix rules for an 8-problem session (§2) — 5 `+` problems, 3 `−` problems (op-mix ratio explained §2.2); category caps; band-by-slot; high-leverage coverage rule on the place-value-preservation pattern.
- **FOUR distractor classes (§3)** — gentle (P1–P3), off-by-one (fallback), **Class 2 column-cross (P4–P8, primary diagnostic per Dave NOF #1)**, **Class 3 phantom-borrow (P5–P8 `−`-only)**. Class B (decade-anchor) demoted to fallback role only.
- Read-line templates + per-slot utterance templates (§4). Reuses the existing `"<a> plus <b>. How many?"` / `"<a> minus <b>. How many?"` shape, with NEW prosody-prohibitions: no digit-by-digit TTS, no make-ten-bridge bleed.
- Schema posture — `MathFact` reuse; **answer-range ceiling widening** (`ANSWER_RANGE_MAX_TWO_DIGIT = 99`); **parser widening** for hyphenated number words (§5).
- The advancement gate INTO this tier (`sub-to-20 → two-digit-addsub`) — accuracy-only per math default `95/3`.
- The advancement gate OUT of this tier (`two-digit-addsub → skip-counting`) — **NEW: diagnostic-aware** (≥ 95% accuracy AND ≥ 80% Class-2-rejection rate) per §5.4. Depends on the schema-extension PR (Kevin Wave 1b — dispatched 2026-05-21 in parallel with this spec).
- The dual-exposure rule **promoted from forward-compat scaffold to load-bearing rule** (§5.5).
- The op-aware slow-fact threshold posture — out of scope; tier not slow-fact-active in v1.
- The wire-up checklist for Kevin + Devon — **FOUR-WAVE sequencing** (§6).
- Acceptance criteria for Jessica's E2E + Kevin/Devon's vitest suites (§6).
- Open questions for Thomas's decision (§7).
- Tracked follow-ups (§8).

**Out-of-scope:**

- **Implementation.** This spec hands off to Kevin (directive + canon + lint + chip-range constants) and Devon (parser + chip-derivation widening — the FIRST cross-PR split since sub-to-20 cycle 3, which also needed render-side change).
- **Regrouping (carry / borrow).** FORBIDDEN here. Facts like `27 + 6 = 33` (carry: 7+6=13) or `32 − 5 = 27` (borrow: 0 ones not enough for 5) are out of pool entirely. Belongs in a future `two-digit-addsub-regroup` tier (cycle 5).
- **Two-digit operand on BOTH sides.** Facts like `23 + 14 = 37` are **deferred to §7.2** (open question). Default recommendation: **YES, include them** for `+` only, on the condition that no-regroup holds (i.e. units column never crosses 10). For subtraction, exclude two-digit minuend + two-digit subtrahend in v1 (it pushes the conceptual surface into the regrouping prerequisite zone). See §7.2 for the full Thomas decision.
- **3-digit operands.** Out entirely — that's `add-to-100`+ territory, off the curriculum map for August 2026.
- **Negative results.** `12 − 15` etc. — FORBIDDEN. The subtraction pool is constrained such that `minuend ≥ subtrahend`.
- **Skip-counting framing** (e.g. `"twenty, thirty, ... what's next?"`) — that's the `skip-counting` tier (cycle 5 candidate).
- **Multiplication / arrays.** Future tiers.
- **CRA visual scaffolding detour.** Same out-of-scope ruling as add-to-20.
- **Speed-feedback UX.** Same out-of-scope ruling.
- **First-encounter framing variant.** Marian has run dozens of `add-to-X` and `sub-to-X` sessions by the time she reaches `two-digit-addsub`; the `"plus" / "minus"` templates are fully internalised. No "and" / "take away" first-session variant. See §7.5.
- **`Math.tsx` layout redesign.** Chip-rendering and gesture handling consume `MathProblem` op-agnostically. Two-digit chips render with the same component; the only widening is the answer-range ceiling.
- **Subitising-scaffold extension.** `subitising-scaffold-content.md` §7.2 explicitly defers two-digit subitising; out of scope for v1.

---

## 1. The 36-fact pool — ordered, banded, categorised, op-typed

The pool below is the union of facts Haiku may draw from for any `two-digit-addsub` session. The full no-regroup `+` surface for `a + b ∈ [10, 99], a ∈ [10, 99], b ∈ [1, 9]` (2-digit + 1-digit) with the no-carry constraint (`(a mod 10) + b ≤ 9`) contains **~250 ordered facts**; the full no-borrow `−` surface for `a − b ∈ [10, 99], a ∈ [10, 99], b ∈ [1, 9]` with the no-borrow constraint (`(a mod 10) ≥ b`) contains a similar count. The 36 below cover every band Dave names and the conceptual categories that index Marian's available strategies, with **deliberate selection across the decades 10–60** for representational variety and **deliberate omission of the very largest decades (70–99)** for v1 — the tier teaches a conceptual operation, not a memorisation surface.

> **Out-of-pool reminder.** Every `+` fact satisfies `a + b ∈ [10, 99]`, `a ∈ [10, 99]`, `b ∈ [1, 9]`, `(a mod 10) + b ≤ 9`. Every `−` fact satisfies `a − b ∈ [10, 99]` (no result < 10), `a ∈ [10, 99]`, `b ∈ [1, 9]`, `(a mod 10) ≥ b`. The pool below is the curated subset enforced by compositionLint.

### 1.1 Pool table (LOCKED — band structure mirrors `add-to-20`'s EASY/MEDIUM/HARD ladder; per-fact curation owned by Kyle; place-value-preservation is the high-leverage category)

Each fact is annotated with strategy category. Categories index how Marian is likely to mentally compute:

- `round-ten-anchor` — the first operand ends in zero (e.g. `20 + 3`, `40 − 5`). Tens digit unchanged by operation; child reads "twenty" and appends/removes a one-digit count. The "trivial" entry point for this tier; high salience for Haiku's prior (the current canon is `20+, 30+, 40+`-heavy, exactly this category). **Capped tight.**
- `mid-decade-units-shift` — first operand has non-zero units; operation changes the units digit but never crosses a decade boundary (e.g. `23 + 4 = 27`, `38 − 5 = 33`). **The actual learning target of this tier** — place-value-preservation under operation. Most pedagogical weight; largest pool count.
- `tens-doubles-echo` — first operand is itself a `n + n` style double in the tens place (e.g. `22 + 5`, `44 − 3`). Doubles intuition carries from add-to-10. Pool count is small (5 facts).
- `near-boundary-no-cross` — units value is close to 9 (for `+`) or close to 0 (for `−`) but does NOT cross. E.g. `27 + 2 = 29` (units 7+2=9, boundary safe by 1), `42 − 2 = 40` (units 2-2=0, boundary safe by 1). High-leverage in P5–P8: these facts test that Marian recognises "no crossing" even when the units value is near the threshold. Critical for cycle 5 regroup-tier preparation.
- `two-digit-plus-two-digit` — **CONDITIONAL on §7.2 Thomas decision** — facts like `23 + 14 = 37`, `45 + 22 = 67`. Default recommendation: include 6 facts (`+` only) in HARD band. See §7.2.

Pool table follows. Read as: `# | Fact | Op | Band | Category | Teaching note`.

| #   | Fact         | Op  | Band   | Category                  | Teaching note                                                                                                                                       |
| --- | ------------ | --- | ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20 + 3 = 23`  | +   | easy   | round-ten-anchor          | Smallest round-ten anchor on the `+` side. Marian: "Twenty, and three more — twenty-three." Confidence opener; minimal cognitive load.              |
| 2   | `30 + 5 = 35`  | +   | easy   | round-ten-anchor          | Same template, different decade. Reinforces decade-name retrieval (thirty).                                                                         |
| 3   | `40 + 2 = 42`  | +   | easy   | round-ten-anchor          | Same template, smaller units value.                                                                                                                 |
| 4   | `25 + 4 = 29`  | +   | easy   | near-boundary-no-cross    | Units 5+4=9, exactly at the boundary without crossing. Tests "is it still safe?" recognition. Smallest discriminate.                                |
| 5   | `33 + 4 = 37`  | +   | easy   | mid-decade-units-shift    | Tens-digit unchanged by operation. The first true place-value-preservation experience in the session.                                               |
| 6   | `22 + 5 = 27`  | +   | easy   | tens-doubles-echo         | "Twenty-two" carries the doubles intuition (2+2 in the tens, then add 5). Connects to add-to-10's doubles anchor.                                   |
| 7   | `15 − 3 = 12`  | −   | easy   | mid-decade-units-shift    | Smallest `−` fact in the pool — bridges from sub-to-20 (where 15 − 3 was also in pool). Same fact, new framing as place-value preservation.        |
| 8   | `40 − 5 = 35`  | −   | easy   | round-ten-anchor          | Round-ten on the `−` side. NOTE: this fact would require borrow IF Marian computes left-to-right "40 minus 5 means take 5 from 0" — but the correct method is to recognise this as 35 directly. See §3.3 Class B distractor design (chip `30`).       |

Wait — fact #8 needs sharper handling. Let me re-state: `40 − 5 = 35` does NOT involve borrow per the no-borrow constraint `(a mod 10) ≥ b`. Here `(40 mod 10) = 0`, `b = 5`, `0 < 5` — this VIOLATES the no-borrow constraint and must be EXCLUDED from the v1 pool. Restating:

> **Constraint correction (load-bearing).** Round-ten subtractions like `40 − 5 = 35` require borrowing (the units `0 − 5` is undefined without borrowing from the tens). v1 EXCLUDES all such facts. The no-borrow constraint `(a mod 10) ≥ b` rules them out structurally. Round-ten anchors appear on the `+` side only.

Replace fact #8 and continue:

| #   | Fact         | Op  | Band   | Category                  | Teaching note                                                                                                                                       |
| --- | ------------ | --- | ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | `28 − 5 = 23`  | −   | easy   | mid-decade-units-shift    | Tens-digit unchanged. The first true place-value-preservation experience on the `−` side. Replaces the excluded `40−5`.                            |
| 9   | `19 − 7 = 12`  | −   | easy   | mid-decade-units-shift    | Bridges from sub-to-20's pool (19 − 7 = 12); same fact, place-value framing.                                                                        |
| 10  | `21 + 3 = 24`  | +   | medium | mid-decade-units-shift    | Tens-digit unchanged. P4–P8 entry for `+`.                                                                                                          |
| 11  | `34 + 5 = 39`  | +   | medium | near-boundary-no-cross    | Units 4+5=9, near-boundary. Forces Marian to count to 9 and check.                                                                                  |
| 12  | `42 + 3 = 45`  | +   | medium | mid-decade-units-shift    | Different tens place than #10; same conceptual pattern, decade variety.                                                                             |
| 13  | `54 + 4 = 58`  | +   | medium | mid-decade-units-shift    | Carries the tens-place into the 50s; expands the decade range Marian sees.                                                                          |
| 14  | `36 + 2 = 38`  | +   | medium | mid-decade-units-shift    | Smaller units shift, larger first operand. Variety on the count-on procedure.                                                                       |
| 15  | `44 + 3 = 47`  | +   | medium | tens-doubles-echo         | "Forty-four" — doubles echo at a new decade. Tens-doubles intuition extends from #6 (`22 + 5`).                                                     |
| 16  | `18 − 4 = 14`  | −   | medium | mid-decade-units-shift    | Bridges from sub-to-20 (18 − 4 was in pool). Place-value framing.                                                                                   |
| 17  | `25 − 3 = 22`  | −   | medium | mid-decade-units-shift    | First true `−` mid-decade-units-shift outside the sub-to-20 carry-over range.                                                                       |
| 18  | `37 − 4 = 33`  | −   | medium | mid-decade-units-shift    | Tens-digit unchanged.                                                                                                                               |
| 19  | `26 − 5 = 21`  | −   | medium | near-boundary-no-cross    | Units 6−5=1, near-boundary-no-cross on the `−` side. Marian must NOT drop the 21 to 20 by accident (the 1 is preserved).                          |
| 20  | `23 + 6 = 29`  | +   | hard   | near-boundary-no-cross    | Units 3+6=9, right at the boundary. Highest-leverage `+` no-cross fact (Marian who is going to cross-10 will produce `30` as the wrong answer).    |
| 21  | `41 + 8 = 49`  | +   | hard   | near-boundary-no-cross    | Same boundary pattern, different decade.                                                                                                            |
| 22  | `32 + 7 = 39`  | +   | hard   | near-boundary-no-cross    | Same pattern, smaller first-operand units value.                                                                                                    |
| 23  | `55 + 4 = 59`  | +   | hard   | near-boundary-no-cross    | Same pattern, larger decade.                                                                                                                        |
| 24  | `27 + 2 = 29`  | +   | hard   | near-boundary-no-cross    | Same boundary, even smaller units shift.                                                                                                            |
| 25  | `35 − 4 = 31`  | −   | hard   | near-boundary-no-cross    | Units 5−4=1, near-zero-boundary. The `−` analog of #20 — Marian must NOT carry the borrow across (which would produce `21` incorrectly).           |
| 26  | `48 − 7 = 41`  | −   | hard   | near-boundary-no-cross    | Same pattern.                                                                                                                                       |
| 27  | `52 − 1 = 51`  | −   | hard   | near-boundary-no-cross    | Smallest units shift; near-zero result on the units.                                                                                                |
| 28  | `64 − 3 = 61`  | −   | hard   | near-boundary-no-cross    | Larger decade variety.                                                                                                                              |
| 29  | `66 + 3 = 69`  | +   | hard   | tens-doubles-echo         | "Sixty-six" — doubles echo at the largest decade in v1.                                                                                             |
| 30  | `47 + 2 = 49`  | +   | hard   | near-boundary-no-cross    | Boundary at units 7+2=9.                                                                                                                            |

**Conditional rows 31–36 — `two-digit-plus-two-digit` (CONDITIONAL on §7.2 Thomas: default INCLUDE):**

| #   | Fact         | Op  | Band   | Category                  | Teaching note                                                                                                                                       |
| --- | ------------ | --- | ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 31  | `23 + 14 = 37`| +   | hard   | two-digit-plus-two-digit  | Both operands two-digit; units 3+4=7 (no-carry); tens 2+1=3 (no-carry). Pedagogical bridge to cycle 5 regrouping prep. **§7.2 conditional.**       |
| 32  | `42 + 31 = 73`| +   | hard   | two-digit-plus-two-digit  | Same shape, different decades.                                                                                                                      |
| 33  | `25 + 14 = 39`| +   | hard   | two-digit-plus-two-digit  | Same shape, boundary-near units (5+4=9).                                                                                                            |
| 34  | `31 + 26 = 57`| +   | hard   | two-digit-plus-two-digit  | Same shape, different decade pairing.                                                                                                               |
| 35  | `52 + 13 = 65`| +   | hard   | two-digit-plus-two-digit  | Same shape, larger first operand.                                                                                                                   |
| 36  | `34 + 22 = 56`| +   | hard   | two-digit-plus-two-digit  | Same shape, tens-doubles echo in operand 2.                                                                                                         |

**If §7.2 Option A (single-digit-second-operand only):** pool is 30 facts (#1–30). All `two-digit-plus-two-digit` deferred to a v2 spec.
**If §7.2 Option B (default, include 6 two-digit-plus-two-digit on `+` side):** pool is 36 facts (#1–36).

**Band counts (v1 default pool, 36 facts):**
- `easy` — 9 facts (#1–9): round-ten-anchor ×3 (#1, #2, #3), mid-decade-units-shift ×4 (#5, #7, #8, #9), near-boundary-no-cross ×1 (#4), tens-doubles-echo ×1 (#6).
- `medium` — 10 facts (#10–19): mid-decade-units-shift ×7 (#10, #12, #13, #14, #16, #17, #18), near-boundary-no-cross ×2 (#11, #19), tens-doubles-echo ×1 (#15).
- `hard` — 17 facts (#20–36): near-boundary-no-cross ×9 (#20, #21, #22, #23, #24, #25, #26, #27, #28, #30), tens-doubles-echo ×1 (#29), two-digit-plus-two-digit ×6 (#31–36). Wait — #20–28 + #30 = 10 facts in HARD/near-boundary-no-cross (corrected below).

**Sanity-check note on band/category math (load-bearing — verify before lint shipping):**

Re-counting from §1.1 row-by-row:

- **EASY band (#1–9, 9 facts):**
  - round-ten-anchor: #1, #2, #3 = 3 facts
  - mid-decade-units-shift: #5, #7, #8, #9 = 4 facts
  - near-boundary-no-cross: #4 = 1 fact
  - tens-doubles-echo: #6 = 1 fact
  - Total: 3 + 4 + 1 + 1 = 9 ✓
- **MEDIUM band (#10–19, 10 facts):**
  - mid-decade-units-shift: #10, #12, #13, #14, #16, #17, #18 = 7 facts
  - near-boundary-no-cross: #11, #19 = 2 facts
  - tens-doubles-echo: #15 = 1 fact
  - Total: 7 + 2 + 1 = 10 ✓
- **HARD band (#20–30 default, 11 facts in single-digit pool; #20–36 if §7.2 Option B = 17 facts):**
  - In the SINGLE-DIGIT-only pool (#20–30, 11 facts):
    - near-boundary-no-cross: #20, #21, #22, #23, #24, #25, #26, #27, #28, #30 = 10 facts
    - tens-doubles-echo: #29 = 1 fact
    - Total: 10 + 1 = 11 ✓
  - In the §7.2 Option B pool (#20–36, 17 facts):
    - As above (11) + two-digit-plus-two-digit (#31–36) = 6 facts
    - Total: 17 ✓

**Op counts (default §7.2 Option B 36-fact pool):**
- `+`: 24 facts (#1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 29, 30, 31, 32, 33, 34, 35, 36)
- `−`: 12 facts (#7, 8, 9, 16, 17, 18, 19, 25, 26, 27, 28). Wait — count: #7, #8, #9 (3 EASY) + #16, #17, #18, #19 (4 MEDIUM) + #25, #26, #27, #28 (4 HARD) = 11. Re-counting: #7, #8, #9, #16, #17, #18, #19, #25, #26, #27, #28 = 11 facts.

Correction: the op count is `+`: 25 facts, `−`: 11 facts. Total: 36. ✓ Mismatch with the introductory paragraph claim of "24 + 12" is corrected here. Lint asserts: `addPoolFacts.length === 25 && subPoolFacts.length === 11`.

### 1.2 Pool-composition cross-check

- **Answer range:** `[12, 73]` (smallest is `15 − 3 = 12`; largest is `42 + 31 = 73` under §7.2 Option B; largest single-digit `+` is `66 + 3 = 69`). The chip-range ceiling `ANSWER_RANGE_MAX_TO_20 = 20` is **insufficient** — `chipMaxAnswerForCorrects` currently `throw`s for any correct > 20 (`distractors.ts:111-113`). **NEW CONSTANT REQUIRED: `ANSWER_RANGE_MAX_TWO_DIGIT = 99`.** See §5.1 + §6.2.
- **Operand range:** `a ∈ [10, 99]`, `b ∈ [1, 9]` (default); `b ∈ [10, 99]` for `two-digit-plus-two-digit` facts (§7.2 Option B). Pool table enforces this; lint asserts it.
- **No-regroup constraint (load-bearing):** For every `+` fact, `(a mod 10) + (b mod 10) ≤ 9`. For every `−` fact, `(a mod 10) ≥ (b mod 10)`. Lint enforces with worked-example error messages.
- **No-result-below-10 constraint:** Every `−` fact's result ≥ 10. Lint asserts.
- **Minuend ≥ subtrahend:** Every `−` fact has `a ≥ b`. Lint asserts (no negative results).
- **`MathFact` representation:** every pool fact maps to `{ a: addendA, b: addendB, op: '+' | '-' }` cleanly. No schema changes; reuses the `op` field threaded through `MathProblem` since PR #241.
- **Commutativity (for `+`):** Ordered pairs are DISTINCT — `23 + 14` and `14 + 23` are two separate fact identities in principle, but for `two-digit-plus-two-digit` v1 the larger-first ordering is preferred (per Dave's add-to-20 research §4 operand-order finding for finger-counter children — larger first is easier). Pool emits each two-digit-plus-two-digit fact in ONE ordering only (the larger-first); the reverse ordering is a deferred v2 widening. This is a deliberate cap to avoid pool inflation. (For `+` with single-digit `b`, commutativity does not apply since `b` is constrained to `[1, 9]` and `a` to `[10, 99]` — the reverse `b + a` would be `singledigit + twodigit` which is OUT of scope per §0.)

### 1.3 Why these 36 (or 30), not more (or fewer)

The full no-regroup `+` surface has ~250 facts; this curation:

1. **Spans the decades 10–60 representationally** rather than memorising any single decade exhaustively. The tier teaches a conceptual operation (place-value preservation); decade variety reinforces that the operation is decade-agnostic.
2. **Caps `round-ten-anchor` at 3 pool entries** (`20+3, 30+5, 40+2`) with a session cap of 1 (§2.2). The current canon is round-ten-saturated; this halves+ the surface.
3. **Prioritises `mid-decade-units-shift` and `near-boundary-no-cross`** (combined: 23 of 30 single-digit facts, ~77%) — the actual learning targets. Place-value preservation IS the tier's pedagogical job; near-boundary IS the high-leverage cycle-5 regrouping-prep diagnostic.
4. **Includes `tens-doubles-echo` as a light intuition anchor** (3 facts: `22+5, 44+3, 66+3`) — connects backward to add-to-10's doubles intuition without making doubles a session-dominating category.
5. **Omits decades 70–99 in v1** (no `73+, 81-, 95-` facts). These add representational variety but no new conceptual surface. Pool extension to higher decades deferred to v2 once Marian's data shows decade-recognition fluency.
6. **`two-digit-plus-two-digit` is the §7.2 conditional** — recommended INCLUDE for `+` only because it materially advances toward cycle 5 (regrouping needs two-digit-and-two-digit familiarity even pre-regrouping). For `−`, two-digit minuend + two-digit subtrahend pushes into borrow-prerequisite territory and is deferred per Dave's sub-to-20 research §1.3 framing.

**The soak factor.** 36-fact pool for 8-problem sessions gives `36/8 = 4.5×` soak. Across 5 sessions, every pool fact is seen ~1.1× on average. Tighter than add-to-20's 22/8 = 2.75× by 1.6×, but the per-fact pedagogical weight is LOWER here than at add-to-20 (each fact is a representational variation on one conceptual rule, vs add-to-20's per-fact strategy-moment). 4.5× soak is the right intensity for retrieval automaticity without rote drilling.

### 1.4 The round-ten-anchor-prior correction — why `round-ten-anchor` is capped tight

The empirical signal from the current canon (`20+3, 30+5, 40+2, 26+5, 28-3, 34-2, 42+6, 39-7`): 3 of 8 facts are round-ten anchors (`20+3, 30+5, 40+2`). This is **identical in structure to the add-to-20 doubles-prior** — Haiku gravitates to the easiest representational instance of the tier when given an under-constrained directive.

The correction strategy mirrors `feedback_haiku_directive_sharpening`'s validated patterns:

1. **Inline band tags** per add-to-10 / sub-to-20 / add-to-20 precedents.
2. **Negative anchors over positive quantifiers** — the directive (§4.1) explicitly says "DO NOT place more than 1 round-ten-anchor in a session" and lists the 3 round-ten facts that compete for that 1 slot.
3. **Per-rule self-checks against attention-budget-shift** — DISTRACTOR-COVERAGE SELF-CHECK and ROUND-TEN-ANCHOR-CAP SELF-CHECK explicitly walk Haiku through counting category fills before finalising.
4. **Drift-guard wording + invariant** — positive rule wording with explicit fact lists; self-checks are mechanical.

**Why cap round-ten-anchor at 1, not 2 (like add-to-20's doubles cap)?** Because the round-ten facts are the **least pedagogically valuable** in the pool — they don't exercise place-value preservation (the tens digit is preserved trivially because the units operation never gets near a boundary). One per session is the maximum justifiable; two would dominate at 25% of the session and crowd out mid-decade-units-shift / near-boundary-no-cross facts that carry the learning target.

### 1.5 Pool-extension policy

Pool extensions beyond 36 (or 30 if §7.2 Option A) are deferred (§8 follow-ups):

- **Higher decades** (70–99) — once Marian's data shows decade-recognition fluency across the 10–60 range, widen the pool to include `73 + 4`, `81 + 6`, `95 − 2`, etc. Adds representational variety with no new pedagogical surface; deferred to a v2 spec.
- **Two-digit `−` minuend + two-digit subtrahend** — facts like `47 − 23 = 24` (no-borrow). Deferred to cycle 5 / cycle 6 because of the borrow-prerequisite pedagogical sequence per Dave's sub-to-20 §1.3.
- **Single-digit `+` two-digit (commutative for `two-digit-plus-two-digit`)** — facts like `5 + 23 = 28`. Deferred; commutativity practice belongs in a later tier.
- **Mixed-op fact-family practice** — explicit interleaving of `a + b = c` and `c − b = a` across sessions (not within a session — the dual-exposure rule still binds). Deferred to a future "mixed-op-fact-family" sibling spec post-v1 settlement.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 36-fact pool above (or 30-fact pool under §7.2 Option A). Same structural shape as add-to-20 §2 / sub-to-20 §2 / add-to-10 §2 / sub-to-10 §2: warm-up gentle ramp on EASY, discriminate tier on MEDIUM + HARD with category caps and high-leverage coverage.

**New for this tier: op-mix ratio.** Each session contains BOTH `+` and `−` problems. The op-mix is part of the composition rules and gated by lint.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source             | Op constraint            | Distractor class (§3)              | Why                                                                                                       |
| ------------- | ------------ | ----------------------- | ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P1            | gentle       | `easy` band only        | `+` only                 | Class 0 — gentle                   | Session opener. `+` is the more confident operation per Marian's diagnostic; opening with `+` minimises onset anxiety. |
| P2            | gentle       | `easy` band only        | `+` or `−` (mixed)       | Class 0 — gentle                   | First mixed-op exposure WITHIN the session — Marian sees both operations from problem 2. Gentle distractor class.   |
| P3            | gentle       | `easy` band only        | `+` or `−` (mixed)       | Class 0 — gentle                   | Three successful experiences before discriminate trap distractors arrive. Op-mix established by P3.        |
| P4            | discriminate | `medium` band only      | `+` or `−`               | Class 1 — off-by-one               | First diagnostic. MEDIUM-band entry; HARD-band forbidden at P4.                                            |
| P5            | discriminate | `medium` or `hard` band | `+` or `−`               | Class 1 — off-by-one (`+`); Class 1 or Class B (`−`) | HARD-band first-permitted slot. Class B applies on `−` problems only.                                      |
| P6            | discriminate | `medium` or `hard` band | `+` or `−`               | Class 1 — off-by-one (`+`); Class 1 or Class B (`−`) | "                                                                                                          |
| P7            | discriminate | `medium` or `hard` band | `+` or `−`               | Class 1 — off-by-one (`+`); Class 1 or Class B (`−`) | "                                                                                                          |
| P8            | discriminate | `medium` or `hard` band | `+` or `−`               | Class 1 — off-by-one (`+`); Class 1 or Class B (`−`) | Closer. Full discriminative pressure. At least ONE near-boundary-no-cross fact MUST appear in P5–P8 per §2.4 (the high-leverage coverage rule). |

**Band-by-slot rule (LOCKED, mirrors add-to-20 §2.1 + sub-to-20 §2.1):**

- EASY (#1–9): allowed at any slot P1–P8 (gentle ramp anchor; also permitted as a discriminate-tier fallback when recent-score modulation biases easy).
- MEDIUM (#10–19): allowed at P4–P8.
- HARD (#20–30 / #20–36): allowed at P5–P8 only. **HARD must NOT appear at P1–P4.**

### 2.2 Op-mix rules — first tier with mixed-op sessions

> **Within an 8-problem session: at least 5 `+` problems AND at least 2 `−` problems. Default mix: 5 `+` / 3 `−`.**

**Lint enforces: `addCount ∈ [5, 6], subCount ∈ [2, 3], addCount + subCount === 8`.**

**Why 5 `+` / 3 `−` default mix?**

1. **`+` is the more confident operation per Marian's diagnostic** (April 2026: "Sums to 10, drive automaticity"; sub-to-20 is later in the curriculum than add-to-20 by design). Bias the session toward the more confident operation.
2. **`−` cognitive load is higher per Dave's sub-to-20 research** (§4.5: 7000 ms slow-fact threshold widening for `op === '-'`). Capping `−` at 3 of 8 leaves Marian breathing room.
3. **Mixed-op WITHIN session is the new conceptual surface this tier teaches.** The op-mix ratio of ~37% `−` matches the proportion of subtraction surface in the curriculum as a whole (4 of 10 tiers in `MATH_TREE` are subtraction-prefixed when counting through cycle 6); it normalises operation alternation as a meta-skill.

**P1 is always `+`.** Hard rule — session opener carries onset anxiety; the more confident operation enters first.

**Op-mix and the dual-exposure rule interact (§5.3).** Once `−` appears in the session, the dual-exposure rule forbids the corresponding `+` inverse from also appearing. Practically: if `25 − 3 = 22` is in the session, then `22 + 3 = 25` is FORBIDDEN. Lint asserts the dual-exposure rule across all op-pair combinations.

### 2.3 Category caps (LOCKED — round-ten-anchor cap is the round-ten-prior correction lever)

Across the 8-problem set:

| Category                   | Cap | Rationale                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `round-ten-anchor`         | 1   | Pool has 3 round-ten-anchor facts (`20+3, 30+5, 40+2`); cap at 1 cuts the current canon's 3-of-8 saturation by two-thirds. **Round-ten-prior correction lever.** Marian retrieves these trivially; they're representational filler, not learning target.                                                       |
| `mid-decade-units-shift`   | 4   | Pool has 11 mid-decade-units-shift facts (largest category). Cap at 4 is the calibration anchor for typical mid-score sessions. Combined with near-boundary-no-cross cap (5), the two place-value-preservation categories share 9 of 8 slots — guaranteed dominance.                                          |
| `near-boundary-no-cross`   | 5   | Pool has 12 near-boundary-no-cross facts (second-largest). Cap at 5 is generous because near-boundary IS the high-leverage learning target (the cycle-5 regroup-prep diagnostic). A typical session under recent-score-mid will contain 3–4 near-boundary facts; cap binds only on near-boundary-heavy sessions. |
| `tens-doubles-echo`        | 1   | Pool has 3 tens-doubles-echo facts (`22+5, 44+3, 66+3`); cap at 1 keeps doubles intuition lightly present without re-introducing the add-to-20 doubles-prior at a new tier.                                                                                                                                    |
| `two-digit-plus-two-digit` | 2   | §7.2 Option B only — pool has 6 two-digit-plus-two-digit facts; cap at 2 caps the cycle-5-prep representational surface to 25% of the session, leaving room for the single-digit-second-operand mainline.                                                                                                       |

**Caps are mutually exclusive** (each fact maps to exactly one category per the §1.1 priority pattern). A single 8-problem session sums to at most `1 + 4 + 5 + 1 + 2 = 13` permits, which comfortably accommodates the 8-slot session (and over-allocates by 5 to give Haiku composability headroom — note: when §7.2 Option A, drop the `two-digit-plus-two-digit` cap row, total = 11 permits).

### 2.4 High-leverage coverage rule — near-boundary-no-cross

> **At least one `near-boundary-no-cross` fact MUST appear in P5–P8.**

This is the analog of:
- add-to-20 §2.4 "≥1 make-ten-bridge fact in P5–P8" (the actual learning target of add-to-20),
- sub-to-20 §2.3 "≥1 take-to-decade fact in P5–P8" (the take-from-decade strategy for sub-to-20),
- sub-to-10 §2.3 "≥1 take-from-10 fact in P4–P8" (the take-from-10 strategy for sub-to-10),
- add-to-10 §2.4 "≥1 sums-to-10 fact in P4–P8" (the make-10 model for add-to-10).

Naming: this spec uses the lint-rule literal `'high-leverage-coverage'` shared across tiers; the per-tier semantic is set by the rule wiring (`near-boundary-no-cross` for `two-digit-addsub`).

**Why P5–P8 not P4–P8?** P4 is restricted to MEDIUM-band only. The near-boundary-no-cross category spans EASY (#4), MEDIUM (#11, #19), and HARD (#20, #21, #22, #23, #24, #25, #26, #27, #28, #30). If P4 carries a MEDIUM near-boundary-no-cross fact (#11 or #19), the rule is trivially satisfied. P5–P8 is the strictest framing because it forces the coverage rule to bind even when P4 happens to be a mid-decade-units-shift or tens-doubles-echo fact. **Lint enforces P5–P8 ≥ 1 near-boundary-no-cross.**

### 2.5 No-duplicates rule

No `(a, b, op)` triple may repeat within the 8-problem session. NOTE: `25 + 4` and `4 + 25` would be duplicates IF the latter were in pool — but per §0 (out-of-scope: single-digit-first), the latter is excluded. For `two-digit-plus-two-digit`, the pool ships each fact in one ordering only; lint asserts no commutative-pair duplicate.

### 2.6 Leitner / slow-fact directive (forward-looking)

`two-digit-addsub` is **NOT** Leitner-active in v1. Same posture as add-to-20 §2.6 + sub-to-20 §2.4. The `isLeitnerActive` predicate stays scoped to `add-to-10`. Future widening once Marian has 5+ sessions of latency + accuracy data on the tier.

**Slow-fact threshold posture:** mixed-op sessions need op-aware thresholds. Per sub-to-20 §5.4: 7000 ms for `op === '-'`; 5000 ms for `op === '+'`. The op-aware accessor proposed for sub-to-20 extends trivially to `two-digit-addsub` once Leitner activates. **Out of scope for this spec.** Flagged in §6.7.

---

## 3. Distractor design — FOUR classes (gentle + off-by-one + column-cross + phantom-borrow)

`two-digit-addsub` reuses Classes 0 and 1 unchanged from earlier tiers; **introduces TWO new classes load-bearing to this tier's pedagogical job:**

- **Class 2 — column-cross** (P4–P8, both `+` and `−`) — diagnostic for concatenated-single-digit-processing (Dave NOF #1). The high-leverage class for this tier.
- **Class 3 — phantom-borrow** (P5–P8, `op === '-'` only) — diagnostic for over-generalised regrouping (Dave NOF #1).

Class B (decade-anchor) from sub-to-20 is **NOT a primary class for this tier** — it survives as a secondary `−`-side trap only when Class 3 phantom-borrow is degenerate; recommendation §3.5 below.

**The classes index the error patterns Dave's research documents as the actual cognitive failure modes for this tier.** Class 2 is THE diagnostic instrument for the structural false-positive (the warning block above §1). Class 3 catches the regrouping-prerequisite confusion (children primed by school instruction on borrowing apply it where it doesn't belong).

### 3.1 Class 0 — gentle (P1–P3) — unchanged

Algorithm: two distractor values, each ≥ 2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in `distractors.ts:gentleDistractors`. **Algorithm needs verification at the widened range** — the existing implementation was sanity-checked at `maxAnswer ∈ {10, 20}`; with `maxAnswer = 99` the "extremes" become `{1, 99}` which is fine for `correct ∈ [12, 73]`. Devon to verify no degeneration cases for the smallest correct (`15 − 3 = 12` → extremes `{1, 99}` work) and the largest correct (`42 + 31 = 73` → extremes `{1, 99}` work).

### 3.2 Class 1 — off-by-one (P4–P8) — unchanged for `+`; secondary for `−`

Algorithm: `[correct − 1, correct + 1]` clamped to `[minAnswer, maxAnswer]`. Already implemented in `distractors.ts:offByOneDistractors`. For `correct = 73` (largest in pool under §7.2 Option B), chips are `{72, 73, 74}`. For `correct = 12` (smallest), chips are `{11, 12, 13}`. No degeneration cases.

Class 1 is the **secondary class for this tier** — diagnostic coverage falls to Class 2 (column-cross) primarily and Class 3 (phantom-borrow on `−`). Class 1 is the safety-net default when Class 2/3 traps are degenerate or already covered.

### 3.3 Class 2 — column-cross (P4–P8, both ops) — NEW, DIAGNOSTIC INSTRUMENT for concatenated-processing

**The error pattern (Dave NOF #1).** A child executing concatenated-single-digit-processing computes each column independently using add-to-10 rules and concatenates the results. Critically, on no-regroup problems the answer is correct — making the child indistinguishable from a place-value-understander on accuracy alone. Class 2's job: present a trap chip that the concatenated processor would tap if their column computation drifts in a structurally specific way.

**The trap formula.** For a `+` fact `a + b = c` (write `a = 10·aT + aU`, `b = 10·bT + bU` — for single-digit `b`, `bT = 0`):

- **Class 2 (column-cross) trap:** swap the units and tens columns of the answer. For `23 + 14 = 37`, decompose: tens `2+1=3`, units `3+4=7`, answer `37`. Class 2 trap = `73` (units-tens swap of `37`).
- For `+` with single-digit `b`: tens column is unchanged by operation (it's `aT`), units column is `aU + bU` (no carry). Class 2 trap = swap to `(aU + bU)·10 + aT`. For `23 + 4 = 27`, decompose: tens `2`, units `7`. Trap = `72` (swap).
- For `−` with single-digit `b`: tens unchanged (`aT`), units `aU - bU`. Class 2 trap = swap. For `48 − 7 = 41`, decompose: tens `4`, units `1`. Trap = `14` (swap).

**Pedagogical fit per `[[feedback_distractor_class_pedagogical_gates_mechanical]]`.**

- **Documented error pattern?** YES — Fuson 1990/1997, Brown-VanLehn repair theory. The concatenated-single-digit error is one of the most-replicated multi-digit arithmetic errors in the developmental literature (per Dave's research). It is structurally invisible to no-regroup accuracy gates.
- **Mechanical fit per pool fact:** For most facts, the column-swap produces an in-range plausible chip. Verification at lint time: for each pool fact, compute the swap and assert it is (a) in `[ANSWER_RANGE_MIN, ANSWER_RANGE_MAX_TWO_DIGIT]`, (b) distinct from correct, (c) distinct from off-by-one chips. Degenerate cases (palindromic-units results like `correct = 22` would swap to `22`, aliasing correct) are silently downgraded to Class 1. Lint asserts the degenerate-fraction across the v1 pool is ≤ 10% (i.e. ≥ 90% of pool facts produce a non-degenerate Class 2 trap).
- **Overlap with Class 1?** For most facts the swap is many digits away from off-by-one. For `correct = 24`, off-by-one is `{23, 25}` and Class 2 trap is `42` — no overlap. Degenerate cases (palindromic results) are handled by downgrade.

**Implementation.** Requires NEW discriminator value `distractorClass: 'column-cross'` in the union at `distractors.ts:170`. Render-side: `Math.tsx` derives `distractorClass = 'column-cross'` for `focusNode === 'two-digit-addsub' && problemIndex ∈ [4, 8]` (BOTH ops). The trap formula lives in a new `columnCrossDistractor(correct, a, b, op, maxAnswer)` helper in `distractors.ts`.

**Application rate.** Lint targets ≥ 2 in-range Class 2 traps across P4–P8 (analogous to sub-to-10's wrong-op coverage rule). This is the **high-leverage diagnostic coverage rule** for the tier — at least 2 problems must carry the column-cross trap so the session produces a meaningful distractor-tap signal.

### 3.4 Class 3 — phantom-borrow (P5–P8, `op === '-'` only) — NEW, diagnostic for over-generalised regrouping

**The error pattern (Dave NOF #1, subtraction-specific).** Some children — typically those who have been instructed on borrowing in school but have not yet integrated when-to-borrow correctly — apply a borrow procedure on no-borrow problems. For `48 − 7 = 41`, the over-generalised borrow produces:
- Child treats it as if the tens column needs to be decremented (because subtraction). Output: `38` (decrement tens despite no-borrow signal in units).
- OR child reaches into the tens column unnecessarily. Output: `31` (mis-mapped tens, off-target units).

**The canonical trap formula:** `correct − 10` (decrement the tens digit by 1, preserving units). For `48 − 7 = 41`, Class 3 trap = `31`. For `25 − 3 = 22`, trap = `12`. For `19 − 7 = 12`, trap = `02` = `2` (degenerate — falls below `[ANSWER_RANGE_MIN]`; silent downgrade to Class 1).

**Pedagogical fit.**

- **Documented error pattern?** YES — Dave NOF #1, citing Brown-VanLehn repair theory. Over-application of regrouping is a documented multi-digit subtraction error pattern.
- **Mechanical fit per pool fact:** For v1 `−` pool facts, the Class 3 trap is computable for every fact. The smallest pool result is `12` (`15 − 3` and `19 − 7`), where trap = `2` < `[ANSWER_RANGE_MIN = 1]`? Wait: `12 − 10 = 2` which IS ≥ `ANSWER_RANGE_MIN = 1`. Actually in-range. Lint verifies. The trap is in-range for every `−` pool fact with `correct ≥ 12`. ✓
- **Overlap with Class 2?** For `correct = 41`: Class 2 swap = `14`; Class 3 phantom = `31`. Different traps, no overlap.
- **Overlap with Class 1?** For `correct = 12`: Class 1 = `{11, 13}`; Class 3 = `2`. No overlap. For `correct = 22`: Class 1 = `{21, 23}`; Class 3 = `12`. No overlap.

**Implementation.** Requires NEW discriminator value `distractorClass: 'phantom-borrow'` in the union. Render-side: `Math.tsx` derives `distractorClass = 'phantom-borrow'` for `op === '-' && focusNode === 'two-digit-addsub' && problemIndex ∈ [5, 8]`. The trap formula lives in a new `phantomBorrowDistractor(correct, maxAnswer)` helper.

**Application rate.** Lint targets ≥ 1 in-range Class 3 trap across P5–P8 `−` problems. Of the 3 `−` problems in a default-mix session, at least one MUST carry Class 3.

### 3.5 Class B — decade-anchor — DEMOTED to fallback only (not primary for this tier)

The sub-to-20 Class B decade-anchor distractor IS structurally compatible with this tier (the trap `Math.round(correct / 10) * 10` is in-range for every pool result), BUT Dave's research §3 (the place-value-drop error mode for the count-on profile) is largely subsumed by the more-specific column-cross (Class 2) and phantom-borrow (Class 3) for this tier. Class B is NOT a primary class.

**Posture:** Class B remains as a **fallback** when Class 2 OR Class 3 is degenerate for a specific fact (e.g. palindromic results like a hypothetical `correct = 22` would have a degenerate Class 2 trap). Render-side derivation prefers Class 2/3 first; if both degenerate, falls back to Class B (decade-anchor), then to Class 1 (off-by-one) as the safety-net.

**Implementation.** No new discriminator (Class B's `'decade-anchor'` already exists from sub-to-20 PR #272). Render-side derivation prioritises Class 2/3 first; lint does NOT require Class B coverage for `two-digit-addsub`.

### 3.6 NO Class 2 (sub-to-10 wrong-op) for `two-digit-addsub`

**Distinguishing terminology:** sub-to-10's "Class 2" is `wrong-op` (`a + b` trap on `op === '-'`). This tier's "Class 2" is `column-cross`. They are DIFFERENT classes despite the shared numeric label.

The sub-to-10 wrong-op class is NOT applicable here:
- For `−` facts like `25 − 3 = 22`, the wrong-op trap would be `25 + 3 = 28` (within 6 of correct, often colliding with Class 1 or Class 3 traps).
- For `−` facts like `48 − 7 = 41`, the wrong-op trap would be `48 + 7 = 55` (in-range but plausibility-wise: would the child confuse `48 − 7` with `48 + 7` once they've mastered sub-to-20? Less likely than at sub-to-10).

**Recommendation: NO sub-to-10-style wrong-op class in v1.** Classes 1 + 2 + 3 + B (fallback) cover the empirically-relevant error modes. The wrong-op error is more relevant when the child is first encountering the operator (sub-to-10 entry); by two-digit-addsub the operator-confusion risk is materially lower than the concatenated-single-digit-processing risk.

### 3.7 Distractor-class field — planner-emitted or render-derived?

Per `planner-and-canon.md` § "Wire shape is utterance-only — invariant": the `MathProblem.distractorClass` field is render-derived, not planner-emitted (clarified in PR #264 for sub-to-10; PR #272 carried for sub-to-20). For `two-digit-addsub`, the render-side derivation in `Math.tsx`:

- `problemIndex ∈ [1, 3]` → `distractorClass = undefined` (defaults to gentle).
- `op === '+' && problemIndex ∈ [4, 8]` → `distractorClass = 'column-cross'` (Class 2); silent downgrade to `'off-by-one'` if degenerate.
- `op === '-' && problemIndex === 4` → `distractorClass = 'column-cross'` (Class 2 first); downgrade chain `column-cross → off-by-one`.
- `op === '-' && problemIndex ∈ [5, 8]` → `distractorClass = 'phantom-borrow'` (Class 3 first); downgrade chain `phantom-borrow → column-cross → decade-anchor → off-by-one`.

**Widening required on `distractorClass` union** (`distractors.ts:170`):

```ts
distractorClass?: 'off-by-one' | 'wrong-op' | 'decade-anchor' | 'column-cross' | 'phantom-borrow'
```

Two new literals: `'column-cross'`, `'phantom-borrow'`. Devon's PR ships both.

### 3.8 Diagnostic-coverage rule (high-leverage rule for this tier)

> **At least TWO Class 2 (column-cross) traps AND at least ONE Class 3 (phantom-borrow) trap MUST appear across P4–P8.**

This is the analog of the high-leverage-coverage rules from earlier tiers, recast as a **diagnostic-coverage rule** (the chips carry the diagnostic signal for the false-positive problem). Lint enforces the rule via the canon-bake pipeline (the trap derivation is render-side, but the lint asserts that the pool-fact-set chosen by Haiku admits at least 2 in-range Class 2 traps + 1 in-range Class 3 trap).

**Why 2 Class 2 traps and not 1?** Single-tap is noisy. Two independent Class 2 chips across the discriminate window let the session yield a meaningful "Marian tapped Class 2" rate (0/2 = no diagnostic signal of concatenated-processing; 1/2 = ambiguous; 2/2 = high-confidence diagnostic). The progression-gate consumer (§5.4) reads this rate from the schema-extension data.

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `two-digit-addsub` block

Replace the current single-line directive at [`api/_planner.ts:1176`](../../api/_planner.ts#L1176) with the structured pool directive below. The block follows the same shape as add-to-20 §4.1 and sub-to-20 §4.1.

### 4.1 Block text (literal — Kevin's copy)

> ```
> - two-digit-addsub: addition with sums in [12, 73] OR subtraction with results in [12, 64], where (a) FOR ADDITION: one OR both operands are two-digit, the other is one-digit (or both two-digit per §7.2 Option B), AND the units column sums to AT MOST 9 (no carrying); (b) FOR SUBTRACTION: minuend is two-digit, subtrahend is one-digit, minuend's units digit is >= subtrahend (no borrowing), result >= 12. read for +: "<addendA> plus <addendB>. How many?" e.g. "Twenty-three plus four. How many?". read for -: "<minuend> minus <subtrahend>. How many?" e.g. "Forty-eight minus seven. How many?"
>
>   NO REGROUPING SELF-CHECK (apply before emitting every problem):
>   - For + facts: COMPUTE (a mod 10) + (b mod 10) and CONFIRM it is <= 9. If > 9, the fact requires carrying and is FORBIDDEN (belongs in a future two-digit-addsub-regroup tier). Worked example: 23+4 -> units 3+4=7 OK. 27+6 -> units 7+6=13 FORBIDDEN.
>   - For - facts: COMPUTE (a mod 10) and (b mod 10) and CONFIRM (a mod 10) >= (b mod 10). If <, the fact requires borrowing and is FORBIDDEN. Worked example: 28-5 -> units 8>=5 OK. 32-5 -> units 2<5 FORBIDDEN.
>   - For - facts: COMPUTE a - b and CONFIRM result >= 12. If < 12, the fact's result has slipped below the two-digit range and is FORBIDDEN (belongs in sub-to-20 or sub-to-10). Worked example: 18-4=14 OK. 13-5=8 FORBIDDEN.
>
>   OPERAND-RANGE SELF-CHECK (apply before emitting every problem):
>   - First operand a in [10, 99].
>   - Second operand b in [1, 9] for the SINGLE-DIGIT-SECOND-OPERAND mainline; OR b in [10, 99] ONLY for the explicit "two-digit-plus-two-digit" pool entries listed below.
>   - For two-digit-plus-two-digit + facts: BOTH the units AND the tens columns must add without carrying (a mod 10) + (b mod 10) <= 9 AND ((a / 10 floor) + (b / 10 floor)) <= 9 AND result <= 99. Worked example: 23+14 -> units 3+4=7 OK, tens 2+1=3 OK, result 37 OK. 45+27 -> units 5+7=12 FORBIDDEN.
>
>   FACT POOL (36 ordered facts; pick exactly 8 distinct (a, b, op) triples from this pool per session, no duplicates. The op flag is part of the fact identity — "25-3" and "22+3" are distinct triples but FORBIDDEN to co-occur per the DUAL-EXPOSURE RULE below):
>   Each fact is annotated with [BAND/op/category]. Categories:
>   - round-ten-anchor: first operand ends in zero (e.g. 20+3); units operation is trivial. Capped at 1 per session.
>   - mid-decade-units-shift: place-value-preserving operation on a non-round operand (e.g. 23+4 -> 27); the actual learning target.
>   - near-boundary-no-cross: units operation lands at or near 9 (for +) or 0 (for -) WITHOUT crossing — the cycle-5-regroup-prep diagnostic. High-leverage.
>   - tens-doubles-echo: first operand has matching tens and units digits (e.g. 22+5); doubles intuition lightly carries from add-to-10.
>   - two-digit-plus-two-digit: BOTH operands two-digit (e.g. 23+14); + only; per §7.2.
>   - Easy band (P1-P3 eligible, also P4-P8 fallback):
>     . 20+3=23  [EASY/+/round-ten-anchor]
>     . 30+5=35  [EASY/+/round-ten-anchor]
>     . 40+2=42  [EASY/+/round-ten-anchor]
>     . 25+4=29  [EASY/+/near-boundary-no-cross]
>     . 33+4=37  [EASY/+/mid-decade-units-shift]
>     . 22+5=27  [EASY/+/tens-doubles-echo]
>     . 15-3=12  [EASY/-/mid-decade-units-shift]
>     . 28-5=23  [EASY/-/mid-decade-units-shift]
>     . 19-7=12  [EASY/-/mid-decade-units-shift]
>   - Medium band (P4-P8 eligible):
>     . 21+3=24  [MEDIUM/+/mid-decade-units-shift]
>     . 34+5=39  [MEDIUM/+/near-boundary-no-cross]
>     . 42+3=45  [MEDIUM/+/mid-decade-units-shift]
>     . 54+4=58  [MEDIUM/+/mid-decade-units-shift]
>     . 36+2=38  [MEDIUM/+/mid-decade-units-shift]
>     . 44+3=47  [MEDIUM/+/tens-doubles-echo]
>     . 18-4=14  [MEDIUM/-/mid-decade-units-shift]
>     . 25-3=22  [MEDIUM/-/mid-decade-units-shift]
>     . 37-4=33  [MEDIUM/-/mid-decade-units-shift]
>     . 26-5=21  [MEDIUM/-/near-boundary-no-cross]
>   - Hard band (P5-P8 eligible):
>     . 23+6=29  [HARD/+/near-boundary-no-cross]
>     . 41+8=49  [HARD/+/near-boundary-no-cross]
>     . 32+7=39  [HARD/+/near-boundary-no-cross]
>     . 55+4=59  [HARD/+/near-boundary-no-cross]
>     . 27+2=29  [HARD/+/near-boundary-no-cross]
>     . 35-4=31  [HARD/-/near-boundary-no-cross]
>     . 48-7=41  [HARD/-/near-boundary-no-cross]
>     . 52-1=51  [HARD/-/near-boundary-no-cross]
>     . 64-3=61  [HARD/-/near-boundary-no-cross]
>     . 66+3=69  [HARD/+/tens-doubles-echo]
>     . 47+2=49  [HARD/+/near-boundary-no-cross]
>     . 23+14=37 [HARD/+/two-digit-plus-two-digit]   (§7.2 Option B only)
>     . 42+31=73 [HARD/+/two-digit-plus-two-digit]
>     . 25+14=39 [HARD/+/two-digit-plus-two-digit]
>     . 31+26=57 [HARD/+/two-digit-plus-two-digit]
>     . 52+13=65 [HARD/+/two-digit-plus-two-digit]
>     . 34+22=56 [HARD/+/two-digit-plus-two-digit]
>   POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b, op) triple appears verbatim above. The 36 listed triples (or 30 if §7.2 Option A) are the ONLY allowed facts. Common FORBIDDEN candidates to REJECT (valid by operand/no-regroup constraints but NOT in v1 pool): 73+4 (decade out of v1 range), 81-6 (same), 50+7 (round-ten outside the 3 pool entries), 47-23 (two-digit subtrahend, deferred), 13-5 (result < 12), 27+6 (carry required). These are deferred or FORBIDDEN by construction; not part of v1.
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window.
>   2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
>      . DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
>      . DO NOT place any HARD-band fact at P1, P2, P3, or P4. HARD-band only appears at P5 or later.
>      . The ONLY facts allowed at P1, P2, P3 are: 20+3, 30+5, 40+2, 25+4, 33+4, 22+5, 15-3, 28-5, 19-7.
>   3. P1 IS ALWAYS +. Hard rule — session opener carries onset anxiety; the more confident operation enters first. Allowed P1 facts: 20+3, 30+5, 40+2, 25+4, 33+4, 22+5.
>   4. OP-MIX RULES (mandatory):
>      . The 8-problem session must contain AT LEAST 5 problems with op = '+' AND AT LEAST 2 problems with op = '-'.
>      . The default mix is 5 + / 3 -.
>      . Allowed mixes: 5+/3- (default), 6+/2-. FORBIDDEN: 8+/0-, 7+/1-, 4+/4-, 3+/5-.
>   5. Problem 4: MEDIUM-band only (HARD-band still forbidden at P4).
>   6. Problems 5-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) -> bias toward medium and REDUCE - count to exactly 2; high score (>= 0.85) -> push toward hard with >=1 near-boundary-no-cross in P5-P8 (high-leverage coverage rule); mid score -> balanced.
>   7. HIGH-LEVERAGE COVERAGE RULE: at least one near-boundary-no-cross fact MUST appear in P5-P8 (drawn from: 23+6, 41+8, 32+7, 55+4, 27+2, 47+2, 35-4, 48-7, 52-1, 64-3, OR MEDIUM-band 34+5, 26-5). This is the actual learning target of the tier — Marian must recognise that even when the units value is near 9 (or near 0), the operation does NOT cross the decade.
>   8. ROUND-TEN-ANCHOR-CAP SELF-CHECK: AT MOST ONE problem across the entire 8-problem session may carry the round-ten-anchor category (drawn from: 20+3, 30+5, 40+2). Before emitting a second round-ten-anchor, REJECT it. The current canon ships with all three round-ten anchors present — that is the failure mode this cap corrects. Pick at most 1; let the others lie unused for this session.
>   9. MID-DECADE-UNITS-SHIFT-CAP SELF-CHECK: AT MOST FOUR problems across the entire 8-problem session may carry the mid-decade-units-shift category. Before emitting a fifth, REJECT it.
>   10. NEAR-BOUNDARY-NO-CROSS-CAP SELF-CHECK: AT MOST FIVE problems across the entire 8-problem session may carry the near-boundary-no-cross category. Before emitting a sixth, REJECT it. (Cap binds only on near-boundary-heavy compositions — typical sessions land at 3-4.)
>   11. TENS-DOUBLES-ECHO-CAP SELF-CHECK: AT MOST ONE problem may carry the tens-doubles-echo category. Before emitting a second, REJECT it.
>   12. TWO-DIGIT-PLUS-TWO-DIGIT-CAP SELF-CHECK (§7.2 Option B only): AT MOST TWO problems may carry the two-digit-plus-two-digit category. Before emitting a third, REJECT it.
>   13. NO duplicate (a, b, op) triples within the 8-problem set.
>   14. DUAL-EXPOSURE RULE (LOAD-BEARING — this is the first tier where the rule binds, not forward-compat scaffolding): never pair an + fact and its - inverse in the same session, where "inverse" means the same operand triple. E.g. if 25-3=22 is in the session, 22+3=25 is FORBIDDEN AND 25-22=3 is FORBIDDEN (the latter is out of pool by being a one-digit result, but the rule asserts it for completeness). For two-digit-plus-two-digit facts like 23+14=37, both 37-14=23 and 37-23=14 are FORBIDDEN (both are out of v1 - pool by being two-digit subtrahends, but the rule asserts it for completeness). The dual-exposure rule is enforced across (a, b, op) and (a, c, op) and (b, c, op) triples where a+b=c.
>
>   DISTRACTOR-COVERAGE SELF-CHECK (for problems 5-8): the render pipeline (src/screens/Math/Math.tsx) attempts a Class B (place-value-drop) trap on every op:'-' P5-P8 problem AND silently downgrades to off-by-one when the trap is OOR or aliases the correct answer. To deliver >= 1 in-range Class B trap across P5-P8, bias the P5-P8 selection to include at least one - fact (already required by OP-MIX rules). For the v1 pool, EVERY - fact's Class B trap is in-range and non-degenerate (verified at lint time); the >= 1 target is satisfied by including >= 1 - fact in P5-P8 — which IS the default mix posture.
>
>   PROSODY: numbers are spelled out as QUANTITY WORDS, not digit-by-digit. Two-digit numbers use the hyphenated quantity form ("twenty-three", "forty-five", "sixty-nine") — Emma renders these on en-US-EmmaMultilingualNeural rate -10% cleanly (validated by the existing two-digit-addsub canon for "Twenty plus three" / "Fifteen plus two" / "Forty-two plus six"). Capitalize the first word of each sentence.
>
>   PROSODY PROHIBITION (Dave NOF #3 — LOAD-BEARING): never render two-digit operands digit-by-digit. FORBIDDEN: "two three plus one four. How many?" / "Two-three plus four. How many?" / "two and three plus one and four. How many?". ALLOWED: "Twenty-three plus fourteen. How many?". Digit-by-digit TTS actively trains the concatenated-single-digit-processing error pattern (the structural false-positive — see §3.3). Quantity-word framing is the only correct form.
>
>   STRATEGY PROHIBITION (Dave NOF #4 — LOAD-BEARING): never invoke or suggest the make-ten-bridge / cross-10-bridge decomposition strategy from add-to-20 in this tier. FORBIDDEN hint text: "Look. Twenty-three. And four more. Twenty-three plus two is twenty-five, then plus two more is twenty-seven" (decomposes through a fictitious intermediate). FORBIDDEN read variant: "Twenty-three and four. How many?" if "and" framing suggests sums-through-decomposition. ALLOWED hint text: "Look. Twenty-three. And four more. How many now?" — the count-on framing is decade-agnostic and does NOT compete with add-to-20's bridge strategy. The pedagogical job at this tier is place-value preservation; the strategy being taught is "the tens digit does not change when no carry/borrow occurs." Bridge-style strategies from add-to-20 trained the cross-decade case; they teach a CONFLICTING mental model when applied to no-cross facts at this tier.
>
>   Do NOT verbally decompose the two-digit operand (e.g. do NOT say "twenty and three plus four" instead of "twenty-three plus four") — per Dave § 2 (L2 context note, sub-to-20 research), verbal decomposition adds L2 cognitive load without pedagogical benefit. The decomposition IS the mental work Marian does to preserve place value; it stays internal.
>
>   L1 TRANSPARENCY NOTE (Dave NOF #2): Marian's L1 Tagalog renders two-digit numbers compositionally ("dalawampu't tatlo" = "twenty-and-three"); the L1 structure is more transparent about the tens decomposition than English. NO additional L1-specific scaffolding is required for this tier — Tagalog is a mild PROTECTIVE factor for place-value transparency, not a risk requiring mitigation.
> ```

> **Note on hyphenation.** Two-digit number words 21–99 are hyphenated ("twenty-three", "forty-five"). The current parser (`planFromServer.ts:225` regex `([a-z]+)`) does NOT match hyphens — this is the parser-widening prerequisite called out in §5.2. Devon's PR widens the regex BEFORE Kevin's directive PR lands.

### 4.2 Per-slot utterance templates

| Slot         | Template                                                                          | Example for `48 − 7 = 41`                                       | Notes                                                                                                              |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `read` (+)   | `"<addend-A> plus <addend-B>. How many?"`                                         | n/a (- example)                                                  | Same template as add-to-X tiers. Two-digit `addend-A` is hyphenated ("Twenty-three plus four. How many?").         |
| `read` (−)   | `"<minuend> minus <subtrahend>. How many?"`                                       | `"Forty-eight minus seven. How many?"`                           | "minus" framing (NOT "take away"). The "minus" template is internalised by sub-to-X mastery.                       |
| `correct`    | `"Yes! <answer>!"`                                                                | `"Yes! Forty-one!"`                                              | Number-celebration. Two-digit answers hyphenated.                                                                  |
| `reprompt`   | `"Hmm... try again?"` (verbatim)                                                  | `"Hmm... try again?"`                                            | Locked phrasing.                                                                                                   |
| `hint` (+)   | `"Look. <addend-A>. And <addend-B> more. How many now?"`                          | n/a (- example)                                                  | Mirrors add-to-X.                                                                                                  |
| `hint` (−)   | `"Look. <minuend>. Take away <subtrahend>. How many now?"`                        | `"Look. Forty-eight. Take away seven. How many now?"`            | "take away" framing in the hint regardless of "minus" in the read (per sub-to-20 §4.2 precedent).                  |
| `giveAnswer` | `"This one is <answer>."`                                                         | `"This one is forty-one."`                                       | Locked. Two-digit answers hyphenated.                                                                              |

**Two-digit number prosody.** All operands and results land in `[1, 99]`. Hyphenated forms ("twenty-three", "forty-five", "sixty-nine") render cleanly on the existing voice (validated by the current canon's "Twenty plus three", "Twenty-six plus five", etc. samples). Decade names ("twenty", "thirty", ... "ninety") and teen numbers ("eleven" … "nineteen") render cleanly from prior-tier validation. **No SSML overrides required.**

### 4.3 First-encounter scaffolding gate — NOT REQUIRED for `two-digit-addsub`

Per §4.1 directive note: `two-digit-addsub` uses the "plus" / "minus" templates from session 1. **No entry added to `FIRST_ENCOUNTER_GATED_NODES`** in [`api/_firstEncounterGate.ts`](../../api/_firstEncounterGate.ts).

Same rationale as add-to-20 §4.3 + sub-to-20 §4.3: Marian has internalised both `"plus"` and `"minus"` templates by the time she reaches this tier; introducing a first-session variant would add novelty to an already-novel tier (mixed-op + two-digit operands).

---

## 5. Schema posture, advancement gate, dual-exposure rule, slow-fact request, parser widening, chip-range widening

### 5.1 Schema posture — `MathFact` reuse, NEW answer-range ceiling, NO new distractorClass

`two-digit-addsub` introduces NO new TypeScript types for fact representation. Every fact uses the existing `MathFact` shape with `op: '+' | '-'`.

**Wire-shape changes — NONE.** The `distractorClass` union does NOT widen (Class B / `'decade-anchor'` was already added in PR #272 for sub-to-20). The `MathProblem.op` field is REQUIRED and value is `'+' | '-'`.

**NEW constant in `distractors.ts`:**

```ts
/**
 * Answer-range upper bound for the two-digit-addsub tier (ticket TBD).
 * Two-digit-addsub results land in [12, 73] for the v1 pool; the chip
 * ceiling is set to 99 (the largest possible two-digit result, providing
 * forward-compat headroom to a future v2 widening of the pool to higher
 * decades).
 */
export const ANSWER_RANGE_MAX_TWO_DIGIT = 99
```

**`chipMaxAnswerForCorrects` widening** (`distractors.ts:106-114`):

```ts
export function chipMaxAnswerForCorrects(corrects: readonly number[]): number {
  if (corrects.length === 0) return ANSWER_RANGE_MAX
  const maxCorrect = Math.max(...corrects)
  if (maxCorrect <= ANSWER_RANGE_MAX) return ANSWER_RANGE_MAX
  if (maxCorrect <= ANSWER_RANGE_MAX_TO_20) return ANSWER_RANGE_MAX_TO_20
  if (maxCorrect <= ANSWER_RANGE_MAX_TWO_DIGIT) return ANSWER_RANGE_MAX_TWO_DIGIT  // NEW row
  throw new Error(
    `[distractors] no tier ceiling covers correct=${maxCorrect}; extend chipMaxAnswerForCorrects`,
  )
}
```

This is the **load-bearing chip-range widening**. Without it, every `two-digit-addsub` canon load throws on chip derivation. Devon's PR carries this.

**Gentle distractor extreme-bias at the wider range.** Devon verifies that for `correct ∈ [12, 73]` with `maxAnswer = 99`, the extreme-biased values `1` and `99` still produce sensible chip layouts (`{1, 23, 99}` for `correct = 23` is functionally fine — the trap chips are very far from correct, which is the design intent for gentle ramp). No degeneration cases identified.

**`distractors.ts:206` boundary assertion.** The existing assertion `maxAnswer < minAnswer + 2` already permits 99 trivially. No change.

### 5.2 Parser widening — `planFromServer.ts` hyphen support (LOAD-BEARING)

**The current parser regex** (`planFromServer.ts:225`):

```ts
/^\s*([a-z]+)\s+plus\s+([a-z]+)\s*\.\s*how\s+many\s*\?\s*$/i
```

The `[a-z]+` character class does NOT match hyphens. The existing two-digit-addsub canon contains `"Thirty-one plus four. How many?"` — which the parser will FAIL to recognise, throwing `PlanFromServerError` and falling back to the silent static plan. This is a latent bug in the current build.

**Devon's widening:**

```ts
/^\s*([a-z][a-z-]*)\s+plus\s+([a-z][a-z-]*)\s*\.\s*how\s+many\s*\?\s*$/i
```

The new character class `[a-z][a-z-]*` requires a leading letter (preventing pathological `"-twenty plus three"` matches) and permits hyphens internally. Apply the same widening to the subtraction regexes at `planFromServer.ts:232-244`.

**The `NUMBER_WORDS` table** (`planFromServer.ts:91-113`) must be extended to include:
- `twenty-one` → 21, `twenty-two` → 22, ... `twenty-nine` → 29
- `thirty` → 30, `thirty-one` → 31, ... `thirty-nine` → 39
- ... through `ninety-nine` → 99

That's an additional **89 entries** (21–99). The `decodeOperands` function (`planFromServer.ts:273`) keys into `NUMBER_WORDS` by `word.toLowerCase()` directly — no algorithmic change needed beyond the table extension.

**Alternative: programmatic decoding.** Devon may choose to replace the table with a small parser:
- `decade = NUMBER_WORDS_DECADES[decadePart]` (table: twenty→20, thirty→30, ..., ninety→90)
- `units = NUMBER_WORDS_UNITS[unitsPart]` (existing 0–9 + ten)
- `total = decade + units` if hyphenated; else just `units` or `decade`

The programmatic approach is cleaner and forward-compat to 3-digit numbers if ever needed. **Devon's choice.** Either approach satisfies the contract. Spec recommends programmatic for cleanliness.

**Verification.** Add fixtures to `planFromServer.test.ts` exercising every decade word (twenty, thirty, ... ninety) AND every hyphenated form across 21–99 (sample: 21, 35, 47, 58, 66, 73, 89, 99). The parser test sweep is the safety net.

### 5.3 Advancement gate INTO this tier — `sub-to-20 → two-digit-addsub` (ACCURACY ONLY)

Per `MATH_TREE` order: `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → two-digit-addsub → …`. The promotion INTO this tier follows the standard rule:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default threshold `95/3` locked 2026-05-02, ticket 86c9kwvy0).

**Explicitly NOT a gate for promotion INTO this tier:**

- ❌ Leitner box drainage state.
- ❌ Slow-fact list length.
- ❌ Latency median.
- ❌ Marian's prior-tier mixed-op-readiness signal — **do NOT introduce a "ready for mixed-op" custom gate.** Mixed-op practice WITHIN this tier is itself the treatment; pre-gating on out-of-tier signals reverses the developmental sequence.

**Code implication for the INTO gate.** NO code change to `applyMasteryRule` or `pickFocusNode`. The existing rule promotes on accuracy alone.

### 5.4 Advancement gate OUT of this tier — `two-digit-addsub → skip-counting` (ACCURACY + DIAGNOSTIC SIGNAL)

This is where the structural-false-positive (the warning block) bites. The OUT gate needs to consume the schema-extension data Kevin's parallel PR ships.

**Recommended gate (LOCKED pending Kevin schema PR landing):**

> A two-digit-addsub session qualifies as **promotion-eligible** when:
> 1. **Accuracy ≥ 95%** (per the math default), AND
> 2. **Class-2-rejection rate ≥ 80%** across the session's P4–P8 problems (i.e. when a Class 2 column-cross trap was offered, the child chose NOT to tap it ≥ 80% of the time).
>
> The predecessor node qualifies for promotion when 3 consecutive `cross-day-deduped` sessions both rules above hold.

The rationale: the Class 2 rejection rate IS the proxy for genuine place-value understanding. A child running concatenated-single-digit-processing will tap Class 2 at the chance rate (or higher if the column-swapped trap looks plausible to the concatenated procedure). A child with genuine place-value understanding will reject Class 2 reliably.

**80% rejection threshold rationale.** Of 2 Class 2 chips per session × 3 sessions = 6 trap exposures. 80% rejection = ≥ 5 of 6 traps rejected. Tighter than 95% (which would require all 6 rejected and feels brittle on a 6-exposure window); looser than 50% (which is at-chance and uninformative). Locked at 80% pending empirical validation post-v1.

**Schema-extension dependency (Kevin's parallel PR):**

- Extend `MathSessionResult` with `perProblemDistractorClass?: ReadonlyArray<DistractorClassTag | null>` (length 8).
- Extend `perProblemTappedValue` (already in flight) with the value Marian tapped per problem.
- The promotion-gate consumer computes Class-2 rejection rate as `count(perProblem[i].distractorClass === 'column-cross' && perProblem[i].correct === true) / count(perProblem[i].distractorClass === 'column-cross')`.

**Without the schema extension (interim posture):** the OUT gate ships with the standard accuracy-only rule + a documented false-positive risk. The risk is recoverable: a concatenated-processor child shipped to skip-counting / mult-2-5-10 will eventually hit a tier where concatenated processing fails. **Interim risk is bounded; merge with the standard rule.**

**Code implication for the OUT gate (post-schema-extension):**

- `src/lib/progress/mastery.ts:applyMasteryRule` — extend the rule signature to accept `perProblemDistractorClass` + `perProblemTappedValue` and apply the diagnostic threshold for `focusNode === 'two-digit-addsub'`. Other focus nodes ignore the parameter.
- The widened signature is FORWARD-COMPATIBLE for future tiers that may also need diagnostic-aware gates (cycle 5 regrouping; multiplication tiers).
- E2E spec from Jessica covers the gate (see §6.8).

**Hard stop (parent / observation gate, NOT algorithmic):** standard `autoPromote: false` Parent Settings flag.

### 5.4a Promotion-gate fallback when schema extension is unavailable

If Kevin's schema-extension PR lands AFTER Kevin's canon-rebake PR (i.e. the diagnostic-aware gate is not yet available when this tier first ships to Marian), the OUT gate ships with accuracy-only as a temporary measure. The schema-extension PR retrofits the gate without disturbing canon. **Sequence per Thomas 2026-05-21: schema first, canon second** — so this fallback should not be the actual ship path; documented here for resilience only.

### 5.5 Dual-exposure rule — LOAD-BEARING (first tier where it binds)

**Rule (PROMOTED from forward-compat scaffold to load-bearing — first time it bites).**

> Within an 8-problem `two-digit-addsub` session, no operand triple may appear in both `+` and `−` forms.

**Definition.** For an addition fact `a + b = c`, the subtraction inverses are `c − a = b` and `c − b = a`. For a subtraction fact `a − b = c`, the addition inverses are `c + b = a` and `b + c = a`. ALL orderings are FORBIDDEN in the same session as the original fact.

**Examples (V1 — this is where the rule binds):**

- Session contains `25 − 3 = 22`. The inverse `22 + 3 = 25` is FORBIDDEN. (NOTE: `22 + 3` is not in the v1 pool either — but the rule asserts it for completeness and forward-compat with a v2 pool widening.)
- Session contains `33 + 4 = 37`. The inverse `37 − 4 = 33` is FORBIDDEN. (NOTE: `37 − 4` is in the v1 pool — fact #18. So if Haiku picks `33+4` AND `37-4` for the same session, lint rejects.)
- Session contains `28 − 5 = 23`. The inverse `23 + 5 = 28` is FORBIDDEN. (NOTE: `23+5` is NOT in v1 pool — `23+6` is. Rule asserts for completeness.)

**V1 enforcement scope. Within-pool collisions (cases where BOTH the `+` fact AND its `−` inverse are pool members):**

Walking the v1 pool, the cross-op fact-family collisions where both members are in pool:

- `33 + 4 = 37` (pool #5) — inverse `37 − 4 = 33` (pool #18). **COLLISION.**
- `25 + 4 = 29` (pool #4) — inverse `29 − 4 = 25` and `29 − 25 = 4` (neither in pool; `29 − 4` would require `29` minuend not in pool).
- `21 + 3 = 24` (pool #10) — inverse `24 − 3 = 21` (not in pool — minuend 24 absent).
- `34 + 5 = 39` (pool #11) — inverse `39 − 5 = 34` (not in pool — minuend 39 absent).
- `42 + 3 = 45` (pool #12) — inverse `45 − 3 = 42` (not in pool — minuend 45 absent).
- `15 − 3 = 12` (pool #7) — inverse `12 + 3 = 15` (not in pool — operand 12 absent on `+` side).
- ... (continuing the audit)
- `25 − 3 = 22` (pool #17) — inverse `22 + 3 = 25` (not in pool — `22 + 3` not listed; `22 + 5` is).
- `37 − 4 = 33` (pool #18) — inverse `33 + 4 = 37` (pool #5). **COLLISION (same as above, different direction).**

**Audit: exactly ONE cross-op collision in the v1 single-digit pool:** `33 + 4` (#5) ↔ `37 − 4` (#18). Lint blocks this co-occurrence.

For §7.2 Option B (two-digit-plus-two-digit included), the audit must walk the additional `+` facts:
- `23 + 14 = 37` — inverse `37 − 14 = 23` and `37 − 23 = 14`. Neither in v1 `−` pool (no two-digit subtrahends).
- `42 + 31 = 73` — inverses out of pool (results above EASY/MEDIUM/HARD `−` band scope).
- Similar for the other 4 two-digit-plus-two-digit facts.

**Result:** Under §7.2 Option B, the cross-op collision count is STILL 1 (just `33+4 ↔ 37-4`). Lint asserts this audit at test time (`compositionLint.test.ts` enumeration test).

**Forward-compatibility.** This rule remains in force when future spec widens to mixed-op-fact-family interleaving (post-v1). The rule wording is operand-triple-centric, not pool-membership-centric.

### 5.6 Slow-fact threshold — `two-digit-addsub` uses op-aware defaults

`two-digit-addsub` is **NOT** slow-fact-active in v1 (`isSlowFactsActive` scope is `add-to-10` only). When activation lands, the threshold uses the op-aware accessor proposed for sub-to-20 §5.4:

```ts
// hypothetical extension once two-digit-addsub widens
if (focusNode === 'two-digit-addsub') {
  if (nodeSessionCount < 5) return null // suppress (warmup)
  if (op === '+') return 5000 // addition baseline
  if (op === '-') return 7000 // subtraction baseline, per sub-to-20 §5.4
}
```

**Out of scope for this spec.** Flagged in §6.7.

---

## 6. Wire-up checklist for Kevin / Devon — FOUR-WAVE SEQUENCING

This is the actionable list. Everything above is rationale + content; everything below is what changes in code.

> **PR sequencing (per Thomas 2026-05-21 — "schema first, canon second"):**
>
> - **Wave 1 (parallel, ship together):** (a) Kyle spec PR (this doc), (b) Kevin schema-extension PR — extends `MathSessionResult` with `perProblemDistractorClass` and the matching localStorage schema; widens `applyMasteryRule` signature to accept the new field for forward-compat (other focus nodes ignore it). NO directive change; NO canon change; NO render change. Pure schema scaffolding.
> - **Wave 2 (Kevin):** directive + lint + canon rebake. Consumes both Wave-1 PRs (the schema is in place to receive distractor-class data per session). LANDS AFTER Wave 1.
> - **Wave 3 (Devon, parallel to Wave 2):** render-side widening — parser regex + `NUMBER_WORDS` extension + `ANSWER_RANGE_MAX_TWO_DIGIT` constant + `chipMaxAnswerForCorrects` extension + `distractorClass` union widening (adds `'column-cross'` + `'phantom-borrow'`) + chip-class derivation + chip helpers (`columnCrossDistractor`, `phantomBorrowDistractor`). Devon's PR is independent of Kevin's Wave-2 PR (parser widening must land BEFORE Marian launches the tier on iPad, regardless of canon state) — but they can ship in parallel; the merge order is interchangeable as long as both land before Wave 4.
> - **Wave 4 (Jessica):** E2E spec covering the diagnostic-aware promotion gate + the Class 2 / Class 3 distractor render + the parser hyphenation coverage. Sign-off.
>
> Per `[[project_planner_parser_contract]]` — widen the browser parser BEFORE widening the planner. The contract is satisfied because Devon's Wave-3 PR ships parser widening; Kevin's Wave-2 directive expansion lands no earlier.

### 6.1 Wave 1b — Kevin's schema-extension PR (parallel to this spec)

**Files in play (per Thomas's "schema first" directive):**

- [ ] **`src/lib/progress/types.ts`** — extend `MathSessionResult` with `perProblemDistractorClass?: ReadonlyArray<DistractorClassTag | null>` (length 8; `null` for problems where no Class 2/3/B/wrong-op trap was offered — i.e. P1–P3 gentle ramp).
- [ ] **`src/lib/progress/types.ts`** — extend with `perProblemTappedValue?: ReadonlyArray<number | null>` (the chip value Marian actually tapped per problem; `null` if no tap recorded). Used by the diagnostic-rate computation.
- [ ] **`src/lib/progress/storage.ts`** — schema-version bump or read-path defaulter so existing localStorage blobs continue to load (per `[[project_canon_commit_strategy]]` schema-floor pattern). Existing sessions get `perProblemDistractorClass: undefined` / `perProblemTappedValue: undefined` and the gate falls back to accuracy-only.
- [ ] **`src/lib/progress/mastery.ts:applyMasteryRule`** — widen signature to accept the new optional fields; for `focusNode === 'two-digit-addsub'` apply the diagnostic-aware rule per §5.4 (when data is available); else fall through to the existing accuracy-only rule. Other focus nodes ignore the parameter.
- [ ] **`src/screens/Math/Math.tsx`** — extend session-result construction to populate `perProblemDistractorClass` AND `perProblemTappedValue`. (This requires the chip render to know which class it offered — Devon's Wave-3 ships the chip helpers; Kevin's Wave-1b ships the result-side wiring.)
- [ ] **`src/lib/progress/mastery.test.ts`** — fixtures covering: (a) two-digit-addsub session with accuracy ≥ 95% and Class-2-rejection ≥ 80% → promotion; (b) same accuracy but Class-2-rejection < 80% → no promotion; (c) two-digit-addsub session where `perProblemDistractorClass` is undefined (pre-schema data) → fallback to accuracy-only; (d) other focus nodes ignore the new field unchanged.
- [ ] **`e2e/_helpers/seedStorage.ts`** — add the new fields to the seed shape so e2e fixtures can craft diagnostic-rate scenarios.

### 6.2 Wave 3 — Devon's PR — render-side widening (parallel to Wave 2)

**Files in play:**

- [ ] **`src/screens/Math/planFromServer.ts`** — widen regex to `[a-z][a-z-]*` for both operands across all three templates (addition / subtraction-minus / subtraction-take-away). Extend `NUMBER_WORDS` to cover 21–99 (89 new entries OR programmatic decoder per §5.2). Recommend programmatic decoder for forward-compat.
- [ ] **`src/screens/Math/planFromServer.test.ts`** — fixtures exercising every decade name (twenty / thirty / ... / ninety) AND every-tens-and-units hyphenated combination (sample: 21, 35, 47, 58, 66, 73, 89, 99). Cover both `+` and `−` templates. Verify `op` discriminant correct.
- [ ] **`src/screens/Math/distractors.ts`** — add `ANSWER_RANGE_MAX_TWO_DIGIT = 99` constant per §5.1. Extend `chipMaxAnswerForCorrects` with the new tier ceiling.
- [ ] **`src/screens/Math/distractors.ts`** — widen `PickDistractorsOpts.distractorClass` union with `'column-cross'` AND `'phantom-borrow'` literals (per §3.7). Add `columnCrossDistractor(correct, a, b, op, maxAnswer)` helper computing the units-tens swap with downgrade-on-degenerate semantics. Add `phantomBorrowDistractor(correct, maxAnswer)` helper computing `correct − 10` with downgrade-on-OOR semantics.
- [ ] **`src/screens/Math/distractors.test.ts`** — add fixtures for `chipMaxAnswerForCorrects` covering `correct ∈ [12, 99]` mapping to the new ceiling; gentle-distractor + off-by-one + column-cross + phantom-borrow at the wider range; sanity-check no chip degeneration; verify downgrade chains for degenerate inputs (palindromic-units correct values, correct = 10 phantom-borrow).
- [ ] **`src/screens/Math/Math.tsx`** — extend the `distractorClass` derivation per §3.7. For `focusNode === 'two-digit-addsub'`: `op === '+'` problems P4–P8 use `'column-cross'`; `op === '-'` problems P4 use `'column-cross'`; `op === '-'` problems P5–P8 use `'phantom-borrow'` (with downgrade chain via `pickDistractors`).
- [ ] **`src/screens/Math/Math.tsx`** — wire chip-tap event to write the `distractorClass` offered for each problem into the session-result construction (consumes Wave-1b schema field `perProblemDistractorClass`). The chip helper returns the resolved class (after downgrade) so the session-result reflects the actually-rendered class, not the planner-default.
- [ ] **`src/screens/Math/Math.test.tsx`** — fixtures asserting: (a) two-digit-addsub `+` P5 receives Class 2 column-cross chip; (b) two-digit-addsub `−` P6 receives Class 3 phantom-borrow chip; (c) palindromic-units correct (hypothetical) silently downgrades to Class 2; (d) `correct = 12` `−` problem downgrades phantom-borrow trap to off-by-one (trap = 2 is in-range but lint-degeneracy check could surface it — Devon verifies).
- [ ] **CI gate** — vitest passes locally; e2e on Devon's branch.

### 6.3 Wave 2 — Kevin's PR — directive + lint + canon (consumes Wave 1)

**Files in play:**

- [ ] **`api/_planner.ts:1176`** — replace the current single-line directive with the structured pool directive in §4.1, including:
  - The NO REGROUPING SELF-CHECK blocks with worked examples (both `+` and `−` cases).
  - The OPERAND-RANGE SELF-CHECK block.
  - The 36-fact (or 30-fact per §7.2 Option A) FACT POOL annotated with `[BAND/op/category]`.
  - SESSION COMPOSITION RULES (1–14) per §4.1.
  - The ROUND-TEN-ANCHOR-CAP and category-cap self-checks (the round-ten-prior correction).
  - The HIGH-LEVERAGE COVERAGE RULE (≥1 near-boundary-no-cross in P5–P8).
  - The DUAL-EXPOSURE RULE (load-bearing, with the `33+4 ↔ 37-4` collision called out as the principal in-pool case).
  - The OP-MIX RULES (5+/3- default; 5+/3- or 6+/2- allowed).
  - PROSODY block (two-digit hyphenated number rendering, no verbal decomposition).
- [ ] **`scripts/compositionLint.ts`** — add `TWO_DIGIT_ADDSUB_POOL` and `TWO_DIGIT_ADDSUB_RULES` configs mirroring the `ADD_TO_TWENTY_RULES` + `SUB_TO_TWENTY_RULES` pattern. Rule set:
  1. Pool membership — every fact must be one of the 36 (or 30) ordered `(a, b, op)` triples in §1.1.
  2. Category caps: `round-ten-anchor ≤ 1`, `mid-decade-units-shift ≤ 4`, `near-boundary-no-cross ≤ 5`, `tens-doubles-echo ≤ 1`, `two-digit-plus-two-digit ≤ 2` (Option B only).
  3. Op-mix: `addCount ∈ [5, 6], subCount ∈ [2, 3], addCount + subCount === 8`. P1 op === '+'.
  4. Band-by-slot: P1–P3 EASY only; P4 MEDIUM only; P5–P8 MEDIUM or HARD; HARD FORBIDDEN at P1–P4.
  5. High-leverage coverage: ≥1 near-boundary-no-cross fact in P5–P8 (lint rule literal `'high-leverage-coverage'`, shared).
  6. No duplicate ordered `(a, b, op)` triples.
  7. Dual-exposure rule — load-bearing. Walk every problem; for each, compute the operand triple `(a, b, c)` where `c = result`; lint rejects any session where two problems share an operand triple regardless of op.
  8. No-regroup constraint at the lint layer (defense-in-depth — even if pool-membership somehow lets a regrouping fact through, the no-regroup check catches it).
- [ ] **`scripts/compositionLint.ts:resolveTierBinding`** — add a `two-digit-addsub` branch routing to `TWO_DIGIT_ADDSUB_RULES`.
- [ ] **`scripts/compositionLint.test.ts`** — fixtures exercising the new pool entries + composition rules. Include positive tests: a representative session that passes all rules (e.g. P1=`20+3` [EASY round-ten-anchor — cap=1, fills], P2=`28-5` [EASY mid-decade-shift], P3=`33+4` [EASY mid-decade-shift], P4=`21+3` [MEDIUM mid-decade-shift], P5=`23+6` [HARD near-boundary], P6=`48-7` [HARD near-boundary, Class B applies], P7=`66+3` [HARD tens-doubles-echo — cap=1, fills], P8=`25-3` [MEDIUM mid-decade-shift]). Verify op-mix 5+/3-; near-boundary in P5–P8 satisfied; round-ten-anchor cap satisfied; tens-doubles-echo cap satisfied; no duplicates; no cross-op inverses (audit: 33+4 → 37-4 not in this set; 23+6 → 29-6 not in pool; ok). Include negative tests:
  - `33+4` AND `37-4` in same session — dual-exposure rule violation.
  - `20+3, 30+5` both in same session — round-ten-anchor cap violation.
  - `27+6` — pool membership violation (carry required).
  - `32-5` — pool membership violation (borrow required).
  - All 8 problems `+` (op-mix violation).
  - 5 `−` problems (op-mix violation).
  - P1 = `15-3` (P1-is-+ violation).
- [ ] **`api/_planner.ts`** — verify the system-prompt JSON contract carries `op: '+' | '-'` in the emitted `MathProblem` shape for `two-digit-addsub` (already true; sanity-check).
- [ ] **`api/_planner.test.ts`** — add a focused test: stub Haiku, feed back a `two-digit-addsub` plan, assert: (a) every problem has `op: '+' | '-'`; (b) every problem has `(a, b, op)` in the 36-fact pool; (c) every problem satisfies the no-regroup constraint; (d) at least one near-boundary-no-cross fact appears in P5–P8; (e) op-mix in `[5+/3-, 6+/2-]`; (f) P1 op === '+'; (g) all category caps respected; (h) no duplicate triples; (i) no cross-op inverse collisions (the dual-exposure rule, asserted at the unit-test layer for completeness even though the pool is small enough to enumerate).
- [ ] **`public/canon/math/level-1/two-digit-addsub.json`** — re-bake per §6.3.

### 6.4 Canon prebake (Kevin's Wave-2 PR)

- [ ] **`scripts/generateSessionCanon.ts:activeCombos()`** — confirm `two-digit-addsub` is in `MATH_FOCUS_NODES` iteration set (it is; verified by existence of `public/canon/math/level-1/two-digit-addsub.json`).
- [ ] **`npm run canon:regen`** — incremental regen for `two-digit-addsub` only:
  ```
  rm public/canon/math/level-1/two-digit-addsub.json
  cp .env.local <worktree>/.env.local
  yarn install --frozen-lockfile
  npx tsx scripts/generateSessionCanon.ts --require-keys
  ```
  Per `planner-and-canon.md` § "Incremental-by-default trick". Bake produces ~25s of work and ~$0.005 of Haiku + Azure spend. Commit the JSON diff in the same PR.
- [ ] **Canon-lint gate** — `npm run canon:lint` must pass. Composition lint will exercise the new `TWO_DIGIT_ADDSUB_RULES`.
- [ ] **Post-bake spot-checks:**
  - **Round-ten-anchor cap:** count facts in the round-ten-anchor category `{20+3, 30+5, 40+2}`; assert ≤ 1.
  - **Op-mix:** count `+` reads and `−` reads in the canon; assert `+` count ∈ `[5, 6]` and `−` count ∈ `[2, 3]`.
  - **P1 op:** verify the first problem read uses "plus".
  - **Near-boundary-no-cross coverage:** verify ≥ 1 near-boundary-no-cross fact in P5–P8 by name match.
  - **Dual-exposure:** verify no session in the canon contains `33+4` AND `37-4` (the principal collision).

### 6.5 First-encounter gate — NOT REQUIRED for `two-digit-addsub`

Per §4.3: no entry to `FIRST_ENCOUNTER_GATED_NODES`. Sanity-check `_firstEncounterGate.test.ts` does NOT list `two-digit-addsub` as gated.

### 6.6 Mastery / focus-node picker — gate-extension only (per §5.4); no `MATH_TREE` change

Per the existing curriculum order: `... → sub-to-20 → two-digit-addsub → skip-counting → ...`. NO CHANGE to `MATH_TREE` in [`src/lib/progress/mastery.ts:106`](../../src/lib/progress/mastery.ts#L106) or `MATH_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts:51`](../../src/lib/progress/focusNode.ts#L51).

**§5.4 diagnostic-aware OUT gate IS a `mastery.ts` change** — Wave 1b (Kevin's schema-extension PR) widens `applyMasteryRule` per §6.1. The widening is signature-additive and other focus nodes ignore the new field; per `[[feedback_progression_e2e_mandatory]]` this DOES require a paired Jessica E2E spec at Wave-1b dispatch time. See §6.9.

- [ ] **`src/lib/progress/defaults.ts:104`** — the default for `'two-digit-addsub'` is already `'locked'`. NO CHANGE.
- [ ] **`e2e/_helpers/seedStorage.ts:56`** — the e2e fixture baseline is already `'locked'`. NO CHANGE.

### 6.7 Hub stage display — NO CHANGE expected; verify

- [ ] **`src/screens/Hub/stages.ts`** — verify `'two-digit'` stage entry exists (it does at line 19 + 49). NO CHANGE; sanity-check.
- [ ] **`src/screens/Hub/stageIcons.tsx STAGE_LABEL`** — verify a label entry exists for `'two-digit'`. (If absent, this is a missing-row in the sibling-tier checklist — flag in NOF.)
- [ ] **`src/screens/Hub/progressProjection.ts`** — verify Hub celebration captions know `'two-digit-addsub'`. If absent, add per the sibling-tier checklist §1.

### 6.8 Leitner / Slow-fact widening — DEFERRED FOLLOW-UP

- [ ] **(FOLLOW-UP PR)** Implement Leitner activation for `two-digit-addsub` once Marian has 5+ sessions of accuracy + latency data. Mirror the `add-to-10` precedent.
- [ ] **(FOLLOW-UP PR)** Slow-fact threshold for `two-digit-addsub` uses the op-aware accessor proposed for sub-to-20 §5.4. NOT in this PR.

### 6.9 Test coverage minimums

- [ ] **Unit (Kevin Wave 1b — schema):** new `applyMasteryRule` signature accepts and ignores extra fields for non-two-digit-addsub nodes; for two-digit-addsub, the diagnostic-aware rule per §5.4 applies; backwards-compat with `undefined` diagnostic data → falls back to accuracy-only.
- [ ] **Unit (Kevin Wave 2 — directive + lint + canon):** parser (every pool fact's read-line parses with correct `op`), planner stub (composition rules #1–14 from §4.1 enforced), composition lint (two-digit-addsub pool + category caps + band-by-slot + high-leverage coverage + dual-exposure load-bearing + op-mix + diagnostic-coverage rule §3.8).
- [ ] **Unit (Devon Wave 3 — render):** parser regex widening (every decade name + every hyphenated number 21–99); chip-range derivation (`correct ∈ [12, 99]` produces correct ceiling); chip-class derivation (`'+'` and `'-'` P4 → Class 2; `'-'` P5–P8 → Class 3 with downgrade chain); helper functions `columnCrossDistractor` + `phantomBorrowDistractor` (range coverage, degenerate-input downgrade).
- [ ] **E2E (Jessica Wave 4):** Per `[[feedback_progression_e2e_mandatory]]` — Wave 1b touches `mastery.ts` (the diagnostic-aware OUT gate). **E2E spec REQUIRED.** Jessica authors `e2e/two-digit-addsub-composition.spec.ts` covering: (a) seeded `two-digit-addsub` focus node renders 8 problems from the 36-fact pool; (b) all problems satisfy no-regroup + operand-range constraints; (c) op-mix in `[5+/3-, 6+/2-]`; (d) at least one near-boundary-no-cross fact appears in P5–P8; (e) P4–P8 `+` problems render with `distractorClass = 'column-cross'` (Class 2 trap chip visible); (f) P5–P8 `−` problems render with `distractorClass = 'phantom-borrow'` (Class 3 trap chip visible); (g) parser correctly handles every hyphenated number 21–99 from the canon; (h) diagnostic-aware promotion: seeded session with accuracy ≥ 95% AND Class-2-rejection ≥ 80% → promotion fires; seeded session with same accuracy but Class-2-rejection < 80% → promotion BLOCKED. **Failing-first per the memory.**
- [ ] **Self-test report on each PR** per `[[feedback_self_test_report]]`: AC walkthrough + side-effect inventory.

### 6.10 Docs

- [ ] **`.claude/docs/skill-trees-and-content.md`** — extend "Math distractors" with a `two-digit-addsub` row clarifying the three-class model (gentle + off-by-one + Class B) and the round-ten-prior correction. Add a "Math pools" row for the 36-fact pool.
- [ ] **`.claude/docs/planner-and-canon.md`** — update the "Haiku doubles prior" subsection with a sibling "Round-ten-anchor prior" finding from this spec. Cross-reference.
- [ ] **`.claude/docs/progress-and-persistence.md`** — under "Mastery rule", extend the existing footnote: "Promotion is accuracy-only for `sub-to-20 → two-digit-addsub` as well; do NOT introduce a 'mixed-op readiness' gate — mixed-op practice WITHIN this tier IS the treatment."
- [ ] **`.claude/docs/screens-and-flows.md`** — under the Math screen documentation, note that `two-digit-addsub` is the first tier to render mixed-op sessions; chip-derivation is op-aware via the existing `MathProblem.op` field.

---

## Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite + Devon's vitest suite.

- [ ] **AC1**: The 36-fact pool (§1.1) is faithfully encoded in `MATH_TRACK_GUIDE`'s `two-digit-addsub` block AND in `scripts/compositionLint.ts:TWO_DIGIT_ADDSUB_POOL` (vitest snapshot on the directive block; planner-test asserts pool membership; compositionLint drift-guard catches any mismatch). Under §7.2 Option A, pool is 30 facts.
- [ ] **AC2**: Every Haiku-generated `two-digit-addsub` plan composition rule from §4.1 holds: P1 op === '+', P1–P3 from `easy` band, P4 MEDIUM-only, ≥1 near-boundary-no-cross fact in P5–P8, round-ten-anchor count ≤ 1, mid-decade-units-shift count ≤ 4, near-boundary-no-cross count ≤ 5, tens-doubles-echo count ≤ 1, two-digit-plus-two-digit count ≤ 2 (Option B only), op-mix in `[5+/3-, 6+/2-]`, no duplicate `(a, b, op)` triples, NO operand-triple co-occurrence across `+` and `−` (dual-exposure rule load-bearing), EVERY problem satisfies no-regroup + operand-range + result-≥-12 + result-≤-99.
- [ ] **AC3**: Distractor rendering uses Class 0 (gentle) at P1–P3; Class 2 (column-cross) at P4–P8 for `+` problems and P4 for `−` problems; Class 3 (phantom-borrow) at P5–P8 for `−` problems. Class B (decade-anchor) and Class 1 (off-by-one) are fallbacks invoked silently when a primary class is degenerate. Lint asserts ≥ 2 Class 2 in-range traps across P4–P8 AND ≥ 1 Class 3 in-range trap across P5–P8 (the diagnostic-coverage rule §3.8).
- [ ] **AC4**: All two-digit number chip values render and play correctly. Emma says "Yes! Forty-one!", "Yes! Sixty-nine!", etc. naturally on the cheerful celebration prosody. No SSML overrides required for any chip value in `[1, 99]`.
- [ ] **AC5**: Read-line parser accepts two-digit-addsub read templates with hyphenated number words and tags problems with `op: '+' | '-'`; existing add-to-10, sub-to-10, add-to-20, sub-to-20 templates continue to parse correctly.
- [ ] **AC6**: Advancement gate — `sub-to-20 → two-digit-addsub` fires on accuracy threshold alone (math default `95/3`), NOT influenced by Leitner box state, slow-fact list length, or any "mixed-op readiness" signal. Verified via existing mastery tests; no new gate added.
- [ ] **AC7**: Dual-exposure rule — within any single 8-problem session, no operand triple appears in both `+` and `-` forms. Load-bearing in v1: the principal in-pool collision `33+4 ↔ 37-4` is enumerated in `compositionLint.test.ts`.
- [ ] **AC8**: Slow-fact and Leitner directives remain DISABLED for `two-digit-addsub` in v1 (`isSlowFactsActive` / `isLeitnerActive` predicates unchanged); future activation lands in a follow-up PR after Marian generates ≥5 sessions of data.
- [ ] **AC9**: Canon JSON `public/canon/math/level-1/two-digit-addsub.json` re-baked and committed. Canon-lint passes (ASCII-7, no slash-IPA, no angle tags, composition rules satisfied). File parses via `isSessionStartResponse`. **Round-ten-anchor count in the canon is ≤ 1** (the empirical proof the round-ten-prior correction landed; supersedes the current 3-round-ten canon). **Op-mix is in [5+/3-, 6+/2-]**.
- [ ] **AC10**: At least one near-boundary-no-cross fact appears in slots P5–P8 of the re-baked canon (the high-leverage coverage rule empirically satisfied).
- [ ] **AC11**: Parser regex accepts every hyphenated decade-units form 21–99 (`twenty-one`, `twenty-two`, ... `ninety-nine`). Devon's vitest sweep covers a sample of 8+ across the range; `chipMaxAnswerForCorrects` returns `ANSWER_RANGE_MAX_TWO_DIGIT = 99` for every `correct ∈ [21, 99]`.
- [ ] **AC12 (NEW — diagnostic-aware OUT gate per §5.4)**: `applyMasteryRule` for `focusNode === 'two-digit-addsub'` consumes `perProblemDistractorClass` + `perProblemTappedValue` and applies the diagnostic-aware rule: ≥ 95% accuracy AND ≥ 80% Class-2-rejection rate across 3 cross-day-deduped sessions → promotion fires. Insufficient diagnostic data falls back to accuracy-only (interim posture). Other focus nodes pass through unchanged. Jessica E2E enumerates the {pass, fail-on-diagnostic, fall-back-to-accuracy} cases.
- [ ] **AC13 (NEW — TTS prohibition per §4.1)**: The baked canon contains zero instances of digit-by-digit number rendering. Spot-check via `jq -r '.utterances[].text' ...` and asserting no read-line contains `"two three"` / `"one four"` / etc. digit-pair patterns where a hyphenated form is expected.
- [ ] **AC14 (NEW — no make-ten-bridge bleed per §4.1)**: Hint text uses "And N more. How many now?" or "Take away N. How many now?" framing only. No hint suggests decomposition through 10 (`"twenty-three plus two is twenty-five, then plus two more"`). Spot-check via canon `jq` query for hint slot text.

---

## 7. Open questions for Thomas

These are decision-stack items the spec cannot self-resolve. Orchestrator routes to Thomas.

### 7.1 Op-mix ratio — 5+/3- default, 6+/2- alternative, or wider band?

**The tension.** This is the first tier with mixed-op sessions. The default mix per §2.2 is 5+/3-. Alternatives:

- **Tighter `−` band:** 6+/2- only (single allowed mix). Pros: maximally `+`-confident, minimum `−` cognitive load. Cons: under-rehearses `−` at the new place-value surface; risks `−` retrieval atrophy.
- **Wider `−` band:** allow 4+/4- (balanced). Pros: faster `−` practice at place-value. Cons: pushes Marian harder on the more-effortful operation right when she's also learning the place-value-preservation concept; "two new things at once."
- **Spec default:** 5+/3- (default) OR 6+/2-. Lint allows both; Haiku biases by recent-score modulation.

**Recommendation.** Spec default 5+/3-, allow 6+/2- on low-score sessions (recent-score modulation pushes toward `+`-heavy when Marian is struggling). REJECT 4+/4- for v1.

### 7.2 Two-digit-plus-two-digit `+` facts — include in v1 or defer to v2?

**The tension.** Facts like `23 + 14 = 37` are conceptually advanced relative to `23 + 4 = 27` — they require the child to operate on BOTH digit positions. They are also the pedagogical bridge to cycle 5 (regrouping), since regrouping inherently involves two-digit operands on both sides.

**Pool with vs without two-digit-plus-two-digit:**
- Without (§7.2 Option A): 30-fact pool, 8/8 facts are single-digit-second-operand.
- With (§7.2 Option B, spec default): 36-fact pool, 6 facts (17%) are two-digit-plus-two-digit.

**Pedagogical argument FOR including.** Place-value preservation is the tier's conceptual job. Working it with single-digit-second-operands only is a partial exposure — the child only practices preserving the tens digit when ONE operand is short. Including some two-digit-plus-two-digit facts (no-carry constraint) exposes the child to the symmetric case where BOTH operands have tens digits and the operation preserves BOTH (since neither column crosses).

**Pedagogical argument AGAINST.** Cognitively heavier per fact; if the v1 pool struggles to settle, the additional difficulty extends the time-to-promote. Marian's "two new things at once" risk surfaces.

**Recommendation.** **Option B (INCLUDE 6 two-digit-plus-two-digit facts).** Cap at 2 per session (§2.3) so they remain a discriminate-tier accent, not the mainline. Lint enforces the cap.

### 7.3 Pool decade range — 10–60 (v1 default) or wider?

**The tension.** v1 pool spans decades 10–60 (no facts in 70s, 80s, 90s). Rationale: representational variety without memorisation surface; tier teaches a concept, not a decade-recognition drill.

**Alternative:** Widen v1 to cover 10–99. Adds ~24 more facts (4 per decade × 6 new decades), bringing total to 60+. Soak factor drops from 4.5× to ~7×.

**Recommendation.** **Option A (10–60).** Wider decade exposure is a v2 widening once Marian's data shows decade-name retrieval fluency. Higher decades add only representational variety, not new conceptual surface.

### 7.4 `−` only on single-digit subtrahend in v1, or also two-digit subtrahend?

**The tension.** v1 `−` facts are all `2-digit minuend − 1-digit subtrahend`. Two-digit-minuend-and-two-digit-subtrahend facts (e.g. `47 − 23 = 24`) are deferred. Dave's sub-to-20 research §1.3 explicitly frames borrow-prerequisite as the gate to two-digit subtraction.

**Pedagogical argument for including.** Symmetric with §7.2 — if `+` ships with two-digit-plus-two-digit, `−` should too.

**Pedagogical argument against.** Two-digit-minuend-and-two-digit-subtrahend `−` (no-borrow) is structurally harder than `+`: the child must verify no-borrow at BOTH the units and tens columns, and the result lands at a different decade than the minuend. The borrow-prerequisite framing per Dave makes this materially more advanced than the symmetric `+` case.

**Recommendation.** **REJECT for v1.** Defer two-digit subtrahend to cycle 5/6 alongside the regrouping tier. v1 `−` ships single-digit-subtrahend only.

### 7.5 First-encounter framing variant — inherit `sub-to-10`'s "take away" → "minus" gate?

**The tension.** Same shape as add-to-20 §7.5. By the time Marian reaches `two-digit-addsub` she has run sub-to-10 + sub-to-20 + add-to-10 + add-to-20 sessions and has internalised both `"plus"` and `"minus"` templates.

**Recommendation.** **No variant.** Same posture as add-to-20 §7.5 + sub-to-20 §7.2.

### 7.6 Dave-research dependencies — RESOLVED (Dave research landed 2026-05-21)

Dave's `design/research/two-digit-addsub-error-patterns.md` (PR opening in parallel with this spec) has resolved:

- **Place-value-preservation error patterns:** concatenated-single-digit-processing is the dominant error pattern. Phantom-borrow on `−` is documented. Carry-when-shouldn't on `+` is a sub-pattern of concatenated processing.
- **Round-ten-anchor prior:** SUPPORTED structurally (Haiku-prior correction logic carries from add-to-20); Dave did not weigh in directly on the cap value, but the structural pattern is sound. Cap at 1 retained.
- **Mixed-op session cognitive load:** Dave did not weigh in on the specific 5+/3- ratio. The ratio remains Kyle's design call; surface to Thomas as §7.1 above (already on the open-question list).
- **L1 Tagalog effect:** RESOLVED as mild PROTECTIVE factor (Dave NOF #2). No additional scaffolding required.

**Net effect on this spec:** §3 distractor classes restructured to include Class 2 (column-cross) + Class 3 (phantom-borrow) per Dave's research. §4.1 directive prohibits digit-by-digit TTS + make-ten-bridge bleed. §5.4 diagnostic-aware promotion gate added. §1.4 round-ten cap retained at 1.

**No further Dave research needed for v1 ship.** Re-open if empirical Marian data surfaces unanticipated error modes.

### 7.7 Pool-size sanity-check — 36 facts the right breadth?

The pool is larger than add-to-20's 22 and similar to sub-to-20's 22 + sub-to-10's 24. Two candidate alternatives:

- **30 facts** (§7.2 Option A — no two-digit-plus-two-digit). Soak factor 30/8 = 3.75×.
- **36 facts** (§7.2 Option B default). Soak factor 36/8 = 4.5×.
- **42 facts** (Option C — also include 6 round-ten-anchors across more decades). Soak factor 5.25×. Risk: dilutes the cap rationale and exposes more representational-only surface.

**Recommendation.** Lock at 36 tentatively (Option B). Re-audit at the 5-session-post-promotion mark (same trigger as add-to-20 §7.7).

### 7.8 Class-2-rejection threshold — 80% the right gate value for the OUT promotion?

**The decision.** §5.4 ships with Class-2-rejection-rate ≥ 80% as the diagnostic threshold for `two-digit-addsub → skip-counting` promotion. Alternatives:

- **66% (2-of-3-session running mean):** more lenient; reflects "Marian rejected Class 2 more often than not." Risk: under-detects concatenated processors; false-positive promotion rate higher.
- **80% (LOCKED default; 5-of-6-rejections-across-3-sessions):** Kyle's design call. Tight but not brittle; one bad chip-tap per 3-session window doesn't block promotion.
- **95% (5.7-of-6 — effectively unanimous):** brittle; one anxious-tap-day blocks promotion indefinitely.
- **No-threshold (accuracy-only):** the interim fallback per §5.4a; ships the false-positive risk knowingly.

**Recommendation.** Lock 80% for v1; calibrate from real Marian data once the schema-extension PR has shipped and a few cycles of data exist. The threshold can be tuned without a curriculum change — only `mastery.ts` constant edit + test re-fixture.

### 7.9 Pre-instruction signal for diagnostic-aware gate — should this tier ship a "review concatenated-vs-place-value" Hub introduction?

Dave's research §1.4 highlights that the concatenated-single-digit-processing error is most likely to surface in children who have NOT had explicit place-value instruction (or who have had it but not absorbed). Marian's diagnostic does not include place-value comprehension; we don't know whether she has the underlying concept.

**The candidate.** Hub introduction screen for `two-digit-addsub` first-session: Emma walks Marian through one explicit place-value worked example (`23 + 4`: "We have two-tens and three. Add four to the three. Two-tens and seven."), then a "Your turn" P1. Goal: prime the place-value frame BEFORE Class 2 diagnostic chips arrive at P4.

**Pedagogical argument FOR.** Avoids the false-positive by giving Marian the conceptual frame she needs to reject Class 2 traps in the first place.

**Pedagogical argument AGAINST.** Adds a first-encounter screen to a tier where Marian already faces multiple novelties (mixed-op + two-digit operands + new TTS forms). The Class 2 distractor diagnostic IS designed to surface the gap empirically; pre-instruction risks **training her to recognise the trap** rather than diagnosing whether she understands place value.

**Recommendation.** **NO pre-instruction.** The Class 2 diagnostic is the empirical-discovery instrument; pre-instruction would short-circuit the diagnostic AND add scaffolding cost. If empirical data shows Marian failing the diagnostic at high rates, RE-OPEN this question with a place-value Hub introduction as the response — but only as a diagnostic-aware iteration, not as v1 default.

---

## 8. Tracked follow-ups (post-merge)

**Wave 1a — this spec PR (Kyle):** spec doc only. Lands in parallel with Wave 1b.

**Wave 1b — Kevin's schema-extension PR (dispatched 2026-05-21):**

- `src/lib/progress/types.ts` — `MathSessionResult.perProblemDistractorClass` + `perProblemTappedValue` fields.
- `src/lib/progress/storage.ts` — schema-floor defaulter / read-path migration.
- `src/lib/progress/mastery.ts:applyMasteryRule` — signature widening + diagnostic-aware rule for `focusNode === 'two-digit-addsub'`; other nodes pass through unchanged.
- `src/lib/progress/mastery.test.ts` — diagnostic-aware promotion fixtures.
- `e2e/_helpers/seedStorage.ts` — extend seed-shape with the new fields.
- `src/screens/Math/Math.tsx` — session-result construction populates the new fields (consumes Devon Wave 3 chip-helper return values).

**Wave 2 — Kevin's PR — directive + lint + canon:**

- `api/_planner.ts:1176` — `MATH_TRACK_GUIDE` `two-digit-addsub` block expanded to 36-fact (or 30) pool with annotations + ROUND-TEN-ANCHOR-CAP / category caps / NEAR-BOUNDARY-NO-CROSS HIGH-LEVERAGE COVERAGE + DIAGNOSTIC-COVERAGE / DUAL-EXPOSURE RULE LOAD-BEARING / PROSODY-PROHIBITION (no digit-by-digit) / STRATEGY-PROHIBITION (no make-ten-bridge bleed) self-checks.
- `scripts/compositionLint.ts` — new `TWO_DIGIT_ADDSUB_POOL` + `TWO_DIGIT_ADDSUB_RULES`; new branch in `resolveTierBinding`; new lint check that the chosen pool-fact set admits ≥ 2 Class 2 in-range traps and ≥ 1 Class 3 in-range trap across P4–P8 (the diagnostic-coverage rule §3.8).
- `scripts/compositionLint.test.ts` — fixtures for the new pool entries + rules; principal `33+4 ↔ 37-4` dual-exposure collision enumeration; diagnostic-coverage positive + negative tests.
- `public/canon/math/level-1/two-digit-addsub.json` — re-baked canon supersedes the current round-ten-saturated bake.
- `api/_planner.test.ts` — two-digit-addsub plan composition tests.

**Wave 3 — Devon's PR — render-side widening:**

- `src/screens/Math/planFromServer.ts` — regex widening + `NUMBER_WORDS` extension (or programmatic decoder).
- `src/screens/Math/planFromServer.test.ts` — hyphenated-number-word sweep fixtures.
- `src/screens/Math/distractors.ts` — `ANSWER_RANGE_MAX_TWO_DIGIT = 99` constant + `chipMaxAnswerForCorrects` extension; `distractorClass` union widening (adds `'column-cross'` + `'phantom-borrow'`); `columnCrossDistractor` + `phantomBorrowDistractor` helpers.
- `src/screens/Math/distractors.test.ts` — chip-range pin tests for `correct ∈ [12, 99]`; Class 2 + Class 3 helper tests with downgrade chain coverage.
- `src/screens/Math/Math.tsx` — `distractorClass` derivation extension per §3.7.
- `src/screens/Math/Math.test.tsx` — Class 2 + Class 3 distractor pin tests.

**Wave 4 — Jessica E2E PR:**

- `e2e/two-digit-addsub-composition.spec.ts` — pool membership + no-regroup + op-mix + Class 2/3 chip render + diagnostic-aware promotion (3 cases: pass, fail-on-diagnostic, fallback-on-undefined-diagnostic).
- `e2e/two-digit-addsub-parser.spec.ts` — failing-first hyphenated-number parser sweep (paired with Devon Wave 3).

**Test changes (summary):**

- `_planner.test.ts` two-digit-addsub plan composition tests (Wave 2).
- `compositionLint.test.ts` fixtures (Wave 2).
- `planFromServer.test.ts` parser fixtures (Wave 3).
- `distractors.test.ts` chip-range + Class 2/3 pin tests (Wave 3).
- `mastery.test.ts` diagnostic-aware promotion fixtures (Wave 1b).
- `e2e/two-digit-addsub-composition.spec.ts` (Wave 4).
- `e2e/two-digit-addsub-parser.spec.ts` (Wave 4).

**Doc changes:**

- `.claude/docs/skill-trees-and-content.md` — `two-digit-addsub` row in "Math distractors" + "Math pools" subsections; Class 2 + Class 3 added to the distractor taxonomy.
- `.claude/docs/planner-and-canon.md` — "Round-ten-anchor prior" sibling finding noted; "Concatenated-single-digit-processing diagnostic" pattern noted (the structural-false-positive correction lever).
- `.claude/docs/progress-and-persistence.md` — promotion-gate footnote extended for `sub-to-20 → two-digit-addsub`; diagnostic-aware gate for `two-digit-addsub → skip-counting` documented; `MathSessionResult` field extension noted.
- `.claude/docs/screens-and-flows.md` — Math screen mixed-op note + chip-range widening note + Class 2 + Class 3 chip-derivation note.
- `.claude/docs/sibling-tier-checklist.md` — verify the 15+ widening-points are still complete for `two-digit-addsub` (the node already exists across the checklist surface; sanity-check `DEFAULT_SKILL_LEVELS` etc. across all 16 rows).
- `.claude/docs/testing-and-ci.md` — diagnostic-aware E2E pattern (the schema-extension consumption shape) added.

**Out of this spec's scope (follow-up):**

- `src/lib/progress/slowFacts.ts` + `_planner.ts:isSlowFactsActive` — op-aware threshold accessor; widen scope to include `two-digit-addsub` once Marian generates ≥5 sessions of data.
- Leitner box activation for `two-digit-addsub` — same trigger as slow-fact activation.
- v2 pool widening: higher decades (70–99) per §7.3.
- v2 pool widening: two-digit subtrahend `−` facts per §7.4 — coordinated with the cycle 5 regrouping tier.
- Cycle 5 spec: `two-digit-addsub-regroup` (carry on `+`, borrow on `−`). Out of this tier's scope; tracks as the next math-spec authoring cycle.
- Class-2-rejection threshold calibration — once 3–5 cycles of real Marian data exist post-schema-extension, re-audit the 80% threshold per §7.8.
- Pre-instruction place-value Hub screen per §7.9 — only re-open if empirical diagnostic-aware data shows Marian failing the Class 2 rejection threshold at high rates.

---

## 9. Cross-references

- **Dave's two-digit-addsub research (PRIMARY for this tier)** — `design/research/two-digit-addsub-error-patterns.md` (Dave, 2026-05-21, PR opening alongside this spec) — concatenated-single-digit-processing as the dominant error pattern; structural false-positive on no-regroup tiers; Class 2 column-cross as diagnostic instrument; Class 3 phantom-borrow on `−`; Tagalog L1 as mild protective factor; digit-by-digit TTS prohibition; no make-ten-bridge bleed.
- **Dave's add-to-20 research** — `design/research/add-to-20-cross-10-bridge-errors-marian.md` (cross-10-bridge taxonomy; wrong-by-5 finger-boundary; doubles-prior calibration; commutative-pair distinct-facts).
- **Dave's sub-to-20 research** — `design/research/sub-to-20-pedagogical-sequence.md` (especially §1.3 successor framing — borrow-prerequisite gate to two-digit; L2 Tagalog teen-number transparency note).
- **Dave's add-to-10 research** — `design/research/add-to-10-counting-to-recall.md` (finger-counting profile, doubles + sums-to-10 anchors).
- **Dave's distractor research** — `design/research/math-distractor-and-streak-decisions.md` (gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Sibling content spec (immediate predecessor)** — `design/math/add-to-20-content.md` (Kyle, 2026-05-17, PR #276) — structural template + doubles-prior correction pattern + 22-fact-pool + high-leverage coverage rule.
- **Sibling content spec (parallel `−` tier)** — `design/math/sub-to-20-content.md` (Kyle, 2026-05-17, PR #269) — Class B (decade-anchor) distractor; op-aware slow-fact threshold proposal; dual-exposure rule scaffold.
- **Earlier content specs** — `add-to-10-content.md`, `sub-to-10-content.md`, `subitising-scaffold-content.md` (the curriculum baseline this tier builds atop).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md` (Haiku prior corrections; canon prebake; Leitner box scoping; slow-fact directive scope).
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md` (mastery rule `95/3`; promotion-gate footnote pattern).
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md` (math node ladder; distractor classes per tier).
- **Sibling-tier checklist** — `.claude/docs/sibling-tier-checklist.md` (15+ widening-points for any sibling-tier add; `two-digit-addsub` already exists in the union — this tier is content-shipping for an infrastructure-present node).
- **Memory: distractor-class pedagogical-gates-mechanical** — `feedback_distractor_class_pedagogical_gates_mechanical` (the lens applied to §3 — pedagogical fit gates mechanical fit; Class B retained from sub-to-20 because the place-value-drop error is documented; Class 2 rejected because the operator-confusion risk has dropped by this tier).
- **Memory: Haiku directive sharpening** — `feedback_haiku_directive_sharpening` (validated patterns for inline-band-tagging + per-rule self-checks + negative anchors; applied throughout §4.1; round-ten-anchor cap follows the doubles-cap structural pattern from add-to-20 §1.4).
- **Memory: planner-parser contract** — `feedback_subagent_doc_edits_visibility` + `project_planner_parser_contract` (widen browser parser BEFORE widening planner; this spec's PR-split order obeys the contract — Devon's PR lands first).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (no progression-state-machine files touched here; Jessica E2E is optional per §6.8).
- **Memory: clickup forward-only default** — `feedback_clickup_forward_only_default` (ticket filing routed via orchestrator).
