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
- **The fix (one character):** drop the `i` from that single check so it is case-sensitive.

  ```bash
  # CASE-SENSITIVE on purpose (no -i): `-D` force-deletes an UNMERGED branch, but
  # lowercase `-d` is the SAFE merged-only delete that git refuses on unmerged work.
  if printf '%s' "$cmd" | grep -Eq 'git[^"]*[[:space:]]branch[^"]*[[:space:]]-D([[:space:]]|"|$)'; then
  ```

- **Note on your `permissions.deny` list:** `"Bash(git branch -D:*)"` there is fine — prefix-glob
  matching is case-sensitive, so only the hook regex needed changing.

> ⚠ **CORRECTION (appended after a SECOND instance surfaced).** This bullet originally said _"Leave
> the other checks' `-i` alone — they match flag words where case folding is harmless."_ **That advice
> was wrong.** See bug 2 immediately below: the force-push check's `-i` is the same defect, and it bit
> in production hours later. If you already applied the fix above and stopped there, come back.

### 0b. ⚠ SECOND BUG, same class — `-i` makes the force-push check match `-F` [hook fix]

Found the hard way after the first fix shipped: the guard denied an ordinary
`git commit -q -F - && git push -q origin main`.

- **The bug:** the force-push check reads

  ```bash
  if printf '%s' "$cmd" | grep -Eqi 'git[^"]*[[:space:]]push([[:space:]]|"|$)' \
     && printf '%s' "$cmd" | grep -Eqi -- '(--force-with-lease|--force-if-includes|--force|(^|[[:space:]])-[a-zA-Z]*f([[:space:]]|"|$))'; then
  ```

  The `-i` on the **second** grep makes `-[a-zA-Z]*f` match uppercase **`-F`** — which is
  `git commit --file` (read the commit message from a file), nothing to do with force. And because
  the hook inspects the **whole compound command as one string**, a `-F` anywhere plus a `git push`
  anywhere satisfies both conditions. So a completely ordinary
  `git commit -F msg.txt && git push origin main` is denied as a force-push. Anyone who writes commit
  messages via heredoc or `-F -` will hit this constantly.

- **The fix:** drop the `i` from the **flag** grep (keep it on the `git … push` grep, which matches a
  subcommand word, not a flag). Git's force flags are lowercase.

  ```bash
  # The FLAG check is CASE-SENSITIVE (no -i): git's force flags are lowercase
  # (`--force`, `-f`); uppercase `-F` is `git commit --file`. With -i, and because
  # this hook sees the WHOLE compound command as one string, an ordinary
  # `git commit -F - && git push origin main` tripped BOTH conditions.
  if printf '%s' "$cmd" | grep -Eqi 'git[^"]*[[:space:]]push([[:space:]]|"|$)' \
     && printf '%s' "$cmd" | grep -Eq -- '(--force([[:space:]]|"|$)|(^|[[:space:]])-[a-zA-Z]*f([[:space:]]|"|$))'; then
  ```

- **The pattern worth internalising:** two defects, one root cause — **a case-insensitive grep folding
  a benign flag into a destructive one.** Audit every `-i` in that file and ask "is there an
  opposite-case flag that means something harmless?" `-d`/`-D` and `-f`/`-F` both had one.
- **Related design smell (not fixed, flagged):** matching the whole compound command means any
  destructive-looking flag anywhere co-occurring with a destructive verb anywhere trips the guard.
  Both bugs were amplified by it. Scoping each check to its own command segment would be the real fix;
  we didn't attempt it.

- **Separate, optional — narrowing to the lease-based family.** The `--force` alternative in the
  regex above deliberately requires a trailing space/quote/end so it does **not** substring-match
  `--force-with-lease` / `--force-if-includes`. That is a **policy choice we made**, not a bug fix:
  those flags refuse the push if the remote moved, so they cannot silently clobber — which is the harm
  the check exists to prevent. We narrowed after the guard blocked a legitimate rebase recovery on our
  own PR. **Your call whether to match it** — if your flow is `gh pr merge --admin --squash` with few
  rebases, you may not need it. If you keep all-force denied, restore the
  `--force-with-lease|--force-if-includes|--force` alternation but still drop the `-i`.

- **Reusable smoke test (now 20 cases):** at `scripts/smoke-destructive-hook.sh` in the MarianLearning
  repo. Builds payloads with `python -c json.dumps`, greps the hook's stdout for `"deny"`, exits
  non-zero on any mismatch — project-agnostic, just point `HOOK` at your path. It caught bug 1 before
  it shipped and now carries explicit regression cases for both. **Both defects were in the
  false-positive direction, and a deny-only test suite would have found neither** — the allow cases
  are the ones that earn their keep here. Worth a `tools/debug/` registry entry on your side.

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

### 3. Data point on YOUR maintain-docs decision — the content gate may be doing the work alone [feedback, not a proposal]

Not something to adopt — **evidence about a call you already made**, from the one place that ran the other arm of the experiment.

You concluded the _automatic trigger_ was the problem and made `maintain-docs` manual-only, with _"never re-register this skill as a Stop hook."_ We adopted your **incident gate** but deliberately **kept the Stop hook**, to see whether the content bar alone holds against the firing pressure.

**Result over the landing session — a long, dense one (a doctrine adoption, a PR, a rebase, two hook bugs found and fixed): 4 invocations, 4 × `NO_CHANGES`, zero docs written.**

Each refusal was for a defensible reason, and the interesting part is _which_ reasons did the work:

- Twice the candidate was a **near-miss** — a bug caught by a smoke test before it cost anything. Real defect, zero cost, so no incident.
- Twice the lesson was **already recorded closer to the point of use** — in the hook's own comments and in an executable regression test — so a `.claude/docs/` copy would have sat further from whoever needs it.

**The tentative read: the incident gate, not the manual trigger, is the load-bearing half.** Deleting _"how could the documentation be improved?"_ from the proposer prompt looks like the single highest-leverage edit — that question always has an answer, and it is the one that manufactures docs.

Caveats, stated plainly: this is **one session on a different project**, our doc set is ~704 KB where yours is different, and 4 samples is not a finding. It is also possible we've simply over-tightened — the skill's tripwire only warns about the _opposite_ failure (consecutive runs all producing edits), so a gate that has silently gone too strict would look exactly like this. **We're watching for that.** If your manual-only setup is working, there's no reason to change it; this is offered as the other arm's data, not a recommendation.

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
