# Word Song — digraphs `sh` picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney Web operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory, step-by-step with 4-grid feedback per word per `feedback_mj_walkthrough_step_by_step` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready, one prompt per word.
**Predecessor specs:** `design/word-song/digraphs-sh-word-list.md` (sibling — defines the 8-word pool and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame — inherited verbatim), `design/word-song/short-e-picture-pack-prompts.md` (most recent CVC prompt sheet — structural template, with MJ-parameter updates below).
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14).

---

## 0. Scope — 8 wholly-new sh-initial words

This pack covers **8 wholly-new sh-initial targets** (no re-traces — none of these words exist as distractors in prior tiers):

> **`ship`, `shell`, `shoe`, `sheep`, `shark`, `shed`, `shop`, `shore`.**

Phase-2 contingency: drop `shore` to 7 pictures if MJ can't produce a 96pt-readable single-subject `shore` chip in 4 grids (see word-list spec §7 Q2).

**Total generations needed for this pack: 8** (or 7 under the `shore` Phase-2 fallback).
**Total SVG file changes after Phase 3: 8 new** (or 7 new).

---

## 1. MJ-parameter updates from prior packs (READ FIRST)

This prompt sheet deliberately diverges from the short-e / short-u / short-o sheets on several MJ parameter conventions. The divergence is locked-in based on accumulated MJ-workflow learnings captured in user memory; do not revert to the prior sheets' conventions.

### 1.1 v7 GUI workflow — drop `--v 6 --style raw --s 250 --ar 1:1`

Per `feedback_mj_moderator_negatives_per_word` memory: "drop `--v 6 --style raw --s 250 --ar`, use GUI ratio dropdown".

**OLD (short-e sheet pattern):**

```
... [full prompt] ... --ar 1:1 --s 250 --v 6 --style raw --no [negatives]
```

**NEW (this sheet's pattern):**

```
... [full prompt] ... --no [per-word negatives]
```

— set the 1:1 ratio in the MJ Web GUI dropdown, not as a `--ar` flag. v7 is the default in current MJ Web; explicit `--v 6 --style raw --s 250` flags are not needed.

### 1.2 Drop `--cref / --sref / --cw 80` pack-cohesion machinery

Per `feedback_mj_pack_cohesion_lever_unused` memory: "strip `--cref/--sref/--cw 80` from paste-ready prompts; Thomas never captured pose-zero, style preamble alone has carried 38 assets; opt-in only".

**This sheet has NO `--cref / --sref / --cw 80` flags.** The §1.4 style preamble (re-used byte-for-byte) is the cohesion mechanism. If Thomas finds drift across the 8 generations, the opt-in fallback is to capture a `shell` pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 7 — but that is a Phase-2 escalation, not the default.

### 1.3 Per-word `--no` only — NEVER paste pack-wide negatives in one prompt

Per `feedback_mj_moderator_negatives_per_word` memory: "moderator trips on pack-wide negatives... never paste Kyle's full §1.4 block (sexy, anatomical hip, weapon/gun/knife, all per-word anti-anthro entries) in a single prompt — moderator flags."

**Each per-word prompt below has its OWN tailored `--no` list.** It includes:

- The style negatives that always apply (anime, chibi, photorealistic, etc. — short list per prompt).
- The per-word anti-anthro entry (e.g., "smiling ship", "ship with face") — only the one matching the current word.
- The per-word content negative (e.g., for `leg` we'd flag body-fragment; for `shark` we flag fierce-teeth-and-blood).

Do NOT concatenate per-word negatives across words. Each prompt stands alone with its own tailored `--no`.

### 1.4 ≤40-word ceiling per prompt body

Per `feedback_mj_moderator_negatives_per_word` memory: "≤40-word ceiling, IP-name-stripping, photoreal-drift on object subjects".

**Each prompt below is targeted at ≤40 words for the prompt body** (excluding the trailing `--no` list which doesn't count against the word-limit per MJ's parsing). The earlier short-e / short-u prompts ran 200+ words each; that was an antipattern — MJ truncates and moderates aggressively past ~40 words. The new short prompts rely on:

- The style preamble (§1.4 below — re-used byte-for-byte but ≤30 words; the canonical full preamble lives in `picture-pack-style-anchor.md` §2 and Thomas knows it).
- The subject phrase (≤8 words).
- A small set of subject-specific details (≤5 words).
- The negatives list.

### 1.5 IP-name strip

Per `feedback_mj_moderator_negatives_per_word` memory: "IP-name-stripping".

No prompt below mentions My Melody, Sanrio, Disney, Pixar, Studio Ghibli BY NAME (the style-tone "tonal sibling of Ghibli warmth" mention in the longer style-anchor preamble is fine for the canonical anchor doc but is NOT in the per-prompt body here — the short prompts use "modern children's-book illustration, soft pastel" instead).

### 1.6 Always make remove.bg explicit

Per `feedback_mj_workflow_explicit_removebg` memory: "never imply MJ outputs are transparent; always make remove.bg its own discrete step + caveat that MJ outputs always have backgrounds".

**See §3 Workflow steps** — remove.bg is its own discrete step between MJ generation and Devon's SVG embed.

### 1.7 Step-by-step walkthrough — one prompt at a time, wait for 4-grid feedback

Per `feedback_mj_walkthrough_step_by_step` memory: "for MJ generation work, hand Thomas ONE prompt at a time in a copy-able fenced block, wait for his 4-grid feedback, fully sequence prompt→pick→upscale→remove.bg→save before moving to next word".

**Each prompt below is in its own fenced code block, paste-ready, independently.** When walkthrough time arrives (separate session), hand Thomas one at a time, wait for the 4-grid screenshot, iterate if needed, then move on. Do NOT hand him all 8 in one batch.

---

## 1.4 Style preamble — short form (≤30 words; canonical full preamble in style-anchor §2)

Re-use this short-form preamble byte-for-byte across all 8 prompts in this pack:

> **Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures.**

That's the cohesion seed. Each per-word prompt below appends a short subject phrase + subject-specific details to this preamble.

---

## 2. Per-word prompts — paste-ready

The format per row (mirrors short-e §2 structure but compressed):

```
WORD — vocabulary cue — distinctness check — prompt (fenced block) — negatives — asset spec — notes
```

Each "prompt" is paste-ready into MJ Web — copy the fenced block, paste into MJ prompt box, set ratio to 1:1 in the GUI dropdown, hit submit.

---

### 2.1 `ship` — vehicle — `/ɪ/` inside

- **Vocabulary cue:** A simple cartoon ship — hull + visible-above-waterline superstructure + smokestack or mast + portholes. Three-quarter view so the vessel-volume reads.
- **Distinctness check:**
  - **vs. `tub` (short-u target):** `ship` has a clear hull-and-deck above-waterline structure with portholes/smokestack/mast; `tub` is an empty open-top oval. Different shapes. **Low risk.**
  - **vs. `bus` / `van` (short-u targets, ground vehicles):** Marine vessel vs. wheeled. **No risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple small cartoon SHIP, three-quarter view, hull plus deck plus single smokestack plus three small portholes, on calm flat water suggested by one soft pastel wavy line. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, environment, scene, hangul, korean text, smiling ship, ship with face, eyes for portholes, war ship, military, gun, weapon, cannon
```

- **Negatives — what to avoid:**
  - War ship / military / cannon / armed vessel (drift to violence).
  - Smiling ship with face on hull (anthropomorphism).
  - Photo-realistic ocean liner / cruise ship (drift photographic + scale wrong).
  - Sailing yacht with detailed rigging (visual noise).
  - Multiple ships in fleet (single subject).
  - Pirate ship (cultural / content-tone wrong).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-ship.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The hull + smokestack + portholes silhouette is what carries "ship" recognition at 96pt. If MJ produces a sailing-yacht with rigging, regenerate — the rigging visual-noise breaks the chip read.

---

### 2.2 `shell` — object — `/ɛ/` inside

- **Vocabulary cue:** A simple seashell — spiral conch or scallop fan shape. Three-quarter view. The fluted/spiral silhouette carries "shell" recognition.
- **Distinctness check:**
  - **vs. `egg` (short-e target):** `shell` (seashell) is fluted/spiral or scallop-fan; `egg` is smooth ovoid. Different silhouettes. **Low risk.**
  - **vs. `gem` (short-e target):** `shell` is curved-organic; `gem` is geometric-faceted. Different. **No risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple SEASHELL, scallop fan shape with five visible fluted ribs spreading from a small rounded hinge at the bottom, soft warm pink and cream tones, three-quarter view. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, sand grains, beach environment, scene, smiling shell, shell with face, eggshell, broken shell, snail
```

- **Negatives — what to avoid:**
  - Eggshell (different word; confusable).
  - Broken / cracked shell (visual noise + tone wrong).
  - Snail with shell (introduces second subject).
  - Sand grains / beach environment (introduces second subject).
  - Pearl inside shell (introduces second subject).
  - Anthropomorphised shell with face.
  - Photo-realistic conch with detailed texture.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shell.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** The scallop-fan with 5 fluted ribs is the strongest read. The spiral-conch alternate works too but is harder to draw clean; scallop is the recommended primary. If 4-grid produces only spiral-conch, accept the strongest of those.

---

### 2.3 `shoe` — object — long `/uː/` inside (sight-word-hybrid per word-list §1.3)

- **Vocabulary cue:** A single child's sneaker or simple shoe — side view so the toe + heel + laces or velcro strap are visible. The shoe-as-footwear silhouette carries recognition.
- **Distinctness check:**
  - **vs. `boot` / `sandal` (not in pool):** N/A — no neighbors.
  - **vs. `bag` (canonical short-a):** Different category. **No risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A single simple child's sneaker, side view facing right, soft warm cream or soft rose body with a single visible velcro strap across the top and a flat rubber sole at the bottom. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, brand logo, swoosh, nike, adidas, foot inside shoe, sock, pair of shoes, smiling shoe, shoe with face
```

- **Negatives — what to avoid:**
  - Brand logos / swoosh / nike / adidas / branded sportswear (IP risk + content rules).
  - Foot inside shoe / sock visible (introduces second subject / body fragment).
  - Pair of shoes (multi-subject; single shoe only).
  - High-heeled shoe / adult dress shoe (vocab/tone wrong for 8yo).
  - Boot / sandal / flip-flop (different referent).
  - Anthropomorphised shoe with face / eyes on laces.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shoe.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** Single shoe, NOT pair. Velcro strap is the cleanest 8yo-shoe cue (cleaner than laces which add visual noise). If MJ keeps producing pairs, add "single shoe, only one shoe in frame" to the prompt body and re-run.

---

### 2.4 `sheep` — animal — long `/iː/` (vowel digraph `ee`) inside (sight-word-hybrid per word-list §1.3)

- **Vocabulary cue:** A friendly cartoon sheep — fluffy cloud-like wool body + small dark head + four small legs visible. Side or three-quarter view.
- **Distinctness check:**
  - **vs. `hen` (short-e target):** Different animal (mammal vs. bird). **No risk.**
  - **vs. `dog` (short-o target):** Both quadrupeds but sheep has distinctive fluffy-cloud-body wool that dog lacks. **Low risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple friendly cartoon SHEEP, three-quarter side view, fluffy cloud-shaped white-and-soft-cream wool body with a small dark warm-grey head and small warm-grey legs, two small soft round eyes. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, grass, farm scene, environment, flock, multiple sheep, lamb with mother, smiling sheep with cartoon eyebrows, anthropomorphised sheep, sheep wearing clothes
```

- **Negatives — what to avoid:**
  - Farm scene with grass / fence / barn (environment violation).
  - Flock / multiple sheep / mother with lamb (single subject).
  - Photo-realistic woolly sheep with feather-detail wool.
  - Anthropomorphised sheep wearing clothes / standing upright.
  - Black sheep (palette and recognition cue weaker).
  - Cute kawaii sheep with sparkle-eyes (drift kawaii overload).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-sheep.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The cloud-shaped fluffy wool body is the load-bearing recognition cue. If MJ produces a smooth-skinned sheep (no wool detail), regenerate — without the cloud-fluff, the silhouette could read as "dog" or "lamb-with-no-wool".

---

### 2.5 `shark` — animal — r-controlled `a` (`/ɑːr/`) inside (sight-word-hybrid per word-list §1.3)

- **Vocabulary cue:** A friendly (NOT fierce) cartoon shark — sleek body + triangular dorsal fin on top + visible tail + small eye. Side view.
- **Distinctness check:**
  - **vs. `sheep` (pack neighbor):** Marine vs. land mammal; sleek vs. fluffy. **No risk.**
  - **vs. `fish` (sh-final, not in v1 pool):** Both fish-shaped but shark has prominent triangular dorsal fin. **Low risk in v1 since fish not in pool; future cross-pool hygiene flag.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple FRIENDLY cartoon shark, side view facing right, sleek soft-grey body with a prominent triangular dorsal fin on top, visible tail fin, ONE small round friendly eye and a small soft mouth (closed, no teeth visible). --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, water, ocean, environment, scene, fierce shark, sharp teeth, jaws, blood, scary, predator, hunting, prey, fish in mouth, shark attacking
```

- **Negatives — what to avoid (LOAD-BEARING):**
  - **Fierce shark / sharp teeth / jaws / blood / scary / predator / hunting / prey / fish-in-mouth / attacking** (content + tone violations; this is for an 8yo — the shark must be cute, not threatening).
  - Photo-realistic Jaws-style shark.
  - Ocean water / underwater scene (environment violation).
  - Multiple sharks / school of sharks (single subject).
  - Hammerhead / whale-shark / great-white-specific (generic shark only).
  - Cartoon shark with sparkle-eyes-overload.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shark.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** **Friendly closed-mouth shark is mandatory.** If MJ produces any version with visible sharp teeth or open mouth showing teeth, regenerate. The "friendly cartoon" framing + "closed mouth, no teeth visible" + the negatives are the safeguards. Shark is the strongest of the long-vowel allowance picks but ALSO carries the highest tone-violation risk; pair-review carefully.

---

### 2.6 `shed` — structure — `/ɛ/` inside

- **Vocabulary cue:** A small wooden garden-shed — sloped roof + single door + one small window. Three-quarter view so two faces visible.
- **Distinctness check:**
  - **vs. `shop` (pack neighbor):** `shed` has small-house roofline + closed door + no signage; `shop` has front-facing awning + signboard + window display. **Moderate risk** — FORBIDDEN_PAIR `[shed, shop]` already locked in word-list §6.
  - **vs. `box` (short-o target):** `box` is closed cuboid with tape line; `shed` has sloped roof + door + window. **Low risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple small wooden garden SHED, three-quarter view, sloped roof in soft warm-brown, single closed wooden door on the front face, one small square window beside the door, soft warm-brown wooden plank walls. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, grass, garden, environment, scene, house, mansion, barn, large building, smoke from chimney, smiling shed
```

- **Negatives — what to avoid:**
  - **House / mansion / large building** (LOAD-BEARING vs. shed scale violation).
  - Barn (different referent — bigger, multi-purpose farm building).
  - Grass / garden / environment (single subject only).
  - Chimney with smoke (introduces second subject + suggests "house").
  - Garden tools leaning against shed (introduces second subjects).
  - Photo-realistic photogrammetry-style shed.
  - Anthropomorphised shed with face on door.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shed.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The shed-vs-house distinction at 96pt is the key risk. Small scale + single door + single window + visible plank-texture wood reads as "shed". Multiple windows, two storeys, chimney = "house". If 4-grid produces house-leaning generations, retry with "small one-room shed, hut-sized, not a house" in the body.

---

### 2.7 `shop` — structure — `/ɒ/` inside

- **Vocabulary cue:** A small storefront — awning + signboard placeholder (no actual text on sign) + window display + door. Front view so the awning + sign read.
- **Distinctness check:**
  - **vs. `shed` (pack neighbor):** `shop` has front-facing awning + signboard + window display; `shed` has sloped roof + closed door. **Moderate risk** — FORBIDDEN_PAIR `[shed, shop]` locked.
  - **vs. `box` (short-o):** Different scale + shape. **No risk.**
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple small SHOP front, viewed face-on, soft warm-pink AWNING stretching across the top, a blank rectangular SIGNBOARD above the awning, a large WINDOW DISPLAY area showing a few simple round objects, a single door beside the window. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, hangul, korean text, fake text, sign text, brand logo, people inside, customers, street scene, environment, mall, large building, house, smiling shop
```

- **Negatives — what to avoid:**
  - **TEXT ON SIGN** (LOAD-BEARING; sign must be BLANK — no fake hangul, no fake English, no scribbled-text).
  - Brand logos / fake brand names.
  - People inside / customers visible (introduces second subjects).
  - Street scene with sidewalk / cars / other shops (environment violation).
  - Mall / large building / multi-storey (scale wrong).
  - House (different referent).
  - Photo-realistic storefront.
  - Anthropomorphised shop with face on awning.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shop.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** **The blank signboard is mandatory.** MJ has a strong drift to fill signage with hangul/korean-fake-text or generic-marketplace-text; the explicit `--no` and the "blank rectangular signboard" phrasing in the body are both required. If 4-grid produces text-laden generations, retry with stronger blank-sign emphasis.

---

### 2.8 `shore` — place — long-o + r-controlled (`/ɔːr/`) inside (sight-word-hybrid; Phase-2 contingency drop per word-list §7 Q2)

- **Vocabulary cue:** A simple sandy beach + soft wave at the bottom — flat sand with curved coastline meeting one soft pastel wave. Top-down or slightly-tilted view to show the sand-meets-water boundary.
- **Distinctness check:**
  - **vs. other water-context words:** None in pool (no fish, no boat).
  - **High risk:** composition complexity. Two elements (sand + water) in a single-subject style anchor is a stretch.
- **Prompt (paste-ready):**

```
Single subject, centered, square 1:1. Children's-book illustration, soft pastel palette, clean digital line art, gentle cel-shading. Background: solid soft cream. No text, no other figures. A simple SHORE, view from above showing a curved sandy beach in soft warm-cream meeting calm pastel-blue water with one gentle wavy line at the boundary, no horizon line, just the sand-meets-water boundary. --no anime, chibi, photorealistic, 3d render, multiple subjects, text, watermark, logo, saturated primaries, neon, pure black, drop shadow, sky, horizon, sun, palm tree, beach scene, people, swimmer, boat, ship, footprint, sand castle, seashell on beach, environment, full landscape
```

- **Negatives — what to avoid:**
  - **Sky / horizon / sun / palm tree** (LOAD-BEARING — environment violation; the single-subject is sand-meets-water boundary only).
  - People / swimmer (multi-subject).
  - Boat / ship on water (introduces second subject + conflicts with `ship` chip).
  - Seashell on beach (conflicts with `shell` chip).
  - Footprints / sand castle (introduces second subject).
  - Photo-realistic beach photograph.
  - Tropical island / lush vegetation (drift).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shore.svg` via `yarn embed-pictures` — **IF Phase-2 retains; otherwise SKIP this generation.**
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~40–80 KB (geometric simplicity).
- **Notes:** **Phase-2 review gate.** If MJ cannot produce a clean single-subject sand-meets-water chip in 4 grids without environment drift (sky / palm / boat), DROP THIS WORD from the pool per word-list §7 Q2. The 4-grid retry budget for `shore` is tighter than for other words — if first grid is full-beach-scene, regenerate with stronger no-environment emphasis; if second grid is still scene-laden, drop and ship at 7.

---

## 3. Workflow steps — generation → upscale → remove.bg → handoff

Per `feedback_mj_workflow_explicit_removebg` memory: MJ outputs ALWAYS have backgrounds. remove.bg is its own discrete step.

### Per-word workflow (Thomas operates):

1. **Paste the prompt** (from §2.X) into MJ Web prompt box.
2. **Set aspect ratio to 1:1** in the GUI dropdown.
3. **Submit; wait for 4-grid.**
4. **Review 4-grid:**
   - Does any one of the 4 pass the §1 of `picture-pack-style-anchor.md` cohesion checks?
   - Does the subject read as the target noun in <3 seconds?
   - Does it match the style of the prior pack pictures (short-a/o/u/i/e)?
5. **If 4-grid is mixed:** pick the strongest one. If all 4 fail, regenerate with adjustments (e.g., reduce environment language, strengthen blank-sign emphasis, soften facial features on animals).
6. **Upscale** the chosen image (U1/U2/U3/U4 button in MJ Web).
7. **Download** the upscaled PNG (≥1024×1024).
8. **Background removal:** drop the PNG into [remove.bg](https://remove.bg) — output a transparent PNG. **MJ outputs ALWAYS have backgrounds; this step is mandatory, never skip.** Verify the transparent PNG has a clean edge (no halo, no fringe).
9. **Save** the transparent PNG as `picture-{word}-removebg.png` under a local pictures-source folder (location TBD by Thomas's existing workflow).
10. **Handoff to Devon (Phase 3):** Devon's `yarn embed-pictures` script consumes the transparent PNGs and produces `picture-{word}.svg` files at `public/assets/pictures/` for the app.

### Pack-level workflow

Per `feedback_mj_walkthrough_step_by_step` memory: hand Thomas one prompt at a time, wait for his 4-grid feedback, fully sequence prompt → pick → upscale → remove.bg → save BEFORE moving to next word.

**Recommended generation order (start with strongest, build cohesion outward):**

1. `shell` — strongest single-object, lowest moderation risk. Establishes the pack's style baseline.
2. `ship` — strong single-object, low moderation risk.
3. `shoe` — single-object, low risk (watch for brand-logo drift).
4. `sheep` — animal, watch for kawaii-overload drift.
5. `shed` — structure, watch for house-leaning drift.
6. `shop` — structure, watch for text-on-sign drift (highest moderation risk in pack via fake-text moderation).
7. `shark` — animal, watch for fierce-teeth tone drift (highest tone risk in pack).
8. `shore` — composition-complex; Phase-2 contingency-drop if it doesn't pass.

After all 8 (or 7) are generated + upscaled + bg-removed + saved, hand the batch to Devon for `yarn embed-pictures` Phase 3.

---

## 4. Phase-3 SVG embed — Devon owns

Per `picture-pack-style-anchor.md` §6 and `.claude/docs/skill-trees-and-content.md` §"Path 2" (PNG-in-SVG embed pipeline):

- Devon runs `yarn embed-pictures` against the transparent-PNG batch.
- Output: `public/assets/pictures/picture-{ship,shell,shoe,sheep,shark,shed,shop,shore}.svg` (or 7 under Phase-2 drop).
- Target SVG file size: 40-100 KB per picture (PNG-in-SVG embed; not vector-traced — vector re-trace is polish backlog).
- Devon's `yarn embed-pictures` script handles the base64-encoding into single-`<image>`-element SVGs with the correct viewBox.

---

## 5. Acceptance criteria (this prompt sheet's deliverable)

- [ ] 8 paste-ready prompts (one per sh-target word), each in its own fenced code block, each ≤40 words for prompt body + tailored `--no` list.
- [ ] No `--v 6 --style raw --s 250 --ar` parameters in any prompt (v7 GUI workflow).
- [ ] No `--cref / --sref / --cw 80` flags in any prompt (style preamble carries cohesion).
- [ ] Per-word `--no` only; no pack-wide negative blocks.
- [ ] IP-name strip applied (no My Melody / Sanrio / Disney / Ghibli BY NAME in prompts).
- [ ] remove.bg as explicit Workflow §3 step (never implied as transparent from MJ).
- [ ] Generation order documented (start with `shell`, contingency-drop `shore`).
- [ ] Phase-3 handoff to Devon documented.

---

## 6. Non-obvious findings — surfacing to Thomas

1. **`shark` carries the highest tone-violation risk in the pack.** The closed-mouth + friendly + no-teeth + no-blood guardrails are mandatory. MJ has a strong drift toward menacing-shark imagery (Jaws-style, open jaws, prey-in-mouth). If 4-grid produces ANY violent imagery, regenerate — do not pick the "least-bad" of 4 violent grids. The negatives list is heavy on shark-tone for this reason.

2. **`shop` carries the highest moderation-flagging risk in the pack** via fake-text-on-sign. MJ's tendency to fill blank signboards with hangul or generic-shop-text triggers the moderator. The explicit `--no hangul, korean text, fake text, sign text` is mandatory. If moderation flags the prompt, retry with even-stronger blank-sign emphasis (e.g., "completely blank empty signboard with no writing").

3. **`shore` is the most likely Phase-2 drop in the pack.** Single-subject composition for a "place" is inherently a stretch. The 4-grid retry budget is tight; if both first grids produce full-beach-scenes, drop to 7 rather than fight the prompt. This is documented in word-list §7 Q2 and §2.8 here.

4. **The prompt-body word count is deliberately tight (≤40 words).** Earlier short-e / short-u prompt sheets ran 200+ words; that drove moderation triggers and prompt-truncation. The short form here trades some explicit detail for moderation safety + reproducibility. If 4-grid quality is lower than expected, the recovery move is NOT to lengthen the prompt body — it's to refine the per-word `--no` list (more specific anti-attractors) and the subject-detail phrase.

5. **The pack inherits no pose-zero / `--cref` / `--sref` cohesion lever.** Style cohesion across the 8 generations rests entirely on the §1.4 short-form preamble being byte-for-byte identical across prompts. If Thomas observes pack-wide drift (one generation looks photographic vs. another illustrated), the fallback is to capture a `shell`-pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 7 — but that is opt-in, not the default. Per `feedback_mj_pack_cohesion_lever_unused` memory, this fallback has never been used and 38+ assets have shipped with style-preamble-only cohesion.

6. **Long-vowel hybrid words (`shoe`, `sheep`, `shark`, `shore`) are NOT visually different from short-vowel words.** Marian sees them as chips like any other sh-word; the audio + picture do the rest-of-word decoding work. The picture-pack quality bar is the same for all 8 — no special "long-vowel scaffolding" in the visual.

7. **`shed` and `shop` are the highest vocabulary-register risk words in the pack** for an 8yo Manila Filipino-English learner. The picture+audio scaffold is the design response, but Thomas should be alert during real-iPad smoke that these two don't produce confusion in real-Marian observation. The contingency (drop `shop` and/or `shed` if real-Marian observation shows register mismatch eating chip-tap accuracy) is in word-list §1 finding #4.

8. **Generation order matters for pack cohesion.** Starting with `shell` (lowest moderation/tone risk, strongest single-subject) gives Thomas a clean style baseline before tackling the riskier words (`shark`, `shop`, `shore`). Don't start with `shore` even though it's last in §2 ordering — start with `shell` per §3 §"Pack-level workflow" recommended order.
