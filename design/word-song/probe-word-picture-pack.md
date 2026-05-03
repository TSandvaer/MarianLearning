# Word Song — novel short-a probe-word picture pack

**Ticket:** TBD (Matt is filing — this doc is the design surface; impl is downstream).
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #135 (cvc-words first-class shipped), PR #139 (developmental review merged 2026-05-02), PR #141 (short-o pool expansion spec — defines the 3-stage graduation flow that consumes these probes).
**Companion specs:** `design/word-song/short-o-pool-expansion.md` §4 (graduation flow), §5 (probe-word pre-requisites flagged forward), `design/word-song/README.md` (per-vowel pack skeleton + Midjourney pipeline), `design/word-song/picture-pack-style-anchor.md` (shared style frame).
**Unblocks:** Kevin's generalization-check ticket `86c9m3aec` (Dave's review §6 P1, Ticket 3) — without this spec, Kevin ships graduation-session probes with placeholder silhouettes; with this spec, the probe chips render as real picture-anchored vocabulary.

---

## Why this spec, why now

PR #141's short-o pool expansion locks the **3-stage graduation flow** that promotes Marian past `cvc-words` (short-a) into `cvc-words-short-o`:

```
Session N    : cvc-words (short-a) — canonical pool
Session N+1  : cvc-words (short-a) — graduation session with novel-word probe
Session N+2  : cvc-words-short-o   — first short-o session
```

Stage 2 (graduation session) requires **novel short-a probe words** — short-a CVCs Marian has not seen in the canonical pool. Per Dave's developmental review §4 Option A and §6 P1: "include 2–3 novel CVC words that Marian has not seen in the pool. … 50% correct on 2 novel items is a reasonable generalization signal." The probe verifies decoding-skill versus item-familiarity before promotion.

The short-o spec §5 explicitly forwards the probe-word picture-pack as a **separate Kyle ticket** so the short-o impl ticket can ship without picture-pack art being blocked. This is that spec.

**Scope of this spec:** word selection (audit + final pool), picture-pack pipeline, `FORBIDDEN_PAIR` updates against the canonical 14-word pack, distractor policy during graduation sessions, visual treatment, acceptance criteria. Out-of-scope items at the end.

---

## 1. Word selection — audit of the brief's 5 candidates

The brief proposes **`nap, cap, rat, map, tap`** as the 5 novel probe words. Audit against the same criteria as the short-o spec §1 (true CVC pattern, concrete-noun referent, vocab-cap aware per CLAUDE.md, picturable for an L2 8-year-old, distinct silhouette at 96pt) plus **the new criterion specific to probes: must NOT be in the canonical 14-word short-a pack** (otherwise it's not novel — it's an item Marian has already seen).

### Cross-check against the canonical 14-word pack

Canonical short-a pool from `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_FOR_PROMPT` (line 22) and `src/screens/WordSong/wordPack.ts TARGET_WORDS` (lines 69–168):

> cat, hat, bat, mat, bag, fan, man, pan, **cap**, can, tag, dad, jam, van

**Finding:** `cap` is **already canonical** — it's `wordPack.ts` line 127 (`pictureKey: 'cap'`, `isTarget: true`) and is in `WORD_SONG_TARGET_WORDS_FOR_PROMPT`. It also appears in `FORBIDDEN_PAIRS` (`['cap', 'hat']` — line 253) and as a trap distractor for `cat` (`TARGET_PAIRINGS.cat.trap`, line 284).

Including `cap` as a "novel probe word" would defeat the probe's purpose: Marian has been seeing `cap` for as long as she's been on `cvc-words`. The brief is mistaken on this one — and the short-o spec already caught it (§4, line 186): "**`cap` is already in the v1 14-word pack**, so use `nap, rat, map, tap` as the novel set."

### Per-word audit

| Candidate | True CVC  | Novel (NOT in canonical 14)                                                                                   | Concrete noun                                                                                                                                                                                                                      | Picturable                                                                                                                                                                                                                                                                                      | Vocab-cap aware                                                                                                                                                                                                                                                                        | Silhouette risk vs. canonical                                                                                                                                                                                                                                             | Verdict                                                                                                                                                                                                                                                                                                      |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **nap**   | ✓ (n-a-p) | ✓ — not in canonical pack                                                                                     | ⚠ Verb/state, not a noun. _A nap_ (the noun form) is the rest event, not a discrete object. The picture has to depict a sleeping figure, which Marian will read as "sleep" / "tulog" / "child" rather than as the mass-noun _nap_. | Marginal — depictable as a child curled up under a blanket with a `Z` motif, but the chip will read as the _act_ not the _noun_. The same bag-jam-tag mass-vs-count argument from the short-a pack applies, but more weakly: jam-in-a-jar is a thing-you-can-point-at; a-nap-being-taken isn't. | High-frequency word, in Marian's likely receptive vocabulary (Tagalog _idlip_ is the analogue).                                                                                                                                                                                        | Low — no canonical word maps to "sleeping figure" silhouette.                                                                                                                                                                                                             | **KEEP — with caveat.** Picture must depict the sleeping figure clearly, with the `Z` motif (visual onomatopoeia) carrying the disambiguation: this is a _nap_, not just a _child_. Otherwise it reads as mat (a child sleeping ON a mat) — see §3 forbidden-pair note. **Open question for Thomas:** §7 Q1. |
| **rat**   | ✓ (r-a-t) | ✓                                                                                                             | ✓ — discrete count noun, animal                                                                                                                                                                                                    | ✓                                                                                                                                                                                                                                                                                               | Familiar (Tagalog _daga_) — picture carries it for English vocab.                                                                                                                                                                                                                      | **HIGH** — rat is a four-legged animal in side profile. Canonical `cat` and `bat` are both four-legged-mammal silhouettes (actually `bat` is the small-flying-mammal Sanrio-style friendly; ambiguity here is moderate). `cat ↔ rat` is the obvious silhouette collision. | **KEEP** — but `rat ↔ cat` and `rat ↔ bat` need new `FORBIDDEN_PAIRS` entries (see §3).                                                                                                                                                                                                                      |
| **map**   | ✓ (m-a-p) | ✓                                                                                                             | ✓ — concrete object                                                                                                                                                                                                                | ✓ — paper sheet with country outlines / continents                                                                                                                                                                                                                                              | Borderline — a Manila 8yo recognises the _concept_ of a map, but the abstract land-shape rendering is more cognitive than e.g. _bag_. Picture must be unambiguous: rolled-out paper sheet with simple landmasses. Globe is the alternative — but a globe is round and reads as _ball_. | **HIGH** — `map ↔ mat` is a flat-rectangle silhouette collision PLUS a vowel-rhyme `/æt/`-vs-`/æp/` near-miss (one phoneme off). Marian could pick the wrong chip not because she misread but because the silhouettes are too close.                                      | **KEEP** — but `map ↔ mat` needs a `FORBIDDEN_PAIR` entry AND the picture needs strong distinguishing detail (paper-sheet-with-landmasses vs. plain rectangular rug).                                                                                                                                        |
| **tap**   | ✓ (t-a-p) | ✓                                                                                                             | ✓ — concrete object (faucet/spigot)                                                                                                                                                                                                | ✓ — wall-mounted faucet, water drop optional                                                                                                                                                                                                                                                    | Borderline — _tap_ is British/international English for _faucet_; American English calls it a faucet. Marian's exposure is more likely Filipino-English ("kitchen tap") than American — she'll know it. Picture carries the meaning if the rendering is unambiguous.                   | Low — no canonical word maps to "wall-mounted faucet" silhouette. `pan` and `pot` are both kitchen items but their silhouettes are concave-vessel shapes; tap is a vertical-spigot shape.                                                                                 | **KEEP** — no forbidden-pair concerns.                                                                                                                                                                                                                                                                       |
| **cap**   | ✓ (c-a-p) | ✗ — **ALREADY CANONICAL** in `wordPack.ts` `TARGET_WORDS` (line 127) and `WORD_SONG_TARGET_WORDS_FOR_PROMPT`. | n/a                                                                                                                                                                                                                                | n/a                                                                                                                                                                                                                                                                                             | n/a                                                                                                                                                                                                                                                                                    | n/a                                                                                                                                                                                                                                                                       | **DROP** — including `cap` defeats the probe purpose. Marian has been decoding `cap` since `cvc-words` shipped in PR #135.                                                                                                                                                                                   |

### Recommendation: 4 probe words, not 5

**Final probe pool: `nap, rat, map, tap`.** This matches the short-o spec §4 line 192 and is the smallest viable probe pool that supports Dave's "2–3 novel items per graduation session" recommendation.

**Why 4 instead of 5?** Three reasons:

1. **Picture production cost is real.** Each new picture is one Midjourney-iteration-plus-trace cycle (~30–60 min generation + ~20 min trace per the iteration plan). Adding a 5th word that is not strictly necessary is a cost without proportionate benefit.
2. **Pool of 4 is sufficient for the use case.** The graduation session pulls 2–3 probes per session. With 4 words, the planner can: (a) pick any 3-of-4 combination per session (4 distinct trios); (b) hold one word in reserve so a re-test (if Marian fails the first probe and the system loops her back through Stage 2) doesn't show identical items. 4 is the minimum that supports re-test variety; 5 adds one degree of freedom but is not load-bearing.
3. **Conformance with the short-o spec.** PR #141 already lists 4 probe words (`nap, rat, map, tap`) in §4. Expanding to 5 here would silently de-sync this spec from the gate flow defined upstream. If we want 5, we should re-open the short-o spec and the impl ticket together — but the case for that is weak (see point 2).

**Optional 5th word — if Thomas wants more sample-without-replacement headroom.** Best candidate from the remaining short-a CVC pool that is concrete, picturable, vocab-cap-aware, and distinct from canonical:

- **`ham`** — concrete food noun (cooked ham slab with bone). Parallels `jam` (food) in the canonical pack. Vocab risk: a Manila 8yo may know _ham_ from sandwich/breakfast contexts but it's lower-frequency than _jam_. Silhouette: oval-with-bone-end, distinct from any canonical chip. **Verdict if pursued:** moderate — pictureable but vocab-borderline.
- **`gap, lap, sap, sad, lad, pad, rad, sax, tax, dam, lab, gas, has`** — all rejected: verbs/adjectives (`gap`, `sad`, `pad`), abstract (`gas`, `has`), low-frequency for Manila 8yo (`sax`, `lab`, `dam`).

**Default recommendation: lock at 4 (`nap, rat, map, tap`).** If Thomas approves a 5th, `ham` is the only acceptable candidate. **Open question for Thomas:** §7 Q3.

### Phonetic spread audit within the final 4

| Probe word | Rhyme family | Canonical-pack rhyme-family overlap                |
| ---------- | ------------ | -------------------------------------------------- |
| nap        | `/æp/`       | overlaps with canonical `cap`                      |
| rat        | `/æt/`       | overlaps with canonical `cat`, `hat`, `bat`, `mat` |
| map        | `/æp/`       | overlaps with canonical `cap`                      |
| tap        | `/æp/`       | overlaps with canonical `cap`                      |

**Concern:** 3 of 4 probes are in the `/æp/` rhyme family, which has only one canonical member (`cap`). This is fine — a probe rhyming with a canonical word is the _good_ kind of probe (it tests onset discrimination, exactly the rime-analogy reading skill from Dave's §2). But if the planner picks all 3 `/æp/` probes for one session (`nap, map, tap`) the trio-set inside the chip group becomes a near-rhyme cluster, which Marian may navigate by elimination rather than decoding.

**Recommendation:** the planner's probe-picker should select **at most 2 probes from the same rhyme family per graduation session.** Concretely: of the 2–3 picked probes, the rule is "no more than 2 of `nap/map/tap`" — `rat` is automatically distinct. This is a small constraint Kevin's impl ticket inherits and is documented in AC4 below.

---

## 2. Picture-pack pipeline

### Existing assets (audited)

`public/assets/pictures/` contains exactly one real SVG: `pic-dog.svg`. The other 21 short-a pack pictures are inline-SVG silhouettes rendered by `wordPictures.tsx` (verified 2026-05-02 against the short-o spec §3). The probe pictures land into the same directory.

### Filename convention — `picture-{key}.svg`

**The renderer (`src/screens/WordSong/wordPictures.tsx` line 9) documents the canonical filename as `picture-{key}.svg`** for the future swap from inline placeholders to real SVGs:

> Real picture SVGs land in a future PR — when they do, they drop into `/public/assets/pictures/picture-{key}.svg` and this renderer swaps to `<img src=...>` per the same `pictureKey` that drives the placeholders.

The shipped `pic-dog.svg` is the legacy filename from the early picture-pack work — it predates the renderer's `picture-{key}.svg` convention. The short-o spec §3 (line 145) flags this as a Devon-confirms-rename item; this spec adopts the canonical name and lets the legacy file rename happen as part of Phase 3 of the short-a pack work, not here.

**Brief vs. canonical path discrepancy.** The brief proposed `public/assets/wordsong/pictures/pic-<word>.svg`. **Both halves are wrong:**

- No `wordsong/` subfolder exists or is used by the renderer; the canonical location is the flat `pictures/` directory.
- The renderer expects `picture-{key}.svg`, not `pic-{key}.svg`.

**Final paths for the 4 probe pictures:**

```
public/assets/pictures/picture-nap.svg
public/assets/pictures/picture-rat.svg
public/assets/pictures/picture-map.svg
public/assets/pictures/picture-tap.svg
```

(Plus `public/assets/pictures/picture-ham.svg` if Thomas approves the optional 5th per §7 Q3.)

### Visual style — match the canonical short-a pack

Inherit the locked style frame from `design/word-song/picture-pack-style-anchor.md` byte-for-byte:

- **Modern slice-of-life Korean manhwa / webtoon children's-book illustration** (the Emma tonal sibling).
- **Soft pastel palette** extending the existing `--my-rose / --my-cream / Emma-skin / Emma-hair / Emma-eye / Emma-mouth` family per the style anchor §3.3.
- **Single subject, centered, square 1:1 composition**, soft cream background (#FFF6EE) keyed transparent in Phase 3.
- **~2-2.5px outer contour at 1024×1024**, single soft cel-shading companion per color zone, light direction upper-left.
- **No anthropomorphisation, no faces on objects, no environmental detail, no text in the picture, no real character likeness.**

**No deviation from the style anchor for probe words.** The whole point of the probe is that Marian sees pictures that look like every other Word Song picture — same illustrator's hand, same warmth, same chip-rendering — so the only thing that differs from a regular session is the words themselves. A probe-specific visual style would tip Marian off that "this one is different" and corrupt the generalization signal.

### Source — Thomas's Midjourney pipeline (mirroring short-a + short-o packs)

Per `design/word-song/README.md` Phase model (Thomas-locked 2026-05-02): Midjourney generation, then SVG trace + integration. The probe-pack runs through the same pipeline on the same subscription cost (no incremental subscription — generation is hours-not-money).

**Recommendation: generate the 4 probe pictures alongside the short-o pack's 7 pictures.** Reasons:

1. **Style coherence.** Generating 11 pictures (7 short-o + 4 probes) in one Midjourney session inherits the same style-anchor seed and produces a single visually-coherent batch. Splitting the generation across two sessions risks the "21 fresh + 1 vintage" problem the README explicitly avoids.
2. **Workflow efficiency.** The iteration plan's preamble + drift table + escalation ladder costs Thomas the same energy whether he runs 7 pictures or 11; the marginal effort for the 4 extra is low.
3. **Cadence alignment.** Both the short-o tier and the probe pack are gated on Thomas's MJ pass. Bundling avoids two sequential Thomas-gates.

**If pipeline coupling is undesirable** (e.g., Thomas wants the short-o pack to ship first because the short-o tier impl ticket is hotter than the generalization-check ticket), the probe pack can run as its own MJ session — but inherits the short-o pack's locked-style outputs as anchor references to keep style drift minimal.

### File-size budget

**< 30 KB per SVG**, matching the short-o spec §3 trace constraint and `picture-pack-style-anchor.md` §6 "Trace target file size: <30 KB per picture." The brief said <40 KB; the actual codebase constraint is <30 KB (and the existing `pic-dog.svg` is well under). Following the tighter codebase constraint is the right call — PWA cache is at 4 MiB cap (`reference_pwa_asset_size_limits` memory) and every byte counts when the pack hits 26 files.

**SVGO config:** apply the codebase default config; verify single-root, single-viewBox, no raster-in-SVG (per the `project_character_pivot_emma_2026_04_28` PNG-in-SVG follow-up).

### Pipeline summary

| Phase                      | Owner                                        | Output                                                                                                                                  | Blocking dependency                                                                                                                                                          |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Prompt sheet            | Kyle                                         | `design/word-song/picture-pack-prompts-probe.md` (new file) — 4 prompt rows inheriting the style anchor                                 | Style anchor merged (already shipped in PR #126). This spec PR optionally absorbs the prompt sheet, OR the prompt sheet ships as a follow-up Kyle PR — Matt's call on scope. |
| 2. Midjourney generation   | Thomas                                       | 4 source PNGs (≥1024×1024)                                                                                                              | Phase 1 merged. **Recommendation: bundle with short-o pack's 7 generations into one MJ session.**                                                                            |
| 3. SVG trace + integration | Kyle (trace direction) + Devon (integration) | 4 `picture-{nap,rat,map,tap}.svg` files at `public/assets/pictures/` + `wordPictures.tsx` updates (new keys + renderer branches if any) | Phase 2 merged. **No `wordPack.ts` `TARGET_WORDS` entries** (probes are graduation-session-only — they should NOT enter the regular `cvc-words` pool); see §6 AC2.           |

---

## 3. `FORBIDDEN_PAIR` updates

The picture pack's `FORBIDDEN_PAIRS` list (`src/screens/WordSong/wordPack.ts` line 249) declares pairs that share a primary silhouette at 96pt and therefore must not appear in the same trio. The current list (5 pairs) is shipped against the canonical pack only; the probe pictures need new entries because they are picture-distinct from the canonical pack but introduce new silhouette neighbors.

### Probe-pair silhouette audit (probe ↔ canonical)

| Probe   | Canonical neighbour      | Reason for forbidden pairing                                                                                                                                                                                                                                                                                                                                                                                                                                                             | New `FORBIDDEN_PAIR`?                                                                                                                                                                                                                                                    |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **nap** | `mat`                    | A _nap_ picture (sleeping figure on a mat / floor) and a _mat_ picture both render as "rectangular surface plus optional figure." If the nap picture shows a child curled up _on_ a mat, the silhouette overlaps the mat picture. **Mitigation in the picture itself:** nap = blanket-with-`Z`-motif overhead, no visible mat under the figure. **Forbidden-pair entry as a backstop:** YES — even with mitigation, semantic overlap (both involve sleeping/floor surfaces) is too high. | **YES — add `['nap', 'mat']`.**                                                                                                                                                                                                                                          |
| **nap** | `dad` / `man`            | Sleeping figure ↔ standing figure / parent-with-child. Compositional difference is large (curled horizontal vs. upright vertical), but if the nap picture is rendered in a small tucked-in pose it could silhouette-collide with `dad`'s parent-holding-child compose at 96pt.                                                                                                                                                                                                           | **NO** — silhouette difference is sufficient; flag during phase 2 review.                                                                                                                                                                                                |
| **rat** | `cat`                    | Both are small four-legged mammals in side profile. Rat: pointed snout, long thin tail, smaller body. Cat: pointed-up triangular ears, whiskers, narrow muzzle, tail curled at base. **Picture-side discriminator:** rat has a visible long thin tail and pointed snout; cat has the prominent ear triangles. **Forbidden-pair entry:** YES — silhouette collision is real even with discriminators.                                                                                     | **YES — add `['rat', 'cat']`.**                                                                                                                                                                                                                                          |
| **rat** | `bat`                    | Both are small mammals with the Sanrio-style friendly rendering (per `project_spec_drift_decisions` K). Bat: small body, prominent wings, big eyes, no fangs. Rat: small body, no wings, long tail. **Picture-side discriminator:** wings vs. tail. **Forbidden-pair entry:** YES — small-rounded-body silhouette overlap is real.                                                                                                                                                       | **YES — add `['rat', 'bat']`.**                                                                                                                                                                                                                                          |
| **rat** | `dog`                    | Both four-legged side-profile mammals. Dog is in `DISTRACTOR_ONLY_WORDS` today; if it gets promoted to short-o targets per the short-o spec, it stays in the distractor pool for short-a graduation sessions. **Picture-side discriminator:** dog is larger, floppy ears, broader muzzle, tail down or wagging; rat is small, pointed snout, long thin tail.                                                                                                                             | **YES — add `['rat', 'dog']`.** Mitigation note: per short-o spec §1 `dog` becomes a short-o target; even when it does, `dog` remains pickable as a distractor in short-a graduation sessions per §3 distractor policy below, so the forbidden-pair guard still matters. |
| **map** | `mat`                    | Both flat-rectangular silhouettes at 96pt. Map: paper-sheet with simple landmasses + optional rolled corners. Mat: plain rectangular rug, no internal detail. **Picture-side discriminator:** map has internal landmass shapes; mat is flat. **Plus the rhyme-family confound:** `/æp/` vs. `/æt/` — Marian could pick wrong by mis-decoding the consonant cluster, not by mis-reading the picture. The forbidden-pair rule is the backstop.                                             | **YES — add `['map', 'mat']`.**                                                                                                                                                                                                                                          |
| **map** | `tag`                    | Tag is a small rectangular paper-with-string. Map is a larger paper-with-landmasses. Both are paper-rectangle silhouettes. **Picture-side discriminator:** tag has a visible string loop; map has landmass shapes. Borderline — discriminators are clear but the silhouettes _do_ overlap.                                                                                                                                                                                               | **CONDITIONAL — add `['map', 'tag']` if Phase 2 review confirms the silhouette collision after generation.** Default: YES, add it; remove if phase 2 review shows clear separation.                                                                                      |
| **tap** | `pan` / `pot`            | Tap is a wall-mounted faucet (vertical spigot with water drop). Pan is a shallow vessel with single handle. Pot is a deep vessel with two handles. **Picture-side discriminator:** vertical-spigot vs. concave-vessel — distinct silhouettes.                                                                                                                                                                                                                                            | **NO** — silhouette difference is sufficient.                                                                                                                                                                                                                            |
| **tap** | (no canonical neighbour) | No canonical word maps to "vertical spigot" silhouette.                                                                                                                                                                                                                                                                                                                                                                                                                                  | **NO new pair needed.**                                                                                                                                                                                                                                                  |

### Cross-probe forbidden pairs (probe ↔ probe)

Within the probe pool, the planner's same-graduation-session selection rule (§4) limits to 2–3 probes; cross-probe collisions matter inside that 3-chip set.

| Probe ↔ probe | Silhouette check                                           | New `FORBIDDEN_PAIR`? |
| ------------- | ---------------------------------------------------------- | --------------------- |
| nap ↔ rat     | sleeping figure vs. small mammal — silhouette-distinct.    | NO                    |
| nap ↔ map     | sleeping figure vs. paper rectangle — silhouette-distinct. | NO                    |
| nap ↔ tap     | sleeping figure vs. vertical faucet — silhouette-distinct. | NO                    |
| rat ↔ map     | small mammal vs. paper rectangle — silhouette-distinct.    | NO                    |
| rat ↔ tap     | small mammal vs. vertical faucet — silhouette-distinct.    | NO                    |
| map ↔ tap     | paper rectangle vs. vertical faucet — silhouette-distinct. | NO                    |

**No cross-probe forbidden pairs needed.** All four probe silhouettes are distinct from each other.

### Final `FORBIDDEN_PAIRS` additions

```ts
// In src/screens/WordSong/wordPack.ts FORBIDDEN_PAIRS:
['nap', 'mat'], // sleeping figure + floor surface — semantic + silhouette overlap
['rat', 'cat'], // both small four-legged mammals in side profile
['rat', 'bat'], // both small Sanrio-style friendly creatures
['rat', 'dog'], // both four-legged side-profile mammals (distractor-pool collision)
['map', 'mat'], // both flat rectangular silhouettes + /æp//æt/ rhyme confound
['map', 'tag'], // CONDITIONAL — confirm in phase 2 review; default include
```

**6 new entries** (5 firm + 1 conditional). The total `FORBIDDEN_PAIRS` count goes from 5 to 11 (or 10 if `['map', 'tag']` is dropped). Documented in AC5 below.

---

## 4. Distractor policy during graduation sessions

When a graduation session shows a probe word as the target (e.g., target = `nap`), the 3-chip set has 1 correct chip + 2 distractor chips. Question: **what are the 2 distractors drawn from?**

### Three options on the table (from the brief)

| Option                             | Distractors                                                                                                             | Pedagogy                                                                                                                                                                                                                   | Difficulty                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **A. Two canonical**               | both distractors from the canonical short-a pool (cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van) | Tests if Marian decodes the _novel probe_ without confusing it with familiar canonical words. The canonical chips are over-familiar; if she picks one, she defaulted to the familiar. If she picks the probe, she decoded. | **Highest signal**, lowest decoding load — probe vs. familiars is a clean familiarity-vs-decoding split. |
| **B. Two probes**                  | both distractors from the other 3 probe words                                                                           | Pure novel-pool challenge. Marian sees 3 probes she's never seen before.                                                                                                                                                   | **Highest decoding load**, lowest signal — all chips are unfamiliar; she's making a 3-of-3 cold decode.  |
| **C. Mix (1 canonical + 1 probe)** | 1 canonical + 1 other probe                                                                                             | Combines modes — partial familiarity backdrop with one extra novel chip.                                                                                                                                                   | Middle.                                                                                                  |

### Recommendation: **Option A — two canonical distractors.**

Rationale:

1. **Best signal-to-noise on the generalization gate.** Dave's §4 sets the generalization criterion at "50% correct on 2 novel items is a reasonable generalization signal." For that signal to mean what Dave intends — _Marian decoded the novel word_ — the trial format must isolate decoding from listening-comprehension and from familiarity-based guessing. Option A does exactly that: the probe is the only chip Marian could not have memorized from prior sessions; if she picks it, she decoded it.

2. **Aligns with Dave's task framing.** Dave's review §3 + §4 frames the graduation probe as a discrimination of _reading skill vs. item familiarity_. Option A leans into that framing — the canonical distractors are the deliberate familiarity backdrop the probe must outshine.

3. **Lower cognitive-load floor.** Stage 2 already introduces _one_ unfamiliar element (the probe word). Adding more unfamiliar chips (Options B/C) compounds the cognitive load and risks turning a generalization probe into a stress event. CLAUDE.md's "no dark patterns, generous and predictable" principle applies — the probe should test what it claims to test, not punish her with an over-loaded trial.

4. **Cross-checks against Dave's §2 distractor policy.** Dave's §2 endorses rime-family distractors for canonical sessions because they exercise onset discrimination. The same logic carries: in a graduation session, having canonical _rime-family_ distractors next to a probe target sharpens the probe's discriminative value. E.g., target = `nap`, distractors = `cap` + `bag` — onset and rime-family contrast carries the decoding work.

5. **Evidence-grounded preference.** The Dave-§4 Option A wording explicitly anchors on "novel CVC words … 50% correct on 2 novel items" — which presupposes the distractors are NOT also novel. Option A here is the same shape as Dave's recommendation; Options B/C drift away from it without evidence.

### Concrete distractor selection rule

For each probe target chosen in a graduation session, the planner picks 2 canonical distractors from the canonical 14-word pack (`TARGET_WORDS` + `DISTRACTOR_ONLY_WORDS` reduced to short-a, i.e., the 14 short-a targets) using the same gentle/trap matrix rules as canonical sessions, with these adjustments:

1. **No probe in the distractor slot.** Distractors come from canonical only. Other probes are reserved for their own target slots elsewhere in the session.
2. **Honor `FORBIDDEN_PAIRS` with the new probe entries (§3).** E.g., target = `rat` → distractors must not be `cat`, `bat`, `dog`. Target = `map` → distractors must not be `mat` or `tag`. Target = `nap` → distractors must not be `mat`.
3. **Prefer rime-family contrast, but allow cross-rime for disambiguation.** Default per the short-a `TARGET_PAIRINGS` matrix conventions: one rime-family-shared distractor + one cross-rime distractor. For probe targets, build the pair on-the-fly from the canonical pool.
4. **No probe-vs-probe in the same trio** (which Option A enforces by construction — distractors are canonical only).

### Why not Option B or C

- **Option B (two probes)** removes the familiarity backdrop entirely. Two of three chips would be words Marian has never seen. The trial becomes a cold 3-way decode, which is a _harder_ test than "decode the novel probe relative to known anchors." This shifts the generalization gate from a 50%-on-2-items signal to a 33%-baseline-cold-decode test — which is not what Dave specified. **Reject.**

- **Option C (1 canonical + 1 probe)** is the middle ground but loses the cleanness of Option A's pure familiarity-backdrop. It also creates the planner constraint problem that exhausts the probe pool fast: at 2–3 probes per session × 1 probe-as-distractor-per-trial = up to 6 probe-instances per session, against a pool of 4 words. The accounting is messy and the per-session probe-instance count balloons. **Reject.**

### Edge case: not enough canonical words

The canonical pack has 14 short-a words. Even after honoring `FORBIDDEN_PAIRS` for the worst-case probe target (`rat` excludes `cat`, `bat`, `dog` — leaving 11 canonical candidates from the 14), the distractor pool is plenty large. **No edge case.**

---

## 5. Visual treatment

**Default: identical to the canonical `cvc-words` screen.** The graduation session's visual surface is bit-for-bit the same as a regular `cvc-words` session — same word card, same 3 picture chips below, same Emma intro, same correct/error feedback, same `cvc-words` focus-node label. **Marian should not know which session is the graduation session.**

### Why no visual signaling

Per CLAUDE.md non-negotiables (no dark patterns, no infinite-scroll patterns, no fake urgency) and short-o spec §7's reasoning: **introducing a "this is the special session" visual cue would corrupt the probe's purpose.** The probe is the test of decoding skill; if Marian knows it's a test, she may apply effort she doesn't normally apply, and the high score doesn't generalize to her ordinary sessions. The probe is supposed to measure her steady-state decoding under normal conditions.

This is the same reasoning behind:

- **No "challenge!" badge** on probe items.
- **No Emma scaffolding** introducing a probe word as new ("This is a new word, try this one!"). Probe words appear without preamble, exactly like canonical words on a regular session.
- **No re-themed background, font weight bump, or color highlight** for probe trials.

### Net visual delta vs. shipped cvc-words: zero

The only delta is in the _content selection_ (which words appear, which distractors are picked) and in the _scoring telemetry_ (probe items flagged `isProbe: true` server-side so they don't pollute the main `successRate`). Neither of those is visible to Marian.

### What about Emma's scaffolding for `box` / `fox` style introduction?

Per the short-o spec §4 Stage 3, the FIRST short-o session has Emma scaffolding the new vowel ("This one says /ɒ/, like 'dog'") because it's a new vowel. The graduation session is **NOT** the first encounter with a new vowel — it's still short-a. Emma does not scaffold probe words. They appear in the trial as if they were canonical short-a words; the only thing Emma might do is the standard `read` line ("Read the rat.") — verbatim same template as canonical short-a.

**Open question:** if Marian misses a probe (or scores on it correctly with hint), does Emma's `hint` / `giveAnswer` line treat it as a canonical word or as a special probe? Default: treat exactly the same. Probes flow through the same utterance contract as canonical.

---

## 6. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them.

- [ ] **AC1.** 4 SVG picture assets land at `public/assets/pictures/picture-{nap,rat,map,tap}.svg`. Each file < 30 KB, single-root, single-viewBox, SVGO-cleaned, no raster-in-SVG. (5 files if Thomas approves the optional `ham` per §7 Q3.)
- [ ] **AC2.** `src/screens/WordSong/wordPictures.tsx` resolves all 4 probe `pictureKey` values (`nap, rat, map, tap`) to the new `<img src=...>` path **without** falling through to the inline-SVG placeholder. No new `wordPack.ts` `TARGET_WORDS` entries for the probe words — probes are graduation-session-only and live in a separate `PROBE_WORDS` constant (Kevin's impl decision; this spec asserts the constraint, not the wire-shape).
- [ ] **AC3.** A new `PROBE_WORDS` constant (or equivalent — Kevin's call) exports the 4-word probe pool with `pictureKey` matching the SVG filenames. Each entry is annotated `isTarget: false, isProbe: true` (or equivalent flagging) so the regular-session picker never picks them and the planner only emits them during graduation sessions per the §4 short-o-pool-expansion gate.
- [ ] **AC4.** Planner's graduation-session probe-picker selects **at most 2 probes from the same `/æp/` rhyme family per session** (i.e., of `nap, map, tap`, no more than 2 in any one graduation session). `rat` (`/æt/`) is always allowable independent of the count rule.
- [ ] **AC5.** `wordPack.ts FORBIDDEN_PAIRS` adds the 5 firm new entries: `['nap', 'mat'], ['rat', 'cat'], ['rat', 'bat'], ['rat', 'dog'], ['map', 'mat']`. The conditional 6th entry `['map', 'tag']` is added by default and may be removed by Phase 2 review. Total `FORBIDDEN_PAIRS` count: 10 or 11.
- [ ] **AC6.** Distractor policy during graduation sessions: for any probe target, both distractor chips are drawn from the canonical 14-word short-a pack (Option A per §4). No probe-vs-probe trios. `FORBIDDEN_PAIRS` (including the new probe entries) honored.
- [ ] **AC7.** Visual surface during graduation session matches canonical `cvc-words` bit-for-bit. No new badges, banners, color highlights, or Emma intro variants for probe items. Verified by snapshot regression on the cvc-words screen.
- [ ] **AC8.** No regression on canonical `cvc-words` sessions. The planner picks zero probe words when the focus node is `cvc-words` and the session is NOT a graduation session. Probe-flagged items NEVER appear outside graduation sessions.
- [ ] **AC9.** Picture-pack pipeline phase 2 (Midjourney generation) bundles the 4 probe pictures with the short-o pack's 7 pictures into ONE generation session, per §2 recommendation, unless Thomas elects to split (in which case the probe pack uses the short-o pack's outputs as anchor refs to minimize style drift).
- [ ] **AC10.** No new probe-word entries in `WORD_SONG_TARGET_WORDS_FOR_PROMPT` or `api/_plannerWordList.ts` exports. Probe pool is server-side and graduation-session-only — the regular planner system prompt does NOT include probes in the picker pool.

---

## 7. Open questions for Thomas

**Q1. `nap` despite the verb-state concern.** `nap` is a noun-form-of-a-verb; the picture has to depict a sleeping figure with a `Z` motif to disambiguate from "child" or "sleep" generally. **Question:** approve `nap` with the `Z`-motif picture mitigation, or substitute (best alternative: `ham` per §1 — a concrete food-noun that avoids the verb-state issue, with the trade-off that it's vocab-borderline for a Manila 8yo)?

**Q2. Distractor policy — Option A vs. Option B vs. Option C.** This spec recommends Option A (both distractors from the canonical short-a pack) per §4. **Question:** approve Option A, or override to Option B (both probes) or C (mix)?

**Q3. Optional 5th probe word.** This spec locks the probe pool at 4 (`nap, rat, map, tap`) for cost-and-conformance reasons. The case for a 5th is "more sample-without-replacement headroom for re-test variety." Best 5th candidate: `ham`. **Question:** lock at 4 (default), or expand to 5 with `ham`? If Q1 is answered "substitute `nap`", `ham` could replace `nap` instead of expanding.

---

## 8. Provenance

- **Triggering doc:** `design/research/cvc-words-developmental-review.md` (Dave, merged in PR #139, 2026-05-02) — §4 Option A (generalization-check via novel probes), §6 P1 (probe ticket scope).
- **Predecessor spec:** `design/word-song/short-o-pool-expansion.md` (PR #141) — §4 (3-stage graduation flow), §5 (probe-word pre-requisites flagged forward to this spec).
- **Phonics sequence:** `design/research/phonics-sequence-marian.md` §Q2 source 5 (Big City Readers) — short-a CVC list including `nap, rat, map, tap, cap`.
- **Locked memories:** `project_planner_parser_contract` (parser before planner — no parser change here, planner changes only), `project_pic_dog_svg` (SVG vector for all CVC pictures), `project_spec_drift_decisions` K (Sanrio-style friendly creatures), `reference_pwa_asset_size_limits` (PWA cache cap drives <30KB SVG budget).
- **Word-list source-of-truth files:** `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_FOR_PROMPT`, `src/screens/WordSong/wordPack.ts TARGET_WORDS / FORBIDDEN_PAIRS / TARGET_PAIRINGS`.
- **Filename convention:** `src/screens/WordSong/wordPictures.tsx` line 9 (canonical `picture-{key}.svg`).
- **Style inheritance:** `design/word-song/picture-pack-style-anchor.md` (locked style frame), `design/word-song/README.md` (Phase model + Midjourney pipeline).
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels".
