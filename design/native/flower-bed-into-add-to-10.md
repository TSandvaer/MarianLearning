# The flower bed moves into adding to ten (native build spec)

**Ask (Thomas, 2026-10-20, verbatim, after playing PR #635):** "the flowerbed (10) you just made is not really a game, it really belongs on the path in my oppinion."

**Decided by popup (Thomas, 2026-10-20):** "Move it into add-to-10". This was Dave's recommendation (PR #647, `design/research/real-games-2026-10-20.md` § 4). The soil ten-frame bed becomes the picture for adding to ten's missing-number problems, and those problems are scored like every other lesson problem. The Map door and the `'game'` route are retired. It is **not** a new path step.

**Sources:** the shipped game, `design/native/mini-game-flower-bed.md` (PR #635, soil look from #640). The lesson's missing number, `design/native/content-wave-1.md` § 1. The code is cited at `origin/main` `2f851274`.

**Still open:** **T1**, the bed's look on the lesson card, judged at the device check (§ 8). **D1-D3**, which go to Dave (§ 9). There are no K-items: nothing changes on the server, planner, canon or progress.

---

## 1. Which problems get the bed

**The rule:** a problem gets the bed when `kind === 'missing-addend'` and `total === 10`. The rule is one pure predicate in core, next to `isMissingAddendProblem` (`packages/core/src/math/extendedProblems.ts:334`):

```ts
/** A missing number whose whole is ten: the flower bed's problem. */
export function isBondToTenProblem(
  problem: MathProblem | ExtendedMathProblem,
): problem is MissingAddendProblem
```

**Why the rule names the problem and not the step.** Only adding to ten has missing numbers with a whole of ten. Its range is `totalMin = totalMax = 10` (`packages/core/src/wire/missingNumbers.ts:38-45`). Adding to twenty's wholes are 11-14 (`:46-53`), so those problems never match and keep the counting row. Because the rule reads the problem itself, it holds wherever an adding-to-ten missing number plays, with no step tag needed:

| Where the problem plays                    | Source of the problem                                                                              | Bed? |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---- |
| A forward adding-to-ten session from canon | P4, P6, P8 (`MISSING_NUMBER_SLOTS`, `missingNumbers.ts:16`): 7 + ? = 10, 6 + ? = 10, 8 + ? = 10    | Yes  |
| A forward session the planner writes       | Slots 4, 6 and 8, any bond to ten (the same range, read by `api/_planner.ts`)                      | Yes  |
| Review, warm-up and mix blocks             | The canon blocks above, copied with their audio (`packages/core/src/progress/reviewPlan.ts:17-19`) | Yes  |
| A Map peek or replay of adding to ten      | The step's canon problems (`Math.tsx:86-98`)                                                       | Yes  |
| Adding to twenty's missing numbers         | Wholes 11-14                                                                                       | No   |

Every bond the bed can show (given 1-9, missing 1-9) is inside the step's own range. The canon's three asks are in `public/canon/math/level-1/add-to-10.json`, with facts in `packages/core/src/progress/canonMathFacts.generated.ts:17-26`.

## 2. What changes on those problems, and what stays

**Today** a missing number shows the equation `A + ? = 10` over a counting row. The row is group A's flowers, a "+", and group B as a "?" stone, which becomes buds at hint 3 and blooms on the answer (`MissingNumber.tsx:1-19`; `Math.tsx:2057-2075`).

**Now** the counting row is replaced by the soil bed on these problems. Everything else on the card stays as it is.

| Part                                                       | On a bed problem                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equation `7 + ? = 10` and its `EquationGap`                | Unchanged: the "?" gets its rose ring at the guided answer, then fades as the answer springs in on the right tap (`MissingNumber.tsx:12-16`)                                |
| Counting row (`CountingRow` + `MissingGroup`)              | **Not rendered.** The bed takes its place in the visual row                                                                                                                 |
| The "?" stone                                              | **None.** On the bed, the empty holes show the missing part                                                                                                                 |
| Read, correct, reprompt, hint triple and give-answer lines | Unchanged: the plan's own utterances (`math.p4.*` and so on). No new line                                                                                                   |
| Chips                                                      | Unchanged (`problemChips.ts:106-122`)                                                                                                                                       |
| Scoring                                                    | Unchanged: clean win, streak, stardust, Leitner fact `{a: addendA, b: correct, op: '+'}` (K4), hint and guided flags, latency. The bed only changes the picture             |
| Advance                                                    | Unchanged: the correct line's end + `ADVANCE_AFTER_CORRECT_MS` (1200), with the 4 s ceiling (`gameplayConstants.ts:38`, `:50`). The last bloom always lands before it (§ 4) |

**The lesson's ten-frame scaffold.** No ten-frame scaffold runs on these problems today, so the bed has nothing to replace or sit beside. The subitising dot card never shows on a missing number, because it would show both parts (`Math.tsx:1643-1646`; `dotCard.test.ts:326-344`). The `TenFrameCell` flash belongs only to subtraction's minuend (`ScaffoldFlash.tsx:1-4`). The bed is the only ten-frame on these problems, and the other scaffolds are not changed.

## 3. The bed on the lesson card

`FlowerBed` is drawn as shipped: soil `#7d4a26`, wood rim, flat holes with a lip, one furrow, and the lesson's `FlowerGlyph` and `BudGlyph` on `FRAME_COLUMNS` × `FRAME_ROWS` (`mini-game-flower-bed.md` § 2.2; `mobile/src/screens/game/FlowerBed.tsx`). Nothing about its look changes. The given part fills slots 0 to g − 1, and slots g to 9 are empty holes.

**Size: the flowers match the counting row's flowers.** The bed takes the place of the counting row, so its flowers are drawn at the size the row's flowers would have on this problem (`countingMetrics(layout, A, correct, area.width).size`, the `counting` value Math already computes for a missing number, `Math.tsx:1720-1726`). On phones it never grows past the reserved visual slot. That keeps the equation still between problems, the rule in `Math.tsx:1727-1728`.

```
unit  = counting.size / 20                       // a flower is 20 bed units
slotH = layout.visualSlot                        // phones: 80 portrait, 64 or 56 landscape
      ?? area.height − equationLineHeight − problemGap   // tablets: the space under the equation
bedW  = min(130 × unit, slotH × 130 / 60, area.width − 32)
bedH  = bedW × 60 / 130
```

On tablets the visual row's height becomes `bedH`, as it is `counting.height` for the row today (`Math.tsx:1735-1746`).

**At the floors.** The layout numbers come from running `mathLayout` and `countingMetrics(7, 3)` at `2f851274`'s layout code, 2026-10-20, with the same viewports and insets as the game spec. The row's flower is the same for all nine bonds to ten (24 pt on phones, 51.2 on the tablets; checked for g = 1-9):

| Device (insets)      | Visual slot | Row's flower | Bed (W × H)   | Flower | Hole (14 units) | Slot pitch |
| -------------------- | ----------- | ------------ | ------------- | ------ | --------------- | ---------- |
| 375 × 667            | 80          | 24           | 156 × 72      | 24     | 16.8            | 28.8       |
| 667 × 375            | 64          | 24           | 138.7 × 64    | 21.3   | 14.9            | 25.6       |
| 820 × 1180 (t24 b20) | — (435.2)   | 51.2         | 332.8 × 153.6 | 51.2   | 35.8            | 61.4       |
| 1180 × 820 (b20)     | — (287)     | 51.2         | 332.8 × 153.6 | 51.2   | 35.8            | 61.4       |

Phone landscape is the only form where the slot caps the bed: its flowers are 21.3 pt, against the row's 24. On the tablet, the equation (106), the gap (24) and the bed (153.6) total 283.6 pt, which fits both problem rects (565.2 and 417). The game drew the bed at up to 560 pt because the bed was the whole screen. On the lesson card it is a picture under the equation, so it keeps the lesson's scale (T1).

**The bed is not a target.** In the game, a tap on the bed repeated the ask. The lesson has no tap-to-repeat anywhere, and the counting row is not tappable (`MissingNumber.tsx:4`). So a tap on the bed or a hole does nothing. No hole is ever planted one at a time (the game's D8: tapping three holes is counting by ones).

**Wireframe** (phone portrait 375 × 667, P4 "Seven and what make ten?", while Emma reads):

```
+-------------------------------------+
| (<)  ★ 12                           |
| ◉  ◉  ◉  ○  ○  ○  ○  ○              |
|  .-----.  +-----------------------+ |
| ( Emma  ) | Seven and what make   | |
| (  147  ) | ten?                  | |
|  '-----'  +-----------------------+ |
|                                     |
|          7  +  ?  =  10             |   equation, 72 pt (unchanged)
|                                     |
|        +-------------------+        |   bed 156 × 72 in the 80 pt slot
|        | ✿  ✿  ✿  ✿  ✿     |        |
|        | ✿  ✿  ○  ○  ○     |        |
|        +-------------------+        |
|                                     |
|    [ 2 ]       [ 3 ]       [ 4 ]    |   chips 88 (unchanged)
+-------------------------------------+
  ✿ flower planted in its hole   ○ empty planting hole (dark, in brown soil)
  The HUD is the lesson's own: stardust, streak and 8 beads. The furrow is not drawn here.
```

## 4. The right answer: the buds hop in

The game's right move comes over unchanged. The lesson's existing beats (sparkle, plink, the chip's burst, `celebration`, stardust and streak, the correct line, the equation's answer) run as today. On top of them:

| t (ms from the right tap) | What happens                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 80 × j                    | Bud j (j = 0 … m − 1) leaves the tapped chip's centre for the hole in slot g + j. The flight is 360 ms: x is linear, y follows an arc 32 pt above the straight line at its middle, and scale goes 0.5 → 1 (`HOP_MS`, `HOP_STAGGER_MS`, `HopBud`, `GameScreen.tsx:106-111`, `:706-786`). The hop layer sits above the stage and the chips, with `pointerEvents="none"` |
| 360 + 80 × j              | Bud j lands and blooms with the lesson's bloom: a 150 ms crossfade to the flower and a 1 → 1.15 → 1 spring. The hole stays under it (`FlowerBed`'s `filled` and `landMs`)                                                                                                                                                                                             |

**It always lands before the advance.** For m = 9 the last bloom ends 360 + 640 + 150 = 1,150 ms after the tap. The correct line starts at the tap, and the advance comes 1,200 ms after it ends, so the advance is never earlier than 1,200 ms after the tap. The 4 s ceiling is later still.

**After a guided answer**, her tap on the glowing chip plays the same hop, so the move stays hers. **With Reduce Motion on** there is no hop and no scale. Bud j fades in over its hole at 80 × j ms (200 ms), then crossfades to its flower (200 ms), as `FlowerBed` does today (`mini-game-flower-bed.md` § 2.7).

## 5. Wrong taps, hints and the guided answer on the bed

**The lesson's three tiers stay** (`HINT_AFTER_WRONG_COUNT` 2, `GUIDED_AFTER_WRONG_COUNT` 3, `gameplayConstants.ts:17-20`), with the plan's own lines. The game's two-tier ladder (`mini-game-flower-bed.md` § 2.6) is not used. The tiers drive the hint and guided flags that scoring reads (D2). The bed takes over the counting row's beats:

| Tier                        | Line (P4's canon)                             | Today on the counting row                                                              | On the bed                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st wrong                   | "Hmm... try again?"                           | Poof, shake, `puzzled-tilt`; the row is still                                          | The same. **Nothing moves in the bed:** no bud leaves and no hole pulses                                                                                                                                         |
| 2nd wrong → 600 ms → hint 1 | "Look at the flowers."                        | Group A ripples once (`hintBeat = 'group-a'`, `Math.tsx:1252`; `CountingRow.tsx:9-11`) | **The planted flowers ripple once**, in fill order: each 1 → 1.1 → 1 over 300 ms, 150 ms apart (the row's own pulse, `HINT_FLOWER_PULSE_MS`). Reduce Motion: no scale, as on the row                             |
| hint 2                      | "Seven flowers."                              | Nothing new                                                                            | Nothing new                                                                                                                                                                                                      |
| hint 3                      | "How many more make ten?"                     | The "?" stone fades and the buds appear (`budReveal = 'hint'`, `Math.tsx:1296-1298`)   | **The empty holes pulse once** in fill order, at the line's start (`FlowerBed`'s `hint` rise, the game's hint: 1 → 1.1 → 1, 300 ms, 150 ms apart). Reduce Motion: each dips 1 → 0.4 → 1. No bud appears          |
| 3rd wrong → guided          | "Hmm... try again?" then "This one is three." | Glow and dim on the chips; the buds show if hint 3 didn't (`Math.tsx:1386-1392`)       | Glow and dim on the chips, and the "?" ring as today. **The empty holes pulse once** if hint 3 did not already pulse them (the bed's version of "the buds show if hint 3 didn't"). No bud appears before her tap |

Never a red X, no red colour, no buzzer, no shake of the bed. The bed never part-fills or overfills: buds only move on the right tap.

## 6. What is retired

**The play door, the route and the screen go, together with everything only they used.** Games wrote nothing (#635 AC N5: zero key-value writes, `fetch` never called). The route lives in App state and is never stored (`packages/core/src/router/route.ts:63-70`; no route key exists in `mobile/src` or `packages/core/src`). So **there is nothing to migrate**: an installed build with the door simply has no door after the update.

| Part (added by #635, `fc160069`)                                                                                                                                                                                               | Fate                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FlowerBed.tsx`, `flowerBedGeometry.ts`, `FlowerBed.test.tsx` (`mobile/src/screens/game/`)                                                                                                                                     | **Move** to `mobile/src/screens/math/`. Drop `bedRect`, which only sized the game's full-screen bed. Add a `pulseGiven` rise (§ 5). Change the test-ID prefix default to `math-bed` |
| `HopBud` and the hop constants (`GameScreen.tsx:106-111`, `:706-786`)                                                                                                                                                          | **Move** to `mobile/src/screens/math/BudHop.tsx`, with `chipCentre` and `slotCentre`                                                                                                |
| `GameScreen.tsx`, `GameScreen.test.tsx`, `game.learners.test.tsx`, `gameLines.ts`                                                                                                                                              | **Delete**                                                                                                                                                                          |
| `packages/core/src/games/miniGames.ts` and its test (`openGames`, `flowerBedRound`)                                                                                                                                            | **Delete**                                                                                                                                                                          |
| Route `'game'` (`route.ts:63-70`), `ROUTE_EXITS` (`routes.ts:58`), `routeLayout.ts:20`, App's game wiring (`App.tsx:98-102`, `:116`, `:190`, `:379-383`, `:414-415`, `:670-690`, `:775-777`, `:804`, `:886-890`, `:977-978`)   | **Delete**                                                                                                                                                                          |
| `GAME_HUD` (`hudWorld.ts:26`)                                                                                                                                                                                                  | **Delete**                                                                                                                                                                          |
| The door: `door` in `mapScreenLayout.ts`, `games` in `useMapVisit.ts:63`, `:209`, `GameDoor` and `GameDoorPicture` (`mapChrome.tsx:221-290`), `MapScreen.tsx:42`, `:142`                                                       | **Delete**                                                                                                                                                                          |
| `MapScreen.game.test.tsx`, `App.game.test.tsx`, the N4 case in `App.learners.test.tsx:448-470`, and the door cases in `mapScreenLayout.test.ts`                                                                                | **Delete**                                                                                                                                                                          |
| The 30 `guide.game.*` rows and the `'game'` kind (`guidanceLines.ts:66`, `:284-302`)                                                                                                                                           | **Delete** (below). `GUIDANCE_LINES` goes from 336 (`guidanceLines.test.ts:63`, `:394`) to 306                                                                                      |
| 30 clips × 2 (`public/assets/audio/path/guide-game-*.mp3`, `mobile/assets/audio/path/guide-game-*.mp3`), 30 `audioRegistry.ts` entries (`:156` on)                                                                             | **Delete**                                                                                                                                                                          |
| The 30 rows in `public/voice-qa.html`'s `GUIDANCE_FILES` (`:2275` on)                                                                                                                                                          | **Delete**, so the drift guard stays green                                                                                                                                          |
| The clay piece `ui-flower-bed`: 3 webp in `mobile/assets/path/`, 2 in `public/assets/path/`, 3 `registry.ts` entries (`:328-329`, `:400`), the `pathArt.ts` id (`:54`, `:131`), and one UI piece off `pathArt.test.ts`'s count | **Drop** (below)                                                                                                                                                                    |
| `design/native/flower-bed-manifest.json`                                                                                                                                                                                       | Keep, as the record of how the piece was made                                                                                                                                       |
| `tenFrame.ts` (`FRAME_COLUMNS`, `FRAME_ROWS`) and the small exports #635 added to `MissingNumber.tsx`, `extendedMotion.ts` and `glyphs.tsx`                                                                                    | **Keep**: the bed still uses them                                                                                                                                                   |

**Why every `guide.game.*` line goes.** The lesson speaks its own plan lines. Canon problems carry baked audio, and planner sessions bring theirs, so the lesson needs none of the 30. The shared lines (`guide.game.again`, `this-is.<n>`) were kept for games B and C, which are no longer planned. Dave's new game ideas (#647) are a different kind of game with no spec yet. If a future game wants a line back, it re-adds the row. Guidance lines and math canon share the render cache key `lily|eleven_v4|<input>` (`mini-game-flower-bed.md` § 3.1), so `renderGuidanceLinesLily.ts --dry-run` shows whether a re-add would bill anything.

**Why the clay piece is dropped, not reused.** The lesson card draws the bed flat, as the lesson's other pictures are, and needs no clay. The only clay homes are the Map and the Hub, and there a soil bed with flowers would read as a progress tray. Dave's D7 kept the bed's art apart from the trays for that reason (`mini-game-flower-bed.md` § 7). The piece cost about $0.16, and git history holds it (`fc160069`).

**The old spec.** `design/native/mini-game-flower-bed.md` gets a one-line note at the top saying it was superseded by this spec. Its § 2.2 (the bed's look) and § 2.4's hop beats stay the reference for the drawing and the motion.

## 7. Acceptance criteria

### 7.1 Core (vitest, `packages/core`)

1. **C1.** `isBondToTenProblem` is true for `{kind: 'missing-addend', addendA: 7, total: 10, correct: 3}`, and for every given 1-9 with whole 10. It is false for a missing number with whole 11-14, for `7 + 3` arithmetic, and for every other kind.
2. **C2.** For every canon add-to-10 block, `isBondToTenProblem` is true exactly at P4, P6 and P8. For every canon add-to-20 block it is false.
3. **C3.** `GUIDANCE_LINES` has 306 lines, and no id starts with `guide.game.`. `GuidanceLineKind` has no `'game'`. `voice-qa.html`'s `GUIDANCE_FILES` still mirrors the lines (the drift guard, `guidanceLines.test.ts:393-394`).
4. **C4.** `Route` has no `'game'`. `pathArt` has no `'ui-flower-bed'`. `packages/core/src/games/` does not exist.

### 7.2 Native (jest, `mobile`)

5. **N1.** In an add-to-10 canon session, P4, P6 and P8 render `math-bed` and no `math-missing-group-*`. P1-P3, P5 and P7 render the counting row and no `math-bed`. The equation shows `7 + ? = 10` on P4.
6. **N2.** An add-to-20 missing number renders the counting row and the "?" stone (`math-missing-stone`), and no `math-bed`.
7. **N3.** On P4 the bed has 7 full slots and 3 empty holes. On the 375 × 667 viewport its width is 156 and its height 72, and on 667 × 375 it is 138.7 × 64. The equation's y is the same on P3 and P4 on both phones.
8. **N4.** A right tap on P4 renders 3 `math-hop-<j>` buds in a `pointerEvents="none"` layer. After the blooms, all 10 slots are full. The advance to P5 fires after the last bloom ends (fake timers).
9. **N5.** 1st wrong: no `math-hop-*`, the full-slot count is unchanged, and no hole pulses. 2nd wrong: at hint 1's start the 7 planted flowers pulse; at hint 3's start the 3 holes pulse; no bud renders. 3rd wrong (hint 3 played): the chips glow and dim and the holes do not pulse again. 3rd wrong that cuts the hint before hint 3: the holes pulse once at the guided start. A tap on the glowing chip runs N4.
10. **N6.** A tap on the bed or a hole plays nothing and changes nothing.
11. **N7.** With Reduce Motion on (mocked): no hop and no scale; buds fade over their holes, and hint 3 and the guided pulse use the dip.
12. **N8.** Scoring parity: an add-to-10 session answered with the same taps gives the same stardust, streak, Leitner writes and `onSessionComplete` payload as on `2f851274` (the existing `Math.missing.test.tsx` expectations stay green, with only test IDs updated).
13. **N9.** A review session, a warm-up and a Map peek or replay that contain an add-to-10 missing number render the bed on it.
14. **N10.** The Number Garden Map renders no `map-game-door` for any progress. `ROUTE_EXITS` lists no `'game'`.

### 7.3 Device (Jessica first; iPad portrait and landscape, phone portrait and landscape)

15. **V1.** On adding to ten, P4, P6 and P8 show `A + ? = 10` over the soil bed: g flowers planted, and the rest empty dark holes. The bed's flowers look the same size as the counting row's on P3 (T1).
16. **V2.** A right chip: buds hop from the chip into the holes and bloom, "Yes! Seven and three make ten!" plays, and the lesson moves on as usual. The stardust and streak behave as on any problem.
17. **V3.** Two wrong chips, then the hint: the planted flowers ripple at "Look at the flowers.", and the empty holes pulse at "How many more make ten?" and are plainly seen to move on the soil. A third wrong: the right chip glows and Emma says "This one is three.". No red and no X anywhere.
18. **V4.** With Reduce Motion on: fades only, and the dip on the holes is still seen.
19. **V5.** The Number Garden Map has no door, on a build that had one before (the update path).
20. **V6.** Adding to twenty's P4 still shows the counting row with the "?" stone.

**20 criteria:** 4 core, 10 native, 6 device.

## 8. For Thomas (subjective calls only)

- **T1. The bed on the lesson card** (§ 3). The bed sits under the equation, and its flowers match the counting row's size: 156 × 72 pt on a phone in portrait and 333 × 154 on the iPad. In the game it was up to 560 pt wide. **Recommendation:** approve this size and judge it at device check V1. If it reads too small, the lever is one constant: let the bed grow into the tablet's spare height (up to the game's 560). On phones that would move the equation between problems, so phones stay at the slot.

## 9. For Dave (pedagogy checks, D-items)

- **D1. The missing part is visible from the start.** The counting row hides it behind the "?" stone until hint 3. The bed shows the empty holes from the first moment, because that is the bed's picture: the holes are the missing part (#647 § 4). A learner can count the holes by ones, but the bed's two rows of five also offer "a full row and two more", which the row does not. **Recommendation:** keep. Change it only if Dave reads the visible holes as making the step too easy for a learner who already finds adding to ten easy (#620 § 1).
- **D2. The lesson's three tiers, not the game's two.** The game pulsed the holes at the 1st wrong and guided at the 2nd (#635 D2). On the lesson card the bed keeps the lesson's tiers, so the hint and guided flags, and the scoring that reads them, are the same as on every problem. The game's hole pulse moves to hint 3, "How many more make ten?", which names the same thing. **Recommendation:** three tiers.
- **D3. Adding to twenty keeps the counting row.** Its missing numbers cross ten (wholes 11-14), so a single ten-frame cannot hold them. The double ten-frame for teens (the game's out-of-scope item) is not part of this build. **Recommendation:** keep the row there.

## 10. Build split

**Devon builds it in one PR** (branch `devon/flower-bed-into-add-to-10`), and **Kevin reviews**, per the routing rule. Kevin is not needed to build. The core part is one predicate plus deletions. There is no `Progress` field, no storage key, no migration, no server or planner change, no canon re-bake and no render.

**Vocabulary contract:** `isBondToTenProblem` in `packages/core/src/math/extendedProblems.ts`; `FlowerBed` and `flowerBedGeometry.ts` in `mobile/src/screens/math/`; `BudHop.tsx` (component `BudHop`) in the same folder; test IDs `math-bed`, `math-bed-slot-<i>`, `math-bed-hole-<i>` and `math-hop-<j>`; `FlowerBed`'s new prop `pulseGiven: number` (each rise ripples the full slots once), beside the existing `hint: number`.

**Order:**

1. **Core:** `isBondToTenProblem` with C1-C2. Delete `games/`, the `'game'` route member, the 30 rows and the `'game'` kind, and the `ui-flower-bed` id. Then C3-C4.
2. **Mobile, move:** `FlowerBed`, `flowerBedGeometry` and the hop into `screens/math/`, with their tests (prefix `math-bed`). Add `pulseGiven`.
3. **Mobile, wire:** in `Math.tsx`'s visual row, a bed problem renders `FlowerBed` sized by § 3's formula in place of `CountingRow`/`MissingGroup`. Drive `pulseGiven` from `hintBeat === 'group-a'` and `hint` from the hint-3 and guided beats of § 5, and run `BudHop` from the right tap. `chipCentre` uses `layout.chips`. Then N1-N9.
4. **Mobile, retire:** `GameScreen`, the route wiring, `GAME_HUD`, the door, the game tests, the 60 clips and 30 registry entries, the 5 webp files and 3 registry entries, and the 30 `voice-qa.html` rows. Then N10.
5. **Device check:** V1-V6, Jessica first, then T1 with Thomas.

**Size: M.** The wiring in `Math.tsx` is S-M, and the rest is moves and deletions.

**Out of scope:** the double ten-frame for adding to twenty, any change to adding to ten's lines or canon, Dave's new games (#647), and the web app (it has no missing-number view: no `missing-addend` in `src/`).
