# Setup guide: AWAY-mode autonomy for an orchestrator

This guide enables AWAY-mode autonomy in an orchestration team. Under this policy, when `auto-status` is in `away` mode and the session is acting as an orchestrator, the orchestrator MAY auto-decide reversible actions with cited foundation — logging each decision to an audit file for user review on return. The user pre-approves the _kind_ of decision once (by adopting this rule); specific decisions are reviewed individually after the fact.

The setup is two files. No skills to install, no hooks, no extra dependencies. Audience for this guide: another orchestrator (Claude session) being asked to set up the same policy in its own environment.

## What problem this solves

Orchestrators routinely idle while waiting on user sign-off for decisions that have solid documented foundation (a memory entry, a doc section, a prior-session precedent). Those round-trips cost throughput, and many of them resolve exactly the way the orchestrator already recommended. This rule unblocks foundation-backed reversible decisions while preserving the user's gate on strategic, subjective, and irreversible calls.

Confidence-based autonomy ("I'm 99% sure of the answer") is explicitly REJECTED as the gate. The orchestrator's self-assessed confidence is a poor filter — it overweights cases where reasoning is internally clean and underweights cases where the user has real-world context the orchestrator lacks. Foundation-based autonomy is the correct gate: the decision must trace to a _specific_ memory entry, doc section, or stated prior-session precedent.

## Prerequisites

- The orchestration team uses the `auto-status` skill (or an equivalent) with distinct LOCAL and AWAY modes.
- User-level CLAUDE.md exists at the standard path (`~/.claude/CLAUDE.md`, or `C:/Users/<name>/.claude/CLAUDE.md` on Windows).
- Each project run by this orchestrator has a `.claude/` directory for tooling state.

## Step 1 — Append the AWAY-mode autonomy section to user-level CLAUDE.md

Place the section below in the user-level CLAUDE.md. This is global — every project under this user inherits it. Put it after the "Auto mode" section if one exists, otherwise at the end of the file.

```markdown
## AWAY-mode autonomy

When the `auto-status` skill is in **AWAY** mode AND the current session is acting as an orchestrator coordinating subagents, the orchestrator MAY auto-decide certain reversible actions without surfacing them to the user, provided all gates below hold. In **LOCAL** mode (or when not orchestrating), this rule does not apply — surface decisions to the user as normal.

**Rules:**

1. **Auto-decide ONLY when all four gates hold.** A decision may be made autonomously when:
   - **Reversible:** the action can be undone in ≤1 PR, with no irreversible side effects (no force-push, no external posts, no deletes of persisted data, no infrastructure changes).
   - **Foundation citable:** a specific source supports the decision in 1-2 sentences — a named memory entry, a project doc section with path, or a stated prior-session precedent. "I think this is obvious" or "based on context" is NOT a foundation. If the citation cannot be written down concretely, the decision is not foundation-backed.
   - **Not on the never-auto-decide list** (rule 2).
   - **Logged BEFORE execution** to `<project>/.claude/decisions-while-away.md` using the schema in rule 3. The log entry IS the audit record.

2. **Never auto-decide, regardless of mode:**
   - Strategic priority shifts — which tier ships next, scope cuts, pivots, sequence changes, deferrals of in-flight work.
   - Subjective-feel calls — visual polish, character voice, copy tone, motion feel, design aesthetic.
   - Externally-visible actions — Teams/Slack posts, force-push, force-reset, deletes, force-merge, anything sent to third parties.
   - Billing, credit usage, or infrastructure-config changes (Vercel, Azure, cloud accounts, secrets).
   - Anything where the only "foundation" is the orchestrator's own confidence.

3. **Decisions log schema** — each entry under heading `## YYYY-MM-DD HHMM UTC — <one-line headline>`:
   - **Decided:** what was done (concrete and specific)
   - **Foundation:** cited memory name / doc section + path / prior-session precedent reference
   - **Alternative:** what surfacing would have produced as the other option
   - **Reversibility:** how to undo + estimated effort
   - **Status:** `pending review` initially; user updates to `accepted` or `reversed by <user> <date>` on return.

4. **Composition with other modes:**
   - Does NOT override Auto mode rule 5 — destructive / shared-state actions ALWAYS require explicit confirmation, even in AWAY mode.
   - Does NOT override Plan mode — when Plan mode is active, plan-approval gate applies; AWAY autonomy only operates outside Plan mode.
   - Does NOT lower the "never fabricate, never guess" bar — foundation citations must be real and verifiable, not invented.

5. **Calibration target:** 5–10% user-reversal rate is healthy.
   - <5% (almost nothing reversed) → orchestrator is being too cautious; surface fewer items, auto-decide more.
   - > 15% (many items reversed) → foundation bar is too loose; raise the bar on what counts as foundation.
     > The user reviews `decisions-while-away.md` on return and marks each entry; tracking reversal rate is the feedback loop.

**Why:** Orchestration teams routinely idle while waiting on a user decision that has solid documented foundation. The user has stated they follow the orchestrator's recommended advice ~99% of the time, but those 1% of pushbacks tend to land on high-leverage cases where their real-world context differs from the orchestrator's — meaning confidence alone is a poor filter. Foundation-based autonomy is more rigorous: the orchestrator can only auto-decide when an existing memory entry, doc, or prior-session precedent grounds the choice, and the user has a per-decision audit trail to calibrate against. AWAY mode is the gating condition because LOCAL mode means the user is at the machine and round-trips are cheap.

**How to apply:** When in AWAY mode as an orchestrator and a decision arises, run the four gates in order BEFORE either executing or queueing for the user. Pass all four → write the decisions-log entry, then execute. Fail any gate → queue for the user as normal. Foundation citations must be specific (file path + section, or memory entry name); avoid vague references like "based on prior work" or "the codebase pattern". When in doubt, queue rather than auto-decide — the foundation bar is meant to be high.
```

If "Auto mode rule 5" or "Plan mode" don't exist in the receiving user-CLAUDE.md, the composition rules in §4 still make sense as guardrails — they describe behavior the orchestrator should observe even in the absence of those named sections.

## Step 2 — Create the per-project decisions log

In each project where AWAY-mode autonomy should be active, create `.claude/decisions-while-away.md` with this content:

```markdown
# Decisions while you were away

Each entry below is an autonomous decision the orchestrator made under AWAY-mode autonomy (see user-level CLAUDE.md → "AWAY-mode autonomy"). On return, review each entry and update its **Status** to `accepted` or `reversed by <name> <date>`.

**Calibration target:** 5–10% reversal rate is healthy. Below 5% means the orchestrator is being too cautious (raising fewer items than it could); above 15% means the foundation bar is too loose (auto-deciding things that should have been surfaced).

---

<!-- EXAMPLE — delete this block once real entries exist -->

## YYYY-MM-DD HHMM UTC — <one-line headline of the decision>

- **Decided:** <what the orchestrator did, concrete and specific>
- **Foundation:** <cited memory entry name | project doc section + path | prior-session precedent reference>
- **Alternative:** <what surfacing this would have produced as the alternative option>
- **Reversibility:** <how to undo, estimated effort — e.g. "1-line spec amendment, ~5 LOC">
- **Status:** pending review

---

<!-- Real entries below this line. Newest at top. -->
```

That is the entire per-project setup. No memory entry needed (CLAUDE.md is preloaded every session, so the rule is always in context). No additional skills, hooks, or configuration.

## Step 3 — Verify behavior

After both files exist:

1. Toggle `auto-status` to `away` mode and observe the next tick.
2. The orchestrator should:
   - Continue to surface strategic / subjective / irreversible decisions (no behavior change for those)
   - Auto-decide reversible items with foundation citation, writing each entry to `decisions-while-away.md` **before** executing the action
3. When the user returns, they review `decisions-while-away.md` and mark each entry's **Status** as `accepted` or `reversed by <name> <date>`.
4. Track reversal rate over the first ~20 decisions; tune the foundation bar if it's outside the 5–15% band.

## Composition with existing rules

- **Auto mode**: destructive / shared-state actions still require explicit confirmation regardless of AWAY autonomy. The AWAY rule does NOT widen what counts as "ordinary".
- **Plan mode**: when active, plan-approval gate applies normally. AWAY autonomy only operates outside Plan mode.
- **Never fabricate**: foundation citations must be real and verifiable. Inventing a citation is a strictly worse failure than not auto-deciding — never produce a plausible-looking citation to satisfy the gate.

## Replicating to a different account or machine

The user-level CLAUDE.md addition applies globally on the machine where it lives. To replicate on a different account or machine:

1. Copy the "AWAY-mode autonomy" section into that machine's user-level CLAUDE.md.
2. For each project on that machine where AWAY autonomy should be active, create `.claude/decisions-while-away.md` with the template above.

## Tuning notes

- The 5–10% reversal target is a starting heuristic, not a hard floor. The right number depends on how aligned the orchestrator's foundation citations are with the user's actual priorities.
- If reversals concentrate in one category (e.g. content sequencing, distractor design, dispatch density), tighten the foundation bar for _that category specifically_ — add a project memory rule that elevates those decisions out of "auto-decidable" scope.
- The audit log doubles as a teaching corpus for new memory rules: a pattern of similar auto-decided decisions is a candidate for a written, project-specific rule that codifies what's foundation-backed in that domain.

## Anti-patterns to avoid

- **Pattern-completing a citation.** "The pattern in this codebase is X" is not a citation. A citation names a file + section, a memory entry by slug, or a specific prior session.
- **Bundling decisions.** Each entry in the log covers one decision. Multiple unrelated calls bundled into one entry defeat per-decision calibration.
- **Logging after the fact.** The rule says log BEFORE execution. If the orchestrator catches itself about to act first and log later, that is a process bug — surface it to the user as a recovery action rather than back-filling.
- **Confidence creep.** Once a few decisions are accepted, it is tempting to lower the foundation bar. Resist. Track the reversal rate; if it climbs, raise the bar back, don't rationalize the trend.
