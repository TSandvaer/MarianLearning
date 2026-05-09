# Word Song — short-e pool expansion (v4 vowel tier — final single-vowel tier)

**Ticket:** TBD — Matt to file (this spec) — implementation ticket downstream (Kevin's planner-widen + canon-bake; Devon's `wordPack.ts` + picture-embed wiring).
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #132 (parser widening), PR #135 (cvc-words first-class shipped), PR #139 (developmental review merged 2026-05-02), PR #141 (short-o pool expansion spec, locked 2026-05-04), PR #150–#155 (short-o impl + canon), PR #156–#157 (short-a + short-o picture pack ship via PNG-in-SVG embed), PR #170 (short-u picture pack), PR #173 (short-u minimal-pair + future-vowel-openers research), PR #174 (short-u sibling node + canon + planner + debug seed). The short-i tier spec is ASSUMED upstream of this one — see §10 Q5 for the open question on short-i sequencing.
**Companion specs:** `design/word-song/short-u-pool-expansion.md` (structural template — this spec mirrors it section-by-section), `design/word-song/short-e-picture-pack-prompts.md` (the MJ prompt sheet sibling to this doc), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/short-o-pool-expansion.md` (additional template reference), `design/word-song/README.md`, `design/word-song/parser-widening-plan.md`.

---

## Why this spec, why now

Short-u shipped 2026-05-09 (PRs #170 + #174). Per the canonical Marian arc `o → u → i → e` (locked in `design/research/phonics-sequence-marian.md` §Q1 — revised order), short-e is **the LAST single-vowel tier** in this learning arc. After short-e masters, the literacy track moves to digraphs (sh/ch/th).

Two structural facts make short-e materially different from the prior single-vowel specs and motivate writing this spec proactively rather than on-demand:

1. **Short-e is gated against short-i, not against an L1 phoneme gap.** Per Dave's PR #173 §3.2 research (`design/research/short-u-minimal-pair-and-future-vowel-openers.md`), Tagalog has a /ɛ/-ish allophone, so the L1 gap is mild. The load-bearing concern for short-e is **discrimination from short-i (`/ɪ`)** — the just-consolidated tier. Keys to Literacy and Fairleigh Dickinson explicitly place /e/ last in the canonical order specifically to maximize separation from /i/. This is structurally different from short-u (L1-gap motivated) and short-o (decoding-load motivated).

2. **A 2-session-gap rule is mandatory between short-i mastery and short-e introduction.** Per Dave's research §3.2 + practitioner consensus (Source 3 in `phonics-sequence-marian.md`: "avoid teaching short /e/ and short /i/ back to back. The recommended gap is several weeks, not days"). This is a NEW per-tier scaffolding mechanism that does NOT exist for short-u (which uses lifetime-once first-encounter scaffolding) or short-o (also lifetime-once on `box`/`fox`). It requires its own predicate in `mastery.ts` and lands as §5 of this spec.

Per Dave's PR #173 §3.2 recommended opener — `bed / bid` — pre-spec'd verbatim. This spec uses that pair as the locked first-encounter contrast line, mirroring the AC9b mechanism short-u shipped (`sun / soon`).

**Scope of this spec:** word selection (audit + final pool), focus-node naming, picture-pack requirements, mastery progression flow into short-e (including the new 2-session-gap rule), canon-bake plan, visual-design delta. The companion MJ prompt sheet [`short-e-picture-pack-prompts.md`](./short-e-picture-pack-prompts.md) carries the per-word generation prompts (Phase 1 deliverable for Thomas).

Out-of-scope items are listed at the end (§8). Code changes are downstream — Kevin handles canon + planner + sibling-node wiring + the new `canIntroduceShortE` helper after this spec lands; Devon handles picture-embedding via `yarn embed-pictures` after Thomas's MJ pass.

---

## 1. Word selection — the 9 short-e words

### Brief / phonics-doc starting pool

The brief and `design/research/phonics-sequence-marian.md` §Application both list short-e CVC candidates: `bed, hen, leg, net, pen, red, ten, den, get` (phonics doc §Application short-e list) plus the brief's expanded list including `peg, men, web, jet, bell, vet, set, get, pet, met, yet, wet`. EnglishClub.com's /ɛ/–/ɪ/ minimal-pair corpus (Source 15 in PR #173) adds `bed, bell, fell, led, pen, ten` as confirmed-short-e words.

The brief expects ~11 entries, mirroring the short-u target count, but flags the audit constraint upfront: "Some are likely too abstract or duplicate (e.g. `peg` is an antique word for a 2026 8yo Filipino L1 learner; `vet` — context-dependent)." The audit will be honest about pool-size; precedent is short-o landed at 8, short-u at 11. Short-e's audit ceiling lands at **9 strong entries** — see §1 §Pool-size recommendation below.

### Audit of the brief's candidate set

Audited against the v1 word-pack constraints (concrete-noun referent, true CVC pattern, picturable for an L2 8-year-old, vocabulary-cap aware per CLAUDE.md, distinct silhouette at 96pt, no collision with existing pack neighbors):

| Word | CVC pattern | Concrete | Picturable | In ~200-word vocab cap | Silhouette risk | Verdict |
| ---- | ----------- | -------- | ---------- | ---------------------- | --------------- | ------- |
| bed  | C-V-C ✓     | ✓ (furniture) | ✓ (rectangular furniture with pillow + headboard) | High-frequency, universal | Low — no collision with existing pack | **KEEP** |
| red  | C-V-C ✓     | ✗ — color/adjective | Color words don't ground a noun chip — would have to be a red shape, which reads as "circle" or "square" rather than "red" | Borderline as concept | n/a | **REPLACE** — color words are not concrete nouns; chip-side ungrounded. |
| leg  | C-V-C ✓     | ✓ (body part — anatomy is a NEW category for the pack) | ✓ — single leg (human, animal, or chair leg) | High-frequency body-part vocabulary | Low — no canonical chip is a single-leg silhouette | **KEEP** — anatomy slot, well-grounded as the leg of a person OR chair-leg style for category clarity (preference: chair-leg or table-leg, since person-leg fragments a body composition). |
| peg  | C-V-C ✓     | ✓ (small wooden pin) | Marginal — "peg" is **archaic vocabulary for a 2026 8yo Filipino L2 learner** (per the brief's own flag). Tagalog homes don't typically use clothes-pegs the way British / American 1950s vocabulary might suggest. The picture (small wooden cylindrical pin with a slight notch) reads as "stick" or "twig" without context. | **HARD REJECT** — vocab risk | Low | **REPLACE** — vocabulary risk too high for the audit constraint. |
| hen  | C-V-C ✓     | ✓ (animal — chicken) | ✓ — chicken with characteristic comb + beak + plump body | High-frequency in Filipino-English (chicken raising is common; "hen" specifically is the female-chicken term but the picture-chip carries the meaning regardless) | Low — distinct from existing animals (cat, dog, fox, bug, rat) by 2-legged + beak silhouette | **KEEP** |
| ten  | C-V-C ✓     | ✗ — abstract number | The chip would have to be the digit "10" or ten countable objects. Digit-as-image conflicts with the no-text rule (the chip becomes text). Ten objects (e.g. ten dots) are a quantity-display, not a noun. | **HARD REJECT** — abstract noun, no stable picture | n/a | **REPLACE** — abstract; chip-side ungrounded. |
| men  | C-V-C ✓     | ✓ (plural people) | ✓ but **collides with existing `man` and `dad`** in short-a pack — both human-figure compositions. The composition discriminator (single vs. group) is fragile at 96pt. | High-frequency but composition-collision risk | **HIGH** — `men` would require a multi-figure composition (2+ adult males) which collides with `dad` (parent + child two-figure) and `man` (single-figure) silhouettes | **REPLACE** — composition collision unsolvable in v1. |
| pen  | C-V-C ✓     | ✓ (writing instrument) | ✓ — already shipped as `picture-pen.svg` distractor (PR #157) | High-frequency, picture-grounded | Low — pointed cylinder with clip + cap is distinct from existing pack | **KEEP** — re-purpose distractor → target (mirrors short-u promotion of `sun, cup, bus`). |
| web  | C-V-C ✓     | ✓ (spider web — concrete object) | ✓ — concentric rings + radial lines, distinct geometric pattern | Borderline — "web" specifically (spider's web) is in early-reader vocabulary; not high-frequency but picture-grounded | Low — no canonical chip has the concentric-radial pattern | **KEEP** |
| jet  | C-V-C ✓     | ✓ (jet plane / jet aircraft — count noun) | ✓ — sleek aircraft silhouette with wings + tail + cockpit | Borderline — "jet" (the aircraft) is in early-reader vocabulary; "jet" can also mean "stream of fluid" but the aircraft reading is canonical | Low-to-moderate — `jet` (plane) is categorically distinct from `bus`/`van` (ground vehicles). Wings + tail + cockpit are the discriminators. | **KEEP** |
| bell | **C-V-CC** ✗ | ✓ | ✓ | High-frequency | n/a | **REPLACE** — strict CVCC by spelling pattern (4 letters: b-e-l-l). The geminate `ll` IS phonetically /l/ (single phoneme), but the short-u spec explicitly rejected `lull`, `bull`, `pull` for being CVCC by the spelling-pattern rule. Apply the same rule for consistency. (Compare to `egg` — 3 letters with geminate — which IS retained here under the same logic that retained `box`/`fox` in short-o; the 3-letter spelling pattern is the precedent.) |
| vet  | C-V-C ✓     | ✓ (person — veterinarian) | Marginal — "vet" requires a person + animal composition (a vet examining a pet), which is multi-subject and contextually loaded. Single-vet figure (in scrubs with stethoscope) reads as "doctor" without the animal context. | **HARD REJECT** — context-dependent vocabulary; multi-subject composition risk; single-figure-vet reads as "doctor". | n/a | **REPLACE** — composition + vocab risk. |
| net  | C-V-C ✓     | ✓ (fishing net or butterfly net — count noun) | ✓ — mesh pattern with handle frame | High-frequency for an L2 8yo (Filipino fishing villages; butterfly net in early-reader books) | **MODERATE** — `net ↔ bag` cross-pack risk (both fabric-with-handle objects). Discriminator: mesh-with-knots (net) vs. solid-fabric (bag). At 96pt, the mesh must read clearly. **NEW FORBIDDEN_PAIR candidate `[net, bag]`.** | **KEEP — with caveat.** Adds a forbidden-pair entry per §3 + §5. |
| set  | C-V-C ✓     | ✗ — verb / noun-of-collection ("a set of cups") | n/a | n/a | n/a | **REPLACE** — verb-class problem. |
| get  | C-V-C ✓     | ✗ — verb | n/a | n/a | n/a | **REPLACE**. |
| pet  | C-V-C ✓     | ✓ (domesticated animal — generic) | ✓ but **collides with `cat`, `dog`, `bug`** silhouettes (a generic pet is one of those). Word IS the name; chip cannot read as "generic pet" without specifying species. | **HARD REJECT** — silhouette collision unsolvable. | n/a | **REPLACE** — collision. |
| met  | C-V-C ✓     | ✗ — verb (past) | n/a | n/a | n/a | **REPLACE**. |
| yet  | C-V-C ✓     | ✗ — adverb | n/a | n/a | n/a | **REPLACE**. |
| wet  | C-V-C ✓     | ✗ — adjective | n/a | n/a | n/a | **REPLACE**. |

**Verdict from the brief's set:** keep 5 (`bed, leg, hen, pen, web, jet, net` = 7 actually counting, plus the ones rejected). Re-tallying: KEPT = `bed, leg, hen, pen, web, jet, net` = **7 strong entries**. Replaced/rejected = the rest. Need 4+ more to reach 11; audit-honest count below.

### Substitutions and additions — sourcing the remaining slots

Candidates from standard short-e CVC lists (Big City Readers source 5; Reading Rockets ELL short-e; UFLI / Wilson Reading short-e sets), audited against the same constraints:

| Candidate | CVC | Concrete noun | Picturable | Vocab-cap aware | Silhouette risk | Verdict |
| --------- | --- | ------------- | ---------- | --------------- | --------------- | ------- |
| **gem**   | C-V-C ✓ | ✓ (jewel/precious stone) | ✓ — distinct geometric crystal/diamond shape with facets | Borderline — "gem" specifically is less common than "diamond" or "jewel" in 8yo vocabulary; the diamond-cut silhouette carries it | Low — geometric crystal is unique in the pack | **KEEP** |
| **egg**   | spelling: e-g-g (3 letters with geminate `gg`) — phonetically C-V-C (`/ɛg/`) | ✓ (food / object) | ✓ — smooth ovoid | High-frequency, universal | **MODERATE** — `egg ↔ nut` (both ovals; nut has vertical seam, egg is smooth) and `egg ↔ bun` (both round food; bun has horizontal score). **NEW FORBIDDEN_PAIRS candidates `[egg, nut]` and `[egg, bun]`.** | **KEEP** — apply the short-o `box`/`fox` precedent: 3-letter spelling pattern with geminate that decodes as a single phoneme. Practitioner curricula universally list `egg` as short-e CVC. Decoding-load is fractionally lower than `box`/`fox` (geminate `gg` = single /g/, not two-phoneme), so no first-encounter scaffolding line is needed for `egg` specifically. The vowel-introduction line at session-open (§4) covers it. |
| **bell**  | C-V-CC | — | — | — | — | **SKIP** — see brief audit table; 4-letter CVCC by spelling, conflicts with short-u rule. |
| **den**   | C-V-C ✓ | ✓ (animal's lair OR small home room) | Marginal — empty den (cave silhouette) reads as "cave"; den-with-animal introduces a second subject. The "study room" reading needs furniture context. | Borderline — vocab is weak for an 8yo Manila L2 learner | Picture instability | **SKIP** — picture-side instability. |
| **fed**   | C-V-C ✓ | ✗ — verb (past tense of feed) | n/a | n/a | n/a | **SKIP**. |
| **led**   | C-V-C ✓ | ✗ — verb (past tense of lead) | n/a | n/a | n/a | **SKIP**. |
| **hem**   | C-V-C ✓ | ✓ (sewing-edge of fabric) | Marginal — abstract sewing concept; the picture (a folded fabric edge) reads as "fabric" or "ribbon" | Vocab risk for 8yo | Low | **SKIP** — vocab + picture instability. |
| **Ken**   | C-V-C ✓ | ✗ — proper noun (person's name) | n/a | Proper nouns out of pack-scope | n/a | **SKIP**. |
| **bet, beg, let, yes** | various | verbs / function words | n/a | n/a | n/a | **SKIP**. |

**Other candidates briefly considered and dropped:** `nest` (CVCC), `mess` (CVCC), `desk` (CVCC), `wet` (adj), `step` (CVCC), `eel` (VVL — long-e), `elf` (VCC), `end` (VCC), `egg` (already kept above).

### Pool-size recommendation — 9, not 11

The brief asked for "aim for 11" short-e target words. After the strict audit, **the rigor lands at 9 strong entries**:

> `bed, leg, hen, pen, web, net, jet, gem, egg`

— 7 from the brief's list (5 audit-keeps + `web` + `jet` from the expanded brief), plus 2 sourced from standard short-e CVC lists (`gem` = strong; `egg` = retained under the short-o `box`/`fox` precedent for 3-letter spelling-CVC).

Forcing 11 would drag in weaker entries (`bell` CVCC-rule violation, `den` picture-instability, `peg` antique-vocab, `red`/`ten`/`men`/`vet`/`pet` audit failures). That would reproduce exactly the kind of pool-size-driven dilution the short-u spec §1 explicitly avoided.

This is fewer than short-u's 11 and matches short-o-adjacent (8) — calibrated to what the actual short-e CVC vocabulary surface offers without forcing weak entries:

- Short-a has 14 because it's the most-prolific English short-vowel CVC family (5+ rhyme groups: /æt/, /æn/, /æg/, /æp/, /æd/, /æm/, plus the loose `dad`/`man`).
- Short-o has 8 because Dave's source 5 and the spec audit converged at exactly 8 strong entries.
- Short-u has 11 because the audit landed there without forcing.
- **Short-e has 9** — between short-o and short-u; the audit-derived honest ceiling.

Pool size **9 — open question for Thomas (Q1 in §10)**. Recommendation: ship 9. Phase 2 fallback to 8 (drop `egg` if Phase-2 review finds it unstable as a chip vs. `bun`/`nut`) stays documented as the contingency.

### Final v1 short-e pool (9 words, recommendation pending Thomas Q1 lock)

| #   | Word | Picture status | Vowel | Category | Notes |
| --- | ---- | -------------- | ----- | -------- | ----- |
| 1   | bed  | NEW | e | household | Rectangular bed with pillow + headboard. |
| 2   | leg  | NEW | e | anatomy / object | Single leg — preferred chair-leg or table-leg framing for category clarity (avoids body-fragmentation read). |
| 3   | hen  | NEW | e | animal | Chicken — characteristic comb + beak + plump body. |
| 4   | pen  | EXISTS as distractor (PR #157); **re-trace open question — see §10 Q2** | e | object | Promoted from distractor → target. Picture exists; the §10 Q2 question is whether to re-trace alongside the new MJ session for tier visual cohesion (mirrors short-u Q2). |
| 5   | web  | NEW | e | object | Spider web — concentric rings + radial lines. |
| 6   | net  | NEW | e | object | Fishing or butterfly net — mesh + handle frame. **NEW FORBIDDEN_PAIR with `bag`** — §3. |
| 7   | jet  | NEW | e | vehicle | Jet plane — sleek aircraft with wings + tail. |
| 8   | gem  | NEW | e | object | Geometric crystal/diamond shape. |
| 9   | egg  | NEW | e | food | Smooth ovoid. **NEW FORBIDDEN_PAIRS with `nut` and `bun`** — §3. **3-letter spelling-CVC precedent from short-o `box`/`fox`** — practitioner curricula universally list as short-e CVC. |

**Pool composition cross-check:**

- **All 9 are concrete nouns or noun-form-pictureable.** Each word has a stable chip read.
- **8 of 9 are CVC by both spelling and phonemes.** `egg` is 3-letter spelling-CVC with geminate `gg` decoding as a single /g/ phoneme — applies the short-o `box`/`fox` precedent (universally listed as CVC in practitioner phonics curricula). No additional first-encounter scaffolding needed beyond the §4 `bed/bid` opener.
- **1 of 9 is already in the v1 distractor pool** (`pen`) — picture asset exists as PR #157. The other 8 are wholly new.
- **Category spread:** 1 household (bed), 1 anatomy/object (leg), 1 animal (hen), 1 writing-tool (pen), 1 spider-web (web), 1 mesh-tool (net), 1 vehicle (jet), 1 jewel (gem), 1 food (egg). 9 words across 9 distinct categories — exceptional diversity.

### Phonetic spread within the pool (rhyme-family coverage)

Onset + coda variety drives "real decoding" vs. "first-letter pattern-match" — same constraint that drove short-u's audit:

| Rhyme family | Members  | Member count |
| ------------ | -------- | ------------ |
| `/ɛd/`       | bed      | 1            |
| `/ɛg/`       | leg, egg | 2            |
| `/ɛn/`       | hen, pen | 2            |
| `/ɛb/`       | web      | 1            |
| `/ɛt/`       | net, jet | 2            |
| `/ɛm/`       | gem      | 1            |

6 distinct codas across 9 words. Onsets cover b-, l-, h-, p-, w-, n-, j-, g-, e- (9 distinct onsets — every word has a unique onset letter, the strongest onset-spread in the entire vowel arc). Sound space is well-covered for a 9-word pool. The `/ɛg/`, `/ɛn/`, `/ɛt/` doublets give the planner three rhyme-family clusters to lean on for trap-tier distractors (problem 4-8 wants same-rhyme partners). The `/ɛd/`, `/ɛb/`, `/ɛm/` singletons rely on near-rhyme + cross-coda variety.

### Confusion-with-short-i audit (the load-bearing concern)

Per Dave's PR #173 §3.2, the distinctive load-bearing concern for short-e is **confusion with the recently-consolidated short-i (`/ɪ/`)** — Tagalog's allophone-rich /ɛ/ approximation provides modest L1 transfer support, but the /ɛ/–/ɪ/ pair is the most-confused short-vowel pair in English phonics instruction (Keys to Literacy, Fairleigh Dickinson). The /ɛ/–/ɪ/ minimal pairs that surface in this audit:

| short-e | short-i (presumed pool — see §10 Q5) | Risk |
| ------- | ------------------------------------ | ---- |
| bed     | bid (likely short-i pool member)     | **MINIMAL-PAIR** — directly part of the §4 first-encounter opener. Marian's just-consolidated /ɪ/ would map "bed" to "bid"; the contrast line resets the prediction. |
| pen     | pin (likely short-i pool member)     | **MINIMAL-PAIR** — second-most-cited /ɛ/–/ɪ/ pair (per Source 15 in PR #173 — EnglishClub). Not in the §4 opener but represents an ambient pair Marian will encounter via decoding similarity. |
| net     | knit (CVCC — out of CVC pool)        | **NEAR-PAIR** but knit is CVCC, won't appear in short-i pool; safe. |
| leg     | lid (likely short-i pool)            | **NEAR-PAIR** — same onset, different vowel + coda. Distinct enough that no special handling needed. |

**The `bed/bid` opener (§4) is the load-bearing intervention.** The remaining /ɛ/–/ɪ/ confusion is handled by (a) the 2-session-gap rule (§5 — gives short-i time to consolidate before short-e introduces the contrast at all), (b) the same-vowel-only distractor rule (§ 8 — keeps short-i words out of short-e trios in v1), and (c) the standard mastery rule (§4 — Marian must hit 90/3 on short-e to graduate). Repeated drill of the contrast across sessions is **out of scope** per PR #173 §2 (lifetime-once dose is the recommendation; repeated openers cost working memory without benefit).

---

## 2. Distractor word list (~8 entries, in-tier pool)

The brief asks for ~8 distractor-only short-e words. **Audit notes: same structure as short-u §2 — distractors are drawn from the same-vowel pool itself per the v1 same-vowel-only rule.** The 9 short-e targets simultaneously serve as the in-tier distractor pool; every short-e target has gentle + trap distractors picked from the other 8 short-e words.

The "8 distractor words" reading from the brief reduces to two interpretations, mirroring short-u §2:

- **Reading A**: an additional ~8 short-e distractor-only chips beyond the 9 targets, for matrix variety.
- **Reading B**: the same in-tier pool (the 9 targets) IS the distractor pool. No separate "distractor-only" list.

Audit candidates for Reading A (additional short-e distractor-only entries):

| Candidate | Reason to ship as distractor-only | Reason to skip |
| --------- | --------------------------------- | -------------- |
| bell      | High-frequency object             | **SKIP** — CVCC by spelling-rule (consistent with short-u's `lull`/`bull` rejections). |
| den       | Animal-lair or study-room         | **SKIP** — picture-side instability (cave reading) + vocab risk. |
| peg       | Wooden-pin object                 | **SKIP** — antique vocabulary per the brief's flag. |
| pet       | Domesticated animal               | **SKIP** — collides with cat/dog/bug silhouettes. |
| ten       | Number — abstract                 | **SKIP** — chip-side ungrounded (no stable noun-form picture). |

The audit doesn't yield 8 strong distractor-only short-e entries. Forcing them would weaken the pack (as it did for short-u Reading A's `pup`/`mug`/`mud` failures).

**Recommended interpretation: Reading B.** The 9 short-e targets are simultaneously the 9-word in-tier distractor pool. No separate "distractor-only" list is needed; the matrix in `TARGET_PAIRINGS` (§AC6) draws every short-e distractor from the 9-word target pool. This mirrors short-u §2 verbatim and short-o §8.

**Spec lock for v1: same-vowel-only, 9-word pool serves as both target list and distractor pool.** Q4 in §10 captures the "Reading A vs B" decision for Thomas confirmation (parallel to short-u Q4).

### Distractor matrix (concrete example)

The full `TARGET_PAIRINGS` rows are an AC item for Kevin's impl ticket (§9 AC6); design preview here so the structure is clear:

```ts
bed: { gentle: ['hen', 'web'], trap: ['leg', 'gem'] },  // /ɛd/ has no in-pool rhyme; /ɛg/ + /ɛm/ near-codas
leg: { gentle: ['hen', 'jet'], trap: ['egg', 'gem'] },  // /ɛg/ rhyme + /ɛm/ near-rhyme
hen: { gentle: ['web', 'net'], trap: ['pen', 'gem'] },  // /ɛn/ rhyme + cross-category
pen: { gentle: ['hen', 'web'], trap: ['hen', 'leg'] },  // /ɛn/ rhyme partner; care: pen-hen is the in-pool /ɛn/ pair
web: { gentle: ['hen', 'jet'], trap: ['bed', 'leg'] },  // /ɛb/ has no rhyme partner; near-codas
net: { gentle: ['bed', 'gem'], trap: ['jet', 'pen'] },  // /ɛt/ rhyme + cross-category
jet: { gentle: ['hen', 'gem'], trap: ['net', 'pen'] },  // /ɛt/ rhyme + /ɛn/ near-rhyme
gem: { gentle: ['hen', 'net'], trap: ['jet', 'web'] },  // /ɛm/ has no in-pool rhyme; near-codas
egg: { gentle: ['hen', 'web'], trap: ['leg', 'gem'] },  // /ɛg/ rhyme partner with leg + cross-codas; bun + nut excluded per the §3 LOCKED `[egg, bun]` and `[egg, nut]` FORBIDDEN_PAIRS (cross-vowel anyway, not in pool)
```

**Note on `pen`'s row:** the preview's trap pairing repeats `hen` — the matrix preview is illustrative, NOT the final pairings. Kevin owns the pairings under his impl ticket per `screens-and-flows.md` spec-authoring convention (anchor on stable name primitives, not exact pair assignments). The constraint is design lock here is the *constraint* (gentle = clearly different category; trap = same rhyme or same near-coda), not the exact pairs.

**Note on `egg`:** `egg ↔ nut` and `egg ↔ bun` are cross-vowel forbidden pairs (added in §3) but `nut` and `bun` are short-u, never appear in short-e trios under the same-vowel-only rule. So the FORBIDDEN_PAIR additions are for cross-pack hygiene, not for in-pool selection.

---

## 3. Picture-pack requirements

### Existing assets (audited 2026-05-09)

Per `public/assets/pictures/` after PR #156, #157, #170 (full short-a + short-o + short-u picture pack ship):

- 14 short-a target picture-`{word}`.svg files
- 8 distractor-only picture-`{word}`.svg files (`bus, sun, dog, fox, cup, pen, log, pot`) — 4 of these (`bus, sun, cup`) were promoted to short-u targets in PR #170 and re-traced in that pass; `dog, fox, log, pot` were promoted to short-o targets earlier; `pen` remains as a short-e distractor candidate.
- 4 short-o-additions picture-`{word}`.svg files (`mom, mop, box, hot`)
- 8 short-u-new picture-`{word}`.svg files (`bug, nut, tub, bun, jug, rug, hut, gum`) — plus the 3 short-u retraces of `sun, cup, bus`
- 4 novel-pool probe picture-`{word}`.svg files (`nap, rat, map, tap`)

Cumulative ~38 picture-pack SVGs on disk after PR #170 ships, all using the PNG-in-SVG embed pattern (per `.claude/docs/skill-trees-and-content.md` §"Rendering pattern post-PR #157").

One of the short-e targets (`pen`) re-purposes an existing distractor picture file. The other 8 are brand-new (`bed, leg, hen, web, net, jet, gem, egg`).

### Asset format

Match short-u's locked decision (§3 of short-u spec): **PNG-in-SVG embed via `yarn embed-pictures`**. Path 2 per `.claude/docs/skill-trees-and-content.md` — Thomas runs MJ → remove.bg → `yarn embed-pictures` → `<svg><image href="data:image/png;base64,...">`.

Visual fidelity = 100% the source PNG; file size ~50–150 KB per asset at 512×512 source PNG resolution. Picture-pack budget remains within the 4 MiB PWA cache cap (~38 + 9 = 47 picture-pack SVGs at ~100 KB ≈ 4.7 MB, slightly above the cap — see §3 §Cumulative budget below for the mitigation).

**Do NOT use Path 1 (agent-delegated hand-author SVG)** for this pack — same rationale as short-u §3 (visual-fidelity surprise post-PR-#157). Thomas wants source fidelity here.

### Required new pictures (8 wholly-new + 1 conditional re-trace per Q2)

| #   | Word | Status | Path | Notes |
| --- | ---- | ------ | ---- | ----- |
| 1   | bed  | NEW | `public/assets/pictures/picture-bed.svg` | Rectangular furniture, three-quarter view, single pillow + headboard, optional simple folded blanket. |
| 2   | leg  | NEW | `public/assets/pictures/picture-leg.svg` | Single chair-leg or table-leg, three-quarter view (preferred over body-leg to avoid body-fragmentation read — see §10 Q3). |
| 3   | hen  | NEW | `public/assets/pictures/picture-hen.svg` | Chicken with characteristic comb + beak + plump body, side or three-quarter view, friendly expression. |
| 4   | pen  | EXISTS as distractor (PR #157); **re-trace pending Q2** | `public/assets/pictures/picture-pen.svg` | If Q2 = re-trace: existing file overwritten via `yarn embed-pictures` after Thomas's MJ pass. If Q2 = defer: existing PR #157 file kept as-is for v1; future cohesion pass picks it up. Mirrors the short-u Q2 question for `sun, cup, bus`. |
| 5   | web  | NEW | `public/assets/pictures/picture-web.svg` | Spider web — concentric rings + radial lines, three-quarter view, NO spider visible (single subject). |
| 6   | net  | NEW | `public/assets/pictures/picture-net.svg` | Fishing or butterfly net — clear mesh pattern (load-bearing detail) + handle frame. **NEW FORBIDDEN_PAIR with `bag`** — §5. |
| 7   | jet  | NEW | `public/assets/pictures/picture-jet.svg` | Sleek jet plane — wings + tail + cockpit, three-quarter view, in flight (NOT on runway — strip environment). |
| 8   | gem  | NEW | `public/assets/pictures/picture-gem.svg` | Geometric crystal/diamond shape with visible facets, three-quarter view. |
| 9   | egg  | NEW | `public/assets/pictures/picture-egg.svg` | Smooth ovoid, three-quarter view from slightly above. **NEW FORBIDDEN_PAIRS with `nut` and `bun`** — §5. |

**Total picture-pack PNG generations needed: 8 wholly-new** (`bed, leg, hen, web, net, jet, gem, egg`). If Q2 = re-trace, add 1 (re-trace `pen`) for a total of 9 generations. If Q2 = defer, total stays 8.

If Phase 2 review drops `egg` (Phase 2 fallback per §10 Q1 contingency), the count drops to 7 wholly-new (or 8 with `pen` re-trace).

**Total post-Phase-3 SVG asset count (after this pack):**

- Cumulative pre-short-e: ~38 picture-pack SVGs after PR #170.
- Short-e pack: 8 wholly-new + 1 conditional re-trace (overwriting `pen`) = **8 new files + 0-1 overwrites**.
- **New SVG file additions on this PR pack: 8 (or 7 if Phase 2 drops `egg`).** Cumulative: ~46 picture-pack SVGs after this ships (the 0-1 retraced `pen` file keeps the same path, no new file count).

### Cumulative PWA cache budget check

Combined size estimate at ~100 KB per asset for ~46 picture-pack SVGs ≈ ~4.6 MB. **This is at or slightly above the 4 MiB cache cap from `vite.config.ts:93`.** Mitigation paths:

1. **Aggressive PNG compression at remove.bg export.** Reducing source PNG resolution from 512×512 to 384×384 or further-tuning the lossy compression can shrink each SVG to ~60-80 KB without visible chip-size quality loss. Apply during this pack's Phase 2 if cumulative budget pressure surfaces.
2. **Bump `maximumFileSizeToCacheInBytes` from 4 MiB to 5 MiB.** Two prior bumps already happened (2 → 4 MiB for Emma assets per `vite.config.ts:93`); a further bump is feasible but adds PWA install-time cost. **Flag for Devon's impl ticket** — measure cumulative pack size at Phase 3 and decide.
3. **Drop `egg` to 8 entries.** Phase 2 fallback per §10 Q1; absent the budget pressure, ship 9.

The first short-i pool (when it ships — see §10 Q5) will face the same compounding cumulative-budget question. **Flag this as an open polish-backlog item: cumulative picture-pack-asset budget review needed before short-i ships.**

### Forbidden-pair declarations (new for this pack)

Three new entries to `wordPack.ts FORBIDDEN_PAIRS`:

1. **`['net', 'bag']`** — both fabric-with-handle objects. Cross-vowel pair (net is short-e, bag is short-a) so they never appear in the same trio under same-vowel-only, BUT this entry guards against future cross-vowel mixing (`86c9m3aek`) accidentally trio'ing them. The mesh-vs-solid discriminator must hold; net's mesh is the load-bearing feature.

2. **`['egg', 'nut']`** — both ovals. Cross-vowel pair (egg is short-e, nut is short-u). Discriminator: egg is smooth-ovoid (no visible texture); nut has a vertical seam line. At 96pt with PNG-embed compression, the seam can collapse. Cheap insurance.

3. **`['egg', 'bun']`** — both round food. Cross-vowel pair (egg is short-e, bun is short-u). Discriminator: egg is smooth-ovoid; bun is round with visible horizontal score-mark. Cheap insurance.

The `[mom, dad]`, `[bus, van]`, `[cat, dog]`, `[pan, pot]`, `[cap, hat]`, `[man, dad]`, `[rug, mat]`, `[tub, cup]` pairs from prior packs stand unchanged.

### Pipeline for the 8 (or 9) short-e pictures

Same 3-phase pipeline as short-u (`design/word-song/short-u-pool-expansion.md` §3, `design/word-song/README.md` Phase model):

| Phase                                             | Owner          | Output | Blocking dependency |
| ------------------------------------------------- | -------------- | ------ | ------------------- |
| 1. Prompt sheet                                   | Kyle (this PR) | [`short-e-picture-pack-prompts.md`](./short-e-picture-pack-prompts.md) — 8 wholly-new prompts (`bed, leg, hen, web, net, jet, gem, egg`) plus 1 conditional re-trace (`pen`, pending Q2) | Short-a pack's `picture-pack-style-anchor.md` — style frame is shared. |
| 2. Midjourney generation + transparent-PNG export | Thomas         | 8 (or 9) source PNGs (≥1024×1024 source, transparent at ~512×512 via remove.bg) — all generated in one MJ session for tier visual cohesion (Q2 lock-dependent on whether `pen` re-trace is in scope) | Phase 1 merged. ~30–60 min MJ generation time at the per-pack cadence Thomas has done before, plus ~5–10 min/asset for remove.bg. If bundled with future short-i pack ("50+ images one-time deal" per dispatch brief), insert these 8-9 into the bundle. |
| 3. PNG-embed integration                          | Devon          | 8 (or 9) `picture-{word}.svg` files at `public/assets/pictures/` via `yarn embed-pictures` + `wordPictures.tsx` switch arm extension if needed | Phase 2 PNGs delivered. The existing `wordPictures.tsx` shared switch arm (per `.claude/docs/skill-trees-and-content.md` §"Rendering pattern post-PR #157") collapses cases into one `<image href>` block; new picture-pack words slot in without case-body code. The 0-1 overwrite for `pen` reuses the existing `wordPictures.tsx` key — no switch-arm change for that. |

**Pack-cohesion lever:** same `--cref` / `--sref` to short-a `dog` pose-zero as short-u used. See [`short-e-picture-pack-prompts.md`](./short-e-picture-pack-prompts.md) §1.3.

---

## 4. Mastery progression flow — graduation through the vowel ladder

This is the canonical hand-off from `cvc-words-short-i` to `cvc-words-short-e`. Mirrors short-u §4 STRUCTURALLY but with one critical addition: **the 2-session-gap rule** (§5) gates short-e introduction such that the standard `pickFocusNode` + `applyMasteryRule` flow does NOT auto-route Marian to short-e the moment short-i masters.

### Stage definitions

```
Session N    : cvc-words-short-i — canonical short-i pool, masters
Session N+1  : (NOT short-e) — any non-short-e session (Leitner review, short-i reinforcement, math-only, etc.)
Session N+2  : (NOT short-e) — any non-short-e session
Session N+3+ : cvc-words-short-e — first short-e session (intro)
```

Compare to short-u §4 (`Session N+1 = first short-u session`). The 2-session-gap is a hard prerequisite for short-e's introduction; it does NOT exist between short-o → short-u or any other vowel transition. See §5 below for the predicate shape and the placement in `mastery.ts` / `focusNode.ts`.

**No graduation probe at the short-i → short-e boundary** (mirroring short-u §4 — the graduation probe verifies generalization within short-a *before* leaving short-a; subsequent vowel-tier transitions are standard mastery-rule plus, for short-e specifically, the 2-session-gap).

This means short-e inherits the short-u flow (with §5's gap-rule prepended):

- After §5's `canIntroduceShortE(progress)` returns `true`, the picker walks past `cvc-words-short-i` (now `mastered`) and lands on `cvc-words-short-e` (now `intro`, post-promotion).
- Emma's session-open chatter introduces the new vowel via the `bed/bid` minimal-pair contrast line (next subsection).
- After the first short-e session, the node moves to `practicing` per the standard intro→practicing rule (`mastery.ts`).

### Picker / planner sequencing

`pickFocusNode` does not change for short-e. It walks `WORD_SONG_NODES_IN_ORDER` and stops at the first non-`mastered` node. The 2-session-gap rule (§5) lives in `mastery.ts`'s promotion logic — it gates whether `cvc-words-short-e` is unlocked from `locked` to `intro` at all, NOT whether the picker chooses it. Once unlocked, the picker routes Marian to short-e normally.

The planner gets one new branch in `WORD_SONG_TRACK_GUIDE`: when `focusNode === 'cvc-words-short-e'`, emit `"Read the <word>."` problems drawn from the 9-word short-e pool (`api/_plannerWordList.ts` adds `WORD_SONG_TARGET_WORDS_SHORT_E = 'bed, leg, hen, pen, web, net, jet, gem, egg'`).

### What is NOT in this flow

- **No "extended cool-down" beyond the 2-session-gap rule** between `cvc-words-short-i` mastery and `cvc-words-short-e` start. The gap is exactly 2 non-short-e sessions; the 3rd qualifying session is the first short-e session.
- **No mixed-vowel sessions.** `cvc-words-short-e` is short-e-only in v1. Cross-vowel mixing is ticket `86c9m3aek` and stays out of v1 (§ 8).
- **No re-test of short-a, short-o, or short-u inside short-e sessions.** The Leitner spaced-review system handles maintenance load (out of scope here; M4 ticket Leitner-for-literacy is downstream of v1).
- **No second graduation probe** at the short-i → short-e boundary. The `cvc-words` graduation probe was the dual-gate verification needed before exiting short-a; subsequent vowel-tier transitions are standard mastery-rule (plus §5 for short-e specifically).
- **No PER-WORD first-encounter scaffolding for individual short-e target words.** Short-o introduced one-time scaffolding for `box`/`fox` because of the `x = /ks/` decoding load. Short-u had none (per its §4). Short-e similarly has none — `egg` retains the 3-letter-spelling-CVC precedent (geminate `gg` = single /g/) but that decoding load is fractional, not load-bearing. The session-1 `bed/bid` minimal-pair opener (next subsection) IS in scope; per-word first-encounter lines are not.

### First-encounter `/ɛ/` vs. `/ɪ/` minimal-pair scaffolding (LOAD-BEARING)

Per Dave's PR #173 §3.2 (line 162-170), the **first short-e session opens with an explicit `/ɛ/` vs. `/ɪ/` minimal-pair contrast line — pre-spec'd verbatim**:

> _"Listen: 'bed' — not 'bid.' Bed! /b/-/ɛ/-/d/. Short 'e' drops your chin a little."_

This is **load-bearing first-encounter scaffolding for /ɛ/–/ɪ/ confusion**, structurally different from short-u's `/u/`-vs-`/ʌ/` opener (which addressed an L1 vowel-inventory gap). The short-e contrast targets the just-consolidated short-i (`/ɪ/`) rather than a Tagalog vowel — Tagalog has /ɛ/-ish allophones [INFERRED] — see PR #173 §3.2 for the SLM-r mechanism rationale: by the time Marian reaches short-e, she has been drilling /ɪ/ for several sessions; her substitution prediction for the new vowel will be the just-recently-consolidated /ɪ/, not a Tagalog phoneme.

**Why `bed / bid` specifically:** Both are CVC words. `bed` is in this pool (§1 entry #1). `bid` is presumed to be in the upstream short-i pool (see §10 Q5 — short-i pool not yet specced). If `bid` is NOT in the short-i pool when it ships, fall back to one of the EnglishClub.com listed minimal pairs (Source 15 in PR #173): `bell/bill, fell/fill, led/lid, pen/pin, ten/tin`. **Pin recommends `pen/pin`** as the secondary option — `pen` is in the short-e pool here (§1 entry #4) and `pin` is a high-frequency short-i CVC. The opener line under that fallback would be: *"Listen: 'pen' — not 'pin.' Pen! /p/-/ɛ/-/n/. Short 'e' drops your chin a little."*

**The mouth-shape mnemonic ("/i/ makes you smile, /e/ drops the chin")** is part of the canonical opener, sourced from PR #173 §3.2 + Source 3 in `phonics-sequence-marian.md`. It is NOT padding — it's the articulation cue Marian leverages to physically distinguish the two phonemes. Inclusion in the opener line is mandatory.

**Where this lands in code:** `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts` gains a short-e branch whose per-problem chatter, when the focus is `cvc-words-short-e` AND it is the first short-e session for this Marian, includes the contrast opener as a baked planner-template constant. The first-short-e-session detection is the same lifetime-once "first time across her career" tracking that short-u and short-o use — short-e rides on the same `Progress.lifetimeFirstEncounters` mechanism (per `.claude/docs/progress-and-persistence.md` §"Lifetime-first-encounter gate"), with `cvc-words-short-e` added to `FIRST_ENCOUNTER_GATED_NODES`.

Subsequent short-e sessions do NOT replay the contrast (per PR #173 §2 — repeated openers cost working memory without benefit). The per-Marian lifetime-once gate handles this.

The artifact that captures the baked line is the canon JSON at `public/canon/word-song/level-1/cvc-words-short-e.json`. AC9b (below, between AC9 and AC10) pins this contract.

### Parser-before-planner reminder (defensive)

Per `project_planner_parser_contract`, the planner-parser contract requires widening the browser parser BEFORE widening the planner. **For this short-e tier no parser change is required** — the cvc-word `"Read the <word>."` template was widened in PR #132; short-e rides on the existing template. The new short-e opener line baked in AC9b is a session-start utterance with utterance-id namespace `word.session-open.*` (Kevin owns the exact id at impl time per `screens-and-flows.md` spec-authoring convention to anchor on stable name primitives, not line numbers); the existing parser's "out-of-namespace ids skip-not-throw" rule (per `.claude/docs/skill-trees-and-content.md` §"Word `planFromServer`") covers cross-screen utterances cleanly. No parser delta needed; the contract is invoked here defensively for the impl-ticket reviewer.

---

## 5. The 2-session-gap rule between short-i mastery and short-e introduction (NEW per-tier scaffolding mechanism)

This section captures the **NEW per-tier scaffolding mechanism** that distinguishes short-e from short-u and short-o. It is the single biggest architectural addition this spec lands.

### Scaffolding rationale

Per `design/research/phonics-sequence-marian.md` (Source 1 — Fairleigh Dickinson, Source 2 — Keys to Literacy, Source 3 — practitioner consensus), the /ɛ/–/ɪ/ pair is the most-confused short-vowel pair in English phonics instruction. Both source-consensus places /e/ LAST in the canonical short-vowel sequence specifically to maximize separation from /i/. The recommended gap is "several weeks, not days" (Source 3, Theliteracynest.com / Thisreadingmama.com).

Translating "several weeks" to Marian's app cadence: at her ~1 session/day rate (per the iPad signal pattern), 2 sessions IS approximately 2 days. That falls short of "several weeks" by an order of magnitude — but the alternative is to gate short-e on a literal real-time wall-clock delay, which:

- Conflicts with the variable-cadence reality of an 8-year-old's app use (some weeks she plays daily; other weeks she misses 5 days).
- Adds wall-clock complexity to `mastery.ts` that the rest of the model doesn't carry (the mastery rule is event-driven on session-end, not time-driven).
- Inverts the success-driven progression model — a child who plays consistently is rewarded with faster progression; a wall-clock gate punishes consistency.

The 2-session-gap rule is the **engineering-tractable approximation** of "several weeks": it ensures Marian has at least 2 non-short-e sessions of consolidation work between short-i mastery and short-e introduction, while staying within the event-driven mastery framework. Those 2 sessions can be (a) Leitner-driven short-i reinforcement, (b) ahead-of-schedule short-i continued practice, (c) Math-only sessions, or (d) any combination — what matters is that short-e is NOT the very next session after short-i masters.

The cost-asymmetry justifies the gate even if "2 sessions" undershoots the practitioner ideal:

- Cost of having the gate: 2 extra non-short-e sessions before Marian sees short-e for the first time. Negligible in the 4-month timeline.
- Cost of NOT having the gate: short-e introduces /ɛ/ immediately after short-i consolidates /ɪ/. The two sounds are the most-confused short-vowel pair in English. /ɛ/–/ɪ/ confusion that anchors at first encounter can persist for months (Source 1) — a real regression risk on the August 2026 literacy goal.

**Evidence confidence: [STRONG]** for the direction of the rule (separation matters). **[INFERRED]** for the specific "2 sessions" magnitude — calibrated to Marian's session cadence and the engineering-tractable framework, NOT pinned by RCT data. If post-deploy ear-test signal shows persistent /ɛ/–/ɪ/ confusion, bumping the gate to 3 or 4 sessions is a one-line change.

### Predicate shape

The new helper lands in `mastery.ts` (or `focusNode.ts` — see "Where it lands in code" below):

```ts
/**
 * Returns true iff short-e is eligible for introduction:
 *   1. cvc-words-short-i is mastered, AND
 *   2. ≥2 non-short-e sessions appear in progress.history AFTER the
 *      session that flipped short-i to mastered.
 *
 * Returns false if short-i has not yet mastered (the standard
 * "still on short-i" case) or if short-i mastered but the gap
 * has not yet elapsed.
 *
 * Source: design/word-song/short-e-pool-expansion.md §5;
 * design/research/phonics-sequence-marian.md Source 1+2+3
 * (Keys to Literacy, Fairleigh Dickinson, practitioner consensus
 * on /e/ placed last in canonical sequence).
 */
export function canIntroduceShortE(progress: Progress): boolean {
  if (progress.skillLevels['cvc-words-short-i'] !== 'mastered') {
    return false
  }
  // Find the index in history where short-i first appeared with
  // mastery-qualifying outcome — this is approximately the session
  // that flipped short-i to mastered. The mastery rule itself is
  // pure-functional, so there's no event-log of WHEN the flip
  // happened; we infer from history.
  const masteryIndex = findShortIMasteryIndex(progress.history)
  if (masteryIndex === -1) return false
  const sessionsAfter = progress.history.slice(masteryIndex + 1)
  const nonShortESessions = sessionsAfter.filter(
    e => !e.skillFocus.includes('cvc-words-short-e')
  )
  return nonShortESessions.length >= 2
}
```

The helper `findShortIMasteryIndex` is implementation detail — Kevin's call. The simplest approach: walk `progress.history` looking for the first entry whose `skillFocus` includes `cvc-words-short-i` AND whose `successRate >= masteryThreshold` AND for which the entry IS the 3rd-of-3 qualifying entries. Alternatively, add a `masteredAt: { [node]: dateISO }` field to `Progress` (additive, no schemaVersion bump — same precedent as `parentSettings`, `pendingPromotion`, `lifetimeFirstEncounters`). The latter is cleaner; flag it as part of Kevin's impl spec decision.

### Where it lands in code

Two viable placements:

| Placement | Pros | Cons |
| --------- | ---- | ---- |
| `mastery.ts` | The mastery rule already controls promotions; gating short-e at promotion time keeps `pickFocusNode` simple. The rule reads `progress.history` already. | Requires `applyMasteryRule` to gate the `locked` → `intro` transition specifically for `cvc-words-short-e` (a per-node special case). |
| `focusNode.ts` | Keeps `mastery.ts` per-node-uniform. `pickFocusNode` skips short-e if the gap hasn't elapsed; falls back to short-i practicing. | If short-i is `mastered`, falling back to short-i would re-teach a mastered node, which violates the "first non-mastered node" walking rule. Requires more invasive picker changes. |

**Recommendation: `mastery.ts`.** The promotion of short-i → mastered AND the unlock of short-e (`locked` → `intro`) happens in the same `applyMasteryRule` call today. The rule already special-cases `cvc-words` for the graduation gate (per `mastery.ts`). Adding a `cvc-words-short-e`-specific gate next to the graduation gate is a natural extension.

The flow inside `applyMasteryRule` becomes:

1. Standard per-node walk (unchanged).
2. When considering the `'practicing' → 'mastered'` flip for `cvc-words-short-i`:
   - Apply standard rule (90/3 cross-day-deduped).
   - If it qualifies, mark short-i as mastered as usual.
3. When considering the `'locked' → 'intro'` unlock of `cvc-words-short-e`:
   - **NEW:** Check `canIntroduceShortE(progress)`. If false, **skip the unlock** (leave short-e as `'locked'`). Re-evaluate on every subsequent session-end's mastery rule call.
   - If true, proceed with the standard unlock.
4. Continue.

The picker (`pickFocusNode`) stays unchanged — it sees `cvc-words-short-e` as `'locked'` until the gap elapses, walks past it. Until that point, Marian's path stops at the next-after-short-i `'practicing'` node (in v1, that's `digraphs` if short-e was the only short-i-downstream node; but if short-e is between short-i and digraphs in `WORD_SONG_NODES_IN_ORDER`, the picker would route to `digraphs` instead — see §10 Q5 for ordering).

**Edge case:** if Marian completes short-i mastery and immediately misses 2+ days (no app sessions), then returns. On her first return session, `progress.history` shows short-i mastery in entry N (older) and the current session is N+1 with no intervening entries. Per the predicate, `canIntroduceShortE(progress)` returns `false` because `nonShortESessions.length === 0` (no sessions between mastery and now). The current session is then routed to short-i Leitner (or whatever the next-non-mastered node is); after that session, `nonShortESessions.length === 1`. After her next session, `length === 2`, and the next session after that flips short-e to `intro`. This is the intended behavior — the gap is measured in sessions-played, not wall-clock time, so a multi-day absence does NOT shortcut the gap.

### Naming / discoverability

The helper name `canIntroduceShortE` is intentionally specific to the short-e tier rather than generic (e.g. `canIntroduceVowelTier`). This is a per-tier scaffolding mechanism with a SPECIFIC pedagogical justification (Keys to Literacy + Fairleigh Dickinson + practitioner consensus on /e/–/i/ confusion). Generalizing the helper to "next vowel after this one" would invite future misuse (someone applying it to short-u → short-i transitions where it's NOT applicable — the literature flags only /e/–/i/ as load-bearing). Specificity here is a feature.

If future research surfaces ANOTHER vowel-pair gap rule, file it as a NEW helper (e.g. `canIntroduceShortI` if a short-u → short-i gap is ever motivated). Don't generalize the existing helper retroactively.

### Acceptance criterion alignment

The 2-session-gap rule lands as **AC10b** in §9 below — between AC10 (standard mastery rule) and AC11 (no regression). Mirroring how AC9b sits between AC9 and AC10 for the first-encounter opener.

---

## 6. Avoiding phonetic confusion with short-i, short-u, short-o, and short-a

Cross-vowel confusion audit, per the brief AC1, §1 audit, and the load-bearing /ɛ/–/ɪ/ concern:

### vs. short-i (the load-bearing concern — gated by §5's 2-session-gap rule)

Short-i pool is not yet specced (§10 Q5). Probable members per `phonics-sequence-marian.md` §Application: `pig, sit, hit, lip, tin, bin, wig, dip, fin, kit`. Plus from EnglishClub.com /ɛ/–/ɪ/ minimal-pair list: `bid, bill, fill, lid, pin, tin`.

| short-i (presumed) | short-e | Risk |
| ------------------ | ------- | ---- |
| pig | leg | Both anatomy / animal mix. **Low risk** — pig has snout + curly tail; leg is single elongated limb. Different shapes. |
| sit | pet (REJECTED from short-e pool) | n/a — not in pool. |
| hit | jet | Cross-onset, cross-coda. **No risk.** |
| lip | gem | Cross-category. **No risk.** |
| tin | pen | **MINIMAL-PAIR** — same coda /n/, similar onsets (t/p alveolar/labial). Cross-vowel rule keeps them apart in trios but cross-pack visual hygiene matters. Tin is metal can; pen is writing tool. Different categories. **Low risk** with same-vowel constraint. |
| bin | hen | Both end in /n/. Bin is rectangular trash receptacle; hen is animal. Different categories. **Low risk.** |
| wig | egg | Wig is hair-piece; egg is food/oval. Different. **No risk.** |
| dip | (no short-e match) | n/a |
| fin | hen, pen | Fin is fish-fin; hen is bird; pen is writing tool. Different categories. **Low risk.** |
| kit | jet | Kit is set-of-things (abstract — likely not in short-i pool either); jet is plane. **No risk.** |
| bid | bed | **MINIMAL-PAIR — load-bearing** (§4 first-encounter opener uses this contrast). Cross-vowel + same-vowel-only rule keeps them out of trios. The opener IS the intervention. |
| pin | pen | **MINIMAL-PAIR** — fallback opener pair if `bid` isn't in the short-i pool (§4). Cross-vowel + same-vowel-only rule keeps them apart in trios. |
| lid | bed | Cross-onset /b/-/l/, similar codas. **Low risk.** |

**Summary:** the /ɛ/–/ɪ/ minimal-pair concern is REAL but addressed by:
1. The §5 2-session-gap rule (Marian's /ɪ/ has time to consolidate before /ɛ/ enters).
2. The §4 `bed/bid` (or `pen/pin` fallback) first-encounter opener.
3. The same-vowel-only distractor rule (§ 8).

**No new FORBIDDEN_PAIRS for short-i collisions** — the pair-level audit doesn't surface picture-side silhouette collisions (the confusion is acoustic/decoding, not visual). The §5 rule and the §4 opener handle it.

### vs. short-u (recently shipped)

| short-u | short-e | Risk |
| ------- | ------- | ---- |
| sun | gem | Both small geometric shapes. Sun has rays (radiating triangles); gem has facets (geometric crystal). Different patterns. **Low risk.** |
| cup | bed | Cup is handled vessel; bed is rectangular furniture. Different categories. **No risk.** |
| bus | jet | Both vehicles. Bus is ground vehicle (wheels + windows); jet is aircraft (wings + tail). Different categories. **Low risk.** |
| bug | hen | Bug is insect; hen is bird. Different animal classes. **Low risk.** |
| nut | egg | **HIGH same-silhouette risk.** Both ovals. Nut has vertical seam; egg is smooth-ovoid. Cross-vowel rule keeps them apart in trios but cross-pack visual hygiene matters. **NEW FORBIDDEN_PAIR `[egg, nut]` added (§3 + §5).** |
| tub | bed | Both household. Tub is footed open vessel; bed is on legs with pillow + headboard. Different shapes. **Low risk.** |
| bun | egg | **HIGH same-silhouette risk.** Both round food. Bun has horizontal score; egg is smooth-ovoid. Cross-vowel + cross-pack hygiene. **NEW FORBIDDEN_PAIR `[egg, bun]` added (§3 + §5).** |
| jug | net | Jug is handled vessel with spout; net is mesh-with-handle. Different surfaces (solid vs. mesh). **Low risk.** |
| rug | bed | Rug is flat floor covering; bed is furniture-on-legs. Different shapes. **Low risk.** |
| hut | bed | Hut is dwelling with roof + walls + door; bed is furniture-on-legs with pillow + headboard. Different shapes. **Low risk.** |
| gum | gem | Gum is wrapped rectangular package; gem is geometric crystal. Different shapes. **Low risk.** |

### vs. short-o

| short-o | short-e | Risk |
| ------- | ------- | ---- |
| dog | hen | Mammal vs. bird. Different. **Low risk.** |
| mop | net | Mop has fringe-end + handle; net has mesh + handle. Both handled-cleaning-or-fishing-tools. Discriminator: mop's fringe is solid hair-like strands at one end; net's mesh is open weave throughout. **Low-moderate risk** but cross-pack visual hygiene generally holds. |
| log | leg | Both elongated cylinders. Log has bark texture + horizontal orientation; leg is smooth + vertical (chair-leg) or thin (body-leg). Cross-vowel rule keeps them apart in trios. **Low risk** with the chair-leg framing. |
| pot | jet | Pot is deep cylinder + side handles; jet is aircraft. Different. **No risk.** |
| box | bed | Both rectangular volumes. Box is closed cuboid + tape; bed is open-top + pillow + headboard. Different fills. **Low risk.** |
| fox | hen | Mammal vs. bird. Different. **Low risk.** |
| mom | hen | Mom is parent-with-child composition; hen is bird. Different. **No risk.** |
| hot | jet | Hot is steaming bowl; jet is aircraft. Different. **No risk.** |

### vs. short-a (canonical 14)

| short-a | short-e | Risk |
| ------- | ------- | ---- |
| cat | hen | Both animals but cat is mammal, hen is bird. Different categories. **Low risk.** |
| hat | gem | Hat is wearable; gem is jewel. Different. **Low risk.** |
| bat | bed | Bat is mammal/animal; bed is furniture. Different. **No risk.** |
| mat | net | **MODERATE** — both flat-fabric-ish objects. Mat is plain rectangular floor covering; net is mesh-with-handle. Different surfaces (solid vs. mesh). Cross-pack hygiene important. **No new FORBIDDEN_PAIR needed** — the mesh-vs-solid discriminator is robust. |
| bag | net | **HIGH same-silhouette risk** — both fabric-with-handle objects. Bag is solid tote with handle; net is mesh-with-handle. Discriminator: mesh-vs-solid is the load-bearing feature. **NEW FORBIDDEN_PAIR `[net, bag]` added (§3 + §5).** |
| fan | leg | Fan is pedestal/desk fan; leg is elongated single shape. Different. **Low risk.** |
| man | hen | Man is human figure; hen is bird. Different. **No risk.** |
| pan | net | Pan is shallow disc + horizontal handle; net is mesh + handle. **Low risk** — pan is solid; net is mesh. |
| cap | hen | Cap is wearable; hen is bird. Different. **No risk.** |
| can | gem | Can is cylinder + ring-pull; gem is crystal. Different. **No risk.** |
| tag | bed | Tag is small paper-card with string; bed is furniture. Different. **No risk.** |
| dad | hen | Dad is parent-with-child composition; hen is bird. Different. **No risk.** |
| jam | egg | Jam is jar with red contents; egg is smooth-ovoid. Different. **No risk.** |
| van | jet | Both vehicles. Van is ground vehicle; jet is aircraft. Different categories. **Low risk.** |

### vs. probe-pack (4 novel short-a probes)

| probe | short-e | Risk |
| ----- | ------- | ---- |
| nap | bed | Both sleep/rest associated. Nap is sleeping figure under blanket (composition with figure); bed is empty furniture. Different compositions. **Low risk.** |
| rat | hen | Both small animals but rat is mammal-with-tail, hen is bird-with-comb. Different categories. **Low risk.** |
| map | net | Both flat-rectangular paper-or-fabric objects. Map has continents/landmasses; net has open mesh weave. Different surface. **Low risk.** |
| tap | jet | Tap is faucet; jet is aircraft. Different categories. **No risk.** |

### Summary: forbidden-pair additions

Three new entries to `wordPack.ts FORBIDDEN_PAIRS`:

```ts
['net', 'bag'],   // ticket TBD — fabric-with-handle objects, mesh-vs-solid discriminator
['egg', 'nut'],   // ticket TBD — both ovals, smooth-vs-seam discriminator
['egg', 'bun'],   // ticket TBD — both round food, smooth-vs-score discriminator
```

The `[mom, dad]`, `[bus, van]`, `[cat, dog]`, `[pan, pot]`, `[cap, hat]`, `[man, dad]`, `[rug, mat]`, `[tub, cup]` pairs from prior packs stand unchanged. Total `FORBIDDEN_PAIRS` size after this pack: **11 entries**.

---

## 7. Canon-bake plan

Following PR #135 / PR #155 / PR #174's pattern, `cvc-words-short-e` needs a baked canon JSON to keep cold-start session-fetch under 500ms.

### File path

`public/canon/word-song/level-1/cvc-words-short-e.json` — mirrors the existing `public/canon/word-song/level-1/cvc-words-short-u.json` (audited 2026-05-09 post-PR-#174 ship).

### Bake-list addition

`scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` currently lists (post-PR-#174):

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
]
```

Append `'cvc-words-short-e'` (assuming short-i lands first per §10 Q5):

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',  // upstream of short-e; assumed to land before this PR
  'cvc-words-short-e',
]
```

The `generateSessionCanon.test.ts` regression test pins this list against `_planner.ts VALID_WORD_SONG_FOCUS_NODES` — the planner change has to land in the same PR for CI to stay green.

### Bake cost

Per `scripts/generateSessionCanon.ts` header §Cost: ~1 Haiku call + ~59 Azure TTS S0 calls per combo. Adding one combo (level-1 × cvc-words-short-e × childName="Marian"):

- Haiku: ~$0.005–$0.01 per combo (input + output ~2k tokens).
- Azure TTS S0: ~59 short utterances × ~50 chars ≈ 2.9k chars × $16/1M chars ≈ $0.05.
- **Total: ~$0.05–$0.06 per bake regen for this one combo.** Same ballpark as short-o/short-u.

Well within `project_anthropic_billing_constraint`.

### Bake trigger

A canon regeneration is required when:

- The planner system prompt changes the short-e word list, problem template, or chatter shape.
- Emma's voice config changes (rare).
- The first-short-e-session Emma intro line is finalised (per §4 — the `bed/bid` minimal-pair contrast lands as a planner-template constant baked into canon).

The first regen happens with the impl PR (Kevin's). Subsequent regens are part of normal canon hygiene (`project_canon_commit_strategy`).

---

## 8. Out of scope / cross-vowel mix preview / what this spec does NOT propose

Per the brief's posture, explicitly listing out-of-scope items so they don't get conflated:

### Out of scope (deferred to other tickets)

- **Cross-vowel distractor mixing** (e.g. mixing short-a, short-o, short-u, or short-i chips with short-e targets) — out of v1 per `short-o-pool-expansion.md` §8 + `short-u-pool-expansion.md` §8. Tracked as ticket `86c9m3aek`.
- **Novel-pool word changes** — no changes to the 4 novel-pool short-a probes (`nap, rat, map, tap`). Those serve the `cvc-words` graduation gate ONLY. No equivalent novel-pool gate is needed for short-i → short-e transition; the §5 2-session-gap rule serves a different (consolidation-pacing, not generalization-verification) purpose.
- **Changes to short-a, short-o, short-u, or short-i pools** — all upstream pools are locked. This spec adds short-e as a new sibling tier; existing tiers are not modified.
- **Picture-pack work for short-i** — short-i is upstream of short-e in `WORD_SONG_NODES_IN_ORDER` and gets its own pool-expansion spec (see §10 Q5).
- **Picture-pack work for digraphs, sight-words, simple-sentences** — downstream of short-e; out of v1 per `parser-widening-plan.md` §"Future tiers".
- **React component changes** — Kevin handles canon + planner + sibling-node wiring + the new `canIntroduceShortE` helper AFTER this spec lands. Devon handles `wordPack.ts` entries + picture-embedding via `yarn embed-pictures` AFTER Thomas's MJ pass. The existing `cvc-words` / `cvc-words-short-o` / `cvc-words-short-u` screen renders short-e unchanged.
- **Wider literacy-tree expansion** — `digraphs`, `sight-words`, `simple-sentences` stay as `letter-sounds`-style stubs in the planner per `parser-widening-plan.md` §"Future tiers." Out of v1.
- **Audio-before-text "silent text window" intervention** — separate Kyle ticket; not blocking this spec.
- **First-encounter Emma scaffolding for individual short-e words** — short-e has no decoding-load words analogous to short-o's `box`/`fox` (per §4). The vowel-introduction line at session-open (the `bed/bid` minimal-pair) is the only scaffolding for the tier as a whole. **Note:** the `bed/bid` minimal-pair opener IS in scope — see §4 + AC9b.
- **`/ɛ/` vs. `/ɪ/` minimal-pair drills BEYOND the first-session opener** — repeated drill sessions for /ɛ/–/ɪ/ discrimination are future work post-v1, per PR #173 §2 (lifetime-once dose recommendation; repeated openers cost working memory without benefit). The single first-encounter opener line baked into the canon is in scope (§4); a recurring drill program is not.
- **Leitner-for-literacy** — math facts have a Leitner box (M4); literacy spaced-repetition is downstream. Out of scope.
- **Probe-word picture pack for short-e** — N/A. The graduation-probe gate exists only for `cvc-words` (short-a → short-o). No probe pack needed for any later vowel-tier transitions.
- **Cumulative PWA cache budget** — the ~4.6 MB cumulative picture-pack budget is at or above the current 4 MiB cache cap. Mitigation paths (PNG compression, cap bump, drop `egg`) are flagged in §3 §Cumulative budget but the resolution is Devon's call at impl time. Not a design blocker.

### Cross-vowel mix preview (tracking only, not scope)

Per Dave's review §6 P2: cross-vowel distractors test vowel discrimination ("a different and slightly harder skill, which is appropriate once short-a is consolidated"). **Once Marian has consolidated all five short vowels (short-a + short-o + short-u + short-i + short-e all `mastered`), cross-vowel mixing becomes pedagogically apt as a generalization layer over the entire CVC tier.** Until then, same-vowel-only is the right v1 posture.

The matrix expansion to support cross-vowel distractors is mechanical once the design lands — `TARGET_PAIRINGS` rows can carry cross-vowel distractor entries, and `wordDistractors.ts` already supports it because the distractor functions read directly from the matrix. The constraint is design-level, not engineering-level.

The /ɛ/–/ɪ/ pair is the one cross-vowel pair where mixing carries the LARGEST pedagogical risk (per §5 + PR #173 §3.2). When the cross-vowel mixing ticket fires, it should explicitly NOT mix short-e and short-i in the same trio — flag this for the future ticket's design surface.

---

## 9. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them. Mirrors short-u spec §9 with two additions: AC9b for the first-encounter opener (mirrors short-u AC9b) and AC10b for the new 2-session-gap rule (NEW for short-e).

- [ ] **AC1.** `WordSongNode` union in `src/lib/progress/types.ts` includes `'cvc-words-short-e'`. `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER` both have `'cvc-words-short-e'` between `'cvc-words-short-i'` and `'digraphs'`. (Assumes `cvc-words-short-i` is upstream and has been added in a prior PR — see §10 Q5.)
- [ ] **AC2.** `api/_planner.ts WORD_SONG_TRACK_GUIDE` adds a `cvc-words-short-e` branch emitting `"Read the <word>."` problems from the 9-word short-e pool. The 9 words match this spec §1 final pool exactly. `VALID_WORD_SONG_FOCUS_NODES` and `WORD_SONG_FIRST_CLASS_FOCUS_NODES` both gain the new node.
- [ ] **AC3.** `api/_plannerWordList.ts` exports a new `WORD_SONG_TARGET_WORDS_SHORT_E` constant matching the 9 words from §1 (`'bed, leg, hen, pen, web, net, jet, gem, egg'`). The smoke test in `claude.test.ts` is extended to assert short-e words round-trip.
- [ ] **AC3b.** `api/_plannerWordList.ts WORD_SONG_DISTRACTOR_HINTS` gains a short-e rhyme-family block — same structural shape as the existing short-a + short-u blocks. New short-e entries (all 6 lines ship):
  - `/ɛd/ rhyme family: bed.`
  - `/ɛg/ rhyme family: leg, egg — pack these in the trap window when one is the target.`
  - `/ɛn/ rhyme family: hen, pen — pack these in the trap window when one is the target.`
  - `/ɛb/ rhyme family: web.`
  - `/ɛt/ rhyme family: net, jet — pack these in the trap window when one is the target.`
  - `/ɛm/ rhyme family: gem.`
    The constant is conditioned on focus-node track at prompt-render time so short-a / short-o / short-u / short-i sessions don't see short-e rhyme hints (and vice versa). Source: §1 phonetic-spread table — the table already enumerates the rhyme families; this AC surfaces the data as an explicit planner-prompt artifact. The three rhyme-family doublets (`/ɛg/`, `/ɛn/`, `/ɛt/`) benefit from explicit Haiku ordering guidance the way short-a's `/æt/` family does today.
- [ ] **AC4.** `src/screens/WordSong/wordPack.ts` adds 9 short-e entries: 8 new (`bed, leg, hen, web, net, jet, gem, egg`) plus 1 promoted-from-distractor (`pen` flips `isTarget: true`). The 1 promoted entry also retains its old role (still pickable as distractor when the focus is short-a, short-o, short-u, or short-i) — `isTarget: true` and distractor-pool membership are independent flags. Mirrors the short-u + short-o pattern.
- [ ] **AC5.** `wordPack.ts FORBIDDEN_PAIRS` adds three entries: `['net', 'bag']`, `['egg', 'nut']`, `['egg', 'bun']` (all per §3 / §6).
- [ ] **AC6.** `wordPack.ts TARGET_PAIRINGS` adds 9 entries for the short-e targets, drawing distractors from the short-e pool only (same-vowel constraint per §8). Defensive-audit step: each row passes `assertNotForbidden` against `FORBIDDEN_PAIRS` after the new entries land.
- [ ] **AC7.** 8 SVG picture assets at `public/assets/pictures/picture-{bed,leg,hen,web,net,jet,gem,egg}.svg` via Thomas's MJ → remove.bg → `yarn embed-pictures` pipeline (Path 2). `wordPictures.tsx` resolves all 9 short-e keys without hitting the inline-SVG fallback. If Q2 = re-trace `pen`, add the `pen` overwrite to AC7's scope (total: 8 wholly-new + 1 overwrite). Phase 2 fallback if `egg` picture is unstable: drop to 8 (7 wholly-new + 0-1 overwrites).
- [ ] **AC8.** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` includes `'cvc-words-short-e'` (and `'cvc-words-short-i'` if not already added by upstream short-i PR). `generateSessionCanon.test.ts` regression stays green.
- [ ] **AC9.** Canon JSON ships at `public/canon/word-song/level-1/cvc-words-short-e.json` after a fresh bake. The PWA cold-start session-fetch for short-e is under 500ms (matches the existing short-o / short-u canon-hit benchmark).
- [ ] **AC9b.** Emma's session-1 opener for `cvc-words-short-e` includes a `/ɛ/` vs. `/ɪ/` minimal-pair contrast line — *"Listen: 'bed' — not 'bid.' Bed! /b/-/ɛ/-/d/. Short 'e' drops your chin a little."* — baked into `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts` as a planner-template constant for the short-e tier (same shape as short-u's AC9b `sun`/`soon` first-encounter scaffolding mechanism). The line emits ONLY when the focus is `cvc-words-short-e` AND it is the first short-e session for this Marian; subsequent short-e sessions skip it. The "first time across her career" detection mechanism is shared with the short-u opener mechanism via `Progress.lifetimeFirstEncounters` (per `.claude/docs/progress-and-persistence.md` §"Lifetime-first-encounter gate") — `cvc-words-short-e` is added to `FIRST_ENCOUNTER_GATED_NODES`. Fallback opener (if `bid` is NOT in the upstream short-i pool when it ships): use `pen/pin` per §4 — *"Listen: 'pen' — not 'pin.' Pen! /p/-/ɛ/-/n/. Short 'e' drops your chin a little."* The opener is captured as part of the canon JSON at AC9 and loaded as a session-start utterance the same way other Emma chatter is. Source: `design/research/short-u-minimal-pair-and-future-vowel-openers.md` §3.2 [INFERRED]; cross-doc reference: §4 of this spec.
- [ ] **AC10.** `src/lib/progress/mastery.ts applyMasteryRule` promotes `cvc-words-short-e` from `practicing` to `mastered` under the same per-track word-song threshold (default 90/3) used for `cvc-words` and `cvc-words-short-o` and `cvc-words-short-u` — no special-casing on the 90/3 rule itself. The downstream `digraphs` node moves from `locked` to `intro` on promotion.
- [ ] **AC10b. (NEW for short-e — the 2-session-gap rule per §5.)** `src/lib/progress/mastery.ts` exports a new helper `canIntroduceShortE(progress: Progress): boolean` that returns `true` iff `progress.skillLevels['cvc-words-short-i'] === 'mastered'` AND ≥ 2 entries in `progress.history` AFTER the short-i mastery flip do NOT include `'cvc-words-short-e'` in their `skillFocus`. The `applyMasteryRule` flow integrates this helper specifically for the `'locked' → 'intro'` unlock of `cvc-words-short-e`: when the standard rule WOULD unlock short-e, apply `canIntroduceShortE(progress)` first; if false, leave short-e at `'locked'` and re-evaluate on the next session-end. The pickFocusNode behavior is unchanged — short-e simply remains `locked` (and skipped) until the gap elapses. Unit-test coverage: (a) short-i not yet mastered → false, (b) short-i just mastered + 0 sessions after → false, (c) short-i mastered + 1 non-short-e session after → false, (d) short-i mastered + 2 non-short-e sessions after → true, (e) short-i mastered + 2 short-e-tagged sessions after (impossible in production but defensive) → false. Pin the helper name; if Kevin chooses a different name in impl review, document the decision in the impl PR. Source: §5 of this spec; Keys to Literacy + Fairleigh Dickinson + practitioner consensus on /e/–/i/ confusion; `phonics-sequence-marian.md` Sources 1+2+3.
- [ ] **AC11.** No regression on existing `cvc-words` (short-a), `cvc-words-short-o`, `cvc-words-short-u`, or `cvc-words-short-i` sessions. Snapshot of `cvc-words.json`, `cvc-words-short-o.json`, `cvc-words-short-u.json`, `cvc-words-short-i.json` canon stays unchanged across the short-e-adding PR.
- [ ] **AC12.** Planner-output regression tests (`api/_planner.test.ts` + `src/screens/WordSong/plannerRoundTrip.test.ts`) cover: (a) `cvc-words-short-e` focus emits 8 short-e problems, (b) every problem's read line matches `"Read the <word>."` and the word is in the short-e pool, (c) no short-a, short-o, short-u, or short-i words leak into short-e sessions in v1, (d) every target.vowel === 'e', (e) every target resolves a gentle + trap distractor pair without throwing, (f) distractors stay inside the short-e pool (same-vowel rule).
- [ ] **AC13.** New e2e regression spec `e2e/cvc-words-short-e-regression.spec.ts` mirrors `cvc-words-short-u-regression.spec.ts` — 8 tests covering debug-seed routing, planner request shape, read-line caption, chip render, advance, 8-tap walk, focus persistence, same-vowel-only distractor policy lock. **Plus a 9th test covering the §5 2-session-gap rule:** seed `cvc-words-short-i: 'mastered'` AND 0 sessions in history after, then run a session — assert `cvc-words-short-e` stays `locked` and the picker routes to whatever the next non-mastered node is. Then add 2 non-short-e history entries and re-run — assert `cvc-words-short-e` flips to `intro`. WebKit `test.skip` from test 3 onward (read-aloud-dependent), per `.claude/docs/testing-and-ci.md` §8.3.1.
- [ ] **AC14.** `e2e/_helpers/seedStorage.ts DEFAULT_SKILL_LEVELS` adds `'cvc-words-short-e': 'locked'` (mirrors `SKILL_NODES` widening rule per `.claude/docs/testing-and-ci.md` §4.1.1). `defaults.ts SCHEMA_FLOOR_NODES` also gains the entry per the **five-place sync rule** (`.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`"). `cloudSync.ts`'s private `withDefaultedSkillLevels` mirror handles the entry automatically (place 5 walks `defaultLockedSkillLevels()` so no explicit edit needed there per the post-PR-#174 simplification — but verify the parity test still passes).
- [ ] **AC15.** Debug seed `cvc-words-short-e` added to `src/lib/debug/debugSeed.ts SEEDS` table — marks `letter-names`, `letter-sounds`, `blending-cv`, `cvc-words`, `cvc-words-short-o`, `cvc-words-short-u`, `cvc-words-short-i` all as `'mastered'`; adds 2 non-short-e history entries (so the §5 gap is satisfied at seed time); sets `cvc-words-short-e` to `'practicing'`. Skips Greet (sessionCount → 1). Mirrors the `cvc-words-short-u` seed plus the gap-rule satisfaction. **Bonus seed `cvc-words-short-e-gap-pending`:** marks short-i as `mastered` with 0 non-short-e sessions after, so QA can verify the gate fires correctly in the locked state (mirrors `cvc-words-graduation-ready` pattern).

---

## 10. Open questions for Thomas

**Q1. Pool size — 9 vs. drop `egg` to 8 vs. force a 10th.** The 9-word pool (`bed, leg, hen, pen, web, net, jet, gem, egg`) is the audit-derived strongest pool. Mass-noun-style risk on `egg` is mitigated via the 3-letter-spelling-CVC precedent from short-o `box`/`fox`; egg is universally listed as short-e CVC. Alternative is dropping `egg` to 8 (an `[egg, nut]` + `[egg, bun]` collision audit risk but solvable with the FORBIDDEN_PAIRS adds in §5 per the cheap-insurance-favours-add-now logic). Forcing a 10th would drag in a weak entry (`bell` CVCC violation, `den` picture-instability, `peg` antique-vocab). Recommendation: ship 9. Phase 2 fallback to 8 (drop `egg`) stays documented as the contingency if Thomas finds the smooth-ovoid read unstable at 96pt during MJ review. **Decision needed for §1 lock and §3 prompt-sheet scope.**

**Q2. Re-trace `pen` for cohesion?** The existing `picture-pen.svg` from PR #157 is hand-authored short-a-pack style. Now that `pen` is a short-e target, options:
- **Option A: re-trace alongside the 8 new MJ generations** (mirrors short-u Q2 lock A on `sun, cup, bus`). Pack-cohesion within short-e tier wins; cost = 1 extra MJ generation in Thomas's pass.
- **Option B: defer re-trace** — keep the existing PR #157 `pen` for v1; pick it up in a future cohesion pass. Lower MJ cost; visual minor inconsistency (short-e pack has 8 new + 1 vintage-style chip).

Recommendation: same as short-u — Thomas's preference for tier visual cohesion likely points to Option A. **Decision needed for AC7 scope and the §3 prompt-sheet entry-count.**

**Q3. `leg` framing — body-leg vs. chair-leg vs. table-leg.** Body-leg fragmentation read risk: a single human leg disconnected from a body reads as "leg" fragment-of-body, which can be visually unsettling for an 8yo (especially because body-fragments are a horror-imagery attractor in MJ generations even at low thresholds). Chair-leg or table-leg framing avoids this entirely — the leg is the leg of an object. Recommendation: chair-leg (single chair-leg in cross-section view, with the seat/leg-junction visible as the contextual cue that this is a furniture leg, not a body part). Sub-question: Phase 2 if MJ produces chair-leg with too much chair-context, drift toward table-leg or vice versa. **Flag for the §3 picture-pack prompt sheet's per-row note.**

**Q4. Distractor-only short-e entries — Reading A vs. Reading B.** Same audit shape as short-u Q4: Reading A (additional distractor-only entries beyond the 9 targets) doesn't yield 8 strong candidates per the §2 audit (`bell` CVCC, `den` picture-instability, `peg` antique-vocab, `pet` collision, `ten` abstract). Reading B (the 9 targets serve as both target list and distractor pool) is structurally consistent with short-u + short-o §8. **Recommendation: lock Reading B.** Decision needed for AC4 + AC6 scope.

**Q5. Short-i pool is upstream of short-e but not yet specced — does this spec land before or after the short-i pool spec?** This is the BIGGEST sequencing question. Three options:
- **Option A: Short-i spec ships first, short-e spec ships second.** This is the canonical order per `WORD_SONG_NODES_IN_ORDER` and the §5 2-session-gap rule which assumes short-i is in production. Thomas runs short-i picture pack, Kevin ships short-i tier, THEN this short-e spec lands cleanly. The §5 helper assumes short-i mastery as a precondition, which is not true if short-i isn't yet a tier.
- **Option B: Short-e spec lands first as a forward-looking design surface, but the IMPL ticket does NOT ship until short-i has shipped.** This is what this spec assumes by default. Risk: spec sits idle for weeks/months until short-i lands.
- **Option C: Bundle short-i + short-e specs together (Kyle authors both in parallel).** Risk: doubles the spec scope; Kyle's bandwidth and review load increases. The structural learnings from this spec carry to short-i (most of the audit pattern transfers), so the bundling cost is sub-additive but real.

**Recommendation: Option B (this spec's default).** The short-e spec lands now as a forward-looking design surface; impl is gated on short-i tier shipping first. PR #173 §3.2 explicitly recommended pre-spec'ing both short-i and short-e, which this Q5 honors. **Decision needed for the impl-ticket sequencing in Matt's filing.**

**Q6. Cumulative PWA cache budget pressure.** Per §3, the cumulative picture-pack budget after this pack ships is at or slightly above the 4 MiB cap. Three mitigation paths exist:
- **Option A: aggressive PNG compression at remove.bg export** (drop to 384×384 source resolution).
- **Option B: bump `maximumFileSizeToCacheInBytes` from 4 MiB to 5 MiB.** Two prior bumps already happened.
- **Option C: drop `egg` to land at 8 entries.**

Recommendation: lean Option A, fall back to Option B if Phase 3 measurement shows budget overrun. **Decision can defer until Devon's impl PR measures cumulative pack size; flag for impl ticket attention.**

All six Qs need Thomas/Matt input before this spec is fully locked. AC items reflect the recommendations.

---

## 11. Provenance

- **Triggering doc:** Dispatch brief from Matt (this PR's design surface).
- **Vowel sequence:** `design/research/phonics-sequence-marian.md` §Q1 (`o → u → i → e` revised order, locked 2026-04-26 by Dave).
- **Word-list source:** Big City Readers (source 5 in phonics doc), `design/research/phonics-sequence-marian.md` §Application short-e list (`bed, hen, leg, net, pen, red, ten, den, get`), Brief's expanded list (`bed, red, leg, peg, hen, ten, men, pen, web, jet, bell, vet, net, set, get, pet, met, yet, wet`), EnglishClub.com /ɛ/–/ɪ/ minimal-pair list (Source 15 in PR #173 — `bed, bell, fell, led, pen, ten`). Audit drove the 9-word final pool.
- **First-encounter opener line:** `design/research/short-u-minimal-pair-and-future-vowel-openers.md` §3.2 — Dave's pre-spec'd `bed/bid` opener verbatim.
- **2-session-gap rule rationale:** `design/research/phonics-sequence-marian.md` §Q1 + Source 1 (Fairleigh Dickinson) + Source 2 (Keys to Literacy) + Source 3 (practitioner consensus on /e/–/i/ separation; "several weeks, not days"). Dave's PR #173 §3.2 names the gap as the LAST single-vowel-tier intervention.
- **Predecessor specs:**
  - `design/word-song/short-u-pool-expansion.md` (structural template — this spec mirrors it section-by-section).
  - `design/word-song/short-u-picture-pack-prompts.md` (companion MJ prompt sheet template).
  - `design/word-song/short-o-pool-expansion.md` (additional template reference).
  - `design/word-song/parser-widening-plan.md` (parser-first contract — N/A here, parser already widened).
  - `design/word-song/picture-pack-style-anchor.md` (style frame, locked).
  - `design/word-song/picture-pack-iteration-plan.md` (workflow — Path 2 PNG-embed for this pack).
  - `design/word-song/probe-word-picture-pack.md` (sibling per-vowel pack reference).
- **Locked memories:**
  - `project_planner_parser_contract` (parser before planner — N/A, parser already accepts the cvc-word template).
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — this pack ships PNG-in-SVG embed per the established Phase 3 path).
  - `project_spec_drift_decisions` K, L, M (existing locks carried forward).
  - `project_canon_commit_strategy` (canon committed to repo, manual regen).
  - `project_anthropic_billing_constraint` (canon bake cost ceiling).
  - `feedback_dispatch_brief_template` (this dispatch followed the doc-preload + findings-surface template).
- **Word-list source-of-truth files:**
  - `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_FOR_PROMPT` (short-a), `WORD_SONG_TARGET_WORDS_SHORT_O` (short-o), `WORD_SONG_TARGET_WORDS_SHORT_U` (short-u).
  - `src/screens/WordSong/wordPack.ts TARGET_WORDS / DISTRACTOR_ONLY_WORDS / FORBIDDEN_PAIRS / TARGET_PAIRINGS`.
- **Tree source-of-truth:**
  - `src/lib/progress/mastery.ts LITERACY_TREE`.
  - `src/lib/progress/focusNode.ts WORD_SONG_NODES_IN_ORDER`.
  - `src/lib/progress/types.ts WordSongNode`.
- **Canon source-of-truth:**
  - `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES`.
  - `public/canon/word-song/level-1/cvc-words-short-u.json` (existing reference shape — short-e canon mirrors it).
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels"; `project_diagnostic_results` memory (April 2026); 2026-05-09 iPad signal pattern: progressing on short-a/short-u, on track for short-i → short-e transition over the next several weeks.
- **Picture-pack pipeline:** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" (Path 2 — PNG-in-SVG embed via `yarn embed-pictures` is Thomas's chosen path).
- **Five-place sync rule:** `.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`" + `.claude/docs/testing-and-ci.md` §4.1.1.
- **Lifetime-first-encounter gate (consumed by AC9b):** `.claude/docs/progress-and-persistence.md` §"Lifetime-first-encounter gate" — short-e adds itself to `FIRST_ENCOUNTER_GATED_NODES`.
