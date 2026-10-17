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

## 4. WS-E: little stories (`fox-stories`, `hen-stories`, `bug-stories`)

### 4.1 The steps

- **Three SkillNodes**, after `cake-words` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`, in this order. Default `'locked'`.
- **Each serves its 8 stories from canon, in canon order, every session** (§ 4.7). P1–P3 use gentle chips and P4–P8 trap chips.
- **One question word per step:** fox stories ask "Who…?" (the answer is a character), hen stories "What…?" (an object) and bug stories "Where…?" (a place). Reviews, peeks and replays mix them later.
- **Mastery, fast track, pace guard, peek, replay:** the Word Song preset. A secure session needs all 8 right on the first tap. No graduation gate, and no cross-vowel mix.
- **New content type `'little-story'`.** The rest of this section is its spec.

### 4.2 What she sees

P1 of fox stories, phone portrait (375×667). On the left during the reading beat, on the right in the reveal:

```
+----------------------------+   +----------------------------+
| [<]           ✦3 (★ 12)    |   | [<]           ✦3 (★ 12)    |
| ◉ ○ ○ ○ ○ ○ ○ ○            |   | ◉ ○ ○ ○ ○ ○ ○ ○            |
| (Emma) | Read the story. | |   | (Emma) | The fox sat on  | |
| (147 ) |                 | |   | (147 ) | the rug. It has | |
| +------------------------+ |   | +------------------------+ |
| | The fox sat on the rug.| |   | | The fox sat on the rug.| |  words light as
| | It has a cup.          | |   | | It has a cup.          | |  Emma reads
| +------------------------+ |   | +------------------------+ |
|                            |   |      +--------------+      |
|   (nothing: no picture     |   |      |    scene     |      |  the scene, only
|    while she reads)        |   |      |   200 pt     |      |  after the answer
|                            |   |      +--------------+      |
+----------------------------+   +----------------------------+
```

When Emma asks "Who sat on the rug?", three picture chips (fox, rug, cup, shuffled) enter in the chip row, under the card. On phone landscape they enter in the right-hand chip column.

**Parts** (new `mobile/src/screens/wordSong/StoryCard.tsx`, `testID="word-story"`, `accessibilityLabel` = the story):

- **The card:** the sentence panel's look (white, 3 pt `#FFC0CB` border, radius 16, its shadow). Fredoka 600, `#3B3B3B`. **Each sentence starts a new line.** The words are separate `Pressable`s, 0.35 em apart (`accessibilityRole="button"`, label "Word fox").
- **The spotlight:** the letter row's (`word-song-native.md` § 3), drawn behind one word: `#FFB7C5`, the word's width + 4, height F + 8, radius 0.3 F. The word stays dark.
- **The scene:** a square `Image` (`contain`) of `mobile/assets/scenes/story-<id>.webp` (600 px), radius 16. If a scene is missing, the answer's pack picture is shown at the scene's size instead, so the steps can ship before the scenes.

### 4.3 Layout and sizes

`wordSongLayout` gets the card metrics. The card sits at the **top** of the stage, so the reveal has room under it.

| Form (stage)                      | Font / line height | Padding (h / v) | Text width | Card at 3 lines | Scene in the reveal                |
| --------------------------------- | ------------------ | --------------- | ---------- | --------------- | ---------------------------------- |
| P 375×667 (343 × 257)             | 24 / 46            | 16 / 12         | 305        | 168             | 196 (2-line card: 200)             |
| L 667×375 b21 (376 × 189)         | 22 / 44            | 16 / 10         | 333        | 158             | 99–104, in the chip column's place |
| Tablet, iPad mini L (stage 325 h) | 32 / 56            | 24 / 16         | ≤ 586      | 206             | 243                                |
| Tablet portrait 744×1133          | 32 / 56            | 24 / 16         | ≤ 586      | 206             | 280                                |

- **Measured** (my scratch script on 2026-10-17, Fredoka 600 advances read from `Fredoka_600SemiBold.ttf`, no kerning, 0.35 em gaps): every story takes 2 or 3 lines in P at 24 pt in 305 pt, in L at 22 pt in 333 pt, and on a tablet at 32 pt in 512 pt. The widest sentence, "The fox and the crab sat in the sun.", is 383 pt at 24 pt, so it wraps once in P. Four stories take 3 lines in P: fox 8, hen 7, hen 8 and bug 6.
- **Line height ≥ 44 pt** on every form, so each word's tap area is at least 44 pt tall. A word's box is its width plus half the gap on each side, so the boxes touch. Short words ("a", "it") are narrower than 44 pt. A miss only plays the next word, so they get no extra room (the letter-cell rule, `word-song-native.md` § 3).
- **The reveal rect** (P and tablet) runs from the card's bottom + 12 to the chips' bottom edge, across the stage's width. Scene = min(rect height, rect width, 200 on phones / 280 on tablets), and never under 120. In L the chip column's rect is the reveal rect: a small scene, on the one form Marian doesn't use.
- **The question** goes in the ribbon's fixed slot (3 lines in P, 2 in L). The longest is 21 characters.

### 4.4 Beats, problem by problem

1. **The card enters** (any opener or lead first, as today). Emma is `listening`.
2. **"Read the story."** (`guide.story.read`) plays on every story card. It is skipped only when the step's own intro lead plays, because that lead starts with the same words. After a peek, review or replay opener: the opener, 400 ms, then this line.
3. **The reading beat** starts when that line (or the lead) ends. It lasts `clamp(6000, 900 × words, 12000)` ms of foreground time: 9 s for 10 words, 12 s for 14. Word taps hold the question: it starts no sooner than 2000 ms after the last tap, and never later than 20 s after the beat began. **Nothing on screen counts down.** (`STORY_READ_MS_PER_WORD = 900`; D3.)
4. **The question:** Emma reads the `read` line ("Who sat on the rug?"), and the ribbon walks it. The three chips enter as it starts, closed (0.6 opacity), and open when it ends (Word Song's gate). The card stays: she may read it again and tap words.
5. **Wrong 1:** the poof, the shake, `puzzled-tilt`, "Hmm... try again?", then 400 ms and the question again.
6. **Wrong 2:** "Hmm... try again?", then 600 ms, then **Emma reads the story** (the `hint` clip) with the read-along (§ 4.5), `attentive-pointing`. Then 400 ms and the question again.
7. **Wrong 3:** "This one is the fox." and the guided glow. The guided tap plays the correct moment. Never a red X.
8. **Correct:** today's chip burst, sparkle, plink and `celebration`, and "Yes! The fox!".
9. **The reveal** (after a correct or guided tap): 300 ms after the correct line ends, the chips fade out and the scene enters. 400 ms after it lands, Emma reads the story with the read-along, `attentive-pointing`. Then 800 ms, then today's 250 ms exit.

**Word taps** (the reading support):

- A tap plays that word alone (`guide.story.word.<word>`, § 5.1) and lights it.
- They work from the card's first frame until the reveal starts.
- They do nothing while Emma speaks any line, as the letters don't. A new tap cuts the word in flight; there is no queue.
- They aren't moves: no attempt, no streak change, no Emma reaction, nothing recorded.
- Tapping a word never shows a picture.

**Decode first (K8):** no picture is on screen before her first answer. The chips aren't mounted during the beat, because picture chips would let her guess the nouns (`phonics-sequence-marian.md` Q6). The scene comes only in the reveal.

### 4.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Card entrance:** opacity 0 → 1 and `translateY` 12 → 0 on a spring (stiffness 260, damping 20). [A 150 ms fade.]
- **Tapped word:** the spotlight fades in over 120 ms, and the word scales 1 → 1.08 → 1 over 300 ms `EASE_OUT`. It stays lit for max(400 ms, the clip), then fades out over 200 ms. [The spotlight only, no scale.]
- **Read-along** (hint and reveal): the spotlight walks the words, each fading in over 120 ms at its mark − 40 ms (the blend's early-not-late rule) while the one before fades out. No scale. Everything goes dark 200 ms after the clip ends. [Unchanged: it is colour, not motion.]
- **Marks:** `mobile/scripts/export-assets.mjs` writes `storyMarks.generated.ts`, keyed by each story's hint text, with the clip's byte length. `silencedetect` at −35 dB on silences ≥ 250 ms gives one segment per sentence; there must be exactly as many segments as sentences, or there is no entry. Inside a sentence, word k starts at `on + (off − on) × (characters before word k) ÷ (the sentence's characters)`. With no entry or a byte mismatch, the whole clip is split by characters (the caption clock's fallback).
  - **Prediction (hypothesis):** words light within about ±150 ms of the voice. If the device check sees them out of step, set `STORY_READ_ALONG = 'sentence'`: the whole sentence lights for its segment instead.
- **Chips:** today's entrance; on the reveal they fade out over 200 ms (`FadeOut`).
- **Scene entrance:** scale 0.92 → 1 on a spring (stiffness 260, damping 20), with opacity 0 → 1 over 250 ms. [A 200 ms fade.]
- **No new sounds** beyond Emma's lines and the word clips.

### 4.6 Data model, parser, chips, session end

**The story table** is the single source for the canon splice, the parser and the scenes: `packages/core/src/wordSong/littleStories.ts`. These are the exact names:

```ts
export type StoryNode = 'fox-stories' | 'hen-stories' | 'bug-stories'
export const STORY_NODES: readonly StoryNode[]
export interface LittleStory {
  id: string // 'fox-1' … 'bug-8'; the scene file is story-<id>.webp
  node: StoryNode
  story: string // = the canon `hint` text
  question: string // = the canon `read` text
  answer: string // a pack word with a picture
  wrong: readonly [string, string] // pack words with pictures, both in the story
}
export const LITTLE_STORIES: readonly LittleStory[] // the 24 rows of § 4.7
export function littleStoryForText(story: string): LittleStory | undefined
```

**The wire stays utterance-only, with the same 5 slots** (K10):

- `read` = the question.
- `hint` = the story. Emma reads it as the hint and in the reveal, and the card displays it.
- `correct` = "Yes! The fox!" or "Yes! In the cup!".
- `giveAnswer` = "This one is the fox.".
- `reprompt` = "Hmm... try again?".

**Parser** (`wordSongSessionPlanFromServer`, the cloze precedent of resolving the target outside the read):

- A read matching `^(Who|What|Where)\b[^?]*\?$` is a `'little-story'` problem. No existing read starts that way.
- The target comes from the correct line, `^Yes! (?:The|(?:In|On|To) the) ([a-z]+)!$`.
- `littleStoryForText(hint)` must find the row, and its `answer` must equal the target. Otherwise the plan throws `PlanFromServerError` and the session falls back.
- The problem carries `story`, `storyId` and `question`. The chips are `[answer, ...wrong]` through `buildChipOrder`'s shuffle, **not** `TARGET_PAIRINGS`. No `TARGET_PAIRINGS` or `FORBIDDEN_PAIRS` rows are added, but no trio holds a forbidden pair (§ 4.7).

**Session end:** `surface: 'word-song'`, with `targetWords` = the answers and `perProblemAnswerWord` = the tapped words, as today. The recap phrase is "reading stories".

**Warm-up and review:**

- `pickWarmupBlocks` (Word Song) takes the newest mastered review step **not in `STORY_NODES`**. A story block is about 20 s long, and a heart should be a quick win.
- Once mastered, story blocks join the review pool like any block, and a review block plays the full flow, reveal included.

### 4.7 The 24 stories (binding: the splice writes exactly this)

Every problem also has the reprompt "Hmm... try again?" (reused) and the giveAnswer "This one is the <answer>." (17 + the answer's length, e.g. "This one is the fox." is 20). `hint` = the story.

**Fox stories ("Who…?")**

| P   | Story (words / characters)                                            | Question (characters)       | Answer | Wrong chips | Correct line          |
| --- | --------------------------------------------------------------------- | --------------------------- | ------ | ----------- | --------------------- |
| 1   | "The fox sat on the rug. It has a cup." (10 / 37)                     | "Who sat on the rug?" (19)  | fox    | rug, cup    | "Yes! The fox!" (13)  |
| 2   | "The fox has a hat. The hat is in the box." (11 / 41)                 | "Who has a hat?" (14)       | fox    | hat, box    | "Yes! The fox!"       |
| 3   | "The fox is in the tent. The tent is on a rock." (12 / 46)            | "Who is in the tent?" (19)  | fox    | tent, rock  | "Yes! The fox!"       |
| 4   | "The fox sat on the bed. The hen ran to the van." (12 / 47)           | "Who ran to the van?" (19)  | hen    | fox, van    | "Yes! The hen!" (13)  |
| 5   | "The dog has a bone. The fox has a fig." (10 / 38)                    | "Who has a fig?" (14)       | fox    | dog, bone   | "Yes! The fox!"       |
| 6   | "The frog sat on a log. The fox hid in the shed." (12 / 47)           | "Who hid in the shed?" (20) | fox    | frog, log   | "Yes! The fox!"       |
| 7   | "The pig got a kite. The fox ran to the pig." (11 / 43)               | "Who got a kite?" (15)      | pig    | fox, kite   | "Yes! The pig!" (13)  |
| 8   | "The fox and the crab sat in the sun. The crab got a plum." (14 / 57) | "Who got a plum?" (15)      | crab   | fox, sun    | "Yes! The crab!" (14) |

**Hen stories ("What…?")**

| P   | Story (words / characters)                                      | Question (characters)        | Answer | Wrong chips | Correct line          |
| --- | --------------------------------------------------------------- | ---------------------------- | ------ | ----------- | --------------------- |
| 1   | "The hen has a cake. She is in the van." (10 / 38)              | "What has the hen got?" (21) | cake   | hen, van    | "Yes! The cake!" (14) |
| 2   | "The hen has a tent. A pen is in the tent." (11 / 41)           | "What is in the tent?" (20)  | pen    | hen, tent   | "Yes! The pen!" (13)  |
| 3   | "The hen has a bag. A plum is in the bag." (11 / 40)            | "What is in the bag?" (19)   | plum   | hen, bag    | "Yes! The plum!" (14) |
| 4   | "A pot is on the desk. The hen has a cup." (11 / 40)            | "What is on the desk?" (20)  | pot    | cup, desk   | "Yes! The pot!" (13)  |
| 5   | "The hen has a drum. The pig has a kite." (10 / 39)             | "What has the hen got?"      | drum   | kite, pig   | "Yes! The drum!" (14) |
| 6   | "The hen has a hat. A wig is in the pond!" (11 / 40)            | "What is in the pond?" (20)  | wig    | hat, pond   | "Yes! The wig!" (13)  |
| 7   | "The hen has a box and a lamp. A ring is in the box." (14 / 51) | "What is in the box?" (19)   | ring   | lamp, box   | "Yes! The ring!" (14) |
| 8   | "The hen got a jug. Jam is in it. She has a cup." (13 / 47)     | "What is in the jug?" (19)   | jam    | cup, jug    | "Yes! The jam!" (13)  |

**Bug stories ("Where…?")**

| P   | Story (words / characters)                                          | Question (characters)        | Answer | Wrong chips | Correct line             |
| --- | ------------------------------------------------------------------- | ---------------------------- | ------ | ----------- | ------------------------ |
| 1   | "The bug is in the cup. It has a fig." (10 / 36)                    | "Where is the bug?" (17)     | cup    | bug, fig    | "Yes! In the cup!" (16)  |
| 2   | "The bug is on the bed. It has a nut." (10 / 36)                    | "Where is the bug?"          | bed    | bug, nut    | "Yes! On the bed!" (16)  |
| 3   | "The bug got a gem. It ran to the tent." (10 / 38)                  | "Where did the bug go?" (21) | tent   | bug, gem    | "Yes! To the tent!" (17) |
| 4   | "The bug is on the rug. The cat is on the bed." (12 / 45)           | "Where is the bug?"          | rug    | bed, cat    | "Yes! On the rug!" (16)  |
| 5   | "The bug is in the bag. The bag is in the van." (12 / 45)           | "Where is the bag?" (17)     | van    | bag, bug    | "Yes! In the van!" (16)  |
| 6   | "The dog ran to the pond. The bug hid. It is in the tub." (14 / 55) | "Where did the dog go?" (21) | pond   | tub, dog    | "Yes! To the pond!" (17) |
| 7   | "The bug is in the nest. The hen is on a log." (12 / 44)            | "Where is the hen?" (17)     | log    | nest, bug   | "Yes! On the log!" (16)  |
| 8   | "The bug is on a lid. The lid is on the pot." (12 / 43)             | "Where is the lid?" (17)     | pot    | lid, bug    | "Yes! On the pot!" (16)  |

**The rules these tables meet** (a splice lint checks them; my scratch check found no breach on 2026-10-17):

- **Taught words only (D2).** Every word is:
  - a target word of a Word Song canon file, or
  - a word she has read in the sight-words or simple-sentences canon (a, the, is, it, in, on, to, she, has, sat, ran…), or
  - one of 3 decodable extras built only from patterns she has mastered: _and_ (end blend nd, tent words), _got_ and _hid_ (CVC).
  - No plurals and no -s or -ed endings. _shed_ is the one noun without a picture, and it is never a chip.
- **Shape:** 2–3 sentences and 10–14 words. Bug 6 and hen 8 have 3 sentences. Each pronoun has one clear referent: _She_ is always the hen, and _It_ is the animal of the sentence before, except hen 8's "in it" (the jug).
- **Chips:** every chip word has a pack picture and appears in the story, and no trio holds a `FORBIDDEN_PAIRS` pair (cat–dog, duck–hen, bus–van and the rest).
  - **P1–P3 (gentle):** both wrong chips are a different kind than the question asks: things for "who"; the character and a place for "what"; the character and a thing for "where".
  - **P4–P8 (trap):** one wrong chip is the same kind and is in the story (another character, object or place), so she has to read who did what. Fox 4 and 7 are answered by the friend, not the fox.
- **Why the order:** the step's gentle stories come first, and the 14-word and 3-sentence stories sit at P6–P8.

## 5. Copy / TTS script

### 5.1 Every new spoken line (for the Lily render)

Character counts are in brackets. Canon lines are in § 3.7 and § 4.7.

**Guidance** (`createManifestLinePlayer('session-guide', …)`, wave 1 § 6.1). The leads play before scored P1 of every forward session until mastery, never in a peek, review, replay or warm-up heart:

| Line id                           | `hundreds`                                        | `fox-stories`                                        | `hen-stories`                                        | `bug-stories`                                        |
| --------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `guide.session.peek-open.<node>`  | "Let's look at hundreds!" (23)                    | "Let's look at fox stories!" (26)                    | "Let's look at hen stories!" (26)                    | "Let's look at bug stories!" (26)                    |
| `guide.session.peek-close.<node>` | "Hundreds are for later. You will learn it!" (42) | "Fox stories are for later. You will learn it!" (45) | "Hen stories are for later. You will learn it!" (45) | "Bug stories are for later. You will learn it!" (45) |
| `guide.session.intro.<node>`      | "Hundreds, tens and ones!" (24)                   | "Read the story. Who did it?" (27)                   | "Read the story. What is it?" (27)                   | "Read the story. Where is it?" (28)                  |

- **Shared prompt:** `guide.story.read` "Read the story." (15), new kind `'story-read'`.
- **Word clips:** `guide.story.word.<word>`, kind `'story-word'`, text "<Word>." (e.g. "Fox."). One per distinct story word, **54 clips, 224 characters**: a, and, bag, bed, bone, box, bug, cake, cat, crab, cup, desk, dog, drum, fig, fox, frog, gem, got, has, hat, hen, hid, in, is, it, jam, jug, kite, lamp, lid, log, nest, nut, on, pen, pig, plum, pond, pot, ran, ring, rock, rug, sat, she, shed, sun, tent, the, to, tub, van, wig.
- **Replay lines, only if #592 has merged** (`map-tap-to-play.md` § 6): "Let's play <name> again!" (26, 29, 29, 29) and "You know <name>!" (18, 21, 21, 21), in the table's order.

**Path** (`PATH_LINES`, generated from the names; `pathLines.test.ts`'s baked count grows by 26):

| Line id                   | `hundreds`                                           | `fox-stories`                                              | `hen-stories`                                               | `bug-stories`                                               |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `path.open.<node>`        | "Here is your path! You are on hundreds." (39)       | "Here is your path! You are on fox stories." (42)          | "… on hen stories." (42)                                    | "… on bug stories." (42)                                    |
| `path.stop.<node>`        | "Hundreds." (9)                                      | "Fox stories." (12)                                        | "Hen stories." (12)                                         | "Bug stories." (12)                                         |
| `path.locked.next.<node>` | "Hundreds! First, sharing. Then this!" (36)          | "Fox stories! First, cake words. Then this!" (42)          | "Hen stories! First, fox stories. Then this!" (43)          | "Bug stories! First, hen stories. Then this!" (43)          |
| `end.bud.<node>`          | "Look! A new flower for hundreds!" (32)              | "Look! A new flower for fox stories!" (35)                 | "… for hen stories!" (35)                                   | "… for bug stories!" (35)                                   |
| `end.unlock.<node>`       | "You learned sharing! Now you can do hundreds!" (45) | "You learned cake words! Now you can do fox stories!" (51) | "You learned fox stories! Now you can do hen stories!" (52) | "You learned hen stories! Now you can do bug stories!" (52) |

- **Lands:** "Land 5: Hundreds." (17), "A new land! Land 5: Hundreds!" (29), "A new land: Hundreds!" (21); "Land 7: Stories." (16), "A new land! Land 7: Stories!" (28), "A new land: Stories!" (20).
- The deferred kinds (`locked-later`, `gate-locked`) generate as today and aren't rendered.

**Total: 218 distinct new texts, 4,980 characters for ElevenLabs Lily** (210 and 4,786 without the 8 replay lines).

| Surface                | Texts | Characters |
| ---------------------- | ----- | ---------- |
| guidance (with prompt) | 13    | 399        |
| replay (#592)          | 8     | 194        |
| path                   | 26    | 842        |
| word clips             | 54    | 224        |
| canon `hundreds`       | 32    | 1,190      |
| canon `fox-stories`    | 25    | 661        |
| canon `hen-stories`    | 31    | 746        |
| canon `bug-stories`    | 29    | 724        |

- **How it was counted:** a scratch script (2026-10-17, not committed) generated the texts from this spec's lists and compared them with every `text` in `public/canon/*/level-1/*.json` and every literal in `guidanceLines.ts`. Only "Hmm... try again?" is reused (32 slots). Repeats inside the wave count once ("Yes! The fox!" serves 5 stories).
- **The bill holds only if the bake reuses audio** (wave 2 § 6.2): `revoiceCanonLily.ts` de-duplicates on exact text. Its `--dry-run` prints the real number before any spend.
- **Canon is spliced, not Haiku-baked:** `scripts/spliceContentWave3Canon.ts` writes the four files from § 3.7 and `LITTLE_STORIES`. The four nodes join `PENDING_CANON_NODES`.
- **Render with** `renderGuidanceLinesLily.ts` (guidance, prompt, word clips, replay), `renderPathLinesLily.ts` and `revoiceCanonLily.ts --unrendered`.

**Prediction for the ear test (Predict-Before-Soak; bar 2):**

- Every story clip pauses ≥ 250 ms at each full stop (the marks need it), and "Where did the bug go?" rises at the end.
- "Two hundred and forty-three" comes out British, with a clear "and"; "Two hundreds, three tens and four ones" keeps the plural s's.
- The isolated "A." is said "ay" and "The." "thee"; both are acceptable citation forms.
- **Not predicted:** whether "What has the hen got?" stresses _got_. The ear test settles it.

### 5.2 Vocabulary check (the ~200-word cap)

- **New core words: 5.** _hundred_ (and _hundreds_), _story_ (and _stories_), _who_; and the story verbs _got_ and _hid_, which Emma now says. _ones_, _tens_, _more_, _number_, _did_, _what_ and _where_ are already in her lines. That takes wave 2's count of about 169 to about 174.
- **Target words:** _fox_, _hen_ and _bug_ name the steps. Every other story word is already a target or sight word.
- **Zero-cost choices, made on purpose:** "Hundreds, tens and ones!" not "place value"; "What is ten more?" not "add ten"; "What has the hen got?" (British) not "What does the hen have?".
- Every text is ASCII-7, with no IPA.

## 6. Pictures (OpenAI, a scene mode for the generator)

**24 new pictures: one scene per story.** The hundreds blocks are drawn in code (K5), and every chip word already has a pack picture (89 WebPs).

- **Generator mode** `npx tsx scripts/generatePackPictures.ts --scenes`:
  - It reads a new `design/word-song/scene-manifest.json`, so the pack manifest and its checks don't change.
  - Its prompt is `Subject` + `STYLE_INSTRUCTION` + a new `SCENE_RULES`: "Show exactly the characters and objects named, each drawn like its reference picture, in one simple scene on a soft cream background that fills the square. Nothing else: no other animals, people or objects, no text or letters, no faces on objects." Then `avoid`.
  - **Image inputs:** the 3 style anchors, plus the approved pack PNG of each `refs` word (the chips plus the hero, at most 4). The fox in the scene is then the fox on the chip.
  - **Output:** an opaque 1024 px PNG, exported to `mobile/assets/scenes/story-<id>.webp` at 600 px. There is one contact sheet per batch, and Thomas approves each batch.
- **Cost:** ~$0.078 per picture (the brief's rate), plus about $0.008 per reference image (1,024 tokens at $8 / 1M, from `packPictureLib.ts`'s `MEASURED` and `RATES_PER_1M`). That is about $0.11 a scene and **about $2.60 for 24**. A second round on the six riskiest (fox-3, fox-8, hen-6, hen-7, bug-7, bug-8) adds about $0.66. The `--dry-run` prints the real estimate first.
- **If a scene fails its second round, stop and tell Matt.** The reveal can ship without it (§ 4.2's fallback).
- **Don't create the file before Thomas approves (T4):** the generator reads the whole file, so an early file could start the spend.

**`design/word-song/scene-manifest.json`** (batches 1–3 = fox, hen, bug):

```
  { "scene": "fox-1", "tier": "fox-stories", "batch": 1, "subject": "The fox sitting on a striped woven rug, with a pink mug standing on the rug beside it.", "avoid": ["a table or a chair"], "refs": ["fox", "rug", "cup"] },
  { "scene": "fox-2", "tier": "fox-stories", "batch": 1, "subject": "The fox sitting beside an open cardboard box; a hat sits inside the box, its top showing.", "avoid": ["the fox wearing the hat"], "refs": ["fox", "hat", "box"] },
  { "scene": "fox-3", "tier": "fox-stories", "batch": 1, "subject": "A small orange tent standing on top of a big grey rock, with the fox looking out of its open door.", "avoid": ["the tent on grass beside the rock"], "refs": ["fox", "tent", "rock"] },
  { "scene": "fox-4", "tier": "fox-stories", "batch": 1, "subject": "On the left the fox sits on a bed; on the right the hen runs towards a peach van.", "avoid": ["the fox running", "the hen on the bed"], "refs": ["fox", "hen", "van"] },
  { "scene": "fox-5", "tier": "fox-stories", "batch": 1, "subject": "The dog holding a bone in its mouth, and the fox beside it holding a fig in its paws.", "avoid": ["the fox with the bone"], "refs": ["fox", "dog", "bone"] },
  { "scene": "fox-6", "tier": "fox-stories", "batch": 1, "subject": "A frog sitting on a log in front; behind it a small wooden garden shed with the fox peeking out of its door.", "avoid": ["the fox on the log"], "refs": ["fox", "frog", "log"] },
  { "scene": "fox-7", "tier": "fox-stories", "batch": 1, "subject": "The pig holding a kite string with the kite flying above, and the fox running towards the pig.", "avoid": ["the fox holding the kite"], "refs": ["pig", "fox", "kite"] },
  { "scene": "fox-8", "tier": "fox-stories", "batch": 1, "subject": "The fox and the crab sitting side by side under a warm sun; the crab holds a purple plum in one claw.", "avoid": ["the fox holding the plum"], "refs": ["crab", "fox", "sun", "plum"] },
  { "scene": "hen-1", "tier": "hen-stories", "batch": 2, "subject": "The hen sitting inside a peach van, seen through its open side door, with a pink-iced cake beside her.", "avoid": ["candles or numbers"], "refs": ["hen", "cake", "van"] },
  { "scene": "hen-2", "tier": "hen-stories", "batch": 2, "subject": "The hen standing beside a small orange tent; through its open door a pink pen lies on the tent floor.", "avoid": ["the hen holding the pen"], "refs": ["hen", "pen", "tent"] },
  { "scene": "hen-3", "tier": "hen-stories", "batch": 2, "subject": "The hen holding a pink tote bag with a purple plum peeking out of the top.", "avoid": ["more than one plum"], "refs": ["hen", "plum", "bag"] },
  { "scene": "hen-4", "tier": "hen-stories", "batch": 2, "subject": "A grey cooking pot standing on a small wooden desk; the hen beside the desk holding a pink mug.", "avoid": ["the mug on the desk"], "refs": ["hen", "pot", "cup", "desk"] },
  { "scene": "hen-5", "tier": "hen-stories", "batch": 2, "subject": "The hen beating a small drum, and the pig next to her holding a kite.", "avoid": ["the hen holding the kite"], "refs": ["hen", "drum", "kite", "pig"] },
  { "scene": "hen-6", "tier": "hen-stories", "batch": 2, "subject": "The hen wearing a hat at the edge of a small pond; a curly brown wig floats on the water.", "avoid": ["a person", "the hat on the water"], "refs": ["hen", "wig", "hat", "pond"] },
  { "scene": "hen-7", "tier": "hen-stories", "batch": 2, "subject": "The hen beside a table lamp and an open cardboard box; a gold ring sits inside the box.", "avoid": ["the ring on the lamp"], "refs": ["hen", "ring", "lamp", "box"] },
  { "scene": "hen-8", "tier": "hen-stories", "batch": 2, "subject": "The hen holding an open jug full of red jam, with a pink mug beside her.", "avoid": ["jam in the mug"], "refs": ["hen", "jam", "cup", "jug"] },
  { "scene": "bug-1", "tier": "bug-stories", "batch": 3, "subject": "The pink bug sitting inside a pink mug, peeking over the rim and holding a fig.", "avoid": ["coffee or tea in the mug"], "refs": ["bug", "cup", "fig"] },
  { "scene": "bug-2", "tier": "bug-stories", "batch": 3, "subject": "The pink bug sitting on a bed's pillow, with a walnut beside it.", "avoid": ["a person in the bed"], "refs": ["bug", "bed", "nut"] },
  { "scene": "bug-3", "tier": "bug-stories", "batch": 3, "subject": "The pink bug walking in at the open door of a small orange tent, carrying a small gem.", "avoid": ["the bug far from the tent"], "refs": ["bug", "tent", "gem"] },
  { "scene": "bug-4", "tier": "bug-stories", "batch": 3, "subject": "The pink bug on a striped rug in front; behind it the cat lies on a bed.", "avoid": ["the bug on the bed"], "refs": ["bug", "rug", "bed", "cat"] },
  { "scene": "bug-5", "tier": "bug-stories", "batch": 3, "subject": "A peach van with its side door open; inside it a pink tote bag, with the pink bug peeking out of the bag.", "avoid": ["the bag outside the van"], "refs": ["bug", "van", "bag"] },
  { "scene": "bug-6", "tier": "bug-stories", "batch": 3, "subject": "The dog running to a small pond; nearby the pink bug hides in a cream bathtub.", "avoid": ["the dog in the tub"], "refs": ["dog", "pond", "tub", "bug"] },
  { "scene": "bug-7", "tier": "bug-stories", "batch": 3, "subject": "The pink bug sitting in a bird's nest, and the hen sitting on a log beside it.", "avoid": ["eggs in the nest", "the hen in the nest"], "refs": ["bug", "nest", "hen", "log"] },
  { "scene": "bug-8", "tier": "bug-stories", "batch": 3, "subject": "A grey cooking pot with its lid on, and the pink bug sitting on top of the lid.", "avoid": ["steam or fire", "the bug in the pot"], "refs": ["bug", "lid", "pot"] }
```

**The 6 clay pieces (§ 1) are not in this pipeline.** They are made as the clay set was, with Thomas's tool.

## 7. States and edge cases

- **Error path:** a wrong tap gets the poof, the shake, `puzzled-tilt` and "Hmm... try again?", the hints at 2 wrongs and the given answer at 3. Never a red X.
- **First visit:** the Map's land beat, then the lead before P1 of each forward session until mastery.
- **Peek:** P1–P3 with the step's opener and closer, no lead, nothing written. Hundreds builds as usual, and a story runs its full flow, reveal included.
- **Replay (#592) and review:** the canon blocks, in full. A story block is never a warm-up heart (§ 4.6), and hundreds has no fact to make one.
- **Return user who finished a world:** wave 1's load rule (K13).
- **Background:** the reading beat counts foreground time only. Lines park and resume (#528), and the read-along freezes with the voice.
- **Rotation:** layouts recompute and nothing replays. A lit word stays lit, and a build in flight lands at once.
- **Missing assets:** a missing scene shows the answer's pack picture. A missing word clip leaves the word lighting silently.
- **Reduce Motion:** § 3.5 and § 4.5.
- **Ship order:** G on both devices first (§ 2). The deployed server doesn't know the four nodes until `yarn release`, so release before the device check (wave 2 § 8).
- **Web:** a hundreds or story read throws, and the web's static fallback plays.

## 8. Wiring checklist (Kevin, Devon)

**Each new SkillNode** goes through `.claude/docs/sibling-tier-checklist.md`:

- **All four:** rows 1–10 and 12.
- **The three story steps:** row 11, and rows 13–15 (`VALID_WORD_SONG_FOCUS_NODES`, `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, `WORD_SONG_FOCUS_NODES`).
- **`hundreds`:** `VALID_MATH_FOCUS_NODES` (`api/_planner.ts`) and `MATH_FOCUS_NODES` (`scripts/generateSessionCanon.ts`).
- **Skipped:** row 16, the web debug seeds.

**From the list's "does not cover" section:** the math read-line template (8/8); `CANON_FILES` in `public/voice-qa.html` (4 stems); the committed canon JSON; the sibling-spec audit of e2e seeds ending at `cake-words` or `div-share`.

**Plus:**

- **G first** (§ 2), its own PR and build.
- **Names:** `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS`, `FRIENDLY_NODE_NAMES`, the recap list in `api/_planner.ts` and `scripts/recapFocusCopy.ts`.
- **Map and lines:** `LANDS` (+2 lands), `PATH_LINES` (+26 baked), `PATH_ART_SET` (+4), `LandArtId` (+2), `GUIDANCE_LINES` (4 peek pairs, 4 intros, the prompt, 54 word clips, and 4 replay pairs if #592 has merged).
- **Math:** `EXTENDED_ANSWER_MAX` 999 and `TWO_DIGIT_CHIP_MAX` (§ 2, G4); `PlaceValueProblem`, `MoreProblem`, their templates and `wordToNumber`; `hundredsDistractors`; `extendedMathLayout(…, 'place-value')`; `PlaceValueStage` and the three glyphs; `CANON_MATH_FACTS` (8 nulls).
- **Word Song:** `littleStories.ts`; the `'little-story'` parser route; `StoryCard`; `wordSongLayout`'s card metrics; `storyMarks.generated.ts`; the scene registry; `pickWarmupBlocks`'s exclusion.
- **Canon and pictures:** `spliceContentWave3Canon.ts`, `PENDING_CANON_NODES` + 4, and the generator's `--scenes` mode.

**Unchanged on purpose:** `isLeitnerDirectiveActive`, `MULTIPLICATION_FOCUS_NODES`, `MIX_SOURCE_STEPS`, `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`, the celebration exception list, `TARGET_PAIRINGS`, `FORBIDDEN_PAIRS`, `pickDistractors`, and the guard's `mathFacts` bounds.

## 9. Acceptance criteria

**Core (vitest):**

1. **G:** the four G2 cases pass, on the local load and on the cloud install.
2. **Hundreds parser:**
   - P1 parses to `{ kind: 'place-value', hundreds: 2, tens: 3, ones: 4, correct: 234 }`, and P5 to `spokenOrder: ['ones', 'tens', 'hundreds']`, `correct: 326`.
   - P6 parses to `{ kind: 'more', start: 243, step: 10, correct: 253 }`.
   - "One hundreds, …" (digit 1), "Two hundred and four. What is ten more?" (a zero) and "Two hundred and ninety-three. What is ten more?" (regrouping) are rejected. Without `extendedKinds` it throws.
3. `hundreds.json` equals § 3.7 (8/8 reads parse), and `hundredsDistractors` returns § 3.7's chips. Skip and times chips are unchanged (`TWO_DIGIT_CHIP_MAX`).
4. A hundreds session-end write has no `mathFacts` entry, its `perProblemAnswerValue` holds the tapped 3-digit numbers, and the doc loads back.
5. **Stories:**
   - `LITTLE_STORIES` equals § 4.7, and the lint holds every § 4.7 rule.
   - The three canon files parse 24/24 to `'little-story'` with the § 4.7 chips.
   - A hint text not in the table throws.
6. `pickWarmupBlocks` never returns a block of a story step.
7. **Lines and lands:** Number Garden has 5 lands and Word Song 7. `GUIDANCE_LINES` and `PATH_LINES` hold § 5.1's texts exactly, the baked path count is +26, and the `STAGE_SPOKEN_NAMES` values stay unique.
8. **Loading:** a doc with `cake-words` mastered and no story keys loads `fox-stories: 'intro'` and the other two `'locked'`. A doc with `div-share` mastered and no `hundreds` key loads `hundreds: 'intro'`.

**Native (jest):**

9. **Hundreds:**
   - P1: the flats, rods and cubes appear on the word ticks of "hundreds", "tens" and "ones". The tags read "?" until a right tap, then 2, 3, 4. The chips are 234, 434 and 634.
   - P5: the cubes land first, in the right-hand tray.
   - P6 hint 2: a rod drops in with a "+10" pill, and the tens tag ticks 4 → 5. A right tap shows 253 in the number tag.
10. `extendedMathLayout(…, 'place-value')` gives § 3.3's u on the four forms, and every chip numeral fits its chip.
11. **Story P1 (fake timers):**
    - "Read the story." plays, and the question starts 9,000 ms after it ends (10 words). A word tap at 8,000 ms moves the question to 10,000 ms.
    - No chip or picture is mounted before the question. The chips open when it ends.
    - A right tap: the chips fade, the scene enters, the read-along plays, then the advance.
12. **Story wrongs:** the 1st replays the question; the 2nd plays the story read-along, then the question; the 3rd plays the guided answer.
13. **Word taps:** a tap plays `guide.story.word.<word>` and lights the word. Taps are inert during Emma's lines and record nothing.
14. A missing scene shows the answer's pack picture. Reduce Motion gives § 3.5's and § 4.5's bracketed forms.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP`):

15. **Each new step from the QA picker:**
    - Emma speaks every line.
    - At 375×667 and 667×375 nothing leaves its rect, and every story card is ≤ 3 lines.
    - No picture shows before the first answer. On an iPad the read-along lights each word as Lily says it; if not, ship `STORY_READ_ALONG = 'sentence'`.
16. **Map, 375×667, 744×1133 and 820×1180 portrait:** Number Garden shows 5 lands and Word Song 7, and no stops overlap. If the T6 fallback is on, the current stop is in view when the Map opens.
17. **Before any hundreds build is installed:** both devices run build G or later (Thomas checks the TestFlight build number).

## 10. Thomas decides

- **T1. The names:** "hundreds", "fox stories", "hen stories" and "bug stories", and the lands "Land 5: Hundreds" and "Land 7: Stories".
- **T2. The lines (§ 5.1):** 218 texts, 4,980 Lily characters. Chiefly the four leads, and the 54 one-word clips, which add 54 short items to the ear test.
- **T3. The 6 clay pieces (§ 1):** a hundred-flat, a fox, a hen, a bug, an apple tree and a puppet theatre.
- **T4. The picture spend:** 24 scenes, about $2.60 (about $3.30 with retakes), after an OpenAI top-up. Recommendation: approve. The scenes are the reward for reading, and the steps can ship without them.
- **T5. The rollout (§ 2, G3):** build G goes on the iPad and the iPhone before any hundreds build, and no device is downgraded below it.
- **T6. The Map fallback (§ 1):** if 7 Word Song lands don't fit the portrait bars, the Word Song path scrolls on portrait as it does in phone landscape. Recommendation: approve now, so a failed bar doesn't stall the build.

## 11. Pedagogy assumptions for Dave (D1…)

The spec had to fill these in. All are **pending** Dave's check after the PR opens.

- **D1. Three steps, one question word each** (who → what → where), 8 stories each, each led by one character. Alternative: mix the question words in every step and grow the stories in length instead.
- **D2. The taught-word rule (§ 4.7):** target and sight words only, plus _and_, _got_ and _hid_ as decodable extras; no plurals or endings; 10–14 words; 2–3 sentences (only 2 of the 24 have three).
- **D3. Story, then question.** The story stays on screen during the question (look-back is allowed). The beat is 900 ms per word (6–12 s), held by word taps (≥ 2 s after the last, at most 20 s).
- **D4. Reading support:** a word tap plays that word. Emma reads the whole story only on the 2nd wrong and in the reveal, never on request before an answer.
- **D5. No picture before the first answer:** the chips mount with the question, and the scene comes in the reveal (Q6).
- **D6. The chips:** P1–P3 wrong chips are another kind; P4–P8 add a same-kind noun from the story. The question's own noun may be a chip (fox 1's rug, hen 7's box).
- **D7. Story blocks are never warm-up hearts**, but they join reviews.
- **D8. Hundreds is built by Emma and tapped by Marian.** The place-value digits are 2–9, with no 0 or 1. Zeros (305) and "one hundred" are left for a later deepening.
- **D9. The hundreds chips:** P1–P3 differ in the hundreds digit only; P4 has the tens/ones swap (M6) and tens ± 1; P5 says the parts in Danish order with a spoken-order chip (623 for 326).
- **D10. +10 and +100 inside the step** (P6–P8, no regrouping). Alternative: a step of their own.
- **D11. No Leitner fact and no equation for hundreds,** only the "+10" and "+100" pills.
- **D12. Leads every forward session until mastery** (wave 1's D5): "Hundreds, tens and ones!", "Read the story. Who did it?", "… What is it?", "… Where is it?".
