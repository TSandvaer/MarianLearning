# Emma splash-logo asset spec

**Surface:** `public/assets/emma-logo.svg` — the wordmark+character image rendered on the Splash screen.
**Status:** Spec — draft. Replaces the legacy placeholder (text-only edit of `melody-logo.svg`; bunny mark retained pending Emma-styled logo per its own header comment).
**Audience:** Thomas (MJ generator), Devon (embed pipeline), Jessica (QA), Kevin (audio adjacent — out-of-scope for this surface).

---

## 1. Why this asset exists

The Splash screen ([`src/screens/Splash.tsx`](../../../src/screens/Splash.tsx)) renders `/assets/emma-logo.svg` at ~240 px wide as the first visual on app launch. Today's file (`public/assets/emma-logo.svg`) is openly self-documented as a text-only edit of the legacy `melody-logo.svg`: the wordmark says "Emma" but the bunny mark is intact placeholder geometry. This spec defines the replacement.

**Emotional brief — the load-bearing line.** The Splash `aria-label` is `"Emma is waking up"`. The first visual sets the entire session's tone before any audio plays. The asset must read as "warm, calm friend just opening her eyes, glad to see you" — not "logo with a person in it", not "advertisement", not "loading screen". This is closer to a portrait than a brandmark.

**What's being replaced:**

- The bunny mark inside `<g transform="translate(128 132)">` — long-eared pink-bunny silhouette + flower + face. Out.
- The "Emma" wordmark + heart flourish inside `<g transform="translate(128 252)">`. **In question** — see §3 composition call below.

---

## 2. Pose / expression — design call: "just-waking-up, eyes opening to a soft smile"

**Recommendation: head-and-shoulders portrait, peaceful expression with eyes softly open looking slightly off-camera, gentle closed-mouth smile.** Connotation: she has just woken up, blinked at the day, smiled. Marian is the first thing she sees this morning.

**Why not "eyes closed."** The `aria-label` says "waking UP", not "sleeping". Eyes-closed reads as `emma-sleepy.svg` — the Session-End wind-down pose — which is the wrong end of the day. Eyes need to be open. The mood we want is the half-second AFTER waking, not before.

**Why not "full-energy idle smile."** That's `emma-idle.svg`. Splash is a softer beat than mid-session presence. The portrait should feel a little quieter than idle — slightly smaller smile, slightly relaxed brows, gaze a few degrees off the viewer (eye-contact softness, not direct address). Closer to the inner emotional state of `emma-listening.svg` than `emma-idle.svg`, but with a portrait framing instead of a 3/4 character render.

**Alternative rejected: eyes-closed-then-opening animated sequence.** The Splash spring-scale-in animation already carries motion (stiffness 180, damping 18, 0.9 → 1, opacity 0 → 1). Layering a second eyes-opening animation would compete with the existing entrance choreography for a beat that auto-advances in 1.5–3 s. Static asset on top of the existing spring is the right amount of motion.

**Mandatory body-language conformance (Dave's §6.1, [`design/character-emma.md`](../../character-emma.md)):**

- Sideways or zero head tilt only — **never downward pitch** (forbidden composite).
- No folded arms, no hand-on-hip, no glasses, no clipboard.
- Both brows relaxed-neutral. No raised-brow + downward-tilt composite.
- Soft mouth — closed gentle smile. No pursed lips (forbidden), no full open-teeth smile (over-performance for this beat).
- Gaze slightly off-camera, soft. Eyes never animated to track Marian; in a static portrait the gaze direction is set once and read as "looking out, glad to be here."

---

## 3. Composition — design call: portrait + separate wordmark in-SVG, with character carrying the frame

**Recommendation: head-and-shoulders portrait fills the upper ~70% of the asset; the "Emma" wordmark + small heart sit below in the lower ~30%, same band the legacy logo uses (`<g transform="translate(128 252)">`).**

The legacy `emma-logo.svg` already establishes a two-band composition: mark on top, wordmark on bottom. Marian sees this layout every launch; preserving it minimises the re-orient cost of the new asset. The character replaces the bunny mark; the wordmark band is re-authored as part of this spec (see §3.1 below) to match Emma's palette + line-weight.

**ViewBox: `0 0 256 320`** — same as the legacy logo, so the React component's `w-60 max-w-[60vw]` width pin renders the new asset at the same physical size on Marian's iPad. No CSS or JSX edit needed in `Splash.tsx`. Character occupies the upper 256×220 band; wordmark occupies the lower 256×100 band.

**Why head-and-shoulders, not full-body.** At ~240 px wide on the iPad, a full-body Emma (240×360 viewBox per the canonical pose set) would render the head at ~40 px — too small to register the gentle expression that carries this asset. Portrait crop trades the "Emma" body cues (cardigan, wand-pointer, skirt) for emotional legibility, which is the right trade for this surface. The body cues live on every other screen.

**Why include the wordmark inside the SVG.** Two options were considered:

1. **(Chosen)** Character + wordmark in one SVG. Replicates legacy logo composition; one asset to install; the existing component (`<img src="/assets/emma-logo.svg" alt="Emma" />`) needs zero code change. Wordmark style is part of the asset spec, not a runtime tailwind class — guaranteed visual consistency across launches and devices.
2. (Rejected) Pure character image in SVG; "Emma" rendered as separate JSX text below. Lets the wordmark inherit live tailwind tokens (color, font). Costs: requires a React change in `Splash.tsx`; introduces font-loading flash-of-unstyled-text risk; the wordmark would inherit system font on iPad PWA, which renders differently device-to-device. Worse, the spring-scale-in animation currently animates the whole asset as one unit — splitting introduces a second motion timing decision.

**Composition diagram:**

```
viewBox 256 × 320
┌───────────────────────────────────┐
│                                   │
│       ╭─────────╮  ← character    │  upper band: 0..220
│      │  Emma     │   (PNG-in-SVG  │  ~70% of frame
│      │  head &   │    portrait,   │
│      │  shoulders│    cropped at  │
│      │           │    upper       │
│       ╰─────────╯    cardigan)    │
│                                   │
├───────────────────────────────────┤  band divider at y≈230
│                                   │
│            Emma                   │  lower band: 220..320
│             ♡                     │  ~30% of frame
│                                   │
└───────────────────────────────────┘
```

The character sits **centred** on x=128, **head-top at y≈30, chin at y≈140, shoulder-line at y≈210.** The wordmark baseline is at y=252 (matches legacy). The heart sits at y≈280, centred.

### 3.1 Wordmark sub-spec

Re-author the wordmark to match Emma's palette + style anchors:

- **Text:** `Emma` — same as legacy.
- **Font family:** same as legacy SVG (`-apple-system, 'SF Pro Rounded', 'SF Pro', 'Segoe UI', system-ui, sans-serif`). This is rendered system-font; preserves the legacy text-rendering result so the only delta the user sees is the character above.
- **Font weight:** `700`, same as legacy.
- **Font size:** `44`, same as legacy.
- **Letter spacing:** `1.5`, same as legacy.
- **Fill:** `#3D2B3D` — same soft-aubergine lineart color the existing Emma SVG character set uses for outlines. This keeps the wordmark in palette-family with the body of the asset set; the legacy logo already uses this exact hex.
- **Heart flourish:** below the wordmark at y≈280, centred. Fill `#F48FB1` (warm pink — matches legacy heart and is in the existing Emma palette family). Stroke `#3D2B3D` 1.6pt. **Keep the heart.** Marian's symbolic shorthand; carries no IP risk; warm but not saccharine.

### 3.2 What gets dropped from the legacy SVG

Everything inside `<g transform="translate(128 132)">` — bunny ears (left + right), hood dome, cream face oval, flower-on-hood (5-petal pentagon + yellow centre), eyes, cheek dabs, pink-triangle nose, smile arc. The replacement portrait sits in this same translate slot.

---

## 4. Style anchor — match the existing Emma SVG asset set

The new portrait must read as the **same Emma** Marian sees across every other screen. The existing Emma SVGs are the canonical visual reference:

- [`public/assets/emma-idle.svg`](../../../public/assets/emma-idle.svg) — **primary reference for face, hair, palette, line-weight.** Full-body idle pose; the splash asset is a portrait crop of this same character.
- [`public/assets/emma-listening.svg`](../../../public/assets/emma-listening.svg) — secondary reference for the soft eye/mouth-relaxed beat closest to "just woke up".
- [`public/assets/emma-sleepy.svg`](../../../public/assets/emma-sleepy.svg) — **what NOT to mirror.** Eyes closed, head tilted forward+down ~8°, mouth a relaxed downward parabola. The splash asset must read clearly distinct from this end-of-day pose.

**Style anchors (from [`design/character-emma.md`](../../character-emma.md) §2.1):**

- **Korean manhwa / webtoon, slice-of-life subgenre.** Clean digital lineart, softer than anime. Naturalistic body proportions. Expressive emotion peaks at the face.
- **Tonal sibling:** Studio Ghibli's calm-observant-kind warmth. **DO NOT mention "Studio Ghibli" in the MJ prompt body** — v7 moderator trips on cultural-style descriptors per `feedback_mj_moderator_negatives_per_word.md`. The reference is for the asset author / Thomas-as-curator only.
- **NOT** anime (too sharp), chibi (infantile), Disney 3D, photoreal, 3D render.

**Visual age 25–30.** Old enough that "teacher" reads on first look; young enough that "older sister" reads on second.

**Hair:** medium-length, soft natural waves, parted slightly off-centre. Optional small bow on LEFT side. Color: soft dark brown (`#5C3F31` per the established palette) with optional single highlight band (`#8B6650`).

**No glasses, ever.** Locked per Thomas 2026-04-28.

**No bunny ears, ever.** Replacing the bunny is the whole point of this asset.

---

## 5. Color palette — extend the existing Emma tokens

All colours per [`design/character-emma.md`](../../character-emma.md) §2.2. Re-listed here for the MJ prompt body and remove.bg result audit.

| Zone                     | Hex               | Use in this asset                                             |
| ------------------------ | ----------------- | ------------------------------------------------------------- |
| `--emma-skin`            | `#F5DCC9`         | Face, neck, visible upper chest                               |
| `--emma-skin-shadow`     | `#E8C4A8`         | Single cheek/jaw shadow stop                                  |
| `--emma-hair`            | `#5C3F31`         | Hair main                                                     |
| `--emma-hair-highlight`  | `#8B6650`         | Single crown highlight band (optional)                        |
| `--emma-cardigan`        | `#F0CDB8`         | Peach cardigan main fill (visible shoulder line)              |
| `--emma-cardigan-shadow` | `#D9AC93`         | Cardigan shadow side                                          |
| `--emma-blouse`          | `#FFF6EE`         | Cream undershirt (V-collar visible above cardigan)            |
| `--emma-eye`             | `#3E2818`         | Iris (warm dark brown, NOT black)                             |
| `--emma-mouth`           | `#C77A7A`         | Mouth fill (soft rose, NOT bright red)                        |
| Background               | `#FFF5F0` / cream | **Asset background — MJ output cream; remove.bg keys it out** |
| Wordmark                 | `#3D2B3D`         | Soft-aubergine lineart hex used by every Emma SVG outline     |
| Heart                    | `#F48FB1`         | Warm pink — palette-coherent                                  |

**Background consistency with the Splash screen surface.** Splash itself renders `bg-my-cream` with a subtle radial-gradient pink wash centred at 50%/45%. The asset's transparent PNG-in-SVG sits on top of that wash. **The character must NOT have a hard rectangular cream background baked into the asset** — Marian would see a flat rectangle floating on the page's cream-with-wash, which reads as "logo block" not "portrait." Hence the remove.bg step is load-bearing.

**Acceptable cream tint left over from remove.bg.** Slight edge halo where remove.bg can't fully separate is acceptable provided it's within ~2 px and the colour matches the page wash. Devon's pair-review at 96 pt against the live splash background catches this.

---

## 6. Output target — PNG-in-SVG, matching the existing Emma asset family

**Format: PNG-in-SVG.** Same technique as every other Emma asset in the set (per [`emma-character-and-animation.md`](../../../../.claude/docs/emma-character-and-animation.md) §1 polish backlog — vector re-trace is a separate future task; do not block on it here).

**Pipeline:**

1. Thomas generates the portrait via MJ Web v7 (see `emma-splash-logo-prompt.md`).
2. Picks the best of 4 variants.
3. **Upscales** the chosen variant (MJ → Upscale → Subtle).
4. **Downloads** the upscaled PNG (~2048×2048, cream background, NOT transparent).
5. **Removes the cream background** via `remove.bg` (drag-drop PNG → transparent PNG).
6. Saves the transparent PNG to `MarianLearning/design/references/character-emma/emma-logo.png`.
7. Devon (or Thomas, post-paint) embeds the transparent PNG into the **two-band SVG wrapper** with the wordmark layer below per §3 composition.

**ViewBox of the wrapper SVG:** `0 0 256 320`, same as legacy. The embedded `<image>` tag fills `x=0 y=0 width=256 height=220` (the upper character band). The `<g transform="translate(128 252)">` wordmark group sits in the lower band, unchanged in structure from the legacy file (text + heart only; the bunny `<g translate(128 132)>` group is deleted).

**File size budget:** ~2.5–3.3 MB, matching the other Emma assets and within the precache budget bumped to 4 MiB in `vite.config.ts`. Bake the PNG at the source-image native resolution (2048×2048 from MJ upscale → portrait crop) — viewBox scaling handles the iPad render size.

**Why not re-author as flat vector SVG (~8 KB) like the original spec called for.** Polish backlog item per `emma-character-and-animation.md` §1: every Emma asset is currently PNG-in-SVG; vector re-trace is tracked separately. Authoring this one asset as a pure vector while every other Emma is PNG-in-SVG would create a visible style inconsistency across screens — Marian's first visual would not match the rest of the app's visual identity. Defer to the existing asset family's posture; vector re-trace becomes a cross-family task later.

**SVG wrapper template (Devon embed reference):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!--
  emma-logo.svg
  Splash-screen wordmark + portrait of Emma. Replaces the legacy
  text-only edit of melody-logo.svg (the bunny placeholder).
  Spec: design/references/character-emma/emma-splash-logo-spec.md.
  Generated via MJ Web v7 + remove.bg per the project's PNG-in-SVG
  pipeline; vector re-trace tracked separately (polish backlog).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" role="img" aria-label="Emma">
  <title>Emma</title>

  <!-- Portrait — upper band -->
  <image href="data:image/png;base64,<BASE64_OF_TRANSPARENT_PNG>"
         x="0" y="0" width="256" height="220"
         preserveAspectRatio="xMidYMid meet"/>

  <!-- Wordmark "Emma" + heart flourish -->
  <g transform="translate(128 252)" text-anchor="middle">
    <text x="0" y="0"
      font-family="-apple-system, 'SF Pro Rounded', 'SF Pro', 'Segoe UI', system-ui, sans-serif"
      font-weight="700"
      font-size="44"
      letter-spacing="1.5"
      fill="#3D2B3D">Emma</text>
    <path d="M 0 18
      C -3 13, -10 13, -10 19
      C -10 24, -5 27, 0 30
      C 5 27, 10 24, 10 19
      C 10 13, 3 13, 0 18 Z"
      fill="#F48FB1" stroke="#3D2B3D" stroke-width="1.6" stroke-linejoin="round"/>
  </g>
</svg>
```

---

## 7. Accessibility

**Current state:**

- `<m.main>` has `aria-label="Emma is waking up"` (in `Splash.tsx` line 98).
- `<m.img>` has `alt="Emma"` (in `Splash.tsx` line 102).
- The SVG file has `role="img" aria-label="Emma"` + `<title>Emma</title>`.

**Recommendation: keep all three unchanged.** The screen-level `aria-label` carries the mood for assistive tech; the image-level `alt="Emma"` is the right brevity for a logo/portrait image (longer alt would be read on every Splash mount and become a nag). The SVG `aria-label` and `<title>` are belt-and-braces for any direct-loaded asset context.

**Optional refinement (not blocking this spec):** Splash already screen-reads "Emma is waking up" via the parent element; the image's redundant `alt="Emma"` could be `alt=""` (presentational) to avoid double-announcement. This is a low-priority Jessica follow-up if she observes a real double-announce on iPad VoiceOver — not authored as a v1 change here.

---

## 8. Acceptance criteria

**Asset existence:**

- [ ] `public/assets/emma-logo.svg` replaced with the new asset following the §6 wrapper template.
- [ ] Legacy bunny `<g transform="translate(128 132)">` group fully removed; replaced by `<image href="data:image/png;...">`.
- [ ] Wordmark `<g transform="translate(128 252)">` group preserved; heart preserved; "Emma" text preserved.
- [ ] ViewBox unchanged: `0 0 256 320`. **No React/CSS change to `Splash.tsx` is required by this spec.**

**Visual taste (Thomas + Jessica):**

- [ ] Portrait reads as Emma — same character as `emma-idle.svg`, just a portrait crop. Face shape, hair tone, palette, eye colour all consistent.
- [ ] Eyes are **open** (NOT closed — distinct from `emma-sleepy.svg`).
- [ ] Expression: gentle closed-mouth smile, soft. NOT a full open-teeth grin.
- [ ] Gaze: softly off-camera, NOT direct address.
- [ ] No bunny ears, no rabbit features anywhere in the portrait.
- [ ] No glasses, no clipboard, no chalkboard, no other teacher-authority props.
- [ ] No downward head pitch. No raised-brow + downward-tilt composite. No pursed lips. No folded arms.
- [ ] Background of the embedded PNG is transparent (NOT a cream rectangle floating on the splash).
- [ ] Wordmark renders identically to the legacy logo (same font, weight, size, colour, heart shape, position).

**Render correctness on Splash:**

- [ ] Loads via `<img src="/assets/emma-logo.svg" alt="Emma" />` at `w-60 max-w-[60vw]` (~240 px wide on iPad).
- [ ] Spring scale-in animation (stiffness 180, damping 18, scale 0.9→1, opacity 0→1) runs against the new asset without visual artefact.
- [ ] On reduce-motion, asset snaps to final state cleanly (global `MotionConfig reducedMotion="user"` handles this).
- [ ] Splash auto-advances within `WARM_CAP_MS = 1500` (warm) or up to `COLD_CAP_MS = 3000` (cold) with no decode delay caused by the asset (PNG-in-SVG decode of a ~3 MB asset should complete well within 200 ms on iPad).

**File-size + cache:**

- [ ] Asset file size ≤ 4 MiB (vite-pwa `maximumFileSizeToCacheInBytes` cap).
- [ ] Asset precaches successfully on first PWA install (verify `dist/assets/emma-logo.svg` appears in the build output).

**Anti-dark-pattern:**

- [ ] No red on the asset (CLAUDE.md non-negotiable).
- [ ] No urgency, no scarcity, no count-down imagery.
- [ ] No "I missed you" / "I'm here for you" sub-text under the wordmark.
- [ ] No fawning / longing facial expression — calm-glad, not pining.

---

## 9. Open questions

1. **Wordmark stays inside the SVG?** Default in this spec is yes (per §3 composition). Alternative: pure-character SVG + JSX-rendered wordmark below in `Splash.tsx`. Default chosen for zero-code-change shipping; if Thomas wants the wordmark to live in JSX so it can pick up live design tokens / dark-mode palette / parent settings overrides later, route the change request through Matt → Devon (Splash.tsx edit + asset re-crop).

2. **Optional: redundant `alt="Emma"` → `alt=""`.** §7 above — low-priority Jessica follow-up, not authored as a v1 change here.

3. **Vector re-trace.** Polish-backlog item per `emma-character-and-animation.md` §1. This asset ships as PNG-in-SVG matching the rest of the Emma family; vector re-trace happens as a cross-family task later. Not blocking.

---

## 10. Provenance

- **Surface:** [`src/screens/Splash.tsx`](../../../src/screens/Splash.tsx) line 101 (`<img src="/assets/emma-logo.svg" />`).
- **Replaces:** [`public/assets/emma-logo.svg`](../../../public/assets/emma-logo.svg) (legacy text-only edit per its own header comment).
- **Character canon:** [`design/character-emma.md`](../../character-emma.md) §1, §2, §6.1 (Dave's forbidden body-language list).
- **Asset family doc:** [`.claude/docs/emma-character-and-animation.md`](../../../../.claude/docs/emma-character-and-animation.md) §1, §3 (the PNG-in-SVG family + polish backlog).
- **MJ workflow:** companion prompt at [`emma-splash-logo-prompt.md`](emma-splash-logo-prompt.md). Pipeline rules captured in user-memory `feedback_mj_walkthrough_step_by_step.md`, `feedback_mj_moderator_negatives_per_word.md`, `feedback_mj_pack_cohesion_lever_unused.md`, `feedback_mj_workflow_explicit_removebg.md`.
- **PWA cache budget:** [`vite.config.ts`](../../../vite.config.ts) line 93 — `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024`.
