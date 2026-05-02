# Asset fidelity follow-up — Emma SVG vector re-trace

**Audience:** Matt (routing), Thomas (decision), future asset author.
**Author:** Marian Tutor design persona — Phase 3b dispatch (ticket `86c9kwh66`).
**Status:** Decision document. Calls out a real divergence between `character-emma.md` §4.1 spec and what shipped in `public/assets/`. Not blocking — visuals are live and Thomas-approved. This is a quality-bar follow-up under "polished, responsive, immersive".

---

## The gap

`character-emma.md` §4.1 specifies SVG-vector character art at **8-9 KB per pose**, single `<svg>` root with single viewBox, no embedded raster, gradient discipline limited to the optional hair-highlight band. This aligned with `project_pic_dog_svg.md` (SVG-only locked for character/picture art) and the existing `pic-dog.svg` precedent (4.4 KB clean vector).

What actually shipped in PR #103 and PR #107:

| File | Spec budget | Actual size | Format |
| --- | --- | --- | --- |
| `emma-idle.svg` | 8 KB | **204 KB** | PNG-in-SVG wrapper (`<svg><image href="data:image/png;base64,...">`) |
| `emma-listening.svg` | 8 KB | **205 KB** | PNG-in-SVG wrapper |
| `emma-celebration.svg` | 9 KB | **171 KB** | PNG-in-SVG wrapper |
| `emma-puzzled-tilt.svg` | 9 KB | **201 KB** | PNG-in-SVG wrapper |
| `emma-attentive-pointing.svg` | 9 KB | **149 KB** | PNG-in-SVG wrapper |
| `emma-sleepy.svg` | 8 KB | **182 KB** | PNG-in-SVG wrapper |
| `emma-cheering.svg` | 9 KB | **221 KB** | PNG-in-SVG wrapper |
| `emma-waving.svg` | 8 KB | **186 KB** | PNG-in-SVG wrapper |
| **Total mandatory (6 poses)** | ~51 KB | **~1112 KB** | |
| **Total full set (8 poses)** | ~68 KB | **~1519 KB** | |

**Order of magnitude over budget:** ~22× the spec for the mandatory 6, ~22× for the full 8. This was a deliberate v1 trade-off (per commit `d736b40` "asset(character): replace emma-idle vector trace with PNG-in-SVG wrapper for visual consistency"); not a bug, but a debt.

---

## Why it shipped this way

From the commit history:

- PR #103 (`asset(character): Emma 7-pose SVG set with PNG-in-SVG fallback for Phase 3b`) — Emma was AI-generated as PNG by Thomas per the AI-prompt sheet (`character-emma-ai-prompts.md`). Vector tracing that AI output into a clean SVG would have been a separate ~40-hour pass with hand-cleanup; PNG-in-SVG ships immediately.
- Commit `b9c0672` (`asset(character): use remove.bg-stripped sources for emma-idle and emma-attentive-pointing`) — the PNG sources had backgrounds removed via `remove.bg`.
- Commit `d736b40` (`asset(character): replace emma-idle vector trace with PNG-in-SVG wrapper for visual consistency`) — the implication: an initial vector-trace attempt produced poses that didn't read consistently as the same character; PNG-in-SVG was chosen for face-consistency.

This is a defensible v1 choice. The face is what carries Emma's identity; an inconsistent vector trace would have shipped a "different person across poses" problem, which is worse than a bundle-size problem.

---

## What this costs today

**Bundle / network:**
- Total Emma asset payload: ~1.5 MB across 8 poses.
- Service-worker pre-cache: hits all 8 on first install. On a slow connection (3G/spotty home wifi), the install moment can stretch 5-10 seconds vs. the ~50 ms a vector-SVG set would take.
- iPad cache: not a concern post-install. The PWA caches once, serves from disk.

**Visual quality:**
- iPad Retina render at the actual on-screen sizes (22vh Hub, 26vh Math/Word Song, 40vh Session-End): **PNG-in-SVG renders crisp.** No visible pixelation at intended sizes.
- iPad Retina at zoom (the user pinch-to-zooms or screenshots): vector would be infinitely sharp; PNG-in-SVG hits its raster resolution limit. Not a likely user gesture in this app, but a quality-bar note.

**Maintenance:**
- Cannot tweak palette per `--emma-*` token without re-rendering the source. Today the `--emma-*` HEX values exist in the spec but are not actually consumed by the assets (the assets contain baked-in PNG colour). Future palette changes require a re-generation pass, not a CSS edit.
- Cannot per-token shadow / line-weight cleanup. Whatever the AI generator output is, that's what ships.
- Style consistency across poses depends entirely on the original AI generation pass. If a future pose is added (e.g., a "thinking" or "reading" pose for v2), regenerating it via the same AI-prompt sheet and getting it to match the existing 8 is an open risk per `character-emma-ai-prompts.md` §6.2.

---

## What a vector re-trace gets us

| Dimension | Today (PNG-in-SVG) | After vector re-trace |
| --- | --- | --- |
| Bundle size | ~1.5 MB | ~50–70 KB (~22× smaller) |
| iPad Retina at on-screen sizes | Crisp | Crisp |
| iPad Retina at zoom | Slight pixelation at extreme zoom | Infinitely sharp |
| Palette tweaks via `--emma-*` tokens | Requires re-generation | Pure CSS edit |
| Style consistency across future added poses | High risk (AI re-generation drift) | Low risk (vector authoring works from same primitives) |
| Maintenance friction | Generation tool + remove.bg + commit | Vector-tool edit + SVGO + commit |

The big wins are bundle size (network cost on first install) and maintainability. The visual-quality win is small at on-screen sizes, real at zoom.

---

## Recommendations

### Recommendation 1 — defer the re-trace, accept v1 ship state.

The PNG-in-SVG assets are Thomas-approved and visually live on `main`. Marian doesn't see bundle size; she sees Emma's face. The "polished, responsive, immersive" quality bar is met at the face level even without a vector re-trace. Bundle-size is a real cost but not visible to Marian.

**Recommend this for v1.** Ship Phase 3b as-is. Open a v2 ticket for vector re-trace timed with the "Marian uses the app daily and we're optimising for her experience" follow-up phase.

### Recommendation 2 — author the re-trace as a single follow-up ticket.

If Thomas wants the bundle / palette / maintainability wins now, the work is:

1. Pick a vector-tracing approach. Three options:
   - **Adobe Illustrator / Affinity Designer** "image trace" feature on the PNG sources, then hand-cleanup. ~30-40 hours per pose for a clean result. ~$1500-3000 commissioned, or 1-2 weeks for the project's existing asset author.
   - **Hand-author from scratch** working from `character-emma.md` §2.4-§2.5 + the existing PNGs as visual reference. ~10-15 hours per pose for a senior vector illustrator. Higher consistency than image-trace.
   - **Commission a manhwa-styled illustrator** to vector-author the 8 poses against the bible and AI prompt sheet. $500-2000 budget per `character-emma-ai-prompts.md` §6.2 escalation path. Natural pose-consistency from a single illustrator's hand.
2. Author the 8 poses against the existing PNG references. Match the face (priority 1), the outfit, the wand-pointer, the bow.
3. Run each through SVGO with the codebase's default config. Validate against the 8-9 KB per-pose budget.
4. Drop in over the existing `public/assets/emma-*.svg` filenames. Drop-in-compatible with current app wiring (no `.tsx` changes — see Phase 3b PR #104).
5. QA: run on iPad PWA, verify each pose renders correctly at 22vh / 26vh / 40vh sizes; verify reduce-motion still works; verify `layoutId="emma"` morph still works between screens.

**Recommend this only if Thomas is actively prioritising bundle size or palette flexibility.** Otherwise it's a v2 follow-up.

### Recommendation 3 — partial re-trace (highest-value poses only).

Compromise: re-trace only the 3 poses that fire most often (`idle`, `celebration`, `puzzled-tilt`). The other 5 stay as PNG-in-SVG.

Pro: cuts the bundle by ~60% (the three highest-frequency poses are also among the larger files); gets palette flexibility on the most-visible pose.
Con: visual inconsistency between the 3 vector poses and the 5 PNG-in-SVG poses (different rendering pipelines = different micro-detail look). Probably noticeable side-by-side.

**Recommend against this** — the inconsistency is worse than either extreme.

---

## Acceptance criteria (if a re-trace ticket is opened)

- [ ] All 8 (or the mandatory 6 + optional 2) Emma SVGs are pure-vector (no `<image>` tags, no base64 raster data).
- [ ] Each file passes the spec budget per `character-emma.md` §4.1: ≤ 8 KB for non-celebration poses, ≤ 9 KB for celebration / puzzled-tilt / attentive-pointing / cheering.
- [ ] Each file passes SVGO with the codebase's default config (no warnings, no errors).
- [ ] Each file uses `--emma-*` palette tokens via inline CSS variable references where the codebase pattern supports it; otherwise via direct HEX values matching the spec table.
- [ ] All 8 poses share the same character (face, hair, outfit, wand-pointer) when rendered side-by-side. Visual consistency check: paste all 8 into a single view in iPad PWA and verify Marian could plausibly read them as the same person.
- [ ] All Phase 3b acceptance criteria from `character-emma.md` §8 still pass after the re-trace (drop-in compatible, no app code changes).
- [ ] iPad Retina render at 22vh, 26vh, 40vh: crisp, no clipping, no broken paths.
- [ ] Service-worker pre-cache successfully fetches all 8 on first install post-deploy.

---

## Open questions for Thomas

1. **Re-trace yes/no/defer?** Recommended default: defer to v2.
2. **If yes, which approach?** Image-trace + cleanup, hand-author, or commission an illustrator? Recommended: commission, per `character-emma-ai-prompts.md` §6.2 fallback path — pose consistency is the load-bearing risk and a single illustrator handles it natively.
3. **Budget?** Commissioning a manhwa-styled illustrator on Fiverr / Behance is typically $50-200 per pose, $400-1600 for the 8-pose set.

---

## Provenance

- **Phase 3b PR (PNG-in-SVG ship):** PR #103 + PR #107 + PR #104 (commit `861bb0a`, 2026-04-29).
- **Spec source for budget:** `design/character-emma.md` §4.1 (8-9 KB per pose).
- **SVG-format lock:** memory `project_pic_dog_svg.md` (Thomas locked SVG-only for picture pack).
- **AI generation source:** `design/character-emma-ai-prompts.md` (the prompt sheet that was used to generate the PNGs that are now wrapped in SVG).
- **Bundle-budget reference:** PWA precache + iPad install moment in `pwa-manifest-generator` skill.
