# Number Garden 1 and 8–11 (number recognition, skip counting, multiplication): native UX calls

**Scope:** five steps of the native Math screen: step 1 `number-recog` (§ 10) and steps 8–11 `skip-counting`, `mult-2-5-10`, `mult-3-4` and `mult-6-9`. Neither app has ever built them. Their canon (`public/canon/math/level-1/*.json`) has all 8 problems with Emma's lines and audio. Today the read lines don't parse, so the session falls back to a silent sums-to-10 set. Devon's core model (`packages/core/src/math/extendedProblems.ts`, branch `devon/rn-math-skip-mult`) parses them into `SkipCountProblem` (`sequence`, `step`, `correct`) and `MultiplyProblem` (`factorA`, `factorB`, `correct`). This spec covers what the screen does with them. Everything not named here stays as `mobile/src/screens/math/Math.tsx` does it today. That includes the lesson-frame calls in `greet-math-native.md` (Fredoka, HUD, beads, back arrow, chip floors, the 375×667 / 667×375 phone floor, "tablet" = shorter side ≥ 600 pt) and the chip tap-gate, streak, stardust, sounds, poses and advance timings.

**Goal:** Marian hears Emma read each problem and answers it with a picture on screen: a 1–10 number strip for finding a number, stepping stones for counting on, groups of flowers for "times".

**Entering:** Emma's Path or the Hub opens Number Garden on one of these steps (Thomas checks them through the QA step picker, #557). Every session is one step, so all 8 problems are the same kind.

**Order:** "A times B" is **B groups of A**. The canon's "Two times three. How many?" has the hint "Two, then two, then two.", and `api/_planner.ts:2135` says "factor-b copies of factor-a, NO commutative flip". The groups must match what Emma says.

## Decisions

1. **Three answer chips**, as on every Math step. _Why:_ it is the format Marian already knows, and three 88 pt chips fit the phone floor (§ 4).
2. **Skip counting shows a track of stepping stones**: every term she hears, then a "?" stone. There is no equation and no counters. _Why:_ the numbers are the content of a counting sequence. Counters for 40–70 would be impossible to count on a phone and would break the 20 pt dot floor (§ 2).
3. **Multiplication shows the equation `A × B = ?` above B plates of A flowers.** _Why:_ this is the add/sub layout (equation over counters), with groups as the counters (§ 3).
4. **The × sign appears at all three tiers** (× rather than ·, Thomas confirmed 2026-10-13). _Why:_ Emma says "times" in all 24 read lines, and the ribbon shows the word. The equation is where her word becomes a sign, as "plus" becomes "+". The groups next to it always carry the meaning, so the sign never has to stand alone. The diagnostic's "no x symbol" describes where she is now. It is not a ban, and 3rd grade will need the sign.
5. **Repeated addition (a number tag on each plate with "+" between the plates) is shown from the start in `mult-2-5-10` and `mult-6-9`. In `mult-3-4` it appears at hint 2** (Dave, 2026-10-13). _Why:_ in the first tier it translates × into "2 + 2 + 2", which she can already read. Groups of 3–4 are within subitising range, so `mult-3-4` can ask her to see the groups herself first. Groups of 6–9 are not; without tags she would count up to 27 flowers one by one.
6. **The groups never fade in v1.** _Why:_ `mult-6-9` is still at the conceptual stage (products 12–27, `design/research/w12-generic-tier-hint-templates.md` § Tier 5). Hiding the groups would leave her with no support until two wrong answers.
7. **Every hint line has its own picture beat** (§ 5). On hint 2 of a multiplication problem, each plate lights up as Emma names it. _Why:_ she should hear one spoken "two" for each plate she sees.
8. **"This one is …" (the guided answer) is the explanation moment.** All the support shows at once: every hop, every tag (§ 5).
9. **Phone landscape uses Word Song's L frame (the chip column).** Multiplication's ribbon is 1 line there (§ 6). _Why:_ under Math's bottom row of chips, the 5-tall groups and the 56 pt equation don't fit a 375 pt-tall screen.
10. **Sizes are computed once per plan** from its largest problem. _Why:_ stones and plates keep one size for the whole session, and the equation never moves.
11. **No new lines, art or sounds.** _Why:_ the canon already has every line, and its audio is baked. Flowers, stones, plates and the strip are drawn in code.
12. **Number recognition shows a 1–10 number strip in one row, with its numerals hidden until hint 1, and the chips carry the answer** (§ 10). _Why:_ every hint-2 line is a fact about where the number sits on that line ("Five is in the middle.", "Nine is close to ten."), and in one row those facts are literally true on screen.
13. **Number recognition keeps Math's own frames and chips** (`pickDistractors` unchanged). _Why:_ a 48 pt strip fits Math's problem rect on every form, and adjacent numbers are the near-miss that has already been reviewed for add-to-10.

## 1. Data notes for Devon

- Use the core model as-is. A `kind` other than `'arithmetic'` renders the new problem block (§ 2, § 3, § 10) instead of the equation + `CountingRow` + `ScaffoldFlash`. The subitising gates never run for these kinds.
- Supported range: skip sequences up to 8 terms + "?" (canon has at most 8). With more terms, draw only the last 8. Terms and answers can go up to 100. Groups: `factorA` 1–10, `factorB` 1–5. The planner's hint-2 forms exist only for 1–5 copies (`api/_planner.ts:2135`). Outside that range the problem shows the equation and the chips without groups, and logs a `recordAudio` note.
- **Parser: accept both skip-count read forms**, "…What is next?" (the canon) and "…what's next?" (the example on `api/_planner.ts:2110`). Devon's regex accepts only the first. The live planner runs whenever Leitner items are due, so a plan written in the example's form would otherwise fall back silently.
- Number recognition needs a third kind: suggested `NumberRecogProblem { kind: 'recognize'; index; correct; utterances }`, parsed from "Tap the <number-word>." with `correct` 1–10 (Dave's hint-2 table covers only 1–10). Name it before the kinds are wired in parallel.

## 2. Skip counting: `SkipTrack`

New file `mobile/src/screens/math/SkipTrack.tsx` (`testID="math-skip-track"`, `accessibilityLabel` = the read line). It takes the place of `math-symbolic` and is centred in the problem rect.

- **Stones:** flat circles, diameter `D`. Given terms: fill `colors.white`, a 2 pt `colors.myPink` border, the numeral in Fredoka 700 `colors.ink` at `round(0.5 D)`, stepped down 2 pt at a time until it fits `D − 12`. The "?" stone: fill `colors.myCream`, a 3 pt dashed `colors.myRose` border, "?" in `colors.myRose`. They are flat, with no clay shadow, so they don't read as chips. `pointerEvents: 'none'`.
- **Rows:** up to 5 cells take one row. 6–9 cells take two balanced rows: row 1 holds `ceil(n / 2)` cells and row 2 is indented `(D + G) / 2`. The cells are 16 pt apart (`G`; tablet 24), rows are 8 pt apart, and each row has a 30 pt **hop zone** above it (tablet 40).
- **D** = the largest value ≤ 64 (tablet 88) at which the plan's longest sequence fits the problem rect. Floor: D = 55, numerals 28 pt (§ 6 table).
- **Hops** (hidden until hint 2): a 3 pt `colors.myRose` arc (tablet 4 pt) with round caps and a 6 pt arrowhead. Each arc runs from ¾ of the way across one stone to ¼ of the way across the next, and its apex is 12 pt above the stone tops (tablet 16). The label "+2" (the step) is in Fredoka 700 `colors.ink`, 16 pt (tablet 22), centred 2 pt above the apex. **Wrap hop** (into row 2's first stone): drawn the same way, from a virtual stone one column to the left. Its start falls inside row 2's indent.
- **The last hop** (from the last term to "?") is dashed (6 on, 4 off) until the problem is answered.

## 3. Multiplication: equation + `GroupsRow`

- **Equation:** Math's `math-symbolic` row, with tokens `[factorA, '×', factorB, '=', '?']`, at 96 / 72 / 56 pt as today. The sign is one constant, `TIMES_GLYPH = '×'` (U+00D7; Fredoka has the glyph, checked in the `@fontsource/fredoka` Latin file).
- **New file** `mobile/src/screens/math/GroupsRow.tsx` (`testID="math-groups"`, hidden from accessibility like `CountingRow`). It draws `factorB` plates in one row, left to right.
- **Plate:** a white rounded rect (radius 12, tablet 16) with a 2 pt `colors.myPink` border and 6 pt padding (tablet 8). Inside are `factorA` `FlowerGlyph`s, 20 pt (tablet 24), 4 pt apart (tablet 6). They fill **columns of 5, top to bottom, left column first**, so a group of 6–10 is a full column of five plus the rest. _Why:_ the five-structure, so 7 reads as "five and two" at a glance.
- **Tag:** a pill on the plate's top edge, centred and half overlapping it. It is 28 pt tall (tablet 32), `colors.myPink`, and holds the group size in Fredoka 700 `colors.ink` at 20 pt (tablet 24).
- **"+":** Fredoka 600 `colors.ink`, 16 pt (tablet 20), centred in each gap between plates at the plates' mid-height. The gap is `G = clamp(12, fit, 24)` (tablet `clamp(16, fit, 32)`).
- **Slot:** half a tag plus the plan's tallest plate, reserved for the whole session. The plates hang from its top, one `problemGap` below the equation (P 24, L 8, tablet 24).

| Tier          | Plates + flowers | Tags + "+"                                       |
| ------------- | ---------------- | ------------------------------------------------ |
| `mult-2-5-10` | always           | always (repeated addition shown from reveal)     |
| `mult-3-4`    | always           | hidden; they appear one by one on hint 2         |
| `mult-6-9`    | always           | always (groups of 6–9 can't be seen at a glance) |

A hidden tag still takes its space, so nothing moves when it appears. After hint 2 the tags stay for the rest of the problem.

## 4. Answer chips

3 chips: the answer + 2 wrong values. `AnswerChip` is unchanged: dim, guided glow, shake and burst all behave as today. The values come from a **new pure function beside `pickDistractors`** (Devon's seam). A new `buildExtendedChipOrder` in `mobile/src/screens/math/extendedChipOrder.ts` shuffles them with the same LCG and seed as `buildChipOrder`. `buildChipOrder` stays a verbatim web copy and keeps serving arithmetic; `chipOrder.test.ts` must not change.

| Kind       | P1–P3 (gentle)                                         | P4–P8                                                                                                                                                              | Offered class (P4–P8) |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| skip-count | the first term; `correct + step`                       | `last + 1` (counted on by one); `correct + step` (skipped a term)                                                                                                  | `'count-by-one'`      |
| multiply   | `pickDistractors(correct, index, M)` (its gentle tier) | `A + B` (read × as +) and `correct + sign` (a counting slip, sign below); if `A + B` equals the answer or leaves 1–M (2 × 2), `pickDistractors(correct, index, M)` | `'wrong-op'`          |

- **Skip repair:** a value equal to the answer or the other value, or outside 1–100, becomes the last term, or failing that the first term.
- **M** (multiply ceiling) = `10 × ceil((max answer + 1) / 10)`: `mult-2-5-10` → 30, `mult-3-4` → 20, `mult-6-9` → 30. _Why:_ the +1 chip always fits, and `chipMaxAnswerForCorrects` (99) would put a "99" chip beside "Six times two".
- **The ±1 sign** (Dave, 2026-10-13) alternates by position: **+1 on P4, P6 and P8; −1 on P5 and P7**. If that value collides with `A + B`, use the other sign, then ±2. _Why:_ `A + B` is always below `A × B`, so a −1 chip every time makes the answer the biggest chip (14 of 15 canon problems before this change), and "tap the biggest" would pass as mastery. Now the answer is the biggest in 6 of 15 and the middle in 9. It is never the smallest, which is a weak 2-in-3 cue. Don't take the sign from the shuffle LCG's first draw: for these small seeds it is always below 0.5, so the sign would always come out −1.
- **Why these traps:** counting on by ones is the classic sign that the step hasn't been seen. × and + are the same shape turned 45°, and she knows +, so `A + B` catches exactly the confusion that the new sign invites.

Canon values (multiply checked by running core's functions with the rules above; unit-test all 32):

- skip: 10 [2, 12] · 20 [5, 25] · 50 [10, 60] · 8 [7, 10] · 30 [26, 35] · 70 [61, 80] · 16 [15, 18] · 45 [41, 50]
- mult-2-5-10: 4 [1, 30] · 5 [1, 30] · 10 [1, 30] · 6 [5, 7] · 10 [7, 9] · 10 [7, 11] · 20 [12, 19] · 20 [9, 21]
- mult-3-4: 6 [1, 20] · 6 [1, 20] · 9 [1, 20] · 8 [6, 9] · 8 [6, 7] · 12 [7, 13] · 12 [7, 11] · 16 [8, 17]
- mult-6-9: 12 [1, 30] · 14 [1, 30] · 16 [1, 30] · 18 [9, 19] · 21 [10, 20] · 18 [11, 19] · 24 [11, 23] · 27 [12, 28]

## 5. Emma's lines on screen

The slots fire exactly as today: read on reveal, reprompt on wrongs 1–2, the three hints 600 ms after the 2nd wrong's reprompt, the guided answer on wrong 3. For the new kinds, `runHintSequence` sets a new `hintStep` (1 / 2 / 3) before each hint line, where arithmetic sets `hintBeat`.

| Slot (canon example: skip / multiply)                                       | Skip screen                                                                  | Multiply screen                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| read: "Two, four, six, eight. What is next?" / "Two times three. How many?" | stones + "?", no hops                                                        | equation + plates (tags per § 3)                                                                    |
| correct: "Yes! Ten!" / "Yes! Six!"                                          | "?" becomes the answer; the last hop turns solid                             | as today (chip burst, sparkle)                                                                      |
| reprompt: "Hmm... try again?"                                               | no change                                                                    | no change                                                                                           |
| hint1: "Look at the numbers." / "Look at the groups."                       | the stones ripple left to right                                              | the plates ripple left to right                                                                     |
| hint2: "We add two each time." / "Two, then two, then two."                 | the hops between the given stones fade in one by one, each "+2"              | the k-th spoken "two" lights plate k (a pulse; on `mult-3-4` its tag and the "+" before it fade in) |
| hint3: "Eight and two more is what?" / "How many?"                          | the last stone and "?" pulse together; the dashed last hop draws in          | all plates pulse together once                                                                      |
| giveAnswer: "This one is ten." / "This one is six."                         | every hop shows; "?" gets a 4 pt `colors.myRose` ring, like the glowing chip | every tag and "+" shows; the plates pulse once                                                      |

- **Hint-2 word match:** read the hint-2 line's word ticks (the same `onWordTick` / `captionRevealed` that drives the ribbon, so the silent player works too). The k-th token (lower-cased, punctuation stripped) for which `wordToNumber(token) === factorA` lights plate k, for k ≤ `factorB`. "One group of five." lights its one plate at "five". When the line ends, any plate not yet lit lights at once.
- Emma's poses are as today (`listening`, `celebration`, `puzzled-tilt`, `attentive-pointing`). A guided answer can cut a hint short, so decision 8 doesn't rely on the hint having played.
- SessionEnd needs nothing new: the canon already has "You worked on skip counting today!" and "You worked on counting in groups today!".

## 6. Layouts

**New:** `extendedMathLayout(viewport, kind)` in `mobile/src/layout/mathLayout.ts` returns a `MathLayout` plus `chipsAxis: 'row' | 'column'` and `ribbonLines: number | undefined`. For `'recognize'` it returns `mathLayout(viewport)` unchanged (§ 10).

- **P (phone portrait):** Math's P frame, unchanged: HUD, Emma (147 at the floor, so she doesn't jump between steps), ribbon, the bottom chip row and the `problem` rect. The ribbon gets `maxLines={4}` as a guard: 4 lines end at 253 pt, above the problem's top at 259. No canon line is longer; the longest skip read takes 4 lines at 228.7 pt.
- **L (phone landscape):** `wordSongLayout`'s L frame: Math's Emma column and back arrow, the HUD row, the ribbon at S.y + 60, the chip column `C = clamp(88, ⌊(S.h − 56) / 3⌋, 104)` on the right, and `stage` as the problem rect. Ribbon slot: **skip 2 lines** (`maxLines={2}`; only the 8-term read scrolls once, on 667-wide screens), **multiply 1 line** (`maxLines={1}`; all 168 multiply lines measure 1 line at ≥ 339 pt). The chip container gets `flexDirection: 'column'`.
- **Tablet:** Math's tablet frames, unchanged, ribbon included. The longest read is 4 lines in portrait's 278 pt row and 2 lines in landscape's reserved slot.
- **Block:** the multiply block is the equation, then `problemGap`, then the groups slot, centred vertically. The skip block is the track, centred. Worst-case heights (5-tall plates): P 245, L 212, tablet 306.

```
P skip (375×667)               P multiply ("Two times three")
+----------------------------+ +----------------------------+
| [<]           ✦3 (★ 12)    | | [<]           ✦3 (★ 12)    |
| ● ● ◉ ○ ○ ○ ○ ○            | | ● ● ◉ ○ ○ ○ ○ ○            |
| (Emma) +-----------------+ | | (Emma) +-----------------+ |
| (147 ) | Five, ten, ...  | | | (147 ) | Two times three.| |
|        | (≤ 4 lines)     | | |        | How many?       | |
|        +-----------------+ | |        +-----------------+ |
|  (5) (10) (15) (20) (25)   | |      2 × 3 = ?   (72 pt)   |
|    (30) (35) (40) ( ? )    | |     [2]     [2]     [2]    |
|  stones 55 pt, row 2       | |     |✿|  +  |✿|  +  |✿|    |
|  indented half a column    | |     |✿|     |✿|     |✿|    |
| [ 41 ]   [ 45 ]   [ 50 ]   | | [ 5 ]    [ 6 ]    [ 7 ]    |
+----------------------------+ +----------------------------+

L multiply (667×375, "Nine times three"; mult-6-9, tags shown from reveal)
+------------------------------------------------------+
| [<]   | ● ● ◉ ○ ○ ○ ○ ○        ✦3 (★ 12) | [ 12 ] |
|       | +--------------------------------+ |  104   |
| (Emma)| | Nine times three. How many?    | |        |
| ( col)| +--------------------------------+ | [ 26 ] |
| (160) |          9 × 3 = ?   (56 pt)       |        |
|       |    [9]        [9]        [9]       | [ 27 ] |
|       |   |✿✿|   +   |✿✿|   +   |✿✿|      |        |
|       |   |✿✿|       |✿✿|       |✿✿|      |        |
|       |   |✿✿|       |✿✿|       |✿✿|      |        |
|       |   |✿✿|       |✿✿|       |✿✿|      |        |
|       |   |✿ |       |✿ |       |✿ |      |        |
+------------------------------------------------------+
  1-line ribbon slot; each plate is a column of 5 + a column of 4
```

**Sizes** (computed with the rules above; scratch script, not committed). "Skip area" / "Multiply area" are the problem rects. The "row" columns give the plate-row width, with its "+" gap in brackets, for 9 × 3 (3 plates of 9), 2 × 5 (5 plates of 2) and 10 × 5.

| Device (insets)       | Form | Skip area | D   | Multiply area | Mult. block / height | 9 × 3 row | 2 × 5 row | 10 × 5 row | Chip |
| --------------------- | ---- | --------- | --- | ------------- | -------------------- | --------- | --------- | ---------- | ---- |
| 375×667               | P    | 343 × 272 | 55  | 343 × 272     | 245 / 272            | 216 (24)  | 256 (24)  | 340 (15)   | 88   |
| 390×844 (t47 b34)     | P    | 358 × 347 | 58  | 358 × 347     | 245 / 347            | 216 (24)  | 256 (24)  | 356 (19)   | 88   |
| 411×914 (t24 b24)     | P    | 379 × 427 | 63  | 379 × 427     | 245 / 427            | 216 (24)  | 256 (24)  | 376 (24)   | 88   |
| 667×375               | L    | 371 × 210 | 61  | 371 × 240     | 212 / 240            | 216 (24)  | 256 (24)  | 368 (22)   | 104  |
| 667×375 (b21)         | L    | 376 × 189 | 60  | 376 × 219     | 212 / 219            | 216 (24)  | 256 (24)  | 376 (24)   | 99   |
| 844×390 (l47 r47 b21) | L    | 434 × 204 | 64  | 434 × 234     | 212 / 234            | 216 (24)  | 256 (24)  | 376 (24)   | 104  |
| 914×411 (l24 r24)     | L    | 530 × 246 | 64  | 530 × 276     | 212 / 276            | 216 (24)  | 256 (24)  | 376 (24)   | 104  |
| 744×1133 (t24 b20)    | TP   | 712 × 530 | 88  | 712 × 530     | 306 / 530            | 274 (32)  | 328 (32)  | 478 (32)   | 120  |
| 1133×744 (t24 b20)    | TL   | 892 × 317 | 88  | 892 × 317     | 306 / 317            | 274 (32)  | 328 (32)  | 478 (32)   | 120  |

"10 × 5" is the theoretical worst case (the live planner could send it; the canon never does). Everything stays on its floors: chips ≥ 72 (P) / 88 (L), flowers 20 pt, equation numerals ≥ 56, captions 22.

## 7. Motion (Reanimated; Reduce Motion in brackets)

- **Ripple** (hint 1, stones or plates): each element scales 1 → 1.1 → 1 (plates 1.06) over 300 ms, `EASE_IN_OUT`, 150 ms after the previous one (`HINT_FLOWER_PULSE_MS`, as `CountingRow`'s flowers do). [no scale]
- **Hop in** (hint 2): opacity 0 → 1 over 200 ms ease-out, while the label scales 0.8 → 1. 150 ms stagger. [opacity only]
- **Plate lit** (hint 2): one 1 → 1.06 → 1 pulse over 300 ms. Its tag and "+" fade 0 → 1 over 200 ms. [fade only]
- **Gap fills** (correct): "?" fades out over 100 ms, then the numeral springs in from 0.6 to 1 (stiffness 260, damping 20) while the border goes from dashed to solid. [200 ms fade]
- **Together pulse** (hint 3 and guided): the same 300 ms pulse on every target at once. [none]
- Everything resets when the problem advances (the existing 250 ms Math exit is unchanged).

## 8. Session end record

- **Multiply:** each problem records `{ a: factorA, b: factorB, op: '*' }` in `mathFacts` and in the Leitner outcomes. `2*3` and `3*2` are separate facts, the same reading as the canon.
- **Skip-count:** no fact. The problem is left out of the Leitner outcomes, and a skip session's entry has no `mathFacts`. It counts only through `perProblemCorrect`, `latencyMs` and `perProblemAnswerValue` (mastery, good day). _Why:_ it is a sequence skill, not a memorised fact, and an "8 + 2" fact would feed back into addition practice from another step.
- `perProblemDistractorClass` records the offered class from § 4 (the field is persisted as a string).

## 9. Departures from today's Math screen (by name)

1. `math-symbolic`: × for multiply; replaced by `SkipTrack` for skip-count.
2. `CountingRow` and `ScaffoldFlash` are not rendered for the new kinds; `GroupsRow` / `SkipTrack` are.
3. The visual slot is reserved per plan (§ 3, § 6), not Math's fixed 80 / 64 pt.
4. `hintStep` 1 / 2 / 3 drives the new visuals, and hint 2's word ticks light the plates. `hintBeat` stays for arithmetic.
5. The guided answer also reveals the full support (§ 5).
6. The skip "?" fills with the answer on a correct tap. Arithmetic's "?" stays as it is.
7. Chip values come from the new picker + `buildExtendedChipOrder`, not `buildChipOrder`.
8. Phone landscape uses the Word Song L frame with a chip column; the ribbon's `maxLines` is 4 (P), 2 (L skip) or 1 (L multiply).
9. Session end: `op: '*'` facts for multiply; no facts for skip-count or number recognition.
10. Number recognition: `NumberStrip` instead of `math-symbolic`, plus its hint/correct/guided beats (§ 10). Frames, ribbon and chip picker are Math's own.

**New:** `SkipTrack`, `GroupsRow`, `NumberStrip`, `extendedMathLayout`, `buildExtendedChipOrder`, the core chip picker, `TIMES_GLYPH`. **Reused:** `AnswerChip`, `MathHud`, `CaptionRibbon` (`maxLines`), `GettingReady`, `FlowerGlyph`, `wordToNumber`, `pickDistractors`, every sound effect and pose.

## 10. Step 1, number recognition: `NumberStrip`

Canon (`number-recog.json`, targets 1, 3, 5, 2, 7, 4, 9, 6): read "Tap the seven.", correct "Yes! Seven!", reprompt "Hmm... try again?", hint1 "Look at the numbers.", hint2 a fact from Dave's 10-entry table (here "Seven is bigger than five."), hint3 "Which one is seven?", giveAnswer "This one is seven.".

- **What shows:** no equation. New `mobile/src/screens/math/NumberStrip.tsx` (`testID="math-number-strip"`, `accessibilityLabel` = the read line) takes the place of `math-symbolic`, centred in the problem rect. It is a ruler-like strip of 10 touching cells, 1 to 10 left to right: one white rounded rect (radius 12) with a 2 pt `colors.myPink` border and 1 pt `colors.myPink` dividers. The numerals are Fredoka 700 `colors.ink`, 22 pt (tablet 32). Cell width = `min(⌊area width / 10⌋, 48)` (tablet 72), height 48 (tablet 64). The strip is flat with `pointerEvents: 'none'`, so it doesn't read as chips.
- **Numerals from hint 1** (Dave, 2026-10-13): at reveal each cell holds a 6 pt `colors.myPink` dot instead of its numeral, so the stage is a path of ten empty places. _Why:_ she has to match "seven" to the 7 on a chip, not count along the strip and copy the glyph. The dots keep the frame and its ten positions, so the stage reads as a path waiting for numbers rather than an empty screen. The numerals appear at hint 1, at the guided answer (whichever comes first), or, for the target cell alone, on a correct tap.
- **Chips:** 3, from `pickDistractors(correct, index, 10)` unchanged: gentle on P1–P3, off-by-one on P4–P8, offered class `'off-by-one'` on P4–P8. Canon: 1 [3, 10] · 3 [1, 10] · 5 [1, 10] · 2 [1, 3] · 7 [6, 8] · 4 [3, 5] · 9 [8, 10] · 6 [5, 7].
- **Hints and moments:**
  - hint1 "Look at the numbers.": the numerals ripple in 1 → 10. Each dot fades out as its numeral scales 0.6 → 1, 150 ms after the previous cell (§ 7 timing) [fade only]. They stay for the rest of the problem.
  - hint2: the **landmark** cell the fact names fills `colors.myPink` (200 ms fade), and its numeral pulses once; it stays lit. Landmarks: 1 → 1, 2 → 1, 3 → 2, 4 → 3, 5 → 5, 6 → 5, 7 → 5, 8 → 7, 9 → 10, 10 → 10. Each is the number the fact mentions ("Two comes right after one." → 1); for 1, 5 and 10 it is the target itself.
  - hint3 "Which one is seven?": no strip change; the question is about the chips.
  - giveAnswer "This one is seven.": any numerals not yet shown appear at once (200 ms fade), the target's cell gets the 4 pt `colors.myRose` ring, and the correct chip glows (as today).
  - correct "Yes! Seven!": the target's cell fills `colors.myPink`, and its numeral (in place of the dot, if hint 1 hasn't played) springs 0.6 → 1.25 → 1 (stiffness 260, damping 20) [200 ms fade].
- **Layouts:** Math's frames on every form (P, L with its chip row, tablet), with no ribbon change: the longest line, "Two comes right after one.", is 2 lines in P (228.7 pt) and 1 in L. Strip: P floor 340 × 48 (cells 34), L 667×375 480 × 48 (Math's 491 pt pane), tablet 710 × 64 (portrait) / 720 × 64 (landscape). "10" measures 20.8 pt wide at 22 pt.
- **Session end:** no fact (no Leitner outcome, no `mathFacts`). It counts only through `perProblemCorrect`, `latencyMs` and `perProblemAnswerValue`, as skip-count does. _Why:_ recognising a numeral is not an a/b arithmetic fact.

## Acceptance criteria (Jessica: unit tests + on device)

- [ ] QA step picker → each of the 4 steps: the 8 problems are the canon's in order, Emma **speaks** every line (no silent caption walk), and no sums-to-10 problem appears. `skip-counting` P1 shows `2 4 6 8 ?`. `mult-2-5-10` P4 shows `2 × 3 = ?` above **3 plates of 2**.
- [ ] Skip: every term she hears is on a stone. 4–5 cells take one row, 6–9 take two balanced rows with row 2 indented. All 8 problems use one stone size. Tapping a stone does nothing.
- [ ] Skip hints, after 2 wrong taps: hint 1 ripples the stones in order; hint 2 shows "+step" hops between the given stones; hint 3 pulses the last stone and "?" and draws the dashed last hop. The hops stay until the problem ends. On a correct tap, "?" becomes the answer.
- [ ] Multiply: B plates of A flowers in columns of 5 (`mult-6-9` P5 `7 × 3`: 3 plates, each a column of 5 + a column of 2).
- [ ] `mult-2-5-10` and `mult-6-9`: tags + "+" show from reveal. `mult-3-4`: hidden at reveal; on hint 2 each plate lights and shows its tag as Emma says its number. All are shown by the end of hint 2, with audio and with silent captions. Nothing moves when a tag appears.
- [ ] Guided answer (3rd wrong): every hop / every tag shows, and only the correct chip is tappable and glowing (as today).
- [ ] Chips: exactly 3. The 32 canon problems produce the § 4 values (unit test); across the 15 multiply P4–P8 problems the answer is the biggest chip in 6, and `perProblemDistractorClass` is `null` for P1–P3 and `'count-by-one'` / `'wrong-op'` for P4–P8.
- [ ] Layout: `extendedMathLayout` unit tests pin § 6's table (D, areas, chip size, plate-row widths) for all 9 viewports. On device, in both orientations, nothing is clipped, nothing overlaps the ribbon, and the § 6 floors hold.
- [ ] Ribbon: the 8-term skip read ("Five, ten, fifteen, twenty, twenty-five, thirty, thirty-five, forty. What is next?") scrolls inside its slot in L and never covers the stones. Every multiply line is one line in L.
- [ ] Session end: a multiply session writes 8 `op: '*'` facts (Leitner keys like `2*3`). A skip session writes no facts, changes no Leitner box, and still counts toward mastery and the good day.
- [ ] Web unchanged: the web's Math for these steps still takes its static fallback (Devon's opt-in parser).
- [ ] Number recognition (QA step picker → `number-recog`): the 8 canon problems in order, with Emma's voice. P1 "Tap the one." shows the strip with ten dots and no numerals, and the chips 1, 3, 10. The numerals appear at hint 1 (or at the guided answer); a correct tap before that shows only the target's numeral. Hint 2 lights the landmark per § 10 ("Seven is bigger than five." lights 5). The guided answer rings the target cell, and a correct tap fills it. Tapping the strip does nothing. The session writes no facts.
- [ ] Parser: a skip read ending "what's next?" parses the same as one ending "What is next?" (unit test).
- [ ] Reduce Motion: no scaling anywhere in § 7 or § 10; fades only.

## Open questions

- **Thomas (does not block):** how does Marian's Danish workbook draw 3 · 4: as 3 groups of 4, or 4 groups of 3? "A times B" stays as B groups of A (matching Emma's lines and hint 2) unless the workbook uses the opposite reading and she stumbles on it.

Dave's consult (2026-10-13, PR #559 comments) is applied: the ±1 sign (§ 4), tags from reveal in `mult-6-9` (decision 5), and numerals from hint 1 on the number strip (§ 10). The × sign is confirmed.
