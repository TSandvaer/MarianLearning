# Retro — 2026-06-14 away-orchestration cleanup cluster

**Scope:** 7 PRs merged in one away-orchestration session (#436–#442), plus the Emma vector re-trace **PARKED** (#435 closed). Mostly tech-debt / NIT cleanup surfaced by `/whip`, plus one parked visual-polish attempt. Authored during the quiescent tail of the away session, per the ≥3-merged-PR retro convention.

## Merged

- **#436** (Dave) — phonetic-teaching v2 design doc (three-utterance scaffold; research, merge-direct).
- **#437** (Kyle) — picture-pack source-spec template → v7 default.
- **#438** (Jessica) — `failNetwork` canon-pinning e2e audit (18 invoking specs, **0 needs-upgrade** — Wave-6D concern resolved on main).
- **#439** (Kevin) — fix: `bit` simple-sentence render threw (missing `TARGET_PAIRINGS` row); failing-first regression.
- **#440** (Jessica) — consolidate 3 per-spec canon mock helpers → shared `installMathCanonClaudeMock(page, canonPath)`.
- **#441** (Jessica) — migrate the 4th clone (`two-digit-addsub.spec.ts`) to the shared helper.
- **#442** (Devon) — correct the stale/wrong `wordPack.ts:1606` comment.

## Parked

- **Emma vector re-trace (#435, ticket `86ca8kq42`)** — sponsor rejected at the fidelity gate. Vectorizing (@neplex/vtracer) flattens the soft painterly manhwa shading into a posterized look at full size; a downgrade from the raster even with faithful silhouette/pose/palette. Raster (PNG-in-SVG) retained. If 60vh crispness is ever wanted, the path is a **higher-resolution raster source**, not vectorizing. Recipe + render instruments preserved on the closed #435 branch.

## What worked

- **`/whip`** cleared a large stale backlog cluster in one wave (4 parallel dispatches → 4 merges), then drained autonomously under away mode.
- **Render-instrument as the fidelity gate.** `tools/emma-vectorize/render-compare.mjs` + `render-head.mjs` caught the vector fidelity failure that **3237 passing unit tests could not see** (jsdom can't render pixels). Pilot-idle-first sequencing surfaced the problem on 1 pose instead of 8 — the iterate-vs-park decision was made cheaply.
- **Away-mode drain** merged 7 PRs on Kevin↔Devon cross-review + CI gates with the sponsor away; the board returns clean.

## Lessons captured (already in `.claude/docs/`)

- Vectorizing painterly art is the wrong tool when softness is load-bearing — `emma-character-and-animation.md` §12.
- **Renderable-gap-target invariant:** every `SIMPLE_SENTENCE_TARGET_SET` member needs a `TARGET_PAIRINGS` row regardless of `isTarget` (the `bit`-throw root cause) — `skill-trees-and-content.md`.
- Orphaned `vite preview` blocks machine-global port 4173 across worktrees; `npx kill-port 4173` recovery — `orchestration-concurrency.md` §1.2.
- Cross-review `gh pr checkout` + merge `--delete-branch` warnings are harmless worktree-held-branch gotchas — `orchestration-concurrency.md` §1.1.
- This project's e2e runs slow (~33–40 min) and is **within budget** — don't cancel a run within budget; verify `in_progress` via `gh run list --commit <full-sha>` before assuming a stuck rollup.

## Process gaps / open follow-ups

- **Doc-commit gap (needs sponsor action):** maintain-docs `.claude/docs` edits accumulate **uncommitted** on main, so personas dispatched off `origin/main` don't see them (Devon hit this on #442). Recommend a `docs(.claude): session capture` commit. This retro is itself uncommitted for the same reason.
- **`beyblade` scrub** (deferred, trivial) — IP brand name in `design/word-song/mj-prompts-paste-ready-2026-05-10.md:240` `top --no` block.
- **Sponsor-gated (queued in `decisions-while-away.md`):** Wave-15 feature direction (cloudSync P1 data-loss / CVC review-mode / Leitner M4-M5 / two-digit-with-regroup); skirt-color canon (shipped terracotta `#d1805c` vs mauve `--emma-skirt #C8AAB8`).
