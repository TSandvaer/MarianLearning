# Content wave 2: sharing, tent words, cake words (native)

**Status:** spec only. Thomas, 2026-10-16: "Spec wave 2 now, build later". Nothing is built, rendered or generated until Thomas approves this spec (§ 11).

**Scope:** `@marian/core`, the native app (`mobile/`) and canon. The web is frozen: like wave 1's new kinds, a sharing read throws there and the web falls back to its silent static plan (`content-wave-1.md` § 1.9). The format model is `design/native/content-wave-1.md` (#574): its rules apply here unless this spec says otherwise. Code is anchored by names, not line numbers.

**Source:** `design/research/content-roadmap-after-path-ends.md` (Dave, #569), § 1 rows 16–17 and § 2 step 13, in his order:

| Item | Dave's working name | What                                               | Here |
| ---- | ------------------- | -------------------------------------------------- | ---- |
| NG-C | sharing             | division as equal shares; the only new interaction | § 2  |
| WS-C | jump words          | end blends (two sounds after the vowel)            | § 3  |
| WS-D | cake words          | magic e, with Emma's intro "The e is quiet…"       | § 4  |

**Out of scope:** code, renders, picture generation and test runs. Also out: "How many plates?" (§ 2.8), little stories (unless T5 moves them up), and the four times-mix facts wave 1 left open (6×5–9×5, `content-wave-1.md` § 2.2). They are not in Thomas's wave-2 scope.

## Goal

Marian learns to share a number of flowers out equally, and Word Song gains 16 new picture words that practise end blends and magic e.

## User state entering

- **Sharing:** she has mastered "all the groups" (`mult-mix`). The Map plays "You learned all the groups! Now you can do sharing!".
- **Tent words:** she has mastered crab words. **Cake words:** she has mastered tent words.
- **She finished a world before this build:** wave 1's load rule opens the new step on launch, and the Map plays its unlock beat (`content-wave-1.md` § 5.3, K13). It is generic, so nothing new is needed.

## Decisions

- **K1. One question: "How many on each plate?"** "How many plates?" comes later, because its answer is the plates, so they can't be on screen from the start (§ 2.8).
- **K2. The read is Dave's: "Twelve flowers, three plates. How many on each plate?"** The screen shows a pile of 12 flowers with a "12" tag and 3 empty plates with "?" tags. There is no equation and no division sign in this step (§ 2.2).
- **K3. The flowers are dealt one for each plate in turn.** P1–P3 deal on their own after the read, so the model shows every session. On P4–P8 the deal waits for the hints, and a right answer plays it fast as proof (§ 2.4).
- **K4. Range: 2–5 plates, 2–6 on each, at most 20 flowers.** The plates are `GroupsRow`'s, at most 5 (§ 2.7).
- **K5. The chips are `pickDistractors` unchanged, with M = 10** (§ 2.6, D4).
- **K6. A sharing problem records no Leitner fact**, as skip counting doesn't. Its time includes the deal, so it would mark × facts slow (§ 2.6, D5).
- **K7. Spoken names: "sharing", "tent words", "cake words".** Not "jump words": _jump_ is an action, so it can't be a picture word ("Yes! That's a jump." breaks, as _swim_ did in wave 1), and word steps are named after their stop picture (§ 1).
- **K8. Sharing is the 5th stop of land 4, Groups. Tent and cake words are the 3rd and 4th stops of land 6, Big words**, as wave 1 planned (`content-wave-1.md` § 5.1). There are no new lands.
- **K9. Exactly 8 words per Word Song step, in canon order** (wave 1's K9). The 16 targets are new pictures, and every chip partner is an existing one (§ 7).
- **K10. The traps test the new letters.** Tent words: Dave's twin where it has a picture (nest / net), otherwise the same start (hand / hat, belt / bed, pond / pot). Cake words: the short twin she knows (cape / cap, pine / pin, tube / tub), otherwise a short word with the same start (§ 3, § 4).
- **K11. One lead line per new step** before scored P1, in every forward session until mastered (wave 1's § 6.1): "Let's share the flowers!", "Read to the end!", "The E is quiet. It makes the A say its name."
- **K12. The quiet-E cue:** in the lead, and on the 2nd-wrong hint of every cake-words card, the e cell dims and the vowel cell lights. It never shows from reveal (§ 4.3, D8).

Mastery, the fast track, the pace guard, reviews, warm-ups and the Map peek work on the new steps as on their siblings. Nothing in this wave adds a timer, a currency, a streak or a loss mechanic.

## 1. Steps, lands, names and path art

| Step (`SkillNode`) | After        | Land, stop            | Spoken name | Verb | Recap phrase (`FRIENDLY_NODE_NAMES`) | Canon file                          |
| ------------------ | ------------ | --------------------- | ----------- | ---- | ------------------------------------ | ----------------------------------- |
| `div-share`        | `mult-mix`   | 4 Groups, 5th of 5    | sharing     | is   | sharing                              | `math/level-1/div-share.json`       |
| `tent-words`       | `crab-words` | 6 Big words, 3rd of 4 | tent words  | are  | reading words                        | `word-song/level-1/tent-words.json` |
| `cake-words`       | `tent-words` | 6 Big words, 4th of 4 | cake words  | are  | reading words                        | `word-song/level-1/cake-words.json` |

- **Why these names:** "sharing" is the word the step teaches, and it names the activity, like "skip counting". _tent_ and _cake_ are step words with clear pictures, and neither picture is on the path yet.
- **`LANDS`:** land 4 gets `'div-share'` at the end, and land 6 gets `'tent-words'` and `'cake-words'`. Groups then has 5 stops, the most a land has today (Word Song land 3). Big words has 4.
- **Map fit:** this spec makes no new layout measurement (no test runs). Wave 1's bars hold the build to it (`content-wave-1.md` § 5.2: core `mapModel.test.ts`, native `mapScreenLayout.test.ts`, no stop overlap, hit area ≥ 44 pt), plus the device check in § 10.

**Path art: 3 clay pieces** (subjects only; the same pipeline and style reference as wave 1 § 5.4; no digits, letters or signs):

| Id           | Subject                                                                                        | Must not look like                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `div-share`  | Two clay plates side by side, each holding three round sweets (one red, one yellow, one green) | the fruit basket (`mult-mix`), the egg box (`add-to-20`), the clovers (`mult-3-4`) |
| `tent-words` | A clay camping tent, a soft orange triangle with its door flap tied open                       | a house (the back button), the block tower (`land-ws-1`)                           |
| `cake-words` | A clay round cake with pink icing and one red cherry on top, no candles                        | the egg box (`add-to-20`); candles would bring numbers                             |

`PATH_ART_SET` gets the three ids. `pathArt.test.ts` fails until the files exist.

## 2. NG-C: sharing (`div-share`)

### 2.1 The step

- **SkillNode `div-share`**, after `mult-mix` in `MATH_TREE` and `MATH_NODES_IN_ORDER`. Default `'locked'`.
- **Served from canon, every session:** the same 8 problems (§ 2.7). The live planner's Leitner directive runs for `add-to-10` only, and sharing has no facts (K6).
- **Mastery, fast track, pace guard, peek:** the math preset, unchanged. A secure session needs all 8 right on the first tap.

### 2.2 What she sees

P4, phone portrait (375×667), before any hint:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ● ● ◉ ○ ○ ○ ○            |
| (Emma) +-----------------+ |
| (147 ) | Twelve flowers, | |
|        | three plates.   | |
|        | How many on     | |
|        | each plate?     | |
|        +-----------------+ |
| (12)✿✿✿✿✿ ✿✿✿✿✿            |  the pile: rows of 10 (5 + 5), the total tag
|     ✿✿                     |  on the cloth's left edge
|    (?)      (?)      (?)   |  "?" tags
|   |    |   |    |   |    | |  3 empty plates, all sized for the plan's
|   |    |   |    |   |    | |  largest share (6: 2 columns x 5 rows)
| [ 3 ]    [ 4 ]    [ 5 ]    |  chips: today's bottom row
+----------------------------+
```

After the deal and a right tap: the cloth is empty but keeps its "12" tag, each plate holds 4 flowers (one column of 4), and every tag reads "4".

Phone landscape (667×375): Word Song's L frame with the chip column, as for multiply (`math-skip-counting-multiplication-native.md` § 6). The ribbon gets skip's 2-line slot, and the pile is one row:

```
+------------------------------------------------------+
| [<]   | ● ● ● ◉ ○ ○ ○ ○        ✦3 (★ 12) | [ 3 ] |
| (Emma)| | Twelve flowers, three plates. | |  104  |
| ( col)| | How many on each plate?       | | [ 4 ] |
|       | (12)✿✿✿✿✿ ✿✿✿✿✿ ✿✿   (14 pt)    | |       |
|       |    (?)        (?)        (?)     | | [ 5 ] |
|       |   |    |     |    |     |    |   | |       |
+------------------------------------------------------+
```

**Parts** (new `mobile/src/screens/math/ShareStage.tsx`, `testID="math-share"`, `accessibilityLabel` = the read line, children hidden from accessibility, `pointerEvents: 'none'`):

- **Cloth:** the pile's base, so it can't read as a 4th plate. Fill `colors.myCream`, no border, radius 16 (tablet 20), 6 pt padding (tablet 8).
- **Pile:** T `FlowerGlyph`s in reading order. Phone portrait and tablet use rows of 10, with a wider gap after the 5th. Phone landscape uses one row, with a wider gap after every 5th.
- **Total tag:** multiply's tag pill (`colors.myPink`, 28 pt tall, tablet 32), with T in Fredoka 700 `colors.ink` at 20 pt (tablet 24). It sits on the cloth's left edge, vertically centred and half overlapping.
- **Plates:** `GroupsRow`'s plate exactly (white, 2 pt `colors.myPink` border, radius 12, columns of 5). Reuse its geometry; don't fork the sizes. There is **no "+"** between the plates, and no tag holds a number before the answer.
  - **Every plate in a plan has one size**, the size of the plan's largest share. A plate sized to its own problem's share would give the answer away.
- **"?" tag on each plate:** the tag pill with fill `colors.myCream`, a 2 pt dashed `colors.myRose` border and "?" in Fredoka 700 `colors.myRose`. When filled (§ 2.5) it becomes multiply's tag: `colors.myPink` with the numeral in `colors.ink`.

### 2.3 Layout and sizes

`extendedMathLayout(viewport, 'divide')` returns skip's frames: Math's P frame, the L frame with the chip column and `ribbonLines` 2, and Math's tablet frames. Block = cloth, then `problemGap` (P 24, L 8, tablet 24), then the plate slot (half a tag plus the plate), centred vertically. It is computed once per plan from its largest pile and largest share.

| Form (problem rect, from the multiply and skip tables) | Pile flower `s` | Cloth (w × h) | Plate (w × h) | Plate row, 5 plates (gap) | Block height |
| ------------------------------------------------------ | --------------- | ------------- | ------------- | ------------------------- | ------------ |
| P 375×667 (343 × 272)                                  | 20              | 256 × 56      | 56 × 128      | 340 (15)                  | 222          |
| L 667×375 b21 (376 × 189, the worst L)                 | 14              | 342 × 26      | 56 × 128      | 376 (24)                  | 176          |
| TP 744×1133 (712 × 530)                                | 24              | 320 × 70      | 70 × 160      | 478 (32)                  | 270          |
| TL 1133×744 (892 × 317)                                | 24              | 320 × 70      | 70 × 160      | 478 (32)                  | 270          |

- **The rules behind the table:**
  - `s` = the largest size ≤ 20 (tablet 24) at which the plan's largest pile fits the rect's width, including the tag's outer half (22 pt; tablet 26).
  - Pile gaps: 4 pt, and 12 pt after a 5th (tablet 6 / 16). L: 2 pt, and 6 pt after each 5th. Rows are 4 pt apart (tablet 6).
  - The plate gap is `GroupsRow`'s `clamp(12, fit, 24)` (tablet `clamp(16, fit, 32)`).
  - The numbers are hand-computed from those rules for the canon (largest pile 20, largest share 6), not measured. The build's layout test asserts them.
- **The pile flowers may go below the 20 pt flower floor in L.** She doesn't count them, because the tag says how many. Plate flowers stay at 20 pt everywhere.
- **Ribbon:** P keeps `maxLines={4}`. L uses skip's 2-line slot, and a read that measures 3 lines scrolls once, as skip's 8-term read does. Prediction: the longest read (55 characters) takes 3 lines in P and 2 in L. It is shorter than skip's longest read, which takes 4 lines in P (hypothesis: the build measures it).

### 2.4 Beats, problem by problem

- **Lead** (scored P1 only): "Let's share the flowers!" The stage is up, then 400 ms, then the read (wave 1 § 6.1).
- **Read:** "Twelve flowers, three plates. How many on each plate?" The chips open on `onPlay`, as today. On the word tick whose number is T, the total tag pulses. On the tick whose number is B, the plates ripple left to right.
- **Auto-deal (P1–P3):** 300 ms after the read ends, the whole pile is dealt (§ 2.5). Emma is `attentive-pointing` during the deal, then `listening`. The rule is session index ≤ 3 (the chip tier's rule), so a review block at P2 deals too.
- **Wrong tap (1st, 2nd):** "Hmm... try again?" with today's poof, shake and `puzzled-tilt`. The picture doesn't change.
- **hint1, "Look at the flowers.":** the flowers ripple in deal order (60 ms stagger), wherever they are.
- **hint2, "One for each plate.":** if the pile is undealt, round 1 is dealt, one flower for each plate, 300 ms apart. If it is dealt, the plates light one by one (multiply's hint-2 plate pulse).
- **hint3, "How many on each plate?":** the rest of the pile is dealt (§ 2.5 timing). If it is already dealt, all plates pulse together.
- **giveAnswer (3rd wrong), "This one is four.":** any flowers left land at once, and every "?" tag gets a 4 pt `colors.myRose` ring, like the glowing chip. The guided tap then plays the correct moment.
- **Correct, "Yes! Four on each plate!":** any flowers left are dealt fast, then every "?" tag fills with the share, and the plates pulse together once. The chip burst, sparkle, plink and `celebration` are today's. The finished picture is multiply's 4 × 3: three plates of four.
- **Advance:** today's 250 ms Math exit. Everything resets per problem.

### 2.5 Motion brief (Reanimated; Reduce Motion in brackets)

**The deal rule:** flower k (k = 0 … T−1) leaves the **last** occupied pile cell and lands on plate `(k mod B) + 1`, in that plate's next free cell (columns of 5, top to bottom, left column first). So each round puts one flower on every plate, left to right, and the pile shrinks from its end.

- **Normal deal:**
  - Launch at `k × 120 ms + floor(k / B) × 100 ms` (a 100 ms breath between rounds).
  - The flight lasts 320 ms, with `Easing.out(Easing.cubic)` on progress p. x lerps; y lerps minus the arc `4 · h · p · (1 − p)`, h = 32 pt (tablet 40); the scale lerps from `s / 20` to 1.
  - Landing: the scale goes 1 → 1.12 (80 ms), then springs back to 1 (stiffness 300, damping 14).
  - [Each pile flower fades out over 120 ms as its plate cell fades in, on the same schedule. No travel, no scale.]
- **Hint-2 round:** only the first B flowers, launched 300 ms apart, with the same flight. [The same fade.]
- **Fast deal** (a right tap with flowers left): the interval is `min(50, 900 / left)` ms, the flight 220 ms, and there is no breath, so it ends within about 1.1 s. [One 200 ms crossfade for all of them.]
- **Instant** (the given answer): every flower left moves straight to its cell, all together, 200 ms `EASE_OUT`, no arc. [A 200 ms crossfade.]
- **Tag fill** (after the last landing): the "?" fades out (100 ms). Then the numeral springs 0.6 → 1 (stiffness 260, damping 20), while the pill turns `colors.myPink` and the dashed border fades. Plate k starts at `80 × (k − 1)` ms. [A 200 ms crossfade.]
- **Pulse and ripple:** multiply's (§ 7 of its spec): 1 → 1.06 → 1 over 300 ms `EASE_IN_OUT`, 150 ms stagger for the plates. The total tag goes 1 → 1.1 → 1. [No scale.]
- **Durations** of a normal deal of the whole pile: 6 on 2 plates about 1.2 s, 12 on 3 about 2.0 s, and 20 on 4 (the longest) about 3.0 s.
- **Implementation:**
  - The pile and the moving flowers are one absolutely positioned layer of T `FlowerGlyph`s. Each flower's home is its pile cell and its target is its plate cell.
  - One shared value per flower, scheduled with `withDelay` on the UI thread, so there are no JS timers.
  - At most 20 transforms move at once, so there is no bundle or battery cost beyond today's ripples.
- **Rotation mid-deal:** every flower already launched lands at once, and the rest keep their schedule in the new layout.
- **No new sounds.** The deal is silent, so Emma's voice stays the only audio.

### 2.6 Data model, parser, chips, session end

- **New kind** in `packages/core/src/math/extendedProblems.ts`, opt-in through `{ extendedKinds: true }`; `ExtendedMathProblemKind` gains `'divide'`:

  ```ts
  export interface DivideProblem {
    kind: 'divide'
    index: number // 1..8
    total: number // flowers in the pile, 4..20
    plates: number // 2..5
    correct: number // total / plates, the share, 2..10
    utterances: MathProblemUtterances
  }
  ```

- **Read template:** `/^\s*([a-z-]+)\s+flowers,\s+([a-z-]+)\s+plates\.\s+how\s+many\s+on\s+each\s+plate\?\s*$/i`, number words through `wordToNumber`.
  - It is valid when 2 ≤ plates ≤ 5, the total divides evenly, 2 ≤ the share ≤ 10 (a `GroupsRow` plate holds 10), and total ≤ 20 (two pile rows).
  - It is disjoint from the existing templates (none contains "plates").
  - Before merge: all 8 `math.p*.read` of `div-share.json` parse (`sibling-tier-checklist.md`, the read-line row).
- **Chips:** `pickDistractors(correct, index, 10)` unchanged (M = 10, so no "99" chip). P1–P3 are gentle, P4–P8 off-by-one, and the offered class is `'off-by-one'`. `buildExtendedChipOrder` shuffles them, as for multiply.
- **Session end:**
  - It records `perProblemCorrect`, `latencyMs` and `perProblemAnswerValue` (the tapped share) as today. It records no `mathFacts` entry and no Leitner outcome, as skip counting doesn't (K6).
  - `CANON_MATH_FACTS['div-share']` is 8 nulls. Check that the generator and `blockFor` accept a fact-less file, as they do `skip-counting`.
- **Warm-up, review:**
  - Warm-up hearts on a sharing session come from mastered steps, because a sharing block has no fact to match.
  - Once mastered, `div-share`'s 8 blocks join the review pool.
  - `MULTIPLICATION_FOCUS_NODES` and `MIX_SOURCE_STEPS` don't change.

### 2.7 Canon (binding: the bake writes exactly this)

| P   | T (pile) | B (plates) | Share | Read                                                      | Correct                     | Chips    |
| --- | -------- | ---------- | ----- | --------------------------------------------------------- | --------------------------- | -------- |
| 1   | 6        | 2          | 3     | "Six flowers, two plates. How many on each plate?"        | "Yes! Three on each plate!" | 3, 1, 10 |
| 2   | 8        | 2          | 4     | "Eight flowers, two plates. How many on each plate?"      | "Yes! Four on each plate!"  | 4, 1, 10 |
| 3   | 10       | 2          | 5     | "Ten flowers, two plates. How many on each plate?"        | "Yes! Five on each plate!"  | 5, 1, 10 |
| 4   | 12       | 3          | 4     | "Twelve flowers, three plates. How many on each plate?"   | "Yes! Four on each plate!"  | 4, 3, 5  |
| 5   | 8        | 4          | 2     | "Eight flowers, four plates. How many on each plate?"     | "Yes! Two on each plate!"   | 2, 1, 3  |
| 6   | 15       | 5          | 3     | "Fifteen flowers, five plates. How many on each plate?"   | "Yes! Three on each plate!" | 3, 2, 4  |
| 7   | 20       | 4          | 5     | "Twenty flowers, four plates. How many on each plate?"    | "Yes! Five on each plate!"  | 5, 4, 6  |
| 8   | 18       | 3          | 6     | "Eighteen flowers, three plates. How many on each plate?" | "Yes! Six on each plate!"   | 6, 5, 7  |

- **The same on every problem:** reprompt "Hmm... try again?", hint1 "Look at the flowers.", hint2 "One for each plate.", hint3 "How many on each plate?", giveAnswer "This one is <share>." (for example "This one is four."). The session-end lines are every math file's, with `session.end.recap.focus` = "You worked on sharing today!".
- **The rules this table meets** (a bake lint checks them):
  - 2–5 plates, a share of 2–6, at most 20 flowers.
  - P1–P3 have 2 plates. P4–P8 have 3–5 plates, a share that is never the plate count, and five different shares.
  - No (pile, plates) pair appears twice.
- **Why this order:** two plates first, because sharing between two is the easiest fair share. P2 and P5 share the same 8 flowers onto 2 and then 4 plates, so more plates means fewer on each. Every share is the inverse of a times fact she has already practised (the finished picture of P4 is 4 × 3).
- **Chips** (correct first, for the unit test): `pickDistractors` with M = 10, computed by hand from `gentleDistractors` and `offByOneDistractors`.

### 2.8 "How many plates?" belongs later, not in this step

- **The picture can't hold it.** In this step the plates are on screen from the start. For "Twelve flowers. Four on each plate. How many plates?", the plate count is the answer. It needs a picture where plates appear as groups are made, which is a second new interaction.
- **One idea per step.** She first has to learn to hear "How many on each plate?" as the question. A second question shape in the same step would ask her to tell the two apart while both are new.
- **Dave's roadmap marks it "Later"** (§ 2, step 13).
- **Proposed home:** a deepening inside sharing once she has mastered it, as missing numbers deepened adding. It would come in a later wave, with its own spec and Dave's check (D1).

## 3. WS-C: tent words (`tent-words`, end blends)

### 3.1 The step

- **SkillNode `tent-words`**, after `crab-words` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`. Default `'locked'`.
- **Format:** `cvc-word` as it is: "Read the tent.", the word card with its letter row, three picture chips, the 1500 ms silent beat, the chip gate, the hint and the given answer. All as duck and crab words.
- **8 words**, served from canon in this order every session (K9). Short vowels only, and every word keeps its short vowel in British English too (Lily's voice). Mastery, fast track, pace guard and peek follow the sibling rules. No graduation gate.
- **No blend clip** (wave 1's K11). The letters pulse silently, and the 2nd wrong plays "Let's look. Tent.".
- **Every word takes "Yes! That's a <word>."**, so the celebration exception list doesn't grow.

### 3.2 Word list and chip pairs (canon order)

P1–P3 use the gentle pair and P4–P8 the trap pair. Every row needs both, because a review moves blocks.

| P   | Word | End | Vowel | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap                                                                       |
| --- | ---- | --- | ----- | --------- | -------------- | ------------ | ---------------------------------------------------------------------------------- |
| 1   | tent | nt  | e     | structure | dog, cup       | nest, tap    | nest: the same vowel and last letter, so the middle decides; tap: the same t       |
| 2   | hand | nd  | a     | body-part | bus, pot       | hat, pond    | hat: the same start _ha_; pond: the same ending _nd_                               |
| 3   | gift | ft  | i     | object    | sun, pot       | gem, fig     | gem: the same g; fig: the letters f, i, g in another order                         |
| 4   | nest | st  | e     | structure | cup, fox       | net, tent    | **net: nest without the s** (Dave's twin); tent: same vowel and end t              |
| 5   | desk | sk  | e     | household | sun, cat       | duck, nest   | duck: the same first and last sound; nest: s and one more, the last letter decides |
| 6   | belt | lt  | e     | clothing  | sun, fox       | bed, tent    | bed: the same start _be_; tent: same vowel and end t                               |
| 7   | lamp | mp  | a     | household | bus, dog       | lock, hand   | lock: l and four letters; hand: the same vowel and four letters                    |
| 8   | pond | nd  | o     | nature    | cup, hen       | pot, hand    | pot: the same start _po_; hand: the same ending _nd_                               |

- **These are 8 of Dave's 10 words.**
  - Dropped: _jump_ (a verb: "Yes! That's a jump." breaks) and _milk_ ("Yes! That's a milk." breaks, and an exception would grow the celebration list).
  - Also checked and kept out: _mask_ and _raft_ have a long vowel in British English (the _bath_ vowel).
- **Dave's twins:** _nest / net_ is the only one with a picture. _had_, _bet_ and _ten_ have none (`ls mobile/assets/pictures`, 2026-10-16: 73 files, no _ten_; the roadmap said _ten_ had one). Where the twin is missing, the trap has the same start and a short vowel (hand / hat, belt / bed, pond / pot), so she has to read past the vowel to the end. That is this step's new skill.
- **Gentle pairs** follow the CVC rule: another category, another first sound, another vowel.
- **New category:** `'nature'` (pond, and pine in § 4) joins `WordCategory`, because no existing one fits a pond or a tree.

### 3.3 Intro lead

"Read to the end!" plays before P1's silent beat, in every forward session on the step until it is mastered (§ 6.1).

- While Emma says it, the cells light one after another from the left, 150 ms apart (each a 120 ms fade in). This is crab words' animation.
- When the last cell has lit, the last two cells (n t) pulse once, 1 → 1.08 → 1 over 300 ms.
- All cells go dark 200 ms after the line ends. [Reduce Motion: they light at once, with no pulse.]

**Why:** children this age often drop a consonant of an end cluster (R4), so "to the end" names where to look. It costs one new word, _end_ (§ 6.3).

## 4. WS-D: cake words (`cake-words`, magic e)

### 4.1 The step

- **SkillNode `cake-words`**, after `tent-words`. Default `'locked'`. Format, mastery, fast track and peek as § 3.1.
- **8 words**, all CVCe (consonant, vowel, consonant, e). The vowel says its name, and in British English _tube_ says "u" as its name too.
- **No blend clip.** The 2nd wrong plays "Let's look. Cake." with the quiet-E cue (§ 4.3).

### 4.2 Word list and chip pairs (canon order)

| P   | Word | Pattern | Category | Gentle (P1–P3) | Trap (P4–P8) | Why the trap                                                              |
| --- | ---- | ------- | -------- | -------------- | ------------ | ------------------------------------------------------------------------- |
| 1   | cake | a_e     | food     | dog, pen       | cape, cat    | cape: the same start and pattern, the 3rd letter decides; cat: short _ca_ |
| 2   | kite | i_e     | object   | sun, hen       | king, bike   | king: the same start _ki_, short; bike: the same i_e                      |
| 3   | bone | o_e     | object   | jet, sun       | box, rope    | box: the same start _bo_, short; rope: the same o_e                       |
| 4   | cape | a_e     | clothing | dog, bus       | cap, cake    | **cap: cape without the e** (Dave's twin); cake: same start and pattern   |
| 5   | pine | i_e     | nature   | dog, cup       | pin, kite    | **pin: pine without the e**; kite: the same i_e                           |
| 6   | rope | o_e     | object   | hen, sun       | rock, bone   | rock: the same start _ro_, short; bone: the same o_e                      |
| 7   | tube | u_e     | object   | hen, cat       | tub, top     | **tub: tube without the e**; top: t with a short vowel                    |
| 8   | bike | i_e     | vehicle  | dog, pen       | bib, kite    | bib: the same start _bi_, short; kite: the same i_e                       |

- **The trap is the short word she already reads.** If she skips the e, she reads _cap_, _pin_ or _tub_, and that picture is on the row. The second trap shares the pattern, so "it has an e" alone doesn't decide either.
- **Order:** the three most familiar words open (P1–P3), and P1 is _cake_, so the lead's "A" is the card's vowel. The three twins sit at P4, P5 and P7.
- **These are 8 of Dave's 12 words.** Dropped:
  - _nose_: a nose alone reads as a face.
  - _cube_: reads as a box or a block, and its twin _cub_ has no picture.
  - _five_, _nine_: number words. Their picture would need digits, which the pack doesn't allow.
- **Dave's other twins:** _kit_ has no picture, and _cane_ is weak vocabulary for her (it would also be one more new picture).
- **`BigWordRow.vowel` widens to `'a' | 'e' | 'i' | 'o' | 'u'`.** For cake rows it holds the vowel letter. Nothing on the land-6 path reads it as a short sound, but the build checks every consumer, as wave 1 did (`wordDistractors.test.ts`, the CVC-axis tests).

### 4.3 Intro lead and the quiet-E cue

**Lead:** "The E is quiet. It makes the A say its name." plays before P1's silent beat, in every forward session until mastery. It is Dave's sentence, with the letters written as capitals, the way the letter-sound lines write them ("A says aaa."), so Lily says the letter names.

- **On the word tick "quiet":** the e cell (cell 4) dims to 35% opacity over 200 ms.
- **On the tick "A":** the a cell (cell 2) lights on the rose spotlight (120 ms fade in).
- **200 ms after the line ends**, both return to normal. Then come the 1500 ms silent beat and "Read the cake." [Reduce Motion: the same states with plain fades; no motion.]
- **Fallback text** if the ear test hears "the A" as "the uh": "The E is quiet. A says its name."

**The cue on the hint** (the 2nd wrong of every cake-words card, in any session that shows one): while "Let's look. Kite." plays, cell 4 dims and cell 2 lights. They stay that way until the problem advances, so the 3rd try has the cue. On these cards this replaces the silent letter pulse.

- **New `LetterRow` cell state `'quiet'`:** the glyph is `colors.ink` at 35% opacity, with no spotlight.
- **All 8 words are CVCe**, so the rule is fixed: vowel = cell 2, e = cell 4.
- **Never from reveal.** She has to learn to spot the final e herself, and real text never dims it (D8).

## 5. New forbidden pairs

Added to `FORBIDDEN_PAIRS` before the rows are coded:

| Pair        | Why                                 |
| ----------- | ----------------------------------- |
| gift – box  | both are boxes                      |
| nest – egg  | the nest holds eggs                 |
| desk – bed  | both are furniture on four legs     |
| kite – flag | both are cloth on a stick or string |
| rope – sack | the sack is tied shut with a rope   |

No trio in § 3.2 or § 4.2 contains a forbidden pair, old or new, and every chip word has a picture. I checked this with a scratch script against `wordPack.ts` and `picture-manifest.json` on 2026-10-16 (not committed).

## 6. Copy / TTS script

### 6.1 Lead lines

Wave 1's mechanism (`content-wave-1.md` § 6.1): `createManifestLinePlayer('session-guide', …)`, Emma `listening`, before scored P1 of every forward session until mastery, and never in a peek, review or warm-up heart. The ids are `guide.session.intro.<node>` (kind `'session-intro'`). After a Word Song lead, the 1500 ms silent beat starts when it ends. After the Math lead, the read follows 400 ms later.

### 6.2 Every new spoken line (for the Lily render)

**Guidance (9)** and **path (15)**, one column per step:

| Line id                           | `div-share`                                           | `tent-words`                                         | `cake-words`                                         |
| --------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `guide.session.peek-open.<node>`  | "Let's look at sharing!"                              | "Let's look at tent words!"                          | "Let's look at cake words!"                          |
| `guide.session.peek-close.<node>` | "Sharing is for later. You will learn it!"            | "Tent words are for later. You will learn it!"       | "Cake words are for later. You will learn it!"       |
| `guide.session.intro.<node>`      | "Let's share the flowers!"                            | "Read to the end!"                                   | "The E is quiet. It makes the A say its name."       |
| `path.open.<node>`                | "Here is your path! You are on sharing."              | "Here is your path! You are on tent words."          | "Here is your path! You are on cake words."          |
| `path.stop.<node>`                | "Sharing."                                            | "Tent words."                                        | "Cake words."                                        |
| `path.locked.next.<node>`         | "Sharing! First, all the groups. Then this!"          | "Tent words! First, crab words. Then this!"          | "Cake words! First, tent words. Then this!"          |
| `end.bud.<node>`                  | "Look! A new flower for sharing!"                     | "Look! A new flower for tent words!"                 | "Look! A new flower for cake words!"                 |
| `end.unlock.<node>`               | "You learned all the groups! Now you can do sharing!" | "You learned crab words! Now you can do tent words!" | "You learned tent words! Now you can do cake words!" |

**Canon:**

- **`div-share` (16 new texts):**
  - The 8 reads and 5 distinct correct lines of § 2.7.
  - hint2 "One for each plate." and hint3 "How many on each plate?".
  - "You worked on sharing today!".
- **`tent-words` and `cake-words` (32 each):** four lines per word, in § 3.2 / § 4.2 order:
  - read "Read the <word>."
  - correct "Yes! That's a <word>."
  - hint "Let's look. <Word>."
  - giveAnswer "This one is <word>."
- **Reused, not rendered:** "Hmm... try again?", "Look at the flowers.", "This one is two." to "This one is six.", "You worked on reading words today!", and every other `session.end.*` line (19 per file).

**Total: 104 distinct new texts, 2,479 characters for ElevenLabs Lily.**

| Surface            | Texts | Characters |
| ------------------ | ----- | ---------- |
| guidance           | 9     | 284        |
| path               | 15    | 524        |
| canon `div-share`  | 16    | 599        |
| canon `tent-words` | 32    | 536        |
| canon `cake-words` | 32    | 536        |

- **How it was counted:** a scratch script (not committed, 2026-10-16) generated the texts from this spec's lists and compared them with every `text` in `public/canon/*/level-1/*.json`, every literal in `guidanceLines.ts`, and the path lines of today's spoken names. 26 slots reuse an existing text.
- **The bill is right only if the bake reuses audio.** `revoiceCanonLily.ts` de-duplicates on the exact request text and caches renders. If a new file's 19 shared `session.end.*` lines were re-rendered, each file would add 382 characters. The `--dry-run` prints the real number before any spend.
- **Canon is written, not Haiku-baked.** Every line is fixed, so a splice script writes the three files exactly (as `scripts/spliceContentWave1Canon.ts` did for wave 1's math). That costs no Anthropic credit. The three nodes join `PENDING_CANON_NODES` so an ordinary bake never draws them.
- **Render with** `renderGuidanceLinesLily.ts`, `renderPathLinesLily.ts` and `revoiceCanonLily.ts --unrendered`. `pathLines.test.ts`'s baked count grows by 15.

**Prediction for the ear test (Predict-Before-Soak; bar 2):**

- The "Read the <word>." lines sound like crab words', and the end clusters keep both consonants (the d in _hand_, the k in _desk_ and the t in _belt_ are audible).
- _tube_ comes out British, "tyoob".
- The cake lead runs about 3.0–3.6 s, with a pause after "quiet", and says "the ay", not "the uh".
- The sharing reads run about 3.2–4.0 s and pause at the comma and the full stop.
- **Not predicted:** whether Lily stresses _each_ in "How many on each plate?". The ear test settles it.

### 6.3 Vocabulary check (the ~200-word cap)

- **New core words: 7.**
  - **share** (also _sharing_), **plate** (also _plates_): the step's own words.
  - **end**: the tent lead.
  - **quiet**, **say**, **its**, **name**: the cake lead. No existing spoken line uses _name_.
  - _makes_ is a form of wave 1's _make_. _each_ is already in use ("We add two each time.").
  - That brings wave 1's count of about 162 to about 169, still under ~200.
- **Target words:** the 16 step words. _tent_ and _cake_ also name the steps.
- **Zero-cost choices, made on purpose:**
  - "Let's share the flowers!", not "divide", "equal" or "fair".
  - hint3 reuses the read's question. hint1 reuses "Look at the flowers.".
  - The digits sit on tags, so no "÷" word is needed.
- Every text is ASCII-7, with no IPA and no sound demonstration inside a sentence.

## 7. Pictures (OpenAI, the manifest pipeline)

**16 new pictures:** the 8 tent words and the 8 cake words. None is in `mobile/assets/pictures/` (73 WebPs, `ls` 2026-10-16).

- **Reused as chips (26 existing pictures):** bed, bib, box, bus, cap, cat, cup, dog, duck, fig, fox, gem, hat, hen, jet, king, lock, net, pen, pin, pot, rock, sun, tap, top, tub.
- **Cost:** 16 × $0.078 ≈ $1.25 for one take each. A second round on the four riskiest (pond, desk, pine, tube) adds about $0.31.
- **If one of those four fails its second round, stop and tell Matt** before spending more. A swap changes a word and its chip row, so it goes back through Dave.
- **The 3 clay path pieces (§ 1) are not in this pipeline.** They are made the way the clay set was, with Thomas's tool.

**Append to `design/word-song/picture-manifest.json`** (batches 9 and 10, riskiest first). The `distinctFrom` lists follow the manifest's rule: forbidden partners first, then trio mates A–Z, computed by the scratch script.

```
  { "word": "pond", "tier": "tent-words", "batch": 9, "subject": "A small round pond seen a little from above: calm blue water in a ring of rounded grey stones, two green reeds at one side and one round green lily pad on the water.", "avoid": ["a frog, a duck or any animal", "a lake with a far shore or hills", "a puddle on a road", "a fountain or a bucket"], "distinctFrom": ["cup", "hand", "hat", "hen", "pot"] },
  { "word": "desk", "tier": "tent-words", "batch": 9, "subject": "A child's wooden school desk in three-quarter view: a flat warm-brown top on four straight legs, one small drawer at the front, and nothing on top.", "avoid": ["a lamp, books or a computer on it", "a chair", "a bed's headboard, pillow or blanket", "a table with a cloth"], "distinctFrom": ["bed", "cat", "duck", "nest", "sun"] },
  { "word": "belt", "tier": "tent-words", "batch": 9, "subject": "One brown leather belt lying in a loose open curve, with a square silver buckle at one end and a row of small holes near the other end.", "avoid": ["a tight coil or spiral that reads as a snake", "trousers or a person wearing it", "a watch strap"], "distinctFrom": ["bed", "fox", "sun", "tent"] },
  { "word": "nest", "tier": "tent-words", "batch": 9, "subject": "A round bird's nest of woven warm-brown twigs, seen from the side and a little above, holding three small pale-blue eggs.", "avoid": ["a bird in or near the nest", "one big tan hen's egg", "a basket with a handle", "a tree or a branch"], "distinctFrom": ["egg", "cup", "desk", "duck", "fox", "net", "tap", "tent"] },
  { "word": "gift", "tier": "tent-words", "batch": 9, "subject": "One wrapped present in three-quarter view: a cube-shaped box in soft rose paper, with a cream ribbon crossing it and a big cream bow on top.", "avoid": ["plain brown cardboard, like the box picture", "a tag or a card", "more than one present", "a cake"], "distinctFrom": ["box", "fig", "gem", "pot", "sun"] },
  { "word": "lamp", "tier": "tent-words", "batch": 9, "subject": "A table lamp in side view: a round cream base, a short straight stem and a soft rose bell-shaped shade, switched on, with a warm glow under the shade.", "avoid": ["a desk or a table under it", "a street lamp", "a candle or a torch", "a ceiling light"], "distinctFrom": ["bus", "dog", "hand", "lock"] },
  { "word": "hand", "tier": "tent-words", "batch": 9, "subject": "One open hand seen from the palm side, fingers together and the thumb out, warm peach skin, cut off cleanly at the wrist.", "avoid": ["fingers spread wide, as if counting five", "a fist or a pointing finger", "an arm or a sleeve", "a glove"], "distinctFrom": ["bus", "hat", "lamp", "lock", "pond", "pot"] },
  { "word": "tent", "tier": "tent-words", "batch": 9, "subject": "A small camping tent in three-quarter view: a soft orange triangle with a darker orange door flap tied open and two short guy ropes pegged to the ground.", "avoid": ["a house, a roof or a chimney", "a circus tent", "a flag on top", "people or a campfire"], "distinctFrom": ["bed", "belt", "cup", "dog", "nest", "net", "tap"] },
  { "word": "pine", "tier": "cake-words", "batch": 10, "subject": "One small pine tree on its own: a tall, narrow cone of dark-green layered needles on a short brown trunk, with two brown pine cones hanging from the lowest layer.", "avoid": ["decorations, lights or a star, like a Christmas tree", "a round leafy tree", "a forest or a hill", "a pot"], "distinctFrom": ["cup", "dog", "kite", "pin"] },
  { "word": "tube", "tier": "cake-words", "batch": 10, "subject": "One soft squeezable tube lying on its side: mint green with a rose band near its round white screw cap, gently squeezed in the middle.", "avoid": ["toothpaste coming out, or a toothbrush", "letters or a logo", "a cardboard roll", "a can or a standing cylinder"], "distinctFrom": ["cat", "hen", "top", "tub"] },
  { "word": "cape", "tier": "cake-words", "batch": 10, "subject": "One rose-red cape on its own, spread open in a wide half-circle, with a cream lining and a cream bow at the neck.", "avoid": ["a person or a hood", "a dress with sleeves", "a blanket or a towel", "a logo or a symbol"], "distinctFrom": ["bus", "cake", "cap", "cat", "dog"] },
  { "word": "rope", "tier": "cake-words", "batch": 10, "subject": "One length of thick warm-tan rope lying across the picture, tied in a loose single knot in the middle, both ends a little frayed.", "avoid": ["a coil or spiral that reads as a snake", "a lasso loop", "a sack tied with it", "a swing or a boat"], "distinctFrom": ["sack", "bone", "box", "hen", "rock", "sun"] },
  { "word": "bone", "tier": "cake-words", "batch": 10, "subject": "One cartoon dog bone lying diagonally: a straight shaft with two rounded knobs at each end, warm ivory with soft tan shading.", "avoid": ["pure white that vanishes on a cream background", "a dog or a bowl", "a skeleton", "a dumbbell"], "distinctFrom": ["box", "jet", "rock", "rope", "sun"] },
  { "word": "cake", "tier": "cake-words", "batch": 10, "subject": "A round two-layer cake in three-quarter view: soft pink icing dripping a little over the sides, a cream filling line between the layers, and one red cherry on top.", "avoid": ["candles or numbers", "a cut slice", "a cupcake or a bun", "a plate or a fork"], "distinctFrom": ["cap", "cape", "cat", "dog", "pen"] },
  { "word": "kite", "tier": "cake-words", "batch": 10, "subject": "A diamond-shaped kite flying at a tilt, in four triangles of sky blue and rose pink, with a long wavy string and a tail of three small cream bows.", "avoid": ["a flag on a pole", "a person holding it", "a bird", "letters or patterns"], "distinctFrom": ["flag", "bib", "bike", "hen", "king", "pin", "pine", "sun"] },
  { "word": "bike", "tier": "cake-words", "batch": 10, "subject": "A child's bicycle in side view: a rose-pink frame, two black tyres with thin spokes, a cream seat, handlebars and pedals.", "avoid": ["a rider", "a motorbike or a scooter", "training wheels", "a car"], "distinctFrom": ["bib", "dog", "king", "kite", "pen"] }
```

**Edits to the same file and its notes, so the manifest's checks pass:**

- **Symmetry:** add the new words to their partners' `distinctFrom`. Forbidden partners go first:
  - **bed:** desk (forbidden); belt, tent
  - **box:** gift (forbidden); bone, rope
  - **egg:** nest (forbidden)
  - **flag:** kite (forbidden)
  - **sack:** rope (forbidden)
  - bib: bike, kite · bus: cape, hand, lamp · cap: cake, cape · cat: cake, cape, desk, tube
  - cup: fox, nest, pine, pond, tent · dog: bike, cake, cape, lamp, pine, tent · duck: desk, nest · fig: gem, gift
  - fox: belt, cup, nest · gem: fig, gift · hat: hand, pond · hen: kite, pond, rope, sun, tube · jet: bone, sun
  - king: bike, kite · lock: hand, lamp · net: nest, tent · pen: bike, cake · pin: kite, pine
  - pot: gift, hand, pond · rock: bone, rope · sun: belt, bone, desk, gift, hen, jet, kite, rope · tap: nest, tent · top: tub, tube · tub: top, tube
- **The build check's word set** grows from 73 to 89 words. `picture-manifest.md` gets the two tiers in its `tier` row and batches 9 and 10 in its table.
- **Don't append before Thomas approves (T4).** The generator reads the whole file, so an early append could start the spend.

## 8. States and edge cases

- **Error path:** a wrong tap gets the poof, the shake, `puzzled-tilt` and "Hmm... try again?". The hints come at 2 wrongs and the given answer at 3. Never a red X.
- **First visit:** the Map's unlock beat, then the lead before P1 of each forward session until mastery.
- **Peek:** P1–P3 with the step's opener and closer, no lead, and nothing written.
  - Sharing: 6, 8 and 10 flowers on 2 plates, each dealt on its own.
  - Tent words: tent, hand, gift. Cake words: cake, kite, bone.
- **Review:**
  - A sharing block auto-deals at session positions 1–3, and its chips use M = 10.
  - A cake-words block keeps its quiet-E hint.
- **A tap during the auto-deal:** a right tap plays the fast deal and the fill. After a wrong tap the deal carries on underneath.
- **Return user who finished a world:** wave 1's load rule (K13), with no new code.
- **Rotation, background, Reduce Motion:** § 2.5, § 3.3 and § 4.3; otherwise as the host screens. Transition in and out unchanged.
- **Ship order:** the deployed server doesn't know the three nodes until `yarn release`, so release before the device check (wave 1 § 2.4).

## 9. Wiring checklist (Kevin, Devon)

**Each new SkillNode** goes through `.claude/docs/sibling-tier-checklist.md`:

- **All three:** rows 1–10 and 12.
- **`tent-words`, `cake-words` only:** row 11. Rows 13–15: `VALID_WORD_SONG_FOCUS_NODES`, `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, `WORD_SONG_FOCUS_NODES`.
- **`div-share` instead:** `VALID_MATH_FOCUS_NODES` (`api/_planner.ts`) and `MATH_FOCUS_NODES` (`scripts/generateSessionCanon.ts`).
- **Skipped:** row 16, the web debug seeds (the web is frozen).

**From the list's "does not cover" section, these apply:**

- the math read-line template (8/8);
- `CANON_FILES` in `public/voice-qa.html` (3 stems);
- the word-pack content and the `WORD_SONG_TRACK_GUIDE` tier block;
- the committed canon JSON;
- the sibling-spec audit: e2e specs whose seeds end at `crab-words` or `mult-mix`.

**Plus these surfaces, as in wave 1 § 9:**

- **Names:**
  - `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS` and `FRIENDLY_NODE_NAMES`.
  - The recap-phrase list in `api/_planner.ts` (div-share → "sharing"; tent and cake → "reading words").
  - `scripts/recapFocusCopy.ts`.
- **Map and lines:** `LANDS`, `PATH_LINES` (+15 baked), `PATH_ART_SET` (+3), and `GUIDANCE_LINES` (3 peek pairs, plus 3 texts in the intro map).
- **Math:**
  - `DivideProblem`, its template and range check.
  - `extendedMathLayout(…, 'divide')`, `ShareStage`, and `buildExtendedChipOrder` for `'divide'`.
  - `CANON_MATH_FACTS` regenerated (8 nulls for `div-share`).
- **Word Song:**
  - `BIG_WORDS_STEPS`: 2 steps, 16 rows. `BigWordsStep` and `BIG_WORDS_STEP_IDS` widen too.
  - `BigWordRow.vowel` gains `'e'`, `BigWordCategory` gains `'nature'` and `'vehicle'`, and `WordCategory` gains `'nature'`.
  - `wordPack.ts`: 16 targets, 16 `TARGET_PAIRINGS` rows, 5 `FORBIDDEN_PAIRS`.
  - `_plannerWordList.ts`, and `bigWordsCanonCheck.ts` for the two files.
  - `wordDistractors.test.ts`: the CVC-axis treatment wave 1 gave land 6.
  - `LetterRow`'s `'quiet'` state and the two lead animations.
- **Canon:** a splice script for the three files, and `PENDING_CANON_NODES` + 3 (§ 6.2).

**Unchanged on purpose:**

- `isLeitnerDirectiveActive`, `MULTIPLICATION_FOCUS_NODES`, `MIX_SOURCE_STEPS`;
- `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`;
- the celebration exception list;
- both `withDefaultedSkillLevels` copies (wave 1's rule is generic).

## 10. Acceptance criteria

**Core (vitest):**

1. **Parser:**
   - "Twelve flowers, three plates. How many on each plate?" parses to `{ kind: 'divide', total: 12, plates: 3, correct: 4 }`.
   - Seven on two plates (uneven), twelve on six (more than 5 plates) and thirty on three (more than 20 flowers) are rejected.
   - Without `extendedKinds` it throws.
2. `div-share.json` equals § 2.7 (8/8 reads parse), and the bake lint enforces § 2.7's rules.
3. `pickDistractors(correct, index, 10)` returns § 2.7's chips for all 8 problems.
4. A `div-share` session-end write has no `mathFacts` entry and no Leitner outcome, and `perProblemAnswerValue` holds the tapped shares.
5. **Lines and lands:**
   - `LANDS` flattened equals both trees. Groups has 5 steps and Big words 4.
   - `GUIDANCE_LINES` and `PATH_LINES` hold § 6.2's 24 texts exactly, and the baked path count is +15.
   - The `STAGE_SPOKEN_NAMES` values stay unique.
6. **`wordPack`:**
   - The 16 rows equal § 3.2 and § 4.2.
   - No trio contains a forbidden pair, and the 5 new pairs exist.
   - Every picture key resolves through native `pictureAsset`.
7. **Loading:**
   - A doc with `crab-words` mastered and no `tent-words` key loads `tent-words: 'intro'` and `cake-words: 'locked'`.
   - A doc with `mult-mix` mastered and no `div-share` key loads `div-share: 'intro'`.

**Native (jest):**

8. **Sharing P1:**
   - About 300 ms after the read ends, 6 flowers deal onto 2 plates in the order plate 1, 2, 1, 2, 1, 2, taken from the pile's end.
   - The tags read "?" until a right tap, then "3".
   - The chips are 1, 3 and 10.
9. **Sharing P4:**
   - Nothing deals before the hints. hint2 deals exactly 3 flowers (one per plate), and hint3 deals the other 9.
   - A right tap with flowers left deals them all and fills every tag with "4".
   - The given answer lands every flower and rings every tag.
10. In one plan, every plate on every problem has the same size (the size for a share of 6).
11. **Reduce Motion:** the deal has no travel and no scale, only fades, and the tags crossfade.
12. **Tent words:**
    - P1's lead lights the cells left to right and pulses the last two.
    - The silent beat counts from the lead's end.
    - No lead plays on P2–P8, in reviews, on warm-up hearts or in peeks.
13. **Cake words:**
    - In P1's lead, cell 4 goes `'quiet'` at "quiet" and cell 2 lights at "A". Both are normal 200 ms after the line.
    - On any cake-words card, the 2nd wrong sets cell 4 quiet and cell 2 lit until the advance.
    - No cell is quiet at reveal.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP`):

14. **Each new step from the QA picker:**
    - Emma speaks every line, with no silent caption walk once the render has shipped.
    - Word steps show three pictures on every problem.
    - At 375×667 portrait and 667×375 landscape, the sharing deal reads as one flower for each plate in turn, and nothing leaves the problem rect.
15. **Map, 375×667 and 744×1133 portrait:**
    - Groups shows 5 stops and Big words 4, and no two stops overlap.
    - A peek at sharing says "Let's look at sharing!" and deals P1.
16. **Return user:** a QA doc with `crab-words` mastered and no `tent-words` key. After launch, the Map plays "You learned crab words! Now you can do tent words!" once.

## 11. Thomas decides

One team recommendation each.

- **T1. The names:** "sharing", "tent words" (not "jump words", K7) and "cake words". Recommendation: approve.
- **T2. The new lines (§ 6.2),** chiefly the three leads: "Let's share the flowers!", "Read to the end!" and "The E is quiet. It makes the A say its name.". Recommendation: approve. The ear test settles "the A"; the fallback text is in § 4.3.
- **T3. The 3 clay pieces (§ 1):** two plates of sweets, a tent, a cake. Recommendation: approve the subjects. The look is judged when they are made.
- **T4. The picture spend:** 16 pictures, about $1.25, or about $1.56 with retakes on the four riskiest. Recommendation: approve, and top up the OpenAI balance first, because it is low.
- **T5. Dave's check** (roadmap § 4): after a reading-sentences session, ask Marian "Who sat on the mat?" about a sentence she has just read.
  - If she reads it but can't say who, little stories move up. They replace this wave's Word Song half (in their own spec), and tent and cake words wait.
  - Recommendation: do the check before the Word Song build starts. Sharing doesn't depend on it.

## 12. Pedagogy assumptions for Dave (D1…)

The spec had to fill these in. **All nine were confirmed by Dave on 2026-10-16, and nothing blocks the build.**

- **D1. "How many on each plate?" only.** "How many plates?" waits for a later deepening with its own picture (§ 2.8). **Confirmed (Dave, 2026-10-16).**
- **D2. The range and order:** **Confirmed (Dave, 2026-10-16).**
  - 2–5 plates, 2–6 on each, at most 20 flowers.
  - P1–P3 have 2 plates and deal on their own every session (the concrete model).
  - P4–P8 have 3–5 plates, the plate count is never the answer, and the five shares all differ (§ 2.7).
- **D3. No equation and no division sign in this step.** The digits ride on tags: the total on the pile, "?" then the share on each plate. **Confirmed (Dave, 2026-10-16).**
  - The sign waits for a later step. It may be the Danish ":" rather than "÷". Hypothesis, not checked: Danish schools write division with a colon.
  - **Dave's note:** before any future division-sign spec, check her school workbook for ":" vs "÷".
- **D4. Off-by-one chips only.** The alternative: swap one off-by-one chip for the plate count, which catches a misheard "each". **Confirmed (Dave, 2026-10-16).**
- **D5. No Leitner fact for sharing,** so the × facts' boxes and slow-fact times stay clean. **Confirmed (Dave, 2026-10-16).**
- **D6. The hint ladder:** **Confirmed (Dave, 2026-10-16).**
  - "Look at the flowers.", then "One for each plate." (deals one round), then "How many on each plate?" (deals the rest).
  - The correct line is "Yes! Four on each plate!", so the answer is said with _each_ again.
- **D7. Tent words** are Dave's 10 minus _jump_ and _milk_. _mask_ and _raft_ are kept out (long vowel in British English). Where his twin has no picture (had, ten, bet), the trap has the same start and a short vowel (§ 3.2). The lead is "Read to the end!". **Confirmed (Dave, 2026-10-16).**
- **D8. Cake words** are 8 of Dave's 12 (§ 4.2). The trap is the short twin where it has a picture. The lead plays before P1 only. The quiet-E cue shows on the lead and on the hint, never from reveal. **Confirmed (Dave, 2026-10-16).**
- **D9. Leads every session until mastery**, as wave 1's D5 confirmed for its steps. **Confirmed (Dave, 2026-10-16).**
