# Background-removal tool evaluation — 2026-05-14

Handoff doc. Self-contained — a fresh session can read this and have the full picture.

## The question

Thomas's Midjourney picture-pack workflow has a mandatory "remove the cream background" step
(step 6 of the canonical 9-step per-image loop). He was using **remove.bg's free web tier**, which
caps output at **500×500** — a 4× downsample from the 1024×1024 MJ source. Goal: find a
cheaper/free alternative that returns background-removed images at **full source resolution**, while
keeping the same drag-drop browser UX (no CLI, single image at a time).

## Method

`/investigate` (3 parallel Sonnet agents) surveyed the landscape, then Thomas empirically tested the
top free candidates on a real asset: `MarianLearning/design/references/character-emma/emma-waving.png`
(1024×1024 RGB MJ output). All three outputs were disk-verified with `file`.

## Result — bgclear.ai wins on every axis

| Tool                  | Resolution                                          | Edge fidelity (fingers) | Cost                          | Verdict                       |
| --------------------- | --------------------------------------------------- | ----------------------- | ----------------------------- | ----------------------------- |
| remove.bg (free tier) | 500×500 ❌ (0.25 MP cap)                            | eroded ❌               | free                          | Last resort — caps resolution |
| remove-bg.io          | 1024×1024 ✅                                        | eroded ❌               | free, no signup, no watermark | Fallback if bgclear.ai down   |
| **bgclear.ai**        | **1024×1024 ✅** (+ free 2048 / 4096 upscale tiers) | **preserved ✅**        | free, no signup, no watermark | **CANONICAL**                 |

### Evidence (all disk-verified 2026-05-14)

- Source: `emma-waving.png` — `PNG 1024×1024, 8-bit RGB`, 537 KB
- remove-bg.io output: `emma-waving-remove-bg-io.png` — `PNG 1024×1024, 8-bit RGBA`, 509 KB. Full res, but fingers eroded.
- bgclear.ai output: `emma-waving-bgclear-ai.png` — `PNG 1024×1024, 8-bit RGBA`, 594 KB. Full res, fingers preserved.

### Key findings

- **Finger erosion is a source-illustration problem, not a tool weakness for remove.bg specifically.**
  remove.bg and remove-bg.io erode fingers/hair-wisps _identically_ where light skin meets the cream
  MJ background — low subject/background contrast. remove.bg's _paid_ HD tier would NOT fix this.
- **bgclear.ai handles the low-contrast edge case better** — it kept all five fingers on the waving
  hand intact where the other two cut into them.
- bgclear.ai UI: leave **Resolution** toggle on **Original** ("Original resolution as uploaded");
  download the **Transparent** background option. HD (2048px) / Super HD (4096px) upscale tiers are
  also free if a larger asset is ever needed.

## Decision

**bgclear.ai (`https://bgclear.ai`) is the canonical step-6 BG-removal tool**, replacing remove.bg.
Same drag-drop browser UX; free; full 1024×1024 resolution; best edge fidelity of the three.

## Already wired in (no action needed by next session)

- **Memory** `feedback_mj_workflow_explicit_removebg.md` step 6 — rewritten: bgclear.ai canonical,
  full 3-tool comparison recorded, UI guidance (Resolution=Original, download Transparent),
  fallback order (bgclear.ai → remove-bg.io → remove.bg).
- **Project doc** `.claude/docs/skill-trees-and-content.md` — Path 2 picture-pack pipeline + the
  §4 drop-shadow gotcha de-hardcoded from "remove.bg"; both now point to the memory file for the
  current canonical tool rather than naming one inline. The stale "500×500 Regular preset" guidance
  was corrected to "keep source PNGs at full 1024×1024".

## Open / not done

- The drop-shadow survival gotcha (`.claude/docs/skill-trees-and-content.md` §4) was only ever
  tested against remove.bg/remove-bg.io. Not re-verified on bgclear.ai — assume it still applies
  (it's an AI-matting property, not tool-specific) until proven otherwise.
- No batch/API path evaluated — bgclear.ai was assessed as a one-image-at-a-time web tool only,
  which matches Thomas's actual workflow.
