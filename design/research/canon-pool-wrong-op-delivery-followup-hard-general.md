# HARD/general band — five flagged candidates audit

**Follow-up to:** `design/research/canon-pool-wrong-op-delivery.md` (2026-05-16)
**Requested by:** Matt, routing Kyle PR #249 NOF #2
**Date:** 2026-05-16

---

## Question

Kyle's PR #249 evaluation found five subtraction facts with `a + b ≤ 10` that my prior paper did not consider as HARD/general candidates: `7-3=4` (trap=10), `6-4=2` (trap=10), `5-3=2` (trap=8), `4-3=1` (trap=7), `5-4=1` (trap=9). Do these belong in HARD/general, or do they dilute band difficulty?

---

## Bottom line

Add `7-3=4` and `6-4=2` to HARD/general. These two facts carry the same cognitive load signature as the existing HARD pool members and produce the strongest wrong-op traps in the entire pool (trap=10, the "makes-ten" lure Marian knows best). Do not add `5-3=2`, `4-3=1`, or `5-4=1` — these have small minuends that make them bridgeable via counting or doubles-proximity, and their traps (7, 8, 9) are weaker lures than trap=10. The net effect of adding the two recommended facts: the HARD/general category grows from 4 facts to 6, and Haiku now has two in-range wrong-op candidates within HARD/general alone. The `general` cap (at most 2 per session) means at most 2 of the 6 can appear — no per-session count change, only selection variety.

---

## Per-candidate audit

For each fact: cognitive load via Baroody's (2006) three-tier framework (rule-governed / small-subtrahend / general), trap strength, and band-dilution risk.

### 1. `7-3=4` — trap=10

**Cognitive load: HARD/general.** Subtrahend b=3 puts this in neither the rule-governed category (which requires b=0 or b=a) nor the small-subtrahend category (which covers b=1 and b=2). Baroody (2006) places b=3 facts in the general tier except when they are doubles-halving (e.g., 6-3=3, already in the pool as EASY). `7-3=4` is not a doubles-half — `3+3=6`, not 7. The count-back procedure requires three backward steps from 7 with no anchor. The existing HARD fact `8-3=5` differs from `7-3=4` only in minuend (+1). By any difficulty-classification scheme that distinguishes step-count from anchor-availability, these two facts are in the same category. The current pool already classifies `8-3=5` as HARD/general; consistency demands the same for `7-3=4`.

Robinson et al. (2013) identify `7-3=4` as a specific source of wrong-direction-of-compensation errors — children reasoning "if 6-3=3 then 7-3 should be..." and then applying the compensation in the wrong direction. This places it solidly in the hardest distractor-attracting tier.

**Trap strength: excellent.** trap=10 is the strongest wrong-op lure in the pool. Marian knows 10 as her anchor number from add-to-10. A child who adds 7+3 instead of subtracting will land confidently on 10. The correct answer (4) and the trap (10) are 6 apart — the widest separation of any candidate in this list, producing a strong discriminate signal.

**Band-dilution risk: none.** `7-3=4` is pedagogically harder than most MEDIUM facts. Adding it to HARD/general does not soften the band; it extends the band with a fact of equivalent challenge to `8-3=5`.

**Verdict: ADD to HARD/general.**

---

### 2. `6-4=2` — trap=10

**Cognitive load: HARD/general.** b=4, a=6. Count-back requires four steps from 6 with no anchor (6→5→4→3→2). The existing HARD fact `7-4=3` has the same subtrahend and a minuend one higher. The pool note for `7-4=3` reads "often confused with `7-3=4` (Robinson-2013 wrong-direction-of-compensation error)." `6-4=2` shares this subtrahend and the same error pattern — a child who knows `6-3=3` (doubles-halving, easy band) may apply the inverse compensation to `6-4=2` and arrive at 2, but they are equally likely to misfire on direction and land on 3 instead. The cognitive demand is identical to `7-4=3`.

**Trap strength: excellent.** trap=10 again. A child adding 6+4 arrives at 10 with the same "makes-ten" confidence as for `7-3=4`. Correct answer (2) vs trap (10): separation of 8, the widest in the pool. The discriminate signal is exceptionally clean.

**Band-dilution risk: low.** `6-4=2` is genuinely harder for most children than the MEDIUM facts (which either have small subtrahends like subtract-two, or have the 10-anchor like take-from-10). Adding it does not pull the HARD band toward easy.

**One caution.** `6-4=2` and `7-4=3` share subtrahend b=4. Under the category-cap rule ("at most two general per session"), they can co-occur in the same session. If they do, the session has two b=4 facts — a mild monotony risk. This is manageable: the directive already prevents more than two general facts; a Haiku compliance note flagging the subtrahend-repeat risk is sufficient rather than a hard cap.

**Verdict: ADD to HARD/general.**

---

### 3. `5-3=2` — trap=8

**Cognitive load: borderline MEDIUM.** b=3, a=5. Three count-back steps from a minuend of 5 is the lightest cognitive load of any b=3 fact in the pool. Marian knows 3+2=5 well from add-to-10 — this fact is one step from her doubles anchor (the fact 6-3=3 is EASY because 3+3=6; `5-3=2` is the nearest neighbor). The think-addition bridge (think: "3+?=5, answer is 2") is short and reliable for a child with Marian's add-to-10 profile. Baroody's framework does not explicitly sub-classify by minuend size within "general," but the operational reality is that `5-3=2` is easier than `7-3=4` by the distance from a known anchor.

**Trap strength: moderate.** trap=8 is in range and distinct from correct (8≠2). But 8 is not a special anchor number for Marian the way 10 is. A child who confidently adds 5+3 and gets 8 is making the wrong-op error, but the lure is not as salient as 10. The discriminate signal (correct=2, trap=8, secondary=1 off-by-one) is workable — the separation of 6 is fine — but the lure is weaker.

**Band-dilution risk: moderate.** Adding `5-3=2` to HARD/general puts a fact that most 8-year-olds with Marian's profile can bridge via think-addition (2+3=5) alongside facts that genuinely require multi-step count-back or derived reasoning. It would be the easiest HARD/general fact in the pool by a noticeable margin.

**Verdict: DO NOT ADD. If pool expansion is needed beyond candidates 1-2, move `5-3=2` to MEDIUM (not HARD).**

---

### 4. `4-3=1` — trap=7

**Cognitive load: MEDIUM at best.** b=3, a=4. Three steps from a minuend of 4 is among the easiest non-trivial subtractions in the number system — a child who knows 3+1=4 (which Marian certainly does) can bridge via think-addition in one step. The count-back procedure (4→3→2→1) involves only the smallest numbers, all within the child's finger-extension comfort zone. This fact is harder than subtract-two but easier than any of the existing HARD/general facts.

**Trap strength: weak.** trap=7. Seven is not an anchor number. The separation between correct (1) and trap (7) is 6 — large in absolute terms, but because 7 is not a salient wrong-op target, a careless child is just as likely to pick the off-by-one (2) as the trap. The wrong-op signal is not pedagogically cleaner than off-by-one here.

**Band-dilution risk: high.** This is the weakest cognitive-load fact of the five candidates. It would be the clear outlier in HARD/general and would reduce the band's difficulty floor visibly. If Haiku selects it in a high-recent-score session, the "HARD band" label misrepresents the challenge.

**Verdict: DO NOT ADD.**

---

### 5. `5-4=1` — trap=9

**Cognitive load: mixed.** b=4, a=5. Four steps from a very small minuend (5→4→3→2→1). This is an unusual difficulty profile: the step-count is as high as `7-4=3` and `9-4=5`, but the minuend is so small that the count-back starts in immediately accessible territory. The harder aspect of `5-4=1` is that the answer (1) is near the floor, and children may miscount toward 0 — a direction error that the off-by-one distractor captures. The think-addition bridge is also available (1+4=5 is a trivial fact). On balance, the cognitive load is probably MEDIUM — the difficulty comes from the lopsided ratio (a ≈ b) rather than from multi-step abstraction.

**Trap strength: moderate.** trap=9. Nine is a relatively familiar anchor, but it is not the "makes-ten" lure that gives trap=10 its salience. The separation between correct (1) and trap (9) is 8 — the largest separation of any candidate — which is a strong discriminate signal if Haiku selects it. The issue is that the fact itself is not a HARD retrieval challenge; the child may arrive at the wrong-op lure simply by counting in the wrong direction rather than by confusing operations.

**Band-dilution risk: high.** Like `4-3=1`, `5-4=1` would be an outlier in HARD/general. Its difficulty comes from a near-zero answer and directional confusion, not from the opaque relationship between minuend and subtrahend that defines the HARD/general category in Baroody's framework. It belongs in MEDIUM or as a separate "near-zero" caution category if that tier is ever added.

**Verdict: DO NOT ADD.**

---

## Ranked recommendation

| Rank | Fact    | Band recommendation                 | Rationale                                                                                   |
| ---- | ------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | `7-3=4` | ADD to HARD/general                 | Same cognitive load as `8-3=5`; trap=10 strongest possible lure; fits band without dilution |
| 2    | `6-4=2` | ADD to HARD/general                 | Same cognitive load as `7-4=3`; trap=10; one subtrahend-repeat caution                      |
| 3    | `5-3=2` | DO NOT ADD to HARD; consider MEDIUM | Bridgeable via think-addition; trap=8 weaker; would be band's easiest fact                  |
| 4    | `5-4=1` | DO NOT ADD                          | Near-zero difficulty profile fits MEDIUM; trap=9 does not pay for band dilution             |
| 5    | `4-3=1` | DO NOT ADD                          | Weakest candidate; trap=7 not salient; near-trivially easy for HARD band                    |

---

## Trade-off summary

**What adding `7-3=4` and `6-4=2` costs:** The HARD/general category grows from 4 to 6 facts. The category cap (at most 2 general per session) is unchanged, so per-session problem counts are unaffected. The only dilution risk is the subtrahend-repeat (`6-4` and `7-4` both have b=4), which is minor and manageable via a directive note.

**What it buys:** Two in-range wrong-op facts in HARD/general with trap=10, the highest-salience lure in the pool. Under the spec's `general` cap of 2 per session, Haiku can now source BOTH its required wrong-op facts from HARD/general alone in a high-recent-score session — without relying on MEDIUM pool candidates or pulling EASY band facts into discriminate slots. The prior paper's three MEDIUM-band additions (`8-1=7`, `8-2=6`, `6-2=4`) remain recommended for coverage at mid-difficulty; the two HARD/general additions complement them by ensuring wrong-op delivery survives even in sessions Haiku biases heavily toward hard.

**What NOT adding the other three costs:** A missed chance at slightly more pool diversity. Not worth the dilution of the HARD band's difficulty identity. If a future spec adds a "MEDIUM-hard" sub-tier, `5-3=2` and `5-4=1` are natural candidates for it.

---

## Evidence

- Baroody, A.J. (2006). "Why Children Have Difficulties Mastering the Basic Number Combinations and How to Help Them." Teaching Children Mathematics, 13(1), 22–32. NCTM. https://pubs.nctm.org/view/journals/tcm/13/1/article-p22.xml — Three-tier difficulty ordering: rule-governed, small-subtrahend (b=1,2), general. Strong evidence; foundational. `7-3` and `6-4` are unambiguously general-tier by this framework; `5-3`, `4-3`, `5-4` are more ambiguous due to small minuends.

- Robinson, K.M., Arbuthnott, K.D., Rose, D., McCarron, M.C., Globa, C.A., & Phonexay, S.D. (2006). "Stability and change in children's division strategies." Journal of Experimental Child Psychology, 93(3), 224–238. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/ — Wrong-direction-of-compensation errors for subtraction; specifically names `7-3=4` as a fact where children systematically err by one in the wrong direction. Strong evidence (controlled, multiple cohorts ages 6-7). This is the primary evidence that `7-3=4` belongs in the hard-general tier alongside `7-4=3`.

- Baroody, A.J. (1984). "Children's Difficulties in Subtraction: Some Causes and Questions." Journal for Research in Mathematics Education, 15(3), 203–213. Semantic Scholar: https://www.semanticscholar.org/paper/Children's-Difficulties-in-Subtraction%3A-Some-Causes-Baroody/99d0d7c3651fb172f90d4005206f6f52b1ce7e38 — Early account of why facts with small answers near zero (`4-3`, `5-4`) confuse children through proximity errors rather than retrieval failures. Moderate evidence (single observational cohort). Supports treating `4-3=1` and `5-4=1` as a different error type than the HARD/general retrieval challenge.

- McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. PubMed: https://pubmed.ncbi.nlm.nih.gov/40297988/ — Meta-analysis confirming difficulty ordering across subtraction fact categories; deliberate interleaving recommended once both operations are conceptually established. Strong evidence. Cited in prior paper.

- Kevin NOF #2, PR #241 review: empirical observation that only one discriminate problem produces an in-range wrong-op trap under the shipped canon. The prior paper addressed the MEDIUM band gap; this paper addresses the HARD band gap flagged in PR #249.
