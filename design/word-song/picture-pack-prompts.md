# Word Song picture pack — per-word Midjourney prompts

**Audience:** Thomas (Midjourney operator, phase 2).
**Author:** Marian Tutor design persona.
**Ticket:** `86c9kww0h`.
**Status:** Locked prompt sheet — paste-ready.

This is the row-per-word prompt sheet for the v1 picture pack. **22 pictures total** — 14 CVC short-a target words + 8 distractor-only pictures. Each row is a paste-ready Midjourney prompt that combines the locked style preamble (`picture-pack-style-anchor.md` §2) with subject-specific content.

**Workflow per `picture-pack-iteration-plan.md`:**

1. Generate `dog` first (the locked-style reference — see iteration plan §Pose-zero).
2. Once `dog` is locked, generate the remaining 21 pictures using `--cref <dog-image-url>` + `--sref <dog-image-url>` to anchor character/style consistency.
3. Append the universal Midjourney parameters from §0 to every prompt.
4. Append the universal `--no` block from §0 to every prompt.

---

## 0. Universal trailing parameters (append to every prompt)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face
```

After the first generation locks (per iteration plan), append `--cref <reference-image-url> --cw 80 --sref <reference-image-url>` to every subsequent prompt.

**Why `--cw 80`:** The character/style reference is non-negotiable for visual cohesion, but each subject is genuinely different (a cat is not a bus). 80 leaves room for the per-subject content while keeping line weight, palette, line color, and shading style locked.

**Why `--style raw`:** Reduces Midjourney's default beautification (which tends to push toward generic-pretty / saturated / over-rendered). Same lesson as Emma's prompt sheet §3.2.

**Why `--s 250`:** Manhwa lives in the 150-400 stylize range. 250 is the sweet spot per Thomas's PR #98 + #108 generation passes. Same as Emma.

---

## 1. Per-word prompt rows (14 target words)

The format per row:

```
WORD — vocabulary cue — forbidden-pair distinguisher — full prompt — notes
```

Each "full prompt" string can be pasted directly into Midjourney. The style preamble is inlined verbatim from `picture-pack-style-anchor.md` §2 — copy the whole prompt as one block, do not abbreviate the preamble.

---

### 1.1 `cat` (target — animal — `/æt/` rhyme family)

- **Vocabulary cue:** Pointed-up triangular ears, whiskers (3 strokes per side), narrow muzzle, tail curled at base, sitting upright. **The ears + whiskers carry "cat" recognition for an L2 8yo.**
- **Forbidden-pair distinguisher:** `cat` ↔ `dog` — pointed-up ears + whiskers (cat) vs floppy/rounded ears + no whiskers (dog).
- **L2/cultural fit:** Strong. Marian read `cat` cold in the diagnostic. Tagalog `pusa`.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **domestic short-haired cat sitting upright in a friendly three-quarter view, with pointed-up triangular ears, visible whiskers (three strokes per side), narrow rounded muzzle, small pink nose, soft tabby-grey or warm-cream coat, gentle eyes open and warm, tail curled around the base of its body** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). Palette: warm pastels — soft pinks, peaches, creams, warm browns, soft mauve, soft sage — no saturated primary colors, no neon, no pure black. Object-specific colors allowed but always desaturated and illustrated, never photographic. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop, no decorative elements behind the subject. Single subject only — no other figures, no text, no labels, no signage, no logos, no UI overlays, no watermarks. Friendly tone, large-eyed, rounded forms, soft-natural proportions. Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon illustration. **The cat must clearly read as a cat and NOT as a bunny or a dog — pointed triangular ears (not floppy, not round), whiskers visible, narrow muzzle (not broad).** Drawn for a children's vocabulary book.

- **Notes:** Most-tested chip in v1 (gentle-tier and trap-tier matrix anchor). If the cat-vs-bunny test fails at 96pt, re-emphasize "pointed triangular ears, NOT floppy" — Midjourney's "cute cat" prior occasionally drifts toward bunny-shaped ears.

---

### 1.2 `hat` (target — clothing — `/æt/` rhyme family)

- **Vocabulary cue:** Wide-brimmed sun hat with visible brim, ribbon/band detail. **The brim carries "hat" recognition.**
- **Forbidden-pair distinguisher:** `hat` ↔ `cap` — wide brim all the way around (hat) vs forward-only peak/visor (cap).
- **L2/cultural fit:** Strong. Marian read `hat` correctly. Tagalog `sumbrero`.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **soft pastel wide-brimmed sun hat with a simple ribbon band around the crown, viewed in three-quarter perspective so the round crown and full circular brim are both visible, no head wearing it, just the hat as object, soft cream or rose color** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The hat is a wide-brim sun hat (NOT a baseball cap, NOT a beanie, NOT a top hat) — the wide circular brim is the defining feature.** Drawn for a children's vocabulary book.

- **Notes:** Must visibly differ from `cap` at 96pt. The wide round brim is the load-bearing feature.

---

### 1.3 `bat` (target — animal — `/æt/` rhyme family)

- **Vocabulary cue:** Wings spread (visible on both sides), small rounded body, big friendly eyes, soft purple or grey color. **Wings carry "bat" recognition.**
- **Forbidden-pair distinguisher:** Distinct from `cat` via wings (cat has no wings); distinct from baseball-bat by being clearly the flying animal.
- **L2/cultural fit:** Medium. Filipino fruit bats (`paniki`) are familiar but the English word may be new. Picture carries it.
- **Per `project_spec_drift_decisions` K (Thomas-locked):** Sanrio-style friendly with big eyes, no fangs.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **cute friendly cartoon flying bat (the animal — NOT a baseball bat), wings spread fully open and visible on both sides, small rounded body, large warm friendly eyes, small soft smile (NO fangs, NO sharp teeth, NO pointed teeth visible), soft purple or soft warm-grey color, no Halloween or scary elements, in a Sanrio-style friendly cute aesthetic with big-eyed warmth — friendly cartoon bat like Kuromi-style cute, NOT horror-movie bat, NOT vampire bat** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels, soft purple-grey body. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The bat is the FLYING ANIMAL with spread wings, NOT a baseball bat — the wings are the disambiguating feature.** Drawn for a children's vocabulary book.

- **Notes:** **Critical to NOT show as scary or fanged** — Marian (8yo, Filipino cultural context) doesn't have the Halloween-bat association, but Thomas locked friendly-Sanrio-style explicitly. If a generation shows fangs or shadowy/spooky vibes, regenerate. If the result still drifts after 3 generations, fall back to `tan` or `gas` per the open question in the predecessor pack — but flag to Matt before substituting; the wordlist is locked in `_plannerWordList.ts` so substitution requires a coordinated server + client edit.

---

### 1.4 `mat` (target — household — `/æt/` rhyme family)

- **Vocabulary cue:** Rectangular flat woven object, simple stripe or dot pattern, slight three-quarter perspective so it reads as 3D. **The weave pattern carries "mat" recognition (vs generic rectangle).**
- **Forbidden-pair distinguisher:** None in v1 — `mat` doesn't share a forbidden-pair entry, but must visually differ from any rug/carpet drawn elsewhere. Stay simple.
- **L2/cultural fit:** Medium-strong. Filipino `banig` (woven mat) is deeply familiar; English word may be new but picture carries it.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple rectangular woven mat (a small bath mat or doormat), viewed in slight three-quarter perspective so it reads as flat-on-the-floor with a hint of depth, soft cream or warm-rose base color, simple horizontal stripe pattern OR small dot pattern visible across the surface, soft fringed or smooth edge, no decorative monogram or text** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with one soft shadow indicating depth. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat — distinct from the mat's base color so the mat reads as foreground. Single subject only — no other figures, no text. **The mat is a simple woven mat with a visible weave or stripe pattern — NOT a generic rectangle, NOT a yoga mat, NOT a doormat with "WELCOME" text.** Drawn for a children's vocabulary book.

- **Notes:** Choose a base color that contrasts cleanly against the cream background so the mat doesn't dissolve into the backdrop. If the woven texture reads as too detailed for vector tracing, simplify to 2-3 horizontal stripes.

---

### 1.5 `bag` (target — object — `/æg/` rhyme family)

- **Vocabulary cue:** Tote-style fabric bag with single handle, soft fabric folds, no logos. **The handle silhouette carries "bag" recognition.**
- **Forbidden-pair distinguisher:** None in v1, but visually distinct from `tag` (rhyme-family neighbor) — bag has body-with-handle silhouette, tag has card-with-string silhouette.
- **L2/cultural fit:** Strong. Tagalog `bag` direct loanword.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **soft pastel tote-style fabric bag, viewed in three-quarter view, with a single soft fabric handle arching over the top, soft fabric folds suggesting a slightly slouchy bag (not stiff or boxy), soft rose or warm-cream color, NO logos, NO text, NO buckles or hardware, NO pockets, just a simple fabric tote** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The bag is a fabric tote bag (NOT a backpack, NOT a paper grocery bag, NOT a purse with a metal clasp, NOT a briefcase) — the single soft fabric handle is the defining feature.** Drawn for a children's vocabulary book.

- **Notes:** A backpack would compete with future short-i word `bin` if that ever ships, plus reads heavier than the simple-tote we want. Stick with the soft tote.

---

### 1.6 `fan` (target — household — `/æn/` rhyme family)

- **Vocabulary cue:** Pedestal electric fan with visible blades inside a circular guard, simple base, vertical neck. **Pedestal-fan silhouette is the load-bearing recognition cue — Filipino household standard per Dave's research.**
- **Forbidden-pair distinguisher:** None in v1, but visually distinct from `pan` (kitchen rhyme-family neighbor) — fan is vertical pedestal, pan is horizontal flat with handle.
- **L2/cultural fit:** Very strong. Per Dave's phonics-sequence memo §Q2: "fan (electric fan is universal in Filipino homes)."
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **electric pedestal fan, viewed in three-quarter view, with a circular front grille (showing the soft suggestion of three blades behind it, NOT detailed), a vertical neck/post, a simple round base, soft warm-grey or cream color body, the grille rendered as a simple circular outline with light radiating spokes (NOT a detailed mesh)** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The fan is an ELECTRIC PEDESTAL FAN (NOT a hand-held folding fan, NOT a ceiling fan, NOT a small lamp). NO smiling face on the fan, NO eyes on the fan — pure object render.** Drawn for a children's vocabulary book.

- **Notes:** Filipino-specific cultural anchor per Dave. Pedestal fan over hand-held folding fan because pedestal is the everyday Marian-vocabulary read. Fan-anthropomorphism is a known Midjourney drift — explicitly negate.

---

### 1.7 `man` (target — person — `/æn/` rhyme family)

- **Vocabulary cue:** Adult male standing figure, neutral clothing (t-shirt + jeans), warm friendly stance. **Standalone single-figure silhouette carries "man" recognition.**
- **Forbidden-pair distinguisher:** `man` ↔ `dad` — `man` is **standalone single figure**; `dad` is **two-figure parent-with-child** composition.
- **L2/cultural fit:** Medium. Tagalog `lalaki`. Picture carries the English word.
- **Per `project_spec_drift_decisions` L + `word-song-picture-pack.md` §Per-word brief #7:** stylised silhouette-figure with minimal facial detail (eyes as small dots, no nose, soft mouth line) so he doesn't compete with Emma's character role.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **stylised cartoon adult man standing in a relaxed, friendly, weight-even stance, viewed front-on or slight three-quarter, simple casual clothing (plain t-shirt in soft warm color and simple straight-leg jeans in soft blue-grey), warm cream skin tone (#F5DCC9), warm dark brown hair (#5C3F31) in a simple short style, MINIMAL facial detail (eyes drawn as two small soft dots, no detailed nose, soft mouth line as a small upward arc), no facial hair, no glasses, no accessories** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. **Single character only — ONE figure, standing alone, no second figure, no child accompanying.** **The face uses MINIMAL detail (small dots for eyes, no detailed face) so this character does not compete with Emma the teacher who appears elsewhere in the app — this is a low-detail silhouette-style figure, NOT a fully rendered character.** No text. Drawn for a children's vocabulary book.

- **Notes:** Critical that this is a SINGLE-figure render so the silhouette is distinct from `dad`'s parent-with-child composition. If Midjourney adds a second figure, regenerate.

---

### 1.8 `pan` (target — kitchen — `/æn/` rhyme family)

- **Vocabulary cue:** Round shallow disc with a single long handle extending right, viewed three-quarter from above. **The single-long-handle silhouette carries "pan" recognition.**
- **Forbidden-pair distinguisher:** `pan` ↔ `pot` — pan has **single long handle and shallow round disc**; pot has **two short handles on opposite sides and deep cylinder body**.
- **L2/cultural fit:** Strong. Filipino `kawali`.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **frying pan (a shallow round flat-bottom cooking pan), viewed in three-quarter perspective from above so the round flat surface is visible AND the single long handle extending to the right is clearly visible, soft warm-grey or matte-cream color body, NO food inside, NO contents, NO oil, just an empty clean pan, the handle is a single long cylindrical handle (NOT two short handles)** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels, soft warm-grey body. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The pan has a SINGLE LONG HANDLE — this is the defining feature that distinguishes it from a pot. The pan is shallow, NOT deep.** Drawn for a children's vocabulary book.

- **Notes:** Single-handle-long is the load-bearing distinguisher from `pot`. Make sure handle reads at 96pt — angle it 30-45° to the right of frame so the silhouette is clear.

---

### 1.9 `cap` (target — clothing — `/æp/` rhyme family)

- **Vocabulary cue:** Baseball cap with a forward-projecting peak/visor, rounded crown, no logo. **The forward peak carries "cap" recognition (vs hat's all-around brim).**
- **Forbidden-pair distinguisher:** `cap` ↔ `hat` — cap has **forward peak only**; hat has **wide brim all the way around**.
- **L2/cultural fit:** Strong. Universal.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **baseball cap, viewed in three-quarter front-side perspective so the rounded crown AND the forward-projecting peak/visor are both clearly visible, soft warm-rose or soft-blue color, simple stitched panels suggested with light contour lines, NO team logo, NO embroidered text, NO words on the cap, just a clean simple baseball cap shape** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The cap is a BASEBALL CAP with a forward peak/visor — this distinguishes it from a wide-brim sun hat. NO wide circular brim; the peak goes forward only.** Drawn for a children's vocabulary book.

- **Notes:** Must visibly differ from `hat`. The forward-peak silhouette is the load-bearing distinguisher. Soft-rose color matches the palette and is gender-neutral.

---

### 1.10 `can` (target — object — `/æn/` rhyme family)

- **Vocabulary cue:** Cylindrical metal can with visible top (ring-pull) and band/label area. **The cylindrical can-shape with visible ring-pull on top carries "can" recognition.**
- **Forbidden-pair distinguisher:** None in v1, but visually distinct from `cup` (similar cylinder) — can has flat ring-pull top; cup has open top + handle.
- **L2/cultural fit:** Strong. Tagalog `lata`.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **soft drink can or simple food can, viewed in three-quarter perspective, cylindrical shape with a visible flat top showing a simple ring-pull tab, a clean band/label wrapping the middle of the can in a soft pastel color (soft rose or soft sage or soft blue), NO brand name, NO logo, NO text on the label, the band is a simple solid color stripe** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The can has a VISIBLE RING-PULL TAB on the flat top — this is what distinguishes it from a cup (which has an open top and a handle).** Drawn for a children's vocabulary book.

- **Notes:** Ring-pull tab on top is the load-bearing detail. Without it, a plain cylinder reads ambiguously as cup/jar/candle at 96pt.

---

### 1.11 `tag` (target — object — `/æg/` rhyme family)

- **Vocabulary cue:** Paper-card price/gift tag with a string loop at the top, slight three-quarter tilt. **The string loop carries "tag" recognition.**
- **Forbidden-pair distinguisher:** None in v1, but visually distinct from `bag` (rhyme-family neighbor) — tag is small card-with-string; bag is body-with-handle.
- **L2/cultural fit:** Medium. Recognisable from price tags on clothing.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple paper price tag or gift tag, viewed slightly tilted so it reads as 3D, rectangular paper card shape with a single round hole punched at the top, a soft cotton string looped through the hole, soft cream or warm-rose card color, NO printed price, NO text, NO writing on the card, just a simple blank tag, the string is a soft beige cotton loop hanging down or off to one side** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The tag is a small paper card with a STRING LOOP at the top — the string loop is the defining feature; without it the shape would read as a flag or a flat card.** Drawn for a children's vocabulary book.

- **Notes:** String loop is the load-bearing detail. If the tag base color is too close to the cream background, edge contour will save it but better to choose a soft contrasting tone (warm-rose works).

---

### 1.12 `dad` (target — person — `/æd/` rhyme family)

- **Vocabulary cue:** Adult male figure holding a child's hand (parent-with-child composition). **The two-figure parent-with-child silhouette carries "dad" recognition and distinguishes from `man`.**
- **Forbidden-pair distinguisher:** `dad` ↔ `man` — `dad` is **two-figure parent-with-child**; `man` is **standalone single figure**.
- **L2/cultural fit:** Strong. Marian uses `dad` / Tagalog `tatay` daily.
- **Per `project_spec_drift_decisions` L + `word-song-picture-pack.md` §Per-word brief #12:** parent-with-child pose, minimal facial detail to not compete with Emma.
- **Full prompt:**

> **Two-figure composition**, centered, square 1:1. A child-friendly illustrated **stylised cartoon adult man (the dad) standing on the left, holding a small stylised cartoon child's hand on the right — a parent-with-child composition. The dad is the taller figure, casual clothing (soft-color t-shirt and simple jeans, soft warm-cream skin tone, warm dark brown hair); the child is the shorter figure, simple casual clothing (small dress or soft t-shirt and shorts), warm cream skin tone, hair shown but smaller. Both figures use MINIMAL facial detail (eyes drawn as two small soft dots each, no detailed nose, soft mouth line as a small upward arc), warm friendly posture, hands clearly held together between them. The figures stand side-by-side, both facing the viewer, weight even.** Drawn in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. **The composition is a parent-and-child pair — TWO figures holding hands — explicitly distinguishing this picture from a standalone single-man render.** **MINIMAL facial detail on both figures so they do not compete with Emma the teacher who appears elsewhere in the app.** No text. Drawn for a children's vocabulary book.

- **Notes:** **Two-figure composition is the load-bearing distinguisher from `man`.** If the model produces a single-figure render, regenerate. Hands held between the two figures is the visual cue for the parent relationship — without it, the composition reads as "man + child" generic, not "dad". If `dad` consistently fails to land cleanly across 5 generations, fall back to dropping `dad` and substituting per the predecessor pack's open question — but that requires a coordinated server + client wordlist edit.

---

### 1.13 `jam` (target — food — `/æm/` rhyme family)

- **Vocabulary cue:** Glass jar with lid, contents (jam) visible through glass as soft red/pink, simple band label. **The visible jam contents through glass carry "jam" recognition.**
- **Forbidden-pair distinguisher:** None in v1, but visually distinct from `can` (`/æn/` neighbor) — jam jar is glass with visible contents, can is opaque metal cylinder.
- **L2/cultural fit:** Medium. Less central in Filipino diet but recognizable on bread.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **glass jar of jam, viewed in three-quarter perspective, round glass jar shape with the soft red-pink jam contents visible through the clear glass (the jam fills about 80% of the jar from the bottom up), a soft warm-cream metal lid on top, a simple band-style paper label wrapping the middle of the jar in a soft cream color, NO brand name, NO printed text, NO writing on the label, just a clean simple jam jar** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. The glass is rendered with a single soft highlight contour suggesting transparency. Palette: warm pastels, with the soft red-pink jam contents being slightly more saturated than the rest of the palette but still NOT photographic-red. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The contents (jam) must be VISIBLE through the glass — this is the defining feature.** Drawn for a children's vocabulary book.

- **Notes:** Visible-through-glass contents are the load-bearing recognition cue. The jam's pink-red color also visually anchors "fruit preserve / jam" as a category. Avoid making the lid too prominent — it should read as a jar of jam, not as a lidded container.

---

### 1.14 `van` (target — vehicle — `/æn/` rhyme family)

- **Vocabulary cue:** Boxy delivery/family van shape, side view, two windows, two visible wheels, no logos. **The boxy short-vehicle shape with two windows distinguishes from a bus.**
- **Forbidden-pair distinguisher:** `van` ↔ `bus` — `van` is **shorter, two windows, more car-like proportions**; `bus` is **longer, multiple windows (3+), distinctive flat front**.
- **L2/cultural fit:** Strong. Tagalog uses `van` directly.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple delivery van or family panel van, viewed in three-quarter front-side perspective, boxy short-vehicle proportions (NOT long like a bus), exactly TWO windows visible on the side (one front cabin window, one passenger compartment window — NOT 3 or more windows), two visible wheels, soft warm-rose or soft pastel-blue body color, simple side door visible, NO logos, NO printed text, NO brand markings, just a clean simple van shape** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The van has TWO windows on the side and short car-like proportions — this distinguishes it from a bus, which is longer with 3+ windows.** **NO smiling face on the van, NO eyes on the van — pure object render.** Drawn for a children's vocabulary book.

- **Notes:** Two-windows-only is the load-bearing distinguisher from `bus`. If Midjourney adds a smiley face, regenerate.

---

## 2. Per-word prompt rows (8 distractor-only pictures)

These pictures appear only as distractors, never as the target word. Same style preamble, same trailing parameters.

---

### 2.1 `bus` (distractor-only — vehicle — `/ʌs/`)

- **Vocabulary cue:** Long vehicle with multiple windows along the side, distinctive flat or rounded front, two or more visible wheels. **The length + multi-window count carries "bus" recognition.**
- **Forbidden-pair distinguisher:** `bus` ↔ `van` — `bus` is **longer, 3+ windows, recognizable bus front**; `van` is **shorter, 2 windows**.
- **L2/cultural fit:** Strong. Tagalog `bus` direct loanword.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple school bus or city bus, viewed in three-quarter front-side perspective, long vehicle proportions (NOT short like a van), at least 3 visible windows along the side AND a distinctive flat or gently-rounded bus front (with two front headlights, no driver visible), two visible wheels, soft pastel-yellow or soft warm-cream body color (a school-bus yellow but desaturated to warm-cream-yellow #F4D89B), NO logos, NO printed text, NO route number, just a clean simple bus shape** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The bus has 3+ WINDOWS on the side and is LONGER than a van — these are the distinguishing features. NO smiling face on the bus, NO eyes — pure object render.** Drawn for a children's vocabulary book.

- **Notes:** Yellow desaturated to warm-cream-yellow keeps the palette family. Pure school-bus yellow is too saturated.

---

### 2.2 `sun` (distractor-only — celestial — `/ʌn/`)

- **Vocabulary cue:** Round disc with simple radiating rays, soft warm yellow with rose tint. **The radiating rays carry "sun" recognition.**
- **Forbidden-pair distinguisher:** None.
- **L2/cultural fit:** Strong. Marian knows `sun` cold.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple sun, viewed front-on, a round disc center with simple radiating triangular rays (8-12 rays evenly distributed around the disc), the disc and rays are a soft warm yellow with a slight rose tint (#F4D89B blending toward soft-rose at the edges), NO face on the sun, NO eyes, NO smile — pure abstract sun shape, gentle and friendly via shape and warmth alone** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat — the sun must contrast cleanly against the cream background; soften the sun toward warm-yellow if needed to differ from cream. Single subject only — no other figures, no text. **NO face on the sun — pure shape, no smile, no eyes. Same rule as the rest of the pack: no anthropomorphism.** Drawn for a children's vocabulary book.

- **Notes:** Earlier draft (`word-song-picture-pack.md` §Distractor-only) allowed an optional friendly face; v1 locks no-face for pack consistency. Sun-with-face is anthropomorphism; the rest of the pack bans it; sun shouldn't be the exception.

---

### 2.3 `dog` (distractor-only — animal — `/ɔ/`)

- **Vocabulary cue:** Friendly dog sitting upright, floppy or rounded ears, broader muzzle than cat, tail visible. **Floppy/rounded ears + broader muzzle distinguish from `cat`.**
- **Forbidden-pair distinguisher:** `dog` ↔ `cat` — dog has **floppy or rounded ears, broader muzzle, NO whiskers or minimal**; cat has **pointed-up triangular ears, narrow muzzle, visible whiskers**.
- **L2/cultural fit:** Strong. Marian read `dog` cold.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **friendly dog sitting upright in a friendly three-quarter view, with FLOPPY or rounded soft ears (NOT pointed-up triangular like a cat), a broader rounded muzzle (NOT narrow like a cat), soft warm-brown or warm-cream coat, gentle warm eyes open and friendly, tail visible curled at the side or behind the body, small soft mouth in a gentle relaxed expression** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels, soft warm-brown or warm-cream coat. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The dog has FLOPPY/ROUNDED EARS and a BROADER MUZZLE — these are the defining features that distinguish it from a cat. NO pointed-up triangular ears, NO whiskers (or only minimal hint of muzzle texture, no obvious whisker strokes).** Drawn for a children's vocabulary book.

- **Notes:** **The current `pic-dog.svg` is the only real shipped picture in v1.** Per README §Word list scope, recommendation is to re-generate `dog` so all 22 pictures share one Midjourney session's stylization, then phase 3 traces all 22 — rather than mixing the existing `pic-dog.svg` with 21 fresh traces. Generate `dog` first per the iteration plan as the pose-zero reference.

---

### 2.4 `fox` (distractor-only — animal — `/ɔ/`)

- **Vocabulary cue:** Cartoon fox sitting or standing in friendly pose, soft orange-red coat, white/cream chest, pointed ears, bushy tail. **Bushy tail + orange-red coat carry "fox" recognition.**
- **Forbidden-pair distinguisher:** None v1; but visually distinct from `cat` and `dog` via the bushy tail + orange coat.
- **L2/cultural fit:** Medium. Foxes less common in Filipino context — picture must carry the meaning.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **cartoon fox sitting or standing in a friendly three-quarter view, with pointed-up triangular ears, a bushy orange-red tail clearly visible (the tail is the defining feature, fluffy and distinct), soft orange-red coat across the body and head, soft warm-cream or white chest/belly area, white-cream tail tip, gentle warm eyes open and friendly** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels with soft orange-red coat (a desaturated fox-orange #D4886A — NOT photographic-red, NOT neon-orange). Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The fox is distinguished from a cat by the BUSHY TAIL and the ORANGE-RED coat color. The tail is the defining feature.** Drawn for a children's vocabulary book.

- **Notes:** Bushy-tail + orange-coat are load-bearing. Fox-orange should be desaturated to stay in palette.

---

### 2.5 `cup` (distractor-only — vessel — `/ʌp/`)

- **Vocabulary cue:** Mug or teacup with handle, three-quarter view, simple shape. **The handle + open top carries "cup" recognition.**
- **Forbidden-pair distinguisher:** Visually distinct from `can` (similar cylinder) — cup has handle + open top; can has flat ring-pull top.
- **L2/cultural fit:** Strong. Universal.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple mug or teacup, viewed in three-quarter perspective, cylindrical body with a single curved handle on the right side, OPEN TOP visible (the cup is empty, no contents, no steam), soft warm-cream or soft-rose color, NO printed pattern, NO text on the cup, NO logo, just a simple clean cup or mug shape** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The cup has an OPEN TOP and a CURVED HANDLE — these distinguish it from a can (which has a flat ring-pull top, no handle).** Drawn for a children's vocabulary book.

- **Notes:** Handle + open top distinguish from `can`. No steam, no contents — keep clean.

---

### 2.6 `pen` (distractor-only — stationery — `/ɛn/`)

- **Vocabulary cue:** Ballpoint pen, side view, simple cylinder with a visible cap and clip, point at one end. **The clip + point carry "pen" recognition.**
- **Forbidden-pair distinguisher:** None v1.
- **L2/cultural fit:** Strong. Universal.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple ballpoint pen, viewed from the side in slight three-quarter, a cylindrical pen body in soft warm-rose or soft-blue color, a visible writing tip (small pointed metal nib) at one end, a visible cap or clip on the other end, the body is smooth simple cylinder shape (NOT a fancy fountain pen, NOT a marker)** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The pen has a VISIBLE WRITING TIP (small point) on one end and a CAP or CLIP on the other — these are the defining features. The pen is laid horizontally OR slightly diagonally across the frame for clear silhouette.** Drawn for a children's vocabulary book.

- **Notes:** Pen-as-cylinder needs the tip + clip to read as pen and not as a generic stick. Diagonal orientation helps the silhouette read.

---

### 2.7 `log` (distractor-only — object — `/ɔ/`)

- **Vocabulary cue:** Wood log lying horizontally, simple cylinder with bark texture, end-grain rings visible at one end. **Bark texture + end-grain rings carry "log" recognition.**
- **Forbidden-pair distinguisher:** None v1.
- **L2/cultural fit:** Medium. Less common in Marian's everyday vocabulary.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple wood log lying horizontally, cylindrical wood shape, soft warm-brown bark color (#5C3F31 family) with subtle vertical bark texture lines, ONE END visible showing simple concentric circular tree-rings (the cut end of the log), the other end either visible at angle or off-frame, NO leaves attached, NO small branches, just a clean simple log** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels with soft warm-brown body. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The end-grain tree-rings on one cut end carry "log" recognition (vs a generic brown stick).** Drawn for a children's vocabulary book.

- **Notes:** End-grain rings are the disambiguator from generic brown stick. Bark texture should be subtle — too detailed and it's hard to vector-trace.

---

### 2.8 `pot` (distractor-only — kitchen — `/ɔ/`)

- **Vocabulary cue:** Cooking pot with two short handles on opposite sides, deep cylindrical body, three-quarter view. **Two-handles + deep body carry "pot" recognition (vs `pan`'s single long handle + shallow disc).**
- **Forbidden-pair distinguisher:** `pot` ↔ `pan` — pot has **two short handles on opposite sides + deep cylinder**; pan has **single long handle + shallow round disc**.
- **L2/cultural fit:** Strong. Filipino `kaldero`.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **cooking pot, viewed in three-quarter perspective, deep cylindrical body (deeper than wide), exactly TWO short curved handles on opposite sides of the pot (left and right, both visible), no lid visible (or a simple flat lid sitting on top — pick one and stick with it), soft warm-grey or matte-cream color body, NO food inside, NO contents, NO steam, just an empty clean pot, NO printed pattern, NO logo** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading. Palette: warm pastels, soft warm-grey body. Background: solid soft cream (#FFF6EE) flat. Single subject only — no other figures, no text. **The pot has TWO SHORT HANDLES on opposite sides AND a DEEP cylinder body — these distinguish it from a pan (which has ONE LONG handle + a shallow round disc).** Drawn for a children's vocabulary book.

- **Notes:** Two-handle + deep are the load-bearing distinguishers from `pan`. Pick "no lid" for visual simplicity at chip size; flag to Thomas if he prefers lid-on for clarity.

---

## 3. Quick reference — full prompt index

| # | Word | Type | Rhyme family | Forbidden-pair partner |
| --- | --- | --- | --- | --- |
| 1 | cat | target | /æt/ | dog |
| 2 | hat | target | /æt/ | cap |
| 3 | bat | target | /æt/ | — |
| 4 | mat | target | /æt/ | — |
| 5 | bag | target | /æg/ | — |
| 6 | fan | target | /æn/ | — |
| 7 | man | target | /æn/ | dad |
| 8 | pan | target | /æn/ | pot |
| 9 | cap | target | /æp/ | hat |
| 10 | can | target | /æn/ | — |
| 11 | tag | target | /æg/ | — |
| 12 | dad | target | /æd/ | man |
| 13 | jam | target | /æm/ | — |
| 14 | van | target | /æn/ | bus |
| 15 | bus | distractor | /ʌs/ | van |
| 16 | sun | distractor | /ʌn/ | — |
| 17 | dog | distractor | /ɔ/ | cat |
| 18 | fox | distractor | /ɔ/ | — |
| 19 | cup | distractor | /ʌp/ | — |
| 20 | pen | distractor | /ɛn/ | — |
| 21 | log | distractor | /ɔ/ | — |
| 22 | pot | distractor | /ɔ/ | pan |

---

## 4. Acceptance criteria for phase 2 (Thomas-side)

When Thomas runs the Midjourney session in phase 2, each generation should pass these gates before being accepted:

- [ ] Subject reads as the target noun in <3 seconds without any text label.
- [ ] Forbidden-pair distinguisher (per row) is clearly visible at 1024×1024 — and would still be visible if downscaled to 96×96.
- [ ] Style preamble is honored: line weight ~2 px at 1024×1024, palette warm-pastel, line color warm-dark-brown not pure black, background solid soft cream flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no signature, no logo, no UI overlay anywhere in the image.
- [ ] No smiling face on objects (fan, bus, van, sun, mat, pan, pot — all "no anthropomorphism").
- [ ] `bat` is friendly with no fangs.
- [ ] `man` is single-figure, minimal-detail.
- [ ] `dad` is two-figure (parent-with-child), minimal-detail on both.
- [ ] Visual cohesion with the locked pose-zero reference (probably `dog`).

For the broader pack-quality gate Jessica will check post-phase-3 trace, see `README.md` §Coverage breakdown.

---

## 5. Provenance

- **Style preamble source:** `picture-pack-style-anchor.md` §2.
- **Prompt structure inheritance:** `design/character-emma-ai-prompts.md` §1 (base prompt) + §3 (negatives) + §4.1 (Midjourney syntax).
- **Word list source of truth:** `api/_plannerWordList.ts` line 22 + `src/screens/WordSong/wordPack.ts` `TARGET_WORDS` + `DISTRACTOR_ONLY_WORDS`.
- **Forbidden-pair source:** `src/screens/WordSong/wordPack.ts` `FORBIDDEN_PAIRS`.
- **Subject-specific framing notes:** `design/word-song-picture-pack.md` §"Per-word picture briefs" (predecessor pack — sourcing decision section now superseded by Thomas's Midjourney lock; the per-word framing is preserved here).
- **`bat` Sanrio-style lock:** `project_spec_drift_decisions` memory K.
- **`man` / `dad` minimal-detail lock:** `project_spec_drift_decisions` memory L.
