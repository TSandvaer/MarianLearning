# The Bunny race, phase 1: the 1-20 path (native build spec)

**Ask (Thomas, 2026-10-25, as the coordinator relayed it):** the games should have visible goals, rewards and levels. Dave designed a new Play game for it, the Bunny race.

**Decided by popup (Thomas, 2026-10-25):** "Yes, phase 1": the 1-20 path, against Emma and for two players, writing nothing. Phase 2 (the 10 × 10 hundred board, its one toy-state flag and a board choice) comes later. This spec leaves room for it (§ 14) and does not design it.

**Rules: Dave's ruling of 2026-10-25,** committed verbatim with this spec as `design/research/bunny-race-2026-10-25.md` (it came by Orca dispatch and was not in the repo). It sets who sees the game, the board's shape, one race, Emma's moves, two players, the beats, the stop and the spend. This spec quotes it as "Dave (n)" by his section numbers and does not restate his evidence. It designs his list "(6) What Kyle must design next", items 1-8 in full and item 9 as room only.

**Parent specs:** `design/native/play-place.md` (the Play place, the game frame and `A` in § 1.7, the rails in § 1.6, lines in § 4) and `design/native/play-games-restyle.md` (the clay look; merged at 414ad2fa; Thomas chose its garden backdrop, T1). Everything in them holds for the Bunny race unless this spec says otherwise.

**Standing rules:** any learner of about 6-9 (Marian is one); every spoken line and label is a row in a table, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first; never a red X. **Phase 1 writes nothing** (`play-place.md` AC N5 holds).

**Scope:** spec only. No code, no renders, no generation, no paid calls, no tickets. The art (§ 13) and the jingle (§ 12.3) are generated later, each under its own spend popup.

**Line numbers** are on `origin/main` at 414ad2fa. **Measured** values come from a scratch script (not committed) that calls the real `mathLayout`, `playArea` and `playPlaceLayout` on that commit; the `A` values at the four floors equal `play-place.md:198-201`.

## Goal

A learner taps the bunny tile in the Play place, picks "race Emma" or "two bunnies", and races her bunny along a garden path of numbered squares, 1 to 20, to a carrot. She spins 1, 2 or 3 and hops her bunny one tap per square while Emma's voice names each square she lands on ("Eight! Nine! Ten!"). Emma's bunny races too, and sometimes tries a funny trick she can catch. Every race ends with her bunny munching the carrot.

## User state entering

She is in the Play place (`play-place.md` § 1.3), in the Hub's garden, and tapped the bunny tile. She has progress, so number recognition (`number-recog`, `MATH_TREE[0]`) is current or mastered and the game is open (Dave (1)).

## Decisions (this spec's own calls, with reasons)

1. **A sibling spec, not a new section of `play-place.md`.** That file is about 860 lines, and Dave's raft island is being designed in parallel against its raft sections (Dave (5) names his in-flight raft-island ruling). `play-place.md` gets one pointer paragraph in this PR; the build PR makes its other amendments (§ 16).
2. **The start meadow sits under square 1, not left of it.** Two rows of 10 fill `A`'s width on every form (Dave (1)), so a meadow cell left of square 1 would shrink every square by a tenth (343 / 11 = 31.2 pt on a phone in portrait). Under square 1 it costs no width, and the first hop goes up onto 1.
3. **On a phone in landscape the squares give 4 pt to the spinner.** Dave's 49 pt is the width-only figure (491 / 10). The spinner then gets 76 pt under the board. I set the spinner's floor at 88 pt, which makes the squares 45 pt (44.3 on a notched phone), still at the 44 pt touch floor. A spinner's numeral and dots must read at a glance (Dave (1)).
4. **The carrot stands behind square 20's tile, its top above it.** There is no room beside square 20 on any form, and a carrot in front of the tile would hide the numeral 20. Behind the tile, its leaves and orange shoulder show above the square at all times, and it lifts out for the munch.
5. **Her bunny is caramel, the second player's lilac, Emma's blue-grey with Emma's sage-green sash.** Squares are cream (the restyle's colour for anything with a number, `play-games-restyle.md` § 5), so a white bunny would vanish on them. A white or pink bunny with a bow would also read as a Sanrio character, which the project dropped (`CLAUDE.md`, the Emma rename). Caramel against blue-grey or lilac is warm against cool, which stays apart for the common colour-vision deficiencies. Emma's and the second player's bunny never race together (Dave (3)).
6. **Whose turn it is shows three ways, none of them a colour alone:** the turn's bunny sits in the spinner's hub, a static glow lies under it on the board, and it bounces once when its turn starts. Dave asks for "a turn colour". One of the three bunnies is light, so a coloured rim would be weak, and the bunny itself is the clearest cue for 6-9.
7. **The spinner's dots dim one per hop.** It is a silent count of hops left, so she sees when her move is done, while the voice says only the square names. Dave to confirm (Q2).
8. **The guess is judged on the move's last square only.** "Where will you land?" asks where the move ends. A hop that passes the marker on the way is not a match. Dave to confirm (Q1).
9. **One image per bunny; every move is a transform.** Hops, the somersault, the bump, the twirl, the nap, the munch and the flop are rotations, squashes and arcs of the one picture. Dave's "ear-spin" becomes a **twirl** (the whole bunny spins round in the air), because one picture cannot spin its ears.
10. **The game teaches its two moves with the shipped tap hand.** Marian did not find the critters' drag (`play-place.md` § 3.3, the drag hint). Here the tap hand shows "tap the spinner", then "tap your bunny", once each per visit and again only after 8 s idle (§ 5.4).

---

## 1. Content and core (Kevin's PR; Dave's rules, made testable)

The rules are Dave (1)-(4) and his developer constants (5). **The names below are proposals;** Kevin's core PR pins them and the UI builds on the merged names (Pattern A).

| Name (proposed)               | Shape                                                                     | Meaning                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayGameId`                  | `'raft' \| 'critters' \| 'bunny'`                                         | Gains `'bunny'` (`packages/core/src/games/playPlace.ts:19`)                                                                                                                                                                                                                                   |
| `PLAY_GAMES.bunny`            | `{ opensAt: 'number-recog' }`                                             | `MATH_TREE[0]` (`packages/core/src/progress/mastery.ts:129`): every learner with progress has it, `null` gives none (Dave (1)). **Order: raft, bunny, critters**, numbers before letters, because `PLAY_GAMES` order is tile order (`play-place.md:51`) and the shelf puts numbers left (§ 9) |
| `BUNNY_SQUARES`, `BUNNY_SPIN` | `20`, `3`                                                                 | The path's last square, and the spinner's largest number                                                                                                                                                                                                                                      |
| `bunnyHops(pos, spin)`        | `(0..19, 1..3) => number[]`                                               | The squares a move lands on, in order: `pos + 1 … min(20, pos + spin)`. `pos` 0 is the start meadow. A spin past 20 stops on 20 (Dave (2))                                                                                                                                                    |
| `bunnyAsks(turn, pos, spin)`  | `=> boolean`                                                              | True on a player's turns 2, 5, 8, 11, … (`turn ≥ 2` and `(turn − 2) % 3 === 0`, counted per player per race), and only when `pos + spin < 20` (Dave (2))                                                                                                                                      |
| `emmaTurn(state, rng)`        | `=> { nap: boolean; trick: boolean; silly?: SillyHop; sillyAt?: number }` | Emma's moves for one turn, by Dave's rates: trick 1/4 from her 2nd turn, at least 3 of her turns apart, never when `pos + spin + 1 ≥ 20`; nap 1/8 from her 2nd turn, once a race, instead of spinning; silly 1/4 of her turns (§ 3.4)                                                         |
| `SillyHop`                    | `'flip' \| 'bump' \| 'twirl'`                                             | Picked with `rng`, never the same twice in a row in a race. `sillyAt` is one of the move's hops, never the trick's extra hop, the 10 → 11 jump or a landing on 20                                                                                                                             |
| `bunnyStarter(raceIndex)`     | `=> 0 \| 1`                                                               | Two players: player 1 starts a visit's first race, then the starter alternates (Dave (3)). Against Emma the child always starts                                                                                                                                                               |

- **The only judged thing** is "which square is N ahead" (Dave (1)). Numbers 11-20 are shown and spoken, never asked.
- **Nothing is persisted.** No progress field, no storage key, no Leitner read or write. The turn counts, the starter and the trick spacing live in the game's model for the visit. The app passes `Math.random`, tests a seeded generator (Dave (5)).

---

## 2. The board (Dave (6) item 1)

### 2.1 Parts

| Part             | What                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Squares**      | 20 cream clay tiles, side `s`, in two rows of 10, left to right in both: 1-10 in the bottom row (1 at the left), 11-20 in the top row (11 directly above 1, 20 at the right) |
| **Board band**   | A green land band behind the two rows                                                                                                                                        |
| **Numerals**     | One per square, centred                                                                                                                                                      |
| **Decade tint**  | Squares 10 and 20 a shade deeper (sand)                                                                                                                                      |
| **Carrot**       | Behind square 20's tile, its top 0.4 s above the square (Decision 4)                                                                                                         |
| **Start meadow** | A green clay mound under squares 1-2, where both bunnies wait                                                                                                                |
| **Spinner**      | Under the board: centred in portrait, at the board's right end in landscape (§ 4)                                                                                            |

Never a snake, spiral, circle or winding path, and no ladders, slides or squares that move a bunny (Dave (1), (2)).

### 2.2 The rule (`bunnyScene(A, tablet, landscape)`, proposed)

Vertical stack, from the top: a margin of 0.4 s (the carrot's top and the top-row bunnies' ears), row 11-20, a gap of 0.25 s, row 1-10, a gap of 0.2 s, then the bottom strip with the meadow on the left and the spinner. That is `K = 2.85` squares plus the spinner's side `D`.

```
s = min(A.width / 10, (A.height − Dmin) / 2.85, 96)     Dmin = 88 phones, 140 tablets
D = min(Dmax, A.height − 2.85 s)                        Dmax = 128 phones, 200 tablet portrait, 180 tablet landscape
block = 2.85 s + D, centred vertically in A             (the critters' rule, play-place.md:447)
board x = A.x + (A.width − 10 s) / 2
row 11-20 at y = top + 0.4 s;  row 1-10 at y = top + 1.65 s
square n: column (n − 1) % 10, in its row
meadow = (board x, top + 2.85 s), 2 s × s
spinner = portrait: centred under the board; landscape: its right edge on the board's right edge; top at top + 2.85 s
```

`s` is capped at 96 so a large iPad's board does not run wall to wall. Every hop stays inside the block (§ 3.2), so nothing leaves `A`.

### 2.3 Measured at the floors and the play-place tablets

Rects are (x, y) w × h. "Rows" gives each row's y. Every part lies inside `A`, and the meadow and the spinner never meet, on all 13 viewports.

| Viewport (insets)     | `A`                      | s    | Rows (11-20 / 1-10) | Meadow                      | Spinner            | Numeral | Square hit   |
| --------------------- | ------------------------ | ---- | ------------------- | --------------------------- | ------------------ | ------- | ------------ |
| 375 × 667             | (16, 259) 343 × 376      | 34.3 | 347.8 / 390.7       | (16, 431.9) 68.6 × 34.3     | (123.5, 431.9) 128 | 15.8    | 34.3 × 42.9  |
| 667 × 375             | (160, 146.4) 491 × 216.4 | 45.0 | 164.4 / 220.7       | (180.3, 274.8) 90.1 × 45    | (542.7, 274.8) 88  | 20.7    | 45 × 56.3    |
| 820 × 1180 (t24 b20)  | (16, 442.8) 788 × 685.2  | 78.8 | 604.6 / 703.1       | (16, 797.7) 157.6 × 78.8    | (310, 797.7) 200   | 36.2    | 78.8 × 98.5  |
| 1180 × 820 (b20)      | (245.2, 231) 918.8 × 537 | 91.9 | 315.3 / 430.2       | (245.2, 540.4) 183.8 × 91.9 | (984, 540.4) 180   | 42.3    | 91.9 × 114.8 |
| 390 × 844 (t47 b34)   | (16, 327) 358 × 451      | 35.8 | 451.8 / 496.6       | (16, 539.5) 71.6 × 35.8     | (131, 539.5) 128   | 16.5    | 35.8 × 44.8  |
| 844 × 390 (l/r47 b21) | (227, 143.9) 554 × 214.2 | 44.3 | 161.7 / 217.0       | (282.5, 270.2) 88.6 × 44.3  | (637.5, 270.2) 88  | 20.4    | 44.3 × 55.4  |
| 1180 × 820 (t24 b20)  | (245.2, 255) 918.8 × 513 | 91.9 | 327.3 / 442.2       | (245.2, 552.4) 183.8 × 91.9 | (984, 552.4) 180   | 42.3    | 91.9 × 114.8 |
| 834 × 1194 (t24 b20)  | (16, 446.4) 802 × 695.6  | 80.2 | 612.0 / 712.3       | (16, 808.5) 160.4 × 80.2    | (317, 808.5) 200   | 36.9    | 80.2 × 100.3 |
| 1194 × 834 (t24 b20)  | (248.8, 255) 929.2 × 527 | 92.9 | 333.3 / 449.4       | (248.8, 560.9) 185.8 × 92.9 | (998, 560.9) 180   | 42.7    | 92.9 × 116.1 |
| 744 × 1133 (t24 b20)  | (16, 430.6) 712 × 650.4  | 71.2 | 582.8 / 671.8       | (16, 757.3) 142.4 × 71.2    | (272, 757.3) 200   | 32.8    | 71.2 × 89    |
| 1133 × 744 (t24 b20)  | (225.4, 255) 891.6 × 437 | 89.2 | 292.1 / 403.6       | (225.4, 510.5) 178.3 × 89.2 | (937, 510.5) 180   | 41.0    | 89.2 × 111.4 |
| 768 × 1024 (t24 b20)  | (16, 402.2) 736 × 569.8  | 73.6 | 511.7 / 603.7       | (16, 692) 147.2 × 73.6      | (284, 692) 200     | 33.9    | 73.6 × 92    |
| 1024 × 768 (t24 b20)  | (231.7, 255) 776.3 × 461 | 77.6 | 315.9 / 413.0       | (231.7, 506.1) 155.3 × 77.6 | (828, 506.1) 180   | 35.7    | 77.6 × 97    |

- **Phones in portrait are the tight form:** squares are 34.3 pt (35.8 on a notched phone), as Dave computed. A square's hit rect is its column (`s` wide) by `1.25 s` tall (the row gap split between rows), so it is under 44 pt wide there. Squares take taps only for the guess, where a mis-tap just moves the marker and nothing is judged (§ 6). Her bunny's hit rect is bigger (§ 2.5). Q11 asks whether that is acceptable.
- **Phones in landscape are full:** the block is exactly `A`'s height (216.4 and 214.2).
- **Not measured:** other phones (wider ones only gain room), the 1366 × 1024 class (it hits the 96 cap), split view.

### 2.4 Look (the restyle's tokens)

- **Board band:** the Map's green land band, `linear-gradient(#d7f2c4, #a9d68c)` (`BAND_TINTS[0]`, `packages/core/src/map/mapTheme.ts:7`), with the restyle's band shadow (`play-games-restyle.md` § 2) at its `k`, `lo = #a9d68c`. Rect: the 20 squares' box grown by 0.12 s, clipped to `A` horizontally. Radius `min(48 k, 0.3 s)`.
- **A square:** a tile inset 0.04 s in its cell (so the band shows 0.08 s between tiles: no lines), radius 0.18 of the tile. Face: the cream clay tile, `linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)`. Shadow: `inset 0 2px 0 #ffffff, 0 Lpx 0 #dba675, 0 (L+2)px (L+4)px rgba(90,45,20,0.16)` with `L = clamp(3, round(0.06 s), 6)`: the restyle's weight-tag recipe (T5), sized to the tile.
- **Squares 10 and 20:** face `linear-gradient(#ffeec2, #e8c77a)` (`BAND_TINTS[1]`, `mapTheme.ts:8`), the same shadow. Phase 2's tint deepens every two rows from here (§ 14).
- **Numeral:** Fredoka 700 at 0.46 s, `#6b3f1f` (`INK`, `mapTheme.ts:3`), centred. Contrast (computed from the hex values): 7.86 : 1 at the cream tile's darkest stop, 5.47 : 1 at the sand tile's.
- **Start meadow:** a `ClayOval` (`mobile/src/screens/map/mapFx.tsx:35`) over the meadow rect's lower 0.55, stops `['#7fd364', '#6cc655', '#5cb945']` and slab `#3f8a2e` (Session End's green clay, `mobile/src/screens/sessionEnd/clayLook.ts:7-13`).
- **Backdrop:** the Hub's garden, as both games after restyle T1 (`play-games-restyle.md` T1).
- **Raised** (a square that takes a guess, § 6): the tile rises 0.05 s and its ledge doubles, over 200 ms ease-out; it sinks back the same way.

### 2.5 Bunnies on squares, sharing, and who takes a tap

| Where               | Bunny box (side, position)                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Alone on square n   | `s`, at (square.x, square.y − 0.12 s): feet in the tile's lower part, ears 0.12 s above it                     |
| Two on one square   | front: 0.78 s at (square.x + 0.02 s, square.y + 0.14 s); back: 0.78 s at (square.x + 0.22 s, square.y − 0.1 s) |
| On the start meadow | 0.9 s each: hers at (meadow.x + 0.05 s, meadow.y), the other at (meadow.x + 1.05 s, meadow.y)                  |

- **Who stands in front:** the bunny whose turn it is. After a trick, Emma's bunny stays in front until the child spins or catches it (§ 3.4), then hers steps forward (150 ms swap).
- **Every bunny** has the contact shadow `imageShadow(3, 6, 'rgba(60,30,10,0.28)')` on phones and `(4, 8, …)` on tablets (`mobile/src/components/imageShadow.ts:12`; restyle T6).
- **Who takes a tap** (the game decides by phase, so rects may overlap):

| Phase                                | Taps go to                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Her turn, before her spin            | The spinner. A trick's catch window: Emma's bunny (its square grown by 0.25 s). Her own bunny: a wiggle                              |
| Her turn, after her spin, hops left  | Her bunny (its square grown by 0.25 s on each side). During a guess: her bunny's own square only, and each square ahead its own rect |
| Her hops done, Emma's turn, any beat | Nothing but a wiggle on a tapped bunny; the spinner ignores taps                                                                     |
| Two players                          | As above for the player whose turn it is; on a shared square the tap goes to that player's bunny                                     |

Back is live in every phase.

---

## 3. The bunnies (Dave (6) item 2)

### 3.1 Look, colours, Emma's mark

Three clay pictures from the pack generator (§ 13), one family drawn the same way: a small round bunny sitting upright in three-quarter view facing right, long upright ears, a round tail.

| Bunny           | Body                        | Mark                                                                                                               |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Hers (player 1) | Warm caramel, cream belly   | None                                                                                                               |
| Player 2's      | Soft lilac, cream belly     | None                                                                                                               |
| Emma's          | Soft blue-grey, cream belly | **A sage-green scarf tied in a bow at its neck: Emma's own sash** (her `idle` art, `mobile/assets/emma/idle.webp`) |

The app mirrors a picked variant that faces left (`scaleX −1`), so every bunny faces right, the way the path runs.

### 3.2 The hop, the pace and the names

- **A hop:** a 360 ms arc to the next square's bunny box, apex 0.28 s above the higher resting box, x linear, y parabolic. Before take-off a 60 ms squash (scaleY 0.88, scaleX 1.06 about the feet); on touchdown a 120 ms settle (scaleY 0.9 → 1, spring 300 / 22). The apex keeps every hop inside the block: 0.12 s of ears + 0.28 s = the 0.4 s top margin.
- **The name:** at touchdown, the square's line, `guide.play.bunny.square.<n>` ("Eight!", § 12), with its caption in the ribbon. Every hop of every bunny is named (Dave (1)). No hop sound: the name is the sound.
- **Her pace:** one tap on her bunny is one hop. A tap during a hop or a name is held, at most one; more are ignored. A held tap's hop starts when the name ends, so each name finishes before the next hop (Dave (1)). Without a clip, the line player's caption walk (165 wpm) sets the end (`play-place.md:144`).
- **Emma's pace:** her bunny's next hop starts 150 ms after the name ends.
- **10 → 11:** one hop, 640 ms, from square 10 up and back to 11 over the top row, apex 0.25 s above 11's resting box (so 0.37 s above the tile, inside the margin). The bunny faces left for the jump and turns back on touchdown (120 ms). Named "Eleven!" at touchdown, like any hop. No guide line is drawn.
- **A wiggle** (a tap with nothing to do): rotate ±8° twice about the feet, 300 ms, no sound.

### 3.3 Whose turn (Decision 6)

At a turn's start: the spinner's hub cross-fades to that bunny (200 ms, § 4); the bunny bounces once (0.15 s, 250 ms, the critters' bounce, `play-place.md:488`); a glow fades in under its feet and travels with it until the turn ends (fade out 200 ms). The glow is the Hub's suggested glow at half size, as the restyle's hunt rings (T11): an oval 0.8 s × 0.24 s with `0 0 0 4px #fff3a8, 0 0 18px 6px rgba(255,210,63,0.8)` on tablets and `0 0 0 3px #fff3a8, 0 0 12px 4px rgba(255,210,63,0.8)` on phones. Static: no pulse.

### 3.4 Emma's bunny's moves (against Emma only)

| Move           | How it looks                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **flip**       | One hop of the move is a somersault: rotate 360° over a 520 ms arc, same apex                                                                                                                                                                                                                                 |
| **bump**       | A normal hop; on touchdown it tips back onto its bottom (rotate −18° about the feet, scaleY 0.82, 120 ms), sits 300 ms, springs up (300 / 18). The name plays from touchdown, under the bump                                                                                                                  |
| **twirl**      | Spins round in the air: scaleX 1 → −1 → 1 → −1 → 1 over a 520 ms arc (Decision 9)                                                                                                                                                                                                                             |
| **The trick**  | After its real hops, one hop more, named correctly ("Eight! Nine! Ten! Eleven!", Dave (2)). 300 ms after that name: Emma `cheering`, "Hee hee! Did I count right?". **The catch window** opens at the extra hop's touchdown and closes when the child spins                                                   |
| **Caught**     | Her tap on Emma's bunny cuts the line. The bunny hops back one square: a 600 ms backward arc, still facing right, `sfx-boing` at take-off, the square's name at touchdown ("Ten!"). Emma `puzzled-tilt` at touchdown, then 200 ms after the name `cheering`, "Oops! You caught me!"                           |
| **Not caught** | She spins: the window closes, the extra square stays. No line                                                                                                                                                                                                                                                 |
| **The nap**    | Instead of spinning: Emma `sleepy`; her bunny curls down (scaleY 0.72 about the feet, rotate 8°, 300 ms) and three drawn Z shapes rise from its head, 400 ms apart, each 0.5 s up and fading over 1200 ms, for 2 s. Then it springs up (300 / 18) and Emma `cheering`, "Oh! I fell asleep!". Her turn is over |

- The backward arc is 600 ms so a boing under 600 ms (its brief, `play-place.md:717`) ends before the name starts. Thomas picked `sfx-boing__v1` on 2026-10-25 and Kevin is shipping it (the coordinator's DECISIONS entry); until it is in the app, the hop-back is silent (`play-place.md:719`).
- The Z shapes are drawn paths (0.22, 0.28 and 0.34 s tall), cream `#fff8ee` with a 2 pt `#e3c6a6` ledge, never text. A sleeping-bunny picture is optional art (§ 13, Q8).

### 3.5 The munch, the flop and the share

- **The carrot lifts:** at the "Twenty!" touchdown it rises out from behind tile 20 (translateY −0.35 s, 250 ms, spring 260 / 16) and draws above the tile from then on, beside the bunny's face.
- **A munch:** 3 nibbles, each a head-bob (rotate +10° about the feet, 150 ms down, 150 ms up); each nibble scales the carrot by 0.92 about its base. 900 ms. The carrot never disappears: it is still the goal for a bunny on its way.
- **Emma's bunny flops over laughing:** rotate −90° about the feet (250 ms), rock ±10° twice (600 ms), spring upright (300 ms).
- **It comes to share:** one leap from its square to square 20's back place, 700 ms, apex as a hop, **unnamed**: a celebration after the race, not a move in it (Q3). Then both munch, alternating nibbles, 1800 ms.

---

## 4. The spinner (Dave (6) item 3)

Its rect is § 2.3's (side `D`: 88 on phones in landscape, 128 in portrait, 180-200 on tablets). In thumb reach: bottom-centre in portrait (both thumbs on a phone, and fair to two players side by side), bottom-right in landscape (the centre of a phone in landscape is out of thumb reach).

| Part        | Look                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base        | A wood clay disc: `MAP_BUTTON_LOOK.math` face and shadow at `s = D / 118` (`mobile/src/screens/hub/mapButtonLook.ts:12-16`), the Play tiles' wood                                                                                |
| Dial        | Inset 0.05 D (radius 0.45 D): three cream sectors of 120° (the square's cream face), 0.025 D apart so the wood shows between them: no lines. Sector 1 centred at the top, 2 lower right, 3 lower left                            |
| In a sector | Its numeral, Fredoka 700 at 0.2 D, `#6b3f1f`, upright, centred 0.27 D from the middle on the sector's mid-line; outside it, toward the rim, its 1-3 dots, `#6b3f1f`, 0.075 D each, 0.03 D apart, in a row 0.38 D from the middle |
| Arrow       | A wood pointer from the middle to 0.43 D, 0.07 D wide, rounded tip: face `linear-gradient(90deg, #c98a55, #7d4a26)`, `0 3px 0 #7d4a26` (the restyle's oar, T4). It turns; the dial never does, so numerals stay upright          |
| Hub         | A cream clay disc of 0.28 D over the arrow's root, holding the turn's bunny at 0.24 D (Decision 6)                                                                                                                               |

At D 88: numeral 17.6 pt, dots 6.6 pt; at D 128: 25.6 and 9.6; at D 200: 40 and 15.

- **A spin:** a tap anywhere on the spinner on her turn, before her spin. Home's press (the face sinks 6 × D / 118 over 120 ms, `play-place.md:88`), plink (0.3, `mobile/src/screens/play/playKit.ts:32`). The result is drawn at the tap (`rng`). The arrow turns two full turns plus the way to its stop over 1000 ms, `Easing.out(Easing.cubic)`, no overshoot. The stop is the sector's mid-line ± up to 30°, so it never stops within 30° of a border: no slow-down near a border, no near miss, no wobble (Dave (2)).
- **The result:** the sector's numeral and dots take the lit pulse (1 → 1.2 → 1, 400 ms, the critters', `play-place.md:500`) and stay lit, white glow `inset 0 0 0 3px #fff3a8`, until the move ends. **One dot dims per hop** (opacity 1 → 0.3, 150 ms at each take-off, left to right; Decision 7). A move that stops on 20 early leaves its other dots lit until the arrival beat. The number is never spoken (Dave (1)).
- **Emma's turn:** the same spinner, her bunny in the hub; it spins by itself (no press, no plink) 300 ms after her turn starts, 500 ms after the child's last name (Dave (2)), unless she naps.
- **Not her moment:** the spinner ignores taps, with no sound and no dimming.

---

## 5. One race, step by step

### 5.1 The start

| t                  | What happens                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 (after the pick) | The picker fades out (200 ms) and the race fades in (200 ms): the board, the carrot, both bunnies on the meadow, the spinner. The starter's turn starts (§ 5.2); her spinner is live from here |
| fade-in end + 300  | Emma `listening`, "Race my bunny to the carrot! Spin, then hop!" (against Emma) or "Race to the carrot! Spin, then hop!" (two players). On a visit's first race, the tap hand with it (§ 5.4)  |
| line end           | Emma `idle`                                                                                                                                                                                    |

The open line plays at every race's start: it is the race's "ready, go", after a pick she made. A spin during it keeps the line; her first name cuts it.

### 5.2 Her turn

| t                                                 | What happens                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| T0                                                | The turn cue (§ 3.3). The spinner is live                                                                                   |
| her spin tap                                      | Plink; the arrow turns 1000 ms                                                                                              |
| S (the stop)                                      | The sector lights. Her bunny takes hop taps                                                                                 |
| S + 200, on an asking turn                        | "Where will you land?" (§ 6)                                                                                                |
| each tap                                          | A hop, a name at touchdown, a dot dims (§ 3.2, § 4)                                                                         |
| the last name's end                               | A guess resolves (§ 6). Her glow fades; the sector's light fades (200 ms). A landing on 20 starts the arrival beat (§ 7)    |
| last name end + 200 (or "You knew it!" end + 200) | Emma's turn starts (E0), so her spinner spins 500 ms after the name (Dave (2)). Two players: the other player's T0 at + 500 |

No timer anywhere: the game waits for her at every step for as long as she likes.

### 5.3 Emma's turn

| t                                    | What happens                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0                                   | The turn cue for Emma's bunny. Emma `idle`                                                                                                                          |
| E0 + 300                             | The nap (§ 3.4), or the spinner spins by itself (1000 ms)                                                                                                           |
| stop + 300                           | Her bunny's hops at her pace, named; a silly hop on its chosen hop; the trick's extra hop last                                                                      |
| the last name's end + 300 (no trick) | Her turn ends: the child's T0                                                                                                                                       |
| with a trick                         | "Hee hee! Did I count right?" 300 ms after the extra name; the catch window is open from the extra hop's touchdown; the child's T0 comes 300 ms after the line ends |
| after the nap's line                 | The child's T0, 300 ms after "Oh! I fell asleep!" ends                                                                                                              |

Emma's lines are never cut by the game's sounds; a name that starts while she speaks cuts her line, because the square's name is the content (as a raft total cuts the line before it, `play-place.md:270`).

### 5.4 The tap hand (Decision 10)

The story tap cue (`StoryTapCue`, `mobile/src/screens/wordSong/StoryTapCue.tsx:54`: 48 pt on phones, 64 on tablets, the fingertip on the point), as Letter critters' drag hint uses it (`mobile/src/screens/play/DragHintHand.tsx:42-53`: three loops of 2 s), but tapping in place.

- **"Tap the spinner":** with the open line of a visit's first race, on the spinner's middle; again whenever 8 s pass with no spin on her turn (`HINT_IDLE_MS`, the critters'), until her first spin of the visit.
- **"Tap your bunny":** after her first stop of the visit (and after the question line, if any), when 3 s pass with no hop, on her bunny; again after 8 s idle, until her first hop of the visit.
- Never again that visit after the move is made. No line with it. It never takes a touch; VoiceOver skips it. A spin or a hop fades it out (200 ms).

---

## 6. "Where will you land?" (Dave (6) item 4)

| t                         | What happens                                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S + 200 (an asking turn)  | Emma `attentive-pointing`, "Where will you land?". Every square ahead of her bunny, up to 20, rises (§ 2.4) and takes taps. Her own square and those behind stay flat. Lighting all of them gives nothing away (Dave (2))                                                               |
| a tap on a square ahead   | The marker springs onto it (scale 0 → 1, spring 300 / 22), plink (0.3). Another square moves it there (a 200 ms arc, 0.2 s high), plink. Her bunny stays tappable                                                                                                                       |
| her first hop             | The raised squares sink (200 ms) and stop taking taps. No marker: the question is skipped, with no line and nothing lost                                                                                                                                                                |
| the move's last touchdown | The name plays as always                                                                                                                                                                                                                                                                |
| **match**, name end + 100 | The marker pops (scale 1 → 1.4, fade, 250 ms), `sfx.sparkle` (0.55), Word Song's burst from the square's centre (`SparkleBurst`, `mobile/src/screens/wordSong/WordChip.tsx:73`; distance 75 × k, glyph 16 × k, k 1 phones, 1.5 tablets, as the hunt's), Emma `cheering`, "You knew it!" |
| **miss**, name end        | The marker sinks into the grass: translateY +0.15 s, scaleY 1 → 0.2, fade, 300 ms ease-in. No sound, no line, no pose (Dave (2))                                                                                                                                                        |

- **The marker:** a round clay disc of `max(0.36 s, 16)` pt centred at (square.x + 0.82 s, square.y + 0.12 s): the tile's top-right corner, clear of the numeral's glyph on every form of § 2.3 (it may overhang the tile into the row gap). It is in her bunny's colour: hers is the Number Garden wood face (`MAP_BUTTON_LOOK.math.face`), player 2's `radial-gradient(circle at 40% 32%, #eee2ff 0%, #c2aee8 100%)` (`BAND_TINTS[3]`, `mapTheme.ts:10`). On it, a cream (`#fff8ee`) paw print, drawn: a pad 0.42 × 0.34 of the disc and four toes of 0.16. Shadow `0 2px 0 rgba(60,30,10,0.35), 0 4px 6px rgba(60,30,10,0.2)`.
- **Judged on the last square only** (Decision 8): a hop that lands on the marker mid-move passes it; the bunny stands beside it and hops on.
- A guess never changes a move. Never "oops", "not quite" or "try again"; no red, X, buzzer or poof (`play-place.md:215`).
- **Two players:** the same rule per player, the marker in that player's colour.

---

## 7. The beats (Dave (6) item 5)

`A0` = a learner bunny's touchdown on 20; `A1` = the end of its "Twenty!". From `A0` the board ignores taps except Back. "The arrival sound" is the jingle when it ships (§ 12.3), or `sfx.cheer` (0.5, `playKit.ts:34`) as Dave ruled until then; never both.

**She arrives first (against Emma):**

| t                                                         | What happens                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| A0                                                        | "Twenty!". The carrot lifts (§ 3.5)                                      |
| A1                                                        | Her bunny munches (900 ms); the arrival sound; the burst from the carrot |
| the munch's or the sound's end, whichever is later, + 150 | Emma `celebration`, "You got there first!"                               |
| its end + 300                                             | Emma's bunny flops over laughing (1150 ms), then leaps to share (700 ms) |
| leap end                                                  | Both munch (1800 ms)                                                     |
| munch end + 300                                           | Emma `cheering`, "What a race!"                                          |
| its end + 800                                             | The race fades out (200 ms) and the picker fades in (200 ms), silently   |

**Emma's bunny arrives first:**

| t                                                         | What happens                                                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| its "Twenty!" ends                                        | The carrot lifts; Emma's bunny munches 2 nibbles (600 ms). No arrival sound, no burst                                                                                                  |
| munch end + 150                                           | Emma `cheering`, "Lucky me! Now hop yours to the carrot!"                                                                                                                              |
| its end + 300                                             | Her turn. From now on only her turns come, with the asking rule as before                                                                                                              |
| her A0 / A1                                               | "Twenty!"; at A1 her bunny munches, the arrival sound, the burst                                                                                                                       |
| the munch's or the sound's end, whichever is later, + 150 | Emma `cheering`, "You did it!": the bundled canon clip keyed by that text (`mobile/src/audio/canonAudioRegistry.ts:1575`), through the praise clips' canon seam (`playLines.ts:53-58`) |
| its end + 300                                             | Both munch (1800 ms)                                                                                                                                                                   |
| munch end + 300                                           | "What a race!", then the picker as above                                                                                                                                               |

**Two players:** the first to arrive gets A0-A1 and "You got there first!" (Emma `celebration`); the other plays on alone and gets A0-A1 and "You did it!" (`cheering`); both munch; "What a race!"; the picker. No flop, no leap: Emma has no bunny.

- **Why it is safe to lose:** the race is luck and Emma says so; she never says she won or the child lost; the child's own arrival beat comes in every race (Dave (4)).
- **The way back:** "What a race!" goes to the picker, never into another race. Back goes to the Play place. No line says again, next or more (AC C8).

---

## 8. The start picker (Dave (6) item 6)

The game opens on it, and every race returns to it. Two pictures, no text, one tap (Dave (3)).

| Viewport             | Card side q | Card 1 (race Emma) | Card 2 x |
| -------------------- | ----------- | ------------------ | -------- |
| 375 × 667            | 163.5       | (16, 365.3)        | 195.5    |
| 667 × 375            | 194.7       | (202.8, 157.2)     | 413.5    |
| 820 × 1180 (t24 b20) | 340         | (54, 615.4)        | 426      |
| 1180 × 820 (b20)     | 340         | (348.6, 329.5)     | 720.6    |

Rule: `q = min((A.width − gap) / 2, 0.9 × A.height, 200 phones / 340 tablets)`, gap 16 / 32, the pair centred in `A`. Measured on the other 9 viewports too; every pair fits (q 171 to 340).

- **A card:** the Hub bubble's cream clay (`#fff8ee`; shadow `inset 0 2px 0 #ffffff, 0 4px 0 #e3c6a6, 0 7px 10px rgba(60,30,10,0.18)` on phones and `inset 0 3px 0 #ffffff, 0 6px 0 #e3c6a6, 0 10px 16px rgba(60,30,10,0.2)` on tablets, the restyle's slot card, T11), radius 0.18 q. Inside: the start meadow's green mound across its lower 0.3 q, and two bunnies of 0.44 q standing on it, at 0.06 q and 0.5 q from the left.
- **Card 1:** her bunny and Emma's bunny. **Card 2:** her bunny and the lilac bunny. Her bunny is on the left in both, so the card that differs is the bunny on the right, and Emma's carries her sash.
- **Tap:** the Play-place tile's press (face sinks 8 × q / 118 over 120 ms, `play-place.md:122`), plink, then § 5.1.
- **Silent:** no line on the picker, the first time or later (Q5). Emma `idle`. Back goes to the Play place.
- **Phase 2's board choice is not designed.** In portrait there is room for a second row of cards (phone: two rows of 163.5 in 376); a phone in landscape has none (216.4 tall), so phase 2 measures its own picker (§ 14).

---

## 9. The Play place: the third tile and the shelf (Dave (6) item 7)

`play-place.md:146`: "When a third arrives, the tiles become a row per kind (numbers, letters, toys)". The kind is the world of the game's `opensAt`: numbers (`math`) are raft and bunny, letters (`word-song`) the critters.

- **Two open games** (a learner before adding to ten: bunny and critters): today's two tiles, as `playPlaceLayout` lays them (`mobile/src/layout/playPlaceLayout.ts:24`), bunny in the left column, critters in the right. Numbers left, letters right, as the Hub's cards.
- **Three open games:** two rows per kind. Tile side `t3 = min(card width, (card height − gap) / 2)`, gap 16 phones, 24 tablets. The letters row sits at the card boxes' bottom (the thumb zone), its one tile centred between the columns. The numbers row sits `gap` above it, raft in the left column and bunny in the right, each centred in its column. One tile never sits alone in a column with a hole beside it.

| Viewport             | t (two games) | t3    | Numbers row y (raft x, bunny x) | Letters row y (critters x) |
| -------------------- | ------------- | ----- | ------------------------------- | -------------------------- |
| 375 × 667            | 163.5         | 137.3 | 352.3 (29.1, 208.6)             | 505.7 (118.8)              |
| 667 × 375            | 166.5         | 140.0 | 64.8 (315.3, 497.8)             | 220.8 (406.5)              |
| 820 × 1180 (t24 b20) | 363.9         | 311.5 | 476.5 (64.6, 443.9)             | 811.9 (254.3)              |
| 1180 × 820 (b20)     | 378           | 324   | 106 (419, 813)                  | 454 (616)                  |

The numbers row's top is the card boxes' top on every form, so nothing moves into Emma's frame or the bubble. Every tile is at least 137 pt.

- **The bunny tile:** Number Garden wood (`LOOK.math`), holding `ui-bunny` (§ 13) at 0.78 t, as the other two (`play-place.md:120-121`). Label "Bunny race", `testID="play-tile-bunny"`.
- **The restyle** keeps the Play place screen as it is (`play-games-restyle.md` Decision 9), so the shelf adds only a tile and a row rule. A learner who reaches adding to ten sees the shelf regroup once, on her next visit to the place; nothing announces it (`play-place.md` § 1.2).

---

## 10. Wireframes (positions from § 2.3; the art is not to scale, the annotations are)

```
PHONE PORTRAIT 375×667: her turn, mid-move (spun 3 from 6, two hops made)
+--------------------------------------------+
| (<)                                        |
|  .-----.  +------------------------------+ |
| ( Emma  ) | Eight!                       | |
| (  147  ) +------------------------------+ |
|  '-----'                                   |
|                                       \|/  |
| [11][12][13][14][15][16][17][18][19][20]   |
|                                            |
| [ 1][ 2][ 3][ 4][ 5][ 6][ 7][B8][ 9][10]   |
|  E                 .-------.               |
| ~meadow~          /   1    \               |
|                  |  3 (B) 2 |              |
|                   \   •••  /               |
|                    '-------'               |
+--------------------------------------------+
  s 34.3: rows at y 347.8 (11-20) and 390.7 (1-10); meadow (16, 431.9) 68.6 × 34.3;
  spinner (123.5, 431.9) 128. B = her bunny, the glow under it; E = Emma's bunny on the
  meadow. The hub shows B; two of the lit sector's three dots are dimmed. \|/ = the
  carrot's top above 20 (it stands behind the tile).
```

```
PHONE LANDSCAPE 667×375: a guess (her turn 2, spun 3, on square 5)
+--------------------------------------------------------------+
| (<)        +----------------------------------------------+  |
|  .------.  | Where will you land?                         |  |
| ( Emma   ) +----------------------------------------------+  |
| ( point- )                                          \|/      |
| ( ing    )   [11][12][13][14][15][16][17][18][19][20]        |
| (        )   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^        |
|  '------'    [ 1][ 2][ 3][ 4][B5][*6][ 7][ 8][ 9][10]        |
|                                  ^^^^^^^^^^^^^^^^^^^^        |
|              E                             .------.          |
|              ~meadow~                     / 1     \          |
|                                          | 3 (B) 2 |         |
|                                           '-------'          |
+--------------------------------------------------------------+
  s 45; board (180.3, 164.4) 450.4 wide; meadow (180.3, 274.8) 90.1 × 45; spinner
  (542.7, 274.8) 88. ^^^ = squares ahead of B, raised and tappable; B's square and those
  behind stay flat. * = her marker on 6 (tap another square to move it, or tap B to hop).
```

```
TABLET PORTRAIT 820×1180 (t24 b20): Emma's turn ended with a trick (spun 3 from 6, hopped 4)
+--------------------------------------------------------------+
| (<)                                                          |
|  .----------.   +---------------------------------------+    |
| (   Emma     )  | Hee hee! Did I count right?           |    |
| (  cheering  )  +---------------------------------------+    |
| (   306.8    )                                               |
|  '----------'                                                |
|                                                       \|/    |
| [ 11 ][ 12 ][ 13 ][ 14 ][ 15 ][ 16 ][ 17 ][ 18 ][ 19 ][ 20 ] |
|                                                              |
| [  1 ][  2 ][  3 ][  4 ][  5 ][ B6 ][  7 ][  8 ][  9 ][ E10] |
|   .--------.            .------------.                       |
|   ( meadow )           /      1       \                      |
|   '--------'          |  3   (E)    2  |                     |
|                        \              /                      |
|                         '------------'                       |
+--------------------------------------------------------------+
  Back (16, 34.7) 74.7; Emma (16, 120) 306.8; ribbon (338.8, 136) 465.2 wide; block top 573.1;
  rows at y 604.6 and 703.1, s 78.8; meadow (16, 797.7) 157.6 × 78.8, empty now; spinner (310,
  797.7) 200, E still in the hub. E went 7, 8, 9 on its 3 and one more to 10. The catch window
  opened at E's touchdown on 10: a tap on E10 now hops it back to 9. Her turn (B in the hub)
  starts 300 ms after the line; the window stays open until she spins.
```

```
TABLET LANDSCAPE 1180×820 (b20): she arrived first
+----------------------------------------------------------------------------------+
| (<)      +----------------------------------------------------------------+      |
|  .-----. | You got there first!                                           |      |
| ( Emma ) +----------------------------------------------------------------+      |
| (celeb-)                                                  (carrot, lifted)       |
| (ration)  [11][12][13][14][15][16][17][18][19][B20]  * the burst                 |
|  '-----'                                                                         |
|           [ 1][ 2][ 3][ 4][ 5][ 6][ 7][E8][ 9][10]   E flops, then leaps to 20   |
|           ~meadow~                              .-------.                        |
|                                                | 3 (B) 2 |                       |
|                                                 '-------'                        |
+----------------------------------------------------------------------------------+
  A (245.2, 231) 918.8 × 537; s 91.9; rows at y 315.3 and 430.2; meadow (245.2, 540.4);
  spinner (984, 540.4) 180; Emma (16, 96) 213.2; ribbon (245.2, 112) 918.8 × 103.
```

```
PICKER, PHONE PORTRAIT 375×667
+--------------------------------------------+
| (<)                                        |
|  .-----.  +------------------------------+ |
| ( Emma  ) |                              | |
| ( idle  ) +------------------------------+ |
|  '-----'                                   |
|                                            |
|  +-----------------+   +-----------------+ |
|  |                 |   |                 | |
|  |   (B)    (E~)   |   |   (B)    (L)    | |
|  |  ~~~~mound~~~~  |   |  ~~~~mound~~~~  | |
|  +-----------------+   +-----------------+ |
+--------------------------------------------+
  q 163.5: card 1 (16, 365.3), card 2 at x 195.5. (E~) = Emma's bunny with her sash;
  (L) = the lilac bunny. No line.
```

```
SHELF, PHONE PORTRAIT 375×667: three games
+--------------------------------------------+
|(⌂)                                         |
|          (  Emma 204, idle  )              |
|  +--------------------------------------+  |
|  | What shall we play?                  |  |
|  +--------------------------------------+  |
|                                            |
|   +---------+             +---------+      |
|   | ~raft~  |             | ~bunny~ |      |
|   +---------+             +---------+      |
|                +---------+                 |
|                |critters |                 |
|                +---------+                 |
+--------------------------------------------+
  t3 137.3: numbers row (wood) at y 352.3, raft x 29.1, bunny x 208.6; letters row
  (honey) at y 505.7, critters x 118.8. With two games (before adding to ten): one row,
  bunny left and critters right, as today's two tiles.
```

---

## 11. Reduce Motion and VoiceOver (Dave (6) item 8)

### 11.1 Reduce Motion

Lines and sounds keep their times. Taps are the same.

- **A hop:** the bunny fades out on its square and in on the next (120 ms each); the name at the fade-in's end. The 10 → 11 jump, silly hops, the hop-back and the share leap are the same fade. The bump and the flop do not play.
- **The spinner:** no turn; the arrow cross-fades from its old angle to the result (300 ms). The lit sector fades in (no pulse); dots dim by fade as before.
- **Whose turn:** no bounce; the hub cross-fades and the glow fades in.
- **The guess:** squares ahead take the raised ledge at once with a 150 ms fade, no rise. The marker fades in (150 ms) and moves by fades. A match: the marker fades out (200 ms), no burst; the sparkle and the line play. A miss: it fades out (300 ms).
- **The nap:** her bunny dims to 0.7 and the three Z shapes fade in, still, for 2 s.
- **The munch:** the carrot steps down in size with 100 ms fades; no bob. The carrot's lift is a fade to its lifted place.
- **The burst:** none. The arrival sound and lines play.

### 11.2 VoiceOver labels (labels only: Lily speaks none of them)

| Element                  | Label                                                         | Role and activate                                                                      |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A square                 | "Square seven"                                                | Not a button; during a guess, squares ahead are buttons and activate places the marker |
| Her bunny (against Emma) | "Your bunny, square seven"; on the meadow "Your bunny, start" | Button: one hop when she has hops left; otherwise nothing                              |
| Two players              | "Brown bunny, square seven", "Purple bunny, square four"      | Button for the player whose turn it is                                                 |
| Emma's bunny             | "Emma's bunny, square nine"                                   | Button in the catch window (catches the trick); otherwise not a button                 |
| The spinner              | "Spinner"; after a stop "Spinner, three" (Dave (6) item 8)    | Button on her turn before her spin                                                     |
| The carrot               | "Carrot, square twenty"                                       | Not a button                                                                           |
| The marker               | "Your guess, square eight"                                    | Not a button                                                                           |
| Picker cards             | "Race Emma's bunny", "Two bunnies"                            | Buttons                                                                                |
| The tile                 | "Bunny race"                                                  | Button                                                                                 |

They sit in `playLines.ts` beside the spoken rows, so a language version swaps rows. testIDs: `bunny-square-<n>`, `bunny-piece-hers`, `bunny-piece-two`, `bunny-piece-emma`, `bunny-spinner`, `bunny-carrot`, `bunny-marker`, `bunny-pick-emma`, `bunny-pick-two`, `bunny-burst`.

---

## 12. Lines and sounds

### 12.1 Lines (Dave (5), kind `'play'`, Lily, through `playLines.ts`)

| Id (proposed)                        | Caption text (= Lily input unless noted)           | When                                             | Chars   |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------ | ------- |
| `guide.play.bunny.open`              | "Race my bunny to the carrot! Spin, then hop!"     | A race against Emma starts                       | 44      |
| `guide.play.bunny.open.two`          | "Race to the carrot! Spin, then hop!"              | A two-player race starts                         | 35      |
| `guide.play.bunny.ask`               | "Where will you land?"                             | An asking turn (§ 6)                             | 20      |
| `guide.play.bunny.knew`              | "You knew it!"                                     | A match                                          | 12      |
| `guide.play.bunny.trick`             | "Hee hee! Did I count right?"                      | After the trick's extra hop                      | 27      |
| `guide.play.bunny.caught`            | "Oops! You caught me!"                             | The trick caught                                 | 20      |
| `guide.play.bunny.nap`               | "Oh! I fell asleep!"                               | After the nap                                    | 18      |
| `guide.play.bunny.first`             | "You got there first!"                             | The first learner bunny to arrive                | 20      |
| `guide.play.bunny.lucky`             | "Lucky me! Now hop yours to the carrot!"           | Emma's bunny arrives first                       | 38      |
| `guide.play.bunny.close`             | "What a race!"                                     | The end of every race                            | 12      |
| `guide.play.bunny.square.20`         | "Twenty!" (input "Twenty,")                        | A landing on 20                                  | 7       |
| `guide.play.bunny.square.<n>`, 1-9   | "One!" … "Nine!" (inputs "One," … "Nine,")         | A landing on n: the raft totals' inputs, 0 chars | 0       |
| `guide.play.bunny.square.<n>`, 10-19 | "Ten!" … "Nineteen!" (inputs "Ten," … "Nineteen,") | A landing on n: shared with the raft island      | 80 or 0 |
| "You did it!"                        | the bundled canon clip                             | Her solo finish (§ 7)                            | 0       |

**253 characters, or 333 if the bunny renders 10-19 before the raft island** (Dave (5)); the dry run prints the real figure (`play-place.md:636`). C8 holds: no Emma line says again, next, more, round, win, fast or "not a word". Ear-test predictions are Dave's (5).

### 12.2 Sounds

Shipped: plink (0.3), sparkle (0.55), cheer (0.5) (`playKit.ts:32-34`). `sfx-boing` (Thomas's pick, Kevin shipping it; silent until it lands). No poof, no chime (`play-place.md:215`). No spinner whirr and no snore in phase 1: Dave lists them as optional with unknown cost, and the arrow and the Z shapes carry both moments.

### 12.3 The carrot jingle (Thomas OK'd the idea in principle, 2026-10-25: "sure sounds like good ideas", the coordinator's DECISIONS entry)

- **The moment:** a learner bunny reaching the carrot, every time: her first arrival, her solo finish after "Lucky me!", and each player's arrival in two players. Never Emma's bunny's arrival, never a guess. It replaces `sfx.cheer` in those beats (one sound, not two); until it ships, or if Thomas picks none, the cheer plays as Dave ruled.
- **Length:** about 2 s; hard cap 3.0 s, the fade-out included.
- **Never over a voice:** it starts at `A1`, the end of "Twenty!", with the munch and the burst, and Emma's line waits for its end + 150 ms (§ 7). It cannot overlap a square's name: no name plays after 20.
- **Level:** volume 0.5, the cheer's (`playKit.ts:34`), so it sits under Lily's lines.
- **Name (proposed):** `sfx-jingle-carrot`, in `mobile/assets/audio/sfx/`, played through the play kit like the other effects.
- **Generation prompt (ElevenLabs Music), candidate A:** "A tiny, warm celebration jingle for a gentle children's garden game, about two seconds long. A bright, bouncy rising phrase of four or five notes on marimba and glockenspiel with a soft pizzicato string pluck, ending on one happy major chord that rings briefly and fades. Cosy, playful and soft, like a little bunny reaching its carrot. Only those instruments: no vocals, no lyrics, no drums, no brass fanfare, no electronic synths, no sound effects, no applause."
- **Candidate B:** "A tiny, warm celebration jingle for a gentle children's garden game, about two seconds long. A bright, bouncy rising phrase of four or five notes on ukulele and xylophone, ending on one soft bell note over a happy major chord that rings briefly and fades. Cosy, playful and soft, like a little bunny reaching its carrot. Only those instruments: no vocals, no lyrics, no drums, no brass fanfare, no electronic synths, no sound effects, no applause."
- **Make 3-4 candidates and let Thomas pick by ear** on a candidates page, as Kevin's splash and boing were picked (the coordinator's DECISIONS entry). **Not checked:** whether ElevenLabs Music renders under 3 s, and its price. If its shortest render is longer, trim to the phrase with a 150 ms fade-out so the file ends by 3.0 s; if no clean phrase comes, the Sound Effects API on the same key, with the same text, is the fallback. Kevin checks both before the spend popup.
- **Doubt for Dave:** Q4.

---

## 13. Art: five clay subjects for the pack generator (Dave (5))

Made with the pack generator in its clay style, as `ui-raft` and `ui-critters` were (`play-place.md` § 5.2; `style: "clay"`, `scripts/packPictureLib.ts`), **two variants each: 10 images, about $0.78** at $0.078 an image (Dave (5)). `--dry-run` prints the real figure before any call; it runs under its own spend popup. The batch number is the next free one when the run happens, so this spec ships no manifest file: the rows below go into one when it does (the fields of `PictureManifestEntry`, `packPictureLib.ts:146-153`; tier `game-art`, style `clay`, as `design/native/play-place-art-manifest.json`). Thomas picks one of each on the contact sheet, the three bunnies side by side so they come out as one family.

The three bunnies share one sentence word for word, so the generator draws one family: **"A small round clay bunny sitting upright in three-quarter view facing right, with long upright ears, a round fluffy tail, big friendly eyes and tiny paws."**

| Word           | Subject                                                                                                                                                                          | Avoid                                                                                                                                                                                           | Distinct from                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `bunny-hers`   | The shared sentence, then: "Warm caramel-brown fur with a cream belly and cream inner ears."                                                                                     | anything red; text, letters, digits or a sign; a bow, ribbon or hood on the head or ears; clothes; an X-shaped mouth; a carrot; a coloured circle, badge or background behind it                | `bunny-two`, `bunny-emma`           |
| `bunny-two`    | The shared sentence, then: "Soft lilac fur with a cream belly and cream inner ears."                                                                                             | as `bunny-hers`, and pink fur                                                                                                                                                                   | `bunny-hers`, `bunny-emma`          |
| `bunny-emma`   | The shared sentence, then: "Soft blue-grey fur with a cream belly and cream inner ears, and a sage-green scarf tied in a neat bow at its neck."                                  | as `bunny-hers` (the scarf is its only clothing), and a scarf in any colour but sage green                                                                                                      | `bunny-hers`, `bunny-two`           |
| `bunny-carrot` | "A single fat orange carrot with a bushy leafy green top, standing upright with its point down, seen from the front; the orange root fills the lower two-thirds."                | anything red; text or a sign; a face on the carrot; a bunch of carrots; soil, a pot or a plate; a bite taken out of it; a coloured circle, badge or background behind it                        | the pack's food pictures            |
| `ui-bunny`     | "A small caramel clay bunny mid-hop over a short row of three square cream stepping stones toward a fat orange carrot with a leafy top, seen from the front and a little above." | anything red; text, letters, digits or dots on the stones; dice or a board game box; a ladder or a slide; a rabbit hole; a face on the carrot; a coloured circle, badge or background behind it | `ui-raft`, `ui-critters`, `ui-play` |

- **Optional sixth (Thomas's call, Q8):** `bunny-emma-asleep`, the shared sentence with Emma's colours and scarf, "curled up asleep on its side with its eyes closed", 2 variants, about $0.16. Without it the nap is the transform of § 3.4, $0.
- **Into the app:** the path-art route the clay pieces take (`yarn path-art`, then `npm run export-assets`; `UiArtId` and `PATH_ART_SET` in `packages/core/src/emmasPath/pathArt.ts:44-61`) fits all five, because they are clay; the ids and route are Kevin's to pick.
- **$0:** the path, squares, numerals, band, meadow, spinner, marker, glow, Z shapes and picker cards are drawn in the app; Emma uses her shipped poses (`packages/core/src/character/emmaPose.ts:24-32`, `sleepy` included).

---

## 14. Room left for phase 2 (Dave (6) item 9, not designed)

- **`bunnyScene` takes the board's rows and the spinner's sectors as inputs** (2 and 3 in phase 1; 10 and 5 later, Dave (4)). The stack rule of § 2.2 does not carry over: on a phone in landscape ten rows get 21.6 pt each (Dave (6) item 9), so the 100 board needs its spinner beside the board, and its own measure on all four forms.
- **The tint** deepens every two rows (L&S, Dave (1)); phase 1's cream with sand 10 and 20 is the first band.
- **The picker** gains a board choice once the 100 board is open; a second row fits in portrait, not on a phone in landscape (§ 8).
- **The flag** (the 100 board is open) is phase 2's only write; phase 1 writes nothing.

---

## 15. Acceptance criteria

### 15.1 Core (vitest, `packages/core`; Kevin)

1. **B1.** `PLAY_GAMES.bunny.opensAt` is `MATH_TREE[0]`; `openPlayGames(p)` includes `'bunny'` for every non-null progress (default profile, every step locked, every step mastered) and returns `[]` for `null`. Order: `'raft'`, `'bunny'`, `'critters'`, as open.
2. **B2.** `bunnyHops(pos, spin)` is `pos + 1 … min(20, pos + spin)` for every pos 0-19 and spin 1-3. `bunnyAsks` is true exactly on turns 2, 5, 8, 11, 14 with `pos + spin < 20`.
3. **B3.** `emmaTurn` over 10,000 seeded races: no trick on her first turn, two tricks at least 3 of her turns apart, no trick when `pos + spin + 1 ≥ 20`; at most one nap a race, never on her first turn; a silly hop never on the trick's hop, the 10 → 11 jump or a landing on 20, never the same kind twice in a row. The same seed gives the same race.
4. **B4.** With no funny moves and the child first, 200,000 seeded races give the child 60.6 % ± 0.5 (Dave (2), computed); `bunnyStarter` alternates 0, 1, 0, … within a visit.
5. **B5.** The 11 new `guide.play.bunny.*` rows and the 20 square rows exist with § 12.1's texts and inputs; the guidance test's counts move by exactly those rows; C8 holds for them.

### 15.2 Native (jest, `mobile`; Devon)

6. **B6.** `bunnyScene` equals § 2.3 on its 13 viewports (s, D, rows, meadow, spinner); every part and every hop's arc lies inside `A`; the meadow and the spinner never intersect; square hit rects never overlap.
7. **B7.** The shelf: two open games give `playPlaceLayout`'s two tiles (bunny left, critters right); three give § 9's rects. `play-tile-bunny` opens the game.
8. **B8.** The picker: two cards at § 8's rects; a tap plinks and starts the chosen mode with its open line 300 ms after the fade-in; no line plays on the picker; Back goes to `play-place`.
9. **B9.** A turn, with fake timers and a seeded spin: a spin tap plinks and the arrow stops after 1000 ms inside the result's sector, at least 30° from a border; N taps make N hops; each name starts at touchdown; a tap during a hop or a name is held (at most one); a tap with no hops left wiggles; a dot dims per hop.
10. **B10.** Against Emma, Emma's spinner turns by itself 500 ms after the child's last name, with no plink, and her bunny's hops are named at her pace.
11. **B11.** The guess: on turns 2, 5, 8 the squares ahead (and only they) are raised and pressable, with `ask`; a square tap places `bunny-marker`, another moves it; a hop first skips with no line. A last-hop landing on the marker plays sparkle, `bunny-burst`, `cheering` and `knew`; any other landing sinks the marker with no sound, no line and no pose change; a mid-move landing on it does nothing.
12. **B12.** The trick: the extra hop is named correctly, then `trick`. A tap on `bunny-piece-emma` before the child's spin hops it back one square with `sfx-boing` and its name, then `caught`; a spin closes the window and the square stays. Outside the window a tap wiggles it.
13. **B13.** The nap: `sleepy`, no spin, `nap` after 2 s, then the child's turn.
14. **B14.** The beats of § 7, in both orders and for two players, at their times: the carrot lifts at "Twenty!"; the arrival sound is the jingle if registered, else `sfx.cheer`, never both, and never for Emma's bunny; "You did it!" is the canon clip; "What a race!", then the picker with no line.
15. **B15.** Two players: no Emma bunny, trick or nap; the starter alternates within a visit; the first arrival gets `first`, the second `You did it!`.
16. **B16.** N5 holds: a full race in each mode, a guess, a trick caught and Back mid-race make zero key-value writes and no `fetch`.
17. **B17.** Back mid-hop, mid-line or mid-beat returns to the Play place at once; background parks the line and holds any due step; rotation re-lays the board and keeps positions, turn, marker, the catch window and the dots.
18. **B18.** Reduce Motion (mocked): no arc, turn, bounce, bump, flop, pulse or burst starts; § 11.1's fades run; lines and sounds keep their times.
19. **B19.** VoiceOver: § 11.2's labels and roles; activating her bunny hops once, the spinner spins, a raised square places the marker, Emma's bunny in the window catches.
20. **B20.** The tap hand: on a visit's first race it shows on the spinner with the open line and after 8 s with no spin; on her bunny 3 s after her first stop; never again that visit once she has spun and hopped.

### 15.3 Device (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs)

21. **B21.** A maestro flow per mode (seeded): picker → race → arrival → picker, with screenshots on all four forms: everything inside the play area, nothing overlapping, numerals readable, the carrot visible above 20 at all times.
22. **B22.** Thomas's eye and ear (§ 15.4): the board, the bunnies, the spinner's stop, the hop rhythm with names, the beats, and the jingle candidates.

### 15.4 Prediction and bounded convergence (Predict-Before-Soak)

- **Prediction (falsifiable, written before anyone has seen it):**
  - On the phone in portrait Thomas will call the squares small but the numerals readable; the 34 pt square will not be his first comment. If the guess mis-taps on device, the fix is a phone-portrait rule, not the board.
  - The 10 → 11 jump will read as "up to the next row" with no explanation; nobody will ask why there is no arrow.
  - Marian will tap her bunny faster than the names in her first races; the held tap will keep each name whole, and by the third race her taps will follow the names.
  - Thomas will single out Emma's bunny's sash as "Emma's", and will not confuse the caramel and blue-grey bunnies at arm's length.
  - Of the jingle candidates, Thomas will pick one of about 2 s with a plucked or mallet sound, and reject any that sounds like a fanfare or runs past the munch.
- **Bounded convergence:** I measured the board, picker and shelf on 13 viewports with the real layout code. **Not tested:** any of it on a device; every timing; whether one name per hop sounds like counting (Dave's untested surface too); how the pack generator draws the bunny family (they may come out unequal and need a second pick); the jingle (not generated); paint cost of 20 clay tiles on an older iPad; whether a 6-year-old sees the dimming dots as a count.

---

## 16. `play-place.md` amendments for the build PR

Line numbers are this branch's (`origin/main` 414ad2fa plus the pointer paragraph after `:146`, the only edit this PR makes there).

- `:51-53` § 1.1: `PlayGameId` gains `'bunny'`; `PLAY_GAMES` becomes raft, bunny, critters with `bunny: { opensAt: 'number-recog' }`; a "Why number-recog for the bunny" bullet (Dave (1)).
- `:118-123` and `:146` § 1.3: the shelf of § 9 here; the bunny tile's label and testID.
- `:162` § 1.5: learner B on numbers sees the bunny and the critters.
- `:614-632` § 4.1: the bunny's rows (§ 12.1 here), or a pointer to them.
- `:644-656` § 4.2: the bunny's labels (§ 11.2).
- `:698` § 5.2: the five clay subjects (§ 13).
- `:729` C1: `openPlayGames` with `'bunny'`, so `['critters']` becomes `['bunny', 'critters']` (B1 here). `:735` C7: the new totals.
- `:745`, `:758` N4, N16: three tiles where three games are open; learner B sees two.
- `:805` § 7 out of scope: "a third game or the grouped shelf" moves into this spec.

---

## 17. Open questions (not settled by Dave's ruling)

1. **Q1 (Dave). The guess is judged on the move's last square** (Decision 8): passing the marker mid-move is not a match. Dave says "when her bunny lands on the marker".
2. **Q2 (Dave). The spinner's dots dim one per hop** (Decision 7): a silent count of hops left. Does it pull her toward counting the hops ("one, two, three") instead of the squares? If so, drop it; the wiggle on an extra tap already tells her the move is done.
3. **Q3 (Dave). Emma's bunny leaps to share unnamed** after "You got there first!" (§ 3.5). The alternative, hopping square by square with names, could take 10 names after the race is decided.
4. **Q4 (Dave, then Thomas's ear). The carrot jingle** (§ 12.3): does a tune at arrival pull attention from the counting, or make arrival a prize to chase? My recommendation: keep it, because it never overlaps a name, it plays at every learner arrival including after a loss (so it never marks a win), and it is the same every time. Does it replace the cheer (my call) or play with it?
5. **Q5 (Dave). The picker is silent.** Two pictures and Emma's sash may be enough for a pre-reader; one new line ("Race my bunny?" style) would add a render. I kept it silent, as Dave's line list has none.
6. **Q6 (Dave, FYI). The twirl replaces the ear-spin** (Decision 9).
7. **Q7 (Dave, FYI). The tap hand** teaches the two moves once per visit (§ 5.4), with no line after the open line.
8. **Q8 (Thomas, spend). Art:** five subjects, about $0.78 (§ 13). The optional sleeping bunny, about $0.16 more, makes the nap read better than a squash; my recommendation is to skip it in phase 1 and judge the transform on device.
9. **Q9 (Thomas, eye). The bunny colours** (Decision 5): caramel, lilac, blue-grey with Emma's sash, judged at the contact sheet.
10. **Q10 (coordinator, bar #12). First-of-class visual work** wants a clickable mockup before the build (`.claude/quality-bars.md` bar 12). My recommendation: one target mockup at the real geometry, in the restyle's `target-mockup.html` + `geo.js` pattern, before Devon builds; I can make it in a follow-up.
11. **Q11 (Thomas, Dave). Phone-portrait square hit rects are 34.3 × 42.9 pt,** under 44 (§ 2.3). They take taps only for the guess, where a mis-tap moves the marker and nothing is judged. Watch it at the device check.
12. **Q12 (Kevin). ElevenLabs Music's shortest render and price** are not checked (§ 12.3); check both before the jingle's spend popup.
13. **Q13 (Dave, FYI). A square's name cuts Emma's line** if she is still speaking (§ 5.3), so a quick child may cut "Where will you land?" or the trick line by hopping. That is the skip Dave allows; the catch window stays open until her spin either way.

---

## 18. Child-safety and dark-pattern check

| Risk                      | Here                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency, prizes, streaks | None: no stardust, counted carrots, trophies or win tally; nothing is kept (Dave (4))                                                                                             |
| Variable reward           | The spinner pays nothing: no special sectors, bonus spins or lucky squares (Dave (2)); the arrival beat and the jingle are the same in every race and come to every learner bunny |
| Near misses               | A plain 1000 ms ease-out stop, never within 30° of a border, no wobble                                                                                                            |
| Losing                    | Luck, said by Emma ("Lucky me!"); she never says win or lose; the child always reaches the carrot with her own beat                                                               |
| Failure feedback          | A missed guess sinks silently; no red, X, buzzer, poof or "oops" aimed at her; only Emma says "Oops!", about herself                                                              |
| Time pressure             | No timer, no countdown; the tap hand's 8 s idle is a hint, never a limit                                                                                                          |
| Autoplay, "one more?"     | Every race ends at the picker, silently; nothing starts on its own; no line says again, next or more                                                                              |
| Rankings, other children  | Player 2 is never named, asked about or recorded; the bunnies differ by colour only (Dave (3))                                                                                    |
| Untaught content judged   | Only "which square is N ahead" is judged, inside number recognition; 11-20 are material (Dave (1))                                                                                |
| Lures                     | No arrival beat on the Hub when the game opens; the shelf regroups without a word                                                                                                 |
