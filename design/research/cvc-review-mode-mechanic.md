# CVC Review Mode — Post-Mastery Mechanic Selection

**Ticket:** `86c9qa6n3`
**Date:** 2026-05-09
**Context:** Kevin shipped the cross-vowel mixing infrastructure in PR #181. The paradox: `crossVowelMixingActive` can return `true`, but `pickFocusNode` walks past mastered tiers, so the focus is always a non-CVC node and `App.tsx`'s `focusIsCvcTier` gate refuses to thread cross-vowel mode in. Net result: zero cross-vowel chips fire in regular production play. This research deliverable resolves AC2 — the trigger-shape decision — so Kevin can implement AC3 with clinical justification rather than engineering preference.

---

## Key recommendations for Kevin (impl ticket scope)

1. **Implement Option C (Graduation Review) as the primary trigger, combined with a periodic revisit cadence.** Fire a one-time celebratory cross-vowel session immediately after the 3rd CVC tier masters (`cvc-words-short-u` reaches `'mastered'`). Then revisit periodically: once every 5 sessions (approximately weekly with typical usage), surface one of the three mastered CVC tiers for a cross-vowel review session. This compound mechanic — C-then-periodic — is the best match to the pedagogical evidence for Tagalog L1 learners at age 8.

2. **Do not implement Leitner-for-words (Option A) in v1.** A per-word demotion scheme requires per-word tracking infrastructure that does not exist on the literacy track, adds schema complexity, and misapplies the math-Leitner model to a different learning domain (phoneme discrimination rather than arithmetic-fact recall). The evidence for Leitner over periodic scheduling for phonics vocabulary is mixed at best.

3. **Predicate / picker modification shape:** Add a `pickCvcReviewNode(progress, sessionCount)` helper to `focusNode.ts`. Call it from `pickFocusNode` when all three CVC nodes are `'mastered'` and no non-mastered CVC node exists. The helper returns: (a) the graduation-trigger node on the first eligible call (when `progress.cvcGraduationSessionFired === false`), (b) a round-robin node from the three CVC tiers thereafter, every 5 sessions (using `sessionCount % 5 === 0` as the revisit gate). On all other sessions, `pickFocusNode` returns the current forward-progress node (digraphs or beyond) with no cross-vowel mode.

---

## Section 1. Literature review — when is post-mastery review appropriate for early-bilingual L1-Tagalog learners?

### 1.1 The post-mastery retention problem in phonics

Structured literacy programs universally include post-mastery review as a core design requirement. Rosenshine's Principle 1 (Rosenshine, 2012, _American Educator_) — drawn from the most effective classroom teachers in research observational studies — states that "newly acquired skills should be practiced well beyond the point of initial mastery, leading to automaticity." He specifies that the most effective teachers build in daily review, weekly review, and monthly review of previously mastered material, explicitly to combat the forgetting curve.

For phonics specifically, the Phonics Hero mastery framework (phonicshero.com/mastery_phonics, drawing on Bloom's mastery learning and the structured-literacy literature) specifies that once a skill reaches 90%/3-session mastery, there should be a maintenance phase in which that skill is revisited regularly. Without maintenance, even reliably decoded short-vowel patterns can regress when learners advance to harder material — a phenomenon documented in the Direct Instruction literature as "maintenance deficit" (NIFDI.org reading mastery analysis, 2002).

**Evidence strength: [STRONG].** Rosenshine (2012) synthesizes large-scale observational research on effective instruction; the mastery-with-maintenance principle is replicated across Direct Instruction, UFLI Foundations (RCT-supported), and Orton-Gillingham programs. This is among the most consistent findings in the structured-literacy literature.

**Sources:**

- Rosenshine, B. (2012). "Principles of Instruction: Research-Based Strategies That All Teachers Should Know." _American Educator_, Spring 2012. https://www.aft.org/sites/default/files/Rosenshine.pdf
- National Institute for Direct Instruction. (2002). "An Analysis of the Reading Mastery Program." https://www.nifdi.org/research/journal-of-di/volume-2-no-2-summer-2002/442-an-analysis-of-the-reading-mastery-program-effective-components-and-research-review/file.html
- Phonics Hero. "Mastery in Phonics Learning." https://phonicshero.com/mastery_phonics/

### 1.2 How the forgetting curve applies to phonics vocabulary at age 8

Vlach (2019) documents that children aged 7–8 show faster forgetting rates than adults for newly learned words, but that spaced retrieval — the act of retrieving a partially forgotten item — produces stronger long-term retention than massed practice. The mechanism is "desirable difficulty": effortful retrieval increases retrieval strength and slows future forgetting. Critically, children who forgot partially during a learning gap showed stronger long-term retention than those who did not forget at all — this is the empirical basis for why post-mastery review timed to cross the forgetting threshold (not too soon, not too late) is more effective than either no review or immediate re-drill.

Applied to CVC phonics: once Marian masters `cvc-words-short-o` at 90%/3 sessions, her retention of /ɒ/ vowel discriminations will decay within 3–4 weeks of no short-o sessions. If she then advances to short-u and digraphs without revisiting short-o, the short-o pattern may be fragile when cross-vowel mixing first fires. The periodic revisit mechanic addresses this directly.

**Evidence strength: [STRONG for the spacing effect generally; INFERRED for the 3-4 week forgetting window at age 8 with phonics patterns.** Vlach's work is with novel word learning in laboratory conditions, not classroom phonics. Transfer to in-context phonics patterns is an inference.]

**Sources:**

- Vlach, H.A. (2019). "Learning to Remember Words: Memory Constraints as Desirable Difficulties." University of Wisconsin Vlach Lab. https://vlachlab.education.wisc.edu/wp-content/uploads/2019/09/Vlach2019.pdf
- Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006). "Distributed practice in verbal recall tasks: A review and quantitative synthesis." _Psychological Bulletin_, 132(3), 354–380. https://www.yorku.ca/ncepeda/publications/CPVWR2006.html

### 1.3 The spacing-effect interval question: how often is "periodic"?

Cepeda et al. (2006, 2008) established that the optimal review interval scales with the desired retention duration: for a week-long retention goal, the optimal gap between study sessions is approximately 20–40% of the retention target; for a longer-term goal (months to years), the optimal gap approaches 5–10% of the retention target. For Marian's context — retain short-a, short-o, and short-u patterns for the August 2026 timeline (approximately 12 weeks from short-u mastery) — this formula suggests a review every 6–12 sessions is appropriate.

Dunlosky et al. (2013) confirm that distributed practice ("spacing") is among the two highest-utility learning strategies across all age groups and content types, producing larger retention benefits than massed practice in nearly every study tested.

The existing Marian Tutor session cadence is approximately once per day (both trees combined). At 5 sessions per review cycle, that translates to a short-vowel maintenance session approximately every 5 days — well within the Cepeda formula's recommended window for a 12-week retention goal.

**Evidence strength: [STRONG for the spacing effect. INFERRED for the specific "every 5 sessions" value.** The Cepeda formula suggests 6–12 sessions for a 12-week retention goal; 5 sessions is at the generous end (more frequent than strictly necessary). The cost is low — a slightly more frequent review is a small cost in engagement vs. the risk of under-reviewing.]

**Sources:**

- Cepeda, N.J., Vul, E., Rohrer, D., Wixted, J.T., & Pashler, H. (2008). "Spacing effects in learning: A temporal ridgeline of optimal retention." _Psychological Science_, 19(11), 1095–1102. https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02209.x
- Dunlosky, J., Rawson, K.A., Marsh, E.J., Nathan, M.J., & Willingham, D.T. (2013). "Improving Students' Learning With Effective Learning Techniques." _Psychological Science in the Public Interest_, 14(1), 4–58. https://journals.sagepub.com/doi/abs/10.1177/1529100612453266
- Nature Reviews Psychology (2022). Spaced retrieval meta-analysis. https://www.nature.com/articles/s44159-022-00089-1

### 1.4 Tagalog L1 context: does post-mastery review matter more or less for bilingual learners?

The bilingual-development literature (PMC10547117, 2023 systematic review; PMC4394382, 2015 dual-language-learner critical review) consistently finds that bilingual children show comparable long-term retention of phonics patterns to monolingual children once patterns are consolidated — the difference is in acquisition speed and in the maintenance requirement. Specifically:

- Tagalog has a highly transparent orthography, which means Marian has strong L1 automaticity for the grapheme-phoneme principle. This is an advantage: she is more likely to retain explicit phonics patterns than a child whose L1 has opaque orthography, because the principle of "letters represent sounds" is not novel.
- However, the cross-vowel discrimination task requires NOT just phoneme-letter knowledge but phoneme-phoneme discrimination — distinguishing /æ/ from /ɒ/ from /ʌ/ at the chip-selection level. This is the skill where Tagalog L1 interference is highest (documented in `cross-vowel-discrimination-threshold.md`: both /æ/ and /ʌ/ pull toward Tagalog /a/). Post-mastery review of each CVC tier is therefore the mechanism that maintains the phoneme-boundary sharpness needed for cross-vowel chip discrimination to work.

Phonics instruction for multilingual learners (Learning Without Tears, 2023; Colorín Colorado, NRP-grounded) specifically recommends distributed review of L2 phonics patterns to prevent L1 interference from eroding consolidated L2 distinctions after instruction ends. This is not a generic caution — it applies directly to the /æ/-/ʌ/ contrast Marian needs.

**Evidence strength: [INFERRED from converging sources. No Tagalog-specific post-mastery phonics maintenance RCT exists. The direction of the inference is strongly supported by the bilingual phonics and L1-interference literature.]**

**Sources:**

- PMC10547117 (2023). "Bilingualism and Development of Literacy in Children: A Systematic Review." https://pmc.ncbi.nlm.nih.gov/articles/PMC10547117/
- PMC4394382 (2015). "The Language and Literacy Development of Young Dual Language Learners: A Critical Review." https://pmc.ncbi.nlm.nih.gov/articles/PMC4394382/
- Colorín Colorado. "Fostering Literacy Development in English Language Learners." https://www.colorincolorado.org/article/fostering-literacy-development-english-language-learners
- Learning Without Tears. "Phonics Strategies for Multilingual Learners." https://www.lwtears.com/blog/phonics-strategies-support-multilingual-learners-classroom

### 1.5 Evidence for each trigger shape

**Option A (Leitner-for-words):** The Leitner flashcard system has well-documented efficacy for vocabulary retention in L2 adult learners (Nguyen & Le, cited in MedCrave review; web-based Leitner studies showing ESL students recalled vocabulary more effectively). However, the specific application to phonics word pools — where the goal is phoneme-level discrimination rather than word-meaning recall — has much weaker evidence. Leitner's promote/demote logic was designed for declarative knowledge (word meanings, facts); phonics decoding is procedural knowledge (applying a phoneme-grapheme rule). These are different memory systems (Anderson et al., 1983 ACT; Squire, 1992 procedural vs declarative memory). The math Leitner box works because arithmetic facts ARE declarative — recall "7+3=10" is identical to recalling "the capital of France is Paris." CVC phonics is closer to motor learning — it becomes automatic through massed and distributed practice, but per-item tracking of individual words misframes the learning goal.

**Evidence for Option A: [WEAK to MODERATE for vocabulary; SPECULATIVE for phonics discrimination.** The Leitner model is not directly supported in the phonics maintenance literature. Its application here would be a design inference.]

**Option B (Periodic revisit):** Strongest evidence base among the three options. Rosenshine's Principle 1, UFLI session structure, the Cepeda spacing formula, and the Vlach desirable-difficulty framework all support a predictable periodic review interval for mastered phonics patterns. The mechanism is simple (sessionCount modulo N), low-overhead, and aligns with how structured-literacy curricula handle maintenance. No schema change to per-word tracking needed.

**Evidence for Option B: [STRONG — directly supported by the distributed practice and structured-literacy maintenance literature.]**

**Option C (Graduation review, once):** The once-only celebration session has motivational support: a celebratory milestone event following mastery of the third CVC tier aligns with Deci et al. (1999) findings that completion-contingent recognition (verbal praise, celebratory framing) does not undermine intrinsic motivation and may enhance it. Ryan & Deci (2000, Self-Determination Theory) confirm that autonomous milestone recognition reinforces competence — one of the three basic psychological needs. A one-shot graduation cross-vowel session is also the developmentally gentlest introduction: Marian enters a "special session" with concrete prior success and no failure-risk of a maintenance grind.

However, a once-only graduation session without subsequent periodic review is insufficient for the maintenance goal. The forgetting curve does not stop after one cross-vowel probe session. If Options B and C are treated as mutually exclusive, Option B alone is the stronger choice.

**Evidence for Option C alone: [MODERATE for motivational framing. WEAK as a standalone maintenance mechanism — one session does not defeat the forgetting curve.]**

**Combined C-then-B:** The evidence composition is additive. Graduation review (Option C) addresses the motivational and first-encounter challenges; periodic revisit (Option B) addresses the forgetting-curve maintenance need. Both can be implemented via a single `pickCvcReviewNode` helper — the graduation flag is checked first, then the periodic cadence takes over.

---

## Section 2. Comparison and cost analysis

### Option A — Leitner-for-words

**How it would work:** Each CVC word across all three tiers (14 short-a + 8 short-o + 11 short-u = 33 words) gets a `LeitnerBox<CvcWord>` entry in the Progress doc. Correct chip selection promotes the word one box; incorrect selection demotes it. `pickCvcReviewNode` uses box-1 weight to select which tier is overdue.

**False-positive case:** Marian has strong phoneme knowledge but taps the wrong chip due to inattention or distraction. A single miss demotes "hat" to box 1, triggering a review session for short-a when she genuinely doesn't need one. The math Leitner box has the same false-positive risk, but arithmetic-fact errors are more likely to be genuine (the correct answer is unique and specific); CVC chip errors include guessing errors that phoneme knowledge cannot prevent.

**False-negative case:** Marian has forgotten the /ʌ/ vs /æ/ distinction but her session happens to target short-a words where the distractors don't stress the vowel. All items stay in high boxes. No review fires. The Leitner logic is only as good as the signal quality of each trial — and cross-vowel chip signal is only available if cross-vowel chips were actually surfaced (circular dependency: you need cross-vowel mode to detect cross-vowel confusion, but cross-vowel mode only fires from `pickCvcReviewNode`).

**Implementation complexity:** HIGH. Requires:

- New `wordLeitner: LeitnerBox<CvcWord>` field on the Progress doc (schema change, five-place sync rule triggers — `types.ts`, `guards.ts`, `defaults.ts`, `seedStorage.ts`, `cloudSync.ts`)
- Per-word result tracking in `WordSong.tsx` (currently only session-level accuracy is recorded)
- `plannerRoundTrip.test.ts` fixtures updated for Leitner-weighted selection
- New Leitner helper functions in `leitner.ts` for the literacy track

**Fit to Marian's profile:** POOR. Leitner misframes the learning goal. Marian's mastery challenge is phoneme-boundary sharpness (discrimination), not word-specific recall. A word-level demotion system treats "Marian forgot 'hot'" as the problem when the actual problem is "Marian's /ɒ/-/æ/ distinction erodes." The right unit of review is the phoneme tier, not the individual word.

### Option B — Periodic revisit (pure)

**How it would work:** Every N sessions after all three CVC tiers are mastered, `pickFocusNode` returns one of the three CVC tiers for a cross-vowel review session. Tier selection rotates round-robin or picks the most-recently-mastered tier first.

**False-positive case:** Marian's CVC discrimination is strong and stable. Every N sessions she gets a "review" session she doesn't need. Cost: one session of familiar, easy material — net effect is a confidence booster and mild automaticity reinforcement. This false positive is benign; it doesn't harm her or create negative signal.

**False-negative case:** N is too large. If sessions are infrequent or N is set to 10+, the forgetting curve has time to erode the phoneme distinction before review fires. Detection: Thomas would observe cross-vowel session accuracy declining if he reviews session history. The mitigaton is keeping N small (5 is appropriate per the Cepeda formula analysis above).

**Implementation complexity:** LOW. Requires:

- Read `sessionCount` from `SessionHistoryV2` (already on Progress doc)
- `pickCvcReviewNode` checks `sessionCount % N === 0` and returns a CVC tier
- `App.tsx`'s `focusIsCvcTier` gate passes through when `pickFocusNode` returns a CVC node
- No schema change; no per-word tracking; no new Progress fields

**Fit to Marian's profile:** GOOD. Phoneme-tier-level review matches the actual maintenance need. The mechanic is predictable (she and Thomas know review sessions recur) — consistent with the CLAUDE.md principle of "generous and predictable feedback." Periodic review mirrors how structured-literacy programs handle maintenance (weekly review windows in UFLI, Rosenshine's weekly/monthly review principle).

### Option C — Graduation review (once)

**How it would work:** When `cvc-words-short-u` first reaches `'mastered'`, the next CVC-track session is flagged as a graduation review — a celebratory cross-vowel session. After it fires, the flag is set and the graduation session never fires again.

**False-positive case:** None on the first fire — the condition is precisely keyed to the third-tier mastery event. If Marian is not actually ready for cross-vowel discrimination, she will have low accuracy on the graduation session — but the session still fires. This is not a false positive; it is informative signal.

**False-negative case:** The once-and-done graduation session is insufficient for long-term maintenance. After the graduation session, Marian's discrimination degrades over weeks without further review. If not combined with periodic revisit, this is the dominant failure mode.

**Implementation complexity:** LOW-MODERATE. Requires:

- New `cvcGraduationSessionFired: boolean` field on Progress doc (or a `SessionHistoryEntry` flag — less schema-invasive)
- Detection logic: "is this the first session where all three CVC tiers are mastered?"
- No per-word tracking, no Leitner infrastructure

**Fit to Marian's profile:** GOOD for the first-encounter motivational benefit. Insufficient alone for the maintenance goal.

### Combined Option C-then-B (recommended)

**How it would work:** `pickCvcReviewNode(progress, sessionCount)`:

1. If all three CVC tiers are mastered AND `progress.cvcGraduationSessionFired !== true`: return one of the three CVC tiers (recommend `cvc-words-short-u` as the most recently mastered — freshest motivation, highest Tagalog-interference risk per the /ʌ/ research). Set `cvcGraduationSessionFired = true` in the session-end write.
2. Else if all three CVC tiers are mastered AND `sessionCount % 5 === 0`: return a CVC tier (round-robin over the three tiers, tracked by `cvcReviewRoundRobinIndex` on Progress or derived from sessionCount modulo 3).
3. Otherwise: return `null` — caller uses forward-progress node (digraphs or beyond).

**False-positive case:** Periodic review fires when Marian's discrimination is already strong. Same benign false positive as Option B — familiar easy material, mild confidence boost.

**False-negative case:** If sessions are highly irregular (weeks between sessions), the `sessionCount % 5` trigger may not fire at the right calendar interval. Example: 5 sessions over 3 weeks is fine; 5 sessions in 2 days means a review session may coincide with a fresh mastery day, not the forgetting trough. Mitigation: the session history timestamp is available (`lastPlayedISO`) — a time-based gate (`lastCvcReviewISO` + 5-day floor) could supplement the session-count gate. This is a v2 refinement, not a v1 blocker.

**Implementation complexity:** LOW-MODERATE. Roughly equivalent to Option C alone, with the addition of the round-robin periodic trigger. No per-word tracking, no schema version bump (additive optional fields on Progress doc, same pattern as `pendingPromotion` and `parentSettings`).

**Fit to Marian's profile:** STRONG. The graduation celebration addresses the motivational first-encounter; the periodic revisit addresses the forgetting curve; the mechanic operates at the phoneme-tier level (the right unit for phoneme-discrimination maintenance); the cadence is predictable; the implementation is within the 4–6 week part-time build window.

### Summary cost table

| Dimension            | Option A (Leitner)                          | Option B (Periodic) | Option C (Graduation)           | C-then-B (Recommended)            |
| -------------------- | ------------------------------------------- | ------------------- | ------------------------------- | --------------------------------- |
| Evidence base        | Weak-Moderate                               | Strong              | Moderate                        | Strong (additive)                 |
| Schema change        | Yes — `wordLeitner` field + five-place sync | No                  | Minimal — one boolean flag      | Minimal — one boolean + one index |
| Per-word tracking    | Yes                                         | No                  | No                              | No                                |
| Maintenance coverage | Per-word (mismatch to goal)                 | Tier-level (match)  | One session only (insufficient) | Tier-level + first-encounter      |
| Tagalog-profile fit  | Poor                                        | Good                | Good (motivational)             | Strong                            |
| Impl tickets needed  | 2+ (schema + tracker)                       | 1                   | 1                               | 1 (compound picker)               |
| False-positive harm  | Medium (unnecessary demotions)              | Benign              | None on first fire              | Benign                            |
| False-negative risk  | Medium (signal noise)                       | Low (N-too-large)   | High (no maintenance)           | Low                               |

---

## Section 3. Verdict

**Recommended mechanic: Combined Option C (graduation review) then Option B (periodic revisit every 5 sessions).**

**Confidence label: [INFERRED — strong directional support, no direct RCT on this specific picker design for 8-year-old L2 CVC learners.**

The verdict rests on: (a) the [STRONG] distributed-practice and structured-literacy maintenance literature supporting periodic post-mastery review; (b) the [MODERATE] motivational literature supporting a celebratory first-encounter for a multi-tier mastery milestone; (c) the [INFERRED] application to Marian's specific Tagalog-phoneme-interference profile, which makes phoneme-tier-level (not word-level) review the appropriate unit; and (d) the practical engineering judgment that Options A and B are strictly dominated by C-then-B in the cost-vs-benefit table.

A [STRONG] rating would require an RCT comparing the three picker designs specifically for 8-year-old Tagalog-English bilingual phonics learners, which does not exist. The [INFERRED] label is honest about that gap.

### Predicate / picker modification shape pin

Kevin should implement a `pickCvcReviewNode` function in `src/lib/progress/focusNode.ts` with the following contract:

```
pickCvcReviewNode(progress: Progress, sessionCount: number): WordSongNode | null

Input contracts:
  - progress.skillLevels: all three of cvc-words, cvc-words-short-o, cvc-words-short-u
    are 'mastered' (caller pre-checks before calling this function)
  - sessionCount: total completed session count from SessionHistoryV2

Return logic:
  1. If progress.cvcGraduationSessionFired !== true:
       return 'cvc-words-short-u'  // most recent + highest Tagalog-interference risk
       (session-end write sets progress.cvcGraduationSessionFired = true)
  2. Else if sessionCount % 5 === 0:
       return CVC_TIERS[cvcReviewRoundRobinIndex % 3]
       where CVC_TIERS = ['cvc-words', 'cvc-words-short-o', 'cvc-words-short-u']
       and cvcReviewRoundRobinIndex is derived from Math.floor(sessionCount / 5) % 3
       (no additional state needed — purely derived from sessionCount)
  3. Else:
       return null  // no CVC review this session

Progress doc additions (both additive optional fields, no schema version bump):
  - cvcGraduationSessionFired?: boolean  (default false, set on first graduation session)

pickFocusNode modification:
  - After walking past all mastered nodes and finding that the first unmastered node
    is OUTSIDE the CVC tier group (e.g., digraphs), first call pickCvcReviewNode.
  - If pickCvcReviewNode returns a node, return that node (with a review flag so
    App.tsx can pass crossVowelMixingEnabled=true to the planner).
  - If pickCvcReviewNode returns null, continue to the forward-progress node (digraphs).

App.tsx focusIsCvcTier gate:
  - The existing gate that refuses to thread cross-vowel mode needs to also pass
    through when pickFocusNode returned a CVC node via the review path.
  - Simplest implementation: pickFocusNode returns a tagged result:
    { node: WordSongNode, mode: 'forward' | 'cvc-review' }
    and App.tsx uses mode === 'cvc-review' to set crossVowelMixingEnabled=true
    in the session-start payload, bypassing canon and cache per AC9 of ticket 86c9m3aek.
```

**What changes in existing code (scope pin, not code):**

- `src/lib/progress/focusNode.ts`: add `pickCvcReviewNode`, modify `pickFocusNode` return shape
- `src/lib/progress/types.ts`: add `cvcGraduationSessionFired?: boolean` to `Progress`
- `src/lib/progress/defaults.ts`: add `cvcGraduationSessionFired: false` to `defaultProgress()`
- `src/lib/progress/guards.ts`: `SCHEMA_FLOOR_NODES` unchanged (no new SkillNode); guard for new optional field
- `src/screens/SessionEnd/progressHistory.ts`: write `cvcGraduationSessionFired = true` on graduation session
- `src/App.tsx`: extend `focusIsCvcTier` gate to handle `mode === 'cvc-review'`
- `e2e/_helpers/seedStorage.ts`: add `cvc-cross-vowel-review` seed marking all three tiers mastered + sessionCount targeting a review trigger

---

## Section 4. Failure-mode analysis

### 4.1 Graduation session fires before Marian is actually ready for cross-vowel discrimination

**Mechanism:** The graduation trigger fires immediately when `cvc-words-short-u` reaches mastery at 90%/3 sessions. Marian's short-u is newly mastered; the /ʌ/ phoneme boundary may be less sharp than a vowel she mastered months earlier.

**Detection:** Per-session accuracy on the graduation cross-vowel session. If Marian scores <60% on the graduation session, this is informative — not a failure of the picker, but a signal that the /æ/-/ʌ/ contrast (the highest-risk pair per `cross-vowel-discrimination-threshold.md`) is not yet robust. Thomas can observe this via session history.

**What the app could collect:** The `SessionHistoryEntry` for the graduation session could carry `isGraduationReview: true` and `crossVowelAccuracy: number` — both additive optional fields. This enables Thomas to distinguish graduation-session accuracy from regular-session accuracy without changing the mastery rule. Low graduation-session accuracy (<60%) is the signal for Thomas to toggle `crossVowelMixingEnabled` off temporarily and allow short-u more practice sessions before re-enabling.

**Mitigation already in spec:** `parentSettings.crossVowelMixingEnabled` flag (default `true`) gives Thomas the off-ramp. The graduation session is not harmful even if accuracy is poor — Emma's puzzled-tilt reaction and the standard "try again" flow apply. Marian does not experience regression.

### 4.2 Periodic review fires at the wrong session cadence

**Mechanism:** `sessionCount % 5 === 0` is a session-count gate, not a calendar gate. If Marian does 5 sessions in a weekend, the periodic review fires within 2 days — potentially too soon for meaningful forgetting to have accumulated. If she takes a 2-week break, the session count doesn't advance, so no review fires.

**Detection:** Inspect `lastPlayedISO` alongside session count. A review that fires within 2 days of the previous CVC review has not accumulated meaningful forgetting and is noise. A review that fails to fire after a 3-week gap has missed the forgetting window.

**What the app could collect:** A v2 extension would replace `sessionCount % 5 === 0` with a time-based gate: `daysSinceLastCvcReview >= 5`. This requires a `lastCvcReviewISO: string | null` field on Progress (additive optional). The v1 session-count gate is a reasonable approximation for daily-or-near-daily use and avoids the additional field complexity.

**Under what real-Marian signal would this be wrong:** If Thomas's usage logs show Marian doing 3+ sessions per day on some days and 0 on others, the session-count gate could fire reviews at suboptimal calendar times. This is a known limitation of the v1 design; the recommendation is to monitor and file a time-based gate ticket if the pattern emerges.

### 4.3 Round-robin tier selection misses the highest-interference pair

**Mechanism:** Round-robin gives equal treatment to all three CVC tiers. The phoneme-interference research (`cross-vowel-discrimination-threshold.md`, `short-u-minimal-pair-and-future-vowel-openers.md`) identifies the /æ/-/ʌ/ pair (short-a vs short-u) as the highest-risk confusion for Tagalog L1 learners. A round-robin that surfaces short-o more often than needed while not surfacing short-u frequently enough could miss the maintenance need.

**Detection:** Per-session cross-vowel accuracy by vowel pair. If Thomas observes that /æ/-/ʌ/ trial accuracy is consistently lower than /æ/-/ɒ/ accuracy across multiple cross-vowel sessions, the round-robin is under-serving the highest-risk pair.

**What the app could collect:** `crossVowelAccuracy` by pair in `SessionHistoryEntry` — a `Record<'a-o' | 'a-u' | 'o-u', number>` field. This is a v2 enhancement. In v1, Kevin can weight the round-robin toward `cvc-words-short-u` (the highest-interference tier) by using `[0, 1, 2, 2]` instead of `[0, 1, 2]` as the modulo pool. This is a one-line constant change, not an architectural decision.

**Mitigation at spec level:** The graduation session returns `cvc-words-short-u` explicitly — the first cross-vowel session prioritizes the highest-interference tier. Subsequent round-robin sessions can distribute equally; if short-u accuracy is consistently low, Thomas can track the pattern and file a v2 ticket.

### 4.4 `sessionCount % 5 === 0` gate fires on session 0, 5, 10... before any CVC mastery

**Mechanism:** `pickCvcReviewNode` is called only when all three CVC tiers are mastered — the caller pre-checks this condition before calling the function. `sessionCount % 5 === 0` within that context means "among sessions after all-three-mastered, fire every 5 sessions." This is not ambiguous as long as the caller pre-checks correctly.

**Detection:** Unit tests for `pickCvcReviewNode` must verify that the function is never called without the pre-check — or, more defensively, the function itself should assert that all three tiers are mastered before evaluating. The spec for AC5 (Vitest unit coverage) should include a test case where the function is called with a Progress doc where only two of three tiers are mastered, and the function returns null or throws.

### 4.5 cvcGraduationSessionFired flag missing from old Progress docs

**Mechanism:** Marian's existing localStorage Progress doc does not have `cvcGraduationSessionFired`. When Kevin's code ships, old blobs will have `cvcGraduationSessionFired === undefined`. The function should treat `undefined` as `false` (graduation not yet fired), which is correct behavior — Marian will get the graduation session on the next eligible call.

**Mitigation:** Same additive-optional-field pattern as `parentSettings` and `pendingPromotion` — `cvcGraduationSessionFired ?? false` in the picker logic. No schema version bump required. This is consistent with the existing five-place sync rule behavior: optional fields default at the read path, not the storage path.

---

## Risks / counter-evidence

1. **Leitner-for-words has more name recognition in the codebase.** The math track already uses Leitner; there is an engineering pull toward reusing the existing infrastructure. The research case against Leitner-for-words is not that it doesn't work for vocabulary — it does, in adults — but that it misframes the goal for phonics discrimination and adds per-word tracking infrastructure that is architecturally heavier than the periodic trigger. If Kevin finds the Leitner path significantly simpler to wire (because the helper functions already exist), the trade-off is worth flagging to Matt. The pedagogical case against Leitner-for-words is [INFERRED], not [STRONG]; the engineering convenience is real.

2. **`sessionCount % 5` is a crude approximation.** The Cepeda formula suggests the optimal gap scales with desired retention — a daily user needs less frequent review than a weekly user. `sessionCount % 5` treats all users equally. For Marian specifically, with daily or near-daily use, 5 sessions is approximately 5 days — within the formula's window. If usage is less regular, the calibration degrades. A time-based gate (`daysSinceLastCvcReview >= 5`) is more robust but requires an additional Progress field. Kevin should evaluate whether the additional field complexity is worth it for v1.

3. **The graduation session may feel like "going back" rather than celebrating.** If Marian has already moved to digraphs and a session suddenly returns to CVC words with cross-vowel chips, she may experience this as regression rather than review. Emma's framing of the graduation session matters: "Remember all those words we learned? Let me show you something cool — you're going to hear them all mixed together!" The `WORD_SONG_TRACK_GUIDE` prompt for the graduation session should explicitly use this framing. This is a Kyle and Kevin joint deliverable (Emma copy for the graduation-session opener), not a Dave deliverable.

4. **No RCT on picker design for 8-year-old L2 phonics learners.** The verdict rests on converging evidence from different domains (spacing research, bilingual phonics, structured-literacy maintenance) rather than a direct experimental test of the three options. This is the honest limitation of the [INFERRED] confidence label. Thomas should treat the first 6–8 cross-vowel sessions after the mechanic ships as observational data — if cross-vowel accuracy is systematically low (< 65% across 3+ review sessions), revisit the pick cadence.

5. **Retrieval practice with equal spacing vs. expanding spacing.** Kornell & Bjork (PMC4480221) and Vlach (2019) suggest that equal-spacing and expanding-spacing produce comparable long-term retention outcomes for word learning, though the mechanism differs. The simple `sessionCount % 5` gate implements equal spacing — straightforward, testable, predictable. Expanding spacing (5 sessions, then 10 sessions, then 20 sessions) would theoretically push toward longer-interval retention but is harder to reason about and adds complexity. Given the 12-week August 2026 timeline, equal spacing is the appropriate choice — Marian does not need to retain CVC phonics for years, just for the duration of the curriculum.

---

## Recommendations

### For Kyle (cross-vowel-mix-spec.md v2 amendments)

1. **Add a §10 Q5 close-out** documenting the chosen mechanic (Option C-then-B) and citing this ticket as the firing layer. The spec's §8 Q4 already committed to this research deliverable; the close-out should reference `cvc-review-mode-mechanic.md` and ticket `86c9qa6n3`.

2. **Add a graduation-session Emma copy directive** to the planner guide for the first CVC review session. Suggested frame: "Remember all those vowel sounds we learned? Let's mix them up — this is a special challenge!" The copy should signal celebration, not remediation. No mention of "review" or "going back."

3. **Spec the `crossVowelAccuracy` optional field** on `SessionHistoryEntry` for a v2 ticket (not v1 blocker). This gives Thomas the per-pair accuracy data needed to detect the /æ/-/ʌ/ failure mode (Section 4.1). Add to §9 Provenance as a forward-compat note.

4. **No change to the §2 gating predicate** (`crossVowelMixingEnabled`). Kevin's PR #181 predicate is correct; this ticket adds the picker mechanic that causes it to fire, not the predicate itself.

### For Kevin (impl scope)

1. **Implement `pickCvcReviewNode` per the predicate shape pin in Section 3.** The function is ~15–20 lines of pure TypeScript. It reads `progress.cvcGraduationSessionFired` and `sessionCount`; it returns a `WordSongNode | null`.

2. **Modify `pickFocusNode`'s return type** to include a `reviewMode: boolean` flag (or equivalent tagged union) so `App.tsx` can distinguish "picker returned a CVC node for review" from "picker returned a CVC node because Marian is still consolidating it." This flag is what gates `crossVowelMixingEnabled=true` in the session-start payload.

3. **Add `cvcGraduationSessionFired?: boolean` to the Progress doc** as an additive optional field. Update `defaults.ts`, `guards.ts`, and `progressHistory.ts` session-end write path. This is the smallest possible schema surface for the graduation flag.

4. **Wire the session-end write** to set `cvcGraduationSessionFired = true` when the session was a graduation review session. The write path already handles `pendingPromotion` at session-end; this is structurally identical.

5. **Add the `cvc-cross-vowel-review` debug seed** to `debugSeed.ts`: marks all three CVC tiers `'mastered'`, sets `sessionCount` to a value divisible by 5 (e.g., 10), `cvcGraduationSessionFired = true` so the periodic trigger fires (not the graduation trigger). This lets Jessica write the e2e spec for AC6 against the periodic-trigger path. A second seed `cvc-cross-vowel-graduation` can set `cvcGraduationSessionFired = false` to test the graduation-trigger path.

6. **AC5 Vitest coverage must include:**
   - `pickCvcReviewNode` returns graduation-tier node on first call (flag unset)
   - `pickCvcReviewNode` returns null on sessions not divisible by 5 (flag set, non-review session)
   - `pickCvcReviewNode` returns round-robin node on sessions divisible by 5 (flag set, review session)
   - `pickCvcReviewNode` returns null when fewer than three CVC tiers are mastered (pre-check failure scenario — function should guard defensively)
   - `pickFocusNode` returns `{ node: 'digraphs', reviewMode: false }` when digraphs is the current focus and sessionCount is not divisible by 5
   - `pickFocusNode` returns `{ node: 'cvc-words-short-u', reviewMode: true }` when all three mastered and graduation flag is unset

### For Matt (follow-on tickets)

1. **File a time-based CVC review gate ticket (v2).** The `sessionCount % 5` gate is a reasonable v1 approximation but degrades for irregular usage patterns. A `daysSinceLastCvcReview >= 5` gate is more robust. File as a post-ship follow-up with a link to Section 4.2 of this document.

2. **File a `crossVowelAccuracy` per-pair tracking ticket (v2).** Section 4.1 and 4.3 identify pair-level accuracy as the right signal for detecting /æ/-/ʌ/ fragility. A `Record<'a-o' | 'a-u' | 'o-u', number>` field on `SessionHistoryEntry` for cross-vowel sessions would let Thomas identify whether the Tagalog-interference failure mode is materializing. Low impl cost; high diagnostic value.

3. **File a short-o pool expansion ticket before cross-vowel mixing ships.** The `cross-vowel-discrimination-threshold.md` §Risks item 3 noted that the 8-word short-o pool is a tighter mastery ceiling than the 14-word short-a pool. Before the first cross-vowel review session fires, short-o should ideally have 11+ words to match short-u. This is a content task (Kyle picture-pack prompts + Thomas Midjourney + Kevin wiring), not a gate redesign.

---

## Sources index

| #   | Source                                                                                                                                                                                                                                           | Strength                                                             | Relevance                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Rosenshine, B. (2012). "Principles of Instruction." _American Educator_. https://www.aft.org/sites/default/files/Rosenshine.pdf                                                                                                                  | [STRONG] — large observational synthesis, replicated across programs | Daily/weekly/monthly review; overlearning; automaticity requirement                                |
| 2   | NIFDI. (2002). "An Analysis of the Reading Mastery Program." https://www.nifdi.org/research/journal-of-di/volume-2-no-2-summer-2002/442-an-analysis-of-the-reading-mastery-program-effective-components-and-research-review/file.html            | [MODERATE] — program analysis, not RCT                               | Maintenance deficit when mastered skills are not reviewed                                          |
| 3   | Phonics Hero. "Mastery in Phonics Learning." https://phonicshero.com/mastery_phonics/                                                                                                                                                            | [MODERATE] — practitioner synthesis of mastery-learning literature   | Maintenance phase after 90%/3-session mastery                                                      |
| 4   | Vlach, H.A. (2019). "Learning to Remember Words: Memory Constraints as Desirable Difficulties." https://vlachlab.education.wisc.edu/wp-content/uploads/2019/09/Vlach2019.pdf                                                                     | [STRONG] — reviewed experimental work on children's word learning    | Forgetting and desirable difficulty; spaced retrieval strengthens retention                        |
| 5   | Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006). _Psychological Bulletin_, 132(3), 354–380. https://www.yorku.ca/ncepeda/publications/CPVWR2006.html                                                                       | [STRONG] — meta-analytic review, 254 studies                         | Optimal review interval as a function of desired retention duration                                |
| 6   | Cepeda et al. (2008). "Spacing effects in learning: A temporal ridgeline." _Psychological Science_, 19(11), 1095–1102. https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02209.x                                                     | [STRONG] — experimental, optimal lag formula                         | The 5-10% optimal-lag-to-retention-interval ratio informing the "every 5 sessions" choice          |
| 7   | Dunlosky, J. et al. (2013). "Improving Students' Learning With Effective Learning Techniques." _Psychological Science in the Public Interest_, 14(1), 4–58. https://journals.sagepub.com/doi/abs/10.1177/1529100612453266                        | [STRONG] — comprehensive review of 10 learning techniques            | Distributed practice as highest-utility learning strategy                                          |
| 8   | PMC11087082 (2024). "Retrieval Practice and Word Learning by Children with DLD." _ASHA_. https://pmc.ncbi.nlm.nih.gov/articles/PMC11087082/                                                                                                      | [MODERATE] — RCT, 7–8-year-olds; DLD population                      | Equal spacing vs. expanding spacing; no advantage to expanding schedule for children               |
| 9   | PMC10547117 (2023). "Bilingualism and Development of Literacy in Children: A Systematic Review." https://pmc.ncbi.nlm.nih.gov/articles/PMC10547117/                                                                                              | [STRONG] — systematic review                                         | Bilingual learners; L1 phonology effects on L2 phonics retention                                   |
| 10  | PMC4394382 (2015). "The Language and Literacy Development of Young Dual Language Learners." https://pmc.ncbi.nlm.nih.gov/articles/PMC4394382/                                                                                                    | [STRONG] — critical review                                           | DLL phonological awareness and phonics maintenance                                                 |
| 11  | Deci, E.L., Koestner, R., & Ryan, R.M. (1999). _Psychological Bulletin_, 125(6), 627–668. https://pubmed.ncbi.nlm.nih.gov/10589297/                                                                                                              | [STRONG] — meta-analysis 128 studies                                 | Completion-contingent recognition (graduation celebration) does not undermine intrinsic motivation |
| 12  | Ryan, R.M. & Deci, E.L. (2000). "Self-Determination Theory." _American Psychologist_, 55(1), 68–78.                                                                                                                                              | [STRONG] — foundational motivational theory                          | Competence recognition as a basic psychological need                                               |
| 13  | Colorín Colorado. "Fostering Literacy Development in English Language Learners." https://www.colorincolorado.org/article/fostering-literacy-development-english-language-learners                                                                | [STRONG] — NRP-grounded, ELL-specific                                | Distributed review of L2 phonics patterns                                                          |
| 14  | Learning Without Tears. "Phonics Strategies for Multilingual Learners." https://www.lwtears.com/blog/phonics-strategies-support-multilingual-learners-classroom                                                                                  | [MODERATE] — practitioner consensus, ELL-specific                    | Periodic review for multilingual learners to prevent L1 interference erosion                       |
| 15  | Yeh, C.H. (2022). "Principle-based phonics instruction and long-term spelling retention in Grade 5 EFL classrooms." _Language Teaching for Young Learners_. John Benjamins. https://www.jbe-platform.com/content/journals/10.1075/ltyl.25060.yeh | [MODERATE] — EFL experimental study, delayed test                    | Spaced practice leading to maintained phonics gains at 15-week delayed test                        |
| 16  | cross-vowel-discrimination-threshold.md (internal, PR #175)                                                                                                                                                                                      | Internal                                                             | /æ/-/ʌ/ highest-risk pair; per-aggregate gate; failure-mode analysis                               |
| 17  | short-u-minimal-pair-and-future-vowel-openers.md (internal, PR #173)                                                                                                                                                                             | Internal                                                             | /ʌ/ as highest Tagalog-interference vowel; lifetime-once opener rationale                          |
| 18  | cvc-words-developmental-review.md (internal, PR #139)                                                                                                                                                                                            | Internal                                                             | 90%/3-session mastery as consolidation proxy; original P2 cross-vowel recommendation               |
| 19  | phonics-sequence-marian.md (internal, PR foundational)                                                                                                                                                                                           | Internal                                                             | Tagalog vowel inventory; structured-literacy pacing; Leitner interval guidance for literacy        |
