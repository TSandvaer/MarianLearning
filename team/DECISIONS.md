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

_Entries from 2026-10-04 to 2026-10-13 are archived verbatim in [`log/decisions-archive-2026-10-04-to-2026-10-13.md`](log/decisions-archive-2026-10-04-to-2026-10-13.md); earlier ones in [`log/decisions-archive-2026-08-02.md`](log/decisions-archive-2026-08-02.md)._

_Entries from 2026-10-13 to 2026-10-15 are archived verbatim in [`log/decisions-archive-2026-10-13-to-2026-10-15.md`](log/decisions-archive-2026-10-13-to-2026-10-15.md)._

_2026-10-16 to 2026-10-17 entries are archived verbatim in [`log/decisions-archive-2026-10-16-to-2026-10-17.md`](log/decisions-archive-2026-10-16-to-2026-10-17.md)._

## 2026-10-18 — Content wave 3 shipped (stories, hundreds); wave 4 approved

- **Decided:**
  1. Wave 3 stories (#599): the reading beat stays (D3); a word-tap cue was added (Kyle, Dave confirmed). Takes were picked by ear: hen/bug "Then this!" take 4 ("; then this!"), "Fig,", "Gem,", "Sat!", "Sun,". The Lily budget for wave 3 was raised to 6,000 characters (5,559 used). TestFlight build 13 is on both devices.
  2. Wave 3 hundreds (#603): the 1 pt rose tray edge stays. Released, smoke green, TestFlight build 14, confirmed on both devices.
  3. Parent Settings mastery default is 88% / 3 (shown as 87.5% rounded).
  4. Wave 4 (spec #606 from Dave's #605 addendum): T1 names (more and less, bee words, car words, sheep stories, land 8 "Words and stories"), T2 Lily up to 5,000 characters, T3 clay subjects, T4 pictures + scenes up to $3.50 (pack pictures first, scenes after their approval), T5 build the stories mixed now, T6 the map scroll fallback. Dave changed D1, D3 and D9.
  5. Thomas picked v1 for all five wave-4 clay pieces and approved all 17 pack-picture picks as Kevin proposed.
- **Decided by:** Thomas.

## 2026-10-19 — Content wave 4 shipped (more and less, land 8)

- **Decided:**
  1. Pictures: Thomas approved Kevin's picks for the 17 pack pictures and the 8 sheep-story scenes (sheep-2 v3 came from one sharpened retake, the harp missing in v1-v2). Spend $2.57 of the $3.50 cap.
  2. Ear tests: #608 49/49 passed; #607 135/136, "Car words! First, bee words. Then this!" was scratchy and Thomas picked take 3 (input "...bee words; then this!"). Lily total 4,791 of 5,000.
  3. Thomas checked both PRs on the device (P1/P6 of more and less, the lift-out, land 8, the ship trio) and said merge: #608 5a74911, #607 43c8f73.
  4. Released to production (smoke green), TestFlight build 15 (EAS fe2159e8-a485-4921-b855-367f720420c7), voice-QA baseline #611.
- **Decided by:** Thomas.

## 2026-10-19 — No Danish premise; the app is multi-user

- **Decided:**
  1. Marian has no Danish skills and has never been to Danish school (Thomas: "Marian has no Danish skills / she has never been to danish school"). CLAUDE.md:8's "Starting Danish school August 2026" was wrong and is corrected. Dave's roadmap had aligned maths with the Danish grade-3 goals (M2) and used Danish-language reasoning (M5, M6's digit-swap rationale, "halv tre") on that premise; his wave-5 addendum adds a dated correction section saying which of those choices still hold on other evidence.
  2. The app is multi-user, not only Marian (Thomas: "we need to think about this app as multi-user not only Marian"). Content is planned for any learner of about 6-9; no step may depend on one child's school, language or history. Learner profiles are to be designed (Thomas, popup: "Yes, design profiles"). A Danish version of the app is planned (Thomas: "im planning on creating a danish version"), so the content and data model should not block a second language.
- **Reverses:** the Danish-school premise in CLAUDE.md and in content-roadmap-after-path-ends.md:51.
- **Decided by:** Thomas.

## 2026-10-20 — Wave 5, profiles and the flower-bed game shipped (release fc16006, build 16); real blending held for build 17

- **Decided:**
  1. Wave 5 (#617 snail/moon words, goat stories, land 9; #621 zeros, adding big numbers, land 6) merged after Thomas's ear tests (#626 9 picks, #632 1 pick) and phone checks; #617's snail-words lead lighting only on P1 is by design (AC 14).
  2. Learner profiles: PR A #622 and PR B #634 merged; the 8 clay avatars #633 (Thomas picked Kevin's set; $0.6252); "Who is playing?" passed (#639); all model-facing planner text learner-neutral #631. Phase 3 name audio starts after build 16 (Thomas).
  3. Flower-bed game #635 merged after Thomas asked "Why are flowers not planted in brown soil?": soil beds with 2x5 holes and a furrow, a clay soil-bed map button (v1 picked, $0.0786), per Kyle #640 with Dave's checks (no tray art; if a learner reads it as earning flowers, return to the frame-pink look). Its 30 lines passed (#638). Build 16 waited for it (Thomas).
  4. Released fc16006 (smoke green), TestFlight build 16 (EAS a348688d-a796-4e12-a5bb-4fc2a6f34875), voice-QA baseline #641. EAS is on Starter (Thomas).
  5. Real blending: spec #630 (Dave D1-D4 confirmed, plus his 3rd-wrong whole-clip extra); Dave's change: sounding-out stays out of reviews and warm-ups until played (no goodDays/secureDays). #636 (core) and #637 (native) approved; ear test #642 37/38, cap blend take 1 picked. Both HELD: old builds cannot parse "Listen." canon, so build 17 goes on both devices before any release with it.
- **Decided by:** Thomas (merges, picks, release, builds, look); Dave (pedagogy changes, adopted by the team).

## 2026-10-20 — Games move to one Play place; flower bed moves onto the path; peek prompt; TTS hole closed

- **Decided:**
  1. Games live in ONE shared Play place from Home, outside the path; first games Raft crossing and Letter critters; no parent play limit for now (spec #650). Drills belong on the path.
  2. The flower bed is "not really a game ... belongs on the path" (Thomas): it moves into add-to-10's missing-number problems (spec #648, Dave D1: holes hidden until hint 3, hint 1 ripples by row); the game, its door, route and 30 lines are retired (#652).
  3. Locked-stop peek prompt: lines "This one is locked. Want to try it?" / "Want to try it?" and a green clay button approved (spec #649, built in #657).
  4. Sounding out gets the stories' tap hand (Thomas: "its not intuitive that you can tap the letters"): #651, option A (the hand's press plays the letter's sound).
  5. TTS hole: "Fresh fix now" -> #646 merged, #487 closed. Profiles phase 3 (name audio) spec #645 merged (T11-T13 approved); the build waits until profiles part B is on both devices.
- **Decided by:** Thomas (popups); Dave (pedagogy rules, adopted by the team).

## 2026-10-20 to 2026-10-22 — Play place shipped; release d58e7408; builds 17-19

- **Decided:**
  1. Release hold kept until build 17 (EAS 5c358df4, from 843e456d, real blending) was on both devices (Thomas: "its installed"); then released d58e7408 (Play place core #654), voice-QA baseline #655.
  2. Play place shipped: clay pieces #653, core + 18 Lily lines #654, native UI #656. Build 18 (EAS 5dc3bd9a, dc5dec79) and build 19 (EAS c39e183f, cab7a4e0).
  3. Letter critters after Thomas's device test (Thomas: "if the letters dont make up any word she should sound the phonics and say 'Is this a word...' or something funny"): Emma says a real three-letter word; a non-word gets one of three funny lines in turn ("Is this a word? I don't know what it means!" ...). Raft: Emma's "Splash!" line becomes "Too heavy!" (Thomas: "it should be a splash sound instead"); the splash itself is a sound effect (#660). Ear-test fixes: sat and wed read as "Saturday"/"Wednesday", so their render inputs are `Satt,` / `Wedd,`.
  4. Letter critters opens for every learner: `opensAt` moves from `blending-cv` to `letter-names` (Thomas: "the only game in play place is raft crossing"); until blending-cv is current or mastered, a non-word sits quietly instead of getting a funny line (Dave's safeguard) (#663).
  5. Splash and boing sound effects: blocked until the ElevenLabs key has Sound Effects enabled (Thomas to do); brief tmp/specs/spec-kevin-play-sfx.txt.
  6. Web Math.test cold-mount flake fixed (Thomas: "Fix it") #664.
  7. Simulator pre-check before every TestFlight build with new native screens (Thomas: "Yes I want"): Maestro on-demand flows with screenshots (#665), no paid calls; not a replacement for device checks.
- **Decided by:** Thomas (merges, release, builds, ear tests, popups); Dave (the before-blending rule).

## 2026-10-23 — Letter critters fixes from Marian's play test (build 20); e2e runs in the Playwright container

- **Decided:**
  1. Marian's four comments fixed in #666: the caption clears when its line ends; the picture draws above the letters; every finished run clears the shelf (critters fall back to the meadow); a drag hint (new intro "Drag three letters up to the log. If they make a word, I'll say it!" + a hand that drags, on entry and after ~8 s idle until the first run). Ear test of the one new line passed (Thomas: "listened to it and it sounds good"). Whether a critter should travel with the hand: judge in build 20 first.
  2. Build 20 (EAS 48a0943c, from f10a29d2) on TestFlight.
  3. e2e's Playwright job runs in mcr.microsoft.com/playwright:v1.59.1-noble (#667): a slow Ubuntu apt mirror had made the browser-deps install take 47-53 min and cancel runs at the 70-min cap (twice on #666, twice on main). Thomas chose a second rerun for #666 and the fix (popups).
- **Decided by:** Thomas (popups, ear test); Kevin (#667 approach), Devon review.

## 2026-10-24 — No-Claude phases 3-4 merged; Expo 57.0.31; phase 5a starts with no spend; the cat-words probe reserve

- **Decided:**
  1. #677 (phase 3, the math picker on the device) → 64b8f821, #676 (phase 4, the vowel map) → a24e0560, #679 (Expo 57.0.31) → dace7ab4. Build 22 is held for Marian's build-21 play.
  2. Phase 5a is built with no render: Kevin writes the closed math pools, scenario C (sizing § 3), as a draft PR. The Lily render gets its own popup with the exact bill.
  3. Cat-words probe reserve, from Dave's 8 (not 12):
     - Keep map, nap and rat.
     - Drop tap.
     - Add ham, cab, rag, ram and pad.
     - The check draws the best 6 per learner and passes at 5 of 6.
     - The 5 new words get pack pictures (OpenAI Flare, contact sheet). Their audio joins the 5a render popup.
     - Pictured reserve words pop in Letter Critters, the same rule as rat.
- **Decided by:** Thomas (popups); Dave (the reserve and its ranking); orchestrator (fact set C, as the spec named it). 4. Probe pictures batch 18 ($0.39) approved by Thomas from the contact sheet: ham v1, cab v1, rag v1, ram v2, pad v1. 5. Dave's two rulings for the check:
  - Reserve order: each attempt takes 6 of the 8, in tiers: never met, then met only in Critters, then last result right, then last result missed (oldest miss first). Every attempt is always 6 words at 5 of 6.
  - Scoring: probe words are scored on the FIRST tap only. Today a child who taps every chip always passes. Practised words and the 90/3 rule are unchanged.
  6. Thomas by popup (2026-10-24, late): merge #680 (math pools) and #681 (probe reserve) unrendered, and hold the build. Then render all 291 lines (7,402 Lily chars: #680 266/6,970 + #681 25/432) in one follow-up PR, ear-tested on one filtered voice-QA link.
  7. 2026-10-25: #681 rebased onto #680 and merged (ae1a2cb6). Render PR #682 merged (b466c93c): 291 lines rendered, of which 272 were billed (~6,917 chars). The other 19 reused cached Lily takes, which the orchestrator approved as under the approved spend. Byte proof (Kevin, re-run by Devon): 3,954 unchanged / 351 newly voiced / 0 other. Thomas by popup: "Merge now, listen after". He ear-tests on #682's per-group links, because `?filter=new` shows 473 against the stale release baseline. Flagged lines go to a re-take PR. Build 22 stays held.
  8. 2026-10-25: Thomas ear-tested all 311 rows of #682 on its preview (266 math + 45 cvc-words-probe, which includes the 25 new rows) and all passed, 0 fails (voice-QA issues #683-#692). The submit limit (5 per hour per IP) was cleared by switching networks; no code change. No re-take PR is needed. Build 22 stays held for Marian's play on build 21.
