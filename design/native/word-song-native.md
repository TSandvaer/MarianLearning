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

## 4. Tap-to-hear

**Letters. Decision: each letter plays its own sound, cut from the problem's blend clip.**

- Applies to `cvc-word` problems whose plan carries a `blend` clip that has marks (§ 5): all 40 baked blends (short a, o, u, i, e; 8 each). Every other letter row (`blending-cv`, the digraph tiers, the static fallback plan) pulses silently, as on the web.
- **Playback:** seek to `segment.on − 30 ms`, play, stop at `segment.off + 80 ms`. Measured: every segment is followed by at least 301 ms of silence, so the stop lands in silence even with the 50 ms status interval. The tapped letter gets the spotlight and the pulse for max(400 ms, the segment).
- **When:** from the card's first frame, including the silent beat, until the problem resolves. While Emma speaks any line the letters are inert: no sound, no pulse. A new letter or picture tap cuts the sound in flight; there is no queue.
- **Not a move:** no attempt, no streak change, no Emma reaction, nothing recorded (web spec: "pure exploration").
- **Player:** a clip player on the problem's blend file, outside the voice channel's line queue. It stops, and does not resume, when the app goes to the background.

**Words. Decision: the picture says its word.**

- `cvc-word` with marks: the blend clip's word segment (`segments[3].on − 30 ms` to the clip's end), with every letter lit together, as on the blend's whole-word beat. Other picture problems (`blending-cv`, no marks) replay the read line ("Tap the cat.") with its caption walk.
- Letter tiers: the big glyph replays the read line. Sentences: the scene replays the read line. Sight words have no target: the web has no card there.
- **When:** after the read-aloud has ended (when the chips open) until the problem resolves; inert while Emma speaks. **Never during the silent beat:** hearing the word would end her decoding beat.
- **Press:** scale 1 → 0.96 at press-in (`withTiming`, 80 ms), back on release (spring 300/20). Hit area: the P × P box (≥ 96 pt). The isolated word leaves the ribbon's line alone (the word is printed right under the picture); a read-line replay walks its caption.

**Why:** the approved web spec (`design/screen-4-word-song.md` § Input model and § Audio dispatch sequence on letter tap) has phoneme letter taps and a "hear it again" control. The web shipped pulses only, because the phoneme files were never made. The blend clips are Emma's ear-approved phonemes, in her voice and in the word's own context, and they already arrive with the session. Picture → spoken word is the vocabulary link Marian needs most. **No speaker icon:** Session End and the map draw a speaker that does nothing, so one that works here would teach her the wrong thing there.

## 5. The blend: timing and motion

**Measured** (all 40 baked blend clips, ffmpeg `silencedetect`, a scratch script, not committed): each clip runs 2.72–3.76 s. It holds three grapheme sounds separated by at least 301 ms of silence, a longer pause, then the whole word. The web lights a letter on evenly spaced word ticks (token i at i × duration / 7 for `c - a - t ... cat`). Against the measured onsets those ticks are late: grapheme 2 by a median 99 ms (max 202), grapheme 3 by 293 ms (max 455), the whole word by 291 ms (max 428). Grapheme 3 lasts 85–590 ms (median 258), so on many clips its letter lights after its sound has ended, and she hears /t/ while the **a** is still lit.

**Decision: drive the highlight from per-clip marks.**

- `mobile/scripts/export-assets.mjs` writes `mobile/src/audio/blendMarks.generated.ts`: for every `word.p*.blend` utterance in `public/canon/word-song/**`, keyed by its text, `{ bytes, segments: [[onMs, offMs] × 4] }`. Boundaries come from `silencedetect` at −35 dB: the first onset is the end of the leading silence (≥ 30 ms), and later onsets and offsets are the ends and starts of silences ≥ 300 ms. Exactly 4 segments, or no entry. The 40 texts are unique across the canon files.
- Use an entry only when the session's blend file is exactly `bytes` long. The server reuses canon audio by text (`api/_session.ts`, `getCanonAudioIndex`), so the bytes match. A re-bake changes them, and a unit test fails until the script runs again.
- No entry, a byte mismatch, or the static fallback plan: the web's even ticks through core's `buildBlendHighlightSteps`.
- **Timing:** letter k lights at `segments[k].on − 40 ms`, all letters at `segments[3].on − 40 ms`, and everything goes dark at the clip's end. Read it from the player's `currentTime` in its status listener (the `captionClock` pattern, 50 ms interval). The light then lands between 40 ms early and 10 ms late, and it freezes with the voice in the background. Early rather than late, because a sound that comes after its picture is noticed later than one that comes before it (ITU-R BT.1359: about 125 ms of sound delay against about 45 ms of sound lead).
- **Caption with marks:** each grapheme token appears at its mark, and each separator (`-`, `...`) appears with the token after it.
- **The blend stays one clip.** Don't stitch phonemes at runtime: it would change the ear-tested timing and prosody.

**Decision: the lit letter stays dark on a rose spotlight.** The web turns the lit letter `#FFB7C5` on a near-`#FFF5F0` screen (contrast about 1.5:1), so the letter Emma is sounding becomes the palest one on screen. Native keeps the letter `#3B3B3B` and fades a `#FFB7C5` spotlight (§ 3) in behind it (about 6.8:1). It is the same colour and the same pulse, but the letter gains contrast instead of losing it. Letter taps use the same look.

`EASE_OUT` below is `Easing.bezier(0, 0, 0.58, 1)` (motion's `easeOut`, as `MathHud` uses).

| Beat                                              | Shared value          | Reanimated                                                                                |
| ------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| Letter k lights                                   | `lit[k]` 0 → 1        | `withTiming(1, { duration: 120 })`                                                        |
| Its pulse (web `[1, 1.2, 1]`, 400 ms ease-out)    | `scale[k]`            | `withSequence(withTiming(1.2, { duration: 200, easing: EASE_OUT }), withTiming(1, same))` |
| The letter before it                              | `lit[k − 1]` → 0      | `withTiming(0, { duration: 120 })`                                                        |
| The whole word                                    | every `lit` and pulse | all started in the same JS tick                                                           |
| Clip end, a cut, the next problem                 | every `lit` → 0       | `withTiming(0, { duration: 200 })`                                                        |
| Letter entrance (web spring 300/18, 150 ms apart) | `scale[k]` 0 → 1      | `withDelay(150 × k, withSpring(1, { stiffness: 300, damping: 18 }))`, opacity with it     |
| Picture entrance (web spring 260/16)              | scale 0 → 1           | `withSpring(1, { stiffness: 260, damping: 16 })`, opacity clamped                         |

The status callback writes the shared values with `.set()`; nothing runs per frame on the JS thread. **Reduce Motion:** no pulses and no stagger. The spotlight still fades in (colour, not motion, as on the web), and the entrances become fades of 150 ms (letters) and 200 ms (picture). Emma is `attentive-pointing` through the blend and returns to `idle` at its end (web).

## 6. Audio timing

- **The silent beat** (`cvc-word`, 1500 ms, web) counts foreground time only. Its timer pauses while the app is in the background and resumes with the time left (the web re-arms on `visibilitychange`).
- **Decision: letter taps hold the read-aloud back.** After a letter tap, the read-aloud starts no sooner than 1000 ms after that tap, and never later than 5000 ms after the card appeared. **Why:** the beat exists so she decodes before she hears the word (Dave's review on PR #135 / #139, cited at `SILENT_TEXT_WINDOW_MS`). Tapping letters is decoding, so Emma waits instead of saying the word over her. The cap stops a tapping game from stalling the problem.
- Every other content type reads at once (web).
- **The chips open when the read-aloud ends** (web Word Song). Don't copy native Math's gate, which opens at the read's start.
- **Wrong taps:** the reprompt at once. On the 2nd wrong, the blend (the hint line where there is no blend) starts 600 ms after the reprompt ends. On the 3rd, the give-answer line (web).
- **Emma and the tap sounds:** Emma's next line cuts a tap sound in flight (the voice channel's rule), and so does a chip tap. A tap sound never cuts Emma.
- **SFX:** sparkle 0.85 and plink 0.7 on a correct tap, poof 0.7 on a wrong one (web). All three are bundled.
- **Audio session:** held (greet-math-native § 3).

## 7. Art: bake versus draw

Word Song needs no CSS filter, so nothing is baked for iOS's `filter` limits (hub-native § 4).

| Piece                                               | Web                                                                                                            | Native                                                                                                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 53 word pictures                                    | `picture-*.svg` wrapping a PNG                                                                                 | **Baked, already bundled** (`assets/pictures/*.webp`, 500 px).                                                                                                                                                                      |
| 4 probe pictures (`nap`, `rat`, `map`, `tap`)       | Inline-SVG placeholders in `wordPictures.tsx`                                                                  | **Bake.** `export-assets.mjs` renders each key's `WordPicture` body (`renderToStaticMarkup`) through sharp to a 500 px WebP, registry key `/native/pictures/<key>`. The planner's novel pool uses them (`api/_plannerWordList.ts`). |
| Pictures that don't exist (the ch, sh and th words) | A pink square with the word in 14 px sans-serif                                                                | **Draw no picture.** If the target or either distractor has no picture, the problem draws as a written-word problem: written-word chips, the letter row alone in the stage, no picture tap.                                         |
| 8 scenes                                            | `scene-*.svg`, square art letterboxed into a 280×210 box                                                       | **Baked, already bundled.** Drawn square: § 2's scene size on phones, 210 on a tablet (what the web shows).                                                                                                                         |
| th mouth, Emma's poses                              | SVG                                                                                                            | Baked, bundled.                                                                                                                                                                                                                     |
| Background                                          | radial `rgba(255,210,235,.55)` at 50% 30% to transparent at 60%, over linear `#FFF5FA → #FFF8F8`               | `experimental_backgroundImage`, both layers.                                                                                                                                                                                        |
| Clay tile, pressed slab, guided glow ring           | `.clay-tile` `box-shadow` with `.clay-world-word`'s slab `#f2a7c3`                                             | Math's `AnswerChip` shadow strings with a `slab` colour prop (Math: `#dba675`, Word Song: `#f2a7c3`).                                                                                                                               |
| Spotlight                                           | none                                                                                                           | A View (§ 3).                                                                                                                                                                                                                       |
| Sentence panel and gap                              | White, 3 px `#FFC0CB` border, radius 16, `0 8px 24px rgba(244,143,177,.18)`; a 3 px ink underline `3.5ch` wide | Views with those values; the gap is a 3 pt `#3D2B3D` bar, 3.5 × the "0" advance wide.                                                                                                                                               |
| Sparkles, HUD, getting-ready dots                   | Inline SVG, React                                                                                              | Math's `SparkleGlyph`, `MathHud`, `GettingReady`.                                                                                                                                                                                   |

**New art: the 4 probe pictures.** Everything else is bundled or drawn. The ch, sh and th words have prompts (`design/word-song/digraphs-*-picture-pack-prompts.md`) but no art yet; until it lands, the written-word fallback replaces the web's pink squares.
