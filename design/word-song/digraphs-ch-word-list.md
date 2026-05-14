# Word Song — digraphs `ch` word list (7 words, all fully decodable; reconciled against Dave's ch-addendum)

**Ticket:** TBD — Matt to file. This spec lands the design-side word selection for the SECOND digraph tier. Implementation downstream (Kevin's planner-widen + canon-bake against the `digraphs-ch` sibling node already created in PR #211; Devon's `wordPack.ts` rows + picture-pack embed wiring).
**Status:** Draft for Thomas review. **Pool RECONCILED against Dave's research addendum** — see §0.
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14 — sh/ch/th sequencing, /tʃ/ error profile, word count) AND **`design/research/digraph-ch-addendum.md` (Dave, 2026-05-14 — the /tʃ/-specific authority; locks the 7-word inventory + the zero-`hybridMode` call). This spec's §1 pool IS Dave's §3c recommended pool.**
**Companion spec:** `design/word-song/digraphs-ch-picture-pack-prompts.md` (Phase-1 MJ prompt sheet sibling).
**Structural predecessor (cloned section-for-section):** `design/word-song/digraphs-sh-word-list.md` — the sh tier shipped 2026-05-14 (PR #220 wordPack + #223 planner/canon + #219 E2E). This spec mirrors its structure; the _content_ is reconciled against Dave's ch-addendum, which diverges from the sh tier on three structural points (§0).
**Predecessor pool specs (format reference):** `design/word-song/short-e-pool-expansion.md`, `design/word-song/short-i-pool-expansion.md`, `design/word-song/short-u-pool-expansion.md`, `design/word-song/short-o-pool-expansion.md`.

---

## 0. Reconciliation with Dave's `digraph-ch-addendum.md` — what changed

Dave's `design/research/digraph-ch-addendum.md` landed on `main` (2026-05-14) and is the **authority on which ch words are level-appropriate**. This spec's pool, distractor posture, and `hybridMode` call are reconciled against it. An earlier in-flight draft of this spec — written before the addendum was on disk — proposed a different pool (`chip, chest, chick, chimp, cheese, chair, chain` with 3 `hybridMode: true` long-vowel hybrids). **That draft is superseded.** Dave's addendum diverges from it on three structural points, all adopted here:

| Point              | Pre-addendum draft                                   | Dave's addendum (LOCKED — adopted here)                                                                                                                |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pool**           | `chip, chest, chick, chimp, cheese, chair, chain`    | **`chin, chip, chop, chat, chest, chug, chick`** (Dave §3c)                                                                                            |
| **`hybridMode`**   | 3 of 7 (`cheese, chair, chain` — long-vowel hybrids) | **ZERO** — all 7 use short vowels Marian has formally covered (Dave §3d, non-obvious finding #1)                                                       |
| **ch-final words** | deferred entirely                                    | available (`rich`/`much` audited); `much` dropped as unpicturable, `rich` an optional add only — the locked 7 are all **word-initial** (Dave §2b, §3c) |

**Why the divergence:** the pre-addendum draft worried that ch-initial short-vowel CVC noun stock was too thin (extrapolating from sh, which genuinely was — sh needed Option C-minus's long-vowel allowance). Dave's addendum §4c / §Risk #1 corrects this directly: **"the ch word stock is rich enough in short-vowel options that no long-vowel or r-controlled words are needed."** The pre-addendum draft also rejected `chin` (body-fragment imagery), `chop`, and `chat` (verb/abstract) — Dave's addendum KEEPS all three with specific picture briefs and pedagogical rationale (§3a, §Recommendations-to-Kyle #4). Dave's calls win; this spec adopts his pool verbatim. The structural skeleton below (audit lens, distractor classes, AC numbering, schema reuse) is unchanged from the sh-tier template — only the _content_ is reconciled.

**`chin`, `chop`, `chat` — picture briefs that rescue Dave's keeps.** The pre-addendum draft's rejections of these three were not wrong on the picture risk — they were wrong to treat that risk as disqualifying. Dave §Recommendations-to-Kyle #4 supplies the briefs that make them work, carried into §3 of this spec and the companion prompt sheet:

- **`chin`** — NOT a free-floating body fragment. The brief is a **clear side-profile or chin-forward crop of a friendly cartoon face** where the chin is the salient feature. Dave §3a: "the picture is literally on Marian's face" — body parts are the highest-familiarity vocabulary class. The sh-tier `shin` rejection does NOT generalize: `shin` is a lower-leg fragment with no face context; `chin` is a face feature shown in a face.
- **`chop`** — NOT the bare verb. The brief is **a chopped log / piece of split wood with a small axe**, OR a karate-chop motion line — the concrete-result depiction. Dave keeps `chop` specifically because it is the **`chop`/`shop` minimal-pair anchor** with the sh tier (§3a, §Recommendations-to-Kyle #3).
- **`chat`** — NOT abstract. The brief is **two simple figures with a speech bubble between them** — clearly reading as "talking/chatting". Dave §3a: "the best short-a ch word that is picturable."

---

## Why this spec, why now

Per Dave's research (`digraph-acquisition-marian.md` §Q1/§Q2 + `digraph-ch-addendum.md` Bottom-line, §5):

- The digraph introduction order is **`sh` first, `ch` second, voiceless `th` third.** Voiced `/ð/` is deferred entirely (sight-word domain).
- `sh` shipped 2026-05-14 (`digraphs-sh` tier — 7-word pool, planner directive, committed canon, regression spec). `ch` is the next tier in the locked sequence.
- **ch second is a deliberate pedagogical asset, not just an ordering** (Dave ch-addendum §5, §Recommendations-to-Kyle #3): Marian has already practiced `ship` and `shop` in the sh tier. Introducing `chip` and `chop` in the ch tier creates **natural sh/ch minimal-pair discrimination anchors** (`chip`/`ship`, `chop`/`shop`). This is the specific payoff of sequencing sh before ch.
- **The "two letters, one sound" concept is now a review, not a new lesson** (Dave ch-addendum §5). Emma can say "Remember how sh made one special sound? Ch is the same!" The conceptual barrier sh faced does not recur for ch.
- **/tʃ/ is meaningfully EASIER for Marian than /ʃ/ was** (Dave ch-addendum Bottom-line, §1a, §Application): unlike `/ʃ/`, the affricate `/tʃ/` entered Tagalog through Spanish + English loanwords (`tsaa` = "tea"; `church`, `cheese`, `chips`) and has marginal-phoneme status in the loanword layer. Marian has perceptual scaffolding for `/tʃ/` she entirely lacked for `/ʃ/`. The substitution risk is `/tʃ/`→`/ts/` at the basilect level — a _partial_ substitution, not the blank-slate error sh presented — and it is **production-only**, irrelevant to the chip-tap recognition task (Dave ch-addendum §Risk #2).
- **The ONE thing ch has that sh did not: the c-says-/k/ orthographic trap** (Dave ch-addendum §1c, non-obvious finding #2). Marian already knows `c` says `/k/` (from `cat`, `cap`, `cup`). When she meets `ch`, her existing knowledge generates a competing hypothesis: "`c` = `/k/`, so `ch` = `/k/`-ish." This is a grapheme-mapping hypothesis she must explicitly override. Emma's introduction script MUST name it once and clearly — see §4.
- 8–10 words per digraph; the ch tier ships at **7** — Dave ch-addendum §Risk #1 confirms 7 is adequate depth for 3–5 introduction sessions.
- **Vocabulary-familiarity is the binding constraint** — same as sh (Dave finding #4). Picture-grounding the chip is the design response. Dave's ch pool is chosen for picture-stability; §3 carries his per-word picture concerns.

**Scope of this spec:** word selection (reconciled — Dave's locked 7-word inventory, §1), focus-node naming guidance (not architecture — the `digraphs-ch` `SkillNode` already exists per Kevin's PR #211 3-sibling split), picture-pack requirements summary, the **zero-`hybridMode` posture and why it is stated explicitly** (§6.1 — Dave non-obvious finding #1), and the open questions for Thomas (§7).

**Out-of-scope (deferred):**

- `SkillNode` shape — already locked in PR #211 (`digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless` — 3 sibling nodes). This spec consumes the `digraphs-ch` node.
- `digraphs-th-voiceless` word list — separate spec, downstream after ch ships.
- **Ch-final words** (`rich, much, such, which, lunch, bench`) — Dave audited `rich`/`much`; `much` is unpicturable (dropped), `rich` is an optional add only if its picture grounds (Dave §3b). The locked 7 are all word-initial. A ch-final follow-up arc (mirroring the sh-final deferral) is downstream.
- Voiced `/ð/` content — deferred indefinitely from chip-tap (sight-word domain, Dave §Q3).
- **Sh-vs-ch interleaving rules** — Dave §Q5 + ch-addendum §5/§Risk #4: interleave sh and ch with each other once _both_ are at ~70%+ accuracy. Cross-pool distractors (`ship` as a distractor for `chip`) belong to the _interleaving_ phase, NOT the ch-introduction tier (§2 below). A planner-side session-composition decision for a future interleaving spec.
- Distractor architecture refactor — the sh tier already built the cross-orthography distractor pattern. ch reuses that machinery; §2 / §6 below specify the ch-specific rows, no new architecture.

---

## 1. Word selection — the 7 ch-initial words (Dave's §3c locked inventory)

### Brief / source pool

Dave's `digraph-ch-addendum.md` §2 sources the candidate pool from structured-literacy ch word lists (CVC at Home §2a Source 8; Pencils to Pigtails Source 9) cross-referenced against Marian's formal vowel instruction:

- **Word-initial ch-CVC (short vowel Marian has covered):** `chat, chap, champ` (short-a), `check, chess, chest` (short-e), `chin, chip, chick, chimp` (short-i), `chop, chomp` (short-o), `chug, chum, chunk, chuck` (short-u).
- **Word-final ch (CVCC):** `much, such, hutch, Dutch` (short-u); `rich, which, stitch, itch` (short-i); `bench, French, wrench` (short-e); `ranch, branch` (short-a).

Dave's §3c **recommended final pool of 7** (LOCKED — this spec adopts it verbatim):

> **`chin, chip, chop, chat, chest, chug, chick`**

Dave's rationale (§3c):

- All use short vowels Marian has formally covered (i, o, a, e, u, i).
- All are word-initial ch — cleaner decoding arc, no CVCC complexity.
- All are picturable single-subject concrete objects or familiar actions.
- **None require `hybridMode` treatment** — every vowel pattern is within formal instruction (§3d).
- `chop` / `chip` create natural minimal-pair anchors with sh-tier `shop` / `ship`.
- `chest` (short-e) is the emerging-vowel entry — suitable as a recognition-only warm-up like `gem` and `web` were in the short-e tier; the planner weights it conservatively in introduction sessions.

### Audit of the candidate set

Audited against v1 word-pack constraints (single-syllable, picturable, distinct silhouette at 96pt, vocabulary-familiar for an L2 8yo, ch-initial position). Same audit lens as `digraphs-sh-word-list.md` §1. **The verdicts below are reconciled with Dave's §3a/§3b/§4 — where this audit's instinct differed from Dave's call, Dave's call wins and the row says so.**

| Word                            | ch-init | Pattern                            | Concrete                                                                                      | Picturable for L2 8yo                                                                                                 | Vocabulary risk                                                                          | Silhouette risk                                                                                 | Verdict (reconciled w/ Dave's addendum)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------- | ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **chin**                        | ✓       | ch-CVC (short-i)                   | ✓ (body part — point of the lower jaw)                                                        | ✓ **with the right brief** — a friendly cartoon face in side-profile / chin-forward crop, chin as the salient feature | High — body part, universally known; Dave §3a calls it the "ideal anchor"                | Low — face-with-prominent-chin is distinct                                                      | **KEEP** (Dave §3a, §3c). The pre-addendum draft rejected `chin` as body-fragment imagery (paralleling sh-tier `shin`) — **Dave overrides**: `chin` is shown _in a face_, not as a free-floating fragment; body parts are the highest-familiarity vocabulary class. Lead anchor word.                                                                                                                                                                        |
| **chip**                        | ✓       | ch-CVC (short-i)                   | ✓ (food chip — a single crisp)                                                                | ✓ — single potato/tortilla chip silhouette; brief must disambiguate from poker-chip / microchip                       | High — "chips" is a universal Filipino-English loanword (Dave §3a: Piattos, Lay's)       | Low — small flat curved object, distinct                                                        | **KEEP** (Dave §3a, §3c). Strong pick. The `chip`/`ship` minimal pair with the sh tier is a planned discrimination asset (Dave non-obvious finding #3).                                                                                                                                                                                                                                                                                                      |
| **chop**                        | ✓       | ch-CVC (short-o)                   | ✓ **with the right brief** — a chopped/split log + small axe (concrete-result depiction)      | Moderate — the verb "chop" is familiar; the chopped-log picture is concrete and common                                | Moderate — "chop" as a cut of meat is vocab-marginal, but the chopped-log sense is clean | Low — log + axe is distinct                                                                     | **KEEP** (Dave §3a, §3c). The pre-addendum draft rejected `chop` as verb-class — **Dave overrides**: `chop` is the **`chop`/`shop` minimal-pair anchor** with the sh tier (the specific payoff of sh-before-ch sequencing), and the chopped-log picture grounds it concretely.                                                                                                                                                                               |
| **chat**                        | ✓       | ch-CVC (short-a)                   | ✓ **with the right brief** — two simple figures + a speech bubble between them                | Moderate — "chat" is familiar as a social action in Filipino-English context                                          | Moderate — must read as "talking", not "two friends" / "two people"                      | Moderate — the speech-bubble is the load-bearing discriminator                                  | **KEEP** (Dave §3a, §3c). The pre-addendum draft rejected `chat` as verb/abstract — **Dave overrides**: `chat` is "the best short-a ch word that is picturable"; the two-figures-plus-speech-bubble composition grounds it.                                                                                                                                                                                                                                  |
| **chest**                       | ✓       | ch-CVCC (short-e; `st` coda blend) | ✓ (treasure chest — hinged-lid trunk)                                                         | ✓ — treasure-chest trunk is storybook-universal; brief forces the treasure sense, not anatomical                      | Moderate-to-high — "chest" (treasure box) appears in storybooks                          | Moderate vs `box` (short-o target) — chest has domed lid + bands; **low risk** with that detail | **KEEP** (Dave §3a, §3c). The **short-e emerging-vowel entry** — Dave §3a/§Recommendations-to-Kyle #4: the planner weights `chest` conservatively in introduction sessions (like `gem`/`web` in the short-e tier) and lets it rise as short-e consolidates. `st` coda is fine — recognition task, no decode.                                                                                                                                                 |
| **chug**                        | ✓       | ch-CVC (short-u)                   | ✓ **with the right brief** — a train or a bottle being gulped, mid-"chug" (motion-line helps) | Moderate — the onomatopoeic sound is familiar even if the English label is less established                           | Low — train / gulping-bottle is distinct                                                 | Low                                                                                             | **KEEP** (Dave §3b, §3c). Dave's recommended **replacement for `much`** (which is unpicturable — see below). Short-u, CVC, word-initial. Picture+audio scaffold handles the moderate label-familiarity.                                                                                                                                                                                                                                                      |
| **chick**                       | ✓       | ch-CVCC (short-i; `ck` coda)       | ✓ (a baby chicken)                                                                            | ✓ — small round fluffy yellow bird; distinct vs `hen` (short-e target) with the size/no-comb contrast                 | High — storybook-universal; Tagalog "sisiw" is everyday vocab (Dave §3b)                 | Moderate vs `hen` — **low risk** with the baby-bird roundness + no-comb contrast                | **KEEP** (Dave §3b, §3c). Dave's recommended **backup if `rich`'s picture fails** — adopted into the core 7 because the locked pool is all-word-initial (no `rich`). The `ck` coda is acoustically inert for chip-tap recognition (spells `/k/` she already decodes); Dave lists `chick` in the §3c core 7 without a `ck` caveat.                                                                                                                            |
| **much**                        | ✓       | ch-final CVCC (short-u)            | ✗ — function word / degree adverb                                                             | ✗ — cannot be depicted as a standalone object; contextual pictures read as "a lot" / "many"                           | Low — function word                                                                      | n/a                                                                                             | **REJECT** (Dave §3b — "the one word I recommend dropping"). Two compounding problems: unpicturable + function-word class makes isolation semantically strange for an 8yo. Dave's replacement is `chug`.                                                                                                                                                                                                                                                     |
| **rich**                        | ✓       | ch-final CVCC (short-i)            | ✗-ish — abstract (wealth); pictures read as "gold" / "money" not "rich"                       | Marginal — concept known, picture-grounding unreliable                                                                | Moderate — vocab known                                                                   | n/a                                                                                             | **NOT in the locked 7** (Dave §3a/§3c: "include ONLY if Kyle's picture brief can ground 'rich' visually ... otherwise replace with `chick`"). The picture brief cannot reliably ground "rich" vs "gold"/"money" — so `chick` takes the slot. `rich` is the §7 Q2 optional-depth candidate.                                                                                                                                                                   |
| **chimp**                       | ✓       | ch-CVCC (short-i; `mp` blend)      | ✓ (a chimpanzee)                                                                              | ✓ — ape silhouette                                                                                                    | Moderate — kid-register clip of "chimpanzee"; mid-frequency word                         | Low — ape silhouette is unique                                                                  | **NOT in the locked 7.** The pre-addendum draft included `chimp`; Dave's §3c pool does not. Dave's §2a word list does cite `chimp`, but his recommended 7 picks `chin/chip/chop/chat/chest/chug/chick` instead — picture-stability + minimal-pair value + vocab-familiarity favor those. `chimp` is a §7 Q2 optional-depth candidate if Thomas wants a pool of 8–9.                                                                                          |
| **chess / check / chap / chum** | ✓       | ch-CVC(C)                          | mostly abstract / register-marginal / picture-unstable                                        | varies                                                                                                                | varies                                                                                   | varies                                                                                          | **NOT in the locked 7.** `chap` and `chum` are Dave's §3b alternative replacements / §Risk-#1 backups (short-a / short-u depth options); `chess` is multi-subject picture-unstable; `check` stacks `ch`+`ck` and is abstract. All available as §7 Q2 optional-depth candidates; none needed for the locked 7.                                                                                                                                                |
| **cheese / chair / chain**      | ✓       | ch + long/r-controlled vowel       | ✓ — all picturable, all high-vocab                                                            | ✓                                                                                                                     | Low vocab risk BUT the vowel pattern is the disqualifier                                 | Low                                                                                             | **REJECT** (Dave §4c — explicit). The pre-addendum draft included these 3 as `hybridMode: true` long-vowel hybrids. **Dave overrides**: "the ch word stock is rich enough in short-vowel options that no long-vowel or r-controlled words are needed ... Resist [cheese/chain]: the vowel patterns are outside formal instruction, and hybridMode scaffolding should be reserved for exceptional cases, not used as a workaround to include familiar words." |

### The pool-shape decision — RESOLVED by Dave's addendum

The sh tier faced a genuine pool-shape decision (Option A short-vowel-only / Option B lower-the-bar / Option C long-vowel allowance) because its short-vowel ch-initial stock was only ~2–4 strong. **The ch tier does NOT face this decision** — Dave's addendum §Risk #1 settles it: the short-vowel ch word stock is rich enough that a 7-word all-short-vowel pool is the natural landing, no allowance needed. **Dave's §3c pool of 7 is adopted directly.** This spec does not re-run the sh-tier three-way audit because the premise that forced it (thin short-vowel stock) does not hold for ch.

### Final v1 ch-initial pool (7 words, Dave's §3c locked inventory)

| #   | Word  | Vowel inside              | Picture status | Ch-position | Category               | hybridMode | Notes (reconciled w/ Dave's addendum)                                                                                                                                                                             |
| --- | ----- | ------------------------- | -------------- | ----------- | ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | chin  | short-i (`/ɪ/`, mastered) | NEW            | initial     | body part              | false      | Friendly cartoon face, side-profile / chin-forward crop. Dave's "ideal anchor" — body parts are the highest-familiarity vocabulary class. Lead word. Picture brief: chin as the salient feature, shown in a face. |
| 2   | chip  | short-i (`/ɪ/`, mastered) | NEW            | initial     | object (food)          | false      | Single potato/tortilla crisp. Universal Filipino-English loanword. **`chip`/`ship` minimal-pair anchor** with the sh tier. Picture brief: disambiguate from poker-chip / microchip.                               |
| 3   | chop  | short-o (`/ɒ/`, mastered) | NEW            | initial     | object (action-result) | false      | Chopped/split log + small axe. **`chop`/`shop` minimal-pair anchor** with the sh tier — the specific payoff of sh-before-ch sequencing. Picture brief: concrete chopped-wood result, not the bare verb.           |
| 4   | chat  | short-a (`/æ/`, mastered) | NEW            | initial     | action (social)        | false      | Two simple figures + a speech bubble between them. "The best short-a ch word that is picturable" (Dave). Picture brief: must read as "talking", the speech-bubble is load-bearing.                                |
| 5   | chest | short-e (`/ɛ/`, emerging) | NEW            | initial     | object                 | false      | Treasure-chest trunk — hinged domed lid + metal bands + lock-plate. The **short-e emerging-vowel entry** — planner weights it conservatively in introduction sessions (like `gem`/`web` in short-e tier).         |
| 6   | chug  | short-u (`/ʌ/`, mastered) | NEW            | initial     | action (onomatopoeia)  | false      | A train or a bottle being gulped, mid-"chug" — a motion-line helps. Dave's replacement for the dropped `much`. Picture+audio scaffold handles the moderate label-familiarity.                                     |
| 7   | chick | short-i (`/ɪ/`, mastered) | NEW            | initial     | animal                 | false      | Small round fluffy yellow baby bird. Storybook-universal; Tagalog "sisiw" is everyday vocab. Picture brief: baby-bird roundness + no comb, to stay distinct from `hen` (short-e target).                          |

**ZERO `hybridMode: true` entries** — see §6.1 for why this is stated explicitly (Dave non-obvious finding #1).

### Pool composition cross-check

- **All 7 are concrete nouns / familiar actions / a body part** — each has a stable chip read (with the picture briefs in §0 / §3 / the companion prompt sheet).
- **All 7 are picture-distinct from existing CVC + sh pack pictures** (`chin` is a face — unique; `chip` vs everything; `chop` log+axe — unique; `chat` two-figures+bubble — unique; `chest` vs `box` — distinct with lid/bands; `chug` train/bottle — unique; `chick` vs `hen` — distinct with size/no-comb contrast).
- **2 of 7 have moderate silhouette-discrimination risk** (`chest` vs `box`, `chick` vs `hen`) — both manageable with the detail contrast in §3 / the prompt sheet.
- **2 of 7 carry a picture-grounding brief that is load-bearing, not optional** (`chop` must read as the chopped-wood _result_ not the verb; `chat` must read as "talking" via the speech-bubble) — these are Dave's keeps that the pre-addendum draft would have rejected; the briefs are what make them work.
- **Vowel spread:** short-i (3: chin, chip, chick), short-o (1: chop), short-a (1: chat), short-e (1: chest), short-u (1: chug) — 5 vowel positions, all within Marian's formal instruction. Short-i is over-represented (3 of 7) — a real composition note for the planner: **avoid all-short-i trios.**
- **Category spread:** body part (1), object (3 — chip, chop, chest), action (2 — chat, chug), animal (1 — chick).
- **`hybridMode: true` split:** 0 of 7. Structurally unlike sh's 3-of-7 split — Dave §3d / non-obvious finding #1.

### Phonetic spread within the pool (digraph isolation check)

The whole point of this tier is for Marian to internalize **`ch = /tʃ/`** as a single decoded unit — _and_ to NOT misread it as `/k/` (the c-says-/k/ orthographic trap, Dave §1c). Every word in the pool starts with `ch` followed by a vowel — the ch-decoding lesson is identical across all 7.

- **ch-initial position:** ✓ ALL 7. (Dave §2b / §3c: word-initial first; the cleaner decoding arc.)
- **ch-final position:** ✗ NONE. Dave audited `rich`/`much`; `much` dropped (unpicturable), `rich` not in the locked 7 (picture-grounding unreliable). A ch-final follow-up arc is deferred.
- **ch + consonant blend at onset:** ✗ NONE (no `chr-` words; blends violate digraph-isolation, Dave §Q3).
- **Single-syllable:** ✓ ALL 7.
- **NO `-tch` trigraph words** — Dave §4b / §Recommendations-to-Matt #5: `catch, fetch, witch, watch` use the `-tch` alternative spelling of `/tʃ/`, which is a _separate_ phonics lesson. The ch pool is entirely `-tch`-free.
- **c-says-/k/ trap mitigation:** Emma's first-encounter script (§4) explicitly contrasts "ch says /tʃ/, NOT /k/ like in 'cat'" — the one digraph-specific scaffold line ch needs that sh did not (Dave §1c, non-obvious finding #2).

### Vocabulary-familiarity audit (the binding constraint per Dave §Q4)

For each of the 7, the picture-grounding-without-explanation check:

| Word  | Marian's L1 (Tagalog) referent                               | Picture-grounds-without-explanation?                                                        | Audio-anchor risk                                                                 |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| chin  | baba (high-frequency — body parts are universally known)     | ✓ — chin shown in a friendly cartoon face is unambiguous; Dave's "ideal anchor"             | Low — body part, universal                                                        |
| chip  | tsip / chips (English loanword, universal in PH snack vocab) | ✓ — single crisp reads clearly IF disambiguated from poker-chip/microchip                   | Low — clear picture; loanword vocab is strong                                     |
| chop  | (no clean single-word referent — "tadtad" / "putol" loose)   | ✓ **with the brief** — chopped log + axe is concrete and common                             | Moderate — picture grounds the meaning; the English WORD "chop" leans verb        |
| chat  | kuwentuhan / chat (loanword in social-media context)         | ✓ **with the brief** — two figures + speech bubble reads as "talking"                       | Moderate — picture grounds it; the WORD "chat" is a social action, not an object  |
| chest | baul (treasure chest) / dibdib (body part)                   | ✓ — treasure-chest trunk is storybook-universal; the picture forecloses the body-part sense | Low — the trunk picture forecloses the competing sense                            |
| chug  | (no clean L1 referent — onomatopoeia)                        | ✓ **with the brief** — train / gulping-bottle mid-motion grounds it                         | Moderate — picture + audio scaffold carries the moderate label-familiarity (Dave) |
| chick | sisiw (high-frequency word in PH — chicks are everyday)      | ✓ — fluffy baby bird is universal; `sisiw` is everyday Filipino vocab                       | Low — strong picture + strong L1 referent                                         |

**4 of 7 are vocabulary-familiar without scaffolding** (chin, chip, chest, chick). 3 of 7 (`chop`, `chat`, `chug`) rely on the picture brief + audio anchor to ground the meaning — these are the keeps Dave's specific briefs (§0, §3) make work. This is a _milder_ risk profile than sh's (sh had `shed`/`shop` register-MISMATCH; ch's weak trio is picture-brief-dependent-but-not-mismatched).

### Tagalog phonology check per word — `/tʃ/` → `/ts/` ~ `/s/` risk + the c-says-/k/ trap

The `/tʃ/` substitution risk is structural across ALL ch-words for Marian — but **less acute than sh's** (Dave Bottom-line, §1a, §Risk #2): `/tʃ/` has marginal-phoneme status in Tagalog's loanword layer (`tsaa`, `church`, `cheese`, `chips`), so Marian has perceptual scaffolding. The basilect substitution is `/tʃ/`→`/ts/` (a _partial_ affricate, not a blank-slate `/s/`) and it is **production-only** — irrelevant to chip-tap recognition (Dave §Risk #2: "perception is not the problem for /tʃ/").

Per-word substitution prediction + the SECOND ch-specific risk (the c-says-/k/ orthographic trap):

| Word  | Predicted L1 /tʃ/-substitution (production-only) | c-says-/k/ misread risk                         | Visual discriminator from substitution         |
| ----- | ------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------- |
| chin  | "tsin" / "sin" (REAL WORD under /s/)             | "kin" (REAL WORD)                               | ch- vs. s-/k- (visual)                         |
| chip  | "tsip" / "sip" (REAL WORD)                       | "kip" (non-word)                                | ch- vs. s-/k-                                  |
| chop  | "tsop" / "sop" (obscure real word)               | "kop" (non-word; "cop" is the homophone hazard) | ch- vs. s-/k-                                  |
| chat  | "tsat" / "sat" (REAL WORD)                       | "kat" (non-word; "cat" is the homophone hazard) | ch- vs. s-/k-                                  |
| chest | "tsest" / "sest" (non-word)                      | "kest" (non-word)                               | ch- vs. s-/k-                                  |
| chug  | "tsug" / "sug" (non-word)                        | "kug" (non-word)                                | ch- vs. s-/k-                                  |
| chick | "tsick" / "sick" (REAL WORD)                     | "kick" (REAL WORD)                              | ch- vs. s-/k- — **double real-word collision** |

**Three ch-words produce a real English word under `/tʃ/`→`/s/` substitution** (`chin→sin`, `chip→sip`, `chat→sat`, `chick→sick` — four, actually). The distractor architecture (§2) handles the `/tʃ/`-vs-`/s/` contrast as a trap class (same machinery as sh's sh-vs-s). **The c-says-/k/ trap is handled by Emma's script** (§4 — "ch says /tʃ/, not /k/"), NOT by a `/k/`-onset distractor — Dave §1c is explicit that distractors must NOT include c-initial `/k/`-words alongside ch-targets, because that creates a within-session "sometimes c says /k/, sometimes /tʃ/" signal that exceeds the tier's scope. **Open question Q2 (§7) confirms: no ch-vs-k contrast distractor in v1.**

Emma's audio (Azure neural voice) produces `/tʃ/` correctly; the chip-tap recognition test is whether Marian matches the heard `/tʃ/` audio to the chip starting with `ch`, NOT to a chip starting with `s`.

---

## 1.3 The long-vowel allowance — NOT INVOKED for ch (Dave §4c)

The sh tier's §1.3 was its load-bearing design call — sh needed the long-vowel allowance (Option C-minus: `shoe, sheep, shark` as `hybridMode: true` hybrids) because its short-vowel ch-initial stock was genuinely too thin.

**The ch tier does not invoke the allowance.** Dave's `digraph-ch-addendum.md` §4c is explicit:

> Unlike the sh tier, the ch word stock is rich enough in short-vowel options that no long-vowel or r-controlled words are needed to reach 7-word pool depth. ... `cheese` and `chain` are the most tempting inclusions because vocabulary familiarity is high ... Resist: the vowel patterns are outside formal instruction, and hybridMode scaffolding should be reserved for exceptional cases (as it was with sh tier), not used as a workaround to include familiar words. A pool of 7 strong short-vowel ch words is sufficient.

This section exists only to record that the question was asked and Dave settled it. The pre-addendum draft of this spec proposed `cheese, chair, chain` as long-vowel hybrids; that proposal is **superseded** — see §0. There is no Option-A/B/C audit for ch because the premise that forced it for sh (thin short-vowel stock) does not hold.

---

## 2. Distractor word list — ch-tier needs cross-orthography ch/s contrast distractors

This is structurally the same change the sh tier introduced (`digraphs-sh-word-list.md` §2) — the ch-tier reuses that machinery. Per Dave's recommendations to Kyle #4 (parent research note) + ch-addendum §1c:

> For digraph words, the most diagnostically useful distractors differ by the initial grapheme: "ship" vs. "sip" (sh vs. s confusion), **"chin" vs. "sin" or "kin" (ch vs. s/k confusion)** ...

For the ch-tier, the diagnostically useful distractor for a ch-word is the **s-contrast** word (the `/tʃ/`→`/s/` substitution). Dave's ch-addendum §1c is explicit that the **k-contrast must NOT be used as a distractor** in v1 — a `/k/`-onset distractor (`kin` for `chin`) introduces the "sometimes c says /k/" within-session signal that exceeds the introduction tier's scope. **This draft uses the s-contrast as the trap distractor class and handles the c-says-/k/ trap via Emma's script (§4) alone.** Open question Q2 (§7) is RESOLVED by Dave's §1c: no ch-vs-k distractor in v1.

### Two distractor classes for ch-tier

**Class 1 — ch/s contrast traps (the digraph-tier pattern, established by sh):**

| ch-target | s-contrast trap | Both real English words?                              | Notes                                                                                       |
| --------- | --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| chin      | sin             | YES — both real, but "sin" is abstract/adult-register | Borderline — real minimal pair but "sin" is not 8yo-appropriate vocab; avoid                |
| chip      | sip             | YES — both real                                       | Direct minimal pair. `sip` already a `TARGET_WORDS` entry (short-i) — dual-role, see below. |
| chop      | sop             | YES — but "sop" is obscure/archaic                    | Borderline — non-standard for an 8yo                                                        |
| chat      | sat             | YES — both real                                       | Direct minimal pair — "sat" is a known word (past tense of sit); usable                     |
| chest     | sest            | NO — non-word                                         | Visual ch/s contrast still works; non-real pair                                             |
| chug      | sug             | NO — non-word                                         | Non-word                                                                                    |
| chick     | sick            | YES — both real                                       | Direct minimal pair — strong trap                                                           |

**The strong-trap subset is `chip/sip`, `chat/sat`, and `chick/sick`** — 3 of 7 — where the ch-vs-s discrimination test has real teeth (both real, 8yo-appropriate, direct minimal pairs). This matches the sh tier's strong-trap count (sh had 3 of 7: `ship/sip, shell/sell, shop/sop`). For the weak-trap subset (`chin, chop, chest, chug`), use a same-pool ch-neighbor as the trap instead — keeping the ch-decoding success-pattern intact while still giving Marian a phonics-meaningful choice. (`chin/sin` and `chop/sop` are _technically_ minimal pairs but the s-contrast word is adult-register / obscure — not shippable as 8yo chips; they fall into the weak-trap subset.)

**Class 2 — same-pool ch-neighbor (gentle distractor, mirrors short-vowel + sh-tier pattern):**

For every ch-target, pair it with another ch-target as the gentle distractor — same-sound-class, different referent. e.g. `chip` (target) with `chest` (gentle distractor) — Marian distinguishes by picture, not by ch-vs-s. This builds confidence + reinforces the ch-pool as a cohesive set.

### Recommended distractor matrix (concrete example for Kevin's impl ticket)

Full `TARGET_PAIRINGS` rows are Kevin's to author; design preview here so the structure is clear (mirrors `digraphs-sh-word-list.md` §2).

**Shape contract.** Every row's `gentle` and `trap` are `readonly [string, string]` tuples — exactly 2 entries each. Matches the existing `WordPairing` type in [`wordPack.ts`](../../src/screens/WordSong/wordPack.ts). Single-entry tuples are a type error.

**FORBIDDEN_PAIRS pre-check.** Every distractor below is cross-checked against §6's FORBIDDEN_PAIRS additions: `[chest, chip]`, `[chick, chin]`. No row pairs a target with a forbidden silhouette neighbor.

```ts
// Strong-trap subset — Class 1 (ch/s contrast) + Class 2 (ch-pool neighbor):
chip:  { gentle: ['chair' /* INVALID — not in pool; use a ch-pool word */, 'chug'], trap: ['sip', 'chick'] },
//  ^ corrected below — see note. Illustrative rows reconciled to the locked 7-word pool:
chip:  { gentle: ['chop',  'chug'],  trap: ['sip',  'chick'] }, // gentle: 2 ch-neighbors (NOT chest — FORBIDDEN_PAIR); trap: ch/s contrast + ch-neighbor
chat:  { gentle: ['chop',  'chug'],  trap: ['sat',  'chest'] }, // gentle: 2 ch-neighbors; trap: ch/s contrast + ch-neighbor
chick: { gentle: ['chop',  'chug'],  trap: ['sick', 'chest'] }, // gentle: 2 ch-neighbors (NOT chin — FORBIDDEN_PAIR); trap: ch/s contrast + ch-neighbor

// Weak-trap subset — Class 2 (ch-pool neighbor only; weak s-contrast trap omitted):
chin:  { gentle: ['chop',  'chug'],  trap: ['chest', 'chat'] }, // gentle + trap both ch-pool (NOT chick — FORBIDDEN_PAIR); sin adult-register
chop:  { gentle: ['chug',  'chest'], trap: ['chin',  'chat'] }, // gentle + trap both ch-pool; sop obscure
chest: { gentle: ['chop',  'chug'],  trap: ['chat',  'chick'] },// gentle + trap both ch-pool (NOT chip — FORBIDDEN_PAIR); sest non-word
chug:  { gentle: ['chop',  'chest'], trap: ['chin',  'chat'] }, // gentle + trap both ch-pool; sug non-word
```

> **Authoring note:** the first `chip:` line above is intentionally shown struck-through-then-corrected to flag a trap the impl ticket must avoid — every distractor string MUST be a member of the locked 7-word ch pool or a shipped distractor-only entry. `chair` is NOT in the ch pool (it was a pre-addendum-draft pick, dropped per §0). Kevin's `TARGET_PAIRINGS` rows must validate every distractor string against the locked pool + the distractor-only entries (`sip`, `sat`, `sick`).

**Distractor-class summary per row:**

| Target | Gentle tier (problems 1-3) | Trap tier (problems 4-8) | Trap class         |
| ------ | -------------------------- | ------------------------ | ------------------ |
| chip   | chop, chug                 | sip, chick               | ch/s + ch-neighbor |
| chat   | chop, chug                 | sat, chest               | ch/s + ch-neighbor |
| chick  | chop, chug                 | sick, chest              | ch/s + ch-neighbor |
| chin   | chop, chug                 | chest, chat              | ch-neighbor only   |
| chop   | chug, chest                | chin, chat               | ch-neighbor only   |
| chest  | chop, chug                 | chat, chick              | ch-neighbor only   |
| chug   | chop, chest                | chin, chat               | ch-neighbor only   |

**`sip` as cross-tier-load-bearing dual-role distractor** (the sh tier already established this exact pattern — `digraphs-sh-word-list.md` §2):

`sip` is already a `TARGET_WORDS` entry with `vowel: 'i'`, `isTarget: true` (shipped in the short-i tier, re-used by sh-tier's `ship` row). Using `sip` as `chip`'s trap distractor means `sip` is now referenced from **THREE tiers** — short-i (own tier), sh (`ship`'s trap), ch (`chip`'s trap).

1. **Retain `sip`'s existing entry** in `TARGET_WORDS` with `vowel: 'i'`, `isTarget: true`. No change.
2. **Reference `sip` by string** from the ch-tier `TARGET_PAIRINGS` row for `chip`. `getWordEntry('sip')` resolves to the existing entry.
3. **Operational rule applies** (`.claude/docs/skill-trees-and-content.md` §"Cross-vowel-tier load-bearing — generalization"): before any future removal of `sip` from `TARGET_WORDS`, the impl ticket must grep for `sip` as a string token in `TARGET_PAIRINGS` and either retain the entry or substitute every reference.

**`sat` and `sick` are NEW distractor-only entries.** Neither is in `TARGET_WORDS` today. Each needs a new `WordEntry` row (`isTarget: false`, `vowel: 'a'` for `sat` / `vowel: 'i'` for `sick`, a picture asset — silhouette placeholder acceptable per the distractor-only-entry pattern). They are the ch-tier's two new s-contrast traps (`chat/sat`, `chick/sick`).

**Note on the matrix preview:** illustrative; Kevin owns the final `TARGET_PAIRINGS` rows in the impl ticket per `screens-and-flows.md` convention. The load-bearing constraints:

- Tuple shape `[string, string]` (2 entries each).
- No FORBIDDEN_PAIR adjacency.
- `gentle` always ch-pool; `trap` is ch/s contrast where a strong-trap is available (`chip`, `chat`, `chick`), else another ch-pool neighbor.
- `sip` documented as dual-role (NOT a new entry); `sat` and `sick` are the two new distractor-only entries.
- **Every distractor string is a member of the locked 7-word ch pool OR a shipped distractor-only entry** — no pre-addendum-draft words (`chair`, `chimp`, `cheese`, `chain`) anywhere.

### Cross-tier hygiene — NO short-vowel CVC distractors, AND no sh-tier distractors, in ch-trios

Per Dave §Q5 + ch-addendum §Risk #4 / §Recommendations-to-Matt #3: "Do not interleave digraphs with CVC content until the digraph is consolidated." AND: cross-pool distractors (`ship` as a distractor for `chip`) belong to the **interleaving phase** (when both sh and ch are at ~70%+), NOT the ch-introduction tier. **ch-tier trios contain ONLY ch-words + ch/s-contrast traps. No `cat`, `dog`, `pen` etc. — AND no `ship`, `shop`, etc. either.**

This is the explicit answer to Dave §Risk #4's question ("if a ch-tier session selects `chip` as the target, should `ship` appear as a distractor?"): **for early ch introduction, no.** `ship`-as-distractor-for-`chip` tests sh/ch discrimination, which is the _interleaving_ phase's job. The ch-introduction tier's task is "recognize ch words", not "discriminate sh from ch".

Realised in code through (a) `pickDistractors(target, problemIndex, options)` in [`wordDistractors.ts`](../../src/screens/WordSong/wordDistractors.ts) — matrix-curated, runtime-dumb — and (b) render-time chip ordering via `buildChipOrder()` in [`WordSong.tsx`](../../src/screens/WordSong/WordSong.tsx). No new `composeTrio` function.

### FORBIDDEN_PAIRS additions

| New pair        | Reason                                                                                                                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[chest, chip]` | At 96pt a small flat `chip` could read against a small `chest` with insufficient mass contrast IF the chest is drawn small. In-pool hygiene — pair `chip` and `chest` against the other 5 ch-words, never each other.                                                                                    |
| `[chick, chin]` | `chick` (small round bird) and `chin` (face-with-prominent-chin) are both small rounded-form silhouettes at 96pt — the discriminator is real but in-pool hygiene keeps them out of the same trio so the load doesn't stack.                                                                              |
| `[chest, box]`  | Cross-pool silhouette hygiene — `chest` (treasure trunk) vs. `box` (short-o target, plain cuboid). The hinged-lid/bands detail distinguishes them; the cross-pool rule documents the risk for future interleaving work. Hygiene-only in v1 (ch-tier rule already prevents `box` appearing in a ch-trio). |

---

## 3. Picture-pack requirements (summary — full prompts in companion sheet)

See `digraphs-ch-picture-pack-prompts.md` for the per-word MJ prompts.

Summary requirements:

- **7 wholly-new pictures** (no re-traces — none of the 7 ch-words have existing distractor SVGs from prior tiers).
- Pictures embedded via `yarn embed-pictures` per the established Phase-3 pipeline.
- Filenames: `picture-chin.svg`, `picture-chip.svg`, `picture-chop.svg`, `picture-chat.svg`, `picture-chest.svg`, `picture-chug.svg`, `picture-chick.svg` at `public/assets/pictures/`.
- Style anchor: `picture-pack-style-anchor.md` §2 + §3 (locked, byte-for-byte preamble) + the short-form 14-word preamble convention established in `digraphs-sh-picture-pack-prompts.md` §1.4.
- **Load-bearing picture briefs** (Dave §Recommendations-to-Kyle #4 — these are NOT optional polish):
  - `chin` — friendly cartoon face, side-profile or chin-forward crop; the chin must be the salient feature, not just a face portrait.
  - `chat` — two simple figures with a speech bubble between them; must clearly read as "talking/chatting", not "people" or "friends".
  - `chest` — treasure chest (hinged-lid trunk), NOT anatomical chest; storybook-universal single object.
  - `chop` — a chopped/split log with a small axe; the concrete-result depiction, not the bare verb.
  - `chug` — a train or a bottle being gulped, mid-motion; a simple motion-line helps it read as the action.
- **2 additional distractor-only pictures needed** for the s-contrast traps `sat` and `sick` — silhouette placeholders acceptable per Devon's picture-pack §6 finding #4 path; vector trace deferred to polish backlog. `picture-sip.svg` already exists (short-i tier, reused).

---

## 4. Emma's ch-introduction lines (design-side TTS script — not the spec for Kevin)

This is informational; the Word Song spec for Kevin's planner will lift the exact script lines. Reconciled against Dave's ch-addendum §1c + §Recommendations-to-Kyle #1/#2/#3, which gives the ch script text directly.

**First ch-encounter (lifetime-once scaffolding, mirrors sh's two-letters-one-sound opener / short-u's `sun/soon` AC9b mechanism) — Dave §Recommendations-to-Kyle #1:**

> "Look — c and h together! They make a brand-new sound — ch! Not /k/ like in 'cat' — ch! Listen: chin!"

The clause **"Not /k/ like in 'cat'"** is the one digraph-specific scaffold ch needs that sh did not (Dave §1c, non-obvious finding #2: Marian already knows `c` says `/k/`; `ch` saying something else requires explicit naming). It is **load-bearing, not decorative** — Dave §Recommendations-to-Kyle #1: "This is the most important design difference between the ch introduction and the sh introduction."

**The sh-vs-ch "can you hold the sound?" comparison (Dave §Recommendations-to-Kyle #2)** — when ch arrives after sh, Emma can reference the sh/ch distinction with a child-accessible, self-testing physical cue:

> "Remember 'shhh'? You can hold that sound. But ch — try it! It stops! Ch, ch!"

This leverages the acoustic distinction (sh is a continuant you can sustain; ch is a stop-released affricate you cannot) — an 8-year-old can do this duration self-test without any articulation knowledge.

**`chop` / `chip` minimal-pair anchoring (Dave §Recommendations-to-Kyle #3)** — for these two words, Emma's per-item script can reference the contrast with the sh-tier words Marian already knows:

> "ch-op. Did you hear the ch? That's different from 'shop' — ch-op, sh-op."
> "ch-ip. That's different from 'ship' — ch-ip, sh-ip."

The distinction is _named_ without requiring metalinguistic production from Marian.

**Concept reminder (per session-open Emma greeting in ch-tier sessions, before any item):**

> "Today we're practicing the ch sound! When 'c' and 'h' stand together, they say ch — like 'chin'. Not /k/."

**Per-item Emma lines (each ch-word, default):**

> "[word]! Listen: [word]. Can you find [word]?"

**No `hybridMode` long-vowel-hybrid script variant is needed** — the ch pool has zero `hybridMode` entries (§6.1). Every ch-word gets the standard decodable per-item line (or, for `chop`/`chip`, the minimal-pair-anchored variant above).

---

## 5. The 2-session-gap rule, and the new scaffold gate ch needs

sh and ch ARE in a known minimal-pair confusion class — but Dave §Q5 + ch-addendum §Risk #4 are explicit that sh-vs-ch _interleaving_ is a deliberate later feature (triggered once both digraphs reach ~70%), NOT a confusion to avoid during introduction. The ch-introduction tier is isolated-ch (no sh words in ch-trios — §2 cross-tier hygiene). So there is no "2-session-gap" concern between sh and ch the way short-vowel minimal-pair tiers had.

ch's own scaffold gate is the **c-says-/k/ orthographic trap**:

- Marian already internalized "two letters, one sound" on the sh tier — that concept does NOT need re-teaching (Dave ch-addendum §5: ch second specifically so the concept is _reviewed_, not re-taught).
- What IS new for ch: the grapheme `ch` _looks like_ it should say `/k/` (a child who knows "c says /k/" has a competing hypothesis from prior CVC instruction). Dave §1c names this as ch's distinctive pedagogical burden.

**Recommended scaffold gate:** before the first ch-introduction session, Emma's session-open includes the concept reminder (§4) explicitly naming "ch says ch, not /k/". This is NOT a separate lifetime-once item beyond the first-encounter opener — it's a per-session reminder at the start of each ch-introduction session while `digraphs-ch.state === 'practicing'` (surfaced through the `practicing` state; suppressed once the node flips to `'mastered'`). State mapping mirrors the sh tier's AC6.

**Implementation note:** parallels the sh tier's digraph-cue mechanism — a small persistent visual cue showing "ch" + a keyword picture (e.g., `ch - chin`) during ch-tier sessions. Reduces working-memory load. Spec-side note for Kevin's planner.

---

## 6. Cross-pool hygiene + planner constraints

### Planner constraints

1. **ch-tier sessions contain only ch-words + ch/s-contrast traps.** No CVC words from prior tiers, and NO sh-tier words, in ch-trios in v1. Mirrors the same-vowel-only rule + the sh tier's isolated-tier rule. Cross-pool `ship`/`shop`-as-distractor is the _interleaving_ phase's job (Dave §Risk #4).
2. **Maximum 2–3 new ch-items per 8-item session** (per `phonics-sequence §Q5`, Dave §Q4, ch-addendum §5). The remaining 5–6 items are review — handled via the planner's existing cross-tier-review mechanism, NOT via in-trio cross-tier inclusion. (Note `.claude/docs/skill-trees-and-content.md` §"Cross-tier review": as of 2026-05-14 cross-tier review is design intent, not shipped planner behaviour — every word-song tier emits 8 problems from its own pool. ch follows the shipped behaviour; this constraint is the design target.)
3. **First ch-session is lifetime-once-scaffolded** — Emma's two-letters-one-sound + "ch says ch, not /k/" intro fires the first time ch-tier is encountered. Mirrors the sh tier's AC5 / short-u's `sun/soon` AC9b.
4. **Per-session ch-digraph-cue persists during ch-tier sessions while `digraphs-ch.state === 'practicing'`** (per `applyMasteryRule()` in `src/lib/progress/mastery.ts`; `intro` + `practicing` both show the cue, `mastered` hides it). Small visual cue in screen corner showing "ch - [keyword picture, e.g. chin]". Mirrors the sh tier's AC6.
5. **`chest` is weighted conservatively in introduction sessions** (Dave §3d / §Recommendations-to-Matt #4). Short-e is Marian's emerging vowel; `chest` is the short-e entry in the pool. The planner treats `chest` like a secondary target (as `gem` was in the short-e tier) in early introduction sessions and lets it rise as short-e consolidates. This is a planner-weighting note, NOT a `hybridMode` flag — `chest` is fully decodable.
6. **`chop` and `chip` are minimal-pair anchors with the sh tier** (Dave non-obvious finding #3). The planner / canon-bake should annotate `chip` and `chop` with a "minimal pair: ship/shop (sh-tier)" note so future interleaving-phase planner work can leverage these pairs intentionally. In the ch-introduction tier this is a documentation annotation only — the pairs are NOT yet used as cross-pool distractors (§2).

### Cross-tier hygiene

1. **FORBIDDEN_PAIR additions:** `[chest, chip]` (in-pool), `[chick, chin]` (in-pool), `[chest, box]` (cross-pool silhouette).
2. **No ch/s contrast in CVC or sh trios:** the `sat` and `sick` distractor words appear ONLY in ch-trios, never in short-a / short-i / sh / other trios. This prevents confusion where Marian sees `sat`/`sick` in a non-ch trio and learns it as a target, then meets it as a distractor in ch-tier. (`sip` is the dual-role exception — already a short-i target and an sh-tier distractor; its role is established and additive.)
3. **NO c-initial `/k/`-words as distractors for ch-targets** (Dave §1c, §4a). A distractor like `cat` or `cup` alongside a ch-target creates the within-session "sometimes c says /k/, sometimes /tʃ/" orthographic signal that exceeds the introduction tier's scope. The ch-tier distractor pool is ch-words + s-contrast traps only.

### Distractor architecture refactor (already done by the sh tier — ch reuses it)

The cross-orthography distractor pattern (`wordPack.ts` distractor-only entries + dual-role string references + the matrix-lookup `pickDistractors` being runtime-dumb) was **built and shipped for the sh tier** (PR #220). The ch-tier does NOT need an architecture refactor — it adds rows to the existing structures:

- **`wordPack.ts TARGET_WORDS` additions:** 7 new ch-target entries + 2 new distractor-only entries (`sat` `vowel: 'a'`, `sick` `vowel: 'i'`, both `isTarget: false`). `sip` is dual-role (NOT a new entry — already exists). ~9 new `WordEntry` rows.
- **`pickDistractors` runtime is unchanged.** Matrix-lookup-only — adding ch-tier `TARGET_PAIRINGS` rows is sufficient.
- **`buildChipOrder` runtime is unchanged.** Render-time positioning is target-agnostic.
- **`FORBIDDEN_PAIRS` extension** for in-pool ch-hygiene rules (table above).
- **`WordEntry.vowel` field** — every ch-tier entry sets `vowel` (all 7 use short vowels Marian has covered). **No `phoneme` field, no `hybridMode: true` entries** — unlike the sh tier, which set `phoneme` + `hybridMode` on its 3 long-vowel hybrids. The ch-tier is the _simpler_ case the sh-tier schema already supports.
- **Picture assets for the 2 distractor-only entries.** `sat`, `sick` each need a picture (silhouette placeholder acceptable). `sip` reuses its existing short-i picture asset.

**This is downstream for Kevin's + Devon's impl tickets.** Flagging here so the spec downstream is clear it's _less_ work than sh's was — sh built the machinery AND had the `hybridMode` complication; ch consumes the machinery and has zero `hybridMode` words.

### 6.1 `hybridMode` annotation — ZERO ch-tier entries (Dave §3d, non-obvious finding #1)

The `hybridMode: boolean` field on `WordEntry` is **already in the schema** as of the sh tier (PR #220 — `digraphs-sh-word-list.md` §6.1; sh set it `true` for `shoe/sheep/shark`). **The ch-tier sets it `true` on ZERO entries.**

This is a deliberate structural outcome, and Dave's addendum (§3d, non-obvious finding #1) is explicit that it **must be stated in this spec**:

> The ch tier has zero hybridMode words — this is structurally unlike the sh tier and should be stated explicitly in Kyle's spec. The sh tier's 3 hybrids were a necessary exception driven by vocabulary familiarity (shoe, sheep, shark) outweighing pool-restriction concerns. The ch tier has no such trade-off: the short-vowel ch word stock is rich enough ... that long-vowel inclusions are never necessary. Stating this explicitly prevents future misapplication of the hybridMode pattern to ch.

**Why every ch-tier word is fully decodable:** all 7 (`chin, chip, chop, chat, chest, chug, chick`) use short vowels Marian has formally covered (short-i, -o, -a, -e, -u). None require whole-word picture-carry of an unlearned vowel pattern — the situation that forced `hybridMode` on sh's `shoe` (`oe`), `sheep` (`ee`), `shark` (`ar`). `chest`'s short-e is "emerging" not "unlearned" — Dave §3d: "Emerging is not the same as unlearned ... No hybridMode flag needed; just a planner-weighting note" (carried as planner constraint #5 in §6).

**Impl-ticket consequence (Dave §Recommendations-to-Matt #2):** "Kevin's canon-bake ticket for ch does not need to implement hybrid-mode planner guards for any of the 7 recommended words. This simplifies the impl ticket meaningfully compared to sh." The `hybridMode` field + planner gating rule already exist (shipped with the sh tier) — the ch-tier simply never sets the flag, so the rule is inert for ch-tier content. Kevin's impl ticket does NOT inherit the sh-tier's hybrid-mode planner logic.

---

## 7. Open questions for Thomas

The sh-tier spec resolved its 6 open questions before shipping. The ch-tier inherits most of those resolutions (sequencing, mastery rule, SkillNode shape — all already locked) AND Dave's `digraph-ch-addendum.md` resolved the two questions that would otherwise have been live for ch. **There are no genuinely-open questions gating this spec.** The section is retained for spec history and so future digraph specs can pattern-match the resolutions.

### Q1 — Long-vowel allowance for ch — RESOLVED by Dave's addendum: NOT invoked

**Resolution:** the ch-tier ships an **all-short-vowel pool of 7 with ZERO `hybridMode` entries.** Dave's `digraph-ch-addendum.md` §4c is explicit that the ch short-vowel word stock is rich enough that no long-vowel/r-controlled allowance is needed — and §3d / non-obvious finding #1 directs this to be stated explicitly. An earlier in-flight draft of this spec proposed `cheese, chair, chain` as long-vowel hybrids; that proposal is superseded (§0, §1.3). **Nothing for Thomas to lock — Dave settled it.**

### Q2 — ch-vs-k contrast distractor — RESOLVED by Dave's addendum: NOT in v1

**Resolution:** **no ch-vs-k contrast distractor in v1.** ch has two L2 confusion axes — `/tʃ/`→`/s/` (handled as a trap distractor class, §2, mirrors sh) and the c-says-/k/ orthographic trap. Dave §1c is explicit that the k-contrast must NOT be a distractor: a `/k/`-onset distractor (`kin` for `chin`) creates a within-session "sometimes c says /k/, sometimes /tʃ/" signal that exceeds the introduction tier's scope. The c-says-/k/ trap is handled by **Emma's first-encounter script** ("ch says ch, not /k/ like in 'cat'", §4 — load-bearing per Dave §Recommendations-to-Kyle #1). **Nothing for Thomas to lock — Dave settled it.**

### Q3 — pool depth (optional 8th/9th word) — DEFERRED to Thomas's discretion, not gating

**The only genuinely-open call, and it is non-gating.** Dave §3c / §Risk #1 ships the core 7 and notes optional depth additions if Thomas wants a pool of 8–9: `rich` (short-i, word-final — only if its picture grounds, which Dave judges unlikely), `chap` (short-a alternative to `chat`), `chum` or `chuck` (short-u alternatives to `chug`), `chimp` (short-i). **Recommendation:** ship the core 7 as-is. Dave §Risk #1 confirms 7 is adequate depth for 3–5 introduction sessions. The pool can be extended later via the established pool-extension sync points (`.claude/docs/skill-trees-and-content.md` §"Pool-extension sync points") if real-iPad observation shows 7 is too thin — but there is no evidence-based reason to ship more than 7. **Thomas may lock "ship 7" or request a specific 8th word; either way the impl is not blocked.**

### Inherited resolutions (locked on the sh tier / by PR #211 — listed for pattern-matching, not live)

- **ch-tier `SkillNode` shape** — RESOLVED in PR #211: 3 sibling nodes (`digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless`). The `digraphs-ch` node already exists.
- **ch-tier mastery rule** — RESOLVED: same 90/3 as CVC + sh tiers. After 90% accuracy across 3 consecutive sessions, `digraphs-ch` graduates; `digraphs-th-voiceless` unlocks.
- **Digraph introduction order** — RESOLVED: sh → ch → th-voiceless (Dave §Q2). ch is second.
- **When the `digraphs-ch` node opens** — Dave ch-addendum §5 gives a planner-side refinement: the node can open when sh has had its 3–5 introduction sessions and Marian's sh accuracy is _trending upward_ (~50%+ opening threshold) — it does NOT need to wait for sh at 90%. ch-introduction-in-isolation and sh-review-consolidating can run in parallel within a session. This is a planner session-composition decision, not a word-list decision — flagged for Kevin's impl ticket.
- **sh/ch interleaving trigger** — DOWNSTREAM (not a live question for THIS spec): triggers only after ch ships AND both digraphs reach ~70% accuracy (Dave §Q5, ch-addendum §Risk #4). A planner-side composition decision for a future interleaving spec. Cross-pool distractors (`ship` for `chip`) belong to that phase.

---

## 8. Acceptance criteria

For this spec's downstream impl tickets (Kevin's planner + Devon's wordPack + canon-bake). The pool, distractor posture, and `hybridMode` call are RECONCILED against Dave's `digraph-ch-addendum.md` (§0) — no further reconciliation gate is needed (the pre-addendum draft's AC13 reconciliation-gate is now satisfied and removed).

- [ ] **AC1 — pool size:** `wordPack` for the `digraphs-ch` sibling node (PR #211) contains exactly Dave's §3c locked 7 ch-initial words: `chin, chip, chop, chat, chest, chug, chick`. (An earlier in-flight draft proposed a different pool — superseded per §0.)
- [ ] **AC2 — distractor-only pool:** ch-tier-specific s-contrast distractor entries exist as text+audio chips: `sat` (`vowel: 'a'`, `isTarget: false`) and `sick` (`vowel: 'i'`, `isTarget: false`) as NEW distractor-only entries; `sip` is dual-role (reuses the existing short-i `TARGET_WORDS` entry, see §2 sip-dual-role subsection). Weak-trap s-contrast words (`sin, sop, sest, sug`) are NOT shipped — `sin`/`sop` adult-register/obscure, `sest`/`sug` non-words (§2).
- [ ] **AC3 — Trio composition for ch-tier (`pickDistractors` + `buildChipOrder`):** for every ch-target row in `TARGET_PAIRINGS`, both gentle entries are ch-pool neighbors; trap entries are either (a) an s-contrast distractor-only word + a ch-pool neighbor (strong-trap subset: `chip`, `chat`, `chick`) or (b) two ch-pool neighbors (weak-trap subset: `chin`, `chop`, `chest`, `chug`) per the §2 matrix. **No CVC short-vowel words, NO sh-tier words, and NO c-initial `/k/`-words appear as distractors in ch-trios.** Every distractor string is a member of the locked 7-word ch pool or a shipped distractor-only entry (`sip`, `sat`, `sick`). Tuple shape is `readonly [string, string]` for both `gentle` and `trap`. Render-time positioning remains in `buildChipOrder()`; no new function needed.
- [ ] **AC4 — FORBIDDEN_PAIRS:** `[chest, chip]`, `[chick, chin]`, `[chest, box]` added to the FORBIDDEN_PAIRS list.
- [ ] **AC5 — Emma's first-encounter opener:** fires the first time ch-tier is encountered (lifetime-once); persists in localStorage. Includes BOTH the two-letters-one-sound reinforcement AND the **"Not /k/ like in 'cat'"** clause (§4 — load-bearing per Dave §1c / §Recommendations-to-Kyle #1). Mirrors the sh tier's AC5 mechanism.
- [ ] **AC6 — Per-session ch-digraph-cue:** small visual cue (e.g., "ch - chin" with picture) persists in screen corner during ch-tier sessions WHILE `digraphs-ch.state === 'practicing'` (per `applyMasteryRule()` in `src/lib/progress/mastery.ts`). Hidden once the node flips to `'mastered'`. `intro` shows the cue; `practicing` shows the cue; `mastered` hides it. Maps to the existing `Progress.skillLevels[node]` field — no new accuracy-percentage infrastructure. Mirrors the sh tier's AC6.
- [ ] **AC7 — 7 picture assets shipped:** `picture-{chin,chip,chop,chat,chest,chug,chick}.svg` at `public/assets/pictures/`, embedded via `yarn embed-pictures`, each honouring the load-bearing picture briefs in §3 (esp. `chin` = face-with-prominent-chin, `chat` = two-figures+speech-bubble, `chest` = treasure-trunk-not-anatomical, `chop` = chopped-log+axe, `chug` = train/bottle-mid-motion). Plus 2 distractor-only picture assets for s-contrast traps: `picture-sat.svg` and `picture-sick.svg` (silhouette placeholders acceptable per Devon's picture-pack §6 finding #4 path; vector trace deferred to polish backlog). `picture-sip.svg` already exists from the short-i tier (reused).
- [ ] **AC8 — mastery rule:** ch-tier graduates at 90% accuracy across 3 consecutive sessions (inherited from the sh tier's lock; same as CVC tiers).
- [ ] **AC9 — isolated-ch rule:** ch-trios contain only ch-pool words + s-contrast distractors, never CVC short-vowel words and never sh-tier words. (Cross-tier review of mastered content is handled outside ch-trios; sh/ch interleaving + cross-pool `ship`-for-`chip` distractors are a deferred downstream feature per Dave §Q5 / ch-addendum §Risk #4.)
- [ ] **AC10 — canon bake + 3-place sync:** ch-tier session canon is baked via the incremental regen path (`rm public/canon/word-song/level-1/digraphs-ch.json` then `npx tsx scripts/generateSessionCanon.ts --require-keys`) post-spec-merge; canon JSON committed in the impl PR. Requires the 3-place content-sync contract in the same PR (per `.claude/docs/planner-and-canon.md` §"3-place sync contract" + Dave non-obvious finding #5): (1) `WORD_SONG_FIRST_CLASS_FOCUS_NODES` in `api/_planner.ts`, (2) the `WORD_SONG_FOCUS_NODES` iteration set in `scripts/generateSessionCanon.ts`, (3) the combo-count assertion in `scripts/generateSessionCanon.test.ts`.
- [ ] **AC11 — Jessica E2E spec (per `feedback_progression_e2e_mandatory.md`):** ch-tier progression includes a failing-first E2E spec — covers (a) first-encounter scaffold fires once (incl. the "Not /k/ like in 'cat'" clause), (b) ~90% accuracy across 3 sessions transitions ch-tier from `intro → practicing → mastered`, (c) trap distractor (ch/s contrast) correctly counts as wrong when selected. Per `.claude/docs/testing-and-ci.md` §4.1.1b, the spec MUST call `test.setTimeout()` sized at `sessions × wall_time + ≥30s headroom` (≈240_000 for a 3-session walk-through).
- [ ] **AC12 — zero `hybridMode` entries (the structural simplification vs sh):** the ch-tier `wordPack.ts` rows set `hybridMode: true` on ZERO entries — all 7 ch-words are fully decodable short-vowel entries (Dave §3d, non-obvious finding #1). Kevin's canon-bake ticket does NOT implement or inherit any hybrid-mode planner guard for ch-tier content (Dave §Recommendations-to-Matt #2). Concrete tests: (i) `wordPack.ts` exports 7 ch entries, all with `hybridMode` absent or `false`; (ii) no ch-tier word appears in any `hybridMode`-gated planner code path; (iii) the spec documents the zero-`hybridMode` outcome as deliberate (this AC + §6.1) so future work does not misapply the `hybridMode` pattern to ch.
- [ ] **AC13 — `chest` planner-weighting note:** `chest` (the short-e emerging-vowel entry) is documented for the planner as a conservatively-weighted introduction target — treated like a secondary target in early ch-introduction sessions, rising as short-e consolidates (Dave §3d / §Recommendations-to-Matt #4). This is a planner-weighting annotation, NOT a `hybridMode` flag or a schema field — `chest` is fully decodable. Test: the planner directive / canon-bake notes carry the `chest` weighting guidance.

---

## 9. Sources

This spec is derived from:

- **`design/research/digraph-ch-addendum.md` (Dave, 2026-05-14)** — the /tʃ/-specific research authority; \*\*locks the §1 pool (`chin, chip, chop, chat, chest, chug, chick`), the zero-`hybridMode` call (§6.1), the c-says-/k/ script requirement (§4), the `much`-drop / `chug`-replacement, the no-ch-vs-k-distractor call (§2/§7 Q2), and the `chest` planner-weighting note (§6/§AC13). §0 documents the full reconciliation. Cited throughout.
- `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14) — the parent research note; sh/ch/th sequencing (§Q2), the general /tʃ/ error profile + ch→/k/ orthographic trap (§Q3), word count (§Q4), isolation-vs-interleaving (§Q5).
- `design/word-song/digraphs-sh-word-list.md` (2026-05-14) — the structural predecessor, cloned section-for-section: audit lens, distractor classes (Class 1 s-contrast + Class 2 pool-neighbor), FORBIDDEN_PAIRS / TARGET_PAIRINGS shape, AC numbering, `sip` dual-role pattern. The ch tier diverges from it on content (§0) but not on structure.
- `design/research/phonics-sequence-marian.md` (2026-04-26) — vowel-tier precedent + session pacing constraints (§Q5).
- `design/word-song/short-e-pool-expansion.md`, `short-u-pool-expansion.md` — format precedent + first-encounter scaffold pattern; the `gem`/`web` conservative-weighting precedent for emerging-vowel words.
- `design/word-song/picture-pack-style-anchor.md` — style frame (inherited by the companion prompt sheet).
- `CLAUDE.md` — Marian profile + project constraints.
- `.claude/docs/skill-trees-and-content.md` — `WordEntry` shape (`vowel`, `phoneme`, `hybridMode`), `digraphs-sh` first-class status, cross-vowel-tier-load-bearing distractor cluster, pool-extension sync points.
- `.claude/docs/planner-and-canon.md` — canon-bake pipeline, 3-place sync contract, incremental-regen trick.
- `.claude/docs/testing-and-ci.md` — failing-first E2E timeout sizing rule (§4.1.1b).

---

## 10. Non-obvious findings to surface

These are surfaced for Thomas / Matt / Kevin via the PR / handoff:

1. **This spec was reconciled against Dave's `digraph-ch-addendum.md`, which diverged from an earlier in-flight draft on three structural points** — see §0. The earlier draft (written before the addendum was on disk) proposed `chip, chest, chick, chimp, cheese, chair, chain` with 3 `hybridMode: true` long-vowel hybrids. Dave's locked inventory is `chin, chip, chop, chat, chest, chug, chick` with ZERO `hybridMode`. The divergence is fully adopted; the structural skeleton (audit lens, distractor classes, AC numbering, schema reuse) survived the reconciliation unchanged — only the content moved.

2. **The ch tier has ZERO `hybridMode` words — structurally unlike the sh tier — and Dave directs this to be stated explicitly** (§3d, non-obvious finding #1). sh's 3 hybrids (`shoe/sheep/shark`) were a necessary exception driven by thin short-vowel stock. ch's short-vowel ch-initial word stock is rich enough that long-vowel inclusions are never necessary. Stating it explicitly (§6.1, AC12) prevents future misapplication of the `hybridMode` pattern to ch. **Impl consequence:** Kevin's canon-bake ticket does NOT inherit the sh-tier's hybrid-mode planner logic — materially simpler than sh's impl was.

3. **The c-says-/k/ orthographic interference is ch's unique pedagogical burden** (Dave §1c, non-obvious finding #2). Every prior digraph (sh) had no prior grapheme conflict — Marian had not learned that `s` or `h` meant anything separately. But she HAS learned `c` says `/k/` (from `cat, cup, cap`). When `ch` arrives, the c-letter's prior mapping creates a competing hypothesis she must explicitly override. This is a one-time metalinguistic move Emma's introduction script MUST make clearly ("ch says ch, NOT /k/ like in 'cat'", §4 / AC5). It needs no extra screen design — just the right script line — but it is load-bearing, not decorative.

4. **`chin`, `chop`, `chat` are Dave's keeps that a naive audit would reject — and the picture briefs are what rescue them** (§0). `chin` looks like a body-fragment (cf. the sh-tier `shin` rejection) but Dave keeps it because it is shown _in a face_ and body parts are the highest-familiarity vocabulary class — "the picture is literally on Marian's face". `chop` and `chat` look like a verb and an abstract — Dave keeps them because `chop` is the `chop`/`shop` minimal-pair anchor and `chat` is "the best short-a ch word that is picturable", both with specific picture briefs (chopped-log+axe; two-figures+speech-bubble). **The picture briefs in §3 / the companion prompt sheet are load-bearing AC content (AC7), not optional polish.**

5. **`chop` and `chip` are planned sh/ch minimal-pair discrimination anchors — a FEATURE of sh-before-ch sequencing, not a collision** (Dave non-obvious finding #3). They form minimal pairs with sh-tier `shop`/`ship` that Marian already knows. In the ch-INTRODUCTION tier they are NOT yet used as cross-pool distractors (§2 — that's the interleaving phase's job). But the impl should annotate `chip`/`chop` with a "minimal pair: ship/shop (sh-tier)" note (planner constraint #6 / §6) so the future interleaving-phase planner work can leverage them intentionally.

6. **/tʃ/ is meaningfully EASIER for Marian than /ʃ/ was** (Dave Bottom-line, §1a, §Application, §Risk #2). Unlike `/ʃ/`, the affricate `/tʃ/` is in Tagalog's loanword layer (`tsaa`, `church`, `cheese`, `chips`) — Marian has perceptual scaffolding she entirely lacked for sh. The basilect substitution `/tʃ/`→`/ts/` is a _partial_ affricate (not a blank-slate `/s/`) and is **production-only — irrelevant to chip-tap recognition**. Thomas should expect the ch tier to feel easier than sh did; if real-iPad observation showed sh harder than predicted, ch will likely be easier still.

7. **`much` was dropped as unpicturable; `chug` is Dave's replacement** (§3b). `much` is a function-word / degree-adverb — it cannot be depicted as a standalone object, and hearing it in isolation is semantically strange for an 8yo. `chug` (short-u, word-initial, onomatopoeic train/gulping-bottle) replaces it. `rich` was the other ch-final candidate — not in the locked 7 because its picture grounds unreliably as "gold"/"money" rather than "rich"; `chick` took the slot instead (Dave §3a/§3b).

8. **`sip` is now a THREE-tier cross-tier-load-bearing distractor.** It started as a short-i `TARGET_WORDS` entry; the sh tier referenced it as `ship`'s trap; the ch tier now references it as `chip`'s trap. The cluster pattern (`.claude/docs/skill-trees-and-content.md` §"pen is cross-vowel-tier load-bearing") generalises cleanly to the digraph tiers. Worth updating that doc's cluster table to note `sip` is referenced from short-i (own tier) + sh + ch once this spec's impl ships. The ch tier also adds two NEW distractor-only entries: `sat` and `sick`.

9. **NO `-tch` trigraph words in the ch pool, ever** (Dave §4b, §Recommendations-to-Matt #5). `catch, fetch, witch, watch` use the `-tch` alternative spelling of `/tʃ/` — a _separate_ phonics lesson (the "use `-tch` after a short vowel at word end" spelling rule). Mixing `-tch` into the `ch` introduction tier creates confusion about which grapheme to use. The locked 7 are all clean `ch` (initial position); the pool is `-tch`-free by construction.

10. **The `digraphs-ch` node can open before sh hits 90%** (Dave ch-addendum §5). The node opens when sh has had its 3–5 introduction sessions and Marian's sh accuracy is _trending upward_ (~50%+ opening threshold) — ch-introduction-in-isolation and sh-review-consolidating run in parallel within a session. This is a planner session-composition decision, NOT a word-list decision — flagged for Kevin's impl ticket (§7 inherited resolutions).

11. **The pool is short-i-heavy** — 3 of 7 (`chin, chip, chick`) are short-i. The planner must avoid composing all-short-i trios — a real composition note for Kevin's planner ticket. This is inherent to Dave's locked inventory (short-i has the richest ch-initial concrete-noun stock); it is not a defect to fix by substitution, just a planner-side constraint to honour.

12. **`chest` needs conservative planner weighting, not a `hybridMode` flag** (Dave §3d, §Recommendations-to-Matt #4, AC13). Short-e is Marian's _emerging_ vowel — but "emerging is not the same as unlearned"; short-e was formally introduced (the tier shipped 2026-05-14). `chest` is fully decodable; it just needs the planner to treat it like a secondary target in early introduction sessions (the `gem`/`web` precedent from the short-e tier) and let it rise as short-e consolidates. This is a planner-weighting annotation — distinct from, and much lighter than, the `hybridMode` machinery.
