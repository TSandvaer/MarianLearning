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
npm install            # @neplex/vectorizer + svgo (pinned in package-lock.json)
node vectorize-pose.mjs idle   # writes public/assets/emma-idle.svg
```

### Pipeline (in `vectorize-pose.mjs`)

1. **Input** — trace from `design/references/character-emma/transparent/emma-<pose>.png`
   (1024×1024 RGBA transparent source-of-truth), NOT the upscaled embed.
2. **Auto-trace** — `@neplex/vectorizer` (WASM, in-worktree-runnable) in color
   mode → multi-region vector.
3. **Palette-snap** — snap traced fills to the `character-emma.md` §2.2 bible
   tokens, but ONLY large structural tokens, within a tight radius (see below).
4. **Crown despeckle** — drop tiny isolated hair-tip islands strictly above the
   eye band (the bgclear.ai cut leaves wispy semi-transparent crown pixels the
   tracer reproduces as speckle).
5. **Re-wrap** — emit into the load-bearing `viewBox="0 0 2000 2000"
preserveAspectRatio="xMidYMid meet"` envelope; the 1024→2000 scale is baked
   into the path coordinates by SVGO (no `transform` attribute survives — AC7).
6. **SVGO minify** — `floatPrecision: 1` on path data is the dominant byte lever.
7. **XML-validate** — caller runs `python -c "...ET.parse(...)"`; the harness
   also guards against `--` inside XML comments.

### The locked params (key findings)

| Param                                 | Value       | Why                                                                                                                                                                                                                              |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colorPrecision`                      | **8**       | THE fidelity lever. 8 keeps the cream eye-catchlights + cheek blush + iris detail as distinct regions; 6 flattens them.                                                                                                          |
| SVGO `floatPrecision`                 | **1**       | THE byte lever. Crushes ~364 KB raw → ~140 KB without touching colour regions. fp=0 → ~90 KB but risks faceting long hair curves at 60vh; fp=1 is the safe target-hitter.                                                        |
| `filterSpeckle`                       | **16**      | Drops AA fringe speckle; do NOT raise to kill crown speckle — it eats the catchlights instead (they're real source regions). Crown speckle is handled by the despeckle pass, not filterSpeckle.                                  |
| `hierarchical`                        | **Stacked** | Cutout fragments the hair more and changes layering; Stacked is cleaner for this flat manhwa art.                                                                                                                                |
| `cornerThreshold` / `spliceThreshold` | 80 / 60     | Smoother manhwa curves, fewer nodes; small byte effect vs colorPrecision.                                                                                                                                                        |
| snap `SNAP_RADIUS`                    | **28**      | Tight — only genuine AA-drift snaps to a token. A hue jump (terracotta skirt → mauve token) exceeds it, so the **current rendered Emma is preserved**, not "corrected" toward the bible (spec AC1/AC2 — re-trace, not redesign). |
| despeckle `TOP_BAND`                  | **0.085**   | Crown-speckle band is y≈0.028–0.09 of the source; eyes start at y≈0.10. 0.085 keeps the cutoff strictly above the eyes for ALL standing front poses.                                                                             |

### Result (emma-idle)

- **838 KB → ~140 KB** (~83% smaller), under the 150 KB AC4 target.
- 0 `<image>` tags, 0 `base64` tokens — true vector. 0 `transform` attributes.
- viewBox `0 0 2000 2000` + `preserveAspectRatio="xMidYMid meet"` preserved.
- XML valid; no `--` in comments.

## Helper scripts

- `render-compare.mjs <pose> <old.svg>` — OLD vs NEW side-by-side at 60/26/22vh.
- `render-head.mjs <pose> <old.svg>` — zoomed head crop for face fidelity.
- `sweep.mjs` / `sweep2.mjs` — the param-sweep contact sheets used to lock the
  recipe (tuning aids; write to the gitignored `out/`).

## Applying to the remaining 7 poses (all-7 PR)

1. `node vectorize-pose.mjs <pose>` for each of: celebration, puzzled-tilt,
   listening, attentive-pointing, cheering, waving, sleepy.
2. Render-compare each against its OLD svg; confirm AC2 fidelity at the 3 sizes.
3. Add each pose to `VECTOR_RETRACED` in `scripts/embed-emma-assets.mjs` and
   remove it from `POSES` (so the embed script can't clobber the vector).
4. Per-pose `TOP_BAND` may need a one-line tweak if a pose's head sits unusually
   high — re-measure the hair-top / eye-band y as in the idle comment. The body
   of the recipe (colorPrecision 8 / floatPrecision 1 / filterSpeckle 16) holds.
