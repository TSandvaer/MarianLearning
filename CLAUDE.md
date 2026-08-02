# Marian Tutor App

Adaptive learning PWA for **Marian** (age 8) with an original character **Emma** (young manhwa/webtoon-style female teacher).
Goal: 3rd-grade math readiness + basic English literacy by August 2026 (~3-4 months).

## Context

- **Child:** Marian, age 8. Speaks Tagalog (primary) + some English. Starting Danish school August 2026.
- **Character:** Emma — original manhwa/webtoon-style young female teacher (renamed 2026-04-28 from "Melody" to drop Sanrio IP). Voice: `en-US-EmmaMultilingualNeural`. Phase 3a (audio + name) shipped 2026-04-28; Phase 3b (visual migration) shipped 2026-04-29 in PR #104. The character pivot is functionally complete — every screen consumes `emma-*.svg`. Documentation closeout in PR #121 (2026-05-02). Polish backlog tracks the PNG-in-SVG → vector re-trace and the unwired rotateZ tilt + breathing loop separately.
- **Device:** iPad (PWA, home-screen install)
- **Language policy:** Strict English-only in the app
- **Build timeline:** 4-6 weeks part-time (evenings + weekends)

## Architecture

**"Claude is the brain, not the mouth"** — minimize API calls per session:

1. One Claude call at **session start** — returns full session plan as JSON (8 problems, pre-written chatter, pre-canned explanations)
2. One Claude call on **real stumbles** — when pre-canned explanation didn't land, Claude writes a fresh explanation
3. One Claude call at **session end** — updates progress model

Use Haiku for session generation, Sonnet for stumble explanations.

## Two skill trees

**Number Garden (math):**
Number recog -> add to 10 -> add to 20 -> subtract to 10 -> subtract to 20 -> 2-digit +/- -> skip counting -> x2/x5/x10 -> x3/x4 -> x6-9

**Word Song (literacy):**
Letter names -> letter sounds -> blending (CV) -> CVC words -> digraphs (sh/ch/th) -> sight words -> simple sentences

## Marian's current levels (from April 2026 diagnostic)

| Skill            | Level                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Addition         | Sums to 10, drive automaticity (100% finger reliance)                                                       |
| Subtraction      | Within 15 confident, extend to 20 no-borrow                                                                 |
| Multiplication   | Repeated addition concept, no x symbol                                                                      |
| Alphabet         | Mastered (minor b/d confusion)                                                                              |
| Consonant sounds | Mastered                                                                                                    |
| Short vowels     | Short _a_ mastered; teach o -> u -> i -> e (per Dave's `phonics-sequence-marian.md` §Q1, locked 2026-04-26) |
| Blending         | CV confident, push CVC                                                                                      |
| CVC reading      | Emerging; pair every word with picture for vocab                                                            |
| Sight words      | Not tested; introduce gradually                                                                             |

## Tech stack (planned)

- React + Vite + Tailwind
- Framer Motion for animations
- Web Speech API (TTS) for Emma to read problems aloud (NOTE: actual implementation is Azure Speech REST, not Web Speech — see `design/audio-architecture.md`. This bullet predates the architecture pivot and is kept here only as historical context; the canonical voice is `en-US-EmmaMultilingualNeural` rate `-10%`.)
- Howler.js for sound effects
- Claude API via Cloudflare Worker / Vercel Function (never from browser)
- Progress stored in localStorage (no database)
- Deploy: Vercel with shared-secret URL

## Design principles

- Audio-first: Emma speaks every instruction via TTS. Text mirrors speech for passive reading exposure.
- Icons and numbers do heavy lifting. Minimal reading required.
- Emma's vocabulary capped to ~200 core English words + target phonics words.
- No English word problems until reading catches up.
- Short sessions (10-15 min), strong gamification (stardust, streaks, unlocks).
- Concrete -> visual -> abstract progression.
- Spaced repetition on math facts (Leitner box), not random drill.
- Never a red X — Emma reacts in character (head-tilt-and-smile on correct, head-tilt + hand-on-chin on puzzled). The principle — never a red X, react in character — is invariant.

## Key reference

- Full investigation and analysis: `build a tutor AI app with investigation and analysis.md`
- Paper practice plan PDF: `C:\Users\538252\Documents\marian-practice\marian-practice.pdf`

## Detailed Documentation

**Always read the relevant `.claude/docs/` files at the start of a task when the work touches that area.** These docs contain essential architectural context that is not repeated elsewhere — they are auto-loaded into context at session start via `.claude/hooks/session-start-read-docs.sh`, so you typically do not need to Read them manually.

The `maintain-docs` skill (auto-triggered after every turn via the Stop hook) reviews each turn for non-obvious findings worth capturing here, and updates this index when new doc files are created. Most turns produce nothing doc-worthy; the early-exit filter is high.

### Sub-agents — read the SCOPED docs at start

**If you are a sub-agent spawned via the Agent tool, you do NOT inherit the SessionStart auto-load.** The former blanket rule ("Read every `.claude/docs/*.md` before any work") is **retired** — this doc set is ~704 KB across ten files, and loading all of it on every dispatch, including trivial ones, is paid for in context on tasks that never touch most of it. (Imported from Far-Horizon 2026-08-02, which retired the same rule after ~1,855 lines of per-dispatch context was paid in full by ~13 agents that died mid-task in a single week.)

**Dispatch briefs NAME the 1–3 docs the task class requires.** Reading a doc outside your list is fine when you have a reason; reading all of them by default is not. Routing table:

| Task class                                               | Read before starting                                      |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Audio / voice / TTS / canon bake / SSML                  | `audio-system.md`, `planner-and-canon.md`                 |
| Content tier / skill node / word pack / distractors      | `skill-trees-and-content.md`, `sibling-tier-checklist.md` |
| Screen / UI / route / flow change                        | `screens-and-flows.md`, `architecture-overview.md`        |
| Emma visual / pose / animation                           | `emma-character-and-animation.md`                         |
| Progress / mastery / focus-node / Leitner / persistence  | `progress-and-persistence.md`                             |
| Planner / `/api/claude` / parser contract / rate limiter | `planner-and-canon.md`                                    |
| Test authoring / E2E / CI gates                          | `testing-and-ci.md`                                       |
| Orchestration / dispatch concurrency                     | `orchestration-concurrency.md`                            |

If your brief names no docs and the task is non-trivial, ask the orchestrator which apply rather than defaulting to all of them.

Sub-agents should still include a "Non-obvious findings" section in their final report (see `feedback_dispatch_brief_template.md` memory for the brief template) — but note that findings now clear the incident gate (§ Documentation requires a paid-for incident) before they become docs.

For deep-dive reference, see the topic files in `.claude/docs/`:

<!-- Index entries are added below as docs land. Format: `- [Title](.claude/docs/<filename>.md) — one-line hook` -->

- [Architecture Overview](.claude/docs/architecture-overview.md) — top-level shape: entry points, route state machine, App-level providers, first-launch vs returning-user branches, dependency stack, build pipeline
- [Screens and Flows](.claude/docs/screens-and-flows.md) — per-screen reference: Splash, Greet, Hub (path-strip + suggestion + celebration), Math, WordSong, SessionEnd, ParentSettings, debug seeds
- [Audio System](.claude/docs/audio-system.md) — runtime audio: Howler + gesture-unlock, three MP3 sources, iOS interrupted/suspended recovery, per-screen Path A wiring
- [Planner & Canon](.claude/docs/planner-and-canon.md) — Vercel serverless backend: `/api/claude` handler, Haiku planner, Azure TTS render pipeline, build-time canon prebake, rate limiter, Anthropic billing surface
- [Progress & Persistence](.claude/docs/progress-and-persistence.md) — Progress doc model, localStorage adapter, type guards, M3 mastery rule, focus-node picker, Leitner box, parent settings, debug seeds
- [Skill Trees & Content](.claude/docs/skill-trees-and-content.md) — Number Garden + Word Song node taxonomies, math/word distractors, word packs (FORBIDDEN_PAIRS, TARGET_PAIRINGS), server-plan adapters, picture-pack pipeline, Hub stage taxonomy
- [Sibling-tier widening checklist](.claude/docs/sibling-tier-checklist.md) — 14-16 places that must change when adding a new SkillNode sibling tier; extracted from PR #211 audit
- [Emma — Character & Animation](.claude/docs/emma-character-and-animation.md) — Emma SVG asset set, EmmaPose state machine, Hub idle ↔ celebration unified AnimatePresence, speech-ribbon caption walk, "never a red X" principle
- [Testing & CI](.claude/docs/testing-and-ci.md) — Vitest + Playwright patterns, e2e helpers (seedStorage, mockClaude, forceHowlerUnlock), canon-aware testing, CI workflows, gh pr merge 504 quirk
- [Orchestration Concurrency](.claude/docs/orchestration-concurrency.md) — why practical concurrency diverges from the 3–5-in-flight target; structural constraints (cross-review worktree, port 4173), sponsor-gate throttle, Wave N+1 pre-staging lever, empirical PR concurrency record

## Never fabricate, never guess, never extrapolate (sub-agent inheritance surface)

Sub-agents spawned via the Agent tool do NOT inherit user-global `~/.claude/CLAUDE.md`. This project-level rule is the inheritance surface; `.claude/agents/dispatch-template.md` enumerates the cite-able-evidence shapes. Concrete values — URLs, IDs, SHAs, file paths, command output, ClickUp ticket / GitHub run IDs, file:line refs — must be fetched from a real source, never invented or pattern-extrapolated from siblings.

- **No pattern extrapolation.** Vercel preview URLs, deployment slugs, generated IDs, hashes, ticket IDs, SHAs are NOT predictable from siblings — the suffix is generated; you cannot know it without fetching. Pattern-completion ("the slug probably follows X-Y-Z") is the exact failure mode this rule prevents.
- **Fetch, don't guess.** PR URL: `gh pr view <num> --json url -q .url`. Vercel preview URL: scrape the PR comment — `gh pr view <num> --json comments -q '.comments[].body' | grep -oE 'https://[^ )]+vercel\.app[^ )]*'`. ClickUp ticket state: `mcp__clickup__get_task_details` (orchestrator / Matt-side; dev personas lack the MCP tool — route status moves through the orchestrator). SHA: `git log -1 --format=%H` or `git rev-parse <ref>`. File:line: `grep -n <pattern> <file>` on the live file in your worktree. If you cannot fetch right now, say so explicitly — never emit a plausible-looking placeholder.
- **The creating turn is never the referencing turn.** Never batch a producer call (create_task, Agent dispatch, `gh pr create`, `git commit`) in the SAME message as a consumer that writes the produced value (status flip, STATE-doc edit, PR comment). Issue the producer, wait for its result, then reference the real value in a later message. If you must write a value you have not seen in a tool result this turn, write the literal token `<pending>` — never a real-looking ID/SHA/URL.
- **Observed-symptom claims need a real source in the same paragraph.** PR bodies, Self-Test Reports, ClickUp comments, and any persistent artifact: every concrete value (run-id, file path, SHA, command-output snippet, error text) must be quoted from a verifiable source you just generated. "Output was Y" / "Concrete instance: <value>" reads as observed reality and creates false evidence if invented.
- **Label hypotheses explicitly.** If a symptom is inferred / predicted / not directly observed, prefix it: `Hypothesis:`, `Likely:`, `Predicted symptom (verify before patching):`, or `Speculative — no source yet`. A future reader (often a sub-agent dispatched against the ticket) cannot distinguish your observation from your invention if you don't mark which is which.
- **STOP-and-verify signal phrases.** "Should be at…", "probably…", "lives in…", "is the same as…" used without a concrete check = STOP and verify before stating the value. This extends beyond concrete values to claims about state (where a file lives, whether two things are the same).

## CI-status command discipline

When checking "is CI green?" for a merge-gate decision, use `gh pr view <num> --json statusCheckRollup -q '.statusCheckRollup[] | {name, status, conclusion}'` OR `gh run view <run-id> --json status,conclusion` (both authoritative). Do NOT rely on `gh pr checks <num>` for merge decisions — it can cache "pending" for 2+ hours after the underlying run completes, burning polling cycles. Both the `fast-gate` and `e2e` checks must be SUCCESS before merge (`feedback_ci_fast_gate_split`). Sanity check: any "pending" > 30 min → drill in with the authoritative command before concluding "still waiting". When querying a just-pushed branch, query CI by HEAD SHA, not `--branch --limit 1` (avoids the run-list race). Note: `statusCheckRollup` itself can cache `IN_PROGRESS` after the underlying run has already completed/failed — when a rollup entry looks stuck, ground truth is `gh run list --commit <full-40-char-sha>` (must be the FULL sha; a short sha silently returns `[]`). (Imported from RandomGame 2026-06-11.)

---

<!--
Orchestration doctrine imported from Far-Horizon 2026-08-02
(`.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md`).

Provenance: FH rewrote its doctrine after measuring 79 commits since its last `feat` — 47 docs,
12 chore, 10 fix, 8 test, 1 spike, 1 ci, ZERO feat. Its diagnosis: a DEMAND engine (an anti-idle
hook forbidding a tick to end without dispatching) feeding on SUPPLY engines (auto-docs, NITs
tickets, agent-created tickets) that manufacture work from work. The sections below are the
countermeasures. FH's anti-idle hook is deliberately NOT imported — it is the demand engine.
-->

## Idle is free; an unjustified dispatch is the bug

Rank the dispatchable set by **user-visible value** — value to Marian in the deployed app — never by readiness. A bug in the shipped PWA outranks every doc ticket. **Prefer leaving a slot idle to manufacturing work.**

Still scan the **whole** board so you never wrongly conclude "all gated" — but having scanned, dispatch only what earns its cost. Drain-complete is a legitimate resting state, not a failure to be papered over with regenerated backlog.

## Reviews may NEVER create a ticket

`APPROVE_WITH_NITS` is **deleted**. There are two verdicts:

- **`APPROVE`** — merge.
- **`REQUEST_CHANGES`** — fixed **in this PR**; the reviewer re-checks the diff **once**, then done.

Nits are fixed now or dropped. Dropping them is an accepted cost. A would-be third round escalates to Thomas with the ship-with-documented-defect option rather than spawning another round.

**Docs-only and test-only PRs get NO reviewer** — CI green, merge. **Code PRs get one reviewer, one round.**

This supersedes, for this project, the user-global auto-decide class "NITs-ticket-creation from APPROVE_WITH_NITS review comments" — that class has no subject any more, because the verdict it keys on no longer exists. Peer-review _routing_ (`feedback_pr_review_routing`) is unaffected; only the verdict vocabulary changes.

## Agents may not create tickets

Agents may file a ticket **only** for a bug **reproduced in the deployed PWA** (or in a PR preview build). Every other ticket — features, refactors, research, hygiene, follow-ups — needs Thomas's yes first.

An unbounded ticket source plus any board scan guarantees the team never runs out of non-user-visible work. Combined with § Reviews may NEVER create a ticket, this closes both agent-side supply engines.

## Documentation requires a paid-for incident

A `.claude/docs/` entry may be written only by naming **the incident it would have prevented and what that incident cost** — a wasted rebuild, an overturned ear-test, a dead agent-hour, a wrong merge, a re-bake. Write it in this shape before proposing anything:

> **Incident:** &lt;what broke, cited&gt; — **Cost:** &lt;what was actually spent&gt;

No named incident with a cost → **no doc**. "Useful", "non-obvious", and "future Claude would benefit" are **not incidents** — that bar was already written down here and it did not hold.

**Corollary:** the docs are not a growth surface. Prefer amending an existing doc over creating a new one; a new file needs its own incident. `NO_CHANGES` is the expected outcome of most `maintain-docs` runs, and is a success rather than a failure.

## Predict-Before-Soak + bounded convergence

Any PR whose acceptance is **Thomas's ear or eye** (voice/audio renders, Emma visuals, motion feel, first-of-class UI) carries two extra lines in its Self-Test Report:

- **Prediction (falsifiable, written BEFORE the soak):** what you expect Thomas to hear or see, specific enough to be wrong. "Sounds good" is not a prediction; "the /v/ in _van_ will hold ~180 ms and will NOT buzz like the isolated /ʋ/" is.
- **Bounded convergence claim:** name the bar you tested **and the bars you did NOT test**. Silence about an untested surface reads as coverage; say what you left alone.

After the soak, grade the prediction against the verdict. A wrong prediction is useful signal, not a failure — an ungraded one wastes the round. Predictions are strongest when made against a _confirmed_ bar from `.claude/quality-bars.md` (maintained by the `/name-the-bar` skill).

## Kill switch (automatic — not a judgement call)

**Any calendar week with zero `feat` merges retires the standing team.** Check:

```
git log origin/main --since="7 days ago" --pretty=%s | grep -c "^feat"
```

`0` → collapse to a single hands-on session + an on-demand QA agent, and stop dispatching personas. No debate, no appeal. This exists because a drought is invisible from inside it — Far-Horizon's ran ten days before anyone named it, and it took an independent audit to surface.

## Coordination docs stay small

`team/STATE.md` is a **resume header, not a log**. `team/DECISIONS.md` is **append-only history**. Historical `.claude/away-queue.md` and `.claude/decisions-while-away.md` content is archived under `.claude/log/` — do not grow the live files back into logs. If a live coordination file passes ~10 KB, archive the closed entries rather than letting it accrete.
