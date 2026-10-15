# 2 secure days (fast track) and the Map peek (native)

**Scope:** `@marian/core`, the native screens (`mobile/`) and one small server branch (§ 6.2). The web UI is frozen. It never sends the new fields and never records a secure day (§ 3.5). Layout conventions follow `design/native/greet-math-native.md`. Code is anchored by names, not line numbers.

**Two features, kept apart (Thomas, 2026-10-14):** "She wants to see what's in the game, but we should still keep track on her level."

- **Progress** (§ 2–5) is what counts toward mastery: the fast track and the pace guard.
- **Explore** (§ 6) is the Map peek, and it counts toward nothing. § 11 is the boundary between them.

Each half can change or ship without the other. Build order: progress first, explore second (§ 6.2 needs a server release).

## Goal

- **Progress:** if Marian gets every problem of a step right on the first tap on two separate days, the step finishes on the second day. Today's flower and the rest of the tray fill at once.
- **Explore:** on the Map she can tap any later step, locked ones too, and try 3 of its problems. Nothing is scored and nothing is recorded.

## Research basis

- **Dave, consult 2026-10-14:** two "secure days" on separate days finish a step, and a second secure day fills all the remaining flower slots.
  - He rejected a same-day "show me" round because it measures performance, not retention.
  - He wants the cvc-words novel-word gate kept, and `crossDayEnforcement` off is not a fast track.
  - The number 2 is his judgement. Only "at least one sleep" has evidence.
- **Dave, re-consult 2026-10-14 (both parts relayed by Matt, not in a file):**
  - Accuracy completes a step. Automaticity is the job of review, the warm-up and the slow-fact hint.
  - Secure = 8/8 on the first tap on every step, both worlds, untimed. Counting for 5–10 s is normal for her, and native latency starts when Emma's read-aloud starts, so the prompt audio counts against it (`openChipGate` in `mobile/src/screens/math/Math.tsx` anchors at TTS start).
  - Framing: Emma notices growth, not speed, and never links counting or fingers with "not yet".
  - Explore lives on the Map only and counts toward nothing.
  - He confirmed the first-finished-session rule (P2) and the unannounced bonus flower (P8).
  - He added the ≤ 5/8 pace guard (§ 5).
- **Trigger:** Marian's first session (2026-10-14). Thomas: "she was disappointed she can't try the next steps because it was too easy", in both worlds, "mostly right but still counting on her fingers".
- **Untouched evidence:** `design/research/speed-feedback-automaticity-marian.md`.
  - Recommendation 1 (no speed signal to the child) stands: nothing here shows a clock or says "fast".
  - Recommendation 7 ("Latency median is NOT a promotion gate") stands: no rule here reads latency except the warm-up remark in § 7.

## User state entering

- **Fast-track day:** she finishes a step's session with 8 stars, and the tray already holds one flower from an earlier day.
- **Peek:** she is on the Map (from the Hub's map button, or after an unlock) looking at stops beyond her current one.

## 1. Decisions

### 1.1 Team calls

| #   | Call                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Secure session:** all 8 scored problems right on the **first tap**, on every step in both worlds. No latency check (Dave).                                                                                                                                                                                            |
| P2  | **Secure day:** a local day on which the **first finished session on that step** (on that vowel, for per-vowel letter sounds) was secure. Dave confirmed this. Later sessions that day never count. A peek is not a session (it writes no history), so a peek earlier that day leaves the first real session in charge. |
| P3  | **Fast track:** with **2 secure days** (`FAST_TRACK_SECURE_DAYS = 2`), a step counts as having all its good days. It goes through the existing promotion path (`autoPromote`, `pendingPromotion`, unlock, celebration). No good-day date is invented.                                                                   |
| P4  | **Never part of the check:** warm-up hearts (outside the scored 8, #565 D4), reviews (no history, #565 D7), sessions quit before the end, a guided give-answer (it is not a first-tap right answer) and peeks (no history, § 6.5).                                                                                      |
| P5  | **`crossDayEnforcement` off** doesn't change the fast track, which still needs 2 separate days. The switch only loosens the normal rule.                                                                                                                                                                                |
| P6  | **cvc-words keeps its novel-word gate.** After 2 secure days it reads "good days full, awaiting the check", the same state a 3rd good day reaches today. The graduation session decides.                                                                                                                                |
| P7  | **Not retroactive.** Secure days are recorded at session end from the payload's first-tap array (§ 3.2), starting with the first session finished on the new build. Word Song history keeps no first-tap data (§ 2), so history can't be re-scored.                                                                     |
| P8  | **No secure-day indicator** (Dave confirmed): no counter, badge, Hub line or Map change. The fast track first shows itself when it fires, with no signposting beforehand.                                                                                                                                               |
| P9  | **Pace guard:** if a step's day score is ≤ 5/8 on her two most recent days on it, that step can't fast-track (§ 5). Nothing visible changes and no flower is removed.                                                                                                                                                   |
| E1  | **The Map is the only way into explore:** a tap on any stop after the current one, locked or open, starts a 3-problem peek from that step's canon (§ 6). Nothing about explore appears on the Hub or at Session End.                                                                                                    |
| E2  | **A peek writes nothing:** no score, stars, stardust, flower, Leitner outcome, history entry, session count or cloud push. It ends back on the Map. There are no caps, no countdowns, no shaking or glowing padlocks and no autoplay into another peek. Emma never asks her to keep playing or to come back.            |
| E3  | **The review spec's "the Map never starts a session" changes:** the Map now starts peeks. A peek is not a session (E2), so every session rule there still holds.                                                                                                                                                        |

**Where the fast track changes anything:** with the 3-day presets (88% / 3 default, 95% / 3) it fires only when a step's first two good days are both secure. With 80% / 2, two secure days are already two good days, so it never adds a flower. **Thomas's iPad is on 80% / 2 now. Per Matt, he returns to the default when this ships.** Every fast-track day adds today's flower plus **one** more (§ 4 still handles N).

### 1.2 For Thomas

- **T1. Four new Emma lines** (§ 8). Team recommendation: approve as written, with one wording change from Dave's draft: the opener says "look" instead of "peek" (§ 8 explains why).
  1. "You know this! All your flowers grew!" (fast-track day; Dave: approve-track as written)
  2. "You just knew that one!" (a quick warm-up answer; Dave)
  3. "Let's look at this one!" (peek opener; Dave proposed "Let's peek at this one!")
  4. "This one is for later. You will learn it!" (peek closer; Dave)
  - Lines 3 and 4 were replaced by per-step lines after Thomas's device check on 2026-10-15 (§ 8).
- **T2. Parent Settings:** no fast-track switch. Both threshold descriptions get one more sentence: "Two days with every answer right on the first try also count." Team recommendation: yes. Without it, "How many sessions … Marian needs" stops being true.

## 2. Secure sessions (progress)

New pure core module `packages/core/src/progress/fastTrack.ts`:

```ts
export const FAST_TRACK_SECURE_DAYS = 2
export const SESSION_PROBLEMS = 8
export function isSecureSession(
  firstTapCorrect: readonly boolean[] | undefined,
): boolean // exactly 8 entries, every one true
export function fastTrackQualifies(
  secure: readonly string[] | undefined,
): boolean // ≥ 2 distinct days
export function fastTrackSecureDays(
  p: Progress,
  key: GoodDayKey,
): readonly string[] | undefined // § 3.3
```

**Why a new first-tap field:**

- `totalCorrect` counts any problem solved without the given answer, retries included, in both screens (`if (!warm) totalCorrectRef.current += 1`). So `successRate === 1` does **not** mean 8/8 on the first tap.
- Math's `perProblemCorrect` is already first-tap (it is set inside `firstTapRecordedRef`).
- Word Song's `perProblemCorrect` follows `countsAsCorrect`, so retries count. Its first-tap array `firstTapCorrectRef` reaches the payload only for warm-ups.

| Event                                                  | Can make a secure day?                |
| ------------------------------------------------------ | ------------------------------------- |
| Forward session, first one finished on that step today | Yes, judged on its scored 8           |
| Its warm-up hearts                                     | No, they are never part of the check  |
| A later forward session on that step the same day      | No (P2)                               |
| Same-day review (#565)                                 | No, it writes no history              |
| Map peek (§ 6)                                         | No, it is not a session               |
| cvc-words graduation session                           | Judged on all 8, novel words included |

## 3. Secure days and the fast track (progress data)

### 3.1 `Progress.secureDays`

`secureDays?: GoodDays` in `types.ts` uses the same type as `goodDays`.

- Keys are a `SkillNode` or a letter-sounds vowel.
- Values are sorted local `YYYY-MM-DD` keys, only ever added, capped oldest-first at `MAX_GOOD_DAYS_PER_STEP`.
- The field is optional and additive, with no `schemaVersion` bump. Absent means no secure days.

### 3.2 Recording (`recordProgressOnSessionEnd`, `progressHistory.ts`)

- New input: `RecordProgressInput.firstTapCorrect?: readonly boolean[]`.
- `day = localDayKey(input.dateISO)`. Export the mastery rule's own `localDayKey` from `mastery.ts` so secure days and good days key a session the same way.
- Before `applyMasteryRule`, the session's keys are the focus node, plus `currentTargetVowel` when a letter-sounds entry carries one (mirroring `recordGoodDays`). For each key k, union `day` into `secureDays[k]` when all three hold:
  1. `existing.skillLevels[focusNode] !== 'mastered'`
  2. no entry in `existing.history` names the node in `skillFocus` (with the same `currentTargetVowel`, for a vowel key) on a day where `localDayKey(entry.dateISO) === day`
  3. `isSecureSession(input.firstTapCorrect)`
- `recordReviewOnSessionEnd` stays as it is, and a peek never reaches this function.

**Native plumbing:**

- `MathSessionResult.firstTapCorrect = perProblemCorrectRef.current.slice(w)`.
- `WordSongSessionResult.firstTapCorrect = firstTapCorrectRef.current.slice(w)`.
- `SessionEndPayload.firstTapCorrect` is mapped in `sessionEndPayload.ts`, and `writeSessionEnd` forwards it on the forward path.
- `perProblemCorrect` keeps its meaning in both screens (Leitner, graduation split).

### 3.3 Mastery rule (`mastery.ts`)

- **The floor:** `goodDayCount(focused, threshold, settings, banked, secure?)` computes as today, then returns `fastTrackQualifies(secure) ? Math.max(count, threshold.sessions) : count`.
- **Threading:** `secure` goes through `hasEnoughGoodDays` and `qualifies`, `scanPerVowelSubMastery` (per vowel), `isGraduationSessionPending` and `nodeProgress`. Every call site reads it as `fastTrackSecureDays(progress, key)`.
- **`fastTrackSecureDays(p, key)`** returns `p.secureDays?.[key]`, or `undefined` while the key's step is on pace hold (§ 5). That one function is the only switch for the fast track.
- **Results:**
  - A practicing step with 2 secure days qualifies.
  - cvc-words becomes graduation-pending.
  - Per-vowel letter-sounds rows fast-track one vowel at a time, and the composite still needs all four.
- `recordGoodDays` is unchanged, so only real days are banked.

### 3.4 Display: `nodeProgress`, Hub, Map

- **`nodeProgress`:** a fast-tracked step that isn't mastered yet (cvc-words awaiting its check, or `autoPromote` off) reports `goodDays === requiredDays`. cvc-words also reports `awaitingNovelWordCheck: true`.
- **Hub (`buildHubCardModel`):** no change. After a fast-track unlock, the next step is current with an empty tray. In the rare full-but-not-mastered state, the Hub shows its last slot sleeping on the day itself, as a cvc-words 3rd good day already does.
- **Map (`mapModel`):** no bud change. A fast-tracked step shows a full row, and its unlock plays through `pendingUnlock`.

### 3.5 Guard, sync, older docs, web

- **`isProgressV1`:** check `secureDays` exactly like `goodDays` (an object of string arrays; absent is allowed) and `paceHold` (§ 5) as a string array. Unknown keys don't reject a blob today, so an older build keeps loading these docs.
- **`installCloudBlob`:** `secureDays = unionGoodDays(cloud, local)`, threaded in as `localGoodDays` is, and `paceHold = union(cloud, local)`. Nothing banked locally is dropped.
- **Storage load:** no seeder (P7).
- **Web:** shared core honours synced fields in its displays. It never sends `firstTapCorrect`, so it never records a secure day.

## 4. Session End on the fast-track day

### 4.1 Guidance model (`sessionEndGuidance.ts`)

- `newSlot = row.was` (today it is `row.now − 1`). The two are equal whenever one flower lands, so every existing case is unchanged.
- New field `bonusSlots: number[] = [row.was + 1 … row.now − 1]`. It is empty unless the fast track fired.
- When `bonusSlots` isn't empty, the `flower` beat's line is `guide.end.fast-track` instead of `guide.end.flower`. Every other line is chosen as today. The row is full, so nothing sleeps.

| Fast-track step                                  | `day`        | Lines                                               |
| ------------------------------------------------ | ------------ | --------------------------------------------------- |
| Any step with a next step                        | `unlock`     | `right.8` → `fast-track` → `count.3` → `path-opens` |
| A world's last step                              | `world-done` | `right.8` → `fast-track` → `count.3` → `world-done` |
| cvc-words before its check, or `autoPromote` off | `good-day`   | `right.8` → `fast-track` → `count.3`                |

### 4.2 Layout and sequence

There is no layout change: the tray is already sized for `required` holes in all four forms (`sessionEndLayout.ts`).

```
before         [ ✿  ○  ○ ]
today's lands  [ ✿  ✿  ○ ]        flies into slot row.was, sparkle
bonus grows    [ ✿  ✿  ✿ ]  3 of 3!   grows in place, sparkle, then the badge
```

`SessionEndView` gets new state `bonusLanded` (0 … `bonusSlots.length`).

- **Slot i shows** `slotsBefore[i]` until today's flower lands. After that it shows `slotsAfter[i]` when i is `newSlot` or one of the first `bonusLanded` bonus slots, and `slotsBefore[i]` otherwise.
- **Pop:** `FlowerTray.popSlot` becomes `popSlots = landed ? [newSlot, ...bonusSlots] : []`. A hole's `entering` animation runs when its flower view mounts, so each bonus pops the moment it turns grown.
- **`CountBadge`** mounts when `landed && bonusLanded === bonusSlots.length`, so it never shows over an empty hole.

## 5. Pace guard (progress)

**Day score:** a step's score on a day is the `successRate` of the first finished session on it that day. This is the same notion as P2.

**Trip:** after each forward session-end write, if the focus step isn't mastered and its two most recent days played both have a day score ≤ 5/8 (`successRate <= 0.625`), add it to `Progress.paceHold?: SkillNode[]`.

- "Two days running" means the last two distinct days she played that step, even if calendar days lie between them.
- The list is add-only. Its guard and sync rules are in § 3.5.

**Effect:**

- While the step is on the list and not mastered, `fastTrackSecureDays` returns `undefined` for it and its vowels.
- It finishes only through the normal 3 good days, in any order, with its banked days kept.
- Secure days are still recorded; they just don't count. Once the step masters, the entry is inert.

**Why this, and nothing more (team recommendation):** the only thing that speeds her up now is the fast track. A peek counts toward nothing, so the guard turns off the fast track and leaves everything else alone. It never demotes a step and never removes a flower, so no change can feel like going backwards. The child sees nothing. Parents see it only in the backup export (`paceHold`).

## 6. The Map peek (explore)

### 6.1 Which stops, and the tap

- **Peekable:** a stop after `currentStepOf(p, world)` in tree order that is not mastered. That includes every locked stop. A complete world has none.
- **Tap on a peekable stop:**
  - Only once the map's beat gate is open (`view.tapsWait` false, `map-native.md` § 6).
  - The line in flight is cut. Stop and gate taps are ignored while the peek request is out; Home still works and cancels the request.
  - The tap no longer gives the locked response (poof, wiggle, badge tilt, requirement line from `stopLine`). That supersedes the "Locked stop" bullet of `map-native.md` § 6. There is no press visual, as now.
- **On success:** the route changes to `peek` `{ world, node }` (§ 6.3).
- **On failure** (network, 400, a plan id not starting `peek-`, not exactly 3 parsed problems, or no answer within 5 s): `path.stop.<node>` (the stop's name line) plays, and taps resume.
- **The current stop, earlier stops and gates:** unchanged.

### 6.2 Request and server

- **Core:** `pickPeekBlocks(node): CanonBlockRef[]` returns `[{ node, problem: 1 }, { node, problem: 2 }, { node, problem: 3 }]`. These are the first 3 in canon order, the same 3 every time, so the peek is predictable.
- **Wire** (`packages/core/src/wire/types.ts`): `PEEK_BLOCK_COUNT = 3` and `PEEK_PLAN_ID_PREFIX = 'peek-'`, plus an optional `peek?: { blocks: CanonBlockRef[] }` on the session-start track payload. Exactly 3 refs, all one step of `track`.
- **Server** (`api/_review.ts`): generalise the review responder. A `peek` request runs as step 0, like `review`: before the canon lookup, the session cache and the rate limiter. It ignores every progress hint.
  - It copies the 3 blocks with their baked audio, renamed `<ns>.p1..p3.`, and returns plan id `peek-<track>` with label `Peek`.
  - No Anthropic call, no TTS and no cache write. A bad ref is 400 `invalid-request`.
  - Every step has a level-1 canon file (`public/canon/{math,word-song}/level-1/`).
- **Ship order:** `yarn release` before the device check. An old server answers with a forward plan whose id doesn't start with `peek-`, so the client takes the failure path in § 6.1.

### 6.3 The peek screen

Math or Word Song gets `peek: true`, with `problemNodes = [node, node, node]`.

- **HUD:** the back button and a 3-bead track (the usual beads show her place, not a countdown). No stardust pill and no streak.
- **Opener:** `guide.session.peek-open.<step>` ("Let's look at <name>!", § 8) plays where problem 1's read would start. The stage stays empty during it and fades in at its end, the #565 § 3.3 / § 5 review-opener behaviour reused. 400 ms later the problem 1 read starts. Emma is `listening`.
- **Problems** run as usual:
  - Read line, then the chips open on the read line's `onPlay`.
  - Right: sparkle, plink, `celebration` and the correct line.
  - Wrong: poof, shake, `puzzled-tilt`, "Hmm... try again?"; the hint comes at 2 wrongs and the given answer at 3, so she always reaches the answer. Never a red X.
  - No stardust grant and no streak. Subitising scaffolds and Word Song cross-vowel are off.
- **Close:** when problem 3 resolves, 400 ms → `guide.session.peek-close.<step>` ("<Name> is/are for later. You will learn it!", § 8) → 400 ms after it ends → back to the Map. There is no Session End.
- **Back button:** any time. It cuts the line and returns to the Map at once.

### 6.4 Back on the Map

The Map remounts in the peek's world with `returnFromPeek: true`.

- No open line plays and the caption slot is empty. Emma has just spoken, and she doesn't ask for more.
- No beat can be pending, because a peek writes nothing.
- Every stop is tappable at once.

### 6.5 What a peek writes: nothing

- **Not called:** `onSessionComplete`, Session End, `writeSessionEnd`, `recordSessionEnd`, `grantStardust`, `writeStardust` and `pushProgressToCloud`.
- **Untouched:** history, `sessionCount`, the day streak, Leitner, `lastPlayedISO`, first encounters, scaffold counters, `secureDays` and `paceHold`. The Hub's prefetch is kept, as for any map visit.
- **Consequences:** a peek can't be "the first session today" for the #565 warm-up, can't trip the pace guard, and can't make a day secure.
- **Test:** the persisted progress JSON is byte-identical before and after a peek (AC 18).

## 7. "You just knew that one!" (Math warm-up)

- **When:** a Math warm-up heart (#565) answered right on the first tap with `latencyMs < SLOW_FACT_MIN_MEDIAN_LATENCY_MS` (5000 ms).
- **Why 5 s:** native latency starts with the read-aloud, so the 5 s includes the question itself. Five seconds is the existing "reliably counting" cut. Dave named no number; this is the team's reading.
- **Sequence:** the problem's correct line ends → 300 ms → `guide.session.knew` → the advance waits for it.
- **Not used:** on scored problems, in reviews or peeks, or in Word Song, which records no latency on native.
- **Rec 3 check:** the celebration (sparkle, plink, pose, correct line) is identical for slow and quick answers. The remark is extra noticing, and it never mentions speed.

## 8. Copy / TTS script

Thomas approved the lines in T1 (2026-10-14). After his device check on #568 (2026-10-15) the peek's opener and closer name the step. Each line goes in `GUIDANCE_LINES` (`packages/core/src/emmasPath/guidanceLines.ts`) and plays from `pathLineSrc(id)`.

| ID                                | Kind                 | Text                                          | When                                                    |
| --------------------------------- | -------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `guide.end.fast-track`            | `end-fast-track`     | "You know this! All your flowers grew!"       | Fast-track Session End, in place of "You got a flower!" |
| `guide.session.knew`              | `session-knew`       | "You just knew that one!"                     | § 7                                                     |
| `guide.session.peek-open.<step>`  | `session-peek-open`  | "Let's look at <name>!"                       | Peek opener (§ 6.3)                                     |
| `guide.session.peek-close.<step>` | `session-peek-close` | "<Name> is/are for later. You will learn it!" | Peek closer (§ 6.3)                                     |

- **The peek lines, per step (Thomas, device check 2026-10-15):**
  - He asked for "Let's look at [step name]" in place of "Let's look at this one!", and "[step name] is for later, you will learn it" in place of "This one is for later. You will learn it!".
  - `<name>` is the spoken step name the path lines already use (`STAGE_SPOKEN_NAMES`; `path.stop.<step>` says it, capitalised). No new name is invented.
  - There is one opener and one closer for each step a peek can reach: every step but a world's first, 10 in Number Garden and 12 in Word Song. That makes 44 lines, for example "Let's look at taking away to ten!" and "Taking away to ten is for later. You will learn it!".
  - **Verb agreement:** each name carries its own verb in `STAGE_SPOKEN_NAME_VERBS` (`packages/core/src/sessionEnd/friendlyNodeName.ts`). The verb is set per name, never guessed from a trailing "s". "You will learn it!" stays exactly as approved.
    - **"are"** for plural noun phrases: big numbers, letter sounds, the cat, dog, sun, pig, bed, ship, chick, thumb and star words, big groups, groups of two, five and ten, and groups of three and four. Example: "Cat words are for later. You will learn it!"
    - **"is"** for activity (gerund) names: adding to ten / twenty, taking away to ten / twenty, making tens, skip counting, blending sounds and reading sentences.
  - The two step-agnostic lines are retired from the catalogue, the registry and the voice-QA page.

- **Vocabulary:** I scanned the texts of `GUIDANCE_LINES`, `PATH_LINES` and `public/canon/*/level-1/*.json` on 2026-10-14.
  - Line 1 adds no new word. The opener adds none either: "look" is in "A new path opens. Look!", and the step names are the path lines'.
  - Line 2 adds **just** and **knew**. The closer adds **later**, **will** and **learn**. All five are everyday words.
- **Why "look" over "peek":** "peek" would be a new word used in this one line only. "look" says the same thing to her.
- **Framing:** no line mentions speed, counting, fingers or "not yet". The closer names the future ("You will learn it!"), never a lack. Emma never asks her to keep playing or to come back.
- **Peek player:** the session-guide player from #565 (`createManifestLinePlayer('session-guide', …)`). Without a clip it walks the caption at 165 wpm. Emma is `listening` during the opener and closer.
- **Dropped from the earlier drafts:** "You did it! Want to try a new one?" and "That one is new. We will learn it soon!". Both belonged to Dave's withdrawn counting peek.

## 9. Motion

**Fast-track Session End** (times are from the start of the `fast-track` line):

| t (ms)               | What                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 / 650 / 1450       | Today's flower pops (`NewFlower`, spring 300/14), flies (`FLOWER_FLY_AT_MS`), then lands in `newSlot` with the sparkle and the 350 ms hole pop. Unchanged. |
| 1450 + 500 × (k + 1) | Bonus k grows in place with `holePopEntering` (scale 0.7 → 1, 350 ms, ease-out) and `sfx.sparkle`. No flight. `BONUS_FLOWER_GAP_MS = 500`.                 |
| last bonus           | `CountBadge` springs in (320/16, unchanged).                                                                                                               |

- **Why no flight:** today's flower is the one she played for, so it flies. The bonus grows where it sits.
- **Reduce Motion:** today's flower is in place at 300 ms, and bonus k fades in (200 ms) at 300 + 400 × (k + 1). No sparkle, matching today's reduced branch. All timers go through `addTimer`, so cleanup clears them.
- **Peek:** the stage fade-in after the opener reuses #565 § 5 (200 ms, `EASE_OUT`; Reduce Motion: none). The route changes use the existing screen fades. The Map adds no animation: no glow, no wiggle, no padlock motion. The unlock beat's padlock pop stays, because it celebrates an unlock rather than inviting a tap.

## 10. States and edge cases

**Fast track:**

- **Happy path:** day 1, first session 8/8 → "One of three!", sleeping. Day 2, first session 8/8 → § 4.
- **Error path:** per problem, as today. One wrong first tap makes the session simply not secure. Nothing on screen says so.
- **After a 7/8 first session:** a same-day replay is a review or same-step practice (#565). It can't make the day secure.
- **Secure, bad, secure** (Mon 8/8, Tue 5/8, Wed 8/8): a full row on Wednesday.
- **First two good days not both secure:** the 3rd good day masters as usual, with no bonus.
- **Peek before the first real session of the day:** the real session still decides the day (P2).
- **Quit mid-session:** nothing is recorded, and the next finished session is "first".
- **Midnight:** native stamps `dateISO` at session end, and every day key uses it.
- **`crossDayEnforcement` off:** P5. **`autoPromote` off:** the promotion is queued and the tray shows full.
- **Preset changed later:** secure days persist, and the floor moves to the new `sessions`.
- **Letter sounds, per vowel:** each vowel row on its own. `rowOf` picks the session's vowel.
- **Older doc / older build / cloud:** § 3.5.

**Pace guard:**

- 4/8 on Monday, then 5/8 on Wednesday → hold. 4/8 then 6/8 → no hold.
- A hold on a step she reached at the normal pace changes nothing she can notice either.

**Peek:**

- **A locked step of a later land:** it peeks like any other stop. The gate stays closed.
- **A peek during the unlock beat:** ignored until Emma speaks, as with every tap.
- **Every guided answer in a peek:** it still ends with the closer and goes back to the Map.
- **The app goes to the background mid-peek:** the same audio park and resume as sessions (#528). Nothing is written, so there is nothing to recover.
- **Repeated peeks:** the same 3 problems each time, with no limit and no change in Emma's lines.

## 11. Explore vs progress boundary

Dave: "explore counts toward NOTHING", and this boundary holds as written.

1. **Progress** is everything the mastery rule reads or writes: `skillLevels`, `goodDays`, `secureDays`, `paceHold`, history, `pendingPromotion`, `unlocksCelebrated` and Leitner. Only a finished forward session writes all of it. A review writes only Leitner and `lastPlayedISO`.
2. **Explore** writes none of it (§ 6.5). After a peek, `currentStepOf`, the Hub tray and the Map are unchanged.
3. If explore is ever meant to count, that has to be a new, named progress path. It must never become a side effect of the peek screen.
4. The fast track and the pace guard never read explore. The peek works the same with or without them.

## 12. Assets required

- **New:** the lines in § 8, rendered by `scripts/renderGuidanceLinesLily.ts`. The fast-track line and "knew" are rendered in #568. The 44 per-step peek lines (1662 characters) await their render.
  - Export with `npm run export-audio` in `mobile/` (it regenerates `audioRegistry.ts`) and add them to the guide list in `public/voice-qa.html`. Thomas ear-tests them there before the native build ships.
  - Add the ffprobe length of `guide.end.fast-track` to `END_CLIP_SECONDS`.
  - **Prediction for the soak:** fast-track line ~3.1 s, "knew" ~1.6 s. Per-step openers run ~1.7–2.6 s and closers ~3–4 s. Several closers, the longest being "Groups of two, five and ten are for later. You will learn it!", will likely trip the renderer's 3.5 s flag.
- **Removed from use:** the map's locked-tap poof, wiggle and badge tilt, and the `path.locked.next` / `path.locked.later` requirement lines. The lines stay in the catalogue but are no longer played.
- **Reused:** open-bud art, the hole pop, `sfx.sparkle`, `NewFlower`, `CountBadge`, the review-opener stage fade and all canon problem audio. No new pose, background, icon or SFX.

## 13. Acceptance criteria

**Core (vitest):**

1. `isSecureSession`: 8 × `true` is secure. Any `false`, 7 or 9 entries, or `undefined` is not.
2. `recordProgressOnSessionEnd`:
   - The first secure session on a step today adds today to `secureDays[step]`.
   - After a finished 7/8 session on that step today, an 8/8 one adds nothing.
   - A session on a mastered step adds nothing.
   - A letter-sounds entry tagged `/o/` adds today under both `'letter-sounds'` and `'/o/'`.
3. **Defaults (88% / 3):** secure first sessions on Monday and Tuesday leave `add-to-10` `'mastered'`, `add-to-20` `'intro'` and `pendingPromotion === 'add-to-10'`. `goodDays['add-to-10']` holds exactly those 2 days. The same holds for a Word Song step (`blending-cv` → `cvc-words`).
4. **Not fast-tracked:**
   - Monday secure, then a Tuesday first session at 7/8 and a second at 8/8 → still `'practicing'`.
   - `crossDayEnforcement` off with two 8/8 sessions on Monday → not mastered, and `secureDays` holds 1 day.
5. **cvc-words with 2 secure days:** still `'practicing'`, `isGraduationSessionPending` true, and `nodeProgress` has `goodDays` 3 and `awaitingNovelWordCheck` true. A graduation entry with canonical ≥ 7/8 and novel ≥ 0.8 then masters it.
6. With `autoPromote` off, 2 secure days queue `pendingPromotion` without changing `skillLevels`, and `nodeProgress(...).goodDays === requiredDays`.
7. **`sessionEndGuidance` on the fast-track Tuesday:**
   - `newSlot` 1, `bonusSlots` [2].
   - Slots [grown, empty, empty] → [grown, grown, grown], and `countText` "3 of 3!".
   - Line ids `right.8`, `fast-track`, `count.3`, `path-opens`, with `day` `'unlock'`.
   - A normal 2nd good day is unchanged: `bonusSlots` [] and `guide.end.flower`.
8. On 80% / 2, 2 secure days master through the normal rule, and `bonusSlots` is [].
9. **Pace guard:**
   - Day scores 4/8 and 5/8 on the last two days played add the step to `paceHold`.
   - After that, 2 secure days don't master it, and 3 good days (banked ones included) do.
   - Day scores 4/8 then 6/8 add nothing.
10. `isProgressV1` accepts `secureDays` and `paceHold` and rejects malformed values. A cloud install unions local and cloud for both fields.
11. `pickPeekBlocks('add-to-20')` returns problems 1–3 of `add-to-20`. `GUIDANCE_LINES` holds the lines of § 8 with their exact texts, including an opener and a closer naming each step a peek can reach.

**Server (vitest):**

12. **Valid peek:** a request with 3 refs returns plan id `peek-math` and ids `math.p1–p3.*`, whose texts and base64 equal the canon blocks. It makes no Anthropic or TTS call and doesn't consume the rate limiter.
13. A peek with 2 refs, a ref from another track or `problem: 9` returns 400.

**Native (jest):**

14. **`firstTapCorrect`:** Math and Word Song results carry it for the 8 scored problems, without warm-ups. A Word Song problem solved after a wrong tap has `firstTapCorrect` false and `perProblemCorrect` true. `writeSessionEnd` forwards it, and a review end writes no `secureDays`.
15. **Fast-track Session End:** the slots go grown ×1 → ×2 at 1450 ms → ×3 at 1950 ms, and the sparkle plays twice. The count badge mounts only after the third hole, and the panel `nativeID` starts with `unlock:`. Reduce Motion: no flight, no sparkle, holes at 300 and 700 ms.
16. **Map:** tapping a locked stop requests a peek and plays no poof or wiggle. Tapping the current stop says its name. A failed request plays `path.stop.<node>`. Taps during the beat are ignored.
17. **Peek screen:**
    - The HUD has 3 beads and no stardust or streak.
    - The opener plays before the problem 1 read, and the stage mounts after it.
    - A right answer grants no stardust. A third wrong tap gives the answer.
    - After problem 3 the closer plays, then `onPeekEnd` fires. The back button fires it at once.
18. After a full peek, the persisted progress JSON and the session-history store are byte-identical to before, and no cloud push happened.
19. **Math warm-up:** a first-tap right answer at 3000 ms is followed by "You just knew that one!", and one at 6000 ms isn't. A scored problem never gets it.

**Device** (Expo Go, default parent settings; `EXPO_PUBLIC_QA_STEP` and `EXPO_PUBLIC_DAY_OFFSET`):

20. **Number Garden at defaults (add-to-10):**
    - Day 1: all 8 right on the first tap → "One of three!".
    - Offset +1: the same → today's flower flies to hole 2, then hole 3 grows about 0.5 s later.
    - Emma says the four § 4.1 lines, "3 of 3!" never shows over an empty hole, and All done → the map plays the add-to-20 unlock.
21. **Word Song** (`EXPO_PUBLIC_QA_STEP=blending-cv`): 8/8 on the first tap on day 1 and on day +1 gives § 4. On another run, day +1 has one wrong first tap in the first session and a perfect replay, and no bonus ever appears.
22. **Map peek in each world:**
    - Tap a locked stop two lands ahead → Emma: "Let's look at <its name>!" → 3 of that step's problems with their own visuals and chips.
    - Get one wrong three times → the given answer.
    - Closer → back on the Map with no line and nothing changed (the same current stop and trays). Then back to the Hub, where the card and its tray are unchanged.
23. At 375×667 portrait, 667×375 landscape and on a tablet, the peek's opener and closer captions are never clipped and never cover the chips. The fast-track bonus hole and the count badge don't overlap.
