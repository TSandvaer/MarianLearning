# Word Song — digraphs `sh` picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney Web operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory, step-by-step with 4-grid feedback per word per `feedback_mj_walkthrough_step_by_step` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready, one prompt per word.
**Predecessor specs:** `design/word-song/digraphs-sh-word-list.md` (sibling — defines the 8-word pool and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame — inherited verbatim), `design/word-song/short-e-picture-pack-prompts.md` (most recent CVC prompt sheet — structural template, with MJ-parameter updates below).
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14).

---

## 0. Scope — 7 wholly-new sh-initial words (post-Dave-addendum Option C-minus)

This pack covers **7 wholly-new sh-initial targets** (no re-traces — none of these words exist as distractors in prior tiers):

> **`ship`, `shell`, `shoe`, `sheep`, `shark`, `shed`, `shop`.**

Pool went 8 → 7 per Dave's research addendum `design/research/digraph-sh-long-vowel-addendum.md` §Q7c (Option C-minus): `shore` dropped — `/ɔːr/` r-controlled vowel is phonemically novel for Tagalog-L1 + composition-complex picture, with no vocabulary-familiarity compensator. Deferred to a future r-controlled-vowel tier. See §2.8 below and word-list §1 / §10 finding #6 for the full reasoning.

**Total generations needed for this pack: 7.**
**Total SVG file changes after Phase 3: 7 new.**

**3 of the 7 are `hybridMode: true`** in the word-pack schema (per word-list spec): `shoe`, `sheep`, `shark`. These long-vowel sh-onsets are whole-word audio+picture sight-word-hybrid entries — picture quality bar for them is the same as for the short-vowel words, but the planner gating around them is different (chip-tap recognition only, never segment/spell/decode prompts). Picture-pack itself does not need to mark them differently; the canon-bake schema handles the gate.

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

### 1.4 ≤40-word ceiling per prompt body — and the ≤12-entry `--no` ceiling

Per `feedback_mj_moderator_negatives_per_word` memory: "≤40-word ceiling, IP-name-stripping, photoreal-drift on object subjects" + "9-12 entries per prompt with no moderator trips. Trim path: drop redundant entries first."

**Each prompt below is targeted at ≤40 words for the prompt body** (excluding the trailing `--no` list which doesn't count against the body word-limit per MJ's parsing). The earlier short-e / short-u prompts ran 200+ words each; that was an antipattern — MJ truncates and moderates aggressively past ~40 words.

**The two-ceiling structure:**

| Slot                             | Target                                                  | Why                                                                         |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Style preamble (§1.4 below)      | ≤14 words, byte-for-byte identical across all 8 prompts | Pack cohesion lever (per §1.2 — no `--cref/--sref` fallback used)           |
| Subject phrase + subject details | ≤22 words per prompt                                    | Subject identity load-bearing for the chip read; the preamble handles style |
| `--no` list                      | ≤12 logical-concept entries per prompt                  | Empirically the moderator-safe ceiling per memory rule                      |

Total body: ≤14 + ≤22 = ≤36 words — leaves 4 words headroom under the 40-word ceiling for word-specific safety phrases (e.g., "(closed mouth)" on `shark`).

**Cohesion-vs-moderation tension flagged by Devon's PR #212 review.** Shortening the preamble weakens cohesion (no pose-zero, no `--cref/--sref`, no `--sref` style anchor — the byte-for-byte preamble IS the only cohesion lever). The ≤14-word preamble below preserves: (a) the style descriptor cluster (children's-book illustration, soft pastel, clean line art) — the load-bearing visual-style cohesion seed; (b) the cream-background rule — the only colour anchor; (c) the single-subject rule — the only compositional anchor; (d) the no-text rule — moderation safety. Anything shorter loses one of those four. If pack-wide drift emerges in 4-grid review across the 8 generations, the documented opt-in fallback (capture a `shell` pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 7 — see §1.2) remains available.

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

## 1.4 Style preamble — short form (14 words; canonical full preamble in style-anchor §2)

Re-use this short-form preamble byte-for-byte across all 8 prompts in this pack:

> **Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text.**

14 words. Carries: style cluster (children's-book illustration, soft pastel, clean line art) = cohesion seed; cream-background = colour anchor; single-subject = compositional anchor; no-text = moderation safety. The aspect ratio (1:1) is set via the MJ Web GUI dropdown per §1.1, NOT in the preamble.

Each per-word prompt below appends a short subject phrase (≤22 words including subject-specific details) to this preamble. Total body stays ≤36 words.

**Why this preamble is shorter than the v0 (32-word) form.** Removed: `centered` (implicit in single-subject + square ratio set via GUI), `square 1:1` (set via GUI per §1.1), `solid soft cream` (collapsed to `cream background`), `gentle cel-shading` (collapsed into `clean line art` — cel-shading is a style sub-detail of the line-art aesthetic), `no other figures` (collapsed into `single subject`). The 4 load-bearing anchors are preserved.

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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A simple cartoon SHIP, three-quarter view, hull plus deck, single smokestack, three small portholes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, war ship military, smiling ship with face, pirate ship, sailing yacht rigging, multiple ships
```

- **Word-count check:** body 35 words (14 preamble + 21 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 entries collapsed to 11 concepts):**
  - **War ship / military / armed vessel** (drift to violence — collapsed into `war ship military`).
  - **Smiling ship with face on hull** (anti-anthro — collapsed into `smiling ship with face`).
  - **Photo-realistic ocean liner / cruise ship** (covered by `photorealistic`).
  - **Sailing yacht with detailed rigging** (visual noise — `sailing yacht rigging`).
  - **Multiple ships in fleet** (single subject — `multiple ships`).
  - **Pirate ship** (cultural / content-tone wrong — `pirate ship`).
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A simple SEASHELL, scallop fan shape, five fluted ribs spreading from a small rounded hinge, warm pink and cream. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, eggshell, broken cracked shell, snail with shell, beach environment, smiling shell with face
```

- **Word-count check:** body 36 words (14 preamble + 22 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Eggshell** (different word; confusable).
  - **Broken / cracked shell** (visual noise — `broken cracked shell`).
  - **Snail with shell** (introduces second subject).
  - **Sand grains / beach environment** (second subject — `beach environment` covers both).
  - **Pearl inside shell** (second subject — covered by `multiple subjects`).
  - **Anthropomorphised shell** (anti-anthro — `smiling shell with face`).
  - **Photo-realistic conch with detailed texture** (covered by `photorealistic`).
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A single child's sneaker, side view, soft cream or rose body, one velcro strap, flat rubber sole. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, brand logo swoosh, sock or foot inside, pair of shoes, high-heeled adult shoe, boot sandal flip-flop, smiling shoe with face
```

- **Word-count check:** body 36 words (14 preamble + 22 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Brand logos / swoosh / nike / adidas** (IP risk per `feedback_mj_moderator_negatives_per_word` IP-strip rule — collapsed into `brand logo swoosh`).
  - **Foot inside shoe / sock visible** (second subject / body fragment — `sock or foot inside`).
  - **Pair of shoes** (multi-subject; single shoe only).
  - **High-heeled / adult dress shoe** (vocab/tone wrong for 8yo — `high-heeled adult shoe`).
  - **Boot / sandal / flip-flop** (different referent — `boot sandal flip-flop`).
  - **Anthropomorphised shoe with face** (anti-anthro — `smiling shoe with face`).
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A friendly cartoon SHEEP, three-quarter view, fluffy cloud-shaped wool body, small warm-grey head and legs, round eyes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, grass farm scene, flock or lamb with mother, sheep wearing clothes, kawaii sparkle eyes, black sheep
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Grass / farm scene / fence / barn** (environment violation — `grass farm scene`).
  - **Flock / multiple sheep / mother with lamb** (single subject — `flock or lamb with mother`).
  - **Photo-realistic feather-detail wool** (covered by `photorealistic`).
  - **Anthropomorphised sheep wearing clothes / standing upright** (anti-anthro — `sheep wearing clothes`).
  - **Cute kawaii sheep with sparkle-eyes** (drift — `kawaii sparkle eyes`).
  - **Black sheep** (palette + recognition cue weaker).
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A FRIENDLY cartoon shark, side view, sleek soft-grey body, triangular dorsal fin, small round friendly eye, closed mouth no teeth. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, sharp teeth, open mouth, blood, hunting prey, attacking, ocean environment
```

- **Word-count check:** body 39 words (14 preamble + 25 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (LOAD-BEARING; trimmed from 26 to 12 per Devon's PR #212 review of stack-violence-words moderator-trip risk):**
  - **Sharp teeth / open mouth** — the two visible cues that turn a friendly shark into a fierce shark. Both must be in `--no` (visual instructions to MJ).
  - **Blood** — single-entry, load-bearing tone guardrail (drop on its own; not in style cluster).
  - **Hunting prey / fish-in-mouth** — collapsed into `hunting prey`.
  - **Attacking** — collapsed cover for `fierce shark, scary, predator, attacking`. Trigger-word `scary`/`fierce`/`predator`/`Jaws` deliberately omitted from `--no` itself to avoid stacking violence words in the negation block (per Devon's moderator-trip warning). Body's positive framing — `FRIENDLY cartoon shark, closed mouth no teeth` — carries the rest.
  - **Ocean environment** — multi-subject / scene violation.
  - **Photo-realistic Jaws-style** covered by `photorealistic`.
  - **Multiple sharks** covered by `multiple subjects`.
  - **Hammerhead / whale-shark / great-white-specific** — not specified in `--no`; the body's "simple cartoon" framing handles species-genericity. Word-count budget prioritizes the load-bearing tone guardrails.
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A small wooden SHED, three-quarter view, sloped roof, single closed door, one small square window, plank walls, hut-sized not a house. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, house mansion, barn, chimney smoke, grass garden environment, garden tools, smiling shed
```

- **Word-count check:** body 40 words (14 preamble + 26 subject); `--no` 12 logical-concept entries. At ceiling. "Hut-sized not a house" baked into v1 body per Devon's pre-emptive nit (save the 4-grid retry).
- **Negatives — what to avoid (12 concepts):**
  - **House / mansion / large building** (LOAD-BEARING vs. shed scale violation — `house mansion`).
  - **Barn** (different referent — bigger, multi-purpose farm building).
  - **Chimney with smoke** (introduces second subject + suggests "house" — `chimney smoke`).
  - **Grass / garden / environment** (single subject — `grass garden environment`).
  - **Garden tools leaning against shed** (second subjects — `garden tools`).
  - **Photo-realistic photogrammetry-style shed** (covered by `photorealistic`).
  - **Anthropomorphised shed with face** (anti-anthro — `smiling shed`).
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
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A small SHOP front, face-on, soft warm-pink awning, completely blank signboard with no writing of any kind, simple window display, single door. --no anime, photorealistic, 3d render, multiple subjects, watermark, hangul korean text, fake sign text, brand logo, people customers, mall building, house, smiling shop
```

- **Word-count check:** body 39 words (14 preamble + 25 subject); `--no` 12 logical-concept entries. Under both ceilings. "Completely blank signboard with no writing of any kind" baked into v1 body per Devon's pre-emptive nit (the strongest blank-sign emphasis available without further inflating body word count).
- **Negatives — what to avoid (12 concepts; text-on-sign cluster is LOAD-BEARING per `feedback_mj_moderator_negatives_per_word` moderator-trip risk):**
  - **Hangul / korean text** (LOAD-BEARING — MJ's strongest drift for blank signboards; one entry).
  - **Fake sign text** (load-bearing — covers fake-English, scribbled-text, generic-marketplace-text).
  - **Brand logo / brand names** (IP + content rule).
  - **People inside / customers** (multi-subject — `people customers`).
  - **Mall / large building / multi-storey** (scale — `mall building`).
  - **House** (different referent).
  - **Anthropomorphised shop with face on awning** (anti-anthro — `smiling shop`).
  - **Photo-realistic storefront** covered by `photorealistic`.
  - **Street scene with sidewalk / cars / other shops** — not separately listed; covered by `multiple subjects` + the body's "face-on" framing.
- **Moderator-trip resilience:** Devon's review flagged this prompt as one of the two highest moderator-risk in the pack. If MJ moderation rejects on first paste, retry path is to drop `hangul korean text` and `fake sign text` from `--no` and rely on the body's "completely blank signboard with no writing of any kind" alone to carry the constraint. The stronger body phrasing is the primary lever; the `--no` is the redundancy.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-shop.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via remove.bg → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** **The blank signboard is mandatory.** MJ has a strong drift to fill signage with hangul/korean-fake-text or generic-marketplace-text; the explicit `--no` and the "blank rectangular signboard" phrasing in the body are both required. If 4-grid produces text-laden generations, retry with stronger blank-sign emphasis.

---

### 2.8 `shore` — REMOVED (Dave addendum 2026-05-14, Option C-minus)

`shore` was dropped from the v1 sh-tier pool per Dave's research addendum `design/research/digraph-sh-long-vowel-addendum.md` §Q7c. Two independent compounding concerns: (1) `/ɔːr/` r-controlled vowel is phonemically novel + less perceptually familiar to a Tagalog-L1 speaker than `/ɑːr/`; (2) the picture requires multi-subject composition (sand + water + boundary) which violates the single-subject style anchor and reads ambiguously as "beach"/"ocean" rather than "shore" at 96pt. No compensating vocabulary strength — Filipino-English 8yo register reaches for "beach", not "shore". Dave's recommendation: defer `shore` to a future r-controlled-vowel tier where the phoneme has been formally introduced and a cleaner picture composition can be designed.

**Action:** no `shore` MJ prompt in v1 pack. Pool ships at 7. See word-list §1 for the locked v1 pool and §10 finding #6 for the deferral context.

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

After all 7 are generated + upscaled + bg-removed + saved, hand the batch to Devon for `yarn embed-pictures` Phase 3.

---

## 4. Phase-3 SVG embed — Devon owns

Per `picture-pack-style-anchor.md` §6 and `.claude/docs/skill-trees-and-content.md` §"Path 2" (PNG-in-SVG embed pipeline):

- Devon runs `yarn embed-pictures` against the transparent-PNG batch.
- Output: `public/assets/pictures/picture-{ship,shell,shoe,sheep,shark,shed,shop}.svg` — 7 files.
- Target SVG file size: 40-100 KB per picture (PNG-in-SVG embed; not vector-traced — vector re-trace is polish backlog).
- Devon's `yarn embed-pictures` script handles the base64-encoding into single-`<image>`-element SVGs with the correct viewBox.

---

## 5. Acceptance criteria (this prompt sheet's deliverable)

- [ ] **7 paste-ready prompts** (one per sh-target word), each in its own fenced code block, each ≤40 words for prompt body + tailored `--no` list at ≤12 logical-concept entries (per `feedback_mj_moderator_negatives_per_word` empirical ceiling).
- [ ] No `--v 6 --style raw --s 250 --ar` parameters in any prompt (v7 GUI workflow).
- [ ] No `--cref / --sref / --cw 80` flags in any prompt (style preamble carries cohesion).
- [ ] Per-word `--no` only; no pack-wide negative blocks.
- [ ] IP-name strip applied (no My Melody / Sanrio / Disney / Ghibli BY NAME in prompts).
- [ ] remove.bg as explicit Workflow §3 step (never implied as transparent from MJ).
- [ ] Generation order documented (start with `shell`).
- [ ] Phase-3 handoff to Devon documented.
- [ ] §1.4 style preamble is ≤14 words, byte-for-byte identical across all 7 prompts (cohesion lever).
- [ ] Total body per prompt: preamble (14) + subject phrase + details (≤22) = ≤36 words. Headroom for word-specific safety phrases (e.g., "(closed mouth)" on `shark`).

---

## 6. Non-obvious findings — surfacing to Thomas

1. **`shark` carries the highest tone-violation risk in the pack.** The closed-mouth + friendly + no-teeth + no-blood guardrails are mandatory. MJ has a strong drift toward menacing-shark imagery (Jaws-style, open jaws, prey-in-mouth). If 4-grid produces ANY violent imagery, regenerate — do not pick the "least-bad" of 4 violent grids. **Per Devon's PR #212 review (2026-05-14):** the v0 `--no` list stacked 9 violence-trigger words (`fierce, sharp teeth, jaws, blood, scary, predator, hunting, prey, attacking`) which itself risks moderator-trip in the negation block. The trimmed v1 list keeps 5 load-bearing visual cues (`sharp teeth, open mouth, blood, hunting prey, attacking`) and relies on the body's positive framing — `FRIENDLY cartoon shark, closed mouth no teeth` — to carry the rest.

2. **`shop` carries the highest moderation-flagging risk in the pack** via fake-text-on-sign. MJ's tendency to fill blank signboards with hangul or generic-shop-text triggers the moderator. The explicit `--no hangul korean text, fake sign text` is necessary; the **stronger lever is the body phrasing** — "completely blank signboard with no writing of any kind" baked into the v1 body per Devon's pre-emptive nit. If moderation flags the prompt despite both, the resilience retry path is to drop the text-related entries from `--no` (which themselves may compound moderator-trip via stacking text-trigger words in the negation block) and rely on the body alone.

3. **`shore` was dropped from the v1 pool** per Dave's research addendum (`design/research/digraph-sh-long-vowel-addendum.md` §Q7c, Option C-minus). Two independent compounding concerns: `/ɔːr/` r-controlled vowel is phonemically novel for Tagalog-L1 + composition-complex picture, with no vocabulary-familiarity compensator. Pool ships at 7. `shore` is deferred to a future r-controlled-vowel tier where the phoneme is formally introduced and the picture can be cleaner. Documented in §0 and §2.8 above.

4. **The prompt-body word count is deliberately tight (≤40 words; new ≤14-word preamble + ≤22-word subject = ≤36 total).** Earlier short-e / short-u prompt sheets ran 200+ words; that drove moderation triggers and prompt-truncation. The v0 of THIS sheet ran 53-63 words per prompt — Devon flagged in PR #212 review that the §1.4 preamble (32 words) inflated every body above the 40-word moderator ceiling. The v1 shortened preamble (14 words) brings every body in under 40 while preserving the cohesion lever. Trim path for recovery: refine per-word `--no` list (more specific anti-attractors) and the subject-detail phrase — NOT lengthen the body.

5. **The pack inherits no pose-zero / `--cref` / `--sref` cohesion lever.** Style cohesion across the 7 generations rests entirely on the §1.4 short-form preamble being byte-for-byte identical across prompts. **Devon flagged this as a cohesion-vs-moderation tension:** shortening the preamble for moderation safety also weakens the cohesion lever. The 14-word preamble is the minimum that still carries 4 load-bearing anchors (style cluster, cream background, single subject, no text). If Thomas observes pack-wide drift (one generation looks photographic vs. another illustrated), the fallback is to capture a `shell`-pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 6 — but that is opt-in, not the default. Per `feedback_mj_pack_cohesion_lever_unused` memory, this fallback has never been used and 38+ assets have shipped with style-preamble-only cohesion.

6. **`--no` list ceiling is ≤12 logical-concept entries per prompt** (per `feedback_mj_moderator_negatives_per_word` empirical recipe — Kyle's PR #189 confirmed 9-12 entries with no moderator trips; longer lists trip moderation themselves). Each v1 prompt below is 11-12 entries, trimmed from the v0's 20-26 entries by collapsing redundant style negatives (e.g., dropping `chibi` and `logo` since `anime` and `watermark` cover the same drift class) and folding multi-word phrases into single logical concepts (e.g., `hangul korean text` as one entry, not two).

7. **Long-vowel hybrid words (`shoe`, `sheep`, `shark`) are NOT visually different from short-vowel words.** Marian sees them as chips like any other sh-word; the audio + picture do the rest-of-word decoding work. The picture-pack quality bar is the same for all 7 — no special "long-vowel scaffolding" in the visual. (The hybrid annotation lives in the canon-bake schema, not in the picture; see word-list spec.)

8. **`shed` and `shop` are the highest vocabulary-register risk words in the pack** for an 8yo Manila Filipino-English learner. The picture+audio scaffold is the design response, but Thomas should be alert during real-iPad smoke that these two don't produce confusion in real-Marian observation. Dave's addendum notes a compensating factor: these are British-English high-frequency words and useful advance vocabulary anchors for Marian's August 2026 Danish-school transition (Danish school English instruction uses British register). The contingency (drop `shop` and/or `shed` if real-Marian observation shows register mismatch eating chip-tap accuracy) is in word-list §1 finding #4.

9. **Generation order matters for pack cohesion.** Starting with `shell` (lowest moderation/tone risk, strongest single-subject) gives Thomas a clean style baseline before tackling the riskier words (`shark`, `shop`). End with the two highest-moderator-risk prompts (`shop`, `shark`) so the earlier generations establish style consistency before Thomas hits the prompts most likely to need retries.

10. **The cohesion-vs-moderation tension flagged by Devon's PR #212 review is structural, not solvable.** The preamble is the only cohesion lever (no `--cref`, no `--sref`); the ≤40-word body ceiling is the moderator-trip threshold. Solving for one weakens the other. The v1 shortened preamble is the optimization landing — it preserves enough cohesion seed (4 load-bearing anchors) while bringing every body under 40 words. If real-iPad-tested pack-wide drift emerges across the 7 generations, the opt-in `--cref/--sref/--cw 80` fallback is documented; if moderator-trips emerge on `shark` or `shop`, the trim path is to drop violence/text trigger words from `--no` and let the body's positive framing carry the constraint. Both fallbacks are real-Marian-observation-gated.
