# Marian Tutor — Agent Team

Six agents handle the Marian Tutor build. The product owner (Thomas) talks to the **orchestrator** (the Claude Code session). The orchestrator fans out directly to Matt, Kyle, Kevin, Devon, Jessica, and Dave; Matt acts as project-lead consultant (planning, ClickUp board work, PO-facing summaries) but does not himself fan out to peers — nested-Agent spawning is unsupported in this Claude Code build (see _Topology_ below). **Dave** is a consultant on developmental psychology, dispatched by the orchestrator when Matt or Kyle requests his input.

## Roster

| Agent                 | Role                            | Consulted by                                                    | Tools                                                                                                                  |
| --------------------- | ------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Matt](matt.md)       | Project Lead                    | Orchestrator                                                    | ClickUp MCP, Read/Grep/Glob, Bash (read-only git + gh), TodoWrite                                                      |
| [Kyle](kyle.md)       | UX Designer                     | Orchestrator (on Matt's recommendation); collaborates with Dave | Read/Write/Edit, Bash (git + gh for own asset/spec PRs), Skill (motion, mobile-app-design, pwa-manifest-generator)     |
| [Kevin](kevin.md)     | Developer                       | Orchestrator; reviews Devon's PRs                               | Full dev toolkit + `code-review` skill + ClickUp (read/comment/update)                                                 |
| [Devon](devon.md)     | Developer                       | Orchestrator; reviews Kevin's PRs                               | Full dev toolkit + `code-review` skill + ClickUp (read/comment/update)                                                 |
| [Jessica](jessica.md) | QA / Tester                     | Orchestrator                                                    | Read/Write/Edit/Grep/Glob/Bash, WebFetch (Write/Edit scoped to test + automation directories, not production app code) |
| [Dave](dave.md)       | Child Psychologist (consultant) | Orchestrator (on Matt's or Kyle's request)                      | Read/Write/Edit, Grep/Glob, WebFetch, WebSearch, Skill, ClickUp (read/comment)                                         |

## Communication topology

```
              Thomas (PO)
                  │
                  ▼
            Orchestrator  ◄── single fan-out / fan-in point
            ┌──┬──┬──┬──┬──┐
            ▼  ▼  ▼  ▼  ▼  ▼
          Matt Kyle Kevin Devon Jessica Dave
                  │   ↕     ↕
                  │   (peer PR review)
                  ▼
               (Kyle ↔ Dave for developmental-psych audits,
                routed through the orchestrator)
```

- **Thomas talks to the orchestrator**, not to any single agent. The orchestrator routes per the team's working-style traits (backend → Kevin; frontend/UX-implementation → Devon; spec ambiguity → Kyle; age/cognitive-load review → Dave; planning + ClickUp + status → Matt).
- **Matt is the project-lead consultant.** He reads/writes the ClickUp board, decomposes work, drafts ACs, and produces PO-facing summaries — but he calls no peers himself. The orchestrator dispatches based on Matt's recommendations.
- **Kevin and Devon review each other's PRs**, never their own, assisted by the `code-review` skill. The orchestrator pairs them.
- **Jessica reports pass/fail to the orchestrator**, who relays through Matt's status summaries to Thomas.
- **Routine PRs ship on Jessica PASS + orchestrator-merge** — no per-PR Thomas gate. Thomas's involvement is reserved for the load-bearing gates that survived audit: big design decisions, iPad-only validation, audio TTS correctness (utterance/SSML), subjective aesthetic disagreement on visuals (`feedback_pr_merge_authority.md`, 2026-05-02; reinforced 2026-05-23 retune).
- **Dave is consulted, not assigned tickets.** When Matt or Kyle wants his input they flag it; the orchestrator dispatches Dave with the relevant spec/context. Dave returns research notes / quick takes / spec audits. He never moves cards or owns specs.

**Why this topology and not Matt-as-fan-out:** Anthropic's Claude Code runtime filters the `Agent` tool out of the toolset exposed to subagents (hard-coded in `AgentTool/prompt.ts`), so a spawned Matt cannot itself spawn Kyle/Kevin/etc. The experimental flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` was probed at project, User, and Machine env-var scopes (2026-04-24 → 2026-04-25); none unlocked nested-Agent. Top-level fan-out is the permanent model for this project. Revisit if Anthropic ships native nested-Agent.

## Task lifecycle

1. **Thomas → Orchestrator:** request / feature idea / feedback.
2. **Orchestrator → Matt:** "decompose this." Matt drafts ClickUp task(s) with acceptance criteria, suggests assignees + priority. Returns plan.
3. **Orchestrator → Kyle** (if UX needed): writes a spec under `design/<feature>.md`. Returns spec.
4. **Orchestrator → Kevin or Devon:** branches `feat/<id>-<slug>`, implements, opens PR. Returns PR #.
5. **Orchestrator → the other developer:** runs `code-review` skill, reads diff, leaves real comments, approves or blocks.
6. **Merge** (only after peer approval; orchestrator triggers).
7. **Orchestrator → Jessica:** QAs against acceptance criteria on iPad. Returns PASS / PASS-with-notes / FAIL.
8. **Orchestrator → Matt:** closes the ClickUp task on Jessica PASS + orchestrator-merge. Brief Thomas in a summary so he knows what shipped — but **do not gate the COMPLETE flip on his approval** for routine PRs (`feedback_pr_merge_authority.md`).
9. **Sponsor surfacing reserved for:** big design decisions, iPad-only validation, audio TTS correctness (utterance/SSML changes), subjective aesthetic disagreement on visuals. These are the gates that survived the 2026-05-23 audit.

## Shared references

Every agent reads these before a first substantive task:

- [CLAUDE.md](../../CLAUDE.md) — project brief
- [build a tutor AI app with investigation and analysis.md](../../build%20a%20tutor%20AI%20app%20with%20investigation%20and%20analysis.md) — Part 1 (diagnostic + decisions)
- [build a tutor AI app with investigation and analysis2.md](../../build%20a%20tutor%20AI%20app%20with%20investigation%20and%20analysis2.md) — Part 2 (skills + team)

## Operational IDs

- **ClickUp workspace:** `90151646138`
- **ClickUp list (MarianLearning board):** `901523003843`
- **ClickUp space (TSandvaer Development):** `90156932495`
- **GitHub repo:** `TSandvaer/MarianLearning` (cloned at `C:\Trunk\PRIVATE\MarianLearning`)
- **Board URL:** https://app.clickup.com/90151646138/v/b/li/901523003843

## Worktree map

Per-role persistent worktrees as siblings of `MarianLearning/`, established 2026-05-15 per `[[feedback_per_role_persistent_worktrees]]`. Each git-active role has a dedicated worktree where ALL their task branches checkout. Supersedes the prior per-ticket ephemeral worktree pattern (`MarianLearning/.claude/worktrees/<slug>/`).

| Worktree                                     | Role         | Used for                                                                     |
| -------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `C:/Trunk/PRIVATE/MarianLearning-kyle-wt`    | Kyle         | Spec authoring + design asset PRs                                            |
| `C:/Trunk/PRIVATE/MarianLearning-kevin-wt`   | Kevin        | Implementation + code review                                                 |
| `C:/Trunk/PRIVATE/MarianLearning-devon-wt`   | Devon        | Implementation + code review                                                 |
| `C:/Trunk/PRIVATE/MarianLearning-jessica-wt` | Jessica      | E2E specs + QA automation                                                    |
| `C:/Trunk/PRIVATE/MarianLearning-matt-wt`    | Matt         | (Reserved — read-only inspection if needed)                                  |
| `C:/Trunk/PRIVATE/MarianLearning-dave-wt`    | Dave         | (Reserved — Dave saves research to parent workspace, no git ops)             |
| `C:/Trunk/PRIVATE/MarianLearning-orch-wt`    | Orchestrator | (Reserved — orchestrator survey + occasional git ops outside agent dispatch) |

Each worktree starts on a `<role>/idle` tracking branch off `origin/main`. Run-start invocation for any git-active agent:

```bash
cd C:/Trunk/PRIVATE/MarianLearning-<role>-wt
git fetch origin
git checkout -B <role>/<task-name> origin/main
```

Push by refspec; never `--delete-branch` on your own worktree (cosmetic-only local-ref-lingers error is expected); `gh pr merge --admin --squash --delete-branch` handles remote-side cleanup.

The main checkout at `C:/Trunk/PRIVATE/MarianLearning` is the orchestrator's READ-ONLY survey checkout — never edited by agents.

## Prerequisites status

- [x] **ClickUp MCP server configured and authenticated.** ✓ (use `mcp__clickup__*` tools)
- [x] **GitHub repo cloned locally.** ✓ — empty, first push will seed `main`
- [x] **`gh` CLI installed and authenticated** as `TSandvaer`. ✓ (portable at `C:\Users\538252\.local\bin\gh.exe`)
- [~] **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`** — set in `.claude/settings.json` AND at Windows User + Machine env-var scopes. **Confirmed inert in this Claude Code build** (probes 2026-04-24 → 2026-04-25 all failed to unlock nested-Agent). Top-level fan-out is the permanent topology. Re-probe if Anthropic announces native nested-Agent support.
- [ ] **Anthropic API key** in a Vercel env var (NOT the client bundle). Needed for Week 2+ Claude calls — not blocking Week 1 scaffold.

## Models

Five core agents (Matt, Kyle, Kevin, Devon, Jessica) are `opus` by default because the project values care over throughput. Downgrade Kevin/Devon to `sonnet` later if volume grows.

**Dave is `sonnet`.** Research and synthesis at scale benefit from sonnet's larger context and faster iteration on web-search loops; the precision premium of opus is less load-bearing for a consult role than for spec authoring or PR review.

## Invoking the team

Thomas invokes by talking to Claude Code in this project. The **top-level orchestrator** is the single fan-out / fan-in point: it spawns Matt, Kyle, Kevin, Devon, Jessica, and Dave directly via the `Agent` tool with the appropriate `subagent_type`. Matt is consulted for planning, ClickUp board work, and PO-facing summaries; he flags when peers (especially Dave) should be pulled in, and the orchestrator routes.

**Example opening line from Thomas:**

> Kick off Week 1. Get Matt to draft tickets. Get Kyle to spec session 1. Get Kevin starting the Vite + PWA scaffold. Have Dave check Kyle's spec for cognitive load before it lands.

The orchestrator translates that into: spawn Matt for ticket creation; in parallel spawn Kyle (UX) and Kevin (scaffold); when Kyle's spec is ready, spawn Dave with the spec and Marian's diagnostic context; route Dave's audit back to Kyle for revision; ask Matt to summarize and update the board.
