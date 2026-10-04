---
name: orca-wave
description: 'Autonomous parallel delivery for MarianLearning: the coordinator session picks dependency-free ClickUp tickets, starts one supervised Claude worker per ticket in its own new Orca workspace (Orca orchestration run + worker-start), each worker loops goal-loop-style until every acceptance criterion is verified, then opens a PR; the coordinator gates on CI + review, merges, flips ClickUp, and starts the next wave. Use for /orca-wave, run the next wave, work the board autonomously, parallel Orca workspaces.'
---

# orca-wave — supervised parallel delivery through Orca workspaces

The coordinator is the session that invoked this skill. Workers are Claude agents
that Orca starts in their own new top-level worktree (one Orca workspace per
ticket). Orca orchestration records ownership and tells the coordinator when each
worker is done. Read Orca's own guide once per session before the first command:
`orca skills get orchestration` (and only the reference a gate below names).

## Hard gates (never autonomous)

- **Release to production** (`yarn release`), Vercel/env changes, billing.
- **Creating tickets** (project rule: agents may only file bugs reproduced in the deployed PWA).
- **Taste gates:** any PR whose acceptance is Thomas's ear or eye (voice lines, Emma visuals,
  motion feel, first-of-class UI) merges only after Thomas's verdict. Stage it; never merge it.
- **Merge** only when machine-checkable: `fast-gate` AND `e2e` SUCCESS on the PR head
  (`gh pr view <n> --json statusCheckRollup`) AND a reviewer verdict `APPROVE`
  (docs-only / test-only PRs need no reviewer). Never `--admin` past a red check.
- Before an unattended run: keep-screens-alive must be `system` or `on` (ask; never arm silently).

## 0. Preflight (each wave)

```text
orca status --json                                   # runtime ready
git -C ~/DEV/MarianLearning fetch -q origin          # workers base on origin/main
```

Kill switch: `git log origin/main --since="7 days ago" --pretty=%s | grep -c "^feat"` must be > 0,
otherwise no workers (CLAUDE.md § Kill switch).

## 1. Pick the wave

From ClickUp list `901523003843`, take tickets in `to do` whose dependencies (named in the
ticket body as "Depends on N/M") are `complete`. Rank by value to Marian. Cap the wave at
**4 workers** (ElevenLabs Starter allows 3 concurrent TTS requests; port 4173 allows one
`yarn e2e` at a time — tell workers vitest-only unless they own e2e). Never put two
workers on the same files; if two tickets touch the same module, sequence them.

## 2. Start the wave

```text
orca orchestration run-create --objective "<wave: ticket list>" --json
orca orchestration worker-start --spec "<SPEC>" --worktree new-top-level \
  --repo id:1caeaf22-21fe-42c8-963c-7ac17ed9e752 --name <short-ticket-slug> \
  --agent claude --setup run --json
```

Start the whole wave before waiting. Record each Dispatch ID and the ticket it owns in
`team/STATE.md` (resume header) — dispatch IDs are the load-bearing identifiers. Flip each
ticket to `in progress` (a classifier denial on that flip is not a blocker; flip to
`in review` at PR-open instead).

### Worker SPEC template (self-contained; paste the ticket body in full)

```text
You are a supervised Orca worker on MarianLearning, ClickUp <ticket-id>: "<name>".
TICKET BODY (goal, acceptance criteria, out of scope):
<full ticket body>

TARGET / OWNERSHIP: you may edit only <files/areas>; do not touch <boundaries>.
READ FIRST (only these): <1-3 .claude/docs files from the CLAUDE.md routing table>.

STEP 0 (setup, once):
  git fetch origin && git checkout -b <role>/<ticket-id>-<slug> origin/main
  yarn install --prefer-offline
  ln -sf /Users/thjo/DEV/MarianLearning/.env.local .env.local   # only if the ticket renders audio
STEP 1 (goal-loop method, NO confirmation popup — the acceptance criteria are pre-approved):
  turn every acceptance criterion into a binary checklist item with a verification method;
  iterate (code -> test -> verify) until every item is ticked WITH evidence (test output,
  command output, file:line). Max 20 iterations; at 2 failed attempts on one item, build a
  diagnostic instead of guessing (unstick). For a real question use the preamble's `ask`
  command — never a local popup.
STEP 2 (ship): `npx vitest run` + `npx tsc -b --noEmit` green; commit (one commit per
  milestone, push early); `gh pr create --base main` with a body listing each criterion,
  its evidence, and what you did NOT test. Taste-gated work: add the Predict-Before-Soak
  prediction line.
STEP 3: send worker_done with --outcome succeeded|failed, a 3-sentence summary, the PR URL
  and --files-modified. Then stop.
RULES: never fabricate values; never merge, release, or create tickets; never sign with a
persona name.
```

## Validated by the pilot (2026-10-04)

Run `run_7b5e4c25954a`: a worker built ticket 3/10 end to end (PR #495, 31 new tests) in ~7 min,
and a reviewer worker in its own workspace posted an evidenced APPROVE. Learned:

- Workers open their own PR despite Orca's preamble line about not posting to GitHub — keep STEP 2.
- No repo setup hook exists (`setup.state: not_configured`); STEP 0's `yarn install` is required.
- `check --wait` output is multi-object JSON: redirect it raw to a file
  (`> tmp/orca-wait.jsonl`) and grep `"subject"|"body"|"deliveryId"`; piping into `json.load`
  crashed the first background wait.
- Heartbeats arrive as their own deliveries; ack each one or it replays ahead of `worker_done`.
- Always verify `worker_done` against GitHub (`gh pr view <n> --json headRefName,headRefOid,files`)
  before acking; then `worker-release`.

## 3. Supervise

```text
orca orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json
```

- **question** → answer from the plan/ticket/docs (`orchestration reply`); if it is a
  decision only Thomas can make, record it in `team/STATE.md` and ask Thomas.
- **worker_done** → verify against reality, not the summary: PR exists and its head branch
  matches (`gh pr view <n> --json headRefName,state`), commits are pushed, CI running.
  Then `worker-release` (or reuse the terminal for the review below).
- After 3 empty waits, `worker-list --run <run_id> --include-remote --json` and act only on
  its `nextAction` (Orca guide). Absence of news is never proof a worker died.
- Between waits, schedule a fallback wake (`ScheduleWakeup`, 1200 s) so the loop survives.

## 4. Review, merge, close

For each code PR start a reviewer worker (same `worker-start`, `--worktree current` on the
PR's workspace is not allowed — use `new-top-level` with `--name review-<pr>`) with spec:
"Review PR #<n> with /codereview; post exactly one verdict comment `## REVIEW VERDICT: APPROVE`
or `## REVIEW VERDICT: REQUEST_CHANGES` with file:line reasons; no tickets; then worker_done."
REQUEST_CHANGES → send the findings to the author worker (or a new worker) once; a second
REQUEST_CHANGES escalates to Thomas.
When the merge gate holds: `gh pr merge <n> --squash`, flip the ticket to `complete` with a
comment (PR URL, merge SHA), update `team/STATE.md`.

## 5. Next wave / stop

Recompute ready tickets and go to 1. Stop when nothing is ready, when every remaining ticket
is taste-gated or waiting on Thomas, or on the kill switch. A justified idle is a valid
outcome — say why. Final report to Thomas: per ticket, outcome + PR + evidence + blockers;
list what needs his ear/eye or a release.
