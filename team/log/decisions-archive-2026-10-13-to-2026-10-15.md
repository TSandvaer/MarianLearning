# DECISIONS archive — 2026-10-13 to 2026-10-15

Archived verbatim from `team/DECISIONS.md` on 2026-10-19 (the live file passed ~10 KB). Read-only history.

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
