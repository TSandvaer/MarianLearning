# Take-away picture: flowers for taking away to ten and to twenty (native)

**Status:** spec only. Thomas approved on 2026-10-19 (popup "Yes, spec + build now"): this spec, then Devon builds it as its own small native PR alongside wave 5, aiming for the same TestFlight build. T1–T2 (§ 10) are judged at the device check.

**Scope:** the native app (`mobile/`) and one small pure module in `@marian/core`. No canon, planner, server, progress or audio change; $0 in audio and pictures. The web is frozen (`content-wave-4.md:5`), so its comment at `src/screens/Math/Math.tsx:3092-3099` stays.

**Source:** Dave's research `design/research/take-away-picture-2026-10-19.md` (PR #618, read from `origin/dave/take-away-picture`). His Recommendations 1–3 are the brief; where this spec decides something his text leaves open, or differs from it, the Decisions list says so.

**Who it is for:** every learner who meets `sub-to-10` or `sub-to-20`, including learners who mastered them (they meet these problems in reviews and peeks). No rule here depends on one learner's school, language or history.

**Out of scope:** code, a cross-session fade (none in this change), the fact-by-fact fade (Dave: later, for both operations together), borrowing, the two-digit steps (they keep no counters, as addition past 9: `mobile/src/layout/mathLayout.ts:509`).

## Goal

On every take-away problem the learner sees the starting flowers in a ten-frame, sees the taken flowers lift away and stay pale, and can count what is left, so the hints' "Look at the flowers." and "Six flowers." finally point at something.

## User state entering

- **Today:** addition draws a flower row (`mobile/src/screens/math/Math.tsx:1548-1553`); subtraction draws nothing but the minuend flash on some sub-to-10 problems (`Math.tsx:1519-1534`), and sub-to-20 draws nothing at all.
- **The words already promise a picture:** every sub-to-10 and sub-to-20 canon problem's hints are "Look at the flowers." / "<Minuend> flowers." / "Take away <n>. How many now?" (`public/canon/math/level-1/sub-to-10.json`, `sub-to-20.json`).
- **The minuend flash** (sub-to-10, minuend 5–10, its own session gate) is unchanged and plays first.

## Decisions

- **K1. Where it draws:** every arithmetic problem with `op === '-'` whose own step is `sub-to-10` or `sub-to-20`. The step is the one the chips use, `problemNodes?.[i] ?? focusNode` (`mobile/src/screens/math/problemChips.ts:65-66`), so mixed reviews follow each problem's step. Not by operand size: two-digit-addsub's canon has "Fifteen minus three." (`public/canon/math/level-1/two-digit-addsub.json`), which keeps no counters.
- **K2. Static on every problem**, in forward sessions, reviews, warm-up hearts and peeks (Map replays are peeks, `Math.tsx:320-325`), as addition's row is.
- **K3. Sub-to-10: one ten-frame. Sub-to-20: a double ten-frame**: the left frame is always full (the ten) and never moves; the right holds the ones digit. The pool is no-borrow (`api/_planner.ts:1885`), so every taken flower comes from the right frame. A problem that would borrow, or a minuend over 19, draws nothing (defensive; the pool never serves one).
- **K4. The frame is the flash's ten-frame card** (`TenFrameCell`, `mobile/src/screens/math/glyphs.tsx:183-205`): white, rose border, no cell lines and no empty-slot marks. The flowers are addition's `FlowerGlyph` (`glyphs.tsx:29`), undecorated (Dave's T6).
- **K5. Taken flowers rest pale in their own cells, not raised above them.** A raised bottom-row flower would sit on the top-row flower above it (the rows are 6–8 pt apart, § 2). So a lifted copy rises and fades away, and a pale flower stays in the cell. Pale = `FlowerGlyph` at opacity 0.35. Pale vs gone is T1.
- **K6. When the lift plays** (Dave's fading, unchanged): on the read in P1–P3 of a forward session; at hint 3 everywhere else (P4–P8, reviews, peeks, warm-up hearts). A right tap lifts what hasn't lifted, fast; the given answer lands it at once. Warm-up hearts count with reviews (Dave named reviews and peeks; a heart is a known fact, so it gets the faded form). This differs from wave 4, whose peeks moved on the read (`content-wave-4.md:431`), because Dave says so for this picture.
- **K7. The read's lift starts on "away" (sub-to-10's "take away") or "minus" (sub-to-20)**, the operation word, as more and less's lift starts on "less" (§ 4).
- **K8. Sub-to-20's ripples treat the ten as one:** its ten flowers pulse together, then the loose flowers ripple one by one. Dave's text says "ripple again in order, which is the count"; counting all 18 one by one models counting all from 1, which the double ten-frame is there to replace (his Fuson & Kwon, 1.NBT.B.2b). Sub-to-10 ripples one by one, as written. Dave can overturn this without a layout change.
- **K9. A wrong tap never moves the picture.** If a wrong tap cuts the read before its "away"/"minus" tick, nothing lifts on that read; the flowers lift at hint 3 or on the right tap. (Hundreds builds its trays when a read is cut, `Math.tsx:852-856`; this picture does not, because Dave's rule 2 says the picture holds still on a wrong tap.)

## 1. What the learner sees

Sub-to-10 P2, "Six take away three.", phone portrait (375×667), after the lift (✿ full, ❀ pale):

```
+----------------------------+
| [<]            HUD         |
| ● ◉ ○ ○ ○ ○ ○ ○            |
| (Emma) | Six take away   | |
|        | three. How many | |
|        | are left?       | |
|       6  −  3  =  ?        |  equation unchanged
|   ╭──────────────────╮     |
|   │ ✿  ✿  ✿  ❀  ❀    │     |  slots 1–5
|   │ ❀                │     |  slot 6; 6, 5, 4 were taken
|   ╰──────────────────╯     |
|  [chip]  [chip]  [chip]    |
+----------------------------+
```

Sub-to-20 P8, "Eighteen minus six.", after hint 3 (the left frame never changes):

```
|        18  −  6  =  ?        |
|  ╭────────────╮ ╭────────────╮|
|  │✿ ✿ ✿ ✿ ✿ │ │✿ ✿ ❀ ❀ ❀ │|
|  │✿ ✿ ✿ ✿ ✿ │ │❀ ❀ ❀      │|
|  ╰────────────╯ ╰────────────╯|
```

- **Fill:** slot 1 is top-left; the top row fills left to right, then the bottom row. A frame holds the minuend (sub-to-10) or its ones digit (sub-to-20's right frame).
- **Taken:** the last-placed flowers, the last `subtrahend` filled slots. They lift last-placed first (slot 6, then 5, then 4), wave 4's order (`content-wave-4.md:121`).
- **No sign between the frames.** The two frames are one number: a ten and some ones. The equation keeps its "−" (`Math.tsx:1630`).

## 2. Layout and sizes

The picture takes the counting row's place: the same `styles.visual` row under the equation (`Math.tsx:1824-1825`, centred, `:1978-1982`), hidden from accessibility as `CountingRow` is (`CountingRow.tsx:135`); the equation's label carries the read (`Math.tsx:1769-1771`).

- **Phone:** the row is the fixed `layout.visualSlot` (80 pt portrait, `mathLayout.ts:235`; 64 or 56 pt landscape, `:330-344`), so the equation never moves between problems. The frame is centred in it.
- **Tablet:** the row takes the frame's height (`visualSlot: null`, `mathLayout.ts:462`). `visualHeight` (`Math.tsx:1557-1563`) becomes the frame's height, or the flash cell's if that is taller; `showVisualRow` (`:1564-1566`) includes this picture. Within a step every frame has the same size, so the equation doesn't move between problems.

**Geometry** (new `takeAwayMetrics(layout, step, width)` in `mathLayout.ts`): flower `f`, gap `g`, cell pitch `c = f + g`.

- `c = min(f₀ + g, ⌊(S − g) / 2⌋, width cap)`, where S is the phone slot (no limit on a tablet). The width cap is `⌊(width − g) / 5⌋` for one frame and `⌊(width − between − 2g) / 10⌋` for two.
- `f = c − g`. One frame is `5c + g` wide and `2c + g` tall.
- Flower k sits centred at `x = g/2 + (col + ½)·c`, `y = g/2 + (row + ½)·c`, with `row = k ≤ 5 ? 0 : 1` and `col = (k − 1) mod 5`. So every flower is `g` from its neighbours and from the frame's inside edge.
- **Card:** fill `#FFFFFF`, border `#F48FB1` (the flash's `CELL_BORDER`, `glyphs.tsx:149`) at 2 pt (phone) or 3 pt (tablet), corner radius `round(0.27 × height)` (the flash's 16 on 60 units, `glyphs.tsx:204`).

| Form                           | S    | g   | f₀ (sub-10 / sub-20) | Between frames | Sub-to-10: f, frame W×H | Sub-to-20: f, frame W×H, pair W | Lift rise |
| ------------------------------ | ---- | --- | -------------------- | -------------- | ----------------------- | ------------------------------- | --------- |
| Phone portrait (375×667)       | 80   | 8   | 24 / 20              | 24             | 24, 168×72              | 20, 148×64, 320                 | 24        |
| Phone landscape, 64 pt slot    | 64   | 6   | 24 / 20              | 24             | 23, 151×64              | 20, 136×58, 296                 | 16        |
| Phone landscape, 56 pt slot    | 56   | 6   | 24 / 20              | 24             | 19, 131×56              | 19, 131×56, 286                 | 16        |
| Tablet, portrait and landscape | none | 8   | 48 / 40              | 32             | 48, 288×120             | 40, 248×104, 528                | 32        |

- **Against addition's `CountingRow`:** on a phone addition draws 24 pt flowers when the sum is ≤ 10, else 20 pt, 8 pt apart (`mathLayout.ts:81-84`, `countingMetrics`). So sub-to-10 matches add-to-10, and sub-to-20 matches add-to-20, on a phone in portrait. On a tablet addition draws 51.2 pt (3.2 rem) up to sums of 10, sliding to 32 pt at 18 (`packages/core/src/math/flowerRowFit.ts`). Sub-to-10's 48 pt is just under add-to-10's, and sub-to-20's 40 pt sits inside add-to-20's range.
- **Phone landscape is smaller** (19–23 pt): the ten-frame always needs two rows plus a margin in a 56–64 pt slot, where addition's row can stay one row.
- **The flash fits the same box:** on a phone in portrait the flash's ten-frame is 170×80 (`glyphs.tsx:183`), and this frame is 168×72 in the same slot.
- **The lift rise** is wave 4's 24 pt (tablet 32, `mathLayout.ts:1530`). On a phone in landscape it is 16 pt, because the slot sits only 4–8 pt under the equation there (`equationToDots`, `mathLayout.ts:289`). A rising top-row flower then fades out before it reaches the numerals.
- **Hand-computed, not measured:** the safe sizes used are the 375×667 floor and the widths above. The build's `mathLayout.test.ts` pins the table, or corrects it.

## 3. Beats, problem by problem

"P1–P3" means `arith.index ≤ GENTLE_RAMP_THROUGH` (3, `packages/core/src/math/distractors.ts:143`) on a problem where `scaffoldsAllowed` holds (not a review, peek or warm-up heart, `Math.tsx:1495`).

| Moment                                  | P1–P3 (forward)                                                          | P4–P8, reviews, peeks, warm-up hearts            |
| --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| First frame                             | The frame with the minuend's flowers (after the flash, if it plays)      | Same                                             |
| The read                                | The taken flowers lift on the "away" / "minus" tick                      | Nothing moves                                    |
| Wrong 1, 2                              | The picture holds still (K9)                                             | Same                                             |
| Hint 1 "Look at the flowers."           | All flowers ripple, pale ones too, at the line's start                   | Same                                             |
| Hint 2 "Six flowers."                   | They ripple again, at the line's start                                   | Same                                             |
| Hint 3 "Take away three. How many now?" | The flowers left ripple, at the line's start (nothing left to lift)      | The taken flowers lift on the line's "away" tick |
| Right tap                               | Unlifted taken flowers lift fast; the celebration is unchanged           | Same                                             |
| Given answer (3rd wrong)                | Unlifted taken flowers land pale at once; the guided chip plays as today | Same                                             |

- **A ripple** follows `CountingRow`'s flower ripple (§ 5). Sub-to-20 pulses the ten as one beat first (K8).
- **Nothing left to lift at hint 3** (a P1–P3 lift already ran, or the subtrahend is 0): the flowers left ripple instead. With nothing left either (5 − 5), nothing moves.
- **The given answer can come before hint 3:** a 3rd wrong ends the hint early (`Math.tsx:1120-1126`), so "by then hint 3 has lifted them" isn't always true. Hence "land at once".
- **Emma's poses are unchanged:** `attentive-pointing` on hints (`Math.tsx:1136`), `puzzled-tilt` on a wrong tap, `celebration` on a right one.

## 4. Word ticks: where "away" and "minus" come from

- **The read's text** is the problem's `utterances.read`, the canon line `math.pN.read`:
  - sub-to-10: "<Minuend> take away <n>. How many are left?", e.g. "Six take away three. How many are left?";
  - sub-to-20: "<Minuend> minus <n>. How many are left?".
  - The planner may serve sub-to-10 with "minus" too, chosen once per session (`api/_planner.ts:1875`). The rule below covers both.
- **The tick clock:** `speak()` passes `onWordTick(i)` through to the caller's `onWords` (`Math.tsx:706-731`). Ticks are evenly spaced across the clip, word i at `i × duration / wordCount` (`mobile/src/audio/captionClock.ts:42`), not aligned to the voice. So a lift can start up to a syllable early. Every staged read uses this same clock.
- **How the existing beats find their ticks:**
  - Addition's hints don't use word ticks. `hintBeat` is set at each hint line's start: `'group-a'` before hint 1 (`Math.tsx:1150-1151`), `'group-b'` before hint 3 (`:1181-1182`).
  - Multiplication's hint 2 counts word ticks through `onWords` (`:1155-1173`).
  - Sharing's and hundreds' reads drive their stages through `readRevealed` (`drivesStage`, `:842-850`).
  - Hundreds finds a word with `wordIndex` (lower-case, letters only, `PlaceValueStage.tsx:134-138`); more and less's lift fires when the read's last word, "less?", has ticked (`PlaceValueStage.tsx:189`).
- **This picture:**
  - `drivesStage` widens to K1's problems, so the read reports `readRevealed`.
  - The trigger is the first word that normalises to a word in `TAKE_AWAY_TICK_WORDS` (§ 7). P1–P3 lift once `readRevealed` passes that word's index.
  - Hint 3 speaks with an `onWords` callback, as multiplication's hint 2 does, and lifts on its own trigger word ("Take away three": word 1).
  - **No trigger word in a line:** the lift starts on the line's last word. A line that ends naturally ticks every word, even ones the 50 ms status cadence skipped (`mobile/src/audio/linePlayback.ts:6`), and a silent caption walk ticks them all at once (`mobile/src/audio/sessionAudio.ts:315`). So a missing word never loses the lift.
  - A read cut by a tap is K9.
  - **The flash:** a lift whose tick comes while the minuend flash still covers the row waits until the frame has faded in (§ 5). A fast or instant lift due then lands in its end state as the frame fades in.

## 5. Motion brief (Reanimated; Reduce Motion in brackets)

- **Frame in:** with no flash in scope, the frame is there from the first frame (as addition: `flowersVisible`, `Math.tsx:1511`). Under the flash it is at opacity 0, then fades to 1 over 250 ms with `EASE_OUT` once the flash completes (`CountingRow.tsx:7`). [200 ms]
- **Lift, per taken flower:** last-placed first, delay `k × 90 ms` (`BUILD_STAGGER_MS`).
  - A copy rises by the § 2 rise and fades 1 → 0 over 250 ms, `EASE_OUT` (`LIFT_MS`, `PlaceValueStage.tsx:116`).
  - Over the same 250 ms the pale flower in its cell fades 0 → 0.35.
  - The flowers that stay never move, and nothing reflows.
  - [The copy fades over 200 ms with no rise (`CHANGE_REDUCED_MS`, `:118`), so the flower turns pale in place, still 90 ms apart.]
- **Fast** (right tap): 150 ms per flower (`LIFT_FAST_MS`, `:117`), still 90 ms apart. **Instant** (given answer): the end state at once, as `leave.mode === 'instant'` (`:561`).
- **Reuse, don't re-implement:** `Block`'s `leave` motion and its rotation landing in `PlaceValueStage.tsx:544-596`. Lifting it into `extendedMotion.ts` as a shared hook is expected; `PlaceValueStage`'s behaviour and tests stay unchanged.
- **Ripple:** `CountingRow`'s flower ripple. Each flower scales 1 → 1.1 → 1, 150 + 150 ms `EASE_IN_OUT`, 150 ms after the one before (`HINT_FLOWER_PULSE_MS`, `CountingRow.tsx:29`).
  - Order: reading order, left frame then right.
  - Sub-to-20: the ten's ten flowers pulse together at 0 ms, then the loose flowers from 150 ms, 150 ms apart.
  - Pale flowers ripple at their pale opacity.
  - Longest ripple: 1,650 ms on both steps (10 flowers; or the ten plus 9).
  - A ripple that starts while the last one runs restarts each flower from its current scale.
  - [No scaling, as addition.]
- **Budget:** one shared value set per flower, at most 19 flowers on screen and 9 lifting. No new sounds.

## 6. States and edge cases

- **Rotation:** the layout recomputes and nothing replays. A flower in flight lands in its end state in the new layout (taken: pale in its cell; the rest: full, scale 1), as `PlaceValueStage.tsx:587` does.
- **Background:** when `appHidden` turns true (`Math.tsx:420`), every lift and ripple in flight lands in its end state.
  - Ticks follow the audio clock, which pauses with the voice (`captionClock.ts` header), so a read's lift that hasn't started starts on return, on its word.
  - The flash pauses and re-arms on return (`ScaffoldFlash.tsx:11`), and a lift waiting on it keeps waiting.
- **Minuend 5 − 5 (sub-to-10 P1):** all five lift and stay pale, and hint 3 has nothing left to ripple. The pale five keep "Five flowers." true.
- **Subtrahend 0** (the planner's subtract-zero category, `api/_planner.ts:1872`): nothing lifts. The read's and hint 3's lift beats do nothing, and hint 3 ripples all the flowers.
- **Take-to-decade (15 − 5, sub-to-20 P5):** the right frame empties to five pale flowers and exactly a ten is left.
- **Mixed reviews:** a sub-to-10 block and a sub-to-20 block in one session each draw their own frame (K1). On a phone the slot is fixed; on a tablet the row's height follows the step, as addition's does today.
- **Missing audio:** the caption walks silently and ticks every word (§ 4), so P1–P3 still lift.
- **Never a red X:** no cross-out, no red, no shake on the picture. Wrong taps keep poof, shake, `puzzled-tilt` and "Hmm... try again?".

## 7. Copy and canon

**No new or changed lines.** The canon and planner lines already fit the picture:

| Line (`math.pN.*`) | Text (sub-to-10 / sub-to-20)                                        | What the picture does                                         |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `read`             | "Six take away three. How many are left?" / "Eighteen minus six. …" | P1–P3: the taken flowers lift on "away" / "minus"             |
| `hint1`            | "Look at the flowers."                                              | All flowers ripple                                            |
| `hint2`            | "<Minuend> flowers."                                                | They ripple again (sub-to-20: the ten, then the ones)         |
| `hint3`            | "Take away <n>. How many now?"                                      | Lift on "away" (P4–P8, reviews), else the flowers left ripple |
| `correct`          | "Yes! <Answer>!"                                                    | Unlifted taken flowers lift fast                              |
| `giveAnswer`       | "This one is <answer>."                                             | Unlifted taken flowers land at once                           |
| `reprompt`         | "Hmm... try again?"                                                 | Nothing                                                       |

**Trigger words** (the only text the picture reads): one exported table in core, the single place a language version adds its words.

| Constant               | Language | Words           | Matched against                                                 |
| ---------------------- | -------- | --------------- | --------------------------------------------------------------- |
| `TAKE_AWAY_TICK_WORDS` | English  | `away`, `minus` | the read and hint 3, lower-cased, letters only (as `wordIndex`) |

The Danish version adds its own words to this table. Until then a Danish line has no trigger word, and the lift starts on the line's last word (§ 4), so nothing breaks. No step, copy or rule here assumes one learner.

## 8. Wiring checklist (Devon)

- **Core, new `packages/core/src/math/takeAway.ts`** (pure, vitest):
  - `takeAwaySlots(minuend, subtrahend)` returns `{ frames: 1 | 2; filled: number; taken: number[] }` (taken = slot numbers in lift order, in the frame that holds them), or `null` (K3);
  - `takeAwayTickIndex(text)`: the trigger word's index, else the last word's;
  - `TAKE_AWAY_TICK_WORDS`.
- **Layout:** `takeAwayMetrics` in `mathLayout.ts` (§ 2), with `liftRise` per form.
- **Screen:**
  - A new `mobile/src/screens/math/TakeAwayRow.tsx` in the visual row next to `CountingRow`.
  - In `Math.tsx`: K1's gate, `visualHeight` and `showVisualRow`, `drivesStage` for K1's problems, a ripple counter per hint line, hint 3's `onWords`, the lift state (read / hint 3 / fast / instant), and `visible = !showSubMinuendOverlay`.
  - testIDs:
    - `math-take-away` on the row;
    - `math-take-away-frame-ten` and `math-take-away-frame-ones` (sub-to-20), or `math-take-away-frame` (sub-to-10);
    - `math-take-away-flower-<frame>-<slot>`, suffixed `-taken` once lifted and `-pulsing` while rippling (as `CountingRow`'s group, `CountingRow.tsx:83`).
- **Unchanged on purpose:** the flash and its gate, `CountingRow`, `MissingNumber`, `PlaceValueStage`'s look, chips, distractors, Leitner, mastery, canon, the planner, the server, progress, the web.
- **Docs, in the build PR:** drop the "no visual detour" lines in `design/math/sub-to-10-content.md:20`, `:41` and `design/math/sub-to-20-content.md:23`, `:48`. Point both at this spec.

## 9. Acceptance criteria

**Core (vitest):**

1. `takeAwaySlots`:
   - 6 − 3 → 1 frame, 6 filled, taken [6, 5, 4];
   - 5 − 5 → taken [5, 4, 3, 2, 1];
   - 7 − 0 → taken [];
   - 18 − 6 → 2 frames, the right frame 8 filled, taken [8, 7, 6, 5, 4, 3];
   - 15 − 5 → the right frame's 5 all taken;
   - 14 − 7 (borrow) → `null`; 21 − 4 → `null`.
2. `takeAwayTickIndex`:
   - "Six take away three. How many are left?" → 2;
   - "Fifteen minus three. How many are left?" → 1;
   - "Seven minus three. How many are left?" → 1;
   - "Take away three. How many now?" → 1;
   - a line with neither word → its last index;
   - every `read` and `hint3` in `sub-to-10.json` and `sub-to-20.json` finds a trigger word.

**Native (jest):**

3. `takeAwayMetrics` matches § 2's table at 375×667, both landscape slots, 744×1133 and 1133×744. On every phone form the frame fits `visualSlot`. A sub-to-20 pair fits 343 pt.
4. On a phone, the equation's y is identical for an add-to-10 problem and a sub-to-10 problem, and for sub-to-10 and sub-to-20.
5. **K1:**
   - a sub-to-10 and a sub-to-20 problem draw `math-take-away`;
   - two-digit-addsub's "Fifteen minus three." draws nothing;
   - in a review, a sub-to-20 block draws while a two-digit block doesn't;
   - addition still draws `math-visual-groups`.
6. **Sub-to-10 P2 (6 − 3), forward, no flash:**
   - 6 flowers from the first frame;
   - nothing is `-taken` before the read's word 2;
   - on its tick, slots 6, 5, 4 lift 90 ms apart and end `-taken` at opacity 0.35;
   - slots 1–3 never move.
7. **With the flash in scope:** the frame's opacity is 0 while `math-sub-minuend-card` shows. A trigger tick that came earlier lifts the flowers only after the frame has faded in.
8. **Sub-to-10 P4 (8 − 2):**
   - nothing lifts on the read;
   - hint 1 and hint 2 each ripple all 8 (`-pulsing`);
   - hint 3 lifts slots 8 and 7 on its word 1.
   - On P2, hint 3 ripples slots 1–3 and nothing lifts again.
9. **Sub-to-20:**
   - P1 (11 − 1) lifts the right frame's slot 1 on "minus";
   - P8 (18 − 6) lifts at hint 3;
   - the ten frame's flowers never become `-taken` and pulse together on hints 1–2.
10. **Fading:** a review, a peek and a warm-up heart at index ≤ 3 lift nothing on the read and lift at hint 3.
11. **Taps:**
    - a wrong tap during a P1–P3 read before its trigger leaves the picture unchanged, and hint 3 lifts;
    - a right tap before any lift lifts fast (150 ms) while the celebration plays as today;
    - a 3rd wrong during hint 1 lands the taken flowers pale at once.
12. **Reduce Motion:** no rise and no ripple; the taken flowers turn pale in place over 200 ms.
13. **Rotation and background:** a rotation or `appHidden` mid-lift lands every flower in its end state, and nothing replays.
14. **Unchanged:** the existing `Math.test.tsx` (the minuend flash's tests included, e.g. `:763`), `Math.moreAndLess.test.tsx` and `Math.review.test.tsx` suites pass without edits.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP` at `sub-to-10` and then `sub-to-20`):

15. **Forms:** at 375×667, 667×375, 744×1133 and 1133×744:
    - the frames sit inside the row;
    - on a phone the equation doesn't move between problems;
    - the lift reads as flowers being taken away, not a glitch;
    - the pale flowers stay countable.
    - T1 and T2 are judged here.
16. **Reduce Motion on:** the pale-in-place form shows, and nothing scales.

## 10. Thomas decides (at the device check)

- **T1. Taken flowers: pale or gone.**
  - **Recommended:** pale, at opacity 0.35 (Dave's recommendation). Hint 2's "Six flowers." then stays true after the lift, and the whole and both parts stay on screen.
  - Gone would make hint 2 describe flowers that have left. It is a one-constant change (opacity 0) if Thomas prefers it.
  - **Prediction to grade at the check:** at arm's length on the iPad the pale flowers read as "taken" (clearly lighter than the full ones) and can still be counted, so pale is kept.
- **T2. The lift's feel.**
  - **Recommended:** wave 4's values unchanged: a copy rises 24 pt (tablet 32, phone landscape 16) and fades over 250 ms, 90 ms apart, leaving the pale flower.
  - A change is constants only.
  - **Prediction:** it reads as the same "taking away" Thomas approved in more and less, and no change is asked for.
