# CVC Review-Mode for Marian — Consolidation Design

**Ticket context:** Wave 16 / ticket 86c9qa6n3 (Word Song consolidation).
**Date:** 2026-06-15
**Distinct from:** `design/research/cvc-review-mode-mechanic.md`, which covers the post-mastery
cross-vowel picker mechanic (all three CVC tiers mastered). This document covers
**within-tier consolidation** — how a review-mode session should be designed while Marian
is still working on a single CVC vowel tier (e.g. short-a emerging, short-o newly introduced).

---

## Question

What does a CVC review-mode session look like for an emerging CVC decoder at 8 — specifically:
word selection rules, spacing of resurfaced words, picture-pairing role, error-correction on
misreads, blending-review versus whole-word recognition, and how the session should differ from
the new-content CVC flow in pacing, scaffolding fade, and vowel mix?

---

## Bottom line

A consolidation review session for an emerging CVC decoder should:
1. Load 80–90% previously-seen words and 10–20% new (or weakly-known) words — this ratio maximises
   both fluency building and retention of harder items (Incremental Rehearsal research).
2. Keep picture chips present throughout the session — pictures remain vocabulary anchors, not just
   semantic supports; removing them too early shifts the cognitive load from decoding to word-recall,
   which is the wrong constraint for an L2 learner whose English vocabulary is genuinely uncertain.
3. Defer vowel-mixing (short-a mixed with short-o) until same-vowel accuracy is solidly above 85%
   across at least two consecutive sessions — the literature on minimal-pair confusion and the
   internal `cross-vowel-discrimination-threshold.md` both support this gate.
4. Use a no-delay corrective prompt (Emma re-reads the word with blended phonemes) on misreads,
   not silent chip-swap. A single correct re-decode after error is the most efficient orthographic
   mapping event for an emerging decoder (Share self-teaching hypothesis).

---

## Evidence

### E1 — Known-to-unknown ratio in word practice

- **MacQuarrie, Tucker, Burns, & Hartman (2002). "Comparison of Drill Rehearsal Methods." _School Psychology Review_.** — MacQuarrie et al. compared three drill-rehearsal models for teaching whole words to elementary students. Incremental Rehearsal (IR), which interspersed 1 new unknown item among 9 previously mastered items (10% new / 90% known), produced significantly better word retention than methods with higher proportions of unknowns. Strength: **moderate** (single study, replicated in direction across several follow-up IR studies; population included typically-developing readers and children with reading difficulties).
- **Joseph (2006). "Incremental Rehearsal: A Flashcard Drill Technique for Increasing Retention of Reading Words." _The Reading Teacher_, 59(8).** — Describes the mechanism: surrounding a new item with high-rate mastered items keeps error rate low (errorless-learning benefit), provides massed correct retrieval of the new item relative to its neighbours, and maintains engagement. Strength: **moderate** (practitioner-research synthesis; foundational description of the technique).
- **Practical bound for Marian:** Given Marian's 8-problem CVC session structure, the 10% rule maps to 1 "stretch" word per session. A more generous 20% new target — supported by the observation that 20% produces higher learning rates than 10% in some studies (see Comparing the Effects of Unknown-Known Ratios, Springer 2006) — maps to 1–2 stretch words out of 8. The design-space is 6–7 review words + 1–2 new or re-introduced weak words per consolidation session.

### E2 — Orthographic mapping and number of decoding exposures

- **Share, D.L. (1999). "Phonological recoding and orthographic learning: A direct test of the self-teaching hypothesis." _Journal of Experimental Child Psychology_, 72(2), 95–129. (PubMed 9927525).** — Share's self-teaching hypothesis holds that each successful phonological decoding of a novel word teaches the child the spelling-sound mapping for that word. For typically developing readers in the full-alphabetic phase, **1–4 correct decoding encounters are sufficient** for rapid recognition to develop; struggling decoders need many more. Strength: **strong** (multiple replications; foundational reading science; systematic review published 2022 in _Reading Research Quarterly_ confirms the direction).
- **Implication for review mode:** Words Marian has encountered fewer than 4 correct times are still "consolidating" — they benefit from repeated accurate decoding in review. Words she has decoded correctly many times (the high-frequency short-a pack she has been working with for weeks) are likely already partially mapped — review sessions maintain and confirm the mapping but are not strictly necessary for acquisition. This means a consolidation session can usefully mix the two categories: recently-introduced or less-accurate words get the most review slots; well-mapped words fill the high-confidence slots at the opening.

### E3 — Spacing and within-session arrangement

- **Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006). "Distributed practice in verbal recall tasks: A review and quantitative synthesis." _Psychological Bulletin_, 132(3), 354–380.** — Meta-analytic review of 254 studies confirming the spacing effect: distributed practice produces stronger retention than massed practice at the same total-exposure count. The benefit is not diminished for children, though the optimal inter-session interval is shorter for children than adults. Strength: **strong**.
- **Spacing Effect in Children Specifically:** Search-verified research on 7–11 year-old children learning word-pairs found words repeated in a spaced design were remembered at higher rates than massed; retention of spaced vocabulary was three times higher than massed in a fifth-grade cohort (Spacing Effects in Real-World Classroom Vocabulary Learning, Cepeda et al. 2011, York University). The gap size between spaced repetitions did not differentially affect performance — what matters is spacing, not the precise interval.
- **Within-session arrangement:** For an 8-problem session, a reasonable spacing design seeds a weak word at problem 2–3, then re-presents it at problem 6–7 (a gap of 3–4 intervening items), giving a within-session spacing benefit. This is distinct from between-session spacing; both matter.
- **Strength: strong for spacing effect; inferred for the specific 3–4-item within-session gap.**

### E4 — Picture-pairing role in consolidation

- **Researchgate (2023): "Using CVC (Consonant Vowel Consonant) With Picture Media in Teaching Vocabulary for Young Learners."** — Demonstrates that picture-word pairing for CVC teaching with young L2 learners increases both retention and correct production. Strength: **weak** (single observational study, Indonesian EFL context — the population match to Marian is reasonable but not precise).
- **Ehri, L.C. (2014). "Orthographic Mapping in the Acquisition of Sight Word Reading, Spelling Memory, and Vocabulary Learning." _Scientific Studies of Reading_, 18(1), 5–21.** — Ehri's framework specifies that orthographic mapping binds spelling, pronunciation, AND meaning. For L2 learners, the meaning link is the weakest of the three, because the pronunciation decoded from letters may not connect to a known semantic concept. A picture chip provides the semantic anchor that allows all three bindings to complete, rather than leaving only the spelling-pronunciation link.
- **Shanahan, T. (blog, ReadingRockets). "Phonics for Second-Language Learners."** — States plainly: "decoding provides pronunciation, but not comprehension" for L2 learners who don't know the word's meaning. For ELLs, phonics is necessary but insufficient without simultaneous semantic support. This is the strongest argument for keeping pictures in CVC review for Marian specifically: she may decode "fan" correctly and still not know what a fan is (Tagalog: *pamaypay*), making the semantic binding fragile.
- **Strength: strong for the L2-specific semantic-anchor argument (Shanahan + Ehri converge). Moderate for picture-pairing specifically (single study + theoretical inference).**
- **Picture fade in review:** The evidence does not support removing pictures during consolidation for an L2 learner. Picture fade is an appropriate mid-term goal once vocabulary knowledge is confirmed — but given Marian's 200-core-word English vocabulary cap, the safe default is to retain picture chips for all CVC tiers until diagnostic evidence (Thomas observing she recognises chips by word text, not picture) supports fading.

### E5 — Error correction on CVC misreads

- **Research on repeated reading and feedback (PMC5346118, 2017). "The Role of Feedback and Differences Between Good and Poor Decoders in a Repeated Word Reading Paradigm in First Grade." _PMC_.** — Found that phonics feedback (sounding out the word's phonemes explicitly) was most beneficial for poor decoders, while good decoders showed no disadvantage with phonics feedback. The training effect (speed improvement) plateaued after approximately 4 repetitions — additional sessions beyond that represented overlearning, not new acquisition. Strength: **moderate** (single study; first-grade population, different from Marian's context but closest available match).
- **Teaching Word Identification to Students with Reading Difficulties (PMC4299759, 2015).** — Immediate corrective feedback prevents students from "practicing and habitualising their errors." The practical technique: do not let an error stand silently — provide the correct phoneme sequence promptly, have the child re-decode, then move forward. Strength: **moderate** (review article, not single RCT).
- **Self-teaching mechanism + correction:** Share (1999) implies that a successful re-decode after corrective prompt counts as a correct decoding encounter — the mapping event happens on the successful pronunciation, not on the error. This means a well-handled error (Emma models, child repeats correctly) is nearly as valuable as a first-read success for orthographic mapping.
- **Application to Word Song UI:** The current Word Song error path (Emma "puzzled tilt + re-prompt") is consistent with this evidence — it does not penalise the child or show a red X, and it re-presents the chip. The gap is that the re-prompt does not currently model the phoneme sequence ("Let's try: /m/-/ɒ/-/p/" for "mop"). Adding a brief blended-phoneme prompt from Emma on the second wrong tap — before giving the answer — would strengthen the consolidation signal. This is a Kyle + Kevin implementation question, not a review-session structural change.

### E6 — Blending versus whole-word recognition for emerging CVC decoders

- **ReadingRachel.com (2025). "From Sound-by-Sound Blending to Automatic Word Reading."** — Describes the transition: children start with explicit sound-by-sound blending (say /k/, /æ/, /t/, then blend), progress to successive blending (blend first two phonemes first, then add the third: /kæ/ + /t/), and eventually reach automatic word recognition. The transition is not a conscious switch — automaticity develops through repetition. Four supported techniques: silent sounding, successive blending, continuous blending, and word-level fluency through repeated small sets. Strength: **moderate** (practitioner synthesis, well-grounded in Ehri phases; no direct RCT cited).
- **Ehri's full-alphabetic phase:** An 8-year-old CVC decoder in the "emerging" range is almost certainly in Ehri's full-alphabetic phase — she maps graphemes to phonemes systematically but slowly; the blending step is still effortful. The transition to automatic whole-word recognition (consolidated phase) happens through accumulation of successful decoding exposures — not through instruction but through practice.
- **What this means for review sessions:** A consolidation review session should NOT switch from phoneme-level prompts to whole-word presentation. The picture chip's presence naturally slows the session to a full-read (child sees the text, decodes, then confirms with the picture) rather than picture-match (child sees the picture and word simultaneously and matches by shape). The silent-text window in the current CVC session design (1500ms before Emma reads aloud) is the right scaffold for this: it creates a decoding beat. That 1500ms window should be preserved in review mode.
- **Automaticity signal in review:** When a child reads a word without any hesitation over 3–4 consecutive review encounters, the word is functionally orthographically mapped. In the context of the app, session-correct-rate per word (available via `perProblemCorrect` + `targetWords` in WordSongSessionResult) can serve as a proxy — sustained 100% on a word across 3 consecutive sessions is a reasonable mapping-complete signal.

### E7 — Vowel mixing in review (same-vowel vs. cross-vowel)

- **Cross-vowel-discrimination-threshold.md (internal, PR #175).** — Tagalog has a 5-vowel system where both English /æ/ and English /ʌ/ map onto Tagalog /a/. The /æ/-/ʌ/ discrimination is the highest-risk phoneme confusion for Marian. This makes premature vowel mixing in review a genuine learning risk: if Marian encounters short-a and short-o words in the same session before short-a is solidly consolidated, she will be asked to discriminate two vowels while still consolidating one — adding cognitive load at the wrong moment.
- **UFLI Foundations session structure (Lane et al., 2025, _Reading Research Quarterly_).** — UFLI's design principle: "When we're introducing the new concept, we're still practicing that last one." The key word is "last one" — review covers the immediately preceding skill, not multiple prior skills simultaneously. Mixing more than one prior vowel tier into a review session is not UFLI standard practice at the emerging-decoder stage.
- **Interleaving research caveat:** The general cognitive science finding is that interleaved practice produces better discrimination outcomes than blocked practice (desirable difficulty principle). However, interleaving is most beneficial after initial acquisition is complete — when practicing for retention and discrimination, not when still consolidating basic phoneme-grapheme correspondences. Bjork & Bjork (1994, _Memory_) distinguish acquisition from retention: interleaving hurts acquisition but helps retention. An "emerging" CVC decoder is still in acquisition mode for the current vowel; interleaving should wait until she is in retention mode (sustained ≥85% accuracy across 2 sessions).
- **Practical rule for review mode:** Same-vowel-only in review until the current tier is above 85% for two consecutive sessions. Then, and only then, introduce one cross-vowel distractor pair per session as a discrimination challenge. Full cross-vowel mixing (the existing ticket 86c9m3aek mechanic) waits for mastery of all tiers, per the existing spec.
- **Strength: strong for the Bjork interleaving timing principle; moderate for the 85%/2-session gate (inferred from the acquisition-retention distinction; not an RCT threshold for this specific context).**

### E8 — L2 / bilingual learner context

- **Shanahan (2024, ReadingRockets).** — Phonics instruction is beneficial for L2 learners; effects are more modest than for L1 learners. Vocabulary is the key bottleneck: decoding a word provides pronunciation but not comprehension for a child who doesn't know the word. Strength: **strong** (synthesises NRP findings; directly applicable to Marian).
- **PMC12571324 (2025). "How is vocabulary involved in second language reading comprehension? A study in Chinese-English bilingual children."** — Vocabulary more strongly associated with decoding and reading comprehension in L2 than L1. For children with limited L1-L2 phonological overlap (Tagalog-English has minimal overlap — different vowel inventories, no tonal system transfer), vocabulary is doubly important as a verification layer for decoding. If the child decodes a word but has no vocabulary representation of it, the decoding cannot self-correct (she cannot tell "mop" sounds right vs. wrong because "mop" may not be in her vocabulary yet). Strength: **strong** (recent peer-reviewed study; population match is Chinese-English, close analogue to Tagalog-English in phonological distance).
- **Practical consequence:** In review mode for Marian, picture chips are not optional pedagogy — they are the vocabulary verification mechanism that makes decoding feedback meaningful. Without the picture, a correct decode of an unknown word is a hollow event: the orthographic mapping fires, but the meaning binding fails, leaving the word as a pronunciation-spelling unit with no semantic grounding.

---

## Application to Marian

Marian is:
- 8 years old, Tagalog-primary, emerging CVC decoder (short-a pack; short-o newly introduced).
- In Ehri's full-alphabetic phase: she can decode CVC words phoneme-by-phoneme but automaticity is not yet established.
- An L2 English learner whose vocabulary is genuinely uncertain for many CVC targets (fan, van, jam — these may not be in her active English vocabulary despite the picture chips).
- Working with a pool of 14 short-a + 8 short-o words; not yet exposed to short-u.

The review-mode design implications are more demanding for Marian than for a typical L1 reader at 8:
- The semantic-anchor failure risk (decoding without vocabulary binding) is real and specific to her L2 status. Pictures stay.
- The /æ/-/ɒ/ confusion is the active discrimination risk if review introduces short-o words before short-a is solidly consolidated. The same-vowel gate applies to her first review sessions.
- The self-teaching mechanism operates more slowly for Marian than for a typical L1 decoder: she needs more correct decoding encounters per word before the word is orthographically mapped, because the meaning binding is weaker on each encounter. The 4-exposure estimate for L1 readers should be treated as a floor, not a ceiling, for Marian. Plan for 6–8 successful encounters per word before assuming a word is mapped.

---

## Recommended review-mode design

### Session composition (8 problems)

| Slot | Word type | Count | Rationale |
|------|-----------|-------|-----------|
| Problems 1–2 | High-confidence review words (≥90% correct across last 2 sessions) | 2 | Open with success; activate prior mapped words |
| Problems 3–5 | Mid-confidence review words (70–90% correct) | 3 | Core consolidation; still need retrieval practice |
| Problem 6 | Weak review word (< 70% correct in any prior session) or newly introduced word | 1 | The "stretch" item; benefits most from session spacing |
| Problem 7 | Another high-confidence review word | 1 | Recovery; re-establishes success rhythm after stretch |
| Problem 8 | Repeat of the weak word from problem 6 (if still in same session) | 1 | Within-session spaced repetition of the hardest item |

This is a 7:1 known-to-new ratio, generous relative to the 9:1 IR optimum, appropriate for
an 8-problem session where 1 re-presentation of the weak word is achievable.

### Word selection rule

Priority tiers (planner picks from these in order):
1. Words with < 70% correct rate in the last 3 sessions (target these in the stretch + repeat slots).
2. Words with 70–90% correct rate in the last 3 sessions (fill mid-confidence slots).
3. Words with ≥ 90% correct rate in the last 3 sessions (fill opening and recovery slots).
4. Words not yet seen (treated as new-to-review; use sparingly, only if the weak-word pool is exhausted).

Session history precision: The current `SessionHistoryEntry` records `perProblemCorrect` (boolean array)
and `targetWords` (string array). A per-word correct-rate aggregator across the last 3–5 sessions is
implementable from these fields. This does NOT require schema changes beyond what already exists.

### Distractor tier in review mode

Keep the existing gentle (problems 1–3) / trap (problems 4–8) distractor split from `wordDistractors.ts`.
The gentle tier is appropriate for high-confidence words even in review; the trap tier provides the
discrimination challenge that drives orthographic sharpening for mid-confidence words.

Do not upgrade mid-confidence review words to cross-vowel distractors during same-tier review. Same-vowel
distractors are the right consolidation signal. Cross-vowel chips are for the post-mastery mechanic
(ticket 86c9m3aek), not for within-tier review.

### Pictures: keep throughout

Picture chips present for all 8 problems in review mode. No fade. The semantic-anchor argument for Marian's
L2 status means picture-fade belongs to a future stage (digraphs or beyond), where vocabulary is confirmed
rather than inferred. If Thomas wants to test whether Marian has internalised a word meaning (no picture
needed), that should be a deliberate diagnostic probe, not a structural change to the review session.

### Silent-text window: preserve

The existing 1500ms silent-text window (Emma delays her read-aloud so Marian gets a decoding beat)
should be preserved in review mode. This is the mechanism that ensures she is decoding rather than
picture-matching. Shortening or removing the window in review mode would undermine the phonics signal
from the session.

### Error-correction on misreads

Current behavior: Emma's puzzled-tilt re-prompt. Recommended addition for review mode:
- On the first wrong tap: Emma re-reads the target word with emphasis ("Let's try again...") — current behavior.
- On the second wrong tap: Emma sounds out the word in a blended sequence ("/m/ — /ɒ/ — /p/ — mop!") before giving the answer. This is the self-teaching trigger: the child hears the phoneme-blended form, which activates the decoding route even if they cannot produce it.
- This sequence stays within the "never a red X" constraint — Emma sounds warm and helpful, not corrective.
- Implementation note: this is a Kyle spec + Kevin implementation question. The research basis is
  Share (1999) + PMC4299759 (2015). The explicit phoneme prompt on the second miss is the change; the
  first-miss re-prompt is already correct.

### Scaffolding fade schedule

| Session phase | Scaffold present | Rationale |
|---------------|-----------------|-----------|
| Intro (first encounter, SkillLevel 'intro') | Full: 1500ms silent window, picture, Emma reads on second miss with phoneme blend | Maximum support; decoding is effortful |
| Practicing (sessions 1–N, SkillLevel 'practicing') | Full: same as intro | Consolidation is still in progress; no fade yet |
| Approaching mastery (sustained ≥85% across 2 sessions) | Same: picture + 1500ms window | Fade is NOT triggered by accuracy alone — vocabulary binding may still be incomplete |
| Mastered (90%/3 sessions) | Picture still present; may introduce cross-vowel distractors per existing mechanic | The mastered state is the correct trigger for introducing discriminatory challenge, not for removing pictures |

In short: **no scaffolding fade during any within-tier CVC review session.** Fade belongs at
the tier-transition boundary, not within-tier. This is conservative but correct for an L2 learner
whose vocabulary binding is independent of her decoding accuracy.

### Vowel mixing in review sessions

| Phase | Vowel mix in review session | Gate |
|-------|----------------------------|------|
| Emerging / practicing short-a only | Same-vowel only (short-a distractors from short-a pool) | Always |
| Emerging / practicing short-o (short-a mastered) | Same-vowel only (short-o distractors from short-o pool) | Always for the current tier |
| Approaching mastery on short-o (≥85% / 2 sessions) | Optionally introduce 1–2 cross-vowel distractor problems mixing short-a + short-o | Optional; sponsor-gateable |
| All CVC tiers mastered | Full cross-vowel mix — per ticket 86c9m3aek and existing `cvc-review-mode-mechanic.md` | Handled by existing mechanic |

The "1–2 cross-vowel problems when approaching mastery" is a mid-road option not currently implemented.
It is NOT needed for v1 — the existing same-vowel + cross-vowel-post-mastery design is sufficient. File
as a future ticket if Thomas observes that the jump from same-vowel to full cross-vowel is too steep.

---

## Risks / counter-evidence

1. **The IR 90:10 ratio is drawn from word reading, not phonics decoding specifically.** The Incremental
   Rehearsal studies primarily tested sight-word (whole-word) reading with children with reading
   difficulties. Applying the ratio to phonics decoding of CVC words is an inference. There is no direct
   RCT testing 90:10 vs. 80:20 vs. 70:30 ratios specifically for CVC decoding consolidation. The
   90:10 ratio is a principled default; the evidence for the exact proportion is moderate.

2. **The "6–8 exposures" estimate for Marian is inferred.** Share's "1–4 exposures" figure is for
   typically developing L1 readers; the extension to Marian (L2 learner, emerging decoder) adds an
   unknown multiplier. A cautious multiplier of 1.5–2× gives 4–8, hence the "6–8" floor. But this is
   clinical judgment, not empirical data for Tagalog-English learners. If Thomas observes Marian
   decoding words correctly in session and then "forgetting" them in the next session, that is evidence
   the per-word exposure count is not yet sufficient.

3. **Picture-chip retention in review is conservative.** There is a risk that keeping pictures indefinitely
   allows Marian to picture-match rather than decode — particularly for words with distinctive images
   (dog, fox, mom). The silent-text window is the primary protection against this; however, if Thomas
   notices Marian tapping chips before Emma even reads the word, that is a signal she is matching
   pictures, not decoding. That is the empirical trigger for a targeted picture-fade experiment, not a
   structural change to the review mode.

4. **The Bjork interleaving finding applies to discrimination, not acquisition.** Interleaved practice
   of multiple vowel sounds is beneficial for long-term retention once each sound is independently
   consolidated. If the same-vowel gate is set too high (requiring 85% rather than 70%), Marian may
   stay in single-vowel review longer than necessary. The 85% gate is conservative; 70% would be a
   more aggressive entry point for cross-vowel introduction. The evidence does not pin a specific number;
   85% is chosen because it matches the existing mastery-rule direction (90%/3 sessions for full mastery;
   85% signals strong consolidation without meeting the full mastery threshold).

5. **Per-word correct-rate aggregation is not currently implemented.** The current progress schema
   records session-level `successRate` (per `SessionHistoryEntry`) and per-problem correct booleans +
   target words. Aggregating per-word accuracy across sessions requires either a new per-word tracking
   field (schema change) or a runtime aggregation over the `history` array. The latter is possible
   given `perProblemCorrect` + `targetWords`, but it is a read-time computation rather than a stored
   value. Kevin should evaluate whether the read-time computation is sufficient for a review-mode word
   selector, or whether a per-word correct-count field is worth adding.

---

## Recommendations

### For Matt (ticket priority / scope)

1. **The review-mode session composition (known:new ratio, word selection tiers) is not a new feature —
   it is a planner-directive change.** The existing planner can be instructed to prefer lower-accuracy
   words and to repeat the weakest word in slot 8. File as a planner-side directive in the Word Song
   track guide, not a new screen or component. Scope is small.

2. **Per-word correct-rate computation from existing history is achievable without a schema change.**
   Matt should check with Kevin whether a `computeWordAccuracy(history, word, lastN)` helper is feasible
   at session-start time. If the history array is kept to 30 entries (current cap), the computation over
   14–22 CVC words across 30 entries is trivial. No schema bump needed if Kevin can do this at session-start.

3. **Vowel-mix gate (85%/2 sessions before cross-vowel distractors) is not a v1 requirement.** The
   existing design (same-vowel only until mastery) is evidence-grounded and sufficient for now. Flag as
   a future enhancement if Thomas observes the mastery-to-cross-vowel jump is causing confusion.

4. **Blended-phoneme error prompt on second miss is the highest-value addition for consolidation.** Of all
   the recommendations here, Emma providing a blended phoneme sequence on the second wrong tap is the one
   most directly grounded in the self-teaching mechanism and corrective-feedback literature. If scope is
   limited, this is the change most likely to accelerate Marian's orthographic mapping. File as a Kyle
   spec addition.

### For Kyle (design changes)

1. **Add a second-miss phoneme-blend prompt to Emma's error-correction path.** Current path: puzzled-tilt
   + re-prompt text. Proposed path: puzzled-tilt + re-prompt text → (if second miss) Emma says the word
   in phoneme-blended form ("Let's hear it: /m/-/ɒ/-/p/... mop!") before giving the answer. This stays
   in-character (warm, not corrective) and triggers the self-teaching event. The prompt copy needs to be
   calibrated to Marian's vocabulary — say the word naturally after the phoneme blend so she hears the
   whole word.

2. **Silent-text window (1500ms) is correct for review mode — do not shorten it.** The decoding beat is
   the mechanism that ensures review sessions are phonics practice, not picture-recognition practice.

3. **Pictures stay throughout all CVC review sessions.** No fade until explicit sponsor signal that
   Marian's vocabulary binding for specific words is confirmed (e.g., Thomas reports she names the word
   before the picture chip appears).

4. **Session opener framing for review mode:** Emma's session-open line for a review session should
   communicate familiarity, not novelty. Suggested frame: "You know these words! Let's read them again."
   This is a mild but important framing difference from a new-content session ("We're going to try some
   new words today!"). Review mode should feel like revisiting familiar friends, which activates retrieval
   confidence rather than performance anxiety.

---

## Sources index

| # | Source | Strength | Relevance |
|---|--------|----------|-----------|
| 1 | MacQuarrie, Tucker, Burns, & Hartman (2002). "Comparison of Drill Rehearsal Methods." _School Psychology Review_. | [Moderate] | Known-to-unknown ratio (10% new / 90% known) for word retention |
| 2 | Joseph, J.L.M. (2006). "Incremental Rehearsal: A Flashcard Drill Technique." _The Reading Teacher_, 59(8). ILA. | [Moderate] | IR mechanism; errorless-learning + massed correct retrieval explanation |
| 3 | Share, D.L. (1999). "Phonological Recoding and Orthographic Learning: A Direct Test of the Self-Teaching Hypothesis." _Journal of Experimental Child Psychology_, 72(2), 95–129. PubMed 9927525. | [Strong] | Self-teaching mechanism; 1–4 exposures for L1 readers; correct decode as mapping event |
| 4 | Systematic review of orthographic learning via self-teaching (2022). _Reading Research Quarterly_. Taylor & Francis. https://www.tandfonline.com/doi/full/10.1080/00461520.2022.2137673 | [Strong] | Confirms Share's hypothesis across multiple replications |
| 5 | Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006). "Distributed practice in verbal recall tasks." _Psychological Bulletin_, 132(3), 354–380. | [Strong] | Spacing effect meta-analysis; spacing benefit for children |
| 6 | Cepeda et al. (2011). "Spacing Effects in Real-World Classroom Vocabulary Learning." York University. | [Strong] | Spacing benefit in children 7–11; 3× retention advantage over massed |
| 7 | Ehri, L.C. (2014). "Orthographic Mapping in the Acquisition of Sight Word Reading, Spelling Memory, and Vocabulary Learning." _Scientific Studies of Reading_, 18(1), 5–21. https://www.tandfonline.com/doi/abs/10.1080/10888438.2013.819356 | [Strong] | Meaning binding in orthographic mapping; L2 vocabulary gap as risk |
| 8 | Shanahan, T. (2024). "Phonics for Second-Language Learners." ReadingRockets blog. https://www.readingrockets.org/blogs/shanahan-on-literacy/phonics-second-language-learners | [Strong] | Vocabulary bottleneck for L2 phonics decoders; decoding ≠ comprehension for ELLs |
| 9 | PMC5346118 (2017). "The Role of Feedback and Differences Between Good and Poor Decoders in a Repeated Word Reading Paradigm." _PMC_. https://pmc.ncbi.nlm.nih.gov/articles/PMC5346118/ | [Moderate] | Phonics feedback most effective for weaker decoders; speed plateaus at ~4 repetitions |
| 10 | PMC4299759 (2015). "Teaching Word Identification to Students with Reading Difficulties." _PMC_. https://pmc.ncbi.nlm.nih.gov/articles/PMC4299759/ | [Moderate] | Immediate corrective feedback prevents error habitualisation; teaching to mastery |
| 11 | PMC12571324 (2025). "How is vocabulary involved in second language reading comprehension?" _PMC_. https://pmc.ncbi.nlm.nih.gov/articles/PMC12571324/ | [Strong] | Vocabulary more strongly linked to L2 decoding than L1; semantic binding gap for L2 learners |
| 12 | ReadingRachel (2025). "From Sound-by-Sound Blending to Automatic Word Reading." https://readingrachel.com/blog-2/from-sound-by-sound-blending-to-automatic-word-reading | [Moderate] | Transition from blending to automaticity; four supported techniques; blending as correct scaffold |
| 13 | Bjork, R.A. & Bjork, E.L. (1994). "Making Things Hard on Yourself, But in a Good Way." [Desirable difficulties; acquisition vs. retention distinction.] _Memory_ series, Cambridge. | [Strong] | Interleaving helps retention, not acquisition; must wait for acquisition before interleaving |
| 14 | Lane, H. et al. (2025). "Effect of an Instructional Program in Foundational Reading Skills." _Reading Research Quarterly_. https://ila.onlinelibrary.wiley.com/doi/10.1002/rrq.607 | [Strong] | UFLI Foundations: "practicing that last one" while introducing new; continuous review principle |
| 15 | Research on CVC with picture media for young L2 learners (Researchgate 2023). https://www.researchgate.net/publication/372395069 | [Weak] | Picture-word pairing increases retention for young L2 learners; direct population match |
| 16 | cross-vowel-discrimination-threshold.md (internal, PR #175) | Internal | /æ/-/ɒ/ confusion as highest-risk pair; Tagalog vowel interference analysis |
| 17 | cvc-review-mode-mechanic.md (internal, 2026-05-09) | Internal | Post-mastery cross-vowel picker; graduation review + periodic revisit mechanic |
| 18 | cvc-words-developmental-review.md (internal, PR #139) | Internal | Foundational within-tier review rationale; pool ceiling risk |

Total citations: 18 (12 external + 3 internal research files + 3 internal project docs).
Strong: 8. Moderate: 6. Weak: 1. Internal: 3.
