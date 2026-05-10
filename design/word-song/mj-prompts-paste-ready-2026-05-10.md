# Paste-ready MJ prompts (v7) — 2026-05-10 prep

For Thomas's batched MJ session. Each word's prompt is a single fenced block ready to copy into the MJ Web UI prompt box. Aspect ratio set in GUI dropdown (1:1). All four short-i-walkthrough gotchas baked in per `.claude/docs/skill-trees-and-content.md` § "MJ prompt-engineering gotchas for picture-pack words".

**Source specs:**
- short-e: [`design/word-song/short-e-picture-pack-prompts.md`](./short-e-picture-pack-prompts.md), [`design/word-song/short-e-pool-expansion.md`](./short-e-pool-expansion.md)
- short-o-ext: [`design/word-song/short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md), [`design/word-song/short-o-pool-extension.md`](./short-o-pool-extension.md)

**Distillation deltas from the Kyle source specs (NOT silent — Thomas should know):**

1. **Stripped v6-only parameters.** Source specs trail with `--ar 1:1 --s 250 --v 6 --style raw`. Per `feedback_mj_moderator_negatives_per_word`, v7 rejects `--v 6 --style raw --s 250`; aspect ratio is set in the MJ Web GUI dropdown (1:1), not via `--ar`. Stripped from every prompt below.
2. **Stripped `--cref` / `--sref` / `--cw 80` pack-cohesion lever.** Per `feedback_mj_pack_cohesion_lever_unused`, Thomas never captured the `dog` pose-zero URL; the style preamble alone has carried 38+ assets to date. Inheriting the pattern: no `--cref` in any prompt below. If Thomas wants pack-cohesion via cref this session, he can append manually with the pose-zero URL handy.
3. **Replaced source-spec long `--no` blocks with tailored per-word `--no`.** Source specs ship a single 70-word universal `--no` block (every prior pack's smiling-X negation accumulated). Per `feedback_mj_moderator_negatives_per_word`, the moderator trips on long anti-anthro pasted blocks. Each prompt below carries 5-7 tailored `--no` entries: standard ballast (`photorealistic, 3d render, text, watermark`) + drop-shadow negation (always) + the per-word smiling-X attractor for THIS subject only + any subject-class-specific defenses (product-photography for textiles, mechanism-negation for prototype-vs-modern, motion-blur for spinning toys).
4. **Lead-with-noun rewrite.** Source-spec opening ("Single subject, centered, square 1:1 composition. A child-friendly illustrated [SUBJECT]...") replaced per gotcha #3 with `"A flat illustrated cartoon DRAWING of a [vivid prototype]..."`. Distilled per-word descriptions into ~30-50 vivid words from the source-spec full prompts (which run ~200+ words and exceed the v7 ≤40-50-word descriptive ceiling per the same memory).
5. **Drop-shadow negation now explicit per gotcha #4.** Every prompt's `--no` block includes `shadow, drop shadow, ground shadow` — closes the orphan-shadow-blob hazard remove.bg can't fix.

---

## Vocab-familiarity sanity check

Cross-checked both pools against Thomas's drop heuristic (he didn't know "rosehip" → Marian definitely won't; same for "wheel rim"). 8yo Manila-context Filipino L2 learner.

| Word        | Pool        | Verdict                | Rationale |
| ----------- | ----------- | ---------------------- | --------- |
| **bed**     | short-e     | SHIP                   | Universal, Marian uses one nightly. |
| **leg**     | short-e     | SHIP                   | Body-part vocab is universal; chair-leg framing avoids body-fragmentation per pool spec §10 Q3. |
| **hen**     | short-e     | SHIP                   | "Chicken" is universal in Manila; "hen" specifically is the female term but the picture carries it (same picture-grounds-meaning pattern as `mom`, `jam`, `hot`). |
| **pen**     | short-e     | SHIP (re-trace)        | Universal; this is the conditional re-trace per pool spec Q2. Re-trace recommended for tier visual cohesion. |
| **web**     | short-e     | SHIP                   | "Spider web" is universal in early-reader books; the spider absence is the recognition cue. |
| **net**     | short-e     | SHIP                   | Filipino fishing villages + butterfly nets in early-reader books. Universal. |
| **jet**     | short-e     | SHIP                   | "Jet plane" universal in early-reader books; Manila kids see planes overhead frequently. |
| **gem**     | short-e     | **BORDERLINE — pre-discuss with Thomas** | Per task brief, `gem` was flagged for vocab-check. "Gem" specifically is less common than "diamond" or "jewel" for an 8yo — it's a vocab-stretch picture-grounded word. Source-spec audit (§1) called it borderline. Recommended ship with the picture grounding the meaning (same logical move as `cot`, `hot`, `mom`); Thomas can drop if he wants to be conservative. **If dropped, pool falls to 8 — same as short-o pre-extension; cross-vowel-mode gate would still need 11.** Recommend ship. |
| **egg**     | short-e     | SHIP (with Phase 2 fallback) | Universal food. The Phase 2 fallback (drop if cream-on-cream contrast collapses) is documented in pool spec §10 Q1. |
| **cot**     | short-o-ext | SHIP                   | Vocab-stretch (Tagalog primary is *kuna* / *kama*); picture-grounds-the-meaning pattern. Source spec §3.5 confirmed in the Q1 lock. |
| **top**     | short-o-ext | SHIP                   | Spinning-top toys are universal in international picture books and Filipino kids see them via media. The winder-knob is the load-bearing disambiguator from "ice-cream cone" or "party hat". |
| **pop**     | short-o-ext | **AMBIGUITY-FLAG — Thomas already knew about this; reconfirm referent at MJ time** | Per task brief, `pop` is the known ambiguity case (lollipop vs soda vs popping action). Source spec commits to lollipop (sphere-on-stick); Phase 2 fallback to `cob` if 96pt review fails. **Reconfirm before generating: stick visibility at 96pt is the ENTIRE mitigation.** |
| **cob**     | short-o-ext | STANDBY only           | Phase 2 fallback for `pop`; only generate if `pop` lollipop chip's stick collapses at 96pt. Vocab risk (Tagalog *mais*) — but picture-grounds-the-meaning. |

**Net recommendation:** ship `gem` and `pop` with the source-spec mitigations baked into the prompts below. Drop `gem` and pool drops to 8 — neither short-e nor short-o-ext would be cross-vowel-mode-ready (need 11 each). Material risk on dropping; recommend ship.

---

## How to use

1. Set MJ Web GUI aspect ratio to **1:1** (square).
2. Copy a prompt block, paste into MJ Web UI, run.
3. When 4 variants land, evaluate against the per-word "selection criteria" listed below the prompt.
4. If batch fails, an escalation prompt is also provided per word.
5. Generate in the **recommended order** at the bottom of each section (highest-risk first).

**Pack-cohesion note:** the source specs all reference `--cref` / `--sref` to a `dog` pose-zero URL. Thomas has never captured that URL (per memory `feedback_mj_pack_cohesion_lever_unused`). The style preamble alone has carried 38+ assets to date. If Thomas wants to attach `--cref <dog-pose-zero-url> --cw 80 --sref <dog-pose-zero-url>` manually to any prompt below, fine — but it's optional. Default below: no cref, just the style preamble.

---

## short-e (9 words)

### 1. net   *— generate FIRST (highest cross-pack discrimination risk vs. `bag`)*

```
A flat illustrated cartoon DRAWING of a simple butterfly net with a clear round wooden frame holding a visible open-grid mesh of about 6 by 6 wide-spaced thin cream-colored cord cells, attached to a long warm-brown wooden handle extending diagonally, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, fish, butterfly, smiling net, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Open mesh holes are CLEARLY VISIBLE between the cord strands at 96pt — the mesh-vs-solid is the load-bearing discriminator vs. `bag`.
- Round/oval rigid frame is present (not just a free-floating mesh; that would collapse to `web`).
- Long handle extends from the frame, ~1.5x the frame diameter.
- No fish/butterfly caught in the net (multi-subject).
- Warm-pastel palette holds; no saturated primary blue handle.

**If batch fails:** strengthen mesh-visibility — try `"open-grid mesh with very wide gaps between thin cream cord strands, the holes between strands clearly larger than the strands themselves"`. If still solid-fabric reading, this is a high-risk asset; flag for sponsor review at chip-size before proceeding.

---

### 2. egg   *— generate SECOND (cream-on-cream contrast risk + FORBIDDEN_PAIR vs. `nut` + `bun`)*

```
A flat illustrated cartoon DRAWING of a single smooth chicken egg with a warm-tan #E8D4B5 shell and gentle soft cel-shading on the right side, completely smooth surface with no seam line, no score mark, no cracks, no speckles, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, slice-of-life Korean webtoon look, single subject --no photorealistic, 3d render, seam line, score mark, cracks, smiling egg, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Shell color reads warm-tan AGAINST the cream background — pure-white or pale-cream egg dissolves into background once remove.bg keys it.
- Smooth ovoid silhouette — broader at bottom, narrower at top.
- **NO seam line down the middle** (would collapse vs. `nut`).
- **NO horizontal score-mark on top** (would collapse vs. `bun`).
- No cracks, no Easter-egg patterns, no anthropomorphism.

**If batch fails:** push warmth further — `"warm-tan eggshell color #D4B896 with visible warm-tone variation"`. If contrast still collapses at 96pt against cream background, **this is the Phase 2 fallback trigger per pool spec §10 Q1: drop `egg` from the pool; pool falls to 8.** Document the drop and notify Matt; do not ship a low-contrast egg.

---

### 3. hen   *— generate THIRD (animal-class discrimination vs. `bug`/`rat`/`cat`/`dog`/`fox`)*

```
A flat illustrated cartoon DRAWING of a friendly cartoon hen viewed in three-quarter side perspective, plump rounded body in soft warm-cream feathers, small warm-yellow beak, prominent soft rose-pink comb on top of the head, two thin warm-yellow legs visible below the body, two large round friendly eyes, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no eggs visible --no photo, photorealistic, 3d render, eggs, chicken coop, rooster, smiling hen with cartoon eyebrows, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Comb on top of head is CLEARLY VISIBLE (load-bearing recognition feature; without it the silhouette reads as a generic round bird or duck).
- Beak + 2 legs + plump body — bird-class identifiers.
- Soft rose-pink comb (not saturated primary red).
- **NO eggs in the picture** (would conflict with `egg` chip).
- Friendly cartoon, not realistic chicken; no kawaii-overload (sparkle eyes, cheek-blush).

**If batch fails:** emphasize comb — `"large prominent rose-pink comb with three rounded peaks on top of the head"`. If hen comes back with eggs visible, regenerate with `--no eggs, eggs in nest, eggs nearby` strengthened.

---

### 4. leg   *— generate FOURTH (chair-leg framing mandatory; body-leg is a content concern)*

```
A flat illustrated cartoon DRAWING of a single wooden chair leg shown vertically in the center, with a small portion of the chair seat corner visible at the top of the frame providing furniture context, the leg is a gently-tapered turned-wood shape in warm-brown wood color, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no human or animal body part anywhere --no photo, photorealistic, 3d render, body part, human leg, animal leg, severed limb, shoe, foot, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- **CHAIR-LEG framing — small chair-context portion at top showing leg-to-seat junction** (~20% chair, ~80% leg).
- **NOT a body-leg / animal-leg / disembodied limb / shoe / foot** — content concern; mandatory regenerate if violated.
- Warm-brown wood color, gently tapered or turned shape.
- No whole-chair visible (would read as "chair").
- No carpet, no floor, no environment.

**If batch fails:** If MJ insists on body-leg framing, strengthen with `"single isolated wooden chair leg as a piece of furniture, NOT a body part, NOT a person, with a small chair seat corner visible at the top edge of the picture for context"`. If body-leg / disembodied-limb persists across multiple regenerates, **this asset is at content-risk; escalate to Matt before continuing.**

---

### 5. web   *— generate FIFTH (thin-line geometry survival risk)*

```
A flat illustrated cartoon DRAWING of a simple spider web shown front-on as a flat near-circular pattern, with about 6 concentric ring circles spiraling outward from a center point and about 10 evenly distributed radial spokes connecting all the rings, very thin soft mauve thread lines suggesting silk, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, slice-of-life Korean webtoon look, single subject, no spider visible --no photo, photorealistic, 3d render, spider, insect, halloween, dark background, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Concentric-rings + radial-spokes pattern is CLEAR and SYMMETRIC at 96pt.
- Thread lines contrast against cream background — push toward soft mauve or soft warm-grey if cream-on-cream collapse risk.
- **NO spider visible** (the absence is the recognition cue; spider would introduce content + second subject).
- No leaves, branch, or environment.
- Symmetric geometry — no tangled or messy "sketch of a web" rendering.

**If batch fails:** Strengthen geometry — `"perfectly symmetric concentric-circular spider web with crisp clean radial lines, like a simple geometric diagram, NOT a sketch"`. If thin-line geometry collapses on PNG-embed at 96pt, push thread color darker (soft warm-grey #8B7B6B) for contrast.

---

### 6. jet   *— generate SIXTH (low risk; standard aircraft category)*

```
A flat illustrated cartoon DRAWING of a simple sleek passenger jet plane viewed in three-quarter perspective from below-front showing two main wings extending outward, a vertical tail fin at the back, a clear cockpit window at the front, and four to six small round passenger windows along the side, soft warm-blue body with gentle cel-shading, in flight not on a runway, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, sky, clouds, runway, contrails, smiling jet, eyes for headlights, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Wings + tail fin + cockpit all clearly visible — aircraft-class identifiers.
- In flight (NOT on runway, no ground line, no airport).
- Warm-pastel palette — desaturated soft warm-blue body, not pure airline-white (collapses into cream background).
- No anthropomorphism (no eyes-for-cockpit, no smile-for-grille).
- No contrails, no clouds, no sky — single subject only.

**If batch fails:** If MJ pulls toward fighter-jet with weapons, strengthen `--no missile, weapon, military, fighter`. If pure-white airliner collapses on cream background, push body color: `"soft desaturated warm-blue jet body #B5C5D5 for clear contrast against the cream background"`.

---

### 7. bed   *— generate SEVENTH (low risk; standard furniture)*

> **Mechanism-over-recognition gotcha applies (gotcha #2):** modern adjustable / hospital beds are MJ's default attractor. Description commits to a simple cot-style children's-book bed; `--no` includes the modern mechanisms.

```
A flat illustrated cartoon DRAWING of a simple single bed viewed in three-quarter perspective showing the front face and one side, with a clear warm-cream mattress on top of a simple warm-brown wooden frame on four short legs, one soft warm-rose pillow at the head end, an optional simple solid-panel headboard rising at the head end, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no bedroom scene --no photo, product photography, photorealistic, 3d render, adjustable bed, hospital bed, bunk bed, person sleeping, smiling bed, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Pillow at one end is clearly visible (load-bearing — without it the silhouette reads as "table" or "platform").
- Four legs visible at corners.
- Single mattress, single pillow.
- No bedroom scene — no walls, no nightstand, no lamp.
- No person sleeping (multi-subject).
- Simple cot-style, NOT modern adjustable / hospital / bunk / electric.

**If batch fails:** If MJ delivers a modern adjustable bed despite negation, strengthen description — `"a simple traditional children's-book wooden bed, low and rectangular, NO buttons, NO controls, NO motors, NO adjustable parts"`.

---

### 8. gem   *— generate EIGHTH (low risk; geometric simplicity)*

```
A flat illustrated cartoon DRAWING of a simple cut gemstone in three-quarter perspective showing a clear diamond-cut shape with about 5 visible flat angular facets, soft warm-rose color with subtle cel-shading variations between adjacent facets, the brightest facet on the upper-left, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, ring setting, jewelry, crown, sparkle rays, smiling gem, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Visible angular facets (4-6 flat polygonal faces) — the geometric cut is the recognition cue.
- Warm-pastel palette — soft warm-rose, soft warm-mauve, or soft sage-green; NOT saturated primary jewel-tones.
- **NO sparkle-rays radiating outward** (would conflict with `sun` recognition pattern from a future pack).
- No ring/jewelry setting, no crown, no multiple gems.
- Small soft sparkle dot ON a facet OK; rays radiating OUT not OK.

**If batch fails:** If MJ delivers a smooth-rendered photorealistic gem with no visible facets, strengthen — `"angular crystal with crisp clean polygon faces, like a simple geometric diagram, low-poly diamond cut"`.

---

### 9. pen   *— generate LAST (CONDITIONAL re-trace per pool spec Q2; pair-review against PR #157)*

> **Mechanism-over-recognition gotcha applies (gotcha #2):** ballpoint vs. fountain vs. pencil. Description commits to a simple ballpoint with visible nib + clip (the children's-book prototype). `--no` includes pencil and quill.

```
A flat illustrated cartoon DRAWING of a simple ballpoint pen viewed diagonally in three-quarter perspective showing the slim cylindrical body in soft warm-rose color, a clearly visible small metallic nib at one end pointing toward the writing tip, a small metallic clip on the upper portion of the body, an optional simple cap at the back end, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject --no photo, product photography, photorealistic, 3d render, pencil, quill, feather pen, hand holding pen, smiling pen, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Nib at writing-tip end CLEARLY VISIBLE (without it the silhouette reads as "stick" or "marker").
- Clip on the upper body CLEARLY VISIBLE (second disambiguator from generic-cylinder).
- Slim elongated cylinder.
- No hand, no paper, no ink-line drawn (multi-subject).
- No pencil eraser end, no sharpened-wood tip (would read as "pencil").

**If batch fails:** If MJ keeps delivering pencils, strengthen — `"a modern ballpoint pen, NOT a pencil, NOT a quill, NOT a wood-and-graphite pencil, the writing tip is a small metallic nib"`. Pair-review against existing `picture-pen.svg` from PR #157 at 96pt — confirm the new style coheres with the short-e tier visual frame.

---

## short-o-extension (3-4 words)

### 1. cot   *— generate FIRST (lowest risk; geometric simplicity)*

> **Mechanism-over-recognition gotcha applies (gotcha #2):** modern hospital / adjustable / military cots are attractors. Description commits to a simple traditional children's-book cot; `--no` includes hospital and military.

```
A flat illustrated cartoon DRAWING of a simple small portable single-bed cot in three-quarter perspective showing a low rectangular wooden frame with four short warm-brown legs at the corners, a thin soft warm-cream mattress on top of the frame with a slightly darker rim along the edges, a single white pillow at one end rising slightly above the mattress level, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no bedding, no blanket --no photo, product photography, photorealistic, 3d render, hospital bed, military folding cot, crib with bars, baby in cot, smiling cot, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- Pillow at one end is CLEARLY VISIBLE (load-bearing — without it silhouette could read as "bench" or "stool").
- Low rectangular frame with four short legs.
- Thin mattress visible on top of frame.
- No baby, no blanket tucked-in, no bedroom scene.
- No vertical-bar crib (would read as "crib").
- No hospital side rails (would read as "hospital").

**If batch fails:** Strengthen pillow — `"single soft white pillow clearly raised above the mattress at one end, the pillow is the most prominent object identifying this as a cot"`.

---

### 2. top   *— generate SECOND (motion-blur attractor is severe)*

```
A flat illustrated cartoon DRAWING of a classic wooden spinning-toy top at REST in three-quarter perspective, an inverted cone shape with a wider rounded crown at the top and a single small pointed tip at the bottom resting on the surface, a small round winder-knob centered on the top-flat face of the crown, body in soft warm-rose color with one or two simple warm-peach decorative stripe bands wrapping horizontally around the crown, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, NOT spinning --no photo, photorealistic, 3d render, motion blur, spinning blur, motion trail, ice cream cone, party hat, beyblade, smiling top, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- **NO motion-blur, NO spinning lines, NO motion-trail** — the top is at REST. (Mandatory regenerate trigger.)
- Pointed tip at the BOTTOM (load-bearing recognition cue; rests on implied surface).
- Winder-knob centered on top-flat crown face (disambiguator from ice-cream cone, party hat).
- Wider rounded crown at TOP, narrower point at BOTTOM (inverted cone, NOT party-hat orientation).
- Decorative stripe band on crown reads as "toy" not "geometric solid".
- No anthropomorphism.

**If batch fails:** Motion-blur is the most-likely failure mode. Strengthen — `"a still spinning top sitting motionless on a flat surface, NO motion, NO blur, NO movement, like a photograph of a top at rest"`. If MJ won't comply across 2-3 regenerations, abandon and accept `top` as a known-fragile chip; document the chip's motion-blur drift in the Phase 2 review notes.

---

### 3. pop   *— generate THIRD (after `top` is locked; A/B at 96pt)*

> **The stick is the load-bearing disambiguator vs. `cup` and `bun`.** If at 96pt the stick collapses (cropped by remove.bg, rendered too thin, merged into sphere), trigger Phase 2 fallback to `cob` (next prompt block).

```
A flat illustrated cartoon DRAWING of a simple round lollipop candy on a stick in three-quarter perspective, a single round candy sphere in soft warm-rose color with a soft inner highlight on the upper-left from cel-shading, a clear thin straight white stick extending downward from the bottom of the sphere with the stick visible at full length roughly the same as the sphere's diameter or slightly longer, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, wrapper, soda cup, popsicle, hand holding lollipop, smiling lollipop, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- **STICK CLEARLY VISIBLE at full length** at the bottom of the sphere — load-bearing disambiguator.
- Single round sphere on top of stick — soft warm-rose, NOT saturated primary red.
- No wrapper (twisted cellophane introduces visual noise).
- No multiple lollipops, no candy jar.
- No soda cup (the "pop = soda" misreading).
- No popsicle (frozen flat-rectangular — wrong shape).

**If batch fails:** Strengthen stick — `"long thin clearly-visible white wooden stick at least as long as the candy sphere is wide, the stick is the most distinctive feature of the lollipop"`. **If 4 regenerations all collapse the stick at 96pt, trigger Phase 2 fallback to `cob` per pool spec §AC7 / §10 Q3 (orchestrator-locked auto-substitution).** Do not ship a stickless lollipop chip — it would collapse to `cup` or `bun` at chip-size.

---

### 4. cob   *— STANDBY only; generate ONLY if `pop` Phase 2 review fails*

```
A flat illustrated cartoon DRAWING of a single corn-on-the-cob in three-quarter perspective showing the long yellow cylinder body covered in regular rows of soft-oval kernels in soft warm-yellow color, with a partial green husk peeled back at the bottom end revealing the kernels above, the husk in soft sage-green with a slightly darker shadow companion, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, butter, cooking pot, plate, multiple cobs, popcorn, smiling cob, shadow, drop shadow, ground shadow
```

**Selection criteria when variants land:**
- **Kernel rows VISIBLE on the cylinder** — load-bearing recognition cue.
- Yellow cylinder body, NOT saturated primary yellow (warm-pastel only).
- Partial green husk peeled back at one end (sage-green, not saturated primary green).
- No butter, no steaming, no plate, no cooking pot (would conflate with `pot`).
- No popcorn / kettle corn (drift to processed corn).

**If batch fails:** Strengthen kernel visibility — `"the yellow corn body covered in a clearly visible regular grid pattern of small oval kernels in rows along the cylinder, the kernels are the main visual feature"`.

---

## Generation order summary

**short-e (in risk-descending order):** `net` → `egg` → `hen` → `leg` → `web` → `jet` → `bed` → `gem` → `pen` (conditional).

**short-o-ext (in risk-descending order):** `cot` → `top` → `pop` → (`cob` standby only).

**Single MJ session if possible** for visual cohesion across both packs (pack-cohesion lever via style preamble alone, no `--cref` needed).

**Total expected MJ time:** ~90-150 min for 12 generations + 30-60 min for remove.bg pass. Comparable to PR #170's 11-word short-u cadence.

---

## Phase 3 handoff (Devon)

After Thomas's MJ + remove.bg, source PNGs land at:

```
MarianLearning/design/references/picture-pack/transparent/{bed,leg,hen,pen,web,net,jet,gem,egg,cot,top,pop,cob}.png
```

Devon's Phase 3 step (per `.claude/docs/skill-trees-and-content.md` § Two embed-pipeline gotchas):

```pwsh
cd MarianLearning
yarn embed-pictures design/references/picture-pack/transparent public/assets/pictures
```

**Worktree-drift gotcha:** md5-check source PNGs against canonical main-repo path before running, OR `cp` canonical PNGs into worktree path as first step.

**Empty-input-dir gotcha:** ensure `transparent/` contains ONLY the target PNGs at run-time; out-of-scope source PNGs WILL produce unintended SVG output.

If Phase 2 `pop → cob` substitution fires, follow pool spec §AC7 + §10 Q3 (`wordPack.ts TARGET_WORDS` + `TARGET_PAIRINGS` + `api/_plannerWordList.ts` + canon re-bake + spec amendment PR).

---

## Cross-references

- **Source specs:** [`short-e-picture-pack-prompts.md`](./short-e-picture-pack-prompts.md) (Kyle, PR #179), [`short-e-pool-expansion.md`](./short-e-pool-expansion.md), [`short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md) (Kyle, PR #177), [`short-o-pool-extension.md`](./short-o-pool-extension.md).
- **Style anchor:** [`picture-pack-style-anchor.md`](./picture-pack-style-anchor.md) (locked).
- **MJ gotchas (load-bearing for this distillation):** `.claude/docs/skill-trees-and-content.md` § "MJ prompt-engineering gotchas for picture-pack words" (added 2026-05-09).
- **MJ workflow memories:** `feedback_mj_workflow_explicit_removebg`, `feedback_mj_pack_cohesion_lever_unused`, `feedback_mj_moderator_negatives_per_word`, `user_midjourney_web`.
- **PWA cache budget:** `reference_pwa_asset_size_limits` — 4 MiB cap; ~50–150 KB per SVG fits comfortably.
- **Cross-vowel mode pool-size floor:** [`cross-vowel-mix-spec.md`](./cross-vowel-mix-spec.md) §6 — `≥ 11 entries each`. Both packs' targets, when shipped, bring short-e to 9 (audit ceiling) and short-o to 11 (cross-vowel-ready).
