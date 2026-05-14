# Emma splash-logo — MJ Web v7 prompt

**Companion spec:** [`emma-splash-logo-spec.md`](emma-splash-logo-spec.md).
**Surface:** `public/assets/emma-logo.svg` portrait band (upper 256×220 of the 256×320 viewBox).
**MJ version:** v7 via MJ Web (https://www.midjourney.com/imagine). NOT Discord. NOT v6.
**Aspect ratio:** **square (1:1)** — set via GUI dropdown before generating. Do NOT include `--ar` in the prompt.

---

## The prompt (paste-ready)

```
A cute illustrated portrait of a calm young woman teacher with soft medium-length wavy brown hair, large warm dark-brown eyes softly open looking slightly off-camera, gentle closed-mouth smile, peach cardigan over cream blouse, head and shoulders only, three-quarter front view, soft pastel colors on a flat cream (#FFF6EE) background, simple children's storybook illustration style with clean line art and soft cel-shading, single subject, NO glossy reflections, NO photographic rendering. --no photorealistic, 3d render, photo, glossy reflection, anime, chibi, sharp anime style, glasses, hat, jewelry, bunny ears, rabbit features, multiple subjects, text, watermark, logo, signature, dark background, scene background, drop shadow
```

---

## Workflow (canonical 9-step loop per `feedback_mj_workflow_explicit_removebg.md`)

1. **Open MJ Web** — https://www.midjourney.com/imagine.
2. **Set aspect ratio to 1:1** via the GUI dropdown (NOT in the prompt body).
3. **Paste the prompt** above into the prompt box → press generate. MJ returns a 4-image grid.
4. **Pick the best of 4** per the §"Acceptance criteria for the chosen variant" checklist below. Report back to the orchestrator with which variant you picked or that all four miss the brief.
5. **UPSCALE the chosen variant** — click the chosen image → Upscale → **Subtle** (NOT Creative, NOT Open in New Tab). Wait ~30 s.
6. **Download the upscaled PNG** — ~2048×2048 with the cream background. **NOT transparent yet — MJ never outputs transparent.**
7. **Run the upscaled PNG through `remove.bg`** — drag-drop into https://www.remove.bg or use their app. **Mandatory step.** This is where the cream background gets keyed out.
8. **Save the remove.bg output** as `emma-logo.png` to:
   ```
   c:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning/design/references/character-emma/emma-logo.png
   ```
   (NOT under `picture-pack/transparent-*/` — splash logo is character-emma, not picture-pack.)
9. **Ping the orchestrator** — surface "Emma splash-logo PNG dropped at character-emma/emma-logo.png" so Devon can be dispatched to embed it into the SVG wrapper per spec §6.

---

## Acceptance criteria for the chosen variant (Thomas-led pick)

Pick the variant that satisfies the most of these. If none satisfies 6+, re-roll once with the same prompt; if still none, ping the orchestrator before tailoring the prompt.

- [ ] **Manhwa/webtoon style** — clean digital lineart, naturalistic body proportions, expression peaks at the face. NOT anime-sharp, NOT chibi-infantile, NOT photoreal, NOT 3D-render, NOT Disney-3D.
- [ ] **Age reads 25–30** — old enough that "teacher" reads, young enough that "older sister" reads. NOT a child, NOT middle-aged.
- [ ] **Hair:** medium-length, soft natural waves, brown / dark brown. NOT short bob, NOT long-straight, NOT black-anime.
- [ ] **Expression:** eyes softly open, gaze slightly off-camera, gentle closed-mouth smile. NOT eyes-closed (that's `emma-sleepy.svg`), NOT direct address, NOT full open-teeth grin.
- [ ] **Outfit:** peach cardigan over cream blouse visible at shoulder line. NOT institutional uniform, NOT business shirt.
- [ ] **Head + shoulders** framing — head fills upper ~60% of frame, shoulders + upper chest visible below. NOT full-body, NOT close-up of face alone.
- [ ] **Background:** flat cream — no scene, no decor, no shadow stack under the subject. The cream background gets removed in step 7; uneven painterly cream is fine since remove.bg keys it out cleanly.
- [ ] **No glasses, no hat, no jewelry, no bunny ears, no rabbit features anywhere.**
- [ ] **No downward head pitch.** Head straight or tilted purely sideways. (Forbidden body-language composite per Dave's §6.1.)
- [ ] **No folded arms, no hand-on-hip** (head+shoulders crop should preclude this anyway, but flag if it sneaks in).
- [ ] **Single subject** — not two faces, not a duplicated image.
- [ ] **No baked-in text** — MJ sometimes hallucinates "Emma" or other lettering on the cardigan; reject those variants. The wordmark is added in the SVG wrapper later.

If all 4 variants fail on **photoreal drift** (the most likely v7 failure mode for portrait subjects), the fix is per `feedback_mj_moderator_negatives_per_word.md` §"v7 photoreal-drift" — but portraits-of-humans are usually less photoreal-prone than inanimate objects, so this fallback is unlikely to be needed. If it does happen, escalate the prompt's `--no` block with `glossy reflection, gradient shading` and re-roll.

---

## Risk register — what could go wrong with this specific prompt

1. **Moderator trip on "young woman" / portrait.** v7 moderator is cautious with portraits-of-people per `feedback_mj_moderator_negatives_per_word.md`. The prompt is intentionally minimal (~50 words) and avoids `sexy`, `school uniform`, anatomical body-part defenses, weapon defenses — none of those apply to this asset. If a trip happens, fall back to the ~30-word minimal version: _"A cute illustrated portrait of a young woman teacher with wavy brown hair, gentle smile, peach cardigan, head and shoulders, cream background, children's storybook illustration style --no photorealistic, anime, multiple subjects, text"_. If even that trips, drop the word "woman" entirely: _"A cute illustrated portrait of a kind teacher character with wavy brown hair..."_.

2. **Anime/chibi drift.** v7's defaults lean anime for face subjects more than for animal/object subjects. The `--no anime, chibi, sharp anime style` block defends against this; the positive `simple children's storybook illustration style with clean line art and soft cel-shading` reinforces it. If 4/4 variants come back anime-sharp, escalate the prompt body with "soft round face, gentle pastel coloring, NOT anime, NOT chibi" inline (inline negation is empirically stronger than `--no` for the photoreal/anime drift trigger).

3. **Pose drift toward "full-body".** The prompt says "head and shoulders only" but MJ sometimes adds full-body anyway. If 3+ variants come back full-body, re-roll with the inline reinforcement: "head and shoulders portrait crop, do not show full body". Variant-2 of a 4-grid sometimes lands the right crop while 1/3/4 go wide — that's an acceptable pick.

4. **Bunny-ears leakage.** Despite `--no bunny ears, rabbit features`, MJ occasionally adds rabbit-girl features when the cardigan + brown-hair combo trips a kawaii-mascot vector. Reject any variant with even subtle ear-shaped hair tufts or rabbit accessories. Re-roll.

5. **Cohesion across the asset family.** Per `feedback_mj_pack_cohesion_lever_unused.md`, the project has not been using `--cref`/`--sref` for cross-asset cohesion — the style preamble alone has carried 38 prior assets. The same is expected here. If Thomas opens the rendered asset alongside `emma-idle.svg` and the face shape / hair tone / skin tone don't read as the same person, **do not start using `--cref` reactively** — re-roll with the prompt tightened toward the specific drift (e.g. "darker brown hair, rounder soft face"). The cohesion lever stays opt-in only.

6. **PNG-in-SVG file size.** Spec §6 allows up to 4 MiB per the vite-pwa cap. MJ upscale outputs ~2048×2048 PNG at ~3–5 MB; after remove.bg it can grow slightly due to alpha channel. If the post-remove.bg PNG exceeds 4 MiB, the asset would break PWA precache. Mitigation: have Thomas downsample the transparent PNG to 1600×1600 before embedding if file-size check fails. Devon's embed step is the gate.

7. **Inline IPA / unicode pitfall is NOT a risk here** — this asset surfaces visually, not via TTS. The canon-text unicode rules from `planner-and-canon.md` do not apply.

---

## Provenance

- **Companion spec:** [`emma-splash-logo-spec.md`](emma-splash-logo-spec.md).
- **MJ workflow rules:** user memory `feedback_mj_walkthrough_step_by_step.md` (step-by-step + per-tier subdirs), `feedback_mj_moderator_negatives_per_word.md` (v7 constraints, ≤40-word ceiling, per-prompt `--no`), `feedback_mj_pack_cohesion_lever_unused.md` (no `--cref`/`--sref`), `feedback_mj_workflow_explicit_removebg.md` (9-step canonical loop, mandatory remove.bg).
- **Style anchor:** [`design/character-emma.md`](../../character-emma.md) §2.1 — manhwa/webtoon, Studio Ghibli warmth (DO NOT mention in MJ prompt body).
- **Body-language gate:** [`design/character-emma.md`](../../character-emma.md) §6.1 — Dave's forbidden + permitted body-language lists.
- **Output target:** `c:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning/design/references/character-emma/emma-logo.png` → Devon embeds into the §6 SVG wrapper of the spec.
