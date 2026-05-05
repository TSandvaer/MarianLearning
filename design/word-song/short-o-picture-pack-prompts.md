# Word Song — short-o picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney operator, Phase 2). Kyle/Devon (vector trace, Phase 3).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready.
**Predecessor specs:** `design/word-song/short-o-pool-expansion.md` (PR #141 / #150 / #151), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/picture-pack-prompts.md` (short-a pack, locked), `design/word-song/picture-pack-iteration-plan.md` (workflow + drift table — inherited).

---

## 0. Scope — exactly 4 words

This pack covers the **wholly-new short-o targets that PR #151 ships with silhouette fallbacks**:

> **`mop`, `box`, `mom`, `hot`.**

The other four short-o words — `dog`, `log`, `pot`, `fox` — are promoted-from-distractor entries. They already have inline silhouettes in `wordPictures.tsx` (`dog` also has a real shipped SVG: `public/assets/pictures/pic-dog.svg`). Per `short-o-pool-expansion.md` §3 and the v1 picture-pack README §"Why not o/u/e/i in v1", those four belong to the short-a pack's eventual Midjourney + trace pass — re-traced for stylistic cohesion alongside the canonical 14 + 8. **They are NOT in this pack's scope.** Out-of-scope explicitly listed in §6 below.

**Total new generations needed for this pack: 4.** Total new SVG assets after Phase 3: 4.

---

## 1. Style anchors — derived from existing pack

This section names what makes the existing short-a pictures look like one illustrator made them — copied byte-for-byte from `picture-pack-style-anchor.md` §2 + §3 so the four short-o additions land as visual siblings, not visual rivals. **No deviation for this pack.** Marian must not be able to detect "the new vowel arrived" by visual style — that would corrupt the same-screen layout cohesion the short-o spec §7 deliberately preserves.

### 1.1 Style preamble — re-use byte-for-byte (load-bearing)

**Re-use this paragraph byte-for-byte across every generation in this pack.** This is the pack-cohesion seed.

> **Single subject, centered, square 1:1 composition.** A child-friendly illustrated [SUBJECT] in the style of **modern slice-of-life Korean manhwa / webtoon children's book illustration**. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). **Palette: warm pastels** — soft pinks, peaches, creams, warm browns, soft mauve, soft sage — **no saturated primary colors, no neon, no pure black**. Object-specific colors allowed (a bus is yellow or blue, a frying pan is grey, an apple is red) but always **desaturated and illustrated**, never photographic. Skin tones if any: warm cream (#F5DCC9). Hair if any: warm dark brown (#5C3F31), never pure black, never blonde. **Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop, no decorative elements behind the subject.** **Single subject only — no other figures, no text, no labels, no signage, no logos, no UI overlays, no watermarks.** **Friendly tone**, large-eyed where the subject has eyes, rounded forms, soft-natural proportions. **Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon illustration.** Read-on-first-look: a kind, simple, clearly identifiable [SUBJECT] that a 6-to-8-year-old would point at and name. Drawn for a children's vocabulary book, not for a clinical icon set, not for a marketing illustration, not for a stock photo.

### 1.2 Locked style attributes (inherited)

| Attribute | Value | Source |
| --------- | ----- | ------ |
| Aspect ratio | 1:1 square, 1024×1024 minimum, 1792×1792 max longest side | style-anchor §3.1 |
| Composition | Subject fills 60-75% of frame, centered, ~12-20% margin all sides, slight three-quarter view for objects with depth | style-anchor §3.1 |
| Background | Solid soft cream `#FFF6EE` flat — keyed transparent in Phase 3 | style-anchor §3.2 |
| Drop shadow | None on subject in v1 asset (Phase 3 may add CSS shadow on chip) | style-anchor §3.2 |
| Outer contour | ~2-2.5 px stroke at 1024×1024, warm dark brown `#3E2818`, never pure black | style-anchor §3.4 |
| Inner detail lines | ~1.5 px, used sparingly | style-anchor §3.4 |
| Line treatment | Solid clean lines, closed contours, no double-stroke, no sketch-effect breaks | style-anchor §3.4 |
| Shading | Single soft cel-shadow companion per color zone, light direction upper-left | style-anchor §3.5 |
| Palette tokens | `#FFF6EE` cream / `#FFB7C5` rose / `#F0CDB8` peach / `#F5DCC9` skin / `#5C3F31` warm-brown / `#3E2818` deepest contour / `#C77A7A` mouth-soft-red / object-specific desaturated greys + soft greens + soft blues | style-anchor §3.3 |
| Anti-palette | Saturated primary red, pure black, neon, photographic gradients, sepia, grayscale | style-anchor §3.3 |
| Subject framing | Three-quarter view; objects: see per-row notes; people: stylised silhouette with minimal facial detail (eyes as small dots, no detailed nose, soft mouth line) | style-anchor §3.6 |
| Anthropomorphism | None on objects (no smiling mop, no smiling bowl); see §3.7 | style-anchor §3.7 |

### 1.3 Pack-cohesion lever — `--cref` / `--sref` to short-a pose-zero

The short-a pack uses `dog` as pose-zero per `picture-pack-iteration-plan.md` §1.1. This pack inherits that pose-zero. Every generation appends:

```
--cref <short-a-dog-pose-zero-url> --cw 80 --sref <short-a-dog-pose-zero-url>
```

If the short-a pack has not yet produced its pose-zero by the time this pack runs (i.e., short-o picture pack runs ahead of short-a Midjourney pass), generate the short-a `dog` pose-zero first per the iteration plan §1, **then** generate this pack's four against that reference. Do not run this pack standalone — that produces a 4-picture island that won't match the eventual short-a re-trace.

**If short-a pack has already produced its pose-zero,** use the same URL — pack-wide style cohesion across the whole eventual 26-picture corpus (22 short-a + 4 short-o-new) is the goal.

### 1.4 Universal trailing parameters (append to every prompt in this pack)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face, smiling mop, smiling bowl, mop with face, bowl with face, steam with face
```

**Delta from short-a pack:** added `smiling mop, smiling bowl, mop with face, bowl with face, steam with face` to the `--no` list. The short-a `--no` already covers fan/bus/object anthropomorphism; the additions here negate the steam-with-face and bowl-with-face attractor that Midjourney's "soup illustration" prior occasionally pulls toward.

---

## 2. Per-word entries

The format per row mirrors the short-a pack:

```
WORD — vocabulary cue — distinctness check — full prompt — negatives — asset spec — notes
```

Each "full prompt" is paste-ready — the style preamble from §1.1 is inlined verbatim. Append the trailing parameters from §1.4 to every prompt.

---

### 2.1 `mop` — household — `/ɒp/` rhyme family

- **Vocabulary cue:** Cleaning mop with a long handle and a fringe / yarn-strand head. The fringe-head carries "mop" recognition; without it the silhouette reads as a generic stick or pen.
- **Distinctness check:**
  - **vs. `mom` (pack neighbour, `/ɒ/` short-o + shared `m-o-` onset):** `mop` is an **object** (handle + fringe head); `mom` is a **two-figure parent-with-child composition**. Silhouettes are categorically different — object-stick vs. two-human-figures. **Not at risk** of silhouette collision; the m-o-_ onset confound is a decoding-side concern handled by the FORBIDDEN_PAIR rules in `wordPack.ts`, not a picture-side concern.
  - **vs. `pen` (canonical short-a distractor, similar long-thin shape):** `mop` has a **distinct fringe / yarn head** at one end; `pen` has a **pointed metal nib** at one end. The fringe-vs-nib disambiguation is the load-bearing detail. If the mop's fringe reads as too sparse at 96pt, regenerate with denser strands.
  - **vs. `pan` (canonical, kitchen rhyme-family neighbour):** `mop` is **vertical handle + fringe**; `pan` is **horizontal disc + single long handle**. Silhouettes are categorically different.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **household cleaning mop, viewed in three-quarter standing-against-wall pose, a long vertical wooden handle in soft warm-brown (#5C3F31 family) extending most of the frame's height, a fringe / yarn mop-head at the bottom end made of soft warm-cream or soft-rose strands hanging downward (8-12 visible strands of equal length), a small simple metal collar where the head meets the handle, NO bucket, NO cleaning fluid, NO floor scene, just the mop as a standalone object** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). Palette: warm pastels — soft pinks, peaches, creams, warm browns, soft mauve, soft sage — no saturated primary colors, no neon, no pure black. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon illustration. **The mop has a CLEAR FRINGE / YARN HEAD with visible individual strands hanging downward — the strands are the disambiguating feature; without them the shape would read as a stick or a broom or a pen. NO smiling face on the mop, NO eyes on the mop — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Smiling mop face, anthropomorphised mop, mop-with-eyes (Midjourney's "happy cleaning supplies" prior).
  - Bucket, cleaning fluid, floor scene, water puddles, soap suds — strip all environment.
  - Broom-style stiff bristles instead of soft fringe — must read as soft yarn / rag strands, not stiff broom hairs (a broom would also be `/uː/` not short-o, but the silhouette confusion is what matters).
  - Photorealistic janitorial mop with metal head — kept illustrated and friendly.
  - Text on the handle (brand names, "MOP" labels).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-mop.svg`.
  - SVG canvas: viewBox `0 0 200 200` (matches `pic-dog.svg` and the canonical pack convention).
  - Expected fill colors: 4-5 (handle warm-brown, fringe warm-cream or rose, optional collar contour, shadow companion).
  - Expected line count: ~10-15 vector paths after SVGO simplification.
  - Target file size: **< 30 KB** per `picture-pack-style-anchor.md` §6 (PWA cache budget per `reference_pwa_asset_size_limits` memory).
- **Notes:** The current silhouette in `wordPictures.tsx` (`case 'mop'`, lines 1228-1263) uses 7 vertical strands of varying length on a horizontal bar. The Midjourney target should preserve that "rectangular-head-with-hanging-strands" silhouette so the picture upgrade reads as a refinement of the silhouette Marian has already seen — not as a category change. Strands-of-equal-or-near-equal-length read cleaner at 96pt than wildly-uneven strands.

---

### 2.2 `box` — object — `/ɒks/` rhyme family (with `/ks/` decoding note)

- **Vocabulary cue:** Closed cardboard box, three-quarter view, top + front + one side face all visible, simple tape line. The cuboid silhouette + cardboard color carries "box" recognition.
- **Distinctness check:**
  - **vs. `bag` (canonical, similar carry-thing semantic):** `box` is **rigid cuboid with three flat faces visible**; `bag` is **soft fabric tote with a single arching handle and slouchy folds**. Silhouettes are categorically different — geometric cuboid vs. soft handle-shape.
  - **vs. `tag` (canonical, similar paper/card semantic):** `box` is **3D cuboid with depth**; `tag` is **2D parallelogram-with-string-loop**. Different visual category — volume vs. flat.
  - **vs. `fox` (short-o pool sibling, `/ɒks/` rhyme):** `box` is **inanimate cuboid**; `fox` is **animal**. No silhouette risk.
  - **No FORBIDDEN_PAIR entry needed** — both checks pass.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **closed cardboard shipping box, viewed in three-quarter perspective so the top face, the front face, and one side face are ALL clearly visible, the box is a simple cuboid in soft warm-cardboard-brown (#C8946C family) with a slightly darker side face for cel-shading depth (#9C6B3A family), a single horizontal cream / soft-tape line across the top showing the closure seam, a vertical seam line down the front face showing the closed flap, NO printed labels, NO shipping addresses, NO postal stamps, NO branding, NO text on the box, NO open lid, NO contents visible, just a clean closed simple cardboard box** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with cardboard-brown body — desaturated illustrated browns, NOT photographic kraft-paper, NOT saturated red-brown. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded edges (corners slightly softened, NOT sharp angular). Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The box is a CLOSED CARDBOARD CUBOID with three visible faces and a simple tape seam — the closed-cuboid-with-tape silhouette is the recognition cue. NO open lid, NO contents inside, NO smiling face on the box.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Open lid, visible contents (the silhouette must read as a closed object; an open box reads as "container with stuff" instead).
  - Printed labels, shipping addresses, postal stamps, fragile-stickers, brand markings — strip all text.
  - Photorealistic kraft-paper texture, weathered creases, photo-rendered cardboard.
  - Sharp angular corners — soften slightly per the pack's "rounded forms" rule.
  - Anthropomorphised box (smiling face on the box, eyes on the box) — pure object render.
  - Box-as-gift with ribbon (would read as `gift`, not `box`) — keep plain cardboard.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-box.svg`.
  - SVG canvas: viewBox `0 0 200 200`.
  - Expected fill colors: 3-4 (front face brown, top face slightly lighter brown, side face slightly darker brown, optional tape line cream).
  - Expected line count: ~6-10 vector paths after SVGO.
  - Target file size: **< 20 KB** (geometric subject; lower than animal/figure subjects).
- **Notes:** The current silhouette in `wordPictures.tsx` (`case 'box'`, lines 1265-1315) uses three rectangular/polygon faces with three brown tones (`#C8946C` / `#A88060` / `#9C6B3A`) — those exact hex values are good Phase 3 trace targets. **First-encounter Emma scaffolding** ("Box. The x sounds like /ks/.") per `short-o-pool-expansion.md` §1 is delivered via TTS, not via the picture — picture stays text-free.

---

### 2.3 `mom` — person — `/ɒm/` rhyme family

- **Vocabulary cue:** Two-figure composition — adult parent on the left holding a small child's hand on the right. Mirrors the canonical `dad` composition (per `wordPack.ts` `FORBIDDEN_PAIRS` `['mom', 'dad']`) so the pair is silhouette-similar **by design** — the discriminator is hair-length + outfit.
- **Distinctness check (this is the load-bearing constraint for this entry):**
  - **vs. `dad` (canonical, FORBIDDEN_PAIR partner):** Both are two-figure parent-with-child compositions. **Discriminator on the picture side is two-fold: (1) hair length — `mom` has shoulder-length or longer hair; `dad` has short close-cropped hair. (2) outfit silhouette — `mom` wears an A-line dress or skirt that flares at the hem (wider at hem than at shoulders); `dad` wears straight-leg pants (consistent width).** These two discriminators must BOTH be visible at 96pt. Without both, Marian could read either picture as either word — that's the silhouette-collision the FORBIDDEN_PAIR rule guards against, but the picture-side discriminators are what make the rule's job easier.
  - **vs. `man` (canonical):** `mom` is **two-figure parent-with-child**; `man` is **standalone single figure**. Same composition discriminator as `dad`-vs-`man`.
  - **No additional FORBIDDEN_PAIR entries beyond `['mom', 'dad']`** which is already in `wordPack.ts` per the short-o spec.
- **Per `project_spec_drift_decisions` L (Thomas-locked):** Stylised silhouette-figure with **minimal facial detail** so the parent doesn't compete with Emma's character role. Same minimal-face rule as `man` and `dad`.
- **Full prompt:**

> **Two-figure composition**, centered, square 1:1. A child-friendly illustrated **stylised cartoon adult woman (the mom) standing on the left, holding a small stylised cartoon child's hand on the right — a parent-with-child composition mirroring the dad composition with mirror-balanced visual weight. The mom is the taller figure with shoulder-length-or-longer warm-dark-brown hair (#5C3F31), wearing a soft warm-cream or soft-rose A-line dress or pleated skirt-and-top combination (the dress / skirt clearly flares wider at the hem than at the shoulders — this A-line silhouette is the disambiguator from dad's straight-leg pants); the child is the shorter figure on the right with simple casual clothing (small dress in soft yellow or shorts in soft yellow), warm cream skin tone, hair shown but smaller. Both figures use MINIMAL facial detail (eyes drawn as two small soft dots each, no detailed nose, soft mouth line as a small upward arc), warm friendly posture, hands clearly held together between them. The figures stand side-by-side, both facing the viewer, weight even.** Drawn in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Skin tone: warm cream (#F5DCC9). Hair: warm dark brown (#5C3F31). Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment. **The composition is a parent-and-child pair — TWO figures holding hands — mirror-matching the dad composition with the disambiguator being the mom's longer hair AND the A-line dress / skirt silhouette. Both discriminators must be visible.** **MINIMAL facial detail on both figures so they do not compete with Emma the teacher who appears elsewhere in the app.** Single composition, no second pair, no text. Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Single-figure rendering (no child) — must be two figures.
  - Heels / makeup / detailed-female-styling (would tip stylisation toward "marketed feminine archetype" and shift gendered rendering imbalance with `dad`). Keep neutral and warm.
  - Pants-on-mom + short-hair-on-mom combination (collapses the discriminators against `dad`).
  - Detailed facial features competing with Emma — must stay minimal-dot-eyes per `man` / `dad` lock.
  - Skirt patterned with florals or hearts (decoration adds noise; keep solid soft-rose or soft-cream).
  - Pregnant mom or mom holding a baby (would read as a different composition); keep child-walking-beside.
  - Family scene (background, household items) — strip environment.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-mom.svg`.
  - SVG canvas: viewBox `0 0 200 200`.
  - Expected fill colors: 6-8 (skin warm-cream, hair warm-brown, mom dress rose-or-cream, child outfit yellow-sparkle, contour deep-brown, plus shadow companions).
  - Expected line count: ~25-35 vector paths after SVGO (two figures = roughly 2× the path count of single-figure subjects).
  - Target file size: **< 30 KB** — at the upper end of the budget; if the trace exceeds 30 KB, simplify the dress folds / hair detail before exceeding it.
- **Notes:** **This is the highest-risk subject in the pack.** Risks: (a) Midjourney generates single-figure, (b) the A-line dress silhouette doesn't land clearly enough to discriminate from `dad`'s pants, (c) facial features get rendered too detailed and compete with Emma. Budget extra iterations per `picture-pack-iteration-plan.md` §6 escalation ladder. **Generate `mom` AFTER `dad` is locked in the short-a pack** so Phase 2 review can place the two side-by-side and verify the at-a-glance discrimination at 96pt.
  The current silhouette in `wordPictures.tsx` (`case 'mom'`, lines 1317-1376) uses an A-line trapezoid for the dress, hair as a soft cap reaching shoulders, child in yellow on the right. Phase 3 trace target: preserve that compositional shape; refine the rendering quality.

---

### 2.4 `hot` — object/property — `/ɒt/` rhyme family

- **Vocabulary cue:** Steaming bowl — open bowl with three rising steam-curls. The steam-curls + bowl carry "hot" recognition; the bowl is the "hot thing", the steam is the "is hot" property.
- **Distinctness check (this is the load-bearing constraint for this entry):**
  - **vs. `pot` (short-o pool sibling, semantic + silhouette neighbour):** `hot` is an **open bowl + visible steam-curls rising upward**; `pot` is a **deep cylinder + two short side-handles + no steam, no contents**. **Two discriminators must BOTH land:** (1) `hot` shows steam, `pot` does not; (2) `hot` is a shallow open bowl (wider than deep), `pot` is a tall deep cylinder (deeper than wide), and `pot` has the two visible side-handles. The wide-shallow-vessel-with-steam vs. tall-cylinder-with-handles split is the silhouette-discrimination at 96pt. **Recommend a new `FORBIDDEN_PAIR` entry `['hot', 'pot']` if Phase 2 review confirms the silhouettes still feel close after generation** — see §6 below.
  - **vs. `cup` (canonical short-a distractor, vessel semantic):** `hot` has **steam rising and no handle**; `cup` has **a single curved side handle and an open empty top, no steam**. Distinct.
  - **vs. `pan` (canonical):** `hot` is **shallow open bowl, no handle**; `pan` is **shallow round disc + single long horizontal handle**. Distinct.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple wide shallow ceramic or pottery bowl filled to the brim with hot food, viewed in three-quarter perspective so the rim of the bowl is visible as an ellipse and the side wall of the bowl is visible below, the bowl is wider than it is deep (definitely shallow / wide proportions, NOT a deep pot, NOT a tall cylinder), soft warm-cream or soft-rose bowl color, NO side handles on the bowl (NOT a cooking pot), THREE visible steam curls rising upward from the bowl rim — the curls are clean simple S-shaped curves in soft warm-grey or soft-cream rendering steam visually (the steam is the heat indicator), the curls rise to roughly the bowl's height again above the rim, NO printed pattern on the bowl, NO chopsticks, NO spoon, NO food details inside (the rim is shown as soft contents-color but no recognizable noodles or ingredients)** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bowl is SHALLOW AND WIDE (NOT deep, NOT a cooking pot), has NO SIDE HANDLES, and has THREE CLEAR RISING STEAM CURLS above the rim — these together carry "hot" recognition. The shallow-wide-vessel-plus-steam silhouette must distinguish it cleanly from a pot (which has a deep cylinder body and two side handles).** **NO smiling face on the bowl, NO eyes on the bowl, NO face on the steam, NO faces on the curls — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Steaming pot with handles — that would render as `pot`, defeating the discrimination.
  - Deep-cylinder bowl shape — must read as wide-and-shallow, not deep.
  - Visible food (noodles, soup ingredients, rice) — would read as "noodles" or "soup" rather than "hot"; keep the bowl's content abstract.
  - Spoons, chopsticks, ladles inside or beside the bowl — strip all utensils.
  - Steam-curls drawn as clouds with faces, anthropomorphised steam (Midjourney's children's book "happy steam" attractor).
  - Photorealistic ramen bowl, food-photography rendering.
  - Hot drink in a mug (would read as `cup`, not `hot`); keep it as a wide bowl.
  - Saturated chili-pepper red on the bowl contents — palette stays warm-pastel.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-hot.svg`.
  - SVG canvas: viewBox `0 0 200 200`.
  - Expected fill colors: 4-5 (bowl base soft-cream or soft-rose, rim slightly darker, three steam curls in soft warm-grey, optional bowl-content soft-rose accent at rim).
  - Expected line count: ~10-14 vector paths after SVGO.
  - Target file size: **< 25 KB**.
- **Notes:** Per `short-o-pool-expansion.md` §1 (Q2 outcome locked in PR #150), `hot` is the chosen 8th word (not `dot`). The picture-grounds-the-property approach (steaming bowl = "hot thing") is the same logical move as `jam` (jam-in-a-jar = "jam"); the picture chip stably depicts the noun-form of the adjective. **Pair-discrimination from `pot` is the load-bearing distinctness in this whole pack** — budget extra iterations on this and on `mom`.
  The current silhouette in `wordPictures.tsx` (`case 'hot'`, lines 1378-1425) uses a wide trapezoid bowl with three S-shaped steam curls rising upward. Phase 3 trace target: preserve that "wide-bowl + three S-curves" silhouette.

---

## 3. Quick reference — pack index

| # | Word | Type | Pack neighbour requiring discrimination | Picture-side discriminator |
| --- | --- | --- | --- | --- |
| 1 | mop | new short-o target | `mom` (m-o-_ onset), `pen` (long thin object) | fringe head; non-figure object |
| 2 | box | new short-o target | `bag`, `tag` (paper/carry semantics) | rigid 3-face cuboid; volume not flat |
| 3 | mom | new short-o target | **`dad` (FORBIDDEN_PAIR — same composition by design)**, `man` (single-figure) | longer hair + A-line dress / skirt silhouette; two-figure |
| 4 | hot | new short-o target | **`pot` (silhouette + semantic neighbour)**, `cup` (vessel) | shallow wide bowl + three rising steam curls; no side handles |

**Highest-distinctness-risk pair in this pack: `hot` ↔ `pot`.** Both are vessels for cooking. The shallow-wide-with-steam vs. tall-deep-with-side-handles split is what makes them readable as different words at 96pt. Phase 2 review at chip size is mandatory for this pair before acceptance.

**Composition-pair-by-design: `mom` ↔ `dad`.** They are intentionally similar (both two-figure parent-with-child) so the FORBIDDEN_PAIR rule keeps them out of the same trio, and the hair-length + outfit discriminators carry the per-picture distinctness.

---

## 4. Generation order recommendation

Per `picture-pack-iteration-plan.md` §3 — same surface-the-hardest-cases-early principle:

1. **`mom`** first — highest-risk subject (composition discriminator vs. `dad`). If `mom` doesn't land in 5 generations, abort and re-route per the iteration plan §6.3 hard-fall fallback. Generate AFTER short-a `dad` is locked so the discriminator can be A/B-checked side-by-side at 96pt.
2. **`hot`** second — second-highest risk (silhouette discriminator vs. `pot`). Generate alongside the short-a `pot` re-trace if practical, so both can be reviewed in pair.
3. **`box`** third — geometric subject, low-risk; lock the cuboid + cardboard rendering.
4. **`mop`** fourth — household object, low-risk; lock the fringe-head silhouette.

If Thomas opts to bundle this pack with the short-a pack's eventual Midjourney session (recommended per `probe-word-picture-pack.md` §2 logic — bundle for style coherence), insert these four into the existing iteration order:

- After short-a `dad` is locked (Tier B step 10), run `mom` immediately so the pair can be A/B-reviewed.
- After short-a `pot` is locked (Tier D step 22 in the short-a iteration plan, or wherever `pot` slots in given the short-a re-trace pass), run `hot` immediately for the same reason.
- `box` and `mop` slot into Tier C/D wherever convenient — neither is forbidden-pair-pressured.

---

## 5. Acceptance criteria for Phase 2 selection (Thomas-side)

Each generation in this pack must pass ALL of these gates before Thomas accepts and saves the source PNG. These mirror `picture-pack-prompts.md` §4 plus per-row distinctness gates specific to this pack.

### 5.1 Style-cohesion gates (same as short-a pack)

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style preamble honored: line weight ~2 px at 1024×1024, palette warm-pastel, line color warm-dark-brown not pure black, background solid soft cream flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only (or in `mom`'s case, single composition only — the parent-and-child pair counts as one composition).
- [ ] No text, no watermark, no signature, no logo, no UI overlay anywhere in the image.
- [ ] No anthropomorphism (`mop`, `hot`, `box` are pure objects with no faces; `mom` is a stylised human figure with minimal-detail face per the pack rule).
- [ ] Visual cohesion with the locked short-a pose-zero (typically `dog`) — line weight, palette, shading style match.

### 5.2 Per-word distinctness gates (load-bearing for this pack)

- [ ] **`mop`:** Fringe / yarn-strand head clearly visible at 96pt; cannot be mistaken for `pen` (no nib), `pan` (no disc), or a generic stick.
- [ ] **`box`:** Three visible faces (top, front, side); closed; no contents visible; cannot be mistaken for `bag` (no handle) or `tag` (volume, not flat).
- [ ] **`mom`:** TWO figures in the composition (NOT one — auto-fail on single-figure renders); shoulder-length-or-longer hair on the parent; A-line / flared-hem dress or skirt silhouette on the parent; minimal-detail face on both figures; child holds parent's hand. **At 96pt side-by-side with `dad`, the hair-length + outfit discriminators are both readable.**
- [ ] **`hot`:** THREE visible rising steam curls above the bowl rim; shallow-and-wide bowl proportions (NOT deep, NOT a cylinder); NO side handles on the bowl. **At 96pt side-by-side with `pot`, the steam-curls + shallow-bowl vs. no-steam + tall-cylinder-with-handles discrimination is both readable.**

### 5.3 "Regenerate" triggers

If any of the following appear, regenerate (do not proceed to trace):

- Anthropomorphised mop, anthropomorphised bowl, smiling steam.
- Steaming pot rendered for `hot` (silhouette collision with `pot`).
- Single-figure `mom` (no child).
- `mom` rendered with pants + short hair (collapses dad-discriminator).
- Open box with visible contents.
- Photorealistic / 3D-rendered output (tightening `--style raw` per `picture-pack-iteration-plan.md` §5 drift table).
- Saturated primary colors, neon, pure black, sepia.
- Text on any subject (mop handle, box label, dress, bowl rim).

---

## 6. Out of scope

- **The 4 promoted-from-distractor short-o words** (`dog`, `log`, `pot`, `fox`) — already shipped as silhouettes (and `dog` as a real SVG). Their Midjourney-and-trace pass belongs to the short-a pack's eventual cohesion pass (per `picture-pack-prompts.md` §1 and the short-a README §"Why not o/u/e/i in v1"). Do not regenerate them under this pack's scope.
- **Phase 2 generation itself** — this is a Phase 1 prompt sheet. Thomas runs MJ in Phase 2.
- **Phase 3 SVG trace and `wordPictures.tsx` integration** — Devon or Kevin owns this PR.
- **Code changes to `wordPack.ts`, `wordPictures.tsx`, or canon files** — the silhouettes already exist and PR #151 is shipping them. No code changes in this pack.
- **Cross-vowel distractor mixing** (e.g. mixing short-a chips with short-o targets) — out of v1 per `short-o-pool-expansion.md` §8.
- **A `['hot', 'pot']` `FORBIDDEN_PAIR` entry** — the short-o spec did not add this entry because both words come from the same focus-node and cross-vowel distractor mixing is out of v1, so the trio-collision risk is already constrained. **Flag forward:** if Phase 2 review shows the silhouettes still feel close at 96pt, file a follow-up `wordPack.ts` ticket to add `['hot', 'pot']`. Document the decision in the Phase 2 review notes.
- **Re-naming `pic-dog.svg` → `picture-dog.svg`** to match the canonical filename convention. That's a Phase 3 short-a re-trace concern, not a short-o-additions concern. Out of scope here.

---

## 7. Provenance

- **Triggering doc:** `design/word-song/short-o-pool-expansion.md` §3 ("Picture-pack additions") — flagged the forward Kyle ticket; this pack is that ticket's deliverable.
- **Style preamble + universal parameters + locked attributes:** `design/word-song/picture-pack-style-anchor.md` §2 + §3.
- **Workflow + drift table + escalation ladder:** `design/word-song/picture-pack-iteration-plan.md` §3 + §5 + §6.
- **Per-row prompt structure inheritance:** `design/word-song/picture-pack-prompts.md` (short-a pack) — this pack mirrors that file's row format.
- **Word-list lock:** `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_SHORT_O` (`'dog, mop, log, pot, box, fox, mom, hot'`). The 4 wholly-new words are `mop, box, mom, hot`.
- **Q1 / Q2 / Q3 lock:** PR #150 (2026-05-04) — Q1 keep `box`/`fox` with `/ks/` scaffolding, Q2 `hot` over `dot`, Q3 sibling node naming.
- **Silhouette source-of-truth:** `src/screens/WordSong/wordPictures.tsx` lines 1228-1425 — the four silhouettes Phase 3 will replace.
- **FORBIDDEN_PAIRS source-of-truth:** `src/screens/WordSong/wordPack.ts` — `['mom', 'dad']` already added per PR #151 / AC5 of the short-o spec.
- **Phase 3 trace requirements:** `design/word-song/picture-pack-style-anchor.md` §6.
- **PWA cache budget:** `reference_pwa_asset_size_limits` memory — 4 MiB cache cap drives < 30 KB per SVG target.
- **Locked memories:** `project_pic_dog_svg` (SVG vector for all CVC pictures), `project_spec_drift_decisions` L (`man` / `dad` minimal-detail mitigation — extends to `mom`), `project_planner_parser_contract` (no parser change here, picture-pack only).
