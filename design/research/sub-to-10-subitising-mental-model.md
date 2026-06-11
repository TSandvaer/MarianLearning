# Sub-to-10 Subitising Mental Model

**Ticket:** `86ca7j4xv`
**Date:** 2026-06-11
**Gates:** W10.2 — Kyle's sub-to-10 subitising scaffold spec. Kyle cannot begin until this note is reviewed and the three recommendations are locked.

---

## Question

Three open questions from `design/math/subitising-scaffold-content.md` §7.2/§8.1, deferred at add-to-10 spec time:

1. **Mental model.** How does subitising work for *take-from-one-quantity* subtraction vs the shipped *combine-two* addition model? The add-to-10 two-cell combine layout does not map directly.
2. **Visual primitive.** Does the dot-card show the minuend and fade subtrahend pips, or is a different primitive pedagogically correct for a 7-9-year-old bridging counting→retrieval?
3. **Fluency-fade signal.** Re-use `profile.subitisingScaffoldSessionsObserved`, or a per-tier counter for `sub-to-10`?

---

## Bottom line

1. **Mental model: single-cell decomposition, not two-cell combine.** Subtraction is *take-from-one-quantity*, not *combine-two*. Show one dot-card (the minuend). There is no second addend cell for a subtrahend. The pedagogical aim is building a stable quantity image of the minuend so the child can derive the remainder by part-whole reasoning or by counting back from a recognised pattern — not by combining two subitised sets. Subtraction fluency develops via automatisation of quantity-based procedures, not via verbal retrieval (Suárez-Pellicioni et al. 2020 — see Evidence §3); the scaffold should reinforce the quantity representation of the start-number, not attempt to scaffold the subtraction step itself.

2. **Visual primitive: single minuend cell, static, no pip-fade.** Show only the minuend pips (the one quantity Marian starts from). Do NOT attempt to animate subtrahend removal — fading pips is a dark-pattern–adjacent timed mechanic that increases cognitive load at decision time without adding a recognition benefit. The minuend cell is the complete visual scaffold; the subtraction action and its result are what Marian must derive. This preserves the anti-dark-pattern properties of the add-to-10 design and is grounded in how subitising functions at this developmental stage (Clements & Sarama 2020 — conceptual subitising supports part-whole decomposition; Fuson & Kwon 1992 — recognition of the start-number as a quantity is the key cognitive anchor for teen subtraction).

3. **Fluency-fade signal: per-tier counter (`sub-to-10` specific), not re-use of the existing `subitisingScaffoldSessionsObserved`.** Addition and subtraction automaticity develop via distinct neural pathways (Suárez-Pellicioni et al. 2020; see Evidence §3). Marian may be fluent on EASY-band addition facts while still heavily counting-back on EASY-band subtraction facts. The Leitner box is already operation-specific (`MathFact { a, b, op: '+' | '-' }`); the fade signal should match. Use a new `subitisingScaffoldSubSessionsObserved` field (or, more cleanly, make the existing field a per-tier map) with its own EASY-band Leitner mean computed over subtraction facts only. Reusing the add-to-10 counter would cause the scaffold to fade on sub-to-10 based on addition fluency evidence — which does not transfer.

---

## Evidence

### §1 — Developmental model: subitising for subtraction in 7-9 year olds

**Source 1 — Clements, D.H., & Sarama, J. (2020). *Learning and Teaching Early Math: The Learning Trajectories Approach*, 3rd ed. Routledge.**
Strong evidence (comprehensive synthesis of longitudinal and experimental research on early mathematics learning trajectories). The learning trajectory for subitising distinguishes *perceptual subitising* (immediate quantity recognition, 1-4 objects, dominant ages 3-6) from *conceptual subitising* (recognising subsets and combining, dominant ages 5-9). At age 8, Marian is in the late-conceptual-subitising window: she can see a five-pip die face and *know* 5 without counting. The learning trajectory's subtraction strand places the ability to "see the minuend as a whole and decompose it" as a mid-Grade-2 level skill — i.e., squarely at Marian's developmental position. Conceptual subitising builds *part-whole knowledge*: knowing that 8 = 5+3 means knowing that 8−3 = 5 without counting. This is the cognitive bridge from counting-back to retrieval-or-derivation for subtraction.

**Source 2 — Baroody, A.J. (1984). "Children's Difficulties in Subtraction: Some Causes and Questions." *Journal for Research in Mathematics Education*, 15(3), 203–213. NCTM. https://eric.ed.gov/?id=EJ300404**
Strong evidence (foundational, widely replicated). Baroody established that the cognitive anchor for subtraction in young children is the *start-number* (the minuend), not the result. Children count back from the minuend; the minuend is what they hold in working memory. A scaffold that makes the minuend instantly recognisable (without counting) shortens the first phase of the counting-back chain — and shortens it at the step where working memory load is highest. This is the precise mechanism by which a single-cell minuend dot-card would reduce cognitive load on EASY-band subtraction facts.

**Source 3 — Fuson, K.C., & Kwon, Y. (1992). "Korean Children's Single-Digit Addition and Subtraction: Numbers Structured by Ten." *Journal for Research in Mathematics Education*, 23(2), 148–165. NCTM. https://pubs.nctm.org/view/journals/jrme/23/2/article-p148.xml**
Strong evidence (controlled interview study, Korean vs. American children on single-digit arithmetic with minuends 10–18). Established that the DECADE (10) is the primary cognitive anchor for teen subtraction, and that children who have a stable mental image of the minuend as a composed quantity (e.g. 13 = 10+3) outperform those who do not. The mechanism is recognising the start-number as a known quantity, then deriving — not subitising the operation or the result. The implication for the visual primitive is direct: the scaffold should show the minuend quantity image, and nothing more.

### §2 — Why "take-from-one-quantity" does not admit a two-cell layout

**Source 4 — Baroody, A.J. (2006). "Why Children Have Difficulties Mastering the Basic Number Combinations and How to Help Them." *Teaching Children Mathematics*, 13(1), 22–31. https://www.kentuckymathematics.org/docs/eerti-BaroodyTCM2006.pdf**
Moderate evidence (practitioner synthesis grounded in replicated empirical work). Baroody identifies two structurally different subtraction strategies that children use at age 7-9:
- *Counting-back*: start from the minuend, count down subtrahend steps. Cognitive bottleneck: the minuend as a start-number.
- *Think-addition* (indirect addition): "8 minus 5 — what adds to 5 to make 8?" Cognitive bottleneck: recognising the relation, not the start-number.

The add-to-10 scaffold's two-cell combine layout (cell A + cell B → sum) is the *think-addition* model. It would be pedagogically coherent for a child using think-addition on sub-to-10 (and ~10% of children aged 6-7 do, per Robinson et al. 2013). However, Marian is a confirmed counting-back child (diagnostic: "finger counts subtraction count-backs"). For her, the cognitive bottleneck is the minuend, not the relation. Showing two cells — minuend and subtrahend — maps to neither the counting-back model (which needs only the start-number) nor the think-addition model (which needs the *result* plus the subtrahend, not the minuend and subtrahend). A two-cell layout would model an operation that Marian does not use and add a second visual unit that competes with the meaningful one.

**Speculative note.** If Marian transitions to think-addition strategies (expected at ages 8-10 for single-digit subtraction), a two-cell layout with *subtrahend + result = minuend* would become relevant. This is out of scope for v1; the spec should note it as a future extension.

### §3 — Subtraction automaticity vs addition automaticity: distinct pathways

**Source 5 — Suárez-Pellicioni, M., Berteletti, I., & Booth, J.R. (2020). "Early Engagement of Parietal Cortex for Subtraction Solving Predicts Longitudinal Gains in Behavioral Fluency in Children." *Frontiers in Human Neuroscience*, 14, 163. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC7264824/**
Strong evidence (longitudinal, neuroimaging study, N=46, grades 3-8, ~2-year follow-up). Key findings directly load-bearing on Q3:
- Children who improved in subtraction fluency showed *decreased parietal activation* over time — consistent with the Schema-based hypothesis that subtraction fluency develops by *procedural automatisation* (quantity-based procedures becoming faster), NOT by retrieval from verbal memory (which would predict decreased temporal/hippocampal activation, the pattern seen in addition).
- Subtraction and addition recruit *distinct neural networks* even for single-digit problems. Different operations undergo different developmental trajectories.
- The practical implication: a child's Leitner box performance on addition facts is NOT a valid proxy for their subtraction procedure fluency. Addition fluency accumulates via fact-memory consolidation; subtraction fluency accumulates via procedural automatisation. The two do not transfer directly.

This finding is the single most important piece of evidence for Q3. If subtraction fluency has its own developmental trajectory, the fade signal for a subtraction scaffold must track subtraction performance, not addition performance.

**Source 6 — Robinson, K.M., Ninowski, J.E., & Gray, M.L. (2013). "Young children's use of derived fact strategies for addition and subtraction." *Frontiers in Human Neuroscience*, 7, 924. https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/**
Strong evidence (controlled study, multiple age cohorts, 6-7-year-olds; findings replicated in subsequent work; already cited as a grounding source in `sub-to-20-pedagogical-sequence.md`). Off-by-one (counting-back error, missing one step) is the most common systematic subtraction error; think-addition is used by only ~10% of children at age 6-7. The dominance of counting-back at Marian's starting point supports the counting-back-focused minuend scaffold design, and confirms that the add-to-10 EASY band's Leitner mean is measuring something cognitively distinct from sub-to-10 EASY-band performance.

**Source 7 — Caviola, S., Gerotto, G., Lucangeli, D., & Mammarella, I.C. (2018). "Children's Strategy Choices on Complex Subtraction Problems." *Frontiers in Psychology*, 9, 1209. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC6057409/**
Strong evidence (controlled study, grades 3 and 5; already cited in `sub-to-20-pedagogical-sequence.md`). Strategy use on subtraction is malleable by problem characteristics, not fixed by overall arithmetic level. A child's performance on addition problems does not predict which subtraction strategy they will use. This is independent corroboration of the separate-pathways finding: subtraction strategy profiles do not follow directly from addition fluency.

### §4 — On the pip-fade / animated-removal alternative

No peer-reviewed source supports animated pip-fade as a subitising scaffold. The subitising literature consistently positions the benefit of dot-card displays as *instantaneous recognition* — the quantitative perception occurs in a single, brief static exposure (Clements & Sarama 2020, §1 above). Any animation timed to the subtraction action would:
1. Replace instantaneous recognition with sequential attention, which is the opposite of subitising.
2. Add a timed mechanic to the problem display, increasing cognitive load at decision time — the same concern that grounded the anti-dark-pattern audit in `subitising-scaffold-content.md` §6.6.
3. Risk feeling like a forced "count the disappearing pips" exercise, which would train counting, not recognition.

Practitioner consensus (Hechinger Report 2023 article on Clements's work; Math Is Visual practitioner resources) also positions the dot-card as a static flash, not an animation. There is no empirical basis for animated-removal as a subitising mechanism.

---

## Application to Marian

**Marian's diagnostic entry point:** sub-to-10 `practicing` level at app launch (diagnostic May 2026); she finger-counts subtraction count-backs. The EASY band (`5−5, 8−4, 6−3, 9−1` per `sub-to-10-content.md` §1.1) is where the scaffold fires first.

**Q1 (mental model):** All four EASY-band facts have minuends 5-10, squarely in perceptual subitising range for an 8-year-old. Marian can recognise 8 pips, 5 pips, 6 pips, 9 pips instantly if she has been exposed to those patterns. The add-to-10 scaffold (running for weeks by the time sub-to-10 launches) will have already trained these quantity images. The sub-to-10 scaffold capitalises on that existing recognition pathway, focusing it on the minuend-as-start-number.

**Q2 (visual primitive):** Single cell, static, 8 pips for `8−4`, 6 pips for `6−3`, etc. The existing `<DotCard pips={n} />` component already supports 1-5 pips. For sub-to-10 EASY band, minuends are 5-10; pips 5 and 6 are within the existing vocabulary; 7, 8, 9, 10 would require new die-face layouts (six-pip canonical die face, or two-row-of-four/five patterns). Kyle's spec must resolve whether to extend pip vocabulary to 6-10 or restrict the scaffold to facts with minuend ≤ 5. See Risks §1 below.

**Q3 (fluency-fade signal):** Marian's add-to-10 EASY-band Leitner mean will be high (she's been practicing add-to-10 for months) when sub-to-10 launches. If the same counter were reused, the sub-to-10 scaffold would already be in late-fade mode on Day 1. That is incorrect. She needs the scaffold on sub-to-10 EASY band unconditionally for at least 3 sessions (matching the add-to-10 first-encounter gate logic) and then faded based on her *subtraction* Leitner performance. A separate counter is the only safe path.

**L2 note:** Tagalog number words are structurally transparent (labing-walo = 18, literally "ten-eight"), giving Marian a mild advantage on the place-value mental model for the minuend. Her internal representation of the start-number is likely more structured than an English-monolingual peer's. The minuend scaffold reinforces this structured representation in the L2 (English) context where she is operating.

---

## Risks / counter-evidence

**1. Pip vocabulary ceiling at 5.** The current `<DotCard>` design covers pips 1-5 (canonical Western die faces). Sub-to-10 EASY-band minuends are 5-10. Pip patterns for 6-10 do not have a canonical die-face precedent; introducing them risks adding unfamiliar visual vocabulary rather than leveraging recognition. Two options, each with trade-offs:
   - **Restrict the scaffold to facts where minuend ≤ 5.** Of the four EASY-band facts (`5−5, 8−4, 6−3, 9−1`), only `5−5` has a minuend ≤ 5. This makes the scaffold nearly inert for the EASY band — inadequate exposure.
   - **Extend the pip vocabulary to 6-10.** Requires new visual designs (6 = 2-rows-of-3; 7 = 2-rows-of-3 plus centre; 8 = 4×2 grid; 9 = 3×3 grid; 10 = 2-rows-of-5). These are recognisable from domino and dice contexts, but their pedagogical effectiveness for subitising at age 8 has weaker evidence than pips 1-5 (perceptual subitising ceiling for canonical die patterns is typically cited as 4-6; recognition of 7-10 requires conceptual subitising, which is slower and more effortful). Kyle's spec must make this call; this research note flags the tension.
   - **Recommended resolution (speculative):** Extend to 6-8 only (domino-style two-row patterns) and restrict the scaffold to EASY-band facts with minuend ≤ 8. This covers three of four EASY-band facts (`8−4, 6−3` are in; `9−1` borderline at 9 pips; `5−5` is the trivial doubles fact). Kyle should confirm with the screen-layer design.

**2. Suárez-Pellicioni et al. (2020) studied ages 11-13 at time 1.** The study's sample was older than Marian. The *direction* of the finding (subtraction via procedural automatisation, not retrieval) is consistent with younger-age studies, but the neuroimaging evidence is from a more mature brain. The claim that addition and subtraction have distinct developmental pathways at age 8 is well supported by the behavioural literature (Robinson 2013; Caviola et al. 2018; Fuson & Kwon 1992) even if the neuroimaging evidence for age 8 specifically is limited.

**3. Some children at age 8 do use think-addition for subtraction.** Robinson et al. (2013) found ~10% of 6-7-year-olds use derived-fact strategies for subtraction. If Marian transitions to think-addition strategies as she matures — which is expected and desirable — a single-cell minuend scaffold becomes less relevant (think-addition needs the result-as-missing-addend, not the minuend). The scaffold should be designed with natural obsolescence: it fades when fluency rises regardless of which strategy she uses.

**4. No direct RCT on single-cell minuend dot-card for subtraction.** The specific "show one pip-cell for the minuend" design is extrapolated from the subitising literature (Clements & Sarama 2020) and the Baroody counting-back model, not directly tested. The design is theoretically grounded but not empirically validated at this level of specificity. This is a judgment call applying established principles to a novel design, not citing a directly comparable study.

---

## Recommendations

### For Matt (ticket priority / scope)

**This note gates W10.2 (Kyle's spec).** No implementation action follows before Kyle's spec is reviewed.

1. **The single-cell minuend scaffold is the correct approach for v1.** Recommend Kyle's spec use one pip-cell (the minuend) and no subtrahend visual. This is the right design for Marian's counting-back profile, is grounded in the Baroody cognitive bottleneck model, and avoids the complexity of animated-removal (no evidence base; anti-dark-pattern risk).

2. **The pip vocabulary extension question (minuend 6-10) should be resolved in Kyle's spec**, not in this research note. The risk is real: extending pip patterns beyond canonical die faces introduces unfamiliar visual vocabulary. Kyle should anchor the v1 scaffold to a pip range where recognition is reliable (recommended: up to 8 using domino-style two-row patterns; not 9 or 10 until empirical data supports it).

3. **The fluency-fade signal MUST be a per-tier counter/map, not the existing `subitisingScaffoldSessionsObserved` field.** The evidence for separate addition/subtraction developmental pathways (Source 5) makes cross-operation signal reuse a reliability defect, not a minor implementation shortcut. Recommend a new `Profile` field: either `subitisingScaffoldSubSessionsObserved: number` (simplest) or a refactor of the existing field to `subitisingScaffoldSessionsObserved: Record<'add-to-10' | 'sub-to-10', number>` (cleaner, forward-compatible for future tiers). Implementation choice is Kevin's; the principle is this note's call.

4. **The Leitner-mean fade signal should use sub-to-10 subtraction facts only.** When computing `easyBandLeitnerMeanBox` for the sub-to-10 scaffold fade, filter `mathFactsLeitner` to items where `fact.op === '-'` and the fact is in the EASY band. Do NOT include addition facts. This is implied by the separate-pathways evidence but worth stating explicitly for Kevin's implementation brief.

### For Kyle (spec guidance)

1. **Single pip-cell (minuend only).** The spec should specify `<DotCard pips={problem.a} />` where `problem.a` is the minuend. No second cell. No subtrahend representation. The empty space to the right of the minuend cell is intentional — it represents the unknown.

2. **Decide pip range.** The spec must pick a ceiling: 5 (existing vocabulary only — restricted but safe), 8 (extend with domino patterns — recommended), or 10 (extend further — weaker evidence). This is a Kyle decision with research framing from this note; the recommendation is 8.

3. **The trigger predicate changes.** Add-to-10's trigger is `problem.a ≤ 5 && problem.b ≤ 5`. Sub-to-10's trigger is `problem.a ≤ [pip-ceiling]` (minuend only; subtrahend is irrelevant to the visual). Update `shouldShowSubitisingScaffold()` or the spec's trigger table accordingly.

4. **The per-session all-or-nothing determinism principle carries over unchanged.** This is a dark-pattern protection, not a sub-to-10-specific design (see `subitising-scaffold-content.md` §2.3). No change needed here.

5. **Emma's voice stays constant.** Same lock as add-to-10 — no new TTS line, no "look at the dots" narration. Emma's existing `math.p{N}.read` ("Eight minus four. How many are left?") plays over the static minuend cell.

6. **`FIRST_ENCOUNTER_SESSIONS = 3` should apply independently for sub-to-10.** Marian may reach sub-to-10 weeks or months after the add-to-10 scaffold ships; her first 3 sub-to-10 sessions should be unconditional-scaffold regardless of her add-to-10 scaffold history.

---

## Non-obvious findings

1. **Subtraction fluency develops via procedural automatisation, not verbal retrieval.** The Suárez-Pellicioni et al. (2020) finding (parietal, not temporal, engagement drives subtraction gains) means that the Leitner box — which was designed to drive retrieval consolidation — is still a valid signal for when subtraction *procedures* have become automatic (faster, lower-effort), even if the underlying mechanism differs from addition. The fade threshold logic is sound; the issue is that the signal must be sourced from subtraction Leitner data, not addition.

2. **Two-cell combine is wrong for subtraction — but not always wrong.** If Marian transitions to think-addition strategies (expected around ages 8-10), a two-cell display showing subtrahend + gap = minuend would be pedagogically coherent. The current spec should note this as a future extension (§8 tracked follow-up in Kyle's spec) rather than foreclosing it.

3. **The EASY-band facts for sub-to-10 have minuends 5-10, not 1-5.** This is a non-obvious mismatch with the add-to-10 scaffold design, where the pip vocabulary (1-5) exactly matches the in-scope band. For sub-to-10, the pip vocabulary must either be extended or the in-scope band must be narrowed. This tension should be surfaced in Kyle's spec as an explicit design decision, not an implementation detail.

4. **A separate-pathways view has a scope implication for the app architecture.** The progress model's `mathFactsLeitner` stores `{ a, b, op }` facts, meaning add-to-10 (`op: '+'`) and sub-to-10 (`op: '-'`) facts are already tracked separately. The fade signal computation just needs to filter on `op: '-'` — no schema change required. Devon should note this when implementing the fluency-fade gate for sub-to-10.

---

## Sources (canonical IDs)

- Clements, D.H., & Sarama, J. (2020). *Learning and Teaching Early Math: The Learning Trajectories Approach*, 3rd ed. Routledge.
- Baroody, A.J. (1984). Journal for Research in Mathematics Education, 15(3), 203–213. https://eric.ed.gov/?id=EJ300404
- Fuson, K.C., & Kwon, Y. (1992). Journal for Research in Mathematics Education, 23(2), 148–165. https://pubs.nctm.org/view/journals/jrme/23/2/article-p148.xml
- Baroody, A.J. (2006). Teaching Children Mathematics, 13(1), 22–31. https://www.kentuckymathematics.org/docs/eerti-BaroodyTCM2006.pdf
- Suárez-Pellicioni, M., Berteletti, I., & Booth, J.R. (2020). Frontiers in Human Neuroscience, 14, 163. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC7264824/
- Robinson, K.M., Ninowski, J.E., & Gray, M.L. (2013). Frontiers in Human Neuroscience, 7, 924. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/
- Caviola, S., Gerotto, G., Lucangeli, D., & Mammarella, I.C. (2018). Frontiers in Psychology, 9, 1209. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC6057409/
