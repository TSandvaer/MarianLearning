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
