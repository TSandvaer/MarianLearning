# Word Song — digraphs `sh` word list (7 words, sh-initial only; Option C-minus)

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

**Scope of this spec:** word selection (audit + final pool of 7 post-Dave-addendum Option C-minus; original draft was 8 including `shore`), focus-node naming guidance (not architecture — Kevin's PR #211 owns the `SkillNode` shape decision: 3 sibling nodes locked), picture-pack requirements summary, the `hybridMode: true` annotation requirement for the 3 long-vowel hybrids (§6.1), and the open questions Thomas has now resolved (§7). The companion MJ prompt sheet [`digraphs-sh-picture-pack-prompts.md`](./digraphs-sh-picture-pack-prompts.md) carries the per-word generation prompts (Phase 1 deliverable for Thomas).

**Out-of-scope (deferred):**

- `SkillNode` shape decision (one `digraphs` node vs. three sibling nodes vs. one node with internal sub-tier progression) — Kevin's audit owns this. **Resolved in PR #211: 3 sibling nodes (`digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless`).**
- `digraphs-ch` and `digraphs-th` word lists — separate specs, downstream after sh ships.
- Sh-final words (fish, dish, rush, wish, crash) — separate follow-up arc.
- Voiced `/ð/` content — deferred indefinitely from chip-tap; treated as sight-word domain per Dave §Q2.
- Distractor architecture refactor for digraph-vs-CVC contrast distractors (e.g. ship/sip pair) — flagged in §6 for Kevin's impl ticket; out-of-scope for this design pass.
- Sh-vs-ch interleaving rules — only triggers after ch ships and both digraphs reach ~70%+ accuracy (Dave §Q5); planner-side composition decision, not a word-list decision.

---

## 1. Word selection — the 7 sh-initial words (Option C-minus)

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

**Initial draft landing (superseded):** First draft of this spec recommended pool of 8 with `shore` flagged for Phase-2 contingency drop.

**Final landing (Dave addendum 2026-05-14, Option C-minus — LOCKED):** Pool of 7. `shore` dropped pre-Phase-2 per `design/research/digraph-sh-long-vowel-addendum.md` §Q7c. Two independent compounding concerns identified by Dave's research:

1. **Phonemic novelty.** `/ɔːr/` r-controlled vowel is more marked than `/ɑːr/` (shark). Tagalog has no clean equivalent of English `/ɔː/`; the r-controlled `/ɔːr/` combination is perceptually unfamiliar to Tagalog-L1 speakers. For a chip-tap recognition task, Marian may not confidently map Emma's `/ʃɔːr/` audio to the "shore" chip when the vowel itself is unfamiliar.
2. **Picture composition.** Multi-subject scene (sand + water + boundary) — violates single-subject style anchor + reads ambiguously as "beach"/"ocean" rather than "shore" at 96pt.

**No compensating vocabulary strength.** Filipino-English 8yo register reaches for "beach", not "shore". Dave's recommendation: defer `shore` to a future r-controlled-vowel tier where the phoneme has been formally introduced and the picture can be cleaner.

### Pool-size recommendation — 7 words (Option C-minus: long-vowel allowance minus `shore`)

The locked final pool:

> **`ship, shell, shoe, sheep, shark, shed, shop`** — 7 words.

At the lower edge of Dave's 8–10 range. Pool of 7 lets the planner construct 3–5 introduction sessions with controlled repetition (~4–5 sh-target words per session, rotating through the 7) — adequate for digraph introduction, slightly thinner than CVC tiers by design (digraph words carry higher vocabulary risk per word, so a tighter pool with stronger entries is preferable to a padded pool with weaker ones, per Dave §Q7d).

### Final v1 sh-initial pool (7 words, Option C-minus locked)

| #   | Word  | Vowel inside                        | Picture status | Sh-position | Category  | hybridMode | Notes                                                                                                                                                                                                 |
| --- | ----- | ----------------------------------- | -------------- | ----------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ship  | short-i (`/ɪ/`)                     | NEW            | initial     | vehicle   | false      | Vessel — hull + mast/smokestack + portholes. The cleanest sh-CVC anchor: 3-letter pattern (sh+i+p), short-vowel inside, universal picturable. Lead word.                                              |
| 2   | shell | short-e (`/ɛ/`)                     | NEW            | initial     | object    | false      | Spiral or scallop seashell. 3-phoneme geminate-CVC under the `egg`/`box` precedent. Strong picturable.                                                                                                |
| 3   | shoe  | long-oo (`/uː/`)                    | NEW            | initial     | object    | **true**   | Footwear — universal silhouette. Long-vowel sh-onset per Option C-minus allowance; picture+audio scaffold carries the long-vowel decoding. **Sight-word-hybrid** — see §6.1 `hybridMode` requirement. |
| 4   | sheep | long-e (`/iː/`, vowel digraph `ee`) | NEW            | initial     | animal    | **true**   | Woolly farm animal — distinct silhouette. Long-vowel sh-onset per Option C-minus. **Sight-word-hybrid.**                                                                                              |
| 5   | shark | r-controlled `a` (`/ɑːr/`)          | NEW            | initial     | animal    | **true**   | Sea creature — triangular fin + sleek body. Long-vowel + r-controlled per Option C-minus. Universally vocabulary-familiar (PH archipelago context). **Sight-word-hybrid.**                            |
| 6   | shed  | short-e (`/ɛ/`)                     | NEW            | initial     | structure | false      | Small wooden outbuilding — sloped roof + door + window. Short-vowel sh-CVC. Vocab register marginally Filipino-English but learnable via scaffold.                                                    |
| 7   | shop  | short-o (`/ɒ/`)                     | NEW            | initial     | structure | false      | Small storefront — awning + signboard + window. Short-vowel sh-CVC. Vocab register marginally Filipino-English but learnable via scaffold.                                                            |

**`shore` row removed** per Dave addendum 2026-05-14, Option C-minus. Deferred to future r-controlled-vowel tier.

### Pool composition cross-check (post-`shore` drop)

- **All 7 are concrete nouns** (objects, animals, structures). Each has a stable chip read.
- **All 7 are picture-distinct from existing CVC pack pictures** (`ship` vs `tub`/`box`; `shell` vs everything; `shoe` is unique; `sheep` is unique; `shark` is unique; `shed`/`shop` are structures absent elsewhere in the pack).
- **2 of 7 have known picture-instability or composition risk** (`shed` — could read as "small house"; `shop` — could read as "store"). Mitigation in the prompt sheet (`digraphs-sh-picture-pack-prompts.md`) covers these.
- **Vowel spread:** short-i (1: ship), short-e (2: shell, shed), short-o (1: shop), long-oo (1: shoe), long-e (1: sheep), r-controlled-a (1: shark) — 6 vowel positions. Phonetic variety adequate.
- **Category spread:** vehicle (1), object (2 — shell, shoe), animal (2 — sheep, shark), structure (2 — shed, shop). 4 categories across 7 words. The "place" category lost with `shore`'s drop is the only category-spread loss.
- **`hybridMode: true` split:** 3 of 7 (`shoe, sheep, shark`); 4 of 7 fully decodable (`ship, shell, shed, shop`). Per Dave §Q7d this is the right split for a digraph tier introducing one new phonics concept.

### Phonetic spread within the pool (digraph isolation check)

The whole point of this tier is for Marian to internalize **`sh = /ʃ/`** as a single decoded unit. Every word in the pool starts with `sh` followed by a vowel — the sh-decoding lesson is identical across all 7. The vowel-following diversity is incidental.

- **sh-initial position:** ✓ ALL 7.
- **sh-final position:** ✗ NONE (deferred per Dave finding #3).
- **sh + consonant blend at onset (e.g., `shr-`):** ✗ NONE (`shrub`, `shrimp` deferred).
- **Single-syllable:** ✓ ALL 7.

### Vocabulary-familiarity audit (the binding constraint per Dave §Q4)

For each of the 8, the picture-grounding-without-explanation check:

| Word  | Marian's L1 (Tagalog) referent                               | Picture-grounds-without-explanation?                                              | Audio-anchor risk                                                    |
| ----- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ship  | barko (high-frequency word in PH)                            | ✓ — ship/barko are universal                                                      | Low — clear picture                                                  |
| shell | kabibi / shell (English loanword common in PH beach context) | ✓ — beach shells universal                                                        | Low                                                                  |
| shoe  | sapatos / shoe (loanword)                                    | ✓ — universal                                                                     | Low                                                                  |
| sheep | tupa (less common in PH but storybook-familiar)              | ✓ — picture-grounded                                                              | Low — storybook recognition is solid                                 |
| shark | pating / shark (loanword in marine vocab)                    | ✓ — universal in PH                                                               | Low — shark and pating are interchangeable in Filipino-English       |
| shed  | kuwadra / kubo (loose mapping)                               | Marginal — depends on chip's roofline + door + window discriminating from "house" | Moderate — picture must read as "small building, not a house"        |
| shop  | tindahan / tindera (loose mapping)                           | Marginal — depends on chip's awning + signboard discriminating from "house"       | Moderate — picture must read as "small store with sign, not a house" |

**`shore` row removed** post-Dave-addendum Option C-minus.

**5 of 7 are vocabulary-familiar without scaffolding** (ship, shell, shoe, sheep, shark; plus arguably shop via the universal "store" concept once the picture is grounded). 2 of 7 have moderate picture-grounding risk that the prompt sheet must address (shed, shop).

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

One of these substitutions produces a real English word: `shell → sell`. (Pre-`shore`-drop the list also included `shore → sore`; with `shore` deferred per Dave addendum Option C-minus, only `shell/sell` remains as a real-English-word minimal-pair substitution risk in the v1 pool.) The distractor architecture (§5) must include the `sh`-vs-`s` contrast pair as a trap distractor. Emma's audio (Azure neural voice) produces `/ʃ/` correctly; the chip-tap recognition test is whether Marian matches the heard `/ʃ/` audio to the chip starting with `sh`, NOT to the chip starting with `s`. This is a meaningful learning target per Dave's recommendations to Kyle #4 (distractor design for digraphs differs from CVC).

---

## 1.3 The long-vowel allowance — design call and justification

This is the load-bearing design call in this spec. The audit forced this question because short-vowel-only sh-CVC nouns are scarce in English.

**Dave's addendum (2026-05-14) LOCKED Option C-minus:** long-vowel allowance for `shoe`, `sheep`, `shark` (with `hybridMode: true` annotation — see §6.1); `shore` dropped due to compounding phonemic novelty + composition complexity. The rest of this section preserves the original justification reasoning, with `shore` references stripped to the locked v1 pool of 3 long-vowel hybrids (down from the original 4 candidates).

### The case for short-vowel-only (Option A — what structured-literacy purists would say)

- Marian has just shipped short-e (the final single-vowel tier). She has NOT been taught long vowels, vowel digraphs (`ee`, `oe`), magic-e (`ape`, `ide`), or r-controlled vowels (`ar`, `or`).
- Introducing `shoe`, `sheep`, `shark` (originally also `shore`, now dropped) in the sh-tier means the chip presents TWO phonics challenges simultaneously: the sh-digraph AND a vowel pattern she hasn't formally learned.
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

Mark `shoe`, `sheep`, `shark` in the pool as **"sight-word-hybrid"** (`hybridMode: true` — see §6.1 for the schema requirement). Marian is expected to pattern-match against Emma's audio rather than fully decode the long-vowel rest-of-word. The planner / canon-bake produces session content that pairs these chips with Emma's audio + the picture, never with a "decode this aloud", "segment this word", or "spell from phoneme" prompt.

This is documented in the picture-pack prompt sheet's per-word notes for each of these 4 words.

**Recommended call (initial draft):** Option C with the hybrid annotation.

**Locked call (Dave addendum 2026-05-14):** **Option C-minus** — long-vowel allowance for `shoe`, `sheep`, `shark` only; `shore` dropped. Pool of 7 (`ship, shell, shoe, sheep, shark, shed, shop`). The 3 long-vowel hybrids carry `hybridMode: true` per §6.1.

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

**`shore/sore` row removed** post-Dave-addendum Option C-minus. With `shore` deferred, the strong-trap subset shrinks to 2 of 7 (ship/sip, shell/sell) plus shop/sop borderline. The remaining 4 (shoe/sue, sheep/seep, shark/sark, shed/sed) have weaker traps — either uncommon, non-word, or vocabulary-adult.

The strong-trap subset (`ship/sip, shell/sell, shop/sop`) is where the sh-vs-s discrimination test has real teeth. For the weak-trap subset, use a same-pool sh-neighbor as the trap instead — keeping the sh-decoding success-pattern intact while still giving Marian a phonics-meaningful choice.

**Class 2 — same-pool sh-neighbor (gentle distractor, mirrors short-vowel tier pattern):**

For every sh-target, pair it with another sh-target as the gentle distractor — same-sound-class, different referent. e.g. `ship` (target) with `shell` (gentle distractor) — Marian distinguishes by picture, not by sh-vs-s. This builds confidence + reinforces the sh-pool as a cohesive set.

### Recommended distractor matrix (concrete example for Kevin's impl ticket)

Full `TARGET_PAIRINGS` rows are Kevin's to author; design preview here so the structure is clear (mirrors `short-e §2`).

**Shape contract.** Every row's `gentle` and `trap` are `readonly [string, string]` tuples — exactly 2 entries each. This matches the existing `WordPairing` type in [`wordPack.ts`](../../src/screens/WordSong/wordPack.ts) and the v1 shape across all short-vowel tiers. Single-entry tuples are a type error.

**FORBIDDEN_PAIRS pre-check.** Every distractor below has been cross-checked against §6's FORBIDDEN_PAIRS additions: `[shed, shop]`, `[shoe, shop]`, `[ship, tub]`. No row pairs a target with a forbidden silhouette neighbor.

```ts
// Strong-trap subset — Class 1 (sh/s contrast) + Class 2 (sh-pool neighbor):
ship:  { gentle: ['shell', 'shark'], trap: ['sip',  'sheep'] },  // gentle: 2 sh-neighbors; trap: sh/s contrast + sh-neighbor
shell: { gentle: ['ship',  'shoe'],  trap: ['sell', 'sheep'] },  // gentle: 2 sh-neighbors; trap: sh/s contrast + sh-neighbor
shop:  { gentle: ['shark', 'shell'], trap: ['sop',  'sheep'] },  // gentle: 2 sh-neighbors (NOT shed or shoe — FORBIDDEN_PAIRS); trap: sh/s contrast + sh-neighbor

// Weak-trap subset — Class 2 (sh-pool neighbor only; weak s-contrast trap omitted):
shoe:  { gentle: ['ship',  'shark'], trap: ['shell', 'sheep'] }, // gentle + trap both sh-pool; sue too adult-vocab
sheep: { gentle: ['shark', 'shoe'],  trap: ['ship',  'shell'] }, // gentle + trap both sh-pool; seep too obscure
shark: { gentle: ['ship',  'sheep'], trap: ['shoe',  'shell'] }, // gentle + trap both sh-pool; sark non-word
shed:  { gentle: ['shark', 'sheep'], trap: ['ship',  'shell'] }, // gentle + trap both sh-pool (NOT shop — FORBIDDEN_PAIR); sed non-word
```

**Distractor-class summary per row:**

| Target | Gentle tier (problems 1-3) | Trap tier (problems 4-8) | Trap class         |
| ------ | -------------------------- | ------------------------ | ------------------ |
| ship   | shell, shark               | sip, sheep               | sh/s + sh-neighbor |
| shell  | ship, shoe                 | sell, sheep              | sh/s + sh-neighbor |
| shop   | shark, shell               | sop, sheep               | sh/s + sh-neighbor |
| shoe   | ship, shark                | shell, sheep             | sh-neighbor only   |
| sheep  | shark, shoe                | ship, shell              | sh-neighbor only   |
| shark  | ship, sheep                | shoe, shell              | sh-neighbor only   |
| shed   | shark, sheep               | ship, shell              | sh-neighbor only   |

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
- `sip` documented as dual-role; the other s-contrast distractors actually referenced by the matrix (`sell`, `sop`) are new distractor-only entries (NOT existing in `TARGET_WORDS`). (`sore` was originally planned as `shore`'s s-contrast trap; with `shore` dropped per Dave addendum, `sore` is NOT needed and should NOT ship.)

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

- **7 wholly-new pictures** (no re-traces — none of the 7 sh-words have existing distractor SVGs from prior tiers).
- Pictures embedded via `yarn embed-pictures` per the established Phase-3 pipeline.
- Filenames: `picture-ship.svg`, `picture-shell.svg`, `picture-shoe.svg`, `picture-sheep.svg`, `picture-shark.svg`, `picture-shed.svg`, `picture-shop.svg` at `public/assets/pictures/`.
- Style anchor: `picture-pack-style-anchor.md` §2 + §3 (locked, byte-for-byte preamble).
- Pool went 8 → 7 per Dave addendum 2026-05-14 Option C-minus: `shore` deferred to future r-controlled-vowel tier (§1.3).
- Additional 2 distractor-only pictures needed for the s-contrast traps (`sell`, `sop`) — Devon's picture-pack §6 finding #4 path applies (silhouette placeholders acceptable for distractor-only, vector trace deferred to polish backlog).

---

## 4. Emma's sh-introduction lines (design-side TTS script — not the spec for Kevin)

This is informational; the Word Song spec for Kevin's planner will lift the exact script lines. Per Dave §Application + recommendations to Kyle #1:

**First sh-encounter (lifetime-once scaffolding, similar to short-u's `sun/soon` opener mechanism per AC9b):**

> "Look — sh together! Two letters, one sound. Shhh [Emma finger-on-lips pose]. Ship! Sh-i-p. Ship."

**Vowel introduction (per session-open Emma greeting in sh-tier sessions, before any item):**

> "Today we're learning a new sound! When 's' and 'h' stand together, they make one sound: shhh. Like 'shhh, be quiet'."

**Per-item Emma lines (each sh-word):**

> "[word]! Listen: [word]. Can you find [word]?"

For the long-vowel hybrid items (`shoe`, `sheep`, `shark` — `hybridMode: true`, see §6.1):

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

- **`wordPack.ts TARGET_WORDS` additions:** distractor-only entries (`isTarget: false`) for the s-contrast traps actually referenced by the §2 matrix — `sell`, `sop`. These are NOT sh-words but need to exist as `WordEntry` rows with picture assets so the chip render resolves them via `getWordEntry()`. `sue, seep, sark, sed, sore` were rejected — `sue/seep/sark/sed` as too weak (§2), `sore` because its target `shore` was dropped post-Dave-addendum (§1).
- **`sip` is dual-role (NOT a new entry).** It already exists in `TARGET_WORDS` with `vowel: 'i'`, `isTarget: true`. The sh-tier row for `ship` references it by string. See §2 "`sip` as cross-tier-load-bearing dual-role distractor" and §10 finding #9. Operational rule from `.claude/docs/skill-trees-and-content.md` §"Cross-vowel-tier load-bearing" applies.
- **`pickDistractors` runtime is unchanged.** No functional refactor; matrix-lookup-only. Adding sh-tier `TARGET_PAIRINGS` rows is sufficient.
- **`buildChipOrder` runtime is unchanged.** Render-time positioning is target-agnostic.
- **`FORBIDDEN_PAIRS` extension** for in-pool sh-hygiene rules (table in §6 above).
- **`WordEntry.vowel` type union** may need to extend or be supplanted by Kevin's `phoneme:` field per PR #211 — see §10 finding #10.
- **Picture assets for distractor-only s-contrast entries.** `sell`, `sop` each need a picture (silhouette placeholder is acceptable per the existing pattern for distractor-only entries; vector trace can land in polish backlog). `sip` reuses its existing short-i picture asset.

**This is downstream for Kevin's impl ticket.** Flagging here so the spec downstream is clear.

### 6.1 `hybridMode: true` annotation requirement (NEW canon-schema field per Dave addendum)

**This is a NEW canon-schema field that does not exist in `wordPack.ts` today.** Spec'd here for the impl ticket; ownership is Kevin's planner-widen + canon-bake task.

#### What

Add a per-`WordEntry` boolean flag — proposed name `hybridMode: boolean` (default `false`). Set `true` for the 3 long-vowel hybrid sh-tier words:

| Word  | `vowel` (current union)   | `hybridMode` | Reason                                                     |
| ----- | ------------------------- | ------------ | ---------------------------------------------------------- |
| shoe  | TBD (see §10 finding #10) | `true`       | Long-vowel `/uː/` outside Marian's formal phonics tiers    |
| sheep | TBD                       | `true`       | Long-vowel `/iː/` + vowel digraph `ee` outside tiers       |
| shark | TBD                       | `true`       | R-controlled `/ɑːr/` outside Marian's formal phonics tiers |

The other 4 sh-tier words (`ship`, `shell`, `shed`, `shop`) are conventional short-vowel sh-CVC entries — `hybridMode: false` (the default).

#### Why

Per Dave addendum §Q7d:

> `shark` (and `shoe`, `sheep`) must be permanently annotated as a hybrid/sight-word entry in the canon, never as a decode target. [...] Ensure the planner never generates a segmentation, spelling, or decode-from-phoneme prompt for these three words. The only valid planner prompts for hybrid words: "Listen to Emma, tap the word you hear" (recognition) and "What word does this picture show?" (retrieval).

The annotation is the machine-readable bridge between the spec-side pedagogical posture ("these words are picture+audio sight-word-hybrids") and the planner-side prompt generation ("emit only chip-tap recognition prompts for these words"). Without the annotation, the planner could over time start emitting decode prompts for hybrid words — which would violate the developmental rationale that admitted them into the pool.

#### Planner-side requirement (canon-schema + Haiku prompt)

Two pieces:

1. **`WordEntry.hybridMode: boolean`** — new field on the `WordEntry` shape in `wordPack.ts`. Default `false`. Read-only at the data layer.
2. **Planner prompt gating** — the Haiku-prompted session canon generation must consult `hybridMode`. For words with `hybridMode: true`:
   - **Allowed problem types:** chip-tap recognition (Emma says the word, Marian taps the chip — current default for the digraphs-sh tier) and picture-retrieval ("What word does this picture show?").
   - **Disallowed problem types:** segmentation ("Tell me the sounds in s-h-e-e-p"), spelling-from-phoneme ("Emma says `/ʃiːp/`, type the word"), decode-from-letters ("Read these letters aloud: s-h-e-e-p"), any task that requires the child to produce or decode the rest-of-word vowel pattern.
   - The planner's Haiku prompt should include the rule explicitly: "For words flagged `hybridMode: true`, generate ONLY chip-tap recognition or picture-retrieval problems. Do NOT emit segmentation, spelling, or decode prompts for these words."

#### Out-of-scope for THIS spec (downstream for Kevin's impl ticket)

- Whether `hybridMode` lives in `WordEntry` (per-word) or in a separate node-level config (per-skill-node). Per-word is the recommended shape — fits the existing `WordEntry` extension pattern (`isTarget`, `vowel`, `category` are all per-word) and lets future digraph tiers (`digraphs-ch`, `digraphs-th-voiceless`) independently flag their own long-vowel hybrids if needed.
- The exact set of problem types the planner can emit for `digraphs-sh`. The locked v1 problem type is chip-tap recognition (mirrors CVC tiers). Picture-retrieval is a future-tier consideration. For v1, the practical gating is "the planner cannot emit any problem type other than chip-tap recognition for sh-tier targets" — and `hybridMode` is the future-proofing for when picture-retrieval / segmentation / spelling problem types are introduced for other tiers.
- The migration path for existing tiers (`cvc-words-short-*` nodes) that don't have `hybridMode` set on their entries. Default `false` is safe — existing nodes preserve current behaviour.

#### Coordination with Kevin's PR #211

`hybridMode` is orthogonal to the SkillNode-shape decision (PR #211) and to the phoneme-tag proposal (PR #211 §3.3). Per Dave's §Q8c addendum, the developmental impact of phoneme-tag and SkillNode-split ordering is negligible. `hybridMode` does NOT depend on phoneme-tag landing first — they are independent annotations. The impl ticket for sh-tier content can add `hybridMode` alongside the new sh-tier `WordEntry` rows in the same diff.

#### Implementation footprint estimate

- `wordPack.ts` — add `hybridMode: boolean` to the `WordEntry` type and 3 `hybridMode: true` entries (`shoe, sheep, shark`); rest default `false`. ~10 lines.
- `api/_planner*.ts` — extend the Haiku system prompt to include the hybridMode rule. ~3-5 prompt-string lines.
- Canon-bake script — no change (it consumes whatever the Haiku planner emits).
- E2E test (per AC12) — new spec verifying no segmentation/spelling/decode problem for hybridMode words in sh-tier sessions. ~30 lines of test.

---

## 7. Open questions for Thomas

All 6 original open questions are now resolved (Thomas locked Q1/Q2/Q3/Q5/Q6 directly via orchestrator brief 2026-05-14; Q4 was decided in PR #211; Dave's research addendum 2026-05-14 confirmed Q1/Q2 at the developmental level). Section retained for spec history and so future digraph specs can pattern-match the resolutions.

### Q1 — Long-vowel allowance (LOAD-BEARING) — RESOLVED: Option C-minus

**Resolution:** Pool of 7 (`ship, shell, shoe, sheep, shark, shed, shop`). Long-vowel allowance for `shoe/sheep/shark` via picture+audio hybrid scaffold; `shore` dropped. Locked by Thomas pending Dave confirmation; Dave addendum 2026-05-14 (`design/research/digraph-sh-long-vowel-addendum.md` §Q7d) independently arrived at the same recommendation. 3 of 7 carry `hybridMode: true` per §6.1.

### Q2 — `shore` retention — RESOLVED: drop pre-Phase-2

**Resolution:** Drop `shore` proactively, ship at 7. Originally drafted as Phase-2 contingency; Dave's addendum §Q7c converted the contingency into a recommendation (`/ɔːr/` r-controlled vowel is phonemically novel for Tagalog-L1 + composition-complex picture, no vocab compensator). `shore` is deferred to a future r-controlled-vowel tier where the phoneme is formally introduced and the picture composition can be cleaner.

### Q3 — `shop` vs `store` register — RESOLVED: keep `shop`

**Resolution:** Keep `shop` in the pool. Picture+audio scaffold sufficient. Register-mismatch concern similar to `gem` (short-e), which shipped. Dave's addendum non-obvious finding #2 adds a supporting reason: `shed` and `shop` are British-English high-frequency words, useful advance-vocabulary anchors for Marian's August 2026 Danish school transition (Danish school English instruction uses British register). Real-iPad smoke contingency to drop `shop` empirically if real-Marian observation shows register mismatch eating chip-tap accuracy remains in §10 finding #4.

### Q4 — Sh-tier `SkillNode` shape — RESOLVED in PR #211

**Resolution:** 3 sibling nodes (`digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless`) per Kevin's PR #211 architecture audit. Out-of-scope for this spec; included here only as a pointer. See PR #211 for the locked shape.

### Q5 — Sh-tier mastery rule alignment with CVC tiers — RESOLVED: same 90/3

**Resolution:** Same 90/3 mastery rule as CVC tiers. After 90% accuracy across 3 consecutive sessions, `digraphs-sh` graduates; `digraphs-ch` unlocks. Dave's research does not recommend differentiating digraph mastery thresholds from CVC; parent-settings infrastructure already supports per-track threshold overrides if needed later.

### Q6 — Sh/ch interleaving trigger — DOWNSTREAM (not a live question)

Demoted to "downstream considerations" per Devon's PR #212 review — there is nothing for Thomas to lock here. Operationalization (e.g. "3 sessions above 70%") is a planner decision at the time `digraphs-ch` ships. Retained for future-spec pattern-matching but not a gating question for this spec.

---

## 8. Acceptance criteria

For this spec's downstream impl tickets (Kevin's planner + Devon's wordPack + canon-bake):

- [ ] **AC1 — pool size:** `wordPack` for the `digraphs-sh` sibling node (per PR #211) contains the 7 words: `ship, shell, shoe, sheep, shark, shed, shop`. (Originally 8 in this spec's first draft; `shore` dropped per Dave addendum 2026-05-14 Option C-minus.)
- [ ] **AC2 — distractor-only pool:** sh-tier-specific s-contrast distractor entries exist as text+audio chips: `sell, sop` as new distractor-only entries; `sip` is dual-role (reuses existing short-i `TARGET_WORDS` entry, see §2 sip-dual-role subsection). `sue, seep, sark, sed, sore` are NOT shipped — `sue/seep/sark/sed` too weak (§2), `sore` no longer needed (its target `shore` dropped).
- [ ] **AC3 — Trio composition for sh-tier (`pickDistractors` + `buildChipOrder`):** for every sh-target row in `TARGET_PAIRINGS`, both gentle entries are sh-pool neighbors; the trap entries are either (a) an s-contrast distractor-only word + a sh-pool neighbor (strong-trap subset: `ship`, `shell`, `shop`) or (b) two sh-pool neighbors (weak-trap subset: `shoe`, `sheep`, `shark`, `shed`) per the matrix in §2. No CVC short-vowel words appear as distractors in sh-trios. Tuple shape is `readonly [string, string]` for both `gentle` and `trap`. Render-time positioning of the 3 chips remains in `buildChipOrder()`; no new function needed.
- [ ] **AC4 — FORBIDDEN_PAIRS:** `[shed, shop]`, `[shoe, shop]`, `[ship, tub]` added to the FORBIDDEN_PAIRS list.
- [ ] **AC5 — Emma's two-letters-one-sound opener:** fires the first time sh-tier is encountered (lifetime-once); persists in localStorage. Mirrors short-u's `sun/soon` AC9b mechanism.
- [ ] **AC6 — Per-session sh-vowel-cue:** small visual cue (e.g., "sh - ship" with picture) persists in screen corner during sh-tier sessions WHILE `digraphs-sh.state === 'practicing'` (per `applyMasteryRule()` in `src/lib/progress/mastery.ts`). The cue is hidden once the node flips to `'mastered'`. Concretely: `intro` state shows the cue; `practicing` state shows the cue; `mastered` hides it. This maps cleanly to the existing `Progress.skillLevels[node]` field — no new accuracy-percentage infrastructure required. (Originally drafted as "until ~70% accuracy" which has no corresponding state in the progress model; corrected per Devon's PR #212 review.)
- [ ] **AC7 — 7 picture assets shipped:** `picture-{ship,shell,shoe,sheep,shark,shed,shop}.svg` at `public/assets/pictures/`, embedded via `yarn embed-pictures`. Plus 2 distractor-only picture assets for s-contrast traps: `picture-sell.svg` and `picture-sop.svg` (silhouette placeholders acceptable per Devon's picture-pack §6 finding #4 path; vector trace deferred to polish backlog). `picture-sip.svg` already exists from short-i tier (reused).
- [ ] **AC8 — mastery rule:** sh-tier graduates at 90% accuracy across 3 consecutive sessions (per Q5 lock).
- [ ] **AC9 — same-vowel-only-extended-to-sh-only rule:** sh-trios contain only sh-pool words + s-contrast distractors, never CVC short-vowel words. (Cross-tier review of mastered CVC content is handled outside of sh-trios, via the planner's existing cross-tier review mechanism.)
- [ ] **AC10 — canon bake:** sh-tier session canon is baked via `npm run canon:regen` post-spec-merge; canon JSON committed in the impl PR.
- [ ] **AC11 — Jessica E2E spec (per `feedback_progression_e2e_mandatory.md`):** sh-tier progression includes a failing-first E2E spec — covers (a) first-encounter scaffold fires once, (b) ~90% accuracy across 3 sessions transitions sh-tier from `intro → practicing → mastered`, (c) trap distractor (sh/s contrast) correctly counts as wrong when selected.
- [ ] **AC12 — `hybridMode: true` planner gating (NEW per Dave addendum 2026-05-14 §Q7d):** the 3 long-vowel hybrid words (`shoe`, `sheep`, `shark`) are flagged `hybridMode: true` in the `WordEntry` schema. The planner (Haiku prompt) must NEVER generate segmentation, spelling, or decode-from-phoneme prompts for these 3 words — only chip-tap recognition (Listen + tap) and picture-retrieval ("What word does this picture show?") problem types. Concrete tests: (i) `wordPack.ts` exports 3 entries with `hybridMode: true`; (ii) planner prompt explicitly excludes hybridMode-flagged words from any segmentation/spelling/decode task class; (iii) Jessica E2E spec verifies that for sh-tier sessions, no problem against `shoe`/`sheep`/`shark` is of segmentation/spelling/decode type. See §6.1 for the full schema requirement.

---

## 9. Sources

This spec is derived from:

- `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14) — research gate; cited in §1 Why-now, §1 Audit, §2 Distractors, §4 Emma lines, §5 Scaffold, §6 Planner, §7 Open questions.
- `design/research/digraph-sh-long-vowel-addendum.md` (Dave, 2026-05-14) — extends the digraph research; locked Option C-minus (pool of 7, drop `shore`); cited in §1.3, §1 final pool, §6.1 `hybridMode` requirement, §7 Q1/Q2 resolutions, §8 AC12, §10 findings #1/#5/#6/#11/#12.
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

1. **The English sh-initial short-vowel-CVC noun stock is small** — about 4 strong picks (`ship`, `shell` + 2 borderline). The initial draft of this spec posed long-vowel allowance as the load-bearing question for Thomas; Dave's research addendum 2026-05-14 (`design/research/digraph-sh-long-vowel-addendum.md` §Q7a-d) independently confirmed Option C-minus (long-vowel allowance for `shoe/sheep/shark`; `shore` dropped due to compounding novelty + composition concerns). The locked pool is 7 — 4 short-vowel + 3 long-vowel hybrids.

2. **The sh-tier introduces a new distractor pattern (sh/s contrast) that did NOT exist in CVC tiers.** Mechanically the change is small — `pickDistractors` in `wordDistractors.ts` is a matrix-lookup-and-resolve function with no per-tier logic, so adding sh-tier rows to `TARGET_PAIRINGS` with the appropriate distractor strings is sufficient at the runtime layer. The architecturally-meaningful work is in `wordPack.ts`: distractor-only `WordEntry` rows for `sell`, `sop` (NOT same-vowel-pool neighbors — these are short-e and short-o words functioning as sh-trio distractors only), each with `isTarget: false` and a picture asset. `sip` is a dual-role exception (see finding #9 below). This is downstream for Kevin's impl ticket but is flagged here so the spec downstream is clear it's not just "add more words to TARGET_WORDS".

3. **4 of 7 sh-targets have NO good s-contrast trap word** (`shoe/sue` adult-vocab, `sheep/seep` uncommon, `shark/sark` non-word, `shed/sed` non-word). The matrix uses sh-pool-neighbors for these weak-trap pairings. This is fine pedagogically (the sh-vs-sh trio still teaches digraph recognition by picture) but it means only 3 of 7 (ship, shell, shop) get the sh-vs-s discrimination contrast that's the diagnostically most useful test per Dave §Recommendations-to-Kyle #4. (Pre-`shore`-drop the strong-trap count was 4 of 8; the ratio improved very slightly post-drop — 3 of 7 is 43% vs 4 of 8 = 50% — but the absolute number of strong-trap pairs is down from 4 to 3.)

4. **`shop` and `shed` have vocabulary register mismatch with Filipino-English** — Marian's L1 dialect uses `store` and `kubo/small building` respectively. The picture+audio scaffold builds the English-register association, but Thomas should be alert during real-iPad smoke that these two chips don't produce confusion. Dave's addendum non-obvious finding #2 adds a strengthening factor: `shed` and `shop` are British-English high-frequency words and useful advance-vocabulary anchors for Marian's August 2026 Danish school transition (Danish school English instruction uses British register). If real-Marian observation shows `shop` consistently failing because the picture reads as "store" not "shop", the contingency is to drop `shop` and ship at 6 (`ship, shell, shoe, sheep, shark, shed`).

5. **`shark` is the strongest pick in the long-vowel-allowance set** despite having `ar` r-controlled vowel — universal vocabulary, universal picture, PH-cultural-context strong. Dave's addendum §Q7c confirms shark passes the developmental bar conditionally on the `hybridMode: true` annotation (see §6.1) — the planner must never emit segmentation/spelling/decode prompts for it, only chip-tap recognition.

6. **`shore` was dropped from the v1 pool** per Dave's addendum §Q7c (Option C-minus). Two independent compounding concerns: (a) `/ɔːr/` r-controlled vowel is phonemically novel for Tagalog-L1, more marked than `/ɑːr/` (shark) which is conditionally workable; (b) picture composition requires multi-subject scene (sand + water + boundary) — violates single-subject style anchor + reads ambiguously as "beach"/"ocean" at 96pt; (c) no compensating vocabulary strength (Filipino-English 8yo register reaches for "beach"). Deferred to a future r-controlled-vowel tier where the phoneme is formally introduced and the picture composition can be cleaner. Dave's recommendation #4: "Do not add `shore` to a later tier until r-controlled vowels (`or` pattern) are formally introduced."

7. **Sh-final position is intentionally deferred** (Dave finding #3). Sh-final words (`fish, dish, wish, rush, crash, bush, cash, dash, gush, mush`) are a meaningful follow-up arc once sh-initial consolidates. About half of those are highly picturable (fish, dish, bush, brush-not-actually-CVCC, crash); the others are verbs/abstract. Flagging here so the sh-final follow-up spec has a starting candidate list.

8. **The two-letters-one-sound concept is new for Marian.** Tagalog does not have true consonant digraphs in the same way; per Dave §Application this is "the primary conceptual barrier, not the blending mechanic." Emma's first-encounter line must explicitly name the concept ("Two letters, one sound. Shhh.") — this is a script-side requirement that the spec downstream for Kevin must implement. It is NOT a passive design hint; it's load-bearing for Marian's success on the tier.

9. **`/ʃ/` → `/s/` is the structural L2 substitution risk (not per-word).** This is testable in the chip-tap format via the sh/s contrast distractor. But the production-side substitution (Marian saying `/s/` when she means `/ʃ/`) is NOT testable in chip-tap and is acceptable per Dave §Q3 — the app tests recognition, not production. Thomas should be alert that real-Marian iPad smoke may show her getting all chip-taps right while still pronouncing `/s/` aloud; that is expected and not a failure mode.

10. **`sip` is the second discovered cross-vowel-tier load-bearing distractor in `wordPack.ts`** (after `pen`, post-#208). Surfaced by Devon's review of PR #212. The cluster pattern (`.claude/docs/skill-trees-and-content.md` §"pen is cross-vowel-tier load-bearing") generalises cleanly: a word with `vowel: 'i'` and `isTarget: true` referenced as a string distractor from a DIFFERENT vowel tier's `TARGET_PAIRINGS` row (here: sh-tier referencing `sip` as `ship`'s trap distractor). The dual-role resolution (keep the entry as-is in `TARGET_WORDS`, reference by string from the new matrix row) is the established cheap path. The cluster now contains: `pen` (`'e'`), `dog` (`'o'`), `log` (`'o'`), `cup` (`'u'`), `sun` (`'u'`), `sip` (`'i'`). Worth updating `.claude/docs/skill-trees-and-content.md`'s table to add the sh-tier-as-referencing-tier row once this spec ships its impl.

11. **The `vowel:` literal type may need to extend for sh-tier `WordEntry` rows.** Per Devon's review, the current `WordEntry.vowel` is `'a' | 'o' | 'u' | 'i' | 'e'` (short vowels only). The 3 long-vowel-allowance sh-words (`shoe`, `sheep`, `shark`) do not fit this union. Three resolution paths: (i) extend the union to include digraph-tier values like `'sh-long'` or per-word phoneme tags; (ii) annotate a fake-but-closest short vowel as a soft placeholder with comment documentation; (iii) ship Kevin's PR #211 phoneme-tag proposal first and use `phoneme: '/ʃ/'` uniformly on all 7 sh-rows as the canonical disambiguator. This is load-bearing for the impl ticket — flagged here so Kevin's coordination with PR #211 sequencing is clear. Per Dave addendum §Q8c, this ordering is developmentally invisible to Marian as long as canon-bake doesn't deploy until both the SkillNode-split and the phoneme-tag (or alternative resolution) are in place — code-shape decision only.

12. **`hybridMode: true` is a NEW canon-schema field** introduced by Dave's addendum 2026-05-14 §Q7d (see §6.1). Three words flagged (`shoe, sheep, shark`); the other 4 are conventional decodable. The planner's Haiku prompt must consult this flag and gate problem-type generation accordingly. AC12 lays out the testable requirements. The field is orthogonal to SkillNode-split and phoneme-tag (PR #211) — independent of either's landing order.

13. **The picture-pack also needs `sell` and `sop` distractor-only pictures.** These are short-e and short-o words being used as sh-trio s-contrast distractors. Per the existing distractor-only-entry pattern in `wordPack.ts`, silhouette placeholders are acceptable for v1; vector trace can land in polish backlog. Devon's picture-pack §6 finding #4 path applies. The picture-pack prompt sheet (`digraphs-sh-picture-pack-prompts.md`) does not include prompts for these two — they fall under the distractor-only-entries pipeline, not the per-target-word MJ generation pipeline.
