# Fill the flower bed: the first side mini-game (native build spec)

> **Superseded 2026-10-20** by `design/native/flower-bed-into-add-to-10.md`: Thomas moved the bed into adding to ten's missing-number problems, and the door, the route and the game screen are retired. § 2.2 (the bed's look) and § 2.4's hop stay the reference for the drawing and the motion.

**Ask (Thomas, 2026-10-19, verbatim):** "I have some thought about adding some mini games for casual fun on the side of the 'Numbers garden' and 'Word song' paths."

**Decided by popup (Thomas, 2026-10-19):** **T1:** build concept A, "Fill the flower bed", first. **T2:** the play door lives on each world's Map, not on the Hub.

**Amended 2026-10-20, after the phone check of PR #635 (Thomas, verbatim, on a screenshot of the Number Garden Map):** "The door looks ok, but it doesn't look like a door if that was the purpose. Why are flowers not planted in brown soil?" **Picked by popup (Thomas, 2026-10-20): "Soil beds + clay button".** The bed becomes brown soil with 10 planting holes in the same 2 rows of 5 (§ 2.2). The door holds a clay piece of that bed, like the clay pieces on the path: 2 variants for about $0.16, and Thomas picks one (§ 1.2.1, T6). Dave's answer on whether soil with holes still reads as a ten-frame is folded in (§ 7, D6-D8). The build change is look-only: no geometry, timing, line or rule changes (§ 5).

**Sources:** the concepts, `design/native/mini-games-concepts.md` (PR #623, branch `kyle/mini-games-concepts`), and Dave's research, `design/research/engagement-and-mini-games-2026-10-19.md` (PR #620, branch `dave/engagement-mini-games`). Dave's § 3 guard rails stand as written. This spec turns concept A, and the frame every game shares, into numbers Devon can build from.

**Still open:** **T3**, the game's lines, which Thomas hears at the voice-QA ear test before release (§ 6). **T6**, the pick of 1 of the 2 clay variants, then the soil look at the device check (§ 6). **T4** (art) for A is now one clay piece, the door's (§ 1.2.1); the popup settled its subject, and its look is T6. **T5** (the robot voice) belongs to concept C and is not part of this build.

**Standing rules applied:** any learner of about 6-9 (Marian is one of them); no Danish premise; every spoken line sits in the copy table (§ 3), and no text is baked into art, so the planned Danish version swaps rows, not screens; per learner (learner profiles, `design/native/learner-profiles.md`, PR #622 for the code); audio-first; minimal reading; never a red X.

**Scope:** specs only. No code and no tickets.

## Goal

A child who wants a short break finds a small game beside the Number Garden path. She fills six flower beds to ten, hears each bond said out loud, and is back on the Map after about a minute. The game counts toward nothing.

## User state entering

She is on the Number Garden Map. Adding to ten (`add-to-10`) is her current step or a mastered one. The Map's open line may still be playing, and no unlock beat is running.

---

## 1. The shared frame (built once; B and C reuse it)

### 1.1 Which games are open (core)

A new core module, `packages/core/src/games/miniGames.ts` (imported as `@marian/core/games/miniGames` through the package's `"./*"` export, `packages/core/package.json:10`):

| Name                         | Shape                                                         | Meaning                                                                                                     |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GameId`                     | `'flower-bed'`                                                | B adds `'mirror-bugs'`, C `'robot-talk'`                                                                    |
| `GAMES`                      | `Record<GameId, { world: MasteryTrack; opensAt: SkillNode }>` | `'flower-bed': { world: 'math', opensAt: 'add-to-10' }`                                                     |
| `openGames(progress, world)` | `(Progress \| null, MasteryTrack) => GameId[]`                | The world's games whose `opensAt` step is current or mastered, in `GAMES` order. `null` progress gives `[]` |
| `flowerBedRound(rng)`        | `(rng: () => number) => FlowerBedBed[]`                       | One round, § 2.1                                                                                            |

- **"Current or mastered"** is `progress.skillLevels[opensAt] === 'mastered' || currentStepOf(progress, world) === opensAt`. `currentStepOf` is the Hub's rule: the first step not yet mastered, in tree order (`packages/core/src/hub/hubCardModel.ts:74-81`).
- **For Marian today:** adding to ten is her current step, so the door is there. A learner whose start is land 1 (numbers not yet mastered) sees no door until numbers is mastered.
- **Nothing here is persisted.** It adds no `Progress` field, no storage key and no migration.

### 1.2 The play door on the Map

**Which worlds:** only a world with at least one open game shows a door. In this build that is Number Garden only. Word Song gets its door when C ships. The Hub never shows one (T2).

**When:** decided once when the Map mounts, from the same progress the visit reads (`safeLoadProgress`, `mobile/src/screens/map/useMapVisit.ts:163-169`). `useMapVisit` returns `games: GameId[]`. The door never pops in or out while the Map is up.

**No arrival beat:** when a game first opens for a learner, nothing announces it: no line, no sparkle, no "new". The door is simply there on her next Map visit. No Emma line on the Map, the Hub or Session End names a game.

**Look:** a round clay disc, the same face and shadow as the Map's Home button (`HomeButton`, `mobile/src/screens/map/mapChrome.tsx:29-73`; face `:199-206`). Home and the Number Garden door are both wood clay, the world's clay of the Hub's map button (`LOOK.math`, `mobile/src/screens/hub/MapButton.tsx:23-28`; Word Song's honey `:29-34` is for C's door). Inside the disc sits the game's clay piece, `ui-flower-bed` (§ 1.2.1): a small soil bed planted full of flowers. It is drawn as Home draws its house, `PathImage` at `Math.round(68 × k)` pt (`mapChrome.tsx:70`): 40 pt in the 56 pt phone disc and 68 pt in the 96 pt tablet disc. It is a fixed picture, always full, and never shows how a round went (D7 c). It shows no text, no badge, no count and no idle animation. _(Amended 2026-10-20: it replaces the flat `FlowerBed` drawing at 0.8 × the disc.)_

- **Why the disc stays:** Home and the door are a pair of chrome buttons in one header row. The disc, with its ledge shadow and the press that sinks it, is what says "button" on the Map, and every learner already uses it on Home. A bare clay piece would be the only clay picture in the header with no button under it, so it would read as decoration.
- **Not a literal door.** "Door" is this spec's name for the button (`map-game-door` and `GameDoor` in the code). Its job is to say "a game is here", the way Home's house says where Home goes: it shows the bed she is about to fill. It is not meant to look like a door.
- **Nothing more is needed to read as tappable.** The disc, its ledge and its press are Home's, so it reads as Home does. A play triangle, a glow, a sparkle, a bounce or a badge would be an arrival beat or a lure (no arrival beat, above; § 1.5 "Little decoration"; § 8). If learners do not find it, that is a finding for Thomas, not a reason to animate it.

**Position** (`S` = the safe rect; the forms of `map-native.md` § 1). `mapScreenLayout` returns a new `door: Rect` (`mobile/src/layout/mapScreenLayout.ts:105-211`):

| Form                  | Door rect                           | Size    | Why there                                                                  |
| --------------------- | ----------------------------------- | ------- | -------------------------------------------------------------------------- |
| P (phone portrait)    | (S.x + S.width − 16 − 56, S.y + 8)  | 56 × 56 | Home's mirror on the right (Home is at S.x + 16, `mapScreenLayout.ts:113`) |
| L (phone landscape)   | (S.x + 16, S.y + 80)                | 56 × 56 | In the rail under Home (Home ends at S.y + 64; 16 pt gap)                  |
| W (tablet portrait)   | (S.x + S.width − 24 − 96, S.y + 14) | 96 × 96 | Home's mirror on the right (Home at S.x + 24, `:112`)                      |
| TL (tablet landscape) | (S.x + 144, S.y + 14)               | 96 × 96 | Beside Home in the column's top row (Home 24-120, gap 24)                  |

**Checks (hand-computed from `mapScreenLayout.ts`):**

- **P at 375:** "Number Garden" is 206 pt wide at 28 pt (`map-native.md` § 2), so centred it runs 84.5-290.5. The door starts at 303, which clears the title by 12.5 pt, the same gap Home leaves on the left. The door sits in the header row; the pane starts at S.y + 72 (`:134`).
- **L at 667×375:** the rail holds Home and the door, 8 + 56 + 16 + 56 = 136 pt. The caption slot starts at S.y + 287 (`:140-145`). The pane starts at S.x + 88 (`:148`), 16 pt right of the door.
- **W at 820:** the 52 pt title is about 383 pt wide (206 × 52 / 28), so it runs 218.7-601.3; the door starts at 700. At 744 pt wide the gap is still 60.7 pt.
- **TL:** the door ends at S.y + 110, and the title starts at S.y + 124 (`:156-162`). The column is 350 wide from S.x + 16 (`TL_COLUMN`, `:49`), so the door (144-240) sits inside it.

```
P  phone portrait (375×667)             L  phone landscape (667×375)
+------------------------------+        +----------------------------------------------+
| (⌂)    Number Garden     (▦) |        | (⌂) |  path pane, scrolls ↕                  |
|------------------------------|        | (▦) |      (badge)                           |
|  path, unchanged             |        |     |  ~~ ( ) (◎) ( ) ( ) ~~ land 2 ~~~~~~~~ |
|       (badge)                |        |     |                                        |
|   ( ) (◎) ( ) ( ) ( )        |        +-----+----------------------------------------+
|------------------------------|        | [🔊 caption, unchanged                     ] |
| [🔊 caption, unchanged     ] |        +----------------------------------------------+
+------------------------------+

W  tablet portrait (820×1180)                     TL  tablet landscape (1180×820)
+--------------------------------------------+    +-----------------+-----------------------------+
| ( ⌂ )        Number Garden          ( ▦ )  |    | ( ⌂ )  ( ▦ )    |  path pane                  |
|--------------------------------------------|    |                 |      (badge)                |
|  path, unchanged                           |    |   Number        |   ( ) (◎) ( ) ( ) ( )       |
|              (badge)                       |    |   Garden        |                             |
|    ( )  (◎)  ( )  ( )  ( )                 |    |                 |                             |
|--------------------------------------------|    | [🔊 caption   ] |                             |
| [🔊 caption, unchanged                   ] |    +-----------------+-----------------------------+
+--------------------------------------------+
  (⌂) Home    (▦) the play door: a wood clay disc holding the clay soil bed (ui-flower-bed)
```

**Taps:** the door follows the Map's stop rules (`map-tap-to-play.md` § 2, § 5):

- It starts on release (`Pressable` `onPress`), never on a drag.
- It is ignored for 400 ms after the Map mounts (`MAP_TAP_ARM_MS`, `useMapVisit.ts:99`), until an unlock beat's cheer, and while the launch lock holds (`launchLocked`, `useMapVisit.ts:154`, `:426`).
- An armed tap cuts the Map line in flight and starts the launch lock. About 200 ms after the release (`LAUNCH_DELAY_MS`, `useMapVisit.ts:96`) the route changes to `game`.
- **Press:** Home's own press, the face sinking 6 × k over 120 ms (`mapChrome.tsx:39-46`; `PRESS_MS`, `mobile/src/screens/hub/clay.ts:21`). It is chrome, like Home, not a stop.
- **Accessibility:** `accessibilityRole="button"` and the label from § 3.2. `testID="map-game-door"`.

**Two or more open games in one world** (only once B is built): the door opens a small clay shelf under it with one bed, bug or robot per open game (72 pt on phones, 96 pt on tablets). A tap on one starts that game; a tap outside, or on the door again, closes the shelf. **Not in this build.** `openGames` already returns a list, so B adds the shelf without changing the rule.

#### 1.2.1 The door's clay piece, `ui-flower-bed` (generation brief, amended 2026-10-20)

It is made with the pack generator in its clay style, as the learner avatars were (`learner-profiles.md` § 9; `style: "clay"`, `scripts/packPictureLib.ts:52-67`). Two variants cost about $0.16 (Thomas's popup, 2026-10-20), and `--dry-run` prints the real figure before any call. Thomas picks one on the contact sheet (T6). Pictures only: no digits, letters or signs (`emmas-path-spec.md` § 5).

| Id              | Subject                                                                                                                                                                                                                                                                                                           | Must not look like                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-flower-bed` | A small raised flower bed: a low rectangular wooden planter in warm caramel-brown wood with a thick rounded rim, filled to the top with dark-brown soil, with ten pink five-petal flowers with yellow centres and short green leaves planted in two straight rows of five, seen from the front and a little above | the egg tray (`add-to-20`, a crate of 2 × 5 eggs seen from the top); the flowers in a pot (`add-to-10`, `ui-bud-open`, `ui-bud-closed`, a round terracotta pot); the seed trays on the Hub card and under the Map's current stop (a light-brown clay pill with dark holes, `HubFlowerTray.tsx:39-44`, `mapFx.tsx:264-298`); the house (`ui-house`); a door, a gate or a fence |

**Reference pieces** (`public/assets/path/*-512.webp`):

- **Style:** the generator's three clay anchors, which every clay call sends: `cvc-words-short-o`, `cvc-words-short-i` and `bee-words` (`CLAY_ANCHORS`, `packPictureLib.ts:58-62`).
- **To judge the contact sheet against:** `add-to-10` (the soil and the flowers should feel like its pot's), `add-to-20` (the bed must not be mistaken for its egg tray, a stop on the same Map), and `ui-house` (its neighbour at the same size on the same disc: the same finish and about the same visual weight).

**The manifest row** (a one-row manifest passed with `--manifest`, as the avatars' `design/native/avatar-manifest.json` is). Batch 16 is the next free word batch: the picture pack ends at 14 and the avatars are 15. The generator turns `avoid` into the prompt's "Must not look like" (`buildPrompt`, `packPictureLib.ts:423-434`); `distinctFrom` only labels the contact sheet.

```json
{
  "word": "ui-flower-bed",
  "tier": "game-art",
  "batch": 16,
  "style": "clay",
  "subject": "A small raised flower bed: a low rectangular wooden planter in warm caramel-brown wood with a thick rounded rim, filled to the top with dark-brown soil, with ten pink five-petal flowers with yellow centres and short green leaves planted in two straight rows of five, seen from the front and a little above.",
  "avoid": [
    "anything red",
    "a door, a gate, a fence or a sign",
    "a wooden egg crate seen from the top, eggs or compartments",
    "a round flower pot or terracotta",
    "a light-brown clay tray with a row of dark holes",
    "an empty hole or a missing flower",
    "a person, a watering can or a spade",
    "a face on anything",
    "a coloured circle, badge or background behind it"
  ],
  "distinctFrom": ["add-to-20", "add-to-10", "ui-bud-open", "ui-house"]
}
```

**Into the app:** copy the picked raw variant (`design/references/picture-pack/openai/batch-16/ui-flower-bed__v<k>.png`, 1024 px, transparent) as `ui-flower-bed.png` into a source folder. Then run `yarn path-art <folder> ui-flower-bed` (`scripts/build-path-art.ts`), which writes `public/assets/path/ui-flower-bed-256.webp` and `-512.webp`, and `npm run export-assets` in `mobile/`. `UiArtId` and `PATH_ART_SET` get `'ui-flower-bed'` (`packages/core/src/emmasPath/pathArt.ts:44-52`, `:120-127`), and `pathArt.test.ts` fails until both files exist.

### 1.3 Entering and leaving

- **Route:** a new core `Route` member, `'game'` (`packages/core/src/router/route.ts:14-54`), with `ROUTE_EXITS` `map → game` and `game → map` only (`mobile/src/router/routes.ts:40-51`). **Why `game` and not `play`:** `play` already names the Map's current-stop start (`MapVisitOptions['play']`, `mobile/src/screens/map/MapScreen.tsx:65-66`). The world and the `GameId` live in App state, as a peek's do (`route.ts:47-53`).
- **In:** the Map fades out over its own 200 ms (`MAP_EXIT_MS`, `MapScreen.tsx:43`) and the game screen fades in over 200 ms.
- **Out, at the end or on Back:** the route returns to the same world's Map with `quietReturn: true` (`MapEntry`, `MapScreen.tsx:45-52`): no open line, every stop tappable, as after a peek or a replay (`map-tap-to-play.md` § 4).
- **The Map's origin is kept.** App keeps how the Map was first entered, so Home on the returned Map goes where it went before the game: the Hub, or the picker after Session End's handover with 2 or more learners (`learner-profiles.md` § 2.4).
- **No Session End, ever.** Nothing in a round reaches `handleMathComplete` or any Session End path.

### 1.4 The play screen

It is the lesson's Math frame, so a child who knows a lesson knows where everything is. **Layout: `mathLayout(viewport)` as it is** (`mobile/src/layout/mathLayout.ts:474-478`), the frames a missing number uses (`extendedMathLayout`, `:616-628`). App's `layoutForRoute` returns `mathLayout` for `game` (`mobile/src/layout/routeLayout.ts:14-27`). The game adds one thing: the bed's size inside `problem` (§ 2.2).

| Region       | What                                                                                                   | Source                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Back         | The lesson's clay back disc, 56 pt on phones and 74.7 pt on tablets                                    | `MathHud`; `PHONE_BACK`, `TABLET_BACK`, `mathLayout.ts:67-68` |
| Beads        | One bead per bed (6). `MathHud` with `peek`: no stardust pill and no streak                            | `MathHud.tsx:367-368`, `:402`, `:410`                         |
| HUD test IDs | A new `GAME_HUD = { idPrefix: 'game', popMs: 250, popScale: 1.25 }` beside `MATH_HUD`                  | `mobile/src/screens/math/hudWorld.ts:13-17`                   |
| Emma         | App's `EmmaStage` at `layout.emma`, with a `gamePose` like `peekPose`                                  | `EmmaStage.tsx:143`; `App.tsx:810-836`                        |
| Ribbon       | `CaptionRibbon` walking each line by word ticks, in `layout.ribbon`                                    | `CaptionRibbon.tsx:121`                                       |
| Play area    | The bed, centred in `layout.problem`                                                                   | § 2.2                                                         |
| Targets      | Three `AnswerChip`s in `layout.chips`: 88 pt on phones (never below 72), 120 on tablets, 16-32 pt gaps | `AnswerChip.tsx:84`; `mathLayout.ts:60-65`                    |

**Emma's poses** (the existing set, `packages/core/src/character/emmaPose.ts:24-32`), as the lesson uses them (`Math.tsx:8-21`): `idle` at rest, `listening` while she asks, `celebration` on a right move, `puzzled-tilt` on a wrong one, `attentive-pointing` with the guided answer, and `cheering` on the closer (asset `mobile/src/assets/registry.ts:13`).

**Sounds:** the lesson's effects at the lesson's volumes (`createMathSfx`, `Math.tsx:236-243`): sparkle 0.55 and plink 0.3 on a right move (`:1271-1272`), poof 0.45 on a wrong one (`:1194`). No chime: in a lesson the chime marks a streak, and a game has none.

**Lines:** one manifest line player, `createManifestLinePlayer('game', …)` (`mobile/src/audio/manifestLines.ts:38`), over the `guide.game.*` rows of `GUIDANCE_LINES` (§ 3). It never rejects; without a clip it walks the caption at 165 wpm and still calls `onPlay` (`manifestLines.ts:6-14`, `:52-63`). The chip gate therefore always opens.

**A separate screen, not a Math mode:** `mobile/src/screens/game/GameScreen.tsx` (the frame) and `mobile/src/screens/game/FlowerBed.tsx` (game A). Math holds session planning, scoring and the result handed to App. A game must reach none of it, and a separate screen makes "writes nothing" true by construction.

### 1.5 Rules every round keeps

Each rule is one of Dave's § 3 guard rails, made concrete.

| Rule                            | What the screen does                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Writes nothing**              | No call to `saveProgress` (`packages/core/src/progress/storage.ts:521`), the session-history store (`SESSION_HISTORY_KEY`, `packages/core/src/sessionEnd/sessionHistory.ts:35`), stardust, the streak, the pace guard, Leitner (`packages/core/src/progress/leitner.ts`) or cloud sync. Zero key-value writes and zero network calls during a round (AC N5). |
| **Leitner**                     | v1 reads no Leitner state. A later game may read due facts to show them more often (Dave § 3: "read-only at most"); this one does not.                                                                                                                                                                                                                       |
| **Content**                     | Only from steps that are current or mastered for the playing learner (§ 2.1).                                                                                                                                                                                                                                                                                |
| **The answer is the move**      | The chip she taps sends its buds into the empty slots and the bed blooms. No quiz sits between levels.                                                                                                                                                                                                                                                       |
| **No timer**                    | Nothing counts down, floats away or runs out. A bed waits as long as she likes.                                                                                                                                                                                                                                                                              |
| **No fail state**               | A wrong tap changes nothing in the bed. Never a red X and never a sound of failure (§ 2.6).                                                                                                                                                                                                                                                                  |
| **Fixed round, clear end**      | Six beds (inside #623's 4-6 band and Dave's 6-10 moves). After the last one: the closer, then the Map.                                                                                                                                                                                                                                                       |
| **No auto-next**                | No "again?" button, no next round, no score. Playing again means tapping the door again, by her own choice. No line invites another round (AC C5).                                                                                                                                                                                                           |
| **Emma never suggests a game**  | The Hub, Map and Session End lines are unchanged. No line outside `guide.game.*` is added (AC C4).                                                                                                                                                                                                                                                           |
| **Per learner, no comparisons** | Progress is read with `loadProgress()` (`storage.ts:44`) through whatever store is installed. With learner profiles that is the playing learner's (`activateLearner` installs `learnerScopedStore`; PR #622, `learners.ts:324`, `keys.ts:53`). Nothing is kept per learner because nothing is written. No score, no name, nothing about another learner.     |
| **Little decoration**           | No idle animation on the screen. Every motion answers a tap or a line.                                                                                                                                                                                                                                                                                       |

### 1.6 Back, background, rotation, the return rule

- **Back** (the HUD disc, or Android's back button as on the Map, `MapScreen.tsx:101-108`): the Map at once, silent, mid-line or mid-move. The line in flight is cancelled (`cancelActive()`), and nothing is written.
- **Background:** the line parks and resumes on the voice channel, as everywhere. While the app is hidden (`useIsAppHidden`, `mobile/src/lifecycle/appVisibility.ts:79`), an advance that falls due waits for its return, as Math's does (`Math.tsx:43-44`). The round waits.
- **Rotation:** the screen lays out again from the new viewport. The round keeps its state: which bed, how many slots are full, the wrong count, the line in flight. A hop or slide in flight jumps to its end state, so nothing flies to an old position.
- **The return rule** (`learner-profiles.md` § 2.2, `PICKER_AFTER_HIDDEN_MS`) does not fire on `game`, just as it never interrupts Math, Word Song or a peek. Back on the Map, the rule applies as usual from the next return.

---

## 2. Game A: Fill the flower bed

### 2.1 Content and the round

- **Source:** the bonds to ten that adding to ten already teaches: a given part of 1-9 and a missing part of 1-9 that always make ten (`MISSING_NUMBER_RANGES['add-to-10']`, `packages/core/src/wire/missingNumbers.ts:35-45`). That gives 9 bonds.
- **Current and mastered only:** the game opens at adding to ten (§ 1.1) and plays nothing from a later step. When adding to twenty is current, the same bonds to ten still play. Dave's double ten-frame for teens needs its own lines and is not part of this build.
- **The lesson's three are always in:** 7 + 3, 6 + 4 and 8 + 2 are adding to ten's canon missing numbers (P4, P6 and P8: `packages/core/src/progress/canonMathFacts.generated.ts:17-26`, texts in `public/canon/math/level-1/add-to-10.json`). Every round contains them, so the game echoes what she meets in lessons.
- **`flowerBedRound(rng)`:** the three canon givens plus 3 of {1, 2, 3, 4, 5, 9}, chosen with `rng`, then shuffled with `rng`. It returns 6 beds `{ given, missing }`, with `missing = 10 − given` and no given twice. App passes `Math.random`; tests pass a seeded generator. It reads no Leitner state.

### 2.2 The bed (the ten-frame's grid, planted in soil)

The bed is brown soil in a wooden rim, with a planting hole at every slot of the lesson's ten-frame. Its geometry is `TenFrameCell`'s (`mobile/src/screens/math/glyphs.tsx:183-215`), the scaffold the lesson flashes for 6-10 (`ScaffoldFlash.tsx:132`): the same slot centres, fill order and sizes, and the lesson's own flowers. _(Amended 2026-10-20 from a white frame with pink rings: Thomas's "Soil beds" pick, with Dave's D6-D8 folded in. The change is look-only.)_

- **Frame:** viewBox 130 × 60; a rounded rect at (1.5, 1.5), 127 × 57, radius **8**, filled with soil `#7d4a26`, with a 3-unit rim in wood `#c98a55`. Radius 8 (was 16) gives a planter's corners, not the trays' round pill (D7 b).
- **Furrow:** one line between the two rows, from (8, 30) to (122, 30), 2 units wide, round caps, `#3d2112`. There is no vertical split: the rows are the fives, as in the lesson's `TenFrameCell`, which has no divider (D6).
- **Slots:** centres at `FRAME_COLUMNS` × `FRAME_ROWS`, 17/41/65/89/113 × 18/42, top row first (`glyphs.tsx:180-181`, `:191`), on a strict straight grid, never scattered (D6). Share both constants rather than copying them (PR #635 moved them to `mobile/src/screens/math/tenFrame.ts`).
- **A planting hole** at every slot: a disc of radius 7 units (the old ring's radius) filled `#3d2112`, with a 1.5-unit lip in `#a86c3c` (the old ring's stroke width). It is drawn flat, with no gradient and no shadow.
- **An empty slot:** the hole alone.
- **A full slot:** the hole with `FlowerGlyph` (`glyphs.tsx:29`) at 20 units on top, centred: the flower planted in it. The petals reach past the hole, and the hole shows between them.
- **A bud:** `BudGlyph` (`glyphs.tsx:63`) at 20 units, the lesson's unopened flower. It hops into a hole (§ 2.4), and the hole stays under it as it blooms.
- **Fill order:** the given part fills slots 0 to g − 1 and the empty holes are g to 9, as the lesson's ten-frame fills: top row first, left to right.
- **Size:** `bedW = min(problem.width − 32, 560, problem.height × 130 / 60)`, `bedH = bedW × 60 / 130`, centred in `layout.problem`. One unit is `bedW / 130` pt.
- **A tap on a hole** is a tap on the bed: it repeats the ask (§ 2.4, N10). Holes are never planted one by one, because tapping three holes is counting by ones, which the whole-bond chip replaces (D3, D8).
- **The door's picture is no longer this component** (§ 1.2): it is the clay piece `ui-flower-bed`. `FlowerBed` draws only the play screen's bed.

**Colours.** Every colour is already in the app. Contrast is the WCAG ratio, computed from the hex values on 2026-10-20.

| Part            | Colour                                                                                                       | Where it already is                                                                                           | Contrast                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Soil            | `#7d4a26`                                                                                                    | the wood clay's ledge (Home, `mapChrome.tsx:65`; the map button, `MapButton.tsx:27`)                          | 6.8:1 on the screen's cream `#FFF5F0` (`colors.myCream`) |
| Rim             | `#c98a55`                                                                                                    | the wood face of Home and the map button (`mapChrome.tsx:203-205`, `MapButton.tsx:24-25`)                     | 2.5:1 on the soil                                        |
| Hole and furrow | `#3d2112`                                                                                                    | the darkest brown in the app, the outer stop of the trays' hole gradient (`HubFlowerTray.tsx:237`), here flat | 2.0:1 on the soil                                        |
| Hole lip        | `#a86c3c`                                                                                                    | the wood face's dark stop (`mapChrome.tsx:205`)                                                               | 3.4:1 on the hole                                        |
| Flower          | petals `#FFC0CB` (`colors.myPink`), outline `#F48FB1` (`colors.myRose`), centre `#FFD966` (`colors.sparkle`) | `FlowerGlyph`                                                                                                 | 4.7:1, 3.3:1 and 5.3:1 on the soil                       |
| Bud             | petals `#FFFFFF`                                                                                             | `BudGlyph`                                                                                                    | 7.3:1 on the soil                                        |

Every flower and bud part clears 3:1 on the soil, the WCAG bar for graphics. The hole is a dark well: 2.0:1 on its own and 3.4:1 at its lip. No red anywhere.

**Why it does not read as the Hub's flower tray.** The tray's flowers mean progress, one per good day. A tray-look bed filling in a game that counts toward nothing would suggest she is earning flowers, and games must not become the easy route to flowers (`design/research/engagement-and-mini-games-2026-10-19.md:152`). Two trays already are brown clay with soil holes: the Hub card's (`HubFlowerTray.tsx:1-6`, face `:39-44`, holes `:234-238`) and the seed tray under the Map's current stop, on the same screen as the door (`BudTray`, `mapFx.tsx:264-298`). So the bed shares the app's browns with them, but none of their art (D7):

|            | The trays (progress)                                                       | The bed (a game)                                                                                    |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Drawing    | Clay: a gradient face and a ledge shadow                                   | Flat, like the lesson's ten-frame: no gradient, no shadow                                           |
| Shape      | A rounded pill with one row of holes, one per good day                     | A rectangular planter, radius 8 units, two rows of five on a straight grid, one furrow              |
| Ground     | Light-brown clay (`linear-gradient(#c58a55, #a86c3c)`) with gradient wells | Dark soil `#7d4a26` in a wooden rim, with flat holes and a lip                                      |
| Flowers    | Clay buds (`ui-bud-open`, `ui-bud-closed`); a moon and a "z" while asleep  | The lesson's flat `FlowerGlyph` and `BudGlyph`, the counters of the counting row and missing number |
| Where      | The Hub card and the Map's current stop                                    | Only the game screen; the Map shows the fixed clay piece                                            |
| What stays | Kept across days                                                           | Cleared every bed (§ 2.4's slide); nothing reaches the Hub (N5)                                     |

**Sizes at the floors** (hand-computed from `mathLayout.ts:203-472`; the tablets with the insets `map-native.md` § 1 uses):

| Device (insets)      | `problem` rect           | Bed (W × H)   | 1 unit | Flower | Slot pitch | Chips                 |
| -------------------- | ------------------------ | ------------- | ------ | ------ | ---------- | --------------------- |
| 375 × 667            | (16, 259) 343 × 272      | 311 × 143.5   | 2.39   | 47.8   | 57.4       | 88 at y 547, gap 32   |
| 667 × 375            | (160, 146.4) 491 × 132.1 | 286.2 × 132.1 | 2.20   | 44.0   | 52.8       | 72 at y 290.8, gap 32 |
| 820 × 1180 (t24 b20) | (16, 442.8) 788 × 565.2  | 560 × 258.5   | 4.31   | 86.2   | 103.4      | 120 at y 1008, gap 32 |
| 1180 × 820 (b20)     | (245.2, 231) 918.8 × 417 | 560 × 258.5   | 4.31   | 86.2   | 103.4      | 120 at y 648, gap 32  |

Every chip stays at or above the 72 pt phone floor (`greet-math-native.md` § 4). The bed is not a target except for the repeat tap (§ 2.4), and it is far bigger than 44 pt.

**The soil amendment changes no size**, so all four forms fit as before. A hole is 14 units across: 33.5 pt at 375 × 667, 30.8 pt at 667 × 375 and 60.3 pt on both tablets. The furrow is 2 units (4.4-8.6 pt). The door keeps its rect (§ 1.2), and its clay piece sits inside the disc at Home's house size.

### 2.3 Chips

- **Three chips:** the missing part and its two off-by-one neighbours, from `buildChipOrder` (`mobile/src/screens/math/chipOrder.ts:37`). It is called on the bond `{ index: 3 + k, addendA: g, addendB: 10 − g, correct: 10 − g, op: '+', utterances }` for bed k = 1…6, with `maxAnswer` 10 (`ANSWER_RANGE_MAX`, `packages/core/src/math/distractors.ts:71`) and focus `'add-to-10'`. This is the lesson's missing-number path (`problemChips.ts:80-98`).
- **Why `index: 3 + k`:** indices 4-9 put every bed on the off-by-one tier (`pickTier`, `distractors.ts:152-154`), the lesson's P4-P8 class, which catches the count-on slip. The order is `buildChipOrder`'s deterministic shuffle.
- **Range:** `pickDistractors` keeps the chips in 1-10 (`distractors.ts:70-71`, `:806-817`). For "One and what make ten?" the chips are 8, 9 and 10.
- **States:** `AnswerChip` as in a lesson (`AnswerChip.tsx:65-82`): `gateOpen` from the ask line's `onPlay`, `shaking` on a wrong tap, `glow` and `dimForGuided` for the guided answer, `bursting` on the right tap, and `resolved` after it. Number Garden's caramel clay (`AnswerChip.tsx:25`).

### 2.4 A round, beat by beat

`g` is the bed's given part, `m = 10 − g` the missing part. Times are from the start of each step.

**Start**

| t (ms)         | What happens                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0              | Route `game`. The screen fades in (200 ms) over the Map's fade-out. Bed 1 shows its `g` flowers, its `m` empty holes and three closed chips. 6 empty beads. Emma `idle`. |
| 200            | `guide.game.bed.open`, "Ten flowers in every bed!". The ribbon walks it.                                                                                                 |
| line end + 400 | Bed 1's ask (the session guide's 400 ms gap, `SESSION_GUIDE_GAP_MS`, `mobile/src/audio/sessionGuide.ts:55`).                                                             |

**Each bed k**

| t (ms)                                  | What happens                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                                       | `guide.game.bed.ask.<g>`, "Seven and what make ten?". Emma `listening`. At the line's `onPlay` the chips open (`gateOpen`).                                                                                                                                                                                                        |
| line end                                | Emma `idle`. The bed waits, with no timer.                                                                                                                                                                                                                                                                                         |
| any time                                | **A tap on the bed** while it waits says `bed.ask.<g>` again (as Word Song's picture does, `word-song-native.md` § 4). It is ignored while a line plays and after the right tap. No speaker icon.                                                                                                                                  |
| T = right tap                           | Sparkle and plink. The chip bursts; all chips resolve and stop answering. Emma `celebration`. Bead k fills (the HUD's pop). `guide.game.bed.yes.<g>`, "Yes! Seven and three make ten!", starts.                                                                                                                                    |
| T + 80 × j                              | Bud j (j = 0 … m − 1) leaves the chip's centre for the hole in slot g + j: 360 ms, x linear, y along an arc 32 pt above the straight line at its middle (180 ms up with ease-out, 180 ms down with ease-in), scale 0.5 → 1. The hop layer sits above the bed and the chips, with `pointerEvents="none"`.                           |
| T + 360 + 80 × j                        | Bud j lands in its hole and blooms at once with the lesson's bloom: a 150 ms crossfade to `FlowerGlyph` while scaling 1 → 1.15 → 1 (spring 300 / 14) (`MissingNumber.tsx:13-16`; `BLOOM_FADE_MS`, `BLOOM_SPRING`, `:49-52`). The hole stays under the flower (§ 2.2). Landing 80 ms apart gives the lesson's 80 × k bloom stagger. |
| max(yes line end, last bloom end) + 400 | Beds 1-5: the full bed slides out to the left while bed k + 1 slides in from the right, both by the safe width, 300 ms, `EASE_OUT` (`mobile/src/screens/math/extendedMotion.ts:30`). The old chips fade out over the first 150 ms. Emma `idle`.                                                                                    |
| + 300                                   | Bed k + 1's chips mount with `AnswerChip`'s own entrance, and its ask starts.                                                                                                                                                                                                                                                      |

**A chip tap during a line** is accepted. It cuts the line in flight (`cancelActive()`) and plays its own response. She never has to wait for Emma to finish.

**End**

| t (ms)                                         | What happens                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| bed 6: max(yes line end, last bloom end) + 400 | Emma `cheering`. `guide.game.bed.close`, "Ten every time! What a garden!". The full bed stays. |
| line end + 400                                 | The screen fades out (200 ms) and the Map returns quietly (§ 1.3).                             |

**Length:** about a minute for six beds (open 2 s; per bed about 2 s of question, a few seconds of thinking, 2 s of yes and 0.7 s of slide; close 2.5 s).

### 2.5 Wireframes (bed 1, g = 7, while Emma asks)

```
PHONE PORTRAIT  375×667                     PHONE LANDSCAPE  667×375
+-------------------------------------+     +-------------------------------------------------------------+
| (<)                                 |     | (<)      | ●  ◉  ○  ○  ○  ○                                 |
| ◉  ○  ○  ○  ○  ○                    |     |  .----.  | +----------------------------------------------+ |
|  .-----.  +-----------------------+ |     | ( Emma ) | | Seven and what make ten?                     | |
| ( Emma  ) | Seven and what make   | |     | ( col  ) | +----------------------------------------------+ |
| (  147  ) | ten?                  | |     | ( 160  ) |         +----------------------------+           |
|  '-----'  +-----------------------+ |     |  '----'  |         | ✿    ✿    ✿    ✿    ✿      |           |
|                                     |     |          |         | ✿    ✿    ○    ○    ○      |           |
|  +-------------------------------+  |     |          |         +----------------------------+           |
|  |  ✿     ✿     ✿     ✿     ✿    |  |     |          |       [ 2 ]       [ 3 ]       [ 4 ]              |
|  |  ✿     ✿     ○     ○     ○    |  |     +-------------------------------------------------------------+
|  +-------------------------------+  |       Back (16, 8); HUD row x 160-651, y 6, h 44; ribbon y 56,
|                                     |       2-line slot 81; bed 286 × 132 centred in (160, 146) 491 × 132;
|    [ 2 ]       [ 3 ]       [ 4 ]    |       chips 72 at y 291
+-------------------------------------+
  Back (16, 8); beads y 68; Emma 147 at y 104; ribbon x 98, y 112, w 261;
  bed 311 × 144 centred in (16, 259) 343 × 272; chips 88 at y 547, 32 above the safe bottom

TABLET PORTRAIT  820×1180                         TABLET LANDSCAPE  1180×820
+------------------------------------------+      +-------------------------------------------------------+
| (<)          ◉  ○  ○  ○  ○  ○            |      | (<)                ◉  ○  ○  ○  ○  ○                   |
|  .-------.  +--------------------------+ |      |  .------.    +----------------------------------+     |
| (  Emma   ) | Seven and what make ten? | |      | (  Emma  )   | Seven and what make ten?         |     |
| (  307 pt ) +--------------------------+ |      | ( 213 pt )   +----------------------------------+     |
|  '-------'                               |      |  '------'      +--------------------------+           |
|      +----------------------------+      |      |                | ✿    ✿    ✿    ✿    ✿    |           |
|      | ✿    ✿    ✿    ✿    ✿      |      |      |                | ✿    ✿    ○    ○    ○    |           |
|      | ✿    ✿    ○    ○    ○      |      |      |                +--------------------------+           |
|      +----------------------------+      |      |              [  2  ]     [  3  ]     [  4  ]          |
|                                          |      +-------------------------------------------------------+
|     [  2  ]      [  3  ]      [  4  ]    |        HUD row 96; Emma 213 at (16, 96); ribbon x 245, y 112;
+------------------------------------------+        bed 560 × 259 at x 425-985, y 310-569; chips 120 at y 648
  HUD row 96 (from t 24); Emma 307 at (16, 120); ribbon x 339, y 136;
  bed 560 × 259 at x 130-690, y 596-855; chips 120 at y 1008

  ✿ flower (FlowerGlyph) planted in its hole   ○ empty planting hole (dark, in brown soil)
  ◉ this bed's bead   no stardust pill, no streak   (the furrow between the rows is not drawn here)
```

### 2.6 A wrong tap (no fail state)

| Tap           | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1st wrong** | Poof. The tapped chip shakes (`shaking`, `WRONG_SHAKE_MS` 400, `packages/core/src/shared/gameplayConstants.ts:53`). Emma `puzzled-tilt`. `guide.game.again`, "Hmm... try again?" (the lesson's own text). **Nothing moves in the bed:** no bud leaves, so it never part-fills or overfills. **Hint:** at the line's `onPlay` the empty holes (each with its lip) pulse once in fill order, each 1 → 1.1 → 1 over 300 ms, 150 ms apart: the counting row's ripple (`usePulse`, `extendedMotion.ts:49-65`; `HINT_FLOWER_PULSE_MS`, `CountingRow.tsx:29`). It invites her to see how many holes are empty. Every chip still answers. |
| **2nd wrong** | The same poof, shake and line. When "Hmm... try again?" ends, the guided answer follows, as the lesson's 3rd wrong does (`Math.tsx:1236-1256`): the right chip glows, the other two dim and stop answering (`glow`, `dimForGuided`), Emma `attentive-pointing`, and `guide.game.this-is.<m>`, "This one is three.". **Her tap on the glowing chip plays the full right move** of § 2.4, buds and all, so the move stays hers. There is no third tier.                                                                                                                                                                             |

Never a red X, no red colour, no buzzer and no shake of the bed. The wrong count resets on every bed. Nothing is counted toward anything: the game keeps no score and no first-tap record.

### 2.7 Reduce Motion

The lines and sounds stay the same. The motion changes:

- **Start and end:** 200 ms fades, as everywhere.
- **Right move:** no hop and no scale. Bud j fades in over its hole (200 ms) at T + 80 × j, then crossfades to its flower (200 ms), the lesson's Reduce Motion bloom (`MissingNumber.tsx:15-16`). The hole stays.
- **Bed change:** a 200 ms crossfade, with no slide.
- **Hint:** each empty hole (with its lip) dips in opacity, 1 → 0.4 → 1 over 300 ms, 150 ms apart, with no scale. On soil the dip is quieter than the pink ring's was: at 0.4 the hole is about 1.3:1 against the soil. It is unchanged here, and V4 and V7 check that it is still seen (D8).
- **Chips:** as in a lesson (`ClayChip`'s own Reduce Motion handling; `AnswerChip.tsx:111` skips the sparkle burst).
- **The door:** Home's press, unchanged. The clay piece is a still picture.

### 2.8 Reused vs new

| Reused (file)                                                                        | New                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Ten-frame geometry: slot centres, fill order (`glyphs.tsx:180-215`)                  | `FlowerBed`: a soil bed on the ten-frame's grid, with holes, flowers and buds  |
| `FlowerGlyph`, `BudGlyph` (`glyphs.tsx:29`, `:63`)                                   | The bud hop, chip → slot                                                       |
| Bloom choreography (`MissingNumber.tsx:13-16`, `:49-52`)                             | The bed slide between beds                                                     |
| Missing-number chips (`chipOrder.ts:37`, `problemChips.ts:80-98`)                    | `GameScreen` (the frame), `GAME_HUD`, the `game` route, the Map door           |
| Bonds to ten (`missingNumbers.ts:35-45`)                                             | `miniGames.ts` (`openGames`, `flowerBedRound`)                                 |
| `mathLayout`, `MathHud` peek, `EmmaStage`, `CaptionRibbon`, `AnswerChip`, Math's sfx | 30 `guide.game.*` lines (§ 3), 14 of them new renders                          |
| Home's clay disc and its house size (`mapChrome.tsx:29-73`)                          | The planting hole, the furrow and the wood rim (drawn, existing browns, § 2.2) |
| The clay pipeline (`generatePackPictures.ts`, `build-path-art.ts`)                   | The door's clay piece, `ui-flower-bed` (1 picture, § 1.2.1)                    |

---

## 3. Copy / TTS script

### 3.1 Every line the game speaks

All lines are Lily, as `GUIDANCE_LINES` rows (`packages/core/src/emmasPath/guidanceLines.ts:323`) with a new kind `'game'` in `GuidanceLineKind` (`:38-64`). `src` comes from `pathLineSrc(id)` (`pathLines.ts:86-88`), so the files are `/assets/audio/path/guide-game-*.mp3`. The shared lines have `world: null`; the bed lines have `world: 'math'`. `<N>` is a capitalised number word and `<n>` a lower-case one.

| Id                              | Caption text (= Lily input)       | When                        | Lines  | Chars   |
| ------------------------------- | --------------------------------- | --------------------------- | ------ | ------- |
| `guide.game.again`              | "Hmm... try again?"               | Any game, a wrong tap       | 1      | 17      |
| `guide.game.this-is.<n>`, n 1-9 | "This one is <n>."                | Any game, the guided answer | 9      | 153     |
| `guide.game.bed.open`           | "Ten flowers in every bed!"       | Round start                 | 1      | 25      |
| `guide.game.bed.ask.<g>`, g 1-9 | "<N> and what make ten?"          | Each bed                    | 9      | 207     |
| `guide.game.bed.yes.<g>`, g 1-9 | "Yes! <N> and <10 − g> make ten!" | A right move                | 9      | 252     |
| `guide.game.bed.close`          | "Ten every time! What a garden!"  | Round end                   | 1      | 30      |
| **Total**                       |                                   |                             | **30** | **684** |

The shortest line is "This one is one." (16) and the longest "Yes! Three and seven make ten!" and "Ten every time! What a garden!" (30 each). B and C will reuse `guide.game.again` and the `guide.game.this-is` lines they need.

**Already spoken in the app (16 of the 30, exact text):** "Hmm... try again?"; all nine "This one is <n>."; "Six/Seven/Eight and what make ten?"; and "Yes! Six and four / Seven and three / Eight and two make ten!". Every one of them is a math canon line.

**New renders: 14 lines, 359 characters.** These are "Ten flowers in every bed!", "Ten every time! What a garden!", the asks for 1, 2, 3, 4, 5 and 9, and the yeses for 1, 2, 3, 4, 5 and 9.

**How it was counted:** a scratch script (2026-10-19, not committed) generated the 30 texts from this table and compared each one, as an exact string, with every `text` in `public/canon/**/*.json`, every `GUIDANCE_LINES` text and input, and every `PATH_LINES` text. It ran on `main` at `b98e2fbc` (1,182 canon texts, 258 guidance lines, 646 path lines).

**What the bill depends on:**

- The 16 reused texts cost nothing **only if the shared render cache holds them.** Guidance lines and math canon share one cache key, `lily|eleven_v4|<input>` (`scripts/renderGuidanceLinesLily.ts:53-57`; `scripts/lilyCanonLib.ts:17-20`; math canon has no tier, `lilyCanonLib.ts:35-36`).
- `renderGuidanceLinesLily.ts --dry-run` prints the real number before any spend.
- **The ceiling is 684 characters** if none of the 16 is cached.

### 3.2 Labels nobody speaks (VoiceOver only)

| Element                         | Label                 |
| ------------------------------- | --------------------- |
| `map-game-door` (Number Garden) | "Fill the flower bed" |
| `game-back`                     | "Back"                |

### 3.3 Render inputs: "Word," and "; then this!"

| Rule (source)                                                                                                                                                   | Applies to              | Lines here                     | Result           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------ | ---------------- |
| A one-word clip goes to Lily as "Word," and the caption keeps "Word." ("Sat." came back as "Saturday"; `.claude/docs/audio-system.md:65`, content wave 4 § 8.1) | Lines of one word       | 0: the shortest has four words | No `input` field |
| A "<Name>! First, <previous>. Then this!" line goes as "…; then this!" (wave 3 take 4 and wave 4 take 3, `team/DECISIONS.md:76`, `:87`; content wave 5 § 9.1)   | Lines with "Then this!" | 0                              | No `input` field |

**No game line carries an `input`.** If the ear test finds a scratchy take, the fix is the one the waves used: a `--retake "<text>"` (`renderGuidanceLinesLily.ts:19`), and if that is not enough, an `input` on that row only (`GuidanceLine.input`, `guidanceLines.ts:73-79`), chosen by ear.

### 3.4 Words and framing

- **New spoken word:** _every_, only that one (the same scratch script checked every word against the shipped texts). It is a common core word and stays inside the ~200-word cap.
- **No line** mentions fingers, speed, counting, "fast" or "not yet". The yes lines say the bond whole, and the closer names the trick that every bed makes ten (Dave § 1: praise the noticing, name the trick).
- **No line invites a round.** The only "again" is the move retry, "Hmm... try again?" (AC C5).
- **Danish version:** each row is one language row. The number words are the only content, the art holds no text, and the bonds are language-free.

### 3.5 Prediction for the ear test (Predict-Before-Soak)

- The 16 reused lines come from the shipped takes, so they sound exactly like the lesson.
- "Ten every time! What a garden!": _garden_ is British and non-rhotic (/ˈɡɑːdən/, no /r/), and the line falls on _garden_.
- "Ten flowers in every bed!": _flowers_ has two syllables (/ˈflaʊəz/), and _every_ has two (/ˈevri/), not three.
- In "Yes! Five and five make ten!" the second _five_ is not dropped or run into the first. _And_ is reduced (/ən/) in every yes line.
- The asks rise on _ten?_, as "Seven and what make ten?" does in the lesson.
- Every new clip is under the 3.5 s flag (`LONG_SECONDS`, `renderGuidanceLinesLily.ts:39`).

**Bounded convergence:** I rendered and ear-tested nothing. The counts come from the scratch script and the sizes from hand calculations against `mathLayout.ts` and `mapScreenLayout.ts`. **Not predicted:** whether Lily stresses _what_ or _ten_ in the new asks, and whether "One and what make ten?" starts with a glottal stop.

---

## 4. Acceptance criteria

### 4.1 Core (vitest, `packages/core`)

1. **C1.** `openGames(p, 'math')` returns `['flower-bed']` for the default profile (adding to ten current, `packages/core/src/progress/defaults.ts`), for adding to ten mastered with adding to twenty current, and for a complete Number Garden. It returns `[]` when numbers (`number-recog`) is not mastered, and for `null`.
2. **C2.** `openGames(p, 'word-song')` returns `[]` for every progress in C1.
3. **C3.** `flowerBedRound(rng)` returns 6 beds with distinct givens in 1-9 and `missing = 10 − given`, and always contains givens 6, 7 and 8. The same seeded `rng` gives the same round. Over 1,000 seeds, every given 1-9 appears, and bed 1's given takes at least 6 different values.
4. **C4.** `GUIDANCE_LINES` has 288 lines (258 today, `guidanceLines.test.ts:56`). The 258 shipped lines are unchanged in id, kind, text and src. The 30 `guide.game.*` lines have kind `'game'`, the exact texts of § 3.1, `src = pathLineSrc(id)` and no `input`; their texts total 684 characters. `public/voice-qa.html`'s `GUIDANCE_FILES` mirrors them (the existing drift guard, `guidanceLines.test.ts:393`). After the render commit, `GUIDANCE_LINES_AWAITING_RENDER` is `[]` (`guidanceLines.ts:334`).
5. **C5.** No game line contains "play", "next" or "round". The only one containing "again" is `guide.game.again`.

### 4.2 Native (jest, `mobile`)

6. **N1.** `mapScreenLayout(v).door` equals § 1.2's rect on 375×667, 667×375, 820×1180 (t24 b20) and 1180×820 (b20). On each, it intersects neither Home, the title nor the pane.
7. **N2.** The Number Garden Map renders `map-game-door` exactly when `openGames(progress, 'math')` is non-empty. The Word Song Map and the Hub never render it. The door holds the `ui-flower-bed` clay piece at `Math.round(68 × k)` pt and no `FlowerBed`.
8. **N3.** A door tap is ignored within `MAP_TAP_ARM_MS` of mount, before an unlock beat's cheer and while the launch lock holds. An armed tap cuts the Map line in flight and changes the route to `game` exactly once, `LAUNCH_DELAY_MS` after release.
9. **N4.** `ROUTE_EXITS.map` includes `'game'`, `ROUTE_EXITS.game` is `['map']`, and no other route lists `'game'`. Back from a game onto a Map entered after Session End's handover keeps that Map's Home target (`learner-profiles.md` § 2.4).
10. **N5.** On an in-memory store (the `App.peek.test.tsx` pattern, its AC 18), a full round makes zero key-value writes. The progress JSON (`STORAGE_KEY`) and the session history (`SESSION_HISTORY_KEY`) are byte-identical, `loadStardust().total` is unchanged, `fetch` is never called, and the round ends on the Map with no open line. No Session End mounts.
11. **N6.** N5 also holds for Back at bed 3 during a line, Back during a hop, and a background and return mid-round.
12. **N7.** With fake audio, the beats run in § 2.4's order: open → 400 ms → ask; the chips are closed until the ask's `onPlay`. A right tap gives sparkle and plink, a bursting chip, `celebration`, the yes line, `m` buds and bead k filled; every slot then holds a hole with a flower on it; then the slide and the next ask. After bed 6: 400 ms → `cheering` and the closer → 400 ms → the Map.
13. **N8.** First wrong tap: poof, the chip shakes, `puzzled-tilt` and "Hmm... try again?". The bed's full-slot count is unchanged, no bud exists, and the empty holes pulse. Second wrong tap: after the again line, the right chip has `glow`, the others `dimForGuided` (a tap on them does nothing), Emma `attentive-pointing`, then `this-is.<m>`. A tap on the glowing chip runs N7's right move.
14. **N9.** Each bed's chips equal `buildChipOrder(bond, 10, 'add-to-10')` with `index: 3 + k`. Every set contains `m`, and all three values are in 1-10.
15. **N10.** A bed tap while the bed waits, on the soil or on a hole, replays `ask.<g>`. It does nothing during any line and after the right tap. No tap plants a hole.
16. **N11.** A chip tap during a line cuts it (`cancelActive`) and plays its own response.
17. **N12.** With Reduce Motion on (mocked), no hop, slide or hole scale starts; the buds, the bed change and the hint use § 2.7's fades.
18. **N13.** While `useIsAppHidden` is true, the advance after a yes line waits; it runs after the return.
19. **N14.** A viewport change mid-round keeps the bed index, full slots, wrong count and line, and re-lays out the bed and chips from the new `mathLayout`.
20. **N15** (runs once PR #622 is on `main`). With learner A on adding to ten and learner B on numbers, A's Number Garden Map shows the door and B's does not. A round as A writes no key of either learner.
21. **N16.** The HUD shows 6 beads under the `game` test-ID prefix, with no stardust pill and no streak.

### 4.3 Device (Jessica first; iPad portrait and landscape, phone portrait and landscape)

22. **V1.** The Number Garden Map shows the door: a wood clay disc holding the clay soil bed (the picked `ui-flower-bed`), at the top right (phone and iPad portrait), under Home (phone landscape) or beside Home (iPad landscape). Beside Home it reads as the same kind of button, and it does not look like the egg-tray stop or the seed tray under the current stop. Word Song's Map and the Hub show no door. Nothing announces it.
23. **V2.** A tap on the door: the Map fades, the bed screen fades in, Emma says "Ten flowers in every bed!", and there are 6 empty beads and no stardust pill.
24. **V3.** The bed is brown soil in a wooden rim, with dark holes in 2 rows of 5 and one furrow between the rows. A right chip: buds hop into the empty holes one after another and bloom there, planted in the soil, "Yes! Seven and three make ten!" plays, and the next bed slides in.
25. **V4.** A wrong chip: a shake and a poof, a puzzled Emma, "Hmm... try again?", the empty holes pulse and are plainly seen to move on the soil, and nothing fills. A second wrong chip: the right chip glows and Emma says "This one is three.". No red and no X anywhere.
26. **V5.** After bed 6: "Ten every time! What a garden!", then the Map with no line and every stop tappable. No "again" button appears.
27. **V6.** Back mid-round returns to the Map at once, silently. The Hub's stardust is the same as before the game.
28. **V7.** With Reduce Motion on: fades only, and the same lines. The hint's dip is visible on the dark holes (D8).
29. **V8.** Lock the device mid-line for 10 s: the line resumes and the round waits.
30. **V9.** Rotate the iPad mid-bed: everything lays out again, and the bed keeps its flowers.

**30 criteria:** 5 core, 16 native, 9 device.

---

## 5. Build split

**Devon builds the whole thing in one PR** (branch `devon/mini-game-flower-bed`). Kevin reviews it, per the routing rule (Kevin reviews Devon). **Kevin is not needed to build:** the core part is a `Route` member, a small pure module and 30 line rows. It adds no `Progress` field, no storage key, no migration and no server change.

**Order:**

1. **Core:**
   - `'game'` in `Route` (`route.ts`).
   - `packages/core/src/games/miniGames.ts` with its vitest (C1-C3).
   - The 30 `guide.game.*` rows and the `'game'` kind in `guidanceLines.ts`, listed in `GUIDANCE_LINES_AWAITING_RENDER` until the render commit.
   - The 30 entries in `public/voice-qa.html`'s `GUIDANCE_FILES`.
   - Tests C4 and C5.
2. **Mobile:**
   - `routes.ts`, and `layoutForRoute` → `mathLayout` for `game`.
   - `door` in `mapScreenLayout.ts`, `games` from `useMapVisit`, and a `GameDoor` in `mapChrome.tsx`.
   - `GameScreen.tsx`, `FlowerBed.tsx` and `GAME_HUD`.
   - The `game` manifest player.
   - App wiring: the route, `gamePose`, the quiet return and keeping the Map's origin.
   - Export `FRAME_COLUMNS` and `FRAME_ROWS` from `glyphs.tsx`.
   - Tests N1-N14 and N16.
3. **Render commit**, run in the tools worktree (`~/DEV/MarianLearning-tools`, which holds the keys and the cache):
   - `npx tsx scripts/renderGuidanceLinesLily.ts --dry-run`, which should show about 359 characters to bill and never more than 684.
   - The render itself, then `npm run export-audio` in `mobile/`.
   - `GUIDANCE_LINES_AWAITING_RENDER` set to `[]`, pushed to the same branch.
4. **T3 ear test:** the voice-QA page filtered to the new lines (`?filter=new`), with the count checked against the 30 rows. Then the device check, V1-V9.

**Soil amendment (2026-10-20), on top of PR #635's build.** It is look-only: no geometry, timing, line, route or rule changes.

1. **The clay piece first** (T6): generate the 2 variants (§ 1.2.1), Thomas picks one, then build it into `public/assets/path/` and add `'ui-flower-bed'` to `pathArt.ts`. The PR needs the files, or `pathArt.test.ts` fails.
2. **`FlowerBed.tsx`:**
   - The frame `Rect`: `rx` 8, fill `#7d4a26`, stroke `#c98a55` (width 3, unchanged).
   - The furrow line (§ 2.2).
   - The empty slot's `Circle`: fill `#3d2112`, stroke `#a86c3c`; radius 7 and stroke 1.5 unchanged.
   - A hole under every full slot, the given flowers included.
   - On landing the hole stays. Today the ring fades to 0 at the landing, and in Reduce Motion over the fade. The hint animates the hole as it animated the ring.
3. **`GameDoor`** (`mapChrome.tsx`): the `FlowerBed` child becomes `PathImage id="ui-flower-bed"` at `Math.round(68 * k)`, as Home's house.
4. **Tests:** N2, N7, N8, N10 and N12 as amended. Device check: V1, V3, V4 and V7 as amended.

**Against PR #622:** the two PRs are independent. Both add a `Route` member and edit `routes.ts`, so whichever merges second rebases; the merge is mechanical. N15 runs once both are on `main`. The game code is the same either way: `loadProgress()` reads the installed store.

**Size: M** (the frame is S-M, the game S).

**Out of scope:** concepts B and C, the multi-game shelf, any Leitner read, the double ten-frame for teens, and a Word Song door.

---

## 6. For Thomas (subjective calls only)

- **T3 (open). The 30 lines and their Lily budget** (§ 3.1): 14 new renders, about 359 characters, with a ceiling of 684 if none of the 16 reused texts is in the cache. **Recommendation:** approve the texts as written and judge them at the ear test, using a link filtered to the new lines.
- **T6 (amended 2026-10-20). The soil bed and the door's clay piece** (§ 1.2, § 1.2.1, § 2.2). Picked by popup: "Soil beds + clay button". **Open:** pick 1 of the 2 clay variants on the contact sheet (about $0.16), then judge the soil bed and the door at device check V1, V3 and V4. **Recommendation:** keep the wood disc under the clay piece (§ 1.2), and pick the variant that reads as a garden bed at 40 pt and looks least like the egg tray (`add-to-20`).
- **A watch signal (Dave, D7 e).** If a learner asks why her Hub flowers did not grow after a game, or plays "to get flowers", go back to the frame-pink look (this spec's § 2.2 before 2026-10-20). Games must not become the easy route to flowers (`engagement-and-mini-games-2026-10-19.md:152`).

## 7. For Dave (pedagogy checks, D-items)

- **D1. Bonds beyond the lesson's three.** The game plays 1 + 9, 2 + 8, 3 + 7, 4 + 6, 5 + 5 and 9 + 1 as soon as adding to ten is current, though the canon asks only 7 + 3, 6 + 4 and 8 + 2 as missing numbers. They are inside the step's own range (`missingNumbers.ts:35-45`), and the bed shows the empty slots as the scaffold, so this is in-step content, not untaught content. **Recommendation:** keep.
- **D2. Two wrong-tap tiers, not the lesson's three.** The lesson hints at 2 wrongs and gives the answer at 3. The game pulses the empty slots at the 1st wrong and guides at the 2nd, because the bed already shows how many are missing. **Recommendation:** two tiers.
- **D3. Off-by-one chips on every bed** (the lesson's P4-P8 class for missing numbers, not P1-P3's gentle spread). **Recommendation:** yes, because the neighbours catch the count-on slip that the ten-frame is there to replace.
- **D4. Six beds per round**, inside #623's 4-6 band and Dave's 6-10 moves. **Recommendation:** six.
- **D5. The closer, "Ten every time! What a garden!"** It names the trick (every bed makes ten) and then praises the garden. **Recommendation:** keep. Change it only if Dave reads "What a garden!" as praising the result over the noticing.

**The soil amendment (Dave, 2026-10-20, relayed by the coordinator; Dave wrote no file):**

- **D6. Does soil with holes still read as a ten-frame? Dave: CHANGE (small), folded in.** Keep the 2 × 5 holes at the lesson's slot positions and fill order on a strict straight grid, make the empty holes clearly darker than the soil, and draw one furrow between the two rows (y 30) with no vertical split. In a ten-frame the rows are the fives (7 = a full row + 2; Van de Walle, which Dave read only through a secondary source), and the lesson's `TenFrameCell` has no divider. Dave also reads a hole as saying "missing part" more concretely than the pink ring did (his reasoning, not a source). **In § 2.2:** the grid and fill order unchanged, `#3d2112` holes on `#7d4a26` soil, and the furrow at y 30.
- **D7. Could the bed read as the progress trays? Dave: CHANGE, folded in.** The risk is real, because two trays already are brown clay with soil holes: the Hub card's and the seed tray under the Map's current stop. (a) The bed reuses none of the trays' art, and its flowers stay the lesson's glyphs. (b) It is a rectangular planter with a rim, not a pill. (c) The door's picture is fixed and full and never reflects play. (d) Each bed clears and nothing reaches the Hub: already the spec (§ 2.4, N5). (e) A watch signal for Thomas (§ 6). **In § 1.2 and § 2.2.**
- **D8. Do holes change how the bed is played? Dave: CONFIRM, with two device-check notes.** Holes invite tapping to plant, so a bed tap stays "repeat the ask" (N10) and holes are never plantable one by one: tapping three holes is counting by ones (D3). The 1st-wrong hint must stay visible on dark holes, the Reduce Motion dip most of all: V4 and V7 check it. Dave adds that soil makes the spoken word _bed_ picturable for a learner new to English, and no line needs to change (none says _your_, _grow_ or _keep_).

## 8. Child-safety and dark-pattern check

| Risk (Dave § 2)           | Here                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected prizes, currency | None: no stardust, no streak, no unlock, no score                                                                                              |
| Looks like earned flowers | The bed shares no art with the progress trays and clears every bed; the door's picture is fixed (§ 2.2, D7); Thomas holds a watch signal (§ 6) |
| "Do this to earn that"    | The door opens with the step, never after or because of a lesson                                                                               |
| Lures to stay or return   | No auto-next, no "again?", no arrival beat, no line naming the game                                                                            |
| Time pressure             | No timer; a bed waits for ever, and a tap on it repeats the question                                                                           |
| Seductive detail          | No idle animation; every motion answers a tap or a line                                                                                        |
| Social comparison         | Per learner; no name, no score, nothing about another learner                                                                                  |
| Failure feedback          | Never a red X; a wrong tap changes nothing in the bed                                                                                          |
