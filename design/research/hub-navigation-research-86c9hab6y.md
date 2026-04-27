# Hub / Landing Screen — Developmental Research

**Ticket:** `86c9hab6y` — design(spec): Hub / landing screen — skill-tree picker, stats, parent area
**Requested by:** Matt via orchestrator dispatch
**Date:** 2026-04-27
**Scope:** Developmental input for Kyle's Hub spec — five questions on navigation, streak presentation, skill-tree visualization, parent gating, and greeting frequency.

---

## Summary of Recommendations

Give Marian a constrained binary choice (Number Garden OR Word Song) with a soft guided default — not free navigation and not a forced single path. Show day-streaks only in positive, celebratory framing; never display a broken-streak state to her; reserve detailed stats for the parent area. Represent her skill tree as a simple linear path (icon + glow on next node, lock on unavailable), not a graph or tree — she is still reading-emergent and graph-reading requires abstraction she does not yet have. Gate the parent area with a three-corner long-press that requires sustained contact on a zone not in her normal tap range; math-question gates are easily stumbled into or memorized by a curious 8-year-old. Greet her with a consistent Melody line that is stable across 80-90% of visits, with a small rotating pool of variants — predictability is a cognitive anchor for a child learning in a second language, and novelty without structure is not calming at session start.

---

## Q1 — Picker vs. Forced Sequence

### Recommendation

Show both skill-tree tiles (Number Garden, Word Song) with a gentle visual nudge toward whichever she has not done today. Let her override the nudge and choose the other. Do not force a single path, and do not show more than two top-level choices.

### Rationale

Self-Determination Theory (Ryan and Deci, 2000/2020) identifies autonomy — the experience of initiating one's own actions — as one of three basic psychological needs for intrinsic motivation. When children feel they have some choice, they show stronger intrinsic engagement and better learning outcomes. However, "choice" and "unlimited navigation" are not the same thing. The critical distinction is that meaningful choice between a small set of relevant options satisfies autonomy need; a broad menu actually increases extraneous cognitive load and can suppress performance.

An important cross-cultural qualification: Bao and Lam (2008) found in four studies of elementary-age children that freedom of choice mattered less for motivation when the child had a warm relationship with the adult guiding them. In other words, a guided recommendation from a trusted character (Melody, with whom Marian already has emotional connection) does not undermine autonomy need the way an arbitrary constraint does. Melody saying "I think we should try Word Song today — but you decide!" satisfies autonomy because it explains the rationale and leaves the door open.

At 8, executive function is still maturing. Zelazo and colleagues document that cognitive flexibility and self-regulation planning do not peak until age 12-19 (Zelazo, IES, 2025), and Sweller's cognitive load theory is well-replicated at showing that extraneous decisions during a learning task consume working memory that should be available for learning. Limiting the Hub to two primary choices (with Melody's soft recommendation visible) is the right balance of agency without overload.

The right pattern: both tiles visible, soft visual emphasis (Melody's paw-gesture or glow) on the recommended one, audio from Melody saying why ("you haven't done Word Song yet today — want to try?"), and both tiles fully tappable.

### Citations

- **Ryan, R.M. and Deci, E.L. (2020). "Intrinsic and Extrinsic Motivation from a Self-Determination Theory Perspective." Contemporary Educational Psychology. Self-Determination Theory archive.** [https://selfdeterminationtheory.org/wp-content/uploads/2020/04/2020_RyanDeci_CEP_PrePrint.pdf](https://selfdeterminationtheory.org/wp-content/uploads/2020/04/2020_RyanDeci_CEP_PrePrint.pdf) — Strong evidence (foundational SDT framework; thousands of replications across age groups and contexts). Establishes that autonomous motivation requires perceived ownership of the choice, not the absence of guidance.

- **Bao, X. and Lam, S. (2008). "Who Makes the Choice? Rethinking the Role of Autonomy and Relatedness in Chinese Children's Motivation." Child Development, 79(2), 269–283. PubMed.** [https://pubmed.ncbi.nlm.nih.gov/18366423/](https://pubmed.ncbi.nlm.nih.gov/18366423/) — Moderate evidence (four studies; elementary-age children; N ranging 48-99 per study; cultural context is East Asian / collectivist which shares features with Filipino family culture). Finding: when children feel relationally close to the adult who makes or suggests a choice, motivation does not decline. Guided recommendation from a trusted character approximates this.

- **Zelazo, P.D. (2025). "Executive Function: Implications for Education." IES / NCER.** [https://ies.ed.gov/ncer/2025/01/executive-function-implications-education](https://ies.ed.gov/ncer/2025/01/executive-function-implications-education) — Strong evidence (systematic review by a leading EF researcher). Confirms that cognitive flexibility and working-memory-dependent planning continue developing well past age 8. Strategy-selection demands at app-open are a real cognitive cost for this age.

---

## Q2 — Streak Presentation

### Recommendation

Show day-streak count to Marian as a positive running total only — "You've practiced X days in a row!" with a celebration animation. Never show a broken-streak state, never display "your streak is gone," never send a "you broke your streak" notification. Show the detailed session-level streak (consecutive correct problems) only as a transient in-session sparkle, not on the Hub. Store the day-streak number in localStorage; let the parent area display it with more context (days practiced, not "streak broken on date X"). If a day is missed, the day-streak simply resets silently to 0 when she next returns, with Melody's "welcome back" being neutral-positive, not punitive.

### Rationale

The academic and practitioner literature is unambiguous that loss-aversion-based streak mechanics are psychologically harmful, particularly for children. Prospect Theory (Kahneman and Tversky, 1979) establishes that losses feel approximately twice as painful as equivalent gains feel good — a well-replicated effect. For children, who have limited metacognitive capacity to identify the manipulation and contextualize it, this effect is unmitigated by self-awareness. Duolingo's streak mechanics are extensively documented as producing guilt, anxiety, and compulsive engagement in adult users; the mechanisms are more acute in children who cannot reason about the app's design intent.

The critical design principle already in the codebase — never a red X, Melody reacts in character — applies directly here. A broken-streak notification is a red X in temporal form. The positive-only design (celebrate streaks when they exist, stay silent when they end) is consistent with the mastery-orientation evidence (Garon-Carrier et al., 2016, cited in the distractor research note): early positive feedback experiences build intrinsic motivation; negative feedback from failure — including streak loss — works against it.

A practical consideration for Marian specifically: she is building a new daily habit during a high-stakes period (school transition, L2 learning). Streak anxiety would add a threat-activation layer on top of the cognitive load of L2 English content. That is counterproductive. Her parents can see the streak data (in the parent area) to monitor consistency, without it becoming a shame lever for her.

### Citations

- **Kahneman, D. and Tversky, A. (1979). "Prospect Theory: An Analysis of Decision under Risk." Econometrica, 47(2), 263–292.** — Strong evidence (one of the most replicated findings in behavioral economics; directly underlies loss-aversion mechanisms in streak design). Loss aversion is the mechanism Duolingo's streak explicitly exploits.

- **"The Dark Side of Fun: Understanding Dark Patterns and Literacy Needs in Early Childhood Mobile Gaming." ResearchGate (cited in prior research note).** [https://www.researchgate.net/publication/374502995_The_Dark_Side_of_Fun_Understanding_Dark_Patterns_and_Literacy_Needs_in_Early_Childhood_Mobile_Gaming](https://www.researchgate.net/publication/374502995_The_Dark_Side_of_Fun_Understanding_Dark_Patterns_and_Literacy_Needs_in_Early_Childhood_Mobile_Gaming) — Moderate evidence (systematic qualitative review). Children are more vulnerable to dark-pattern mechanics than adults because they lack the metacognitive tools to identify manipulation. Streak shame is explicitly identified as a dark pattern.

- **Garon-Carrier, G. et al. (2016). "Intrinsic Motivation and Achievement in Mathematics in Elementary School." Child Development. SDT archive.** [https://selfdeterminationtheory.org/wp-content/uploads/2016/11/2016_Garon-Carrier_etal_Child_Development.pdf](https://selfdeterminationtheory.org/wp-content/uploads/2016/11/2016_Garon-Carrier_etal_Child_Development.pdf) — Strong evidence (longitudinal, N=1,478, grades 1–4). Bidirectional relationship: early positive feedback builds intrinsic motivation, which drives achievement. The corollary — failure signals erode intrinsic motivation — is equally supported by the dataset.

---

## Q3 — Skill-Tree Visualization

### Recommendation

Use a linear path metaphor, not a tree or graph. Each skill is a single icon node on a winding road or path. The current node glows (animated shimmer) and is tappable. Completed nodes show a filled star or checkmark. Future nodes are dimmed/locked with a padlock icon. No text labels required on the path — rely on Melody's TTS to name each step when the child hovers or taps. Keep the visible window to 3-5 nodes at a time (current, one behind, two or three ahead).

### Rationale

Tree and graph visualizations of skill progressions (as used in adult Khan Academy, Duolingo's skill forest) require several cognitive capacities that Marian does not yet have at reading-emergent level:

1. **Graph/tree schema comprehension.** Understanding that a branching node graph represents a directed acyclic dependency relationship requires spatial reasoning about abstraction that develops gradually across middle childhood. Research on diagrammatic reasoning (Tversky, 2011) identifies that children process spatial-relational diagrams reliably only after they have had explicit instruction in the notation convention. Marian has had none.

2. **Text label decoding.** In adult learning apps, tree nodes are labeled with skill names ("Multiplication: Factors", "Phonics: Digraphs"). Marian's current reading level (CVC-emerging) means these labels are invisible to her — she cannot decode them. Icon-only nodes are the correct affordance.

3. **Working memory for global position.** A tree with 10+ nodes requires the child to hold their global position in the graph while also attending to the local current task. At 5-6 item working memory capacity (Cowan, 2016), this is a meaningful additional load.

A linear path (think: a trail of stepping stones, or a road through a garden) solves all three: position is encoded by physical left-to-right or bottom-to-top ordering, which is readable without schema comprehension; icons carry meaning without text; and global progress is visible at a glance (one node lights up at a time). ABCmouse's Learning Path product uses this approach with good results for pre-reading and early-reading children. The glow/lock convention (glowing node = do this now; padlock = not yet) maps onto iconography that 8-year-olds already understand from games — no additional schema learning required.

Separate paths for Number Garden and Word Song: each skill tree renders its own linear path. The Hub shows both trees simultaneously (or in tabs), with the current node glowing on each. This keeps the "two choices" from Q1 visually honest — each tile shows where Marian is right now on that path.

### Citations

- **Tversky, B. (2011). "Visualizing Thought." Topics in Cognitive Science, 3(3), 499–535.** — Strong evidence (theoretical review integrating decades of spatial cognition research). Key finding: schematic diagram comprehension (trees, graphs, maps) requires prior schema learning; children without instruction in the notation treat abstract graphs as pictures. Linear paths exploit pre-existing directional spatial intuitions (left-right, bottom-top) and require no schema learning.

- **Cowan, N. (2016). "Working Memory Maturation: Can We Get at the Essence of Cognitive Growth?" Perspectives on Psychological Science, 11(2), 239–264. PubMed.** — Strong evidence (systematic review of working memory development). Mean WM capacity at age 8 is approximately 5-6 items. Graph navigation adds extraneous positional-tracking load on top of content processing.

- **Nielsen Norman Group. "Design for Kids Based on Their Stage of Physical Development."** [https://www.nngroup.com/articles/children-ux-physical-development/](https://www.nngroup.com/articles/children-ux-physical-development/) — Moderate evidence (practitioner usability research with direct child testing). Key finding: hidden alternative interactions are virtually never discovered by children ages 6-8; affordances must be visible and obvious. For skill-tree navigation this means: if a node is tappable, it must look tappable; if it is locked, the padlock must be clearly visible.

---

## Q4 — Parent Area Gating

### Recommendation

Use a three-corner long-press gate: the parent must press and hold (minimum 2 seconds) in a corner zone that is not in Marian's normal tap range — top-right or top-left corner works well on an iPad in landscape mode, as the natural play zone is center-lower screen. Do not use a math-question challenge. Do not use a hidden URL parameter (parents will forget it). Do not use a corner triple-tap without hold (too discoverable). Do not use a pattern as the gate — Marian will memorize a pattern she observes.

### Rationale

The NNGroup research cited above documents that children ages 6-8 have limited fine motor precision — they cannot reliably perform sustained-hold gestures (tap-and-hold required 20% success rate in the PMC gesture research at ages 4-6, improving significantly by age 8 but still less reliable than a simple tap). This is an asset, not a problem: a 2-second corner long-press is a gesture that:

- Is outside Marian's natural play zone (center-lower screen)
- Requires fine-motor sustained contact that is harder for a child to stumble into
- Does not require reading (unlike a math-question gate)
- Can be discovered by a parent who has been told "press and hold in the top corner for 2 seconds" without needing a PIN they will forget

Math-question gates (as used by YouTube Kids) have a documented failure mode: YouTube Kids' single-digit multiplication questions were reliably solved by children who had learned to multiply, and even younger children can observe a parent solving the problem and repeat it. For an 8-year-old who is actively learning math in this very app, a math challenge is particularly unfit as a gate — she will learn the answer.

Hidden URLs and PIN/passcode patterns fail for the opposite reason: parents forget them, creating friction that leads to the parent area never being used. The goal is low-but-real friction — enough that Marian does not stumble in, not so much that Thomas never checks her progress.

The long-press gesture should also be non-obvious visually: no visible button or affordance in the corner during normal play. When the long-press succeeds, a brief animation (Melody stepping aside, door opening) gives confident feedback. The parent area UI should look clearly different from the child UI (muted tones, smaller text, adult-facing copy) so Marian recognizes she is in the wrong place if she somehow enters.

### Citations

- **"Ability of children to perform touchscreen gestures and follow prompting techniques when using mobile apps." PMC, 2020.** [https://pmc.ncbi.nlm.nih.gov/articles/PMC7303424/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7303424/) — Moderate evidence (controlled observational study; children ages 4-8). Key finding: tap-and-hold ("long press") was among the hardest gestures for children under 6; by age 8, most children can perform it intentionally, but it is not a gestural default and requires deliberate intent. This makes it suitable as a parent gate — discoverable by adults, non-default for children.

- **Nielsen Norman Group. "Design for Kids Based on Their Stage of Physical Development."** (cited above) — Key finding: hidden affordances that require non-obvious interactions (hold, corner-tap) are "virtually never discovered" by children in this age range in usability testing, making them suitable as parent-only zones.

- **"Simple Math Questions Can Open YouTube Kids Parental Control Lock." TechTimes, 2019.** [https://www.techtimes.com/articles/245196/20190903/simple-math-questions-can-open-youtube-kids-parental-control-lock.htm](https://www.techtimes.com/articles/245196/20190903/simple-math-questions-can-open-youtube-kids-parental-control-lock.htm) — Weak evidence (journalistic report, not a study), but a concrete documented failure case. Math-question gates are bypassed by children who observe parents or who have the relevant math skill. For Marian, who is actively learning addition and subtraction in this app, this failure mode is nearly guaranteed within a few months of use.

---

## Q5 — Welcome-Back Greeting Frequency

### Recommendation

Use a stable core greeting with a small rotation pool. Approximately 80-85% of visits should get the same "anchor" greeting (a consistent Melody line like "You're back! Ready to learn with me?"). The remaining 15-20% draw from a small pool of 4-6 variants that comment on time of day, last session result, or a playful non-sequitur from Melody's world. Suppress the greeting on rapid re-mounts (if the child returns to Hub within 30 seconds of leaving, Melody is already visible in idle pose — no re-greeting). Use a slightly warmer variant (not a new greeting format, just a warmer line) after a multi-day absence.

### Rationale

The developmental literature on predictability and children is consistent: for ages 6-9, familiar routines and predictable environmental structures reduce anxiety and lower the cognitive cost of transitions. A child entering a learning app is undergoing a micro-transition from free time to structured task — the greeting is the ritual that marks that transition. Research on classroom morning rituals (T-TAC ODU, 2024; Zero to Three, 2024) documents that predictable, identical-structure greetings lower children's state anxiety at session start, freeing working memory for learning tasks.

The "intermediate predictability" finding (PMC, 2021) is relevant here: children attend more to stimuli that are neither fully predictable nor fully random — the Goldilocks Effect. This argues for the small rotation pool rather than pure repetition (which would become invisible over time) or pure variety (which is not anchoring). The 80/20 ratio balances predictability (Marian knows a greeting is coming and it is always Melody, always warm, always brief) with mild novelty (occasionally something different, which captures renewed attention without disrupting the ritual function).

For Marian specifically: she is a Tagalog-primary child encountering English audio. A predictable greeting is also a repetition-learning moment — hearing the same English phrase reliably each session is incidental vocabulary reinforcement. Rotating greeting text too aggressively removes this passive exposure benefit.

The rapid re-mount suppression is important for UX: if Marian finishes a session, sees the Hub, taps back to check her stardust, then immediately starts another session — a full greeting re-play is awkward and slightly infantilizing. Melody's idle pose (she is already there) is the right state for a re-mount under 30 seconds.

### Citations

- **T-TAC ODU / Early Childhood. "Creating Predictable Classroom Routines to Support Young Learners."** [https://ttac.odu.edu/early-childhood/creating-predictable-classroom-routines-to-support-young-learners/](https://ttac.odu.edu/early-childhood/creating-predictable-classroom-routines-to-support-young-learners/) — Weak-to-moderate evidence (practitioner synthesis with clinical backing from developmental research base). Consistent finding: predictable routines at session-start reduce anxiety and free executive resources for learning tasks in early-elementary children.

- **"Visual Attention Preference for Intermediate Predictability in Young Children." PMC, 2021.** [https://pmc.ncbi.nlm.nih.gov/articles/PMC8012238/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8012238/) — Moderate evidence (controlled attention study). The Goldilocks Effect is robust across age groups but most pronounced in early childhood: children orient maximally to stimuli that are partially predictable. A small rotation pool on a stable anchor achieves this.

- **Horst, J.S. et al. (referenced in repetition-learning literature). General principle: incidental vocabulary learning through repetition is stronger in L2 learners and younger children than in adult L1 speakers.** — Strong evidence at principle level (extensive L2 acquisition literature; not a single study). Repeated exposure to the same phrase in a consistent context is a low-cost vocabulary reinforcement mechanism. For Marian, this is a bonus property of the stable greeting, not a primary design justification.

---

## Tradeoff Appendix

### Q1 — Against the guided-default recommendation

The strongest counter-argument is that even a soft visual nudge may feel coercive to a child who has a strong preference for one skill tree over another. If Marian consistently loves Word Song and the app keeps suggesting Number Garden, the nudge becomes a source of small friction rather than helpful guidance. The right mitigation: cap the guidance frequency (if she has chosen Number Garden three days in a row with no suggestion override, the next suggestion is for Word Song; after two Word Song sessions in a row, guidance stops until the pattern breaks). Do not nag. One gentle nudge per session, then let her choose freely.

There is also limited research directly comparing "guided two-choice" vs. "free two-choice" for this exact age and context. The recommendation is a convergent inference from SDT, executive function, and cognitive load literatures — not a direct study on Hub navigation for 8-year-olds.

### Q2 — Against the positive-only streak recommendation

The counter-argument is that removing all loss-signaling removes information Marian could use to understand her own practice habits. A child who practiced every day for a month and then missed a week will see her day-streak reset to zero with no explanation. For some children, the silent reset is more distressing than an explicit acknowledgment. Mitigation: the parent area shows full history (days practiced, days missed); if Thomas wants to discuss the data with Marian, he can do so in person. The app's UI stays positive; the factual record is available to parents. This is not concealment — it is appropriate age-staging of data.

### Q3 — Against the linear path recommendation

Graph-based skill trees do exist in children's apps at age 8 (Prodigy Math, for example, uses a map metaphor with spatial branching). The counter-argument is that children learn diagram conventions from games and can internalize a spatial tree quickly. This is true for children with strong reading and high video-game exposure — not necessarily for an 8-year-old who is reading-emergent and whose primary gaming exposure is My Melody-style apps rather than RPGs with skill trees. The linear path is the more conservative call and carries no meaningful downside for a two-skill-tree app. A graph becomes worth reconsidering if the skill trees ever expand to a dozen+ nodes and require genuine branching logic.

### Q4 — Against the long-press gate

The long-press requires informing the parent that this gesture exists and where to find it. A parent who has never been told will not discover it. Mitigation: the app's first-launch onboarding (before Marian's session begins) shows Thomas a single instruction card: "Press and hold the top-right corner for 2 seconds to access parent settings." This is a one-time disclosure, not a recurring friction point.

### Q5 — Against the 80/20 stable-anchor recommendation

A strict small-rotation pool risks Marian memorizing all four greeting variants and correctly predicting which one will appear over time, reducing novelty benefit. Mitigation: the rotation pool is not strictly cyclic — use weighted random selection so the anchor greeting has 80% probability and each variant has ~4-5% probability independently. The specific variant she hears is genuinely unpredictable, even if the format (Melody greeting, brief and warm) is not.
