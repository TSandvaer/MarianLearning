# Session Handoff — 2026-04-25 night

Supersedes `SESSION-STATE-2026-04-25-evening.md`. Read this one first.

Session ended because Thomas hit his Anthropic quota mid-flight. Two background agents (Kyle, Kevin) were running when the session stopped — their state is unknown; treat them as terminated and re-probe before re-dispatching.

---

## What this session did

1. **Re-probed nested-Agent at Machine env-var scope** (the next-thing-to-try from the evening handoff). Result: ❌ still blocked. Matt's exposed tools unchanged — no `Agent` / `Task`. **All three env-var scopes (project / User / Machine) now ruled out.** The experimental flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is inert in this Claude Code build regardless of where it's set. Probe history captured in `memory/project_orchestration.md`.

2. **Evaluated and rejected `gruckion/nested-subagent` plugin** (Thomas surfaced it). Spawns isolated `claude -p` subprocesses per nested call. Rejected: 19 stars, 3.5 months quiet, no `subagent_type` mapping, materially higher token cost (cold-start per spawn), third-party trust + maintenance risk for an architectural-elegance gain. Top-level fan-out is the **permanent** topology for this project.

3. **Updated `.claude/agents/TEAM.md`** to formalise top-level fan-out as the documented model (was framed as "while nested-Agent is blocked"). Roster, topology diagram, bullets, task lifecycle, prerequisites, and "Invoking the team" section all aligned. The experimental flag entry now marked `[~]` with the inert verdict.

4. **Merged PR #9** — Kyle's Screen 4 audio + button gating tweaks. Squash commit `e10097a7` on `main`. Remote branch + local worktree deleted; `git fetch --prune` cleaned up other stale refs. No ClickUp ticket was associated with PR #9 (it was a doc-only follow-up to Dave's audit).

5. **Planned Week 2** via Matt. Decisions Thomas approved:
   - **Skip Dave** for this slice — Screen 2 is single-CTA, no chunking risk.
   - **No separate Hub screen** — "Hub" in the evening handoff was loose wording for Greet (Screen 2). App architecture (session = pre-planned Claude bundle) has no menu slot. The "what does launch #5 look like" question parked as a future Kyle ticket.

6. **Created / updated ClickUp tickets** via Matt:
   - **A — `86c9gnhde`** — `feat(splash): Screen 1 launch splash with logo + pulsing dots`. Persona-owner: Devon. High. Tag `week-2`.
   - **B — `86c9gnhez`** — `feat(greet): Screen 2 Meet Melody with TTS captions and heart CTA`. Persona-owner: Devon (Kevin reviews). High. Tag `week-2`. Depends on A and on `86c9gna8e`.
   - **C — `86c9gna8e`** (existing) — bumped low → high; persona-owner Kevin; comment posted requesting Safari `onstart` fallback + TDD; tag `week-2`.
   - **D — `86c9gnhgf`** — `design: returning-user start screen (launch #5+ UX)`. Persona-owner: Kyle. Low. Tag `future`. Parked.
   - **E — `86c9gkm42`** (existing, Kyle's session-1 asset bundle) — bumped normal → high; comment posted with the minimum bundle list and "logo-first" sequencing note.

   **Assignee flag:** Devon/Kevin/Kyle aren't ClickUp workspace members (Thomas is the only human). Pattern is: ClickUp `assignee` left blank, persona-owner named in description. This is the established pattern, not a bug.

7. **Dispatched Kyle and Kevin in background** (may have been killed at quota):
   - **Kyle** — asset bundle (`86c9gkm42`), logo-first so Devon isn't blocked. Branch should be `chore/86c9gkm42-session1-assets`. Bundle: `melody-logo.svg`, `melody-idle.png` (or .svg), `melody-happy.png` (or .svg), `bg-clouds.svg`, `heart-button.svg`, `sfx-chime-soft.mp3`. PNGs and the MP3 may be flagged as `assets-todo.md` entries Thomas needs to source (no Sanrio license; we ship original pink-bunny illustrations only).
   - **Kevin** — TTS boundary hook (`86c9gna8e`). Branch should be `feat/86c9gna8e-tts-boundary-hook`. TDD; Safari `onstart` fallback when `onboundary` doesn't fire within ~250ms; coverage target ≥70%.

   **Devon was NOT dispatched** — queued for Splash once Kyle pushes the logo, then Greet once Splash + boundary hook are merged.

---

## What this session did (continued — post quota-reset)

After Thomas's quota reset, the parallel dispatch wave ran:

8. **Kyle resolved PR #11 spec ambiguity** → word-paced fallback wins (full-line loses). Reasoning: iPad Safari is Marian's primary device, fallback IS the main path, per-word visual reinforcement is the passive-reading-exposure value the project optimises for. Kyle authored the spec edits in working tree but hit the same Bash gap (agent files reload at session start, not mid-session). Orchestrator handled git ops; **PR #12 merged** as `c9ea7be → 2da36fd`, three call sites in `design/session-1.md` tightened with the full fallback contract.

9. **Devon code-reviewed PR #11** → APPROVE on architectural merits. Independently validated word-paced over full-line. Watchdog reset, cancel-queue regression, WPM clamping, idempotent unsubscribe, type safety, mock isolation — all clean. **PR #11 merged** as `ebc400b`.

10. **Devon-impl shipped Splash (PR #13)**. 19 new tests / 92 total / 98.71% lines coverage on `Splash.tsx`. Manual `useState<Route>` routing — no react-router dep, ~10-12 KB gz saved. Cold/warm/reload/first-visit/bfcache timing all resolve correctly. Reduced motion via `MotionConfig`. Silent splash. iPad PWA meta verified (`apple-mobile-web-app-capable=yes`, `viewport-fit=cover`, safe-area-inset paddings). Devon flagged a brief-vs-spec spring-numbers discrepancy and correctly followed the on-disk spec per CLAUDE.md "spec is canonical" — orchestrator brief error, not a real ambiguity.

11. **Kevin code-reviewed PR #13** → REQUEST CHANGES on one blocker: cream → white → cream flash during Splash → Greet exit fade (violates spec line 79 "no hard cut"). Endorsed the no-router decision and everything else. GitHub blocked his `--request-changes` because PR author + reviewer share the same GitHub account (`TSandvaer`); he posted as a regular comment. Known wrinkle of single-account multi-agent setups.

12. **Devon pushed bg-fix commit `9143c4f`** — `body { background-color: #fff5f0; /* my-cream */ }` in `src/index.css` with a lockstep comment. Kept `bg-my-cream` on `<m.main>` belt-and-braces. Added `src/index.css.test.ts` (94 passing, +2 from baseline). PR comment requested re-review.

13. **Kevin re-reviewing PR #13** in background as of this update.

14. **Three new feedback memories written:**
    - `feedback_pr_merge_authority.md` — orchestrator merges low-risk doc/asset PRs directly (Thomas pushed back on "awaiting your merge" framing).
    - `feedback_clickup_status_sync.md` — move tickets through TO DO → IN PROGRESS → IN REVIEW → READY FOR QA TEST → COMPLETE as work happens (Thomas asked why the asset ticket sat in TO DO during the active PR).
    - `feedback_agent_file_reload.md` — agent file edits don't apply until VS Code session restart; don't promise newly-added tools to agents in the same session.

---

## What this session did (continued — late-night sprint, items 15+)

15. **PR #13 (Splash) merged** as `17f16f7` after Kevin's re-review approved the bg-fix.
16. **Jessica's first QA pass** on Splash → `qa/splash-regression.md` authored (first QA doc in repo). PASS-with-notes; 6 items deferred to Thomas's iPad pass.
17. **Vercel deploy live** at https://marian-learning.vercel.app/. Saved to memory (`reference_deploy.md`). Manifest verified, `melody-logo.svg` resolves, HTTP 200 across the board.
18. **Thomas iPad-installed PWA** and ran the 6 deferred items. **All 6 PASS.** Splash ticket → COMPLETE.
19. **PR #14 (Greet) shipped + reviewed + merged** as `2ff7848` (squash). Devon impl, Kevin reviewed (4 NITs none blocking). 41 new tests, 135 total passing.
20. **Thomas iPad-tested Greet** and found two real-device issues:
    - **TTS doesn't fire on iPad Safari** — gesture-gate bug. Empty caption ribbon, no heart, Marian stuck. Bug ticket `86c9gp99a`.
    - **Melody character doesn't read as My Melody** — looks like a kawaii blob, missing long ears, body, lineart, recognizable flower. Bug ticket `86c9gp979`.
21. **Two parallel Kyle dispatches** to address both:
    - Kyle (UX) → option (b) tap-to-start on Greet, viewport-wide tap target, breathing Melody + pulsing ready-ring. Spec PR #15 opened.
    - Kyle (art) → redid all 5 Melody SVGs (logo, idle, happy, plus new puzzled and cheering) with proper bunny anatomy, lineart, palette. Asset PR #16 opened.
22. **Dave consultation on the 12s wake-window timer.** Verdict: 12s → **8s** (research-backed upper bound for 8yo "screen is alive" tolerance), upgrade nudge from ear-wiggle-only to **finger-tap icon + ear-wiggle**, breathing scale 1.015 → 1.05 (1.015 imperceptible), add 2s first-utterance retry contract. Spec edits applied to PR #15.
23. **Three more PRs merged in sequence:**
    - **PR #16** (Melody SVG redo) → `a3b3f91`. Thomas approved as-is; visual readability tweak parked as `86c9gph8r` low priority.
    - **PR #17** (`icon-finger-tap.svg` new asset) → `8bc4f02`. Single 1.7 KB SVG.
    - **PR #15** (spec gesture unlock) → `ecd6f2a`. Authoritative for the gesture-unlock UX.
24. **Thomas verified new Melody on iPad** — refreshed PWA after busting the SW cache via Settings → Safari → Advanced → Website Data → delete vercel entries. Verdict: "Cute, but not really My Melody. Focus on functionality." Tweak parked.
25. **Devon dispatched in background** to implement the gesture-unlock fix per PR #15 spec on `feat/86c9gp99a-greet-gesture-unlock`. Substantial impl: Wake state, tap handler, 8s re-prompt, 2s retry contract, reusable `useAudioUnlockGate` hook for future TTS screens. Refactoring `greetSequence.ts` from auto-start to explicit `start()`.
26. **Jessica dispatched in background** to author `qa/greet-regression.md` based on the post-PR-#15 spec. Prep work — runs the checklist when Devon's PR ships.
27. **Splash ticket `86c9gnhde` → COMPLETE** after Thomas's full iPad pass.
28. **Two NIT follow-up tickets** filed for PR #14 — `86c9gp6g2` (`Math` → `MathScreen` rename), `86c9gp6jq` (SFX preload registry).
29. **One process improvement on the table:** Vercel preview deploys are blocked because `thjo@edc.dk` isn't verified on Thomas's GitHub account. Walked Thomas through the fix at https://github.com/settings/emails — pending his action.

---

## Top-of-priority for the next session

**1. When Devon's gesture-unlock PR opens** (he was running in background when Thomas switched accounts; may have been killed mid-flight):

- If PR exists on origin: dispatch Kevin to code-review (`code-review` skill, ticket `86c9gp99a`).
- If branch exists but PR doesn't: open the PR yourself via `gh pr create` from the branch, then dispatch Kevin.
- If branch doesn't exist: re-spawn Devon with the same brief (the brief in this session's transcript was self-contained — pull the spec for Screen 2 from `design/session-1.md` post-PR-#15 on `main`).

**2. When Jessica's `qa/greet-regression.md` lands** (also background; same uncertainty):

- If file exists on the main checkout: review briefly, ensure it's committed somewhere reachable, plan the run-through after PR ships.
- If not: re-spawn Jessica with the same brief.

**3. Merge Devon's gesture-unlock PR** after Kevin approves. Move ticket `86c9gp99a` from IN REVIEW → READY FOR QA TEST.

**4. Jessica runs `qa/greet-regression.md`** post-merge. Reports PASS / FAIL.

**5. Thomas re-iPad-tests** end-to-end Greet flow on real device once Devon's PR ships and Vercel redeploys.

**6. Vercel preview email fix** — Thomas to verify `thjo@edc.dk` at https://github.com/settings/emails. Once done, push an empty commit to retrigger preview on any open PR.

**7. Land doc fixups in `design/session-1.md`:** `.png` → `.svg` asset-table edit (from PR #10) + JSDoc spec-line `696` → `721` reference fix (from PR #14 NIT). Small Kyle PR; bundle both.

**8. Source `sfx-chime-soft.mp3`** — Thomas, per `public/assets/assets-todo.md`. Only blocks Greet's audio AC. Code is chime-missing-tolerant.

**9. Stale main-checkout cleanup** at `c:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning` — still has 38 phantom-staged scaffold files in the index on a long-merged branch. Worktrees bypass it cleanly (every PR this session demonstrated this) but a `git -C MarianLearning checkout main && git reset HEAD --` is owed. Low priority; best done when no active worktrees.

---

## What's running (when account-switch happened)

**Devon (gesture-unlock impl):** background, agent ID `a0061c00b481fe3b4`. Branch should be `feat/86c9gp99a-greet-gesture-unlock` if he got that far. Treat as terminated; verify branch/PR state next session.

**Jessica (greet regression checklist):** ✅ COMPLETED before account switch. File at `MarianLearning/qa/greet-regression.md`. 20 AC rows + 13 survival rows + 6-row GBUG regression table. Distribution: 16 automated (most "test needed" since only `boundary.test.ts` from PR #11 currently exists for caption fallback), 18 manual desktop, 20 iPad-device-only.

**⚠️ Stale-spec bug in Jessica's checklist content.** She read `design/session-1.md` from the main checkout, which is on detached HEAD pre-PR-#15. So her file references the OLD timer (12s), OLD breathing scale (1.015), and OLD nudge (ear-wiggle only, no finger-tap icon) — all of which PR #15 superseded. Her 4 flagged "spec ambiguities" (A, B, C, D in her report) are mostly artifacts of this stale read; on actual `origin/main` post-PR-#15, A, B, and C are resolved. D (reduced-motion breathing behaviour) may be a real spec gap worth addressing.

**Action for next session:** dispatch Jessica again with explicit pointer to spec on `origin/main` (or have her read `design/session-1.md` from a fresh worktree off `origin/main`, NOT the stale main checkout). She should refresh the affected rows in `qa/greet-regression.md` to match current spec, then commit the updated file and open a small PR.

**Jessica's E2E-framework recommendation: yes, set up Playwright/WebKit before Screen 4** (Word Song). AC rows 7 and 20 (the gesture-unlock rows) genuinely need real-browser automation and manual surface is already ~30 min/PR. Worth a planning ticket.

**Devon (gesture-unlock impl):** ✅ COMPLETED before account switch took effect. **PR #18 OPEN** at https://github.com/TSandvaer/MarianLearning/pull/18. Branch `feat/86c9gp99a-greet-gesture-unlock`. 33 new tests / 168 total. Coverage on new modules well above target: `useAudioUnlockGate.ts` 100% lines/funcs/87.5% branches; `Greet.tsx` 96.1% lines; `greetSequence.ts` 96.6% lines. Ticket `86c9gp99a` moved IN PROGRESS → IN REVIEW by Devon.

**Three things Kevin should attend to in his review** (Devon flagged):

1. Synchronous ordering in `Greet.handleWakeTap` — load-bearing; verify no `await` or `setTimeout` reintroduced between user gesture and `speak()` dispatch.
2. `useAudioUnlockGate`'s schedule/cancel ref pattern is a workaround for a useEffect-dep issue — without it the watchdog kept getting cancelled. Second pair of eyes worthwhile.
3. Deliberate `react-hooks/exhaustive-deps` disables on Greet's mount effect + gate's unmount cleanup — called out in adjacent code comments. Confirm intentional.

**Two spec ambiguities Devon resolved on his own (note for review):**

- "Wake-state continues showing or appears again?" → implemented "appears again": ring + tap target re-render whenever `gate.showGate === true`, even after the visual Wake → Intro transition has played. No copy shown — Marian sees only a slightly delayed Melody.
- 8s nudge persistence: ring + tap-target persist forever post-nudge; only the icon hides itself. Wake state never times out.

**Top-of-priority next session for Greet flow:**

1. Post the PR #18 link as a comment on ticket `86c9gp99a` (orchestrator-level ClickUp MCP dropped during the account switch; Devon's was also expired so neither could comment with the PR URL — ticket has the IN REVIEW move but no PR link reference).
2. Dispatch Kevin to code-review PR #18 (`code-review` skill, ticket `86c9gp99a`, Devon's three flagged items).
3. After Kevin approves, merge PR #18. Move ticket → READY FOR QA TEST.
4. Refresh Jessica's checklist to current-spec values, then run it. Fix any FAILs.
5. Thomas re-iPad-tests Greet end-to-end on Vercel after the redeploy. Should now: tap-anywhere → Melody talks, captions populate, ear-wiggle on "Hi!", heart appears, heart-tap → Math stub.

The agent IDs probably won't be addressable from a new Claude session; verify on disk + on origin instead.

---

## Memory pointers (auto-loaded each session)

- `project_marian_tutor.md`
- `user_parent_builder.md`
- `project_diagnostic_results.md`
- `project_orchestration.md` — three nested-Agent probe attempts + Machine-scope ruling
- `reference_clickup_board.md`
- `reference_deploy.md` — **NEW** Vercel URL + deploy notes
- `feedback_pr_merge_authority.md` — orchestrator merges low-risk doc/asset PRs directly
- `feedback_clickup_status_sync.md` — move tickets through 5 columns as work progresses
- `feedback_agent_file_reload.md` — agent file edits don't apply mid-session

---

## Backlog snapshot (current)

**Active / in-flight:**

- `86c9gp99a` — Greet gesture unlock (IN PROGRESS, urgent) — Devon impl in background; Kevin reviews when PR opens
- `86c9gnhez` — Greet (READY FOR QA TEST, high) — Jessica's checklist auth in flight; she runs it post-Devon-merge

**Done late-night:**

- `86c9gnhde` — Splash (COMPLETE) — all 6 iPad items PASS
- `86c9gp979` — Melody SVG redo (COMPLETE)
- `86c9gp99a-spec` portion → spec PR #15 merged

**Parked / lower priority:**

- `86c9gnhgf` — Returning-user start screen (TO DO, low, parked)
- `86c9gn9tc` — `.gitattributes` / CRLF (TO DO, low)
- `86c9gn9td` — PR #1 sub-threshold cleanup nits (TO DO, low)
- `86c9gn9th` — Node 25 / jsdom Storage shim (TO DO, low)
- `86c9gndd2` — Session-generator next-CVC-word teaser (TO DO, normal)
- `86c9gp6g2` — `Math` → `MathScreen` rename (TO DO, low) [NEW]
- `86c9gp6jq` — SFX preload registry (TO DO, low) [NEW]
- `86c9gph8r` — Tighten Melody SVGs to read more like My Melody (TO DO, low, parked post-functional-MVP) [NEW]

**Open follow-ups not yet ticketed:**

- `.png` → `.svg` asset-table delta + JSDoc line-696 → 721 fix in `design/session-1.md` (small Kyle PR)
- `sfx-chime-soft.mp3` source + drop into `public/assets/` (Thomas)
- Real-iPad watchdog tuning for TTS boundary fallback (Kevin parking note, only if drift observed)
- ANTHROPIC_API_KEY in Vercel env before Week 3 (Math screen — Claude calls start)

---

## PRs merged this session (chronological)

| PR  | Title                                                                   | Squash SHA | Author / Reviewer             |
| --- | ----------------------------------------------------------------------- | ---------- | ----------------------------- |
| #9  | `design(session-1): Screen 4 audio + button gating tweaks (Dave audit)` | `e10097a7` | Kyle / orch                   |
| #10 | `chore(86c9gkm42): Session 1 asset bundle — Splash + Greet`             | `9a4d3fd`  | Kyle (orch git) / orch        |
| #11 | `feat(tts): boundary-event hook for word-by-word caption sync`          | `ebc400b`  | Kevin / Devon                 |
| #12 | `docs(session-1): lock word-paced TTS fallback at 165 wpm`              | `2da36fd`  | Kyle (orch git) / orch        |
| #13 | `feat(splash): Screen 1 launch splash with logo + pulsing dots`         | `17f16f7`  | Devon / Kevin                 |
| #14 | `feat(greet): Screen 2 Meet Melody — TTS captions + heart CTA`          | `2ff7848`  | Devon / Kevin                 |
| #15 | `docs(session-1): tap-to-start gesture unlock for iPad Safari TTS`      | `ecd6f2a`  | Kyle + Dave (orch git) / orch |
| #16 | `chore(assets): redo Melody SVGs with full bunny anatomy + new poses`   | `a3b3f91`  | Kyle (orch git) / Thomas      |
| #17 | `chore(assets): add icon-finger-tap.svg for Greet wake re-prompt`       | `8bc4f02`  | Kyle (orch git) / orch        |

**Total: 9 PRs merged in one extended session.** No PRs currently open (Devon's gesture-unlock branch was in flight when account switch happened).

---

## Critical-runtime caveats

- **Kyle's persona has Bash queued** (added mid-session) but the running harness loaded the OLD agent file. Every Kyle dispatch this session needed orchestrator-handled git ops. Next session's harness reload should pick up the change — verify by spawning Kyle and asking him to confirm Bash exposure.
- **Vercel preview deploys blocked** until Thomas verifies `thjo@edc.dk` on his GitHub account. Production deploys still work (auto-deploy on merge to main).
- **Single-account multi-agent quirk:** GitHub blocks `gh pr review --approve` and `--request-changes` when the PR author and reviewer share the same GitHub identity (`TSandvaer`). Reviews land as regular PR comments instead. Doesn't block the workflow but is worth knowing.

---

_Last updated 2026-04-25 deep night, just before Thomas switched Anthropic accounts. 9 PRs merged. Splash fully shipped + iPad-validated. Greet shipped but gesture-unlock fix in flight. Strong forward velocity._
