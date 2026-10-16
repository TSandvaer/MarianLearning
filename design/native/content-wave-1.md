# Content wave 1: missing numbers, times mix, duck words, crab words (native)

**Scope:** `@marian/core`, the native app (`mobile/`), canon, and one small server branch (§ 2.4). The web UI is frozen (§ 1.9 names the one place it changes behaviour). Layout conventions follow `design/native/greet-math-native.md`: the 375×667 / 667×375 phone floor, and tablet = shorter side ≥ 600 pt. Code is anchored by names, not line numbers.

**Source of truth for what and why:** `design/research/content-roadmap-after-path-ends.md` (Dave, 2026-10-15, merged in #569). Thomas, 2026-10-15: "work on more content for both number garden and word song". Wave 1 is Dave's first four items, in his order:

| Item | Dave's working name | What                                                                | Here |
| ---- | ------------------- | ------------------------------------------------------------------- | ---- |
| NG-A | missing numbers     | "Seven and what make ten?" inside add-to-10 and add-to-20. No step. | § 1  |
| NG-B | times mix           | A new step after `mult-6-9`: mixed × facts, Leitner picks weak ones | § 2  |
| WS-A | duck words          | A new step after `simple-sentences`: ck and ng at the end           | § 3  |
| WS-B | frog words          | A new step after duck words: start blends, short vowels             | § 4  |

**Out of scope:** code, audio renders, image generation. This spec says what to build; the build tickets do it.

## Goal

Marian gets more to learn in both worlds. The adding steps practise number bonds in a second shape, multiplication gets one mixed step where her weak facts come back, and Word Song gains 16 new picture words.

## User state entering

- **On or before add-to-20:** she meets missing-number problems inside her normal add sessions (§ 1).
- **Past add-to-20 already:** she meets them in reviews and warm-ups only, because those copy canon blocks (§ 1.7). Nothing re-locks.
- **On a world's old last step, or already finished it:** the new step opens on the next app launch and the Map plays its unlock beat (§ 5.3).

## Decisions

| #   | Call                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | **Missing numbers are 3 of 8 add problems, always at P4, P6 and P8.** P1–P3 stay plain addition (the gentle opening and the peek), and plain addition stays the majority (§ 1.2).                                                                                                                                             |
| K2  | **The read is Dave's sentence, "Seven and what make ten?", and the screen shows `7 + ? = 10`.** The answer chips are the missing part, from the unchanged `pickDistractors` (§ 1.3, § 1.6).                                                                                                                                   |
| K3  | **The missing flowers hide until hint 3.** At reveal the counting row shows group A and a "?" stone. At hint 3 the missing flowers appear as empty buds, and a right answer makes them bloom. The dot card never shows on these problems (§ 1.4).                                                                             |
| K4  | **A missing-number problem records the same fact as plain addition** (`7 + ? = 10` is `{a: 7, b: 3, op: '+'}`). It is the same bond, so one Leitner item covers both shapes (§ 1.7).                                                                                                                                          |
| K5  | **Times mix is composed from canon blocks, not written by the planner.** The live planner's Leitner directive runs for `add-to-10` only, so a canon step can't follow Leitner. Core picks 8 blocks from the four multiplication canon files, weak facts included, and the server copies them, as it does for reviews (§ 2.3). |
| K6  | **Times mix stays within 5 groups (answers up to 36), not Dave's "answers ≤ 90".** The plates picture holds at most 5 plates (`math-skip-counting-multiplication-native.md` § 1). Facts with 6–10 groups need a new picture (§ 9).                                                                                            |
| K7  | **Spoken names: "all the groups", "duck words", "crab words".** WS-B is "crab words", not "frog words": every stop has a distinct picture, and the frog is already skip counting's stop picture (`design/emmas-path/emmas-path-spec.md` § 5) (§ 5.1).                                                                         |
| K8  | **Times mix joins land 4 (Groups). Duck and crab words open a new Word Song land 6, "Big words".** A layout run shows the 6th land fits every portrait form (§ 5.2).                                                                                                                                                          |
| K9  | **Exactly 8 words per Word Song step.** Word Song sessions are always served from canon, the same 8 words every time, so a 9th word would never appear (§ 3.1).                                                                                                                                                               |
| K10 | **Traps test the new letters.** Duck words use ending twins (lock / log, wing / wig) plus Dave's vowel neighbour (sock / sack). Crab words use Dave's dropped-consonant twin where a picture can carry it (crab / cab, clock / lock, swing / wing) (§ 3.2, § 4.2).                                                            |
| K11 | **No blend clips for duck and crab words**, as for the digraph steps: the letters pulse silently, and the 2nd wrong plays the hint line (§ 3.4).                                                                                                                                                                              |
| K12 | **One short lead line before a problem's read** introduces each new thing: each new step's P1, and the first missing-number problem of a round. It reuses the warm-up line's player and timing (§ 6.1).                                                                                                                       |
| K13 | **A new step opens on load when the step before it is already mastered.** Without this it would stay `'locked'` forever, because the mastery rule never touches a locked step (§ 5.3).                                                                                                                                        |

Mastery, the fast track, the pace guard and the Map peek work on the new steps exactly as on their siblings. Nothing in this wave adds a timer, a currency, a streak or a loss mechanic.

## 1. NG-A: missing numbers in add-to-10 and add-to-20

### 1.1 What she sees and hears

Problem 4 of an add-to-10 session:

```
P  portrait (375×667)
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ● ● ◉ ○ ○ ○ ○            |
| (Emma) +-----------------+ |
| (147 ) | Seven and what  | |
|        | make ten?       | |
|        +-----------------+ |
|      7  +  ?  =  10        |   math-symbolic, 72 pt
|  ✿✿✿✿✿ ✿✿  +  ( ? )        |   group A, then the "?" stone in group B's reserved box
| [ 2 ]    [ 3 ]    [ 4 ]    |   off-by-one chips around the missing part
+----------------------------+
```

- **Lead line:** "Some flowers are hiding!" plays before the read of the first missing-number problem in a round (§ 6.1). The stage is up while it plays.
- **Read:** "Seven and what make ten?". The chips open on the read's `onPlay`, as for every Math problem.
- Every frame, size, the HUD, the ribbon, the chip row and the phone-landscape frame are Math's arithmetic ones, unchanged.

### 1.2 Session composition (canon and planner)

- **3 of 8, at P4, P6 and P8.** P1–P3 and P5, P7 stay plain addition.
- **add-to-10:** the whole is always ten (bonds to ten, "the single most important math drill" in the April diagnostic). The given part A is 1–9, so the missing part is 1–9.
- **add-to-20:** A is 6–9, the missing part is 2–5, and the whole is 11–14, so every problem crosses ten and the count-on fits on one hand.
- **No bond twice in one session**, in either shape or order: `{7, 3}` as "Seven plus three", "Three plus seven" or "Seven and what make ten?" counts once.
- **Who writes it:**
  - The canon re-bake writes both files to these rules (§ 1.8 gives the suggested plans).
  - The live planner runs only for `add-to-10` with Leitner or slow facts. Its add-to-10 shape block gets the same three rules plus the templates in § 1.3. A due fact may be written in either shape.
  - add-to-20 is always served from canon.

### 1.3 Lines per problem

| Slot       | Template                     | Example (P4, add-to-10)          | Picture beat (§ 1.4)                            |
| ---------- | ---------------------------- | -------------------------------- | ----------------------------------------------- |
| read       | "<A> and what make <T>?"     | "Seven and what make ten?"       | equation + group A + "?" stone                  |
| correct    | "Yes! <A> and <B> make <T>!" | "Yes! Seven and three make ten!" | "?" fills with 3; the buds bloom                |
| reprompt   | "Hmm... try again?"          | (existing text)                  | none                                            |
| hint1      | "Look at the flowers."       | (existing text)                  | group A ripples (`hintBeat` `'group-a'`)        |
| hint2      | "<A> flowers."               | "Seven flowers." (existing)      | group A keeps pulsing                           |
| hint3      | "How many more make <T>?"    | "How many more make ten?"        | the "?" stone gives way to B buds (`'missing'`) |
| giveAnswer | "This one is <B>."           | "This one is three." (existing)  | buds show, the equation "?" gets its ring       |

- **The correct line says the whole bond.** She found a part; hearing "Seven and three make ten" closes the part-whole loop.
- Number words are spelled out, the first word capitalised, ASCII only, as every canon line.

### 1.4 The picture: equation, counting row, dot card

**Equation:** `math-symbolic` with tokens `[A, '+', '?', '=', T]` at today's 96 / 72 / 56 pt. On a correct tap the "?" fills with B using the skip track's gap-fill (`math-skip-counting-multiplication-native.md` § 7): "?" fades out over 100 ms, then the numeral springs in from 0.6 to 1 (stiffness 260, damping 20). [Reduce Motion: a 200 ms fade.] This departs from plain addition, whose "?" stays as it is: here the filled equation is the bond itself.

**Counting row:**

- Sized by `countingMetrics(layout, A, T − A, width)`, the metrics of the matching addition, so nothing moves when the buds appear.
- Group A: A `FlowerGlyph`s, as today.
- **Group B at reveal:** one "?" stone centred in group B's reserved box. It is the skip track's "?" stone: fill `colors.myCream`, a 3 pt dashed `colors.myRose` border, "?" in Fredoka 700 `colors.myRose`. Diameter = the row's flower `size` + 8 pt, "?" at `round(0.6 × diameter)`.
- **New `BudGlyph`** in `mobile/src/screens/math/glyphs.tsx`: the `FlowerGlyph` geometry with petals filled `#FFFFFF` and stroked `#F48FB1` (1.2 viewBox units), and the centre filled `colors.myCream` and stroked `#E0B800` (0.8). It reads as "a flower that hasn't opened".
- **Why hidden until hint 3:** shown from reveal, the empty spaces would turn the problem into counting outlines. This is the same call Dave made for the number strip's numerals (`math-skip-counting-multiplication-native.md` § 10).

**Dot card:** never on a missing-number problem. `shouldShowDotCard` and `shouldShowSubitisingScaffold` return `false` for the new kind, and it never sets `subitisingScaffoldRendered`. It would show both parts, and so the answer.

### 1.5 Moments and motion (Reanimated; Reduce Motion in brackets)

| Moment                 | What moves                                                                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hint1, hint2           | Group A ripples, exactly as an addition hint (`CountingRow`'s pulse, 150 ms stagger). [no scale]                                                                                                                                                                             |
| hint3 (`'missing'`)    | The "?" stone fades out (100 ms). Then bud k fades in and scales 0.6 → 1 (200 ms, `EASE_OUT`) at 150 × k ms, and the buds ripple once with the existing pulse. [fades only]                                                                                                  |
| correct                | Any bud not yet shown appears at once. Bud k crossfades to a `FlowerGlyph` (150 ms) while scaling 1 → 1.15 → 1 (spring, stiffness 300, damping 14) at 80 × k ms. The equation "?" fills (§ 1.4). The chip burst, sparkle and plink are today's. [200 ms crossfade, no scale] |
| giveAnswer (3rd wrong) | The buds show if hint 3 didn't play (200 ms fade). The equation's "?" gets a 4 pt `colors.myRose` ring, like the glowing chip. The guided tap then plays the correct moment.                                                                                                 |
| advance                | Today's 250 ms Math exit. Everything resets per problem.                                                                                                                                                                                                                     |

The staggers are Reanimated `withDelay`s, so no new JS timer is needed. Emma's poses are today's: `listening` during the lead and the read, `celebration`, `puzzled-tilt`, `attentive-pointing`.

### 1.6 Data model, parser and chips

- **New kind** in `packages/core/src/math/extendedProblems.ts`, opt-in through `{ extendedKinds: true }` like the others:

  ```ts
  export interface MissingAddendProblem {
    kind: 'missing-addend'
    index: number // 1..8
    addendA: number // the given part, 1..19
    total: number // the whole, 2..20
    correct: number // total − addendA, the missing part, ≥ 1
    utterances: MathProblemUtterances
  }
  ```

  `ExtendedMathProblemKind` gains `'missing-addend'`.

- **Read template:** `/^\s*([a-z-]+)\s+and\s+what\s+make\s+([a-z-]+)\s*\?\s*$/i`, number words through `wordToNumber`. It is valid when 1 ≤ A < T ≤ 20. It is disjoint from the four existing templates (none contains "and what make").
- **Before merge:** every canon `math.p*.read` of both re-baked files parses (8/8 each), per `sibling-tier-checklist.md` ("Math read-line template … REQUIRED").
- **Chips:** `pickDistractors(correct, index, chipMax)` unchanged, with `correct` = the missing part. P1–P3 are gentle, P4–P8 off-by-one, and the offered class is `'off-by-one'`. Every missing-number problem sits at P4–P8, so it always gets the count-on slip (Dave's add-to-20 research: off-by-one is her main error).
- **`buildChipOrder`** takes the new kind like arithmetic (same LCG and seed).

### 1.7 Leitner, history, warm-up, review, peek

- **Fact:** `{ a: addendA, b: correct, op: '+' }`, the same key as plain addition (K4). `CANON_MATH_FACTS` is regenerated from the re-baked files.
- **One Leitner outcome per fact per session,** from its first occurrence. § 1.2 already forbids repeats; this rule covers a planner that drifts. It is the warm-up's existing rule (`review-mode-and-warmup-native.md` § 7.4), extended to scored problems.
- **History:** `perProblemAnswerValue` is the tapped value, `mathFacts` gets the fact, and `latencyMs` is recorded as today. Slow-fact derivation sees these latencies under the same fact. That is accepted: a bond she is slow on is a bond to practise.
- **Warm-up:** `blockFor(fact, …)` can now pick a missing-number block as a heart. The heart's own "Remember this one?" plays, and the hiding lead does not (one lead per problem).
- **Review:** missing-number blocks come up through `rot(seed)` like any block. The hiding lead plays before the first one in the round.
- **Peek:** add-to-10 and add-to-20 peeks are P1–P3, plain addition, so they don't change.
- **Fast track and mastery:** unchanged. A secure session needs all 8 right on the first tap, these 3 included.

### 1.8 Suggested canon (the bake may differ; the rules in § 1.2 are binding)

| File      | P1    | P2    | P3    | P4             | P5    | P6             | P7    | P8             |
| --------- | ----- | ----- | ----- | -------------- | ----- | -------------- | ----- | -------------- |
| add-to-10 | 1 + 2 | 2 + 2 | 3 + 2 | **7 + ? = 10** | 4 + 4 | **6 + ? = 10** | 4 + 5 | **8 + ? = 10** |
| add-to-20 | 9 + 2 | 8 + 3 | 6 + 6 | **9 + ? = 13** | 8 + 5 | **7 + ? = 12** | 7 + 8 | **6 + ? = 11** |

P1–P3, P5 and P7 keep their current canon blocks and audio. Dropped from today's canon: add-to-10's 2 + 4, 5 + 5 and 3 + 7 (3 + 7 would repeat the bond of P4), and add-to-20's 9 + 4, 6 + 7 and 9 + 8.

### 1.9 Web consequence (for Matt)

The frozen web reads plans without `extendedKinds`, so a missing-number read throws there and the web's add-to-10 and add-to-20 fall back to their silent static plan. This is how the web already treats the skip-counting and multiplication steps. Marian plays native only (since 2026-10-14). The alternative, a web-only canon, costs a second file per step for a surface nobody plays.
