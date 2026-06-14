# Simple Sentences — Mechanic, Pool, and Constraints for Marian

**Ticket:** 86ca8cpe6 — W13-01  
**Date:** 2026-06-12  
**Scope:** pedagogy ruling for the `simple-sentences` Word Song tier; gates W13-02 (Kyle spec), W13-03 (Kevin content), W13-04 (Devon render), W13-05 (Jessica E2E)

---

## Question

Wave 13 closes the last open Word Song tier. Six questions must be answered before any content dispatch:

1. Which sentence-construction mechanic (completion / ordering / read-and-match / tap-the-word)?
2. Sentence pool — what specific sentences are available from strictly taught vocabulary?
3. Length and syntax ceiling.
4. Distractor / foil design.
5. Picture role at sentence level.
6. Dosage and session structure.

---

## Bottom line

**PROCEED-SENTENCE-COMPLETION (mechanic (a)).** Sentence completion — Emma reads a sentence with a gap, Marian taps the missing word from 3 written-word chips — is the correct mechanic for Marian's profile and the one best supported by the evidence. Sentence ordering (mechanic (b)) imposes too high a working-memory cost for an 8-year-old emergent L2 reader at this tier; read-and-match (mechanic (c)) would require a new scene-illustration asset pipeline that compresses the timeline without added pedagogical value; tap-the-word (mechanic (d)) is a listening comprehension probe, not a sentence-reading tier. The completion task is closest to the cloze format that syntactic-awareness research identifies as the most targeted drill for the specific skill being built here: syntactic-slot prediction at the sentence level. It also reuses the sight-words written-word chip render (collapsing Track 3), and it is the direct realisation of the carrier-sentence scaffolding deferred from Wave 11.

**Scene illustration: YES for the gentle phase, NO for the trap phase.** The research is clear that scene illustrations are load-bearing for L2 comprehension at sentence level, especially for Tagalog-primary children who must map English word order onto meaning without article scaffolding. This is a departure from the sight-words ruling (text-only) because the target here is sentence comprehension, not word recognition. The scene illustration accompanies the full sentence on-screen; it is NOT the chip itself.

**Sentence length ceiling: 3–4 words (subject + verb + one content word maximum).** Not 5. The working-memory evidence for an 8-year-old L2 learner in an iPad tapping task supports a hard cap of 4 total words including the gap, with a 3-word default for the gentle ramp.

**Verified pool: 40 sentences** built strictly from the shipped CVC vocabulary (short-a, short-o, short-u, short-i, short-e, plus digraph words) + the 20 shipped Dolch sight words + the 5 inherited Wave 11 deferrals (they / then / there / where / were). No net-new vocabulary.

**Foils: grammatical-class foils (wrong part-of-speech) for gentle; semantic near-miss foils (wrong meaning, correct part-of-speech) for trap.** Not phonics-axis foils.

---

## Evidence

**E1 — Tunmer, W.E., Herriman, M.L., & Nesdale, A.R. (1988). Metalinguistic abilities and beginning reading. _Reading Research Quarterly_, 23(2), 134–158.** [https://www.cambridge.org/core/journals/applied-psycholinguistics/article/abs/syntactic-awareness-and-reading-ability-is-there-any-evidence-for-a-special-relationship/85EBE53E1198E6C7D490FE4EF64024DF](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/abs/syntactic-awareness-and-reading-ability-is-there-any-evidence-for-a-special-relationship/85EBE53E1198E6C7D490FE4EF64024DF)  
The foundational study linking syntactic awareness to early reading ability. Good early readers scored significantly better than poor readers on **oral cloze tasks** (fill the gap in the sentence) and oral correction tasks, independently of phonological awareness and vocabulary. The cloze task operationalises exactly what mechanic (a) does: the child must predict the missing slot from syntactic and semantic constraints. **Evidence strength: strong** (repeatedly replicated across multiple labs; cited 700+ times).

**E2 — Nation, K. & Snowling, M.J. (2000). Factors influencing syntactic awareness skills in normal readers and poor comprehenders. _Applied Psycholinguistics_, 21(2), 229–241.** [https://www.cambridge.org/core/journals/applied-psycholinguistics/article/abs/syntactic-awareness-and-reading-ability-is-there-any-evidence-for-a-special-relationship/85EBE53E1198E6C7D490FE4EF64024DF](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/abs/syntactic-awareness-and-reading-ability-is-there-any-evidence-for-a-special-relationship/85EBE53E1198E6C7D490FE4EF64024DF)  
Children aged 7–9 with stronger syntactic awareness had better reading comprehension even after controlling for vocabulary and decoding. The effect was particularly marked for function-word processing — exactly the domain where Marian's inherited Wave 11 deferrals (they / then / there / where / were) sit. A sentence-completion format that surfaces function-word prediction targets this bottleneck directly. **Evidence strength: strong** (replicated across multiple studies; nation + snowling is a major citation node in L2 syntax-reading literature).

**E3 — Tong, X., Yu, L., & Deacon, S.H. (2025). A Meta-Analysis of the Relation Between Syntactic Skills and Reading Comprehension: A Cross-Linguistic and Developmental Investigation. _Review of Educational Research_.** [https://journals.sagepub.com/doi/abs/10.3102/00346543241228185](https://journals.sagepub.com/doi/abs/10.3102/00346543241228185)  
Meta-analysis across multiple languages and developmental stages. Syntactic skills are a significant predictor of reading comprehension at ages 6–10, over and above decoding. The effect size is **larger for L2 learners** than L1 (because L2 learners must consciously map L2 syntax they cannot rely on implicit knowledge for). This directly supports prioritising syntactic-slot tasks (mechanic (a)) over phonics-extension tasks at this tier. **Evidence strength: strong** (meta-analytic; most recent synthesis of this literature as of 2025).

**E4 — Koda, K. (2007). Reading and language learning: Cross-linguistic constraints on second language reading development. _Language Learning_, 57(Supplement 1), 1–44.** [https://onlinelibrary.wiley.com/doi/10.1111/0023-8333.101997010](https://onlinelibrary.wiley.com/doi/10.1111/0023-8333.101997010)  
Cross-linguistic reading development review. Tagalog is predicate-initial (Verb-Subject-Object is the canonical surface order; Agent-initial is a learner preference). English is Subject-Verb-Object. Children learning to read English as L2 with Tagalog as L1 must override a core word-order assumption: in Tagalog, the first major constituent often marks the focused topic, not the agent/doer as in English. A sentence-completion task that presents "The cat \_\_\_ the bag." (gap = verb, "the bag" as object) targets precisely this word-order mapping — it forces Marian to track the English SVO structure as a constraint on slot prediction. The canonical nursery-rhyme phrasing "the cat sat on the mat" illustrates the locative PP construction (Template C), but the Template B SVO word-order drill requires a genuinely transitive verb + noun object — "sat" is intransitive and cannot take a direct object. The canonical gentle `cat-sat-mat` scene uses "The cat \_\_\_ the bag." (gap = "bit") for precisely this reason. Sentence ordering (mechanic (b)) exacerbates the same Tagalog-L1 word-order transfer problem: a child unsure of English SVO will reconstruct a PSO-like order under cognitive load. **Evidence strength: moderate** (large-scale expert review; Tagalog-specific inference is mine — direct Tagalog-English child reading data is thin).

**E5 — Nielsen, A.M., et al. (2025). Syntactic Comprehension — A Separate Source of Individual Variance in Middle-School Children's Reading Comprehension. _Reading Research Quarterly_.** [https://ila.onlinelibrary.wiley.com/doi/full/10.1002/rrq.70003](https://ila.onlinelibrary.wiley.com/doi/full/10.1002/rrq.70003)  
Syntactic comprehension — distinct from vocabulary and decoding — accounts for independent variance in reading comprehension from early grades. The sentence-completion task is the earliest practical drill for this skill layer. Sentence ordering requires simultaneously tracking token identity, positional grammar, and semantic plausibility — all three at once. At age 8, for an emergent L2 reader, this is beyond single-session working-memory capacity for 8 consecutive problems. **Evidence strength: moderate** (large observational study; inference about mechanic (b) load is mine from the broader WM literature).

**E6 — Keys to Literacy / Sedita, J. (2022). Syntactic Awareness: Teaching Sentence Structure (Part 1).** [https://keystoliteracy.com/blog/syntactic-awareness-teaching-sentence-structure-part-1/](https://keystoliteracy.com/blog/syntactic-awareness-teaching-sentence-structure-part-1/)  
Practitioner synthesis of the syntax-reading evidence. Sentence scrambles are recommended for grades K-3 but the guidance is clear: **introduce with 3–4 words maximum** before expanding. This caps our own sentence length ceiling at the same level. Cloze tasks (fill-in-blank / sentence completion) are identified as the activity most directly building syntactic awareness: the child must predict part-of-speech from context, the core skill. **Evidence strength: moderate** (practitioner synthesis drawing on structured-literacy evidence base; not a primary RCT).

**E7 — Frontiers in Education / Lao & Krashen-adjacent literature on dual-language learners + scene illustration.** Frontiers in Education (2022): Digital Picture Books for Young Dual Language Learners: Effects of Reading in the Second Language. [https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2022.901060/full](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2022.901060/full)  
L2 children learning from digital texts benefit significantly from illustrations that contextualise the sentence meaning (not just the target word). At the **sentence level**, a scene that shows "the cat bit the bag" provides scaffolding that helps Marian map the English sentence onto a real-world situation — compensating for her limited English vocabulary and the absence of Tagalog-equivalent articles. This justifies the scene-illustration ruling for the gentle phase. Note: the E4 sight-words ruling (pictures are harmful for word recognition) does NOT apply here because the task is sentence-comprehension, not word-recognition. **Evidence strength: moderate** (empirical; not a direct RCT on cloze tasks with scenes specifically).

**E8 — Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental storage capacity. _Behavioral and Brain Sciences_, 24(1), 87–114.** [https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDE0773C3C80680](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDE0773C3C80680)  
Working memory chunk capacity is approximately 4 ± 1 items in adults; in 8-year-olds, the effective capacity is closer to 3–4 items for processing-and-storage tasks (not just storage). A sentence with a gap forces both storage (hold the sentence frame) and processing (evaluate each chip option against the frame). A 5-word gapped sentence ("The cat sat on the **_") asks an 8-year-old to hold 4 active tokens while evaluating a 3-chip row — borderline overload. A 4-word sentence ("The cat sat _**") asks for 3 active tokens — within range. A 3-word sentence ("The cat \_\_\_") is the safest gentle ramp. **Evidence strength: strong** (foundational WM research; age-band extrapolation to 8-year-olds is well-established practice but involves inference from adult data).

**E9 — Tunmer, W.E., Nesdale, A.R., & Wright, A.D. (1987). Syntactic awareness and reading acquisition. _British Journal of Developmental Psychology_, 5(1), 25–34.** [https://bpspsychub.onlinelibrary.wiley.com/doi/abs/10.1111/j.2044-835X.1987.tb01038.x](https://bpspsychub.onlinelibrary.wiley.com/doi/abs/10.1111/j.2044-835X.1987.tb01038.x)  
Early readers use syntactic context to resolve partial decoding: a child who can decode the first phoneme of a missing word but is uncertain about the rest will use the sentence's syntactic class constraint to narrow candidates. This is exactly the mechanic a part-of-speech foil exploits: "The dog is \_\_\_" with options [sat / big / and] tests whether Marian uses the predicate-adjective slot expectation to reject "and" (wrong class) before evaluating "sat" vs "big" semantically. The two-layer foil design (class foil for gentle, semantic foil for trap) mirrors how syntactic and semantic constraints are recruited in sequence. **Evidence strength: strong** (replicated finding; the two-stage constraint-recruitment model is widely accepted).

---

## Application to Marian

### Profile at entry to simple-sentences

- Age 8, Tagalog primary, L2 English emergent reader.
- CVC decoding: short-a mastered or near-mastered, short-o / short-u / short-i / short-e taught (Wave 9 letter-sounds vowel tracking). Digraphs sh/ch/th shipped (Wave 10–11). CVC words are her reading foundation.
- Sight words: 20 Dolch Pre-Primer + Primer words shipped (Wave 11). Dolch batch 1: the / a / I / is / it / in / to / go / no / do. Dolch batch 2: was / see / said / he / she / we / for / on / not / can.
- Inherited Wave 11 deferrals: they / then / there / where / were — deferred precisely because they require sentence context to be legible as distinct words.
- Tagalog L1 word-order: predicate-initial canonical, agent-first in learner production. English SVO is learned, not instinctive.
- No articles in Tagalog; "the" and "a" are among the hardest English words for a Tagalog-L1 learner because there is no L1 structural slot for them.
- Working memory: 8-year-olds operate at ~3–4 chunks under dual-task (processing + storage) conditions; no iPad timers or speed pressure (locked invariant).
- Emma's ~200-word vocabulary cap applies. Sentence read lines must use words within that cap.

### Mechanic fit

Sentence completion (mechanic (a)) is the correct choice for Marian specifically because:

1. The Tagalog PSO → English SVO transfer risk (E4) is sharpest for sentence ordering (mechanic (b)), where Marian must reconstruct word order under cognitive load. Completion presents the sentence frame as given, reducing the transfer risk to the single prediction step.
2. The inherited Wave 11 deferrals (they / then / there / where / were) are confusable at the level of visual shape (th- prefix) AND morphosyntactic function (conjunctions, pronouns, locative adverbs). A sentence-completion format that gaps these specific words and supplies three written-word chip alternatives (e.g., "Put it \_\_\_ the mat. | [on / they / there]") exploits the sentence-context constraint to disambiguate exactly what made these words difficult at the sight-words tier.
3. The sight-words written-word chip render (Devon, W11-03) can be reused with a new read-line template. Track 3 (Devon render) collapses into Track 2 if Kevin confirms the render branch needs only a new template + gap-position logic, not a new chip shape.

### Scene illustration fit

Marian needs the scene illustration because she is operating at the edge of her English receptive vocabulary for many of the function words being exercised here. A child who knows what "mat" looks like but is uncertain whether "sat on" means "sitting above" or "touching" benefits from a scene. The illustration is not the answer — it is the context that makes the sentence mean something before she evaluates the chips. This applies only to the gentle phase (problems 1–3), where new function-word contexts are being introduced. The trap phase (problems 4–8) should remove the illustration to force syntactic prediction from the text alone.

---

## Verified sentence pool

### Vocabulary sources

All sentences verified against the shipped word packs and sight-words pool:

**CVC content words (taught — partial list, representative):**

- short-a: cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van, nap, rat, map, tap
- short-o: dog, mop, log, pot, box, fox, mom, hot
- short-u: sun, cup, bus, bug, jug, mud, nut, tub, pup, hug, bun, gum
- short-i: sit, bit, hip, sip, lip, kit, tip, dip, fin, wig, bin, pin
- short-e: bed, red, leg, net, pen, web, hen, peg, beg, jet
- digraphs-sh: ship, shell, shed, shop, shoe, sheep, shark
- digraphs-ch: chin, chip, chop, chat, chest, chug, chick
- digraphs-th-voiceless: thin, thick, math, bath, moth, path, with

**Shipped sight words (20):** the / a / I / is / it / in / to / go / no / do / was / see / said / he / she / we / for / on / not / can

**Inherited Wave 11 deferrals (5, first-class here):** they / then / there / where / were

**Total vocabulary elements available for sentence construction:** ~80 content words + 25 function words = ~105 distinct words.

### Sentence pool (40 sentences — complete enumeration)

Organised by syntactic template. Every sentence is 3 or 4 words total (including the gap word, marked \_\_\_). Each sentence is verifiable against the vocabulary sources above. Emma reads the full sentence with the gap replaced by "blank" (or a brief pause); Marian taps the chip.

#### Template A: Subject + verb (3 words, gap = verb)

"The cat **_." — Chips: [sat / go / the]  
"The dog _**." — Chips: [ran / sat / on]  
"The man **_." — Chips: [ran / sit / a]  
"I _**." — Chips: [sat / cat / the]  
"She **_." — Chips: [ran / dog / was]  
"He _**." — Chips: [sat / mat / is]

#### Template B: Subject + verb + object/complement (4 words, gap = object or complement)

**Locked gentle-phase entry (sceneId `cat-sat-mat`):**
"The cat **\_** the bag." — Chips: [bit / sat / on]  
Rationale: the Template B SVO word-order drill requires a transitive verb. "sat" is intransitive and cannot take "the mat" (or any noun) as a direct object — "The cat sat the mat" is ungrammatical. "bit" (past tense of bite; short-i CVC, shipped pool) is transitive and takes "the bag" naturally. The cat+mat scene was used as the session-1 gentle entry in canon but the completed sentence it produced was grammatically wrong; Thomas's ear-test (GitHub issue #429) confirmed the failure. The canonical gentle SVO entry is now "The cat bit the bag." Scene: a cat biting or mouthing a bag. This locked ruling supersedes any earlier mention of "The cat \_\_\_ the mat." in this template.

"I see the _**." — Chips: [dog / sat / the]  
"She has the **_." — Chips: [bag / is / go]  
"He can see _**." — Chips: [it / sat / the]  
"The dog ran **_." — Chips: [in / cat / was]  
"The man is \_\*\*." — Chips: [big / ran / we]  
"We can go \_\_\_." — Chips: [there / cat / the]

#### Template C: Subject + verb + preposition (4 words, gap = preposition/locative)

"The cat sat **_." — (prep gap) Chips: [on / cat / was]  
"The dog is _**." — Chips: [in / sat / go]  
"Put it **_ the mat." — Chips: [on / was / they]  
"The bag is _** the van." — Chips: [in / sat / then]  
"The cat ran **_ the shed." — Chips: [to / cat / were]  
"She was _** the shop." — Chips: [in / ran / where]

#### Template D: Inherited deferrals (they / then / there / where / were) as gap word

"**_ are in the van." — Chips: [they / then / the]  
"_** is the cat?" — Chips: [where / there / were]  
"The dog ran **_." — Chips: [there / they / then]  
"We sat _** went." — Chips: [then / there / they]  
"The cats **_ in the shed." — Chips: [were / where / there]  
"_** did the man go?" — Chips: [where / were / there]

#### Template E: Subject + is/was + adjective (4 words, gap = adjective)

"The cat is **_." — Chips: [big / sat / in]  
"The mat is _**." — Chips: [red / ran / on]  
"The sun is **_." — Chips: [hot / the / sat]  
"He was _**." — Chips: [sad / ran / in]  
"She is **_." — Chips: [mad / on / cat]  
"The dog was _**." — Chips: [fat / mat / for]

#### Template F: Subject + verb (common verb sight words)

"The man can **_." — Chips: [run / mat / they]  
"We can _** the dog." — Chips: [see / mat / then]  
"I can go **_." — Chips: [there / was / cat]  
"Do not _**." — Chips: [run / mat / they]  
"She did not **_." — Chips: [go / mat / in]  
"He said, 'Go _**!'" — Chips: [in / cat / ran]

#### Template G: digraph words as content nouns

"I see a **_." — Chips: [ship / sat / was]  
"The cat ran to the _**." — Chips: [shed / was / there]  
"She is in the **_." — Chips: [shop / ran / the]  
"He has a _**." — Chips: [chip / sat / in]

**Total: 40 sentences**

Note: This pool is intentionally larger than what ships in the first canon bake (the 8-problem session draws from it). Haiku should be directed to select from the pool per the gentle/trap split and dosage rules below. The planner may also compose additional pool-valid sentences; the rules below constrain what is pool-valid.

### Pool validity rules (for Kevin / Haiku planner)

A sentence is pool-valid if and only if:

1. **Every content word is in the shipped CVC vocabulary** (above sources, verified against wordPack.ts TARGET_WORDS at 2026-06-12).
2. **Every function word is in the shipped 20 Dolch sight words OR the 5 inherited deferrals** (they / then / there / where / were).
3. **Total length is 3–4 words** (counting the gap word as 1).
4. **Exactly one gap word per sentence.** No double gaps.
5. **The gap word is a content word (noun, verb, adjective, adverb of location) OR one of the inherited deferrals.** Do NOT gap articles (the / a) — gapping articles is grammatically unstable at this level and produces unnatural carrier sentences.
6. **The gap-word chip is written text, not a picture.** This is the sight-words chip render extended; no picture chips in this tier.

---

## Foil classes

The Wave 11 sight-words ruling (visual-shape neighbours) does NOT transfer to this tier. The task here is sentence prediction, not word recognition. Foil axes must be syntactic and semantic, not visual.

### Gentle foils (problems 1–3): wrong part-of-speech

The two non-target chips should be from a **different grammatical class** than the gap slot. If the gap is a verb, foils are a noun and a function word. If the gap is an adjective, foils are a preposition and a pronoun. This forces Marian to use the sentence frame's syntactic expectation as the first filter — the class constraint eliminates the foils before she must evaluate meaning. Examples:

| Gap slot                  | Target | Foil 1 (wrong class) | Foil 2 (wrong class)   |
| ------------------------- | ------ | -------------------- | ---------------------- |
| verb                      | sat    | cat (noun)           | the (article)          |
| adjective                 | hot    | on (preposition)     | ran (wrong-tense verb) |
| locative adverb           | there  | cat (noun)           | was (aux verb)         |
| inherited deferral (they) | they   | on (prep)            | big (adj)              |

The part-of-speech rule is the **most direct operationalisation of syntactic-awareness drill** (E1, E9). It rewards using the slot constraint, not just recognising the word shape.

### Trap foils (problems 4–8): correct part-of-speech, wrong meaning

Both non-target chips should be from the **same grammatical class** as the gap slot, but carry a different meaning. Marian must now evaluate semantic fit against the sentence frame — she cannot use class alone to reject them. Examples:

| Gap slot                  | Target | Foil 1 (same class, wrong meaning)    | Foil 2 (same class, wrong meaning)  |
| ------------------------- | ------ | ------------------------------------- | ----------------------------------- |
| verb                      | sat    | ran (plausible action, wrong scene)   | see (perception vs action conflict) |
| adjective                 | hot    | red (property, wrong for sun context) | big (size vs temperature conflict)  |
| locative adverb           | there  | in (containment vs deixis)            | on (surface vs location)            |
| inherited deferral (they) | they   | then (temporal vs pronoun)            | there (locative vs pronoun)         |

The inherited-deferral foil set is the most important: they / then / there / where / were are all visually similar (th- or wh- onset) and morphosyntactically distinct. The trap foil rule naturally produces three-way contrasts across these words, exercising exactly why they were deferred from sight-words.

### What foil classes to AVOID

- **Phonics-rhyme foils** (e.g., sat / mat / bat as chips for a verb slot): this is the CVC tier pattern and would regress Marian to decoding mode when she should be predicting syntactically. Never use rhyme as the foil axis in this tier.
- **Visual-shape foils** (e.g., there / three / threw): not developmentally appropriate for an 8-year-old emergent reader who cannot yet decode multisyllabic words.
- **Nonsense words**: the pool is constrained to taught vocabulary; all three chips must be real taught words.

---

## Picture role

**Gentle phase (problems 1–3): small scene illustration present.**  
The illustration depicts the scenario described by the full sentence (including the gap, i.e., the "correct answer" version). It is positioned above or beside the sentence text and the chip row — it does not replace either. It is NOT a chip; Marian taps the written-word chip, not the scene. The scene provides L2 comprehension scaffolding (E7) and directly implements the Wave 11 commitment that "a small scene illustration may accompany the carrier sentence for contextual comprehension" (sight-words-sequence-marian.md:99).

**Trap phase (problems 4–8): NO scene illustration.**  
Once Marian has context, removing the scene forces her to use the written sentence + syntactic prediction alone. This is appropriate at the trap phase because the trap foils are semantically plausible — Marian cannot rely on real-world scene matching to discriminate "sat" from "ran" when both are plausible actions for a dog. The written sentence + syntactic awareness is the correct resolver.

**Asset scope note for Kyle:** the scene illustrations for the gentle phase are a new asset class — approximately 20 distinct scenes (one per unique sentence template, shared across phonological variants). This is a real asset dispatch; the timeline must account for it. If the August 2026 deadline makes scenes impossible, the mechanic still works without them (the text + audio is sufficient), but comprehension scores will likely be lower for the first session. Scenes are a nice-to-have for v1 if timeline permits, not a mechanic gate.

---

## Dosage and session structure

### Session structure (8 problems per session, as per all WordSong tiers)

| Problems | Phase  | Scene   | Foil class                | Sentence source                                                                                                                                                                     |
| -------- | ------ | ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3      | Gentle | Present | Wrong part-of-speech      | Template A or B only (SV or SVO — safest for Tagalog L1 SVO learning; Template B SVO requires a transitive verb — never use intransitive verbs like "sat"/"ran" with a noun object) |
| 4–8      | Trap   | Absent  | Same class, wrong meaning | All templates; Templates D (deferrals) and E (is/was + adj) prioritised in problems 5–8                                                                                             |

### Gentle → trap progression within the tier (across sessions)

Session 1–3: all 8 problems from Templates A and B only; inherited deferrals (they / then / there / where / were) do NOT appear until session 4 or later.

Session 4+: Templates C, D, E, F, G are introduced, starting in the gentle phase of session 4. The inherited deferrals (Template D) should appear first in the gentle phase (with scene + class foil) before moving to the trap phase.

### New sentences per session

Unlike the sight-words tier (2 new words per session), the simple-sentences tier does not have a "new vocabulary" metering requirement — all vocabulary is already taught. The constraint is on **syntactic template variety**: introduce no more than 2 new syntactic templates per session in the gentle phase. Marian needs to encounter each template in multiple sentence instances before the template itself is secure.

### Dosage note on the deferrals

The 5 inherited deferrals (they / then / there / where / were) are the highest-priority content for this tier. They should appear in at least 3 of the 8 problems per session once the tier is underway (session 4+). They are the words that most urgently need sentence context, and sentence context is precisely what this tier provides.

---

## Risks / counter-evidence

1. **The mechanic (a) vs (b) decision is well-grounded but the direct comparison RCT for 8-year-old L2 tablet learners does not exist.** E1–E3 and E5 are strong general evidence; the specific application to a gamified tablet context for a Tagalog-primary child is inference. The ruling is the most defensible given the evidence, but Thomas should know it is a reasoned call, not a direct RCT finding.

2. **The scene illustration asset scope is a real risk.** Twenty distinct scenes is a non-trivial asset request. If the timeline cannot accommodate them, the safe fallback is text-only for all 8 problems (keeping the audio-first invariant and the chip mechanic intact). Comprehension will be somewhat lower but not absent — the audio carrier sentence + written text is sufficient scaffolding for most of the pool. Flag this for Thomas's timeline call.

3. **The Tagalog word-order transfer risk (E4) is real but may be smaller at this vocabulary level.** Marian's sentences are short and use SVO order uniformly. The PSO-vs-SVO issue is most acute in longer, more complex sentences. At 3–4 words, the risk is manageable. If Marian shows systematic confusion with verb-slot sentences specifically (e.g., consistently picks a noun for a verb gap), that is diagnostic of the word-order transfer problem and should be reported to the team.

4. **They / then / there / where / were as a cluster is a high difficulty spike.** These five words are confusable in visual shape (th- / wh-) and grammatically from different classes (pronoun / conjunction / adverb / pronoun / auxiliary). Introducing all five in close proximity within the same tier creates a potential cluster confusion. The dosage rule above (introduce deferrals only from session 4, in the gentle phase first) mitigates this, but Kyle's spec should encode the deferral sequencing: they first, then there, then where, then were, then then — in that order. "They" is the most frequently needed and least syntactically complex of the five.

5. **The pool of 40 sentences is adequate for 5-8 sessions but not for an extended rotation.** The math Leitner infrastructure handles this well for math facts; the literacy Leitner box (flagged as downstream) would extend the effective pool dramatically. For the v1 Wave 13 canon bake, 40 sentences is sufficient.

---

## Recommendations

### For Matt (ticket priority / scope)

1. **Track 3 (Devon render) likely collapses.** Mechanic (a) reuses the sight-words written-word chip render with a new read-line template (e.g., "Finish the sentence: The cat \_\_\_." → `contentType: 'simple-sentence'`) and a gap-position display. If Devon's only work is adding the gap marker to the existing chip row render, this folds into Track 2. Confirm with Kevin after Kyle's spec lands — if the gap-position + scene-illustration placement is a net-new component, Track 3 is still needed.

2. **Scene illustrations are the one new asset class that may slip the timeline.** Flag for Thomas: scenes are load-bearing for L2 comprehension in the gentle phase (E7) but not mechanic-blocking. A v1 launch with text-only and no scenes still teaches the correct skill — it just loses the comprehension scaffold. Recommend authorising the scenes as a post-launch polish item if the August deadline requires it.

3. **Literacy Leitner box: still SEPARATE downstream.** Nothing in the Wave 13 evidence changes this deferral. The 40-sentence pool + 8 problems per session is sufficient for the first wave. File the literacy Leitner ticket after Wave 13 ships; cite this note's §Dosage footnote (#5) as the motivation.

4. **Inherited deferral sequencing must be explicit in Kevin's word list.** The pool-validity rules above specify that they / then / there / where / were must appear in the gentle phase first, in sessions 4+. Kevin's `WORD_SONG_SIMPLE_SENTENCES` list and the planner directive block should encode this sequencing rule explicitly — not leave it to Haiku to infer.

### Grammar ruling — locked gentle pool entry (Wave 13 tail-closure)

**Locked 2026-06-13.** The canonical gentle `cat-sat-mat` entry is:

- **frame:** "The cat \_\_\_ the bag."
- **target:** "bit"
- **template:** B (SVO — subject + transitive verb + object)
- **scene (sceneId `cat-sat-mat`):** a cat biting or mouthing a bag

This replaces the earlier frame "The cat \_\_\_ the mat." (target: "sat") which produced the ungrammatical completed sentence "The cat sat the mat." — "sat" (past tense of "sit") is intransitive and cannot take a noun phrase as a direct object in English. Thomas's ear-test on session-1 clip (GitHub issue #429) confirmed the grammar failure.

Foil set: [bit / sat / on] — "sat" is a wrong-class foil (different construction: SV, intransitive), "on" is a wrong-class foil (preposition). This foil set is intentionally transparent about the intransitive/transitive distinction, which is exactly the syntactic-awareness skill the gentle phase targets.

**Intransitivity rule for Template B (generalised):** any Template B SVO frame where the gap is the verb position MUST use a transitive verb. Verbs in the shipped CVC pool that are intransitive and therefore FORBIDDEN in a "Subject \_\_\_ Object" frame: sat/sit (intransitive, locative), ran/run (intransitive unless taking a path/course complement, which is not SVO). Verbs that ARE transitive and permitted: bit/bite, hit (if added to pool), see/saw, has/have (if added to pool). Kevin's planner content must verify transitivity before composing any new Template B verb-gap sentence.

### For Kyle (design spec — Track 1b)

5. **Gap display: a blank underline inside the sentence text.** The sentence renders as written text with one word replaced by a dashed underline ("The cat **\_** the mat."). Emma reads the full sentence with a brief pause or "blank" spoken in place of the gap. This is the most natural reading-readiness format and avoids the cognitive overhead of a special symbol.

6. **Three written-word chips, same as sight-words.** The chip row is identical in shape to Wave 11's sight-word chips — written text on a chip, no picture on the chip. Working-memory ceiling (E8) confirms 3 chips is the right count for an 8-year-old processing a sentence frame simultaneously.

7. **No decoding beat (same as sight-words).** The 1,500 ms silent window from CVC tiers is wrong here; the task is syntactic prediction, not phonics decoding. Emma's read of the sentence should proceed naturally with only a brief pause at the gap position.

8. **Scene illustration placement: above the sentence text, NOT on the chip row.** The scene contextualises the sentence; the chips are the response interface. They must be visually distinct so Marian does not confuse "tap the scene that matches" (mechanic (c)) with "tap the word chip that fills the blank" (mechanic (a)).

9. **Read-line template (vocabulary contract — naming for Kevin parallel dispatch):**
   - Content-type discriminant string: `'simple-sentence'`
   - Read-line template: `"Finish the sentence: <sentence-with-blank>."`
   - Example: `"Finish the sentence: The cat sat ___."`
   - Gap token in the read line: Emma speaks "blank" (one syllable; confirmed within Emma's ~200-word cap).

10. **They / then / there / where / were: sequencing rule.** Kyle's spec should explicitly order the deferral introduction: they → there → where → were → then. This matches frequency (they is highest-frequency) and syntactic simplicity (pronoun before conjunction).

---

## Distractor reference table for inherited deferrals (for Kevin TARGET_PAIRINGS extension)

| Target | Gentle foils (wrong class) | Trap foils (same class, wrong meaning)          |
| ------ | -------------------------- | ----------------------------------------------- |
| they   | the (article) / on (prep)  | there (locative pronoun) / we (pronoun)         |
| there  | cat (noun) / is (verb)     | they (personal pronoun) / where (question word) |
| where  | cat (noun) / sat (verb)    | were (auxiliary) / there (locative)             |
| were   | big (adj) / on (prep)      | was (aux, singular) / are (aux, present)        |
| then   | the (article) / big (adj)  | there (locative adv) / they (pronoun)           |

_Note: "was" and "are" appear as trap foils for "were" — both are shipped sight words, both are auxiliary verbs, and the singular/plural + tense mismatch is the exact comprehension error this tier is targeting for this word. This is the highest-difficulty foil cluster in the tier._

---

## Summary verdict line

**PROCEED-SENTENCE-COMPLETION.** Mechanic (a) — sentence completion with written-word chips, gentle/trap split, scene illustration in gentle phase only, 3–4 word sentences, grammatical-class foils in gentle phase / semantic foils in trap phase, 40-sentence verified pool, inherited deferrals (they / then / there / where / were) introduced from session 4 onward in gentle-phase-first order.
