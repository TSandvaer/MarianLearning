# Emma — Character and Animation System

## What this doc covers

Emma is the original manhwa/webtoon-style young female teacher who is the visible face of the Marian Tutor app. This doc captures the character's provenance, the SVG asset set, the shared `EmmaCharacter` render component, the pose state machine (`EmmaPose`), the celebration / puzzled tilt motion brief, the speech-ribbon caption walk, the Hub idle-vs-celebration mutual-exclusion gate, the `PromotionCelebration` overlay, the reduce-motion handling, the "never a red X" reaction principle, and the long-press parent-gate hidden on Emma's body. Anything below the character layer (Howler, audio decoding, planner/canon, progress doc shape, screen lifecycles) is out of scope and lives in sibling docs.

---

## 1. Character provenance

Emma replaced the previous mascot **Melody** in a two-phase pivot:

- **Phase 3a (audio + name)** shipped 2026-04-28. Voice swap to `en-US-EmmaMultilingualNeural` at rate `-10%`. Greet MP3s re-rendered. In-app captions updated. `CACHE_VERSION` bumped.
- **Phase 3b (visual migration)** shipped 2026-04-29 in PR #104, with documentation closeout in PR #121 (2026-05-02).

The pivot was driven by a Sanrio-resemblance concern with "Melody"; Emma is an original character intentionally drawn IP-clean. Decision context: memory entry `project_character_pivot_emma_2026_04_28.md`. Visual brief: [character-emma.md](MarianLearning/design/character-emma.md). AI prompt deck for asset generation: [character-emma-ai-prompts.md](MarianLearning/design/character-emma-ai-prompts.md). Motion brief: [motion-brief.md](MarianLearning/design/character/motion-brief.md).

The character pivot is functionally complete — every screen consumes `emma-*.svg`. **Two items remain on the polish backlog**:

1. The current SVG assets use a **PNG-in-SVG technique** (rasterised PNG embedded in an SVG wrapper). The 8 full-body pose files are now **703–933 KB each** (verified 2026-06-14, after a 2026-05-14 re-cut); an earlier generation was ~2.5–3.3 MB, which is what drove the bump of `maximumFileSizeToCacheInBytes` from 2 MiB → 4 MiB → 8 MiB (latest lift in ticket 86c9qa7uh) in [vite.config.ts:112](MarianLearning/vite.config.ts#L112). The cap has **not** been reverted since the re-cut, so at current sizes none approach it — vector re-trace (Wave 14 Track A, ClickUp `86ca8kq36` design → `86ca8kq42` impl) is therefore true visual-quality polish, **not** a cache-pressure fix. The stale `~2.5–3.3 MB` comment also still lives in `vite.config.ts` (~line 95) and should be corrected when the re-trace lands. `emma-th-mouth.svg` (94 KB, already a tight-crop vector overlay — PR #237) and `emma-logo.svg` (427 KB) are excluded from / deferred in the re-trace scope.
2. The `rotateZ` tilt and idle breathing loop are wired in `EmmaCharacter` but the `attentive-pointing` and `listening` poses are not yet consumed at runtime by Math/WordSong — only `idle`, `celebration`, and `puzzled-tilt` are actively driven by screen state.

---

## 2. Visual identity (one-paragraph reference)

Emma is the calm, observant teacher who shows up for ten minutes a day, never raises her voice, and is genuinely happy to see Marian. Visual age 25–30 — old enough that "teacher" reads, young enough that "older sister" reads. Voice register: warm, calm, encouraging, never saccharine. Short clear sentences within the 200-word vocab cap. Style anchors are Korean manhwa / webtoon slice-of-life with a Studio Ghibli warmth. **Never a bunny ear, never glasses, never a downward head pitch (reads as judging), never a red X.** Full visual / palette / pose spec lives in [character-emma.md](MarianLearning/design/character-emma.md) §1–§6; this doc only restates what code consumes.

---

## 3. Asset set

Emma SVGs ship under `public/assets/` and fall into two categories:

- **Pose-driven assets** — resolved automatically by the [EmmaCharacter.tsx:153](MarianLearning/src/components/EmmaCharacter.tsx#L153) pose pipeline (`/assets/emma-${pose}.svg`). Every `EmmaPose` value maps to exactly one of these files. `EmmaCharacter` is the sole consumer.
- **Non-pose Emma assets** — `emma-` prefixed SVGs that are NOT part of `EmmaPose` and NOT resolved by `EmmaCharacter`. Referenced by direct path from the screen that needs them. Conventions for these are in §3b.

| File                          | Pose-driven? | Purpose                                                                                                                                                                                    |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `emma-idle.svg`               | Yes          | Default; consumed on Hub, Math, WordSong, Greet, between-problem rest.                                                                                                                     |
| `emma-celebration.svg`        | Yes          | Correct-answer reaction; auto-returns to idle after a hold.                                                                                                                                |
| `emma-puzzled-tilt.svg`       | Yes          | Wrong-answer reaction; tilt RIGHT, "considering" affect.                                                                                                                                   |
| `emma-listening.svg`          | Yes          | Reserved for caption-reveal beat; not yet wired at runtime.                                                                                                                                |
| `emma-attentive-pointing.svg` | Yes          | Reserved for Math/WordSong hint state; not yet wired at runtime.                                                                                                                           |
| `emma-cheering.svg`           | Yes          | Session-End "you did it!" beat. One-shot, NOT pose-state-machine driven.                                                                                                                   |
| `emma-waving.svg`             | Yes          | Session-End goodbye. Reserved.                                                                                                                                                             |
| `emma-sleepy.svg`             | Yes          | Reserved for the sleep-splash session-end CTA (Option C, Week 3 backlog).                                                                                                                  |
| `emma-logo.svg`               | No           | Splash / app-icon adjacent; direct-path reference.                                                                                                                                         |
| `emma-th-mouth.svg`           | **No**       | Mouth-region close-up for the /th/ digraph mouth-cue. Referenced by direct path from WordSong. Base asset shipped PR #235; tongue-overlay refinement + wiring tracked separately. See §3b. |

All assets live at:

- [public/assets/emma-idle.svg](MarianLearning/public/assets/emma-idle.svg)
- [public/assets/emma-celebration.svg](MarianLearning/public/assets/emma-celebration.svg)
- [public/assets/emma-puzzled-tilt.svg](MarianLearning/public/assets/emma-puzzled-tilt.svg)
- [public/assets/emma-listening.svg](MarianLearning/public/assets/emma-listening.svg)
- [public/assets/emma-attentive-pointing.svg](MarianLearning/public/assets/emma-attentive-pointing.svg)
- [public/assets/emma-cheering.svg](MarianLearning/public/assets/emma-cheering.svg)
- [public/assets/emma-waving.svg](MarianLearning/public/assets/emma-waving.svg)
- [public/assets/emma-sleepy.svg](MarianLearning/public/assets/emma-sleepy.svg)

`dist/assets/emma-*.svg` mirror these post-build and are not authored.

---

## 3a. Source-asset repository — `design/references/character-emma/`

The `public/assets/emma-*.svg` runtime files are not the authoring origin — each embeds a base64 PNG produced from a two-tier source tree under `design/references/character-emma/`:

| Tier             | Path                                                 | Contents                                                                                                                                                                                                                                                     | Git-tracked? |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| MJ originals     | `design/references/character-emma/*.png`             | Raw Midjourney outputs, 1024×1024, with cream/solid backgrounds. Kept as recoverable source. One per pose: `emma-idle`, `emma-celebration`, `emma-cheering`, `emma-listening`, `emma-puzzled-tilt`, `emma-sleepy`, `emma-attentive-pointing`, `emma-waving`. | Yes          |
| Transparent cuts | `design/references/character-emma/transparent/*.png` | Background-removed 1024×1024 versions — the **source-of-truth assets** that get base64-embedded into the `public/assets/` SVG wrappers.                                                                                                                      | Yes          |

**Both tiers are committed to git** — neither is gitignored. This is the _opposite_ policy from `design/references/picture-pack/**/*.png` (which IS gitignored): the picture-pack PNGs are large trace-references with no embed role, whereas the Emma set is small and the transparent versions ARE the SVG-embed source-of-truth — losing them would force a full re-cut.

**One exception in the originals tier:** `emma-splash-base.png` is NOT a raw MJ original — it's the already-processed (background-removed, 500×500) splash-logo source committed via PR #218, pre-dating the bgclear.ai tool decision. Every other `character-emma/*.png` is a pristine MJ original. A future re-cut may re-source it at full resolution and relocate it under `transparent/` for consistency.

**Canonical BG-removal tool:** bgclear.ai (full 1024×1024, best edge fidelity on manhwa-style linework). Fallback: remove-bg.io → remove.bg. See the `feedback_mj_workflow_explicit_removebg` memory + `removebg-tool-evaluation-2026-05-14.md`.

**bgclear.ai is a web-only service — no programmatic API.** It requires a human drag-drop in the browser; dispatched sub-agents cannot run it. Any brief asking an agent to "run bgclear.ai" will silently fail at that step (agent finds no API, may fabricate a transparent-PNG result or report an error). **Route bg-removal to Thomas as a manual hand-off step** and resume agent work after Thomas confirms the transparent PNG is committed to `design/references/character-emma/transparent/`. The `rembg` Python CLI is API-accessible but has weaker edge fidelity on manhwa linework — acceptable for prototyping, not for shipped Emma assets.

**MJ warm-beige background is luminance-identical to manhwa skin tones — automated bg-removal is unreliable on face-crop assets.** MJ outputs a default warm-beige background (RGBA ~247, 225, 207) that falls inside the skin-tone luminance range (244–249). Edge-detection tools — including bgclear.ai and `rembg` — find luminance discontinuities; on a face-close-up MJ output there is no discontinuity at the face/background boundary, so any tool's cut is unreliable. Full-body portraits (idle, celebration, etc.) are less affected because the body silhouette provides a continuous high-contrast perimeter; the problem is acute for tight face/mouth crops. **Rule for any future face-crop or mouth-cue MJ prompt:** request a high-contrast background explicitly — e.g. `solid bright cyan background`, `solid dark teal background` — so bg-removal has a clear edge to detect. Observed PR #235 (2026-05-14): the `emma-th-mouth.svg` base PNG could not be cleanly cut even though it ships in the `transparent/` folder by convention. Worth also flagging in the user-memory `feedback_mj_*` cluster.

**Producing a transparent PNG is step 1 only.** Step 2 is re-embedding it as base64 into the corresponding `public/assets/emma-*.svg` wrapper — the pattern established in PR #218 for `emma-logo.svg`. The `transparent/*.png` files are NOT read at runtime; the app only renders the SVGs.

**Current state (2026-05-14, PR #221):** `transparent/` ships with a README only — a deliberate stub. The existing `public/assets/emma-*.svg` files still embed PNGs from an earlier generation pass; a deliberate full Emma-family re-cut (bgclear.ai pass on each original → `transparent/` → SVG re-embed) is a polish-backlog item.

**ViewBox & sizing.** Idle pose authored at `240 × 360` (full body). Renders pinned to:

- ~60vh on Greet (entrance pose).
- ~30vh on Math / Word Song (upper-left perch with wand pointing into the problem area).
- 22vh on Hub (centred-upper).

Pivot for breathing/tilt is `transform-origin: 50% 100%` (feet) — the brief's chosen pivot so breathing rises naturally; the small head-displacement difference at ±6°–±10° tilt was measured-acceptable by Kyle. Ref: [EmmaCharacter.tsx:174](MarianLearning/src/components/EmmaCharacter.tsx#L174).

---

## 3b. Non-pose Emma assets — conventions and production path

Non-pose Emma assets carry the `emma-` name prefix for brand cohesion but are **not** part of `EmmaPose` and are **not** resolved by `EmmaCharacter`. Each is referenced by its direct public path from the screen that needs it. `emma-th-mouth.svg` (PR #235) is the first.

### ViewBox sub-convention

Pose-family SVGs use a **`0 0 2000 2000`** viewBox (full-portrait embed; the `240 × 360` figure in §3a is the authored design size, not the SVG viewBox). Non-pose assets use a **`0 0 200 200`** viewBox — tight-crop, region-specific, matching the picture-pack SVG envelope. The viewBox is the fast visual signal that a file is not part of the pose family. Author any new non-pose Emma SVG at `0 0 200 200` unless it is explicitly full-portrait.

### Crop-without-bgclear production path

When the subject region of a non-pose asset does not overlap the background — e.g. a face / mouth close-up cropped well inside the figure — a bgclear.ai pass is not required. Use SVG's built-in crop instead:

1. Embed the source PNG with `x`/`y`/`width`/`height` on the `<image>` element positioning the desired region within the `200 × 200` viewBox.
2. Apply a `<clipPath>` set to the `200 × 200` rectangle so the background outside the crop window is never rendered.
3. Verify visually — if any background bleeds into the crop window, fall back to a bgclear.ai pass for that asset.

This is a lightweight alternative to the §3a bgclear.ai round-trip for tight-crop cues where the background sits outside the crop region. `emma-th-mouth.svg` uses it. **Caveat:** residual colour gradients _within_ the crop window are not removed by cropping alone and require visual sign-off before shipping — `emma-th-mouth.svg`'s base PNG still shows a brownish gradient in-frame (ruled polish-backlog, not a blocker, by review).

### Crop verification — required before any visual-pass report

The `x`/`y` offset on the `<image>` element controls which region of the source PNG appears inside the `200 × 200` viewBox, and a wrong offset is **invisible in a code diff** — the SVG is syntactically valid, all vector overlay paths look internally coherent, and any agent that reads the SVG source alone cannot tell whether the offset targets the mouth or the chest. Only loading the rendered asset in a real browser catches the bug. `emma-th-mouth.svg` (PR #235, 2026-05-14) shipped with the `<image>` placed such that the viewBox cropped Emma's **neck/chest/collarbone** instead of her mouth — the pink tongue overlay was floating across her chest. A sub-agent had earlier reported "tongue tip clearly protruding between the upper and lower front teeth" for that same preview URL; the bug was only caught when Thomas opened the rendered URL himself.

**Vercel CDN cache lag — wait before fetching the preview.** For large base64-embedded SVG assets (the standard for all `emma-*.svg`), Vercel's CDN may serve the **prior commit's content for 5–15 minutes** after the deploy reports "ready." Observed on PR #235 (2026-05-14): commit pushed at 07:00 UTC, deploy ready at 07:01 UTC, `WebFetch` still returning the old SVG 8+ minutes later. Symptoms: the agent's `WebFetch` reads SVG source from the previous commit (the response is `200 OK`, syntactically valid, no `X-Cache-Miss` signal); the agent then sees the old `<image>` offsets, finds "no error," and issues a confident-but-stale visual pass. **Rule:** wait ≥ 15 min after the Vercel deploy completes before running the verification steps below, OR cross-check freshness by comparing a known-changed value in the SVG (e.g. the new `x`/`y` offset on the `<image>` element) against expected. When opening the preview in a real browser, always **hard-reload** (Ctrl/Cmd + Shift + R) to bypass the browser's own cache layer on top of the CDN cache. See also `testing-and-ci.md` §3.3.1.

**Step 0 — XML validity check (run BEFORE anything else).** A structurally malformed SVG will not render in any browser, Playwright, or WebKit session — the response is a parser-error page, not the asset. Every downstream visual check is vacuously meaningless because there is nothing to look at. Parse the file first:

```bash
# Option A — xmllint (ships with macOS, most Linux, some CI images)
xmllint --noout public/assets/<file>.svg && echo OK

# Option B — Python (zero extra deps, cross-platform)
python -c "import xml.etree.ElementTree as ET; ET.parse('public/assets/<file>.svg'); print('OK')"
```

If either errors, stop and fix the XML before fetching any preview or doing pixel analysis. Pixel-analysis verification reports — like Kyle's PR #235 first redo (commit `93f8bdd`) — pass on the SVG _source_ and the _source PNG_ even when the SVG itself doesn't parse; the visual-pass report is then meaningless.

**Named recurring trap — `--` inside XML comments.** The XML spec forbids the sequence `--` (double-hyphen) anywhere inside a `<!-- ... -->` block — not only at the end, anywhere in the body. Two ASCII dashes look like ordinary punctuation in a code editor (`"~492 KB -- 6x reduction"`), pass linting silently, and look fine in a diff. Browsers (Chromium, Firefox, WebKit) and XML parsers (`xmllint`, Python `ET.parse`) hard-refuse to parse past the first occurrence. The correct prose em-dash for an XML comment is **`—` (U+2014)**, not `--`. Observed: PR #235 commit `93f8bdd` introduced two such sequences in the `emma-th-mouth.svg` file-header comment; the bug only surfaced when Thomas opened the file in a browser. Fixed in commit `eb4a702` by replacing both with U+2014.

This step applies to **all** `emma-*.svg` assets — pose family + non-pose — because the malformation source (hand-edited file-header comment text) can appear in any authored SVG. See also `testing-and-ci.md §3.3.1` for the adjacent Vercel-CDN-lag rule.

**Mandatory verification before reporting visual-pass on any `<image>`-crop non-pose Emma SVG:**

1. Fetch the Vercel preview URL from the PR's Vercel bot comment (never construct it by pattern — see CLAUDE.md "never fabricate" rule).
2. Open `/assets/<filename>.svg` (or the screen that embeds it) in a real browser.
3. **Name in plain language which body parts are visible in the cropped frame** — e.g. "Emma's lower face from the base of her nose to just below her lower lip; both rows of teeth visible; no chin or neck in frame." A description that could equally describe a different crop ("I see Emma's face") is not evidence.
4. **Give the focal element's approximate position inside the viewBox** — e.g. "the mouth opening sits roughly at y=80–110 of the 200-unit viewBox, horizontally centred."
5. **For SVGs with vector overlays on top of an `<image>` crop**, confirm anatomical alignment — name both the raster landmark and the vector path's position on it: "the upper tooth line sits along the lip boundary; the tongue tip is between the upper and lower tooth lines, not floating elsewhere in the frame."
6. **Call out any composition surprise** — background bleed, out-of-frame focal element, vector overlay landing on the wrong anatomy — even if it still looks "mostly right."

**Third verification path — pixel-scan (preferred for sub-agents).** If a real browser is not available (typical for dispatched sub-agents) or you cannot wait out the CDN-lag window, directly interrogate the committed source PNG with Python PIL `getpixel` at named viewBox coordinates. Convert viewBox to source-pixel via `source_x = viewBox_x − x_attr`, `source_y = viewBox_y − y_attr` (where `x_attr`/`y_attr` are the `<image>` element's `x`/`y` values). Then report exact RGB triples for at least two anatomical landmarks:

```python
from PIL import Image
img = Image.open("design/references/character-emma/transparent/emma-th-mouth.png").convert("RGB")
print(img.getpixel((247, 82)))   # viewBox y=80 region — expect bright tooth white (252, 253, 248)
print(img.getpixel((247, 153)))  # viewBox y=155 region — expect lower-lip pink (205, 115, 94)
```

Format the report as: "viewBox y=80–95 = tooth band; `getpixel(247, 82)` → `(252, 253, 248)` ✓ bright white, consistent with upper tooth enamel; viewBox y=155–165 = lower-lip boundary; `getpixel(247, 153)` → `(205, 115, 94)` ✓ pinkish-red, consistent with lip." This **completely sidesteps both the CDN-lag problem AND the browser requirement** — particularly valuable for dispatched sub-agents. **Caveats:** (a) pixel-scan confirms anatomy at sampled points; it cannot catch a globally-shifted crop that happens to hit a same-coloured pixel for an unrelated reason — back it up with the named-body-parts description above; (b) it verifies the _source PNG_ content at the right coordinates, but NOT that the SVG `<image>` `x`/`y` offset is set correctly — Step 0 XML validity + a math cross-check on the offset values remains required.

A bare "reads correctly" / "tongue is visible between the teeth" / "looks good" is **not sufficient evidence** of a visual pass; the existing `feedback_agent_verify_evidence` memory rule covers URL/ID fabrication and false refusals but does not cover false visual confirmations like this one.

**Diagnostic math when a crop appears wrong.** In the `<image>` element, `x`/`y` are the offset of the top-left corner of the source PNG relative to the SVG canvas. To centre a region at source-pixel `(cx, cy)` inside the `200 × 200` viewBox (with `width`/`height` matching the source PNG dimensions), the offset must be `x = -(cx - 100)`, `y = -(cy - 100)`. **Both axes require explicit measurement** — do NOT assume the horizontal centre of the feature coincides with the centre of the PNG canvas. In MJ full-portrait outputs the face is frequently 30–80 px horizontally off-centre even when the prompt says "centred"; PR #235's redo measured the mouth at source-pixel x=1075 in a 2048 × 2048 PNG (canvas centre 1024 — a ~50 px / ~2.5 % offset, enough to land a vector overlay ~10 px sideways across the wrong anatomy in the rendered 200 × 200 viewBox). A wrong `x` is as invisible in the code diff as a wrong `y`. Scan order: (1) locate `cy` (vertical centre of focal anatomy), (2) locate `cx` (horizontal centre), (3) apply the formula to both, (4) record both in the §3b verification report (step 4) — "mouth centre at source (1075, 980); offset x=-975, y=-880; rendered mouth at viewBox (100, 100)." The common wrong-crop symptoms are a too-small-magnitude negative `y` (window too high) or a naive `x=-(canvas/2 - 100)` (window horizontally off by 30-80 px). **Downscaling does NOT re-centre features** — the offset is preserved proportionally. PR #237 measured the _same_ trap in the 512 × 512 downscaled source: mouth at source x=247, canvas midpoint x=256 — 9 px off (the original 2048's ~50 px offset scaled down). Always measure `cx`/`cy` on the **actual source PNG you are embedding**, at the resolution you are embedding — never the canvas midpoint at any resolution.

**Orchestrator fallback.** If no available sub-agent can produce a description meeting the bar above, escalate to Thomas for a human eyeball before merging — do not merge an Emma asset PR on an unqualified "looks correct."

**Crop-invariance rule — overlay path coordinates survive any crop adjustment.** When you reposition the `<image>` element's `x`/`y`/`width`/`height` to tighten, loosen, or shift the crop window, the vector overlay path coordinates (tooth lines, tongue ellipse, etc.) expressed in viewBox space (`0 0 200 200`) do **not** need recalibration. The algebra cancels: `viewBox_x = source_x − crop_x1` and `crop_x1` cancels when you choose `x = -(cx − 100)` — the overlay stays anatomically aligned regardless of what sub-region is embedded, as long as `cx` (the focal feature's horizontal centre in the source PNG) is still measured from the same source origin. Only the `<image>` element attributes change; the `<path>` / `<ellipse>` definitions are stable. Verified by PR #237 (`emma-th-mouth.svg` recentre + downscale): the upper tooth line stayed at `y=80`, lower tooth line at `y=155`, tongue ellipse at `(100, 130)` while the `<image>` shifted from `x=-156, width=512` to `x=-30, width=260` (a tighter 260×260 crop). **Exception:** if the focal feature itself moves in the source PNG — e.g. you regenerated the MJ asset, or you swapped to a different source — re-measure `cx`/`cy` from scratch.

### File-size discipline for tight-crop embeds

The 2048 × 2048 full-portrait PNG embed that is acceptable for pose assets is oversized for a face/mouth-region close-up. For any non-pose asset covering a sub-region of the body:

- **Re-render or crop-then-downscale the source PNG to `512 × 512` (or smaller) before embedding.** At the asset's largest on-screen use (~22vh) and smallest (~56pt corner cue), `512 × 512` buys identical fidelity to `2048 × 2048`.
- Target file size **< 300 KB** for a tight-crop asset (compare: full-body pose SVGs ~838 KB, picture-pack SVGs 50–250 KB).
- `emma-th-mouth.svg` initially shipped at ~3.1 MB (full 2048 × 2048 portrait embedded uncropped, PR #235) — that was the anti-pattern. PR #237 (2026-05-15) brought it to **94 KB** by replacing the source with a 260 × 260 tight crop (68 KB PNG); the discipline above is what got applied to fix it. Use #237's diff as the worked example when re-applying the discipline to a future tight-crop asset that ships oversized.

### Wiring pattern — `SkillLevel`-prop-gated non-pose cue (template for sh/ch parity)

`emma-th-mouth.svg` is the first non-pose Emma cue wired to a progression-state prop on `<WordSong>`. PR #236 established the wiring shape that any future digraph corner-cue (sh, ch, or others) should follow:

1. **App.tsx kick-effect** — alongside the existing `crossVowelMixing` block, read `loadProgress()` once and derive a `SkillLevel | undefined` for the target node (e.g. `thProgress = ws?.skillLevels['digraphs-th-voiceless']`). **Freeze the value at session-start; do NOT re-derive it reactively during the session.** See `architecture-overview.md` §"Session-start derived-state blocks in the word-song kick-effect" for the kick-effect's accumulation pattern and the 3-block refactor trigger.
2. **First-encounter boolean** — compute `thFirstEncounter = thProgress === 'intro'` (or the equivalent trigger condition) in the same block. Pass both down as `<WordSong>` props.
3. **`<WordSong>` prop shape** — `digraphsThNodeLevel?: SkillLevel` plus a derived `boolean`. Optional; absence means "no cue, safe default" so the gate is safe to wire unconditionally from App.tsx for any session.
4. **Cue render** — `<WordSong>` references `emma-th-mouth.svg` by direct public path (`<img src="/assets/emma-th-mouth.svg">` or equivalent). It does NOT go through `EmmaCharacter` or the `EmmaPose` union — see §3 "Asset set" for the non-pose / pose distinction.

**Why freeze at session-start?** The cue intent is "show this for Marian's first encounter with the digraph" plus "persistent ambient cue while the tier is `intro` / `practicing`." Re-reading progress reactively mid-session could flip the cue off as soon as a problem is answered correctly (in-session mastery updates), which is not the UX intent. The frozen boolean is stable for the session lifetime.

The integration spec §6 constraint 4 marks the sh/ch corner cue as "design-intent-not-yet-shipped." When that work arrives, the seam is the identical shape: add `digraphsShNodeLevel?: SkillLevel` (and `digraphsChNodeLevel?: SkillLevel`) props, compute in App.tsx alongside the existing `thProgress` block (mind the 3-block refactor trigger), reference `emma-sh-mouth.svg` / `emma-ch-mouth.svg`.

---

## 4. Pose state machine — `EmmaPose`

The `EmmaPose` union, per-pose tilt mapping, per-pose hold window, and celebration keyframe constants live in a single shared module: [emmaPose.ts](MarianLearning/src/lib/character/emmaPose.ts).

```ts
export type EmmaPose =
  | 'idle'
  | 'listening'
  | 'celebration'
  | 'puzzled-tilt'
  | 'attentive-pointing'
  | 'sleepy'
  | 'cheering'
  | 'waving'
```

**Why a shared module.** Pre-Phase-3b each screen inlined `MelodyPose = 'idle' | 'happy' | 'puzzled'`. The pivot widened the union and deduplicated the tilt/hold values into one source of truth. Existing `setPose('happy')` callsites were retargeted to `'celebration'`; the historical `melody-happy.svg` overload (correct + waving) was split into separate poses.

### 4.1 Per-pose `rotateZ` tilt

`TILT_BY_POSE` at [emmaPose.ts:44](MarianLearning/src/lib/character/emmaPose.ts#L44):

| Pose                 | rotateZ (deg) | Notes                             |
| -------------------- | ------------- | --------------------------------- |
| `idle`               | 0             | baseline                          |
| `listening`          | 2             | tiny lean toward ribbon           |
| `celebration`        | -6            | tilt LEFT (correct-answer "yes")  |
| `puzzled-tilt`       | +10           | tilt RIGHT (curious "hmm")        |
| `attentive-pointing` | 0             | wand carries the direction        |
| `sleepy`             | 8             | gentle forward-and-down           |
| `cheering`           | 0             | one-shot keyframes carry the beat |
| `waving`             | 0             | one-shot                          |

**Direction matters.** Celebration LEFT and puzzled RIGHT are deliberately opposite so the two states are legible at a glance from Emma's upper-left perch. **Never animate `rotateX`** (downward head pitch reads as judging — explicit on the asset author's forbidden list per `character-emma.md` §6.1).

### 4.2 Per-pose spring config

`TILT_SPRING_BY_POSE` at [emmaPose.ts:84](MarianLearning/src/lib/character/emmaPose.ts#L84). House spring is `stiffness: 260, damping: 20` — the same config used on Math's ribbon scale-in, so Emma's motion vocabulary stays coherent with the screen surfaces. Two pose-specific exceptions:

- `puzzled-tilt`: `220, 20` (~18% softer). The tilt arrives with a hair more lag and reads as "considering" rather than "reacting".
- `celebration`: `220, 22` (kept for fallback / documentation; the active path is **keyframed**, see §4.3).

### 4.3 Celebration keyframes (iteration #2, ticket 86c9kxmqb)

The celebration pose does NOT use a spring at runtime. Iteration #1 (PR #131) softened the spring to 200/22 but Thomas's iPad Pro re-test reported "I hardly see the second pose" — symptom of an instantaneous apex with no hold beat. Iteration #2 replaces the spring with a keyframed sequence that **holds at the apex** so the celebrate pose is visibly registered.

Constants at [emmaPose.ts:128](MarianLearning/src/lib/character/emmaPose.ts#L128):

```ts
export const CELEBRATION_HOLD_MS = 250
export const CELEBRATION_DURATION_MS = 700
export const CELEBRATION_TILT_KEYFRAMES = [0, -6, -6, 0]
export const CELEBRATION_TILT_TIMES = [0, 0.286, 0.643, 1]
export const CELEBRATION_TILT_EASES = ['easeOut', 'linear', 'easeInOut']
```

Sequence: 200ms tilt-out (`easeOut`) → 250ms linear hold at -6° → 250ms tilt-back (`easeInOut`). Total 700ms; hold is ~36% of total.

Implementation in [EmmaCharacter.tsx:178–214](MarianLearning/src/components/EmmaCharacter.tsx#L178) uses Framer Motion's keyframe + `times` form rather than a multi-segment animate sequence. Reduce-motion path collapses keyframes to `rotate: 0`.

### 4.4 Idle breathing loop

`BREATHING_SCALE_KEYFRAMES = [1, 1.02, 1]` over `BREATHING_PERIOD_S = 4` seconds, infinite, ease-in-out. Only fires when `pose === 'idle'`; non-idle poses are short and breathing during them dilutes the celebration / puzzled beats. Hub's idle Emma is the most-visible consumer — without breathing, Emma reads as a portrait rather than a present teacher.

Reduce-motion path collapses to `scale: 1` (no keyframe array).

### 4.5 `POSE_HOLD_MS` — auto-return windows

`POSE_HOLD_MS` at [emmaPose.ts:169](MarianLearning/src/lib/character/emmaPose.ts#L169) describes how long a pose holds before auto-returning to `idle`. `null` means "never auto-returns; the call site clears the pose another way (typically on audio onEnd or on the next user gesture)".

| Pose                 | Hold (ms) | Trigger to clear                 |
| -------------------- | --------- | -------------------------------- |
| `idle`               | null      | baseline                         |
| `listening`          | null      | caption / audio onEnd            |
| `celebration`        | 600       | matches legacy ear-wiggle window |
| `puzzled-tilt`       | 1500      | matches legacy puzzled hold      |
| `attentive-pointing` | null      | hint TTS onEnd                   |
| `sleepy`             | null      | sticky on Session-End / Hub idle |
| `cheering`           | 1200      | "you did it!" line duration      |
| `waving`             | 1500      | "Bye for now!" line duration     |

Math.tsx and WordSong.tsx have inline literals matching these values; the brief's `POSE_HOLD_MS` import-and-consume task is on the polish backlog.

---

## 5. `EmmaCharacter` shared component

[EmmaCharacter.tsx](MarianLearning/src/components/EmmaCharacter.tsx) owns the canonical motion-brief render shape. Every character-bearing screen (Hub, PromotionCelebration, Math via planned migration) passes a pose, and the spring + tilt + breathing fall out automatically.

**Why a shared component.** Pre-Phase-3b, each screen rendered its own `<m.img>` with drifting animate / transition / initial / exit configs. The motion brief specifies a single shape for the pose-swap choreography; this component owns it.

**Bundle posture.** Uses `m.img` under the global `LazyMotion features={domAnimation}` at the App root. Adds <0.1 KB per the brief's measurement — within the 4.6 KB iPad LazyMotion budget called out in `CLAUDE.md`.

**Excluded from migration:**

- **Greet's slide-in entrance** stays untouched — per the brief's "Implementation order" item 7.
- **Session-End's `emma-cheering.svg`** stays as a one-shot beat, not pose-state-machine driven, per the brief's "Deliberately deferred".

### Props

```ts
interface EmmaCharacterProps {
  pose: EmmaPose
  alt?: string // defaults to "Emma"
  layoutId?: string // pass "emma" on every host screen for shared-element transition
  src?: string // override; defaults to `/assets/emma-${pose}.svg`
  // plus all standard <img> attributes EXCEPT src/alt/draggable/animation handlers
}
```

The component intentionally does NOT extend `MotionProps` — callers can't override `initial` / `animate` / `transition` / `exit` without an explicit code-review escape hatch. The pose-swap choreography is owned here.

### Auto-wired data attributes

- `data-pose` — the current pose string. QA selector for "is the right pose live?".
- `data-wiggling="true"|"false"` — historical marker that WordSong's tests still rely on. True iff a non-idle pose is active and motion is enabled. Renamed semantics (was a 600ms keyframe wiggle, now the spring/keyframe tilt) but the attribute stayed so tests didn't churn.

### Layout-id shared-element transition

Every screen passes `layoutId="emma"`. Framer Motion's layout system carries Emma's bounding box across mount/unmount, so when the route flips Hub → Math, Emma morphs from her 22vh band on Hub to her ~30vh upper-left perch on Math instead of unmounting and remounting. Same primitive carries the swap to `PromotionCelebration` (see §6).

---

## 6. Hub idle-vs-celebration mutual-exclusion gate

Hub's 22vh Emma band is shared between two renders: the **idle EmmaCharacter** and the **PromotionCelebration overlay**. Only one is visible at a time.

### 6.1 Unified `<AnimatePresence>` wrapper (PR #154)

Both renders sit under one `<AnimatePresence mode="wait" initial={false}>` at [Hub.tsx:651–690](MarianLearning/src/screens/Hub/Hub.tsx#L651). `mode="wait"` guarantees only ONE Emma is in the DOM at any moment — old element fully unmounts before the new one mounts. Sequential fade: 250ms exit → 250ms enter on opacity.

This shape replaced the instantaneous mount/unmount swap that landed in PR #140. The mutual-exclusion rule itself is older (PR #140); PR #154 (commit `49ced39`) added the unified animation wrapper.

The gate condition is `celebrationVisible && pendingPromotion !== undefined`. When true: render `PromotionCelebration`. When false: render the idle `EmmaCharacter` wrapped in an `m.div` so AnimatePresence can run its exit animation.

### 6.2 Why count-based selectors stay green

The `mode="wait"` choice keeps two count-based regression assertions green:

- e2e `cvc-words-regression.spec.ts` test 10b — asserts `hub-emma` count is `0` when celebration visible, `1` when not.
- `Hub.test.tsx` mutual-exclusion case — same shape at the unit level.

Both rely on "exactly one Emma in the DOM at any time", which `mode="wait"` enforces by construction.

### 6.3 The 22vh band is `pointer-events-none`

The wrapper `<div>` is `pointer-events-none` so taps anywhere in the 22vh band fall through to whatever sits behind. The Emma image itself opts back in (`pointer-events-auto`) to receive the M2.5 character long-press — only the image bounds are live, not the surrounding band. This is what makes the PromotionCelebration's `absolute inset-0` overlay work without blocking the skill-tree picker beneath it.

---

## 7. `PromotionCelebration` overlay

[PromotionCelebration.tsx](MarianLearning/src/screens/Hub/PromotionCelebration.tsx) is the v1 placeholder for the celebration choreography (ticket 86c9kwnkw, M3 audit follow-up).

### 7.1 Trigger contract

Hub.tsx checks `progress.pendingPromotion` on every mount. When the field is set (M3 mastery rule queued a promotion that the parent has not yet confirmed via Parent Settings), Hub mounts this overlay instead of the normal greeting. Once the celebration dismisses (auto-fade after `durationMs`, default 3500ms), Hub returns to its default render — the field stays set in storage until the parent flips `autoPromote` back to `true` (re-entry applies the queued promotion) OR the session-end re-runs the rule with fresh history.

### 7.2 Composition

- **Promotion-Emma render**: `<EmmaCharacter pose="celebration" layoutId="emma" />`, pinned to the same 22vh band as Hub's idle Emma. The shared `layoutId` carries the bounding box so the swap reads as "she lit up", not "a new screen". Wiggle is the keyframed celebration tilt (§4.3).
- **8-sparkle radial burst**: hand-written inline SVG sparkles at fixed percentage positions around Emma's chest. Each sparkle scales-in on a staggered delay (50ms → 250ms) so the burst reads as energy radiating outward. No third-party particle lib (iPad bundle budget). Coordinates at [PromotionCelebration.tsx:74–83](MarianLearning/src/screens/Hub/PromotionCelebration.tsx#L74).
- **Node-tailored caption**: bordered ribbon matching Hub's existing welcome-back caption surface. Reads "You unlocked **{label}**!" — the node label (e.g. "CVC words") is interpolated from `labelForSkillNode(node)`. Per-node tailored audio is on the follow-up backlog; v1 ships caption-only.

### 7.3 V1 deliberate simplifications

- Generic placeholder caption "You unlocked {label}!" — Kyle's full spec calls for per-node audio binaries which haven't been recorded yet.
- 8 inline-SVG sparkles in fixed radial positions — no particle physics.
- Auto-dismiss after 3500ms; no manual dismiss control. Hub continues to function (skill-tree picker tappable beneath the overlay because the wrapper is `pointer-events-none`).

The contract Kyle iterates against is the prop shape — `node`, `label`, `onDismiss`, `durationMs`. Internal animation is replaceable without rewriting Hub.

---

## 8. Speech-ribbon caption walk

Every Emma utterance is mirrored as on-screen text. The mirror serves two purposes: (1) accessibility — Marian sees what Emma is saying, (2) passive reading exposure — the words appear word-by-word as Emma speaks them, building sight-word recognition.

### 8.1 Word-by-word reveal synced to TTS `boundary` events

The Howler-backed audio path (Path-A in audio-system docs) emits per-word boundary events (timestamps from the SSML rendering pipeline). The caption tick advances `captionRevealed` from 0 → N as boundaries fire.

### 8.2 Synthetic word-paced fallback at WPM

If the audio fails to load (404, decode error, no WebAudio context) or the boundary stream isn't available, the caption walks at a synthetic word-paced rate. **Default: 165 WPM** — derived from the Emma voice rate `-10%` (Azure's `0.9` rate against the multilingual base). See the soft-fail comment at [Hub.tsx:27–28](MarianLearning/src/screens/Hub/Hub.tsx#L27) and the playHubLine fallback at [playHubLine.ts:7](MarianLearning/src/screens/Hub/playHubLine.ts#L7).

### 8.3 Ribbon visual

The caption ribbon sits below Emma in a `min-h-[3.5rem]` flex container. Bordered rounded card with rose shadow:

- Test selectors: `data-testid="hub-ribbon"` (the card) and `data-testid="hub-caption-word"` (each word, with `data-revealed="true|false"`).
- Mounts with `initial={{ opacity: 0, scale: 0.92 }}` → `animate={{ opacity: 1, scale: 1 }}` over 250ms.
- Each word fades in at `duration: 0.1` ease-out as `captionRevealed` increments past its index.

Ref: [Hub.tsx:694–737](MarianLearning/src/screens/Hub/Hub.tsx#L694).

The Greet, Math, WordSong, and Session-End screens use the same word-by-word reveal pattern with screen-specific selectors (`greet-caption-word`, `math-caption-word`, etc.). The pattern is consistent across the app so Marian's reading experience is identical regardless of screen.

---

## 9. Reduce-motion handling

Reduce-motion is honoured app-wide through two layers:

### 9.1 `MotionConfig reducedMotion="user"` at app root

[App.tsx:943](MarianLearning/src/App.tsx#L943) wraps the entire screen tree:

```tsx
<MotionConfig reducedMotion="user">...</MotionConfig>
```

Framer Motion's `reducedMotion="user"` mode collapses springs to short fades and obeys `prefers-reduced-motion: reduce` automatically. This handles the bulk of the motion-budget reduction without per-component branching.

### 9.2 `usePrefersReducedMotion` hook (project's own)

[usePrefersReducedMotion.ts](MarianLearning/src/hooks/usePrefersReducedMotion.ts) is read by `EmmaCharacter` and a handful of screens for the cases where the motion-config collapse is too aggressive (e.g. the breathing scale loop where collapsing to a fade looks wrong; we want it to simply stop scaling).

The project's own hook is preferred over Framer Motion's `useReducedMotion()` because:

1. **Single source of truth** — every screen reads the same primitive.
2. **Test reliability** — the project hook reads `window.matchMedia` per-mount, which picks up vitest's `matchMedia` stub deterministically. Framer Motion's hook reads from a module-init signal that doesn't always pick up the stub.

In `EmmaCharacter`, the hook drives:

- Initial state: `{ opacity: 0 }` instead of `{ opacity: 0, rotate: 0, scale: 1 }`.
- Animate rotate: `0` (no tilt) regardless of pose.
- Animate scale: `1` (no breathing) on idle.
- Transition `rotate.duration: 0` (instant) instead of spring or keyframes.

Opacity cross-fade still plays at 200ms — that's not "motion" in the WCAG-vestibular sense.

When iPad has Reduce Motion on (Settings → Accessibility → Motion), Emma's pose still swaps SVGs (so Marian sees the right face) but the body doesn't tilt, breathe, or wiggle.

---

## 10. "Never a red X" principle

Wrong answers never produce a red X, an error sound, or a downward-pitched body language. The reaction is always:

1. **Pose swap** to `puzzled-tilt` (tilt RIGHT +10°, "hmm" affect).
2. **"Poof" SFX** — soft non-punitive sound; no harshness.
3. **Retry** — the chip stays tappable; Marian tries again.

This is invariant across the app and is the most-load-bearing single design principle. Source: `CLAUDE.md` design-principles section, and the canonical session walkthrough at [design/session-1.md](MarianLearning/design/session-1.md).

The `puzzled-tilt` pose holds for 1500ms (per `POSE_HOLD_MS`), then auto-returns to `idle`. The TILT direction (RIGHT, +10°) is opposite the celebration tilt (LEFT, -6°) so the two affects are unmistakably different from across the iPad — no chance Marian misreads "wrong" as "right".

The puzzled-tilt motion uses a softer spring (`220, 20`) than the house spring; arrives with a hair more lag so it reads "considering" rather than "reacting".

---

## 11. Long-press on Emma → Parent Settings

Emma's body is a hidden parent-gate. A 3-second long-press on Hub Emma opens the parent settings page; tap-and-release does NOT.

[useCharacterLongPress.ts](MarianLearning/src/screens/Hub/useCharacterLongPress.ts) implements the 3000ms timer.

### 11.1 Behaviour

- `onPointerDown` calls `setPointerCapture()` so a small drift keeps the press registered, then starts a 3000ms timer.
- `onPointerUp` / `onPointerCancel` / `onPointerLeave` cancels.
- Timer completion fires `onComplete()` once.

The hook returns the four pointer handlers; Hub spreads them onto `EmmaCharacter`'s `<m.img>` via the rest-prop pass-through.

### 11.2 Why a separate hook from the 2s corner gate

Hub also has a 2-second corner-gate via [useParentGateLongPress.ts](MarianLearning/src/screens/Hub/useParentGateLongPress.ts) — a 96×96pt invisible div in the top-right corner with bounds-check via `getBoundingClientRect`. Two narrow hooks, one purpose each, was cleaner than parameterising one hook over two surfaces. The character-art surface is bigger (no bounds-check needed) and the spec timing is different (3s vs 2s).

### 11.3 Test seams

The hook accepts optional `schedule` / `cancelSchedule` props for unit-test isolation — defaults to `window.setTimeout` / `clearTimeout` in production.

---

## 12. Polish-backlog items (for orientation only)

Not implementation-ready; surfaced here so future sessions don't think the gaps are bugs:

- **PNG-in-SVG → vector re-trace.** Wave 14 Track A — ClickUp `86ca8kq36` (Kyle design spec, PR #433) → `86ca8kq42` (Devon impl). The 8 pose SVGs are **703–933 KB each** (verified 2026-06-14, re-cut 2026-05-14), well under the 8 MiB workbox cap — vector re-trace is true visual-quality polish (crisp scaling, native paths), **not** a cache-pressure fix. See §1 for the size history.
  - **⚠️ Regression trap for the re-trace:** [`scripts/embed-emma-assets.mjs`](MarianLearning/scripts/embed-emma-assets.mjs) is a manual one-shot (NOT in the build pipeline) that **regenerates** every `public/assets/emma-*.svg` (8 poses + emma-logo) as PNG-in-SVG by base64-embedding `design/references/character-emma/transparent/*.png` into a `0 0 2000 2000` wrapper. It is kept in-tree as the reproducible record of how the SVGs were produced. Re-running it after the vector re-trace lands would **silently overwrite the new vector geometry with the old raster embed.** The Track A-impl PR must retire or gate this script (and update its header comment) as part of the re-trace.
  - **Trace tool (verified by Devon's PR #433 review):** the spec's originally-named tools (vtracer / cargo / potrace / inkscape / svgo) are NOT installed in the worktrees. The practical in-session route is **`@neplex/vectorizer`** (npm WASM vtracer-core — no Rust toolchain) + `svgo` cleanup, so **no human-only / Thomas hand-off is needed** for production (only the subjective fidelity sign-off). First-pass color-traces of these anti-aliased manhwa rasters typically land 150–300 KB — treat **300 KB as the realistic gate, <150 KB as aspirational**.
  - **Fidelity must be verified by a rendered OLD-vs-NEW comparison — jsdom/vitest is blind to it (pending PR #435 merge).** The pilot's iteration 1 passed every objective gate (140 KB ≤ target, viewBox/contract intact, vitest) yet **dropped Emma's smile, washed out her facial features, and speckled the hair** — the implementing agent couldn't see it because jsdom doesn't render pixels. The catch was a pixel render: `tools/emma-vectorize/render-compare.mjs` (OLD-vs-NEW at 60vh/26vh/22vh) + `render-head.mjs` (head crop), eyeballed by the sponsor. **Lesson: any visual-fidelity asset swap is gated by a rendered side-by-side at the real on-screen sizes, never by DOM assertions.** The regression concentrates in thin facial linework (mouth/nose/eyes ~1.5-2px) + hair speckle (rooted in the bgclear.ai source cut's semi-transparent hair-tip halo) — worst at the Greet 60vh entrance, near-invisible at the 22-26vh perch. Two pipeline gotchas for the all-7 PR: (1) **SVGO silently strips `preserveAspectRatio` on minify** even when load-bearing — re-add + assert it; (2) **embed-structure guard tests must match the data-URI form** (`/data:image\/png;base64/`), never the bare word `base64`, which the SVG provenance _comments_ contain (a `/base64/` regex matched the comment and shipped a false-green/red test). **Iteration 2 restored the dropped smile + clean hair (objective render-instrument read) but FAILED the sponsor's fidelity gate**: at full size in a real browser the vector trace reads as posterized/flattened — it loses the soft painterly gradients of the raster, a worse look for this art style even though silhouette/pose/palette are faithful. **Strategic lesson: `@neplex`/vtracer flattens soft manhwa shading; vectorising is the wrong tool when painterly softness is load-bearing — a higher-resolution raster source preserves the look better and still gets crisp scaling.** The iter-1 smile-drop root cause was NOT merely thin linework: `@neplex/vectorizer` emits each `<path>`'s geometry in origin-LOCAL coords inside `d`, with the real canvas position in a _sibling_ `transform="translate(tx,ty)"`. The pilot's `pathBBox` read only `d`, so every region test (FACE_BOX / TOP_BAND) computed near (0,0) and silently never matched — the smile's sub-`MIN_AREA` paths went unprotected and were culled. **Any region-based path filtering on tracer output MUST add the translate offset.** The facial-linework lever is **`layerDifference` (~6), NOT `colorPrecision`** (which maxes at 8 bits and was already maxed; the thin soft-rose mouth/nose merge into skin unless a new colour layer emits on a smaller delta). Full param table in `tools/emma-vectorize/README.md`.
  - **Known palette divergence (not a bug): the shipped `emma-idle` skirt is terracotta `#d1805c`, NOT the mauve `--emma-skirt #C8AAB8` bible token (§2.2).** The re-trace faithfully preserves the _shipped_ render (tight `SNAP_RADIUS` + skirt/mouth/blush excluded from bulk palette-snap). Do not "fix" the skirt to mauve — that's a redesign. **RESOLVED (Thomas, 2026-06-14): terracotta `#d1805c` is canonical**; the bible `--emma-skirt` token was updated `#C8AAB8` → `#d1805c` to match the shipped render (see `character-emma.md` §2.2).
- ~~**`attentive-pointing` + `listening` runtime wiring.**~~ **RESOLVED (PR #434, 2026-06-14, Wave 14 Track B, ticket `86ca8kq7r`).** Math.tsx + WordSong.tsx now `setPose('listening')` during the read-aloud/speak beat and `setPose('attentive-pointing')` during the hint beat, each clearing to `idle` on the respective TTS `onEnd`. Clears are **functional-updater-guarded** (`prev === 'listening' ? 'idle' : prev`) so a mid-beat correct/wrong tap that set `celebration`/`puzzled-tilt` is never clobbered, and are unmount/problem-advance guarded against stale `setState`. Pinned by `src/screens/{Math,WordSong}/__tests__/emma-pose-beats.test.tsx`.
- **`POSE_HOLD_MS` import in Math/WordSong.** Currently Math/WordSong inline matching literals. Consolidation tracked separately.
- **Per-node celebration audio.** PromotionCelebration v1 ships caption-only; Kyle's spec calls for per-node MP3s.
- ~~**`emma-th-mouth.svg` source downscale.**~~ **RESOLVED (PR #237, 2026-05-15).** Source replaced with 260 × 260 tight crop (68 KB PNG); SVG now 94 KB, well under the §3b 300 KB target. See §3b "File-size discipline" + the post-resolution worked example for the technique.

---

## Cross-references

- Memory: `project_character_pivot_emma_2026_04_28.md` — the pivot itself, locked decisions.
- Memory: `project_audio_architecture.md` — how Emma's voice gets to the speaker (Howler + Path-A + canon).
- Memory: `feedback_test_timing_vs_real_safari.md` — Reduce-motion testing pitfalls.
- Sibling doc: `audio-system.md` (Agent B) — Howler internals, MP3 decode, gesture-unlock, boundary events.
- Sibling doc: `screens-and-flows.md` (Agent A) — per-screen lifecycle including where each pose is set.
- Sibling doc: `progress-and-persistence.md` (Agent C) — what `pendingPromotion` is and how the M3 mastery rule queues it.
- Source: [character-emma.md](MarianLearning/design/character-emma.md) — full character bible.
- Source: [motion-brief.md](MarianLearning/design/character/motion-brief.md) — implementation brief for the pose tilt + spring + breathing.
- Source: [emmaPose.ts](MarianLearning/src/lib/character/emmaPose.ts) — the runtime types and constants.
- Source: [EmmaCharacter.tsx](MarianLearning/src/components/EmmaCharacter.tsx) — the shared component.
- Source: [PromotionCelebration.tsx](MarianLearning/src/screens/Hub/PromotionCelebration.tsx) — the celebration overlay.
- Source: [Hub.tsx:628–690](MarianLearning/src/screens/Hub/Hub.tsx#L628) — the AnimatePresence mutual-exclusion gate.
- Source: [useCharacterLongPress.ts](MarianLearning/src/screens/Hub/useCharacterLongPress.ts) — the 3-second long-press hook.
