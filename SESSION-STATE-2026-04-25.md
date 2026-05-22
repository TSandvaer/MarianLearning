# Session Handoff — 2026-04-25 morning

Written by the overnight Claude Code terminal session before Thomas moved to the VS Code extension. Any new Claude Code session opening this workspace should read this file first, then `CLAUDE.md`, then check the memory index (loaded automatically).

---

## What happened overnight (2026-04-24 → 2026-04-25)

| Ticket    | Who   | Deliverable                               | Status                                                                                                                                             |
| --------- | ----- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86c9gkkxb | Kyle  | Session 1 UX spec (`design/session-1.md`) | Delivered. 8 open questions for Thomas.                                                                                                            |
| 86c9gkkw3 | Kevin | Vite/React/TS/Tailwind/PWA scaffold       | Delivered. PR #1 open, 62 KB gzipped (31% of budget), all checks green.                                                                            |
| 86c9gkkw3 | Devon | Review of PR #1                           | Posted comment (not a formal review). Flagged 1 ≥80 issue (SW path) — **verified false positive** by the orchestrator, clarification posted on PR. |

PR #1: https://github.com/TSandvaer/MarianLearning/pull/1

---

## Pending Thomas decisions (block further overnight-style work)

### Decision 1 — Merge PR #1 (scaffold)

Clean review, no blockers. Devon's concern about SW registration path was verified false (verified by running `yarn build` and inspecting `dist/` — only `sw.js` exists; the `sw.mjs` in Kevin's PR body table is an intermediate not in the final bundle).

**Minor nit (non-blocking):** Kevin's PR body size table shows `dist/sw.mjs` instead of the final `dist/sw.js`. Cosmetic; ask Kevin to tweak or live with it.

Merging PR #1 unblocks:

- `86c9gkm27` [Kevin] TTS utility
- `86c9gkkyb` [Devon] Progress JSON schema + localStorage adapter
- `86c9gkm0c` [Devon] Claude API Vercel Function (stub)

### Decision 2 — Kyle's 8 open questions on session-1 spec

File: `design/session-1.md` (now also on branch `feat/86c9gkkxb-session-1-spec`, PR #?). Three blocking, five non-blocking.

**Blocking (Kevin/Devon can't implement Session 1 without these):**

1. **Phonemes** — Web Speech API can't cleanly produce `/d/`, `/ŏ/`, `/g/`. Kyle recommends ~100 KB pre-recorded phoneme audio. BUDGET SIGN-OFF needed.
2. **Background count** — spec'd 4, CLAUDE.md caps v1 at 3. Proposed CSS-filter twilight workaround — approve the workaround or reduce to 3.
3. **Math distractors** — `4` and `6` target Marian's documented off-by-one error on her **first ever** problem. Kyle asks: trap or good teaching? Alternative: `3` and `10`.

**Non-blocking (Kyle will proceed with your nod or a follow-up ticket):** 4. Home-tap behavior (recommend return-to-splash since iOS PWAs can't self-close) 5. TTS voice identity long-term 6. Return-user greeting S2+ (follow-up ticket) 7. PWA install instruction screen (follow-up ticket) 8. Offline cold-start (Kyle proposes inlining Melody idle + one bg as SVG)

### Decision 3 — ClickUp status names

On the MarianLearning list (id `901523003843`), neither `"in progress"` nor `"in-progress"` works. Need the valid label, or permission to skip programmatic status updates and rely on manual board moves.

---

## What's running

Nothing. All subagents finished last night. No background work in progress.

---

## Where things live

| Thing                                                                  | Location                                                                                                                                           | In git?                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Auto-memory (persistent across sessions)                               | `C:\Users\538252\.claude\projects\C--Trunk-PRIVATE-MARIAN-TUTOR\memory\`                                                                           | No (user home)                                                   |
| `MEMORY.md` index (auto-loads each session)                            | same dir                                                                                                                                           | No                                                               |
| `CLAUDE.md` (project brief)                                            | `C:\Trunk\PRIVATE\MARIAN-TUTOR\CLAUDE.md`                                                                                                          | **Not tracked — local-only**                                     |
| Agent configs (`matt`, `kyle`, `kevin`, `devon`, `jessica`, `TEAM.md`) | `C:\Trunk\PRIVATE\MARIAN-TUTOR\.claude\agents\*.md`                                                                                                | **Not tracked — local-only**                                     |
| Settings (experimental flag + Edit permission)                         | `C:\Trunk\PRIVATE\MARIAN-TUTOR\.claude\settings.json`                                                                                              | **Not tracked — local-only**                                     |
| Investigation docs                                                     | `C:\Trunk\PRIVATE\MARIAN-TUTOR\build a tutor AI app with investigation and analysis*.md`                                                           | **Not tracked — local-only**                                     |
| Kyle's Session 1 spec                                                  | `C:\Trunk\PRIVATE\MARIAN-TUTOR\design\session-1.md` **AND** `MarianLearning/design/session-1.md` on branch `feat/86c9gkkxb-session-1-spec` (PR #2) | Yes — pushed to GitHub on PR #2                                  |
| Scaffold code                                                          | `C:\Trunk\PRIVATE\MARIAN-TUTOR\MarianLearning\`                                                                                                    | Yes — `TSandvaer/MarianLearning`, PR #1 on `feat/SETUP-scaffold` |
| ClickUp board (7 W1 tickets + comments)                                | https://app.clickup.com/90151646138/v/b/li/901523003843                                                                                            | N/A — cloud                                                      |

---

## Real backup gap

Everything at `C:\Trunk\PRIVATE\MARIAN-TUTOR\` **outside** of `MarianLearning/` is NOT in any git repo. If the machine dies, you lose:

- `CLAUDE.md`
- `.claude/settings.json` + all five agent configs + TEAM.md
- Both investigation docs
- The project-root `design/session-1.md` (now mitigated — copy pushed to GitHub on a branch)

**Memory files** in `%USERPROFILE%\.claude\projects\...` are also local-only.

**Options to address (need your call):**

1. Push the whole `MARIAN-TUTOR/` tree to a new private GitHub repo (e.g., `TSandvaer/MarianTutor-Workspace`) that wraps everything, with `MarianLearning/` as a git submodule.
2. Move meta files (CLAUDE.md, .claude/, investigation docs) INTO `MarianLearning/` and version them there.
3. Leave as-is; rely on OneDrive/iCloud/manual backup for the workspace root.

I did not take option 1 or 2 unilaterally — they're structural decisions.

---

## Architecture note (also saved in memory as `project_orchestration.md`)

- Top-level Claude Code session orchestrates Kyle/Kevin/Devon/Jessica directly via `Agent` tool.
- Matt (project lead subagent) is on the bench — `Agent`/`Task` tool is not exposed to subagents in this Claude Code build despite `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` being set in `.claude/settings.json`.
- Matt's tool scope was expanded to include the full `mcp__clickup__*` surface so he CAN read/update the board directly (he just can't fan out to other agents).
- Open TODO: restore nested subagent spawning and revert to Matt-as-fan-out. Not a blocker.

---

## Sub-threshold review nits (from Devon's PR #1 review, scored < 80 so not posted to PR)

For a follow-up cleanup ticket after scaffold merges:

1. `no-explicit-any` ESLint rule set to `warn` instead of `error` (score 75)
2. Stale comment in `src/pwa/registerServiceWorker.ts` referencing `registerType: 'prompt'` when `vite.config.ts` actually uses `autoUpdate` (score 40)
3. ESLint comment vs rule level mismatch (score 50)

---

## Suggested first actions in the new VS Code session

1. Open `C:\Trunk\PRIVATE\MARIAN-TUTOR\` in VS Code.
2. Launch the Claude Code extension. It reads `CLAUDE.md` and the memory index automatically — you don't need to paste anything.
3. Tell the new session: "read `SESSION-STATE-2026-04-25.md`, merge PR #1 and the Kyle spec PR if they look clean, then walk me through Kyle's 3 blocking open questions."
4. After your decisions on Kyle's questions + PR #1 merge: the orchestrator can fan out TTS + Devon's two tickets in parallel.

---

## Ready-to-merge PRs awaiting your approval

- PR #1 — scaffold — `feat/SETUP-scaffold` — verified clean.
- PR #2 — Kyle's session-1 spec — `feat/86c9gkkxb-session-1-spec` — https://github.com/TSandvaer/MarianLearning/pull/2 — doc only, no review needed, low-risk merge.

---

_Written by the overnight Claude Code terminal orchestrator, 2026-04-25._
