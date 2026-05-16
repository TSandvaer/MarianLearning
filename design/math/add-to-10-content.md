# Number Garden — `add-to-10` content tier (44-fact factory pool, no wrong-op distractor)

**Status:** RATIFYING — this spec fills the doc gap flagged by Kevin's NOF #1 on PR #248. Kevin's composition-lint (PR #248) authored the pool + rules from scratch by synthesising the one-line directive, Marian's April diagnostic, and the post-PR-245 current canon. This spec formalises Kevin's lint configuration as the design-side authority and adds the open-question call on the wrong-operation distractor (DECIDED: no Class 2 for `add-to-10`). **AMENDED 2026-05-16** (this PR) to land the `tkt-add-to-10-pool-extension-audit` follow-up from §9.4 — verdict HOLD on the 44-fact pool, all four audit dimensions evaluated and re-confirmed in new §1.6. Spec-only, no implementation impact. See §13 post-ship correction block.

**Ticket:** TBD — Matt to file the ratification + the follow-up directive-sharpening ticket described in §4.

**Authority chain.** The pool and rule shape originate in [`scripts/compositionLint.ts`](../../scripts/compositionLint.ts) (`ADD_TO_TEN_POOL` factory + `ADD_TO_TEN_RULES`) as introduced in Kevin's PR #248. The pedagogical evidence supporting the composition choices is in [`design/research/add-to-10-counting-to-recall.md`](../research/add-to-10-counting-to-recall.md) (Dave, 2026-04-29 — Marian's finger-counting profile; doubles + sums-to-10 anchors; subitising support) and [`design/research/math-distractor-and-streak-decisions.md`](../research/math-distractor-and-streak-decisions.md) (Dave, 2026-04-25 — gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).

**Structural template.** [`design/math/sub-to-10-content.md`](./sub-to-10-content.md) (Kyle, 2026-05-15). Section-for-section parallel; deviations are called out inline.

---

## 0. Why this spec, why now

- Marian is **actively in this tier** today. April 2026 diagnostic: "Sums to 10, drive automaticity (100% finger reliance)". `add-to-10` is the first-class math tier driving every math session until accuracy holds for promotion to `add-to-20`.
- Despite being the live math tier, `add-to-10` had **no design-side content spec** until this document. The planner directive at [`api/_planner.ts:921`](../../api/_planner.ts#L921) is one prose line; the canon at [`public/canon/math/level-1/add-to-10.json`](../../public/canon/math/level-1/add-to-10.json) was last baked under the original Phase-1 directive with no structured pool. Kevin's PR #248 composition-lint synthesised a 44-fact pool + 5 category caps + band-by-slot rules by inference; that synthesis becomes load-bearing if any future Haiku rebake produces a non-clean composition.
- This spec **ratifies Kevin's PR #248 lint configuration** as the design-side contract and answers the open question on the Class 2 wrong-operation distractor (locked: no Class 2 for `add-to-10` — see §3.2).
- **Net code-change implication for this spec: ZERO in the implementation layer.** The lint already exists; the canon already passes; the directive prose at `_planner.ts:921` is owned by Kevin per the dispatch brief. The follow-up that this spec FLAGS (directive-prose sharpening to mirror sub-to-10's `[BAND/category]` inline tags) is a Kevin task, not part of this PR.

**Scope of this spec:**

- The 44-fact factory-built pool (§1) with band + category taxonomy and per-category teaching rationale.
- The problem-mix rules for an 8-problem session drawn from the pool (§2). Caps + band-by-slot + sums-to-10 coverage. Matches Kevin's lint constants.
- The decision NOT to introduce a Class 2 wrong-operation distractor for `add-to-10` (§3.2) — with rationale.
- The read-line template + per-slot utterance templates (§4) — the existing addition templates, no first-encounter variant.
- Schema posture confirming `MathFact { a, b, op: '+' }` reuse (§5).
- The advancement gate `add-to-10 → add-to-20` (§6) — accuracy-only, identical posture to the `add-to-20 → sub-to-10` gate ratified in `sub-to-10-content.md` §6.
- Cross-references and follow-up tickets (§9, §13).

**Out-of-scope:**

- **The Class 2 wrong-operation distractor.** Rejected for this tier — see §3.2 rationale. Class 2 lives only in `sub-to-10` and later subtraction tiers.
- **Directive-prose sharpening.** The planner directive at `_planner.ts:921` is presently a one-line description; Kevin's NOF #2 on PR #248 explicitly flags directive-prose sharpening (inline `[BAND/category]` tags per sub-to-10's structured block) as a future Kevin task if Haiku ever emits a problematic add-to-10 canon. This spec describes the contract; Kevin owns the directive prose.
- **First-encounter framing variant.** `add-to-10` was the original math tier; Marian has run dozens of sessions on it already. Adding a "first-session" copy variant retroactively is not pedagogically useful. (Contrast: `sub-to-10` got a "take away" → "minus" gate because subtraction is conceptually new.)
- **Leitner box wiring.** `add-to-10` is the ONLY tier where the slow-fact directive AND the Leitner box are active today (see `planner-and-canon.md` § "Track-based payload" + § "Leitner box"). The interaction between Leitner box selection and these pool/cap rules is already coded in [`api/_planner.ts:buildUserMessage`](../../api/_planner.ts) — out of scope for this spec to re-derive. **This spec asserts that the pool + caps remain authoritative under Leitner activation: Leitner influences WHICH facts get prioritised within the pool, but does NOT permit pool-membership violations or cap violations.**
- **Slow-fact directive parameters.** The 5000 ms global threshold in [`src/lib/progress/slowFacts.ts`](../../src/lib/progress/slowFacts.ts) is correct for `op === '+'` per Dave's research; no spec change needed. (Contrast: `sub-to-10-content.md` §8 requested an op-parameterized threshold for `op === '-'`.)
- **Subitising / dot-pattern visual scaffold.** Dave's `add-to-10-counting-to-recall.md` Priority 2 floated this as a separate Kyle spec; it's an independent design ticket and does not block this content spec.
- **`Math.tsx` UI work.** No changes — the screen renders `add-to-10` problems through the existing chip-tap pipeline; no new states, no new primitives, no glyph changes.

---

## 1. The 44-fact pool — factory-built, banded, categorised

The pool is the mathematical closure of `{ (a, b) | a ≥ 1, b ≥ 1, 3 ≤ a + b ≤ 10 }`. Commutative pairs are **distinct facts** (e.g. `2 + 3` and `3 + 2` are two pool entries) because the read-lines speak differently and the chip-tap selection is order-sensitive at the audio layer. The 44 entries cover the full surface; the per-session mix rules (§2) drive composition.

> **Authority:** [`scripts/compositionLint.ts:buildAddToTenPool()`](../../scripts/compositionLint.ts) (Kevin, PR #248). This spec uses Kevin's factory output verbatim as `ADD_TO_TEN_POOL`. No facts added, none removed.

### 1.1 Pool by band

The band is determined by `sum = a + b`:

- **EASY** — `sum ∈ {3, 4, 5}` (9 facts)
- **MEDIUM** — `sum ∈ {6, 7, 8}` (18 facts)
- **HARD** — `sum ∈ {9, 10}` (17 facts)

### 1.2 Pool by category (mutually exclusive, priority-ordered)

Each fact maps to exactly ONE category. Priority order (the first match wins):

1. `sums-to-10` — `a + b == 10` (9 facts; includes `5 + 5`, `1 + 9`, `9 + 1`, etc.)
2. `doubles` — `a == b` AND `sum < 10` (3 facts: `2 + 2`, `3 + 3`, `4 + 4`)
3. `plus-one` — `min(a, b) == 1` AND `a != b` AND `sum < 10` (14 facts: every `1 + k` and `k + 1` with `2 ≤ k ≤ 8`)
4. `near-doubles` — `|a − b| == 1` AND `min(a, b) ≥ 2` AND `sum < 10` (6 facts: `2 + 3`, `3 + 2`, `3 + 4`, `4 + 3`, `4 + 5`, `5 + 4`)
5. `general` — everything else (12 facts)

Categorial distribution:

| Category       | Pool count | Pedagogical role                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sums-to-10`   | 9          | **Highest-leverage.** Marian's April diagnostic flags sums-to-10 automaticity as the top priority. The make-10 anchor is the bridge to `add-to-20`'s cross-10-bridge facts. Includes `5 + 5` (Dave's "single most important" double per `add-to-10-counting-to-recall.md`) and the complementary pairs `1+9, 2+8, 3+7, 4+6, 6+4, 7+3, 8+2, 9+1`. |
| `doubles`      | 3          | Distinctive memory trace (identical-addends pattern). Dave's "doubles anchor in planner" backlog item; `2+2`, `3+3`, `4+4`. (`5+5` lives in `sums-to-10` per priority rule.)                                                                                                                                                                     |
| `plus-one`     | 14         | Count-on-one scaffold. Easiest non-rule retrieval path. Many facts because the category is structurally large.                                                                                                                                                                                                                                   |
| `near-doubles` | 6          | Doubles-plus-one derivation (`4+5 = 4+4+1`). High-leverage once `doubles` is reliable.                                                                                                                                                                                                                                                           |
| `general`      | 12         | Everything else. Bridge-through-5 and cross-pair facts. Where retrieval gains appear last; the category Marian will most need direct fact-recall for.                                                                                                                                                                                            |

### 1.3 Pool table — band × category

The 44 facts laid out by band and category. Commutative pairs listed both ways (each row is one pool entry).

| Band   | sum | Facts                                                         | Categories                               |
| ------ | --- | ------------------------------------------------------------- | ---------------------------------------- |
| EASY   | 3   | `1+2`, `2+1`                                                  | plus-one ×2                              |
| EASY   | 4   | `1+3`, `3+1`, `2+2`                                           | plus-one ×2, doubles ×1                  |
| EASY   | 5   | `1+4`, `4+1`, `2+3`, `3+2`                                    | plus-one ×2, near-doubles ×2             |
| MEDIUM | 6   | `1+5`, `5+1`, `2+4`, `4+2`, `3+3`                             | plus-one ×2, general ×2, doubles ×1      |
| MEDIUM | 7   | `1+6`, `6+1`, `2+5`, `5+2`, `3+4`, `4+3`                      | plus-one ×2, general ×2, near-doubles ×2 |
| MEDIUM | 8   | `1+7`, `7+1`, `2+6`, `6+2`, `3+5`, `5+3`, `4+4`               | plus-one ×2, general ×4, doubles ×1      |
| HARD   | 9   | `1+8`, `8+1`, `2+7`, `7+2`, `3+6`, `6+3`, `4+5`, `5+4`        | plus-one ×2, general ×4, near-doubles ×2 |
| HARD   | 10  | `1+9`, `9+1`, `2+8`, `8+2`, `3+7`, `7+3`, `4+6`, `6+4`, `5+5` | sums-to-10 ×9 (all)                      |

**Cross-checks:**

- Total: 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 = 44 ✓
- Category counts: sums-to-10 = 9, doubles = 3, plus-one = 14, near-doubles = 6, general = 12; total 44 ✓
- Band counts: EASY = 9, MEDIUM = 18, HARD = 17; total 44 ✓
- Answer range: `[3, 10]`. No `correct = 0` (would need `a = b = 0`, excluded by `a ≥ 1`). No `correct < 3` (sum lower bound). Subject to the existing `ANSWER_RANGE_MIN = 1` default in [`distractors.ts:70`](../../src/screens/Math/distractors.ts#L70) — no widening needed.

### 1.4 Why 44 and not more

The closure rule (`a ≥ 1, b ≥ 1, 3 ≤ a + b ≤ 10`) excludes:

- Facts with `0` as an addend (`0 + 3 = 3`, `5 + 0 = 5`). Pedagogically `n + 0 = n` is trivial; offers no automaticity gain. Adding "plus-zero" facts would dilute the discriminate-tier mix without learning value.
- `1 + 1 = 2`, `6 + 6 = 12`, `7 + 7 = 14`, etc. Sums below 3 are sub-trivial (count one finger); sums above 10 belong to `add-to-20`.

The 44 facts cover every meaningful (a, b) pair on the sums-to-10 surface. The factory definition is correct-by-construction; Kevin's pool-sanity tests pin count, uniqueness, band counts, and category counts (`scripts/compositionLint.test.ts`).

### 1.5 Pool-extension policy

`add-to-10` is mature — no pool extension planned. The follow-up directive-sharpening ticket (§4 + §9.2) embeds the same 44 facts into the directive prose for Haiku discipline; it does not widen the pool.

### 1.6 Pool-extension audit (2026-05-16)

> **Audit verdict: HOLD.** The 44-fact pool is the right breadth for the tier. No facts to add, none to remove. Ticket `tkt-add-to-10-pool-extension-audit` (§9.4) closes as RESOLVED.

The audit was dispatched out of PR #251 (sub-to-10 22-fact pool widening) §9.4 follow-up — that PR's pool-widening discipline raised the question whether `add-to-10`'s 44-fact pool needed parallel reconsideration. It does not. This section captures the audit's four dimensions and their rationale so a future audit does not re-litigate ground already covered.

#### 1.6.1 Pool breadth — WIDEN candidates considered + REJECTED

| Candidate                                                                                              | Pro                                                                  | Con                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Verdict   |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **Add zero-addend facts** (`0+3`, `0+4` … `0+10`, plus the commutative `3+0` … `10+0`; 18 facts total) | Parallels `sub-to-10`'s `subtract-zero` category (`7-0=7`, `9-0=9`). | (a) **Pedagogical asymmetry.** Subtraction-by-zero is a documented confusable for 7-9 year olds ("if you take nothing, you still have what you started with" requires explicit reasoning). Addition-by-zero (`n + 0 = n`) is not in the same league — Marian internalised the identity rule for addition years ago. Including `subtract-zero` in `sub-to-10` is justified by error-pattern evidence; including `plus-zero` in `add-to-10` has no parallel evidentiary base. (b) **Trivial vs automaticity-targeting.** §1.4 already excluded these for the same reason: "pedagogically `n + 0 = n` is trivial; offers no automaticity gain." The tier's purpose is to drill retrieval pathways for facts Marian currently counts; she does not count `5 + 0`. (c) **Pool dilution.** 18 trivial facts in a 44-fact pool would dilute the discriminate-tier mix without learning value, and would consume `general`-cap slots that should go to retrieval-targeted facts. | ❌ REJECT |
| **Drop `1+N` / `N+1` plus-one facts at HARD sums** (i.e., drop `1+8` and `8+1`; 2 facts)               | Trivial count-on-one; could free pool surface.                       | (a) **No pool-slot pressure.** The plus-one cap is already 2; dropping 2 facts saves nothing structurally. (b) **Gentle-discriminate utility.** Under recent-score modulation (§2.3), low-score sessions need a low-cost HARD-band option. `1+8` and `8+1` are HARD by sum but EASY by retrieval — a confidence-preservation fallback. (c) **Trap-eligible for discrimination.** Even trivial facts contribute to the discriminate-tier mix when paired with Class 1 off-by-one distractors (`{7, 8, 9}` chips for `correct=8`).                                                                                                                                                                                                                                                                                                                                                                                                                                         | ❌ REJECT |
| **Split `5+5` from `sums-to-10` into its own category** (1 fact)                                       | Protects the sole doubles-AND-sum-to-10 fact from the doubles cap.   | (a) **`5+5` is already structurally protected.** Per §1.2 priority order, `5+5` lives in `sums-to-10` (priority 1) NOT in `doubles` (priority 2). The doubles cap does not touch it. (b) **One-fact categories are anti-patterns.** A single-fact bucket means the planner constraint reduces to "must include 5+5" — which is what §2.4's sums-to-10 coverage rule already achieves probabilistically (9 sums-to-10 facts, 5+5 has 1/9 base-rate appearance per slot, multiplied across many sessions). (c) **No category-cap collision.** No active rule today forces a choice between `5+5` and another sums-to-10 fact within the cap; the cap of 2 accommodates `5+5` PLUS one complementary pair.                                                                                                                                                                                                                                                                  | ❌ REJECT |

#### 1.6.2 Pool breadth — NARROW candidates considered + REJECTED

| Candidate                                                                                                                                                              | Pro                                                                                              | Con                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verdict   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **Drop `general` category at HARD** (12 facts → 8 facts: keep only `2+7`, `7+2`, `3+6`, `6+3`; drop the MEDIUM-band generals `2+4, 4+2, 2+5, 5+2, 2+6, 6+2, 3+5, 5+3`) | Narrowing dilutes only the lowest-leverage category (no obvious shortcut, count-back or derive). | (a) **`general` IS the retrieval-pathway category.** Per §1.2's pedagogical role table: "Where retrieval gains appear last; the category Marian will most need direct fact-recall for." Narrowing this is exactly backwards — these are the facts most worth drilling. (b) **MEDIUM-band coverage gap.** Dropping 8 of 18 MEDIUM-band facts would skew MEDIUM toward plus-one and near-doubles (the "easy" categories), starving the band of discriminate pressure. (c) **No measured Marian-side pressure.** Marian's diagnostic does not flag confusion or overload on any specific MEDIUM-band general. Removing facts based on category bias without error-pattern evidence inverts the spec's "drill retrieval, not concept" posture. | ❌ REJECT |
| **Reduce `near-doubles` from 6 to 2** (drop `3+4, 4+3, 4+5, 5+4`; keep only `2+3, 3+2`)                                                                                | Cognitive load reduction; doubles-plus-one derivation can be inferred from doubles alone.        | (a) **Near-doubles cap is 3 specifically because the category is the highest-value automaticity bridge** (§2.2 + Dave's `add-to-10-counting-to-recall.md` Intervention D rationale: "doubles plus-one bridge is the second-most-important strategy after sums-to-10"). Cutting near-doubles facts removes the practice substrate for that strategy. (b) **Pool-extension cost is asymmetric** — dropping facts is destructive; adding facts is reversible. Lacking evidence Marian is overloaded by near-doubles (her diagnostic is the opposite: "100% finger reliance" — she NEEDS more retrieval surface, not less), do nothing.                                                                                                        | ❌ REJECT |

#### 1.6.3 Distractor-class — ADD candidates considered + REJECTED

The dispatch brief flagged "answer-equals-operand" as a possible Class 3 distractor (e.g., for `4 + 1 = 5`, distractor = 4 or 1 — the answer collides with an operand).

| Class                                                                                                             | Mechanic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Verdict                |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Class 0** (gentle, ≥2-away, P1-P3)                                                                              | Existing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ✅ KEEP                |
| **Class 1** (off-by-one, P4-P8)                                                                                   | Existing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ✅ KEEP                |
| **Class 2** (wrong-op, `a − b`)                                                                                   | Already rejected in §3.2 (pedagogical asymmetry; addition-direction confusion is not a documented error pattern).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ❌ REJECTED — see §3.2 |
| **Class 3 — answer-equals-operand** (e.g. for `4 + 1 = 5`, distractor = 4 or 1; for `5 + 5 = 10`, distractor = 5) | Conceptually targets the error pattern "child outputs the operand instead of the sum" — but this error pattern is documented for _kindergarteners learning to count_, NOT for 8-year-olds who count accurately. Marian's diagnostic says "100% conceptually correct after self-correction"; she does not confuse `5+5` with `5`. Also: for many pool facts the candidate distractor is ALREADY-close to Class 1 off-by-one (for `4+1=5`, operand `4` IS the Class 1 `correct-1` distractor). Adding a new class layered on top would (a) double-count the same chip pattern in many cases; (b) target a non-error; (c) require a Class 3 branch in `pickDistractors` + tagging in `Math.tsx` + drift-guard test coverage — the same implementation cost as Class 2 with the same near-zero pedagogical payoff. | ❌ REJECT              |

#### 1.6.4 Cap saturation — re-confirmed clean

Re-running the §2.5 audit against the 2026-05-16 promotion calendar:

- Pool=44, problems-per-session=8, caps sum to `2 + 2 + 3 + 2 + 2 = 11` permits. Caps allow flexibility without over-constraint.
- Coverage rule: `sums-to-10 ≥ 1` in P4-P8 is satisfiable from 9 pool facts (any session has on average ~1.6 sums-to-10 candidates available given band-by-slot — comfortable headroom).
- Per-session distinct-fact ceiling = 8; pool size = 44 → ~5.5× soak factor — Haiku can compose dozens of distinct sessions before repetition pressure forces narrowing.
- The `doubles ≤ 2` constraint specifically: with only 3 doubles facts (`2+2, 3+3, 4+4`) and a cap of 2, ALL three doubles never appear in a single session. This is correct: cross-session variety (per Leitner-driven prioritisation, §2.7) repeats doubles MORE often than non-doubles, but no single session is doubles-saturated. The Leitner box already does the work of cross-session prioritisation — the per-session cap protects within-session pacing.

**Net: no cap is over- or under-tuned. All §2.5 verdicts re-affirmed.**

#### 1.6.5 What would trigger a future re-audit?

This audit closes the original tkt scope. Future re-opens fire on any of:

- **Real-Marian session data** showing a previously-unanticipated error pattern (e.g., consistent confusion between specific pool facts; engagement drop on a category; sudden retrieval-rate plateau on a band).
- **Curriculum boundary changes** — if `add-to-10`'s promotion target widens (e.g., dropping the 95/3 accuracy gate in favour of a Leitner-drainage gate, which §6 currently rejects), the pool size becomes load-bearing in a new way and would need re-evaluation.
- **Class 3+ distractor research** — if Dave's research surfaces a new error pattern for which a 3rd distractor class becomes warranted, both the class and its pool-fitness audit fire together (the §3.2 Class-2 decision is the precedent: pool fitness was 45.5% in-range, sufficient to support the class IF the class were pedagogically motivated, which it was not).
- **Pool saturation on Marian's session history** — if Marian generates >20 `add-to-10` sessions and her session histories show every fact in the pool has been seen ≥3 times AND she still has not promoted, the pool may be too thin and re-extension at the EASY band (zero-addends rejected here) gets a second look.

None of these triggers are firing today.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 44-fact pool above. Identical structural shape to `sub-to-10-content.md` §2: warm-up gentle ramp on EASY, discriminate tier on MEDIUM + HARD with high-leverage coverage and category caps.

> **Authority:** [`scripts/compositionLint.ts:ADD_TO_TEN_RULES`](../../scripts/compositionLint.ts) (Kevin, PR #248). This spec ratifies the rules verbatim — see §2.5 for the audit of each constant against pedagogical fit.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source         | Distractor class (§3)                      | Why                                                                                                                                     |
| ------------- | ------------ | ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| P1            | gentle       | EASY band only      | Class 0 — gentle (≥2 away, range extremes) | Session opener. Dave § "math-distractor-and-streak-decisions" — gentle-ramp cutoff sits between P3 and P4. Same posture as `sub-to-10`. |
| P2            | gentle       | EASY band only      | Class 0 — gentle                           | Calibration continues.                                                                                                                  |
| P3            | gentle       | EASY band only      | Class 0 — gentle                           | Marian has had 3 successful experiences before traps arrive — preserves the `GENTLE_RAMP_THROUGH = 3` cutoff.                           |
| P4            | discriminate | MEDIUM only         | Class 1 — off-by-one                       | First diagnostic problem. MEDIUM-band entry point — HARD-band not yet allowed.                                                          |
| P5            | discriminate | MEDIUM or HARD band | Class 1 — off-by-one                       | HARD-band first-permitted slot.                                                                                                         |
| P6            | discriminate | MEDIUM or HARD band | Class 1 — off-by-one                       | "                                                                                                                                       |
| P7            | discriminate | MEDIUM or HARD band | Class 1 — off-by-one                       | "                                                                                                                                       |
| P8            | discriminate | MEDIUM or HARD band | Class 1 — off-by-one                       | Closer; full discriminative pressure.                                                                                                   |

**Band-by-slot rule (LOCKED, matches Kevin's lint `bandAllowedSlots`):**

- EASY (sum 3-5): allowed at any slot P1-P8 (gentle ramp anchor, but also permitted as a discriminate-tier fallback when recent-score modulation biases easy — see §2.3).
- MEDIUM (sum 6-8): allowed at P4-P8.
- HARD (sum 9-10): allowed at P5-P8 only. **HARD must NOT appear at P1-P4.**

### 2.2 Category caps (LOCKED, matches Kevin's lint `categoryCaps`)

Across the 8-problem set:

| Category       | Cap | Rationale                                                                                                                                                                                                |
| -------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doubles`      | 2   | Pool has only 3 doubles (`2+2, 3+3, 4+4`); two per session is the practical max without monotony. Dave's "doubles anchor" recommendation supports HIGH frequency — see §2.5 audit note 2.                |
| `plus-one`     | 2   | Pool has 14 plus-one facts (largest category). Cap prevents the discriminate tier from filling with trivially-easy count-on-ones. Two per session is the calibration anchor.                             |
| `near-doubles` | 3   | Pool has 6 near-doubles. Higher cap reflects pedagogical value (doubles-plus-one derivation is a key automaticity bridge); allows 1-2 in gentle plus 1-2 in discriminate.                                |
| `sums-to-10`   | 2   | Pool has 9 sums-to-10 facts; cap at 2 keeps each session focused on a single make-10 anchor + one complementary pair without saturating the make-10 category. Coverage rule (§2.4) requires ≥1 in P4-P8. |
| `general`      | 2   | Pool has 12 generals; HARD cap at 2 preserves the discriminate-tier headroom for sums-to-10 and near-doubles (the higher-leverage categories) without starving the slot for any reason.                  |

**Caps are mutually exclusive** (each fact maps to exactly one category per the priority rule in §1.2). A single 8-problem session sums to at most `2 + 2 + 3 + 2 + 2 = 11` permits, which comfortably accommodates the 8-slot session.

### 2.3 Recent-score modulation

Per [`api/_planner.ts:buildUserMessage`](../../api/_planner.ts), the user message ships a `recentSuccessRate` for the focus node. Haiku uses this to bias band selection within the gentle/discriminate envelope:

- **Low score (< 0.5)** → favour MEDIUM (or even EASY) for the discriminate tier; avoid HARD-band sums-to-10.
- **High score (≥ 0.85)** → push into HARD; ensure the HARD-band sums-to-10 anchor (`5+5` or a complementary pair) appears in P5-P8.
- **Mid score or no data** → balanced mix per the §2.1 default distribution.

The band-by-slot rules (§2.1) and category caps (§2.2) are HARD constraints; recent-score modulation only re-balances WITHIN them.

### 2.4 Sums-to-10 coverage (the high-leverage rule)

> **At least one `sums-to-10` fact MUST appear in P4-P8.**

This is the analog of `sub-to-10-content.md` §2.3's "take-from-10" coverage. Both rules express the same pedagogical principle (the make-10 mental model is the highest-leverage category for Marian's current curriculum slot) and share the same lint rule identifier (`'high-leverage-coverage'`). **Net: the rule literal `'high-leverage-coverage'` is the name; the rule's semantic for this tier is "≥ 1 `sums-to-10` fact in P4-P8".** Mechanical rename history is tracked in §9.4.

### 2.5 Audit of Kevin's lint constants vs pedagogical fit

The dispatch brief asked: are these caps right for a child reinforcing automaticity? Specifically — is `doubles ≤ 2` correct or should it be higher (doubles are pedagogically privileged)?

| Constant                  | Kevin's value | Audit verdict | Rationale                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doubles ≤ 2`             | 2             | ✅ KEEP       | The pool only has 3 doubles facts (`2+2, 3+3, 4+4` — `5+5` lives in sums-to-10). A cap of 2 lets every session include doubles without filling the gentle ramp with them. Raising to 3 would force the session to contain ALL three doubles every time, removing variety. The Leitner box already prioritises high-leverage facts; doubles get repeated EXPOSURE across sessions, not WITHIN a single session. |
| `plus-one ≤ 2`            | 2             | ✅ KEEP       | Pool has 14 plus-one facts. If uncapped, half a session could be `1 + k` and `k + 1`. Cap at 2 keeps plus-one as a calibration anchor without dominance.                                                                                                                                                                                                                                                       |
| `near-doubles ≤ 3`        | 3             | ✅ KEEP       | The higher cap relative to doubles reflects: (a) pool size (6 vs 3); (b) Dave's note that doubles-plus-one derivation is a key automaticity bridge — near-doubles get more session real estate to scaffold this. Cap at 3 means up to ~37.5% of a session can be near-doubles, which is the right ceiling.                                                                                                     |
| `sums-to-10 ≤ 2`          | 2             | ✅ KEEP       | High-leverage but not the ENTIRE session. Cap at 2 + coverage minimum of 1 means every session has 1-2 sums-to-10 facts — the right intensity for the make-10 mental model to consolidate without saturating.                                                                                                                                                                                                  |
| `general ≤ 2`             | 2             | ✅ KEEP       | The hardest category; cap at 2 prevents an over-difficult HARD tier. Sessions with high recent score still get the rest of the HARD band slots filled by sums-to-10 and near-doubles (both more pedagogically valuable).                                                                                                                                                                                       |
| `bandAllowedSlots.EASY`   | P1-P8         | ✅ KEEP       | EASY can appear anywhere; recent-score low routes Haiku to EASY in P4-P8 as a confidence-preservation fallback.                                                                                                                                                                                                                                                                                                |
| `bandAllowedSlots.MEDIUM` | P4-P8         | ✅ KEEP       | MEDIUM out of P1-P3 is the gentle-ramp rule.                                                                                                                                                                                                                                                                                                                                                                   |
| `bandAllowedSlots.HARD`   | P5-P8         | ✅ KEEP       | HARD at P5+ matches sub-to-10's pattern. HARD at P4 would deprive Marian of one MEDIUM warm-up problem between gentle and full discriminate.                                                                                                                                                                                                                                                                   |
| `sumsToTenInP4ToP8Min`    | 1             | ✅ KEEP       | The make-10 anchor must appear in every session (Marian's diagnostic priority). Raising to 2 would conflict with the `sums-to-10 ≤ 2` cap when other discriminate-tier needs (e.g. near-doubles coverage) compete; 1 + 1-elsewhere is the right floor.                                                                                                                                                         |
| `totalProblems`           | 8             | ✅ KEEP       | Matches all other math tiers; planner architecture assumes 8.                                                                                                                                                                                                                                                                                                                                                  |

**Net verdict:** Kevin's lint constants are pedagogically sound. No widening or tightening proposed. This spec ratifies them as-is.

### 2.6 No-duplicates rule

No `(a, b)` ordered pair may repeat within the 8-problem session. Note: `2 + 3` and `3 + 2` are NOT duplicates — they are distinct ordered pairs with distinct read-line text (`"Two plus three. How many?"` vs `"Three plus two. How many?"`). This matches Kevin's lint behaviour.

### 2.7 Leitner-modulated session generation (in-force for this tier)

`add-to-10` is the ONLY tier where the Leitner box and slow-fact directive are active today (per `planner-and-canon.md`). When Leitner is active, the planner's `buildUserMessage` injects per-fact box hints — Haiku uses them to bias WHICH facts to draw from the pool. **The pool, band-by-slot, and category caps remain authoritative under Leitner activation.** Leitner cannot:

- Place a HARD-band fact at P1-P3.
- Exceed any category cap.
- Skip the sums-to-10 in P4-P8 coverage.
- Introduce a duplicate.

Leitner influences fact SELECTION within the rule envelope. The lint backstop in PR #248 catches any violation at bake-time regardless of source.

---

## 3. Distractor design — Class 0 (gentle) + Class 1 (off-by-one), no Class 2

`add-to-10` uses the existing two-class distractor model unchanged from the pre-sub-to-10 baseline. **No new distractor classes for this tier.**

### 3.1 Class 0 — gentle (P1–P3) — unchanged

Algorithm: two distractor values, each ≥ 2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in [`src/screens/Math/distractors.ts:gentleDistractors`](../../src/screens/Math/distractors.ts). Fires on every `add-to-10` problem with `problemIndex ∈ {1, 2, 3}`.

### 3.2 Class 2 — wrong-operation — REJECTED for `add-to-10`

The dispatch brief asks: should `add-to-10` carry a Class 2 wrong-operation distractor analogous to `sub-to-10`'s? For `a + b = c`, the wrong-op trap would be `a − b` (or `b − a` to keep positive).

**Decision: NO. Class 2 is rejected for `add-to-10`.**

**Rationale.**

1. **Marian's diagnostic does not name wrong-operation as an error pattern at this tier.** Her April 2026 result on `add-to-10` is "Sums to 10, drive automaticity (100% finger reliance)" — she counts EVERY addition fact on fingers, accurately. The cognitive error this tier targets is SLOW retrieval, not wrong-operation confusion. Dave's `add-to-10-counting-to-recall.md` Priority list — Leitner box, doubles anchor, subitising — does NOT mention wrong-operation confusion as a presenting issue. Adding a distractor class to trap an error she does not make is pedagogically inert.
2. **Range fitness is mediocre, and the misses are pedagogically incoherent.** For `a + b = c`, wrong-op = `a − b` requires `a ≥ b` for the result to live in the chip range `[1, 10]` (with `ANSWER_RANGE_MIN = 1`). Counted against the 44-fact pool:

   | Wrong-op outcome                  | Pool count | Fate                                             |
   | --------------------------------- | ---------- | ------------------------------------------------ |
   | `a − b < 0` (negative; `a < b`)   | 20         | OOR → silent downgrade to off-by-one             |
   | `a − b = 0` (doubles; `a == b`)   | 4          | OOR vs `ANSWER_RANGE_MIN = 1` → silent downgrade |
   | `a − b ∈ [1, 10]`, `≠ c` (usable) | 20         | In-range trap fires                              |

   20 of 44 pool facts (45.5%) produce a usable in-range trap. Per-session that means roughly 2-3 of the 5 discriminate slots could attempt the trap and roughly 2 would land in-range — **on par with sub-to-10's actual in-range delivery rate** (per `design/research/canon-pool-wrong-op-delivery.md`, sub-to-10 currently lands roughly 1 in-range trap per session on the deployed pool). So range-fitness alone does not eliminate the trap. The disqualifier is reason 3 below.

3. **Pedagogical asymmetry between addition and subtraction.** The wrong-operation lure in `sub-to-10` is a documented error pattern (Dave § Q4 of `sub-to-10-fact-sequencing-marian.md`: "the more impactful distractor to add is the wrong-operation distractor" — confused-direction errors are well-attested in 7-9 year olds learning subtraction). The reverse — answering `"5 + 3 = 2"` because you accidentally subtracted — is not a documented error pattern at this developmental stage. The shared-pair-with-different-operation confusion is asymmetric; only subtraction carries the lure.
4. **Implementation cost vs benefit.** Adding Class 2 to `add-to-10` would require: (a) a new `op === '+'` branch in `pickDistractors` / `wrongOpDistractors`; (b) a directive-prose update to mention the new trap class; (c) test coverage on every pool fact's range-fitness; (d) a canon re-bake to embed the new tagging. All for a trap class that targets an error pattern Marian does not make. The implementation cost is non-trivial; the pedagogical payoff is near-zero per reasons 1 + 3. **Cost > benefit.**

**Forward-compatibility.** If a future tier (e.g. `add-to-20`) wants to introduce wrong-operation discriminations for older Marian, the spec can be revisited. The decision here is scoped to `add-to-10` only.

### 3.3 No range widening needed

The pool answer range is `[3, 10]`. The existing `ANSWER_RANGE_MIN = 1` ceiling accommodates the off-by-one neighbours `correct − 1` and `correct + 1` for every pool fact without OOR fallback. (Contrast: `sub-to-10-content.md` §3.3 widened `ANSWER_RANGE_MIN` to `0` for `op === '-'` to support subtract-self facts; `add-to-10` has no `correct = 0` or `correct = 1` fact, so no widening required.)

### 3.4 Distractor-class hint shape — NOT used

The wire shape `MathProblem.distractorClass` exists (added in `sub-to-10-content.md` §3.4) but is **never set for `add-to-10` problems**. Today [`Math.tsx:2559-2560`](../../src/screens/Math/Math.tsx#L2559-L2560) defaults `distractorClass` to `'wrong-op'` for `op === '-'` and `undefined` for `op === '+'`; the `undefined` branch falls through to `pickDistractors`'s default behaviour (gentle for P1-P3, off-by-one for P4+). **No code change needed.**

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `add-to-10` block

**Current state (NOT changed by this PR):** `api/_planner.ts:921` carries a single-line directive:

> ```
> - add-to-10: addition with sums 3-10. Both addends 1-9. read: "<addend-A> plus <addend-B>. How many?" e.g. "Three plus two. How many?" Prefer bridge-through-5 (3+2, 4+3), easy doubles (2+2, 4+4), and small near-doubles. Sums must be <= 10.
> ```

**Spec posture toward this directive:** the one-line directive is structurally thinner than `sub-to-10`'s structured `[BAND/category]` block. Kevin's NOF #2 on PR #248 explicitly flags directive-sharpening as a future task IF Haiku ever emits a problematic add-to-10 canon. **No directive change in this spec's PR.** A follow-up ticket (Matt to file) carries the directive-sharpening work; the pool + caps in this spec become the source-of-truth for that future directive prose.

### 4.1 Follow-up directive-sharpening content (for Kevin's future ticket)

When the directive-sharpening ticket fires, Kevin should embed the same structured shape as `sub-to-10`'s block (`_planner.ts:923-970`). The literal block below is the spec's recommendation for that future directive; **it is NOT shipped by this PR.** Captured here so the future ticket has a draft to start from.

> ```
> - add-to-10: addition with sums 3-10. Both addends 1-9. read: "<addend-A> plus <addend-B>. How many?" e.g. "Three plus two. How many?"
>
>   FACT POOL (44 facts; pick exactly 8 distinct ordered pairs from this pool per session; commutative pairs are DISTINCT facts — "2+3" and "3+2" are separate pool entries):
>   - EASY band (sum 3-5; 9 facts):
>     · plus-one: 1+2, 2+1, 1+3, 3+1, 1+4, 4+1
>     · doubles: 2+2
>     · near-doubles: 2+3, 3+2
>   - MEDIUM band (sum 6-8; 18 facts):
>     · plus-one: 1+5, 5+1, 1+6, 6+1, 1+7, 7+1
>     · doubles: 3+3, 4+4
>     · near-doubles: 3+4, 4+3
>     · general: 2+4, 4+2, 2+5, 5+2, 2+6, 6+2, 3+5, 5+3
>   - HARD band (sum 9-10; 17 facts):
>     · sums-to-10: 1+9, 9+1, 2+8, 8+2, 3+7, 7+3, 4+6, 6+4, 5+5
>     · plus-one: 1+8, 8+1
>     · near-doubles: 4+5, 5+4
>     · general: 2+7, 7+2, 3+6, 6+3
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts (sum 3-5).
>   2. Problems 4: MEDIUM-band only (HARD-band forbidden at P4).
>   3. Problems 5-8 (discriminate): MEDIUM or HARD bands. Recent-score modulation: low score (< 0.5) → bias toward MEDIUM and avoid HARD-band sums-to-10; high score (>= 0.85) → push into HARD and ensure a sums-to-10 anchor; mid score → balanced mix.
>   4. At least one sums-to-10 fact MUST appear in P4-P8 (highest-leverage; bridges to add-to-20).
>   5. NO duplicate (a, b) ordered pairs within the 8-problem set. "2+3" and "3+2" are NOT duplicates.
>   6. Category caps: doubles ≤ 2, plus-one ≤ 2, near-doubles ≤ 3, sums-to-10 ≤ 2, general ≤ 2. Each fact maps to EXACTLY ONE category per the priority sums-to-10 → doubles → plus-one → near-doubles → general.
>
>   PROSODY: numbers are spelled out as words ("one", "two", "three", ... "ten"). Capitalize the first word of each sentence. The "plus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10%; no SSML overrides required for any value in [1, 10].
> ```

### 4.2 Per-slot utterance templates (UNCHANGED — already-shipped baseline)

Each problem emits the 5 standard slots. No changes vs the existing canon.

| Slot         | Template                                                 | Example for `5 + 3 = 8`                       |
| ------------ | -------------------------------------------------------- | --------------------------------------------- |
| `read`       | `"<addend-A> plus <addend-B>. How many?"`                | `"Five plus three. How many?"`                |
| `correct`    | `"Yes! <answer>!"`                                       | `"Yes! Eight!"`                               |
| `reprompt`   | `"Hmm... try again?"` (verbatim, LOCKED phrasing)        | `"Hmm... try again?"`                         |
| `hint`       | `"Look. <addend-A>. And <addend-B> more. How many now?"` | `"Look. Five. And three more. How many now?"` |
| `giveAnswer` | `"This one is <answer>."`                                | `"This one is eight."`                        |

### 4.3 No first-encounter framing variant

`add-to-10` does NOT get a "take away" → "minus" style first-encounter copy variant. Marian has run dozens of sessions on the tier already; a phrasing variant would have no benefit. The `lifetimeFirstEncounters['add-to-10']` flag is not used. The tier remains absent from `FIRST_ENCOUNTER_GATED_NODES` in [`api/_firstEncounterGate.ts`](../../api/_firstEncounterGate.ts).

---

## 5. Schema posture — `MathFact { a, b, op: '+' }` reuse, NO new infrastructure

`add-to-10` predates the `op` field; all problems implicitly carry `op: '+'`. Following `sub-to-10-content.md` §5 the wire shape now widened to make `op` REQUIRED on every `MathProblem` (default `'+'` preserves backwards compat for `add-to-10` canon and static fallbacks). **No code change for this spec.** Confirming the contract:

- `MathProblem.op` — REQUIRED, value `'+'` for `add-to-10`.
- `MathProblem.distractorClass` — OPTIONAL, never present on `add-to-10` problems (see §3.4).
- Read-line parser regex `RE_PLUS` in [`scripts/compositionLint.ts`](../../scripts/compositionLint.ts) and [`src/screens/Math/planFromServer.ts`](../../src/screens/Math/planFromServer.ts) handles `"<W> plus <W>. How many?"` — already in place.

**No screen-side changes.** `Math.tsx` continues to render `add-to-10` problems through the existing chip-tap surface. The operator glyph at [`Math.tsx:2179`](../../src/screens/Math/Math.tsx#L2179) (`{currentProblem.op === '-' ? '−' : '+'}`) already handles `op === '+'`.

---

## 6. Advancement gate — `add-to-10 → add-to-20` (ACCURACY ONLY)

Per the locked math curriculum order (`number-recog → add-to-10 → add-to-20 → sub-to-10 → ...`, see `sub-to-10-content.md` §11 Q1), `add-to-10` promotes to `add-to-20`. The gate is accuracy-only per the math default threshold:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default `95/3`, locked 2026-05-02; see `.claude/docs/progress-and-persistence.md` § "Mastery rule").

**Explicitly NOT a gate:**

- ❌ Leitner box state. Even if Marian has many box-1 facts (least familiar) on `add-to-10`, she advances to `add-to-20` once accuracy holds. The Leitner box is a session-generation steering tool, not a promotion gate. Holding her on `add-to-10` because the Leitner box is "not yet drained" would defer fact-family exposure that itself accelerates upstream automaticity (Dave's "fact-family interleaving is therapeutic" — McNeil et al. 2025 cited in `sub-to-10-content.md` §6).
- ❌ Slow-fact list length. Same logic as the `add-to-20 → sub-to-10` gate (`sub-to-10-content.md` §6).
- ❌ Latency median. The slow-fact directive is a retargeting tool, not a promotion signal.

**Hard stop (parent / observation gate, NOT algorithmic):** the existing Parent Settings `autoPromote: false` flag handles distress signals.

**Code implication.** No change to `applyMasteryRule` or `pickFocusNode`. The existing rule already promotes on accuracy.

**Cross-doc reference.** The "DO NOT gate promotion on Leitner box drainage / slow-fact list length" rationale ALREADY lives in `progress-and-persistence.md` (added per `sub-to-10-content.md` §9.9). This spec re-affirms the same rationale applies to the `add-to-10 → add-to-20` transition; no doc change needed.

---

## 7. Session flow — narrative summary

A first-person walkthrough of one well-formed 8-problem `add-to-10` session:

- **P1 (gentle, EASY).** `"Two plus one. How many?"` — `correct = 3`. Chips: `{3, 5, 8}` (gentle distractors, both ≥ 2 away from 3). Marian taps `3`. Emma celebrates: `"Yes! Three!"`. Stardust ticks.
- **P2 (gentle, EASY).** `"Two plus two. How many?"` — `correct = 4`. Chips: `{4, 7, 9}`. (`gentleDistractors` biases toward range extremes.)
- **P3 (gentle, EASY).** `"Three plus two. How many?"` — `correct = 5`. Chips: `{5, 8, 10}`. End of warm-up.
- **P4 (discriminate, MEDIUM).** `"Four plus three. How many?"` — `correct = 7`. Chips: `{6, 7, 8}` (off-by-one neighbours). First diagnostic problem; HARD-band forbidden.
- **P5 (discriminate, MEDIUM or HARD).** `"Five plus three. How many?"` — `correct = 8`. Chips: `{7, 8, 9}`.
- **P6 (discriminate, MEDIUM).** `"Four plus four. How many?"` — `correct = 8`. Doubles category, capping at 2 (already counted `2+2` at P2; this is the second of two).
- **P7 (discriminate, HARD).** `"Five plus four. How many?"` — `correct = 9`. Chips: `{8, 9, 10}`.
- **P8 (discriminate, HARD, sums-to-10 anchor).** `"Five plus five. How many?"` — `correct = 10`. Chips: `{9, 10, 11}` → clamped to `{9, 10, 8}` per `offByOneDistractors`'s OOR-substitution rule. **The high-leverage sums-to-10 anchor.** Coverage rule satisfied.

This walkthrough mirrors the actual canon shipped at `public/canon/math/level-1/add-to-10.json` (verified clean against Kevin's lint).

---

## 8. Op-parameterized slow-fact threshold — `add-to-10` uses the global default

The `5000 ms` global threshold in [`src/lib/progress/slowFacts.ts`](../../src/lib/progress/slowFacts.ts) is correct for `op === '+'` per Dave's research (subtraction retrieval mean RT is systematically higher than addition, but addition is the baseline). **No widening or parameterization needed for `add-to-10`.** This contrasts with `sub-to-10-content.md` §8 which proposed a `6000 ms + 5-session warmup` shape for `op === '-'`.

---

## 9. Wire-up checklist for Kevin — ZERO code changes in this PR

The lint, canon, and code wiring already exist (PR #248 + existing Phase-1 canon). This spec is documentation-only; the only deliverable in this PR is the markdown file at `design/math/add-to-10-content.md`. **No `api/`, `src/`, `scripts/`, or `public/canon/` files change.**

### 9.1 No directive change

`api/_planner.ts:921` remains the one-line description. Directive-sharpening is a future Kevin ticket per §4.1 (the structured block in §4.1 is the draft for that future directive); not in this PR.

### 9.2 No canon re-bake

`public/canon/math/level-1/add-to-10.json` is already clean against Kevin's lint (verified — see §7 walkthrough). No regen needed. Re-bake fires only if the directive sharpens AND Haiku emits a different composition — that's a follow-up Kevin ticket.

### 9.3 No `scripts/compositionLint.ts` change

The lint config (`ADD_TO_TEN_POOL` + `ADD_TO_TEN_RULES`) is the authoritative implementation of this spec. If a future audit reveals a pedagogical mismatch (which §2.5 surveyed and rejected), THAT triggers a Kevin lint update.

### 9.4 Follow-up tickets surfaced by this spec

These are independent tickets for Matt to file; NONE block the PR for this spec:

- [ ] **`tkt-add-to-10-directive-sharpening`** — sharpen `api/_planner.ts:921` to embed the structured `[BAND/category]` FACT POOL block per §4.1. Trigger: a future Haiku rebake produces a composition-rule-violating canon, OR Marian's session data shows a Haiku-driven mix problem. Owner: Kevin.
- [x] ~~**`tkt-rename-high-leverage-coverage-rule-literal`** (was: `tkt-rename-take-from-10`-coverage-...) — rename the legacy `take-from-10`-coverage rule literal in `compositionLint.ts` to a tier-agnostic name. Owner: Kevin. Trigger: NOF #3 on Kevin's PR #248; mechanical change, no semantic change.~~ **RESOLVED 2026-05-16** — renamed to `'high-leverage-coverage'`. Mechanical change; semantics unchanged.
- [ ] **`tkt-subitising-scaffold-spec`** — Dave's `add-to-10-counting-to-recall.md` Priority 2 proposes a dot-pattern visual for sums ≤ 5. Owner: Kyle. Trigger: post-Leitner-wire bandwidth.
- [x] ~~**`tkt-add-to-10-pool-extension-audit`** — sanity-check at the 5-session-post-promotion mark whether the 44-fact pool is too thin or too broad. Owner: Kyle. Trigger: post-Marian-promotion-to-`add-to-20`.~~ **RESOLVED 2026-05-16 (this PR) — verdict HOLD.** Audit dispatched out of PR #251's sub-to-10 pool-widening discipline; conducted ahead of the original "post-promotion" trigger because the question was already structurally surfaced. All four audit dimensions (pool breadth WIDEN, pool breadth NARROW, distractor classes, cap saturation) return HOLD. See §1.6.

---

## 10. Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite. Note: every criterion below is ALREADY satisfied by the shipped state — this spec ratifies the existing behaviour; nothing new ships.

- [ ] **AC1**: The 44-fact pool in `ADD_TO_TEN_POOL` (Kevin's PR #248) matches §1.3 of this spec verbatim (pool-sanity tests already pin count 44, unique ids, band counts, category counts).
- [ ] **AC2**: Kevin's `ADD_TO_TEN_RULES` constants match §2.2 + §2.4 of this spec (`categoryCaps`, `bandAllowedSlots`, `sumsToTenInP4ToP8Min`, `totalProblems`).
- [ ] **AC3**: Composition rules from §2 hold for every Haiku-generated or pre-baked `add-to-10` canon: P1-P3 from EASY band; HARD band only at P5-P8; ≥ 1 sums-to-10 fact in P4-P8; no duplicate ordered pairs; all category caps respected. Verified by `assertAddToTenCompositionClean` at bake-time and by `npm run canon:lint:composition` in CI.
- [ ] **AC4**: No Class 2 wrong-operation distractor is generated for `add-to-10` problems. `Math.tsx:2559-2560` defaults `distractorClass` to `undefined` for `op === '+'`; `pickDistractors` uses Class 0 (gentle, P1-P3) and Class 1 (off-by-one, P4-P8) only.
- [ ] **AC5**: The current canon `public/canon/math/level-1/add-to-10.json` passes `npm run canon:lint:composition` cleanly (no violations). Verified manually in spec authorship — see §7 walkthrough.
- [ ] **AC6**: Read-line parser `parseAddToTenReadLine` in `scripts/compositionLint.ts` (and `planFromServer.ts`) handles every pool fact's read template `"<W> plus <W>. How many?"`.
- [ ] **AC7**: Advancement gate — `add-to-10 → add-to-20` fires on accuracy threshold alone (math default `95/3`), NOT influenced by Leitner box state or slow-fact list length. Verified by existing mastery tests.
- [ ] **AC8**: No `lifetimeFirstEncounters['add-to-10']` flag is read or written by `_firstEncounterGate.ts` or `_planner.ts` (the tier is not in `FIRST_ENCOUNTER_GATED_NODES`).
- [ ] **AC9**: When Leitner is active for `add-to-10`, the box-derived per-fact prioritisation does NOT violate any pool / band / category / coverage rule (the composition lint backstops this regardless of Leitner state).

---

## 11. Decisions locked

The dispatch brief surfaced one open question; this spec also implicitly locks the rule-ratification calls Kevin's PR #248 made. Both recorded here.

**Q1 — Class 2 wrong-operation distractor for `add-to-10`: include or reject?**

**DECIDED: REJECT.** No Class 2 for `add-to-10`. Rationale in §3.2: (a) Marian's diagnostic does not name wrong-op confusion as an error pattern at this tier; (b) **the disqualifier is pedagogical asymmetry, not range-fitness** — range-fitness is actually 45.5% of pool (20/44 facts produce a usable in-range trap, on par with sub-to-10's delivery rate), but addition-direction confusion is not a documented error pattern in 7-9 year olds the way subtract-direction confusion is; (c) cost > benefit when the trap targets a non-error. Class 2 remains scoped to `sub-to-10` and future subtraction tiers.

**Q2 — Ratify Kevin's PR #248 lint constants (`categoryCaps`, `bandAllowedSlots`, `sumsToTenInP4ToP8Min`) without modification?**

**DECIDED: RATIFY.** No widening or tightening. Audit in §2.5 walks each constant and confirms pedagogical fit. The specific consideration the dispatch brief raised — `doubles ≤ 2` for a child reinforcing automaticity — is correct as-is: the pool only has 3 doubles facts, and the Leitner box already prioritises high-leverage facts across SESSIONS rather than packing them into a single session. Raising to `doubles ≤ 3` would force ALL three doubles every session and eliminate variety; lowering would starve the doubles anchor.

**Q3 — Re-bake the canon now to inject the structured `[BAND/category]` directive prose?**

**DECIDED: NO.** The current canon (single-line directive) is clean against Kevin's lint; no regen needed. Directive-sharpening is a follow-up Kevin ticket (§9.4) triggered by future Haiku misbehaviour or Marian session data signals — not by this spec.

---

## 12. Risks / counter-evidence

- **The single-line directive at `_planner.ts:921` is structurally thinner than `sub-to-10`'s structured block.** If Haiku is ever re-baked under the current one-line directive, there is no guarantee it would emit a clean canon (Kevin's PR #248 NOF #4: "current canon passes by happy accident, not by design"). **Mitigation:** the bake-time gate `assertAddToTenCompositionClean` in PR #248 catches any violation before disk write. If a future bake throws, that triggers the directive-sharpening follow-up (§9.4 tkt-add-to-10-directive-sharpening). Risk is contained to the bake pipeline; production runtime is unaffected.

- ~~**The legacy `take-from-10`-coverage rule literal is misnamed for the `add-to-10` semantic ("sums-to-10 coverage").** Cosmetic naming gap. The rule fires correctly; the literal name persists for backwards-compat with PR #245's surface. Tracked in §9.4.~~ **RESOLVED 2026-05-16** — renamed to `'high-leverage-coverage'`.

- **Pool size of 44 may be too broad once Marian achieves automaticity.** If she retrieves every pool fact in < 2 s, the entire pool is "easy" — the discriminate tier loses discriminative power. **Counter:** the advancement gate `add-to-10 → add-to-20` fires at 95% accuracy across 3 cross-day-deduped sessions. By that point Marian will have moved on. The risk is therefore zero in steady state. **Audited 2026-05-16 (this PR) per §1.6 — HOLD verdict; the 44-fact pool remains the right breadth** and the original `tkt-add-to-10-pool-extension-audit` ticket (§9.4) closes as RESOLVED. Re-audit triggers documented in §1.6.5.

- **No subitising scaffold.** Dave's Priority 2 from `add-to-10-counting-to-recall.md` recommends a dot-pattern visual for sums ≤ 5. Not in this spec's scope; tracked as `tkt-subitising-scaffold-spec` (§9.4).

- **Wrong-op decision could be revisited if Marian's data shows a previously-unanticipated error pattern.** The rejection in §3.2 is based on the current evidence. If real-Marian session data on `add-to-10` surfaces wrong-operation answers at meaningful frequency, re-open. Low expected probability per Dave's developmental literature; not a planning concern today.

---

## 13. Post-ship corrections

> **Post-ship correction (2026-05-16, this PR — pool-extension audit closure).** SPEC-ONLY. Conducts the `tkt-add-to-10-pool-extension-audit` follow-up filed in §9.4, dispatched out of PR #251's sub-to-10 pool-widening discipline (which raised the parallel question for `add-to-10`). All four audit dimensions return HOLD: (a) **pool breadth WIDEN candidates** — zero-addend facts, drop-plus-one-at-HARD, split-5+5 — all REJECTED with rationale in §1.6.1; (b) **pool breadth NARROW candidates** — drop-general-at-HARD, reduce-near-doubles — all REJECTED in §1.6.2; (c) **distractor-class ADD candidates** — Class 3 answer-equals-operand — REJECTED in §1.6.3 (targets a kindergarten-era error pattern, not Marian's 8-year-old profile; chip-pattern collisions with Class 1 in many pool facts); (d) **cap saturation** — re-confirmed clean per §1.6.4, all §2.5 verdicts re-affirmed. The §9.4 ticket closes as RESOLVED. No `_planner.ts`, `compositionLint.ts`, `public/canon/`, or `src/screens/Math/` change. Re-audit triggers documented in §1.6.5 (real-Marian error pattern, curriculum boundary change, new distractor class research, or pool saturation on session history).

---

## 14. Cross-references

- **Predecessor research** — `design/research/add-to-10-counting-to-recall.md` (Dave, 2026-04-29; finger-counting profile, doubles + sums-to-10 anchors, subitising support, Leitner priority recommendation).
- **Distractor research** — `design/research/math-distractor-and-streak-decisions.md` (Dave, 2026-04-25; gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Sibling content spec** — `design/math/sub-to-10-content.md` (Kyle, 2026-05-15; structural template for this doc; contains the Class 2 wrong-op spec rejected here for `add-to-10`).
- **Composition lint** — `scripts/compositionLint.ts` (Kevin, PR #248; the authoritative implementation that this spec ratifies). PR body documents the rule synthesis from the directive + diagnostic + current canon.
- **Wrong-op delivery audit** — `design/research/canon-pool-wrong-op-delivery.md` (the per-fact range-fitness audit for `sub-to-10`; provides the empirical baseline for the §3.2 rejection on `add-to-10`).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md` (Leitner box scoping; slow-fact directive scope; bake pipeline).
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md` (mastery rule `95/3`; promotion-gate-do-NOT-include-slow-fact-list footnote already documented per `sub-to-10-content.md` §9.9).
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md` (math node ladder).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (does NOT apply to this PR — no progression state machine code is touched).
