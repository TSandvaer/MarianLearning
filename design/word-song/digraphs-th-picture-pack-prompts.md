# Word Song — digraphs voiceless `th` /θ/ picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney Web operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory, step-by-step with 4-grid feedback per word per `feedback_mj_walkthrough_step_by_step` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** **DRAFT Phase 1 prompt sheet — paste-ready, one prompt per word, BUT the 7-word pool is PROVISIONAL.** The companion word-list spec (`digraphs-th-word-list.md`) is DRAFT-ahead-of-research: Dave's `design/research/digraph-th-addendum.md` (the /θ/ phonics authority) was NOT yet on disk when this sheet was drafted. **Do NOT begin MJ generation until the word-list spec's §0 reconciliation against Dave's th-addendum is complete** — if Dave revises the pool, the per-word prompts below change. The 7 drafted th-target words are the word-list spec's §1 DRAFT inventory: `thin, thick, thumb, path, bath, math, moth` — **each marked "pending Dave's phonics validation" in the word-list spec.**
**Predecessor specs:** `design/word-song/digraphs-th-word-list.md` (sibling — defines the DRAFT 7-word pool, the load-bearing picture briefs, the picture-pack scope, and the §0 reconciliation gate), `design/word-song/picture-pack-style-anchor.md` (style frame — inherited verbatim), `design/word-song/digraphs-ch-picture-pack-prompts.md` (the immediately-prior digraph prompt sheet — **structural template, cloned section-for-section, MJ-parameter conventions inherited verbatim**), `design/word-song/digraphs-sh-picture-pack-prompts.md` (the original digraph prompt sheet — the §1.4 short-form preamble origin).
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14 — the parent research note; §Q3 carries the /θ/ error profile + the mouth-position-visual recommendation) AND `design/research/digraph-th-addendum.md` (Dave — IN PARALLEL, NOT yet on disk — will lock the pool + supply any per-word picture-brief refinements).

---

## 0. Scope — 7 wholly-new voiceless-th-words (word-list spec's §1 DRAFT inventory — PROVISIONAL)

This pack covers **7 wholly-new th-words** (no re-traces — none of these words exist as distractors in prior tiers):

> **`thin`, `thick`, `thumb`, `path`, `bath`, `math`, `moth`.**

**This is the word-list spec's §1 DRAFT inventory — NOT a locked pool.** Dave's `digraph-th-addendum.md` is the authority on the final th-voiceless word inventory; until the word-list spec's §0 reconciliation lands, treat this pool as provisional. **Anticipated revision axes** (from the word-list spec §0): word-final th (`path/bath/math/moth`) may be pulled to a follow-up arc; `thumb` may be dropped for `thud` over its silent `b`; `think`/`thank` are held in reserve and may come in. If the pool changes, the affected per-word prompts below are dropped/added/revised.

**Total generations needed for this pack: 7** (subject to §0 reconciliation of the word-list spec).
**Total SVG file changes after Phase 3: 7 new** (subject to §0 reconciliation).

**ZERO of the 7 are anticipated `hybridMode: true`** — like the ch tier (also 0), unlike the sh tier (3). One word — `thumb` — carries a silent-`b` uncertainty that Dave's th-addendum must rule on (word-list spec §6.2), but that is a `hybridMode`/schema question, not a picture-making question — it changes nothing about how `thumb`'s picture is made. Noted only so the asset count + schema expectations are clear.

**5 of the 7 carry a load-bearing picture brief** (word-list spec §3 — these are NOT optional polish; they are AC7 content in the word-list spec):

- `thin` — a clearly slender single object; "thinness" must be the SALIENT property. A single object that unmistakably reads as thin (a thin slice, a thin stick) — NOT a thin-vs-thick comparison (that needs two subjects).
- `thick` — a clearly chunky single object; "thickness" must be the SALIENT property (a thick book, a thick slice). Same object class as `thin` at the opposite extreme, so the property contrast is legible across the pack.
- `thumb` — a hand with the thumb as the salient feature; a "thumbs-up" hand reads cleanly. NOT a free-floating body fragment — the ch-tier `chin` precedent (body part shown clearly, in context).
- `math` — numbers / a simple sum / a small chalkboard with `2 + 2`; must read as "numbers", NOT "a school" or "a classroom".
- `moth` — a moth: fuzzy body, drab/muted colour, folded or flat wings; must NOT read as a butterfly.

`path` and `bath` need standard single-subject briefs (no special composition concern beyond the disambiguation notes in §2.4 / §2.5).

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

**ALL 7 prompts below are DRAFT — provisional on the word-list spec's §0 reconciliation against Dave's th-addendum.** Do not generate until §0 is reconciled.

---

### 2.1 `thin` — object (property) — `th-` initial, `/ɪ/` inside

- **Vocabulary cue:** A single clearly slender object — a thin slice of bread, or a thin stick — where **thinness is the visually salient property.** The word-list spec's lead anchor; the canonical word-initial /θ/ word.
- **Distinctness check:**
  - **vs. a generic object:** the THINNESS must be the salient feature, not just "an object". A thin slice on edge, or a slender twig, makes the property read.
  - **vs. `thick` (pack neighbor):** `thin` is slender, `thick` is chunky — deliberately the SAME object class at opposite extremes. FORBIDDEN_PAIR `[thin, thick]` keeps them out of the same trio (the property contrast is real but in-pool hygiene avoids stacking it).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A single very THIN slice of bread standing on edge, slender and delicate, the thinness clearly the main feature. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, thick chunky slice, whole loaf, smiling bread with face, busy background, kawaii sparkle eyes
```

- **Word-count check:** body 34 words (14 preamble + 20 subject); `--no` 10 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (10 concepts):**
  - **Thick / chunky version** (the property must read as THIN — `thick chunky slice`).
  - **Whole loaf** (loses the thin-slice cue — `whole loaf`).
  - **Anthropomorphised bread** (anti-anthro — `smiling bread with face`).
  - **Busy background** (single subject, cream background — `busy background`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic bread** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-thin.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** `thin` is an ADJECTIVE — the picture must ground "thinness" as the salient property. A thin slice of bread on edge is the recommended subject because the thinness reads at a glance AND it pairs cleanly with `thick` as a thick-slice (same object class, opposite extreme). If 4-grid produces slices that don't read as notably thin, regenerate with "paper-thin, very slender, the thinness is exaggerated" emphasis. Alternative subject if the slice doesn't ground: a single thin twig/stick. `thin` is moderate-difficulty — the adjective-grounding is the risk.

---

### 2.2 `thick` — object (property) — `th-` initial, `/ɪ/` inside

- **Vocabulary cue:** A single clearly chunky object — a thick slice of bread, or a thick book — where **thickness is the visually salient property.** The `thin`/`thick` antonym pair (same object class, opposite extreme).
- **Distinctness check:**
  - **vs. a generic object:** the THICKNESS must be the salient feature. A chunky slice, or a fat book, makes the property read.
  - **vs. `thin` (pack neighbor):** deliberately the SAME object class at the opposite extreme. FORBIDDEN_PAIR `[thin, thick]` — keep them out of the same trio.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A single very THICK chunky slice of bread, fat and substantial, the thickness clearly the main feature. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, thin delicate slice, whole loaf, smiling bread with face, busy background, kawaii sparkle eyes
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 10 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (10 concepts):**
  - **Thin / delicate version** (the property must read as THICK — `thin delicate slice`).
  - **Whole loaf** (loses the thick-slice cue — `whole loaf`).
  - **Anthropomorphised bread** (anti-anthro — `smiling bread with face`).
  - **Busy background** (single subject, cream background — `busy background`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic bread** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-thick.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** `thick` is an ADJECTIVE — same grounding concern as `thin`. The thick-slice subject is recommended because it pairs cleanly with `thin`'s thin-slice (same object class, opposite extreme) — that consistency is what makes the property-contrast legible across the pack. If 4-grid slices don't read as notably thick, regenerate with "very fat, chunky, the thickness is exaggerated" emphasis. **Generate `thin` and `thick` consecutively** so Thomas can eyeball the contrast and confirm they read as a clean property pair.

---

### 2.3 `thumb` — body part — `th-` initial, `/ʌ/` inside

- **Vocabulary cue:** A friendly cartoon hand giving a **thumbs-up**, with the **thumb as the visually salient feature** — the thumb clearly extended and prominent. The ch-tier `chin` precedent — a body part shown clearly, in context (a hand), not as a free-floating fragment.
- **Distinctness check:**
  - **vs. a generic hand:** the THUMB must be the salient feature, not just "a hand". A thumbs-up pose makes the thumb protrude and read.
  - **vs. any existing pack object:** a hand is a unique silhouette in the whole pack. **No risk.**
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A friendly cartoon child hand giving a clear THUMBS-UP, the thumb extended and prominent, soft warm skin tone, rounded shapes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, full body, arm or shoulder, both hands, holding an object, scary or zombie hand, kawaii sparkle eyes
```

- **Word-count check:** body 34 words (14 preamble + 20 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Full body / arm / shoulder** (the hand+thumb must be the focus — `full body`, `arm or shoulder`).
  - **Both hands** (single subject — one hand — `both hands`).
  - **Hand holding an object** (the thumb must be the subject, not what it holds — `holding an object`).
  - **Scary / zombie hand** (tone — `scary or zombie hand`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic hand** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-thumb.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The thumbs-up pose is the strongest read — it makes the thumb protrude and unambiguously names it. A relaxed open hand risks reading as just "hand". Keep it a CHILD's hand (friendly, soft, age-appropriate). If 4-grid produces hands where the thumb is not salient, regenerate with "exaggerated thumbs-up, the thumb is large and clearly the focus" emphasis. **Schema note for Devon/Kevin (NOT a picture concern):** `thumb` has a silent `b` — word-list spec §6.2 flags it as a `hybridMode` open question pending Dave's th-addendum. This does NOT affect the picture; `thumb`'s picture is made exactly like any other body-part anchor.

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

**PRECONDITION — do NOT start generation until the word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` is complete.** If Dave revises the pool, the per-word prompts in §2 change.

### Per-word workflow (Thomas operates):

1. **Paste the prompt** (from §2.X) into the MJ Web prompt box.
2. **Set aspect ratio to 1:1** in the GUI dropdown.
3. **Submit; wait for 4-grid.**
4. **Review 4-grid:**
   - Does any one of the 4 pass the §1 cohesion checks in `picture-pack-style-anchor.md`?
   - Does the subject read as the target noun in <3 seconds? (For the brief-dependent words — `thin`, `thick`, `thumb`, `math`, `moth` — does it read as the SPECIFIC sense / property, not a competing one?)
   - Does it match the style of the prior pack pictures (short-a/o/u/i/e + the sh + ch tiers)?
5. **If 4-grid is mixed:** pick the strongest one. If all 4 fail, regenerate with adjustments (exaggerate thinness on `thin`, exaggerate thickness on `thick`, force the thumbs-up on `thumb`, force the natural-trail on `path`, force the freestanding-tub on `bath`, force the simple-digits-not-text on `math`, force the fuzzy-drab-moth on `moth`).
6. **Upscale** the chosen image (U1/U2/U3/U4 button in MJ Web).
7. **Download** the upscaled PNG (≥1024×1024).
8. **Background removal:** drop the PNG into [bgclear.ai](https://bgclear.ai) (canonical tool per `removebg-tool-evaluation-2026-05-14.md`; fallback remove.bg) — output a transparent PNG. **MJ outputs ALWAYS have backgrounds; this step is mandatory, never skip.** Verify the transparent PNG has a clean edge (no halo, no fringe).
9. **Save** the transparent PNG as `picture-{word}-removebg.png` under the local pictures-source folder (location per Thomas's existing workflow).
10. **Handoff to Devon (Phase 3):** Devon's `yarn embed-pictures` script consumes the transparent PNGs and produces `picture-{word}.svg` files at `public/assets/pictures/` for the app.

### Pack-level workflow

Per `feedback_mj_walkthrough_step_by_step` memory: hand Thomas one prompt at a time, wait for his 4-grid feedback, fully sequence prompt → pick → upscale → remove.bg → save BEFORE moving to next word.

**Recommended generation order (start with the strongest/lowest-risk single-objects, build cohesion outward, end with the highest-drift-risk words):**

1. `bath` — strongest single-object, lowest drift risk, storybook-universal silhouette. Establishes the pack's style baseline.
2. `thumb` — body part, low risk (watch for thumb-not-salient drift — needs the clear thumbs-up pose).
3. `path` — single-object trail, low-moderate risk (watch for paved-road / city-scene drift).
4. `thin` — object/property, moderate risk (watch for not-thin-enough drift — the adjective-grounding is the risk). **Generate `thin` and `thick` consecutively** so the property pair can be eyeballed for contrast.
5. `thick` — object/property, moderate risk (watch for not-thick-enough drift). Generate right after `thin`.
6. `math` — domain noun, moderate risk (watch for classroom-scene drift + the text-vs-digits distinction).
7. `moth` — **highest subject-disambiguation risk in the pack** — MJ pulls hard toward butterflies; end with it so the earlier 6 establish the style baseline before the hardest word.

After all 7 are generated + upscaled + bg-removed + saved, hand the batch to Devon for `yarn embed-pictures` Phase 3.

---

## 4. Phase-3 SVG embed — Devon owns

Per `picture-pack-style-anchor.md` §6 and `.claude/docs/skill-trees-and-content.md` (PNG-in-SVG embed pipeline):

- Devon runs `yarn embed-pictures` against the transparent-PNG batch.
- Output: `public/assets/pictures/picture-{thin,thick,thumb,path,bath,math,moth}.svg` — 7 files (subject to the word-list §0 reconciliation — if the pool changes, the file set changes).
- Target SVG file size: 40–100 KB per picture (PNG-in-SVG embed; not vector-traced — vector re-trace is polish backlog).
- Devon's `yarn embed-pictures` script handles the base64-encoding into single-`<image>`-element SVGs with the correct viewBox.

**Plus 3 distractor-only picture assets** — `picture-tin.svg`, `picture-tick.svg`, and `picture-pat.svg` for the th-tier t-contrast traps (word-list §2 / AC7). Silhouette placeholders are acceptable per the distractor-only-entry pattern (Devon's picture-pack §6 finding #4 path); vector trace deferred to polish backlog. These do NOT need MJ prompts in this sheet — they fall under the distractor-only-entries pipeline, not the per-target-word MJ generation pipeline. `picture-bat.svg` and `picture-mat.svg` already exist (short-a CVC tier — reused, no new asset; `bat`/`mat` are dual-role distractors for `bath`/`math`).

---

## 5. Acceptance criteria (this prompt sheet's deliverable)

- [ ] **7 paste-ready prompts** (one per th-target word — word-list spec's §1 DRAFT inventory `thin, thick, thumb, path, bath, math, moth`), each in its own fenced code block, each ≤40 words for prompt body + tailored `--no` list at ≤12 logical-concept entries.
- [ ] **GATING:** no MJ generation begins until the word-list spec's §0 reconciliation against Dave's `digraph-th-addendum.md` is complete — if Dave revises the pool, the per-word prompts are dropped/added/revised first.
- [ ] No `--v 6 --style raw --s 250 --ar` parameters in any prompt (v7 GUI workflow).
- [ ] No `--cref / --sref / --cw 80` flags in any prompt (style preamble carries cohesion).
- [ ] Per-word `--no` only; no pack-wide negative blocks.
- [ ] IP-name strip applied (no My Melody / Sanrio / Disney / Ghibli BY NAME in prompts).
- [ ] remove.bg (bgclear.ai canonical) as an explicit Workflow §3 step (never implied as transparent from MJ).
- [ ] Generation order documented (start with `bath`, end with `moth`; `thin`/`thick` generated consecutively for property-pair contrast).
- [ ] Phase-3 handoff to Devon documented, incl. the `picture-tin.svg` + `picture-tick.svg` + `picture-pat.svg` distractor-only assets.
- [ ] §1.4 style preamble is ≤14 words, byte-for-byte identical across all 7 prompts AND byte-for-byte identical to the `digraphs-sh` + `digraphs-ch` sheets' preamble (cross-tier cohesion lever). **Unlike the ch sheet, there is NO per-word preamble deviation** — all 7 th prompts hold the preamble byte-for-byte (`math` threads the "no text" rule via its `--no` list + body wording, NOT via a preamble change — see §1.4 note + §2.6).
- [ ] Total body per prompt: preamble (14) + subject phrase + details (≤22) = ≤36 words. Headroom for word-specific safety phrases.
- [ ] The 5 load-bearing picture briefs (`thin` = thinness-salient, `thick` = thickness-salient, `thumb` = hand-with-salient-thumb, `math` = numbers-not-school, `moth` = moth-not-butterfly) are encoded in the prompt bodies + the §2 notes (these are AC7 content in the word-list spec — not optional polish).

---

## 6. Non-obvious findings — surfacing to Thomas

1. **This prompt sheet is DRAFT-and-GATED.** Unlike the ch prompt sheet (whose pool was locked against Dave's already-landed ch-addendum), the th prompt sheet's 7-word pool is the word-list spec's §1 DRAFT inventory — Dave's `digraph-th-addendum.md` was NOT on disk when this sheet was drafted. **No MJ generation begins until the word-list spec's §0 reconciliation lands.** If Dave revises the pool (word-final th pulled to a follow-up arc, `thumb` swapped for `thud`, `think`/`thank` brought in from reserve), the per-word prompts in §2 are dropped/added/revised. Treat §2 as provisional.

2. **`moth` is the highest subject-disambiguation risk in the pack.** MJ pulls hard toward butterflies — brighter, more common in children's-book illustration. The body's "fuzzy plump body, broad flat muted-brown wings, feathery antennae" + the THREE butterfly-cue negatives (`colorful butterfly`, `upright wings`, `slender body`) are all load-bearing. If 4-grid produces butterflies or butterfly-leaning moths, regenerate — do not pick the "least-bad". `moth` is the th-tier's analogue of the ch tier's `chip` (poker-chip/microchip pull) and the sh tier's `shop` (blank-signboard problem).

3. **`math` threads the preamble's "no text" rule — the one documented per-word complication.** The preamble says "no text", but `math`'s subject is a chalkboard with a simple sum, and the SUM'S DIGITS are the subject (not caption text). `math`'s `--no` list says `text words letters` (forbidding caption text + lettering) while the body explicitly asks for "large clear digits". This is a deliberate, documented threading (§1.4 note + §2.6) — analogous to the ch sheet's `chat` documenting its single-subject-rule deviation, but LESS invasive: `math` does NOT change the preamble (the ch sheet's `chat` dropped "single subject" from the preamble). All 7 th prompts hold the 14-word preamble byte-for-byte.

4. **`thin` and `thick` are adjectives — their pictures must ground a PROPERTY, not just an object** (load-bearing briefs, word-list §3). The recommended subject for both is a slice of bread (thin slice on edge / thick chunky slice) — the SAME object class at opposite extremes, so the property contrast is legible across the pack. **Generate them consecutively** so Thomas can eyeball the pair. If a slice doesn't read as notably thin/thick, the fallback is "exaggerate the property" emphasis. This is the th-tier's analogue of the ch tier's `chin`/`chat`/`chop` "keeps that a naive audit would reject" — adjectives look hard to picture, but a clear single-object-at-an-extreme grounds them.

5. **5 of the 7 words have load-bearing picture briefs** (`thin`, `thick`, `thumb`, `math`, `moth`) — these come from the word-list spec §3 and are **AC7 content in the word-list spec, not optional polish.** `thin`/`thick` must read as the PROPERTY (thinness/thickness salient). `thumb` must be a hand-with-salient-thumb (thumbs-up pose), not a free-floating fragment — the ch-tier `chin` precedent. `math` must read as numbers/a sum, not a school. `moth` must read as a moth (fuzzy, drab, flat wings), not a butterfly. If a 4-grid satisfies the style but misses the brief's specific sense, it FAILS — regenerate.

6. **The th-pack inherits the sh + ch packs' exact style preamble — byte-for-byte (all 7).** Not a th-specific variant. The th pictures should sit visually alongside the sh + ch pictures and the five CVC packs as one coherent set, not form a separate-looking digraph sub-style. This is the cross-tier cohesion lever — and the only cohesion lever, since (per §1.2) no `--cref/--sref` flags are used. **Unlike the ch sheet, there is NO per-word preamble exception** — the ch sheet's `chat` dropped "single subject"; every th prompt holds the full 14-word preamble (`math` threads "no text" via the `--no` list + body wording instead).

7. **3 distractor-only pictures are needed for the th-tier** (`picture-tin.svg`, `picture-tick.svg`, `picture-pat.svg`) — the th/t-contrast trap partners of `thin`, `thick`, `path`. They fall under the distractor-only-entries pipeline (silhouette placeholders acceptable), NOT the per-target-word MJ generation pipeline — so they get no prompts in this sheet. `picture-bat.svg` and `picture-mat.svg` already exist (short-a CVC tier — reused, `bat`/`mat` are dual-role distractors for `bath`/`math`). This is the th-tier's analogue of the ch tier's `sat`/`sick` distractor-only assets — but th has 3 new distractor-only pictures (vs ch's 2) AND reuses 2 existing CVC pictures (`bat`/`mat`) as dual-role, where ch reused 1 (`sip`).

8. **`thumb`'s silent `b` is a SCHEMA question, not a picture question.** Word-list spec §6.2 flags `thumb`'s silent `b` as the pool's #1 `hybridMode` uncertainty pending Dave's th-addendum — but that is a `wordPack.ts`/planner concern. It changes NOTHING about how `thumb`'s picture is made: `thumb`'s picture is a friendly thumbs-up hand, generated exactly like any other body-part anchor (the ch tier's `chin` precedent). Flagged here only so Thomas/Devon don't conflate the schema uncertainty with a picture-pack uncertainty — the picture is not blocked on the `hybridMode` ruling.

9. **`--no` list ceiling is ≤12 logical-concept entries per prompt** (per `feedback_mj_moderator_negatives_per_word` empirical recipe). Each prompt below is 10–12 entries — collapse redundant style negatives (`anime` + `watermark` cover the `chibi` / `logo` drift class) and fold multi-word phrases into single logical concepts (`paved road with markings` as one entry).

10. **The th-tier scaffold may need a mouth-position VISUAL cue — flagged in the word-list spec §5 / Open Question Q1, NOT a picture-pack item here.** The parent research note recommends a mouth-position illustration ("tongue between teeth") for the th-tier corner cue, because /θ/ articulation has no L1 scaffold for Marian. IF Thomas locks word-list Q1 Option B (static mouth-position illustration) or Option C (Emma mouth-position animation), that asset is a SEPARATE deliverable — it is NOT one of the 7 picture-pack words and gets no MJ prompt in this sheet. Surfaced here so the asset-count is clear: this sheet covers 7 target-word pictures + flags 3 distractor-only pictures; the mouth-position cue (if locked) is a 4th asset class outside this sheet's scope.

11. **Generation order ends on the hardest word, deliberately.** Start with `bath` (lowest drift risk, strongest single-subject, storybook-universal) to establish the style baseline; generate `thin`+`thick` consecutively (the property pair); end with `moth` (highest subject-disambiguation risk — the butterfly pull). The earlier 6 generations give Thomas a clean style reference before he hits the prompt most likely to need retries — mirrors the `digraphs-sh` + `digraphs-ch` sheets' "start safe, end risky" ordering logic.
    </content>
    </invoke>
