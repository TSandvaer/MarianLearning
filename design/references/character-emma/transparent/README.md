# transparent/

Transparent (background-removed) versions of the Emma character images. **These are the source-of-truth assets** — the transparent PNGs here are what get embedded into the `public/assets/emma-*.svg` files the app renders.

The parent `character-emma/` folder holds the **original Midjourney outputs** (with backgrounds), kept as recoverable source so a re-cut can always be redone.

Both the originals and the transparent versions are committed to git.

**Canonical BG-removal tool: bgclear.ai** — full source resolution, best edge fidelity (preserves fingers/hair-wisps where light skin meets the cream MJ background). Fallback order: bgclear.ai → remove-bg.io → remove.bg. See the `feedback_mj_workflow_explicit_removebg` memory + `removebg-tool-evaluation-2026-05-14.md`.

_Contents (as of the 2026-05-14 Emma asset refresh): the 8 family poses (`emma-{idle,celebration,cheering,listening,puzzled-tilt,sleepy,attentive-pointing,waving}.png`, 1024x1024 RGBA, bgclear.ai re-cuts) plus `emma-splash-base.png` (500x500 RGBA, the "Emma Tutor" medallion logo, remove.bg — bgclear.ai mattes away the thin medallion ring). All of these are embedded as base64 into the matching `public/assets/emma-*.svg` wrappers — see `scripts/embed-emma-assets.mjs`._
