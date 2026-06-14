# Leitner Interval Tuning for Marian

**Ticket:** 86c9kmwf8
**Date:** 2026-06-15
**Context:** PR #447 ships time-based Leitner scheduling with placeholder intervals
`LEITNER_REVIEW_INTERVAL_DAYS` = box1→0, box2→2, box3→4, box4→7, box5→14 (calendar days).
The ticket explicitly flags these as "a starting guess, tune later." This note answers the tuning question.

---

## Question

For Marian (age 8, ~10–15 min sessions, NOT daily-guaranteed), what do the
spaced-repetition / child-numeracy / memory-consolidation literatures suggest
for review intervals across a 5-box Leitner system? Should the early boxes be
tighter, and how should calendar-day intervals be adjusted for irregular cadence?

---

## Bottom line

The current box1→0 and box2→2 day intervals are the most defensible as-is:
box1 re-exposure on the same or next session is grounded in the forgetting-curve
literature, and a 2-day gap before box2 review is consistent with Cepeda et al.'s
optimal gap-to-retention-interval ratio for short-window learning.

The bigger tuning risk is **calendar-day drift on irregular attendance**: if Marian
skips 3–4 days, a box2 item (2-day interval) will overdue-accumulate and a box3
item (4-day interval) that should still be consolidating will also age past its
window — both creating a backlog that floods the next session. The fix is not
changing the interval constants but ensuring the session-gen code caps the number
of overdue Leitner items served per session regardless of how many have elapsed.

For the higher boxes, current box4→7 and box5→14 are slightly conservative
relative to what the Cepeda 2008 ratio predicts for a ~3-month retention horizon
(which suggests a first review gap of ~15–18 days), but are appropriate given
Marian's non-daily attendance — shorter "safe" intervals at boxes 4–5 are better
than missing the review window entirely.

**Recommended table — keep boxes 1–3, tighten box4 slightly, leave box5:**

| Box | Current | Recommended | Rationale |
|-----|---------|-------------|-----------|
| 1   | 0 days  | 0 days      | Same-session or next-session re-exposure — correct per forgetting curve |
| 2   | 2 days  | 1 day       | First consolidation window is 24 h; tighten to catch the overnight sleep-consolidation benefit (see Evidence §3) |
| 3   | 4 days  | 3 days      | Small tightening to stay within the ~20% gap/retention-interval ratio for a 2-week review horizon |
| 4   | 7 days  | 7 days      | Holds; ~20% of a 5-week retention horizon |
| 5   | 14 days | 14 days     | Holds; appropriate for near-mastered facts with non-daily attendance |

The single highest-leverage change is box2: 2→1 day. Everything else is within
noise of the optimal.

---

## Evidence

### 1. The spacing effect in children — it works, from age 3 upward

**Vlach, H.A., Sandhofer, C.M., & Kornell, N. (2008). "The spacing effect in
children's memory and category induction." Cognition, 109(1), 107–116.
PubMed: 18835602.
https://www.sciencedirect.com/science/article/abs/pii/S0010027708001753**
Strong evidence (experimental; N=24, ages 3–4; within-subjects design).
Children show the spacing effect for both object memory and category
generalization. The spacing effect in children is robust and does not require
deliberate rehearsal strategy — it operates even when learning is
incidental. Establishes that spacing benefits at age 3–4 scale to older
children without needing deliberate strategy knowledge.

**Vlach, H.A. & Sandhofer, C.M. (2012). "Distributing learning over time: The
spacing effect in children's acquisition and generalization of science concepts."
Child Development, 83(4), 1171–1181.
DOI: 10.1111/j.1467-8624.2012.01781.x**
Strong evidence (experimental, elementary-school children). Spacing lessons by
days (compared to massed or "clumped" same-day delivery) significantly increased
generalization scores at a 1-week retention test. The spaced condition outperformed
both massed and clumped conditions on both simple and complex concepts.

**Application to Marian:** She is 8 — well within the age range where the spacing
effect is robustly established and doesn't require any deliberate effort from her.
The Leitner mechanism is appropriate.

---

### 2. Optimal spacing intervals for a ~3-month retention horizon (Cepeda 2008)

**Cepeda, N.J., Vul, E., Rohrer, D., Wixted, J.T., & Pashler, H. (2008).
"Spacing effects in learning: A temporal ridgeline of optimal retention."
Psychological Science, 19(11), 1095–1102.
DOI: 10.1111/j.1467-9280.2008.02209.x.
Available: https://www.yorku.ca/ncepeda/publications/CVRWP2008.html**
Strong evidence (large-scale online study; N>1,350 adults; crossed gap ×
retention-interval design). Key quantitative finding: the optimal gap between
study sessions equals approximately **20% of the intended retention interval**
for short retention windows (weeks), falling to ~5% for year-long retention.
Example: if you want to retain something for 3 months (Marian's August 2026
deadline from a June start), the optimal first review gap is ~18 days. If you
want to retain for 2 weeks, the optimal gap is ~2–3 days.

This study used adult participants. The general principle (20% ratio) is the
closest we have to a quantitative grounding for box intervals.

**Applying the 20% ratio to each box transition:**

The box index represents a proxy for "how long since acquisition." An item
entering box 2 has been seen once (box1 re-exposure just happened). The question
is how long to wait before box2 review. If the item needs to be retained for
~3 weeks (box2→3 horizon), optimal gap ≈ 20% × 21 days ≈ 4 days. If it needs
to be retained for ~1 week (box1→2 horizon), optimal gap ≈ 20% × 7 days ≈
1–2 days.

The current table (0, 2, 4, 7, 14) is broadly consistent with the 20% ratio
for a ~3-month final target, **except box2→3 (interval 4 days vs. predicted
~3 days)**. The deviation is small — within the noise of the 20% estimate.

**The strongest single concern from this evidence: box2 at 2 days may be
slightly too long** relative to a box1→2 horizon of ~7 days (optimal gap ≈
1–2 days). This is the primary tuning recommendation (2→1 day).

---

### 3. Children's overnight sleep turbocharges consolidation

**Backhaus, J., Hoeckesfeld, R., Born, J., Hohagen, F., & Junghanns, K. (2008).
"Immediate as well as delayed post learning sleep but not wakefulness enhances
declarative memory consolidation in children."
Neurobiology of Learning and Memory, 89(1), 76–80.
DOI: 10.1016/j.nlm.2007.09.002**
Moderate evidence (controlled sleep study, school-age children).
Sleep following learning — whether immediate or delayed — significantly
improved declarative memory consolidation; wakefulness did not.

**Backhaus, J. et al. (2020, updated analysis). "The power of children's sleep —
improved declarative memory consolidation in children compared with adults."
Scientific Reports.
PMC: PMC7305149.
Key quantitative finding: children (ages 7–12) retained 1.87% more definitions
after sleep vs. immediate retrieval; adults in the sleep condition forgot 4.75%
of retrieved items (F1,60 = 18.45; p = 0.001; p = 0.00003 for children vs.
adults in sleep condition). Children's superior consolidation is attributed to
25–35% of night sleep spent in slow-wave sleep (SWS), vs. 15–20% for adults.
Furthermore, a 90-minute daytime nap in 7–11 year olds already triggers neural
reorganization toward long-term storage — a process that takes days to months in
adults.**
Moderate evidence (N=30 children, N=34 adults; controlled design).

**Application to Marian:** Because children consolidate declarative memory so
efficiently overnight, the first post-acquisition review is most effective
**after one night of sleep** — i.e., after a 1-day gap, not 2 days. The 2-day
box2 interval means the review happens the night after the consolidation night,
by which point the memory is somewhat more stable but the critical 24-h
consolidation window has passed. Moving box2 from 2→1 day aligns the first
review with the post-consolidation retrieval event that most efficiently
strengthens the newly-consolidated trace.

This is the strongest developmental argument for tightening box2.

---

### 4. Expanding vs. equal-interval spacing for children — no clear winner

**Karpicke, J.D. & Roediger, H.L. (2007). "Expanding retrieval practice promotes
short-term retention, but equally spaced retrieval enhances long-term retention."
Journal of Experimental Psychology: Learning, Memory, and Cognition, 33(4),
704–719.
Available: https://learninglab.psych.purdue.edu/downloads/2007/2007_Karpicke_Roediger_JEPLMC.pdf**
Moderate evidence (adult participants; key comparison: expanding vs. equal-interval
schedules). Expanding retrieval (short initial gaps, growing gaps) promotes
short-term retention; equal intervals better for long-term retention.

**Retrieval Practice and Word Learning by Children With Developmental Language
Disorder: Does Expanding Retrieval Provide Additional Benefit? (2024).
Journal of Speech, Language, and Hearing Research.
PMC: PMC11087082.**
Moderate evidence (children with and without DLD). Expanding vs. equal-interval
difference was non-significant in children (0.59-point mean advantage for expanding
on an 8-point scale; ns). Both schedules produced equivalent long-term retention.

**Küpper-Tetzel, C.E., Kapler, I.V., & Wiseheart, M. (2014). "Contracting, equal,
and expanding learning schedules: The optimal distribution of learning sessions
depends on retention interval." Memory & Cognition, 42(5), 729–741.
DOI: 10.3758/s13421-014-0408-z**
Moderate evidence (adults). Expanding schedules sometimes enhance retention vs.
uniform; sometimes equivalent. The difference is small and context-dependent.

**Application to Marian:** The current Leitner structure (0→2→4→7→14 days)
already represents an approximately-expanding schedule. The evidence says this
is fine but not clearly superior to equal-interval — the schedule shape is less
important than getting any spacing at all. Do not over-optimize the spacing
progression; the key is that sessions happen.

---

### 5. Spaced retrieval for arithmetic fact automaticity in children

**McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). "What the
science of learning teaches us about arithmetic fluency." Psychological Science
in the Public Interest, 26(1), 10–57. PubMed: 40297988.
DOI: 10.1177/15291006241287726**
Strong evidence (systematic review + meta-analysis). Recommends distributed
practice for arithmetic fact consolidation; endorses spaced retrieval as one
of the highest-evidence interventions for automaticity. Specifies that spaced
practice should begin **after accuracy is established** (not before). Marian
is accurate (gets answers right eventually); she is ready for spaced retrieval
pressure. Does not specify day intervals — that precision is not in the review.

**Ophuis-Cox, R.H.A. et al. (2023). "The effect of retrieval practice on
fluently retrieving multiplication facts in an authentic elementary school
setting." Applied Cognitive Psychology. DOI: 10.1002/acp.4141**
Moderate evidence (quasi-experimental, elementary school children). Retrieval
practice yielded stronger short- and long-term fluency gains vs. restudy on
multiplication facts. No specific interval recommendations.

**Dunlosky, J. et al. (2013) / Nature Reviews Psychology (2022). Spacing and
retrieval practice meta-analysis.
https://www.nature.com/articles/s44159-022-00089-1**
Strong evidence (multiple meta-analyses across child and adult populations).
Spaced retrieval is among the highest-evidence learning strategies. Effect sizes
large (Cohen's d up to 1.4 in child samples). Consistent with any reasonable
spacing schedule that gets retrieval to happen.

---

### 6. The irregular-cadence problem — calendar days can misfire

No peer-reviewed study directly addresses how to handle children learning on
non-daily schedules with Leitner-style systems. The practitioner literature and
SRS algorithm documentation (SM-2, Anki documentation) consistently note that
calendar-day intervals are proxies for "minimum elapsed time before review" and
that overdue items should be served but capped per session to avoid flooding.

**SM-2 algorithm (Wozniak, P., 1987–present). SuperMemo documentation.
https://help.supermemo.org/wiki/SuperMemo_Algorithm**
The SM-2 initial intervals are: 1 day → 6 days → escalating by easiness factor
(default 2.5×). These are minimum intervals; items reviewed late are not penalized
(the item is reviewed when Marian next plays, not on a fixed calendar day).

**Application to Marian:** With non-guaranteed sessions, a box2 item that
should be reviewed on day 1 might be seen on day 3 (next time she plays). That
is fine — the review is late but still beneficial. What is NOT fine is
accumulating 12 overdue items and serving all 12 in one session, crowding out
new content. The session-gen code should cap overdue Leitner items per session
(suggestion: 2–3 maximum) regardless of how many have elapsed. This is a
session-gen behavior note, not a constant-tuning note.

---

## Application to Marian

### Her specific profile

Marian's `add-to-10` facts are the first Leitner consumers. As of the April 2026
diagnostic and the May 2026 session update, she is transitioning from counting to
near-retrieval on sums ≤ 10. Box 1 facts are facts she's seen and gotten wrong
(demoted) or seen once and not yet promoted — these are the most fragile and
need the shortest re-exposure gap. Box 5 facts are facts she's answered correctly
across 4 promotions — these are near-consolidated and can wait 2 weeks safely.

**Non-daily cadence effect:** If Marian plays every 2–3 days (a realistic
evening/weekend cadence), the box2 gap of 2 days means that a box2 item
promoted today will be reviewed either at the next session (if she plays
tomorrow) or the session after (if she skips tomorrow). The 1-day recommendation
ensures the item is guaranteed to be served at the NEXT session, not
potentially skipped. This is the primary operational argument for 2→1 day.

**Tagalog L1 context:** No evidence specifically addresses Leitner interval
tuning for L2 math learners. The general spacing-effect literature is agnostic
to language of instruction; the mechanism (forgetting → retrieval → strengthening)
operates regardless of L1. The Tagalog-English phonological translation step
does not meaningfully affect the optimal retrieval interval for arithmetic facts
(the operation is visual/symbolic, not phonological at the retrieval moment).

---

## Risks / counter-evidence

1. **The Cepeda 2008 20% ratio is derived from adults.** No equivalent large-scale
study with children maps gap-to-retention-interval ratios with the same precision.
The direction of any child-specific correction is uncertain — children may need
shorter or longer first-review gaps depending on the consolidation mechanism.
The overnight-sleep evidence (§3) suggests shorter is better for the box1→2
transition specifically.

2. **Calendar days are a poor proxy for session count.** If Marian plays 3×
per week, a "1-day" box2 gap means "next session." If she plays 5× per week,
it means she misses a day between reviews. The constant should be read as
"minimum elapsed days," not "days until next Leitner check."

3. **Overdue accumulation is the primary practical risk** — more important than
getting the interval constants exactly right. An 8-year-old who comes back after
a 5-day break should not be greeted with 15 overdue Leitner items. The session-gen
code's behavior on overdue items matters more than whether box3 is 3 vs. 4 days.

4. **Box 5 at 14 days may be too short for long-term retention.** The Cepeda
20% ratio for a 3-month retention window predicts a first review gap of ~18 days,
suggesting box5 could be 14–21 days. 14 days is conservative (more frequent
review) which is the safer direction for a child.

5. **The evidence on expanding vs. equal-interval schedules is mixed.** The
current table is expanding; equal-interval (say, 0/2/4/6/8 or 0/3/6/9/12)
would be equally valid. Do not switch unless there is a specific operational
reason.

---

## Recommendations

### For Matt (ticket scope)

**Ticket 86c9kmwf8 — change box2 from 2→1 day.** This is the one constant
change supported by the child sleep-consolidation evidence (§3) and the
Cepeda gap/retention-interval ratio (§2). All other constants are within the
acceptable range. The change is a one-line constant edit.

**Add a session-gen overdue-cap** — limit Leitner items served per session
to 2–3 regardless of how many have elapsed since their interval. This is not
a constant-tuning change but a behavioral guard against irregular-cadence
flooding. If this is already in PR #447's logic, confirm and close. If not,
scope it as a separate ticket (low urgency before Marian starts using the app).

### For Kyle (design implications)

No design changes required. The interval tuning is backend logic.
The existing "never a red X" principle and Emma's in-character reactions
mean Marian won't perceive the Leitner scheduling at all — it operates invisibly.

---

## Recommended constants (final)

```
LEITNER_REVIEW_INTERVAL_DAYS = {
  1: 0,   // same session or next session — unchanged
  2: 1,   // CHANGED: was 2; tighten to catch post-consolidation window
  3: 3,   // CHANGED: was 4; minor tightening per 20% gap ratio
  4: 7,   // unchanged
  5: 14,  // unchanged
}
```

Box2 (2→1) is the only change with strong evidence backing. Box3 (4→3) is a
minor tightening with weak evidence backing — acceptable to leave at 4 if
simpler. The others hold.

---

## Sources (canonical list, 11 sources)

1. Vlach, H.A., Sandhofer, C.M., & Kornell, N. (2008). Cognition, 109(1), 107–116.
   PubMed: 18835602. https://www.sciencedirect.com/science/article/abs/pii/S0010027708001753

2. Vlach, H.A. & Sandhofer, C.M. (2012). Child Development, 83(4), 1171–1181.
   DOI: 10.1111/j.1467-8624.2012.01781.x

3. Cepeda, N.J., Vul, E., Rohrer, D., Wixted, J.T., & Pashler, H. (2008).
   Psychological Science, 19(11), 1095–1102.
   DOI: 10.1111/j.1467-9280.2008.02209.x
   https://www.yorku.ca/ncepeda/publications/CVRWP2008.html

4. Backhaus, J., Hoeckesfeld, R., Born, J., Hohagen, F., & Junghanns, K. (2008).
   Neurobiology of Learning and Memory, 89(1), 76–80.
   DOI: 10.1016/j.nlm.2007.09.002

5. Backhaus et al. (2020). Scientific Reports (children vs. adults sleep
   consolidation). PMC: PMC7305149.

6. Karpicke, J.D. & Roediger, H.L. (2007). Journal of Experimental Psychology:
   Learning, Memory, and Cognition, 33(4), 704–719.
   https://learninglab.psych.purdue.edu/downloads/2007/2007_Karpicke_Roediger_JEPLMC.pdf

7. Küpper-Tetzel, C.E., Kapler, I.V., & Wiseheart, M. (2014). Memory & Cognition,
   42(5), 729–741. DOI: 10.3758/s13421-014-0408-z

8. Retrieval practice and word learning in children with DLD (2024).
   Journal of Speech, Language, and Hearing Research. PMC: PMC11087082.

9. McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025).
   Psychological Science in the Public Interest, 26(1), 10–57. PubMed: 40297988.
   DOI: 10.1177/15291006241287726

10. Ophuis-Cox, R.H.A. et al. (2023). Applied Cognitive Psychology.
    DOI: 10.1002/acp.4141

11. Dunlosky, J. et al. (2013) / Nature Reviews Psychology (2022).
    Spacing and retrieval practice meta-analysis.
    https://www.nature.com/articles/s44159-022-00089-1
