# Same-day mixed review + return warm-up (native)

**Scope:** the native app (`mobile/`), `@marian/core`, and one new branch in `/api/claude`. The web UI is frozen and never sends the new request fields, so the web is unchanged. Thomas approved both changes by popup on 2026-10-14, after Dave's research consult: keep the overnight gap, and fill the idle same-day time (Change 1, Dave's #1, "review") and warm up after days away (Change 2, Dave's #3, "warm-up"). Conventions follow `design/native/greet-math-native.md`: the 375×667 / 667×375 phone floor, and tablet = shorter side ≥ 600 pt. Code is anchored by names, not line numbers (`.claude/docs/screens-and-flows.md` § Math, spec-authoring convention).

## Goal

Once today's flower is asleep, playing that world again gives Marian a calm mix of 8 problems from steps she already knows, with no flower and no bonus. The first session after a missed day opens with 2 "Remember this one?" problems, and they never count against today's flower.

## Research basis

- **Taylor & Rohrer 2010:** mixed (interleaved) practice roughly doubled children's next-day scores compared with blocked practice. So a review mixes the mastered steps.
- **Rohrer & Taylor 2006:** extra practice in the same session (overlearning) showed no retention benefit. So a same-day replay switches to review instead of more of the current step, and the overnight gap stays.
- **Deci, Koestner & Ryan 1999:** expected tangible rewards undermine intrinsic motivation. So a review gives no flower and no bonus stardust, only the normal per-answer stars.
- **Dave, `design/research/leitner-interval-tuning-marian.md` §6:** at most 2–3 overdue Leitner items per session (`LEITNER_DUE_PER_SESSION_CAP = 3`, `packages/core/src/progress/leitner.ts`). The warm-up's facts count against that cap (§ 7.4).

## User state entering

- **Review:** she has already earned today's flower in this world. The Hub card shows it asleep (closed bud, moon, z), and she taps that card again. Often she has just heard `guide.hub.both-sleeping`, "Both flowers are sleeping. Want to practise more?"
- **Warm-up:** she hasn't played this world for at least one whole calendar day. She may have just heard "Your flower woke up!" on the Hub.

## 1. Decisions

| #   | Call                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **A review runs when** the world's Hub card has `earnedToday && !complete` (`buildHubCardModel`) **and** its review pool is not empty. Otherwise the replay stays today's same-step practice.                                                                                                                                                                   |
| D2  | **Baseline steps are never reviewed or warmed up.** Baseline = the steps that are `'mastered'` in `defaultProgress()` (today `number-recog` and `letter-names`, from the diagnostic). Computed from the defaults, not hardcoded.                                                                                                                                |
| D3  | **There is no new Hub card state, and the Map doesn't change.** The sleeping bud already says "today's flower is done", and a review badge would be a new symbol and a "more here" lure. A review shows that it is a review inside the session: Emma's opener line and a moon at the start of the bead track. Its Session End is the approved practice-day end. |
| D4  | **Warm-up:** 2 problems (never more than 3), never from the current step. They show as hearts in the bead track, and "Remember this one?" plays before each. They are left out of the score, the streak and the flower. Leitner promote and demote do apply.                                                                                                    |
| D5  | **Days away** = whole calendar days with no session in that world. A warm-up runs when the world's last session was **before yesterday**. Daily play never triggers it (§ 7.3).                                                                                                                                                                                 |
| D6  | **Problems are canon blocks.** Core picks `(step, problem 1–8)` references, and the server copies those blocks out of the canon files **with their own baked audio**. There is no planner call, no TTS and no credits.                                                                                                                                          |
| D7  | **A review appends no `progress.history` entry.** No rule can then count it toward a good day (§ 7.6).                                                                                                                                                                                                                                                          |
| D8  | **There are two new Lily lines.** Everything else reuses approved lines (§ 4).                                                                                                                                                                                                                                                                                  |

**Dormant for the default profile:** with Marian's defaults, the only mastered steps are the baseline steps. So both changes stay off until she masters `add-to-10` (Number Garden) or `letter-sounds` (Word Song). QA uses `qaStep` (§ 9).

## 2. Which session runs

When a Hub card is tapped (and in the Hub prefetch), the session controller calls core's `sessionPlanKind(progress, world, nowMs, today, seed)`:

```
if isReviewSession(progress, world, today):            // D1
    blocks = pickReviewBlocks(progress, world, nowMs, seed)   // 8 refs
    if blocks.length === 8 → { kind: 'review', blocks }
→ { kind: 'forward', warmup: pickWarmupBlocks(progress, world, nowMs, today, seed) }  // 0–2 refs
```

- `seed` = `readSessionHistory().sessionCount` at kick time. It rises every session, reviews included, so back-to-back reviews draw different blocks.
- A review and a warm-up never meet. A review needs a good day today, so `daysAway` is −1 at that point, and a warm-up needs `daysAway ≥ 1`.
- **Complete world** (every step mastered): there is no sleeping flower, so behaviour is unchanged (the forward picker's last step, or the CVC review in `pickCvcReviewNode`).
- **Parent switched `crossDayEnforcement` off:** nothing sleeps (`buildHubCardModel`), so reviews never run. Warm-ups still do.

## 3. Visual layout

### 3.1 Hub, Map, Session End: no layout change

- **Hub (all forms):** no change to the card, the glow or the lines. A sleeping card stays a full-size door. A tap starts a review (D1), or same-step practice as today. The prefetch for the suggested world (`null` → Word Song, `hub-native.md` § 5) asks for whatever `sessionPlanKind` returns.
- **Map:** no change. The Map never starts a session, and its buds are binary (open per good day, `emmas-path-spec.md` §3.4). They don't show the sleeping state, and this spec leaves that as it is.
- **Session End after a review:** this is the existing `'practice'` day of `sessionEndGuidance`, laid out as today by `sessionEndLayout.ts` in all four forms. The panel shows the stars (`totalCorrect` of the review's 8), the **current step's** picture and its flower tray with today's flower **sleeping** (moon + z). There is no new flower and no count badge. Emma says one line, "You practised hard! Good work!". The only button is "All done", which goes to the Hub. The sleeping bud on the tray answers "where is my flower?" with the same picture the Hub uses.
- **Session End after a warm-up session:** this is the normal forward end, scored on the 8 forward problems only. The warm-up is not mentioned.

### 3.2 Bead track (Math and Word Song share `MathHud`)

```
Forward (today)    [ ● ● ● ○ ○ ○ ○ ○ ]
Review             [ ☾  ● ● ● ○ ○ ○ ○ ○ ]        ☾ = MoonIcon, static
Warm-up            [ ♥ ♥    ● ○ ○ ○ ○ ○ ○ ○ ]     ♥ = heart beads, then a double gap
```

- **Moon (review):** `MoonIcon` (`mobile/src/screens/sessionEnd/glyphs.tsx`, the Hub's sleeping-bud moon) at `size = bead.current`, so 16 pt on a phone and 24 on a tablet. It is the track's first child, one `beadGap` before bead 1, and has no animation. It reads as "your flower is sleeping; this round is extra".
- **Hearts (warm-up):** the first `warmupCount` beads are hearts, in the same box sizes and states as the circle beads (`bead.upcoming / completed / current`: 12/14/16 phone, 18/22/24 tablet, the same 200 ms size ease). Draw each with react-native-svg, viewBox 24: `M12 21.2C12 21.2 2.5 15.4 2.5 9.1C2.5 6.1 4.9 3.8 7.8 3.8C9.6 3.8 11.1 4.7 12 6.1C12.9 4.7 14.4 3.8 16.2 3.8C19.1 3.8 21.5 6.1 21.5 9.1C21.5 15.4 12 21.2 12 21.2Z`. Fill and stroke (stroke width 1.5 viewBox units): upcoming `#e6d2c0` / `#cdb39d`, current `#ff8fb1` / `#c2456f`, completed `#ffd54a` / `#c98a1f`, the circle beads' fills. The gap after the last heart is `2 × beadGap`.
- **testIDs:** `${idPrefix}-review-moon` and `${idPrefix}-warmup-dot-${state}`. The scored beads keep `${idPrefix}-problem-dot-${state}`. The track stays hidden from accessibility.
- **Placement is unchanged per form:** tablet one row (back, stardust, beads, streak); phone portrait on its own centred row (`beads` rect = safe width − 32, 343 pt at the floor); phone landscape at the left of the pane's HUD row, with the status cluster on the right.

Worst-case track width (all beads completed except the last one current, plus the track padding):

| Track   | Phone (pt) | Tablet (pt) |
| ------- | ---------- | ----------- |
| Forward | 172        | 258         |
| Review  | 194        | 290         |
| Warm-up | 218        | 326         |

**Tight form:** phone landscape with a skip-count or multiply problem uses the chip-column frame. Its HUD row is `chipX − 16 − paneX` = 371 pt at 667×375 (`extendedMathLayout`). The stardust pill plus the streak is _estimated_ at ~150 pt (not measured), so a warm-up track can touch it. Rule: on a phone, if `trackWidth + statusWidth + 12 > row.width`, `beadGap` drops from 6 to 4 for that track. That saves 20 pt on a warm-up track.

### 3.3 Review opener: the stage starts empty

During the review opener (§ 4) the screen shows the HUD, Emma and the caption ribbon, but **no problem stage and no chips**. The equation, visual row, number strip, skip track, groups and chips in Math, and the card and chips in Word Song, mount at the opener's end and fade in (§ 5). This keeps a wrapped opener caption off problem 1 in every form. In phone landscape the arithmetic frame may fall back to a 1-line ribbon slot, and the opener will need 2 lines there. Estimated wraps at 22 pt: phone portrait about 3 lines in the ~231 pt inner ribbon (its `maxHeight` holds 4); phone landscape 2 lines; tablet 1–2 lines. These are estimates, and AC 15 checks them.

The warm-up line "Remember this one?" (18 characters) fits one line in every form, and **the stage stays visible** while it plays, because "this one" points at the problem on screen.

### 3.4 One frame per problem (mixed plans)

Today App sizes Math from the plan's **first** problem (`mathKind` = `mathState.plan?.problems[0]?.kind` → `extendedMathLayout`). Reviews and warm-ups mix kinds, so Math reports the **current** problem's kind (`onProblemKindChange(kind)`), and App lays out from it. The frame only differs in phone landscape (chip row ↔ chip column). When it switches, Emma springs to her new frame with EmmaStage's existing layout spring (220/22), and the next problem mounts in the new frame. Forward sessions have a single kind and don't change.

## 4. Copy / TTS script

**New lines** (they go in `GUIDANCE_LINES`, `packages/core/src/emmasPath/guidanceLines.ts`, with new kinds `'session-review'` and `'session-warmup'`):

| ID                     | Text                                                     | When                                                                                                                       |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `guide.session.review` | "Your flower is sleeping. Let's play the ones you know!" | Once per review, where problem 1's read-aloud would start today: after the review plan settles and the screen has entered. |
| `guide.session.warmup` | "Remember this one?"                                     | Before each warm-up problem's read line (so at most twice per session).                                                    |

- The files are `/assets/audio/path/guide-session-review.mp3` and `guide-session-warmup.mp3` (`pathLineSrc`). They play through `createManifestLinePlayer('session-guide', …)` with word ticks into the ribbon. The player never rejects, and without a clip it walks the caption at 165 wpm.
- **Timing:** the line ends → 400 ms → the read line starts. The chips still open on the read line's `onPlay` (the existing tap gate). The back button cancels the line (`cancelActive()`) and exits as today.
- **Emma's pose** during either line is the read-aloud pose (`listening`).
- **Vocabulary:** every word already occurs in `public/canon` or the guidance lines except **know** and **remember** ("ones" is the plural of "one"; checked with a word scan of `public/canon/*/level-1/*.json`, 2026-10-14). Both are everyday words.

**Reused, unchanged:**

- Hub: `guide.hub.both-sleeping` "Both flowers are sleeping. Want to practise more?", `guide.hub.sleeping.math` "Your flower is sleeping. Let's play Number Garden!", `guide.hub.sleeping.word-song` "Your flower is sleeping. Let's play Word Song!", `guide.hub.woke` "Your flowers woke up!", `guide.hub.woke.one` "Your flower woke up!".
- Session End after a review: `guide.end.not-yet.praise` "You practised hard! Good work!".
- Every problem line (read, correct, reprompt, hints, giveAnswer, blend) is copied with its canon audio from the block's own canon file (for example add-to-10 `math.p1.read` "One plus two. How many?", `math.p1.reprompt` "Hmm... try again?").

No other line is added. There is no transition line between the warm-up and problem 1, because the beads carry that switch. A review's Session End deliberately doesn't repeat "It sleeps tonight. Come back tomorrow for one more." She heard it once already today, and a review shouldn't push tomorrow.

## 5. Motion

- **Stage fade-in after the opener:** opacity 0 → 1, 200 ms, `Easing.bezier(0, 0, 0.58, 1)` (the HUD's `EASE_OUT`), starting at the opener's end. Problem 1's read starts 400 ms after the opener's end.
- **Hearts:** the same 200 ms size ease as `Bead`. The moon is static.
- **Frame switch (phone landscape, § 3.4):** the existing EmmaStage spring (220/22). No new animation.
- **Reduce Motion:** the stage appears at full opacity at the opener's end. Nothing else changes, and this spec adds no loops.

## 6. States

- **Idle / happy / error:** as today, per problem. Right: sparkle, plink, `celebration`, "Yes! …". Wrong: poof, shake, `puzzled-tilt`, "Hmm... try again?", the hint at 2 wrongs and the given answer at 3. Never a red X. This holds for review and warm-up problems too.
- **Stars and bonuses:**
  - **Math review:** +1 stardust per right answer, as today. The streak still counts and chimes at 3 / 5 / 8, but its **+1 grants are off**.
  - **Word Song review:** no +5 completion bonus. Word Song gives no stardust in-session (`WordSong.tsx` header), so a Word Song review earns none.
  - **Warm-up problems:** +1 stardust per right answer in Math. They never change the streak (`streakRef`), `totalCorrect` or the scored per-problem arrays.
- **Review request fails** (network error, invalid response, or a `plan.id` that doesn't start with `review-`): there is no opener and no moon. The session runs the static plan for the current step, which is today's same-step practice, and records as a forward session.
- **Warm-up blocks missing** (old server, a block that can't be served or parsed, a duplicate): the session starts at scored problem 1 with 0–1 hearts. The warm-up never delays the session beyond the forward plan's own readiness.
- **Fallbacks (D1, D2):** with an empty pool, the replay is today's same-step practice (`'practice'` end). With no warm-up material, there are no hearts.
- **First ever review / warm-up:** the same as every later one. No tutorial line, and the flow is predictable.
- **Quit mid-session** (back): nothing is recorded, as today. A warm-up quit leaves the next session still "first of the day", so it warms up again.
- **Midnight rollover during a review:** Session End computes the new day, so the `'practice'` branch no longer applies. She gets the not-yet end ("You practised hard! Good work!" and, once a day, "Play again to get today's flower."). That is correct, because a new flower can be earned.
- **Transitions:** these are the existing Hub → session → Session End → Hub routes. A review can't trigger an unlock, so "All done" always goes to the Hub.

## 7. Data contract

### 7.1 Core: `packages/core/src/progress/reviewPlan.ts` (new)

```ts
export const REVIEW_PROBLEMS = 8
export const WARMUP_PROBLEMS = 2
export const WARMUP_MAX = 3 // wire cap, never exceeded
export interface CanonBlockRef {
  node: SkillNode
  problem: number
} // problem 1..8

export function reviewBaseline(): ReadonlySet<SkillNode> // mastered in defaultProgress()
export function reviewPool(p: Progress, world: MasteryTrack): SkillNode[] // mastered ∖ baseline, tree order; [] when complete
export function isReviewSession(p, world, today: string): boolean // D1
export function pickReviewBlocks(
  p,
  world,
  nowMs: number,
  seed: number,
): CanonBlockRef[]
export function daysAway(p, world, today: string): number | null // § 7.3
export function pickWarmupBlocks(p, world, nowMs, today, seed): CanonBlockRef[] // 0..2
export type SessionPlanKind =
  | { kind: 'review'; blocks: CanonBlockRef[] }
  | { kind: 'forward'; warmup: CanonBlockRef[] }
export function sessionPlanKind(p, world, nowMs, today, seed): SessionPlanKind
```

**`CANON_MATH_FACTS`** (`packages/core/src/progress/canonMathFacts.generated.ts`): `Record<NumberGardenNode, readonly (MathFact | null)[]>`, with 8 entries per step in canon problem order. It is `null` for number-recognition and skip-count problems, `{a, b, op}` otherwise, and `2*3` ≠ `3*2`, as in `sessionEndPayload.ts`. It is generated by `scripts/generateCanonMathFacts.ts` from `public/canon/math/level-1/*.json`, using `canonFileTierFor`'s file mapping (`two-digit-addsub-no-regroup` → `two-digit-addsub.json`) and `mathSessionPlanFromServer(plan, { extendedKinds: true })`. A vitest re-derives it from the canon files and fails on drift. Why this lives client-side: `api/` can only import import-free `packages/core/src/wire/*` modules (the ESM `.js`-suffix constraint noted in `api/_types.ts`). So the choices stay in core, and the server only copies blocks. Drift can only mis-pick a block. The Leitner outcome always uses the fact parsed from the block on screen.

### 7.2 Choosing blocks

Definitions:

- `P = reviewPool(p, world)` and `S = reverse(P)`, so the most recently mastered step comes first. `R = P[P.length − 1]` is the most recently mastered step. Mastery follows tree order, and the current step is the first one not mastered.
- `rot(seed) = [((seed + i) % 8) + 1 for i = 0..7]`.
- `overdueMs(item) = nowMs − item.lastSeen − LEITNER_REVIEW_INTERVAL_DAYS[item.box] × 86 400 000`. An item is due when this is ≥ 0, the same rule as `dueLeitnerItems`. **Rank** = `overdueMs` descending, then box ascending, then the key `${a}${op}${b}` ascending.
- `blockFor(fact)` = for the first step in `S` whose `CANON_MATH_FACTS[step]` contains `fact` at index j: `{ node: step, problem: j + 1 }`. If no step has it, `null`.

**`pickReviewBlocks`** returns 8 refs, or `[]` when `P` is empty:

1. **Math only, due facts first:** take the box's **due** items in rank order, map each through `blockFor`, and keep up to `LEITNER_DUE_PER_SESSION_CAP` (3) distinct facts.
2. **Fill:** go round-robin over `S`. Each step offers its next index from `rot(seed)`. Skip a ref that is already picked, or (Math) one whose fact equals a picked fact. Stop at 8. A step that runs out drops out.
3. **Order:** group the picks by step, with due picks first inside each group, then emit by cycling `S`, one from each non-empty group per cycle. With 2 or more steps, adjacent problems come from different steps whenever possible. With one step, all 8 come from it, which is still a review of an older step.

**`pickWarmupBlocks`** returns 0–2 refs. It returns `[]` unless `daysAway ≥ 1` and `P` is non-empty (D4, D5):

- **Math:** take **all** box items in rank order ("most overdue", so not-yet-due items count when there are fewer than 2 due). Map each through `blockFor` and take the first 2 distinct. Fill any shortfall from `R` in `rot(seed)` order, skipping duplicates.
- **Word Song:** the first 2 of `rot(seed)` from `R`.

Example: `P = [add-to-10, add-to-20]`, seed 5, nothing due. `S = [add-to-20, add-to-10]` and `rot(5) = [6,7,8,1,2,3,4,5]`. The review is add-to-20 #6, add-to-10 #6, add-to-20 #7, add-to-10 #7, add-to-20 #8, add-to-10 #8, add-to-20 #1, add-to-10 #1, with any add-to-10 block whose fact add-to-20 already supplied skipped.

### 7.3 Days away

```
lastDay  = max over progress.history entries whose skillFocus has a step of `world`
           of localDayKey(entry.dateISO)          // the mastery rule's local-day key
daysAway = lastDay === null ? null : diffDays(lastDay, today) − 1
diffDays = (Date.UTC(today) − Date.UTC(lastDay)) / 86 400 000   // YYYY-MM-DD parsed as UTC dates
```

- Mon → Tue: 0, no warm-up. Mon → Wed: 1, warm-up. Played earlier today: −1, no warm-up.
- `today` = `todayKey()` (`progress/clock`, which honours the debug day offset).
- This is per world, because the gap that matters is since she last practised that material.
- `null` (never played this world, or its last entry aged out of the 30-entry history) means no warm-up.
- Reviews write no history (D7), but a review day always has that world's forward entry, so days away is unaffected.

### 7.4 Wire and server

**Wire** (`packages/core/src/wire/types.ts`, kept import-free): `export interface CanonBlockRef { node: string; problem: number }`. Two optional fields on the session-start track payload:

- `review?: { blocks: CanonBlockRef[] }`: exactly 8 refs.
- `warmup?: { blocks: CanonBlockRef[] }`: 1–`WARMUP_MAX` refs.

**Server** (`api/_review.ts`, new, wired into `api/claude.ts`'s session-start track branch):

- **`review` present:** this runs as **step 0**, before the canon lookup, the session cache and the rate limiter, and it ignores every other progress hint.
  - Validate: exactly 8 refs, each `node` a step of `track`, each `problem` an integer 1–8.
  - Load each block through `getCanonEntry({ track, level: 1, focusNode: node })`. Copy every utterance whose id starts with `<ns>.p<problem>.` (`<ns>` = `math` | `word`), from both `plan.utterances` and `utterances`, and rename it `<ns>.p<i>.` with i = the ref's position 1–8.
  - Return `{ ok: true, kind: 'session-start', plan: { id: 'review-<track>', label: 'Review', utterances }, utterances }`.
  - This makes no Anthropic call, no TTS and no cache write. An invalid ref or a missing entry returns 400 `{ error: 'invalid-request' }`.
- **`warmup` present:** after the forward response comes from any branch (canon, cache or live), append the refs' blocks to **a copy** of it as `<ns>.w<i>.<slot>` (i = 1–n), in both arrays.
  - Skip a ref that can't be served. A malformed `warmup` is ignored.
  - Never mutate the module-cached canon entry, and never store the appended response in the session cache.
  - The existing parsers skip `w` ids, because their regexes are anchored on `p<N>`.
- **Why copy the blocks** instead of sending a composed `payload.plan`: that path reuses canon audio keyed by `renderElevenLabsText(text, undefined)`. Letter-sounds and simple-sentence lines are keyed with their tier (`getCanonAudioIndex`), so they would miss the canon and render live through ElevenLabs. That would cost credits and could use the wrong phonemes.
- **Ship order:** the API change has to be released (`yarn release`) before the native build is device-checked. An old server ignores `review` (its `plan.id` won't start with `review-`, which falls back per § 6) and ignores `warmup` (no hearts).

**Client:**

- **Review:** the snapshot is `kind: 'review'` only if `plan.id` starts with `review-` and the plan parses to 8 problems. Otherwise it is a failure (§ 6). There are no Leitner or slow-fact hints, so the 5 s hinted-request fallback never applies.
- **Warm-up refs** ride on the forward request, including its hint-free 5 s fallback request.
- **Warm-up parse:** new core functions `mathWarmupFromServer(plan)` / `wordSongWarmupFromServer(plan)` read `<ns>.w<N>.<slot>` with the `p` parsers' slot sets and per-problem builders. A block that fails to parse is dropped. Then drop any warm-up problem whose fact (Math) or target word (Word Song) equals one of the forward problems'.
- **Forward Leitner hint on a math warm-up day:** remove the warm-up facts from the due box before `leitnerBoxForFocus`. Then call `buildLeitnerSessionHint(box, LEITNER_DUE_PER_SESSION_CAP − warmupFactCount)`. The session's overdue items stay ≤ 3.
- **Prefetch key:** `mode: 'review'` for a review, `` `${focusMode}+warmup` `` when the warm-up refs are non-empty.

**Screens** (Math, and Word Song where it applies):

- `review: boolean`: the opener, the moon, and no streak +1 grants (Math).
- `warmupCount: number` (0–2): the first `warmupCount` problems of the round are the warm-up.
- `problemNodes: readonly SkillNode[]`: each problem's source step. `buildChipOrder` uses it in place of `focusNode`. `planMaxAnswer` / `multiplyChipCeiling` are computed per source step. The subitising scaffolds never run for review or warm-up problems.
- `onProblemKindChange` (Math): § 3.4.
- Word Song: review sessions read the extras as today with cross-vowel **off**.
- `MathSessionResult` / `WordSongSessionResult`: the scored arrays stay 8 long, and a new `warmupCorrect: readonly boolean[]` holds first-tap correctness for the warm-up problems.

**`SessionEndPayload` additions:**

- `review?: true`
- `problemFacts?: readonly (MathFact | null)[]`: a review's 8, nullable. `planFacts` today assumes "every session is one step, so a plan is all-facts or no-facts", and a review breaks that.
- `warmupFacts?: readonly (MathFact | null)[]` and `warmupCorrect?: readonly boolean[]`

### 7.5 Session End write

- **`review === true`:**
  - `recordSessionEnd(finalStreak)` runs, then the new core `recordReviewOnSessionEnd({ surface, dateISO, leitnerOutcomes })` in `progressHistory.ts`. That function applies the Leitner outcomes (Math, non-null facts only), sets `profile.lastPlayedISO` (cloud conflict resolution keys on it), saves and pushes to the cloud. **Nothing else** happens.
  - Then `sessionEndGuidance({ before, after, node: currentStepOf(before, world), beat: sessionEndBeat(before, after, node), totalCorrect, today, nudgeSaidToday })`. The good day is already banked today and the review added none, so this returns the `'practice'` day. `sessionEndGuidance` itself needs no change.
  - No Word Song +5.
- **Forward with a warm-up:** unchanged, except that `leitnerOutcomes` = the warm-up outcomes (non-null facts) followed by the scored outcomes.

### 7.6 What each session records

|                                                              | Forward (today)                                 | Forward + warm-up                                 | Review                      |
| ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- | --------------------------- |
| `progress.history` entry                                     | yes (8 problems)                                | yes, **8 scored problems only**                   | **none**                    |
| Good day / flower / mastery rule                             | as today                                        | as today (successRate = scored / 8)               | **never**                   |
| Leitner                                                      | scored facts                                    | warm-up + scored facts                            | the review's non-null facts |
| `profile.lastPlayedISO`, cloud push                          | yes                                             | yes                                               | yes                         |
| Session history (`sessionCount`, day streak)                 | yes                                             | yes (`finalStreak` from scored problems)          | yes                         |
| Stardust                                                     | +1 per right (Math), streak +1s, +5 (Word Song) | the same, plus +1 per right warm-up answer (Math) | +1 per right (Math) only    |
| First encounters, scaffold counters, CVC latch, unlocks seed | as today                                        | as today (warm-up excluded)                       | none                        |

## 8. Assets required

- **New:** the 2 Lily lines in § 4, rendered by `scripts/renderGuidanceLinesLily.ts` (ElevenLabs, 72 characters in total), exported with `npm run export-audio` in `mobile/` (it regenerates `audioRegistry.ts`), and added to the hardcoded guide list in `public/voice-qa.html`. Thomas ear-tests them there before the native build ships. Prediction for the soak: the opener renders at roughly 3.3–4.0 s, so the renderer's 3.5 s flag may fire.
- **Code-drawn:** the heart bead SVG (§ 3.2).
- **Reused:** `MoonIcon`, all canon problem audio, the G2 practice-day end. No new Emma pose, background or SFX.

## 9. Acceptance criteria

**Core (vitest):**

1. `reviewBaseline()` equals the set of `'mastered'` steps in `defaultProgress()`. With defaults, `isReviewSession` is false for both worlds even after a good day today.
2. `progressAtStep('sub-to-10')` plus one history entry today on `sub-to-10` at 7/8: `isReviewSession(…, 'math')` is true, and `pickReviewBlocks` returns 8 refs from {add-to-10, add-to-20} that alternate steps, with no two refs sharing a fact.
3. The same doc with 5 due box items whose facts appear in `CANON_MATH_FACTS['add-to-10']`: the 3 highest-ranked are among the 8 refs. Step 1 (due first) contributes exactly 3, so a 4th or 5th due fact appears only if the step-2 fill reaches its block.
4. `daysAway`: Mon → Tue = 0, Mon → Wed = 1, same day = −1, no entry in the world = null. A warm-up is returned only for ≥ 1.
5. `pickWarmupBlocks` never returns a ref whose node is the current step, a baseline step, or more than 2 refs. Word Song refs all come from `R`.
6. The `CANON_MATH_FACTS` drift test passes on `main`'s canon.
7. `recordReviewOnSessionEnd` leaves `history`, `goodDays` and `skillLevels` byte-identical, updates `mathFactsLeitner` and `profile.lastPlayedISO`, and pushes to the cloud once.

**Server (vitest):**

8. A `review` request with 8 valid refs returns ids `math.p1–p8.*` whose texts and base64 equal the source canon blocks. It makes no Anthropic or TTS call and doesn't consume the rate limiter.
9. A `review` request with 7 refs, or with `problem: 9`, returns 400 `invalid-request`.
10. A forward request with `warmup` returns the normal forward plan plus `math.w1/w2.*`. A second identical forward request without `warmup` gets a response with no `w` ids (the cache was not polluted), and the module canon entry is unchanged.

**Native (jest):**

11. Review: Math gets `review: true`, the HUD shows `math-review-moon`, the opener plays before problem 1's read, the stage mounts only after the opener, and the streak plays its chime but grants no stardust.
12. Warm-up: 2 `math-warmup-dot-*` hearts precede 8 `math-problem-dot-*` beads. "Remember this one?" plays before each warm-up read and never before a scored read. `totalCorrect` and `perProblemCorrect` count only the 8 scored problems.
13. A failed review request (or a response whose `plan.id` doesn't start with `review-`) runs the current step's static plan, with no opener and no moon, and records a forward history entry.
14. Session End after a review: the panel `nativeID` starts with `practice:`, the tray shows the current step with today's slot `sleeping`, the only line is "You practised hard! Good work!", "All done" goes to the Hub, and no Word Song +5 is granted.

**Device (Expo Go, `EXPO_PUBLIC_QA_STEP=sub-to-10`, then `cvc-words-short-o`; `EXPO_PUBLIC_DAY_OFFSET` steps days):**

15. At 375×667 portrait, 667×375 landscape and on a tablet, the opener caption is never clipped and never overlaps the equation or the chips. The warm-up track and the status cluster don't overlap in phone landscape on a skip-count or multiply problem.
16. Play one forward session at ≥ 7/8, then tap the same card. A review starts, its 8 problems mix steps, and each one draws its own kind of visual and chips.
17. Phone landscape review: when the frame switches between arithmetic and multiply, Emma springs to her new frame and the chips sit in the right frame. No chip is ever tappable during the opener.
18. Word Song review (`cvc-words-short-o` jump): problems from letter-sounds, blending-cv and cvc-words appear in one session, each drawn with its own card and chips.
19. Day offset +2 after a session: the first session in that world shows 2 hearts and "Remember this one?" twice, and a second session that day shows none.
20. With Reduce Motion on, the stage appears at the opener's end without a fade.

## 10. Open questions (Dave / Thomas, via Matt)

1. **"Never the current step" in math (D4):** I applied the brief's rule to both worlds. The consequence is that a math warm-up is dormant until a non-baseline math step is mastered. The other reading allows current-step overdue facts, which would make the warm-up live now, with the first 2 problems absorbing the post-gap rustiness. Dave to confirm.
2. **"Days away" (D5):** I read it as a missed calendar day, so daily play never triggers a warm-up. The other reading ("any new day") makes every first session of the day 10 problems. Dave to confirm.
3. **"At most 3 items" (§ 7.4):** I read it as Dave's per-session overdue cap, which now includes the warm-up's facts, so the forward Leitner hint drops to 1 fact on a math warm-up day. Dave to confirm.
