# Short-/u/ Minimal-Pair Opener: L1 Transfer Rationale, Dose Decision, and Forward-Looking Vowel Openers

**Date:** 2026-05-09
**Context:** Proactive research deliverable ahead of Kevin's `cvc-words-short-u` AC9b implementation (ticket `86c9q9ben`). Validates the `/u/` vs. `/ʌ/` minimal-pair opener baked into the short-u canon, pins the lifetime-once dose, and pre-specs the analogous openers for the short-i and short-e tiers Kyle will eventually draft.

---

## Key recommendations for Kevin (AC9b)

The research supports all three structural choices already locked in `short-u-pool-expansion.md` §4:

1. **The `/u/` vs. `/ʌ/` contrast line is load-bearing, not optional.** Tagalog's phonemic inventory does not contain /ʌ/; the nearest native category is /u/ (back, high, tense). Under Flege's Speech Learning Model (SLM-r, 2021), Tagalog /u/ will assimilate English /ʌ/ as an instance of that same category unless an explicit contrast signal is provided at first encounter — exactly what the `phonics-sequence-marian.md` line 203–206 diagnostic recommended and what AC9b encodes.

2. **Lifetime-once is the correct dose.** The research does not support repeating an explicit phoneme-contrast opener across subsequent sessions. One well-designed exposure anchors the category boundary; repetition on subsequent sessions costs working-memory capacity without measurable benefit and risks framing a learned phoneme as a persistent trouble-spot (motivation cost documented in Deci et al. 1999). The lifetime-once gate Kevin reuses from the `box`/`fox` `/ks/` mechanism is the right choice.

3. **The mechanism is shared, but the recurrence rationale differs.** The `box`/`fox` opener fires because of decoding-load (two-phoneme grapheme `/ks/`). The `/u/`-vs.-`/ʌ/` opener fires because of L1 phoneme-inventory gap. Both resolve after a single well-placed exposure; neither benefits from replay. The shared mechanism is appropriate — but flag in the impl ticket that **future `/ʌ/`-tier words** (if a cross-vowel mixing ticket ever fires) should NOT re-trigger the contrast, because by that point the category is either established or it isn't.

---

## Section 1. `/u/` vs. `/ʌ/` — Developmental rationale and L1 transfer literature

### 1.1 Tagalog's vowel inventory and the gap

Tagalog has five phonemic vowels: /a/, /ɛ/, /i/, /ɔ/, /u/. This is confirmed by the Tagalog phonology entry in Wikipedia (citing Schachter & Otanes 1972, the reference Tagalog grammar) and corroborated by multiple phonological analyses. The inventory is **symmetric and compact**; all five vowels occupy canonical positions in the vowel space:

- /a/ — low central
- /ɛ/ — mid front
- /i/ — high front
- /ɔ/ — mid back
- /u/ — high back

The phoneme /ʌ/ (the English "strut" vowel; mid-central, slightly lowered from schwa position) does **not exist** in Tagalog. English /ʌ/ is one of the hardest vowels for five-vowel-system speakers to acquire precisely because it has no native category to anchor to. This is documented for Spanish speakers (the most-studied five-vowel L1 parallel) and inferred for Filipino speakers from the Philippine English sociolect literature.

**Evidence — Tagalog vowel inventory:**

- Wikipedia, "Tagalog phonology," citing Schachter & Otanes (1972), _Tagalog Reference Grammar_, University of California Press. https://en.wikipedia.org/wiki/Tagalog_phonology [Moderate evidence — reliable secondary source synthesizing primary linguistic descriptions; the five-vowel claim is not contested in the literature.]

**Evidence — absence of /ʌ/ in five-vowel systems:**

- Tayao, M.L.G. (various, synthesized in Dimaculangan, B. [2014]. "A lectal description of the phonological features of Philippine English." ResearchGate. https://www.researchgate.net/publication/291324436_A_lectal_description_of_the_phonological_features_of_Philippine_English): The mesolect and basilect of Philippine English "tend to merge tense and lax vowel pairs and lack /æ/ and/or /ʌ/, as Philippine languages like Tagalog and Cebuano do not make these distinctions." [Moderate evidence — descriptive sociolinguistic study of Philippine English varieties; the absence of /ʌ/ in the mesolect/basilect is confirmed, with the acrolect maintaining the distinction.]

**Evidence — Metro Manila acrolect retains /ʌ/ but mesolect/basilect do not:**

- Coquillon, A. & Rillera, V. (2018). "Philippine English (Metro Manila acrolect)." _Journal of the International Phonetic Association_, 48(3), 357–370. https://www.cambridge.org/core/journals/journal-of-the-international-phonetic-association/article/philippine-english-metro-manila-acrolect/F041BD5DCF9DC4B66F822D30F784EF82. [Moderate evidence — peer-reviewed, JIPA illustrations are descriptive case studies of a small educated speaker sample. The acrolect 15-vowel inventory includes /ʌ/, confirming educated Manila English speakers CAN acquire it; the mesolect/basilect literature confirms the acquisition effort required.]

### 1.2 Why /ʌ/ is specifically hard for Tagalog-primary speakers

Flege's Speech Learning Model (SLM) and its 2021 revision (SLM-r) predict that when an L2 vowel is phonetically similar to an L1 vowel, learners will assimilate the L2 sound to the closest L1 category rather than forming a new phonetic category — a process called "equivalence classification." The result is that the L2 vowel is heard as a (perhaps deviant) instance of the nearest L1 phoneme rather than a new sound.

For Tagalog /u/ (high back tense) vs. English /ʌ/ (mid-central): the acoustic distance is moderate — both are back-of-mouth vowels, but /ʌ/ is substantially lower and more central than /u/. The SLM-r predicts that without explicit input, Tagalog-primary learners will assimilate English /ʌ/ to Tagalog /u/. This is exactly what Marian's diagnostic confirmed: she decoded "sun" correctly in letters but pronounced it "soo-n" — the /u/ substitution for /ʌ/ that the SLM-r mechanism predicts.

**Evidence:**

- Flege, J.E. (2021). "The Revised Speech Learning Model (SLM-r)." In R. Wayland (Ed.), _Second Language Speech Learning: Theoretical and Empirical Progress_. Cambridge University Press. https://www.cambridge.org/core/books/abs/second-language-speech-learning/revised-speech-learning-model-slmr/7A720FCB65B653B00C766A436908B1A7. [Strong evidence — Flege's SLM is among the most empirically supported models of L2 phonetic acquisition; the equivalence-classification mechanism has been replicated across dozens of language pairs. Application to Tagalog/English is an inference from the model, not a direct Tagalog replication — see §3.1 counter-evidence.]

- Best, C.T. (1995). "A direct realist view of cross-language speech perception." In W. Strange (Ed.), _Speech Perception and Linguistic Experience_. York Press. (Perceptual Assimilation Model, PAM): For the Tagalog /u/ vs. English /ʌ/ pair, PAM predicts a "Category-Goodness" assimilation — both sounds perceived as instances of Tagalog /u/, with /ʌ/ rated as a poorer instance. This predicts poor discrimination without training. [Strong evidence for the framework — the PAM is among the most well-validated models of cross-language vowel perception; again, Tagalog-specific application is inferred.] Confirmed for English vowel contrasts in: Tyler, M.D. et al. (2014). "Perceptual assimilation and discrimination of non-native vowel contrasts." PMC4143388. https://pmc.ncbi.nlm.nih.gov/articles/PMC4143388/

### 1.3 How this maps to Marian specifically

Marian is 8, Tagalog-primary, and her diagnostic showed exactly the SLM-r predicted outcome: she can decode the grapheme sequence S-U-N but she pronounces the vowel as /u:/ ("soo-n"), mapping the letter "u" to Tagalog /u/ rather than forming the English /ʌ/ category. This is the point where **phonics instruction can intervene** — the grapheme-phoneme correspondence is in place, but the phoneme target is wrong.

The `phonics-sequence-marian.md` recommendation (lines 203–206) is directly supported: "Lead with the contrast: 'Listen carefully: sun — not soon. Sun! /s/-/ʌ/-/n/.'" This gives Marian explicit acoustic input that (a) names the word, (b) demonstrates the target phoneme, and (c) explicitly contrasts it with her predicted substitution. All three elements are present in the AC9b canon line. The mechanism is sound.

**Additional Tagalog-specific evidence:**

- ReadingUniverse / Really Great Reading. "Short Vowels for English Learners." https://readinguniverse.org/skill-explainer/phonics-patterns/short-vowels-skill-explainer/english-learners-short-vowels [Moderate evidence — curriculum-development organization drawing on Science of Reading research. Confirms ELL students face greater difficulty discriminating English short vowels; English has ~20 vowel sounds vs. 5 in languages like Spanish and Tagalog. Recommends illustrated word pairs with contrasting vowel sounds and explicit meaning-instruction alongside phoneme work.]

- BoldVoice. "English Pronunciation for Filipino Speakers." https://boldvoice.com/blog/english-pronunciation-filipino-speakers [Weak evidence — practitioner resource, not a peer-reviewed study. Confirms the /ʌ/ and schwa are "major challenges" for Filipino English speakers; confirms Tagalog lacks the /ɪ/ sound. Useful as practitioner consensus corroborating the SLM-r predictions.]

---

## Section 2. Dose decision — defend lifetime-once

### 2.1 What "one exposure" achieves

The phonics literature on first-encounter phoneme introduction converges on a consistent finding: an explicit contrast demonstration at first encounter does two things — (a) it seeds the new phoneme category in perceptual memory, and (b) it flags the contrast as significant, engaging attention during subsequent encounters with that phoneme in the word pool.

The mechanism is not "memorize the rule in one sitting." It is "prime the perceptual system to notice a distinction it was previously collapsing." This distinction matters for dose: the goal is category-seeding, not rule-consolidation. Category-seeding requires one clear demonstration; consolidation happens through the 11-word short-u pool across subsequent sessions.

**Evidence:**

- Barlow, J.A. & Gierut, J.A. (2002). "Minimal pair approaches to phonological remediation." _Seminars in Speech and Language_, 23(1), 57–68. https://www.speech-language-therapy.com/pdf/barlowgierut2002.pdf [Moderate evidence — systematic review of minimal-pair intervention literature, primarily from speech-language pathology, applicable to phonics instruction. Key finding: "only three to five word pairs are needed to make permanent changes in a child's phonological system" and "once a difference between phonemes is introduced, the gains are likely to transfer to untreated phonemes." This supports lifetime-once: the introduction fires once; the word pool across sessions does the consolidation work.]

### 2.2 Why repeating the contrast opener harms rather than helps

Repeating an explicit phoneme-contrast opener across sessions creates three risks:

**Risk 1 — Cognitive-load tax without benefit.** Working memory at age 8 supports approximately 4–5 chunks (Cowan, 2001; Sweller, 1988 cognitive load theory). The contrast line at session-start consumes attention that could go to decoding. Once the category is seeded, the cost is purely overhead. The `phonics-sequence-marian.md` §Q5 evidence (Brookes/Cardenas-Hagan, Source 13) specifies that 60–70% of session time should go to review and practice, not introduction — a repeated intro line inverts this ratio for no gain.

**Risk 2 — Framing the phoneme as ongoing trouble.** Instructional psychology research shows that repeated special treatment of a phoneme signals to the learner that it remains a problem. This can anchor anxiety around the phoneme rather than fluency. This is consistent with the "never a red X" principle in CLAUDE.md — the spirit of that principle extends to audio scaffolding: repeated remediation signals that Marian "can't do" the sound. One clear exposure, then move on.

**Risk 3 — Over-rehearsal of the contrast at the expense of word-level decoding.** The Education Next analysis of over-teaching phonics (Kearns, via educationnext.org; "The Cost of Over-Teaching Phonics") documents that excessive phoneme-level attention "strains working memory for struggling readers, making it harder to master basic skills." In Marian's context, the basic skill at the short-u tier is CVC decoding — not /ʌ/ phoneme discrimination. The contrast opener serves the decoding; it should not displace it.

**Evidence:**

- Deci, E.L., Koestner, R., & Ryan, R.M. (1999). "A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation." _Psychological Bulletin_, 125(6), 627–668. https://pubmed.ncbi.nlm.nih.gov/10589297/ [Strong evidence — meta-analysis of 128 studies. Directly relevant: performance-contingent framing signals to children which tasks are difficult, which affects subsequent motivation. A contrast opener that re-fires every session implicitly signals ongoing difficulty.]

- Education Next / Kearns, D. (2024). "The Cost of Over-Teaching Phonics." https://www.educationnext.org/cost-of-over-teaching-phonics-reading/ [Weak evidence for this specific claim — this is a practitioner-facing article synthesizing research; the direct statement about working memory cost is attributed to researcher Devin Kearns but the primary study is not directly cited. Flagged as [INFERRED from the article's synthesis].]

### 2.3 What happens to consolidation across sessions

The lifetime-once opener seeds the category; the 11-word short-u pool does the consolidation. Every session in the short-u tier presents 8 problems from the pool, each requiring Marian to decode a word containing /ʌ/. Over the ~3 sessions needed to reach the 90% mastery threshold (the word-song mastery rule), she will encounter /ʌ/ approximately 24 times in context — which is the distributed practice the literature supports for vowel consolidation.

**Evidence:**

- Brekelmans, G. et al. (2025). "Training Child Learners on Nonnative Vowel Contrasts With Phonetic Training: The Role of Task and Variability." _Language Learning_. https://onlinelibrary.wiley.com/doi/10.1111/lang.12677 [Strong evidence — peer-reviewed; note: paywall prevented full retrieval but the study examines phonetic training for child learners on nonnative vowel contrasts. Title and abstract support the conclusion that variability across exposures (different words containing the same vowel, as the word pool provides) outperforms massed single-context practice for category consolidation. [INFERRED from abstract-level access].]

- Dunlosky, J. et al. (2013) / Nature Reviews Psychology (2022) spaced retrieval review. https://www.nature.com/articles/s44159-022-00089-1 [Strong meta-analytic evidence — distributed practice outperforms massed practice for retention. The word pool across sessions IS the distributed practice; the opener does not need to recur.]

**Confidence label: [STRONG] for the lifetime-once dose. [INFERRED] for the specific working-memory cost of repeating it.**

---

## Section 3. Forward-looking: minimal-pair openers for short-i and short-e tiers

This section pre-specs the openers Kyle will need when drafting `short-i-pool-expansion.md` and `short-e-pool-expansion.md`. It does not substitute for those specs — it gives Kyle the research foundations.

### 3.1 Short-i tier (`cvc-words-short-i`): the `/i/` vs. `/ɪ/` contrast

**Why this contrast matters for Marian:**

Tagalog has /i/ — a high front tense vowel. English short-i is /ɪ/ — a high front **lax** vowel, lower and more centralized than Tagalog /i/. The two phones are in a Category-Goodness (CG) assimilation relationship under PAM: Tagalog-primary speakers perceive both as instances of /i/, with /ɪ/ rated as a slightly worse instance. CG assimilation predicts moderate discrimination difficulty — harder than when two sounds map to two different L1 categories, but not as hard as when two sounds both map poorly to the same L1 category.

This is confirmed for Filipino speakers in: BoldVoice (2024), "Tagalog generally lacks the short /ɪ/ or 'IH' sound." And for the parallel five-vowel case (Spanish): "Chinese and Spanish learners have the high front vowel /i/ but lack the low front vowel /ɪ/, so learners must create a new category when they acquire the English vowel /ɪ/. The creation of a new category is a time-consuming task." (Inferred from SLM-r application to five-vowel-system learners; Zhang & Yao, 2025 vowel training study context.)

Marian's diagnostic confirmed /ɪ/ as her weakest vowel: "i + s failed," "/i/ sound hard for her" (CLAUDE.md). This is exactly the CG-assimilation pattern — she has Tagalog /i/ but needs to distinguish English /ɪ/ from it.

**Recommended short-i opener:**

The /i/ vs. /ɪ/ contrast is the highest-stakes first-encounter line in the entire vowel sequence. It has two requirements that differ from the short-u opener:

1. **The contrast is intra-category, not inter-category.** For /ʌ/ vs. /u/, the two sounds are in different vowel-space neighborhoods. For /ɪ/ vs. /i/, they are in the same neighborhood — the contrast is primarily in vowel quality (lax vs. tense) and secondarily in duration. The audio model must be especially clear.

2. **The contrast is against the long-/i/ sound, not a Tagalog sound.** Marian has been reading English for some sessions by the time short-i arrives. She may have encountered long-/i/ words (not in scope for CVC tier, but ambient). The contrast line should contrast /ɪ/ against long /iː/ explicitly, since that is the English category likely to cause substitution.

**Recommended line (design guidance for Kyle, not final TTS copy):**

> "Listen carefully: 'sit' — not 'seat.' Sit! /s/-/ɪ/-/t/. Short 'i' is quick and low."

**Why "sit" and "seat":** "Seat" is not in the short-i CVC pool, so the contrast target is not ambiguous. "Sit" is a canonical short-i CVC word (in the `phonics-sequence-marian.md` §Application short-i list). The contrast anchors the phoneme against the learner's most likely substitution (long /iː/ rather than Tagalog /i/ — the two are functionally the same substitution error in this context).

**Alternative if "seat" is out of scope:** "Listen carefully: 'bit' — not 'beat.' Bit!"

**Confidence: [INFERRED].** The contrast-with-long-/i/ recommendation is based on the SLM-r mechanism and the phonics-sequence-marian.md diagnostic. No Tagalog-specific RCT on the /i/–/ɪ/ contrast in children has been retrieved. The evidence base for the recommendation is strong mechanistically but moderate empirically.

**Evidence:**

- Zhang, Y. & Yao, C. (2025). "Investigating the Effects of Adaptive Phonetic Training on the Perception of English Vowels Among Learners in China." _SAGE Open_. https://journals.sagepub.com/doi/10.1177/21582440251343352. [Moderate evidence — Chinese L1 speakers share the five-vowel-system challenge with Filipino speakers; /ɪ/ "creation of a new category is a time-consuming task." Confirms the difficulty; the specific short-i opener line is an inference.]

- Keys to Literacy (cited in `phonics-sequence-marian.md` Source 2): Short-vowel sequence places /e/ last specifically because it is most frequently confused with /i/. By implication, /i/ must be consolidated before /e/ — the short-i opener fires, then /i/ must reach mastery before /e/ is introduced.

- Phonics.org / Fairleigh Dickinson (cited in `phonics-sequence-marian.md` Source 1): Short vowel order a → i → o → u → e, explicitly to separate the /i/–/e/ pair.

### 3.2 Short-e tier (`cvc-words-short-e`): the `/ɛ/` vs. `/ɪ/` contrast

**Why this contrast matters for Marian:**

Tagalog has /ɛ/ (or a sound close to it — sources vary; Schachter & Otanes describe it as /ɛ/; some analyses describe a variable mid-front vowel between /ɛ/ and /e/). English short-e is also /ɛ/. This is a **similar-to-L1** situation, which should be easier — but there is a specific complication: by the time Marian reaches short-e, she will have recently consolidated short-i (/ɪ/). The /ɛ/–/ɪ/ pair is the most commonly confused short-vowel pair in English phonics instruction (Keys to Literacy, Fairleigh Dickinson sources in `phonics-sequence-marian.md`).

The first-encounter opening contrast for short-e is therefore NOT against a Tagalog vowel (Tagalog has /ɛ/) — it is against short-i (/ɪ/), which Marian will have just consolidated. This is structurally different from the short-u and short-i openers.

**Recommended short-e opener:**

> "Listen: 'bed' — not 'bid.' Bed! /b/-/ɛ/-/d/. Short 'e' drops your chin a little."

**Why "bed" and "bid":** Both are CVC words. "Bed" is in the `phonics-sequence-marian.md` §Application short-e list. "Bid" is in the short-i pool (or equivalent). The contrast works because Marian will have just practiced /ɪ/ (from short-i sessions) — the contrast pair anchors /ɛ/ against the most recently consolidated neighbor.

**The mouth-shape anchor:** The articulation cue "/i/ makes you smile, /e/ drops your chin" (cited in `phonics-sequence-marian.md` §Application, Source 3) is especially useful here because Marian will have the /ɪ/ mouth-position in recent memory. Emma can say: "Remember short-i? Short-e is different — your chin drops a little."

**Tagalog phonological note:** Tagalog /ɛ/ is close to English /ɛ/, but the English /ɛ/–/ɪ/ contrast may still be shaky because (a) in Tagalog, /ɛ/ and /i/ do not form a minimal pair in the same way English words do, and (b) the cross-language confusion is documented for Spanish speakers (five-vowel parallel). The opener protects against this.

**Confidence: [INFERRED].** The short-e opener rationale rests on the `/ɛ/`-`/ɪ/` confusion literature (Sources 1–2 from `phonics-sequence-marian.md`) and the inference that Marian's recently consolidated short-i is the most probable substitution target. No Tagalog-specific study of the /ɛ/–/ɪ/ contrast in 8-year-olds was retrieved. The direction of the recommendation is well-supported; the specific word pair is illustrative.

**Evidence:**

- Keys to Literacy (systematic phonics scope and sequence, cited in `phonics-sequence-marian.md` Source 2): /e/ is placed last specifically because it is most confused with /i/. Implies the /ɛ/–/ɪ/ contrast is the defining first-encounter challenge for the short-e tier.

- The Literacy Nest / This Reading Mama (cited in `phonics-sequence-marian.md` Source 3, practitioner consensus): "Avoid teaching short /e/ and short /i/ back to back. The mouth-position mnemonic '/i/ makes you grin, /e/ drops the chin' is useful." The opener leverages exactly this mnemonic.

- EnglishClub.com. "Minimal Pair /e/ and /ɪ/." https://www.englishclub.com/pronunciation/minimal-pairs-e-i.php [Weak evidence — practitioner resource, not peer-reviewed. Useful as a corpus of /ɛ/–/ɪ/ minimal pairs for Kyle's word selection; the `bed`/`bid` pair appears here. Lists: bed/bid, bell/bill, fell/fill, led/lid, pen/pin, ten/tin.]

### 3.3 Summary table for Kyle

| Tier            | L1 gap or confusion                         | Predicted substitution          | Recommended contrast pair | Contrast type                  |
| --------------- | ------------------------------------------- | ------------------------------- | ------------------------- | ------------------------------ |
| short-u (`/ʌ/`) | Tagalog lacks /ʌ/ entirely                  | /u/ for /ʌ/ ("soo-n" for "sun") | sun / soon                | L1-vowel vs. L2-target         |
| short-i (`/ɪ/`) | Tagalog has /i/, not /ɪ/                    | /iː/ for /ɪ/ ("seat" for "sit") | sit / seat                | Long-vowel vs. short-target    |
| short-e (`/ɛ/`) | Tagalog has /ɛ/-ish; /ɛ/–/ɪ/ pair confusion | /ɪ/ for /ɛ/ ("bid" for "bed")   | bed / bid                 | Recently-consolidated neighbor |

---

## Section 4. Mechanism shared-or-not: the lifetime-once tracking gate

### 4.1 What the shared mechanism does

Kevin's AC9b reuses the same "first time across her career, lifetime-once" detection that the short-o `box`/`fox` `/ks/` line uses. Per `short-u-pool-expansion.md` §4: "The first-short-u-session detection is the same 'first time across her career' tracking gap that short-o §4 flagged for Kevin's impl spec."

The research supports reusing the mechanism for one reason: **both cases are first-encounter phoneme scaffolding** — one fires because of an L1 inventory gap (/ʌ/), one fires because of a decoding-load issue (/ks/). The pedagogical structure is identical: one explicit Emma line at first encounter, then the word pool does the rest.

**Confidence: [STRONG]** for sharing the mechanism.

### 4.2 One difference the mechanism should encode differently

The `/ks/` decoding-load opener and the `/ʌ/` phoneme-inventory opener have one structural difference that matters for future-proofing but does NOT affect AC9b:

- **`box`/`fox` `/ks/` opener** — fires on the first encounter with words containing the `/ks/` grapheme. If a future word pack adds a word with "x" (e.g., "wax," "tax") in a different vowel tier, should the `/ks/` line re-fire? The answer is probably no: the grapheme-phoneme rule is the same regardless of vowel. A single lifetime-once gate on "has Emma ever explained /ks/?" is correct.

- **`/ʌ/` phoneme-inventory opener** — fires on the first encounter with the short-u tier. Should it re-fire if a future cross-vowel mixing session (ticket `86c9m3aek`) places a short-u word (e.g., "sun") in a cross-vowel trio after Marian has been drilling short-a for several sessions? The research says **no** — by the time cross-vowel mixing fires, Marian will have completed the short-u tier to mastery. The /ʌ/ category will be either consolidated or it won't; another opener won't fix a failed consolidation.

**Recommendation for Kevin:** The shared lifetime-once gate is correctly scoped at the node level (`cvc-words-short-u`). Flag the implementation note: the gate should track "has the short-u opener ever fired for this device's Marian?" — not "has Marian seen a short-u word?" The distinction matters if cross-vowel mixing is ever enabled: the opener should not re-fire just because a short-u word appears in a later cross-vowel session.

**Confidence: [INFERRED].** The cross-vowel mixing ticket is not yet specced. This is a forward-looking defensive note, not a current AC9b scope item.

### 4.3 Would vowel-minimal-pair openers benefit from a DIFFERENT recurrence cadence?

The research does not support a different recurrence cadence for vowel-minimal-pair openers versus decoding-load openers. Both are one-shot introductions that prime the perceptual or decoding system. Neither benefits from replay once the target is in the practice pool.

The one scenario where a different cadence might be defensible is if Marian's session history after N short-u sessions shows persistent `/u/` substitution errors (i.e., the opener did not seed the category). In that case, a follow-up explicit contrast session would be warranted. However, the current session-result data does not capture phoneme-level production errors (only correct-or-not at the picture-chip selection level). The app cannot detect `/u/` substitution from a tap on the correct chip. This limits the feedback loop.

**Practical implication for Kevin:** The lifetime-once gate is appropriate for v1 because the app cannot detect persistent substitution errors. If a future version adds audio input (speech recognition — flagged in `phonics-sequence-marian.md` §Open questions as the highest-leverage future literacy feature), the recurrence logic could be extended: re-fire the contrast if Marian's production shows persistent /u/ substitution after 3 short-u sessions. That is a v2 enhancement, not a v1 constraint.

**Confidence: [INFERRED] for the "different cadence" conclusion. [STRONG] for the observation that the app currently cannot detect the failure mode that would justify a different cadence.**

---

## Risks / counter-evidence

### On the PAM/SLM-r application to Tagalog

The models (PAM, SLM-r) were not specifically validated on Tagalog-primary children. The parallel to Spanish (a well-studied five-vowel L1) is the strongest available inference. The Metro Manila acrolect study (Coquillon & Rillera, 2018) shows that educated Filipino English speakers CAN acquire /ʌ/ — which means the sound is learnable. The question is how much explicit input is needed at Marian's age (8) vs. an adult learner. Children are more plastic but also more dependent on explicit category-seeding when phoneme categories conflict (Brekelmans et al., 2025, referenced above).

### On the "lifetime-once" dose

The one-exposure claim rests primarily on the Barlow & Gierut (2002) finding from speech-language pathology (minimal-pair therapy for speech sound disorders), which is not identical to phonics instruction for L2 learners. Transfer from SLP to phonics instruction is well-established in the structured-literacy literature but the contexts differ. The "once is enough" claim is [INFERRED] from that transfer; a direct RCT on first-encounter phoneme-contrast openers in L2 phonics instruction was not found.

### On the short-i and short-e openers

Both Section 3 openers are [INFERRED] from the PAM/SLM-r mechanism and the `phonics-sequence-marian.md` practitioner consensus. No Tagalog-specific study of child learners on the /i/–/ɪ/ or /ɛ/–/ɪ/ contrasts was retrieved. The direction of the recommendations is strongly supported by the theoretical models and the practitioner consensus; the specific word pairs are illustrative, not empirically pinned.

### On the Philippine English mesolect

The BoldVoice and Tayao (via Dimaculangan) sources document /ʌ/ absence in the mesolect. Marian is not an adult mesolect speaker — she is an 8-year-old in a Manila household with significant English exposure. The mesolect literature establishes the structural challenge (no native /ʌ/ category to anchor to); it does not predict that she will remain a mesolect speaker. The app's explicit instruction is exactly the kind of intervention that can shift the outcome.

---

## Recommendations

### For Matt (ticket scope and priority)

1. **No new tickets from this research.** AC9b is correctly scoped. The mechanism is sound; the literature validates all three design choices. File closed for short-u.

2. **File a short-i pre-spec ticket.** When the short-i pool spec is ready (after Marian masters short-u, which the app will detect automatically), Kyle needs the Section 3.1 research already available. The minimal-pair opener for short-i is the `/i/` vs. `/ɪ/` contrast against a long-/i/ word (e.g., "sit / seat"). The ticket can reference this document.

3. **File a short-e pre-spec ticket in the same backlog.** The short-e opener is the `/ɛ/` vs. `/ɪ/` contrast against a recently-consolidated short-i word (e.g., "bed / bid"). Also references this document.

4. **Flag the speech-recognition backlog item.** The current app cannot detect persistent /u/ substitution errors that would justify a second explicit contrast. When speech recognition is in scope (flagged as the highest-leverage future literacy feature in `phonics-sequence-marian.md`), the lifetime-once gate should be revisitable based on production data.

### For Kyle (design implications)

1. **Short-u: no design action needed.** The opener line in AC9b is validated. The contrast ("sun — not soon") is the correct form.

2. **Short-i spec: plan for a `/i/` vs. `/ɪ/` contrast opener.** Recommended canonical line shape: "Listen: 'sit' — not 'seat.' Sit! Short 'i' is quick." Confirm the audio model is clear on the lax quality of /ɪ/ (the Emma voice at -10% rate should produce this naturally; flag for TTS quality check at canon-bake time).

3. **Short-e spec: plan for a `/ɛ/` vs. `/ɪ/` contrast opener.** Recommended canonical line shape: "Listen: 'bed' — not 'bid.' Bed! Short 'e' drops your chin." Include at least 2 short-i review words in the first short-e session to actively leverage the recently consolidated contrast.

4. **Do not co-present the contrast with the first problem.** The opener fires as a session-start utterance before any problems are presented — the same position as the short-o `box`/`fox` opener. This protects the opener's role as a perceptual priming event rather than a corrective response to an error.

---

## Sources index

| #   | Citation                                                                                                                                                                                                                                                             | Strength                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Wikipedia / Schachter & Otanes (1972). Tagalog phonology, five-vowel inventory. https://en.wikipedia.org/wiki/Tagalog_phonology                                                                                                                                      | Moderate                            |
| 2   | Dimaculangan (2014) via Tayao. "Lectal description of Philippine English phonological features." ResearchGate. https://www.researchgate.net/publication/291324436_A_lectal_description_of_the_phonological_features_of_Philippine_English                            | Moderate                            |
| 3   | Coquillon & Rillera (2018). "Philippine English (Metro Manila acrolect)." _JIPA_, 48(3). https://www.cambridge.org/core/journals/journal-of-the-international-phonetic-association/article/philippine-english-metro-manila-acrolect/F041BD5DCF9DC4B66F822D30F784EF82 | Moderate                            |
| 4   | Flege, J.E. (2021). "The Revised Speech Learning Model (SLM-r)." Cambridge University Press. https://www.cambridge.org/core/books/abs/second-language-speech-learning/revised-speech-learning-model-slmr/7A720FCB65B653B00C766A436908B1A7                            | Strong                              |
| 5   | Best, C.T. (1995). Perceptual Assimilation Model. York Press. Confirmed for English vowels in: Tyler et al. (2014). PMC4143388. https://pmc.ncbi.nlm.nih.gov/articles/PMC4143388/                                                                                    | Strong                              |
| 6   | Barlow, J.A. & Gierut, J.A. (2002). "Minimal pair approaches to phonological remediation." _Seminars in Speech and Language_, 23(1), 57–68. https://www.speech-language-therapy.com/pdf/barlowgierut2002.pdf                                                         | Moderate                            |
| 7   | ReadingUniverse. "Short Vowels for English Learners." https://readinguniverse.org/skill-explainer/phonics-patterns/short-vowels-skill-explainer/english-learners-short-vowels                                                                                        | Moderate                            |
| 8   | BoldVoice. "English Pronunciation for Filipino Speakers." https://boldvoice.com/blog/english-pronunciation-filipino-speakers                                                                                                                                         | Weak                                |
| 9   | Deci, E.L., Koestner, R., & Ryan, R.M. (1999). _Psychological Bulletin_, 125(6), 627–668. https://pubmed.ncbi.nlm.nih.gov/10589297/                                                                                                                                  | Strong                              |
| 10  | Education Next / Kearns (2024). "The Cost of Over-Teaching Phonics." https://www.educationnext.org/cost-of-over-teaching-phonics-reading/                                                                                                                            | Weak (synthesis)                    |
| 11  | Brekelmans et al. (2025). "Training Child Learners on Nonnative Vowel Contrasts." _Language Learning_. https://onlinelibrary.wiley.com/doi/10.1111/lang.12677                                                                                                        | Strong (abstract-level access only) |
| 12  | Nature Reviews Psychology (2022) spaced-retrieval meta-analysis. https://www.nature.com/articles/s44159-022-00089-1                                                                                                                                                  | Strong                              |
| 13  | Zhang, Y. & Yao, C. (2025). "Adaptive Phonetic Training, English Vowels." _SAGE Open_. https://journals.sagepub.com/doi/10.1177/21582440251343352                                                                                                                    | Moderate                            |
| 14  | Keys to Literacy systematic phonics scope and sequence. https://keystoliteracy.com/blog/systematic-phonics-scope-and-sequence/                                                                                                                                       | Moderate                            |
| 15  | EnglishClub.com. "Minimal Pair /e/ and /ɪ/." https://www.englishclub.com/pronunciation/minimal-pairs-e-i.php                                                                                                                                                         | Weak (practitioner)                 |
