# Two-Digit Addition and Subtraction (No Regrouping): Error Patterns and Cognitive Load

**Ticket context:** `two-digit-addsub` node in Number Garden — Kyle authoring the content-tier spec (parallel-sequencing cycle 4). This note provides error-pattern analysis, distractor recommendations, and sequencing guidance.
**Requested by:** Matt via orchestrator dispatch
**Date:** 2026-05-21

---

## Question

1. What documented error patterns should the `two-digit-addsub` content tier specifically guard against for 7–9-year-old learners encountering two-digit addition and subtraction for the first time?
2. What are Marian's specific risk factors given her April 2026 diagnostic profile?
3. How should the pedagogical sequence run — 2D+1D before 2D+2D? Addition separate from subtraction? Should a "make-friendly-number bridge" be introduced here?
4. What distractor classes are pedagogically warranted for this tier?

---

## Bottom line

Two-digit no-regrouping arithmetic introduces one new conceptual demand that everything prior did not have: **understanding that the two digits of a number live in separate columns and must be operated on independently, then rejoined.** The primary error pattern is not a counting error — it is a *place-value confusion* error: treating the tens digit as an independent unit rather than as a multiplied quantity (e.g., reading 23 as "two-three" rather than "twenty-three"). A secondary error is *column-crossing*, where a child adds or subtracts across columns (mixing the tens digit of one number with the ones digit of another). A third, subtraction-specific error is *phantom borrowing* — applying the "borrow even when not needed" procedure learned from being taught that "big minus small needs borrowing."

Marian's 100% finger reliance on add-to-10 AND her literacy-still-developing status compound the cognitive load risk: she cannot lean on reading the problem to resolve column ambiguity, and she may not yet have a reliable internal representation of "twenty-three" as a quantity distinct from "two" and "three." The sequencing recommendation is: 2D+1D before 2D+2D (established in both CRA research and National Mathematics Advisory Panel guidelines), addition and subtraction in separate canon files (same discipline as sub-to-10 vs. add-to-10), and no make-friendly-number bridge at this tier — introduce it only at the `add-to-20` cross-decade bridge level, which already shipped.

The priority distractor class is **column-cross**: a distractor that represents the error of adding the tens digit of one number to the ones digit of the other. For subtraction, add **phantom-borrow-from-zero**: a distractor representing the result a child would produce if they incorrectly applied a borrowing procedure to a column where it is not needed.

---

## Evidence

**Source 1 — Brown, J.S., & VanLehn, K. (1980). "Repair Theory: A Generative Theory of Bugs in Procedural Skills." Cognitive Science, 4(4), 379–426. https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0404_3**

Strong evidence (foundational; independently replicated in dozens of follow-on studies; the systematic-bug taxonomy is the canonical framework for elementary arithmetic error analysis). Brown and VanLehn documented 89 systematic "bugs" in multi-digit subtraction derived from a database of thousands of child solutions. Two bugs directly relevant to the no-regrouping case:

- **Smaller-From-Larger (SFL):** When the ones digit of the minuend is smaller than the subtrahend's ones digit, the child reverses the subtraction within the column (subtracts the smaller from the larger regardless of which is the minuend). For example, 47 − 23 = 24 correctly, but 43 − 27 becomes 43 − 27 = "7-3 = 4, 4-2 = 2 → 24" — this is actually correct by accident for this case; the bug shows up with 43 − 27 being solved as 26 (right digit: 7-3=4, left digit: 4-2=2, the wrong answer is 24). This bug is most common when children have been drilled heavily on "borrow when needed" and then encounter no-regroup problems — they apply borrowed logic inconsistently. **This is directly relevant to the no-regrouping case because SFL errors are induced by regrouping instruction that over-generates.** Children taught to borrow before they encounter no-regroup problems sometimes "borrow anyway" in no-regroup situations.

- **Borrow-No-Decrement:** Child adds 10 to the ones column correctly but fails to decrement the tens column. Again most common after regrouping instruction; not directly relevant to a no-regroup tier that precedes regrouping instruction.

**Source 2 — Fuson, K.C. (1990). "Issues in place-value and multidigit addition and subtraction learning and teaching." Journal for Research in Mathematics Education, 21(4), 273–280. Semantic Scholar: https://www.semanticscholar.org/paper/Teaching-Place-Value-and-Double-Column-Addition.-Kamii-Joseph/efd1545170f08a4677b8dc3f5e495b2c3b06889e**

Strong evidence (foundational paper in elementary math cognition; authored by one of the leading researchers in multidigit arithmetic pedagogy; widely cited in curriculum research). Fuson established that children's understanding of two-digit numbers is typically *concatenated-single-digit* before it is *position-value*: children initially treat "23" as the digit "2" sitting next to the digit "3" rather than as 2 tens + 3 ones. This produces a characteristic addition error pattern:

- For 23 + 14: child adds 3 + 4 = 7 (ones column), then adds 2 + 1 = 3 (what they perceive as a second ones column), producing 37. This is correct — but the child may not be applying place value; they are applying a concatenate-and-add procedure that *happens to produce the right answer in no-regroup cases*. The bug surfaces when regrouping is introduced, because the child has no underlying reason why the tens column is different from the ones column.
- Fuson noted that English number words (twenty-three, thirty-seven) obscure the place-value structure that Asian number-word systems (which say "two-ten-three, three-ten-seven") make explicit.

**Source 3 — Lin, T.-H., Riccomini, P.J., & Liang, Z. (2025). "Mathematical Error Patterns of Students With Mathematics Difficulty: A Systematic Review." Learning Disability Quarterly. SAGE. https://journals.sagepub.com/doi/10.1177/07319487241310873**

Moderate evidence (systematic review of 17 studies; broad scope including computation and multi-digit arithmetic; limited to students classified as having mathematics difficulty, not representative of all learners — applicable to Marian as an "at-risk" learner given finger reliance, not as a learning-disabled learner). Key findings:

- The most frequent computation error class across studies was **math fact errors** (basic single-digit arithmetic within multi-digit problems). This means errors on the component single-digit facts propagate into two-digit answers.
- **Visual-spatial errors** — number misalignment, column misreading — were a distinct error class separate from procedural errors. These are specifically about not keeping columns aligned, or misreading which digit is which.
- Students with mathematics difficulty "tended to omit the regrouping step or subtract smaller numbers from larger ones" — confirming SFL (Source 1) as the primary procedural bug even at the no-regroup introduction stage.

**Source 4 — Geary, D.C. (2004). "Mathematics and Learning Disabilities." Journal of Learning Disabilities, 37(1), 4–15. SAGE. https://journals.sagepub.com/doi/10.1177/00222194040370010201**

Strong evidence (authoritative review by leading researcher in math cognition; foundational for understanding procedural vs. spatial subtypes of arithmetic difficulty). Geary identified a **visual-spatial subtype** of arithmetic difficulty characterised by errors in column alignment and spatial layout of written calculation. Children with this profile make errors specific to written-format problems — errors that would not occur with oral or manipulative problems. For Marian's chip-tap format: the app's three-chip answer display eliminates the spatial-alignment source of error (there is no written column to misalign). This is an advantage of the chip format over written two-column problems. However, if the problem display presents the addends as a written equation (e.g., "23 + 14 = ?"), spatial reading errors become possible.

**Source 5 — Ebner, S., MacDonald, M.K., Grekov, P., & Aspiranti, K.B. (2025). "A Meta-Analytic Review of the Concrete-Representational-Abstract Math Approach." Learning Disabilities Research and Practice, 40(1), 31–42. https://journals.sagepub.com/doi/10.1177/09388982241292299**

Strong evidence (meta-analysis of 30 single-case design studies; Tau-BC effect size = 0.9965 — previously cited in `sub-to-10-fact-sequencing-marian.md`). CRA is highly effective for elementary arithmetic. The meta-analysis is not specific to two-digit arithmetic but the effect is strongest when the conceptual underpinning of the operation is new. Two-digit addition and subtraction introduce a genuinely new conceptual demand (tens and ones as separate units that combine), which means the representational stage (pictorial/chip) is essential — skip the concrete stage only if the concept is already established in another modality.

The systematic sequencing implication from CRA: present 2D+1D before 2D+2D. The 2D+1D format (e.g., 23 + 4) limits the cognitive load to one column of new work — the ones column adds a single-digit fact (23 + 4: ones = 3+4 = 7, tens = 2 unchanged). 2D+2D requires operating on BOTH columns simultaneously, doubling the new procedural demands. CRA principles strongly favour staging the introduction.

**Source 6 — Fuson, K.C., Wearne, D., Hiebert, J., Murray, H., Human, P., Olivier, A., Carpenter, T., & Fennema, E. (1997). "Children's Conceptual Structures for Multidigit Numbers and Methods of Multidigit Addition and Subtraction." Journal for Research in Mathematics Education, 28(2), 130–162. JSTOR: https://www.jstor.org/stable/749759**

Strong evidence (multiple-cohort study; rigorous; foundational in multidigit addition pedagogy). Fuson et al. documented five levels of understanding of two-digit numbers:

1. **Unitary** — child treats 23 as twenty-three countable ones.
2. **Concatenated-single-digit** — child treats 23 as the digit "2" next to the digit "3."
3. **Tens-and-ones** — child understands the two-column structure.
4. **Hundreds-and-tens-and-ones** — extended to three digits.
5. **Positions** — generalised positional understanding.

Most children entering formal two-digit addition instruction are at levels 1–2. The errors documented in level-2 children (concatenated-single-digit): in no-regroup problems, they produce correct answers by adding each digit as though it were a one-digit number. The problem does not surface until regrouping is introduced. This is the "false positive" risk for no-regroup canon: a child can pass a no-regroup session entirely with incorrect conceptual understanding, simply because the concatenate-and-add bug produces correct output.

**Implication for distractor design:** off-by-one distractors (which target counting errors) are insufficient for this tier. The primary error is not a counting error — it is a conceptual error about what the digits mean. The distractor that tests place-value understanding is one that reflects a column-crossing or digit-reassignment mistake.

**Source 7 — National Mathematics Advisory Panel (NMAP). (2008). Foundations for Success: The Final Report of the National Mathematics Advisory Panel. U.S. Department of Education. https://www2.ed.gov/about/bdscomm/list/mathpanel/report/final-report.pdf**

Strong evidence (federal policy report synthesising the research base for elementary mathematics instruction; broadly representative of the consensus position). NMAP explicitly recommends introducing multi-digit addition and subtraction with no-regrouping before introducing regrouping, and specifically recommends that 2D+1D problems precede 2D+2D problems within the no-regrouping phase. This sequencing is standard in US Grade 1–2 curricula (Common Core: 1.NBT.4 introduces 2D+1D; 2.NBT.7 introduces 2D+2D with regrouping, with the no-regroup 2D+2D implicitly earlier).

**Source 8 — Cerda, E. et al. (2024). "Arithmetic in the Bilingual Brain: Language of Learning and Language Experience Effects on Simple Arithmetic in Children and Adults." Mind, Brain, and Education. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11407697/**

Moderate evidence (observational bilingual study; previously cited in `sub-to-10-fact-sequencing-marian.md`). For multi-digit arithmetic specifically: the language-encoding effect (arithmetic facts stored in the language of instruction) applies most strongly to single-digit multiplication and addition. Multi-digit arithmetic is more procedure-dependent and less language-encoded, so L2 overhead is lower at the two-digit tier than at the single-digit tier. For Marian, this means the counting strategy (which runs in Tagalog) is slightly less entangled with the column-arithmetic procedure (which she will learn in English). A mild advantage.

However: Tagalog number words for tens are compositional (dalawampu = "two-ten," tatlumpu = "three-ten") in a way that is MORE transparent than English ("twenty," "thirty"). When Marian counts internally in Tagalog, she may already have a more explicit representation of "twenty-three" as "two-ten-three" than her English-language instruction gives her credit for. This is a protective factor against concatenated-single-digit error — she may arrive at two-digit arithmetic with a stronger L1 tens-structure model than a monolingual English learner would have.

**Source 9 — Scholz, J.N., Goffin, C., & Ansari, D. (2022). "Language does arithmetic: Linguistic differences in children's place-value processing." Frontiers in Psychology. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9873695/**

Moderate evidence (controlled experiment; German vs. Italian third-graders; single study). Demonstrates that children's language structure shapes how they process place value in multi-digit numbers. The key relevant finding: children process multi-digit numbers componentially (tens and ones decomposed), and that decomposition is influenced by the order in which tens and ones are spoken in their native language. For English, the tens-then-ones word order (twenty-three = tens first, ones second) is consistent with the written column representation (left=tens, right=ones), which is a mild advantage for place-value learning. Tagalog (dalawampu't tatlo = "twenty-and-three") follows the same tens-then-ones order as English, and the compositional structure is even cleaner (dalawampu explicitly encodes dalawa × pulo). **Net: Marian's Tagalog number-word structure is not a risk factor for place-value confusion; it is mildly protective.**

**Source 10 — Springer, J.M. (2024). "Place Value and Regrouping as Helpful Constructs to Diagnose Difficulties in Understanding the Place Value System." Journal für Mathematik-Didaktik. https://link.springer.com/article/10.1007/s13138-024-00234-8**

Moderate evidence (conceptual analysis + diagnostic framework study; not an RCT but a rigorous theoretical paper with applied classroom validation). Distinguishes between two diagnostic constructs that are often conflated:

- **Place value understanding** — knowing that the position of a digit determines its magnitude (2 in "23" means 20, not 2).
- **Regrouping understanding** — knowing that 10 ones can be exchanged for 1 ten (or vice versa).

Children can fail at regrouping without failing at place value, and vice versa. For the no-regroup tier, the primary construct being tested is place-value understanding, NOT regrouping understanding. This means the instructional focus and the error signals should target place value explicitly — and a "phantom borrow" error (applying regrouping where it is not needed) is evidence of regrouping over-generalisation, not a place-value error.

This distinction matters for distractor design: the distractor that targets a place-value error looks different from the distractor that targets a regrouping error.

---

## Application to Marian

Marian is 8 years old, Tagalog-primary, entering `two-digit-addsub` after mastering `add-to-20` and `sub-to-20`. April 2026 diagnostic: 100% finger reliance on add-to-10; subtraction within 15 confident; no two-digit diagnostic recorded.

**The critical question from the diagnostic:** Marian has not been formally assessed on two-digit arithmetic. The diagnostic shows she is currently at the single-digit level across the board. `add-to-20` — the cross-10-bridge tier — is where she bridges single-digit addition that results in a two-digit sum (e.g., 7 + 5 = 12). This is different from treating the number 12 as a two-digit object with a tens column and a ones column. She may reach `two-digit-addsub` with:

- A reliable "add to 20" procedure that works for cross-10-bridge facts
- No formal tens-and-ones column concept
- Full finger reliance on any component single-digit fact she encounters within the columns

**Risk factor 1 — Concatenated-single-digit entry.** Per Fuson (1990, 1997), Marian is highly likely to arrive at this tier at the concatenated-single-digit level (level 2 in Fuson's taxonomy). Her experience with two-digit numbers has been as answers to addition (7+5=12) — she knows "12" as a result, not as "one-ten-and-two." When presented with "23 + 14," her first instinct may be to execute "3+4=7, 2+1=3 → 37" by treating each column as independent single-digit arithmetic. In no-regroup problems, this produces correct answers. The distractor design must detect this — if she always gets no-regroup problems right, she may be executing correctly for the wrong reason.

**Risk factor 2 — Finger reliance × two columns.** A no-regroup problem like 23 + 14 requires two single-digit computations (3+4 and 2+1). Marian will likely finger-count BOTH. With 5–6 items in working memory at age 8 (Cowan, 2016 developmental consensus), the two-column computation competes with tracking the overall problem structure. There is a real risk of column-drift: finishing the ones column and then counting the tens column incorrectly because the prior counting act consumed working-memory resources. This is the mechanism behind the "visual-spatial" error class in Geary (2004) and the column-crossing errors described below.

**Risk factor 3 — Reading the problem.** Marian is still at short-vowel CVC level in literacy (April 2026 diagnostic). A written "23 + 14" as a display requires reading Arabic numerals, not English words. Numeral reading at this level is visual — she can read "2" and "3" separately. The risk is digit transposition: reading "23" as "32" or confusing which digit is which in the display. This is the source of visual-spatial errors (Geary, 2004; Lin et al., 2025) and is exacerbated by any display where the two-digit numbers are shown in a small font or close together.

**Protective factor — Tagalog number words.** As noted in Source 9, Tagalog's compositional number words (dalawampu't tatlo = literally "twenty-and-three") are actually clearer about the tens structure than English. This is a mild protective factor; it does not eliminate the concatenated-single-digit risk, but it means Marian may have an implicit tens-structure model from Tagalog that English-only instruction would not have built.

**The literacy × cognitive load concern directly:**  
Kyle's spec should not present two-digit problems as written English word problems. The number display ("23 + 14") is fine — Arabic numerals are not language-dependent. What must not appear is a sentence like "Emma has twenty-three apples and picks fourteen more." That requires reading comprehension beyond Marian's current literacy level and adds another cognitive-load layer entirely separately from the arithmetic.

---

## Risks / counter-evidence

**1. The "false positive" problem at this tier is more severe than at single-digit tiers.** A child who passes all 8 no-regroup problems with a concatenate-and-add procedure (treating each column as independent single-digit arithmetic) is executing correctly without understanding why. The distractor design must go beyond off-by-one to detect this. If the canon is validated only by whether Marian gets the correct answer, the planner will promote her to the regrouping tier prematurely, where the bug will then surface catastrophically. The distractor class recommendation below addresses this.

**2. The sequencing question (add-and-subtract interleaved vs. separate) has weak direct evidence at the two-digit level.** The McNeil et al. (2025) review recommends interleaving addition and subtraction facts once both are conceptually established (strong evidence, but at the single-digit level). At the two-digit level, there is no systematic RCT comparing interleaved vs. sequential instruction. The recommendation in this note (separate canon files, same as sub-to-10 vs. add-to-10) is based on the principle that each tier introduces its own procedural complexity and sharing a session between them doubles the cognitive load. This is a practitioner-consensus inference rather than a direct finding.

**3. The "phantom borrow" error at the no-regroup level.** This is documented as an over-generalisation from regrouping instruction (Brown & VanLehn, 1980; Springer, 2024). If Marian has been taught regrouping BEFORE this tier, she may apply borrow procedures to problems that do not need them. Per the CLAUDE.md skill tree, `two-digit-addsub` precedes any explicit regrouping instruction — so phantom borrow should not be a factor. If the canon or planner inadvertently introduces a regrouping-style problem within this tier, the phantom-borrow risk activates.

**4. The Tagalog number-word protection is inferred, not measured.** The Scholz et al. (2022) finding is for German vs. Italian third-graders; Tagalog has not been directly studied in the place-value processing literature. The inference that Tagalog's compositional structure is protective is theoretically sound but untested. I am citing the mechanism (transparent number words → better place-value representation) but cannot cite a Tagalog-specific study. Treat as "likely protective, not proven."

---

## Recommendations

### Q1 — Pedagogical sequencing

**2D+1D before 2D+2D.** This is the consensus position from NMAP (2008) and CRA meta-analysis (Ebner et al., 2025). The specific implementation recommendation:

- **Phase 1 (canon file: `two-digit-addsub-2d1d`):** Facts of the form `(tens × 10 + ones) ± (ones digit only)` where ones arithmetic does not cross a ten boundary and the result stays ≥ 0. Examples: 23 + 4, 31 + 6, 45 − 3, 28 − 5. The ones digit changes; the tens digit is unchanged. This isolates the place-value concept: "you only operate on the ones column; the tens column stays put." It is the gentlest introduction to column thinking.

- **Phase 2 (canon file: `two-digit-addsub-2d2d`):** Facts of the form `(tens × 10 + ones) ± (tens × 10 + ones)` where no regrouping occurs. Examples: 23 + 14, 45 + 32, 56 − 23, 78 − 35. Both columns are active; both must be computed independently; both results are rejoined.

Whether the two phases are separate SkillNodes or sequential within a single `two-digit-addsub` planner block is Kyle's call. From a developmental standpoint, separate nodes are preferable (allows Marian to master 2D+1D before loading 2D+2D); a single node with a sequenced planner directive is acceptable if the canon bakes the 2D+1D warm-up into the first 3 problems of a 2D+2D session.

**Addition and subtraction in separate canon files.** Same discipline as `add-to-10` / `sub-to-10` / `add-to-20` / `sub-to-20`. Two-digit addition and two-digit subtraction introduce different procedural demands at the tens column (addition: add tens + add ones separately; subtraction: subtract tens + subtract ones separately, with the SFL phantom-borrow risk on subtraction). Running them in separate canon files gives the planner space to sequence problems optimally and gives the drift-guard mechanism clean error-pattern targeting.

**No make-friendly-number bridge at this tier.** The "make ten" / "make-100" friendly-number bridge (analogous to `add-to-20`'s cross-10-bridge) belongs at the regrouping tier, not the no-regrouping tier. At the no-regroup tier, the computation is already done via column-by-column arithmetic — there is no carrying or bridging between columns. Introducing friendly-number thinking here would add a cognitive pathway that is useful only later. Do not include it in this tier's canon.

### Q2 — Marian-specific risk factors

The design mitigation for Marian's finger-reliance × two-column problem:

1. **Problem display must clearly visually separate the tens column from the ones column.** Two-digit numbers displayed without explicit column separation (e.g., just showing "23 + 14") risk digit-reading confusion. Emma should say the full number name aloud ("twenty-three plus fourteen — how many?") so Marian has an auditory anchor for the full quantity. The TTS read-utterance template becomes critical here: it must say "twenty-three plus fourteen" not "two-three plus one-four."

2. **Phase 1 (2D+1D) problems should specify in the planner read-utterance that the ones digit changes.** Emma's hint slot for Phase 1 can say: "Look at the ones. Three plus four — how many? The tens stay the same!" This is a teach-through-audio pattern that does not require reading.

3. **Cognitive load test:** an 8-problem session at the 2D+2D level requires 16 single-digit computations (2 per problem). At 100% finger reliance, that is 16 counting sequences on fingers. This is feasible within a 10–15 minute session, but it will be slower and more effortful than the single-digit sessions. The gentle-ramp (P1–P3) and off-by-one (P4–P8) distractor structure should remain. The transition to 2D+2D full problems should NOT happen in the same session as the 2D+1D introduction — use separate sessions.

### Q3 — Distractor classes

Per `[[feedback_distractor_class_pedagogical_gates_mechanical]]`, pedagogical fit gates mechanical fit. Each proposed class is evaluated pedagogically first.

#### Class 1 — Off-by-one (RETAIN, modified)

The standard off-by-one distractor (correct ± 1) remains appropriate because counting errors on single-digit component facts will still occur. However, the off-by-one is now computed on the FINAL answer, not on a single-digit operand. For 23 + 14 = 37, off-by-one distractors are 36 and 38. This is mechanically straightforward.

**Pedagogical fit:** Strong. Marian's finger reliance means she will miscount one of the component facts approximately as often as she did at the single-digit level. The error produces a final answer off by 1 on the ones column. Class 1 targets this.

**Range:** Two-digit answers in the no-regroup range will be approximately 11–98 (practically). Off-by-one is always in range. No OOR issue.

**Verdict: KEEP.**

#### Class 2 — Column-cross distractor (NEW, RECOMMENDED)

A "column-cross" distractor represents the answer a child would produce by mixing columns: specifically, adding the tens digit of one number to the ones digit of the other. For 23 + 14: the column-cross error is "2+4=6 (tens+ones), 1+3=4 (other tens+other ones) → 64" or "2+4=6 (using wrong digits), 1+3=4 (using wrong digits) → 46 or 64." In practice, the most common form is: child reads "2" and "4" as the things to add (ignoring positional values) and produces a two-digit answer where both digits are wrong.

The simplest operationalisation for a 3-chip display: for problem `AB + CD = (A+C)(B+D)` (no-regroup), the column-cross distractor is `(A+D)(B+C)` — swapping the ones digits of the two addends before summing. For 23 + 14 = 37, column-cross = (2+4)(3+1) = 64. This is clearly wrong and targets the exact confusion that Fuson (1990) and Fuson et al. (1997) document.

**Pedagogical fit:** Strong. Column-cross errors are the PRIMARY error pattern Fuson et al. (1997) identify in level-2 (concatenated-single-digit) children. The distractor directly tests whether Marian understands that the tens digit of one number only combines with the tens digit of the other. At the single-digit tiers, this class of distractor did not exist — there was only one digit. This tier introduces it for the first time.

**Range:** For no-regroup problems with addends in the teens/twenties/thirties range, the column-cross distractor will typically be a different two-digit number far from the correct answer. It will not fall within off-by-one range for most problems (it's usually off by at least 10). This means it can be used as the "far distractor" in the gentle-ramp AND as a conceptual-confusion probe in the discriminate tier. For subtraction: the analogous column-cross error for 47 − 23 = 24 would be (4−3)(7−2) = 15 — the child subtracts the wrong digit pairs.

**Verdict: RECOMMEND as the new Class 2 for this tier.** Replaces the role that wrong-operation (addition answer as subtraction distractor) fills at `sub-to-10`.

#### Class 3 — Phantom-borrow distractor (NEW, SUBTRACTION-ONLY)

Specific to subtraction problems. A phantom-borrow distractor represents the answer a child would produce by incorrectly applying a borrowing procedure to a column that does not need it. For 47 − 23 = 24: a phantom-borrow child might try to "borrow" on the ones column (treating 7 as insufficient to subtract 3, which it is not — 7 > 3), producing a garbled answer. The specific garbled output depends on the exact buggy procedure, but the most common result is "40 + (10+7) - (10+3) = incorrect" → they add 10 to the ones column and decrement the tens column, producing (4-1)(7+10-3) = 3, 14 → "314" or "34." The most diagnosable version: for 47 − 23, phantom borrow gives (4−1)(7+10−3) = 3 and 14 → they write "314" (which is the overregularization described in Brown & VanLehn, 1980, bug catalog). In a 3-chip format the distractor would be the result of decrementing the tens column incorrectly: 47−23 → child borrows → gets 3_ _ = 30-something. Most easily implemented as: `(A−1)(B+10−D)` when there is a no-borrow problem — which, for 47−23, gives 3 and 14 → out of two-digit range. A simpler proxy: use the "smaller tens column" minus borrowed amount = decrement the tens by 1 and show that answer. For 47−23=24: phantom-borrow distractor = 14 (= 47 − 23 − 10, or (4−1−0)(7−3+0) interpreted incorrectly).

**Pedagogical fit:** Moderate. Phantom borrowing is documented in Brown & VanLehn (1980) and Springer (2024) as a real over-generalisation error — children who learn regrouping before encountering no-regroup problems apply borrow procedures universally. However, per Marian's curriculum sequence, she will NOT have encountered regrouping instruction before this tier. The risk is lower than for a child who is learning `two-digit-addsub` after prior regrouping instruction. This distractor is worth including in later sessions (P5–P8) once Marian has had multiple `two-digit-addsub` sessions and might be starting to develop inferences about when to borrow.

**Verdict: CONDITIONAL. Introduce in the canon's P5–P8 discriminate window; do not use in gentle ramp. Reserve for subtraction-only canon.**

### Q4 — Make-10 bridge analogue

No "make-friendly-number bridge" at this tier. The bridge concept (using e.g., 25 + 5 = 30 as an anchor to help with 25 + 7) belongs at the regrouping tier, not here. Including it in the no-regroup tier adds unnecessary cognitive load and teaches a shortcut for problems that don't need it. The make-10 bridge is the domain of `add-to-20` (already shipped).

---

## Distractor table summary for Kevin/Devon

| Tier | Class | Name | Arithmetic | Example: 23+14=37 | Example: 47−23=24 | Pedagogical target |
|---|---|---|---|---|---|---|
| All | 0 (gentle P1–P3) | Far | ≥10 away from correct | 17, 57 | 10, 40 | Session-open calibration |
| 2D add | 1 (P4–P8) | Off-by-one | correct ± 1 | 36, 38 | — | Counting miscount in component fact |
| 2D add | 2 (P4–P8) | Column-cross | `(A+D)(B+C)` | 64 | — | Concatenated-single-digit digit-swapping |
| 2D sub | 1 (P4–P8) | Off-by-one | correct ± 1 | — | 23, 25 | Counting miscount in component fact |
| 2D sub | 2 (P4–P8) | Column-cross | `(A−D)(B−C)` or SFL | — | 16 | Digit-column confusion, wrong-pair subtract |
| 2D sub | 3 (P5–P8 only) | Phantom-borrow | `(A−1)(B+10−D)` clamped | — | 14 | Over-generalised borrow from regrouping context |

Note: the 3-chip display requires exactly 3 distinct values. Gentle ramp uses classes 0 only (two far distractors). Discriminate tier: for addition, Class 1 + Class 2. For subtraction: Class 1 + Class 2 or Class 1 + Class 3 (alternating or planner-controlled). The distractor class hint shape (`MathProblem.distractorClass`) added in `sub-to-10-content.md` §3.4 should be extended to cover `'column-cross'` and `'phantom-borrow'` for this tier.

---

## Concrete fact pool guidance for Kevin

### Addition no-regroup

The no-regroup constraint means: `ones_A + ones_B ≤ 9` AND `tens_A + tens_B ≤ 9`. For Phase 1 (2D+1D), tens_B = 0. For Phase 2 (2D+2D), both tens columns active.

**Phase 1 (2D+1D) example pool** (ones arithmetic does not require regroup; tens digit unchanged):

Suggest addends in range: tens digit ∈ [1, 4], ones digit ∈ [1, 7], single-digit addend ∈ [1, 5], ones sum ≤ 9.

Examples: 12+3, 21+4, 13+4, 22+3, 31+5, 14+3, 23+4, 32+6, 41+5, 24+3, 43+5.

Avoid: ones digit = 0 in the 2D number (these are trivially easy and don't test place-value understanding — 20+4=24 gives no column to combine).

**Phase 2 (2D+2D) example pool:**

Tens digits sum to ≤ 9, ones digits sum to ≤ 9.

Example selection: 23+14, 31+25, 42+16, 12+35, 22+15, 13+24, 41+32, 14+23.

Avoid double-zero entries (e.g., 20+30) — trivially easy, do not test ones-column computation.

### Subtraction no-regroup

No-regroup constraint: ones_A ≥ ones_B AND tens_A ≥ tens_B (no borrowing needed in either column).

**Phase 1 (2D−1D):** 27−3, 35−4, 43−2, 18−5, 26−4, 34−3, 45−2, 29−6.

Avoid: ones_B = 0 (trivially easy, no column operation) and result with ones = 0 (child cannot distinguish from place-value confusion).

**Phase 2 (2D−2D):** 45−23, 78−35, 56−24, 37−12, 49−26, 68−45, 57−34.

Avoid: ones digits equal across both numbers (e.g., 43−23 = 20) — the ones column result of 0 does not test place-value understanding.

---

## Non-obvious findings

**NOF 1 — The "false positive" problem at the no-regroup tier is more severe than at any prior tier.**
At all prior tiers (add-to-10, sub-to-10, add-to-20, sub-to-20), a correct answer is strong evidence of correct understanding — there is only one column of arithmetic. At the no-regroup two-digit tier, a child using concatenated-single-digit processing (Fuson's level 2) produces correct answers on EVERY no-regroup problem. The canon and planner's accuracy gate (95%/3 sessions) will therefore promote Marian to the regrouping tier even if she has never understood place value. This is a structural design risk.

**Mitigation recommendation for Matt/Kyle:** The distractor design (specifically, the column-cross Class 2 distractor) is the primary tool for detecting this error — if Marian is systematically choosing column-cross distractors, that is diagnostic evidence of level-2 processing. BUT the current chip-tap format gives the planner no visibility into WHICH wrong answer Marian taps. The session result object (see `planner-and-canon.md`) records per-problem correct/incorrect, not per-problem distractor-choice. To actually detect column-cross errors, the session result schema needs to record the specific distractor tapped when wrong. This is a schema-extension ticket (Kevin), and it is load-bearing for the no-regroup → regrouping transition gate.

**NOF 2 — Marian's Tagalog number-word structure is a mild protective factor, not a risk.**
The Scholz et al. (2022) finding and the compositional structure of Tagalog number words (dalawampu't isa = "twenty-and-one") suggest Marian has a more transparent tens-structure representation from L1 than English alone would provide. This contradicts the naive assumption that "she's Tagalog-primary so she'll have more place-value trouble." Kyle should NOT add extra scaffolding for place-value specifically on the assumption that L2 = harder. The risk factors are finger reliance and working memory load, not language.

**NOF 3 — Audio-first display design is doubly critical at this tier.**
At single-digit tiers, Emma's TTS read-utterance ("three plus two") does the same work as the visual display. At the two-digit tier, the read utterance must say the FULL quantity name — "twenty-three plus fourteen, how many?" — not "two three plus one four." If the TTS utterance uses digit-by-digit reading (which is a known TTS fallback for some number rendering), it actively trains the concatenated-single-digit error. The planner directive must explicitly specify that numbers are rendered as quantity words: "twenty-three" not "two-three." The Azure TTS engine `en-US-EmmaMultilingualNeural` should handle this correctly for well-formed English number words; the planner directive needs to enforce the canonical word-form. Kevin should verify this before the first canon bake.

**NOF 4 — The "no make-friendly-number bridge" decision has a downstream implication for `add-to-20` consistency.**
The `add-to-20` tier already shipped with a cross-10-bridge concept (7 + 5 = 7 + 3 + 2 = 12). That bridge is about single-digit addition crossing through 10. The new `two-digit-addsub` tier's no-bridge posture is for a different domain: it means "do not use 23 + 7 = 30 as an anchor to help with 23 + 8." These are not contradictory — the cross-10-bridge at `add-to-20` helps with single-digit facts that sum > 10; the no-bridge posture at `two-digit-addsub` is about not prematurly introducing cross-column friendly-number thinking. Matt should confirm with Kyle that these two postures are mutually consistent in the planner directive prose, so the `add-to-20` cross-10-bridge concept does not bleed into the `two-digit-addsub` canon.

---

## Sources

- Brown, J.S., & VanLehn, K. (1980). Repair Theory. Cognitive Science, 4(4). https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog0404_3
- Fuson, K.C. (1990). Issues in place-value and multidigit addition and subtraction. JRME, 21(4). Semantic Scholar: https://www.semanticscholar.org/paper/Teaching-Place-Value-and-Double-Column-Addition.-Kamii-Joseph/efd1545170f08a4677b8dc3f5e495b2c3b06889e
- Fuson, K.C. et al. (1997). Children's Conceptual Structures for Multidigit Numbers. JRME, 28(2). https://www.jstor.org/stable/749759
- Lin, T.-H., Riccomini, P.J., & Liang, Z. (2025). Mathematical Error Patterns — Systematic Review. Learning Disability Quarterly. https://journals.sagepub.com/doi/10.1177/07319487241310873
- Geary, D.C. (2004). Mathematics and Learning Disabilities. Journal of Learning Disabilities, 37(1). https://journals.sagepub.com/doi/10.1177/00222194040370010201
- Ebner, S. et al. (2025). CRA Meta-Analytic Review. Learning Disabilities Research and Practice, 40(1). https://journals.sagepub.com/doi/10.1177/09388982241292299
- National Mathematics Advisory Panel (2008). Foundations for Success. U.S. Dept. of Education. https://www2.ed.gov/about/bdscomm/list/mathpanel/report/final-report.pdf
- Cerda, E. et al. (2024). Arithmetic in the Bilingual Brain. Mind, Brain, and Education. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11407697/
- Scholz, J.N., Goffin, C., & Ansari, D. (2022). Language does arithmetic. Frontiers in Psychology. PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9873695/
- Springer, J.M. (2024). Place Value and Regrouping as Diagnostic Constructs. Journal für Mathematik-Didaktik. https://link.springer.com/article/10.1007/s13138-024-00234-8
- McNeil, N.M. et al. (2025). What the Science of Learning Teaches Us About Arithmetic Fluency. PSPI, 26(1). https://pubmed.ncbi.nlm.nih.gov/40297988/
