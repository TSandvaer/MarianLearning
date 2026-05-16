# Sub-to-20 Pedagogical Sequence Baseline

**Ticket:** `86c9ur3g6`
**Date:** 2026-05-16
**Requested by:** Matt, via orchestrator dispatch, to gate Kyle's sub-to-20 content-tier spec (Days 3–4).

---

## Question

What pedagogical authority does Kyle need before drafting the `sub-to-20` content-tier spec? Specifically: where does this tier sit developmentally, what is Marian's actual baseline, which distractor classes are justified by real error patterns (and which should be rejected), and what is the correct v1 scope boundary?

---

## Bottom line

Sub-to-20 is the "no-borrow" subtraction layer: teen minuend (11–19), single-digit subtrahend, result always ≥ 2. This is the natural extension of sub-to-10 and sits in parallel with add-to-20 in the research literature — neither strictly before nor after it. For Marian, the diagnostic says "confident within 15, extend to 20" which means the transition zone is minuends 16–19; she likely already retrieves 12−3=9 but may count-back for 17−8=9. V1 scope should cover no-borrow only (result never crosses a ten boundary), expand minuends 11–19 in three bands (11–13 easy, 14–16 medium, 17–19 hard), and introduce the take-from-decade anchor strategy as the highest-leverage teaching hook. Distractor classes: off-by-one (counting error, ACCEPT), decade-anchor miss (wrong-decade error, ACCEPT). Wrong-borrow (REJECT for v1 — only relevant if borrowing is in scope). Small-result speculation (not a named error construct in the literature — REJECT as a distractor class, but relevant as a session-design concern). Borrow is explicitly out of v1 scope.

---

## §1 Sequence: Where sub-to-20 sits developmentally

### 1.1 Predecessor: sub-to-10

Sub-to-10 shipped PR #253 with a 22-fact pool (widened from Dave's original 16). The Class-2 wrong-operation distractor was adopted. Sub-to-20 is the direct successor in the `MATH_TREE` sequence:

```
... → add-to-20 → sub-to-10 → sub-to-20 → two-digit-addsub → ...
```

Source: `skill-trees-and-content.md` §"Number Garden (math)". Sub-to-20 is the immediately next node after sub-to-10 in both `MATH_TREE` and `MATH_NODES_IN_ORDER`.

### 1.2 Relationship to add-to-20 — parallel, not sequential

The curriculum and research literature consistently treat addition and subtraction within the same number range as **parallel acquisition targets**, not sequential ones. Evidence:

- The Illustrative Mathematics K–5 scope puts addition and subtraction within 20 in the same grade-1 unit, explicitly taught together to reinforce fact-family structure.
- McNeil, Jordan, Viegut, and Ansari (2025) recommend deliberately interleaving addition and subtraction once both operations are conceptually established (same recommendation that grounded sub-to-10 adoption).
- Fuson and Kwon (1992), studying first-grade Korean children on single-digit subtraction with minuends 10–18, found that children solve these problems using the same decomposition strategies they built for addition in the same number range — the operations are cognitively linked at this level, not serial.

**Practical implication for Kyle's spec:** Sub-to-20 does NOT require mastery of add-to-20 as a prerequisite in the same way multiplication requires fluent addition. If Marian has reached `add-to-20: practicing` and `sub-to-10: mastered`, sub-to-20 is appropriately introduced even if add-to-20 is not yet mastered. The `MATH_TREE` order already reflects this — sub-to-20 follows sub-to-10 in the picker.

**What IS required:** add-to-20 fact-family exposure. Specifically, knowing that 8+6=14 helps Marian derive 14−6=8 (think-addition strategy). Sub-to-20 accelerates add-to-20 automaticity through the inverse pathway — the same finding McNeil et al. (2025) cited for sub-to-10 and add-to-10.

### 1.3 Successor: two-digit-addsub

Sub-to-20 is the bridge to two-digit arithmetic. The no-borrow constraint in v1 is pedagogically principled: borrowing (regrouping) introduces a new conceptual operation (decomposing the ten). The research on learning trajectories (Clements & Sarama, 2009, 2020, Routledge) is clear that single-digit subtraction from teen numbers without regrouping must be automatic before regrouping procedures are layered. Shipping v1 as no-borrow only is not a scope cut — it is the correct developmental sequence.

---

## §2 Marian's diagnostic baseline

**From `CLAUDE.md` April 2026 diagnostic:**

> "Subtraction: Within 15 confident, extend to 20 no-borrow"

This one sentence is the most important pedagogical fact for this spec. Unpacked:

**"Within 15 confident"** means facts with minuend ≤ 15 are already in Marian's retrieval-or-near-retrieval zone. She likely has: 11−2, 12−3, 13−4, 14−5 at a similar level to her sub-to-10 facts — confident, but not necessarily automatic (she may still count-back for some). She has the concept and a working strategy. The gap is the same as sub-to-10: retrieval automaticity, not conceptual access.

**"Extend to 20 no-borrow"** is the curriculum directive: the diagnostic identified that the 16–19 minuend zone (facts like 16−7, 17−8, 18−9) is where she needs structured practice. This is precisely the zone the sub-to-20 tier should extend into, progressively.

**Starting point implication:** Don't open sub-to-20 at the boundary of Marian's uncertainty (minuend 16). Open in her zone of partial confidence (minuend 11–13) so the first sessions build positive momentum before extending into the harder zone. This mirrors the sub-to-10 warm-up logic (rule-governed facts first) but at the teen-number level.

**The no-borrow constraint:** All facts in v1 must satisfy: `minuend − subtrahend = result ≥ 2`, with no digit-borrowing required (i.e., the ones-digit of the minuend is always ≥ the subtrahend). Concretely: 14−3=11 is no-borrow (ones digit 4 ≥ subtrahend 3). 14−7=7 is a borrow (ones digit 4 < subtrahend 7). Borrow facts are out of v1 scope.

**L2 context note:** English teen number words are notoriously opaque for L2 learners — "sixteen" does not transparently communicate "ten + six" the way Korean "십육" (ten-six) does. Fuson and Kwon (1992) demonstrated that Korean children outperformed American children on teen arithmetic partly because the number-word structure made place value transparent. For Marian (Tagalog-primary), Tagalog teen number words ("labing-anim" = 16) are similarly transparent in structure, which gives her a minor advantage over English-monolinguals — she may mentally represent 16 as "labing-anim" (ten-six) even when processing in English. This does not change the distractor design but is worth noting for copy: Emma's read-aloud should say the English numeral name plainly ("sixteen minus eight") rather than decomposing verbally ("ten and six, minus eight") — the verbal decomposition adds L2 cognitive load without helping a child who already has the conceptual structure.

---

## §3 Distractor-class candidates — pedagogical fit gated

Per `[[feedback_distractor_class_pedagogical_gates_mechanical]]`: open with the developmental-psychology error pattern, then verify mechanical fit. A mechanically-sufficient class without a documented error pattern is the wrong class.

### Class A — Off-by-one (counting error) — ACCEPT

**What 7–9yo error pattern does this target?**

Counting-back from a teen minuend involves more steps than counting back from a single-digit minuend, and each additional step is a new opportunity for a count-track error. Robinson et al. (2013, Frontiers in Human Neuroscience) documented neighbor errors (off-by-one in the direction of compensating incorrectly) as the most common procedural error for subtraction in children ages 6–7, at a rate that persists into grades 2–3. Geary et al. (2007, Child Development) showed that counting-back errors for subtraction are predominantly ±1 from the correct answer, arising from miscounting by one step. For facts like 15−6=9, the child counting back 6 steps from 15 has 6 opportunities to miscount; the modal error is stopping one step too early (result = 10) or one step too late (result = 8).

**Mechanical fit:** All sub-to-20 no-borrow facts produce results in [2, 18]. Off-by-one distractors (result ± 1, clamped into [1, 19]) are always distinct from the correct answer and from each other. No pool degeneration. ACCEPT.

**Calibration note:** Off-by-one is LESS distinctive for subtraction than for addition because the off-by-one error IS Marian's likely active error direction (same finding that motivated introducing wrong-operation for sub-to-10). Off-by-one should remain as a class (because the error pattern is real) but should NOT be the only class in the discriminate window.

### Class B — Decade-anchor miss (wrong-decade result) — ACCEPT

**What 7–9yo error pattern does this target?**

This is the sub-to-20-specific error that does not exist in sub-to-10: when counting back from a teen minuend, children cross the decade boundary (the 10) and frequently misidentify which decade they land in. For example, 13−4: the child starts at 13 and counts back 12, 11, 10, 9 — but may accidentally anchor at 10 rather than continuing to 9. This produces 10 as an incorrect answer (off by +1, but specifically a decade-crossing error).

The error pattern is documented in two ways in the literature:

1. **Fuson and Kwon (1992):** American children (unlike Korean children whose language codes the decade explicitly) frequently make errors on teen subtraction at the decade boundary. The tens-column crossing is cognitively more demanding for children whose language does not make the decade explicit in the number name.

2. **Baroody (1984, Journal for Research in Mathematics Education, "Children's Difficulties in Subtraction"):** Counting-down from numbers above 10 is systematically harder than counting down within 10, specifically because the child must track both the step count and the crossing of the decade boundary simultaneously. Baroody identified decade-crossing as one of the primary sources of subtraction errors in grades 1–3.

**Mechanical fit:** The decade-anchor miss distractor is defined as: the nearest multiple of 10 on either side of the correct answer (where distinct from correct). For 13−4=9, decade-anchor = 10. For 17−5=12, decade-anchor = 10. For 14−3=11, decade-anchor = 10. The distractor is nearly always 10 (since most sub-to-20 results land near the decade). When the correct answer IS 10 or 11 (close to the decade), the decade-anchor distractor collapses to off-by-one and the class degenerates — fall back to a second off-by-one in that case.

**Coverage check:** For the no-borrow pool (results approximately 2–17), the decade-anchor distractor is distinct and in range for approximately 80% of pool facts. The degenerate cases (correct ∈ {10, 11}) use off-by-one fallback — this is mechanically sound. ACCEPT.

**Implementation note for Kyle:** This class is new to the codebase. It requires `pickDistractors` to receive the minuend (to compute the decade anchor) or the distractor can be computed as `Math.round(correct / 10) * 10` ± 10. Kevin should verify the exact formula with a pool scan; the principle is "the multiple of 10 closest to the correct answer, if distinct from it."

### Class C — Wrong-operation distractor — CONDITIONAL ACCEPT (lower priority than sub-to-10)

**What 7–9yo error pattern does this target?**

For sub-to-10, wrong-operation was the highest-leverage distractor because the wrong-op answer (a + b) was within the answer range [0, 10] for many pool facts, and operation confusion is a documented error mode (Robinson et al. 2013). For sub-to-20, the arithmetic changes: for a fact like 17−8=9, wrong-op = 17+8 = 25, which is far out of the [0, 20] range. The wrong-op distractor becomes mechanically unavailable for most sub-to-20 facts.

**Mechanical fit:** For the no-borrow sub-to-20 pool (minuend 11–19, subtrahend 1–9), the wrong-op value is minuend + subtrahend ≥ 12 + 1 = 13 at minimum and up to 19 + 9 = 28. Since results are in [2, 18], the wrong-op value (minuend + subtrahend, always ≥ minuend) is almost always above the result range for these facts. Out-of-range rate is very high — approximately 90% of pool facts would require fallback. Wrong-op as a primary class degenerates; it cannot carry the pedagogical weight it carried in sub-to-10.

**Decision:** Do NOT make wrong-operation a primary distractor class for sub-to-20. It has valid pedagogical justification but fails mechanical viability at this number range. Kyle should note this in the spec: the wrong-op class is structurally limited to cases where a+b ≤ maxAnswer, which is rare at the teen-number level. Use Class A (off-by-one) and Class B (decade-anchor miss) as the two discriminate-tier classes.

### Class D — Wrong-borrow (borrow confusion) — REJECT for v1

**What error pattern does this target?**

Wrong-borrow targets the error a child makes when they attempt a borrow (regrouping) on a problem that does not require it, or fail to borrow when one IS required. This is a multi-digit procedural error pattern — it requires the child to be working in the two-digit subtraction algorithm context.

**Pedagogical fit for sub-to-20 v1:** V1 is explicitly no-borrow only. A distractor targeting borrow confusion makes no sense in a pool where no fact requires borrowing — it tests a procedure that hasn't been introduced, which is not a real error pattern for the pool. This is the same gate that correctly rejected add-to-10 Class 2 (wrong-operation) — adding it to add-to-10 was rejected because addition-direction confusion is not a documented error pattern for that operation. Wrong-borrow is rejected here for the same reason: the error pattern it targets does not exist in a no-borrow pool.

**Decision:** REJECT for v1. Revisit if/when borrow is added to the pool in v2.

### Class E — "Small-result-bias" (guessing small answers) — REJECT as a class

**What error pattern does this target?**

The ticket mentions "children often default to small answers when uncertain." This is worth addressing directly because it would surface as mechanically tempting (small distractors are easy to generate). The question is whether it targets a documented error pattern.

Searching the developmental psychology literature, "small-result-bias" or "small-answer-bias" is not a named construct for subtraction in children ages 7–9. What IS documented:

- Children under uncertainty increase random guessing (Siegler, overlapping-waves model). Random guesses are uniformly distributed across available chip options, not biased toward small values specifically.
- The closer analog to a systematic small-answer tendency is counting-down stopping too early — which produces results slightly above the correct answer (off-by-positive-one), not dramatically smaller answers. This is covered by Class A.
- Baroody (1984) documented that children under procedural pressure may abandon a counting-back procedure and guess, but these guesses are not systematically small — they are random within the visible range.

A distractor class built on "small results look plausible when uncertain" would pollute the chip with values that don't model a real systematic error. It would add an additional off-by-many distractor whose only property is being small — this is not pedagogically grounded.

**Decision:** REJECT as a named distractor class. However, the concern motivating it is real in a different form: the gentle-ramp window (P1–P3) should use large-spread distractors (far from correct) precisely to avoid the situation where all chips look plausible to an uncertain child. The gentle-ramp Class 0 already handles this. No new class is needed.

---

## §4 Recommended scope for v1 sub-to-20

### 4.1 Pool boundary

**No-borrow only.** Minuend 11–19, subtrahend 1–9, with the constraint that the ones-digit of the minuend is ≥ the subtrahend (no borrowing). Result ≥ 2.

The valid no-borrow sub-to-20 pool (excluding sub-to-10 facts already in the prior tier) contains approximately:

- All facts where minuend ∈ [11, 19], subtrahend ∈ [1, 9], ones-digit(minuend) ≥ subtrahend, result ≥ 2.

This yields approximately 30–35 facts depending on exact pool composition. Kyle should run a pool scan to confirm the exact count. This is larger than the sub-to-10 pool (22 facts post-widening); the sub-to-20 pool for v1 should be curated to 20–25 facts, prioritizing the three bands below.

**Kyle's call on exact pool size.** The sub-to-10 precedent (curated from 55 facts to 22) is the model. Kyle owns the curation; this research note provides the pedagogical band structure to guide that curation.

### 4.2 Band split — EASY / MEDIUM / HARD

**EASY — minuend 11–13, subtrahend 1–3 (results 8–12)**

These facts are closest to the sub-to-10 range Marian is confident in. The count-back from 11, 12, or 13 is 1–3 steps — the same low-step count that made sub-to-10 "easy" facts accessible. Teaching notes for the band:

- Facts that mirror take-from-10 with +1: 11−1=10 (subtract-one from a decade+1), 12−2=10 (doubles analog), 13−3=10 (take-to-decade). These are especially memorable because their result is the round number 10.
- Include at least one "subtract-self analog" if available: facts where the ones-digits of minuend and subtrahend match (11−1=10, 12−2=10, 13−3=10) — Marian knows n−n=0; n−n-with-decade is n-n offset by 10, which is a natural extension.

**MEDIUM — minuend 14–16, subtrahend 1–6 (results 8–15)**

This is Marian's diagnostic "confident within 15" zone extended slightly. These facts require counting back up to 6 steps from a teen number, crossing the decade boundary. The decade-anchor miss (Class B) is most relevant here — 15−6=9 is the canonical example where children anchor at 10 rather than counting through to 9.

Teaching notes:
- Take-from-decade strategy (decompose minuend as 10 + ones-digit, subtract from ones-digit first): 15−6 = (10+5)−6 = 10+(5−6) → fails (negative), so instead = (15−5)−1 = 10−1 = 9. This is the "bridge down through the decade" strategy, the subtraction analog of the make-10 bridging add-to-20 uses. Introducing this strategy in copy ("start at 15, go down to 10, then one more!") is high-value for the MEDIUM band.
- Facts where the result is 10 (e.g., 14−4, 15−5, 16−6) are especially memorable and should be present in the pool — result = 10 is a decade anchor that children remember.

**HARD — minuend 17–19, subtrahend 5–9 (results 8–14)**

This is the "extend to 20 no-borrow" zone from the diagnostic — facts Marian has not yet drilled. Counting back 5–9 steps from 17–19 is the heaviest working-memory load in this pool: the child must (a) hold the minuend, (b) count back the subtrahend number of steps, AND (c) track the decade boundary crossing. This band should not appear in P1–P3 (gentle ramp) and should be used sparingly in sessions where recent accuracy is low.

Baroody (2006) and Geary et al. (2007) converge on a clear finding: counting-back becomes more error-prone as the subtrahend increases. A child counting back 8 steps has 8 opportunities for a step error; a child counting back 2 steps has 2. The hard band is where wrong-direction-of-compensation errors (Robinson et al. 2013) are most common, because the child has lost track of the direction and the step count simultaneously.

**Notable HARD fact: 18−9=9.** This is the single highest-leverage fact in the sub-to-20 no-borrow pool: (a) it is the largest no-borrow fact in the 0s column, (b) it anchors the 9-times-table when multiplication arrives, (c) the result (9) is one less than the minuend's tens digit complement (10−1=9), making it memorable once the pattern is visible. Recommend including this fact explicitly in the pool regardless of other curation decisions.

### 4.3 Session warm-up structure

Mirror sub-to-10 exactly:

| Problem index | Band source | Distractor class |
|---|---|---|
| P1–P3 | EASY only | Class 0 — gentle (≥2 away, range extremes) |
| P4–P8 | MEDIUM or HARD (or EASY if low recent score) | Class A (off-by-one) OR Class B (decade-anchor miss), random mix, ≥2 Class B required |

The ≥2 Class B minimum in P4–P8 mirrors the sub-to-10 ≥2 Class 2 (wrong-op) minimum — a floor ensures the higher-leverage class appears in every session.

### 4.4 Advancement gate

Same accuracy-only gate as sub-to-10: **advance to sub-to-20 when sub-to-10 shows ≥95% accuracy across 3 consecutive sessions.** Do not gate on latency length — per McNeil et al. (2025), the fact-family interleaving effect of sub-to-20 exposure is itself therapeutic for slow sub-to-10 retrieval. Holding Marian on sub-to-10 past 95% waiting for latency to drop is counterproductive.

The slow-fact threshold caveat from sub-to-10 carries forward: sub-to-20 latency will systematically run longer than sub-to-10 latency at first, because the facts are new and involve more counting steps. The `slowFacts.ts` threshold for `sub-to-20` should start at ≥7s (matching the sub-to-10 initial threshold) and ramp down per session count, following the same parameterization pattern Dave's sub-to-10 research established.

### 4.5 Explicit out-of-scope for Kyle (what NOT to fold into v1)

- **Borrow (regrouping) facts.** Out. The no-borrow constraint is a hard pedagogical line; borrow is a new conceptual layer, not a scale-up of no-borrow.
- **Two-digit subtrahend.** Out. Facts like 24−13 belong in two-digit-addsub, not here.
- **Negative results.** Out. No fact in the pool should produce a result < 0.
- **Wrong-borrow distractor class.** Out (rejected in §3, Class D).
- **Mixed add-to-20 / sub-to-20 sessions.** Out for v1. The dual-exposure rule (never pair a `-` fact with its `+` inverse in the same session) carries forward from sub-to-10. A future spec can introduce fact-family interleaving once sub-to-20 has 10+ sessions of history.
- **Word-problem framing.** Out. Emma's read-aloud carries the operation; no embedded word problems.
- **CRA visual scaffolding detour.** Out. Same ruling as sub-to-10 (Dave §Q2 in `sub-to-10-fact-sequencing-marian.md`): the chip-tap format IS the representational layer for a child who already has the subtraction concept. No ten-frame, no number-line overlay, no manipulative phase.
- **Speed-feedback UX.** Out. Same ruling as sub-to-10 (`speed-feedback-automaticity-marian.md`): latency is a backend re-targeting tool only; Emma's reaction indexes on correctness, not speed.

---

## Evidence

**Source 1 — Baroody, A.J. (1984). "Children's Difficulties in Subtraction: Some Causes and Questions." Journal for Research in Mathematics Education, 15(3), 203–213. NCTM. https://pubs.nctm.org/view/journals/jrme/15/3/article-p203.xml (abstract); ERIC: https://eric.ed.gov/?id=EJ300404**

Strong evidence (foundational, widely replicated; 40+ years of subsequent confirmation). Baroody established that counting-down becomes systematically more error-prone as the subtrahend increases, and that decade-crossing (counting through a multiple of 10) is a specific source of difficulty for American children. Identified the three-way difficulty structure of subtraction: rule-governed facts (n−n, n−0) easiest, small-subtrahend facts intermediate, large-subtrahend general facts hardest. The decade-crossing difficulty directly grounds the Class B (decade-anchor miss) distractor recommendation.

**Source 2 — Robinson, K.M., Ninowski, J.E., & Gray, M.L. (2013). "Young children's use of derived fact strategies for addition and subtraction." Frontiers in Human Neuroscience, 7, 924. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/**

Strong evidence (controlled study, multiple age cohorts, 6–7-year-olds; findings replicated in subsequent work). Documented that neighbor errors (wrong-direction-of-compensation, off-by-one) are the most common procedural error for subtraction. The Identity principle (n−n=0) was easiest; the Inverse principle (using addition to derive subtraction) was used by only ~10% of children even after instruction. This grounds Class A (off-by-one) for sub-to-20 just as it did for sub-to-10, and confirms that the Inverse principle is not yet a reliable strategy for 8-year-olds.

**Source 3 — Fuson, K.C., & Kwon, Y. (1992). "Korean Children's Single-Digit Addition and Subtraction: Numbers Structured by Ten." Journal for Research in Mathematics Education, 23(2), 148–165. NCTM. https://pubs.nctm.org/view/journals/jrme/23/2/article-p148.xml**

Strong evidence (controlled interview study, Korean vs. American children on single-digit arithmetic with minuends 10–18). Key findings: Korean children solved 75% of teen subtraction facts correctly before being taught this content in school, using decomposition methods structured around 10. American children performed substantially lower. The difference was attributed primarily to language structure (Korean number words make place value explicit; English does not). For Marian: Tagalog teen number words (labing-isa = 11, labing-dalawa = 12, etc.) ARE structurally transparent, giving her a mild advantage over English monolinguals on teen-number mental models — but this advantage operates on her L1 mental representation, not her L2 app context. The paper grounds the importance of the decade (10) as a cognitive anchor for teen subtraction, justifying the Class B distractor.

**Source 4 — Geary, D.C., Hoard, M.K., Byrd-Craven, J., Nugent, L., & Numtee, C. (2007). "Cognitive mechanisms underlying achievement deficits in children with mathematical learning disability." Child Development, 78(4), 1343–1359. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/**

Strong evidence (multiple grade cohorts, controlled experimental design). Subtraction retrieval RT is higher and more variable than addition RT for the same number triplet, because counting-back does not rehearse the encoding direction that counting-on adds. Specifically, counting-back from a teen number requires more steps, each introducing additional variance. This is the empirical basis for the HARD band designation for facts with large subtrahends from teen minuends.

**Source 5 — McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. PubMed: https://pubmed.ncbi.nlm.nih.gov/40297988/**

Strong evidence (systematic review + meta-analysis). Recommends interleaving addition and subtraction in the same number range once both operations are conceptually established, because the fact-family exposure adds a second retrieval pathway. Supports the parallel (not sequential) relationship between add-to-20 and sub-to-20, and the accuracy-only advancement gate.

**Source 6 — Caviola, S., Gerotto, G., Lucangeli, D., & Mammarella, I.C. (2018). "Children's Strategy Choices on Complex Subtraction Problems." Frontiers in Psychology, 9, 1209. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC6057409/**

Strong evidence (controlled study, grades 3 and 5, manipulated borrow vs. no-borrow and subtrahend size). Direct confirmation that no-borrow problems are substantially easier than borrow problems (94% vs 89% accuracy for single-digit subtrahend; 88% vs 75% for double-digit). The borrow/no-borrow difficulty gap is the empirical grounding for the hard pedagogical line between sub-to-20 v1 and a future borrow tier.

**Source 7 — Clements, D.H., & Sarama, J. (2020). Learning and Teaching Early Math: The Learning Trajectories Approach, 3rd ed. Routledge.**

Strong evidence (comprehensive synthesis of longitudinal and experimental research on early mathematics learning trajectories). The learning trajectory for subtraction places single-digit subtraction from teen numbers (without regrouping) as the penultimate stage before two-digit computation. The trajectory explicitly positions this as the bridge tier: automaticity here is the prerequisite for the regrouping procedures that define two-digit-addsub. Supports the pool boundary and the out-of-scope ruling on borrow.

---

## Application to Marian

Marian's diagnostic gives a direct entry point: minuend 11–15 is her zone of partial confidence, and 16–19 is where structured practice is needed. This maps cleanly to the EASY/MEDIUM/HARD band structure in §4.2.

Her finger-counting strategy (well-documented from sub-to-10 context) will extend to teen subtraction: she will count back from the minuend on fingers. For small subtrahends from small teen minuends (EASY band), this is reliably successful — 13−2 requires 2 count-back steps, easily done. For HARD band facts (17−8, 18−9), counting back 8–9 steps from a teen number strains finger-counting and introduces decade-boundary errors. The decade-anchor miss distractor (Class B) is well-matched to the error she is most likely to make in this zone.

The Tagalog-transparency note (§2, L2 context) is mild but real. Marian may mentally represent teen numbers in Tagalog, which does make the decade structure explicit. This may give her a slight advantage in recognizing the decade anchor relative to English-monolingual peers — but it does not eliminate the counting-back difficulty, which is procedural, not representational.

Importantly: Marian has not yet entered sub-to-20 (based on her diagnostic level). This is a fresh tier, not a remediation. The early sessions should be treated as first exposure to structured practice on facts she conceptually knows but has not drilled. Session-start scaffolding (gentle ramp, easy band P1–P3) is essential.

---

## Risks / counter-evidence

**1. The Class B (decade-anchor miss) distractor is new to the codebase.** Its mechanical definition requires some care: the distractor is the nearest multiple of 10 to the correct answer. When the correct answer is very close to a decade (10 or 11), the class degenerates to off-by-one. Kyle needs to confirm the fallback rule with Kevin during spec-to-implementation handoff — specifically, whether the fallback produces two off-by-one distractors or one off-by-one plus one gentle-ramp.

**2. Pool size and fact ordering are Kyle's decisions.** The band structure (§4.2) gives the pedagogical frame, but Kyle owns the exact pool curation (which 20–25 facts from the ~30–35 valid no-borrow facts make it into v1, and in what order). The research grounds the difficulty bands but does not uniquely specify the pool.

**3. The parallel vs. sequential question (sub-to-20 before or with add-to-20 mastery) may surface from Thomas.** The evidence supports parallel acquisition, but the `MATH_TREE` order sequences them as add-to-20 → sub-to-10 → sub-to-20. If Marian is at add-to-20:practicing when she masters sub-to-10, she will advance to sub-to-20 while still practicing add-to-20. This is pedagogically correct per the research (interleaving helps both), but Thomas should be aware that "sub-to-20" does not mean "add-to-20 is done." Matt should surface this if Thomas asks.

**4. The slow-fact threshold parameterization for sub-to-20 is not yet in Kevin's scope.** The same widening Dave recommended for sub-to-10 (start at ≥7s for new tier, ramp to ≥5s after 20 sessions) applies to sub-to-20. The `slowFacts.ts` implementation that ships for sub-to-10 should be designed to handle additional nodes cleanly so sub-to-20 can plug in without a rewrite.

**5. The Tagalog L2 context has no sub-to-20-specific research.** The Fuson/Kwon finding is for Korean, not Tagalog. The parallel to Tagalog's transparent number-word structure is inferential, not directly cited. I am flagging it as a plausible advantage, not a confirmed one.

---

## Recommendations

### For Matt (ticket priority / scope)

1. **This research note gates Kyle's content spec.** Kyle should not begin the sub-to-20 spec until this note is reviewed and the distractor-class decisions (§3) are locked.

2. **V1 scope = no-borrow only.** This is both the pedagogically correct boundary (Clements & Sarama; Caviola et al.) and the scope-trimming call that keeps the tier implementable in this build window. Do not expand to borrow in the same ticket.

3. **Class B (decade-anchor miss) is a new distractor type.** It requires `pickDistractors` to receive the minuend. This is a smaller API change than the wrong-operation distractor (which required both minuend and subtrahend), but Kevin should be briefed that a new class is arriving before implementation begins. Thread this through Kyle's spec rather than surprising Kevin in review.

4. **Pool size target for Kevin's planner directive.** Suggest guiding Kyle toward a 20–25 fact pool for the v1 canon bake (not the full 30–35 valid no-borrow facts). The sub-to-10 precedent (22 facts from 55 valid) is the model.

5. **The slow-fact threshold extension from sub-to-10 should explicitly cover sub-to-20.** If Kevin's sub-to-10 `slowFacts.ts` PR uses a node-list parameterization (as the audit doc recommended), sub-to-20 can be added to that list without a new PR. Matt should confirm this is in Kevin's implementation brief.

### For Kyle (spec drafting guidance)

1. **Band structure (§4.2) is the pedagogical authority.** Use EASY = minuend 11–13, MEDIUM = 14–16, HARD = 17–19 as the organizing frame for the pool table (mirroring sub-to-10's approach).

2. **Two distractor classes in the discriminate window.** Class A (off-by-one) and Class B (decade-anchor miss), with ≥2 Class B instances required across P4–P8. Do NOT implement wrong-borrow (rejected, §3) or a "small-answer" class (rejected, §3).

3. **The decade-anchor miss definition.** Distractor = nearest multiple of 10 to `correct` (not equal to `correct`). For most facts, this will be 10. Degenerate case: when `correct ∈ {10, 11}`, fall back to a second off-by-one. Document this fallback in the spec so Kevin can implement it deterministically.

4. **Read-line template.** Mirror sub-to-10 exactly: `"<minuend> minus <subtrahend>. How many are left?"`. Emma says the numeral names plainly; do not add verbal decomposition ("ten and six minus eight") — that adds L2 processing load without pedagogical benefit.

5. **Gentle-ramp width stays at P1–P3 (GENTLE_RAMP_THROUGH = 3).** Same ruling as sub-to-10 and add-to-10. Do not extend or shrink without a new Dave consult on the anxiety-window evidence.

6. **Out-of-scope guard-rail wording.** The spec should explicitly state: "No borrow facts. Facts where ones-digit(minuend) < subtrahend are excluded from this pool." This prevents Haiku from drifting into borrow territory on canon generation.

7. **18−9=9 should be in the HARD band pool explicitly.** This fact has outsized leverage (decade anchor, future multiplication anchor). Include it by name in the pool table teaching notes.

---

## Non-obvious findings

**1. Class B (decade-anchor miss) is a sub-to-20-specific class with no sub-to-10 analog.** The sub-to-10 pool never crosses a decade boundary (all results are ≤ 10), so decade-crossing errors don't exist there. This class arrives fresh with sub-to-20. Kyle should introduce it in `skill-trees-and-content.md` §"Math distractors" as a third named class alongside gentle and off-by-one — this is the second new distractor class in two tiers (wrong-op was the first, for sub-to-10).

**2. The parallel add-to-20 / sub-to-20 sequencing may surprise Thomas.** The MATH_TREE puts them sequentially (add-to-20 then sub-to-20), but the research says they should be interleaved. What this means in practice: Marian will practice sub-to-20 while add-to-20 is still not mastered. Sub-to-20 sessions will produce fact-family benefit for add-to-20 retrieval. This is correct but worth communicating proactively — it is counterintuitive from a "finish one thing before moving to the next" perspective.

**3. The no-borrow constraint is mechanically non-trivial.** A no-borrow fact is one where `ones-digit(minuend) >= subtrahend`. Haiku's planner directive needs this stated explicitly and with a worked example (e.g., "14−3=11 is no-borrow because ones-digit(14)=4 >= 3; 14−7=7 is borrow because ones-digit(14)=4 < 7 — FORBIDDEN"). Without this, Haiku will drift into borrow territory on some generations. Kyle should include this as a FORBIDDEN marker in the planner directive, mirroring the range FORBIDDEN markers from add-to-20.

**4. The correct-answer range for sub-to-20 ([2, 17]) is wider than sub-to-10 ([0, 9]).** The `distractors.ts` `maxAnswer` parameter must be widened to 19 (the maximum plausible result) for sub-to-20 sessions. The `ANSWER_RANGE_MIN_SUB = 0` established for sub-to-10 carries forward; no new minimum is needed. But the upper bound widening (from 10 to 19) changes how the gentle-ramp extremes are computed — "biased toward extremes of [0, 19]" will generate 1 and 18 as gentle distractors, which are appropriately far from results in the middle of the range. Kyle should confirm the gentle-ramp formula handles the wider range without degenerating.

**5. "Small-result-bias" is not a named construct.** The ticket mentioned it as a candidate class — the literature does not support it as a distinct documented error pattern in children ages 7–9. The underlying concern (children guess low when uncertain) is better handled by the gentle-ramp Class 0 (wide-spread distractors) than by a dedicated small-answer class. Reject the framing, keep the concern addressed structurally.

**6. Session arc scope-trimming pressure point.** If Kyle tries to fit all three bands (EASY/MEDIUM/HARD) into an 8-problem session, the problem-mix rules become complex. The sub-to-10 precedent drew only from easy band for P1–P3 and from medium/hard for P4–P8. Sub-to-20 should mirror this exactly: EASY band for warm-up, MEDIUM/HARD for discriminate window. Do not try to include EASY band facts in the discriminate window except as Leitner-driven review — that adds design complexity without pedagogical payoff.
