# Raft crossing: the island goal and the raft for 20, phase 1 (native build spec)

**Ask (Thomas, 2026-10-25):** the games should have visible goals, rewards and levels. **Decided by popup (Thomas, 2026-10-25):** "Yes, phase 1": the islands, the party, the raft for 20. The raft for 100 (phase 2) is not designed here (§ 13).

**Rules: Dave's ruling of 2026-10-25,** committed verbatim with this spec as `design/research/raft-island-goal-2026-10-25.md` (it came by Orca dispatch and was not in the repo). It sets what fills the island, the shore guarantee, persistence, the party, what opens the 20 raft, its shore and deck, the trip and the spend. This spec quotes it as "Dave (n)" by his section numbers and does not restate his evidence. His "(7) KYLE MUST DESIGN NEXT" items 1-8 are §§ 1-6, § 10 and § 11 here.

**Parent specs:** `design/native/play-place.md` § 2 (Raft crossing) and `design/native/play-games-restyle.md` (the clay look; Thomas chose the garden backdrop). Everything in them holds unless this spec says otherwise. **Every new piece takes the restyle's tokens** (`play-games-restyle.md:237`): cream clay for anything with a number (T5), clay wood (T4), green clay (T3), the band shadow for ground (`:90-94`).

**Standing rules:** any learner of about 6-9; every spoken line and label is a row in a table, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first; never a red X. **No new art: $0.**

**Scope:** spec only. No code, no renders, no paid calls, no tickets.

**Measurements** are hand-computed by a scratch script (2026-10-25, not committed) that ports `raftScene` and `islandSpot` (`mobile/src/screens/play/playGeometry.ts:89-214`, `:222-235`) and takes `A` from `play-place.md:198-201`: P = phone portrait 375 × 667, L = phone landscape 667 × 375, W = tablet portrait 820 × 1180 (t24 b20), TL = tablet landscape 1180 × 820 (b20). `a` is the animal cell (64 phones, 104 tablets, `playGeometry.ts:94`). A home "fits" when its nest circle lies inside the island's clay oval face, inset 2 pt (the face is the mound rect less the restyle's drop, 7 phones / 10 tablets, `play-games-restyle.md:108`). Line numbers are on `origin/main` at `414ad2fa`.

## Goal

A learner who has the raft sees, across the water, an island with nine empty homes, each with a pale animal shape and its number. Every crossing that brings a new kind fills a home with that animal in colour. When the ninth home fills, the animals throw a party, and a bigger raft for twenty floats in beside the first. With two rafts, the game opens on a little harbour where the learner picks one.

## User state entering

They tapped the raft tile in the Play place (`play-place.md` § 1.3). Adding to ten (`add-to-10`) is current or mastered for them (`play-place.md:52`). Their island may already have homes filled from earlier visits (Dave (1)), and the 20 raft may be open (Dave (3)).

## Decisions (this spec's own calls, with reasons)

1. **A sibling spec, not a new section of `play-place.md`.** That file is 860 lines, and the word hunt took the same route (`critters-word-hunt.md` Decision 1). `play-place.md` § 2 gets one pointer paragraph in this PR; the build PR makes the amendments in § 12.
2. **Homes are 26.9 pt on phones (0.42 a) and 57.2 pt on tablets (0.55 a), not Dave's 0.45 a.** At 0.45 a (28.8) a phone in landscape fits 3 × 3 in the mound's rect (Dave (1)), but the restyle draws the island as a clay oval (`play-games-restyle.md:108`), and at 28.8 the corner nests leave the oval on a phone in portrait (largest that fits: 27.9). Both phone orientations take one size, so a rotation never resizes a home. The island band does not grow: on a phone in landscape the 20 raft already needs nearly all the water (§ 4.4).
3. **Rows of 5 and 4 in portrait, 3 × 3 in landscape, always in reading order bee 1 to pig 9.** A portrait mound is wide and short, a landscape one tall and narrow (`playGeometry.ts:133-139`, `:182-188`). Reading order (left to right, top to bottom) is how a learner of 6-9 reads a row of numbers, so "1 2 3 4 5 / 6 7 8 9" reads as a number line on every form.
4. **The silly scene plays on the raft at the island's shore, then the animals hop home.** Today the animals hop off onto the island and play there at 0.5 a (`play-place.md:301-302`). With nine homes the mound has no free sand. On the deck the animals stay at seat size (44.8 pt on phones, against 32 on the island today), so the scene reads bigger, and every scene's motion is already an offset from where an animal stands (`RaftCrossing.tsx:1081-1120`). The walk home then is Dave's "then the animals walk to their homes" (Dave (1)). This changes Dave's "the scene ... as today" in where it plays only (Q1).
5. **The target sits on a cream clay board on the raft's front edge,** Dave's "front log" option (Dave (3)). A pennant on the flag's mast would put the target and the running total on one pole, which is the confusion Dave rules out. The board uses the shore tags' material (T5), so the numbers the learner adds and the number they make look alike; the flag keeps the ribbon's cream.
6. **The 20 deck is narrower on phones than Dave's formula: 207.2 pt, not 221.2.** At 221.2 the 20 raft's crossing on a phone in landscape glides 10.5 pt from the dock to the island, which would not read as a crossing. With 4 pt between seats and an 8 pt side pad it glides 24.5 pt, close to the 26.8 pt every phone-portrait crossing ships with today (§ 4.4). Seats stay 44.8 pt. Tablets keep Dave's 333.2.
7. **The picker is a harbour of ponds, one per raft, and the whole pond is the button.** Each pond holds the raft and its island at picker size. A pond is a large, unmistakable target (180 pt or more), and the island beside its raft says "this raft goes there" without a word.
8. **Picker homes carry no number tags.** In the picker the homes say who is home; the raft's board says which raft. Twenty numerals on one screen would bury the two that matter.
9. **The level-up music is two short stings, never over a line or a total:** one at every party in place of the cheer, and one when the 20 raft docks (§ 7).
10. **Homes are not touch targets.** A tap on a home does nothing. A home that reacts to taps would invite tapping the empty ones, which is the "I must get the pig" pull Dave asks us to watch (Dave (5)).

---

## 1. The nine homes (Dave's item 1)

### 1.1 A home

| Part       | Empty                                                                                                                                                                                                                                                                                                                                                                                          | Filled                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cell       | `h × h` (`h` = 26.9 phones, 57.2 tablets), `pointerEvents="none"`                                                                                                                                                                                                                                                                                                                              | same                                                                                                                                                                                                    |
| Nest       | An oval at (0.04 h, 0.6 h), 0.92 h × 0.36 h: a sand dip. Face `radial-gradient(circle at 50% 40%, #d9a159 0%, #f2c27a 60%, #ffe0a8 100%)` (the Word Song honey stops, `mapButtonLook.ts:19`, run dark to light so it reads as a hollow), `inset 0 2px 3px rgba(90,45,20,0.25)` (the hunt's empty box, `play-games-restyle.md:163`)                                                             | same                                                                                                                                                                                                    |
| The animal | The kind's pack picture (`RAFT_ANIMALS`, `playPlace.ts:64`) tinted `#6b3f1f` (`INK`, `mapTheme.ts:3`) at opacity 0.32: a soft shape, not the animal. Size as on the shore, `h × (0.72 + 0.28 × (w − 1) / 8)` (`play-place.md:255`), bottom-centred so its feet stand in the nest. The pictures carry alpha (`sips`: `hasAlpha: yes` for `bee.webp`, `pig.webp`), so a tint gives a clean shape | The same picture in colour, same size and place, with the restyle's picture shadow (`imageShadow(3, 6, …)` phones, `(4, 8, …)` tablets, `play-games-restyle.md:129`). No plinth: the nest is its ground |
| Tag        | A cream clay disc `d` = 0.58 h (15.6 / 33.2 pt) at the cell's lower right, the numeral `w` in Fredoka 700 at 0.44 h (11.8 / 25.2 pt), `#6b3f1f`. Face and shadow: the restyle's weight tag (T5, `play-games-restyle.md:124`)                                                                                                                                                                   | Unchanged. The number belongs to the home, not the animal, so the island always reads 1 to 9                                                                                                            |

The tag is larger in proportion than the shore's (0.42 a, numeral 0.3 a, `play-place.md:255`), so the phone numeral is 11.8 pt rather than 8.1. On an empty home the number is the goal: "the 9 is missing" means a load with a 9 (Dave (1)). No count, no "5 of 9", no bar anywhere (Dave (1)).

### 1.2 Where the homes sit, on every form

The grid is centred on the oval face of the island's mound (`raftScene` `mound`, `playGeometry.ts:133-139` portrait, `:182-188` landscape), gaps 4 pt (phones) and 6 pt (tablets). Home `w` (1-9) is cell `w − 1` in reading order.

| Form | Mound (`raftScene`)          | Oval face     | Grid                 | Home 1 (bee)        | Home 9 (pig)         | Worst fit (≤ 1 fits: nest / tag) |
| ---- | ---------------------------- | ------------- | -------------------- | ------------------- | -------------------- | -------------------------------- |
| P    | (84.6, 259) 205.8 × 90.2     | 205.8 × 83.2  | 5 + 4, 150.4 × 57.8  | (112.3, 271.7) 26.9 | (220.4, 302.6) 26.9  | 0.93 / 0.75                      |
| L    | (543, 168) 108 × 173.1       | 108 × 166.1   | 3 × 3, 88.6 × 88.6   | (552.7, 206.8) 26.9 | (614.4, 268.5) 26.9  | 0.89 / 0.88                      |
| W    | (173.6, 442.8) 472.8 × 164.4 | 472.8 × 154.4 | 5 + 4, 310 × 120.4   | (255, 459.8) 57.2   | (476.2, 523) 57.2    | 0.95 / 0.82                      |
| TL   | (961.9, 284.7) 202.1 × 429.6 | 202.1 × 419.6 | 3 × 3, 183.6 × 183.6 | (971.1, 402.7) 57.2 | (1097.5, 529.1) 57.2 | 0.96 / 0.96                      |

The row of 4 sits centred under the row of 5 (P: from x 127.7; W: from x 286.6), like bricks. The largest home that fits each form, for the record: P 27.9 (5 + 4), L 28.6 (3 × 3), W 58.9, TL 58.5. Both phone orientations use one size, so a rotation never resizes a home.

**The bushes move to the tips.** The restyle puts two green clay bushes at 0.3 and 0.7 of the mound (`play-games-restyle.md:109`), where the homes now sit. They move to the oval's long-axis ends, centred at 0.86 × (semi-axis − 2) from the face's centre, at 0.32 a × 0.26 a (20.5 × 16.6 phones, 33.3 × 27 tablets), same green clay recipe. P: centres x 100.7 and 274.3, y 300.6 (1.4 pt clear of the row of 5). L: y 181.4 and 320.8, x 597. W: x 208.4 and 611.6, y 520. TL: y 315.8 and 673.2, x 1062.9. Each fits inside the face (P: the oval is 44.8 tall at x ± 86.8; the bush is 16.6).

### 1.3 The 20 island

Same mound rect, same homes, same bush places. Only the paint changes, so the two islands read apart at a glance in the picker:

- **Ground:** green clay, a `ClayOval` (`mapFx.tsx:35`) with stops `['#7fd364', '#6cc655', '#5cb945']` and slab `#3f8a2e`: `CLAY_LOOK.go`'s face ends, its flat colour and its slab (`clayLook.ts:8-10`).
- **At the tips:** two honey sand stones instead of bushes, `ClayOval` with the 10 island's own stops `['#ffeec2', '#f2c27a', '#d9a159']` and slab `#b27b37` (`play-games-restyle.md:108`). The 10 island is sand with two green bushes; the 20 island is grass with two sand stones.
- **Nests:** unchanged sand dips, so each animal shape sits on the same honey ground on both islands.

### 1.4 Where a crossing's scene plays, and the walk home

Replaces `play-place.md:301-303` (arrival, scene, return). Exactly ten (or twenty) still departs as today (`:299-300`).

| t (ms)                    | What happens                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| arrival                   | The raft rests at the landing (`raftScene` `landing`). The animals stay in their seats.                                                                                                                                                                                                                                                                                                           |
| arrival + 300             | The silly scene, played by the seated animals on the deck (`SCENE_AT_MS` 300, `RaftCrossing.tsx:94`; the scenes' offsets, `:1081-1120`, from each seat). "Topple onto the sand" becomes "onto the logs"; the cannonball jumps from the deck into the water (its −40 / +30 pt offset lands in water on all four forms). Emma `cheering`, `guide.play.raft.silly`, and the shipped cheer, as today. |
| scene end + 400 (`H0`)    | **The walk home.** In weight order, lightest first, each animal hops from its seat to its home: a 0.2 a arc over 300 ms (the take-off hop, `play-place.md:272`), shrinking from the seat (0.7 a) to `h`. Hop k starts at `H0 + 300 k`. Emma `idle`.                                                                                                                                               |
| each hop's end            | A new kind fills its home (§ 2.1); a kind already home merges and its home wiggles (§ 2.2).                                                                                                                                                                                                                                                                                                       |
| last hop's beat end + 400 | **Ninth kind just filled:** the party (§ 3). **Otherwise, crossings 1 and 2:** the raft glides back empty and newcomers walk in, as today (`play-place.md:303`). **Crossing 3:** the ordinary trip end (§ 6).                                                                                                                                                                                     |

A load of 2-5 animals takes 0.6-1.5 s to walk home (`H0` to the last hop's end), so a crossing is about 1-2 s longer than today's.

---

## 2. The fill and the repeat (Dave's item 2)

### 2.1 A new kind fills its home

At the hop's end the hopping animal is in its nest, at `h`, in colour. Then, together:

- the shape under it fades out (150 ms);
- the shipped sparkle (`sfx.sparkle`, 0.55, `playKit.ts:33`);
- Word Song's correct-tap burst (`SparkleBurst`, `WordChip.tsx:73`) from the home's centre, `distance` 1.2 h and `glyph` 0.45 h (32.3 / 12.1 pt phones, 68.6 / 25.7 pt tablets), `SPARKLE_BURST_MS` 850 (`WordChip.tsx:33`), `testID="raft-home-burst-<w>"`;
- the animal settles, scale 1.12 → 1 over 200 ms.

No line (Dave (1)). Two new kinds in one load fill 300 ms apart (Dave (1)): the hops are already 300 ms apart. The island's record is written as the home fills (Dave (1): on arrival; Kevin's key, § 11.1).

**Two of the same new kind in one load** (two cats, 5 + 5): the first fills the home; the second hops in 300 ms later and takes the repeat (§ 2.2).

### 2.2 A kind already home

The hopping animal lands on the home's animal and fades out over the hop's last 100 ms, so one animal stays in the home. The home's animal wiggles once: rotate 0 → −5° → +5° → −3° → 0, 100 ms a step (400 ms), around its feet (the hunt's repeat wiggle, `critters-word-hunt.md` § 4.2). The nest and tag stay still. No sound, no sparkle, no burst, no line, and nothing that says "already" (Dave (1)).

### 2.3 Reduce Motion (fill and repeat)

- **Fill:** no hop. The animal fades out at its seat (150 ms), and its home cross-fades from the shape to the animal in colour (200 ms). Fills keep their 300 ms spacing. The sparkle sound plays; no burst (Word Song draws none on Reduce Motion, `WordChip.tsx:150`), no settle.
- **Repeat:** the animal fades out at its seat (150 ms); the home's animal dims 1 → 0.6 → 1 (300 ms). No wiggle.

---

## 3. The party (Dave's item 3)

### 3.1 The beat (Dave (2), the same every time, 0 new lines)

`P0` = the end of the crossing's last hop beat (the ninth kind's fill, and any hops after it).

| t                         | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0                        | Touch locks: shore, raft and island ignore touch; Back stays live. Emma `celebration`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P0 + 300 + 120 i, i = 0-8 | **The lap.** Home i + 1 hops once, bee to pig: up 0.45 h (12.1 pt phones, the shipped island hop's −12, `RaftCrossing.tsx:1085`; 25.7 pt tablets) and down, 150 + 150 ms. The lap ends at P0 + 1560.                                                                                                                                                                                                                                                                                                           |
| P0 + 1760                 | Emma `cheering` and says **"You did it!"**: Word Song's `session.end.opener`, the bundled clip keyed by that text (`mobile/src/audio/canonAudioRegistry.ts:1575`), with its caption, through the canon-text seam the praise clips use (Dave (2); `critters-word-hunt.md` § 5.1).                                                                                                                                                                                                                               |
| its end = `Y`             | **The party jingle** J1 (§ 7) at the cheer's volume, or the shipped `sfx.cheer` (0.5, `playKit.ts:34`) until J1 lands. **The burst** over the island: `SparkleBurst` from the oval face's centre, `distance` 75 k and `glyph` 16 k, k 1 phones and 1.5 tablets (the hunt's, `critters-word-hunt.md` § 5.1), `testID="raft-party-burst"`. **The dance of nine:** the shipped `dance` (`RaftCrossing.tsx:1090-1092`, two hop waves) with `order` = home index 0-8 and the lap's hop height; it ends at Y + 2000. |
| Y + max(J1, 862 ms) + 300 | **"What a party on the island!"** (`guide.play.raft.close`, `packages/core/src/emmasPath/guidanceLines.ts:424`), Emma still `cheering`. 862 ms is the cheer's length (Dave's afinfo, `critters-word-hunt.md` § 5.1). From now on this line plays only here (Dave (2)).                                                                                                                                                                                                                                         |
| its end + 800             | **The 10 island's party:** the reveal (§ 3.2). **The 20 island's party:** Emma `idle`; the game fades out (200 ms) and the picker fades in (200 ms), silent (§ 5).                                                                                                                                                                                                                                                                                                                                             |

**Length** (estimated, clip lengths not measured): 1.76 s + "You did it!" (about 1 s) + up to 2.7 s + the close line (about 2 s) + 0.8 s, so **about 8-9 s**, inside Dave's 8-10 s. The party ends the trip on whatever crossing it falls (Dave (2)). One party per island, ever: a full island stays full and never parties again (Dave (2)).

### 3.2 The reveal: the 20 raft docks (Dave (3))

Only after the 10 island's party (the 20 raft opens on a full 10 island and nothing else, Dave (3)). `R0` = the close line's end + 800.

| t                    | What happens                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0                   | The scene fades out (200 ms); the picker fades in (200 ms) with the 10 pond (its island full, all nine in colour). Touch stays locked; Back stays live. Emma `idle`.                                                                                                                              |
| R0 + 400             | The 20 pond fades in (300 ms) with its island and nine empty homes. The 20 raft glides up into it from the pond's lower edge (the pond clips it) to its place, 1200 ms ease-out, with the crossing's ±3 pt bob and the oar rowing (`play-place.md:300`). Its board shows "20"; its flag is blank. |
| R0 + 1600            | It docks. The shipped sparkle (0.55) and **the new-raft sting** J2 (§ 7), or the sparkle alone until J2 lands. The deck dips 4 pt and back (300 ms). Emma `celebration`.                                                                                                                          |
| + max(J2, 300) + 200 | Emma `idle`. Touch unlocks. The picker waits for ever, silent (Dave (2)).                                                                                                                                                                                                                         |

No line, no glow, no loop, no "new" (Dave (3)). Nothing outside the game ever mentions it (Dave (3); `play-place.md:64`).

### 3.3 Reduce Motion (the party and the reveal)

Lines, sounds and their times are unchanged. No lap hops, no dance, no burst: at the lap's start every filled home's animal brightens (opacity 0.85 → 1, 200 ms), and Emma's poses swap as now. The reveal: the 20 pond, island and raft fade in together (400 ms) at R0 + 400; the sparkle and J2 play at R0 + 800, then touch unlocks as above.

---

## 4. The 20 raft (Dave's item 4)

### 4.1 Deck

8 seats, 4 columns × 2 rows, seat 0.7 a (44.8 phones, 72.8 tablets; never under 44, `play-place.md:257`). Filled back row left to right, then the front row, as the 10 raft.

| Form    | Seat gap (columns / rows) | Side pad / top-bottom pad | Deck          | Seat x (from the deck's left) |
| ------- | ------------------------- | ------------------------- | ------------- | ----------------------------- |
| Phones  | 4 / 6                     | 8 / 12                    | 207.2 × 119.6 | 8, 56.8, 105.6, 154.4         |
| Tablets | 6 / 6                     | 12 / 12                   | 333.2 × 175.6 | 12, 90.8, 169.6, 248.4        |

Rows at y 12 and 62.8 (phones) / 12 and 90.8 (tablets), as the 10 deck (`playGeometry.ts:99-108`). The height is the 10 deck's, so portrait crossings are unchanged.

**Look:** the restyle's raft (T4, `play-games-restyle.md:112-120`) four seats wide: the dark base, five logs, two rope bands at 0.2 and 0.8 of the width, the mast and cream flag at the back-left corner, the oar on the right edge. No seat marks (`play-games-restyle.md:28`). The boarding zone is the deck grown by 0.25 a (`play-place.md:270`).

### 4.2 Sinking, the flag, too heavy

- **Sink:** `total / target × 0.12 × deck height` (generalises `play-place.md:270`; the code's `Math.min(total, 10) / 10`, `RaftCrossing.tsx:821`), so a full raft of either size sits equally low, and 10 aboard the 20 raft sits half as low as a full 10 raft.
- **The flag** shows the total up to the target: the code's `Math.min(total, 10)` (`RaftCrossing.tsx:958`) becomes the target. "19" fits the flag (0.5 a wide) at its 0.26 a numeral (`:956`), as "10" does today.
- **Totals 1-19** are spoken, "Twenty! Off we go!" at 20, wobble and splash past 20 (Dave (3)). The stuck newcomer is Dave's widened rule (Dave (3); Q4).

### 4.3 The target board (both rafts)

| Part     | Value                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rect     | relative to the deck: width 0.56 a, height 0.34 a (35.8 × 21.8 phones, 58.2 × 35.4 tablets), centred in x, top at `deck height − 12 − 0.1 a` (101.2 phones, 153.2 tablets) |
| Numeral  | "10" or "20", Fredoka 700 at 0.26 a (16.6 / 27 pt, the flag's size, `RaftCrossing.tsx:956`), `#6b3f1f`                                                                     |
| Look     | the weight tag's cream clay (T5, `play-games-restyle.md:124`) as a rounded board, radius 0.1 a                                                                             |
| Z-order  | above the seated animals, so it always shows (Dave (3))                                                                                                                    |
| Motion   | none of its own: it sinks, wobbles, bobs and glides with the deck; it never changes during a trip                                                                          |
| `testID` | `raft-target`                                                                                                                                                              |

It hangs 3.4 pt (phones) / 13 pt (tablets) below the deck's front edge and covers the bottom 6.4 / 10.4 pt of the front row's seats, which only a fourth animal (10 raft) or a fifth (20 raft) uses (75 % of 20 loads have 4 animals, Dave (3)). Docked in portrait it stays clear of the shore's top-row cells: 2.5 pt on P, 0.7 pt on W.

### 4.4 Where each raft sits (measured)

| Form | 10 raft: dock → landing                        | Glide | 20 raft: dock → landing                        | Glide |
| ---- | ---------------------------------------------- | ----- | ---------------------------------------------- | ----- |
| P    | (102.3, 376) → (102.3, 349.2), 170.4 × 119.6   | 26.8  | (83.9, 376) → (83.9, 349.2), 207.2 × 119.6     | 26.8  |
| L    | (311.3, 194.8) → (372.6, 194.8)                | 61.3  | (311.3, 194.8) → (335.8, 194.8)                | 24.5  |
| W    | (282.8, 701.7) → (282.8, 607.2), 254.4 × 175.6 | 94.5  | (243.4, 701.7) → (243.4, 607.2), 333.2 × 175.6 | 94.5  |
| TL   | (524.8, 411.7) → (707.5, 411.7)                | 182.6 | (524.8, 411.7) → (628.7, 411.7)                | 103.8 |

At Dave's 221.2 the L glide is 10.5 pt (Decision 6). The water on L is 235.7 wide (`play-place.md:264`); the shore of 6 is unchanged (Dave (3)).

### 4.5 The trip

As the 10 raft's (`play-place.md` § 2.3), with "The raft can carry twenty!" as its open line (`RAFT_OPEN_DELAY_MS` 500 after the game shows, `RaftCrossing.tsx:74`), the 20 shore (Dave (3)), the 20 island and its own party (§ 3.1, no reveal after it).

---

## 5. The raft picker (Dave's item 5)

### 5.1 When it shows

- **One raft open:** no picker. The game opens on the 10 shore and a trip end goes to the Play place, as today (Dave (4)).
- **Two open:** the game opens on the picker; a trip end returns to it (fade 200 / 200 ms, silent); Back from the picker goes to the Play place (Dave (4)). **Back mid-trip goes to the picker**, at once and silently: a trip ends on the screen it started from (Dave (4)). This changes `play-place.md:209` for the raft with two rafts open.
- It is part of the raft's `play-game` screen, not a new route. Emma stays at her frame, `idle`; the ribbon is empty. **The picker never speaks** (0 lines, Dave (6)); Q7.

### 5.2 Layout

On the restyle's garden (T1). One pond per raft: portrait stacks them (10 on top), landscape puts them side by side (10 on the left), 16 pt apart. A pond is the restyle's pool slab (T2: radius R = 48 k, face `#8fd0ee → #5fb3dd`, the band shadow with `lo = #4a9cc8`, `play-games-restyle.md:102`), with no ripples. Inside it, inset 8 pt (phones) / 16 pt (tablets) so nothing touches the rounded corner: the raft at full size and its island (§ 1.3's paint, no bushes or stones) with nine homes at the picker size `hp` and no tags (Decision 8). Portrait: the raft on the left, its island on the right. Landscape: the raft at the bottom, its island above it, right of the flag.

| Form | Ponds (10; 20)                                           | Decks (10; 20)                                             | Island ovals (10; 20)                        | Homes `hp`, grid |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ---------------- |
| P    | (16, 259) 343 × 180; (16, 455) 343 × 180                 | (24, 303.7) 170.4 × 119.6; (24, 499.7) 207.2 × 119.6       | (243.8, 293.2) 104.7 × 111.7; (243.8, 489.2) | 21.8, 3 × 3      |
| L    | (160, 146.4) 237.5 × 216.4; (413.5, 146.4) 237.5 × 216.4 | (168, 235.2) 170.4 × 119.6; (421.5, 235.2) 207.2 × 119.6   | (213, 154.4) 176.5 × 74.8; (466.5, 154.4)    | 21.8, 5 + 4      |
| W    | (16, 442.8) 788 × 334.6; (16, 793.4) 788 × 334.6         | (32, 544) 254.4 × 175.6; (32, 894.6) 333.2 × 175.6         | (457.5, 474) 262.3 × 272.3; (457.5, 824.6)   | 57.2, 3 × 3      |
| TL   | (245.2, 231) 451.4 × 537; (712.6, 231) 451.4 × 537       | (261.2, 576.4) 254.4 × 175.6; (728.6, 576.4) 333.2 × 175.6 | (328.2, 303.7) 352.4 × 206; (795.6, 303.7)   | 57.2, 5 + 4      |

- The flag pokes 29 pt (phones) / 43.4 pt (tablets) above each deck (`playGeometry.ts:109`): P's flag tops are y 274.7 and 470.7, inside their ponds; L's are y 206.2, below its island ovals' bottom (229.2) only at x 175-207, left of the ovals (from x 213).
- `hp` is 0.34 a on phones, the largest that fits L (22.6) and kept on P so both phone orientations match; tablets keep the in-game 57.2 (TL fits 62.5). Worst nest fit: P 0.88, L 0.93, W 0.83, TL 1.00.
- The picker's island ovals are sized to the grid (grid ÷ 0.7 each way, grown in height until the nests fit), centred in the space beside or above the raft.
- Each pond's raft has its board ("10", "20") and a blank flag. The homes show the island as it is: filled in colour, empty as shapes, no count (Dave (4)).
- **Room for phase 2:** three ponds do not fit P stacked (3 × 148.6 pt of raft blocks plus insets exceed 376). The 100 raft needs its own picker layout on phones; nothing here blocks it.

### 5.3 Picking, entering, leaving

- **Tap anywhere on a pond:** plink (0.3), the pond and everything on it sink 6 × k over 120 ms (the Play-place tile's press, `play-place.md:122`, at the frame's k: 7/12 phones, 1 tablets, `play-games-restyle.md:90`), then about 200 ms after the release the picker fades out and the trip fades in (200 / 200 ms) with that raft docked at a fresh shore; its open line plays 500 ms later.
- **Entering from the Play place:** the place fades out, the picker fades in (200 / 200 ms, `play-place.md:152`), silent.
- **Rotation:** lays out again from the new viewport. A reveal in flight jumps to its end.
- **Background:** as `play-place.md:210`: a reveal step that falls due waits for the return.

---

## 6. The ordinary trip end (Dave's item 6)

The third crossing with no party. Replaces `play-place.md:304-305`. `T0` = the end of the third crossing's last hop beat.

| t         | What happens                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T0 + 400  | Every filled home's animal bounces once, together (up 0.45 h and down, 150 + 150 ms). Empty homes stay still. Emma `waving` (`emmaPose.ts:32`). No line, no sound. |
| T0 + 2000 | Emma `idle`. The game fades out (200 ms) to the picker (two rafts) or the Play place (one), silent.                                                                |

About the same length as today's close line plus its 800 ms gap. Developer note (Dave (2)): `kit.done` runs from the close line's end today (`RaftCrossing.tsx:379`); it now runs from this timer. Reduce Motion: no bounce; the pose and the timing hold.

---

## 7. The level-up music (Thomas OK'd in principle, 2026-10-25)

Thomas: "sure sounds like good ideas" to "a short level-up jingle (Music) for the Bunny race and the raft island", each generation with its own spend popup and Thomas picking by ear (`team/DECISIONS.md` entry 32, line 176 in the coordinator's checkout, not yet on `main`). It fits, at two moments where nothing else speaks:

| Id                  | Moment                                                                    | Plays in place of                     | Target length                | Never over                                                                                        |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| J1 `sfx-raft-party` | Every party, at "You did it!"'s end, with the burst and the dance (§ 3.1) | `sfx.cheer` (862 ms)                  | ≤ 2.4 s, fading out by 2.4 s | "You did it!" (starts at its end) and "What a party on the island!" (starts 300 ms after J1 ends) |
| J2 `sfx-raft-new`   | The 20 raft docking (§ 3.2), with the sparkle                             | nothing (the docking is silent today) | ≤ 1.6 s                      | any line (none plays from R0 until the next tap)                                                  |

Neither can meet a total: totals play only while loading, and both moments are after a load has crossed with touch locked. J1 at every party means once per island, twice in phase 1 for any learner.

**Generation** (later, under its own spend popup; not priced here): ElevenLabs Music `compose`, `force_instrumental: true`, `music_length_ms: 3000` (the API's minimum is 3000 ms, per elevenlabs.io/docs/api-reference/music/compose, read 2026-10-25), 2 candidates of each. Each is trimmed to its target with a 150 ms fade-out and matched by ear to `sfx.cheer`'s level. Thomas picks one of each on a page that plays them in place (the audition-page pattern), then they are bundled beside the shipped effects (`mobile/assets/audio/sfx/`). Until they land, J1's place plays the cheer and J2's plays nothing more than the sparkle, so the build never waits for them.

- **J1 prompt:** "A short, happy level-up jingle for a children's toy game, about two seconds long: a bright marimba and glockenspiel play a quick rising five-note run that lands on a warm major chord, with a soft wooden shaker and one light hand clap on the last note. Gentle, playful and toy-like, like wooden toys celebrating. No vocals, no drum kit, no brass fanfare, no electronic synths, nothing loud or harsh. It ends cleanly with a short natural ring-out and silence."
- **J2 prompt:** "A very short, gentle 'ta-da' for a children's toy game when a new little wooden boat arrives, about one second of music: a soft ukulele strum and two rising glockenspiel notes, then a quiet warm bell shimmer that fades out. Calm, magical, happy and soft. No vocals, no drums, no brass, no synths. Silence after the shimmer."

**Prediction (Predict-Before-Soak):** the 3 s renders will put the musical event in the first 1.5-2 s and pad the rest with a tail, so the trims lose nothing; at least one J1 candidate will come back with a drum hit or a brass-like synth despite the negatives. **Untested:** whether J1 at the cheer's level masks the start of "What a party on the island!" on an iPad speaker (300 ms apart by design).

---

## 8. Wireframes (positions from §§ 1-5; the art is not to scale, the annotations are)

```
PHONE PORTRAIT 375×667, crossing 2 on the 10 raft: the walk home
(bee 1, hen 3, cat 5 and pig 9 already home; dog 7 + hen 3 just landed)
+-------------------------------------+
| (<)                                 |  Back (16, 8) 56
|  .-----.  +-----------------------+ |
| ( Emma  ) | Hee hee! Silly animals!| |
|  '-----'  +-----------------------+ |  A from y 259
|  (*).--------------------------.(*) |  bushes at the tips (100.7 / 274.3, 300.6)
|    ( [1] (2) [3] (4) [5]        )   |  row of 5: homes 26.9 from (112.3, 271.7)
|    (    (6) [7]<- (8) [9]       )   |  row of 4 from x 127.7; [n] filled, (n) a shape + tag
|     '----------^---------------'    |  the dog hops 300 ms after the hen
|  ~  ~  +=========|=======+  ~  ~  ~ |  landing (102.3, 349.2) 170.4 x 119.6
|  ~  ~  | [hen3] [dog7]   |  ~  ~  ~ |  hen 3 is home already: hops in, wiggles
|  ~  ~  |        ( 10 )   |/ ~  ~  ~ |  ( 10 ) the target board (35.8 x 21.8)
|  ~  ~  +=================+  ~  ~  ~ |
|  .  .  .  .  .  sand  .  .  .  .  . |  shore band from y 499.6, refilled after the return
|   {frg2}     {fox6}     {duc4}      |
|   {cat5}     {pig9}     {bee1}      |
+-------------------------------------+
```

```
PHONE LANDSCAPE 667×375, the 20 raft loading, total 13 (dog 7 + fox 6 aboard); frog 2 and duck 4 home
+---------------------------------------------------------------------------+
|(<)        |  ribbon: "Thirteen!"                                          |
| .------.  +---------------------------------------------------------------+
|( Emma   ) | shore   |~  +=[13]=======================+  ~  ~ |  (stone)    |  20 island (543, 168): green clay
|(        ) | {bee1}  |~  | [dog7] [fox6] [ ]   [ ]    |  ~  ~ | (1) [2] (3)  |  3 x 3 homes from (552.7, 206.8)
| '------'  | {frg2}  |~  | [ ]    [ ]    [ ]   [ ]    |/ ~  ~ | [4] (5) (6)  |  [n] filled, (n) a shape + tag
|           | {hen3}  |~  +=========( 20 )=============+  ~  ~ | (7) (8) (9)  |
|           | {duc4}  |~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ |  (stone)    |
|           | {cat5}  | dock (311.3, 194.8) 207.2 x 119.6; glides 24.5 to x 335.8    |
+---------------------------------------------------------------------------+
  shore: 3 rows of 2 cells of 64 (drawn as one column here); |13| the flag; ( 20 ) the board
```

```
TABLET PORTRAIT 820×1180, the party on the 10 island: "You did it!" has ended, the dance of nine
+---------------------------------------------------------------+
| (<)   .------.  +--------------------------------------+      |
|      ( Emma   ) | (no caption between the two lines)    |      |
|      ( cheer- ) +--------------------------------------+      |
|       '------'          * burst from (410, 520) *              |  A from y 442.8
|  (bush).---------------------------------------------.(bush)  |  bushes (208.4 / 611.6, 520)
|       (   [1]^  [2]   [3]^  [4]   [5]^               )        |  homes 57.2 from (255, 459.8), all filled,
|       (      [6]^  [7]   [8]^  [9]                    )       |  hopping in waves (the shipped dance)
|        '---------------------------------------------'        |
|  ~  ~  ~  ~  +=========================+  ~  ~  ~  ~  ~  ~  ~  |  the raft at the landing (282.8, 607.2)
|  ~  ~  ~  ~  |  (empty)        ( 10 ) |  ~  ~  ~  ~  ~  ~  ~  |
|  ~  ~  ~  ~  +=========================+  ~  ~  ~  ~  ~  ~  ~  |
|  .  .  .  .  .  .  .  sand  .  .  .  .  .  .  .  .  .  .  .   |
|      {   }       {   }       {   }                              |  shore spots wait (touch locked)
|      {   }       {   }       {   }                              |
+---------------------------------------------------------------+
  next: J1 (or the cheer), then "What a party on the island!", then the reveal in the picker
```

```
TABLET LANDSCAPE 1180×820, crossing 1 on the 10 raft: the silly scene on the deck at the landing
+-----------------------------------------------------------------------------------+
| (<)                                                                               |
|  .------.   +----------------------------------+                                  |
| ( Emma   )  | Hee hee! Silly animals!          |                  (bush)          |
| ( cheer- )  +----------------------------------+                .------------.    |
|  '------'                                                       ( (1) (2) (3) )   |  homes 57.2 from
| shore  | ~  ~  ~  ~  ~  ~  ~  ~  +====================+ ~       ( (4) (5) (6) )   |  (971.1, 402.7)
| {cat5} | ~  ~  ~  ~  ~  ~  ~  ~  | [dog7]^ [hen3]^    |        ( (7) (8) (9) )   |  all shapes: the first
| {pig9} | ~  ~  ~  ~  ~  ~  ~  ~  |  dancing on deck   |         '------------'    |  crossing of a new island
| {bee1} | ~  ~  ~  ~  ~  ~  ~  ~  +=======( 10 )=======+                  (bush)    |
| {duc4} | landing (707.5, 411.7) 254.4 x 175.6; the mound from x 961.9                |
+-----------------------------------------------------------------------------------+
  after the scene: hen 3 hops home first (fills), dog 7 300 ms later (fills)
```

```
PICKER, PHONE PORTRAIT 375×667                     PICKER, PHONE LANDSCAPE 667×375
+-------------------------------------+            +---------------------------------------------------------+
| (<)  Emma idle, no caption          |            |(<)       | Emma idle, no caption                          |
+-------------------------------------+            +----------+----------------------------------------------+
| .~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~. |            |          | .~~~~~~~~~~~~~~~~~~~~. .~~~~~~~~~~~~~~~~~~~~~. |
| ~ |>|               ~  .-------.  ~ |            |          | ~ |>| .-----------.  ~ ~ |>| .-------------. ~ |
| ~ +==============+   ( [1][2][3] ) ~|            |          | ~     ([1][2][3][4][5])~ ~     ((1)(2)(3)(4)(5))~|
| ~ | 10 raft      |   ( [4][5][6] ) ~|            |          | ~     ( [6][7][8][9] ) ~ ~     ( (6)(7)(8)(9) )~|
| ~ +====( 10 )====+   ( [7][8][9] ) ~|            |          | ~ +=============+    ~ ~ +=================+ ~ |
| ~  pond (16,259) 343x180 '-------'  ~|           |          | ~ |  10 raft    |    ~ ~ |  20 raft        | ~ |
| '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~' |            |          | ~ +===( 10 )====+    ~ ~ +=====( 20 )======+ ~ |
| .~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~. |            |          | '~~~~~~~~~~~~~~~~~~~~' '~~~~~~~~~~~~~~~~~~~~~' |
| ~ |>|                  .-------.  ~ |            +---------------------------------------------------------+
| ~ +==================+ ( (1)(2)(3) )~|             ponds (160, 146.4) and (413.5, 146.4), 237.5 x 216.4;
| ~ | 20 raft          | ( (4)(5)(6) )~|             islands 176.5 x 74.8, homes 21.8, no tags
| ~ +=====( 20 )=======+ ( (7)(8)(9) )~|
| '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~' |            PICKER, TABLETS: W stacks the ponds as P (788 x 334.6, islands
+-------------------------------------+            262.3 x 272.3, 3 x 3); TL puts them side by side as L (451.4 x
  islands 104.7 x 111.7, homes 21.8, 3 x 3           537, islands 352.4 x 206, 5 + 4); homes 57.2, no tags (§ 5.2)
  [n] in colour (home)   (n) a shape (empty)   |>| the blank flag   ( 10 ) the board   the whole pond is the button
```

---

## 9. Reduce Motion (all of it)

Lines, sounds and their times are unchanged; dragging still follows the finger (`play-place.md` § 2.5 holds).

| Motion                  | With Reduce Motion                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Scene on the deck       | None, as today's scene (`play-place.md:355`); the line and the cheer play over the still raft         |
| Walk home, fill         | § 2.3: fade at the seat, cross-fade at the home, 300 ms apart; the sparkle sound; no burst, no settle |
| Repeat                  | § 2.3: fade at the seat, the home's animal dims 1 → 0.6 → 1                                           |
| Party lap, dance, burst | § 3.3: filled animals brighten 0.85 → 1 (200 ms) at the lap's start; no hop, no dance, no burst       |
| Reveal                  | § 3.3: the 20 pond, island and raft fade in together (400 ms)                                         |
| Ordinary trip end       | No bounce; `waving` and the timing hold                                                               |
| Picker press            | A 150 ms dim (opacity 1 → 0.85 → 1) instead of the sink                                               |

---

## 10. VoiceOver labels (Dave's item 7; labels only: Lily speaks none)

They go beside `PLAY_LABELS` (`mobile/src/screens/play/playLines.ts:91-97`), so a language version swaps rows. `<Animal>` and `<number>` use the existing animal and number words (`animalLabel`, `NUMBER_WORDS`, `playLines.ts:106`).

| Element                       | Label                                                                           | Role, activate                                     |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| A filled home (in a trip)     | "<Animal>, <number>, home" ("Pig, nine, home")                                  | none (static text)                                 |
| An empty home (in a trip)     | "<Animal>, <number>, empty home"                                                | none                                               |
| The raft in a trip            | "Raft for <target>, <total>" ("Raft for twenty, seven"); at 0 "Raft for twenty" | none (was "Raft, <total>", `playLines.ts:127-128`) |
| A pond in the picker          | "Raft for ten", "Raft for twenty"                                               | button; starts that raft's trip                    |
| The picker's homes and boards | none (`accessible={false}`: inside the pond's button)                           |                                                    |

Dave's examples ("Pig, home", "Pig home, empty") gain the number, because the shore animals' labels carry theirs ("Dog, seven", `play-place.md:651`) and an empty home's number is its goal. No label states a count of homes filled or left. The party and the reveal make no announcement.

---

## 11. With Kevin: core names and acceptance criteria (Dave's item 8)

### 11.1 Core names (proposals; Kevin's core PR pins them, the UI builds on the merged names, Pattern A)

| Name (proposed)                                                                                  | Shape                                    | Meaning                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RaftTarget`                                                                                     | `10 \| 20`                               | A raft's load (phase 2 adds 100)                                                                                                                     |
| `RAFT_SEATS`                                                                                     | `Record<RaftTarget, number>`             | `{ 10: 6, 20: 8 }`                                                                                                                                   |
| `raftLoads(weights, target)`                                                                     | `=> number[][]`                          | Today's `raftLoads` (`playPlace.ts:84`) for either target                                                                                            |
| `raftShore(rng, { target, missing })`, `raftRefill(waiting, rng, { target, missing })`           | `=> number[]`                            | Dave (1) and (3): the target's draw and accept test plus the missing-kind guarantee; fallbacks as Dave gives them (`CANON_SHORE`, `playPlace.ts:77`) |
| `raftNewcomer(waiting, total, target)`                                                           | `=> RaftWeight \| undefined`             | The stuck newcomer's weight (Dave (3), widened); replaces `raftStuck`'s caller logic (Q4)                                                            |
| `IslandRecord`                                                                                   | `{ 10: RaftWeight[]; 20: RaftWeight[] }` | The kinds home per island (Dave (1)); Kevin picks the key, in the learner-scoped store, beside `HuntRecord` (`critters-word-hunt.md:49`)             |
| `openRafts(progress, record)`                                                                    | `=> RaftTarget[]`                        | `[]` without the raft; `[10]`; `[10, 20]` once the 10 island has all nine kinds (Dave (3))                                                           |
| `islandHomes(scene)`, `targetBoard(scene)`, `raftPicker(A, tablet, landscape, targets)` (mobile) | `=> Rect[]` / `Rect` / ponds             | §§ 1.2, 4.3, 5.2's rects; `raftScene` gains a `target` argument for the 20 deck (§ 4.1), and its other rects stay as they are                        |

### 11.2 Acceptance criteria

**Core (vitest, `packages/core`; Kevin):**

1. **I1** (C2-style, Dave's two guarantees). Over 1,000 seeds per case: `raftShore(rng, { target: 10, missing })` gives 6 weights in 1-9 with at least 2 loads to 10, at least one of them a pair, and, while `missing` is non-empty, at least one load holding a missing kind; `missing` covers each single kind and random subsets. `target: 20`: at least 2 loads to 20, at least one "ten and ten" load (two disjoint pairs to ten), and the missing-kind load. `raftRefill` keeps the waiting weights in order and returns a 6 with the same guarantees, for waiting sets of 2-5. The same seed gives the same shore.
2. **I2.** `raftLoads([7, 3, 6, 4, 8, 2], 20)` is exactly 7 + 3 + 6 + 4, 7 + 3 + 8 + 2 and 6 + 4 + 8 + 2 (Dave (3)); `raftLoads(w, 10)` is today's.
3. **I3** (N7a's core). `raftNewcomer` gives `10 − total` on the 10 raft when stuck (today's rule) and `undefined` when not stuck; on the 20 raft, a weight `gap − s` in 1-9 for some sum `s` the waiting animals make, by Q4's rule, and the shore with it can reach 20.
4. **I4.** `openRafts`: `[]` for `null` and for a learner without the raft; `[10]` with fewer than nine kinds on the 10 island, whatever the 20 record holds; `[10, 20]` with all nine, whether or not adding to twenty is current; never `[20]` alone. A record with all nine kinds never goes back to `[10]`.
5. **I5.** `IslandRecord` round-trips through the learner-scoped store; learner B never reads learner A's.
6. **I6** (C7, C8). The 12 new lines of § 12.1 with their texts and inputs; `guidanceLines.test.ts`'s totals move by 12 (Kevin computes the new numbers); none of Emma's own lines contains "again", "next", "more", "round", "win", "fast" or "not a word".

**Native (jest, `mobile`; Devon):**

7. **I7** (amends N5). On an in-memory store, a raft trip writes only the island key, once per new kind and never otherwise; a trip that brings no new kind writes nothing. Progress, session history, stardust, Leitner and the streak are byte-identical, and `fetch` is never called. Back mid-crossing keeps every kind already home.
8. **I8** (amends N8). Exactly 10 (or 20) departs as today. At arrival the animals stay seated; the scene plays on the deck; then each animal hops home in weight order 300 ms apart. A new kind: `raft-home-burst-<w>`, the sparkle, the home's shape gone. A repeat: no burst, no sound, the wiggle. Crossings 1-2 then return. Crossing 3 without a party: § 6 (`waving`, no line), then the picker or the Play place. `guide.play.raft.close` plays only in a party.
9. **I9.** The party, with fake timers: when the ninth kind fills, § 3.1's steps play once, in order and at their times: `celebration`, the lap 120 ms apart, `cheering` and the "You did it!" canon clip with its caption, J1 or `sfx.cheer` with `raft-party-burst`, then the close line. After the 10 island's party the picker shows and § 3.2's reveal runs; after the 20 island's there is no reveal. Touch is locked from P0 until the picker unlocks; Back works throughout. A trip to a full island never parties.
10. **I10.** The picker: absent with one raft; with two it opens first. A pond tap starts that raft's trip with its open line ("The raft can carry twenty!" for 20); a trip end returns to the picker; Back from a trip goes to the picker and from the picker to the Play place.
11. **I11** (amends N13). `islandHomes`, `targetBoard`, the 20 deck and `raftPicker` equal §§ 1.2, 4.1, 4.3, 4.4 and 5.2's rects on the four viewports; every nest lies inside its oval face inset 2 pt; nothing overlaps another part except where § 4.3 says the board covers seats; a viewport change mid-trip keeps the island, what is aboard and the crossing number.
12. **I12** (N7a, widened). On a stuck 20 raft, after two splashes in a row a newcomer of `raftNewcomer`'s weight walks in with no line, sound or pose; boarding it can reach 20.
13. **I13.** The flag shows totals up to the target; the board shows the target and never changes during a trip.
14. **I14** (N12). With Reduce Motion on (mocked), no hop, wiggle, settle, lap, dance, burst, glide-in or bounce starts; § 9's fades run; lines and sounds keep their times.
15. **I15** (N17). VoiceOver: § 10's labels and roles.

**Device (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs):**

16. **I16** (amends V5). A trip: the scene on the raft, the walk home, a fill with its burst, a repeat's wiggle. The third crossing: the bounce and the wave, no line, then the Play place. Screenshots on all four forms: every home and tag inside the island, readable (the phone tag numeral is 11.8 pt).
17. **I17.** Seeded with eight kinds home: the ninth fills, the party plays, the picker shows and the 20 raft docks. Tap it: "The raft can carry twenty!". On a phone in landscape, its crossing reads as a crossing (24.5 pt, Q5).
18. **I18.** Thomas's eye (§ 14): the homes, the board, the 20 island, the picker. Thomas's ear: J1 and J2 candidates (§ 7), after their spend popup.

---

## 12. Lines, spend, and the `play-place.md` amendments

### 12.1 Lines (Dave (6): 12 new, 124 input characters)

| Id (proposed)                        | Caption (= Lily input unless noted)                                                       | When                 | Chars |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------- | ----- |
| `guide.play.raft.open.20`            | "The raft can carry twenty!"                                                              | The 20 raft's start  | 26    |
| `guide.play.raft.go.20`              | "Twenty! Off we go!"                                                                      | Exactly 20           | 18    |
| `guide.play.raft.total.<t>`, t 10-19 | "Ten!" … "Nineteen!" (input "Ten," … "Nineteen,", the one-word rule, `play-place.md:660`) | The 20 raft's totals | 80    |

"You did it!" is a shipped canon clip (0 renders). The party, the picker and the trip end need no other line; the trip end loses one (Dave (6)). Ear-test prediction: Dave's (Dave (6)).

### 12.2 Spend

- **Lily:** 12 lines, 124 characters, after Thomas's yes on the render (Dave (6)).
- **Music:** J1 and J2, 2 candidates each at 3000 ms, after their own popup (§ 7). Not priced here.
- **Art: $0.** Shapes are the shipped pictures tinted in the app; the 20 raft, the board, both islands, the nests and the ponds are drawn in the app with the restyle's tokens.

### 12.3 `play-place.md` amendments for the build PR

Line numbers are this branch's (`origin/main` 414ad2fa plus the two-line pointer at § 2's top, the only edit this PR makes there).

- `:34` Decision 4 and `:35` Decision 5 → the raft keeps its island record (Dave (1)); a trip also ends at the party.
- `:168`, `:177`, `:179` (§ 1.6: no unlock, toy state, natural stops) → the island, the 20 raft and the party, by Thomas's call (Dave (5)).
- `:209` § 1.7 Back → with two rafts open, Back mid-trip goes to the picker (§ 5.1).
- `:303-307` § 2.3 arrival, crossings, crossing 3 → §§ 1.4, 6 here; `:318` length (+ the walk home); `:320` "Later: 20" → this spec.
- `:324-348` § 2.4's tablet wireframe (animals dance on the island) → § 8 here; `:356-357` § 2.5's crossing and scene rows → § 9.
- `:363-364` § 2.6 and `:653-654` § 4.2 → § 10's labels; `:621-626` § 4.1 → the 12 rows of § 12.1, and `guide.play.raft.close` "when" becomes "Raft: the party".
- `:746` N5 → I7; `:750` N8 → I8; `:755` N13 → I11; `:767` V5 → I16.
- `:805` out of scope "a raft to 20; any toy state" → this spec.
- `:851` and `:861` § 9 (no unlock, nothing kept; collecting) → the island's homes, by Thomas's call (Dave (5)).

### 12.4 Build split

1. **Kevin, core** (Pattern A): § 11.1's names, I1-I6, the 12 rows and their render commit in the tools worktree.
2. **Devon, native,** after Kevin's PR and after the restyle's A1 (`devon/play-restyle-a1`) merges, since both edit `RaftCrossing.tsx` (`play-games-restyle.md:237`): §§ 1-6, 8-10, I7-I15. Kevin reviews.
3. **J1, J2** after Thomas's popup and pick; they drop in beside the shipped effects. The native PR may merge without them (the cheer and the sparkle hold their places).

---

## 13. Room left for phase 2 (not designed)

The 100 raft (Dave (3)) adds a third island and pond, its target "100" on the same board (three digits: the board widens), and its own picker layout on phones (§ 5.2). `RaftTarget` and `IslandRecord` take a third member. Nothing in phase 1 blocks it.

---

## 14. Prediction and bounded convergence (Predict-Before-Soak)

- **Prediction (falsifiable, written before anyone sees it on a device):**
  - Thomas will find the phone homes small but readable; the first thing he points at will be the walk home and a fill's burst, not the shapes. He will not notice that the scene moved onto the raft unless asked.
  - On a phone in landscape the 20 raft's 24.5 pt crossing will read as "it rowed over", because the oar and the bob carry it, as phone portrait's 26.8 pt does today. A falsifier: he says it "just sits there".
  - A learner will look at the empty shapes after their first fill, and the pig (9 + 1) will be the last kind home in most first islands. Dave's guarantee makes it reachable on every shore (Dave (1)).
- **Bounded convergence:** I measured every rect on the four floor viewports with a port of `raftScene`, against bar #10 (chunky, no thin lines) and the restyle's tokens. **Not tested:** the restyle's oval on a device (A1 is being built; I used its spec's numbers); other phone and tablet sizes; the tinted shapes' contrast on real screens; every timing on a device; the clips' lengths (the party's 8-9 s is an estimate); the picker on a learner's first sight; the jingles (not generated).

---

## 15. Open questions (not settled by Dave's ruling)

1. **Q1 (Dave). The scene plays on the raft at the island's shore,** not on the island (Decision 4), because nine homes leave no free sand. Dave said "the scene and its line play as today". Does moving it change what makes it funny?
2. **Q2 (Dave). The jingle beside Emma's lines.** By § 3.1 J1 never overlaps a line or a total: it replaces the cheer between "You did it!" and "What a party on the island!", which then starts up to about 2.7 s after the first line ends (about 1.2 s with the 862 ms cheer in its place). Does a music sting there compete with Emma's lines, and should it play at the 20 island's party too, or only at the first?
3. **Q3 (Dave, Kevin). Back during the party.** The ninth kind is already written, so the party and the reveal never replay: next visit the 20 raft is simply in the picker (as Dave has the 100 raft appear, Dave (3)). I recommend accepting that over a "party seen" bit, since Dave keeps nothing else (Dave (1)).
4. **Q4 (Kevin, Dave). Which newcomer on the 20 raft,** when several sums `s` work (Dave (3)). Proposal: `s = 0` when the gap is 9 or less (today's rule); otherwise the smallest `s` of at least `gap − 9` that the waiting animals make, so the newcomer is the biggest that closes the gap.
5. **Q5 (Thomas, device). The 20 deck is 207.2 pt on phones,** not Dave's 221.2 (Decision 6), so its phone-landscape crossing glides 24.5 pt instead of 10.5. If it still does not read as a crossing on a device, the next lever is the island band, which costs home size.
6. **Q6 (Thomas, look). The 20 island is green clay with two sand stones;** the 10 island stays sand with two green bushes (§ 1.3).
7. **Q7 (Dave, watch). The picker is silent** (0 lines, Dave (6)). Watch on device whether a learner knows to tap a pond; if not, the cheapest fix is the drag hint's finger (`DragHintHand.tsx`) on the 10 pond, no line.
8. **Q8 (Kevin). The names in § 11.1** are proposals; the island key and `IslandRecord`'s shape are Kevin's.

---

## 16. Child-safety and dark-pattern check (the island goal only)

| Risk                         | Here                                                                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Currency, prizes, streaks    | None: no stardust, score, count or total of homes; the island is its own record (Dave (5))                                                                                                          |
| A meter of what is missing   | The empty shapes, by Thomas's call (Dave (5) supersedes the rail for the raft only); no count, no "5 of 9", no line about it. Dave's watch: distress at the pig → remove the shapes, keep the party |
| Lures, autoplay, "one more?" | The picker waits silently; nothing starts on its own; no line names an island, a kind or a raft outside the game; the reveal plays once and never greets a return                                   |
| Variable reward              | The fill, the party and the reveal are the same every time; the shore guarantee means a new kind is never a lucky roll (Dave (1))                                                                   |
| Grind                        | Nine kinds per island, one party per island, a natural stop at the party, free choice of raft (Dave (5))                                                                                            |
| Failure feedback             | Unchanged: the wobble and splash are funny and instant to retry; nothing lost, no re-lock, no decay (Dave (5))                                                                                      |
| Untaught content judged      | The 20 raft always has a ten-and-ten load, so a learner on adding to ten can reach 20 with facts they have (Dave (3))                                                                               |
| Music                        | Two short stings at two fixed moments, never over a line, never during loading; no music loop anywhere                                                                                              |
