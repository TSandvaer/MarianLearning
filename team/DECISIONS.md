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

## 2026-10-16 (later) — Pictures by OpenAI Flare; ElevenLabs only; tools worktree; content wave 1 shipped

- **Decided:**
  1. The picture tool is OpenAI `gpt-image-2.5-flare`, chosen from the bake-off sheet. All 73 pack pictures were redone in one style (#583, #575) from three anchors (hen, sack, wing), with Thomas approving each batch from a contact sheet. The 4 clay path pieces were made the same way.
  2. Voice is ElevenLabs Lily only (Thomas: "yes only use elevenlabs for voice consistency"). The Azure runtime fallback and the build-time canon bake are removed (#581). Azure runs only if `TTS_PROVIDER=azure` is set.
  3. Voice-QA gets a "New / changed" filter against a baseline taken from main (#582). Rule: regenerate the baseline right after each release (#584).
  4. Test runs are capped at 4 workers in Vitest and Jest (#578), after an uncapped run exhausted the Mac's memory.
  5. Credentialed jobs (renders, picture generation, EAS builds, releases) run in the tools worktree `~/DEV/MarianLearning-tools`. The main checkout is the orchestrator's.
  6. Content wave 1 shipped: #576 and #575 merged after Thomas's ear tests (49/49 and 84/84 passed). TestFlight build 9 went on the iPad before the production release af804cb, and Thomas's device check passed.
- **Reverses:** the Midjourney half of 2026-10-05 "Codex for icons, Midjourney for heroes", for the picture pack. It supersedes the 2026-10-16 item 6 bake-off.
- **Decided by:** Thomas.

## 2026-10-17 — Content wave 2 shipped; fig re-take by ear; Map tap-to-play

- **Decided:**
  1. Content wave 2 (spec #586, from Dave's roadmap) was approved: the names "sharing", "tent words" (not "jump words": _jump_ is a verb) and "cake words", the three intro lines, the clay subjects, and the picture spend after an OpenAI top-up. Dave confirmed D1–D9.
  2. T5 ("Who sat on the mat?" before the Word Song half): Thomas skipped the check ("shes going to say cat"), so tent and cake words were built straight away.
  3. Thomas picked the art: v1 for all 16 pictures and all 3 clay pieces. After his iPad check, the sharing plates became round, seen from above, with the flowers on die faces (Kyle). P1–P3 auto-deal as the model (spec K3) stays.
  4. "Read the fig." still said "figa" after #558. ElevenLabs gives near-identical takes for the same input, and seeds don't change that, so the Lily take picker (#588) offers input variants for Thomas to pick by ear (read take 17, hint take 12, sharing peek-open take 4). ElevenLabs cap for the picker: 750 characters.
  5. Shipped: #587 sharing, #589 tent and cake words, #588 the fig fix; TestFlight build 10, then production release 2e2675f (only new steps changed, so build first, then release).
  6. Map tap-to-play (Thomas: "if i click on an island that is unlocked on the map it should jump in"; an island means one stop). Tapping the current stop starts the Hub's own session. Tapping a mastered stop starts a replay that records nothing and closes with "You know <name>!" (60 lines approved). No gate; replays allowed only after today's flower is a documented fallback that isn't built. Spec #591 (Kyle, Dave D1–D4), build #592.
  7. The voice-QA Submit failed with "failed to create GitHub issue"; Thomas replaced `GITHUB_TOKEN` in Vercel (it takes effect from the next deployment).
- **Decided by:** Thomas.

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
