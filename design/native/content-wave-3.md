# Content wave 3: hundreds and little stories (native)

**Status:** spec only. Thomas, 2026-10-17: "Spec wave 3 now, build later". Nothing is built, rendered or generated until Thomas approves (§ 10). Dave confirmed D1–D12 on 2026-10-17 (§ 11).

**Scope:** `@marian/core`, the native app, canon and one generator mode. The web is frozen: a hundreds or story read throws there and the web plays its silent static plan (`content-wave-1.md` § 1.9). Rules follow `content-wave-2.md` (#586) unless stated. Code is anchored by names.

**Source:** `design/research/content-roadmap-after-path-ends.md` (Dave, #569): **G**, the guard's 0..99 limit (§ 2); **NG-D**, hundreds, step 14 (§ 3); **WS-E**, little stories, step 18 (§ 4).

**Out of scope:** code, renders, generation, test runs; "adding hundreds" (step 15); "How many plates?"; redrawing the 8 simple-sentence scenes.

## Goal

Marian builds and reads numbers to 999, and reads short stories she can decode, then shows she understood them.

## User state entering

- **Hundreds:** she has mastered sharing; the Map plays "A new land! Land 5: Hundreds!".
- **Fox stories:** she has mastered cake words; the Map plays "A new land! Land 7: Stories!". Hen stories follow fox stories, bug stories follow hen stories.
- **She finished a world before this build:** wave 1's load rule (its K13) opens the new step on launch.

## Decisions

- **K1.** The guard change (G) ships alone, first, and is on the iPad and the iPhone before any build with hundreds (§ 2).
- **K2.** Hundreds: Emma's read builds the number from flats, rods and cubes drawn in code (exact counts); Marian taps one of three numeral chips, never drags. 5 "What number is it?", then 3 "ten / one hundred more". The chips carry the digit swap (M6).
- **K3.** Little stories: 3 steps of 8 (a canon file holds 8), one question word each: fox stories "Who…?", hen stories "What…?", bug stories "Where…?". Named after the stop picture, like the word steps; the hero is in every story, not always the answer.
- **K4.** Decode first: story card, silent reading beat, question, picture chips, answer, and only then the scene (`phonics-sequence-marian.md` Q6). A tapped word plays itself; Emma reads the whole story only as the 2nd-wrong hint and in the reveal.
- **K5.** The wire stays utterance-only with 5 slots: the story rides in `hint`; a core table `LITTLE_STORIES` keys chips and scenes by story text.
- **K6.** Two new lands: Number Garden 5 "Hundreds", Word Song 7 "Stories". Groups is full, and "Big words" isn't stories.
- **K7.** No Leitner fact in either step. Story blocks are never warm-up hearts (about 25–30 s each, estimated), but join reviews.

Mastery, the fast track, the pace guard, reviews, peeks and Map replays (#592, if merged) behave as on the siblings. No timer, currency, streak or loss mechanic; the reading beat is invisible and never ends a problem.

## 1. Steps, lands, names and path art

| Step          | After         | Land, stop               | Spoken name | Verb | Recap phrase    | Canon file                           |
| ------------- | ------------- | ------------------------ | ----------- | ---- | --------------- | ------------------------------------ |
| `hundreds`    | `div-share`   | NG 5 Hundreds (new), 1/1 | hundreds    | are  | hundreds        | `math/level-1/hundreds.json`         |
| `fox-stories` | `cake-words`  | WS 7 Stories (new), 1/3  | fox stories | are  | reading stories | `word-song/level-1/fox-stories.json` |
| `hen-stories` | `fox-stories` | WS 7 Stories, 2/3        | hen stories | are  | reading stories | `word-song/level-1/hen-stories.json` |
| `bug-stories` | `hen-stories` | WS 7 Stories, 3/3        | bug stories | are  | reading stories | `word-song/level-1/bug-stories.json` |

- **`LANDS`** gets `{ world: 'math', number: 5, name: 'Hundreds', nodes: ['hundreds'] }` and `{ world: 'word-song', number: 7, name: 'Stories', nodes: ['fox-stories', 'hen-stories', 'bug-stories'] }`. Step 15 joins land 5 later.
- **Why fox, hen, bug:** each has a pack picture and a clear clay shape, and none is a stop. The frog is skip counting's stop; cat, dog and duck name word steps.

**Map fit (not measured).** Number Garden's 5 lands are the shape Word Song had before wave 1 (hypothesis: they fit). Wave 1 measured Word Song's land 1 already hanging below the pane with 6 lands (13.6 pt at 820×1180), and a 7th band shrinks every band. **Predicted:** the native bar (current stop ≤ 14 pt below the pane) fails at 820×1180 with the current step in land 1. The build measures first (`mapModel.test.ts`, `mapScreenLayout.test.ts`). **If a bar fails (T6):** the Word Song path scrolls on portrait as it does in phone landscape, opening with the current stop in its middle third. `layoutMap` stays.

**Path art: 6 clay pieces** (wave 1 § 5.4's pipeline; no digits, letters or signs):

| Id            | Subject                                                         | Must not look like                         |
| ------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `hundreds`    | A soft pink hundred-flat (10 × 10 cubes), a ten-rod in front    | the egg box, the block tower, a waffle     |
| `fox-stories` | A fox sitting: orange, cream chest, white-tipped tail           | the dog (`cvc-words-short-o`)              |
| `hen-stories` | A plump cream hen with a rose-red comb                          | the yellow chick, the small birds          |
| `bug-stories` | A ladybird-style bug, rose-pink shell, cream spots              | a strawberry                               |
| `land-ng-5`   | An apple tree full of small red apples                          | the sunflower (`land-ng-3`)                |
| `land-ws-7`   | A puppet theatre: a wooden booth, red curtains open, no puppets | the storybook, the bookshelf (`land-ws-3`) |

`PATH_ART_SET` +4 step ids; `LandArtId` + `'land-ng-5'`, `'land-ws-7'`.

## 2. G: the progress-guard prerequisite (ships first, alone)

**The problem.** `isHistoryEntry` (`progress/guards.ts`) rejects a `perProblemAnswerValue` entry above 99, and one bad entry fails `isProgressV1` for the whole doc. `EXTENDED_ANSWER_MAX = 99` (`math/extendedProblems.ts`) keeps answers under that bar today. Hundreds records answers such as 234.

**On a build without G** (predicted: the chain #572's PR body verified for unknown step names): the newer cloud copy fails the guard (`cloud-blob-rejected`), the old device keeps its stale doc, and its next session end **overwrites the cloud copy**, so the other device rolls back. A device downgraded from a hundreds build starts fresh.

**G1. The guard (one PR, Kevin, failing-first):**

- A `perProblemAnswerValue` entry is valid when `null` or `Number.isSafeInteger(n) && n >= 0`. **No upper bound**, so step 15 (up to 1,000) needs no second change.
- `mathFacts` keeps 0..99 (hundreds records no fact; the server's `parseLeitnerHint` mirrors it).
- Nothing reads `perProblemAnswerValue` for a decision (`grep`, 2026-10-17: only writers and the guard). The cloud install calls the same guard.
- **G doesn't raise `EXTENDED_ANSWER_MAX`.** The guard build writes nothing above 99; it only learns to read it.

**G2. Tests** (`forwardCompat.test.ts`): a doc with `perProblemAnswerValue: [234, null, 999, 1000]` loads, survives load + save, and installs from the cloud (`installed-from-cloud`). `-1`, `2.5`, `'7'`, `NaN`, and `mathFacts` with `a: 100`, still reject.

**G3. Rollout (T5), the 2026-10-16 rule for build 8:**

1. G ships in its own TestFlight build ("build G").
2. Build G goes on **both** the iPad and the iPhone; never downgrade below it.
3. Only then may a build with hundreds be installed anywhere. Merging that PR earlier is fine.
4. **Web:** the PWA uses the same core guard; the next `yarn release` after G deploys it. Hypothesis: a PWA cache holding an older bundle acts like an old build, so don't open the web app in between.

**Why not a second field:** 3-digit answers under a new key (old guards ignore unknown keys) would avoid the ordering rule, but fork one value into two for every future reader. G3 already worked for wave 1.

**G4. Later, in the hundreds PR:** `EXTENDED_ANSWER_MAX` becomes 999. `SKIP_COUNT_CHIP_MAX` and `multiplyChipCeiling` read it today, so they move to a new `TWO_DIGIT_CHIP_MAX = 99` and their chips don't change (`extendedAnswerRange.test.ts`). `pickDistractors` is untouched.

## 3. NG-D: hundreds (`hundreds`)

### 3.1 The step

After `div-share` in `MATH_TREE` and `MATH_NODES_IN_ORDER`, default `'locked'`; the same 8 canon problems every session (§ 3.7); the math preset for mastery, fast track, pace guard, peek and replay (secure = 8/8 on the first tap).

### 3.2 What she sees

P1, phone portrait (375×667), after the read has built the blocks:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ◉ ○ ○ ○ ○ ○ ○            |
| (Emma) | Two hundreds,   | |
| (147 ) | three tens and  | |
|        | four ones. What | |
|        | number is it?   | |
|  ▦▦          ▮▮▮    ▪     |  trays: hundreds (2 flats, fanned),
|  ▦▦          ▮▮▮    ▪▪    |  tens (3 rods), ones (4 cubes)
|  ▦▦          ▮▮▮    ▪     |
|   (?)        (?)    (?)    |  "?" tags under the trays
| [234]     [434]    [634]   |  chips: today's bottom row
+----------------------------+
```

P6–P8 add a **number tag** with the start number ("243"), above the trays in P and TP and left of them in L and TL; their tray tags show the start digits from the first frame. A **"+10" / "+100" pill** sits beside the number tag from the first frame (D11): right of it in P and TP, under it in L and TL.

**Parts** (new `mobile/src/screens/math/PlaceValueStage.tsx`, `testID="math-place-value"`, label = the read, `pointerEvents: 'none'`):

- **Trays,** hundreds / tens / ones left to right: `colors.myCream`, radius 12 (tablet 16), padding 0.5u. No H T O letters; position and block shape say which is which.
- **Glyphs** in `glyphs.tsx`: `CubeGlyph` u × u, `RodGlyph` u × 10u (10 cells), `FlatGlyph` 10u × 10u (10 × 10 cells); fill `colors.myPink`, 1.5 pt `colors.myRose` outline, 1 pt grid.
- **Placement:** flats fan up and right from the bottom-left, 1.2u apart, later ones on top, so every edge is countable. Rods side by side, 0.3u apart. Cubes in columns of 5, bottom up, left column first.
- **Tags:** sharing's pill (wave 2 § 2.2), "?" form then digit form, 8 pt (tablet 10) under each tray. The number tag is multiply's pill.
- **No "=" sign; "+" only in pills:** P6–P8's number tag carries a "+10" / "+100" pill from the read (D11), and a block that +10 or +100 adds carries its own (digits are language-free, M5). The tag's pill fits its row or column; § 3.3's sizes stand.

### 3.3 Layout and sizes

`extendedMathLayout(viewport, 'place-value')` returns sharing's frames. One unit u per plan, from the largest counts shown at any point (canon: 7 flats in P8, 6 rods in P7, 8 cubes in P8):

- **Width** = `(10 + 1.2(Hmax − 1))u + (1.3·Tmax − 0.3)u + 2.3u + 3u + 2g` (g = 12, tablet 16) = 30u + 2g for the canon; L and TL add the number tag + 8.
- **Height** = 17.2u (the fan) + u + the tag row (36; tablet 42); P and TP add the number-tag row (36; tablet 42).
- **u** = the largest whole number ≤ 10 (tablet ≤ 20) that fits the problem rect.

| Form (problem rect, wave 2 § 2.3) | u   | Width     | Height (with number tag) |
| --------------------------------- | --- | --------- | ------------------------ |
| P 375×667 (343 × 272)             | 10  | 324       | 254                      |
| L 667×375 b21 (376 × 189)         | 8   | 264 + tag | 182                      |
| TP 744×1133 (712 × 530)           | 20  | 632       | 448                      |
| TL 1133×744 (892 × 317)           | 15  | 482 + tag | 315                      |

- Hand-computed from the rules; the build's layout test asserts them.
- **Chips:** the widest canon chip, "234", is 1.68 em (`FREDOKA_BOLD_ADVANCE`): 54 pt in the 72 pt chip (32 pt font, 56 pt of room), 67 pt in 88 / 40, 87 pt in 120 / 52. Rule anyway: step the font down 2 pt while a numeral is wider than chip − 16.
- **Ribbon:** reads are 46–60 characters, skip-length: P keeps `maxLines={4}`, L skip's 2-line slot.

### 3.4 Beats, problem by problem

- **Lead** (scored P1, forward sessions until mastered): "Hundreds, tens and ones!"; the trays pulse left to right on its word ticks; 400 ms; the read.
- **Read, P1–P5, builds the number:** on the word tick of "hundreds" the flats drop in, on "tens" the rods, on "ones" the cubes. P5 reads in Danish order ("Three hundreds, six ones and two tens."), so the cubes land before the rods, each in its own tray. Chips open on `onPlay`.
- **Read, P6–P8:** the start blocks, filled tags, number tag and its pill are up from the first frame; the number tag pulses on the first word tick, the pill on the question's "ten" / "hundred".
- **Wrong 1, 2:** "Hmm... try again?", poof, shake, `puzzled-tilt`; the picture doesn't change.
- **Hints** (600 ms after the 2nd wrong's reprompt):
  - P1–P5: "Look at the hundreds." / "Look at the tens." / "Look at the ones.": that tray ripples and its tag fills. After hint 3 the tags read the answer.
  - +10 (P6, P8): "Look at the tens." (rods ripple); "One more ten." (a rod drops in with "+10", the tens tag ticks up); "What is ten more?" (the number tag and its pill pulse).
  - +100 (P7): "Look at the hundreds."; "One more hundred." (a flat drops in with "+100"); "What is one hundred more?".
- **giveAnswer** (3rd wrong): every "?" tag fills at once with sharing's 4 pt `colors.myRose` ring; an added block lands at once; the guided tap plays the correct moment.
- **Correct** ("Yes! Two hundred and thirty-four!"): open tags fill left to right and the trays pulse once; on P6–P8 the added block drops in fast if it hasn't, its tag ticks, and the number tag shows the answer as its pill fades, so "253 +10" never shows. Burst, sparkle, plink, `celebration`; 250 ms exit.

### 3.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Build drop:** a tray's blocks enter 90 ms apart; each drops 16 pt (tablet 24), `translateY` spring 260 / 20, opacity over 120 ms; its tag pulses 1 → 1.1 → 1 (300 ms `EASE_IN_OUT`) as the last lands. Longest: 7 cubes, about 0.9 s. [The tray fades in over 150 ms.]
- **Added block:** starts 40 pt above its tray, its pill (20 pt, tablet 24) 4 pt above it; spring 220 / 18 to its place; the pill fades (200 ms) 600 ms after landing. On a fast right tap: spring 300 / 22, no pill. [200 ms crossfade; the pill shows 600 ms, still.]
- **Number-tag pill:** 20 pt (tablet 24), 6 pt from the tag; pulses with it; fades over 200 ms as it ticks to the answer. [Fade only.]
- **Tag tick, number change:** the old value rises 8 pt and fades (120 ms); the new springs up from 8 pt below, scale 0.6 → 1 (260 / 20). [150 ms crossfade.]
- **Tag fill:** sharing's, 80 ms stagger. **Ripple, pulse:** multiply's, 1 → 1.06 → 1 over 300 ms, 60 ms stagger. [Crossfade; no scale.]
- One shared value per block via `withDelay`, at most 15 (P4). Rotation mid-build lands launched blocks at once. No new sounds.

### 3.6 Data model, parser, chips, session end

**New kinds** in `extendedProblems.ts` (opt-in `{ extendedKinds: true }`): `ExtendedMathProblemKind` gains `'place-value'` and `'more'`. Exact names, for Kevin's core PR and Devon's stage PR:

```ts
export type PlacePart = 'hundreds' | 'tens' | 'ones'
export interface PlaceValueProblem {
  kind: 'place-value'
  index: number // 1..8
  hundreds: number // 2..9
  tens: number // 2..9
  ones: number // 2..9
  spokenOrder: readonly PlacePart[] // e.g. ['hundreds', 'ones', 'tens']
  correct: number
  utterances: MathProblemUtterances
}
export interface MoreProblem {
  kind: 'more'
  index: number
  start: number // no zero digit
  step: 10 | 100
  correct: number // start + step, ≤ 999
  utterances: MathProblemUtterances
}
```

**Read templates** (disjoint from all existing ones):

- **place-value:** `<two…nine> (hundreds|tens|ones), <part> and <part>. What number is it?`, each place once, any order.
- **more:** `<number>. What is (ten|one hundred) more?`. `wordToNumber` grows to "<one…nine> hundred" + optional "and <1…99>" (British). Valid: no zero digit in `start`, no regrouping (tens ≤ 8 for +10, hundreds ≤ 8 for +100), answer ≤ 999.
- Before merge, all 8 `math.p*.read` parse (sibling checklist, read-line row).

**Chips:** new `hundredsDistractors(problem): [number, number]` in `extendedDistractors.ts`, shuffled by `buildExtendedChipOrder`; all three differ, in 100..999.

- **place-value, P1–P3** (`'gentle'`): hundreds digit +2 and +4 (−2 and −4 above 5).
- **place-value, P4+, place order** (`'digit-swap'`): tens and ones swapped (537 → 573, M6), and tens + 1 (tens 9: − 1).
- **place-value, other order** (`'spoken-order'`): the digits in spoken order (362 for P5's 326), and tens + 1.
- **more** (`'wrong-place'`): the other two of +1, +10, +100.

**Session end:** `perProblemCorrect`, `latencyMs`, `perProblemAnswerValue` (3-digit, hence G) and `perProblemDistractorClass` as today; no `mathFacts`, no Leitner outcome; `CANON_MATH_FACTS['hundreds']` = 8 nulls. No warm-up heart (no fact); mastered blocks join reviews.

### 3.7 Canon (binding: the splice writes exactly this)

| P   | Read (characters)                                                   | Answer | Chips (correct first) |
| --- | ------------------------------------------------------------------- | ------ | --------------------- |
| 1   | "Two hundreds, three tens and four ones. What number is it?" (58)   | 234    | 234, 434, 634         |
| 2   | "Three hundreds, five tens and two ones. What number is it?" (58)   | 352    | 352, 552, 752         |
| 3   | "Four hundreds, two tens and six ones. What number is it?" (56)     | 426    | 426, 626, 826         |
| 4   | "Five hundreds, three tens and seven ones. What number is it?" (60) | 537    | 537, 573, 547         |
| 5   | "Three hundreds, six ones and two tens. What number is it?" (57)    | 326    | 326, 362, 336         |
| 6   | "Two hundred and forty-three. What is ten more?" (46)               | 253    | 253, 244, 343         |
| 7   | "Four hundred and sixty-five. What is one hundred more?" (54)       | 565    | 565, 475, 466         |
| 8   | "Seven hundred and twenty-eight. What is ten more?" (49)            | 738    | 738, 729, 828         |

- **Per problem:** correct "Yes! <answer in words>!" (33–36 characters); giveAnswer "This one is <answer in words>." (40–43); reprompt "Hmm... try again?" (reused); hints "Look at the hundreds." (21), "Look at the tens." (17), "Look at the ones." (17), "One more ten." (13), "One more hundred." (17), "What is ten more?" (17), "What is one hundred more?" (25). Recap "You worked on hundreds today!" (29).
- **Lint:** place-value digits 2–9, all different, P1–P4 in place order; more-problems with no zero, no regrouping; 8 different answers; chips per § 3.6.
- **Why this order:** P1–P3 are answered from the flats alone; P4 is the first swap trap; P5 says ones before tens, as Danish does ("tre hundrede og seksogtyve", my own Danish, not a cited source), so the spoken-order chip is the slip M6 predicts; P6–P8 move one place at a time.

## 4. WS-E: little stories (`fox-stories`, `hen-stories`, `bug-stories`)

### 4.1 The steps

Three SkillNodes after `cake-words` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`, default `'locked'`; each serves its 8 stories from canon in order, every session (P1–P3 gentle chips, P4–P8 trap chips); the Word Song preset (secure = 8/8 on the first tap), no graduation gate, no cross-vowel mix. New content type `'little-story'`.

### 4.2 What she sees

Fox stories P1, 375×667: the reading beat (left) and the reveal (right).

```
+----------------------------+   +----------------------------+
| [<]           ✦3 (★ 12)    |   | [<]           ✦3 (★ 12)    |
| ◉ ○ ○ ○ ○ ○ ○ ○            |   | ◉ ○ ○ ○ ○ ○ ○ ○            |
| (Emma) | Read the story. | |   | (Emma) | Yes! The fox!   | |
| +------------------------+ |   | +------------------------+ |
| | The fox sat on the rug.| |   | | The fox sat on the rug.| |  words light as
| | It has a cup.          | |   | | It has a cup.          | |  Emma reads
| +------------------------+ |   | +------------------------+ |
|                            |   |      +--------------+      |
|   (no picture while she    |   |      |    scene     |      |  only after
|    reads, no chips yet)    |   |      |   200 pt     |      |  the answer
+----------------------------+   +----------------------------+
```

With the question ("Who sat on the rug?") three picture chips (fox, rug, cup, shuffled) enter in the chip row (L: the chip column).

**Parts** (new `mobile/src/screens/wordSong/StoryCard.tsx`, `testID="word-story"`, label = the story):

- **Card:** the sentence panel's look (white, 3 pt `#FFC0CB` border, radius 16, its shadow), Fredoka 600 `#3B3B3B`. Each sentence starts a new line. Each word is a `Pressable` (role button, label "Word fox"), 0.35 em apart.
- **Spotlight:** the letter row's (`word-song-native.md` § 3) behind one word: `#FFB7C5`, word width + 4, F + 8 tall, radius 0.3 F; the word stays dark.
- **Scene:** square `Image` of `mobile/assets/scenes/story-<id>.webp` (600 px), radius 16. If missing, the answer's pack picture shows instead, so the steps can ship before the scenes.
- **Ribbon:** the prompt, question and short lines as today. While Emma reads the story, the card's read-along is the caption and the ribbon keeps its last line.

### 4.3 Layout and sizes

`wordSongLayout` gets the card metrics; the card sits at the **top** of the stage.

| Form (stage)              | Font / line | Padding h / v | Text width | Card, 3 lines | Reveal scene          |
| ------------------------- | ----------- | ------------- | ---------- | ------------- | --------------------- |
| P 375×667 (343 × 257)     | 24 / 46     | 16 / 12       | 305        | 168           | 196 (2-line card 200) |
| L 667×375 b21 (376 × 189) | 22 / 44     | 16 / 10       | 333        | 158           | 99–104, chip column   |
| iPad mini L (stage 325)   | 32 / 56     | 24 / 16       | ≤ 586      | 206           | 243                   |
| Tablet portrait 744×1133  | 32 / 56     | 24 / 16       | ≤ 586      | 206           | 280                   |

- **Measured** (scratch script, 2026-10-17, Fredoka 600 advances from `Fredoka_600SemiBold.ttf`, no kerning, 0.35 em gaps): every story takes 2–3 lines in P, L and on a tablet (measured at 512 pt). The widest sentence, "The fox and the crab sat in the sun.", is 383 pt at 24 pt. Three lines in P: fox 8, hen 7, hen 8, bug 6.
- **Lines ≥ 44 pt**, so every word's tap area is ≥ 44 pt tall. Word boxes take half the gap each side and touch; short words ("a") are narrower than 44 pt, accepted because a miss only plays the next word (the letter-cell rule).
- **Reveal rect** (P, tablet): from the card's bottom + 12 to the chips' bottom, stage-wide; scene = min(height, width, 200 phones / 280 tablet), ≥ 120 (the table's scenes are hand-computed; the layout test asserts them). In L the chip column is the reveal rect: small, on the form Marian doesn't use.
- Questions are ≤ 23 characters (ribbon slot: 3 lines P, 2 L); the 46-character simple-sentence reads already play in the same slot (not measured).

### 4.4 Beats, problem by problem

1. **Card enters** (after any opener or lead). Emma `listening`.
2. **"Read the story."** (`guide.story.read`) on every story card, except right after the step's own lead (same opening words). After a peek, review or replay opener: opener, 400 ms, this line.
3. **Reading beat**, from that line's end: `clamp(12000, 1500 × words, 21000)` ms of foreground time (15 s for 10 words, 21 s for 14: 40 words a minute). A word tap holds the question to ≥ 2000 ms after the tap, never past 30 s from the beat's start. Nothing on screen counts down (`STORY_READ_MS_PER_WORD = 1500`; why: D3).
4. **Question:** Emma says the `read` line; the chips enter as it starts, closed (0.6), and open when it ends (Word Song's gate). The card stays: she may re-read and tap words.
5. **Wrong 1:** poof, shake, `puzzled-tilt`, "Hmm... try again?", 400 ms, the question again.
6. **Wrong 2:** "Hmm... try again?", 600 ms, **Emma reads the story** (the `hint` clip) with the read-along, `attentive-pointing`, 400 ms, the question again.
7. **Wrong 3:** "This one is the fox." with the guided glow; the guided tap plays the correct moment. Never a red X.
8. **Correct:** burst, sparkle, plink, `celebration`, "Yes! The fox!".
9. **Reveal** (after a correct or guided tap): 300 ms after the line, the chips fade and the scene enters; 400 ms after it lands, Emma reads the story with the read-along; 800 ms; the 250 ms exit.

**Word taps:** a tap plays that word alone (`guide.story.word.<word>`) and lights it; live from the card's first frame until the reveal; inert while Emma speaks; a new tap cuts the last. Not a move: nothing recorded, no Emma reaction, never a picture.

**Decode first:** no picture while she reads. The chips mount only with the question, because picture chips would let her guess the nouns, and the scene comes only after the answer.

### 4.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Card:** opacity 0 → 1, `translateY` 12 → 0, spring 260 / 20. [150 ms fade.]
- **Tapped word:** spotlight in over 120 ms, word scale 1 → 1.08 → 1 (300 ms `EASE_OUT`), lit for max(400 ms, the clip), out over 200 ms. [Spotlight only.]
- **Read-along:** the spotlight walks the words, each in over 120 ms at its mark − 40 ms (early, not late, as the blend), the previous out over 120 ms; all dark 200 ms after the clip. [Unchanged: colour, not motion.]
- **Marks:** `export-assets.mjs` writes `storyMarks.generated.ts`, keyed by hint text with the clip's byte length. `silencedetect` (−35 dB, silences ≥ 250 ms) must give one segment per sentence, else no entry. Word k starts at `on + (off − on) × chars before k ÷ sentence chars`. No entry or a byte mismatch: the whole clip split by characters.
  - **Prediction (hypothesis):** words land within about ±150 ms of the voice. If the device check sees them out of step, `STORY_READ_ALONG = 'sentence'` lights each sentence for its segment.
- **Chips:** today's entrance; a 200 ms `FadeOut` at the reveal. **Scene:** scale 0.92 → 1, spring 260 / 20, opacity over 250 ms. [200 ms fades.] No new sounds.

### 4.6 Data model, parser, chips, session end

**One table drives the splice, the parser and the scenes:** `packages/core/src/wordSong/littleStories.ts`, exact names:

```ts
export type StoryNode = 'fox-stories' | 'hen-stories' | 'bug-stories'
export const STORY_NODES: readonly StoryNode[]
export interface LittleStory {
  id: string // 'fox-1' … 'bug-8'; scene file story-<id>.webp
  node: StoryNode
  story: string // = the canon `hint`
  question: string // = the canon `read`
  answer: string // pack word with a picture
  wrong: readonly [string, string] // pack words with pictures, both in the story
}
export const LITTLE_STORIES: readonly LittleStory[] // § 4.7's 24 rows
export function littleStoryForText(story: string): LittleStory | undefined
```

**Wire:** `read` = the question; `hint` = the story (Emma's hint and reveal read, and the card's text); `correct` = "Yes! The fox!" / "Yes! In the cup!"; `giveAnswer` = "This one is the fox."; `reprompt` = "Hmm... try again?".

**Parser** (`wordSongSessionPlanFromServer`, the cloze precedent of resolving the target outside the read):

- A read matching `^(Who|What|Where)\b[^?]*\?$` is `'little-story'` (no existing read starts so).
- Target from the correct line: `^Yes! (?:The|(?:In|On|To) the) ([a-z]+)!$`.
- `littleStoryForText(hint)` must find a row whose `answer` is the target, else `PlanFromServerError` (the session falls back).
- The problem carries `story`, `storyId`, `question`, with `target` = the answer's pack entry. `buildWordChipOrder` (`wordSong/wordChips.ts`) gains a `'little-story'` branch whose two distractors are the row's `wrong` entries, not `pickDistractors`; its shuffle is unchanged. No `TARGET_PAIRINGS` or `FORBIDDEN_PAIRS` rows are added.

**Session end:** `targetWords` = answers, `perProblemAnswerWord` = tapped words, as today. **Warm-up:** `pickWarmupBlocks` (Word Song) takes the newest mastered review step **not in `STORY_NODES`**. Mastered story blocks join reviews and play in full, reveal included.

### 4.7 The 24 stories (binding: the splice writes exactly this)

Each problem also has "Hmm... try again?" (reused) and "This one is the <answer>." (17 + the answer's length). Correct lines: "Yes! The <answer>!" (10 + length); bug "Yes! <In/On/To> the <answer>!" (13 + length). Recap: "You worked on reading stories today!" (36). Each row: story (characters) → question (characters) → **answer** / wrong chips.

**Fox stories ("Who…?")**

1. "The fox sat on the rug. It has a cup." (37) → "Who sat on the rug?" (19) → **fox** / rug, cup
2. "The fox has a hat. The hat is in the box." (41) → "Who has a hat?" (14) → **fox** / hat, box
3. "The fox is in the tent. The tent is on a rock." (46) → "Who is in the tent?" (19) → **fox** / tent, rock
4. "The fox sat on the bed. The hen ran to the van." (47) → "Who ran to the van?" (19) → **hen** / fox, van
5. "The dog has a bone. The fox has a fig." (38) → "Who has a fig?" (14) → **fox** / dog, bone
6. "The frog sat on a log. The fox hid in the shed." (47) → "Who hid in the shed?" (20) → **fox** / frog, log
7. "The pig got a kite. The fox ran to the pig." (43) → "Who got a kite?" (15) → **pig** / fox, kite
8. "The fox and the crab sat in the sun. The crab got a plum." (57) → "Who got a plum?" (15) → **crab** / fox, sun

**Hen stories ("What…?")**

1. "The hen has a cake. She is in the van." (38) → "What does the hen have?" (23) → **cake** / hen, van
2. "The hen has a tent. A pen is in the tent." (41) → "What is in the tent?" (20) → **pen** / hen, tent
3. "The hen has a bag. A plum is in the bag." (40) → "What is in the bag?" (19) → **plum** / hen, bag
4. "A pot is on the desk. The hen has a cup." (40) → "What is on the desk?" (20) → **pot** / cup, desk
5. "The hen has a drum. The pig has a kite." (39) → "What does the hen have?" (23) → **drum** / kite, pig
6. "The hen has a hat. A wig is in the pond!" (40) → "What is in the pond?" (20) → **wig** / hat, pond
7. "The hen has a box and a lamp. A ring is in the box." (51) → "What is in the box?" (19) → **ring** / lamp, box
8. "The hen got a jug. Jam is in it. She has a cup." (47) → "What is in the jug?" (19) → **jam** / cup, jug

**Bug stories ("Where…?")**, with the correct line's preposition:

1. "The bug is in the cup. It has a fig." (36) → "Where is the bug?" (17) → **cup** (in) / bug, fig
2. "The bug is on the bed. It has a nut." (36) → "Where is the bug?" (17) → **bed** (on) / bug, nut
3. "The bug got a gem. It ran to the tent." (38) → "Where did the bug go?" (21) → **tent** (to) / bug, gem
4. "The bug is on the rug. The cat is on the bed." (45) → "Where is the bug?" (17) → **rug** (on) / bed, cat
5. "The bug is in the bag. The bag is in the van." (45) → "Where is the bag?" (17) → **van** (in) / bag, bug
6. "The dog ran to the pond. The bug hid. It is in the tub." (55) → "Where did the dog go?" (21) → **pond** (to) / tub, dog
7. "The bug is in the nest. The hen is on a log." (44) → "Where is the hen?" (17) → **log** (on) / nest, bug
8. "The bug is on a lid. The lid is on the pot." (43) → "Where is the lid?" (17) → **pot** (on) / lid, bug

**Rules** (a splice lint checks them; my scratch check found no breach, 2026-10-17):

- **Taught words only (D2):** a target word of a Word Song canon file, a word read in the sight-words or simple-sentences canon (a, the, is, it, in, on, to, she, has, sat, ran), or one of 3 decodable extras from mastered patterns: _and_ (nd, tent words), _got_, _hid_. No plurals, no -s or -ed. _shed_ is the one noun without a picture, never a chip. The rule covers the stories; questions are Emma's lines, under § 5.2's cap.
- **Shape:** 2–3 sentences (bug 6, hen 8 have three), 10–14 words. _She_ is always the hen; _It_ is the animal of the sentence before, except hen 8's "in it" (the jug).
- **Chips:** each has a pack picture and is in the story; no trio holds a `FORBIDDEN_PAIRS` pair (cat–dog, duck–hen, bus–van…). **P1–P3:** both wrong chips are another kind than the question asks. **P4–P8:** one wrong chip is the same kind, so she must read who did what (fox 4, 7 and 8 are answered by a friend, not the fox). Longer stories sit at P6–P8.

## 5. Copy / TTS script

### 5.1 Every new spoken line

Characters in brackets, in the order hundreds / fox / hen / bug; canon lines are in § 3.7 and § 4.7.

**Guidance** (`createManifestLinePlayer('session-guide', …)`, wave 1 § 6.1):

- `guide.session.intro.<node>`, the leads (scored P1 of forward sessions until mastery; never in a peek, review, replay or heart): "Hundreds, tens and ones!" (24), "Read the story. Who is it?" (26), "Read the story. What is it?" (27), "Read the story. Where is it?" (28).
- `guide.session.peek-open.<node>` "Let's look at <name>!" (23 / 26 / 26 / 26); `peek-close` "<Name> are for later. You will learn it!" (42 / 45 / 45 / 45).
- `guide.story.read` (kind `'story-read'`): "Read the story." (15).
- `guide.story.word.<word>` (kind `'story-word'`), text "<Word>." ("Fox."): **54 clips, 224 characters**, one per distinct word of § 4.7's stories (`LITTLE_STORIES` generates the list).
- **Only if #592 has merged:** "Let's play <name> again!" (26 / 29 / 29 / 29), "You know <name>!" (18 / 21 / 21 / 21).

**Path** (`PATH_LINES`, generated from the names; baked count +26):

- `path.open` "Here is your path! You are on <name>." (39 / 42 / 42 / 42); `path.stop` "<Name>." (9 / 12 / 12 / 12).
- `path.locked.next` "<Name>! First, <previous>. Then this!" (36 / 42 / 43 / 43); `end.bud` "Look! A new flower for <name>!" (32 / 35 / 35 / 35); `end.unlock` "You learned <previous>! Now you can do <name>!" (45 / 51 / 52 / 52). Previous: sharing, cake words, fox stories, hen stories.
- Lands: "Land 5: Hundreds." (17), "A new land! Land 5: Hundreds!" (29), "A new land: Hundreds!" (21), "Land 7: Stories." (16), "A new land! Land 7: Stories!" (28), "A new land: Stories!" (20). Deferred kinds generate unrendered, as today.

**Total: 218 distinct new texts, 4,981 Lily characters** (210 / 4,787 without #592's 8): guidance 13 / 398, replay 8 / 194, path 26 / 842, word clips 54 / 224, canon hundreds 32 / 1,190, fox 25 / 661, hen 31 / 748, bug 29 / 724.

- Counted by a scratch script (2026-10-17, not committed; recounted after Dave's changes by a second that reproduces 218 / 4,980) against every `text` in `public/canon/*/level-1/*.json` and every literal in `guidanceLines.ts`: only "Hmm... try again?" is reused; repeats inside the wave count once. The bill holds only if the bake de-duplicates on exact text (`revoiceCanonLily.ts` does; `--dry-run` prints the real number first).
- **Canon is spliced, not Haiku-baked:** `scripts/spliceContentWave3Canon.ts` writes the four files from § 3.7 and `LITTLE_STORIES`; the four nodes join `PENDING_CANON_NODES`. **Render:** `renderGuidanceLinesLily.ts`, `renderPathLinesLily.ts`, `revoiceCanonLily.ts --unrendered`.

**Prediction for the ear test (bar 2):** every story clip pauses ≥ 250 ms at each full stop (the marks need it); "Where did the bug go?" rises; "two hundred and forty-three" is British with a clear "and"; "Two hundreds, three tens…" keeps its plurals; the isolated "A." and "The." come out "ay" and "thee". **Not predicted:** where Lily puts the stress in "What does the hen have?".

### 5.2 Vocabulary check (the ~200-word cap)

- **7 new core words:** _hundred(s)_, _story/stories_, _who_, the story verbs _got_, _hid_, and _does_, _have_ (hen 1 and 5; in no guidance, path or level-1 canon line, `grep` 2026-10-17). _ones_, _tens_, _more_, _number_, _did_, _what_, _where_ are in use. About 169 → 176.
- _fox_, _hen_, _bug_ name the steps; every other story word is a target or sight word, or one of the 3 decodable extras.
- Zero-cost choices: "Hundreds, tens and ones!" not "place value"; "What is ten more?" not "add ten". Not zero-cost: "What does the hen have?" (_does_, _have_) keeps _got_ to one meaning. All ASCII-7, no IPA.

## 6. Pictures: 24 scenes (OpenAI, a generator scene mode)

One scene per story; the blocks are drawn in code (K2), and every chip has a pack picture (89 WebPs).

- **`generatePackPictures.ts --scenes`** reads a new `design/word-song/scene-manifest.json` (the pack manifest is untouched). Prompt: `Subject` + `STYLE_INSTRUCTION` + a new `SCENE_RULES` ("Show exactly the characters and objects named, each drawn like its reference picture, in one simple scene on a soft cream background that fills the square. Nothing else: no other animals, people or objects, no text or letters, no faces on objects.") + `avoid`.
- **Inputs:** the 3 style anchors + the approved pack PNG of each `refs` word (≤ 4), so the scene's fox is the chip's fox. **Output:** opaque 1024 px → `mobile/assets/scenes/story-<id>.webp`, 600 px; a contact sheet per batch for Thomas.
- **Cost:** ~$0.078 a picture (the brief's rate) + ~$0.008 per reference (1,024 tokens at $8 / 1M, `packPictureLib.ts`): ~$0.11 a scene, **~$2.60 for 24**; a second round on fox-3, fox-8, hen-6, hen-7, bug-7, bug-8 adds ~$0.66. `--dry-run` prints the real estimate. If a scene fails twice, stop and tell Matt.
- **Don't create the file before T4:** the generator reads the whole file.

**Entries** `{ "scene", "tier", "batch", "subject", "avoid", "refs" }`: tier from the id, batch 1 fox, 2 hen, 3 bug; refs in brackets.

- **fox-1** [fox, rug, cup]: The fox sitting on a striped rug, a pink mug on the rug beside it. _Avoid:_ a table.
- **fox-2** [fox, hat, box]: The fox beside an open cardboard box with a hat inside, its top showing. _Avoid:_ the fox wearing the hat.
- **fox-3** [fox, tent, rock]: A small orange tent on top of a big grey rock, the fox looking out of its door. _Avoid:_ the tent on grass.
- **fox-4** [fox, hen, van]: Left, the fox sitting on a bed; right, the hen running to a peach van. _Avoid:_ the fox running.
- **fox-5** [fox, dog, bone]: The dog with a bone in its mouth, the fox beside it holding a fig. _Avoid:_ the fox with the bone.
- **fox-6** [fox, frog, log]: A frog on a log in front; behind, a small garden shed with the fox peeking out. _Avoid:_ the fox on the log.
- **fox-7** [pig, fox, kite]: The pig holding a flying kite's string; the fox running to the pig. _Avoid:_ the fox holding the kite.
- **fox-8** [crab, fox, sun, plum]: The fox and the crab side by side under a warm sun; the crab holds a plum. _Avoid:_ the fox with the plum.
- **hen-1** [hen, cake, van]: The hen inside a peach van, seen through its open side door, a pink-iced cake beside her. _Avoid:_ candles, numbers.
- **hen-2** [hen, pen, tent]: The hen beside a small orange tent; a pink pen lies inside its open door. _Avoid:_ the hen holding the pen.
- **hen-3** [hen, plum, bag]: The hen holding a pink tote bag, a plum peeking out of the top. _Avoid:_ more than one plum.
- **hen-4** [hen, pot, cup, desk]: A grey cooking pot on a small wooden desk; the hen beside it holding a pink mug. _Avoid:_ the mug on the desk.
- **hen-5** [hen, drum, kite, pig]: The hen beating a small drum, the pig beside her holding a kite. _Avoid:_ the hen holding the kite.
- **hen-6** [hen, wig, hat, pond]: The hen in a hat at the edge of a small pond; a curly brown wig floats on the water. _Avoid:_ a person.
- **hen-7** [hen, ring, lamp, box]: The hen beside a table lamp and an open cardboard box with a gold ring inside. _Avoid:_ the ring on the lamp.
- **hen-8** [hen, jam, cup, jug]: The hen holding an open jug full of red jam, a pink mug beside her. _Avoid:_ jam in the mug.
- **bug-1** [bug, cup, fig]: The pink bug inside a pink mug, peeking over the rim, holding a fig. _Avoid:_ a drink.
- **bug-2** [bug, bed, nut]: The pink bug on a bed's pillow, a walnut beside it. _Avoid:_ a person in the bed.
- **bug-3** [bug, tent, gem]: The pink bug walking in at a small orange tent's door, carrying a gem. _Avoid:_ the bug far from the tent.
- **bug-4** [bug, rug, bed, cat]: The pink bug on a striped rug in front; behind, the cat lying on a bed. _Avoid:_ the bug on the bed.
- **bug-5** [bug, van, bag]: A peach van, side door open; inside, a pink tote bag with the bug peeking out. _Avoid:_ the bag outside the van.
- **bug-6** [dog, pond, tub, bug]: The dog running to a small pond; nearby the pink bug hides in a cream bathtub. _Avoid:_ the dog in the tub.
- **bug-7** [bug, nest, hen, log]: The pink bug in a bird's nest; the hen sitting on a log beside it. _Avoid:_ eggs; the hen in the nest.
- **bug-8** [bug, lid, pot]: A grey cooking pot with its lid on, the pink bug sitting on the lid. _Avoid:_ steam or fire.

The 6 clay pieces (§ 1) are made as the clay set was, with Thomas's tool.

## 7. States and edge cases

- **Error path:** poof, shake, `puzzled-tilt`, "Hmm... try again?"; hints at 2 wrongs, the given answer at 3. Never a red X.
- **First visit:** the land beat, then the lead before P1 of each forward session until mastery.
- **Peek:** P1–P3 with opener and closer, no lead, nothing written; hundreds builds, a story runs in full with the reveal. **Replay (#592), review:** the canon blocks in full; story blocks never as hearts.
- **Background:** the beat counts foreground time; lines park and resume (#528); the read-along freezes with the voice. **Rotation:** layouts recompute, nothing replays, a lit word stays lit, a build in flight lands.
- **Missing assets:** a missing scene shows the answer's picture; a missing word clip lights the word silently.
- **Ship order:** G on both devices first (§ 2); `yarn release` before the device check (the server learns the nodes then).

## 8. Wiring checklist (Kevin, Devon)

- **`sibling-tier-checklist.md`:** all four nodes rows 1–10 and 12; story nodes also row 11 and 13–15; `hundreds` instead `VALID_MATH_FOCUS_NODES` and `MATH_FOCUS_NODES`; row 16 skipped. From "does not cover": the math read template (8/8), `CANON_FILES` in `voice-qa.html` (4 stems), the committed canon, e2e seeds ending at `cake-words` or `div-share`.
- **G first** (§ 2), its own PR and build.
- **Names:** `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS`, `FRIENDLY_NODE_NAMES`, the recap list in `api/_planner.ts`, `scripts/recapFocusCopy.ts`.
- **Map, lines:** `LANDS` (+2), `PATH_LINES` (+26 baked), `PATH_ART_SET` (+4), `LandArtId` (+2), `GUIDANCE_LINES` (peeks, leads, prompt, word clips; replays with #592).
- **Math:** G4's constants; the two kinds, templates, `wordToNumber`; `hundredsDistractors`; `extendedMathLayout(…, 'place-value')`; `PlaceValueStage` and 3 glyphs; `CANON_MATH_FACTS`.
- **Word Song:** `littleStories.ts`, the `'little-story'` route, `StoryCard`, card metrics, `storyMarks.generated.ts`, the scene registry, the warm-up exclusion.
- **Canon, pictures:** `spliceContentWave3Canon.ts`, `PENDING_CANON_NODES` +4, `--scenes`.
- **Unchanged on purpose:** `isLeitnerDirectiveActive`, `MULTIPLICATION_FOCUS_NODES`, `MIX_SOURCE_STEPS`, `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`, the celebration exceptions, `TARGET_PAIRINGS`, `FORBIDDEN_PAIRS`, `pickDistractors`, the `mathFacts` bounds.

## 9. Acceptance criteria

**Core (vitest):**

1. G2's cases pass on the local load and the cloud install.
2. P1 parses to `{ kind: 'place-value', hundreds: 2, tens: 3, ones: 4, correct: 234 }`, P5 to `spokenOrder: ['hundreds', 'ones', 'tens'], correct: 326`, P6 to `{ kind: 'more', start: 243, step: 10, correct: 253 }`. Rejected: "One hundreds, …", "Two hundred and four. What is ten more?", "Two hundred and ninety-three. What is ten more?". Without `extendedKinds` it throws.
3. `hundreds.json` equals § 3.7 (8/8 parse); `hundredsDistractors` gives § 3.7's chips; skip and times chips are unchanged.
4. A hundreds session-end write has no `mathFacts`, keeps the 3-digit taps, and loads back.
5. `LITTLE_STORIES` equals § 4.7 and passes its lint; the story files parse 24/24 with § 4.7's chips; an unknown story text throws.
6. `pickWarmupBlocks` never returns a story block.
7. 5 Number Garden lands, 7 Word Song lands; `GUIDANCE_LINES` and `PATH_LINES` hold § 5.1's texts; baked path lines +26; spoken names unique.
8. `cake-words` mastered, no story keys → `fox-stories: 'intro'`, the others `'locked'`; `div-share` mastered, no `hundreds` key → `'intro'`.

**Native (jest):**

9. Hundreds P1: flats, rods, cubes appear on the ticks of "hundreds", "tens", "ones"; tags "?" until a right tap, then 2, 3, 4; chips 234, 434, 634. P5: cubes land before rods. P6: the "+10" pill shows beside the number tag from the first frame; hint 2: a rod with "+10" drops in and the tens tag goes 4 → 5; a right tap shows 253 and the number tag's pill fades.
10. § 3.3's u on the four forms; every numeral fits its chip.
11. Story P1 (fake timers): the question starts 15,000 ms after "Read the story." ends; a word tap at 14,000 ms moves it to 16,000. No chip or picture before the question; chips open at its end. A right tap: chips fade, the scene enters, the read-along plays, the advance.
12. Story wrongs: the 1st repeats the question; the 2nd plays the read-along then the question; the 3rd the guided answer.
13. A word tap plays `guide.story.word.<word>` and lights it; inert during Emma's lines; records nothing.
14. A missing scene shows the answer's picture. Reduce Motion gives § 3.5's and § 4.5's bracketed forms.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP`):

15. Each new step: Emma speaks every line; at 375×667 and 667×375 nothing leaves its rect; story cards ≤ 3 lines; no picture during the reading beat and no scene before the answer; on the iPad the read-along follows Lily word by word (else ship `'sentence'`).
16. Map at 375×667, 744×1133, 820×1180 portrait: 5 and 7 lands, no overlaps; with T6's fallback, the current stop is in view on open.
17. Before any hundreds build is installed, both devices run build G or later.

## 10. Thomas decides

- **T1. Names:** "hundreds", "fox stories", "hen stories", "bug stories"; "Land 5: Hundreds", "Land 7: Stories".
- **T2. Lines (§ 5.1):** 218 texts, 4,981 Lily characters, chiefly the four leads (fox's now "Read the story. Who is it?") and hen 1 and 5's "What does the hen have?"; the 54 one-word clips add 54 short ear-test items.
- **T3. 6 clay pieces (§ 1):** a hundred-flat, a fox, a hen, a bug, an apple tree, a puppet theatre.
- **T4. Picture spend:** 24 scenes, ~$2.60 (~$3.30 with retakes), after an OpenAI top-up. Recommendation: approve; the scene rewards reading, and the steps ship without it if needed.
- **T5. Rollout:** build G on the iPad and the iPhone before any hundreds build; no downgrade below it.
- **T6. Map fallback:** if 7 Word Song lands miss the portrait bars, its path scrolls on portrait as in phone landscape. Recommendation: approve now so a failed bar doesn't stall the build.

## 11. Pedagogy assumptions for Dave (D1…)

All twelve **confirmed by Dave on 2026-10-17**. D3, D11 and D12 carry his changes, plus one extra (hen 1 and 5's question); all are applied above.

- **D1.** Three steps, one question word each (who → what → where), 8 hero-led stories each. Alternative: mixed question words, growing length.
- **D2.** The taught-word rule (§ 4.7) with _and_, _got_, _hid_ as decodable extras; no plurals or endings; 10–14 words; 2 of 24 stories have three sentences.
- **D3. Changed by Dave.** Story, then question; the story stays during the question (look-back allowed). Beat **1500 ms a word** (was 900; now 15–21 s), held ≥ 2 s by a word tap, at most **30 s** (was 20). Why: at 900 every story ran at 67–70 words a minute, above the grade-1 spring median of 60 words correct a minute (Hasbrouck & Tindal 2017); the question would come while she still decodes, breaking decode-first and signalling pace.
- **D4.** Word taps are the only support until the 2nd wrong; then Emma reads the whole story, and again in the reveal. She can't ask for it earlier.
- **D5.** No picture while she reads: the chips mount with the question, the scene comes after the answer.
- **D6.** Chips: P1–P3 wrong chips another kind; P4–P8 one same-kind noun from the story; the question's own noun may be a chip (fox 1's rug, hen 7's box).
- **D7.** Story blocks never as warm-up hearts; they join reviews. Dave: mastery here means read and remembered.
- **D8.** Hundreds is built by Emma and tapped by Marian; place-value digits 2–9; zeros and "one hundred" wait for a deepening. Dave: zeros (305, 190) should be the first hundreds deepening (not this wave).
- **D9.** Chips: P1–P3 hundreds digit only; P4 the tens/ones swap (M6) and tens + 1; P5 in Danish order with the spoken-order chip 362.
- **D10.** +10 and +100 inside the step (P6–P8, no regrouping). Alternative: a step of their own.
- **D11. Changed by Dave.** No Leitner fact and no "=" for hundreds; P6–P8 show the "+10" / "+100" pill beside the number tag **from the read**, not only on a block that hint 2 or the answer adds.
- **D12. Changed by Dave (copy).** Leads every forward session until mastery (wave 1's D5); fox's lead is "Read the story. Who is it?" (was "Who did it?"), so all three share one frame: Who / What / Where is it?
- **Extra (Dave).** Hen 1 and 5 ask "What does the hen have?" (was "What has the hen got?"): _got_ means "obtained" in the 4 other stories with it. Costs _does_ and _have_ (§ 5.2); questions run to 23 characters (§ 4.3).
