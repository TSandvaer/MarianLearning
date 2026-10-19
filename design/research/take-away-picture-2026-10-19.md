# A picture for taking away (sub-to-10, sub-to-20)

**Date:** 2026-10-19
**For:** the coordinator, relayed to Thomas; Kyle writes the spec, Devon builds.
**Status:** research only, docs only.
**Trigger:** Thomas, 2026-10-19: "when marian goes to try 'taking away to ten' and 'taking away to twenty' there are no flowers to help, why is this?" He then approved (popup) "Dave re-checks it".

**Who this plans for:** any learner of about 6 to 9 (`CLAUDE.md:9`, #613). Marian is one user. No recommendation here depends on one child's school, language or history.

---

## Question

1. Should sub-to-10 and sub-to-20 show a take-away picture for a 6–9 learner?
2. If yes: what is the model? When does it show, and how does it fade across P1–P8 and across sessions? How does it work with the minuend flash and with sub-to-20's larger numbers? What must not change?
3. Order: before wave 5's build, alongside it, or after? Is it a small change to the existing steps, for all learners?

## Bottom line

1. **Yes.** Every subtraction problem in both steps gets a flower picture. I am withdrawing my own "skip the detour" ruling. It rested on one child's April diagnostic, which no longer holds for a multi-user app. The app also already speaks this picture: every take-away hint says "Look at the flowers." and "Six flowers.", but no flowers are drawn.
2. **The model:** the minuend's flowers sit in a ten-frame, and the taken-away flowers lift and turn pale on Emma's words. Sub-to-20 uses a double ten-frame: a full ten that never moves, plus the loose ones. The motion fades inside each session (wave 4's rule). The static flowers stay on every problem, as addition's do. The minuend flash stays as it is and plays first.
3. **Order: alongside wave 5, dispatched first, as its own small native PR.** It is a change to two existing steps, for all learners, mastered ones included. No audio, no canon, no planner, no server and no progress change. Cost: one native PR plus a short spec section. It ships in the next TestFlight build, ideally the one wave 5 needs anyway.

---

## State check (read in code, 2026-10-19)

- **Addition draws flowers and subtraction doesn't.**
  - Native `counting` is set only for `arith.op === '+'` or a missing-number problem (`mobile/src/screens/math/Math.tsx:1548-1553`).
  - The addition row shows whenever both addends are ≤ 9 (`MAX_COUNTED_ADDEND = 9`, `mobile/src/layout/mathLayout.ts:509`, `:526-528`). That covers every problem, every session and review too, with no Leitner fade.
- **Take-away gets only the minuend flash.**
  - The flash (`shouldShowSubitisingSubScaffold`, `packages/core/src/math/subitisingScaffold.ts:296-304`) needs focus node `sub-to-10` and minuend 5–10 (`MIN_SUB_MINUEND`/`MAX_SUB_MINUEND`, `packages/core/src/math/dotCard.ts:133-134`, `:156-164`).
  - It also needs the session's scaffold decision: the first 3 sessions, then a Leitner-mean fade (`subitisingScaffold.ts:85-103`, `:223-239`).
  - It is not shown on warm-ups, reviews or peeks (`Math.tsx:1495`).
  - It is a ~1.1 s flash (200 ms in, 700 ms hold, 200 ms out, `dotCard.ts:210-212`), then nothing.
  - **Sub-to-20 gets no picture at all.**
- **The words already describe a picture that isn't there.**
  - Every sub-to-10 and sub-to-20 canon problem's hints are "Look at the flowers." / "<Minuend> flowers." / "Take away <n>. How many now?" (`public/canon/math/level-1/sub-to-10.json` and `sub-to-20.json`, ids `math.p1.hint1`–`math.p8.hint3`).
  - The planner prescribes the same lines word for word (`api/_planner.ts:1879-1881` for sub-to-10, `:1958-1960` for sub-to-20).
  - On native, hint 1 sets `hintBeat('group-a')` (`Math.tsx:1151`), but there is no flower group to ripple. Emma points at nothing.
- **The reason the picture was left out:**
  - `design/research/sub-to-10-fact-sequencing-marian.md:88` ("Q2 — Visual model: skip the detour"). It rested on "her diagnostic showed subtraction within 15 to be confident".
  - Carried into `design/research/sub-to-20-pedagogical-sequence.md:205` and `design/math/sub-to-20-content.md:23`, `:48`.
  - The web comment `src/screens/Math/Math.tsx:3092-3099`: "Two flower groups with a `−` between them would be visually nonsense".
- **Sub-to-20 never crosses the ten.**
  - The pool is minuend 11–19, subtrahend 1–9, "NO BORROW — the ones-digit of the minuend MUST be >= subtrahend" (`api/_planner.ts:1885`).
  - The canon is 11−1, 12−2, 13−3, 14−2, 15−5, 15−3, 17−5, 18−6.
- **A take-away motion already exists.** "More and less" lifts blocks out of a tray on "less" (#608).
  - Its spec is `design/native/content-wave-4.md:107-108`, `:121`: rise 24 pt (tablet 32), fade over 250 ms, 90 ms apart, last-placed first. Reduce Motion: a 200 ms fade with no rise.
  - Its fading rule is P1–P3 moving on the read and the rest at hint 2 (`content-wave-4.md:107-108`, from M10).
- **The web is frozen** (`design/native/content-wave-4.md:5`), so this is native only.

---

## Evidence

**New sources**

- **T1. Carpenter & Moser (1984)**, "The acquisition of addition and subtraction concepts in grades one through three", _Journal for Research in Mathematics Education_ 15 (reference lists give pp. 179–202 or 178–205).
  - Children first solve take-away problems by direct modelling: show the whole with objects, remove the part, count what is left. Counting strategies and recall come later.
  - Strong and much replicated (the basis of Cognitively Guided Instruction). I saw it only through secondary summaries (Everyday Mathematics literature review, https://www.mheducation.com/unitas/school/explore/research/em-review-literature-for-facts-strand.pdf); I did not open the paper.
- **T2. Baroody (1984)**, "Children's difficulties in subtraction: some causes and questions", _JRME_ 15(3):203–213 (already in `sub-to-10-subitising-mental-model.md`).
  - Counting down "requires two simultaneous processes that in effect go in opposite directions" (the EM review's paraphrase). It gets more error-prone as the numbers grow.
  - Strong. _Use:_ a child with no picture must count down in their head or on fingers. That is the hard route, and it is worst on sub-to-20.
- **T3. Common Core, fetched 2026-10-19.** These are standards, not evidence of effect.
  - K.OA.A.1: "Represent addition and subtraction with objects, fingers, mental images, drawings …". https://www.thecorestandards.org/Math/Content/K/OA/
  - 1.OA.A.1: subtraction "within 20 … taking from … e.g., by using objects, drawings, and equations". 1.OA.C.6 names "decomposing a number leading to a ten". https://www.thecorestandards.org/Math/Content/1/OA/
  - 1.NBT.B.2a/b: "10 can be thought of as a bundle of ten ones" and "The numbers from 11 to 19 are composed of a ten and one, two, … nine ones." https://www.thecorestandards.org/Math/Content/1/NBT/
  - _Use:_ for the 6–7 end of the age range, a drawing of the take-away is the expected stage, not a detour.
- **T4. Illustrative Mathematics, Grade 1, Unit 3, Lesson 23, "Use a Ten to Subtract".**
  - Children subtract within 20 on a double ten-frame that shows the ten and the ones at once. https://curriculum.illustrativemathematics.org/k5/teachers/grade-1/unit-3/lesson-23/preparation.html
  - Curriculum practice, not evidence; I saw a search summary. _Use:_ the double ten-frame is the standard picture for teen take-away.
- **T5. Fyfe & Nathan (2019)**, "Making 'concreteness fading' more concrete as a theory of instruction for promoting transfer", _Educational Review_ 71(4):403–422, doi:10.1080/00131911.2018.1424116.
  - A theory paper on how to fade concrete materials to symbols.
  - Weak to moderate (theory, building on M10); I saw a search summary. _Use:_ fade the picture's help within the session, as wave 4 does.
- **T6. McNeil, Uttal, Jarvin & Sternberg (2009)**, "Should you show me the money? Concrete objects both hurt and help performance on mathematics problems", _Learning and Instruction_ 19(2):171–184. https://groups.psych.northwestern.edu/uttal/documents/McNeiletal2009.pdf
  - Perceptually rich bills and coins led to more errors than bland ones, though fewer conceptual errors.
  - A follow-up by the same group (Petersen & McNeil 2013, _Child Development_ 84(3):1020–1033) found that rich objects help or hurt depending on what children already know about them.
  - Moderate; I read summaries only. _Use:_ keep the plain flower glyph that addition already uses, and decorate nothing.
- **T7. Soylu, Lester & Newman (2018)**, "You can count on your fingers: the role of fingers in early mathematical development", _Journal of Numerical Cognition_ 4(1):107–135, doi:10.5964/jnc.v4i1.85. https://jnc.psychopen.eu/article/view/85
  - A review: finger-based counting is an early route into number, not a deficit.
  - Moderate (narrative review); abstract only. _Use:_ a picture to count is fine, and nothing should mark counting as "not yet".

**Reused from earlier notes:** M10 Fyfe et al. (2014) concreteness fading and M11 Carbonneau et al. (2013) manipulatives (`content-roadmap-after-path-ends.md:194-198`); Fuson & Kwon (1992) on the ten as the anchor for teen subtraction, and Clements & Sarama (2020) on part-whole (`sub-to-10-subitising-mental-model.md`).

---

## Corrections to my earlier rulings

| Earlier ruling (where)                                                                                                                  | Verdict                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Skip the detour": no visual model for subtraction; the chips are the representational stage (`sub-to-10-fact-sequencing-marian.md:88`) | **Withdrawn.** It rested on one child's diagnostic ("within 15 confident"). A 6-year-old in land 2 may meet taking away here for the first time, and for that learner the picture is the expected stage (T1, T3).                                |
| Same ruling for sub-to-20 (`sub-to-20-pedagogical-sequence.md:205`; `design/math/sub-to-20-content.md:23`, `:48`)                       | **Withdrawn.** Counting down from a teen number is the hardest route (T2). The ten is the anchor (Fuson & Kwon), and the double ten-frame shows it (T3, T4).                                                                                     |
| "Emma's read-aloud is the representational anchor" (`sub-to-10-fact-sequencing-marian.md:90`)                                           | **Holds as half of it.** The words carry the action ("take away"), and the hints already name flowers. A picture completes what the words promise.                                                                                               |
| No animated pip-fade in the minuend flash (`sub-to-10-subitising-mental-model.md`, Bottom line 2 and §4)                                | **Holds, for the flash.** The flash is for recognition and must stay static. The take-away picture is a separate counting model: its motion follows Emma's words or a hint, never a clock, and nothing moves while the learner decides on P4–P8. |
| "Two flower groups with a `−` would be visually nonsense" (web, `src/screens/Math/Math.tsx:3092-3099`)                                  | **Holds for two static groups.** The model below is one group with a part taken from it, which is a different picture. The web is frozen, so the comment stays.                                                                                  |

---

## Recommendations

### 1. Yes: a picture on every take-away problem

Draw it on every subtraction problem in `sub-to-10` and `sub-to-20`, for every learner, under the same rule as addition's flowers (`Math.tsx:1548-1553`).

**Why:**

- Taking away with objects is how children first solve subtraction (T1).
- Counting down without a picture is the error-prone route (T2).
- The standards expect drawings for subtraction within 10 and 20 at ages 5–7 (T3).
- The app's own hints already say "Look at the flowers." (State check).

**Fingers and "not yet":**

- The picture is a counting support, like addition's. Counting it, or on fingers, is fine (T7).
- No copy, pose or reward may mark counting as lesser: no "without flowers", no "use your head".
- Nothing removes the flowers as a reward or a level-up.

### 2. The model

**Picture**

- **Sub-to-10: one ten-frame** (2 rows of 5) of the plain flower glyph that addition uses (T6). It holds the minuend, filled row by row from the top left, so 5 and 10 are visible at a glance.
- **Sub-to-20: a double ten-frame.** The left frame is full (the ten) and the right frame holds the loose ones (the minuend's ones digit, 1–9).
  - The taken flowers come from the right frame only, so the full ten never moves. The pool guarantees this (`api/_planner.ts:1885`).
  - On take-to-decade facts (15−5, 18−8) the right frame empties and exactly a ten is left. That is 1.OA.C.6's "leading to a ten", made visible.
- **Taken flowers lift and stay, pale.** They rise as wave 4's lift-out does (`content-wave-4.md:121`), then rest pale over their cells instead of fading to nothing.
  - Hint 2 says "Six flowers." after the lift, so the whole must stay countable.
  - The whole and both parts stay on screen (part-whole, Clements & Sarama).
  - No cross-out stroke and no red: a mark over a flower reads too close to an X (my judgment).
  - Reduce Motion: they fade to pale with no rise.
- Fit, sizes and the pale value are Kyle's.

**Beats (one rule for both steps)**

- **P1–P3 (forward sessions):** the taken flowers lift on the read's word tick, "take away" (sub-to-10) or "minus" (sub-to-20). This is concreteness fading, wave 4's rule (M10, T5).
- **P4–P8, and every problem in review and peek sessions:** nothing moves during the read. The learner works from the whole group and the numerals.
- **Hints** (unchanged canon, no new audio):
  1. "Look at the flowers.": all the minuend's flowers ripple (addition's `group-a` ripple).
  2. "Six flowers.": they ripple again in order, which is the count.
  3. "Take away three. How many now?": the taken flowers lift. Where they have already lifted (P1–P3), the flowers that are left ripple instead.
- **Correct:** flowers that haven't lifted lift fast, then the existing celebration plays.
- **giveAnswer:** as today. By then hint 3 has lifted them.
- **Wrong 1–2:** the picture does not change.

**Fading across sessions:** none in this change.

- The static flowers stay on every problem, as addition's do today. Removing them from one operation only would teach that subtraction is the one you "should" do without help.
- The motion already fades: P4–P8 within a session, and all of a review session for a learner who has mastered the step.
- My earlier fact-by-fact rule still stands as the later rule for **both** operations together, not for subtraction alone: flowers leave a fact once its Leitner box is ≥ 3 (`add-to-10-counting-to-recall.md:164`).

**With the minuend flash**

- The flash is unchanged: the same gate, the same 1.1 s, sub-to-10 only.
- It plays first. The flowers then fade in, exactly as addition's row does after its dot card (`flowersVisible = !showDotCardOverlay`, `Math.tsx:1511`; `CountingRow.tsx` header).
- On P1–P3, if the read's word tick comes before the flowers are in, the lift waits until they are visible.
- The flash builds recognition and the flowers model the action. They do different jobs, so both stay.

**What must not change**

1. **No speed signal.** Motion follows Emma's words, a hint, or the right tap, never a timer. Nothing disappears while the learner decides on P4–P8.
2. **Never a red X.** Wrong taps play poof, shake, `puzzled-tilt` and "Hmm... try again?", and the picture holds still.
3. **Digits stay on screen**, and the equation keeps its place (the phone's reserved slot, `Math.tsx:1554-1563`).
4. **No new audio.** The canon hint lines already fit this picture, so there is no render, no voice QA, and no canon or planner change.
5. **Chips, distractors, Leitner and mastery are unchanged.** The decade-anchor trap (10) stays.
6. **Two-digit steps keep no counters**, as addition's do past 9 (`mathLayout.ts:509`).

### 3. Order and scope

- **Alongside wave 5, dispatched first, as its own small native PR.**
  - It fixes a picture that every learner meets in land 2 ("Adding & taking away", `packages/core/src/progress/lands.ts:24-29`). Wave 5's steps sit in lands 5–6 and later.
  - It doesn't wait for wave 5, and wave 5 doesn't wait for it.
  - Both touch the arithmetic render branch of `Math.tsx`: wave 5's step 17 sends an arithmetic problem to `PlaceValueStage` (`design/native/content-wave-5.md:221`, `:271`). Whichever merges second rebases.
- **It applies to all learners, mastered ones included.** A learner who has mastered the step meets it in reviews, with the static picture and motion only at hint 3 or on the right tap.
  - No progress migration, no mastery reset, no gate change.
- **Cost:**
  - One native PR (`Math.tsx`'s subtraction branch, a ten-frame row, its layout metrics, and wave 4's lift-out reused) plus a short spec section from Kyle.
  - $0 in pictures and audio.
  - It ships in the next TestFlight build. Riding in wave 5's build saves an EAS build.
- **Docs to update when it ships:**
  - `design/math/sub-to-10-content.md` and `sub-to-20-content.md`: drop the "no visual" lines.
  - Correct the web comment only if the web is ever unfrozen.

### Thomas decides

- **Nothing blocks the start.**
- **Only Thomas can judge (device check):** whether the pale taken flowers read clearly as "taken away", or whether they should leave entirely. If they leave, hint 2's "Six flowers." would describe flowers that are gone, so the pale form is my recommendation.

---

## Risks / counter-evidence

- **Counting all instead of recalling.** With the flowers there, a learner can count what is left, as addition already allows. That is accepted here because the motion fades and the fact-by-fact fade is the later rule (my judgment, M10). If take-away latency stops falling once the picture ships, that is the signal to bring the fact-by-fact fade forward for both operations.
- **Pale flowers are my design, not a tested one.** No study compares pale and removed objects. They are chosen only to keep the canon's "Six flowers." true and the part-whole visible.
- **Most new sources were read as summaries or abstracts** (T1, T4–T7). T1 and T2 are foundational and replicated. T3 and T4 are standards and curriculum, not evidence of effect.
- **One learner's report triggered this,** but the case doesn't rest on it. It rests on the app's own hint lines, the age range and T1–T3.
