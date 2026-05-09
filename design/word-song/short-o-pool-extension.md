# Word Song — short-o pool extension (8 → 11 words for cross-vowel mode floor)

**Ticket:** TBD — Matt to file the spec ticket and the impl ticket in parallel.
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #141 (short-o pool expansion spec, locked 2026-05-04), PRs #150–#157 (short-o impl + canon + picture pack), PR #170 (short-u picture pack ship), PR #174 (short-u canon-wiring sibling node), PR #175 (Dave's `cross-vowel-discrimination-threshold.md` research note).
**Companion specs:**
- [`design/word-song/short-o-pool-expansion.md`](./short-o-pool-expansion.md) — the v1 8-word pool this spec extends. **NOT replaced.** This spec is purely additive.
- [`design/word-song/short-u-pool-expansion.md`](./short-u-pool-expansion.md) — 11-word pool composition precedent (Q1 lock A, 2026-05-09).
- [`design/word-song/cross-vowel-mix-spec.md`](./cross-vowel-mix-spec.md) — §6 "≥ 11 entries each before cross-vowel mode fires" is the gate this extension unblocks.
- [`design/research/cross-vowel-discrimination-threshold.md`](../research/cross-vowel-discrimination-threshold.md) — Dave's PR #175 flag (the recommendation that triggered this ticket).
- [`design/word-song/short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md) — companion MJ prompt sheet for the 3 new pictures.

---

## 1. Why this spec, why now

### Why now — the cross-vowel-mode pool-size floor

Dave's research note merged in PR #175 (`design/research/cross-vowel-discrimination-threshold.md`) flags one explicit scope-note recommendation in §"Recommendations":

> **Open a follow-on scope note:** before cross-vowel mixing ships, ensure the short-o word pool expands from 8 to at least 11 words (matching short-u). Mastery on 8 words is a tighter ceiling. This is a content task, not a gate redesign.

`cross-vowel-mix-spec.md` §6 (the v1 cross-vowel mix design, locked at the time of authoring) cites the same gate condition: **same-tier pools must have ≥ 11 entries each before cross-vowel mode fires**. The cross-vowel mode predicate (`crossVowelMixingEnabled`) gates on per-aggregate-mastery (short-a + short-o + short-u all `mastered`) AND each pool ≥ 11. Short-a is at 14, short-u is at 11, **short-o is at 8** — so even after Marian masters all three CVC tiers, cross-vowel mode would refuse to fire because the short-o pool is one entry short of the floor.

This spec closes that gap by **adding 3 new short-o target words** to bring the pool from 8 → 11 — matching short-u parity and unblocking cross-vowel mode whenever Kevin's downstream impl-ticket lands.

### What this spec is NOT

- **Not a replacement** for [`short-o-pool-expansion.md`](./short-o-pool-expansion.md). The v1 8-word short-o pool (`dog, mop, log, pot, box, fox, mom, hot`) is locked and ships unchanged. This spec is purely additive — a 3-word **extension** that lands as new entries in `TARGET_WORDS`, new entries in `TARGET_PAIRINGS`, and 3 new picture-pack SVGs.
- **Not a re-trace** of the existing 8 short-o pictures. The PR #156 picture pack is locked. Only the 3 new words need MJ generation.
- **Not a cross-vowel mode implementation.** Cross-vowel mode is `cross-vowel-mix-spec.md`'s scope and `86c9m3aek`'s impl ticket. This spec only ensures the pool-size precondition is met when that work fires.
- **Not a graduation-gate change.** The `cvc-words` graduation gate stays at 8/8 short-a + novel-pool probe; short-o promotion stays standard mastery rule.
- **Not a rename, not a focus-node change.** `cvc-words-short-o` stays as the focus node; the 3 new words slot into the same node.

---

## 2. Current state audit (verified 2026-05-09)

The audit was run against the worktree at branch `design/short-o-pool-extension` (forked from `origin/main` at commit `f3fa2fd`).

**Source-of-truth file:** [`MarianLearning/src/screens/WordSong/wordPack.ts`](../../src/screens/WordSong/wordPack.ts) `TARGET_WORDS`.

**Current short-o entries (`vowel: 'o'`, `isTarget: true`):**

| #   | Word  | Origin                        | Picture asset (post-PR #156)               |
| --- | ----- | ----------------------------- | ------------------------------------------ |
| 1   | `dog` | Promoted from distractor      | `public/assets/pictures/picture-dog.svg`   |
| 2   | `mop` | Wholly new (PR #150)          | `public/assets/pictures/picture-mop.svg`   |
| 3   | `log` | Promoted from distractor      | `public/assets/pictures/picture-log.svg`   |
| 4   | `pot` | Promoted from distractor      | `public/assets/pictures/picture-pot.svg`   |
| 5   | `box` | Wholly new (PR #150)          | `public/assets/pictures/picture-box.svg`   |
| 6   | `fox` | Promoted from distractor      | `public/assets/pictures/picture-fox.svg`   |
| 7   | `mom` | Wholly new (PR #150)          | `public/assets/pictures/picture-mom.svg`   |
| 8   | `hot` | Wholly new (PR #150)          | `public/assets/pictures/picture-hot.svg`   |

**Total short-o targets on main: 8 entries.**

The brief's hypothetical "pool may already be 11 due to those promotions" is incorrect — the promoted-from-distractor entries (`dog, log, pot, fox`) are already counted inside the 8. The pool has been at exactly 8 since PR #155 shipped 2026-05-07.

**Gap to cross-vowel-mode floor: 11 − 8 = 3 words.**

---

## 3. New words proposed (3 entries)

### Audit framework

Same constraints as `short-o-pool-expansion.md` §1 audit (locked 2026-05-04, restated in `short-u-pool-expansion.md` §1):

1. **CVC pattern** by spelling (the `x = /ks/` exception for `box`/`fox` carried forward; not applicable to candidates here).
2. **Concrete noun** referent (no verbs — same rule that killed `hop, run, hug, cut, rub, jog` across prior audits).
3. **Picture-stable** — the chip-render at 96pt must read unambiguously as the target word, not as a near-neighbour.
4. **Vocab-cap aware** for an 8-year-old Tagalog L1 learner (CLAUDE.md ~200-word cap; picture-grounds-the-meaning is a known mitigator for stretch vocab — applied to `jam, hot, mom` previously).
5. **Distinct silhouette at 96pt** — no collision with already-shipped picture pack (short-a 14 + short-a probes 4 + short-o 8 + short-u 11 = 37 picture chips on disk).

### Brief-listed candidates — full audit

The brief listed `cot, hop, top, pop` as the four strongest realistic NEW CVC short-o candidates. Audit each:

| Candidate | CVC | Concrete | Picturable | Vocab realistic | Silhouette risk | Verdict |
| --------- | --- | -------- | ---------- | --------------- | --------------- | ------- |
| **`cot`** | ✓ (c-o-t) | ✓ (small portable bed) | ✓ — small frame + pillow + thin mattress; distinct from any shipped chip | Stretch — Tagalog primary is *kuna* (crib) / *kama* (bed); "cot" is an English-specific word the picture grounds. Same logical move as `hot` (property word grounded by picture) and `mom` (vocabulary anchored by picture-as-noun-form). Big City Readers + UFLI both include `cot` in standard short-o CVC lists. | Low — no canonical chip is a small bed. Distinct from `hut` (architectural) at 96pt because cot is sleeping-furniture-with-pillow, hut is dwelling-with-door-and-roof. | **KEEP** |
| **`hop`** | ✓ (h-o-p) | ✗ — verb. | n/a | n/a | n/a | **FAIL** — same verb-class rule that killed `run, hug, cut, rub, dug, jog` in short-u audit (`short-u-pool-expansion.md` §1) and `hop` in the original short-o spec (`short-o-pool-expansion.md` §1). Verb-class rule is structural, not negotiable. |
| **`top`** | ✓ (t-o-p) | ✓ (spinning toy) | ✓ — classic cone/inverted-cone spinning top with point at bottom + optional decorative stripe pattern; **picture must commit to spinning-toy referent**, not "top of" or "shirt-top" | Stretch — spinning-top toys are not as common in 2026 Manila as in mid-20th-century, but the toy is universal in picture books and Filipino kids see it via international media. The picture-grounds-the-meaning rule applies (same as `cot`). | Low — no canonical chip is a cone-with-point. Distinct from `box` (cuboid) at 96pt; distinct from `mop` (handle + fringe head) — different shapes entirely. | **KEEP** |
| **`pop`** | ✓ (p-o-p) | ✓ if rendered as **lollipop** (sphere on stick) | ✓ with **picture-brief commitment to lollipop** — sphere-on-stick is distinct silhouette | Stretch — "pop" = lollipop is a vocabulary-stretch reading (more commonly "pop" = soda or "popsicle" in some dialects); the picture-brief commitment to lollipop disambiguates. Filipino kids encounter lollipops via international media and convenience-store snacks. | **MODERATE** — brief flagged "could read as `cup` ambiguously." The risk is real if rendered as a soda-cup or as an open-top container. **Mitigation:** picture brief specifies lollipop (sphere on stick) — the stick is the load-bearing disambiguator vs. cup (which has a handle, no stick). At 96pt, sphere-on-stick is categorically different from handled vessel. | **KEEP — with picture-brief mitigation** |

**Verdict from the brief's 4: keep 3 (`cot, top, pop`), reject 1 (`hop` — verb).**

This gives the exact 3-word extension the cross-vowel mode floor needs. No fallback to the wider candidate pool (`cob, dot, jog, nod, rod, sock, lock, clock`) is required. Wider-pool alternatives were considered for completeness:

- `cob` (corn cob) — would work as a backup if `pop` is rejected; vocab risk + picture risk (corn-husk) similar to `cot`. Held in reserve as Phase 2 fallback if MJ generation produces an unsatisfiable lollipop chip — see §3.5 below.
- `dot` — abstract; weak vocabulary anchor; rejected in original short-o spec audit (`short-o-pool-expansion.md` §1).
- `sock`, `lock`, `clock` — all CVCC or CCVCC, not CVC by spelling. Skip.
- `nod`, `jog`, `rob`, `sob` — verbs. Skip.
- `bog`, `gob`, `mob` — vocab risk or inappropriate. Skip.
- `rod` — fishing rod; low-frequency for 8yo. Skip.

### Final extension — 3 new short-o words

| #   | Word  | Picture status | Picture-key | Category | Rhyme family | Notes |
| --- | ----- | -------------- | ----------- | -------- | ------------ | ----- |
| 9   | `cot` | NEW            | `cot`       | household | `/ɒt/`       | Small portable single-bed with simple frame + pillow + thin mattress. /ɒt/ rhyme expands to a triplet (already `pot, hot`) — strengthens trap-tier matrix coverage. |
| 10  | `top` | NEW            | `top`       | object   | `/ɒp/`       | Classic spinning toy — inverted cone with point at bottom and optional decorative stripe pattern. /ɒp/ rhyme expands to a pair (already `mop`) — fills the slot short-o was missing for `/ɒp/` matrix variety. |
| 11  | `pop` | NEW            | `pop`       | food     | `/ɒp/`       | Lollipop — sphere on stick, wrapper optional. **Picture brief commits to lollipop** (sphere + stick) for unambiguous chip-render. /ɒp/ rhyme triplet (`mop, top, pop`) — densest /ɒp/ cluster in the extended pool. |

### Why these three, in this order

- **`cot`** is the safest pick — concrete furniture noun, picture-stable, no silhouette collisions across the 37-picture corpus, fills out the `/ɒt/` rhyme family from a pair (`pot, hot`) to a triplet.
- **`top`** is next — concrete toy noun, picture-stable when committed to the spinning-toy referent, fills the `/ɒp/` rhyme family from a singleton (`mop`) to a pair.
- **`pop`** is third — needs the most picture-brief discipline (lollipop commitment) but, with that mitigation, completes the `/ɒp/` rhyme triplet (`mop, top, pop`) and gives the trap-tier matrix a dense /ɒp/ cluster mirroring short-u's /ʌg/ triplet (`bug, jug, rug`).

### Updated pool composition (post-extension, 11 words)

| #   | Word  | Vowel | Category   | Origin                | Rhyme family |
| --- | ----- | ----- | ---------- | --------------------- | ------------ |
| 1   | `dog` | o     | animal     | promoted-from-distractor | `/ɒg/`    |
| 2   | `mop` | o     | household  | wholly new (PR #150)  | `/ɒp/`       |
| 3   | `log` | o     | object     | promoted-from-distractor | `/ɒg/`    |
| 4   | `pot` | o     | kitchen    | promoted-from-distractor | `/ɒt/`    |
| 5   | `box` | o     | object     | wholly new (PR #150)  | `/ɒks/`      |
| 6   | `fox` | o     | animal     | promoted-from-distractor | `/ɒks/`   |
| 7   | `mom` | o     | person     | wholly new (PR #150)  | `/ɒm/`       |
| 8   | `hot` | o     | object     | wholly new (PR #150)  | `/ɒt/`       |
| **9**   | **`cot`** | **o** | **household** | **wholly new (this PR)** | **`/ɒt/`** |
| **10**  | **`top`** | **o** | **object**    | **wholly new (this PR)** | **`/ɒp/`** |
| **11**  | **`pop`** | **o** | **food**      | **wholly new (this PR)** | **`/ɒp/`** |

**Phonetic spread post-extension (rhyme-family coverage):**

| Rhyme family | Members (pre-extension) | Members (post-extension) | Member count |
| ------------ | ----------------------- | ------------------------ | ------------ |
| `/ɒg/`       | dog, log                | dog, log                 | 2            |
| `/ɒp/`       | mop                     | mop, top, pop            | **3**        |
| `/ɒt/`       | pot, hot                | pot, hot, cot            | **3**        |
| `/ɒks/`      | box, fox                | box, fox                 | 2            |
| `/ɒm/`       | mom                     | mom                      | 1            |

5 distinct codas (unchanged), but two new triplets (`/ɒp/` and `/ɒt/`) emerge — improved coverage parity with short-u (which has the `/ʌg/` triplet `bug, jug, rug`). The trap-tier matrix gets richer rhyme-cluster authoring options for `mop, top, pop` and for `pot, hot, cot`.

**Category spread post-extension:** 2 animals (`dog, fox`), 2 objects (`log, box, top`) → 3, 1 kitchen (`pot`), 2 household (`mop, cot`) → 2, 1 person (`mom`), 1 property/object (`hot`), **1 food (`pop`)** — adds the food category to short-o (previously absent), parity improvement vs. short-a (`jam`) and short-u (`nut, bun, gum`).

### Phase 2 fallback — drop `pop` if MJ chip is unstable

If Phase 2 visual review at 96pt shows the lollipop picture-chip reading ambiguously as `cup` (despite the picture-brief discipline), **the fallback is to drop `pop` and substitute `cob`** (corn cob — yellow cylinder with kernels + green husk peel). `cob` carries vocab risk (rejected in the original spec) but is picture-stable. Pool stays at 11. This keeps the cross-vowel mode floor satisfied even if the lollipop generation is unsatisfiable. The fallback substitution is a Phase 3 decision (Devon's call when running `yarn embed-pictures`) — not a v1-spec lock.

If both `pop` AND `cob` fail Phase 2 review, the pool drops to **10** entries (cross-vowel mode floor unmet by 1). This is the worst-case outcome and triggers a follow-up dispatch to file a re-extension ticket. Highly unlikely given the picture-brief discipline, but documented for completeness.

---

## 4. Picture-pack requirements

### Existing assets (audited 2026-05-09 against `public/assets/pictures/`)

Short-o pack already on disk (PR #156, no re-trace in scope):
- `picture-dog.svg`, `picture-mop.svg`, `picture-log.svg`, `picture-pot.svg`, `picture-box.svg`, `picture-fox.svg`, `picture-mom.svg`, `picture-hot.svg` (8 files).

**No re-trace of the existing 8.** The PR #156 pack is locked and ships unchanged.

### Asset format — Path 2 PNG-in-SVG embed (matches PR #156)

Per `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths," the locked path for short-o picture-pack work is **Path 2: Thomas-runs-PNG-embed-in-SVG via `yarn embed-pictures`**. This spec inherits that path. Picture-brief format mirrors `short-o-picture-pack-prompts.md` (PR #150) and `short-u-picture-pack-prompts.md` (PR #170).

Pipeline:
1. **Phase 1 (this PR):** [`short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md) — paste-ready MJ prompts for the 3 new words.
2. **Phase 2 (Thomas):** Single MJ session generates `cot, top, pop` source PNGs at ≥1024×1024, exported transparent at ~512×512 via remove.bg "Regular" output size.
3. **Phase 3 (Devon, downstream impl ticket):** `yarn embed-pictures design/references/picture-pack/transparent public/assets/pictures` — wraps each PNG into the `<svg><image href="data:image/png;base64,...">` shell at the canonical filename.

### Required new pictures (3)

| #   | Word | Path                                       | Notes |
| --- | ---- | ------------------------------------------ | ----- |
| 1   | cot  | `public/assets/pictures/picture-cot.svg`   | Small portable single-bed, three-quarter view, simple wood frame + pillow + thin mattress. NO bedroom scene. |
| 2   | top  | `public/assets/pictures/picture-top.svg`   | Classic spinning top, three-quarter view, inverted-cone shape with pointed bottom + decorative stripe band. NO motion-blur (toy at rest, not spinning). |
| 3   | pop  | `public/assets/pictures/picture-pop.svg`   | Lollipop — sphere on stick, three-quarter view, optional unwrapped wrapper. **Lollipop commitment is load-bearing** — the stick is the disambiguator vs. cup. |

**Total picture-pack PNG generations needed: 3** (or 4 if Phase 2 fallback to `cob` fires).

**File size estimate:** ~50–150 KB per asset at the Path 2 embed budget. Adding 3 SVGs at ~100 KB each ≈ 300 KB additional cache footprint. Well within `vite.config.ts` `maximumFileSizeToCacheInBytes: 4 MiB` and the cumulative ~3.4 MB short-u post-pack budget noted in `short-u-pool-expansion.md` §3.

**Pack-cohesion lever — `--cref` / `--sref` to short-a `dog` pose-zero.** Same as PRs #156 / #170. The 3 new short-o entries must look like visual siblings of the existing 8 short-o + 14 short-a + 11 short-u + 4 short-a probes (37 picture chips in the corpus). See [`short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md) §1.3.

---

## 5. NEW FORBIDDEN_PAIRS implications

Audit candidate pairs against the existing `FORBIDDEN_PAIRS` set on `main` (post-PR #170):

```ts
['cat', 'dog'],   // existing — both four-legged animals in side profile
['bus', 'van'],   // existing — both vehicles in side view
['pan', 'pot'],   // existing — both cooking vessels in three-quarter view
['cap', 'hat'],   // existing — both head-coverings, similar mass at 96pt
['man', 'dad'],   // existing — both human figures
['mom', 'dad'],   // short-o (PR #150)
['rug', 'mat'],   // short-u (PR #174) — flat-rectangular floor coverings
['tub', 'cup'],   // short-u (PR #174) — vessels in side profile
```

**Total: 8 entries.**

### Cross-pack hazard catalogue for the 3 new words

| New word | Existing word in corpus | Vowel mix | Silhouette collision at 96pt? | FORBIDDEN_PAIR action |
| -------- | ----------------------- | --------- | ----------------------------- | --------------------- |
| `cot`    | `pot`                   | short-o × short-o | Both household-furniture-scale items? **NO** — `cot` is a sleeping-bed (rectangular frame + horizontal mattress + pillow); `pot` is a cooking vessel (cylindrical + side handles). Categorically different. | None |
| `cot`    | `hot`                   | short-o × short-o | **NO** — `hot` is a steaming bowl (open vessel + steam-curls); `cot` is a bed. Different categories. | None |
| `cot`    | `tub`                   | short-o × short-u | Both household-bathroom-scale? **LOW-BORDERLINE** — `tub` is a free-standing footed vessel; `cot` is a horizontal sleeping-platform with a pillow. Different orientations (tub vertical-tall, cot horizontal-flat). At 96pt the orientation is the disambiguator. **Same-vowel-only rule keeps them apart in v1 trios** (cross-vowel mode is the eventual gate). | None v1; Phase 2 review reconfirms post-MJ generation. |
| `cot`    | `hut`                   | short-o × short-u | Both architectural-ish? **NO** — `hut` has roof + door + walls (architectural); `cot` is sleeping-furniture. Different shapes. | None |
| `cot`    | `mat`                   | short-o × short-a | Both flat-rectangular? **LOW** — `mat` is a thin flat rug; `cot` is a 3D bed-frame with mattress and pillow on top. Mat is 2D-flat, cot has clear vertical depth. | None |
| `cot`    | `rug`                   | short-o × short-u | Same shape concern as `cot ↔ mat`. **LOW** — same disambiguator (cot is 3D, rug is 2D). | None |
| `top`    | `box`                   | short-o × short-o | Both geometric objects? **NO** — `top` is a cone-with-point (vertical with tapered tip); `box` is a cuboid (square-ish with three faces visible). Categorically different shapes. | None |
| `top`    | `bag`                   | short-o × short-a | **NO** — `bag` is a soft tote with handle; `top` is a rigid cone toy. Different categories. | None |
| `top`    | `tag`                   | short-o × short-a | **NO** — `tag` is a flat parallelogram with string loop; `top` is a 3D cone toy. Different shapes. | None |
| `top`    | `hat`                   | short-o × short-a | Both have triangular silhouettes? **LOW-BORDERLINE** — `hat` has brim + crown (head-covering, wider at bottom); `top` is inverted cone (toy, point at bottom). The orientation flip (`hat` point-up via crown, `top` point-down via tip) is the disambiguator. **Same-vowel-only rule keeps them apart in v1 trios.** | None v1; Phase 2 review reconfirms. Cross-vowel mode hazard flag for matrix author (Kevin's impl ticket): avoid `[hat, top]` in `TARGET_PAIRINGS_CROSSVOWEL`. |
| `top`    | `cup`                   | short-o × short-u | **NO** — `cup` is handled vessel; `top` is cone toy with no handle, no opening. Different categories. | None |
| `top`    | `hut`                   | short-o × short-u | Both have triangular silhouettes? **LOW-BORDERLINE** — same hat-vs-top orientation discriminator inverted: `hut` has roof + walls + door (architectural triangle on rectangular base); `top` is pure inverted cone with tapered tip. Door + walls discriminate. | None |
| `pop`    | `cup`                   | short-o × short-u | **MODERATE per brief flag** — sphere-on-stick (lollipop) vs. handled vessel. Picture-brief mitigation: lollipop's stick is the load-bearing disambiguator; without the stick, the sphere alone could read as a cup at 96pt. **Picture-brief discipline is the mitigation; FORBIDDEN_PAIR addition would be overkill.** | None v1 — picture-brief carries the load. If Phase 2 review shows the stick collapses at 96pt, Phase 2 fallback to `cob` substitution per §3.5. |
| `pop`    | `tub`                   | short-o × short-u | **NO** — `tub` is large free-standing footed vessel; `pop` is sphere-on-stick. Different shapes entirely. | None |
| `pop`    | `jug`                   | short-o × short-u | **NO** — `jug` is handled vessel with spout; `pop` is sphere-on-stick. Different shapes. | None |
| `pop`    | `bun`                   | short-o × short-u | Both food + round? **LOW** — `bun` is round bread-roll with horizontal cross-seam on top; `pop` is sphere-on-STICK. The stick is the load-bearing disambiguator. Without the stick, the round-on-its-own would collide with bun. **Picture-brief discipline reconfirmed.** | None v1 — picture-brief carries the load. |
| `pop`    | `nut`                   | short-o × short-u | Both food + small? **LOW** — `nut` is oval shell with vertical seam line; `pop` is sphere-on-stick. Different shapes. | None |

### Decision — no new FORBIDDEN_PAIRS

**Net change to `FORBIDDEN_PAIRS`: zero.**

Rationale, mirroring `cross-vowel-mix-spec.md` §5 cost-asymmetry analysis:

1. **All borderline cases (`cot ↔ tub`, `top ↔ hat`, `top ↔ hut`, `pop ↔ cup`, `pop ↔ bun`) are mitigated by either the same-vowel-only v1 rule or by picture-brief discipline.** Adding speculative FORBIDDEN_PAIR entries would over-constrain the matrix author with no current pedagogical benefit.
2. **Cost-of-adding-now:** 1 line per pair; constrains the matrix author's options.
3. **Cost-of-adding-later (after Phase 2 visual review or real-iPad signal):** 1 line per pair + matrix-row update + e2e regression update.
4. **Cost-of-not-adding-when-needed:** A future cross-vowel-mode session might present a confusing trio. Mitigation: cross-vowel-mode work has its own §5 audit cycle (per `cross-vowel-mix-spec.md`); this extension stays out of that scope.

The 3 borderline cases are flagged to Kevin's impl ticket as known-hazards in the cross-vowel matrix authoring (when `86c9m3aek`'s impl ships). For this spec's scope (same-vowel-only short-o), they don't trigger.

### Same-vowel-only `TARGET_PAIRINGS` extension preview

`TARGET_PAIRINGS` gains 3 new rows (Kevin authors under impl ticket):

```ts
// Short-o pool extension (this spec) — same-vowel-only per short-o §8 rule.
cot: { gentle: ['box', 'fox'], trap: ['pot', 'hot'] },  // /ɒt/ rhyme triplet trap (cot/pot/hot)
top: { gentle: ['dog', 'mom'], trap: ['mop', 'pop'] },  // /ɒp/ rhyme triplet trap (top/mop/pop)
pop: { gentle: ['fox', 'log'], trap: ['mop', 'top'] },  // /ɒp/ rhyme triplet trap (pop/mop/top)
```

Defensive-audit:
- `cot`'s row: `[box, fox]` gentle (object + animal, different from sleeping-bed) — no FORBIDDEN_PAIR; `[pot, hot]` trap — `[pot, hot]` is not in FORBIDDEN_PAIRS, both are short-o, both share `/ɒt/` rhyme.
- `top`'s row: `[dog, mom]` gentle (animal + person) — no FORBIDDEN_PAIR; `[mop, pop]` trap — both /ɒp/.
- `pop`'s row: `[fox, log]` gentle (animal + object) — no FORBIDDEN_PAIR; `[mop, top]` trap — both /ɒp/.

The matrix author (Kevin) may swap pairs if Phase 2 visual review surfaces a collision. Spec lock here is the constraint shape, not the exact pairs.

---

## 6. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them. Mirrors `short-u-pool-expansion.md` §9 in condensed form (smaller scope: extend `TARGET_WORDS` + `TARGET_PAIRINGS`, add canon entries; NO new SkillNode, NO planner-tree change, NO picker change).

- [ ] **AC1.** `src/screens/WordSong/wordPack.ts TARGET_WORDS` adds 3 short-o entries: `cot, top, pop` (each with `vowel: 'o'`, `isTarget: true`, picture-key matching the word). Final short-o count: 11. Total `TARGET_WORDS` count post-extension: 14 short-a + 4 probe + 11 short-o + 11 short-u = **40 entries**. Existing 8 short-o entries (`dog, mop, log, pot, box, fox, mom, hot`) and their orderings are unchanged.
- [ ] **AC2.** `wordPack.ts TARGET_PAIRINGS` adds 3 new rows for `cot, top, pop` with same-vowel-only distractor pairs drawn from the 11-entry short-o pool (`dog, mop, log, pot, box, fox, mom, hot, cot, top, pop`). Each row passes `assertNotForbidden` against `FORBIDDEN_PAIRS`. Existing 8 short-o `TARGET_PAIRINGS` rows are unchanged.
- [ ] **AC3.** `wordPack.ts FORBIDDEN_PAIRS` is unchanged. No new entries (per §5 audit). Cross-vowel matrix hazard-flagging is deferred to the cross-vowel-mode impl ticket (`86c9m3aek`).
- [ ] **AC4.** `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_SHORT_O` widens from 8 to 11 entries: `'dog, mop, log, pot, box, fox, mom, hot, cot, top, pop'`. The `claude.test.ts` smoke test is extended to assert the 3 new words round-trip.
- [ ] **AC5.** `api/_plannerWordList.ts WORD_SONG_DISTRACTOR_HINTS` short-o block (if present) is updated with the new rhyme-family memberships: `/ɒt/` triplet (`pot, hot, cot`), `/ɒp/` triplet (`mop, top, pop`). Mirrors the short-u rhyme-family hint structure (`short-u-pool-expansion.md` §AC3b).
- [ ] **AC6.** Picture-pack: 3 new SVG assets at `public/assets/pictures/picture-{cot,top,pop}.svg` via Thomas's MJ → remove.bg → `yarn embed-pictures` pipeline (Path 2). `wordPictures.tsx` resolves all 3 keys without hitting the inline-SVG fallback. Existing 8 short-o picture files (`picture-{dog,mop,log,pot,box,fox,mom,hot}.svg`) are unchanged.
- [ ] **AC7.** Phase 2 fallback path documented: if `pop` MJ generation produces an unsatisfiable lollipop chip (silhouette collapses to `cup` at 96pt despite picture-brief discipline), Devon's Phase 3 step substitutes `cob` (corn cob) — picture-pack prompt sheet `short-o-picture-pack-extension-prompts.md` §2.4 carries the standby `cob` prompt. Pool stays at 11 entries via the substitution. The substitution is a Phase 3 decision, not a v1-spec lock.
- [ ] **AC8.** Canon JSON regenerates: `public/canon/word-song/level-1/cvc-words-short-o.json` is re-baked via `npm run canon:regen` (canon hits the widened 11-word pool via `WORD_SONG_TARGET_WORDS_SHORT_O` from AC4). The bake cost is the same one-combo cost (~$0.05–$0.06) as the original short-o canon (per `planner-and-canon.md` §"Bake cost"). Committed to the repo per `project_canon_commit_strategy`.
- [ ] **AC9.** No regression on existing `cvc-words` (short-a), `cvc-words-short-o` (short-o pre-extension), `cvc-words-short-u` (short-u) sessions. Snapshots of `cvc-words.json` and `cvc-words-short-u.json` canon stay byte-for-byte unchanged. The `cvc-words-short-o.json` snapshot CHANGES (widened pool); `plannerRoundTrip.test.ts cvc-words-short-o` round-trip test is widened to allow targets from the 11-word pool.
- [ ] **AC10.** No `WordSongNode` change. No `LITERACY_TREE` change. No `WORD_SONG_NODES_IN_ORDER` change. No `pickFocusNode` change. No new debug seed needed (the existing `cvc-words-short-o` debug seed at `src/lib/debug/debugSeed.ts` covers the widened pool — Marian still routes to short-o the same way).
- [ ] **AC11.** No `e2e/_helpers/seedStorage.ts DEFAULT_SKILL_LEVELS` change. No `defaults.ts SCHEMA_FLOOR_NODES` change. No `cloudSync.ts withDefaultedSkillLevels` change. **The five-place sync rule does NOT trigger** — this extension adds no new SkillNode (per AC10).
- [ ] **AC12.** Planner-output regression tests (`api/_planner.test.ts` + `src/screens/WordSong/plannerRoundTrip.test.ts`) cover: (a) `cvc-words-short-o` focus emits 8 problems drawn from the 11-word pool (mix of pre-existing 8 and new 3), (b) every problem's read line matches `"Read the <word>."`, (c) every word is in the 11-word short-o pool, (d) every `target.vowel === 'o'`, (e) no short-a / short-u / probe leakage, (f) every target resolves a gentle + trap distractor pair without throwing.
- [ ] **AC13.** e2e regression spec `e2e/cvc-words-short-o-regression.spec.ts` is extended (or a sibling `cvc-words-short-o-extension-regression.spec.ts` is added) to cover: (a) post-extension debug-seed routing into a `cvc-words-short-o` session, (b) the 3 new words can each appear as the target across multiple seeded session walkthroughs (use `?seed` to force specific session plans), (c) chip render works for the 3 new picture chips, (d) same-vowel-only distractor policy lock holds (no short-a / short-u leak). WebKit `test.skip` from test 3 onward (read-aloud-dependent).

---

## 7. Out of scope

Per the brief and mirroring `short-u-pool-expansion.md` §8 / `short-o-pool-expansion.md` §8 structure:

- **Cross-vowel mixing** — `cross-vowel-mix-spec.md` and ticket `86c9m3aek` own that scope. This extension only ensures the pool-size precondition is met.
- **Re-trace of the existing 8 short-o pictures** (`dog, mop, log, pot, box, fox, mom, hot`). PR #156 pack is locked.
- **Changes to short-a, probe-pack, or short-u pools** — all locked.
- **Sibling-node or focus-node renaming.** `cvc-words-short-o` stays as the focus node.
- **`mastery.ts applyMasteryRule` change.** The 90/3 short-o rule is unchanged.
- **Picker change.** `pickFocusNode` is unchanged.
- **Graduation-gate change.** The `cvc-words` graduation gate (short-a → short-o transition with novel-pool probe) is unchanged.
- **Wider literacy-tree expansion.** `digraphs, sight-words, simple-sentences` continue as planner-stub nodes per `parser-widening-plan.md`.
- **Audio-before-text "silent text window" intervention.** Separate Kyle ticket; not blocking.
- **First-encounter Emma scaffolding for individual short-o words.** None of `cot, top, pop` carries decoding-load analogous to `box`/`fox`'s `/ks/` exception. Standard `"Read the <word>."` template applies.
- **Probe-word picture pack changes.** Probe pack (`nap, rat, map, tap`) is locked.
- **Leitner-for-literacy** — math-side feature (M4); literacy spaced-repetition is downstream.

---

## 8. Open questions for Thomas

Mirrors `short-u-pool-expansion.md` §10 in the cost-asymmetry-rationale format. Two are pre-locked-with-rationale (Q1, Q2); one is a genuine open question (Q3) for Thomas to confirm.

**Q1. Word selection — `cot, top, pop` vs. alternative substitutions.** **LOCKED with rationale (cost-asymmetry):** the brief explicitly listed `cot, hop, top, pop` as the four strongest realistic NEW CVC short-o candidates. The verb-class rule structurally excludes `hop` (same rule that killed `run, hug, cut, rub, dug, jog` in short-u audit). Of the remaining 3 (`cot, top, pop`), all three pass the audit with documented mitigations (`cot` vocab-stretch grounded by picture, `top` referent-discipline via picture-brief, `pop` silhouette-discipline via picture-brief). Wider candidate alternatives (`cob, dot, sock, lock, clock, etc.`) are weaker on at least one axis. Phase 2 fallback to `cob` is documented if `pop` fails MJ generation (§3.5). Cost-of-locking-now-and-being-wrong: 1 picture re-generation (~5 min Thomas time) at Phase 2; cost-of-not-locking: stalls the cross-vowel-mode unblock indefinitely. Lock wins.

**Q2. Pool size — exactly 11 vs. extending further to 14 (short-a parity).** **LOCKED at 11 with rationale (cost-asymmetry):** the cross-vowel-mode floor is `≥ 11` per `cross-vowel-mix-spec.md` §6 / Dave's PR #175 scope-note. 11 matches short-u parity. Extending to 14 would require sourcing 6 NEW short-o words (3 in this PR + 3 more), and the wider candidate pool (`cob, dot, sock, lock, etc.`) doesn't yield 6 strong entries — forcing 14 would drag in weaker entries with documented audit defects. 11 is the audit-derived strongest pool ceiling for short-o (mirrors short-u's 11). Cost-of-locking-at-11: cross-vowel mode fires at exactly the right floor; cost-of-extending-to-14: weak picture chips dilute the pool quality. Lock at 11.

**Q3. Phase 2 fallback policy — substitute `cob` automatically, or escalate?** **GENUINE OPEN QUESTION.** If `pop` MJ generation produces an unsatisfiable lollipop chip at Phase 2 review (silhouette collapses to `cup`), Devon's Phase 3 path has two options:
- **Option A — automatic substitution.** `short-o-picture-pack-extension-prompts.md` carries a standby `cob` (corn cob) prompt; Devon swaps in `cob` without escalation. Pool stays at 11. Spec is amended in a follow-up PR to reflect the substitution.
- **Option B — escalate to Thomas.** Devon flags the failure to Matt; Matt routes back to Thomas for substitution decision. Could result in dropping `pop` outright (pool at 10, cross-vowel-mode unmet) or a different substitution.

Cost-asymmetry: Option A unblocks downstream impl faster but commits to `cob` automatically (`cob` carries documented vocab risk in the original short-o audit); Option B preserves Thomas's call but adds a round-trip. Neither is wrong; lock-with-default needed. **Recommendation: Option A** — lollipop and corn-cob are both vocab-stretch picture-grounded entries, both audit-acceptable; the round-trip cost of escalation outweighs the marginal vocab-quality difference. But Thomas should confirm before Kevin's impl ticket dispatches.

---

## 9. Provenance

- **Triggering doc:** `design/research/cross-vowel-discrimination-threshold.md` (Dave, PR #175) §"Recommendations" — "ensure the short-o word pool expands from 8 to at least 11 words (matching short-u)."
- **Pool-size floor citation:** `design/word-song/cross-vowel-mix-spec.md` §6 (and §2.1 predicate shape) — "same-tier pools have ≥ 11 entries each before cross-vowel mode fires."
- **Predecessor specs (structural template):**
  - `design/word-song/short-o-pool-expansion.md` (the v1 8-word short-o pool — this spec extends it).
  - `design/word-song/short-u-pool-expansion.md` (11-word pool composition precedent + Q1-Q4 lock format).
  - `design/word-song/short-u-picture-pack-prompts.md` (companion MJ prompt sheet template).
  - `design/word-song/short-o-picture-pack-prompts.md` (sibling MJ prompt sheet, format reference).
  - `design/word-song/picture-pack-style-anchor.md` (style frame, locked).
  - `design/word-song/picture-pack-iteration-plan.md` (workflow + drift table — inherited).
- **Locked memories:**
  - `project_planner_parser_contract` (parser before planner — N/A here, parser already accepts cvc-word template).
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — extension uses Path 2 PNG-in-SVG embed per established pattern).
  - `project_spec_drift_decisions` K, L, M (existing locks carried forward unchanged).
  - `project_canon_commit_strategy` (canon committed to repo; one regen on this PR).
  - `project_anthropic_billing_constraint` (canon bake cost ceiling — ~$0.05–$0.06 per combo).
  - `feedback_dispatch_brief_template` (this dispatch followed the doc-preload + findings-surface template).
- **Word-list source-of-truth files:**
  - `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_SHORT_O` (widens 8 → 11).
  - `api/_plannerWordList.ts WORD_SONG_DISTRACTOR_HINTS` (gains updated rhyme-family memberships for short-o).
  - `src/screens/WordSong/wordPack.ts TARGET_WORDS / TARGET_PAIRINGS` (extends; FORBIDDEN_PAIRS unchanged).
- **Tree source-of-truth (UNCHANGED):**
  - `src/lib/progress/types.ts WordSongNode`.
  - `src/lib/progress/mastery.ts LITERACY_TREE`.
  - `src/lib/progress/focusNode.ts WORD_SONG_NODES_IN_ORDER`.
- **Picker source-of-truth (UNCHANGED):** `src/lib/progress/focusNode.ts pickFocusNode`.
- **Canon source-of-truth (re-baked, not extended):** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` already lists `'cvc-words-short-o'`. The canon bake hits the new 11-word pool via `WORD_SONG_TARGET_WORDS_SHORT_O` — no script change.
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels"; `project_diagnostic_results` memory (April 2026); 2026-05-09 iPad signal.
- **Picture-pack pipeline:** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" (Path 2 — PNG-in-SVG embed via `yarn embed-pictures`, established by Thomas in PR #156 / #170).
- **Five-place sync rule:** `.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`" + `.claude/docs/testing-and-ci.md` §4.1.1 — does NOT trigger here (no new SkillNode).
- **Cross-vowel mode predicate gate:** `cross-vowel-mix-spec.md` §2.1 `crossVowelMixingEnabled(progress, focusNode, parentSettings)` — this extension makes the pool-size precondition reachable for short-o.
