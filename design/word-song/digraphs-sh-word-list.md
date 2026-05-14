# Word Song — digraphs `sh` word list (8 words, sh-initial only)

**Ticket:** TBD — Matt to file. This spec lands the design-side word selection. Implementation downstream (Kevin's planner-widen + `SkillNode` decision + canon-bake; Devon's `wordPack.ts` + picture-pack embed wiring; sequencing of `digraphs-ch` and `digraphs-th` are separate specs).
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14 — gates this spec), `design/research/phonics-sequence-marian.md` (2026-04-26 — vowel-tier precedent).
**Companion spec:** `design/word-song/digraphs-sh-picture-pack-prompts.md` (Phase-1 MJ prompt sheet sibling).
**Predecessor pool specs (format reference):** `design/word-song/short-e-pool-expansion.md`, `design/word-song/short-i-pool-expansion.md`, `design/word-song/short-u-pool-expansion.md`, `design/word-song/short-o-pool-expansion.md`.

---

## Why this spec, why now

Per Dave's research (`digraph-acquisition-marian.md` §Q1, §Q6):

- Marian is developmentally ready for digraph instruction now. The readiness gate (~90% CVC accuracy across two+ short-vowel families) is met — short-a is mastered, short-o and short-u are at or approaching mastery, short-i shipped, short-e shipped as of PR #208.
- The introduction order is **`sh` first**, `ch` second, voiceless `th` third. Voiced `/ð/` is deferred entirely.
- 8–10 words per digraph, isolated-tier introduction (no interleaving with CVC content yet).
- **sh-initial position first** (Dave finding #3). Sh-final words (fish, dish, rush, wish, crash) are deferred to a follow-up arc once the digraph concept is consolidated.
- **Vocabulary-familiarity is the binding constraint** — stricter than CVC tiers (Dave finding #4). Marian must recognize the picture without verbal scaffolding, because each digraph word now carries TWO new things (new orthographic pattern AND, for many words, new vocabulary). The CVC tiers got vocabulary mostly for free (cat, dog, sun); digraphs do not.
- L2 risk: `/ʃ/` → `/s/` substitution (Tagalog lacks `/ʃ/`). Picture-grounding the chip is the design response — the audio `/ʃ/` needs a referent Marian can hold.

**Scope of this spec:** word selection (audit + final pool of 8), focus-node naming guidance (not architecture — Kevin is auditing the `SkillNode` shape in parallel per Dave finding #1+#2), picture-pack requirements summary, and the open questions Thomas needs to lock. The companion MJ prompt sheet [`digraphs-sh-picture-pack-prompts.md`](./digraphs-sh-picture-pack-prompts.md) carries the per-word generation prompts (Phase 1 deliverable for Thomas).

**Out-of-scope (deferred):**

- `SkillNode` shape decision (one `digraphs` node vs. three sibling nodes vs. one node with internal sub-tier progression) — Kevin's audit owns this.
- `digraphs-ch` and `digraphs-th` word lists — separate specs, downstream after sh ships.
- Sh-final words (fish, dish, rush, wish, crash) — separate follow-up arc.
- Voiced `/ð/` content — deferred indefinitely from chip-tap; treated as sight-word domain per Dave §Q2.
- Distractor architecture refactor for digraph-vs-CVC contrast distractors (e.g. ship/sip pair) — flagged in §6 for Kevin's impl ticket; out-of-scope for this design pass.
- Sh-vs-ch interleaving rules — only triggers after ch ships and both digraphs reach ~70%+ accuracy (Dave §Q5); planner-side composition decision, not a word-list decision.

---

## 1. Word selection — the 8 sh-initial words

### Brief / source pool

Candidate sh-initial CVC words from Dave's research §Application + standard structured-literacy lists (UFLI sh-word set, Wilson Reading sh-list, Reading Universe sh-introduction corpus, OG Phase 4 sh-CVC list):

- **Sh-CVC (3 letters, sh + short vowel + consonant):** `shop`, `shed`, `shut`, `shag`, `shun`, `shim`, `sham`, `shod`, `shin`, `shes` (n/a).
- **Sh-CVCC or with consonant-vowel-consonant-blend (still single-syllable):** `ship`, `shell`, `shock`, `shall`, `shelf`, `shrub`, `shrimp`.
- **Sh-CCV / sh-CVCe (long-vowel sh-onset):** `she`, `shoe`, `show`, `shy`, `shore`, `share`, `shape`, `shine`, `sheep`, `shark`.

Dave's research is explicit on:

- 8–10 words per digraph (§Q4 — lower end of CVC tier range due to vocabulary uncertainty).
- Single-syllable, picturable, in or adjacent to Marian's oral vocabulary (§Q4, §recommendations to Kyle #3).
- sh-INITIAL position only (§Q3 — Dave finding #3).
- Universal concrete items — Marian's L1 is Tagalog, so culturally-loaded picks are out (Brookes/Cardenas-Hagan / §Q4).

Dave's research is **silent** on whether to allow long-vowel sh-onsets (`she`, `sheep`, `shoe`, `shark`) inside the first-round pool. This is the load-bearing pool-shape decision below.

### Audit of the candidate set

Audited against v1 word-pack constraints (single-syllable, picturable, distinct silhouette at 96pt, vocabulary-familiar for an L2 8yo, sh-initial position):

| Word       | sh-init | Pattern                                                                          | Concrete                                                                                                                                                                                                                                 | Picturable for L2 8yo                                                                                                                                                                               | Vocabulary risk                                                                                                                                                                       | Silhouette risk                                                                                                                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ship**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✓ (boat)                                                                                                                                                                                                                                 | ✓ — clear vessel silhouette with hull + mast / smokestack + portholes                                                                                                                               | High-frequency, universal in early-reader books; "ship" appears in Manila harbor context                                                                                              | Moderate vs `tub` (open-vessel) — but ship has hull + visible above-waterline structure; tub is empty open-top oval. **Low risk.** | **KEEP**                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **shop**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✓ but ambiguous — "shop" is a place (storefront) AND a verb. The storefront picture reads as "store" or "store" — the noun "shop" is borderline for an 8yo Filipino L1 learner whose English vocabulary leans toward "store" not "shop". | Marginal — Filipino-English commonly uses "store" or "tindahan" not "shop" for the everyday corner store. The "shop" reading is more British/American.                                              | Marginal — vocabulary register doesn't match Marian's L1 dialect of English                                                                                                           | Moderate — shopfront/storefront silhouette could read as "house" without explicit awning + window signs                            | **REPLACE** — vocabulary register mismatch + composition complexity. The storefront picture would need detailed environmental cues (awning, sign, window display) which violate the single-subject style anchor.                                                                                                                                                                                                                    |
| **shed**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✓ (small outbuilding)                                                                                                                                                                                                                    | Marginal — "shed" is uncommon in Filipino-English domestic vocabulary (Filipino homes use "kubo" or "garahe" or just "small building"; "shed" specifically is a UK/US garden-house word).           | Vocab risk for an 8yo Manila L2 learner                                                                                                                                               | Moderate — small-building silhouette could read as "house" without disambiguating roofline                                         | **REPLACE** — vocabulary risk. The picture would need a workshop-shed feel (visible door + sloped roof + smaller-than-house scale) that may not read as the target noun.                                                                                                                                                                                                                                                            |
| **shut**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✗ — verb / adjective                                                                                                                                                                                                                     | n/a — "shut" is an action; no stable noun-form picture                                                                                                                                              | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — verb-class problem (parallels short-e `set, get, met, yet, wet` rejections).                                                                                                                                                                                                                                                                                                                                          |
| **shall**  | ✓       | sh-CVCC (5 letters; double-l geminate)                                           | ✗ — modal verb                                                                                                                                                                                                                           | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — function word.                                                                                                                                                                                                                                                                                                                                                                                                        |
| **shag**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | Marginal — "shag" as a noun (carpet pile / type of bird) is obscure; the verb sense is inappropriate for 8yo content                                                                                                                     | n/a                                                                                                                                                                                                 | **HARD REJECT** — vocabulary + content concerns                                                                                                                                       | n/a                                                                                                                                | **REPLACE** — vocab + content risk.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **shun**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✗ — verb (to reject)                                                                                                                                                                                                                     | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — verb-class.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **shim**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✓ (small wedge) but **archaic / specialist vocabulary**                                                                                                                                                                                  | n/a                                                                                                                                                                                                 | **HARD REJECT** — vocabulary not in 8yo register                                                                                                                                      | n/a                                                                                                                                | **REPLACE** — vocab risk (parallels short-e `peg` rejection).                                                                                                                                                                                                                                                                                                                                                                       |
| **sham**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✗ — abstract noun (a fake / fraud)                                                                                                                                                                                                       | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — abstract.                                                                                                                                                                                                                                                                                                                                                                                                             |
| **shod**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✗ — archaic past participle of "shoe"                                                                                                                                                                                                    | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — archaic.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **shin**   | ✓       | sh-CVC (3 phonemes / 4 letters)                                                  | ✓ (body part — front of lower leg)                                                                                                                                                                                                       | ✓ technically but **body-fragment imagery risk** (parallels the short-e `leg` framing concern); single-shin reads as "leg" anyway                                                                   | Vocab moderate; "shin" specifically is uncommon in 8yo vocabulary                                                                                                                     | Body-fragment risk + collides with the short-e `leg` chip read at 96pt                                                             | **REPLACE** — body-fragment + vocab risk.                                                                                                                                                                                                                                                                                                                                                                                           |
| **shell**  | ✓       | sh-CVCC (5 letters; double-l geminate) — phonetically sh + ɛ + l (3 phonemes)    | ✓ (seashell — concrete object, picturable)                                                                                                                                                                                               | ✓ — spiral or scallop seashell silhouette is universal and distinct                                                                                                                                 | High — "shell" is in early-reader vocabulary and Manila beach context (universal in PH).                                                                                              | Low — spiral / fluted-cone silhouette is unique vs the existing pack.                                                              | **KEEP** under the same 3-phoneme-CVC precedent as `egg` (short-e §1) and `box`/`fox` (short-o). The geminate `ll` decodes as a single `/l/`. Practitioner curricula universally list `shell` in the sh-CVC introduction pool (UFLI, Reading Universe).                                                                                                                                                                             |
| **shock**  | ✓       | sh-CVCC (5 letters; `ck` digraph at coda) — phonetically sh + ɒ + k (3 phonemes) | ✗ — abstract noun / verb (surprise)                                                                                                                                                                                                      | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — abstract.                                                                                                                                                                                                                                                                                                                                                                                                             |
| **shelf**  | ✓       | sh-CVCC (5 letters; `lf` blend at coda)                                          | ✓ (furniture component)                                                                                                                                                                                                                  | Marginal — empty shelf silhouette reads as "board" or "plank" without context; shelf-with-objects introduces second subjects                                                                        | Vocab OK                                                                                                                                                                              | Picture instability                                                                                                                | **REPLACE** — picture-side instability.                                                                                                                                                                                                                                                                                                                                                                                             |
| **shrub**  | ✓       | sh-CCVCC (`shr` onset blend + ub coda) — 4 phonemes                              | ✓ (small bush)                                                                                                                                                                                                                           | Marginal — "shrub" is uncommon in 8yo vocabulary; reads as "bush" or "plant"; **also has a consonant-blend `shr` that violates the sh-isolation principle — Dave §Q3 hasn't introduced blends yet** | Vocab + blend-pattern violation                                                                                                                                                       | n/a                                                                                                                                | **REPLACE** — `shr` is a consonant blend, not a clean digraph introduction. Defer to a later tier.                                                                                                                                                                                                                                                                                                                                  |
| **shrimp** | ✓       | sh-CCVCC                                                                         | ✓ (food / sea creature)                                                                                                                                                                                                                  | ✓ — distinctive curled body                                                                                                                                                                         | **HARD REJECT — `shr` blend violation** (same as `shrub`)                                                                                                                             | n/a                                                                                                                                | **REPLACE** — `shr` blend; defer.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **she**    | ✓       | sh-CCV / sh+long-e (sh-V — 2 phonemes)                                           | ✗ — pronoun                                                                                                                                                                                                                              | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — function word; also non-CVC (no final consonant).                                                                                                                                                                                                                                                                                                                                                                     |
| **shoe**   | ✓       | sh-CCV / sh+long-oo (3 letters: s-h-o-e)                                         | ✓ (footwear)                                                                                                                                                                                                                             | ✓ — universal silhouette                                                                                                                                                                            | High-frequency, universal. **Long-vowel /uː/ inside.**                                                                                                                                | Low — distinct silhouette                                                                                                          | **KEEP UNDER LONG-VOWEL ALLOWANCE — see §1.3 below for the policy call.**                                                                                                                                                                                                                                                                                                                                                           |
| **show**   | ✓       | sh-CCVowel / sh+long-o                                                           | ✗ — verb / abstract noun                                                                                                                                                                                                                 | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE**.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **shy**    | ✓       | sh-CCV / sh+long-i                                                               | ✗ — adjective                                                                                                                                                                                                                            | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE**.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **shore**  | ✓       | sh-CCVCe / sh+long-o+r (`r`-controlled)                                          | ✓ but place-noun + needs water + land in composition                                                                                                                                                                                     | Vocab borderline                                                                                                                                                                                    | Multi-subject composition                                                                                                                                                             | **REPLACE** — composition complexity + vocabulary marginal.                                                                        |
| **share**  | ✓       | sh-CCVCe / sh+long-a+r (`r`-controlled)                                          | ✗ — verb                                                                                                                                                                                                                                 | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE**.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **shape**  | ✓       | sh-CCVCe / sh+long-a (magic-e)                                                   | ✗ — abstract noun (the concept of shape)                                                                                                                                                                                                 | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE** — abstract.                                                                                                                                                                                                                                                                                                                                                                                                             |
| **shine**  | ✓       | sh-CCVCe / sh+long-i (magic-e)                                                   | ✗ — verb / abstract                                                                                                                                                                                                                      | n/a                                                                                                                                                                                                 | n/a                                                                                                                                                                                   | n/a                                                                                                                                | **REPLACE**.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **sheep**  | ✓       | sh-CCVVC / sh+long-e (vowel digraph `ee`)                                        | ✓ (farm animal)                                                                                                                                                                                                                          | ✓ — woolly body + small head + four legs is distinct                                                                                                                                                | High-frequency in early-reader books; in Manila context, sheep are less common than carabao but the picture-grounded vocabulary is solid (storybook recognition)                      | Low — woolly-body silhouette is unique in the pack                                                                                 | **KEEP UNDER LONG-VOWEL ALLOWANCE — see §1.3.**                                                                                                                                                                                                                                                                                                                                                                                     |
| **shark**  | ✓       | sh-CCVCC / sh+`r`-controlled-`a` (`ar` controlled-r)                             | ✓ (sea creature)                                                                                                                                                                                                                         | ✓ — distinctive triangular fin + sleek body                                                                                                                                                         | High-frequency in early-reader and Manila-context (PH archipelago, fishing culture). **Has the `ar` r-controlled vowel inside — Marian has NOT been taught r-controlled vowels yet.** | Low — distinct silhouette                                                                                                          | **REPLACE — defer.** Even though "shark" is wonderfully picturable and high-vocabulary, the `ar` r-controlled vowel is a separate phonics pattern Marian has not learned. Putting it in the sh-introduction pool means the chip carries TWO new patterns (sh + `ar`), which violates the one-new-concept-per-session principle (§Q4 in phonics-sequence + Dave §Q4). Save for a later tier once r-controlled vowels are introduced. |

### Substitutions and additions — sourcing the remaining slots

The audit so far yields only **`ship`** as a strict-short-vowel sh-CVC keep, plus **`shell`** as a 3-phoneme geminate-CVC keep, plus the **long-vowel candidates** `shoe` and `sheep`. That is 4 strong entries. Dave's research wants 8–10. The audit will not yield 8 strong short-vowel sh-CVC words because the English sh-initial short-vowel-CVC noun stock is genuinely small — most sh-initial CVC words are verbs (shut, shop, shun, shed-as-verb), abstract (sham, shock), or vocabulary-archaic (shim, shod, shag).

**This is the load-bearing call: extend the pool to long-vowel sh-initial words to reach 8.** Justification in §1.3 below.

Adding long-vowel sh-initial candidates passing the audit:

| Word      | Pattern                                                              | Concrete            | Picturable for L2 8yo               | Vocabulary risk                                                              | Verdict                            |
| --------- | -------------------------------------------------------------------- | ------------------- | ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| **she**   | sh+long-e (2-letter / 2-phoneme)                                     | ✗ — pronoun         | n/a                                 | n/a                                                                          | **SKIP** — function word; non-CVC. |
| **shoe**  | sh+long-oo (3 letters)                                               | ✓ (footwear)        | ✓ — universal silhouette            | Low — "shoe" is in active 8yo vocabulary universally; PH context unambiguous | **KEEP**                           |
| **show**  | sh+long-o (3 letters)                                                | ✗ — verb / abstract | n/a                                 | n/a                                                                          | **SKIP**.                          |
| **sheep** | sh+long-e (vowel digraph `ee`)                                       | ✓ (farm animal)     | ✓ — woolly body distinct silhouette | Low — storybook recognition is solid, even in Manila context                 | **KEEP**                           |
| **shake** | sh+long-a (magic-e)                                                  | ✗ — verb            | n/a                                 | n/a                                                                          | **SKIP**.                          |
| **ship**  | (already KEEP above; listed here for completeness in the keep group) |                     |                                     |                                                                              | KEEP                               |
| **shell** | (already KEEP above)                                                 |                     |                                     |                                                                              | KEEP                               |

That gives the audit-honest keep list: **`ship, shell, shoe, sheep`** = 4 words. Still under 8.

### Re-audit — reconsidering rejected words under the "vocabulary-familiar AND picturable" lens

Going back through the rejection list with the lens "could MJ + remove.bg deliver a picture that an 8yo Filipino L1 reader would recognize as the target noun without scaffolding":

- **`shop`** — REPLACED for vocabulary register. **Reconsider:** A storefront picture with a clear awning + "shop" being the picture of a small store-front. The vocabulary risk persists ("store" is the L1-aligned word) but the picture itself is reasonably picturable. **Verdict:** still REPLACE — the register mismatch is the dominant concern, and the chip-side picture being a "store" silhouette would teach the wrong vocabulary anchor for "shop". Better to defer.
- **`shed`** — REPLACED for vocabulary register. **Reconsider:** A small garden-shed with sloped roof, door, single window. Picturable, but vocabulary remains "small building / kubo" in Marian's L1 register. **Verdict:** still REPLACE.
- **`shin`** — REPLACED for body-fragment imagery. **Verdict:** still REPLACE.
- **`shark`** — REPLACED for the `ar` r-controlled vowel. **Reconsider:** `shark` is overwhelmingly picturable and high-vocabulary. The `ar` phonics-load problem is the load-bearing concern. **Verdict:** still REPLACE for v1 — but flag in §6 as the strongest "add when r-controlled vowels are introduced" candidate.
- **`shelf`** — picture instability (empty shelf reads as "board"). **Verdict:** still REPLACE.

### Re-audit — searching for missed candidates

Going wider: sh-initial single-syllable concrete nouns that the audit may have missed:

| Word                                          | Pattern                           | Concrete                            | Picturable for L2 8yo                                              | Verdict                                                                                               |
| --------------------------------------------- | --------------------------------- | ----------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **shore**                                     | sh-CCVCe (r-controlled)           | ✓ (place)                           | Marginal — needs water + sand composition                          | **REPLACE** — composition + `ore` r-controlled vowel.                                                 |
| **shop** (re-examined as the storefront chip) | sh-CVC                            | ✓ (place)                           | Marginal — see above                                               | **REPLACE**.                                                                                          |
| **shawl**                                     | sh+`aw`-vowel-digraph             | ✓ (garment)                         | ✓ but `aw` is a separate vowel-digraph pattern                     | **REPLACE** — `aw` vowel-digraph not introduced yet.                                                  |
| **shrew**                                     | sh+`r`+vowel                      | ✓ (small mammal)                    | Obscure                                                            | **REPLACE** — `shr` blend + obscure vocab.                                                            |
| **sheaf**                                     | sh+long-e+f                       | Marginal                            | Obscure                                                            | **REPLACE**.                                                                                          |
| **sheen**                                     | sh+long-e+n                       | ✗ — abstract                        | n/a                                                                | **REPLACE**.                                                                                          |
| **sheet**                                     | sh+long-e (vowel digraph `ee`)+t  | ✓ (bedding / paper)                 | Marginal — ambiguous (sheet-of-paper vs. bedsheet); needs context  | **REPLACE** — ambiguous referent. Reconsider for ch/th pool if vocab justifies.                       |
| **shield**                                    | sh+long-e (vowel digraph `ie`)+ld | ✓ (object)                          | ✓ but uncommon in 8yo Manila vocabulary (medieval/fantasy context) | **REPLACE** — vocab borderline + `ie` vowel digraph + `ld` blend. Too many simultaneous new patterns. |
| **shoot**                                     | sh+long-oo+t                      | ✗ — verb (or plant-shoot, marginal) | n/a as noun                                                        | **REPLACE**.                                                                                          |

Nothing new in the audit-wider pass that beats the 4 already-kept.

### The pool-shape decision — going to 8 via long-vowel inclusion

To reach Dave's 8-word target without forcing weak entries, the audit forces one of three choices:

**Option A — ship 4 strong words only (`ship, shell, shoe, sheep`).** Goes under Dave's 8-10 floor. Risk: too few words for the planner to compose 3-5 introduction sessions without massive in-session repetition. Per phonics-sequence-marian §Q5, a 9-item math/word session wants 2-3 new-pattern items + 5-6 review items. With only 4 sh-target words, the 3-5 introduction sessions would each repeat all 4 every session — Marian sees the same 4 words 3+ times.

**Option B — ship 8 words by lowering the audit bar (`ship, shell, shoe, sheep` + 4 weak entries like `shed`, `shop`, `shawl`, `sheet`).** Adds vocabulary/composition risk. The pack-cohesion principle Kyle has consistently enforced (`short-u-pool-expansion §1`, `short-e §1`) was to NOT force weak entries to hit a target count. Doing so for sh now would reintroduce exactly the weakness that audit-honesty consistently rejected.

**Option C (RECOMMENDED) — ship 8 words by allowing both short-vowel AND long-vowel sh-initial words.** Dave's research is silent on this. The case for inclusion:

- The pedagogical concept being taught is **the digraph `sh` itself** (two letters = one sound `/ʃ/`). The vowel that follows is incidental — Marian decodes the `sh` and then the rest of the word with her existing phonics skills.
- For `shoe` and `sheep`, the rest-of-word phonics (`oe` long-oo and `eep` long-e+digraph) are not in her formal phonics-tier curriculum yet — BUT they are very high-frequency words that she has likely encountered as sight words from environmental print (shoe stores, storybook sheep).
- The picture-pack does the heavy decoding lifting: Marian sees the chip "shoe" with a picture of a shoe and audio of Emma saying "shoe". She does not need to decode the long-oo from scratch; she pattern-matches the whole word against the audio + picture. This is the "decodable + sight-word hybrid" mode that already exists in the app's design for some short-vowel words (`one`, `the` as sight-word sentence-glue alongside CVC decoding).
- The structured-literacy purist response is "long-vowel words shouldn't appear before long-vowel tiers". The counter is: the sh-tier is teaching the digraph, not the vowel; the vowel is given via the picture+audio scaffold. This is a defensible pedagogical exception when the alternative is a 4-word pool that's too thin to compose sessions from.

**Recommended call: Option C.** Pool of 8 = `ship, shell, shoe, sheep` (strong) + 4 additional candidates audited under the "vocabulary-familiar AND picturable" lens, accepting long-vowel sh-onsets:

Auditing additional long-vowel + acceptable-blend sh-initial candidates:

| Candidate       | Pattern                    | Concrete + Picturable              | Vocab familiar (Manila 8yo)                                                                             | Verdict                                            |
| --------------- | -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **shake**       | sh+long-a magic-e          | ✗ — verb                           | n/a                                                                                                     | **SKIP**.                                          |
| **shed**        | sh-CVC                     | ✓ but vocab register               | Marginal                                                                                                | **SKIP**.                                          |
| **shawl**       | sh+`aw`                    | ✓ — wrap-around fabric garment     | Marginal — uncommon in 8yo PH vocabulary; abuela might wear one but the word "shawl" itself is uncommon | **SKIP** — vocab marginal.                         |
| **ship**        | already in keeps           |                                    |                                                                                                         | KEEP                                               |
| **shore**       | sh+long-o+r                | ✓ but needs water+sand composition | Marginal                                                                                                | **SKIP** — composition.                            |
| **shop**        | sh-CVC                     | ✓ — store                          | Vocab register mismatch                                                                                 | **SKIP** — register.                               |
| **shut**        | verb                       | ✗                                  | n/a                                                                                                     | **SKIP**.                                          |
| **shower**      | sh+long-ow+er (2-syllable) | ✓ — bathroom fixture               | Vocab OK                                                                                                | **SKIP** — 2-syllable; single-syllable constraint. |
| **shed (noun)** | sh-CVC                     | ✓ — small building                 | Vocab register marginal                                                                                 | **SKIP**.                                          |
| **shy**         | sh+long-i (adj)            | ✗                                  | n/a                                                                                                     | **SKIP**.                                          |
| **shovel**      | sh-CV-CVC (2-syllable)     | ✓                                  | OK                                                                                                      | **SKIP** — 2-syllable.                             |

The audit doesn't produce 4 more strong picks at the same level as `ship, shell, shoe, sheep`. Forcing 4 weak ones would reintroduce the audit-failure pattern.

**Re-examining the picturable-AND-vocab-familiar audit:** The strict L2 8yo Manila lens is what's eating most candidates. Two have been on the cusp:

- **`shed`** — the storage-building image is reasonably picturable IF the chip shows a small wooden-walled freestanding outbuilding with a sloped roof and a single door. The vocab risk is that Marian may map this to "small house" or "kubo" in her L1, and then read "shed" as that L1-concept. But the picture + audio scaffold protects this exactly the same way `bed` and `web` are protected — Emma says "shed", Marian sees the picture, the audio-picture binding forms.
- **`shop`** — the storefront image with a clear awning + signboard reads as "store". The vocab risk persists. But "shop" is a high-frequency English word she will encounter in Danish school's English instruction, and the picture-audio scaffold can form the binding even if her L1 register prefers "store". The picture should show a small standalone shopfront (not a Manila mall, not a corner sari-sari-store with no awning) — a clear "this is a shop" silhouette.

**Reconsidering against the picturable-AND-vocab-familiar bar:** Both `shed` and `shop` are weaker than the 4 strong picks, but they are NOT in the same rejection class as `peg, shim, shag, shun` (truly archaic / obscure). They are vocabulary-register-mismatched. With Emma's audio + the picture chip, the register mismatch resolves into a learned-association — the same mechanism that handles `gem` for short-e (where "gem" is borderline vocabulary; the chip-as-anchor builds the association).

**Decision call: include `shed` and `shop` to reach 6.** Need 2 more.

The remaining candidates that come closest:

- **`shake`** — verb. Skip.
- **`shore`** — needs water-and-sand composition; multi-subject style violation. Skip.
- **`shawl`** — vocab marginal. Skip.
- **`shall`** — function word. Skip.
- **`shawl`** repeated — skip.
- **`shower`** — 2-syllable. Skip.
- **`shovel`** — 2-syllable. Skip.

Nothing single-syllable strong remains. The audit lands at 6 strong-plus-borderline, not 8.

### Re-considering the long-vowel allowance — go further?

Long-vowel sh-initial single-syllable concrete nouns I haven't audited:

- **`shore`** — already audited, REPLACE (composition).
- **`shape`** — abstract.
- **`shave`** — verb. SKIP.
- **`shame`** — abstract. SKIP.
- **`shine`** — verb. SKIP.
- **`shore`** — REPLACE.
- **`shoot`** — verb. SKIP.
- **`shoot`** as a plant-shoot — vocab obscure. SKIP.
- **`sheet`** — ambiguous (paper vs. bedsheet). SKIP.
- **`shield`** — uncommon Manila 8yo vocab + medieval context. SKIP.
- **`shrine`** — abstract / vocab. SKIP.
- **`shark`** — `ar` r-controlled vowel. The earlier rejection's load-bearing concern was the additional phonics pattern. **Reconsider under Option C (long-vowel allowance):** if we're already accepting long-vowel sh-onsets via the picture+audio scaffold, the `ar` r-controlled vowel can ride the same scaffold. The word is overwhelmingly picturable, universally vocabulary-familiar (shark is in early-reader books worldwide), and the chip-as-anchor builds the association regardless of whether the `ar` phonics is formally taught. **Revised verdict: KEEP under Option C.** Shark is a strong pick if we're allowing pattern-rest-of-word to ride the picture+audio scaffold.

The Option C allowance gives us **5 strong picks**: `ship, shell, shoe, sheep, shark`. Plus 2 borderline (`shed, shop`).

### Re-audit — finding 1 more under the relaxed lens

One more strong long-vowel sh-initial picturable concrete noun:

- **`shore`** — reconsider with explicit composition guidance: a triangular wedge of sandy beach + soft wave at the bottom. Multi-element composition is the concern; can be managed with very simple flat-shape framing. **Borderline — vocab marginal too.** SKIP.
- **`shrimp`** — `shr` blend. SKIP per Dave §Q3 isolation principle.
- **`shovel`** — 2-syllable. SKIP.

Looking at sh-final words just for completeness (we are NOT using them in v1 per Dave finding #3):

- `fish`, `dish`, `wish`, `rush`, `crash`, `bush`, `cash`, `dash`, `gush`, `mush`. All sh-final. Defer to follow-up arc.

**Final audit landing — Option C extended:** 5 strong (`ship, shell, shoe, sheep, shark`) + 3 borderline-acceptable (`shed, shop, shore`)... but `shore` is the weakest. Could swap `shore` for a slightly stronger borderline?

**Reviewing `shed` and `shop` one more time vs. `shore`:**

- `shed` — picturable (sloped roof + door + window), vocab register-marginal but learnable via scaffold. **Stronger than `shore`.**
- `shop` — picturable (storefront awning + signage placeholder), vocab register-mismatched, but high-frequency English word she'll encounter. **Stronger than `shore`.**
- `shore` — composition-complex (beach + water + sand), vocab marginal, multi-element. **Weakest of the borderlines.**

**Final 8 = `ship, shell, shoe, sheep, shark, shed, shop, shore`?** The `shore` inclusion is the weakest link.

**Alternative:** drop `shore` to 7 and accept Option A's risk of slightly thin pool. Or include `shore` as the 8th and document its weakness so Thomas can lock it.

**The audit-honest landing: 8 with `shore` as a known-weak entry, OR 7 strong without `shore`.** Recommend 8 with `shore` flagged for Phase-2 review — if MJ can't deliver a single-subject picturable `shore` chip in 4 grids, drop to 7 in Phase 2.

### Pool-size recommendation — 8 words (Option C, long-vowel allowance)

The recommended final pool:

> **`ship, shell, shoe, sheep, shark, shed, shop, shore`** — 8 words.

This hits Dave's lower bound (8–10) and respects the audit's honest yield. Phase 2 fallback to 7 (drop `shore`) is documented as the contingency.

**Open question for Thomas (Q1 in §7):** confirm Option C (long-vowel allowance, pool size 8 including `shore`). Or Option A-extended (4-6 short-vowel-only with planner accommodating thin pool). Or escalate via Dave for a clarification on whether long-vowel sh-onsets are pedagogically acceptable in the first sh-introduction tier.

### Final v1 sh-initial pool (8 words, recommendation pending Thomas Q1 lock)

| #   | Word  | Vowel inside                        | Picture status | Sh-position | Category  | Notes                                                                                                                                                        |
| --- | ----- | ----------------------------------- | -------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | ship  | short-i (`/ɪ/`)                     | NEW            | initial     | vehicle   | Vessel — hull + mast/smokestack + portholes. **The cleanest sh-CVC anchor**: 3-letter pattern (sh+i+p), short-vowel inside, universal picturable. Lead word. |
| 2   | shell | short-e (`/ɛ/`)                     | NEW            | initial     | object    | Spiral or scallop seashell. **3-phoneme geminate-CVC** under the `egg`/`box` precedent. Strong picturable.                                                   |
| 3   | shoe  | long-oo (`/uː/`)                    | NEW            | initial     | object    | Footwear — universal silhouette. **Long-vowel sh-onset** per Option C allowance; picture+audio scaffold carries the long-vowel decoding.                     |
| 4   | sheep | long-e (`/iː/`, vowel digraph `ee`) | NEW            | initial     | animal    | Woolly farm animal — distinct silhouette. **Long-vowel sh-onset** per Option C.                                                                              |
| 5   | shark | r-controlled `a` (`/ɑːr/`)          | NEW            | initial     | animal    | Sea creature — triangular fin + sleek body. **Long-vowel + r-controlled** per Option C. Universally vocabulary-familiar (PH archipelago context).            |
| 6   | shed  | short-e (`/ɛ/`)                     | NEW            | initial     | structure | Small wooden outbuilding — sloped roof + door + window. **Short-vowel sh-CVC.** Vocab register marginally Filipino-English but learnable via scaffold.       |
| 7   | shop  | short-o (`/ɒ/`)                     | NEW            | initial     | structure | Small storefront — awning + signboard + window. **Short-vowel sh-CVC.** Vocab register marginally Filipino-English but learnable via scaffold.               |
| 8   | shore | long-o + r-controlled (`/ɔːr/`)     | NEW            | initial     | place     | Sandy beach with simple soft wave at bottom. **Long-vowel + r-controlled** per Option C. **Weakest of the 8** — Phase-2 contingency to drop.                 |

### Pool composition cross-check

- **All 8 are concrete nouns** (objects, animals, structures, places). Each has a stable chip read.
- **5 of 8 are picture-distinct from existing CVC pack pictures** (`ship` vs `tub`/`box`; `shell` vs everything; `shoe` is unique; `sheep` is unique; `shark` is unique).
- **3 of 8 have known picture-instability or composition risk** (`shed` — could read as "small house"; `shop` — could read as "store"; `shore` — composition-complex). Mitigation in the prompt sheet (`digraphs-sh-picture-pack-prompts.md`) covers these.
- **Vowel spread:** short-i (1), short-e (1), short-o (1), long-oo (1), long-e (1), r-controlled-a (1), long-o+r (1) — 7 vowel positions. Phonetic variety is high.
- **Category spread:** vehicle (1), object (2 — shell, shoe), animal (2 — sheep, shark), structure (2 — shed, shop), place (1 — shore). 5 categories across 8 words. Good diversity.

### Phonetic spread within the pool (digraph isolation check)

The whole point of this tier is for Marian to internalize **`sh = /ʃ/`** as a single decoded unit. Every word in the pool starts with `sh` followed by a vowel — the sh-decoding lesson is identical across all 8. The vowel-following diversity is incidental.

- **sh-initial position:** ✓ ALL 8.
- **sh-final position:** ✗ NONE (deferred per Dave finding #3).
- **sh + consonant blend at onset (e.g., `shr-`):** ✗ NONE (`shrub`, `shrimp` deferred).
- **Single-syllable:** ✓ ALL 8.

### Vocabulary-familiarity audit (the binding constraint per Dave §Q4)

For each of the 8, the picture-grounding-without-explanation check:

| Word  | Marian's L1 (Tagalog) referent                                                 | Picture-grounds-without-explanation?                                              | Audio-anchor risk                                                    |
| ----- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ship  | barko (high-frequency word in PH)                                              | ✓ — ship/barko are universal                                                      | Low — clear picture                                                  |
| shell | kabibi / shell (English loanword common in PH beach context)                   | ✓ — beach shells universal                                                        | Low                                                                  |
| shoe  | sapatos / shoe (loanword)                                                      | ✓ — universal                                                                     | Low                                                                  |
| sheep | tupa (less common in PH but storybook-familiar)                                | ✓ — picture-grounded                                                              | Low — storybook recognition is solid                                 |
| shark | pating / shark (loanword in marine vocab)                                      | ✓ — universal in PH                                                               | Low — shark and pating are interchangeable in Filipino-English       |
| shed  | kuwadra / kubo (loose mapping)                                                 | Marginal — depends on chip's roofline + door + window discriminating from "house" | Moderate — picture must read as "small building, not a house"        |
| shop  | tindahan / tindera (loose mapping)                                             | Marginal — depends on chip's awning + signboard discriminating from "house"       | Moderate — picture must read as "small store with sign, not a house" |
| shore | dalampasigan / aplaya (beach is universal but "shore" specifically is English) | Marginal — depends on chip's sand+wave composition reading as "beach"             | Moderate — picture must avoid "ocean view" reading                   |

**6 of 8 are vocabulary-familiar without scaffolding** (ship, shell, shoe, sheep, shark; plus arguably shop via the universal "store" concept once the picture is grounded). 3 of 8 have moderate picture-grounding risk that the prompt sheet must address (shed, shop, shore).

### Tagalog phonology check per word — `/ʃ/` → `/s/` risk per Dave §Q3

The `/ʃ/` substitution risk is structural across ALL sh-words for Marian (Tagalog lacks `/ʃ/`). This is uniform — not per-word. Per Dave §Q3:

> Detectability in chip-tap format: sh-words and s-words look different on the chip label; Marian may select correctly by visual discrimination without producing `/ʃ/` correctly. This is acceptable in the app context — the chip-tap task tests reading recognition, not production.

Per-word substitution prediction:

| Word  | Predicted L1 substitution                                        | Visual discriminator from substitution |
| ----- | ---------------------------------------------------------------- | -------------------------------------- |
| ship  | "sip"                                                            | sh- vs. s- (visual)                    |
| shell | "sell"                                                           | sh- vs. s-                             |
| shoe  | "soo" / "su"                                                     | sh- vs. s- (visual cue strong)         |
| sheep | "seep"                                                           | sh- vs. s-                             |
| shark | "sark" (non-word; minimal substitution risk in production)       | sh- vs. s-                             |
| shed  | "sed" (non-word)                                                 | sh- vs. s-                             |
| shop  | "sop" (mostly non-word, though "sop" is a real but obscure word) | sh- vs. s-                             |
| shore | "sore"                                                           | sh- vs. s-                             |

Two of these substitutions produce real English words: `shell → sell` and `shore → sore`. The distractor architecture (§5) must include the `sh`-vs-`s` contrast pair as a trap distractor for these two. Emma's audio (Azure neural voice) produces `/ʃ/` correctly; the chip-tap recognition test is whether Marian matches the heard `/ʃ/` audio to the chip starting with `sh`, NOT to the chip starting with `s`. This is a meaningful learning target per Dave's recommendations to Kyle #4 (distractor design for digraphs differs from CVC).

---

## 1.3 The long-vowel allowance — design call and justification

This is the load-bearing design call in this spec. Dave's research is **silent** on whether long-vowel sh-onsets (`shoe`, `sheep`, `shark`, `shore`) belong in the first sh-introduction pool. The audit forced this question because short-vowel-only sh-CVC nouns are scarce in English.

### The case for short-vowel-only (Option A — what structured-literacy purists would say)

- Marian has just shipped short-e (the final single-vowel tier). She has NOT been taught long vowels, vowel digraphs (`ee`, `oe`), magic-e (`ape`, `ide`), or r-controlled vowels (`ar`, `or`).
- Introducing `shoe`, `sheep`, `shark`, `shore` in the sh-tier means the chip presents TWO phonics challenges simultaneously: the sh-digraph AND a vowel pattern she hasn't formally learned.
- This violates the one-new-concept-per-session principle (`phonics-sequence-marian.md` §Q5, Dave §Q4).
- The structured-literacy correct path: ship sh-tier with short-vowel-only words even if the pool is small (4 strong picks).

### The case for long-vowel allowance (Option C — the recommended call)

- **The tier teaches the digraph, not the vowel.** The phonics lesson is "sh = `/ʃ/`, two letters one sound". The vowel following the sh is incidental — Marian decodes the sh, then the rest of the word, and is GIVEN the rest-of-word via Emma's audio + the picture.
- **The picture+audio scaffold is precisely the mechanism for handling words with unfamiliar phonics.** The app's design has always been audio-first with picture-as-vocabulary-anchor. For `shoe`: Marian sees "shoe" chip, hears Emma say "shoe", sees a picture of a shoe. She does not need to decode `oe` from scratch — she pattern-matches.
- **This is the same mode that handles sight-words.** The 10 core sight words (`the, a, I, to, and, was, for, you, is, of` per phonics-sequence §Q4) include `was` (with the unusual short-a-glide vowel and `s`-as-`/z/`), `of` (with the unusual `f`-as-`/v/`), `to` (long-oo), `you` (long-oo `ou`). The app already accepts that some words are picture+audio scaffolded rather than fully phonics-decoded. Long-vowel sh-onsets are this mode.
- **The alternative is a 4-word pool that's too thin to compose 3-5 sessions from.** With 4 sh-target words, every introduction session repeats all 4 every session, which violates the 60/40 review-to-new ratio at the pool level (you can't have variety across sessions when the pool IS one session's worth of items).
- **The picturability + vocabulary-familiarity of `shoe`, `sheep`, `shark` are exceptionally strong.** These are core early-reader vocabulary worldwide. Withholding them from the sh-tier because of the formal phonics curriculum order is privileging the framework over the learning goal.
- **The /ʃ/ goal is the same regardless of the following vowel.** Whether Marian decodes `ship` (`/ʃ/+/ɪ/+/p/`) or `shoe` (`/ʃ/+/uː/`), the digraph-recognition learning is identical: see "sh" at the start of the word, say `/ʃ/`. The rest of the word can be picture-scaffolded.

### The hybrid resolution

Mark `shoe`, `sheep`, `shark`, `shore` in the pool as **"sight-word-hybrid"** — Marian is expected to pattern-match against Emma's audio rather than fully decode the long-vowel rest-of-word. The planner / canon-bake should produce session content that pairs these chips with Emma's audio + the picture, never with a "decode this aloud" prompt.

This is documented in the picture-pack prompt sheet's per-word notes for each of these 4 words.

**Recommended call: Option C with the hybrid annotation.** If Thomas locks Option A (short-vowel-only purist), pool drops to ~4 words and the planner accommodates the thin pool by accepting in-session repetition. Either is defensible; Option C is the audit-honest call given the English sh-CVC noun stock is small.

---

## 2. Distractor word list — same-vowel? No — sh-tier needs cross-tier sh/s contrast distractors

This is structurally different from the short-vowel CVC tiers. Per Dave's recommendations to Kyle #4:

> For digraph words, the most diagnostically useful distractors differ by the initial grapheme: "ship" vs. "sip" (sh vs. s confusion), "chin" vs. "sin" or "kin" (ch vs. s/k confusion), "thin" vs. "tin" or "sin" (th vs. t/s confusion). This is not how the current FORBIDDEN_PAIRS / TARGET_PAIRINGS system was designed for vowel-tier content; Kyle and the dev team will need to adapt the distractor-selection logic for digraph tiers.

For the sh-tier, the diagnostically useful distractor for `ship` is `sip` — same word minus the `h`. For `shell` it's `sell`. The chip-tap task is: Marian hears Emma say `/ʃɪp/`, the chip choices include "ship" and "sip" (and a category-distinct gentle distractor). Marian's job is to match the `/ʃ/` she heard to "sh" not "s".

**This is a meaningful change from the v1 same-vowel-only distractor rule** that has held for all CVC tiers (`short-u §2`, `short-e §2`).

### Two distractor classes for sh-tier

**Class 1 — sh/s contrast traps (NEW pattern unique to digraph tiers):**

| sh-target | s-contrast trap | Both real English words?                          | Notes                                                                             |
| --------- | --------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| ship      | sip             | YES — both real                                   | Direct minimal pair                                                               |
| shell     | sell            | YES — both real                                   | Direct minimal pair                                                               |
| shoe      | sue             | YES — both real but "sue" is verb / proper-noun   | Borderline — adult vocabulary                                                     |
| sheep     | seep            | YES — both real but "seep" is verb / obscure noun | Borderline — uncommon                                                             |
| shark     | sark            | NO — non-word                                     | Sark is not a word; the visual sh/s contrast still works but it's a non-real pair |
| shed      | sed             | NO — non-word                                     | "Sed" is a Unix command, not an English word                                      |
| shop      | sop             | YES — but obscure noun                            | "Sop" = bread soaked in liquid (archaic)                                          |
| shore     | sore            | YES — both real                                   | Direct minimal pair                                                               |

**4 of 8 sh-targets have a real-word s-contrast trap (ship/sip, shell/sell, shore/sore, plus shop/sop borderline). The remaining 4 (shoe/sue, sheep/seep, shark/sark, shed/sed) have weaker traps — either uncommon, non-word, or vocabulary-adult.**

The strong-trap subset (`ship/sip, shell/sell, shore/sore, shop/sop`) is where the sh-vs-s discrimination test has real teeth. For the weak-trap subset, use a same-pool sh-neighbor as the trap instead — keeping the sh-decoding success-pattern intact while still giving Marian a phonics-meaningful choice.

**Class 2 — same-pool sh-neighbor (gentle distractor, mirrors short-vowel tier pattern):**

For every sh-target, pair it with another sh-target as the gentle distractor — same-sound-class, different referent. e.g. `ship` (target) with `shell` (gentle distractor) — Marian distinguishes by picture, not by sh-vs-s. This builds confidence + reinforces the sh-pool as a cohesive set.

### Recommended distractor matrix (concrete example for Kevin's impl ticket)

Full `TARGET_PAIRINGS` rows are Kevin's to author; design preview here so the structure is clear (mirrors `short-e §2`).

**Shape contract.** Every row's `gentle` and `trap` are `readonly [string, string]` tuples — exactly 2 entries each. This matches the existing `WordPairing` type in [`wordPack.ts`](../../src/screens/WordSong/wordPack.ts) and the v1 shape across all short-vowel tiers. Single-entry tuples are a type error.

**FORBIDDEN_PAIRS pre-check.** Every distractor below has been cross-checked against §6's FORBIDDEN_PAIRS additions: `[shed, shop]`, `[shoe, shop]`, `[ship, tub]`. No row pairs a target with a forbidden silhouette neighbor.

```ts
// Strong-trap subset — Class 1 (sh/s contrast) + Class 2 (sh-pool neighbor):
ship:  { gentle: ['shell', 'shark'], trap: ['sip',  'shoe']  },  // gentle: 2 sh-neighbors; trap: sh/s contrast + sh-neighbor
shell: { gentle: ['ship',  'shoe'],  trap: ['sell', 'sheep'] },  // gentle: 2 sh-neighbors; trap: sh/s contrast + sh-neighbor
shore: { gentle: ['sheep', 'shark'], trap: ['sore', 'shed']  },  // gentle: 2 sh-neighbors; trap: sh/s contrast + sh-neighbor
shop:  { gentle: ['shark', 'shoe'],  trap: ['sop',  'sheep'] },  // gentle: 2 sh-neighbors (NOT shed — FORBIDDEN_PAIR); trap: sh/s contrast + sh-neighbor

// Weak-trap subset — Class 2 (sh-pool neighbor only; weak s-contrast trap omitted):
shoe:  { gentle: ['ship',  'shark'], trap: ['shell', 'sheep'] }, // gentle + trap both sh-pool; sue too adult-vocab
sheep: { gentle: ['shark', 'shoe'],  trap: ['shore', 'ship']  }, // gentle + trap both sh-pool; seep too obscure
shark: { gentle: ['ship',  'sheep'], trap: ['shoe',  'shore'] }, // gentle + trap both sh-pool; sark non-word
shed:  { gentle: ['shark', 'shore'], trap: ['shore', 'sheep'] }, // gentle + trap both sh-pool (NOT shop or shoe — FORBIDDEN_PAIRS); sed non-word
```

**Distractor-class summary per row:**

| Target | Gentle tier (problems 1-3) | Trap tier (problems 4-8) | Trap class         |
| ------ | -------------------------- | ------------------------ | ------------------ |
| ship   | shell, shark               | sip, shoe                | sh/s + sh-neighbor |
| shell  | ship, shoe                 | sell, sheep              | sh/s + sh-neighbor |
| shore  | sheep, shark               | sore, shed               | sh/s + sh-neighbor |
| shop   | shark, shoe                | sop, sheep               | sh/s + sh-neighbor |
| shoe   | ship, shark                | shell, sheep             | sh-neighbor only   |
| sheep  | shark, shoe                | shore, ship              | sh-neighbor only   |
| shark  | ship, sheep                | shoe, shore              | sh-neighbor only   |
| shed   | shark, shore               | shore, sheep             | sh-neighbor only   |

**`sip` as cross-tier-load-bearing dual-role distractor (resolution per Devon's review of PR #212):**

`sip` is already a `TARGET_WORDS` entry with `vowel: 'i'`, `isTarget: true` (`wordPack.ts:516` — shipped in short-i tier). Using `sip` as `ship`'s trap distractor in the sh-tier matrix means `sip` becomes the **second** cross-vowel-tier-load-bearing distractor in `wordPack.ts`, after `pen` (see `.claude/docs/skill-trees-and-content.md` §"pen is cross-vowel-tier load-bearing", added post-#208).

The pattern is well-established:

1. **Retain `sip`'s existing entry** in `TARGET_WORDS` with `vowel: 'i'`, `isTarget: true`. No flip to `isTarget: false`.
2. **Reference `sip` by string** from the sh-tier `TARGET_PAIRINGS` row for `ship` (above). `getWordEntry('sip')` resolves to the existing short-i entry; the picture, audio, and chip-render machinery already work.
3. **Operational rule applies** (per `.claude/docs/skill-trees-and-content.md` §"Cross-vowel-tier load-bearing — generalization"): before any future removal of `sip` from `TARGET_WORDS`, the impl ticket must grep for `sip` as a string token in `TARGET_PAIRINGS` and either retain the entry or substitute every reference. Same as `pen`, `dog`, `cup`, `sun` already in that cluster.

**Why dual-role over a non-`sip` substitute:** the `sh/s` contrast for `ship` is the SINGLE strongest diagnostic test in the entire sh-tier (per §2 above and Dave §Recommendations-to-Kyle #4). `sip`/`ship` is the cleanest minimal-pair in English. Substituting another short-i word would lose the `/ʃ/`-vs-`/s/` test. The dual-role pattern is the cheaper resolution, and it establishes the cross-tier-distractor precedent that downstream digraph tiers (`ch`, `th`) will likely also need.

**Devon's second cross-tier-load-bearing distractor finding:** post-#208, `pen` was the sole entry in this cluster. With `sip` added, the cluster grows to 6 (per the table in `.claude/docs/skill-trees-and-content.md`: `pen`, `dog`, `log`, `cup`, `sun`, and now `sip`). Worth confirming the operational rule generalises cleanly to digraph-tier distractors — surfaced as a non-obvious finding in §10 below.

**Note on the matrix preview:** illustrative; Kevin owns the final `TARGET_PAIRINGS` rows in the impl ticket per `screens-and-flows.md` convention. The constraints above are load-bearing:

- Tuple shape `[string, string]` (2 entries each).
- No FORBIDDEN_PAIR adjacency.
- `gentle` always sh-pool; `trap` is sh/s contrast where strong-trap available, else another sh-pool neighbor.
- `sip` documented as dual-role; all other s-contrast distractors (`sell`, `sop`, `sore`) are new distractor-only entries (NOT existing in `TARGET_WORDS`).

### Cross-tier hygiene — NO short-vowel CVC distractors in sh-trios

Per Dave §Q5: "Do not interleave digraphs with CVC content until the digraph is consolidated (~90% accuracy)." The same-vowel-only rule that v1 applies inside CVC tiers extends to: **sh-tier trios contain ONLY sh-words + s-contrast traps. No `cat`, `dog`, `pen` etc. in sh-trios in v1.** This is realised in code through (a) `pickDistractors(target, problemIndex, options)` in [`src/screens/WordSong/wordDistractors.ts`](../../src/screens/WordSong/wordDistractors.ts) which resolves the trio's two distractors from the `TARGET_PAIRINGS` matrix (matrix-curated, runtime-dumb — adding sh-tier rows whose distractor strings are sh-pool or s-contrast is sufficient), and (b) render-time chip ordering via `buildChipOrder()` in [`src/screens/WordSong/WordSong.tsx`](../../src/screens/WordSong/WordSong.tsx) which shuffles the `[target, d1, d2]` triple deterministically per problem. There is no separate `composeTrio` function; "trio" is the rendered output of `pickDistractors` + `buildChipOrder`. The planner constraint above is analogous to short-e's same-vowel-only matrix.

### FORBIDDEN_PAIRS additions

| New pair       | Reason                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[ship, tub]`  | Both vessel-like silhouettes at 96pt. `tub` is short-u target; cross-pack hygiene only — sh-tier rule prevents this pair from appearing in a trio in v1, but the hygiene rule documents the silhouette risk for future cross-pool work.                                        |
| `[shed, shop]` | Both small-structure silhouettes. **In-pool hygiene** — these two should not appear together in the same trio because the only discriminator at 96pt is the awning-vs-roof detail, which is too fine. Sh-neighbor pairing should pick from the other 6 sh-words for these two. |
| `[shoe, shop]` | If the `shop` picture leans toward "shoe store" the silhouette could collide. Hygiene rule.                                                                                                                                                                                    |

---

## 3. Picture-pack requirements (summary — full prompts in companion sheet)

See `digraphs-sh-picture-pack-prompts.md` for the per-word MJ prompts.

Summary requirements:

- **8 wholly-new pictures** (no re-traces — none of the 8 sh-words have existing distractor SVGs from prior tiers).
- Pictures embedded via `yarn embed-pictures` per the established Phase-3 pipeline.
- Filenames: `picture-ship.svg`, `picture-shell.svg`, `picture-shoe.svg`, `picture-sheep.svg`, `picture-shark.svg`, `picture-shed.svg`, `picture-shop.svg`, `picture-shore.svg` at `public/assets/pictures/`.
- Style anchor: `picture-pack-style-anchor.md` §2 + §3 (locked, byte-for-byte preamble).
- Phase-2 fallback: drop `shore` to 7 pictures if Phase-2 MJ pass can't produce a 96pt-readable shore chip in 4 grids.

---

## 4. Emma's sh-introduction lines (design-side TTS script — not the spec for Kevin)

This is informational; the Word Song spec for Kevin's planner will lift the exact script lines. Per Dave §Application + recommendations to Kyle #1:

**First sh-encounter (lifetime-once scaffolding, similar to short-u's `sun/soon` opener mechanism per AC9b):**

> "Look — sh together! Two letters, one sound. Shhh [Emma finger-on-lips pose]. Ship! Sh-i-p. Ship."

**Vowel introduction (per session-open Emma greeting in sh-tier sessions, before any item):**

> "Today we're learning a new sound! When 's' and 'h' stand together, they make one sound: shhh. Like 'shhh, be quiet'."

**Per-item Emma lines (each sh-word):**

> "[word]! Listen: [word]. Can you find [word]?"

For the long-vowel hybrid items (`shoe`, `sheep`, `shark`, `shore`):

> "[word]! [picture appears alongside audio] [word]."

No additional phonics scaffolding for the rest-of-word vowel; the picture+audio carries it.

---

## 5. The 2-session-gap rule does NOT apply between short-e and sh — but a different scaffold gate does

Short-e and sh-tier are NOT in a known minimal-pair confusion class (per Dave §Q3 — sh/s is the confusion, not sh/short-e). However:

- The sh-tier introduces a fundamentally new concept ("two letters make one sound") that did not exist in any prior CVC tier.
- Per Dave §Application: "The 'two letters, one sound' concept will be the primary conceptual barrier, not the blending mechanic."

**Recommended scaffold gate:** before the first sh-introduction session, Emma's session-open includes a brief metalinguistic intro (the vowel-introduction line above) explicitly naming the two-letters-one-sound concept. This is NOT a separate lifetime-once item like short-u's `sun/soon` opener — it's a per-session reminder at the start of each sh-introduction session while `digraphs-sh.state === 'practicing'` (i.e., still surfaced through the `practicing` state; suppressed once the node flips to `'mastered'`). State mapping mirrors AC6's correction.

**Implementation note:** parallels the `vowel-of-the-session` cue from `phonics-sequence-marian.md` §Application — small visual cue showing "sh" + a keyword picture (e.g., `sh - ship`) persistent during sh-tier sessions. Reduces working-memory load. Spec-side note for Kevin's planner.

---

## 6. Cross-pool hygiene + planner constraints

### Planner constraints

1. **sh-tier sessions contain only sh-words + s-contrast traps.** No CVC words from prior tiers in sh-trios in v1. Mirrors same-vowel-only rule.
2. **Maximum 2-3 new sh-items per 8-item session** (per `phonics-sequence §Q5` and Dave §Q4). The remaining 5-6 items are review (mastered short-vowel CVC words from prior tiers — handled via the planner's existing cross-tier-review mechanism, NOT via in-trio cross-tier inclusion).
3. **First sh-session is lifetime-once-scaffolded** — Emma's two-letters-one-sound intro fires the first time sh-tier is encountered. Mirrors short-u's `sun/soon` AC9b.
4. **Per-session sh-vowel-cue persists during sh-tier sessions while `digraphs-sh.state === 'practicing'`** (per `applyMasteryRule()` in `src/lib/progress/mastery.ts`; intro + practicing both show the cue, mastered hides it). Small visual cue in screen corner showing "sh - [keyword picture, e.g. ship]" so the digraph stays anchored visually. See AC6 — concrete state mapping replaces the earlier "~70% accuracy" formulation which has no corresponding state in the progress model.

### Cross-tier hygiene

1. **FORBIDDEN_PAIR additions:** `[shed, shop]` (in-pool), `[shoe, shop]` (in-pool — if `shop` picture leans shoe-store-y), `[ship, tub]` (cross-pool silhouette).
2. **No sh/s contrast in CVC trios:** the `sip`/`sell`/`sore`/`sop` distractor words appear ONLY in sh-trios, never in short-i / short-e / short-o trios respectively. This is to prevent confusion where Marian sees `sip` in a short-i trio and learns `sip` as a target, then meets it as a distractor in sh-tier.

### Distractor architecture refactor (flagged for Kevin's impl ticket)

The v1 `TARGET_PAIRINGS` shape (in [`wordPack.ts`](../../src/screens/WordSong/wordPack.ts)) was designed for same-vowel-only CVC distractors. The sh-tier introduces cross-orthography distractors. The runtime impact is small but the data model needs care:

- **`wordPack.ts TARGET_WORDS` additions:** distractor-only entries (`isTarget: false`) for the s-contrast traps actually referenced by the §2 matrix — `sell`, `sop`, `sore`. These are NOT sh-words but need to exist as `WordEntry` rows with picture assets so the chip render resolves them via `getWordEntry()`. `sue, seep, sark, sed` were rejected in §2 as too weak and do NOT need to ship.
- **`sip` is dual-role (NOT a new entry).** It already exists in `TARGET_WORDS` with `vowel: 'i'`, `isTarget: true`. The sh-tier row for `ship` references it by string. See §2 "`sip` as cross-tier-load-bearing dual-role distractor" and §10 finding #9. Operational rule from `.claude/docs/skill-trees-and-content.md` §"Cross-vowel-tier load-bearing" applies.
- **`pickDistractors` runtime is unchanged.** No functional refactor; matrix-lookup-only. Adding sh-tier `TARGET_PAIRINGS` rows is sufficient.
- **`buildChipOrder` runtime is unchanged.** Render-time positioning is target-agnostic.
- **`FORBIDDEN_PAIRS` extension** for in-pool sh-hygiene rules (table in §6 above).
- **`WordEntry.vowel` type union** may need to extend or be supplanted by Kevin's `phoneme:` field per PR #211 — see §10 finding #10.
- **Picture assets for distractor-only s-contrast entries.** `sell`, `sop`, `sore` each need a picture (silhouette placeholder is acceptable per the existing pattern for distractor-only entries; vector trace can land in polish backlog). `sip` reuses its existing short-i picture asset.

**This is downstream for Kevin's impl ticket.** Flagging here so the spec downstream is clear.

---

## 7. Open questions for Thomas

### Q1 — Long-vowel allowance (LOAD-BEARING)

**Recommended:** Option C — pool of 8 including `shoe, sheep, shark, shore` (long-vowel sh-onsets) with hybrid sight-word-like scaffolding via picture+audio.

**Alternative:** Option A — pool of 4 short-vowel-only (`ship, shell, shed, shop`); planner accommodates thin pool with high in-session repetition (every session uses all 4 words).

**Why this matters:** Dave's research is silent. The audit honestly does not produce 8 short-vowel-only sh-CVC strong picks because the English sh-initial short-vowel-CVC noun stock is small. Either we expand the criteria (Option C — recommended) or we ship a thin pool (Option A — Dave §Q4 doesn't reject this but it's harder to compose sessions from).

**Question:** Lock Option C? Or escalate to Dave for clarification on long-vowel sh-onset acceptability?

### Q2 — `shore` retention (Phase-2 contingency)

**Recommended:** include `shore` in the v1 pool of 8 with a Phase-2 contingency to drop to 7 if MJ can't produce a clean single-subject shore picture in 4 grids.

**Alternative:** drop `shore` proactively, ship 7 from start.

**Why this matters:** `shore` is the weakest of the 8 — composition complexity (sand + wave + sky) and vocab register marginality. The other 7 are stronger.

**Question:** Ship 8 with contingency, or 7 from start?

### Q3 — `shop` vs `store` register

The `shop` picture (storefront with awning) is in Anglo-British register; the Filipino-English equivalent is `store` or `tindahan`. The picture+audio scaffold should build the binding "shop = storefront silhouette" even if Marian's L1 vocabulary maps to `tindahan`.

**Question:** Confirm `shop` stays in the pool? Or replace with another option?

**Recommended:** keep `shop`. The picture+audio scaffold is sufficient. The register-mismatch concern is similar to `gem` (short-e), which shipped.

### Q4 — Sh-tier `SkillNode` shape

**Out-of-scope for this spec** per the brief — Kevin's audit owns this. But flagging the design implication:

- If `SkillNode` = single `digraphs` node with `wordPack[digraphs]` containing only sh-words in v1, then later spec adds ch + th words to the same pack → planner must enforce per-session digraph isolation.
- If `SkillNode` = 3 sibling nodes (`digraphs-sh`, `digraphs-ch`, `digraphs-th`), then each has its own pack and planner naturally isolates by node.

**Recommended:** 3 sibling nodes (mirrors the short-vowel CVC structure: `cvc-words-short-a`, `cvc-words-short-o`, etc.). But this is Kevin's call.

### Q5 — Sh-tier mastery rule alignment with CVC tiers

**Recommended:** same 90/3 mastery rule as CVC tiers. After 90% accuracy across 3 consecutive sessions, sh-tier graduates; ch-tier unlocks.

**Question:** Confirm? Or use a different threshold for digraph mastery (Dave's research is silent on whether digraph mastery thresholds differ from CVC thresholds)?

### Q6 — Sh/ch interleaving trigger

**Out-of-scope for this spec** per Dave §Q5. Flagged here so it's not forgotten: once ch-tier ships and both sh + ch are at ~70%+ accuracy, a mixed sh/ch session is appropriate (Dave's recommendation). Operationalization (e.g. "3 sessions above 70%") is a planner decision at the time ch-tier ships.

---

## 8. Acceptance criteria

For this spec's downstream impl tickets (Kevin's planner + Devon's wordPack + canon-bake):

- [ ] **AC1 — pool size:** `wordPack[digraphs-sh]` (or `wordPack.digraphs` filtered by sh) contains the 8 words: `ship, shell, shoe, sheep, shark, shed, shop, shore` (subject to Q1 + Q2 locks).
- [ ] **AC2 — distractor-only pool:** sh-tier-specific s-contrast distractor entries exist as text+audio chips: `sip, sell, sop, sore` (strong-trap) + sh-pool-neighbors for weak-trap pairings. `sue, seep, sark, sed` are NOT shipped — too weak.
- [ ] **AC3 — Trio composition for sh-tier (`pickDistractors` + `buildChipOrder`):** for every sh-target row in `TARGET_PAIRINGS`, both gentle entries are sh-pool neighbors; the trap entries are either (a) an s-contrast distractor-only word + a sh-pool neighbor (strong-trap subset: `ship`, `shell`, `shore`, `shop`) or (b) two sh-pool neighbors (weak-trap subset: `shoe`, `sheep`, `shark`, `shed`) per the matrix in §2. No CVC short-vowel words appear as distractors in sh-trios. Tuple shape is `readonly [string, string]` for both `gentle` and `trap`. Render-time positioning of the 3 chips remains in `buildChipOrder()`; no new function needed.
- [ ] **AC4 — FORBIDDEN_PAIRS:** `[shed, shop]`, `[shoe, shop]`, `[ship, tub]` added to the FORBIDDEN_PAIRS list.
- [ ] **AC5 — Emma's two-letters-one-sound opener:** fires the first time sh-tier is encountered (lifetime-once); persists in localStorage. Mirrors short-u's `sun/soon` AC9b mechanism.
- [ ] **AC6 — Per-session sh-vowel-cue:** small visual cue (e.g., "sh - ship" with picture) persists in screen corner during sh-tier sessions WHILE `digraphs-sh.state === 'practicing'` (per `applyMasteryRule()` in `src/lib/progress/mastery.ts`). The cue is hidden once the node flips to `'mastered'`. Concretely: `intro` state shows the cue; `practicing` state shows the cue; `mastered` hides it. This maps cleanly to the existing `Progress.skillLevels[node]` field — no new accuracy-percentage infrastructure required. (Originally drafted as "until ~70% accuracy" which has no corresponding state in the progress model; corrected per Devon's PR #212 review.)
- [ ] **AC7 — 8 picture assets shipped:** `picture-{ship,shell,shoe,sheep,shark,shed,shop,shore}.svg` at `public/assets/pictures/`, embedded via `yarn embed-pictures`. (Or 7 per Q2 fallback.)
- [ ] **AC8 — mastery rule:** sh-tier graduates at 90% accuracy across 3 consecutive sessions (per Q5 lock).
- [ ] **AC9 — same-vowel-only-extended-to-sh-only rule:** sh-trios contain only sh-pool words + s-contrast distractors, never CVC short-vowel words. (Cross-tier review of mastered CVC content is handled outside of sh-trios, via the planner's existing cross-tier review mechanism.)
- [ ] **AC10 — canon bake:** sh-tier session canon is baked via `npm run canon:regen` post-spec-merge; canon JSON committed in the impl PR.
- [ ] **AC11 — Jessica E2E spec (per `feedback_progression_e2e_mandatory.md`):** sh-tier progression includes a failing-first E2E spec — covers (a) first-encounter scaffold fires once, (b) ~90% accuracy across 3 sessions transitions sh-tier from `intro → practicing → mastered`, (c) trap distractor (sh/s contrast) correctly counts as wrong when selected.

---

## 9. Sources

This spec is derived from:

- `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14) — research gate; cited in §1 Why-now, §1 Audit, §2 Distractors, §4 Emma lines, §5 Scaffold, §6 Planner, §7 Open questions.
- `design/research/phonics-sequence-marian.md` (2026-04-26) — vowel-tier precedent + session pacing constraints (§Q5).
- `design/word-song/short-e-pool-expansion.md` — format precedent + audit pattern.
- `design/word-song/short-u-pool-expansion.md` — format precedent + first-encounter scaffold pattern.
- `design/word-song/picture-pack-style-anchor.md` — style frame (inherited by the companion prompt sheet).
- `CLAUDE.md` — Marian profile + project constraints.
- `.claude/docs/skill-trees-and-content.md` — current `digraphs` SkillNode shape; planner contract for word selection.
- `.claude/docs/planner-and-canon.md` — canon-bake pipeline + rate limiter.

---

## 10. Non-obvious findings to surface

These are surfaced for Thomas / Matt / Kevin via the PR / handoff:

1. **The English sh-initial short-vowel-CVC noun stock is small** — about 4 strong picks (`ship`, `shell` + 2 borderline). This forces a pool-shape decision that Dave's research is silent on. The recommended Option C (long-vowel allowance via picture+audio scaffold) is defensible but is a meaningful pedagogical exception worth flagging to Dave for retroactive validation if Thomas locks it.

2. **The sh-tier introduces a new distractor pattern (sh/s contrast) that did NOT exist in CVC tiers.** Mechanically the change is small — `pickDistractors` in `wordDistractors.ts` is a matrix-lookup-and-resolve function with no per-tier logic, so adding sh-tier rows to `TARGET_PAIRINGS` with the appropriate distractor strings is sufficient at the runtime layer. The architecturally-meaningful work is in `wordPack.ts`: distractor-only `WordEntry` rows for `sell`, `sop`, `sore` (NOT same-vowel-pool neighbors — these are short-e, short-o, long-o-r words functioning as sh-trio distractors only), each with `isTarget: false` and a picture asset. `sip` is a dual-role exception (see finding #9 below). This is downstream for Kevin's impl ticket but is flagged here so the spec downstream is clear it's not just "add more words to TARGET_WORDS".

3. **4 of 8 sh-targets have NO good s-contrast trap word** (`shoe/sue` adult-vocab, `sheep/seep` uncommon, `shark/sark` non-word, `shed/sed` non-word). The matrix uses sh-pool-neighbors for these weak-trap pairings. This is fine pedagogically (the sh-vs-sh trio still teaches digraph recognition by picture) but it means only half the pool gets the sh-vs-s discrimination contrast that's the diagnostically most useful test per Dave §Recommendations-to-Kyle #4.

4. **`shop` and `shed` have vocabulary register mismatch with Filipino-English** — Marian's L1 dialect uses `store` and `kubo/small building` respectively. The picture+audio scaffold builds the English-register association, but Thomas should be alert during real-iPad smoke that these two chips don't produce confusion. If real-Marian observation shows `shop` consistently failing because the picture reads as "store" not "shop", the contingency is to drop `shop` and ship at 7 (alongside or instead of the `shore` Phase-2 drop).

5. **`shark` is the strongest pick in the long-vowel-allowance set** despite having `ar` r-controlled vowel — universal vocabulary, universal picture, PH-cultural-context strong. If Thomas rejects Option C, `shark` is the highest-leverage exception to consider individually (rather than rejecting all 4 long-vowel candidates together).

6. **Sh-final position is intentionally deferred** (Dave finding #3). Sh-final words (`fish, dish, wish, rush, crash, bush, cash, dash, gush, mush`) are a meaningful follow-up arc once sh-initial consolidates. About half of those are highly picturable (fish, dish, bush, brush-not-actually-CVCC, crash); the others are verbs/abstract. Flagging here so the sh-final follow-up spec has a starting candidate list.

7. **The two-letters-one-sound concept is new for Marian.** Tagalog does not have true consonant digraphs in the same way; per Dave §Application this is "the primary conceptual barrier, not the blending mechanic." Emma's first-encounter line must explicitly name the concept ("Two letters, one sound. Shhh.") — this is a script-side requirement that the spec downstream for Kevin must implement. It is NOT a passive design hint; it's load-bearing for Marian's success on the tier.

8. **`/ʃ/` → `/s/` is the structural L2 substitution risk (not per-word).** This is testable in the chip-tap format via the sh/s contrast distractor. But the production-side substitution (Marian saying `/s/` when she means `/ʃ/`) is NOT testable in chip-tap and is acceptable per Dave §Q3 — the app tests recognition, not production. Thomas should be alert that real-Marian iPad smoke may show her getting all chip-taps right while still pronouncing `/s/` aloud; that is expected and not a failure mode.

9. **`sip` is the second discovered cross-vowel-tier load-bearing distractor in `wordPack.ts`** (after `pen`, post-#208). Surfaced by Devon's review of PR #212. The cluster pattern (`.claude/docs/skill-trees-and-content.md` §"pen is cross-vowel-tier load-bearing") generalises cleanly: a word with `vowel: 'i'` and `isTarget: true` referenced as a string distractor from a DIFFERENT vowel tier's `TARGET_PAIRINGS` row (here: sh-tier referencing `sip` as `ship`'s trap distractor). The dual-role resolution (keep the entry as-is in `TARGET_WORDS`, reference by string from the new matrix row) is the established cheap path. The cluster now contains: `pen` (`'e'`), `dog` (`'o'`), `log` (`'o'`), `cup` (`'u'`), `sun` (`'u'`), `sip` (`'i'`). Worth updating `.claude/docs/skill-trees-and-content.md`'s table to add the sh-tier-as-referencing-tier row once this spec ships its impl.

10. **The `vowel:` literal type may need to extend for sh-tier `WordEntry` rows.** Per Devon's review, the current `WordEntry.vowel` is `'a' | 'o' | 'u' | 'i' | 'e'` (short vowels only). The 4 long-vowel-allowance sh-words (`shoe`, `sheep`, `shark`, `shore`) do not fit this union. Three resolution paths: (i) extend the union to include digraph-tier values like `'sh-long'` or per-word phoneme tags; (ii) annotate a fake-but-closest short vowel as a soft placeholder with comment documentation; (iii) ship Kevin's PR #211 phoneme-tag proposal first and use `phoneme: '/ʃ/'` uniformly on all 8 sh-rows as the canonical disambiguator. This is load-bearing for the impl ticket — flagged here so Kevin's coordination with PR #211 sequencing is clear.
