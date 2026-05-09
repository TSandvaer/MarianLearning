# Word Song — short-e picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready.
**Predecessor specs:** `design/word-song/short-e-pool-expansion.md` (this PR — defines the 9-word pool and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/short-u-picture-pack-prompts.md` (sibling MJ prompt sheet — this file mirrors its structure exactly), `design/word-song/short-o-picture-pack-prompts.md` (additional template reference), `design/word-song/picture-pack-iteration-plan.md` (workflow + drift table — inherited).

---

## 0. Scope — 8 wholly-new short-e words + 1 conditional re-trace

This pack covers **8 wholly-new short-e targets**:

> **`bed`, `leg`, `hen`, `web`, `net`, `jet`, `gem`, `egg`.**

Plus **1 conditional re-trace pending Q2 lock in pool spec §10**:

> **`pen`** — existing distractor picture from PR #157. Q2 = re-trace alongside the 8 new MJ generations (mirrors short-u Q2 lock A on `sun, cup, bus`) is the recommendation but not yet confirmed by Thomas. If Q2 = re-trace, total generations = 9. If Q2 = defer, total = 8 and the existing PR #157 `picture-pen.svg` is kept as-is for v1.

**Total generations needed for this pack: 8** (wholly-new only) **or 9** (with `pen` re-trace pending Q2).
**Total SVG file changes after Phase 3: 8 new + 0-1 overwrites** (or 7 new + 0-1 overwrites under the `egg` Phase-2 fallback per pool spec §10 Q1).

If Thomas opts to bundle this pack with future short-i generation in one MJ session ("50+ images one-time deal" per `user_midjourney_web` and prior dispatch briefs), insert these 8-9 into the bundle. Cross-pack visual cohesion is the goal — same `--cref` / `--sref` to short-a `dog` pose-zero across all packs.

---

## 1. Style anchors — derived from existing pack

Per `picture-pack-style-anchor.md` §2 + §3, copied byte-for-byte so the short-e additions land as visual siblings, not visual rivals. **No deviation for this pack.** Marian must not be able to detect "the new vowel arrived" by visual style — that would corrupt the same-screen layout cohesion the short-e spec §7 deliberately preserves (mirrors short-u §7).

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
| Anthropomorphism   | None on objects (no smiling bed, no smiling hen with eyebrows, no smiling jet); see §3.7 + §1.4 anti-list                                                                                                        | style-anchor §3.7 |

### 1.3 Pack-cohesion lever — `--cref` / `--sref` to short-a pose-zero

Per `picture-pack-iteration-plan.md` §1.1, the canonical pose-zero is short-a `dog`. This pack inherits that pose-zero — same as short-o §1.3 and short-u §1.3.

Every generation appends:

```
--cref <short-a-dog-pose-zero-url> --cw 80 --sref <short-a-dog-pose-zero-url>
```

Use the SAME `dog` pose-zero URL Thomas captured during the short-a / short-o / short-u packs' Phase 2 sessions. Pack-wide style cohesion across the whole eventual 40+-picture corpus is the goal.

If the dog pose-zero URL has been lost between sessions, re-derive it per `picture-pack-iteration-plan.md` §1 BEFORE running this pack. Do not run this pack standalone — that produces an 8-picture island that won't match the eventual cross-pack corpus.

### 1.4 Universal trailing parameters (append to every prompt in this pack)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face, smiling mop, smiling bowl, mop with face, bowl with face, steam with face, smiling bug, bug with human face, smiling jug, jug with face, smiling bun, bun with face, smiling tub, tub with face, smiling rug, rug with face, smiling hut, hut with face, smiling gum, gum with face, smiling nut, nut with face, smiling bed, bed with face, smiling hen, hen with cartoon eyebrows, smiling web, web with face, smiling net, net with face, smiling jet, jet with face, eyes for headlights, smile for grille, smiling gem, gem with face, smiling egg, egg with face, smiling pen, pen with face, weapon, gun, knife, blade, body fragment, severed limb
```

**Delta from short-u pack:** added `smiling bed, bed with face, smiling hen, hen with cartoon eyebrows, smiling web, web with face, smiling net, net with face, smiling jet, jet with face, eyes for headlights, smile for grille, smiling gem, gem with face, smiling egg, egg with face, smiling pen, pen with face` to negate the per-subject anthropomorphism attractors specific to this pack. Also added `body fragment, severed limb` defensively — `leg` is the body-part word in this pack and the body-leg framing carries a fragment-of-body imagery risk (per pool spec §10 Q3); even with chair-leg framing, a stray body-leg generation is a content concern. The negative list keeps the rejection enforced.

---

## 2. Per-word entries

The format per row mirrors the short-u + short-o packs:

```
WORD — vocabulary cue — distinctness check — full prompt — negatives — asset spec — notes
```

Each "full prompt" is paste-ready — the style preamble from §1.1 is inlined verbatim. Append the trailing parameters from §1.4 to every prompt.

---

### 2.1 `bed` — household — `/ɛd/` rhyme family

- **Vocabulary cue:** A simple bed — rectangular furniture with a single pillow at one end and an optional headboard. Three-quarter view so the bed-as-furniture-volume reads. The pillow + headboard + visible mattress silhouette carries "bed" recognition.
- **Distinctness check:**
  - **vs. `tub` (short-u target, household):** `bed` is **rectangular furniture-volume + pillow + headboard + on legs**; `tub` is **footed open vessel + open-top oval**. Different shapes. **No risk.**
  - **vs. `box` (short-o target):** `bed` is **furniture with pillow visible**; `box` is **closed cuboid + tape line**. Different fills. **Low risk.**
  - **vs. `bag` (canonical short-a):** Cross-category. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple single bed, viewed in three-quarter perspective so the front face and one side face are both visible, the bed is a rectangular volume with a clear visible MATTRESS surface in soft warm-cream fabric, ONE soft warm-rose or soft peach PILLOW resting at the head end of the bed (the pillow's softness and dome shape are visible), an optional simple HEADBOARD rising at the head end in soft warm-brown wood color (kept simple — solid panel, NOT carved or detailed), the bed sits on FOUR small simple legs visible at the corners, an optional folded soft blanket at the foot end in a slightly contrasting warm-pastel tone, gentle cel-shading on the right side, NO bedroom around the bed, NO walls, NO carpet on the floor, NO bedside table, NO lamp, NO person sleeping in the bed, just a clean simple bed on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-cream mattress and soft-rose-or-peach pillow. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bed is RECTANGULAR FURNITURE with a CLEAR PILLOW AT THE HEAD END and visible LEGS — pillow + legs together carry "bed" recognition. NO smiling face on the bed, NO eyes, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Bedroom scene with walls / lamp / nightstand (introduces second subjects + environment).
  - Person sleeping in bed (introduces second subject).
  - Detailed bed-frame with intricate carved patterns (visual noise).
  - Bunk bed (reads as "bunk bed", not generic bed).
  - Made bed with 4+ pillows / decorative shams (single pillow only).
  - Saturated primary red blanket / saturated yellow pillow (palette stays warm-pastel).
  - Crib (reads as "crib", not "bed").
  - Anthropomorphised bed with face on the headboard.
  - Hospital bed (reads as "hospital bed").
  - Air mattress / inflatable bed.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bed.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~50–100 KB** (PNG-in-SVG embed; per `.claude/docs/skill-trees-and-content.md` §"Path 2").
- **Notes:** Standard furniture rendering. The pillow is the load-bearing recognition feature — without it, the bed silhouette could read as "table" or "platform". Headboard adds context but is not load-bearing.

---

### 2.2 `leg` — anatomy / object — `/ɛg/` rhyme family

- **Vocabulary cue:** A SINGLE chair-leg or table-leg, viewed three-quarter so the leg-as-furniture-component reads with the leg-junction visible at the top of the picture. The chair-leg framing avoids body-fragmentation read risk per pool spec §10 Q3.
- **Distinctness check:**
  - **vs. `log` (short-o target — distractor-only):** Both elongated cylinders. `log` is **horizontal + bark texture + loose orientation**; `leg` is **vertical + smooth wood/metal + chair-leg context**. Different orientations + textures. **Low risk.**
  - **vs. `bed` (pack neighbour):** `bed` includes legs as part of the furniture; `leg` is a single isolated leg. Different scope. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single chair leg, viewed in three-quarter perspective so the vertical leg shape is visible plus a small portion of the chair seat or chair-frame at the top of the leg providing context (just enough that the viewer can see this is a furniture leg, NOT a disembodied body part — the chair-frame context is load-bearing), the leg is a simple vertical cylinder or gently-tapered turned-wood shape in soft warm-brown wood color with a lighter top and a slight cel-shading on the right side, the chair-frame portion at the top is rendered in the same warm-brown wood and shows the leg-to-seat junction as a clean simple corner (just the corner — NOT the whole chair, the chair-frame stays in the upper 20% of the frame providing context), the leg's bottom rests on the cream background showing the leg's full vertical extent, NO floor, NO room, NO other chair legs visible (single subject), NO carpet, NO shoes, NO body part anywhere in frame, just a single CHAIR LEG with chair-context at the top** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-brown wood. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The subject is a SINGLE CHAIR LEG with a small chair-context portion at the top showing the leg-to-seat junction. This is FURNITURE, NOT a body part. NO human leg, NO animal leg, NO disembodied limb, NO foot, NO shoe — pure furniture render. NO smiling face, NO eyes, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - **Body leg / human leg / animal leg / disembodied limb** (load-bearing rejection — the body-fragmentation read is a content + safety concern for an 8yo).
  - Severed limb / blood / wound / injury (defensive — body-fragment imagery is a horror-attractor in MJ).
  - Multiple chair legs (multi-subject).
  - Whole chair (reads as "chair", not "leg").
  - Insect leg (reads as "leg of bug", confusing with `bug` chip).
  - Table-leg with whole table visible (reads as "table", not "leg").
  - Saturated primary colors on the wood.
  - Photorealistic 3D-rendered furniture leg.
  - Carved / ornate detailed leg with floral motifs (visual noise).
  - Robot leg / mechanical leg (drift to sci-fi).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-leg.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB** (geometric simplicity).
- **Notes:** **The chair-leg framing is mandatory per pool spec §10 Q3.** If MJ produces a body-leg or animal-leg generation, REGENERATE — do not proceed. The "small portion of chair-frame at top" context cue is what disambiguates this from a body-fragment image. If too much chair shows, drift toward "chair" reading; regenerate with chair-context shrunk. If too little chair-context, the leg reads as a body-fragment; regenerate with more context. The Goldilocks zone is ~20% chair-context, ~80% leg.

---

### 2.3 `hen` — animal — `/ɛn/` rhyme family

- **Vocabulary cue:** A friendly chicken — round body, characteristic comb on top of head, beak, two visible legs, side or three-quarter view. The comb + beak + plump-body silhouette carries "hen" recognition.
- **Distinctness check:**
  - **vs. `bug` (short-u target, animal):** `hen` is **bird** (2 legs + comb + beak + feathered body); `bug` is **insect** (6 legs + antennae + segmented body). Different animal classes. **No risk.**
  - **vs. `dog`/`fox` (short-o targets):** `hen` is **bird**; `dog`/`fox` are **mammals**. Different. **No risk.**
  - **vs. `cat`/`bat` (canonical short-a):** Same bird-vs-mammal distinction. **No risk.**
  - **vs. `rat` (probe-pack):** Bird vs mammal. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **friendly cartoon hen / chicken, viewed in three-quarter side perspective so the round plump body and the head-with-comb are both fully visible, the body is a soft rounded shape in soft warm-cream or soft peach feather-color with gentle cel-shading suggesting feather softness (NOT individual feather strokes — a soft uniform body), a small clear BEAK in soft warm-yellow pointing forward, a CLEAR RED OR ROSE-PINK COMB on top of the head (the comb is the disambiguating feature; without it the silhouette could read as a generic round bird), two large round soft eyes with friendly expression, two simple thin LEGS visible below the body in soft warm-yellow with simple foot-shapes (NO detailed talons), a small soft tail of feathers at the back of the body in slightly darker warm-cream, NO eggs visible (would conflict with the `egg` chip), NO chicken coop, NO grass, NO other chickens, just a single hen on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-cream feather body and soft rose-pink comb. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The hen is a CLEAR BIRD with a CHARACTERISTIC COMB ON HEAD and a BEAK and TWO LEGS — the comb is the load-bearing recognition feature; without it the silhouette reads as a generic round bird or duck. NO eggs in the picture (would conflict with `egg` chip). Friendly cartoon hen, NOT a realistic-photo chicken.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Hen with eggs (would conflict visually + semantically with the `egg` chip).
  - Rooster (visible long tail-feathers + larger comb — reads as "rooster", not "hen").
  - Photo-realistic chicken with feather detail (drift photographic).
  - Anthropomorphised hen wearing clothes / standing upright walking (Sanrio-derivative anthropomorphism).
  - Multiple chickens / mother hen with chicks.
  - Chicken coop / barn / scene around the hen.
  - Saturated primary red comb (palette stays warm-pastel — soft rose-pink comb).
  - Pure-white feathers (collapses into cream background).
  - Cartoon-hen with cheek-blush + sparkle-eyes (drift to anime/kawaii overload).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-hen.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** The comb is load-bearing at 96pt. If MJ generates a hen with an under-emphasised or absent comb, regenerate. The "no eggs in frame" rule is critical because the `egg` chip is a separate target in this same pool — having eggs visible in the hen picture would create ambiguity.

---

### 2.4 `pen` — object — `/ɛn/` rhyme family — CONDITIONAL RE-TRACE (Q2)

> **Re-trace conditional on Q2 lock in pool spec §10.** The current `public/assets/pictures/picture-pen.svg` is a hand-authored short-a-pack SVG from PR #157 (originally a distractor-only entry). If Q2 = re-trace (recommended, mirrors short-u Q2 lock A on `sun, cup, bus`), this row authors a fresh prompt in the short-e sheet style; the new MJ generation overwrites the existing file via `yarn embed-pictures` for tier visual cohesion. If Q2 = defer, this row drops from scope and the existing PR #157 SVG is kept as-is for v1.

- **Vocabulary cue:** A simple ballpoint or fountain pen, viewed three-quarter so the pointed nib + body + clip + cap are all visible. The pointed-cylinder-with-clip silhouette carries "pen" recognition.
- **Distinctness check:**
  - **vs. `gum` (short-u target — wrapped-stick package):** `pen` is **pointed cylinder + clip + cap**; `gum` is **rectangular wrapped package**. Different shapes. **Low risk.**
  - **vs. `tag` (canonical short-a):** Both small office/stationery objects but pen has clip + pointed nib; tag has string-loop + flat paper-card. **Low risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple ballpoint or fountain pen, viewed in three-quarter perspective so the elongated body and the metal pointed nib at one end and the small clip on one side and the cap at the other end are all clearly visible, the pen body is a slim cylinder in soft warm-rose, soft peach, or soft warm-blue color with gentle cel-shading on the right side, the metal pointed NIB at the writing end in a soft warm-grey or soft warm-cream metallic tone (the nib is the disambiguating feature; without a visible point the silhouette reads as a generic stick or marker), a small CLIP visible on the upper portion of the body in the same metallic tone (the clip is the second disambiguating feature; without it the silhouette could read as a marker or stick), an optional simple CAP at the back end of the pen (or the cap-off and writing-tip-out version, either works), the pen is positioned diagonally in the frame for clear three-quarter readability, NO ink line being drawn, NO paper, NO writing surface, NO hand holding the pen, NO other pens, just a single pen on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with body color in soft warm-rose / soft peach / soft warm-blue. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The pen is a SLIM ELONGATED OBJECT with a VISIBLE NIB at the writing end and a VISIBLE CLIP — nib + clip together carry "pen" recognition. NO smiling face, NO anthropomorphism — pure stationery render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - No nib visible (would read as "stick" or "marker").
  - No clip visible (would read as "marker" or "tube").
  - Hand holding the pen (introduces second subject).
  - Paper or ink-line-drawn (introduces second subject).
  - Multiple pens (single subject).
  - Anthropomorphised pen with eyes / face on body.
  - Brand names / logos / engravings on the pen body.
  - Pencil with eraser at end + sharpened-wood tip (reads as "pencil", not "pen").
  - Quill / feather pen (reads as "feather" or "quill").
  - Saturated primary colors on the body.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-pen.svg` via `yarn embed-pictures` — **OVERWRITES** the existing PR #157 file (if Q2 = re-trace).
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** Conditional on pool spec §10 Q2 = re-trace. The nib + clip are the load-bearing features at 96pt; if either collapses, the silhouette reads as a generic stick. Pair-review against the existing PR #157 short-e-context use of `pen` — make sure the new style coheres.

---

### 2.5 `web` — object — `/ɛb/` rhyme family

- **Vocabulary cue:** A spider web — concentric ring pattern with radial spokes converging at the center, no spider visible. The geometric concentric-radial pattern silhouette carries "web" recognition.
- **Distinctness check:**
  - **vs. `net` (pack neighbour, mesh object):** `web` is **concentric-radial geometric pattern (spider's web)** with INVISIBLE-thin lines; `net` is **even-grid mesh-with-handle (fishing/butterfly net)** with thicker rope-or-cord lines. Different geometries (radial-symmetric vs. orthogonal grid) and different surface contexts (free-floating web vs. handled tool). **Low risk.**
  - **vs. `rug` (short-u target):** `web` is **fine-line radial pattern**; `rug` is **flat-rectangle with fringe + simple geometric pattern (stripes/diamonds)**. Different shapes entirely (radial-circular vs. rectangular). **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple spider web, viewed front-on as a flat near-circular pattern, the web has a CONCENTRIC RING PATTERN — about 5-7 concentric circles spiraling outward from a center point — with RADIAL SPOKES (about 8-12 evenly distributed) extending from the center outward to the outer edge connecting all the rings, the web lines are very thin (about 1-1.5 px at 1024×1024 render) in soft warm-cream or soft mauve color suggesting silk threads, a few delicate small "dewdrops" optionally visible on a few of the threads (kept VERY simple — just small soft round shapes, NOT photorealistic water beads), NO spider visible (the spider is conspicuously absent — this is JUST the web), NO leaves, NO branch, NO twig, NO frame, NO other webs, just a clean simple spider web on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with the very thin web threads, line weight ~1-1.5 px at 1024×1024 render for the web threads (NOT the standard 2-2.5 px stroke — the web is a fine-line subject), gentle soft cel-shading suggesting silk-thread softness. Palette: warm pastels with soft-cream or soft-mauve thread color. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. **The web's thin lines must contrast cleanly against the cream background — push the thread color toward soft mauve or soft warm-grey if needed for contrast.** Single subject only — no other figures, no text, no spider. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The web is a CLEAR CONCENTRIC-RADIAL PATTERN — concentric rings + radial spokes together carry "web" recognition. NO spider in frame (the absence is deliberate). NO smiling face, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - **Spider visible** (introduces second subject + animal-imagery; the web alone is the chip).
  - Web with insect caught in it (introduces second subject + adds menace).
  - Web in a corner of a room / on a tree branch (introduces environment).
  - Web at a Halloween / spooky angle with dark mood (palette stays warm-pastel).
  - Photorealistic dew-drops with detailed water-physics rendering.
  - Saturated primary white threads against a dark background (anti-palette).
  - Tangled or messy web (clear concentric-radial pattern is required for recognition).
  - Multiple webs / pile of webs.
  - Spider-Man web shooter pattern (pop-culture reference, drift).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-web.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB** (the geometric pattern compresses cleanly).
- **Notes:** The concentric-radial pattern at 96pt MUST read clearly. If MJ produces a tangled or asymmetric web (a "sketch of a web" style), regenerate with the geometry locked. The thin-thread line weight (~1-1.5 px) is the one acceptable deviation from the locked 2-2.5 px stroke convention — webs are silk threads; they cannot have thick contour lines without losing recognition. **The "no spider" rule is mandatory** — this is the only chip in the pack where the absence of an expected subject (the spider) is the recognition cue.

---

### 2.6 `net` — object — `/ɛt/` rhyme family

- **Vocabulary cue:** A fishing or butterfly net — open-mesh weave inside a circular or oval frame attached to a handle. The mesh-pattern + frame + handle silhouette carries "net" recognition vs. bag.
- **Distinctness check (load-bearing):**
  - **vs. `bag` (canonical short-a target — FORBIDDEN_PAIR partner per pool spec §3 + §6):** Both fabric-with-handle objects. **Discriminator: mesh-vs-solid.** `net` has **VISIBLE MESH WEAVE** (open holes in a regular grid pattern); `bag` has **solid fabric surface**. **The mesh must be visible at 96pt.** Cross-vowel rule keeps them apart in trios under same-vowel-only, BUT cross-pack visual hygiene matters. **NEW FORBIDDEN_PAIR `[net, bag]` added in pool spec §3 / §6.**
  - **vs. `web` (pack neighbour, mesh):** `net` is **handled tool with even orthogonal grid mesh + frame**; `web` is **free-floating concentric-radial pattern, no handle, no frame**. Different geometries. **Low risk.**
  - **vs. `rug` (short-u target):** `net` is **handled mesh tool**; `rug` is **flat floor covering with fringe**. Cross-vowel + different shapes. **No risk.**
  - **vs. `pan` (canonical):** Both have handles. `net` is **mesh inside frame**; `pan` is **solid disc with horizontal handle**. Different fills (mesh vs. solid). **Low risk.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple fishing or butterfly net, viewed in three-quarter perspective so the round or oval mesh-frame and the long handle are both clearly visible, the FRAME is a clean simple circle or oval in soft warm-brown wood or soft warm-grey metal color (frame ~1.5 px stroke), the MESH inside the frame is a CLEAR GRID OF OPEN CELLS — about 6-8 vertical strands and 6-8 horizontal strands forming a regular orthogonal grid (the mesh is the disambiguating feature; the open holes between strands are what distinguishes this from a solid bag), mesh-strand color in soft warm-cream or soft warm-mauve suggesting cord or rope, the HANDLE is a long simple stick extending from the frame in soft warm-brown wood, the handle length is roughly 1.5x the frame diameter for clear "this has a handle" reading, gentle cel-shading on the right side, NO water around the net, NO fish caught in the net, NO butterfly caught in the net, NO other nets, just a clean simple net on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render for frame and handle, ~1.5 px for mesh strands, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The net has a CLEAR FRAME with VISIBLE MESH GRID inside + a HANDLE — mesh + frame + handle together carry "net" recognition and distinguish it from a bag (solid fabric, no mesh). The mesh holes must be visible at 96pt. NO smiling face, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Solid fabric surface with no visible mesh (would collapse to "bag" reading).
  - Net with fish caught in it (introduces second subject; fish-in-net would also clarify "net" but adds visual complexity).
  - Net with butterfly caught (same — second subject).
  - Net on a fishing rod (introduces second subject — rod).
  - Detailed mesh weave with too-many-strands (visual noise — keep mesh sparse for chip-size readability).
  - No frame (net cannot just be free-floating mesh — needs the rigid frame to distinguish from web).
  - Saturated primary blue handle (warm-pastel only).
  - Anthropomorphised net.
  - Soccer goal net / basketball net (sports-context, different shape).
  - Hair net.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-net.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **The mesh visibility is load-bearing** for `[net, bag]` discrimination at 96pt. If Phase 2 review shows the mesh collapses to a flat texture (i.e. reads as "bag with a handle"), regenerate with the mesh holes enlarged. Pair-review against the existing `picture-bag.svg` from PR #157 at 96pt — both should be readable simultaneously without confusion. The 6-8x6-8 grid (versus a denser weave) is calibrated to keep individual cells readable at 96pt.

---

### 2.7 `jet` — vehicle — `/ɛt/` rhyme family

- **Vocabulary cue:** A sleek jet plane / aircraft, viewed three-quarter from below or from front-side, with wings + tail + cockpit visible. The wings + tail + cockpit silhouette carries "jet" recognition.
- **Distinctness check:**
  - **vs. `bus`/`van` (short-u + short-a):** `jet` is **aircraft (wings + tail + cockpit, in flight)**; `bus`/`van` are **ground vehicles (wheels + windows, on ground)**. Different categories. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple jet plane / passenger aircraft, viewed in three-quarter perspective from below-front so the WINGS and the TAIL and the COCKPIT are all clearly visible, the body is a sleek elongated shape in soft warm-cream or soft warm-blue with gentle cel-shading, two main WINGS extending outward from the middle of the body (clean simple wing shapes, NOT detailed flap/aileron rendering), a clear vertical TAIL fin at the back rising upward, a small horizontal stabilizer at the back, a clear COCKPIT window at the front of the body in a slightly darker tone (suggesting tinted glass), small simple round-or-rectangular passenger windows along the side of the body (about 4-6 visible windows, kept simple), the jet is positioned in flight (NOT on a runway, NO ground line) with a slight upward angle suggesting forward motion, gentle cel-shading on the right side, NO sky, NO clouds, NO contrails, NO other planes, NO airport, just a clean simple jet on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated warm-cream or soft warm-blue body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The jet is a CLEAR AIRCRAFT with WINGS + TAIL + COCKPIT — these together carry "jet" recognition and distinguish it from ground vehicles. The desaturated palette keeps the warm-pastel family — pure airline-white is too stark. NO smiling face, NO eyes-for-cockpit-windows, NO mouth-for-nose, NO anthropomorphisation (per the pack-wide "no anthropomorphised vehicle" negation).** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Anthropomorphised jet with eyes / smile (known children's-book attractor — pure aircraft only).
  - Fighter jet with missiles / weapons (defensive — weapon-imagery rejection from `cut`).
  - Jet on a runway with airport scene (strip environment).
  - Sky / clouds / contrails / sunset behind the jet (single subject).
  - Pilot / passengers visible through cockpit or windows (introduces second subjects).
  - Brand names / airline logos / route numbers (anti-text rule).
  - Saturated primary colors / pure white airliner.
  - Cargo plane with massive boxy body (reads as "cargo plane", drift).
  - Helicopter (reads as "helicopter").
  - Toy plane (reads as "toy plane").
  - 3D photo-realistic render.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-jet.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** The wings + tail + cockpit combination is the load-bearing category cue (vs. ground vehicles). The "in flight, NOT on runway" framing keeps the chip visually clean — runway scenes introduce environment that conflicts with the flat-cream background convention. Pair-review against existing `bus`/`van` chips at 96pt — the aircraft-vs-ground-vehicle category split should be obvious.

---

### 2.8 `gem` — object — `/ɛm/` rhyme family

- **Vocabulary cue:** A geometric crystal or diamond shape with visible facets, viewed three-quarter so the facet structure reads. The geometric-crystal-with-facets silhouette carries "gem" recognition.
- **Distinctness check:**
  - **vs. `gum` (short-u target):** `gem` is **geometric crystal with hard facets**; `gum` is **wrapped rectangular package with soft fabric/paper**. Different surfaces and shapes. **Low risk.**
  - **vs. anything in pack:** No collision. Geometric crystal is unique in the pack. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple gem stone or precious crystal, viewed in three-quarter perspective so the geometric facet structure is fully visible, the gem has a CLEAR DIAMOND-CUT or BRILLIANT-CUT shape with about 4-6 visible flat facets (kept simple — NOT photorealistic 100-facet rendering), each facet rendered as a clean angular polygon with subtle cel-shading variations between adjacent facets so the 3D crystal form reads at a glance, the gem is a soft warm-rose, soft warm-mauve, or soft sage-green color (warm-pastel jewel tones, NOT saturated primary jewel colors) with the brightest facet on the upper-left from imaginary upper-left light and progressively darker facets toward the lower-right, optional small soft sparkle highlight on one facet (kept tiny — a small soft star or dot, NOT photorealistic light-rays), the gem rests gently on the cream background showing its full geometric form, NO ring or jewelry setting, NO crown holding the gem, NO multiple gems, NO sparkle-rays radiating outward (rays would conflict with `sun` chip), just a clean simple gem on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with soft warm-rose / soft warm-mauve / soft sage-green body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The gem is a CLEAR GEOMETRIC CRYSTAL with VISIBLE FACETS — the angular facet structure carries "gem" recognition. NO smiling face, NO eyes, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Photorealistic 100-facet rendering with light-physics simulation.
  - Gem in a ring / jewelry setting / on a finger.
  - Crown holding gems / king's-jewel context.
  - Multiple gems / pile of treasure.
  - Sparkle-rays radiating outward (would conflict with `sun` recognition pattern).
  - Anthropomorphised gem with face on a facet.
  - Saturated primary red ruby / saturated blue sapphire (palette stays warm-pastel).
  - Rough uncut gem stone with no facets (reads as "rock").
  - Disney's "Crystal" or "Rare Candy" reference styling.
  - Pixar-style smooth-rendered gem.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-gem.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB** (geometric simplicity).
- **Notes:** The facet structure at 96pt is what carries the recognition. If MJ generates a smooth-rendered gem (no visible facets), regenerate with the angular geometry emphasised. The "no sparkle-rays" rule is critical — sparkle-rays around a small bright object are the `sun` recognition pattern; gems can have a small sparkle highlight ON a facet but cannot have rays radiating outward.

---

### 2.9 `egg` — food — `/ɛg/` rhyme family

- **Vocabulary cue:** A single smooth ovoid egg, viewed three-quarter from slightly above. The smooth-uniform-oval silhouette carries "egg" recognition.
- **Distinctness check (load-bearing):**
  - **vs. `nut` (short-u target — FORBIDDEN_PAIR partner per pool spec §3 + §6):** Both ovals. **Discriminator: smooth-vs-seam.** `egg` is **smooth-ovoid with NO seam line, NO surface detail beyond gentle shading**; `nut` is **oval with VERTICAL SEAM LINE down middle**. Cross-vowel rule keeps them apart in trios but cross-pack hygiene. **NEW FORBIDDEN_PAIR `[egg, nut]` added in pool spec §3 / §6.**
  - **vs. `bun` (short-u target — FORBIDDEN_PAIR partner per pool spec §3 + §6):** `egg` is **smooth-ovoid with NO score-mark**; `bun` is **round bread-roll with HORIZONTAL SCORE-MARK on top**. Cross-vowel rule keeps them apart in trios but cross-pack hygiene. **NEW FORBIDDEN_PAIR `[egg, bun]` added in pool spec §3 / §6.**
  - **vs. `gem` (pack neighbour):** Cross-category — gem is geometric crystal with facets; egg is smooth organic oval. **No risk.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single chicken egg, viewed in three-quarter perspective from slightly above so the full ovoid shape is visible plus a small footprint where the egg rests (suggested rather than drawn — there is NO ground line), the egg is a clean smooth oval shape (broader at the bottom, narrower at the top — the canonical egg silhouette), the shell color is a soft warm-cream or soft warm-tan with VERY gentle cel-shading on the right side suggesting the curved surface, the surface is COMPLETELY SMOOTH — NO seam line, NO score mark, NO speckles, NO cracks, just a uniform smooth shell, a soft warm-cream highlight on the upper-left where imaginary upper-left light catches the curved surface, NO egg cup, NO carton, NO nest, NO other eggs, NO chicken nearby (chicken is a separate chip), just a single egg on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with soft warm-cream or soft warm-tan shell. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. **The egg's shell color must contrast cleanly against the cream background — push the shell warmth toward soft warm-tan if needed for contrast (the cream-on-cream collapse risk is the single biggest production risk for this asset).** Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The egg is a SINGLE SMOOTH OVAL with NO surface markings — the smooth-ovoid silhouette is the recognition cue and is the load-bearing discriminator vs. nut (which has a vertical seam) and bun (which has a horizontal score). NO seam line on egg. NO score mark on egg. NO cracks. NO smiling face, NO eyes, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - **Seam line down middle of egg** (would collapse the discriminator from `nut`).
  - **Horizontal score-mark on top of egg** (would collapse the discriminator from `bun`).
  - Cracked egg with yolk visible (reads as "broken egg").
  - Egg in a carton / dozen-egg layout (multi-subject).
  - Egg in a nest with a chicken nearby (multi-subject + scene).
  - Easter egg with painted patterns (reads as "Easter egg", drift to seasonal).
  - Saturated primary white egg (collapses into cream background — this is the biggest risk; push toward warm-tan).
  - Speckled / freckled egg (introduces visual noise + reads as "quail egg" or other variant).
  - Egg-on-toast / egg-in-pan (multi-subject + scene).
  - Anthropomorphised egg with face (Humpty Dumpty attractor).
  - 3D photo-realistic render with detailed shell-pore texture.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-egg.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~30–70 KB** (geometric simplicity compresses cleanly).
- **Notes:** **The cream-on-cream contrast risk is the single biggest production concern for this asset.** A pure-white or pale-cream egg dissolves into the `#FFF6EE` background once the background is keyed transparent. Push the shell warmth toward soft warm-tan (`#E8D4B5` family) so the egg reads against cream. Generate `egg` AFTER `nut` and `bun` so the FORBIDDEN_PAIR discriminator pair-review can happen at 96pt: `egg` (smooth) vs. `nut` (seam) vs. `bun` (score). If at 96pt with PNG-embed compression any of those discriminators collapse, regenerate the weaker side. **The Phase 2 fallback per pool spec §10 Q1 is to drop `egg` from the pool entirely** if the smooth-ovoid read can't reliably hold against the cream background; in that fallback case the pool drops to 8 entries.

---

## 3. Quick reference — pack index

| #   | Word | Type                              | Pack neighbour requiring discrimination                        | Picture-side discriminator                                     |
| --- | ---- | --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | bed  | new short-e target                | `bag` (cross-vowel — both fabric)                              | rectangular furniture + pillow + legs vs. soft tote with handle |
| 2   | leg  | new short-e target                | `log` (short-o — elongated cylinder)                           | vertical chair-leg + chair-context vs. horizontal wood log     |
| 3   | hen  | new short-e target                | `bug`/`rat`/`cat`/`dog`/`fox` (animals across packs)           | bird (2 legs + comb + beak) vs. mammal/insect classes          |
| 4   | pen  | conditional re-trace short-e target (Q2 pending) | `tag` (cross-vowel — small flat objects)         | nib + clip + cylinder vs. paper-card + string-loop             |
| 5   | web  | new short-e target                | `net` (pack neighbour — both mesh-like)                        | concentric-radial pattern (no handle) vs. orthogonal mesh-grid + handle |
| 6   | net  | new short-e target                | **`bag` (cross-vowel — FORBIDDEN_PAIR added)**                 | mesh-with-frame + handle vs. solid fabric + handle             |
| 7   | jet  | new short-e target                | `bus`/`van` (cross-vowel — vehicles)                           | aircraft (wings + tail + cockpit, in flight) vs. ground vehicle (wheels + windows, on ground) |
| 8   | gem  | new short-e target                | none in-pack; `gum` (cross-vowel — both small handheld objects) | geometric crystal with facets vs. wrapped rectangular package |
| 9   | egg  | new short-e target (Phase 2 fallback drops if unstable) | **`nut` and `bun` (cross-vowel — FORBIDDEN_PAIRS added)** + cream background (low-contrast risk) | smooth-ovoid (no marks) vs. oval-with-vertical-seam vs. round-with-horizontal-score |

**Highest-distinctness-risk pair in this pack: `net` ↔ `bag` (cross-pack).** Both fabric-with-handle objects. The mesh-vs-solid-surface discriminator is what makes them readable as different words at 96pt. Phase 2 review at chip size IS mandatory for this pair before acceptance — see pool spec §3 + §6. **NEW FORBIDDEN_PAIR `[net, bag]` is the cross-pack guard.**

**Second-highest-distinctness-risk pair in this pack: `egg` ↔ `nut` and `egg` ↔ `bun` (cross-pack).** All ovals/round food. The smooth-vs-seam (egg/nut) and smooth-vs-score (egg/bun) discriminators carry the discrimination. Pair-review at 96pt with both forbidden pairs is mandatory. **NEW FORBIDDEN_PAIRS `[egg, nut]` and `[egg, bun]` are the cross-pack guards.**

**Cross-vowel cosmetic-similarity to watch:** `web` ↔ `net` (in-pack — both mesh-like). Concentric-radial vs. orthogonal-grid is the load-bearing discriminator. Cross-vowel cosmetic-similarity also flagged for `leg` ↔ `log` (short-o, cylindrical) — orientation + texture handle the discrimination.

**Highest-production-risk asset: `egg`.** The cream-on-cream contrast risk is the load-bearing concern. Push shell warmth toward soft warm-tan to ensure the egg reads against `#FFF6EE` cream once transparent-keyed. Phase 2 fallback per pool spec §10 Q1 is to drop `egg` from the pool entirely if the read can't reliably hold.

---

## 4. Generation order recommendation

Per `picture-pack-iteration-plan.md` §3 — surface-the-hardest-cases-early principle. Mirrors short-u §4.

**Order:**

1. **`net`** first — highest-risk for cross-pack discrimination (vs. `bag` per LOCKED FORBIDDEN_PAIR). The mesh visibility is load-bearing; if it doesn't survive PNG-embed compression at 96pt, the entire `[net, bag]` discrimination collapses.
2. **`egg`** second — highest in-pack production risk (cream-on-cream contrast) AND cross-pack FORBIDDEN_PAIR risk (vs. `nut` + `bun`). Surface the contrast issue early; Phase 2 fallback decision (drop `egg`?) needs to be made before late-pack iteration.
3. **`hen`** third — moderate risk (cross-pack animal discrimination). The comb is load-bearing; verify it survives at 96pt.
4. **`leg`** fourth — moderate-to-high risk (chair-leg framing must be solid; body-leg generation is a content concern). If MJ drifts toward body-leg, regenerate immediately. Don't proceed without confirming chair-leg framing.
5. **`web`** fifth — low-to-moderate risk. The thin-line geometry must survive PNG compression at 96pt.
6. **`jet`** sixth — low risk. Standard aircraft category is well-attended in MJ's training.
7. **`bed`** seventh — low risk. Standard furniture rendering.
8. **`gem`** eighth — low risk. Geometric simplicity.
9. **`pen`** last (CONDITIONAL on Q2 = re-trace) — pair-review against existing PR #157 short-a-pack assets for style cohesion.

**If Thomas bundles this pack with future short-i generation** ("50+ images one-time deal" per the dispatch brief), the per-pack tier ordering still applies — within the short-e block, run `net`/`egg`/`hen`/`leg` first so pair-review at chip size and content-safety review can happen before drifting to other vowels. The conditional `pen` re-trace belongs inside the short-e block, NOT scheduled into the future short-i block — pack-cohesion within short-e takes precedence.

---

## 5. Acceptance criteria for Phase 2 selection (Thomas-side)

Each generation in this pack must pass ALL of these gates before Thomas accepts and saves the source PNG. These mirror the short-u + short-o pack §5 plus per-row distinctness gates specific to this pack.

### 5.1 Style-cohesion gates (same as short-a + short-o + short-u packs)

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style preamble honored: line weight ~2 px at 1024×1024 (~1.5 px for `web` thin threads is the one acceptable deviation), palette warm-pastel, line color warm-dark-brown not pure black, background solid soft cream flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no signature, no logo, no UI overlay anywhere in the image.
- [ ] No anthropomorphism (no smiling bed/hen/web/net/jet/gem/egg/pen, no face on any object, no cartoon-eyebrows on hen, no smile on jet's grille).
- [ ] Visual cohesion with the locked short-a pose-zero (typically `dog`) — line weight, palette, shading style match.
- [ ] No weapons, blades, sharp objects (defensive — `cut` rejection from short-u carried forward).
- [ ] **No body fragments / no severed limbs / no disembodied human or animal parts** (defensive for `leg` — chair-leg framing only).

### 5.2 Per-word distinctness gates (load-bearing for this pack)

- [ ] **`bed`:** Rectangular furniture + clear pillow at head end + visible legs at corners + optional headboard. No bedroom scene around the bed.
- [ ] **`leg`:** **CHAIR-LEG framing — vertical leg + small chair-context portion at the top showing leg-to-seat junction.** NOT a body-leg / animal-leg / disembodied limb. Roughly 20% chair-context, 80% leg.
- [ ] **`hen`:** Clear bird with characteristic comb on head + beak + 2 legs visible + plump body. The comb is the load-bearing recognition feature. NO eggs visible (would conflict with `egg` chip).
- [ ] **`pen` (RETRACE — conditional):** Slim cylinder with VISIBLE NIB at the writing end + VISIBLE CLIP on the body. NIB + CLIP together carry recognition. No paper / no hand / no ink-line.
- [ ] **`web`:** Clear concentric-radial pattern with about 5-7 concentric rings + 8-12 radial spokes converging at center. NO spider visible. The thin-line geometry must contrast cleanly against the cream background.
- [ ] **`net`:** **VISIBLE MESH GRID inside a clear FRAME + a HANDLE.** **At 96pt side-by-side with `bag`, the mesh-vs-solid discriminator holds (FORBIDDEN_PAIR `[net, bag]` per pool spec §3 + §6).** No fish or butterfly caught.
- [ ] **`jet`:** Aircraft with wings + tail + cockpit, in flight (NOT on runway). Pair-review against `bus`/`van` at 96pt — the aircraft-vs-ground-vehicle category split is obvious.
- [ ] **`gem`:** Geometric crystal with 4-6 visible facets. NO sparkle-rays radiating outward (would conflict with `sun` recognition). NO ring / crown / jewelry setting.
- [ ] **`egg`:** Smooth ovoid with NO seam line, NO score-mark, NO cracks. Shell color warm-tan enough to contrast against cream background. **At 96pt side-by-side with `nut` and `bun`, the smooth-vs-seam-vs-score three-way discriminator holds (FORBIDDEN_PAIRS `[egg, nut]` and `[egg, bun]` per pool spec §3 + §6).**

### 5.3 "Regenerate" triggers

If any of the following appear, regenerate (do not proceed to embed):

- Anthropomorphised object (smiling face on bed/hen/jet/gem/egg/pen/net, eyes-for-headlights on jet, eyes on hen with cartoon eyebrows).
- **`leg` rendered as body-leg / human-leg / animal-leg / disembodied limb / severed limb** (mandatory regenerate; content concern).
- `hen` with eggs visible in the picture (would conflict with `egg` chip).
- `web` with spider visible.
- `net` with no visible mesh / solid fabric surface (collapses the bag-discrimination).
- `egg` with seam line down middle (collapses nut-discrimination) OR with horizontal score-mark on top (collapses bun-discrimination) OR pure-white shell (cream-on-cream collapse).
- `bed` with bedroom scene / lamp / nightstand.
- `jet` with sky / clouds / runway / contrails.
- `gem` with sparkle-rays radiating outward (sun-recognition pattern collision).
- Photorealistic / 3D-rendered output (tighten `--style raw`).
- Saturated primary colors, neon, pure black, sepia.
- Text on any subject.
- Multiple subjects (e.g. multiple eggs, multiple beds, basket of buns).
- Weapons / blades / sharp objects in the frame (defensive).
- **`leg` body-fragment imagery** (mandatory regenerate; content + safety).

---

## 6. Out of scope

- **Short-i picture pack** — separate per-vowel pack when the short-i tier scopes. Short-i is upstream of short-e per `WORD_SONG_NODES_IN_ORDER`; sequencing is open question §10 Q5 in the pool spec.
- **Phase 2 generation itself** — this is a Phase 1 prompt sheet. Thomas runs MJ in Phase 2 (per `user_midjourney_web` — MJ Web UI workflow with prompt-box paste + drag-drop upload, not Discord slash-commands).
- **Phase 3 PNG-embed integration** — Devon owns this PR via `yarn embed-pictures` (per `.claude/docs/skill-trees-and-content.md` §"Tooling for path 2"). The script wraps each transparent PNG into the canonical `<svg><image href="data:image/png;base64,...">` format. No code changes in this prompt-sheet PR.
- **Code changes to `wordPack.ts`, `wordPictures.tsx`, or canon files** — Kevin's downstream impl ticket. The pool spec §9 ACs cover those.
- **Cross-vowel distractor mixing** — out of v1 per pool spec §8 + short-u §8 + short-o §8. Tracked as ticket `86c9m3aek`.
- **Re-naming any existing `picture-{word}.svg` files** — out of scope (no renames needed for this pack; the 0-1 conditional retrace overwrites at the same path; the 8 wholly-new files use the canonical `picture-{word}.svg` naming convention).
- **`egg` Phase 2 fallback** — entry §2.9 documents the regenerate-then-drop trigger if 96pt review can't land the smooth-ovoid read against cream background. Pool spec §10 Q1 default says ship 9; the 8-word fallback (drop `egg`) is a Phase 2 contingency, not a Phase 1 scope question.
- **Cumulative PWA cache budget** — flagged in pool spec §3 §Cumulative budget. Devon's call at impl time.

---

## 7. Provenance

- **Triggering doc:** `design/word-song/short-e-pool-expansion.md` §3 ("Picture-pack requirements") — flagged the forward Kyle ticket; this pack is that ticket's deliverable.
- **Style preamble + universal parameters + locked attributes:** `design/word-song/picture-pack-style-anchor.md` §2 + §3.
- **Workflow + drift table + escalation ladder:** `design/word-song/picture-pack-iteration-plan.md` §3 + §5 + §6.
- **Per-row prompt structure inheritance:** `design/word-song/short-u-picture-pack-prompts.md` (sibling MJ prompt sheet) — this pack mirrors that file's row format. `design/word-song/short-o-picture-pack-prompts.md` is the additional template reference.
- **Word-list lock:** `design/word-song/short-e-pool-expansion.md` §1 final pool of 9 short-e target words. The 8 wholly-new words covered here are `bed, leg, hen, web, net, jet, gem, egg`; the 1 conditional re-trace (Q2 pending) is `pen`.
- **Q1/Q2/Q4/Q6 lock state:** pool spec §10 — Q1 (pool size 9 vs. 8 vs. 10) recommendation = ship 9; Q2 (re-trace `pen` for cohesion) recommendation = re-trace; Q4 (Reading A vs. Reading B) recommendation = Reading B; Q6 (cumulative budget mitigation) deferred to Devon's impl. Q3 (chair-leg vs. body-leg framing) recommendation = chair-leg, locked into §2.2 prompt body. Q5 (sequencing vs. short-i pool spec) recommendation = Option B (this spec lands as forward-looking design surface; impl gated on short-i shipping first).
- **First-encounter opener line provenance:** `design/research/short-u-minimal-pair-and-future-vowel-openers.md` §3.2 — Dave's pre-spec'd `bed/bid` opener (with `pen/pin` fallback) verbatim. Pool spec §4 + AC9b.
- **2-session-gap rule provenance (mastery side, not picture-side):** `design/research/phonics-sequence-marian.md` §Q1 + Sources 1+2+3; pool spec §5.
- **Prior short-a-pack reference (continuity-only, NOT binding):** `design/word-song/picture-pack-prompts.md` §2.4 (`pen` short-a-pack treatment) — reference-only signal for vocabulary cue and distinguishing features. The short-e sheet's §2.4 is the binding prompt for any `pen` re-trace; pack cohesion within short-e takes precedence over backwards-cohesion with the prior short-a sheet.
- **Phase 3 path locked to Path 2 (PNG-embed):** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" + Thomas's "50+ images one-time deal" preference per the dispatch brief.
- **PWA cache budget:** `reference_pwa_asset_size_limits` memory — 4 MiB cache cap; ~50–150 KB per SVG fits comfortably for this pack but cumulative budget across all packs needs review per pool spec §3 §Cumulative budget.
- **MJ Web UI workflow:** `user_midjourney_web` memory — Thomas operates MJ via Web UI (prompt-box + drag-drop upload), not Discord slash-commands. Prompt sheet copy is paste-ready for the Web UI's prompt input.
- **Locked memories:**
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — this pack uses PNG-in-SVG embed per the established Phase 3 path; the lock holds because the wrapper IS still SVG, the *content* is the source PNG embedded as data URI).
  - `project_spec_drift_decisions` K (Sanrio-style friendly bat → applies forward to friendly hen here).
  - `project_planner_parser_contract` (no parser change here; picture-pack only).
  - `feedback_mj_workflow_explicit_removebg` — never imply MJ outputs are transparent; remove.bg is its own discrete step.
