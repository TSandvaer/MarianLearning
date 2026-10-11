# Word Song: native UX calls

**Scope:** React Native Phase 3, the Word Song port (after the Map, #540). The reference is the live web Word Song in `src/screens/WordSong/` (frozen) with its six content types: `blending-cv`, `cvc-word`, `letter-names`, `letter-sounds`, `sight-word` and `simple-sentence`. Word Song is Math's sibling lesson screen, so it reuses the lesson-frame calls in `design/native/greet-math-native.md` (Fredoka, the HUD, answer chips, back arrow, beads, the 375×667 / 667×375 phone floor, "tablet" = shorter side ≥ 600 pt) and the native Math code (`mathLayout.ts`, `MathHud`, `AnswerChip`, `GettingReady`). Anything not named here behaves as the web Word Song does.

**Stale docs:** `.claude/docs/screens-and-flows.md` § WordSong describes v1: 8 short-a problems, "the word text under each picture also reveals", and letter taps waiting on phoneme files. The code is the reference: six content types, no text under a chip picture, and letter taps that only pulse.

## Decisions

1. **One stage per form.** The content type decides what fills it (§ 1).
2. **Phone landscape puts the three chips in a column on the right edge.** Math keeps its bottom row (§ 2).
3. **Phone sizes:** picture up to 160 pt, letters 72 pt (portrait) / 56 pt (landscape), chips 88–104 pt (§ 2, § 3).
4. **Captions get a fixed slot.** A longer line scrolls up inside it and never covers the word card (§ 3).
5. **Letters play their own sounds**, cut from the problem's baked blend clip (§ 4).
6. **The picture says its word.** The letter glyph and the scene replay the question (§ 4).
7. **The blend highlight follows the clip's measured sound onsets**, not evenly spaced word ticks (§ 5).
8. **The highlight is a rose spotlight behind a dark letter.** The web turns the letter pale pink (§ 5).
9. **Letter taps during the silent beat hold Emma's read-aloud back**, by at most 5 s (§ 6).
10. **New art: the 4 probe pictures, baked.** Missing art falls back to written-word chips (§ 7).
11. **The th mouth cue sits beside the picture** on every form (§ 3).
12. **Android back = the back arrow** (§ 8).

## 1. Forms and the stage

| Form   | When             | Composition                                                                   |
| ------ | ---------------- | ----------------------------------------------------------------------------- |
| **W**  | tablet portrait  | The web, 1:1, on `mathLayout`'s tablet frames with Word Song's sizes (§ 3)    |
| **TL** | tablet landscape | The web landscape, 1:1, same frames                                           |
| **P**  | phone portrait   | Math's two-row HUD, Emma + ribbon, the stage, a chip row at the bottom        |
| **L**  | phone landscape  | Emma's column, then HUD + ribbon + stage in a middle pane, then a chip column |

The **stage** is the rect between the ribbon row and the chips. What fills it:

| `contentType`                   | Stage                                                        | Chip content |
| ------------------------------- | ------------------------------------------------------------ | ------------ |
| `cvc-word`, `blending-cv`       | Picture (P×P), 8 pt gap, the letter row                      | Picture      |
| `letter-names`, `letter-sounds` | One glyph in a P×P box, Fredoka 700 at 0.71 P (web 128/180)  | Letter       |
| `sight-word`                    | Empty (web)                                                  | Written word |
| `simple-sentence`               | Scene (square, if registered), 12 pt gap, the sentence panel | Written word |

The block is centred vertically in the stage. **Emma's frame follows Math's rules** and equals Math's at every size in § 2's table, so she doesn't jump when a session moves between the two worlds.

**New file:** `mobile/src/layout/wordSongLayout.ts`, beside `mathLayout.ts`. `wordSongLayout(viewport)` returns the form, the safe rect, the HUD (Math's `HudLayout` and metrics), Emma, the ribbon slot, the stage, `picture` (P), `letterFont` (F), the chips (rect, size, gap, `axis: 'row' | 'column'`), the sentence-panel metrics and the th cue rect. `layoutForRoute('literacy')` switches to it. Unit tests pin the § 2 table.

## 2. Phone layouts

```
P  portrait (375×667 floor)          L  landscape (667×375 floor)
+------------------------------+     +--------------------------------------------------+
| [<]            ✦3 (★ 12)     |     | [<]      | ● ● ◉ ○ ○ ○ ○ ○    ✦3 (★ 12) | [chip] |
| ● ● ◉ ○ ○ ○ ○ ○              |     |          | +---------------------------+ | 104    |
| (Emma ) +------------------+ |     | ( Emma ) | | Read the hat.  (2 lines)  | |        |
| (147  ) | Read the hat.    | |     | ( col  ) | +---------------------------+ | [chip] |
|         | (3-line slot)    | |     | ( 160  ) |        +---------+            | 104    |
|         +------------------+ |     |          |        | picture |  [th]      |        |
|       +------------+         |     |          |        |  130    |            | [chip] |
|       |  picture   |  [th]   |     |          |        +---------+            | 104    |
|       |    160     |         |     |          |         h  a  t   (56 pt)     |        |
|       +------------+         |     +--------------------------------------------------+
|         h   a   t   (72 pt)  |       chips: top-to-bottom = the web's left-to-right
|  [ 103 ]  [ 103 ]  [ 103 ]   |
|   32 pt above the safe btm   |
+------------------------------+
```

`S` = the safe rect.

**P (phone portrait):**

- **HUD:** Math's phone HUD, unchanged. Back 56 at (S.x + 16, S.y + 8), streak and stardust to its right, the beads row (28 pt) at S.y + 68.
- **Chips:** `C = clamp(88, ⌊(S.w − 64) / 3⌋, 104)`. Their bottom is 32 pt above S's bottom, and the gap is `⌊(S.w − 32 − 3C) / 2⌋`, which is never under 16. Floor: C = 103, gap 17. Math's phone chips stop at 88; a picture needs the room (§ 3).
- **Emma:** Math's rule, with Word Song's room: `E = max(120, min(round(0.22 × S.h), chipsTop − 16 − 216 − 8 − (S.y + 104)))`. 216 = the smallest card (120 + 8 + 88). Floor: E = 147, the same as Math.
- **Ribbon:** Math's position (x = emma.x + 0.74 E + 8, y = S.y + 112, to S.right − 16), with a fixed **3-line slot of 111 pt** (3 × 22 × 1.375 + 2 × 10). Floor text width: 228.7 pt.
- **Stage:** x S.x + 16, width S.w − 32, from Emma's bottom + 8 to the chips' top − 16. Floor: 343 × 257.
- **Card:** `P = clamp(120, stage.h − 8 − 88, 160)`, then 8 pt, then the letter row (cells 88 pt tall).
- **Sentence:** a 2-line panel slot (98 pt: 2 × 24 × 1.4 + 2 × 12 + 2 × 3 border), and the scene takes the rest: `clamp(88, stage.h − 12 − 98, 160)`.

**L (phone landscape):**

- **Emma's column and the back arrow:** Math's L, unchanged (column `clamp(120, 24% of S.w, 200)`, back at its top, Emma below it).
- **Chip column:** `C = clamp(88, ⌊(S.h − 56) / 3⌋, 104)`, x = S.right − 16 − C. The chips are stacked with 16 pt gaps, and the bottom chip sits 16 pt above S's bottom. Floor: 104; with a 21 pt home indicator, 99.
- **Middle pane:** from the column's right edge to the chip column − 16. The HUD row (44 pt) is at S.y + 8: beads first, status on the right (MathHud's landscape row). Floor: 371 pt wide.
- **Ribbon:** y = S.y + 60, the pane's width, a **2-line slot of 81 pt**.
- **Stage:** from the ribbon slot's bottom + 8 to S.bottom − 16. Card: `P = clamp(96, stage.h − 8 − 72, 160)`, letters 56 pt (cells 72 pt tall). Sentence: a 1-line panel slot (57 pt), and the scene takes `clamp(88, stage.h − 8 − 57, 160)`.
- **Why a column:** under a 2-line ribbon, Math's bottom row leaves 194 pt for the picture and the chips together (173 with a home indicator). That gives a ~100 pt picture over 72–88 pt chips. The column gives a 130 pt picture (109) and 104 pt chips (99). A phone in landscape is held in two hands with the thumbs on the side edges, so the column sits under the right thumb. Math keeps its row: its equation block is shorter than a picture card.

**Sizes.** Computed with the rules above (a scratch script, not committed):

| Device (insets)       | Form | Emma / column | Ribbon text | Stage     | Picture | Scene | Chip     | Letters |
| --------------------- | ---- | ------------- | ----------- | --------- | ------- | ----- | -------- | ------- |
| 375×667               | P    | 147           | 228.7       | 343 × 257 | 160     | 147   | 103 (17) | 72      |
| 390×844 (t47 b34)     | P    | 168           | 231.9       | 358 × 331 | 160     | 160   | 104 (23) | 72      |
| 411×914 (t24 b24)     | P    | 191           | 240         | 379 × 411 | 160     | 160   | 104 (33) | 72      |
| 667×375               | L    | 160           | 339         | 371 × 210 | 130     | 145   | 104      | 56      |
| 667×375 (b21)         | L    | 160           | 344         | 376 × 189 | 109     | 124   | 99       | 56      |
| 844×390 (l47 r47 b21) | L    | 180           | 402         | 434 × 204 | 124     | 139   | 104      | 56      |
| 914×411 (l24 r24)     | L    | 200           | 498         | 530 × 246 | 160     | 160   | 104      | 56      |

Chip gaps are in brackets. In P on a tall phone the card stays at 160 and centres in the taller stage: the pictures are 500 px WebPs, and 160 pt is 480 px at @3x.

**Tablet:** `mathLayout`'s tablet frames (HUD 96, Emma 26vh, the ribbon's reserved 2-line slot) with the web's Word Song sizes: picture 180, letters 96, chips 112 with 24 pt gaps, 32 pt above the safe bottom. Checked worst case, iPad mini landscape 1133×744 (t24 b20): the stage is 325 pt tall, the card needs 300 and the sentence block 312.

## 3. Tiles and text

**Letters (the word card):**

- Fredoka 600, `#3B3B3B` (web). F = 96 (tablet), 72 (P), 56 (L).
- Each letter is a cell: width `max(48, advance + 0.4 F)` (56 minimum on a tablet), height F + 16. The cells touch, the row is centred, and the glyph is centred in its cell. **The hit area is the cell:** at the floors 48 × 88 (P) and 48 × 72 (L). A miss lands on a neighbouring letter, which only plays another sound, so these targets need no 16 pt gaps.
- If the row is wider than the stage, F steps down 4 pt at a time, never below 0.8 F. Measured (Fredoka 600 advance widths, no kerning): the widest card word, "sheep", is 334 pt at 72 in the floor's 343 pt stage, and 260 pt at 56 in L.
- The spotlight (§ 5): a rounded rect behind the glyph, width cell − 4, height F + 8, radius 0.3 F, `#FFB7C5`.

**Chips** (Math's `AnswerChip` frame with a content slot):

- Radius `round(C × 32 / 112)`, content inset `round(C × 12 / 112)` (web: radius 32, padding 12 on a 112 tile). Dim, guided glow, shake, press and the entrance are Math's chip, unchanged.
- **Picture:** the WebP, `contain`, filling the inset box (81 pt at the phone floor, 88 on a tablet).
- **Letter:** Fredoka 700, `round(0.57 C)` (web 64/112), `#1F2937`.
- **Written word:** Fredoka 700, `#1F2937`, size `min(round(0.32 C), the size at which the word fits C − 2 × inset)`, never below 24. Measured: "where" is 101 pt wide at 36, so it gets 28 pt in a 103 pt chip.
- **Sparkle burst on a correct tap:** Word Song's own, not Math's. 6 sparkles fly out `75 × C / 112` pt over 850 ms (ease-out timing), scale 0.5 → 1.1, opacity 1 → 0. Each sparkle is `16 × C / 112` pt.

**Text sizes** (Fredoka, per greet-math-native § 2): caption 22 (phones) / 25.6 (tablet), 600. Sentence panel 24 (P) / 22 (L) / 32 (tablet), 600, line height 1.4 on phones, 1.625 on a tablet; padding 16/12 (P), 16/10 (L), 24/16 (tablet, web `px-6 py-4`). Measured: all 8 sentence frames take ≤ 2 lines at 24 pt in P's 305 pt and 1 line at 22 pt in L's 333 pt. The th labels stay at the web's 16 pt (corner cue) and 24 pt (intro panel).

**Glyph font:** the web's letter tiers use the system sans-serif to tell `I l 1` and `b d p q` apart. Native uses Fredoka 700 as everywhere else. Its single-storey **a** is the shape Marian writes, and a trio is always one case (`pickLetterDistractors`), so `I` and `l` never meet in one problem.

**Captions: a fixed slot.** The ribbon (Math's clay `CaptionRibbon`) never grows past its slot: 3 lines (111 pt) in P, 2 lines (81 pt) in L, Math's slot on a tablet. Measured over all 520 screen lines in the 13 Word Song canon files (Fredoka 600 at 22 pt, the ribbon's 0.4 em word gap, no kerning): in P, 519 take 3 lines or fewer; in L, 519 take 2 or fewer. The odd one is the th tier's 131-character hint ("Let's look. Th is a special new sound. …"): 7 lines in P, 4 in L.

- **Overflow rule:** when the next revealed word sits on a line below the slot, the text block slides up one line height (`withTiming`, 200 ms, ease-out; Reduce Motion: it jumps), so the newest word is always on the slot's last line. Read each word's y from its `onLayout`. `accessibilityLabel` keeps the whole line.
- **Why:** a ribbon that grows would cover the word card for ~10 s, exactly when that hint asks her to look at it.

**th mouth cue** (`th-mouth.webp`, `digraphs-th-voiceless` at intro or practicing):

- **Corner cue (web Placement B):** beside the picture, on every form. x = the picture's right edge + 12, top = the picture's top. Phones: 48 × 66 + the 16 pt "th" label; tablet: 85 × 117 (the web's 64pt × 88pt) + label. If the problem has no picture (§ 7), it sits right of the letter row. **Why:** the web pins it top-right under the HUD (`top: 6rem + inset`, `right: 12px`). Read from the CSS, not checked on a device: that lands on the ribbon row's right end on an iPad, and on a phone it would sit on the ribbon. Next to the picture it reads as "how to say this word".
- **Intro panel (Placement A, first encounter, during the getting-ready wait):** phones: in the stage, a P × P square, the 24 pt "th" label under it, then the getting-ready dots. Tablet: the web (beside Emma, 22vh). It exits with a 200 ms fade when the plan arrives (web).
