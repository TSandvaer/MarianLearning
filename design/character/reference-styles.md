# Reference styles — Emma (manhwa/webtoon teacher)

**Audience:** future asset author (vector trace pass), Thomas (taste reference).
**Author:** Marian Tutor design persona — Phase 3b dispatch (ticket `86c9kwh66`).
**Status:** Reference catalogue for art-direction discipline. Not a rights-claim, not a copy-source. The shipping Emma assets are original artwork in the visual family of these references — never traced from them.

**Source-of-truth visual deltas:** [`../character-emma.md`](../character-emma.md) §2.1 (style anchors). This file expands the "Korean manhwa / webtoon, slice-of-life subgenre" anchor into specific reference-style names and what each contributes.

---

## Why a reference-styles document

The character bible says "Korean manhwa / webtoon, slice-of-life subgenre". That's directionally right but underspecified — manhwa is a 30-year publication tradition with multiple aesthetic lineages, and "slice of life" within it covers everything from Yumi's Cells (deliberately simple cartoon) to True Beauty (polished webtoon-pretty) to The Sound of Your Heart (rough sketchy). A future asset author commissioning a vector re-trace, or running another AI-generation pass after PNG-in-SVG, needs more guidance than "manhwa".

This document names specific reference styles and what each contributes — line weight, palette, eye design, body proportions. **No reference is to be traced from.** The shipping artwork is original; references inform direction.

---

## Primary reference: slice-of-life webtoon teacher characters

### What we're aiming for

A young teacher / older sister character drawn in the **soft-line, gentle-palette, naturalistic-proportion** branch of manhwa. The specific tonal sibling per the bible is **Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon character design.**

### Reference styles by attribute

| Attribute | Reference direction | What it contributes |
| --- | --- | --- |
| **Line weight** | 1.5–2 px clean digital lineart at iPad render. Reference: contemporary Naver/Kakao webtoons in the slice-of-life lane (e.g., *Yumi's Cells*-era naturalistic line, NOT *Tower of God*-era heavy/dynamic line). | Lines should read as warm and confident, never sharp or stylised. Hard rule: no double-stroke / heavy-shadow lineart common in shonen-adjacent manga. |
| **Palette** | Warm pastels — peaches, soft pinks, creams, warm browns. Reference: Studio Ghibli's *Whisper of the Heart* palette (warm pastels, no saturated primaries) more than any specific manhwa. | The world palette already lives in `--my-rose`, `--my-pink-50`, `--my-cream`. Emma extends it into skin (`--emma-skin` #F5DCC9), hair (`--emma-hair` #5C3F31), and outfit (`--emma-cardigan` #F0CDB8) — same warmth-temperature, no clash. |
| **Eye design** | Manhwa-sized eyes: ~30–40% larger than realistic (Dave's load-bearing number per developmental research §Q4), single cream catchlight upper-right, 3 short upper-lash strokes per eye, no lower lashes, iris ~70% of opening. Reference: webtoon-style female protagonist eyes, NOT anime-style multi-catchlight glamour eyes, NOT chibi 60%+ eyes. | Below 30% size and emotion legibility drops; above 40% slides into chibi/infantile (wrong tone for a teacher). The single-catchlight rule prevents drift toward "anime sparkle eyes" attractor state. |
| **Body proportions** | ~6.5 heads tall (manhwa softening of an 8-head adult). Reference: contemporary slice-of-life webtoons — adult body, not chibi/super-deformed. | A teacher reads as adult; chibi proportions read as child or mascot, both wrong. The 6.5-head softening (vs realistic 7-8) keeps the soft warm tone without infantilising. |
| **Face shape** | Round friendly face, face/head ratio ~1:1.1. Reference: manhwa "kind female protagonist" archetype — softer than anime sharp jawline, less round than chibi. | Round-but-not-baby-round is the line. Sharp jawline reads stern; baby-round reads infantile. |
| **Wardrobe / silhouette** | Modern casual, layered, warm. Cardigan over blouse, knee-length skirt OR jeans, flats. Reference: contemporary webtoon-teacher / older-sister archetype (cf. supportive-mentor characters in Naver slice-of-life series), NOT the "anime sensei" school-uniform attractor. | The bible explicitly bans school uniform, mini-skirt, maid outfit, and "sexy teacher" trope. The cardigan-and-skirt look short-circuits all four attractors at once. |
| **Hair** | Medium-length soft natural waves OR simple low ponytail. Warm dark brown. Reference: realistic-natural manhwa hair, NOT anime-stylised "two huge twin-tails" or "hair that defies gravity". | Soft natural reads as a real person Marian could meet. Stylised manga hair reads as mascot. |
| **Stylization parameter** | If using AI generation: Midjourney `--s 250` (manhwa lives in 150-400; below 150 reads flat, above 400 over-stylizes into anime). | This is hard-won from Thomas's PR #98 + #108 generation passes. Lower stylize than 150 = manga-magazine flat; higher than 400 = over-rendered anime drift. |

### What we're NOT aiming for (anti-references)

| Style | Why excluded |
| --- | --- |
| Anime (Naruto, Demon Slayer, sharp dynamic shonen) | Lines too sharp, action poses inappropriate, eyes too anime-stylised. |
| Chibi / super-deformed | Infantilising; reads as child or mascot, not teacher. |
| Disney 3D / Pixar | Wrong medium (we're SVG-2D), wrong tonal register (Pixar facial proportions slide toward "appealing-mom" attractor). |
| Mecha / sci-fi / cyberpunk | Genre mismatch. |
| Romance-novel / shoujo-with-stars | Sexualising attractor state; "sexy teacher" trope is hard-banned. |
| Classroom-uniform institutional | Authoritarian read; teacher should be approachable older-sister, not authority figure. |
| Sanrio-derivative cute | Project explicitly dropped Sanrio IP on 2026-04-28; drifting back toward Sanrio aesthetic re-introduces the IP risk that motivated the pivot. |
| Shouty animated emotion (sweat drops, exaggerated rage marks, anime-style nosebleeds) | Wrong tonal register for a tutor app; emotional vocabulary is "warm small smile / curious tilt / gentle yes", not "mood whiplash". |

---

## Tonal sibling — Studio Ghibli's calm warmth

The bible's key one-line direction: "**Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon character design.**" This pairing is specific:

- **From Ghibli:** the warmth temperature, the absence of cynicism, the way characters _watch_ rather than _emote_, the cream-and-warm-brown palette grounding, the absence of speed lines or motion-blur dynamism. Ghibli characters are present and patient; that's exactly the register Emma needs.
- **From slice-of-life webtoon:** the line weight (digital, clean, slightly heavier than Ghibli's hand-drawn), the eye sizing (manhwa 30-40% upscale vs Ghibli's near-realistic), the modern casual wardrobe vocabulary (cardigans, blouses, flats) which Ghibli films don't typically render.

The cross is what gives Emma her specific niche: **digital-clean enough to render crisp on iPad Retina, warm enough not to feel like an instructional poster character**.

---

## Specific reference checks for the asset author

When commissioning a vector re-trace (per `asset-fidelity-followup.md`) or running another AI-generation pass, check the candidate against this list of specifics. Each maps to a bible decision:

- [ ] **Eye iris colour is warm dark brown (#3E2818), NOT black.** Black reads anime; warm dark brown reads manhwa.
- [ ] **Mouth fill is soft rose (#C77A7A), NOT bright red.** Bright red reads anime / lipstick / mascot.
- [ ] **Cardigan is peach (#F0CDB8), NOT pastel pink or saturated.** Peach extends the warm-cream palette; pink slides toward Sanrio territory; saturated reads cartoon.
- [ ] **Skin tone is warm cream (#F5DCC9), single-stop shadow companion only.** No multi-tone shading stack; the world is flat-fill SVG-friendly.
- [ ] **Hair is dark warm brown (#5C3F31), NOT black, NOT blonde.** Black drifts anime; blonde drifts mascot; dark warm brown is the manhwa-natural read.
- [ ] **Optional bow is soft rose (`--my-rose`), single, ~16pt, on LEFT side.** Not Sanrio-oversized; not double-bow; not centre-back.
- [ ] **No glasses, no clipboard, no red pen, no chalkboard.** All authority-teacher props are banned.
- [ ] **Wand-pointer is wood-toned, slim (4-6 px stroke at full-body viewBox).** Not sparkly fairy wand, not magic wand with stars, not metallic, not exaggerated length.
- [ ] **Body weight is even on both feet in idle.** Not weight-shifted to one hip ("contrapposto" is a fashion-pose attractor; even-weight reads grounded).
- [ ] **Single cream catchlight upper-right per eye.** Multi-catchlight reads anime-glamour; no catchlight reads dead-eyed.

---

## Process notes for the next asset pass

If a vector re-trace happens (per `asset-fidelity-followup.md`), the recommended process — adapted from `character-emma-ai-prompts.md` §4 + §6:

1. **Pick ONE source.** If tracing from existing PNGs (the current PNG-in-SVG wrapper content), use those directly — they were Thomas-approved as the v1 direction. If re-generating from scratch, pick ONE AI tool and stick with it (mixing tools across the 8 poses guarantees inconsistency).
2. **Lock the `idle` reference first.** Generate or trace the idle pose. Iterate until it lands cleanly against this file's checklist + `character-emma.md` §2 spec. Then EVERY other pose must match the idle for face, hair, outfit, palette.
3. **Check each pose against the anti-references list above.** If a pose drifts toward anime / chibi / Sanrio / classroom-uniform, re-trace or re-generate.
4. **Run final SVGs through SVGO.** The codebase's default SVGO config strips comments, indentation, and redundant attributes — gets file size down to the spec budget (8-9 KB per pose).
5. **Match the existing `data-pose` filename slots.** `emma-{idle,listening,celebration,puzzled-tilt,attentive-pointing,sleepy,cheering,waving}.svg`. Devon's app code references these strings; renaming requires a coordinated PR (cf. PR #104).

---

## Provenance

- **Bible:** `design/character-emma.md` §2.1 (style anchors).
- **AI prompt sheet:** `design/character-emma-ai-prompts.md` §1b (reading the base prompt) — every adjective in the base prompt is doing work, this file expands those adjectives into reference-style names.
- **Developmental constraints (Dave):** `design/research/character-emma-developmental-fit-86c9hjnq1.md` §Q4 (eye sizing 30-40%) + §Q5 (forbidden + permitted body language).
- **Locked decisions:** memory `project_character_pivot_emma_2026_04_28.md` (Thomas-approved 2026-04-28: bow only, glasses dropped, manhwa/webtoon teacher locked).
- **No copyrighted imagery is included or referenced as source-material in this file.** Style names refer to publication traditions, not specific copyrighted works; any specific work cited is for tonal-direction reference only, not as a source to trace.
