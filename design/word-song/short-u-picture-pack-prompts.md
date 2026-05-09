# Word Song — short-u picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready.
**Predecessor specs:** `design/word-song/short-u-pool-expansion.md` (this PR — defines the 11-word pool and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/short-o-picture-pack-prompts.md` (sibling MJ prompt sheet — this file mirrors its structure exactly), `design/word-song/picture-pack-iteration-plan.md` (workflow + drift table — inherited).

---

## 0. Scope — exactly 11 words (Q2 locked A: full tier visual cohesion)

This pack covers **all 11 short-u targets** so they are visually cohesive within the tier (single MJ session, same model / prompts / style across every chip Marian sees on a short-u session). Q1 LOCKED A 2026-05-09 (ship 11) and Q2 LOCKED A 2026-05-09 (re-trace `sun`/`cup`/`bus` alongside the 8 wholly-new generations) per Thomas — see [`short-u-pool-expansion.md`](./short-u-pool-expansion.md) §10 Q1 and §10 Q2.

**Wholly-new short-u targets (8 — no existing picture asset):**

> **`bug`, `nut`, `tub`, `bun`, `jug`, `rug`, `hut`, `gum`.**

**Re-traces of existing distractor pictures (3 — overwrite existing PR #157 SVG files for tier cohesion):**

> **`sun`, `cup`, `bus`.**

These three originally shipped as hand-authored short-a-pack SVGs (PR #157) when they were distractor-only entries. Now that they are short-u targets in the new tier, Thomas wants them re-generated in the same MJ session as the 8 wholly-new prompts so all 11 chips Marian taps on a short-u session share one stylization. The new prompts for `sun`, `cup`, `bus` are authored fresh in this short-u sheet's row format (§§ 2.9, 2.10, 2.11) — they reference the prior short-a-pack treatments at [`picture-pack-prompts.md`](./picture-pack-prompts.md) §§ 2.2 / 2.5 / 2.1 only as continuity signal (vocabulary cue, distinguishing features), not as binding copy. Pack cohesion within short-u takes precedence over backwards-cohesion with the prior short-a sheet.

**Total generations needed for this pack: 11** (or 10 if Phase 2 fallback drops `gum` per §2.8).
**Total SVG file changes after Phase 3: 8 new + 3 overwrites** (or 7 new + 3 overwrites under the `gum` fallback).

If Thomas opts to bundle this pack with future short-i or short-e generation in one MJ session ("50+ images one-time deal" per the dispatch brief), insert these eleven into the bundle. Cross-pack visual cohesion is the goal — same `--cref` / `--sref` to short-a `dog` pose-zero across all packs.

---

## 1. Style anchors — derived from existing pack

This section names what makes the existing short-a + short-o pictures look like one illustrator made them — copied byte-for-byte from `picture-pack-style-anchor.md` §2 + §3 so the eight short-u additions land as visual siblings, not visual rivals. **No deviation for this pack.** Marian must not be able to detect "the new vowel arrived" by visual style — that would corrupt the same-screen layout cohesion the short-u spec §7 deliberately preserves.

### 1.1 Style preamble — re-use byte-for-byte (load-bearing)

**Re-use this paragraph byte-for-byte across every generation in this pack.** This is the pack-cohesion seed.

> **Single subject, centered, square 1:1 composition.** A child-friendly illustrated [SUBJECT] in the style of **modern slice-of-life Korean manhwa / webtoon children's book illustration**. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). **Palette: warm pastels** — soft pinks, peaches, creams, warm browns, soft mauve, soft sage — **no saturated primary colors, no neon, no pure black**. Object-specific colors allowed (a bus is yellow or blue, a frying pan is grey, an apple is red) but always **desaturated and illustrated**, never photographic. Skin tones if any: warm cream (#F5DCC9). Hair if any: warm dark brown (#5C3F31), never pure black, never blonde. **Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop, no decorative elements behind the subject.** **Single subject only — no other figures, no text, no labels, no signage, no logos, no UI overlays, no watermarks.** **Friendly tone**, large-eyed where the subject has eyes, rounded forms, soft-natural proportions. **Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon illustration.** Read-on-first-look: a kind, simple, clearly identifiable [SUBJECT] that a 6-to-8-year-old would point at and name. Drawn for a children's vocabulary book, not for a clinical icon set, not for a marketing illustration, not for a stock photo.

### 1.2 Locked style attributes (inherited)

| Attribute          | Value                                                                                                                                                                                                            | Source            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Aspect ratio       | 1:1 square, 1024×1024 minimum, 1792×1792 max longest side                                                                                                                                                        | style-anchor §3.1 |
| Composition        | Subject fills 60-75% of frame, centered, ~12-20% margin all sides, slight three-quarter view for objects with depth                                                                                              | style-anchor §3.1 |
| Background         | Solid soft cream `#FFF6EE` flat — keyed transparent in Phase 3 via remove.bg                                                                                                                                     | style-anchor §3.2 |
| Drop shadow        | None on subject in v1 asset (Phase 3 may add CSS shadow on chip)                                                                                                                                                 | style-anchor §3.2 |
| Outer contour      | ~2-2.5 px stroke at 1024×1024, warm dark brown `#3E2818`, never pure black                                                                                                                                       | style-anchor §3.4 |
| Inner detail lines | ~1.5 px, used sparingly                                                                                                                                                                                          | style-anchor §3.4 |
| Line treatment     | Solid clean lines, closed contours, no double-stroke, no sketch-effect breaks                                                                                                                                    | style-anchor §3.4 |
| Shading            | Single soft cel-shadow companion per color zone, light direction upper-left                                                                                                                                      | style-anchor §3.5 |
| Palette tokens     | `#FFF6EE` cream / `#FFB7C5` rose / `#F0CDB8` peach / `#F5DCC9` skin / `#5C3F31` warm-brown / `#3E2818` deepest contour / `#C77A7A` mouth-soft-red / object-specific desaturated greys + soft greens + soft blues | style-anchor §3.3 |
| Anti-palette       | Saturated primary red, pure black, neon, photographic gradients, sepia, grayscale                                                                                                                                | style-anchor §3.3 |
| Subject framing    | Three-quarter view; objects: see per-row notes; people: N/A in this pack (no human subjects)                                                                                                                     | style-anchor §3.6 |
| Anthropomorphism   | None on objects (no smiling bug, no smiling jug); see §3.7 + §1.4 anti-list                                                                                                                                      | style-anchor §3.7 |

### 1.3 Pack-cohesion lever — `--cref` / `--sref` to short-a pose-zero

Per `picture-pack-iteration-plan.md` §1.1, the canonical pose-zero is short-a `dog`. This pack inherits that pose-zero — same as short-o §1.3.

Every generation appends:

```
--cref <short-a-dog-pose-zero-url> --cw 80 --sref <short-a-dog-pose-zero-url>
```

Use the SAME `dog` pose-zero URL Thomas captured during the short-a / short-o packs' Phase 2 sessions. Pack-wide style cohesion across the whole eventual 30+-picture corpus (22 short-a + 4 short-o-new + 4 probe + 8 short-u-new + 3 short-u-retraces of `sun`/`cup`/`bus` per Q2 locked A) is the goal.

If the dog pose-zero URL has been lost between sessions, re-derive it per `picture-pack-iteration-plan.md` §1 BEFORE running this pack. Do not run this pack standalone — that produces an 11-picture island that won't match the eventual cross-pack corpus.

### 1.4 Universal trailing parameters (append to every prompt in this pack)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face, smiling mop, smiling bowl, mop with face, bowl with face, steam with face, smiling bug, bug with human face, smiling jug, jug with face, smiling bun, bun with face, smiling tub, tub with face, smiling rug, rug with face, smiling hut, hut with face, smiling gum, gum with face, smiling nut, nut with face, weapon, gun, knife, blade
```

**Delta from short-o pack:** added `smiling bug, bug with human face, smiling jug, jug with face, smiling bun, bun with face, smiling tub, tub with face, smiling rug, rug with face, smiling hut, hut with face, smiling gum, gum with face, smiling nut, nut with face` to negate the per-subject anthropomorphism attractors specific to this pack. Also added `weapon, gun, knife, blade` defensively — `cut` was rejected from the pool partly because of weapon-imagery risk on its renderings; the negative list keeps the rejection enforced even if a generation drifts toward "knife slicing" or similar.

---

## 2. Per-word entries

The format per row mirrors the short-o pack:

```
WORD — vocabulary cue — distinctness check — full prompt — negatives — asset spec — notes
```

Each "full prompt" is paste-ready — the style preamble from §1.1 is inlined verbatim. Append the trailing parameters from §1.4 to every prompt.

---

### 2.1 `bug` — animal — `/ʌg/` rhyme family

- **Vocabulary cue:** A friendly insect — round/oval body, six visible legs, two antennae on top of the head, optional small wings or spots. The oval-body-with-legs-and-antennae silhouette carries "bug" recognition.
- **Distinctness check:**
  - **vs. `dog` (short-o target, animal-pack neighbour):** `bug` is an **insect with six legs and antennae**; `dog` is a **four-legged mammal with floppy ears**. Different animal class entirely. **No risk** at 96pt.
  - **vs. `cat` (canonical short-a target, animal-pack neighbour):** Same insect-vs-mammal distinction. **No risk.**
  - **vs. `rat` (probe-word target, similar-mammal silhouette):** `bug` is **insect** (segmented body + 6 legs); `rat` is **mammal** (mammalian body + 4 legs + tail). Different category. **No risk.**
  - **vs. `fox` (short-o target):** Same insect-vs-mammal distinction. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **friendly cartoon insect bug, viewed in three-quarter top-down angle so the rounded oval body is fully visible from above with a slight side-lean, the body in soft warm-rose or soft warm-brown with optional small soft-cream spots or a single soft-stripe band, six visible legs (three on each side, simple curve shapes), TWO antennae on the top of the head curving slightly outward, two large round soft eyes, a small soft mouth as a tiny upward-curve line, NO wings (or if shown, very small folded wings — keep silhouette compact), NO scene around the bug, NO leaves, NO grass, NO web, NO other insects** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). Palette: warm pastels — soft pinks, peaches, creams, warm browns, soft mauve, soft sage. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, large-eyed, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bug is a CLEAR INSECT with an oval body, six legs, and two antennae — the antennae are the load-bearing recognition feature; without them the silhouette could read as a generic creature. Cute friendly insect, NOT scary, NOT spider-like, NOT realistic-bug-photography.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Spider (8 legs would make this read as "spider", not "bug").
  - Realistic photo-rendered insect with visible eye-faceting / chitin texture.
  - Beetle with hard wing-covers in saturated metallic shading (would push toward photographic).
  - Bug-on-a-leaf, bug-in-grass, bug-on-flower (strip all environment).
  - Cartoon-bug with human face (anthropomorphised — pure insect render).
  - Honeybee / wasp with sting visible (sting reads as menacing for an 8yo).
  - Saturated primary-yellow + black stripes (reads as "warning" — keep palette warm-pastel).
  - Multiple bugs, swarm, line of ants.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bug.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~50–100 KB** (PNG-in-SVG embed; per `.claude/docs/skill-trees-and-content.md` §"Path 2").
- **Notes:** No existing silhouette in `wordPictures.tsx` to reference (this is a wholly-new word). The recognition cue at 96pt comes from the antennae + leg pattern — the body shape alone is just a generic round-blob. Keep antennae prominent enough to survive PNG compression at chip size. The "friendly insect" tone matches the short-a `bat` Sanrio-style-friendly precedent (per `project_spec_drift_decisions` K) — same rationale: bugs are scary to some kids; this one is kind.

---

### 2.2 `nut` — food — `/ʌt/` rhyme family

- **Vocabulary cue:** A single nut — almond, peanut, or walnut — viewed in three-quarter so the seam line down the middle (or the wrinkled walnut surface) is clearly visible. The seam-line-on-oval-warm-brown silhouette carries "nut" recognition.
- **Distinctness check:**
  - **vs. `bun` (pack neighbour, food category):** `nut` is **small + smooth or wrinkled + seam-line down middle**; `bun` is **round bread roll + soft top + visible seam across top**. Different shapes (oval-with-seam vs. round-with-cap). Both food, but at 96pt the seam-direction (vertical for nut, horizontal for bun) carries the disambiguation. **Low risk.**
  - **vs. `jam` (canonical short-a target, food category):** `jam` is **glass jar with red contents and lid**; `nut` is **bare oval nut, no container**. Different forms entirely. **No risk.**
  - **vs. `egg` (would be future short-e target):** Both oval and food. Cross-vowel constraint keeps them apart in trios. Cross-pack visual hygiene if egg ever ships: nut has a SEAM LINE, egg does not. Defer the discriminator until `egg` ships.
  - **No FORBIDDEN_PAIR entry needed for v1.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single shelled nut, three-quarter view, oval shape with a gentle TWO-LOBED bumpy contour (like an almond or peanut shell with two visible halves joined down the middle), warm desaturated brown shell color (#A07752 family) with a slightly darker contour and a very gentle warm-cream highlight on the upper-left from cel-shading, a clear visible CENTER SEAM LINE running vertically down the middle from top to bottom showing where the two halves of the shell meet, optional very subtle wrinkles or texture on the surface but mostly smooth, NO leaves, NO branch, NO bowl, NO other nuts, just a single nut on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated warm-brown body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The nut is a SINGLE OVAL with a CLEAR VERTICAL SEAM LINE down the middle — the seam is the disambiguating feature; without it the silhouette reads as a generic oval or potato. NO smiling face on the nut, NO eyes, NO cracked-open shell showing the kernel — pure closed-shell render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Cracked-open shell with kernel visible (reads as "broken" or "snack" rather than "nut").
  - Pile of multiple nuts, mixed nuts in a bowl.
  - Walnut with deep brain-folds rendered photorealistically (drift to photographic).
  - Acorn with cap and stem (reads as "acorn", not "nut").
  - Coconut (much larger, completely different shape).
  - Peanut-in-shell with cartoon eyes / arms / legs.
  - Saturated red or yellow nut shell.
  - Background table or counter surface.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-nut.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** Geometric simplicity (oval + seam) means the PNG compresses cleanly. The seam line is critical at 96pt — if MJ renders too subtle a seam in Phase 2 review, regenerate with the seam emphasised.

---

### 2.3 `tub` — household — `/ʌb/` rhyme family

- **Vocabulary cue:** A free-standing footed bathtub viewed in three-quarter, optional bubble-bath dome of foam on top. The four small feet + free-standing + open-top silhouette carries "tub" recognition vs. cup/jug/pot.
- **Distinctness check (load-bearing):**
  - **vs. `cup` (pack neighbour, vessel category):** `tub` is **large + free-standing on small feet + NO handle + open-top wide oval**; `cup` is **small + on a flat base + handled + smaller open-top circle**. **Two discriminators must BOTH land:** (1) feet vs. flat base; (2) no handle vs. handle. **CONDITIONAL FORBIDDEN_PAIR entry `[tub, cup]` per pool spec §3 + §10 Q3** — pending Phase 2 visual review confirms the silhouette discriminators hold at 96pt. The risk is real because PNG-embed compression can blur the small-detail features (feet, handle).
  - **vs. `jug` (pack neighbour, vessel category):** `jug` is **mid-size + handled + spouted + smaller proportions**; `tub` is **large + footed + no handle + no spout + open-top**. Different shapes. **Low risk** at 96pt.
  - **vs. `pot` (short-o target):** `pot` is **deep cylinder + two side handles + no feet + on-stove proportions**; `tub` is **large oval + small feet + no handles + free-standing**. Cross-vowel rule keeps them apart in trios. **Low risk.**
  - **vs. `pan` (canonical short-a target, kitchen):** `pan` is **shallow disc + horizontal handle**; `tub` is **deep oval + four small vertical feet**. Different shapes. **Low risk.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **free-standing claw-foot or pedestal-foot bathtub, viewed in three-quarter perspective so the front face and one side face are both visible, the tub is a wide deep oval-rectangle vessel in soft warm-cream or soft soft-rose ceramic color with a slightly darker rim and a soft cel-shadow on the right side, FOUR small simple curved feet visible at the bottom (NOT detailed claw-feet, just simple rounded supports), the open-top of the tub clearly visible from the three-quarter angle showing the inner basin in a slightly darker shade, optional simple small dome of soft white bubble-bath foam rising from the open top, NO faucet visible, NO water visible inside (or only very abstract bubbles), NO bathroom tiles, NO walls, NO floor, just the tub on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The tub is a FREE-STANDING DEEP OVAL VESSEL on FOUR SIMPLE FEET with NO HANDLE — these together carry "tub" recognition. The foot-supported-large-vessel-no-handle silhouette must distinguish it cleanly from a cup (which has a handle and sits flat) and from a pot (which has side handles and sits flat). NO smiling face on the tub, NO eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Flat-base tub (no feet) — collapses the discriminator from `cup`.
  - Tub with a handle — collapses the discriminator from `cup`.
  - Tub with side handles — collapses the discriminator from `pot`.
  - Modern rectangular built-in tub with tiles (reads as "bathroom", needs the environment).
  - Photorealistic ceramic with detailed grout / wear-and-tear.
  - Tub with rubber-duck inside (introduces second subject).
  - Saturated primary blue (water-association — keep palette warm-pastel).
  - Bubble-bath foam taking over the silhouette (foam is optional accent, not the load-bearing feature).
  - Anthropomorphised tub (smiling face on the side).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-tub.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **Phase 2 review at chip size is mandatory for the `tub ↔ cup` discrimination** per pool spec §10 Q3. If the feet collapse to a single grey blur at 96pt, regenerate with larger more-distinct feet. The free-standing claw-foot tub style carries the disambiguation better than a pedestal-foot or rectangular built-in shape.

---

### 2.4 `bun` — food — `/ʌn/` rhyme family

- **Vocabulary cue:** A single round bread roll, viewed three-quarter from above, with a visible seam line across the top (often a "+"-shaped score mark from baking) and a soft warm-brown crust. The round-with-cross-seam silhouette carries "bun" recognition.
- **Distinctness check:**
  - **vs. `nut` (pack neighbour, food category):** `bun` is **round + soft-bread-crust + horizontal-cross seam on top**; `nut` is **oval + smooth-shell + vertical seam down middle**. Both are food, but at 96pt the "horizontal cross on top of round" vs. "vertical line down middle of oval" is the disambiguation. **Low risk.**
  - **vs. `bag` (canonical short-a target):** `bag` is **soft tote with handle**; `bun` is **round bread without handle**. Different categories entirely. **No risk.**
  - **vs. `jam` (canonical short-a target):** `jam` is **glass jar with red contents**; `bun` is **bare bread roll**. Different forms. **No risk.**
  - **vs. `cup` (pack neighbour):** `cup` is **handled vessel**; `bun` is **bread, no handle, no opening**. Different categories. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single round soft bread bun, viewed three-quarter from slightly above so the rounded top with crust is clearly visible plus the side curve underneath, warm desaturated tan / warm-brown crust color with a soft cream-or-cream-pink underside lightly visible, a CLEAR HORIZONTAL CROSS-SHAPED SCORE MARK or simple LINE SEAM on the top of the bun showing the typical baker's slash or the dough-rising seam (the score-mark is the disambiguating feature), gentle cel-shading on the right side, optional small light-cream highlight on the upper-left where the soft top catches imaginary upper-left light, NO sesame seeds (visual noise at 96pt), NO sandwich filling visible, NO basket, NO plate, NO other buns, just a single bun on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-brown crust. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bun is a SINGLE ROUND BREAD ROLL with a CLEAR SEAM or SCORE MARK on top — the score is the load-bearing recognition cue (without it the silhouette reads as a generic round shape). NO smiling face on the bun, NO eyes — pure food render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Anthropomorphised bun (smiling face — known children's-book attractor for round-food).
  - Hamburger bun with patty visible (reads as "burger", not "bun").
  - Hot-dog bun (different shape — elongated, not round).
  - Cinnamon roll spiral (reads as "spiral pastry").
  - Pile of buns / basket of buns (multiple subjects).
  - Saturated yellow or dark-chocolate brown (palette stays warm-pastel).
  - Sesame seeds covering the top (visual noise that hurts chip-size readability).
  - Cut-open bun showing inside.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bun.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** Familiar to a Manila 8yo via pan de sal / McDo bun shape. The score-mark is the load-bearing detail at 96pt; a plain round dome reads as "ball" or "bowl" without it.

---

### 2.5 `jug` — vessel — `/ʌg/` rhyme family

- **Vocabulary cue:** A handled vessel with a prominent spout and a clearly larger body than `cup`, viewed three-quarter so handle, spout, and body curve are all visible. The handle-plus-spout-plus-belly silhouette carries "jug" recognition.
- **Distinctness check (load-bearing):**
  - **vs. `cup` (pack neighbour, vessel category):** `jug` is **larger + has a SPOUT + belly-curves outward**; `cup` is **smaller + NO spout + walls go straight up**. **Spout is the load-bearing discriminator.** Both have handles but jug's handle is larger and the spout is the categorical difference. **Low-to-moderate risk** at 96pt — needs a clear pour-spout in Phase 2.
  - **vs. `tub` (pack neighbour, vessel category):** `jug` is **handled + spouted + free-standing on flat base**; `tub` is **footed + no handle + no spout + larger**. Different shapes entirely. **Low risk.**
  - **vs. `pot` (short-o target):** `pot` is **two side-handles + no spout + lid implied + cooking-vessel proportions**; `jug` is **single handle + spout + pouring-vessel proportions**. Cross-vowel rule keeps them apart in trios. **Low risk.**
  - **vs. `pan` (canonical):** `pan` is **shallow + horizontal handle**; `jug` is **deep + curved handle + spout**. Different shapes. **Low risk.**
  - **No FORBIDDEN_PAIR entry needed in v1** (cup discriminator carried by spout).
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple stoneware or pottery jug, viewed in three-quarter perspective so the curved belly of the body is fully visible plus the curved handle on one side and the prominent pour-spout on the opposite side, the body color in soft warm-cream or soft warm-rose with a slightly darker contour, the handle is a single curved loop attached at top and bottom of the body in the same color as the body, the pour-spout is a clear small triangular or rounded peak rising from the rim opposite the handle (the spout is the disambiguating feature; it must be CLEARLY VISIBLE as a distinct shape rising above the rim line), the bottom of the jug rests on a simple flat base (NOT footed like a tub, NOT pedestaled), gentle cel-shading on the right side, NO contents visible inside, NO water-stream pouring out, NO labels, NO patterns on the jug, just a clean simple jug on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The jug is a HANDLED VESSEL with a CLEAR POUR-SPOUT — the spout is the load-bearing recognition cue distinguishing it from a cup (no spout) and a tub (no handle, footed). The handle-plus-spout-plus-belly-curve silhouette must read at 96pt. NO smiling face on the jug, NO eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - No spout (would render as "cup" or "vase").
  - Glass-pitcher transparent rendering (loses the warm-pastel palette and adds rendering complexity).
  - Water pouring out the spout (introduces second visual element + dynamic motion).
  - Anthropomorphised jug with face on the body.
  - Decorative patterns / floral motifs on the jug body (visual noise at 96pt).
  - Modern thin-handle pitcher with sharp angles (palette mismatch with the soft-pottery look).
  - Saturated blue or green ceramic (warm-pastel only).
  - Two-handled vessel (reads as "trophy" or "pot", not jug).
  - Lid on the jug (reads as "teapot" with lid).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-jug.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **The pour-spout is the load-bearing distinguisher of this whole pack**'s vessel sub-set (jug/cup/tub). If Phase 2 review shows the spout collapses to a small bump that reads as "rim" at 96pt, regenerate with the spout exaggerated — better to err toward "obviously spouty" than risk reading as cup. Generate `jug` AFTER `cup` is locked (in cup's case, the existing PR #157 cup asset is the reference) so the pair can be A/B-reviewed.

---

### 2.6 `rug` — household — `/ʌg/` rhyme family

- **Vocabulary cue:** A rectangular floor covering with visible fringe at both short ends and a simple geometric pattern on the surface (stripes or diamonds). The fringed-rectangle-with-pattern silhouette carries "rug" recognition vs. mat.
- **Distinctness check (load-bearing):**
  - **vs. `mat` (canonical short-a target, FORBIDDEN_PAIR partner per pool spec §3 + §5):** Both rectangular floor coverings. **Discriminators on the picture side:** (1) `rug` has **VISIBLE FRINGE** at both short ends (small hanging tassels); `mat` has plain hemmed edges. (2) `rug` has a **simple pattern** (stripes or diamonds); `mat` is plain or has a single border. **Both discriminators must be visible at 96pt.** Cross-vowel rule keeps them apart in trios under same-vowel-only, but cross-pack visual hygiene matters. **NEW FORBIDDEN_PAIR `[rug, mat]` added in pool spec §3 / §5.**
  - **vs. `bag` (canonical):** `rug` is **flat rectangle on floor**; `bag` is **soft tote with handle**. Different categories. **No risk.**
  - **vs. `tag` (canonical):** Both flat-rectangular paper-or-fabric, but `tag` has a **string loop** at one corner; `rug` has fringe at both ends. Cross-vowel rule keeps them apart. Different shapes (tag is small paper-card, rug is large floor-covering). **Low risk.**
  - **vs. `map` (probe-word target, similar flat-paper):** Cross-vowel + map has visible landmasses; rug has geometric pattern + fringe. Cross-pack visual hygiene: the fringe is the load-bearing feature. **Low risk** with same-vowel constraint.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple floor rug, viewed in three-quarter perspective from above so the rectangular shape and the surface pattern are both visible plus a slight depth-cue making it clear the rug lies flat (NOT hung on a wall), the rug body in warm desaturated colors — a soft warm-rose, peach, or sage base — with a SIMPLE GEOMETRIC PATTERN such as three or four wide horizontal stripes in alternating warm tones, OR a simple diamond / chevron pattern, OR a soft bordered frame within the rectangle, the pattern is clear but soft (NOT busy), VISIBLE FRINGE on the two short ends of the rug rendered as small hanging tassels in soft cream or soft warm-cream (the fringe is the disambiguating feature), gentle cel-shading on the right side suggesting the rug lies flat with a slight perspective fold, NO furniture, NO room, NO pet on the rug, NO floor tiles around the rug, just a single rug on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The rug is a FLAT RECTANGLE with VISIBLE FRINGE on the short ends and a SIMPLE GEOMETRIC PATTERN on the surface — fringe + pattern together carry "rug" recognition and distinguish it from a plain mat. NO complex Persian / oriental detailed motif (visual noise at 96pt) — keep the pattern simple. NO smiling face, no anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - No fringe at all (would collapse to "mat").
  - Detailed oriental / Persian rug pattern with intricate motifs (visual noise at 96pt; pattern stops reading as "pattern" and starts reading as "noise" or "carpet texture").
  - Rug folded or rolled up (reads as "rolled rug", different read).
  - Rug with cat/dog sitting on it (introduces second subject; this is the rug-with-pet attractor).
  - Wall-hanging tapestry (reads as wall-art, not rug).
  - Bath mat with rubber back visible (reads as "bath mat", not "rug" — keep it more like a living-room rug).
  - Saturated red or saturated blue rug (palette stays warm-pastel).
  - Yoga mat with a logo (reads as "yoga mat" — keep it traditional rug).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-rug.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **The fringe is the load-bearing distinguisher** vs. `mat`. Even though they're never trio'd together (cross-vowel + FORBIDDEN_PAIR), visual cohesion across the pack means at-a-glance discrimination matters. If Phase 2 generates a rug with no visible fringe, regenerate. Pattern simplicity is also load-bearing — busy patterns kill chip-size readability.

---

### 2.7 `hut` — object — `/ʌt/` rhyme family

- **Vocabulary cue:** A simple A-frame or square dwelling with a visible door and roof, no environment around it. The triangular-roof-on-square-walls-with-door silhouette carries "hut" recognition.
- **Distinctness check:**
  - **vs. `hat` (canonical short-a target, similar triangular silhouette):** `hut` is **dwelling-scale + has DOOR visible + walls + ground line implied**; `hat` is **wearable + has BRIM visible + crown + no door**. Different categories. **Door is the load-bearing discriminator.** At 96pt, the door visibility distinguishes hut from hat. **Cross-vowel + low risk** with same-vowel constraint, but cross-pack visual hygiene matters.
  - **vs. `bag` (canonical):** Different shapes. **No risk.**
  - **vs. `box` (short-o target):** Both rectangular volumes, but `box` is **closed cuboid + tape line**; `hut` is **walls + roof + door**. Cross-vowel rule keeps them apart. **Low risk.**
  - **No FORBIDDEN_PAIR entry needed in v1.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple small dwelling hut, viewed in three-quarter perspective so the front face with door and one side face are both visible, the hut has a square or slightly-trapezoidal main body in soft warm-cream or soft warm-peach wall color with a simple A-FRAME or PYRAMID ROOF on top in soft warm-brown thatched-or-tile texture (kept simple — a single solid roof tone, NOT detailed individual tiles or thatch-strands), a clear simple rectangular DOOR centered on the front face in a slightly darker warm-brown (the door is the disambiguating feature), optional ONE small simple square window on the side face (kept very small — door is the load-bearing detail, not the window), gentle cel-shading on the right side, NO chimney with smoke, NO trees, NO grass, NO path, NO mountain backdrop, NO other huts, just a single small hut on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The hut is a SIMPLE DWELLING with a CLEAR ROOF and a CLEAR DOOR — the door is the recognition cue distinguishing it from a hat (no door) and a generic house. NO smiling face on the hut, NO eyes for windows, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Detailed thatch-strand roof (visual noise at 96pt — keep roof solid-tone).
  - Multi-story building (reads as "house", not "hut").
  - Hut with flag, banner, or signage (introduces text/decorations).
  - Hut in a scene with palm trees, mountain, beach (strip all environment).
  - Cottagecore Hobbit-hole rendering with rounded door (cute but the rounded-door reads as fairytale, not generic-hut).
  - Smoke from a chimney (introduces secondary visual element).
  - Saturated red roof (palette stays warm-pastel).
  - Hut-with-face windows-as-eyes (anthropomorphism).
  - Indigenous-cultural-specific hut style (avoid culturally-specific imagery; keep it generic-archetype).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-hut.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** Generic-archetype hut, not culturally-specific. The door is the load-bearing detail at 96pt. If Phase 2 generates a hut without a clearly-visible door, regenerate with the door enlarged. Don't drift toward "house" — keep it small + simple + single-room implied.

---

### 2.8 `gum` — food — `/ʌm/` rhyme family

> **Conditional on Q1 in pool spec §10.** If Thomas drops `gum` from the 11-word pool, this row drops. Default recommendation in pool spec is keep.

- **Vocabulary cue:** A single piece of chewing gum — wrapped flat-rectangular stick or cube package, OR a half-unwrapped stick showing the gum inside. The wrapped-rectangular-package-with-foil-or-paper silhouette carries "gum" recognition.
- **Distinctness check:**
  - **vs. `bun` (pack neighbour, food category):** `gum` is **flat rectangular wrapped package**; `bun` is **round soft bread roll**. Different shapes entirely. **No risk.**
  - **vs. `nut` (pack neighbour, food category):** `gum` is **rectangular package**; `nut` is **oval shell with seam**. Different shapes. **No risk.**
  - **vs. `bag` (canonical short-a target):** `gum` is **small flat package**; `bag` is **soft tote with handle**. Different sizes and categories. **No risk.**
  - **vs. `tag` (canonical short-a target):** Both are small flat-paper objects. `tag` has a **string loop**; `gum` is a **closed wrapped package, no string**. Cross-vowel + low risk.
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single piece of wrapped chewing gum, viewed three-quarter so the rectangular package shape is fully visible, the wrapper in soft warm-pink, soft mint-green, or soft warm-cream color with a simple horizontal seam line where the wrapper folds (NO brand name, NO printed text, NO logo), the wrapper is folded crisply with visible edges showing the rectangular package volume, OPTIONALLY one end of the wrapper is partially open showing a single light-cream gum-stick peeking out (this end-open detail is optional — closed-package version also works), the package proportions are approximately 3:1 length-to-width (clearly elongated, not square), gentle cel-shading on the right side, NO multiple gum sticks, NO bubble being blown, NO mouth, NO other candy, NO sweet wrappers around it, just a single piece of gum on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The gum is a SINGLE WRAPPED RECTANGULAR PACKAGE with optional half-unwrap — the wrapped-package silhouette carries "gum" recognition. NO printed brand name, NO smiling face, NO eyes — pure food-package render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Brand names, logos, printed text on the wrapper (anti-branding rule from style anchor).
  - Bubble-gum bubble being blown (introduces second visual element + face implied).
  - Mouth chewing gum (introduces face / human element).
  - Multiple gum sticks / pack of gum showing many sticks (single subject only).
  - Gumball (reads as "ball", not "gum stick").
  - Gum in a blister-pack with metallic foil (rendering complexity).
  - Chewed-up gum lump on the ground (gross + unstable read).
  - Saturated primary pink or green wrapper (palette stays warm-pastel).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-gum.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** **Q1 LOCKED A — `gum` ships in v1.** The mass-noun risk is the picture-side concern: a wrapped-package render gives us a stable noun-form (_a piece of gum_) the way `jam` got from jam-in-a-jar. If Phase 2 review shows the package-shape reads as "candy bar" or "stick of butter" rather than "gum", regenerate with the half-unwrap detail to anchor the read. If multiple iterations fail to land, the documented Phase 2 fallback is to drop the word from the pool (10-word fallback per [`short-u-pool-expansion.md`](./short-u-pool-expansion.md) §10 Q1).

---

### 2.9 `sun` — celestial — `/ʌn/` rhyme family — RE-TRACE (Q2 locked A)

> **Re-trace of an existing distractor picture.** The current `public/assets/pictures/picture-sun.svg` is a hand-authored SVG from PR #157. This row authors a fresh prompt in the short-u sheet style so the new MJ generation overwrites the existing file via `yarn embed-pictures` for tier visual cohesion. Prior short-a-pack treatment at [`picture-pack-prompts.md`](./picture-pack-prompts.md) §2.2 is reference-only; this prompt is the binding copy.

- **Vocabulary cue:** A round disc with simple radiating triangular rays, soft warm yellow with a slight rose tint. The radiating-rays-around-a-disc silhouette carries "sun" recognition.
- **Distinctness check:**
  - **vs. `bun` (pack neighbour, food):** `sun` has **radiating rays** outside the disc; `bun` is a **closed round shape with a horizontal score-mark on top**. Different silhouettes. **No risk.**
  - **vs. `nut` (pack neighbour, food):** `sun` is **round with rays**; `nut` is **oval with vertical seam**. **No risk.**
  - **vs. `bug` (pack neighbour, animal):** `sun` is **non-living disc with rays**; `bug` is **insect with legs and antennae**. **No risk.**
  - **vs. cream background:** the sun must contrast cleanly against the soft cream `#FFF6EE` background. Push the disc + rays toward warm-yellow (`#F4D89B`) with a slight rose tint at the rim so it doesn't disappear into the cream when transparent-keyed.
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple sun, viewed front-on, a round disc center with simple radiating triangular rays (8-12 rays evenly distributed around the disc, each ray a clean triangular shape pointing outward), the disc body in a soft warm yellow (#F4D89B family) with a gentle rose-tinted edge from cel-shading where the disc meets the rays, the rays in the same warm yellow as the disc with the same gentle cel-shading, a soft warm-cream highlight on the upper-left where imaginary upper-left light catches the disc, NO face on the sun, NO eyes, NO mouth, NO smile — pure abstract sun shape with friendliness conveyed via warmth and rounded ray-tips alone, NO clouds, NO sky, NO horizon, NO sun-rays-of-light effect, just a clean simple sun shape on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-yellow disc and rose-tinted edge. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. **The sun must contrast cleanly against the cream background — push the disc warmth to a warm-yellow that reads against cream.** Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The sun is a SIMPLE DISC WITH 8-12 RADIATING TRIANGULAR RAYS — the rays are the load-bearing recognition cue. NO smiling face on the sun, NO eyes — pure shape, no anthropomorphism. Same rule as the rest of the pack: friendliness comes from warmth + roundness, not from faces.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Smiling face on the sun (anthropomorphism — known children's-book attractor for sun).
  - Sun with eyes / eyebrows / mouth / blush.
  - Sun behind clouds (introduces second visual element).
  - Sunset with horizon line (reads as "sky" or "scene", not "sun" object).
  - Sunburst with photographic light-rays / lens flare (rendering complexity + anti-photographic rule).
  - Saturated primary yellow + saturated red tips (palette stays warm-pastel).
  - Sun-as-character with arms and legs.
  - Sun-with-sunglasses.
  - Multiple suns / double-sun composition.
  - Crescent / partial sun (reads as "moon").
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-sun.svg` via `yarn embed-pictures` — **OVERWRITES** the existing PR #157 file.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~40–80 KB** (geometric simplicity compresses cleanly).
- **Notes:** The cream-on-cream contrast risk is the load-bearing concern for this re-trace. The sun-disc must be warm-yellow enough to read against `#FFF6EE` cream once the background is keyed transparent. If Phase 2 Midjourney drifts toward pale-cream sun, regenerate with the disc warmth pushed. The no-face rule is locked across the whole pack (per §1.1 + §1.4 + the prior short-a-pack `sun` treatment) — friendly shape, no anthropomorphism.

---

### 2.10 `cup` — vessel — `/ʌp/` rhyme family — RE-TRACE (Q2 locked A)

> **Re-trace of an existing distractor picture.** The current `public/assets/pictures/picture-cup.svg` is a hand-authored SVG from PR #157. This row authors a fresh prompt in the short-u sheet style so the new MJ generation overwrites the existing file via `yarn embed-pictures`. Prior short-a-pack treatment at [`picture-pack-prompts.md`](./picture-pack-prompts.md) §2.5 is reference-only; this prompt is the binding copy. **Pair-review against `tub` at 96pt is mandatory** — Q3 LOCKED FORBIDDEN_PAIR `[tub, cup]` per pool spec §10 Q3.

- **Vocabulary cue:** A simple mug or teacup with a single curved handle, viewed three-quarter so the open-top + body + handle are all visible. The handle-plus-open-top-on-flat-base silhouette carries "cup" recognition vs. tub/jug.
- **Distinctness check (load-bearing):**
  - **vs. `tub` (pack neighbour, vessel, FORBIDDEN_PAIR):** `cup` is **small + handled + flat base + smaller open-top**; `tub` is **large + footed + NO handle + larger open-top**. **Two discriminators must BOTH land:** (1) flat base vs. four small feet; (2) handle vs. no handle. **Both discriminators must be visible at 96pt — pair-review at chip size with `tub` is mandatory** (Q3 LOCKED FORBIDDEN_PAIR `[tub, cup]`).
  - **vs. `jug` (pack neighbour, vessel):** `cup` is **smaller + NO spout + walls go straight up**; `jug` is **larger + has a SPOUT + belly-curves outward**. The spout on jug is the load-bearing discriminator on the jug side. On the cup side, keep the cup walls clean-vertical / no spout / smaller in proportion. **Low-to-moderate risk** at 96pt.
  - **vs. `can` (canonical short-a target — same shape class):** `cup` has **handle + open top**; `can` has **flat ring-pull top + NO handle**. Cross-vowel rule keeps them apart in trios. Low risk with same-vowel constraint.
  - **vs. `pot` (short-o target):** `cup` is **single curved handle + smaller**; `pot` is **two side handles + deeper cylinder**. Cross-vowel rule keeps them apart. Low risk.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple mug or teacup, viewed in three-quarter perspective so the curved body and the open-top oval and the curved handle are all visible, the body is a simple cylinder shape with walls that go essentially straight up (NOT bellied-outward like a jug, NOT spouted), a single curved handle attached to the right side of the body (top and bottom of the handle attach to the body — a clean simple loop), the open-top of the cup clearly visible as a darker-shaded oval at the rim showing the inside of the cup is empty (no contents, no steam, no liquid), the cup sits on a FLAT BASE (NOT footed like a tub — this is the load-bearing discriminator vs. tub), soft warm-cream or soft warm-rose body color with a slightly darker contour and a soft cel-shadow on the right side, the cup is small in proportion (clearly smaller than a tub or jug — chip-sized vessel for one drink), NO printed pattern on the cup body, NO logo, NO text, NO floral motif, just a clean simple cup or mug shape on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The cup is a SMALL HANDLED VESSEL with an OPEN TOP and a FLAT BASE — handle + flat-base together carry "cup" recognition and distinguish it from a tub (footed + no handle) and a jug (spouted + larger). The walls go essentially straight up — NO outward belly-curve, NO pour-spout. NO smiling face on the cup, NO eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Footed cup (collapses the discriminator from `tub`).
  - Cup with a spout (collapses the discriminator from `jug` — and reads as a jug or pitcher).
  - Steam rising from the cup (introduces second visual element).
  - Liquid inside the cup (introduces second visual element).
  - Saucer under the cup (introduces second subject).
  - Two-handled cup (reads as "trophy" or generic vessel).
  - Lid on the cup (reads as "travel mug").
  - Tea bag string hanging out (introduces second visual element + brand-association).
  - Decorative pattern / floral motif on the body (visual noise at 96pt).
  - Anthropomorphised cup with a face on the body.
  - Saturated primary red or saturated yellow (palette stays warm-pastel).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-cup.svg` via `yarn embed-pictures` — **OVERWRITES** the existing PR #157 file.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** **Phase 2 review at chip size paired with `tub` is mandatory** per pool spec §10 Q3. Generate `cup` AFTER `tub` so the pair can be A/B-reviewed at 96pt to confirm the flat-base vs. footed + handle vs. no-handle discriminators both hold. If at 96pt the `tub`/`cup` discrimination collapses (e.g. because `tub`'s feet read as a single grey blur or because `cup`'s handle compresses to a side-bump), regenerate the weaker side with the load-bearing feature exaggerated. The `[tub, cup]` FORBIDDEN_PAIR is locked in `wordPack.ts` regardless of how cleanly the discriminators land — see §3 of pool spec.

---

### 2.11 `bus` — vehicle — `/ʌs/` rhyme family — RE-TRACE (Q2 locked A)

> **Re-trace of an existing distractor picture.** The current `public/assets/pictures/picture-bus.svg` is a hand-authored SVG from PR #157. This row authors a fresh prompt in the short-u sheet style so the new MJ generation overwrites the existing file via `yarn embed-pictures`. Prior short-a-pack treatment at [`picture-pack-prompts.md`](./picture-pack-prompts.md) §2.1 is reference-only; this prompt is the binding copy.

- **Vocabulary cue:** A long vehicle viewed three-quarter front-side, with multiple windows along the side, a distinctive bus-front (two headlights, a destination panel area but no text), and at least two visible wheels. The length-plus-multi-window-count silhouette carries "bus" recognition vs. van.
- **Distinctness check:**
  - **vs. `van` (canonical short-a target — `[bus, van]` is an existing FORBIDDEN_PAIR):** `bus` is **longer + has 3+ windows along the side + distinctive bus-front (two headlights, large windshield)**; `van` is **shorter + has 2 windows + smaller more rounded car-like front**. The length + window-count are the load-bearing discriminators. Same-vowel-only rule keeps them apart in trios + the existing `[bus, van]` FORBIDDEN_PAIR is the cross-pack guard. **Low risk** with same-vowel constraint, but cross-pack visual hygiene matters.
  - **vs. `pan` (canonical short-a target):** Different categories entirely (vehicle vs. cookware). **No risk.**
  - **vs. `cup` (pack neighbour):** Different categories. **No risk.**
  - **No NEW FORBIDDEN_PAIR entry needed** (existing `[bus, van]` already covers the cross-pack guard).
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple school bus or city bus, viewed in three-quarter front-side perspective so both the front face and one side face are visible, the vehicle is LONG (long enough that at least 3 side windows are visible — this is the load-bearing length discriminator vs. a van which has only 2 windows), a distinctive flat or gently-rounded BUS FRONT with two simple round front headlights and a large simple front windshield (NO driver figure visible inside, NO interior detail, the windshield reads as a clean dark-tinted shape), at least 2 visible wheels (one front and one back showing through the three-quarter angle), the body color in soft desaturated warm-cream-yellow (#F4D89B family — a school-bus yellow but desaturated to stay in the warm-pastel palette) with a slightly darker contour and a soft cel-shadow on the right side, simple wheel-fender curves visible above each wheel, NO logos, NO printed text, NO route number, NO destination text on the front panel, NO advertising panels on the side, NO bus stop, NO road, NO trees, NO scene around the bus, just a clean simple bus shape on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated warm-cream-yellow body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bus is a LONG VEHICLE with 3+ SIDE WINDOWS and a DISTINCTIVE BUS FRONT — these together carry "bus" recognition and distinguish it from a van (shorter, 2 windows, car-like front). The desaturated warm-cream-yellow body keeps the palette family — pure school-bus yellow is too saturated. NO smiling face on the bus, NO anthropomorphisation, NO eyes for headlights, NO mouth for grille — pure vehicle render (per the pack-wide "no anthropomorphised vehicle" negation).** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Anthropomorphised bus with eyes-for-headlights and mouth-for-grille (known children's-book attractor — pure vehicle only).
  - Short bus (collapses the length discriminator from `van`).
  - Only 2 windows visible (collapses the window-count discriminator from `van`).
  - Bus stop / road / sidewalk in frame (introduces scene).
  - Trees, sky, mountains, buildings (strip all environment).
  - Driver visible through windshield (introduces second subject).
  - Children visible inside the bus through windows (introduces second subjects).
  - Logos / text / route numbers / destination text on the front panel (anti-text rule).
  - Saturated primary yellow + saturated black trim (palette stays warm-pastel).
  - Double-decker bus (reads as "double-decker", not generic bus).
  - 3D photo-realistic render with chrome and reflections.
  - Smoke from exhaust pipe.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bus.svg` via `yarn embed-pictures` — **OVERWRITES** the existing PR #157 file.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** Pair-review against the existing `picture-van.svg` from PR #157 at 96pt — even though `[bus, van]` are already a FORBIDDEN_PAIR (so they never trio together) and same-vowel-only rule keeps them apart in trios anyway, the cross-pack visual hygiene matters because Marian sees both pictures across her sessions. The length + window-count discriminators must hold. If MJ drifts toward a stubbier-front van-shape, regenerate with the bus length emphasised.

---

## 3. Quick reference — pack index

| #   | Word | Type                                                | Pack neighbour requiring discrimination                                      | Picture-side discriminator                                      |
| --- | ---- | --------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | bug  | new short-u target                                  | `cat`/`rat`/`fox`/`dog` (all animals)                                        | insect (6 legs + antennae) vs. mammal (4 legs)                  |
| 2   | nut  | new short-u target                                  | `bun` (pack-neighbour food)                                                  | oval + vertical seam vs. round + horizontal score               |
| 3   | tub  | new short-u target                                  | **`cup` (pool spec §10 Q3 — FORBIDDEN_PAIR LOCKED)**, `pot` (cross-vowel)    | feet + no handle + larger vs. handle + flat base + smaller      |
| 4   | bun  | new short-u target                                  | `nut` (pack-neighbour food)                                                  | round + horizontal score vs. oval + vertical seam               |
| 5   | jug  | new short-u target                                  | `cup` (pack-neighbour vessel)                                                | spout (load-bearing) + larger body vs. no spout + smaller       |
| 6   | rug  | new short-u target                                  | **`mat` (cross-vowel — FORBIDDEN_PAIR added)**                               | fringe + pattern vs. plain hemmed edges                         |
| 7   | hut  | new short-u target                                  | `hat` (cross-vowel — similar triangular silhouette)                          | door + walls (dwelling-scale) vs. brim + crown (wearable-scale) |
| 8   | gum  | new short-u target (Q1 locked A — Phase 2 fallback) | none in-pack; `tag` (cross-vowel — both small flat objects)                  | wrapped package (no string) vs. paper-card with string-loop     |
| 9   | sun  | re-trace short-u target (Q2 locked A)               | cream background (low-contrast risk); `bun` (pack neighbour, both round)     | radiating rays around disc vs. closed round shape with score    |
| 10  | cup  | re-trace short-u target (Q2 locked A)               | **`tub` (pool spec §10 Q3 — FORBIDDEN_PAIR LOCKED)**, `jug` (pack neighbour) | handle + flat base + smaller vs. footed + no handle + larger    |
| 11  | bus  | re-trace short-u target (Q2 locked A)               | `van` (cross-vowel — existing FORBIDDEN_PAIR `[bus, van]` already in pack)   | length + 3+ windows + bus-front vs. shorter + 2 windows         |

**Highest-distinctness-risk pair in this pack: `tub` ↔ `cup`.** Both are vessels. The footed-large-no-handle vs. handled-small-flat-base split is what makes them readable as different words at 96pt. Phase 2 review at chip size is mandatory for this pair before acceptance — see pool spec §10 Q3.

**Highest-cross-pack-distinctness-risk pair: `rug` ↔ `mat`.** Both flat-rectangular floor coverings. Same-vowel-only rule keeps them out of trios in v1 + a new FORBIDDEN_PAIR entry locks the constraint, but the picture-side fringe + pattern discriminator is still load-bearing.

**Cross-vowel cosmetic-similarity to watch:** `hut` ↔ `hat` (both triangular). Door is the door-vs-no-door discriminator and is load-bearing.

---

## 4. Generation order recommendation (Q2 locked A — reflects 11-prompt pack with retraces)

Per `picture-pack-iteration-plan.md` §3 — same surface-the-hardest-cases-early principle, plus a Q2-locked-A constraint: **the pair-review reference for `tub` and `jug` is the NEW `cup`, not the existing PR #157 `cup` asset** (which is being overwritten in this same MJ session per Q2 locked A). That changes the order — `cup` must be generated alongside `tub` and `jug` so the pair-review can happen against the new style, not against an asset that's about to be replaced.

**Rationale for retrace placement:** Thomas's Q2 LOCK A is "single MJ session, all 11 chips share one stylization." That means the retrace targets (`sun`, `cup`, `bus`) must enter the queue early enough to A/B-pair-review them against their pack neighbours — `cup` against `tub`/`jug` for the FORBIDDEN_PAIR + spout discriminator, `bus` against the existing `van` asset for the cross-pack length discriminator, `sun` last among the retraces because it's lowest risk (no in-pack pair-review concerns). The original 8-prompt order (tub/jug/rug/hut first, then bun/nut/gum, with bug somewhere in the middle) stays — what changes is `cup` slots in alongside `tub`+`jug` early, and `bus`+`sun` slot in late.

**Order:**

1. **`tub`** first — highest risk (silhouette discriminator vs. `cup` per Q3 LOCKED FORBIDDEN_PAIR). Generated as the first member of the load-bearing tub/cup/jug pair-review trio.
2. **`cup`** second (RETRACE — Q2 locked A) — generated immediately after `tub` so the new-style `tub`/`cup` pair can be A/B'd at 96pt. This is the load-bearing pair-review for the Q3 LOCKED FORBIDDEN_PAIR `[tub, cup]`. Pair-review against the existing PR #157 `cup` is no longer the right reference — Thomas's Q2 LOCK A overwrites that asset, so the new `cup` is the binding reference for `tub`'s discriminator gate.
3. **`jug`** third — second-highest risk (spout discriminator vs. `cup`). Pair-review against the new-style `cup` from step 2.
4. **`rug`** fourth — third-highest risk (fringe + pattern discriminator vs. `mat`). Pair-review against the existing PR #157 `mat` asset (cross-vowel — `mat` is short-a, NOT being retraced in this pack).
5. **`hut`** fifth — moderate risk (door discriminator vs. `hat`). Pair-review against the existing PR #157 `hat` asset (cross-vowel — `hat` is short-a, NOT being retraced in this pack).
6. **`bug`** sixth — animal-archetype, low-to-moderate risk. The antennae are load-bearing; verify they survive at 96pt.
7. **`bun`** seventh — geometric food, low risk; lock the score-mark feature.
8. **`nut`** eighth — geometric food, low risk; lock the seam-line feature.
9. **`bus`** ninth (RETRACE — Q2 locked A) — pair-review against the existing PR #157 `van` asset for the length + window-count discriminator (cross-vowel — `van` is short-a, NOT being retraced). The existing `[bus, van]` FORBIDDEN_PAIR + same-vowel-only rule mean trio collisions are already prevented; this is cross-pack visual hygiene.
10. **`sun`** tenth (RETRACE — Q2 locked A) — lowest-risk retrace; no pack neighbour requires pair-review. Watch the cream-on-cream contrast risk — push the disc warmth so the sun reads against the cream background once transparent-keyed.
11. **`gum`** last — borderline picture-stability; iterate if needed and don't block the pack on it. If Phase 2 fallback drops `gum` per pool spec §10 Q1, this row drops without affecting the other 10.

**If Thomas bundles this pack with future short-i + short-e generation in one MJ session** ("50+ images one-time deal" per the dispatch brief), the per-pack tier ordering still applies — within the short-u block, run tub/cup/jug/rug/hut first so pair-review at chip size can happen before drifting to other vowels. The retrace targets (`sun, cup, bus`) belong inside the short-u block, NOT scheduled into the future short-i / short-e blocks — they are short-u targets and the pack-cohesion guarantee Q2 LOCK A buys depends on them generating in the same model run as the other 8 short-u prompts.

---

## 5. Acceptance criteria for Phase 2 selection (Thomas-side)

Each generation in this pack must pass ALL of these gates before Thomas accepts and saves the source PNG. These mirror the short-o pack §5 plus per-row distinctness gates specific to this pack.

### 5.1 Style-cohesion gates (same as short-a + short-o packs)

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style preamble honored: line weight ~2 px at 1024×1024, palette warm-pastel, line color warm-dark-brown not pure black, background solid soft cream flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no signature, no logo, no UI overlay anywhere in the image.
- [ ] No anthropomorphism (`bug` is a friendly insect with simple eyes per the style spec, NOT a smiling cartoon-face anthropomorphised version; `tub`/`jug`/`bun`/`nut`/`rug`/`hut`/`gum`/`cup`/`bus` are pure objects with no faces; `sun` is a pure shape with no face — no eyes, no smile, no anthropomorphism on any retrace either).
- [ ] Visual cohesion with the locked short-a pose-zero (typically `dog`) — line weight, palette, shading style match.
- [ ] No weapons, blades, sharp objects (defensive — `cut` was rejected partly for weapon-imagery risk).

### 5.2 Per-word distinctness gates (load-bearing for this pack)

- [ ] **`bug`:** Six legs + two antennae clearly visible at 96pt; eyes drawn as soft circles not realistic; cannot be mistaken for a spider (8 legs) or a generic creature.
- [ ] **`nut`:** Vertical seam line down middle clearly visible at 96pt; cannot be mistaken for an egg or a potato.
- [ ] **`tub`:** Four small feet clearly visible at 96pt + NO handle + open-top oval visible. **At 96pt side-by-side with `cup`, the feet vs. flat-base + no-handle vs. handle discriminators are both readable.**
- [ ] **`bun`:** Round shape + horizontal score-mark / cross-pattern on top clearly visible at 96pt; cannot be mistaken for a generic ball or dome.
- [ ] **`jug`:** **POUR-SPOUT clearly visible** as a distinct shape rising above the rim line. Single curved handle on the opposite side. **At 96pt side-by-side with `cup`, the spout vs. no-spout discriminator is unmistakable.**
- [ ] **`rug`:** **VISIBLE FRINGE on both short ends** + simple geometric pattern on the surface. **At 96pt side-by-side with `mat`, the fringe-vs-plain-edge discriminator is readable.** Pattern simple, not busy.
- [ ] **`hut`:** **Clear DOOR on the front face** + roof + walls. **At 96pt side-by-side with `hat`, the door + walls vs. brim + crown discrimination is readable.** No environmental scene.
- [ ] **`gum`:** Wrapped rectangular package shape clearly visible (3:1 proportions); cannot be mistaken for a candy bar or a stick of butter. Optional half-unwrap detail shows gum content.
- [ ] **`sun` (RETRACE):** Round disc with 8-12 radiating triangular rays; warm-yellow disc reads cleanly against `#FFF6EE` cream background once transparent-keyed (no cream-on-cream collapse); NO face, NO eyes, NO smile.
- [ ] **`cup` (RETRACE):** Single curved handle visible + open-top oval visible + flat base (NOT footed). **At 96pt side-by-side with the new `tub` from this pack, the handle vs. no-handle and flat-base vs. footed discriminators both hold (Q3 LOCKED FORBIDDEN_PAIR `[tub, cup]`).** No spout. No steam, no contents.
- [ ] **`bus` (RETRACE):** Long vehicle silhouette with 3+ side windows + distinctive bus-front (two headlights + large windshield) + at least 2 visible wheels. **At 96pt side-by-side with the existing `picture-van.svg` from PR #157, the length + window-count discriminators are readable.** Desaturated warm-cream-yellow body, NOT saturated school-bus yellow. NO logos, NO destination text, NO anthropomorphisation.

### 5.3 "Regenerate" triggers

If any of the following appear, regenerate (do not proceed to embed):

- Anthropomorphised object (smiling face on tub/jug/rug/hut/bun/nut/gum/cup/bus, eyes on the side; sun-with-face).
- `bug` with 8 legs (spider) or no antennae (generic blob).
- `tub` with no feet (collapses cup-discrimination) or with a handle (collapses cup-discrimination).
- `jug` with no spout (collapses cup-discrimination).
- `rug` with no fringe (collapses mat-discrimination) OR with a busy oriental-pattern motif (visual noise).
- `hut` with no door (could read as "tent" or "rock") or with smoke / chimney / scene (introduces second elements).
- `bun` with sesame seeds + sandwich filling (reads as "burger") or no score-mark (generic round shape).
- `nut` cracked open showing kernel (reads as "broken" rather than "nut").
- `gum` with a brand name / logo on the wrapper, or in a blister pack, or being chewed.
- Photorealistic / 3D-rendered output (tighten `--style raw`).
- Saturated primary colors, neon, pure black, sepia.
- Text on any subject.
- Multiple subjects (e.g. multiple bugs, basket of buns, pile of nuts, rug-with-pet).
- Weapons / blades / sharp objects in the frame (defensive).
- `sun` that disappears against the cream background once transparent-keyed (push disc warmth toward warm-yellow).
- `cup` that's footed (collapses tub-discrimination) or has a spout (collapses jug-discrimination).
- `bus` that's too short (collapses van-discrimination) or has only 2 side windows (collapses van-discrimination) or has eyes-for-headlights (anthropomorphisation).

---

## 6. Out of scope

- **The 3 promoted-from-distractor short-u words** (`sun`, `cup`, `bus`) are **IN SCOPE** for this pack (Q2 LOCKED A 2026-05-09 by Thomas — see [`short-u-pool-expansion.md`](./short-u-pool-expansion.md) §10 Q2). They are authored as §§ 2.9, 2.10, 2.11 of this prompt sheet and overwrite the existing PR #157 SVG files via `yarn embed-pictures` in Phase 3. Pack-cohesion within the short-u tier is the rationale.
- **Short-i and short-e picture packs** — separate per-vowel packs when those tiers scope. Per `design/word-song/README.md` §Future work + the README skeleton.
- **Phase 2 generation itself** — this is a Phase 1 prompt sheet. Thomas runs MJ in Phase 2 (per `user_midjourney_web` — MJ Web UI workflow with prompt-box paste + drag-drop upload, not Discord slash-commands).
- **Phase 3 PNG-embed integration** — Devon owns this PR via `yarn embed-pictures` (per `.claude/docs/skill-trees-and-content.md` §"Tooling for path 2"). The script wraps each transparent PNG into the canonical `<svg><image href="data:image/png;base64,...">` format. No code changes in this prompt-sheet PR.
- **Code changes to `wordPack.ts`, `wordPictures.tsx`, or canon files** — Kevin's downstream impl ticket. The pool spec §9 ACs cover those.
- **Cross-vowel distractor mixing** — out of v1 per pool spec §8 + short-o §8. Tracked as ticket `86c9m3aek`.
- **Re-naming any existing `picture-{word}.svg` files** — out of scope (no renames needed for this pack; the 3 retraces overwrite at the same path; the 8 wholly-new files use the canonical `picture-{word}.svg` naming convention).
- **`gum` Phase 2 fallback** — entry §2.8 documents the regenerate-then-drop trigger if 96pt review can't land the wrapped-stick read. Q1 LOCKED A says ship 11; the 10-word fallback is a Phase 2 contingency, not a Phase 1 scope question.

---

## 7. Provenance

- **Triggering doc:** `design/word-song/short-u-pool-expansion.md` §3 ("Picture-pack requirements") — flagged the forward Kyle ticket; this pack is that ticket's deliverable.
- **Style preamble + universal parameters + locked attributes:** `design/word-song/picture-pack-style-anchor.md` §2 + §3.
- **Workflow + drift table + escalation ladder:** `design/word-song/picture-pack-iteration-plan.md` §3 + §5 + §6.
- **Per-row prompt structure inheritance:** `design/word-song/short-o-picture-pack-prompts.md` (sibling MJ prompt sheet) — this pack mirrors that file's row format.
- **Word-list lock:** `design/word-song/short-u-pool-expansion.md` §1 final pool of 11 short-u target words. The 8 wholly-new words covered here are `bug, nut, tub, bun, jug, rug, hut, gum`; the 3 retraces (Q2 LOCKED A) are `sun, cup, bus`.
- **Q1/Q2/Q3/Q4 lock:** pool spec §10 — Q1 LOCKED A 2026-05-09 (ship 11, including `gum`; Phase 2 fallback to 10 documented in §2.8); Q2 LOCKED A 2026-05-09 (re-trace `sun, cup, bus` alongside the 8 wholly-new generations — drives §§ 2.9–2.11 of this sheet); Q3 LOCKED A 2026-05-08 (`[tub, cup]` FORBIDDEN_PAIR added — drives §2.3 acceptance + §2.10 cup pair-review gate); Q4 LOCKED A 2026-05-08 (same-vowel-only distractor pool — drives matrix preview in pool spec §2).
- **Prior short-a-pack reference (continuity-only, NOT binding):** `design/word-song/picture-pack-prompts.md` §2.1 (`bus`), §2.2 (`sun`), §2.5 (`cup`) — the original treatments are reference-only signal for vocabulary cue and distinguishing features. The short-u sheet's §§ 2.9–2.11 are the binding prompts; pack cohesion within short-u takes precedence over backwards-cohesion with the prior short-a sheet.
- **Phase 3 path locked to Path 2 (PNG-embed):** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" + Thomas's "50+ images one-time deal" preference per the dispatch brief.
- **PWA cache budget:** `reference_pwa_asset_size_limits` memory — 4 MiB cache cap; ~50–150 KB per SVG fits comfortably for the cumulative picture-pack budget.
- **MJ Web UI workflow:** `user_midjourney_web` memory — Thomas operates MJ via Web UI (prompt-box + drag-drop upload), not Discord slash-commands. Prompt sheet copy is paste-ready for the Web UI's prompt input.
- **Locked memories:**
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — this pack uses PNG-in-SVG embed per the established Phase 3 path; the lock holds because the wrapper IS still SVG, the _content_ is the source PNG embedded as data URI).
  - `project_spec_drift_decisions` K (Sanrio-style friendly bat → applies forward to friendly bug here).
  - `project_planner_parser_contract` (no parser change here; picture-pack only).
