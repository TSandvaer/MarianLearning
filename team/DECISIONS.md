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
