---
name: maintain-docs
description: Auto-triggered after every turn (via Stop hook) — silently reviews the turn for findings/new/altered code worth capturing in `.claude/docs/`. Spawns 3 parallel sonnet proposers + 1 sonnet consolidator, auto-applies merged doc edits, and emits output to the main thread ONLY when documentation was actually changed. Also invokable manually via /maintain-docs.
---

# Maintain Docs (auto)

Capture non-obvious knowledge from the current turn into `<PROJECT_ROOT>/.claude/docs/` so future Claude sessions start informed. This skill runs automatically after every turn via the Stop hook at `.claude/hooks/maintain-docs-stop.sh`, and is also invokable on demand.

## Step 0: Visibility policy (read first) — SILENT BY DEFAULT

**Emit ZERO main-thread output when no documentation needs updating.** This is the common case (most turns fail the Step 1 early-exit filter). The Stop hook is satisfied by skill invocation + turn end alone — no start message, no no-change message, no acknowledgment. Specifically:

- **Do NOT** emit a start message (no "Reviewing turn for doc-worthy findings..." or any paraphrase).
- **Do NOT** emit a no-change message (no "No documentation updates warranted this turn." or any paraphrase).
- The ONLY main-thread output this skill produces is the Step 6 report, AND only when documentation was actually updated.

**Why:** Confirmation messages on every turn become pure context bloat over a session (e.g. 2 lines × 50 turns = 100 lines of noise that mostly says "I checked and nothing was worth saving"). The Stop hook fires for every assistant turn; emitting boilerplate per Stop hook silently degrades the orchestrator's main-window signal-to-noise. This silent-by-default rule overrides any prior "always emit a start message" or "always report outcome" guidance in this skill or sibling project copies. If the user's CLAUDE.md silent-default policy exists at user-level, this skill follows it (the user-level rule wins).

## Step 1: Early-exit filter

Skip the rest of the skill and end silently if this turn was:

- A greeting, acknowledgment, or trivial clarification
- Pure Q&A with no code changes and no architectural conclusions
- A routine edit with no surprise, constraint, or design decision surfaced
- Tool-only exploration (reads/greps) where nothing new was concluded
- A task that simply repeats patterns already covered in existing `.claude/docs/`
- An orchestration tick (heartbeat, dispatch announcement, CI sweep, ticket-status flip, PR merge mechanics) without a code/architecture change — the orchestrator's own activity log is captured by memory + session state, not docs

The bar is high: most turns fail this filter. Only continue when the turn produced a non-obvious insight, a new feature area, a gotcha, or a validated pattern future Claude would benefit from knowing cold.

### Step 1b: The incident gate (hard precondition — no exceptions)

_(Imported from Far-Horizon 2026-08-02, whose auto-firing maintain-docs helped produce 79 commits with 47 docs and ZERO `feat` over ten days. FH's response was to make the skill manual-only; this project keeps the Stop-hook trigger but adopts FH's content gate. See `CLAUDE.md § Documentation requires a paid-for incident`.)_

Passing the early-exit filter above is **necessary but no longer sufficient**. A doc entry may be written **only** if you can state both of these concretely:

1. **The incident** — a specific thing that went wrong, named with a verifiable reference (a PR number, a commit SHA, a ClickUp ticket ID, an ear-test that overturned a claim, an agent that died mid-task, a re-bake that had to be redone).
2. **What it cost** — a wasted bake, an ear-test round, a wasted dispatch, hours of agent time, a wrong merge. Concrete, not "confusion" or "could have been clearer."

Write it in this shape before proposing anything:

> **Incident:** &lt;what broke, cited&gt; — **Cost:** &lt;what was actually spent&gt;

**If you cannot name the incident and its cost, there is no doc to write. Stop and end silently.** "This seems useful," "future Claude would benefit," "worth capturing," and "non-obvious" are NOT incidents — that bar was already in this skill and it did not hold. An incident is something that already happened and already cost something.

**Corollary — the docs are not a growth surface.** Prefer amending an existing doc over creating a new one. A new file needs its own incident, not just a new topic. Note the current scale: the ten docs total ~704 KB, and `CLAUDE.md § Sub-agents — read the SCOPED docs at start` now routes agents to 1–3 of them rather than all — every KB added is context someone pays for.

**Unmerged-API defer rule (imported from RandomGame 2026-06-11; their Drew PR #318 finding).** Even if the early-exit filter doesn't fire, captures that would cite a function / API / file / commit only present on an UNMERGED feature branch should DEFER until the parent PR merges — or carry an explicit "pending PR #N merge" tag so reviewers know the cite cannot be verified against `main` yet. The consolidator (Step 4) should reject proposals that violate this rule unless the tag is present.

**Durable-cite preference (imported from RandomGame 2026-06-11; their Tess PR #321 finding).** When a capture cites a source artifact, prefer cite shapes durable in `git log`: ClickUp ticket IDs, PR numbers, commit SHAs, file:line@commit. AVOID paths to uncommitted scratch `.md` files — they vanish on branch switch and aren't retrievable by future readers.

## Step 2: Inventory + conversation brief

- List `<PROJECT_ROOT>/.claude/docs/` contents.
- Read the "Detailed Documentation" section of `<PROJECT_ROOT>/CLAUDE.md` to get the current index.
- Write a 200–500 word internal brief of this turn's **non-obvious** findings: architectural decisions, gotchas, constraints that surfaced, patterns validated, new systems touched. Exclude routine narration, trivial fixes, and anything already covered in existing docs.

## Step 3: Three parallel proposer agents (single message, 3 Agent calls)

Call the Agent tool 3 times **in the same message** with `subagent_type: general-purpose` and `model: sonnet`. Identical prompt for each (label them A, B, C):

```
You are proposing documentation updates for <PROJECT_ROOT>/.claude/docs/ based on a recent conversation turn.

## Conversation brief
<BRIEF FROM STEP 2>

## Existing docs inventory
<FILE LIST FROM STEP 1>

## Existing index (from CLAUDE.md "Detailed Documentation" section)
<INDEX SECTION>

## The incident (from the orchestrator's Step-1b gate)
<INCIDENT + COST LINE FROM STEP 1b>

## Your task — ONE question only
**Would this doc entry have PREVENTED the named incident above?** For each candidate from the brief, decide: skip, or amend an existing doc (which one and where). Creating a new file requires its own named incident.

Do NOT answer "how could the documentation be improved along quality, coverage, relevance" — that question is BANNED here. It always has an answer, and answering it is what produced 47 docs commits and zero features in ten days on a sibling project. You are not improving documentation; you are recording the price of one specific incident so it isn't paid twice.

Read relevant existing docs before proposing, so you don't duplicate what is already there. If the incident's lesson is already written down anywhere in `.claude/docs/`, return NO_PROPOSALS.

## Output format — propose only, do NOT edit files
For each proposed change, emit a block:

---
action: update | create
file: <path relative to project root>
rationale: <one sentence — why this matters for future Claude>
location_hint: <"end of file" | "after section '<heading>'" | "new section: <title>">   # update only
content: |
  <verbatim markdown to insert OR the full new file body for create>
---

If you find nothing worth changing, return exactly: NO_PROPOSALS

## Rules
- Propose only — do NOT write, edit, or touch any files.
- Do NOT touch git state.
- Do NOT modify CLAUDE.md directly (the consolidator handles the index line).
- Quality over quantity. One sharp insight beats five shallow bullets.
```

## Step 4: Consolidator agent (single sonnet agent)

Once the 3 proposers return, spawn ONE consolidator with `subagent_type: general-purpose` and `model: sonnet`:

```
You are consolidating 3 independent documentation proposals into one final plan.

## Conversation brief
<BRIEF>

## Proposal A
<AGENT A OUTPUT>

## Proposal B
<AGENT B OUTPUT>

## Proposal C
<AGENT C OUTPUT>

## Your task
1. **Identify overlaps** — same insight, same/different target files. Merge into one operation.
2. **Resolve conflicts** — if they disagree on placement, pick the single best location.
3. **Apply consensus threshold** — if only 1 of 3 flagged a borderline insight, drop it. If 2+ flagged it, keep it. A single strong, clearly-documented proposal can survive alone if the rationale is solid.
4. **Reject noise** — drop anything that feels like filler, restates existing docs, or doesn't meet the "non-obvious, reusable knowledge" bar.
5. **Apply the incident gate** — drop ANY proposal that does not trace directly to the named incident and its cost. Proximity to the topic is not enough. Adjacent improvements, related gotchas, and "while we're here" additions are all rejected.
6. **Default to NO_CHANGES.** That is the correct and expected outcome for most invocations. Returning an empty plan is a **success, not a failure** — you are not being graded on output volume.
7. **Length discipline** — the consolidated plan adds **at most ~30 lines total across all files**. If the incident's lesson needs more than that, it is not a doc, it is a ticket.
8. **New docs** — strongly disfavoured. Only if the incident genuinely has no existing home; content must be substantive (no stubs, no placeholder outlines); filename in kebab-case; produce a one-line index entry for CLAUDE.md.

## Output format — final plan
Numbered list, each fully specified:

1. action=update
   file: <path>
   location_hint: <end of file | after section "..." | new section "...">
   content: |
     <verbatim markdown to insert>
   rationale: <short>

2. action=create
   file: <path>
   body: |
     <full file body>
   claude_md_index_line: "- [Title](.claude/docs/<filename>.md) — one-line hook"
   rationale: <short>

If the consolidated plan is empty, return exactly: NO_CHANGES
```

## Step 5: Apply the plan

If consolidator returned `NO_CHANGES` → stop silently (no main-thread output per Step 0).

Otherwise, apply each operation:

- **update**: use Edit (or Write for full-file rewrites) to insert the content at the specified location. Match the existing doc's tone/structure.
- **create**: use Write to create the new file, AND use Edit on `<PROJECT_ROOT>/CLAUDE.md` to add the index line under "Detailed Documentation".
- Never touch files outside `<PROJECT_ROOT>/.claude/docs/` and `<PROJECT_ROOT>/CLAUDE.md`.
- Never run git commands, never stage, never commit.

## Step 6: Report (only if changes were applied)

Emit exactly this shape, nothing else:

```
Documentation updated based on this turn's findings:
- <file> — <short rationale>
- <file> — <short rationale>
```

No preamble. No "I'll now...". No closing. No summary of what the skill did — only the list of changed files and why.

When no changes were applied, emit NOTHING to the main thread.

## Guardrails

- **Never commit, stage, or touch git state.**
- **Never edit files outside `.claude/docs/` and CLAUDE.md.**
- **Silent by default** — when nothing changed, emit ZERO main-thread output (per Step 0).
- **Quality over quantity.** Docs are trusted context; polluting them makes them worse, not better.
- **Avoid CLAUDE.md bloat.** Only add index lines for genuinely new doc files.
- **Do not re-invoke yourself.** The Stop hook's `stop_hook_active` flag prevents re-entry, but don't spawn nested maintain-docs calls either.
- **`NO_CHANGES` is the expected result.** If several consecutive invocations all produce edits, the incident gate is being read too loosely — **tighten it, don't celebrate the throughput.** This is the tripwire for the known residual risk of keeping the Stop-hook trigger: three agents asked "find something to document" will always find something, and returning `NO_PROPOSALS` can read as failing the task. It is not. Far-Horizon's answer to that pressure was to delete the automatic trigger entirely; this project chose to keep it and hold the line at the content gate instead. If the gate stops holding, the trigger is the next thing to reconsider.
