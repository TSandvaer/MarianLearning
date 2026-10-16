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

## 2. NG-B: times mix (`mult-mix`)

### 2.1 The step

- **SkillNode `mult-mix`**, after `mult-6-9` in `MATH_TREE` and `MATH_NODES_IN_ORDER`. Default level `'locked'`.
- **Spoken name** "all the groups", verb **are** ("All the groups are for later. You will learn it!"). `FRIENDLY_NODE_NAMES` (the recap): "counting in groups", as for the other three times steps.
- **Map:** the 4th stop of land 4, Groups (§ 5).
- **What a problem is:** an existing multiply problem, unchanged: "Seven times four. How many?", `7 × 4 = ?` above 4 plates of 7 flowers, three chips (`math-skip-counting-multiplication-native.md` § 3–§ 5).
- **Tags and "+" show from reveal on every problem**, the `mult-6-9` rule. Most mixed problems have groups of 6–9, which she can't see at a glance.
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

1. **P1–P3, the gentle opening:** the 3 facts with strength ≥ 2 and the highest strength. Ties go to the smaller product, then the key `${a}*${b}` ascending. If fewer than 3 qualify, fill with the smallest-product facts not yet picked. **Why:** the session opens on facts she got right before, the same reasoning as the warm-up's first heart (Thomas, 2026-10-14).
2. **P4–P8, the weak facts:**
   1. Due facts first, ranked exactly as `rankedDueFacts` (overdue days, then box, then key), up to `LEITNER_DUE_PER_SESSION_CAP` minus the warm-up's fact count (the shared cap of 3, `review-mode-and-warmup-native.md` § 7.4). Warm-up facts and P1–P3 picks are skipped.
   2. Then the lowest strength first (never-played facts count as 0). Ties are broken by pool index rotated by the seed, `(index + seed) % pool.length` ascending, so sessions vary.
3. **Order P4–P8:** take the picks in order, but when the next one has the same A as the problem before it (P3 included), take the first later pick whose A differs. Adjacent problems then come from different tables whenever possible (Dave's M4: mixed practice).

`seed` is `readSessionHistory().sessionCount` at kick time, as for reviews. It is the same at prefetch and at the tap, so both ask for the same refs.

**Worked example (a made-up box, for illustration):** she has played the three times steps. 4×4, 2×5 and 3×3 sit in box 3, 9×3 and 7×3 are box 1 (due), and the 8 `mult-mix` facts are unplayed.

- P1–P3 = 3×3, 4×4, 2×5 (box 3, smallest products first).
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
- **Words: exactly 8**, one per problem (K9). Word Song sessions are served from canon every time (only `add-to-10` ever reaches the live planner), so each step is the same 8 words in the same order, and reviews copy those blocks.
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
- **Format, mastery, fast track, peek:** as duck words (§ 3.1). Start blends only, short vowels only (Dave). Every word is a short vowel in British English too: the voice is British, which is why _sled_ is out (§ 4.2).

### 4.2 Word list and distractor matrix (canon order)

| P   | Word  | Blend | Vowel | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap                                                  |
| --- | ----- | ----- | ----- | --------- | -------------- | ------------ | ------------------------------------------------------------- |
| 1   | flag  | fl    | a     | object    | cup, web       | frog, bag    | frog: f with r for l; bag: rhyme with one first letter        |
| 2   | drum  | dr    | u     | object    | hat, fox       | plum, dog    | plum: rhyme with another blend; dog: d without the r          |
| 3   | brick | br    | i     | object    | sun, hat       | crab, clock  | crab: the same r; clock: the same ending                      |
| 4   | crab  | cr    | a     | animal    | sun, pen       | cab, frog    | **cab: crab without the r** (Dave, R4); frog: another r-blend |
| 5   | swing | sw    | i     | structure | pot, bug       | wing, king   | **wing: swing without the s**; king: rhyme                    |
| 6   | plum  | pl    | u     | food      | cat, hen       | drum, pig    | drum: rhyme with another blend; pig: p without the l          |
| 7   | clock | cl    | o     | household | bun, jet       | lock, sock   | **lock: clock without the c**; sock: rhyme                    |
| 8   | frog  | fr    | o     | animal    | cup, bed       | dog, flag    | dog: rhyme without the blend; flag: f with l for r            |

- **Dave's dropped-consonant twin** (R4: frog read as "fog") is the trap wherever its picture reads: crab / cab, swing / wing, clock / lock. _wing_ and _lock_ arrive with duck words, one step earlier.
- **Twins left out:**
  - _fog_ (a fog picture reads as a cloud).
  - _rib_ (and with it _crib_; neither picture reads at 96 pt).
  - _flag_'s twin without the l, never (Dave).
  - For frog, the trap is _dog_: the rhyme without the blend tests the same thing.
- **Dropped from Dave's list:**
  - _swim_ (a verb, so "Yes! That's a swim." breaks; _swing_ takes its sw).
  - _sled_ (the British word is "sledge").
  - _crib_ and _clam_ (weak vocabulary, no twin with a picture).
- **Added:** _flag_, _clock_ and _swing_ (each with a twin or a strong rhyme).
- **cab is distractor-only** (`DISTRACTOR_ONLY_WORDS`, `isTarget: false`). It is never a target, never spoken and needs no `TARGET_PAIRINGS` row.
- **Every target takes "Yes! That's a <word>."**

### 4.3 Intro lead

"Read all the letters!" plays before P1's silent beat in every forward session on the step until it is mastered. While Emma says it, the cells light one after another from the left, 150 ms apart (each a 120 ms fade in), and all go dark 200 ms after the line ends. [Reduce Motion: they light at once.] **Why:** the trap this step sets is skipping the second letter. "All the letters" says what to do about it in words she knows.

### 4.4 Pictures

All 8 targets and _cab_ are new pictures (9; none is in `mobile/assets/pictures/`, checked with `ls` on 2026-10-16). Already there: cup, web, bag, hat, fox, dog, sun, pen, pot, bug, cat, hen, pig, bun, jet, bed. Ready by then from duck words: wing, king, lock, sock. No blend clip (§ 3.4).

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
| cab – van   | vehicles in side view                     |
| cab – bus   | vehicles in side view                     |

No trio in § 3.2 or § 4.2 contains a forbidden pair, old or new.
