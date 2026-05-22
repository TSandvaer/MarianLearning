# Session Handoff — 2026-04-25 evening

Written by the VS Code Claude Code extension session that picked up from `SESSION-STATE-2026-04-25.md` (morning), shipped Week 1 foundation, introduced Dave (child psychologist consultant), and added explicit working-style traits to Kyle / Kevin / Devon / Jessica. **Supersedes the morning handoff.** Read this file first; the morning one is historical.

---

## Top-of-priority for the new session

**1. Re-probe the env-var experiment.** Earlier in the previous session, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` was set as a Windows **user-level environment variable** (not just in `.claude/settings.json`). VS Code must be **fully quit and relaunched** for that env var to land in its process env. If you started this new session after a full VS Code relaunch from the Start Menu, that env var should now be visible to Claude Code's runtime, which may unlock nested-Agent spawning.

**Test:** spawn Matt with this exact brief — _"spawn Kyle with `subagent_type: 'kyle'` and the one-line task: reply with the word `reachable` and stop. Report whether the Agent tool is exposed and what happens."_

**If ✅ Matt successfully spawns Kyle (env-var path works):**
Swing orchestration to **Mode A — Orchestrator-as-foreman, Matt-as-router** (Thomas confirmed this preference at end of previous session). Concretely:

- Orchestrator (you) stays the literal conversational interface — Thomas types in, you respond. He does NOT talk to Matt directly.
- Anything that touches the project (planning, board, decomposition, dispatching peers, status summaries) goes through Matt, who fans out to Kyle/Kevin/Devon/Jessica/Dave.
- Procedural one-liners (merge a pre-approved PR, edit settings, memory writes, file-system questions) the orchestrator handles directly — no Matt overhead.
- Routing decisions in dispatched briefs respect the working-style traits added 2026-04-25: backend tickets → Kevin; frontend / UX-implementation → Devon; spec-ambiguity → Kyle (asks rather than guesses); developmental-psych / age-fit review → Dave.
- Code review (Kevin ↔ Devon) routes through Matt; he picks the reviewer per the "never review your own PR" rule.
- **Update memory:** `memory/project_orchestration.md` — record the resolution (env-var path worked at user scope after VS Code relaunch on YYYY-MM-DD); replace the "top-level fan-out" content with the Mode A model.
- **Update `TEAM.md`:** "Invoking the team" section — replace the "while nested-Agent is blocked" framing with Mode A; the topology diagram already shows Matt as fan-out point.

**If ❌ same "Agent type/Task not available inside subagents" error (user-scope env var also doesn't unblock):**

- User-scope path doesn't reach Claude Code's runtime. Two options remain:
  1.  Try **Machine-scope** (system-wide, requires admin). Set via elevated PowerShell: `[Environment]::SetEnvironmentVariable("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1", "Machine")` — or via Windows UI: Win → "Edit the system environment variables" → System variables → New. Then full VS Code restart. Re-probe.
  2.  File an issue with Anthropic — the experimental flag may be deprecated or require a specific Claude Code version. Memory note in `project_orchestration.md` already lists this.
- Stay on top-level fan-out (current model) until resolved. Update `project_orchestration.md` with the latest probe date and result.

**2. PR #9 — Kyle's Screen 4 audio + button gating tweaks.** Doc-only, low-risk, awaits Thomas's merge. URL: https://github.com/TSandvaer/MarianLearning/pull/9. After this lands, the spec on `main` reflects every decision and audit finding from the previous session.

**3. Plan Week 2.** Foundation modules are in (TTS utility, progress schema + localStorage, Claude API Vercel function stub). The natural next implementation is **Splash + Hub** from `design/session-1.md` (now updated with Dave's findings). Pre-implementation, consider sending Dave for a Hub-specific cognitive-load review (working-memory chunks at age 8, skill-tile count, audio sequencing).

---

## Where things stand

### Week 1: COMPLETE

- 3 ClickUp cards in `COMPLETE`: `86c9gkm27` (TTS utility), `86c9gkm0c` (Claude API stub), `86c9gkkyb` (progress schema + localStorage adapter).
- 8 PRs merged to `main`:
  - #1 scaffold (Vite + React + TS + Tailwind + PWA)
  - #2 Kyle's session-1 UX spec
  - #3 TTS utility (with synth.cancel queue-fix bug caught and locked down by regression test)
  - #4 Claude API Vercel Function stub (server-only key, grep-confirmed key never in client bundle)
  - #5 Progress JSON schema + localStorage adapter
  - #6 Session-1 spec — Thomas's Q1/Q2/Q3 decisions baked in
  - #7 Progress defaults aligned with Marian's diagnostic (post-QA fix)
  - #8 Dave's session-1 audit (cognitive load, age-fit, dark-pattern; full research note under `design/research/session-1-audit.md`)

### PR #9 (still OPEN, ready to merge)

`design(session-1): Screen 4 audio + button gating tweaks (Dave audit)` — https://github.com/TSandvaer/MarianLearning/pull/9. Doc-only spec change implementing Dave's two Screen 4 recommendations. No review needed; same merge pattern as PR #2 / PR #6.

### Team (now six agents)

| Agent          | Role                            | Model      | Working-style traits added 2026-04-25                                                                                   |
| -------------- | ------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Matt           | Project Lead                    | opus       | (no traits added; retains existing role)                                                                                |
| Kyle           | UX Designer                     | opus       | well-organised; finisher (asks rather than guesses); detail-oriented / quality-first                                    |
| Kevin          | Developer                       | opus       | TDD-experienced; 70% coverage target on new modules; robust architecture; **backend-stronger than frontend**            |
| Devon          | Developer                       | opus       | detail-oriented frontender; **frontend-stronger; backend-capable**; encourages testability                              |
| Jessica        | QA / Tester                     | opus       | thorough; well-organised; **automation-leaning** (Write/Edit added to her tools, scoped to test/automation directories) |
| **Dave (NEW)** | Child Psychologist (consultant) | **sonnet** | created from scratch with full persona                                                                                  |

**Routing implication:** backend ticket → Kevin; frontend/UX-implementation ticket → Devon; spec ambiguity → Kyle (with a question, not a guess); developmental-psych / age-appropriateness review → Dave (consulted by Matt or Kyle, dispatched via orchestrator).

### Critical runtime caveat

All agent file changes (Kyle/Kevin/Devon/Jessica trait additions, plus Dave's creation) were made **mid-session** in the previous run. Claude Code loads `.claude/agents/*.md` at session start, so the changes were not visible to the running runtime. Confirmed: spawning `dave` failed with `"Agent type 'dave' not found"`. Workaround used: `general-purpose` pinned to `sonnet` model with Dave's persona file path in the brief. **In this new session (assuming full VS Code relaunch), real Dave should be invokable.**

### Backlog (9 in TO DO)

- Original Week 1 leftovers (not individually audited)
- 5 follow-up tickets created during this session:
  - `86c9gn9tc` — `.gitattributes` / CRLF normalization (Devon hit this on every Windows commit; fix is one-line + a normalization commit)
  - `86c9gn9td` — PR #1 sub-threshold cleanup nits (no-explicit-any rule level, stale registerType comment, ESLint mismatch, sw.mjs vs sw.js cosmetic)
  - `86c9gn9th` — Node 25 / jsdom Storage shim revisit when toolchain upgrades
  - `86c9gna8e` — TTS `boundary` event hook for word-by-word caption sync (Devon parked from PR #3 review)
  - `86c9gndd2` — Session-generator must expose next CVC word for Screen 5 teaser coupling (cross-ticket dependency from Dave's audit)

---

## Stale worktrees on disk (safe to prune)

These worktree directories still exist locally; their branches were deleted on merge. To clean up:

```
cd c:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning
git worktree prune
```

Affected: `86c9gkm27-tts-utility`, `86c9gkm0c-claude-api-stub`, `86c9gkkyb-progress-schema`, `spec-decisions`, `defaults-qa-fix`, `dave-session1-audit`. **Active worktree (do NOT prune):** `kyle-screen4-tweaks` (PR #9 still OPEN).

---

## Where things live

| Thing                             | Location                                                                                        | In git?             |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Shipped code, specs, Dave's audit | `MarianLearning/`, `origin/main`                                                                | Yes                 |
| PR #9 open                        | branch `design/screen-4-audio-tweaks`, worktree `MarianLearning-worktrees/kyle-screen4-tweaks/` | Yes (branch pushed) |
| Agent configs incl. Dave          | `.claude/agents/{matt,kyle,kevin,devon,jessica,dave,TEAM}.md`                                   | **No — local-only** |
| `.claude/settings.json`           | with permission allowlist + experimental flag                                                   | **No — local-only** |
| Memory files                      | `C:\Users\538252\.claude\projects\c--Trunk-PRIVATE-MARIAN-TUTOR\memory\`                        | **No — local-only** |
| Investigation docs                | project root                                                                                    | **No — local-only** |
| `CLAUDE.md`, `SESSION-STATE-*.md` | project root                                                                                    | **No — local-only** |

**Backup gap unresolved.** Three options from the morning handoff still on the table; none acted on:

1. Push the whole `MARIAN-TUTOR/` tree to a private GitHub workspace repo (with `MarianLearning/` as a submodule).
2. Move meta files into `MarianLearning/` and version them there.
3. Rely on OneDrive/iCloud/manual backup.

---

## Memory pointers (auto-loaded each session)

- `project_marian_tutor.md` — overview
- `user_parent_builder.md` — user profile
- `project_diagnostic_results.md` — Marian's April 2026 diagnostic
- `project_orchestration.md` — orchestration model + nested-Agent blocker history (records the env-var probe as the next thing to try)
- `reference_clickup_board.md` — board structure + case-sensitive status names

---

## What's running

Nothing. All agents from this session terminated cleanly. No background work in progress.

---

_Written 2026-04-25 evening, by the VS Code Claude Code extension session prior to a planned VS Code relaunch for the env-var experiment._
