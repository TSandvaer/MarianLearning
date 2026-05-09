# Word Song — short-u pool expansion (v3 vowel tier)

**Ticket:** `86c9q5q2d` (this spec) — implementation ticket downstream (Kevin's planner-widen + canon-bake; Devon's `wordPack.ts` + picture-embed wiring).
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #132 (parser widening), PR #135 (cvc-words first-class shipped), PR #139 (developmental review merged 2026-05-02), PR #141 (short-o pool expansion spec, locked 2026-05-04), PR #150–#155 (short-o impl + canon), PR #156–#157 (short-a + short-o picture-pack ship via PNG-in-SVG embed).
**Companion specs:** `design/word-song/short-o-pool-expansion.md` (structural template — this spec mirrors it exactly), `design/word-song/short-u-picture-pack-prompts.md` (the MJ prompt sheet sibling to this doc), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/README.md`, `design/word-song/parser-widening-plan.md`.

---

## Why this spec, why now

Short-o shipped 2026-05-04 → 2026-05-07 (PRs #150–#157). On the iPad signal of 2026-05-08, Marian is progressing on `cvc-words` (short-a). Per Dave's developmental review §6 P0 "the graduation mechanism to the next vowel must be designed and ticketed _now_, before Marian has repeated sessions on a pool she can navigate from memory rather than decoding," and per `design/research/phonics-sequence-marian.md` §Q1 (vowel order locked at `o → u → i → e`), short-u is the next vowel tier.

Thomas has volunteered to run the Midjourney generation himself for short-u — the picture pack is a one-time deal of ~50 images across the remaining vowel tiers, and he'd rather work in batch than re-engage an agent each time. He needs a curated word list before he can start.

**Scope of this spec:** word selection (audit + final pool), focus-node naming, picture-pack requirements, mastery progression flow into short-u, canon-bake plan, visual-design delta. The companion MJ prompt sheet [`short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md) carries the per-word generation prompts (Phase 1 deliverable for Thomas).

Out-of-scope items are listed at the end (§8). Code changes are downstream — Kevin handles canon + planner + sibling-node wiring after this spec lands; Devon handles picture-embedding via `yarn embed-pictures` after Thomas's MJ pass.

---

## 1. Word selection — the 14 short-u words

### Brief / phonics-doc starting pool

The brief and `design/research/phonics-sequence-marian.md` §Application both list a 10-word tentative short-u pool: `sun, cup, bug, mud, run, hug, nut, pup, cut, tub`. The ticket asks for ~14 target words to give the planner a richer pool than the 8-word short-o tier (the pickup observation: 8 words gives the planner only 4-of-8 distinct trios, which Marian saturates within ~3 sessions, exactly the over-familiarity risk Dave §6 P0 flags). 14 is the same pool size we ship for short-a today, and it's the planner's comfort zone for "8-problem session, distinct words within session" without leaning on the same 6 words every run.

The plan: audit the brief's 10 first, then add 4 more from the standard short-u CVC list (Big City Readers source 5 + Reading Rockets ELL-flagged short-u list) until we hit 14. Reject any that fail the v1 word-pack constraints (concrete-noun referent, true CVC pattern, picturable for an L2 8-year-old, vocabulary-cap aware per CLAUDE.md, distinct silhouette at 96pt).

### Audit of the brief's 10

| Word | CVC pattern | Concrete                                                                                                                                                                                                                                                                                       | Picturable                                                                                                                    | In ~200-word vocab cap                                                                                                                                                                                                               | Silhouette risk                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verdict                                                                                                                                                                                                                                           |
| ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sun  | C-V-C ✓     | ✓                                                                                                                                                                                                                                                                                              | ✓ (already shipped as `picture-sun.svg` distractor)                                                                           | High-frequency, but per Marian's diagnostic she decoded "sun" correctly and said "I don't know what sun is." Dave flagged this in the phonics doc as a perfect first short-u target precisely because she has the decoding scaffold. | Distinct (round disc with rays)                                                                                                                                                                                                                                                                                                                                                                                                                 | **KEEP** — re-purpose distractor → target                                                                                                                                                                                                         |
| cup  | C-V-C ✓     | ✓                                                                                                                                                                                                                                                                                              | ✓ (already shipped as `picture-cup.svg` distractor)                                                                           | High-frequency, picture-grounded                                                                                                                                                                                                     | `cup ↔ tub` watch (both vessels — see §3 forbidden-pair audit)                                                                                                                                                                                                                                                                                                                                                                                  | **KEEP** — re-purpose distractor → target                                                                                                                                                                                                         |
| bug  | C-V-C ✓     | ✓ (count noun, insect)                                                                                                                                                                                                                                                                         | ✓                                                                                                                             | High-frequency, familiar to a Manila 8yo (Tagalog _insekto_ / _kulisap_)                                                                                                                                                             | Distinct (oval body, six legs, antennae)                                                                                                                                                                                                                                                                                                                                                                                                        | **KEEP**                                                                                                                                                                                                                                          |
| mud  | C-V-C ✓     | ⚠ Mass noun, abstract substance. _Mud_ in isolation is hard to picture as a discrete chip — it tends to read as "dirt", "ground", "puddle". The same mass-vs-count argument that worked for `jam` (jam-in-a-jar = "jam") could work here (mud-puddle = "mud"), but the picture-chip is weaker. | Marginal — best rendering is a circular brown puddle with footprint or splash; competes weakly against discrete-object chips. | Borderline — _mud_ exists in Marian's life (Manila monsoon season) but is not high-frequency in early-reader pictures.                                                                                                               | Low silhouette risk; no canonical chip is a brown puddle.                                                                                                                                                                                                                                                                                                                                                                                       | **REPLACE** — the picture risks reading as "puddle" or "dirt" rather than "mud"; stronger short-u nouns are available.                                                                                                                            |
| run  | C-V-C ✓     | ✗ — _run_ is a verb, not a noun. The picture has to depict an action (a child mid-run). Same problem `hop` had in the short-o audit — the chip would depict a running figure and Marian would read it as "child" or "girl" rather than "run."                                                  | Verb — not picturable as a still chip the way nouns are.                                                                      | n/a — wrong word class                                                                                                                                                                                                               | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                             | **REPLACE** — same rule that killed `hop`.                                                                                                                                                                                                        |
| hug  | C-V-C ✓     | ✗ — _hug_ is a verb / event noun. The picture depicts two figures embracing, which Marian reads as "two people" or "mom" or "love" rather than "hug." Like `nap` in the probe pack, it's borderline-picturable but the picture-chip read is unstable.                                          | Marginal                                                                                                                      | n/a                                                                                                                                                                                                                                  | Two-figure composition risks colliding with `mom` and `dad` from prior packs.                                                                                                                                                                                                                                                                                                                                                                   | **REPLACE** — combination of verb-class + composition-collision risk.                                                                                                                                                                             |
| nut  | C-V-C ✓     | ✓                                                                                                                                                                                                                                                                                              | ✓ — single subject, distinctive shape (almond, peanut, walnut).                                                               | Borderline — nuts are present in Filipino diets but not always under the English label. Picture carries it.                                                                                                                          | Distinct (oval with seam line, soft brown)                                                                                                                                                                                                                                                                                                                                                                                                      | **KEEP**                                                                                                                                                                                                                                          |
| pup  | C-V-C ✓     | ✓ (young dog)                                                                                                                                                                                                                                                                                  | ✓                                                                                                                             | Borderline — "puppy" is high-frequency but "pup" specifically is less so for an L2 8yo; she'll likely know it as soon as she sees the picture but it's a vocab-stretch word.                                                         | **HIGH** — `pup` is a small four-legged dog. **Direct silhouette collision with `dog`** (already a target in short-o tier and a distractor across the pack). At 96pt a small dog (pup) reads identically to a dog.                                                                                                                                                                                                                              | **REPLACE** — the silhouette collision is unfixable in v1 same-vowel framing without dragging short-o `dog` into the short-u pool, which violates the same-vowel-only rule (§ 8). Better to drop `pup` and use a different concrete short-u noun. |
| cut  | C-V-C ✓     | ✗ — _cut_ is a verb / state. Picture would depict scissors-cutting-paper, a knife-cutting-fruit, or a bandage-on-finger (the "owie" interpretation). All three are unstable reads.                                                                                                             | n/a                                                                                                                           | n/a                                                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                             | **REPLACE** — verb-class problem identical to `run`/`hug`.                                                                                                                                                                                        |
| tub  | C-V-C ✓     | ✓ (bathtub)                                                                                                                                                                                                                                                                                    | ✓                                                                                                                             | Borderline — "tub" specifically is less common than "bath" or "bathtub" in early-reader vocabulary. Picture (free-standing tub on legs, bubble-bath optional) carries it.                                                            | **MODERATE** — `tub ↔ cup` is the primary collision (both vessels in side profile). The discriminator is depth + handles + size cue — `cup` is small with a single curved handle; `tub` is large free-standing on small feet, no handle. Also `tub ↔ pot` (short-o) — both are deep open vessels. The handle / feet discriminator handles `cup` cleanly, and `tub` doesn't appear in same-trio with `pot` (cross-vowel constraint § 8 forbids). | **KEEP** — but flag a forbidden-pair candidate `tub ↔ cup` for §3 audit.                                                                                                                                                                          |

**Verdict from the 10:** keep 5 (sun, cup, bug, nut, tub), replace 5 (mud, run, hug, pup, cut). We need 14 total, so 9 more entries to source.

### Substitutions and additions — sourcing the remaining 9

Candidates from standard short-u CVC lists (Big City Readers source 5; Reading Rockets ELL short-u; UFLI / Wilson Reading short-u sets), audited against the same constraints:

| Candidate                                     | CVC       | Concrete noun                                                                                       | Picturable                                                                           | Vocab-cap aware                                                                                                                                                                                      | Silhouette risk                                                                                                                                                                                                                                                                                                                                                                                | Verdict                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bun**                                       | ✓ (b-u-n) | ✓ — bread roll, count noun                                                                          | ✓ — round bread roll with seam line, soft top                                        | High-frequency in Filipino-English (pan de sal is bun-shaped; "bun" is in McDo's Filipino menu)                                                                                                      | Low — round-bread-roll silhouette is distinct from existing pack                                                                                                                                                                                                                                                                                                                               | **KEEP**                                                                                                                                                                                                                                                                                                                  |
| **gum**                                       | ✓ (g-u-m) | ⚠ Mass noun. _Gum_ (chewing gum) renders weakly as a chip; _gum_ (the mouth tissue) is even weaker. | n/a                                                                                  | Borderline                                                                                                                                                                                           | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP** — same problem as mud; mass-noun, weak chip read.                                                                                                                                                                                                                                                                |
| **jug**                                       | ✓ (j-u-g) | ✓ — pottery / pitcher, count noun                                                                   | ✓ — handled vessel                                                                   | Borderline — "jug" is less common than "pitcher" or "bottle" in Filipino-English; an 8yo will recognize the shape but may not have the word. Picture carries it.                                     | **MODERATE** — `jug ↔ cup` (both handled vessels) and `jug ↔ tub` (both vessels). Discriminator: jug has a single curved handle + spout; cup has a single curved handle, no spout, smaller; tub is large + footed + no handle. The spout is the load-bearing feature.                                                                                                                          | **KEEP — with caveat.** Picture must show the spout clearly to disambiguate.                                                                                                                                                                                                                                              |
| **rug**                                       | ✓ (r-u-g) | ✓ — floor covering, count noun                                                                      | ✓ — rectangular flat object with fringe                                              | High-frequency (Tagalog _banig_ / _karpet_ — "rug" reads in English picture books)                                                                                                                   | **HIGH** — `rug ↔ mat` (canonical short-a target — both flat-rectangle floor coverings). The discriminator is fringe (rug has fringed edges; mat has plain hemmed edges) plus optional pattern (rug typically patterned; mat typically plain). At 96pt this is the same silhouette-collision class that `mat ↔ map` triggered in the probe pack. **NEW FORBIDDEN_PAIR proposed: `rug ↔ mat`.** | **KEEP** — but adds a forbidden-pair entry per §3.                                                                                                                                                                                                                                                                        |
| **hut**                                       | ✓ (h-u-t) | ✓ — small dwelling, count noun                                                                      | ✓ — simple A-frame with door                                                         | Borderline — "hut" is in early-reader vocabulary internationally but a Manila 8yo associates the concept more with _bahay kubo_ or _kubo_. The triangular-roofed-house silhouette is universal.      | Low — no canonical chip is a small house.                                                                                                                                                                                                                                                                                                                                                      | **KEEP**                                                                                                                                                                                                                                                                                                                  |
| **pot** (short-o, already canonical)          | n/a       | n/a                                                                                                 | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **N/A** — short-o, not short-u.                                                                                                                                                                                                                                                                                           |
| **rub**                                       | ✓ (r-u-b) | ✗ Verb. Picture depicts hand-on-back / hand-on-genie-lamp / cleaning motion. Unstable read.         | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP** — verb-class problem.                                                                                                                                                                                                                                                                                            |
| **dug**                                       | ✓ (d-u-g) | ✗ Verb (past tense of dig).                                                                         | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP**.                                                                                                                                                                                                                                                                                                                 |
| **fun**                                       | ✓ (f-u-n) | ✗ Abstract noun. Not picturable.                                                                    | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP**.                                                                                                                                                                                                                                                                                                                 |
| **gun**                                       | ✓ (g-u-n) | ✓ Concrete object                                                                                   | ✓                                                                                    | **HARD REJECT** — weapon imagery is a content-policy violation for an 8-year-old's tutor app. Even if Midjourney would draw it, the chip would surface in Word Song and Marian would see a gun. Out. | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **HARD REJECT — content policy.**                                                                                                                                                                                                                                                                                         |
| **mug**                                       | ✓ (m-u-g) | ✓ — handled drinking vessel, count noun                                                             | ✓ — taller-than-cup handled vessel                                                   | High-frequency in Filipino-English (coffee mug, hot-chocolate mug)                                                                                                                                   | **MODERATE** — `mug ↔ cup` (both handled drinking vessels). Discriminator: mug is taller, straight-sided, larger handle; cup is shorter, sometimes flared. Probably manageable but risky at 96pt.                                                                                                                                                                                              | **SKIP** — too close to `cup` for the v1 pool; we already keep `cup` so adding `mug` doubles up the handled-drinking-vessel slot. Better to keep the slot for a categorically different word.                                                                                                                             |
| **nub**                                       | ✓         | ✗ Abstract / weakly concrete.                                                                       | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP**.                                                                                                                                                                                                                                                                                                                 |
| **pug**                                       | ✓ (p-u-g) | ✓ — dog breed                                                                                       | ✓                                                                                    | Borderline                                                                                                                                                                                           | **HIGH** — same dog-silhouette collision as `pup`.                                                                                                                                                                                                                                                                                                                                             | **SKIP**.                                                                                                                                                                                                                                                                                                                 |
| **rut**                                       | ✓         | ✗ Abstract / weakly concrete.                                                                       | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP**.                                                                                                                                                                                                                                                                                                                 |
| **bud**                                       | ✓ (b-u-d) | ✓ — flower bud or leaf bud, count noun                                                              | Marginal — buds are small and seasonal; picture risks reading as "flower" or "leaf". | Borderline                                                                                                                                                                                           | Low                                                                                                                                                                                                                                                                                                                                                                                            | **SKIP** — picture-read instability.                                                                                                                                                                                                                                                                                      |
| **bus** (short-u distractor, already in pack) | n/a       | n/a                                                                                                 | n/a                                                                                  | n/a                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                            | **PROMOTE** — `bus` already lives in `DISTRACTOR_ONLY_WORDS` (`vowel: 'u'`). Its picture exists (`picture-bus.svg`); per the same logic that promoted `dog/log/pot/fox` from distractor → target in short-o, `bus` joins as a target here. This was the README §"Cross-vowel reuse" forecast — `bus` is a short-u target. |
| **pen** (short-e distractor)                  | —         | n/a                                                                                                 | n/a                                                                                  | n/a                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                                              | **N/A** — short-e, not short-u. Will surface in the future short-e pool.                                                                                                                                                                                                                                                  |
| **bun** (already in keep list above)          | —         | —                                                                                                   | —                                                                                    | —                                                                                                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                              | already counted                                                                                                                                                                                                                                                                                                           |
| **van** (short-a, canonical)                  | —         | —                                                                                                   | —                                                                                    | —                                                                                                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                              | N/A.                                                                                                                                                                                                                                                                                                                      |

**Other candidates briefly considered and dropped:** `lug` (verb), `jut` (verb), `rum` (alcohol — content), `pun` (abstract), `lull` (CVCC), `hum` (verb / abstract), `tug` (verb), `but` (function word, not concrete), `up` (function word + 2-letter), `buzz` (CVCC + verb), `cuff` (CVCC), `dust` (CVCC), `bull` (CVCC), `pull` (CVCC).

### Pool-size recommendation — 11, not 14

The brief asked for ~14 short-u target words. After the strict audit, **the rigor lands at 11 strong entries**: 5 from the brief's 10 (sun, cup, bug, nut, tub — keeping; replacing mud/run/hug/pup/cut), plus 6 sourced from standard short-u CVC lists (bus by promotion-from-distractor, bun, jug, rug, hut, gum). Forcing 14 would drag in weaker entries (`pup`/`mug` silhouette-collision, `mud` mass-noun-instability, `pug`/`bud` picture-instability) — that's a worse pool.

This is fewer than short-a's 14 and more than short-o's 8 — calibrated to the actual vocabulary surface short-u offers without forcing weak entries:

- Short-a has 14 because it's the most-prolific English short-vowel CVC family (5 rhyme groups: /æt/, /æn/, /æg/, /æp/, /æd/, /æm/, plus the loose `dad`/`man`).
- Short-o has 8 because Dave's source 5 and the spec audit converged at exactly 8 strong entries.
- Short-u sits between, with **11** entries that hold their weight against the audit.

Pool size **LOCKED at 11 (Q1 locked A, 2026-05-09 by Thomas)** — see §10 Q1. Phase 2 fallback to 10 (drop `gum`) stays documented as the contingency if the wrapped-stick picture-chip read is unstable at 96pt; see §2.8 of the picture-pack prompt sheet for the regenerate-or-drop trigger.

### Final v1 short-u pool (11 words, Q1 locked A)

| #   | Word | Picture status                                                      | Vowel | Category  | Notes                                                                                                                         |
| --- | ---- | ------------------------------------------------------------------- | ----- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | sun  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | u     | celestial | Promoted from distractor → target.                                                                                            |
| 2   | cup  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | u     | vessel    | Promoted from distractor → target.                                                                                            |
| 3   | bus  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | u     | vehicle   | Promoted from distractor → target.                                                                                            |
| 4   | bug  | NEW                                                                 | u     | animal    | Insect archetype.                                                                                                             |
| 5   | nut  | NEW                                                                 | u     | food      | Almond/peanut shape with seam line.                                                                                           |
| 6   | tub  | NEW                                                                 | u     | household | Free-standing footed bathtub. **`[tub, cup]` FORBIDDEN_PAIR LOCKED §3 / §10 Q3.**                                             |
| 7   | bun  | NEW                                                                 | u     | food      | Round bread roll, seam on top.                                                                                                |
| 8   | jug  | NEW                                                                 | u     | vessel    | Handled vessel with prominent spout. **Spout is the load-bearing distinguisher.**                                             |
| 9   | rug  | NEW                                                                 | u     | household | Rectangular fringed floor covering. **NEW FORBIDDEN_PAIR with `mat` — §3.**                                                   |
| 10  | hut  | NEW                                                                 | u     | object    | Simple A-frame dwelling.                                                                                                      |
| 11  | gum  | NEW                                                                 | u     | food      | Wrapped chewing-gum stick. Phase 2 fallback to 10 (drop `gum`) documented for picture-instability — see §2.8 of prompt sheet. |

**Pool composition cross-check:**

- **All 11 are concrete or noun-form-pictureable.** `gum` is a mass noun but the wrapped-stick picture-chip stably depicts the noun form (same logical move as `jam` from short-a where jam-in-a-jar = "jam"). Phase 2 fallback if the picture is unstable at 96pt: drop to 10 entries — documented as a contingency, not the default.
- **All 11 are CVC by spelling.** No `x = /ks/` exception in this pool (unlike short-o's `box`/`fox`). `nut`, `cup`, `bug`, `bun`, `jug`, `rug`, `hut`, `gum`, `tub` all decode cleanly.
- **3 of 11 are already in the v1 distractor pool** (`sun, cup, bus`) — picture assets exist as hand-authored SVGs today (PR #157); **all 11 are generated in the new MJ session for cohesion (Q2 locked A, 2026-05-09 by Thomas)**, so Thomas runs 11 generations total in the new MJ session — the 8 wholly-new (`bug, nut, tub, bun, jug, rug, hut, gum`) plus 3 retraces of the existing distractor pictures (`sun, cup, bus`). The retraces overwrite the existing PR #157 SVGs via `yarn embed-pictures` in Phase 3.
- **Category spread:** 1 celestial (sun), 1 vehicle (bus), 1 vessel-cup (cup), 1 vessel-jug (jug), 1 animal (bug), 1 dwelling (hut), 2 household (tub, rug), 3 food (nut, bun, gum). Spread mirrors short-a's variety; less concentrated on kitchen than short-o.

### Phonetic spread within the pool (rhyme-family coverage)

Onset + coda variety drives "real decoding" vs. "first-letter pattern-match" — same constraint that drove short-o's audit:

| Rhyme family | Members       | Member count |
| ------------ | ------------- | ------------ |
| `/ʌn/`       | sun, bun      | 2            |
| `/ʌp/`       | cup           | 1            |
| `/ʌs/`       | bus           | 1            |
| `/ʌg/`       | bug, jug, rug | 3            |
| `/ʌt/`       | nut, hut      | 2            |
| `/ʌb/`       | tub           | 1            |
| `/ʌm/`       | gum           | 1            |

7 distinct codas. Onsets cover b-, c-, g-, h-, j-, n-, r-, s-, t- (9 distinct onsets). Sound space is well-covered for an 11-word pool. The `/ʌg/` triplet (bug/jug/rug) is intentional — it gives the planner a tight rhyme-family cluster to lean on for trap-tier distractors (problem 4-8 wants same-rhyme partners, like short-a's `cat/hat/bat/mat`).

---

## 2. Distractor word list (~8 entries, in-tier pool)

The brief asks for ~8 distractor-only short-u words. **Audit notes: this is structurally different from short-a's `DISTRACTOR_ONLY_WORDS`.** That list (`bus, sun, dog, fox, cup, pen, log, pot`) was assembled in v1 because the short-a pool needed cross-vowel chips for visual/categorical-difference picks — the v1 same-vowel-only constraint hadn't been formalised yet.

In short-o (PR #141 / §8) and going forward in short-u, **distractors are drawn from the same-vowel pool itself**. So "distractor word list" for short-u v1 is conceptually the _short-u pool_ (the 11 entries above) — every short-u target has gentle + trap distractors picked from the other 10 short-u words.

**However**, the ticket explicitly asks for an 8-word distractor list. There are two readings:

- **Reading A**: it's asking for an additional ~8 short-u distractor-only chips that don't serve as targets — to give the matrix more visual variety beyond the 11 target chips. The cross-vowel constraint § 8 already says "no" to mixing short-a and short-u in the same trio, so any "distractor-only" short-u entries would still need to be true short-u CVCs with picture-pack assets. Audit candidates against the same constraints:

| Candidate     | Reason to ship as distractor-only | Reason to skip                                                                                  |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| pup           | small dog, distinct from `bug`    | **SKIP** — silhouette collision with `dog` (short-o target) and stress on the cross-vowel rule. |
| mug           | handled drinking vessel           | **SKIP** — too close to `cup` at 96pt.                                                          |
| jam (short-a) | —                                 | N/A — wrong vowel.                                                                              |
| cot           | small bed                         | **SKIP** — short-o, not short-u.                                                                |

The audit doesn't yield 8 strong distractor-only short-u entries. Forcing them would weaken the pack.

- **Reading B**: the ticket's "~8 distractor words" is referring to the same in-tier pool that short-o ships — the 8 non-target short-u CVCs that act as distractors for the targets. In short-o this is actually the same 8 words that ARE the targets (because pool = 8 = sessions = 8). For short-u with 11 targets, every target also acts as a distractor for the other 10 — there's no separate "distractor-only" list in the same-vowel-only model.

**Recommended interpretation: Reading B.** The 11 short-u targets are simultaneously the 11-word in-tier distractor pool. No separate "distractor-only" list is needed; the matrix in `TARGET_PAIRINGS` (§AC6) draws every short-u distractor from the 11-word target pool. This mirrors short-o §8 verbatim.

If Thomas wants Reading A (a few additional short-u-only distractor chips for matrix variety), the candidates that _would_ qualify after a stricter audit are: `pup` (silhouette risk), `mug` (cup-collision risk), `mud` (mass-noun risk). All three have audit defects; none are clean-ship-ready. Recommend deferring Reading A as a future ticket if the matrix feels constrained in practice.

**Spec lock for v1: same-vowel-only, 11-word pool serves as both target list and distractor pool.** Q4 in §10 captures the "Reading A vs B" decision for Thomas confirmation.

### Distractor matrix (concrete example)

The full `TARGET_PAIRINGS` rows are an AC item for Kevin's impl ticket (§9 AC6); design preview here so the structure is clear:

```ts
sun: { gentle: ['hut',  'rug'], trap: ['bun', 'jug'] },  // /ʌn/ rhyme + cross-category
cup: { gentle: ['bug',  'rug'], trap: ['nut', 'jug'] },  // vessel-trap (jug shares vessel category); tub excluded per the §3 LOCKED `[tub, cup]` FORBIDDEN_PAIR (Q3 lock 2026-05-08)
bus: { gentle: ['nut',  'sun'], trap: ['hut', 'bug'] },  // /ʌs/ has no rhyme partner; trap on /ʌt/+/ʌg/ near-miss
bug: { gentle: ['tub',  'sun'], trap: ['jug', 'rug'] },  // /ʌg/ rhyme triplet trap
nut: { gentle: ['rug',  'cup'], trap: ['hut', 'bun'] },  // /ʌt/ rhyme + /ʌn/ near-rhyme
tub: { gentle: ['hut',  'sun'], trap: ['bug', 'jug'] },  // vessel-trap (jug shares vessel category, bug shares /ʌ/ vowel); cup excluded per the §3 LOCKED `[tub, cup]` FORBIDDEN_PAIR (Q3 lock 2026-05-08)
bun: { gentle: ['rug',  'tub'], trap: ['sun', 'gum'] },  // /ʌn/ rhyme + /ʌm/ near-miss
jug: { gentle: ['nut',  'sun'], trap: ['bug', 'rug'] },  // /ʌg/ rhyme triplet trap
rug: { gentle: ['cup',  'sun'], trap: ['bug', 'jug'] },  // /ʌg/ rhyme triplet trap; mat is the FORBIDDEN_PAIR partner — cross-vowel anyway, not in pool
hut: { gentle: ['cup',  'sun'], trap: ['nut', 'bun'] },  // /ʌt/ rhyme + /ʌn/ near-miss
gum: { gentle: ['bug',  'rug'], trap: ['bun', 'sun'] },  // /ʌm/ has no in-pool rhyme partner; /ʌn/ near-miss
```

**Note on `tub`'s row:** the preview above pre-resolves to `trap: ['bug', 'jug']` (matching the Q3-locked `[tub, cup]` FORBIDDEN*PAIR — see §3 / §10 Q3, locked 2026-05-08 per Devon's review). Kevin can swap to `[hut, bun]` if the `[bug, jug]` rhyme/vessel pairing reads weakly in Phase 2 visual review, but the matrix-as-written passes `assertNotForbidden` against the locked FORBIDDEN_PAIRS today. The matrix is mechanical; Kevin owns it under his impl ticket — design lock here is the \_constraint*, not the exact pairs.

**Note on `rug`:** `rug ↔ mat` IS a forbidden pair (added in §3) but `mat` is short-a, never appears in a short-u trio under the same-vowel-only rule. So the FORBIDDEN_PAIR addition is for cross-pack hygiene, not for in-pool selection.

---

## 3. Picture-pack requirements

### Existing assets (audited 2026-05-08)

Per `public/assets/pictures/` after PR #156 + #157 (full short-a + short-o picture pack ship):

- 14 short-a target picture-`{word}`.svg files
- 8 distractor-only picture-`{word}`.svg files (`bus, sun, dog, fox, cup, pen, log, pot`)
- 4 short-o-additions picture-`{word}`.svg files (`mom, mop, box, hot`)
- 4 novel-pool probe picture-`{word}`.svg files (`nap, rat, map, tap`) — assumed shipped per the probe-pack ticket

26 picture-pack SVGs on disk, all using the PNG-in-SVG embed pattern (per `.claude/docs/skill-trees-and-content.md` §"Rendering pattern post-PR #157" — Thomas runs MJ → remove.bg → `yarn embed-pictures` → `<svg><image href="data:image/png;base64,...">`).

Three of the short-u targets (`sun, cup, bus`) re-purpose existing distractor picture files. The other 8 are brand-new (`bug, nut, tub, bun, jug, rug, hut, gum`).

### Asset format

Match the short-o pack's locked decision (§3 of the short-o spec): **PNG-in-SVG embed via `yarn embed-pictures`**. This is explicitly the path Thomas has chosen — he runs MJ generations himself, exports transparent PNGs via remove.bg, runs `yarn embed-pictures design/references/picture-pack/transparent public/assets/pictures` from `MarianLearning/`, and the script wraps each PNG into an SVG `<image href>` shell.

Per `.claude/docs/skill-trees-and-content.md` §3 "Three viable Phase 3 paths," this is **Path 2 — Thomas-runs-PNG-embed-in-SVG**. Visual fidelity = 100% the source PNG; file size ~50–150 KB per asset at 512×512 source PNG resolution. Picture-pack budget is well within the PWA cache (`reference_pwa_asset_size_limits` — 4 MiB cap, 26 picture-pack SVGs at ~100 KB ≈ 2.6 MB total).

**Do NOT use Path 1 (agent-delegated hand-author SVG)** for this pack — the post-PR-#157 visual-fidelity surprise (`.claude/docs/skill-trees-and-content.md` §"important expectation-management note") is precedent: when the Phase-3 path isn't named explicitly, agents collapse "trace" to "hand-author primitives," which produces clean cartoon vectors but loses MJ source character. Thomas wants source fidelity here, so the path is locked to Path 2.

### Required new pictures (11 total — Q2 locked A, all generated in new MJ session for cohesion)

| #   | Word | Status                                                              | Path                                     | Notes                                                                                                                                                                      |
| --- | ---- | ------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | sun  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | `public/assets/pictures/picture-sun.svg` | Existing file from PR #157 is overwritten via `yarn embed-pictures` after Thomas's MJ pass. Authored fresh in the short-u sheet style for pack cohesion.                   |
| 2   | cup  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | `public/assets/pictures/picture-cup.svg` | Same rationale as `sun`. Pair-review against `tub` at 96pt is mandatory (Q3 FORBIDDEN_PAIR `[tub, cup]`).                                                                  |
| 3   | bus  | EXISTS as distractor; **re-trace in this MJ session (Q2 locked A)** | `public/assets/pictures/picture-bus.svg` | Same rationale as `sun`.                                                                                                                                                   |
| 4   | bug  | NEW                                                                 | `public/assets/pictures/picture-bug.svg` | Single insect, oval body, six legs, antennae. Distinct from any animal in the pack.                                                                                        |
| 5   | nut  | NEW                                                                 | `public/assets/pictures/picture-nut.svg` | Single nut (almond or peanut), seam line, soft warm-brown.                                                                                                                 |
| 6   | tub  | NEW                                                                 | `public/assets/pictures/picture-tub.svg` | Free-standing footed bathtub, three-quarter view, optional bubble-bath dome. **`tub ↔ cup` is now a LOCKED FORBIDDEN_PAIR (§10 Q3 LOCKED 2026-05-08 per Devon's review).** |
| 7   | bun  | NEW                                                                 | `public/assets/pictures/picture-bun.svg` | Round bread roll, seam line on top, soft warm-brown crust.                                                                                                                 |
| 8   | jug  | NEW                                                                 | `public/assets/pictures/picture-jug.svg` | Handled vessel with prominent spout. **Spout is the load-bearing distinguisher** vs. `cup` and `tub`.                                                                      |
| 9   | rug  | NEW                                                                 | `public/assets/pictures/picture-rug.svg` | Rectangular floor covering, fringe at both short ends, simple geometric pattern (stripes or diamonds). **NEW FORBIDDEN_PAIR with `mat`.**                                  |
| 10  | hut  | NEW                                                                 | `public/assets/pictures/picture-hut.svg` | Simple A-frame house, single door, optional small window, warm-cream walls + warm-brown thatched-or-tile roof.                                                             |
| 11  | gum  | NEW                                                                 | `public/assets/pictures/picture-gum.svg` | Single wrapped chewing-gum stick — wrapper opened halfway to show stick — OR a single wrapped flat package. Phase 2 fallback to drop documented if 96pt read is unstable.  |

**Total picture-pack PNG generations needed: 11** (8 wholly-new — `bug, nut, tub, bun, jug, rug, hut, gum` — plus 3 retraces — `sun, cup, bus` — for tier visual cohesion per Q2 locked A).

If Phase 2 review drops `gum` (mass-noun fallback), the count drops to 10 (7 wholly-new + 3 retraces).

**Total post-Phase-3 SVG asset count (after this pack):**

- Short-a pack: 14 target + 8 distractor-only (some now short-o targets) = 22 files
- Short-o pack: 4 new (mom, mop, box, hot) + 4 promoted (dog, log, pot, fox already had files) = 4 new files
- Probe-word pack: 4 (nap, rat, map, tap) = 4 files
- Short-u pack: 8 wholly-new + 3 retraced (overwriting `sun, cup, bus`) = **8 new files + 3 overwrites**

**New SVG file additions on this PR pack: 8 (or 7 if Phase 2 drops `gum`).** Cumulative: ~34 picture-pack SVGs after this ships (the 3 retraced `sun, cup, bus` files keep the same paths, no new file count).

Combined size estimate at ~100 KB each: ~3.4 MB. Still well under the 4 MiB PWA cache budget.

### Forbidden-pair declarations (new for this pack)

Two new entries to `wordPack.ts` `FORBIDDEN_PAIRS`:

1. **`['rug', 'mat']`** — both flat-rectangular floor coverings. The short-u `rug` and short-a `mat` are in different vowel pools so they never appear in the same trio under the same-vowel-only rule, BUT this entry guards against a future cross-vowel mixing ticket (`86c9m3aek`) accidentally mixing them. Cheap insurance, zero current cost.

2. **`['tub', 'cup']`** _(LOCKED 2026-05-08 per Devon's review — see §10 Q3)_ — both vessels in side profile. `tub` is large + footed + no handle; `cup` is small + handled. The size + handle discriminators _should_ hold, but at 96pt with PNG-embed compression they may collapse. Cost-asymmetry favours add-now: cost-of-adding is one line, cost-of-not-adding-and-being-wrong is a Phase 2 round-trip. If Phase 2 review shows the discriminators hold cleanly, removing the entry is a one-line revert.

The `[mom, dad]` and existing pairs from short-o stand unchanged.

### Pipeline for the 11 short-u pictures (Q2 locked A)

Same 3-phase pipeline as the short-o pack (`design/word-song/short-o-pool-expansion.md` §3, `design/word-song/README.md` Phase model):

| Phase                                             | Owner          | Output                                                                                                                                                                                                | Blocking dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Prompt sheet                                   | Kyle (this PR) | [`short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md) — 11 short-u prompts (8 wholly-new: bug, nut, tub, bun, jug, rug, hut, gum + 3 retraces: sun, cup, bus per Q2 locked A)        | Short-a pack's `picture-pack-style-anchor.md` — style frame is shared.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2. Midjourney generation + transparent-PNG export | Thomas         | 11 source PNGs (≥1024×1024 source, exported transparent at ~512×512 via remove.bg) — all 11 generated in one MJ session for tier visual cohesion (Q2 locked A)                                        | Phase 1 merged. ~45–80 min MJ generation time for the 11-asset pack at the per-pack cadence Thomas has done before, **plus ~5–10 min/asset for the remove.bg transparent-export step** (so ~55–110 extra min on top of the MJ generation for an 11-asset pack). Path 2 has a different time profile from the Path-1 agent-delegated cadence — `picture-pack-iteration-plan.md` §3's published cadence figures are for Path 1. The pack-batching note in the brief ("50+ images one-time deal") suggests Thomas is bundling short-u with the future short-i + short-e + cohesion re-trace passes into one MJ session. No incremental subscription cost. |
| 3. PNG-embed integration                          | Devon          | 11 `picture-{word}.svg` files at `public/assets/pictures/` via `yarn embed-pictures` (8 wholly-new + 3 overwrites of sun/cup/bus per Q2 locked A) + `wordPictures.tsx` switch arm extension if needed | Phase 2 PNGs delivered. Per `.claude/docs/skill-trees-and-content.md` §"Rendering pattern post-PR #157," the existing `wordPictures.tsx` shared switch arm collapses 26 cases into one `<image href>` block; new picture-pack words slot in without case-body code. The 3 overwrites for `sun, cup, bus` reuse existing `wordPictures.tsx` keys — no switch-arm changes for those.                                                                                                                                                                                                                                                                     |

**Pack-cohesion lever**: same `--cref` / `--sref` to short-a `dog` pose-zero as short-o used. See [`short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md) §1.3.

---

## 4. Mastery progression flow — graduation through the vowel ladder

This is the canonical hand-off from `cvc-words-short-o` to `cvc-words-short-u`. Mirrors the short-o spec §4 — the mastery rule does the work, the picker just reads `skillLevels`.

### Stage definitions

```
Session N    : cvc-words-short-o — canonical 8-word pool
Session N+1  : cvc-words-short-u — first short-u session  (intro)
```

**No graduation probe at the short-o → short-u boundary**, mirroring the short-o spec §4 "Why first short-o session is not gated on probe." The graduation probe (Stage 2 in the short-o spec) verifies generalization within short-a _before_ leaving short-a. Once that check has fired, every subsequent vowel-tier transition is just standard intro→practicing→mastered through `applyMasteryRule`.

This means short-u inherits the short-o flow:

- Picker walks past `cvc-words-short-o` (now `mastered`) and lands on `cvc-words-short-u` (now `intro`, post-promotion).
- Emma's session-open chatter introduces the new vowel: _"This one says /ʌ/, like 'sun'."_ (sourced from the same Dave-developmental pattern as the `/ɒ/` example for short-o).
- After the first short-u session, the node moves to `practicing` per the standard intro→practicing rule (`mastery.ts`).

### Picker / planner sequencing

`pickFocusNode` does not change for short-u. It walks `WORD_SONG_NODES_IN_ORDER` and stops at the first non-`mastered` node. Adding `cvc-words-short-u` between `cvc-words-short-o` and `digraphs` automatically routes Marian to short-u once short-o is mastered.

The planner gets one new branch in `WORD_SONG_TRACK_GUIDE`: when `focusNode === 'cvc-words-short-u'`, emit `"Read the <word>."` problems drawn from the 11-word short-u pool (`api/_plannerWordList.ts` adds `WORD_SONG_TARGET_WORDS_SHORT_U = 'sun, cup, bus, bug, nut, tub, bun, jug, rug, hut, gum'`).

### What is NOT in this flow

- No "cool-down" gap between `cvc-words-short-o` mastery and `cvc-words-short-u` start. The next session after promotion is the first short-u session.
- No mixed-vowel sessions. `cvc-words-short-u` is short-u-only in v1. Cross-vowel mixing is ticket `86c9m3aek` and stays out of v1 (§ 8).
- No re-test of short-a or short-o inside short-u sessions. The Leitner spaced-review system handles maintenance load (out of scope here; M4 ticket Leitner-for-literacy is downstream of v1).
- No second graduation probe at the short-o → short-u boundary. The `cvc-words` graduation probe was the dual-gate verification needed before exiting short-a; subsequent vowel-tier transitions are standard mastery-rule.
- **No PER-WORD first-encounter scaffolding for individual short-u target words.** Short-o introduced one-time scaffolding for `box`/`fox` because of the `x = /ks/` decoding load. Short-u has no analogous decoding-load entry — every word in the 11-word pool is a clean C-V-C with a familiar grapheme. The session-1 `/u/` vs. `/ʌ/` minimal-pair opener (next subsection) IS in scope; per-word first-encounter lines are not.

### First-encounter `/u/` vs. `/ʌ/` minimal-pair scaffolding (LOAD-BEARING)

Per `design/research/phonics-sequence-marian.md` lines 203-206 + 339, the **first short-u session opens with an explicit `/u/` vs. `/ʌ/` minimal-pair contrast line**:

> _"Listen carefully: 'sun' — not 'soon.' Sun! /s/-/ʌ/-/n/."_

This is **load-bearing first-encounter scaffolding for L1 Tagalog interference**, not optional drill-work — Tagalog has `/u/` (the "soon" vowel) but not `/ʌ/` (the "sun" vowel), so Marian's L1 default substitution is `/u:/` for English short-u. The contrast line resets the prediction at first encounter and is structurally identical to short-o's `box`/`fox` `/ks/` first-encounter line (per [`short-o-pool-expansion.md`](./short-o-pool-expansion.md) §1 + §4 + §10 Q1 lock).

**Where this lands in code:** `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts` ([line 815 today](#)) gains a short-u branch whose per-problem chatter, when the focus is `cvc-words-short-u` AND it is the first short-u session for this Marian, includes the contrast opener as a baked planner-template constant. The first-short-u-session detection is the same "first time across her career" tracking gap that short-o §4 flagged for Kevin's impl spec — that gap is still open and applies here verbatim.

The artifact that captures the baked line is the canon JSON at `public/canon/word-song/level-1/cvc-words-short-u.json`. AC9b (below, between AC9 and AC10) pins this contract.

Subsequent short-u sessions do NOT replay the contrast — repeated exposure consolidates `/ʌ/`, and replaying the contrast line would itself become friction. The "first encounter" gate is canonical (per-Marian, lifetime-once), shared with the short-o `box`/`fox` `/ks/` mechanism Kevin's impl ticket will resolve.

### Parser-before-planner reminder (defensive)

Per `project_planner_parser_contract`, the planner-parser contract requires widening the browser parser BEFORE widening the planner. **For this short-u tier no parser change is required** — the cvc-word `"Read the <word>."` template was widened in PR #132 ([`src/screens/WordSong/planFromServer.ts:171`](#) accepts both `Tap the …` and `Read the …`); short-u rides on the existing template. The new short-u opener line baked in AC9b is a session-start utterance with utterance-id namespace `word.session-open.*` (or equivalent — Kevin owns the exact id at impl time per `project_planner_parser_contract` and the `screens-and-flows.md` spec-authoring convention to anchor on stable name primitives, not line numbers); the existing parser's "out-of-namespace ids skip-not-throw" rule (per [`skill-trees-and-content.md`](../../.claude/docs/skill-trees-and-content.md) §"Word `planFromServer`") covers cross-screen utterances cleanly. No parser delta needed; the contract is invoked here defensively for the impl-ticket reviewer.

---

## 5. Avoiding phonetic confusion with short-o and short-a

Cross-vowel confusion audit, per the brief AC1 and §1 audit:

### vs. short-o (recently shipped)

| short-o | short-u                            | Risk                                                                                                                                                                                                            |
| ------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dog     | bug                                | Both small animals — but `bug` is an insect (oval-with-legs silhouette), `dog` is a four-legged mammal. Different category at 96pt. Same-vowel-only rule means they never appear in the same trio. **No risk.** |
| dog     | pup                                | (`pup` was rejected from the pool — see §1 audit.) **No risk.**                                                                                                                                                 |
| pot     | tub                                | Both deep open vessels. Same-vowel-only rule keeps them apart in trios. Cross-pack visual hygiene: tub has feet + larger size proportions; pot has lid + handles. **Low risk** with the same-vowel constraint.  |
| pot     | cup                                | Cross-vowel + already-distinct. **No risk.**                                                                                                                                                                    |
| mom     | (no human in short-u pool)         | **No risk.**                                                                                                                                                                                                    |
| log     | (no log-shape in short-u pool)     | **No risk.**                                                                                                                                                                                                    |
| hot     | (no steaming-bowl in short-u pool) | **No risk.**                                                                                                                                                                                                    |

### vs. short-a (canonical 14)

| short-a | short-u                    | Risk                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mat     | rug                        | **HIGH same-silhouette risk.** Both flat-rectangular floor coverings. Picture-side discriminator: rug has visible fringe + simple pattern; mat has plain hemmed edges. **Same-vowel-only rule keeps them apart in trios** but cross-pack visual hygiene is critical. **NEW FORBIDDEN_PAIR `[rug, mat]` added (§3).**                                                                                                                |
| pan     | jug                        | Both kitchen-handled. **Low risk** — pan is shallow disc + horizontal handle; jug is tall vessel + curved handle + spout. **Same-vowel-only rule keeps them apart.**                                                                                                                                                                                                                                                                |
| pan     | tub                        | Cross-category (pan = kitchen, tub = bathroom). **Low risk.**                                                                                                                                                                                                                                                                                                                                                                       |
| can     | cup                        | Cross-vowel + different shapes (can = cylindrical, cup = handled-vessel). **Low risk.**                                                                                                                                                                                                                                                                                                                                             |
| jam     | bun                        | Both food, different forms (jam-in-jar, bun-as-roll). **Low risk.**                                                                                                                                                                                                                                                                                                                                                                 |
| van     | bus                        | Already in `FORBIDDEN_PAIRS` (`['bus', 'van']`). **Same-vowel-only rule keeps them apart in trios.**                                                                                                                                                                                                                                                                                                                                |
| dad     | (no human in short-u pool) | **No risk.**                                                                                                                                                                                                                                                                                                                                                                                                                        |
| man     | (no human in short-u pool) | **No risk.**                                                                                                                                                                                                                                                                                                                                                                                                                        |
| bag     | bun                        | Different categories. **Low risk** — bag is soft tote with handle, bun is round bread roll.                                                                                                                                                                                                                                                                                                                                         |
| hat     | hut                        | **MODERATE-LOW risk.** Both have triangular silhouettes (hat = brim + crown; hut = A-frame walls + roof). But hat is wearable (compact, hand-sized at chip), hut is dwelling (door visible, larger proportions). At 96pt with PNG-embed source these should read clearly distinct. **Same-vowel-only rule keeps them apart in trios.** Cross-pack visual hygiene: keep hut clearly architectural (door is the load-bearing detail). |
| cap     | cup                        | Both small handheld objects. Cup has handle + open top; cap has visor + sweatband. Different categories (clothing vs. vessel). **Low risk.**                                                                                                                                                                                                                                                                                        |
| tag     | bug                        | Tag is flat paper with string; bug is insect with legs. **Low risk.**                                                                                                                                                                                                                                                                                                                                                               |

### vs. probe-pack (4 novel short-a probes)

| probe | short-u | Risk                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| nap   | bun     | Nap = sleeping figure (under blanket); bun = round bread roll. Different categories. **No risk.**                                                                                                                                                                                                                                                                              |
| rat   | bug     | Both small animals — but rat is mammal-with-tail, bug is insect-with-antennae. Different category at 96pt. **Low risk.**                                                                                                                                                                                                                                                       |
| map   | rug     | **MODERATE risk.** Both flat-rectangular paper-or-fabric objects. Picture-side discriminator: map has visible landmasses / continents; rug has fringe + geometric pattern. **Same-vowel-only rule keeps them apart in trios** (map is short-a, rug is short-u). Cross-pack visual hygiene: rug must not collapse to "patterned rectangle" — fringe is the load-bearing detail. |
| tap   | jug     | Tap = wall-mounted faucet (vertical spigot); jug = vessel with handle and spout. Different shapes. **Low risk.**                                                                                                                                                                                                                                                               |

### Summary: forbidden-pair additions

Two new entries to `wordPack.ts FORBIDDEN_PAIRS`:

```ts
['rug', 'mat'],   // ticket 86c9q5q2d — flat-rectangular floor coverings, fringe vs. plain
['tub', 'cup'],   // ticket 86c9q5q2d — vessels in side profile (LOCKED 2026-05-08 per Devon's review, §10 Q3)
```

The `mom-dad` pair from short-o stands; the rest of `FORBIDDEN_PAIRS` is unchanged.

---

## 6. Canon-bake plan

Following PR #135 / PR #155's pattern, `cvc-words-short-u` needs a baked canon JSON to keep cold-start session-fetch under 500ms.

### File path

`public/canon/word-song/level-1/cvc-words-short-u.json` — mirrors the existing `public/canon/word-song/level-1/cvc-words-short-o.json` (audited 2026-05-08).

### Bake-list addition

`scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` currently lists:

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
]
```

Append `'cvc-words-short-u'`:

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
]
```

The `generateSessionCanon.test.ts` regression test pins this list against `_planner.ts VALID_WORD_SONG_FOCUS_NODES` — the planner change has to land in the same PR for CI to stay green. (This is a one-PR delta; the parser already accepts `"Read the <word>."` per PR #132, so the parser-first concern from `parser-widening-plan.md` does not apply. The new word _list_ widens, not the _content type_.)

### Bake cost

Per `scripts/generateSessionCanon.ts` header §Cost: ~1 Haiku call + ~59 Azure TTS S0 calls per combo. Adding one combo (level-1 × cvc-words-short-u × childName="Marian"):

- Haiku: ~$0.005–$0.01 per combo (input + output ~2k tokens).
- Azure TTS S0: ~59 short utterances × ~50 chars ≈ 2.9k chars × $16/1M chars ≈ $0.05.
- **Total: ~$0.05–$0.06 per bake regen for this one combo.** Same ballpark as short-o.

Well within `project_anthropic_billing_constraint` since canon is rare-regen and the Vercel deploy serves the committed JSON.

### Bake trigger

A canon regeneration is required when:

- The planner system prompt changes the short-u word list, problem template, or chatter shape.
- Emma's voice config changes (rare).
- The first-short-u-session Emma intro line is finalised (per §4 Stage definitions — the `/ʌ/` introduction line lands as a planner-template constant, not an in-flight string).

The first regen happens with the impl PR (Kevin's). Subsequent regens are part of normal canon hygiene (`project_canon_commit_strategy`).

---

## 7. Visual design — same as v1 cvc-words and cvc-words-short-o

**Default: keep the visual layout identical to the existing `cvc-words` and `cvc-words-short-o` screens.** The screen is text-card (the printed CVC word) + 3 picture chips below. No bespoke short-u theming.

### Why the default is the right call for v3

Same argument as the short-o spec §7: when introducing a new vowel, _don't change the screen too_. Marian arrives at `cvc-words-short-u` with one new thing to learn (the vowel) and the rest of the surface unchanged. Re-themed screens for each vowel would itself become a cognitive-load cost — pure friction with no pedagogical return.

### Visual exceptions — none

Considered and **rejected for v1**:

- Highlighting the `u` letter in a different colour. Rejected for the same reason short-o §7 rejected the `o` highlight: inconsistent with how short-a was introduced; risk of reading as "this letter is wrong."
- A new background colour for short-u sessions. Rejected — adds variety for variety's sake; CLAUDE.md "Backgrounds (v1): 3 total" rule applies.
- A "new vowel" badge on the session-open card. Rejected — adds chrome and reading load.

**Net visual delta vs. shipped cvc-words-short-o: zero.** The only changes are the word pool and the picture-pack contents.

---

## 8. Out of scope / cross-vowel mix preview / what this spec does NOT propose

Per the brief AC7, explicitly listing out-of-scope items so they don't get conflated:

### Out of scope (deferred to other tickets)

- **Cross-vowel distractor mixing** (e.g. mixing short-a or short-o chips with short-u targets) — out of v1 per `short-o-pool-expansion.md` §8. Tracked as ticket `86c9m3aek`.
- **Novel-pool word changes** — no changes to the 4 novel-pool short-a probes (`nap, rat, map, tap`). Those serve the `cvc-words` graduation gate ONLY. No equivalent novel-pool gate is needed for short-u → short-i transition (the graduation-gate exists specifically to verify generalization out of short-a; subsequent vowel transitions are standard mastery-rule per §4).
- **Changes to short-a or short-o pools** — both pools are locked. This spec adds short-u as a new sibling tier; existing tiers are not modified.
- **Picture-pack work for vowels other than short-u** — short-i and short-e are tracked in `design/word-song/README.md` §Future work but not authored here. Each gets its own pool-expansion spec when scoped.
- **React component changes** — Kevin handles canon + planner + sibling-node wiring AFTER this spec lands. Devon handles `wordPack.ts` entries + picture-embedding via `yarn embed-pictures` AFTER Thomas's MJ pass. The existing `cvc-words` / `cvc-words-short-o` screen renders short-u unchanged.
- **Wider literacy-tree expansion** — `digraphs`, `sight-words`, `simple-sentences` stay as `letter-sounds`-style stubs in the planner per `parser-widening-plan.md` §"Future tiers." Out of v1.
- **Audio-before-text "silent text window" intervention** — separate Kyle ticket; not blocking this spec.
- **First-encounter Emma scaffolding for individual short-u words** — short-u has no decoding-load words analogous to short-o's `box`/`fox` (per §4). The vowel-introduction line at session-open is the only scaffolding. **Note:** the `/u/` vs. `/ʌ/` minimal-pair opener (`sun, not soon`) is IN scope — see §4 "First-encounter `/u/` vs. `/ʌ/` minimal-pair scaffolding" + AC9b.
- **`/u/` vs. `/ʌ/` minimal-pair drills BEYOND the first-session opener** — repeated drill sessions for `/u/` vs. `/ʌ/` discrimination are future work post-v1. The single first-encounter opener line baked into the canon is in scope (§4); a recurring drill program is not.
- **Leitner-for-literacy** — math facts have a Leitner box (M4); literacy spaced-repetition is downstream. Out of scope.
- **Probe-word picture pack for short-u → short-i transition** — N/A. The graduation-probe gate exists only for `cvc-words` (short-a → short-o). No probe pack needed for short-u → short-i (or any subsequent vowel hop).

### Cross-vowel mix preview (tracking only, not scope)

Per Dave's review §6 P2: cross-vowel distractors test vowel discrimination ("a different and slightly harder skill, which is appropriate once short-a is consolidated"). Once Marian has consolidated multiple vowels (short-a + short-o + short-u all `mastered`), cross-vowel mixing becomes pedagogically apt. Until then, same-vowel-only is the right v1 posture.

The matrix expansion to support cross-vowel distractors is mechanical once the design lands — `TARGET_PAIRINGS` rows can carry cross-vowel distractor entries, and `wordDistractors.ts` already supports it because the distractor functions read directly from the matrix. The constraint is design-level, not engineering-level.

---

## 9. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them. Mirrors short-o spec §9.

- [ ] **AC1.** `WordSongNode` union in `src/lib/progress/types.ts` includes `'cvc-words-short-u'`. `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER` both have `'cvc-words-short-u'` between `'cvc-words-short-o'` and `'digraphs'`.
- [ ] **AC2.** `api/_planner.ts WORD_SONG_TRACK_GUIDE` adds a `cvc-words-short-u` branch emitting `"Read the <word>."` problems from the 11-word short-u pool. The 11 words match this spec §1 final pool exactly. `VALID_WORD_SONG_FOCUS_NODES` and `WORD_SONG_FIRST_CLASS_FOCUS_NODES` both gain the new node.
- [ ] **AC3.** `api/_plannerWordList.ts` exports a new `WORD_SONG_TARGET_WORDS_SHORT_U` constant matching the 11 words from §1 (`'sun, cup, bus, bug, nut, tub, bun, jug, rug, hut, gum'` — Q1 locked A, 11 words). The smoke test in `claude.test.ts` is extended to assert short-u words round-trip.
- [ ] **AC3b.** `api/_plannerWordList.ts WORD_SONG_DISTRACTOR_HINTS` gains a short-u rhyme-family block — same structural shape as the existing short-a block at [`api/_plannerWordList.ts:48-58`](#) (the comma-joined per-rhyme bullets). New short-u entries (Q1 locked A — all 7 lines ship):
  - `/ʌn/ rhyme family: sun, bun — pack these in the trap window when one is the target.`
  - `/ʌp/ rhyme family: cup.`
  - `/ʌs/ rhyme family: bus.`
  - `/ʌg/ rhyme family: bug, jug, rug — pack these in the trap window when one is the target.`
  - `/ʌt/ rhyme family: nut, hut.`
  - `/ʌb/ rhyme family: tub.`
  - `/ʌm/ rhyme family: gum.`
    The constant is conditioned on focus-node track at prompt-render time so short-a sessions don't see short-u rhyme hints (and vice versa). Source: §1 phonetic-spread table — the table already enumerates the rhyme families; this AC surfaces the data as an explicit planner-prompt artifact. The deliberate `/ʌg/` triplet (bug/jug/rug, per §1) is the load-bearing reason short-u needs its own block — short-o was 8 words with limited rhyme-family coverage and skipped this extension; short-u's tight `/ʌg/` cluster benefits from explicit Haiku ordering guidance the way short-a's `/æt/` family does today.
- [ ] **AC4.** `src/screens/WordSong/wordPack.ts` adds 11 short-u entries: 8 new (`bug, nut, tub, bun, jug, rug, hut, gum`) plus 3 promoted-from-distractor (`sun, cup, bus` flip `isTarget: true`). The 3 promoted entries also retain their old role (still pickable as distractors when the focus is short-a or short-o) — `isTarget: true` and distractor-pool membership are independent flags. Mirrors the short-o pattern (§3 of short-o spec).
- [ ] **AC5.** `wordPack.ts FORBIDDEN_PAIRS` adds two entries: `['rug', 'mat']` and `['tub', 'cup']` (both locked per §3 / §5; §10 Q3 LOCKED 2026-05-08 per Devon's review).
- [ ] **AC6.** `wordPack.ts TARGET_PAIRINGS` adds 11 entries for the short-u targets, drawing distractors from the short-u pool only (same-vowel constraint per §8). Defensive-audit step: each row passes `assertNotForbidden` against `FORBIDDEN_PAIRS` after the new entries land.
- [ ] **AC7.** 11 SVG picture assets at `public/assets/pictures/picture-{bug,nut,tub,bun,jug,rug,hut,gum,sun,cup,bus}.svg` via Thomas's MJ → remove.bg → `yarn embed-pictures` pipeline (Path 2) — 8 wholly-new files (`bug, nut, tub, bun, jug, rug, hut, gum`) plus 3 overwrites of existing PR #157 files (`sun, cup, bus` per Q2 locked A). `wordPictures.tsx` resolves all 11 short-u keys without hitting the inline-SVG fallback. Phase 2 fallback if `gum` picture is unstable: drop to 10 (7 wholly-new + 3 overwrites).
- [ ] **AC8.** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` includes `'cvc-words-short-u'`. `generateSessionCanon.test.ts` regression stays green.
- [ ] **AC9.** Canon JSON ships at `public/canon/word-song/level-1/cvc-words-short-u.json` after a fresh bake. The PWA cold-start session-fetch for short-u is under 500ms (matches the existing cvc-words / cvc-words-short-o canon-hit benchmark).
- [ ] **AC9b.** Emma's session-1 opener for `cvc-words-short-u` includes a `/u/` vs. `/ʌ/` minimal-pair contrast line — _"Listen carefully: 'sun' — not 'soon.' Sun! /s/-/ʌ/-/n/."_ — baked into `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts` as a planner-template constant for the short-u tier (same shape as short-o's `box`/`fox` `/ks/` first-encounter scaffolding mechanism). The line emits ONLY when the focus is `cvc-words-short-u` AND it is the first short-u session for this Marian; subsequent short-u sessions skip it. The "first time across her career" detection mechanism is shared with the short-o `box`/`fox` mechanism Kevin's impl spec is open on — short-u rides on the same `Progress`-field tracking. The opener is captured as part of the canon JSON at AC9 and loaded as a session-start utterance the same way other Emma chatter is. Source: `design/research/phonics-sequence-marian.md` lines 203-206 + 339; cross-doc reference: §4 of this spec.
- [ ] **AC10.** `src/lib/progress/mastery.ts applyMasteryRule` promotes `cvc-words-short-u` from `practicing` to `mastered` under the same per-track word-song threshold (default 90/3) used for `cvc-words` and `cvc-words-short-o` — no special-casing. The downstream `digraphs` node moves from `locked` to `intro` on promotion.
- [ ] **AC11.** No regression on existing `cvc-words` (short-a) or `cvc-words-short-o` sessions. Snapshot of `cvc-words.json` and `cvc-words-short-o.json` canon stays unchanged across the short-u-adding PR.
- [ ] **AC12.** Planner-output regression tests (`api/_planner.test.ts` + `src/screens/WordSong/plannerRoundTrip.test.ts`) cover: (a) `cvc-words-short-u` focus emits 8 short-u problems, (b) every problem's read line matches `"Read the <word>."` and the word is in the short-u pool, (c) no short-a or short-o words leak into short-u sessions in v1, (d) every target.vowel === 'u', (e) every target resolves a gentle + trap distractor pair without throwing, (f) distractors stay inside the short-u pool (same-vowel rule).
- [ ] **AC13.** New e2e regression spec `e2e/cvc-words-short-u-regression.spec.ts` mirrors `cvc-words-short-o-regression.spec.ts` — 8 tests covering debug-seed routing, planner request shape, read-line caption, chip render, advance, 8-tap walk, focus persistence, same-vowel-only distractor policy lock. WebKit `test.skip` from test 3 onward (read-aloud-dependent), per `.claude/docs/testing-and-ci.md` §8.3.1.
- [ ] **AC14.** `e2e/_helpers/seedStorage.ts DEFAULT_SKILL_LEVELS` adds `'cvc-words-short-u': 'locked'` (mirrors `SKILL_NODES` widening rule per `.claude/docs/testing-and-ci.md` §4.1.1). `defaults.ts SCHEMA_FLOOR_NODES` also gains the entry per the **five-place sync rule** (`.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`"). `cloudSync.ts`'s private `withDefaultedSkillLevels` mirror gains the entry (place 5 of 5).
- [ ] **AC15.** Debug seed `cvc-words-short-u` added to `src/lib/debug/debugSeed.ts SEEDS` table — marks `letter-names`, `letter-sounds`, `blending-cv`, `cvc-words`, `cvc-words-short-o` all as `'mastered'`; sets `cvc-words-short-u` to `'practicing'`. Skips Greet (sessionCount → 1). Mirrors the `cvc-words-short-o` seed.

---

## 10. Open questions for Thomas

**Q1. Pool size — 11 vs. 14 vs. drop `gum`.** **LOCKED 2026-05-09 by Thomas (option A — ship 11).** The 11-word pool (sun, cup, bus, bug, nut, tub, bun, jug, rug, hut, gum) is the audit-derived strongest pool that still preserves `/ʌm/` representation via `gum`. The mass-noun risk on `gum` is mitigated by the wrapped-stick picture-chip (the same logical move that worked for `jam` from short-a). Phase 2 fallback to a 10-word pool (drop `gum`) stays documented as the contingency if Thomas finds the wrapped-stick read unstable at 96pt during Midjourney review — see §2.8 of the picture-pack prompt sheet for the regenerate-or-drop trigger. AC2/AC3/AC4/AC6/AC7/AC9/AC10/AC12/AC13 all reflect the 11-word ship; the §2 matrix preview's 11 rows are mechanical.

**Q2. Re-trace `sun`/`cup`/`bus` for cohesion?** **LOCKED 2026-05-09 by Thomas (option A — re-trace all three alongside the 8 new MJ generations).** Thomas chose retrace over defer; rationale: he wants the 11-word short-u pack to be visually cohesive within the tier (single MJ session, same model / prompts / style across all 11 chips). Acceptable cost: ~3 extra MJ generations on top of the 8 wholly-new ones, for a total of 11 generations in the new MJ session. The 3 existing `picture-{sun,cup,bus}.svg` files from PR #157 are overwritten via the same `yarn embed-pictures` step Devon runs in Phase 3. The picture-pack prompt sheet [`short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md) carries all 11 prompts (the original 8 plus 3 new entries for sun/cup/bus authored in the short-u sheet style); see §0 of that file for the cohesion rationale.

**Q3. `[tub, cup]` FORBIDDEN_PAIR — add now or after Phase 2 review?** **LOCKED 2026-05-08 per Devon's review (option A — add now).** Both are vessels in side profile. The cost-asymmetry favours add-now: cost-of-adding is one line in `wordPack.ts`; cost-of-not-adding-and-being-wrong is a Phase 2 round-trip + canon re-bake. If Phase 2 review confirms the discriminators (size + handle vs. feet) hold cleanly at 96pt, removing the entry is a one-line revert. Net: free insurance. AC5 includes `[tub, cup]` as part of the locked FORBIDDEN_PAIRS additions; the §2 matrix preview's `tub` row is pre-resolved to `trap: ['bug', 'jug']` to match.

**Q4. Distractor-only short-u entries — Reading A vs. Reading B.** **LOCKED 2026-05-08 per Devon's review (option B — use the 11-word pool as both target and distractor list).** The audit explicitly demonstrates Reading A doesn't yield 8 strong distractor-only candidates (every candidate has a stated defect — `pup` silhouette-collision with `dog`, `mug` cup-collision, `mud` mass-noun-instability). Reading B is structurally consistent with [`short-o-pool-expansion.md`](./short-o-pool-expansion.md) §8 (same-vowel-only). `wordPack.ts:312-341` shows that `DISTRACTOR_ONLY_WORDS` is a 4-entry minimal set, not an 8-entry-per-vowel set — Reading A would fight that shape. AC4 + AC6 reflect Reading B (the 11 short-u entries are simultaneously the in-tier distractor pool; no separate "distractor-only" list).

All four Qs are now locked. All AC items are mechanical (Kevin's impl ticket).

---

## 11. Provenance

- **Triggering doc:** ticket `86c9q5q2d` brief (this PR's design surface).
- **Vowel sequence:** `design/research/phonics-sequence-marian.md` §Q1 (`o → u → i → e` revised order, locked 2026-04-26 by Dave).
- **Word-list source:** Big City Readers (source 5 in phonics doc), `design/research/phonics-sequence-marian.md` §Application short-u list (`sun, cup, bug, mud, run, hug, nut, pup, cut, tub`) as starting point; audit drove the 11-word final pool.
- **Predecessor specs:**
  - `design/word-song/short-o-pool-expansion.md` (structural template — this spec mirrors it section-by-section).
  - `design/word-song/short-o-picture-pack-prompts.md` (companion MJ prompt sheet template).
  - `design/word-song/parser-widening-plan.md` (parser-first contract — N/A here, parser already widened).
  - `design/word-song/picture-pack-style-anchor.md` (style frame, locked).
  - `design/word-song/picture-pack-iteration-plan.md` (workflow — partially shifted to Path 2 PNG-embed for this pack).
  - `design/word-song/probe-word-picture-pack.md` (sibling per-vowel pack reference).
- **Locked memories:**
  - `project_planner_parser_contract` (parser before planner — N/A, parser already accepts the cvc-word template).
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — this pack ships PNG-in-SVG embed per the established Phase 3 path).
  - `project_spec_drift_decisions` K, L, M (existing locks carried forward).
  - `project_canon_commit_strategy` (canon committed to repo, manual regen).
  - `project_anthropic_billing_constraint` (canon bake cost ceiling).
  - `feedback_dispatch_brief_template` (this dispatch followed the doc-preload + findings-surface template).
- **Word-list source-of-truth files:**
  - `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_FOR_PROMPT` (short-a), `WORD_SONG_TARGET_WORDS_SHORT_O` (short-o).
  - `src/screens/WordSong/wordPack.ts TARGET_WORDS / DISTRACTOR_ONLY_WORDS / FORBIDDEN_PAIRS / TARGET_PAIRINGS`.
- **Tree source-of-truth:**
  - `src/lib/progress/mastery.ts LITERACY_TREE`.
  - `src/lib/progress/focusNode.ts WORD_SONG_NODES_IN_ORDER`.
  - `src/lib/progress/types.ts WordSongNode`.
- **Canon source-of-truth:**
  - `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES`.
  - `public/canon/word-song/level-1/cvc-words-short-o.json` (existing reference shape — short-u canon mirrors it).
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels"; `project_diagnostic_results` memory (April 2026); 2026-05-08 iPad signal: progressing on short-a, on track for short-o → short-u transition.
- **Picture-pack pipeline:** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" (Path 2 — PNG-in-SVG embed via `yarn embed-pictures` is Thomas's chosen path).
- **Five-place sync rule:** `.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`" + `.claude/docs/testing-and-ci.md` §4.1.1.
