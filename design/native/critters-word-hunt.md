# Letter critters: the word hunt, phase 1 (three-letter rounds) (native build spec)

**Ask (Thomas, 2026-10-25, verbatim):** "a game to find all the possible combinations for 3 letter words with the letters available. When she finds all she should get rewarded and be able to move on to 4 letter words and so on. should be visible that its about X letter words", then "maybe just 95% of all the availabl words".

**Decided by popup (Thomas, 2026-10-25):** "Phase 1 first": the three-letter hunt only. Phase 2 (four-letter rounds, the four-seat log, the length picker) comes later. This spec leaves room for it (§ 9) and does not design it.

**Rules: Dave's ruling of 2026-10-25,** committed verbatim with this spec as `design/research/critters-word-hunt-2026-10-25.md` (it came by Orca dispatch and was not in the repo). It sets the round, the words that count, the 95 % rule, finding, the reward, persistence and the spend. This spec quotes it as "Dave (n)" by his section numbers and does not restate his evidence. **The reward ruling** (Dave, 2026-10-25: the joy beat, and a picture word's praise on its first build in a visit) ships in Devon's PR #695 (`devon/critters-mom-words`); this spec assumes it and changes none of it.

**Parent spec:** `design/native/play-place.md` § 3 (Letter critters). Everything there holds for the hunt unless this spec says otherwise: the frame and `A` (§ 1.7), the critters' look and sizes (§ 3.2), the moves, runs and outcomes (§ 3.3), the sounds (§ 3.4), the drag hint and the open line (§ 3.3).

**Standing rules:** any learner of about 6-9 (Marian is one); every spoken line and label is a row in a table, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first; never a red X. **Only shipped poses, effects and sounds; no new audio.** The 4 new pictures (mug, sad, mud, hug) are made separately (§ 7).

**Scope:** spec only. No code, no renders, no paid calls, no tickets.

**Amended 2026-10-26 (build 23).** Thomas on build 23, as the coordinator's brief relays him: "the critter word boxes should have the picture of the word so it's not so hard". Dave ruled (his (A), committed verbatim as `design/research/build23-games-2026-10-26.md`, quoted here as "Dave 23 (A).n"): every slot belongs to one target from the deal, in board order, and shows that word's picture, or a drawn listen mark when it has none; a tap on any slot plays its word. **§ 15 designs it** (Dave's "Kyle next" items 1-5). The sections it changes are edited in place and marked "(amended 2026-10-26, § 15)": § 1, § 2.2, § 2.4 (the phone rows), § 4.1, § 4.3, § 4.6, § 5.1, § 6.1-§ 6.4, § 7, § 10 and § 12. Four-letter rounds (Dave 23 (B)) are a later job and are not designed here.

## Goal

A learner past blending sounds opens Letter critters and sees six critters, a log with a "3" on its end, and a row of three-box slots, each showing the picture of a word to find (or a listen mark she can tap to hear it). Each word she builds lands in its own slot. When all but one are found, Emma celebrates the round, and a "new letters" button lets her start another when she wants to.

## User state entering

She tapped the Letter critters tile in the Play place (`play-place.md` § 1.3). Blending sounds (`blending-cv`) is current or mastered for her (§ 8). She may have a round in progress from an earlier visit (§ 6.4).

## Decisions (this spec's own calls, with reasons)

1. **A sibling spec, not a new section of `play-place.md`.** That file is about 850 lines, and PR #695 is editing its § 3.1, § 3.5, § 4.1 and Decision 6 right now. A sibling spec avoids a conflict. `play-place.md` § 3 gets one pointer paragraph in this PR; the build PR makes its other amendments (§ 11).
2. **The meadow is 2 rows of 3 on every form.** Six critters do not fill a row on a phone in portrait (6 × 56 + 5 × 8 = 376 > 343), and 5 + 1 looks broken. A 3 × 2 block also keeps every drag from the meadow to the log short.
3. **Portrait stacks and landscape sits side by side,** the raft's rule (`play-place.md` § 2.2). In portrait the board sits above the log, near Emma. In landscape the log and meadow sit on the left, next to Emma, and the board sits on the right.
4. **One slot shape, the picture over three tiles, in four sizes.** The layout takes the largest size that fits `A` (§ 2.2). A single size cannot fit both a 1180 × 820 iPad and a 1024 × 768 one, so the slot steps down instead. No critter is shrunk: `c` stays as `play-place.md` § 3.2 sets it.
5. **The bonus chip sits beside the meadow in portrait and in the board's next cell in landscape,** not beside the slot row as Dave (2) puts it. With 8 slots there is no room beside the row on a phone in either orientation (§ 2.3). The chip still has no empty place: nothing is drawn until the first extra.
6. **A found word flies to its slot.** Its picture card shrinks into the slot's picture box, and its three letters fly from the seats into the boxes. This shows her where the word went without a line. The fill makes no sound: the joy beat is the reward, and the shelf's clear stays silent (`play-place.md` § 3.5).
7. **The hint glow is static.** It fades in and stays, with no pulse, because every motion answers a touch or a line (`play-place.md` § 1.6) and a pulse would nag (Dave's safeguards).
8. **No hint after the round is complete.** The last slot is still findable but stays plain, so nothing pulls her to "get them all". Dave (3) names that distress as the thing to watch.
9. **Emma ends the beat in `cheering`.** She is `celebration` through the lap (Dave (3) step 2) and `cheering` from "You did it!". This makes the round's end the game's biggest Emma, above a non-word's `cheering` with a boing, which the reward ruling found was the biggest today.

---

## 1. Content and core (Dave's rules, made testable)

The rules are Dave (1)-(4) and (7). **The names below were proposals;** the build PR (one PR, core and UI) pinned them in `packages/core/src/games/critterHunt.ts`, with the additions listed in § 14.

| Name (proposed)                               | Shape                                                              | Meaning                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HUNT_FAMILIAR`                               | `ReadonlySet<string>`                                              | Dave's pinned 68 familiar words, exactly as Dave (1) prints them                                                                                                                                                       |
| `huntVowels(progress)`                        | `(Progress \| null) => string[]`                                   | Her taught short vowels in teaching order: _a_ once `blending-cv` is current or mastered; _o_, _u_, _i_, _e_ once `cvc-words-short-o/u/i/e` is. Marian today: `['a', 'o']` (Dave (1), from Kevin's read of her backup) |
| `huntDeal(vowels, rng, { last, probeGuard })` | `=> HuntRound`                                                     | A round by Dave (1): draw-and-accept with pinned fallbacks per vowel, as `raftShore` does                                                                                                                              |
| `HuntRound`                                   | `{ letters: string[]; targets: string[]; extras: string[] }`       | `letters`: 1 vowel then 5 consonants a-z (the meadow order, `play-place.md` § 3.2). `targets`: 5-8. `extras`: 0-3                                                                                                      |
| `huntComplete(round, found)`                  | `=> boolean`                                                       | True once `floor(0.95 × N)` targets are found, which is N − 1 for N 5-8 (Dave (1)). Extras never count                                                                                                                 |
| `huntHintTarget(round, found)`                | `=> string \| undefined`                                           | (amended 2026-10-26, § 15) The first empty slot's word: the first unfound target in board order (§ 15.2). Was: picture words a-z, then the other targets a-z                                                           |
| `huntBoardOrder(round)` (new, § 15.2)         | `=> string[]`                                                      | The targets in board order: picture words with a blend clip a-z, then the other targets with a picture a-z, then the targets with no picture a-z (Dave 23 (A).1). Slot i holds word i from the deal                    |
| `HuntRecord`                                  | `{ letters; targets; extras; found: string[]; complete: boolean }` | The stored round (Dave (7)). `found` holds targets and extras in find order (Q1). Kevin picks the key, in the learner-scoped store                                                                                     |

- **Spellable:** the vowel at most once (it has no twin, § 2.5); a consonant at most twice (its twin, so _dad_, _mom_ and _pop_ work).
- **A picture** counts toward "at least 3 with a picture" only when the app bundles it. _mum_ uses `mom.webp` (Dave (6)). _mug_, _sad_, _mud_ and _hug_ count once their files land (§ 7). Until then they are familiar targets with no picture (Q11).
- **Writes:** the record is written when a round is dealt, on each new find (target or extra), and when "new letters" deals a fresh one. Dave (7) says "on each new find and on each unlock". The write at the deal is mine: without it a round dealt but left before a first find cannot be "never the same letter set as her last round" (Q9). It is toy state only: no `saveProgress`, mastery, Leitner, stardust, history, streak or cloud sync (Dave (7)). The seen-record write in `critterSeen.ts` is unchanged.

---

## 2. The scene and its sizes

### 2.1 Parts

| Part             | What                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Block**        | The log band over the meadow, `g` apart, exactly as `critterScene` (`mobile/src/screens/play/playGeometry.ts:262-330`) with `perRow` 3 and 6 critters: `c` 56 / 48 / 88 and `g` 8 / 8 / 16 (`:268-269`)                                                                                                                  |
| **Log band**     | 3 seats of 1.25 c, `g` apart, on the log (`#c98a55`, border 2 `#7d4a26`, 24 tall, `LetterCritters.tsx:618-635`, `:1178-1183`). Width `3 × 1.25c + 2g + 32`, as now                                                                                                                                                       |
| **Numeral disc** | The log's left end, with the round's length (§ 3.2)                                                                                                                                                                                                                                                                      |
| **Meadow**       | 6 burrows, 3 per row, 2 rows: `3c + 2g` wide, `2c + g` tall                                                                                                                                                                                                                                                              |
| **Board**        | N slots (N = the round's targets, 5-8), plus the bonus chip's cell in landscape                                                                                                                                                                                                                                          |
| **Bonus chip**   | The extras she has found, at most 3 (§ 4.5)                                                                                                                                                                                                                                                                              |
| **Picture card** | When a word pops: `p = min(block height, block width, 200 phone / 300 tablet)`, centred over the block (log band and meadow). Today it is centred over the meadow (`playGeometry.ts:311`). With 6 critters the meadow is only 104-192 tall, so the hunt centres the card on the block instead. It never covers the board |
| **New letters**  | After completion only, beside Back (§ 5)                                                                                                                                                                                                                                                                                 |

### 2.2 The slot and its size ladder

A slot is a small cream card with its picture box over three tile boxes: the log's three seats in miniature.

```
  stacked slot (every form)           W = 3b + 2gb + 2pad
  +----------------------+            H = pad + T + pad + b + pad
  |       +------+       |  pad
  |       | pic  |  T    |            card: cream #fff8ee, ledge 2 pt #e3c6a6 (the Hub bubble's,
  |       +------+       |  pad              play-place.md:66), radius 0.18 H
  |  [ b ][ b ][ b ]     |  b         box, empty: #efe2d0, inset border 1.5 pt #d9bfa0, radius 0.22 b
  +----------------------+  pad       tile, found: pink #FFC0CB (vowel) or honey #f2c27a (consonant),
       gb apart                             ledge 1.5 pt #F48FB1 / #b27b37, letter Fredoka 700 at
                                            0.62 b in #6b3f1f (5.8 : 1 / 5.4 : 1, play-place.md:445)
                                      picture box: white, radius 0.18 T, the pack picture `contain`
                                        (amended 2026-10-26: drawn to the full box, clipped to its
                                        radius, from the deal; § 15.3)
```

| Step | b   | gb  | pad | T   | Slot W × H | Bonus tile `bx` | Used by                       |
| ---- | --- | --- | --- | --- | ---------- | --------------- | ----------------------------- |
| S1   | 40  | 4   | 8   | 72  | 144 × 136  | 28              | tablets, first try            |
| S2   | 32  | 4   | 8   | 56  | 120 × 112  | 24              | tablets where S1 does not fit |
| S3   | 28  | 3   | 6   | 44  | 102 × 90   | 20              | tablets where S2 does not fit |
| S4   | 22  | 2   | 3   | 36  | 76 × 67    | 16              | phones (the only phone step)  |

**S4 amended 2026-10-26 (§ 15.10):** it was pad 4, T 32, 78 × 66. The picture is now the cue, and at 32 (drawn at 27.5) the thin-line pack pictures did not read. Pad 3 and T 36 is the largest picture box that still fits the tightest phone, 844 × 390 (T 37 fails there for N 6-8).

**The fit rule** (per orientation, re-run on rotation): a tablet takes the first of S1, S2, S3 for which every N from 5 to 8 passes; a phone takes S4. A size passes when every part lies inside `A`, burrows included (a burrow hangs 0.04 c below its cell, `LetterCritters.tsx:687-695`). It must also keep each slot clear of every other slot, the log band, the numeral disc, every seat's drop zone (the seat grown by 0.2 c, `play-place.md` § 3.3), every meadow cell and the bonus chip, and keep the picture card off the board. Measured this way, every viewport below passes (§ 2.4).

**Letters:** 25 pt (S1), 20 (S2), 17 (S3), 14 (S4); in the bonus chip 17, 15, 12, 10 (0.62 `bx`). Every slot is a touch target of at least 76 × 67 on phones and 102 × 90 on tablets, well over 44 pt.

### 2.3 Arrangement

**Portrait (phone P, tablet W):** the board, then the block, centred together in `A`, with a gap of 12 (phone) or 24 (tablet) between them. The board has 4 columns, `sg` apart (6 phone, 16 tablet). The top row holds `ceil(N/2)` slots and the bottom row `floor(N/2)`, each row centred: 5 is 3 + 2, 6 is 3 + 3, 7 is 4 + 3, 8 is 4 + 4. The bonus chip sits beside the meadow on its right, `g` from it, bottom-aligned with the meadow. Its extras are stacked in a column, the newest at the bottom.

**Landscape (phone L, tablet TL):** the block on the left and the board on the right, `gap = min(24, A.width − block width − board width)` apart, the pair centred in `A`. Each is centred vertically on its own. The board has 3 columns, `sg` apart. Its cells are the N slots, then one cell for the chip, in rows of 3, each row centred. So 5 slots are 3 + (2 + chip), 6 are 3 + 3 + (chip), 7 are 3 + 3 + (1 + chip) and 8 are 3 + 3 + (2 + chip). The chip's cell is reserved but draws nothing until the first extra, so slots never move. The chip centres in its cell, extras stacked in a column.

**Why not one chip rule:** in portrait the chip has 71.5 pt beside a phone's meadow (`(343 − 184) / 2 − 8`). In landscape a phone's block is 188 tall in an `A` as short as 214.2 (844 × 390, below), which leaves no room under the meadow.

### 2.4 Measured at the floors and the play-place tablets

Measured on 2026-10-25 by a scratch script (not committed) that calls `mathLayout` and `playArea` from `origin/main` 5c253593 and lays out § 2.2-2.3 for N 5-8. Insets are as `play-place.md` § 3.2 uses them, plus two notched phones. Rects are (x, y) w × h, for N = 8. **The four phone rows were measured again on 2026-10-26** for the amended S4 (§ 15.10), by a scratch script (not committed) that calls the shipped `mathLayout`, `playArea`, `huntScene`, `huntSceneFits` and `chipRect` at `origin/main` fe366267 with `SLOT_STEPS[3]` set to pad 3, T 36. With today's S4 the same script gives exactly the old phone rows, so the method matches. The tablet rows do not change (S1-S3 are unchanged).

| Viewport (insets)     | `A`                      | Step | Board (N 8)              | Log band                 | Meadow                   | Chip zone (3 extras)      | Picture card       |
| --------------------- | ------------------------ | ---- | ------------------------ | ------------------------ | ------------------------ | ------------------------- | ------------------ |
| 375 × 667             | (16, 259) 343 × 376      | S4   | (26.5, 264) 322 × 140    | (58.5, 416) 258 × 86     | (95.5, 510) 184 × 120    | (287.5, 570) 58 × 60      | (87.5, 423) 200    |
| 667 × 375             | (160, 146.4) 491 × 216.4 | S4   | (411, 148.1) 240 × 213   | (160, 160.6) 228 × 76    | (194, 244.6) 160 × 104   | (584, 297.6) 58 × 60      | (180, 160.6) 188   |
| 390 × 844 (t47 b34)   | (16, 327) 358 × 451      | S4   | (34, 369.5) 322 × 140    | (66, 521.5) 258 × 86     | (103, 615.5) 184 × 120   | (295, 675.5) 58 × 60      | (95, 528.5) 200    |
| 844 × 390 (l/r47 b21) | (227, 143.9) 554 × 214.2 | S4   | (510, 144.6) 240 × 213   | (258, 157.1) 228 × 76    | (292, 241.1) 160 × 104   | (683, 294.1) 58 × 60      | (278, 157.1) 188   |
| 820 × 1180 (t24 b20)  | (16, 442.8) 788 × 685.2  | S1   | (98, 462.4) 624 × 288    | (213, 774.4) 394 × 126   | (262, 916.4) 296 × 192   | (574, 992.4) 108 × 116    | (260, 791.4) 300   |
| 1180 × 820 (b20)      | (245.2, 231) 918.8 × 537 | S1   | (681.6, 279.5) 464 × 440 | (263.6, 332.5) 394 × 126 | (312.6, 474.5) 296 × 192 | (1019.6, 593.5) 108 × 116 | (310.6, 349.5) 300 |
| 1180 × 820 (t24 b20)  | (245.2, 255) 918.8 × 513 | S1   | (681.6, 291.5) 464 × 440 | (263.6, 344.5) 394 × 126 | (312.6, 486.5) 296 × 192 | (1019.6, 605.5) 108 × 116 | (310.6, 361.5) 300 |
| 834 × 1194 (t24 b20)  | (16, 446.4) 802 × 695.6  | S1   | (105, 471.2) 624 × 288   | (220, 783.2) 394 × 126   | (269, 925.2) 296 × 192   | (581, 1001.2) 108 × 116   | (267, 800.2) 300   |
| 1194 × 834 (t24 b20)  | (248.8, 255) 929.2 × 527 | S1   | (690.4, 298.5) 464 × 440 | (272.4, 351.5) 394 × 126 | (321.4, 493.5) 296 × 192 | (1028.4, 612.5) 108 × 116 | (319.4, 368.5) 300 |
| 744 × 1133 (t24 b20)  | (16, 430.6) 712 × 650.4  | S2   | (108, 456.8) 528 × 240   | (175, 720.8) 394 × 126   | (224, 862.8) 296 × 192   | (536, 950.8) 96 × 104     | (222, 737.8) 300   |
| 1133 × 744 (t24 b20)  | (225.4, 255) 891.6 × 437 | S2   | (684.2, 289.5) 392 × 368 | (266.2, 306.5) 394 × 126 | (315.2, 448.5) 296 × 192 | (968.2, 549.5) 96 × 104   | (313.2, 323.5) 300 |
| 810 × 1080 (t24 b20)  | (16, 416.8) 778 × 611.2  | S2   | (141, 423.4) 528 × 240   | (208, 687.4) 394 × 126   | (257, 829.4) 296 × 192   | (569, 917.4) 96 × 104     | (255, 704.4) 300   |
| 1080 × 810 (t24 b20)  | (242.6, 255) 821.4 × 503 | S2   | (666.3, 322.5) 392 × 368 | (248.3, 339.5) 394 × 126 | (297.3, 481.5) 296 × 192 | (950.3, 582.5) 96 × 104   | (295.3, 356.5) 300 |
| 768 × 1024 (t24 b20)  | (16, 402.2) 736 × 569.8  | S3   | (156, 410.1) 456 × 196   | (187, 630.1) 394 × 126   | (236, 772.1) 296 × 192   | (548, 880.1) 78 × 84      | (234, 647.1) 300   |
| 1024 × 768 (t24 b20)  | (231.7, 255) 776.3 × 461 | S3   | (659.8, 334.5) 338 × 302 | (241.8, 318.5) 394 × 126 | (290.8, 460.5) 296 × 192 | (907.8, 549.5) 78 × 84    | (288.8, 335.5) 300 |

- The `A` values at the four floors equal `play-place.md:198-201`, and the 22-critter table's (`:468-478`) where they overlap.
- **The tight one is a notched phone in landscape** (844 × 390, `A` 214.2 tall). The board is 213 (3 rows of 67, 6 apart): 1.2 to spare (amended 2026-10-26; it was 210 and 4.2 with 66-tall slots). That is why phone slots are 6 apart, not 8, and why T stops at 36.
- The 744 × 1133 mini takes S2 in portrait, because with S1 its bottom burrows would hang 1.3 pt below `A`.
- **Not measured:** other phones (wider phones only gain room), the 1366 × 1024 class, split view. On a viewport where S3 fails, the build logs `[layout]` and uses S3 anyway; I found none (§ 10.4).

### 2.5 The vowel's burrow (no twin)

The round's vowel has no twin (Dave (1)). Dragging it out of its burrow pops nothing (`play-place.md` § 3.3: a consonant still pops its twin, `LetterCritters.tsx:1029`). While the vowel is anywhere but home (dragged, seated, or falling at the shelf's clear), its burrow shows:

- the burrow's dark oval, as always (`rgba(61, 33, 18, 0.35)`, 0.8 c × 0.26 c at the cell's foot, `LetterCritters.tsx:687-695`);
- **a dashed ring where the critter sits:** a circle of `c`, 2 pt stroke `#F48FB1` (the vowel's ledge, `colors.myRose`) at 60 % opacity, dashes 6 on 4, no fill. It fades in over 150 ms when the vowel leaves and out over 150 ms as it lands home.

The ring is not a target: a tap on it does nothing, and a drop on it sends the vowel home, as any drop that lands nowhere does. `testID="critter-burrow-empty-<v>"`, `accessible={false}`. A seated vowel dragged to another seat swaps or moves as today. Only one vowel exists, so a run can hold it once.

---

## 3. The log

### 3.1 Unchanged

Seats, drops, swaps, the 400 ms sing delay, a tap replaying the run: all as `play-place.md` § 3.3. Pairs lean and wait. Quiet, never-say and non-word runs keep their outcomes (§ 4.4).

### 3.2 The numeral on the log's end

A round end-grain disc carved with the round's length, the "X" of "X-letter words" (Dave (5)):

- **Size and place:** diameter `D` 32 on phones and 40 on tablets. Its left edge is on the log's left edge (`log.x`), and it is centred on the log vertically. On a phone it runs from `log.y − 4` to `log.y + 28`. It overlaps only seat 1's empty lower-left corner (a round critter leaves the corner of its seat empty) and draws under the seated critters. It stays inside the log's footprint, so the four-seat log of phase 2 keeps Dave's 3.5 pt a side on a phone in portrait (Dave (4); `play-place.md:453-460`).
- **Look:** face `#f2d3a6` (lighter Number Garden wood), border 2 pt `#7d4a26` (the log's), the numeral "3" in Fredoka 700 at 0.62 D (20 pt / 25 pt) in `#6b3f1f`: 6.2 : 1 (WCAG ratio computed from the hex values, 2026-10-25).
- **Behaviour:** none of its own. It is part of the log's touch target (a tap replays the run, as the log does) and of its accessibility element (§ 6.3). It never animates. `testID="critter-log-numeral"`.
- **Every slot has 3 boxes,** and the log has 3 seats. The length shows three ways without a word (Dave (5)). The open line already names "three" (`play-place.md` § 3.3).

---

## 4. Finding

### 4.1 A new target

The outcome plays exactly as the reward ruling has it: the picture word's clip and pop, or Emma saying the said word; then the joy beat, and a picture word's praise on its first build in the visit. Then **the fill**, at the moment the shelf table says the outcome is over (`play-place.md` § 3.3):

| Run                         | The fill starts (= the outcome is over)                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Picture word                | when the picture would leave: the later of clip end + 2400 and the praise's end + 400 (reward ruling) |
| Said word with a picture    | when its picture would leave: Emma's line end + the 2400 hold                                         |
| Said word without a picture | Emma's line end + 1200 (the joy beat's hold, reward ruling)                                           |

| t (ms from fill start) | What happens                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                      | **The slot is the word's own slot** (amended 2026-10-26, § 15.6: slot i holds board word i from the deal; it was the next empty one, in find order). The picture card, if any, shrinks from `p` onto the slot's own picture and moves there (500 ms, ease in-out): this replaces the float-away. Emma `idle`. |
| 0, 60, 120             | Three tiles lift off the seated critters, left to right. Each starts at its critter's centre at 0.6 × the seat and flies to its box, shrinking to `b` (500 ms, ease in-out). A tile is already in its final colour.                                                                                           |
| 620                    | The last tile lands. The tiles settle (scale 1.08 → 1, 120 ms).                                                                                                                                                                                                                                               |
| 620 + 400              | The shelf clears as today (`SHELF_HOLD_MS` 400, `SHELF_DROP_MS` 400, `LetterCritters.tsx:130-132`). The vowel lands in its ringed burrow (§ 2.5).                                                                                                                                                             |

No sound and no line at the fill (Decision 6). (Amended 2026-10-26, § 15.3: the slot already shows its picture, or its listen mark, from the deal, and keeps it after the fill; found means tiles in the boxes. It was: the picture shows from the fill on, and an unpictured word leaves the box blank cream.) **What is left is shown by the empty slots alone** (Dave (2)): no count, numeral, meter or line about how many remain.

### 4.2 A repeat find

A target already on the board: its outcome plays (joy beat, no praise: once per word per visit, reward ruling). At the joy beat's start, its slot **wiggles**: rotate 0 → −5° → +5° → −3° → 0, 100 ms a step (400 ms), around the slot's centre. A corner moves at most about 6 pt, and slots are 6 or more apart. At the same moment its tiles light with the lit pulse (1 → 1.15 → 1, 400 ms, `play-place.md` § 3.3). A picture leaves by its float-away as today, not into the slot. No fill, no line.

### 4.3 Tapping a slot

- **A filled slot** plays its word and lights its tiles (the lit pulse). For a picture word that is the word part of its blend clip, `wordWindow(segments)` (`mobile/src/audio/blendMarks.ts:104-110`, the lesson's picture-tap window). For any other target it is its whole `critterWordLine` clip, sound only: no caption and no pose (the slot is the text). A second tap cuts and restarts. Q4.
- **An empty slot** (amended 2026-10-26, § 15.5) plays its word, sound only, with no caption; the glowing one plays the hint (§ 15.7). It was: does nothing, unless it is the hint.
- While the board waits (from a run's first sound until the shelf clears, `play-place.md` § 3.3) and during the completion beat, slot taps are ignored. Back stays live.

### 4.4 Runs that never fill a slot

Never-say words (built, inert, uncounted; Dave (1)), non-words (boing and a line from blending sounds on, `play-place.md` § 3.3) and pairs: all unchanged. A quiet (`CRITTER_NOT_SAID`) word cannot be built in a hunt round, because the deal rejects letters that spell one (Dave (1)).

### 4.5 Extras and the bonus chip

An extra (a said word that is not a target, Dave (1)) plays its outcome as any said word: Emma says it, then the joy beat. At the same moment as a target's fill it **joins the bonus chip**. On the first extra the chip appears (fade and scale 0.8 → 1 on a 300 / 22 spring, 200 ms). Later extras stack in it, the newest at the bottom, each as three small tiles (`bx`, same colours). A repeat extra lights its tiles in the chip.

- **Look:** a flat chip in pale honey (`#f2c27a` at 35 %), radius 0.25 `bx`, no ledge, so it reads as something other than a slot (slots are cream clay). No picture box, no sparkle glyph, no star, no number.
- **Not a button:** a tap does nothing. Extras are "never required, and nothing says how many exist" (Dave (1)), and the chip stays a quiet record. `testID="hunt-bonus"`.
- **Place:** § 2.3. Nothing is drawn for it before the first extra.

### 4.6 The hint glow

- **When:** after 5 runs of three in a row without a new target (extras, repeats, never-say words and non-words all count as "without"), or 45 s without a drag start. Both counts start once the drag hint is retired, which happens at her first run of three in a visit (`play-place.md` § 3.3), so the two hints never show together. The numbers are Dave's, to tune on device (Dave (2)): `HUNT_HINT_RUNS` 5, `HUNT_HINT_IDLE_MS` 45000.
- **What:** the first empty slot gets a static glow: a 4 pt (phone) or 6 pt (tablet) ring outside the card in honey `#f2c27a` at 90 %, with a 10 pt soft honey shadow. It fades in over 300 ms, with no sound, no line and no pulse (Decision 7). One glow at a time. `testID="hunt-slot-<i>"` with `accessibilityState` selected while it glows.
- **Tap** (amended 2026-10-26, § 15.7): plays the glowing slot's word as sounds, then the word: a picture word its whole blend clip, any other target its three critter sounds in order, then its word clip. Sound only, Emma `attentive-pointing` while it plays, then `idle`. **The 35 % ghost is gone:** the picture is already in the slot. Taps cut and replay it. It was: `huntHintTarget`'s whole blend clip or word clip, and a 35 % ghost of its picture from the first tap.
- **Ends** when any new target is found (amended 2026-10-26, § 15.7: that target fills its own slot, which may be another one; the glow fades out over 200 ms as the fill starts, and both counts restart). No hint after completion (Decision 8).

---

## 5. Completion

### 5.1 The beat (Dave (3), 0 new audio, the same every time)

`C0` = the moment the completing find's shelf has cleared (its three are home, the log is empty).

| t                     | What happens                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C0                    | The board locks: critters, log and slots ignore touch; Back stays live. Emma `celebration`.                                                                                                                                                                                                                              |
| C0 + 300              | **The lap** (amended 2026-10-26, § 15.6: board order, not find order). The first found slot in board order lights: the hint's ring fades in over 150 ms, the tiles take the lit pulse, and it plays its word, as a slot tap does (§ 4.3: `wordWindow` for a picture word, the whole word clip otherwise, no caption).    |
| each word's end + 250 | Its ring fades out over 200 ms, and the next found slot lights and plays, in board order (empty slots are skipped), until every found slot has played once.                                                                                                                                                              |
| last word's end + 300 | Emma `cheering` and says **"You did it!"**: Word Song's `session.end.opener`, the bundled canon clip keyed by that text (`mobile/src/audio/canonAudioRegistry.ts:1575`), with its caption in her ribbon. It plays through the canon-text seam the praise clips need (`kit.speak` takes a `PlayLineId`, `playKit.ts:56`). |
| its end               | `sfx.cheer` (0.5, `playKit.ts:34`) and **the burst**: Word Song's six-sparkle burst (`WordChip.tsx:11-13`, `:40-63`, `SPARKLE_BURST_MS` 850 at `:33`) from the board's centre, distance 75 × k and glyph 16 × k, with k = 1 on phones and 1.5 on tablets. It draws over the slots. `testID="hunt-burst"`.                |
| its end + 900         | (The cheer is 862 ms, Dave's afinfo.) Emma `idle`. The board unlocks. **New letters** enters beside Back (§ 5.3).                                                                                                                                                                                                        |
| (phase 2)             | On her first complete three-letter round while "4" is not open, the four-seat log's roll-in plays here, before New letters: `critters-four-letter.md` § 6 (built 2026-10-27).                                                                                                                                            |

**Length:** 0.3 s + the lap + 0.3 s + "You did it!" + 0.9 s. The lap's words are about 0.5-0.9 s each plus 0.25 s gaps (an estimate: I did not measure the clips). With 4-7 found words the beat is about **6-9 s**, against Dave's "about 8-10 s". The beat plays once per round, never on a return (§ 6.4). Nothing in it says "again", "next", "more" or "round" (AC C8 holds, Dave (3)).

### 5.2 The board after the beat

The board stays as it is: every found slot filled, the last slot empty and **still findable**. Finding it gives its usual outcome and fill, with no second beat, no hint and no line. Then the board is full and nothing else happens. Nothing starts on its own, and no "one more?" line plays (Dave (3)).

### 5.3 New letters

| Form            | Rect               | Why there                                                                                                                   |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| P (375 × 667)   | (88, 8) 56 × 56    | Back is (16, 8) 56 (measured, `backRect`, `playGeometry.ts:29-39`); 16 apart, in the empty HUD status rect (88, 8) 271 × 56 |
| L (667 × 375)   | (88, 8) 56 × 56    | Back (16, 8) 56; Emma's frame starts at y 72 and the ribbon at x 160                                                        |
| W (820 × 1180)  | (114.7, 34.7) 74.7 | Back (16, 34.7) 74.7; 24 apart in the HUD row (0, 24) 820 × 96; Emma's frame starts at y 120                                |
| TL (1180 × 820) | (114.7, 10.7) 74.7 | Back (16, 10.7) 74.7; the HUD row (0, 0) 1180 × 96; Emma's frame starts at y 96                                             |

The rule is Back's rect, moved right by Back's size + 16 (phone) or + 24 (tablet).

- **Look:** Back's size (`PHONE_BACK` 56, `TABLET_BACK` 74.7, `mathLayout.ts:70-71`) and Home's clay shape, ledge and press (`HomeButton`, `mapChrome.tsx:32`). Its face is Word Song honey (`LOOK['word-song']`, as the critters' tile, `play-place.md:120`), and it holds the shipped clay piece `ui-critters` (`mobile/src/assets/registry.ts:333`) at `Math.round(68 × size / 96)`: 40 pt in the phone disc and 53 pt in the tablet disc, as Home draws its house (`play-place.md:66`). It shows the Letter critters picture: fresh critters. No text, no badge, no idle motion, no glow.
- **When:** only after the beat (§ 5.1), and until it is tapped. Never before completion; on a return to a complete round, a fresh deal (§ 6.4) means it is not there.
- **Entrance:** fade in and scale 0.6 → 1 on the picture's 260 / 16 spring (`play-place.md:497`). No sound and no line.
- **Tap:** Home's press (6 × k over 120 ms), plink (0.3), any line cut. Then the board, the chip and the meadow fade out (200 ms), and a fresh deal fades in (300 ms) with its N empty slots. The disc goes with the old board. No line, no beat, no drag hint (she has made a run this visit). The hint counts restart and the record is replaced.
- `accessibilityRole="button"`, label "New letters", `testID="hunt-new-letters"`.

---

## 6. Wireframes, motion, Reduce Motion, VoiceOver

### 6.1 Wireframes (positions from § 2.4; the art is not to scale, the annotations are)

**Superseded 2026-10-26 by § 15.8** for what a slot shows (a picture or listen mark in every slot, words in board order) and for the phone positions (§ 2.4's amended rows). The four below are kept as the record of phase 1's first build.

The two sample rounds are real rounds by Dave (1), computed on 2026-10-25 by a scratch script over `playPlace.ts` at `origin/devon/critters-mom-words` cb4d108b with Dave's familiar list. **Build note:** that was before Dave (6)'s quiet words landed; with them both rounds spell a quiet word (_ant_, _act_), so neither is dealt. The wireframes still show the layout correctly; the build's seeded round is a b g h p t (§ 14). **a c f m n t:** targets can, cat, fan, fat, man, mat (5 with a picture; _fat_ has none); extras nan, tan. **a b c m p t:** targets bat, cab, cap, cat, map, mat, pat, tap (7 with a picture; _pat_ has none); extra tab. Neither spells a quiet word, and every consonant is in a target.

```
PHONE PORTRAIT 375×667, mid-hunt
round a c f m n t (N 6): cat, fan, man found; tan a bonus; c and a seated, waiting for a third
+-----------------------------------------------+
|(<)                                            |  Back (16, 8) 56
| .-----.  +----------------------------------+ |
|( Emma  ) | ribbon (98.3, 112) 260.7          | |  Emma (-18.5, 104) 147
|(  147  ) +----------------------------------+ |
| '-----'                                       |  A from y 259
|     .---------. .---------. .---------.       |  board row 1, y 265: 3 slots of 78 × 66, 6 apart,
|     |  {cat}  | |  {fan}  | |  {man}  |       |    from x 64.5 (N 6 = 3 + 3, centred)
|     |[c][a][t]| |[f][a][n]| |[m][a][n]|       |    picture 32, tiles 22
|     '---------' '---------' '---------'       |
|     .---------. .---------. .---------.       |  row 2, y 337: empty slots, boxes only
|     |         | |         | |         |       |
|     |[ ][ ][ ]| |[ ][ ][ ]| |[ ][ ][ ]|       |
|     '---------' '---------' '---------'       |
|         (c)       (a)      [    ]             |  seats y 415, 70 each
|    (3)===============================         |  log y 473; the "3" disc (58.5, 473) 32
|              ( ) (c) (f)                      |  meadow (95.5, 509) 184 × 120, 3 per row;
|              (m) (n) (t)   .-------.          |    ( ) a's ringed burrow; c kept its twin
|                            |[t|a|n]|          |  bonus chip (287.5, 605) 60 × 24, bottom on y 629
+-----------------------------------------------+
```

```
PHONE LANDSCAPE 667×375, the hint
round a b c m p t (N 8): cat, map, bat, cab, tap found; a and t seated; slot 6 glows, tapped once
+---------------------------------------------------------------------------+
|(<)           |  ribbon (160, 56.2) 491 wide                                |
|              +-------------------------------------------------------------+
|                                            .-------. .-------. .-------.  |
|  .------.     [   ] (a) (t)                 | {cat} | | {map} | | {bat} |  |
| ( Emma   )   (3)================            |[c|a|t]| |[m|a|p]| |[b|a|t]|  |
| ( frame  )                                  '-------' '-------' '-------'  |
| ( 285.7, )      ( ) (b) (c)                 .-------. .-------. *=======*  |
| ( from   )      (m) (p) (t)                 | {cab} | | {tap} | *(cap) *  |
| ( y 72   )                                  |[c|a|b]| |[t|a|p]| *[ | | ]*  |
|  '------'                                   '-------' '-------' *=======*  |
|                                             .-------. .-------.            |
|                                             |       | |       |  (chip    |
|                                             |[ | | ]| |[ | | ]|   cell)   |
|                                             '-------' '-------'            |
+---------------------------------------------------------------------------+
 block (160, 160.6) 228 × 188: log band 76 (seats 60), meadow (194, 244.6) 160 × 104;
 board (405, 149.6) 246 × 210: 3 rows of 78 × 66, 6 apart; slot 6 is the first empty one, so
 it holds the glow and, after the tap, cap's picture at 35 %; the chip's cell (row 3, col 3)
 draws nothing until an extra
```

```
TABLET PORTRAIT 820×1180, the completion beat, mid-lap
round a c f m n t (N 6): cat, fan, man, mat, can found (5 of 6: complete); slot 3 is lit and playing
+-----------------------------------------------+
|(<)                                            |  Back (16, 34.7) 74.7
| .--------.  +-------------------------------+ |
|( Emma     ) | ribbon (338.8, 136): empty     | |  Emma (16, 120) 306.8, celebration
|( celeb-   ) | during the lap                 | |
|( ration   ) +-------------------------------+ |
| '--------'                                    |  A from y 442.8
|    .----------. .----------. #==========#     |  board S1 from (178, 462.4): rows 3 + 3
|    |  {cat}   | |  {fan}   | #  {man}   #     |    of 144 × 136, 16 apart
|    |[c][a][t] | |[f][a][n] | #[m][a][n] #     |  #==# slot 3 lit: ring + lit pulse, "man" plays
|    '----------' '----------' #==========#     |
|    .----------. .----------. .----------.     |
|    |  {mat}   | |  {can}   | |          |     |  slot 6 empty (fat): still findable after
|    |[m][a][t] | |[c][a][n] | |[ ][ ][ ] |     |    the beat
|    '----------' '----------' '----------'     |
|          [    ]   [    ]   [    ]             |  log band (213, 774.4) 394 × 126, seats 110
|     (3)=============================          |  the "3" disc (213, 868.4) 40
|            (a) (c) (f)                        |  meadow (262, 916.4) 296 × 192
|            (m) (n) (t)    .--------.          |  bonus chip (574, 1064.4) 108 × 44,
|                           |[t][a][n]|         |    bottom on the meadow's (y 1108.4)
+-----------------------------------------------+
```

```
TABLET LANDSCAPE 1180×820, after the beat
round a b c m p t (N 8): 7 found, pat still findable; tab a bonus; New letters beside Back
+------------------------------------------------------------------------------+
|(<) (✿)                                                                       |
| .------.   +-------------------------------------------------------------+   |
|( Emma   )  | ribbon (245.2, 112) 918.8 wide                              |   |
|( idle   )  +-------------------------------------------------------------+   |
| '------'                                                                     |
|                                        .---------. .---------. .---------.   |
|     [    ]  [    ]  [    ]             |  {cat}  | |  {map}  | |  {bat}  |   |
|   (3)========================          |[c][a][t]| |[m][a][p]| |[b][a][t]|   |
|                                        '---------' '---------' '---------'   |
|          (a) (b) (c)                   .---------. .---------. .---------.   |
|          (m) (p) (t)                   |  {cab}  | |  {tap}  | |  {cap}  |   |
|                                        |[c][a][b]| |[t][a][p]| |[c][a][p]|   |
|                                        '---------' '---------' '---------'   |
|                                        .---------. .---------.  .-------.    |
|                                        |  {mat}  | |         |  |[t|a|b]|    |
|                                        |[m][a][t]| |[ ][ ][ ]|  '-------'    |
|                                        '---------' '---------'               |
+------------------------------------------------------------------------------+
 (✿) New letters (114.7, 10.7) 74.7: honey clay with ui-critters, appeared after the beat
 block (263.6, 332.5) 394 × 334: log band 126 (seats 110), meadow (312.6, 474.5) 296 × 192
 board S1 (681.6, 279.5) 464 × 440: rows of 3, 144 × 136, 16 apart; the chip sits in the
 cell after slot 8 (row 3, col 3), its zone (1019.6, 593.5) 108 × 116

  (x) a critter (vowels pink, consonants honey)   ( ) the vowel's ringed burrow   [    ] an empty seat
  {cat} a slot's picture   [c][a][t] its tiles   [ ][ ][ ] an empty slot's boxes   *==* the hint's glow
  #==# the lap's lit slot   (3)=== the numeral disc on the log's end   (<) Back   (✿) New letters
```

### 6.2 Reduce Motion

Lines, sounds and their times are unchanged. Dragging still follows the finger.

| Motion                | With Reduce Motion                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The fill (§ 4.1)      | No flight. The picture card fades out where it is (300 ms, the shipped RM leave). The tiles fade in at the word's own slot (200 ms); its picture is already there (amended 2026-10-26, § 15.9) |
| Repeat wiggle (§ 4.2) | No rotation and no pulse: the slot's tiles light (120 ms in, 200 ms out, the singing light of `play-place.md` § 3.7)                                                                           |
| Slot tap, the lap     | The tiles light (fade, no pulse); the lap's ring fades in and out as written                                                                                                                   |
| The burst             | None (as Word Song: no burst on Reduce Motion, `WordChip.tsx:11-13`)                                                                                                                           |
| Bonus chip appearing  | 200 ms fade, no spring                                                                                                                                                                         |
| Hint glow             | Unchanged (it is already a fade)                                                                                                                                                               |
| New letters entering  | 200 ms fade, no spring; the deal's cross-fade is unchanged                                                                                                                                     |
| The vowel's ring      | Unchanged (fades)                                                                                                                                                                              |
| Emma                  | Pose swaps as now (`EmmaStage` zeroes the tilt)                                                                                                                                                |

### 6.3 VoiceOver labels (labels only: Lily speaks none of them)

They go beside `PLAY_LABELS` in `mobile/src/screens/play/playLines.ts:65-71`, so a language version swaps rows.

| Element                  | Label                                                                                            | Role, activate                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| A filled slot            | the word, capitalised ("Fan")                                                                    | button; plays it (§ 4.3)                |
| An empty slot            | "Word to find" (amended 2026-10-26, § 15.9)                                                      | button; plays its word (§ 15.5)         |
| The glowing slot         | "Hint"                                                                                           | button; plays the hint (§ 15.7)         |
| The bonus chip           | "Bonus words, <w>, <w>" ("Bonus words, tan")                                                     | none                                    |
| The log (hunt)           | "Log, three letters" (a four-letter round: "Log, four letters", `critters-four-letter.md` § 8.2) | button; sings the run again (was "Log") |
| New letters              | "New letters"                                                                                    | button; deals a fresh round             |
| The vowel's empty burrow | none (`accessible={false}`)                                                                      |                                         |
| The numeral disc         | none (part of the log)                                                                           |                                         |

The critters keep "Letter <x>" and "Letter <x>, on the log" (`play-place.md` § 4.2). No label states a count of found or remaining words. The beat makes no announcement.

### 6.4 Entering, leaving, rotating

- **A fresh round** (no record, or the last one complete): the open line and the drag hint, as `play-place.md` § 3.3. N empty slots, no chip, no New letters.
- **A round in progress** (Back mid-round, a learner switch, an app restart): the same letters, every slot's picture or listen mark, and each found word in its own slot (amended 2026-10-26, § 15.2; it was found slots in find order), the chip if she found extras, drawn at once with no fill motion. Only the game's own open line plays, and nothing mentions the round (Dave (7)). The praise-once set and the hint counts are for the visit only (Dave (7)).
- **Back during the beat:** the beat stops at once (the line is cut). The round is stored complete, so the next visit deals a fresh one, and she does not see the rest of the beat (Q7).
- **Background:** as `play-place.md` § 1.7. A beat step that falls due waits for the return.
- **Rotation:** the scene lays out again with the step for the new orientation (§ 2.2). Found slots, the chip, the hint and the seated critters keep their state. A motion in flight jumps to its end.

---

## 7. Assets and audio

- **New audio: none** (Dave (8)). Reused: "You did it!" (`canonAudioRegistry.ts:1575`); the praise clips, blend clips and said-word clips the reward ruling and `play-place.md` § 3.4 already bundle; `sfx.cheer` and plink (`playKit.ts:34`); the burst (`WordChip.tsx`).
- **Poses:** `idle`, `listening`, `celebration`, `cheering`, `attentive-pointing` (`packages/core/src/character/emmaPose.ts:24-32`).
- **New pictures (made separately, Dave (6)):** `mobile/assets/pictures/mug.webp`, `sad.webp`, `mud.webp`, `hug.webp`, in the pack style. Their slots are the _mug_, _sad_, _mud_ and _hug_ slots of any round that deals them. Until a file lands, that slot fills with tiles only (§ 4.1). _mum_ uses `mom.webp` (on `main`). `mug` must not read as _cup_ (a picture word, Dave (6)).
- **Drawn in the app (react-native-svg / Views):** slots, tiles, the chip, the numeral disc, the vowel's ring, the hint's glow, and (2026-10-26, § 15.4) the listen mark. **Shipped art:** `ui-critters` in the New letters disc.

---

## 8. What the free meadow keeps (before blending sounds)

Dave's gate: the hunt replaces the free meadow exactly when `critterFunnyOpen(progress)` is true (`blending-cv` current or mastered; `playPlace.ts:384`, `:392-394` at cb4d108b), read once when the game opens. **Before it, Letter critters is `play-place.md` § 3 as merged, unchanged:**

- 16 critters on a phone, all 22 on a tablet where they fit both ways (Decision 8 there), rotating between visits; every letter has a twin;
- the log as it is, with **no numeral**; no board, no slots, no bonus chip, no hint glow, no New letters, no completion beat;
- a non-word sits quietly (Dave's safeguard); picture words pop and said words are said, with the reward ruling's joy beat and praise;
- the drag hint and the open line as now;
- **zero writes** (`play-place.md` AC N5 still holds for these visits).

The day a learner reaches blending sounds, her next visit opens on a fresh hunt round with her one vowel, _a_.

---

## 9. Room left for phase 2 (not designed)

**Designed 2026-10-26 in `design/native/critters-four-letter.md`** (Dave's build-23 ruling (B), Dave 23 (D) items 6-12): the four-box board on all four forms, the 4 + 3 meadow, the four-seat log, the roll-in, the length picker and the core rules. The notes below are what phase 1 left room for.

- **The numeral disc** sits inside the log's footprint, so a four-seat log keeps it and shows "4" (§ 3.2).
- **Slots are "X boxes",** so a four-letter slot is the same card with 4 boxes. **It does not fit a phone in portrait at S4** (Q8): 4 × 22 + 3 × 2 + 8 = 102 wide, so 4 per row is 432 > 343. (With the amended S4 of 2026-10-26, pad 3, it is 4 × 22 + 3 × 2 + 6 = 100 wide and 67 tall; Dave 23 (B) used 102. Measured and settled at 100 in `critters-four-letter.md` § 2.) Seven critters also need a third meadow row at 3 per row. Phase 2 needs its own measure on that form.
- **The beat** has a marked step for the four-seat log's roll-in (§ 5.1).
- **The record** is per length (Dave (7)), so a second length adds a record and nothing here changes.
- **The length picker** of logs (Dave (5)) replaces the meadow only when more than one length is open, so phase 1 never shows it.

---

## 10. Acceptance criteria

### 10.1 Core (vitest, `packages/core`; Kevin)

1. **H1.** `huntVowels(p)`: `[]` for `null` and before `blending-cv`; `['a']` on `blending-cv`; adds _o_, _u_, _i_, _e_ as `cvc-words-short-o/u/i/e` become current or mastered; `['a', 'o']` for cvc-words mastered with short o current.
2. **H2.** Over 1,000 seeds per vowel, `huntDeal` returns 6 letters: the vowel, then 5 distinct consonants from the 22 critter letters, a-z. It has 5-8 targets, at least 3 of them with a bundled picture, at most 3 extras, and every consonant in at least one target. No `CRITTER_NOT_SAID` word is spellable (§ 1). Its letters are never `last`'s letters. With `probeGuard`, none of the 8 probe-reserve words (`novelProbeWords.ts:27-36`) is spellable. The same seed gives the same round.
3. **H3.** Targets are exactly the spellable words that are picture words, said words with a bundled picture, or in `HUNT_FAMILIAR`. Extras are exactly the other spellable `CRITTER_SAID_WORDS`. `CRITTER_NEVER_SAY` words are neither. `HUNT_FAMILIAR` equals Dave's 68 words.
4. **H4.** `huntComplete` is false at N − 2 found targets and true at N − 1, for N 5, 6, 7 and 8, whatever extras are found. It stays true at N.
5. **H5.** (Superseded 2026-10-26 by P1, § 15.11: `huntHintTarget` is the first unfound target in board order.)
6. **H6.** A `HuntRecord` round-trips through the learner-scoped store. Learner B never reads learner A's.

### 10.2 Native (jest, `mobile`; Devon)

7. **H7.** `huntScene` picks § 2.4's step on each of its 15 viewports and equals its rects for N = 8 (board, log band, meadow, chip zone, picture card): the tablet rows as measured on 2026-10-25, and the four phone rows as amended on 2026-10-26 (S4 pad 3, T 36, slot 76 × 67; P8). For N 5-8, every check of § 2.2's fit rule holds.
8. **H8.** The hunt meadow has 6 critters, 3 per row in 2 rows, in round order. Dragging the vowel pops no twin and shows `critter-burrow-empty-<v>` until it lands home. A consonant drag still pops a twin.
9. **H9.** `critter-log-numeral` renders the round's length ("3", or "4" in a four-letter round, `critters-four-letter.md` F11) in a hunt round and is absent in the free meadow. The log's label is "Log, three letters" in the hunt and "Log" in the free meadow.
10. **H10.** (Amended 2026-10-26; the slot is P4's.) A new target, with fake timers and audio: its outcome is the reward ruling's, unchanged. At § 4.1's fill start, **the word's own slot** (`hunt-slot-<k>`, k = its index in `huntBoardOrder`) gets its tiles, with the vowel pink, consonants honey, letters `#6b3f1f`. The shelf clears 400 ms after the last tile lands. No sound plays at the fill.
11. **H11.** No rendered text in the hunt contains a digit other than the numeral, the round's length. No line or label states how many words are found or left.
12. **H12.** A repeat find plays the joy beat and no praise, wiggles its slot, and adds no tile anywhere.
13. **H13.** An extra is said and plays the joy beat. `hunt-bonus` is absent before the first extra, then lists the extras in find order, at most 3. No slot changes, and the chip ignores a tap.
14. **H14.** Never-say words, non-words and pairs keep `play-place.md` § 3.3's outcomes and fill nothing.
15. **H15.** (Superseded 2026-10-26 by P6, § 15.11: the glow's trigger, place and end are unchanged; its tap plays sounds, then the word; no ghost.)
16. **H16.** (Amended 2026-10-26; empty slots by P5.) A filled slot's tap plays its word (`wordWindow` for a picture word; the word clip otherwise; no caption). Slot taps are ignored while the board waits and during the beat.
17. **H17.** (Amended 2026-10-26: board order, P7.) Completion, with fake timers: at the (N−1)-th target, after its shelf clears, the steps of § 5.1 play once, in order and at their times. Emma is `celebration` for the lap; each found slot plays in board order, 250 ms apart; then `cheering` and the "You did it!" canon clip with its caption; `sfx.cheer` and `hunt-burst` at its end; `idle` and `hunt-new-letters` 900 ms later. Drags and taps on critters, log and slots are ignored from C0 until `idle`; Back works throughout.
18. **H18.** After the beat, finding the last target fills its slot with its usual outcome and no second beat. With every slot full, nothing else happens. Nothing starts a round on its own, and no line plays.
19. **H19.** `hunt-new-letters` is absent before completion, sits at § 5.3's rect after it, and on a tap plinks and deals a fresh round with different letters and empty slots, plays no line and no beat, and disappears.
20. **H20.** (Amended 2026-10-26; slots by P2.) Back mid-round, then reopening: the same letters, every found word in its own slot, every slot's picture or listen mark, and the same chip, with no fill motion and no beat; only the open line plays. Back during the beat, then reopening: a fresh round.
21. **H21** (amends `play-place.md` AC N5). On an in-memory store, a hunt visit writes only the hunt record's key: once at a deal, once per new find, once at New letters. Progress, session history, stardust, Leitner and the streak are byte-identical, and `fetch` is never called. A free-meadow visit (before blending sounds) makes zero writes.
22. **H22.** For a learner on letter names or letter sounds, the game is `play-place.md` § 3: 16 critters (22 on a tablet where all fit), twins for every letter, no numeral, no board, no chip, no glow, no New letters.
23. **H23.** With Reduce Motion on (mocked), no flight, wiggle, pulse, burst or spring starts; § 6.2's fades run; lines and sounds keep their times.
24. **H24.** (Superseded 2026-10-26 by P10, § 15.11.)
25. **H25.** A viewport change mid-round re-lays the scene with the new orientation's step and keeps the found slots, the chip, the glow and the seated critters.

### 10.3 Device and E2E (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs)

26. **H26.** (Amended 2026-10-26: the seeded round is the `critters-hunt` seed's, § 14; P11 adds what the pictured board must show.) A maestro flow, seeded through the hunt record's key with round **a c f m n t** and cat, fan, man and mat found: everything is inside the play area on all four forms, nothing overlaps, and the tiles are readable (screenshots). Build c-a-n: the beat plays and New letters appears. Build f-a-t: the last slot fills with no beat. Tap New letters: an empty board of new letters.
27. **H27.** (Amended 2026-10-26; P11.) Build a word on a fresh round: its picture card shrinks onto its own slot's picture and its letters fly into that slot; the shelf clears after. Build it again: its slot wiggles. Build an extra: the chip appears.
28. **H28.** (Superseded 2026-10-26 by P12, § 15.11.)
29. **H29.** Thomas's eye (Predict-Before-Soak, § 10.4): the board, the numeral, the beat and New letters, on device.

### 10.4 Prediction and bounded convergence

- **Prediction (falsifiable, before the soak):**
  - Marian will treat the empty slots as "words still to find" with no line about them: in her first round she will look back at the board after a find, and build at least one new target after the third.
  - Thomas will find the phone-portrait tiles (14 pt) small but readable, and the bonus chip's 10-12 pt letters too small to read at arm's length. They are a record, not a task: a fail on them changes `bx`, not the design.
  - The beat will feel celebratory on first viewing, and slow on the second if the round had 7 finds (about 9 s).
- **Bounded convergence:** I measured the geometry on 15 viewports, for N 5-8, by a scratch script that calls the real `mathLayout`. **Not tested:** other screens; every timing on device; the lap's real clip lengths (estimated); whether the tile flight reads on a busy board; the burst's frame rate with the board on screen; whether a 32 pt picture box (phones) is recognisable for every pack picture; `huntDeal`'s round counts. Dave computed those (184 phase-1 rounds), and I did not re-derive them beyond the two sample rounds.

---

## 11. `play-place.md` amendments for the build PR

Line numbers are this branch's (`origin/main` 5c253593 plus the pointer paragraph at § 3's top, the only edit this PR makes there). PR #695 moves § 3 and § 4 further.

- `:34` Decision 4 "No toy state in this build" → the hunt keeps its record (Dave (7), § 1 here); the raft still keeps none.
- `:168`, `:177`, `:179` (§ 1.6 rails: no unlock / toy state / natural stops) → the hunt's board, its record and its completion beat, by Thomas's call (Dave (3)).
- `:527` "Letter critters is a toy: it has no rounds and no end of its own" → "before blending sounds" (§ 8 here).
- `:595-600` § 3.8 → the hunt's labels (§ 6.3); `:646` § 4.2's log row.
- `:735` N5 → H21 here.
- `:822` D7 "Letter critters has no end of its own" → before blending sounds.
- `:850` § 9 "Collecting: nothing shows what is missing" → the hunt's empty slots (Thomas's call; Dave (3) supersedes his own rail for the hunt only).

---

## 12. Open questions (not settled by Dave's ruling)

1. **Q1 (Dave, Kevin). Extras are stored with the round,** so a bonus is never lost on Back ("never ... a lost find", Dave (3)). Dave (7) lists "its found words" without saying whether extras are among them. I store them.
2. **Q2 (Dave). No hint after completion** (Decision 8). The last slot stays findable but never glows.
3. **Q3 (Dave). Which word a hint plays:** picture words first, a-z, because their blend clip sings each sound, then the rest a-z (§ 1). Dave named the clip kinds, not the order. **Answered 2026-10-26** by Dave 23 (A).1: the board order, and the hint is the first empty slot's word (§ 15.2).
4. **Q4 (Dave). A filled slot replays only the word part** of a picture word's clip (`wordWindow`), as a lesson's picture tap does; the hint plays the whole clip. Dave says "replays the word".
5. **Q5 (Dave, Thomas). Emma `cheering` from "You did it!"** (Decision 9). Dave's step 2 gives `celebration` and does not say she changes.
6. **Q6 (Dave, FYI). The bonus chip's place** (Decision 5): beside the meadow in portrait and in the board's next cell in landscape, because there is no room beside an 8-slot row on a phone.
7. **Q7 (Dave). Back during the beat** stores the round complete, so the next visit deals fresh and she misses the end. The alternative is replaying the beat on return; I recommend against that, since a beat that greets her on arrival is a lure.
8. **Q8 (coordinator, phase 2). Four-letter slots do not fit a phone in portrait** at today's critter size (§ 9). Phase 2 needs its own measure there; nothing in phase 1 blocks it. **Answered 2026-10-26** by `critters-four-letter.md` § 2: three four-box slots of 100 a row (312 ≤ 343) and a 4 + 3 meadow.
9. **Q9 (Kevin, Dave). A write at the deal,** besides Dave's "on each new find and on each unlock", so that "never the same letter set as her last round" holds for a round she left before finding anything (§ 1).
10. **Q10 (Dave, watch). No new letters mid-round.** Dave (3) shows the control only after completion, so a learner who dislikes a round can only finish it, with the hint's help. I kept that. Watch on device for a learner who leaves a round and stops coming back to the game.
11. **Q11 (Kevin). Pictures that are not bundled yet** (mug, sad, mud, hug) do not count toward "at least 3 with a picture" until their files land, so the round counts change slightly the day they do. Kevin pins the core picture set as `CRITTER_SAID_PICTURE_WORDS` is pinned and tested against the registry.

---

## 13. Child-safety and dark-pattern check (the hunt only)

| Risk                         | Here                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency, prizes, streaks    | None: no stardust, star, sticker, counter, total or round count; the board is the round's own record (Dave (3))                                                     |
| A meter of what is missing   | The empty slots, by Thomas's call (Dave (3) supersedes his rail for the hunt only); no numeral, no "3 of 7", no line about it                                       |
| Lures, autoplay, "one more?" | Nothing starts on its own; New letters is child-tapped, silent and still; a return never replays the beat; nothing on the Hub, Map or Session End mentions the hunt |
| Variable reward              | The beat is the same every time; praise is once per word per visit (reward ruling); no random or every-Nth prize                                                    |
| Grind and completionism      | 5-8 words, all but one; the hint; no hint after completion (Decision 8); Dave's watch: distress at the last slot → remove the empty slots, keep the beat            |
| Failure feedback             | Unchanged: a non-word tumbles kindly, a real word never does; no lost finds, lives, timer or clock                                                                  |
| Untaught content judged      | Only her taught vowels deal; the hunt opens with blending sounds (§ 8)                                                                                              |

---

## 14. Build notes (the build PR, 2026-10-25)

What the build decided where this spec or Dave's ruling left room, and what it found. Kyle's § 12 defaults all stand (Q1-Q11).

- **Names** (`packages/core/src/games/critterHunt.ts`): `HUNT_FAMILIAR`, `huntVowels`, `huntProbeGuard(progress)` (cvc-words is the current step), `huntRoundOf(letters, { probeGuard })` (one letter set against Dave (1): `null` when rejected), `huntRounds(vowel, { probeGuard })` (every round a vowel deals), `huntDeal`, `HUNT_FALLBACK` (one pinned round per vowel, each passing the probe guard), `huntComplete`, `huntHintTarget`, `huntFind(record, word)`, `HuntRecord`, `loadHuntRecord` / `saveHuntRecord`. In `playPlace.ts`: `critterHasPicture(word)` and `critterPictureKey(word)` (_mum_ shows `mom`).
- **The deal** picks one of her vowels, then one of that vowel's rounds, uniformly by `rng`, never `last`'s letters. Enumerating the 6,188 consonant sets once per vowel is draw-and-accept with the draws done once: at Dave's acceptance rates (e 21 of 6,188) a 50-draw loop as `raftShore` would almost always fall back. The counts reproduce Dave's exactly: a 45, e 21, i 30, o 27, u 61 (57 before the four pictures landed), and 11 short-a rounds under the probe guard (`critterHunt.test.ts`).
- **Dave (6)'s quiet words shape the deal.** Any short-a round with _d_ spells _add_, so _sad_ is never dealt in phase 1; its picture shows in the free meadow (as a said word with a picture) until phase 2 gives _add_ a clip. This is Dave's rule, not a defect. § 6.1's sample rounds spell _ant_ and _act_, so they are not dealt either.
- **The record's key** is `marian-tutor.critter-hunt.v1`, the learner's 8th own key (`learners/keys.ts` `LEARNER_KEYS`), so the scoped store keeps one per learner and removing a learner removes it. Its value is `{ "3": HuntRecord }`, by length (Dave (7)), so phase 2 adds `"4"`.
- **A find is written when its run is judged,** not when the slot fills: Back during the outcome keeps it ("never a lost find", Dave (3)). The board shows it when the outcome is over (§ 4.1).
- **H21 and the seen-record:** a hunt visit also writes the words Emma says to the progress doc's seen-record (§ 1, unchanged; play-place N5). Progress is byte-identical but for that.
- **Praise and repeats (H12):** the reward ruling's once-per-visit praise is unchanged, so a target found in an earlier visit gets its praise on its first build in this one. Within a visit a repeat never gets praise.
- **The hint's run count** includes the run that retires the drag hint. A glow the run count earns shows when that run's shelf clears; one the idle timer earns while the board waits shows when it is free.
- **The bonus chip in landscape** centres in its cell for the extras it holds (§ 2.3's zone is the 3-extra size).
- **A slot's picture** is drawn at 0.86 of its picture box, as the picture card draws it, so the shrinking card lands on it exactly.
- **Pictures:** mug, sad, mud and hug are batch 19 of `design/word-song/picture-manifest.json` (Thomas's picks, 2026-10-25: v1 each), bundled and on `CRITTER_SAID_PICTURE_WORDS`.
- **Test seams:** `LetterCritters` takes `hunt?: boolean` (the free meadow's tests run with it off); the `critters-hunt` debug seed sets up H26's round (a b g h p t, bag, hat, bat and tap found) for the Maestro flows `12-critters-word-hunt.yaml` (iPad landscape) and `13-critters-word-hunt-phone.yaml` (iPhone 17 portrait).

---

## 15. Pictures in the word boxes (build 23, Dave 23 (A), 2026-10-26)

**Ask (Thomas, build 23, as the coordinator's brief relays him):** "the critter word boxes should have the picture of the word so it's not so hard".

**Rules:** Dave 23 (A).1-6 (`design/research/build23-games-2026-10-26.md`). This section designs his "Kyle next" items 1-5 for (A): the pictured slot (§ 15.3, with the phone picture check of § 15.10), the listen mark and the tappable empty slot (§ 15.4, § 15.5), the board order and the fill into its own slot (§ 15.2, § 15.6), the hint (§ 15.7), and Reduce Motion and VoiceOver (§ 15.9). **Unchanged** (Dave 23 (A).6): completion at N − 1, the last slot still findable, the extras and their bonus chip, the record's shape, the reward ruling's outcomes. **0 new audio, 0 pictures, $0.**

**Paint:** every part is given in the restyle's tokens (`play-games-restyle.md` T11, `:159-167`): the slot card in the Hub bubble's clay, the empty box as a shallow socket, the found tile in the critter's clay, the hint in the Hub's suggested glow. Those four are A2's paint (`play-games-restyle.md:232`), not yet built; this section adds only the listen mark and the press to them. Order of the two builds: Q15.

### 15.1 Decisions (this section's own calls, with reasons)

1. **Phones grow the picture as far as the fit allows; every step draws the picture to its full box.** S4 becomes pad 3, T 36 (§ 2.2), and the picture fills the white box instead of 0.86 of it. On a phone the drawn picture goes from 27.5 to 36 pt: +31 % a side, +71 % in area. Evidence and limits: § 15.10.
2. **The listen mark is a speaker with two sound waves** (§ 15.4). An ear would be a picture of a thing she can name, and _ear_ is a three-letter word: she could take it as the word to spell. A speaker is the sign for sound on every phone and tablet, and it is drawn flat, unlike the soft storybook pack pictures, so it reads as "hear this", not "spell this".
3. **The picture and the listen mark stay after the find.** Dave: "Found means tiles in the boxes, and the picture is the same before and after" (Dave 23 (A).2). A found slot reads differently by its boxes alone: three clay tiles stand proud with their letters, where an empty slot has three sunk sockets.
4. **An empty slot looks tappable by being clay with a ledge, and answers a press.** Clay with a ledge is the app's "press me" (restyle Decision 4, `play-games-restyle.md:26`). Every slot sinks under the finger like the clay buttons and pulses its picture as its word plays. No idle motion, no line, no hand: Dave asks for "an empty slot that looks tappable with no line" (Dave 23 (D) item 2), and a pulse at rest would nag (Decision 7).
5. **The board order is derived from the round's targets, never stored.** `HuntRecord` keeps its shape: `found` stays in find order (§ 1). A round dealt in build 23 reopens with every find in its own slot, so nothing needs migrating.
6. **The hint's sounds come from the slot, not from the critters.** The critters do not light or bounce while the hint sings their sounds. Lighting the three critters would turn "hear it, find each sound's letter" into "find the three that light up". Dave asks for sounds, then the word (Dave 23 (A).5). Q12.
7. **The card lands on the slot's own picture at exactly its size.** The slot's picture is drawn the whole time, under the flying card, so the card disappears into its twin with no jump.

### 15.2 The board order (Dave 23 (A).1)

- **Order:** (1) picture words, which all have a blend clip (`CRITTER_PICTURE_WORDS`, `packages/core/src/games/playPlace.ts:221`), a-z; (2) the other targets with a picture (`critterHasPicture`, `playPlace.ts:438-440`: the said words with a picture, `:406-428`), a-z; (3) the targets with no picture, a-z.
- **Slots:** slot i holds the board order's word i from the deal, in the board's own slot order (§ 2.3: left to right, top to bottom, rows as there). Slot 1 is the easiest word, and it is where the hint glows first.
- **Core:** `huntBoardOrder(round)` (a proposed name; Kevin pins it), and `huntHintTarget(round, found)` becomes the first word of `huntBoardOrder(round)` not in `found` (§ 1; was `critterHunt.ts:262-273`).
- **Real rounds** (dealt by `huntRounds` at `origin/main` fe366267, by a scratch script, not committed; `*` a said word with a picture, `?` no picture):

| Round (N)       | Board order                                 | Extras      |
| --------------- | ------------------------------------------- | ----------- |
| a b g h p t (6) | bag bat hat tag · tap\* · pat?              | gag gap tab |
| a b h m p t (7) | bat hat mat · ham\* map\* tap\* · pat?      | tab         |
| o c h m p t (8) | cot hot mop pot · mom\* pop\* top\* · hop?  | cop tot     |
| o g h j p t (8) | hot pot · pop\* top\* · got? hog? hop? jog? | jot tot     |
| u b g m s t (8) | bug bus tub · gum\* mug\* mum\* · but? tug? | gut sub sum |

a b g h p t is the `critters-hunt` debug seed's round (§ 14). The same script reproduces Dave's lists of unpictured targets and his per-vowel counts exactly (Dave 23 (A), "Which words have pictures"): 53 pictured targets are ever dealt, showing 52 pictures (_mum_ shows `mom`).

### 15.3 The pictured slot (Dave's item 1)

Geometry is § 2.2's, with the amended S4. Paint is T11's.

| Part        | Empty (from the deal)                                                                                                                                                                                                                          | Found                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Card        | `#fff8ee`; phones `inset 0 2px 0 #ffffff, 0 4px 0 #e3c6a6, 0 7px 10px rgba(60,30,10,0.18)`, tablets `inset 0 3px 0 #ffffff, 0 6px 0 #e3c6a6, 0 10px 16px rgba(60,30,10,0.2)` (T11)                                                             | the same                                                                                           |
| Picture box | white, radius 0.18 T; **the word's pack picture in full colour at opacity 1, `contain`, drawn to the whole box and clipped to its radius** (`pictureAsset(critterPictureKey(word))`); or, for a word with no picture, the listen mark (§ 15.4) | the same picture or mark, unchanged                                                                |
| Boxes       | three sockets: `#efe2d0`, `inset 0 2px 3px rgba(90,45,20,0.25)`, radius 0.22 b (T11)                                                                                                                                                           | three clay tiles with their letters (T11's tile; letter Fredoka 700 at 0.62 b in `#6b3f1f`, § 2.2) |

| Step | Picture box T | Picture drawn (was)    | Letters | Used by                          |
| ---- | ------------- | ---------------------- | ------- | -------------------------------- |
| S1   | 72            | 72 (61.9)              | 25      | tablets, first try               |
| S2   | 56            | 56 (48.2)              | 20      | tablets where S1 does not fit    |
| S3   | 44            | 44 (37.8)              | 17      | tablets where S2 does not fit    |
| S4   | **36**        | **36** (27.5, in a 32) | 14      | phones (pad 3; the slot 76 × 67) |

- The pack pictures carry their own white margin (`design/native/hunt-pictures/phone-slot-proposed.webp`: no picture touches its box at the full draw), so drawing to the whole box crops nothing.
- **A target counted as pictured always has a bundled picture** (core pins the set against the registry, Q11). If `pictureAsset` still returns nothing at runtime, the slot shows the listen mark: never a blank box.
- testIDs: `hunt-slot-<i>-picture-<key>` from the deal (today it renders only after the fill), `hunt-slot-<i>-listen` (§ 15.4), `hunt-slot-<i>-tile-<k>` once found. Indexes are 0-based, as today.

### 15.4 The listen mark (Dave's item 2; Dave 23 (A).4)

Drawn with react-native-svg in a 100 × 100 viewBox that fills the picture box, as a picture does. Sample: `design/native/hunt-pictures/listen-mark.webp` (S4 and S1, empty and found).

```
  viewBox 0 0 100 100, all in #b27b37
  body   rect x 14, y 37, 16 × 26, rx 4
  cone   M 30 37 L 52 20 Q 56 18 56 23 L 56 77 Q 56 82 52 80 L 30 63 Z
  waves  two arcs centred (58, 50), radius 14 and 28, from −50° to +50°,
         stroke 9, round caps, no fill
           .-.        )
          |  |\  )    )      the outer wave's right edge is at x 90.5
          |  | ) )   )        (86 + half the stroke): inside the box
          |  |/  )    )
           '-'        )
```

- **Colour** `#b27b37`: Word Song honey's ledge (`LOOK['word-song']`, `mobile/src/screens/hub/mapButtonLook.ts:22`), the consonant tiles' ledge. On the white box it is 3.63 : 1 (WCAG ratio computed from the hex values, 2026-10-26), above the 3 : 1 that WCAG 1.4.11 asks of a graphic. The log's brown `#7d4a26` (7.29 : 1) was the other candidate; it reads as heavy beside the pastel pictures, and the honey ledge ties the mark to the tiles below it.
- **Stroke** 9 % of the box: 3.2 pt at S4, 4.0 at S3, 5.0 at S2, 6.5 at S1. No thin line (restyle Decision 5).
- **Behaviour:** none of its own. It never moves at rest, it stays after the find (Decision 3), and it takes the slot's lit pulse when the slot plays (§ 15.5). `testID="hunt-slot-<i>-listen"`, `accessible={false}` (the slot carries the label).

### 15.5 Tapping an empty slot (Dave's item 2; Dave 23 (A).3)

| When            | What happens                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| press-in        | **The press:** the card sinks by half its ledge, 2 pt on phones and 3 pt on tablets, over 120 ms (`PRESS_MS`, `mobile/src/screens/hub/clay.ts:21`), and rises on release: the clay disc's press (`mobile/src/screens/map/mapChrome.tsx:90-95`) at the slot's ledge. Every slot presses, empty or filled.                                                                           |
| the tap         | Any line Emma is saying is cut. **Its word plays, sound only, every time:** a picture word plays the word part of its blend clip (`wordWindow`, `mobile/src/audio/blendMarks.ts:104-110`), any other target its `critterWordLine` clip: exactly a filled slot's sound (§ 4.3, `playWord(word, false)`, `LetterCritters.tsx:968-987`). No caption, and Emma's pose does not change. |
| the word starts | The picture box (picture or listen mark) takes the lit pulse: 1 → 1.15 → 1 over 400 ms, around its centre (the tiles' pulse, § 4.2). It stays inside the card (1.15 × 36 grows 2.7 pt a side, and the pad is 3).                                                                                                                                                                   |

- **A second tap** on the same slot cuts and restarts. A tap on another slot cuts the first.
- **The glowing slot** plays the hint instead (§ 15.7).
- **Ignored** while the board waits (from a run's first sound until the shelf clears) and during the beat, as § 4.3. Back stays live.
- **After completion** the last empty slot still plays its word when tapped, with no glow (§ 5.2). Nothing invites the tap.
- **Counts:** a slot tap is not a run and not a drag start, so it changes neither hint count. No write.

### 15.6 The fill into its own slot, and the lap (Dave's item 3)

§ 4.1's timeline holds, with three changes:

1. **The slot** is the word's own: its index in `huntBoardOrder`, not the number of targets found before it.
2. **The picture card** shrinks onto the slot's picture. The card draws its picture at 0.86 of its side (`LetterCritters.tsx:1910`), so its end rect is the slot's picture box grown to `T / 0.86` a side about the same centre: 41.9 on phones, 83.7 / 65.1 / 51.2 at S1 / S2 / S3. The card's picture then lands exactly on the slot's own. The slot's picture is drawn throughout, and the card is removed when it lands (§ 4.1: at 620 + 120 ms).
3. **The tiles** fly from the seats into that slot's three boxes (60 ms apart, 500 ms each, § 4.1). A listen slot gets no card (a said word with no picture shows none); its tiles fly in under its mark.

- **The repeat wiggle** (§ 4.2) is on the word's own slot, as before.
- **The lap** (§ 5.1) lights and plays the found slots in board order, skipping the empty one. The completing find may leave any slot empty, not only the last.
- **Reduce Motion:** no flight. The card fades out where it is (300 ms), and the tiles fade in at the word's own slot (200 ms). The picture is already there.

### 15.7 The hint (Dave's item 4; Dave 23 (A).5)

- **Trigger, place and end:** as § 4.6. 5 runs of three without a new target, or 45 s without a drag start; one static glow on the first empty slot, which is now always `huntHintTarget`'s word (§ 15.2). Paint: today's honey ring until A2, then T11's suggested glow `0 0 0 4px #fff3a8, 0 0 18px 6px rgba(255,210,63,0.8)`, static.
- **Tap:** any line is cut, Emma takes `attentive-pointing`, and the picture box takes the lit pulse. Then **the sounds, then the word**, sound only, with no caption:
  - **a picture word** plays its whole blend clip, from 0 to its end, as today ("f - a - n ... fan");
  - **any other target** plays its three letters' critter sounds in order, each the critter's shipped letter window (`letterSound`, `LetterCritters.tsx:240-247`; `play-place.md` § 3.4), `SOUND_GAP_MS` 300 after each (`:174`, the run's rhythm, `song`, `:778-795`), then its `critterWordLine` clip.
  - At its end, Emma `idle`. No critter lights or bounces (Decision 6).
- **Taps** cut and replay it. **No ghost:** the 35 % picture is gone (Dave 23 (A).5); `hunt-slot-<i>-ghost-*` never renders.
- **Ends** when any new target is found, in whatever slot. The glow fades out over 200 ms as that fill starts, and both counts restart. The next glow, once earned, is on the first empty slot then. None after completion (Decision 8).
- **Audio:** 0 new. Every target has a bundled clip, and every critter letter has its window (Dave 23 (A), "Which words have pictures": "0 missing").
- **Length:** a picture word's whole blend clip, as today. For any other target: three letter windows + 3 × 300 ms + the word clip. I did not measure the clips; at roughly 0.3-0.5 s a sound and 0.6-0.9 s a word (an estimate), about 2.4-3.3 s.

### 15.8 Wireframes on all four forms (positions measured, § 2.4 as amended; the art is not to scale)

```
PHONE PORTRAIT 375×667 (S4 amended), mid-hunt
round o c h m p t (N 8): cot and pop found; h and o seated; she taps the empty "mop" slot
+-----------------------------------------------+
|(<)                                            |  Back (16, 8) 56
| .-----.  +----------------------------------+ |
|( Emma  ) | ribbon: empty (the tap is sound  | |  Emma idle; no caption, no pose change
|(  147  ) | only)                            | |
| '-----'  +----------------------------------+ |  A from y 259
|  .-------..-------..=======..-------.         |  board (26.5, 264) 322 × 140: 4 columns of
|  | {cot} || {hot} || {mop} || {pot} |         |    76 × 67, 6 apart, at x 26.5 108.5 190.5 272.5
|  |[c|o|t]||[ | | ]||[ | | ]||[ | | ]|         |  slot 3 (mop) pressed: sunk 2 pt, its picture
|  '-------''-------''=======''-------'         |    pulsing; "mop" plays (wordWindow)
|  .-------..-------..-------..-------.         |  row 2 at y 337
|  | {mom} || {pop} || {top} ||  <))  |         |  slot 8 (hop): the listen mark
|  |[ | | ]||[p|o|p]||[ | | ]||[ | | ]|         |  pictures 36 at (x + 20, y + 3)
|  '-------''-------''-------''-------'         |
|        (h)    (o)    [    ]                   |  seats y 416, 70 each
|    (3)===============================         |  the "3" disc (58.5, 474) 32
|              ( ) (c) (h)                      |  meadow (95.5, 510) 184 × 120, o c h / m p t;
|              (m) (p) (t)                      |    ( ) o's ringed burrow; h kept its twin
+-----------------------------------------------+
```

```
PHONE LANDSCAPE 667×375 (S4 amended), the hint on a listen slot
round o g h j p t (N 8): hot, pot, pop, top found; slot 5 (got) is the first empty one, glows,
and has been tapped: /g/ ... /o/ ... /t/ ... "got"
+---------------------------------------------------------------------------+
|(<)           |  ribbon (160, 56.2) 491 wide: empty                       |
|              +-----------------------------------------------------------+
|                                            .-------. .-------. .-------.  |  board (411, 148.1)
|  .------.     [   ] [   ] [   ]             | {hot} | | {pot} | | {pop} |  |    240 × 213: 3 columns,
| ( Emma   )   (3)================            |[h|o|t]| |[p|o|t]| |[p|o|p]|  |    rows y 148.1 221.1
| ( atten- )                                  '-------' '-------' '-------'  |    294.1
| ( tive-  )      (o) (g) (h)                 .-------. *=======* .-------.  |
| ( point- )      (j) (p) (t)                 | {top} | *  <))  * |  <))  |  |  slot 5 got: glow,
| ( ing    )                                  |[t|o|p]| *[ | | ]* |[ | | ]|  |    no ghost; slot 6 hog
|  '------'                                   '-------' *=======* '-------'  |
|                                             .-------. .-------.            |  row 3: hop, jog, then
|                                             |  <))  | |  <))  |  (chip    |    the chip's cell
|                                             |[ | | ]| |[ | | ]|   cell)   |    (575, 294.1) 76 × 67
|                                             '-------' '-------'            |
+---------------------------------------------------------------------------+
 block (160, 160.6) 228 × 188 as § 2.4, the log empty; no critter lights while the hint sings (Decision 6)
```

```
TABLET PORTRAIT 820×1180 (S1), the fill into its own slot
round u b g m s t (N 8): bug found; she has just built "mug" (a said word with a picture):
its card shrinks onto slot 5's picture and m, u, g fly into slot 5, not slot 2
+-----------------------------------------------------+
|(<)                                                  |  Back (16, 34.7) 74.7
| .--------.  +-------------------------------------+ |
|( Emma     ) | (Emma's "Mug." has ended)           | |  Emma idle at the fill
|(  idle    ) +-------------------------------------+ |
| '--------'                                          |  A from y 442.8
|  .---------. .---------. .---------. .---------.    |  board (98, 462.4) 624 × 288: 4 columns
|  |  {bug}  | |  {bus}  | |  {tub}  | |  {gum}  |    |    of 144 × 136, 16 apart, at x 98 258
|  |[b][u][g]| |[ ][ ][ ]| |[ ][ ][ ]| |[ ][ ][ ]|    |    418 578; pictures 72
|  '---------' '---------' '---------' '---------'    |
|  .---------. .---------. .---------. .---------.    |  row 2 at y 614.4
|  | <{mug}  | |  {mum}  | |   <))   | |   <))   |    |  slot 5: the card (<) lands on mug's own
|  |[m][u][g]| |[ ][ ][ ]| |[ ][ ][ ]| |[ ][ ][ ]|    |    picture (end rect 83.7 a side about
|  '--^--^--^' '---------' '---------' '---------'    |    the box's centre)
|     |  |  |  tiles fly up from the seats            |    slots 7, 8 (but, tug): listen marks
|    (m)(u)(g)                                        |
|     (3)=================================            |  log band (213, 774.4) 394 × 126
|              ( ) (b) (g)                            |  meadow (262, 916.4) 296 × 192,
|              (m) (s) (t)                            |    u b g / m s t; ( ) u's ringed burrow
+-----------------------------------------------------+
```

```
TABLET LANDSCAPE 1180×820 (S1, b20), the completion lap in board order
round a b h m p t (N 7): found tap, bat, map, ham, hat, then mat (6 of 7: complete); tab a bonus;
the lap plays bat, hat, mat, ham, map, tap; pat's listen slot stays empty and findable
+------------------------------------------------------------------------------+
|(<)                                                                           |
| .------.   +-------------------------------------------------------------+   |
|( Emma   )  | ribbon: empty during the lap                                |   |
|( celeb- )  +-------------------------------------------------------------+   |
|( ration )                              #=========# .---------. .---------.   |  board (681.6, 279.5)
| '------'                               #  {bat}  # |  {hat}  | |  {mat}  |   |    464 × 440: rows of 3,
|     [    ]  [    ]  [    ]             #[b][a][t]# |[h][a][t]| |[m][a][t]|   |    144 × 136, 16 apart
|   (3)========================          #=========# '---------' '---------'   |  #==# lit: bat plays first
|                                        .---------. .---------. .---------.   |
|          (a) (b) (h)                   |  {ham}  | |  {map}  | |  {tap}  |   |  row 2 at y 431.5
|          (m) (p) (t)                   |[h][a][m]| |[m][a][p]| |[t][a][p]|   |
|                                        '---------' '---------' '---------'   |
|                                             .---------.  .-------.          |  row 3: pat at
|                                             |   <))   |  |[t|a|b]|          |    (761.6, 583.5), the
|                                             |[ ][ ][ ]|  '-------'          |    chip's cell at
|                                             '---------'                     |    (921.6, 583.5)
+------------------------------------------------------------------------------+

  {cot} a slot's pack picture (full colour, from the deal)   <)) the listen mark   [ | | ] sockets
  [c|o|t] found tiles   *==* the hint's glow   #==# the lap's lit slot   .==. a pressed slot (sunk)
```

### 15.9 Reduce Motion and VoiceOver (Dave's item 5)

**Reduce Motion** (adds to § 6.2; lines, sounds and their times are unchanged):

| Motion                               | With Reduce Motion                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| The fill into its own slot (§ 15.6)  | No flight: the card fades out where it is (300 ms), the tiles fade in at the word's own slot (200 ms)              |
| The picture box's lit pulse (§ 15.5) | None: the word plays and nothing scales                                                                            |
| The press sink (§ 15.5)              | Kept: it follows the finger, as the clay disc's press does (it has no Reduce Motion branch, `mapChrome.tsx:90-95`) |
| The hint (§ 15.7)                    | The glow is a fade, as now; no pulse                                                                               |
| The listen mark                      | Never moves                                                                                                        |

**VoiceOver** (amends § 6.3's slot rows; labels go in `PLAY_LABELS`, `mobile/src/screens/play/playLines.ts:105-117`, so a language version swaps rows):

| Element                           | Label                                          | Role, activate                              |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| An empty slot (picture or listen) | "Word to find" (`emptySlot`, was "Empty word") | button; plays its word, sound only (§ 15.5) |
| The glowing slot                  | "Hint"                                         | button; plays the hint (§ 15.7)             |
| A filled slot                     | the word, capitalised ("Mug")                  | button; plays it (§ 4.3, unchanged)         |
| The picture, the listen mark      | none (`accessible={false}`)                    |                                             |

- **The label never spells the word:** every empty slot has the one label "Word to find", whatever its word. VoiceOver speaks a label, and a braille display spells it, so a label with the word in it would be the answer. Activating the slot plays the word, which is the same help a sighted learner gets from a tap.
- `accessibilityState` selected while it glows (unchanged). No label states a count.

### 15.10 The phone picture check (Dave's item 1: "every pack picture reads at the phone S4 picture box's 32 pt")

`critters-word-hunt.md` § 10.4 listed this as untested. The picture is now the cue (Dave 23 (A).2), so I checked it.

- **What:** every pack picture a round can deal as a pictured target: 52 pictures for 53 targets (§ 15.2), listed by a scratch script over `huntRounds` at fe366267.
- **How ($0, local):** a contact sheet of each picture in a slot drawn to § 2.2 and T11's paint, rendered by agent-browser emulating an iPhone 17 at 3× (no simulator build, no paid call). Committed as `design/native/hunt-pictures/phone-slot-today.webp` (T 32, drawn at 0.86 = 27.5 pt) and `phone-slot-proposed.webp` (T 36, drawn to the box).
- **The yardstick (computed):** on a 460 ppi phone at 3×, 1 pt is 0.166 mm. A 20/20 eye resolves 1 arcmin, 0.087 mm at 30 cm, so about 1.9 resolvable points per pt. I judged each sheet shown at about 1.8 px per pt: roughly the detail that eye gets at 30 cm. This is my eye on a simulation, not a child's on a device.
- **Found at today's 32 (27.5 drawn):** the thin-line pictures nearly vanish: _pin_ (a needle), _pen_, _net_ and _web_ (a pale grey web). _can_ reads as a jar. The rest keep their silhouettes. For scale: the lessons' smallest phone picture is 96 pt (`mobile/src/layout/wordSongLayout.ts:343`, `clamp(96, …)`), so the slot shows a pack picture at under a third of the app's smallest.
- **So they do not all read, and phones take the most the fit allows.** S4 becomes pad 3, T 36, slot 76 × 67. It passes § 2.2's fit rule on all four phone viewports for N 5-8; T 37 fails 844 × 390 for N 6-8, because three rows must fit `A`'s 214.2 pt. § 2.4's phone rows are re-measured with the shipped `huntScene` (§ 2.4's note). Drawn to the box, the phone picture is 36 pt (about 6 mm).
- **Found at 36:** every picture keeps its silhouette, and _can_ reads as a can. _pin_ and _web_ are still the weakest. Their limit is the drawing's thin line, not the box, and a phone has no more room (the slot's height is fixed by three rows in a 214.2 pt `A`). Their word comes with a tap (Dave 23 (A).3). The device check is P13, and Q13 covers what to do if they fail there.
- **Tablets** keep their boxes (72 / 56 / 44); drawn to the box, their pictures grow from 0.86 of the box too.

### 15.11 Acceptance criteria (P1-P13; they supersede or amend H5, H7, H10, H15-H17, H20, H24, H26-H28 as marked there)

**Core (vitest, `packages/core`; Kevin):**

1. **P1.** `huntBoardOrder(round)` returns the targets as § 15.2 orders them: `CRITTER_PICTURE_WORDS` a-z, then the other targets with `critterHasPicture` a-z, then the rest a-z. It gives exactly the board orders of § 15.2's table for those five rounds. For every round `huntRounds` deals for each vowel, and 20 random `found` subsets of each, `huntHintTarget(round, found)` equals the first word of `huntBoardOrder(round)` not in `found`, and `undefined` when every target is found. `HuntRecord`'s shape and key are unchanged.

**Native (jest, `mobile`; Devon):**

2. **P2.** From the deal, slot i (`hunt-slot-<i>`, 0-based) is board word i. It renders `hunt-slot-<i>-picture-<critterPictureKey(word)>` at opacity 1 exactly when `critterHasPicture(word)`, else `hunt-slot-<i>-listen`, never both, and no tile until the word is found. A stored record whose `found` is in find order (as build 23 wrote it) reopens with each found word's tiles in its own slot.
3. **P3.** The slot picture's rect equals the slot's picture box (not 0.86 of it), clipped to radius 0.18 T, on every step. At S4 the box is 36 × 36 at (card.x + 20, card.y + 3) and the card 76 × 67. The listen mark's stroke is `#b27b37`, 9 % of the box.
4. **P4** (amends H10). A new target's fill goes to slot `huntBoardOrder(round).indexOf(word)`: in u b g m s t with _bug_ found, building _mug_ fills `hunt-slot-4`, and `hunt-slot-1` to `hunt-slot-3` stay empty. The picture card's `into` rect is the slot's picture box grown to `T / 0.86` about its centre. The slot's own picture renders throughout the flight. A listen slot's fill shows no card, and its mark stays after the tiles land. A repeat wiggles the word's own slot.
5. **P5** (amends H16). With fake timers and audio: a tap on an empty, unlit slot cuts any line and plays exactly what a filled slot's tap would play for that word (`wordWindow` of the blend clip for a picture word, else the whole `critterWordLine` clip), with an empty ribbon and an unchanged pose. Its picture box takes the 400 ms lit pulse, and a second tap restarts it. Taps are ignored while the board waits and during the beat. After completion, the empty slot still plays its word. The store is byte-identical after any number of slot taps. Press-in translates the card by 2 (phone) or 3 (tablet) over 120 ms.
6. **P6** (supersedes H15). No glow before the drag hint is retired. After 5 runs of three without a new target, or 45 s without a drag start, exactly one glow shows, on the first empty slot in board order, with no line and no sound. Its tap, for a picture word: the whole blend clip from 0. For any other target: its three letters' critter windows in order, each starting 300 ms after the last ends, then the `critterWordLine` clip 300 ms after the third. Emma is `attentive-pointing` throughout, then `idle`, and the ribbon stays empty. No `-ghost-` testID renders and no critter's lit or bounce state changes. Any new target, in any slot, ends the glow and restarts both counts. No glow after completion.
7. **P7** (amends H17). The lap plays the found slots in board order. In a b h m p t, found in the order tap, bat, map, ham, hat, mat, the lap plays bat, hat, mat, ham, map, tap, and _pat_'s slot (index 6) never lights.
8. **P8** (amends H7). On 375 × 667, 667 × 375, 390 × 844 (t47 b34) and 844 × 390 (l/r47 b21), `huntScene` with N 8 equals § 2.4's amended phone rows, and `huntSceneFits` is true for N 5-8. The tablet rows are unchanged.
9. **P9** (Reduce Motion, mocked). The fill's tiles fade in at the word's own slot (no flight), slot and hint taps scale nothing, and lines and sounds keep their times. The press sink still runs.
10. **P10** (supersedes H24). VoiceOver: every empty slot's label is `PLAY_LABELS.emptySlot` ("Word to find") whatever its word, with role button, and activating it plays its word. The glowing slot is "Hint" (button, plays the hint), and a filled slot is its word capitalised (button). Pictures and listen marks are not accessibility elements.

**Device and E2E (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs):**

11. **P11** (amends H26, H27). Maestro on the `critters-hunt` seed (a b g h p t, with bag, hat, bat and tap found, § 14). On all four forms, every slot shows its picture or listen mark inside the play area, and _pat_'s slot shows the listen mark (screenshots). Tap _tag_'s empty slot: "tag" plays. Build t-a-g: its card lands on _tag_'s slot (index 3), the beat's lap plays bag, bat, hat, tag, tap, and _pat_ stays empty.
12. **P12** (supersedes H28). On the seed, find _tag_ first; _pat_ is then the only empty slot. Make 5 runs with no new target: _pat_ glows silently. Tap it: /p/, /a/, /t/, then "pat". Build p-a-t: the glow goes, and the slot fills with no second beat.
13. **P13.** Thomas's eye on a phone and an iPad (Predict-Before-Soak, § 15.12): the pictured board, the listen mark, the press, and every picture at 36 pt on a phone.

### 15.12 Prediction and bounded convergence

- **Prediction (falsifiable, written before anyone sees it on a device):**
  - On the iPad Thomas names every slot picture at a glance. On a phone in portrait he names all but _pin_ and _web_ without a tap, and the first thing he says about the listen mark is that it looks like the volume button.
  - A learner taps an empty slot within her first 30 s on a pictured board, with no line or hand to prompt it. Dave's prediction stands beside mine: Marian finishes a short-a round in one visit with the hint glowing at most once, taps slots to hear words, and leaves the listen slots for last (Dave 23 (A)).
  - Because the first empty slot is the easiest word, most glows will fall on a picture word. The sounds-then-word hint for a listen slot will show only once a round's pictured words are found.
- **Bounded convergence.** **Tested:** the board order, and the set of pictured and unpictured dealt targets, through the shipped core (`huntRounds`, `critterHasPicture` at fe366267; Dave's lists and counts reproduce exactly). The phone geometry, through the shipped `huntScene` and `huntSceneFits` (today's rows reproduce exactly before the change). The 52 pictures and the listen mark, on 3× browser contact sheets. The mark's contrast, computed. **Not tested:** anything on a device, so physical legibility at 36 pt, a child's naming of the pictures, the press's feel, Reduce Motion and VoiceOver on iOS; the length of the hint's sounds-then-word path (estimated, clips not measured); whether A2's paint and this land together (Q15).

### 15.13 Open questions (§ 15)

12. **Q12 (Dave). The hint does not light the critters** while it sings their sounds (Decision 6). Lighting them would point to the letters, and I read your "sounds, then the word" as sound only.
13. **Q13 (Dave, Thomas). _pin_ and _web_ may still not read on a phone at 36 pt** (§ 15.10), and the phone has no more room. If P13 fails them, the lever is art: bolder drawings of _pin_, _pen_, _net_ and _web_, under their own spend popup. Not proposed now.
14. **Q14 (Dave). An empty slot still plays its word after completion** (§ 15.5). It is her tap and nothing invites it. If the "I must get them all" distress shows, your watch (Dave 23 (A).6) removes the pictures; this tap would go with them.
15. **Q15 (coordinator). Build order beside restyle A2.** Both change `HuntBoard.tsx` (A2 is T7-T11, `play-games-restyle.md:232`). Either one Devon PR does A2's slot paint and this, or A2 merges first and this rebases. This spec gives the new parts in T11's tokens either way.
16. **Q16 (Dave). The listen mark stays after the find** (Decision 3), so a found listen slot shows the mark over its tiles. That follows your "the picture is the same before and after".
17. **Q17 (Kevin). `huntBoardOrder`** is a proposed name. The record keeps its shape, and the order is derived at render, so build 23's records need no migration (Decision 5).
18. **Q18 (Dave). VoiceOver: "Word to find"** for every empty slot (§ 15.9), so the label never gives the word.

### 15.14 Child-safety and dark-pattern check (the change only)

| Risk                       | Here                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A meter of what is missing | Still the empty slots alone, now with pictures, which makes them a stronger "what is left" cue. No count or line. Dave's watch (Dave 23 (A).6): distress at the last picture → remove the empty slots' pictures, keep the beat |
| Lures, idle motion         | None added: slots never move at rest; the press and the pulse answer a finger; no line or hand invites a tap                                                                                                                   |
| Failure feedback           | None added: a tap on a slot is never judged; nothing marks a miss (Dave 23 (A).2: "a hunt has no misses")                                                                                                                      |
| Grind and completionism    | Unchanged: all but one; the hint                                                                                                                                                                                               |
| Untaught content judged    | Unchanged: the pictures are of words her taught vowels deal; the listen slots keep the task as sounds to letters (Dave 23 (A).4)                                                                                               |
