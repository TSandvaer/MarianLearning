# Wave 5 — Borrow/Carry Error Patterns in 7-9yo (Research Note)

**Author:** Dave
**Date:** 2026-05-22
**Wave:** Wave 5 (two-digit-addsub WITH-regroup)
**For:** Kyle (Wave 5 spec authoring)

---

## 1. Background — Marian's Foundation

### Where she is

Marian enters Wave 5 having mastered:

- `add-to-10`, `add-to-20`, `sub-to-10`, `sub-to-20` (single-digit operations across the 0–20 range)
- Wave 4 `two-digit-addsub` (no-regroup): two-digit + or − one-digit without column-crossing

Per the April 2026 diagnostic: 100% finger reliance on add-to-10; subtraction within 15 confident; no regroup problems formally assessed. The Wave 4 distractor design included Class 2 (column-cross) to detect concatenated-single-digit processing. Promotion out of Wave 4 requires ≥ 80% Class-2-rejection rate (per `two-digit-addsub-content.md` §5.4), meaning Marian will have demonstrated genuine place-value understanding *for the no-regroup case* before Wave 5 begins.

### What changes with regrouping

Regrouping (carry on addition, borrow on subtraction) introduces one qualitatively new conceptual demand that Wave 4 did not require:

> **The tens and ones columns are not independent units. A transaction can flow between them.**

In addition: when ones + ones ≥ 10, a "ten" is created in the ones column and must be moved to the tens column (carry). In subtraction: when ones of minuend < ones of subtrahend, a "ten" must be transferred from the tens column to the ones column (borrow/regroup), reducing the tens digit by 1.

For an 8-year-old, this is the first time arithmetic is explicitly non-separable across columns. Working memory at age 8 holds roughly 5–6 chunks (Cowan developmental consensus). A WITH-regroup problem like `27 + 6` requires:
1. Compute ones: 7 + 6 = 13 (which itself requires crossing 10 — a sub-task she knows from add-to-20)
2. Place the 3 in the ones column; carry the 1
3. Add the carried 1 to the tens digit: 2 + 1 = 3
4. Rejoin: 33

That is 3 dependent sequential sub-tasks, each consuming a working-memory slot. Marian's finger counting on step 1 further loads WM. This is the highest single-lesson cognitive demand she has encountered in this skill tree.

---

## 2. The 3–5 Most-Documented Error Patterns

### Error Pattern 1 — Smaller-From-Larger (SFL) in Subtraction

**Description:** When the ones digit of the minuend is smaller than the ones digit of the subtrahend, the child reverses the subtraction within the ones column: subtracts the smaller digit from the larger, regardless of which is the minuend.

Example: `43 − 27 = ?`
- Correct: 4-tens → borrow → 13 ones − 7 = 6; 3 − 1 − 2 = 0 → result 16
- SFL error: ones column → 7 − 3 = 4; tens column → 4 − 2 = 2 → answer: **24** (instead of 16)

**Developmental rationale:** SFL occurs because children arriving at subtraction with regrouping have been heavily drilled on "you can't take big from small — get more." When that rule is applied before the borrow step, the child resolves the impasse by inverting the column rather than borrowing. Brown and VanLehn (1980) classify this as a "repair" — the child's procedure encounters an impasse (negative ones-result) and applies a locally plausible repair (invert the subtraction direction) that is wrong. Fuson (1990) situates it as evidence that the child lacks tens-and-ones positional understanding: for them, the "4" in the minuend tens column is just the digit 4, not a convertible resource.

**Frequency:** In the Jordan et al. (2003) study of 291 children in grades 3–4, 31% of children with comorbid math+reading difficulty made this error; 9% of control children (PMC2788949). Lin, Riccomini, and Liang (2025) identify "subtracted smaller integer" as one of the two or three most frequently documented errors across the 17 studies in their systematic review. This is the single most common systematic subtraction-with-regroup error in the elementary literature.

**Age-typical trajectory:** SFL is most prevalent at the point of first regrouping instruction (typically grade 2–3 in the US, ages 7–9). It declines substantially by the end of grade 3 for typical learners as borrowing becomes automatic. For learners with finger reliance (Marian's profile), it persists longer because the impasse-and-repair cycle is more likely when procedural execution is slow.

---

### Error Pattern 2 — Forgotten Carry in Addition

**Description:** Child correctly computes the ones sum and identifies that a carry is needed, but fails to add the carried 1 to the tens column. The answer is exactly 10 less than correct.

Example: `27 + 6 = ?`
- Correct: 7 + 6 = 13; carry 1; 2 + 1 + 1 = 4 → **33**
- Forgotten-carry: 7 + 6 = 13; write 3 in ones; forget carry → 2 + 0 = 2 → answer: **23**

A second variant: child carries the wrong digit. For `27 + 6`, ones sum = 13. Child writes the tens digit (1) instead of the ones digit (3) in the ones column, then adds the ones digit (3) to the tens column: answer **37** (ones: 1, tens: 2+3=5 → 51 — this variant produces less structured errors).

**Developmental rationale:** Two sub-causes:

- **Procedural working-memory failure:** Carrying requires holding an intermediate result (the "1 to carry") while performing a second computation (tens + tens + 1). For a finger-counter, the first computation (ones sum) already fully occupies WM. By the time the tens computation begins, the carried 1 has been dropped. This is not a misunderstanding — it is an executive-function / working-memory limit documented at ages 7–9 (Geary, 2004; McNeil et al., 2025).
- **Procedural confusion:** Early in instruction, children mix up which digit gets written and which gets carried. The carry digit is the tens digit of the partial sum (always 1 in the 2-digit + 1-digit range). This confusion is also documented as a systematic error by Brown and VanLehn (1980).

**Frequency:** Jordan et al. (2003) found addition bugs "relatively rare" overall (5% rate across all addition items) BUT this figure includes non-regroup problems. Addition WITH carry is substantially harder: the Klein et al. (2010) fMRI study documents that carry problems show "increased response latencies and error rates" compared to non-carry problems even in adults; for children the gap is much larger. The evidence that carrying-specific errors are common comes from practitioner research: "77.76% of addition errors are systematic, with 34.29% being carry-related" (primary school children's errors in addition study, 1,850 children, grades 4–5 in an Indian context — see sources). Treat this frequency as plausible-but-not-directly-generalisable to Marian's exact context.

**Age-typical trajectory:** Forgotten-carry improves with practice as the carry-then-add sequence becomes procedurally consolidated. It is at its worst in the first 5–10 sessions of regrouping instruction and typically resolves within 2–3 months for typical learners.

---

### Error Pattern 3 — Borrow-No-Decrement in Subtraction

**Description:** Child correctly adds 10 to the ones column (applies the borrow) but fails to reduce the tens digit of the minuend by 1. The ones column is computed correctly; the tens column is computed without the decrement.

Example: `43 − 27 = ?`
- Correct: borrow → ones: 13 − 7 = 6; tens: (4−1) − 2 = 1 → **16**
- Borrow-No-Decrement: borrow → ones: 13 − 7 = 6; tens: 4 − 2 = 2 (no decrement) → answer: **26**

**Developmental rationale:** Brown and VanLehn (1980) catalog this as one of the most frequent bugs in the BUGGY database of thousands of child solutions. The developmental cause: children learn the borrowing MECHANIC (add 10 to ones) before they understand WHY (the 10 was taken from the tens digit). Without the conceptual grounding, the decrement step is not causally linked to the borrow step in the child's representation — it is an additional rule that can be forgotten. Springer (2024) frames this as a dissociation between the *regrouping principle* (10 ones = 1 ten, exchanges are possible) and the *place-value principle* (the tens digit represents 10x its face value). A child who has learned regrouping as a rote add-10-to-ones procedure without place-value grounding is maximally likely to omit the decrement.

**Frequency:** Jordan et al. (2003) report "Borrow No Decrement" in approximately 8–18% of children across groups, with no significant group differences — meaning this error appears at similar rates in children with and without math difficulties. This makes it one of the most egalitarian bugs: all children are at risk when borrowing is first introduced.

**Age-typical trajectory:** Borrow-No-Decrement is observed from the first sessions of borrow instruction and persists longer than SFL for many children because the decrement step is genuinely counterintuitive (you add 10 to make things bigger, and simultaneously reduce the tens — two opposing moves on the same column). It fades once the child builds a mental model of the exchange (trading a ten for ten ones), typically over 3–4 months of regular practice.

---

### Error Pattern 4 — Borrow-Across-Zero

**Description:** When the tens digit of the minuend is 0, the child cannot borrow from it. Correct procedure requires going to the hundreds column (not relevant to Marian's 2-digit scope here) or treating the problem as unsolvable. For Marian's 2-digit scope, a borrowing-across-zero situation occurs when the minuend has tens digit 0 — for example, `04 − 7` — but this is pathological in a 2-digit context. The relevant case is when a child overapplies borrowing to problems that do NOT need it (a forward shadow of the phantom-borrow pattern documented in Wave 4 already).

**Note on scope:** Borrow-across-zero is primarily a 3-digit arithmetic problem (e.g., `304 − 127`) and is out of scope for Marian's current 2-digit tier. However, its precursor — the phantom-borrow error (applying borrow when the ones digit is already sufficient) — is documented in the Wave 4 research note (`two-digit-addsub-error-patterns.md`) and **remains a risk in Wave 5 for problems where Marian has already learned borrow and over-applies it to a non-borrow problem**. This is covered as a Wave 4 Class 3 carry-forward, not a new Wave 5 error.

---

### Error Pattern 5 — Carry-Into-Ones (Digit Confusion in Carry)

**Description:** Child writes the wrong digit in the answer when carrying. The partial ones sum has two digits (e.g., 7 + 8 = 15). Child writes "5" in ones correctly, carries the "1" correctly — OR child writes "1" in ones and carries "5" (reversal), producing an answer 40 higher than correct.

Example: `27 + 8 = ?`
- Correct: ones 7 + 8 = 15; write 5, carry 1; tens 2 + 1 = 3 → **35**
- Carry-into-ones reversal: ones 7 + 8 = 15; write 1 in ones, carry 5; tens 2 + 5 = 7 → answer: **71**

**Developmental rationale:** The carryable digit is ALWAYS 1 in 2-digit + 1-digit or 2-digit + 2-digit (no-regroup) scenarios because two single digits sum to at most 18 (9+9), and the carried portion is always 1. But children arriving at regrouping for the first time have not yet internalized this constraint. They confuse "which digit of the partial sum gets written" and "which gets carried." Brown and VanLehn (1980) document this as a distinct bug class in their taxonomy. It is less common than SFL or Forgotten-Carry, but it produces dramatically wrong answers (often off by 40–50) and is diagnostic of early procedural confusion rather than place-value confusion.

**Frequency:** Less documented quantitatively than SFL or Borrow-No-Decrement. Classified as a "procedural error" subtype in Lin et al. (2025). Treat as a real but lower-prevalence error pattern that shows up most in the first few sessions of carry instruction.

**Age-typical trajectory:** Typically resolves quickly (within 5–10 sessions) once the child internalizes that the carry is always the "1" and not the larger digit. More easily corrected than SFL because it does not require place-value conceptual reconstruction — just procedural habit correction.

---

## 3. Pedagogical-Fit Assessment for Each Candidate Distractor Class

This section applies the `[[feedback_distractor_class_pedagogical_gates_mechanical]]` framework: pedagogical fit gates mechanical fit. Each class is evaluated on developmental evidence FIRST, mechanical fit second.

---

### Candidate A — "Forgotten-Carry" Distractor (addition, answer minus 10)

For a problem like `27 + 6 = 33`, the forgotten-carry answer is **23** (= correct answer − 10 = child adds ones correctly but forgets the carry).

**Pedagogical fit: STRONG. YES, ship.**

The forgotten-carry error is the most common addition-with-regroup error in the elementary-age literature (Section 2, Error Pattern 2). The distractor directly models a real procedural failure at the working-memory level. Unlike the Wave 3 wrong-operation class (REJECTED for add-to-10 because direction confusion was not a documented error there), the forgotten-carry distractor models a documented error pattern at the exact tier it is proposed for. For Marian specifically: she is a finger counter. The WM load of counting ones + holding carry + counting tens is the highest she has faced. The forgotten-carry distractor will genuinely discriminate between children who have consolidated the carry procedure and those who have not.

Sample distractor expression: `correct_answer - 10`. Always a positive 2-digit number for the problem range in scope (minimum 2-digit answer of ~11, minus 10 = 1; clamp to minimum 1 if needed). Range check: for a problem with answer 33, distractor = 23. For answer 11, distractor = 1 (ones only, technically in range). Clamping at 1 is acceptable — the key is that it represents the specific error, not just a far number.

**Verdict: YES, ship as Class 2 for addition-with-regroup.**

---

### Candidate B — "Smaller-From-Larger" Distractor (subtraction, wrong-column reversal)

For a problem like `43 − 27 = 16`, the SFL answer is the answer you get when you reverse the ones column: ones: 7 − 3 = 4 (instead of 13 − 7 = 6), tens: 4 − 2 = 2 (without borrow decrement) → **24**.

Mechanical expression: `(tens_A - tens_B) * 10 + (ones_B - ones_A)` when `ones_A < ones_B` (the defining condition for a regroup problem).

**Pedagogical fit: STRONG. YES, ship.**

SFL is the most-documented systematic subtraction bug in the elementary literature (Brown & VanLehn, 1980; Jordan et al., 2003 with 31% prevalence in at-risk group; Lin et al., 2025). The asymmetry that makes it valuable as a distractor: SFL only produces a wrong answer when the problem actually REQUIRES borrowing (ones_A < ones_B). When the problem doesn't require borrowing, SFL and correct procedure agree. This means the SFL distractor is exclusively relevant for WITH-regroup problems — exactly Wave 5's scope. It cannot be retroactively applied to Wave 4 (no-regroup) problems because those problems never have ones_A < ones_B by construction. This is the first tier where SFL becomes a viable distractor class.

The SFL distractor will also help the planner detect whether Marian has understood the borrow concept: a child who consistently chooses the SFL distractor on the first 5–10 sessions of Wave 5 is showing the bug documented by Brown and VanLehn. The planner can use this signal (if the session schema records distractor choice) to queue more worked-example sessions before promoting.

**Verdict: YES, ship as Class 2 for subtraction-with-regroup.**

---

### Candidate C — "Borrow-No-Decrement" Distractor (subtraction, correct ones but wrong tens)

For `43 − 27 = 16`, borrow-no-decrement gives: ones 13 − 7 = 6 (correct); tens 4 − 2 = 2 (no decrement) → **26** (correct tens result without the −1 from the borrow).

Mechanical expression: `(tens_A - tens_B) * 10 + (ones_A + 10 - ones_B)`.

**Pedagogical fit: MODERATE. CONDITIONAL ship (P5–P8 only).**

Borrow-No-Decrement is documented as real (Brown & VanLehn, 1980; Jordan et al., 2003, 8–18% prevalence across groups). However, it requires a more advanced procedural state than SFL: the child has to correctly EXECUTE the borrow in the ones column but fail to decrement the tens. This means it only appears in children who are partially through learning borrowing — children at the very beginning (who haven't started borrowing at all) make SFL errors instead. The Borrow-No-Decrement error emerges after a few sessions of borrow instruction, not at the first session.

For Marian's Wave 5 canon design: in the gentle ramp (P1–P3), SFL is the right distractor because she is at the start of borrowing instruction. By the discriminate window (P5–P8), some sessions in, Borrow-No-Decrement is a legitimate additional probe — her most likely procedural state is "borrowing but sometimes forgetting the decrement."

The concern that prevents full ship: if Borrow-No-Decrement and SFL are both present in the same 3-chip display (correct answer, SFL answer, Borrow-No-Decrement answer), the problem is extremely demanding — three distinct arithmetic errors could produce three different wrong answers, and the child has to navigate among them. This is likely too hard for the gentle ramp. Restrict to P5–P8 discriminate window.

**Verdict: CONDITIONAL. Ship as Class 3 for subtraction P5–P8, not P1–P3. Do NOT include in the same problem as SFL (use one or the other per problem, not both as distractors simultaneously).**

---

### Candidate D — Off-By-One (RETAIN, modified for with-regroup)

The standard off-by-one distractor (correct ± 1) is the Wave 1–4 workhorse and remains valid in Wave 5. Finger-counting errors on component facts still occur. The off-by-one targets counting miscounts (e.g., 7 + 6 = 12 instead of 13 on the ones, producing final answer 32 instead of 33 for `27 + 6`).

**Pedagogical fit: STRONG. RETAIN.**

This is unchanged from prior tiers. The main difference in Wave 5: the off-by-one is now computed on the final 2-digit answer, not a single-digit operand. The gentle-ramp (P1–P3) uses off-by-one as the primary distractor because new-problem-type anxiety is high at the start of Wave 5 sessions (math anxiety literature: wrong answers in session-opening problems carry disproportionate arousal cost — Mammarella et al., 2023, cited in `math-distractor-and-streak-decisions.md`).

**Verdict: RETAIN as P1–P3 gentle distractor and P4–P8 fallback.**

---

### Candidate E — Column-Cross (REJECT for Wave 5)

The Wave 4 Class 2 column-cross distractor targets the concatenated-single-digit error (mixing digits across columns: e.g., for `23 + 14`, computing `(2+4)(3+1) = 64`). This error pattern was the primary Wave 4 pedagogical target.

**Pedagogical fit: REJECT for Wave 5 as a primary class.**

Wave 5 ENTRY requires that Marian has demonstrated ≥ 80% column-cross rejection (Wave 4 advancement gate). She has been specifically assessed as not making the concatenated-single-digit error before being promoted. Deploying the column-cross distractor in Wave 5 therefore targets an error she has already demonstrated mastery over. It provides no new diagnostic information. Including it would be mechanically possible but pedagogically motivated by the wrong error model for her current state.

The Wave 3 precedent directly applies here: Class 2 wrong-operation was REJECTED for add-to-10 because it targeted a confirmed non-error for that population. Same logic: column-cross is a confirmed non-error for Wave 5 Marian.

**Verdict: REJECT. Column-cross served its purpose in Wave 4. Do not carry it into Wave 5.**

---

### Candidate F — Phantom-Borrow (carry-forward from Wave 4, RETAIN conditionally)

The phantom-borrow distractor (Wave 4 Class 3 for subtraction) represents the result of applying a borrow procedure to a no-regroup problem (e.g., for `47 − 23 = 24`, incorrectly producing `14` by decrementing the tens). In Wave 5, the concern reverses: Marian now SHOULD be borrowing, so phantom-borrow is no longer an error to test for. However, on problems at the boundary — ones_A just barely ≥ ones_B (e.g., `27 − 5 = 22`, no borrow needed) — there is a risk that Marian over-applies borrowing from her new Wave 5 instruction. This over-generalisation is documented in Springer (2024) as a regrouping-principle over-application.

**Pedagogical fit: LOW PRIORITY for Wave 5. Carry forward only for boundary problems.**

The core Wave 5 instruction is TEACHING Marian to borrow. At this tier, the errors being built are SFL, Borrow-No-Decrement, and Forgotten-Carry — not phantom-borrow. Adding phantom-borrow as a Wave 5 distractor would model the opposite error of what Wave 5 is teaching. This would be confusing pedagogically.

**Verdict: Exclude from Wave 5 distractor pool. The phantom-borrow pattern is relevant only on no-regroup problems in Wave 4. If Kyle includes any no-regroup "control" problems in a mixed-Wave-5 session, phantom-borrow distractors may be included for those specific problems — but not as a general Wave 5 class.**

---

## 4. Recommendation: 2–3 Distractor Classes for Wave 5

### Distractor Table Summary

| Tier | Class | Name | Arithmetic | Example (add): 27+6=33 | Example (sub): 43−27=16 | Pedagogical target |
|---|---|---|---|---|---|---|
| P1–P3 gentle | 0 | Off-by-one | correct ± 1 | 32, 34 | 15, 17 | Session-open calibration; counting miscount |
| P4–P8 add | 1 | Off-by-one | correct ± 1 | 32, 34 | — | Counting miscount in component fact |
| P4–P8 add | **2** | **Forgotten-carry** | `correct − 10` | **23** | — | **WM failure to add carried 1 to tens** |
| P4–P8 sub | 1 | Off-by-one | correct ± 1 | — | 15, 17 | Counting miscount in component fact |
| P4–P8 sub | **2** | **Smaller-From-Larger** | `(tens_A−tens_B)×10 + (ones_B−ones_A)` | — | **24** | **Borrow avoidance — column reversal** |
| P5–P8 sub only | **3** | **Borrow-No-Decrement** | `(tens_A−tens_B)×10 + (ones_A+10−ones_B)` | — | **26** | **Partial borrow — missing decrement step** |

### Class 2 Addition (Forgotten-Carry) — full spec

- **Pool size (back-of-envelope):** For all problems with 2-digit answer in [21, 99], `correct − 10` is always in [11, 89] — fully in range. No clamping issues for the expected fact pool. Kevin should verify exact range fitness against the full Wave 5 addition fact pool. Pool coverage: 100% of all Wave 5 addition problems (any problem with ones_A + ones_B ≥ 10 will always have `correct − 10 ≥ ones_A + ones_B − 10 ≥ 0`, and the minimum answer in the pool should be ≥ 21 for 2D+1D with-regroup problems, so `correct − 10 ≥ 11`).
- **Pedagogical hook:** Directly targets the documented WM failure to execute the carry step. If Marian consistently chooses `correct − 10` for add-with-regroup problems, this tells the planner she is computing the ones column correctly but dropping the carry. This is precisely the most actionable diagnostic signal for Wave 5 addition: Emma's hint can say "Did you add the one you carried?" to directly address the error.
- **Why this and not column-cross:** Column-cross (REJECTED above, Candidate E) targets an error Marian has already cleared per Wave 4 advancement gate. Forgotten-carry targets the error she is most likely to make NOW — working-memory failure specific to the NEW procedural step in Wave 5.

### Class 2 Subtraction (Smaller-From-Larger) — full spec

- **Pool size:** For all Wave 5 subtraction problems where ones_A < ones_B (defining condition for borrow-needed), `(tens_A−tens_B)×10 + (ones_B−ones_A)` is always a positive 2-digit number (given the problem range constraints). Example: 43−27: SFL = (4−2)×10 + (7−3) = 24. Always distinct from the correct answer (16) and from off-by-one (15, 17). Kevin should verify no collision with off-by-one distractor in the full pool.
- **Pedagogical hook:** SFL is the most documented subtraction-with-regroup error in the literature. A child making SFL errors is demonstrating that they have not yet internalised the borrow concept: they are resolving the "can't subtract" impasse by reversing the column instead of borrowing. The SFL distractor is the earliest and most diagnostic signal for whether Wave 5 instruction has taken hold.
- **Why this and not phantom-borrow:** Phantom-borrow (REJECTED, Candidate F) targets a no-regroup over-application error. Wave 5 is specifically teaching borrow — the distractor design should diagnose under-application (SFL) not over-application (phantom-borrow).

### Class 3 Subtraction (Borrow-No-Decrement) — conditional spec

- **Pool size:** `(tens_A−tens_B)×10 + (ones_A+10−ones_B)` is always exactly 10 more than the correct answer (the decrement that was skipped). Example: 43−27: BND = 26 = correct 16 + 10. This means BND is always off-by-10 from correct in the upward direction. Kevin should verify this does not collide with off-by-one or SFL in the full pool (for most problems it will be distinct from all of them).
- **Pedagogical hook:** Borrow-No-Decrement is documented at 8–18% prevalence (Jordan et al., 2003). It is the partial-execution error: ones column is right, tens column is wrong. Unlike SFL (whole procedure is wrong) or Forgotten-Carry (the ADDITION side analogue), BND targets the transition from "I can borrow" to "I know borrow has two steps." This is the right distractor to add at P5–P8 once Marian has had a few sessions of borrow instruction and is partially correct.
- **Deploy sequence:** P5–P8 only; introduce after Marian has completed ≥ 3 Wave 5 sessions (i.e., is past the very first encounters). The planner directive should specify that BND does not appear in the first 3 sessions of the tier (the equivalent of the gentle-ramp logic, applied at the tier level, not the session level).
- **One-distractor rule:** Do NOT include both SFL (Class 2) and BND (Class 3) as the two wrong options in the same problem. This would require Marian to simultaneously evaluate three procedurally distinct computations. Use one or the other per problem.

---

## 5. Cross-References

### Citations (real, peer-reviewed)

1. **Brown, J.S., & VanLehn, K. (1980). "Repair Theory: A Generative Theory of Bugs in Procedural Skills." Cognitive Science, 4(4), 379–426.** [https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0404_3](https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0404_3) — Strong evidence. Foundational taxonomy of systematic bugs in multi-digit subtraction derived from thousands of child solutions. Source for SFL, Borrow-No-Decrement, Carry-Into-Ones, and the Repair Theory framework (impasses produce locally plausible but globally wrong procedures). Independently replicated across dozens of follow-on studies.

2. **Jordan, N.C., Hanich, L.B., & Kaplan, D. (2003). "Arithmetic Fact Mastery in Young Children: A Longitudinal Investigation." Journal of Experimental Child Psychology, 85(2), 103–119. PMC: [https://pmc.ncbi.nlm.nih.gov/articles/PMC2788949/](https://pmc.ncbi.nlm.nih.gov/articles/PMC2788949/)** — Moderate-to-Strong evidence (291 children, controlled design, grades 3–4). Frequency data for SFL (31% in at-risk group, 9% controls), Borrow-No-Decrement (8–18%), Borrow-Across-Zero (20% at-risk, 6–7% controls). Addition bugs rare overall (5%) but carry-specific errors much higher. Critical source for error prevalence.

3. **Lin, T.-H., Riccomini, P.J., & Liang, Z. (2025). "Mathematical Error Patterns of Students With Mathematics Difficulty: A Systematic Review." Learning Disability Quarterly. SAGE.** [https://journals.sagepub.com/doi/10.1177/07319487241310873](https://journals.sagepub.com/doi/10.1177/07319487241310873) — Moderate evidence (systematic review of 17 studies; focused on math difficulty population). Confirms "subtracted smaller integer" (SFL) and "regrouping error" (Borrow-No-Decrement, Forgotten-Carry) as among the three most frequent computation error categories. Updated 2025 synthesis.

4. **Fuson, K.C. (1990). "Conceptual structures for multiunit numbers: Implications for learning and teaching multidigit addition, subtraction, and place value." Cognition and Instruction, 7(4), 343–403.** [https://www.tandfonline.com/doi/abs/10.1207/s1532690xci0704_4](https://www.tandfonline.com/doi/abs/10.1207/s1532690xci0704_4) — Strong evidence. The foundational paper on children's understanding of multi-digit numbers, including the concatenated-single-digit to tens-and-ones developmental trajectory. Establishes why SFL and BND occur at the conceptual level: children who lack the "exchange" model of regrouping treat the borrow as disconnected from place value.

5. **Moeller, K., Pixner, S., Zuber, J., Kaufmann, L., & Nuerk, H.-C. (2011). "Early place-value understanding as a precursor for later arithmetic performance — a longitudinal study on numerical development." Research in Developmental Disabilities, 32(5), 1837–1851. PubMed: [https://pubmed.ncbi.nlm.nih.gov/21498043/](https://pubmed.ncbi.nlm.nih.gov/21498043/)** — Strong evidence (longitudinal; N=94 children from grade 1 to grade 3). Demonstrates that first-grade place-value understanding reliably predicts third-grade arithmetic performance including regrouping operations. The most important implication for Marian: her Wave 4 promotion gate (≥ 80% Class-2-rejection) is a place-value understanding signal — passing it is a good predictor of ability to learn Wave 5 regrouping correctly.

6. **Geary, D.C. (2004). "Mathematics and Learning Disabilities." Journal of Learning Disabilities, 37(1), 4–15. SAGE.** [https://journals.sagepub.com/doi/10.1177/00222194040370010201](https://journals.sagepub.com/doi/10.1177/00222194040370010201) — Strong evidence (authoritative review; widely cited). Documents that WM load in multi-step procedures (including carry and borrow) causes procedural failure specifically in children who lack automaticity in component facts. For finger-reliant children, the WM cost of counting the ones sum leaves less capacity for the carry/borrow bookkeeping step — mechanistic basis for Forgotten-Carry.

### Wave 3 precedents this builds on

- **Class 2 wrong-operation REJECTED for add-to-10** (PR #251 §3.2) — because addition-direction confusion is not a documented 7–9yo error for add-to-10. The same logic is applied here: Candidate E column-cross is REJECTED for Wave 5 because column-cross errors have been cleared by the Wave 4 advancement gate.
- **Class 3 answer-equals-operand REJECTED for add-to-10** (PR #254 audit) — not a stable error pattern at that tier. The SFL distractor in Wave 5 is specifically NOT in this category: SFL is documented as the dominant systematic error at the with-regroup subtraction tier, not merely a mechanically-possible wrong answer.
- **Zero-addend WIDEN REJECTED** (PR #254 audit) — widening a pool that is already covered by a mechanically-sufficient class without pedagogical justification. Applied here: Candidate F (phantom-borrow) is REJECTED because it targets an error Marian is NOT making in Wave 5 — she is in the process of learning to borrow, not over-applying borrow.

### Sibling tiers (Wave 4 patterns to reuse)

- **Class 3 (phantom-borrow) from Wave 4:** NOT carried into Wave 5 (see Candidate F, REJECTED).
- **Class 2 (column-cross) from Wave 4:** NOT carried into Wave 5 (see Candidate E, REJECTED).
- **Off-by-one (P1–P3 gentle ramp):** RETAINED unchanged. The gentle ramp logic from `math-distractor-and-streak-decisions.md` applies: problems 1–3 use only off-by-one distractors (well-spaced, not tight conceptual traps) to allow Marian to calibrate her session before carrying-difficulty problems begin.
- **"Never a red X" invariant:** RETAINED. Emma's character reaction on wrong answers uses puzzled-tilt pose regardless of which distractor was tapped. The distractor-choice signal (if the session schema records it) goes to the backend planner only, not to Marian.

---

## Risks and Counter-Evidence

1. **SFL frequency data (Jordan et al., 2003) comes from grades 3–4 (ages 9–10), not Marian's exact age of 8.** The 31% figure is from children already one year past first-borrowing instruction. Marian at the START of Wave 5 may be at higher or lower risk depending on how much borrowing exposure she has had. Treat the Jordan frequency as an order-of-magnitude guide, not an exact prediction.

2. **The carry-specific addition error frequency (34.29% of addition errors are carry-related) comes from a large Indian sample (grades 4–5 paper-pencil study).** This is not a Western/Tagalog-context RCT. The carry-error rate may differ. That said, the mechanisms (WM load, procedural consolidation) are culturally universal; only the exact frequency is uncertain.

3. **Marian's Tagalog number-word structure.** As established in `two-digit-addsub-error-patterns.md` (Sources 8–9), Tagalog number words are MORE transparent for place-value (dalawampu't tatlo = "twenty-and-three"). This mild protective factor may reduce SFL and BND rates compared to English-primary children. It does not eliminate them — but it is a reason not to over-scaffold.

4. **The distractor-choice detection gap.** The Jordan et al. data is derived from written-format subtraction problems where the child's computed answer is inspected. In Marian's 3-chip tap format, the session can only detect whether she tapped the correct answer or a wrong one. Which specific wrong answer she taps is diagnostic only if the session schema records distractor choice (the schema-extension PR from Wave 4, Kevin Wave 1b). Without that extension, the SFL and BND distractors are in the display but their diagnostic value is lost. This schema dependency needs to carry forward into Wave 5 — it is not optional.

---

## Recommendations Summary

### For Matt (ticket priority / scope)

1. **Schema-extension dependency:** Wave 5 distractor pedagogy is only useful if session results record which distractor was tapped. The Wave 4 schema-extension PR (Kevin Wave 1b, `MathSessionResult.perProblemDistractorClass`) must land before Wave 5 canon is baked. This is a hard sequencing constraint.

2. **Wave 5 distractor arithmetic:** Devon's `distractors.ts` will need two new computations for the with-regroup tier:
   - `forgottenCarry(correct)` = `correct - 10` (addition only; always in range for the expected fact pool)
   - `smallerFromLarger(tensA, onesA, tensB, onesB)` = `(tensA - tensB) * 10 + (onesB - onesA)` (subtraction only, only when onesA < onesB)
   - `borrowNoDecrement(tensA, onesA, tensB, onesB)` = `(tensA - tensB) * 10 + (onesA + 10 - onesB)` (subtraction P5–P8, same condition as SFL)

   These are all deterministic functions of the problem operands, following the established `distractors.ts` pattern. Kevin/Devon can implement.

3. **Gentle-ramp extension at tier level:** In addition to the per-session P1–P3 gentle ramp, the WITH-regroup tier is conceptually new enough that the first 3 sessions of Wave 5 should not include BND (Class 3 subtraction). The planner directive should specify "no BND in first 3 sessions" as a tier-level constraint, analogous to how the `sub-to-10` research note recommended raising the slow-fact latency threshold for the first 10 sessions.

### For Kyle (spec changes)

1. **Two distractor classes for addition-with-regroup:** Off-by-one (P1–P3 gentle, P4–P8 fallback) + Forgotten-Carry (P4–P8 primary). No column-cross carry-forward.

2. **Three distractor classes for subtraction-with-regroup:** Off-by-one (P1–P3 + P4–P8 fallback) + Smaller-From-Larger (P4–P8 primary) + Borrow-No-Decrement (P5–P8 conditional, one-distractor rule: never co-present with SFL in the same problem).

3. **Emma's hint copy:** The hint utterances for Wave 5 should specifically address the two most common errors:
   - For addition: "Did you add the little one you carried?" (Forgotten-Carry targeted)
   - For subtraction: "Look — can you take seven from three? You need to borrow!" (SFL targeted — redirect before the reversal, not after)

4. **TTS read-utterance:** All carry-and-borrow logic is in the chip computation — the TTS read-utterance says the full quantity name ("twenty-seven plus six, how many?"), same as Wave 4's prohibition on digit-by-digit reading. No change needed here beyond enforcing the existing Wave 4 convention.
