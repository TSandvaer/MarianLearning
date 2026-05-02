# Word Song picture pack — style anchor

**Audience:** Thomas (Midjourney operator, phase 2), Kyle/Devon (vector trace, phase 3).
**Author:** Marian Tutor design persona.
**Ticket:** `86c9kww0h`.
**Status:** Locked style frame — every prompt in `picture-pack-prompts.md` inherits this verbatim.

This is the **style preamble** that goes into every Midjourney prompt for the v1 picture pack, byte-for-byte. The per-word prompts in `picture-pack-prompts.md` append subject-specific fragments to this preamble. Variation in this block across prompts is the #1 cause of pack-wide style drift — copy it; do not paraphrase it.

---

## 1. Goal

Produce 22 illustrations that:

1. **Anchor vocabulary for an L2 8yo.** A child looking at the picture should arrive at the target noun without prior context. Whiskers + pointed ears + tail = "cat" even if the English word "cat" isn't yet in active vocabulary.
2. **Cohere as one visual world.** All 22 pictures look like they came from the same children's-book illustrator. Style mismatch within the pack would foreground the style as the discrimination cue rather than the meaning, breaking the pedagogy.
3. **Read crisp at chip size.** Pictures render at ~96×96pt in the chip and ~180pt+ on the word card. Detail discipline matters — a fan that reads "small lamp" at 96pt is a failed picture.
4. **Look like tonal siblings of Emma.** Same warmth, same palette family, same line philosophy. The picture chips and Emma share screen real-estate; if Emma is warm-pastel-manhwa and the chips are flat-icon, the screen splits visually.
5. **Distinguish forbidden-pair neighbors at a glance.** `cat` and `dog` (silhouette neighbors) need to read as distinctly different animals at 96pt — not generic-furry-creature.

---

## 2. Style preamble — the consistency seed

**Re-use this paragraph byte-for-byte across every generation in the pack.** This is the load-bearing block.

> **Single subject, centered, square 1:1 composition.** A child-friendly illustrated [SUBJECT] in the style of **modern slice-of-life Korean manhwa / webtoon children's book illustration**. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). **Palette: warm pastels** — soft pinks, peaches, creams, warm browns, soft mauve, soft sage — **no saturated primary colors, no neon, no pure black**. Object-specific colors allowed (a bus is yellow or blue, a frying pan is grey, an apple is red) but always **desaturated and illustrated**, never photographic. Skin tones if any: warm cream (#F5DCC9). Hair if any: warm dark brown (#5C3F31), never pure black, never blonde. **Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop, no decorative elements behind the subject.** **Single subject only — no other figures, no text, no labels, no signage, no logos, no UI overlays, no watermarks.** **Friendly tone**, large-eyed where the subject has eyes, rounded forms, soft-natural proportions. **Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon illustration.** Read-on-first-look: a kind, simple, clearly identifiable [SUBJECT] that a 6-to-8-year-old would point at and name. Drawn for a children's vocabulary book, not for a clinical icon set, not for a marketing illustration, not for a stock photo.

**Replace `[SUBJECT]` with the per-word subject string from `picture-pack-prompts.md` row.** Everything else stays.

---

## 3. Locked style attributes

These are non-negotiables. If a generation drifts on any one of these, regenerate.

### 3.1 Aspect ratio + composition

- **1:1 square.** 1024×1024 minimum, 1792×1792 maximum on longest side (per the same Claude many-image upload constraint Emma's prompt sheet hits — `character-emma-ai-prompts.md` §5).
- **Subject fills 60-75% of frame**, centered, with ~12-20% margin on all sides for breathing room.
- **Single subject only.** No accompanying objects, no scene props, no decorative borders.
- **Slight three-quarter view** preferred for objects with depth (cars, fans, hats, bags) over flat side-elevation. Animals in side or three-quarter view, friendly upright pose, never lying down.

### 3.2 Background convention

- **Solid soft cream (#FFF6EE)** — same color Emma's prompts target. Flat, no gradient, no scene, no shadow under the subject.
- **Phase 3 keys this background to transparent** during the SVG trace. The cream backdrop exists only to give Devon a clean masking edge.
- **No drop shadow on the subject** in v1. Phase 3 may add a subtle drop shadow in CSS if Thomas wants depth on the chip; we don't bake it into the asset.

### 3.3 Palette

The world palette is already locked in `tailwind.config.js`. The picture pack extends it without introducing new families.

| Token / hex | Use in pictures |
| ----------- | --------------- |
| `#FFF6EE` (Emma cream) | Background plate (keyed transparent in phase 3) |
| `#FFB7C5` (`--my-rose`) | Soft pink fills — bow accents, jam jar contents, tag base, cap surface |
| `#F0CDB8` (Emma cardigan peach) | Warm peach fills — secondary palette for clothing/object surfaces |
| `#F5DCC9` (Emma skin) | Skin tone for `man` / `dad` figures, neutral cream for non-pink objects |
| `#5C3F31` (Emma hair) | Hair, fur (warm-brown animals), wood (log, wand), darker contour |
| `#3E2818` (Emma eye) | Eye fills, deepest contour — never pure black |
| `#C77A7A` (Emma mouth) | Mouth fills, soft red accents (jam contents, tag string) — never bright red |
| Object-specific desaturated colors | yellow `#F4D89B` (sun, school bus), soft blue `#A5C4D8` (van, water), soft green `#A8C8A0` (leaf accents on log), soft grey `#C8C2BD` (pan, can, pot) |

**Anti-palette (regenerate if any of these appear):**

- Saturated primary red (`#FF0000` or near). Soft rose only.
- Pure black (`#000000`). Deep warm brown for contour.
- Neon / fluorescent anything.
- High-contrast photographic palette (real-world cat fur with subtle gradients, etc.).
- Sepia or grayscale.

### 3.4 Line weight + line treatment

- **Outer contour: ~2-2.5 px stroke at 1024×1024 render.** Same weight as Emma's lineart. Heavier than icon-set work, lighter than dynamic shonen.
- **Inner detail lines: ~1.5 px**, used sparingly. Not every fold needs a line; use color zones to suggest form.
- **Line color: warm dark brown (#3E2818) or matching subject darker tone**, never pure black.
- **Closed contours.** Every fillable region has a closed outer line so phase 3's SVG trace produces clean paths.
- **No double-stroke / heavy-shadow lineart** common in shonen-adjacent manga.
- **No line breaks for "sketch" effect.** Solid clean lines throughout.

### 3.5 Shading

- **Single soft shadow companion per color zone.** If the bus body is `#A5C4D8`, its shadow side is one stop darker `#7FA0B5`. No three-tone rendering.
- **Soft cel-shading** — no airbrush gradients, no painted-style soft falloff. The shadow is a defined region with a soft edge, not a smooth blend.
- **Light direction: upper-left** for consistency across the pack.
- **No drop shadow under the subject** in the asset (see §3.2).

### 3.6 Framing per category

| Subject category | Framing |
| ---------------- | ------- |
| Animals (cat, bat, dog, fox) | Sitting upright, three-quarter view, friendly forward-facing expression, eyes open, warm. |
| Vehicles (bus, van) | Three-quarter front-side view (the "pretty side" — front + side both visible), ground line implied not drawn. |
| Kitchen items (pan, pot) | Three-quarter from above (slight perspective so handles visible), centered. |
| Household objects (mat, fan) | Three-quarter view; mat slightly tilted in perspective; fan as pedestal-fan three-quarter front. |
| Clothing / accessories (hat, cap, bag) | Three-quarter view as if hanging or worn; hat = wide-brim sun hat; cap = baseball cap with visible peak. |
| Containers (cup, can, jam jar) | Three-quarter, eye-level or slight-above, ring-pull / lid / contents-through-glass visible per row. |
| Food / packaging (jam) | Three-quarter view of jar; contents visible through glass. |
| People (man, dad) | Stylised silhouette-figure with minimal facial detail (eyes as small dots, mouth as soft line, no nose detail), front or three-quarter, warm posture. **`dad` is two-figure (parent + child); `man` is one-figure standalone.** |
| Tools / props (pen, log, tag) | Side or three-quarter view; pen with visible cap and clip; log horizontal with bark texture lines; tag with visible string loop. |
| Celestial (sun) | Round disc with simple radiating rays, no face, soft yellow with rose tint. |

### 3.7 Subject-specific anti-conventions

- **Animals: NOT anthropomorphised.** No clothes, no faces beyond standard animal expression, no human-like upright walking, no smiling-cartoon faces with cheeks. The cat is a cat; the dog is a dog. **Exception (v1, Thomas-locked, K):** `bat` is "Sanrio-style friendly" with big eyes and no fangs — but still NOT clothed and NOT walking upright. Big-eyed cute, not anthropomorphised.
- **Vehicles: NO faces.** Buses do not smile. Vans do not have eye-windows. Pure object renders.
- **Kitchen items: NO contents.** No food in the pan, no soup in the pot. Empty vessels with the disambiguating shape detail (handle count, depth) carrying the read.
- **People: minimal facial detail.** `man` and `dad` use stylised silhouette-figure approach (eyes as small dots, no nose, soft mouth line) so they don't compete with Emma's character role on screen. Per `word-song-picture-pack.md` §Per-word brief #7 + project_spec_drift_decisions L.
- **Sun: NO face.** Earlier Word Song spec drafts allowed a "friendly sun face"; v1 locks "no face" to keep the pack consistent (no other object has a face; sun shouldn't either).

---

## 4. Anti-references — what we are NOT aiming for

Inherited from `design/character/reference-styles.md` §"What we're NOT aiming for", adapted for object/animal subjects.

| Style | Why excluded |
| ----- | ------------ |
| **Anime / shonen** (sharp lines, dynamic angles, action poses) | Lines too sharp, mood too intense, palette tendency toward saturated. |
| **Chibi / super-deformed** | Infantilising; reads as toy/mascot, not real-world vocabulary anchor. |
| **Disney 3D / Pixar** | Wrong medium (we're SVG-2D-bound). Wrong tonal register (Pixar facial proportions slide toward "appealing/marketable" attractor). |
| **Realistic 3D-rendered or photorealistic** | Style mismatch with Emma; phase 3 SVG trace would lose all the rendering subtlety anyway. |
| **The Noun Project / Material Icons / abstract icon-set** | Too low information for picture-as-meaning role. Marian needs a recognisable cat, not a cat-glyph. |
| **Eric Carle collage / Sandra Boynton thick-line** | Lovely children's-book traditions, but tonal mismatch with Emma's clean digital line. |
| **Sanrio-derivative cute** (Hello Kitty / My Melody / Cinnamoroll style) | Project explicitly dropped Sanrio IP on 2026-04-28; drifting back here re-introduces the IP risk that motivated the Emma pivot. **Exception scoped tightly:** `bat` may be "Sanrio-Kuromi-style friendly bat" — but ONLY in the no-fangs-big-eyes-cute sense; not in the trademark-character-likeness sense. |
| **Stock children's-book illustration with a different illustrator's hand** | Style mismatch within the pack would split the visual world. |
| **Emoji-style flat icons** (Apple emoji, Twemoji) | Too low information at chip size; emotional valence wrong (emoji are designed to convey feelings, not anchor vocabulary). |
| **Romantic / shoujo-with-stars** | Wrong context (subject pictures, not character work). |
| **Stylised "kawaii everything" with sparkles and decorative stars** | Sparkles belong to Melody-world's reward feedback (`sparkle-particle.svg`), not to the chip pictures. The picture is the noun; sparkles are reward. Don't mix. |

---

## 5. Cohesion check — does this look like Emma's tonal sibling?

Quick checks Thomas runs after each generation, before accepting:

- [ ] Could this picture sit on the same screen as Emma without looking like a different art style?
- [ ] Is the line weight roughly the same as `emma-idle.svg`?
- [ ] Is the palette in the warm-pastel family — no saturated primaries, no neon, no pure black, no sepia?
- [ ] Is the background solid soft cream (or near-cream) so phase 3's mask is clean?
- [ ] Is the subject the only thing in frame? No accompanying props, no environment.
- [ ] Does the picture read as the target noun in <3 seconds without text labels?
- [ ] At 96×96pt resize, is the subject still identifiable?
- [ ] Does the picture look like it came from the same illustrator as the OTHER pictures already approved this session?

If any "no", regenerate or use the drift table in `picture-pack-iteration-plan.md` §Drift fixes.

---

## 6. Phase 3 trace requirements (Kyle/Devon)

For phase 3 (separate ticket), here is what the SVG trace needs to honor — flagged here so phase 2's generation choices don't paint phase 3 into a corner.

- **Trace target file size: <30 KB per picture** (per `word-song-picture-pack.md` §Style requirements).
- **Single SVG root, single viewBox per file.** Run through SVGO with codebase default config.
- **Filename: `picture-{word}.svg` at `public/assets/pictures/`.**
- **Closed paths** — every fillable region must close cleanly. Open paths from messy generation lines turn into trace artefacts.
- **Limited color count** — 6-8 fill colors max per picture so the SVG path-merge step in SVGO is effective.
- **Transparent background** — phase 3 keys the soft-cream backdrop to transparent before tracing.
- **No raster-in-SVG.** Same lesson as Emma's PNG-in-SVG fidelity-followup — phase 3 produces true vector geometry, not a base64-encoded raster wrapped in SVG.

If the Midjourney generation produces a subject Thomas loves but phase 3 finds untraceable (too painterly, too detailed, too many colors), the iteration plan's escalation ladder kicks in — see `picture-pack-iteration-plan.md` §Escalation.

---

## 7. Provenance

- **Style inheritance:** `design/character-emma.md` §2.1 (style anchors), `design/character/reference-styles.md` (manhwa/webtoon attribute table + anti-references), `design/character-emma-ai-prompts.md` §1 (base-prompt structure).
- **Palette source:** `tailwind.config.js` `--my-*` and Emma palette tokens.
- **Aspect-ratio + resolution constraint:** `design/character-emma-ai-prompts.md` §5 (1792 max for Claude many-image cap).
- **Anti-Sanrio rule:** `project_character_pivot_emma_2026_04_28` memory.
- **`bat` Sanrio-style exception (scoped):** `project_spec_drift_decisions` memory K.
- **`man` / `dad` minimal-detail mitigation:** `project_spec_drift_decisions` memory L + `word-song-picture-pack.md` §Per-word brief #7 + #12.
