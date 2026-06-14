# Word Song — short-i picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready (v6-era authoring shape; see banner).
**Predecessor specs:** `design/word-song/short-i-pool-expansion.md` (this PR — defines the 11-word recommended pool and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame, locked), `design/word-song/short-u-picture-pack-prompts.md` (sibling MJ prompt sheet — this file mirrors its structure exactly), `design/word-song/short-o-picture-pack-prompts.md` (predecessor MJ sheet — short-o + short-u + short-i are visual siblings), `design/word-song/picture-pack-iteration-plan.md` (workflow + drift table — inherited).

> **⚠️ v6-era spec — new packs use the v7 template.** This prompt sheet carries the retired v6 parameter stack (`--cref`/`--sref`/`--cw 80` + `--v 6 --style raw --s 250` + `--ar 1:1` + the universal `--no` block). It is **kept as-is for provenance** — do not re-author from it. For any NEW pack, use the v7 default in [`picture-pack-iteration-plan.md`](./picture-pack-iteration-plan.md) §2 (four-pattern template) + §3 (per-word `--no` recipe); the v6 stack is documented as retired in that plan's §10. The four-pattern gotchas this template encodes (lead-with-noun, mechanism-over-recognition, clothing/textile defenses, drop-shadow negation) were first distilled from THIS pack's `bib` batch — see `.claude/docs/skill-trees-and-content.md` § "MJ prompt-engineering gotchas".

---

## 0. Scope — exactly 11 words (Q4 recommended A: full tier visual cohesion)

This pack covers **all 11 short-i targets** so they are visually cohesive within the tier (single MJ session, same model / prompts / style across every chip Marian sees on a short-i session). Per pool spec [`short-i-pool-expansion.md`](./short-i-pool-expansion.md) §10 Q1 (recommended A: ship 11 with Phase 2 fallbacks documented) and §10 Q4 (recommended A: single MJ session for tier cohesion).

**Wholly-new short-i targets (11 — NO existing picture asset, NO retraces):**

> **`pig`, `pin`, `bin`, `wig`, `bib`, `fig`, `lid`, `hip`, `rim`, `sip`, _slot 11 OPEN_.**

**Slot 11 status:** the pool spec lists `mitt` as a placeholder (rejected on second pass for pattern violation — doubled `tt`). The recommended ship pool has slot 11 OPEN — Thomas decides whether to ship 10 (drop slot 11) or surface a stronger 11th candidate from Phase 2 review. **Default: ship 10 for slot 11 = empty.** Documented in pool spec §10 Q1.

**Retraces:** none. Unlike short-u (3 retraces of `sun`/`cup`/`bus`) and short-o (4 retraces of `dog`/`log`/`pot`/`fox`), short-i's recommended pool contains zero words that were previously distractor-only entries with existing picture assets. All 11 prompts produce wholly-new SVG files at `public/assets/pictures/picture-{word}.svg`.

**Total generations needed for this pack: 10-11** (depending on slot 11 lock).
**Total SVG file changes after Phase 3: 10-11 new files, 0 overwrites.**

If Thomas opts to bundle this pack with future short-e generation in one MJ session ("50+ images one-time deal" per the dispatch brief), insert these eleven into the bundle. Cross-pack visual cohesion is the goal — same `--cref` / `--sref` to short-a `dog` pose-zero across all packs.

**Phase 2 fallback drops (per pool spec §10 Q3 priority order):**

1. `sip` (highest probability — multi-subject picture-chip)
2. `hip` (vocab-stretch + rosehip-vs-anatomy disambiguation)
3. `rim` (vocab-stretch + wheel-vs-bracelet disambiguation)
4. `lid` (most defensible audit-relaxation)

If all four drop, ship size is 6 (`pig, pin, bin, wig, bib, fig`). If none drop, ship size is 10-11 (slot 11 still depends on whether Thomas surfaces an 11th candidate from Phase 2 review).

---

## 1. Style anchors — derived from existing pack

This section names what makes the existing short-a + short-o + short-u pictures look like one illustrator made them — copied byte-for-byte from `picture-pack-style-anchor.md` §2 + §3 so the eleven short-i additions land as visual siblings, not visual rivals. **No deviation for this pack.** Marian must not be able to detect "the new vowel arrived" by visual style — that would corrupt the same-screen layout cohesion the short-i spec §7 deliberately preserves.

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
| Anthropomorphism   | None on objects (no smiling pig with crown, no smiling fig); see §3.7 + §1.4 anti-list. Animals: `pig` is a friendly natural-pig render (NOT pirate-pig, NOT cartoon-Peppa, NOT anthropomorphised in clothing).  | style-anchor §3.7 |

### 1.3 Pack-cohesion lever — `--cref` / `--sref` to short-a pose-zero

Per `picture-pack-iteration-plan.md` §1.1, the canonical pose-zero is short-a `dog`. This pack inherits that pose-zero — same as short-o §1.3 and short-u §1.3.

Every generation appends:

```
--cref <short-a-dog-pose-zero-url> --cw 80 --sref <short-a-dog-pose-zero-url>
```

Use the SAME `dog` pose-zero URL Thomas captured during the short-a / short-o / short-u packs' Phase 2 sessions. Pack-wide style cohesion across the whole eventual 40+-picture corpus (22 short-a + 4 short-o-new + 4 probe + 11 short-u-new + 11 short-i-new ≈ 52 cumulative pictures) is the goal.

If the dog pose-zero URL has been lost between sessions, re-derive it per `picture-pack-iteration-plan.md` §1 BEFORE running this pack. Do not run this pack standalone — that produces an 11-picture island that won't match the eventual cross-pack corpus.

### 1.4 Universal trailing parameters (append to every prompt in this pack)

```
--ar 1:1 --s 250 --v 6 --style raw --no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling pig, pig with crown, pig in clothing, smiling pin, pin with face, smiling bin, bin with face, smiling wig, wig with face, smiling bib, bib with face, smiling fig, fig with face, smiling lid, lid with face, smiling hip, hip with face, smiling rim, rim with face, smiling sip, smiling glass, glass with face, weapon, gun, knife, blade, anatomical hip, hip bone, body part, X-ray, medical illustration
```

**Delta from short-u pack:** added per-subject anthropomorphism negations specific to this pack (`smiling pig, pig with crown, pig in clothing`, etc.) and **`anatomical hip, hip bone, body part, X-ray, medical illustration`** to defensively keep `hip` rendering as the fruit (rosehip), NOT as the body-part. The body-part referent is the dominant English meaning of "hip" and MJ is likely to drift there without explicit negation.

The `weapon, gun, knife, blade` defensive negations from short-u are retained — short-i's audit rejected verbs (`cut`, `mix`, `fix`, `dig`, `hit`, `sit`) but defensive negation costs nothing and provides cross-pack coherence.

---

## 2. Per-word entries

The format per row mirrors the short-u pack:

```
WORD — vocabulary cue — distinctness check — full prompt — negatives — asset spec — notes
```

Each "full prompt" is paste-ready — the style preamble from §1.1 is inlined verbatim. Append the trailing parameters from §1.4 to every prompt.

---

### 2.1 `pig` — animal — `/ɪg/` rhyme family

- **Vocabulary cue:** A friendly pink pig — round body, snout (button-nose), two ears (small, rounded, slightly back-pointing), four short legs, curly tail. The snout + curly tail silhouette carries "pig" recognition.
- **Distinctness check (load-bearing):**
  - **vs. `dog` (short-o target, animal-pack neighbour, FORBIDDEN_PAIR `[pig, dog]` proposed §3 of pool spec):** `pig` has **snout + curly tail + rounder body**; `dog` has **muzzle + non-curly tail + leaner body + floppy or pointed ears**. **At 96pt the snout (button-nose vs. dog's pointed muzzle) and the curly tail (vs. dog's straight or curved tail) are the load-bearing discriminators.** Same-vowel-only rule keeps them apart in trios; the FORBIDDEN_PAIR is cross-pack visual hygiene.
  - **vs. `cat` (canonical short-a target, animal-pack neighbour, FORBIDDEN_PAIR `[pig, cat]` proposed):** `pig` has snout + curly tail; `cat` has whiskers + pointed ears + non-curly tail + smaller proportions. Different animal class entirely. Cross-pack hygiene only.
  - **vs. `fox` (short-o target):** `pig` has rounded body + snout; `fox` has pointed ears + bushy tail + leaner body. Different shapes. **Cross-vowel rule keeps them apart.** Low risk.
  - **vs. `bug` (short-u target):** insect-vs-mammal distinction, no risk.
  - **vs. `bat` (canonical short-a target):** mammal-vs-flying-mammal distinction; bat has wings + ears-up, pig has four legs + curly tail. Low risk.
  - **vs. `rat` (probe-word target, similar-mammal silhouette):** `pig` has snout + curly tail + rounder body; `rat` has pointed snout + straight tail + leaner ratlike body. Cross-vowel rule keeps them apart. **Low risk** with the picture-side discriminators holding.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **friendly cartoon pink pig, viewed in three-quarter side angle so the rounded body is fully visible plus the snout (button-nose with two visible nostrils) on the front of the face, two large round soft eyes, two small rounded ears positioned slightly back on the head, four short stocky legs visible (two on the near side, hint of two on the far side), a CURLY PIG-TAIL clearly visible at the rear (the curly tail is a load-bearing recognition cue — must form a clear single-loop spiral, not a straight tail and not a docked stub), the body in soft warm-pink (#F8BFC9 family) or soft warm-rose with a slightly darker contour and a soft cel-shadow on the right flank, gentle large-eyed expression with a small soft mouth as a tiny upward-curve line just below the snout, NO clothing, NO crown, NO wings, NO scene around the pig, NO mud puddle, NO grass, NO farm, NO other pigs, just a single pig on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone (no multi-stop gradient stacks, no rendered photorealism, no multi-tone painted shading). Palette: warm pastels — soft pinks, peaches, creams, warm browns, soft mauve, soft sage. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, large-eyed, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The pig is a CLEAR FOUR-LEGGED MAMMAL with a SNOUT (button-nose) and a CURLY TAIL — the snout + curly tail together are the load-bearing recognition feature; without them the silhouette could read as a generic round-animal-body. Pig is friendly and natural, NOT anthropomorphised, NOT in clothing, NOT with a crown, NOT cartoon-Peppa-style, NOT a piggy-bank.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Anthropomorphised pig (Peppa-Pig-style cartoon with clothing / crown / human posture).
  - Pig in clothing or with accessories (overalls, top hat, glasses).
  - Piggy-bank rendering with a coin slot (reads as "piggy bank" object).
  - Pig with detailed mud / dirt / farm scene (strip all environment).
  - Multiple pigs / piglets following mother pig (single subject only).
  - Pig with very pointed ears (drifts toward fox or wild boar).
  - Pig with tusks (boar / pig-as-warrior; not friendly children's pig).
  - Saturated bright pink (palette stays warm-pastel; no neon-pink).
  - Pig sitting upright on hind legs (anthropomorphised posture).
  - Pig with a single large droopy ear that hides one eye (over-stylised manhwa drift).
  - Bacon / pork imagery (food-not-animal frame violation).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-pig.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ; transparent-PNG export at ~512×512 via remove.bg "Regular" output size (or ~256×256 if Devon's Phase 3 PWA-cache budget audit per pool spec §10 Q5 calls for tighter compression).
  - Final SVG file size: target **~50–100 KB** (PNG-in-SVG embed; per `.claude/docs/skill-trees-and-content.md` §"Path 2").
- **Notes:** The snout + curly tail are **load-bearing for animal-pack discrimination** (proposed FORBIDDEN_PAIRs `[pig, dog]` and `[pig, cat]`). If MJ generates a pig without a clear curly tail, regenerate. The friendly-natural-pig tone matches the short-a `bat` Sanrio-style-friendly precedent (per `project_spec_drift_decisions` K) — same rationale: animals that could read as "scary" (wild boar, farm pig with tusks) get the friendly treatment without becoming anthropomorphised. Pair-review at 96pt against the existing `picture-dog.svg` and `picture-cat.svg` from PR #157 is mandatory in Phase 2.

---

### 2.2 `pin` — object — `/ɪn/` rhyme family

- **Vocabulary cue:** A single sewing pin (or safety pin) — head + shaft. The head-on-top-of-shaft silhouette carries "pin" recognition. Picture-chip caveat: head must be clearly visible at 96pt.
- **Distinctness check:**
  - **vs. `bin` (pack neighbour, /ɪn/ rhyme partner):** `pin` is **small + thin + shaft-with-head**; `bin` is **large + rectangular + lid**. Different sizes and shapes. **No risk.**
  - **vs. `tag` (canonical short-a target, similar small-flat object):** `tag` has a **string-loop at one corner**; `pin` has a **head + shaft (3D, NOT flat)**. Cross-vowel rule keeps them apart. Low risk.
  - **vs. `nut` (short-u target):** `nut` has oval body + seam line; `pin` has long thin shape + head. Different categories. Low risk.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single sewing pin OR safety pin, viewed in three-quarter perspective so the shaft and the head are both clearly visible, the pin is rendered at a slightly larger scale than realistic (roughly the size of a kitchen-fork relative to the frame, NOT thread-sized) so the details survive at 96pt, the head is a large round ball-shape in soft warm-rose, soft warm-cream, or soft warm-mauve perched on the top of the shaft (the head is the load-bearing recognition cue — must be clearly larger than the shaft cross-section, NOT a flush flat top), the shaft is a thin straight line in desaturated metallic-grey (`#C8C2BD` family) tapering very slightly to a soft pointed end at the bottom (NOT a sharp menacing point — the point is gently soft, like a needle-tip shown safely in a children's book), gentle cel-shading on the right side with a soft cream highlight on the left side of the head, NO thread, NO fabric being pinned, NO pincushion, NO other pins, just a single pin on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated metallic-grey shaft + warm-rose ball-head. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The pin is a SINGLE STRAIGHT SHAFT with a CLEARLY VISIBLE BALL-HEAD on top — the head is the disambiguating feature; without it the silhouette reads as a generic line or stick. The pin is friendly and safe, NOT a sewing-disaster scene, NOT a thread-and-fabric scene.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Sharp menacing point on the shaft tip (children's-book version is softly-pointed, not threatening).
  - Multiple pins / pincushion full of pins (single subject only).
  - Pin with thread attached (introduces second visual element).
  - Anthropomorphised pin (face on the head — known children's-book attractor for ball-shapes).
  - Pin embedded in fabric / pinning paper / sewing scene (strip all environment).
  - Saturated red ball-head with bright glint (palette stays warm-pastel).
  - Bowling-pin shape (different category — bowling pins are different objects entirely).
  - Stick-pin / hat-pin / lapel-pin (drifts toward fashion-accessory; keep it as the simple sewing/safety-pin archetype).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-pin.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB** (geometric simplicity compresses cleanly).
- **Notes:** **The head is the load-bearing detail at 96pt.** A thin shaft alone reads as "line" or "needle"; the ball-head is what anchors the read as "pin." Render at a slightly larger scale than realistic so the head survives PNG compression at chip size. If Phase 2 generates a pin with a too-small head that compresses to a point at 96pt, regenerate with the head exaggerated.

---

### 2.3 `bin` — household — `/ɪn/` rhyme family

- **Vocabulary cue:** A rectangular trash bin / waste bin / storage bin with a visible lid (open or partially-open). The rectangular-with-lid silhouette carries "bin" recognition.
- **Distinctness check (load-bearing):**
  - **vs. `tub` (short-u target, household-vessel category):** `bin` is **rectangular + hinged lid + flat-vertical sides**; `tub` is **oval + footed + open-top + curved sides**. Different shapes. **Same-vowel-only rule keeps them apart in trios.** Cross-pack hygiene: lid + rectangular footprint are the load-bearing details.
  - **vs. `box` (short-o target):** `bin` is **rectangular + hinged lid (often open or partially-open)**; `box` is **closed cuboid + tape line on top, no hinge**. Picture-side discriminator: bin's lid being visible OR partially-open is the load-bearing detail. Cross-vowel rule keeps them apart in trios. **Moderate risk** — Phase 2 review against `picture-box.svg` from PR #156 is mandatory.
  - **vs. `pot` (short-o target):** `bin` is rectangular; `pot` is round + side handles. Different shapes. Low risk.
  - **vs. `can` (canonical short-a target):** `bin` is rectangular + hinged lid; `can` is cylindrical + flat ring-pull top. Different shapes. Cross-vowel rule keeps them apart. Low risk.
  - **vs. `pin` (pack neighbour, /ɪn/ rhyme):** different sizes and categories. No risk.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple rectangular waste bin / trash bin, viewed in three-quarter perspective so the front face and one side face are both visible plus the lid configuration on top, the bin is a TALL RECTANGULAR VESSEL (taller than wide) in soft desaturated grey-blue (`#A5C4D8` family) or soft warm-cream, the lid is positioned PARTIALLY OPEN so it is clearly identifiable as a hinged top — the lid sits at a roughly 30-degree angle revealing a sliver of the inside (the partially-open lid is the load-bearing recognition cue — without it the bin silhouette reads as a generic box or cuboid), the lid color is the same as the bin body with a slightly darker contour, the inside of the bin (visible through the partially-open lid) is in a darker shade suggesting depth, optional small rectangular stick-on label on the front face (no text, just a cream-colored rectangle suggesting where a label would go — keep it minimal), four small rectangular feet at the bottom OR a flat base (Thomas's call), gentle cel-shading on the right side, NO trash inside, NO crumpled paper falling in, NO floor or kitchen scene around the bin, NO other bins, just a single bin on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated grey-blue or warm-cream body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bin is a TALL RECTANGULAR VESSEL with a PARTIALLY-OPEN HINGED LID — the lid configuration is the load-bearing recognition cue distinguishing it from a closed box or a cylindrical can. NO smiling face on the bin, NO eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Closed lid (collapses the discrimination from `box`).
  - Round/cylindrical bin (collapses the discrimination from `tub` and `pot`).
  - Trash overflowing the top (introduces second visual element + multi-subject).
  - Crumpled paper / banana peel / trash items in or around the bin.
  - Kitchen scene / wall behind bin / floor tiles below (strip all environment).
  - Anthropomorphised bin (face on the body).
  - Pedal-bin with foot-pedal visible (more complex shape; keep it simple — hinged lid is enough).
  - Saturated primary green (recycling-color associations) or saturated yellow (palette stays warm-pastel).
  - Multiple bins side by side (single subject only).
  - Detailed brand markings or text labels on the front (anti-text rule).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bin.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **The partially-open lid is the load-bearing distinguisher** vs. `box` (which is a closed cuboid with no lid, or a tape-sealed top). At 96pt the difference between a closed cuboid and a cuboid with a lid at 30° is the recognition cue. If Phase 2 generates a fully-closed bin or a fully-open bin, regenerate with the partially-open lid emphasised.

---

### 2.4 `wig` — object — `/ɪg/` rhyme family

- **Vocabulary cue:** A wig on a face-form / wig-stand, three-quarter view. Hair-style: simple shoulder-length, neutral color. The hair-on-face-form silhouette carries "wig" recognition.
- **Distinctness check:**
  - **vs. `pig` (pack neighbour, /ɪg/ rhyme):** different categories entirely (animal vs. hair-piece). No risk.
  - **vs. `fig` (pack neighbour, /ɪg/ rhyme):** different categories (hair vs. fruit). No risk.
  - **vs. `fan` (canonical short-a target):** `wig` is hair-on-face-form; `fan` is pedestal-fan with blades. Different categories. Cross-vowel rule keeps them apart. Low risk — but cross-pack hygiene: wig should NOT have radiating-blade-like hair-strands that mimic fan blades.
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **simple wig perched on a face-form OR wig-stand, viewed in three-quarter perspective so the hairstyle and the form-base are both visible, the hair is shoulder-length straight or with a gentle wave (NOT curly, NOT short pixie, NOT long-flowing-rapunzel — keep it medium-simple) in a soft warm-brown (`#5C3F31` family — same as Emma's hair) OR soft warm-blonde (`#D4B891` family) so the wig reads clearly against the cream background, a CLEAR HAIRLINE visible at the top of the wig where the hair meets the wig-cap (this is the load-bearing recognition cue — without the visible cap-edge the silhouette reads as a generic hair-shape or a person's head), a simple oval / egg-shaped face-form / wig-stand visible underneath the hair in a neutral cream or off-white (the face-form is featureless — NO face, NO eyes, NO mouth — it is the support stand, not a person), the wig appears to "sit" on the face-form, gentle cel-shading on the right side with a soft highlight on the upper-left of the hair, NO scene, NO mirror, NO vanity table, NO other wigs, just a single wig-on-form on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-brown or warm-blonde hair. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The wig is HAIR ON A FEATURELESS FACE-FORM — the visible cap-edge / hairline is the load-bearing recognition cue distinguishing it from a person's head (which would have a face). The face-form has NO eyes, NO mouth, NO nose — it is a pure support stand. NO anthropomorphism on the face-form.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Face on the wig-stand / form (would read as "person with hair", not "wig").
  - Wig being held / worn by a child (introduces second subject).
  - Long flowing rapunzel-style hair (over-stylised; keep it medium-shoulder-length).
  - Pixie-cut wig (too short — the silhouette reads as a hat or a haircut).
  - Curly afro-wig or very voluminous hair (different style register; keep it simple).
  - Saturated red / blue / pink hair (palette stays warm-pastel, hair is warm-brown or warm-blonde).
  - Wig flying / floating / disembodied (must rest on a support form).
  - Multiple wigs in a row (mannequins-and-wigs salon scene).
  - Mirror or vanity / dressing-table behind the wig (strip all environment).
  - Wig with bow / hair-clip / accessory (single subject; no decorations).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-wig.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **The face-form is featureless — NO face.** This is the rule that distinguishes "wig" (hair on a stand) from "girl with hair" (a person). The wig-stand is a children's-book convention for showing a wig as an object rather than worn. If Phase 2 generates a wig on a face-with-features, regenerate with the face-form blank. Hair-color stays warm — same family as Emma's hair palette per pack-cohesion rules.

---

### 2.5 `bib` — clothing — `/ɪb/` rhyme family

- **Vocabulary cue:** A single baby bib viewed front-on, with neck-opening and tie-strings visible. The fabric-with-neck-opening silhouette carries "bib" recognition.
- **Distinctness check:**
  - **vs. `bag` (canonical short-a target):** `bib` is small + neck-opening + tie-strings; `bag` is soft tote with handle. Different sizes and categories. Cross-vowel rule keeps them apart. No risk.
  - **vs. `tag` (canonical short-a target):** `bib` is fabric clothing-piece; `tag` is small paper-card with string-loop. Different sizes (bib is larger). Cross-vowel rule. Low risk.
  - **vs. `mat` (canonical short-a target, both fabric):** `bib` has neck-opening + tie-strings + curved bottom edge; `mat` is rectangular flat with plain edges. Different shapes and configurations. Cross-vowel rule keeps them apart. Low risk.
  - **vs. `cap` (canonical short-a target, both wearable):** `bib` is body-wear with neck-opening; `cap` is head-wear with brim + crown. Different proportions and orientations. Cross-vowel rule. Low risk.
  - **No FORBIDDEN_PAIR entry needed.**
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single baby bib, viewed front-on (NOT three-quarter — the symmetric front-view shows the neck-opening centered) so the full bib shape is visible from the wearer's perspective, the bib is roughly the size and shape of a small upside-down U with a curved bottom edge (slightly wider than tall), the body color in soft warm-pink, soft peach, or soft warm-cream with a subtle pattern (small dots, simple stripes, or a single appliqué shape like a heart or star) — the pattern is OPTIONAL and minimal, kept simple at chip size, the NECK-OPENING is a clear oval cut-out at the top of the bib (this is the load-bearing recognition cue — without it the silhouette reads as a generic fabric panel), TIE-STRINGS extend from each side of the neck-opening as two short curved fabric ribbons (the tie-strings reinforce the "this is worn" reading; without them the bib could read as a flat panel or place-mat), gentle cel-shading on the right side, the bib lies flat as if hanging or laid out (NOT worn by a baby — there is no baby in this picture), NO baby figure, NO food stains, NO bottle, NO scene, just a single bib on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The bib is a SMALL FABRIC PANEL with a NECK-OPENING and TIE-STRINGS — the neck-opening + tie-strings together are the load-bearing recognition feature. NO baby wearing the bib (single subject). NO smiling face — pure clothing item render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Baby wearing the bib (introduces second subject — the baby).
  - Bib with food stains or spilled milk (gross + scene-suggesting).
  - Bib with embroidered text / labels / brand names (anti-text rule).
  - Saturated primary pink + bright yellow polka dots (palette stays warm-pastel).
  - Velcro-style closure rendered too prominently (mechanism over recognition).
  - Multiple bibs / a row of bibs hanging on a clothesline (single subject).
  - Bib with elaborate ruffles or lace (visual noise at 96pt).
  - Bib worn around the neck of a person/animal (must hang or lie flat).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-bib.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** Vocab caveat — Marian may not have "bib" in her active English vocabulary, but the picture (small fabric panel with neck-opening) is recognizable as "the thing babies wear" via context. The neck-opening + tie-strings are the load-bearing cues; without them the bib reads as a place-mat or napkin. Vocabulary anchors via the picture, not the word.

---

### 2.6 `fig` — food — `/ɪg/` rhyme family

- **Vocabulary cue:** A single fig fruit, three-quarter view, stem + leaf-cap on top, soft warm-rose-purple body. The round-with-stem-and-leaf-cap silhouette carries "fig" recognition.
- **Distinctness check:**
  - **vs. `bun` (short-u target, round food, FORBIDDEN_PAIR `[fig, bun]` proposed §3 of pool spec):** `fig` has **stem-and-leaf-cap on top (vertical top-feature) + soft warm-rose-purple body**; `bun` has **horizontal cross-shape score-mark on top + soft warm-brown crust**. **Different top-feature directions** (vertical stem vs. horizontal score) carry the disambiguation. Same-vowel-only rule keeps them apart in trios; the FORBIDDEN_PAIR is cross-pack visual hygiene.
  - **vs. `nut` (short-u target, oval food):** `fig` has stem + leaf-cap; `nut` has vertical seam line + smooth warm-brown shell. Different shapes (round-with-stem vs. oval-with-seam). Same-vowel-only rule keeps them apart. Low risk.
  - **vs. `jam` (canonical short-a target, food):** `jam` is in glass jar with red contents and lid; `fig` is bare fruit with stem-and-leaf. Different forms entirely (single-fruit vs. food-in-container). Cross-vowel rule keeps them apart. No risk.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single fresh fig fruit, viewed in three-quarter perspective so the round body and the top-features (stem + leaf-cap) are clearly visible, the fig body is round with a slightly tapering bottom (teardrop-with-rounded-base shape, like a soft fat raindrop), the body color in soft warm-rose-purple (`#B07A8E` family — desaturated raspberry/plum, NOT saturated dark purple) with a slightly darker contour and a soft cel-shadow on the right side and a soft warm-cream highlight on the upper-left, a CLEAR SHORT BROWN STEM at the top center (the stem is a small warm-brown cylinder, ~1/8 the height of the body), a CLEAR LEAF-CAP at the top of the body around the base of the stem (4-6 small green leaf-petals radiating outward in soft sage green `#A8C8A0` family — these are the calyx/sepals at the top of the fruit, the load-bearing recognition cue distinguishing the fig from a generic round-fruit), the body has a slight texture suggesting the fig's skin (soft subtle dimples — kept minimal at 96pt), NO cut-open fig showing the inside (the pink-fleshy-interior reading risks veering toward gross), NO leaves on a branch, NO multiple figs in a basket, NO other fruit, just a single closed fig on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated warm-rose-purple body and soft sage leaf-cap. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The fig is a SINGLE TEARDROP-SHAPED FRUIT with a CLEAR STEM and LEAF-CAP (calyx) on top — the leaf-cap is the load-bearing recognition cue distinguishing it from a generic round-fruit. NO smiling face, no eyes — pure fruit render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Cut-open fig showing the pink fleshy interior with seeds (children's-book renderings keep fruit closed).
  - Multiple figs / fruit-bowl / cluster on branch (single subject only).
  - Leaves on a branch / tree-context (strip all environment).
  - Anthropomorphised fig (face — known children's-book attractor for round-fruit).
  - Saturated dark-purple / black-fig rendering (palette stays warm-pastel).
  - Fig-Newton cookie / dried fig (drift from fresh-fruit referent).
  - Plum / cherry / berry shape (must clearly read as fig — leaf-cap is the discriminator).
  - Apple shape (apples have stem + leaf but NO calyx-crown; fig has the calyx).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-fig.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB** (geometric simplicity compresses cleanly).
- **Notes:** Vocab caveat — Manila 8yo may not have "fig" in her vocabulary; figs ARE imported into Filipino markets but are not high-frequency. The picture (round-purple-with-stem-and-leaf-cap) anchors the meaning via picture-first reading. The leaf-cap (calyx) is the disambiguating feature vs. apple / plum / cherry / berry — these other round-fruits don't have a visible leaf-cap on the fruit itself. **Pair-review against `picture-bun.svg` from PR #170 at 96pt is mandatory** for the FORBIDDEN_PAIR `[fig, bun]` even though same-vowel-only rule keeps them apart in trios.

---

### 2.7 `lid` — object — `/ɪd/` rhyme family — Phase 2 review-required

> **Audit-relaxation entry.** The pool spec §1 audit initially rejected `lid` for picture-chip read instability (an isolated lid reads as "circle" or "plate" without container context). The re-audit allows it with a tighter brief: top-down lid view with a clear central handle, distinctly-non-circular footprint. **Phase 2 review at 96pt is mandatory; if read collapses to "plate", regenerate with the underside-rim more visible.**

- **Vocabulary cue:** A container lid viewed top-down OR three-quarter, with a clear central handle and visible rim-underside. The lid-with-handle silhouette carries "lid" recognition.
- **Distinctness check:**
  - **vs. `mat` (canonical short-a target, FORBIDDEN_PAIR `[lid, mat]` CONDITIONAL §3 of pool spec):** Both flat-rectangular IF `lid` renders as rectangular slow-cooker / box-lid style. **CONDITIONAL FORBIDDEN_PAIR** — pending Phase 2 visual review. If `lid` ships as round (jam-jar-lid style), the pair is unnecessary.
  - **vs. `pan` (canonical short-a target):** `lid` is flat top with central handle (short, vertical); `pan` is shallow disc with horizontal long handle. Different orientations. Cross-vowel rule. Low risk.
  - **vs. `cup` (short-u target):** `lid` is flat top with central short handle; `cup` is vertical vessel with curved side handle. Different orientations. Cross-vowel rule. Low risk.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single container lid, viewed in slight three-quarter perspective from above so the top surface is the dominant feature plus a hint of the underside-rim is visible, the lid is shaped as a SQUARE OR OVAL FOOTPRINT (e.g. a slow-cooker lid, a jam-jar lid with a noticeably non-circular shape, or a square box-lid — Thomas's call which footprint reads cleanest at 96pt; recommend square / rounded-square for the boldest disambiguation from "plate" and "circle"), the body color in soft warm-cream or soft warm-rose ceramic / metal-toned, a CLEAR CENTRAL HANDLE on top of the lid — a small upright knob or short cylindrical handle in a slightly darker tone — the handle is the load-bearing recognition cue (without it the silhouette reads as a plate, frisbee, or generic flat circle), a VISIBLE UNDERSIDE-RIM showing where the lid would seat onto a container — rendered as a small darker band along one edge of the footprint suggesting the lip that fits inside the container, gentle cel-shading on the right side, NO container visible (the lid is shown alone, off the container — that is the whole point), NO steam rising (no contents being heated), NO food underneath, just a single lid on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-cream or warm-rose body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The lid is a CONTAINER TOP with a CLEAR CENTRAL HANDLE and a VISIBLE UNDERSIDE-RIM — the central-handle + non-circular-footprint together carry "lid" recognition. NO smiling face, no eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Round circular lid that reads as a plate or coin or frisbee at 96pt (use square or oval footprint instead).
  - No central handle (collapses to "plate").
  - Lid sitting on a container (multi-subject — must show lid alone).
  - Steam rising from the lid (suggests cooking / multi-subject).
  - Pot of food / kitchen scene (strip all environment).
  - Vacuum-seal / mason-jar with screw-band visible (mechanism over recognition; keep it simple).
  - Anthropomorphised lid (face on top — known children's-book attractor).
  - Saturated primary red / blue (palette stays warm-pastel).
  - Multiple lids / lid-collection (single subject only).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-lid.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **Phase 2 review at 96pt is mandatory.** The audit-relaxation hinges on the lid not collapsing to "plate" or "circle." If the first generation reads as a flat disc, regenerate with: (a) more pronounced central handle, (b) visible underside-rim, (c) square or oval footprint instead of round. **Phase 2 fallback:** if multiple regenerations fail to land, drop `lid` from the pool — pool size drops per §10 Q3 priority order. Also: the conditional `[lid, mat]` FORBIDDEN_PAIR add depends on this entry rendering rectangular; if `lid` ships round, the FORBIDDEN_PAIR is not needed.

---

### 2.8 `hip` — food (rosehip) — `/ɪp/` rhyme family — Phase 2 review-required

> **Audit-relaxation entry.** The pool spec §1 audit allowed `hip` only via the **rosehip** referent (NOT the body-part). Phase 2 review must confirm the rosehip render is recognizable AND distinct from the anatomical body-part referent the English word more commonly carries. **High Phase 2 fallback risk** — likely drops if MJ defaults to anatomical / can't anchor the rosehip read cleanly.

- **Vocabulary cue:** A single rosehip fruit, oval-with-stem in soft warm-rose, with a distinctive crown-of-sepals (calyx) at one end. The oval-with-rose-color-and-crown-tip silhouette carries "hip" (rosehip) recognition.
- **Distinctness check:**
  - **vs. `fig` (pack neighbour, /ɪg/ rhyme — both fruit):** `fig` is teardrop with stem-and-leaf-cap on top + warm-rose-purple body; `hip` is oval with crown-of-sepals at one end + warm-rose body (different hue — pinker). Different shapes (teardrop vs. oval). Same-vowel-only rule keeps them apart in trios. Low risk.
  - **vs. `nut` (short-u target, oval food):** `hip` has rose-colored body + crown-tip; `nut` has warm-brown shell + vertical seam. Different colors and top-features. Cross-vowel rule keeps them apart. Low risk.
  - **vs. ANATOMICAL HIP:** the body-part referent is the dominant English meaning. **Negative-prompt enforced** (see §1.4 universal trailing parameters added `anatomical hip, hip bone, body part, X-ray, medical illustration`). Phase 2 review at 96pt: if MJ defaults to anatomical despite the negative prompt, regenerate with explicit "rosehip fruit" framing.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single fresh ROSEHIP FRUIT (the seed-pod of a rose), viewed in three-quarter perspective so the oval body and the crown-end (calyx with sepals) are clearly visible, the rosehip body is OVAL (more elongated than round, like a small egg-shaped berry), the body color in soft warm-rose (`#FFB7C5` family — same as the project's --my-rose token, slightly deeper and more saturated than the cream background) with a slightly darker contour and a soft cel-shadow on the right side, a CLEAR CROWN-OF-SEPALS at the TOP END of the rosehip — 4-6 small dried-flower-petal-like sepals radiating outward in soft warm-brown or soft sage green (the crown is the load-bearing recognition cue — distinguishes it from a generic berry or grape), a small short stem at the bottom end OR no visible stem (depending on what reads cleanest at 96pt — recommend NO stem so the focus is the crown), gentle warm-rose body with subtle texture suggesting the leathery skin, NO cut-open rosehip showing seeds inside (children's-book renderings keep fruit closed), NO rose flower attached or nearby (would shift the read to "rose"), NO multiple rosehips on a branch, NO leaves, just a single closed rosehip on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with warm-rose body and soft warm-brown / soft sage crown-of-sepals. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The rosehip is a SMALL OVAL FRUIT with a CROWN OF SEPALS at the top — the crown is the load-bearing recognition cue. The fruit is the seed-pod of a rose, NOT a rose flower itself. ABSOLUTELY NOT an anatomical body-part rendering, NOT a hip-bone, NOT an X-ray, NOT a medical illustration. NO smiling face, no eyes — pure fruit render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Anatomical hip / hip-bone / pelvis (the dominant English meaning of "hip" — must NOT render).
  - Cut-open rosehip showing the seeds (children's-book renderings keep fruit closed).
  - Rose flower attached / nearby (drifts to "rose").
  - Branch with multiple rosehips (single subject).
  - Anthropomorphised rosehip (face).
  - Saturated red strawberry (drift to "strawberry").
  - Cherry / cranberry / pomegranate shape without the crown-of-sepals.
  - X-ray / medical illustration / body diagram.
  - Hip-hop / fashion-hip / generic-cool aesthetic.
  - Saturated primary red (palette stays warm-pastel; rosehip is warm-rose).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-hip.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~40–80 KB**.
- **Notes:** **Phase 2 review is critical** — the rosehip is a vocabulary stretch + the anatomical referent is the default English read. If multiple regenerations fail to anchor the rosehip read OR Marian's vocab can't anchor the meaning even with the picture, **drop `hip` from the pool** per §10 Q3 priority. The crown-of-sepals (calyx) is the load-bearing detail — without it, the silhouette reads as a generic berry or grape. If the calyx compresses to indistinct fluff at 96pt, regenerate with the calyx exaggerated and more graphic.

---

### 2.9 `rim` — object (wheel rim) — `/ɪm/` rhyme family — Phase 2 review-required

> **Audit-relaxation entry.** The pool spec §1 audit rejected `rim` initially for picture-chip multi-subject (rim of a vessel implies a vessel). Re-audit allows it via the **bicycle wheel rim** referent (a metal hoop with spokes, no tire). Phase 2 review must confirm the wheel-rim-without-tire reads as "rim" and not as "wheel" or "circle" or "wedding ring."

- **Vocabulary cue:** A bicycle wheel rim viewed front-on, round metal hoop with spokes radiating inward, no tire. The metal-hoop-with-spokes silhouette carries "rim" (wheel rim) recognition.
- **Distinctness check:**
  - **vs. `pin` (pack neighbour):** `rim` is round metal hoop with spokes; `pin` is single straight shaft. Different shapes. No risk.
  - **vs. `bus` (short-u target):** `bus` is whole vehicle; `rim` is just the wheel-rim. Different scales. No risk.
  - **vs. `fan` (canonical short-a target):** `fan` is pedestal-fan with blades radiating from center; `rim` is wheel-rim with thin metal spokes radiating from a small hub. Picture-side discriminator: fan blades are shaped (curved, asymmetric); rim spokes are thin straight metal lines. Both have radiating-from-center silhouettes — **moderate risk** at 96pt. Cross-vowel rule keeps them apart. Cross-pack hygiene: keep rim spokes thin and straight; fan blades shaped and curved.
  - **vs. `wedding ring` / `bracelet` / `circle` (generic confounders):** must clearly read as wheel-rim — the spokes are the load-bearing detail. Without spokes, the silhouette is just a circle.
- **Full prompt:**

> Single subject, centered, square 1:1 composition. A child-friendly illustrated **single bicycle wheel rim (just the rim, no tire), viewed front-on so the full circle is visible, the rim is a thin round metal hoop in desaturated metallic-grey (`#C8C2BD` family) or soft warm-cream-grey, the hoop is roughly 1/12th the diameter in thickness (NOT a thick band — keep it thin so it reads as a wheel-rim, not a frisbee or a wedding ring), THIN STRAIGHT METAL SPOKES radiate inward from the rim toward a small central hub — typically 8-12 spokes evenly distributed around the rim (the spokes are the load-bearing recognition cue — without them the silhouette reads as a generic ring), the central hub is a small round element where the spokes meet (a small darker disc roughly 1/8th the rim diameter), gentle cel-shading on the right side suggesting the metal catches imaginary upper-left light, NO tire wrapped around the rim (this is the rim alone — the whole point of the picture), NO bicycle attached, NO road or pavement, NO axle / valve-stem detail (keep it clean), just a single rim on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with desaturated metallic-grey body. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject only — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The rim is a THIN ROUND METAL HOOP with THIN STRAIGHT SPOKES radiating to a central hub — the spokes are the load-bearing recognition cue distinguishing it from a wedding ring or bracelet (no spokes) and from a fan (curved-shaped blades, not straight thin spokes). NO tire, NO bicycle, NO smiling face — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Tire wrapped around the rim (collapses to "wheel" or "tire").
  - Bicycle attached to the rim (multi-subject + scene).
  - Wedding ring (no spokes, thicker band).
  - Bracelet / decorative ring (visual cues different from wheel-rim).
  - Fan blades — curved, asymmetric, shaped (rim spokes are thin and straight).
  - Saturated chrome / metallic shine (palette stays warm-pastel).
  - Multiple rims (single subject).
  - Spokes that are thick or curved (read as bicycle-wheel-art-style; keep thin and straight).
  - Photorealistic chrome rendering (3D-render anti-rule).
  - Anthropomorphised rim (face on the hub).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-rim.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **Phase 2 review is critical** — the wheel-rim-without-tire is an unusual standalone subject. If MJ defaults to a tire-wrapped wheel OR a generic ring, regenerate with explicit "bicycle wheel rim only, no tire" framing. If multiple regenerations fail OR the rim reads as wedding-ring at 96pt, **drop `rim` from the pool** per §10 Q3 priority. The thin straight spokes are the load-bearing detail — fan blades are curved; rim spokes are straight.

---

### 2.10 `sip` — object (drink with straw) — `/ɪp/` rhyme family — Phase 2 review-required, HIGH-DROP-PROBABILITY

> **Audit-relaxation entry, highest Phase 2 fallback probability.** The pool spec §1 initially rejected `sip` as a verb; re-audit allows the noun reading "a sip" (a small drink) but the picture-chip is multi-subject (glass + liquid + straw). **High probability Phase 2 review drops this entry.** Documented as the most-likely-to-drop slot in §10 Q3.

- **Vocabulary cue:** A glass-with-liquid-and-straw, three-quarter view, a small glass with juice/water and a striped straw. The glass-with-straw silhouette carries "sip" (a small drink) recognition.
- **Distinctness check:**
  - **vs. `cup` (short-u target):** `cup` is handled vessel + open top; `sip` is glass + straw + liquid (no handle). Different configurations. Cross-vowel rule keeps them apart. Low risk.
  - **vs. `jug` (short-u target):** `jug` is large + handled + spouted; `sip` is small glass + straw. Different sizes and handles. Cross-vowel rule. Low risk.
- **Full prompt:**

> Single subject (composite), centered, square 1:1 composition. A child-friendly illustrated **single small drinking glass with a striped straw, viewed in three-quarter perspective so the curved glass body and the straw are both visible, the glass is a simple cylindrical or slightly-tapered tumbler in clean neutral / tinted-glass tone (the glass has soft cel-shading suggesting volume but is mostly transparent — render the inside content visible through the glass walls), the glass contains a CLEAR LIQUID at about 2/3 height — the liquid is desaturated soft warm-rose (rosé / fruit punch / juice) or soft warm-yellow (lemonade) — Thomas's call which color reads cleanest at 96pt, a STRIPED STRAW emerges from the open top of the glass at a slight angle, the straw has alternating soft-rose and soft-cream stripes (the "candy-cane" pattern is a children's-book convention for "drink straw"), the bottom of the glass sits on a flat invisible base (no actual surface drawn), gentle cel-shading on the right side, NO ice cubes inside the liquid (visual noise + multi-subject), NO bubbles or fizz visible (would shift to "soda" / "soft drink"), NO umbrella or cocktail garnish, NO scene around the drink, NO hand holding the glass, just a single glass-with-straw on its own** in the style of modern slice-of-life Korean manhwa / webtoon children's book illustration. Clean digital line art with soft pastel color fills, line weight roughly 2 pixels at 1024×1024 render, gentle cel-shading with a single soft shadow companion per color zone. Palette: warm pastels with neutral-glass body, warm-rose or warm-yellow liquid, candy-stripe straw. Background: solid soft cream (#FFF6EE) — flat, mask-friendly, no environment, no scene, no shadow drop. Single subject (composite glass + liquid + straw) — no other figures, no text. Friendly tone, rounded forms. Tonal sibling: Studio Ghibli's calm-observant-kind warmth. **The chip is a SMALL GLASS with STRIPED STRAW and visible liquid — a "sip" depicted as a small drink. The straw is the load-bearing recognition cue — without it the silhouette reads as a generic glass. NO smiling face, no eyes — pure object render.** Drawn for a children's vocabulary book.

- **Negatives / what to avoid:**
  - Hand or face / mouth-on-straw (introduces a person — multi-subject).
  - Multiple glasses / table-setting / tray (single subject only).
  - Ice cubes inside the liquid (visual noise + drift to "iced drink").
  - Umbrella / cocktail garnish (drift to alcoholic drink — content-policy issue for an 8yo's app).
  - Bubble / fizz / carbonation visible (drift to "soda" — different word).
  - Saturated primary green / blue / red liquid (palette stays warm-pastel; liquid is desaturated rose / yellow).
  - Plastic cup with logo / branding (anti-text + brand-rule).
  - Anthropomorphised glass (face on the body).
  - Multiple straws in one glass (single straw only).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-sip.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent ~512×512 via remove.bg.
  - Final SVG file size: target **~50–100 KB**.
- **Notes:** **HIGHEST Phase 2 fallback probability in this pack.** The composite-subject (glass + liquid + straw) is fundamentally less stable than single-object renders. Two failure modes: (1) the read collapses to "glass" (generic) without anchoring "sip" specifically; (2) the multi-subject introduces visual noise that hurts chip-size readability. **If Phase 2 review can't land the read in 2-3 regenerations, drop `sip` from the pool** per §10 Q3 priority — pool drops to 10 (or 9 / 8 if other audit-relaxation entries also drop). Document the drop in pool spec §10 Q3; Kevin's impl ticket adapts mechanically.

---

### 2.11 _slot 11_ — OPEN per pool spec §10 Q1

> **Slot 11 status:** the pool spec §1 lists `mitt` as a placeholder (rejected on second pass for pattern violation — doubled `tt`). The recommended ship pool has **slot 11 OPEN** — Thomas decides whether to ship 10 (drop slot 11 entirely) or surface a stronger 11th candidate from Phase 2 review.

**Default (recommended):** ship 10 (slot 11 = empty). Pool spec §1 documents that the strict-audit short-i surface yields 6 strong KEEPs; entries 7-10 are audit-relaxation candidates with documented Phase 2 fallbacks. Adding an 11th audit-relaxation entry stretches the audit further than evidence supports.

**If Thomas wants to ship 11:** candidates that could fill slot 11 with appropriate audit relaxation include:

- **`bid`** — verb (auction bid). Rejected initially for verb-class. **Could be re-audited** if Thomas accepts a picture-chip showing an auction-paddle with a number on it (multi-component but recognizable). Vocab risk: "bid" requires understanding of auctions; not in early-reader vocabulary.
- **`mitt`** — C-V-CC (doubled `tt`). **Hard rejected** for pattern violation; cannot be relaxed without breaking the strict-CVC-spelling-pattern rule v1 enforces.
- **`king`** — C-V-CC (`ng` digraph). Hard rejected for pattern violation.
- **`sis`** — informal for "sister." Rejected for vocab + picture-instability.

**No clean slot-11 candidate exists.** The honest answer is to ship 10. If Thomas has a candidate in mind from his own audit (e.g., a regional Filipino-English short-i word the spec missed), insert it here as a §2.11 entry and the prompt-row format follows §§ 2.1-2.10.

For now, this section is reserved for Thomas's decision per §10 Q1 lock.

---

## 3. Quick reference — pack index

| #   | Word   | Type                                                                   | Pack neighbour requiring discrimination                                                                        | Picture-side discriminator                                                           |
| --- | ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | pig    | new short-i target (animal)                                            | `dog`/`cat`/`fox`/`rat`/`bug` (animal pack); FORBIDDEN_PAIR `[pig, dog]`/`[pig, cat]` proposed                 | snout + curly tail (vs. dog's muzzle + non-curly; cat's whiskers; etc.)              |
| 2   | pin    | new short-i target (object)                                            | `bin` (pack neighbour /ɪn/)                                                                                    | head + thin shaft (vs. bin's rectangular + lid)                                      |
| 3   | bin    | new short-i target (household)                                         | **`box` (cross-vowel — closed cuboid vs. partially-open lid)**, `tub`/`pot`/`can`                              | partially-open hinged lid + rectangular footprint                                    |
| 4   | wig    | new short-i target (object)                                            | none in-pack; `fan` (cross-vowel — radiating shapes)                                                           | hair on featureless face-form (vs. fan blades or person's face)                      |
| 5   | bib    | new short-i target (clothing)                                          | `mat` (cross-vowel — fabric); `cap` (wearable)                                                                 | neck-opening + tie-strings (vs. plain rectangular fabric)                            |
| 6   | fig    | new short-i target (food)                                              | **`bun` (cross-vowel — both round food, FORBIDDEN_PAIR `[fig, bun]` proposed)**, `nut` (oval food cross-vowel) | stem + leaf-cap on top (vertical) (vs. bun's horizontal score + nut's vertical seam) |
| 7   | lid    | new short-i target — Phase 2 review-required                           | **`mat` (cross-vowel — IF lid renders rectangular, FORBIDDEN_PAIR `[lid, mat]` CONDITIONAL)**, `pan`/`cup`     | central handle + non-circular footprint (vs. plate / pan / handled vessel)           |
| 8   | hip    | new short-i target — Phase 2 review-required, vocab-stretch            | **anatomical hip (negative-prompt)**, `fig` (pack neighbour fruit), `nut` (oval food)                          | crown-of-sepals (calyx) at one end (vs. anatomical body-part)                        |
| 9   | rim    | new short-i target — Phase 2 review-required, vocab-stretch            | `fan` (cross-vowel — radiating shapes); generic ring / wedding ring                                            | thin straight spokes radiating to small hub (vs. fan's curved blades)                |
| 10  | sip    | new short-i target — Phase 2 review-required, HIGHEST-drop-probability | `cup` / `jug` (short-u vessels)                                                                                | glass + striped straw composite (vs. handled cup / spouted jug)                      |
| 11  | _OPEN_ | per §10 Q1 — default ship 10                                           | n/a                                                                                                            | n/a                                                                                  |

**Highest-distinctness-risk pair in this pack: `pig` ↔ `dog`** (cross-pack; cross-vowel, FORBIDDEN_PAIR proposed). Both four-legged mammals. The snout + curly tail of pig vs. muzzle + non-curly tail of dog must hold at 96pt. Phase 2 pair-review at chip size is mandatory.

**Highest-cross-pack-distinctness-risk pair: `fig` ↔ `bun`** (cross-vowel, FORBIDDEN_PAIR proposed). Both round food with a top-feature. Same-vowel-only rule keeps them out of trios in v1, but the picture-side stem-and-leaf-cap (fig) vs. horizontal-score (bun) discriminator is still load-bearing.

**Cross-vowel cosmetic-similarity to watch:** `lid` ↔ `mat` (CONDITIONAL FORBIDDEN_PAIR if lid renders rectangular). Phase 2 review confirms or vetoes the FORBIDDEN_PAIR add.

**HIGHEST Phase 2 drop probability: `sip`** — composite-subject picture-chip is fundamentally less stable than single-object renders. Document drop trigger; pool spec §10 Q3 priority order is `sip → hip → rim → lid`.

---

## 4. Generation order recommendation

Per `picture-pack-iteration-plan.md` §3 — same surface-the-hardest-cases-early principle. **No retraces in this pack** (unlike short-u Q2 LOCKED A which had 3 retraces of `sun, cup, bus`); short-i is all wholly-new files.

**Order:**

1. **`pig`** first — highest cross-pack-discrimination risk (silhouette discriminator vs. existing `dog` and `cat` in PR #157). Pair-review against existing `picture-dog.svg` and `picture-cat.svg` at 96pt is mandatory in Phase 2; FORBIDDEN_PAIR `[pig, dog]` and `[pig, cat]` proposed. Lock the snout + curly tail features early so the rest of the pack inherits the consistent animal-render style.
2. **`bin`** second — second-highest discrimination risk (vs. existing `picture-box.svg` from PR #156). Lock the partially-open lid feature.
3. **`fig`** third — third-highest discrimination risk (vs. existing `picture-bun.svg` from PR #170; FORBIDDEN_PAIR `[fig, bun]` proposed). Lock the stem-and-leaf-cap feature.
4. **`pin`** fourth — moderate risk (head-on-shaft must survive PNG compression at 96pt).
5. **`wig`** fifth — moderate risk (face-form must remain featureless; do NOT render a face).
6. **`bib`** sixth — low-to-moderate risk (neck-opening + tie-strings are load-bearing).
7. **`lid`** seventh — Phase 2 review-required (audit-relaxation entry; mandatory pair-review at 96pt; conditional FORBIDDEN_PAIR `[lid, mat]` confirmation).
8. **`hip`** eighth — Phase 2 review-required, vocab-stretch (rosehip vs. anatomical-hip risk; mandatory pair-review at 96pt).
9. **`rim`** ninth — Phase 2 review-required, vocab-stretch (wheel-rim-without-tire stability risk).
10. **`sip`** tenth — Phase 2 review-required, HIGH drop probability (composite-subject stability risk).
11. **_slot 11_** — per §10 Q1 default ship 10.

**If Thomas bundles this pack with future short-e generation in one MJ session** ("50+ images one-time deal" per the dispatch brief), the per-pack tier ordering still applies — within the short-i block, run `pig`/`bin`/`fig` first so the FORBIDDEN_PAIR pair-reviews can happen before drifting to other vowels.

---

## 5. Acceptance criteria for Phase 2 selection (Thomas-side)

Each generation in this pack must pass ALL of these gates before Thomas accepts and saves the source PNG. These mirror the short-u pack §5 plus per-row distinctness gates specific to this pack.

### 5.1 Style-cohesion gates (same as short-a + short-o + short-u packs)

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style preamble honored: line weight ~2 px at 1024×1024, palette warm-pastel, line color warm-dark-brown not pure black, background solid soft cream flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no signature, no logo, no UI overlay anywhere in the image.
- [ ] No anthropomorphism (`pig` is a friendly natural pig, NOT in clothing, NOT with a crown; `wig` face-form has NO face features; all other subjects are pure objects with no faces, no eyes, no smiles).
- [ ] Visual cohesion with the locked short-a pose-zero (typically `dog`) — line weight, palette, shading style match.
- [ ] No weapons, blades, sharp objects (defensive — short-u carried this rule forward).

### 5.2 Per-word distinctness gates (load-bearing for this pack)

- [ ] **`pig`:** Snout (button-nose) + curly tail clearly visible at 96pt; four legs visible; rounded body. **At 96pt side-by-side with existing `picture-dog.svg`, the snout + curly tail discriminators are unmistakable** (FORBIDDEN_PAIR `[pig, dog]` proposed). NOT in clothing, NOT with crown, NOT anthropomorphised.
- [ ] **`pin`:** Ball-head clearly visible at 96pt above a thin shaft; cannot be mistaken for a generic line, needle-with-no-head, or thread.
- [ ] **`bin`:** Tall rectangular body + PARTIALLY-OPEN HINGED LID clearly visible at 96pt. **At 96pt side-by-side with existing `picture-box.svg`, the lid configuration is the unmistakable discriminator.** Cannot be mistaken for a closed box or a cylindrical can.
- [ ] **`wig`:** Hair on featureless face-form clearly visible at 96pt; **face-form has NO eyes, NO mouth, NO nose** (pure support stand). Hair length is shoulder-length (NOT pixie-cut, NOT rapunzel-long); hair color is warm-brown or warm-blonde (NOT saturated red/blue/pink).
- [ ] **`bib`:** Neck-opening + tie-strings clearly visible at 96pt; cannot be mistaken for a place-mat or generic fabric panel.
- [ ] **`fig`:** Stem + leaf-cap (calyx) on top clearly visible at 96pt; warm-rose-purple body (NOT saturated dark-purple). **At 96pt side-by-side with existing `picture-bun.svg`, the vertical stem-and-leaf-cap (fig) vs. horizontal score-mark (bun) discriminators are unmistakable** (FORBIDDEN_PAIR `[fig, bun]` proposed). NOT cut-open showing seeds.
- [ ] **`lid` (Phase 2 review-required):** Central handle + non-circular footprint + visible underside-rim at 96pt. **At 96pt side-by-side with existing `picture-mat.svg`, IF `lid` renders rectangular the FORBIDDEN_PAIR `[lid, mat]` CONDITIONAL must be added** (Phase 2 confirms or vetoes). Cannot be mistaken for plate, frisbee, or generic flat circle. **Phase 2 fallback:** drop if multiple regenerations fail.
- [ ] **`hip` (Phase 2 review-required):** Crown-of-sepals (calyx) at one end + warm-rose oval body at 96pt; **must read as rosehip fruit, NOT anatomical body-part**. Anatomical-hip is the dominant English meaning — Phase 2 verifies the rosehip read holds against the negative prompt. **Phase 2 fallback:** drop if multiple regenerations default to anatomical OR if the rosehip is unrecognizable to Marian.
- [ ] **`rim` (Phase 2 review-required):** Thin straight spokes radiating to small central hub at 96pt; **NO tire**, **NOT a wedding ring or bracelet**, **NOT a fan with curved blades**. **Phase 2 fallback:** drop if multiple regenerations fail to land "wheel rim" specifically.
- [ ] **`sip` (Phase 2 review-required, HIGHEST drop probability):** Glass + striped straw + visible liquid clearly identifiable at 96pt. Composite-subject is fundamentally less stable; **Phase 2 fallback:** drop if 2-3 regenerations can't land the read.
- [ ] **_slot 11_ (per §10 Q1):** if shipping 11, the entry must pass all standard distinctness gates plus the audit-relaxation rationale Thomas surfaces. Default ship 10 — slot 11 empty.

### 5.3 "Regenerate" triggers

If any of the following appear, regenerate (do not proceed to embed):

- Anthropomorphised object (smiling face on pin/bin/wig/bib/fig/lid/hip/rim/sip; pig in clothing or with crown).
- `pig` without curly tail (collapses dog-discrimination + cat-discrimination).
- `pig` rendered as Peppa-Pig-style cartoon character with clothing.
- `pin` with no head or with head too small to survive 96pt (collapses to "line").
- `bin` with closed lid (collapses to "box") or with lid fully open at 90° (reads as "open lid", not "bin with hinged lid").
- `wig` with a face on the form (reads as "person with hair", not "wig as object").
- `bib` worn by a baby (multi-subject + scene).
- `fig` cut open showing seeds (palette + scene rule violation) OR `fig` without leaf-cap (collapses to generic round-fruit).
- `lid` rendered round / circular (collapses to "plate" / "circle"; needs square or oval footprint).
- `lid` without central handle (collapses to "plate").
- `hip` rendered as anatomical body-part (must be rosehip fruit).
- `hip` without crown-of-sepals (collapses to generic berry).
- `rim` with tire wrapped (collapses to "wheel" or "tire").
- `rim` rendered as wedding ring or bracelet (no spokes).
- `rim` with curved blades (drift to fan).
- `sip` with hand or face on straw (introduces person — multi-subject).
- `sip` with ice cubes / fizz / cocktail garnish (drift to "iced drink" / "soda" / "cocktail").
- Photorealistic / 3D-rendered output (tighten `--style raw`).
- Saturated primary colors, neon, pure black, sepia.
- Text on any subject (anti-text rule).
- Multiple subjects (e.g. multiple pigs, two bibs, three figs).
- Weapons / blades / sharp objects in the frame (defensive).
- `bin` with overflowing trash or floor / kitchen scene.
- `wig` with mirror / vanity / dressing-table behind it.

---

## 6. Out of scope

- **No retraces.** Unlike short-u (3 retraces of `sun, cup, bus` per Q2 lock) and short-o (4 promotions of `dog, log, pot, fox`), short-i has no words that exist as picture assets today and need re-tracing. All 11 prompts produce wholly-new SVG files.
- **Short-e picture pack** — separate per-vowel pack when that tier scopes. Per `design/word-song/README.md` §Future work + the README skeleton + Dave's `short-u-minimal-pair-and-future-vowel-openers.md` §3.2 pre-spec for the `bed / bid` short-e opener.
- **Phase 2 generation itself** — this is a Phase 1 prompt sheet. Thomas runs MJ in Phase 2 (per `user_midjourney_web` — MJ Web UI workflow with prompt-box paste + drag-drop upload, not Discord slash-commands).
- **Phase 3 PNG-embed integration** — Devon owns this PR via `yarn embed-pictures` (per `.claude/docs/skill-trees-and-content.md` §"Tooling for path 2"). The script wraps each transparent PNG into the canonical `<svg><image href="data:image/png;base64,...">` format. No code changes in this prompt-sheet PR.
- **Code changes to `wordPack.ts`, `wordPictures.tsx`, or canon files** — Kevin's downstream impl ticket. The pool spec §10 ACs cover those.
- **Cross-vowel distractor mixing** — out of v1 per pool spec §9 + `cross-vowel-mix-spec.md` §2. Tracked as ticket `86c9m3aek`.
- **Re-naming any existing `picture-{word}.svg` files** — out of scope (no renames needed for this pack; all 11 are new files at the canonical `picture-{word}.svg` naming convention).
- **`hip` / `rim` / `sip` / `lid` Phase 2 fallbacks** — entries §§ 2.7 / 2.8 / 2.9 / 2.10 document the regenerate-then-drop triggers. Pool spec §10 Q1 + Q3 are the lock points. Phase 2 fallbacks are contingencies, not Phase 1 scope questions.
- **PWA cache budget audit** — flagged in pool spec §10 Q5 for Devon's impl ticket. Defer to Phase 3 measurement.
- **Slot 11 candidate selection** — per §10 Q1 default ship 10. If Thomas wants slot 11 filled, surface a candidate during Phase 2 review and add a §2.11 entry; default ship is 10.
- **TTS A/B for the AC9b opener line `"sit / seat"`** — Kevin's impl ticket per pool spec §4 + AC9b. Mandatory at canon-bake time; phoneme-override fallback per `project_audio_phoneme_overrides`. Not in this prompt-sheet scope.

---

## 7. Provenance

- **Triggering doc:** `design/word-song/short-i-pool-expansion.md` §3 ("Picture-pack requirements") — flagged the forward Kyle ticket; this pack is that ticket's deliverable.
- **Style preamble + universal parameters + locked attributes:** `design/word-song/picture-pack-style-anchor.md` §2 + §3.
- **Workflow + drift table + escalation ladder:** `design/word-song/picture-pack-iteration-plan.md` §3 + §5 + §6.
- **Per-row prompt structure inheritance:** `design/word-song/short-u-picture-pack-prompts.md` (sibling MJ prompt sheet) — this pack mirrors that file's row format byte-for-byte where possible.
- **Word-list lock:** `design/word-song/short-i-pool-expansion.md` §1 final pool of 11 short-i target words. The 11 words covered here are `pig, pin, bin, wig, bib, fig, lid, hip, rim, sip` plus _slot 11_ OPEN.
- **Q1/Q2/Q3/Q4/Q5 lock points:** pool spec §10 — Q1 default A (ship 11 with Phase 2 fallbacks documented), Q2 default A (ship 3 unconditional FORBIDDEN_PAIRS + 1 conditional), Q3 default A (drop priority `sip → hip → rim → lid`), Q4 default A (single MJ session for tier visual cohesion — drives §0 of this sheet), Q5 default A (Devon impl ticket measures PWA cache budget post-Phase-3). All five Qs are flagged for Thomas confirmation.
- **Phase 3 path locked to Path 2 (PNG-embed):** `.claude/docs/skill-trees-and-content.md` §"Three viable Phase 3 paths" + Thomas's "50+ images one-time deal" preference per the dispatch brief.
- **PWA cache budget:** `reference_pwa_asset_size_limits` memory — 4 MiB cache cap; ~50–150 KB per SVG fits comfortably for short-u but cumulative count after short-i ships approaches budget. Pool spec §10 Q5 captures the audit.
- **MJ Web UI workflow:** `user_midjourney_web` memory — Thomas operates MJ via Web UI (prompt-box + drag-drop upload), not Discord slash-commands. Prompt sheet copy is paste-ready for the Web UI's prompt input.
- **Locked memories:**
  - `project_pic_dog_svg` (SVG vector for all CVC pictures — this pack uses PNG-in-SVG embed per the established Phase 3 path; the lock holds because the wrapper IS still SVG, the content is the source PNG embedded as data URI).
  - `project_spec_drift_decisions` K (Sanrio-style friendly bat → applies forward to friendly pig here).
  - `project_planner_parser_contract` (no parser change here; picture-pack only).
  - `feedback_mj_workflow_explicit_removebg` (Thomas's MJ Web UI workflow includes a discrete remove.bg step before `yarn embed-pictures` — not implied or auto).
- **Critical pre-research:** `design/research/short-u-minimal-pair-and-future-vowel-openers.md` (Dave, PR #173) — §3.1 verbatim recommendation [STRONG] for `sit / seat` opener used in pool spec §4 + AC9b. This prompt sheet does not directly consume the opener line (it lives in the canon JSON via Kevin's impl ticket), but the spec context that drives the picture pack scope is rooted in the Dave research.
