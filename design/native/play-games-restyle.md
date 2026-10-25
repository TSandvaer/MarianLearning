# The Play games in the app's clay look: Raft crossing and Letter critters (restyle spec)

**Ask (Thomas, 2026-10-25, verbatim):** "please make the design in both games better matching the design from the rest of the app".

**Scope:** design only: an audit of both games against the native app, a restyle spec, a target mockup, the order of work and acceptance criteria. No app code, no paid calls, no tickets.

**Parent specs:** `design/native/play-place.md` (§ 1.3 the tiles, § 1.7 the game frame, § 2 the raft, § 3 the critters, § 5 the art) and `design/native/critters-word-hunt.md` (the hunt, Devon's PR #697, open at `c3838afe`). Everything in them holds unless this spec says otherwise. **"The rest of the app"** means Home (the Hub), the Map, Math, Word Song and Session End in their native clay look: the `LOOK` tokens (`mobile/src/screens/hub/mapButtonLook.ts`, `mobile/src/screens/sessionEnd/clayLook.ts`), the Map's land bands, the cream clay tiles and the layouts in `mobile/src/layout/`.

**Work in flight on the same screens:** Devon's word hunt (PR #697, branch `devon/critters-word-hunt-p1`; it rewrites `LetterCritters.tsx` and adds `HuntBoard.tsx`) and Dave's raft "island goal + level up" (in design; no spec of it is in the repo yet, `grep -ril "island goal" design/` finds none). The restyle fits both because it changes paint only (Decision 1).

**Line numbers** are on `origin/main` at `2cdfa910` unless marked `#697` (Devon's branch at `c3838afe`).

## Goal

A learner who taps a tile in the Play place lands in a game that looks like part of the same toy box as the tile she tapped: clay pieces with soft depth and a ledge under them, standing in the Play place's garden. Today she lands on a flat diagram.

## User state entering

She is in the Play place, in the Hub's garden, looking at two glossy clay tiles: a clay raft with a duck and a frog, and three clay critters on a log (`ui-raft`, `ui-critters`, `play-place.md` § 5.2). She taps one.

## Decisions (this spec's own calls, with reasons)

1. **Paint, not geometry.** No rect moves. `playArea`, `raftScene` and `critterScene` (`mobile/src/screens/play/playGeometry.ts:18`, `:89`, `:262`) return what they return today, so Devon's measured fit tables (`critters-word-hunt.md` § 2.4), the Maestro swipe points (`mobile/maestro/on-demand/07-letter-critters.yaml`, and #697's 12 and 13), `playGeometry.test.ts` and whatever Dave puts on the island all stay valid. The restyle changes fills, gradients, shadows, corner radii and a few decorations drawn inside the existing rects.
2. **The games stand in the Play place's garden, not on the lesson's cream sheet.** The game frame paints Math's background today (`PlayGameScreen.tsx:315-323`), so stepping from the Play place's garden into a game reads as "a lesson starts". Games are outside the path and should feel like it (Thomas 2026-10-20, `project_games_outside_the_path`). The garden is the Hub's own layer (`HubBackdrop.tsx:25-52`), so the fade from the place into a game keeps the same ground under it. The lesson frame's layout stays (Decision 9). The alternative is shown in `play-restyle/backdrop-garden-vs-cream.png` (the restyled scene on the cream sheet still works; it just reads as a lesson).
3. **The scene's ground is the Map's land bands.** The water, the shore and the meadow become clay slabs with the Map band's radius and shadow (`landParts.tsx:58-61`) in the Map's own tints (`mapTheme.ts:6-12`). The island becomes a clay oval, as the Map's plinths and stones are (`mapFx.tsx:35`).
4. **Everything she touches is clay with a ledge** (bar #10, "chunky, filled, tactile"): the critters take the Word Song honey clay of the Play-place tile (`mapButtonLook.ts:18-23`), the weight tags and the flag take the cream clay tile (`ClayChip.tsx:43-51`), and the shore animals stand on the Map's cream plinths (`MapStop.tsx:170-180`).
5. **No thin lines.** Bar #10 fails "thin 1-2 px outlines on flat pastel cards, hairline dividers". Every `borderWidth` in the two games goes (the deck, the logs, the critters' log, the hunt's numeral disc, slot ring and vowel ring), and the water's full-width wave line becomes short ripples.
6. **The log's three seats show as sockets; the raft's six seats stay unmarked.** The log takes exactly three letters, so three sockets say "three go here" without a word. They are the Hub tray's holes (`HubFlowerTray.tsx:132`, `:234-238`), and they echo the hunt's three-box slots. The raft's goal is a weight of ten, not six full seats, so marking six seats would point at the wrong goal.
7. **Pack pictures stay as they are.** The nine animals and the word pictures are the lessons' own pictures (`mobile/assets/pictures/`, the soft storybook style). In the lessons they always sit in a clay frame (Word Song's chips, `WordChip.tsx:136-142`). The games give them the same: a plinth on the shore, a contact shadow, a cream clay card when a word pops.
8. **Code first, art second.** Everything in § 2 is drawn with existing tokens at $0. One piece may still need art after Thomas sees it on a device: the critter's body, because the tile he picked is glossy vinyl clay and gradients only get close (§ 4).
9. **Kept as they are:** the frame's layout (`mathLayout`, `play-place.md` § 1.7), so Emma, the back disc and the ribbon sit where a lesson puts them; the type (Fredoka 700 in `#6b3f1f`, the map's on-clay ink, `mapTheme.ts:3`); the motion (drag lift 1.08, springs, wobble, glide); the Play place screen itself (it already uses the Hub's garden, the map's wood Home disc and clay tiles).

---

## 1. Audit

### 1.1 How it was run

The native app on two iOS 27 simulators through Expo Go and the repo's Maestro harness (`mobile/maestro/run.sh`: API base on a closed port, so no paid call can happen; `EXPO_PUBLIC_MUTE=1`, so Emma was silent), with a one-off audit flow kept outside the repo. Launch args `qaStep: add-to-10` and `seed: cvc-words` (as `05-play-place.yaml`'s second learner), so both games are open. Each screen in portrait, then again in landscape. Frames as Metro logged them: iPad Pro 11-inch (M5) `834×1210 insets t0 b20` and `1210×834 t0 b20`; iPhone 17 `402×874 t62 b34` and `874×402 t0 b20 l62 r62`. Both runs passed (iPad 483 s, iPhone 467 s, 0 re-taps).

| Sheet (`design/native/play-restyle/`) | What it shows                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `audit-reference-ipad.png`            | Hub, Play place, Map, Word Song, Math on the iPad, portrait and landscape  |
| `audit-reference-iphone.png`          | The same on the iPhone                                                     |
| `raft-before-target.png`              | Raft crossing today (one animal aboard) next to the target, all four forms |
| `critters-before-target.png`          | Letter critters today (the free meadow) next to the target, all four forms |
| `backdrop-garden-vs-cream.png`        | The restyled scenes on the garden (this spec) and on today's cream sheet   |
| `target-mockup.html` + `geo.js`       | The target, drawn in the browser at the app's own geometry (below)         |

**The target mockup** draws both games with the tokens in § 2 at the rects the app computes: `geo.js` is `mathLayout` + `playArea` + `raftScene` + `critterScene` (and the Hub garden string) dumped from the code for the four logged frames. Open `target-mockup.html?form=ipadP&game=raft` (forms `ipadP ipadL phoneP phoneL`; games `raft critters`; `&bg=cream` for the alternative). It needs the repo's `mobile/assets/` next to it and loads Fredoka from Google Fonts.

### 1.2 What already matches (no change)

| Part                | Why it matches                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Back                | The lesson's clay back disc (`MathHud.tsx:58-63`, `PlayGameScreen.tsx:303-307`), wood, ledge `#7d4a26`, as in Math and Word Song       |
| Emma                | `layout.emma` from `mathLayout`, the lessons' size and place in all four forms (the screenshots: same as Math and Word Song)           |
| Ribbon              | Math's `clayRibbon` (`PlayGameScreen.tsx:326-335` = `Math.tsx:2319-2327`)                                                              |
| Type                | Fredoka 700, `#6b3f1f` on clay (tags, flag, letters), the map's ink (`mapTheme.ts:3`)                                                  |
| Motion              | Springs and timings already in the app's vocabulary (drag spring 300 / 22, `play-place.md` § 1.7; chips 300 / 18)                      |
| The drag hint       | Greet's finger-tap hand, the story cue's (`DragHintHand.tsx:1-15`)                                                                     |
| Play place          | The Hub's garden (`PlayPlace.tsx:162`), the map's wood Home disc (`:186-191`), clay tiles in the world's `LOOK` (`:56-59`, `:234-244`) |
| Animal and word art | The lessons' pack pictures (Decision 7)                                                                                                |

### 1.3 Mismatches

| #   | Where       | Today                                                                                                                                                                                             | The rest of the app                                                                                                                |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Both, frame | The lesson's cream sheet with a pink glow (`PlayGameScreen.tsx:315-323`), straight after the Play place's garden                                                                                  | The Play place, Hub and Session End stand in the garden (`HubBackdrop.tsx:25-65`; `SessionEnd.tsx:358`)                            |
| M2  | Raft        | Water and shore are hard-cornered rectangles filling `A` edge to edge (`RaftCrossing.tsx:739-749`, `:1187-1191`, `:1201`); the island band is empty cream                                         | Ground is rounded clay slabs with a top highlight, a ledge and a soft drop: the Map's land bands (`landParts.tsx:52-61`)           |
| M3  | Raft        | The island is a flat sand pill (radius = half its short side, `:755-762`, `:1202`) with two flat 0.22 a green dots (`:763-778`, `:1203`)                                                          | Clay ovals with a radial face over a slab (`mapFx.tsx:35-90`); green clay (`clayLook.ts:7-13`)                                     |
| M4  | Raft        | The deck and its five logs: flat `#c98a55` with a 2 pt `#7d4a26` outline and 2 pt dividers (`:925-938`, `:1204-1217`); a 4 pt mast, an 8 pt oar, flat (`:1218`, `:1227-1232`)                     | Wood is the radial clay of the back and Home discs (`mapChrome.tsx:361-368`), no outline; bar #10                                  |
| M5  | Raft        | The weight tag: a flat cream disc with a 2 px hairline drop (`:1179-1185`); the flag a flat `#fff8ee` box, radius 4 (`:1219-1225`)                                                                | Numbers sit on the cream clay tile (`ClayChip.tsx:43-51`; Math's chips, NG slab `#dba675`, `AnswerChip.tsx:25`)                    |
| M6  | Raft        | The animals float on the sand with no contact shadow (`:700-706`)                                                                                                                                 | Pictures sit on a plinth (Hub cards, Map stops, `MapStop.tsx:170-185`) or in a clay tile, with a drop shadow (`imageShadow.ts:12`) |
| M7  | Raft        | A full-width 3 pt white wave line across the water (`:1192-1200`) reads as a divider                                                                                                              | Bar #10: no hairline dividers                                                                                                      |
| M8  | Critters    | Flat discs, 2 px ledge (`LetterCritters.tsx:1037-1047`), small eyes (0.18 c, `:1052-1072`): unlike their own tile, glossy clay critters with antennae (`ui-critters`)                             | The Play-place tile's clay (`PlayPlace.tsx:56-59`, `mapButtonLook.ts:18-23`); bar #13, one style per screen                        |
| M9  | Critters    | The log is a flat 24 pt bar with a 2 pt outline (`:698-710`, `:1267-1272`); its three seats are invisible until filled                                                                            | Wood clay, no outline; the Hub tray's three sockets (`HubFlowerTray.tsx:132`, `:234-238`)                                          |
| M10 | Critters    | The meadow has no ground: critters float on the sheet; the burrows (`:757-772`, `:1273`) hide behind the feet                                                                                     | A land band under the stops (the Map); sockets that read as holes (the Hub tray)                                                   |
| M11 | Critters    | The picture card: white, a soft drop only (`:1282-1287`)                                                                                                                                          | Word Song's pictures sit on the cream clay tile with the pink slab (`WordChip.tsx:36`, `ClayChip.tsx:43-51`)                       |
| M12 | Hunt (#697) | Tiles flat with a 1.5 px ledge (`HuntBoard.tsx:61-67` #697); slot card flat with a 2 px ledge (`:619-623`); empty box a 1.5 pt inset line (`:625-628`); the bonus chip a 35 % honey wash (`:634`) | The critter clay (M8), the Hub bubble's clay (`hub-native.md` § 6), the tray socket                                                |
| M13 | Hunt (#697) | The numeral disc: flat `#f2d3a6` with a 2 pt `#7d4a26` outline (`HuntBoard.tsx:635-639` #697); the vowel ring a 2 pt dashed outline (`:497-502`); the slot ring a 2-3 pt border (`:196-207`)      | Bar #10; the Hub's glow ring is a glow, not a line (`hub-native.md` § 6, the suggested ring)                                       |
| M14 | Both        | Corner radii: 0 on the bands, 4 on the flag, 0.12 a on the deck; spacing: the scene runs into `A`'s 16 pt gutter with square corners                                                              | Bands 48 × k, tiles 0.22 t, chips their own radius; the Map insets its bands                                                       |

**Top five** (what Thomas sees first): M2 (the raft's rectangles), M8 (the critters are not the tile's critters), M4 + M9 (outlined flat wood), M1 (the cream sheet after the garden), M5 + M6 (flat tags, floating animals).

---

## 2. Restyle spec (the target per mismatch)

`k` = the frame's clay scale: 1 on tablets, 7/12 on phones (the Home disc's, `PlayPlace.tsx:158`, `mapChrome.tsx:43`). `R` = 48 × k, the Map band's radius (`landParts.tsx:58`). **The band shadow** at scale k, from `landParts.tsx:61` with its ledge colour `lo`:

```
inset 0 5k 0 rgba(255,255,255,0.4), inset 0 -8k 0 rgba(0,0,0,0.08), 0 10k 0 <lo>, 0 18k 24k rgba(60,40,10,0.15)
```

### T1 (M1) The frame's backdrop

`play-game-background` paints the Hub's garden: `backgroundColor: '#cdebb4'` and `experimental_backgroundImage: gardenBackground(hubLayout(viewport).garden)` (`HubBackdrop.tsx:34`, `:59`; `clay.ts:72-81`). Without the Hub's warm light behind Emma (`HubBackdrop.tsx:37-49`): the light belongs to the Hub's Emma frame, not the lesson frame. The fade stays 200 ms (`PlayGameScreen.tsx:59`). Simplest build: give `HubBackdrop` a `light` prop (default on) and render it with the light off.

### T2 (M2, M7, M14) Raft: water and shore

- **Water:** one pool slab covering the island band and the water band, running `R` under the shore so no gap shows between them. Portrait: x `A.x`, y `island.y`, width `A.width`, height `shore.y − island.y + R`. Landscape: from `shore.x + shore.width − R` to `A`'s right edge, full `A` height. Radius `R`. Face: today's water, `linear-gradient(180deg, #8fd0ee, #5fb3dd)` (`RaftCrossing.tsx:108-109`; 90deg in landscape, deep side at the shore). Shadow: the band shadow with **`lo = #4a9cc8`, the only new colour in this spec** (a deeper shade of `#5fb3dd`; no blue ledge exists in the app). `raft-water` keeps its rect for tests; the pool is drawn beside it.
- **Ripples instead of the wave line:** 5 rounded strokes, `rgba(255,255,255,0.55)` (today's wave colour, `:1199`), 6 pt (tablet) / 4 pt (phone) tall, 0.12 × water width (portrait) or 0.16 (landscape), at fixed fractions of the water rect that stay clear of the raft's path: portrait (0.05, 0.25), (0.78, 0.18), (0.08, 0.7), (0.8, 0.62), (0.14, 0.92); landscape (0.62, 0.12), (0.78, 0.3), (0.6, 0.72), (0.8, 0.88), (0.7, 0.5). Static.
- **Shore:** a sand band on the shore rect, radius `R`, face `linear-gradient(#ffeec2, #e8c77a)` (`BAND_TINTS[1]`, `mapTheme.ts:8`), the band shadow with `lo = #e8c77a`. Drawn after the pool, so the beach sits on the water.

### T3 (M3) Raft: the island

- **Mound:** `ClayOval` (`mapFx.tsx:35`) in the mound rect, `h = mound.height − drop`, drop 10 (tablet) / 7 (phone), stops `['#ffeec2', '#f2c27a', '#d9a159']` (the Word Song honey, `mapButtonLook.ts:19`), slab `#b27b37` (`:22`), with its soft shadow.
- **Two bushes** where the tufts are (`RaftCrossing.tsx:763-778`, x at 0.3 and 0.7 of the mound, top 0.12 × mound height), 0.5 a wide and 0.4 a tall, radius 50 % / 50 % / 45 % / 45 %, in green clay: face `linear-gradient(#7fd364, #5cb945)`, `inset 0 3k 0 rgba(255,255,255,0.35), 0 5k 0 #3f8a2e, 0 8k 10k rgba(40,90,20,0.3)` (`CLAY_LOOK.go`, `clayLook.ts:7-13`).
- Island animals (the party) stand on the mound with the contact shadow of T6.

### T4 (M4) Raft: deck, mast, flag, oar

- **Deck base:** the dock rect, radius 0.14 a, `#7d4a26`, shadow `0 8k' 0 #7d4a26, 0 14k' 18k' rgba(60,30,10,0.3)` with k' 1 on tablets, 0.75 on phones. No border.
- **Five logs** on it, each `dock.height / 5 − 2` tall, 2 pt apart (the base shows between them), inset 2 pt left and right, radius half their height, face `linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)` (the wood stops of `mapChrome.tsx:367`, run top to bottom), `inset 0 2px 0 rgba(255,255,255,0.3)`. They replace the outlined logs (`:929-937`).
- **Two rope bands** across the logs at 0.2 and 0.8 of the deck width, 0.1 a wide, `#f2d3a6` (the lighter wood of the hunt's numeral, `critters-word-hunt.md` § 3.2) with `inset 0 -3px 0 rgba(125,74,38,0.3)`. They match the tile's roped raft.
- **Mast:** max(6, 0.07 a) wide (was 4), `linear-gradient(90deg, #a86c3c, #7d4a26)`, radius 4.
- **Flag:** same rect (`raftScene` `flag`), the ribbon's cream clay: face `linear-gradient(#fffdf8, #fff1e2)`, `inset 0 2px 0 #ffffff, 0 3px 0 #efcfb4, 0 6px 8px rgba(90,45,20,0.16)` (the ribbon's tokens, `PlayGameScreen.tsx:331-334`, at half depth), radius 0.08 a. The numeral unchanged.
- **Oar:** 10 (tablet) / 8 (phone) wide, `linear-gradient(90deg, #c98a55, #7d4a26)`, radius 6, `0 3px 0 #7d4a26`.
- **No seat marks** (Decision 6). The deck's sink, wobble, glide, bob and rowing are unchanged.

### T5 (M5) Raft: weight tags

Same disc (0.42 × size at the picture's lower right). Face `linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)` (`ClayChip.tsx:43`), shadow `inset 0 2px 0 #ffffff, 0 4px 0 #dba675, 0 6px 9px rgba(90,45,20,0.16)` on tablets and `inset 0 2px 0 #ffffff, 0 3px 0 #dba675, 0 5px 7px rgba(90,45,20,0.16)` on phones: the clay tile's recipe (`ClayChip.tsx:46-48`) on Math's Number Garden slab (`AnswerChip.tsx:25`), at the depth a 27-44 pt disc can carry. Text unchanged (Fredoka 700, 0.3 × size, `#6b3f1f`).

### T6 (M6) Raft: animals

- **On the shore:** a cream plinth under each animal, inside its cell: `ClayOval` at (0.06 a, 0.62 a), 0.88 a × 0.34 a, drop 6 (tablet) / 4 (phone), stops `['#fffaf0', '#efdcc0', '#d6b890']`, slab `#b8946a`: the Map's open-stop plinth (`MapStop.tsx:170-180`). It moves with the animal (part of the `DragPiece` content), so a dragged animal carries its plinth and the empty spot shows sand.
- **Everywhere** (shore, seat, island, splash): the picture's wrapper takes `imageShadow(4, 8, 'rgba(60,30,10,0.28)')` on tablets and `imageShadow(3, 6, 'rgba(60,30,10,0.28)')` on phones (`imageShadow.ts:12`, the Hub and map stickers' drop shadow).
- **Aboard:** no plinth: they sit on the logs.

### T7 (M8) Critters: the clay critter (code, $0)

Same size, cell, burrow, letter and motion. The body:

- **Face:** consonants `radial-gradient(circle at 40% 32%, #ffe0a8 0%, #f2c27a 55%, #d9a159 100%)` (`LOOK['word-song'].face`, `mapButtonLook.ts:19`); vowels `radial-gradient(circle at 40% 32%, #ffe0ec 0%, #FFC0CB 55%, #f2a9c4 100%)` (`BAND_TINTS[4]`, `mapTheme.ts:11`, around `colors.myPink`).
- **Shadow** at `s = size / 118` (the tile's scale, `PlayPlace.tsx:213-214`): `inset 0 5s 0 rgba(255,255,255,0.4), inset 0 -6s 0 rgba(0,0,0,0.12), 0 9s 0 <ledge>, 0 14s 18s rgba(120,60,20,0.25)`, with `ledge` `#b27b37` (consonants, `LOOK['word-song']`, `mapButtonLook.ts:22`) or `#F48FB1` (vowels, `colors.myRose`). It replaces `0 2px 0 <ledge>` (`LetterCritters.tsx:1046`).
- **Eyes:** white discs of 0.22 c (was 0.18), centres at 0.32 c and 0.68 c, top 0.12 c; pupils `#3d2112` of 0.11 c (was 0.08), offset to the upper inside; a white glint of 0.04 c on each pupil.
- **Cheeks:** two ovals 0.14 c × 0.07 c, `rgba(244,143,177,0.45)` (`colors.myRose` at 45 %), top 0.36 c, outside the eyes (x 0.15 c and 0.71 c). They stay clear of the letter's box (top 0.28 c, `:1076-1083`).
- **Antennae** (the tile's critters have them): two stalks 0.05 c × 0.15 c from 0.07 c above the body at x 0.32 c and 0.68 c, in the ledge colour, each with a 0.1 c ball in the face gradient and a `0 2px 0 <ledge>` ledge. They stay inside the gap `g` above a cell (0.12 c ≤ 6.7 pt on a phone, `g` 8; 10.6 pt on a tablet, `g` 16).
- **Feet** as today (`:1022-1035`).
- **Letter contrast:** the letter (Fredoka 700, 0.5 c, `#6b3f1f`) sits between the 0 % and 60 % stops of the face, so it never stands on a colour darker than `#f2c27a` (5.4 : 1) or `#FFC0CB` (5.8 : 1), the ratios `play-place.md` § 3.2 computed. The darkest stop (`#d9a159`) is only at the rim.
- **Lit and lean:** unchanged (the letter's scale and white glow, the 6° lean).

### T8 (M9) Critters: the log and its sockets

- **Log:** same rect (`critterScene` `log`, 24 pt tall). Face `linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)`, radius half its height, no border, shadow `inset 0 3px 0 rgba(255,255,255,0.3), 0 6px 0 #7d4a26, 0 10px 14px rgba(60,30,10,0.3)` (tablet) / `inset 0 3px 0 rgba(255,255,255,0.3), 0 5px 0 #7d4a26, 0 8px 10px rgba(60,30,10,0.3)` (phone): the Home disc's wood and ledge (`mapChrome.tsx:111`, `:367`).
- **Three sockets,** one under each seat: an oval at x `seat.x + 0.18 × seat.width`, width 0.64 × seat width, y `log.y + 0.18 × log.height`, height 0.64 × log height. Face `radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)`, `inset 0 4px 5px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.35)` (tablet) / `inset 0 3px 4px …, 0 1.5px 0 …` (phone): the Hub tray's hole (`HubFlowerTray.tsx:132`, `:234-238`). A seated critter's feet stand in it. With the hunt, the numeral disc on the log's left end (`critters-word-hunt.md` § 3.2) draws over the log and under seat 1's socket edge, as it draws under seat 1's critter today.

### T9 (M10) Critters: the meadow and its burrows

- **Meadow band:** a green land band behind the cells, drawn first: x from `max(A.x, meadow.x − g)` to `min(A.x + A.width, meadow.x + meadow.width + g)`, y `meadow.y − g/2`, height `meadow.height + g`. Radius `min(R, 0.5 c)`. Face `linear-gradient(#d7f2c4, #a9d68c)` (`BAND_TINTS[0]`, `mapTheme.ts:7`), the band shadow with `lo = #a9d68c` at k 0.7 (tablet) / 0.45 (phone). It is paint only: it never moves a cell, and it is clipped to `A` horizontally. Its top edge sits inside the `g` gap under the log band, so it never covers a seat or a seat's drop zone. The hunt's 3 × 2 meadow takes the same rule.
- **Burrows:** the same oval (x `r.x + 0.1 c`, y `r.y + 0.78 c`, 0.8 c × 0.26 c, `LetterCritters.tsx:763-771`) in the tray hole's face and shadow (T8). A critter lifted out of its burrow now leaves a hole that reads as a hole.

### T10 (M11) Critters: the picture card

Same rect, radius 0.12 p, z-order and motion. Face `linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)`, shadow `inset 0 4px 0 #ffffff, inset 0 -6px 0 rgba(120,70,40,0.08), 0 6px 0 #f2a7c3, 0 10px 14px rgba(90,45,20,0.12)`: Word Song's picture chip (`ClayChip.tsx:43-48`, slab `#f2a7c3`, `WordChip.tsx:36`).

### T11 (M12, M13) The word hunt's parts (Devon's PR #697)

- **Found tile:** the critter's clay at the tile's size: the T7 face, shadow `inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 0 <ledge>, 0 3px 4px rgba(120,60,20,0.2)`. No eyes, cheeks or antennae: a tile is a letter, not a critter. Replaces `tileLook` (`HuntBoard.tsx:61-67` #697).
- **Slot card:** the Hub bubble's clay: `#fff8ee`, `inset 0 2px 0 #ffffff, 0 4px 0 #e3c6a6, 0 7px 10px rgba(60,30,10,0.18)` at S4 (phones) and `inset 0 3px 0 #ffffff, 0 6px 0 #e3c6a6, 0 10px 16px rgba(60,30,10,0.2)` at S1-S3 (the P/L bubble values, `hub-native.md` § 6). Replaces `0 2px 0 #e3c6a6` (`:619-623` #697).
- **Empty box:** `#efe2d0` with `inset 0 2px 3px rgba(90,45,20,0.25)` instead of the 1.5 pt inset line (`:625-628` #697): a shallow socket, lighter than the log's, because a slot waits for a tile, not a critter.
- **Bonus chip:** a cream clay tile (the T5 face and shadow on the Word Song slab `#f2a7c3`) instead of the 35 % honey wash (`:634` #697).
- **Numeral disc:** end-grain clay: face `radial-gradient(circle at 40% 32%, #fbe6c8 0%, #f2d3a6 60%, #dcb27c 100%)`, `inset 0 0 0 3px rgba(125,74,38,0.22), inset 0 2px 0 rgba(255,255,255,0.5)` (a carved ring, not a line), no border (`:635-639` #697). Numeral unchanged. `#fbe6c8` and `#dcb27c` are a lighter and a darker step of Devon's `#f2d3a6`.
- **Vowel ring and slot ring:** the Hub's suggested glow instead of a line: `0 0 0 4px #fff3a8, 0 0 18px 6px rgba(255,210,63,0.8)` on a transparent view the cell's size (`hub-native.md` § 6, at about half the Hub's size). No border, no dash (`:497-502`, `:196-207` #697). Static, as Devon's spec has it (`critters-word-hunt.md` Decision 7).
- **New letters:** Devon's honey `ClayDisc` (#697 `mapChrome.tsx`) already matches. No change.

### T12 Reduce Motion, VoiceOver, touch

Nothing new moves, so Reduce Motion is unchanged. Labels and targets are unchanged: the plinths, sockets, bands, ripples, bushes and ropes are `pointerEvents="none"` and invisible to VoiceOver.

---

## 3. Wireframes (paint layers; every rect as today)

No layout changes, so these show the layers, not new positions. The pictures are `play-restyle/raft-before-target.png` and `critters-before-target.png`, drawn at the app's rects in all four forms.

```
RAFT, PORTRAIT (phone P, tablet W)            RAFT, LANDSCAPE (phone L, tablet TL)
garden (T1)                                   garden (T1)
 (<) Emma   [ ribbon ]                         (<) Emma  [ ribbon ]
 +=================================+          +========+======================+=====+
 |  ~ pool (T2), radius R  ( mound )|          | shore  | ~ pool, radius R  ~   |(mnd)|
 |  ~  ~      (bush)  (bush)  ~     |          | (T2)   |   +====+   ~    ~    |( T3)|
 |  ~ __   +===[6]=====+     __  ~  |          | {7} {3}|  [6]logs| ~   __    |     |
 |  ~      | logs, ropes|  ~       |          | {6} {4}|   |rope |   ~        |     |
 |  ~  __  +============+     __   |          | {9} {2}|   +====+       __    |     |
 +-----shore (T2), radius R--------+          +========+======================+=====+
 |  {7}     {3}     {6}            |           {n} = animal on a cream plinth (T6) with its
 |  {4}     {9}     {2}            |           cream clay tag; __ = ripple; [6] = cream flag
 +=================================+

CRITTERS, PORTRAIT                            CRITTERS, LANDSCAPE
garden                                        garden
 (<) Emma   [ ribbon ]                         (<) Emma  [ ribbon ]
        (c) (a)                                          (c) (a)
     ===(o)==(o)==(o)===  log + 3 sockets (T8)        ===(o)==(o)==(o)===
  +---------------------------+                  +-------------------------------+
  | (a)(e)(i)(o)(u)(b)(c)     |  meadow band      | (a)(e)(i)(o)(u)(b)(c)(d)(f)   |
  |  o  o  o  o  o  o  o      |  (T9); o = burrow  | (g)(h)(j)(l)(m)(n)(p)(r)(s)   |
  | (d)(f)(g)(h)(j)(l)(m) ... |  socket            | (t)(v)(w)(x)                  |
  +---------------------------+                  +-------------------------------+
 (x) = clay critter (T7): honey consonant / pink vowel, eyes, cheeks, antennae, ledge
```

---

## 4. New art (separate list)

**Phase A (§ 5) needs no art: $0.** It reuses the shipped pictures, `ClayOval`, the tray hole and the `LOOK` tokens.

**Phase B, only if Thomas still sees the critters as "not the tile's critters" on a device after Phase A:**

| Id (proposed)      | What                                                                                                                                                                           | Why                                                                                       | Count                | Estimate            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| `ui-critter-honey` | One round honey-yellow clay critter seen from the front, big eyes, little antennae, tiny feet, mouth closed, a smooth blank belly (the letter is drawn on it in code), no text | Bar #13: the tile Thomas picked is glossy vinyl clay; code gradients get close, not equal | 2 variants           | 2 × $0.078 = $0.156 |
| `ui-critter-pink`  | The same critter in pink                                                                                                                                                       | Vowels are pink (`play-place.md` § 3.2)                                                   | 2 variants           | 2 × $0.078 = $0.156 |
| **Total**          |                                                                                                                                                                                |                                                                                           | **4 images, pick 2** | **about $0.31**     |

Made as `ui-raft` and `ui-critters` were (`play-place.md` § 5.2: the pack generator's clay style, `--dry-run` first for the real figure, Thomas picks on the contact sheet). "Must not look like": the bee, a snail, a letter, a face on a ball with no feet. The same image carries every letter, so the critter stays one asset per colour. The hunt's tiles stay code (a tile is not a critter). $0.078 a picture is the pack's figure from this dispatch; the clay pieces' measured rate was 2 for about $0.16 (`play-place.md` § 5.2), the same.

**Not proposed:** a raft or island image. The clay drawn in code matches the Map's bands, which are code too, and an image deck would have to stretch to two deck sizes and keep the seat maths.

---

## 5. Order, and how it lands next to the hunt and the island goal

| Step | What                                                               | Files                                                                                        | When                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | **Frame + raft restyle:** T1, T2-T6                                | `PlayGameScreen.tsx` (backdrop only), `HubBackdrop.tsx` (a `light` prop), `RaftCrossing.tsx` | Now, from `main`. Independent of #697 except `PlayGameScreen.tsx`, where #697 changes 7 lines elsewhere in the file                                                                   |
| A2   | **Critters + hunt restyle:** T7-T11                                | `LetterCritters.tsx`, `HuntBoard.tsx`                                                        | A follow-up PR **on top of #697 after it merges**. #697 rewrites `LetterCritters.tsx` (805 lines changed) and adds `HuntBoard.tsx`, so a parallel branch would conflict on every hunk |
| B    | Critter body art (§ 4), only on Thomas's word after A2 on a device | 2 images + `PATH_ART_SET`, the critter body draws the image under the letter                 | After A2                                                                                                                                                                              |

**Not folded into #697:** it is in review, and a restyle there would grow a reviewed PR and put a visual change in front of Thomas as a finished build before he has seen the target (bar #12). Devon can take A2 straight after #697, with this spec as the brief.

**Dave's island goal + level up:** no spec in the repo yet. The restyle draws the island inside the same `mound` rect and leaves every raft rect alone, so whatever Dave adds draws over the clay mound. A new piece for it (a goal object, a level marker) should take these tokens: cream clay for anything with a number (T5), clay wood (T4), green clay (T3), the band shadow for ground. If Dave's design changes the raft's layout, A1 and his build should not run in parallel on `RaftCrossing.tsx`: whichever is second rebases.

**Dispatch value:** A1 and A2 are user-visible on every visit to both games; neither needs audio or Thomas's ear.

---

## 6. Acceptance criteria

**Code (jest, `mobile`; the developer):**

1. `playArea`, `raftScene` and `critterScene` return exactly what they return on `main` for every viewport `playGeometry.test.ts` covers; that test file passes unchanged (no geometry edit).
2. `play-game-background` has `backgroundColor` `#cdebb4` and `experimental_backgroundImage` equal to `gardenBackground(hubLayout(viewport).garden)`, and no `hub-emma-light` is rendered in a game.
3. No View rendered by `RaftCrossing`, `LetterCritters` or `HuntBoard` (word hunt included) has a `borderWidth` above 0 (a test walks the rendered tree in both games, free meadow and hunt).
4. The raft renders a pool with `borderRadius` = 48 × k and a `boxShadow` containing `#4a9cc8`, a shore band with `#e8c77a`, and no View with the old 3 pt full-width wave (`top: '45%'`, `left: 0`, `right: 0`).
5. Every shore animal renders a plinth (`ClayOval` with stops `#fffaf0 / #efdcc0 / #d6b890`, slab `#b8946a`) inside its `raft-animal-<id>` piece; aboard and island animals render none.
6. Every weight tag and the flag have the cream clay face (`#ffffff → #fff7ee → #ffeedd`, or the ribbon's `#fffdf8 → #fff1e2` on the flag) and a `boxShadow` with the ledge `#dba675` (tags) or `#efcfb4` (flag).
7. Each critter body's `boxShadow` contains `0 <9s>px 0 #b27b37` (consonant) or `#F48FB1` (vowel) with s = size / 118; its eyes are 0.22 × size; it renders two antennae.
8. The log renders three sockets, one centred under each seat (centre x within 1 pt of the seat's centre x), and no border.
9. The meadow band's rect lies inside `A` horizontally and does not intersect the log band or any seat's drop zone (seat grown by 0.2 c), for 6, 16 and 22 critters in the four viewports of `geo.js` and the play-place tablet table.
10. The picture card's `boxShadow` contains `0 6px 0 #f2a7c3`.
11. The existing play suites (`RaftCrossing.test.tsx`, `LetterCritters.test.tsx`, `LetterCritters.hunt.test.tsx` #697, `play.reducedMotion.test.tsx`, `play.learners.test.tsx`, `PlayPlace.test.tsx`) pass with no behaviour change.

**On the simulators (Jessica; iPad portrait and landscape, phone portrait and landscape; Emma muted, the harness's `EXPO_PUBLIC_MUTE=1`):**

12. Maestro `05-play-place.yaml` and `07-letter-critters.yaml` (and #697's 12 and 13) pass with their swipe points unchanged.
13. Screenshot check, both games, all four forms: no square corner on any ground slab; no line thinner than 3 pt anywhere in the scene; every piece she can drag shows a ledge under it.
14. The raft: the island stands in the water; every shore animal stands on a plinth; the flag and the tags look like the cream chips in Math (put a Math screenshot next to it).
15. The critters: the three empty seats show as three sockets before any critter is seated; a critter dragged out of the meadow leaves a visible hole; side by side with the Play place's critters tile, the in-game critters have its colours, eyes, antennae and gloss direction (light from the top left).
16. Going Play place → game → Back → Play place, the garden stays under the fade: no cream flash.
17. The word hunt: slots, empty boxes, the numeral disc, the bonus chip and the hint glow show no outline; found tiles look like the critters' clay without faces.
18. Reduce Motion on: everything above still drawn; nothing new moves.

---

## 7. Prediction and bounded convergence (Predict-Before-Soak)

**Prediction (written before anyone has seen A1 or A2 on a device):** Thomas will say the raft now looks like it belongs to the Map, and he will single out the island and the shore. The critters will read as "much closer" but **not yet** as the tile's critters: he will point at the tile and the critters together and say the tile's are shinier or rounder. That is the Phase B trigger (§ 4). He will not mention the backdrop unless asked, because the garden will feel like it was always there. A falsifier: if he says the critters now match the tile, Phase B is dropped.

**Bounded convergence:** this spec is tested against bar #10 (chunky, filled, no thin lines), bar #13 (one style per screen) and the Map, Hub and lesson tokens, in the mockup and in the code it cites. **Not tested:** the restyle on a real iPad (the mockup is a browser render; iOS draws `boxShadow` and gradients through the same paths the Hub and Map use, so the risk is low but real), paint cost with 22 critters each carrying a gradient and four shadows on an older iPad (the Hub and Map draw fewer clay pieces at once), Android (`imageShadow` is the Android 12+ filter there), dark rooms, and how a child reads the new sockets (Dave has not reviewed Decision 6).

---

## 8. Open questions

1. **Backdrop (one team recommendation: the garden, Decision 2).** If Thomas prefers the games on the lesson's cream sheet, T1 is dropped and nothing else changes (`backdrop-garden-vs-cream.png`).
2. **Phase B art** (§ 4): about $0.31 for 4 images, after A2 on a device. Thomas's call on the spend, when it comes.
3. **Dave:** do the log's three sockets help a 6-9-year-old see "three go here", or could an empty socket read as "unfinished" and nag? (Decision 6). The hunt's three-box slots already make the same promise.
4. **Paint cost on an older iPad** with 22 clay critters: Devon to watch frame drops during a drag on the oldest supported device; if it stutters, drop the soft drop shadow first (the ledge stays).
5. **Dave's island goal:** when it has a spec, does it add a piece to the island that needs its own art?

## 9. Child-safety and dark-pattern check

Paint only: no new reward, sound, line, motion loop, count or prompt. The sockets are static and empty sockets never pulse. The garden backdrop and clay pieces add no lure; Emma still never pushes a game (`play-place.md` § 1.6). Nothing is written.
