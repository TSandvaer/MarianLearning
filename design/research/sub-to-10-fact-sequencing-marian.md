# Sub-to-10 Fact Sequencing for Marian

**Ticket context:** `sub-to-10` node in Number Garden — planner `MATH_TRACK_GUIDE` currently has skeleton text only. This note provides the curriculum slice, fact ordering, distractor rules, and advancement gate that Kevin needs to write the planner prompt and canon.
**Requested by:** Matt, via orchestrator dispatch
**Date:** 2026-05-15

---

## Question

1. What is the developmentally correct fact-ordering for single-digit subtraction with results in [0, 10] for an 8-year-old with ~80% accuracy on add-to-10 via finger reliance?
2. Should `sub-to-10` introduce a visual/manipulative model first, or skip directly to the 4-chip abstract format?
3. How does subtraction's cognitive load compare with addition for a finger-reliant child? Does simultaneous exposure risk regressing addition automaticity?
4. What distractor types are pedagogically appropriate for subtraction specifically?
5. Concrete 16-fact ordered list Matt and Kyle can hand to Kevin.
6. Hard-stop: when should Marian NOT advance to `sub-to-10` even after mastering `add-to-10`?

---

## Bottom line

Sequence subtraction facts in four tiers: identity/zero rules first (no counting required), then doubles/take-from-10 (high leverage, finger-countable in one step), then general facts by proximity to a known anchor, then the hardest non-anchor facts last. The 4-chip chip format is appropriate — Marian does not need a visual-model detour because the app's problem-read-aloud already carries the representational layer. Subtraction does not regress addition automaticity; in fact, the research supports interleaved exposure via fact families — but with a crucial caveat: do not present a subtraction problem and its addition inverse in the same session until Marian has demonstrated reliable independent retrieval on the subtraction side. The hardest distractor for subtraction is not off-by-one but the "wrong operation" error (answering the inverse addition fact instead of the difference); build in at least one wrong-operation distractor per session from problem 5 onward. Advance to `sub-to-10` only when add-to-10 shows three sessions at ≥95% accuracy, even if slow-fact latency is still elevated — because the fact-family exposure is itself part of the treatment for slow addition facts.

---

## Evidence

**Source 1 — Baroody, A.J. (2006). "Why Children Have Difficulties Mastering the Basic Number Combinations and How to Help Them." Teaching Children Mathematics, 13(1), 22–32. NCTM. https://pubs.nctm.org/view/journals/tcm/13/1/article-p22.xml — summary via ERIC: https://eric.ed.gov/?id=EJ756752**

Strong evidence (widely replicated in subsequent curriculum research; foundational in elementary math cognition). Baroody establishes three categories of subtraction facts, ordered by difficulty:

- **Rule-governed** (easiest): n-n=0 (subtract-self) and n-0=n (subtract-zero). Children do not count for these — they apply a rule they can verbalize. These facts take about the same response time as the fastest addition facts.
- **Near-doubles / small-subtrahend** (medium): facts where the subtrahend is 1 or 2 ("counting-back" facts) and "halving" doubles (10-5, 8-4, 6-3). Children can count back reliably with one or two steps — the procedure is identical to their finger-counting strategy for addition but in reverse, with minimal risk of miscount.
- **General non-rule facts** (hardest): all remaining facts, particularly those where the minuend is far from the subtrahend (e.g., 9-4, 8-3, 7-4). These require either a multi-step count-back or derived-fact reasoning (think-addition), neither of which is automatic at 8 years old.

**Source 2 — Gilmore, C.K., & Spelke, E.S. (2008). "Children's understanding of the relationship between addition and subtraction." Cognition, 107(3), 932–945. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC2705957/**

Strong evidence (replicated experiment with pre-school and early-elementary children, controlled design). Children understand the conceptual inverse relationship between addition and subtraction approximately but not exactly. The inverse principle (if 3+7=10, then 10-7=3) is grasped at the approximate level by age 5, but exact-fact transfer is not automatic. Practical implication: Marian understands *conceptually* that subtraction undoes addition — she should not need to re-teach the operation from scratch. But knowing 7+3=10 does not reliably produce the retrieval of 10-7=3 without deliberate practice on the subtraction fact itself.

**Source 3 — Robinson, K.M. et al. (2013). "Young children's use of derived fact strategies for addition and subtraction." Frontiers in Human Neuroscience, 7, 924. https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2013.00924/full — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/**

Strong evidence (controlled study, multiple cohorts of children ages 6-7). The Identity principle (n-n=0 and n-0=n) was the easiest derived-fact strategy, used correctly by 65-73% of children. The Inverse principle (using addition to derive a subtraction answer) was used by only about 1 in 10 children, even after explicit classroom instruction. Subtraction-specific "neighbor" errors are common: children incorrectly apply the wrong direction of compensation (treating n-(b+1) as if it were n-b+1 instead of n-b-1). This error is maximally confusable with the off-by-one distractor — which is the evidence that justifies a different distractor strategy for subtraction (see Question 4 below).

**Source 4 — McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. PubMed: https://pubmed.ncbi.nlm.nih.gov/40297988/**

Strong evidence (systematic review + meta-analysis combining behavioral, longitudinal, neuroimaging, and design-based research). The review recommends deliberate interleaving of addition and subtraction practice once both operations are conceptually established. This is not just compatible with fact-family research — it is specifically recommended as a method for consolidating addition automaticity, because the fact-family exposure increases retrieval opportunities for addition facts through the inverse relationship. The sequencing implication: introducing subtraction while addition is still at the 80-95% accuracy range (as Marian is) is appropriate, not risky, provided the subtraction load does not overwhelm session working-memory capacity.

**Source 5 — Ebner, S., MacDonald, M.K., Grekov, P., & Aspiranti, K.B. (2025). "A Meta-Analytic Review of the Concrete-Representational-Abstract Math Approach." Learning Disabilities Research and Practice, 40(1), 31–42. SAGE: https://journals.sagepub.com/doi/10.1177/09388982241292299**

Strong evidence (meta-analysis of 30 single-case design studies; Tau-BC effect size = 0.9965). CRA is highly effective for elementary arithmetic, particularly for learners who need scaffolding. The "representational" (pictorial/chip) stage is sufficient for learners who have already encountered an operation conceptually — the concrete (manipulative) stage is most necessary when the concept is entirely new. Because Marian has subtraction concept from real life and her diagnostic showed subtraction within 15 to be confident, she does not need a separate concrete-manipulative phase before chip-format problems. The chip format is itself the representational layer of CRA. The abstract layer (bare numeral equations) is what should come later.

**Source 6 — Geary, D.C., Hoard, M.K., Byrd-Craven, J., Nugent, L., & Numtee, C. (2007). "Cognitive mechanisms underlying achievement deficits in children with mathematical learning disability." Child Development, 78(4), 1343–1359. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/**

Strong evidence (multiple grade cohorts, controlled experimental design — same Geary lab cited in `speed-feedback-automaticity-marian.md`). Children are reliably less able to retrieve subtraction facts than addition facts for the same number triplet. Subtraction retrieval mean RT in 2nd graders is higher and more variable than addition RT for comparable facts. This is specifically because subtraction lacks the rehearsal scaffolding that addition gets from counting-on (which simultaneously rehearses the addition-direction encoding). Implication: Marian's latency on subtraction facts will initially be longer than on addition facts even when she knows them — the ≥5s slow-fact threshold established for addition should be raised to ≥7s for subtraction in the first two months of `sub-to-10` practice to avoid over-flagging normally-long retrieval as "slow."

**Source 7 — Cerda, E. et al. (2024). "Arithmetic in the Bilingual Brain: Language of Learning and Language Experience Effects on Simple Arithmetic in Children and Adults." Mind, Brain, and Education. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11407697/**

Moderate evidence (observational study, mixed bilingual sample — not Tagalog-specific). Arithmetic fact retrieval is partially language-encoded at initial learning — bilinguals are faster in their language of learning. For Marian, who has had all her app-based arithmetic instruction in English from the start, this means her addition AND subtraction facts are encoding in English. The risk of a language-switch cost (Tagalog retrieval interfering with English math-fact retrieval) is low for the app context because she is retrieving in English throughout. The relevant finding for sequencing: simple addition and multiplication rely more on verbal encoding than subtraction and division; subtraction retrieval is somewhat more procedure-based and somewhat less language-tied than addition. This slightly reduces the L2 overhead for subtraction vs. addition — a marginal advantage, not a large one.

---

## Application to Marian

Marian is 8, Tagalog-primary, currently in `add-to-10` `practicing` with 80% accuracy and full finger reliance (April 2026 diagnostic). Subtraction within 15 was assessed as confident.

The confident subtraction-within-15 finding is the most important contextual fact here. It means she already has a robust conceptual model of subtraction and a working counting-back strategy for single-digit minuends. The gap is not conceptual — it is retrieval. She is exactly at the inflection point CRA research describes as "ready for the representational phase": the concept is solid, she can execute the procedure, but it is not yet automatic.

The 4-chip abstract format is appropriate — but the problem read-aloud ("Eight minus three. How many?") IS the representational layer. Emma vocalizes the operation, which anchors the language encoding. There is no need to add a visual ten-frame or manipulative stage before the chip problems. The ten-frame would add cognitive load (parsing a new visual format) without adding pedagogical value that Marian does not already have from her confident subtraction-within-15 performance.

The finger-counting compound effect: Marian will almost certainly use counting-back on fingers for subtraction facts she hasn't retrieved yet. This is fine and should not be discouraged — it is the same scaffold that worked for addition. The Poletti et al. (2025) findings (cited in `speed-feedback-automaticity-marian.md`) directly apply: finger counting for subtraction at age 8 is developmentally appropriate and will fade naturally as retrieval builds up via spaced repetition.

The fact-family exposure case: McNeil et al. (2025) explicitly recommend interleaving addition and subtraction once both are conceptually established. Marian meets this criterion. Introducing `sub-to-10` after she reaches 95% accuracy on `add-to-10` does not reset addition automaticity — it adds a second retrieval pathway for the same number triplets. The Leitner re-targeting for add-to-10 facts should remain active during `sub-to-10` sessions (spaced review), and the `sub-to-10` Leitner box should be initialized as its own separate structure (different operation key).

---

## Risks / counter-evidence

**Dual-operation interference (multiplication analog):** There is a documented interference effect in multiplication fact learning when similar facts are drilled together (Verguts & Fias, 2005, and subsequent replications). The analog question for addition + subtraction: does drilling 8-2=6 at the same time as 2+6=8 interfere? The Robinson (2013) data on the inverse principle (only 1 in 10 children applying it spontaneously) suggests the two operations are stored somewhat separately — which means interference is low but so is the automatic transfer benefit. The practical resolution: do not present a subtraction problem and its addition twin in the same 8-problem session. Let spaced repetition build the subtraction engrams independently; the fact-family connection will emerge naturally over weeks.

**Long-latency subtraction may flood the slow-fact directive:** If the ≥5s threshold used for addition is applied to subtraction without adjustment, Marian's session-start payloads will consistently contain every subtraction fact she has ever seen (because all new subtraction facts will initially be slow). This would cause the slow-fact Haiku directive to override canon for every `sub-to-10` session from session 2 onward, defeating the canon-first fast-path. The calibration fix is straightforward (raise the threshold for `sub-to-10` ops), but it requires an explicit decision, which is flagged in the Non-obvious findings section below.

**Transfer from confident subtraction-within-15:** The diagnostic tested subtraction within 15 with presumably familiar number contexts. The structured 4-chip format on an iPad screen is a different stimulus context. Marian may show a brief regression on familiar facts (e.g., 7-3=4) simply because the app presentation is novel, not because the facts have been forgotten. The gentle-ramp logic from `design/research/math-distractor-and-streak-decisions.md` applies: problems 1-3 should use well-spaced distractors, regardless of how easy the fact itself is, to allow context calibration before tight discriminations begin.

---

## Recommendations

### Q2 — Visual model: skip the detour

Do not add a ten-frame or manipulative overlay before chip problems. The chip format is the representational stage of CRA for a child who already has subtraction concept. Adding a new visual primitive adds cognitive load without pedagogical payoff. Emma's problem read-aloud is the representational anchor.

One optional concession: on the very first `sub-to-10` session, the read utterance could be framed as "Eight take away three. How many are left?" — the "take away" phrasing is conceptually grounded and maps onto physical removal, which is the mental model Marian uses when counting back. This is a copy decision for Kyle/Kevin, not a full representational detour.

### Q3 — Cognitive load and dual exposure

Introducing `sub-to-10` after add-to-10 mastery does not regress addition automaticity. The interleaving is beneficial per McNeil et al. (2025). The constraint: keep the session focused on one primary operation. A `sub-to-10` session delivers 8 subtraction problems. The Leitner spaced-review mechanism naturally surfaces occasional add-to-10 facts for review — this cross-tier maintenance is healthy and should be left in place.

### Q4 — Distractor design for subtraction

The off-by-one distractor used in add-to-10 is still appropriate for subtraction — but it is now LESS distinctive as a distractor, because the off-by-one compensating error Robinson (2013) identified is Marian's likely active error pattern. The more impactful distractor to add is the **wrong-operation distractor**: for a problem like 10-2, one distractor should be 12 (i.e., 10+2, the addition answer using the same pair). This targets the real cognitive confusion — applying the wrong operation — rather than just a counting miscount.

Practical implementation for the existing `distractors.ts` two-tier structure:

| Tier | Problems | Rule |
|---|---|---|
| `gentle` | 1-3 | Distractors ≥2 away from correct answer, biased toward extremes. Same as add-to-10. |
| `offByOne + wrongOp` | 4-8 | One distractor = correct ± 1; one distractor = minuend + subtrahend (wrong-operation lure). The wrong-operation distractor replaces the second off-by-one distractor. |

If the wrong-operation value happens to equal correct ± 1 (e.g., 10-5=5 → wrong-op=15, which is out of range for results-in-[0,10] problems), fall back to the second off-by-one distractor. Cap both distractors in [0, 10].

This is a code change to `distractors.ts` scoped to when the focus node is `sub-to-10` (or `sub-to-20` in future). It should not affect the existing add-to-10 distractor logic.

### Q6 — Advancement gate

**Advance when:** add-to-10 shows ≥95% accuracy across 3 consecutive sessions.

**Even if:** the slow-fact list is long. The evidence from McNeil et al. (2025) supports this: interleaving subtraction IS part of the treatment for slow addition facts. Holding Marian on add-to-10 past 95% accuracy waiting for latency to drop is not better than advancing and letting fact-family exposure accelerate the retrieval transition on both sides simultaneously. The Leitner slow-fact spaced-review continues on add-to-10 facts as background maintenance during `sub-to-10` sessions.

**Hard stop (do not advance) if:** accuracy on add-to-10 has not cleared 95% in any 3 consecutive sessions in the past 10 sessions, OR if Marian is showing emotional distress signals (session abandonment, repeated retries with no improvement). The latter is a Thomas/parent observation gate, not an algorithm gate.

---

## Concrete fact ordering — 16-fact surface for Kevin

The full single-digit subtraction surface with results in [0, 10] has more than 16 facts if you count all permutations (there are 55 ordered pairs a-b=c with a≤10, b≤a, c≥0). The 16 facts below cover the pedagogically distinct cases Haiku needs to prioritize and interleave, selected to cover each difficulty band and conceptual category without redundancy. The planner should draw all 8 session problems from this pool, weighted by Leitner box.

| Priority | Fact | Band | Category | Teaching note |
|---|---|---|---|---|
| 1 | 5-5=0 | easy | subtract-self | n-n=0 rule; no counting, rule-application only |
| 2 | 8-8=0 | easy | subtract-self | Repeats the rule with a larger n; confirms generality |
| 3 | 7-0=7 | easy | subtract-zero | n-0=n rule; identity property |
| 4 | 9-0=9 | easy | subtract-zero | Repeats with a different n; do not drill both in one session |
| 5 | 10-5=5 | easy | doubles | Doubles halving; highly memorable, single finger-count step |
| 6 | 8-4=4 | easy | doubles | Doubles halving; Marian knows 4+4=8 from add-to-10 |
| 7 | 6-3=3 | easy | doubles | Doubles halving; Marian knows 3+3=6 |
| 8 | 9-1=8 | easy | subtract-one | Count back one step; same scaffold as n+1 in addition |
| 9 | 10-1=9 | medium | subtract-one | Count back one step; bridges the decade |
| 10 | 10-2=8 | medium | subtract-two | Count back two steps; watch for wrong-op distractor (10+2=12) |
| 11 | 10-3=7 | medium | take-from-10 | Bridges through 10; high value because 10 is the anchor |
| 12 | 10-7=3 | medium | take-from-10 | Inverse of 7+3=10; expose deliberately to build fact-family link |
| 13 | 9-4=5 | hard | general | No obvious shortcut; count-back or derived from 10-5 |
| 14 | 8-3=5 | hard | general | No obvious shortcut; count-back; note that wrong-op lure is 11 (out of range — use off-by-one fallback) |
| 15 | 7-4=3 | hard | general | Often confused with 7-3=4; the off-by-one distractor is load-bearing here |
| 16 | 9-6=3 | hard | general | Hardest in the pool; subtrahend is large, not a clean anchor |

**Haiku session design rules for this pool:**

1. Always include at least one fact from band `easy` in problems 1-3 (gentle ramp), regardless of Leitner box status.
2. Include at least one take-from-10 fact per session (facts 11-12) from problem 4 onward — these are the highest-leverage facts for building the make-10 mental model that `add-to-20` will later depend on.
3. Never pair a fact and its addition inverse in the same session (e.g., do not include both 10-7=3 and 7+3=10 as separate problems in one session).
4. The Leitner directive overrides pool composition for problems 4-8 as usual.

**Planner read-line template for subtraction:**

`"<minuend> minus <subtrahend>. How many are left?"`

The "how many are left" framing is deliberately different from the addition "how many?" to signal operation type without depending on Marian reading the minus sign. Kevin should verify the parser (`planFromServer.ts`) can extract minuend and subtrahend from this template — it will need a distinct regex branch for subtraction vs. addition facts.

---

## Non-obvious findings

**1. The slow-fact latency threshold needs operation-specific calibration.** The ≥5s threshold established for add-to-10 (per `speed-feedback-automaticity-marian.md`, grounded in Geary lab data showing 2nd-grade retrieval mean ~2,800 ms with SD ~1,900 ms) is for *addition* retrieval. Subtraction retrieval runs systematically longer — Geary's data shows higher mean RT and higher variance for subtraction than addition at the same grade level. If `buildSlowFactSessionHint` in `slowFacts.ts` applies the same ≥5s threshold to subtraction ops, it will flood the slow-fact payload on early `sub-to-10` sessions (most new subtraction facts will be counted as slow). **Recommendation for Matt to route to Kevin:** the `slowFacts.ts` threshold constant should be operation-parameterized — `+` stays at ≥5s, `-` starts at ≥7s for the first 10 sessions on `sub-to-10`, then drops to ≥6s after 10 sessions, then ≥5s after 20 sessions. Alternatively, suppress the `slowFacts` directive entirely for the first 5 `sub-to-10` sessions (treat the node as "new tier, baseline phase") and only engage it once a session history of ≥5 entries exists for that node.

**2. The wrong-operation distractor is a new distractor type not present in the current `distractors.ts` design.** The current spec (from `math-distractor-and-streak-decisions.md`) only addresses gentle vs. off-by-one tiers. The wrong-operation lure (minuend + subtrahend as a distractor option) is a subtraction-specific addition that should be documented in `skill-trees-and-content.md` under "Math distractors" as a third tier rule, conditional on operation type. This is a design-doc update for Kyle, and a code change for Kevin.

**3. The focus-node picker's advancement logic should NOT gate on slow-fact list length for `add-to-10 → sub-to-10` transition.** Currently the picker promotes on accuracy alone. The slow-fact research supported adding a latency signal as a backend re-targeting tool, but that research explicitly argued against using latency as a promotion gate. The fact-family interleaving evidence (McNeil et al. 2025) now adds a further reason to advance on accuracy alone: promotion itself is therapeutic for slow addition facts. Any future code path that gates promotion on "slow-fact list is short" would be developmentally backwards for this specific transition. This is worth capturing in `progress-and-persistence.md` under the focus-node picker section as a documented rationale.
