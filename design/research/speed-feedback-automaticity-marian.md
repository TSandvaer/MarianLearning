# Speed Feedback and Math Automaticity for Marian

> **Provenance:**
> Original note (Dave, 2026-05-15) was never committed to git; evidence chain lost.
> This is a RECONSTRUCTION authored 2026-06-11. The verdict is UNCHANGED from the original
> and was already implemented across sub-to-10 / sub-to-20 / add-to-20 specs before reconstruction.
> Claims quoted from citing specs are marked [restored from citing spec].
> Freshly re-derived evidence is marked [re-derived 2026-06-11].

---

## Question

Should the Marian Tutor app surface speed-based UI feedback — chip colour changes on slow taps, visible timers, streak-fade-on-slow, haptic urgency, or any other signal that communicates "that was too slow" to the child? And should response latency inform promotion gating in the mastery engine?

---

## Bottom line

**No speed-feedback UI of any kind.** No streak-fade-on-slow, no timer, no orange or yellow chip, no haptic urgency signal. The slow-fact directive is a backend planner re-targeting tool only — it biases which facts Haiku assigns to problems 4–8 in subsequent sessions so slower-retrieved facts get more spaced-repetition exposure. Latency is never shown to Marian, never colours a chip, never triggers a sound, and does not appear in promotion gating. Emma's reaction indexes on correctness alone. The ≥5 s threshold for addition (`op: '+'`) should be raised to ≥7 s for subtraction (`op: '-'`) in the first two months of a new subtraction tier to avoid over-flagging normal retrieval latency as pathological.

---

## Evidence

**Source 1 — Boaler, J. (2015). "Fluency Without Fear: Research Evidence on the Best Ways to Learn Math Facts." YouCubed, Stanford Graduate School of Education. https://www.youcubed.org/evidence/fluency-without-fear/**
[re-derived 2026-06-11]

Practitioner synthesis with embedded peer-reviewed citations (treat as moderate evidence for the primary claims; the underlying Ashcraft and Ramirez citations are independently strong). For approximately one-third of students, the onset of timed testing is the proximate cause of math anxiety onset. Speed pressure blocks working memory — students who know a fact fail to retrieve it under time pressure because the anxiety co-opts the same working-memory resources the retrieval depends on. Boaler argues that speed does not index mathematical understanding; mathematicians and high-achieving students tend to be slow, deep thinkers. The paper is widely critiqued for overstating the harm of brief timed practice (see McNeil et al. 2025 counter-nuance), but the core finding — that visible speed pressure harms children with emerging anxiety, especially girls and high-WM children who rely on WM-intensive strategies — is multiply replicated.

**Source 2 — Ramirez, G., Gunderson, E. A., Levine, S. C., & Beilock, S. L. (2013). "Math Anxiety, Working Memory, and Math Achievement in Early Elementary School." Journal of Cognition and Development, 14(2), 187–202. https://www.tandfonline.com/doi/abs/10.1080/15248372.2012.664593**
[re-derived 2026-06-11]

Strong evidence (controlled study, N=154 grade-1/2 children). Math anxiety negatively predicts achievement only in children with HIGH working memory capacity, not low. The mechanism: high-WM children use WM-intensive counting strategies; anxiety blocks those strategies and forces less efficient fallbacks. Implication for Marian: she is a high-conceptual-understanding child who currently finger-counts. Any UI feature that signals "you were too slow" will trigger exactly this interference effect — the anxiety consumes the WM she needs for the counting procedure, increasing errors without accelerating retrieval.

**Source 3 — Ashcraft, M. H., & Ridley, K. S. (2005). "Math anxiety and its cognitive consequences: A tutorial review." In J. I. D. Campbell (Ed.), Handbook of Mathematical Cognition (pp. 315–327). Psychology Press.**
[re-derived 2026-06-11]

Strong evidence (tutorial review synthesizing two decades of lab experiments). Math anxiety impairs working memory by consuming cognitive resources. Anxious individuals show slower response times and more errors on arithmetic tasks than less-anxious peers, even when their procedural knowledge is equivalent. The effect is specifically pronounced under speed conditions. Digital indicators of slowness (colour shift, timer countdown, auditory beep) are functionally equivalent to timed-test conditions in activating the anxiety-WM interference pathway.

**Source 4 — McNeil, N. M., Jordan, N. C., Viegut, A. A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. PubMed ID: 40297988. https://pubmed.ncbi.nlm.nih.gov/40297988/**
[re-derived 2026-06-11]

Strong evidence (systematic review + meta-analysis; behavioral, longitudinal, neuroimaging, and design-based research combined). The review DOES support brief timed practice — but only after accuracy is established, and only in structured sessions with reflection. It explicitly distinguishes automaticity (effortless fast retrieval) from speed pressure (performance incentive under visible urgency). The recommended instructional cycle is: conceptual grounding → accuracy-building practice → brief timed sessions → reflective discussion. Timed feedback before accuracy is established is specifically called out as harmful to motivation without accelerating learning. The implication for this app: Marian is in the accuracy-building phase; visible speed feedback is premature by the authors' own criterion.

**Source 5 — Codding, R. S., Burns, M. K., & Lukito, G. (2011). "Meta-Analysis of Mathematic Basic-Fact Fluency Interventions: A Component Analysis." Learning Disabilities Research & Practice, 26(1), 36–47.**
[re-derived 2026-06-11; citation verified via ResearchGate abstract]

Strong evidence (meta-analysis of fluency interventions). Interventions that increase rate of accurate responding — spaced retrieval, timed practice of already-accurate responses, incremental rehearsal — consistently improve automaticity. The key finding for this project: **accuracy must precede speed**. Interventions that introduce timing before accuracy is high produce gains on speed metrics but not on transfer or retention. The Leitner-box spaced-retrieval mechanism already in this codebase is exactly the class of intervention the meta-analysis identifies as highest-ROI for the accuracy-to-fluency transition.

**Source 6 — Geary, D. C., Hoard, M. K., Byrd-Craven, J., Nugent, L., & Numtee, C. (2007). "Cognitive mechanisms underlying achievement deficits in children with mathematical learning disability." Child Development, 78(4), 1343–1359. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/**
[restored from citing spec — `sub-to-10-fact-sequencing-marian.md` §Evidence Source 6 cites "same Geary lab cited in `speed-feedback-automaticity-marian.md`"]

Strong evidence (multiple grade cohorts, controlled experimental design). Subtraction retrieval mean RT in 2nd graders (age ~7–8) is higher and more variable than addition RT for identical number triplets. Subtraction lacks the rehearsal scaffolding addition gets from the counting-on procedure (which simultaneously rehearses the addition encoding). A child answering `8 − 3 = ?` by counting back will have a naturally longer latency than answering `5 + 3 = ?` by counting on — this is procedural, not a deficit. Applying the same latency threshold across operations will over-flag normal subtraction latency as pathological, triggering the slow-fact directive on every new subtraction problem from session 2 onward. The calibration fix: raise the threshold for `op: '-'` to ≥7 s for the first two months of a new subtraction tier.

**Source 7 — Poletti, C., Krenger, M., Létang, M., Hennequin, B., & Thevenot, C. (2025). "Finger counting training enhances addition performance in kindergarteners." Child Development, 96(1), 251–268. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11693818/**
[re-derived 2026-06-11; also cited in `add-to-10-counting-to-recall.md` §Source 4 and `add-to-20-cross-10-bridge-errors-marian.md` §Source 9]

Strong evidence (three replications; RCT with active control; N=328 + replications). Finger counting is a scaffold TOWARD retrieval, not an obstacle. Children who used fingers historically and then spontaneously dropped them outperformed peers who never used fingers. The positive correlation between finger use and math skill reverses at around ages 8–9; children still predominantly finger-counting past that point "have failed to internalize their strategies." This is the window Marian is currently entering. Critically: the internalization happens through accumulated retrieval experience, not through removing the scaffold or applying speed pressure. Any UI signal that shames or penalises finger-counting latency would interrupt the natural transition at the worst possible moment. [Also cited in `sub-to-10-fact-sequencing-marian.md` line 70 as evidence that "finger counting for subtraction at age 8 is developmentally appropriate and will fade naturally as retrieval builds."]

---

## Application to Marian

Marian is 8, Tagalog-primary, entering the ages-8–9 window that Poletti et al. (2025) identify as the critical finger-counting-to-retrieval transition. She currently shows 100% finger reliance on add-to-10 (April 2026 diagnostic). She is high-conceptual: she understands operations, self-corrects, and has subtraction-within-15 confidence.

Speed-feedback UI would specifically harm her profile because:

1. She is in the accuracy-building phase (McNeil et al. 2025). Speed pressure is premature by the literature's own criterion.
2. She is a high-WM child who relies on procedural counting. Anxiety from speed signals will block those procedures (Ramirez et al. 2013).
3. She is entering the natural finger-counting transition window. Interrupting this with shame-adjacent signals would disrupt the spontaneous internalization (Poletti et al. 2025).
4. She is an L2 English learner. There is a small additional WM overhead for English-language arithmetic (Cerda et al. 2024, cited in `sub-to-10-fact-sequencing-marian.md`). Any WM drain from speed anxiety compounds this.

The slow-fact directive solves the legitimate problem — ensuring slow-but-correct facts get more spaced-retrieval exposure — without any child-facing signal. The planner silently biases Haiku to put slow facts at problems 4–8 in subsequent sessions. Marian never sees a clock, a chip-colour change, or any indication that her previous response was timed.

---

## Risks / counter-evidence

**McNeil et al. (2025) nuance:** The systematic review explicitly endorses brief timed practice and does NOT support Boaler's stronger claim that all timed practice harms all children. The key distinction: McNeil et al. endorse timed SESSIONS (a time limit on a block of problems) as distinct from visible per-problem speed feedback. This reconstruction's verdict is scoped to visible UI speed signals (chip colour, timer, haptic). A future timed-session mode — if Thomas requests it — would sit in mixed-evidence territory (potentially beneficial for Marian once her accuracy is reliably high; potentially harmful before then). The no-speed-feedback-UI verdict applies to per-problem visible signals specifically.

**Operational over-flagging risk:** If the slow-fact threshold is not operation-parameterised, the `slowFacts` payload will contain nearly every subtraction fact during the first 5–10 `sub-to-10` sessions (because all new subtraction retrieval is slow relative to the add-to-10 norm). This would bypass canon for every session, defeating the fast path. The fix — op-specific thresholds — is flagged in `sub-to-10-fact-sequencing-marian.md` §Non-obvious findings #1 and is a Kevin code task, not a UI task.

---

## Recommendations

**Recommendation 1** [restored from citing spec]: NO speed-feedback UI of any kind. This is a locked decision. No streak-fade-on-slow, no timer, no orange or yellow chip, no haptic urgency signal. This applies to all math tiers, current and future.

**Recommendation 2** [restored from citing spec]: The slow-fact directive is a backend re-targeting tool only. It tells the Haiku planner to surface slow facts at problems 4–8 in subsequent sessions. It does not create a child-facing signal.

**Recommendation 3**: Emma's reaction must index on CORRECTNESS, not speed. A correct-but-slow answer gets the same celebration as a fast one. This is non-negotiable given Marian's profile and the Ramirez / Ashcraft evidence chain.

**Recommendation 4**: The add-to-10 slow-fact threshold is ≥5 s (grounded in Geary lab data showing 2nd-grade retrieval mean ~2,800 ms with SD ~1,900 ms — per `add-to-10-counting-to-recall.md`). This threshold is addition-specific.

**Recommendation 5**: For new subtraction tiers (`sub-to-10`, `sub-to-20`), the initial threshold should be ≥7 s for the first 10 sessions, dropping to ≥6 s after 10 sessions, then ≥5 s after 20 sessions. This prevents the slow-fact payload from overriding canon on every session in the baseline phase. [See `sub-to-10-fact-sequencing-marian.md` §Non-obvious findings #1.]

**Recommendation 6**: The slow-fact threshold parameterisation is a `slowFacts.ts` code task (`op: '-'` gets a higher threshold than `op: '+'`). This should be filed as a Kevin ticket, not a design or UX task.

**Recommendation 7** [restored from citing spec — `sub-to-10-content.md` line 373 attributes this explicitly to "Dave's `speed-feedback-automaticity-marian.md` § Recommendation 7"]: Latency median is NOT a promotion gate. The mastery rule promotes on accuracy alone (95/3 for math, per the locked default in `progress-and-persistence.md`). The `add-to-20 → sub-to-10` transition (and by extension all subtraction tier transitions) must advance on accuracy even when the slow-fact list is large. Holding Marian on a tier past 95% accuracy waiting for latency to drop is developmentally backwards — fact-family exposure via the subtraction tier is itself part of the treatment for slow upstream addition facts (McNeil et al. 2025). Any future code path that gates promotion on slow-fact list length would violate this principle.

---

## Sources

| #   | Citation                                                                                                                                                                                      | Strength                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Boaler, J. (2015). "Fluency Without Fear." YouCubed. https://www.youcubed.org/evidence/fluency-without-fear/                                                                                  | Moderate (practitioner synthesis with embedded peer citations)                                       |
| 2   | Ramirez, G., Gunderson, E. A., Levine, S. C., & Beilock, S. L. (2013). Journal of Cognition and Development, 14(2), 187–202. https://www.tandfonline.com/doi/abs/10.1080/15248372.2012.664593 | Strong                                                                                               |
| 3   | Ashcraft, M. H., & Ridley, K. S. (2005). In Campbell (Ed.), Handbook of Mathematical Cognition, pp. 315–327. Psychology Press.                                                                | Strong (tutorial review)                                                                             |
| 4   | McNeil, N. M., Jordan, N. C., Viegut, A. A., & Ansari, D. (2025). Psychological Science in the Public Interest, 26(1), 10–57. https://pubmed.ncbi.nlm.nih.gov/40297988/                       | Strong                                                                                               |
| 5   | Codding, R. S., Burns, M. K., & Lukito, G. (2011). Learning Disabilities Research & Practice, 26(1), 36–47. [abstract verified via ResearchGate]                                              | Strong (meta-analysis)                                                                               |
| 6   | Geary, D. C., Hoard, M. K., Byrd-Craven, J., Nugent, L., & Numtee, C. (2007). Child Development, 78(4), 1343–1359. https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/                          | Strong — [restored from citing spec; full citation present in `sub-to-10-fact-sequencing-marian.md`] |
| 7   | Poletti, C., Krenger, M., Létang, M., Hennequin, B., & Thevenot, C. (2025). Child Development, 96(1), 251–268. https://pmc.ncbi.nlm.nih.gov/articles/PMC11693818/                             | Strong (RCT + replications)                                                                          |
