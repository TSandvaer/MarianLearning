# emma-vectorize — Emma pose-SVG vector re-trace tooling

One-off tooling to re-trace the Emma pose SVGs from the current **PNG-in-SVG**
technique (a base64 raster embedded in an SVG wrapper, ~720–956 KB each) to
**true vector geometry** (`<path>` linework + fills). Ticket `86ca8kq42`, spec
`design/emma-vector-retrace-spec.md`.

This is **NOT** an app runtime dependency — it has its own `package.json` /
`node_modules` so the tracer libraries never touch the app bundle.

## The turnkey recipe (the pilot deliverable)

The pilot re-traced **`emma-idle`** to prove the recipe. The remaining 7 poses
follow the identical pipeline (same params) in a separate PR.

```bash
cd tools/emma-vectorize
npm install            # @neplex/vectorizer + svgo + sharp (pinned in package-lock.json)
node vectorize-pose.mjs idle   # writes public/assets/emma-idle.svg
```

### Pipeline (in `vectorize-pose.mjs`)

0. **Source alpha-harden** — `sharp` thresholds the source alpha to a hard 0/255
   edge (`ALPHA_CUT 160`), killing the bgclear.ai cut's wispy semi-transparent
   hair-tip fringe at the ROOT before it reaches the tracer (the speckle source).
   RGB untouched — no colour shift.
1. **Input** — trace from `design/references/character-emma/transparent/emma-<pose>.png`
   (1024×1024 RGBA transparent source-of-truth), NOT the upscaled embed.
2. **Auto-trace** — `@neplex/vectorizer` (WASM, in-worktree-runnable) in color
   mode → multi-region vector.
3. **Palette-snap** — snap traced fills to the `character-emma.md` §2.2 bible
   tokens, but ONLY large structural tokens, within a tight radius (see below).
4. **Hair despeckle** — drop small isolated islands that lie ENTIRELY OUTSIDE a
   protected FACE_BOX (canvas-space). The face — smile/nose/eyes/blush — is made
   of several sub-`MIN_AREA` paths and MUST be protected by region, not by size.
5. **Re-wrap** — emit into the `viewBox="0 0 2000 2000"` envelope; the 1024→2000
   scale is baked into path coordinates by SVGO (no `transform` survives — AC7).
6. **SVGO minify** — `floatPrecision 0` on path data is the dominant byte lever.
7. **preserveAspectRatio re-add** — SVGO drops `preserveAspectRatio="xMidYMid
meet"` on minify (it's the SVG default, render-identical), but AC7/AC6.2 name
   it a REQUIRED contract attr; the pipeline re-injects it on the root post-minify.
8. **XML-validate** — caller runs `python -c "...ET.parse(...)"`; the harness
   also guards against `--` inside XML comments.

### The locked params — RECIPE v2 (key findings)

> **v1 FAILED the fidelity gate** (fs16 / LD16): it DROPPED Emma's smile + nose,
> washed her eyes, and speckled the whole crown. Two root causes, both fixed in
> v2: (a) `layerDifference 16` merged the thin facial linework into skin; (b) the
> despeckle computed each path's bbox from `d` alone, ignoring the sibling
> `transform="translate(tx,ty)"` — so EVERY path's bbox read near the origin, the
> FACE_BOX protection never matched, and the smile (sub-`MIN_AREA` paths) was
> despeckled away. `diag-mouth.mjs` found this by dumping per-path canvas bboxes.

| Param                                 | Value                     | Why                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layerDifference`                     | **6**                     | THE face lever (was 16). A new colour layer is emitted on a much smaller delta, so the soft-rose smile/lips + nose strokes + iris detail survive as their OWN regions instead of merging into skin. THIS brings the smile back.  |
| `colorPrecision`                      | **8**                     | VTracer max (8 significant bits). Keeps catchlight / blush / iris as distinct fills. The face fix is layer granularity (LD), not colour-bit headroom — cp was already maxed.                                                     |
| `filterSpeckle`                       | **4**                     | LOW so thin facial strokes survive (16 discarded sub-16px paths, eating the mouth/nose). Hair speckle is handled at the SOURCE (alpha-harden) + the canvas-space despeckle, NOT by a high filterSpeckle that re-breaks the face. |
| SVGO `floatPrecision`                 | **0**                     | THE byte lever. v2's LD6 trace has SHORTER hair curves than v1, so integer 2000-space coords no longer visibly facet at 60vh (verified on Greet + head renders). fp=0 brings the 890-path face-correct trace ~254 KB → ~141 KB.  |
| `hierarchical`                        | **Stacked**               | Cutout fragments the hair more and changes layering; Stacked is cleaner for this flat manhwa art.                                                                                                                                |
| `cornerThreshold` / `spliceThreshold` | 70 / 55                   | Smoother manhwa curves, fewer nodes; small byte effect vs layerDifference.                                                                                                                                                       |
| snap `SNAP_RADIUS`                    | **28**                    | Tight — only genuine AA-drift snaps to a token. A hue jump (terracotta skirt → mauve token) exceeds it, so the **current rendered Emma is preserved**, not "corrected" toward the bible (spec AC1/AC2 — re-trace, not redesign). |
| despeckle `MIN_AREA`                  | **0.0024**                | ~50×50px island floor. Safe to raise now that the despeckle bbox is canvas-correct AND the face is FACE_BOX-protected regardless of area — every removed island is provably OUTSIDE the face. Recovers bytes.                    |
| despeckle `FACE_BOX`                  | 0.30–0.70 W × 0.08–0.30 H | Central region holding eyes/nose/smile/blush. NEVER despeckled, no matter how small the path. Protecting by REGION (not size) is what keeps the smile. Wide enough for all standing front poses.                                 |

### Result (emma-idle)

- **838 KB → ~141 KB** (~83% smaller), under the 150 KB AC4 target.
- 0 `<image>` tags, 0 `data:image` URIs — true vector. 0 `transform` attributes.
  (The lone literal `base64` token is the provenance comment prose, not an embed.)
- viewBox `0 0 2000 2000` + `preserveAspectRatio="xMidYMid meet"` on the root.
- XML valid; no `--` in comments.
- **Face preserved**: smiling, legible eyes/nose/blush, clean (un-speckled) hair
  at Greet 60vh + head-crop (verified via `render-compare.mjs` / `render-head.mjs`).
- Gate test: `src/components/__tests__/emma-idle-vector.test.ts` (AC6.2 contract).

## Helper scripts

- `render-compare.mjs <pose> <old.svg>` — OLD vs NEW side-by-side at 60/26/22vh.
- `render-head.mjs <pose> <old.svg>` — zoomed head crop for face fidelity.
  **These are the EYES of this tool** — jsdom can't see pixels; always eyeball
  the head crop before committing. Pass the OLD svg via `git show
origin/main:public/assets/emma-<pose>.svg > out/emma-<pose>-OLD.svg`.
- `sweep.mjs` / `sweep2.mjs` / `sweep3.mjs` — param-sweep contact sheets used to
  lock the recipe (tuning aids; write to the gitignored `out/`). `sweep3.mjs` is
  the FACE-PRESERVATION sweep that found `layerDifference` is the smile lever
  (`node sweep3.mjs` / `node sweep3.mjs clean` for the alpha-cleaned source).
- `diag-mouth.mjs` — diagnostic that dumps every traced path's CANVAS-space
  bbox, fill, and snap decision in the mouth/face band. This is the instrument
  that found the despeckle bbox bug (paths carry their position in
  `transform="translate()"`, not in `d`). Run `node diag-mouth.mjs` (hardened) or
  `node diag-mouth.mjs raw`.

## Applying to the remaining 7 poses (all-7 PR)

1. `node vectorize-pose.mjs <pose>` for each of: celebration, puzzled-tilt,
   listening, attentive-pointing, cheering, waving, sleepy.
2. **Render-head + render-compare each against its OLD svg and EYEBALL the face**
   — confirm the smile/nose/eyes survive at the head crop AND AC2 fidelity at the
   3 sizes. Do NOT trust jsdom/unit tests for face fidelity; the pixels are the
   gate. Only commit once the head crop reads as the same Emma.
3. Add each pose to `VECTOR_RETRACED` in `scripts/embed-emma-assets.mjs` and
   remove it from `POSES` (so the embed script can't clobber the vector).
4. Per-pose `FACE_BOX` may need a one-line tweak if a pose's head sits unusually
   high or off-centre (e.g. `puzzled-tilt`) — re-measure the eyes/nose/mouth
   x/y band as in the idle comment and widen the box to cover it. The body of
   the recipe (layerDifference 6 / colorPrecision 8 / filterSpeckle 4 /
   floatPrecision 0 / alpha-harden / canvas-space despeckle / preserveAspectRatio
   re-add) holds across poses. The gate test
   `src/components/__tests__/emma-idle-vector.test.ts` should be generalised /
   duplicated per pose (or parametrised over all 8) in the all-7 PR.
