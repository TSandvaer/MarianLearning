# Emma Pose-SVG Vector Re-trace — Design Spec

> **Track A, step 1 of 2 (Wave 14).** Design deliverable only. This spec resolves every open
> question so Devon (Track A-impl) can execute the re-trace with zero further design decisions.
> No production code, no SVG conversion happens here.
>
> Ticket: `86ca8kq36`. Reviewer: Devon (consumes this spec).

## Goal

Convert the eight Emma pose SVGs from the current PNG-in-SVG technique (a base64-embedded raster
upscaled into an SVG wrapper) to **true vector geometry** (`<path>` / `<g>` linework + fills),
so Emma renders crisp at every on-screen size and Reduce-Motion screen size, with no further
design decisions required of the implementer.

## Why this is happening (scope framing — read first)

**This is a quality-polish task, not a cache-pressure fix.** The current pose SVGs are
**719–956 KB each** (verified live, 2026-06-14 — see Evidence below), comfortably under the
8 MiB workbox cache cap at `vite.config.ts:112`. The old "2.5–3.3 MB each" figure that drove
the historical 4 MiB → 8 MiB cap lifts (ticket `86c9qa7uh`) predates the 2026-05-14 bgclear.ai
re-cut, which already shrank the family. The `.claude/docs/emma-character-and-animation.md`
§1/§12 size figures were corrected this session to reflect the live state.

So the win we are buying is **rendering fidelity**, not bytes:

- A 1024×1024 raster upscaled into a `2000×2000` viewBox and then displayed at ~60vh on a
  Retina iPad is being scaled up past its native pixel density — soft edges on Emma's
  1.5–2 px manhwa linework (the bible's stroke spec, `character-emma.md` §2.1).
- True vector geometry is resolution-independent: crisp at 60vh (Greet), 26vh (Math/WordSong),
  22vh (Hub), and at any future size, with a smaller-or-comparable byte footprint as a bonus.

If a reviewer or implementer is tempted to optimise for file size, **stop** — fidelity is the
acceptance dimension (AC2), size is only a guardrail (AC4).

## Verified evidence (live code, 2026-06-14, kyle-wt @ origin/main)

Quoted from tool output in this session, not from memory:

| File                                        | Live size | viewBox         | `<image>` geometry                           |
| ------------------------------------------- | --------- | --------------- | -------------------------------------------- |
| `public/assets/emma-idle.svg`               | 838,766 B | `0 0 2000 2000` | `width="2000" height="2000"` (x/y = 0)       |
| `public/assets/emma-celebration.svg`        | 786,271 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-puzzled-tilt.svg`       | 879,678 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-listening.svg`          | 882,057 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-attentive-pointing.svg` | 719,456 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-cheering.svg`           | 955,702 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-waving.svg`             | 811,688 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-sleepy.svg`             | 784,948 B | `0 0 2000 2000` | same                                         |
| `public/assets/emma-logo.svg`               | 436,943 B | `0 0 256 336`   | mixed: `<image>` medallion + vector wordmark |
| `public/assets/emma-th-mouth.svg`           | 96,221 B  | `0 0 200 200`   | tight-crop vector overlay (resolved PR #237) |

Each pose SVG is structurally: one XML comment + one `<svg viewBox="0 0 2000 2000"
preserveAspectRatio="xMidYMid meet">` wrapping exactly **one** `<image href="data:image/png;base64,…"
width="2000" height="2000"/>`. (A naive grep counts two `<image>` because the comment body contains
the literal word `<image>` — the real element count is one.)

Embed source-of-truth: `design/references/character-emma/transparent/emma-*.png`, 1024×1024 RGBA
transparent, bgclear.ai re-cuts (2026-05-14). Raw MJ originals (with backgrounds) at
`design/references/character-emma/*.png`. Both tiers git-tracked. The current embed is produced by
`scripts/embed-emma-assets.mjs` (run manually, not in the build pipeline).

The authoritative character reference for fidelity judgements is the character bible
`design/character-emma.md` (§2.1 linework, §2.2 palette, §2.3–§2.5 per-pose anatomy, §6.1 Dave's
forbidden-body-language list).

---

## AC1 — Re-trace existing poses, or fresh trace from scratch?

**Ruling: RE-TRACE the existing eight poses. Do NOT start a fresh trace from scratch.**

Justification:

1. **The current poses are already design-locked and Dave-validated.** The 2026-05-14 re-cut
   poses match the character bible's per-pose anatomy (`character-emma.md` §2.4) and passed Dave's
   §6.1 forbidden-body-language audit (PR #97, ticket `86c9hjnq1`). A fresh trace re-opens
   pose composition, gaze direction, hand position, and brow state — all settled decisions —
   and would require a fresh Dave audit. Out of scope per the ticket ("no new poses").
2. **The runtime contract is a drop-in swap.** `EmmaCharacter` resolves
   `src="/assets/emma-${pose}.svg"` and swaps on `key={pose}`. Any file at the same path with
   the same viewBox just works (AC7). Re-tracing the existing silhouette preserves the bounding
   box that the `layoutId="emma"` shared-element transition and the feet-pivot tilt depend on.
3. **Lower risk, lower review cost.** A re-trace is verifiable against a known-good reference
   image (the current rendered SVG). A fresh trace has no ground truth to diff against and would
   need subjective sign-off from Thomas on eight new drawings.

"Re-trace" here means: produce vector geometry whose rendered output reproduces the existing
pose — same silhouette, same gaze, same hands, same brow/mouth state, same palette — as faithfully
as the fidelity bar in AC2 requires.

---

## AC2 — Fidelity bar (explicit pass/fail criterion)

**Ruling: pixel-faithful to the current rendered Emma at the SILHOUETTE / POSE / PALETTE level;
linework MAY be cleaned where the raster trace produced obvious artefacts, but MAY NOT redesign.**

This is the criterion a reviewer applies. A re-traced pose **PASSES** when ALL of the following hold,
judged at a side-by-side render against the current SVG (verification method in AC6):

- **PASS — Silhouette match.** The outer outline of head, hair, body, limbs, wand, and any held
  prop occupies the same region of the `2000×2000` viewBox as the current asset, to within a
  visual tolerance of roughly ±2% of figure height. No part of Emma may shift band/perch position.
- **PASS — Pose identity.** Same gaze direction, same head-tilt baseline (the file's own static
  framing — the animated rotateZ is added at runtime, not baked in, see AC7), same hand position
  and gesture, same brow state and mouth shape per `character-emma.md` §2.4. For example:
  `emma-puzzled-tilt` keeps both brows raised (not one-up-asymmetric), mouth a small "oh", right
  hand to chin, eyes tracking down-right toward the problem — per §2.4 row 4.
- **PASS — Palette match.** Fills use the bible's `--emma-*` tokens (`character-emma.md` §2.2):
  skin `#F5DCC9`, hair `#5C3F31`, cardigan `#F0CDB8`, skirt `#C8AAB8`, blouse `#FFF6EE`,
  eye iris `#3E2818` (warm dark brown, never black), mouth `#C77A7A` (soft rose, never bright red),
  blush `#F4A8A8` (celebration only). Sampled fill colours must match the bible to within a
  just-noticeable-difference (≈ ΔE < 5); the re-trace must NOT introduce saturated primaries.
- **PASS — Linework character.** Clean digital lineart at 1.5–2 px effective stroke at iPad
  render (§2.1). The trace MAY straighten/smooth jagged raster-edge stair-stepping and close
  small gaps — that is the _point_ of the re-trace. It MAY NOT add or remove anatomical features,
  re-style the face, or change proportions.
- **PASS — No forbidden state introduced.** The re-trace must not nudge any pose into a
  `character-emma.md` §6.1 forbidden body-language state (folded arms, downward-tilt-with-upward-gaze,
  pursed lips, hands on hips, raised-brow-with-downward-tilt composite, pointing at the viewer, etc.).

A re-traced pose **FAILS** if any of: silhouette drifts > ±2% figure height; gaze/hand/brow/mouth
state changes the pose's read; a fill colour visibly departs from the bible token; the face is
re-stylised (e.g. eyes enlarged toward anime, nose gains nostrils, black iris); or a §6.1
forbidden state is introduced.

**Tie-breaker for reviewers:** when uncertain whether a cleanup is "allowed polish" or "disallowed
redesign," the test is _intent legibility_ — would Marian read the same emotion at a glance from
across the iPad? If yes, and the change is confined to smoothing linework, it is allowed. If the
change alters _which emotion_ or _where Emma looks_, it is a redesign and fails.

---

## AC3 — Exact file set in the re-trace

**IN the re-trace set (the eight pose SVGs):**

1. `public/assets/emma-idle.svg`
2. `public/assets/emma-celebration.svg`
3. `public/assets/emma-puzzled-tilt.svg`
4. `public/assets/emma-listening.svg`
5. `public/assets/emma-attentive-pointing.svg`
6. `public/assets/emma-cheering.svg`
7. `public/assets/emma-waving.svg`
8. `public/assets/emma-sleepy.svg`

These are exactly the `EmmaPose`-keyed, full-portrait, `2000×2000`-viewBox family resolved by
`EmmaCharacter`.

**OUT — `emma-logo.svg` is OUT of this re-trace.** Rationale (three independent reasons, any one
sufficient):

- It is **not a standing pose** — it is a circular framed-medallion portrait at a different
  viewBox (`0 0 256 336`), a different artistic problem from the eight standing full-body poses.
- It is **already partly vector** — the lower band ("Emma Tutor" wordmark `<text>` + heart `<path>`)
  is native SVG; only the upper-band medallion is an embedded `<image>`. A medallion-only re-trace
  is a separate, smaller task with its own composition constraints (the thin medallion ring that
  bgclear.ai mattes away).
- It is **not pose-driven** — consumed only by `Splash.tsx` via direct path, never through
  `EmmaCharacter`. It does not benefit from the pose-family consistency this re-trace buys.

  If a future ticket wants the medallion vectorised, file it separately; it is not blocked by, and
  does not block, this work.

**OUT — `emma-th-mouth.svg` is confirmed OUT.** It is already a tight-crop vector overlay
(`0 0 200 200`, 96 KB, an `<image>` crop with vector tooth/tongue overlay paths), resolved in
PR #237. It is not a pose and not part of this family. No action.

**Net: 8 files in, 2 explicitly out.** No other `emma-*.svg` exists.

---

## AC4 — Per-file size budget for the true-vector output

**Ruling: target < 150 KB per re-traced pose SVG. Hard ceiling 300 KB. Reject anything ≥ 300 KB
without a written justification approved by Thomas.**

Rationale:

- **The target is a quality signal, not just a cap.** A well-traced manhwa figure — clean linework,
  flat/one-stop-shadow fills (the bible specifies one-stop shadows, no gradient stacks, §2.2) —
  is naturally compact as vector geometry: a few hundred `<path>` nodes, not tens of thousands.
  A file that balloons past 150 KB is a symptom that the tracer dumped raster noise into thousands
  of micro-paths (an auto-tracer failure mode) rather than producing clean curves — which would
  _also_ fail the AC2 linework bar. So the size budget and the fidelity bar reinforce each other.
- **Reference points:** current PNG-in-SVG poses are 719–956 KB; picture-pack vector SVGs are
  50–250 KB; `emma-th-mouth.svg` (vector overlay) is 96 KB. A clean full-figure vector trace
  should land in the picture-pack range. < 150 KB is ~5–6× smaller than today and well within reach.
- **Headroom against the cap:** 8 MiB workbox cap (`vite.config.ts:112`). Even at the 300 KB
  ceiling, all eight poses total ~2.4 MB — a third of the cap, with the rest of the precache
  budget (Greet MP3s, picture packs, JS/CSS) intact. **Do NOT lower the cap** (out of scope), and
  do NOT touch `vite.config.ts` at all for this work — the assets shrink, so no cap change is needed.

Per-file, not aggregate: each of the eight must independently be < 150 KB (or, with justification,
< 300 KB).

---

## AC5 — Production method + named tool

**Ruling: auto-trace with a vector tracer, then hand-clean in a vector editor. Named primary tool:
`vtracer` (color-mode tracer) for the auto-trace pass; cleanup in Inkscape (free) or Illustrator.
`potrace` is acceptable only for the linework/silhouette pass (it is binary/monochrome).**

The recommended pipeline, step by step, so Devon needs no further decisions:

1. **Input.** Trace from `design/references/character-emma/transparent/emma-<pose>.png` (the
   1024×1024 RGBA transparent source-of-truth), NOT from the upscaled `2000×2000` embed — tracing
   the upscaled raster only re-encodes upscaling artefacts. Trace the highest-fidelity source.
2. **Auto-trace.** Run `vtracer` in color mode to produce a first-pass multi-region vector. Tune
   the colour-precision / filter-speckle / corner-threshold settings so flat fills collapse to
   single regions (one region per palette token) rather than gradient-stepped bands. `vtracer`
   is CLI / open-source / API-accessible — a dispatched implementer can run it directly.
3. **Snap fills to the bible palette.** After the auto-trace, replace the tracer's sampled hex
   values with the exact `--emma-*` tokens from `character-emma.md` §2.2. Auto-tracers sample the
   raster's anti-aliased average, which drifts a few ΔE off the canonical token; snapping to the
   token is what makes the AC2 palette check pass cleanly.
4. **Hand-clean linework.** In Inkscape/Illustrator: simplify over-noded paths, close small gaps,
   ensure the 1.5–2 px stroke character reads, remove stray speckle paths. This is where the AC2
   "allowed cleanup vs disallowed redesign" line is held — smooth, do not restyle.
5. **Re-assemble into the wrapper.** Emit the geometry into the SAME wrapper shape the current
   files use: an XML comment header (update provenance to "vector re-trace, <date>") + a single
   `<svg viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">` containing the `<g>`/`<path>`
   geometry, scaled/positioned so the figure occupies the same region as the current `<image>`
   (AC7). Run SVGO (or equivalent) to drop editor cruft (Inkscape namespaces, metadata) and
   minify — that is most of how the file lands under the AC4 budget.
6. **Validate XML.** Per `emma-character-and-animation.md` §3b "Step 0", parse every output file
   with `xmllint --noout` or `python -c "import xml.etree.ElementTree as ET; ET.parse(...)"`
   BEFORE any visual check, and ensure no `--` (double-hyphen) sequence appears inside the XML
   comment (use `—` U+2014 for em-dashes). A malformed SVG renders as a parser-error page and
   makes every downstream visual check vacuously meaningless.

**Update `scripts/embed-emma-assets.mjs`.** That script currently regenerates the PNG-in-SVG
embeds from `transparent/*.png`. Once the poses are vector, re-running it would _overwrite_ the
re-traced geometry with fresh PNG embeds — a silent regression. Devon must, in the same PR, either
(a) retire the 8-pose block from the script and leave it covering only the logo medallion, or
(b) gate the pose block behind a flag, with a header comment stating the poses are now hand-authored
vector and must not be re-embedded. This is the one same-PR code touch the re-trace requires; it is
in scope for Track A-impl, not this design spec.

**Thomas hand-off flag.** The whole pipeline above is API/CLI-accessible — **no human-only tool is
required**, so unlike the bgclear.ai precedent (`emma-character-and-animation.md` §3a — a web-only
service with no API, which must be routed to Thomas for a manual drag-drop), the auto-trace +
cleanup steps can run inside a dispatched implementer session. **The ONE place Thomas is needed is
the subjective fidelity sign-off** (AC6): the final "does this read as the same Emma at a glance on
a real iPad" judgement is a taste call, and per the project's gating model that is Thomas's via
Matt. Devon produces the side-by-side evidence; Thomas confirms. Flag this in the PR.

> If Devon's environment cannot run `vtracer`/Inkscape headless and no API tracer is available, the
> fallback is a manual trace in a vector editor by a human — which becomes a Thomas (or designer)
> hand-off the same way bgclear.ai is. Note that contingency in the PR if it arises; the default
> assumption is the CLI pipeline runs.

---

## AC6 — Verification method (how Devon / Jessica / Thomas confirm a re-trace matches)

A re-traced pose is verified in this order (cheapest, most objective first):

1. **XML validity (objective, automatable — Jessica/CI).** `xmllint --noout
public/assets/emma-<pose>.svg` returns OK for all eight; no `--` inside any comment. This is a
   hard gate and can live in the canon/asset-lint step. Per `emma-character-and-animation.md` §3b
   Step 0.
2. **viewBox + framing contract (objective — Jessica/CI).** Assert each output keeps
   `viewBox="0 0 2000 2000"` and `preserveAspectRatio="xMidYMid meet"`, and that
   `EmmaCharacter`'s existing `data-pose` / `data-wiggling` selectors still resolve (the swap is
   `src`-only, so existing e2e/unit Emma tests must stay green unchanged — see AC7).
3. **Size budget (objective — Jessica/CI).** Each file < 150 KB (warn) / < 300 KB (fail). A
   simple file-size assertion.
4. **Side-by-side visual diff (subjective — Devon authors evidence, Thomas signs off).** Render
   the current asset and the re-traced asset at each real on-screen size and compare:
   - **idle ≈ 60vh** (Greet entrance scale).
   - **Math / WordSong ≈ 26vh** (upper-left perch). (Note: `emma-character-and-animation.md` §3a
     says ~30vh; treat 26vh as the current Math/WordSong band and render at both if unsure — the
     point is "small perch size," exact vh is not the fidelity variable.)
   - **Hub ≈ 22vh** (centred-upper band).
     Devon captures a side-by-side screenshot per pose at these sizes and writes, in plain language
     (per the `emma-character-and-animation.md` §3b "name the body parts" discipline), what is visible
     and that silhouette/gaze/hands/brow/mouth/palette match per AC2. A bare "looks the same" is NOT
     evidence.
5. **Palette spot-check (objective-ish — Devon).** Sample at least three fills per pose (skin, hair,
   one garment) and report the hex; confirm each matches the bible `--emma-*` token to ΔE < 5.
6. **Reduce-Motion path (objective — Jessica).** With `prefers-reduced-motion: reduce`, Emma must
   still swap to the correct SVG (the body just stops tilting/breathing). Re-trace changes only the
   art, not the motion code, so existing reduce-motion tests cover this — confirm they stay green.

**Vercel CDN cache lag caveat (carry into the PR).** Per `emma-character-and-animation.md` §3b:
for base64/large SVG assets Vercel's CDN can serve the prior commit's content for 5–15 min after
"deploy ready." Wait ≥ 15 min before fetching the preview, hard-reload (Cmd/Ctrl+Shift+R), or
cross-check a known-changed value. The re-traced files no longer carry a giant base64 blob, so the
lag risk is lower — but the discipline still applies.

**Orchestrator/Thomas fallback.** If no implementer session can produce the AC6.4 plain-language
visual evidence to the bar, escalate to Thomas for a human eyeball before merge. Do not merge on
an unqualified "looks correct."

---

## AC7 — Preserved contract (MUST hold unchanged)

The re-trace is a **drop-in art swap**. The following are load-bearing and MUST be preserved exactly,
or Emma's runtime motion breaks:

- **viewBox `0 0 2000 2000` on every pose SVG.** `EmmaCharacter` renders the SVG inside an
  `<m.img>` and the host screens size that `<img>` by CSS. The `2000×2000` square viewBox plus
  `preserveAspectRatio="xMidYMid meet"` is what centres the figure and puts her feet near the
  bottom of the box. Change the viewBox and the figure's position/scale shifts under every
  consumer.
- **`transform-origin: 50% 100%` (feet pivot) must keep working.** This is set in code on the
  `<m.img>` (`EmmaCharacter.tsx` `style={{ transformOrigin: '50% 100%' }}`), NOT in the SVG — so
  the re-trace does not edit it directly. BUT the re-trace must keep the figure framed so her feet
  sit at the BOTTOM of the `2000×2000` box (as the current assets do), because the feet-pivot tilt
  (`rotateZ`) and breathing (`scale`) animations rise from `50% 100%` of the element box. If the
  re-trace re-centres the figure higher or adds vertical padding below the feet, the pivot point
  detaches from her actual feet and the tilt/breathing read wrong. **Keep the figure's vertical
  placement within the box identical to the current asset.**
- **No baked-in rotation or scale transform on the root `<svg>` or top `<g>`.** The tilt/breathing
  are applied at runtime by Framer Motion on the wrapping element. The SVG art itself must be in
  the neutral (untilted, unscaled) rest pose — the same as the current files. A static rotation
  baked into the geometry would compound with the runtime `rotateZ` and double-tilt Emma.
- **Same filename + same public path.** `EmmaCharacter` hard-resolves `/assets/emma-${pose}.svg`.
  Keep all eight filenames and the `public/assets/` location exactly.
- **`data-pose` / `data-wiggling` selectors untouched.** These live on the `<m.img>` in
  `EmmaCharacter`, driven by the `pose` prop, not by the SVG. The re-trace must not require any
  change to `EmmaCharacter.tsx` or `emmaPose.ts`; if it does, the re-trace has drifted out of scope.

Net: the only things that change on disk are the _contents_ of the eight `<svg>` bodies
(`<image>` → vector `<g>`/`<path>`) and their header comments. Wrapper viewBox, framing, filenames,
paths, and all runtime motion code are invariant.

---

## Out of scope (restated from ticket)

- Any actual SVG conversion / production code (that is Track A-impl / Devon, step 2).
- `emma-th-mouth.svg` (already vector, PR #237).
- `emma-logo.svg` medallion vectorisation (separate future ticket if wanted).
- Track B motion wiring (`attentive-pointing` / `listening` runtime consumption, `POSE_HOLD_MS`
  import, etc.).
- Lowering the workbox cache cap, or any `vite.config.ts` edit.
- New poses, new curriculum, new expressions.

## Open questions (for Thomas, via Matt)

1. **Fidelity sign-off owner + medium.** AC6.4 is a subjective "same Emma at a glance" call. This
   spec assigns it to Thomas (per the project gating model). Confirm Thomas wants to eyeball the
   side-by-side himself on a real iPad, vs. delegating the first pass to a design-review persona
   with Thomas only on a final spot-check. (Recommended: Devon authors evidence → design-review
   first pass → Thomas final spot-check on 2–3 poses, not all 8.)
2. **All-eight-at-once vs. pilot-one-first.** Recommended: re-trace **`emma-idle` first as a
   pilot**, get the AC2/AC6 bar confirmed on the single most-visible pose (Hub idle + breathing),
   THEN batch the remaining seven against the proven settings. This de-risks the `vtracer` tuning
   before it is applied eight times. Confirm Thomas/Matt want the pilot-first sequencing or a
   single all-eight PR.

These two are sequencing/sign-off calls, not blockers to Devon starting the AC5 pipeline — they
shape _how the work is reviewed_, not _what the work is_.
