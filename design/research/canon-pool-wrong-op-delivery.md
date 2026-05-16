# Sub-to-10 canon — wrong-op delivery research

**Requested by:** Matt (via orchestrator), routing Kevin NOF #2 from PR #241 review
**Date:** 2026-05-16
**Prerequisite reading:** `design/research/sub-to-10-fact-sequencing-marian.md` (Dave, 2026-05-15) — original distractor rationale and pool ordering. `design/math/sub-to-10-content.md` §3.2 — wrong-op spec and OOR fallback rule.

---

## Problem

Kyle's spec (`design/math/sub-to-10-content.md` §2.2) requires that at least 2 of the 5 discriminate problems (P4–P8) carry an in-range wrong-op trap distractor — i.e., that `minuend + subtrahend ≤ 10` so the addition answer is a valid chip value. Kevin's NOF #2 in PR #241 (Devon's render review) found that the shipped sub-to-10 canon delivers this constraint for only 1 of 5 discriminate problems: `9-1=8` at P5, whose wrong-op trap is `9+1=10` (boundary in-range). All other four discriminate facts have wrong-op values above 10 and silently degrade to off-by-one. The spec requirement of ≥2/5 is therefore met at most once per canon session, not at least twice. This note audits why and recommends the smallest pool addition that reliably lifts delivery to ≥2/5.

---

## Pool audit (current 16 facts)

For each fact `a - b = c`, the wrong-op trap is `a + b`. For the trap to be usable, two conditions must hold:

1. `a + b ≤ 10` (within the sub-to-10 chip ceiling of 10), AND
2. `a + b ≠ c` (trap does not alias the correct answer — the subtract-zero case).

The current 16-fact pool, as specified in `_planner.ts:930–946`:

| #   | Fact   | Band/Category       | a+b | In-range?      | Usable as wrong-op?                                                                                                |
| --- | ------ | ------------------- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | 5-5=0  | EASY/subtract-self  | 10  | YES (boundary) | YES — trap=10, correct=0. In-range and no alias. But EASY band → only eligible for P1-P3 (gentle ramp), not P4-P8. |
| 2   | 8-8=0  | EASY/subtract-self  | 16  | NO             | NO — OOR                                                                                                           |
| 3   | 7-0=7  | EASY/subtract-zero  | 7   | YES            | NO — alias (trap=7=correct)                                                                                        |
| 4   | 9-0=9  | EASY/subtract-zero  | 9   | YES            | NO — alias (trap=9=correct)                                                                                        |
| 5   | 10-5=5 | EASY/doubles        | 15  | NO             | NO — OOR                                                                                                           |
| 6   | 8-4=4  | EASY/doubles        | 12  | NO             | NO — OOR                                                                                                           |
| 7   | 6-3=3  | EASY/doubles        | 9   | YES            | YES — trap=9, correct=3. Usable. But EASY band → eligible for P1-P3 only per composition rules.                    |
| 8   | 9-1=8  | EASY/subtract-one   | 10  | YES (boundary) | YES — trap=10, correct=8. Usable. But EASY band → eligible for P1-P3 only.                                         |
| 9   | 10-1=9 | MEDIUM/subtract-one | 11  | NO             | NO — OOR                                                                                                           |
| 10  | 10-2=8 | MEDIUM/subtract-two | 12  | NO             | NO — OOR                                                                                                           |
| 11  | 10-3=7 | MEDIUM/take-from-10 | 13  | NO             | NO — OOR                                                                                                           |
| 12  | 10-7=3 | MEDIUM/take-from-10 | 17  | NO             | NO — OOR                                                                                                           |
| 13  | 9-4=5  | HARD/general        | 13  | NO             | NO — OOR                                                                                                           |
| 14  | 8-3=5  | HARD/general        | 11  | NO             | NO — OOR                                                                                                           |
| 15  | 7-4=3  | HARD/general        | 11  | NO             | NO — OOR                                                                                                           |
| 16  | 9-6=3  | HARD/general        | 15  | NO             | NO — OOR                                                                                                           |

**Summary:**

- Facts with usable in-range wrong-op: #7 (6-3=3), #8 (9-1=8), and borderline #1 (5-5=0).
- All three are EASY-band facts — eligible for P1–P3 only under the session composition rules.
- All MEDIUM-band facts and all HARD-band facts have `a + b ≥ 11`, putting the wrong-op trap outside the chip ceiling of 10.
- The structural cause is arithmetic: any fact with `a ≥ 5` and `b ≥ 1` that sums to `a - b ∈ [0, 9]` will tend to produce `a + b` that exceeds 10, because the relationship `a + b = (a - b) + 2b` grows with `b`. For the MEDIUM take-from-10 facts (a=10, b=1..7), `a + b` is always 11–17.

**Why Haiku placed 9-1=8 in P5:** The directive's composition rule 3 says P4-P8 draw from MEDIUM + HARD bands, with HARD-band only at P5 or later. However, `9-1=8` is EASY-band. The canon Haiku produced placed it at P5, which violates rule 3 (EASY band in a discriminate slot). This is a Haiku compliance failure, not a render failure. It happened to be the only case where a wrong-op trap fired in-range. Under a strictly compliant session, all five discriminate facts would be MEDIUM or HARD, and wrong-op delivery would be 0/5.

---

## Pool-widening candidates

The constraint for a usable wrong-op trap is: `a + b ≤ 10` AND `a + b ≠ c` (no alias). For subtraction `a - b = c`, this means `2b ≤ 10 - c`, i.e., the subtrahend must be small relative to the answer. The most tractable candidates are small-subtrahend facts (b=1 or b=2) with moderate minuends.

**Candidate analysis (MEDIUM/HARD eligible):**

### Candidate 1 — `8-1=7` (proposed MEDIUM/subtract-one)

- Wrong-op trap: `8+1=9`. In range (≤10), no alias (9≠7). Usable.
- Pedagogical fit: extends the subtract-one chain (`10-1=9`, `9-1=8` → `8-1=7`). Baroody (2006) identifies subtract-one as the easiest non-rule fact category — count-back-one step. Marian can execute this with one finger extension removed. Not a cognitive leap from the existing pool entries.
- Wrong-op pedagogical value: Marian would see `{7, 8, 9}` chips (correct=7, trap=9, secondary=8 off-by-one). The trap `9` is meaningfully wrong (adds instead of subtracts) and distinct from the off-by-one `8`. Clean discriminate problem.
- Developmental risk: none above baseline. Subtract-one facts are the most reliably correct category for 8-year-olds (Robinson et al., 2013).
- Band assignment: MEDIUM (same category and difficulty level as `10-1=9`). HARD-band placement at P5+ not required; can occupy P4.

### Candidate 2 — `7-1=6` (proposed MEDIUM/subtract-one)

- Wrong-op trap: `7+1=8`. In range, no alias (8≠6). Usable.
- Pedagogical fit: same subtract-one category. `a+b=8` gives a trap that is clearly above the correct answer, reinforcing the take-away direction.
- Wrong-op pedagogical value: chips `{5, 6, 8}` or `{6, 7, 8}` depending on secondary — clean three-way separation.
- Developmental risk: none. Category and difficulty equivalent to `8-1=7`.
- Band assignment: MEDIUM/subtract-one. (Note: the subtract-one category cap is "at most one subtract-one per session." Adding `7-1=6` and `8-1=7` to the pool does not violate this cap — only one of the three subtract-one facts can appear per session. The cap is a session-composition constraint, not a pool-membership constraint.)

### Candidate 3 — `8-2=6` (proposed MEDIUM/subtract-two)

- Wrong-op trap: `8+2=10`. In range (boundary), no alias (10≠6). Usable.
- Pedagogical fit: extends the subtract-two category (currently only `10-2=8`). Count-back-two steps; manageable with two fingers. Baroody (2006) groups subtract-two with subtract-one as "near-doubles/small-subtrahend" — easier than general facts.
- Wrong-op pedagogical value: trap=10 is a meaningful "makes ten" lure — Marian's very familiar number from add-to-10. A child who adds instead of subtracts lands confidently on 10. The contrast with the correct answer (6) is large (4 apart), making the discriminate signal strong.
- Developmental risk: low. The subtract-two category is already represented by `10-2=8`; adding a second subtract-two fact with a different minuend does not change the conceptual demand.
- Band assignment: MEDIUM/subtract-two. Category cap allows at most one subtract-two per session — adding `8-2=6` grows the pool but does not change that cap.

### Candidate 4 — `6-2=4` (proposed MEDIUM/subtract-two)

- Wrong-op trap: `6+2=8`. In range (8≤10), no alias (8≠4). Usable.
- Pedagogical fit: another subtract-two fact. `a+b=8` — a familiar anchor from add-to-10. Correct answer 4 is the mid-range; off-by-one secondary would be 3 or 5.
- Wrong-op pedagogical value: chips `{3, 4, 8}` — the 4-apart gap between correct and trap is strong. Marian would need to actively distinguish subtract from add.
- Developmental risk: low.
- Band assignment: MEDIUM/subtract-two. Lower difficulty than `8-2=6` due to smaller minuend; reasonable as a P4 candidate.

### Candidate 5 — `5-2=3` (proposed MEDIUM/subtract-two)

- Wrong-op trap: `5+2=7`. In range (7≤10), no alias (7≠3). Usable.
- Pedagogical fit: smallest minuend in the subtract-two group. Easiest count-back-two fact. Useful as a warm-up difficulty-level bridge if Marian's recent-score is low.
- Wrong-op pedagogical value: trap=7, correct=3 — a 4-apart separation.
- Developmental risk: very low. Fact is straightforward.
- Band assignment: MEDIUM/subtract-two (or EASY if preferred; difficulty is comparable to the EASY subtract-one facts).

**Not recommended:**

- `4-1=3`, `3-1=2`, `2-1=1` — wrong-op traps of 5, 4, 3 respectively. All in-range, no alias. Pedagogically fine but the facts are trivially easy (single-step count-back on tiny numbers). They would not appear in MEDIUM or HARD discriminate slots without inflating the EASY band or changing band assignments. Adding very easy facts to the MEDIUM band risks under-challenging Marian's target zone. Defer.
- `4-2=2` — wrong-op trap = 6. In range, no alias. Would work. Similar concern: small minuend may feel too easy for discriminate slots at Marian's level.

---

## Trade-offs

- **Session-composition cap compatibility.** Adding candidates 1–5 does not break any existing category cap. The subtract-one cap ("at most one per session") applies to the entire category across the pool — `9-1=8`, `10-1=9`, `8-1=7`, and `7-1=6` would all compete for one slot. Similarly the subtract-two cap allows at most one per session regardless of how many subtract-two facts are in the pool. The additional facts grow selection diversity without changing per-session counts.

- **Pool size and Haiku variance.** Growing the MEDIUM band from 4 facts to 7–9 facts increases Haiku's selection surface. The directive's absolute caps (at most one of each category per session, at most two take-from-10, at most two general) keep the session structure stable. Haiku variance goes up slightly, but cap rules are absolute — this is not a proportional problem.

- **Spec drift.** The 16-fact pool is currently listed verbatim in `design/math/sub-to-10-content.md` §1.1 and pinned by the `_planner.test.ts` pool-membership test. Any widening requires (a) Kyle to update the spec table, (b) Kevin to update the directive, (c) a canon re-bake, and (d) an update to the pool-membership test. This is the standard content-tier spec-update workflow — not novel overhead.

- **Wrong-op delivery guarantee vs. Haiku compliance.** Even with new pool entries, the ≥2/5 wrong-op delivery guarantee depends on Haiku selecting at least 2 in-range wrong-op facts for P4-P8 in each session. The directive already instructs Haiku to respect this ("At least 2 of the 5 problems P4-P8 MUST be tagged 'wrong-op'"). Pool expansion makes compliance structurally easier — currently MEDIUM and HARD bands have zero in-range wrong-op facts, so the directive's ≥2 instruction is impossible to honor without pulling EASY band facts into discriminate slots (as the shipped canon accidentally did). With candidates 1–3 in the pool, Haiku has at least 3 MEDIUM-band in-range wrong-op candidates for P4-P8 slots.

- **No change to `distractors.ts`.** The render-layer fallback logic (OOR → off-by-one downgrade) is correct and stays unchanged. The fix is purely at the data layer.

---

## Recommendation

Add the following 3 facts to the pool, in priority order:

**1. `8-1=7` [MEDIUM/subtract-one]**
Wrong-op trap = 9. In-range, no alias. The subtract-one category is Marian's most reliable fact type — she will succeed on this fact, which means the discriminate question becomes purely about which chip she selects. A confident child who adds instead of subtracts will land on 9; a careful child lands on 7. The pedagogical signal is clean. Category cap already exists (one subtract-one per session); this fact joins `9-1=8` and `10-1=9` competing for that one slot.

**2. `8-2=6` [MEDIUM/subtract-two]**
Wrong-op trap = 10. The "makes ten" lure is the highest-salience wrong-op distractor in the pool — 10 is deeply familiar from add-to-10. A child who adds will feel confident picking 10. Strong discriminate signal, moderate difficulty.

**3. `6-2=4` [MEDIUM/subtract-two]**
Wrong-op trap = 8. Trap is in the common range, distinct from correct by 4. Provides a second subtract-two option below `8-2=6` in difficulty — useful when recent-score is mid-range and Haiku needs a MEDIUM fact with in-range wrong-op that isn't anchored to 10.

These three additions create a MEDIUM band with 7 facts total: 2 subtract-one, 3 subtract-two, 2 take-from-10. Of those 7, four have usable in-range wrong-op traps (`8-1=7`, `8-2=6`, `6-2=4`, plus `10-1=9` has OOR trap=11, so actually 3 usable). Combined with `6-3=3` in the EASY band (accessible for low-recent-score sessions that bias toward easy), and the directive's ≥2 instruction, the canon re-bake should reliably produce ≥2 in-range wrong-op facts in the discriminate band without relying on Haiku pulling EASY-band facts into P4-P8.

**Optional fourth addition:** `7-1=6` [MEDIUM/subtract-one], wrong-op trap=8. In-range, no alias. Adds variety to the subtract-one category. Lower priority than candidates 1–3; add if Kyle wants a larger selection surface in the subtract-one subcategory.

**Do not add:** `5-2=3`, `4-1=3`, `3-1=2` — not worth the spec overhead at this stage. Facts are easy enough that they would only appear under low-recent-score bias, where EASY band is already available.

---

## Citations

- Baroody, A.J. (2006). "Why Children Have Difficulties Mastering the Basic Number Combinations and How to Help Them." Teaching Children Mathematics, 13(1), 22–32. NCTM. https://pubs.nctm.org/view/journals/tcm/13/1/article-p22.xml — three-tier difficulty ordering for subtraction (rule-governed, near-doubles/small-subtrahend, general). Strong evidence; foundational. Cited in `sub-to-10-fact-sequencing-marian.md`.

- Robinson, K.M. et al. (2013). "Young children's use of derived fact strategies for addition and subtraction." Frontiers in Human Neuroscience, 7, 924. https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2013.00924/full — subtract-one is the most reliably correct category; neighbor errors (wrong-direction-of-compensation) are common for general facts. Strong evidence. Cited in `sub-to-10-fact-sequencing-marian.md`.

- Gilmore, C.K., & Spelke, E.S. (2008). "Children's understanding of the relationship between addition and subtraction." Cognition, 107(3), 932–945. https://pmc.ncbi.nlm.nih.gov/articles/PMC2705957/ — inverse principle not automatic; subtraction and addition stored somewhat separately. Strong evidence. Cited in `sub-to-10-fact-sequencing-marian.md`.

- McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. https://pubmed.ncbi.nlm.nih.gov/40297988/ — deliberate interleaving of addition and subtraction once both are conceptually established; fact-family exposure consolidates retrieval. Strong evidence (meta-analysis). Cited in `sub-to-10-fact-sequencing-marian.md`.

- Marian's April 2026 diagnostic: subtraction within 15 confident; `add-to-10` at ~80% accuracy with full finger reliance. Context for pool difficulty calibration.

- Kevin NOF #2, PR #241 review (`MarianLearning/.tmp/pr241-kevin-verdict.md`): empirical finding that only `9-1=8` (P5) produces an in-range wrong-op trap in the shipped canon; all other discriminate facts degrade to off-by-one.
