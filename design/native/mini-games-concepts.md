# Side mini-games: three concepts (native)

**Ask (Thomas, 2026-10-19, verbatim):** "I have some thought about adding some mini games for casual fun on the side of the 'Numbers garden' and 'Word song' paths." Approved by popup: "Dave researches, then Kyle sketches".

**Source:** Dave's research, `design/research/engagement-and-mini-games-2026-10-19.md` (PR #620, branch `dave/engagement-mini-games`, open). His § 3 guard rails are taken as written; this doc turns them into screens.

**Thomas's answers to Dave (2026-10-19):**

- Marian's current stop is adding to ten (Number Garden land 2).
- Games are **always open** as soon as their step is current (Dave's pick, not the fallback).
- Supervision: "right now because we are testing im near her, but it should be fine for her to do it by her own often". So every concept is designed for **a child playing alone**.

**Scope:** concepts only, for Thomas to pick from. No code, no tickets. The chosen game gets a full native spec (layout numbers, motion values, acceptance criteria) after the pick.

**Standing rules applied:** any learner of about 6-9 (Marian is one); no Danish premise; every spoken line sits in a copy table (§ 5), and no text is baked into art, so the planned Danish version swaps lines and content; per learner (learner profiles, `design/native/learner-profiles.md`); audio-first; minimal reading; never a red X.

## Goal

A child who wants a short break from a lesson finds a small game beside the path. It plays the facts or words she has already met, ends on its own after a minute or two, and sends her back to the path. It counts toward nothing.

## The three at a glance

| Concept                                   | World         | Opens when this step is current or mastered | Trains                                | Lily (lines / chars) | New pictures | Size |
| ----------------------------------------- | ------------- | ------------------------------------------- | ------------------------------------- | -------------------- | ------------ | ---- |
| **A. Fill the flower bed** (Dave NG 1)    | Number Garden | adding to ten (`add-to-10`)                 | bonds to ten on the ten-frame         | 30 / 684             | 0            | S    |
| **B. Mirror bugs** (Dave NG 2)            | Number Garden | adding to ten (`add-to-10`)                 | doubles, then near doubles (one more) | 23 / 586             | 0 (drawn)    | M    |
| **C. Robot talk** (Dave WS 2)             | Word Song     | blending sounds (`blending-cv`)             | oral blending, no reading             | 3 / 74               | 1 (robot)    | S    |
| Shared frame (Map door, play screen, § 1) | both          | n/a                                         | n/a                                   | in the rows above    | 0            | S-M  |

The shared frame ships with whichever game is built first, so **any first build is M**. "Opens" uses the Hub's current-step rule: the first step not yet mastered, in tree order (`currentStepOf`, `packages/core/src/hub/hubCardModel.ts:74`).

**For Marian today:** A and B open now (adding to ten is her current stop). C opens once her Word Song stop is blending sounds or later. A brand-new learner on the default profile starts Word Song at letter sounds (`'letter-sounds': 'practicing'`, `packages/core/src/progress/defaults.ts:209`), so they see no Word Song door until letter sounds is mastered.

---

## 1. Shared frame (every game)

### 1.1 Entry: the play door on the Map

**Decision: the door lives on each world's Map, not on the Hub.**

- **The Hub stays the lesson door.** It keeps its four targets and its one suggestion (`hub-native.md` § 1). A game one tap from the Hub would sit beside the lesson and pull at it (Dave § 3: "lessons are the first door").
- **The Map is already the place for play that counts toward nothing.** Peeks and replays live there and write nothing (`map-tap-to-play.md` § 3). A game is the same kind of visit.
- **It is literally "on the side of the path"**, as Thomas put it. The way in is Hub → map button → play door: two taps, the same as a peek.

**What the door is:** a round clay button in the Map's chrome, the same clay as the Hub's map button for that world (`mobile/src/screens/hub/MapButton.tsx:19`, wood for Number Garden, honey for Word Song). Inside it is the game's own picture at small size: the flower bed, the bug or the robot. It shows no text and no badge, and it has no idle animation.

| Form (`map-native.md` § 1) | Door position (S = safe rect)                               | Size  |
| -------------------------- | ----------------------------------------------------------- | ----- |
| P (phone portrait)         | (S.right − 16 − 56, S.y + 8): Home's mirror on the right    | 56×56 |
| L (phone landscape)        | In the rail under Home: (S.x + 16, S.y + 80)                | 56×56 |
| W (tablet portrait)        | (S.right − 24 − 96, S.y + 14): Home's mirror on the right   | 96×96 |
| TL (tablet landscape)      | In the column's top row, beside Home: (S.x + 144, S.y + 14) | 96×96 |

**Check:** in P at 375 pt, "Number Garden" (206 pt at 28 pt, `map-native.md` § 2) runs from 84.5 to 290.5, and the door starts at 303, so it clears the title by 12.5 pt, as Home does on the left. In L the rail holds 8 + 56 + 16 + 56 = 136 pt of a 271 pt pane.

```
P  phone portrait (375×667)            W  tablet portrait (820×1180)
+------------------------------+       +--------------------------------------------+
| (⌂)   Number Garden    (◰)   |       | ( ⌂ )        Number Garden          ( ◰ )   |
|------------------------------|       |--------------------------------------------|
|  path, unchanged             |       |  path, unchanged                           |
|       (badge)                |       |              (badge)                       |
|   ( ) (◎) ( ) ( ) ( )        |       |    ( )  (◎)  ( )  ( )  ( )                 |
|------------------------------|       |--------------------------------------------|
| [🔊 caption, unchanged     ] |       | [🔊 caption, unchanged                   ]  |
+------------------------------+       +--------------------------------------------+
  (⌂) Home   (◰) play door: the game's picture in the world's clay disc
```

**Which games show:**

- **Only open games.** A world with no open game shows no door: no padlock and no "coming soon" (Dave's lean, and mine; a locked door is a teaser).
- **One open game:** the door starts it.
- **Two or more** (only when both A and B are built): the door opens a small clay shelf under it with one picture per open game (72 pt on phones, 96 pt on tablets). A tap on a picture starts that game. A tap outside, or on the door again, closes the shelf.
- **No arrival beat.** When a game first opens for a learner, nothing announces it: no line, no sparkle, no "new". The door is simply there on her next Map visit. Emma's Map lines are unchanged and never name a game.

**Taps:** the door follows the Map's stop rules. It starts on release, never on a drag; it is ignored for 400 ms after the Map mounts (`MAP_TAP_ARM_MS`, `mobile/src/screens/map/useMapVisit.ts:99`) and until an unlock beat's cheer; the launch lock covers it (`map-tap-to-play.md` § 2, § 5). Press-in scale 1 → 0.94, as the stops do. Reduce Motion: no scale.

**Route:** a new `play` route, a sibling of `peek`: `map → play` and `play → map` only (`mobile/src/router/routes.ts:49-50`).

### 1.2 The play screen

It is the lesson frame with the peek's HUD, so a child who knows a lesson knows where everything is:

- **Back** (top left, the lesson's 56 pt disc).
- **One bead per move**: per bed, bug or word. It uses `MathHud` in `peek` mode, with no stardust pill and no streak (`mobile/src/screens/math/MathHud.tsx:367`). The beads show how much is left, so she knows when the round ends; they are not a clock.
- **Emma at the lesson perch** (`EmmaStage`, `mobile/src/components/EmmaStage.tsx:143`), with the existing poses: `celebration` on a right move, `puzzled-tilt` on a wrong one (`packages/core/src/character/emmaPose.ts:24`).
- **The caption ribbon** under her, walking each line (`CaptionRibbon`, `mobile/src/components/CaptionRibbon.tsx:121`).
- **The play area** in the middle, and the **targets anchored to the bottom** (the thumb zone), at the lesson's chip sizes: 88 pt on phones, never below 72 pt, with 16 pt gaps (`greet-math-native.md` § 4).

Phone landscape follows Math's landscape: Emma's column on the left with Back above her, the HUD row, the ribbon, then the play area and targets in the right pane.

```
play screen, phone landscape (667×375)
+---------------------------------------------+
| [<]      | ● ◉ ○ ○ ○ ○                      |
| ( Emma ) | +------------------------------+ |
| ( col  ) | | caption ribbon               | |
| ( 24% w) | +------------------------------+ |
|          |      play area (bed / bug /     |
|          |      robot), scaled to fit      |
|          |   [ 2 ]     [ 3 ]     [ 4 ]      |
+---------------------------------------------+
```

### 1.3 Rules every round keeps

Each rule is Dave's guard rail (§ 3 table) made concrete.

| Rule                       | What the screen does                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Counts toward nothing**  | It writes nothing: no history, flower, good or secure day, pace guard, Leitner, stardust or streak. The persisted progress JSON is byte-identical before and after, as for a replay (`map-tap-to-play.md` § 3). v1 reads no Leitner state either.                                                                                                          |
| **Content**                | Only from steps that are current or mastered for the **active learner**. The content follows that learner's progress, and nothing is kept per learner because nothing is written. No scores and no comparisons.                                                                                                                                            |
| **The answer is the move** | The right tap makes the thing happen: the bed fills, the bug flies, the robot's word is heard. There is no quiz between levels.                                                                                                                                                                                                                            |
| **No timer**               | Nothing counts down, floats away, runs out or escapes. A move waits for her for as long as she likes. A tap on the play area (the bed, the bug after its mirror tap, the robot) says the question again, as Word Song's picture and letter glyph do (`word-song-native.md` § 4).                                                                           |
| **Wrong move**             | The tapped target wiggles once (rotate 0, −7, 7, −4, 0 over 500 ms, the Map's locked wiggle, `map-native.md` § 6) with `sfx-poof` at 0.45 (`mobile/src/audio/sfx.ts:134`). Nothing changes in the play area. Emma turns `puzzled-tilt` and says `game.again`, "Hmm... try again?", and the game's hint plays. Never a red X, and no sound of failure.      |
| **Second wrong move**      | The lesson's guided answer: the right target glows, and the others dim and stop answering (`AnswerChip` `glow` / `dimForGuided`, `mobile/src/screens/math/AnswerChip.tsx:74-77`). Emma names it (`game.this-is.<n>`, or the robot says the word). She taps it, and it plays as a right move. There is no third tier.                                       |
| **Right move**             | `sfx-chime`, Emma `celebration`, the game's "yes" line (in C, the word itself), and the bead fills.                                                                                                                                                                                                                                                        |
| **Fixed round, clear end** | A fixed number of moves (4-6). After the last one: 400 ms, Emma's closer, 400 ms, then **back to the Map** with no line (the replay's quiet arrival, `map-tap-to-play.md` § 4). **No auto-next**: no "again?" button, no next round, no score. Playing again means tapping the door again, by her own choice. No Emma line anywhere invites another round. |
| **Back**                   | Back returns to the Map at once, silently, mid-line or mid-move. Nothing is written.                                                                                                                                                                                                                                                                       |
| **Background**             | The line parks and resumes (the voice channel), as everywhere. The round waits.                                                                                                                                                                                                                                                                            |
| **Little decoration**      | No idle animation in the play area. The only motion answers a tap or a line.                                                                                                                                                                                                                                                                               |
| **Reduce Motion**          | Every movement becomes a 200 ms fade (per-game details below). The audio is the same.                                                                                                                                                                                                                                                                      |

---

## 2. Concept A: Fill the flower bed (Number Garden)

### Pitch

A garden bed shaped like the lesson's ten-frame: two rows of five slots. Some slots already have flowers. Emma says how many and asks what makes ten. She taps a number chip, the seeds hop from the chip into the empty slots, and the whole bed blooms. Six beds, and the round is done. The chip she picks fills the bed, so the answer is the move. She sees "seven and three" as one full ten-frame, which is the structure that lets her stop counting 7 one by one.

### Entry and content

- **Door:** the Number Garden Map. It opens when adding to ten is current or mastered, so **it is open for Marian now.**
- **Content:** the bonds to ten that adding to ten already teaches: a given part of 1-9 and a missing part of 1-9, always making ten (`MISSING_NUMBER_RANGES['add-to-10']`, `packages/core/src/wire/missingNumbers.ts:38`). The lesson's canon asks three of them (7 + 3, 6 + 4, 8 + 2: `packages/core/src/progress/canonMathFacts.generated.ts:17-26`).
- **A round:** 6 of the 9 bonds, shuffled, with no bond twice. The lesson's three are always among them, so the game echoes what she meets in lessons.
- **Later, not costed here:** Dave's double ten-frame for teens once adding to twenty is current. It needs its own line set.

### A round, beat by beat

1. **Start.** The door tap fades the Map out (200 ms). The play screen fades in with bed 1, 6 empty beads, and Emma idle.
2. Emma: `game.bed.open`, "Ten flowers in every bed!"
3. **Bed k.** It shows `g` flowers in the first `g` slots, top row first, as the lesson's ten-frame fills (`TenFrameCell`, `mobile/src/screens/math/glyphs.tsx:184`). The other slots are empty soil. Emma: `game.bed.ask.<g>`, "Seven and what make ten?". As in a lesson, the three chips answer from the moment she starts the question (`gateOpen`, `AnswerChip.tsx:70-71`).
4. **She taps a chip.**
   - **Right:** the chip sinks. One seed per empty slot hops from the chip to its slot, 80 ms apart, and lands as a bud. The buds turn to flowers using the lesson's missing-number choreography (bud k crossfades to a flower in 150 ms while scaling 1 → 1.15 → 1, spring 300 / 14, at 80 × k ms; `mobile/src/screens/math/MissingNumber.tsx:13-16`). Then `sfx-chime`, Emma `celebration`, and `game.bed.yes.<g>`, "Yes! Seven and three make ten!". Bead k fills.
   - **Wrong** (§ 1.3): the chip wiggles, and no seed moves. The bed never part-fills or overfills. Hint: the empty slots twinkle once in order, each 1 → 1.1 → 1 over 300 ms, 150 ms apart (the counting row's ripple, `mobile/src/screens/math/CountingRow.tsx`). This invites her to see how many are empty.
   - **Second wrong:** the right chip glows and the others dim, Emma says `game.this-is.<10−g>`, "This one is three.", and she taps it.
5. 400 ms after the yes line, the full bed slides out to the left and the next slides in from the right (300 ms, ease-out).
6. Beds 2-6 repeat beats 3-5.
7. **End.** After bed 6's yes line: 400 ms → Emma `cheering`, `game.bed.close`, "Ten every time! What a garden!" → 400 ms → the Map, with no line.

About **1-1.5 minutes** for six beds.

```
FILL THE FLOWER BED
phone portrait (375×667)              tablet portrait (820×1180)
+------------------------------+     +--------------------------------------------+
| [<]                          |     | [<]          ● ● ◉ ○ ○ ○                    |
|        ● ● ◉ ○ ○ ○           |     |                                            |
| (Emma ) +------------------+ |     |  ( Emma  )  +----------------------------+ |
| (perch) | Seven and what   | |     |  ( perch )  | Seven and what make ten?   | |
|         | make ten?        | |     |             +----------------------------+ |
|         +------------------+ |     |                                            |
| +--------------------------+ |     |     +--------------------------------+     |
| |  ✿    ✿    ✿    ✿    ✿   | |     |     |   ✿     ✿     ✿     ✿     ✿    |     |
| |  ✿    ✿    ·    ·    ·   | |     |     |   ✿     ✿     ·     ·     ·    |     |
| +--------------------------+ |     |     +--------------------------------+     |
|                              |     |        the bed: the lesson's ten-frame     |
|   [ 2 ]    [ 3 ]    [ 4 ]    |     |                                            |
|   88 pt, 32 above safe btm   |     |       [ 2 ]       [ 3 ]       [ 4 ]        |
+------------------------------+     +--------------------------------------------+
  ✿ flower   · empty soil slot   ◉ this bed
```

- **The bed:** the lesson's ten-frame look: a white frame with a pink border and 5 × 2 slots (`TenFrameCell` and `FRAME_COLUMNS`, `glyphs.tsx:180-216`). Its width is the content width − 32, capped at 560 pt, and its height follows the frame's 170 : 80 aspect. Flowers are the counting row's `FlowerGlyph` and buds are `BudGlyph` (`glyphs.tsx:29`, `:63`).
- **Why the ten-frame and not the Hub's flower tray:** the Hub tray's flowers mean progress. A tray-look bed that fills in a game that counts toward nothing would suggest she is earning flowers. The ten-frame is the lesson's own scaffold for 6-10 (`mobile/src/screens/math/ScaffoldFlash.tsx:132`), so play also points back to the lesson.
- **Chips:** the lesson's chips for a missing number: the missing part plus two neighbours, ordered by `buildChipOrder` (`mobile/src/screens/math/problemChips.ts:80-98`, `chipOrder.ts:37`).

### What she hears

Everything is from § 5. The open line, then per bed one question and one "yes" (plus at most a try-again and a "this one"), then the closer: about 14 short lines in a round. No line mentions fingers, speed or counting.

### Reduce Motion

No seed hop and no scale. The buds fade in (200 ms) and crossfade to flowers (200 ms). The bed change is a 200 ms crossfade, and the hint twinkle becomes a 200 ms opacity dip per slot.

### Reused vs new

| Reused (file)                                                                  | New                                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Ten-frame geometry and look (`glyphs.tsx:180-216`)                             | `FlowerBed` component: the ten-frame with flowers in its slots |
| `FlowerGlyph`, `BudGlyph` (`glyphs.tsx:29`, `:63`)                             | Seed-hop motion, chip → slot                                   |
| Bud → flower choreography (`MissingNumber.tsx:13-16`)                          | Bed slide between beds                                         |
| Missing-number chips (`problemChips.ts:80-98`, `chipOrder.ts:37`)              | 30 bundled lines (§ 5)                                         |
| Bonds-to-ten range (`missingNumbers.ts:38`)                                    |                                                                |
| Lesson frame: `MathHud` peek, `EmmaStage`, `CaptionRibbon`, `sfx` chime / poof |                                                                |

**Cost:** 30 lines, 684 Lily characters. No new pictures (the door shows a drawn mini-bed). **Size: S** on top of the frame (**M** as a first build).

---

## 3. Concept B: Mirror bugs (Number Garden)

### Pitch

A ladybird lands with spots on one wing only. She taps the bug, and the spots appear on the other wing as a mirror: a double. "How many spots now?" Then one more spot drops on, and Emma says the trick out loud: "Three and three make six. One more makes seven!" Four bugs, then they have all flown. This is Dave's derived-fact game, the one he names as best for a child who counts 3 + 2 on her fingers: it gives her a fact to reason from instead of a count.

### Entry and content

- **Door:** the Number Garden Map. It opens when adding to ten is current or mastered, so **it is open for Marian now.** If A is also built, the door opens the shelf (§ 1.1).
- **Content:** the doubles within adding to ten: 2 + 2 up to 5 + 5 (sums ≤ 10, the step's range). Then the near double one above each, while the sum stays ≤ 10: 2 + 3, 3 + 4, 4 + 5. The lesson's canon already asks 2 + 2, 4 + 4 and 4 + 5 (`canonMathFacts.generated.ts:17-26`). 1 + 1 is left out because one spot per wing is not a puzzle at 6-9.
- **A round:** the four doubles 2-5, shuffled. Each bug with a double of 2-4 adds its near double, and 5 + 5 has none.
- **Later, not costed here:** doubles 6-9 and their near doubles once adding to twenty is current. Spots above 5 per wing need a 2-row wing pattern.

### A round, beat by beat

1. **Start:** the screen fades in (200 ms) with 4 empty beads. Emma: `game.bugs.open`, "Here come the bugs!"
2. **Bug k** drops onto the play area (300 ms, ease-out). Its left wing has `n` spots in the die pattern (`PIP_POSITIONS`, `mobile/src/screens/math/glyphs.tsx:122`), and its right wing is bare. Emma: `game.bugs.half.<n>`, "Three spots. Tap the bug!". The bug is the only target, and its whole body is the hit area.
3. **She taps the bug.** Each spot slides across the bug's middle line to its mirror place (250 ms, 80 ms apart), with `sfx-plink` (`sfx.ts:134`). This move has no wrong. Emma: `game.bugs.how-many`, "How many spots now?". Three chips appear for the sum `2n`, from `buildChipOrder` on the bond n + n.
4. **The answer.** Right: `game.bugs.double.<n>`, "Yes! Three and three make six!". Wrong and second wrong: as § 1.3, and the hint is that the spots twinkle wing by wing.
5. **One more** (n = 2-4): one spot drops onto the right wing (300 ms, `sfx-plink`). Emma: `game.bugs.one-more`, "One more spot! How many now?". Chips for `2n + 1`. Right: `game.bugs.near.<n>`, "Yes! Three and three make six. One more makes seven!". Wrong: as § 1.3.
6. The bug opens its wings and flies off the top (600 ms), and bead k fills.
7. Bugs 2-4 repeat beats 2-6.
8. **End:** 400 ms → `game.bugs.close`, "You know your doubles!" → 400 ms → the Map.

About **2 minutes**: 4 bug taps and 7 answers.

```
MIRROR BUGS (after the mirror tap)
phone portrait (375×667)              tablet portrait (820×1180)
+------------------------------+     +--------------------------------------------+
| [<]                          |     | [<]             ● ◉ ○ ○                     |
|          ● ◉ ○ ○             |     |                                            |
| (Emma ) +------------------+ |     |  ( Emma  )  +----------------------------+ |
| (perch) | How many spots   | |     |  ( perch )  | How many spots now?        | |
|         | now?             | |     |             +----------------------------+ |
|         +------------------+ |     |                                            |
|         .---.---.            |     |            .------.------.                 |
|       .' •   |   • '.        |     |          .'  •     |     •  '.              |
|      |   •   |   •   |       |     |         |     •    |    •     |             |
|       '. •   |   • .'        |     |          '.  •     |     •  .'              |
|         '---'---'            |     |            '------'------'                 |
|                              |     |                                            |
|   [ 5 ]    [ 6 ]    [ 7 ]    |     |       [ 5 ]       [ 6 ]       [ 7 ]        |
+------------------------------+     +--------------------------------------------+
  before the tap the right wing is bare and no chips show
```

- **The bug:** drawn with react-native-svg, like `DotCardCell` (`glyphs.tsx:153`): a red two-wing shell, a dark head and a dark middle line. It needs no picture file, so the spots sit exactly where the die pattern puts them.
- **Sizes:** spots 24 pt on phones and 32 pt on tablets, never below the 20 pt counting-dot floor (`greet-math-native.md` § 4). On phones the bug is the content width − 32 wide.

### Reduce Motion

No drop, slide or flight. The mirrored spots fade in on the right wing (200 ms), the extra spot fades in, and the bug fades out at the end (200 ms).

### Reused vs new

| Reused (file)                                                 | New                                                 |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Die pattern `PIP_POSITIONS` (`glyphs.tsx:122`)                | Drawn bug (SVG), in two states: wings shut and open |
| Chips (`chipOrder.ts:37`), on the bonds n + n and n + (n + 1) | Mirror-slide, spot-drop and fly-off motions         |
| `sfx-plink`, chime and poof (`sfx.ts:134`)                    | A two-question move (double, then one more)         |
| Lesson frame, as in A                                         | 23 bundled lines (§ 5)                              |

**Cost:** 23 lines, 586 Lily characters (A and B share `game.again` and five of the `game.this-is` lines). No pictures. **Size: M**: a new drawn figure, three motions and a two-step move.

---

## 4. Concept C: Robot talk (Word Song)

### Pitch

A friendly clay robot has three round lights on its chest. It talks in sounds, /s/ … /u/ … /n/, and one light comes on with each sound. Three pictures wait below. She taps the picture the robot said, and the robot says the whole word: "sun!". Six words, and it is done. No reading at all, so it works for the youngest, for children learning English, and later for the Danish version with its own sounds. The robot's sounds are **Lily's own sound clips from the Word Song blends**, not new audio: the ear-approved phonemes that Word Song's letter taps already play (`word-song-native.md` § 4).

### Entry and content

- **Door:** the Word Song Map. It opens when blending sounds is current or mastered.
- **Content:** the words of current and mastered Word Song steps that have a baked blend clip with sound marks: 40 words, 8 per short-vowel step (`BLEND_MARKS`, `mobile/src/audio/blendMarks.generated.ts`). Every one of them has a picture in the app (each `picture-<word>` key checked in `mobile/src/assets/registry.ts`, 2026-10-19).

  | Step current or mastered        | Words added to the pool                                  |
  | ------------------------------- | -------------------------------------------------------- |
  | blending sounds (`blending-cv`) | cat, bag, hat, van, man (its own words that have a clip) |
  | cat words (`cvc-words`)         | fan, pan, tag (the rest of short a)                      |
  | short o                         | box, cot, dog, fox, hot, log, mop, pot                   |
  | short u                         | bug, bus, cup, jug, nut, rug, sun, tub                   |
  | short i                         | bib, bin, fig, lid, pig, pin, sip, wig                   |
  | short e                         | bed, gem, hen, jet, leg, net, pen, web                   |

- **A round:** 6 words from the pool with no repeats; when the pool is smaller (5 at blending sounds), every word once. The two other pictures come from the pool too. One of them rhymes with the target when the pool has a rhyme (cat → hat), so she has to hear the first sound; the other is any pool word.

### A round, beat by beat

1. **Start:** the screen fades in (200 ms). The robot stands in the middle with its lights off, three pictures sit below (not yet tappable), and there are 6 empty beads. Emma: `game.robot.open`, "Listen to the robot! Which one is it?"
2. **Word k: the robot talks.** The blend clip plays only from its first sound to its third: from `segments[0].on − 30 ms` to `segments[2].off + 80 ms` (`blendMarksFor`, `mobile/src/audio/blendMarks.ts:30`). It plays on the tap-clip player (`mobile/src/audio/tapClip.ts:40`), the window Word Song already uses for a letter's sound. Light k comes on 40 ms before sound k (`litAt` and `MARK_LEAD_MS`, `blendMarks.ts:44`) and stays on. The pictures come alive at the clip's end. A tap on the robot plays the sounds again, at any time and with no limit.
3. **She taps a picture.**
   - **Right:** the whole word plays (the clip's word segment, from `segments[3].on − 30 ms` to its end, as a Word Song picture tap already does). The picture pops (1 → 1.15 → 1, spring 300 / 14), all three lights flash together, the robot bounces once, and Emma turns `celebration` with `sfx-chime`. Bead k fills. No extra Emma line: the word is the reward.
   - **Wrong** (§ 1.3): the picture wiggles, Emma says `game.again`, then the robot says its sounds again (the hint).
   - **Second wrong:** the right picture glows and the other two dim, the robot says the whole word, and she taps it.
4. 400 ms after the word, the lights go off and the three pictures crossfade to the next three (200 ms).
5. Words 2-6 repeat beats 2-4.
6. **End:** 400 ms → `game.robot.close`, "You know every word!" → 400 ms → the Map.

About **1 minute** for six words.

```
ROBOT TALK (the robot on its 2nd sound)
phone portrait (375×667)              tablet portrait (820×1180)
+------------------------------+     +--------------------------------------------+
| [<]                          |     | [<]          ● ● ◉ ○ ○ ○                    |
|        ● ● ◉ ○ ○ ○           |     |                                            |
| (Emma ) +------------------+ |     |  ( Emma  )  +----------------------------+ |
| (perch) | Listen to the    | |     |  ( perch )  | Listen to the robot!       | |
|         | robot! Which one | |     |             | Which one is it?           | |
|         | is it?           | |     |             +----------------------------+ |
|         +------------------+ |     |                  .--o--.                   |
|           .--o--.            |     |               .-'       '-.                |
|          | ◕   ◕ |           |     |               |  ◕     ◕  |                |
|          | ● ● ○ |  lights   |     |               |  ●  ●  ○  |  lights        |
|          '-------'           |     |               '-----------'                |
| +-------+ +-------+ +-------+|     |  +----------+   +----------+   +----------+ |
| | (sun) | | (bus) | | (nut) ||     |  |  (sun)   |   |  (bus)   |   |  (nut)   | |
| +-------+ +-------+ +-------+|     |  +----------+   +----------+   +----------+ |
+------------------------------+     +--------------------------------------------+
  (sun) = the word's picture; no text is shown
```

- **Pictures:** the Word Song pictures (`WordPicture`, `mobile/src/screens/wordSong/WordPicture.tsx:12`; `pictureAsset`, `mobile/src/assets/index.ts:44`). On a 375 pt phone, three across with 16 pt gaps are (343 − 32) / 3 ≈ 103 pt each, above the 72 pt floor. They are bottom-anchored like chips.
- **The robot:** one new picture made with the picture pipeline, with the lights drawn on top as Views so they can follow the marks. It has no text and no letters on its chest: the game stays oral.

### Reduce Motion

The lights still come on, because they carry the sounds (an opacity change, not motion). No bounce, pop or wiggle. A right picture gets a 200 ms highlight fade, and the picture change is a 200 ms crossfade.

### Reused vs new

| Reused (file)                                                                                     | New                                    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 40 baked blend clips and their sound marks (`blendMarks.generated.ts`, `blendMarks.ts:30`, `:44`) | Robot picture (1)                      |
| The tap-clip player's windowed playback (`tapClip.ts:40`)                                         | Three drawn lights driven by the marks |
| 40 word pictures (`WordPicture.tsx:12`, `assets/index.ts:44`)                                     | The robot's bounce and lights flash    |
| Lesson frame, as in A                                                                             | 3 bundled lines (§ 5)                  |

**Cost:** 3 lines, 74 Lily characters, and **0 new sound renders**. 1 new picture. **Size: S** on top of the frame (**M** as a first build).

---

## 5. Copy table (every line a game speaks)

All lines are Lily, bundled like the path lines (`GUIDANCE_LINES`, `packages/core/src/emmasPath/guidanceLines.ts:323`), and pass the voice-QA ear test before they ship. `<N>` and `<n>` are number words, and `<N>` is capitalised at the start of a line. Counted by a scratch script, 2026-10-19.

| Key                           | Text                                                 | For           | Lines  | Chars     |
| ----------------------------- | ---------------------------------------------------- | ------------- | ------ | --------- |
| `game.again`                  | "Hmm... try again?" (the lesson's text)              | A, B, C       | 1      | 17        |
| `game.this-is.<n>`, n 1-10    | "This one is <n>."                                   | A 1-9, B 4-10 | 10     | 169       |
| `game.bed.open`               | "Ten flowers in every bed!"                          | A             | 1      | 25        |
| `game.bed.ask.<g>`, g 1-9     | "<N> and what make ten?" (the lesson's question)     | A             | 9      | 207       |
| `game.bed.yes.<g>`, g 1-9     | "Yes! <N> and <10−g> make ten!"                      | A             | 9      | 252       |
| `game.bed.close`              | "Ten every time! What a garden!"                     | A             | 1      | 30        |
| `game.bugs.open`              | "Here come the bugs!"                                | B             | 1      | 19        |
| `game.bugs.half.<n>`, n 2-5   | "<N> spots. Tap the bug!"                            | B             | 4      | 96        |
| `game.bugs.how-many`          | "How many spots now?"                                | B             | 1      | 19        |
| `game.bugs.double.<n>`, n 2-5 | "Yes! <N> and <n> make <2n>!"                        | B             | 4      | 115       |
| `game.bugs.one-more`          | "One more spot! How many now?"                       | B             | 1      | 28        |
| `game.bugs.near.<n>`, n 2-4   | "Yes! <N> and <n> make <2n>. One more makes <2n+1>!" | B             | 3      | 151       |
| `game.bugs.close`             | "You know your doubles!"                             | B             | 1      | 22        |
| `game.robot.open`             | "Listen to the robot! Which one is it?"              | C             | 1      | 37        |
| `game.robot.close`            | "You know every word!"                               | C             | 1      | 20        |
| **All three**                 |                                                      |               | **48** | **1,207** |

- **Per game, shared lines included:** A 30 lines / 684 characters; B 23 / 586; C 3 / 74.
- **New spoken words:** _spot_, _spots_, _robot_, _doubles_, and _bugs_ (the plural of _bug_). Everything else is already in a canon line or a core line table (scratch check, 2026-10-19). _Doubles_ is the one new maths word, kept on purpose because it names the trick.
- **The framing (Dave § 1):** lines praise the noticing ("You know your doubles!") and name the trick ("One more makes seven!"). None mentions fingers, speed, counting or "not yet". No line, here or on the Map, invites a game or another round.
- **Danish version:** every line is a row in this table, and the number words are the only content. The art carries no text, and C's content is a language's blend clips. A Danish build swaps the table and the clips, not the games.

## 6. Not picked, in one line each

- **Bunny hop path:** strong board-game evidence, but it trains counting on, while Dave's § 1 aim for a learner on adding to ten is moving from counting to recall. It would be the right pick for a learner at numbers.
- **Seesaw:** Dave has no source for it, and "make it level" reads best as drag-and-drop, which his touch rule avoids.
- **Sound baskets:** good, and it opens earlier (letter sounds). But sorting takes a drag or two taps per move, and at letter sounds every picture word comes from a later step. C has a one-tap move and reuses more.
- **Magic letter:** the strongest reading evidence, but every word chain needs minimal pairs that all have pictures, and it is a reading game. Better as a later, mastered-only game.
- **Feed the animals:** a reading game that opens only on mastery, so it reaches the fewest learners now.

## 7. Recommendation: build A first (Fill the flower bed)

1. **It opens today** for Marian, and for every learner from Number Garden step 2 on. That is where Thomas saw "too easy".
2. **It practises the make-ten lever** Dave names for the finger-counter, on the lesson's own ten-frame, so the game points back to the lesson.
3. **It is the cleanest "answer is the move"**: the chip she picks is the seeds that fill the bed.
4. **It has the least new art** (none) and reuses the most: the ten-frame, flowers, buds, the bloom choreography and the missing-number chips.

**Second: B (Mirror bugs).** It is the doubles lever and Dave's top pick for 3 + 2. It costs more (a drawn bug, three motions, a two-question move) and sits behind A in the same world. **C (Robot talk)** is the cheapest of all, but it opens only from blending sounds, and its value for Marian depends on where her Word Song stop is. Build it whenever Word Song needs a door.

## 8. For Thomas (subjective calls only)

- **T1. Which concept to build first.** Recommendation: A, Fill the flower bed (§ 7).
- **T2. The door on the Map only, not on the Hub.** Recommendation: the Map only (§ 1.1). The lesson keeps the Hub, and the game sits beside the path.
- **T3. The lines of the picked game** (§ 5). Recommendation: approve the templates. Each set goes through the voice-QA ear test before it ships.
- **T4. The look of the new art, when that game is picked:** the drawn bug for B, the robot picture for C. Recommendation: the bug drawn in the app's clay colours; the robot from the picture pipeline, with a contact-sheet approval.
- **T5. The robot talks in Emma's (Lily's) voice, with no "robot" voice effect.** Recommendation: yes. The sounds stay the ear-approved renders, and an effect would change sounds that were tuned one by one (`BLEND_GRAPHEME_IPA`, `api/_tts.ts:1107`).
