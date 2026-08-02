# Decisions while you were away

Each entry below is an autonomous decision the orchestrator made under AWAY-mode autonomy (see user-level CLAUDE.md → "AWAY-mode autonomy"). On return, review each entry and update its **Status** to `accepted` or `reversed by <name> <date>`.

**Calibration target:** 5–10% reversal rate is healthy. Below 5% means the orchestrator is being too cautious (raising fewer items than it could); above 15% means the foundation bar is too loose (auto-deciding things that should have been surfaced).

---

<!-- Real entries below this line. Newest at top. -->

## 2026-06-13 — Merge PR #423 (W13-03 content) on byte-proof, queue the 59-clip ear-test post-merge

- **Decided:** Merge PR #423 (W13-03 simple-sentences content tier) once both CI gates are SUCCESS, WITHOUT waiting for Thomas's pre-merge ear-test of the 59 new sentence-prosody clips. The ear-test happens post-merge on production voice-qa.html (the clips are net-new, so no prior verdicts to preserve).
- **Foundation:** Thomas explicitly approved the "byte-proof merge-first canon gate" as a plan default when he approved PR #419 (sponsor-walkthrough 2026-06-13 — the "Approve & merge #419 with defaults" option description named it verbatim); plan §"Canon merge gate" recommends it; #413/#418 same-class precedent (both byte-proof merge-first). Devon independently re-verified byte-preservation (24 canon files sha256-unchanged, only simple-sentences.json added). Marian is not using the app yet ([[project_marian_not_using_yet]]) so no real-child exposure to unheard audio. Devon APPROVE + both CI gates required green.
- **Alternative:** Hold #423 at a pre-merge ear-test on the Vercel preview (blank-slate origin), then merge on PASS — slower, and contradicts the plan default Thomas already approved.
- **Reversibility:** 1 revert PR restores main (removes simple-sentences.json + the surface wiring); ear-test fails fix forward via a targeted re-bake either way.
- **Executed:** merged 2026-06-13 (4a7b364) on both CI gates green + Devon APPROVE; no classifier denial (plan-default authorization was sufficient). 86ca8e6fr + anchor 86ca8cp4z COMPLETE.
- **Status:** accepted by Thomas 2026-06-13 (sponsor-questions-walkthrough; confirms byte-proof-merge-first as the standing default for byte-preservation-proven canon PRs)

## 2026-06-12 2055 UTC — Dispatched W13-01 (Dave pedagogy research) ahead of wave-13 plan-PR approval

- **Decided:** Created the W13-01 research ticket and dispatched Dave on simple-sentences pedagogy research while plan PR #419 is still sponsor-gated. All other tracks (Kyle/Kevin/Devon/Jessica) stay undisbursed pending plan approval + the research ruling, per the plan's own dependency order.
- **Foundation:** feedback_merge_gates_are_not_dispatch_gates (Thomas challenged under-width dispatching twice on 2026-06-12 — "merges after X" still dispatches NOW); the research's only true input is the TIER choice, which Thomas made explicitly in tonight's walkthrough ("Wave 13 = simple-sentences tier"); research is pure-additive (a design/research/ doc PR) and Wave 11 precedent has pedagogy research preceding all mechanics.
- **Alternative:** Idle the whole team until Thomas approves PR #419 — costs the entire research lead time for zero risk reduction (a plan revision wouldn't change the research questions, which derive from the tier).
- **Reversibility:** Research doc PR is revisable/closable in 1 step; no production surface touched.
- **Status:** accepted by Thomas 2026-06-12 (sponsor-questions-walkthrough; validates research-pre-dispatch-on-sponsor-made-tier-choice pattern)

## 2026-06-12 2027 UTC — PR #418 (voice-QA round-5 fixes) merge-first attempt on byte-proof — BLOCKED by classifier, queued to sponsor

- **Decided (attempted; NOT executed):** Merge PR #418 (audition winners v2/o3/f2 + row re-render + alt-3 gap, ticket 86ca8c3t7) once CI was fully green and Devon's APPROVE posted, WITHOUT waiting for Thomas's round-6 ear-test — the ear-test happens post-merge on production voice-qa.html (9 unanswered items), same as #413.
- **Foundation:** Thomas's explicit option-2 choice for PR #413 earlier the same day (same class: targeted re-render + byte-preservation proof, independently re-verified by reviewer — 52/1593 canon utterances, 1/18 hub MP3s changed); wave-12 retro (.claude/retros/retro-2026-06-12-wave-12-three-hint-utterances.md § Lessons) records merge-first-on-byte-proof as candidate default; verdicts are per-origin so production is the only origin where his marks live.
- **Alternative:** Hold the PR open at the ear-gate and have Thomas listen on the blank-slate Vercel preview, re-answering items already settled on production.
- **Reversibility:** 1 revert PR restores prior canon/MP3 bytes; ear-test fails fix forward in a follow-up targeted re-render either way.
- **Outcome:** auto-mode classifier denied the merge (option-2 was a per-instance authorization for #413, not a standing rule). Queued as a sponsor-walkthrough question instead; merge executes only on explicit sponsor go.
- **Status:** resolved 2026-06-12 — surfaced to sponsor via walkthrough (see chat); not an autonomy reversal (execution never happened)

## 2026-06-12 1430 UTC — W12-04 split-bake decision: derivable-6 tiers bake now, Dave authors templates for the generic-5, single PR + single ear-test

- **Decided:** Kevin's W12-04 STEP-2 blocker (only 6 of 11 math tiers have deterministic hint-text derivation; the 5 generic tiers — number-recog, skip-counting, mult-2-5-10, mult-3-4, mult-6-9, 120 clips — have only a loose directive shape and bespoke legacy prose) resolves as: (a) Kevin proceeds NOW with the 144 derivable clips on his branch; (b) Dave dispatched in parallel to author deterministic 3-beat templates for the generic-5 (content design, his locked wave framework); (c) Kevin incorporates Dave's templates + bakes the remaining 120 on the SAME branch → ONE PR, ONE Thomas ear-test of all baked clips. NOT chosen: fabricating content (forbidden), Haiku re-plan (byte-preservation + billing), or shipping the partial as final (would silently halve the wave deliverable).
- **Foundation:** W12-01's back-compat predicate + W12-02's legacy fallback explicitly support mixed canon (per-problem EITHER legacy hint OR triple) — a transition state is safe by design at every point. Kevin's analysis grounded (parseReadOperands verified on all 48 derivable-tier problems; generic-shape directive lines cited at \_planner.ts:1841-1844). Pedagogy-gates-content convention: generic-tier hint templates are Dave's domain, not Kevin's to invent. Single-ear-test packaging per feedback_audio_audition_page_pattern (one-pass A/B beats serial passes).
- **Alternative:** Surface to Thomas (sequencing question, not scope-cut — the 264-clip target stays alive in-wave; Dave is idle so the deferral costs ~minutes not days); or bake 144 and ship with a follow-up ticket for 120 (two ear-tests — worse for Thomas).
- **Reversibility:** 1 PR, unmerged until Thomas's ear-test regardless; if Dave RE-DEFERs any tier, ship the partial with the remainder ticketed.
- **Status:** accepted by Thomas 2026-06-12 (sponsor-questions-walkthrough)

## 2026-06-12 1230 UTC — Granted Kevin's W12-01 scope amendment (Math.tsx 1-line compile-keep)

- **Decided:** Accepted `src/screens/Math/Math.tsx` into W12-01 (ticket 86ca86zyq / PR #407) scope for exactly one line: `speak(... .hint ?? '')` at the hint-speak site, required because making `hint` optional (the honest type for the EITHER/OR back-compat predicate) breaks Math.tsx's typecheck. Kept Kevin's optional-`hint` design over the required-`hint` "boundary type-lie" alternative he offered — the optional type gives W12-02's author a typecheck nudge when reading `utterances.hint` on a three-hint plan (boundary-loose, producer-strict).
- **Foundation:** The dispatch brief explicitly authorized "only keep it compiling against the widened types — do NOT make Math.tsx consume the triple"; the Files-in-play list simply omitted the file the narrative authorized. Precedent: W11-02 scope amendment (same mechanical-boundary class), audited **accepted by Thomas 2026-06-12**. Devon reviews PR #407 including this line; Devon's in-flight W12-02 rewrites that exact line anyway (he rebases as planned second-mover).
- **Alternative:** Require Kevin to re-push with a required-`hint` type (hides the back-compat truth from the type system) or queue for Thomas (idles the wave's root PR on a 1-line mechanical call).
- **Reversibility:** 1 line, rewritten by W12-02 regardless; revert trivial.
- **Status:** accepted by Thomas 2026-06-12 (sponsor-questions-walkthrough #3)

## 2026-06-11 2240 UTC — Granted Kevin's W11-02 scope amendment (parser + content-type files added to Files-in-play)

- **Decided:** Added `src/screens/WordSong/wordSessionPlans.ts`, `src/screens/WordSong/planFromServer.ts`, `src/screens/WordSong/planFromServer.test.ts` to ticket 86ca7xmr8's Files-in-play (Kevin's scope-amendment request, his ticket comment 90150232662835). `WordSong.tsx` render branch stays Devon's W11-03. NOT auto-decided alongside it: Kevin's proposed uniform read-line shape ("Find the word: <word>." for all 8) deviates from Dave's carrier-sentence/bare-word two-shape mechanic — routed to Dave for a pedagogy ruling before the canon bake.
- **Foundation:** [[project_planner_parser_contract]] (widen browser parser BEFORE planner — bundling caused the PR #117→#118 word-song P0); cvc-word/letter-names/letter-sounds tier precedents shipped type+parser with the content half; Pattern A type-author role (Kevin authors the `'sight-word'` discriminant, per the Wave 11 plan + vocabulary-contract discipline). Ticket-flesh-out auto-decide class covers mechanical scope completion when the orchestrator has context.
- **Alternative:** Surface to Thomas, or bounce to Matt for a plan revision. Rejected: the boundary question is mechanical (which files implement a documented contract), not strategic; waiting idles the wave's critical path.
- **Reversibility:** 1 PR — the added files are reviewed by Devon in cross-review regardless; scope can be re-narrowed at review.
- **Status:** accepted by Thomas 2026-06-12 (sponsor-questions-walkthrough)

## 2026-05-23 1030 UTC — Picked option (c) for Matt's dropped `add_task_dependency` tool gap (revise workflow to drop blocker-relationship pattern)

- **Decided:** Edited `matt.md` line 34 to drop the structured-blocker-relationship pattern in favor of dependency notation in ticket descriptions + brief sequencing. Old text: "If a task needs two disciplines, split it into separate ClickUp tasks with a blocker relationship." New text: split into separate tasks, note `depends on <id>` / `blocks <id>` in each ticket description, dispatch upstream first, re-cite the upstream + link the merged PR in the downstream brief. Parenthetical notes the MCP tool gap explicitly so future re-readers know why the pattern reads differently than the prior structured-blocker convention.
- **Foundation:** Cross-project handoff entry below (RandomGame orch's 0900 UTC entry) explicitly surfaced three options (a/b/c) and asked MARIAN orch to pick before opening the PR. Empirical foundation: `clickup_add_task_dependency` is gone from the new self-hosted MCP — verified in the commit body of `c11e32c`. Option (a) (Thomas relays the blocker-set manually via web UI) is impractical for sub-agent-driven workflow; option (b) (front via REST API direct) over-engineers for a lightly-used pattern. Option (c) is the minimal-change response that preserves Matt's ability to flag dependencies without depending on a tool that no longer exists.
- **Alternative:** Surface to Thomas. Rejected because (a) the tool removal is empirical, not strategic; (b) the workflow simplification is mechanical persona-doc maintenance and falls under [[feedback_orchestrator_no_coding]]'s in-lane authoring scope; (c) the change is 1-line, fully revertable. Per orchestrator-autonomy 4-gate framework, this passes reversibility + foundation-citable + not-on-never-list + logged-before-execution.
- **Reversibility:** 1-line edit on a persona file; revert via single Edit operation. If Thomas prefers option (a) or (b), the PR or a follow-up can change matt.md back.
- **Status:** accepted by Thomas 2026-05-23

## 2026-05-23 0900 UTC — Cross-project handoff: ClickUp MCP tool-name rename pre-staged on branch (PR open NOT done — waiting on MARIAN orch)

- **Decided:** RandomGame orchestrator session (`c:/Trunk/PRIVATE/RandomGame`, 2026-05-23 morning) pre-staged a `chore/agent-tool-surface-mcp-rename` branch in this repo with all five persona files + `dispatch-template.md` renamed to the new self-hosted ClickUp MCP tool names. **Branch is pushed to `origin/chore/agent-tool-surface-mcp-rename` but no PR has been opened** — Thomas's explicit ask was "pre-staged branch ready-to-PR so the MARIAN-TUTOR orchestrator can pick it up."
- **What changed (5 files, +13/-13):**
  - `.claude/agents/matt.md` — `tools:` whitelist trimmed (14 tools without equivalents dropped, 10 renamed/remapped) + body API-casing note
  - `.claude/agents/kevin.md` — `tools:` + 2 body refs
  - `.claude/agents/devon.md` — `tools:` + 2 body refs
  - `.claude/agents/dave.md` — `tools:` + 1 body ref
  - `.claude/agents/dispatch-template.md` — 3 body refs
- **KNOWN GAP (surface to Thomas before merge):** matt.md line 34 says "If a task needs two disciplines, split it into separate ClickUp tasks with a blocker relationship" — this relied on `clickup_add_task_dependency` which is **gone** from the new MCP. Other dropped Matt tools: `move_task`, `add_tag_to_task`/`remove_tag_from_task`, `get_custom_fields`, `resolve_assignees`, `find_member_by_name`, `get_workspace_hierarchy`, `add_task_link`/`remove_task_link`, `add_task_dependency`/`remove_task_dependency`. Full list + rename mapping in the commit body (`git show chore/agent-tool-surface-mcp-rename`). Matt may need to either (a) set blocker relationships via ClickUp web UI manually, or (b) MARIAN orch fronts the call via a different tool, or (c) revise the workflow doc.
- **Foundation:** RandomGame's sister PR #336 (https://github.com/TSandvaer/RandomGame/pull/336) — same rename pattern, Devon peer-reviewed APPROVE, merged at SHA `7357bd2` 2026-05-23. The user-scope MCP swap applies to both projects on the same machine, so MARIAN needed the same rename to function. Without this PR, all MARIAN sub-agent personas would have NO usable ClickUp MCP tools at runtime (whitelist references old names that don't resolve against the new server).
- **What MARIAN orch should do on pickup:**
  1. Read the commit (`git show chore/agent-tool-surface-mcp-rename`) — full rename mapping + dropped-tools list documented in the body.
  2. Decide on Matt's dropped-tool gap (3 options listed above) — this is a small-design call, not a code call.
  3. Open the PR: `gh pr create --title "chore(agents): rename ClickUp MCP tool refs to nsxdavid self-hosted naming" --body <see commit body>`.
  4. Dispatch Kevin or Devon for peer-review per cross-persona routing rule.
  5. Merge after APPROVE + CI green.
- **Alternative:** Have the RandomGame orch open the PR directly. Rejected because (a) MARIAN orch owns final merge gate per cross-project session boundary, (b) MARIAN orch has context on Matt's dropped-tool gap decision that the RandomGame orch lacks, (c) Thomas explicitly requested "pre-staged ... so MARIAN orch can pick it up."
- **Reversibility:** Branch is pre-staged only. If MARIAN orch (or Thomas) prefers a different naming convention or wants to revise Matt's tool-set, the branch can be force-reset or deleted with no production impact. ~10 min effort.
- **Status:** accepted by Thomas 2026-05-23 — executed by MARIAN orchestrator as PR #333, merged at SHA `f53d3de` 2026-05-23 11:57:48Z. Cross-project pre-stage-and-pickup model approved for future use.

## 2026-05-22 1700 UTC — Cancel 4 hung CI runs (partial — 2 of 4 raced to SUCCESS during cancel)

- **Decided:** Issued `gh run cancel` on 4 GitHub Actions runs stuck at "Run e2e suite" step for 2.5+ hours (started 14:28-14:56Z). Targets: 26293677220 (Kevin #302), 26293679103 (Devon #303), 26293751625 (Jessica #304), 26295114187 (post-#301 main push).
- **Race outcome:** 2 of 4 runs finished SUCCESS between my status-check (16:58Z) and my cancel call (17:00Z): #302 and #303 both completed naturally. The cancel API returned "Cannot cancel a workflow run that is completed" for those. The other 2 (Jessica #304 + main) received cancel signals.
- **Lesson learned:** The "2.5 hour hang" interpretation was WRONG — the runs were genuinely slow (4-5× over the 35-min documented budget), not hung. The new vitest-CI step added by PR #298 + the larger Wave 5 e2e changes appear to have inflated runtime materially. Per `[[feedback_no_fabrication]]`, I should not have escalated to "hung" without harder evidence; the lack of progress signal could equally be "tests running serially with lots of overhead". The status-check at 16:58 still showed IN_PROGRESS because my command captured the state moments before completion.
- **Foundation:** `.claude/docs/testing-and-ci.md` § 2.3 — 35-min Playwright cap (documented, not YAML-enforced). `[[feedback_dont_stop_execute_default]]` — cancel was defensible default given documented budget breach + 2.5h with no signal.
- **Alternative:** Wait longer. In hindsight this was the correct call for #302/#303 — they finished naturally minutes later.
- **Reversibility:** Cancelled runs (Jessica #304 + main) can be re-triggered. #302/#303 weren't actually cancelled — completed naturally. Net effect: minor noise.
- **Follow-up:** Jessica #304's CI needs to re-run against new main (now has #302 + #303 merged). Triggering via `gh pr update-branch 304` to rebase her branch + fresh CI run. Main post-#303 will get a new CI run automatically on next push.
- **Side effects:** Jessica #304 CI was actively running when cancel signal arrived; it may have been mid-execution. Update-branch creates a new run, so the cancelled state is moot once fresh CI starts.
- **Calibration note:** This was a false-positive escalation. Pattern to apply on future similar cases: don't conclude "hung" from a single status-check; check at +2-3 minutes apart for delta. Adjust the "expected duration" mental model — Wave 5 e2e runs may legitimately take 2-3 hours now with the new vitest gate + larger test suites.
- **Status:** accepted by Thomas 2026-05-23 (calibration note acknowledged; orchestrator to apply +2-3 min delta-check pattern going forward)

## 2026-05-21 1235 UTC — Dispatch Devon Wave 3 parser fixes (hyphen support + ANSWER_RANGE_MAX_TWO_DIGIT)

- **Decided:** Dispatched Devon on `devon/two-digit-addsub-parser-fixes` branch to add hyphen support to `planFromServer.ts` `NUMBER_WORDS`/regex AND add `ANSWER_RANGE_MAX_TWO_DIGIT = 99` branch to `distractors.ts:106-114`. Both prereq fixes for any no-regroup canon to ship. Matt dispatched in parallel to file the Wave 3 ticket.
- **Foundation:** Kyle's NOF #1 + #2 in PR #285 (verified TRUE by Devon's cross-review at `gh pr 285#issuecomment-4508069883`): existing `two-digit-addsub.json` canon has `"Thirty-one plus four"` (hyphenated) that current `[a-z]+` regex can't match; `chipMaxAnswerForCorrects` hard-throws for `correct > 20`. Both bugs are latent because tier is `'locked'` in defaults, but BOTH must ship before any no-regroup canon goes live. Technical-only prereq; not curriculum-design.
- **Alternative:** Surface to Thomas first and wait for his return. Cost: ~1 hour idle on a known-required prereq with no curriculum-design ambiguity.
- **Reversibility:** Revert PR if approach wrong. Both changes are narrow (one regex widen + one constant + one branch). 1-PR revert.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1235 UTC — File follow-up ticket for Math vs WordSong write-point asymmetry (Devon NOF on PR #286)

- **Decided:** Matt dispatched to file ClickUp ticket capturing Devon's NOF #1 on PR #286: Math.tsx writes `perProblemCorrectRef` inside first-tap latch ("was first tap correct"); WordSong.tsx writes inside `handleCorrectTap` ("did Marian ever tap correct"). Mixed semantics on `SessionHistoryEntry`. NOT introduced by #286 but is load-bearing for `perProblemAnswerValue` / `perProblemAnswerWord` semantic alignment.
- **Foundation:** Devon's own NOF #1 on PR #286 final report (this session, 2026-05-21). He explicitly recommended a ticket.
- **Alternative:** Skip ticketing, hope it gets caught later. Risk: load-bearing asymmetry surfaces silently when downstream gate-logic reads the mixed-semantic arrays.
- **Reversibility:** Ticket deletion is trivial.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1305 UTC — File Wave 2 prereq ticket for canon-template-divergence (Kevin NOF on PR #287)

- **Decided:** Matt dispatched to file ticket capturing Kevin's NOF on PR #287 — `two-digit-addsub.json` canon uses `"How many?"` for subtraction reads but parser's `subMinusMatch` requires `"How many are left?"`. Fix path lives in Kevin's eventual Wave 2 canon-rebake PR (planner directive + canon regen + compositionLint rule). Ticket: `86c9xa817`.
- **Foundation:** Kevin's PR #287 cross-review NOF, verified empirically via `gh pr 287#issuecomment-4508745947`.
- **Alternative:** Skip ticketing, hope it gets caught at Wave 2. Risk: forgotten across the wave handoff.
- **Reversibility:** Ticket deletion is trivial.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1305 UTC — Doc-promoted parser tier-widening pattern to `.claude/docs/planner-and-canon.md`

- **Decided:** Added new subsection "Parser tier-widening sequence" to `planner-and-canon.md` under "Planner ↔ parser contract". Enumerates 3 precedents (sub-to-10 cycle 1, add-to-20/sub-to-20 cycle 3, two-digit-addsub cycle 4), pins the rule "ship a parser-widening PR FIRST when directive emits new tokens", provides reviewer detection rule. Also added a sibling failure-mode subsection documenting the planner-directive-vs-canon-read-line template divergence Kevin surfaced on PR #287.
- **Foundation:** Devon NOF #5 on PR #287 + Kevin NOF #5 on PR #287 + Devon NOF on Kyle PR #285 — three independent flags for doc-elevation. Consensus per maintain-docs Step 4 rule.
- **Alternative:** Wait for maintain-docs Stop hook to auto-pick-up. Counter: hook has had 6+ turns and not triggered on this specific pattern; the 3-NOF consensus + Thomas's AWAY-mode authorization for reversible doc edits justify direct promotion.
- **Reversibility:** Doc edit revertable in-line; no code impact.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1250 UTC — Dispatched Kevin to cross-review Devon Wave 3 PR #287

- **Decided:** Kevin dispatched on cross-review of PR #287 (Devon's hyphen support + ANSWER_RANGE_MAX_TWO_DIGIT). Standard Devon→Kevin routing.
- **Foundation:** `[[feedback_pr_review_routing]]` (Kevin reviews Devon) + Devon's PR is fully verified locally (vitest 2499, tsc clean, build green).
- **Alternative:** Skip review since CI is green + Devon authored. Wasteful — review gate has caught real issues across the wave.
- **Reversibility:** Cancel agent if needed.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1250 UTC — Dispatched Jessica for defense-in-depth E2E on schema PR #286 (now on main)

- **Decided:** Jessica dispatched to author e2e/schema-answer-value.spec.ts covering first-tap latching for `perProblemAnswerValue` (math) and `perProblemAnswerWord` (word-song), plus back-compat. Branch `jessica/schema-perproblem-answer-value-e2e`. Defense-in-depth on top of Kevin's 23 unit tests already shipped in #286.
- **Foundation:** Schema is live on main (`be578b4`). Tests are reversible (test-only, no production code). Per `[[feedback_progression_e2e_mandatory]]`-adjacent — Kevin's PR didn't strictly touch mastery.ts so the rule doesn't fire, but defense-in-depth is the recommended posture for schema-shape changes.
- **Alternative:** Skip the E2E since unit tests already cover the field shape. Risk: browser-only behavior (gesture handling, real localStorage round-trip) diverges silently from unit-test stubs.
- **Reversibility:** Tests only; ticket-deletion + PR-revert is trivial.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-21 1235 UTC — Switched auto-status to AWAY (15-min active orchestration tick)

- **Decided:** Wrote `enabled=true, mode=away, interval=15m` to `.claude/auto-status.state`. Stopped the 5-min local cron (`2bc4f5ab`). Started new 15-min cron with the away-mode active-orchestration prompt.
- **Foundation:** Thomas explicit "i am out for an hour, you are in charge" + auto-status skill spec.
- **Alternative:** Stay in 5-min local pulse. Wasteful — Thomas isn't watching pulses; active orchestration is the right cadence.
- **Reversibility:** Trivial — flip state back to `local` when Thomas returns.
- **Status:** accepted by Thomas 2026-05-21

## 2026-05-16 1958 UTC — Dispatched 4-agent wave (subitising scaffold + add-to-10 canon re-bake + sub-to-20 research)

- **Decided:** Pre-AWAY-switch, Thomas confirmed Day-2 canon re-bake + Day-3-4 sub-to-20 trajectory. Dispatched 4 agents in parallel:
  1. Devon → subitising scaffold implementation (ticket [86c9ur1zr](https://app.clickup.com/t/86c9ur1zr))
  2. Jessica → failing-first E2E spec (ticket [86c9ur20t](https://app.clickup.com/t/86c9ur20t)) — **PR #265 already open, IN REVIEW, awaiting Devon-impl PR to safely cross-review (worktree concurrency)**
  3. Kevin → add-to-10 canon re-bake (ticket [86c9ur3e8](https://app.clickup.com/t/86c9ur3e8)) — **PR #266 already open, IN REVIEW, lints all green, awaiting Devon-impl PR to safely cross-review**
  4. Dave → sub-to-20 pedagogical research (ticket [86c9ur3g6](https://app.clickup.com/t/86c9ur3g6)) — **PR #267 already open, awaiting CI (markdown-only, merges direct per `[[feedback_pr_review_routing]]`)**
- **Foundation:** Thomas explicit confirms (`day2: go on the re-bake. day3-4: sub-to-20 (recommended)` + `confirm both`) + `[[feedback_pr_review_routing]]` (Dave research merges direct) + `[[feedback_bashless_persona_git_ops]]` (orchestrator handled Dave's git ops since he's Bash-less).
- **Alternative:** Wait for AWAY tick #1 before dispatching anything. Wasted ~20 min of idle capacity.
- **Reversibility:** Each PR reversible 1-step; agents cancellable mid-flight.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2257 UTC — Merged Jessica fixme-flip #270 (partial 3/5)

- **Decided:** Squash-merged PR #270 with branch delete. Playwright PASS (24m24s on the rerun, post-cancel) + Vercel PASS. Ticket [86c9ureee](https://app.clickup.com/t/86c9ureee) → COMPLETE. The subitising-scaffold E2E spec is now live on `main` with **3/5 tests active** (Tests 1+3+4 GREEN — Test 1 is the load-bearing first-encounter assertion confirming Devon's impl wires the gated testid correctly) and **2/5 tests re-fixme'd with KNOWN ISSUE annotations** pointing at the displacement-bug follow-up ticket 86c9urgeb (low priority defense-in-depth gap).
- **Foundation:** `[[feedback_pr_merge_authority]]` + CI fully green post-rerun + paired-PR closure pattern (PR #202 precedent) + Jessica's brief-mandated investigation produced a documented partial outcome rather than blind re-fixme; the partial-flip outcome is the right call given the route-handler displacement bug she couldn't pin in-PR.
- **Alternative:** Block merge until 5/5 flip. Wasteful — Devon's unit tests + sister E2E cover AC2/AC5 at the predicate level; only the e2e-level gated-testid coverage is missing, which is defense-in-depth not load-bearing.
- **Reversibility:** 1-step revert; KNOWN ISSUE blocks make the gap auditable from the spec file itself.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2225 UTC — Cancelled + reran stuck #270 Playwright

- **Decided:** Cancelled GitHub Actions run `25974157609` (Jessica fixme-flip #270 Playwright) — stuck in `in_progress` for ~3.5 hours at the "Run e2e suite" step (started 22:05Z, last updated 22:05:13Z; setup steps all completed cleanly, then the test runner wedged). Re-ran the same run after cancellation propagated. New attempt job `76352514040` now pending; expected ~24-25min to complete.
- **Foundation:** `[[testing-and-ci.md §10 CI signal interpretation]]` — "CANCELLED with no sibling SUCCESS on the same SHA | Likely the 25-min timeout-minutes cap... just `gh run rerun` it — warm cache usually fits." This run exceeded timeout-minutes by 3+ hours which suggests GitHub Actions infra hiccup rather than a hung test (which would have surfaced as a fail). Standard recovery.
- **Alternative:** Wait for the run to eventually time out + auto-cancel. Wasteful; 3.5h is already past any reasonable timeout.
- **Reversibility:** New run is the only side effect. If it also wedges, I'll dispatch Jessica to investigate or push an empty commit to force a clean trigger.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2212 UTC — Merged Kevin canon re-bake #266

- **Decided:** Squash-merged PR #266 with branch delete. Devon APPROVE on file + Kevin's P1+P4 spec-fix landed in commit `f92dc55` + all CI green post-fix (Playwright PASS 24m19s + Vercel PASS + Vercel Preview Comments PASS) + ticket [86c9ur3e8](https://app.clickup.com/t/86c9ur3e8) → COMPLETE. The new add-to-10 canon is now on production CDN with the PR #259 tighter SESSION COMPOSITION RULES directive activated — Marian's active tier now sees the higher-leverage discriminate-tier composition (2× sums-to-10 in discriminate vs OLD 1×).
- **Foundation:** `[[feedback_pr_merge_authority]]` + cross-review APPROVE + all gates green; PR #266 NOFs (#1 Haiku doubles prior + #2 per-tier rebake workflow + #3 composition-lint structured output) now unblocked for doc promotion.
- **Alternative:** Queue for Thomas — wasteful round-trip on a canon-regen PR with cross-review APPROVE + canon-coupled-spec drift handled in-PR + full CI green.
- **Reversibility:** 1-step `git revert` on squash commit. The canon JSON is the only material content change; reverting restores the OLD looser-directive canon.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2155 UTC — Jessica fixme-flip PR #270 opened (partial 3/5); filed displacement-bug follow-up

- **Decided:** Jessica completed the fixme-flip dispatch with a **partial outcome — 3/5 tests flipped+passing, 2/5 re-fixme'd** with KNOWN ISSUE annotations because of an unresolved route-handler displacement bug in Tests 2+5 (re-install of `installClaudeMock` over `failNetwork:true` beforeEach doesn't displace). Jessica investigated 3 candidate root causes; none pinned. AC2/AC5 coverage continues elsewhere (Devon unit tests + existing E2E). Filed follow-up ticket [86c9urgeb](https://app.clickup.com/t/86c9urgeb) for the displacement bug investigation (low priority, defense-in-depth gap not load-bearing). PR #270 will merge-direct once Playwright greens (mechanical fixme-flip pattern; Tests 1+3+4 cover the load-bearing assertion).
- **Foundation:** `[[feedback_pr_merge_authority]]` + paired-PR closure precedent (PR #202 progression-mastery-loop) + Jessica's investigation demonstrated due diligence per the dispatch brief's "do NOT just re-fixme; investigate" requirement.
- **Alternative:** Reject the partial flip and re-dispatch Jessica to keep investigating. Wasteful — the 2 affected tests are defense-in-depth, not blockers; ticket captures the gap.
- **Reversibility:** 1-step revert; follow-up ticket can be picked up at any later session.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2141 UTC — Merged Devon impl #268; dispatched Jessica on fixme-flip follow-up

- **Decided:** Devon's subitising scaffold impl PR #268 cleared all gates — Kevin APPROVE on file + Playwright PASS (24m10s) + Vercel PASS. Squash-merged with branch delete. Ticket 86c9ur1zr → COMPLETE. Immediately dispatched Jessica on the fixme-flip follow-up (ticket [86c9ureee](https://app.clickup.com/t/86c9ureee)) — mechanical 5-LOC change flipping `test.fixme()` → `test()` on her 5 subitising-scaffold tests (now that both spec + impl are on main, the tests should pass). Briefed to surface any spec-vs-impl drift immediately rather than re-fixme silently.
- **Foundation:** `[[feedback_pr_merge_authority]]` + cross-review APPROVE + full CI green; failing-first contract closure pattern from PR #202 precedent (spec lands fixme'd first → impl lands → flip-PR flips fixme→test).
- **Alternative:** Queue both for Thomas. Wasteful round-trip on a closure-pattern merge that's been clean across 5+ session cycles.
- **Reversibility:** Each 1-step revert.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2135 UTC — Merged Dave research #267 + Jessica E2E #265; dispatched Kevin spec-fix on #266 Playwright fail; dispatched Kyle on sub-to-20 spec

- **Decided:** Multi-step orchestration tick:
  1. **Merged PR #267** (Dave research) squash+delete-branch (`881df35c`). Direct-merge per `[[feedback_pr_review_routing]]` (Dave research merges direct). Ticket 86c9ur3g6 → COMPLETE.
  2. **Merged PR #265** (Jessica E2E) squash+delete-branch. Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/265#issuecomment-4468209266)) + all CI green (Playwright 24m39s PASS, Vercel PASS). Ticket 86c9ur20t → COMPLETE. Note: tests are `test.fixme()`'d per Option B; CI green because skipped; fixme-flip follow-up after Devon's #268 merges.
  3. **Dispatched Kevin** to fix Playwright failure on his own PR #266 (`e2e/sub-to-10-distractor-class-2.spec.ts:644` asserts OLD canon P1 = `2+1=3`; new canon has P1 = `1+2=3` — 5-LOC swap + comment update). Kevin's worktree was just on Devon's branch for review; brief switches him back. Briefed to also grep for other canon-coupled assertions defensively. Devon APPROVE on #266 stands; fix lands on the same branch and re-triggers CI.
  4. **Dispatched Kyle** to draft `design/math/sub-to-20-content.md` against Dave's research authority. Thomas pre-confirmed sub-to-20 trajectory ("day3-4: sub-to-20 (recommended)"); Dave's research now on main; Kyle is the spec-author for content-tier tickets. Retroactive ticket [86c9urdkd](https://app.clickup.com/t/86c9urdkd) filed (Kyle has no ClickUp MCP write).
- **Foundation:** `[[feedback_pr_merge_authority]]` (orchestrator merges directly) + `[[feedback_pr_review_routing]]` (Dave direct, Devon reviews Jessica) + Devon-on-Jessica APPROVE + Thomas pre-confirms on sub-to-20 trajectory + canon-coupled-spec-drift is a known forward-extension pattern (per past PRs touching canon).
- **Alternative:** Queue Kevin fix + Kyle dispatch for Thomas. Both wasteful round-trips given foundation strength.
- **Reversibility:** Each merge 1-step revert; Kevin's fix-PR same-branch reversion; Kyle's spec markdown-only.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2123 UTC — Dispatched cross-review wave (Kevin→#268, Devon→#265+#266)

- **Decided:** Devon-impl completed and PR #268 opened with all CI gates clearing on his end (2295/2295 vitest + tsc + yarn build); his + Kevin's worktrees both freed. Dispatched in parallel:
  1. **Kevin** → review Devon's PR #268 (standard Kevin-reviews-Devon routing)
  2. **Devon** → review Jessica's PR #265 AND Kevin's PR #266 in sequence within his worktree (one agent doing two reviews to avoid worktree contention)
- **Foundation:** `[[feedback_pr_review_routing]]` (Kevin reviews Devon; Devon reviews Kevin + Jessica) + 6 prior Kevin↔Devon cycles this session arc all thorough + `[[feedback_per_role_persistent_worktrees]]` (single-agent-per-worktree). Cross-PR concern flagged in Devon's brief: does Kevin's canon change interact with Devon's scaffold? Reviewer will surface if so.
- **Alternative:** Sequential — dispatch Kevin first, wait for verdict, then Devon. Wastes ~30min idle capacity.
- **Reversibility:** Reviews are advisory; orchestrator acts on verdicts. Cancel agents if needed.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 2003 UTC — Routing Jessica PR #265 cross-review behind Devon-impl PR open

- **Decided:** Sent Jessica's testid coordination finding to Devon-impl via SendMessage; DEFERRED Devon-on-Jessica-PR-review dispatch until Devon-impl PR opens. Reason: Devon has one persistent worktree (`MarianLearning-devon-wt`); concurrent review-checkout would clobber the impl agent's working state.
- **Foundation:** `[[feedback_per_role_persistent_worktrees]]` (single worktree per persona) + `[[feedback_pr_review_routing]]` (Devon reviews Jessica, established pattern — Kevin/Kyle aren't appropriate reviewers for E2E spec PRs).
- **Alternative:** Dispatch Kevin or Jessica self-review (off-pattern; merge gate not satisfied per project norms).
- **Reversibility:** Trivial — just dispatch Devon-on-Jessica-PR-review when impl PR opens.
- **Status:** accepted by Thomas 2026-05-17

## 2026-05-16 1422 UTC — Merged PR #263 (Jessica's sub-to-10 Class-2 spec re-enable)

- **Decided:** Squash-merged PR #263 with branch delete. Ticket [86c9up8u2](https://app.clickup.com/t/86c9up8u2) → COMPLETE. Tests 1+3 of `e2e/sub-to-10-distractor-class-2.spec.ts` are now ENABLED on chromium (was `test.fixme()`'d post PR #239), retargeted to post-PR-#253 widened canon. Net diff −74 LOC (190 LOC dead canned-fixture factories removed). Chip-walk race fixed via `data-problem-index` DOM gate.
- **Foundation:** `[[feedback_pr_merge_authority]]` + Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/263#issuecomment-4467069193)) + all CI green (Vercel ✅ + Playwright ✅ completed 14:15:49Z) + 2237 tests passing + Devon independently re-verified all three of Jessica's NOFs against source.
- **Alternative:** Queue for Thomas — wasteful round-trip on a spec re-enable with cross-review APPROVE.
- **Reversibility:** 1-step `git revert` on squash commit. Tests only; no runtime impact.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1403 UTC — Filed follow-up ticket for planner-vs-render `distractorClass` drift

- **Decided:** Created ticket capturing Devon NOF #1 + Jessica NOF #3 (planner directive at `_planner.ts:1014` says `distractorClass` is render-time-only; `Math.tsx:2559` then defaults `'wrong-op'` for ALL `op:'-'` problems — the two surfaces disagree on the wire contract). Ticket lays out two fix paths (Option A: amend directive prose; Option B: wire-schema bump) — does NOT commit to either; Thomas to choose at his pace.
- **Foundation:** Devon NOF #1 explicit recommendation ("worth a follow-up ticket") + Jessica NOF #3 independent surfacing of the same architectural-drift. Both reviewers verified empirically.
- **Alternative:** Leave only in the decisions log as text. Filing a ticket makes it discoverable through the normal board surface rather than buried in an away-log.
- **Reversibility:** Delete ticket; ~1 click.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1352 UTC — Dispatched Devon for PR #263 cross-review (Jessica's spec re-enable)

- **Decided:** Moved Jessica's ticket [86c9up8u2](https://app.clickup.com/t/86c9up8u2) from IN PROGRESS → IN REVIEW (Jessica had no MCP access, flagged in hand-back). Background-dispatched Devon to cross-review PR #263 (Path A — both fixme'd tests re-enabled against PR #253's widened canon + ~190 LOC dead canned-fixture removal + chip-walk race fix via `data-problem-index` DOM gate).
- **Foundation:** `[[feedback_pr_review_routing]]` (spec PRs from Jessica still need cross-review per project norms; Devon is the right reviewer per the wider pattern); Jessica's hand-back has 3 substantive NOFs worth peer-validating.
- **Alternative:** Auto-merge without review (foundation: Jessica is the spec author, her own verification is high-trust). Skipping for now because the PR is non-trivial (448 LOC diff, race fix, mock-pattern switch) and Devon's empirical re-verify catches recent bugs consistently.
- **Reversibility:** Cancel agent if needed.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1318 UTC — Dispatched Jessica on sub-to-10-distractor-class-2 test.fixme re-enablement

- **Decided:** Created ticket [86c9up8u2](https://app.clickup.com/t/86c9up8u2) + dispatched Jessica (background) to investigate whether `e2e/sub-to-10-distractor-class-2.spec.ts` test 1+3 (currently `test.fixme()`'d from PR #239) can be re-enabled against PR #253's widened canon. Brief gives Jessica two paths: Path A (re-enable + retarget P-slots) or Path B (update fixme TODO if structurally blocked).
- **Foundation:** Session pickup § Next steps item 5 explicit + PR #253 widened pool includes new Class-2-eligible facts at P3/P7/P8 that may satisfy original assertions + Jessica is the spec author so she has warm context.
- **Alternative:** Skip and leave the `test.fixme()` stopgap indefinitely — would leave defense-in-depth gap silently.
- **Reversibility:** Test changes; ~1 PR effort; Path B is doc-comment only.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1315 UTC — Merged PR #262 (compositionLint.test.ts cosmetic polish)

- **Decided:** Squash-merged PR #262 with branch delete. Ticket [86c9up2b0](https://app.clickup.com/t/86c9up2b0) → COMPLETE. Two cosmetic touch-ups: sub-to-10 parser error messages now say "in bullet prose" (matches function name + dual-source contract); `extractTierBlock` has a NOTE comment about the mult-6-9 `- read:` lookahead gotcha.
- **Foundation:** `[[feedback_pr_merge_authority]]` + Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/262#issuecomment-4466890577)) + all CI green (Vercel ✅ + Playwright ✅ completed 13:04:47Z) + 10-LOC pure cosmetic + 2237 tests passing.
- **Alternative:** Queue for Thomas — wasteful round-trip on a cosmetic-only PR with cross-review APPROVE.
- **Reversibility:** 1-step `git revert` on squash commit.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1243 UTC — Dispatched Devon for PR #262 cross-review (cosmetic polish)

- **Decided:** Background-dispatched Devon to cross-review PR #262. Reflexive on Kevin's hand-back. 6th Kevin-Devon cycle this session arc.
- **Foundation:** `[[feedback_pr_review_routing]]` + closes the loop on Devon's own two non-blocking NOFs (so Devon validating Kevin's reading of his own flags is operationally clean).
- **Alternative:** Skip review since it's 10-LOC cosmetic — would skip the established gate that's been catching small issues consistently.
- **Reversibility:** Cancel agent if needed.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1234 UTC — Dispatched Kevin on cosmetic-polish batch + doc-promoted Kevin's annotation-style NOF

- **Decided:** (a) Created ticket [86c9up2b0](https://app.clickup.com/t/86c9up2b0) + dispatched Kevin on a batched cosmetic polish in `scripts/compositionLint.test.ts`: drop "in directive prose" wording from sub-to-10 parser error messages (Devon nit on PR #261) + add `extractTierBlock` caller-side comment about mult-6-9 `- read:` lookahead gotcha (Devon NOF #2 on PR #259). (b) Directly edited `.claude/docs/planner-and-canon.md` to promote Kevin's NOF #1 from PR #253 ("annotation-style switches must audit which old annotations were structurally load-bearing on Haiku attention") into the canon-engineering section near "Why self-check blocks aren't enough on their own."
- **Foundation:** Both are explicit NOFs from prior PRs flagged for follow-up. Cosmetic dispatch is foundation-backed (2 Devon NOFs) + reversible (~20 LOC). Doc-promotion has clean target section + matches the meta-pattern shape used by sibling promotions this session.
- **Alternative:** Defer both indefinitely as low-priority. Would idle the team during otherwise-quiet AWAY tick.
- **Reversibility:** Cosmetic PR revertable in 1 step; doc edit revertable inline.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1222 UTC — Merged PR #261 (parser rename for dual-source clarity)

- **Decided:** Squash-merged PR #261 with branch delete. Pure cosmetic rename — `parseAddToTenBandSlotsFromSpec` → `parseAddToTenBandSlotsFromBulletProse` + `parseDirectiveBandSlots` → `parseSubToTenBandSlotsFromBulletProse`. Ticket [86c9unvwq](https://app.clickup.com/t/86c9unvwq) → COMPLETE.
- **Foundation:** `[[feedback_pr_merge_authority]]` + Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/261#issuecomment-4466784087)) + all CI green (Vercel ✅ + Playwright ✅ completed 12:18:48Z) + pure rename / zero semantic change / 0 grep hits on old names.
- **Alternative:** Queue for Thomas review — wasteful round-trip on a CI-green refactor with cross-review APPROVE.
- **Reversibility:** 1-step `git revert` on squash commit. Internal identifiers only; no runtime exposure.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1206 UTC — Dispatched Devon for PR #261 cross-review (parser rename)

- **Decided:** Background-dispatched Devon to cross-review Kevin's PR #261 (pure rename of `parseAddToTenBandSlotsFromSpec` + `parseDirectiveBandSlots` to dual-source-clarity names). Standard Devon-reviews-Kevin routing — 5th cycle this session arc.
- **Foundation:** `[[feedback_pr_review_routing]]` + every prior Kevin→Devon cycle this session has been thorough (PR #256, #257, #258, #259) + this is a pure cosmetic rename with no logic change.
- **Alternative:** Skip review since it's mechanical — would skip the gate that's been catching small issues across the wave.
- **Reversibility:** Cancel agent if needed; review is advisory.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1146 UTC — Dispatched Kevin on parser-rename follow-up (NOF #2 from PR #259)

- **Decided:** Created ClickUp ticket [86c9unvwq](https://app.clickup.com/t/86c9unvwq) + dispatched Kevin (background) to rename `parseAddToTenBandSlotsFromSpec` → `parseAddToTenBandSlotsFromBulletProse` and `parseDirectiveBandSlots` → `parseSubToTenBandSlotsFromBulletProse`. Both parsers became dual-source (spec markdown OR directive prose) after PRs #257 and #259's regex loosening.
- **Foundation:** Kevin NOF #2 from PR #259 explicit recommendation ("future PR could rename it with a parallel rename of `parseDirectiveBandSlots` since the same generalization applies") + Devon NOF #2 from PR #257 made the same observation.
- **Alternative:** Defer indefinitely as "cosmetic" — current names work, comments document dual-source behavior.
- **Reversibility:** Trivial revert; ~30-50 LOC pure rename in test file.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1146 UTC — Merged PR #259 (add-to-10 directive sharpening + drift-guard re-wire)

- **Decided:** Squash-merged PR #259 with branch delete. Lifted SESSION COMPOSITION RULES block from `design/math/add-to-10-content.md` §2.1 + §4.1 into `api/_planner.ts:921-963` (paralleling sub-to-10's :1002-1012), added `extractTierBlock` tier-scoping helper, re-wired drift-guard to parse both sub-to-10 and add-to-10 from MATH_TRACK_GUIDE. Ticket [86c9unq8x](https://app.clickup.com/t/86c9unq8x) → COMPLETE.
- **Foundation:** `[[feedback_pr_merge_authority]]` + Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/259#issuecomment-4466709415)) + all CI green (Vercel ✅ + Playwright ✅ completed 11:41:38Z) + verified no canon re-bake triggered (Kevin + Devon both confirmed `yarn build` ran incrementally with "canon up-to-date") + 2237 tests pass.
- **Alternative:** Queue for Thomas because directive prose change has future-bake implications.
- **Reversibility:** 1-step `git revert` on squash commit. Important: this PR ships with **no canon re-bake** — `public/canon/math/level-1/add-to-10.json` is unchanged. The new directive prose becomes active only on next `--force` canon regen (which is a separate Thomas decision). For now, Haiku continues using the old (looser) directive on cached canon, but the lint backstop is in place AND the new tighter directive will apply at next bake-time.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1131 UTC — Filed ClickUp ticket retroactively for PR #260 (subitising scaffold spec)

- **Decided:** Created ClickUp task [86c9unu9u](https://app.clickup.com/t/86c9unu9u) directly in IN REVIEW state (PR #260 was already open). Kyle's agent context had no ClickUp MCP access; brief specified ticket creation; orchestrator filled the gap.
- **Foundation:** Dispatch brief explicitly tells Kyle to file the ticket "if you have access" + `[[feedback_clickup_forward_only_default]]` (forward-only ticketing for new dispatches; this PR was a new dispatch this session).
- **Alternative:** Skip the retroactive filing — would leave PR #260 unticketed and break the forward-only ticketing rule.
- **Reversibility:** Delete the ClickUp task; ~1 click.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1120 UTC — Dispatched Kyle on `tkt-subitising-scaffold-spec`

- **Decided:** Routed the pre-tracked subitising-scaffold spec ticket to Kyle (background dispatch). Markdown deliverable; design choices (dot pattern, count thresholds) belong inside the spec PR for Thomas's review at landing, not the dispatch decision.
- **Foundation:** Session pickup `sessions/session-2026-05-16-0902-...md` § Next steps item 2 (Kyle's 3 remaining `tkt-*` follow-ups from PR #251 §9.4) + Dave's research `design/research/add-to-10-counting-to-recall.md` Priority 2.
- **Alternative:** Queue for Thomas to confirm priority order, or wait for more backlog signal.
- **Reversibility:** Markdown-only PR; can be revised, scope-trimmed, or closed at review without code impact. ~1 PR effort.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1120 UTC — Dispatched Devon for PR #259 cross-review

- **Decided:** Background-dispatched Devon to cross-review Kevin's PR #259 (add-to-10 directive sharpening + drift-guard re-wire). Standard Devon-reviews-Kevin routing.
- **Foundation:** `[[feedback_pr_review_routing]]` (sponsor only for big design + iPad testing; Devon reviews Kevin); this is the 4th Devon-reviews-Kevin cycle in this session arc — pattern is solid and Devon's prior reviews (PR #256, #257, #258) have all been thorough.
- **Alternative:** Pause and ask "who reviews?" — wasteful round-trip on an unambiguous pattern.
- **Reversibility:** Background agent; cancel via TaskStop if needed. Review itself is advisory until orchestrator acts on the verdict.
- **Status:** accepted by Thomas 2026-05-16

## 2026-05-16 1120 UTC — Merged PR #258 (rename `take-from-10-coverage` → `high-leverage-coverage`)

- **Decided:** Squash-merged PR #258 with branch delete. Pure mechanical refactor (15 occurrences across 3 files), no semantic change, no canon re-bake.
- **Foundation:** `[[feedback_pr_merge_authority]]` (orchestrator merges directly; only escalate for big design or iPad testing) + Devon APPROVE on file ([comment](https://github.com/TSandvaer/MarianLearning/pull/258#issuecomment-4466646173)) + all CI green (Vercel ✅ + Playwright ✅ completed 11:13:38Z) + ticket [86c9unmrk](https://app.clickup.com/t/86c9unmrk) ratifying the rename.
- **Alternative:** Queue for Thomas review — wasteful round-trip on a CI-green test-only refactor with cross-review APPROVE.
- **Reversibility:** 1-step `git revert` on the squash commit; ~1 PR effort. Rule key is internal only (no canon/runtime exposure).
- **Status:** accepted by Thomas 2026-05-16

---

<!-- New entries appended above this line, newest at top. Add new entries between this marker and the previous entry. -->

---

# Queued for Thomas review (NOT auto-decided)

These items hit the never-auto-decide list and are surfaced for your sign-off on return. Each entry names the never-list category that triggered the queue.

## 2026-05-16 2155 UTC — PR #269: Sub-to-20 content-tier spec (689 LOC markdown)

- **Item:** Merge or revise [PR #269](https://github.com/TSandvaer/MarianLearning/pull/269) — Kyle's content-tier spec for sub-to-20 (drafted against Dave's research from PR #267, which you confirmed as next math tier 2026-05-16).
- **Never-list category:** **Curriculum-design + scope-defining.** Kyle authored 5 explicit Thomas-decision-pending open questions in §7. Most consequential is §7.1 (`18-9=9` strict-vs-loose no-borrow definition — Kyle flagged an internal contradiction in Dave's research and substituted `19-9=10`; spec ships strict, flags v2 widening as your call).
- **§7 open questions:**
  - §7.1 — `18-9=9` inclusion / strict-vs-loose no-borrow. Dave's research §4.1 says strict-no-borrow EXCLUDES `18-9=9` (since ones-digit 8 < subtrahend 9 — but result 9 is positive — so the strict-no-borrow rule and the result≥2 rule disagree). Kyle ships strict (excludes `18-9=9`), uses `19-9=10` as the closest HARD anchor. Your call: ratify strict, or widen to include `18-9=9` as a fact-family exception?
  - §7.2 — "take away" framing copy variant for sub-to-20 (defaults to NO; sub-to-10 first-session warmup already internalised). Subjective tone call.
  - §7.3 — Parallel add-to-20/sub-to-20 sequencing — Dave's NOF #5 (McNeil 2025): counterintuitive but research-supported. Brief you on the model: Marian will be `sub-to-20:practicing` while `add-to-20` is still not mastered. Confirm acceptance.
  - §7.4 — `maxAnswer` ceiling 19 vs 20 (inherits 20 from existing widening — likely auto-accept on read).
  - §7.5 — Slow-fact threshold 7000ms proposed; calibrate post-empirical-data.
- **Recommendation:** Read §7.1 first (the big strategic call), then §0/§1/§2 for scope+pool, then §3 (Class B = new distractor class, NEW for this tier). The 22-fact pool curation and Class B formula are Kyle's locked output; defer to him on those mechanics unless §7.1 changes the pool.
- **Blockers downstream:** Implementation (Kevin lint extension + Devon trigger predicate + Jessica failing-first E2E) is blocked on spec landing. Sub-to-20 is **not Marian's active tier** today, so no immediate empirical urgency.
- **Status:** resolved 2026-05-17 — all 5 §7 defaults accepted; PR #269 merged; next wave dispatched

## 2026-05-16 1131 UTC — PR #260: Subitising scaffold spec (574 LOC markdown)

- **Item:** Merge or revise [PR #260](https://github.com/TSandvaer/MarianLearning/pull/260) — Kyle's design spec for dot-pattern visual subitising for add-to-10 EASY band.
- **Never-list category:** **Curriculum-design + subjective-feel.** Kyle authored 6 explicit Thomas-decision-pending open questions in §7 (the `5+5` edge case, sub-to-10 extension, multiplication extension, relationship to existing dot-card affordance, voice change, hint-on-tap). Auto-merging would silently default the questions.
- **Recommendation:** Read §7 first (6 open Qs with Kyle's recommended defaults), then §0 / §1 / §2 for scope + visual + trigger. Kyle's NOF #1 flags an existing related spec at `design/screen-math-subitising-prompt.md` that pairs with this one (screen-layer + content-tier — not redundant).
- **Blockers downstream:** Implementation PR (Kevin/Devon) is blocked on spec landing. Subitising affects Marian's active tier so the scaffold ships once spec is approved.
- **Status:** resolved 2026-05-16 — all 6 §7 Kyle defaults accepted; PR #260 merged

## 2026-06-13T21:48:06Z — Merge PR #431 (simple-sentences scene pack)

- **Decided:** merged #431 — 8 gentle scene SVGs + SCENE_PICTURES wired; simple-sentences tier renders scenes (was text-only fallback).
- **Foundation:** routine-PR-merge auto-decide (CLAUDE.md orchestrator-autonomy rule 6) — Kevin APPROVE verdict + fast-gate SUCCESS + e2e SUCCESS on sha a041c55f0474dfef0d6158f2b5c34b40a808a3eb.
- **Alternative:** queue for Thomas — unnecessary, no infra/strategic scope.
- **Reversibility:** git revert, ~1 PR.
- **Status:** accepted by Thomas 2026-06-14 (sponsor-questions-walkthrough)

## 2026-06-13T22:25:26Z — Merge PR #432 (cat-sat-mat NITs fixture sweep)

- **Decided:** merged #432 — swept stale "The cat \_\_\_ the mat." refs from hand-mock fixtures/docstrings (#430 NITs, ticket 86ca8fvm7).
- **Foundation:** routine-PR-merge auto-decide (CLAUDE.md orchestrator-autonomy rule 6) — Devon APPROVE verdict + fast-gate SUCCESS + e2e SUCCESS on sha 3a11bffa1ecbfef8d6e0b2a47902f4aa2a96e549.
- **Alternative:** queue for Thomas — unnecessary, mechanical fixture-only cleanup.
- **Reversibility:** git revert, ~1 PR.
- **Status:** accepted by Thomas 2026-06-14 (sponsor-questions-walkthrough)

## 2026-06-14 1147 UTC — Away tick: route #437 review to Devon + file #439 NIT follow-up

- **Decided:** (a) Dispatched Devon to code-review PR #437 (Kyle picture-pack v7) now he is free from the #439 review. (b) Filing a chore ticket for the stale/wrong comment at wordPack.ts:1606-1607 (Devon #439 NIT — it asserts a planner-side foil table that does not exist, the false premise that masked the bit-throw bug).
- **Foundation:** review-routing auto-decide (Kyle PR -> Devon reviewer) + NITs-ticket-from-APPROVE_WITH_NITS, both orchestrator-autonomy rule 6.
- **Alternative:** hold #437 review until sponsor returns (idles Devon, delays merge).
- **Reversibility:** review is read-only + a PR comment; NIT ticket is a backlog entry. Both trivial.
- **Status:** pending review

## 2026-06-14 1154 UTC — Away tick: merge 3 gate-cleared PRs

- **Decided:** Merged #436 (Dave phonetic-v2 research, merge-direct), #438 (Jessica failNetwork audit, merge-direct), #437 (Kyle picture-pack v7, Devon APPROVE_WITH_NITS). All three: fast-gate + Playwright SUCCESS.
- **Foundation:** research/audit merge-direct routing + peer-review-APPROVE merge auto-decide (orchestrator-autonomy rule 6); both CI gates verified green this tick.
- **Alternative:** hold all merges for sponsor return (no benefit; gates fully met).
- **Reversibility:** each squash-merge revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1206 UTC — Away tick: merge #439 + dispatch Jessica on mock-helper consolidation

- **Decided:** (a) Merged #439 (Kevin bit-throw fix, ticket 86ca8jdt6) — Devon APPROVE_WITH_NITS + fast-gate + Playwright SUCCESS. (b) Dispatched Jessica on 86c9y490t (promote canon-bytes mock helper to e2e/\_helpers/mockClaude.ts; 3rd-adopter threshold crossed; mechanical tech-debt refactor).
- **Foundation:** peer-review-APPROVE merge auto-decide (rule 6) + CI green; mock-helper is a foundation-backed reversible refactor (testing-and-ci.md 4.2.3 promotion rule, threshold met), lane-matched to Jessica (e2e), NOT a feature direction.
- **Alternative:** hold both for sponsor return (no benefit; gates met / mechanical).
- **Reversibility:** each revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1222 UTC — Away tick: Jessica #440 done -> route review to Kevin + file two-digit-addsub follow-up

- **Decided:** (a) Jessica completed mock-helper consolidation (PR #440, ticket 86c9y490t); dispatching Kevin to code-review (e2e test-infra refactor; 3 specs pass, grep success-test clean). (b) Filing a follow-up ticket to migrate the 4th clone installTwoDigitAddsubCanonClaudeMock in two-digit-addsub.spec.ts to the shared helper (Jessica finding #2 - 5 instances exist, not 3; left out of scope this PR).
- **Foundation:** review-routing auto-decide (Jessica e2e PR -> Kevin/Devon dev reviewer); follow-up-ticket-from-finding (mechanical, foundation-backed by Jessica report).
- **Alternative:** hold review for sponsor (idles PR, delays merge); skip follow-up (loses 4th-clone debt).
- **Reversibility:** review read-only + comment; ticket is a backlog entry.
- **Status:** pending review
- **Surface to sponsor:** port-4173 hygiene - Jessica e2e was blocked by an orphaned vite preview (PID 28188) from kevin-wt; she killed it + re-ran green. Recurring cross-worktree cleanup gap (orchestration-concurrency.md 1.2). Worth a stale-preview sweep between e2e dispatches.

## 2026-06-14 1306 UTC — Away tick: merge #440 + dispatch 4th-clone follow-up

- **Decided:** (a) Merged #440 (Jessica mock-helper consolidation, ticket 86c9y490t) — Kevin APPROVE + fast-gate + Playwright SUCCESS (e2e ran long ~33min but completed green, not a hang). (b) Dispatching Jessica on the now-unblocked follow-up 86ca8ncay (migrate 4th clone installTwoDigitAddsubCanonClaudeMock to the shared helper).
- **Foundation:** peer-review-APPROVE merge auto-decide (rule 6) + CI green; follow-up is mechanical, foundation-backed (Jessica #440 finding), unblocked by #440 on main.
- **Alternative:** hold for sponsor (no benefit; gates met / mechanical).
- **Reversibility:** each revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1315 UTC — Away tick: Jessica #441 done -> Kevin reviews #441 + Devon fixes wordPack NIT

- **Decided:** (a) Jessica completed 4th-clone migration (PR #441, ticket 86ca8ncay); dispatching Kevin to review (mechanically identical to #440 he already reviewed). (b) Dispatching Devon on 86ca8n7mm - correct the stale/wrong wordPack.ts:1606 comment (the false "foils never from TARGET_PAIRINGS" premise that masked the bit-throw bug); comment-only.
- **Foundation:** review-routing auto-decide (Jessica e2e PR -> Kevin); NIT-fix foundation-backed (Devon #439 review NIT + documented invariant in skill-trees-and-content.md).
- **Alternative:** hold for sponsor (idles 4 personas; minor NITs drain autonomously via away cycle).
- **Reversibility:** review read-only; comment fix revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1323 UTC — Away tick: Devon #442 done -> Kevin reviews; doc-commit gap flagged

- **Decided:** Devon completed wordPack-comment NIT (PR #442, ticket 86ca8n7mm; comment-only, vitest green); dispatching Kevin to review; flipping 86ca8n7mm -> IN REVIEW.
- **Foundation:** review-routing auto-decide (Devon PR -> Kevin reviewer).
- **Alternative:** hold for sponsor (idles Kevin; trivial review).
- **Reversibility:** review read-only.
- **Status:** pending review
- **SURFACE TO SPONSOR (process gap, NOT auto-decided):** All maintain-docs .claude/docs edits this session (emma-character-and-animation re-trace/park lessons; orchestration-concurrency checkout-gotcha + orphaned-preview; skill-trees-and-content DISTRACTOR_ONLY_WORDS invariant) are UNCOMMITTED in the main working tree - maintain-docs never commits by design, so theyre not on origin/main and personas off main dont see them (Devon hit this on #442). Matches pre-session state (files already M at session start). Not auto-committing - landing accumulated .claude/docs edits (PR vs direct-push) is your call; recommend a docs(.claude) capture commit on return.

## 2026-06-14 1406 UTC — Away tick: merge #441 + #442 (both Kevin-approved, e2e green)

- **Decided:** Merged #441 (Jessica 4th-clone migration, ticket 86ca8ncay) + #442 (Devon wordPack comment fix, ticket 86ca8n7mm). Both: Kevin APPROVE + fast-gate + e2e SUCCESS (e2e ran ~40min slow, not hung).
- **Foundation:** peer-review-APPROVE merge auto-decide (rule 6) + CI green.
- **Alternative:** hold for sponsor (no benefit; gates met).
- **Reversibility:** each revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1451 UTC — Away tick (quiescent): draft session retro

- **Decided:** Board quiescent (0 PRs, 0 agents). Drafting a lean retro at .claude/retros/retro-2026-06-14-away-cleanup.md for the 7-PR cluster (#436-#442; #435 parked) per the retro convention.
- **Foundation:** retro-post-merge convention (draft once >=3 merged PRs cluster); 7 merged this session. Reversible doc, not sponsor-gated, not a feature direction. Good use of quiescent away-time.
- **Alternative:** leave for sponsor/next session (loses fresh-context synthesis).
- **Reversibility:** doc; trivially revertable. Uncommitted on main like other session docs (see doc-commit gap).
- **Status:** pending review

## 2026-06-14 1730 UTC — SPONSOR DECISION (walkthrough): next direction = cloudSync P1

- **Decided (Thomas):** Next work = cloudSync history-merge P1 data-loss fix (ticket 86c9qa6na). Dispatch on walkthrough close.
- **Status:** accepted

## 2026-06-14 1730 UTC — SPONSOR DECISION (walkthrough): doc-commit = docs PR

- **Decided (Thomas):** Land this session uncommitted .claude/docs edits + the retro as a docs(.claude) session-capture PR (CI-gated, merge on green). Open on walkthrough close.
- **Status:** accepted

## 2026-06-14 1733 UTC — SPONSOR DEFERRED (walkthrough): skirt-color needs a visual

- **Decided (Thomas, verbatim):** "I need to see it to judge, my head dont translate hex codes"
- **Action:** orchestrator building a terracotta-vs-mauve skirt swatch for visual judgment; skirt-color canon decision deferred until Thomas sees it.
- **Status:** deferred-pending-visual

## 2026-06-14 1739 UTC — SPONSOR DECISION (walkthrough): skirt = terracotta canonical

- **Decided (Thomas):** Keep terracotta #d1805c as canonical; UPDATE the bible --emma-skirt token #C8AAB8 -> #d1805c (no asset change). Decided after viewing the rendered swatch.
- **Action:** bible token edit + emma §12 note resolution folded into the docs-capture PR.
- **Status:** accepted

## 2026-06-14 1754 UTC — Away tick: Devon #444 (cloudSync P1) done -> Kevin reviews

- **Decided:** Devon completed cloudSync data-loss fix (PR #444, ticket 86c9qa6na); dispatching Kevin to review. KEY review point: validate the mergeSessionHistories dedupe key (dateISO|skillFocus|successRate) is correct - Devon found the ticket-proposed fields (startedAtISO/problemCount) do not exist; a too-loose key would wrongly dedupe distinct sessions (still data-loss). Kevins data-correctness call.
- **Foundation:** review-routing (Devon PR -> Kevin) + Devon explicitly flagged the dedupe-key question for Kevin.
- **Alternative:** hold for sponsor (its a P1 + has a real correctness question; Kevin is the right gate, not Thomas).
- **Reversibility:** review read-only.
- **Status:** pending review

## 2026-06-14 1835 UTC — Away tick: merge #443 (docs) + #444 (cloudSync P1)

- **Decided:** Merged #443 (docs-capture, sponsor-authorized via walkthrough) + #444 (cloudSync P1 data-loss fix, ticket 86c9qa6na, Kevin APPROVE). Both fast-gate + e2e SUCCESS (e2e ran ~45-55min slow, not hung).
- **Foundation:** sponsor-authorized docs + peer-review-APPROVE merge (rule 6) + CI green.
- **Alternative:** none (gates fully met).
- **Reversibility:** each revertable in 1 PR.
- **Status:** pending review

## 2026-06-14 1851 UTC — Away tick: dispatch beyblade IP-scrub (last clean item)

- **Decided:** Board drained after cloudSync; dispatching Kyle on the deferred beyblade IP-scrub (mj-prompts-paste-ready-2026-05-10.md ~L240 top --no block) to fully clear the board. Untickered sub-threshold NIT; Devon reviews.
- **Foundation:** Devon #437 review NIT + Kyle own #437 finding (beyblade flagged borderline-IP). Reversible doc edit, not a feature direction, auto-decidable (4 gates pass).
- **Alternative:** keep deferring (leaves a known IP-rule violation in a committed prompt artifact).
- **Reversibility:** doc edit, 1 PR.
- **Status:** pending review

## 2026-06-14 1854 UTC — Away tick: Kyle #445 (beyblade scrub) done -> Devon reviews

- **Decided:** Kyle completed the beyblade IP-scrub (PR #445; 3 instances de-branded, grep-zero); dispatching Devon to review. Trivial docs/prompt scrub.
- **Foundation:** review-routing (Kyle PR -> Devon).
- **Reversibility:** review read-only.
- **Status:** pending review

## 2026-06-14 1935 UTC — Away tick: merge #445 (beyblade scrub)

- **Decided:** Merged #445 (Kyle beyblade IP-scrub, Devon APPROVE, fast-gate + e2e SUCCESS). Untickered NIT, no ticket flip. Board now 100% clean.
- **Foundation:** peer-review-APPROVE merge (rule 6) + CI green.
- **Status:** pending review

## 2026-06-14 2317 UTC — Away-mode armed; first orchestration pass

- **Decided:** Armed auto-status AWAY (cron d18a9c59, 15-min). Dispatched Kevin to cross-review Devon's Leitner tuning PR #452 (box2 2->1, box3 4->3, LEITNER_DUE_PER_SESSION_CAP=3).
- **Foundation:** cross-review routing (Kevin reviews Devon) per feedback_pr_review_routing; tuning was Thomas-approved via AskUserQuestion this session.
- **Alternative:** hold #452 review until Thomas returns — rejected; review is reversible and merge-gated.
- **Reversibility:** unmerged PR; no merge without green CI + APPROVE. ~0 effort to halt.
- **Status:** pending review

### Pending Thomas sign-offs (queued this session, NOT auto-decided)

- **Voice-QA ear-test** — 3 round-6 clips (recap.4, number-recog#math.p6.hint, streak.4) on https://marian-learning.vercel.app/voice-qa.html (#448 merged to prod). 5 timbre clips accepted as model-floor. If any of the 3 miss -> A/B audition (FOUR scaffold), not blind round-7.
- **Wave-16 direction** — Leitner wave (M4 #447 / M5 #451 / tuning #452) closing; candidates: two-digit-regroup WITH-regroup (86c9xwjtr), CVC review-mode (86c9qa6n3).
- **Kyle Emma-polish** (breathing-loop / rotateZ tilt) — off current direction, held.
- **Dave Wave-16 pre-research** — offered, held.

## 2026-06-14 2333 UTC — Away: M5 recap-beat P1 (Jessica QA #453) — #451 HELD for Thomas

- **Finding (Jessica QA, PR #453, evidence-backed P1):** the M5 session-end focus-recap line is SILENT + INVISIBLE on a real device pre-bake. SessionEnd's "silent fallback fires onWordTick(0)" only runs when playUtteranceFn is undefined (unit-test path). The running App supplies the real playSessionUtterance, which REJECTS on the unbaked `session.end.recap.focus` id (sessionAudio.ts:472); SessionEnd swallows it -> phase delay with no audio + no caption (a dead pause). Unit tests miss it because createFakePlayUtterance fires onWordTick for any id.
- **Decision (HELD, NOT auto-fixed):** #451 (M5) held from merge — real QA P1, and #451 was not yet e2e-green anyway so holding costs nothing. The fix DIRECTION is a design call (touches the audio-first principle + the #453 e2e contract), so queued for Thomas rather than auto-dispatched.
- **Recommendation (one team rec):** BAKE `session.end.recap.focus` (M5 already emits the planner directive for it) so the recap line has AUDIO (audio-first-aligned), then ear-test. For the pre-bake interim, have Devon make the recap beat gracefully SKIP when the utterance id is unavailable (no dead pause; avoids a silent caption, which would itself violate audio-first). NB: graceful-skip makes Jessica's #453 "phase appears" assertion fail pre-bake, so #453 gets gated on the baked clip. Net: one Devon fix-PR (graceful-skip + adjust #453) + one canon bake (Thomas ear-test).
- **Independent of this:** #452 (tuning, Kevin APPROVE) and #450 (research, direct) still merge on green CI — NOT blocked by the recap issue.
- **Status:** ACCEPTED (Thomas 2026-06-14) — bake audio + graceful-skip interim. Devon dispatched on the skip-fix (amends #451); recap-audio bake is the follow-up (depends on #451; per-node-vs-assembled is a dev call; Thomas ear-tests the new clip). See the walkthrough-resolutions entry below.

## 2026-06-14 2342 UTC — Sponsor walkthrough + /whip resolutions

- **M5 recap-beat fix:** Thomas chose bake-audio + graceful-skip interim. Devon dispatched (graceful-skip on #451); recap-audio bake = follow-up (post-#451-merge; per-node-vs-assembled is a dev call).
- **Wave-16 direction:** CVC review-mode (86c9qa6n3). Dave dispatched on the approach research (dave/cvc-review-research).
- **Kyle Emma-polish:** KEEP DEFERRED (Thomas). Kyle's next work is the CVC review-mode UI (after Dave's research lands). Emma breathing-loop / rotateZ-tilt polish stays backlogged.
- **Voice-QA ear-test:** still pending Thomas's ACTION — 3 round-6 clips on https://marian-learning.vercel.app/voice-qa.html (5 timbre clips accepted as model-floor).

## 2026-06-14 2353 UTC — CVC review-mode build: MVP greenlit (phoneme-blend prompt)

- **Decided (Thomas, AskUserQuestion):** Build CVC review-mode (86c9qa6n3) MVP-first = Dave's phoneme-blend prompt on the 2nd wrong tap (highest-value element). Full design (incremental-rehearsal composition / per-word tiering / distractor gating) deferred to a later expansion.
- **Action:** Kyle dispatched on the phoneme-blend prompt UX design brief (kyle/cvc-phoneme-blend-prompt-design). Devon/Kevin implement after Kyle's design + once the M5 fix lands; new Emma blend audio -> bake + Thomas ear-test.
- **Foundation:** Dave's research #454; Thomas's CVC direction + MVP-first picks (this session).

## 2026-06-15 0130 UTC — Wave fully drained; CVC MVP code build dispatched

- **Merged (board now 0 open PRs):** #447 (M4 spaced-schedule), #448 (voice-QA), #450 (Leitner research), #451 (M5), #452 (Leitner tuning), #454 (CVC research), #455 (CVC design), #449 (reset-e2e), #453 (recap-e2e graceful-skip lock). Full Leitner + M5 + CVC-research/design wave is on main.
- **Decided (away):** Dispatched Devon on the CVC phoneme-blend MVP **code** build (86c9qa6n3, branch devon/86c9qa6n3-cvc-phoneme-blend). Foundation: Thomas greenlit MVP-first + Kyle's #455 spec (merged); Kyle confirmed his 3 audio questions are NOT implementation blockers, so the code is safe to build in away mode. Audio bake + the 3 questions stay Thomas-gated. Reversibility: unmerged PR.
- **QUEUED for Thomas (audio/ear gates — NOT auto-decided):**
  1. **Voice-QA ear-test** — 3 round-6 clips on https://marian-learning.vercel.app/voice-qa.html (still pending his ear).
  2. **CVC blend audio bake** + Kyle's 3 questions (soft lead-in "Listen."; em-dash iPad render; `/ks/` phoneme ear-test) — after Devon's code build lands.
  3. **Recap-audio bake** (`session.end.recap.focus`) — M5's recap is silent pre-bake (graceful-skip); needs the per-node-vs-assembled dev call + bake + ear-test.

## 2026-06-15 0218 UTC — CVC blend consumer pipeline shipped (#456); follow-ups queued

- **Devon's CVC blend MVP consumer pipeline → PR #456** (slot + parser + \_tts `renderBlendInnerText` + WordSong 2nd-wrong-tap wiring + graceful-skip-to-hint + LetterGlyph highlight; vitest 3298 pass, e2e green). Dispatched Kevin to review. Code-complete but INERT until blend is "lit up" (below).
- **Blocked invariant (Devon):** the 6th `blend` slot collides with `SYSTEM_PREAMBLE` "exactly 5 utterances" + "8×5+20=60 entries" (drift-guarded by `_planner.test.ts` AC#1). Lighting up blend needs a coordinated planner-directive + preamble + ids-contract + max_tokens change (Kevin task) + the Thomas-gated canon bake. QUEUED as the next CVC sub-phase.
- **QUEUED for Thomas/Kyle:**
  - Devon's Q2: canon text stored ASCII-7 (`c - a - t ... cat`) instead of Kyle's spec em-dash/ellipsis — `canonLint` forbids non-ASCII (PR #192 mojibake rule). Transform/highlight accept the unicode form defensively. Needs Kyle/Thomas sign-off that ASCII-7-stored (+ optional caption prettify) is acceptable.
  - The blend audio bake (`word.p1..p8.blend`, text shape `c - a - t ... cat`) — after the planner light-up; Thomas ear-test.
- **Mechanical follow-up ticket:** pre-existing reprompt-overlap race (2nd wrong tap during an in-flight reprompt can bail the hint/blend schedule) — Devon finding #3, not introduced by #456.

## 2026-06-15 0221 UTC — TICKET MISMATCH (orchestrator error): #456 is NOT 86c9qa6n3

- **My error:** I ran Dave-research → Kyle-design → Devon-build (#456, the phoneme-blend prompt) under ticket 86c9qa6n3 WITHOUT reading the ticket body first (violated feedback_inject_ticket_body on the Wave-16 pick). 86c9qa6n3 is actually a DIFFERENT feature: "CVC review mode — make cross-vowel mix fire (post-mastery picker revisit)" — a `pickCvcReviewNode` session-picker change (focusNode.ts / mastery.ts / App.tsx) with an ALREADY-LOCKED mechanic (Option C-then-B; researched in the EXISTING design/research/cvc-review-mode-mechanic.md). Dave's NEW research (#454, cvc-review-mode-marian.md) is within-tier consolidation — Dave himself flagged the two as "complementary, not duplicative," which I missed.
- **What IS true:** Thomas affirmatively clicked "MVP: phoneme-blend prompt first" in the Wave-16 popup, so the phoneme-blend feature IS wanted — it was just mis-presented as 86c9qa6n3's scope.
- **Correction (away):** Reverted 86c9qa6n3 -> TO DO (its cross-vowel-firing work is UNBUILT; mechanic ready). #456 (phoneme-blend) is good, reviewed-clean work but MIS-TICKETED — merge HELD pending Thomas. Kevin's review continues (still useful).
- **QUEUED for Thomas (decide on return):**
  1. Re-ticket #456 (phoneme-blend prompt) under its own ticket + merge it? (You approved the feature; it just needs a correct ticket — not 86c9qa6n3.)
  2. The ACTUAL 86c9qa6n3 (cross-vowel-mix-firing, pickCvcReviewNode, mechanic locked/ready) — build it next?
- **Process fix:** ALWAYS fetch + read the ClickUp ticket body before dispatching research/design/build. Skipped it on the Wave-16 pick → built the wrong feature.

## 2026-06-15 0527 UTC — Thomas back (walkthrough): CVC = ship the phoneme-blend

- **Thomas (AskUserQuestion):** CVC plan = "re-ticket #456 + ship the phoneme-blend." Merged #456 (consumer pipeline). New ticket being created to re-home it (was mis-ticketed under 86c9qa6n3). The real 86c9qa6n3 (cross-vowel-firing) STAYS in TO DO.
- **Follow-up (queued):** light up the blend = planner SYSTEM_PREAMBLE 5->6 utterances + ids-contract + max_tokens change (Kevin) + the blend audio bake (Thomas ear-test) + Kyle's Q2 (ASCII-7 canon text vs em-dash spec). The merged consumer pipeline is inert until this lands.

## 2026-06-15 0532 UTC — Walkthrough closure: recap-bake + blend light-up dispatched

- **Q1 (CVC) DONE:** #456 merged; re-homed under new ticket 86ca8t8xx (in progress). Dispatched Kevin on the phoneme-blend light-up (planner SYSTEM_PREAMBLE 5->6 for cvc-word + emit blend slot + bake, ASCII-7 canon). 86c9qa6n3 (cross-vowel-firing) stays TO DO.
- **Q2 (recap bake) DONE:** Thomas approved; dispatched Devon to bake session.end.recap.focus (per-node-vs-assembled = his architecture call) — Thomas ear-tests on prod after merge.
- **Still Thomas's ear (reminders):** voice-QA 3 round-6 clips on prod; the recap voicing (post-bake); the blend clips (post-bake — "Listen.", /ks/, em-dash render).
