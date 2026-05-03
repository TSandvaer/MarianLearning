# CVC Words Feature — Developmental Psychology Review

**Date:** 2026-05-02
**Triggered by:** PR #135 shipped to production
**Audience:** Matt (ticket decisions), Kyle (design iteration), Kevin/Devon (implementation awareness)
**Scope:** Sanity-check of the cvc-words session as shipped. Not a redesign spec.

---

## 1. Word-Pool Appropriateness

**The pool shipped:** bag, bat, cat, fan, hat, jam, pan, van — all short-a CVC, all concrete, all 3 letters.

**Bottom line:** The all-short-a pool is developmentally correct for v1 but creates a ceiling problem that will arrive fast. Short-a CVC is Marian's emerging skill per the April 2026 diagnostic: she is _on the cusp_ of this level, not at a mastery plateau. Starting here is right. Staying here once mastery is reached is not.

The all-short-a constraint does two useful things in this first version:

1. It holds vowel knowledge constant so the new cognitive load — reading a word and matching its picture — can be the single focus. Cognitive load theory (Sweller, 1988; Paas et al. — see prior research note `phonics-sequence-marian.md`, source 11) argues for exactly this: when a new task format is introduced, reduce variability on other dimensions.
2. Marian's short-a phoneme is her most consolidated vowel. Success here builds confidence and establishes the match-word-to-picture format before she faces unfamiliar vowels.

The risk is equally clear: once she can read bag/bat/cat/fan/hat/jam/pan/van reliably, the sessions stop teaching. She will be scoring high not because she is decoding but because she has memorized which of three pictures appears with each familiar word. At a pool size of 8 with 3-chip choice, the answer set is small enough that incidental visual memory of chip positions and distractor combinations can substitute for reading entirely after a few dozen sessions.

**Recommendation for v2:** Add a short-o tier (dog, mop, top, log, hop, pot, box, fox) that unlocks once Marian hits the mastery threshold on the short-a pool. This is the next step in the vowel sequence established in `phonics-sequence-marian.md` (o → u → i → e). The first-time a short-o word appears, Emma introduces it — "This one says /ɒ/, like 'dog'" — before the match task. Pool expansion is the primary mechanism for keeping the cvc-words session pedagogically live beyond its first few weeks.

---

## 2. Distractor Policy — Phonetically Similar Chips

The current pool means that the 3-chip set will frequently include rhyme-family members: cat/bat/hat are all /-at/ words. When all three chips rhyme, the task reduces to distinguishing the onset (initial consonant).

**Is this beneficial or harmful?**

The evidence is moderately in favor of beneficial, with an important nuance.

Treiman (1983, 1985, 1986) — referenced in the Reading Rockets onset-rime literature — established that children segment spoken syllables into onset and rime before they segment into individual phonemes. Goswami (1990) extended this: children use rime-based analogy to decode new words even before explicit phonics instruction is complete. Teaching within a rime family (cat, bat, hat) leverages a cognitive grain size that is developmentally natural for a reader at Marian's level. Forcing attention to the onset — the single differing element when /at/ words are the distractors — is exactly the phonics skill that distinguishes /k/, /b/, /h/ at the beginning of words. That is a real reading skill.

The nuance: this is only true if Marian is _decoding the text_ to make her choice. If she is listening to Emma say "cat" and then picking the picture of the cat, onset discrimination is irrelevant — she is doing a listening task, not a reading task. The pedagogical value of similar distractors depends entirely on whether the text is driving the decision. See Section 3 for why this is the critical question.

A counter-concern worth naming: if all three chips rhyme and Marian is genuinely decoding, she will correctly identify onset differences most of the time (consonants are her strongest phonology per the diagnostic). But on the trials where she is tired or not fully attending, a slip — picking bat when the answer is cat — will look like a decoding error when it was actually just inattention to a one-letter difference. The 3-chip rhyme-family configuration is not harmful, but it will produce some noise in the accuracy data that does not reflect true reading competence.

**Recommendation:** No change to the distractor policy for v1. The rime-family configuration is educationally defensible and reflects natural reading development. If and when the pool expands to include short-o words, cross-vowel distractors (e.g., cat / mop / fan) should also be available — they test a different and slightly harder skill (vowel discrimination), which is appropriate once short-a is consolidated.

---

## 3. "Read the X" Prompt Format — The Audio-First Risk

**The design:** Emma reads "Read the cat." The text "cat" is also displayed. Marian taps a picture.

**The core concern:** If Marian listens to Emma say "cat" and then taps the picture of a cat, she has completed a listening comprehension task, not a reading task. The text becomes decorative. This is a genuine risk.

The Science of Reading literature — particularly Ehri's phase framework (Ehri, 2023, American Educator, "Phases of Development in Learning to Read and Spell Words"; also summarized at https://www.aft.org/ae/fall2023/ehri) — describes the full alphabetic phase as the stage where readers form connections between all graphemes in a spelling and the phonemes in the spoken word. Ehri describes orthographic mapping specifically as "deliberate connection-making between letters seen in a word's spelling and sounds detected in the word's pronunciation." This mapping is the engine of reading development. It does not happen when the child hears the word first and then looks at the picture — that sequence bypasses the mapping.

The risk is not catastrophic in v1. Marian is at an emerging-CVC stage, which means she likely needs some audio scaffolding to understand the task format. But if the audio-before-text sequence is the permanent design, the cvc-words track risks becoming a word-picture matching memory game rather than a phonics decoding exercise. Over repeated sessions, Marian can get very good at this task while her actual decoding of these specific words remains untested.

**The dual-modality benefit case is real but conditional.** The prior research note (source 15, Liu et al., _System_, 2022) found that combined phonics + vocabulary instruction produced better outcomes than phonics alone. Audio + text together can reinforce the sound-symbol connection — but only if the child is making the connection. If the audio makes the text redundant, the connection is not made.

**Recommendation:** This is a P1 design question for Kyle. The safest v2 intervention is a brief silent-text window: show the word for approximately 1–2 seconds before Emma reads it aloud. This window is short enough that it does not frustrate an 8-year-old but long enough to prompt a decoding attempt before confirmation. An alternative is to make Emma's reading of the word optional — a tap-Emma-to-hear mechanic — so that Marian can try independently first. This is not a blocking issue for v1 (the app is shipped; Marian is at an emerging-CVC stage where scaffolded audio is appropriate), but it should be iterated before the pool expands to new vowels, where she cannot rely on audio memory of familiar words.

---

## 4. Mastery Threshold — Is 90% Over 3 Sessions the Right Bar?

**Current threshold:** 90% across 3 sessions to graduate from cvc-words to digraphs.

**The floor problem:** With 8 items per session and a 3-chip forced-choice (33% baseline by random guessing), 90% accuracy = approximately 7.2 correct per session. The concern is not whether 90% is a rigorous criterion — it is — but whether the task format can distinguish _reading mastery_ from _item familiarity_.

At a pool of 8 words, Marian will have seen every word dozens of times by session 3. The 3-chip choice set is drawn from the same 8 words, so the distractors are also highly familiar. There is no mechanism in the current design that verifies generalization — the ability to decode a novel, previously unseen CVC word. Mastery of 8 known items in a forced-choice format is closer to recognition memory than to reading skill.

This matters for the graduation decision. Graduating to digraphs because Marian scores 90% on a 3-chip match task with 8 familiar words could place her in digraph territory before she can reliably decode unfamiliar short-a CVC words in the wild.

The research consensus (from the prior research note, source 11, Phonics Hero mastery literature, and source 12, UFLI Foundations) defines mastery as 90% accuracy but implicitly assumes that the item pool is large enough and varied enough that familiarity does not substitute for skill. With only 8 items total, the pool is almost certainly too small for the mastery criterion to be meaningful as a graduation gate.

**Recommendation:** Two options, either of which addresses the concern without requiring a full rebuild:

Option A (no new words): Add a generalization check before graduation. At session 3 or beyond, include 2–3 novel CVC words that Marian has not seen in the pool (e.g., nap, cap, rat from the extended short-a list in `phonics-sequence-marian.md`). She does not need to score 90% on these — 50% correct on 2 novel items is a reasonable generalization signal. These items are flagged as "challenge" and do not affect the main mastery score. This is a P1 ticket: small scope, high diagnostic value.

Option B (expand the pool): Extend the short-a word pool to 12–16 items drawn from the confirmed short-a list in `phonics-sequence-marian.md` (nap, cap, rat, mat, map, tap in addition to the current 8). Mastery over a 12-item rotating pool is a more genuine test of reading skill versus familiarity. This is slightly larger scope but also naturally addresses the ceiling problem in Section 1.

Do not raise the threshold to 95%/3 sessions without also expanding the pool. A higher threshold on the same 8 items is more noise-sensitive but not more skill-sensitive.

---

## 5. Anti-Dark-Pattern Audit

**Sparkle on every correct — is the density OK?**

The stardust mechanic as designed is completion-contingent per the design principles in CLAUDE.md, not exclusively correct-answer-contingent. The sparkle/plink on correct is a character reaction, not a currency signal. This is consistent with the Deci et al. (1999) meta-analysis recommendation (source 16 in `phonics-sequence-marian.md`): completion-contingent signals are safe; the character's warm reaction for correct answers does not undermine intrinsic motivation (Deci et al., 2001, source 18). This is fine as designed.

One density note: if sparkle fires on every one of 8 correct answers, Marian will receive 8 celebratory moments per session. That is a reasonable rhythm for a task she is just learning and where success builds confidence. If the pool becomes too easy (Section 1 ceiling problem), 8 sparkles per session with no difficulty signal will eventually feel hollow rather than meaningful. This is a future concern, not a v1 problem.

**8 problems with no pause point — right length?**

The 2-minutes-per-year-of-age attention rule (cited in practitioner literature, e.g., Brain Balance Centers; Cowan, 2001 working-memory research underlies this) gives Marian approximately 16–24 minutes of focused attention on a structured task. Eight CVC matching problems, where each problem is a listen + read + tap sequence, takes approximately 2–4 minutes depending on her reading pace. This is well within her attention window. The length is appropriate.

Importantly, the cvc-words task has lower cognitive load than, say, 8 math addition problems, because the task format is consistent across items (same 3-chip format every time) and the word pool is familiar. Lower load means less fatigue per item. 8 problems is fine.

**SessionEnd "Pick again?" CTA — appropriate after a cognitively demanding reading session?**

Kyle's anti-dark-pattern wording — framing the next session as optional rather than implied — is the right approach for an 8-year-old learner. "Pick again?" does not exploit FOMO or urgency. The concern here is mild: after a successful session where she scored 8/8 on familiar words, the wording may feel so low-stakes that she always picks again, accumulating sessions that do not challenge her. The mastery-graduation mechanism (Section 4) is the real protection here — once she is genuinely ready to advance, the system should advance her rather than keep her in the comfortable pool. The CTA wording itself is fine.

**Other dark-pattern flags: none.** The "puzzled tilt + soft poof" on wrong answers, no red X, no streak shame — all of these are aligned with the CLAUDE.md invariants and with the motivation research. The design is clean on dark-pattern risks.

---

## 6. Recommendations and Priorities

### P0 — Must address before Marian's sustained August-prep use

**P0: Pool expansion plan must exist before the pool becomes trivial.**
The current 8-word all-short-a pool will be mastered (or over-familiar) within a few weeks of regular use. The graduation mechanism to short-o words must be designed and ticketed now, before Marian has repeated sessions on a pool she can navigate from memory rather than decoding. The exact schedule depends on her session frequency, but with daily or near-daily use, the ceiling arrives within 3–5 weeks. This is not a code blocker today — the feature shipped correctly — but the roadmap gap is a P0 risk for the August goal.

### P1 — Worth iterating before the pool expands to new vowels

**P1: Silent-text window before Emma reads the word.**
The audio-before-text design (Section 3) risks converting a decoding task into a listening task. A 1–2 second silent display of the word before Emma reads it aloud is the minimal intervention that preserves the decoding opportunity. This should be in place before short-o words are added, because Marian does not have audio memory of those words and will need to decode. If audio-first is the scaffold for short-a (familiar words), it becomes the crutch for short-o (unfamiliar words).

**P1: Generalization check before mastery graduation.**
Include 2–3 novel short-a words in the "graduation" session to verify that Marian's high score reflects decoding skill rather than item familiarity (Section 4). This is a small scope change to the session planner prompt and the mastery evaluation logic.

### P2 — Nice-to-have, future scope

**P2: Cross-vowel distractors when the pool expands.**
Once short-o words are available, some 3-chip sets should include cross-vowel distractors (cat / mop / fan) rather than always drawing from a single vowel family. This tests vowel discrimination, which is the next phonics skill after onset discrimination, and prevents the distractor configuration from becoming too predictable. Low priority because it only matters after pool expansion.

---

## Citations Referenced

| Source                          | Citation                                                                                                                                                                                                                                | Strength                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Ehri 2023                       | Ehri, L.C. "Phases of Development in Learning to Read and Spell Words." _American Educator_, Fall 2023. https://www.aft.org/ae/fall2023/ehri                                                                                            | Strong (foundational theory, widely replicated)   |
| Treiman 1983–1986               | Treiman, R. (1983, 1985, 1986). Onset-rime segmentation research. Summarized at Reading Rockets: https://www.readingrockets.org/classroom/classroom-strategies/onset-rime-games                                                         | Strong (multiple studies, widely replicated)      |
| Goswami 1990                    | Goswami, U. (1990). Phonological skills, analogies, and reading development. Summarized at https://rimemagic.com/onsetrime-research/                                                                                                    | Strong (experimental; independently replicated)   |
| Deci et al. 1999                | Deci, E.L., Koestner, R., & Ryan, R.M. "A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation." _Psychological Bulletin_, 125(6), 627–668. https://pubmed.ncbi.nlm.nih.gov/10589297/ | Strong (meta-analysis of 128 studies)             |
| Deci et al. 2001                | Deci, Koestner & Ryan. "Extrinsic Rewards and Intrinsic Motivation in Education: Reconsidered Once Again." _Review of Educational Research_, 71(1). https://journals.sagepub.com/doi/10.3102/00346543071001001                          | Strong (follow-up synthesis)                      |
| Cowan 2001                      | Cowan, N. "The magical number 4 in short-term memory." _Behavioral and Brain Sciences_, 24(1). PMC4270959. Working-memory capacity at age 8: approximately 4–5 chunks.                                                                  | Strong (widely cited; relevant to session length) |
| Liu et al. 2022                 | Liu et al. "Effects of phonics instruction on L2 phonological decoding and vocabulary learning." _System_. https://www.sciencedirect.com/science/article/abs/pii/S0346251X21002311                                                      | Strong (experimental, peer-reviewed)              |
| Phonics-sequence prior research | `design/research/phonics-sequence-marian.md` — full citations for mastery threshold (Phonics Hero, UFLI), ELL pacing (Cardenas-Hagan/Brookes), picture-pairing (Colorín Colorado, Really Great Reading)                                 | See that document                                 |

---

_Practitioner attention-span rule: Brain Balance Centers (https://www.brainbalancecenters.com/blog/normal-attention-span-expectations-by-age) and CNLD Neuropsychology (https://www.cnld.org/how-long-should-a-childs-attention-span-be/). Framed as practitioner consensus; underlying source is clinical observation, not a single RCT._
