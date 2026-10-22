# The Play place and its first two games: Raft crossing and Letter critters (native build spec)

**Ask (Thomas, 2026-10-20, verbatim):** "the flowerbed (10) you just made is not really a game ... games should be seperate from path islands and exist outside the path (you should not be looking at the path when you select a game in either number garden or word song. a game is something fun (not just like any step on the path)"

**Decided by popup (Thomas, 2026-10-20):**

- **The first two games:** **Raft crossing** (Number Garden: drag animals 1-9 onto a raft that carries exactly 10; too many and it wobbles and splashes, retry; exactly 10 and Emma rows to an island, where the animals do something silly; later 20) and **Letter critters** (Word Song: the letters she knows are creatures; drag 2-3 together and they sing their sounds, then the word; a real word pops its picture; a non-word makes a funny noise and Emma giggles).
- **One shared Play place, reached from Home** (the Hub), never from a Map, with no path in view.
- **No parent play limit for now.**

**Source:** Dave's research, `design/research/real-games-2026-10-20.md` (PR #647, merged to `main` at f1be571f): § 1 (what makes play fun), § 2 (the kept and relaxed rails), § 3 (the Play place, the six ideas). The rails are applied in § 1.6. This spec turns the place and the two ideas into numbers Devon and Kevin can build from.

**Retires nothing.** "Fill the flower bed" (`mini-game-flower-bed.md`, the Map door, the `game` route, `GameScreen`) stays as it is. Its move into add-to-10 is a separate spec (Dave § 4). The two may live side by side for a while: the flower bed on the Number Garden Map, the new games in the Play place.

**Standing rules applied:** any learner of about 6-9 (Marian is one); no Danish premise, and every spoken line sits in a table (§ 4) with no text baked into art, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first, minimal reading; never a red X.

**Scope:** spec only. No code, no renders, no generation, no tickets.

**Checks folded in (2026-10-20):** Dave's D-check (D1-D3 and D6-D8 CONFIRM, D4 and D5 CHANGE) and Kevin's K-check (K2-K4 CONFIRM, K2 with a seam; K1, K5 and the build split CHANGE), both read-only against this spec at 3db94a08. Every CHANGE is applied below; § 8.2 and § 8.3 record each verdict.

## Goal

A learner who wants to play taps Play on Home and picks a game. She loads animals onto a raft until it floats with exactly ten, or seats letter critters on a log until they sing a word. Things wobble, splash, giggle and pop. After a few minutes the game reaches a natural stop and she is back in the Play place. Nothing she does counts toward a lesson.

## User state entering

She is on the Hub (Home). At least one game is open for the playing learner (§ 1.1), so the Play button is there. Emma's Hub lines may be playing.

## Decisions (the spec's own calls, with reasons)

1. **Two new routes, `play-place` (the place) and `play-game` (a game), beside the shipped `game`.** The flower bed's `game` route returns to a Map with a quiet Map return (`mini-game-flower-bed.md` § 1.3). A Play-place game returns to the Play place. Sharing one route would put a Map-or-Play origin switch into the flower bed's code, and that code is about to move (Dave § 4). Not `play`: the flower bed's route was named `game` on purpose, and `route.ts:66-67` says why ("Not `play`: that already names the Map's current-stop start", the `StopTapAction` `'play'`, `MapVisitOptions['play']` and App's `onPlay={onMapPlay}`, as Kevin lists them). `play-place` keeps that comment true at no cost (K5, Kevin 2026-10-20).
2. **The Play button is a clay disc in the top corner opposite the learner badge**, the size of the Map's Home and the flower bed's door. It is smaller than the world cards and apart from them, as Dave § 3 asks, and it needs no new layout band (§ 1.2).
3. **The Play place reuses the Hub's frames.** Emma, her light and her bubble sit exactly where they sit on the Hub, so she does not jump when the place opens, and the tiles take the card boxes' width (§ 1.3).
4. **No toy state in this build.** Dave allows a game to keep its own toy state (§ 2, "Writes nothing" relaxed). Neither game needs it to be fun, and keeping none keeps every visit at zero writes (AC N5). The island fills during a visit and starts empty next time.
5. **The raft's shore refills; three crossings make a trip.** Six animals wait, always with at least two ways to make ten. After a crossing, newcomers walk on so there are six again. The third crossing is the natural stop. Dave's test is "many right ways": a shore of three fixed pairs gives only three, so it refills instead (§ 2.1). A raft that can no longer reach ten is unstuck by the world, never by Emma: after two splashes in a row, a newcomer of exactly the missing weight walks on (§ 2.3, D4).
6. **Letter critters pops all 45 picture words for every learner, says the other real words, and never treats a real word as a mistake** (CHANGE, Thomas 2026-10-22). Two critters together sing their two sounds and nothing more. A three-letter run that is one of the 45 picture words pops its picture whatever her steps, because those are exactly the words with tuned blend clips and pack pictures (§ 3.1); the old step gate is gone. Any other real CVC word sings its sounds, and then Emma says it (`CRITTER_SAID_WORDS`, 156 whole-word Lily clips, no picture), except the words on Dave's two lists (`CRITTER_NEVER_SAY`, `CRITTER_NOT_SAID`), which sing their sounds and sit together, quietly, as before. Only a run that is not a word gets the boing, the tumble and the giggle, and no line ever says "not a word" (§ 3.3, § 3.5, D5).
7. **The sounds are the shipped blend clips, bundled.** Every critter sound is a segment of an ear-approved Word Song blend clip, played through the shipped tap-to-hear window. A picture word plays its own whole clip. No phoneme is rendered for this game (§ 3.4).
8. **At most 16 critters on the meadow.** A learner past every CVC step knows 22 letters, which do not fit a phone in landscape at a touchable size. A visit with more than 16 shows every vowel she knows and a rotating set of consonants (§ 3.1).
9. **Emma waves the raft off from her place in this build.** She does not ride it: a rowing Emma is new Emma art (T4).

---

## 1. The Play place

### 1.1 Which games are open (core)

A new core module, `packages/core/src/games/playPlace.ts` (imported as `@marian/core/games/playPlace` through the package's `"./*"` export, `packages/core/package.json:10`). It sits beside `miniGames.ts` and does not touch it.

| Name                      | Shape                                        | Meaning                                                                                                          |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PlayGameId`              | `'raft' \| 'critters'`                       | The Play place's games, in tile order                                                                            |
| `PLAY_GAMES`              | `Record<PlayGameId, { opensAt: SkillNode }>` | `raft: { opensAt: 'add-to-10' }`, `critters: { opensAt: 'blending-cv' }`                                         |
| `openPlayGames(progress)` | `(Progress \| null) => PlayGameId[]`         | The games whose `opensAt` is current or mastered for that step's world, in `PLAY_GAMES` order; `null` gives `[]` |

- **"Current or mastered"** is the flower bed's rule (`openGames`, `miniGames.ts:37`): `progress.skillLevels[opensAt] === 'mastered' || currentStepOf(progress, world) === opensAt`, with `world` the step's track (`math` for add-to-10, `word-song` for blending-cv) and `currentStepOf` the Hub's (`packages/core/src/hub/hubCardModel.ts`).
- **Why add-to-10 for the raft:** the raft's one judged thing is "exactly ten", which is adding to ten's content. A learner on numbers sees no raft.
- **Why blending-cv for the critters:** the game is joining sounds into a word, which is what blending sounds teaches (`real-blending.md` § 1). A learner on letter sounds sees no critters.
- **Nothing here is persisted.** No `Progress` field, no storage key, no migration.

### 1.2 The Play button on the Hub

**When:** decided once at Hub mount, from the progress the visit reads (`readMount`, `mobile/src/screens/hub/Hub.tsx:121`). The Hub shows the button exactly when `openPlayGames(progress)` is non-empty. It never pops in or out while the Hub is up.

**No arrival beat.** When a game first opens, nothing says so: no line, no glow, no bob, no sparkle, no "new". The Hub's lines, its glowing card and its suggestion are unchanged, and no Hub, Map or Session End line names Play or a game (Dave § 2 "Emma never suggests a game").

**Look:** a round clay disc with the Map Home button's shape, ledge shadow and press (`HomeButton`, `mobile/src/screens/map/mapChrome.tsx:32`), faced in the Hub bubble's cream (`#fff8ee`, `hub-native.md` § 6) over the bubble's `#e3c6a6` ledge (`P_L_SHADOW`, `hubLayout.ts`). Cream belongs to neither world: the cards are wood and honey. Inside sits a new clay piece, `ui-play` (§ 5.2), at `Math.round(68 × k)` pt as Home draws its house: 40 pt in the 56 pt phone disc, 68 pt in the 96 pt tablet disc. No text, no badge, no count, no idle motion.

**Position** (`S` = the safe rect). A new `play: Rect` on `HubLayout` (`mobile/src/layout/hubLayout.ts:66-81`), the mirror of the learner badge's top-left corner (`hubBadge`, `mobile/src/layout/pickerLayout.ts:108-125`: 48 pt at (S.x + 16, S.y + 8)):

| Form                 | Play rect                           | Size    | Why there                                                                  |
| -------------------- | ----------------------------------- | ------- | -------------------------------------------------------------------------- |
| P (phone portrait)   | (S.x + S.width − 16 − 56, S.y + 8)  | 56 × 56 | The top-right corner, across from the badge                                |
| L (phone landscape)  | (colRight − 56, S.y + 8)            | 56 × 56 | The top-right of Emma's column; the right card's crown room is right of it |
| W (tablet portrait)  | (S.x + S.width − 24 − 96, S.y + 14) | 96 × 96 | The top-right corner, as the flower bed's door on the W Map                |
| L (tablet landscape) | (colRight − 96, S.y + 14)           | 96 × 96 | The top-right of Emma's column                                             |

`colRight` is the left card's x − 24 (`colX`, `colW`, `hubLayout.ts:269-272`).

**Checks (hand-computed from `hubLayout.ts` and `hub-native.md` §§ 2-3; Devon's jest pins them, AC N1):**

- **P at 375 × 667:** Emma is 204 pt, centred, so her frame runs x 85.5-289.5. The disc runs 303-359, 13.5 pt clear of her frame. The cards start far below (y 352.3).
- **L at 667 × 375:** the column runs 16-278 and Emma's 247 pt frame 23.5-270.5, from y 8. The disc (222-278, 8-64) sits in the frame's transparent top-right corner: her figure fills only about x 0.33-0.68 of the art (`hub-native.md` § 2), here 105-191.5. The left card starts at x 302, 24 pt to the right. Phone L puts the disc in the column, not the top-right of the screen, because there the right card's crown and bob reach y 52.5 and the disc would sit on them.
- **W at 820 × 1180 (insets t24 b20):** the stage is 789.4 wide (u 0.963) from x 15.3. The disc (700-796, 38-134) overlaps only the top-right corner of Emma's frame (to 708.5); her figure runs about 373-548. The bubble is on the left (from x 40.3), the cards start at y 476.5.
- **L at 1180 × 820 (b20):** the column is 16-368 and Emma's 440 pt frame starts at y 108. The disc (272-368, 14-110) overlaps her frame by 2 pt at its top, where her figure is not; her figure runs about 117-271 in x.

**Emma's 3 s press** ignores a hold that starts on the Play disc plus 8 pt, as it ignores the badge (`badgeExclusion`, `pickerLayout.ts:128-136`). The disc draws above her long-press target, as the badge does (`Hub.tsx:309`).

**Tap:** the map button's handling (`openMap`, `Hub.tsx:215`): the guard against a second leave, the plink (`playPlink`), the line cut (`stopLines`), then `onOpenPlay()`. App changes the route to `play-place`. **Press:** Home's press, the face sinking 6 × k over 120 ms (`PRESS_MS`, `mapChrome.tsx:45`). **Accessibility:** `accessibilityRole="button"`, label "Play" (§ 4.2), `testID="hub-play"`.

```
P  phone portrait (375×667)            L  phone landscape (667×375)
+------------------------------+       +----------------------------------------------+
|(☺)                      (▶)  |       |(☺)           (▶)|  ~~crown~~   ~~crown~~      |
|        (  Emma 204  )        |       |    ( Emma 247 ) |  +---------+ +---------+    |
|        (   idle     )        |       |    (          ) |  | Number  | |  Word   |    |
|  +------------------------+  |       |  +-----------+  |  | Garden  | |  Song   |    |
|  | bubble, unchanged      |  |       |  | bubble    |  |  |         | |         |    |
|  +------------------------+  |       |  +-----------+  |  +---------+ +---------+    |
|  +-----------+ +-----------+ |       +----------------------------------------------+
|  |  Number   | |   Word    | |
|  |  Garden   | |   Song    | |       (☺) the learner badge (2+ learners only)
|  +-----------+ +-----------+ |       (▶) the Play button: a cream clay disc holding ui-play
+------------------------------+
```

### 1.3 The Play place screen

**Route `play-place`.** App's `layoutForRoute` returns `hubLayout` for it already (the `default` branch, `mobile/src/layout/routeLayout.ts:26`), so Emma keeps her Hub frame when the place opens: she does not move. The Play place adds two things to the Hub's frames: the Home disc and the tiles. A new `playPlaceLayout(v)` in `mobile/src/layout/playPlaceLayout.ts` returns `{ hub: hubLayout(v), home: Rect, tiles: Rect[] }`.

| Region   | What                                                                                                                                             | Source                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Backdrop | The Hub's garden backdrop, as it is                                                                                                              | `HubBackdrop.tsx`                                |
| Home     | The Map's `HomeButton` (wood disc with `ui-house`), at the Map's Home rect: (S.x + 16, S.y + 8) 56 on phones, (S.x + 24, S.y + 14) 96 on tablets | `mapChrome.tsx:32`; `mapScreenLayout.ts:114-118` |
| Emma     | App's `EmmaStage`, `idle`, at the Hub's frame, with its warm light                                                                               | `hubLayout.ts` `emma`, `light`                   |
| Bubble   | `HubBubble` in the Hub's bubble slot                                                                                                             | `HubBubble.tsx`                                  |
| Tiles    | One square clay tile per open game, side `t`, bottom-aligned with the Hub's card boxes                                                           | below                                            |

**Tiles.** `t = cards[0].width` (the Hub's card width). Tile i sits at `(cards[i].x, cards[i].y + cards[i].height − t)`: the same columns as the world cards, at their bottom, in the thumb zone. With one open game its tile sits centred between the two columns at the same y. Sizes (hand-computed from `hub-native.md`): 163.5 at 375 × 667; 166.5 at 667 × 375; 364 at 820 × 1180 (378 × 0.963); 378 at 1180 × 820. Every tile is far above 44 pt.

- **Face:** the world's clay as a rounded square, radius 0.22 t: the raft in Number Garden wood (`LOOK.math`), the critters in Word Song honey (`LOOK['word-song']`), with that look's shadow at `s = t / 118` (the map button's reference size, `MapButton.tsx`). The tile says which world the game's content comes from without a word.
- **Inside:** the game's clay piece, `ui-raft` or `ui-critters` (§ 5.2), at 0.78 t, centred. No text, no lock, no "new", no count.
- **Press:** the card's press, the face sinking 8 × s over 120 ms (`hub-native.md` § 6).
- **Accessibility:** `accessibilityRole="button"`, labels "Raft crossing" and "Letter critters" (§ 4.2), `testID="play-tile-raft"` and `"play-tile-critters"`.

```
P  phone portrait (375×667)              L  phone landscape (667×375)
+------------------------------+         +----------------------------------------------+
|(⌂)                           |         |(⌂)              |                            |
|        (  Emma 204  )        |         |    ( Emma 247 ) |                            |
|        (   idle     )        |         |    (          ) |  +---------+ +---------+   |
|  +------------------------+  |         |  +-----------+  |  | ~raft~  | | critters|   |
|  | What shall we play?    |  |         |  | What shall|  |  | (clay)  | | (clay)  |   |
|  +------------------------+  |         |  | we play?  |  |  +---------+ +---------+   |
|                              |         |  +-----------+  |   wood       honey         |
|  +-----------+ +-----------+ |         +----------------------------------------------+
|  |  ~raft~   | | critters  | |
|  |  (clay)   | |  (clay)   | |         W  tablet portrait: the web stage, as the Hub;
|  +-----------+ +-----------+ |            tiles 364 at the bottom of the card columns.
|    wood          honey       |         TL tablet landscape: tiles 378, as phone L.
+------------------------------+
  (⌂) Home: the Map's wood disc with its house
```

**Lines.** On an entry from the Hub, Emma says `guide.play.open`, "What shall we play?" (§ 4.1), 300 ms after the screen fades in; the bubble walks it. On a return from a game she says nothing. She never names a game, never suggests one, and has no other line here. The line player is `createManifestLinePlayer('play', …)` over the `guide.play.*` rows (`mobile/src/audio/manifestLines.ts:38`): without a clip it walks the caption at 165 wpm, so nothing waits on audio.

**Grouping.** Two games need none. When a third arrives, the tiles become a row per kind (numbers, letters, toys), as Dave § 3 suggests. Not in this build.

### 1.4 Entering, leaving and picking

- **Routes:** `Route` gains `'play-place'` and `'play-game'` (`packages/core/src/router/route.ts`; K5). `ROUTE_EXITS` (`mobile/src/router/routes.ts:48-61`): `hub` adds `'play-place'`; `'play-place': ['hub', 'play-game', 'picker']`; `'play-game': ['play-place']`. `ROUTE_LABELS` (`routes.ts:67`) gains "Play place" and "Play game". Both maps are `Record<Route, …>`, so the `Route` members and their rows land in one PR (§ 7). The game id lives in App state, as the flower bed's does.
- **Hub → Play place:** the Hub fades out on its own exit (`HUB_EXIT_MS`), the place fades in over 200 ms.
- **Picking a game:** a tile tap plinks, cuts Emma's line, and about 200 ms after the release the route is `play-game` with that id. The place fades out, the game fades in (200 ms each).
- **Back from a game** (its back disc, or Android back): the place at once, silently (no open line). The same at a game's natural stop (§ 2.6, § 3.6). Never into another round.
- **Home from the Play place** (the Home disc, or Android back): the Hub. The Hub decides its visit afresh on mount, as on any return; its 30 s rapid-remount rule (`hub-native.md` § 5) keeps a quick round trip quiet.
- **The return rule** (`mobile/src/lifecycle/pickerReturn.ts:14-19`): `PICKER_RETURN_ROUTES` gains `'play-place'`, a chooser screen like the Hub and the Map. `'play-game'` stays out, as Math, Word Song and the flower bed's `game` do: a game writes nothing, so a learner switch mid-game loses nothing and can wait.
- **No Session End, ever.** Nothing in either game reaches a session result.

### 1.5 Per learner

- **What opens:** `openPlayGames(loadProgress())`, read through whatever store is installed. With learner profiles that is the playing learner's (`learnerScopedStore`, `packages/core/src/learners/keys.ts:52-72`). Learner A on adding to ten sees the raft; learner B on numbers sees no Play button at all.
- **Content:** the raft's content is the same for every learner who has it (bonds to ten). The critters' words and letters come from the playing learner's steps (§ 3.1).
- **Nothing per learner is written,** because nothing is written (Decision 4). No name, no score, nothing about another learner is shown.

### 1.6 Rules both games keep (Dave § 2, made concrete)

| Rail (Dave § 2)                                          | What the games do                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kept:** no currency, prizes or streaks                 | No stardust pill, no streak, no beads, no score, no unlock. Nothing is earned or spent.                                                                                                                 |
| **Kept:** no lures                                       | No arrival beat, no "new", no "come back", nothing lost by staying away.                                                                                                                                |
| **Kept:** Emma never pushes games                        | Hub, Map and Session End lines unchanged. The Play place's one line asks what to play and names nothing.                                                                                                |
| **Kept:** lessons are never the price of games           | The button opens with a step, never after or because of a session that day.                                                                                                                             |
| **Kept:** games never write progress or stardust         | No call to `saveProgress`, the session history, stardust, the streak, the pace guard, Leitner or cloud sync. Zero key-value writes and zero network calls per visit (AC N5).                            |
| **Kept:** no timed answers, no clock                     | Nothing counts down. A raft or a log waits for ever.                                                                                                                                                    |
| **Kept:** no rankings                                    | Nothing compares learners.                                                                                                                                                                              |
| **Relaxed:** playful, retryable failure                  | The raft wobbles and an animal splashes off; a non-word tumbles and Emma giggles. A real word never tumbles. No lives, no game over, nothing lost, no red, no X, no buzzer, no poof.                    |
| **Relaxed:** motion without countdowns                   | Animals hop, rafts bob, critters bounce. Every motion answers a touch or a line, except the raft's slow bob on the water.                                                                               |
| **Relaxed:** toy state (never progress)                  | None kept in this build (Decision 4). The island fills during a visit only.                                                                                                                             |
| **Relaxed:** judged items from current or mastered steps | The raft judges only "exactly ten" (add-to-10). The critters pop only the learner's CVC words (§ 3.1); the text-only real-word list decides only sit or boing, and nothing on it is said or shown (D5). |
| **Relaxed:** natural stops, no autoplay, no "one more?"  | The raft stops after its third crossing, the critters when she leaves. Both return to the Play place. No line contains "again", "next", "more" or "round" (AC C8).                                      |
| **Kept:** lesson screens stay plain                      | Game art (raft, island, critters) never appears in a lesson.                                                                                                                                            |

### 1.7 The game frame (both games)

**Route `play-game`; layout `mathLayout(viewport)` as it is** (`mobile/src/layout/mathLayout.ts:477`), so the back disc, Emma and the ribbon sit where a lesson puts them. `layoutForRoute` returns `mathLayout` for `play-game` as it does for `game` (`routeLayout.ts:19-21`).

| Region    | What                                                                                                                                                                               | Source                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Back      | The lesson's clay back disc, 56 pt on phones, 74.7 pt on tablets                                                                                                                   | `PHONE_BACK`, `TABLET_BACK`, `mathLayout.ts:70-71` |
| HUD row   | Empty: no beads, no stardust pill, no streak                                                                                                                                       | Decision 4; § 1.6                                  |
| Emma      | App's `EmmaStage` at `layout.emma`, with a `playPose` like the flower bed's `gamePose`                                                                                             | `EmmaStage.tsx`; `App.tsx`                         |
| Ribbon    | `CaptionRibbon` at `layout.ribbon`, walking each line by word ticks                                                                                                                | `CaptionRibbon.tsx`                                |
| Play area | `A` = x `problem.x`, y `problem.y`, width `problem.width`, height `chips.rect.y + chips.rect.height − problem.y`: the problem and chip regions together, since a game has no chips | `mathLayout.ts:121`, `:131`                        |

**`A` at the floors** (from the flower bed's size table, `mini-game-flower-bed.md` § 2.2; hand-computed, AC N13 pins them):

| Device               | `A`                      |
| -------------------- | ------------------------ |
| 375 × 667            | (16, 259) 343 × 376      |
| 667 × 375            | (160, 146.4) 491 × 216.4 |
| 820 × 1180 (t24 b20) | (16, 442.8) 788 × 685.2  |
| 1180 × 820 (b20)     | (245.2, 231) 918.8 × 537 |

**Screens:** `mobile/src/screens/play/PlayPlace.tsx`, `PlayGameScreen.tsx` (the frame), `RaftCrossing.tsx`, `LetterCritters.tsx`. Separate from Math, Word Song and the flower bed's `GameScreen`, so "writes nothing" holds by construction.

**Drag:** react-native-gesture-handler's `Gesture.Pan()` with Reanimated shared values, as the app's other gesture code would. A touch that moves under 8 pt is a tap. A dragged piece lifts (scale 1.08 over 120 ms, and the ledge shadow grows) and follows the finger 1:1, with no lag. A drop that lands nowhere useful springs the piece back to where it came from (spring 300 / 22). Only one piece moves at a time: a second finger is ignored while one drags.

**Back, background, rotation:**

- **Back:** the Play place at once, silent, mid-line, mid-drag or mid-crossing. The line in flight is cancelled (`cancelActive()`); nothing is written.
- **Background:** the line parks and resumes on the voice channel, as everywhere. While the app is hidden (`useIsAppHidden`, `mobile/src/lifecycle/appVisibility.ts:79`), a beat that falls due (a crossing's next step, a picture's float-away) waits for the return. A drag in flight is dropped where it was and springs home.
- **Rotation:** the screen lays out again from the new viewport. Each game keeps its model (which animal is where, what is aboard, which crossing; which critter sits where). A motion in flight jumps to its end state, so nothing flies to an old position.

**Emma's poses** (the existing set, `packages/core/src/character/emmaPose.ts:24-32`): `idle` at rest, `listening` while she gives a game's open line, `waving` as the raft leaves, `cheering` with a giggle, `celebration` when a word pops, `puzzled-tilt` on a splash.

**Sounds** (`createSfx`, `mobile/src/audio/sfx.ts`): the shipped plink (0.3), sparkle (0.55) and cheer, plus two new effects, `sfx-splash` and `sfx-boing` (§ 5.3, T5). No poof and no chime: the poof is the lessons' wrong-answer sound, and a game has no wrong answers.

---

## 2. Raft crossing (Number Garden content)

### 2.1 Content: the shore (core)

In `playPlace.ts`:

| Name                        | Shape                           | Meaning                                                                                                 |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `RAFT_LOAD`                 | `10`                            | What the raft carries, exactly                                                                          |
| `RAFT_SHORE_SIZE`           | `6`                             | Animals waiting on the shore                                                                            |
| `RAFT_CROSSINGS`            | `3`                             | Crossings in a trip; the third is the natural stop                                                      |
| `RAFT_ANIMALS`              | `Record<1..9, PictureId>`       | 1 bee, 2 frog, 3 hen, 4 duck, 5 cat, 6 fox, 7 dog, 8 goat, 9 pig: small to big, so size hints at weight |
| `raftLoads(weights)`        | `(number[]) => number[][]`      | Every set of shore positions whose weights sum to exactly 10                                            |
| `raftShore(rng)`            | `(rng) => number[]`             | 6 weights in 1-9 with at least 2 loads, at least one of them a pair                                     |
| `raftRefill(waiting, rng)`  | `(number[], rng) => number[]`   | The newcomers that bring the shore back to 6 with the same guarantee; `waiting` keeps its order         |
| `raftStuck(waiting, total)` | `(number[], number) => boolean` | True when `total` is 1-9 and no set of `waiting` weights sums to exactly `10 − total`                   |

- **`raftShore`:** pick one bond to ten (a, 10 − a) with a from 1-9, then 4 more weights in 1-9, all with `rng`; accept when `raftLoads` finds at least 2 loads; shuffle with `rng`. After 50 rejected draws (never expected), return the lesson's three canon bonds, 7 + 3, 6 + 4 and 8 + 2, shuffled (the givens `flowerBedRound` always plays, `miniGames.ts`).
- **`raftRefill`:** the same draw for the empty places only, accepted when the whole shore has at least 2 loads with at least one pair. Fallback: the complement of a waiting weight, then any weights, until it passes.
- **Why "at least 2 loads":** Dave's first ingredient is agency, many right ways (§ 1 of #647). A shore of three fixed bond pairs gives exactly three loads, and every one is a pair (checked by brute force on 2026-10-20 over the 10 three-pair shores: 6 can always be emptied, and every load in them is a pair). Random weights give more ways, including three-animal loads such as 1 + 2 + 7 (D3).
- **A stuck raft gets a newcomer, not a hint.** With 6 + 2 aboard she may find no 2 left on the shore (`raftStuck`). Taking an animal off is one way out, but nothing on screen shows it, and every splash looks the same, so a stuck raft is a dead end rather than playful failure (Dave, D4 CHANGE 2026-10-20). So after two splashes in a row on a stuck raft, a newcomer of exactly the missing weight walks onto the shore (§ 2.3). No line, no pointing, no glow: she still has to find it (Bonawitz et al. 2011, via Dave: don't narrate the move). The trigger count of two is Dave's reasoning, not a measured number.
- **Every learner with the raft gets the same kind of shore.** No Leitner read, no history read. The rng is `Math.random` in the app and a seeded generator in tests.
- **The animals** are the shipped pack pictures `mobile/assets/pictures/{bee,frog,hen,duck,cat,fox,dog,goat,pig}.webp` (all nine present on `main`, checked 2026-10-20). Two animals of the same weight are two of the same animal.

### 2.2 The scene

The scene fills `A` (§ 1.7). Its axis follows the screen: **portrait** (phone P, tablet W) crosses **upward**, from the shore at the bottom (near the thumbs) to the island at the top; **landscape** (phone L, tablet TL) crosses **rightward**, from the shore on the left to the island on the right.

| Part               | Portrait                                                                      | Landscape                                                  |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Shore (sand)       | The bottom 36 % of `A`; 6 spots in 2 rows of 3                                | The left 30 % of `A`; 6 spots in 3 rows of 2               |
| Water              | Between shore and island                                                      | Between shore and island                                   |
| Island             | The top 24 % of `A`: a sand mound, 0.6 × `A.width` wide, with two grass tufts | The right 22 % of `A`: a sand mound, 0.8 × `A.height` tall |
| Raft at the dock   | Centred, its bottom edge 4 pt above the shore                                 | Vertically centred, its left edge 4 pt right of the shore  |
| Raft at the island | Its top edge on the island mound's lower edge                                 | Its right edge on the island mound's left edge             |

**Sizes.** The animal cell `a` is 64 pt on phones and 104 pt on tablets: every animal's touch target is `a × a`. The picture inside is drawn at `a × (0.72 + 0.28 × (w − 1) / 8)`, so the bee is 0.72 a and the pig fills the cell. A weight tag sits at the picture's lower right: a cream disc (`#FFF5F0`, `colors.myCream`) of 0.42 a with the weight in Fredoka 700 at 0.3 a, `#6b3f1f` (8.3 : 1). A numeral, not dots (D2).

**The raft.** A flat deck of five logs in Number Garden wood (`#c98a55`, outlined `#7d4a26`, the flower bed's rim and soil browns), with 6 seats in 3 columns × 2 rows of 0.7 a (44.8 pt on phones, 72.8 on tablets; a seat is never under 44 pt). Deck: `3 × 0.7a + 2 × 6 + 24` wide and `2 × 0.7a + 6 + 24` tall: 170.4 × 119.6 on phones, 254.4 × 175.6 on tablets. A mast at the back-left corner carries a cream flag (0.5 a × 0.36 a) with the load's total in Fredoka 700, `#6b3f1f`; at 0 the flag is blank. One oar lies along the right edge. The water is two blues with a wave line; the island is Word Song's honey sand (`#f2c27a`) with two green tufts (look: T1).

**Fit at the floors** (hand-computed from § 1.7's `A`; AC N13 pins them):

| Device     | Shore band                                         | Water      | Island band | Raft (deck)   | Fits                              |
| ---------- | -------------------------------------------------- | ---------- | ----------- | ------------- | --------------------------------- |
| 375 × 667  | 135.4 tall: 2 rows of 64                           | 150.4 tall | 90.2 tall   | 170.4 × 119.6 | yes: 119.6 ≤ 150.4                |
| 667 × 375  | 147.3 wide: 2 columns of 64; 3 rows of 64 in 216.4 | 235.7 wide | 108 wide    | 170.4 × 119.6 | yes: 170.4 ≤ 235.7, 119.6 ≤ 216.4 |
| 820 × 1180 | 246.7 tall: 2 rows of 104                          | 274 tall   | 164.4 tall  | 254.4 × 175.6 | yes                               |
| 1180 × 820 | 275.6 wide: 2 columns of 104                       | 441 wide   | 202.1 wide  | 254.4 × 175.6 | yes                               |

### 2.3 Moves

**Board.** She drags an animal onto the raft (the deck's rect grown by 0.25 a on every side), or taps it. It springs to the next free seat (back row left to right, then the front row; spring 300 / 22) and shrinks to the seat. Plink (0.3). The deck sinks by `total / 10 × 0.12 × deck height`, so the water creeps up its side as it fills. The flag shows the new total, and Emma says it: `guide.play.raft.total.<t>`, "Seven!" (t 1-9). A total line cuts the one before it (`cancelActive()`), so totals never queue.

**Take off.** She drags an animal off the deck, or taps it. It hops back to its own shore spot (a 0.2 a arc, 300 ms), or, when a newcomer stands there (below), to the nearest free spot. The flag and the sinking follow; Emma says the new total, or nothing at 0.

**Too heavy** (the total would pass 10):

| t (ms) | What happens                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | The animal lands on its seat. The deck sinks until the water covers it. The flag keeps the old total: it never shows more than 10.                                                                                                                                |
| 0-900  | The raft wobbles: rotate +6° / −6°, three times, easing out. Drops on the raft are refused while it wobbles (they spring home).                                                                                                                                   |
| 500    | The newest animal slides off the low edge into the water (400 ms). `sfx-splash`. A splash ring and six droplets arc up and fall (300 ms). Emma `puzzled-tilt`, `guide.play.raft.splash`, "Too heavy!" (Thomas 2026-10-22: the splash is the sound's, not Emma's). |
| 900    | The deck rises back to the old load. The animal paddles to its shore spot (1200 ms, bobbing ±3 pt), climbs out and shakes itself (a 300 ms wiggle). It can be dragged again at once.                                                                              |

Everyone else stays aboard. Nothing is lost and nothing is counted: no lives, no tries, no score. Never red, never an X, no poof. Emma never hints (D4).

**Stuck: a newcomer walks on** (D4, Dave 2026-10-20). The raft keeps one counter, `splashesInARow`: a splash adds 1; a boarding that does not splash, a take-off and a departure set it to 0. It lives only in the game's model, for the visit, and is never written.

| When                                                                                                                              | What happens                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A splash ends (the animal has shaken itself on its spot) with `splashesInARow` ≥ 2, `raftStuck(waiting, total)` and an empty spot | A newcomer, `RAFT_ANIMALS[10 − total]`, walks in from the shore's outer edge to the empty spot nearest that edge, with the refill walk-in (500 ms). `splashesInARow` goes to 0.      |
| During and after the walk-in                                                                                                      | No line, no sound, no glow, no bob, no pointing. Emma goes back to `idle`. The newcomer is an ordinary shore animal: it boards, comes off and crosses like any other.                |
| A take-off finds every spot full                                                                                                  | The most recent newcomer walks back out the way it came (500 ms) as the animal hops into its own spot. With one animal aboard, the shore is then the one she had before she boarded. |

**The spot is there in practice.** Each animal aboard leaves a spot, and a newcomer takes one, so the first newcomer always finds one. A second newcomer is needed only if she leaves the first on the shore and boards others into a new stuck total; if by then every spot is full, none comes and the counter keeps counting. The newcomer solves the total it came for on its own. After a crossing, `raftRefill` treats an unused newcomer as a waiting animal.

**Exactly ten** (departure, crossing k):

| t (ms)               | What happens                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                    | Sparkle (0.55). The flag shows 10 and flutters. Boarding closes (shore animals still hop when tapped, but nothing boards). Emma `waving`, `guide.play.raft.go`, "Ten! Off we go!".                                    |
| 600                  | The oar rows (±20°, 500 ms a stroke). The raft glides to the island over 2400 ms (ease in-out), bobbing ±3 pt on a 1.2 s cycle.                                                                                       |
| arrival              | The animals hop off onto the island one by one (300 ms arcs, 80 ms apart) and stay there at 0.5 a, beside earlier crossings' animals, for the rest of the visit.                                                      |
| arrival + 300        | The silly scene (below). Emma `cheering`, `guide.play.raft.silly`, "Hee hee! Silly animals!", and the shipped cheer.                                                                                                  |
| scene end + 400      | **Crossings 1 and 2:** the raft glides back empty (1600 ms). Newcomers (`raftRefill`) walk in from the shore's outer edge to the empty spots (500 ms, 120 ms apart). Emma `idle`. Boarding opens when the raft docks. |
| scene end + 400      | **Crossing 3 (the natural stop):** every animal on the island bounces once. Emma `cheering`, `guide.play.raft.close`, "What a party on the island!".                                                                  |
| close line end + 800 | The game fades out (200 ms) and the Play place fades in, silent.                                                                                                                                                      |

**The silly scenes.** Four, about 2-3 s each, played by this crossing's animals. Picked with `rng`, never the same one twice in a row within a visit:

| Id           | What the animals do                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dance`      | They hop in a wave, left to right, twice (0.2 a, 300 ms each, 100 ms apart).                                                                |
| `tower`      | They climb on each other, heaviest at the bottom (250 ms each), sway ±5° twice, topple onto the sand (400 ms) and sit up.                   |
| `cannonball` | The heaviest jumps into the sea beside the island (a 500 ms arc). `sfx-splash`. Droplets rain on the others, who shake themselves (300 ms). |
| `spin`       | They spin round once together (600 ms), then squash and stretch (scaleY 0.8 → 1, 200 ms).                                                   |

**Length.** A trip is three crossings: about 1.5-3.5 minutes (loading 20-60 s, crossing 2.4 s, scene about 3 s, return 1.6 s, each). That is Dave's "natural stopping points every few minutes". No autoplay into another trip: playing again is her own tap on the raft tile.

**Later: 20.** When adding to twenty is the learner's current step, a bigger raft could carry 20. Not in this build; it needs its own shore rule and total lines 11-19.

### 2.4 Wireframes (phone portrait while loading, total 7; tablet landscape at the island)

```
PHONE PORTRAIT  375×667                     TABLET LANDSCAPE  1180×820
+-------------------------------------+     +-------------------------------------------------------------+
| (<)                                 |     | (<)                                                         |
|  .-----.  +-----------------------+ |     |  .------.   +----------------------------------+            |
| ( Emma  ) | Seven!                | |     | ( Emma   )  | Hee hee! Silly animals!          |            |
| (  147  ) +-----------------------+ |     | ( cheer- )  +----------------------------------+            |
|  '-----'                            |     |  '------'                                                   |
|        .------ island ------.       |     | sand   | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ +-+ | .-island-. |
|       (    sand, two tufts   )      |     | [cat5] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ |7| |( dog goat )|
|  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ |     | [pig9] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ +=====+(  dancing )|
|  ~  ~  ~  |>7|             ~  ~  ~  |     | [bee1] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ |empty|( duck frog)|
|  ~  ~  +=================+  ~  ~  ~ |     | [duc4] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ +=====+ '--------' |
|  ~  ~  | [dog7] [ ] [ ]  |  ~  ~  ~ |     | [fox6] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  |            |
|  ~  ~  | [ ]    [ ] [ ]  |/ ~  ~  ~ |     | [hen3] | ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  |            |
|  ~  ~  +=================+  ~  ~  ~ |     +-------------------------------------------------------------+
|  .  .  .  .  .  sand  .  .  .  .  . |       shore: 3 rows of 2, drawn as 1 column (a = 104); the raft at the
|   [hen3]     [fox6]     [duc4]      |       island landing; this crossing's animals dance on the island
|   [frg2]     [pig9]     [cat5]      |
+-------------------------------------+
  Back (16, 8); Emma 147; island band 90 from y 259; water 150; the raft (170 x 120) docked
  4 pt above the shore; shore band 135: 2 rows of 3 cells of 64, its bottom at y 635

  [dog7] an animal and its weight tag   |>7| the mast's flag with the total   ~ water   / the oar
```

### 2.5 Reduce Motion

Lines and sounds are unchanged. Dragging still follows the finger: it is the input, not decoration.

- **Board / take off:** a 150 ms fade at the seat or the shore spot, no spring, no arc. The deck still sits lower as it fills (a 150 ms fade between depths).
- **Too heavy:** no wobble and no slide. The deck dims (opacity 1 → 0.7 → 1, 300 ms), the newest animal fades from its seat and fades in at its shore spot (200 ms each). The splash sound and line play.
- **Crossing:** the raft fades from the dock to the island landing (400 ms); the animals fade onto the island; no bob, no oar.
- **Silly scene:** no motion. The line and the cheer play over the still island.
- **Return:** the raft fades back to the dock (400 ms); newcomers fade in.
- **Stuck newcomer:** it fades in at its spot (200 ms), and fades out when it leaves; no walk.

### 2.6 Accessibility

- Each animal: `accessibilityRole="button"`, label "<Animal>, <weight>" ("Dog, seven"); activate boards it, or takes it off when aboard. Drag is never the only way.
- The raft: label "Raft, <total>" ("Raft, seven"), not a button.
- The labels are VoiceOver's (§ 4.2). Lily speaks none of them.
- Touch targets: shore cells 64 / 104 pt, seats 44.8 / 72.8 pt.

---

## 3. Letter critters (Word Song content)

### 3.1 Content: words, letters and sounds (core)

In `playPlace.ts`:

| Name                     | Shape                                                       | Meaning                                                                                                      |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CRITTER_WORDS_BY_STEP`  | `Partial<Record<WordSongNode, readonly string[]>>`          | Each CVC step's words (table below)                                                                          |
| `CRITTER_LEFT_OUT`       | `readonly string[]`                                         | `['gem']` (D6)                                                                                               |
| `CRITTER_PICTURE_WORDS`  | `readonly string[]`                                         | All 45 picture words, sorted: every learner's, with no step gate (Thomas 2026-10-22)                         |
| `CRITTER_REAL_WORDS`     | `ReadonlySet<string>`                                       | The real CVC words over the 22 letters (below, D5)                                                           |
| `CRITTER_NEVER_SAY`      | `ReadonlySet<string>`                                       | Real words Emma never says (Dave 2026-10-22, below): 10                                                      |
| `CRITTER_NOT_SAID`       | `ReadonlySet<string>`                                       | Real words Emma does not say because the sounds do not spell them, and _rum_ (Dave 2026-10-22, below): 9     |
| `CRITTER_SAID_WORDS`     | `readonly string[]`                                         | The real words that are not picture words and on neither list, sorted: 156, each with a whole-word clip      |
| `critterRun(run)`        | `(string) => CritterRun`                                    | What a 3-letter run does: `'picture'`, `'word'` (said), `'quiet'` (on either list) or `'funny'` (not a word) |
| `CRITTER_CAP`            | `16`                                                        | Most critters on the meadow at once (Decision 8)                                                             |
| `critterSet(words, rng)` | `(string[], rng) => { letters: string[]; words: string[] }` | This visit's letters and the words they can spell (below)                                                    |
| `CRITTER_SOUND_SOURCE`   | `Record<string, { word: string; index: 0 \| 1 \| 2 }>`      | Which clip and which of its sounds a letter sings when it is not inside one of its own words (§ 3.4)         |

**The words** are each step's canon blend words, the `word.p*.blend` texts of `public/canon/word-song/level-1/<step>.json` (listed by a scratch script on 2026-10-20, not committed). Every one has a tuned blend clip with measured marks (`mobile/src/audio/blendMarks.generated.ts`, 46 entries) and a pack picture (`mobile/assets/pictures/<word>.webp`; all 46 present, checked the same day).

| Step                | Words                                            |
| ------------------- | ------------------------------------------------ |
| `blending-cv`       | bag, cat, fan, hat, man, pan, tag, van           |
| `sounding-out`      | bat, can, cap, dad, fan, jam, man, mat           |
| `cvc-words`         | bag, cat, fan, hat, man, pan, tag, van           |
| `cvc-words-short-o` | box, cot, dog, fox, hot, log, mop, pot           |
| `cvc-words-short-u` | bug, bus, cup, jug, nut, rug, sun, tub           |
| `cvc-words-short-i` | bib, bin, fig, lid, pig, pin, sip, wig           |
| `cvc-words-short-e` | bed, hen, jet, leg, net, pen, web (gem left out) |

**No step gate** (CHANGE, Thomas 2026-10-22). Every learner who has the game gets all 45 words, so a visit's letters are `critterSet(CRITTER_PICTURE_WORDS, rng)`: 22 letters, more than the cap, so every vowel and a rotating set of consonants, 16 in all. The table above now only says where each word comes from (C4). The old per-learner shapes, kept for the record (2026-10-20):

| Steps current or mastered | Words | Letters                   |
| ------------------------- | ----- | ------------------------- |
| blending sounds           | 8     | 11: a b c f g h m n p t v |
| + sounding out, cvc words | 14    | 13: + d j                 |
| + short o                 | 22    | 16: + l o x               |
| + short u                 | 30    | 19: + r s u               |
| + short i                 | 38    | 21: + i w                 |
| + short e                 | 45    | 22: + e                   |

**`critterSet(words, rng)`:** when the words use 16 letters or fewer, all of them, and all the words. Otherwise every vowel the words use, then consonants word by word in `rng` order, adding a word only when all its letters still fit in 16. `words` is then every word the chosen letters spell. So from short u on, a visit shows every vowel she knows and a rotating set of consonants, and every critter can make at least one real word. App passes `Math.random`, tests a seeded generator.

**Picture words = all 45, always** (CHANGE, Thomas 2026-10-22; replaces "Picture words = this list only", which popped only her current or mastered steps' words). A three-letter run pops its clip and picture exactly when it is in `CRITTER_PICTURE_WORDS`. The visit's letters spell only words in `critterSet(...).words`, so every picture word she can build pops.

**Real words that are not picture words** (D5 CHANGE, Dave 2026-10-20). With only the blending-sounds letters, Dave counted by hand, not exhaustively, cab, cap, gap, map, nap, tap, ham, bat, fat, mat, pat and tan: real words that the first draft gave the boing and the tumble. To a child the tumble says "that didn't work", whatever the line says, so it marked correct blending as a mistake. `CRITTER_REAL_WORDS` fixes that. Since Thomas 2026-10-22 Emma also says the word after the sounds, for the 156 on `CRITTER_SAID_WORDS` (one Lily clip each, `guide.play.critters.word.<w>`, § 3.3); no picture is generated or bought for them.

- **What is on it:** 220 three-letter words, each a consonant, a short vowel letter and a consonant from the 22 critter letters. I drew them on 2026-10-20 from the candidates that `/usr/share/dict/words` on this Mac gives for that letter pattern (461), kept the ones a 6-9 learner may meet, and added _has_, which that file lacks. All 45 picture words are on it, so are _gem_ (Dave: "includes gem") and Dave's twelve. Kevin pins the list exactly as printed here (C10).
- **Rude words sit on it, and are never said** (Dave left it to me; the never-say list is Dave's, 2026-10-22). `CRITTER_NEVER_SAY` is _bum_, _cum_, _fag_, _git_, _sex_, _tit_, _dam_ (sounds like "damn"), _hag_ (an insult), _god_ (an exclamation) and _gun_ (a weapon). The critters sing their letter sounds and the three sit, with no word, no boing, no tumble and no giggle: the plainest outcome there is, so building one earns nothing to come back for. Off the list, it would get the boing and Emma's giggle, the funniest outcome in the game, which would reward building it.
- **Words whose sounds don't spell them are not said** (Dave 2026-10-22). `CRITTER_NOT_SAID` is _gem_ and _gin_ (the g critter sings /g/, the word says /dʒ/, D6), _has_, _his_ and _was_ (s is /z/), _son_ and _won_ (o is /ʌ/), _put_ (u is /ʊ/), and _rum_ (an adult drink). They are real words, so they sing and sit like the never-say words: saying them after the critters' sounds would contradict the sounds. Dave kept _fat_, _but_, _pus_, _hex_, _sin_, _nip_, _pig_, _rob_, _hit_, _cut_, _pot_ and _bog_ as ordinary words.
- **What is said:** `CRITTER_SAID_WORDS`, the other 156 (220 = 45 + 10 + 9 + 156).

```
a (61): bad bag ban bat cab can cap cat dab dad dam fad fag fan fat fax gag gap gas had hag ham has hat jab
        jam lab lad lag lap lax mad man map mat nab nag nap pad pal pan pat ram ran rap rat sad sag sap sat
        sax tab tag tan tap tax van vat wag was wax
e (29): bed beg bet den fed gem get hem hen hex jet led leg let men met net peg pen pet red set sex ten vet
        vex web wed wet
i (47): bib bid big bin bit dig dim din dip fib fig fin fit fix gig gin git hid him hip his hit jig lid lip
        lit mix nib nip pig pin pit rib rid rig rim rip sin sip sit six tin tip tit wig win wit
o (39): bob bog box cob cod cog cop cot dog dot fog fox god got hob hog hop hot job jog jot lob log lot mob
        mop nod not pod pop pot rob rod rot sob son top tot won
u (44): bud bug bum bun bus but cub cum cup cut dud dug fun gum gun gut hub hug hum hut jug jut lug mud mug
        mum nun nut pub pug pun pup pus put rub rug rum run rut sub sum sun tub tug
```

**Order:** `critterRun` checks the picture words first (all 45 are on the real list too), then the real list: a real word on `CRITTER_NEVER_SAY` or `CRITTER_NOT_SAID` is `'quiet'`, any other is `'word'`. Only a run on neither list is `'funny'`.

### 3.2 The scene

The scene fills `A` (§ 1.7). From the top: **the log** (a bench with 3 seats), then **the meadow** (one burrow per letter, with its critter sitting in it). The block is centred vertically in `A`.

**A critter.** A round body of size `c`, flat-filled: consonants in Word Song honey (`#f2c27a`) with a 2 pt ledge `#b27b37` under them; vowels in pink (`#FFC0CB`, `colors.myPink`) with a `#F48FB1` (`colors.myRose`) ledge. Two eyes (white discs of 0.18 c with `#3d2112` pupils of 0.08 c) in the top third, two small feet in the ledge colour. The letter, lower case as the lessons print words, in Fredoka 700 at 0.5 c, `#6b3f1f`, on its belly: 5.4 : 1 on honey, 5.8 : 1 on pink (WCAG ratios computed from the hex values, 2026-10-20). Drawn with react-native-svg; no art to buy.

**The meadow.** A grid in the visit's letter order (vowels first, then consonants alphabetically), `perRow = floor((A.width + g) / (c + g))`, centred. Each cell is a burrow (a dark oval at the cell's foot) with its critter.

**The log.** A wood log (Number Garden wood) under 3 seats of `1.25 c`, `g` apart. Its band is `1.25 c + 16` tall; its width `3 × 1.25c + 2g + 32`, centred.

**The picture** (when a word pops): the pack picture on the Word Song picture card (`WordStage`'s card, white, rounded), size `p = min(meadow height, meadow width, 200 phone / 300 tablet)`, centred over the meadow.

**Sizes and fit with 16 critters** (hand-computed from § 1.7's `A`; AC N14 pins them):

| Device     | c   | g   | Per row | Rows | Meadow | Log band | Total (+ g) | `A` height | Log width | p   |
| ---------- | --- | --- | ------- | ---- | ------ | -------- | ----------- | ---------- | --------- | --- |
| 375 × 667  | 56  | 8   | 5       | 4    | 248    | 86       | 342         | 376        | 258       | 200 |
| 667 × 375  | 48  | 8   | 8       | 2    | 104    | 76       | 188         | 216.4      | 228       | 104 |
| 820 × 1180 | 88  | 16  | 7       | 3    | 296    | 126      | 438         | 685.2      | 394       | 296 |
| 1180 × 820 | 88  | 16  | 8       | 2    | 192    | 126      | 334         | 537        | 394       | 192 |

Every meadow critter is at least 48 pt and every seat at least 60 pt.

### 3.3 Moves

- **Tap a meadow critter:** it sings its own sound (§ 3.4) and hops (0.15 c, 250 ms). That is all: no line, no judgement.
- **Drag a meadow critter:** it lifts out of its burrow, and a twin pops up in the burrow at once (scale 0 → 1, 200 ms), so every letter stays on the meadow and a word may use a letter twice (dad, bib). Dropped on a seat (the seat grown by 0.2 c), it sits there and grows to 1.25 c (spring 300 / 22). Dropped on an occupied seat, it sits and the one there hops home into its burrow. Dropped anywhere else, it shrinks back into its burrow (200 ms).
- **Drag a seated critter:** onto another seat, the two swap; anywhere off the log, it hops home.
- **Tap a seated critter:** it sings its own sound.
- **Tap the log** (not a critter): the run on it sings again.
- **When they sing:** 400 ms after the last seat change, with no drag in progress, if the seated critters form one unbroken run of 2 or 3 (seats 1-2, 2-3 or 1-2-3). Seats 1 and 3 with an empty middle are not a run: they wait.

**A picture word** (3 seated, `critterRun` gives `'picture'`):

| t (ms, clip time)     | What happens                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0                     | The word's whole blend clip plays from its start ("f - a - n ... fan"). Meadow taps close until the picture leaves; Back stays live.                                                                                                             |
| `segments[k][0]` − 40 | Critter k (k = 0, 1, 2) bounces (0.15 c, 250 ms) and its letter lights with the lit pulse (1 → 1.2 → 1, 400 ms), as the lesson's letter row lights on the same marks (`litAt`, `MARK_LEAD_MS` = 40, `mobile/src/audio/blendMarks.ts:25`, `:44`). |
| `segments[3][0]` − 40 | The word: all three bounce together. The picture springs up over the meadow (the shipped entrance, scale 0 → 1 on a 260 / 16 spring with a 150 ms fade, `real-blending.md` § 5). Sparkle (0.55). Emma `celebration`.                             |
| clip end + 2400       | The picture floats up 0.3 p and fades (500 ms). The critters stay seated. Emma `idle`. Meadow taps open.                                                                                                                                         |

No Emma line: the clip already says the word, and the picture says the rest.

**Any other run** (2 seated, or 3 that are not a picture word): each critter, left to right, sings its own sound (§ 3.4) and bounces as it starts. The next one starts 300 ms after the one before ends, the rhythm of the blend clips, which leave at least 300 ms of silence between sounds (`blendMarks.ts` header). Emma `listening` while they sing.

- **Two critters:** that is all. They lean toward each other and wait for a friend. No line.
- **Three that make a said word** (`'word'`, CHANGE, Thomas 2026-10-22): 300 ms after the last sound (at least the 300 ms gap the blend clips leave, `blendMarks.ts` header; Dave's safeguard 1), Emma says the word, its `critterWordLine(word)` clip ("Map.", Lily, plain falling intonation), and the three bounce together once (0.15 c, 250 ms) as it starts, then sit, leaning in. No praise line, no sparkle, no picture, no boing, no tumble (Dave's safeguard 2). Emma `listening` while she says it, then `idle`. It does not count toward the two giggle lines.
- **Three that make a quiet word** (`'quiet'`, on `CRITTER_NEVER_SAY` or `CRITTER_NOT_SAID`; D5 as before): 300 ms after the last sound, the three bounce together once (0.15 c, 250 ms) and sit, leaning in. No word, no boing, no tumble, no line, no picture, no sparkle. Emma goes back to `idle` (Dave's safeguard 3).
- **Three that are not a word** (`'funny'`): 300 ms after the last sound, `sfx-boing`, and the three tumble (rotate −12° → +12° → 0 with a 0.1 c drop, 500 ms) and sit back up. Emma `cheering` and a giggle line, `guide.play.critters.funny.1`, "Hee hee! What a funny song!", then `funny.2`, "Ha ha! Silly sounds!", alternating. **At most two giggle lines in a visit;** after that the boing and the tumble play alone, so Emma never nags.

**Open and leave.** At the start, 300 ms after the fade-in, Emma (`listening`) says `guide.play.critters.open`, "Join the letters! Hear them sing!". A critter tap or drag during the line cuts it (`cancelActive()`). Letter critters is a toy: it has no rounds and no end of its own. She leaves with Back (§ 1.4), and the Play place returns silently.

### 3.4 Which sounds, and which clips (audio)

Every sound the critters make comes from the project's tuned Word Song blend clips. Nothing is rendered for this game.

- **The clips exist:** 46 Lily blend clips, "<g1> - <g2> - <g3> ... <word>", each three sounds with at least 300 ms of silence between them, then the word. Their marks are measured (`BLEND_MARKS`, 46 entries; `mobile/scripts/export-assets.mjs:308` measures them from the canon). They are the clips the lessons play: cvc words' 8 short-a clips (ear-approved, `real-blending.md` § 7), real blending's 6 new ones, and short o, u, i and e's 32. They come from ElevenLabs Lily through `renderElevenLabsBlend` with the per-grapheme IPA map `BLEND_GRAPHEME_IPA` (`api/_tts_elevenlabs.ts:126`, `:81`), which is how the project tuned its phonemes for Lily. The older Azure per-class phoneme SSML map is not used (`real-blending.md` § 7). `.claude/docs/audio-system.md:12` records why isolated phonemes needed care at all: an earlier voice mangled isolated short vowels.
- **A word plays its own clip, whole** (the table in § 3.3).
- **A letter alone** plays the shipped tap-to-hear window of one segment, `letterWindow(seg)` (30 ms before to 80 ms after, `blendMarks.ts:100`), the same window a lesson plays when a learner taps a letter (`WordSong.tsx` `onLetterPress`). Which segment is fixed per letter by `CRITTER_SOUND_SOURCE`: consonants from the first word (alphabetically) that starts with them, vowels from the first word that has them in the middle, and the two letters that start no word from the end of their first word:

| Letters | Source (word, sound)                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Vowels  | a: bag 2nd; e: bed 2nd; i: bib 2nd; o: box 2nd; u: bug 2nd                                                                                  |
| Onsets  | b: bag; c: can; d: dad; f: fan; h: hat; j: jam; l: leg; m: man; n: net; p: pan; r: rug; s: sip; t: tag; v: van; w: web (each the 1st sound) |
| Endings | g: bag 3rd (/g/; gem is left out so g never sings /dʒ/, D6); x: box 3rd (/ks/)                                                              |

Derived on 2026-10-20 from § 3.1's 45 words; `CRITTER_SOUND_SOURCE` is computed by that rule and pinned by AC C6.

- **New audio: none for the sounds.** The only new clips are the 18 Lily lines (§ 4.1) and the two sound effects (§ 5.3).
- **The clips must be in the app.** Today a blend clip reaches the device only inside a session's server plan (`mobile/src/audio/sessionAudio.ts`), and a game makes no network call. So `mobile/scripts/export-audio.mjs` (not `export-assets`: K1, Kevin 2026-10-20) also writes each canon blend clip to `mobile/assets/audio/blend/<word>.mp3`, registered in `audioRegistry.ts` as `/native/blend/<word>.mp3`. It must be `export-audio`: that script owns `audioRegistry.ts` and rewrites it whole (`export-audio.mjs:84`), and the render commit runs it (§ 7), so entries written by `export-assets` would be wiped. It decodes `u.audio.base64` exactly as `export-assets.mjs:333-334` does, so the bytes match the measured marks by construction. Canon has 46 distinct blend texts, one per `BLEND_MARKS` entry: 1,190,280 bytes in all (Kevin's sum). `mobile/assets` grows from 21.64 to 22.83 MB (+5.5 %), its audio from 12.49 to 13.62 MB; the repo has no size budget. `audioRegistry.test.ts:64-80` and `:82-89` compare the registry against `public/`, where these files do not exist, so both must leave out `/native/blend/` keys; N15 covers the blend clips instead.
- **Playing a bundled clip** (K2, Kevin 2026-10-20). `engine.createPlayer` already takes `PlayerSource = number | { uri }` (`playerPort.ts:50-52`). The seam: `TapClipPlayer.play`'s `uri` widens to `string | number` (`tapClip.ts:28`, `:42`, `:69-72`), and a number (a `require()`d module) is passed through as is. A `require()`d module has no byte length at run time, so `blendMarksFor(text, bytes)` (`blendMarks.ts:30-37`) cannot run its byte check on a bundled clip. The game reads the clip's marks straight from `BLEND_MARKS` by its text, and N15 is the guarantee that the bundled bytes are the measured ones.

### 3.5 Words and what Emma never says

- **Emma never says "not a word"** and never says a made-up run. Dave's "Tup? That's not a word! Tup, tup!" would need a render per non-word.
- **A real word is never a mistake** (D5). A real CVC word that is not a picture word ("sat", "hop", "map") sings its sounds and Emma says it, or, on Dave's lists, sits (§ 3.3): it gets no boing, no tumble and no giggle. Only runs that are not words get those, and "What a funny song!" and "Silly sounds!" are said only of them.
- **A run is spoken as a word only if it is a picture word (its blend clip) or on `CRITTER_SAID_WORDS`** (CHANGE, Thomas 2026-10-22). A word on `CRITTER_NEVER_SAY` (rude words and the like) or `CRITTER_NOT_SAID` (sounds that don't spell it) is never said back to her, and it gets the quiet sit, not the giggle (§ 3.1).
- **Pictures** appear only for the 45 picture words, from the shipped pack; a said word has none.

### 3.6 Wireframes (phone portrait, "fan" just popped; phone landscape, two seated)

```
PHONE PORTRAIT  375×667                     PHONE LANDSCAPE  667×375
+-------------------------------------+     +-------------------------------------------------------------+
| (<)                                 |     | (<)      |                                                  |
|  .-----.  +-----------------------+ |     |  .----.  | +----------------------------------------------+ |
| ( Emma  ) |                       | |     | ( Emma ) | |                                              | |
| (celeb- ) |                       | |     | ( list-) | +----------------------------------------------+ |
| (ration ) +-----------------------+ |     | ( ening) |        (f)  (a)   [   ]   <- the log, 228 wide |
|  '-----'                            |     |  '----'  |       =====================                     |
|       (f)    (a)    (n)    <- seats |     |          |  (a)(b)(c)(f)(g)(h)(m)(n)                       |
|      ========================= log  |     |          |  (p)(t)(v)                                      |
|   +-----------------------------+   |     +-------------------------------------------------------------+
|   |        +-------------+      |   |       c 48; 11 critters for a learner on blending sounds;
|   |        |    {fan}    |      |   |       f and a sang "f... a" and lean together, waiting
|   |        |     200     |      |   |
|   |        +-------------+      |   |
|   |  (a) (b) (c) (f) (g)        |   |
|   |  (h) (m) (n) (p) (t)  (v)   |   |
|   +-----------------------------+   |
+-------------------------------------+
  seats 70; c 56; the picture pops over the meadow for the clip and 2.4 s after it
  (x) a letter critter (vowels pink, consonants honey)   {fan} the pack picture
```

### 3.7 Reduce Motion

- **Singing:** no bounce. The singing critter's letter lights (a 120 ms fade in, 200 ms out, no pulse), as the lesson's spotlight does under Reduce Motion (`real-blending.md` § 5).
- **Seat and home moves:** a 150 ms fade, no spring. The burrow's twin appears without the scale.
- **A word:** the picture fades in over 200 ms (the shipped Reduce Motion entrance) and fades out over 300 ms.
- **A real word:** no bounce; the three sit still. Nothing else plays.
- **Not a word:** no tumble; the three dim (1 → 0.6 → 1, 300 ms). The boing and the line play.
- **Dragging** still follows the finger.

### 3.8 Accessibility

- A meadow critter: `accessibilityRole="button"`, label "Letter <x>"; activate seats it in the first free seat (if the log is full, it sings its sound). A custom action "Hear" plays its sound.
- A seated critter: label "Letter <x>, on the log"; activate sends it home.
- The log: label "Log"; activate sings the run again.
- Touch targets: meadow critters 48-88 pt, seats 60-110 pt.

---

## 4. Copy / TTS script

### 4.1 Every line the Play place speaks

All lines are Lily, as `GUIDANCE_LINES` rows (`packages/core/src/emmasPath/guidanceLines.ts`) with a new kind `'play'` in `GuidanceLineKind` (`:38-66`), `world: null`, and `src = pathLineSrc(id)`, so the files are `/assets/audio/path/guide-play-*.mp3`. Native plays them through `mobile/src/screens/play/playLines.ts`, the flower bed's `gameLines.ts` pattern (one manifest line player with word ticks). `<N>` is a capitalised number word.

| Id                                                 | Caption text (= Lily input unless noted)                   | When                                         | Lines   | Chars         |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ------- | ------------- |
| `guide.play.open`                                  | "What shall we play?"                                      | The Play place, entered from the Hub         | 1       | 19            |
| `guide.play.raft.open`                             | "The raft can carry ten!"                                  | Raft: the start                              | 1       | 23            |
| `guide.play.raft.total.<t>`, t 1-9                 | "<N>!" (input "<N>,", § 4.3)                               | Raft: the total after a boarding or take-off | 9       | 45            |
| `guide.play.raft.go`                               | "Ten! Off we go!"                                          | Raft: exactly ten                            | 1       | 15            |
| `guide.play.raft.splash`                           | "Too heavy!" (was "Too heavy! Splash!", Thomas 2026-10-22) | Raft: too heavy                              | 1       | 10            |
| `guide.play.raft.silly`                            | "Hee hee! Silly animals!"                                  | Raft: the silly scene                        | 1       | 23            |
| `guide.play.raft.close`                            | "What a party on the island!"                              | Raft: after the third crossing               | 1       | 27            |
| `guide.play.critters.open`                         | "Join the letters! Hear them sing!"                        | Critters: the start                          | 1       | 33            |
| `guide.play.critters.funny.1`                      | "Hee hee! What a funny song!"                              | Critters: three that are not a word          | 1       | 27            |
| `guide.play.critters.funny.2`                      | "Ha ha! Silly sounds!"                                     | Critters: the next one                       | 1       | 20            |
| `guide.play.critters.word.<w>`, kind `'play-word'` | "<W>." (input "<W>,", § 4.3), w in `CRITTER_SAID_WORDS`    | Critters: a said word (Thomas 2026-10-22)    | 156     | 624 (input)   |
| **Total**                                          |                                                            |                                              | **174** | **242 + 624** |

The raft's open line plays 300 ms after the game fades in, as the critters' does. The raft's total lines are its only content lines; the critters' content is the shipped blend clips (§ 3.4).

**All 18 are new renders, 250 characters.** How it was counted: a scratch script (2026-10-20, not committed) compared each text, as an exact string, with every `text` in `public/canon/**/*.json`, every `GUIDANCE_LINES` text and input, and every `PATH_LINES` text, on `main` at f1be571f (1,343 canon texts, 336 guidance lines, 851 path lines). None matched. The app has no standalone number-word clip: the nearest are "Seven flowers." and the like.

**Budget:** about 250 characters. `renderGuidanceLinesLily.ts --dry-run` prints the real number before any spend. The one-word inputs ("Seven,") are the same length as their captions. Kevin (K3): the dry run bills only uncached unique inputs (`renderGuidanceLinesLily.ts:88-94`), so expect 250 when the tools worktree's cache holds the 336 shipped inputs; a dry run well above 250 means shipped lines would re-render, so stop there. D5's real-word list is text only and adds no render, and D4's newcomer has no line: the budget is unchanged.

### 4.2 Labels nobody speaks (VoiceOver only)

| Element              | Label                                          |
| -------------------- | ---------------------------------------------- |
| `hub-play`           | "Play"                                         |
| `play-home`          | "Home"                                         |
| `play-tile-raft`     | "Raft crossing"                                |
| `play-tile-critters` | "Letter critters"                              |
| `play-game-back`     | "Back"                                         |
| A raft animal        | "<Animal>, <weight>" ("Dog, seven")            |
| The raft             | "Raft, <total>"                                |
| A critter            | "Letter <x>"; seated: "Letter <x>, on the log" |
| The log              | "Log"                                          |

They sit in `playLines.ts` beside the spoken rows, so a language version swaps rows, not screens.

### 4.3 Render inputs and words

- **The one-word rule** (`.claude/docs/audio-system.md:65`; a one-word clip goes to Lily as "Word," because "Sat." came back as "Saturday"): the nine total lines carry `input: "<N>,"` (`GuidanceLine.input`), and so do the 156 said words ("Map,"; Thomas 2026-10-22). _six_'s input "Six," is the raft total's, so it reuses that render.
- **New spoken words** (checked by the same script against every shipped text): _shall_, _raft_, _carry_, _off_, _too_, _heavy_, _splash_, _hee_, _silly_, _animals_, _party_, _island_, _join_, _them_, _sing_, _funny_, _ha_. Common words, except _raft_ and _splash_, which the picture shows.
- **No line** mentions speed, "fast", "again", "next", "more", "round", "win" or "not a word" (AC C8).
- **Danish version:** each row is one language row. The raft's content is the number words; the critters' sounds are the language's own blend clips, so a Danish version needs its own clips and word list, not new screens.

### 4.4 Prediction for the ear test (Predict-Before-Soak)

- "Hee hee! Silly animals!" and "Hee hee! What a funny song!": Lily will **read** "hee hee" as two words, /hiː hiː/, not laugh. If Thomas wants a real giggle, it is a sound effect, not a line (T3).
- The total lines, from "One," and "Seven,", come back as single, falling, stand-alone number words, each under 1 s, with no "and" and no rising tone.
- "What shall we play?" rises on _play_. _Shall_ is the weak /ʃəl/.
- "Too heavy!" (re-rendered 2026-10-22 without "Splash!"): the line stays under the 3.5 s flag (`LONG_SECONDS`, `scripts/renderGuidanceLinesLily.ts:39`), as every line here does.
- "What a party on the island!": British, non-rhotic _party_ (/ˈpɑːti/), and _island_ with a silent s.

**Bounded convergence:** I rendered and ear-tested nothing, and I played no blend clip for this spec. The 46 clips are reused as the lessons ship them; **not tested:** how a coda g (from "bag") or x (from "box") sounds when it sings alone at the start of a made-up run, and whether two sliced sounds in a row feel like one critter song or two separate taps. The device check V8 covers both.

---

## 5. Reused vs new

### 5.1 Code

| Reused (file)                                                                                     | New                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentStepOf` and the flower bed's open rule (`hubCardModel.ts`, `miniGames.ts:37`)             | `packages/core/src/games/playPlace.ts`: § 1.1, § 2.1, § 3.1                                                                                 |
| `hubLayout` (Emma, light, bubble, card boxes), `HubBackdrop`, `HubBubble`                         | `playPlaceLayout.ts`; `HubLayout.play`; the Play disc on the Hub                                                                            |
| `HomeButton` and its press (`mapChrome.tsx:32`), `LOOK` clay (`MapButton.tsx:23-34`)              | `PlayPlace.tsx` (tiles, Home), `PlayGameScreen.tsx` (the frame)                                                                             |
| `mathLayout` (back disc, Emma, ribbon, problem + chip regions)                                    | `RaftCrossing.tsx`: shore, water, island, raft, oar, flag, splash, scenes (drawn, SVG)                                                      |
| `EmmaStage` and its poses, incl. the shipped `waving` (`emmaPose.ts:24-32`)                       | `LetterCritters.tsx`: critters, burrows, log, seats (drawn, SVG)                                                                            |
| `CaptionRibbon`, `createManifestLinePlayer`, `createSfx`                                          | `playLines.ts` (18 rows + labels); `'play-place'` and `'play-game'` routes                                                                  |
| Pack pictures: 9 animals, 45 words (`mobile/assets/pictures/`)                                    | Bundled blend clips: `export-audio` writes 46 MP3s (1.19 MB) + `audioRegistry` entries; `audioRegistry.test.ts` leaves out `/native/blend/` |
| Blend marks and windows: `BLEND_MARKS`, `litAt`, `letterWindow`, `MARK_LEAD_MS` (`blendMarks.ts`) | `CRITTER_SOUND_SOURCE`, `CRITTER_REAL_WORDS`; the sound-song sequencer (§ 3.3)                                                              |
| The tap clip player (`createTapClipPlayer`, `mobile/src/audio/tapClip.ts:40`)                     | Its `uri` widened to `string \| number` (K2); drag with gesture handler + Reanimated (§ 1.7)                                                |
| Word Song's picture card and its entrance (`WordStage`, `TapTarget`)                              | `PICKER_RETURN_ROUTES` + `'play-place'`                                                                                                     |
| The clay pipeline (`scripts/generatePackPictures.ts`, `scripts/build-path-art.ts`)                | 3 clay pieces (§ 5.2); 2 sound effects (§ 5.3)                                                                                              |

### 5.2 Art: three clay pieces (T2)

Made with the pack generator in its clay style, as `ui-flower-bed` was (`mini-game-flower-bed.md` § 1.2.1; `style: "clay"`, `scripts/packPictureLib.ts`), one manifest row each in a one-batch manifest passed with `--manifest`. Pictures only: no digits, letters or signs. **Two variants of each: 6 images, about $0.48** at the flower bed's measured rate (2 variants for about $0.16). `--dry-run` prints the real figure before any call. Thomas picks one of each on the contact sheet. The batch number is the next free one when the run happens (the flower bed took 16).

| Id            | Subject                                                                                                                                                                                            | Must not look like                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-play`     | A small open toy box in warm honey-yellow wood with a rounded lid tipped back, a ball striped honey and pink and a little wooden boat peeking over its rim, seen from the front and a little above | the house (`ui-house`), the map (`ui-map`), the flower bed (`ui-flower-bed`), a gift box with a bow (`gift`), a padlock, a treasure chest with coins |
| `ui-raft`     | A small wooden raft of five round logs tied with rope, with a short mast and a blank cream flag, floating on a little patch of blue water, a duck and a frog sitting on it                         | a boat with a hull or sail (`boat`), the flower bed, the egg tray (`add-to-20`), anything with a number                                              |
| `ui-critters` | Three small round friendly creatures, one honey-yellow, one pink, one honey-yellow, sitting side by side on a short wooden log, each with big eyes and tiny feet, mouths open in song              | the bee (`bee-words`), the snail (`snail-words`), a caterpillar, letters or musical notes, a face on the log                                         |

`avoid` rows (the generator's "Must not look like") follow the flower bed's: no red, no text or signs, no coloured disc behind. Into the app as `ui-flower-bed` went: `yarn path-art`, then `npm run export-assets`; `UiArtId` and `PATH_ART_SET` gain the three ids (`packages/core/src/emmasPath/pathArt.ts`), and `pathArt.test.ts` fails until the files exist.

**Everything else is $0:** the nine animals are shipped pack pictures; the raft, water, island, critters, log and burrows are drawn in the app.

### 5.3 Sound effects (T5)

Two new effects beside the five shipped ones (`mobile/assets/audio/sfx/`):

| Id           | Where                                 | Brief                                                                                      |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `sfx-splash` | Raft: too heavy; the cannonball scene | A small, bright water splash, under 700 ms. Not a crash, nothing that sounds like failing. |
| `sfx-boing`  | Critters: three that are not a word   | A soft cartoon boing or slide-whistle wobble, under 600 ms. Funny, never a buzzer.         |

The shipped effects came from Thomas's own sourcing (`design/screen-3-math.md:259`: "Asset blocked on Thomas"). The same holds here. **Cost: unknown;** I did not price a source. Until they land, `createSfx` warns once and plays nothing (`mobile/src/audio/sfx.ts`), so the build does not wait for them.

---

## 6. Acceptance criteria

### 6.1 Core (vitest, `packages/core`)

1. **C1.** `openPlayGames(p)` returns `['raft']` for the default profile (`packages/core/src/progress/defaults.ts:174-221`: adding to ten and letter sounds both current, blending sounds not yet); `['raft', 'critters']` once letter sounds is mastered (blending sounds current) and once both games' steps are mastered; `['critters']` with numbers not mastered and blending sounds current; and `[]` for `null` and for a profile on numbers and letter sounds.
2. **C2.** Over 1,000 seeds, `raftShore(rng)` returns 6 weights in 1-9 with at least 2 loads and at least one 2-animal load; the same seed gives the same shore. `raftRefill` keeps the waiting weights in order and returns a 6 with the same guarantee, over 1,000 seeds and random waiting sets of 2-5.
3. **C3.** `raftLoads([7, 3, 6, 4, 8, 2])` is exactly the three pairs. `raftStuck([2, 5, 7, 9], 6)` is true (no set makes 4); `raftStuck([2, 5, 7, 9], 5)` is false (the 5); `raftStuck([1, 3, 5, 9], 6)` is false (1 + 3); `raftStuck(w, 0)` and `raftStuck(w, 10)` are false for any `w`.
4. **C4.** `CRITTER_WORDS_BY_STEP` equals, step by step, the `word.p*.blend` words of `public/canon/word-song/level-1/<step>.json`, minus `CRITTER_LEFT_OUT`. Every word has a `BLEND_MARKS` key, "<g1> - <g2> - <g3> ... <word>" (checked in N15, where the generated file lives).
5. **C5.** `CRITTER_PICTURE_WORDS` is all 45 words, for every learner (Thomas 2026-10-22; `critterWords` and its step gate are gone); the step table still gives § 3.1's counts (8, 14, 22, 30, 38, 45). `critterSet` returns at most 16 letters, every vowel the words use, only words its letters spell, and at least 1 word per consonant, over 1,000 seeds; with 16 letters or fewer it returns them all.
6. **C6.** `CRITTER_SOUND_SOURCE` follows § 3.4's rule and equals its table. Every source word is in the 45 and the index points at that letter.
7. **C7.** `GUIDANCE_LINES` has 354 lines (336 today, `guidanceLines.test.ts:63`). The test's per-kind count map gains `play: 18` beside `game: 30` (`:61`), and its totals become 354 ids, 349 texts and 354 srcs (`:63-69`; 336 / 331 / 336 today; K3, Kevin 2026-10-20). The 336 shipped lines are unchanged in id, kind, text and src. The 18 `guide.play.*` lines have kind `'play'`, § 4.1's texts (250 characters in all) and `src = pathLineSrc(id)`; only the nine total lines carry an input, "<N>,". `public/voice-qa.html`'s `GUIDANCE_FILES` mirrors them (the existing drift guard, `guidanceLines.test.ts:424`). After the render commit, `GUIDANCE_LINES_AWAITING_RENDER` is `[]`.
8. **C8.** No `guide.play.*` text contains "again", "next", "more", "round", "win", "fast" or "not a word".
9. **C9.** `Route` has `'play-place'` and `'play-game'`, and not `'play'` (K5). Lands in PR 2 with N3 (§ 7).
10. **C10.** `CRITTER_REAL_WORDS` is exactly § 3.1's 220 words (61 a, 29 e, 47 i, 39 o, 44 u), each three letters from the 22 critter letters with a vowel in the middle; it holds all 45 picture words and _gem_. `CRITTER_PICTURE_WORDS` is all 45 for every learner, with no step-gated word list (Thomas 2026-10-22). `CRITTER_NEVER_SAY` and `CRITTER_NOT_SAID` are Dave's 10 and 9 (§ 3.1), real words, no picture word, disjoint; `CRITTER_SAID_WORDS` is the other 156, sorted, each with a `critterWordLine` (kind `'play-word'`, "<W>." / "<W>,", rendered and bundled). `critterRun` gives `'picture'` for all 45, `'word'` for a said word (_map_, _cab_, _ham_, _sat_, _hop_), `'quiet'` for one on either list, and `'funny'` otherwise (_tup_, _baf_).

### 6.2 Native (jest, `mobile`)

10. **N1.** `hubLayout(v).play` equals § 1.2's rect on 375×667, 667×375, 820×1180 (t24 b20) and 1180×820 (b20), and intersects neither card (with its crown room), the bubble nor the badge.
11. **N2.** The Hub renders `hub-play` exactly when `openPlayGames(progress)` is non-empty. It has no glow, bob, badge or animation. A tap plinks, cuts Emma's line and calls `onOpenPlay` once; a 3 s hold starting on it does not open Parent Settings. No Hub line changes.
12. **N3.** `ROUTE_EXITS`: `hub` includes `'play-place'`; `'play-place'` is `['hub', 'play-game', 'picker']`; `'play-game'` is `['play-place']`; no other route lists either. `ROUTE_LABELS` has both. `layoutForRoute('play-game')` is `mathLayout`. `PICKER_RETURN_ROUTES` has `'play-place'` and not `'play-game'`.
13. **N4.** The Play place shows one tile per open game at § 1.3's rects (one game: centred), the Home disc at the Map's Home rect, and Emma at the Hub's frame. From the Hub it plays `guide.play.open`; back from a game it plays nothing.
14. **N5.** On an in-memory store (the `App.peek.test.tsx` pattern), a full raft trip and a critters visit with a word, a non-word and a pair each make zero key-value writes. Progress, session history and stardust are byte-identical, and `fetch` is never called.
15. **N6.** N5 also holds for Back mid-drag, Back mid-crossing, Back while a word's picture shows, and a background and return mid-crossing.
16. **N7.** Raft, with fake audio and a seeded shore: a tap or a drop boards an animal; the flag and `total.<t>` follow every board and take-off; a total line cuts the one before it. A drop that would pass 10: the newest animal leaves the deck, `sfx-splash` and `raft.splash` play, the total and flag keep the old load, and the animal is back on its spot and draggable. Drops are refused while the raft wobbles.
17. **N7a** (D4). Raft, with a test shore set stuck (e.g. a 6 aboard, waiting 2, 5, 7, 9, 9: no set makes 4): after the first splash no newcomer comes; after the second, `RAFT_ANIMALS[10 − total]` walks into the empty spot nearest the outer edge, with no line, no sound and no Emma pose other than `idle`; boarding it departs. A board or take-off between the two splashes resets the count, so no newcomer comes. A splash on a raft that is not stuck never brings one. With one animal aboard and its spot taken by the newcomer, taking that animal off sends the newcomer out and puts the animal on its own spot.
18. **N8.** Raft: exactly 10 → sparkle, `waving`, `raft.go`, boarding closed; arrival → the animals on the island, a scene not equal to the last one, `raft.silly`; crossings 1-2 → the raft back and the shore at 6; crossing 3 → `raft.close`, then the Play place with no line.
19. **N9.** Critters: three seated that spell a picture word play that word's bundled clip (a `require()`d module, through the widened `TapClipPlayer.play`, K2) from 0, timed by that text's `BLEND_MARKS` entry; critter k's bounce starts at `segments[k][0] − 40` and the picture mounts at `segments[3][0] − 40`; no line plays; meadow taps are closed until the picture leaves.
20. **N10.** Critters: a pair plays each letter's `letterWindow` of its `CRITTER_SOUND_SOURCE` segment, 300 ms apart, and nothing else. Three non-words: the same sounds, then `sfx-boing` and `funny.1`, then on the next `funny.2`; from the third on, no line. Three that make a said word (_map_, Thomas 2026-10-22): the same sounds, then, at least 300 ms after the last, the word's `critterWordLine` clip and one bounce together, and no `sfx-boing`, no tumble, no other line, no sparkle and no picture. Three that make a quiet word (_sex_, _was_): the same sounds, then one bounce together, and no word, no `sfx-boing`, no tumble, no line and no picture. Neither counts toward the two giggle lines. A picture word of any step (_dog_) pops for every learner.
21. **N11.** Critters: a drag leaves a twin in the burrow; a drop on an occupied seat sends the occupant home; seats 1 and 3 with 2 empty do not sing; a tap on the log replays the run.
22. **N12.** With Reduce Motion on (mocked), no wobble, bob, hop, scene, bounce or tumble starts; § 2.5's and § 3.7's fades run; the drag still follows the finger.
23. **N13.** The raft's bands, cells, deck and seats equal § 2.2's sizes on the four viewports, and nothing overlaps another part; a viewport change mid-trip keeps what is aboard, the crossing number and the island.
24. **N14.** The critters' `c`, rows, log and picture equal § 3.2's table on the four viewports with 16 critters, and everything lies inside `A`; a viewport change keeps who sits where.
25. **N15.** Every `BLEND_MARKS` entry has a bundled `/native/blend/<word>.mp3` whose byte length and content hash equal the entry's, so the marks the game reads from `BLEND_MARKS` are the bundled clip's (K1, K2). `audioRegistry.test.ts`'s two web-comparison tests (`:64-80`, `:82-89`) leave out `/native/blend/` keys and still pass for every other entry.
26. **N16** (two learners). Learner A on adding to ten and letter sounds sees the Play button with the raft only; learner B on numbers and letter names sees no Play button. A visit as A writes no key of either learner.
27. **N17.** VoiceOver: § 4.2's labels; activate boards and takes off an animal, and seats and sends home a critter.

### 6.3 Device (Jessica first; iPad portrait and landscape, phone portrait and landscape; Emma muted for local runs, per the project's silent-run rule)

27. **V1.** The Hub shows the Play button in the corner opposite the badge (in Emma's column on a phone in landscape). It reads as a button like the Map's Home, it is clearly not a world, and nothing announces it. A learner with no open game sees none.
28. **V2.** Play → the Play place: Emma stays where she was, says "What shall we play?", and two clay tiles sit at the bottom. No Map, no path, no stop anywhere.
29. **V3.** Raft: drag and tap both board; the flag and Emma say each total; the raft sits lower as it fills. Watch (D2, Dave): whether a learner new to adding to ten can read the numeral tags. Splash twice on a stuck raft: a newcomer walks on, unannounced (D4).
30. **V4.** Raft: too heavy → a funny wobble and a splash, "Too heavy!" and the splash sound, the animal paddles back and shakes. The others stay. No red, no X, no poof.
31. **V5.** Raft: exactly ten → Emma waves, "Ten! Off we go!", the raft rows to the island, a silly scene, then the raft comes back and newcomers walk on. After the third crossing, "What a party on the island!", then the Play place with no line and no "again".
32. **V6.** Critters: seat f, a, n → each critter bounces as its sound plays, then the word and the fan picture. Seat a non-word → sounds, a boing, a tumble, a giggle line (twice at most). Seat a real word that has no picture (m, a, p) → sounds, then Emma says "map" and the three sit together: no boing, no tumble, no giggle. Seat a never-say word (s, e, x) → sounds, then they sit, silent.
33. **V7.** Back from a game mid-move returns to the Play place at once, silently; Home returns to the Hub. The Hub's stardust is unchanged.
34. **V8.** Thomas's ear (T3): the 18 lines on the hosted voice-QA page from a preview URL or after a release (§ 7), and the critters' sliced sounds alone and in pairs on a device build that carries the bundled clips (§ 4.4's untested surface).
35. **V9.** Reduce Motion: fades only, same lines. Rotate mid-crossing and mid-word: everything lays out again and keeps its place. Lock the device mid-line for 10 s: the line resumes and the game waits.

**37 criteria:** 10 core, 18 native (N7a beside N7), 9 device.

---

## 7. Build split

Two PRs, in order (Pattern A: the core names land first, so the UI builds on merged names). Kevin reviews Devon's PR and Devon reviews Kevin's (the routing rule).

**PR 1: Kevin, core and audio assets** (branch `kevin/play-place-core`, size S-M):

1. `packages/core/src/games/playPlace.ts` with its vitest (C1-C6, C10), exactly the names of § 1.1, § 2.1 and § 3.1, `raftStuck`, `CRITTER_REAL_WORDS` and `critterRun` included.
2. The 18 `guide.play.*` rows and the `'play'` kind in `guidanceLines.ts`, listed in `GUIDANCE_LINES_AWAITING_RENDER` until the render; `play: 18` and the 354 / 349 / 354 totals in `guidanceLines.test.ts`; the 18 `GUIDANCE_FILES` entries in `public/voice-qa.html`; C7, C8.
3. `mobile/scripts/export-audio.mjs` writes the 46 blend clips to `mobile/assets/audio/blend/` (decoded as `export-assets.mjs:333-334` does), and `audioRegistry.ts` gains their `/native/blend/<word>.mp3` entries; `audioRegistry.test.ts:64-80` and `:82-89` leave out `/native/blend/` keys; N15.
4. `TapClipPlayer.play`'s `uri` widened to `string | number` (`tapClip.ts`, K2), with its jest.
5. **Render commit**, in the tools worktree (`~/DEV/MarianLearning-tools`, which holds the keys and the cache): `npx tsx scripts/renderGuidanceLinesLily.ts --dry-run` (expect 250 characters; stop if it is well above, § 4.1), the render, `npm run export-audio` in `mobile/`, and `GUIDANCE_LINES_AWAITING_RENDER` back to `[]`, on the same branch.

**No `Route` change in PR 1** (build-split CHANGE, Kevin 2026-10-20). `ROUTE_EXITS` (`routes.ts:48`) and `ROUTE_LABELS` (`routes.ts:67`) are `Record<Route, …>`, so new `Route` members without their rows break the mobile typecheck (`mobile.yml:29`). Kevin offered two fixes: move C9 into PR 2, or have PR 1 add both `routes.ts` rows. **I pick moving C9 into PR 2:** the routes, their exits, labels, layout and return rule then land together in one PR with N3, PR 1 stays core and audio only, and no route exists before a screen does. Nothing in PR 1 names a route.

**PR 2: Devon, the native UI** (branch `devon/play-place`, after PR 1 merges, size M-L):

1. `'play-place'` and `'play-game'` in `Route` (C9), with their `routes.ts` exits and `ROUTE_LABELS` rows, `layoutForRoute`, `PICKER_RETURN_ROUTES`; N3. One commit, so the typecheck never sees half.
2. `HubLayout.play`, the Play disc on the Hub, Emma's press exclusion, `onOpenPlay`; N1, N2.
3. `playPlaceLayout.ts`, `PlayPlace.tsx`; N4.
4. `PlayGameScreen.tsx`, `RaftCrossing.tsx` (with the stuck newcomer), `LetterCritters.tsx`, `playLines.ts`, the drag layer, App wiring (the routes, `playPose`, the quiet return); N5-N14 with N7a, N16, N17.
5. The three clay pieces (after T2's pick) and the two effects (after T5) drop in when ready. The PR may merge without them only if the tiles and the Hub disc show a fallback (the tile's clay face alone) and `pathArt.test.ts` is not yet asked for the ids; otherwise it waits for them.

**Then:** the T3 ear test on the voice-QA page filtered to the new lines (`?filter=new`, count checked against the 18 rows), and the device check V1-V9.

- **The ear test needs a preview URL or a release** (Kevin 2026-10-20). The new `public/assets/audio/path/guide-play-*.mp3` files and the `voice-qa.html` rows are static web assets: they reach the hosted voice-QA page only through a PR preview build or a `yarn release`. The link sent to Thomas is the PR 1 preview's `/voice-qa.html?filter=new`, fetched from the PR, never guessed.
- **The device check needs a new EAS build:** the bundled blend clips and the UI reach the native app only in a build.
- **Nothing is server- or release-gated:** nothing in `/api` changes. The render imports `api/_tts_elevenlabs.ts` only as a local script, and the game makes no network call (N5).

**Out of scope:** the flower bed and its move (separate spec); a raft to 20; any toy state; a third game or the grouped shelf; a parent play limit (Thomas: not now); Leitner reads; a Danish version's clips.

---

## 8. Decisions for Thomas, Dave and Kevin

### 8.1 For Thomas (look, lines, spend)

- **T1 (look). The Play button, the Play place and the two scenes as drawn here:** a cream clay disc opposite the badge (§ 1.2); the Hub's backdrop with Emma where she was and two clay tiles in the card columns (§ 1.3); the raft scene drawn flat in the app's woods and honey with a new water blue (§ 2.2); the critters as round honey and pink creatures with their letter on the belly (§ 3.2). **Recommendation:** approve, and judge at device check V1, V2, V3 and V6.
- **T2 (spend, about $0.48). Three clay pieces, `ui-play`, `ui-raft` and `ui-critters`, two variants each** (§ 5.2). **Recommendation:** generate all six in one run and pick on one contact sheet. The animals reuse the pack ($0).
- **T3 (lines, about 250 Lily characters). The 18 lines of § 4.1.** **Recommendation:** approve the texts and judge them at the ear test, on PR 1's preview voice-QA page (a preview URL or a release is needed, § 7). If "Hee hee!" reads as words, not a giggle (§ 4.4), keep the lines and let the boing carry the laugh. Dave's D4 and D5 changes add no line and no render: the spend is unchanged.
- **T4 (look). Emma and the raft.** Your pick said "Emma rows to an island". In this build Emma waves the raft off from her place (the shipped `waving` pose) while the raft's oar rows by itself (§ 2.3). A rowing Emma on the raft is new Emma art in her manhwa style, and I have not costed it. **Recommendation:** ship the wave now, and decide on a rowing Emma after Marian has played it.
- **T5 (spend). Two sound effects, a splash and a boing** (§ 5.3), sourced as the shipped five were. **Cost unknown.** **Recommendation:** source both before Devon's PR; it can merge before they land, silent in their place.
- **Watch (Dave, #620 § 4), not a decision.** The default profile opens the raft on day 1 (adding to ten is current from the start), which the rails allow ("open from the start"). Check, once learners have played, that lessons stay at least about 2/3 of app time. Nothing in this build measures it, because the games write nothing; it is a look at real use.

- **Play-place feedback (Thomas 2026-10-22), applied.** (1) Raft: "Too heavy! Splash!" becomes "Too heavy!"; the splash is a separate sound effect (T5) (§ 2.3, § 4.1, V4). (2) Letter critters: all 45 picture words pop with their picture for every learner (the step gate and "Picture words = this list only" are gone); the other real words are said whole by Emma after the sounds (156 Lily clips, no picture), except Dave's never-say and not-said lists, which sing and sit as before (Decision 6, § 3.1, § 3.3, § 3.5, C10, N10, V6). (3) Three letters stay. Spend: one render of about 630 Lily characters (155 words + "Too heavy!"; _six_ reuses the raft's "Six,"), priced by the dry run before the paid call. Core names (Kevin's PR): `CRITTER_PICTURE_WORDS`, `CRITTER_NEVER_SAY`, `CRITTER_NOT_SAID`, `CRITTER_SAID_WORDS`, `critterRun(run): CritterRun`, `critterWordLine(word)`.

### 8.2 For Dave (D-items, pedagogy): answered 2026-10-20

Dave read the spec at 3db94a08 (read-only) against his #647: 6 CONFIRM and 2 CHANGE, all kept rails pass, and neither game is a quiz in a frame. Both CHANGEs are applied.

- **D1. CONFIRM (2026-10-20).** Emma says the running total after every boarding ("Seven!"), and the flag shows it. Dave: the spoken total is the raft's state, like a scale reading, not the answer; she still picks the animal that fills the gap.
- **D2. CONFIRM numerals (2026-10-20).** Numerals on the animals, not dots, with size growing with weight. Dave: the lesson's add-to-10 uses numerals, and size is a fine extra cue. His watch item, whether a learner new to adding to ten can read the tags, is on V3.
- **D3. CONFIRM (2026-10-20).** Three-animal loads (1 + 2 + 7) are allowed. Dave: they give agency, "many right ways" (Ryan et al. 2006; Patall et al. 2008), and are never required, since every shore has a pair.
- **D4. CHANGE (2026-10-20), applied.** Dave: keep no Emma hint, but a stuck raft is a dead end, not playful failure: every splash is the same, and nothing shows that taking one off is the way out. Now: after two splashes in a row on a stuck raft, a newcomer of exactly the missing weight walks into an empty shore spot with the refill walk-in, with no line and no pointing (§ 2.1 `raftStuck`, § 2.3, § 2.5, AC N7a beside N7, V3). The trigger count is Dave's reasoning.
- **D5. CHANGE (2026-10-20), applied.** Dave: real words such as _map_ got the boing and the tumble, which marks correct blending as a mistake. Now: the text-only list `CRITTER_REAL_WORDS` (220 words, no clips, no pictures, _gem_ included); a 3-run on it that is not a picture word sings its sounds, then the three bounce together and sit, with no boing, no tumble and no line. The boing, tumble and giggle are only for non-words (Decision 6, § 3.1, § 3.3, § 3.5, § 3.7, C10, N10, V6). **Rude words: I put them on the list** (§ 3.1), so building one gets the plainest outcome and never the giggle. Spend unchanged: text only.
- **D6. CONFIRM (2026-10-20).** _gem_ stays out of the picture words, so the g critter always sings /g/. Dave: soft g before e is a later rule. (_gem_ is on the D5 text list, where it only sits.)
- **D7. CONFIRM (2026-10-20).** A raft trip is three crossings, then the Play place; Letter critters has no end of its own. Dave: a natural stop every few minutes with no autoplay (#647 § 2), and a toy with no end is allowed (#647 § 3).
- **D8. CONFIRM (2026-10-20).** At most 16 critters a visit. Dave: it fits the screen and keeps the choice small for 6-9; letters rotate between visits, but nothing is judged on a letter that isn't there.

### 8.3 For Kevin (K-items, confirmed in code): answered 2026-10-20

Kevin checked the spec read-only against `origin/main`: K1 and K5 CHANGE, K2 CONFIRM with a seam, K3 and K4 CONFIRM, and a CHANGE to the build split. All are applied.

- **K1. CHANGE (2026-10-20), applied.** The blend-clip write goes in `mobile/scripts/export-audio.mjs`, not `export-assets`: `export-audio` owns `audioRegistry.ts` and rewrites it whole (`:84`), and the render commit runs it, so entries from `export-assets` would be wiped. It decodes `u.audio.base64` exactly as `export-assets.mjs:333-334` does. 46 distinct blend texts, 1,190,280 bytes; `mobile/assets` 21.64 → 22.83 MB (+5.5 %); no size budget in the repo. `audioRegistry.test.ts:64-80` and `:82-89` must leave out `/native/blend/` keys, with N15 covering the clips (§ 3.4, § 5.1, § 7 PR 1 step 3, N15).
- **K2. CONFIRM with a seam (2026-10-20), applied.** `engine.createPlayer` already takes `number | { uri }` (`playerPort.ts:50-52`); `TapClipPlayer.play`'s `uri` widens to `string | number` (`tapClip.ts:28`, `:42`, `:69-72`). A `require()`d module has no byte length at run time, so `blendMarksFor`'s byte check cannot run: the game reads marks straight from `BLEND_MARKS`, with N15 as the guarantee. § 3.4's "same bytes, so `blendMarksFor` matches" sentence is rewritten to say so (§ 3.4, § 5.1, § 7 PR 1 step 4, N9, N15).
- **K3. CONFIRM (2026-10-20).** `renderGuidanceLinesLily.ts` is kind-agnostic and its dry run bills only uncached unique inputs (`:88-94`): expect 250, and stop if it is well above (§ 4.1, § 7). `voice-qa.html` needs only the `GUIDANCE_FILES` rows. The test needs `play: 18` in its per-kind map and the totals 354 lines, 349 texts and 354 srcs (C7).
- **K4. CONFIRM the vitest read (2026-10-20).** Precedent: `realBlending.test.ts:33-35` and `peek.test.ts:71-72` read `process.cwd()/public/canon`. No generated file: 7 rows are hand-pinned and the test is the drift guard. Runtime code must never import canon JSON (about 1.6 MB a file with base64 audio).
- **K5. CHANGE (2026-10-20), applied.** The route is `'play-place'`, not `'play'` (`'play-game'` kept), so `route.ts:66-67`'s note on why the flower bed's route is not `play` stays true (Decision 1, §§ 1.2-1.4, § 5.1, C9, N3).
- **Build split. CHANGE (2026-10-20), applied.** New `Route` members in PR 1 would break the mobile typecheck, because `ROUTE_EXITS` and `ROUTE_LABELS` are `Record<Route, …>`. I picked moving C9 into Devon's PR 2 beside N3 (§ 7). The rest of PR 1 and PR 2 stands. Kevin also found nothing server- or release-gated, but the T3 ear test needs a preview URL or a release, and the native app a new EAS build (§ 7, T3, V8).

## 9. Child-safety and dark-pattern check

| Risk (Dave #647 § 2)      | Here                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency, prizes, streaks | None: no stardust, no beads, no score, no unlock, nothing kept                                                                                                               |
| Lures                     | No arrival beat, no "new", no line naming a game outside the Play place, no "come back"                                                                                      |
| Emma pushing games        | The Hub's lines and suggestion are unchanged; the Play place's one line names no game                                                                                        |
| Lessons as the price      | The button opens with a step, never with a session that day                                                                                                                  |
| Games writing progress    | Zero writes, zero network calls (N5, N6)                                                                                                                                     |
| Time pressure             | No countdown, no clock; a raft or a log waits for ever                                                                                                                       |
| Rankings                  | None; nothing about another learner                                                                                                                                          |
| Failure feedback          | Funny world reactions (splash, tumble) with instant retry; a real word never tumbles (D5); a stuck raft gets a newcomer, unannounced (D4); never a red X, a buzzer or a poof |
| Autoplay, "one more?"     | The raft stops after three crossings and returns to the Play place; no line invites another                                                                                  |
| Untaught content judged   | The raft judges "ten" (add-to-10); the critters judge only the learner's current or mastered CVC words                                                                       |
| Collecting                | The island fills within a visit only, and nothing shows what is missing                                                                                                      |
| Rude words                | The critters sing sounds only; only picture words are ever said as words; a rude word sits quietly and never earns the giggle (§ 3.1)                                        |
