# DECISIONS — Marian Tutor

**Append-only history.** Newest entries at the bottom. Never rewrite or delete an entry — if a
decision is later reversed, append a _new_ entry recording the reversal and cross-reference the
original. This file is the durable record that survives session restarts, compaction, and worktree
churn.

Distinct from its siblings:

- [`STATE.md`](STATE.md) — the _live_ resume header. Current only, small, overwritten freely.
- `.claude/decisions-while-away.md` — the _autonomy audit trail_ (orchestrator self-logged decisions
  pending Thomas's accept/reverse, for calibration). Entries there that turn out to be materially
  load-bearing graduate here.
- `.claude/log/` — closed history, read-only.

## Entry schema

```
## YYYY-MM-DD — <one-line headline>
- **Decided:** <what was decided, concrete and specific>
- **Foundation:** <cited memory slug / doc section + path / ticket / prior precedent>
- **Alternative considered:** <what was not chosen, and why>
- **Reversibility:** <how to undo + rough effort>
- **Decided by:** Thomas | orchestrator (autonomy gates) | team consensus
```

---

## 2026-08-02 — Adopt Far-Horizon's orchestration doctrine (alignment pass)

- **Decided:** Ran `/project-alignment-analysis` against `c:\Trunk\PRIVATE\Far-Horizon` and adopted 14
  of 21 forward candidates. Seven new `CLAUDE.md` sections (idle-is-free, reviews-never-create-tickets,
  agents-may-not-create-tickets, documentation-incident-gate, predict-before-soak, kill-switch,
  coordination-docs-stay-small); the blanket sub-agent docs-read rule replaced with a scoped 1–3-doc
  routing table; a `PreToolUse` destructive-bash guard + `permissions.deny` list; a SessionStart
  resume fresh-scan nudge; the `name-the-bar` skill + a seeded `.claude/quality-bars.md`; the
  incident gate grafted into `maintain-docs`; `team/STATE.md` + `team/DECISIONS.md` created; the 63 KB
  away-queue and 78 KB decisions-while-away archived to `.claude/log/`.
- **Foundation:** Far-Horizon's 2026-08-02 doctrine rewrite, which followed a measured failure —
  79 commits since its last `feat` (47 docs, 12 chore, 10 fix, 8 test, 1 spike, 1 ci, zero feat).
  Full candidate list, per-item decisions, and the four-check verification:
  [`.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md`](../.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md).
- **Alternative considered:** FH's hard team ceiling (1 dev + 1 reviewer + ≤1 support) was **skipped** —
  it is downstream of FH's Unity-build cap of 1, a serialized CI lane this project does not have.
  FH's full manual-only `maintain-docs` rewrite was **adapted rather than adopted**: the Stop-hook
  trigger is kept and the incident gate layered on top, with a documented tripwire if the gate stops
  holding.
- **Reversibility:** every change is additive or a verified-superset replacement; `git revert` of the
  alignment commit restores prior behaviour in one PR. The two archived files were moved with
  `git mv`, so history follows them.
- **Decided by:** Thomas (per-candidate popups + explicit apply-all go-ahead)

## 2026-08-02 — Reconcile the two dispatch-cadence memories with "idle is free"

- **Decided:** Rewrote `feedback_drain_isnt_stop_signal` and `feedback_constant_work` (both in
  MarianLearning's project memory at `~/.claude/projects/c--Trunk-PRIVATE-MarianLearning/memory/`)
  to retire their always-dispatch conclusions, and updated their `MEMORY.md` index lines. Each keeps
  the half that was genuinely load-bearing: _scan before concluding "all gated"_ in the first, the
  _staleness watchdog_ (a freed slot may be a dead agent — probe, don't assume) in the second.
- **Foundation:** the contradiction was logged as V-1 in the alignment plan. Resolution cites the
  Far-Horizon measurement (79 commits / 47 docs / zero `feat`) as the cost of the never-idle framing.
- **Correction on the record:** the alignment plan's first draft called these memories _user-global_
  and concluded the pass "could not edit them." That was wrong — they are **project-scoped to
  MarianLearning** (outside the git repo, but not user-global), so the fix was in scope and only
  affects this project. V-1 is now marked RESOLVED rather than carried.
- **Alternative considered:** deleting both outright. Rejected — each contains a real incident and a
  discipline that still holds; deleting would have lost the staleness-watchdog mechanics and the
  2026-05-16 under-scanning lesson along with the retired framing.
- **Reversibility:** both files are single-file rewrites; prior content recoverable from this
  session's transcript. Low effort to restore.
- **Decided by:** Thomas ("address the 3 things still open")

## 2026-08-02 — Fix a false positive in the imported destructive-bash guard

- **Decided:** Smoke-tested `.claude/hooks/block-destructive-bash.sh` with 15 crafted PreToolUse
  payloads. Found and fixed a real defect inherited from Far-Horizon: the branch-delete check used
  `grep -Eqi`, whose `-i` folded the **safe** lowercase `git branch -d` (merged-only delete) into the
  `-D` force-delete match, blocking routine post-squash-merge cleanup. Dropped `-i` on that one check.
  15/15 after the fix.
- **Foundation:** V-5 in the alignment plan asked for exactly this smoke test before trusting the
  fail-open guard. Interpreter confirmed present under Git Bash (Python 3.14.4).
- **Alternative considered:** dropping `Bash(git branch -D:*)` from the `permissions.deny` list
  instead. Rejected — the deny-list entry is prefix-matched and correctly case-sensitive already; only
  the hook's regex was wrong, so fixing the regex preserves protection against the genuinely
  destructive form.
- **Reversibility:** one-line revert.
- **Decided by:** orchestrator (autonomy gates — reversible, foundation-citable, not on the
  never-auto-decide list); reported to Thomas in-session.

## 2026-08-02 — Narrow the force-push guard to allow the lease-based family

- **Decided:** Removed `Bash(git push --force-with-lease:*)` from `permissions.deny` and narrowed
  `block-destructive-bash.sh`'s force-push regex so `--force` must be followed by space/quote/end.
  Effect: `--force-with-lease` and `--force-if-includes` are ALLOWED; bare `--force` and `-f` remain
  blocked in both layers. Smoke test extended to 17 cases; 17/17.
- **Foundation:** V-2 in the alignment plan predicted this exact bite, and it fired within the hour on
  PR #490 itself — local `main` was ~4 weeks stale, the PR opened `CONFLICTING`, and the force-push to
  land the rebase was blocked. The lease-based flags refuse the push if the remote moved, so they
  cannot silently clobber — which is the harm the guard exists to prevent.
- **Alternative considered:** leaving the guard as-is and having Thomas run every rebase-recovery push
  by hand. Rejected — rebase-then-force-with-lease is routine on this project
  (`feedback_sibling_tier_rebase_mechanical`), so the guard would fire on the SAFE form several times
  a week, which trains people to route around guards.
- **Process note:** the block was NOT retried and NOT worked around. It was staged to
  `.claude/away-queue.md` as ENTRY-001 exactly as the deny reason instructed, then cleared by an
  explicit decision to narrow the rule. That is the intended loop: adopt, let it fire, calibrate.
- **Reversibility:** re-add the one deny entry and restore the `--force-with-lease|--force-if-includes`
  alternatives in the regex; the smoke test documents both expectations.
- **Decided by:** Thomas (popup, "Narrow the deny list — drop --force-with-lease")

## 2026-10-04 — Progression: Emma's Path (levels = lands, 3 good days, worlds always open)

- **Decided:** (1) a step is mastered after 3 separate days at ≥ 7/8, in any order; good days accumulate and progress only grows. (2) A level is a land (Number Garden 4, Word Song 5). (3) Both worlds always open; locks only inside a world. Plan: `design/progression-emmas-path.md`.
- **Foundation:** read-only audits 2026-10-04 (UX: tiny 5-icon strip, invisible locks, silent mis-labelled celebration; R&D: mastery = three 8/8 days, linear trees, no schema change needed; research: close subgoals, upward-only progress, skill-named unlocks).
- **Reverses:** `design/screen-hub.md` "no whole-tree map" (:264) and "no how-to-unlock copy" (:238, :283).
- **Decided by:** Thomas (popups, recommended option on all three).

## 2026-10-05 — Emma's Path 10/10: stage names kept; whole-line Lily bakes

- **Decided:** (1) Keep "making tens" (regroup) and "star words" (sight words) — spec §10 Q1. Dave: "bigger numbers" is one sound from "big numbers" and "quick words" rhymes with "chick words", both fail the distinct-when-heard rule (Cutler 2012; Ehri 2014). Ear-test the "making tens" / "taking away to ten" pair. (2) Bake every new line whole (~120 + 9 land lines), not name + carrier splices — spec §10 Q2.
- **Decided by:** Q1 Dave (research, no spec change); Q2 Thomas (popup, recommended option).

## 2026-10-05 — Emma's Path 10/10: bake 140 one-name lines now, defer 149 two-name lines

- **Decided:** the full whole-line expansion of spec §4 is 289 lines (11,618 chars), not ~130. Bake the 140 one-name lines now; defer `locked.later` (111) and `gate.locked` (38) — they need one bake per (stop, current-step) pair. Catalogued with `src: null` in `src/lib/emmasPath/pathLines.ts` (PR #501).
- **Revisit:** after Thomas hears the first batch — bake them, reword to one name ("First let's finish <current>!", ~24 lines, spec change), or splice.
- **Decided by:** Thomas (popup, recommended option).

## 2026-10-05 — Emma's Path redesign: direction A "Toy Box", clay-render fidelity

- **Context:** Thomas on production (#502/#503/#504): "the design is very confusing and not very modern". Quality bars 9-12 confirmed the same day (`.claude/quality-bars.md`).
- **Decided:** (1) Direction A · Toy Box from Kyle's 3 clickable mockups (PR #506, artifact https://claude.ai/artifact/LnQ3b748sKNTQuPpujyjeg). (2) The target look is the Codex clay render (`design/emmas-path/redesign/concepts/direction-a-hub.png`), not Kyle's flatter vector version: Codex image generation makes the card art, stage icons and map art as images; the app builds layout and interaction around them; the real Emma art stays.
- **Known render faults to NOT copy:** Emma off-model, invented label "Flower sums", side-by-side cards (layout still to be settled).
- **Decided by:** Thomas (popups, recommended option both times).

## 2026-10-05 — Emma's Path redesign art: Codex for icons, Midjourney for heroes

- **Decided:** Codex built-in image generation makes the 41 icons (24 stages, 9 lands, 8 UI) in the locked clay style (quality bar 13). Midjourney (Thomas, Web UI, v7, one prompt at a time, remove.bg step) makes the ~4-6 hero images: Hub card scenes, the two map landscapes, any Emma pose (Omni Reference to stay on-model). Any Codex icon Thomas rejects is redone in MJ.
- **Decided by:** Thomas (popup, recommended option), after "remember i have midjourney".

## 2026-10-06 — Clay style only for Path chrome; Emma and lesson art unchanged

- **Decided:** the clay/vinyl-toy style (quality bar 13) applies to Hub cards, map, stops, lands, padlock, buds and other progress/navigation chrome only. Emma's 10 poses and the 53 lesson pictures + 8 scenes keep their current style. Before the build, Kyle composes one Hub + map screen from the REAL Emma art, the clay icons and a lesson picture so Thomas can see them together.
- **Decided by:** Thomas (popup, recommended option), after asking "do we have to change emma and a lot of other pictures done in another style".

## 2026-10-06 — Redesign build scope after the real-art check

- **Reference:** `design/emmas-path/redesign/real-art-check.html` (artifact https://claude.ai/artifact/C8kT7oP5PMNJDzEaJwMqvS): direction A with the real Emma, the clay icons and a capture of today's lesson. Cards side by side (Kyle: two equal doors; stacking adds width, not readability).
- **Decided:** (1) Emma's art stays exactly as is; in the build she gets a soft contact shadow and slight warm light so she sits on the clay world; on the map she stands BEHIND the current stop. (2) The lesson screens' frame (answer tiles, back button, progress dots) is restyled to the same chunky clay buttons; the lesson pictures inside stay unchanged.
- **Decided by:** Thomas (popups, recommended options).

## 2026-10-06 — Guidance layer ("carried through") before merging the clay Hub/map

- **Context:** Thomas tried the #510 Hub preview after several sessions: "I dont know what the number 36 star or 1 sun in the top is for, I dont feel like im being carried through the app, what i can do to progress (or why i cannot progress)". Root cause: the 3-separate-days rule works (1 flower per tray = today's good day) but nothing on screen explains it; stardust (cumulative, not spendable) and the day-streak sun are unexplained.
- **Decided:** Kyle (UX) + Dave (child psychology) design ONE recommended guidance layer as a clickable mockup first (quality bar 12): what to do next, why progress waits ("come back tomorrow"), what star/sun mean or whether they go, plus a test-only day fast-forward. #509 (map) and #510 (Hub) stay open and merge together with the guidance.
- **Decided by:** Thomas (popups, recommended options).

## 2026-10-06 — Guidance layer approved; stars are feedback only

- **Reference:** `design/emmas-path/redesign/guidance-mockup.html` (artifact https://claude.ai/artifact/LUaKXxCjDw1e5dcf5EZk3J) + Dave's `design/research/guidance-layer-2026-10-06.md`.
- **Decided:** build the guidance layer as shown: Emma names one next action and one card glows (both stay open, same size); 3 flower slots per step, a flower earned today sleeps (bud + moon + z) until tomorrow; session end = effort praise, flower flies into its slot, "N of 3", "It sleeps tonight. Come back tomorrow for one more."; same-day replay is praised practice with no new flower; not-yet day = warm praise, nothing taken away, "Play again to get today's flower" (said at most once a day); no stardust total and no day-streak sun on the Hub. Stars are in-session "you got it" feedback only, never counted and never collected into the flower (Kyle's call over Dave's). A test-only `?debug=1&dayOffset=N` switch lets Thomas step through days. R4 (session-end clay reskin) is folded into the guidance session-end ticket.
- **Decided by:** Thomas (popups, recommended options; "looks good").

## 2026-10-08 — React Native (Expo) migration: GO, Phase 1 starts

- **Reference:** `design/react-native-migration-plan.md`. Phase 0 spike on branch `spike/rn-phase0` (head `3ba5aa0`, `mobile/SPIKE.md`): Splash → Greet → one live Math problem → storage round-trip, Expo SDK 57 in Expo Go.
- **Evidence:** Thomas ran the spike on iPad + iPhone through Expo Go and answered "yes to all" to the four exit criteria (voice starts with no tap, captions in time, animation feel, layout fits portrait + landscape). First round, zero fix rounds. Android not tested yet.
- **Decided:** (1) Go with React Native (Expo); start Phase 1 (shared core extraction, no user-visible change). Audience: Marian first, public store release later as a separate decision. (2) The kill switch (`CLAUDE.md § Kill switch`) is PAUSED until Marian is on the native app (end of Phase 5). (3) Web UI feature freeze from Phase 2: content, canon, server work and bug fixes continue; new screens and UI features go into native only.
- **Decided by:** Thomas (popups, recommended options).

## 2026-10-08 — React Native Phase 2 GO; web UI freeze starts; Apple Developer Program

- **Context:** Phase 1 merged (#525, `8902988`): `@marian/core`, `KeyValueStore`, `apiUrl()`.
- **Decided:** (1) Start Phase 2 (native shell + platform services: audio, storage, cloud sync, assets, lifecycle, debug seeds). The `mobile/` Expo app lands on main. (2) The web UI feature freeze starts now: content, canon, server work and bug fixes continue; new screens and UI features go into native only. (3) Thomas joins the Apple Developer Program ($99/yr), so Phase 2 moves to development builds instead of depending on which SDK the store build of Expo Go supports. Until approval, use local `expo run:ios` simulator builds.
- **Decided by:** Thomas (popups, recommended options).

## 2026-10-09 — React Native Phase 2 done; Phase 3 starts with Splash → Greet → Math

- **Context:** Phase 2a (#527, `76752b9`) and 2b (#528, `0fa6b8d`) merged: native shell + expo-audio engine on `@marian/core`.
- **Decided:** Phase 3 (screen ports) starts with the first-launch slice, one screen at a time, each with phone portrait / phone landscape / tablet layouts in its own PR, checked by Thomas on his devices in Expo Go before the next one starts. Splash (a ~1 s transition screen) ships inside the Greet PR. After Math: SessionEnd → Hub → Map → WordSong → ParentSettings, per the plan.
- **Decided by:** Thomas (popup, recommended option).
