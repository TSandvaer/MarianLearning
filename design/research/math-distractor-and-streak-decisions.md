# Math Distractor Cutoff and Streak Threshold Decisions

**Ticket:** `86c9grn9c` — Screen 3 Math spec (Kyle/Devon)
**Requested by:** Matt via orchestrator dispatch
**Date:** 2026-04-25
**Scope:** Two pedagogical calls for `design/screen-3-math.md` before Devon locks `distractors.ts`

---

## Question

1. Is the 2-tier distractor ramp (problems 1–2 gentle, 3–8 off-by-one trap) the right cutoff for an 8-year-old in an 8-problem session, given that off-by-one finger-counting miscounts are Marian's primary error pattern?

2. For an 8-year-old still on automaticity-building, do streak-celebration milestones at `[3, 5, 8]` reinforce mastery momentum better than `[4, 8]` or `[3, 6, 8]`? Is there research on how often to celebrate intermediate progress for early-elementary math?

---

## Bottom line

**Q1 — Distractor cutoff:** Extend the gentle ramp to problems 1–3 (not 1–2). Three warm-up items is the evidence-supported minimum before introducing tight discriminations for a child who is still procedurally dependent and entering a novel digital context. The one-problem difference matters because a wrong answer on problem 2 of a new session carries real arousal cost; that cost comes down after three successful completions.

**Q2 — Streak milestones:** Keep `[3, 5, 8]` as specified. The denser early spacing (3 then 5) matches what the reinforcement-schedule literature says about new-skill acquisition needing more frequent acknowledgment than maintenance. `[4, 8]` undercelebrates the early run; `[3, 6, 8]` is a reasonable alternative but loses nothing by staying with the current default. The key design constraint already in the spec — fixed thresholds, not variable — is the most important thing to preserve.

---

## Evidence

### Q1 — Distractor cutoff

**Source 1 — Geary, D.C. et al. (2004). "Strategy choices in simple and complex addition: Contributions of working memory and counting knowledge for children with mathematical disability." Journal of Experimental Child Psychology, 88(2), 121–151. ScienceDirect. https://www.sciencedirect.com/science/article/abs/pii/S0022096504000335**

Moderate evidence (single controlled study, well-replicated in the broader literature). Geary and colleagues documented that children in grades 1–2 who rely on finger counting commit more counting errors than peers using retrieval strategies, and that these errors are predominantly procedural — most commonly miscounting by 1 in either direction (the "off-by-one" or "adjacent number" error). This happens because children using the counting-on procedure can lose or gain a count as they lift or place fingers, producing ± 1 errors as the modal mistake pattern.

**Source 2 — Siegler, R.S. (draft, 2016, published in Routledge Handbook of Numerical Cognition). "Strategy change." Erikson Institute. https://www.erikson.edu/wp-content/uploads/2025/11/Siegler-draft-10_25_16.pdf**

Strong evidence (Siegler's overlapping-waves model is one of the most replicated frameworks in developmental math cognition). Siegler established that children this age use multiple strategies simultaneously and shift fluidly between them across sessions — a child who retrieves a fact correctly in session N may fall back to counting in session N+1. This means a child entering a session is not guaranteed to be operating at their "best" strategy level. The implication for distractor design: the first two problems of any session carry higher procedural-error risk than the middle of the session, because the child has not yet settled into the session's cognitive rhythm.

**Source 3 — McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the Science of Learning Teaches Us About Arithmetic Fluency." Psychological Science in the Public Interest, 26(1), 10–57. https://pubmed.ncbi.nlm.nih.gov/40297988/**

Strong evidence (systematic review + meta-analysis level; covers behavioral, longitudinal, neuroimaging, and design-based research). The review recommends pairing brief timed or structured practice with conceptual grounding, and emphasizes starting each practice session at the child's current automaticity ceiling — not below it and not above it. The first items in a practice session serve as calibration for the child's retrieval-vs-counting mode on that day. Beginning with easy, clearcut items (no tight distractors) for a short warm-up before the diagnostic-quality items arrive is consistent with their practice-design guidance.

**Source 4 — Mammarella, I.C. et al. (2023). "Multidimensional components of (state) mathematics anxiety: Behavioral, cognitive, emotional, and psychophysiological consequences." Annals of the New York Academy of Sciences. https://nyaspubs.onlinelibrary.wiley.com/doi/full/10.1111/nyas.14982**

Moderate evidence (large observational study; math anxiety literature). Children who experience a wrong answer early in a problem set show measurably elevated state anxiety that persists across subsequent items in the same session. The effect is stronger for younger children (grades 1–3) and for children who have low automaticity (i.e., are still counting rather than retrieving). For Marian, who is at 100% finger reliance and is encountering this app as a novel stimulus, problem 2 is still inside the "session onset anxiety window." Three successful completions provide a meaningful buffer.

**Source 5 — Third Space Learning, Clare Sealy. "Cognitive Load Theory in the Elementary Classroom." https://thirdspacelearning.com/us/blog/clare-sealy-introduction-cognitive-load/**

Weak evidence (practitioner synthesis, not primary research). Consistent with the above: warm-up routines that begin with items inside the student's current mastery before introducing items at the edge of mastery are a standard classroom recommendation for managing working-memory load in early-elementary math. The specific 3-item warm-up convention (not 2, not 4) is practitioner consensus, not a derived number.

**On the framing question (should ALL problems use trap distractors with difficulty modulated differently):**

This is not well-supported by the evidence for Marian's specific context. Modulating difficulty through distractor wording or visual cues presupposes strong reading and symbol fluency, which Marian does not yet have. The off-by-one vs. gentle-ramp tier distinction is the right axis to vary, not typography or visual cues, because those add cognitive load on dimensions she is still developing. Kyle's 2-tier approach is fundamentally correct; the only call here is where the cutoff sits.

### Q2 — Streak milestones

**Source 6 — ABA literature on reinforcement schedules during new-skill acquisition. ASD Toddler / FPG (UNC). https://asdtoddler.fpg.unc.edu/reinforcement/implementation-steps/positive-reinforcement/step-1-planning-ebp/step-17-select-schedul/**

Strong evidence for the underlying principle (continuous reinforcement during acquisition; intermittent reinforcement during maintenance — this is foundational behavior-analytic science replicated thousands of times). The key insight: during skill acquisition (which is where Marian is — building automaticity), reinforcement should be more frequent than during fluency maintenance. A `[3, 5, 8]` schedule provides a bonus at problem 3, problem 5, and problem 8 of an 8-problem session. That gives one in-session break at the one-third mark, another at the halfway mark, and a final at completion. This is a reasonable approximation of "denser at the start, sparser at the end" — consistent with acquisition-phase reinforcement principles.

By contrast, `[4, 8]` gives no in-session celebration until problem 4 (halfway), which means the first half of the session is unacknowledged. For a child who might get 2 or 3 wrong in the first batch and needs the motivation to keep going, this is a longer gap than evidence recommends during acquisition.

`[3, 6, 8]` is also reasonable. It provides acknowledgment slightly later on the first milestone (problem 6 vs. problem 5), which slightly reduces the "denser early" property. Not harmful; just marginally less aligned with acquisition-phase principles.

**Source 7 — Vygotsky, L.S. Zone of Proximal Development (foundational). Consistent with: SimplyPsychology summary. https://www.simplypsychology.org/zone-of-proximal-development.html**

Strong evidence for the underlying developmental principle (ZPD is foundational and extremely well-replicated). The ZPD frames successful learning as requiring scaffolded feedback that keeps the learner in the productive-effort zone. For a child building automaticity, explicit success signals at the early-success moments of a session keep her in that zone rather than sliding toward frustration. Acknowledging a 3-in-a-row at problem 3 signals "you're in the zone" at the right moment.

**Source 8 — Springer Nature / Education and Information Technologies. "Impact of streak feature in gamified app on kindergarten numeracy skills." (2026). https://link.springer.com/article/10.1007/s10639-026-13920-6**

Moderate evidence (single study; kindergarteners are younger than Marian; streak feature studied at the session level rather than the within-session level). Finding: higher streak levels correlated with higher numeracy performance scores (effect sizes η² = 0.38–0.42). Study supports the general use of in-app streaks as motivational scaffolds for early numeracy. Does not isolate milestone spacing within a session.

**Source 9 — Garon-Carrier, G. et al. (2016). "Intrinsic Motivation and Achievement in Mathematics in Elementary School." Child Development. Self-Determination Theory archive. https://selfdeterminationtheory.org/wp-content/uploads/2016/11/2016_Garon-Carrier_etal_Child_Development.pdf**

Strong evidence (longitudinal study, N=1,478, grades 1–4). Key finding: intrinsic motivation and math achievement are bidirectionally related — early positive feedback experiences causally increase intrinsic motivation, which in turn drives further achievement. The design implication: celebration milestones that arrive before the child might otherwise disengage (i.e., after 3 correct answers, not 4 or 5) serve the intrinsic motivation loop. The earlier the first milestone, the sooner the app gives Marian a concrete "you're doing it" signal.

**On the fixed vs. variable threshold question:**

The spec already makes the critical call here: fixed thresholds (3/5/8), not variable-ratio. The research on dark patterns in children's apps is unambiguous that variable-ratio reward schedules produce compulsive engagement rather than mastery orientation, and that children are more vulnerable to these effects than adults because they lack the metacognitive capacity to identify the manipulation.

Sources: "The Dark Side of Fun: Understanding Dark Patterns and Literacy Needs in Early Childhood Mobile Gaming." ResearchGate. https://www.researchgate.net/publication/374502995_The_Dark_Side_of_Fun_Understanding_Dark_Patterns_and_Literacy_Needs_in_Early_Childhood_Mobile_Gaming — and general review in: "Level Up or Game Over: Exploring How Dark Patterns Shape Mobile Games." arXiv. https://arxiv.org/html/2412.05039v1

The spec's fixed-threshold design is the most important thing to preserve regardless of which specific values Thomas chooses.

---

## Application to Marian

**Q1 — Distractor cutoff:**

Marian enters each session having done some number of physical activities, school work (starting Danish school), or other cognitively demanding tasks. At 8 years old, she has a working-memory span of roughly 5–6 items (Cowan, 2016) and limited executive-function capacity for deliberate error-correction. She is Tagalog-primary, so even the visual process of reading the numeral equation carries a small additional L2 English load (the `+` and `=` symbols are universal, but `3 + 2 = ?` as a notational form is culturally specific and she is still building fluency with it).

Her diagnostic showed 100% finger reliance even for sums well inside her conceptual ceiling. Siegler's overlapping-waves data tells us she may or may not be in "retrieval mode" when she sits down for a session. The probability that problem 2 catches her on a finger-counting trial — where the off-by-one trap distractor is genuinely ambiguous — is meaningfully higher than the probability that problem 4 does, because by problem 4 she has had three successful experiences calibrating her session mode.

Concretely: for `3 + 2 = 5`, a gentle-ramp set of `{3, 10}` is unambiguous. She counts on her fingers, gets 5, and taps 5 with no temptation. The off-by-one set `{4, 6}` is genuinely tricky if she miscounts once. On problem 1 or 2 of a session, a wrong tap on that problem has a disproportionate arousal effect: she has not yet built up the session's positive momentum. Extending the gentle ramp to problem 3 costs one less off-by-one diagnostic opportunity but significantly reduces the probability of a bad session-opening experience.

**Q2 — Streak milestones:**

An 8-problem session for an 8-year-old runs approximately 8–12 minutes given TTS playback, animation, and retry time. A milestone at problem 3 comes roughly 3–4 minutes in — about when session fatigue typically begins for early-elementary children (attention spans of 10–15 minutes for structured academic tasks, per developmental consensus). That milestone is correctly timed to arrive as engagement is starting to plateau. The milestone at problem 5 arrives at the halfway point of the session, giving a second reinforcement that says "more than halfway done." The milestone at problem 8 is session completion, which maps to the largest natural celebration point.

The `[3, 5, 8]` spacing has a further property that matters specifically for Marian: the milestone at 3 is reachable even on a session where she struggles. If she gets problems 1, 2, and 3 correct (possible even with some fingercounting errors via retry) she sees the streak-bonus celebration. On a `[4, 8]` schedule, a child who gets problem 3 right but then stumbles on problem 4 may never see a bonus stardust this session. That gap is too wide for a child who is not yet fluent and may have several retry attempts along the way.

Note on streak semantics: the spec already defines streak as "consecutive clean wins" — a wrong tap resets the streak immediately. This means the streak bonuses at 3, 5, and 8 are clean-wins bonuses, not just completion bonuses. On a rough session (multiple retries, several wrong taps), Marian may not hit any of the streak thresholds. That is appropriate: stardust per correct answer still accumulates, so she is never unrewarded for effort; but the streak bonus correctly signals a different quality of performance.

---

## Risks / counter-evidence

**Q1 — Distractor cutoff:**

The main counter-argument for keeping the 1–2 cutoff is that it is already conservative (the spec explicitly warns that a wrong answer on problem 1 would be "a sour opening"), and extending to 1–3 reduces the diagnostic window. If Marian gets all 8 problems correct in a session, the session-start Claude call has no off-by-one data to update the progress model from problems 1–3. This is real but small: an 8-problem session still has 5 diagnostic problems (4–8) with off-by-one distractors, which is sufficient signal for spaced repetition purposes.

There is also a valid argument that Marian may habituate faster than the literature suggests. If she has had dozens of sessions and is performing well, the gentle-ramp problems 1–3 become too easy. The right long-term fix is adaptive logic: after N sessions where she never misses problems 1–3, the session-start Claude call could reduce the gentle-ramp window back to 1–2 or eliminate it. But that is a future feature, not this spec.

I have not found RCT-level evidence on the exact cutoff question (2 vs. 3 warm-up items before trap distractors). The recommendation of 3 is supported by practitioner consensus and convergent inference from the anxiety, working-memory, and strategy-variability literature — not a direct experiment. Reasonable people could hold that 2 warm-ups is sufficient. My read is that the cost of being wrong in the "extend the ramp" direction (one fewer diagnostic item per session) is lower than the cost of being wrong in the "keep the short ramp" direction (potential session-opening discouragement), so 3 is the more cautious call.

**Q2 — Streak milestones:**

The `[3, 5, 8]` vs. `[3, 6, 8]` vs. `[4, 8]` question is genuinely low-stakes. The study-level evidence does not differentiate between milestone spacings within an 8-problem session — the Springer study examined streak levels across sessions, not within-session bonus timing. The ABA reinforcement-schedule literature applies at a principle level (denser early in acquisition) but does not prescribe exact numbers. My recommendation to keep `[3, 5, 8]` is a convergent inference, not a direct citation.

There is a reasonable case that `[3, 6, 8]` is marginally better than `[3, 5, 8]` because the gap between the first and second milestone is larger (3 vs. 2 additional correct answers required), which may feel more earned. I don't think this distinction is practically meaningful for Marian, but it is within the space of defensible calls.

---

## Recommendations

### For Matt (ticket priority / scope)

**Distractor cutoff:** Change `pickTier(problemIndex)` in `distractors.ts` to treat `problemIndex <= 3` as 'gentle' (problems 1–3 gentle, 4–8 off-by-one). This is literally a one-number change. Recommend this before Devon's PR ships, not as a follow-up. The implementation note in the spec already anticipated this: "Cutoff is configurable here in case Dave consult moves it."

**Streak milestones:** No change needed. `[3, 5, 8]` is well-supported. Lock it and move on. This is not a priority call.

**Future adaptive logic:** Add a backlog ticket (not week-3 scope) for: "after Marian reaches ~20 sessions with zero gentle-ramp errors, reduce gentle-ramp window to problems 1–2." This allows the warm-up to scale down as she builds fluency, rather than staying at problems 1–3 forever.

### For Kyle (spec changes)

The spec's distractor policy section currently says "Problems 1–2: gentle ramp ... Problems 3–8: off-by-one trap." That line should read "Problems 1–3: gentle ramp ... Problems 4–8: off-by-one trap." One sentence change in the Distractor policy section, plus a corresponding update to the acceptance criterion that currently reads "problems 1–2 use gentle-ramp distractors; problems 3–8 use off-by-one distractors."

The streak and stardust design as written is developmentally appropriate and does not need changes. The anti-dark-pattern audit already in the spec is solid.

### If Thomas overrides

**On distractor cutoff:** If Thomas prefers to keep the 1–2 cutoff, the cost is a small but real increase in the probability that a wrong answer on problem 2 creates a negative session-opening experience, particularly in Marian's first 5–10 sessions when the app context is still novel. Not catastrophic, but worth knowing.

**On streak milestones:** If Thomas prefers `[4, 8]`, the cost is one fewer early-session celebration, which may matter on sessions where Marian struggles through the first half. If he prefers `[3, 6, 8]`, the difference from `[3, 5, 8]` is negligible in either direction.

---

## Flags on the other Open Questions in Kyle's spec

Of the remaining 5 open questions (items 3–7), two have developmental-psychology content worth flagging:

**Open Question 5 — Hint threshold (1 wrong vs. 2 wrong before hint):** The spec defaults to 2 wrongs before hint. From a mastery-learning standpoint, 2 is correct. Triggering a hint after only 1 wrong attempt removes the self-correction opportunity, which is where real learning happens for a child building automaticity (Hattie & Timperley, 2007 — feedback timing research; effect size for "error + self-correction" is consistently higher than "error + immediate correction"). The spec's default is the right call. This does not need a formal Dave consult — the answer is clear from the literature.

**Open Question 4 — Streak indicator icon (flame vs. sparkle):** Kyle's recommendation to use the existing sparkle/star rather than authoring a new flame icon has implicit developmental backing that is worth making explicit. Flame glyphs carry connotations of danger/urgency in most cultural contexts, and the cognitive-emotional priming effects of iconography are documented even at early-elementary ages (Nummenmaa et al., 2014, on embodied emotion and symbol processing). A soft sparkle or star is on-brand for Melody and avoids the "don't lose your streak!" pressure framing that the spec explicitly rejects. Kyle's instinct here is developmentally sound. Recommend formalizing it as the design decision, not leaving it as an open question.

Items 3 (streak break behavior — already resolved in the spec), 6 (session JSON failure recovery — orchestrator concern, not developmental), and 7 (Melody interactivity in v1 — scope call, not developmental) do not need a Dave consult.
