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
| K6  | **Times mix stays within 5 groups (answers up to 36), not Dave's "answers ≤ 90".** The plates picture holds at most 5 plates (`math-skip-counting-multiplication-native.md` § 1). Facts with 6–10 groups need a new picture, which is wave-2 work (§ 2.2, § 12 D2).                                                           |
| K7  | **Spoken names: "all the groups", "duck words", "crab words".** WS-B is "crab words", not "frog words": every stop has a distinct picture, and the frog is already skip counting's stop picture (`design/emmas-path/emmas-path-spec.md` § 5) (§ 5.1).                                                                         |
| K8  | **Times mix joins land 4 (Groups). Duck and crab words open a new Word Song land 6, "Big words".** A layout run shows the 6th land fits every portrait form (§ 5.2).                                                                                                                                                          |
| K9  | **Exactly 8 words per Word Song step.** A new Word Song step is served from canon on every session, the same 8 words every time, so a 9th word would never appear (§ 3.1).                                                                                                                                                    |
| K10 | **Traps test the new letters.** Duck words use ending twins (lock / log, wing / wig) plus Dave's vowel neighbour (sock / sack). Crab words use Dave's dropped-consonant twin where a picture can carry it (clock / lock, swing / wing) (§ 3.2, § 4.2).                                                                        |
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
  - Of the two add steps, only `add-to-10` reaches the live planner, when Leitner or slow facts are due (`isLeitnerDirectiveActive`, `isSlowFactDirectiveActive`). Its add-to-10 shape block gets the same three rules plus the templates in § 1.3. A due fact may be written in either shape.
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
- **One Leitner outcome per fact per session,** from its first occurrence, in every forward session on every step. § 1.2 already forbids repeats in an add session; this rule covers a planner that drifts and a times-mix fill that draws a warm-up fact. It is the warm-up's existing rule (`review-mode-and-warmup-native.md` § 7.4), extended to scored problems. A review can't repeat a fact (`pickReviewBlocks` skips one).
- **History:** `perProblemAnswerValue` is the tapped value, `mathFacts` gets the fact, and `latencyMs` is recorded as today. Slow-fact derivation sees these latencies under the same fact. That is accepted: a bond she is slow on is a bond to practise.
- **Warm-up:** `blockFor(fact, …)` can now pick a missing-number block as a heart. The heart's own "Remember this one?" plays there, and the hiding line moves to the round's next missing-number problem (§ 6.1).
- **Review:** missing-number blocks come up through `rot(seed)` like any block. The hiding line plays before the first one in the round whose slot is free (a missing-number block at P1 holds the review opener).
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

## 2. NG-B: times mix (`mult-mix`)

### 2.1 The step

- **SkillNode `mult-mix`**, after `mult-6-9` in `MATH_TREE` and `MATH_NODES_IN_ORDER`. Default level `'locked'`.
- **Spoken name** "all the groups", verb **are** ("All the groups are for later. You will learn it!"). `FRIENDLY_NODE_NAMES` (the recap): "counting in groups", as for the other three times steps.
- **Map:** the 4th stop of land 4, Groups (§ 5).
- **What a problem is:** an existing multiply problem, unchanged: "Seven times four. How many?", `7 × 4 = ?` above 4 plates of 7 flowers, three chips (`math-skip-counting-multiplication-native.md` § 3–§ 5).
- **Tags and "+" show from reveal on every problem**, the `mult-6-9` rule. 12 of the 28 pool facts have groups of 6–9, which she can't see at a glance, and one rule for the whole session keeps the picture the same from problem to problem.
- **Chips:** today's multiply rule (§ 4 of that spec), with the times-mix ceiling **M = 40** for every problem in the session (largest answer 36, so `10 × ceil(37 / 10)`). `MULTIPLICATION_FOCUS_NODES` (`packages/core/src/wire/leitnerFocus.ts`) gains `mult-mix`, so `*` facts may ride its requests.
- **Mastery, fast track, pace guard, peek:** the sibling steps' rules, unchanged (math preset).

### 2.2 The fact pool (28 facts)

The pool is every canon block of `MIX_SOURCE_STEPS = ['mult-2-5-10', 'mult-3-4', 'mult-6-9', 'mult-mix']` whose fact has `op: '*'`, a factor A of 2–9 and B of 2–5 groups, kept once per fact key (the first block in that step order).

| Source file   | Facts in the pool                                  | Count |
| ------------- | -------------------------------------------------- | ----- |
| `mult-2-5-10` | 2×2, 2×3, 5×2, 2×5, 5×4 (5×1, 10×1, 10×2 left out) | 5     |
| `mult-3-4`    | 3×2, 3×3, 4×2, 2×4, 3×4, 4×3, 4×4 (2×3 already in) | 7     |
| `mult-6-9`    | 6×2, 7×2, 8×2, 6×3, 7×3, 9×2, 8×3, 9×3             | 8     |
| `mult-mix`    | 5×3, 4×5, 6×4, 3×5, 7×4, 5×5, 8×4, 9×4 (new canon) | 8     |

"A × B" is B plates of A (the canon's reading, no commutative flip). The new `mult-mix` canon file fills the gaps in A 2–9 × B 2–5 that no file covers. Four gaps stay open in wave 1: 6×5, 7×5, 8×5 and 9×5 (answers 30–45). A canon file holds 8 problems, and these four are the heaviest pictures (up to 45 flowers).

**Suggested `mult-mix` canon order** (easier to harder; P1–P3 are what the peek plays): P1 5×3, P2 4×5, P3 6×4, P4 3×5, P5 7×4, P6 5×5, P7 8×4, P8 9×4.

- Its lines follow the planner's generic-tier templates exactly. hint2 goes by group count: "Six, six, six, six." for 6×4, "Three, three, three, three, three." for 3×5.
- P4–P8 chips by today's rule: 3×5 [8, 16], 7×4 [11, 27], 5×5 [10, 26], 8×4 [12, 31], 9×4 [13, 37].
- The P1–P3 values come from `pickDistractors`'s gentle tier with M = 40, and a unit test pins them.

### 2.3 Composing a session: `pickMixBlocks`

New pure function in `packages/core/src/progress/reviewPlan.ts`, beside `pickReviewBlocks`:

```ts
export const MIX_SOURCE_STEPS: readonly NumberGardenNode[]
export function pickMixBlocks(
  p: Progress,
  nowMs: number,
  seed: number,
  warmup: readonly CanonBlockRef[], // this session's warm-up refs (0–2)
): CanonBlockRef[] // exactly 8
```

`strength(f)` = the fact's Leitner box (1–5), or 0 when it isn't in `mathFactsLeitner` (never played).

1. **P1–P3, the gentle opening:** the 3 facts with strength ≥ 2 and the highest strength. Ties go to the smaller product, then the key `${a}*${b}` ascending. If fewer than 3 qualify, fill with the smallest-product facts not yet picked. The three play in product order, smallest first. **Why:** the session opens on facts she got right before, the same reasoning as the warm-up's first heart (Thomas, 2026-10-14).
2. **P4–P8, the weak facts:**
   1. Due facts first, ranked exactly as `rankedDueFacts` (overdue days, then box, then key), up to `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's fact count (the shared cap of 3, `review-mode-and-warmup-native.md` § 7.4). Warm-up facts and P1–P3 picks are skipped here: a warm-up fact has already used its share of the cap.
   2. Then the lowest strength first (never-played facts count as 0), skipping facts already picked. Ties are broken by pool index rotated by the seed, `(index + seed) % pool.length` ascending, so sessions vary. A warm-up fact may be drawn here (or in P1–P3). A heart she missed (box 1) usually comes back, which is the same-session re-exposure Dave asked for (review spec § 1, 2026-10-14). Leitner records it once, from the heart.
3. **Order P4–P8:** of all orders of the five picks, use the one with the fewest neighbours sharing A (P3 and P4 count as neighbours). Ties go to the order that comes first when compared pick by pick in step 2's order. When a no-repeat order exists this is the first one, and it equals the greedy pass (take the next pick whose A differs from the problem before it) whenever that pass finishes without a repeat. Example: after a 3, the picks with A 4, 2, 3, 4, 4 play as 4, 2, 4, 3, 4. Adjacent problems come from different tables whenever possible (Dave's M4: mixed practice).

`seed` is `readSessionHistory().sessionCount` at kick time, as for reviews. It is the same at prefetch and at the tap, so both ask for the same refs.

**Worked example (a made-up box, for illustration):** she has played the three times steps. 4×4, 2×5 and 3×3 sit in box 3, 9×3 and 7×3 are box 1 (due), and the 8 `mult-mix` facts are unplayed.

- P1–P3 = 3×3, 2×5, 4×4 (all box 3, so product order: 9, 10, 16).
- P4–P8 = 7×3 and 9×3 (due, box 1), then three unplayed facts by rotated pool index, reordered so no two neighbours share A.

### 2.4 Wire, server, client

- **Wire** (`packages/core/src/wire/types.ts`): `MIX_BLOCK_COUNT = 8`, `MIX_PLAN_ID_PREFIX = 'mix-'`, and an optional `mix?: { blocks: CanonBlockRef[] }` on the session-start track payload: exactly 8 refs, each a step in `MIX_SOURCE_STEPS`.
- **Server** (`api/_review.ts`, the responder that reviews and peeks already share): `mix` runs as step 0, before the canon lookup, the session cache and the rate limiter.
  - It copies the 8 blocks with their baked audio, renamed `math.p1..p8.`, plus `mult-mix`'s `session.end.*` utterances, so the plan carries everything a canon forward plan does.
  - It returns plan id `mix-math` and label `Times mix`. Warm-up refs are appended afterwards, as for any forward response.
  - No Anthropic call, no TTS and no cache write. A bad ref is 400 `invalid-request`.
- **Client:** `sessionPlanKind` returns `{ kind: 'forward', warmup, mix }` when the forward focus is `mult-mix`. The math session start sends `mix` with the warm-up refs.
  - A plan whose id starts with `mix-` and parses to 8 problems is the session.
  - **Any other forward plan is accepted as-is.** An old server ignores `mix` and serves `mult-mix`'s own canon: still times mix, just the same 8 every day.
  - No Leitner hint is sent with `mix`: the blocks already carry the due facts.
- **Screen:** `problemNodes` is `mult-mix` for all 8 problems (chips, ceiling, tags), whichever file a block came from.
- **Session end:** a normal forward write. `skillFocus` is `['mult-mix']`. `problemFacts` (the review's nullable per-problem field) carries the 8 facts, because `planFacts` assumes one source file. Leitner records each fact once.
- **Ship order:** `yarn release` before the device check.

### 2.5 Review, warm-up, peek

- **Peek:** `pickPeekBlocks('mult-mix')` = its canon P1–P3 (5×3, 4×5, 6×4). Opener "Let's look at all the groups!", closer "All the groups are for later. You will learn it!".
- **Review:** once mastered, `mult-mix` is in the review pool with its own 8 canon blocks.
- **Warm-up:** unchanged. `blockFor(fact, [C, ...S])` searches `mult-mix`'s canon first, then the mastered steps.

## 3. WS-A: duck words (`duck-words`)

### 3.1 The step

- **SkillNode `duck-words`**, after `simple-sentences` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`. Default `'locked'`.
- **Spoken name** "duck words", verb **are** (the pattern of "cat words", "ship words": the step is named after its stop picture). Recap phrase: "reading words".
- **Map:** the 1st stop of the new land 6, "Big words" (§ 5).
- **Format:** the `cvc-word` content type as it is: "Read the duck.", a word card with the letter row, three picture chips. The 1500 ms silent beat, the chip gate, the hint, the given answer and the sounds are all today's.
- **Words: exactly 8**, one per problem (K9). A Word Song step is served from canon on every session. The live planner runs only for the cvc-words graduation session and per-vowel letter sounds (`api/claude.ts`, `bypassCanonAndCache`). So each step is the same 8 words in the same order, and reviews copy those blocks.
- **Mastery, fast track, pace guard, peek:** the sibling rules. No graduation gate (`WORD_SONG_GRADUATION_GATED_NODES` stays `{ 'cvc-words' }`).

### 3.2 Word list and distractor matrix (canon order)

The table order is the canon order: P1–P3 use the gentle pair, P4–P8 the trap pair. Every word still needs both pairs, because a review moves blocks to other positions.

| P   | Word | Ending | Vowel | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap                                         |
| --- | ---- | ------ | ----- | --------- | -------------- | ------------ | ---------------------------------------------------- |
| 1   | duck | ck     | u     | animal    | pen, box       | dog, sock    | dog: same first letter; sock: same ending            |
| 2   | rock | ck     | o     | object    | hen, cup       | sock, rug    | sock: rhyme; rug: same first letter                  |
| 3   | ring | ng     | i     | object    | dog, hat       | king, rock   | king: rhyme; rock: same first letter                 |
| 4   | sock | ck     | o     | clothing  | fan, bug       | sack, rock   | sack: Dave's vowel neighbour; rock: rhyme            |
| 5   | wing | ng     | i     | body-part | box, pan       | wig, king    | **wig: the same word without the n**; king: rhyme    |
| 6   | king | ng     | i     | person    | bus, pot       | ring, wing   | both rhymes: read the first letter                   |
| 7   | lock | ck     | o     | household | fan, web       | log, rock    | **log: the same start, g for ck**; rock: rhyme       |
| 8   | sack | ck     | a     | object    | pig, jet       | sock, sun    | sock: Dave's vowel neighbour; sun: same first letter |

- **Gentle pairs** follow the CVC rule: another category, another first sound, another vowel. (king's gentle pair avoids `cup`, whose /k/ matches.)
- **Traps:** Dave suggests the vowel neighbour (sock / sack). A vowel neighbour needs a picture too, and only sock / sack has one that reads. The other traps share the ending (rhymes) or swap the new ending for a known one (lock / log, wing / wig), so she has to read to the end of the word, which is this step's new skill.
- **Dropped from Dave's examples:** _neck_. No picture of a neck reads as "neck" rather than "giraffe" or "scarf" at 96 pt.
- **Every word takes "Yes! That's a <word>."**, so the celebration exception list doesn't grow.

### 3.3 Intro lead

"Two letters, one sound!" plays before P1's silent beat in every forward session on the step until it is mastered (§ 6.1). While Emma says it, the word's last two cells (c k / n g) light together on the rose spotlight (`LetterRow`'s lit state, both cells, 120 ms fade in, out 200 ms after the line ends). [Reduce Motion: the spotlight still shows, without the pulse.] Then the 1500 ms silent beat, then "Read the duck."

### 3.4 No blend clip

The CVC blend ("c - a - t ... cat") is 3 sounds and the word, cut by 4 measured marks (`word-song-native.md` § 5). Duck words have 4 letters for 3 sounds, and an isolated /ŋ/ has never been ear-tested. So, like the digraph steps, there is no `word.p*.blend`: the letters pulse silently, and the 2nd wrong plays the hint line ("Let's look. Duck."). A blend for these words is wave-2 work with its own ear test.

### 3.5 Pictures

All 8 words are new pictures (none is in `mobile/assets/pictures/`, checked with `ls` on 2026-10-16). Every distractor above already has one there: pen, box, dog, hen, cup, rug, hat, fan, bug, wig, pan, bus, pot, web, log, pig, jet, sun. Prompts: § 8.

## 4. WS-B: crab words (`crab-words`)

### 4.1 The step

- **SkillNode `crab-words`**, after `duck-words`. Default `'locked'`.
- **Spoken name** "crab words", verb **are**. Not "frog words": the frog is skip counting's stop picture, and no picture repeats on the path (`emmas-path-spec.md` § 5). The crab is new, and _crab_ has short **a**, her strongest vowel. Recap phrase: "reading words".
- **Map:** the 2nd stop of land 6 (§ 5).
- **Format, mastery, fast track, peek:** as duck words (§ 3.1). Start blends only, short vowels only (Dave). Every word keeps its short vowel in British English too. The voice is British, and that is also why _sled_ is out (§ 4.2).

### 4.2 Word list and distractor matrix (canon order)

| P   | Word  | Blend | Vowel | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap                                                          |
| --- | ----- | ----- | ----- | --------- | -------------- | ------------ | --------------------------------------------------------------------- |
| 1   | flag  | fl    | a     | object    | cup, web       | frog, bag    | frog: f with r for l; bag: rhyme with one first letter                |
| 2   | drum  | dr    | u     | object    | hat, fox       | plum, dog    | plum: rhyme with another blend; dog: d without the r                  |
| 3   | brick | br    | i     | object    | sun, hat       | crab, clock  | crab: the same r; clock: the same ending                              |
| 4   | crab  | cr    | a     | animal    | sun, pen       | clock, frog  | clock: cl for cr, so the second letter decides; frog: another r-blend |
| 5   | swing | sw    | i     | structure | pot, bug       | wing, king   | **wing: swing without the s**; king: rhyme                            |
| 6   | plum  | pl    | u     | food      | cat, hen       | drum, pig    | drum: rhyme with another blend; pig: p without the l                  |
| 7   | clock | cl    | o     | household | bun, jet       | lock, sock   | **lock: clock without the c**; sock: rhyme                            |
| 8   | frog  | fr    | o     | animal    | cup, bed       | dog, flag    | dog: rhyme without the blend; flag: f with l for r                    |

- **Dave's dropped-consonant twin** (R4: frog read as "fog") is the trap wherever its picture reads: swing / wing, clock / lock. _wing_ and _lock_ arrive with duck words, one step earlier.
- **Twins left out:**
  - _cab_ (Dave, 2026-10-16). It is never spoken, and an L2 child calls it "taxi". crab's trap is _clock_ instead, which tests the second letter as flag / frog does.
  - _fog_ (a fog picture reads as a cloud).
  - _rib_ (and with it _crib_; neither picture reads at 96 pt).
  - _flag_'s twin without the l, never (Dave).
  - For frog, the trap is _dog_: the rhyme without the blend tests the same thing.
- **Dropped from Dave's list:**
  - _swim_ (a verb, so "Yes! That's a swim." breaks; _swing_ takes its sw).
  - _sled_ (the British word is "sledge").
  - _crib_ and _clam_ (weak vocabulary, no twin with a picture).
- **Added:** _flag_, _clock_ and _swing_ (each with a twin or a strong rhyme).
- **Every target takes "Yes! That's a <word>."**

### 4.3 Intro lead

"Read all the letters!" plays before P1's silent beat in every forward session on the step until it is mastered. While Emma says it, the cells light one after another from the left, 150 ms apart (each a 120 ms fade in), and all go dark 200 ms after the line ends. [Reduce Motion: they light at once.] **Why:** the trap this step sets is skipping the second letter. "All the letters" says what to do about it in words she knows.

### 4.4 Pictures

All 8 targets are new pictures (none is in `mobile/assets/pictures/`, checked with `ls` on 2026-10-16). Already there: cup, web, bag, hat, fox, dog, sun, pen, pot, bug, cat, hen, pig, bun, jet, bed. Ready by then from duck words: wing, king, lock, sock. No blend clip (§ 3.4).

### 4.5 New forbidden pairs (both steps)

Added to `FORBIDDEN_PAIRS` before the matrix is coded. Thomas's picture review may add more.

| Pair        | Why                                       |
| ----------- | ----------------------------------------- |
| duck – hen  | both birds in side view                   |
| sack – bag  | both bags                                 |
| lock – bag  | a padlock's shackle reads as a bag handle |
| ring – gem  | the ring carries a gem                    |
| king – man  | both human figures                        |
| king – dad  | both human figures                        |
| king – mom  | both human figures                        |
| rock – egg  | both rounded lumps                        |
| clock – fan | a round face on a stand, both             |
| drum – can  | both cylinders                            |
| drum – tub  | both cylinders                            |
| plum – fig  | both purple fruits with a stem            |
| flag – net  | both a pole with something at the top     |
| brick – box | both rectangular blocks                   |

No trio in § 3.2 or § 4.2 contains a forbidden pair, old or new.

## 5. Map, lands and path art

### 5.1 Placement

| Step         | World         | Land                   | Stop in its land | New path art            |
| ------------ | ------------- | ---------------------- | ---------------- | ----------------------- |
| `mult-mix`   | Number Garden | 4, Groups              | 4th of 4         | stop picture            |
| `duck-words` | Word Song     | **6, Big words (new)** | 1st of 2         | stop picture            |
| `crab-words` | Word Song     | 6, Big words           | 2nd of 2         | stop picture            |
| (land 6)     | Word Song     | —                      | —                | land emblem `land-ws-6` |

- `LANDS` (`packages/core/src/progress/lands.ts`): land 4 gets `'mult-mix'` at the end, and a new entry follows land 5: `{ world: 'word-song', number: 6, name: 'Big words', nodes: ['duck-words', 'crab-words'] }`. `lands.test.ts` locks it against the trees.
- **Why a new land, not land 5 "Sentences":** the land name is spoken ("Land 6: Big words."), and these steps aren't sentences. Dave's next two phonics steps (jump words, cake words) join this land, which then holds 4 stops. "Big words" uses only words she already hears: these words are longer than the 3-letter ones.
- **Why times mix stays in Groups:** it is the groups' last step, and Dave's next step (sharing) uses the same plates, which would make 5 stops, the most a land has today (Word Song land 3).

### 5.2 Does the map still fit? (layout run)

Measured with core's `layoutMap`, native `mapScreenLayout` and `mapPathScale` on the real models, with a 2-stop 6th land or a 4th Groups stop added (a scratch script, not committed). The clearance is the smallest box-to-box gap between two stops, in pt.

| Device (insets)    | World         | Today: stop / tightest gap between lands | Wave 1: stop / tightest gap between lands |
| ------------------ | ------------- | ---------------------------------------- | ----------------------------------------- |
| 375×667            | Word Song     | 40.2 / 40.4                              | 40.2 / 24.8                               |
| 430×932 (t59 b34)  | Word Song     | 51.9 / 63.3                              | 46.1 / 48.0                               |
| 820×1180 (t24 b20) | Word Song     | 88 / 67.2                                | 88 / 36.9                                 |
| 744×1133 (t24 b20) | Word Song     | 79.8 / 68.9                              | 79.8 / 39.9                               |
| 375×667            | Number Garden | 46.6 / 57.1                              | 46.6 / 57.1                               |

- Worst case shown: current = `simple-sentences`, the last stop of land 5 (Number Garden: `mult-6-9`; every current step gives the same gap there).
- No stop overlaps another on any portrait form, and every stop keeps a ≥ 44 pt hit area (stops under 44 pt already get `hitSlop`).
- Within a land, the tightest Number Garden gap goes from 20.4 to 15.9 pt at 375×667.
- Phone landscape already scrolls; it scrolls further.

### 5.3 A new step opens on load when the step before it is mastered (K13)

**Rule.** In both read-path defaulters (`withDefaultedSkillLevels` in `progress/storage.ts` and its copy in `progress/cloudSync.ts`):

- When a step's key is **missing** from the stored `skillLevels` and its tree predecessor's stored level is `'mastered'`, fill `'intro'` instead of `'locked'`.
- A key that is already stored is never touched.

**Why:**

- The mastery rule's passes walk `'intro'` and `'practicing'` steps only. A step leaves `'locked'` only when its predecessor masters.
- A world finished before this build would therefore put Marian on a locked step with no way forward. The Hub and the focus picker both pick the first step that isn't mastered.

**What she sees:**

- The new step is open and not in `unlocksCelebrated`, so the Map plays the existing unlock beat on its next visit:
  - "You learned big groups! Now you can do all the groups!"
  - For duck words it is the land beat, "A new land! Land 6: Big words!", with the gate opening.
- The Hub card shows the new step with an empty tray.
- A world that was complete isn't any more. Its "You did all of it!" map line stops, and "You grew your whole garden!" moves to the new last step.
- A doc with no `unlocksCelebrated` list plays nothing (the existing rule in `pathBeats.ts`).

### 5.4 New path art (4 pieces, clay set)

Same pipeline as the 24 stops and 9 emblems: a source PNG → `scripts/build-path-art.ts` → `public/assets/path/<id>-256.webp` and `-512.webp` → `npm run export-assets` in `mobile/` (it writes the `-muted` and `-locked` copies). `PATH_ART_SET` gets the three step ids, and `LandArtId` gets `'land-ws-6'`. `pathArt.test.ts` fails until the files exist. Pictures only: no digits, letters or signs (`emmas-path-spec.md` § 5).

| Id           | Picture                                                                                                                                 | Must not look like                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mult-mix`   | A clay fruit basket holding a pair of cherries, a bunch of three bananas and a bunch of grapes: groups of different sizes together      | the octopus (`mult-6-9`), the clovers, the socks                                                            |
| `duck-words` | A clay duck with a soft green head, a brown body and an orange bill, floating on a small blue water ripple (the picture word's colours) | the yellow chick (`digraphs-ch`): **never yellow**; not white, which the white-background cut-out would eat |
| `crab-words` | A clay coral-red crab with both claws up                                                                                                | —                                                                                                           |
| `land-ws-6`  | A clay toy train, an engine and two carriages, with no letters or numbers                                                               | the block tower (`land-ws-1`)                                                                               |

Generate them as the clay set was made (Thomas's tool choice), with the matching sibling icon as the style reference. They are not part of the v7 picture pack in § 8.

## 6. Copy / TTS script

### 6.1 Lead lines (one mechanism for K12)

A **lead line** plays before a problem's read, with the stage up. It reuses the warm-up line's player and timing (`review-mode-and-warmup-native.md` § 4: `createManifestLinePlayer('session-guide', …)`, a caption walk at 165 wpm when there is no clip, Emma `listening`, the back button cancels it).

- **Timing:** the lead ends → 400 ms → the read. On a `cvc-word` problem, the 1500 ms silent beat starts when the lead ends and replaces the 400 ms, so the decode-first beat is kept in full.
- **At most one lead per problem.** Priority: a review's or peek's opener (it holds P1), then a warm-up heart's "Remember this one?", then a step intro, then the hiding line. The hiding line moves to the round's next missing-number problem with a free slot, and doesn't play if none is left. A step intro never loses its slot: it sits on scored P1 of a forward session, which is never a heart.
- **Never in a peek** (a peek has its own opener) and never on a warm-up heart other than its own line.

| Line id                          | Text                         | Before which problem                           | In which rounds                                       |
| -------------------------------- | ---------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `guide.session.intro.mult-mix`   | "Let's play all the groups!" | scored P1                                      | forward sessions on `mult-mix` until it is mastered   |
| `guide.session.intro.duck-words` | "Two letters, one sound!"    | scored P1 (with the last two cells lit, § 3.3) | forward sessions on `duck-words` until it is mastered |
| `guide.session.intro.crab-words` | "Read all the letters!"      | scored P1 (cells lit left to right, § 4.3)     | forward sessions on `crab-words` until it is mastered |
| `guide.session.hiding`           | "Some flowers are hiding!"   | the first missing-number problem of the round  | forward and review rounds                             |

**Why every session until mastered, not only the first:** a step usually takes 2–3 days, and a short, predictable line each time is a ritual, not a nag. The line names the step's idea right before she needs it. New kinds in `GUIDANCE_LINES`: `'session-intro'` and `'session-hiding'`.

### 6.2 Every new spoken line (for the Lily render)

132 distinct texts, 3049 characters: one row per distinct text, and a text several slots share is rendered once. Generated from the line lists in this spec and compared against every existing text in `GUIDANCE_LINES`, `PATH_LINES` and `public/canon/*/level-1/*.json` on 2026-10-16 (scratch script, not committed). 42 slots reuse an existing text and its audio, for example "Look at the flowers.", "Seven flowers.", "This one is three.", "How many?", "Yes! Fifteen!" and "Hmm... try again?".

- **Guidance rows** render with `scripts/renderGuidanceLinesLily.ts`.
- **Path rows** render with `scripts/renderPathLinesLily.ts`. Rows 13, 18 and 23 (`path.locked.next.*`) have not played since #568, but `pathLines.test.ts` requires an MP3 for every baked path line, so they are rendered too. The test's count goes from 141 to 159.
- **Canon rows** come from the canon bake (`scripts/generateSessionCanon.ts`, then `scripts/revoiceCanonLily.ts`). Unchanged texts keep their bytes.

**New words** (bold = a new core word, italic = a new target word):

| #   | Surface            | Line id                               | Text                                                        | New words                        |
| --- | ------------------ | ------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| 1   | guidance           | `guide.session.peek-open.mult-mix`    | "Let's look at all the groups!"                             | –                                |
| 2   | guidance           | `guide.session.peek-close.mult-mix`   | "All the groups are for later. You will learn it!"          | –                                |
| 3   | guidance           | `guide.session.peek-open.duck-words`  | "Let's look at duck words!"                                 | _duck_ (target)                  |
| 4   | guidance           | `guide.session.peek-close.duck-words` | "Duck words are for later. You will learn it!"              | _duck_ (target)                  |
| 5   | guidance           | `guide.session.peek-open.crab-words`  | "Let's look at crab words!"                                 | _crab_ (target)                  |
| 6   | guidance           | `guide.session.peek-close.crab-words` | "Crab words are for later. You will learn it!"              | _crab_ (target)                  |
| 7   | guidance           | `guide.session.intro.mult-mix`        | "Let's play all the groups!"                                | –                                |
| 8   | guidance           | `guide.session.intro.duck-words`      | "Two letters, one sound!"                                   | –                                |
| 9   | guidance           | `guide.session.intro.crab-words`      | "Read all the letters!"                                     | –                                |
| 10  | guidance           | `guide.session.hiding`                | "Some flowers are hiding!"                                  | **some**, **hiding**             |
| 11  | path               | `path.open.mult-mix`                  | "Here is your path! You are on all the groups."             | –                                |
| 12  | path               | `path.stop.mult-mix`                  | "All the groups."                                           | –                                |
| 13  | path               | `path.locked.next.mult-mix`           | "All the groups! First, big groups. Then this!"             | –                                |
| 14  | path               | `end.bud.mult-mix`                    | "Look! A new flower for all the groups!"                    | –                                |
| 15  | path               | `end.unlock.mult-mix`                 | "You learned big groups! Now you can do all the groups!"    | –                                |
| 16  | path               | `path.open.duck-words`                | "Here is your path! You are on duck words."                 | _duck_ (target)                  |
| 17  | path               | `path.stop.duck-words`                | "Duck words."                                               | _duck_ (target)                  |
| 18  | path               | `path.locked.next.duck-words`         | "Duck words! First, reading sentences. Then this!"          | _duck_ (target)                  |
| 19  | path               | `end.bud.duck-words`                  | "Look! A new flower for duck words!"                        | _duck_ (target)                  |
| 20  | path               | `end.unlock.duck-words`               | "You learned reading sentences! Now you can do duck words!" | _duck_ (target)                  |
| 21  | path               | `path.open.crab-words`                | "Here is your path! You are on crab words."                 | _crab_ (target)                  |
| 22  | path               | `path.stop.crab-words`                | "Crab words."                                               | _crab_ (target)                  |
| 23  | path               | `path.locked.next.crab-words`         | "Crab words! First, duck words. Then this!"                 | _crab_ (target), _duck_ (target) |
| 24  | path               | `end.bud.crab-words`                  | "Look! A new flower for crab words!"                        | _crab_ (target)                  |
| 25  | path               | `end.unlock.crab-words`               | "You learned duck words! Now you can do crab words!"        | _duck_ (target), _crab_ (target) |
| 26  | path               | `path.land.word-song.6`               | "Land 6: Big words."                                        | –                                |
| 27  | path               | `end.land.word-song.6`                | "A new land! Land 6: Big words!"                            | –                                |
| 28  | path               | `end.land.word-song.6.no-number`      | "A new land: Big words!"                                    | –                                |
| 29  | canon `add-to-10`  | `math.p4.read`                        | "Seven and what make ten?"                                  | **make**                         |
| 30  | canon `add-to-10`  | `math.p4.correct`                     | "Yes! Seven and three make ten!"                            | **make**                         |
| 31  | canon `add-to-10`  | `math.p4.hint3`                       | "How many more make ten?"                                   | **make**                         |
| 32  | canon `add-to-10`  | `math.p6.read`                        | "Six and what make ten?"                                    | **make**                         |
| 33  | canon `add-to-10`  | `math.p6.correct`                     | "Yes! Six and four make ten!"                               | **make**                         |
| 34  | canon `add-to-10`  | `math.p8.read`                        | "Eight and what make ten?"                                  | **make**                         |
| 35  | canon `add-to-10`  | `math.p8.correct`                     | "Yes! Eight and two make ten!"                              | **make**                         |
| 36  | canon `add-to-20`  | `math.p4.read`                        | "Nine and what make thirteen?"                              | **make**                         |
| 37  | canon `add-to-20`  | `math.p4.correct`                     | "Yes! Nine and four make thirteen!"                         | **make**                         |
| 38  | canon `add-to-20`  | `math.p4.hint3`                       | "How many more make thirteen?"                              | **make**                         |
| 39  | canon `add-to-20`  | `math.p6.read`                        | "Seven and what make twelve?"                               | **make**                         |
| 40  | canon `add-to-20`  | `math.p6.correct`                     | "Yes! Seven and five make twelve!"                          | **make**                         |
| 41  | canon `add-to-20`  | `math.p6.hint3`                       | "How many more make twelve?"                                | **make**                         |
| 42  | canon `add-to-20`  | `math.p8.read`                        | "Six and what make eleven?"                                 | **make**                         |
| 43  | canon `add-to-20`  | `math.p8.correct`                     | "Yes! Six and five make eleven!"                            | **make**                         |
| 44  | canon `add-to-20`  | `math.p8.hint3`                       | "How many more make eleven?"                                | **make**                         |
| 45  | canon `mult-mix`   | `math.p1.read`                        | "Five times three. How many?"                               | –                                |
| 46  | canon `mult-mix`   | `math.p1.hint2`                       | "Five, then five, then five."                               | –                                |
| 47  | canon `mult-mix`   | `math.p2.read`                        | "Four times five. How many?"                                | –                                |
| 48  | canon `mult-mix`   | `math.p2.hint2`                       | "Four, four, four, four, four."                             | –                                |
| 49  | canon `mult-mix`   | `math.p3.read`                        | "Six times four. How many?"                                 | –                                |
| 50  | canon `mult-mix`   | `math.p3.hint2`                       | "Six, six, six, six."                                       | –                                |
| 51  | canon `mult-mix`   | `math.p4.read`                        | "Three times five. How many?"                               | –                                |
| 52  | canon `mult-mix`   | `math.p4.hint2`                       | "Three, three, three, three, three."                        | –                                |
| 53  | canon `mult-mix`   | `math.p5.read`                        | "Seven times four. How many?"                               | –                                |
| 54  | canon `mult-mix`   | `math.p5.correct`                     | "Yes! Twenty-eight!"                                        | –                                |
| 55  | canon `mult-mix`   | `math.p5.hint2`                       | "Seven, seven, seven, seven."                               | –                                |
| 56  | canon `mult-mix`   | `math.p5.giveAnswer`                  | "This one is twenty-eight."                                 | –                                |
| 57  | canon `mult-mix`   | `math.p6.read`                        | "Five times five. How many?"                                | –                                |
| 58  | canon `mult-mix`   | `math.p6.correct`                     | "Yes! Twenty-five!"                                         | –                                |
| 59  | canon `mult-mix`   | `math.p6.hint2`                       | "Five, five, five, five, five."                             | –                                |
| 60  | canon `mult-mix`   | `math.p6.giveAnswer`                  | "This one is twenty-five."                                  | –                                |
| 61  | canon `mult-mix`   | `math.p7.read`                        | "Eight times four. How many?"                               | –                                |
| 62  | canon `mult-mix`   | `math.p7.correct`                     | "Yes! Thirty-two!"                                          | –                                |
| 63  | canon `mult-mix`   | `math.p7.hint2`                       | "Eight, eight, eight, eight."                               | –                                |
| 64  | canon `mult-mix`   | `math.p7.giveAnswer`                  | "This one is thirty-two."                                   | –                                |
| 65  | canon `mult-mix`   | `math.p8.read`                        | "Nine times four. How many?"                                | –                                |
| 66  | canon `mult-mix`   | `math.p8.correct`                     | "Yes! Thirty-six!"                                          | –                                |
| 67  | canon `mult-mix`   | `math.p8.hint2`                       | "Nine, nine, nine, nine."                                   | –                                |
| 68  | canon `mult-mix`   | `math.p8.giveAnswer`                  | "This one is thirty-six."                                   | –                                |
| 69  | canon `duck-words` | `word.p1.read`                        | "Read the duck."                                            | _duck_ (target)                  |
| 70  | canon `duck-words` | `word.p1.correct`                     | "Yes! That's a duck."                                       | _duck_ (target)                  |
| 71  | canon `duck-words` | `word.p1.hint`                        | "Let's look. Duck."                                         | _duck_ (target)                  |
| 72  | canon `duck-words` | `word.p1.giveAnswer`                  | "This one is duck."                                         | _duck_ (target)                  |
| 73  | canon `duck-words` | `word.p2.read`                        | "Read the rock."                                            | _rock_ (target)                  |
| 74  | canon `duck-words` | `word.p2.correct`                     | "Yes! That's a rock."                                       | _rock_ (target)                  |
| 75  | canon `duck-words` | `word.p2.hint`                        | "Let's look. Rock."                                         | _rock_ (target)                  |
| 76  | canon `duck-words` | `word.p2.giveAnswer`                  | "This one is rock."                                         | _rock_ (target)                  |
| 77  | canon `duck-words` | `word.p3.read`                        | "Read the ring."                                            | _ring_ (target)                  |
| 78  | canon `duck-words` | `word.p3.correct`                     | "Yes! That's a ring."                                       | _ring_ (target)                  |
| 79  | canon `duck-words` | `word.p3.hint`                        | "Let's look. Ring."                                         | _ring_ (target)                  |
| 80  | canon `duck-words` | `word.p3.giveAnswer`                  | "This one is ring."                                         | _ring_ (target)                  |
| 81  | canon `duck-words` | `word.p4.read`                        | "Read the sock."                                            | _sock_ (target)                  |
| 82  | canon `duck-words` | `word.p4.correct`                     | "Yes! That's a sock."                                       | _sock_ (target)                  |
| 83  | canon `duck-words` | `word.p4.hint`                        | "Let's look. Sock."                                         | _sock_ (target)                  |
| 84  | canon `duck-words` | `word.p4.giveAnswer`                  | "This one is sock."                                         | _sock_ (target)                  |
| 85  | canon `duck-words` | `word.p5.read`                        | "Read the wing."                                            | _wing_ (target)                  |
| 86  | canon `duck-words` | `word.p5.correct`                     | "Yes! That's a wing."                                       | _wing_ (target)                  |
| 87  | canon `duck-words` | `word.p5.hint`                        | "Let's look. Wing."                                         | _wing_ (target)                  |
| 88  | canon `duck-words` | `word.p5.giveAnswer`                  | "This one is wing."                                         | _wing_ (target)                  |
| 89  | canon `duck-words` | `word.p6.read`                        | "Read the king."                                            | _king_ (target)                  |
| 90  | canon `duck-words` | `word.p6.correct`                     | "Yes! That's a king."                                       | _king_ (target)                  |
| 91  | canon `duck-words` | `word.p6.hint`                        | "Let's look. King."                                         | _king_ (target)                  |
| 92  | canon `duck-words` | `word.p6.giveAnswer`                  | "This one is king."                                         | _king_ (target)                  |
| 93  | canon `duck-words` | `word.p7.read`                        | "Read the lock."                                            | _lock_ (target)                  |
| 94  | canon `duck-words` | `word.p7.correct`                     | "Yes! That's a lock."                                       | _lock_ (target)                  |
| 95  | canon `duck-words` | `word.p7.hint`                        | "Let's look. Lock."                                         | _lock_ (target)                  |
| 96  | canon `duck-words` | `word.p7.giveAnswer`                  | "This one is lock."                                         | _lock_ (target)                  |
| 97  | canon `duck-words` | `word.p8.read`                        | "Read the sack."                                            | _sack_ (target)                  |
| 98  | canon `duck-words` | `word.p8.correct`                     | "Yes! That's a sack."                                       | _sack_ (target)                  |
| 99  | canon `duck-words` | `word.p8.hint`                        | "Let's look. Sack."                                         | _sack_ (target)                  |
| 100 | canon `duck-words` | `word.p8.giveAnswer`                  | "This one is sack."                                         | _sack_ (target)                  |
| 101 | canon `crab-words` | `word.p1.read`                        | "Read the flag."                                            | _flag_ (target)                  |
| 102 | canon `crab-words` | `word.p1.correct`                     | "Yes! That's a flag."                                       | _flag_ (target)                  |
| 103 | canon `crab-words` | `word.p1.hint`                        | "Let's look. Flag."                                         | _flag_ (target)                  |
| 104 | canon `crab-words` | `word.p1.giveAnswer`                  | "This one is flag."                                         | _flag_ (target)                  |
| 105 | canon `crab-words` | `word.p2.read`                        | "Read the drum."                                            | _drum_ (target)                  |
| 106 | canon `crab-words` | `word.p2.correct`                     | "Yes! That's a drum."                                       | _drum_ (target)                  |
| 107 | canon `crab-words` | `word.p2.hint`                        | "Let's look. Drum."                                         | _drum_ (target)                  |
| 108 | canon `crab-words` | `word.p2.giveAnswer`                  | "This one is drum."                                         | _drum_ (target)                  |
| 109 | canon `crab-words` | `word.p3.read`                        | "Read the brick."                                           | _brick_ (target)                 |
| 110 | canon `crab-words` | `word.p3.correct`                     | "Yes! That's a brick."                                      | _brick_ (target)                 |
| 111 | canon `crab-words` | `word.p3.hint`                        | "Let's look. Brick."                                        | _brick_ (target)                 |
| 112 | canon `crab-words` | `word.p3.giveAnswer`                  | "This one is brick."                                        | _brick_ (target)                 |
| 113 | canon `crab-words` | `word.p4.read`                        | "Read the crab."                                            | _crab_ (target)                  |
| 114 | canon `crab-words` | `word.p4.correct`                     | "Yes! That's a crab."                                       | _crab_ (target)                  |
| 115 | canon `crab-words` | `word.p4.hint`                        | "Let's look. Crab."                                         | _crab_ (target)                  |
| 116 | canon `crab-words` | `word.p4.giveAnswer`                  | "This one is crab."                                         | _crab_ (target)                  |
| 117 | canon `crab-words` | `word.p5.read`                        | "Read the swing."                                           | _swing_ (target)                 |
| 118 | canon `crab-words` | `word.p5.correct`                     | "Yes! That's a swing."                                      | _swing_ (target)                 |
| 119 | canon `crab-words` | `word.p5.hint`                        | "Let's look. Swing."                                        | _swing_ (target)                 |
| 120 | canon `crab-words` | `word.p5.giveAnswer`                  | "This one is swing."                                        | _swing_ (target)                 |
| 121 | canon `crab-words` | `word.p6.read`                        | "Read the plum."                                            | _plum_ (target)                  |
| 122 | canon `crab-words` | `word.p6.correct`                     | "Yes! That's a plum."                                       | _plum_ (target)                  |
| 123 | canon `crab-words` | `word.p6.hint`                        | "Let's look. Plum."                                         | _plum_ (target)                  |
| 124 | canon `crab-words` | `word.p6.giveAnswer`                  | "This one is plum."                                         | _plum_ (target)                  |
| 125 | canon `crab-words` | `word.p7.read`                        | "Read the clock."                                           | _clock_ (target)                 |
| 126 | canon `crab-words` | `word.p7.correct`                     | "Yes! That's a clock."                                      | _clock_ (target)                 |
| 127 | canon `crab-words` | `word.p7.hint`                        | "Let's look. Clock."                                        | _clock_ (target)                 |
| 128 | canon `crab-words` | `word.p7.giveAnswer`                  | "This one is clock."                                        | _clock_ (target)                 |
| 129 | canon `crab-words` | `word.p8.read`                        | "Read the frog."                                            | _frog_ (target)                  |
| 130 | canon `crab-words` | `word.p8.correct`                     | "Yes! That's a frog."                                       | _frog_ (target)                  |
| 131 | canon `crab-words` | `word.p8.hint`                        | "Let's look. Frog."                                         | _frog_ (target)                  |
| 132 | canon `crab-words` | `word.p8.giveAnswer`                  | "This one is frog."                                         | _frog_ (target)                  |

### 6.3 Vocabulary check (the ~200-word cap)

- **Today:** a word scan of every existing line (guidance, path and level-1 canon) finds 288 distinct words. 25 are number words, 72 are target words (the "Read / Tap the <word>." words), and 40 are letter names or sound tokens ("mmm", "puh"). That leaves about 159 core words. The split is rough: a few step words, such as "thumb" and "mat", land in the core count.
- **This wave adds 3 core words:** **make** (the bond sentence), **some** and **hiding** (the hiding line). All three are everyday words. That brings the count to about 162, still under ~200.
- **Target words:** the 16 step words.
- **Zero-cost choices, made on purpose:**
  - "Big words", not "Long words", for the land.
  - "Let's play all the groups!", not "mixed".
  - "Two letters, one sound!" and "Read all the letters!", not "end" or "start".
- Every text is ASCII-7, with no IPA and no sound demonstration inside a sentence (`planner-and-canon.md` § "Tier-specific opener pattern").

## 7. States and edge cases

- **Idle:** as each step's existing screen.
- **Happy path:** right answer → the celebration of its kind, with no change in timing. Missing numbers add the "?" fill and the bloom (§ 1.5).
- **Error path:** a wrong tap gets the poof, the shake, Emma's `puzzled-tilt` and "Hmm... try again?". The hint comes at 2 wrongs and the given answer at 3. Never a red X.
- **First visit to a new step:** the Map's unlock beat (or land beat), then the intro lead before P1 of each session until mastery.
- **Return user who already finished a world:** § 5.3. **Return user past add-to-20:** missing numbers only through reviews and warm-ups (§ 1.7).
- **Peek at a new step:** its canon P1–P3, with the per-step opener and closer. No intro lead, and a peek writes nothing (`fast-track-native.md` § 6.5).
- **Times mix before any `*` fact is boxed:** every strength is 0, so P1–P3 are the 3 smallest products and P4–P8 rotate through the pool by seed. A doc that skipped the times steps (diagnostic baseline or QA) works the same.
- **Times mix on an old server:** the `mult-mix` canon 8 (§ 2.4).
- **Hiding line in a review that has no missing-number block:** it doesn't play.
- **A planner-written add-to-10 session that repeats a bond:** Leitner records the first occurrence only (§ 1.7). The bake lint and the planner's directive should make this impossible in practice.
- **Rotation, background, Reduce Motion:** as the host screens. Every new animation has its Reduce Motion form in § 1.5, § 3.3 and § 4.3.
- **Transition in / out:** unchanged per screen. The stage fade, the 250 ms exit and Emma's frame spring are today's.

## 8. Picture prompt sheet (Midjourney v7)

**16 new pictures:** the 8 duck words and the 8 crab words. None is in `mobile/assets/pictures/` today (checked with `ls` on 2026-10-16: the folder holds 57 WebPs, all short-vowel CVC words). Every gentle and trap partner in § 3.2 and § 4.2 that isn't one of the 16 is already there.

**Style:** the picture-pack style anchor (`design/word-song/picture-pack-style-anchor.md` § 2–§ 3), distilled into the v7 four-pattern template of `design/word-song/picture-pack-iteration-plan.md` § 2–§ 3.

- Lead with the noun, and use the same style tail on every prompt.
- Each `--no` is tailored to its word (5–7 groups), and every one carries the drop-shadow negation.
- Set the aspect ratio to 1:1 in the GUI dropdown. Don't use `--cref`, `--sref` or `--ar`.
- The animals (duck, frog, crab) carry the clean-line clause and the anti-painterly negatives. v7 renders animals painterly without them (the simple-sentences scene pack, 2026-06-14).

**Workflow:**

- One prompt at a time: generate, pick, upscale, remove.bg, save. Only then the next prompt (the standing rule for Thomas's MJ sessions).
- Save the transparent PNGs to `design/references/picture-pack/transparent-duck-words/` and `transparent-crab-words/` (new per-tier folders, each with a `.gitkeep`).
- Then `npm run embed-pictures <folder> public/assets/pictures`, and `npm run export-assets` in `mobile/` bakes the 500 px WebPs.

**Order:** the highest risk first (iteration plan § 4). If one of the first three won't read at 96 pt after two rounds, stop and tell Matt before going on.

| #   | Word  | Step | Main risk                                      |
| --- | ----- | ---- | ---------------------------------------------- |
| 1   | wing  | duck | a lone wing reads as a feather or a whole bird |
| 2   | sack  | duck | collapses into `bag`                           |
| 3   | rock  | duck | grey-on-cream contrast; reads as `egg`         |
| 4   | clock | crab | MJ writes garbled numerals; pedestal-fan shape |
| 5   | lock  | duck | modern combination lock; bag-like shape        |
| 6   | swing | crab | MJ adds a child or a whole playground          |
| 7   | king  | duck | a busy face; must not read as `man` / `dad`    |
| 8   | brick | crab | brand look; reads as `box`                     |
| 9   | ring  | duck | the gem takes over (reads as `gem`)            |
| 10  | drum  | crab | a drum kit; a plain cylinder reads as `can`    |
| 11  | plum  | crab | reads as `fig`                                 |
| 12  | sock  | duck | product-photo attractor; a pair instead of one |
| 13  | flag  | crab | a national flag; symbols                       |
| 14  | duck  | duck | yellow duckling (the chick icon); hen-like     |
| 15  | frog  | crab | painterly; lily-pad scene                      |
| 16  | crab  | crab | painterly; lobster                             |

### 8.1 wing

```
A flat illustrated cartoon DRAWING of a single bird wing on its own, spread open like a fan, rows of soft dove-grey feathers with rose-pink tips, seen from the side, no bird body, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, photorealistic, 3d render, whole bird, angel, quill, smiling wing, shadow, drop shadow, ground shadow
```

**Pass if:** it reads "wing", not "feather" or "leaf", at 96 pt, with layered rows of feathers in a fan and no head or body. The feathers are grey, not white: white on the cream background doesn't survive remove.bg (the `egg` lesson). **If it fails:** add "a wide open wing with three clear rows of feathers, the joint at the top left". After two failed rounds, tell Matt: wing carries two traps (wig / wing, swing / wing).

### 8.2 sack

```
A flat illustrated cartoon DRAWING of a plump burlap sack tied shut at the top with a rope, rough woven warm-tan cloth, lumpy rounded bottom, no handles, three-quarter view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, fabric texture, handbag, shopping bag, handles, smiling sack, shadow, drop shadow, ground shadow
```

**Pass if:** the tied neck and the lumpy body are clear, with no handles (`bag` has them). **If it fails:** "a farm sack of potatoes, tied with a rope bow, no potatoes visible".

### 8.3 rock

```
A flat illustrated cartoon DRAWING of a single chunky grey stone rock, irregular shape wider than tall, a few flat facets and one small crack line, cool grey #A9A6A3 with a darker grey shadow side, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, photorealistic, 3d render, pebbles, mountain, moss, smiling rock, shadow, drop shadow, ground shadow
```

**Pass if:** it is grey (not tan, which reads as `egg`) and angular rather than oval, and stays visible against cream after remove.bg.

### 8.4 clock

```
A flat illustrated cartoon DRAWING of a round alarm clock with two bells on top and two little feet, rose-pink case, cream face with short tick marks and two hands, no numbers on the face, front view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, 3d render, numbers, text, digital clock, wristwatch, smiling clock, shadow, drop shadow, ground shadow
```

**Pass if:** the bells, the hands and the tick marks are there, with **no numerals** (garbled digits count as text), and it doesn't read as a pedestal fan.

### 8.5 lock

```
A flat illustrated cartoon DRAWING of a closed padlock, a rounded warm-brass body with a keyhole in the middle and a curved silver shackle on top, front view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, 3d render, key, combination dial, digital lock, smiling padlock, shadow, drop shadow, ground shadow
```

**Pass if:** the keyhole and the shackle are clear, with no key and no number dial, and the shackle doesn't look like a bag handle.

### 8.6 swing

```
A flat illustrated cartoon DRAWING of a playground swing, one empty wooden seat hanging on two ropes from a simple wooden A-frame, three-quarter view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, 3d render, child, person, slide, playground, tree, grass, smiling swing, shadow, drop shadow, ground shadow
```

**Pass if:** the seat is empty, the whole frame is in view and there is nothing else.

### 8.7 king

```
A flat illustrated cartoon DRAWING of a friendly cartoon king standing, a big gold crown with small rose-pink gems, a soft red robe with a cream collar, eyes as two small dots, no nose, three-quarter view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, 3d render, detailed face, big anime eyes, cheek blush, throne, castle, scepter, shadow, drop shadow, ground shadow
```

**Pass if:** the crown leads the read, the face is the pack's minimal face (`man` and `dad` convention), and it doesn't read as `man` or `dad`.

### 8.8 brick

```
A flat illustrated cartoon DRAWING of one toy building brick, a rectangular rose-red block with four round studs on top, three-quarter view from above, plain studs with no marks, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, 3d render, logo, text, wall, many bricks, smiling brick, shadow, drop shadow, ground shadow
```

**Pass if:** it is one brick, the studs are visible, and the studs carry no logo. It reads as a toy brick, not as `box`.

### 8.9 ring

```
A flat illustrated cartoon DRAWING of a gold finger ring with one small rose-pink gem on top, the round band clearly visible as a circle, three-quarter view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, 3d render, hand, finger, jewellery box, smiling ring, shadow, drop shadow, ground shadow
```

**Pass if:** the band is the main shape and the gem is small (so it doesn't read as `gem`).

### 8.10 drum

```
A flat illustrated cartoon DRAWING of a toy drum, a cream top skin, rose-pink sides with a zigzag cord pattern, two drumsticks crossed on top, three-quarter view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, 3d render, drum kit, cymbals, smiling drum, shadow, drop shadow, ground shadow
```

**Pass if:** the zigzag cords and the sticks are there (without them it reads as `can` or `tub`), and it is one drum, not a kit.

### 8.11 plum

```
A flat illustrated cartoon DRAWING of one round plum, deep plum-purple skin with a soft groove down one side, a short brown stem and one green leaf, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, photorealistic, 3d render, fig, grapes, cut fruit, smiling plum, shadow, drop shadow, ground shadow
```

**Pass if:** it is round with a groove and a leaf, not `fig`'s teardrop.

### 8.12 sock

```
A flat illustrated cartoon DRAWING of one striped sock, rose-pink and cream stripes, a rounded heel and toe, side view, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, product photography, fabric texture, pair of socks, shoe, foot, smiling sock, shadow, drop shadow, ground shadow
```

**Pass if:** it is a single sock with a clear heel bend.

### 8.13 flag

```
A flat illustrated cartoon DRAWING of a small rectangular flag on a thin wooden pole, plain rose-pink cloth waving, no symbols on the cloth, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, soft cel-shading, slice-of-life Korean webtoon look, single subject, no environment --no photo, 3d render, country flag, stars, stripes, text, symbols, smiling flag, shadow, drop shadow, ground shadow
```

**Pass if:** the cloth is plain and waving on a pole. No country's flag, and not `net` (no mesh, no hoop).

### 8.14 duck

```
A flat illustrated cartoon DRAWING of a duck standing in side view, soft green head, warm-brown chest, grey-cream body, orange bill and orange webbed feet, thick clean dark outlines, flat solid color fills, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, simple flat cel-shading, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, painterly, fuzzy feathers, duckling, chick, hen, water, smiling duck, shadow, drop shadow, ground shadow
```

**Pass if:** the bill and the webbed feet are clear. No comb (so not `hen`), and not yellow (the chick stop is yellow). **If it fails:** keep the green head, which marks it as a duck at a glance.

### 8.15 frog

```
A flat illustrated cartoon DRAWING of a green frog sitting, eyes bulging on top of its head, pale yellow-green tummy, long folded back legs, three-quarter front view, thick clean dark outlines, flat solid color fills, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, simple flat cel-shading, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, painterly, lily pad, water, toad, crown, smiling frog with cartoon eyebrows, shadow, drop shadow, ground shadow
```

**Pass if:** it is a frog alone, with no lily pad, clean lines and soft green.

### 8.16 crab

```
A flat illustrated cartoon DRAWING of a coral-red crab seen from the front, two big claws held up, six thin legs, eyes on short stalks, thick clean dark outlines, flat solid color fills, soft pastel children's picture-book style, solid soft cream #FFF6EE background, warm-pastel palette, simple flat cel-shading, slice-of-life Korean webtoon look, single subject --no photo, photorealistic, 3d render, painterly, lobster, sand, beach, smiling crab, shadow, drop shadow, ground shadow
```

**Pass if:** the claws are up, the colour is soft coral (not saturated red), and there is no sand.

## 9. Wiring checklist (Kevin, Devon)

**Each new SkillNode** (`mult-mix`, `duck-words`, `crab-words`) goes through rows 1–15 of `.claude/docs/sibling-tier-checklist.md`, with first-class content. Plus these surfaces, which that list doesn't name:

- **Names:** `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS` and `FRIENDLY_NODE_NAMES` (`friendlyNodeName.ts`), and the recap-phrase list in `api/_planner.ts`.
- **Map and lines:**
  - `LANDS`. `PATH_LINES` follow it: baked count 141 → 159.
  - `PATH_ART_SET` and `LandArtId`.
  - `GUIDANCE_LINES`: the peek pairs follow `pathStepsOf`; add the 4 lines and 2 kinds of § 6.1.
- **Math:**
  - The missing-addend kind, its template and its chips (§ 1.6).
  - `MATH_TRACK_GUIDE`'s add-to-10 and add-to-20 shape blocks.
  - `mult-mix` in the generic-tier `mult-*` hint templates and in `MULTIPLICATION_FOCUS_NODES`.
  - `CANON_MATH_FACTS` regenerated (`scripts/generateCanonMathFacts.ts`).
  - `parseReadOperands` / the extended parser: 8/8 on all three re-baked math files.
- **Times mix plumbing:** `pickMixBlocks`, `MIX_SOURCE_STEPS`, the `mix` field in `sessionPlanKind`, `MIX_*` in `wire/types.ts`, and the `api/_review.ts` branch (§ 2.3–§ 2.4).
- **Word Song:**
  - `wordPack.ts`: 16 targets, 16 `TARGET_PAIRINGS` rows and 14 `FORBIDDEN_PAIRS`. No new distractor-only word.
  - The per-tier lists in `api/_plannerWordList.ts` and the two tier blocks in `WORD_SONG_TRACK_GUIDE`.
  - In `wordDistractors.test.ts`, give the two tiers the digraph tiers' treatment (`ALL_DIGRAPH_TIER_WORDS`) wherever a CVC-axis test rejects an ending-twin or blend pair.
- **Loading:** both `withDefaultedSkillLevels` copies (§ 5.3).
- **Voice QA:** the three new canon stems in `CANON_FILES` (`public/voice-qa.html`), and the new guide and path lines in its lists.

**Unchanged on purpose:** `isLeitnerDirectiveActive` (add-to-10 only), `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`, and the celebration exception list.

## 10. Assets required

- **Pictures:** 16 new (§ 8). Thomas generates them; the integration bakes them.
- **Path art:** 4 clay pieces (§ 5.4).
- **Audio:** 132 distinct texts (§ 6.2): 10 guidance, 18 path and 104 canon (add-to-10 7, add-to-20 9, times mix 24, duck words 32, crab words 32). Thomas ear-tests them on `/voice-qa.html` before the native build ships (bar 2).
- **Prediction for the soak (Predict-Before-Soak):** the "Read the <word>." lines sound like the CVC steps. The 5-letter clusters (brick, clock, swing) keep their onsets. The bond lines ("Yes! Seven and three make ten!") run about 2.2–2.8 s and land on "ten", and "Some flowers are hiding!" about 1.5–1.9 s. The intro lines keep their comma pause. **Not predicted:** how Lily says "make" inside "and what make", which the ear test settles.
- **Code-drawn:** `BudGlyph` and the counting row's "?" stone (§ 1.4).
- **Reused:** every existing pose, background, SFX, chip, frame and picture. No new Emma pose.

## 11. Acceptance criteria

**Core (vitest):**

1. **Parser:**
   - "Seven and what make ten?" parses to `{ kind: 'missing-addend', addendA: 7, total: 10, correct: 3 }`, and "Nine and what make thirteen?" to `{ 9, 13, 4 }`.
   - "Ten and what make ten?" is rejected.
   - Without `extendedKinds` the line throws, as the skip and multiply reads do.
2. **Re-baked add-to-10 and add-to-20 canon:**
   - All 16 read lines parse.
   - The missing-number problems sit at exactly P4, P6 and P8.
   - No unordered bond appears twice in a file.
   - Every add-to-10 whole is ten. Every add-to-20 one has A 6–9 and a missing part of 2–5.
3. `CANON_MATH_FACTS['add-to-10'][3]` is `{ a: 7, b: 3, op: '+' }` (with the § 1.8 canon), and the drift test passes.
4. A session-end write for a plan that holds the fact `7+3` twice applies one Leitner outcome for it.
5. **`pickMixBlocks`:**
   - It returns 8 refs with 8 distinct facts, all from the 28-fact pool.
   - With the box of § 2.3's example, P1–P3 are 3×3, 2×5, 4×4 in that order, and P4–P8 include 7×3 and 9×3.
   - No two neighbours share A when the picks allow it.
   - The same inputs give the same refs.
   - The due picks never include a warm-up fact and never exceed 3 minus the warm-up's fact count.
6. **Lines and lands:**
   - `LANDS` flattened equals both trees.
   - `BAKED_PATH_LINES` has 159 entries.
   - `GUIDANCE_LINES` holds the § 6.1 lines and the 3 new peek pairs with the exact texts of § 6.2.
   - The `STAGE_SPOKEN_NAMES` values stay unique.
7. **Loading (§ 5.3), in `loadProgress` and in `installCloudBlob`:**
   - A blob with no `mult-mix` key and `mult-6-9: 'mastered'` loads with `mult-mix: 'intro'`.
   - With `mult-6-9: 'practicing'` it loads `'locked'`.
   - A stored `mult-mix: 'locked'` stays locked.
   - After such a load, with an `unlocksCelebrated` list that lacks `mult-mix`, the map's pending unlock is `big groups → all the groups`.
8. **`wordPack`:**
   - The 16 targets and their pairs match § 3.2 and § 4.2 exactly.
   - No trio contains a forbidden pair.
   - Every one of the 16 picture keys resolves through native `pictureAsset`.

**Server (vitest):**

9. **A valid `mix` request (8 refs):**
   - It returns plan id `mix-math` and ids `math.p1–p8.*`, whose texts and audio equal the canon blocks, plus `mult-mix`'s `session.end.*` lines.
   - It makes no Anthropic or TTS call and doesn't touch the rate limiter.
   - With warm-up refs, the `w` blocks are appended.
10. A `mix` request with 7 refs, a node outside `MIX_SOURCE_STEPS` or `problem: 9` returns 400.

**Native (jest):**

11. **add-to-10 P4:**
    - It shows `7 + ? = 10`, 7 flowers, the "?" stone, and chips 2, 3, 4.
    - "Some flowers are hiding!" plays before P4's read, and not before P6's or P8's.
    - No dot card shows, even in a session with the subitising scaffold on.
    - Hint 3 shows 3 buds.
    - A correct tap fills the "?" with 3 and blooms the buds.
    - The 3rd wrong shows the buds and rings the "?".
12. **A `mult-mix` session:**
    - The request carries `mix` and no `leitner`.
    - A `mix-` plan is accepted, and a plain `mult-mix` canon plan is accepted too.
    - Tags show from reveal on all 8 problems.
    - The chips use M = 40.
    - The payload has 8 non-null `problemFacts` and `skillFocus: ['mult-mix']`.
13. **Duck words and crab words:**
    - P1's lead plays with its lit cells (§ 3.3, § 4.3).
    - The 1500 ms silent beat counts from the lead's end.
    - No lead plays on P2–P8, in reviews, on warm-up hearts or in peeks.
    - Every chip is a picture.
    - The 2nd wrong plays the hint line.
14. Reduce Motion: no scaling in § 1.5, § 3.3 or § 4.3, only fades. The spotlight still shows.

**Device** (Expo Go, default settings, `EXPO_PUBLIC_QA_STEP`):

15. **Each new step from the QA picker:**
    - Emma speaks every line, with no silent caption walk once the render has shipped.
    - Duck and crab words show three pictures on every problem.
    - Times mix shows plates on every problem.
16. **Map, 375×667 and 744×1133 portrait:**
    - Word Song shows 6 lands, and land 6's pill and emblem show.
    - Groups has 4 stops.
    - No two stops overlap.
    - A Map peek at crab words says "Let's look at crab words!" and plays flag, drum and brick.
17. **Return user:** a QA doc with `mult-6-9` mastered and no `mult-mix` key. After launch:
    - The Map plays "You learned big groups! Now you can do all the groups!" once.
    - The Hub shows all the groups with an empty tray.
    - The same for Word Song with `simple-sentences` mastered, where the land beat says "A new land! Land 6: Big words!".
18. add-to-10 at the phone floor, both orientations: the "?" stone, the buds and the bloom stay inside the counting row's reserved box. Nothing moves when the buds appear.

## 12. Open questions

**For Thomas (look, voice, feel; one recommendation each):**

- **T1. The new Emma lines.** The 4 lead lines (§ 6.1) and the 3 peek pairs. Team recommendation: approve as written. "Some flowers are hiding!" turns the "?" into a small story (the flowers come out when she finds the number) and costs two everyday words.
- **T2. The names.** "all the groups", "duck words", "crab words" (not "frog words", whose picture skip counting already has), and land 6 "Big words". Team recommendation: approve.
- **T3. The 4 clay pictures** (§ 5.4): a fruit basket, a green-headed duck on water, a crab, a toy train. Team recommendation: approve the subjects. The look is judged when they are generated, as for the 33 before them.

**For Dave, via Matt (pedagogy this spec had to fill in). All five are resolved; the build can start:**

- **D1.** Missing numbers. **Resolved: Dave confirmed it unchanged (2026-10-16).** The questions were:
  - Are 3 of 8, at P4, P6 and P8, the right share?
  - Should add-to-10 use bonds in both orders (A 1–9)?
  - Is add-to-20's range right (A 6–9, part 2–5)?
  - Should the buds stay hidden until hint 3?
  - Should the chips stay off-by-one only? The alternative is adding the "tapped the whole" trap (10).
- **D2.** Times mix. **Resolved: Dave confirmed it unchanged (2026-10-16).** The questions were:
  - Up to 5 groups (answers ≤ 36) instead of his ≤ 90, with 6×5–9×5 left for wave 2.
  - Opening on 3 known facts.
  - Tags shown from reveal.
- **D3.** Duck word traps: ending twins plus one vowel neighbour, instead of vowel neighbours throughout. _neck_ is dropped. **Resolved: Dave confirmed it unchanged (2026-10-16).**
- **D4.** Crab words: _swim_, _sled_, _crib_ and _clam_ are dropped, and _flag_, _clock_ and _swing_ added. frog's trap is _dog_, not _fog_. **Resolved: Dave confirmed it with one change (2026-10-16), applied in § 4.2: crab's trap is {clock, frog}, and _cab_ is dropped entirely.**
- **D5.** The intro lead in every session until mastery, not only the first. **Resolved: Dave confirmed it unchanged (2026-10-16).**

**For Matt:**

- The web consequence in § 1.9.
- The server needs `yarn release` before the times-mix device check (§ 2.4).
- The picture pack (16) and the clay pieces (4) gate the Word Song build's device check, not its code. The words can be coded and tested while Thomas generates.
