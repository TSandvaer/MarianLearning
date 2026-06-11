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

### Sub-agents — read the docs at start

**If you are a sub-agent spawned via the Agent tool, you do NOT inherit the SessionStart auto-load.** Before starting any work, Read every `.claude/docs/*.md` file (in parallel). These are the canonical project-context briefs the main session sees automatically; without them you are working blind on architecture, audio system, progress shape, planner contracts, screens, skill trees, and test-helper patterns. Sub-agents should also include a "Non-obvious findings" section in their final report so the main session can route insights into the docs via the maintain-docs Stop hook (see `feedback_dispatch_brief_template.md` memory for the brief template).

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

When checking "is CI green?" for a merge-gate decision, use `gh pr view <num> --json statusCheckRollup -q '.statusCheckRollup[] | {name, status, conclusion}'` OR `gh run view <run-id> --json status,conclusion` (both authoritative). Do NOT rely on `gh pr checks <num>` for merge decisions — it can cache "pending" for 2+ hours after the underlying run completes, burning polling cycles. Both the `fast-gate` and `e2e` checks must be SUCCESS before merge (`feedback_ci_fast_gate_split`). Sanity check: any "pending" > 30 min → drill in with the authoritative command before concluding "still waiting". When querying a just-pushed branch, query CI by HEAD SHA, not `--branch --limit 1` (avoids the run-list race).
