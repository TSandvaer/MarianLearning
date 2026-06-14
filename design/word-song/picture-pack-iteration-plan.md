# Word Song picture pack — iteration & consistency plan (v7 default)

**Audience:** Thomas (Midjourney operator, phase 2), Kyle (phase-1 prompt authoring).
**Author:** Marian Tutor design persona.
**Ticket:** `86c9kww0h` (original), `86c9qdp3e` (v7 template refresh).
**Status:** Workflow brief for phase 2 — Thomas owns the generation session.

This is the consistency-iteration plan for picture-pack tiers — the same problem cracked on Phase 3b's 8 Emma poses, adapted for object/animal subjects rather than character poses.

The hard truth about generating a tier of pictures that need to look like one illustrator made them: **Midjourney drifts.** Subject-to-subject consistency is harder for object packs than for character poses, because every subject is genuinely different (a cat is not a bus). The plan below front-loads the discipline — lock the style preamble first, then run subjects against it — to minimize re-rolls.

> **MJ version assumption: v7 (MJ Web UI).** Every paste-ready prompt is authored for v7. The v6-era parameter stack (`--cref` / `--sref` / `--cw 80`, `--v 6 --style raw --s 250`, `--ar 1:1`) is **retired** — see §10 "v6-historical appendix" for what was dropped and why. Do not re-introduce those flags when authoring a new pack. If MJ updates again, re-validate against `feedback_mj_moderator_negatives_per_word` (the version-constraint memory) before authoring.

---

## 1. Style preamble — the consistency seed (replaces pose-zero / cref chaining)

The single biggest consistency lever for a pack is the **style preamble** in [`picture-pack-style-anchor.md`](./picture-pack-style-anchor.md) §2, applied byte-for-byte across every generation. The v6 plan chained cohesion off a captured `dog` pose-zero URL via `--cref` / `--sref`; that lever was **never used in practice** — Thomas never captured the pose-zero URL, and the style preamble alone has carried 38+ assets across short-a / short-o / short-u / short-i / short-e to a cohesive look (per `feedback_mj_pack_cohesion_lever_unused`).

**The v7 cohesion mechanism is the style preamble, full stop.** Re-use it byte-for-byte. Do not paraphrase, do not abbreviate. Variation in the preamble across prompts is the #1 cause of style drift — same lesson Thomas hit on Emma's 8 poses (per `character-emma-ai-prompts.md` §1b).

**Preamble byte-equality is non-negotiable.** If you find yourself wanting to "tighten" a phrase mid-session, stop and either:

1. Update `picture-pack-style-anchor.md` §2 first (a doc-only edit), then regenerate ALL previously-accepted images with the new preamble. OR
2. Don't tighten. Ride out the iteration and ship the original preamble.

Mid-session preamble divergence is what caused Emma's pose drift in PR #103 + #107 (per `design/character/asset-fidelity-followup.md`).

**Optional pack-cohesion top-up (Thomas's call).** If Thomas wants stronger cross-asset cohesion in a single session, he MAY manually append `--cref <pose-zero-url> --cw 80 --sref <pose-zero-url>` to any prompt with a `dog` pose-zero URL handy. This is **opt-in at generation time, never baked into the paste-ready prompt.** Default: no cref.

---

## 2. v7 four-pattern structural template (the default authoring shape)

Every paste-ready prompt is built from one structural template that bakes in all four empirical gotchas from [`.claude/docs/skill-trees-and-content.md`](../../.claude/docs/skill-trees-and-content.md) § "MJ prompt-engineering gotchas for picture-pack words". Author every new word from this shape so the pack ships paste-ready with no distillation hop. PR #189 (`mj-prompts-paste-ready-2026-05-10.md`) distilled this shape from the older verbose specs; this section makes it the default.

### The four patterns

1. **Lead with the noun (gotcha #3).** Open with `"A flat illustrated cartoon DRAWING of a [vivid prototype]..."`. The noun-forward phrasing treats the subject as the object of a depiction act, which weights illustration intent more than `"[subject] in flat illustrated style"`. Use this opening for every word. The `"flat illustrated cartoon DRAWING"` prefix also doubles as the photoreal-drift defense for inanimate-object subjects (v7 defaults objects to glossy-3D; the loud 2D anchor pulls them back).

2. **Mechanism-over-recognition fix (gotcha #2).** When a word has a children's-book prototypical form AND a modern industrial form (bed: cot-style vs hospital/adjustable; pen: ballpoint vs fountain; bib: tie-string vs snap-closure; bag: drawstring vs zip; cap: floppy vs fitted), MJ defaults to the modern form even with prompt language. Defend on BOTH sides: describe the prototype vividly in the body AND add the modern mechanism to `--no`. Neither alone is sufficient. Flag this check for any word that has evolved from its children's-book prototype.

3. **Clothing/textile/household defenses (gotcha #1).** Clothing, textile, and household-product subjects pull into MJ's "stylised stock product photo" attractor — standard `--no photorealistic, 3d render` does not defend against the distinct "clean-background catalogue shot" mode. For these subject classes add `--no photo, product photography, fabric texture` ON TOP of the standard ballast (both layers needed). Apply to: clothing, textiles, household tools, anything with a known modern counterpart.

4. **Drop-shadow negation at MJ time (gotcha #4).** MJ ignores prose like "no shadow drop"; it needs explicit `--no shadow, drop shadow, ground shadow` on EVERY prompt. Reason: a soft drop-shadow's warm tone is close to the cream-background tone, so AI BG-removal tools classify the shadow blob as foreground and leave an orphan cream-toned blob in the transparent PNG. Negating at the source closes the failure mode entirely; the fallback (manual eraser) is more work than the prevention.

### Structural template (combining all four)

```
A flat illustrated cartoon DRAWING of a [vivid prototype description with 1–2 load-bearing recognition cues + camera angle + count of major features], soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, single subject, no environment --no [standard ballast], [per-word smiling-X], [subject-class defenses], shadow, drop shadow, ground shadow
```

### v7 constraints baked into the template

These come from `feedback_mj_moderator_negatives_per_word` (empirically confirmed on PR #189's short-e/short-o-ext prompts, 9–12 entries per prompt, zero moderator trips):

- **≤40–50 words of descriptive body.** v7's moderator applies tighter thresholds on long prompts. Distill the load-bearing recognition cues; do not paste 200-word distinctness prose. Keep: subject name + 1–2 load-bearing cues + camera angle + count of major features + style anchor (4–6 words) + background + "no scene".
- **Generic English style cues, not cultural descriptors.** Use `"soft pastel children's picture-book style"` / `"children's vocabulary book illustration"`. Drop `"Korean manhwa / webtoon"`, `"Studio Ghibli"`, and `"Korean"` anywhere — they risk the moderator's cultural-sensitivity heuristic. (The style anchor §2 preamble retains the manhwa framing as the locked cohesion seed; the distilled paste-ready prompt uses the generic cues. Both describe the same target look.)
- **No human-feature descriptors on non-human subjects.** Drop `"two large round eyes"`, `"small soft mouth"` for animals/objects — they read as person-adjacent to the moderator. Let MJ default the face.
- **Aspect ratio via the MJ Web GUI dropdown (1:1), not `--ar`.**

---

## 3. Per-word tailored `--no` recipe (5–7 logical-concept groups)

The v6 plan appended a single universal ~70-word `--no` block to every prompt — every prior pack's accumulated anti-anthropomorphism, body-part defenses, and weapon defenses, all pasted into every word. **That block trips the v7 moderator** (empirically: the short-i `pig` prompt was blocked on first paste of the full block; trimming per-word produced clean generation — `feedback_mj_moderator_negatives_per_word`).

**Author the `--no` per word as 5–7 logical-concept GROUPS, not raw entries.** A logical group is one concept that may take several terms to express. Counting raw commas, a well-formed prompt typically ships 9–12 entries — that's fine; the moderator-trip pattern is on _bulk pack-wide_ negatives spanning many unrelated concepts (sexy + body parts + weapons + every word's anti-anthro), not on multi-term refinements of a few purposeful concepts.

### The recipe — assemble these groups per word

| #   | Group                                         | Always / conditional    | Terms                                                                                                                                                                                  |
| --- | --------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Anti-photoreal ballast**                    | always                  | `photorealistic, 3d render` (+ `photo`, `glossy reflection` for inanimate objects — they drift glossy-3D in v7)                                                                        |
| 2   | **Anti-text**                                 | always                  | `text, watermark` (add `logo, signature` only if the subject class invites it)                                                                                                         |
| 3   | **Drop-shadow negation**                      | always (gotcha #4)      | `shadow, drop shadow, ground shadow`                                                                                                                                                   |
| 4   | **Per-word anti-anthropomorphism**            | this word only          | the smiling-X attractor for THIS subject — e.g. `smiling hen`, `smiling jet`, `smiling pen`. Do NOT include any other word's smiling-X.                                                |
| 5   | **Subject-class defense (textile/household)** | conditional (gotcha #1) | `product photography, fabric texture` for clothing / textile / household objects                                                                                                       |
| 6   | **Mechanism negation**                        | conditional (gotcha #2) | the modern mechanism for prototype-vs-modern words — e.g. `adjustable bed, hospital bed` for `bed`; `pencil, quill` for `pen`; `snap closure, velcro` for `bib`                        |
| 7   | **Per-word referent guard**                   | conditional             | the specific misreading for THIS word — e.g. `eggs, rooster` for `hen`; `soda cup, popsicle` for `pop` (lollipop); `fish, butterfly` for `net`; `motion blur, spinning blur` for `top` |

### Hard rules for the `--no` recipe

- **Never paste another word's defenses.** When generating `hen`, do not carry `smiling jet`, `pencil`, `motion blur`. Strip everything not load-bearing for the current subject.
- **Never reference IP / brand names in `--no`.** `peppa pig`, `piggy bank`, `beyblade`-as-brand trip moderation even when negated. Rely on positive wording + generic anti-anthro instead. (`beyblade` slipped into the PR #189 `top` prompt as a shape-disambiguator — acceptable as a borderline call, but prefer `spinning toy with motion lines` phrasing where it reads cleanly.)
- **Drop moderator-trigger phrases unless load-bearing.** Strip `sexy`, `school uniform`, `weapon, gun, knife, blade`, `anatomical hip / body part / X-ray / medical illustration`, `dark background`, `monochrome`, `hangul characters`, `korean text`, `fake text` — none are load-bearing for v1 pool words. (The body-part defenses WERE load-bearing for short-i `hip` (rosehip-vs-body); that word is not in any shipped v1 pool.)
- **`gradient sky`** only when the word risks landscape drift (`bus`, `hut`, `jet`-in-flight); strip otherwise.
- **Trim path if a prompt trips anyway:** drop redundant entries first (`photo` when `photorealistic` is present), then drop the `smiling X` group second.

### Worked example (from PR #189, `hen`)

```
A flat illustrated cartoon DRAWING of a friendly cartoon hen in three-quarter side perspective, plump rounded body in soft warm-cream feathers, small warm-yellow beak, prominent soft rose-pink comb on top of the head, two thin warm-yellow legs, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, single subject, no eggs visible --no photo, photorealistic, 3d render, eggs, rooster, smiling hen, shadow, drop shadow, ground shadow
```

Groups present: anti-photoreal (1) + per-word referent guard `eggs, rooster` (7) + per-word anti-anthro `smiling hen` (4) + drop-shadow (3). No textile defense (animal), no mechanism negation (no modern form), no anti-text group needed inline here (covered by the style anchor's single-subject framing). 7 raw entries — comfortably inside the v7 ceiling.

---

## 4. Generation order

Run subjects in **risk-descending order** — surface the hardest cases first so they can be re-rolled without invalidating later work. Order each pack so:

1. **Highest cross-pack discrimination risk first** (the word most likely to collapse against an existing chip's silhouette — e.g. short-e `net` vs `bag`).
2. **Cream-on-cream contrast risk + forbidden-pair partners next** (e.g. short-e `egg` vs `nut`/`bun`).
3. **Animal-class / mechanism-attractor words** (need the gotcha-#2 defenses tested early).
4. **Low-risk standard-category words last** (clear animals, unambiguous geometric objects).
5. **Conditional re-traces and Phase-2 standby words at the very end** (e.g. short-e `pen` re-trace; short-o-ext `cob` standby for `pop`).

If the top 2–3 highest-risk words fail to lock cleanly, **stop and reassess** — either the prompt sheet has a fundamental issue, or MJ isn't going to work for this pack and you fall back to commissioning a real illustrator (per §7 hard-fall).

Run the whole tier in a **single MJ session** where possible — the style preamble carries cohesion across both packs in one sitting (no `--cref` needed). See `mj-prompts-paste-ready-2026-05-10.md` § "Generation order summary" for a worked risk-descending order across short-e + short-o-ext.

---

## 5. Drift table — common failures and fixes

These are the drifts to expect. Each row maps a failure to the v7 fix.

| Drift                                                               | Likely cause                                                 | Fix                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subject doesn't read as the target noun** at full res             | Subject-specifics underweight against the preamble           | Move the subject-specific clause to the front (MJ weights early tokens — the lead-with-noun pattern already does this). Or duplicate the disambiguating feature: "**a cat with pointed-up triangular ears, whiskers visible, and a curled tail — clearly a cat, not a bunny, not a fox**."                                                                                                                                     |
| **Style drifts** between subjects (line weight, palette)            | Preamble paraphrased or abbreviated across prompts           | Restore byte-equal preamble. The preamble IS the cohesion mechanism in v7. (If Thomas opted into manual `--cref`, verify the flag is consistent across prompts.)                                                                                                                                                                                                                                                               |
| **Photorealistic / glossy-3D** output (esp. inanimate objects)      | v7 defaults objects to glossy-3D                             | Strengthen the lead-with-noun 2D anchor: "**A flat illustrated cartoon DRAWING... clean line art and soft cel-shading, NO glossy reflections, NO photographic rendering**" inline (v7 responds to inline negation more reliably than `--no` for the photoreal trigger). Add `photo, glossy reflection, gradient shading` to `--no`. Escalate to "**vector illustration, flat colors, comic-book line art**" if still drifting. |
| **Product-photography / catalogue-shot** mode (textiles, household) | gotcha #1 — standard ballast doesn't defend                  | Add `--no photo, product photography, fabric texture` AND keep the standard ballast (both layers).                                                                                                                                                                                                                                                                                                                             |
| **Modern industrial form** instead of the prototype                 | gotcha #2 — MJ defaults to the modern form                   | Describe the prototype vividly in the body AND add the modern mechanism to `--no` (e.g. `--no adjustable bed, hospital bed` for `bed`). Both sides needed.                                                                                                                                                                                                                                                                     |
| **Orphan cream-toned shadow blob** survives BG removal              | gotcha #4 — drop-shadow not negated at MJ time               | Ensure `--no shadow, drop shadow, ground shadow` is on the prompt. If a PNG already has one, manual eraser in any basic editor (the subject silhouette is intact; only the orphan blob needs to go).                                                                                                                                                                                                                           |
| **Background isn't solid soft cream**                               | Background instruction buried                                | Repeat at the END: "**Background is SOLID soft cream (#FFF6EE) — flat, no scene, no environment.**"                                                                                                                                                                                                                                                                                                                            |
| **Anthropomorphised object** (fan with eyes, bus with smile)        | MJ's children's-book prior loves friendly faces              | Add inline: "the fan has NO eyes, NO mouth, NO face — pure object render." Ensure the per-word `smiling X` group is in `--no`. Re-roll.                                                                                                                                                                                                                                                                                        |
| **Saturated primary colors** (red apple, blue bus)                  | Object-specific color drift toward photographic              | Re-emphasize: "**desaturated illustrated palette, NOT photographic, NOT saturated.**" Name the exact desaturated hex range for the object color.                                                                                                                                                                                                                                                                               |
| **Multiple subjects**                                               | "Single subject" lost mid-prompt                             | Repeat at end: "**ONE subject only — NO accompanying objects, NO second subject.**"                                                                                                                                                                                                                                                                                                                                            |
| **Moderator block** ("AI Moderator is unsure about this prompt")    | `--no` block too long / carries pack-wide or trigger phrases | Trim to 5–7 logical groups (§3). Drop redundant entries first, then `smiling X`. Strip any IP names, body-part / weapon / sexy phrases.                                                                                                                                                                                                                                                                                        |
| **Text or fake-Korean characters** appear                           | Manhwa training data includes hangul                         | Add `text` to `--no` (already in ballast). This is hard to fix in-prompt — easier to re-roll. Do NOT add `hangul characters` / `korean text` to `--no` (moderator-trigger; rely on `text` + re-roll).                                                                                                                                                                                                                          |
| **Subject fills frame too tightly** (limbs clipped)                 | Frame composition drift                                      | Specify: "subject fills 60-75% of frame with margin on all sides, fully visible, no clipping."                                                                                                                                                                                                                                                                                                                                 |
| **Shading is multi-tone / painted**                                 | "Cel-shading" read as soft painted                           | Tighten: "**single soft shadow companion per color zone — exactly TWO tones per zone, no gradient, no soft falloff, no painted shading.**"                                                                                                                                                                                                                                                                                     |

---

## 6. Quality gate — when to stop iterating on a subject

For each subject, accept the generation when ALL of these are true. Same shape as Emma's prompt sheet §6.3.

- [ ] Subject reads as the target noun in <3 seconds without text labels.
- [ ] Style coheres with the rest of the pack (line weight, palette, shading style match the preamble).
- [ ] Forbidden-pair distinguisher (per the per-word selection criteria) is clearly visible.
- [ ] Background is solid soft cream, flat, mask-friendly.
- [ ] Subject fills 60-75% of frame, centered, single subject only.
- [ ] No text, no watermark, no logo, no UI overlay.
- [ ] No anthropomorphism (objects don't have faces; the `smiling X` group held).
- [ ] No orphan drop-shadow blob that BG removal will preserve.
- [ ] At a thumbnail-size preview (~96px), the subject is still identifiable.

If 8 of 9 boxes check, ship it — phase 3's embed/trace cleans up minor issues. If 7 or fewer, regenerate.

---

## 7. Escalation ladder — when a subject doesn't gen cleanly

Per the quality gate, accept that the highest-risk words may take several attempts. Escalation:

### 7.1 Single-subject persistent drift

If after **3 attempts** with the standard prompt a subject doesn't pass the quality gate:

1. **Apply the relevant gotcha defense harder.** Photoreal-drift → louder 2D anchor inline. Mechanism-attractor → strengthen both the body prototype description and the `--no` mechanism term. Anthropomorphism → inline "NO face, pure object render" + confirm the `smiling X` group.
2. **Tighten the disambiguator.** Move the distinguishing feature to the very start of the subject clause; double-emphasize.
3. **Trim the `--no` if the moderator is the blocker.** Drop redundant entries, then `smiling X`, then any borderline phrase.
4. **Switch tools.** If 5+ attempts fail in Midjourney, try DALL-E or Flux-via-Replicate for that single subject. Per `character-emma-ai-prompts.md` §6.2, single-pose escalation is acceptable — ship the rest from Midjourney and that one from another tool; phase 3's embed/trace cleans up the tool difference.

### 7.2 Precise-anatomy detail MJ won't render (hybrid fallback)

If a load-bearing precise detail (e.g. a specific articulation, a specific mechanism geometry) gets **two full 4-grids (~20 images) with zero hits**, stop — do NOT burn a third grid. Pick the best on-brand base MJ produced and have Kyle SVG-overlay the precise line-art detail. MJ is reliable for the on-brand character/object; it is not reliable for precise instructional anatomy (confirmed on the digraphs-th mouth cue, 2026-05-14, `feedback_mj_moderator_negatives_per_word`).

### 7.3 Hard-fall fallback: drop the AI-gen route

If 3+ subjects fail after their escalation, the pack isn't going to land cleanly via Midjourney. Stop the AI session and escalate to Matt — likely back to commissioning a single illustrator (per `design/word-song-picture-pack.md` §"Sourcing options").

**Do not ship an inconsistent pack.** A mixed-source pack would be visibly mismatched in a way Marian would notice; mismatched-style is worse than schematic-silhouette placeholders.

---

## 8. Output format — what phase 3 needs

When generation is complete, hand phase 3 (Devon embed / Kyle trace direction) the following:

- **Source PNGs** — 1024×1024 (full MJ resolution; do NOT downsample), background removed to transparent via the current canonical BG-removal tool (per `feedback_mj_workflow_explicit_removebg` step 6 — defer to the memory for the current pick).
- **Per-tier staging subdir.** Drop PNGs into `design/references/picture-pack/transparent-{tier}/` (e.g. `transparent-short-e/`). The embed script auto-emits ALL PNGs in its input dir, so per-tier isolation prevents cross-tier overwrites (per `.claude/docs/skill-trees-and-content.md` § "Two embed-pipeline gotchas").
- **Filename convention:** `picture-{word}.png` matching the eventual SVG filename.
- **Note the MJ prompt + URL for each source image.** A sidecar `sources.md` mapping word → MJ image URL → accepted prompt pays back if a phase-3 asset fails QA and needs regenerating.

Phase 3 then runs `yarn embed-pictures design/references/picture-pack/transparent-{tier} public/assets/pictures` (use `npm run embed-pictures` in a fresh worktree — `yarn` is not reliably on PATH there; `yarn install --frozen-lockfile` is Step 0), drops the SVGs at `public/assets/pictures/`, and updates `wordPictures.tsx`. See `.claude/docs/skill-trees-and-content.md` § "Three viable Phase 3 paths" for the embed-vs-trace decision — **ask Thomas which path he wants upfront** (default-to-hand-author produces the visual-fidelity surprise that surfaced post-PR-#157).

---

## 9. Provenance + lessons inherited

This iteration plan inherits lessons from:

- **`.claude/docs/skill-trees-and-content.md`** § "MJ prompt-engineering gotchas for picture-pack words" — the four-pattern source of truth (lead-with-noun, mechanism-over-recognition, clothing/textile defenses, drop-shadow negation).
- **`feedback_mj_moderator_negatives_per_word`** memory — v7 parameter constraints, the ≤40–50-word ceiling, the per-word `--no` recipe (5–7 logical groups), and the moderator-trip pattern. **The load-bearing memory for this template — read it before authoring a new pack.**
- **`feedback_mj_pack_cohesion_lever_unused`** memory — why the `--cref`/`--sref` pose-zero lever is retired; the style preamble carries cohesion alone.
- **`feedback_mj_workflow_explicit_removebg`** memory — the canonical BG-removal tool pick (defer to the memory; it's under active evaluation).
- **`mj-prompts-paste-ready-2026-05-10.md`** (PR #189) — the worked distillation that this template makes the default authoring shape.
- **`design/character-emma-ai-prompts.md`** §6.1–§6.3 — the diagnostic-ladder + quality-gate structure.
- **`design/character/asset-fidelity-followup.md`** — the Phase 3b PNG-in-SVG lesson; phase 3 should produce true vector geometry where fidelity allows (see the three Phase-3 paths in the docs).

The single most important lesson: **front-load discipline on the style preamble (byte-for-byte), and author every paste-ready prompt from the v7 four-pattern template with a per-word tailored `--no`.** Pack consistency is won in the first prompt; moderator-clean generation is won by tailoring `--no` per word.

---

## 10. v6-historical appendix — the retired parameter stack

**Do not use any of this for new packs.** Kept only as the record of what the v6-era plan prescribed, so a reviewer reading an old source spec recognises the stale stack.

The v6 plan (pre-2026-05-09, before Thomas confirmed his account runs MJ v7) appended this trailing parameter chain to every prompt **after** a captured `dog` pose-zero:

```
[full prompt from picture-pack-prompts.md row]
--cref <pose-zero-url> --cw 80
--sref <pose-zero-url>
--ar 1:1 --s 250 --v 6 --style raw
--no [universal ~70-word block — every prior pack's accumulated negatives]
```

Why each piece was dropped for v7 (per `feedback_mj_moderator_negatives_per_word`):

| Retired flag                    | Reason dropped                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cref <url> --cw 80`          | Pose-zero URL never captured in practice; style preamble carries cohesion alone (`feedback_mj_pack_cohesion_lever_unused`). `--cw 80` (character-weight) had no effect without a cref. |
| `--sref <url>`                  | Same — no pose-zero reference to point at.                                                                                                                                             |
| `--v 6`                         | Forces v6 rendering on a v7 account; let the v7 default fire.                                                                                                                          |
| `--style raw`                   | v6-specific stylistic flag, not portable to v7.                                                                                                                                        |
| `--s 250`                       | v6 stylize-strength; v7 handles `--stylize` differently.                                                                                                                               |
| `--ar 1:1`                      | Set via the MJ Web GUI dropdown in v7, not a prompt flag.                                                                                                                              |
| Universal ~70-word `--no` block | Trips the v7 moderator (bulk pack-wide negatives spanning unrelated concepts). Replaced by the per-word 5–7-group recipe in §3.                                                        |

The v6 "pose-zero" workflow (lock one reference subject first, chain everything off it via `--cref`/`--sref`) is also retired — §1's byte-for-byte style preamble is the v7 replacement. If a future MJ version reinstates reliable reference-image chaining, re-evaluate against the then-current `feedback_mj_moderator_negatives_per_word` constraints before re-adopting.
