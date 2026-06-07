# Marian Tutor — Folder Consolidation Plan

_Drafted 2026-06-06. Do NOT execute until the "Hard preconditions" section is fully satisfied._

## Goal

Today the project config is split: launching from the `MARIAN-TUTOR` wrapper gives you
`CLAUDE.md` + memory + settings but **no agents**; launching from the nested repo
`MARIAN-TUTOR\MarianLearning` gives you agents + docs but **loses** `CLAUDE.md` and
re-keys memory to an empty store. No single folder gives you everything.

Consolidate to a **single repo root** that yields agents + `CLAUDE.md` + memory + docs
from one folder, and dissolve the wrapper.

## Recommended target: flatten-down

Move the repo up so it sits beside its own worktrees:

```
C:\Trunk\PRIVATE\MARIAN-TUTOR\MarianLearning   ->   C:\Trunk\PRIVATE\MarianLearning
```

Result: the repo folder, the GitHub repo name, all `MarianLearning-*-wt` worktrees, and
the Claude memory key all align on "MarianLearning". The `MARIAN-TUTOR` wrapper is dissolved.

**Alternative (flatten-up, NOT recommended):** promote the repo contents up into
`MARIAN-TUTOR` itself so the wrapper becomes the git repo. Keeps the memory key
`C--Trunk-PRIVATE-MARIAN-TUTOR` stable (no memory migration), but leaves a permanent
folder-name mismatch with the `MarianLearning-*-wt` worktrees. Choose this only if memory
re-keying feels riskier than the naming mismatch.

## Hard preconditions (DO NOT START until ALL are true)

1. **No other Claude session running on this project.** (A second session orchestrates from
   `MARIAN-TUTOR` today — wait for it to finish; moving the repo out from under a live
   orchestrator breaks every worktree pointer mid-flight.)
2. **All 12 worktrees committed + pushed.** Nothing uncommitted to lose if a pointer repair
   misfires. Per worktree: `git -C <wt> status --porcelain` empty AND
   `git -C <wt> log origin/<branch>..HEAD` empty.
3. **Repo pushed to origin** (origin/main is current — verified 2026-06-06).

## Inventory of wrapper-only content (verified 2026-06-06)

| Item                                                                                                          | Disposition                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` (11 KB, **untracked**)                                                                            | **Salvage** — move into repo root, commit.                                                                  |
| `.claude\settings.local.json`                                                                                 | **Salvage** — per-user permissions; copy into repo `.claude\` (stays gitignored).                           |
| `.claude\auto-status.state`, `scheduled_tasks.lock`                                                           | Ephemeral; discard (regenerated).                                                                           |
| `.claude\alignment\*RandomGame*` (2 files)                                                                    | Cross-project artifacts, not Marian; archive or discard.                                                    |
| `away-mode-autonomy-setup-guide.md`, `removebg-tool-evaluation-2026-05-14.md`, `build a tutor AI app...md` ×2 | **Salvage** — reference docs; move into repo (`design/research/` or `docs/`).                               |
| `CTemplint_test_b64.txt` (392 KB)                                                                             | Throwaway base64 blob — verify, then discard.                                                               |
| wrapper `design\` (5 files) vs repo `design\` (222)                                                           | Stale subset; diff the 5, discard if duplicated.                                                            |
| wrapper `node_modules\`                                                                                       | Discard (repo has its own).                                                                                 |
| `MarianLearning-worktrees\emma-asset-refresh`                                                                 | NOT a registered worktree, no `.git` — plain orphaned folder. Inspect; salvage assets if any, else discard. |

## Migration steps (run during a quiet window)

### Phase 0 — Safety

- 0.1 Confirm no other session active.
- 0.2 For each of the 12 worktrees: `git status --porcelain` empty + branch pushed. Commit/push/stash any dirty one first.

### Phase 1 — Salvage wrapper-only content into the repo (while still nested)

- 1.1 `git -C <repo> switch main` (or a dedicated `chore/consolidation` branch).
- 1.2 Move `CLAUDE.md` → repo root; move the 3 keeper reference `.md` files → `design/research/` (or `docs/`).
- 1.3 Copy `.claude\settings.local.json` → repo `.claude\settings.local.json` (confirm it's gitignored).
- 1.4 Commit + push. Now launching from the repo yields project instructions.

### Phase 2 — Move the repo up

- 2.1 Close all editors/terminals holding handles in the tree.
- 2.2 Move `C:\Trunk\PRIVATE\MARIAN-TUTOR\MarianLearning` → `C:\Trunk\PRIVATE\MarianLearning`. (The 5 in-repo `.claude/worktrees/*` move with it.)
- 2.3 Repair worktree pointers — from the moved repo:
  - `git worktree repair` (fixes the 5 internal worktrees)
  - For each of the 7 siblings: `git worktree repair C:\Trunk\PRIVATE\MarianLearning-<role>-wt` (repairs both directions: sibling `.git` file ↔ repo `.git/worktrees/<n>/gitdir`)
- 2.4 Verify: `git worktree list` shows all 12 with correct new paths; `git -C <each sibling> status` works.

### Phase 3 — Memory migration

- 3.1 Rename the Claude memory dir so the new cwd resolves to the existing store:
  - `C:\Users\538252\.claude\projects\C--Trunk-PRIVATE-MARIAN-TUTOR` → `...\C--Trunk-PRIVATE-MarianLearning`
- 3.2 Verify `MEMORY.md` + topic files present under the new name.

### Phase 4 — Dissolve the wrapper

- 4.1 Confirm `MARIAN-TUTOR` now holds only discardable items.
- 4.2 Archive anything uncertain to `C:\Trunk\PRIVATE\_archive\MARIAN-TUTOR-leftovers\` (do not hard-delete).
- 4.3 Remove the now-empty wrapper.

### Phase 5 — Update references

- 5.1 Grep `.claude/` (hooks, `settings.json`, docs), persona files, and `TEAM.md` for the literal `MARIAN-TUTOR` path; update to `MarianLearning`. (Check `session-start-*.sh` hooks, per-role worktree invocations, any `cd` paths.)
- 5.2 Update user memory entries that hardcode `C:/Trunk/PRIVATE/MARIAN-TUTOR`.
- 5.3 Start a fresh session from `C:\Trunk\PRIVATE\MarianLearning`; confirm: agents visible in the extension, `CLAUDE.md` loaded, memory intact, docs auto-load.

## Rollback

Every phase is reversible. Phase 2 undone by moving the folder back + `git worktree repair`;
Phase 3 by renaming the memory dir back. Nothing is hard-deleted until Phase 4, and that
routes through `_archive` first.
