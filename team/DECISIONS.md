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

_The four 2026-08-02 entries are archived verbatim in [`log/decisions-archive-2026-08-02.md`](log/decisions-archive-2026-08-02.md)._

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

## 2026-10-10 — Native Greet + Math approved on device; Emma stays calm in native Greet

- **Context:** Phase 3 slices merged after Thomas checked each on iPhone + iPad in Expo Go: Splash + Greet (#531, `1017e4e`) and Math (#532, `078229a`).
- **Decided:** (1) Emma stays calm (idle pose) through the whole native Greet, with no celebrate stance; native only, the web Greet is unchanged (Thomas, 2026-10-09 popups). (2) Greet approved on device ("Looks good, merge it"). (3) Math approved on device ("works now, looks good"). (4) Next: the native SessionEnd ports the shipped guidance G2 screen (`src/screens/SessionEnd/`, #513), not the dead `SessionEndPlaceholder.tsx`; Kyle writes the native Hub spec in parallel, then the Hub build follows it.
- **Decided by:** Thomas (popups + device checks); (4) follows the 2026-10-09 Phase 3 order.

## 2026-10-11 — Native Session End approved on device; Hub build starts on Kyle's spec

- **Context:** Session End (#535, `168e240`) ports the live guidance G2 screen. Kevin's one required change (it wrote the session again on re-entry) was fixed in the PR. Kyle's native Hub spec merged as #534 (`5531a20`).
- **Decided:** (1) Session End approved on device: Thomas played several Math rounds in portrait and landscape, then the not-yet day with the app clock one day ahead ("step 3 works, merge it"). (2) The native Hub is built to `design/native/hub-native.md`, including its one departure from the web: tablet landscape is two columns, not a pillarboxed portrait stage. It is judged in the normal device check, not a mockup round.
- **Decided by:** Thomas (device check); (2) follows the 2026-10-09 Phase 3 order.

## 2026-10-11 — Native Hub approved on device; Map spec and build start in parallel

- **Context:** The native Hub (#537, `4ff1f61`) ports the live clay Hub with guidance G1 to Kyle's spec (#534); the Hub's guidance logic moved into `@marian/core/hub/`. Kevin's one required change (Math's adopted Hub prefetch could not be aborted) was fixed in the PR.
- **Decided:** (1) Hub approved on device: Thomas ran the Hub checklist in Expo Go, starting from a first launch on the iPad (Greet → Math → Session End → Hub) ("works, merge it"). (2) The Map follows the Hub's pattern: Kyle writes `design/native/map-native.md` (native-only calls), while Devon starts the spec-independent part (core logic, audio, data) in parallel and builds the layout from the merged spec.
- **Decided by:** Thomas (device check); (2) follows the 2026-10-09 Phase 3 order.

## 2026-10-11 — Native Map approved on device; open gates past locked lands stay; Word Song starts

- **Context:** The native Map (#540, `956405b`) ports Emma's Path to Kyle's spec (#539); the map logic moved into `@marian/core/map/`. Kevin approved with no required changes.
- **Decided:** (1) Map approved on device with the `add-to-20` debug seed ("works, merge it"). (2) Thomas noticed the top gate (land 4) is open while land 3 is locked. That is the shared rule (a gate opens when its land's first step is not locked) plus the diagnostic baseline (`mult-2-5-10` starts at `intro`, `packages/core/src/progress/defaults.ts:177`), the same on the web; kept as is for the port, since any change would touch the frozen web too. (3) Word Song follows the Map's pattern: Kyle's native spec and Devon's core/audio work in parallel.
- **Decided by:** Thomas (device check); (2) and (3) follow the web-parity rule and the 2026-10-09 Phase 3 order.

## 2026-10-11 — Native Word Song approved on device; drain complete

- **Context:** The native Word Song (#543, `054928c`) ports the web screen to Kyle's spec (#542); its round rules moved into `@marian/core`. Kevin's one required change (the blend-mark drift check compared byte lengths, and 9 CBR clips share one length) was fixed with a sha256 per entry.
- **Decided:** (1) Word Song approved on device with the `cvc-words` debug seed ("works, merge it"), including Kyle's native-only calls: right-edge chip column in phone landscape, blend highlight from measured onset marks, dark letter on a rose spotlight. (2) The session drained on Thomas's "drain session": in-flight work finished, nothing new dispatched; ParentSettings starts only on his go.
- **Decided by:** Thomas (device check, drain).

## 2026-10-11 — ParentSettings starts (last Phase 3 screen)

- **Context:** The session had drained after Word Song (#543). Thomas answered "continue" and, asked in a popup whether that meant ParentSettings, picked "Start ParentSettings".
- **Decided:** (1) ParentSettings follows the Word Song pattern: Kyle writes `design/native/parent-settings-native.md` (#545, docs-only), while Devon moves the screen's pure logic into `@marian/core` and builds the native screen to that spec; Kevin reviews once, then Thomas device-checks. (2) Kyle's named native departures: Share… replaces the web's JSON textarea, Restore confirms once in a system alert, and native corrects the defaults footnote, the "in-a-row" wording and the Copied timer; the web copy stays frozen. (3) The missing launch-time cloud reconcile on native is parked, not added to this PR.
- **Decided by:** Thomas (popup); (1) follows the 2026-10-09 Phase 3 order.

## 2026-10-12 — Native Parent Settings approved on device; Phase 3 complete

- **Context:** #547 (`af5afbe`) ports Parent Settings to Kyle's spec (#545); its logic moved into `@marian/core/parentSettings` and the web screen imports it. Kevin approved in one round. In Expo Go, Push now showed "Couldn't reach the server.": production `/api/progress` answers 502 `kv-failed` because the project's Upstash store is uninstalled (`vercel integration list`), so the web's cloud sync fails the same way.
- **Decided:** (1) Merge #547 now. Thomas tests Restore between two devices and the restore field in iPhone landscape later. The merge includes Devon's read-first Restore: native reads the other device's progress, then adopts its ID; the web adopts the ID first. (2) The orchestrator diagnoses the store outage read-only; any change to the Vercel or Upstash accounts is Thomas's.
- **Decided by:** Thomas (device check, popups).

## 2026-10-12 — Native-only: the PWA retires at Phase 5

- **Context:** Thomas asked what dropping the PWA would mean. The native app still depends on the Vercel backend: `/api/claude` plans each session and carries Emma's audio, and `/api/progress` is the cloud backup on the Upstash store. The plan left the call open ("Then decide: retire the PWA, or keep the web build").
- **Decided:** Go native-only. The web front end (screens, Vite/PWA build, the web Playwright suite) is deleted once Marian is on the native app through TestFlight, not before, because until Apple enrollment clears the PWA is the only installable build. Vercel stays as the app's API server. Phase 4 still sorts the Playwright specs, porting the product invariants to Maestro or core tests; the web specs are not maintained beyond that.
- **Decided by:** Thomas (popup).

## 2026-10-13 — Work while Apple enrollment is pending: Phase 4 and the native parity gaps

- **Context:** Thomas can enroll in the Apple Developer Program only in a few days, and approval takes longer, so TestFlight (Phase 5) is blocked. Main's Mobile check had gone red on expo-doctor after Expo shipped SDK 57 patches; #549 (`7c11a56`) bumped them (Thomas's popup).
- **Decided:** (1) Start Phase 4 now, since it needs no Apple account: Kevin builds the Maestro harness and the plan's four critical-path flows, run locally; Jessica sorts the 67 Playwright specs into invariants to port and web-only mechanics to drop. Adding a CI workflow for Maestro is Thomas's call (macOS runner minutes). (2) Close the two parked native parity gaps in one PR: the Hub pick records the world played today, and native gets the web's launch-time cloud reconcile. Thomas device-checks them.
- **Decided by:** Thomas (popups).

## 2026-10-13 — Native test tooling: Maestro CI, step picker, every-step sweep

- **Context:** While Phase 4 ran, Thomas could test a step only by playing up to it, and seeds covered only 2 math steps. GitHub's standard macOS runners are free because the repo is public.
- **Decided:**
  1. The four Maestro critical-path flows run in CI on PRs touching `mobile/` or `packages/core` (#555). The job proved two consecutive green runs after it got a re-tap guard and one whole-flow retry, reported as `PASS (retry)` so flakes stay visible. It joins fast gate, e2e and Mobile in the merge convention for mobile PRs.
  2. A debug-only step picker in Parent Settings and a `qaStep` launch flag (#557).
  3. An on-demand sweep of all 24 steps (#560), run against a local canon-only `/api/claude` that has no credentials and no outbound network access.
- **Decided by:** Thomas (popups).

## 2026-10-13 — Native departures from the web: Last synced, and late cloud installs

- **Decided:**
  1. Native Parent Settings' "Last synced" shows the last successful cloud sync on this device (#556), stored under its own device-local key outside the Progress blob. The frozen web still shows the last-played time, which Thomas had read as a bug.
  2. A cloud install that lands after the Hub is on screen appears on the next Hub entry rather than redrawing it (#552), so Emma is never cut off mid-line.
- **Decided by:** Thomas (popups).

## 2026-10-13 — Number Garden steps 1 and 8–11 built natively

- **Context:** The step picker showed that number recognition, skip counting and the three multiplication tiers had canon but no client support in either app: their read lines matched no template, so they silently fell back to sums-to-10 with no voice.
- **Decided:** Kyle's spec (#559), with Dave's pedagogy review:
  - the ± chip alternates by position so the answer isn't always the biggest;
  - the ×6–9 tags show from the start;
  - number-strip numerals appear from hint 1;
  - the × sign is used (Thomas);
  - "A times B" reads as B groups of A, rechecked only if Marian's Danish workbook reads it the other way and she stumbles on it.

  Devon built it in #562 (merged `5bb6d8f`), with a core and server filter so multiplication facts never reach a non-multiplication session, and answers capped at 99 to match the progress guard. The web is untouched. Thomas checked steps 8–11 on his iPhone; step 1 is covered by the sweep and tests, and the 6 × 2 tag overlap stays as built.

- **Decided by:** Thomas (popups); pedagogy from Dave.

## 2026-10-13/14 — Phase 5 starts: Emma's Path on TestFlight

- **Context:** Thomas's Apple Developer membership activated on 2026-10-13. His Mac has only Xcode 27, which Expo SDK 57 doesn't support.
- **Decided:**
  1. The app is named **Emma's Path**. The store name is "Emma's Path: Math & Reading" and the bundle ID is `dk.sandvaer.emmaspath`. The EAS slug stays `marian-tutor`, which users never see.
  2. Store builds run on EAS's free cloud plan, pinned to the SDK 57 image (Xcode 26.6), with remote build numbers (#561, #563).
  3. Marian tests on Thomas's iPad, because the TestFlight terms don't permit under-13 accounts and her own iPad uses a child account.
  4. Nothing goes to the public App Store; that is Phase 6, a separate decision.
- **Outcome:** build 0.1.0 (2) was installed through the internal group "Family" on 2026-10-14. All of Thomas's checks passed.
- **Decided by:** Thomas (popups and messages).

## 2026-10-14/15 — Pacing: no daily streak, review first, fast track, Map peek; ship build 7

- **Decided:**
  1. No daily streak. The in-session streak stays a 3/5/8 bonus. Warm-up hearts don't count toward it. Reviews chime but give no bonus stardust.
  2. Pacing order: same-day mixed review and the daily 2-item "Remember this one?" warm-up come first, the fast track after. Leitner due dates count in calendar days.
  3. Fast track: "secure" means 8/8 on the first tap. The first finished session of the day decides. There is no speed check anywhere. The second secure day fills the remaining flowers, unannounced, with "You know this! All your flowers grew!". No parent switch.
  4. Explore vs progress (Thomas: "She wants to see what's in the game, but we should still keep track on her level"): the Map peek is 3 problems from any later stop, locked ones included, and counts toward nothing. It is Map-only, with no caps or lures. Peek lines name the step. "You just knew that one!" plays on a quick maths warm-up answer.
  5. Stopgap: Parent Settings at 80%/2 in both worlds with fresh-day ON, reverted to 87.5%/3 once build 7 was installed.
  6. Skip build 6 (it has the peek crash); ship build 7.
  7. expo-doctor version drift warns instead of blocking (#571). Bump Expo before each TestFlight build.
  8. Ask Dave for a content roadmap past the path ends: done, #569.
- **Decided by:** Thomas.

## 2026-10-16 — Content wave 1 go; build 8 on both devices first; image-tool bake-off; kill switch re-armed

- **Decided:**
  1. Content wave 1 is a go (Thomas: "work on more content for both number garden and word song"). It follows Dave's roadmap (#569); the spec is #574.
  2. Thomas approved the Emma lines, the names ("all the groups", "duck words", "crab words", Word Song land 6 "Big words") and the clay subjects.
  3. Dave's D1–D5 were confirmed with one change: cab dropped, crab's trap is {clock, frog}.
  4. Rollout rule: build 8 (#572 progress guard + #573 restore fix) goes on BOTH the iPad and the iPhone before any wave-1 build. Never downgrade a device.
  5. PR #489 closed, superseded by #572.
  6. Midjourney paused: its rules forbid automation and it has no API. A bake-off of Gemini, OpenAI and Codex image tools decides whether the whole picture pack is redone in one style.
  7. About 130 new Lily lines approved for rendering once the PRs are reviewed; the dry-run count must match first.
  8. Kill switch re-armed (Marian has been on the native app since 2026-10-14); `CLAUDE.md § Kill switch`.
- **Reverses:** the kill-switch pause in 2026-10-08 "React Native (Expo) migration: GO" (item 2). Item 6 pauses the Midjourney half of 2026-10-05 "Codex for icons, Midjourney for heroes".
- **Decided by:** Thomas.
