# Digraph Acquisition for Marian — sh / ch / th Sequencing

**Date:** 2026-05-14
**Requested by:** Matt (via orchestrator) — gates Kyle's word-selection and MJ-prompt work for the digraph tier
**Scope:** Six pedagogical questions on digraph readiness, sequencing, L2 error patterns, word count, isolation vs. interleaving, and an executive recommendation specific to Marian

---

## Question

The app has shipped five short-vowel CVC tiers (short-a, -o, -u, -i, -e). The next planned Word Song increment is digraphs (sh, ch, th). There is no design spec yet. Research gates Kyle's word-selection and MJ-prompt work.

---

## Bottom line

Marian is developmentally ready for digraph introduction now. She does not need to wait for all five CVC vowels to reach mastery — the phonics research consensus (Orton-Gillingham, Keys to Literacy, UFLI, NJ DoE scope-and-sequence) places digraphs after solid CVC competence across two or more short vowels, which she has. The correct introduction order is **sh first, ch second, th (voiceless /θ/ only) third**. Voiced /ð/ should be deferred until voiceless /θ/ is consolidated — they are the same grapheme and the distinction is invisible in the app's chip-tap format, but phoneme confusion is real for Tagalog L1 learners. Eight to ten words per digraph is the right first-round pool, roughly consistent with the app's existing per-vowel-tier approach but at the lower end of that range, because the conceptual load of "two letters, one sound" is new even though individual sounds (for sh and ch) are manageable. Introduce each digraph as its own isolated tier; reserve interleaving for after each digraph reaches ~90% accuracy.

---

## Evidence

### §Q1 — Readiness gate: when does digraph acquisition follow CVC mastery?

**Source 1 — Weallcanread.com. "Orton-Gillingham Principles & Letter Order." https://weallcanread.com/orton-gillingham-principles/**

Moderate evidence (OG-based practitioner synthesis; not a standalone RCT, but the OG sequencing has decades of structured-literacy curriculum use). Orton-Gillingham places digraphs in Phase 4, explicitly after Phase 2/3 CVC work. The readiness criterion is not "all five vowels" but "mastery of individual letter sounds and CVC word reading." Mastery is defined operationally as approximately 90% accuracy in reading and spelling.

**Source 2 — New Jersey Department of Education. "Sample Phonics Scope and Sequence." https://www.nj.gov/education/specialed/programs/additionalsupports/dyslexia/docs/NJTSS%20Sample%20Phonics%20Scope%20and%20Sequence.pdf**

Moderate evidence (state curriculum guidance drawing on structured-literacy evidence base; not a standalone RCT). Sequences digraphs (sh, ch, th, wh, ck) after short-vowel CVC patterns, but does not require all five short vowels — only "CVC patterns with short vowels." The readiness gate is pattern-level mastery, not vowel-count completion.

**Source 3 — Pride Reading Program. "Digraphs: What They Are and How to Teach Them." https://pridereadingprogram.com/digraphs-guide/**

Moderate evidence (OG-based program documentation). Specifies that sh/ch/th decodable readers "should be introduced immediately after a child has mastered short vowels and CVC words" — and, critically, situates this in "late Kindergarten or early First Grade" for a five-year-old. For an eight-year-old with several weeks of structured CVC practice, the readiness bar is already met.

**Source 4 — Keys to Literacy. "Systematic Phonics Scope and Sequence." https://keystoliteracy.com/wp-content/uploads/2024/08/Phonics-Scope-and-Sequence.pdf**

Moderate evidence (established structured-literacy curriculum). Sequences digraphs (wh, ck, sh, th, ch) after short vowels in CVC words, within the Kindergarten-to-Grade-1 band. Grade levels are "suggested, not fixed" based on student readiness.

**Source 5 — Reading Universe / UFLI Foundations. "Overview of Consonant Digraphs." https://readinguniverse.org/skill-explainer/phonics-patterns/consonant-digraphs-skill-explainer/overview-of-consonant-digraphs**

Moderate evidence (established literacy-development organization drawing on Science of Reading). Confirms: sh, ch, and th are prioritized early in digraph instruction "because there are many words that can be read and spelled with those graphemes" once a child has short-vowel CVC competence. Does not specify a vowel-count gate; specifies CVC pattern competence.

**What counts as readiness?** The practitioner-consensus readiness signal is:

- ~90% accuracy on CVC words across at least two short-vowel families (not all five)
- The concept that letters represent sounds is already internalized (Marian has this from Tagalog)
- Blending is automatic at the CV and CVC level (she has this)

Five weeks of CVC practice across five vowel tiers — even at varying mastery levels — is more CVC exposure than the typical kindergartner has when digraphs are first introduced. Marian is ready.

**Readiness signals to watch for:** The one caveat is b/d confusion (noted in her diagnostic) in the context of words that start with /b/ or /d/ — this is irrelevant to sh/ch/th introduction. The readiness gate is clear.

---

### §Q2 — Optimal sequencing among sh / ch / th

**Source 6 — Pride Reading Program. "Digraphs Guide." (same as Source 3 above)**

Moderate evidence. Specifies the teaching order: sh first (highest frequency, acoustically distinct), ch second (allows sh-vs-ch comparison), th third. This ordering is endorsed by the OG-based tradition and appears across multiple curricula.

**Source 7 — Reading Universe. "Overview of Consonant Digraphs." (same as Source 5 above)**

Moderate evidence. Confirms the sh-ch-th priority grouping. Notes that voiced th /ð/ "falls at the beginning of one-syllable function words" (that, this, them, than, then) while voiceless /θ/ appears at word beginnings in content words (thin, think, thank, three) and word endings (path, with, math). These two realizations of `th` are taught as the same grapheme in OG programs but have different phonological profiles.

**Source 8 — Pennington Publishing Blog. "How to Teach the Voiced and Unvoiced TH." https://blog.penningtonpublishing.com/how-to-teach-the-voiced-and-unvoiced-th/**

Weak evidence (practitioner blog, not primary research). Recommends teaching voiceless /θ/ before voiced /ð/ because: (a) the voiceless form appears in content words that are more easily pictured (thin, thumb, three), while voiced /ð/ dominates function words (the, this, that, they) which are harder to illustrate in a chip-tap format; (b) the voiceless form is the articulation-production prototype — the tongue placement is the same but with breath only, which is easier to explain explicitly.

**Source 9 — Magoosh SpeakUp. "The TH Sounds." https://magoosh.com/english-speaking/the-th-sounds/**

Weak evidence (language-learning site; practitioner consensus synthesis). Confirms the pedagogical convention: voiceless /θ/ is the introduced form; voiced /ð/ is taught after the basic tongue-blade placement is mastered. The rationale is that learners who can produce voiceless /θ/ reliably only need to add voicing to get /ð/ — so the voiceless form is the scaffold for the voiced.

**Recommended order, with rationale:**

| Position       | Digraph              | Why first/last                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st            | **sh**               | Highest-frequency digraph in early reading words; the /ʃ/ phoneme is acoustically clean and easy to distinguish from /s/; high decodable word stock (ship, shop, fish, dish, shell, shed, rush, shag, wish); no Tagalog equivalent, but the sound itself is not perceptually difficult                                                                                            |
| 2nd            | **ch**               | Second-highest frequency; /tʃ/ sound exists as a marginal phoneme in Filipino English loanwords, giving Marian a partial reference point; sh-vs-ch comparison after sh mastery reinforces the "two letters, one sound" concept without re-teaching it; high decodable word stock (chin, chip, chop, chat, rich, such, chug, chest)                                                |
| 3rd            | **th voiceless /θ/** | No Tagalog equivalent; requires explicit tongue placement instruction; word stock is good for picturable content words (thin, thank, thick, path, math); easier articulation anchor than voiced /ð/; introduce after sh and ch are consolidated so the conceptual load of the new articulation is manageable                                                                      |
| 4th (deferred) | **th voiced /ð/**    | Same grapheme as voiceless but different phoneme; dominates function words (the, this, that, they, them, there) which are low-imageability; the /ð/ → /d/ substitution is the default Tagalog-speaker error; defer until voiceless /θ/ is consolidated or introduce only as a "same letters, two sounds" note alongside /θ/ without drilling it separately in the chip-tap format |

**On `wh` and `ck`:** These are in the OG Phase 4 digraph family. They are out of scope for this research note (the brief covers only sh/ch/th), but they should follow th in the skill tree. `ck` in particular is high-value for Marian's short-vowel CVC words (back, kick, lock, duck, neck) and could be introduced relatively quickly after sh/ch. That is a separate spec question.

---

### §Q3 — Error patterns: L2 English learner confusions for each digraph

**Tagalog phoneme inventory baseline:**

Tagalog has 16 consonant phonemes: /p, t, k, ʔ, b, d, g, m, n, ŋ, s, h, l, ɾ, w, j/. Nine English consonants are absent from native Tagalog phonology, including /ʃ/ (sh), /tʃ/ (ch), voiceless /θ/ (th-thin), and voiced /ð/ (th-this).

Source: Wikipedia / Tagalog phonology article (https://en.wikipedia.org/wiki/Tagalog_phonology) and MultiCSD Tagalog phonological inventory (https://sites.google.com/view/multicsd/global-languages/tagalog-filipino?authuser=0). These are descriptive linguistic references, not primary acquisition research. I flag them as informational rather than evidence-graded.

**Source 10 — BoldVoice Blog. "English Pronunciation for Filipino Speakers." https://boldvoice.com/blog/english-pronunciation-filipino-speakers**

Weak evidence (pronunciation-coaching site; practitioner consensus). Documents the well-established Tagalog-speaker substitution patterns for English digraphs: (a) /ʃ/ → /s/ (sh-words said as s-words), (b) /tʃ/ → /s/ or /ts/ (ch-words approximated with /s/ or affricate variants), (c) voiceless /θ/ → /t/ ("think" → "tink"), (d) voiced /ð/ → /d/ ("this" → "dis," "they" → "dey").

**Source 11 — ResearchGate. Teaching of /θ/ and /ð/ Sounds in English. https://www.researchgate.net/publication/272885316_The_Teaching_of_th_and_d_Sounds_in_English**

Moderate evidence (published pedagogical study on English dental fricative instruction for L2 learners). The /θ/ and /ð/ sounds are absent from "the sound inventory of most languages" and "English learners often lack L1 references for them and must learn how to articulate them from scratch." The study documents language-specific substitution patterns: Tagalog/Filipino speakers substitute /θ/ → /t/ and /ð/ → /d/. These substitutions arise from perceptual assimilation of the dental fricative to the closest native alveolar stop.

**Source 12 — Philippine English Wikipedia. https://en.wikipedia.org/wiki/Philippine_English**

Informational reference (descriptive linguistics; not a primary acquisition study). Documents the well-established "D and T substitution" in Philippine English — voiceless /θ/ → /t/ and voiced /ð/ → /d/ — as a feature of Philippine English at all proficiency levels. This is structural, not a beginner error that resolves with exposure; many fluent Filipino English speakers maintain the substitution.

**Per-digraph error profile for Marian:**

**sh:**

- Expected error: /ʃ/ → /s/ substitution ("ship" read as "sip," "shop" as "sop")
- Mechanism: /ʃ/ does not exist in native Tagalog phonology; /s/ is the closest native phoneme
- Detectability in chip-tap format: sh-words and s-words look different on the chip label; Marian may select correctly by visual discrimination without producing /ʃ/ correctly. This is acceptable in the app context — the chip-tap task tests reading recognition, not production.
- Emma's instruction note: when introducing sh, Emma should say "Two letters, one sound — sh, like shhh, finger on lips." The /ʃ/ sound is familiar in natural language (it's a shushing sound universally recognized) even if it lacks a Tagalog phoneme slot.

**ch:**

- Expected error: /tʃ/ → /s/ or /ts/ substitution
- Mechanism: /tʃ/ appears in Filipino English loanwords (church, chair) and is more familiar than /ʃ/ for many speakers. The substitution is less systematic than for sh. Marian may actually have better /tʃ/ accuracy than /ʃ/ because loanword exposure is common.
- One complication: ch looks like it should say /k/ (as in "school" or "character") — this is a potential orthographic confusion for a child who knows that "c" says /k/. Emma's script should explicitly confirm: "In these words, ch together says /tʃ/ — not /k/."

**th (voiceless /θ/):**

- Expected error: /θ/ → /t/ ("think" → "tink," "thank" → "tank")
- Mechanism: most systematic of the three; /θ/ has no Tagalog equivalent and the dental fricative articulation (tongue between teeth, breath only) has no L1 scaffolding
- This is the highest-production-difficulty digraph and the one most likely to require explicit articulation explanation
- In the chip-tap format, the production error is not directly testable — what matters is whether Marian can match the spoken word (Emma says "thin") to the text chip "thin" vs. "tin" or "sin." The spelling difference makes this visually unambiguous as long as the distractor words don't also start with th.
- Emma's instruction note: "th together says a special sound — put your tongue between your teeth and blow." A brief animation of Emma's mouth position (or an illustration of a mouth) would help more than TTS alone here.

**th (voiced /ð/):**

- Expected error: /ð/ → /d/ ("this" → "dis," "that" → "dat")
- Mechanism: same grapheme as /θ/ but this substitution is /d/ not /t/; the voicing asymmetry (voiceless → /t/, voiced → /d/) follows the native alveolar stop voicing distinction in Tagalog
- The voiced /ð/ substitution is deeply embedded in Philippine English at all levels; correction requires sustained phonetic training that is beyond this app's scope
- Recommendation: do not drill voiced /ð/ in the chip-tap production format. The function words (the, this, that, they) should be introduced as sight words — Emma reads them aloud correctly; Marian matches text to spoken word without needing to produce /ð/ herself.

---

### §Q4 — Word count per digraph for first introduction

There is no peer-reviewed RCT that specifies an optimal word count per digraph tier. What exists is practitioner consensus derived from mastery-learning principles and the structured-literacy session structure literature. I rely on inference from converging evidence.

**Source 13 — UFLI Foundations. https://ufli.education.ufl.edu/foundations/**

Strong evidence (evidence-based program with RCT-level outcome research). Each UFLI lesson introduces one new phonics element with a small set of exemplar words (typically 6–10 words in the introduction phase). The lesson structure is: introduce the pattern with 3–5 anchor words, then practice with 6–10 additional words in decodable reading. For a 10–15 minute session like Marian's, the practice set is the relevant number.

**Source 14 — phonics-sequence-marian.md §Q5 (internal, 2026-04-26)**

Internal research document. Established that for an 8-problem Word Song session, no more than 2–3 items should be on a brand-new phonics pattern; the remaining 5–6 items revisit mastered patterns. This implies that across the introduction phase (3–5 sessions), the per-digraph word pool needs to be large enough to provide variety across those 2–3 introduction slots without repeating the same two words every session. A pool of 8–10 words satisfies this without overwhelming Marian with new vocabulary.

**Comparison to CVC vowel tiers:** The app's CVC tiers range from 9 words (short-e at launch) to 14 words (short-a). The digraph case is different in one important way: CVC vowel tiers are largely within Marian's existing English vocabulary (cat, dog, sun), so word count can be higher because the vocabulary load is low. Digraph words introduce both a new spelling pattern AND, for some words, new vocabulary. Pool size should be at the lower end — 8–10 words — so that vocabulary is not the bottleneck during the phonics learning.

**Source 15 — Brookes / Cardenas-Hagan (cited as Source 13 in phonics-sequence-marian.md). "Phonics Development Among English Learners." https://brookespublishing.com/wp-content/uploads/2022/01/Cardenas-Hagan-CHP-5-Excerpt-F.pdf**

Strong evidence (ELL phonics instruction handbook, NRP-grounded). Explicitly states that ELL students need the vocabulary pre-taught before the phonics pattern is drilled. For digraph words, this means Marian needs to already know (or quickly learn from picture + audio) what "ship," "fish," "chin," and "chat" refer to before the decoding session uses them. Words that are picturable and culturally familiar should be selected first; abstract or culturally unfamiliar words should be deferred regardless of their phonics utility.

**Recommendation:** 8–10 words per digraph for first introduction. Select words that are (a) picturable and concrete, (b) within Marian's likely oral vocabulary or easily established via picture + TTS, (c) short (one syllable), and (d) use vowels from her already-mastered short-vowel set so that the digraph is the only new element.

---

### §Q5 — Isolation vs. interleaving with mastered CVC content

**Source 16 — Firth, J. et al. (2021). "A systematic review of interleaving as a concept learning strategy." Review of Education. Wiley / BERA Journals. https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/rev3.3266**

Moderate-to-strong evidence (systematic review; not specific to phonics, but covers verbal learning broadly). Interleaving benefits for discrimination learning: effect sizes up to d = 0.65 for memory, d = 0.66 for transfer. The benefit is clearest when the learner is comparing categories that require discrimination — which is exactly what digraph vs. CVC contrast involves. However, the review also notes that **interleaving benefits are strongest for learners who already have some base knowledge of the categories being interleaved**. For a learner encountering a new category for the first time, blocking (the new pattern alone) is the appropriate starting point.

**Source 17 — Bjork, R.A. & Bjork, E.L. (2019). "The myth that blocking one's study is better than interleaving." In Benassi et al., _Evidence-Based Teaching in Higher Education_. https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2020/01/BjorkBjorkEducatinMythChapterPublishedFormSept2019.pdf**

Strong evidence (foundational review of the interleaving literature). Key finding: interleaving produces better long-term learning but feels harder during acquisition; blocking produces better performance during practice but worse long-term retention. The implication for sequencing is direct: **block first (mastery in isolation), then interleave** (mixed practice for retention). This is not an either-or recommendation; it is a sequence.

**Source 18 — Reading Elephant. "Interleaving in Phonics Lessons." https://www.readingelephant.com/2025/10/17/interleaving-in-phonics-lessons/**

Weak evidence (practitioner blog citing the cognitive science literature). Synthesizes the Bjork research for phonics specifically. Recommends: (1) introduce a new phonics pattern in isolation (blocked practice) for initial acquisition, (2) once the pattern is recognized consistently, interleave it with previously mastered patterns in mixed review. The mixed-review phase reinforces discrimination between similar patterns (sh vs. ch vs. s vs. c) more effectively than continued blocked practice.

**Source 19 — ScienceDirect. "Using interleaved practice to foster spelling acquisition." Learning and Instruction. 2025. https://www.sciencedirect.com/science/article/pii/S0959475225000702**

Moderate evidence (preregistered classroom experiment, German third graders, spelling rules). Interleaved practice was "a promising approach to boost the acquisition of spelling rules, particularly among children with better prior knowledge." The prior-knowledge dependency is the key finding for Marian's context: interleaving works better once the foundational patterns are established, not during first exposure.

**Application to the cross-vowel mode question:** The app has a planned "cross-vowel mode" for mixing CVC vowel tiers. The research question is whether a similar interleaving approach helps for digraphs. The answer is: yes, but only after each digraph is blocked to mastery first. Interleaving sh-words with short-a CVC words (e.g., ship alongside cat, dog) before sh is consolidated would tax working memory unnecessarily — the child is trying to hold two simultaneously unfamiliar patterns. The correct sequence: sh in isolation until ~90% accuracy, then introduce sh alongside mastered CVC content.

**Digraph-digraph interleaving:** Once sh and ch are both approaching mastery, interleaving them is the recommended approach because it forces sh-vs-ch discrimination — exactly the error pattern an L2 learner is likely to exhibit. This is the closest digraph analogue to cross-vowel mode and it is supported by the interleaving literature.

**Recommendation:** Do not interleave digraphs with CVC content until the digraph is consolidated (~90% accuracy). Do interleave sh and ch with each other once both are at ~70%+ accuracy, because the sh/ch discrimination is a meaningful learning target.

---

### §Q6 — Executive recommendation for Marian specifically

**Marian is ready for digraph instruction now.** Introduce sh first, for 8–10 words, in a new isolated Word Song tier. After sh reaches ~90% accuracy, introduce ch, again for 8–10 words. After ch approaches mastery, introduce voiceless th /θ/ with the same pool size. Do not introduce voiced th /ð/ in the chip-tap format; if `the`, `this`, and `that` appear, they should arrive as sight-word encounters (Emma reads, Marian taps the matching text chip), not as digraph phonics items. Begin mixing sh and ch together once both are at ~70%+ accuracy, before introducing th — the sh/ch discrimination is both harder for Marian (Tagalog has neither) and more pedagogically productive than keeping each in isolation indefinitely. The one-new-digraph-per-tier structure mirrors the one-new-vowel-per-tier structure already in the app; this is the correct mental model for the skill tree.

One paragraph:

Introduce sh first (8–10 words, isolated tier), ch second (8–10 words, isolated tier), voiceless th /θ/ third (8–10 words, isolated tier). Justify sh-first by frequency and acoustic distinctiveness; ch second because the /tʃ/ phone has partial familiarity from loanwords in Filipino English and the sh-vs-ch comparison is productive once sh is established; voiceless th third because it requires the most explicit articulation scaffolding (no L1 reference) and the picturable content-word stock is smaller than sh or ch. Defer voiced /ð/ indefinitely in the chip-tap decoding format — it dominates function words (the, this, that, they) that are more productively treated as sight words and that share a grapheme with the voiceless form Marian will have just learned, creating a two-realizations-of-one-grapheme puzzle that exceeds the scope of first digraph introduction. Eight to ten words per digraph balances the session introduction constraint (no more than 2–3 new items per session) against variety needs across an introduction arc of 3–5 sessions; it is calibrated lower than the CVC vowel tiers (9–14 words) because digraph words carry higher vocabulary uncertainty for an L2 learner than short-vowel CVC words already in her oral vocabulary.

---

## Application to Marian

### Her current position

As of 2026-05-14, Marian has worked through all five short-vowel CVC tiers. She has strong Tagalog grapheme-phoneme correspondence habits (transparent orthography), confirmed blending at CVC level, and phonological awareness sufficient to segment and blend three-phoneme sequences. The "two letters, one sound" concept will be the primary conceptual barrier, not the blending mechanic.

### Tagalog phonological context for digraphs

Tagalog has /s/ but not /ʃ/. It has /tʃ/ as a marginal phoneme in loanwords but not as a native phoneme. It has /t/ and /d/ but not /θ/ or /ð/. This means:

- **sh:** sound is novel. Marian will hear Emma say "sh" and it will not map to any Tagalog phoneme automatically. Emma's explicit "shhh, finger on lips" mnemonic is needed.
- **ch:** sound has marginal familiarity from English loanwords in Filipino daily speech (church, chips, cheese). The /tʃ/ → /ts/ or /s/ substitution is likely in production, but recognition should be better than for sh.
- **th voiceless:** no L1 reference. The /t/ substitution is automatic and deep. Emma must explicitly scaffold tongue placement; TTS alone (Emma saying "thin" correctly) may not be sufficient for production, but is sufficient for the chip-tap recognition task.
- **th voiced:** /d/ substitution is structural in Philippine English across all proficiency levels. Do not attempt to correct this via a chip-tap app. Function-word sight-word treatment is the appropriate design response.

### How this differs from English-monolingual best practice

English-monolingual children's programs typically introduce voiced and voiceless th together, and expect them to self-sort with exposure. This is reasonable for a child whose L1 already has fricatives in the dental range. For Marian, introducing both th sounds simultaneously would:

1. Create the puzzling situation of two phonemes sharing a grapheme before either is consolidated
2. Pit the voiceless /θ/ (content words, picturable, phonics-teachable) against voiced /ð/ (function words, low-imageability, not easily drillable in chip-tap)

The appropriate deviation from standard monolingual practice: treat voiced /ð/ as a sight-word domain problem, not a digraph phonics problem, for this app.

### What this means for the skill tree

The `digraphs` node in the current Word Song skill tree is a single node. The research implies it should be three (or four) sub-nodes: `digraphs-sh`, `digraphs-ch`, `digraphs-th`. Whether these are implemented as sibling nodes (like the CVC vowel tiers) or as a single digraph tier with internal progression logic is a developer and PO decision, not a research decision. The point to preserve: sh, ch, and th need separate introduction arcs; merging them into a single tier risks introducing all three simultaneously, which exceeds the one-new-concept-per-session rule established in `phonics-sequence-marian.md` §Q5.

### Emma's digraph introduction scripts (design guidance for Kyle)

This is not the spec. Kyle writes the spec. But the L2 phonological context above implies:

**sh:** "Look — sh together! Two letters, one sound. Shhh [finger-on-lips gesture]. Ship! Sh-i-p. Ship."

**ch:** "ch together makes a new sound — like the start of 'cheese'! Ch! Ch-i-n. Chin."

**th voiceless:** "th together is special — tongue between teeth, blow out air. Th! Th-i-n. Thin. [explicit tongue-placement note or animation]"

**th voiced (sight word encounter, not phonics lesson):** No explicit th articulation instruction needed. Emma reads "the" correctly; Marian taps the chip. No metalinguistic commentary about /ð/ is required or helpful at this stage.

---

## Risks / counter-evidence

### §Q1 — Is Marian really ready now?

The case for waiting: she has five active CVC tiers at various mastery levels, and the digraph tier will add a sixth active skill. Working-memory load is real. The counter-argument is stronger: the research gate (90% on two+ short-vowel families) is met — short-a is fully mastered and at least one or two of the subsequent vowels are approaching mastery. Waiting for all five to reach mastery before digraphs would add 6–10 weeks and is not consistent with the curriculum literature. The risk of too-early introduction is managed by the one-new-concept-per-session constraint.

### §Q2 — Disagreement on sh vs. ch first

Some curricula introduce ch before sh (e.g., some Reading Street implementations). The rationale is that /tʃ/ is more common in children's early oral vocabulary ("chair," "cheese," "chips"). This is a real alternative. My recommendation of sh-first follows the OG-based tradition, which prioritizes acoustic distinctiveness (/ʃ/ is spectrally cleaner than /tʃ/). For Marian, the partial loanword familiarity with /tʃ/ is an argument for either order. I rate the sh-first call as moderate-confidence, not strong.

### §Q3 — Limited Tagalog-specific L2 digraph research

There is no published acquisition study specifically on Tagalog-speaking 8-year-olds learning English digraphs in a phonics-app context. The Tagalog phonological analysis and error-pattern predictions are derived from:

- Structural descriptions of Tagalog phonology (informational, not evidence-graded)
- General L2 phonological acquisition literature (strong for the /θ//ð/ difficulty, moderate for /ʃ/ and /tʃ/)
- Philippine English descriptive linguistics (documents the D/T substitution as a systemic pattern)

The error pattern predictions are plausible and consistent with what is known, but they are not empirically derived from a study of Marian's specific profile. If Thomas observes her making different errors than predicted (e.g., she has better /ʃ/ production than expected from Filipino English loanword exposure), that empirical observation should override these predictions.

### §Q4 — No direct evidence on digraph pool size

The 8–10 word recommendation is an inference from the UFLI session structure (6–10 practice words), the phonics-sequence-marian.md §Q5 constraint (2–3 new items per 8-item session), and the vocabulary-load caution from Cardenas-Hagan. There is no RCT comparing 6-word vs. 10-word vs. 14-word introduction pools for digraph acquisition in L2 learners. The recommendation is convergent-evidence-based, not directly empirical.

### §Q5 — Interleaving research is largely in older children and adults

The Bjork review and the Firth systematic review draw primarily on adults and older children. The ScienceDirect spelling study used German third graders (approximately Marian's age), and found that interleaving benefits were larger for children with more prior knowledge. This supports the block-first recommendation for initial digraph introduction, but the optimal timing for the transition to interleaved practice is not empirically pinpointed for 8-year-olds. "After ~90% accuracy on the new pattern" is my read of where the prior-knowledge threshold sits; it is not a directly tested number for this age group.

### On voiced /ð/ entirely deferred

Deferring voiced /ð/ means Marian's app will not explicitly teach the phoneme in words like "the," "this," "that," "they." These are extremely high-frequency words that she will need in decodable sentences. The resolution: sight-word instruction covers them without requiring phoneme-level production of /ð/. The sight-word approach is already in the app's design via the 10 core sight words (`phonics-sequence-marian.md` §Q4). The function words `the, this, that, they` are all in or adjacent to that list and should arrive before or alongside digraph instruction, not after it.

---

## Recommendations

### For Matt (ticket scope and priority)

1. **Digraph introduction is ready to spec now.** There is no developmental reason to wait for more CVC mastery before starting Kyle's word-selection work. Gate is: solid CVC competence across two+ short vowels, which Marian has.

2. **Do not build a single `digraphs` tier.** The skill tree needs separate introduction nodes for sh, ch, and th (voiceless). Whether this is three sibling `SkillNode` literals or one `digraphs` tier with an internal three-phase arc is a developer/PO decision — but the research requires sequential introduction, not simultaneous presentation of all three digraphs. If the current `digraphs` node becomes a single tier with sh-only content first, that is acceptable as long as ch and th are not added to the same pool until sh is consolidated.

3. **Treat voiced /ð/ as a sight-word problem, not a phonics-tier problem.** The function words `the, this, that, they, them, then` should arrive via sight-word instruction (already in `phonics-sequence-marian.md` §Q4 recommendations), not via a phonics chip-tap session that treats `th` as a digraph to be decoded. This should be a note in the digraph spec.

4. **Word count target: 8–10 words per digraph.** This is calibrated lower than the CVC vowel tiers (9–14 words) due to vocabulary uncertainty and the conceptual overhead of the two-letters-one-sound concept. Kyle's word-selection work can proceed within this constraint.

5. **sh-ch interleaving is a subsequent phase, not a separate ticket.** Once sh and ch are both at ~70%+ accuracy, a mixed sh/ch session is the appropriate next step. This can be a planner-side session-composition decision rather than a new `SkillNode`, analogous to cross-vowel mode for CVC.

### For Kyle (design changes)

1. **Emma's digraph introduction must explicitly teach the two-letters-one-sound concept** — Tagalog does not have true consonant digraphs, so this is a new metalinguistic idea for Marian, not just a new sound. "These two letters work together — they make one sound" should be Emma's first line for each digraph, not assumed.

2. **th requires articulation scaffolding beyond TTS.** For sh and ch, Emma saying the word correctly via TTS is probably sufficient for chip-tap recognition. For th (voiceless /θ/), the /t/ substitution is so strong for Tagalog speakers that TTS alone risks Marian hearing /t/ and assuming that is correct. A brief visual cue (emoji or illustration of a mouth with tongue at teeth) alongside Emma's voice is warranted. This is the highest-design-effort digraph; plan accordingly.

3. **Picturable, short, single-syllable words only** for the first round. Digraph words that require additional syllables or unfamiliar concepts will compound the cognitive load. Kyle's word-selection list should prioritize:
   - sh: ship, shop, fish, dish, shed, shell, shag, wish, rush, shim
   - ch: chin, chip, chop, chat, rich, such, chug, check, much, chest
   - th voiceless: thin, thick, thank, path, math, moth, tenth, with
     The specific words are Kyle's territory — these are examples, not a prescribed list.

4. **Distractor design for digraphs differs from CVC.** For CVC words, distractors differ by vowel or initial consonant. For digraph words, the most diagnostically useful distractors differ by the initial grapheme: "ship" vs. "sip" (sh vs. s confusion), "chin" vs. "sin" or "kin" (ch vs. s/k confusion), "thin" vs. "tin" or "sin" (th vs. t/s confusion). This is not how the current FORBIDDEN_PAIRS / TARGET_PAIRINGS system was designed for vowel-tier content; Kyle and the dev team will need to adapt the distractor-selection logic for digraph tiers.

5. **No picture needed for function words `the, this, that, they` in their digraph role.** If these words appear as targets in a chip-tap session at all, it should be via the sight-word mechanism (Emma says the word, Marian taps the text chip), not via the picture-chip decoding format. These words are not picturable and the digraph phonics frame does not apply cleanly to them.

### Open questions to flag (not in scope to resolve now)

1. **`wh` and `ck` timing.** These digraphs belong in the same Phase 4 cluster. `ck` in particular is high-value for Marian's CVC short-vowel words (back, kick, lock, duck, neck). A brief follow-up research note on wh/ck sequencing would be useful once sh/ch/th are specced.

2. **Cross-digraph interleaving trigger.** The "at ~70% accuracy, start interleaving sh and ch" rule needs to be operationalized. This is a planner-side session-composition decision analogous to cross-vowel mode — and the same 90/3 mastery infrastructure may not be the right gate here. A lighter trigger (e.g., 3 sessions above 70%) may be appropriate. This is a developer/PO call; flag it at spec time.

3. **Voiced /ð/ in decodable sentences.** When the app eventually reaches simple-sentences tier, voiced /ð/ will appear in sentences like "The dog sat." At that point Emma will read the sentence aloud including "the" — Marian will hear /ð/ in context without explicit phonics instruction, which is how function-word phonology is typically acquired. No action needed now; but the sentences tier should not attempt to teach /ð/ as a phonics pattern via the digraph infrastructure.

---

## Non-obvious findings to surface

1. **The `digraphs` node is already in the skill tree as a single node.** The research strongly implies it should be at least three sequential sub-nodes (sh, ch, th). If the current implementation treats `digraphs` as a single pool, adding sh, ch, and th words to it simultaneously would violate the one-new-concept-per-session principle. The dev team should review how the `digraphs` `SkillNode` is wired before Kyle's word-selection work defines a word pool — if the pool will hold all three digraphs from launch, the planner must enforce per-session digraph isolation (only sh-words in a sh-introduction session) rather than randomly sampling across all three.

2. **The `th` grapheme is two phonemes, which means any distractor matrix that indexes by grapheme will be ambiguous.** The current `TARGET_PAIRINGS` architecture uses word-level entries; this works fine for CVC because one word = one vowel phoneme = one distractor axis. For `th` words, "thin" and "them" share a grapheme but have different phonemes — the distractor selection logic for a `thin` target should use /θ/-based distractors (tin, sin), not /ð/-based ones (them, they). If Kyle's word-selection list separates voiceless and voiced th words into different pools, the distractor architecture is fine. If they are in the same pool, the distractor logic needs a per-word phoneme-tag, not just a grapheme-tag.

3. **The `sh` phoneme appears in word-final position as well as initial position** (fish, dish, rush, wish, crash). CVC-pattern words with final /ʃ/ follow CVCC or CVC-sh patterns and may feel different to Marian than sh-initial words. Include both positions in the pool but introduce sh-initial words first (they are more predictable in left-to-right decoding flow), then add sh-final words once the digraph concept is consolidated.

4. **Vocabulary uncertainty is higher for digraph words than for CVC words.** Short-a and short-o words like "cat," "dog," and "box" were already in Marian's oral English vocabulary before the app started. Digraph words like "shag," "chug," "molt," and "moth" may not be. Kyle's word-selection pass should include a vocabulary-familiarity filter: does the picture make the word's meaning immediately obvious without additional explanation? If not, the word is a vocabulary-lesson-inside-a-phonics-lesson, which exceeds the session's working-memory budget.

5. **The voiced/voiceless th distinction is invisible to a child looking at the text chip.** "The" and "thin" both start with `th`. In the chip-tap format, if both types of th-words appear as targets in the same session, Marian has no visual cue that they have different phonemes — she only has Emma's voice. This is an additional argument for deferring voiced /ð/ content entirely during the initial th-phonics introduction: mixing them in the same session would require Marian to attend to a phonemic distinction that has no graphemic signal, which is the hardest type of discrimination task.

---

## Sources index

| #   | Citation                                                                                                                | Strength                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Weallcanread.com — OG principles and letter order; digraphs Phase 4                                                     | Moderate                                          |
| 2   | NJ Dept of Education — sample phonics scope and sequence                                                                | Moderate                                          |
| 3   | Pride Reading Program — digraphs guide, teaching order                                                                  | Moderate                                          |
| 4   | Keys to Literacy — systematic phonics scope and sequence (2024 PDF)                                                     | Moderate                                          |
| 5   | Reading Universe / UFLI — overview of consonant digraphs                                                                | Moderate                                          |
| 6   | Pride Reading Program — digraphs guide, sh-ch-th sequence                                                               | Moderate (same source as 3)                       |
| 7   | Reading Universe — voiced vs. voiceless th distinction                                                                  | Moderate                                          |
| 8   | Pennington Publishing — how to teach voiced and unvoiced th                                                             | Weak (practitioner blog)                          |
| 9   | Magoosh SpeakUp — th sounds, voiceless-first scaffold                                                                   | Weak (language-learning site)                     |
| 10  | BoldVoice — English pronunciation for Filipino speakers                                                                 | Weak (pronunciation-coaching site)                |
| 11  | ResearchGate — Teaching of /θ/ and /ð/ in English; L2 substitution patterns                                             | Moderate                                          |
| 12  | Wikipedia — Philippine English; D/T substitution documentation                                                          | Informational (descriptive linguistics)           |
| 13  | UFLI Foundations — lesson structure, 6–10 practice words per introduction                                               | Strong (RCT-supported program)                    |
| 14  | phonics-sequence-marian.md §Q5 (internal, 2026-04-26)                                                                   | Internal                                          |
| 15  | Brookes / Cardenas-Hagan — phonics for ELLs, vocabulary pre-teaching                                                    | Strong                                            |
| 16  | Firth et al. (2021) — systematic review of interleaving as concept learning strategy. Review of Education, Wiley / BERA | Moderate-to-strong (systematic review)            |
| 17  | Bjork & Bjork (2019) — myth that blocking is better than interleaving. Evidence-Based Teaching in Higher Education      | Strong (foundational review)                      |
| 18  | Reading Elephant — interleaving in phonics lessons (2025)                                                               | Weak (practitioner blog citing cognitive science) |
| 19  | ScienceDirect — interleaved practice for spelling acquisition, 2025; preregistered classroom experiment                 | Moderate                                          |
| 20  | Wikipedia — Tagalog phonology; consonant inventory                                                                      | Informational (descriptive linguistics)           |
| 21  | MultiCSD — Tagalog (Filipino) speech and language development                                                           | Informational (descriptive linguistics)           |
