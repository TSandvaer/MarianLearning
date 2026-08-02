# Handoff: setup MarianLearning suggests Far-Horizon could adopt

From: `c:\Trunk\PRIVATE\MarianLearning`
To: `c:\Trunk\PRIVATE\Far-Horizon`
Generated: 2026-08-02

Produced by the reverse leg of a `/project-alignment-analysis` run. The forward leg (FH → ML) adopted
14 candidates, most of them from FH's 2026-08-02 orchestration-doctrine rewrite — thank you for that
work; it transferred almost wholesale.

These two are the reverse: setup MarianLearning has that Far-Horizon appears to lack. Both are
optional — review and adopt selectively in Far-Horizon's own session, ideally via its own alignment
pass so nothing is taken blindly.

⚠ **One filter to apply first.** FH's current doctrine bans documentation without a paid-for incident
and forbids reviews/agents creating tickets. Candidate 1 below is a _documentation practice_ and
candidate 2 is a _command discipline_. Neither creates tickets, but candidate 1 does create recurring
documents — judge it against your incident gate before adopting. It may well fail that gate, and that
is a legitimate outcome.

## Candidates

### 0. ⚠ BUG in your `block-destructive-bash.sh` — `-i` makes `-D` match safe `-d` [hook fix]

**This one is not a suggestion — it is a defect in your live hook**, found by smoke-testing the copy
this pass imported from you. Listed first because it is currently blocking a routine operation in
Far-Horizon.

- **The bug:** the git-force-branch-delete check reads

  ```bash
  if printf '%s' "$cmd" | grep -Eqi 'git[^"]*[[:space:]]branch[^"]*[[:space:]]-D([[:space:]]|"|$)'; then
  ```

  `grep -Eqi` is **case-insensitive**, so the `-D` pattern also matches lowercase **`-d`**. But `-d`
  is the _safe_ delete — git refuses it on an unmerged branch — while `-D` is the force-delete the
  guard is actually for. Net effect: **`git branch -d feat/merged-branch` is denied**, so ordinary
  post-merge local branch cleanup gets blocked with a "never-auto-decide" reason that doesn't apply.

- **Evidence:** 15 crafted `PreToolUse` payloads piped to the script (nothing executed). Before the
  fix: 14/15, with `git branch -d feat/merged-branch` → `DENY` (expected `ALLOW`). After: 15/15.
  Every other pattern — force-push in both flag orders, `reset --hard`, `rm -rf`/`rm -fr`,
  `Remove-Item -Recurse`, `gh repo delete`, `git branch -D` — behaves correctly, and the
  quoted-span stripping correctly allows `git commit -m "explain why rm -rf is dangerous"` and
  `gh pr create --body "...git push --force..."`.
- **The fix (one character):** drop the `i` from that single check so it is case-sensitive. Leave the
  other checks' `-i` alone — they match flag _words_ (`--force`, `--hard`, `-recurse`) where case
  folding is harmless or wanted.

  ```bash
  # CASE-SENSITIVE on purpose (no -i): `-D` force-deletes an UNMERGED branch, but
  # lowercase `-d` is the SAFE merged-only delete that git refuses on unmerged work.
  if printf '%s' "$cmd" | grep -Eq 'git[^"]*[[:space:]]branch[^"]*[[:space:]]-D([[:space:]]|"|$)'; then
  ```

- **Note on your `permissions.deny` list:** `"Bash(git branch -D:*)"` there is fine — prefix-glob
  matching is case-sensitive, so only the hook regex needed changing.
- **Reusable smoke test:** the 15-payload script is at
  `<MarianLearning scratchpad>/smoke-destructive-hook.sh`. It builds payloads with `python -c json.dumps`
  and greps the hook's stdout for `"deny"`, so it is project-agnostic — point `HOOK` at your path and
  run it after any pattern change. Worth keeping under `tools/debug/` per your instrument-registry
  convention.

### 1. Post-wave retrospectives (`.claude/retros/`) [process / docs]

- **Why it might help Far-Horizon:** FH's doctrine rewrite was triggered by a failure that ran **ten
  days before anyone named it**, and FH's own CLAUDE.md says _"it took an independent audit to
  surface."_ A standing retro cadence is the cheap version of that audit — it surfaces drift while it
  is days old rather than weeks. FH added a _kill switch_ (a lagging, binary indicator: zero `feat` in
  a week). A retro is the leading, qualitative counterpart. MarianLearning has **14** of them covering
  waves 3–13, the voice-QA build-out, and an away-cleanup.
- **What to add:** a `team/retros/` directory (FH keeps process docs under `team/`, so that is the
  natural home rather than `.claude/`) plus one line in CLAUDE.md establishing the trigger.
- **Source (in MarianLearning):** `.claude/retros/` — e.g. `retro-2026-06-11-wave-10-math-pivot.md`
  (4,865 B), `retro-2026-06-14-away-cleanup.md` (3,848 B). They run 4–24 KB; the short ones are the
  more useful shape.
- **Trigger convention (from `[[feedback_retro_post_merge_convention]]`):** draft a retro once **≥3
  merged PRs cluster** into a recognisable wave. Not calendar-driven — cluster-driven.
- **Snippet — the CLAUDE.md line:**

  ```markdown
  ## Retrospectives

  Once **≥3 merged PRs cluster** into a recognisable wave, draft a retro at
  `team/retros/retro-YYYY-MM-DD-<slug>.md`: what shipped, what cost more than it should have, what the
  team would do differently. Keep it short — the 4-KB ones get read; the 24-KB ones do not.

  A retro is the _leading_ indicator that pairs with § Kill switch's lagging one: the kill switch tells
  you a drought already happened, a retro can catch the drift that causes it.
  ```

- **Honest caveat:** this is a recurring-document practice, and FH just removed several of those for
  good reason. If it cannot clear your incident gate, skip it — or adopt it as _manual-only, on the
  Sponsor's ask_, mirroring what you did to `maintain-docs`.

### 2. CI-status command discipline [claude.md rule]

- **Why it might help Far-Horizon:** FH gates merges on CI and runs a **single** serialized
  `unity-build` lane, so a misread "pending" is expensive — it burns polling cycles against a queue
  that is already the project's binding constraint. MarianLearning hit this concretely: `gh pr checks`
  caches a stale `pending` for **2+ hours** after the underlying run has completed. FH's CLAUDE.md has
  no equivalent rule, and its build-cap section already depends on operators reading runner/queue state
  correctly.
- **What to add:** one CLAUDE.md section. No tooling, no new files, no tickets.
- **Source (in MarianLearning):** `CLAUDE.md` § "CI-status command discipline" (itself imported from
  RandomGame 2026-06-11 — so this would be its third hop, which is some evidence it generalises).
- **Snippet — adapt the check names to FH's `build` / `capture` jobs:**

  ```markdown
  ## CI-status command discipline

  When checking "is CI green?" for a merge-gate decision, use
  `gh pr view <num> --json statusCheckRollup -q '.statusCheckRollup[] | {name, status, conclusion}'`
  OR `gh run view <run-id> --json status,conclusion` — both authoritative.

  Do NOT rely on `gh pr checks <num>` for merge decisions: it can cache "pending" for 2+ hours after
  the underlying run has completed, burning polling cycles.

  Sanity check: any "pending" > 30 min → drill in with the authoritative command before concluding
  "still waiting". When querying a just-pushed branch, query by HEAD SHA rather than
  `--branch --limit 1` (avoids the run-list race).

  Note: `statusCheckRollup` itself can cache `IN_PROGRESS` after the underlying run has already
  completed or failed. When a rollup entry looks stuck, ground truth is
  `gh run list --commit <full-40-char-sha>` — it must be the **full** 40-character SHA; a short SHA
  silently returns `[]`.
  ```

- **Fit note:** this composes with FH's existing "verify the live merge mechanism before acting; never
  assume a label name" bullet and with its § Unity-build-cap instruction to _re-measure before citing_.
  Same instinct — do not trust a cached or remembered signal — applied to the CI surface specifically.

## Considered and NOT proposed

- **`maintain-docs` as a Stop hook** — MarianLearning keeps it wired. Far-Horizon deliberately removed
  it and documented why. Not proposed; your removal is the better-evidenced position, and this pass
  imported your incident gate rather than the reverse.
- **`.claude/agents/dispatch-template.md` location** — ML keeps it under `.claude/agents/`, FH under
  `team/orchestrator/`. Different, not better.
- **`orchestration-concurrency.md`** — ML's empirical doc on why real concurrency diverges from target.
  FH covers the same ground more precisely in its CLAUDE.md build-cap section, which is grounded in
  measured runner state. Skip.
- **ML's `jessica` QA persona** — functionally equivalent to your `tess`.
