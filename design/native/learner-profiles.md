# Learner profiles (native)

**Status:** spec only. Thomas, 2026-10-19: "we need to think about this app as multi-user not only Marian"; asked whether that means separate learner profiles in the app: "Yes, design profiles" (`team/DECISIONS.md` 2026-10-19, PR #613). T1–T8 (§ 13), D1–D7 (§ 14) and K1–K12 (§ 15) are open.

**Scope:** `@marian/core` (a new `learners` module, storage keys, cloud keying, routing), the native app (a "Who is playing?" screen, a Hub badge, Parent Settings), one new Emma line, 8 avatar pictures. The server is unchanged until phase 3 (§ 12). The web is frozen and stays single-learner (§ 4.4).

**Out of scope:** code, renders, picture generation. Also out: Danish content, translation or UI (a language field is reserved, § 5.2); deleting a learner's cloud record (no server delete exists; § 7); a family-wide sync code (each learner links once per device, § 4.6); accounts, passwords, logins.

## Goal

Two or more children share one iPad or iPhone. Each one taps their own picture and plays their own Number Garden and Word Song, with their own progress, flowers and map, and never sees a sibling's. One child on a device sees no change at all.

## Today (verified in the code)

- **One progress doc per device**, under `marian-tutor:progress:v1` (`packages/core/src/progress/storage.ts:30`), loaded through a defaulter chain and the strict guard (`storage.ts:44-104`), saved whole (`storage.ts:521-535`). `schemaVersion` is `1` and is the only version (`types.ts:818`; `migrate.ts:20-23` has no steps). New fields have always been optional and additive, with no bump (`types.ts:648`, `:661`, `:710`).
- **The doc already names its child:** `profile.childName`, "Capped to 24 chars at write time" (`types.ts:466-467`). Fresh docs default to `'Marian'` (`defaults.ts:264`) and to Marian's April 2026 diagnostic levels (`defaults.ts:166-206`: `number-recog` mastered, `add-to-10` practicing, …).
- **Six more per-child keys sit outside the doc:** session history with `sessionCount`, streak and today's worlds (`sessionEnd/sessionHistory.ts:35`, shape `:77-100`), stardust (`shared/stardust.ts:39`), the not-yet nudge (`sessionEnd/notYetNudge.ts:14`), the flower wake (`hub/hubGuidance.ts:194`), the device ID (`progress/deviceId.ts:46`) and Last synced (`progress/lastSync.ts:19`). Besides the seam itself and `index.ts`, these six modules and `storage.ts` are the only callers of `getKeyValueStore()` in `packages/core/src` and `mobile/src` (grep, 2026-10-19).
- **Storage is one synchronous store** installed at boot: native expo-sqlite (`mobile/src/platform/native.ts:82`), web `localStorage`. It has `getItem`/`setItem`/`removeItem` and no key listing (`platform/keyValueStore.ts:20-24`).
- **Cloud backup is keyed by the device ID**, a v4 UUID (`deviceId.ts:60-66`): KV key `progress:<uuid>` (`api/_progressStore.ts:45-47`). The server accepts any v4 UUID (`api/progress.ts:182-184`) and never looks inside the blob. Its header says the UUID "implicitly enables multi-child later" (`deviceId.ts:12-18`). Local is authoritative, cloud is a backup (`cloudSync.ts:32-37`). Boot reconcile is last-write-wins on `profile.lastPlayedISO`, with history, good days, unlock markers, secure days and pace holds union-merged (`cloudSync.ts:422-503`). It runs once per launch (`mobile/src/lifecycle/launchReconcile.ts`, core `launchReconcile.ts:49-60`).
- **Four writers push to the cloud**, each with `getOrCreateDeviceId()` read at call time: session end (`sessionEnd/progressHistory.ts:477`), review end (`:514`), the unlock seen-marker (`map/unlockBeat.ts:79`) and Push now (`mobile/src/screens/parentSettings/parentSettingsDeps.ts:85`).
- **Restore** (native) reads the other device's record first, then adopts its ID (`parentSettings/cloudBackup.ts:157-168`). An install or ID write can land "even after the screen is gone" (`cloudBackup.ts:152-156`).
- **Two devices share one child** by sharing one device ID, and so one cloud record: "two devices on different builds share one cloud copy" (`guards.ts:383-385`). The rollout rule is never to downgrade either device (`team/DECISIONS.md` 2026-10-16 item 4). I did not read the IDs stored on the iPad and the iPhone.
- **Parent Settings** opens from a 3 s press on Emma on the Hub (`mobile/src/screens/hub/Hub.tsx:65-66`, `:219`). It is "slate on white in the system font, no Emma, no sound" (`ParentSettings.tsx:5-8`), and holds 7 setting rows (`parentSettings/parentSettingsModel.ts:126-134`), Backup and Cloud backup. Debug builds add "QA: jump to a step". That row writes `progressAtStep(node)` or "Back to Marian's real start" (`defaultProgress()`), then App remounts its screens on the Hub (`QaStepPicker.tsx:1-17`, `App.tsx:47-56`).
- **Greet** is the first launch: Splash goes to Greet when `sessionCount === 0`, else to the Hub (`router/nextAfterSplash.ts:20-27`). Greet plays "Hi!", "I'm Emma.", "It's so nice to meet you.", "Tap the heart when you're ready." (`greet/greetSequence.ts:78-83`). Neither Splash nor Greet writes `sessionCount`; Session End does (`App.tsx:8-10`). Math's session start is kicked on Greet (`App.tsx:15-16`).
- **Emma never says a name.** No baked canon line contains "Marian". 1 canon file mentions her, in a description field (`public/canon/word-song/level-1/letter-sounds-audit.json`). Native session requests hard-code `childName: 'Marian'` (`mobile/src/session/mathSession.ts:194`, `:238`; `wordSongHints.ts:127`, `:176`; `peekSession.ts:74`, `:84`). The planner sees it as "Child's name:" (`api/_planner.ts:1249`). The canon lookup key has no name in it (`api/_canon.ts:75-79`).
- **Parent copy says "Marian" and "she"** in 10 strings: `parentSettings/copy.ts:25`, `:34`, `:42`, `:50`, `:87`; `nativeCopy.ts:18`; `qaStepCopy.ts:15-18`; `parentSettingsModel.ts:271`. The web shares the core strings.

## Decisions

- **P1.** A device holds **1 to 4 learners** (T1). One learner means no picker and no badge: the app looks exactly as today.
- **P2.** A learner is a **picture + colour** (one of 8 fixed avatars, unique on the device) and a **written name** under it. No typing, no password, no reading needed to pick.
- **P3.** **Today's child becomes learner 1 with nothing moved.** Learner 1 keeps every key and the cloud record it has now. The migration writes one new key, the learner list (§ 4.3). Zero data loss by construction.
- **P4.** Every other learner has the same 7 keys with a `:<learnerId>` suffix and their own cloud record (a fresh UUID). **The server does not change.**
- **P5.** **No schema bump.** The progress doc stays `schemaVersion: 1`. The only new doc field is optional and top-level (§ 4.5), so a build from before profiles reads and syncs learner 1's record as today (§ 4.7).
- **P6.** Adding, renaming, re-picturing and removing a learner happen in Parent Settings, behind Emma's 3 s press. Picking and switching are the child's: one tap.
- **P7.** **Emma speaks no names in phase 1–2.** Session requests send `childName: 'friend'` (the planner's own fallback, `api/_planner.ts:1249`). Name audio comes in phase 3, on the picker only (T4). The no-name form is the shipped baseline.
- **P8.** A new learner starts where the parent says, one land per world (default land 1 in both). The start is built from the empty floor, never from Marian's diagnostic (§ 4.8).

## 1. Who is playing (the picker)

### 1.1 When it shows

| Moment                                                                                | 1 learner                      | 2–4 learners                 |
| ------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------- |
| Cold launch, after Splash                                                             | skipped: Greet or Hub as today | **picker**                   |
| Hub badge tap (§ 2.1)                                                                 | no badge                       | **picker**                   |
| Back from 10 min or more in the background, on Greet, Hub, Map or Session End (§ 2.2) | nothing                        | **picker**                   |
| Back from the background on Math, Word Song or a peek                                 | nothing                        | nothing: the session goes on |
| Done in Parent Settings after the learners or the active learner changed (§ 3.1)      | Greet or Hub                   | **picker**                   |

After a tap: Greet if that learner has never played (§ 6.1), else the Hub. New route `picker`. `ROUTE_EXITS` (`mobile/src/router/routes.ts:40-51`) becomes `splash → picker | greet | hub`, `picker → greet | hub`, `hub → … | picker`, `parent-settings → hub | picker`, and `greet | map | session-end → picker` for the return rule.

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
- **Name:** under the disc, 12 pt gap, Fredoka 600 at the Hub caption size (22 pt phone, 30 pt tablet), slate. One line. It shrinks to 16 pt, then ellipsises. An unnamed learner (§ 4.3) shows no text and keeps the line's height.
- **Nothing else on a tile:** no flowers, stars, level, streak, "last played" or count (§ 8).
- **Order:** the order the learners were added, never re-sorted.

### 1.3 Copy / TTS

| When                             | Emma (Lily, baked)                                              | Caption                       |
| -------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| 300 ms after the last tile lands | "Who is playing?"                                               | same, word walk as on the Hub |
| 20 s after the line ends, no tap | the same line, once (Greet's re-prompt rule, `Greet.tsx:13-14`) | same                          |
| Tap (phase 3, with a name clip)  | "\<Name\>!" (T4)                                                | the name                      |

"Who is playing?" is one new `GUIDANCE_LINES` entry (`packages/core/src/emmasPath/guidanceLines.ts`), id `picker.who`, at the next free number. Vocabulary: _who_ is in the story canon ("Who is in the tent?"), _play_ in "Play again to get today's flower." (`guidanceLines.ts:165`). The cap holds. A missing clip walks the caption silently (the shipped fallback, `Greet.tsx:20-21`).

### 1.4 Motion (Reanimated; Reduce Motion in brackets)

- **Tiles in:** after Emma lands, in reading order, 60 ms apart: scale 0.85 → 1 with opacity 0 → 1, spring stiffness 260, damping 20 [opacity only, 200 ms, all at once].
- **Press:** scale 0.94, spring stiffness 400, damping 25 [none].
- **Pick:** the chime; the chosen disc pulses 1 → 1.06 → 1 over 300 ms [no pulse]; the route changes **400 ms after the tap** (the Greet heart's delay, `Greet.tsx:15`). Phase 3: the route changes 200 ms after the name clip ends, at most 1.5 s after the tap. Further taps until then are ignored. The other tiles do not dim (the Hub's equal-doors rule, `hub-native.md` § 1).
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
3. Start that learner's launch reconcile, once per learner per launch (the latch in `launchReconcile.ts` becomes per learner id). Nothing waits for it, as today.
4. Mount the screens fresh (the QA jump's remount, `App.tsx:50-56`), at Greet or the Hub.

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
| [Remove Marian]                      |
|--------------------------------------|
| … today's sections, for Marian:      |
| pending-promotion banner, the 7 rows,|
| the footnote, Backup, Cloud backup   |
| (Backup code, Last synced, Push now, |
| Restore), QA row (debug)             |
+--------------------------------------+
```

- **Learners card** (new, first): one row per learner (40 pt disc, name, or "No name" in grey), the playing one marked "Playing now". **Tapping a row makes that learner the one playing.** Every section below re-reads and shows theirs. In-flight Push now and Restore requests are aborted, as Done aborts them (`CloudBackupSection.tsx:14-16`). One rule for the parent: what you see below is the child who plays next.
- **"+ Add a learner"** and **"Add from a code"**: hidden at 4 learners.
- **Selected learner card** (new): Name (text field, saves on keyboard Done, 1–24 characters), Picture (the 8 avatars; ones another learner uses are at 30% and can't be tapped), Remove (hidden with 1 learner).
- **Today's sections are unchanged** and act on the selected learner, because each learner's settings live in their own doc (§ 5.1).
- **Done:** the picker if the learners or the playing learner changed during this visit, else the Hub as today. With 1 learner left: Greet or the Hub.

### 3.2 Add a learner (a sheet over Parent Settings, like the QA picker)

1. **Name**, required, 1–24 characters after trimming. Letters, digits, spaces, `'`, `.`, `-` (the planner sanitiser's set, `api/_planner.ts:1157`).
2. **Picture:** the first free avatar is preselected; taken ones are dimmed.
3. **Where to start:** Number Garden: land 1–5; Word Song: land 1–8, by land name (`progress/lands.ts:22-…`: "Counting" … "Hundreds"; "Letters" … "Words and stories"). Default land 1 and land 1.
4. **[Add]:** writes the start doc and the list entry (§ 4.3), and makes the new learner the one playing. On Done they get the picker, then Greet.

### 3.3 Add from a code (a sheet)

A paste field and [Add]. Outcomes:

| Cloud read                                     | Result                                                                                                                                                                                                  | Line                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Record found and readable                      | a new learner: name from `profile.childName` (trimmed, 24 chars), picture from the doc's `learner.avatarId` if free, else the first free; the doc installed under their keys; their sync ID is the code | "Added \<name\>."                                         |
| The code is a learner here already             | nothing written                                                                                                                                                                                         | "That's \<name\>, already on this device."                |
| No record                                      | nothing written                                                                                                                                                                                         | "No progress found for that code."                        |
| Record fails the guard (`cloud-blob-rejected`) | nothing written                                                                                                                                                                                         | "That backup can't be opened on this version of the app." |
| Network or server error                        | nothing written                                                                                                                                                                                         | today's `restoreFailedMessage`                            |

### 3.4 Cloud backup, per learner

Today's section, renamed for parents: **"Backup code"** replaces "Device ID" (`copy.ts:88`, `:95`), and the body names the selected learner (`copy.ts:87`). Copy, Last synced, Push now and Restore work as today, on the selected learner's sync ID. **One new refusal:** a Restore code that another learner on this device holds → "That code is \<name\>'s." Nothing is written. Two learners must never push to one record (K8).

### 3.5 Remove

System alert: **"Remove \<name\>?"** / "Their progress on this device is deleted. Their cloud backup stays, so you can add them back with their backup code." / [Cancel] [Remove] (destructive). It removes the list entry and that learner's 7 keys (§ 4.2). The cloud record is kept. If they were playing, the first remaining learner plays next.

### 3.6 Copy

Native takes its own strings (the `nativeCopy.ts` departure pattern), so the frozen web keeps its strings. Every "Marian" in § Today's parent strings becomes the selected learner's name, "this child" when unnamed, and "she/her" becomes "they/their". Examples: "Show level to Sam"; "Advance Sam to the next skill once they meet the mastery threshold."; "Back to Sam's start" (QA, debug). New strings: "Learners", "Playing now", "No name", "+ Add a learner", "Add from a code", "Where to start", "Backup code", plus § 3.3–3.5's lines (T6).

## 4. Data model (Kevin)

### 4.1 Types (`@marian/core/learners`, new)

```ts
export const LEARNERS_STORAGE_KEY = 'marian-tutor:learners:v1'
export const MAX_LEARNERS = 4 // the add buttons' cap; the guard has no upper bound
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
  id: string // v4 UUID made at add time; local only, never sent
  name: string // trimmed, 0..24 chars ('' only for an auto-created learner)
  avatarId: AvatarId // unique on the device
  language: LearnerLanguage
  legacySlot: boolean // true for at most one learner: their data is under today's keys
  start: LearnerStart // rebuilds their doc if it is ever missing (§ 4.8)
  createdAtISO: string
}

export interface LearnerList {
  schemaVersion: 1
  learners: LearnerEntry[] // 1+ entries, in add order (the picker's order)
  activeLearnerId: string // one of learners[].id
}
```

API, exact names (one shared vocabulary for PR A and PR B): `ensureLearnerList()`, `loadLearnerList()`, `saveLearnerList(list)`, `isLearnerList(v)`, `activeLearner()`, `activateLearner(id)`, `addLearner({ name, avatarId, start })`, `addLearnerFromBackup(code)`, `renameLearner(id, name)`, `setLearnerAvatar(id, avatarId)`, `removeLearner(id)`, `learnerKey(baseKey, entry)`, `learnerScopedStore(raw, entry)`, `learnerStartProgress(entry)`, `nextAfterPick(entry)`.

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

Runs in `installNativePlatform` right after `setKeyValueStore` (`mobile/src/platform/native.ts:82`), before the QA step and the debug seed, so both write to the playing learner.

1. Read `LEARNERS_STORAGE_KEY` from the raw store. If it passes `isLearnerList` → step 5.
2. Else `legacy = loadProgress()` on today's keys.
3. One entry: new UUID; `name = legacy?.profile.childName.trim().slice(0, 24) ?? ''`; `avatarId 'fox'` (T3); `language 'en'`; `legacySlot true`; `start = legacy ? 'legacy-default' : { math: 1, wordSong: 1 }`; now.
4. Write the list with **one** `setItem`. Then, only when there was no legacy doc (a fresh install), write `learnerStartProgress(entry)` to `marian-tutor:progress:v1`. In this order a crash between the two writes leaves a list whose learner has no doc, and the readers' fallback builds the same start doc (§ 4.8, K7).
5. Install `learnerScopedStore(raw, active)`.

Nothing is copied, moved or deleted. On Marian's devices the list is the only new key. A list that is present but fails the guard is rebuilt from step 2. The legacy learner's data is untouched; the other learners' keys are orphaned (the store can't list keys), and their cloud records bring them back through Add from a code (K11).

### 4.4 The scoped store

`learnerScopedStore(raw, entry)` is a `KeyValueStore` that rewrites the 7 per-learner keys through `learnerKey` and passes every other key through. `activateLearner` installs it with `setKeyValueStore`. The 7 modules, the 4 push sites and launch reconcile need no changes: they already call `getKeyValueStore()` or `getOrCreateDeviceId()` per call. The `learners` module keeps the raw store for the list and for other learners' keys.

**The web installs no list**, so it never gets a scoped store and every key stays as today.

**Async writers bind to their learner (K3).** A reconcile, Restore or Last-synced write that started for learner A writes A's keys even if the child switched to B before it landed. The seams exist: reconcile's `installLocally` (`cloudSync.ts:395-397`), Restore's `AdoptDeviceIdDeps` (`cloudBackup.ts:107-111`), and the sync-success listener (`native.ts:85`), which needs the sync ID passed in. The 4 pushes already read their ID and doc synchronously at call time.

### 4.5 The doc carrier

One new optional top-level field on `Progress`, additive with no bump, as `parentSettings` was (`types.ts:648`):

```ts
/** Copied from the learner list on every save: carries the picture and language
 *  in the cloud record so Add from a code can rebuild the learner. */
learner?: { avatarId: string; language: string }
```

Guard: when present, an object with two string fields; unknown values pass (an old build or a newer avatar set must not reject the doc), the same rule as step names (`guards.ts:383-397`). The name travels in `profile.childName`, which is kept equal to the list's name on save.

### 4.6 Cloud, per learner

- Each learner's sync ID is a v4 UUID under their sync-ID key, made by `getOrCreateDeviceId()` through the scoped store. Learner 1's is today's device ID, so **their cloud record does not change**.
- Server: none. `/api/progress` takes any v4 UUID; its rate limit is per UUID (`api/progress.ts:31-36`), so each learner has its own bucket.
- **Two devices, both on the profiles build:** learner 1 keeps the link they have. Each other learner is linked once per device with Add from a code. Then both devices push and reconcile each learner's record. Conflicts follow today's per-record rules (`cloudSync.ts:467-490`). Names and pictures are per device after the add (a rename on one device does not move to the other).
- **No two learners on one device share a sync ID** (K8).

### 4.7 Forward compatibility (the #597 lesson)

PR #597 named the failure chain: a build whose guard rejects the cloud doc gets `cloud-blob-rejected`, and then its stale doc overwrites the cloud copy. Session-end pushes are unconditional (`progressHistory.ts:477`). Rules for profiles:

1. **No `schemaVersion` bump.** An older `migrate` refuses newer versions (`migrate.ts:48-49`).
2. **`profile.character` stays `'melody'`** (`guards.ts:405`).
3. **The carrier is top-level and optional.** An older guard ignores unknown top-level keys, and an older local load + save keeps them (`migrate-additive-fields.test.ts:180-230`). The cloud-install path is not pinned yet (K4).
4. **Nothing local crosses devices.** The list and the suffixed keys stay on their device. An older build on the other device only ever meets learner 1's cloud record, which keeps today's key and shape.
5. **Never downgrade a device that has run the profiles build.** A downgrade sees learner 1 only; the other learners' data stays on disk, unseen.

### 4.8 A learner's start doc

`learnerStartProgress(entry)`:

- `'legacy-default'` → `defaultProgress()`, Marian's baseline as today (`defaults.ts:264`).
- `{ math: m, wordSong: w }` → start from the schema floor (`defaultLockedSkillLevels()`, `defaults.ts:158-164`). In each world, every step of the lands before the chosen land is `'mastered'`, the land's first step is `'intro'`, later steps are `'locked'`: `progressAtStep`'s rule (`debug/stepProgress.ts:13-20`), applied to both worlds. Diagnostic levels never carry over: `progressAtStep` today keeps the other world's defaults (K7). Name from the entry; `parentSettings` the defaults; history, Leitner and good days empty.

A learner added from a code has `start: { math: 1, wordSong: 1 }`, used only if their doc is ever lost.

## 5. Settings

### 5.1 Per learner (all of today's)

Each doc carries its own `parentSettings` (`types.ts:650`), so all 7 rows are per learner with no new code: auto-promote, the session-mode picker, the two mastery thresholds (default 0.875 on 3 separate days, `progress/parentSettings.ts:57`), fresh-day mastery, show level, cross-vowel mixing. A new learner gets `DEFAULT_PARENT_SETTINGS` (`parentSettings.ts:91-105`). Also per learner: the pending promotion, stardust, session history and streak, Last synced, the sync ID.

### 5.2 Language (reserved)

`LearnerEntry.language` and the carrier's `language`, value `'en'`, no UI, no reader. The planned Danish version decides what a non-`'en'` learner does, including on a build that only knows English. Per learner, not per install, because a learner's levels belong to one language's trees, and a family may have one child in each language.

## 6. What the child sees change

### 6.1 Greet

It plays once per learner: `nextAfterPick` goes to Greet when the learner's `sessionCount === 0` **and** their doc has empty `history` and a null `lastPlayedISO`. A learner added from a code has history in their doc but no local session history; they go to the Hub, never to "nice to meet you" (K6). Greet's lines and motion don't change.

### 6.2 Hub, Map, Session End, stardust

- **Hub:** the badge with 2+ learners (§ 2.1). Cards, flowers, guidance and Emma's lines are the playing learner's, read as today.
- **Map:** the playing learner's lands, stops and unlock beats; the seen-marker is written to and pushed for that learner (`unlockBeat.ts:73-80`).
- **Session End:** unchanged, written to the playing learner. No name, no sibling mention.
- **Stardust:** per learner, never summed, never shown beside another's.

### 6.3 Names

Phase 1–2: the name is on the picker tile as text only. Emma says no name anywhere, and session requests carry `'friend'` (P7). Phase 3 (T4): Emma says "\<Name\>!" on the picker tap, and nowhere else. No name clip means today's silent pick. That fallback is the shipped behaviour, not an error.

## 7. Edge cases

- **Remove a learner:** § 3.5. Removing the last learner isn't possible. Their cloud record stays (no server delete). Re-adding them by code restores their doc but not stardust or session history, which were never in the cloud (§ Today).
- **Restore onto a device with other learners:** Add from a code makes a new learner; it never overwrites one (§ 3.3). A per-learner Restore stays read-first (`cloudBackup.ts:157-168`) and refuses another learner's code (§ 3.4).
- **Two learners, one device, mid-session:** a session belongs to the learner who started it. The picker never interrupts Math, Word Song or a peek (§ 2.2). A reconcile still in flight from before a switch lands in its own learner (§ 4.4).
- **A sibling taps the wrong tile:** the badge shows whose Hub it is; one tap fixes it. A whole session played as the sibling adds at most one day toward the sibling's step. A step needs 3 good days (`parentSettings.ts:57`) or 2 secure days on the fast track, so one stray session can't master it (D2).
- **No network:** picking, switching, adding, renaming and removing are local and work. Add from a code shows the error line and writes nothing. Reconcile keeps local on `cloud-error`, as today. Phase 3: no name clip until the next time Parent Settings is open and online.
- **Two Marians on one device:** not possible by accident. Add from a code with the code of a learner already here is refused (§ 3.3).
- **An older build on the other device:** it syncs learner 1's record as today and never sees the others (§ 4.7).
- **Debug QA jump and seeds:** they act on the playing learner. "Back to \<name\>'s start" writes `learnerStartProgress` (for learner 1: `defaultProgress()`, as today).

## 8. Child-safety and dark-pattern check

- **No comparison:** no screen a child sees shows another learner's flowers, stars, levels, streak, stardust or play time. Picker tiles carry a picture and a name, nothing else (§ 1.2). The order is fixed; it never sorts by progress or by who played last.
- **No leaderboard, no shared pool:** stardust, flowers and unlocks are per learner. No "family total", no sibling unlocks.
- **No shaming or nudging between siblings:** Emma never mentions another child, who played today or who didn't. No streak copy across learners.
- **No pressure to switch or stay:** switching costs nothing and loses nothing mid-day. The return rule only asks "Who is playing?" (§ 2.2).
- **Avatars:** animals, not people. No gender, skin or appearance coding. Colours avoid red (never-a-red-X, § 13 T2). The child picks their own with the parent (D7).
- **Adult gate unchanged:** add, rename, remove and restore sit behind the 3 s press (`Hub.tsx:65-66`).
- **Privacy:** names stay on the device and in the learner's own cloud record (which already carries `childName` today, `api/progress.ts:23-27`). No name goes into session requests (P7). The learner ID is never sent.

## 9. Assets

- **8 avatars:** clay animal stickers in the Hub's clay look, transparent, one per `AvatarId`, each on its fixed colour disc (T2). Generated with the pack pipeline (`scripts/generatePackPictures.ts`, a new manifest batch, contact sheet `scripts/packPictureSheet.ts`), registered through `mobile/scripts/export-assets.mjs` (the generated `mobile/src/assets/registry.ts`).
- **1 Emma line:** "Who is playing?" (Lily, § 1.3).
- **Phase 3:** one name clip per learner, on the device (T4, K10).
- **Reused:** the chime, the Hub gradient, Emma idle.

## 10. Wiring checklist

- **Core (Kevin):** `@marian/core/learners` (§ 4.1); the scoped store; `ensureLearnerList` in `installNativePlatform`; the carrier in `Progress`, `isProgressV1`, and the `installCloudBlob` spread; a learner-bound `installLocally` / `AdoptDeviceIdDeps` / sync-success listener; `learnerStartProgress`; `progressAtStep` based on the learner's start; `nextAfterSplash` → `picker` with 2+ learners; `nextAfterPick`; `Route` + `'picker'`; the per-learner launch-reconcile latch; `childName: 'friend'` in the 3 native request builders.
- **Native (Devon):** `PickerScreen` (§ 1), the Hub badge and the long-press exclusion (§ 2.1), the return rule (§ 2.2), App's switch (§ 2.3), Parent Settings' learners card, selected-learner card and the 3 sheets (§ 3), native copy (§ 3.6), the `picker.who` line in `GUIDANCE_LINES` and its Lily render (after T5), the 8 avatars (after T2).
- **Unchanged on purpose:** `/api/progress`, `_progressStore.ts`, the canon, the guard's step-name rules, `schemaVersion`, every web screen.

## 11. Acceptance criteria

**Core (vitest, PR A):**

1. **Migration, upgrade:** a store holding today's 7 keys from a real-shaped doc → `ensureLearnerList()` adds exactly one key (`marian-tutor:learners:v1`), and every other key stays byte-equal. One learner, `legacySlot: true`, named from `profile.childName`, active.
2. A second `ensureLearnerList()` writes nothing.
3. **Migration, fresh install:** no doc → one learner, name `''`, start `{ math: 1, wordSong: 1 }`; the legacy progress key holds a doc with `number-recog` and `letter-names` at `'intro'` and every other step `'locked'`.
4. **Scoped store:** learner 1 active → each of the 7 keys maps to itself; learner B active → `<key>:<B.id>`; the list key and any other key pass through.
5. **Isolation:** a Session End write for B (`recordSessionEnd` + `recordProgressOnSessionEnd`) changes only B's keys; learner 1's 7 keys stay byte-equal.
6. A session end for B pushes to B's sync ID (fetch stub), never to learner 1's.
7. **Bound reconcile:** A's reconcile held open on a stubbed fetch, switch to B, release → the cloud doc is in A's progress key, B's is byte-equal, and Last synced is written for A only.
8. **Bound Restore:** `adoptDeviceIdAfterRead` for A, switch mid-flight → A's sync-ID key holds the code, B's is unchanged.
9. A Restore or Add-from-code with a code another learner holds → refused, nothing written.
10. **Add from a code:** a found record → a new entry (name from `childName`, cut to 24; avatar from the carrier if free, else the first free), the doc installed under its keys, sync ID = the code.
11. **Remove:** B removed → B's 7 keys gone, the list without B, learner 1 byte-equal. The last learner can't be removed. Removing the playing learner makes the first remaining one active.
12. **Start doc:** `{ math: 3, wordSong: 2 }` → Number Garden lands 1–2 mastered, land 3's first step `'intro'`, the rest `'locked'`; Word Song land 1 mastered, `blending-cv` `'intro'`, the rest `'locked'`. No diagnostic level appears (`sub-to-10` is not `'practicing'`).
13. **Forward compat:** a doc with `learner: { avatarId: 'unicorn', language: 'da' }` loads and round-trips through local load + save and through a cloud install unchanged. `learner: 'x'` rejects.
14. `isLearnerList` accepts 5 entries and unknown avatar and language strings; it rejects a missing `activeLearnerId`, one not in the list, and `schemaVersion: 2`.
15. A corrupt list is rebuilt from the legacy slot; the legacy doc stays byte-equal.
16. **Routing:** 2+ learners → Splash goes to `picker`; 1 learner → `greet | hub` as today. A learner with doc history but no session history → `hub`.
17. Every native session payload sends `childName: 'friend'`.
18. No list installed (the web) → every key as today; the web suites pass unchanged.

**Native (jest, PR B):**

19. The picker renders n tiles in add order, each with avatar and name. A tap → chime and pulse, then the route 400 ms later; a second tap in that window is ignored.
20. "Who is playing?" plays once 300 ms after the tiles land and once more 20 s after it ends without a tap. A missing clip walks the caption silently.
21. **One learner:** no picker, no badge. The existing App, Hub and Parent Settings suites pass unchanged.
22. **Badge:** top-left, hit area 56 × 56; a tap opens the picker. Emma's 3 s press still opens Parent Settings; a 3 s press on the badge does not.
23. **Return rule:** hidden 10 min on Greet, Hub, Map or Session End with 2+ learners → the picker on return. On Math, Word Song or a peek: no change. At 9 min 59 s: no change.
24. **Parent Settings:** selecting a row moves "Playing now" and every section re-reads; an in-flight Push now or Restore is aborted. Add enforces 1–24 characters and unique pictures and offers the lands. § 3.3's 5 outcomes show their lines. The Remove alert matches § 3.5. Parent copy names the selected learner. Done → the picker when the set or the playing learner changed, else the Hub.
25. A picker tile renders no flower, star, level or count element.

**Device** (Thomas's iPad and iPhone):

26. **Upgrade on the iPad:** Marian's map, flowers and steps exactly as before the build; no picker; Parent Settings shows one learner, "Marian".
27. **Add a second learner:** the picker on the next launch; each learner's map is separate; the badge switches.
28. With the iPhone left on an older build: a session on either device shows on the other after a relaunch (learner 1's record).
29. Add from a code on the iPhone: the second learner appears with their progress.

## 12. Build split and order

1. **PR A, Kevin (data first):** core, migration, keys, scoped store, carrier, bound async writes, start docs, routing helpers, the `'friend'` name. ACs 1–18. **With one learner it changes nothing visible**, so it can ship alone. Install it on both devices before PR B, so the migration has run on each before a second learner exists. This is recommended for a clean order; compat does not need it (§ 4.7).
2. **PR B, Devon (screens), after A merges** (it imports A's names, § 4.1): picker, badge, return rule, Parent Settings, copy, the line and the avatars. ACs 19–29. Needs T1–T3, T5, T6. The ear test for the line and the contact sheet for the avatars are Thomas's.
3. **PR C, phase 3 (Kevin server + Devon UI), only if T4 is yes and only after B is on the devices:** name clips. A small name-render endpoint, Parent Settings preview and retake, the picker tap. Its own ACs in its own spec section, written when T4 is decided.

Reviewers: Devon reviews A, Kevin reviews B (`feedback_pr_review_routing`).

## 13. Thomas decides (T1…)

- **T1. Up to 4 learners per device.** 4 keeps every picker tile at least 103 × 130 pt on the smallest phone (§ 1.2).
- **T2. The 8 avatars and their colours:** fox orange, lion yellow, frog green, turtle teal, penguin blue, owl purple, cat pink, bear brown. Clay animals in the Hub's look, no red. Spend: about $0.80 at wave 4's average of $2.43 for 25 images (`content-wave-4.md:483`); recommended cap $1.50 with retakes. The generator's `--dry-run` prints the real number before any call. The look is judged on the contact sheet.
- **T3. Marian's picture:** Marian picks it with Thomas in Parent Settings once PR B is on the iPad; fox until then.
- **T4. Name audio (phase 3): yes, in Emma's voice (Lily), on the picker tap only.** One clip per name, rendered when a parent saves the name (about 6–25 characters each from the Lily budget). The parent hears it in Parent Settings and can retake it or type a "sounds like" spelling. It needs a new server endpoint (K10). This is the one place Parent Settings plays a sound. Without a clip, the pick stays silent.
- **T5. The line "Who is playing?"** (15 characters of Lily), ear-tested in voice-QA.
- **T6. Parent-facing words:** "Learners", "Playing now", "No name", "+ Add a learner", "Add from a code", "Where to start", "Backup code" (for "Device ID"), and § 3.3–3.5's lines; "they" for every learner.
- **T7. A fresh install keeps today's zero-setup first run** (Splash → Greet → Math). Its learner 1 is unnamed, starts at land 1 in both worlds and is named when a second learner is added. Today a fresh install starts at Marian's diagnostic. Marian's devices are upgrades and keep her doc.
- **T8. Session requests send "friend" for every learner,** so no child's name goes to the planner. The canon is unaffected (its key has no name, `api/_canon.ts:75-79`).

## 14. Pedagogy and safety checks for Dave (D1…)

- **D1.** A new learner starts at the land the parent picks per world (default land 1), with no placement test. A child placed too low moves on by the fast track: a step finishes after 2 separate days with every problem right on the first tap (`fast-track-native.md` § Goal). Confirm a parent's land pick is right for ages 6–9.
- **D2.** One tap picks, with no confirm step: a confirm would be a reading task on every launch. A stray session can bring a sibling's step one day closer but can't master it (3 good days, `parentSettings.ts:57`, or 2 secure days on the fast track). Confirm one tap with no confirm is enough.
- **D3.** Picker tiles show a picture and a name only, in a fixed add order, so there is no cue to compare (§ 8). Confirm this covers sibling comparison.
- **D4.** The return rule: after 10 minutes in the background, outside a session, Emma asks "Who is playing?" again. Confirm 10 minutes for this age, and that being asked again is harmless for the child who was already playing.
- **D5.** The child's written name sits under their picture, as passive reading of their own name. Non-readers pick by picture. Confirm.
- **D6.** Emma says the child's name only on the picker (phase 3), never in teaching lines or praise. Confirm it stays out of praise.
- **D7.** Animal avatars, not people, and no red. The child chooses their own. Confirm the 8 animals as a set (none frightening, none read as a gender).

## 15. Kevin confirms (K1…)

- **K1.** The 7 keys in § 4.2 are every piece of per-child state on native. Nothing else persists per child (audio caches, map tap log, Expo files).
- **K2.** No module caches the store, or a key read from it, across a learner switch. The screens remount (§ 2.3), but check module-level state in core: `stardust.ts`'s default adapter, the reconcile latch.
- **K3.** The bound async writers in § 4.4: reconcile install, Restore's ID write and the sync-success listener with the sync ID. Also confirm the 4 pushes read their ID and doc before their first `await`.
- **K4.** `installCloudBlob` (`cloudSync.ts:526-…`) keeps unknown top-level fields. Pin it for `learner`, so an older build's cloud install + save hands it back.
- **K5.** Nothing in PR A writes a value an older guard rejects: no `schemaVersion` bump, `character: 'melody'`, the carrier only top-level.
- **K6.** `nextAfterPick` uses `sessionCount === 0 && history.length === 0 && lastPlayedISO === null` for Greet (§ 6.1).
- **K7.** `learnerStartProgress` and `progressAtStep` both start from the floor plus the learner's start, never from `defaultProgress()` (except `'legacy-default'`). Every reader that falls back to `defaultProgress()` when the doc is missing (`mobile/src/session/sessionEndWrite.ts` and `ParentSettings.tsx` import it) falls back to `learnerStartProgress(activeLearner())` instead. The e2e and Maestro seeds that rely on `defaultProgress()` still seed explicitly.
- **K8.** Sync-ID uniqueness per device is enforced in core (`addLearnerFromBackup`, the scoped Restore), not only in the UI.
- **K9.** Switching every native request to `'friend'` breaks no test or mock that pins `'Marian'` (`scripts/maestroSweepApi.test.ts:29`, `mobile/src/audio/debug/audioCheck.ts:179`), and the session cache key (`api/_sessionCache.ts:85-88`) is fine with it.
- **K10.** Phase 3 only: the name-clip endpoint. Input limited to § 3.2's set and 24 characters, a rate limit per sync ID, Lily characters counted, the clip stored as a file outside the key-value store, a retry when offline.
- **K11.** A corrupt list rebuilds from the legacy slot (§ 4.3), and learners 2–4 come back by Add from a code. My recommendation is no second copy of the list. Confirm the single `setItem` write makes a corrupt list unlikely enough.
- **K12.** `ensureLearnerList` runs before the QA step and the debug seed in `bootNative` (`native.ts:97-109`), so both write to the playing learner.
