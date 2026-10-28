# Letter critters: the word hunt, phase 3 (digraph critters) (native build spec)

**Ask (Thomas, as the coordinator relayed him):** longer critter words. He approved the digraph-critter phase and its spend ("yes spend and start", "yes spend digraphs").

**Rules: Dave's digraph ruling,** parts (A)-(D), committed verbatim with this spec as `design/research/critters-digraph-2026-10-28.md`. This spec quotes it as "Dave D (A)" to "Dave D (D)" and his "What Kyle must design" list as "Dave D (D) item n", and does not restate his evidence. It designs items 1-8 and gives his "For Kevin" rules as core acceptance criteria (§ 11.1). His part (E) is `design/research/critters-pictured-boards-2026-10-27.md`.

**The content is merged** (#719, 95c2589d): `BLEND_GRAPHEME_IPA` sh, ch, th and ng; the 13 word clips (ship fish shed shop chip moth ring wing sing shin shot wish chest, `HUNT_DIGRAPH_LATER`, `packages/core/src/games/playPlace.ts:677`); the 4 sound-source blends (`CRITTER_DIGRAPH_BLENDS`, `:701-706`); the 7 digraph pictures (fish shed shop chip moth sing chest, `mobile/assets/pictures/`), on no list yet. Nothing deals them yet.

**Parent specs:** `design/native/critters-word-hunt.md` (three seats) and `design/native/critters-four-letter.md` (four seats, the picker and its titles). Everything there holds for a digraph round unless this spec says otherwise. **Paint:** the shipped look, as `play-place.md:455` and `critters-word-hunt.md` § 2.2 give it. When restyle A2 lands (`play-games-restyle.md` T7-T11), the digraph critter and tile take its paint like every other critter and tile; § 2.4 checks the label against A2's larger eyes and cheeks.

**Standing rules:** any learner of about 6-9 (Marian is one); every spoken line and label is a row in a table, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first; never a red X. **Spend is counted here and asked later,** each under its own popup (§ 10).

**Scope:** spec only. No code, no renders, no paid calls, no tickets.

**Line numbers** are at `origin/main` 95c2589d. **Geometry** comes from a scratch script (not committed) that calls the shipped `mathLayout`, `playArea`, `backRect`, `huntScene`, `chipRect` and `chipTiles` (`mobile/src/screens/play/playGeometry.ts`). Method check: its phone rects equal `critters-four-letter.md` § 2.4 and § 2.5 (phone P `A` (16, 259) 343 × 376, four-seat meadow row 1 at x 63.5, 127.5; 667 × 375 takes S5). **Type** is measured in Chromium's canvas with the app's Fredoka 700 file (the mocks' copy is byte-identical, `shasum` 077ce632, `critters-four-letter.md:339`).

**Mocks:** `tmp/digraph-mocks/index.html` in the main checkout (not committed): the critter at every size, its construction, the tiles, the sing, the four forms and the 36 pt sheet, drawn with the app's font and the shipped paint at the rects above.

## Goal

A learner who has reached the sh step in Word Song finds, among her letter critters, one honey critter that wears two letters and a short bar. Tapped, it sings one sound. Seated, it fills one seat, and the word she builds with it (ship, three critters) lands in one slot of three boxes, the two letters sharing one box. Nothing on screen explains it; the critter's one body, one sound and one box are the lesson.

## User state entering

She opened Letter critters as before (`critters-word-hunt.md`, `critters-four-letter.md` § 5). Her current Word Song step is digraphs-sh or later (`packages/core/src/progress/mastery.ts:189-194`), so every CVC step is mastered and all five vowels deal (Dave D (B), "Opening"). Marian, on short o, sees none of this yet.

## Decisions (this spec's own calls, with reasons)

1. **A sibling spec** (`critters-digraph.md`), linked from both parents, as phase 2 was. The two parents are 1118 and 881 lines.
2. **The pair is drawn at 0.46 c, a little smaller than a single letter (0.5 c).** At 0.5 c two letters and the bar do not fit the round body with room to spare: either the ng bar comes within 1 pt of the body's edge at c 48, or, lifted to make room, the h and t stems come within 1.1 pt of the eyes (§ 2.3). At 0.46 c every pair keeps 2.35 pt from the eyes and the bar 4.1 pt from the edge at the smallest critter. The pair is 92 % of a single letter's size, close enough to read as the same letters.
3. **One baseline for all four pairs (0.70 c); the bar sits under each pair's own lowest ink.** So the bar hugs sh, ch and th and runs under the g's tail in ng, as a sound-button bar does (Dave D (A)). One rule, no per-digraph tuning.
4. **The tile keeps the single tile's letter size (0.62 b)** and only lifts its baseline (0.64 b) to make room for the bar. The pair then reads at the same size as the single tiles beside it in the slot. It fits every box down to the phone chip's 16 pt, so the shrink-to-fit Dave allowed is not needed (§ 3).
5. **The two letters are one text run and the bar is drawn with them, in one group.** The lit pulse, the bounce and the singing light move them as one mark, so nothing on screen splits "sh" into two letters.
6. **The meadow shows the vowel, then the digraph, then the singles a-z** (Dave's fallbacks print the letters so, Dave D (C)). The new critter sits in the top row beside the vowel, nearest the log, in the same cell every digraph round. Storage order is Kevin's (Q41).
7. **No line, mark or glow for the first digraph critter** (0 new audio by default). Her Word Song lesson that day taught the sound; a tap on the critter plays it. Dave decides whether Emma says anything (Q38).
8. **No new colour.** It is a consonant: Word Song honey with the consonant ledge (Dave D (A); `play-place.md:455`). The bar is the letters' ink, `#6b3f1f`. The bar appears nowhere else in the app today (no Word Song screen draws one), so it is the critters' own mark.

---

## 1. What changes and what does not (Dave D (D) items 4, 6, 9)

| Part                                                            | In a digraph round                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The scene: log, seats, meadow, board, chip place, picture card  | **Unchanged.** 6 critters (three seats) or 7 (four seats), 3- and 4-box slots, the same steps (§ 6)  |
| The numeral disc, the picker, its titles, the open line         | **Unchanged.** The numeral counts seats; "three letters" means three critters (Dave D (B); Q39)      |
| One critter of the round                                        | **New look:** two letters and a bar on a consonant body (§ 2)                                        |
| A tile that holds the digraph (slot, chip, fill)                | **New look:** two letters and a bar in one box (§ 3)                                                 |
| Runs, outcomes, the fill, the hint, slot taps, the beat, praise | **Same rules, counted in critters, not characters** (§ 4)                                            |
| Labels                                                          | **New:** the digraph critter's VoiceOver label (§ 8.2)                                               |
| Not needed (Dave D (D) item 9)                                  | a new numeral, a new open line, a picker change, a 5-seat log, a new pose, sound effect or animation |

---

## 2. The digraph critter (Dave D (D) item 1)

### 2.1 Look

The shipped critter (`play-place.md:455`; `LetterCritters.tsx:1970-2098`), consonant paint: a round honey body (`#f2c27a`) of size `c` with a 2 pt `#b27b37` ledge, two eyes, two feet, its burrow. On its belly, instead of one letter:

- **The pair:** its two letters side by side, lower case, as one text run ("sh", never "s" and "h" as two elements), Fredoka 700, `#6b3f1f`, centred on the body by its advance.
- **The bar:** one short bar under the pair, `#6b3f1f`, round-ended (radius half its thickness), centred under the pair, as wide as the pair's ink.

```
        .-------.
      /  (o) (o)  \        eyes: shipped 0.18 c from 0.16 c (A2: 0.22 c from 0.12 c); both end at 0.34 c
     |     h       |       ink top 0.389 c (the h / t stem, 0.676 em above the baseline)
     |   s h       |       baseline 0.70 c
     |   ===       |       bar: 0.11 f thick, 0.085 f under the pair's lowest ink
      \           /        (under ng it runs below the g's tail)
       '-.,___,.-'
         (_)  (_)          feet, ledge: as every critter
```

### 2.2 Construction (fractions of the body side `c`; `f` = the pair's font size)

| Part            | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Font size `f`   | `0.46 c` (a single letter: 0.5 c, `LetterCritters.tsx:2086`)                                                                        |
| Baseline        | `0.70 c` from the body's top, the same for sh, ch, th and ng                                                                        |
| Horizontal      | the text run centred on the body by its advance; the bar centred on the same line                                                   |
| Bar thickness   | `max(1.5 pt, 0.11 f)`: 0.0506 c                                                                                                     |
| Bar top         | baseline + the pair's ink descent + `0.085 f`                                                                                       |
| Bar width       | the pair's ink width                                                                                                                |
| Ink per 1000 em | sh: inset 25, ink width 897, descent 14 · ch: 21, 956, 15 · th: 16, 850, 13 · ng: 16, 1018, 208 (ascent 676 for sh, ch, th; ng 472) |

So the bar's top is at 0.746 c under sh (0.745 under ch and th) and 0.835 c under ng, and its bottom at 0.796 c and 0.885 c. The ink's centre is within 0.0035 em of the advance's centre for all four, so centring by advance centres the ink to within 0.2 pt at the largest size.

### 2.3 Measured at every size

The meadow critter is `c` (48 phone landscape, 56 phone portrait, 88 tablets; `playGeometry.ts:276`, `:517`); a seated one 1.25 c (60, 70, 110; `SEATED_SCALE`, `:241`).

| Body | `f` (pt) | Ink width sh / ch / th / ng (pt) | Ink to eyes (pt) | Bar thickness (pt) | ng bar: to body edge, to body bottom (pt) |
| ---- | -------- | -------------------------------- | ---------------- | ------------------ | ----------------------------------------- |
| 48   | 22.1     | 19.8 / 21.1 / 18.8 / 22.5        | 2.35             | 2.43               | 4.1, 5.5                                  |
| 56   | 25.8     | 23.1 / 24.6 / 21.9 / 26.2        | 2.75             | 2.83               | 4.7, 6.4                                  |
| 60   | 27.6     | 24.8 / 26.4 / 23.5 / 28.1        | 2.94             | 3.04               | 5.1, 6.9                                  |
| 70   | 32.2     | 28.9 / 30.8 / 27.4 / 32.8        | 3.43             | 3.54               | 5.9, 8.0                                  |
| 88   | 40.5     | 36.3 / 38.7 / 34.4 / 41.2        | 4.32             | 4.45               | 7.4, 10.1                                 |
| 110  | 50.6     | 45.4 / 48.4 / 43.0 / 51.5        | 5.39             | 5.57               | 9.3, 12.6                                 |

- **The smallest, c 48 (phone landscape):** the pair is 22.1 pt, larger than any tile letter in the game (S1's 25 pt tiles are on tablets only, `critters-word-hunt.md:108`). Mock: `critter-sheet.png`, first row.
- **Why not 0.5 c** (Decision 2), at c 48: with the baseline lifted to 0.70 c, the stems come within 0.022 c (1.1 pt) of the eyes; at 0.72 c, the ng bar ends 0.018 c (0.9 pt) inside the body's edge; at the single letter's own baseline it pokes out (the same computation).
- **A2's eyes and cheeks** (`play-games-restyle.md` T7): the eyes still end at 0.34 c (0.12 + 0.22), so the 0.049 c gap holds. The cheeks (y 0.36-0.43 c, x up to 0.29 c and from 0.71 c) face only the pair's stems, which start right of 0.30 c (th's t at 0.3045 c) and end left of 0.6 c (ch's h stem at 0.592 c, the stem 0.238 em wide as Fredoka's l); everything else of the pair is below the x-height line at 0.483 c. Mock: `critter-sheet.png`, last row.
- **The singing light and the lit pulse:** the pulse scales the pair and its bar together (1 → 1.2 → 1) about the pair's baseline centre; the singing light (Reduce Motion) is the pair's white text glow, as on a single letter (`LetterCritters.tsx:2020-2023`); the bar keeps its ink.

### 2.4 Behaviour

Everything as a consonant critter (`play-place.md` § 3.3): a tap sings its sound (§ 4.1) and hops; a drag lifts it and **pops a twin** in its burrow (Dave D (A): "it pops a twin like any consonant, for one rule"); a drop on a seat grows it to 1.25 c; a swap, a hop home. Its burrow, its feet and its shadow are a consonant's. It is never drawn as two critters touching (Dave D (A)).

---

## 3. The tile (Dave D (D) items 2, 3, 5)

A found tile is the critter's paint at the box's size (`HuntBoard.tsx:76-152`). A digraph tile is honey with the consonant ledge, like every consonant tile, and holds the pair and the bar:

| Part          | Value (fractions of the box side `b`)                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Font size `f` | `0.62 b`, the single tile's (`HuntBoard.tsx:145`)                                                                                |
| Baseline      | `0.64 b` from the box's top (a single tile's sits at about 0.70 b, its 0.8 b line box centred)                                   |
| The bar       | as the critter's (§ 2.2): `max(1.5 pt, 0.11 f)` thick, `0.085 f` under the pair's lowest ink, as wide as the pair's ink, centred |

| Box                                       | `f` (pt) | Ink width sh / ch / th / ng (pt) | ng: side room, room under the bar (pt) | Bar (pt) |
| ----------------------------------------- | -------- | -------------------------------- | -------------------------------------- | -------- |
| **S5 slot, b 20** (four seats, 667 × 375) | 12.4     | 11.1 / 11.9 / 10.5 / 12.6        | 3.7, 2.1                               | 1.5      |
| S4 slot, b 22 (phones)                    | 13.6     | 12.2 / 13.0 / 11.6 / 13.9        | 4.1, 2.4                               | 1.5      |
| S3, b 28                                  | 17.4     | 15.6 / 16.6 / 14.8 / 17.7        | 5.2, 3.1                               | 1.91     |
| S2, b 32                                  | 19.8     | 17.8 / 19.0 / 16.9 / 20.2        | 5.9, 3.5                               | 2.18     |
| S1, b 40                                  | 24.8     | 22.2 / 23.7 / 21.1 / 25.2        | 7.4, 4.4                               | 2.73     |
| **Chip, bx 16** (phones)                  | 9.9      | 8.9 / 9.5 / 8.4 / 10.1           | 3.0, 1.4                               | 1.5      |
| Chip, bx 24 (S2)                          | 14.9     | 13.3 / 14.2 / 12.6 / 15.1        | 4.4, 2.6                               | 1.64     |

- **The smallest slot box, b 20:** the pair is 12.4 pt, the same as the single tiles beside it (`critters-four-letter.md` § 2.2's S5 row). The tightest fit is the chip at bx 16: the ng bar ends 1.4 pt above the tile's bottom and clears its rounded corners (radius 0.22 bx) by more than 2 pt. Shrink-to-fit is not needed. Mock: `tile-sheet.png`.
- **In a slot:** one tile a critter, one box a tile. _ship_ fills [sh][i][p], _moth_ [m][o][th], _wing_ [w][i][ng], _chest_ [ch][e][s][t] (Dave D (B), "Lengths"). The slot's box count is the round's seat count, unchanged.
- **In the chip** (three seats only): an extra is three tiles, as now, so the chip keeps its size (`chipRect`, `playGeometry.ts:470-473`: `3 bx + 2 gb + 2 pad` wide). _shin_, _shot_ and _wish_ are [sh][i][n], [sh][o][t], [w][i][sh]. Four-seat rounds have no chip (`critters-four-letter.md` § 15.3).
- **The flying tile** of the fill (`FlyingTile`, `HuntBoard.tsx:598-650`, which draws a `Tile`) carries the pair and the bar at every size from 0.6 × seat down to `b`.

---

## 4. The seat, the sing and the outcomes (Dave D (D) items 4, 5)

### 4.1 One sound a seat

- **Its sound** is its window of its sound-source blend (Dave D (A)): sh from "sh - i - p ... ship" (sound 0), ch from "ch - i - p ... chip" (0), th from "th - i - n ... thin" (0), ng from "r - i - ng ... ring" (2). `letterSound` (`LetterCritters.tsx:299-306`) already plays a letter's window from `CRITTER_SOUND_SOURCE`; the four join that table (Kevin, D9). **These four blend clips are never played whole by the game:** no slot tap, hint or run plays "sh - i - p ... ship" (Dave D (A): "used as sound sources only").
- **A tap** on the critter, in the meadow or on a seat, plays that one window and hops it (0.15 c, 250 ms), as any critter.
- **A run sings one sound a seat:** sh-i-p sings /ʃ/, /ɪ/, /p/, each critter bouncing and lighting as it starts, the next 300 ms after the one before ends (`play-place.md` § 3.3, `SOUND_GAP_MS`, `LetterCritters.tsx:206`). Mock: `sing-strip.png`.
- **The seat is unchanged** (Dave D (D) item 4): 1.25 c, its drop zone grown by 0.2 c, swaps and hops as now. Pairs lean and wait. On a four-seat log, 1-3 seated still sing only when she taps the log (`critters-four-letter.md` § 4.1).

### 4.2 Outcomes, counted in critters

A run's length is the number of seated critters, never the number of letters (Dave D (A), "For Kevin"). sh-i-p is a run of three; s-h-i-p, built from single critters on a plain board, is a run of four and never "ship".

| Run                                                                                       | Outcome                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A digraph target (three seats: ship fish shed shop chip moth ring wing sing; four: chest) | A said word with a picture (`play-place.md` § 3.3): Emma says the word ("Ship.", its caption in her ribbon, `attentive-pointing`), then the joy beat and its picture card; on the first build in a visit, the 8 lesson words (ship shed shop chip moth ring wing chest) add their praise clip ("Yes! That's a ship.", Dave D (B)); fish and sing have none. Then the fill (§ 4.3) |
| A digraph extra (shin shot wish; three seats)                                             | Emma says it, the joy beat, then its three tiles join the chip, as any extra (`critters-word-hunt.md` § 4.5)                                                                                                                                                                                                                                                                      |
| Three seats, a digraph run on no list (sh-o-x)                                            | The boing and the tumble, as any non-word (Dave D (B))                                                                                                                                                                                                                                                                                                                            |
| Four seats, a digraph run on no list                                                      | Sings and sits (`'quiet'`), as any four-letter non-target                                                                                                                                                                                                                                                                                                                         |
| A repeat                                                                                  | As now: the joy beat, no praise, its slot wiggles                                                                                                                                                                                                                                                                                                                                 |

No line or sound is new. The quiet and rude lists keep their outcomes; no dealt round spells one (Dave D (C)).

### 4.3 The fill, slot taps and the hint

- **The fill:** one tile a critter (Dave D (D) item 5). _ship_ flies three tiles at 0, 60 and 120 ms and lands at 620; _chest_ four at 0-180, landing at 680 (`critters-word-hunt.md` § 4.1, `critters-four-letter.md` § 4.2). The tile that leaves the sh critter carries the pair and the bar.
- **A slot tap** plays the word's whole word clip (`critterWordLine`), sound only: no digraph target is a blend-clip picture word, so none uses `wordWindow` (`critters-word-hunt.md` § 4.3).
- **The hint** plays each critter's sound in order, then the word clip (Dave D (B), "Praise and hint"): "/ʃ/ ... /ɪ/ ... /p/ ... ship", one sound a critter, 300 ms apart. No critter lights (`critters-four-letter.md` Decision 9).
- **Board order:** the digraph targets are pictured targets without a blend clip, so they come after the picture words a-z (Dave D (B)): i sh b c n p shows bib bin pin ship; o th c d m t shows cot, then dot mom moth; i ng b f g w shows bib fig wig, then wing; e ch c j n s t shows chest jets nest tent.

---

## 5. The meadow (Dave D (D) item 6; Decision 6)

- **One digraph critter a board, among single ones** (Dave D (B)). Three seats: 6 critters (the vowel, the digraph, 4 singles), 3 a row. Four seats: 7 (the vowel, the digraph, 5 singles), 4 + 3.
- **Its cell is the second:** the top row, beside the vowel. Phone portrait (159.5, 510) 56; phone landscape (250, 244.6) 48; iPad portrait 820 × 1180 (366, 916.4) 88; Thomas's iPad 1080 × 810 (401.3, 479.5) 88. In a four-seat round: phone portrait (127.5, 510) 56, phone landscape (256, 244.6) 48.
- **Never both of its letters as singles** (Dave D (A), the pair rule): an sh board never also has s and h, so the meadow never shows the pair beside its own two letters. One of them alone may be there (an s beside the sh, for sip and ship).
- **No mark for the new one:** no glow, ring, badge, sparkle or line. It is a honey critter that wears two letters.

Mocks: `scene-phone-p.png`, `scene-phone-l.png`, `scene-ipad-p.png`, `scene-ipad-l.png`.

```
PHONE PORTRAIT 375×667 (S4), round i sh b c n p (Dave's sh-i fallback)
bin and pin found; sh, i, p seated and singing (sh first); shin in the chip
+-------------------------------------------------+
|(<)                                              |
| ( Emma, listening )                             |  A from y 259
|           .--------. .--------.                 |  board: bib bin / pin ship,
|           | {bib}  | | {bin}  |                 |    S4 slots 76 × 67
|           |[ | | ]  | |[b|i|n] |                 |
|           .--------. .--------.                 |
|           | {pin}  | | {ship} |                 |
|           |[p|i|n] | |[ | | ] |                 |  ship's slot: three boxes
|            (sh)  (i)  (p)                       |  seats 70 at x 74.5 152.5 230.5,
|         (3)=======================              |    y 416: /ʃ/ ... /ɪ/ ... /p/
|              ( )  (sh)  (b)                     |  meadow (95.5, 510) 184 × 120;
|              (c)  (n)   (p)      [sh|i|n]       |    sh twin in cell 2; the chip
+-------------------------------------------------+    (287.5, 608) 58 × 22, bx 16
  (sh) the digraph critter: two letters, one bar   ( ) the vowel's ringed burrow
```

---

## 6. The fit on all four forms (Dave D (D) item 6)

The layout does not change (Dave D (D) item 6), so every rect of `critters-word-hunt.md` § 2.4 and `critters-four-letter.md` § 2.4 holds. What changes is only what one critter and its tiles draw, inside their own rects. The smallest sizes on each form:

| Form (insets)                           | Meadow c / seat | Smallest slot box b (three seats; four seats) | Chip bx | Pair: meadow, seat, slot, chip (pt) |
| --------------------------------------- | --------------- | --------------------------------------------- | ------- | ----------------------------------- |
| Phone P 375 × 667                       | 56 / 70         | 22 (S4); 22 (S4)                              | 16      | 25.8, 32.2, 13.6, 9.9               |
| Phone L 667 × 375                       | **48 / 60**     | 22 (S4); **20 (S5)**                          | **16**  | **22.1, 27.6, 12.4, 9.9**           |
| iPad P 820 × 1180 (t24 b20)             | 88 / 110        | 40 (S1); 40 (S1)                              | 28      | 40.5, 50.6, 24.8, 17.4              |
| iPad L 1180 × 820 (b20)                 | 88 / 110        | 40 (S1); 40 (S1)                              | 28      | 40.5, 50.6, 24.8, 17.4              |
| Thomas's iPad 1080 × 810                | 88 / 110        | 32 (S2, no insets); 28 (S3, t24 b20)          | 24      | 40.5, 50.6, 19.8 / 17.4, 14.9       |
| The smallest iPad, 1024 × 768 (t24 b20) | 88 / 110        | 28 (S3); 22 (S4)                              | 20      | 40.5, 50.6, 17.4 / 13.6, 12.4       |

Steps: `critters-word-hunt.md` § 2.4 and `critters-four-letter.md` § 2.4; Thomas's iPad with no insets at S2 from the scratch script. In every row the label sits inside its own body or box with the margins of § 2.3 and § 3, which hold at any size because they scale with it. **The tightest place on any form is phone landscape:** a 48 pt critter, a 20 pt four-seat box and a 16 pt chip tile.

---

## 7. Gating, as the player sees it (Dave D (B))

- **Before digraphs-sh is current or mastered:** nothing changes. No digraph critter is dealt.
- **From digraphs-sh:** half her three-seat rounds have an sh critter (Dave D (B), "The deal": plain or sh, uniformly). As ch, th and ng open (their own Word Song steps: digraphs-ch, digraphs-th-voiceless, duck-words, `mastery.ts:189-194`), each takes an equal share, down to a fifth plain. Four-seat rounds deal ch only (with chest), once ch is open, half the time.
- **What she sees:** a board like any other, every slot a picture; one honey critter wears two letters and a bar. The open line, the numeral, the picker and its titles are as before. **Nothing new to read** beyond the two letters, which that day's lesson taught her.
- **What she hears:** nothing new unless she taps or seats it. Its tap is its sound. **Emma says nothing about it** by this spec's default (Decision 7). Dave decides whether Emma has a first-meet line; any line is spend (Q38). Counted for him: one line for all four digraphs, said once per learner, would be one Lily line, about 25 characters (for example "Two letters, one sound!", 23).
- **No lure:** no "new" mark on the Play place tile, the picker or the board, and no count of digraph rounds.

---

## 8. Reduce Motion and VoiceOver (Dave D (D) item 7)

### 8.1 Reduce Motion

Nothing new moves. The digraph critter and tile take every Reduce Motion branch a single critter and tile take (`play-place.md` § 3.7, `critters-word-hunt.md` § 6.2, `critters-four-letter.md` § 8.1): no hop, bounce, flight or pulse; the singing light instead of the bounce, on the pair's text; the fill's fade. The bar keeps its ink and its place.

### 8.2 VoiceOver (labels only: Lily speaks none of them)

| Element                      | Label                                                                 | Now (single letter, `playLines.ts:164-166`) |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| A digraph critter, meadow    | "Letters s h, one sound" (ch: "Letters c h, one sound"; th, ng alike) | "Letter b"                                  |
| A digraph critter, on a seat | "Letters s h, one sound, on the log"                                  | "Letter b, on the log"                      |
| Its bar, its letters         | none (part of the critter's element)                                  |                                             |
| A filled slot, the chip      | unchanged: "Ship"; "Bonus words, shin" (`playLines.ts:155-162`)       |                                             |

- The letters are spelled with a space, so VoiceOver says "ess aitch", not a word or a hush. "One sound" says the lesson to a learner who listens instead of looks (Dave D (D) item 7's own example).
- "Letters" and "one sound" are rows of the label table with the others, so the Danish version swaps them.

---

## 9. The 36 pt check (Dave D (D) item 8)

**What:** the 9 pictures of #719 (fish shed shop chip moth sing chest fog dig, `mobile/assets/pictures/<word>.webp`) and the 3 bundled digraph pictures (ship ring wing). **How:** `critters-word-hunt.md` § 16.5's method: each in a phone slot (S4 76 × 67, T 36; chest in S5's four-box slot, T 36), the picture drawn to the whole box, rendered at 3× (`pictures-36pt.png`); the drawn content measured from the files with the main checkout's `tmp/pictured-boards/bbox.mjs` (the box around every non-white pixel, in pt at T 36).

| Word  | Content at T 36 (w × h, pt) | Reads at 36 pt as                                                                |
| ----- | --------------------------- | -------------------------------------------------------------------------------- |
| fish  | 31.8 × 25.2                 | an orange fish, side view, clear                                                 |
| shed  | 25.6 × 29.7                 | a dark plank shed with a spade; "hut" or "house" is possible (Dave: hard)        |
| shop  | 31.3 × 28.2                 | a striped awning over goods: "shop" or "market"                                  |
| chip  | 27.6 × 25.9                 | **weak:** a yellow round blob; "potato" or "cookie" before "chip" (Dave: hard)   |
| moth  | 31.3 × 25.2                 | a brown moth from above; may be named "butterfly" (Dave: hard)                   |
| sing  | 24.6 × 32.3                 | **weak:** a small singing child; the notes are the cue and are the smallest part |
| chest | 25.8 × 29.8                 | an open treasure chest with gold, clear                                          |
| fog   | 27.3 × 30                   | **weak:** a bare tree and a fence in grey: "tree" before "fog" (as § 16.5 found) |
| dig   | 31 × 30.8                   | a child kneeling, digging soil, clear                                            |
| ship  | 27.6 × 32                   | a sailing boat; "boat" before "ship" (bundled lesson picture)                    |
| ring  | 21.3 × 25.8                 | a gold ring with a stone, clear                                                  |
| wing  | 30.5 × 27.4                 | one feathered wing, clear                                                        |

- **Every picture keeps its silhouette at 36 pt.** The weak ones are the ideas Dave marked hard; a tap gives the word (`critters-word-hunt.md` § 15.5). The lever is art under its own popup; not proposed now (Q44).
- fog and dig draw at the same content size as their v1 renders that § 16.5 measured (27.3 × 30, 31 × 30.8).

---

## 10. Assets, audio and spend

- **Drawn in the app, $0:** the pair (text in the bundled Fredoka 700) and the bar.
- **Reused:** the 13 word clips and 4 sound-source blends (#719); the 8 lesson praise clips (Dave D (B)); the poses, sounds and effects of the hunt.
- **New audio: 0 lines, 0 characters, $0,** unless Dave rules a first-meet line (Q38; one line, about 25 characters, under its own popup).
- **New pictures: 0.**

---

## 11. Acceptance criteria (D1-D27)

### 11.1 Core (vitest, `packages/core`; Kevin; Dave D (A)-(C))

**Names are pinned by Kevin's core PR** (Pattern A); the UI builds on them. Proposed: `HuntUnit` (a single letter or a digraph), `HUNT_DIGRAPHS` (`sh ch th ng`), `huntUnits(word, letters)`.

1. **D1. Units.** A digraph round's `letters` holds its digraph as one entry ("sh", "ch", "th" or "ng"), at most one, the vowel first; three seats have 6 entries, four seats 7. The record guard (`isHuntRecord`, `packages/core/src/games/critterHunt.ts:451`) accepts it and still checks 1 + consonants entries.
2. **D2. A word's critters.** `huntUnits(word, letters)` gives the word's critters in the round, in order: ship on i sh b c n p is sh, i, p; chest on e ch c j n s t is ch, e, s, t; wish is w, i, sh. By the pair rule (D5) every word a round spells has exactly one split.
3. **D3. `critterRun` keys on critters, not characters** (today `run.length === 4`, `playPlace.ts:818`). sh-i-p (3 critters) is `'word'`; ch-e-s-t (4) is `'word'`; shin, shot and wish (3) are `'word'`; s-h-i-p (4 singles) is `'quiet'`; s-h-i (3 singles) is `'funny'` with `funny` on; th-i-s and w-i-th (3) are `'quiet'` (voiced th, Dave D (C)); a digraph run on no list is `'funny'` at three seats and `'quiet'` at four. No digraph run is `'picture'`.
4. **D4. Spellable and the decoy by critters** (today characters: `buildable`, `critterHunt.ts:186-197`; the decoy check `w.includes(l)`, `:253-255`). A word is spellable when each of its critters is in the round, the vowel at most once and a consonant critter at most twice. A consonant is a decoy when it is in no target's critters: on i sh s c n p, s is a decoy if no target uses a single s, even though "ship" contains the character s.
5. **D5. The pair rule.** No round holds both letters of its own digraph as singles: s with h on sh, c with h on ch, t with h on th, n with g on ng. One alone may be dealt.
6. **D6. The lists** (Dave D (C), as printed): three-seat targets ship fish shed shop chip moth ring wing sing; four-seat target chest; extras shin shot wish (the only digraph extras); the three-seat quiet rejects (that than this them then thus with; bath path; both; push bush; wash; chef; itch; chew show thaw), rude rejects (shit shat shag gash tush dong bong wang dung thug meth chav) and known rejects with no clip (bash … sung, his 32); the four-seat rude rejects (shits shags bitch) and known rejects (bench … swung, his 22). A letter set that spells any reject never deals.
7. **D7. Gating.** A digraph deals only once its step is current or mastered (`currentOrMastered`, `playPlace.ts:35`): sh digraphs-sh, ch digraphs-ch, th digraphs-th-voiceless, ng duck-words (`mastery.ts:189-194`). Learner B with no digraph step open gets no digraph round over 1,000 seeds; with none open, `huntRounds` for every vowel and length equals what `main` gives today (the existing counts tests pass unchanged).
8. **D8. The deal** (Dave D (B), "The deal"): pick uniformly among "plain" and each open digraph with rounds at this length for at least one of her vowels; then uniformly among her vowels with rounds for that pick; then uniformly among those rounds, never `last`'s letters. Over 10,000 seeds with only sh open, sh rounds are 50 % ± 2 % of three-seat deals and 0 % of four-seat deals; with sh and ch open, ch-e is 50 % ± 2 % of four-seat deals.
9. **D9. Sounds.** `CRITTER_SOUND_SOURCE` (`playPlace.ts:879`) gains sh {ship, 0}, ch {chip, 0}, th {thin, 0}, ng {ring, 2}, from `CRITTER_DIGRAPH_BLENDS` (`:701-706`).
10. **D10. A digraph round** (Dave D (B), "A digraph round"): exactly one digraph critter; at least one target uses it; targets pictured only, N 4-8 (three seats) or 4-6 (four seats); at most 1 decoy; at most 3 extras; complete at N − 1. The pairs with 0 rounds never deal.
11. **D11. Counts** (Dave D (C)): three seats 122 (sh o 28, sh i 23, sh e 15, ch i 10, th o 22, ng i 24) with his N splits and decoy counts; four seats 22 (ch e) with N 4: 19, 5: 3 and 12 with a decoy. Each digraph target's slot count is his (shop 28 of 28 … chest 22 of 22).
12. **D12. Fallbacks** (Dave D (C), "Kevin pins them"): o sh b f p x, i sh b c n p, e sh b d g l, i ch b f g p, o th c d m t, i ng b f g w (three seats) and e ch c j n s t (four), each a round by D1-D10 with his targets and extras.
13. **D13. Pictures, praise, board order.** fish shed shop chip moth sing chest (and ship ring wing, bundled) are pictured (`critterHasPicture`); the 8 lesson words (ship shed shop chip moth ring wing chest) are on the praise list with their bundled canon clip; `huntBoardOrder` puts the digraph targets after the picture words a-z (i sh b c n p: bib bin pin ship).

### 11.2 Native (jest, `mobile`; Devon)

14. **D14. The digraph critter** renders, for a two-letter critter, one text element holding both letters (never two), Fredoka 700 `#6b3f1f` at 0.46 × its size, its baseline at 0.70 × its size, and one bar element (`testID="critter-<unit>-bar"`) at § 2.2's rect for that pair (width, thickness, top), `#6b3f1f`, inside the body. A single-letter critter is unchanged (0.5 × its size, `LetterCritters.tsx:2086`).
15. **D15. The digraph tile** (`Tile`, `HuntBoard.tsx:90`) renders a two-letter critter's tile with both letters in one text element at 0.62 b, baseline 0.64 b, and a bar at § 3's rect (`testID="<tile testID>-bar"`). Its paint is the consonant's.
16. **D16. Everything that lists a word's tiles lists its critters** (`huntUnits`): the slot's found tiles (today `[...word]`, `HuntBoard.tsx:373`), the chip's tiles (`[...w]`, `:507`), the fill's flying tiles, and the hint's sounds (today `word[k]`, `LetterCritters.tsx:1209-1218`). Found _ship_ renders `hunt-slot-<i>-tile-0..2` (sh, i, p) and no tile 3; _chest_ renders 4.
17. **D17. Runs by critters.** The run is the seated critters (`LetterCritters.tsx:796-798`); with fake timers and audio, seating sh, i, p plays three windows (sh's from the ship blend's sound 0, then i, then p), 300 ms apart, then Emma's "Ship." line, the joy beat, the ship picture and, on the first build in the visit, its praise clip; then three tiles fly at 0, 60, 120 ms into ship's slot. fish and sing play no praise.
18. **D18. The four sound-source blends are never played whole:** over any sequence of runs, slot taps, hints and the beat on a digraph board, no `blendClipPath` of ship, chip, thin or ring plays except through a critter's window.
19. **D19. The lit pulse and the bounce** scale the pair and its bar together (one transform on their group); Reduce Motion (mocked) lights the pair's text and starts no bounce or pulse.
20. **D20. Labels:** a digraph critter's label is "Letters s h, one sound" in the meadow and "Letters s h, one sound, on the log" on a seat (and so for ch, th, ng); its bar and text are not elements. Single critters, slots and the chip are unchanged.
21. **D21. No new text or line:** a digraph board renders no text but the critters' letters, the tiles, the numeral (its seat count) and, on the picker, its two titles; no line plays that does not play on a plain board (unless Dave rules Q38's line, which then gets its own criterion).
22. **D22. Layout unchanged:** `huntScene` returns the same rects for a digraph round as for a plain round of the same seats and N, on all 16 viewports of `critters-four-letter.md` § 5.2 (no geometry change).

### 11.3 Device and E2E (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs)

23. **D23. Seeds** (proposed, Kevin or Jessica): `critters-hunt-sh`: every CVC step mastered, digraphs-sh practicing, hunt i sh b c n p with bin and pin found (2 of bib bin pin ship). Building sh-i-p fills `hunt-slot-3` with three tiles and completes the round (3 of 4); bib stays findable; shin, built, joins the chip. `critters-hunt-ch-four`: digraphs-sh mastered, digraphs-ch practicing, "3" and "4" open, the four-seat round e ch c j n s t with jets and nest found; ch-e-s-t fills `hunt-slot-0` with four tiles and completes it (3 of 4).
24. **D24. Maestro on `critters-hunt-sh`:** the meadow shows `critter-sh` in cell 2 and no `critter-s` or `critter-h`; tap it (a sound, no line); build sh-i-p: slot 3 fills with [sh][i][p], the beat plays. Screenshots on all four forms: the critter, its seated size, the slot and the chip (Thomas's eye, D27).
25. **D25. Maestro on `critters-hunt-ch-four`** (phone landscape is the S5 check): build ch-e-s-t: the four-box slot fills with [ch][e][s][t] at b 20; screenshots.
26. **D26. Simulator screenshot check (objective):** at c 48 (phone landscape), the pair's ink starts below the eyes and the bar lies inside the body, on iOS's own text engine (§ 12, not tested). If the iOS baseline differs from Chromium's so that either fails, the baseline fraction is tuned on device, not the size.
27. **D27. Thomas's eye** on a phone and an iPad (§ 12): the critter reads as two letters and one sound at c 48, the tiles at b 20 and bx 16, and the 36 pt pictures (§ 9).

---

## 12. Prediction and bounded convergence

- **Prediction (falsifiable, written before anyone sees it on a device):**
  - Thomas reads the critter as "sh" at a glance on the phone in landscape and does not ask for bigger letters. If he finds fault, it is the bar under ng sitting lower than under sh, or the chip's 9.9 pt pair, not the slot tile.
  - A learner on digraphs-sh taps the sh critter before she seats it, the first time she meets it.
  - On iOS the pair's baseline lands within 1.6 pt of where Chromium puts it at c 48 (the font's two ascent values, 900 and 974 per 1000 em, differ by 0.074 em, 1.6 pt at f 22.1); D26 still passes.
  - At 36 pt Thomas names fish, chest, dig, ring and wing at once, and asks about at least two of chip, sing, fog and moth.
- **Bounded convergence.** **Tested:** the scene's rects on the four forms through the shipped geometry (method check against `critters-four-letter.md` § 2.4 and § 2.5); the pair's and the tile's fit at every size, from Chromium's ink metrics of the app's Fredoka file, with the shipped eyes and A2's eyes and cheeks; the look, drawn in HTML with the app's font, the shipped paint and the bundled pictures (`tmp/digraph-mocks/`); the 12 pictures' drawn size from the files. **Not tested:** anything on a device; React Native's (or react-native-svg's) baseline for Fredoka on iOS (D26); whether a child reads the bar as "one sound" (Dave's watch: she drags s then h toward a box on an sh board); the sounds themselves (the render's own ear test, #719); Kevin's code against Dave's port; the Danish labels' fit (labels only, no layout).

---

## 13. Amendments for the build PRs

- `critters-word-hunt.md` and `critters-four-letter.md`: a pointer to this spec (this PR).
- `playLines.ts`: the digraph form of `critterLabel` (§ 8.2) and its rows.
- `play-place.md` § 3.2 ("A critter"): a sentence pointing to § 2 here for a two-letter critter.
- The debug seeds (D23) and their Maestro flows.

---

## 14. Open questions (numbered after `critters-four-letter.md`'s Q37)

38. **Q38 (Dave). A first-meet line?** By default Emma says nothing when the first digraph critter appears (Decision 7): the lesson that day taught the sound and a tap plays it. If you want a line, it is yours to word and spend: one line for all four digraphs, once per learner, about 25 characters (e.g. "Two letters, one sound!", 23), within Emma's word list. I recommend none.
39. **Q39 (Dave). "Three letters" on a board of four-letter words.** The three-seat log carries ship and wing, and the picker's title says "Three letters" (`critters-four-letter.md` § 5.4), as the open line does. You kept the line (Dave D (B): she drags three critters); the title follows it. I recommend keeping both and watching for a learner who counts letters aloud.
40. **Q40 (Dave, FYI). The pair is 92 % of a single letter** (0.46 c against 0.5 c, Decision 2). Equal size costs either 1.1 pt between the stems and the eyes or 0.9 pt between the ng bar and the body's edge at c 48.
41. **Q41 (Kevin). Storage order and names.** Dave's fallbacks print the digraph second (vowel, digraph, singles a-z), and his "For Kevin" says "a-z among the consonants". Either works for the UI, which draws the meadow as vowel, digraph, singles a-z (Decision 6). `HuntUnit`, `HUNT_DIGRAPHS` and `huntUnits` are proposed names.
42. **Q42 (Devon). Text engine.** The contract is § 2.2's baseline and bar rects. React Native `Text` places the baseline by the font's line metrics, which iOS may read differently from Chromium (§ 12); react-native-svg's `Text` takes the baseline as `y` directly (the app draws one, `Splash.tsx:112`). Yours to pick; D26 checks it on the simulator.
43. **Q43 (Dave). The VoiceOver label** "Letters s h, one sound" (your example). The letters are spaced so VoiceOver spells them.
44. **Q44 (Dave, Thomas). Weak at 36 pt:** chip, sing and fog, and moth may be named "butterfly" (§ 9). The tap gives the word. If D27 fails one, the lever is art under its own popup; not proposed now.
45. **Q45 (coordinator). Build order:** Kevin's core (D1-D13) first, then Devon's UI (D14-D22) on its names (Pattern A), then Jessica's seeds and flows (D23-D26).

---

## 15. Child-safety and dark-pattern check (the digraph rounds only)

| Risk                         | Here                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lures                        | None: no "new" mark, glow, line or count for the first digraph critter or digraph rounds (§ 7)                                                       |
| A prize, a currency          | None: digraph rounds are rounds; the joy beat and praise are the shipped ones                                                                        |
| Untaught content judged      | A digraph deals only once its own Word Song step is current (D7); voiced th, tch, BATH and GOAT words never deal (Dave D (C))                        |
| Taught spelling judged wrong | Prevented by the pair rule (D5): a board never offers s + h beside sh, so the spelling she was taught is never the one the game rejects (Dave D (A)) |
| Failure feedback             | Unchanged: the boing at three seats for a non-word, sing-and-sit at four                                                                             |
| Rude words                   | No round spells one of Dave's three-seat 12 or four-seat 3 (D6)                                                                                      |
| Grind, variable reward       | Unchanged: N 4-8 (three seats) or 4-6 (four), all but one; the beat is the same every time                                                           |
