# Emma — character design folder

**Audience:** Devon (motion impl), future asset author (vector trace pass), Jessica (QA), Thomas (taste), Matt (routing).
**Author:** Marian Tutor design persona — Phase 3b dispatch (ticket `86c9kwh66`).
**Status:** Phase 3b _materially_ shipped on `main` 2026-04-29 (commit `861bb0a`, ticket `86c9jccp7`). This folder collects the deliverables that were named in the Phase 3b brief but never landed as discrete documents. Nothing here changes app behaviour — pure design artifacts.

---

## What Phase 3b shipped (already on main, 2026-04-29)

| Surface | Status | Source |
| --- | --- | --- |
| Character bible — proportions, palette, expression deltas, anti-dark-pattern audit | Shipped | [`design/character-emma.md`](../character-emma.md) (PR #98) |
| AI image-generation prompt sheet (Midjourney / DALL-E / SDXL) | Shipped | [`design/character-emma-ai-prompts.md`](../character-emma-ai-prompts.md) (PR #98 + PR #108 — 1792px output cap) |
| Developmental-fit research (Dave) — forbidden + permitted body-language lists | Shipped | [`design/research/character-emma-developmental-fit-86c9hjnq1.md`](../research/) (PR #97) |
| Pose state machine `EmmaPose` + `TILT_BY_POSE` + `POSE_HOLD_MS` | Shipped (module exists; tilt **not yet consumed** — see motion-brief) | [`src/lib/character/emmaPose.ts`](../../src/lib/character/emmaPose.ts) (PR #104) |
| All 8 SVG slots filled at `public/assets/emma-{idle,listening,celebration,puzzled-tilt,attentive-pointing,sleepy,cheering,waving}.svg` | Shipped (as PNG-in-SVG wrappers — see asset-fidelity-followup) | PR #103 (initial 7) + PR #107 (sleepy) |
| `emma-logo.svg` splash wordmark | Shipped | PR #98-era |
| App code migration — `melody-*` → `emma-*` paths, `alt`, `layoutId`, testids, pose-name remap | Shipped | PR #104 (the canonical Phase 3b PR) |
| `melody-*.svg` legacy assets deleted | Shipped | commit `af3b0b9` |

**Net effect on `main` today:** the bunny is gone visually; Emma's face is on every screen. The Phase 3b mismatch (audio says "Emma", visuals show bunny) noted in `CLAUDE.md` is **resolved at the `melody-*.svg` → `emma-*.svg` level**.

> The `CLAUDE.md` line "_until Phase 3b, the character visually remains the bunny_" is **stale** as of 2026-04-29. Recommend Matt routes a one-line CLAUDE.md edit through Thomas to drop that paragraph.

---

## What this folder contains

This folder collects deliverables that the Phase 3b dispatch brief named explicitly but that didn't land alongside the implementation PR. Authoring them now closes the documentation half of the ticket.

| File | Purpose | Audience |
| --- | --- | --- |
| `motion-brief.md` | Devon-targeted brief for pose-to-pose transition choreography. Calls out that `TILT_BY_POSE` is exported but NOT consumed yet. Specifies tilt + spring + secondary motion (blink, breathing, hair-sway) at the level Devon needs to write Framer Motion code. | Devon |
| `expressions/README.md` | Pose catalogue: filename → emotional intent → screen mapping → animation cues. Authoritative cross-reference between the asset slot and the screen consumer. | Devon, Jessica, future asset author |
| `reference-styles.md` | Manhwa/webtoon style citations and what each reference contributes (line weight, palette, eye design, body proportions). | Future asset author (vector trace pass), Thomas |
| `asset-fidelity-followup.md` | The PNG-in-SVG → vector SVG follow-up. The 8 emma SVGs currently ship as 148–220 KB PNG-base64 wrappers; spec §4.1 budget is 8–9 KB per vector SVG. Documents the gap, ships criteria, and proposes a follow-up ticket. | Matt → Thomas → asset pass |

---

## What this folder deliberately does NOT contain

- **Final vector SVG re-traces.** That is `asset-fidelity-followup.md`'s job — it captures the gap; the actual vector trace is a separate ticket. Authoring vector traces in a design folder would invite drift between draft assets and shipping assets.
- **Duplicate character bible.** `character-emma.md` is canonical; duplicating it here would create drift. The motion brief and expression-sheet README cross-reference it.
- **AI prompt re-author.** `character-emma-ai-prompts.md` is canonical; same reason.
- **Hub asset queue.** Ticket `86c9j53yx` covers the 12-13 Hub world-art SVGs (none of which are character art). Out of scope per the dispatch brief.
- **Background re-author.** `bg-*.svg` files don't change with Emma (world palette unchanged).

---

## How to use this folder

**If you are Devon, implementing motion:** read `motion-brief.md`. It tells you what to wire and what to leave alone, with code-shape examples. `expressions/README.md` is your screen-by-screen cheat sheet for which poses fire from where.

**If you are an asset author tasked with a vector re-trace:** read `character-emma.md` first (canonical bible), then `character-emma-ai-prompts.md` (if the trace is happening from an AI render), then `reference-styles.md` (for line weight + palette discipline), then `asset-fidelity-followup.md` (for the file-size budget + SVGO process).

**If you are Jessica QAing Phase 3b acceptance:** the ACs in `character-emma.md` §8 are still authoritative. The "asset existence" + "test-suite" boxes are already green on `main`. The "functional correctness (animation)" boxes — `rotateZ: -6` on celebration, `rotateZ: +10` on puzzled — are **not yet green**; see `motion-brief.md` for what's missing and `asset-fidelity-followup.md` for the file-size box.

**If you are Thomas reviewing this PR:** focus your taste pass on (a) whether the motion brief's tilt + spring choreography lands warmly on iPad and (b) whether you want to authorise the vector re-trace pass now, defer it, or accept the PNG-in-SVG wrappers as the v1 ship state.

---

## Outstanding decisions for Thomas (called out elsewhere too)

1. **Vector re-trace yes/no/defer.** Captured in `asset-fidelity-followup.md`. Not blocking — visuals look fine on iPad Retina at the current sizes; the costs are bundle KB and a small crispness loss at extreme zoom.
2. **Wire the `rotateZ` tilt.** Captured in `motion-brief.md`. Small Devon ticket; recommend yes (the tilt-and-smile carries the "yes that's right" affect that flat cross-fade lacks).
3. **CLAUDE.md staleness.** The "_until Phase 3b, the character visually remains the bunny_" paragraph is no longer true. One-line edit, low risk.

---

## Provenance

- **Dispatch brief:** ticket `86c9kwh66`, dispatched 2026-05-01.
- **Phase 3b implementation PR:** #104 (commit `861bb0a`), merged 2026-04-29.
- **Phase 3b spec PRs (already merged):** #97 (Dave research), #98 (character bible + AI prompts), #103 (initial 7-pose SVG set), #107 (emma-sleepy.svg), #108 (1792px output cap on AI prompts).
- **Locked decision source:** memory file `project_character_pivot_emma_2026_04_28.md`.
