# Content wave 3: hundreds and little stories (native)

**Status:** spec only. Thomas, 2026-10-17: "Spec wave 3 now, build later". Nothing is built, rendered or generated until Thomas approves this spec (§ 10).

**Scope:** `@marian/core`, the native app (`mobile/`), canon and one generator mode. The web is frozen: a hundreds read or a story read throws there, and the web falls back to its silent static plan (`content-wave-1.md` § 1.9). The format model is `content-wave-2.md` (#586); its rules apply unless this spec says otherwise. Code is anchored by names, not line numbers.

**Source:** `design/research/content-roadmap-after-path-ends.md` (Dave, #569):

| Item | Dave's working name | What                                                                                 | Here |
| ---- | ------------------- | ------------------------------------------------------------------------------------ | ---- |
| G    | (prerequisite)      | the progress guard's 0..99 answer limit                                              | § 2  |
| NG-D | hundreds (step 14)  | build and tap 3-digit numbers from flats, rods and cubes, then +10 and +100          | § 3  |
| WS-E | little stories (18) | 2–3 sentence stories of 8–14 taught words, one spoken who/what/where question, chips | § 4  |

**Out of scope:** code, renders, picture generation and test runs. Also out: "adding hundreds" (roadmap step 15), "How many plates?" (`content-wave-2.md` § 2.8), and redrawing the 8 simple-sentence scenes (`picture-manifest.md` § Open questions).

## Goal

Marian reads and builds numbers up to 999, and she reads short stories she can decode, then shows she understood them.

## User state entering

- **Hundreds:** she has mastered sharing (`div-share`). The Map plays "A new land! Land 5: Hundreds!".
- **Fox stories:** she has mastered cake words. The Map plays "A new land! Land 7: Stories!". **Hen stories** follow fox stories, and **bug stories** follow hen stories.
- **She finished a world before this build:** wave 1's load rule opens the new step on launch (`content-wave-1.md` § 5.3, K13). Nothing new is needed.

## Decisions

- **K1. The guard change ships alone, first, on every device** (§ 2). Hundreds is the first step whose answers pass 99. The build that carries hundreds goes on a device only after the guard build is on the iPad and the iPhone.
- **K2. Hundreds: Emma builds the number and Marian taps it.** The blocks drop into three trays as Emma says each part. She taps one of three numeral chips; she never drags blocks. A drag-to-build tray would be a second new interaction (§ 3.2).
- **K3. Hundreds has 8 problems: 5 "what number is it?" (P1–P5), then 3 "ten more / one hundred more" (P6–P8)** (§ 3.7).
- **K4. Hundreds chips:** P1–P3 differ only in the hundreds digit. P4–P5 carry the digit swap (537 / 573, M6). P6–P8 carry the other two place steps (+1, +10, +100) (§ 3.6).
- **K5. The base-ten picture is drawn in code**, not generated: exact counts matter, and a picture model can't be trusted with 100 squares (§ 3.3).
- **K6. Little stories are 3 steps of 8 stories (24), one question word each:** fox stories ask "Who…?", hen stories "What…?", bug stories "Where…?" (§ 4.1, D1). One canon file serves 8 problems, so 24 stories need 3 steps.
- **K7. Names come from the stop picture, as the word steps' do** ("fox stories", K7 of wave 2). The hero is in every story of its step, but isn't always the answer.
- **K8. Decode first.** Order of events: the story card, a silent reading beat, Emma's question, the picture chips, the answer, and only then the scene. No picture is on screen while she reads (§ 4.4, D5).
- **K9. Reading support:** tapping a word plays that word. Emma reads the whole story only as the 2nd-wrong hint and in the reveal, never before an answer on request (§ 4.4, D4).
- **K10. The story's wire text rides in the `hint` slot** (Emma reads it as the hint), and a core table `LITTLE_STORIES` keys chips and scenes by story text. The wire stays utterance-only with 5 slots (§ 4.6).
- **K11. Lands:** Number Garden land 5 "Hundreds" (1 stop), Word Song land 7 "Stories" (3 stops). Groups and Big words are full or off-topic (§ 1).
- **K12. Neither step records a Leitner fact.** Story blocks are never warm-up hearts (they take about 20 s each), but they do join reviews (§ 4.7).

Mastery, the fast track, the pace guard, reviews, peeks and Map replays (#592, if merged) work on the new steps as on their siblings. Nothing in this wave adds a timer, a currency, a streak or a loss mechanic. The reading beat is invisible and never ends the problem.

## 1. Steps, lands, names and path art

| Step (`SkillNode`) | After         | Land, stop                    | Spoken name | Verb | Recap phrase    | Canon file                           |
| ------------------ | ------------- | ----------------------------- | ----------- | ---- | --------------- | ------------------------------------ |
| `hundreds`         | `div-share`   | **NG 5 Hundreds (new)**, 1/1  | hundreds    | are  | hundreds        | `math/level-1/hundreds.json`         |
| `fox-stories`      | `cake-words`  | **WS 7 Stories (new)**, 1st/3 | fox stories | are  | reading stories | `word-song/level-1/fox-stories.json` |
| `hen-stories`      | `fox-stories` | WS 7 Stories, 2nd/3           | hen stories | are  | reading stories | `word-song/level-1/hen-stories.json` |
| `bug-stories`      | `hen-stories` | WS 7 Stories, 3rd/3           | bug stories | are  | reading stories | `word-song/level-1/bug-stories.json` |

- **`LANDS`:** two new entries, `{ world: 'math', number: 5, name: 'Hundreds', nodes: ['hundreds'] }` after land 4, and `{ world: 'word-song', number: 7, name: 'Stories', nodes: ['fox-stories', 'hen-stories', 'bug-stories'] }` after land 6.
- **Why new lands:** the land name is spoken. Groups already has 5 stops (the most), and hundreds isn't groups. "Big words" is about words, not stories. Roadmap step 15 (adding hundreds) joins land 5 later.
- **Why fox, hen and bug:** each has a pack picture and a clear clay shape, and none is a stop today. The frog is skip counting's stop picture, and the cat, dog and duck name word steps.

**Map fit (not measured here; no test runs).**

- **Number Garden** goes to 5 lands, the shape Word Song had before wave 1. Hypothesis: it fits wave 1's bars (`content-wave-1.md` § 5.2).
- **Word Song** goes to 7 lands. Wave 1 measured land 1 already hanging below the pane with 6 lands (2.9 pt at 375×667, 13.6 pt at 820×1180), and a 7th band shrinks every band again. **Predicted:** the native bar (current stop ≤ 14 pt below the pane) fails at 820×1180 with the current step in land 1.
- **The build measures first** (core `mapModel.test.ts`, native `mapScreenLayout.test.ts`, wave 1's scratch run). **If a bar fails, the pre-agreed fallback (T6):** on portrait forms the Word Song path pane scrolls, as phone landscape already does. It opens scrolled so the current stop sits in the pane's middle third. `layoutMap` geometry stays as it is.

**Path art: 6 clay pieces** (subjects only; the clay set's pipeline and style reference, wave 1 § 5.4; no digits, letters or signs):

| Id            | Subject                                                                                                                      | Must not look like                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `hundreds`    | A clay hundred-flat (a soft pink square slab scored into a 10-by-10 grid of little cubes), tilted, with one ten-rod in front | the egg box (`add-to-20`), the block tower (`land-ws-1`), a waffle or a chocolate bar |
| `fox-stories` | A clay fox sitting, soft orange with a cream chest and a white-tipped bushy tail                                             | the dog (`cvc-words-short-o`)                                                         |
| `hen-stories` | A plump cream clay hen with a rose-red comb and a yellow beak                                                                | the yellow chick (`digraphs-ch`), the small birds (`sub-to-10`, `land-ws-4`)          |
| `bug-stories` | A clay ladybird-style bug with a round rose-pink shell and cream spots                                                       | a strawberry, the cake's cherry                                                       |
| `land-ng-5`   | A clay apple tree full of small red apples                                                                                   | the sunflower (`land-ng-3`), the pine picture                                         |
| `land-ws-7`   | A small clay puppet theatre: a wooden booth with red curtains drawn open, no puppets                                         | the storybook (`simple-sentences`), the bookshelf (`land-ws-3`)                       |

`PATH_ART_SET` gets the 4 step ids. `LandArtId` gets `'land-ng-5'` and `'land-ws-7'`. `pathArt.test.ts` fails until the files exist.

## 2. G: the progress-guard prerequisite (ships first, alone)

**The problem.** `isHistoryEntry` (`packages/core/src/progress/guards.ts`) rejects a history entry whose `perProblemAnswerValue` holds a number above 99, and one bad entry fails `isProgressV1` for the whole doc. `EXTENDED_ANSWER_MAX = 99` (`packages/core/src/math/extendedProblems.ts`) keeps every answer under that bar today, and its comment explains why. A hundreds session records answers such as 234.

**What a 3-digit answer does to a build without G.** It is the same chain #572 documented for unknown step names (its PR body, verified at the time):

- The cloud copy is newer, so `installCloudBlob` → `isProgressV1` fails → `cloud-blob-rejected`. The older device keeps its stale doc.
- Its next session end pushes that stale doc and **overwrites the cloud copy**. The newer device then installs it and its `skillLevels` roll back.
- A device downgraded from a hundreds build has a local doc that fails `loadProgress`, so it starts fresh.

**G1. The guard (one PR, Kevin, failing-first).**

- In `isHistoryEntry`, a `perProblemAnswerValue` entry is valid when it is `null` or `Number.isSafeInteger(n) && n >= 0`. There is **no upper bound**, so "adding hundreds" (answers up to 1,000) needs no second guard change. Update the comment.
- `mathFacts` keeps its 0..99 bounds. Hundreds records no fact (K12), and `parseLeitnerHint` on the server mirrors those bounds.
- Nothing reads `perProblemAnswerValue` for a decision today (`grep`, 2026-10-17: writers in `Math.tsx`, `sessionEndPayload.ts`, `sessionEndWrite.ts` and `progressHistory.ts`, plus the guard). So a wider bound changes no behaviour.
- One edit covers both read paths: the cloud install calls the same `isProgressV1`.
- **G does not raise `EXTENDED_ANSWER_MAX`.** The guard build writes nothing above 99. It only learns to read it.

**G2. Tests** (add to `forwardCompat.test.ts`):

- A doc whose history holds `perProblemAnswerValue: [234, null, 999, 1000]` loads through `loadProgress()`, and a load + save keeps the values.
- `reconcileWithCloud` installs it (`installed-from-cloud`).
- `-1`, `2.5`, `'7'` and `NaN` still reject the doc.
- `mathFacts: [{ a: 100, b: 1, op: '+' }]` still rejects (unchanged bound).

**G3. Rollout (T5), the 2026-10-16 rule for build 8:**

1. G merges and ships in its own TestFlight build. Call it build G; its number is whatever is next.
2. Build G goes on **both** the iPad and the iPhone. Never downgrade a device below G afterwards.
3. Only then may a build carrying hundreds (§ 3) be installed on any device. Merging the hundreds PR is fine before that; installing it isn't.
4. **The web:** the frozen PWA reads the same guard from `packages/core`. The next `yarn release` after G deploys it. Hypothesis, not checked: a PWA whose cache still holds an older bundle would behave like an old build. So don't open the web app on a device between the hundreds build and that release.

**Why not a second field instead.** Writing 3-digit answers into a new field (old guards ignore unknown keys) would remove the ordering rule. But it forks one value into two fields that every future reader has to know about. Nothing reads the field yet, and G3 is the procedure that already worked for wave 1, so the bound is widened instead.

**G4. Then, in the hundreds PR (not in G):**

- `EXTENDED_ANSWER_MAX` becomes 999. `assertRecordableAnswer` uses it, so a hundreds read parses.
- **Two consumers must not move:** `SKIP_COUNT_CHIP_MAX` and `multiplyChipCeiling` read `EXTENDED_ANSWER_MAX` today (`extendedDistractors.ts`). They switch to a new `TWO_DIGIT_CHIP_MAX = 99`, so skip and times chips stay exactly as they are. `extendedAnswerRange.test.ts` pins both.
- `pickDistractors` and `ANSWER_RANGE_MAX_TWO_DIGIT` don't change: hundreds has its own picker (§ 3.6).

## 3. NG-D: hundreds (`hundreds`)

### 3.1 The step

- **SkillNode `hundreds`**, after `div-share` in `MATH_TREE` and `MATH_NODES_IN_ORDER`. Default `'locked'`.
- **Served from canon, every session:** the same 8 problems (§ 3.7). No Leitner fact (K12), as with sharing.
- **Mastery, fast track, pace guard, peek, replay:** the math preset, unchanged. A secure session needs all 8 right on the first tap.

### 3.2 What she sees

P1, phone portrait (375×667), after the read has built the blocks and before any hint:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ◉ ○ ○ ○ ○ ○ ○            |
| (Emma) +-----------------+ |
| (147 ) | Two hundreds,   | |
|        | three tens and  | |
|        | four ones. What | |
|        | number is it?   | |
|        +-----------------+ |
|  ▦▦          ▮▮▮    ▪     |  trays: hundreds (2 flats, fanned),
|  ▦▦          ▮▮▮    ▪▪    |  tens (3 rods), ones (4 cubes)
|  ▦▦          ▮▮▮    ▪     |
|   (?)        (?)    (?)    |  "?" tags under the trays
| [234]     [434]    [634]   |  chips: today's bottom row
+----------------------------+
```

P6–P8 add a **number tag** with the start number ("243"): centred above the trays in P and TP, and left of the trays (vertically centred) in L and TL. Its tray tags show the start digits from the first frame.

**Parts** (new `mobile/src/screens/math/PlaceValueStage.tsx`, `testID="math-place-value"`, `accessibilityLabel` = the read line, children hidden from accessibility, `pointerEvents: 'none'`):

- **Three trays, left to right:** hundreds, tens, ones. Each is a `colors.myCream` rounded rect, radius 12 (tablet 16), no border, padding 0.5 u. They carry no letters (no H T O); position and block shape say which is which.
- **New glyphs in `glyphs.tsx`** (react-native-svg), all with fill `colors.myPink`, a 1.5 pt `colors.myRose` outline and 1 pt `colors.myRose` grid lines:
  - `CubeGlyph`: u × u.
  - `RodGlyph`: u × 10u, with 10 cells.
  - `FlatGlyph`: 10u × 10u, with 10 × 10 cells.
- **Placement:**
  - Flats fan from the bottom-left: flat k (from 0) sits 1.2u right and 1.2u up from flat k − 1, and later flats are drawn on top. Every flat's edge stays visible, so they can be counted.
  - Rods stand side by side, 0.3u apart, bottom-aligned.
  - Cubes fill columns of 5 from the bottom up, left column first, 0.3u apart.
- **Tags:** sharing's tag pill (`content-wave-2.md` § 2.2): the "?" form (`colors.myCream`, 2 pt dashed `colors.myRose` border, "?" in `colors.myRose`), which fills to the digit form (`colors.myPink`, digit in `colors.ink`). Each tag is centred 8 pt (tablet 10) under its tray.
- **The number tag:** multiply's tag pill with the 3-digit number.
- **No "+" or "=" anywhere.** On P6–P8 the moving block carries a "+10" or "+100" pill (§ 3.5). Digits and "+" are language-free (M5).

### 3.3 Layout and sizes

`extendedMathLayout(viewport, 'place-value')` returns sharing's frames (skip's P and L frames, Math's tablet frames). One block unit u is computed once per plan from the plan's largest counts **Hmax, Tmax, Omax**: everything shown at any point, including the block a +10 or +100 adds. For the canon these are 7 flats (P8's 728), 6 rods (P7's 465) and 8 cubes (P8).

- **Width:** `(10 + 1.2(Hmax − 1))u + (Tmax + 0.3(Tmax − 1))u + 2.3u + 3u` (the tray padding) `+ 2g`, where g is the tray gap: 12 pt, tablet 16. On L and TL add the number tag's width + 8. For the canon this is 30u + 2g.
- **Height:** the fan, `(10 + 1.2(Hmax − 1))u = 17.2u`, plus u of padding, plus the tag row (8 + 28; tablet 10 + 32). On P and TP add the number tag row (28 + 8).
- **u** = the largest whole number ≤ 10 (tablet ≤ 20) at which both fit the problem rect.

| Form (problem rect, from wave 2 § 2.3) | u   | Trays width | Block height (with number tag) | Cube / rod / flat (pt) |
| -------------------------------------- | --- | ----------- | ------------------------------ | ---------------------- |
| P 375×667 (343 × 272)                  | 10  | 324         | 254                            | 10 / 10×100 / 100      |
| L 667×375 b21 (376 × 189)              | 8   | 264 + tag   | 182                            | 8 / 8×80 / 80          |
| TP 744×1133 (712 × 530)                | 20  | 632         | 448                            | 20 / 20×200 / 200      |
| TL 1133×744 (892 × 317)                | 15  | 482 + tag   | 315                            | 15 / 15×150 / 150      |

- The numbers are hand-computed from these rules, not measured. The build's layout test asserts them.
- **Chips:** three 3-digit numerals must fit Math's chips. Measured with Fredoka 700 advances (`FREDOKA_BOLD_ADVANCE`): "634" is 1.68 em wide, which gives 54 pt at the 72 pt chip's 32 pt font (in 56 pt of room), 67 pt at 88 / 40, and 87 pt on a tablet's 120 / 52. Add the rule anyway: step the font down 2 pt while the widest chip numeral is wider than the chip − 16.
- **Ribbon:** P keeps `maxLines={4}`, and L uses skip's 2-line slot. The longest read (60 characters, P4) is skip-length. Prediction: 4 lines in P (it scrolls once in L, as skip's longest does).

### 3.4 Beats, problem by problem

- **Lead** (scored P1 only, forward sessions until mastered): "Hundreds, tens and ones!". The trays pulse left to right on its word ticks. The stage is up; then 400 ms; then the read (wave 1 § 6.1).
- **Read, P1–P5:** "Two hundreds, three tens and four ones. What number is it?". **The read builds the number:** on the word tick of "hundreds" the flats drop into their tray, on "tens" the rods, and on "ones" the cubes. P5 says the parts in another order ("Six ones, two tens and three hundreds."): each part still lands in its own tray, so the ones arrive first, on the right. The chips open on `onPlay`, as today.
- **Read, P6–P8:** "Two hundred and forty-three. What is ten more?". The blocks of the start number and its filled tags are up from the first frame, and the number tag pulses on the first word tick.
- **Wrong tap (1st, 2nd):** "Hmm... try again?", with today's poof, shake and `puzzled-tilt`. The picture doesn't change.
- **Hints** (600 ms after the 2nd wrong's reprompt, as today):

| Hint | P1–P5                                            | P6 / P8 (+10)                                                                | P7 (+100)                                                       |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | "Look at the hundreds.": flats ripple, tag fills | "Look at the tens.": the rods ripple                                         | "Look at the hundreds.": the flats ripple                       |
| 2    | "Look at the tens.": rods ripple, tag fills      | "One more ten.": a rod drops in with a "+10" pill, and the tens tag ticks up | "One more hundred.": a flat drops in with "+100", the tag ticks |
| 3    | "Look at the ones.": cubes ripple, tag fills     | "What is ten more?": the number tag pulses                                   | "What is one hundred more?": the number tag pulses              |

After hint 3 of P1–P5 the three tags read the answer left to right. That is the last support before the given answer.

- **giveAnswer (3rd wrong), "This one is two hundred and thirty-four.":** every tag still "?" fills at once and gets sharing's 4 pt `colors.myRose` ring. On P6–P8 the added block lands at once if it hasn't yet. The guided tap plays the correct moment.
- **Correct, "Yes! Two hundred and thirty-four!":**
  - P1–P5: the tags still "?" fill left to right, and the trays pulse together once.
  - P6–P8: the added block drops in fast if it hasn't yet, its tray's tag ticks, and the number tag changes to the answer.
  - The chip burst, sparkle, plink and `celebration` are today's.
- **Advance:** today's 250 ms Math exit. Everything resets per problem.

### 3.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Build drop** (the read): a tray's blocks enter one by one, 90 ms apart, in placement order. Each drops from 16 pt above (tablet 24): `translateY` springs to 0 (stiffness 260, damping 20) while opacity goes 0 → 1 over 120 ms. As the last block lands, its tag pulses 1 → 1.1 → 1 over 300 ms `EASE_IN_OUT`. [The tray's blocks fade in together over 150 ms. No pulse.]
- **The added block** (hint 2, correct, given answer): it starts 40 pt above its tray, with its "+10" or "+100" pill (multiply's pill, 20 pt tall, tablet 24) riding 4 pt above it. It drops on a spring (stiffness 220, damping 18) to its next free place. The pill fades out over 200 ms, 600 ms after landing. **Fast form** (a correct tap before hint 2): the same with stiffness 300, damping 22, and no pill. [A 200 ms crossfade into place, the pill shown for 600 ms with no motion.]
- **Tag tick** (the digit changes, e.g. 4 → 5): the old digit moves up 8 pt and fades (120 ms). The new one springs up from 8 pt below, scale 0.6 → 1 (stiffness 260, damping 20). [A 150 ms crossfade.]
- **Tag fill:** sharing's (`content-wave-2.md` § 2.5), with an 80 ms stagger from the left. [A 200 ms crossfade.]
- **Number tag change:** the same as a tag tick, on the whole number. [A 150 ms crossfade.]
- **Ripple and pulse:** multiply's: 1 → 1.06 → 1 over 300 ms `EASE_IN_OUT`, 60 ms stagger in placement order. [No scale.]
- **Durations:** the longest build is 7 blocks (P4's cubes) at 90 ms, about 0.9 s. Each build fits between its own word tick and the next part's.
- **Implementation:** one shared value per block, scheduled with `withDelay` on the UI thread. At most 18 blocks move at once (P5: 3 + 2 + 6 = 11; P4: 5 + 3 + 7 = 15). No new bundle weight beyond the three glyphs.
- **Rotation mid-build:** blocks already launched land at once, and the rest keep their schedule in the new layout.
- **No new sounds.**

### 3.6 Data model, parser, chips, session end

**New kinds** in `extendedProblems.ts`, opt-in through `{ extendedKinds: true }`. `ExtendedMathProblemKind` gains `'place-value'` and `'more'`. These are the exact names; Kevin's core PR and Devon's stage PR both use them:

```ts
export type PlacePart = 'hundreds' | 'tens' | 'ones'
export interface PlaceValueProblem {
  kind: 'place-value'
  index: number // 1..8
  hundreds: number // 2..9
  tens: number // 2..9
  ones: number // 2..9
  spokenOrder: readonly PlacePart[] // the read's order, e.g. ['ones', 'tens', 'hundreds']
  correct: number // 100·hundreds + 10·tens + ones
  utterances: MathProblemUtterances
}
export interface MoreProblem {
  kind: 'more'
  index: number
  start: number // 111..989, no zero digit
  step: 10 | 100
  correct: number // start + step, ≤ 999
  utterances: MathProblemUtterances
}
```

**Read templates** (disjoint from every existing one; none contains "hundreds," or "more?"):

- **place-value:** three parts `<digit word> (hundreds|tens|ones)`, comma, part, `and`, part, `. What number is it?`. Each place exactly once, in any order, and each digit word two…nine.
- **more:** `<number words>. What is (ten|one hundred) more?`.
- **`wordToNumber` grows** to "<one…nine> hundred" with an optional "and <1…99 in words>" (British "and"), giving 100…999. Valid: `start + step ≤ 999`, no regrouping (`step` 10 needs tens ≤ 8, and `step` 100 needs hundreds ≤ 8), and no zero digit in `start`.
- **Before merge:** all 8 `math.p*.read` of `hundreds.json` parse (sibling checklist, the read-line row).

**Chips:** a new `hundredsDistractors(problem): [number, number]` in `extendedDistractors.ts`; `buildExtendedChipOrder` shuffles them as for multiply. Every chip is in 100..999, and all three differ.

| Problems                                    | Wrong chip A                                                              | Wrong chip B                    | Offered class    |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------- | ---------------- |
| place-value, index ≤ 3                      | hundreds + 2 (if hundreds ≤ 5, else − 2)                                  | hundreds + 4 (if ≤ 5, else − 4) | `'gentle'`       |
| place-value, index ≥ 4, read in place order | **tens and ones swapped** (537 → 573, M6)                                 | tens + 1 (tens 9 → − 1)         | `'digit-swap'`   |
| place-value, any other order                | **the digits in spoken order** (six ones, two tens, three hundreds → 623) | tens and ones swapped           | `'spoken-order'` |
| more, step 10                               | start + 1                                                                 | start + 100                     | `'wrong-place'`  |
| more, step 100                              | start + 10                                                                | start + 1                       | `'wrong-place'`  |

**Session end:**

- It records `perProblemCorrect`, `latencyMs`, `perProblemAnswerValue` (the tapped number, up to 999, which is why G exists) and `perProblemDistractorClass` (the class above) as today. No `mathFacts` entry and no Leitner outcome.
- `CANON_MATH_FACTS['hundreds']` is 8 nulls, as for `div-share`.
- Warm-up hearts never come from hundreds (it has no fact). Once mastered, its 8 blocks join the review pool.

### 3.7 Canon (binding: the splice writes exactly this)

| P   | Kind        | Read (characters)                                                   | Answer | Chips (correct first) |
| --- | ----------- | ------------------------------------------------------------------- | ------ | --------------------- |
| 1   | place-value | "Two hundreds, three tens and four ones. What number is it?" (58)   | 234    | 234, 434, 634         |
| 2   | place-value | "Three hundreds, five tens and two ones. What number is it?" (58)   | 352    | 352, 552, 752         |
| 3   | place-value | "Four hundreds, two tens and six ones. What number is it?" (56)     | 426    | 426, 626, 826         |
| 4   | place-value | "Five hundreds, three tens and seven ones. What number is it?" (60) | 537    | 537, 573, 547         |
| 5   | place-value | "Six ones, two tens and three hundreds. What number is it?" (57)    | 326    | 326, 623, 362         |
| 6   | more, 10    | "Two hundred and forty-three. What is ten more?" (46)               | 253    | 253, 244, 343         |
| 7   | more, 100   | "Four hundred and sixty-five. What is one hundred more?" (54)       | 565    | 565, 475, 466         |
| 8   | more, 10    | "Seven hundred and twenty-eight. What is ten more?" (49)            | 738    | 738, 729, 828         |

- **Per problem:**
  - correct "Yes! <Answer in words>!" (33–36 characters, e.g. "Yes! Two hundred and thirty-four!");
  - giveAnswer "This one is <answer in words>." (40–43);
  - reprompt "Hmm... try again?" (reused);
  - hints as § 3.4: "Look at the hundreds." (21), "Look at the tens." (17), "Look at the ones." (17), "One more ten." (13), "One more hundred." (17), "What is ten more?" (17), "What is one hundred more?" (25).
- **Session end:** every math file's lines, with `session.end.recap.focus` = "You worked on hundreds today!" (29).
- **The rules this table meets** (a splice lint checks them):
  - place-value digits are 2–9, the three digits differ, and P1–P4 read in place order;
  - more-problems have no zero digit and no regrouping;
  - the 8 answers differ, and every chip follows § 3.6.
- **Why this order:** P1–P3 can be answered from the flats alone (the gentle chips differ only there). P4 is the first digit-swap trap. P5 says the parts in Danish order (ones before tens), so the spoken-order chip is exactly the slip M6 predicts. P6–P8 then move one place at a time.

<!-- wave3:next -->
