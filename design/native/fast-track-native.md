# 2 secure days: the fast track for step mastery (native)

**Scope:** `@marian/core` (mastery rule, progress doc, session-end write, Session End guidance) and the native screens (`mobile/`). No server change. The web UI is frozen and never sends the new payload field, so the web never records a secure day (§ 3.5). Thomas chose this pacing change on 2026-10-14, after same-day review + daily warm-up (`design/native/review-mode-and-warmup-native.md`, built in #566). Layout conventions follow `design/native/greet-math-native.md`. Code is anchored by names, not line numbers.

**Status: provisional, not final until Dave's re-consult is folded in.** On 2026-10-14 Marian played for the first time. Thomas: "she was disappointed she can't try the next steps because it was too easy", in both worlds, and she was "mostly right but still counting on her fingers". His direction: "She wants to see what's in the game, but we should still keep track on her level." This spec covers only **progress**, meaning what counts toward mastery. **Explore**, seeing and trying later steps, is a separate concern that Dave is answering now. § 9 sets the boundary between them so either can change without the other. § 1.2 is open until Dave answers.

## Goal

If Marian gets every problem of a step right on the first tap, on two separate days (and in Number Garden answers each fact without counting it out), the step finishes on the second day. Today's flower and the rest of the tray fill at once.

## Research basis

- **Dave, consult 2026-10-14 (relayed by Matt, not in a file):** two "secure days" on separate days finish a step. Secure = 8/8 on the first tap, and on math-fact steps no fact at or over the slow-fact threshold (5 s or more for add-to-10, `design/research/speed-feedback-automaticity-marian.md:94`). A second secure day fills all the remaining flower slots. He rejected a same-day "show me" round because it measures performance, not retention. He rejected per-step placement tests. He wants the cvc-words novel-word gate kept, and `crossDayEnforcement` off is not a fast track. The number 2 is his judgement. Only "at least one sleep" has evidence. He expects it to fire rarely on math facts while she counts on her fingers.
- **Normal promotion stays accuracy-only.** `speed-feedback-automaticity-marian.md` Recommendation 7 says "Latency median is NOT a promotion gate". This spec keeps that: latency can only make the **shortcut** unavailable. It never delays the normal 3 good days.
- **No speed signal to the child** (same doc, Recommendation 1). Nothing on screen says "secure", "fast" or "quick", and nothing counts secure days (D9).

## User state entering

She opens a step's session. If it is her second secure day, she gets to Session End with 8 stars and one flower already on the tray from an earlier day. Before this change she would have seen "Two of three!" and "It sleeps tonight."

## 1. Decisions

### 1.1 Team calls

| #   | Call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Secure session:** all 8 scored problems right on the **first tap**. On a math problem that carries a fact, its first-tap latency is also valid and under the fact's ceiling (§ 2). Word Song has no latency check.                                                                                                                                                                                                                                                                                     |
| D2  | **Secure day:** a local calendar day on which the **first finished session on that step** (on that vowel, for per-vowel letter sounds) was secure. A later session the same day never makes the day secure. That is Dave's "same-day show me" rejection applied to replays: after a 7/8 morning, an 8/8 replay measures warm performance, not retention.                                                                                                                                                 |
| D3  | **Fast track:** a step with **2 secure days** (2 distinct local days, `FAST_TRACK_SECURE_DAYS = 2`) counts as having all its good days. It goes through the existing promotion path (`autoPromote`, `pendingPromotion`, unlock, celebration). No good-day date is invented: `goodDays` keeps only real days.                                                                                                                                                                                             |
| D4  | **What never counts:** warm-up hearts (they are outside the scored 8, #565 D4), reviews (they write no history, #565 D7), sessions quit before the end (they write nothing) and the guided give-answer (it isn't a first-tap right answer).                                                                                                                                                                                                                                                              |
| D5  | **Latency ceilings come from the existing slow-fact constants** in `slowFacts.ts`: `+` and `*` facts need under `SLOW_FACT_MIN_MEDIAN_LATENCY_MS` (5000 ms), and `−` facts under `SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB` (6000 ms). A `-1` latency (not measured) fails. The check covers every problem that carries a fact, which is add/sub to 10 and 20, both two-digit steps and the three multiplication steps. Number recognition and skip counting have no facts, so they check the first tap only. |
| D6  | **`crossDayEnforcement` off** does not change the fast track: it still needs 2 separate days. The parent's switch only loosens the normal rule (good sessions count one each, `goodDayCount`).                                                                                                                                                                                                                                                                                                           |
| D7  | **cvc-words keeps its novel-word gate.** After 2 secure days the step reads as "good days full, awaiting the novel-word check", the same state a 3rd good day reaches today. The graduation session then runs and decides.                                                                                                                                                                                                                                                                               |
| D8  | **Not retroactive.** Secure days are recorded at session end from the payload's first-tap array (§ 3.2), starting with the first session finished on the new build. History can't be re-scored: Word Song history keeps no first-tap data (`perProblemCorrect` there counts retries, § 2), and a math-only backfill would finish a step with no Session End moment.                                                                                                                                      |
| D9  | **No child-facing secure indicator.** There is no counter, no badge, no Hub line and no Map change. The fast track first becomes visible at the moment it fires, and Emma names the reason (§ 5).                                                                                                                                                                                                                                                                                                        |
| D10 | **One new Lily line**, on the fast-track day only, in place of "You got a flower!" (§ 5). Pending Thomas (T1).                                                                                                                                                                                                                                                                                                                                                                                           |

**Where it changes anything:** with the 3-day presets (88% / 3 default, 95% / 3) the fast track fires only when a step's first two good days are both secure. With the 80% / 2 preset, 2 secure days are also 2 good days, so the normal rule already masters the step and nothing changes. Every fast-track day therefore adds today's flower plus **one** extra flower (§ 4 still handles N).

### 1.2 For Thomas (provisional; Dave's re-consult may change them)

- **T1. The new line:** "You know this! All your flowers grew!" (§ 5). Team recommendation: approve it. Two flowers landing under "You got a flower!" would contradict what she sees, and an extra flower nobody explains reads as random rather than earned.
- **T2. No parent on/off switch for the fast track.** Each threshold description in Parent Settings gets one extra sentence. Math: "Two days with every answer right and quick on the first try also count." Word Song: "Two days with every answer right on the first try also count." Team recommendation: yes. Without the sentence the screen's "How many sessions … Marian needs" stops being true.

## 2. What a secure session is

New pure core module `packages/core/src/progress/fastTrack.ts`:

```ts
export const FAST_TRACK_SECURE_DAYS = 2
export const SESSION_PROBLEMS = 8
export function secureLatencyCeilingMs(op: '+' | '-' | '*'): number // D5
export interface SecureSessionInput {
  surface: 'math' | 'word-song'
  focusNode: SkillNode
  firstTapCorrect?: readonly boolean[] // the 8 scored problems
  latencyMs?: readonly number[] // math, the 8 scored problems
  mathFacts?: readonly MathFact[] // math, absent for no-fact plans
}
export function isSecureSession(input: SecureSessionInput): boolean
export function fastTrackQualifies(
  secure: readonly string[] | undefined,
): boolean // ≥ 2 distinct days
```

`isSecureSession` returns true only when:

1. `firstTapCorrect` has exactly 8 entries and every one is `true`.
2. **Math, fact step** (`CANON_MATH_FACTS[focusNode]` has a non-null entry): `mathFacts` and `latencyMs` both have 8 entries, and for every i, `latencyMs[i] !== -1 && latencyMs[i] < secureLatencyCeilingMs(mathFacts[i].op)`. If either array is missing, the session is not secure.
3. **Math, no-fact step** (`number-recog`, `skip-counting`) and **Word Song:** rule 1 alone.

**The first-tap source is new for Word Song.** `totalCorrect` counts any problem solved without the given answer, retries included, in both screens (`Math.tsx` and `WordSong.tsx`, `if (!warm) totalCorrectRef.current += 1`). So `successRate === 1` does **not** mean 8/8 on the first tap. Math's `perProblemCorrect` is first-tap already (set inside `firstTapRecordedRef`). Word Song's `perProblemCorrect` is set by `countsAsCorrect`, so retries count, and its first-tap array `firstTapCorrectRef` only reaches the payload for warm-ups. Hence a new explicit field (§ 3.2).

| Session                                                  | Can be secure?                        |
| -------------------------------------------------------- | ------------------------------------- |
| Forward session, first finished on that step today       | Yes, on its scored 8                  |
| Same session's warm-up hearts                            | No, they are never part of the check  |
| Second+ forward session on that step the same day        | No (D2)                               |
| Same-day review (#565)                                   | No, it writes no history              |
| cvc-words graduation session (5–6 canonical + 2–3 novel) | Judged on all 8, novel words included |
| CVC review (`focusMode: 'cvc-review'`), mastered step    | Not recorded (§ 3.2)                  |

## 3. Secure days and the fast track (data)

### 3.1 `Progress.secureDays`

`secureDays?: GoodDays` in `types.ts` uses the same type as `goodDays`: keys are a `SkillNode` or a letter-sounds vowel, values are sorted local `YYYY-MM-DD` keys, only ever added, capped oldest-first at `MAX_GOOD_DAYS_PER_STEP`. It is optional and additive, with no `schemaVersion` bump (same precedent as `goodDays`). Absent means no secure days.

### 3.2 Recording: `recordProgressOnSessionEnd` (`progressHistory.ts`)

- `RecordProgressInput.firstTapCorrect?: readonly boolean[]` (new).
- Day key `day = localDayKey(input.dateISO)`. Export the mastery rule's own `localDayKey` from `mastery.ts` so secure days and good days can never key a session differently.
- Before `applyMasteryRule`, for each key k of the session (the focus node, plus `currentTargetVowel` when a letter-sounds entry carries it, mirroring `recordGoodDays`), union `day` into `secureDays[k]` when all of these hold:
  1. `existing.skillLevels[focusNode] !== 'mastered'`
  2. **first finished on k today:** no entry in `existing.history` has `skillFocus` including the node (and, for a vowel key, the same `currentTargetVowel`) with `localDayKey(entry.dateISO) === day`
  3. `isSecureSession({ surface, focusNode, firstTapCorrect, latencyMs, mathFacts })`
- `recordReviewOnSessionEnd` stays as it is: it never writes secure days.

**Native plumbing:**

- `MathSessionResult.firstTapCorrect` = `perProblemCorrectRef.current.slice(w)`, the same first-tap array that `perProblemCorrect` already carries.
- `WordSongSessionResult.firstTapCorrect` = `firstTapCorrectRef.current.slice(w)`.
- `SessionEndPayload.firstTapCorrect?: readonly boolean[]` is mapped from both results in `sessionEndPayload.ts`.
- `writeSessionEnd` (`mobile/src/session/sessionEndWrite.ts`) forwards it on the forward path only.
- `perProblemCorrect` keeps its current meaning in both screens (Leitner, graduation split).

### 3.3 Mastery rule (`mastery.ts`)

- `goodDayCount(focused, threshold, settings, banked, secure?)`: compute as today, then `return fastTrackQualifies(secure) ? Math.max(count, threshold.sessions) : count`. This one floor reaches every consumer.
- Thread `secure` through `hasEnoughGoodDays` and `qualifies`, which reads `progress.secureDays?.[node]`. `scanPerVowelSubMastery` passes `secureDays?.[vowel]`, and `isGraduationSessionPending` passes `secureDays?.[node]`.
- Result: a practicing step with 2 secure days qualifies. cvc-words then becomes graduation-pending (D7), and the per-vowel letter-sounds rows fast-track one vowel at a time. The composite still needs all four vowels.
- `recordGoodDays` doesn't change. Only real good days are banked.

### 3.4 Display: `nodeProgress`, Hub, Map

- **`nodeProgress`** passes `secureDays` to every `goodDayCount` call (step and vowels). A fast-tracked step that isn't mastered yet (cvc-words awaiting its check, or `autoPromote` off) reports `goodDays === requiredDays`, and cvc-words reports `awaitingNovelWordCheck: true`.
- **Hub (`buildHubCardModel`):** no change. After a fast-track unlock, the current step is the next one with an empty tray, as after any unlock. `slotDays` / `earnedToday` keep reading real good days. In the rare full-but-not-mastered state, the Hub shows the last slot sleeping on the day itself, which today's cvc-words 3rd good day already does. Accepted as is.
- **Map (`mapModel`):** no change. Buds come from `nodeProgress`, so a fast-tracked step shows a full row and its unlock plays through `pendingUnlock` as usual.

### 3.5 Guard, sync, older docs, web

- **Guard (`isProgressV1`):** validate `secureDays` exactly like `goodDays`: it must be an object of string arrays, keys unchecked, absent allowed. Unknown keys don't reject a blob today, so an older build keeps loading a doc that has the field.
- **Cloud install (`installCloudBlob`):** `secureDays = unionGoodDays(cloud.secureDays, local.secureDays)`, threaded in as `localGoodDays` is, so a newer cloud blob never drops a local secure day. The session-end push carries the field unchanged.
- **Storage load:** no seeder. Absent = none (D8).
- **Web:** it shares core, so it honours synced `secureDays` in its displays. It never sends `firstTapCorrect`, so it never records one.

## 4. Session End on the fast-track day

### 4.1 Guidance model (`sessionEndGuidance.ts`)

- `newSlot` = `row.was` (today it is `row.now − 1`; the two are equal whenever exactly one flower lands, so every existing case is unchanged).
- New `bonusSlots: number[]` = `[row.was + 1, …, row.now − 1]`, which is empty unless the fast track fired. With the 3-day presets it is always one slot (§ 1.1).
- When `bonusSlots.length > 0`, the `flower` beat's line is `guide.end.fast-track` instead of `guide.end.flower`. Every other line is chosen as today. The row is full, so nothing sleeps.

| Fast-track step                               | `day`        | Lines                                               |
| --------------------------------------------- | ------------ | --------------------------------------------------- |
| Any step with a next step                     | `unlock`     | `right.8` → `fast-track` → `count.3` → `path-opens` |
| A world's last step                           | `world-done` | `right.8` → `fast-track` → `count.3` → `world-done` |
| cvc-words before its check, `autoPromote` off | `good-day`   | `right.8` → `fast-track` → `count.3`                |

`count.3` plays only when `required === 3`, as today.

### 4.2 Layout and sequence

No layout change: the tray is already sized for `required` holes in all four forms (`sessionEndLayout.ts`).

```
before         [ ✿  ○  ○ ]        ✿ grown, ○ empty
today's lands  [ ✿  ✿  ○ ]        flies into slot row.was, sparkle
bonus pops     [ ✿  ✿  ✿ ]  3 of 3!   grows in place, sparkle, then the badge
```

`SessionEndView` state: `landed` (today's flower) plus a new `bonusLanded` count from 0 to `bonusSlots.length`.

- **Slot i shows:** `slotsBefore[i]` until today's flower lands. After that it shows `slotsAfter[i]` when i is `newSlot` or one of the first `bonusLanded` entries of `bonusSlots`, and `slotsBefore[i]` otherwise. When nothing is bonus, this is today's `landed ? slotsAfter : slotsBefore`.
- **Pop:** `FlowerTray`'s `popSlot` becomes `popSlots: readonly number[]` = `landed ? [newSlot, ...bonusSlots] : []`. The `entering` animation only runs when a hole's flower view mounts, so each bonus hole pops at the moment it turns grown.
- **`CountBadge`** mounts when `landed && bonusLanded === bonusSlots.length`, so "3 of 3!" never shows over an empty hole.

## 5. Copy / TTS script

**New line** (pending T1), added to `GUIDANCE_LINES` (`packages/core/src/emmasPath/guidanceLines.ts`) with the new kind `'end-fast-track'`:

| ID                     | Text                                    | When                                                                   |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `guide.end.fast-track` | "You know this! All your flowers grew!" | The `flower` beat on a fast-track day, in place of "You got a flower!" |

- **File:** `/assets/audio/path/guide-end-fast-track.mp3` (`pathLineSrc`).
- **Clip length:** after the render, add the ffprobe length to `END_CLIP_SECONDS`. Until then `captionSeconds` floors it at 4 s.
- **Vocabulary:** no new words. "know" and "this" are in the approved "Remember this one?" / "the ones you know" lines (#565). "all", "your", "flowers" and "grew" are already in `GUIDANCE_LINES` ("You grew your whole garden!", "Your flowers woke up!"). This was checked with a word scan of `guidanceLines.ts`, `pathLines.ts` and `public/canon/*/level-1/*.json`, 2026-10-14.
- **Why this wording:** it names the cause (she knows it), not speed. It is count-free, so it stays true for any preset, and it stays true for cvc-words, where the row is full but the step waits for its check.
- **Reused unchanged:** "Eight right! You worked hard!", "Three of three!", "A new path opens. Look!", "You grew your whole garden!".

## 6. Motion

All times are measured from the start of the `fast-track` line. That line takes the place of "You got a flower!", so today's flower runs on the existing timers.

| t (ms)               | What                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                    | Today's flower pops in at the panel centre (`NewFlower`, spring 300/14, unchanged).                                                                  |
| 650 / 1450           | It flies (`FLOWER_FLY_AT_MS`), then lands in `newSlot` with the sparkle and the 350 ms hole pop (`FLOWER_LAND_AT_MS`, `HOLE_POP_MS`).                |
| 1450 + 500 × (k + 1) | Bonus k grows in place: the existing `holePopEntering` (scale 0.7 → 1, 350 ms, ease-out) plus `sfx.sparkle`. No flight. `BONUS_FLOWER_GAP_MS = 500`. |
| last bonus           | `CountBadge` springs in (unchanged spring 320/16).                                                                                                   |
| line end + 300       | "Three of three!" (`BEAT_GAP_MS`).                                                                                                                   |

- **Why no flight:** today's flower is the one she played for, so it flies. The bonus grows where it sits, so the two read as different things.
- **Timing check:** the bonus lands at 1950 ms, about when "All your flowers grew!" starts. The prediction is a clip of roughly 2.9–3.5 s, so the bonus always lands inside the line.
- **Reduce Motion:** today's flower is in its slot at `FLOWER_REDUCED_LAND_MS` (300). Bonus k fades in (`FadeIn` 200 ms) at 300 + 400 × (k + 1). There is no sparkle, as the reduced branch has none today.
- **Cancelled / unmounted:** every timer goes through `addTimer`, so the existing cleanup clears it. Nothing loops.

## 7. States and edge cases

- **Happy path:** day 1 first session 8/8, fast → "One of three!", sleeping. Day 2 first session 8/8, fast → § 4 (both flowers, unlock).
- **Error path:** unchanged per problem: a wrong tap gets the puzzled tilt, the poof and a retry. A single wrong first tap, or one fact at or over its ceiling, makes the session simply not secure. Nothing on screen says so (D9), and the day is a normal good day if it reaches 7/8.
- **Same day, after a 7/8 first session:** a replay is a review when the review pool has steps (#565), otherwise same-step practice. Neither can make the day secure (D2).
- **Secure, bad, secure** (Mon 8/8, Tue 5/8, Wed 8/8): 2 good days plus the fast track gives a full row on Wednesday. Order doesn't matter, as with good days.
- **First two good days not both secure:** the 3rd good day masters the step normally, with no bonus.
- **Quit mid-session:** nothing is recorded. The next finished session is the "first finished" one that day.
- **Session across midnight:** native stamps `dateISO` at session end, so the day key, the first-of-day check and the good day all use that day.
- **`crossDayEnforcement` off:** D6. Its normal rule may master first; the fast track never makes it slower.
- **`autoPromote` off:** the qualifying step is queued in `pendingPromotion` as today, and the tray shows full (§ 3.4).
- **Parent changes the preset later:** secure days persist, and the floor moves to the new `sessions`.
- **Letter sounds, per vowel:** each vowel row fast-tracks on its own (keys per § 3.2). Session End's `rowOf` already picks the session's vowel.
- **Older doc / older build / cloud:** § 3.5.
- **A synced secure day finishing a step in the other world:** the next `applyMasteryRule` promotes it, and the map plays its unlock. That needs a second device; Marian has one iPad.

## 8. Assets required

- **New:** the § 5 line, rendered with `scripts/renderGuidanceLinesLily.ts` once T1 is approved, exported via `npm run export-audio` in `mobile/` (regenerates `audioRegistry.ts`), and added to the guide list in `public/voice-qa.html`. Thomas ear-tests it there before the native build ships. **Prediction for the soak:** about 3.1 s, with a clear pause after "this!". It shouldn't trip the renderer's 3.5 s flag, but it may.
- **Reused:** the open-bud art, the hole pop, `sfx.sparkle`, `NewFlower` and `CountBadge`. No new pose, background, icon or SFX.

## 9. Explore vs progress (the explore part is pending Dave)

Thomas's requirement has two halves. She can see and try later steps (**explore**), and her level stays tracked as now (**progress**). Dave is answering how an explore visit should work, including whether a re-placement check belongs here, since the April baseline is 6 months old. This spec doesn't design explore. It fixes the boundary between the two.

**Progress** is everything the mastery rule reads or writes: `skillLevels`, `goodDays`, `secureDays`, the `progress.history` entries it filters by `skillFocus`, `pendingPromotion`, `unlocksCelebrated` and the Leitner box. Today only a finished forward session on the current step writes these. A review writes only Leitner and `lastPlayedISO` (#565 § 7.6).

**Boundary contract for any explore surface added later:**

1. An explore visit writes **nothing** the mastery rule reads, by default. That means no history entry whose `skillFocus` names the explored step, no good or secure day, no unlock, no `unlocksCelebrated` change and no Leitner outcome. After an explore visit, `currentStepOf`, the Hub tray and the Map are unchanged.
2. If Dave says an explore or placement result **should** count, that is a separate, named progress path (for example, banking a secure day on the explored step through `isSecureSession` + `secureDays`). It is never a side effect of the explore screen.
3. The fast track stays a progress rule. It never reads explore data, and nothing in it depends on explore existing.

**Seams this spec leaves open for that work:**

- `isSecureSession` is pure and keyed by step, so a placement-style check can reuse the same "secure" definition.
- `secureDays` is keyed by step, so a second path can bank days on a step that isn't the Hub's current one.
- `bonusSlots` handles any number of slots, so a step finished from an earlier state renders through the same Session End sequence.
- Nothing here touches the Hub padlock, the map gates or the focus picker, so a "try the next step" entry point is additive.

## 10. Acceptance criteria

**Core (vitest):**

1. `isSecureSession`, Word Song: 8 × `true` is secure. Any `false` is not. 7 or 9 entries are not. A missing `firstTapCorrect` is not.
2. `isSecureSession`, math:
   - add-to-10 with 8 × `true` and latencies 4999 is secure.
   - One latency of 5000 is not, and one `-1` is not.
   - sub-to-10 with 5999 is secure, and 6000 is not.
   - mult-2-5-10 with 4999 is secure.
   - skip-counting with no `mathFacts` and 8 × `true` is secure.
   - add-to-10 with `mathFacts` missing is not.
3. `recordProgressOnSessionEnd`:
   - The first secure session on add-to-10 today adds today to `secureDays['add-to-10']`.
   - After a finished 7/8 session on that step today, an 8/8 one adds nothing.
   - A session on a `'mastered'` step adds nothing.
   - A letter-sounds entry tagged `/o/` adds today under both `'letter-sounds'` and `'/o/'`.
4. **Fast track at defaults (88% / 3):** secure sessions finished on Monday and Tuesday (first of each day) leave `add-to-10` at `'mastered'`, `add-to-20` at `'intro'` and `pendingPromotion === 'add-to-10'`. `goodDays['add-to-10']` holds exactly those 2 days.
5. **Not fast-tracked:**
   - Monday secure, then a Tuesday first session at 7/8 and a second at 8/8: `add-to-10` stays `'practicing'`.
   - With `crossDayEnforcement` off, two 8/8 sessions on Monday: not mastered, and `secureDays` holds 1 day.
6. **cvc-words, 2 secure days:** it stays `'practicing'`, `isGraduationSessionPending` is true, and `nodeProgress` has `goodDays` 3 and `awaitingNovelWordCheck` true. A graduation entry with canonical ≥ 7/8 and novel ≥ 0.8 then masters it.
7. With `autoPromote` off, 2 secure days set `pendingPromotion` without changing `skillLevels`, and `nodeProgress(...).goodDays === requiredDays`.
8. `sessionEndGuidance`, fast-track Tuesday:
   - `newSlot` 1, `bonusSlots` [2].
   - `slotsBefore` [grown, empty, empty], `slotsAfter` [grown, grown, grown], `countText` "3 of 3!".
   - Line ids `right.8`, `fast-track`, `count.3`, `path-opens`; `day` `'unlock'`.
   - A normal 2nd good day is unchanged: `newSlot` 1, `bonusSlots` [], `guide.end.flower`.
9. On the 80% / 2 preset, 2 secure days master through the normal rule and `bonusSlots` is [].
10. `isProgressV1` accepts `secureDays` of string arrays and rejects a non-array value. A cloud install unions local and cloud `secureDays`.
11. `GUIDANCE_LINES` holds `guide.end.fast-track` with the § 5 text and `pathLineSrc` file.

**Native (jest):**

12. Math and Word Song results carry `firstTapCorrect` for the 8 scored problems, with warm-ups left out. A Word Song problem solved after a wrong tap has `firstTapCorrect` false and `perProblemCorrect` true. `writeSessionEnd` forwards the field, and a review end never writes `secureDays`.
13. **Session End, fast-track day:**
    - The tray goes `session-end-slot-grown` ×1 → ×2 at 1450 ms → ×3 at 1950 ms. The sparkle plays twice.
    - The count badge mounts only after the third hole.
    - The captions run in the § 4.1 order, and the panel `nativeID` starts with `unlock:`.
14. Reduce Motion: no flight and no sparkle. Today's hole is grown at 300 ms and the bonus at 700 ms.

**Device (Expo Go, defaults or `EXPO_PUBLIC_QA_STEP`, with `EXPO_PUBLIC_DAY_OFFSET` stepping days):**

15. **Number Garden at defaults (add-to-10):**
    - Day 1: answer all 8 right on the first tap, each within ~3 s → "One of three!".
    - Offset +1: the first session the same way. Today's flower flies to hole 2 and hole 3 grows about half a second later.
    - Emma says the four § 4.1 lines in order, and "3 of 3!" never shows over an empty hole. All done → the map plays the add-to-20 unlock.
16. Same setup, but on day 2 wait about 6 s before one answer: the normal end ("You got a flower!", "Two of three!", "It sleeps tonight…").
17. Word Song (`EXPO_PUBLIC_QA_STEP=blending-cv`): 8/8 on the first tap on day 1 and on day +1 gives the § 4 end. On another run, day +1 has one wrong first tap in the first session and a perfect replay: no bonus appears at any point.
18. At 375×667 portrait, 667×375 landscape and on a tablet, the bonus hole pops inside the tray and the count badge doesn't overlap a hole or the caption.
