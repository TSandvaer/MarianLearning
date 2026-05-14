# transparent/

Transparent (background-removed) versions of the Emma character images. **These are the source-of-truth assets** — the transparent PNGs here are what get embedded into the `public/assets/emma-*.svg` files the app renders.

The parent `character-emma/` folder holds the **original Midjourney outputs** (with backgrounds), kept as recoverable source so a re-cut can always be redone.

Both the originals and the transparent versions are committed to git.

**Canonical BG-removal tool: bgclear.ai** — full source resolution, best edge fidelity (preserves fingers/hair-wisps where light skin meets the cream MJ background). Fallback order: bgclear.ai → remove-bg.io → remove.bg. See the `feedback_mj_workflow_explicit_removebg` memory + `removebg-tool-evaluation-2026-05-14.md`.

_Folder is currently empty pending the deliberate Emma-family re-cut — tracked as a polish-backlog item. The emma-splash-base asset (PR #218) is the first transparent Emma asset; the 8 existing poses still need re-cutting._
