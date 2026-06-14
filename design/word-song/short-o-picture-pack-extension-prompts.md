# Word Song — short-o picture-pack EXTENSION Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready (v6-era authoring shape; see banner).
**Predecessor specs:** [`design/word-song/short-o-pool-extension.md`](./short-o-pool-extension.md) (this PR — defines the 3-word extension + picture-pack scope), [`design/word-song/short-o-picture-pack-prompts.md`](./short-o-picture-pack-prompts.md) (sibling MJ prompt sheet — original 4 wholly-new short-o words; this file mirrors its structure exactly), [`design/word-song/picture-pack-style-anchor.md`](./picture-pack-style-anchor.md) (style frame, locked), [`design/word-song/short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md) (most-recent MJ prompt sheet, format precedent), [`design/word-song/picture-pack-iteration-plan.md`](./picture-pack-iteration-plan.md) (workflow + drift table — inherited).

> **⚠️ v6-era spec — new packs use the v7 template.** This prompt sheet carries the retired v6 parameter stack (`--cref`/`--sref`/`--cw 80` + `--v 6 --style raw --s 250` + `--ar 1:1` + the universal `--no` block). It is **kept as-is for provenance** — do not re-author from it. For any NEW pack, use the v7 default in [`picture-pack-iteration-plan.md`](./picture-pack-iteration-plan.md) §2 (four-pattern template) + §3 (per-word `--no` recipe); the v6 stack is documented as retired in that plan's §10. The v7-distilled paste-ready version of THIS pack is [`mj-prompts-paste-ready-2026-05-10.md`](./mj-prompts-paste-ready-2026-05-10.md) (PR #189) — prefer it for the actual generation session.

---

## 0. Scope — exactly 3 words (extension only, not full retrace)

This pack covers the **3 wholly-new short-o targets that this extension PR ships** to bring the short-o pool from 8 → 11 words (cross-vowel-mode floor):

> **`cot`, `top`, `pop`.**

**The other 8 short-o words** — `dog, mop, log, pot, box, fox, mom, hot` — already shipped via PR #156 with their final picture assets. **No re-trace in this pack's scope.** PR #156's pack is locked.

**Total generations needed for this pack: 3** (or 4 if Phase 2 fallback to `cob` fires per §2.4 — see also pool-extension spec §3.5 + §AC7).

**Total SVG file additions after Phase 3: 3.** No overwrites of existing short-o picture files.

**Single MJ session for visual cohesion.** Per pool-extension spec §4 ("MJ prompt sheet for the new words — single MJ session for visual cohesion with the existing short-o pack"), Thomas runs all 3 (or 4 with the standby) in one MJ session so they look like visual siblings of the existing 8 short-o + 14 short-a + 11 short-u + 4 short-a probes (37 picture chips on disk). Pack-cohesion lever (§1.3) does the structural work; same-session generation ensures any MJ-side stochastic drift hits the new 3 uniformly rather than splitting them across sessions.

---

## 1. Style anchors — derived from existing pack

This section names what makes the existing short-a + short-o + short-u pictures look like one illustrator made them — copied byte-for-byte from `picture-pack-style-anchor.md` §2 + §3 so the three short-o additions land as visual siblings, not visual rivals. **No deviation for this pack.** Marian must not be able to detect "the new words arrived" by visual style — that would corrupt the same-screen layout cohesion the pool-extension spec §4 deliberately preserves.

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
| Anthropomorphism   | None on objects (no smiling cot, no smiling top, no smiling lollipop); see §3.7 + §1.4 anti-list                                                                                                                 | style-anchor §3.7 |

### 1.3 Pack-cohesion lever — `--cref` / `--sref` to short-a `dog` pose-zero

Per `picture-pack-iteration-plan.md` §1.1, the canonical pose-zero is short-a `dog`. This pack inherits that pose-zero — same as PRs #156 / #170 / future packs.

Every generation appends:

```
--cref <short-a-dog-pose-zero-url> --cw 80 --sref <short-a-dog-pose-zero-url>
```

Use the SAME `dog` pose-zero URL Thomas captured during the short-a / short-o / short-u packs' Phase 2 sessions. Pack-wide style cohesion across the whole eventual 40-picture corpus (14 short-a + 4 probe + 11 short-o post-extension + 11 short-u) is the goal.

If the dog pose-zero URL has been lost between sessions, re-derive it per `picture-pack-iteration-plan.md` §1 BEFORE running this pack. Do not run this pack standalone — that produces a 3-picture island that won't match the existing 37-picture corpus.

### 1.4 Universal trailing parameters (append to every prompt in this pack)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face, smiling mop, smiling bowl, mop with face, bowl with face, steam with face, smiling bug, bug with human face, smiling jug, jug with face, smiling bun, bun with face, smiling tub, tub with face, smiling rug, rug with face, smiling hut, hut with face, smiling gum, gum with face, smiling nut, nut with face, smiling cot, cot with face, smiling top, top with face, smiling pop, lollipop with face, smiling lollipop, motion blur, spinning blur, weapon, gun, knife, blade
```

**Delta from short-u pack:** added `smiling cot, cot with face, smiling top, top with face, smiling pop, lollipop with face, smiling lollipop, motion blur, spinning blur` to negate the per-subject anthropomorphism attractors specific to this pack. The `motion blur` / `spinning blur` additions specifically target `top` — Midjourney's "spinning top" prior often pulls toward a motion-trail render that defeats chip-readability at 96pt. Lollipop-with-face is a common Midjourney attractor for candy subjects; explicit negation prevents it.

---

## 2. Per-word entries

The format per row mirrors the short-u pack:

```
WORD — vocabulary cue — distinctness check — full prompt — negatives — asset spec — notes
```

Each "full prompt" is paste-ready — the style preamble from §1.1 is inlined verbatim. Append the trailing parameters from §1.4 to every prompt.

---

### 2.1 `cot` — household — `/ɒt/` rhyme family

- **Vocabulary cue:** A small portable single-bed with a simple wood frame, a thin mattress, and a single pillow. The low-rectangular-frame-with-mattress-and-pillow silhouette carries "cot" recognition vs. tub, hut, mat.
- **Distinctness check:**
  - **vs. `pot` (short-o sibling, `/ɒt/` rhyme partner):** `cot` is **horizontal sleeping-furniture (low rectangular frame + mattress + pillow)**; `pot` is **deep cylinder cooking vessel + two side handles**. Categorically different — sleeping vs. cooking. **No risk** at 96pt.
  - **vs. `hot` (short-o sibling, `/ɒt/` rhyme partner):** `cot` is **bed**; `hot` is **steaming bowl**. Different categories. **No risk.**
  - **vs. `tub` (short-u, both household-bathroom-scale):** `tub` is **free-standing footed vessel (vertical-tall depth)**; `cot` is **horizontal sleeping-platform (low + flat + with pillow)**. The orientation flip (tub vertical-tall, cot horizontal-flat) is the disambiguator. **Same-vowel-only rule keeps them apart in v1 trios.** Cross-pack visual hygiene is stable. **Low risk.**
  - **vs. `hut` (short-u, both architectural-ish):** `hut` is **dwelling with roof + walls + door (architectural)**; `cot` is **bed (sleeping-furniture, no roof, no walls)**. Different categories. **No risk.**
  - **vs. `mat` (short-a, both flat-rectangular):** `mat` is **2D thin flat rug**; `cot` is **3D bed-frame with vertical depth** (mattress on top of legs, pillow rising at one end). Different dimensionality. **Low risk** with same-vowel constraint.
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple small portable single-bed cot, viewed in three-quarter perspective so the long side and one short side are both visible, the cot has a SIMPLE LOW WOODEN FRAME (rectangular, four short legs at the corners, the legs in soft warm-brown #5C3F31 family), a SOFT THIN MATTRESS on top of the frame in soft warm-cream or soft warm-rose with a slightly darker rim along the edges, a SINGLE WHITE OR SOFT-CREAM PILLOW at one end of the cot rising slightly above the mattress level (the pillow is the load-bearing recognition cue distinguishing it from a generic bench or stool), gentle cel-shading on the right side, NO blanket, NO sheets, NO bedroom scene, NO walls, NO floor pattern, NO baby on the cot, NO toys on the cot, just the cot on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-brown frame. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms (corners slightly softened, NOT sharp angular). Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The cot is a SMALL LOW BED with a CLEAR PILLOW at one end and a CLEAR THIN MATTRESS — pillow + mattress + low rectangular frame together carry "cot" recognition. NO smiling face on the cot, NO eyes on the pillow, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Bunk bed / double bed / king-size bed (would read as "bed" not "cot" — keep it small, single, low).
  - Crib with vertical bars / nursery scene (reads as "crib" or "baby"; keep it open-frame, more cot-than-crib).
  - Hospital bed with side rails (reads as "hospital").
  - Sleeping figure on the cot (introduces second subject; cot is the subject).
  - Bedding tucked-in / pillow detailed with embroidery (visual noise; keep pillow plain).
  - Camp / military folding cot with cross-bracing (overly mechanical — keep it warm-domestic).
  - Photorealistic mattress texture or wood-grain rendering.
  - Sharp angular legs (palette stays soft + rounded).
  - Saturated red or saturated blue mattress.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-cot.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size.
  - Final SVG file size: target **~50–100 KB** (PNG-in-SVG embed; per `.claude/docs/skill-trees-and-content.md` §"Path 2").
- **Notes:** Vocab-stretch entry — Tagalog primary is _kuna_ (crib) / _kama_ (bed). The picture-grounds-the-meaning rule applies (same logical move as `hot`, `mom`, `jam` in prior packs). The pillow is the load-bearing recognition cue at 96pt — without it, the silhouette could read as a bench / stool / low-table. If Phase 2 generates a cot without a clearly-visible pillow, regenerate with the pillow emphasised.

---

### 2.2 `top` — object — `/ɒp/` rhyme family

- **Vocabulary cue:** A classic spinning-toy top — inverted cone with a pointed tip at the bottom and a wider rounded crown at the top, typically with a decorative stripe pattern around the crown. **Picture must commit to spinning-toy referent**, not "top of" or "shirt-top". The cone-with-point silhouette carries "top" recognition.
- **Distinctness check:**
  - **vs. `box` (short-o sibling, both geometric objects):** `top` is **cone (vertical with tapered point at one end)**; `box` is **cuboid (square-ish with three flat faces visible)**. Categorically different shapes. **No risk.**
  - **vs. `mop` (short-o sibling, `/ɒp/` rhyme partner):** `mop` is **vertical handle + fringe/yarn head at the bottom**; `top` is **inverted cone with point at the bottom and crown at the top, no handle, no fringe**. Different shapes. **No risk.**
  - **vs. `pop` (short-o pack neighbour, `/ɒp/` rhyme partner — also new in this pack):** `top` is **cone-toy with point at bottom (no stick)**; `pop` is **sphere-on-stick lollipop**. Different shapes — the stick-vs-no-stick is the disambiguator. **Low risk** when both follow their picture-briefs; flag for Phase 2 review when the two new chips are A/B'd at 96pt.
  - **vs. `hat` (short-a, both triangular silhouettes):** `hat` is **head-covering with brim + crown (point-up via crown at top, broad at bottom via brim)**; `top` is **inverted cone (point-DOWN at the bottom, broad at the top)**. The orientation flip is the disambiguator. **Same-vowel-only rule keeps them apart in v1 trios.** Cross-pack visual hygiene is stable; cross-vowel-mode hazard flag for matrix author (Kevin's `86c9m3aek` impl ticket): avoid `[hat, top]` in `TARGET_PAIRINGS_CROSSVOWEL`. Documented in pool-extension spec §5.
  - **vs. `hut` (short-u, both have triangular silhouettes):** `hut` is **dwelling with roof + walls + door (architectural triangle on rectangular base)**; `top` is **pure inverted cone with tapered tip, no walls, no door**. Door + walls discriminate. **Low risk** with same-vowel constraint.
  - **No FORBIDDEN_PAIR entry needed v1.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **classic wooden or painted spinning-toy top, viewed in three-quarter perspective at REST (NOT spinning, NO motion-blur, NO motion-trail), the top is an INVERTED CONE shape — wider rounded crown at the top and a single small POINTED TIP at the bottom (the pointed tip is the load-bearing recognition cue and rests on the implied surface), the body color in soft warm-rose or soft warm-cream with optional ONE OR TWO simple decorative stripe bands wrapping horizontally around the crown in a contrasting soft warm tone (peach, sage, or soft mauve), a small simple round button or knob centered on the top-flat face of the crown (the "winder" knob — keeps the top reading as a TOY rather than as a generic cone), gentle cel-shading on the right side, NO motion blur, NO spinning lines, NO floor scene, NO hand spinning the top, NO box / packaging, just a single spinning-toy top at rest** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The top is a CLASSIC SPINNING TOY — inverted cone with a CLEAR POINTED TIP AT THE BOTTOM and a CLEAR WIDER ROUNDED CROWN AT THE TOP, with a small knob centered on the top face. The pointed-tip-at-bottom + winder-knob-at-top together carry "spinning toy" recognition and disambiguate from a generic cone (e.g., ice-cream cone, party hat). NO smiling face on the top, NO eyes — pure toy render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Motion blur / motion-trail / spinning-effect lines — the chip is the toy at REST, not in motion.
  - Hand spinning the top (introduces second subject).
  - Top inside a glass dome / display case (introduces second subject).
  - Multiple tops / collection of tops (single subject only).
  - Ice-cream cone (would also be inverted cone — needs the winder-knob to disambiguate).
  - Party hat (ALSO inverted cone with a point — keep the toy reading by including the winder-knob, mid-stripe pattern, and rounded crown; party hats have a sharp point and conical body without the rounded crown).
  - Photorealistic wood-grain or polished-paint rendering.
  - Saturated primary red / yellow / blue (palette stays warm-pastel).
  - Top-with-face anthropomorphism.
  - Beyblade / modern-spinner ring (overly detailed — keep classic-toy simple).
  - Sharp angular cone (corners stay slightly softened).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-top.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** Vocab-stretch entry — spinning tops are not as common in 2026 Manila as in mid-20th-century, but the toy is universal in international picture-books. The winder-knob at the top is the load-bearing detail at 96pt that distinguishes "spinning toy top" from "ice-cream cone" or "party hat" — both also being inverted cones. **The MJ "spinning top" prior strongly pulls toward motion-trail rendering; the universal trailing parameters explicitly negate `motion blur, spinning blur` to suppress this attractor.** If Phase 2 generates a top with motion-trail, regenerate with stronger negative weight on motion.

---

### 2.3 `pop` — food — `/ɒp/` rhyme family

- **Vocabulary cue:** A simple round lollipop on a stick — a sphere of soft pastel candy color on a plain white or soft-cream straight stick. **Picture-brief commits to lollipop referent** — sphere-on-stick is the silhouette carrying "pop" recognition; without the stick, the sphere alone could read as `cup` or `bun` ambiguously (per pool-extension spec §3 audit + §5 hazard catalogue).
- **Distinctness check (load-bearing — picture-brief discipline IS the mitigation):**
  - **vs. `cup` (short-u, brief flag was `pop ↔ cup` ambiguity):** `pop` is **sphere on a STICK (no handle, no opening)**; `cup` is **handled vessel with open top (no stick, has handle)**. **The stick is the load-bearing disambiguator.** At 96pt, sphere-on-stick is categorically different from handled vessel — but ONLY if the stick is rendered clearly visible. If MJ drops or shortens the stick, the sphere alone collides with cup. **Picture-brief discipline is the mitigation.**
  - **vs. `bun` (short-u, both food + round):** `bun` is **round bread roll with horizontal cross-seam on top, no stick**; `pop` is **sphere candy on a stick**. The stick is again the disambiguator. **Low risk** when picture-brief is followed.
  - **vs. `nut` (short-u, both food):** `nut` is **oval shell with vertical seam line, no stick**; `pop` is **sphere candy on a stick**. Different shapes (oval-with-seam vs. sphere-with-stick). **Low risk.**
  - **vs. `gum` (short-u, both food + small + sweet):** `gum` is **wrapped chewing-gum stick (rectangular wrapper)**; `pop` is **sphere on stick (round candy ball + thin stick)**. Different shapes. **Low risk.**
  - **vs. `tub` (short-u, both vessel-ish at silhouette):** `tub` is **large free-standing footed vessel**; `pop` is **small sphere on stick**. Categorically different. **No risk.**
  - **vs. `mop` (short-o sibling, `/ɒp/` rhyme partner):** `mop` is **long vertical handle + fringe head at bottom**; `pop` is **short stick + sphere at top**. The proportion flip is the disambiguator (mop is 80% handle 20% head; pop is 50% stick 50% sphere). **Low risk.**
  - **vs. `top` (short-o pack neighbour, `/ɒp/` rhyme partner — also new in this pack):** `top` is **inverted cone with point at bottom (no stick attached)**; `pop` is **sphere on stick (no point, no cone)**. Different shapes. **Low risk** when both follow their picture-briefs; flag for Phase 2 review when the two new chips are A/B'd at 96pt.
  - **No FORBIDDEN_PAIR entry needed v1** — picture-brief discipline carries the mitigation.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple round LOLLIPOP CANDY on a stick, viewed in three-quarter perspective so the round candy sphere AND the stick BOTH visible, the candy is a single ROUND SPHERE in soft warm-rose or soft warm-cream candy color (NOT saturated primary red, NOT neon) with a simple optional spiral pattern OR a soft inner highlight on the upper-left from cel-shading, a CLEAR THIN STRAIGHT WHITE OR SOFT-CREAM STICK extending downward from the bottom of the candy sphere (the stick is roughly the same length as the sphere's diameter, or slightly longer — visible as a long thin rectangular shape, NOT cut off by frame, NOT hidden behind the sphere), a small simple junction where the stick meets the sphere, NO wrapper, NO multiple lollipops, NO candy-jar / candy-display, NO hand holding the lollipop, just a single lollipop on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The lollipop is a SINGLE SPHERE-ON-A-STICK — the stick is the LOAD-BEARING DISAMBIGUATOR. The stick must be CLEARLY VISIBLE, of substantial length, and clearly attached at the bottom of the sphere; without the stick the silhouette collapses into "ball" or "cup" or "bun" ambiguity. NO smiling face on the lollipop, NO eyes — pure candy render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Stick missing or barely visible — would collapse to "ball" or "cup" (the silhouette-collision risk).
  - Wrapped lollipop with twisted-cellophane wrapper (keeps it simpler — bare candy on stick).
  - Multiple lollipops / candy-bowl / candy-jar / candy-display (single subject only).
  - Photorealistic glossy candy with deep specular highlights.
  - Saturated primary red / saturated yellow / saturated blue (palette stays warm-pastel).
  - Spiral candy ("rainbow swirl" lollipop) with high-contrast color rings — could compete visually with `top`'s decorative stripe; keep the candy soft + simple.
  - Hand holding the lollipop (introduces second subject).
  - Lollipop-with-face anthropomorphism (Midjourney candy-with-face attractor).
  - Soda cup with bubbles (the "pop" = soda misreading).
  - Popsicle on stick (frozen flat-rectangular ice-pop) — would also be on a stick but the wrong shape; keep it as a ROUND sphere lollipop.
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-pop.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** **The stick is the load-bearing distinguisher of this entry**. Per pool-extension spec §3 audit + §AC7 + §10 Q3, the Phase 2 fallback path is: if the lollipop chip's stick collapses at 96pt (either cropped by remove.bg, or rendered too thin, or visually merged into the sphere), Devon's Phase 3 step substitutes `cob` (corn cob) — see §2.4 below for the standby `cob` prompt. **Phase 2 review at chip size is mandatory for this entry.** Generate `pop` AFTER `top` is locked in this MJ session so the pair (`top` cone-with-point + `pop` sphere-on-stick) can be A/B'd at 96pt — the visual sibling check confirms both their respective load-bearing details (`top`'s winder-knob + `pop`'s stick) survive PNG compression cleanly.

---

### 2.4 `cob` — STANDBY (Phase 2 fallback for `pop`)

**Standby — only generate if `pop` Phase 2 review fails per §2.3 notes + pool-extension spec §AC7 / §10 Q3.**

- **Vocabulary cue:** Corn-on-the-cob — a yellow cylinder of corn kernels with a partial green husk peeled back at one or both ends. The yellow-cylinder-with-kernels-and-husk silhouette carries "cob" recognition.
- **Distinctness check:**
  - **vs. `log` (short-o sibling, both cylindrical):** `log` is **brown wood cylinder with bark texture**; `cob` is **yellow corn cylinder with kernel pattern + green husk peel-back**. Different colors (brown vs. yellow + green) and different surface textures (bark vs. kernels). **Low risk.**
  - **vs. `box` (short-o sibling, both food-adjacent geometric):** `box` is **cardboard cuboid**; `cob` is **yellow cylinder**. Different shapes. **No risk.**
  - **vs. `nut` (short-u, both food + brown-warm):** `nut` is **small oval shell**; `cob` is **larger yellow cylinder**. Different shapes + colors. **No risk.**
  - **vs. `bun` (short-u, both food):** `bun` is **round bread-roll**; `cob` is **elongated yellow cylinder**. Different shapes. **No risk.**
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt (only run if the `pop` fallback fires):**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single corn-on-the-cob, viewed in three-quarter perspective so the long cylinder body and one end are both visible, the body is a YELLOW cylinder covered in regular ROWS OF SOFT-OVAL KERNELS in soft warm-yellow / soft-cream color (the kernels are visible as a regular grid of small ovals across the cylinder surface — they are the load-bearing recognition cue), a partial GREEN HUSK peeled back at the bottom end (or one end) showing the yellow kernels above, the husk in soft-sage or soft-mint green with a slightly darker shadow companion, gentle cel-shading on the right side, NO whole-corn-cob with intact husk covering everything (the kernels need to be visible), NO cooking pot, NO butter, NO plate, NO multiple cobs, just a single corn-on-the-cob on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated yellow body + soft-sage green husk. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The cob is a YELLOW CYLINDER with VISIBLE KERNEL ROWS and a PARTIAL GREEN HUSK peeled back at one end — kernels + husk together carry "corn-on-cob" recognition. NO smiling face on the corn, NO anthropomorphism.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Whole corn with husk fully covering the kernels (kernels must be visible to disambiguate from a generic green-husk-leafy-thing).
  - Buttered corn / steaming corn (introduces second visual element).
  - Corn in a pot (would conflate with `pot`).
  - Multiple cobs / corn-bunch / cornfield.
  - Photorealistic kernel rendering with shine.
  - Saturated primary yellow (palette stays warm-pastel).
  - Corn-with-face / smiling cob.
  - Kettle corn / popcorn / processed corn.
- **Asset spec output (Phase 3 — only on fallback):**
  - Filename: `public/assets/pictures/picture-cob.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **Standby entry — only generate if `pop` Phase 2 review fails.** Pool-extension spec §3 audit had `cob` rejected for vocab-stretch (Tagalog _mais_) but the picture grounds the meaning. If Devon's Phase 3 step fires the substitution, the pool-extension spec is amended in a follow-up PR to swap `pop → cob`. The substitution is documented in pool-extension spec §10 Q3 — Thomas's confirmation is requested before Kevin's impl ticket dispatches.

---

## 3. Generation order — recommended sequence

Run all 3 generations in a single MJ session (with the optional `cob` standby ready) for visual cohesion:

1. **`cot` first** — lowest risk, geometric simplicity, no anthropomorphism attractor. Gets the pack's first visual sibling on disk and validates the `--cref` / `--sref` is hitting the same dog pose-zero as PRs #156 / #170.
2. **`top` second** — generate AFTER `cot` is confirmed visually-cohesive. The `top` MJ prior pulls toward motion-blur; multiple regenerations may be needed. The negative-list discipline (§1.4) handles most of the attractor; reinforcement via inline negative ("NOT spinning, NO motion-blur") inside the prompt body further suppresses.
3. **`pop` third** — generate AFTER `top` is locked. Phase 2 review at 96pt for `pop` IS the gate. A/B `pop` against `top` to confirm the stick-vs-no-stick + sphere-vs-cone disambiguation holds at chip size.
4. **`cob` standby** — only if `pop` fails Phase 2. Run as a fourth generation in the same session; falls back per pool-extension spec §AC7.

Total expected MJ time: ~30–60 min for the 3 (or 45–80 min if `cob` standby fires), plus ~15–30 min for remove.bg transparent-export. Comparable to PR #150's short-o original 4-pack cadence.

---

## 4. Phase 3 integration handoff (Devon)

After Thomas's MJ session and remove.bg transparent-export, the source PNGs land at:

```
MarianLearning/design/references/picture-pack/transparent/cot.png
MarianLearning/design/references/picture-pack/transparent/top.png
MarianLearning/design/references/picture-pack/transparent/pop.png
MarianLearning/design/references/picture-pack/transparent/cob.png  # only if pop fallback fires
```

**Devon's Phase 3 step:**

```pwsh
cd MarianLearning
yarn embed-pictures design/references/picture-pack/transparent public/assets/pictures
```

The script wraps each PNG into an `<svg><image href="data:image/png;base64,...">` shell at the canonical filename `picture-{word}.svg`. Per `.claude/docs/skill-trees-and-content.md` §"Two embed-pipeline gotchas":

1. **Worktree drift on `transparent/` source PNGs** — Devon's PR is authored in the impl-ticket's worktree, not the canonical main-repo path. Before running `yarn embed-pictures`, md5-check the source PNG against the canonical main-repo path OR explicitly `cp` the canonical PNG into the worktree's same path as a first step.
2. **Embed script auto-emits ALL PNGs in the input dir** — make sure the `transparent/` directory contains ONLY the 3 (or 4 with fallback) target PNGs at the time of the run; out-of-scope source PNGs (e.g., a future short-i candidate) WILL produce unintended SVG output. Best practice: empty the `transparent/` directory before placing the new pack's PNGs.

`wordPictures.tsx` requires NO change — the existing shared switch arm (`<image href="/assets/pictures/picture-${pictureKey}.svg">`) handles the new keys automatically per `.claude/docs/skill-trees-and-content.md` §"Coverage state (post-PR #157)."

If Phase 2 fallback to `cob` fires, the substitution requires:

- `wordPack.ts TARGET_WORDS` swap `pop` → `cob` (re-typed `vowel: 'o'`, `pictureKey: 'cob'`, `category: 'food'`).
- `wordPack.ts TARGET_PAIRINGS` swap `pop`'s row → `cob`'s row with same-vowel-only short-o distractors.
- `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_SHORT_O` swap `'pop'` → `'cob'`.
- Canon JSON re-bake.
- Pool-extension spec PR follow-up amendment (not in scope of Devon's PR; Matt files).

---

## 5. Out of scope (this prompt sheet)

- **Re-trace of the existing 8 short-o pictures.** PR #156 pack is locked.
- **Re-trace of the short-a, probe-pack, or short-u pictures.** All locked.
- **Stylistic deviation from the inherited style anchor.** The §1.1 style preamble is byte-for-byte re-use; deviation breaks pack cohesion across the 40-picture corpus.
- **`hop` MJ generation.** Verb-class rejection per pool-extension spec §3 audit; not in scope.
- **Wider candidate pool generation (`dot, sock, lock, clock, etc.`).** Not in scope; only `cot, top, pop` (+ `cob` standby) are spec'd.
- **Cross-vowel mode picture-pack work.** No such work exists; same-vowel-only rule applies to v1 short-o pool-extension.

---

## 6. Provenance

- **Triggering doc:** `design/word-song/short-o-pool-extension.md` (this PR — defines the 3-word extension).
- **Style anchor:** `design/word-song/picture-pack-style-anchor.md` (locked).
- **Format precedent:**
  - `design/word-song/short-o-picture-pack-prompts.md` (sibling — original 4 wholly-new short-o words).
  - `design/word-song/short-u-picture-pack-prompts.md` (most-recent — 11 short-u words including 3 retraces).
- **Path 2 PNG-in-SVG embed pipeline:** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" (Path 2).
- **Embed-pipeline gotchas:** `.claude/docs/skill-trees-and-content.md` §"Two embed-pipeline gotchas" (verified 2026-05-09 during PR #170).
- **Pack-cohesion lever:** `design/word-song/picture-pack-iteration-plan.md` §1.1 (`--cref` / `--sref` to short-a `dog` pose-zero).
- **PWA asset budget:** `reference_pwa_asset_size_limits` memory (`vite.config.ts maximumFileSizeToCacheInBytes: 4 MiB` — ~3.4 MB current short-u-pack-end + 300 KB extension = ~3.7 MB total, comfortable headroom).
- **Cross-vowel mode pool-size floor:** `design/word-song/cross-vowel-mix-spec.md` §6 ("≥ 11 entries each before cross-vowel mode fires").
- **Dave's research scope-note:** `design/research/cross-vowel-discrimination-threshold.md` §"Recommendations" (PR #175).
