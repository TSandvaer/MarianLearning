# Word Song picture pack — iteration & consistency plan

**Audience:** Thomas (Midjourney operator, phase 2).
**Author:** Marian Tutor design persona.
**Ticket:** `86c9kww0h`.
**Status:** Workflow brief for phase 2 — Thomas owns the generation session.

This is the consistency-iteration plan for the v1 picture pack — the same problem you cracked on Phase 3b's 8 Emma poses, adapted for 22 object/animal subjects rather than 8 character poses.

The hard truth about generating 22 pictures that need to look like one illustrator made them: **Midjourney drifts.** Even with `--cref` and `--sref` locked, subject-to-subject consistency is harder for object packs than for character poses, because every subject is genuinely different (a cat is not a bus). The plan below front-loads the discipline — lock the style first, then run subjects against it — to minimize re-rolls.

**Estimated session budget:** 2-3 hours of Thomas's Midjourney time, including iteration. ~30-90 seconds per generation × 22 subjects × 2-3 attempts each on average = ~30-90 minutes of pure gen time + iteration overhead.

---

## 1. Pose-zero — the reference image

The single biggest consistency lever for the pack is locking ONE reference image first and chaining everything else off it via `--cref` and `--sref`.

### 1.1 Pick the pose-zero subject

**Recommendation: `dog`.**

Why:

- **`pic-dog.svg` already shipped** — Thomas already approved a dog illustration aesthetic for the pack via the existing asset, so generating a new `dog` confirms the new style aligns with what was already approved.
- **`dog` is mid-complexity** — has fur, ears, tail, eyes (so the gen has enough detail surface area to lock palette + line weight + shading style) but isn't as anatomically complex as `dad` (two-figure). A simple-subject pose-zero like `sun` would lock palette but wouldn't exercise line-weight + shading enough to be a useful reference for the rest of the pack.
- **Low forbidden-pair stakes** — `dog` has one forbidden-pair partner (`cat`) and the distinguisher (floppy ears + broader muzzle) is easy to lock visually. If the pose-zero needed to ALSO carry a hard discrimination, the iteration would compound.

**Alternative pose-zeros if `dog` doesn't lock cleanly in 5 generations:** `cat` (similar mid-complexity, but has the more-load-bearing forbidden-pair vs `dog`), then `cup` (very simple, palette-locking only), then commission a real illustrator for the whole pack and skip the AI-gen route per the predecessor pack's Option A fallback.

### 1.2 Pose-zero acceptance gate

The pose-zero is the reference for the entire pack. **Spend more time on it than on any other generation.** Accept only when ALL of these are true:

- [ ] Subject reads as a dog in <2 seconds at full resolution.
- [ ] Forbidden-pair distinguisher (floppy ears + broader muzzle, no whiskers) is clear.
- [ ] Line weight matches the style anchor (~2 px at 1024×1024 — eyeball check; same weight feel as Emma's lineart).
- [ ] Palette is warm-pastel, no saturated primaries, no neon, no pure black, no sepia.
- [ ] Single soft shadow companion per color zone — no multi-tone gradient stacks.
- [ ] Background is solid soft cream (#FFF6EE), flat, mask-friendly.
- [ ] Subject fills 60-75% of frame, centered.
- [ ] No text anywhere in the image.
- [ ] No second subject, no environment.
- [ ] **Looks like it would sit harmoniously next to Emma's `emma-idle.svg` on the same screen.**

If any "no" — regenerate. The pose-zero costs you 5-10 minutes more than other gens; that pays back across the other 21 generations.

### 1.3 Capture the pose-zero URL

Once pose-zero is accepted:

1. Open the generated image in Midjourney's web interface.
2. Right-click → "Copy Image Address" (or use the `... > Copy` menu).
3. Paste the URL into a scratch note — you'll append it to every subsequent prompt as `--cref <url>` and `--sref <url>`.

**Save the prompt + parameters used to generate the pose-zero.** Future packs (short-o, short-u, etc.) should re-use the same pose-zero reference for cross-pack visual cohesion.

---

## 2. Common preamble strategy

Every prompt in `picture-pack-prompts.md` already has the style preamble (`picture-pack-style-anchor.md` §2) inlined verbatim. Do not paraphrase it. Do not abbreviate it. Variation in the preamble across prompts is the #1 cause of style drift — same lesson Thomas hit on Emma's 8 poses (per `character-emma-ai-prompts.md` §1b).

**Preamble byte-equality is non-negotiable.** If you find yourself wanting to "tighten" a phrase mid-session, stop and either:

1. Update `picture-pack-style-anchor.md` §2 first (a doc-only edit), then regenerate ALL previously-accepted images with the new preamble. OR
2. Don't tighten. Ride out the iteration and ship the original preamble.

Mid-session preamble divergence is what caused Emma's pose drift in PR #103 + #107 (per `design/character/asset-fidelity-followup.md`).

---

## 3. Generation order

Run subjects in this order. The order is designed to surface the hardest cases early so they can be re-rolled without invalidating later work.

### Tier A — Pose-zero + immediate validators (run first)

1. **`dog`** — pose-zero. Lock the style.
2. **`cat`** — most-tested subject (largest forbidden-pair-pressure rhyme family). Validates that pose-zero's style holds when subject changes substantially.
3. **`man`** — first human subject. Validates that the minimal-facial-detail rule lands correctly.

If any of these three fail to lock cleanly, **stop and reassess** — either the pose-zero itself is bad (regenerate it), or the prompt sheet has a fundamental issue, or Midjourney just isn't going to work for this pack and you fall back to commissioning a real illustrator.

### Tier B — Forbidden-pair partners (run second)

The forbidden-pair partners need to ship as visually-distinct duos. Run them adjacent so you can check at-a-glance distinction:

4. **`hat`** — pair-partner of `cap`.
5. **`cap`** — must visibly differ from `hat` at a glance.
6. **`pan`** — pair-partner of `pot`.
7. **`pot`** — must visibly differ from `pan` at a glance.
8. **`bus`** — pair-partner of `van`.
9. **`van`** — must visibly differ from `bus` at a glance.
10. **`dad`** — pair-partner of `man`. The two-figure composition rule is the discriminator.

### Tier C — Remaining target words

11. `bat` — Sanrio-style friendly is the load-bearing constraint; budget extra iterations.
12. `mat`
13. `bag`
14. `fan` — anti-anthropomorphism check (fan-with-face is a known drift).
15. `can`
16. `tag`
17. `jam`

### Tier D — Remaining distractor-only pictures

18. `sun` — anti-anthropomorphism check (sun-with-face is a known drift).
19. `fox`
20. `cup`
21. `pen`
22. `log`

**Why this order:** the pose-zero validates the style. Tier B forbidden-pair partners validate the distinguisher rules. Tier C and D are lower-stakes — they fail harmlessly if individual gens drift, because they have no forbidden-pair pressure.

---

## 4. Per-generation parameter chain

For each generation **after pose-zero**:

```
[full prompt from picture-pack-prompts.md row]
--cref <pose-zero-url> --cw 80
--sref <pose-zero-url>
--ar 1:1 --s 250 --v 6 --style raw
--no anime, chibi, school uniform, sexy, photorealistic, 3d render, multiple subjects, text, watermark, logo, signature, dark background, monochrome, neon, saturated primaries, speed lines, sweat drop, sketch lines, manga panel, gradient sky, classroom, environment, scene background, drop shadow under subject, hangul characters, korean text, fake text, anthropomorphised vehicle, anthropomorphised object, smiling fan, smiling bus, fan with face, bus with face
```

**`--cw 80` rationale:** character-weight at 100 forces too-strong adherence to the reference (a generated `bus` would inherit `dog`-shape). 80 keeps the line/palette/shading consistent while leaving room for the subject to be genuinely a different object.

**For the pose-zero itself,** drop `--cref` and `--sref` (no reference yet exists). Just the prompt + universal parameters + `--no` block.

---

## 5. Drift table — common failures and fixes

These are the drifts to expect. Each row maps a failure to the fix; same diagnostic-ladder structure as `character-emma-ai-prompts.md` §6.1.

| Drift | Likely cause | Fix |
| ----- | ------------ | --- |
| **Subject doesn't read as the target noun** at full res | Prompt subject-specifics are underweight against the heavy preamble | Move the subject-specific clause to the front of the prompt (Midjourney weights early tokens). Or duplicate the disambiguating feature: "**a cat with pointed-up triangular ears, whiskers visible, and a curled tail — clearly a cat, not a bunny, not a fox**." |
| **Style drifts** between subjects (line weight changes, palette shifts) | `--cref` / `--sref` not appended, OR `--cw` too low | Verify both flags are on every prompt. Raise `--cw` to 90 if 80 isn't enough. |
| **Photorealistic / 3D-rendered** output | `--style raw` missing, OR Midjourney version drift | Add `--style raw`. Check `--v 6` (avoid `--niji` versions; they're anime-tuned). |
| **Background isn't solid soft cream** | Prompt's background instruction is buried | Repeat the background instruction at the END of the prompt: "**Background is SOLID soft cream (#FFF6EE) — flat, no scene, no environment.**" |
| **Anthropomorphised object** (fan with eyes, bus with smile) | Midjourney's children's-book prior loves friendly faces on objects | Add to inline negatives: "the fan has NO eyes, NO mouth, NO face — pure object render." Re-roll. If persistent, drop the "friendly tone" phrase from the preamble for this specific subject and re-emphasize "pure object render, no anthropomorphism." |
| **Saturated primary colors** appear (red apple, blue bus, yellow sun) | Object-specific color drift toward photographic | Re-emphasize: "**desaturated illustrated palette, NOT photographic, NOT saturated.**" Consider naming the exact desaturated hex range for the object color. |
| **Multiple subjects** (a cat with a ball, two dogs) | "Single subject" instruction lost mid-prompt | Repeat at end: "**ONE subject only — NO accompanying objects, NO second subject.**" |
| **Text or fake-Korean characters** appear | Manhwa training data includes hangul | Add to negatives: "no text, no hangul, no korean characters, no signature, no watermark." Re-roll — this is hard to fix in-prompt, easier to roll. |
| **Subject fills frame too tightly** (limbs clipped) | Frame composition drift | Specify: "subject fills 60-75% of frame with margin on all sides, fully visible, no clipping." |
| **Shading is multi-tone / painted** | "Cel-shading" is being interpreted as soft painted | Tighten: "**single soft shadow companion per color zone — exactly TWO tones per zone (base + one shadow), no gradient, no soft falloff, no painted shading.**" |
| **`bat` looks scary or fanged** | Default Midjourney "bat" is Halloween-coded | Re-emphasize: "**friendly cute Sanrio-style bat with big warm eyes, NO fangs, NO sharp teeth, NO horror, NO Halloween, like Kuromi cute, like a Pokemon Zubat but friendlier.**" |
| **`dad` is single-figure** (no child) | Two-figure composition is unusual for a generative model | Reinforce at the start of the prompt: "**TWO-FIGURE composition: an adult man on the left holding a small child's hand on the right.**" |
| **`man` and `dad` faces are too detailed** (compete with Emma) | "Minimal facial detail" is interpreted loosely | Tighten: "**MINIMAL facial detail — eyes drawn as TWO SMALL DOTS, no detailed nose, mouth as a SHORT SIMPLE LINE — silhouette-style face, NOT a fully rendered character.**" |
| **Forbidden-pair partners look too similar** (cat looks like dog, or cap looks like hat) | Distinguisher feature underweight | Move distinguisher to the start of the prompt: for `cat`, "**A cat with pointed-up triangular ears and visible whiskers — pointed ears are critical, NOT floppy ears, NOT a dog, NOT a bunny.**" |

---

## 6. Variant fallbacks — when one subject doesn't gen cleanly

Some subjects are harder than others. Per pose-zero rule from §1, accept the pose-zero may take 5-10 attempts. For other subjects, here is the escalation ladder:

### 6.1 Single-subject persistent drift

If after **3 attempts** with the standard prompt, a subject doesn't pass the acceptance gate (§§4-5 of `picture-pack-prompts.md`):

1. **Try the variant prompt.** Some subjects below have explicit variant fragments — switch to the variant.
2. **Tighten the disambiguator.** Move the distinguishing feature to the start of the subject-specific clause; double-emphasize.
3. **Drop `--cref` for one attempt.** Run the subject prompt + style preamble + `--sref` only. See if the result lands. If it does, manually trace it; the loss of `--cref` will mean line-weight/character-feel drift but `--sref` should hold palette.
4. **Switch tools.** If 5+ attempts fail in Midjourney, try DALL-E or Flux-via-Replicate for that single subject. Per `character-emma-ai-prompts.md` §6.2, single-pose escalation is acceptable — ship 21 from Midjourney and 1 from another tool, manually trace both to SVG so the trace cleans up the tool difference.

### 6.2 Variant prompts (per-subject fallbacks)

| Subject | Standard prompt | Variant fallback prompt fragment to try |
| ------- | --------------- | ---------------------------------------- |
| `bat` | "friendly cartoon bat, wings spread, big eyes, no fangs" | "**a small soft purple cartoon bat shaped like a Pokemon Zubat but friendlier and rounder, wings spread, big round warm eyes, tiny smile, NO fangs, NO horror — illustrated for a children's vocabulary book**" |
| `dad` | "two-figure parent-with-child" | "**a wide-shot composition of a stylised cartoon dad on the left and a small stylised cartoon child on the right, both standing facing forward, the dad's hand visibly clasping the child's hand between them, both with minimal-detail silhouette-style faces (small eye dots, no detail)**" |
| `mat` | "rectangular woven mat, weave pattern" | "**a small rectangular bath mat lying flat on the ground, viewed from a high three-quarter angle, with three simple horizontal stripes across its surface, soft cream base color**" |
| `tag` | "price tag with string loop" | "**a simple paper price tag, viewed at slight angle, with a hole punched at the top and a single beige cotton string looped through the hole hanging down — like a luggage tag or hang-tag**" |
| `pen` | "ballpoint pen, side view, cap and clip" | "**a simple ballpoint pen drawn diagonally across the frame from upper-left to lower-right, soft warm-rose pen body, visible silver writing tip on the lower-right end, small clip on the upper-left end — clearly identifiable as a pen, not a stick**" |
| `log` | "wood log, end-grain rings" | "**a horizontal wood log with one end-cut visible showing concentric circular tree-rings — the cut end faces the viewer slightly so the rings are clearly visible, soft warm-brown bark on the cylindrical body**" |

### 6.3 Hard-fall fallback: drop the AI-gen route

If 3+ subjects fail after their variant fallback, the pack isn't going to land cleanly via Midjourney. Stop the AI session and escalate to Matt for re-routing — likely back to the predecessor pack's Option A (commission a single illustrator on Fiverr per `design/word-song-picture-pack.md` §"Sourcing options").

**Do not ship an inconsistent pack.** A 16-Midjourney + 6-illustrator pack would be visibly mismatched in a way Marian would notice; mismatched-style is worse than schematic-silhouette placeholders.

---

## 7. Quality gate — when to stop iterating on a subject

For each subject, accept the generation when ALL of these are true. Same shape as Emma's prompt sheet §6.3.

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style matches pose-zero (line weight, palette, shading style).
- [ ] Forbidden-pair distinguisher (per `picture-pack-prompts.md` row) is clearly visible.
- [ ] Background is solid soft cream, flat.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no logo, no UI overlay.
- [ ] No anthropomorphism (objects don't have faces).
- [ ] At a thumbnail-size preview (~96px), the subject is still identifiable.

If 7 of 8 boxes check, ship it — phase 3's SVG trace cleans up minor issues. If 6 or fewer, regenerate.

---

## 8. Output format — what phase 3 needs

When pose 2 is complete, hand phase 3 (Kyle/Devon trace pass) the following:

- **22 source images** — PNG or JPG, 1024×1024 minimum, ≤1792×1792 longest side (per `picture-pack-style-anchor.md` §3.1).
- **Filename convention:** `picture-{word}.png` matching the eventual SVG filename (e.g. `picture-cat.png` → `picture-cat.svg`).
- **Single source folder.** Drop into a phase-2 working directory like `design/word-song/sources/` (or wherever Thomas's MJ exports land — coordinate with phase 3 ticket).
- **No re-encoding.** Pass through the original Midjourney upscale at full resolution; phase 3 handles the trace + downscale.
- **Note the Midjourney prompt + URL for each source image.** A simple sidecar `sources.md` mapping word → MJ image URL → final accepted prompt is sufficient. This pays back if a phase 3 trace fails QA and someone needs to regenerate that specific subject.

Phase 3 then traces each PNG to SVG per the trace requirements in `picture-pack-style-anchor.md` §6, runs through SVGO, drops at `public/assets/pictures/picture-{word}.svg`, and updates `wordPictures.tsx` to switch from inline-SVG placeholders to `<img>` references.

---

## 9. Provenance + lessons inherited

This iteration plan inherits lessons from:

- **`design/character-emma-ai-prompts.md`** §6.1-§6.3 — the diagnostic-ladder + quality-gate structure.
- **`design/character/asset-fidelity-followup.md`** — the Phase 3b Emma assets shipped as PNG-in-SVG (not true vector), 22× over file-size budget. Lesson: **do not skip the SVG trace step in phase 3.** PNG-in-SVG might look fine on Thomas's screen but ships heavy and renders blurry on iPad Retina. Phase 3 must produce true vector geometry.
- **`design/character/reference-styles.md`** §"Process notes for the next asset pass" — single-source, lock idle first, run others against it. Same pattern, different subject set.
- **PR #98 + PR #108 generation passes (Thomas)** — established `--s 250` as the manhwa sweet spot and `--style raw` as the beautification-suppressor. Both inherited verbatim into this plan.
- **PR #103 + PR #107 (Phase 3b Emma poses)** — established that mixing tools across a pack guarantees inconsistency (`character-emma-ai-prompts.md` §4.4). Same rule applies here: stick with Midjourney for the whole pack.

The single most important lesson: **front-load discipline on the pose-zero, then enforce `--cref` + `--sref` byte-for-byte across the rest.** Pack consistency is won or lost in the first 10 minutes.
