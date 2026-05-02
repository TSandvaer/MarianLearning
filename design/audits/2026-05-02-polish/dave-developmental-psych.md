# Developmental-Psychology Polish Audit — 2026-05-02

**Auditor:** Dave (developmental psychologist)
**Production URL audited:** https://marian-learning.vercel.app/
**Production HEAD at audit time:** b09294a (M3 mastery promotion, M2.5 parent settings)
**Audit context:** Quality bar shift — "polished, responsive, immersive" as ship-to-Marian gate.

---

## Approach

Read the following sources in full:

- `MarianLearning/CLAUDE.md` — project context
- `MarianLearning/design/character-emma.md` — character spec (Phase 3b)
- `MarianLearning/design/screen-3-math.md` — Math screen spec
- `MarianLearning/design/screen-4-word-song.md` — Word Song screen spec (first 100 lines)
- `MarianLearning/design/screen-5-session-end.md` — Session End spec (first 280 lines)
- `MarianLearning/design/screen-hub.md` — Hub spec (first 180 lines)
- `MarianLearning/design/session-1.md` — Session 1 walkthrough (first 100 lines)
- `MarianLearning/api/_planner.ts` — system prompts (MATH_TRACK_GUIDE, WORD_SONG_TRACK_GUIDE, SYSTEM_PREAMBLE)
- `MarianLearning/src/lib/progress/parentSettings.ts` — threshold defaults
- `MarianLearning/src/lib/progress/mastery.ts` — mastery rule
- `MarianLearning/design/research/math-distractor-and-streak-decisions.md`
- `MarianLearning/design/research/phonics-sequence-marian.md`
- `MarianLearning/design/research/hub-navigation-research-86c9hab6y.md`
- `build a tutor AI app with investigation and analysis.md` (first 100 lines of investigation doc)

Did not directly observe Marian using the app. Did not test audio playback, animation timing, or iPad-specific rendering. Could not WebFetch the production URL interactively (PWA loads a React bundle; DOM structure is not readable from a cold WebFetch in a meaningful way for this audit). The assessment is therefore a code- and spec-level review supplemented by targeted web research on developmental and motivational evidence.

---

## Findings

### P0 — Ship-blockers (developmental concern, will likely cause Marian to disengage)

- [ ] **Character identity mismatch is cognitively incoherent for an 8-year-old.** The app currently says "Emma" in audio and captions while showing the bunny Melody visually. For a child at Marian's age and language level, the trusted voice-and-face of a teacher figure is a primary anchor for the parasocial bond that makes a solo learning app work. A named voice that does not match the face is not a mild cosmetic gap — it is an identity rupture that reads as a mistake or a broken app. Children this age have solid theory of mind (Wellman, Cross & Watson, 2001, _Child Development_) and detect mis-matched identity cues reliably. Emma's warm character spec is well-conceived; the Phase 3b visual pivot is blocking its developmental payoff. The mismatch should be treated as a P0 blocker to serious deployment, not a known acceptable debt. **Proposed direction:** Expedite Phase 3b. Until it lands, consider whether the audio/caption reference to "Emma" should be reverted to "Melody" so the app is at least internally coherent for Marian.

- [ ] **Word Song track is frozen at a single content mode regardless of Marian's assessed level.** The planner (`_planner.ts` line 425-429, WORD_SONG_TRACK_GUIDE comment block) hard-clamps all Word Song sessions to `blending-cv` / CVC "Tap the word" mode regardless of what `focusNode` the browser sends. Marian's April 2026 diagnostic shows CVC reading is _already emerging_ — she read "cat" and "dog" cold. A child who has demonstrated partial mastery of the target skill and is then presented 8 repetitions of its simplest form will disengage within 2–3 sessions. The Vygotskian zone of proximal development (Vygotsky, 1978; and Chaiklin's 2003 reanalysis in _The Zone of Proximal Development in Vygotsky's Analysis_) is not about review — it is about operating just beyond current independent capability. The current implementation is outside the ZPD in the wrong direction (too easy). **Proposed direction:** The P0 planner fix (ticket 86c9kt47v TODO) is specifically flagged as a content-template expansion problem. This must be resolved before sustained Word Song use begins, because the initial sessions will set Marian's expectation of what Word Song is. If those sessions are too easy, she will classify the activity as "baby stuff" and resist it.

### P1 — Significant developmental gaps

- [ ] **The stardust reward is performance-contingent for math but should also be granted for completed Word Song attempts.** The Math spec awards +1 stardust per correct first-attempt answer and withholds stardust on guided completions. This is broadly appropriate for math automaticity (where correct/incorrect carries clear skill signal). However, the phonics research memo (`design/research/phonics-sequence-marian.md` §Q7) explicitly recommends completion-contingent stardust for literacy — backed by the Deci, Koestner & Ryan (1999) meta-analysis of 128 studies showing that performance-contingent rewards undermine intrinsic motivation particularly for interesting tasks (d = −0.34), and that word-learning specifically activates intrinsic reward (Krishnan & Ripollés, via Tooled Up Education). The phonics research memo flags this as a Kyle design-change recommendation but as of this audit the Word Song spec's stardust policy appears to mirror Math's correct-answer-only policy. For Marian's specific bottleneck (vocabulary, not decoding mechanics), getting her to _attempt and complete_ every word item is more valuable than a binary right/wrong currency signal. **Proposed direction:** Award stardust for completing the Word Song item attempt (showing willingness), with a higher-amplitude celebration (Emma's reaction) reserved for correct matches. The stardust signal says "you're doing the work"; Emma's reaction says "that was right."

- [ ] **Emma's hint-state (`attentive-pointing`) is presently a spec-level asset with no implementation, and the hint TTS copy is minimal.** The hint after 2 wrong attempts on a math problem currently reads (from the planner): "Look. Three. And two more. How many now?" — a single composite sentence. For an L2 learner at Marian's vocabulary level, the pacing inside a hint utterance is the scaffolding. Research on worked examples and the worked-example effect (Renkl, 1997, _Learning and Instruction_; strong evidence across multiple replications) shows that modelling the solution step-by-step — pausing between sub-steps — produces better learning than a single fluent narration. The current hint structure collapses all three sub-steps (group A, group B, total) into one short burst. The `math.p{N}.hint` spec in screen-3-math.md is better — it breaks them into three distinct beats with flower-group pulses — but the planner's MATH_TRACK_GUIDE generates hints as a single utterance. These are inconsistent. **Proposed direction:** The planner should generate hints as three separate utterance IDs (`.hint1`, `.hint2`, `.hint3`) so the audio player can pause between sub-steps and the flower-group animations can sync to individual beats rather than a single audio clip. This is a modest planner+browser-parser change but has material impact on scaffolding quality for a still-counting child.

- [ ] **Session pacing: the app has no explicit thinking-time window.** The Math screen's chip row is tappable immediately on problem reveal. There is no minimum dwell time before Marian can tap. For a child at 100% finger reliance who is still in procedural (counting) rather than retrieval mode (Siegler, 2016, overlapping-waves model), the instant-tap affordance nudges toward guess-and-verify rather than count-then-confirm. Evidence: Kahneman's dual-process framing (System 1 vs System 2; _Thinking, Fast and Slow_, 2011) maps directly here — an always-available tap targets fast/impulsive responding. For automaticity-building, we want to encourage the retrieval attempt before a physical tap is possible. A 500–800ms minimum dwell window (chips visible but not tappable; Emma's read-aloud in progress) would structurally protect that retrieval attempt without being punitive. This is not about slowing the app down — it is about the affordance architecture communicating "wait a moment, think." **Proposed direction:** Add a `thinkingTimeMs` constant (500ms default, configurable in parent settings) that gates chip tap-registration until after Emma's `read` utterance has begun playing. The chips are _visible_ immediately but registered taps before the gate opens simply advance the TTS playback rather than registering an answer (matching the "cutting off Emma" affordance already in the spec).

- [ ] **Session-End's only CTA is "All done!" — there is no "play again" or "try the other track" affordance before routing to Hub.** The spec correctly avoids an "one more!" loop (anti-dark-pattern). But for an 8-year-old who just had a great session (all correct, high stardust), the transition from celebration directly to "All done!" → Hub can feel abrupt. Self-Determination Theory (Ryan & Deci, 2020; Strong evidence) identifies competence satisfaction as a basic need — when Marian has just demonstrated high competence, routing her immediately to a "pick something else" Hub screen without a moment of closure undersells the win. **Proposed direction:** The session-end celebration arc should include a 3–4 second beat of Emma in the `cheering` pose with no CTA visible, then a gentle fade-in of "All done!" after that hold. This does not add engagement pressure — it honours the completion moment. The CTA's existence already gives her the exit; the animation window is the psychological closure.

- [ ] **The Hub's "recent stats strip" shows a flame emoji in the spec wireframe for the day-streak.** The hub-navigation research memo (PR #79) and the screen-hub.md spec correctly document that streaks should use a sparkle glyph, not a flame (same rationale as Math's streak indicator — flame reads as urgency/pressure). The wireframe in screen-hub.md line 90 still shows `🔥 4` for the day-streak. This is likely a wireframe artifact, not an implementation decision, but it needs explicit resolution. The flame glyph in any Marian-facing context contradicts the documented developmental rationale and should be replaced with a sparkle/sun/star mark. **Proposed direction:** Resolve in screen-hub.md before implementation; carry the sparkle mark from Math's streak indicator consistently.

### P2 — Nice-to-haves

- [ ] **Emma's vocabulary cap (200 core words) is policy but is not mechanically enforced in the planner.** The SYSTEM_PREAMBLE says "around 200 core words" and gives a brief description but does not enumerate the allowed list. Haiku is instructed to constrain itself; LLM self-constraint is soft. A session where Emma says something like "Let's investigate this calculation!" would pass the JSON contract but violate the vocab cap. Since Marian is L2 English, a single incomprehensible word from Emma mid-session produces confusion that is disproportionate to the word count — it breaks the sense of "I understand this" that is foundational to L2 engagement (Krashen, 1985, _The Input Hypothesis_). **Proposed direction:** Add a hard allow-list of the 200 words + numerals to the SYSTEM_PREAMBLE (one line per word or comma-separated block). This costs ~300 prompt tokens and will meaningfully constrain Haiku's vocabulary in practice.

- [ ] **The b/d confusion risk in Word Song distractors is acknowledged but not mechanically guarded.** The phonics memo correctly notes b/d flip is normal and self-resolves, and advises avoiding word pairs where b/d swap produces a real word. The planner's WORD_SONG_DISTRACTOR_HINTS block (not read in full but referenced in `_planner.ts` line 548) presumably handles this, but the planner generates hints for distractors, not the distractors themselves — those come from `wordDistractors.ts`. A review of that file for b/d-confusable pairs (bad/dad, bid/did, bin/din, bat/dat) against the target word list would be worth a quick pass before ship. Low risk but easy to check. **Proposed direction:** Jessica can add a b/d-confusability check to the distractor test suite.

- [ ] **The Hub day-streak does not have a specified visual reset moment.** The hub-navigation research memo correctly says the streak silently resets to 0 on missed days without showing a "you broke your streak" state. The spec says the stats strip "hides unless something positive to say." It is worth verifying that the implementation handles the edge case where Marian returns after a 2-day gap — the strip should simply be absent (not "0 day streak"), and Emma's welcome line should be the standard "Hi! What today?" without any temporal reference that could carry implicit shame. **Proposed direction:** QA test: simulate a 3-day gap; verify stats strip is hidden, Emma's line is neutral, no "it's been a while!" phrasing.

---

## Specific Concept Evaluations

### Mastery threshold (95% / 3 cross-day sessions)

**The threshold configuration is well-constructed. The default of 95% over 3 cross-day sessions is conservatively calibrated and developmentally defensible, but the 95% criterion may be slightly too high for phonics skill nodes at Marian's current stage.**

Breaking this down:

**95% accuracy criterion.** The research evidence on mastery criteria shows 90% is the most common evidence-backed threshold for skill maintenance in elementary-age children (Weiss et al., 2018, PMC5843573; 90% criterion produced 88% maintenance accuracy vs 69% for 80% criterion). The jump from 90% to 95% is not well-studied as a distinct threshold — the 95% criterion in the app is more conservative than the evidence base recommends, which means Marian will practice a skill longer before being promoted. For math automaticity (add-to-10), this conservatism is appropriate — the goal is automaticity, not just competence, and over-practice of foundational math facts carries low harm and real benefit (McNeil et al., 2025, _Psychological Science in the Public Interest_). For early phonics (CVC blending), the conservatism may be less appropriate — phonics skills benefit from _forward momentum_ (each new vowel family opens new words) and lingering on short-a CVC longer than necessary has an opportunity cost in the limited 4-month window. **Recommendation: consider a lower default (90%) for literacy nodes specifically, with 95% retained for math automaticity nodes. The parentSettings presets already include 90%/2 and 80%/2 as available options — making 90%/3 the default for word-song and 95%/3 the default for math would be a one-line change in the adaptive engine.**

**3-session requirement.** This is well-grounded. Three qualifying sessions across different days (cross-day enforcement on) maps closely to the 3-session mastery definition in phonics research (Phonics Hero, drawing on mastery-learning literature) and gives meaningful signal that performance is stable rather than a lucky session. The phonics research memo cited in this project uses the same 3-session criterion with 90% accuracy as the standard. Three sessions at 95% is harder to achieve than three sessions at 90% — the combined effect is quite conservative.

**Cross-day enforcement.** Developmentally well-justified. The sleep-consolidation literature (PMC8164994; Nature Communications Psychology, 2024 — children 7-12 show greatest offline motor-memory gains across 24-hour periods) provides strong support for the cross-day requirement. A child can have an above-chance performance day without having consolidated the skill. Overnight sleep allows declarative-memory consolidation for math facts and word-forms. The cross-day gate is not punitive — it is a developmental reality. The risk is not that it is too strict; the risk is that it creates a wall when Marian is highly engaged and wants to keep going. That is a user-experience consideration (she does well, has to come back tomorrow), not a developmental harm. Thomas's decision to ship with cross-day enforcement on by default is correct.

**The 3 threshold presets (80%/2, 90%/2, 95%/3).** A more useful middle ground preset would be 90%/3 (not 90%/2). 90%/2 is meaningfully easier than 95%/3 and may be appropriate for a child with high anxiety about mistakes; 90%/3 would be the evidence-backed "standard" that most phonics programs use. This is a minor design note for the parent settings UI.

**Overall verdict on the threshold:** 95%/3 cross-day is a reasonable default that will likely work well. The risk is not developmental harm — it is that literacy progression will be slower than necessary given the 4-month window. If Thomas or Marian's parent finds she is stalling on a vowel family for more than 2–3 weeks, the parent settings allow the threshold to be adjusted down. That safety valve is the right design.

---

### Stardust + streak + unlock motivation architecture

**Mostly well-designed for an 8-year-old. Three specific risks worth monitoring.**

The stardust-as-session-currency design avoids the most harmful mechanics: no variable-ratio rewards (thresholds are fixed and predictable at 3/5/8), no streak shame (broken streak fades quietly), no extrinsic gating of core experience (stardust doesn't unlock more problems or harder problems). These are all correct per the dark-patterns literature (Rapp et al., 2023, Springer — "Dark Patterns of Cuteness"; FTC report on children's dark patterns, 2021).

The specific risks:

1. **Cumulative stardust display on the Hub may create a collection obsession at scale.** Showing the all-time total on every Hub visit is appropriate while Marian is early (she might have 30 stars, which feels like a meaningful number). At week 10, if she has 800 stars, the cumulative display becomes a "big number" object with no clear meaning or ceiling. Without an unlock system (correctly deferred in v1), the number is pure scorekeeping. For an 8-year-old this is likely fine in the short term; over months it may drift toward a meaningless counter she stops attending to. The v2 unlock-loop recommendation in screen-3-math.md §4 (fixed-threshold cosmetic unlocks only) remains the right long-term direction.

2. **The streak bonus stardust at thresholds [3, 5, 8] is calibrated for a single-tree 8-problem session.** In a mixed session (Math + Word Song = 16 problems), the streak can run across both tracks. The math-distractor research memo (PR #35) validated [3, 5, 8] for an 8-problem session and the acquisition-phase reinforcement logic — but the same logic would suggest denser celebrations for a 16-problem session (perhaps [3, 6, 9, 12, 16]). This is a calibration note for when mixed sessions ship.

3. **No explicit moment of "you earned these stars and they matter."** The stardust counter ticks up during Session End and Emma says "You earned N stars!" — this is correct. But there is no downstream moment where Marian experiences what the stars _mean_ beyond a cumulative number on the Hub. The v2 cosmetic unlock design addresses this. Flag for Thomas: the motivational value of stardust will start to attenuate without some payoff path around session 20-30.

---

### Frustration-response surface

**The frustration-response design is the strongest developmental feature of the app. No P0 or P1 concerns. Minor calibration note only.**

The wrong-answer path (shake chip → Emma puzzled → "Hmm... try again?" → chips still available → hint after 2 wrong → guided completion after 3 wrong) is evidence-grounded at each step. The key decisions:

- No red X (CLAUDE.md non-negotiable) — correct; red carries aversive conditioning at this age.
- Hint after 2 wrong (not 1) — correctly preserves the self-correction opportunity per Hattie & Timperley (2007), locked in the math-distractor research memo.
- Guided completion after 3 wrong with no stardust — correctly distinguishes a guided outcome from an earned win without shaming.
- Streak indicator fades quietly on break — correct per Kahneman & Tversky (1979) loss-aversion; the streak break is not narrated.
- Emma's puzzled expression meets all the developmental body-language criteria established in `design/research/character-emma-developmental-fit-86c9hjnq1.md`: sideways tilt (not downward), brows raised in curiosity (not furrowed), eyes on the problem (not the viewer).

The one calibration note: the `math.p{N}.reprompt` utterance ("Hmm... try again?") is the same text for every problem and every wrong attempt. After several sessions, predictability could undermine its function as a genuine curiosity signal — Marian may start hearing it as a mechanical "you got it wrong" indicator rather than Emma's authentic puzzlement. Variety within the same warm register (a small pool of 3–4 phrasings: "Hmm... try again?", "Let's try again.", "Try a different one?") would preserve the emotional authenticity. This is a P2-level observation, not a blocker.

---

### Pacing + autonomy

**Pacing is mostly well-calibrated. The autonomy architecture has one significant gap.**

The session length target (10-15 min) is well-matched to 8-year-old sustained attention. Research on age-appropriate task engagement (CNLD Neuropsychology, Brain Balance Centers) converges on 16-20 minutes as the realistic upper bound for an 8-year-old on a structured task; 10-15 min is correctly inside that window with buffer. The diagnostic session (4-6 min) is correctly shorter.

Emma's intro length appears appropriate — the Greet screen's audio-first design with wake-tap gate and a brief welcome before the first problem respects the "don't delay learning" principle. The problem-to-problem transition (auto-advance at 1200ms after correct) is a reasonable pacing assumption, though it assumes Marian is ready to proceed in under 1.2 seconds. Some children at this age need 2-3 seconds between items to reset cognitively. A parent-adjustable auto-advance window (or a "tap to continue" mode) in parent settings would address different pacing preferences.

**The autonomy gap:** there is currently no in-session back affordance in v1 (acknowledged in screen-hub.md as a mid-session exit that doesn't exist yet). This means once Marian enters a session, she cannot exit without closing the PWA entirely. For an 8-year-old with developing executive function and potentially low frustration tolerance on difficult days, the inability to stop a session cleanly (without losing progress mid-session) is an autonomy deficit. Self-Determination Theory (Ryan & Deci, 2020) identifies perceived autonomy as load-bearing for intrinsic motivation — the absence of a graceful exit is the clearest autonomy failure in the current design. The mid-session resume ticket (86c9grnjf) addresses recovery after forced closure; what is missing is a _voluntary_ mid-session exit that is Marian-facing, not parent-only. **Proposed direction:** Add a "stop for now" affordance (small icon, top-left or accessible with a long-press on Emma) that routes to Session End with partial credit for completed problems. This should be available from problem 3+ onward (not from problem 1, to avoid making "give up immediately" trivially easy).

---

## Suggested Follow-up Tickets

- ticket: Expedite Phase 3b visual pivot — character identity mismatch (Emma voice + Melody face) is a P0 developmental concern for Marian's parasocial bond with Emma; revert to "Melody" naming if Phase 3b cannot ship within 1 week of Marian's first use.

- ticket: Widen Word Song content templates past `blending-cv` clamp — current hard-clamp to single CVC mode will cause disengagement within 3–5 sessions for a child already emerging on short-a CVC; unblock M-series browser parser widening per TODO in `_planner.ts`.

- ticket: Differentiate stardust reward policy by track — phonics track should award stardust for completing the attempt (completion-contingent), not only correct matches (performance-contingent), per Deci et al. (1999) meta-analysis and phonics-sequence research memo §Q7.

- ticket: Add thinking-time gate (500ms minimum) before Math chip tap-registration — protects the retrieval-attempt window for a still-counting child; prevents guess-and-verify optimisation; configurable in parent settings.

- ticket: Add voluntary mid-session "stop for now" affordance (from problem 3 onward) — resolves autonomy deficit in v1 in-session flow; routes to partial-credit Session End.

- ticket: Generate Math hints as three discrete utterances (hint1/hint2/hint3) in planner — aligns planner output with the screen-3-math.md three-beat flower-pulse choreography; enables audio sync with animation sub-steps; addresses worked-example pacing for a still-counting child.

- ticket: Resolve flame emoji in Hub day-streak wireframe — replace with sparkle/star mark consistent with Math streak indicator; align screen-hub.md spec before Hub implementation begins.

- ticket: Add 90%/3 preset to parent settings mastery threshold options — current presets (80%/2, 90%/2, 95%/3) skip the evidence-backed standard; 90%/3 is the phonics-research consensus threshold and a meaningful middle option; consider making it the default for word-song nodes specifically.

- ticket: Extend Session End celebration hold before "All done!" CTA appears — 3–4 second Emma cheering hold before CTA fade-in honours the competence-satisfaction moment per SDT; does not add engagement pressure.

---

## What I Deliberately Did NOT Cover

- **Direct observation of Marian.** All findings are based on spec-reading and research; none are based on watching an actual 8-year-old use the app. Some of my calibration concerns (especially around pacing and the thinking-time gate) could be resolved or reversed by a single 20-minute observation session with Marian. Thomas's own observations of Marian using the app should take precedence over my inferences wherever they conflict.

- **Audio quality, prosody, and vocal warmth of the Emma TTS.** The Azure `en-US-EmmaMultilingualNeural` voice is the right choice on paper, but TTS prosody for an 8-year-old L2 learner can make or break the character bond. I have not heard the voice. Any prosody artefacts in Emma's delivery of hints or feedback lines should be surfaced by Thomas's listening tests, not my spec reading.

- **iPad-specific form factor.** Touch target sizing, thumb-zone layout, and animation performance on the actual device were not assessed. Kyle covers form-factor in the UX audit.

- **Accessibility.** Reduce Motion and screen-reader paths are noted in the specs; I have not audited their implementation. That is Kyle's and Jessica's lane.

- **Session-generation quality from Haiku.** The planner's system prompt is well-structured but I did not run sessions to evaluate whether Haiku's problem variety and difficulty calibration are actually appropriate for Marian's level. A week of logged sessions would be the right way to evaluate this empirically.

- **Content coverage of the phonics word pack.** `MarianLearning/src/screens/WordSong/wordPack.ts` was not read in detail. The target word list and distractor hints referenced in the planner were not audited against the phonics-sequence research memo's CVC priority list.

---

## Sources Cited

- Wellman, H.M., Cross, D., & Watson, J. (2001). Meta-analysis of theory-of-mind development: the truth about false belief. _Child Development_, 72(3), 655–684.
- Vygotsky, L.S. (1978). _Mind in Society_. Harvard University Press.
- Chaiklin, S. (2003). The zone of proximal development in Vygotsky's analysis of learning and instruction. In _Vygotsky's Educational Theory in Cultural Context_, 39–64. Cambridge University Press.
- Deci, E.L., Koestner, R., & Ryan, R.M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. _Psychological Bulletin_, 125(6), 627–668. https://pubmed.ncbi.nlm.nih.gov/10589297/
- Kahneman, D. & Tversky, A. (1979). Prospect Theory: An Analysis of Decision under Risk. _Econometrica_, 47(2), 263–292.
- Ryan, R.M. & Deci, E.L. (2020). Intrinsic and extrinsic motivation from a Self-Determination Theory perspective. _Contemporary Educational Psychology_. https://selfdeterminationtheory.org/wp-content/uploads/2020/04/2020_RyanDeci_CEP_PrePrint.pdf
- Bao, X. & Lam, S. (2008). Who makes the choice? Rethinking the role of autonomy and relatedness in Chinese children's motivation. _Child Development_, 79(2), 269–283. https://pubmed.ncbi.nlm.nih.gov/18366423/
- McNeil, N.M., Jordan, N.C., Viegut, A.A., & Ansari, D. (2025). What the Science of Learning Teaches Us About Arithmetic Fluency. _Psychological Science in the Public Interest_, 26(1), 10–57. https://pubmed.ncbi.nlm.nih.gov/40297988/
- Hattie, J. & Timperley, H. (2007). The power of feedback. _Review of Educational Research_, 77(1), 81–112.
- Renkl, A. (1997). Learning from worked-out examples: A study on individual differences. _Cognitive Science_, 21(1), 1–29.
- Siegler, R.S. (2016). Strategy change. In _Routledge Handbook of Numerical Cognition_. Erikson Institute. https://www.erikson.edu/wp-content/uploads/2025/11/Siegler-draft-10_25_16.pdf
- Weiss, M.J. et al. (2018). A preliminary analysis of mastery criterion level: effects on response maintenance. _Behavior Modification_. PMC5843573. https://pmc.ncbi.nlm.nih.gov/articles/PMC5843573/
- Cowan, N. (2016). Working memory maturation. _Perspectives on Psychological Science_, 11(4), 512–534. https://journals.sagepub.com/doi/abs/10.1177/1745691615621279
- Kang, S.H.K. (2016). Spaced repetition promotes efficient and effective learning. _Policy Insights from the Behavioral and Brain Sciences_, 3(1), 12–19. https://journals.sagepub.com/doi/abs/10.1177/2372732215624708
- PMC8164994. Sleep and human cognitive development. https://pmc.ncbi.nlm.nih.gov/articles/PMC8164994/
- Nature Communications Psychology (2024). Children exhibit a developmental advantage in the offline processing of a learned motor sequence. https://www.nature.com/articles/s44271-024-00082-9
- Rapp, A. et al. (2023). Dark Patterns of Cuteness: Popular Learning App Design as a Risk to Children's Autonomy. Springer. https://link.springer.com/chapter/10.1007/978-3-031-46053-1_5
- Garon-Carrier, G. et al. (2016). Intrinsic motivation and achievement in mathematics in elementary school. _Child Development_. https://selfdeterminationtheory.org/wp-content/uploads/2016/11/2016_Garon-Carrier_etal_Child_Development.pdf
- Krashen, S. (1985). _The Input Hypothesis: Issues and Implications_. Longman.
- Zelazo, P.D. (2025). Executive Function: Implications for Education. IES/NCER.
