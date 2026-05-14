# Digraph `sh` — Long-Vowel Onset Pool Addendum

**Date:** 2026-05-14
**Requested by:** Matt (via orchestrator) — confirms or blocks Thomas's Option C lock for the `digraphs-sh` word pool
**Extends:** `design/research/digraph-acquisition-marian.md` §Q1–Q6 (digraph readiness + sequencing + L2 context)
**Gate ticket:** PR #212 (`design/digraphs-sh-words-and-prompts` branch, Kyle's `design/word-song/digraphs-sh-word-list.md`)

---

## §Q7 — Long-vowel sh-onsets in the first sh-introduction pool

### §Q7a — Is mixing short-vowel and long-vowel sh-onsets developmentally appropriate, or does it introduce vowel-phoneme noise that interferes with sh-phoneme learning?

#### Bottom line

Mixing short-vowel and long-vowel sh-onsets does **not** substantially interfere with the sh-phoneme learning target, provided the long-vowel words are scaffolded as whole-word audio+picture anchors rather than decode targets. The phonics concept being taught — "the letters `sh` together represent the single sound `/ʃ/`" — is constant across all vowel types following the digraph. The vowel-following is incidental to that lesson.

The concern with mixing is real but smaller than it first appears: the risk is not phonemic confusion between the `/ʃ/` phoneme itself (that is uniform), but rather orthographic confusion — if Marian tries to decode the rest-of-word after `sh` using rules she hasn't learned, she may produce errors that look like digraph-confusion but are actually vowel-pattern errors. This risk is managed by the scaffold design, not by pool restriction.

#### Evidence

**Source 1 — Reading Universe (UFLI) / University of Florida Literacy Institute. "Overview of Consonant Digraphs." https://readinguniverse.org/skill-explainer/phonics-patterns/consonant-digraphs-skill-explainer/overview-of-consonant-digraphs**

Moderate evidence (established structured-literacy curriculum; practitioner-facing synthesis of Science of Reading findings). The curriculum example words for the `sh` digraph tier are exclusively short-vowel CVC patterns: `ship, shack, mesh, hush`. The rationale given is that these words use "the letters and sounds students already know" — the digraph introduces one new element (the two-letter grapheme `/ʃ/`); the rest of the word is already within student capacity. Curriculum does not explicitly prohibit long-vowel sh-words, but its selection principle ("combine the new with the known") implies short-vowel priority.

**Source 2 — UFLI Foundations Scope and Sequence. https://spellingtestbuddy.com/resources/ufli-scope-and-sequence/ (summarizing https://ufli.education.ufl.edu/wp-content/uploads/2022/01/UFLI-Scope-and-Sequence-5-21-1.pdf)**

Strong evidence for sequencing relative positions (established structured-literacy curriculum, widely used, RCT-grounded). The UFLI scope is explicit on order:

- Digraphs (`sh, ch, th, wh`): **Lessons 42–46**
- R-controlled vowels (`ar, or, er/ir/ur`): **Lessons 77–83**
- Long vowel teams (`ea, ai, ay, ee, oa`) and magic-e: **Lessons 54–62, 84–94**

This is the key structural finding: r-controlled vowels come roughly 35 lessons after digraphs. Long vowel teams come anywhere from 8 to 50 lessons after digraphs depending on the pattern. A learner doing digraphs at Marian's current level has not yet formally covered any of these patterns. The sequence establishes that mixing these patterns in a digraph-tier pool is a departure from structured-literacy scope sequence.

**Source 3 — Phonics Hero. "Cognitive Load Theory and Phonics Instruction." https://phonicshero.com/cognitive-load-theory-phonics/**

Moderate evidence (practitioner curriculum with explicit CLT grounding; cites Perfetti 1999 and Sweller). Core principle directly relevant: "students learn that one letter represents a sound before learning that two or more letters represent a sound; elements are taught in sequence, in isolation before presenting all of the elements and their interactions." At ages 5–6, working memory can hold ~2 distinct items; at age 8, capacity is ~4–5 but still limited during novel phonics acquisition. Introducing multiple new orthographic patterns in a single tier (digraph + unlearned vowel pattern) increases element interactivity and raises intrinsic cognitive load.

The CLT argument against mixing is probabilistic, not categorical: the more new elements in a session, the higher the chance that working memory bottleneck routes errors through the digraph itself. But this is manageable with scaffold design.

**Source 4 — Colorín Colorado. "Phonics Instruction for English Language Learners." https://www.colorincolorado.org/article/phonics-instruction-english-language-learners**

Strong evidence (draws on NICHD and NRP findings; established L2 literacy resource). The universal principle for ELL phonics: "use familiar vocabulary in phonics instruction; pre-teach words used for phonics practice so that ELLs understand the words they learn to decode." The picture+audio scaffold does exactly this pre-teaching. The practical implication: even a long-vowel sh-word can function as a decodable entry if the vocabulary is familiar and the word is audio-grounded. The scaffold converts the unfamiliar orthographic pattern into a retrieved whole-word form rather than a decode task.

**Assessment of the interference question:**

The risk of vowel-phoneme noise interfering with `/ʃ/` learning is **low** when:

1. The long-vowel words are whole-word anchors (heard from Emma, paired with a picture), not decode targets.
2. The child's task is recognition (which chip matches what Emma said?), not production.
3. The `sh` grapheme is consistently present and visually prominent at word onset across all 8 pool words.

The risk is **moderate** if the planner or canon ever asks Marian to segment or decode the long-vowel portion — e.g., "tell me each sound in s-h-e-e-p." The app's current design does not do this in the digraph tier; chip-tap recognition is the task. So the risk does not materialize in the current design.

---

### §Q7b — For Marian specifically (Tagalog L1, L2 English, 8yo), does sight-word-hybrid scaffolding bridge the gap, or does it stack too many learning targets?

#### Bottom line

Sight-word-hybrid scaffolding (picture + audio) is a **developmentally appropriate bridge** for high-familiarity long-vowel sh-onsets at Marian's level, provided two conditions hold: (1) the vocabulary is already in Marian's receptive English lexicon before it appears as a chip, and (2) the planner never frames the chip as a decode task. The cognitive load concern is real for low-familiarity words (`shore`, `shed`), not for high-familiarity ones (`shoe`, `sheep`, `shark`).

The CVC tier precedent is important here. Marian's existing CVC tier experience already includes three mechanisms that parallel the proposed scaffold:

- Picture anchors for vocabulary (every CVC word pairs with a picture).
- Audio from Emma for every word before or alongside Marian's recognition attempt.
- A handful of words that are phonics-irregular but vocabulary-familiar (`egg`, `box`/`fox` — treated as CVC-equivalent despite the double-letter coda).

The long-vowel sh-onsets extend this existing mechanism to a new pattern class. The added cognitive load is: Marian holds the `sh`-onset rule AND pattern-matches the rest-of-word against a memorized whole-word form. This is within working-memory capacity at 8 years, especially when the rest-of-word is already known as a whole word (shoe, sheep, shark).

#### Evidence

**Source 5 — Strauber et al. (2019/2020). "Using a picture-embedded method to support acquisition of sight words." _Learning and Instruction._ https://www.sciencedirect.com/science/article/pii/S0959475218308430; summary via ResearchGate https://www.researchgate.net/publication/338971029_Using_a_picture-embedded_method_to_support_acquisition_of_sight_words**

Moderate evidence (single RCT; n=69 junior-kindergarten children, ages 4–5; Ontario, Canada). Children taught words with picture-embedded support significantly outperformed word-alone condition on immediate post-test and retention. Effect held when combined with phonics instruction. Key mechanism: the picture provides a "relevant linking phrase and action that help build an association between picture and word." The Marian Tutor design replicates this mechanism: every chip is picture-paired + Emma-audio-paired, which is the exact scaffolding shown to work.

Strength caveat: participants were 4–5 year olds, not 8 year olds; L1 was English, not Tagalog. The effect would likely be at least as strong for Marian at 8 (more working-memory capacity, more existing English lexicon) as long as the vocabulary is known.

**Source 6 — Colorín Colorado (ibid., Source 4). "Phonics Instruction for English Language Learners."**

The L2-specific principle: showing pictures _before_ new words, matching pictures and words, and finding texts with photographs are explicitly recommended strategies for multilingual learners. The app's picture+audio scaffold for digraph chips is aligned with this recommendation. The critical qualifier: "students must know target words before practicing decoding them." This is the vocabulary-familiarity gate — which is why Kyle's per-word audit matters, and why the three marginal words (`shed`, `shop`, `shore`) warrant individual scrutiny.

**Source 7 — Keys to Literacy. "Phonics Instruction for English Learners." https://keystoliteracy.com/blog/phonics-instruction-for-english-learners/**

Moderate evidence (practitioner synthesis with curriculum grounding). Explicitly recommends that ELLs be taught phonics words whose vocabulary is pre-known, and that vocabulary pre-instruction accompany phonics instruction rather than following it. The sight-word-hybrid scaffold for long-vowel sh-onsets fulfills this recommendation by providing audio + picture as the vocabulary pre-instruction, embedded in the chip interaction itself.

**Comparison to Marian's CVC tier:**

In the CVC tiers, Marian's task is: hear Emma say a short word, find the matching chip by decoding (not just pattern-matching). The digraph tier, as designed, modifies this: hear Emma say a word, find the matching chip by recognizing the `sh` onset + whole-word visual pattern. For long-vowel hybrids, the decoding burden is shifted from "decode the vowel" to "recognize the whole word from the first two letters + audio." This is actually a **reduction** in decoding demand for those words, not an increase — which means cognitive load is not meaningfully higher than the CVC tier.

The real additional demand is meta-cognitive: Marian must hold two implicit rules simultaneously — "I decode most words" and "some words I recognize by whole-word + audio." At 8, this dual-mode awareness is within developmental reach. Research on reading development (Ehri's phases, 1995, 2005) shows that Phase 3 readers (full-alphabetic phase) can hold both decode and sight-word recognition simultaneously, and most 8-year-olds with any reading instruction are at or past this phase.

---

### §Q7c — Individual word analysis: are any of the 4 long-vowel candidates individually problematic for Marian's L2 stage?

#### Bottom line

`shoe` and `sheep` are clear passes. `shark` is a conditional pass (the `/ɑːr/` phoneme in English is phonetically distinct from Tagalog `/a/`, but `shark` is sufficiently high-familiarity that the whole-word scaffold handles this). `shore` is a genuine concern on two independent grounds — phonemic novelty of `/ɔːr/` AND composition complexity for the picture — and is the one word where a developmental recommendation diverges from Thomas's pool.

#### Per-word analysis

**`shoe` (sh + long `/uː/`)**

Tagalog has `/u/` as a vowel, and Tagalog-English bilinguals typically produce and perceive `/uː/` without notable difficulty (it is acoustically the same phoneme class). The word "shoe" is universally known vocabulary in Marian's L1 context: Tagalog loanword "sapatos" exists, but "shoe" itself is equally current in Filipino-English. The `oe` spelling is orthographically non-transparent for decoding, but this does not matter in the hybrid mode — Marian sees "shoe", hears Emma say `/ʃuː/`, sees a picture of a shoe, and maps `sh` → `/ʃ/`. The rest-of-word is whole-word retrieved. **Assessment: clear pass. No phonemic novelty beyond the `/ʃ/` digraph itself.**

**`sheep` (sh + long `/iː/` via vowel digraph `ee`)**

Tagalog `/i/` is the same phoneme class as English `/iː/`. The `ee` vowel digraph is not in Marian's formal instruction, but the sound is completely familiar. "Sheep" is storybook vocabulary — universally present in early-reader books worldwide, and the woolly-body silhouette is distinct. The Filipino word is "tupa", which means Marian may not have the English label productively, but the picture-audio scaffold builds the English label. **Assessment: clear pass. The phoneme is familiar; only the orthographic pattern (`ee`) is new, and that is handled by the scaffold.**

**`shark` (sh + r-controlled `/ɑːr/`)**

This is the most phonemically novel of the four. The r-controlled vowel `/ɑːr/` in English is a distinct phoneme that does not map cleanly onto Tagalog's vowel system. However:

1. Tagalog has `/a/` and a rhotic consonant `/r/`, so the individual components exist in Marian's phonological repertoire. The specific English "r-colored" vowel (where the `/r/` modifies the preceding vowel into a single phoneme) is a known L2 acquisition challenge — but this matters for production, not recognition.

2. In the chip-tap task, Marian is matching a heard word to a visual chip. She hears Emma say `/ʃɑːrk/` and sees a picture of a shark. She does not need to produce the r-controlled vowel or decode it. The `/ɑːr/` phoneme is at issue only if Marian mishears Emma's audio — which is unlikely for such a distinctive word.

3. The vocabulary familiarity of "shark" in Philippine English is very high. Tagalog/Filipino has "pating", but "shark" is the English loanword used in Filipino-English media, marine vocabulary, and early-reader books. The picture (triangular fin, streamlined body) is unambiguous.

4. The UFLI sequence places r-controlled vowels 35 lessons after digraphs, which confirms that formally introducing `ar` as a pattern here would be premature. But the hybrid scaffold does not formally introduce it — it treats `shark` as a whole-word sight-word entry, bypassing the `ar` pattern entirely.

**Assessment: conditional pass.** The `/ɑːr/` phoneme is phonemically novel for Marian's formal instruction level, but the combination of whole-word scaffold + high vocabulary familiarity + recognition-only task makes it manageable. If the planner or canon ever uses `shark` in a segment-the-word or spell-from-audio task, it becomes inappropriate. The condition is that `shark` must be permanently annotated as a hybrid/sight-word entry in the canon, never as a decode target.

**`shore` (sh + r-controlled `/ɔːr/`)**

`shore` accumulates concerns on two independent dimensions, either of which alone might be acceptable:

1. **Phonemic novelty:** `/ɔːr/` is more marked than `/ɑːr/`. The English vowel `/ɔː/` does not have a clean Tagalog equivalent (Tagalog `/o/` is a mid-back vowel but without the English rounding and length contrast). The `/ɔːr/` combination (r-controlled `/ɔː/`) is a phoneme that Tagalog-native speakers often produce and perceive poorly, mapping it to `/ɔ/` or `/o/`. This is a perceptual interference risk that is not present for `shoe`, `sheep`, or even `shark`. For a chip-tap recognition task, Marian might not confidently map Emma's `/ʃɔːr/` audio to the "shore" chip if the vowel is unfamiliar.

2. **Picture composition:** "Shore" requires depicting a scene (sand, water, beach boundary) rather than a single-subject object. Kyle's audit correctly flags this as a picture instability risk — the chip could read as "beach", "ocean", "sand", or "water", not specifically "shore". Multi-subject composition violates the single-subject style principle that has held across all CVC tiers.

Neither concern is catastrophic alone, but together they make `shore` the weakest candidate by a meaningful margin. There is no vocabulary familiarity advantage to offset these two risks — "shore" is not common in Philippine Filipino-English vocabulary at the 8-year-old register (the Filipino words "aplaya" or "dalampasigan" are the natural referents; "beach" is the English equivalent an 8yo would reach for, not "shore").

**Assessment: recommend drop.** `shore` is the only word in the proposed pool where two independent concerns compound: unfamiliar `/ɔːr/` phoneme + composition-unstable picture. The pool works at 7 without it.

---

### §Q7d — Recommendation: confirm Option C, recommend Option C-minus, or revert to Option A?

#### Bottom line

**Recommend Option C-minus:** Confirm long-vowel allowance for `shoe`, `sheep`, and `shark`, but drop `shore`. Pool size of 7 (`ship, shell, shoe, sheep, shark, shed, shop`). This is developmentally defensible, evidence-grounded, and removes the one word where two independent concerns compound without a compensating strength.

#### Reasoning

**Option A (4 short-vowel words only)** is too thin. A 4-word pool produces excessive in-session repetition across the 3–5 introduction sessions the planner needs to build sh-automaticity. The structured-literacy principle of "one new concept per session" applies to _concept introduction_, not to _pool variety_ — a thin pool that repeats the same 4 words is less effective than a varied pool that all teach the same digraph concept.

**Option C (8 words including `shore`)** is mostly defensible but `shore` is a genuine weak link. Keeping it accepts a known-weak entry for the sole purpose of hitting a round number. Kyle's original draft already flagged it as Phase-2 contingency. The evidence reviewed here converts that contingency into a recommendation: drop it now.

**Option C-minus (7 words: `ship, shell, shoe, sheep, shark, shed, shop`)** is the recommended call:

- **5 strong picks** (`ship, shell, shoe, sheep, shark`) — each passes the vocabulary-familiarity gate, the picture-distinctiveness gate, and the scaffold-appropriateness gate. The three with long-vowel or r-controlled vowel patterns (`shoe`, `sheep`, `shark`) are all high-familiarity words where the whole-word scaffold carries the orthographic novelty.
- **2 borderline-acceptable picks** (`shed, shop`) — vocabulary-register marginal for Marian's L1 context but learnable via the picture+audio scaffold, exactly as `gem` and `web` worked in the short-e tier. The picture prompt sheet (`digraphs-sh-picture-pack-prompts.md`) must address their picture-grounding risk explicitly.
- **`shore` dropped** — two independent compounding concerns (unfamiliar `/ɔːr/` vowel phoneme for Tagalog L1 + composition-complex picture) without compensating vocabulary familiarity.

A pool of 7 gives the planner enough variety to construct 3–5 introduction sessions with controlled repetition (roughly 4–5 sh-target words per session, rotating through the 7, without any session being purely repeat). This is adequate for digraph introduction, and slightly thinner than the CVC tiers by design — digraph words carry higher vocabulary risk per word, so a tighter pool with stronger entries is preferable to a padded pool with weaker ones.

#### Condition on `shark` (annotation requirement)

`shark` passes the developmental bar for inclusion, but only with a permanent hybrid annotation in the canon. The impl ticket (Kevin's planner-widen + canon-bake task) must:

- Mark `shark` (and `shoe`, `sheep`) as `hybridMode: true` or equivalent in the word-pack schema.
- Ensure the planner never generates a segmentation, spelling, or decode-from-phoneme prompt for these three words.
- The only valid planner prompts for hybrid words: "Listen to Emma, tap the word you hear" (recognition) and "What word does this picture show?" (retrieval).

If the planner architecture does not support per-word hybrid flags today, the short-term mitigation is to exclude these three from any session problem type that requires decoding. This is a scoping decision for the impl ticket, not this research note.

---

## Application to Marian

Marian's profile as of May 2026:

- Short vowels: a (mastered), o (at/approaching mastery), u (shipped), i (shipped), e (shipped).
- She has NOT been formally introduced to: long vowel teams (ee, oe, oo), magic-e patterns, or r-controlled vowels (ar, or, er).
- She has functional English vocabulary for: shoe, sheep, shark (high-familiarity across her L1 + storybook context). She has marginal English vocabulary for: shore, shed (vocabulary-register gap with her Filipino-English context).
- Tagalog phonology: `/ʃ/` is absent from Tagalog, which means the digraph-phoneme itself is the primary learning target across ALL 8 words. The vowel-following is secondary. This actually supports the mixed-vowel pool: Marian is not going to confuse `shoe` and `ship` at the vowel level — she is learning to distinguish `sh` from `s`, which is phoneme-invariant across the vowel following it.
- The chip-tap recognition task format (not production, not decoding) is well within her developmental reach at 8. The concern about cognitive overload from mixed vowel patterns is low in a recognition-only task compared to a production or spelling task.

**The practical risk for Marian is not "vowel confusion interfering with digraph learning." It is "picture ambiguity preventing correct word mapping" — which is exactly Kyle's picture-grounding concern, not a developmental-psychology concern.** Keep the two separate.

---

## Risks and counter-evidence

1. **Structured-literacy purist position:** The UFLI and OG curricula implicitly endorse short-vowel-only sh-pools because the curriculum example words are short-vowel-only and the sequencing places all long-vowel patterns after digraphs. A strict structured-literacy practitioner would say: thin pool is better than mixed-pattern pool. The counter: those curricula are designed for classroom instruction with 20–30 children and a structured scope-and-sequence spanning a full school year. Marian is a single child, one-on-one, in an audio+picture-first app where the scaffold explicitly handles the pattern load.

2. **Risk of pattern-confusion if the planner generates mixed-mode sessions:** If a single session mixes a short-vowel decode prompt for `ship` with a hybrid recognition prompt for `shark`, Marian may not understand that she is operating in two different cognitive modes in the same session. This is a planner-side risk, not a pool-side risk — but it argues for clear internal annotation of which words are hybrid vs. fully decodable.

3. **`shed` and `shop` vocabulary risk:** The recommendation to include these two was made by Kyle on the basis that the scaffold can build the vocabulary binding. That is true, but it requires the MJ picture to unambiguously represent the intended referent. If MJ generates a `shed` that reads as "small house" at 96pt, the scaffold fails. The picture-pack prompt sheet must be tested against this risk before canon-bake.

4. **Unknown evidence on mixing decodable + hybrid words in a single tier:** There is no direct research literature on the specific question of whether mixing decodable-CVC-mode and whole-word-recognition-mode within the same phonics tier (same session, same digraph target) causes confusion in 8-year-old L2 learners. The recommendation here is based on inference from CLT principles and the existing scaffold design — not a direct RCT on this exact design. The evidence for Option C-minus is moderate, not strong.

---

## Recommendations

1. **Confirm Option C-minus: pool of 7** (`ship, shell, shoe, sheep, shark, shed, shop`). Drop `shore`.

2. **Mark `shoe`, `sheep`, `shark` as hybrid/sight-word entries** in the canon-bake and planner. These three must never receive decode, segment, or spell prompts. Kevin's impl ticket should add a per-word `hybridMode` flag (or equivalent) to the digraph word-pack schema.

3. **The three marginal words' pictures must pass a single-session picture-recognition check** before canon-bake: show the MJ-generated `shed`, `shop` chips to one adult unfamiliar with the word choices, confirm they name the intended word (or at least the intended semantic category) from the image alone. If they don't, replace with the next-best candidate or accept a pool of 5–6 strong words over a padded pool of 7 with picture failures.

4. **Do not add `shore` to a later tier until r-controlled vowels (`or` pattern) are formally introduced.** At that point, `shore` becomes a legitimate sh-tier word with a taught vowel pattern — and then the picture composition concern can be addressed with a cleaner scene prompt. Flag in `design/research/digraph-sh-long-vowel-addendum.md` as "deferred to r-controlled tier."

5. **The planner and canon-bake ticket should document the 7-word pool split explicitly:** 4 fully decodable (ship, shell, shed, shop) + 3 hybrid (shoe, sheep, shark). Session composition rules should weight fully-decodable words higher in introduction sessions (decoding practice is the core task), and bring in hybrid words as recognition-only warm-up or wind-down items.

---

## §Q8 — Phoneme-tag PR sequencing (K5-A combined vs K5-B separate): is there a developmental signal?

### §Q8a — Does phoneme-tag lag affect when voiced /ð/ is safely protected in the infrastructure?

No — but the question has to be framed correctly. The developmental protection from voiced /ð/ entering chip-tap content is not provided by the phoneme-tag field existing in the schema. It is provided by: (a) the planner not generating chip-tap problems for voiced /ð/ words, and (b) the canon-bake not including voiced /ð/ words in the digraph tier's word pool.

The phoneme-tag is an annotation that makes the protection legible, auditable, and enforceable by code — it converts an informal "we decided not to do this" into a machine-readable flag that a planner guard or canon-validator can check. But the voiced /ð/ words are not in Marian's digraph word pool at all right now. They were deferred in the spec (`digraphs-sh-word-list.md` §Out-of-scope). The absence of the phoneme-tag does not expose Marian to voiced /ð/ content; it only means the infrastructure protection is informal rather than formal.

**Developmental bottom line for §Q8a:** Phoneme-tag delay has no effect on Marian's learning experience because voiced /ð/ content won't enter her sessions regardless of whether the tag exists. The tag matters for future content hygiene, not for current session safety. There is no developmental urgency.

### §Q8b — Is there a developmental cost to having phoneme-tag lag behind the SkillNode-split?

No developmental cost to Marian. The phoneme-tag field is infrastructure that annotates content; it does not alter what Marian sees in a session. The SkillNode-split (3 sibling nodes for sh/ch/th) determines whether Marian's progress is tracked at the digraph-granularity the spec requires. The phoneme-tag determines whether the code can programmatically distinguish `/g/` from `/dʒ/` in `gum`/`gem`.

Marian only encounters digraph content once the sh-word-pool is canon-baked and the planner is widened. At that point, both the SkillNode-split and the phoneme-tag need to be in place. But neither needs to be in place before the content ships as a pair — and neither causes a developmental problem during the period between one shipping and the other, as long as:

1. The `gem` / `gum` grapheme collision is not surfaced to Marian in the same session before phoneme-tag is shipped (this is already protected by the same-vowel-only rule that still holds in the CVC tier, not by phoneme-tag).
2. The digraph-tier canon-bake doesn't run until both are deployed.

**Developmental bottom line for §Q8b:** The ordering of SkillNode-split vs phoneme-tag is invisible to Marian as long as actual digraph content (canon-bake + planner-widen) does not deploy until both pieces are in place. If the impl timeline has the two PRs landing within 1–2 days of each other, the ordering is irrelevant. If one is significantly delayed, the other can be deployed without developmental risk — it just won't do anything until content also ships.

### §Q8c — Net call: K5-A or K5-B?

**No developmental signal either way.** This is a code-shape decision only.

The developmental perspective adds nothing to the Kevin/Devon coin-flip. Both paths land the same protection for Marian before she ever sees digraph content, as long as canon-bake is gated on both pieces being deployed.

The one developmental-adjacent consideration I would surface is: the `gum`/`gem` grapheme-collision is a latent data integrity risk that phoneme-tag resolves. If K5-B (separate PRs) means Devon's phoneme-tag PR slips significantly behind Kevin's SkillNode-split, there is a window where the SkillNode architecture accepts digraph words but the phoneme-tag guardrail is absent. During that window, a planner or canon-bake mistake could surface `gem` and `gum` in the same session with a same-vowel-only distractor selected on `/ɛ/` alone — which would be a data-shape bug, not a developmental one. This is a narrow risk and a dev-side concern, not a pedagogy concern.

**If anything, this slightly favors K5-A (bundled)** — because it closes the window where SkillNode-split is live but phoneme-tag protection is absent. But the margin is small and Thomas should weigh code-review complexity and Kevin/Devon bandwidth against it. From the developmental side only: no preference, defer to Matt and the dev team.
