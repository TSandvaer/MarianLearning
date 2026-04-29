# Emma — AI image-generation prompts

**Audience:** Thomas (operator of Midjourney / DALL-E / Stable Diffusion).
**Author:** Marian Tutor design persona.
**Companion specs:** `design/character-emma.md` (visual source-of-truth); `design/research/character-emma-developmental-fit-86c9hjnq1.md` (Dave's developmental constraints).
**Status:** Paste-ready. Open the file, copy a string from §1 + §2, paste into your tool, generate.

---

## How to use this file

1. Pick **one** prop variant in §1 (wand-pointer OR open book — lock for your full session of generations to keep the character consistent).
2. Copy the **base prompt** in §1 verbatim. This is the consistency seed — the same paragraph goes into every generation.
3. Append **one** per-pose fragment from §2 (idle, listening, celebration, puzzled-tilt, attentive-pointing, sleepy, optional cheering, optional waving).
4. Append the **negative-prompt block** from §3 in the syntax your tool uses.
5. Generate. If the first generation is good, capture its image URL — use it as `--cref` for subsequent poses (Midjourney) or paste it as a reference image (DALL-E "edit / variations").
6. If five generations of one pose all drift from spec, fall back to commissioning a real illustrator (§6, Decision 2 fallback).

**Per-generation budget:** ~30-60 seconds in tool. **Per-character bible:** budget 2-3 hours of Thomas's time across 8 poses including iteration.

---

## 1. Base prompt — consistency seed

This is the load-bearing paragraph. **Re-use it byte-for-byte across every generation.** Variation in this block is the #1 cause of character drift between poses.

> **Single character, full body, centered, square composition, 1:1 aspect ratio.** A young female teacher named Emma, age 25 to 30, drawn in **modern Korean manhwa / webtoon style**, slice-of-life educational subgenre. Clean digital line art with soft pastel colors. **Round friendly face**, large warm expressive eyes about 30 to 40 percent larger than realistic proportions (manhwa eye sizing — **not chibi, not anime**), simplified small nose with a two-stroke L-shape and no nostrils, expressive mouth with soft rose color (not bright red). **Hair: medium-length, soft natural waves OR simple low ponytail; warm dark brown or soft black.** A small soft-pink bow on the left side of her hair, used as a hair tie (never a Sanrio-style oversized ribbon). **Outfit: modern casual** — peach or cream cardigan or soft sweater over a cream blouse with a soft V-neckline, paired with a knee-length mauve-pink skirt OR simple jeans. Cream flats. The outfit is **modest, comfortable, layered, and warm** — explicitly NOT a school uniform, NOT a maid outfit, NOT a sexy-teacher trope. Body proportions are naturalistic (about 6 to 7 heads tall — manhwa softening of adult proportions), no exaggerated chest, no short skirt, no high heels, no makeup detail. **Palette: warm pastels** — warm browns, peach, soft pink, cream, soft mauve — no saturated primary colors. Skin warm cream tone (#F5DCC9). Hair warm dark brown (#5C3F31). Soft single-stop shading per color zone, no heavy shadow stacks, soft cel-shading aesthetic. **She holds a thin wooden wand-pointer in her LEFT hand at her side** (a slim pointer-stick, not a magic wand, not a sparkly fairy wand — a teacher's pointer). **Background: solid soft cream or pale-pastel neutral** (#FFF6EE or similar) so the character can be cleanly masked. **Single character only — no other figures, no text, no logos, no UI overlays.** Tonal sibling: Studio Ghibli's calm-observant-kind warmth crossed with slice-of-life webtoon character design. Read-on-first-look identity: a kind young teacher / older sister you'd want to spend a Saturday with.

### 1a. Prop variant — pick ONE and lock for the full session

**Variant A — wand-pointer (default).** Use the base prompt exactly as written above. The wand sits in her LEFT hand for `idle`, `listening`, `celebration`, `puzzled-tilt`, `sleepy`. It rises to a 45° angle for `attentive-pointing`. It is held loosely or lowered for `cheering` / `waving`.

**Variant B — small open book (alternate).** Replace the sentence "She holds a thin wooden wand-pointer in her LEFT hand at her side" with: "She holds a small open hardcover book in both hands at chest height, fingers on the page edges, content unreadable — pure prop, not a story element." The book replaces the wand across all poses; `attentive-pointing` becomes "her LEFT hand lifts off the book to point softly toward the right side of the frame." **Only pick this if the wand consistently fails to render correctly** — wand is the v1 default per `design/character-emma.md` §4.4.

> **Lock the prop choice before generating the 8 poses.** Mixing wand and book across poses guarantees inconsistency.

### 1b. Reading the base prompt

Every adjective in the base paragraph is doing work:

- "**Manhwa, not anime, not chibi**" — manhwa is softer line, naturalistic body proportions, eyes 30-40% larger (not 100% larger like anime). Chibi = infantile, wrong tone for a teacher.
- "**Eyes 30-40% larger**" — Dave's load-bearing number per developmental research (§Q4). Below 30% the emotion legibility drops; above 40% slides into chibi.
- "**Modest, comfortable, layered**" — short-circuits sexy-teacher / maid-outfit attractor states common in image generators trained on anime data.
- "**Warm pastels, no saturated primaries**" — anchors the palette to the existing app world (`--my-rose`, `--my-cream`); saturated primaries read mascot/cartoon, wrong tone.
- "**Solid soft cream background**" — gives Devon a clean masking edge for SVG tracing.
- "**Single character only**" — image generators love to add extra figures (students, classroom). Don't let them.

---

## 2. Per-pose fragments

Append **one** fragment to the base prompt. Each fragment is additive — do not remove or alter the base prompt.

### 2.1 `idle` — default / breathing baseline

> **Pose: idle.** Calm neutral expression, gentle small smile (closed mouth in a soft parabola arc), eyes relaxed and warm looking forward, head straight. Both arms relaxed at her sides; LEFT hand holds the wand-pointer vertically against her thigh. Standing relaxed, weight even on both feet. Soft natural breathing posture. **No exaggerated emotion** — this is the resting-state baseline pose all other poses animate from.

### 2.2 `listening` — mid-caption-reveal (Marian listening to TTS)

> **Pose: listening.** Attentive, gently engaged. Slight forward lean (about 5 degrees), shoulders soft. Eyes warm and looking forward toward the viewer-as-Marian, top eyelid drops 1 to 2 pixels (very subtle "I'm listening to you" softening). Mouth closed in a small soft smile, slightly narrower than idle. Head straight or with a tiny 2-degree turn toward the viewer. Both arms still at sides; wand still vertical in left hand. **Reads as: "I am paying attention to what you're saying."** Calm, never intense or staring.

### 2.3 `celebration` — correct-answer reaction

> **Pose: celebration.** Warm smile, mouth open in a soft "o" shape with three upper teeth visible (no more), corners of eyes crinkled with genuine delight. Catchlights in eyes brighter than baseline. Soft cheek blush (#F4A8A8). Head tilted gently to her LEFT about 6 degrees (not down, purely sideways — sideways tilt only). RIGHT hand raised palm-up at shoulder height in a small "yes!" gesture (NOT both arms up — that is reserved for session-end). LEFT hand still holds the wand at her side. **Sparkle particles can be added in post — do not draw them in this generation.** Reads as: "Yes, that's right!" — warm and proud-of-the-effort, NOT "OMG AMAZING JOB". No jumping, no exaggerated motion lines.

### 2.4 `puzzled-tilt` — wrong-answer reaction (load-bearing per Dave §Q5)

> **Pose: puzzled-tilt.** **Curious, NOT disappointed. Reads as "Hmm, interesting — let's look at that."** Head tilted **purely sideways** to her RIGHT about 10 degrees — NEVER tilted downward (downward head tilt with eyes-up is on the forbidden list — it reads as judgmental). **BOTH eyebrows raised slightly in genuine curiosity** (not lowered, not furrowed, not asymmetric one-up — both raised together about 3 pixels). Mouth open in a small soft "oh" shape — narrow oval, no teeth visible, soft rose color. **Critical: her eyes are looking DOWN-RIGHT, toward where a math problem would be on a tablet screen — NOT looking at the viewer.** Gaze is on the problem, not on Marian. RIGHT hand raised to her chin in a loose thinking-fist (thumb against jaw, knuckles loose — NOT a tsk-tsk wagging finger). LEFT hand still holds the wand at her side. **Body posture: very slight forward lean (3 degrees max), engaged but never looming.** Reads as: "Hmm, let's look at that one again together." NEVER as: disappointed, scolding, sad, or "I expected better."

### 2.5 `attentive-pointing` — hint state (Math/Word Song after 2 wrong attempts)

> **Pose: attentive-pointing.** Idle face (calm, neutral, small smile) but her LEFT arm is lifted and her LEFT hand holds the wand-pointer at a 45-degree angle, **wand tip pointing DOWN-RIGHT toward the lower-right of the frame** (where a problem would render on a tablet). Her eyes track along the wand tip — gaze follows the wand toward the problem area, NOT looking at the viewer. Slight forward lean (about 4 degrees). Mouth closed in a small soft helpful smile. Body weight slightly forward on left foot. **The wand carries the pointing direction — Emma's body is calm and steady, no exaggerated reaching.** Reads as: "Look here with me." NEVER as: pointing AT the viewer (Marian); the wand points at the problem, not at the camera.

### 2.6 `sleepy` — end-of-session / sleep-splash

> **Pose: sleepy.** Eyes closed in soft relaxation (single gentle arc per eye, no creases — relaxed, NOT exhausted, NOT squeezed-shut). Closed-mouth gentle smile, very slight upward curve. Head tilted about 8 degrees to her LEFT side AND about 10 degrees forward (a soft "winding down for the day" tilt, not a slump, not a head-droop). Optional: RIGHT hand raised loosely to near her mouth in a small soft yawn gesture, fingers curled gently (not a fist). Body posture slightly relaxed — shoulders softer than idle, no slumping. LEFT hand holds the wand lowered, tip touching the ground. **Reads as: "Good session — I'm winding down too."** NEVER as: exhausted, sad, defeated, or sighing.

### 2.7 `cheering` — session-end big celebration (OPTIONAL)

> **Pose: cheering.** **BOTH hands raised palms-out at shoulder height** in a wide warm "yay!" gesture (this big-arms pose is reserved for session-end ONLY — not per-problem). Wide open smile, mouth fully open in a joyful soft smile shape, three to four upper teeth visible. Eyes warm and crinkled with delight, catchlights 1.5 times brighter than baseline. Head straight, no tilt. Soft cheek blush (#F4A8A8). LEFT hand still holds the wand but it is raised above her head as part of the cheer gesture. Body posture: standing tall and warm, slight chest-out posture (not aggressive — proud of Marian's session). **Reads as: "You did it!"** Joyful but warm, never overwhelming.

### 2.8 `waving` — session-end goodbye (OPTIONAL)

> **Pose: waving.** Standing relaxed, RIGHT hand raised to about head-height palm-out, fingers spread softly in a warm wave gesture. Gentle warm smile (closed mouth in a soft upward parabola). Eyes warm and looking forward toward the viewer-as-Marian. Head straight or tilted very slightly (2-3 degrees max) to her LEFT. LEFT hand still holds the wand at her side. Body posture: relaxed, slight weight-shift to one leg (a friend saying goodbye, not a teacher dismissing class). **Reads as: "Bye for now — see you tomorrow."** Warm, never longing, never clingy.

---

## 3. Negative / anti-prompts

Apply to every generation. Different tools use different syntax — pick the section for your tool.

### 3.1 Universal exclusion list (paste into any tool's negative field)

```
anime style, sharp anime line art, chibi proportions, super-deformed, big-head-tiny-body, oversized chest,
short skirt, pleated school uniform, sailor uniform, maid outfit, sexy teacher, romance cover art,
mecha, sci-fi, cyberpunk, mechanical parts, robot, android, smartphone, modern phone, laptop, computer screen,
glasses, eyeglasses, sunglasses, monocle, round spectacles,
disney 3d, pixar style, photorealistic, hyperrealistic, 3d render, cgi,
multiple characters, students, classroom full of children, crowd, group photo,
text overlay, captions, speech bubble, watermark, logo, signature, ui elements,
dark background, black background, monochrome, grayscale, sepia, neon colors, saturated primary colors,
sharp action pose, dynamic action, speed lines, motion blur, shouting, screaming, crying, tears,
folded arms, crossed arms, hands on hips, finger pointing at viewer, finger wag, pursed lips,
head tilted downward with eyes looking up, sighing pose, slumped shoulders, defeated posture,
raised eyebrow with downward head tilt, scolding pose, disappointed expression,
sweat drop, shocked face with distorted proportions, internal monologue text box, panel borders, manga page layout
```

### 3.2 Midjourney `--no` syntax (single-line for the prompt tail)

Append at the end of the full prompt (base + per-pose fragment):

```
--no anime, chibi, school uniform, maid, sexy teacher, glasses, smartphone, mecha, 3d render, photorealistic, multiple characters, text, watermark, logo, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, folded arms, crossed arms, hands on hips, pointing at viewer, finger wag, pursed lips, downward head tilt, sighing, slumped shoulders, raised brow with downward tilt, panel borders, manga panel layout
```

Plus standard Midjourney parameters:

```
--ar 1:1 --s 250 --v 6 --style raw
```

(`--style raw` reduces Midjourney's default beautification, which tends to push faces toward generic-pretty and away from manhwa-specific.)

### 3.3 DALL-E phrasing (in-prose negative)

DALL-E doesn't accept a negative-prompt parameter. Inline the exclusions inside the prompt instead. Append this block at the end of the base + per-pose fragment:

> **Style exclusions: this image is NOT anime (too sharp), NOT chibi (too infantile), NOT a school uniform (too institutional), NOT a maid outfit, NOT sexy-teacher trope, NOT photorealistic, NOT 3D-rendered, NOT Disney or Pixar style. Emma does NOT wear glasses or sunglasses. There is NO smartphone, laptop, or modern device visible. There are NO other characters in the frame — Emma is alone. NO text, captions, speech bubbles, or watermarks. Background is solid soft cream — NOT dark, NOT busy, NOT a classroom. NO speed lines, motion blur, sweat drops, shocked-face conventions, or manga panel borders. Body language: NEVER folded arms, NEVER hands on hips, NEVER pursed lips, NEVER head tilted downward with eyes looking up, NEVER pointing at the viewer (point at the problem, not at Marian), NEVER sighing or slumped, NEVER raised-eyebrow-combined-with-downward-tilt (the disappointed-teacher composite is forbidden).**

### 3.4 Stable Diffusion / SD3 / Flux

Use the §3.1 list as a comma-separated negative prompt in the negative field. Recommended sampler: DPM++ 2M Karras, 30-40 steps, CFG 6-8 (lower CFG keeps the soft pastel feel; higher CFG saturates colors). For SDXL or Flux, add `slice of life manhwa style, soft pastel colors, gentle lighting, cel shading` to the positive prompt as style anchors.

---

## 4. Tool-specific syntax notes

### 4.1 Midjourney

- **Character consistency across poses: use `--cref <image-url>`.** Generate the `idle` pose first. When you get one you like, copy its image URL from the Midjourney web interface (right-click → "Copy Image Address"). For all subsequent pose generations, append `--cref <that-url>` to the prompt. `--cref` weight defaults to 100; if the per-pose fragment isn't being respected, drop to `--cw 50` to prioritize the new pose over the reference. If face drifts, `--cw 100` and re-emphasize the per-pose body language inline.
- **Style consistency: use `--sref <image-url>`** for the SAME first image to lock palette and line-weight. Stack with `--cref` — both are independent.
- **Aspect ratio:** `--ar 1:1` for SVG-tracing-friendly square. If a pose needs more vertical room (like `cheering` with arms up), `--ar 4:5`.
- **Stylize:** `--s 250` (manhwa lives in the 150-400 range; below 150 reads flat, above 400 over-stylizes into anime).
- **Version:** `--v 6` or `--v 7`. Niji versions (`--niji 6`) push toward anime — avoid them despite the name.

### 4.2 DALL-E (OpenAI / ChatGPT)

- **Character consistency: partial.** DALL-E 3 doesn't have a true reference-image parameter. Workarounds:
  1. Generate `idle`. In the same conversation, ask: "Now show the same character (same hair, same outfit, same face shape, same age) in [pose-fragment]."
  2. ChatGPT will reuse the description but will still drift. Expect 30-50% face mismatch across poses.
  3. If drift is severe, use the "Edit" feature on the `idle` image to mask out the body and regenerate-in-context. This preserves the face better than a fresh generation.
- **Aspect ratio:** request "square aspect ratio" or "1024x1024" inline.
- **DALL-E moderation:** the word "teacher" combined with "young" can trip moderation in some sessions. If a generation is refused, rephrase to "a kind young woman in her late twenties who works as an educator" — it generally passes.

### 4.3 Stable Diffusion / SDXL / Flux

- **Use a manhwa-tuned LoRA** if available (search Civitai for "manhwa style", "webtoon style", "Korean illustration"). Drops the prompt-weight needed.
- **ControlNet for pose consistency:** generate `idle` first, then use ControlNet OpenPose with the `idle` image as the pose reference for all subsequent generations. Change ONLY the per-pose fragment. This is the single highest-leverage technique for character consistency in SD.
- **Face restoration: turn it OFF.** Adetailer and similar face-fix passes will push toward generic-pretty / photorealistic and break the manhwa stylization.

### 4.4 Cross-tool: pick ONE tool and stick with it

**Do not mix tools across the 8 poses.** Each tool has subtly different stylization defaults; mixing them is the #2 cause of character drift after varying the base prompt.

---

## 5. Output format guidance

- **Aspect ratio:** 1:1 square (1024×1024 minimum). Easier for Devon's SVG tracing — most icon/character SVG tools assume square viewBoxes. For `cheering` only, 4:5 portrait is acceptable if arms-up needs more room.
- **Background:** Solid soft cream (#FFF6EE) or pale-pastel neutral, **mask-friendly**. NOT a busy scene, NOT a classroom, NOT gradient skies. Devon traces the character only — background is discarded.
- **Resolution:** 1024×1024 minimum, **1792×1792 recommended max on longest side**. Do NOT upscale past 2000px — when multiple Emma renders are pasted into one Claude conversation, each image must be under 2000px on its longest dimension or the whole session is rejected ("dimension limit for many-image requests"). 1792 leaves headroom under that cap. If your tool defaults higher (Midjourney `--upscale`, DALL-E HD at 2048, SDXL at 2048+), downscale the export before pasting it into Claude / a design review thread. ImageMagick: `magick in.png -resize 1792x1792\> out.png`.
- **Single character, centered, 70-80% frame fill.** Too small and the face detail (eyes, mouth) loses legibility for Devon's SVG trace; too large and limbs get clipped.
- **No text in the image.** Image generators love to add fake-Korean-looking text to "manhwa" prompts. Negative-prompt blocks this; if it slips through, regenerate.
- **No UI overlays, watermarks, signatures.** Negative-prompt blocks; reroll if any appear.

---

## 6. Iteration / consistency strategy

If generation drifts from spec, here is the diagnostic ladder. Try each step before escalating to the next.

### 6.1 Common drift patterns and fixes

| Drift                                                               | Likely cause                                                | Fix                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Face mismatch across poses** (Emma looks like a different person) | No character-reference locked                               | Midjourney: use `--cref <best-idle-url>` on every subsequent pose. DALL-E: regenerate within the same conversation referencing "the same character as previous image." SD: use ControlNet OpenPose with the idle image as reference.                                                                                                         |
| **Wrong age** (looks 16 or looks 40)                                | Image generator's "young teacher" prior is unreliable       | Reinforce: "**a 25 to 30 year old young teacher, clearly an adult woman, NOT a teenager, NOT high school age, NOT middle-aged.**" If still wrong, try "late twenties young professional educator."                                                                                                                                           |
| **Outfit drift** (anime mini-skirt, school uniform sneaks in)       | Anime data in training set                                  | Escalate the outfit description: "**modest knee-length skirt OR full-length jeans, soft cardigan covering shoulders and arms, cream blouse with modest V-neckline, NOT a school uniform, NOT a mini-skirt, NOT a maid outfit, NOT sexy clothing.**" Add `--no school uniform, mini skirt, maid outfit, fan service` to Midjourney negatives. |
| **Eye size wrong** (too small reads boring; too big reads chibi)    | Stylize parameter off                                       | Midjourney: `--s 250` (300 max). Reinforce in prompt: "**eyes 30-40% larger than realistic — manhwa sizing, NOT chibi.**"                                                                                                                                                                                                                    |
| **Anime not manhwa** (sharp lines, dramatic shading, dynamic pose)  | Tool's default for "Korean illustration" is anime-adjacent  | Emphasize "**slice-of-life webtoon, soft cel-shading, NOT shonen anime, NOT dynamic action.**" Remove any "dramatic," "dynamic," or "intense" words from the prompt.                                                                                                                                                                         |
| **Hand on chin reads as scolding** (puzzled-tilt going wrong)       | Default thinking-pose drift toward "tsk tsk"                | Reinforce: "**hand to chin in a LOOSE thinking fist, thumb against jaw, knuckles relaxed, NOT a wagging finger, NOT a pointed index finger, NOT a tsk-tsk gesture.**" Verify head tilt is sideways, not down.                                                                                                                                |
| **Eyes looking at viewer in puzzled-tilt** (forbidden per §6.1)     | Image gen's default for "puzzled" character looks at camera | Reinforce: "**eyes looking DOWN AND TO THE RIGHT toward where a problem would render on a tablet screen, NOT looking at the camera, NOT looking at the viewer, gaze AWAY from the viewer.**" If still failing, add a pencil/notebook in the lower-right corner and direct her gaze there — then crop in post.                                |
| **Pointing at viewer in attentive-pointing** (forbidden per §6.1)   | Default pointing pose is at-camera                          | Reinforce: "**wand tip points DOWN-RIGHT, at the lower-right corner of the frame, NOT at the viewer, NOT at the camera. The wand is pointing INTO the scene, AWAY from us.**"                                                                                                                                                                |
| **Background becomes a classroom**                                  | "Teacher" prior pulls in classroom                          | Reinforce: "**SOLID soft cream background, NO classroom, NO chalkboard, NO desks, NO students, NO bookshelf — ONLY a flat soft-cream backdrop.**"                                                                                                                                                                                            |
| **Random text / fake-Korean characters** in the image               | Manhwa training data includes hangul                        | Add to negatives: "no text, no hangul, no korean characters, no signature, no watermark." Regenerate — this is hard to fix, easier to reroll.                                                                                                                                                                                                |

### 6.2 Escalation path

1. **First pose drift (1-2 generations):** adjust per §6.1 table, regenerate.
2. **Persistent drift (3-4 generations of one pose):** drop the per-pose fragment temporarily, get a clean idle that matches base prompt, then re-add fragment with stronger emphasis.
3. **Still drifting (5+ generations of one pose):** **fall back to commissioning a real illustrator.** Per `project_character_pivot_emma_2026_04_28.md` Decision 2 fallback: Fiverr / Behance manhwa-styled artists, $50-$200 for the 6-8 pose set. Real illustrators handle pose-consistency natively. Send them this file (`character-emma-ai-prompts.md`) plus `design/character-emma.md` as the brief.
4. **Single-pose escalation:** if 7 of 8 poses generate cleanly but ONE persistently fails, ship the 7 and commission a single-pose illustration for the holdout.

### 6.3 Quality gate — when to stop iterating on a pose

Stop and accept the generation when **all** of these are true:

- [ ] Face is recognizably the same character as your locked `idle` reference (Devon will stylize-trace anyway, minor variation is OK)
- [ ] Age reads 25-30 (NOT teen, NOT 40+)
- [ ] Outfit matches base prompt (cardigan + skirt OR jeans, modest, NOT uniform, NOT sexy)
- [ ] No glasses, no smartphone, no modern device
- [ ] No forbidden body language per §6.1 of `character-emma.md` (no folded arms, no hands on hips, no downward-tilt-with-upward-gaze, no pursed lips, no sigh, no raised-brow-with-downward-tilt composite, no pointing at viewer)
- [ ] Per-pose body language matches the fragment (e.g., for puzzled-tilt: sideways tilt, open "oh", brows raised, eyes on problem not viewer)
- [ ] Background is clean and mask-friendly (solid cream or near-cream, no classroom)
- [ ] No text, no watermark, no extra characters

If 7 of 8 boxes check, ship it — Devon's SVG trace cleans up minor issues. If 6 or fewer, regenerate.

---

## 7. Provenance + open questions

- **Brief:** ticket `86c9j63z1`, dispatched 2026-04-28.
- **Source-of-truth visual spec:** `design/character-emma.md` (PR #98 merged).
- **Developmental constraints:** `design/research/character-emma-developmental-fit-86c9hjnq1.md` (PR #97 merged) — Dave's Q4 (eye size 30-40%) and Q5 (forbidden + permitted body language) are quoted-in-spirit throughout this file.
- **Locked decisions:** `project_character_pivot_emma_2026_04_28.md` memory file — Decision 1 (bow only, glasses dropped), Decision 2 (Thomas operates the AI generator, Kyle and Devon trace).

### Open questions

1. **Prop variant lock** — wand-pointer (default §1.1 Variant A) or open book (§1.1 Variant B). **Default for v1: wand.** Thomas can override after one generation pass if the wand consistently fails.
2. **Tool choice** — Midjourney (best style consistency, paid), DALL-E (free with ChatGPT Plus, weakest consistency), Stable Diffusion / Flux (strongest pose-consistency via ControlNet, requires local setup). **No default — Thomas picks based on what's already paid for.**
3. **Sparkle particles for `celebration`** — drawn in the AI generation, or layered as separate SVG sparkles in the app? **Default: layered separately** (§2.3 instructs the prompt NOT to draw them) — the app already has `sparkle-particle.svg` and animates them. Drawing them in the AI image freezes their position.
