# Content wave 5: zeros, adding big numbers, snail words, moon words, goat stories (native)

**Status:** spec only. Thomas said go on 2026-10-19 (popup "Start wave 5 roadmap", quoted in the roadmap addendum's status line). Dave's check (§ 16) and Thomas's T-items (§ 15) are open.

**Scope:** `@marian/core`, the native app, canon, the pack manifest and the scene manifest. The web is frozen: a new read throws there and the web plays its silent static plan (`content-wave-1.md` § 1.9). Rules follow `content-wave-4.md` (#606) unless stated.

**Source:** Dave's addendum "content wave 5" in `design/research/content-roadmap-after-path-ends.md` (PR #614, open while this was written), read from `origin/dave/roadmap-wave-5`. His "Corrections (2026-10-19)" section applies throughout: no step rests on a Danish-school premise, the digit swap is a weaker trap, and the progression follows the US standards. Number Garden steps 16–17 (§ 2–§ 3 here), Word Song steps 22–24 (§ 4–§ 7).

**Who it is for:** any learner of about 6 to 9 (Thomas, 2026-10-19: the app is multi-user; `CLAUDE.md` "Users" line on PR #613). Marian is one user. No step depends on one learner's school, language or history.

**Out of scope:** code, renders, generation and test runs. Also out: taking away with a new ten, three-digit regrouping, clock time, equal parts, igh/ie and ow (Dave: later candidates), and learner profiles (specced separately).

## Goal

The learner reads and builds three-digit numbers with an empty place, adds two two-digit numbers with a new ten, reads 16 new words with the vowel teams ai/ay, oa and oo, and reads stories with those words.

## User state entering

- **Zeros:** the learner has mastered more and less. The Map plays "You learned more and less! Now you can do zeros!".
- **Adding big numbers:** zeros mastered. The Map plays "A new land! Land 6: Bigger numbers!".
- **Snail words:** sheep stories mastered. The Map plays "A new land! Land 9: More words and stories!". Moon words follow snail words, goat stories follow moon words.
- **A learner who finished a world before this build:** wave 1's load rule (K13) opens the new step on launch, with no new code.
- **No guard change.** The progress guard reads any whole number from 0 up since #597 (`packages/core/src/progress/guards.ts:209-222`). The largest answer here is 740, and a zero-drop tap records a two-digit value (18, 19).

## Decisions

- **K1.** Step 16 is `hundreds-zeros`, spoken "zeros", the 3rd stop of Number Garden land 5 "Hundreds". It reuses `PlaceValueStage`; its one new look is the empty tray.
- **K2.** Step 17 is `add-two-digit`, spoken "adding big numbers", the first stop of a new Number Garden land 6, "Bigger numbers". Its problems stay `kind: 'arithmetic'` (the read parses with today's addition template, `packages/core/src/math/planFromServer.ts:579`), and its stage, frame and chips follow the problem's step, the seam two-digit chips and mixed sessions already use (`mobile/src/screens/math/problemChips.ts:58-74`). `PlaceValueStage` draws two trays (tens, ones) under today's equation. The one new motion is the bundle: ten cubes become a rod and move to the tens tray (§ 3.5).
- **K3.** Snail words and moon words are land-6-format steps: rows in `BIG_WORDS_STEPS`, served as `cvc-word`. Dave's 8 words and traps, my gentle pairs (§ 4.2, § 5.2).
- **K4.** Wave 4's per-step chip rows carry these rows unchanged. **No word collides this wave:** none of the 16 targets has a pack entry or a `TARGET_PAIRINGS` row today (scratch check over `ALL_WORDS` and `TARGET_PAIRINGS`, 2026-10-19), so both spreads add them and skip nothing.
- **K5.** Goat stories use sheep stories' format exactly: one canon file of 8 stories, the question word mixed after P3 (§ 7).
- **K6.** A new Word Song land 9, "More words and stories", holds snail words, moon words and goat stories. Land 8 is a full trio.
- **K7.** 16 new pack pictures (the targets) and 8 scenes (§ 10). The scenes use the new pictures as references, so they are generated after Thomas approves the snail and moon contact sheets.
- **K8.** Zeros records no Leitner fact (as hundreds). Adding big numbers records what the two-digit steps record, `{ a, b, op }` per problem (`packages/core/src/progress/canonMathFacts.generated.ts:67-76`), so its blocks can be warm-up hearts. Goat-story blocks are never warm-up hearts (`STORY_NODES` widens). Mastered blocks of all five steps join reviews.

Mastery, the fast track, the pace guard, reviews, peeks and Map replays behave as on the siblings. No timer, currency, streak or loss mechanic.

## 1. Steps, lands, names and path art

| Step             | After             | Land, stop                             | Spoken name        | Verb | Recap phrase       | Canon file                            |
| ---------------- | ----------------- | -------------------------------------- | ------------------ | ---- | ------------------ | ------------------------------------- |
| `hundreds-zeros` | `hundreds-addsub` | NG 5 Hundreds, 3/3                     | zeros              | are  | zeros              | `math/level-1/hundreds-zeros.json`    |
| `add-two-digit`  | `hundreds-zeros`  | NG 6 Bigger numbers (new), 1/1         | adding big numbers | is   | adding big numbers | `math/level-1/add-two-digit.json`     |
| `snail-words`    | `sheep-stories`   | WS 9 More words and stories (new), 1/3 | snail words        | are  | reading words      | `word-song/level-1/snail-words.json`  |
| `moon-words`     | `snail-words`     | WS 9, 2/3                              | moon words         | are  | reading words      | `word-song/level-1/moon-words.json`   |
| `goat-stories`   | `moon-words`      | WS 9, 3/3                              | goat stories       | are  | reading stories    | `word-song/level-1/goat-stories.json` |

- **`LANDS`** (`packages/core/src/progress/lands.ts:49-54`, `:104-111`): land 5 becomes `nodes: ['hundreds', 'hundreds-addsub', 'hundreds-zeros']`; a new `{ world: 'math', number: 6, name: 'Bigger numbers', nodes: ['add-two-digit'] }` follows it; a new `{ world: 'word-song', number: 9, name: 'More words and stories', nodes: ['snail-words', 'moon-words', 'goat-stories'] }` follows land 8.
- **Why these names:**
  - "zeros" is the step's new idea, and _zero_ is already spoken ("Yes! Zero!" is committed canon). "adding big numbers" says what the step does; every word is in use, and it differs from "big numbers" (`two-digit-addsub-no-regroup`, `packages/core/src/sessionEnd/friendlyNodeName.ts:153`).
  - "Bigger numbers" is the two-digit steps' recap phrase today (`friendlyNodeName.ts:66-67`), so the land name costs no word, and it follows land 3 "Big numbers".
  - Snail, moon and goat are step words with clear pictures, as bee, car and sheep were; none is a stop yet. "More words and stories" uses only words in use and says land 9 holds what land 8 holds.
- **The ids** follow the siblings: `hundreds-*` for the hundreds deepening, and `add-two-digit` beside `add-to-10` / `add-to-20`, leaving room for a later `sub-two-digit` in land 6.

**Map fit (hand-computed from `landscapeNeed`, anchored on the measured 8-land figures in `mobile/src/layout/mapScreenLayout.test.ts:198-216`; not measured).**

- **Number Garden portrait:** 6 lands = `PORTRAIT_FIT_LANDS` (`packages/core/src/map/mapLayout.ts:323`), so the path is laid out in the pane and does not scroll (`mobile/src/layout/mapScreenLayout.ts:239`). When Word Song had 6 lands, land 1 ended 13.6 pt below the pane at 820×1180 (`mapLayout.ts:315-317`; the bar is 14, `mapScreenLayout.test.ts:159-160`), so a 6th Number Garden land is close to that bar. If the build's map test misses it, `PORTRAIT_FIT_LANDS` drops to 5 and Number Garden scrolls on portrait on Word Song's shipped path (T6).
- **Number Garden landscape:** `landscapeNeed(6, 1)` = 6 × 136 + 5 × 40 + 96 + 60 = 1,172 virtual px (`mapLayout.ts:303-311`; Emma's room 96 px is what the measured 8-land scales imply). TL fits: 1180×820 at 0.669 (0.618 in the unlock beat into land 6), 1133×744 at 0.604 (0.558). L keeps scrolling at 0.45, a 527 pt path (448 today, `mapScreenLayout.test.ts:153`).
- **Word Song, 9 lands:** `landscapeNeed(9, 1)` = 1,700 px, + 176 for the 9th band, as wave 4 counted.
  - Portrait scrolls as today, 176 × s pt longer: 777 pt at 375×667, 892 at 430×932, 1,542 at 744×1133, 1,700 at 820×1180.
  - **1180×820** fits at 0.461 with Emma in one land. Only the unlock beat into land 9 (two badge lands, 1,796 px) scrolls, at the 0.45 floor: an 808 pt path in the 784 pt pane.
  - **1133×744** now scrolls on every visit at 0.45: 765 pt in the 708 pt pane (808 in the beat). Today it fits at 0.4645 (`mapScreenLayout.test.ts:210`).
  - L: 765 pt at 0.45. The build's `mapScreenLayout.test.ts` confirms or corrects every number (T6).

**Path art: 7 clay pieces** (wave 1 § 5.4's pipeline; no digits, letters or signs):

| Id               | Subject                                                                                                                    | Must not look like                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `hundreds-zeros` | A ring doughnut: a golden base, warm-brown chocolate icing, a few cream sprinkles, a clear round hole in the middle        | the cake (`cake-words`), the hoop picture (moon words), the bun picture, a wheel                                                     |
| `add-two-digit`  | A small wooden abacus: a warm-brown frame and three wires of round beads in rose, cream and green, some pushed to the left | the socks on a washing line (`mult-2-5-10`), the hundred-flat (`hundreds`), the bundle of ten sticks (`two-digit-addsub-no-regroup`) |
| `land-ng-6`      | A big round orange pumpkin with soft ribs, a short green stem and one curly leaf                                           | the apple tree (`land-ng-5`), the peach picture, the sun picture                                                                     |
| `snail-words`    | A snail: a round rose-and-cream spiral shell, a soft grey-green body, two eye stalks                                       | the ladybird (`bug-stories`), the doughnut (`hundreds-zeros`)                                                                        |
| `moon-words`     | A plain pale-yellow crescent moon, no face                                                                                 | the smiling star (`sight-words`), the sun picture, a banana                                                                          |
| `goat-stories`   | A goat standing: cream-white, two small curved horns, a little pointed beard                                               | the sheep (`sheep-stories`), the dog (`cvc-words-short-o`), the fox (`fox-stories`)                                                  |
| `land-ws-9`      | A small castle: a cream wall with a rose door and two round towers with pointed warm-brown roofs, no flag                  | the windmill (`land-ws-8`), the puppet theatre (`land-ws-7`), the house (`ui-house`), the barn picture                               |

`PATH_ART_SET` + 5 step ids; `LandArtId` + `'land-ng-6'`, `'land-ws-9'` (`packages/core/src/emmasPath/pathArt.ts:27-40`). Land subjects in use: `design/emmas-path/emmas-path-spec.md` § 5.3 plus waves 1–4 (toy train, apple tree, puppet theatre, windmill). A kite was the first land-9 idea; it is out, because _kite_ is a pack picture.

## 2. NG step 16: zeros (`hundreds-zeros`)

### 2.1 The step

After `hundreds-addsub` in `MATH_TREE` and `MATH_NODES_IN_ORDER`, default `'locked'`. The same 8 canon problems every session (§ 2.7). The math preset for mastery, fast track, pace guard, peek and replay (secure = 8/8 on the first tap). It is a hundreds deepening, so 2.NBT.A.1b's zeros and 2.NBT.A.3's number names come here (Dave's M12).

### 2.2 What the learner sees

P1, phone portrait (375×667), after the read has built the number:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ◉ ○ ○ ○ ○ ○ ○            |
| (Emma) | Three hundreds, | |
| (147 ) | no tens and     | |
|        | five ones. What | |
|        | number is it?   | |
|  ▦▦▦        .----.  ▪     |  3 flats; the tens tray EMPTY;
|  ▦▦▦        |    |  ▪▪▪▪  |  5 cubes
|   (?)        (?)    (?)    |  "?" tags
| [305]     [505]    [705]   |  chips
+----------------------------+
```

- **The empty tray** is hundreds' cream tray at its plan width, with nothing in it: no dashed outline, no "0" drawn inside. Empty means nothing there. Its tag reads "?" until a hint, the given answer or a right tap fills it with "0".
- **P5** ("Find one hundred and ninety.") opens with all three trays empty and "?" tags; nothing is built on the read (§ 2.4).
- **P6–P8** are hundreds' "more" layout: the number tag with its pill ("+10", "+100", "−10") and the start blocks from the first frame. A zero in the start number shows as an empty tray whose tag reads "0" from the first frame (P6's 305: the tens tray).
- Layout, glyphs, tags and placement are hundreds' (`content-wave-3.md` § 3.2). Digits only; no "=".

### 2.3 Layout and sizes

`extendedMathLayout(viewport, 'place-value')` as hundreds. The canon's largest counts at any point are 7 flats (P3, P7's answer), 6 rods (P2) and 8 cubes (P4): hundreds' maxima, so `content-wave-3.md` § 3.3's u, widths and heights stand on all four forms. `placeValueMetrics` already keeps every tray at least one unit wide (`mobile/src/layout/mathLayout.ts:1434-1436`), so an empty tray keeps its width. The "−10" pill is as wide as wave 4's "−30". Reads are 28–57 characters, inside hundreds' slot (P keeps `maxLines={4}`). The zero-drop chips "18" and "19" are narrower than any three-digit chip.

### 2.4 Beats, problem by problem

- **Lead** (scored P1, forward sessions until mastered): "No tens? Zero tens!". The (still empty) tens tray pulses on each "tens" word tick, hundreds' lead pulse on one tray. 400 ms, then the read. (Dave gave no lead; D2.)
- **Read, P1–P4, builds the number:** on the word tick of "hundred(s)" the flats drop in, on "tens" the rods, on "ones" the cubes (hundreds' build). **A zero place** ("no tens") drops nothing: on its word tick the empty tray pulses once (the tag pulse that ends every build, 1 → 1.1 → 1, 300 ms), so the place visibly is done with nothing in it.
- **Read, P5:** nothing is built; the trays stay empty with "?" tags.
- **Read, P6–P8:** hundreds' and wave 4's: the number tag pulses on the first word tick, the pill on "ten" / "hundred". Nothing moves on the read.
- **Wrong 1, 2:** "Hmm... try again?", poof, shake, `puzzled-tilt`. The picture doesn't change.
- **Hints** (600 ms after the 2nd wrong's reprompt):
  - **P1–P5 (Dave's zero ladder):**
    1. "Look at the tens." / "Look at the ones." (the first zero place): that tray ripples.
    2. "Zero tens." / "Zero ones." (P3: "Zero tens and zero ones."): the empty tray pulses and its tag fills "0". On P5 the number builds now (flats, rods, cubes in place order, hundreds' build drop), then the empty ones tray pulses.
    3. The read's question ("What number is it?"; P5 "Find one hundred and ninety."): the other tags fill left to right, so the tags read the answer.
  - **P6, P7 (+10, +100, hundreds' ladder):** "Look at the tens." / "Look at the hundreds."; "One more ten." / "One more hundred." (the block drops in with its own pill and the tag ticks, P6's tens tag 0 → 1); "What is ten more?" / "What is one hundred more?".
  - **P8 (−10, wave 4's ladder at count 1):** "Look at the tens."; "Take away one ten." (the rod lifts out, the tens tray is left empty, and its tag turns "?"); "What is ten less?".
- **giveAnswer** (3rd wrong): what hasn't moved moves at once, every "?" tag fills at once with sharing's 4 pt `colors.myRose` ring, and the guided tap plays the correct moment.
- **Correct** ("Yes! Three hundred and five!"): open tags fill left to right and the trays pulse once; on P6–P8, hundreds' and wave 4's correct moment (P8's tens tag ticks to "0"). Burst, sparkle, plink, `celebration`; 250 ms exit.

### 2.5 Motion brief (Reanimated; Reduce Motion in brackets)

No new motion. The zero-place pulse is the build's tag pulse, played on the word tick instead of after the last block [none]. P5's hint-2 build is hundreds' build drop [the trays fade in over 150 ms]. P8's lift-out is wave 4's, with one rod [200 ms fade, no rise]. Everything else is `content-wave-3.md` § 3.5 and `content-wave-4.md` § 2.5.

### 2.6 Data model, parser, chips, session end

**Widen `PlaceValueProblem`** (`packages/core/src/math/extendedProblems.ts:211`). Exact names, for Kevin's core PR and Devon's stage PR:

```ts
export interface PlaceValueProblem {
  kind: 'place-value'
  index: number
  hundreds: number // 1..9 (hundreds keeps 2..9 by its lint)
  tens: number // 0..9
  ones: number // 0..9
  spokenOrder: readonly PlacePart[] // the 'name' form: PLACE_PARTS
  form: 'places' | 'name' // new: 'name' is "Find <number>."
  correct: number
  utterances: MathProblemUtterances
}
```

**Read templates:**

- **place-value (widened, `matchPlaceValueRead`, `planFromServer.ts:797`):** a place's word may also be _no_ (0, with the plural place: "no tens") or _one_ with the singular _hundred_ ("One hundred, …"). Rejected: _one_ with tens or ones ("one ten" is awkward English), _no hundreds_ (below 100), a place named twice.
- **name (new):** `Find <number>.`, the number in British words, 100–999. No committed math read begins "Find" (word scan of `public/canon/math/level-1/*.json`, 2026-10-19), so it is disjoint.
- **more (widened, `matchMoreRead`, `planFromServer.ts:885`):** a zero digit may sit in the start or the answer, and the changed digit may become 0 (P8's 416 → 406). Still: no regrouping, hundreds digit ≥ 1, answer in 100–999.
- **Per file** (the splice lint, not the parser): `hundreds` and `hundreds-addsub` keep their no-zero, digits-2–9 rules. `hundreds-zeros`: at least one zero in every start or answer; in the build reads (P1–P4) a 1 appears only in the hundreds.
- Before merge, all 8 `math.p*.read` lines parse.
- **The comment at `extendedProblems.ts:209`** ("P5 names the places in Danish order") is rewritten when this file is touched, as Dave's corrections ask: places named out of order are an expanded form (2.NBT.A.3) that can't be solved by copying digits in the order heard.

**Chips** (`hundredsDistractors`, `packages/core/src/math/extendedDistractors.ts:282`):

- **P1–P3, `'gentle'`:** hundreds' rule, the hundreds digit + 2 and + 4 (− 2 and − 4 above 5).
- **P4–P5, `'zero-drop'` (new) + `'digit-swap'`:** a place-value problem with a zero digit, on P4 and later, offers the number with its zero left out (108 → 18) and the tens and ones swapped (108 → 180). The zero-drop chip is the only chip allowed in 10..99; every other chip stays in 100–999 (`HUNDREDS_CHIP_MIN`, `:62`). Hundreds' canon has no zero, so its chips don't change.
- **P6–P8, `'wrong-place'`:** a count-1 problem of either direction takes hundreds' rule, signed by its direction: the other two of ± 1, ± 10, ± 100 (P8: 415, 316). Today a count-1 "less" would fall into more and less's `moreAndLessTrap` (`:245`) through `isMoreAndLess` (`extendedProblems.ts:347-351`); no shipped canon has one. The stage keeps routing count-1 "less" through more and less's lift-out (`moreBlocksMoveOnRead`, `:365`), which is what P8 needs.
- **Recorded class:** P1–P3 `'gentle'`, P4–P5 `'zero-drop'`, P6–P8 `'wrong-place'`. `HundredsOfferedClass` (`extendedDistractors.ts:77`) gains `'zero-drop'`.
- All three chips differ. Shuffled by `buildExtendedChipOrder`, as today.

**Session end:** `perProblemCorrect`, `latencyMs`, `perProblemAnswerValue` and `perProblemDistractorClass` as hundreds; no `mathFacts`, no Leitner outcome; `CANON_MATH_FACTS['hundreds-zeros']` = 8 nulls.

### 2.7 Canon (binding: the splice writes exactly this)

Dave's suggested canon, checked against his rules (a zero in every start or answer; no regrouping; maxima 7 / 6 / 8; a 1 only in the hundreds of the build reads; three different chips).

| P   | Read (characters)                                                | Answer | Blocks move | Chips (correct first) | Class       |
| --- | ---------------------------------------------------------------- | ------ | ----------- | --------------------- | ----------- |
| 1   | "Three hundreds, no tens and five ones. What number is it?" (57) | 305    | on the read | 305, 505, 705         | gentle      |
| 2   | "Four hundreds, six tens and no ones. What number is it?" (55)   | 460    | on the read | 460, 660, 860         | gentle      |
| 3   | "Seven hundreds, no tens and no ones. What number is it?" (55)   | 700    | on the read | 700, 500, 300         | gentle      |
| 4   | "One hundred, no tens and eight ones. What number is it?" (55)   | 108    | on the read | 108, 18, 180          | zero-drop   |
| 5   | "Find one hundred and ninety." (28)                              | 190    | at hint 2   | 190, 19, 109          | zero-drop   |
| 6   | "Three hundred and five. What is ten more?" (41)                 | 315    | at hint 2   | 315, 306, 405         | wrong-place |
| 7   | "Six hundred and forty. What is one hundred more?" (48)          | 740    | at hint 2   | 740, 641, 650         | wrong-place |
| 8   | "Four hundred and sixteen. What is ten less?" (43)               | 406    | at hint 2   | 406, 415, 316         | wrong-place |

- **Per problem:** correct "Yes! <answer in words>!" (19–31 characters); giveAnswer "This one is <answer in words>." (26–38); reprompt "Hmm... try again?" (reused); hints per § 2.4 (new: "Zero tens." 10, "Zero ones." 10, "Zero tens and zero ones." 24, "What number is it?" 18, "Take away one ten." 18, "What is ten less?" 17; the rest reused). Recap "You worked on zeros today!" (26).
- **Why this order (Dave's):** P1–P3 put the zero in each place; P4 starts with "one hundred"; P5 is M13's harder "lexical" zero (190 against 109); P6–P8 fill a zero, keep one and make one.

## 3. NG step 17: adding big numbers (`add-two-digit`)

### 3.1 The step

After `hundreds-zeros` in `MATH_TREE` and `MATH_NODES_IN_ORDER`, default `'locked'`. The same 8 canon problems every session (§ 3.7). The math preset (secure = 8/8 on the first tap). Two-digit + two-digit within 100, mostly with a new ten (2.NBT.B.5, Dave's M12). Every regroup problem hides a fact within 20 (8 + 5), and the efficient route is tens with tens and ones with ones (Dave's M16). Counting the ones on fingers stays fine.

### 3.2 What the learner sees

P3, phone portrait, after the read and the bundle:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ● ◉ ○ ○ ○ ○ ○            |
| (Emma) | Twenty-eight    | |
| (147 ) | plus thirty-    | |
|        | five. How many? | |
|          28 + 35           |  today's equation, 72 pt
|  ▮▮▮▮▮▮          ▪         |  tens: 2 + 3 rods + the new ten;
|  ▮▮▮▮▮▮          ▪▪        |  ones: the 3 left over
|    (?)           (?)       |  "?" tags
|  [63]     [43]     [83]    |  chips
+----------------------------+
```

- **Parts:** today's equation on top ("28 + 35", the arithmetic glyphs and sizes), then `PlaceValueStage` with two trays, tens and ones, left to right. No hundreds tray, no number tag, no pills: the equation is the number.
- **From the first frame:** the equation, the first number's blocks (P3: 2 rods, 8 cubes), and "?" under both trays.
- **The second number's blocks** drop in after the first number's: its rods right of the first rods, its cubes continuing the first cubes' columns (bottom up, left column first). P3's ones tray then holds 13 cubes: columns of 5, 5 and 3.
- **The bundle** (§ 3.5): when the ones tray holds ten or more, its first ten cubes become one rod, which moves to the tens tray.

### 3.3 Layout and sizes

The place-value frames: `extendedMathLayout(viewport, 'place-value')`, so L takes the chip column and the 2-line ribbon. A step-17 problem reports `'place-value'` to App's frame (`onProblemKindChange`), though its kind is `'arithmetic'`: the frame follows the stage. On P, TP and TL these are the arithmetic frames already (`mathLayout.ts:616-633`).

- **Counts:** the canon's largest at any point are 9 rods (P8's answer) and 14 cubes (P6 before the bundle, 3 columns): Dave's layout risk.
- **Width** = tens (1.3 × 9 − 0.3 + 1) u + ones (1.3 × 3 − 0.3 + 1) u + g = 17u + g (g = 12, tablet 16).
- **Height** = the equation line + the form's equation-to-visual gap + 11u (a rod's 10u + the tray pad) + the tag row (36, tablet 42).
- **u** = the largest whole number ≤ 10 (tablet ≤ 20) that fits the problem rect. Hand-computed against the rects of `content-wave-3.md` § 3.3:

| Form (problem rect)   | Equation line | u   | Width | Height         |
| --------------------- | ------------- | --- | ----- | -------------- |
| P 375×667 (343×272)   | 79 (72 pt)    | 10  | 182   | 79+24+146=249  |
| L 667×375 (376×189)   | 62 (56 pt)    | 7   | 131   | 62+8+113=183   |
| TP 744×1133 (712×530) | 106 (96 pt)   | 20  | 356   | 106+24+262=392 |
| TL 1133×744 (892×317) | 106 (96 pt)   | 13  | 237   | 106+24+185=315 |

- **Risk:** L's u = 7 is below hundreds' 8 there, and TL has 2 pt to spare. The build's layout test asserts the table; the device check judges 7 pt cubes in L (AC 16).
- **Chips:** two digits, the arithmetic chip sizes. **Ribbon:** reads are 36–40 characters.

### 3.4 Beats, problem by problem

- **Lead** (scored P1, forward sessions until mastered): "Tens and ones!". The two trays pulse left to right on its word ticks (hundreds' lead pulse). 400 ms, then the read. (Dave's "Make a ten!" doesn't fit P1, which makes no ten; D4.)
- **Read:**
  - **P1–P3** (their blocks move on the read): on the word tick of the second number ("thirty-five") its rods drop in, then its cubes. On P3, when the cubes have landed and the ones tray holds ten or more, the bundle plays.
  - **P4–P8:** nothing moves; the first number's blocks and the equation are the picture (fading, Dave's M10, as wave 4's start blocks).
  - Chips open on `onPlay`, as today.
- **Wrong 1, 2:** "Hmm... try again?", poof, shake, `puzzled-tilt`. The picture doesn't change.
- **Hints** (600 ms after the 2nd wrong's reprompt); a step-17 problem sets `hintStep`, as the extended kinds do, not arithmetic's `hintBeat`:
  1. "Look at the ones.": the ones tray ripples.
  2. P1–P2 "Look at the tens." (the tens tray ripples). P3–P8 "Ten ones make a ten.": on P4–P8 the second number's blocks drop in and the bundle plays on the word tick "make"; on P3, already bundled, the tens tray ripples. On every problem the ones tag fills with the answer's ones digit.
  3. "How many?": the tens tag fills, so the tags read the answer.
- **giveAnswer** (3rd wrong): blocks that haven't moved move at once and the bundle lands in its end state; both tags fill with sharing's rose ring; the guided tap plays the correct moment.
- **Correct** ("Yes! Sixty-three!"): blocks that haven't moved move fast (spring 300 / 22; the bundle in 250 ms); the tags fill left to right; the trays pulse once. Burst, sparkle, plink, `celebration`; 250 ms exit.

### 3.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Drop-in (the second number):** wave 4's many-block drop: each block starts 40 pt above its tray, spring 220 / 18, `BUILD_STAGGER_MS` (90 ms, `mobile/src/screens/math/PlaceValueStage.tsx:101`) apart, rods first, no pills. Longest: P8's 2 rods + 7 cubes, about 0.8 s + the last spring. On a fast right tap: spring 300 / 22. [200 ms crossfade per block.]
- **The bundle (new), about 1.1 s:**
  1. **Gather, 300 ms:** the second column's five cubes slide up and left onto the first column, 40 ms apart, spring 260 / 20, so the first ten cubes stand as one column 10u tall.
  2. **Fuse, 150 ms:** the ten cubes crossfade into one `RodGlyph` in the same place. A rod is drawn as 10 cells (`content-wave-3.md` § 3.2), so nothing jumps.
  3. **Carry, about 450 ms:** the rod rises 12 pt (tablet 16) and arcs to the next free rod slot in the tens tray, spring 220 / 18; the tens tray ripples as it lands (1 → 1.06 → 1, 300 ms).
  4. **Settle, 200 ms `EASE_OUT`:** the cubes left in the third column slide left into the first.
  - On a fast right tap: all four in 250 ms, spring 300 / 22, no ripple. The given answer: the end state at once.
  - [Reduce Motion: the ten cubes fade out over 200 ms while the rod fades in at its tens slot; the leftover cubes crossfade into the first column. No rise, arc or ripple.]
- The tens tray's width holds the answer's rods, so the new rod always has a slot. One shared value per moving block via `withDelay`, at most 15 (14 cubes + the rod). Rotation mid-move lands every block in its end state. No new sounds.

### 3.6 Data model, chips, session end

- **No new kind, no parser change.** The read parses with the addition template (`planFromServer.ts:579`) to `{ kind: 'arithmetic', addendA, addendB, op: '+', correct }`.
- **Which problems draw the trays:** a new core list, `PLACE_VALUE_ARITHMETIC_NODES: readonly SkillNode[] = ['add-two-digit']`, exported from `extendedProblems.ts`. An arithmetic problem whose step (its `problemNodes` entry, else the focus node) is in it draws `PlaceValueStage`'s two-tray form, takes the place-value frame and the chips below. A later `sub-two-digit` joins the list.
- **`PlaceValueLayoutProblem`** (`mathLayout.ts:1328`) gains `{ kind: 'arithmetic'; addendA: number; addendB: number; correct: number }`, laid out with two trays (§ 3.3).
- **Chips:** a new core function `addTwoDigitDistractors(correct: number, index: number): [number, number]`, called from `problemChips` (`mobile/src/screens/math/problemChips.ts:58`) for those problems and shuffled with the arithmetic LCG. `buildChipOrder` (the web's verbatim copy, `chipOrder.ts:35-37`) is not touched.
  - **P1–P3:** the answer ± 20 (the tens digit ± 2), as Dave set: 59 → 39, 79.
  - **P4–P8:** `'forgotten-carry'` (the answer − 10, the lost new ten) and `'off-by-one'`, + 1 on even positions and − 1 on odd ones, so the direction alternates (Dave's table). Today's `forgottenCarryDistractors` always takes − 1 (`distractors.test.ts:1324`: 33 → 23, 32), so it is not reused as is.
  - All chips in 1–99 with no zero digit (the canon's rule).
  - **Recorded class:** `null` on P1–P3 (the arithmetic tiers' convention, `chipOrder.ts:97-102`), `'forgotten-carry'` on P4–P8.
- **Session end:** as the two-digit steps: `mathFacts` per problem and `CANON_MATH_FACTS['add-two-digit']` = the 8 `{ a, b, op: '+' }` facts (K8). The two-digit Leitner rules apply unchanged (`isLeitnerDirectiveActive` stays `add-to-10` only, `api/_planner.ts:684-696`).

### 3.7 Canon (binding: the splice writes exactly this)

Dave's canon, checked against his rules (both addends 11–89 with no zero digit; answers 21–99 with no zero digit; P1–P2 without a new ten; ones sums 12, 13, 14).

| P   | Read (characters)                               | Answer | New ten | Blocks move | Chips (correct first) | Class           |
| --- | ----------------------------------------------- | ------ | ------- | ----------- | --------------------- | --------------- |
| 1   | "Thirty-four plus twenty-five. How many?" (39)  | 59     | no      | on the read | 59, 39, 79            | gentle          |
| 2   | "Forty-two plus thirty-six. How many?" (36)     | 78     | no      | on the read | 78, 58, 98            | gentle          |
| 3   | "Twenty-eight plus thirty-five. How many?" (40) | 63     | yes     | on the read | 63, 43, 83            | gentle          |
| 4   | "Forty-seven plus twenty-six. How many?" (38)   | 73     | yes     | at hint 2   | 73, 63, 74            | forgotten-carry |
| 5   | "Thirty-nine plus forty-four. How many?" (38)   | 83     | yes     | at hint 2   | 83, 73, 82            | forgotten-carry |
| 6   | "Fifty-six plus twenty-eight. How many?" (38)   | 84     | yes     | at hint 2   | 84, 74, 85            | forgotten-carry |
| 7   | "Twenty-nine plus thirty-three. How many?" (40) | 62     | yes     | at hint 2   | 62, 52, 61            | forgotten-carry |
| 8   | "Sixty-five plus twenty-seven. How many?" (39)  | 92     | yes     | at hint 2   | 92, 82, 93            | forgotten-carry |

- **Per problem:** correct "Yes! <answer>!" (15–19 characters); giveAnswer "This one is <answer>." (22–26); reprompt (reused); hint1 "Look at the ones." (reused); hint2 "Look at the tens." (P1–P2, reused) or "Ten ones make a ten." (P3–P8, 20); hint3 "How many?" (reused, the multiplication canon's hint 3). Recap "You worked on adding big numbers today!" (39).
- **Blocks:** P6 peaks at 14 cubes (6 + 8), P8 ends at 9 rods.

## 4. WS step 22: snail words (`snail-words`)

### 4.1 The step

- **SkillNode `snail-words`**, after `sheep-stories` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`. Default `'locked'`.
- **Format:** `cvc-word` as land 6 and bee words have it: "Read the tray.", the word card with its letter row, three picture chips, the 1500 ms silent beat, the chip gate, the hint "Let's look. Tray.", the given answer. No blend clip.
- **8 words** from canon in this order every session; P1–P3 play the gentle pair, P4–P8 the trap pair; every row carries both.
- **ai/ay and oa** say the first letter's name, the idea bee words taught (Dave's R10: UFLI lessons 84 and 86). The teams alternate a, o, a, o … so neither is a blocked run. Every word takes "Yes! That's a <word>.".

### 4.2 Word list and chip pairs (canon order)

| P   | Word  | Team | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap (Dave)                       |
| --- | ----- | ---- | --------- | -------------- | ------------ | ----------------------------------------- |
| 1   | tray  | ay   | household | hen, cup       | tree, train  | tree: ay against ee; train: read on       |
| 2   | boat  | oa   | vehicle   | sun, jug       | bat, bone    | bat: boat without the o; bone: o_e        |
| 3   | snail | ai   | animal    | cup, bed       | seal, sack   | seal: s…l, ai against ea; sack: short a   |
| 4   | coat  | oa   | clothing  | hen, bus       | cot, goat    | **cot: coat without the a**; goat: rhyme  |
| 5   | train | ai   | vehicle   | nut, pen       | chain, tray  | chain: rhyme; tray: the same start        |
| 6   | loaf  | oa   | food      | sun, bed       | leaf, log    | **leaf: oa against ea**; log: l, short o  |
| 7   | goat  | oa   | animal    | cup, net       | gum, coat    | gum: g, short u; coat: rhyme              |
| 8   | chain | ai   | object    | bug, sun       | can, train   | can: ch as c, ai as short a; train: rhyme |

- **Gentle pairs** (mine, D5): another category, another first sound, and no letter of the target's team. All ten gentle words have e or u as their vowel, so none holds an a, i, o or y. Categories are the pack's (`wordPack.ts`: cup `vessel`, sun `celestial`, pen `stationery` …).
- **P1 must be _tray_:** the only word ending in its team, so the `'ending-pair'` cue lights a y.
- **`BigWordRow.vowel`:** `'a'` for ai/ay rows, `'o'` for oa rows (the team's first letter, which says its name).
- **Phoneme tags:** no target is tagged, so `gum`'s `/g/` tag (`wordPack.ts`) raises nothing (`packages/core/src/wordSong/wordDistractors.ts:174-191` checks only a tagged target).
- **Reserves** if a picture fails twice: _nail_, _brain_ (ai); _toad_, _goal_ (oa; they need `toad–frog` and `goal–net`). A swap changes a row, so it goes back through Dave.
- **Kept out** (Dave): _tail_, _sail_, _rain_, _paint_, _hay_, _soap_, _toast_, _oak_, _oar_, _pail_, _plait_, _cloak_, _hair_, _chair_.

### 4.3 Intro lead

"Two letters, one sound!" (duck words' text, reused, so no render) with duck words' cue: the word's last two cells light together (`'ending-pair'`, `mobile/src/screens/wordSong/introSpotlight.ts:34-42`). On P1, _tray_, they are a y. Then the 1500 ms silent beat, then "Read the tray.". No cue on the hint.

## 5. WS step 23: moon words (`moon-words`)

### 5.1 The step

As § 4.1, after `snail-words`. **oo says /uː/**, a new sound, as ar was (UFLI lesson 90, Dave's R10). _moon_ comes before _book_'s short oo for picture supply (Dave). Lily is British: _roof_ is /ruːf/, never /rʊf/.

### 5.2 Word list and chip pairs (canon order)

| P   | Word  | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap (Dave)                      |
| --- | ----- | --------- | -------------- | ------------ | ---------------------------------------- |
| 1   | moon  | celestial | hen, cup       | mop, spoon   | mop: m, short o; spoon: rhyme            |
| 2   | spoon | kitchen   | bug, jet       | sock, moon   | sock: s, short o; moon: rhyme            |
| 3   | boot  | clothing  | fan, pig       | box, bone    | box: b, short o; bone: o_e               |
| 4   | broom | household | hen, sun       | brick, boot  | brick: br, short i; boot: the team       |
| 5   | tooth | body-part | cup, pig       | top, boot    | top: t, short o; boot: the team          |
| 6   | stool | household | jet, hen       | star, spoon  | star: st, ar against oo; spoon: the team |
| 7   | hoop  | object    | bus, cup       | hot, roof    | hot: h, short o; roof: the team          |
| 8   | roof  | structure | bed, fan       | rock, rope   | rock: r, short o; rope: o_e              |

- **Gentle pairs** (mine, D5): another category, another first sound, and no o.
- **`BigWordCategory`** (`packages/core/src/wordSong/bigWordsSteps.ts:37-50`) gains `'kitchen'` (_spoon_; the pack's _pan_ and _pot_ are `kitchen` already). `BigWordRow.vowel` is `'o'` for every row.
- **_tooth_** uses th, which `digraphs-th-voiceless` taught.
- **Weakest** (Dave's hypothesis): _roof_ and _hoop_. _pool_ is the only reserve; a failing word goes back through Dave.
- **Kept out** (Dave): _goose_, _food_, _zoo_, _balloon_.

### 5.3 Intro lead and the new cue

"Two letters, one sound!" (reused) plays before P1's silent beat in forward sessions until mastered. No picturable oo word ends in oo, so the cue is new:

- **`'team-pair'`** (new `Pattern` in `introSpotlight.ts:34`): the two cells of the first "oo" in the word light together, at once, on `LetterRow`'s rose spotlight. On P1, _moon_, they are the 2nd and 3rd cells. `PATTERNS` maps `'guide.session.intro.moon-words'` to it. Reduce Motion: the same cells light, without the pulse (the shipped spotlight rule).
- **Lint:** P1 of moon words must hold "oo"; P1 of snail words must end in its team.
- No cue on the hint: the letters pulse silently and "Let's look. Moon." plays.

## 6. Per-step chip rows (K4)

The 16 rows go into `BIG_WORDS_STEPS` as 2 steps (`BigWordsStep` + `'snail-words'`, `'moon-words'`; `BIG_WORDS_STEP_IDS`). A land-6-format problem already carries its own step's row through reviews (wave 4 § 5). Because no new word has a row or an entry, the `TARGET_PAIRINGS` spread and the pack-entry spread add all 16 and skip none. **AC:** a snail-words P4 deals coat, cot, goat; a moon-words P1 deals moon, hen, cup.

## 7. WS step 24: goat stories (`goat-stories`)

### 7.1 The step

- **SkillNode `goat-stories`**, after `moon-words`. Default `'locked'`. The Word Song preset (secure = 8/8 on the first tap); no graduation gate.
- **Format: sheep stories' exactly** (`content-wave-4.md` § 6.1, wave 3 § 4.2–§ 4.6): `StoryCard`, decode first, the reading beat, look-back, word taps and the first-card tap cue, the 2nd-wrong read, the scene only after the answer. P1–P3 ask Who, What, Where with gentle chips; P4–P8 ask What, Who, Where, Who, What.
- **Nothing else new** (Dave): the open land-7 question (first-tap answers on story questions) argues against more difficulty. If first-tap answers prove low, the splice regroups the canon by question word (wave 4's T5), with no build change.
- **Lead:** "Read the story. Who, what or where?" (reused).
- **Data:** `StoryNode` (`packages/core/src/wordSong/littleStories.ts:18-22`) gains `'goat-stories'`; `STORY_NODES` gains it, so warm-ups skip its blocks. Ids `'goat-1'` … `'goat-8'`; scenes `mobile/assets/scenes/story-goat-<n>.webp`; a `goat` row builder; `prep` on the Where rows.

### 7.2 The 8 stories (binding: the splice writes exactly this)

Each problem also has "Hmm... try again?" (reused) and "This one is the <answer>." (21–22 characters). Correct lines: "Yes! The <answer>!", or "Yes! <In/On> the <answer>!" for Where (14–18). Recap: "You worked on reading stories today!" (reused). Each row: story (characters, words) → question (characters) → **answer** / wrong chips.

1. "The goat sat in the boat. It has a loaf." (40, 10) → "Who sat in the boat?" (20) → **goat** / boat, loaf
2. "The goat is on the roof. A broom is in the train." (49, 12) → "What is in the train?" (21) → **broom** / goat, train
3. "The goat has a hoop. It sat on the stool." (41, 10) → "Where is the goat?" (18) → **stool** (On) / goat, hoop
4. "The goat has a coat. A spoon is on the tray." (44, 11) → "What is on the tray?" (20) → **spoon** / coat, tray
5. "The snail sat on the moon. The goat sat on a log." (49, 12) → "Who sat on the moon?" (20) → **snail** / goat, moon
6. "The goat sat in the tent. The snail hid in the boot." (52, 12) → "Where is the snail?" (19) → **boot** (In) / tent, goat
7. "The goat and the snail sat on the stool. The goat got a tooth." (62, 14) → "Who got a tooth?" (16) → **goat** / snail, stool
8. "The goat has a chain and a boot. A hoop is on the roof." (55, 14) → "What is on the roof?" (20) → **hoop** / chain, boot

**Rules** (a splice lint checks them; my scratch check over `taughtWords()`, `storySentences` and the pack found no breach, 2026-10-19):

- **Taught words only** (wave 3's D2): a target of a Word Song canon file (the 16 new targets once their files exist), a word read in the sight-words or simple-sentences canon, or _and_, _got_, _hid_ (`scripts/spliceContentWave3Canon.ts:139-169`). No plurals, no -s or -ed endings; no exemption is needed this wave.
- **Shape:** 2 sentences, 10–14 words; the two 14-word stories sit at P7 and P8. _It_ is always the animal of the sentence before (1, 3). No _she_.
- **The 16 words:** the goat is in every story, and every story uses at least 2 of the 16 (_goat_ counts); each of the 16 appears at least once. The goat answers P1 and P7 only.
- **Chips:** all three are in the story and have a pack picture, and no trio holds a `FORBIDDEN_PAIRS` pair, old or new (§ 8). Kinds: Who → an animal, What → an object, Where → a place (a container counts: "in the boot", as bug stories' "in the cup").
  - **P1–P3:** both wrong chips are another kind than the question asks.
  - **P4–P8:** at least one wrong chip is the same kind. Story 5 and story 6 are about the snail, not the goat. Story 8 has two same-kind wrong chips, the hardest trio, last.
- **Questions ≤ 23 characters.**
- **Dave's examples:** example 1 is story 1 verbatim. Example 2 is story 4 with _tray_ for _stool_, so _tray_ gets a story, and it moved from P2 to P4: its wrong chip _coat_ is an object, the same kind as the answer. Example 3 is dropped: its wrong chip _roof_ is a place, so it can't be the gentle Where at P3, and _train_ already has a story (D8).
- **New story words:** the 16 targets, so `STORY_WORDS` goes from 71 to 87.

## 8. New forbidden pairs

Dave's 20 candidates, added to `FORBIDDEN_PAIRS` (`wordPack.ts:1676`) before the rows are coded: tray–mat, train–bus, train–van, train–car, train–jeep, chain–rope, boat–ship, boat–tub, goat–sheep, goat–dog, goat–pig, goat–cat, loaf–bun, snail–bug, broom–mop, boot–sock, stool–desk, hoop–ring, roof–tent, roof–barn. Plus one of mine: **coat–cape** (two garments worn over the body; _cape_ is a cake-words picture). 21 in all.

No trio in § 4.2, § 5.2 or § 7.2 contains a forbidden pair, old or new, and every chip word has a picture after § 10 (scratch script, 2026-10-19, not committed).

## 9. Copy / TTS script

### 9.1 Every new spoken line

Canon lines are in § 2.7, § 3.7, § 4.2, § 5.2 and § 7.2. All copy lives in canon JSON, `GUIDANCE_LINES`, `PATH_LINES`, `STAGE_SPOKEN_NAMES` and `LANDS`, never in layout (§ 12).

**Guidance** (`createManifestLinePlayer('session-guide', …)`):

- `guide.session.intro.<node>`: "No tens? Zero tens!" (19) and "Tens and ones!" (14). Snail and moon words reuse "Two letters, one sound!", goat stories "Read the story. Who, what or where?" (0).
- `guide.session.peek-open.<node>` "Let's look at <name>!" (20 / 33 / 26 / 25 / 27); `peek-close` "<Name> <is/are> for later. You will learn it!" (39 / 51 / 45 / 44 / 46), in the order zeros / adding big numbers / snail / moon / goat.
- `guide.session.replay-open.<node>` "Let's play <name> again!" (23 / 36 / 29 / 28 / 30); `replay-close` "You know <name>!" (15 / 28 / 21 / 20 / 22).
- `guide.story.word.<word>`: 16 clips, sent to Lily as "Word," with the caption "Word." (`.claude/docs/audio-system.md:65`). `guidanceLines.ts:259` already does this for every story word outside wave 3's set, so no code change: 87 characters.

**Path** (`PATH_LINES`, generated from the names; baked count 223 → 254):

- `path.open` "Here is your path! You are on <name>." (36 / 49 / 42 / 41 / 43); `path.stop` "<Name>." (6 / 19 / 12 / 11 / 13).
- `path.locked.next` "<Name>! First, <previous>. Then this!" (39 / 44 / 45 / 42 / 43). **Render input:** "<Name>! First, <previous>; then this!", caption unchanged. Two waves running needed this take by ear (hen and bug stories in #599, car words in #607; `team/DECISIONS.md:76`, `:87`), so it is the first take here, not a retake. `renderPathLinesLily.ts` sends a line's text as it is today, so path lines gain the `input` field guidance lines have (`renderGuidanceLinesLily.ts:88`). Same length, same bill.
- `end.bud` "Look! A new flower for <name>!" (29 / 42 / 35 / 34 / 36); `end.unlock` "You learned <previous>! Now you can do <name>!" (48 / 53 / 54 / 51 / 52). Previous: more and less, zeros, sheep stories, snail words, moon words.
- Land 6: "Land 6: Bigger numbers." (23), "A new land! Land 6: Bigger numbers!" (35), "A new land: Bigger numbers!" (27). Land 9: "Land 9: More words and stories." (31), "A new land! Land 9: More words and stories!" (43), "A new land: More words and stories!" (35).

**Total: 220 distinct new texts, 5,436 Lily characters.**

| Surface                 | Texts | Characters |
| ----------------------- | ----- | ---------- |
| guidance (leads, peeks) | 12    | 389        |
| replay                  | 10    | 252        |
| path                    | 31    | 1,113      |
| story-word clips        | 16    | 87         |
| canon `hundreds-zeros`  | 31    | 993        |
| canon `add-two-digit`   | 26    | 697        |
| canon `snail-words`     | 32    | 548        |
| canon `moon-words`      | 32    | 552        |
| canon `goat-stories`    | 30    | 805        |

- **How it was counted:** a scratch script (2026-10-19, not committed) generated every text from this spec and compared it with every `text` in `public/canon/**/*.json`, every `GUIDANCE_LINES` text and input and every `PATH_LINES` text. Repeats inside the wave count once.
- **Reused, not billed:** "Hmm... try again?", "Look at the hundreds.", "Look at the tens.", "Look at the ones.", "One more ten.", "One more hundred.", "What is ten more?", "What is one hundred more?", "How many?", "Two letters, one sound!", "Read the story. Who, what or where?", and both reading recaps.
- **The bill holds only if the bake de-duplicates on exact text** (`revoiceCanonLily.ts` does); `--dry-run` prints the real number first. Wave 4 rendered 4,791 of its 5,000 with retakes (`team/DECISIONS.md:87`), so this wave asks for 6,000 (T2).
- **Canon is spliced, not Haiku-baked:** `scripts/spliceContentWave5Canon.ts` writes the five files from § 2.7, § 3.7, `BIG_WORDS_STEPS` and `LITTLE_STORIES`; the five nodes join `PENDING_CANON_NODES` (`scripts/generateSessionCanon.ts:407`). Render: `renderGuidanceLinesLily.ts`, `renderPathLinesLily.ts`, `revoiceCanonLily.ts --unrendered`.

**Prediction for the ear test** (Predict-Before-Soak):

- The oa words carry the British GOAT vowel, a glide (/əʊ/): "boht", "coht", "lohf", "goht", never a flat American /oʊ/. The ai/ay words glide too (/eɪ/): _tray_, _snail_, _train_, _chain_.
- The oo words hold a long /uː/; _roof_, _hoop_ and _broom_ never shorten to _book_'s /ʊ/.
- "No tens? Zero tens!" rises on the first "tens?" and falls on the second; _zero_ is /ˈzɪərəʊ/.
- "Find one hundred and ninety." keeps its British _and_.
- "Ten ones make a ten." says _ones_ as /wʌnz/, never "owns".
- None of the 16 "Word," clips expands into a longer word: screened by speech length, no clip stands out from the other 15 by 0.1 s or more.
- No "Then this!" line comes back scratchy on its first take.

**Bounded convergence:** I rendered and ear-tested nothing. The counts come from a scratch script and the map and layout numbers from hand calculations. **Not predicted:** whether Lily stresses _zero_ or _tens_ in "Zero tens.", and how long _moon_ and _spoon_ hold their /uː/.

### 9.2 Vocabulary check (the ~200-word cap)

- **No new core word.** _no_, _zero_, _find_, _make_, _ones_, _bigger_, _more_, _words_, _stories_, _who_, _what_, _where_ are already spoken (committed canon and guidance lines, 2026-10-19). "zeros" is _zero_'s plural, as a step name. The count stays about 177 (Dave's).
- The 16 snail and moon words are targets. All ASCII-7 except the on-screen "−", which is never spoken.

## 10. Pictures: 16 words and 8 scenes (OpenAI)

**16 new pack pictures:** the targets. None is in `mobile/assets/pictures/` (106 WebPs, `ls` 2026-10-19) or in `design/word-song/picture-manifest.json` (106 entries). Every other chip is an existing picture.

**Cost**, at the rates the ledgers record (read in the tools worktree on 2026-10-19; the ledgers are gitignored, `.gitignore:61-63`):

- **Words:** $0.0776 a call (107 calls, $0.0774–0.0781 each; wave 4's 17 words cost $1.32 with no retakes), so 16 × $0.0776 ≈ **$1.24**.
- **Scenes:** $0.127 with 3 references (19 calls), $0.143 with 4 (18 calls). § 10.2 has 2 three-reference and 6 four-reference scenes, ≈ **$1.11**.
- **Total ≈ $2.36**, or about **$2.95** with a second round on 4 words (roof, hoop, stool, tooth: +$0.31) and 2 scenes (goat-5, goat-8: +$0.29). Dave's ~$2.30 / $2.90 used 3-reference rates for more of the scenes; `--dry-run` prints the real figure.
- **If a word fails its second round, stop and tell Matt;** a swap goes back through Dave (reserves in § 4.2 and § 5.2).
- **Append the 16 word entries first, and the 8 scene entries only after Thomas approves the snail and moon contact sheets** (wave 4's order): the generator reads the whole file.

### 10.1 The 16 manifest entries (batches 13 and 14, riskiest first)

Entries `{ word, tier, batch, subject, avoid, distinctFrom }`. Batch 13 holds the snail words (tier `snail-words`), batch 14 the moon words (tier `moon-words`). Dave's picture notes are in: a crescent _moon_, a _boat_ with no sail, a _goat_ with horns and a beard, a _tray_ with a rim and handles.

| Batch | Word  | Subject                                                                                                                                   | Avoid                                                                               |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 13    | train | A toy steam-train engine in side view: a rose-red boiler, a black chimney, a cream cab with one window and four black wheels.             | a bus, van, car or jeep body; carriages behind it; smoke clouds; letters or numbers |
| 13    | goat  | A goat standing in side view: a cream-white coat, two short curved horns, a small pointed beard and a short upright tail.                 | a sheep's round fleece; a dog; a deer's antlers; a cow                              |
| 13    | loaf  | One loaf of bread in side view: a golden-brown rounded top with three diagonal cuts and a flat, paler base.                               | a round bun or roll; slices; a cake with icing; a brick                             |
| 13    | chain | A short chain of six big oval links in soft grey metal, lying in a gentle S curve.                                                        | a rope; a necklace with a pendant; a padlock or a lock; a single ring               |
| 13    | tray  | One empty serving tray seen from slightly above: a warm-brown wooden rectangle with a low rim all round and a cut-out handle at each end. | a flat mat or rug; food or cups on it; a box with tall sides; a picture frame       |
| 13    | snail | A garden snail in side view: a round spiral shell in warm brown and cream, a soft grey-green body and two eye stalks.                     | a slug with no shell; a bug or a ladybird; a spiral bun; a big smiling face         |
| 13    | coat  | One winter coat on its own, front view: knee length, soft blue, with a row of four big round buttons and two pockets.                     | a person wearing it; a cape with no sleeves; a scarf; a dress                       |
| 13    | boat  | A small wooden rowing boat in side view on a thin line of blue water: a warm-brown hull with two oars resting in it, no sail.             | a mast or sails (the ship); a bath tub; people; big waves                           |
| 14    | roof  | One pointed house roof on its own, front view: two red-tiled slopes meeting at the top and a small chimney, with no walls under it.       | a whole house; a tent; a barn; a triangle sign                                      |
| 14    | hoop  | One big hula hoop standing upright, seen from the front: a thin rose-pink ring with a cream stripe wound round it.                        | a finger ring with a gem; a wheel with spokes; a doughnut; a child holding it       |
| 14    | stool | A small wooden stool in side view: a round warm-brown seat on three straight legs, no back.                                               | a chair with a back; a table or a desk; a drum                                      |
| 14    | tooth | One big white tooth on its own: a rounded top, two short roots and a small shine.                                                         | a bone; a face or a mouth; a toothbrush; blood                                      |
| 14    | moon  | A pale-yellow crescent moon on its own, its points to the right, with no face.                                                            | a full round moon or a sun disc; a banana; stars; a sky                             |
| 14    | broom | A broom standing upright: a long warm-brown handle and a wide bundle of straw-yellow bristles tied with a red band.                       | a mop; a rake; a short-handled brush                                                |
| 14    | boot  | One rose-red rain boot in side view: a tall leg, a rounded toe and a thick sole.                                                          | a sock; a pair of boots; a laced shoe; a foot                                       |
| 14    | spoon | One silver spoon lying at a slight angle: an oval bowl and a long thin handle.                                                            | a fork; a ladle; a pan; food in it                                                  |

**`distinctFrom`** (the manifest's rule, `design/word-song/picture-manifest.md:18`: forbidden partners first, then trio mates A–Z; pack words only). Computed by the scratch script from the 16 new rows, the existing `TARGET_PAIRINGS` and `TARGET_PAIRINGS_CROSSVOWEL`, and § 8's pairs:

- **tray:** mat; chain, cup, hen, train, tree · **boat:** ship, tub; bat, bone, jug, sun · **snail:** bug; bed, cup, sack, seal · **coat:** cape; bus, cot, goat, gum, hen
- **train:** bus, car, jeep, van; can, chain, nut, pen, tray, tree · **loaf:** bun; bed, leaf, log, sun · **goat:** cat, dog, pig, sheep; coat, cot, cup, gum, net · **chain:** rope; bug, can, sun, train, tray
- **moon:** cup, hen, mop, sock, spoon · **spoon:** bug, jet, moon, mop, sock, star, stool · **boot:** sock; bone, box, brick, broom, fan, pig, tooth, top · **broom:** mop; boot, brick, hen, sun
- **tooth:** boot, cup, pig, top · **stool:** desk; hen, jet, spoon, star · **hoop:** ring; bus, cup, hot, roof · **roof:** barn, tent; bed, fan, hoop, hot, rock, rope

**Symmetry edits to existing entries** (forbidden partners first):

- **barn:** roof · **bun:** loaf · **cape:** coat · **car:** train · **cat:** goat · **desk:** stool · **dog:** goat · **jeep:** train · **mat:** tray · **ring:** hoop · **sheep:** goat · **ship:** boat · **tent:** roof · **tub:** boat · **van:** train
- **bug:** snail (forbidden); chain, spoon · **bus:** train (forbidden); coat, hoop · **mop:** broom (forbidden); moon, spoon · **pig:** goat (forbidden); boot, tooth · **rope:** chain (forbidden); roof · **sock:** boot (forbidden); moon, spoon
- bat: boat · bed: loaf, roof, snail · bone: boat, boot · box: boot · brick: boot, broom · can: chain, train · cot: coat, goat · cup: goat, hoop, moon, snail, tooth, tray · fan: boot, roof · gum: coat, goat
- hen: broom, coat, moon, stool, tray · hot: hoop, roof · jet: spoon, stool · jug: boat · leaf: loaf · log: loaf · net: goat · nut: train · pen: train · rock: roof · sack: snail · seal: snail · star: spoon, stool · sun: boat, broom, chain, loaf · top: boot, tooth · tree: train, tray

`picture-manifest.md` gets the tiers `snail-words` and `moon-words`, and batches 13 and 14; the build check's word set grows from 106 to 122.

### 10.2 The 8 scenes (`generatePackPictures.ts --scenes`)

Appended to `design/word-song/scene-manifest.json` as tier `goat-stories`, batch 5, with wave 3's `SCENE_RULES` and the approved pack PNG of each `refs` word (≤ 4, chips first). Output: `mobile/assets/scenes/story-goat-<n>.webp`, 600 px, with a contact sheet for Thomas.

- **goat-1** [goat, boat, loaf]: The goat sitting in the small rowing boat on the water, a loaf of bread on the seat beside it. _Avoid:_ a sail; a person rowing.
- **goat-2** [broom, goat, train, roof]: The goat standing on a red-tiled roof; below it, the toy train with a broom poking out of its cab. _Avoid:_ the goat in the train; the broom on the roof.
- **goat-3** [stool, goat, hoop]: The goat sitting on the wooden stool, holding the pink hoop. _Avoid:_ a chair with a back; the goat inside the hoop.
- **goat-4** [spoon, coat, tray, goat]: The goat wearing the blue coat; beside it, the wooden tray with a silver spoon on it. _Avoid:_ the spoon in the goat's mouth; food on the tray.
- **goat-5** [snail, goat, moon, log]: Night: the snail sitting on the crescent moon in the sky; below, the goat sitting on a log. _Avoid:_ the goat on the moon; a full moon.
- **goat-6** [boot, tent, goat, snail]: The goat sitting in the open tent; beside the tent, the red boot with the snail peeking out of its top. _Avoid:_ the snail in the tent; a foot in the boot.
- **goat-7** [goat, snail, stool, tooth]: The goat and the snail sitting side by side on the wooden stool; the goat holding up one white tooth. _Avoid:_ the snail holding the tooth; a mouth or blood.
- **goat-8** [hoop, chain, boot, goat]: The goat holding a short grey chain, a red boot beside it; behind them, a red-tiled roof with the pink hoop lying on it. _Avoid:_ the chain round the goat's neck; the hoop on the goat.

**Riskiest, a second round expected:** goat-5 (a snail sitting on a moon, at two scales) and goat-8 (the roof comes from the text alone, because the 4-reference limit goes to the chips). If a scene fails twice, the step still ships: a missing scene shows the answer's pack picture (wave 3 § 4.2).

The 7 clay pieces (§ 1) are made as the clay set was, with Thomas's tool.

## 11. States and edge cases

- **Error path:** poof, shake, `puzzled-tilt`, "Hmm... try again?"; hints at 2 wrongs, the given answer at 3. Never a red X.
- **First visit:** the land beat (adding big numbers, snail words), then the lead before P1 of each forward session until mastery.
- **Peek:** P1–P3 with opener and closer, no lead, nothing written. Zeros: three builds, each with an empty place. Adding big numbers: P3's peek shows the bundle. Snail words: tray, boat, snail. Moon words: moon, spoon, boot. Goat stories: a story in full, with the reveal.
- **Review, replay, warm-up:** the canon blocks in full. A snail or moon block keeps its own step's row (§ 6). A step-17 block draws the trays wherever it plays, because its step travels with it (`problemNodes`). Story blocks never as hearts.
- **A zero-drop tap** (18, 19) is an ordinary wrong answer, recorded as a two-digit value.
- **Background, rotation:** as hundreds; a bundle or lift-out in flight lands in its end state.
- **Missing assets:** a missing pack picture draws the problem as written words (the shipped fallback); a missing scene shows the answer's picture; a missing word clip lights the word silently.
- **Ship order:** `yarn release` before the device check (the server learns the five nodes then). No guard prerequisite this wave.

## 12. Language-version readiness

A Danish version of the app is planned (Thomas, 2026-10-19; `CLAUDE.md` "Users" line on PR #613). Nothing here blocks a second language:

- **Every spoken or written word** is in a copy or canon table (§ 9.1): canon JSON, `GUIDANCE_LINES`, `PATH_LINES`, `STAGE_SPOKEN_NAMES`, `FRIENDLY_NODE_NAMES`, `LANDS`. Layout draws digits, "+", "−", "?" and pictures only.
- **Pictures, scenes and clay pieces** hold no letters, digits or words.
- **Known constraint, not new:** the math parser reads English read templates, as every shipped step does. This wave widens two (place value, more) and adds one ("Find <number>."). A Danish version needs its own templates or a structured wire field either way; this wave doesn't make that harder.

## 13. Wiring checklist (Kevin, Devon)

- **`sibling-tier-checklist.md`:** all five nodes rows 1–10 and 12; the three Word Song nodes also row 11 and rows 13–15; the two math nodes instead `VALID_MATH_FOCUS_NODES` and `MATH_FOCUS_NODES`; row 16 skipped (the web is frozen). From "does not cover": the math read templates (8/8 each), `CANON_FILES` in `public/voice-qa.html` (+5 stems; hard-coded at :644) and its `EXPECTED_CANON_UNIQUE` (:643, 1181 → 1332: § 9.1's 151 new canon texts, counted the way its comment counts wave 4's 88), the committed canon, e2e seeds ending at `hundreds-addsub` or `sheep-stories`.
- **Names:** `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS`, `FRIENDLY_NODE_NAMES`, the Hub labels (`progressProjection.ts`), the recap list in `api/_planner.ts`, `scripts/recapFocusCopy.ts`.
- **Map, lines:** `LANDS` (land 5 + 1 node, + NG land 6, + WS land 9), `PATH_LINES` (baked 223 → 254) with the `input` field and § 9.1's "; then this!" inputs, `PATH_ART_SET` (+5), `LandArtId` (+2), `GUIDANCE_LINES`: leads 5, peeks 10, replays 10, story words 16, so ids 258 → 299 and texts 256 → 294 (three leads share shipped texts; `guidanceLines.test.ts:56-61`).
- **Zeros:** `PlaceValueProblem` `form` and the widened digits, the place-value and more templates, "Find <number>.", `hundredsDistractors` and `hundredsOfferedClass` for § 2.6 (`'zero-drop'`, signed count-1 `'wrong-place'`), the 10..99 allowance for the zero-drop chip only, the `extendedProblems.ts:209` comment, `CANON_MATH_FACTS`. `PlaceValueStage`: the empty tray and its tick pulse, the "0" tag, P5's hint-2 build, the "−10" pill.
- **Adding big numbers:** `PLACE_VALUE_ARITHMETIC_NODES`, `PlaceValueLayoutProblem`'s arithmetic member and the two-tray metrics, the frame report to App, `problemChips`' branch and `addTwoDigitDistractors`, `hintStep` for these problems, `CANON_MATH_FACTS` (8 facts, generated). `PlaceValueStage`: the two-tray form under the equation, the second number's drop, the bundle (§ 3.5), the lead pulse.
- **Word Song:** `BIG_WORDS_STEPS` + 2 steps, 16 rows (`BigWordsStep`, `BIG_WORDS_STEP_IDS`); `BigWordCategory` + `'kitchen'`; `wordPack.ts` + 16 entries, 21 `FORBIDDEN_PAIRS`; `_plannerWordList.ts`, `bigWordsCanonCheck.ts`; `introSpotlight.ts`: snail words' lead as `'ending-pair'`, the new `'team-pair'` for moon words; `wordDistractors.test.ts`' CVC-axis treatment for the new rows.
- **Stories:** `StoryNode`, `STORY_NODES`, 8 `LITTLE_STORIES` rows (a `goat` row builder), `storyMarks.generated.ts`, the scene registry.
- **Canon, pictures:** `spliceContentWave5Canon.ts` (§ 2.7's and § 3.7's per-file lints, the story lint), `PENDING_CANON_NODES` + 5, both manifests in T4's order.
- **Unchanged on purpose:** `isLeitnerDirectiveActive`, `MULTIPLICATION_FOCUS_NODES`, `MIX_SOURCE_STEPS`, `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`, the celebration exceptions, `buildChipOrder` (the web's copy), `forgottenCarryDistractors`, `EXTENDED_ANSWER_MAX`, the progress guard, hundreds' and more and less's canon and chips.

## 14. Acceptance criteria

**Core (vitest):**

1. Zeros P1 parses to `{ kind: 'place-value', hundreds: 3, tens: 0, ones: 5, spokenOrder: ['hundreds', 'tens', 'ones'], form: 'places', correct: 305 }`; P4 to `{ hundreds: 1, tens: 0, ones: 8, correct: 108 }`; P5 to `{ kind: 'place-value', hundreds: 1, tens: 9, ones: 0, form: 'name', correct: 190 }`; P8 to `{ kind: 'more', start: 416, step: 10, count: 1, direction: 'less', correct: 406 }`. Rejected: "Three hundreds, one ten and five ones. What number is it?" (one ten), "No hundreds, four tens and two ones. What number is it?" (below 100), "Find forty-two." (below 100), "Three hundred and ninety-five. What is ten more?" (regroups), "Four hundred and five. What is ten less?" (regroups), "One hundred and five. What is one hundred less?" (below 100). Hundreds' and more and less's 16 reads still parse as before.
2. `hundreds-zeros.json` equals § 2.7 (8/8 parse); `hundredsDistractors` returns § 2.7's chips and classes; hundreds' and more and less's chips are unchanged.
3. `add-two-digit.json` parses 8/8 as arithmetic; `addTwoDigitDistractors` returns § 3.7's chips; the recorded class is `null` on P1–P3 and `'forgotten-carry'` on P4–P8; `CANON_MATH_FACTS['add-two-digit']` holds the 8 facts and `['hundreds-zeros']` 8 nulls.
4. `BIG_WORDS_STEPS['snail-words']` and `['moon-words']` equal § 4.2 and § 5.2; no trio holds a forbidden pair; the 21 pairs exist; every picture key resolves through native `pictureAsset`.
5. **Rows:** a snail-words P4 deals coat, cot, goat; a moon-words P1 deals moon, hen, cup; a review block keeps its step's row.
6. `LITTLE_STORIES` holds § 7.2's 8 rows and passes the lint; `goat-stories.json` parses 8/8; `STORY_WORDS` has 87 words.
7. `pickWarmupBlocks` never returns a goat-story block; it may return an adding-big-numbers block, as it does two-digit blocks.
8. 6 Number Garden lands (land 5 with 3 nodes, land 6 with 1), 9 Word Song lands; `GUIDANCE_LINES` and `PATH_LINES` hold § 9.1's texts; baked path lines 254; spoken names unique.
9. `hundreds-addsub` mastered, no new keys → `hundreds-zeros: 'intro'`, `add-two-digit: 'locked'`; `sheep-stories` mastered → `snail-words: 'intro'`, the other two `'locked'`.

**Native (jest):**

10. Zeros P1: the lead pulses the tens tray on both "tens"; the read drops 3 flats on "hundreds", pulses the empty tens tray on "tens" and drops 5 cubes on "ones"; all tags "?"; hint 2 fills the tens tag "0"; after hint 3 the tags read 3, 0, 5.
11. Zeros P5: nothing is built on the read; hint 2 builds 1 flat and 9 rods and fills the ones tag "0". P8: the "−10" pill from the first frame; hint 2 lifts one rod and turns the tens tag "?"; a right tap ticks it to "0".
12. Adding big numbers P3: the first frame shows "28 + 35", 2 rods and 8 cubes; on the tick of "thirty-five" 3 rods and 5 cubes drop in 90 ms apart; then ten cubes gather, become a rod and move to the tens tray, leaving 6 rods and 3 cubes; both tags "?". P4: nothing moves on the read; hint 2 drops the second number's blocks and plays the bundle on "make". A step-17 review block on another step's session draws the trays.
13. Reduce Motion gives § 2.5's and § 3.5's bracketed forms; rotation mid-bundle lands the end state.
14. Snail words P1 lights tray's last two cells; moon words P1 lights moon's 2nd and 3rd cells; no lead on P2–P8, in reviews, peeks or hearts.
15. Goat stories P1–P8 follow wave 3's story ACs; the lead plays once before P1.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP`):

16. Each new step: Emma speaks every line; at 375×667 and 667×375 nothing leaves its rect; the bundle reads as ten ones becoming one ten, not a glitch, and the cubes stay countable at L's u = 7; snail and moon words show three pictures on every problem.
17. Map at 375×667, 744×1133, 820×1180 portrait and 1133×744, 1180×820 landscape: 6 and 9 lands, no overlaps, the current stop in view on open, scrolling where § 1 predicts.

## 15. Thomas decides

One recommendation each.

- **T1. Names:** "zeros" (`hundreds-zeros`), "adding big numbers" (`add-two-digit`), "snail words", "moon words", "goat stories"; "Land 6: Bigger numbers", "Land 9: More words and stories". Recommendation: approve.
- **T2. Lily budget (§ 9.1):** 220 texts, **5,436 characters**, chiefly the five path sets, the zeros canon and the 16 one-word clips sent as "Word,". Recommendation: approve up to **6,000**, wave 3's ceiling, since wave 4's retakes took 234 characters past its count. `--dry-run` prints the real number before any spend.
- **T3. 7 clay pieces (§ 1):** a doughnut (zeros), an abacus (adding big numbers), a pumpkin (land 6), a snail, a crescent moon, a goat, a castle (land 9). Recommendation: approve the subjects; the look is judged when they are made.
- **T4. Picture spend (§ 10):** 16 pictures and 8 scenes, about **$2.36**, about **$2.95** with retakes. Recommendation: approve up to $3.50. The 16 pack pictures come first, judged on the snail and moon contact sheets; the 8 scenes only after those are approved. Top up OpenAI first if the balance is low.
- **T5. British English** (Dave's question): with many learners, does the app keep British English as its reading and voice standard? Lily is British and every word list here is checked against British usage (_boot_, _loaf_, no _pail_). Recommendation: keep British.
- **T6. Map:** Word Song's 9 lands scroll on portrait (the shipped rule) and now on 1133×744 landscape too; Number Garden's 6th land sits near the 14 pt portrait bar, and if the build's test misses it, Number Garden scrolls on portrait on the shipped path (`PORTRAIT_FIT_LANDS` 5). Recommendation: approve both, so a failed bar doesn't stall the build.
- **T7. The bundle motion (§ 3.5)** is the wave's one subjective call. **Prediction:** at the device check the ten cubes read as one rod before they move, and the carry reads as "a new ten" on its first viewing; on phone landscape the cubes look small but countable. Recommendation: approve the brief now; the feel is judged on device, with one tuning round allowed.

## 16. Pedagogy assumptions for Dave (D1…)

Open: Dave checks these read-only.

- **D1.** Zeros' hint ladder: Dave's zero ladder on the build and name problems (P1–P5): the zero place, then "Zero tens." / "Zero ones." (P3: "Zero tens and zero ones."), then the read's question, which fills the other tags. P6–P8 keep the hundreds and more-and-less ladders ("One more ten.", "Take away one ten."), since "Zero tens." doesn't describe adding or taking away.
- **D2.** Zeros' lead: "No tens? Zero tens!" (Dave gave none; every shipped step has one). It fits P1, which has no tens, and adds no word.
- **D3.** Zeros P5 ("Find one hundred and ninety."): hint 1 "Look at the ones." points at a tray that is still empty, because nothing is built until hint 2. My recommendation is to keep Dave's fading as written: the learner still holds the number name in mind for one beat.
- **D4.** Adding big numbers' lead: "Tens and ones!" instead of "Make a ten!", because P1 and P2 make no ten. The new ten is named by hint 2's "Ten ones make a ten." and shown by P3's bundle.
- **D5.** The 16 gentle pairs in § 4.2 and § 5.2 are mine, by the rule (another category, first sound, and no letter of the team); Dave's traps are verbatim.
- **D6.** Adding big numbers on P4–P8 shows the first number's blocks from the first frame and moves the second number's blocks and the bundle at hint 2 (wave 4's start-blocks rule).
- **D7.** _coat–cape_ joins `FORBIDDEN_PAIRS` (mine).
- **D8.** The 8 goat stories are mine. Dave's example 1 is story 1 verbatim; example 2 is story 4 with _tray_ for _stool_, moved to P4 because its wrong chip _coat_ is an object; example 3 is out, because its wrong chip _roof_ is a place, so it can't be the gentle Where at P3.
- **D9.** A container counts as a place in a Where question (story 6: "Where is the snail?" → "In the boot!"), as bug stories' "in the cup" did.
