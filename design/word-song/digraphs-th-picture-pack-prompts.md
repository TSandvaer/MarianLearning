# Word Song — digraphs voiceless `th` /θ/ picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney Web operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory, step-by-step with 4-grid feedback per word per `feedback_mj_walkthrough_step_by_step` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** **RECONCILED Phase 1 prompt sheet — paste-ready, one prompt per word.** The companion word-list spec (`digraphs-th-word-list.md`) §0 reconciliation against Dave's `design/research/digraph-th-addendum.md` (the /θ/ phonics authority, landed on `main` at commit `8c43395`) is COMPLETE — AC0 is satisfied. This sheet is reconciled to match the locked 7-word pool: **`thin, thick, path, bath, math, moth, cloth`**. The reconciliation from the original DRAFT inventory: **`thumb` dropped** (Dave §3e/Recommendation 5 — silent `b`; it is the pool-extension word, not a v1 target) and **`cloth` added** (Dave §3d/§3f — short-o th-final fabric square; `hybridMode: true`). `thick` is now `hybridMode: true` (Dave §3e — double-digraph) — a schema flag that does not change how its picture is made. **MJ generation may now begin** (gating precondition cleared).
**Predecessor specs:** `design/word-song/digraphs-th-word-list.md` (sibling — defines the DRAFT 7-word pool, the load-bearing picture briefs, the picture-pack scope, and the §0 reconciliation gate), `design/word-song/picture-pack-style-anchor.md` (style frame — inherited verbatim), `design/word-song/digraphs-ch-picture-pack-prompts.md` (the immediately-prior digraph prompt sheet — **structural template, cloned section-for-section, MJ-parameter conventions inherited verbatim**), `design/word-song/digraphs-sh-picture-pack-prompts.md` (the original digraph prompt sheet — the §1.4 short-form preamble origin).
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14 — the parent research note; §Q3 carries the /θ/ error profile + the mouth-position-visual recommendation) AND `design/research/digraph-th-addendum.md` (Dave, 2026-05-14 — LANDED on `main`, commit `8c43395`; locked the 7-word pool and supplied the per-word picture-brief refinements in §3d / Recommendation 3 — esp. the `thin`/`thick` contrast-pair composition and the `cloth` fabric-square brief).

---

## 0. Scope — 7 wholly-new voiceless-th-words (RECONCILED against Dave's th-addendum)

This pack covers **7 wholly-new th-words** (no re-traces — none of these words exist as distractors in prior tiers):

> **`thin`, `thick`, `path`, `bath`, `math`, `moth`, `cloth`.**

**This is the RECONCILED, LOCKED pool** — the word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` is complete. The reconciliation from the original DRAFT inventory (`thin, thick, thumb, path, bath, math, moth`): **`thumb` dropped** (Dave §3e/Recommendation 5 — silent `b` violates one-new-element-per-session; `thumb` is the documented pool-EXTENSION word, not a v1 target) and **`cloth` added** (Dave §3d/§3f — short-o, th-final, picturable fabric square). The per-word prompt set below is reconciled to match: §2.3 is now `cloth` (was `thumb`).

**Total generations needed for this pack: 7** (locked — §0 reconciled).
**Total SVG file changes after Phase 3: 7 new** (`picture-{thin,thick,path,bath,math,moth,cloth}.svg`).

**TWO of the 7 are `hybridMode: true`** — `thick` (double-digraph: `th` + `ck`) and `cloth` (`/kl/` onset blend), per Dave's th-addendum §3e. **That is a `wordPack.ts`/planner schema flag — it changes NOTHING about how their pictures are made.** `thick`'s picture is a chunky single object; `cloth`'s is a fabric square; both are generated exactly like any other pack picture. Noted only so the asset count + schema expectations are clear.

**5 of the 7 carry a load-bearing picture brief** (word-list spec §3 — these are NOT optional polish; they are AC7 content in the word-list spec; reconciled against Dave's th-addendum Recommendation 3):

- `thin` — Dave Recommendation 3 / Risk 5 calls for a **contrast composition**: a thin item next to a thick one, with a clear indicator (arrow / label) pointing to the "thin" side — because `thin` is an adjective and a lone object risks reading as the object, not the property. (This is a refinement on the original "single object" brief — see §2.1.)
- `thick` — same contrast-pair composition, indicator pointing to the "thick" side (Dave Recommendation 3). `hybridMode: true` (schema flag; no picture impact).
- `math` — numbers / a simple sum / a small chalkboard with `2 + 2`; must read as "numbers", NOT "a school" or "a classroom".
- `moth` — a moth: fuzzy body, drab/muted colour, folded or flat wings, feathery antennae; must NOT read as a butterfly.
- `cloth` — a clean square of fabric with visible texture; single object on a clean background. Dave §3d flags the risk it reads as "blanket" / "fabric" — the brief must keep it a tight, clearly-bounded single fabric square. `hybridMode: true` (schema flag; no picture impact).

`path` and `bath` need standard single-subject briefs (no special composition concern beyond the disambiguation notes in §2.4 / §2.5). Dave Recommendation 3 adds: `bath` = a bathtub alone, **no child in the tub**; `path` = clearly a "path" not a "road".

**`thumb` is NOT in this pack** — it was in the DRAFT inventory but Dave dropped it from the opening 7 (§3e). The §2.3 prompt that was `thumb` is now `cloth`. `picture-thumb.svg` is NOT a Phase-3 deliverable for this pack.

---

## 1. MJ-parameter conventions — inherited verbatim from `digraphs-ch-picture-pack-prompts.md` §1

This prompt sheet inherits the MJ-parameter conventions locked in the `digraphs-ch` prompt sheet (which itself inherited them from the `digraphs-sh` sheet). They are re-stated compactly here; the sh sheet's §1 carries the full rationale + memory citations. **Do not revert to the pre-sh conventions (the short-e / short-u / short-o sheets ran 200+ word prompts — that was the antipattern the sh sheet corrected).**

### 1.1 v7 GUI workflow — NO `--v 6 --style raw --s 250 --ar` flags

Per `feedback_mj_moderator_negatives_per_word` memory. Set the 1:1 ratio in the MJ Web GUI dropdown, not as an `--ar` flag. v7 is the default in current MJ Web. Prompt pattern:

```
... [full prompt body] ... --no [per-word negatives]
```

### 1.2 NO `--cref / --sref / --cw 80` pack-cohesion flags

Per `feedback_mj_pack_cohesion_lever_unused` memory. The §1.4 style preamble (re-used byte-for-byte) is the cohesion mechanism. If Thomas finds drift across the 7 generations, the opt-in fallback is to capture a `bath` pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 6 — a Phase-2 escalation, not the default.

### 1.3 Per-word `--no` only — NEVER paste pack-wide negatives in one prompt

Per `feedback_mj_moderator_negatives_per_word` memory ("moderator trips on pack-wide negatives"). Each per-word prompt below has its OWN tailored `--no` list: the always-apply style negatives (short list per prompt) + the one per-word anti-anthro entry + the one per-word content negative. Do NOT concatenate per-word negatives across words.

### 1.4 ≤40-word body ceiling + ≤12-entry `--no` ceiling

Per `feedback_mj_moderator_negatives_per_word` memory. Two-ceiling structure (identical to the sh + ch sheets):

| Slot                             | Target                                                  | Why                                                    |
| -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Style preamble (§1.4 below)      | ≤14 words, byte-for-byte identical across all 7 prompts | Pack cohesion lever (no `--cref/--sref` fallback used) |
| Subject phrase + subject details | ≤22 words per prompt                                    | Subject identity load-bearing for the chip read        |
| `--no` list                      | ≤12 logical-concept entries per prompt                  | Empirically the moderator-safe ceiling                 |

Total body: ≤14 + ≤22 = ≤36 words — leaves 4 words headroom under the 40-word ceiling for word-specific safety phrases.

### 1.5 IP-name strip

Per `feedback_mj_moderator_negatives_per_word` memory. No prompt below mentions My Melody, Sanrio, Disney, Pixar, Studio Ghibli BY NAME. The short prompts use "modern children's-book illustration, soft pastel" as the style descriptor.

### 1.6 Always make remove.bg explicit

Per `feedback_mj_workflow_explicit_removebg` memory: MJ outputs ALWAYS have backgrounds. remove.bg (bgclear.ai canonical) is its own discrete step — see §3 Workflow steps.

### 1.7 Step-by-step walkthrough — one prompt at a time, wait for 4-grid feedback

Per `feedback_mj_walkthrough_step_by_step` memory. Each prompt below is in its own fenced code block, paste-ready, independently. When walkthrough time arrives (separate session, AFTER the word-list §0 reconciliation lands), hand Thomas one at a time, wait for the 4-grid screenshot, iterate if needed, then move on. Do NOT hand him all 7 in one batch.

---

## 1.4 Style preamble — short form (14 words; canonical full preamble in style-anchor §2)

Re-use this short-form preamble **byte-for-byte** across all 7 prompts in this pack — it is the **identical 14-word preamble locked in `digraphs-sh-picture-pack-prompts.md` §1.4 and re-used by `digraphs-ch-picture-pack-prompts.md` §1.4**. Re-using the exact sh/ch-sheet preamble (not a th-specific variant) maximizes cross-tier pack cohesion — the th pictures should sit visually alongside the sh + ch pictures and the five CVC packs as one coherent set, not form a separate-looking digraph sub-style:

> **Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text.**

14 words. Carries: style cluster (children's-book illustration, soft pastel, clean line art) = cohesion seed; cream-background = colour anchor; single-subject = compositional anchor; no-text = moderation safety. The aspect ratio (1:1) is set via the MJ Web GUI dropdown per §1.1, NOT in the preamble.

Each per-word prompt below appends a short subject phrase (≤22 words including subject-specific details) to this preamble. Total body stays ≤36 words.

**Note on `math`'s preamble:** `math`'s brief (numbers / a simple sum on a chalkboard) is the one word in the pack whose subject contains text-like content (the digits of a sum). The `--no` list for `math` must include `text` / `words` / `letters` while ALLOWING simple digits — see §2.6 for how the prompt threads this needle within the preamble's "no text" rule (digits-of-a-sum are treated as the subject, not as caption text).

---

## 2. Per-word prompts — paste-ready

The format per row (mirrors `digraphs-ch-picture-pack-prompts.md` §2 structure):

```
WORD — category — th-position cue — distinctness check — prompt (fenced block) — negatives — asset spec — notes
```

Each "prompt" is paste-ready into MJ Web — copy the fenced block, paste into the MJ prompt box, set ratio to 1:1 in the GUI dropdown, hit submit.

**ALL 7 prompts below are RECONCILED against Dave's th-addendum (§0 of the word-list spec — complete).** MJ generation may begin — the gating precondition is cleared.

---

### 2.1 `thin` — object (property) — `th-` initial, `/ɪ/` inside — CONTRAST-PAIR composition (Dave override)

- **Vocabulary cue:** A **contrast-pair composition** — a clearly THIN object beside a clearly THICK one of the same object class, with the thin one as the labelled / pointed-to subject. Dave's th-addendum (Recommendation 3, Risk 5) **overrides the original single-object brief**: `thin` is an adjective, and a lone object risks reading as the object ("bread", "stick"), not the property ("thin"). The contrast pair is what makes "thinness" the salient read.
- **PREAMBLE DEVIATION (documented):** this is the **one prompt in the pack that deviates from the §1.4 byte-for-byte preamble** — `single subject` is dropped because the contrast pair is intentionally two objects, and `multiple subjects` is removed from the `--no` list. This is the exact `chat`-precedent move the `digraphs-ch` sheet documented for its one social-action word. `thick` (§2.2) carries the identical deviation. All other 5 th prompts hold the full 14-word preamble.
- **Distinctness check:**
  - **vs. a generic object:** the THINNESS must be the salient feature. The side-by-side thick comparator + an arrow / size-label pointing to the thin one forces the property read.
  - **vs. `thick` (pack neighbor):** `thin` and `thick` are the SAME object class at opposite extremes. FORBIDDEN_PAIR `[thin, thick]` keeps them out of the same chip trio even though each picture internally shows the contrast.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, no text. A very THIN slice of bread beside a thick slice for comparison, a small arrow pointing to the THIN slice, the thinness clearly the main idea. --no anime, photorealistic, 3d render, busy background, watermark, whole loaf, smiling bread with face, three or more objects, kawaii sparkle eyes, realistic photo
```

- **Word-count check:** body 38 words (13-word deviated preamble + 25 subject); `--no` 10 logical-concept entries. Under the 40-word body ceiling and the 12-entry `--no` ceiling.
- **Negatives — what to avoid (10 concepts):**
  - **Whole loaf** (loses the slice-comparison cue — `whole loaf`).
  - **Anthropomorphised bread** (anti-anthro — `smiling bread with face`).
  - **Three or more objects** (the contrast pair is exactly TWO slices — `three or more objects`; note `multiple subjects` is intentionally NOT in this list, unlike the other prompts).
  - **Busy background** (cream background, just the pair — `busy background`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic bread** (`photorealistic`, `realistic photo`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-thin.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** `thin` is an ADJECTIVE — Dave Recommendation 3 / Risk 5 calls for a before/after contrast composition, NOT a single-object photo, because "the risk is that the picture reads as the object rather than the property." The thin-slice-beside-thick-slice + arrow is the load-bearing brief. **Generate `thin` and `thick` consecutively** so Thomas can confirm the two contrast pairs are visually consistent (same object class, mirrored composition). If 4-grid produces pairs where the thin/thick difference is not obvious, regenerate with "the thin one is paper-thin, the thick one is very fat, the difference is exaggerated" emphasis. **This is a genuine divergence from the original draft brief — Dave (the phonics authority) overrides; flagged for Thomas in §6.**

---

### 2.2 `thick` — object (property) — `th-` initial, `/ɪ/` inside — CONTRAST-PAIR composition (Dave override) — `hybridMode: true`

- **Vocabulary cue:** A **contrast-pair composition** — a clearly THICK object beside a clearly THIN one of the same object class, with the thick one as the labelled / pointed-to subject. Mirror of §2.1's `thin` composition. Dave's th-addendum (Recommendation 3) **overrides the original single-object brief** for the same reason — `thick` is an adjective and needs the property contrast to read.
- **PREAMBLE DEVIATION (documented):** like §2.1's `thin`, this prompt drops `single subject` from the §1.4 preamble (the contrast pair is two objects) and omits `multiple subjects` from `--no`. The two adjective prompts (`thin`, `thick`) are the only two preamble deviations in the pack; all other 5 hold the full 14-word preamble byte-for-byte.
- **Distinctness check:**
  - **vs. a generic object:** the THICKNESS must be the salient feature. The side-by-side thin comparator + an arrow / size-label pointing to the thick one forces the property read.
  - **vs. `thin` (pack neighbor):** SAME object class at the opposite extreme. FORBIDDEN_PAIR `[thin, thick]` — keep them out of the same chip trio.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, no text. A very THICK chunky slice of bread beside a thin slice for comparison, a small arrow pointing to the THICK slice, the thickness clearly the main idea. --no anime, photorealistic, 3d render, busy background, watermark, whole loaf, smiling bread with face, three or more objects, kawaii sparkle eyes, realistic photo
```

- **Word-count check:** body 39 words (13-word deviated preamble + 26 subject); `--no` 10 logical-concept entries. Under the 40-word body ceiling and the 12-entry `--no` ceiling.
- **Negatives — what to avoid (10 concepts):**
  - **Whole loaf** (loses the slice-comparison cue — `whole loaf`).
  - **Anthropomorphised bread** (anti-anthro — `smiling bread with face`).
  - **Three or more objects** (the contrast pair is exactly TWO slices — `three or more objects`; `multiple subjects` intentionally NOT in this list).
  - **Busy background** (cream background, just the pair — `busy background`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic bread** (`photorealistic`, `realistic photo`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-thick.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** `thick` is an ADJECTIVE — same Dave-Recommendation-3 contrast-pair brief as `thin`. **Generate `thin` and `thick` consecutively** so Thomas can eyeball the pair for visual consistency (same object class, mirrored composition). If 4-grid pairs don't read with an obvious thin/thick difference, regenerate with "the thick one is very fat, the thin one is paper-thin, the difference is exaggerated" emphasis. **Schema note for Devon/Kevin (NOT a picture concern):** `thick` is `hybridMode: true` in the reconciled word-list spec (§6.2 — `th` + `ck` double-digraph, recognition-only). This does NOT affect the picture; `thick`'s picture is made exactly as briefed above.

---

### 2.3 `cloth` — object (household) — `-th` final, `/ɒ/` inside — `hybridMode: true`

> **RECONCILED — this slot was `thumb` in the DRAFT.** Dave's th-addendum §3e/Recommendation 5 dropped `thumb` from the opening 7 (silent `b`); `cloth` is the locked 7th word (Dave §3d/§3f). The original `thumb` prompt is removed; `cloth`'s prompt is below.

- **Vocabulary cue:** A simple square piece of **cloth / fabric** with visible woven texture and soft folds — a single, clearly-bounded fabric square laid flat or slightly draped. Dave §3d: the picture must read as "cloth", NOT as a "blanket", a "towel", or an item of clothing.
- **Distinctness check:**
  - **vs. a blanket / towel / clothing:** the target is a plain SQUARE of cloth — keep it small, flat, and unbranded. A bed-sized blanket or a recognisable garment loses the "cloth" read (Dave §3d explicitly flags this).
  - **vs. `bath` (pack neighbor):** `cloth` is a flat soft fabric square; `bath` is a 3D rounded tub. Different mass + form — **no FORBIDDEN_PAIR needed** (the silhouettes are clearly distinct).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A single small square piece of CLOTH fabric with visible woven texture and gentle soft folds, laid flat. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, large blanket, folded towel, item of clothing, busy pattern, busy background, kawaii sparkle eyes
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Large blanket** (loses the small-cloth-square read — `large blanket`).
  - **Folded towel** (towel reads as a different object — `folded towel`).
  - **Item of clothing** (a shirt / dress is not "cloth" as a material — `item of clothing`).
  - **Busy pattern** (a loud printed pattern competes with the chip read — `busy pattern`; the texture should be a plain woven weave).
  - **Busy background** (single subject on cream — `busy background`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic fabric** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-cloth.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** `cloth` is the reconciled 7th word — short-o, word-final th, household-object class. Dave §3d: "a square of fabric is a picturable single object ... drop if it reads as 'fabric' or 'blanket' rather than 'cloth'." The load-bearing brief is a SMALL, plain, clearly-bounded fabric square with a simple woven texture — not a blanket, not a towel, not a garment. If 4-grid produces blankets or patterned textiles, regenerate with "a small plain square of cloth, clearly just a piece of fabric" emphasis. **Schema note for Devon/Kevin (NOT a picture concern):** `cloth` is `hybridMode: true` in the reconciled word-list spec (§6.2 — `/kl/` onset blend, recognition-only). This does NOT affect the picture; `cloth`'s picture is made exactly like any other household-object anchor.

---

### 2.4 `path` — object — `-th` final, `/æ/` inside

- **Vocabulary cue:** A simple winding dirt or stone path / trail — a clear walkable route curving through short grass. The trail-through-grass depiction.
- **Distinctness check:**
  - **vs. a road (NOT the target sense):** the target is a small natural PATH/trail, not a paved road with markings. The prompt forces the soft natural trail sense.
  - **vs. `bath` (pack neighbor):** `path` is a flat winding ground-trail; `bath` is a 3D tub object. Different mass + orientation. **No risk** — but FORBIDDEN_PAIR `[path, moth]` is the in-pool hygiene pair (`path` thin line vs `moth` small shape — both low-mass).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A simple winding dirt PATH trail curving gently through short grass, soft natural stepping route, warm earth tones. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, paved road with markings, cars or vehicles, people walking, busy landscape, city street, signpost with text
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Paved road with markings** (wrong sense — must be a soft natural trail — `paved road with markings`).
  - **Cars / vehicles** (second subjects + wrong-sense road cue — `cars or vehicles`).
  - **People walking on the path** (single subject — the path itself — `people walking`).
  - **Busy landscape / city street** (environment violation — must read as a single trail on cream — `busy landscape`, `city street`).
  - **Signpost with text** (moderation + chip-read risk — `signpost with text`).
  - **Photo-realistic terrain** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-path.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** A simple winding trail is the load-bearing "path" read — soft, natural, curving. The risk is MJ drifting to a paved road, a city street, or a busy landscape scene. The body's "winding dirt PATH trail through short grass" + the road/city negatives force the natural-trail sense. Keep it a single trail on a cream field — no full landscape. If 4-grid produces roads or busy scenes, regenerate. `path` is low-moderate risk — the road-drift is the main thing to watch.

---

### 2.5 `bath` — household — `-th` final, `/æ/` inside

- **Vocabulary cue:** A friendly cartoon bathtub — a rounded freestanding tub, often with little feet, a few soap bubbles. The storybook-universal bathtub object.
- **Distinctness check:**
  - **vs. a generic basin / sink (loses the bath read):** must be a clear full-size BATHTUB — rounded, freestanding, with bubbles — not a small basin or a sink.
  - **vs. `box` (short-o target, cross-pool):** `bath` is an open-topped rounded vessel; `box` is a closed cuboid. FORBIDDEN_PAIR `[bath, box]` locked in word-list §6 (cross-pool silhouette hygiene).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A friendly cartoon freestanding BATHTUB with little feet, a few soft soap bubbles floating above, rounded gentle shapes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, person bathing, small sink or basin, full bathroom scene, plain cardboard box, smiling tub with face, water splashing everywhere
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Person bathing** (second subject / human figure — the tub is the subject — `person bathing`).
  - **Small sink or basin** (must read as a full BATHTUB — `small sink or basin`).
  - **Full bathroom scene** (environment violation — single subject on cream — `full bathroom scene`).
  - **Plain cardboard box** (cross-pool collision with `box` — `plain cardboard box`).
  - **Anthropomorphised tub** (anti-anthro — `smiling tub with face`).
  - **Water splashing everywhere** (visual noise — a few gentle bubbles is enough — `water splashing everywhere`).
  - **Photo-realistic tub** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bath.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The freestanding-tub-with-little-feet + a few bubbles is the load-bearing "bath" read — it forecloses the sink/basin sense and reads as storybook-universal. A few gentle bubbles signal "bath" without the visual noise of a full splash. The `plain cardboard box` negative is required for the cross-pool `[bath, box]` hygiene. If 4-grid produces a sink, a full bathroom, or a person in the tub, regenerate. `bath` is low-moderate risk.

---

### 2.6 `math` — object (domain) — `-th` final, `/æ/` inside

- **Vocabulary cue:** A small friendly chalkboard or slate showing a **simple sum** — e.g. `2 + 2` — with the digits as the subject. Must read as "numbers / arithmetic", NOT "a school" or "a classroom".
- **Distinctness check:**
  - **vs. "a school" / "a classroom" (loses the math read):** the SUM/digits must be the salient feature — a small board with `2 + 2`, not a wide classroom scene.
  - **vs. any existing pack object:** a chalkboard with a sum is a unique silhouette in the whole pack. **No risk.**
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A small friendly chalkboard showing a simple sum two plus two, large clear digits, rounded wooden frame. --no anime, photorealistic, 3d render, multiple subjects, text words letters, watermark, classroom or school scene, teacher or children, complex equations, smiling chalkboard with face, busy background
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Text / words / letters** (the ONLY content on the board should be the simple-sum DIGITS — no caption text, no words — `text words letters`. The digits-of-a-sum are the subject, NOT caption text; this is the one word in the pack that threads the "no text" preamble rule — see §1.4 note).
  - **Classroom / school scene** (must read as the numbers, not the environment — `classroom or school scene`).
  - **Teacher / children** (second subjects — `teacher or children`).
  - **Complex equations** (must be a SIMPLE sum a child recognises — `complex equations`).
  - **Anthropomorphised chalkboard** (anti-anthro — `smiling chalkboard with face`).
  - **Photo-realistic chalkboard** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-math.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** `math` is a DOMAIN noun — the picture must ground it as "numbers / arithmetic", not "school". A small chalkboard with `2 + 2` in large clear digits is the recommended subject. **The preamble says "no text" but a simple sum's DIGITS are the subject** — the `--no text words letters` entry forbids caption text and lettering while the body explicitly asks for "large clear digits" as the subject. This is a deliberate, documented per-word threading of the no-text rule (§1.4 note) — analogous to how the ch sheet's `chat` documented its single-subject-rule deviation. If MJ produces a classroom scene, a board with words/letters instead of a clean sum, or complex equations, regenerate. `math` is moderate risk — the school-scene drift and the text-vs-digits distinction both need a 4-grid check.

---

### 2.7 `moth` — animal — `-th` final, `/ɒ/` inside

- **Vocabulary cue:** A simple friendly moth — a small insect with a **fuzzy body, drab/muted colouring, and broad flat or folded wings**. Side or top-down view.
- **Distinctness check:**
  - **vs. a butterfly (the competing insect — high risk):** `moth` is fuzzy-bodied, drab/muted-coloured, with broad flat or folded wings and feathery antennae; a butterfly is slender-bodied, brightly-coloured, with upright wings and club-tipped antennae. The fuzz + drab colour + flat wings are the load-bearing moth cues.
  - **vs. any existing pack object:** no insect in any prior pack — `moth` is a unique silhouette. The only risk is the moth-vs-butterfly read.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A simple friendly MOTH, fuzzy plump body, broad flat muted-brown wings, feathery antennae, gentle rounded shapes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, colorful butterfly, upright wings, slender body, flower or lamp, scary face, kawaii sparkle eyes
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Colorful butterfly** (the competing insect — must read as a MOTH, not a butterfly — `colorful butterfly`).
  - **Upright wings** (butterfly cue — moth wings are flat or folded — `upright wings`).
  - **Slender body** (butterfly cue — moth body is fuzzy + plump — `slender body`).
  - **Flower / lamp** (second subjects — common moth-context props — `flower or lamp`).
  - **Scary face** (tone — a gentle rounded moth, not a creepy one — `scary face`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic moth** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-moth.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The fuzzy-plump-body + flat-muted-wings + feathery-antennae silhouette is the load-bearing recognition cue — it is what separates "moth" from "butterfly". MJ has a strong drift to butterflies (brighter, more common in children's-book illustration). The body's "fuzzy plump body, broad flat muted-brown wings, feathery antennae" + the THREE butterfly-cue negatives (`colorful butterfly`, `upright wings`, `slender body`) are all required. Single moth, no flower/lamp prop. If 4-grid produces butterflies or butterfly-leaning moths (bright colour, upright wings), regenerate — do not pick the "least-bad". `moth` is the highest subject-disambiguation risk in the pack (the butterfly pull is strong).

---

## 3. Workflow steps — generation → upscale → remove.bg → handoff

Per `feedback_mj_workflow_explicit_removebg` memory: MJ outputs ALWAYS have backgrounds. remove.bg is its own discrete step.

**PRECONDITION — CLEARED.** The word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` is complete (AC0 satisfied); the pool is locked at `thin, thick, path, bath, math, moth, cloth`. MJ generation may begin.

### Per-word workflow (Thomas operates):

1. **Paste the prompt** (from §2.X) into the MJ Web prompt box.
2. **Set aspect ratio to 1:1** in the GUI dropdown.
3. **Submit; wait for 4-grid.**
4. **Review 4-grid:**
   - Does any one of the 4 pass the §1 cohesion checks in `picture-pack-style-anchor.md`?
   - Does the subject read as the target noun in <3 seconds? (For the brief-dependent words — `thin`, `thick`, `math`, `moth`, `cloth` — does it read as the SPECIFIC sense / property, not a competing one?)
   - Does it match the style of the prior pack pictures (short-a/o/u/i/e + the sh + ch tiers)?
5. **If 4-grid is mixed:** pick the strongest one. If all 4 fail, regenerate with adjustments (exaggerate the thin/thick contrast on `thin`+`thick`, force the natural-trail on `path`, force the freestanding-tub on `bath`, force the simple-digits-not-text on `math`, force the fuzzy-drab-moth on `moth`, force the small-plain-fabric-square on `cloth`).
6. **Upscale** the chosen image (U1/U2/U3/U4 button in MJ Web).
7. **Download** the upscaled PNG (≥1024×1024).
8. **Background removal:** drop the PNG into [bgclear.ai](https://bgclear.ai) (canonical tool per `removebg-tool-evaluation-2026-05-14.md`; fallback remove.bg) — output a transparent PNG. **MJ outputs ALWAYS have backgrounds; this step is mandatory, never skip.** Verify the transparent PNG has a clean edge (no halo, no fringe).
9. **Save** the transparent PNG as `picture-{word}-removebg.png` under the local pictures-source folder (location per Thomas's existing workflow).
10. **Handoff to Devon (Phase 3):** Devon's `yarn embed-pictures` script consumes the transparent PNGs and produces `picture-{word}.svg` files at `public/assets/pictures/` for the app.

### Pack-level workflow

Per `feedback_mj_walkthrough_step_by_step` memory: hand Thomas one prompt at a time, wait for his 4-grid feedback, fully sequence prompt → pick → upscale → remove.bg → save BEFORE moving to next word.

**Recommended generation order (RECONCILED — start with the strongest/lowest-risk single-objects, build cohesion outward, end with the highest-drift-risk words):**

1. `bath` — strongest single-object, lowest drift risk, storybook-universal silhouette. Establishes the pack's style baseline.
2. `path` — single-object trail, low-moderate risk (watch for paved-road / city-scene drift).
3. `cloth` — single-object fabric square, low-moderate risk (watch for blanket / towel / patterned-textile drift). The reconciled 7th word (replaces `thumb` in this slot).
4. `thin` — object/property CONTRAST-PAIR, moderate risk (the adjective-grounding is the risk; the contrast-pair composition is the Dave-override brief). **Generate `thin` and `thick` consecutively** so the two contrast pairs can be eyeballed for visual consistency.
5. `thick` — object/property CONTRAST-PAIR, moderate risk. Generate right after `thin` — mirror composition.
6. `math` — domain noun, moderate risk (watch for classroom-scene drift + the text-vs-digits distinction).
7. `moth` — **highest subject-disambiguation risk in the pack** — MJ pulls hard toward butterflies; end with it so the earlier 6 establish the style baseline before the hardest word.

After all 7 are generated + upscaled + bg-removed + saved, hand the batch to Devon for `yarn embed-pictures` Phase 3.

---

## 4. Phase-3 SVG embed — Devon owns

Per `picture-pack-style-anchor.md` §6 and `.claude/docs/skill-trees-and-content.md` (PNG-in-SVG embed pipeline):

- Devon runs `yarn embed-pictures` against the transparent-PNG batch.
- Output: `public/assets/pictures/picture-{thin,thick,path,bath,math,moth,cloth}.svg` — 7 files (RECONCILED — `picture-thumb.svg` is NOT in the set; `picture-cloth.svg` replaces it).
- Target SVG file size: 40–100 KB per picture (PNG-in-SVG embed; not vector-traced — vector re-trace is polish backlog).
- Devon's `yarn embed-pictures` script handles the base64-encoding into single-`<image>`-element SVGs with the correct viewBox.

**Plus 3 distractor-only picture assets** — `picture-tin.svg`, `picture-tick.svg`, and `picture-pat.svg` for the th-tier t-contrast traps (word-list §2 / AC7). Silhouette placeholders are acceptable per the distractor-only-entry pattern (Devon's picture-pack §6 finding #4 path); vector trace deferred to polish backlog. These do NOT need MJ prompts in this sheet — they fall under the distractor-only-entries pipeline, not the per-target-word MJ generation pipeline. `picture-bat.svg` and `picture-mat.svg` already exist (short-a CVC tier — reused, no new asset; `bat`/`mat` are dual-role distractors for `bath`/`math`).

---

## 5. Acceptance criteria (this prompt sheet's deliverable)

- [x] **7 paste-ready prompts** (one per th-target word — the RECONCILED locked pool `thin, thick, path, bath, math, moth, cloth`), each in its own fenced code block, each ≤40 words for prompt body + tailored `--no` list at ≤12 logical-concept entries.
- [x] **GATING — CLEARED:** the word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` is complete (AC0 satisfied); the pool is locked. The per-word prompt set is reconciled to match (`thumb` prompt dropped, `cloth` prompt added; `thin`/`thick` revised to Dave's contrast-pair brief). MJ generation may begin.
- [ ] No `--v 6 --style raw --s 250 --ar` parameters in any prompt (v7 GUI workflow).
- [ ] No `--cref / --sref / --cw 80` flags in any prompt (style preamble carries cohesion).
- [ ] Per-word `--no` only; no pack-wide negative blocks.
- [ ] IP-name strip applied (no My Melody / Sanrio / Disney / Ghibli BY NAME in prompts).
- [ ] remove.bg (bgclear.ai canonical) as an explicit Workflow §3 step (never implied as transparent from MJ).
- [ ] Generation order documented (start with `bath`, end with `moth`; `thin`/`thick` generated consecutively for contrast-pair consistency; `cloth` in slot 3).
- [ ] Phase-3 handoff to Devon documented, incl. the `picture-tin.svg` + `picture-tick.svg` + `picture-pat.svg` distractor-only assets. Output set is `picture-{thin,thick,path,bath,math,moth,cloth}.svg` (NOT `picture-thumb.svg`).
- [ ] §1.4 style preamble is ≤14 words, byte-for-byte identical across **5 of the 7 prompts** AND byte-for-byte identical to the `digraphs-sh` + `digraphs-ch` sheets' preamble (cross-tier cohesion lever). **TWO documented preamble deviations** — `thin` (§2.1) and `thick` (§2.2) drop `single subject` from the preamble because Dave's th-addendum (Recommendation 3 / Risk 5) mandates a contrast-PAIR composition for the two adjectives; this is the documented `chat`-precedent move. `math` threads the "no text" rule via its `--no` list + body wording, NOT via a preamble change (§1.4 note + §2.6). The other 5 prompts hold the full 14-word preamble byte-for-byte.
- [ ] Total body per prompt: preamble (14) + subject phrase + details (≤22) = ≤36 words. Headroom for word-specific safety phrases.
- [ ] The 5 load-bearing picture briefs (`thin`/`thick` = contrast-pair composition reading as the PROPERTY per Dave Recommendation 3, `math` = numbers-not-school, `moth` = moth-not-butterfly, `cloth` = small-plain-fabric-square reading as "cloth" not "blanket") are encoded in the prompt bodies + the §2 notes (these are AC7 content in the word-list spec — not optional polish).

---

## 6. Non-obvious findings — surfacing to Thomas

1. **This prompt sheet is RECONCILED.** It was drafted DRAFT-ahead-of-research; the word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` (landed on `main`, commit `8c43395`) is now complete (AC0 satisfied). The reconciliation to this sheet: **`thumb` dropped** (Dave §3e/Recommendation 5 — silent `b`; it is the pool-extension word, not a v1 target) and **`cloth` added** (Dave §3d/§3f). The §2.3 prompt that was `thumb` is now `cloth`. `thin` + `thick` were revised from single-object to contrast-PAIR briefs (Dave Recommendation 3 / Risk 5). The pool is locked at `thin, thick, path, bath, math, moth, cloth`; MJ generation may begin.

2. **`moth` is the highest subject-disambiguation risk in the pack.** MJ pulls hard toward butterflies — brighter, more common in children's-book illustration. The body's "fuzzy plump body, broad flat muted-brown wings, feathery antennae" + the THREE butterfly-cue negatives (`colorful butterfly`, `upright wings`, `slender body`) are all load-bearing. If 4-grid produces butterflies or butterfly-leaning moths, regenerate — do not pick the "least-bad". `moth` is the th-tier's analogue of the ch tier's `chip` (poker-chip/microchip pull) and the sh tier's `shop` (blank-signboard problem).

3. **`math` threads the preamble's "no text" rule via its `--no` list, not a preamble change.** The preamble says "no text", but `math`'s subject is a chalkboard with a simple sum, and the SUM'S DIGITS are the subject (not caption text). `math`'s `--no` list says `text words letters` (forbidding caption text + lettering) while the body explicitly asks for "large clear digits". This is a deliberate, documented threading (§1.4 note + §2.6) — `math` does NOT change the preamble. **Note:** the th pack DOES have two documented preamble deviations after reconciliation — `thin` (§2.1) and `thick` (§2.2) drop `single subject` because Dave's th-addendum mandates a contrast-PAIR composition for the two adjectives (finding 4). So 5 of 7 th prompts hold the 14-word preamble byte-for-byte; the 2 adjective prompts deviate, the `chat`-precedent way.

4. **`thin` and `thick` are adjectives — Dave's th-addendum OVERRODE the original single-object brief with a CONTRAST-PAIR brief** (Dave Recommendation 3 / Risk 5). The original draft prompts asked for a single thin/thick object; Dave's research is explicit that "the risk is that the picture reads as the object rather than the property" — so the reconciled §2.1/§2.2 prompts ask for a thin-object-beside-thick-object composition with an arrow pointing to the target. **This required dropping `single subject` from the §1.4 preamble for these two prompts only** (the documented `chat`-precedent deviation — finding 3). **Generate `thin` and `thick` consecutively** so Thomas can confirm the two contrast pairs are visually consistent (mirror compositions, same object class). This is a genuine divergence from the original draft brief — Dave (the phonics authority) overrides; the spec owner adopted it.

5. **5 of the 7 words have load-bearing picture briefs** (`thin`, `thick`, `math`, `moth`, `cloth`) — these come from the word-list spec §3 and are **AC7 content in the word-list spec, not optional polish.** `thin`/`thick` must read as the PROPERTY via a contrast-pair composition (Dave Recommendation 3). `math` must read as numbers/a sum, not a school. `moth` must read as a moth (fuzzy, drab, flat wings, feathery antennae), not a butterfly. `cloth` must read as a small plain fabric square, not a blanket / towel / garment (Dave §3d). If a 4-grid satisfies the style but misses the brief's specific sense, it FAILS — regenerate.

6. **The th-pack inherits the sh + ch packs' exact style preamble — byte-for-byte (all 7).** Not a th-specific variant. The th pictures should sit visually alongside the sh + ch pictures and the five CVC packs as one coherent set, not form a separate-looking digraph sub-style. This is the cross-tier cohesion lever — and the only cohesion lever, since (per §1.2) no `--cref/--sref` flags are used. **Unlike the ch sheet, there is NO per-word preamble exception** — the ch sheet's `chat` dropped "single subject"; every th prompt holds the full 14-word preamble (`math` threads "no text" via the `--no` list + body wording instead).

7. **3 distractor-only pictures are needed for the th-tier** (`picture-tin.svg`, `picture-tick.svg`, `picture-pat.svg`) — the th/t-contrast trap partners of `thin`, `thick`, `path`. They fall under the distractor-only-entries pipeline (silhouette placeholders acceptable), NOT the per-target-word MJ generation pipeline — so they get no prompts in this sheet. `picture-bat.svg` and `picture-mat.svg` already exist (short-a CVC tier — reused, `bat`/`mat` are dual-role distractors for `bath`/`math`). This is the th-tier's analogue of the ch tier's `sat`/`sick` distractor-only assets — but th has 3 new distractor-only pictures (vs ch's 2) AND reuses 2 existing CVC pictures (`bat`/`mat`) as dual-role, where ch reused 1 (`sip`).

8. **`thick` and `cloth` are `hybridMode: true` — a SCHEMA flag, NOT a picture concern.** Word-list spec §6.2 (reconciled) sets `hybridMode: true` on `thick` (double-digraph `th`+`ck`) and `cloth` (`/kl/` onset blend) — recognition-only, planner emits no decode/spell prompts. **That changes NOTHING about how their pictures are made:** `thick`'s picture is the contrast-pair composition; `cloth`'s is a plain fabric square; both are generated exactly like any other pack picture. Flagged here only so Thomas/Devon don't conflate the schema flag with a picture-pack constraint — the pictures are not affected by the `hybridMode` ruling. (`thumb`, the DRAFT's silent-`b` uncertainty word, was dropped from the pool entirely — see finding 1.)

9. **`--no` list ceiling is ≤12 logical-concept entries per prompt** (per `feedback_mj_moderator_negatives_per_word` empirical recipe). Each prompt below is 10–12 entries — collapse redundant style negatives (`anime` + `watermark` cover the `chibi` / `logo` drift class) and fold multi-word phrases into single logical concepts (`paved road with markings` as one entry).

10. **The th-tier scaffold may need a mouth-position VISUAL cue — flagged in the word-list spec §5 / Open Question Q1, NOT a picture-pack item here.** The parent research note recommends a mouth-position illustration ("tongue between teeth") for the th-tier corner cue, because /θ/ articulation has no L1 scaffold for Marian. IF Thomas locks word-list Q1 Option B (static mouth-position illustration) or Option C (Emma mouth-position animation), that asset is a SEPARATE deliverable — it is NOT one of the 7 picture-pack words and gets no MJ prompt in this sheet. Surfaced here so the asset-count is clear: this sheet covers 7 target-word pictures + flags 3 distractor-only pictures; the mouth-position cue (if locked) is a 4th asset class outside this sheet's scope.

11. **Generation order ends on the hardest word, deliberately.** Start with `bath` (lowest drift risk, strongest single-subject, storybook-universal) to establish the style baseline; `path` + `cloth` next (single-object, low-moderate risk); generate `thin`+`thick` consecutively (the contrast pairs — eyeball for mirror-composition consistency); `math` sixth; end with `moth` (highest subject-disambiguation risk — the butterfly pull). The earlier 6 generations give Thomas a clean style reference before he hits the prompt most likely to need retries — mirrors the `digraphs-sh` + `digraphs-ch` sheets' "start safe, end risky" ordering logic.
