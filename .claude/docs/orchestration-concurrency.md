# Orchestration Concurrency — Constraints and Levers

Why practical concurrency stays at 1–2 agents despite a 3–5-in-flight target, and how to raise it.

---

## 1. Hard structural constraints

### 1.1 Cross-review consumes the reviewer's worktree

Every code/spec/test PR by Kevin, Devon, Kyle, or Jessica requires a mandatory cross-persona review before merge (per `dispatch-template.md` § "Cross-review verdict format"). The reviewer's single persistent worktree is occupied for the ~40–60 minutes a review takes. With two dev personas (Kevin + Devon) in a mutual cross-review loop, the practical ceiling is:

> **1 impl in flight + 1 review in flight = 2 dev personas fully occupied**

Adding tracks outside the Kevin↔Devon loop is how count reaches 3–5: Kyle (design/spec), Jessica (E2E), and Dave (directive/research) each own a separate worktree and are not bound by the Kevin↔Devon review pairing. Pre-staging their work in parallel raises concurrency without deepening the review bottleneck.

### 1.2 Playwright port 4173 — at most one e2e run across all worktrees

`playwright.config.ts` hard-pins port 4173 with `--strictPort`. Two concurrent `yarn e2e` runs (e.g. Jessica's spec dispatch + a reviewer running the full suite) race on the port. The second run silently reuses the first worktree's server; when that server exits, tests 4+ hit `ERR_CONNECTION_REFUSED`. Full failure mode documented in `testing-and-ci.md` §2.4.1.

**Dispatch implication:** at most one `yarn e2e` run (Jessica's spec dispatch OR a cross-reviewer running the full suite) across all worktrees simultaneously. Vitest is port-free and unaffected — multiple `yarn test` runs are safe in parallel.

### 1.3 GH Actions free-tier queue tail

The `e2e` job (35-min budget) can queue during high-PR-volume bursts. This is not a signal to throttle dispatch — fan out anyway and batch-merge in CI-completion order. The `fast-gate` job (~3–5 min) rarely queues.

---

## 2. Sponsor-gate throttle

Per memory `[[feedback_dispatch_density_vs_gate]]`: throttle to 1–2 threads when Thomas is the gate; fan out to 3–5 when CI is the gate.

Situations where the sponsor gate applies (1–2 threads is correct):

- **Audio payload or SSML text changes** — ear-test routes to Thomas (not Jessica) when utterance text or SSML payload changes.
- **Subjective UX or visual aesthetic** — Devon handles objective layout/numeric; Thomas handles subjective disagreement Devon can't resolve.
- **Strategic priority calls** — wave direction, scope cuts, sequencing: never-auto-decide class.
- **Real-Marian observation** — Marian is not yet using the app (memory `[[project_marian_not_using_yet]]`).

**Example — 13-day gap (PR #352 merged 2026-05-24 → PR #356 opened 2026-06-06):** the British-voice rollout required Thomas's ear-test against the full baked canon. The quiet window was correct sponsor-gate behavior, not orchestrator inertia. When the sponsor gate clears, ramp back to 3–5 immediately — do not coast at 1–2 out of habit.

**Example — Wave 10 / voice-QA (2026-06-11):** PRs #361–#364 opened within ~40 seconds (4 concurrent), confirming CI-gated dispatch density recovers quickly once the gate shifts from Thomas to CI.

---

## 3. Proven lever: Wave N+1 pre-staging

Wave 7 (2026-05-23) hit 6 simultaneously-open PRs (#322–#327) by staggering work across three rounds:

| Round | Tracks dispatched                                                                     |
| ----- | ------------------------------------------------------------------------------------- |
| 1     | Spec (Kyle) + directive (Dave) — read-only against shared state; all fire in parallel |
| 2     | Canon bake + E2E failing-first (Kevin/Devon + Jessica)                                |
| 3     | Parser/screen render + cross-review cascades (Kevin/Devon)                            |

The key: round 1 dispatches (spec + directive) are read-only against shared state, so all 5–6 tracks can fire in parallel. Without pre-staging, the effective concurrency is 1 until the first review fires.

The Wave 7 retro records: "All 6 personas had work in flight simultaneously at peak." (`.claude/retros/retro-2026-05-23-wave-7-literacy-bookend-shipped.md`, line 149, "Do not regress" section.)

**Type-dependency chains** (where PR B must consume PR A's new types) cannot be trivially parallelized. Two options:

- **Pattern A (recommended):** sequence — dispatch the type-author first, merge, then dispatch consumers. One merge-cycle of latency; no vocabulary divergence by construction.
- **Pattern B:** parallel with a named-vocabulary contract (exact type name, union alias, type-guard function name, discriminator value, export site). See user-global `CLAUDE.md` vocabulary-contract discipline. Only use when the orchestrator has high confidence about all names upfront.

---

## 4. When serial is correct

Wave 9 (PRs #357–#359, 2026-06-07, retro 2026-06-08) ran strictly serial by design. The `letterSoundsVowelStates` chain had a hard linear dependency: W9.2 (progress shape) → W9.3 (mastery rule) → W9.4 (planner gate) → W9.5 (E2E flip). Branching each ticket off post-merge `origin/main` (rather than against unmerged siblings) sidestepped the predicted `types.ts`/`guards.ts` conflicts entirely — the conflict-surface table in the plan over-predicted because serial merge order eliminated the overlap. Serial is correct inside a linear dependency chain; low concurrency here was not an orchestration failure.

---

## 5. Quick decision guide

| Situation                                              | Correct density                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Thomas is the gate (ear-test, subjective UX, strategy) | 1–2 threads                                                                 |
| CI is the gate, independent tracks                     | Pre-stage round 1; fan out to 5–6                                           |
| Type-dependency chain (PR B consumes PR A's new types) | Serial (Pattern A) or named-vocabulary contract (Pattern B)                 |
| Both devs have impl PRs in review                      | Dispatch Kyle / Jessica / Dave track — they're outside the Kevin↔Devon loop |
| Jessica running `yarn e2e`                             | Do not dispatch another `yarn e2e` run (port 4173); vitest runs are safe    |
| Sponsor gate just cleared                              | Ramp back to 3–5 immediately — do not coast at 1–2                          |

---

## 6. Empirical PR concurrency record

| Wave / batch         | PRs       | Date                  | Peak concurrent | Notes                                                                           |
| -------------------- | --------- | --------------------- | --------------- | ------------------------------------------------------------------------------- |
| Wave 7               | #322–#327 | 2026-05-23            | 6               | Pre-staged spec + directive + canon + E2E + parser/screen across all 6 personas |
| Post-Wave-7 cleanup  | #347–#351 | 2026-05-24            | 5               | Short-duration design/fix PRs; not a numbered wave round                        |
| Wave 10 / voice-QA   | #361–#364 | 2026-06-11            | 4               | Opened within ~40 seconds; CI-gated dispatch                                    |
| British-voice window | #352→#356 | 2026-05-24–2026-06-06 | 1–2             | Sponsor-gated (ear-test); 13-day gap correct                                    |
| Wave 9               | #357–#359 | 2026-06-07            | 1 (serial)      | Linear dependency chain; serial by design                                       |
