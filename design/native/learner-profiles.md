# Learner profiles (native)

**Status:** spec only. Thomas, 2026-10-19: "we need to think about this app as multi-user not only Marian"; asked whether that means separate learner profiles in the app: "Yes, design profiles" (`team/DECISIONS.md` 2026-10-19, PR #613). Thomas approved T1–T8 and Dave's EXTRA 2 by popup on 2026-10-19 (§ 13). Dave checked D1–D7 on 2026-10-19: D2, D3, D4 and D6 confirmed; D1, D5 and D7 changed, plus 2 extra items, all applied (§ 14). Kevin checked K1–K12 on 2026-10-19: K1, K4, K5, K8, K10 and K12 confirmed; K2, K3, K6, K7, K9 and K11 changed, plus 3 blocking issues (X1–X3), all applied (§ 15). Thomas approved T9 and the learner-neutral planner prompt (T10) by popup on 2026-10-19 (§ 13). Nothing is open for Thomas before the build. Phase 3 (name audio, PR C) is specified in § 16: Kevin designed the server (K13–K19, § 16.8) and Thomas approved T11–T13 by popup on 2026-10-20 (§ 16.9). Nothing is open for Thomas before PR C.

**Scope:** `@marian/core` (a new `learners` module, storage keys, cloud keying, routing), the native app (a "Who is playing?" screen, a Hub badge, Parent Settings, Session End's exit), one new Emma line, 8 avatar pictures. The server is unchanged until phase 3 (§ 12). The web is frozen and stays single-learner (§ 4.4).

**Out of scope:** code, renders, picture generation. Also out: Danish content, translation or UI (a language field is reserved, § 5.2); deleting a learner's cloud record (no server delete exists; § 7); a family-wide sync code (each learner links once per device, § 4.6); accounts, passwords, logins; the planner's system prompt (§ 13 T8).

## Goal

Two or more children share one iPad or iPhone. Each one taps their own picture and plays their own Number Garden and Word Song, with their own progress, flowers and map, and never sees a sibling's. One child on a device sees no change at all.

## Today (verified in the code)

- **One progress doc per device**, under `marian-tutor:progress:v1` (`packages/core/src/progress/storage.ts:30`), loaded through a defaulter chain and the strict guard (`storage.ts:44-104`), saved whole (`storage.ts:521-535`). `loadProgress()` returns `null` for a missing key, invalid JSON, an unknown version or a failed guard alike (`storage.ts:36-43`). `schemaVersion` is `1` and is the only version (`types.ts:818`; `migrate.ts:20-23` has no steps). New fields have always been optional and additive, with no bump (`types.ts:648`, `:661`, `:710`).
- **The doc already names its child:** `profile.childName`, "Capped to 24 chars at write time" (`types.ts:466-467`). Fresh docs default to `'Marian'` (`defaults.ts:264`) and to Marian's April 2026 diagnostic levels (`defaults.ts:166-206`: `number-recog` mastered, `add-to-10` practicing, …).
- **12 production sites fall back to `defaultProgress()`** when the doc is missing (grep, 2026-10-19; the list is in § 15 K7). `reviewBaseline()` caches the steps mastered in `defaultProgress()` once per process (`progress/reviewPlan.ts:79-93`).
- **Six more per-child keys sit outside the doc:** session history with `sessionCount`, streak and today's worlds (`sessionEnd/sessionHistory.ts:35`, shape `:77-100`), stardust (`shared/stardust.ts:39`), the not-yet nudge (`sessionEnd/notYetNudge.ts:14`), the flower wake (`hub/hubGuidance.ts:194`), the device ID (`progress/deviceId.ts:46`) and Last synced (`progress/lastSync.ts:19`). Besides the seam itself and `index.ts`, these six modules and `storage.ts` are the only callers of `getKeyValueStore()` in `packages/core/src` and `mobile/src` (grep, 2026-10-19; Kevin's K1 has the lines).
- **Storage is one synchronous store** installed at boot: native expo-sqlite (`mobile/src/platform/native.ts:82`), web `localStorage`. Core's seam has `getItem`/`setItem`/`removeItem` and no key listing (`platform/keyValueStore.ts:20-24`). The native backend can list keys: expo-sqlite 57.0.4 has `getAllKeysSync()` (`mobile/node_modules/expo-sqlite/build/Storage.d.ts:64`, main checkout; `mobile/package.json:28` pins `~57.0.4`).
- **Cloud backup is keyed by the device ID**, a v4 UUID (`deviceId.ts:60-66`): KV key `progress:<uuid>` (`api/_progressStore.ts:45-47`). The server accepts any v4 UUID (`api/progress.ts:182-184`) and never looks inside the blob. Its header says the UUID "implicitly enables multi-child later" (`deviceId.ts:12-18`). Local is authoritative, cloud is a backup (`cloudSync.ts:32-37`). Boot reconcile is last-write-wins on `profile.lastPlayedISO`, with history, good days, unlock markers, secure days and pace holds union-merged (`cloudSync.ts:422-503`). On a 404, and when local is newer, it pushes local to that record (`cloudSync.ts:442-453`, `:493-500`). It runs once per launch (`mobile/src/lifecycle/launchReconcile.ts`, core `launchReconcile.ts:49-60`). The sync-success listener takes no argument (`cloudSync.ts:154`); native's writes Last synced (`native.ts:85`).
- **Four writers push to the cloud**, each with `getOrCreateDeviceId()` read at call time: session end (`sessionEnd/progressHistory.ts:477`), review end (`:514`), the unlock seen-marker (`map/unlockBeat.ts:79`) and Push now (`mobile/src/screens/parentSettings/parentSettingsDeps.ts:85`).
- **Restore** (native) reads the other device's record first, then adopts its ID (`parentSettings/cloudBackup.ts:157-168`). An install or ID write can land "even after the screen is gone" (`cloudBackup.ts:152-156`).
- **Two devices share one child** by sharing one device ID, and so one cloud record: "two devices on different builds share one cloud copy" (`guards.ts:383-385`). The rollout rule is never to downgrade either device (`team/DECISIONS.md` 2026-10-16 item 4). I did not read the IDs stored on the iPad and the iPhone.
- **Parent Settings** opens from a 3 s press on Emma on the Hub (`mobile/src/screens/hub/Hub.tsx:65-66`, `:219`). It is "slate on white in the system font, no Emma, no sound" (`ParentSettings.tsx:5-8`), and holds 7 setting rows (`parentSettings/parentSettingsModel.ts:126-134`), Backup and Cloud backup. It reads the doc once and every control saves from that copy (`ParentSettings.tsx:89-103`). Debug builds add "QA: jump to a step". That row writes `progressAtStep(node)` or "Back to Marian's real start" (`defaultProgress()`), then App remounts its screens on the Hub (`QaStepPicker.tsx:1-17`, `App.tsx:47-56`).
- **Greet** is the first launch: Splash goes to Greet when `sessionCount === 0`, else to the Hub (`router/nextAfterSplash.ts:20-27`). Greet plays "Hi!", "I'm Emma.", "It's so nice to meet you.", "Tap the heart when you're ready." (`greet/greetSequence.ts:78-83`). Neither Splash nor Greet writes `sessionCount`; Session End does (`App.tsx:8-10`). Math's session start is kicked on Greet (`App.tsx:15-16`).
- **Session End's All done** opens the Map when an unlock is waiting, else the Hub (`App.tsx:475-476`). "Again" starts the same world's next session (`mobile/src/router/routes.ts:27`).
- **Emma never says a name.** No baked canon line contains "Marian". 1 canon file mentions her, in a description field (`public/canon/word-song/level-1/letter-sounds-audit.json`). Native session requests hard-code `childName: 'Marian'` (`mobile/src/session/mathSession.ts:194`, `:238`; `wordSongHints.ts:127`, `:176`; `peekSession.ts:74`, `:84`). The planner sees it as "Child's name:" (`api/_planner.ts:1249`). The canon lookup key has no name in it (`api/_canon.ts:75-79`).
- **Parent copy says "Marian" and "she"** in 10 strings: `parentSettings/copy.ts:25`, `:34`, `:42`, `:50`, `:87`; `nativeCopy.ts:18`; `qaStepCopy.ts:15-18`; `parentSettingsModel.ts:271`. The web shares the core strings.

## Decisions

- **P1.** A device holds **1 to 4 learners** (T1). One learner means no picker and no badge: the app looks exactly as today.
- **P2.** A learner is a **picture + colour** (one of 8 fixed avatars, unique on the device) and a **written name** under it. No typing, no password, no reading needed to pick.
- **P3.** **Today's child becomes learner 1 with nothing moved.** Learner 1 keeps every key and the cloud record it has now. The migration writes one new key, the learner list (§ 4.3), and decides "fresh install" from the raw progress key, never from a parse (X1). Zero data loss by construction.
- **P4.** Every other learner has the same 7 keys with a `:<learnerId>` suffix and their own cloud record (a fresh UUID). **The server does not change.**
- **P5.** **No schema bump.** The progress doc stays `schemaVersion: 1`. The only new doc field is optional and top-level (§ 4.5), so a build from before profiles reads and syncs learner 1's record as today (§ 4.7).
- **P6.** Adding, renaming, re-picturing, moving and removing a learner happen in Parent Settings, behind Emma's 3 s press. Picking and switching are the child's: one tap.
- **P7.** **Emma speaks no names in phase 1–2.** Session requests send `childName: 'friend'` (the planner's own fallback, `api/_planner.ts:1249`). Name audio comes in phase 3, on the picker only (T4). The no-name form is the shipped baseline.
- **P8.** A new learner starts where the parent says, one land per world (default land 1 in both). The start is built from the empty floor, never from Marian's diagnostic (§ 4.8). A parent can move a learner's start later, down as well as up (§ 3.1, D1).
- **P9.** With 2+ learners, **Session End's All done goes where it goes with 1 learner:** the learner's own Hub, or the Map when an unlock is waiting (§ 2.4). Thomas 2026-10-25: All done returns to the learner's own Hub; hand-over is the Hub badge. Was: All done opened the picker (Dave's EXTRA 2).

## 1. Who is playing (the picker)

### 1.1 When it shows

| Moment                                                                                | 1 learner                            | 2–4 learners                                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Cold launch, after Splash                                                             | skipped: `nextAfterPick` (§ 6.1, K6) | **picker**                                                                                                     |
| Hub badge tap (§ 2.1)                                                                 | no badge                             | **picker**                                                                                                     |
| Session End's All done, and Back on the unlock Map it opened (§ 2.4)                  | Hub or Map as today                  | Hub or Map as today (Thomas 2026-10-25: All done returns to the learner's own Hub; hand-over is the Hub badge) |
| Back from 10 min or more in the background, on Greet, Hub, Map or Session End (§ 2.2) | nothing                              | **picker**                                                                                                     |
| Back from the background on Math, Word Song or a peek                                 | nothing                              | nothing: the session goes on                                                                                   |
| Done in Parent Settings after the learners or the active learner changed (§ 3.1)      | Greet or Hub                         | **picker**                                                                                                     |

After a tap: Greet if that learner has never played (§ 6.1), else the Hub. New route `picker`. `ROUTE_EXITS` (`mobile/src/router/routes.ts:40-51`) becomes `splash → picker | greet | hub`, `picker → greet | hub`, `hub → … | picker`, `parent-settings → hub | picker`, `session-end → … | picker` and `map → … | picker`, and `greet → … | picker`, for the return rule (§ 2.2).

### 1.2 Layout

Emma and her bubble take the **Hub's frame for each form** (P, L, W: `design/native/hub-native.md` §§ 2–3, `mobile/src/layout/hubLayout.ts`). The tiles fill the Hub's card area R (the box around both card boxes and their outside room).

```
P  phone portrait (375×667)            L  phone landscape (667×375), 4 learners
+------------------------------+       +---------------------------------------------+
|        (  Emma, idle  )      |       | ( Emma )       |  +---------+ +---------+   |
|  +------------------------+  |       | (      )       |  | (fox)   | | (owl)   |   |
|  | Who is playing?        |  |       | +----------+   |  | Marian  | | Sam     |   |
|  +------------------------+  |       | | Who is   |   |  +---------+ +---------+   |
|  +-----------+ +-----------+ |       | | playing? |   |  +---------+ +---------+   |
|  |  ( fox )  | |  ( owl )  | |       | +----------+   |  | (frog)  | | (bear)  |   |
|  |  Marian   | |   Sam     | |       |                |  | Ana     | | Leo     |   |
|  +-----------+ +-----------+ |       +---------------------------------------------+
|   24 pt above the safe btm   |
+------------------------------+
```

- **Grid:** 2 or 3 learners in one row; 4 learners in 2 × 2. Gap 16 pt. The grid is centred in R and bottom-anchored, as the cards are (thumb zone).
- **Tile:** width `tw = (R width − (columns − 1) × 16) / columns`, height `min(1.25 × tw, (R height − (rows − 1) × 16) / rows)`. Radius 24 pt, white at 85% over the Hub gradient, no border. The whole tile is the target. The smallest is 103 × 130 pt, at 3 tiles on the 375 floor; 4 tiles on the 667 × 375 floor are 166 × 140.
- **Avatar disc:** the learner's colour, diameter `d = min(0.72 × tile width, tile height − name line − 36)`. The clay animal sits inside at 90% of `d`.
- **Name:** under the disc, 12 pt gap, Fredoka 600 at the Hub caption size (22 pt phone, 30 pt tablet), slate. One line. It shrinks to 16 pt, then ellipsises. An unnamed learner shows no text and keeps the line's height. With 2+ learners this is rare: adding a learner names an unnamed learner 1 first (§ 3.2, D5).
- **Nothing else on a tile:** no flowers, stars, level, streak, "last played" or count (§ 8).
- **Order:** the order the learners were added, never re-sorted.

### 1.3 Copy / TTS

| When                             | Emma (Lily, baked)                                              | Caption                       |
| -------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| 300 ms after the last tile lands | "Who is playing?"                                               | same, word walk as on the Hub |
| 20 s after the line ends, no tap | the same line, once (Greet's re-prompt rule, `Greet.tsx:13-14`) | same                          |
| Tap (phase 3, with a name clip)  | "\<Name\>!" (T4)                                                | the name                      |

"Who is playing?" (T5, approved) is one new `GUIDANCE_LINES` entry (`packages/core/src/emmasPath/guidanceLines.ts`), id `picker.who`, at the next free number. Vocabulary: _who_ is in the story canon ("Who is in the tent?"), _play_ in "Play again to get today's flower." (`guidanceLines.ts:165`). The cap holds. A missing clip walks the caption silently (the shipped fallback, `Greet.tsx:20-21`).

### 1.4 Motion (Reanimated; Reduce Motion in brackets)

- **Tiles in:** after Emma lands, in reading order, 60 ms apart: scale 0.85 → 1 with opacity 0 → 1, spring stiffness 260, damping 20 [opacity only, 200 ms, all at once].
- **Press:** scale 0.94, spring stiffness 400, damping 25 [none].
- **Pick:** the chime; the chosen disc pulses 1 → 1.06 → 1 over 300 ms [no pulse]; the route changes **400 ms after the tap** (the Greet heart's delay, `Greet.tsx:15`). Phase 3: the route changes 200 ms after the name clip ends, at most 1.5 s after the tap; a clip still playing then fades out over 80 ms (§ 16.3). The app makes this cut: the server neither trims nor caps a clip's length (K18). Further taps until then are ignored. The other tiles do not dim (the Hub's equal-doors rule, `hub-native.md` § 1).
- **Emma:** idle throughout, breathing, as on native Greet (`Greet.tsx:22-26`).

### 1.5 States

- **Idle:** Emma, bubble, tiles; nothing plays before the line.
- **First visit of a learner:** the same screen; the tap leads to Greet (§ 6.1).
- **Wrong tile:** nothing stops it. The Hub badge shows whose Hub it is, and one tap undoes it (§ 2.1, § 7).
- **Rotation:** the tiles re-grid into the new form's R; a pick in flight still lands.
- **Error path:** none. There is no wrong answer here, and never a red X.

## 2. Switching learner

### 2.1 The Hub badge (2–4 learners)

- The playing learner's avatar disc, **48 pt visual, 56 × 56 hit area**, at safe top + 8, safe left + 16, on P, L and W. On W the corner is free above the bubble (y < 120u). On P it clears Emma (her frame starts at x 85.5 on the 375 floor). On L it sits over the transparent corner of Emma's frame, above it in z. **Emma's long-press target leaves out the badge rect** (plus 8 pt), so a 3 s hold on the badge does nothing.
- Tap: the chime; Emma's current line stops; the picker opens. No confirm.
- Only on the Hub. Math, Word Song, the Map, Session End, Greet and Parent Settings show no badge.
- The Hub then has five visible targets, not four (`hub-native.md:22`).

### 2.2 The return rule

When the app comes back from the background (`AppState` `background`, `mobile/src/lifecycle/appVisibility.ts`) after **10 minutes or more** (`PICKER_AFTER_HIDDEN_MS = 600_000`), the device has 2+ learners and the route is Greet, Hub, Map or Session End, the app opens the picker. Leaving these four routes loses nothing: Session End's one write runs on mount (`mobile/src/session/sessionEndWrite.ts:1-12`), and Greet and the Hub only hold a kicked or prefetched session, which § 2.3 tears down. Math, Word Song and a peek are never interrupted.

### 2.3 What a switch does (App)

1. Tear down the session the Hub prefetched (`App.tsx:32-35`) or Greet kicked (`App.tsx:15-16`), as leaving Math for the Hub does (`App.tsx:15-18`).
2. `activateLearner(id)` (§ 4.4): saves `activeLearnerId` and installs that learner's store.
3. Clear the Hub's quiet-remount mark (`lastUnmountAt`, `mobile/src/screens/hub/hubAudio.ts:63-66`). A Hub mount within 30 s of the last unmount stays silent (`RAPID_REMOUNT_MS`, `hubAudio.ts:61`); a pick is a new visit, so the next learner's Hub speaks (K2).
4. Start that learner's launch reconcile, once per learner per launch (the latch in `mobile/src/lifecycle/launchReconcile.ts:19` becomes per learner id). Nothing waits for it, as today.
5. Mount the screens fresh (the QA jump's remount, `App.tsx:50-56`), at Greet or the Hub.

### 2.4 Session End returns to the learner's own Hub (2–4 learners)

**Thomas 2026-10-25: All done returns to the learner's own Hub; hand-over is the Hub badge.** With 2–4 learners Session End exits exactly as with 1 learner:

- **All done** opens the learner's own Hub.
- **An unlock waiting:** All done opens the Map as today, because the unlock is this child's. Back on that Map opens the Hub. A Map reached from the Hub keeps Back → Hub.
- **Again** keeps the same learner.
- **Handing the device on:** the Hub's badge (§ 2.1). The return rule (§ 2.2) still asks after 10 minutes in the background.

Was (Dave's EXTRA 2, approved 2026-10-19): All done opened the picker, and Back on the unlock Map opened the picker, because a child passing the device straight on never sends the app to the background, so the return rule misses that hand-over. Thomas reversed it on 2026-10-25 from build 21: after a Number Garden session with a flower, All done opened "Who is playing?" instead of Marian's Hub. The cost now: a sibling handed the device straight after Session End must tap the badge, or the session counts for the child who just played (one stray session can't master a step, § 7).

## 3. Parent Settings: learners

### 3.1 Layout

```
+--------------------------------------+
| Parent settings               [Done] |
|--------------------------------------|
| LEARNERS                             |
| (fox) Marian          Playing now    |
| (owl) Sam                          › |
| [+ Add a learner]  [Add from a code] |
|--------------------------------------|
| MARIAN                               |
| Name     [Marian____________]        |
| Picture  (fox)(lion)(frog)(turtle)   |
|          (penguin)(owl)(cat)(bear)   |
| Where to start                       |
|  Number Garden  Land 3: Big numbers ›|
|  Word Song      Land 2: Blending    ›|
| [Remove Marian]                      |
|--------------------------------------|
| … today's sections, for Marian:      |
| pending-promotion banner, the 7 rows,|
| the footnote, Backup, Cloud backup   |
| (Backup code, Last synced, Push now, |
| Restore), QA row (debug)             |
+--------------------------------------+
```

- **Learners card** (new, first): one row per learner (40 pt disc, name, or "No name" in grey), the playing one marked "Playing now". **Tapping a row makes that learner the one playing.** Every section below re-reads and shows theirs. In-flight Push now and Restore requests are aborted, as Done aborts them (`CloudBackupSection.tsx:14-16`); a Restore's ID write still lands on the learner who started it (§ 3.4). One rule for the parent: what you see below is the child who plays next.
- **"+ Add a learner"** and **"Add from a code"**: hidden at 4 learners.
- **Selected learner card** (new): Name (text field, saves on keyboard Done, 1–24 characters), Picture (the 8 avatars; ones another learner uses are at 30% and can't be tapped), Where to start, Remove (hidden with 1 learner).
- **Where to start** (D1): one row per world showing the learner's current land, "Land n: \<land name\>" (`progress/lands.ts:22-114`). The current land holds the world's first step in tree order that isn't `'mastered'`; a finished world shows its last land. A tap opens a list of that world's lands (Number Garden 1–5, Word Song 1–8). Picking another land asks first, with a system alert: **"Start \<name\> at \<land name\>?"** / "Steps before this land count as learned. This land and the ones after it start again. Stars and streak stay." / [Cancel] [Change]. Change calls `setLearnerStart` (§ 4.9). Down and up are the same row: the fast track only moves a child up, and nothing else moves one down (`mastery.ts:238-241`, "no demotion"). It is also the only way to place a fresh install's learner 1 (T7), who never goes through Add.
- **Today's sections are unchanged in look** and act on the selected learner, because each learner's settings live in their own doc (§ 5.1). **They are rendered per learner (X2):** keyed by the selected learner's id, so a row tap remounts them and drops the previous learner's copy, and built on `boundLearner(entry)` (§ 4.4), so their load, save, Push now and Restore can only reach that learner's keys and sync ID. Today the screen keeps one copy of the doc for its whole life (`ParentSettings.tsx:89-103`), and Push now reads the ID at call time (`parentSettingsDeps.ts:83-87`): without this, a toggle after a row tap would save A's doc into B's key, and Push now would send A's doc to B's record.
- **Done:** the picker if the learners or the playing learner changed during this visit, else the Hub as today. With 1 learner left: Greet or the Hub.

### 3.2 Add a learner (a sheet over Parent Settings, like the QA picker)

0. **If learner 1 has no name** (a fresh install, T7), the sheet starts with **"Name the first learner"**: their avatar disc and a Name field, with step 1's rules (D5). [Add] stays disabled until both names are valid, and writes both.
1. **Name**, required, 1–24 characters after trimming. Letters, digits, spaces, `'`, `.`, `-` (the planner sanitiser's set, `api/_planner.ts:1157`).
2. **Picture:** the first free avatar is preselected; taken ones are dimmed.
3. **Where to start:** Number Garden: land 1–5; Word Song: land 1–8, by land name (`progress/lands.ts:22-114`: "Counting" … "Hundreds"; "Letters" … "Words and stories"). Default land 1 and land 1.
4. **[Add]:** writes the start doc and the list entry (§ 4.3), and makes the new learner the one playing. On Done they get the picker, then Greet.

### 3.3 Add from a code (a sheet)

A paste field and [Add]. Step 0 of § 3.2 applies here too: an unnamed learner 1 is named in this sheet first. In core (K8): the code is checked against every other learner's sync-ID key (raw store) **before any network call**; then `fetchProgressFromCloud` and the exported `installCloudBlob(blob)` (`cloudSync.ts:526`, not exported today), with no local merge. Never `reconcileWithCloud`: on a 404 or an older cloud doc it would push the playing learner's doc to that code (`cloudSync.ts:442-453`, `:493-500`). Outcomes:

| Check                                          | Result                                                                                                                                                                                              | Line                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| The code is a learner here already             | nothing written, no network call                                                                                                                                                                    | "That's \<name\>, already on this device."                |
| Record found and readable                      | a new learner: name from `profile.childName` (trimmed, 24 chars), picture from the carrier's `avatarId` if free, else the first free; the doc installed under their keys; their sync ID is the code | "Added \<name\>."                                         |
| The record's carrier names another code (X3)   | nothing written                                                                                                                                                                                     | "That backup holds another learner's progress."           |
| No record                                      | nothing written                                                                                                                                                                                     | "No progress found for that code."                        |
| Record fails the guard (`cloud-blob-rejected`) | nothing written                                                                                                                                                                                     | "That backup can't be opened on this version of the app." |
| Network or server error                        | nothing written                                                                                                                                                                                     | today's `restoreFailedMessage`                            |

A record with no carrier is accepted: it may be another device's learner 1 from before profiles. A record whose `childName` is empty adds the learner unnamed and opens their card with the Name field focused.

### 3.4 Cloud backup, per learner

Today's section, renamed for parents: **"Backup code"** replaces "Device ID" (`copy.ts:88`, `:95`), and the body names the selected learner (`copy.ts:87`). Copy, Last synced, Push now and Restore work as today, on the selected learner's sync ID, through `boundLearner(entry)` (§ 4.4).

- **Restore is bound to the learner who started it (K3).** An abort does not stop its ID write: in both push branches the reconcile returns `pushed-to-cloud` whatever the push returned (`cloudSync.ts:448-453`, `:494-500`), and `adoptDeviceIdAfterRead` then writes the ID (`cloudBackup.ts:161-166`). So the write must land on that learner's sync-ID key, whoever plays by then.
- **Two refusals,** both with nothing written: a code that another learner on this device holds → "That code is \<name\>'s.", checked before any network call (K8); a record whose carrier names another code → "That backup holds another learner's progress." (§ 4.5, X3). Two learners must never push to one record.

### 3.5 Remove

System alert: **"Remove \<name\>?"** / "This deletes their progress on this device. Their backup code brings back their progress, but not their stars or streak: those are not in the backup and will not come back." / [Cancel] [Remove] (destructive). It removes the list entry and that learner's 7 keys (§ 4.2). The cloud record is kept. If they were playing, the first remaining learner plays next.

The body says plainly what is lost (Dave's EXTRA 1): stardust and session history, with the streak, are never in the cloud (§ Today), so a parent told "you can add them back" would expect the stars to return.

### 3.6 Copy

Native takes its own strings (the `nativeCopy.ts` departure pattern), so the frozen web keeps its strings. Every "Marian" in § Today's parent strings becomes the selected learner's name, "this child" when unnamed, and "she/her" becomes "they/their". Examples: "Show level to Sam"; "Advance Sam to the next skill once they meet the mastery threshold."; "Back to Sam's start" (QA, debug).

New strings approved in T6: "Learners", "Playing now", "No name", "+ Add a learner", "Add from a code", "Where to start", "Backup code", § 3.3's and § 3.4's other lines, and § 3.5's alert with Dave's stars-and-streak sentence. New since T6 and open for Thomas (T9): the Where-to-start alert (§ 3.1), "Name the first learner" (§ 3.2) and "That backup holds another learner's progress." (§ 3.3, § 3.4).

## 4. Data model (Kevin)

### 4.1 Types (`@marian/core/learners`, new)

```ts
export const LEARNERS_STORAGE_KEY = 'marian-tutor:learners:v1'
export const MAX_LEARNERS = 4 // the add buttons' cap (T1); the guard has no upper bound
export const LEARNER_NAME_MAX = 24 // types.ts:466

export type AvatarId =
  | 'fox'
  | 'lion'
  | 'frog'
  | 'turtle'
  | 'penguin'
  | 'owl'
  | 'cat'
  | 'bear'

/** Reserved for the planned Danish version. Only 'en' exists; nothing reads it yet. */
export type LearnerLanguage = 'en'

/** Land numbers per world (lands.ts), or the migrated learner's defaultProgress(). */
export type LearnerStart = { math: number; wordSong: number } | 'legacy-default'

export interface LearnerEntry {
  id: string // v4 UUID made at add time; the suffix of their keys; local only, never sent
  name: string // trimmed, 0..24 chars ('' only for an unnamed learner)
  avatarId: AvatarId // unique on the device
  language: LearnerLanguage
  legacySlot: boolean // true for at most one learner: their data is under today's keys
  start: LearnerStart // rebuilds their doc if it is ever missing (§ 4.8); moved by § 4.9
  createdAtISO: string
}

export interface LearnerList {
  schemaVersion: 1
  learners: LearnerEntry[] // 1+ entries, in add order (the picker's order)
  activeLearnerId: string // one of learners[].id
}

/** One learner's storage, whoever is playing (§ 4.4). */
export interface LearnerIo {
  load(): Progress | null
  save(doc: Progress): void // stamps this learner's carrier (§ 4.5)
  syncId(): string // getOrCreateDeviceId() on this learner's key
  writeSyncId(id: string): void
  recordLastSync(): void
}
```

Core's store seam gains one optional member, `keys?(): string[]`. Native's sqlite adapter implements it with `getAllKeysSync()`; the web's needs none (it installs no list).

API, exact names (one shared vocabulary for PR A and PR B): `ensureLearnerList()`, `loadLearnerList()`, `saveLearnerList(list)`, `isLearnerList(v)`, `activeLearner()`, `activateLearner(id)`, `addLearner({ name, avatarId, start })`, `addLearnerFromBackup(code)`, `renameLearner(id, name)`, `setLearnerAvatar(id, avatarId)`, `setLearnerStart(id, world, land)`, `removeLearner(id)`, `learnerKey(baseKey, entry)`, `learnerScopedStore(raw, entry)`, `boundLearner(entry)`, `learnerStartProgress(entry)`, `startProgressForActive()`, `currentLand(progress, world)`, `nextAfterPick(entry)`.

### 4.2 Keys

| Data                | Learner in the legacy slot (learner 1)      | Every other learner             |
| ------------------- | ------------------------------------------- | ------------------------------- |
| progress doc        | `marian-tutor:progress:v1`                  | `marian-tutor:progress:v1:<id>` |
| session history     | `marian-tutor.session-history.v1`           | `…:<id>`                        |
| stardust            | `marian-tutor.stardust.v1`                  | `…:<id>`                        |
| not-yet nudge       | `session-end-not-yet-nudge.v1`              | `…:<id>`                        |
| flower wake         | `hub-flower-wake.v1`                        | `…:<id>`                        |
| sync ID (cloud key) | `marian-tutor:device-id`                    | `…:<id>`                        |
| Last synced         | `marian-tutor:last-sync`                    | `…:<id>`                        |
| learner list        | `marian-tutor:learners:v1` (one per device) |                                 |

`learnerKey(base, entry)` = `entry.legacySlot ? base : \`${base}:${entry.id}\``. The legacy slot is never reused. A learner added after learner 1 was removed gets suffixed keys.

### 4.3 Migration (`ensureLearnerList()`)

Runs in `installNativePlatform` right after `setKeyValueStore` (`mobile/src/platform/native.ts:82`), before the QA step and the debug seed (`native.ts:100-109`), so both write to the playing learner (K12). **It never throws:** boot runs at import (`mobile/src/platform/boot.ts:28`), so on any error it installs the raw store, which is today's behaviour.

1. Read `LEARNERS_STORAGE_KEY` from the raw store. It passes `isLearnerList` → step 6.
2. It parses and has `schemaVersion` above 1 (a newer build's list, § 4.7 rule 5): build a list in memory by steps 3–4, **write nothing**, and go to step 6 (K11).
3. **Learner 1, the legacy slot, decided from the raw progress key (X1):**
   - `raw.getItem('marian-tutor:progress:v1') === null` → a fresh install: name `''`, start `{ math: 1, wordSong: 1 }`.
   - Anything stored there, readable or not → name from the parsed doc's `profile.childName` (trimmed, 24 chars), or `''` if it doesn't load; start `'legacy-default'`.
   - Either way: a new UUID, `avatarId 'fox'` (T3), `language 'en'`, `legacySlot true`, now.
   - On a rebuild (a list was present but failed), learner 1 is made only when the legacy progress key holds something, or the scan in step 4 finds nobody.
4. **Other learners, on a rebuild only (K11):** when the raw store has `keys()`, each `marian-tutor:progress:v1:<uuid>` becomes an entry with `id` = that suffix (so their other 6 keys reattach), name from their doc's `childName`, picture from their carrier if free (else the first free), `language 'en'`, start `{ math: 1, wordSong: 1 }`, `legacySlot false`, in key order. A first migration has none.
5. Write the list with **one** `setItem`. Then, only for a fresh install (step 3's first case), write `learnerStartProgress(entry)` to `marian-tutor:progress:v1`. **Nothing here ever writes a progress key that holds anything.** In this order a crash between the two writes leaves a list whose learner has no doc, and the readers' fallback builds the same start doc (§ 4.8, K7).
6. Install `learnerScopedStore(raw, active)`: the list's `activeLearnerId`, or after a rebuild the first learner.

Nothing is copied, moved or deleted. On Marian's devices the list is the only new key. A corrupt list leaves every learner's data untouched; the scan brings learners 2–4 back with their keys and cloud links. Add from a code is the fallback where keys can't be listed. There is no second copy of the list (K11).

### 4.4 The scoped store and bound I/O

`learnerScopedStore(raw, entry)` is a `KeyValueStore` that rewrites the 7 per-learner keys through `learnerKey` and passes every other key through. `activateLearner` installs it with `setKeyValueStore`. The 7 modules, the 4 push sites and launch reconcile need no changes: they already call `getKeyValueStore()` or `getOrCreateDeviceId()` per call (K2 checked each reader).

**The web installs no list**, so it never gets a scoped store and every key stays as today.

**`boundLearner(entry)`** returns a `LearnerIo` (§ 4.1) that reads and writes through `learnerScopedStore(raw, entry)` whatever learner is playing. How `storage.ts`, `deviceId.ts` and `lastSync.ts` reach a given store (an optional store argument, say) is Kevin's call. Every async writer and Parent Settings use it:

- **Reconcile's install** (`installLocally`, `cloudSync.ts:395-397`) saves through the learner it started for.
- **Restore** (`AdoptDeviceIdDeps`, `cloudBackup.ts:107-111`): load, reconcile and the ID write are that learner's. Required, not optional (§ 3.4).
- **The sync-success listener carries the ID (K3).** `CloudSyncSuccessListener` becomes `(syncId: string) => void` (`cloudSync.ts:154`), and `notifySynced` passes the ID it synced (`:165`, called at `:252`, `:488`, `:505`). Native's listener (`native.ts:85`) writes Last synced for the learner whose sync-ID key holds that ID, read from the raw store. No match: nothing is written.
- **Parent Settings' deps** are built per learner from `boundLearner(selected)` (§ 3.1, X2).
- The 4 pushes already read their ID and doc before their first `await` (`progressHistory.ts:477`, `:514`, `unlockBeat.ts:79`, `parentSettingsDeps.ts:85`; K3).

**Module state across a switch (K2).** Every store reader reads the installed store on each call. Three module states would carry over and are reset per learner: the launch-reconcile latch (`mobile/src/lifecycle/launchReconcile.ts:19`) becomes per learner id; the Hub's quiet-remount mark (`hubAudio.ts:63`) is cleared on a switch (§ 2.3); `reviewBaseline()`'s cache (`reviewPlan.ts:79`) becomes per learner (§ 4.8).

### 4.5 The doc carrier

One new optional top-level field on `Progress`, additive with no bump, as `parentSettings` was (`types.ts:648`):

```ts
/** Whose doc this is. Stamped by native's learners module; never shown. */
learner?: { syncId?: string; avatarId?: string; language?: string }
```

- **On every save** of a learner's progress key, including a bound save while another learner plays (K3), the doc carries that learner's `syncId`, `avatarId` and `language`, and `profile.childName` is set to their list name. Add from a code and the rebuild (§ 4.3 step 4) read them back.
- **On every push**, `syncId` is set to the ID being pushed to (X3). This happens in one place in core's push, through a hook the learners module installs (the `setCloudSyncSuccessListener` pattern). Where the save stamp lives is Kevin's call, also in one place, not per caller. The web and older builds install no hook. They keep whatever carrier the doc has: `installCloudBlob` and the local load + save keep unknown top-level fields, build 8 included (K4).
- **Guard:** when present, an object whose three fields are strings when present. Unknown values pass (an old build or a newer avatar set must not reject the doc), the same rule as step names (`guards.ts:383-397`). Writers always write all three.
- **The refusal (X3).** Reconcile, Restore and Add from a code check a fetched cloud doc against the record key it came from:
  - The carrier's `syncId` is set and differs from the key: **refused.** Local is kept and nothing is installed, written or pushed. Reconcile returns a new result, `cloud-learner-mismatch` (logged, no UI); the learner's next session-end push writes their own doc back over the record (`progressHistory.ts:477` pushes unconditionally). Restore and Add from a code show "That backup holds another learner's progress."
  - No carrier, or no `syncId`: **accepted for the legacy learner**, as today (an older build on the other device writes learner 1's record, AC 41). **Refused the same way for every other learner** in reconcile and Restore: only profiles builds write their records (§ 4.6), and those always stamp. Add from a code accepts it (§ 3.3).
  - Why: builds 8–15 and the web can still Restore with any code. Pasting Sam's Backup code into the old iPhone or the web pushes that device's doc to Sam's record when it is newer (`cloudSync.ts:493-500`, `cloudBackup.ts:161-166`; the web writes the ID first, `cloudBackup.ts:131`). The next launch here would see Sam's record as newer and install it into Sam's slot.
  - What it doesn't catch: an older build holding another child's carrier-less doc writing into the legacy learner's record. That is today's single-child risk, unchanged.

### 4.6 Cloud, per learner

- Each learner's sync ID is a v4 UUID under their sync-ID key, made by `getOrCreateDeviceId()` through the scoped store. Learner 1's is today's device ID, so **their cloud record does not change**.
- Server: none. `/api/progress` takes any v4 UUID; its rate limit is per UUID (`api/progress.ts:31-36`), so each learner has its own bucket.
- **Two devices, both on the profiles build:** learner 1 keeps the link they have. Each other learner is linked once per device with Add from a code. Then both devices push and reconcile each learner's record. Conflicts follow today's per-record rules (`cloudSync.ts:467-490`). Names and pictures are per device after the add (a rename on one device does not move to the other). **Linking a learner other than learner 1 needs the profiles build on both devices:** an older build's writes into that record are refused (§ 4.5).
- **No two learners on one device share a sync ID** (K8). The check runs in core, against the other learners' sync-ID keys in the raw store, before any network call: in `addLearnerFromBackup` and in the bound Restore.

### 4.7 Forward compatibility (the #597 lesson)

PR #597 named the failure chain: a build whose guard rejects the cloud doc gets `cloud-blob-rejected`, and then its stale doc overwrites the cloud copy. Session-end pushes are unconditional (`progressHistory.ts:477`). Rules for profiles:

1. **No `schemaVersion` bump.** An older `migrate` refuses newer versions (`migrate.ts:48-49`).
2. **`profile.character` stays `'melody'`** (`guards.ts:405`).
3. **The carrier is top-level and optional.** An older guard ignores unknown top-level keys, and an older local load + save and cloud install keep them (`migrate-additive-fields.test.ts:180-230`; `installCloudBlob`, K4). AC 20 pins the cloud-install path.
4. **Nothing local crosses devices, and no record takes another learner's doc.** The list and the suffixed keys stay on their device. An older build or the web meets a profiles learner's record only if a parent pastes that learner's Backup code into it, and § 4.5's refusal keeps that doc out of the learner's slot.
5. **Never downgrade a device that has run the profiles build.** A downgrade sees learner 1 only; the other learners' data stays on disk, unseen.
6. **A newer list is never written back** (§ 4.3 step 2).

### 4.8 A learner's start doc

`learnerStartProgress(entry)`:

- `'legacy-default'` → `defaultProgress()`, Marian's baseline as today (`defaults.ts:264`).
- `{ math: m, wordSong: w }` → start from the schema floor (`defaultLockedSkillLevels()`, `defaults.ts:158-164`). In each world, every step of the lands before the chosen land is `'mastered'`, the land's first step is `'intro'`, later steps are `'locked'`: `progressAtStep`'s rule (`debug/stepProgress.ts:13-20`), applied to both worlds. Diagnostic levels never carry over: `progressAtStep` today keeps the other world's defaults. Name from the entry; `parentSettings` the defaults; history, Leitner and good days empty.

A learner added from a code has `start: { math: 1, wordSong: 1 }`, used only if their doc is ever lost.

**`startProgressForActive()`** = `learnerStartProgress(activeLearner())` when a list is installed, else `defaultProgress()` (the web). It replaces `defaultProgress()` at all 12 production fallbacks (§ 15 K7), so a missing doc is rebuilt as that learner's start, never as Marian's diagnostic. The QA jump's `progressAtStep` starts from it too, and "Back to \<name\>'s start" writes it.

**The review baseline is per learner (K7).** `reviewBaseline()` becomes the steps `'mastered'` in the playing learner's start doc, cached per learner id. Today it is the steps mastered in `defaultProgress()`, once per process (`reviewPlan.ts:79-93`). For learner 1 (`'legacy-default'`) nothing changes. A land-1 learner then gets `number-recog` and `letter-names` reviewed once mastered by play, and a land-3 learner is never reviewed on steps they were only placed past.

### 4.9 Moving a learner's start (`setLearnerStart`, D1)

`setLearnerStart(id, world, land)` rewrites one world of that learner's doc:

- **Rebuilt:** that world's `skillLevels` by § 4.8's rule for the new land, plus the per-step detail `progressAtStep` sets (Word Song: the letter-sounds vowel states and `lifetimeFirstEncounters`, `stepProgress.ts:22-37`). `pendingPromotion` is cleared if it names a step of that world.
- **Kept:** the other world, history, the Leitner box, good days, secure days, pace holds, unlock markers, settings, stardust, session history and streak.
- **The entry's `start`** takes the new land for that world, so a lost doc and the review baseline follow the move.
- **Stamped** like a QA jump: `profile.lastPlayedISO` = now, so the next reconcile pushes the move rather than an older cloud doc undoing it (`stepProgress.ts:44-50`). Session history is not touched, so a learner who has never played still gets Greet (§ 6.1).

## 5. Settings

### 5.1 Per learner (all of today's)

Each doc carries its own `parentSettings` (`types.ts:650`), so all 7 rows are per learner with no new code: auto-promote, the session-mode picker, the two mastery thresholds (default 0.875 on 3 separate days, `progress/parentSettings.ts:57`), fresh-day mastery, show level, cross-vowel mixing. A new learner gets `DEFAULT_PARENT_SETTINGS` (`parentSettings.ts:91-105`). Also per learner: Where to start (§ 3.1), the pending promotion, stardust, session history and streak, Last synced, the sync ID.

### 5.2 Language (reserved)

`LearnerEntry.language` and the carrier's `language`, value `'en'`, no UI, no reader. The planned Danish version decides what a non-`'en'` learner does, including on a build that only knows English. Per learner, not per install, because a learner's levels belong to one language's trees, and a family may have one child in each language.

## 6. What the child sees change

### 6.1 Greet

It plays once per learner: `nextAfterPick` goes to Greet when the learner's `sessionCount === 0` **and** their doc's `history` is empty. A learner added from a code has history in their doc but no local session history; they go to the Hub, never to "nice to meet you". The `lastPlayedISO === null` term K6 confirmed is dropped: § 4.9's move stamps it on a learner who may not have played yet.

**Splash uses the same rule with 1 learner (K6):** it returns `nextAfterPick(activeLearner())`, not `sessionCount` alone (`nextAfterSplash.ts:20-27`). Today's paths come out the same: a returning device has `sessionCount ≥ 1`, and a fresh one has an empty doc. The case it fixes: Marian removed, the one learner left was added from a code. Greet's lines and motion don't change.

### 6.2 Hub, Map, Session End, stardust

- **Hub:** the badge with 2+ learners (§ 2.1). Cards, flowers, guidance and Emma's lines are the playing learner's, read as today.
- **Map:** the playing learner's lands, stops and unlock beats; the seen-marker is written to and pushed for that learner (`unlockBeat.ts:73-80`).
- **Session End:** written to the playing learner. No name, no sibling mention. All done opens the learner's own Hub, with any number of learners (§ 2.4).
- **Stardust:** per learner, never summed, never shown beside another's.

### 6.3 Names

Phase 1–2: the name is on the picker tile as text only. Emma says no name anywhere, and session requests carry `'friend'` (P7). Phase 3 (T4, approved): Emma says "\<Name\>!" on the picker tap, and nowhere else: never in praise or teaching lines (D6). No name clip means today's silent pick. That fallback is the shipped behaviour, not an error.

## 7. Edge cases

- **Remove a learner:** § 3.5. Removing the last learner isn't possible. Their cloud record stays (no server delete). Re-adding them by code restores their doc but not stardust or session history with the streak, which were never in the cloud (§ Today); the alert says so.
- **Restore onto a device with other learners:** Add from a code makes a new learner; it never overwrites one (§ 3.3). A per-learner Restore stays read-first (`cloudBackup.ts:157-168`), is bound to its learner (§ 3.4), and refuses another learner's code or a record that carries another code (§ 3.4, § 4.5).
- **Two learners, one device, mid-session:** a session belongs to the learner who started it. The picker never interrupts Math, Word Song or a peek (§ 2.2). A reconcile still in flight from before a switch lands in its own learner (§ 4.4).
- **One child hands the device to another after a session:** the Hub's badge (§ 2.1); Session End returns to the playing learner's Hub (§ 2.4, Thomas 2026-10-25).
- **A sibling taps the wrong tile:** the badge shows whose Hub it is; one tap fixes it. A whole session played as the sibling adds at most one day toward the sibling's step. A step needs 3 good days (`parentSettings.ts:57`) or 2 secure days on the fast track, so one stray session can't master it (D2).
- **A learner placed too high:** a parent moves them down with Where to start (§ 3.1, § 4.9).
- **No network:** picking, switching, adding, renaming, moving and removing are local and work. Add from a code shows the error line and writes nothing. Reconcile keeps local on `cloud-error`, as today. Phase 3: no name clip until the next time Parent Settings is open and online.
- **Two Marians on one device:** not possible by accident. Add from a code with the code of a learner already here is refused (§ 3.3).
- **An older build or the web on another device:** it syncs learner 1's record as today and never sees the others (§ 4.7). If a parent pastes another learner's Backup code into it, that device's doc can't reach that learner here (§ 4.5).
- **Debug QA jump and seeds:** they act on the playing learner. The jump starts from `startProgressForActive()`. "Back to \<name\>'s start" writes `learnerStartProgress` (for learner 1: `defaultProgress()`, as today).

## 8. Child-safety and dark-pattern check

- **No comparison:** no screen a child sees shows another learner's flowers, stars, levels, streak, stardust or play time. Picker tiles carry a picture and a name, nothing else (§ 1.2). The order is fixed; it never sorts by progress or by who played last (D3).
- **No leaderboard, no shared pool:** stardust, flowers and unlocks are per learner. No "family total", no sibling unlocks.
- **No shaming or nudging between siblings:** Emma never mentions another child, who played today or who didn't. No streak copy across learners.
- **No pressure to switch or stay:** switching costs nothing and loses nothing mid-day. The return rule and the badge only ask "Who is playing?" (§ 2.1, § 2.2).
- **Avatars:** animals, not people. No gender, skin or appearance coding. Colours avoid red (never a red X), and the cat is grey, not pink (D7). The child picks their own with the parent (T3, D7).
- **Adult gate unchanged:** add, rename, move, remove and restore sit behind the 3 s press (`Hub.tsx:65-66`).
- **Honest parent copy:** the Remove alert says what does not come back (§ 3.5).
- **Privacy:** names stay on the device and in the learner's own cloud record (which already carries `childName` today, `api/progress.ts:23-27`). No name goes into session requests (P7). The learner ID is never sent. Phase 3 sends the spoken name to the name-audio endpoint and on to ElevenLabs, once per render (§ 16.4).

## 9. Assets

- **8 avatars:** clay animal stickers in the Hub's clay look, transparent, one per `AvatarId`, each on its fixed colour disc (T2): fox orange, lion yellow, frog green, turtle teal, penguin blue, owl purple, cat grey, bear brown. Generated with the pack pipeline (`scripts/generatePackPictures.ts`, a new manifest batch, contact sheet `scripts/packPictureSheet.ts`), registered through `mobile/scripts/export-assets.mjs` (the generated `mobile/src/assets/registry.ts`).
- **1 Emma line:** "Who is playing?" (Lily, § 1.3).
- **Phase 3:** one name clip per learner, on the device, stored under `Paths.document`, not `Paths.cache`, which "The OS may purge" (`mobile/src/audio/sessionAudio.ts:79`; T4, K10).
- **Reused:** the chime, the Hub gradient, Emma idle.

## 10. Wiring checklist

- **Core (Kevin, PR A):**
  - `@marian/core/learners` (§ 4.1), the scoped store, `boundLearner`, `setLearnerStart`, `currentLand`.
  - `ensureLearnerList` in `installNativePlatform`, never throwing, deciding from the raw key (§ 4.3); `keys?()` on the store seam and native's sqlite adapter.
  - The carrier in `Progress` and `isProgressV1`; the save stamp and the push stamp; the `cloud-learner-mismatch` refusal in reconcile, Restore and Add from a code; `installCloudBlob` exported.
  - The learner-bound `installLocally`, `AdoptDeviceIdDeps` and the ID-carrying sync listener (`cloudSync.ts:154`, `native.ts:85`).
  - `learnerStartProgress`, `startProgressForActive` at the 12 fallbacks, including the 3 native ones (`ParentSettings.tsx:91`, `sessionEndWrite.ts:117`, `:194`); `progressAtStep` from the learner's start; the per-learner review baseline.
  - `nextAfterSplash` → `picker` with 2+ learners and `nextAfterPick` with 1; `nextAfterPick`; `Route` + `'picker'`; the per-learner launch-reconcile latch.
  - `childName: 'friend'` in the 3 native request builders, and the 12 test assertions that pin `'Marian'` flipped (§ 15 K9).
  - Maestro `01-first-launch` and `02-hub-math-session-end` re-baselined to the floor start (§ 15 K7).
- **Native (Devon, PR B):**
  - `PickerScreen` (§ 1), the Hub badge and the long-press exclusion (§ 2.1), the return rule (§ 2.2), App's switch with the quiet-remount clear (§ 2.3), Session End's handover and the unlock Map's Back (§ 2.4).
  - Parent Settings: the learners card, the selected-learner card with Where to start and its alert, the 3 sheets with D5's naming step, the sections keyed by learner on `boundLearner` deps (§ 3).
  - Native copy (§ 3.6), the `picker.who` line in `GUIDANCE_LINES` and its Lily render (T5), the 8 avatars (T2).
- **Unchanged on purpose:** `/api/progress`, `_progressStore.ts`, the canon, the planner prompt, the guard's step-name rules, `schemaVersion`, every web screen.

## 11. Acceptance criteria

**Core (vitest, PR A):**

1. **Migration, upgrade:** a store holding today's 7 keys from a real-shaped doc → `ensureLearnerList()` adds exactly one key (`marian-tutor:learners:v1`), and every other key stays byte-equal. One learner, `legacySlot: true`, named from `profile.childName`, start `'legacy-default'`, active.
2. **Migration, unreadable doc (X1):** a progress key holding invalid JSON, and one holding a doc that fails the guard → the list is added and the progress key stays byte-equal; one learner, `legacySlot: true`, name `''`, start `'legacy-default'`.
3. A second `ensureLearnerList()` writes nothing.
4. **Migration, fresh install:** no progress key → one learner, name `''`, start `{ math: 1, wordSong: 1 }`; the legacy progress key holds a doc with `number-recog` and `letter-names` at `'intro'` and every other step `'locked'`.
5. **Never throws (K12):** a raw store whose `getItem` throws → `ensureLearnerList()` returns, and the raw store is installed.
6. **Scoped store:** learner 1 active → each of the 7 keys maps to itself; learner B active → `<key>:<B.id>`; the list key and any other key pass through.
7. **Isolation:** a Session End write for B (`recordSessionEnd` + `recordProgressOnSessionEnd`) changes only B's keys; learner 1's 7 keys stay byte-equal.
8. A session end for B pushes to B's sync ID (fetch stub), never to learner 1's, and the pushed doc's carrier is B's: `syncId` = B's sync ID, B's `avatarId` and `language`.
9. **Bound reconcile:** A's reconcile held open on a stubbed fetch, switch to B, release → the cloud doc is in A's progress key, B's is byte-equal, the listener gets A's sync ID, and Last synced is written for A only.
10. **Bound Restore:** `adoptDeviceIdAfterRead` for A, switch mid-flight, and abort → A's sync-ID key holds the code, B's is unchanged.
11. **Bound carrier:** a reconcile install for A while B plays → A's saved doc carries A's carrier and A's name, not B's.
12. A Restore or Add from a code with a code another learner holds → refused, nothing written, and the fetch stub sees no call.
13. **Add from a code:** a found record → a new entry (name from `childName`, cut to 24; avatar from the carrier if free, else the first free), the doc installed under its keys, sync ID = the code. The playing learner's keys stay byte-equal; a 404 pushes nothing.
14. **Mismatched record (X3):** a cloud doc whose carrier `syncId` differs from its record key → reconcile returns `cloud-learner-mismatch` and writes and pushes nothing; Restore and Add from a code refuse with nothing written. A doc with no carrier → refused the same way for a non-legacy learner's reconcile and Restore; installed for the legacy learner; accepted by Add from a code.
15. **Remove:** B removed → B's 7 keys gone, the list without B, learner 1 byte-equal. The last learner can't be removed. Removing the playing learner makes the first remaining one active.
16. **Start doc:** `{ math: 3, wordSong: 2 }` → Number Garden lands 1–2 mastered, land 3's first step `'intro'`, the rest `'locked'`; Word Song land 1 mastered, `blending-cv` `'intro'`, the rest `'locked'`. No diagnostic level appears (`sub-to-10` is not `'practicing'`).
17. **Move (D1):** a learner at Number Garden land 3, `setLearnerStart(id, 'math', 1)` → Number Garden rebuilt from land 1; Word Song, history, the Leitner box, good days, stardust and session history unchanged; `lastPlayedISO` stamped; the entry's `start.math` is 1; a pending promotion in Number Garden cleared. `currentLand` then returns land 1.
18. **Fallbacks (K7):** with B's doc missing, a session end for B saves B's start doc, not the diagnostic. A source scan finds `defaultProgress()` called in production code only by `startProgressForActive` and `learnerStartProgress`.
19. **Review baseline (K7):** learner 1 (`'legacy-default'`) → today's set; a land-1 learner → empty; a land-3 learner → the steps of lands 1–2. After a switch from A to B, `reviewBaseline()` returns B's set.
20. **Forward compat:** a doc with `learner: { syncId: <uuid>, avatarId: 'unicorn', language: 'da' }` loads and round-trips through local load + save and through a cloud install unchanged. `learner: 'x'` rejects.
21. `isLearnerList` accepts 5 entries and unknown avatar and language strings; it rejects a missing `activeLearnerId`, one not in the list, and `schemaVersion: 2`.
22. **Rebuild (K11):** a corrupt list with `keys()` → learner 1 from the legacy slot, plus one learner per `marian-tutor:progress:v1:<uuid>` (id = the suffix, name from `childName`, picture from the carrier if free); every progress key stays byte-equal. A list with `schemaVersion: 2` → used in memory, and its stored bytes are unchanged.
23. **Routing:** 2+ learners → Splash goes to `picker`. 1 learner → Splash returns `nextAfterPick`: `greet | hub` as today, and a learner with doc history but no session history → `hub`.
24. Every native session payload sends `childName: 'friend'`; the 12 assertions in § 15 K9 expect it.
25. No list installed (the web) → every key as today; the web suites pass unchanged.
26. **Maestro:** `01-first-launch` and `02-hub-math-session-end` pass on the floor start (Number Garden opens at `number-recog`).

**Native (jest, PR B):**

27. The picker renders n tiles in add order, each with avatar and name. A tap → chime and pulse, then the route 400 ms later; a second tap in that window is ignored.
28. "Who is playing?" plays once 300 ms after the tiles land and once more 20 s after it ends without a tap. A missing clip walks the caption silently.
29. **One learner:** no picker, no badge, Session End exits as today. The existing App, Hub, Session End and Parent Settings suites pass unchanged.
30. **Badge:** top-left, hit area 56 × 56; a tap opens the picker. Emma's 3 s press still opens Parent Settings; a 3 s press on the badge does not.
31. **Return rule:** hidden 10 min on Greet, Hub, Map or Session End with 2+ learners → the picker on return. On Math, Word Song or a peek: no change. At 9 min 59 s: no change.
32. **Switch:** a pick within 30 s of leaving A's Hub → B's Hub plays its line (K2).
33. **Session End, 2+ learners:** All done opens the learner's own Hub; with an unlock waiting, the Map, and its Back opens the Hub; Again starts the same learner's session (Thomas 2026-10-25; was: the picker).
34. **Parent Settings, selecting:** a row tap moves "Playing now" and every section re-reads; an in-flight Push now or Restore is aborted. A toggle after the row tap changes only B's keys, and Push now sends B's doc to B's sync ID (X2).
35. **Parent Settings, adding:** Add enforces 1–24 characters and unique pictures and offers the lands. With an unnamed learner 1, both sheets ask for their name first and [Add] writes both names (D5). § 3.3's 6 outcomes show their lines.
36. **Where to start:** each world's row shows the current land; picking another land shows the alert; Cancel writes nothing; Change calls `setLearnerStart`.
37. **Remove and copy:** the Remove alert matches § 3.5, with the stars-and-streak sentence. Parent copy names the selected learner. Done → the picker when the set or the playing learner changed, else the Hub.
38. A picker tile renders no flower, star, level or count element.

**Device** (Thomas's iPad and iPhone):

39. **Upgrade on the iPad:** Marian's map, flowers and steps exactly as before the build; no picker; Parent Settings shows one learner, "Marian".
40. **Add a second learner:** the picker on the next launch; each learner's map is separate; the badge switches; Session End hands over to the picker.
41. With the iPhone left on an older build: a session on either device shows on the other after a relaunch (learner 1's record).
42. Add from a code on the iPhone: the second learner appears with their progress.

## 12. Build split and order

1. **PR A, Kevin (data first):** core, migration, keys, scoped store and bound I/O, the carrier with both stamps and the refusal, the ID-carrying sync listener, start docs, `setLearnerStart`, the per-learner review baseline, the 12 fallbacks, routing helpers, the `'friend'` name with its 12 test flips, and the Maestro re-baseline. ACs 1–26. **With one learner it changes nothing visible** except a fresh install's start (land 1, T7), so it can ship alone. Install it on both devices before PR B, so the migration has run on each before a second learner exists. This is recommended for a clean order; compat does not need it (§ 4.7).
2. **PR B, Devon (screens), after A merges** (it imports A's names, § 4.1): picker, badge, return rule, App's switch, Session End's handover, Parent Settings (keyed sections, Where to start, the naming step), copy, the line and the avatars. ACs 27–38, then 39–42 on the devices. Needs T9 for its 3 new lines. The ear test for the line and the contact sheet for the avatars are Thomas's.
3. **PR C, phase 3 (Kevin server + Devon UI), after B is on the devices (T4 approved):** name clips. A small name-render endpoint, Parent Settings preview and retake, the picker tap. Its own ACs in its own spec section, written before PR C starts: § 16, ACs 43–66.

**Moved by this fold:** into PR A, the 3 native fallback sites (`ParentSettings.tsx:91`, `sessionEndWrite.ts:117`, `:194`; one-line swaps, so every fallback changes in one PR), the 12 native test flips, the Maestro re-baseline, `keys?()` in native's sqlite adapter, the listener change at `native.ts:85`, and the core halves of D1 and X2 (`setLearnerStart`, `boundLearner`). Into PR B: the X2 keying, Where to start's row and alert, D5's naming step, the quiet-remount clear and Session End's handover. Nothing moved out of PR A or out of PR B.

Reviewers: Devon reviews A, Kevin reviews B (`feedback_pr_review_routing`).

## 13. Thomas decides (T1…)

Thomas approved T1–T8 and Dave's EXTRA 2 by popup on 2026-10-19. T9 is open. Phase 3's T11–T13, approved by popup on 2026-10-20, are in § 16.9.

- **T1. Up to 4 learners per device.** 4 keeps every picker tile at least 103 × 130 pt on the smallest phone (§ 1.2). **Approved (Thomas, 2026-10-19).**
- **T2. The 8 avatars and their colours:** fox orange, lion yellow, frog green, turtle teal, penguin blue, owl purple, cat grey, bear brown. Clay animals in the Hub's look, no red. Spend: about $0.80 at wave 4's average of $2.43 for 25 images (`content-wave-4.md:483`), cap $1.50 with retakes. The generator's `--dry-run` prints the real number before any call. The look is judged on the contact sheet. **Approved (Thomas, 2026-10-19), with the cat grey (Dave D7; was pink), about $0.80, cap $1.50, judged on the contact sheet.**
- **T3. Marian's picture:** Marian picks it with Thomas in Parent Settings once PR B is on the iPad; fox until then. **Approved (Thomas, 2026-10-19).**
- **T4. Name audio (phase 3): yes, in Emma's voice (Lily), on the picker tap only.** One clip per name, rendered when a parent saves the name (about 6–25 characters each from the Lily budget). The parent hears it in Parent Settings and can retake it or type a "sounds like" spelling. It needs a new server endpoint (K10). This is the one place Parent Settings plays a sound. Without a clip, the pick stays silent. **Approved (Thomas, 2026-10-19): yes, phase 3, Lily, on the picker tap only, with the parent preview and retake.**
- **T5. The line "Who is playing?"** (15 characters of Lily), ear-tested in voice-QA. **Approved (Thomas, 2026-10-19).**
- **T6. Parent-facing words:** "Learners", "Playing now", "No name", "+ Add a learner", "Add from a code", "Where to start", "Backup code" (for "Device ID"), and § 3.3–3.5's lines; "they" for every learner. **Approved (Thomas, 2026-10-19): as written, plus Dave's Remove warning that stars and streak are not in the backup and will not come back (§ 3.5).**
- **T7. A fresh install keeps today's zero-setup first run** (Splash → Greet → Math). Its learner 1 is unnamed, starts at land 1 in both worlds, and is named when a second learner is added (§ 3.2 step 0). Today a fresh install starts at Marian's diagnostic. Marian's devices are upgrades and keep her doc. **Approved (Thomas, 2026-10-19), with a per-learner Where to start row that a parent can also move down (Dave D1; § 3.1, § 4.9).**
- **T8. Session requests send "friend" for every learner,** so no child's name goes in a session request. The canon is unaffected (its key has no name, `api/_canon.ts:75-79`). **Approved (Thomas, 2026-10-19).** Not covered: the planner's system prompt still says "an 8-year-old child named Marian" and "Marian's context" (`api/_planner.ts:1612-1614`, K9). Changing it is a server change outside this spec. Whether to change it is Thomas's call, separately.
- **EXTRA 2 (Dave). Session End hands over to the picker** with 2+ learners (§ 2.4). **Approved (Thomas, 2026-10-19). Reversed (Thomas, 2026-10-25): All done returns to the learner's own Hub; hand-over is the Hub badge.**
- **T9. Three parent lines new since T6** (open): the Where-to-start alert, "Start \<name\> at \<land name\>?" / "Steps before this land count as learned. This land and the ones after it start again. Stars and streak stay." / [Cancel] [Change] (§ 3.1); "Name the first learner" (§ 3.2); "That backup holds another learner's progress." (§ 3.3, § 3.4). **Approved as written (Thomas, 2026-10-19).** Only PR B needs them.
- **T10. The planner prompt becomes learner-neutral in PR A.** `api/_planner.ts:1612-1614` says "an 8-year-old child named Marian" and "Speaks Tagalog primarily". PR A rewrites it as a young child learning English, with no name and no home language, matching T8. It is a server change, so it ships with a release, and PR A checks that session output still matches the canon. **Approved (Thomas, 2026-10-19).**

## 14. Pedagogy and safety checks for Dave (D1…)

**Dave checked all seven on 2026-10-19 (read-only, against main 910fa5f6): D2, D3, D4 and D6 confirmed; D1, D5 and D7 changed, plus 2 extra items.** All are applied above.

- **D1. Changed by Dave.**
  - The parent's land pick and no placement test stand. The selected-learner card gains **Where to start**, so a parent can move a learner down later, or up (§ 3.1, § 4.9).
  - Why (Dave): the fast track only moves a child up, and nothing moves one down (`mastery.ts:241`, "no demotion"; a pace hold only turns the fast track off, `types.ts:795-799`). A 6-year-old placed too high would stay on 5/8-or-worse days with no way out but a debug build. Parents tend to overestimate their children's skills (Dave cites a NEPS preschool study and the LSAC panel from search summaries; he did not read the full texts). No placement test is Dave's own reasoning: a test before any play adds reading and attention load.
  - The same row is the only way to place a fresh install's learner 1 (T7).
  - Applied in P6, P8, § 3.1, § 4.1, § 4.9, § 5.1, § 6.1, § 7, § 10, AC 17, 36. Was: the start set once, in the Add sheet only.
- **D2.** One tap picks, with no confirm step: a confirm would be a reading task on every launch. A stray session can bring a sibling's step one day closer but can't master it (3 good days, `parentSettings.ts:55-58`, or 2 secure days on the fast track; a step is never demoted, `mastery.ts:241`). **Confirmed (Dave, 2026-10-19).** That the limit is enough is Dave's own reasoning.
- **D3.** Picker tiles show a picture and a name only, in a fixed add order, so there is no cue to compare (§ 8). **Confirmed (Dave, 2026-10-19),** keeping § 8's rule that stardust, flowers and levels never appear side by side. Social comparison weighs more in self-evaluation as children move through school (Ruble et al. 1980, Developmental Psychology 16(2); Dave has it second-hand).
- **D4.** The return rule: after 10 minutes in the background, outside a session, Emma asks "Who is playing?" again. **Confirmed (Dave, 2026-10-19): 10 minutes, and being asked again is harmless** (tapping your own picture has no wrong answer, no penalty and no reading). Dave knows of no study on idle timeouts for children; this is his reasoning.
- **D5. Changed by Dave (small).**
  - The written name under the picture stands: a child's own name is the word they practise most, and children know the letters of their own name best (Treiman and Broderick 1998, J Exp Child Psychol 70:97-116).
  - "Add a learner" now makes the parent name an unnamed learner 1 in the same sheet (§ 3.2 step 0). I applied the same step to "Add from a code" (§ 3.3), for Dave's reason: otherwise one child's tile is blank next to a sibling's named tile.
  - Applied in § 1.2, § 3.2, § 3.3, § 13 T7, AC 35. Was: § 1.2 allowed a blank tile and T7 said learner 1 is "named when a second learner is added", with nothing in § 3.2 to enforce it.
- **D6.** Emma says the child's name only on the picker (phase 3), never in teaching lines or praise. **Confirmed (Dave, 2026-10-19),** keeping T4's parent preview and retake. Praise should name the process, not the person (Kamins and Dweck 1999, Developmental Psychology 35(3):835-847), and a mispronounced name repeated after every right answer would shame (Kohli and Solorzano 2012, a qualitative study).
- **D7. Changed by Dave (small).**
  - The 8 animals and each child picking their own are confirmed.
  - The cat's disc is grey instead of pink: pink is the one colour children read as gendered by about age 2.5–3 (LoBue and DeLoache 2011, BJDP 29(3):656-667), so a pink cat would become "the girl one".
  - Applied in § 8, § 9, § 13 T2 (approved with T2). Was: cat pink.
- **EXTRA 1 (Dave; blocked PR B's copy).** The Remove alert said "you can add them back with their backup code", but stars and the streak with session history never come back, because they are not in the cloud (§ 7). It now says so plainly (§ 3.5). Approved with T6 (Thomas, 2026-10-19). Applied in § 3.5, § 3.6, § 7, § 8, AC 37. Was: "Their progress on this device is deleted. Their cloud backup stays, so you can add them back with their backup code."
- **EXTRA 2 (Dave; did not block).** The common handover is A finishing and passing the device straight to B. The app never goes to the background, so the return rule misses it and B's session counts for A. With 2+ learners, Session End now exits to the picker (§ 2.4). Approved (Thomas, 2026-10-19). Applied in P9, § 1.1, § 2.4, § 6.2, § 7, AC 33, 40. This is Dave's reasoning; the cost is one tap for a child who wants their own Hub after a session.
- Dave found no other harm: no leaderboard, no shared pool, no sibling mentions, no streak pressure, no dark pattern, the adult gate unchanged. Names stay out of session requests, and the planner sanitiser's Unicode letter set (`api/_planner.ts:1157`) keeps accented names writable.

## 15. Kevin confirms (K1…)

**Kevin checked K1–K12 on 2026-10-19 (read-only, against main 910fa5f6, nothing run): K1, K4, K5, K8, K10 and K12 confirmed; K2, K3, K6, K7, K9 and K11 changed; plus 3 blocking issues, X1–X3.** All are applied above. Phase 3's server items, K13–K19, are in § 16.8.

- **X1. Blocking: the migration could overwrite Marian's doc.** `loadProgress()` returns `null` for invalid JSON, an unknown version or a guard failure, not only for no key (`storage.ts:36-43`), so a present but unreadable doc was treated as a fresh install and overwritten with a floor doc. Now "fresh install" is decided from the raw key, and nothing writes a progress key that holds anything (§ 4.3 step 3, step 5). Applied in P3, § 4.3, AC 2. Was: step 2 `loadProgress()` and step 4 writing when it returned `null`.
- **X2. Blocking: Parent Settings would write one learner's doc over another's.** The screen reads the doc once and saves from that copy (`ParentSettings.tsx:89-103`; `parentSettingsDeps.ts:78`), and Push now reads the sync ID at call time (`parentSettingsDeps.ts:83-87`). Now the sections are keyed by the selected learner and their deps come from `boundLearner(entry)` (§ 3.1, § 4.4). Applied in § 3.1, § 4.1, § 4.4, § 10, AC 34. Was: "Every section below re-reads", with no mechanism.
- **X3. Blocking: an older build or the web could mix two learners' records** (§ 4.7 rule 4 did not hold). Builds 8–15 and the web can Restore with any code, and their reconcile pushes a newer local doc to that code's record (`cloudSync.ts:493-500`, `cloudBackup.ts:161-166`; the web writes the ID first, `cloudBackup.ts:131`). Now the carrier carries `syncId`, stamped at push time, and reconcile, Restore and Add from a code refuse a doc whose `syncId` differs from its key (§ 4.5). I added one rule to Kevin's fix: a non-legacy learner's reconcile and Restore also refuse a doc with no carrier. Kevin's rule alone catches the older device only when its local doc carries a stamp, which needs it to have installed a profiles-stamped record at least once; the web usually has none. Applied in § 3.3, § 3.4, § 4.5, § 4.6, § 4.7, § 7, AC 8, 14, 20. Was: `learner?: { avatarId; language }`, with no check.
- **K1.** The 7 keys in § 4.2 are every piece of per-child state on native. **Confirmed (Kevin, 2026-10-19).** The only other storage is session audio under `Paths.cache/session-audio/<sessionId>` (`sessionAudio.ts:61-63`), which belongs to one session; the map tap log only prints to Metro (`useMapVisit.ts:135`); there is no SecureStore, AsyncStorage or iOS `Settings.set`.
- **K2. Changed by Kevin.** Every store reader picks up the installed store on each call (`stardust.ts:61-62`, `sessionHistory.ts:107-108`, `notYetNudge.ts:18-19`, `hubGuidance.ts:199-200`, `storage.ts:549-575`, `deviceId.ts:149-170`). Two module states carry over: the reconcile latch (already covered) and the Hub's `lastUnmountAt` (`hubAudio.ts:63`), which would open B's Hub silent within 30 s of A's. App's switch now clears it (§ 2.3 step 3). I add a third from K7's change: `reviewBaseline()`'s cache (`reviewPlan.ts:79`) becomes per learner (§ 4.4, § 4.8). Applied in § 2.3, § 4.4, § 10, AC 19, 32.
- **K3. Changed by Kevin.** The three seams are right, and the 4 pushes read their ID and doc before the first `await`. Three changes: the sync listener takes the ID (`(syncId: string) => void`, `cloudSync.ts:154`), and native writes Last synced for the learner holding that ID; Restore's binding is required, because an abort does not stop the ID write (`cloudSync.ts:448-453`, `:494-500`; `cloudBackup.ts:161-166`); bound writers save with their own learner's carrier. Applied in § 3.4, § 4.4, § 4.5, AC 9, 10, 11. Was: "the sync-success listener (`native.ts:85`), which needs the sync ID passed in", with Restore's binding listed as one seam among three.
- **K4.** `installCloudBlob` keeps unknown top-level fields at every step (the defaulters and every later step spread, `storage.ts:293`, `cloudSync.ts:526-656`; the guard checks named fields only, `guards.ts:400-530`; build 8 the same). **Confirmed (Kevin, 2026-10-19),** pinned by AC 20, with `installCloudBlob` exported for Add from a code (§ 3.3).
- **K5.** Nothing in PR A writes a value an older guard rejects. **Confirmed (Kevin, 2026-10-19):** build 8's guard requires `schemaVersion === 1`, a string `childName` (an empty one passes) and `character === 'melody'`; the floor doc covers every step, and a build that knows fewer steps only requires its own (`guards.ts:122-131`). § 4.7 rules 1–3 stand.
- **K6. Changed by Kevin.** The Greet rule was right, but with 1 learner Splash still used `sessionCount` alone (`nextAfterSplash.ts:20-27`), so a sole learner added from a code would get "nice to meet you". Splash with 1 learner now returns `nextAfterPick(activeLearner())` (§ 6.1). Then, folding D1, I dropped the rule's `lastPlayedISO === null` term: § 4.9's move stamps it on a learner who may not have played yet. Applied in § 1.1, § 6.1, AC 23.
- **K7. Changed by Kevin.** The production fallbacks to `defaultProgress()` are 12, not the 2 the spec named: `progressHistory.ts:344`, `:499`; `mapModel.ts:63`; `hubCardModel.ts:117`; `seeds.ts:707`, `:730`; `stepProgress.ts:121`, `:174`; `reviewPlan.ts:88`; `ParentSettings.tsx:91`; `sessionEndWrite.ts:117`, `:194` (Kevin's report says 11 and lists these 12; grep, 2026-10-19, finds 12). Three consequences: a missing doc would be saved as Marian's diagnostic; the review baseline was the diagnostic's for every learner; Maestro `01-first-launch.yaml` and `02-hub-math-session-end.yaml:8-10` ("Math stays on the diagnostic baseline") assume the diagnostic on a fresh install, which T7 changes. Now `startProgressForActive()` serves all 12, the baseline is per learner, and PR A re-baselines both flows (§ 4.8, § 10). Applied in § 4.8, § 10, § 12, AC 18, 19, 26. Was: 2 named readers, and "The e2e and Maestro seeds that rely on `defaultProgress()` still seed explicitly", which is not true for those two flows.
- **K8.** Sync-ID uniqueness per device is enforced in core. **Confirmed (Kevin, 2026-10-19), with how:** the check runs against the other learners' sync-ID keys (raw store) before any network call; Add from a code uses `fetchProgressFromCloud` + `installCloudBlob(blob)` with no local merge, never `reconcileWithCloud` (§ 3.3, § 4.6). Applied in AC 12, 13.
- **K9. Changed by Kevin (the test list only).** `'friend'` is safe: the canon key has no name (`api/_canon.ts:74-78`, `api/claude.ts:924`), and the session cache key includes the name (`api/_sessionCache.ts:83-90`), so native learners share entries within the TTL, as every native request shares `'Marian'` today. The tests that pin `'Marian'` and flip in PR A are 12 assertions: `mathSession.test.ts:113`, `:121`, `:132`; `wordSongSession.test.ts:120`, `:129`, `:140`; `peekSession.test.ts:75`, `:219`; `reviewSession.test.ts:204`; `App.test.tsx:275`, `:338`; `audio/session.test.ts:455` (grep, 2026-10-19). The two the spec named (`scripts/maestroSweepApi.test.ts:29`, `mobile/src/audio/debug/audioCheck.ts:179`) are a server-sweep test and a debug probe, and stay. The planner prompt note is in § 13 T8. Applied in § 10, § 13, AC 24.
- **K10.** The phase 3 name-clip endpoint: input limited to § 3.2's set and 24 characters, a rate limit per sync ID, Lily characters counted, a retry when offline. **Confirmed (Kevin, 2026-10-19),** with the clip stored under `Paths.document`, not `Paths.cache` (§ 9).
- **K11. Changed by Kevin.** A single `setItem` is one SQLite write, so a half-written list is unlikely, but the recovery was weaker than it needs to be: the native backend can list keys (`getAllKeysSync()`, § Today). Core's seam gains `keys?()`, and a rebuild scans the suffixed progress keys and recreates those learners. A list with `schemaVersion` above 1 is built in memory and never written back (the #597 lesson, applied to the list). Still no second copy. Applied in § 4.1, § 4.3, § 4.7 rule 6, AC 21, 22. Was: learners 2–4 back only by Add from a code.
- **K12.** `ensureLearnerList` runs before the QA step and the debug seed in `bootNative` (`native.ts:82`, `:100-109`). **Confirmed (Kevin, 2026-10-19),** plus: it never throws, and the listener at `native.ts:85` becomes the ID-carrying one (§ 4.3, § 4.4). Applied in AC 5.

## 16. Phase 3: name audio (PR C)

**Status:** spec for PR C, written before it starts (§ 12 item 3). T4 approved (Thomas, 2026-10-19): "yes, phase 3, Lily, on the picker tap only, with the parent preview and retake". Thomas said on 2026-10-20 to start after build 16. The server design is Kevin's (K13–K19, § 16.8). Thomas approved T11–T13 by popup on 2026-10-20 (§ 16.9). Nothing is open for Thomas before PR C.

**Fixed by earlier sections:** a tap says "\<Name\>!" and the caption is the name (§ 1.3); the route changes 200 ms after the clip ends, at most 1.5 s after the tap (§ 1.4); no network means no clip until Parent Settings is next open and online (§ 7); the clip lives under `Paths.document`, not `Paths.cache` (§ 9, K10); the name is said only on the picker, never in praise or teaching (D6); session requests keep `'friend'` (P7). No clip is the shipped, silent pick, not an error (§ 6.3).

### 16.1 When a clip is made

A clip is made **only while Parent Settings is open, and only on a device with 2+ learners.** With 1 learner the picker never shows (P1), so a clip would never play. No child screen ever asks for a clip: the picker, Hub, Greet and every other route make no name-audio request. That keeps the new billing surface behind the 3 s adult gate.

The **spoken text** of a learner is their "sounds like" spelling if set (§ 16.2), else their name. A learner **needs a clip** when they are named and have no stored clip whose spoken text equals today's spoken text, or whose voice key differs from the server's (§ 16.4).

| Trigger                                                                                                        | Which learners                       | Plays when ready                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| A name saved: Add a learner's [Add], step 0's naming (§ 3.2), Name on keyboard Done, Add from a code's success | the learner(s) named                 | yes, once, if that learner's card is open |
| "Sounds like" saved (keyboard Done) or cleared                                                                 | that learner                         | yes, once, as above                       |
| [Retake]                                                                                                       | that learner                         | yes, once, as above                       |
| [Try again] after a failure                                                                                    | that learner                         | yes, once, as above                       |
| Parent Settings opens, or the second learner is added                                                          | every learner who needs a clip       | no                                        |
| Back online while Parent Settings is open                                                                      | every learner who still needs a clip | no                                        |

- **The save never waits.** The name, the list and the sheet close as in phase 2; the render runs after.
- **One render at a time,** in learner order, so a visit never fans out requests. A newer trigger for the same learner replaces a queued one.
- **Done aborts** every render in flight or queued, as it aborts Push now and Restore (`CloudBackupSection.tsx:14-16`). An aborted render writes nothing. The next visit picks it up.
- **The upgrade:** Marian's clip is made on the first Parent Settings visit after the second learner is added, with no sound in that visit unless the parent taps Play.

### 16.2 Parent flow: the Name sound row

The selected-learner card (§ 3.1) gains one row under Name, shown only with 2+ learners and a named learner:

```
| MARIAN                                     |
| Name         [Marian____________]          |
| Name sound   [▶ Play]  [Retake]            |
| Sounds like  [__________________]          |
|              Only if Emma says the name    |
|              wrong. Spell it as it sounds, |
|              like Mah-ree-ahn. The picture |
|              keeps the real name.          |
| Picture      (fox)(lion)(frog)(turtle)     |
```

- **[▶ Play]** plays the stored clip once, at the app's volume. A second tap while it plays restarts it. This is the one place Parent Settings plays a sound (T4); nothing in Parent Settings plays on its own except a render the parent just asked for (§ 16.1).
- **[Retake]** asks for a new take of the same spoken text. The new clip replaces the old one **only on success**; on failure the old one stays and plays. A retake of the same text may come back sounding the same: the code notes that a seed "did not vary eleven_v4 takes of one input; input variants do" (`api/_tts_elevenlabs.ts:205-208`). A retake sends the next take number, and the server says the same text with another punctuation template (K18). **"Sounds like" is the real fix for a wrong name**, so the helper text sits right under it.
- **Sounds like:** optional, one line, saves on keyboard Done.
  - The same character set as Name: letters, digits, spaces, `'`, `.`, `-`, 1–24 characters after trimming: the planner sanitiser's set, `/[^\p{L}\p{N}\s'.-]/u` (`api/_planner.ts:1182`). Hyphens and spaces split syllables ("Mah-ree-ahn"). Slashes, brackets and markup can't be typed, so neither can the canon's IPA form `/…/` (K15). Single IPA letters such as `ə` are Unicode letters and pass; they are harmless to cost, and parents don't write them.
  - It changes only what Emma says. The tile, the caption and every parent string keep the written name.
  - Cleared (empty + Done): the spoken text goes back to the name, and a new clip is made.
  - **Renaming a learner clears it,** because it spelled the old name. The field shows empty after the rename.
  - It stays on this device (§ 16.4).
- **Status line** under the row, replacing the buttons while there is no playable clip (strings in § 16.6):

| State                                                              | The row shows                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Making the clip                                                    | "Making the sound…" and a spinner; buttons hidden                                  |
| A current clip                                                     | [▶ Play] [Retake]                                                                  |
| Offline, no current clip                                           | the offline line; no polling (it renders when back online, § 16.1)                 |
| The request failed (server error, timeout)                         | the failure line and [Try again]                                                   |
| This name's limit reached (T11)                                    | the limit line; [Retake] hidden until the limit resets; a current clip still plays |
| The server's overall limit reached (T12)                           | the paused line; no buttons but [▶ Play] if a clip exists                          |
| A stale clip (renamed, or sounds-like changed) + any failure state | the failure state's line; the stale clip is never played, here or on the picker    |

The failed and paused lines tell the parent that picking that learner stays silent until a clip exists. Nothing about a failure reaches the child.

### 16.3 Child flow: the tap

With a current clip for the tapped learner (spoken text matches, § 16.1):

1. **Tap:** "Who is playing?" stops if it is still playing. The disc pulses as today (§ 1.4). **The clip plays instead of the chime:** the 0.57 s chime (`pickerAudio.ts:7-10`) over Emma saying the name would blur the one word the tap is for.
2. **Caption:** Emma's bubble shows "\<Name\>!", the written name, never the sounds-like spelling, as one word walk (§ 1.3).
3. **Route:** 200 ms after the clip ends. At 1.5 s after the tap, if the clip is still playing, it fades out over 80 ms and the route changes (§ 1.4). The app makes this cut, not the server: in PR C the server neither trims nor rejects a long clip and only reports its length (`durationMs`, K18). A long "sounds like" spelling may reach it.
4. Further taps are ignored until the route changes (§ 1.4). The other tiles do not dim.

With **no current clip** (none made, a stale one, an unreadable file, or the player fails to load it): the phase 2 pick exactly, the chime and the route 400 ms after the tap (`PICK_ROUTE_DELAY_MS`, `pickerTiming.ts:17`). No error, no log the child can see.

- **Reduce Motion** changes the pulse only (§ 1.4), never the clip.
- **Clip loading:** the picker reads every learner's clip from disk when it mounts, so a tap never waits on a read. A tap before a load finished counts as no clip.
- **Nowhere else (D6):** the Hub badge, Greet, Session End, praise, teaching and every Emma line stay as they are. Only the picker imports the name-clip player (AC 60).

### 16.4 Storage and re-render rules

**On disk:** `Paths.document/name-audio/<learnerId>.mp3` and a sidecar `Paths.document/name-audio/<learnerId>.json`:

```ts
interface NameAudioRecord {
  soundsLike: string | null // the parent's spelling; null = say the name
  clip: {
    spoken: string // the spoken text this clip says (soundsLike ?? name)
    take: number // 0–3, the server template this clip used; [Retake] sends (take + 1) mod 4 (K18)
    voice: string // the server's voice key at render time (K18)
    language: string // the learner's language at render time ('en', § 5.2)
    renderedAtISO: string
  } | null
}
```

The sidecar keeps the learner list (§ 4.1) unchanged, so nothing in PR A's list guard or migration moves. Whether the record instead becomes an optional field on `LearnerEntry` is K19. `Paths.document` survives OS purges and app updates; it goes with an app delete.

**A clip plays** when the file loads and `clip.spoken` equals the learner's spoken text. A voice or language mismatch still plays the old clip (the right name, the old voice) and queues a new one (§ 16.1).

| Event                                          | What happens to the clip                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rename                                         | "Sounds like" cleared; the old clip is stale and never plays again; a new clip is made (§ 16.1). The old file is replaced only when the new one arrives, and deleted if the learner ends up unnamed.                                                                             |
| Remove (§ 3.5)                                 | the mp3 and the sidecar are deleted with the 7 keys. The Remove alert does not change: a clip is remade from the name at no effort to the parent.                                                                                                                                |
| Restore from a code (§ 3.4)                    | no change: the list name stays (§ 4.5), so the spoken text stays.                                                                                                                                                                                                                |
| Add from a code (§ 3.3)                        | a name save for the new learner: a clip is made.                                                                                                                                                                                                                                 |
| Second device                                  | clips and "sounds like" are per device, like names and pictures after an add (§ 4.6). Neither goes in the progress doc or the cloud. Each device makes its own clip on its own Parent Settings visit, so a parent who set "sounds like" on the iPad sets it again on the iPhone. |
| Down to 1 learner                              | clips are kept, unplayed, and no new ones are made (§ 16.1). If a learner is added again they are ready.                                                                                                                                                                         |
| List rebuild (K11)                             | learners 2–4 keep their ids, so their clips reattach. Learner 1 gets a new id, so their clip is an orphan and is remade.                                                                                                                                                         |
| Orphans                                        | on each Parent Settings open, files whose `<learnerId>` is not in the list are deleted.                                                                                                                                                                                          |
| App deleted and reinstalled                    | clips are gone with `Paths.document`; they are remade on the first visit with 2+ learners.                                                                                                                                                                                       |
| A newer voice (the server's voice key changes) | the old clip plays until the new one arrives on the next visit online.                                                                                                                                                                                                           |

**Privacy (amends § 8).** To make a clip, the spoken text is sent to our server and on to ElevenLabs, once per render. This is new: until phase 3, names stayed on the device and in the learner's own cloud record. It is what T4 approved (Lily can only say a name she is sent). The request carries no learner id, picture or progress; the server keeps no record that ties a name to a device beyond what the cost guard needs (K15, K17). Session requests keep `'friend'` (P7). The parent is told in the row's footnote (§ 16.6).

### 16.5 Edge cases

- **Offline at save:** the offline line; the pick stays silent; the clip is made on the next visit online (§ 7).
- **Online but the server refuses** (limit, 4xx, 5xx, timeout): the matching line (§ 16.2). The app never retries on its own within a visit except on coming back online; [Try again] is the parent's.
- **Two quick saves** (rename, then rename again): the newer spoken text replaces the queued render; a response for an older spoken text is discarded.
- **The learner card changes mid-render** (another learner's row tapped): the render finishes and stores for its own learner, without auto-play.
- **A name the voice can't say well** (an uncommon name, a name from another language): preview, retake, then "sounds like". If none works, the parent can leave it: the stale or missing clip means a silent pick, the phase 2 behaviour.
- **An unnamed learner:** no row, no clip, a silent pick.
- **Mute** (`EXPO_PUBLIC_MUTE`, debug) and the device's silent switch: the clip follows the same rules as every other Emma line.
- **A Danish learner later (§ 5.2):** the request carries the learner's `language`, only `'en'` exists, and the sidecar records it, so a language change re-renders. Nothing here assumes English beyond today's voice.

### 16.6 Copy

Native strings, in `mobile/src/screens/parentSettings/learnerCopy.ts` with the phase 2 learner strings. Strings with a name are functions of the name (the `startAlertTitle` pattern), never built by joining fragments, so a Danish version can reorder words. `{name}` is `displayName(name)` (`learnerCopy.ts:21`).

**Row and field:**

| Key                 | English                                                                                                                                                           | Where                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `nameSound`         | Name sound                                                                                                                                                        | row label                |
| `play`              | Play                                                                                                                                                              | button                   |
| `retake`            | Retake                                                                                                                                                            | button                   |
| `tryAgain`          | Try again                                                                                                                                                         | button, after a failure  |
| `soundsLike`        | Sounds like                                                                                                                                                       | field label              |
| `soundsLikeHint`    | Type it the way it sounds                                                                                                                                         | field placeholder        |
| `soundsLikeHelp`    | Only if Emma says the name wrong. Spell it as it sounds, like Mah-ree-ahn. The picture keeps the real name.                                                       | under the field          |
| `soundsLikeInvalid` | Use letters, spaces, hyphens and apostrophes, up to 24.                                                                                                           | under the field, invalid |
| `nameSoundFootnote` | Emma says this name once, when {name} taps their picture, and nowhere else. To make the sound, the name or its sounds-like spelling is sent to our voice service. | under the row            |

**Status lines:**

| Key         | English                                                                              | State (§ 16.2)          |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------- |
| `making`    | Making the sound…                                                                    | rendering               |
| `offline`   | Needs the internet. The sound is made the next time you open Parent settings online. | offline                 |
| `failed`    | Couldn't make the sound. Picking {name} stays silent until it works.                 | request failed          |
| `nameLimit` | No more retakes for {name} today. Try again tomorrow.                                | this name's limit (T11) |
| `paused`    | Name sounds are paused for now. Picking {name} stays silent until they are back.     | overall limit (T12)     |

`{name}` in the footnote and status lines is the written name. There is no new child-facing string: the bubble shows the learner's own name (§ 16.3), and no new Emma line is baked.

### 16.7 Acceptance criteria

**Core and server (vitest, PR C):**

43. **Spoken text and staleness:** spoken text = `soundsLike ?? name`. A record whose `clip.spoken` equals it is current; after a rename it is stale; an unnamed learner needs no clip. A voice-key or language mismatch with a matching `spoken` is playable and needs a clip.
44. **Sounds-like validation:** trimmed, 1–24 characters, § 3.2's set; rejects `/`, `<`, `[` and `:`; an empty string after trimming clears the field instead of saving; an accented name ("Zoë") passes.
45. **Server input:** text outside the set, over 24 characters, or empty → 400, and the ElevenLabs stub sees no call. A `language` other than `'en'` → 400.
46. **Server cost guard (K15):** past the per-sync-ID limit → 429, no ElevenLabs call. Past the overall limit → 429 even with a fresh v4 UUID on every request. The limit store unreachable → the endpoint refuses (fails closed), no ElevenLabs call. The kill switch set → refuses, no call.
47. **Server render:** the ElevenLabs request carries Lily's voice and model as the canon does (`api/_tts_elevenlabs.ts:27`, `:30`), the text "\<spoken\>!", and no tier, phoneme or IPA rendering of client text.
48. **Server privacy:** no log line contains the spoken text (log spy).
49. Session requests still send `childName: 'friend'` with clips present (P7; AC 24 unchanged).

**Native (jest, PR C):**

50. With 2+ learners, each § 16.1 save trigger sends one render for that learner; the name is in the list before the response arrives. With 1 learner: no request and no Name sound row.
51. Opening Parent Settings online makes one render per learner who needs a clip, one at a time, none for current clips, and plays nothing.
52. A parent-triggered render auto-plays once when it arrives, only if that learner's card is still open.
53. Play plays the stored file. Retake sends the next take and replaces the file and sidecar (with that take) on success only; a failed retake keeps the old clip playable.
54. Offline: the offline line, no request; coming back online with the screen open makes the queued renders. The picker, Hub, Greet, Map, Session End, Math and Word Song make zero name-audio requests (fetch spy across a full pick-to-session run).
55. Done aborts in-flight and queued renders; nothing is written after Done.
56. **Picker with a current clip:** no chime; "Who is playing?" stopped; the clip plays; the bubble shows "\<Name\>!" with the written name; the route changes 200 ms after the clip ends. A clip still playing at 1.5 s is faded and the route changes at 1.5 s. A second tap is ignored.
57. **Picker without a current clip** (none, stale, unreadable file, player load error): the chime and the route at 400 ms, as AC 27.
58. Rename clears "sounds like" and the stale clip never plays. Remove deletes the mp3 and the sidecar. An orphan file is deleted on the next Parent Settings open.
59. Clips and sidecars are written under `Paths.document/name-audio/`, never under `Paths.cache`.
60. **D6:** only `PickerScreen` (and Parent Settings' preview) import the name-clip player (source scan).
61. Every string in § 16.6 renders as written, with the selected learner's name.

**Device** (Thomas's iPad and iPhone, PR C on both, 2+ learners):

62. The first Parent Settings visit online makes both clips; Play sounds right; a picker tap says the name and lands on the learner's Hub.
63. Airplane mode: rename a learner → the offline line; the picker is silent for them; back online, reopen Parent Settings → the new clip.
64. "Sounds like": type a spelling, hear the change on Play and on the picker; the tile and bubble still show the real name.
65. Clips survive an app relaunch and an app update.
66. Thomas's ear on each learner's clip (Predict-Before-Soak applies: CLAUDE.md § Predict-Before-Soak).

**Build order inside PR C:** Kevin's server first (K13–K19, ACs 45–48), shipped in a release before Devon's UI reaches a device, because the native build calls the deployed server (`EXPO_PUBLIC_API_BASE`). Then Devon's UI (ACs 43–44, 49–61; whichever of 43–44 Kevin places in core he owns). Devon reviews Kevin's, Kevin reviews Devon's (`feedback_pr_review_routing`). T11–T13 are approved (Thomas, 2026-10-20).

### 16.8 Kevin designs (K13…)

The server is Kevin's. These are the constraints from the UX, and the facts I found; the design is his to propose before PR C's server work starts.

**Kevin answered K13–K19 on 2026-10-20** (read-only, against `0753cd5c`, nothing run, no ElevenLabs call). Each item's "Kevin:" line is the design PR C builds. One correction to K15's premise: **PR #487 is still open** (`gh pr view 487`: state OPEN), so `/api/claude` still renders a client-supplied `payload.plan` through `renderSessionAudio` with no limiter (`api/claude.ts:775-780`, `extractPlan` at `:203-208`). The name cap bounds the name path only; it does not bound the ElevenLabs bill while that path is live.

- **K13. Endpoint shape.** A small endpoint that takes one spoken text and returns one MP3 plus a voice key (§ 16.4). Whether it is its own file (recommended: it then leaves `/api/claude`'s canon, cache and planner limiter untouched) or a `kind` on `/api/claude`, the request body, and whether audio returns as bytes or base64 are Kevin's call. Inputs the client has: the spoken text, the learner's `language` (`'en'`), the learner's sync ID (§ 4.6). It must not need the learner id (never sent, § 4.1).
  - **Kevin:** its own file, `api/name-audio.ts`, with the `{ fetch: handler }` entry and handler-level test seams of `/api/progress` (`api/progress.ts:259-264`, `:423`); `/api/claude`'s canon, cache and limiter stay untouched. `POST` only (`OPTIONS` → 204), body `{ syncId, spoken, language, take }`: `syncId` a UUID by `isValidDeviceId` (`api/progress.ts:179-184`), `spoken` the spoken text without the "!", `language` `'en'`, `take` an integer 0–3 (K18). **Audio returns as base64 in JSON**, `{ ok: true, audioBase64, voiceKey, durationMs }`, because the native session-audio writer already takes base64 and writes the MP3 file (`mobile/src/audio/sessionAudio.ts:8-9`, `:41-45`), so the client reuses that path. `Cache-Control: no-store`, as `api/progress.ts:164-167`. No CORS allow-origin: only the native app calls it, and it sends no `Origin`. Errors, and the § 16.2 line each maps to: 400 `invalid-body` (failed); 401 `unauthorized` (failed); 429 `name-limit` with `Retry-After` to the next UTC midnight (nameLimit); 429 `rate-limited` (failed); 503 `paused`, the kill switch or the overall cap (paused); 503 `unavailable`, KV unreadable or the render slot busy (failed); 502 `tts-failed` (failed).
- **K14. Auth.** Treat the endpoint as public. Native ships its shared secret in the bundle (`EXPO_PUBLIC_PROGRESS_API_SECRET`, read in `mobile/src/platform/buildEnv.ts`), and `/api/progress` says its bearer secret is "visible in the bundle" and "non-trivial for casual abuse, NOT secure against pentest" (`api/progress.ts:16-21`). `/api/claude` has origin checks and a per-IP limiter and no bearer check (`api/claude.ts:153-177`, `api/_rateLimit.ts`). Whether the endpoint takes the bearer secret anyway is Kevin's call; the cost guard (K15) must hold when the secret is known.
  - **Kevin:** it takes the bearer secret, checked exactly as `/api/progress` does (`isAuthorized`, `api/progress.ts:209-225`; a missing server secret → 500 `config-missing`, `:294-299`). It costs nothing and turns away drive-by scanners of a public path, but it is not the guard: every K15 cap is designed as if the secret were public. A native build without `EXPO_PUBLIC_PROGRESS_API_SECRET` has cloud sync off (`mobile/src/platform/buildEnv.ts:13`) and, with this choice, no name audio either: the shipped silent pick, which is acceptable for debug builds.
- **K15. The cost guard.** This is a new on-demand ElevenLabs billing surface, and an unauthenticated TTS path is a known risk: PR #487 removed `payload.plan` because it rendered "a client-controlled utterance array straight through `renderSessionAudio` with no rate limiter, no canon lookup, and no utterance-count/text-length cap". Required, in this order of importance:
  1. **An overall cap** (per day and per month, T12) that bounds spend whatever the callers. The per-sync-ID cap alone does not: the server accepts any v4 UUID (`api/progress.ts:182-184`), so a caller can mint a new one per request.
  2. **A per-sync-ID cap per name** (T11) and a per-IP rate limit.
  3. **Input limits:** one text per request; § 3.2's set; 1–24 characters after trimming (25 with the "!"); no SSML, IPA, slashes or markup passed to the voice, and the name path never goes through `renderElevenLabsText`'s tier rules on client text.
  4. **Durable counting:** the in-memory limiter resets on a cold start and is per instance (`api/_rateLimit.ts:12-21`), so the caps live in KV (Upstash, as `/api/progress` uses, `api/_progressStore.ts`). If KV can't be read, the endpoint refuses (fails closed).
  5. **A kill switch** (an env var) that turns name renders off with no deploy of the app; the app shows the paused line (§ 16.6).
  6. Characters counted per render in a log line without the text (AC 48), so a spike is visible.
  - **Kevin: the guard, in the order the handler runs it.** Every step before 9 runs with no ElevenLabs call; any refusal stops there.
    1. **Kill switch, two levers.** `NAME_AUDIO_ENABLED` must equal `'1'`, so an unset variable means off (fail closed); a change needs a server redeploy (`yarn release`), not an app build. For an instant stop, a KV key `nameaudio:off` that Thomas sets in the Upstash console; it is read in step 5's round trip. Either one → 503 `paused`.
    2. **Bearer secret** (K14) → 401.
    3. **Input.** One JSON object; `spoken` NFC-normalised, trimmed, runs of spaces collapsed, then it must match `^[\p{L}\p{N} '.-]{1,24}$` (`u` flag), counted in code points so "Zoë" is 3. That is § 3.2's set (`api/_planner.ts:1182`) with `\s` narrowed to the space, so a newline or tab can't reach the voice. No `/`, so ElevenLabs' inline-IPA form `/…/` (`api/_tts_elevenlabs.ts:10-12`) can't be sent; no `<`, so no markup. `language` must be `'en'`, `take` an integer 0–3, `syncId` a UUID. Anything else, or extra fields → 400 (AC 45). The pattern and the 24 live in an import-free `packages/core/src/wire/nameAudio.ts`, which `api/` imports by relative path as it already does for `wire/missingNumbers` (`api/_planner.ts:87`), so the server and the sounds-like field can't drift.
    4. **Never through the tier rules.** `synthesizeElevenLabs` sends `renderElevenLabsText(req.text, req.tier)` (`api/_tts_elevenlabs.ts:233`), which applies the canon input map, the blend parser and the letter-sound IPA (`:157-169`). PR C splits the fetch out into `synthesizeElevenLabsInput(input, opts)`, which sends `input` as given, and `synthesizeElevenLabs` calls it with `renderElevenLabsText(...)`. One fetch path, so voice, model and format stay pinned (`:27`, `:30`, `:32`). The name path calls only the new function, with a server-built input (K18).
    5. **KV, one pipelined round trip** on the same Upstash client `/api/progress` uses (`Redis.fromEnv()`, `api/_progressStore.ts:69-73`), through a new narrowed interface beside `KvClient` (`:51-54`, which has only `get`/`set`) with `get`, `incr`, `incrby`, `expire`, `set` with `NX PX`, and `del`. It reads `nameaudio:off`, and atomically counts (`INCR`/`INCRBY` before the render, so two callers can't both pass the last slot):
       - **Per IP:** `nameaudio:ip:<h>:<UTC hour>`, `h` = the first 16 hex of SHA-256 of the IP from `extractSourceIp`'s rule (`api/claude.ts:601-616`), TTL 2 h. Over **20 an hour** → 429 `rate-limited`. The raw IP is never stored.
       - **Per sync ID:** `nameaudio:sid:<syncId>:<UTC date>`, TTL 26 h. Over **T11 (5)** → 429 `name-limit`. It counts every render for that learner, whatever the text: a key per name would reset when the parent changes the spelling, which is the T11 hole. No name in the key.
       - **Overall:** `INCRBY` the render's characters (the input sent, "!" included) on `nameaudio:chars:<UTC date>` (TTL 48 h) and `nameaudio:chars:<UTC yyyy-mm>` (TTL 40 days). Over **T12's day or month cap** → 503 `paused`. A fresh UUID per request does not help a caller: these two keys hold no ID. The caps are `NAME_AUDIO_DAY_CHARS` and `NAME_AUDIO_MONTH_CHARS`, with code defaults (T12); a set but non-numeric value → refuse.
       - Counted before the render and **never refunded**: a refused or failed render still used its slot. That is conservative, and simple to test.
    6. **Fail closed.** Any KV throw, a missing `KV_REST_API_URL`/`KV_REST_API_TOKEN`, or a reply that isn't a number → 503 `unavailable`, and no ElevenLabs call (AC 46). `/api/progress` maps the same throws to 502 (`api/progress.ts:338-346`); here the refusal comes before the spend.
    7. **The render slot** (K16).
    8. **Render** (K18) with a 10 s timeout (the TTS default is 15 s, `api/_tts_elevenlabs.ts:34`).
    9. **Log, without the text:** `console.info('[api/name-audio] rendered', { chars, take, durationMs, ms, dayChars, monthChars })`, and on a refusal `console.warn('[api/name-audio] refused', { reason })`. No `spoken`, no sync ID, no IP. **A failed render logs the HTTP status only, never `err.message`:** `synthesizeElevenLabs` puts up to 200 characters of ElevenLabs' error body into the message (`api/_tts_elevenlabs.ts:249-256`), and nothing proves that body never echoes the input. The AC 48 log spy covers the refused, failed and rendered lines.
- **K16. Concurrency.** ElevenLabs Starter allows 3 concurrent requests (project memory `project_elevenlabs_lily_bakeoff`, not re-checked against the dashboard). Name renders share them with live session renders. How the endpoint avoids starving a session (one name render at a time server-wide, say) is Kevin's call. The client sends one at a time per device (§ 16.1).
  - **Kevin:** the live session path already uses all three slots: `renderSessionAudio` runs 3 workers on ElevenLabs, from the 2026-10-04 measurement "6 parallel -> 3 x 429" (`api/_session.ts:161-165`). So any name render alongside a live session render costs one session worker a 429, which `fetchWithBackoff` retries (up to 5 times, 200 ms base, 3 s cap; `api/_tts.ts:1674-1678`, `:1803-1822`). Three rules keep that to one short wait: (1) **one name render at a time, server-wide:** `SET nameaudio:lock <random> NX PX 15000` before the render, `DEL` in `finally` only if the value is still ours; the expiry frees it after a crashed instance. A caller waits for the lock up to 3 s, polling every 250 ms, then gets 503 `unavailable`. (2) **The name path gives way:** `backoff: { maxAttempts: 1 }`, so on ElevenLabs' 429 it tries once more and then returns 502 `tts-failed` instead of holding a slot through five retries; the parent's [Try again] is the retry. (3) **Short and rare:** one input of at most 28 characters, behind the adult gate, so the slot is held for one short render. The worst case is one session worker waiting one backoff step. Hypothesis, not measured: a name render takes about 1 s; PR C's self-test records `ms` from the log line.
- **K17. Caching.** A server cache of (spoken text, voice) would save repeat spend (a second device, a reinstall) but makes [Retake] return the same take, and it stores children's names server-side. Kevin decides whether to cache; if he does, Retake bypasses it, and the cache holds no device or sync ID beside the name.
  - **Kevin: no server cache.** The saving is small: a repeat costs at most 28 characters, and the clip already lives on the device for good (`Paths.document`, § 16.4), so only a second device or a reinstall repeats a render, and the per-device caps bound that. The cost is a new kind of data: a KV table of children's names (or their spellings) with no other reason to exist. Progress blobs already hold `childName` as is (`api/progress.ts:23-27`), but under a sync ID, never as a lookup by name. A cache would also not change what a Retake hears: the same input already comes back as the same bytes ("identical text gets identical bytes", `scripts/lilyTakePicker.ts:45-47`), so takes come from input variants (K18), not from skipping a cache. What the server does keep is only the K15 counters: sync ID and hashed-IP counts and two character totals, each with a TTL of 2 hours to 40 days. None holds a name.
- **K18. Lily settings and the clip.** The same voice and model as the canon (`ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `api/_tts_elevenlabs.ts:27`, `:30`), the same output format, so the name sounds like Emma. The text is "\<spoken\>!" to match the caption. Leading and trailing silence trimmed; at most 1.3 s, so the route lands within 1.5 s (§ 1.4). (Kevin: neither in PR C; the app's 1.5 s fade bounds the route, see Length and silence.) How a Retake gets a different take, given that a seed did not vary eleven_v4 takes and input variants do (`api/_tts_elevenlabs.ts:205-208`). The voice key the client stores (§ 16.4): what it encodes, so a voice or model change marks clips for a re-render.
  - **Kevin:**
    - **Same voice, model and format:** through `synthesizeElevenLabsInput` (K15 step 4), so the request is the canon's: Lily `pFZP5JQG7iQjIQuC4Bku`, `eleven_v4`, `mp3_44100_64` (`api/_tts_elevenlabs.ts:27`, `:30`, `:32`), with the ID3 tag stripped as for canon (`stripId3v2`, `:171-186`, `:258`).
    - **Retake = an input variant, never a seed.** A seed did not vary eleven_v4 takes (`api/_tts_elevenlabs.ts:205-208`; "3 seeded takes, r 0.985-0.994", `scripts/lilyTakePicker.ts:8-11`), and the same input gives the same bytes (`:47`). So `take` picks one of four **server-owned** templates around the validated text; the client sends only the number, and [Retake] sends the next one (stored take + 1, mod 4). Take 0 is `"<spoken>!"`, which the caption matches. Takes 1–3 change punctuation only, never words: a proposal of `"<spoken>!!"`, `"<spoken>...!"` and `"<spoken>! "` is a hypothesis, not a measurement. PR C runs `scripts/lilyTakePicker.ts --input-variant` on five sample names and keeps the variants that differ by ear and still say only the name. The sidecar records `take` beside `spoken` (§ 16.4).
    - **One word alone can read as an abbreviation:** "Sat." came back as "Saturday" (`api/_tts_elevenlabs.ts:143-149`). The "!" makes a name less like one than a "." would. A name that still gets expanded ("Jan" as "January", a hypothesis) is a case for "sounds like".
    - **Length and silence.** The server returns `durationMs`, counted from the MPEG frame headers (no decode needed: at 44.1 kHz each frame is 1,152 samples, about 26.1 ms). It does not trim silence in PR C: `api/` has no MP3 decoder (the only MP3 package is `lamejs`, an encoder, a dev dependency, `package.json:44`, `:67`), and the take picker's trimming uses `ffmpeg` (`scripts/lilyTakePicker.ts:480`), which a Vercel function lacks. It does not reject a long clip either: a 24-character hyphenated spelling may need more than 1.3 s, and the picker's 1.5 s fade (§ 16.3 step 3) already bounds the route. PR C's self-test measures leading silence on the same five names with `ffmpeg silencedetect`. If it is over 150 ms, a frame-level cut is a follow-up.
    - **The voice key** is an opaque string the client only compares for equality: `elevenlabs:<voice id>:<model id>:<output format>:n<version>`, built from the three constants, so a voice, model or format change in code changes it. Today it reads `elevenlabs:pFZP5JQG7iQjIQuC4Bku:eleven_v4:mp3_44100_64:n1`. `n` is the name-template version, bumped when take 0's template changes, so a new template also marks clips for a re-render.
- **K19. The client record.** § 16.4's sidecar file per learner, or an optional `LearnerEntry` field? I chose the sidecar so the list (§ 4.1, § 4.7 rule 6) stays as PR A shipped it. Kevin confirms, and places the spoken-text and staleness rule (AC 43) in core or in native.
  - **Kevin: confirmed, the sidecar.** It leaves the list's guard and migration as PR A shipped them, and a corrupt sidecar costs one re-render, not a learner. **AC 43 and AC 44 go in core**, in `packages/core/src/learners/nameAudio.ts`: `spokenText(name, soundsLike)`, `clipState(record, name, voiceKey, language)` (current, playable but stale-voice, stale, none), a sidecar guard in the style of `learners/guards.ts`, and `validateSoundsLike`, which uses the pattern from `wire/nameAudio.ts` (K15 step 3), so the field and the server accept the same text. They are pure, so vitest covers them without a device. Native owns the file I/O, the render queue and the player. I write the core module and its tests with the server; Devon's UI imports it.

### 16.9 Thomas decides (T11…)

- **T11. Renders per name per day.** Saves, sounds-like changes, retakes and Try again all count. I recommend **5 per learner per day**: enough for a name, two retakes and two spellings. Past it, the limit line (§ 16.6) and Retake hidden until the next day.
  - **Kevin: agreed, 5.** The server can't tell a save from a retake, so it counts every render per sync ID per UTC day (K15 step 5), which is what T11 says. "The next day" is UTC midnight, 01:00 or 02:00 in Denmark; the 429 carries `Retry-After` to it.
  - **Approved (Thomas, 2026-10-20): 5 renders per learner (sync ID) per UTC day.**
- **T12. The overall cap.** A ceiling on every name render on the server, per day and per month, so a leaked path can't run up the ElevenLabs bill. Each render is at most 25 characters (T4: "about 6–25 characters each"). I recommend **100 renders a day and 1,000 a month, at most 25,000 characters a month**. I have not checked that against the Starter plan's monthly characters or the live canon path's share; Kevin reads both from the ElevenLabs dashboard before Thomas picks the number.
  - **Kevin, 2026-10-20: what I could and couldn't check.** Each render is at most 28 characters with K18's take variants (24 + `...!`), so the caps count characters, not renders.
    - **Could:** the only quota figure in the repo is "The Starter plan's 40,000 credits" (`design/voice-migration-elevenlabs.md:48`). That is the migration plan's figure, not a dashboard read, and the same paragraph calls its own sums "an estimate". The plan is Starter with 3 concurrent requests (`api/_session.ts:161-162`). The key lacks `models_read` (`api/_tts_elevenlabs.ts:28-29`).
    - **Couldn't:** this month's usage, the reset date, the live path's share, whether overage billing is on, and eleven_v4's credits per character. The repo logs live renders (`canon-miss`, `api/claude.ts:1087`) with no character count, so the live share isn't in the logs either. **I found no note that the key lacks `user_read`:** the repo and the project memory record only `models_read`. I made no ElevenLabs call (dispatch rule), so whether the key can read its own subscription is unknown, not "no".
    - **Recommendation: 1,000 characters a day and 5,000 a month,** not Kyle's 25,000. 25,000 is 62% of the 40,000 above, so a leaked path at the cap would starve canon retakes and live Emma renders for the rest of the month. A real family's worst day is 4 learners × 5 renders × 28 characters = 560; a typical render is 7 ("Marian!"). 1,000 a day covers about two families each at T11's limit on the same day; 5,000 a month is about 180 renders at the longest length, or about 700 typical ones. A leak at the cap costs 12.5% of 40,000. These are the code defaults, and env vars change them without an app build (K15 step 5).
    - **Thomas reads in the ElevenLabs dashboard** (Subscription and Usage pages): (1) the plan and its monthly credits; (2) credits used this cycle and in the last full cycle, and the reset date; (3) whether usage-based billing (overage) is on: if on, a leak costs money; if off, a leak empties the quota and every live Emma render goes silent; (4) for one recent eleven_v4 request, its characters and credits, to get the rate. **Set the month cap to the smaller of 5,000 and a quarter of (monthly credits − last cycle's use), divided by credits per character.** Optional, and Thomas's call since it is an ElevenLabs request: `GET https://api.elevenlabs.io/v1/user/subscription` with the `xi-api-key` header returns the used and allowed character counts if the key has `user_read`, and refuses if it doesn't (from ElevenLabs' API reference; not run here).
  - **Approved (Thomas, 2026-10-20): 1,000 characters a day and 5,000 a month overall,** Kevin's recommendation, as the code defaults. Raised by one env change (`NAME_AUDIO_DAY_CHARS`, `NAME_AUDIO_MONTH_CHARS`) after Thomas checks the ElevenLabs dashboard, without an app build.
- **T13. The new parent strings** in § 16.6, as written (T6 and T9 approved the earlier ones). **Approved (Thomas, 2026-10-20): the § 16.6 strings as written.**
