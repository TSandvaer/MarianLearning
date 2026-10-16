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

| #   | Call                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | **Sharing asks one question only: "How many on each plate?"** "How many plates?" comes later, because it needs its own picture: the plates are its answer, so they can't be on screen from the start (§ 2.8).                                                                                                      |
| K2  | **The read is Dave's: "Twelve flowers, three plates. How many on each plate?".** The screen shows a pile of 12 flowers with a "12" tag and 3 empty plates with "?" tags. There is no equation and no division sign in this step; the digits sit on the tags (§ 2.2).                                               |
| K3  | **Flowers are dealt one at a time, one for each plate in turn** ("one for you, one for you"). P1–P3 deal on their own after the read (the concrete model, every session). On P4–P8 the deal waits for the hints, and a right answer plays it fast as proof (§ 2.4).                                                |
| K4  | **Range: 2–5 plates, 2–6 on each plate, at most 20 flowers.** The plates are wave 1's (`GroupsRow`, at most 5). P1–P3 use 2 plates; on P4–P8 the plate count is never the answer (§ 2.7).                                                                                                                          |
| K5  | **Chips are `pickDistractors` as it is, with ceiling M = 10.** P1–P3 gentle, P4–P8 off-by-one (§ 2.6, D4).                                                                                                                                                                                                         |
| K6  | **A sharing problem records no Leitner fact**, as skip counting doesn't. Its time includes the deal, so it would mark × facts slow (§ 2.6, D5).                                                                                                                                                                    |
| K7  | **Spoken names: "sharing", "tent words", "cake words".** Not "jump words": _jump_ is an action, so it can't be a picture word ("Yes! That's a jump." breaks, the reason wave 1 dropped _swim_), and every word step is named after its stop picture (§ 1).                                                         |
| K8  | **Sharing is the 5th stop of land 4, Groups. Tent and cake words are the 3rd and 4th stops of land 6, Big words.** Wave 1 planned both placements (`content-wave-1.md` § 5.1). There are no new lands and no new land emblems.                                                                                     |
| K9  | **Exactly 8 words per Word Song step, in canon order** (wave 1's K9). All 16 targets are new pictures. Every chip partner is an existing picture, so the pack grows by 16 and no more (§ 7).                                                                                                                       |
| K10 | **Traps test the new letters.** Tent words: Dave's twin where it has a picture (nest / net), otherwise the same start (hand / hat, belt / bed, pond / pot, desk / duck). Cake words: the short twin she already knows (cape / cap, pine / pin, tube / tub), otherwise a short word with the same start (§ 3, § 4). |
| K11 | **One lead line per new step** before scored P1, in every forward session until mastered (wave 1's § 6.1 mechanism): "Let's share the flowers!", "Read to the end!", "The E is quiet. It makes the A say its name."                                                                                                |
| K12 | **A "quiet E" cue on cake-words cards:** during the lead, and on the 2nd-wrong hint of every cake-words card, the e cell dims and the vowel cell lights. It never shows from reveal (§ 4.3, D8).                                                                                                                   |

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

| Moment                 | Line                                                    | What happens on screen                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lead (scored P1 only)  | "Let's share the flowers!"                              | The stage is up. Then 400 ms, then the read (wave 1 § 6.1).                                                                                                                                                                                       |
| read                   | "Twelve flowers, three plates. How many on each plate?" | Chips open on `onPlay`, as today. On the word tick whose number is T, the total tag pulses. On the tick whose number is B, the plates ripple left to right.                                                                                       |
| auto-deal (P1–P3)      | —                                                       | 300 ms after the read ends, the whole pile is dealt (§ 2.5). Emma is `attentive-pointing` during the deal, then `listening`. The rule is session index ≤ 3 (the chip tier's rule), so a review block at P2 deals too.                             |
| wrong tap (1st, 2nd)   | "Hmm... try again?"                                     | Today's poof, shake and `puzzled-tilt`. The picture doesn't change.                                                                                                                                                                               |
| hint1                  | "Look at the flowers."                                  | Wherever the flowers are (pile or plates), they ripple in deal order (60 ms stagger).                                                                                                                                                             |
| hint2                  | "One for each plate."                                   | Undealt: round 1 is dealt, one flower for each plate, 300 ms apart. Already dealt: the plates light one by one (multiply's hint-2 plate pulse).                                                                                                   |
| hint3                  | "How many on each plate?"                               | Undealt: the rest of the pile is dealt (§ 2.5 timing). Already dealt: all plates pulse together.                                                                                                                                                  |
| giveAnswer (3rd wrong) | "This one is four."                                     | Any undealt flowers land at once. Every "?" tag gets a 4 pt `colors.myRose` ring, like the glowing chip. The guided tap then plays the correct moment.                                                                                            |
| correct                | "Yes! Four on each plate!"                              | Any undealt flowers are dealt fast, then every "?" tag fills with the share, and the plates pulse together once. Today's chip burst, sparkle, plink and `celebration`. The finished picture is multiply's picture of 4 × 3: three plates of four. |
| advance                | —                                                       | Today's 250 ms Math exit. Everything resets per problem.                                                                                                                                                                                          |

### 2.5 Motion brief (Reanimated; Reduce Motion in brackets)

The deal is one rule: **flower k** (k = 0 … T−1) leaves the **last** occupied pile cell and lands on plate `(k mod B) + 1`, in that plate's next free cell (columns of 5, top to bottom, left column first). So round r puts one flower on every plate, left to right, and the pile shrinks from its end.

| Motion        | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal deal   | Launch at `k × 120 ms + floor(k / B) × 100 ms` (a 100 ms breath between rounds). Flight 320 ms, `Easing.out(Easing.cubic)` on progress p: x lerps; y lerps minus an arc `4 · h · p · (1 − p)`, h = 32 pt (tablet 40); scale lerps `s / 20` → 1. Landing: scale 1 → 1.12 (80 ms) → spring to 1 (stiffness 300, damping 14). [Fade: the pile flower fades out 120 ms as its plate cell fades in 120 ms, same schedule, no travel or scale.] |
| Hint-2 round  | The first B flowers only, launched 300 ms apart, same flight. [same fade]                                                                                                                                                                                                                                                                                                                                                                 |
| Fast deal     | On a right tap with flowers left: interval `min(50, 900 / left)` ms, flight 220 ms, no round breath, so it ends within about 1.1 s. [one 200 ms crossfade for all]                                                                                                                                                                                                                                                                        |
| Instant       | The given answer: every flower left moves straight to its cell together, 200 ms `EASE_OUT`, no arc. [200 ms crossfade]                                                                                                                                                                                                                                                                                                                    |
| Tag fill      | After the last landing: "?" fades out (100 ms), then the numeral springs 0.6 → 1 (stiffness 260, damping 20) while the pill turns `colors.myPink` and the dashed border fades. Plate k starts at `80 × (k − 1)` ms. [200 ms crossfade]                                                                                                                                                                                                    |
| Pulse, ripple | Multiply's (§ 7 of its spec): 1 → 1.06 → 1 over 300 ms `EASE_IN_OUT`, 150 ms stagger for the plates. The total-tag pulse is 1 → 1.1 → 1. [no scale]                                                                                                                                                                                                                                                                                       |

- **Durations** (normal deal, the whole pile): 6 on 2 plates is about 1.2 s; 12 on 3 about 2.1 s; 20 on 4 (the longest) about 3.0 s.
- **Implementation:** the pile and the moving flowers are one absolutely positioned layer of T `FlowerGlyph`s (each flower's home is its pile cell; its target is its plate cell). There is one shared value per flower, scheduled with `withDelay` on the UI thread, so there are no JS timers. It animates at most 20 transforms at once: no bundle or battery concern beyond today's ripples.
- **A layout change mid-deal** (rotation) lands every flower already launched at once; the rest keep their schedule in the new layout.
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
- **One idea per step.** _each_ is a new word for her (§ 6.3). One question shape lets the word settle before the reverse question uses it.
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
| 1   | tent | nt  | e     | structure | dog, cup       | nest, tap    | nest: the same vowel and last letter, so the middle decides; tap: t                |
| 2   | hand | nd  | a     | body-part | bus, pot       | hat, pond    | hat: the same start _ha_; pond: the same ending _nd_                               |
| 3   | gift | ft  | i     | object    | sun, pot       | gem, fig     | gem: g; fig: the letters f, i, g in another order                                  |
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
- **Dave's other twins:** _kit_ has no picture, and _cane_ is weak vocabulary for her (and _can / cane_ needs a new picture).
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
