# Letter critters: the word hunt, phase 2 (four-letter rounds) (native build spec)

**Ask (Thomas, build 23, 2026-10-26, as the coordinator relayed him):** "Critters dont advance to 4 letter words". By popup: "Start phase 2 spec now".

**Rules: Dave's build-23 ruling, part (B),** committed verbatim with this spec as `design/research/critters-four-letter-2026-10-26.md` (with his (D), "Kyle next, and the spend"). This spec quotes it as "Dave 23 (B)" and his items as "Dave 23 (D) item n", and does not restate his evidence. It designs his items 6-11 and lists item 12 as core acceptance criteria for Kevin (§ 10.1). "Dave (n)" is his ruling of 2026-10-25 (`design/research/critters-word-hunt-2026-10-25.md`).

**Parent specs:** `design/native/critters-word-hunt.md` (phase 1, with § 15, pictures in the word boxes, which Devon is building now on `devon/hunt-pictures`) and `design/native/play-place.md` § 3. Everything there holds for a four-letter round unless this spec says otherwise. **Paint:** the restyle's tokens throughout (`design/native/play-games-restyle.md` T7-T11, `:132-167`). The parts that phase 1 already has take restyle A2's paint when A2 lands (`play-games-restyle.md:232`; it has not, `main` at 6f445073); the parts new here (the picker's logs, the arrival slab, the door) are given in the tokens directly.

**Amended 2026-10-27 (build 25):** the picker (§ 5) drops its two meadow slabs. The two logs themselves lie in the meadow and are the buttons (Thomas: "the overview need some polish, i dont like these big boxes"). It stays at two logs: Dave ruled the same day that there are no 5- or 6-letter rounds (his ruling of 2026-10-27 as the coordinator relayed it, not yet committed; (B), and (D) item 4: "Still two logs; no third length is coming"). Decision 4, § 5, § 7's picker wireframe, § 8, § 9, F16, F18, F19, Q28 and § 14 follow.

**Standing rules:** any learner of about 6-9 (Marian is one); every spoken line and label is a row in a table, so the planned Danish version swaps rows; per learner through `@marian/core/learners`; audio-first; never a red X. **Spend is counted here and asked later**, each under its own popup (§ 9).

**Scope:** spec only. No code, no renders, no paid calls, no tickets.

**Line numbers** are at `origin/main` 6f445073. **Measurements** (§ 2.4, § 5.2, § 6) come from a scratch script (not committed) that calls the shipped `mathLayout`, `playArea` and `backRect` and ports `huntSceneAt` and `huntSceneFits` (`mobile/src/screens/play/playGeometry.ts:479-609`) to 4 seats, 4 boxes and 7 critters. Method check: with `SLOT_STEPS[3]` set to § 15's amended S4 (pad 3, T 36), the same script gives exactly `critters-word-hunt.md` § 2.4's four amended phone rows.

## Goal

A learner who has finished a three-letter round sees a longer log with four sockets and a "4" glide in, and taps it. In a four-letter round she finds 4-6 words of four sounds, each shown by its picture or a listen mark over four boxes, on a log of four seats. From then on the game opens on two logs, "3" and "4", and she picks.

## User state entering

She has the word hunt (blending sounds current or mastered, `critters-word-hunt.md` § 8). Either she has just finished a three-letter round (the roll-in, § 6), or four-letter rounds are already open for her and she tapped the Letter critters tile (the picker, § 5).

## Decisions (this spec's own calls, with reasons)

1. **The meadow is 4 + 3 on every form,** vowel first. A third row does not fit a phone in portrait: board 140 + gap 12 + a three-row block (86 + 8 + 184) = 430 > `A`'s 376. With 4 + 3 the four-letter block is as tall as the three-letter one (2 rows), and 4 × 56 + 3 × 8 = 248 fits under the 336 pt log.
2. **No critter shrinks; the slot steps down instead** (phase 1's Decision 4). A four-box slot is the phase-1 card with a fourth box. Phones take S4, and the one measured phone where S4 does not fit, 667 × 375, takes a new S5 (§ 2.2). **Settled: the phone four-box slot is 100 wide,** not Dave's 102: 4 × 22 + 3 × 2 + 2 × 3. Dave measured with S4's old pad 4; § 15 made it pad 3 (`critters-word-hunt.md:101`). Both fit a phone in portrait three a row (312 or 318 ≤ 343).
3. **Landscape boards are two columns on every form.** Three columns do not fit beside a four-seat log on a phone at any step, and on tablets only at S4 (1180 × 820: 3 × 100 + 32 + 520 = 852 ≤ 918.8), which would cost the iPads their 72 pt pictures. Two columns keep every tablet's largest step.
4. **The picker is a woodpile: the logs themselves lie in the meadow, one under another, and each log is its own button** (amended 2026-10-27; it was two meadow slabs with the whole slab the button, which Thomas called "big boxes" on build 25). Each log is as long as its word: one socket per letter, at the round's seat where a four-socket log fits (every form but phone portrait, which takes 65.7 at 375 wide and 69.6 at 390, for 70). The discs line up on the left, so the "4" log reaches one socket further than the "3", like a step. The picker logs are thicker than a round's (bar 28 / 36, disc 40 / 56, § 5.2): with no slab around it, a round-size log (24 pt) read as a thin stick on an iPad (the mock, § 5.2). Two logs only ("3" and "4"; Dave 2026-10-27: no 5- or 6-letter rounds). They are stacked on every form because side by side, 16 apart, they do not fit `A` on any of them (P 596.3 > 343, L 558.4 > 491, W and TL 962.4 > 788 and 918.8).
5. **The picker never shows a round's state.** A round in progress, a complete round and no round look the same: no mark, no count, no preview (Dave 23 (B): "No text, no count, no board preview"). A "you left one unfinished" mark would be a lure and a meter of what is missing (`critters-word-hunt.md` § 13).
6. **Each length's open line plays on its first entry in a visit only.** With a picker she may go 3 → picker → 4 → picker → 3. The three-letter line is 4.80 s (`play-place.md:645`), and Emma's line already comes "twice a visit at most" (`play-place.md:536`). Later entries are silent.
7. **The roll-in rests over the scene on a slab, then becomes a door beside New letters.** After the beat, only a phone in portrait has a free strip for a second full-size log (§ 6.3). The log arrives at full size, so it reads as "a longer log", then shrinks into its own end, the "4" disc, which stays as a button beside New letters. She can open four letters at once, which is the reward Thomas asked for ("be able to move on to 4 letter words", `critters-word-hunt.md:3`). The door shows only on that screen; from then on the picker is the way. The alternative is in Q19.
8. **An empty seat between two seated critters is a rest when the log is tapped.** "f_og" sings /f/, a 600 ms rest, /o/, /g/. The gap marks the missing sound without a word, which is the cluster's second consonant that young spellers leave out (Dave 23 (B), Bruck & Treiman 1990). Nothing judges it. Q20.
9. **The hint's four sounds light no critter** (§ 15 Decision 6, `critters-word-hunt.md:583`): lighting them would point at the letters.
10. **The joy beat's burst starts at the log's middle,** between seats 2 and 3, because a four-seat log has no middle seat (`play-place.md:508` bursts from the middle seat).

---

## 1. Content and core (Dave 23 (B), made testable; Kevin)

**Names are pinned by Kevin's core PR** (`packages/core/src/games/critterHunt.ts` and `playPlace.ts`); the UI builds on them (Pattern A).

| Name                                                           | Shape                  | Meaning                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HUNT_FOUR_TARGETS`                                            | `ReadonlySet<string>`  | Dave's 82 words exactly ("The targets, exact"): a 18, o 15, i 7, u 19, e 23                                                                                                                                                                                   |
| `HUNT_RUDE_FOUR`                                               | `ReadonlySet<string>`  | Dave's 18, as printed: cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns. All 18 reject a round                                                                                                                       |
| `HUNT_FOUR_UNDEALT`                                            | `ReadonlySet<string>`  | Dave's 25 words with no clip (Q21): crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held                                                                                              |
| `HUNT_FOUR_PICTURE_WORDS`                                      | `readonly string[]`    | The 25 pictured targets (Dave's starred words: the 11 lesson pictures and 14 of #709), checked against the app's registry by `playPlace.test.ts`. `critterHasPicture(w)` is true for them                                                                     |
| `HuntLength`                                                   | `3 \| 4`               | A round's length. Every function below defaults to 3, so phase 1's calls are unchanged                                                                                                                                                                        |
| `huntRounds(vowel, { length: 4 })`                             | `=> HuntRound[]`       | Every four-letter round a vowel deals (the rules below). `huntRounds(vowel, { probeGuard })` for three letters is unchanged; the probe guard does nothing at 4                                                                                                |
| `huntRoundOf(letters, { length: 4 })`                          | `=> HuntRound \| null` | The round 7 letters deal, or `null`                                                                                                                                                                                                                           |
| `huntDeal(vowels, rng, { last, length: 4 })`                   | `=> HuntRound`         | One of them, uniformly, never `last`'s letters, with Dave's pinned fallback per vowel (`HUNT_FOUR_FALLBACK`)                                                                                                                                                  |
| `huntComplete`, `huntBoardOrder`, `huntHintTarget`, `huntFind` | unchanged              | N − 1 for N 4-6 (`floor(0.95 × N)`). Board order as § 15.2: no four-letter word has a blend clip (Dave 23 (B)), so it is the pictured targets a-z, then the rest a-z                                                                                          |
| `loadHuntRecord(4)`, `saveHuntRecord(record, 4)`               | as phase 1             | The four-letter round in play, under `"4"`; its guard wants 7 letters                                                                                                                                                                                         |
| `saveHuntRecord(record, 3, { unlock: true })`                  | the open write         | A complete three-letter record written with `unlock` also opens "4", in the same write. Without `unlock` nothing opens: the three-letter screen as merged does not pass it, so "4" stays shut until the UI that shows it ships                                |
| `huntOpenLengths()`                                            | `=> HuntLength[]`      | `[3]`, or `[3, 4]` once opened. The value of `marian-tutor.critter-hunt.v1` is `{ "3": HuntRecord, "4": HuntRecord, "open": [3, 4] }` (Q24); a value with no `open` reads `[3]`                                                                               |
| `critterRun` for a run of four                                 | `'word' \| 'quiet'`    | `'word'` for a `HUNT_FOUR_TARGETS` word, `'quiet'` for anything else. Never `'picture'` (no blend clip) and never `'funny'`                                                                                                                                   |
| `critterWordLine(w)` (`guidanceLines.ts:480`)                  | 82 + 9 new rows        | Caption "<W>.", input "<W>," (Dave (8)'s format)                                                                                                                                                                                                              |
| `guide.play.critters.open.four`                                | a `GuidanceLine`       | "Drag four letters up to the log. Can you make these words?" (Dave 23 (B); the three-letter one is `guide.play.critters.open`, `guidanceLines.ts:314`, `:425`)                                                                                                |
| `critterPraise(word)`, `HUNT_FOUR_LESSON_WORDS`                | 11 more words          | flag hand lamp tent nest belt gift frog pond drum plum: their lesson praise clip ("Yes! That's a flag.", `mobile/src/audio/canonAudioRegistry.ts:1395`). `CRITTER_PRAISE_WORDS` is the 45 and the 11; the app's play-line manifest has a praise line for each |

**A round** (Dave 23 (B), "A round"):

- **Letters:** 7: the vowel, then 6 consonants a-z, from the 17 consonant critters (b c d f g h j l m n p r s t v w x). Vowels: `huntVowels(progress)`, unchanged: only her taught vowels deal.
- **Spellable:** as phase 1 (`critters-word-hunt.md:54`): the vowel at most once, a consonant at most twice (its twin: _pump_, _test_, _bulb_).
- **Targets:** exactly the `HUNT_FOUR_TARGETS` words the letters spell, 4-6 of them, at least 2 with a bundled picture.
- **At most 1 consonant in no target** (the decoy; its twin pops as usual).
- **Rejected:** a letter set that spells any `HUNT_RUDE_FOUR` word; a letter set that spells any of the 25 words with no clip: crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held (`HUNT_FOUR_UNDEALT`, Dave's Q21 answer); `last`'s letters.
- **No extras.** Every other four-letter run sings and sits (§ 4.1). **No probe guard:** the 8 probe-reserve words are three letters (`packages/core/src/wordSong/novelProbeWords.ts:27-36`), and a three-letter run on a four-seat log never sings.
- **Pictured** means bundled, as phase 1's Q11 (`critters-word-hunt.md:531`): the 11 lesson pictures and, since #709, the 14 four-letter ones (`HUNT_FOUR_PICTURE_WORDS`, 25).
- **Pinned fallbacks** (Dave): a b c d l m p / o b c d n p r / i c f g l p t / u b c d g l p / e b c d l s t. By the rules above they deal: _camp clap damp lamp_ / _crop drop pond prop_ / _clip flip gift lift_ / _bulb club gulp plug_ / _belt best sled test_ (my port, § 11).
- **Counts:** a 56, o 51, i 2, u 125, e 86, with N splits a {4: 42, 5: 11, 6: 3}, o {4: 34, 5: 13, 6: 4}, i {4: 2}, u {4: 57, 5: 22, 6: 46}, e {4: 25, 5: 24, 6: 37}: Dave's, and the code's (F3). Without the `HUNT_FOUR_UNDEALT` rule the rules give o 52 and e 101 (Q21).

**The record and the unlock:** "4" opens when her first three-letter round completes. It is written with the completing find, which is written when its run is judged (`critters-word-hunt.md:557`), so Back during that outcome still opens it. It stays open, with no re-lock, and she can always go back to 3 (Dave 23 (B), "Opening"). A learner who finished rounds before this ships opens "4" on her next complete three-letter round, with the roll-in (Dave): no migration, since a value with no `open` reads `[3]`. A four-letter `HuntRecord` has 7 letters, and the guard checks each length's count. **The gate:** the open write happens only through `saveHuntRecord(record, 3, { unlock: true })`, which only the UI that shows "4" passes, so a core build without that UI opens nothing and no learner loses her roll-in.

**The 9 three-letter words** (Dave 23 (B), "New audio"): _act add end ill its odd off_ join `HUNT_FAMILIAR` as targets; _ant_ and _elf_ join the said words with a picture (bundled since #709). All 9 leave `CRITTER_NOT_SAID` (`playPlace.ts:308`) with their clips. This widens the three-letter deals: for example, short-a rounds with _d_ no longer spell a quiet word (_add_), so a round is no longer rejected for spelling _add_, and _sad_ can deal (`critters-word-hunt.md:555`). Phase 1's H2/H3 counts are re-pinned: 439 rounds (a 203, e 39, i 53, o 83, u 61), the count Dave 23 (B) gives for Dave (1)'s rules with them; 95 short-a rounds pass the probe guard. _hump_ is on no list.

---

## 2. The scene and its sizes (Dave 23 (D) item 6)

### 2.1 Parts

As phase 1 (`critters-word-hunt.md` § 2.1) with four changes: **the log band** has 4 seats (§ 3); **the meadow** has 7 critters, 4 + 3; **the board** has N = 4-6 four-box slots; **there is no bonus chip** and no chip cell. The picture card is `p = min(block height, block width, 200 phone / 300 tablet)`, centred on the block, as phase 1.

| Form    | c / g   | Seat | Log band  | Meadow (4 + 3) | Block     |
| ------- | ------- | ---- | --------- | -------------- | --------- |
| Phone P | 56 / 8  | 70   | 336 × 86  | 248 × 120      | 336 × 214 |
| Phone L | 48 / 8  | 60   | 296 × 76  | 216 × 104      | 296 × 188 |
| Tablets | 88 / 16 | 110  | 520 × 126 | 400 × 192      | 520 × 334 |

The log band is `4 × 1.25c + 3g + 32` (Dave (4): 336 on a phone in portrait, 3.5 pt a side of `A`'s 343, measured: band at x 19.5 in `A` from x 16). Blocks are as tall as phase 1's.

### 2.2 The four-box slot and its ladder

```
  four-box slot (every form)            W = 4b + 3gb + 2pad
  +---------------------------+         H = pad + T + pad + b + pad
  |         +------+          |  pad
  |         | pic  |   T      |         paint: § 15.3 (T11's card, sockets, tiles; the picture
  |         +------+          |  pad      or listen mark drawn to the whole box, from the deal)
  |  [ b ][ b ][ b ][ b ]     |  b
  +---------------------------+  pad
```

| Step   | b   | gb  | pad | T   | Four-box W × H | Letters (0.62 b) | Used by                                                         |
| ------ | --- | --- | --- | --- | -------------- | ---------------- | --------------------------------------------------------------- |
| S1     | 40  | 4   | 8   | 72  | 188 × 136      | 25               | tablets, first try                                              |
| S2     | 32  | 4   | 8   | 56  | 156 × 112      | 20               | tablets where S1 does not fit                                   |
| S3     | 28  | 3   | 6   | 44  | 133 × 90       | 17               | tablets where S2 does not fit                                   |
| S4     | 22  | 2   | 3   | 36  | **100 × 67**   | 14               | phones, first try; tablets where S3 does not fit                |
| **S5** | 20  | 2   | 3   | 36  | 92 × 65        | 12.4             | phones where S4 does not fit (only 667 × 375 of those measured) |

S1-S4 are phase 1's steps (`playGeometry.ts:387-392`, S4 as § 15 amends it). S5 is new: S4 with b 20, the largest box that fits 667 × 375 (b 21 needs 2 × 96 + 6 = 198 beside the 296 block, 3 pt more than `A` has). It keeps S4's picture (36).

**The fit rule** is phase 1's (`critters-word-hunt.md:103`), for N 4-6, without the chip: every part inside `A`, burrows included; each slot clear of the other slots, the log band, the numeral, every seat's drop zone and every meadow cell; the picture card off the board. A tablet takes the first of S1-S4 that passes for N 4, 5 and 6 in its orientation; a phone the first of S4, S5 (else S5, logged as phase 1 logs). Re-run on rotation.

**If § 15's S4 does not ship** (pad 4, T 32), the same rule gives Dave's 102 × 66 slot: it fits both phones in portrait (318) and 844 × 390, and 667 × 375 takes S5 at pad 4 (94 × 64) with a 1 pt gap (measured). The build takes `SLOT_STEPS` as shipped; nothing here hard-codes 100.

### 2.3 Arrangement

- **Portrait (P, W):** the board, then the block, centred together in `A`, 12 (phone) or 24 (tablet) apart, as phase 1. Board rows: `ceil(N/2)` then `floor(N/2)`, each centred, `sg` apart (6 / 16): 4 is 2 + 2, 5 is 3 + 2, 6 is 3 + 3.
- **Landscape (L, TL):** the block on the left, the board on the right, `gap = min(24, A.width − block − board)`, the pair centred, each centred vertically. Board: 2 columns, rows of 2, the last row centred: 4 is 2 + 2, 5 is 2 + 2 + 1, 6 is 2 + 2 + 2.

### 2.4 Measured on the 15 viewports (N 6)

Insets as phase 1's § 2.4. Rects are (x, y) w × h. Every row passes the fit rule for N 4, 5 and 6 at its step.

| Viewport (insets)     | `A`                      | Step | Slot      | Board (N 6)              | Log band                 | Meadow                   | Card               | Gap  |
| --------------------- | ------------------------ | ---- | --------- | ------------------------ | ------------------------ | ------------------------ | ------------------ | ---- |
| 375 × 667             | (16, 259) 343 × 376      | S4   | 100 × 67  | (31.5, 264) 312 × 140    | (19.5, 416) 336 × 86     | (63.5, 510) 248 × 120    | (87.5, 423) 200    | 12   |
| 667 × 375             | (160, 146.4) 491 × 216.4 | S5   | 92 × 65   | (461, 151.1) 190 × 207   | (160, 160.6) 296 × 76    | (200, 244.6) 216 × 104   | (214, 160.6) 188   | 5    |
| 390 × 844 (t47 b34)   | (16, 327) 358 × 451      | S4   | 100 × 67  | (39, 369.5) 312 × 140    | (27, 521.5) 336 × 86     | (71, 615.5) 248 × 120    | (95, 528.5) 200    | 12   |
| 844 × 390 (l/r47 b21) | (227, 143.9) 554 × 214.2 | S4   | 100 × 67  | (561, 144.6) 206 × 213   | (241, 157.1) 296 × 76    | (281, 241.1) 216 × 104   | (295, 157.1) 188   | 24   |
| 820 × 1180 (t24 b20)  | (16, 442.8) 788 × 685.2  | S1   | 188 × 136 | (112, 462.4) 596 × 288   | (150, 774.4) 520 × 126   | (210, 916.4) 400 × 192   | (260, 791.4) 300   | 24   |
| 1180 × 820 (b20)      | (245.2, 231) 918.8 × 537 | S1   | 188 × 136 | (772, 279.5) 392 × 440   | (245.2, 332.5) 520 × 126 | (305.2, 474.5) 400 × 192 | (355.2, 349.5) 300 | 6.8  |
| 1180 × 820 (t24 b20)  | (245.2, 255) 918.8 × 513 | S1   | 188 × 136 | (772, 291.5) 392 × 440   | (245.2, 344.5) 520 × 126 | (305.2, 486.5) 400 × 192 | (355.2, 361.5) 300 | 6.8  |
| 834 × 1194 (t24 b20)  | (16, 446.4) 802 × 695.6  | S1   | 188 × 136 | (119, 471.2) 596 × 288   | (157, 783.2) 520 × 126   | (217, 925.2) 400 × 192   | (267, 800.2) 300   | 24   |
| 1194 × 834 (t24 b20)  | (248.8, 255) 929.2 × 527 | S1   | 188 × 136 | (786, 298.5) 392 × 440   | (248.8, 351.5) 520 × 126 | (308.8, 493.5) 400 × 192 | (358.8, 368.5) 300 | 17.2 |
| 744 × 1133 (t24 b20)  | (16, 430.6) 712 × 650.4  | S2   | 156 × 112 | (122, 456.8) 500 × 240   | (112, 720.8) 520 × 126   | (172, 862.8) 400 × 192   | (222, 737.8) 300   | 24   |
| 1133 × 744 (t24 b20)  | (225.4, 255) 891.6 × 437 | S2   | 156 × 112 | (779.2, 289.5) 328 × 368 | (235.2, 306.5) 520 × 126 | (295.2, 448.5) 400 × 192 | (345.2, 323.5) 300 | 24   |
| 810 × 1080 (t24 b20)  | (16, 416.8) 778 × 611.2  | S2   | 156 × 112 | (155, 423.4) 500 × 240   | (145, 687.4) 520 × 126   | (205, 829.4) 400 × 192   | (255, 704.4) 300   | 24   |
| 1080 × 810 (t24 b20)  | (242.6, 255) 821.4 × 503 | S3   | 133 × 90  | (782, 355.5) 282 × 302   | (242.6, 339.5) 520 × 126 | (302.6, 481.5) 400 × 192 | (352.6, 356.5) 300 | 19.4 |
| 768 × 1024 (t24 b20)  | (16, 402.2) 736 × 569.8  | S3   | 133 × 90  | (168.5, 410.1) 431 × 196 | (124, 630.1) 520 × 126   | (184, 772.1) 400 × 192   | (234, 647.1) 300   | 24   |
| 1024 × 768 (t24 b20)  | (231.7, 255) 776.3 × 461 | S4   | 100 × 67  | (783.8, 369) 216 × 233   | (239.8, 318.5) 520 × 126 | (299.8, 460.5) 400 × 192 | (349.8, 335.5) 300 | 24   |

- **The tight phone is 667 × 375:** S4 needs 296 + 206 = 502 in an `A` 491 wide. S5 fits with a 5 pt gap; seat 4's drop zone ends 6.4 pt inside the block, so the board is 11.4 pt clear of it.
- **The tight tablet is 1180 × 820:** S1 fits with a 6.8 pt gap. Seat 4's drop zone (the seat grown by 0.2 c = 17.6) ends 1.6 pt past the log band, so the board is 5.2 pt clear of it. Phase 1's rule passes; Q22 asks whether that is enough.
- **The 1024 × 768 iPad in landscape takes S4,** the phone slot (36 pt pictures, 14 pt letters): S3 needs 520 + 282 = 802 > 776.3. Q22.
- **Phone portrait has 10 pt spare** (board 140 + 12 + block 214 = 366 of 376).
- **Not measured:** other phones (wider ones only gain room), the 1366 × 1024 class, split view.

### 2.5 The seven-critter meadow

Round order (vowel, then consonants a-z), 4 in the first row and 3 in the second, each row centred (`critterScene`'s row centring, `playGeometry.ts:300-311`, with `perRow` 4). P: row 1 at y 510, x 63.5, 127.5, 191.5, 255.5; row 2 at y 574, x 95.5, 159.5, 223.5. Everything else is phase 1's: the vowel has no twin and shows its ringed burrow while away (`critters-word-hunt.md` § 2.5, the ring in T11's glow), consonants pop a twin, the meadow band and burrows in T9's paint (`play-games-restyle.md:152-153`).

---

## 3. The four-seat log (Dave 23 (D) item 7)

- **Seats:** 4 of 1.25 c, `g` apart, starting 16 in from the band's left. P: x 35.5, 113.5, 191.5, 269.5 at y 416, 70 each. Drop zone: a seat grown by 0.2 c (`play-place.md:495`).
- **The log:** the band's width, 24 tall, at the band's top + seat − 8 (`playGeometry.ts:319`): P (19.5, 478) 336 × 24. T8's wood face and ledge, and **four sockets**, one under each seat, by T8's rule (`play-games-restyle.md:148`): oval 0.64 × seat wide (44.8 P, 38.4 L, 70.4 tablets).
- **The numeral disc** carries **"4"**: D 32 / 40 at the log's left end, centred on it (`critters-word-hunt.md` § 3.2), T11's end-grain paint (`play-games-restyle.md:165`), Fredoka 700 at 0.62 D in `#6b3f1f`. P (19.5, 474) 32.
- **The length shows four ways without a word:** four seats, four sockets, the "4", and four boxes in every slot (Dave (5)).
- **Label:** "Log, four letters" (Dave 23 (D) item 11), button; activating it sings the seated critters (§ 4.1). `testID="critter-log-numeral"` shows "4".

---

## 4. A four-letter round (Dave 23 (D) item 10)

### 4.1 Runs

Drag, drop, swap, hop home and a tap on a critter are `play-place.md` § 3.3, unchanged.

| On the log                       | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3 seated                       | **Nothing sings on its own** (Dave 23 (B): "A run sings only when all 4 seats are full"). Seated neighbours lean toward each other and wait, as a pair does (`play-place.md:516`). No line.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1-3 seated, **she taps the log** | They sing left to right, each its own sound with its bounce, the next 300 ms after the one before ends (`play-place.md:514`). **An empty seat between two seated critters adds a 600 ms rest** (Decision 8): the gap across one empty middle seat is 900 ms (300 + 600), and each further empty middle seat adds 600 (Dave, Q20); empty seats at either end are skipped. Emma `listening`, then `idle`. **Nothing else:** no outcome, no clear, no write, and it is not a run for the hint's count. A drag or a seat change cuts the song.                                                                        |
| 4 seated                         | 400 ms after the last seat change, with no drag in progress, they sing, left to right, as above. The board waits from the first sound (`play-place.md:522`). Then the outcome:                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| a target (`'word'`)              | 300 ms after the last sound, Emma says the word ("Flag.", caption in her ribbon, `attentive-pointing`), as a said word (`play-place.md:517`). At her line's end, **the joy beat:** `cheering`, the cheer, the four bounce together, and the burst from the log's middle (Decision 10; `k` = seat / 112). A pictured target pops its picture at that moment (the said word's card, held 2400 ms, then the float-away). One of the 11 lesson words, on its first build in the visit: its praise clip at her line's end + 1200, still `cheering` (Dave 23 (B); `play-place.md:509`'s timing). Then the fill (§ 4.2). |
| anything else (`'quiet'`)        | 300 ms after the last sound, the four bounce together once (0.15 c, 250 ms) and sit. No word, boing, tumble, line, picture or sparkle; Emma `idle` (`play-place.md:518`). Real words, plurals and rare words all take this (Dave 23 (B), "Quiet words").                                                                                                                                                                                                                                                                                                                                                          |
| then                             | **The shelf clears** after every run of four, as after every run of three (`play-place.md:522-531`): the outcome over, 400 ms hold, 400 ms drop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Never in a four-letter round:** the boing, the tumble or a non-word line; extras; the bonus chip.

**A three-letter word on the four-seat log** (_fog_ for _frog_) leaves a seat empty, so it never sings unless she taps the log, and then it is never judged (Dave 23 (B)).

### 4.2 The fill

`critters-word-hunt.md` § 4.1 and § 15.6, with four tiles:

**The fill starts when the outcome is over:** for a pictured target, the later of her line's end + 2400 and the praise's end + 400; for an unpictured one, her line's end + 1200.

| t (ms from the fill's start) | What happens                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                            | The slot is the word's own (`huntBoardOrder`). The picture card, if any, shrinks onto the slot's picture (end rect `T / 0.86` a side, § 15.6). Emma `idle` |
| 0, 60, 120, 180              | Four tiles lift off the seats, left to right, and fly to the slot's four boxes, shrinking to `b` (500 ms each, ease in-out)                                |
| 680                          | The last lands; the tiles settle (1.08 → 1, 120 ms)                                                                                                        |
| 680 + 400                    | The shelf clears                                                                                                                                           |

No sound at the fill. A repeat find wiggles its own slot (§ 4.2 there).

### 4.3 Slots and the hint

- **A slot tap** (empty or filled) plays the word's `critterWordLine` clip, sound only, no caption, and its picture box takes the lit pulse (§ 15.5). There is no `wordWindow`: no four-letter word has a blend clip.
- **The hint:** § 15.7's trigger, glow and end, counting **runs of four** (5 without a new target) or 45 s without a drag start. Its tap plays **the four critters' sounds in order**, each its letter window (`LetterCritters.tsx:240-247`), 300 ms after each, then the word clip 300 ms after the fourth (Dave 23 (B): "the hint is the four critter sounds in order, then the word"). Emma `attentive-pointing`, then `idle`. No critter lights (Decision 9). Length, estimated (clips not measured): about 3.0-4.1 s.
- **The drag hint** (`play-place.md:533-537`) retires at her first full run of the visit, of three or of four.

### 4.4 Completion and New letters

Phase 1's beat (`critters-word-hunt.md` § 5.1, as § 15.6 amends it): at N − 1 (3 of 4, 4 of 5, 5 of 6), the lap in board order, "You did it!", the cheer and the burst. **Nothing rolls in after a four-letter round** (five letters are not designed, Dave (4)). New letters enters as there and deals a fresh four-letter round. The last slot stays findable.

### 4.5 Entering, leaving, rotating

`critters-word-hunt.md` § 6.4 for each length, with Back going to the picker (§ 5.1). Rotation re-lays the scene with the new orientation's step and keeps the found slots, the glow and the seated critters.

---

## 5. The length picker (Dave 23 (D) item 9)

### 5.1 When it shows

- **Only "3" open:** no picker. Phase 1 as merged: the game opens on the three-letter round and Back goes to the Play place.
- **"3" and "4" open:** the game opens on the picker. A log tap opens that length's round, in progress or fresh (a complete round is replaced by a fresh deal, `critters-word-hunt.md` § 6.4). **Back from a round goes to the picker,** at once and silently, keeping the round. **Back from the picker goes to the Play place** (Dave 23 (B); the raft picker's rule, `raft-island-goal.md:210`).
- **No third length:** Dave ruled on 2026-10-27 that there are no 5- or 6-letter rounds, so no third log is coming ((D) item 4). The picker is two logs.
- It is part of the critters' `play-game` screen, not a new route. Emma stays at her frame, `idle`; the ribbon is empty; **the picker never speaks** (Dave 23 (B)).

### 5.2 Layout (measured; amended 2026-10-27)

**Thomas on build 25 (2026-10-27), on this picker:** "the overview need some polish, i dont like these big boxes." His screenshot is 1080 × 810 and shows the two slabs as built (`HuntLengths.tsx:212-286`). The slabs go. The two logs lie on the meadow the frame already paints (the garden backdrop, `play-games-restyle.md` T1, `PlayGameScreen.tsx:277-282`), and each log is a button.

**Mock:** `tmp/picker-polish/index.html` in the main checkout (not committed). It shows the four forms drawn to the rects below with the real Emma and backdrop, beside Thomas's build-25 screenshot. Its `html/*-live.html` pages run the wave and the press.

**Measured** 2026-10-27 by a scratch script (not committed). It calls the shipped `mathLayout`, `playArea`, `backRect`, `logSockets` and `gardenBackground` at `origin/main` 4ccd7570, with this rule ported; line numbers in § 5 are at 4ccd7570. **Method check:** the same script's call to today's `pickerScene` gives the old § 5.2 slabs exactly (P (16, 259) and (16, 455) 343 × 180; L (160, 146.4) and (160, 262.6) 491 × 100.2; W (16, 442.8) and (16, 793.4) 788 × 334.6; TL (245.2, 231) and (245.2, 507.5) 918.8 × 260.5). **Thomas's iPad** is 1080 × 810 with no insets: at insets 0 the script's old slabs, (242.6, 231) and (242.6, 512.5) 821.4 × 265.5, match his screenshot (slab tops at 231 and 512.5 pt, the lower slab's bottom at 778).

**The picker log** is a round's log (T8 wood and sockets, T11 disc), thicker:

| Part                                       | Phones    | Tablets   |
| ------------------------------------------ | --------- | --------- |
| Bar height `H` (radius `H / 2`)            | 28        | 36        |
| Disc `D` (numeral Fredoka 700 at 0.62 `D`) | 40 (24.8) | 56 (34.7) |
| Gap `g` between socket cells               | 8         | 16        |
| Ground shadow height `s`; ledge            | 12; 5     | 18; 6     |
| Wave lift; press sink (6 × k)              | 3 pt; 3.5 | 4 pt; 6   |

- **Socket cell** `σ = min(1.25 c, (A.width − 16 − D + 4 − 16 − 3 g) / 3.82)`. That is the round's seat (70 P, 60 L, 110 tablets) where the four-socket log fits `A` with 8 pt a side, else the largest cell that fits. Only phone portrait takes less (65.7 at 375 wide, 69.6 at 390). (3.82 = 4 − 0.18, from the lead.)
- **Lead** (the bar's left end to the first cell) `= D − 4 − 0.18 σ`, so the disc covers 4 pt of socket 1, as it does in a round (3.4-5.2 pt there). **Tail:** 16 after the last cell.
- **A log of n** (3 or 4): bar `(x0, y) W(n) × H`, `W(n) = lead + n σ + (n − 1) g + 16`. Disc `D` at `x0`, centred on the bar. n sockets by `logSockets`, with cell i at `x0 + lead + i (σ + g)`, σ wide (oval 0.64 σ × 0.64 `H` at the cell's x + 0.18 σ and the bar's y + 0.18 `H`).
- **Rows:** pitch `r = min(2.2 D, A.height / 2)`: 88 on phones, 123.2 on tablets (every viewport measured). "3" on top, "4" below, the pair centred in `A`: `top = A.y + (A.height − 2 r) / 2`. Each log's bar and disc are centred on its row's middle.
- **x0** `= A.x + (A.width − W(4)) / 2`: the pair is centred on the "4" log, and both discs are at `x0`.
- **The button** (the `Pressable`) is the log's row: `(x0 − 8, row top) (W(n) + 16) × r`. The rows abut. A tap right of the "3" log's end, or anywhere else off a log, is the meadow (§ 5.3).
- **Ground shadow** (paint, under the bar, never touchable): `(x0 + 6, bar.y + H + ledge − s / 2) (W(n) − 12) × s`, face `radial-gradient(ellipse at 50% 50%, rgba(60,40,10,0.3) 0%, rgba(60,40,10,0.15) 38%, rgba(60,40,10,0) 70%)`. That is T9's band-shadow brown (`HuntLengths.tsx:77`), darker for a contact shadow, in the `… at …` gradient form `HuntLengths.tsx` already draws (`:63`, `:70`).
- **Paint:** T8's wood face, ledge and sockets, and T11's disc, as `HuntLengths.tsx:52-72` has them. **No slab, band, critters, slots, text or count** (Dave 23 (B)). The same picker whatever the rounds hold (Decision 5).

Rects are (x, y) w × h; a disc is (x, y) and its side.

| Form (insets)                   | σ    | lead | r     | Log 3: button; bar; disc                                                   | Log 4: button; bar; disc                                                   |
| ------------------------------- | ---- | ---- | ----- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P 375 × 667                     | 65.7 | 24.2 | 88    | (16, 359) 269.3 × 88; (24, 389) 253.3 × 28; (24, 383) 40                   | (16, 447) 343 × 88; (24, 477) 327 × 28; (24, 471) 40                       |
| L 667 × 375                     | 60   | 25.2 | 88    | (244.9, 166.6) 253.2 × 88; (252.9, 196.6) 237.2 × 28; (252.9, 190.6) 40    | (244.9, 254.6) 321.2 × 88; (252.9, 284.6) 305.2 × 28; (252.9, 278.6) 40    |
| W 820 × 1180 (t24 b20)          | 110  | 32.2 | 123.2 | (133.9, 662.2) 426.2 × 123.2; (141.9, 705.8) 410.2 × 36; (141.9, 695.8) 56 | (133.9, 785.4) 552.2 × 123.2; (141.9, 829) 536.2 × 36; (141.9, 819) 56     |
| TL 1180 × 820 (b20)             | 110  | 32.2 | 123.2 | (428.5, 376.3) 426.2 × 123.2; (436.5, 419.9) 410.2 × 36; (436.5, 409.9) 56 | (428.5, 499.5) 552.2 × 123.2; (436.5, 543.1) 536.2 × 36; (436.5, 533.1) 56 |
| Thomas's iPad 1080 × 810 (none) | 110  | 32.2 | 123.2 | (377.2, 381.3) 426.2 × 123.2; (385.2, 424.9) 410.2 × 36; (385.2, 414.9) 56 | (377.2, 504.5) 552.2 × 123.2; (385.2, 548.1) 536.2 × 36; (385.2, 538.1) 56 |

Socket 1 is at `x0 + 36` on phones (42.1 × 17.9 P, 38.4 × 17.9 L) and `x0 + 52` on tablets (70.4 × 23).

**The fit, on § 2.4's 15 viewports and Thomas's iPad:** both buttons inside `A`, and both rows at least 44 pt tall.

| Viewport (insets)     | σ    | r     | Log 4 width | Pair (the two buttons)       |
| --------------------- | ---- | ----- | ----------- | ---------------------------- |
| 375 × 667             | 65.7 | 88    | 327         | (16, 359) 343 × 176          |
| 667 × 375             | 60   | 88    | 305.2       | (244.9, 166.6) 321.2 × 176   |
| 390 × 844 (t47 b34)   | 69.6 | 88    | 342         | (16, 464.5) 358 × 176        |
| 844 × 390 (l/r47 b21) | 60   | 88    | 305.2       | (343.4, 163.1) 321.2 × 176   |
| 820 × 1180 (t24 b20)  | 110  | 123.2 | 536.2       | (133.9, 662.2) 552.2 × 246.4 |
| 1180 × 820 (b20)      | 110  | 123.2 | 536.2       | (428.5, 376.3) 552.2 × 246.4 |
| 1180 × 820 (t24 b20)  | 110  | 123.2 | 536.2       | (428.5, 388.3) 552.2 × 246.4 |
| 834 × 1194 (t24 b20)  | 110  | 123.2 | 536.2       | (140.9, 671) 552.2 × 246.4   |
| 1194 × 834 (t24 b20)  | 110  | 123.2 | 536.2       | (437.3, 395.3) 552.2 × 246.4 |
| 744 × 1133 (t24 b20)  | 110  | 123.2 | 536.2       | (95.9, 632.6) 552.2 × 246.4  |
| 1133 × 744 (t24 b20)  | 110  | 123.2 | 536.2       | (395.1, 350.3) 552.2 × 246.4 |
| 810 × 1080 (t24 b20)  | 110  | 123.2 | 536.2       | (128.9, 599.2) 552.2 × 246.4 |
| 1080 × 810 (t24 b20)  | 110  | 123.2 | 536.2       | (377.2, 383.3) 552.2 × 246.4 |
| 1080 × 810 (none)     | 110  | 123.2 | 536.2       | (377.2, 381.3) 552.2 × 246.4 |
| 768 × 1024 (t24 b20)  | 110  | 123.2 | 536.2       | (107.9, 563.9) 552.2 × 246.4 |
| 1024 × 768 (t24 b20)  | 110  | 123.2 | 536.2       | (343.7, 362.3) 552.2 × 246.4 |

- **The tight phone is 667 × 375:** the pair is 176 of `A`'s 216.4, and the "4" log (305.2) leaves 185.8 of its 491. At 375 × 667 the "4" log's button fills `A`'s 343 exactly.
- **Not measured:** other phones (wider ones only gain room), the 1366 × 1024 class, split view.

**For the build (names):**

- `playGeometry.ts`: `pickerScene(A, tablet, landscape): PickerScene` (same arguments as today), with `PickerScene { logs: readonly PickerLog[]; seat: number; pitch: number }` ("3" then "4") and `PickerLog { length: 3 | 4; hit: Rect; log: LogParts; shadow: Rect }`. A picker log's `LogParts` has `band` = its bar's rect and `seats` = its socket cells (`logSockets` uses only their x and width). `slabs` and `radius` go. `logAt` and `arrivalScene` (the roll-in) are unchanged.
- `HuntLengths.tsx`: `LengthPicker` draws a `Pressable` per `PickerLog` at `hit` (`testID="hunt-pick-<n>"`, role button, its label). It holds the ground shadow and an `Animated.View` (`hunt-pick-<n>-log`) carrying `BareLog`, which takes the press and the wave. Under them is the meadow: a `Pressable` at `A`, `accessible={false}`, `testID="hunt-pick-meadow"`. `PickerSlab`, `MEADOW` on the picker and `hunt-pick-<n>-face` go. `hunt-picker`, `hunt-pick-3` and `hunt-pick-4` keep their ids: the Maestro subflows tap them (`mobile/maestro/subflows/critters-four-roll-in.yaml:115-142`, `critters-four-open.yaml:37`). `BareLog` already draws the bar's radius as half its height and the numeral at 0.62 of the disc; it needs only the thicker rects.
- `CrittersGame.tsx:123` and the labels (`PLAY_LABELS.huntLog`, `huntLogFour`) are unchanged.

### 5.3 Picking, entering, leaving

- **Tap a log** (anywhere in its button): plink (0.3). The log, its sockets and disc sink 6 × k over 120 ms, and its shadow stays on the ground (the Play-place tile's press at the frame's k, 7/12 phones and 1 tablets, as the raft's pond, `raft-island-goal.md:232`). About 200 ms after the release, the picker fades out and the round fades in (200 / 200 ms). The round's open line plays 300 ms later, **on that length's first entry this visit only** (Decision 6).
- **The wave** (the cue that the logs are to be tapped): the logs hop in turn, top to bottom, 120 ms apart. Each lifts 3 pt (phones) or 4 pt (tablets) over 240 ms ease-out and settles over 240 ms ease-in; its shadow stays put and dims to 0.75 at the top. **It answers a touch, never a timer** (the Play place's rail, "every motion answers a touch or a line", `play-place.md:178`):
  - once, 300 ms after the picker's fade-in ends (500 ms after it mounts): it answers the tap that brought her here (the Play place's tile, or Back from a round);
  - again on a press-in on the meadow (`hunt-pick-meadow`, in `A` but on no log), at most once per 1200 ms: a tap that misses shows where the logs are.

  It is silent, it never singles out a log, a press on a log cuts it, and it does not run with Reduce Motion (§ 8.1). `PICK_WAVE_AFTER_MS = 300`, `PICK_WAVE_STAGGER_MS = 120`, `PICK_HOP_MS = 480`, `PICK_WAVE_GAP_MS = 1200`.

- **Entering from the Play place:** the place fades out, the picker fades in (200 / 200 ms), silent (`play-place.md:154`).
- **Back from a round:** the round fades out, the picker fades in (200 / 200 ms), silent. Back during a completion beat stores the round complete, as phase 1's Q7.
- **Rotation** lays it out again (no wave); **background** as `play-place.md:212`.

---

## 6. The roll-in (Dave 23 (D) item 8)

**When:** once per learner, at her first complete three-letter round while "4" is not yet open (Dave 23 (B): "after the first complete three-letter round's beat and before New letters", `critters-word-hunt.md:236`). With the shipped sparkle and no line.

### 6.1 Timeline

`U0` = phase 1's "its end + 900" (`critters-word-hunt.md:235`: the cheer is over, and New letters would enter). On this one round, that row becomes:

| t         | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U0        | Emma `idle`. Critters, log and slots stay locked; Back stays live. **The arrival:** a green clay slab carrying the four-seat log (bar, four sockets, the "4" disc, no critters) at this form's four-letter size enters from beyond the screen's right edge (its left edge at the screen width + 8) and glides left to rest centred in `A`, 1200 ms ease-out (the raft's reveal glide, `raft-island-goal.md:142`). It draws above everything, as the picture card does (`play-place.md:461`). |
| U0 + 1200 | It rests. The shipped sparkle (`sfx.sparkle`, 0.55, `playKit.ts:32`). The slab dips 4 pt and back (300 ms, the raft's dock, `raft-island-goal.md:143`). Emma `celebration`.                                                                                                                                                                                                                                                                                                                  |
| U0 + 2300 | **It flies to the door** (§ 6.2): it shrinks onto the door's rect and moves there, 500 ms ease in-out (the fill's flight, § 4.2). Over its last 200 ms the slab, the bar and the sockets fade out and the "4" disc grows to fill the door. Emma `idle`.                                                                                                                                                                                                                                      |
| U0 + 2800 | The door is in place. **New letters** enters beside Back (`critters-word-hunt.md` § 5.3), between Back and the door. The board unlocks.                                                                                                                                                                                                                                                                                                                                                      |

The beat on this round is about 2.8 s longer than phase 1's 6-9 s, once per learner.

**The arrival slab** is the log's footprint (its length × the disc's D) grown by `g` on every side, no wider than `A`, radius half its height, in T9's green clay:

| Form | Slab at rest            | Log bar at rest         | Disc              | Starts at x |
| ---- | ----------------------- | ----------------------- | ----------------- | ----------- |
| P    | (16, 423) 343 × 48      | (19.5, 435) 336 × 24    | (19.5, 431) 32    | 383         |
| L    | (249.5, 230.6) 312 × 48 | (257.5, 242.6) 296 × 24 | (257.5, 238.6) 32 | 675         |
| W    | (134, 749.4) 552 × 72   | (150, 773.4) 520 × 24   | (150, 765.4) 40   | 828         |
| TL   | (428.6, 463.5) 552 × 72 | (444.6, 487.5) 520 × 24 | (444.6, 479.5) 40 | 1188        |

(TL at 1180 × 820 b20.) On P it rests in the 3-log's empty seat row and covers nothing. On L, W and TL it covers part of the meadow, the board or the empty seats for about 2.3 s (the glide and the rest) while touch is locked; nothing under it changes.

### 6.2 The door

| Form | New letters (`critters-word-hunt.md` § 5.3) | **Door**               | Why there                                                                                                                       |
| ---- | ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P    | (88, 8) 56                                  | **(160, 8) 56**        | New letters moved right by Back's size + 16, inside the empty HUD status rect (88, 8) 271 × 56 (measured)                       |
| L    | (88, 8) 56                                  | **(160, 8) 44**        | The same step puts it at the right pane's HUD row, (160, 6.1) 491 × 44; the ribbon starts at y 56.2, so it is 44 (4.2 pt clear) |
| W    | (114.7, 34.7) 74.7                          | **(213.3, 34.7) 74.7** | Back's size + 24 again, in the HUD row (0, 24) 820 × 96; Emma's frame starts at y 120                                           |
| TL   | (114.7, 10.7) 74.7                          | **(213.3, 10.7) 74.7** | In the HUD row (0, 0) 1180 × 96; Emma's frame starts at y 96                                                                    |

- **Look:** the log's end grain as a clay button: T11's disc face (`radial-gradient(circle at 40% 32%, #fbe6c8 0%, #f2d3a6 60%, #dcb27c 100%)`, `inset 0 0 0 3px rgba(125,74,38,0.22), inset 0 2px 0 rgba(255,255,255,0.5)`) over T8's log ledge (phones `0 5px 0 #7d4a26, 0 8px 10px rgba(60,30,10,0.3)`, tablets `0 6px 0 #7d4a26, 0 10px 14px rgba(60,30,10,0.3)`). The "4" in Fredoka 700 at 0.62 × its size (34.7 P, 27.3 L, 46.3 tablets) in `#6b3f1f`, 6.2 : 1 on `#f2d3a6` (`critters-word-hunt.md:164`). No text, badge, glow or idle motion.
- **Tap:** New letters' press and plink (Home's press, 6 × k over 120 ms; plink 0.3). Any line is cut; the round fades out (200 ms) and a fresh four-letter round fades in (200 ms), its open line 300 ms later.
- **Life:** only on the screen the roll-in played on. It stays through New letters and goes when she leaves that screen (Back, the door itself, or the app). It is never drawn again: from then on the picker is the way to "4".
- `accessibilityRole="button"`, label "Log, four letters", `testID="hunt-open-four"`.

### 6.3 Why not a resting place in the scene

After the beat, only P has a free strip for a full-size second log: the 3-log's empty seat row (y 416-478) runs across `A`. On L the free width beside the board is 251 pt for a 296 pt log, and on TL 436 for 520 (phase 1's § 2.4 rects). A full-size log that stayed would cover the board or Emma's column there, so on every form it stays only while touch is locked, then becomes the door: one rule for all four.

### 6.4 Edge cases

- **Back during the roll-in:** it stops. "4" is already open (§ 1), so Back goes to the picker, which shows both logs with no roll-in. It never replays.
- **Background:** a step that falls due waits for the return (`critters-word-hunt.md` § 6.4). **Rotation:** the roll-in jumps to its end (door in place, New letters in, board unlocked).

---

## 7. Wireframes (positions from § 2.4, § 5.2 and § 6; the art is not to scale, the annotations are)

Sample rounds are real rounds by Dave 23 (B)'s rules (my port, § 11). Board order: pictured a-z, then the rest a-z.

```
PHONE PORTRAIT 375×667 (S4, four boxes), a partial run
round o d n p r s t (N 6): drop and stop found; s, t, o seated, seat 4 empty; she taps the log
+-------------------------------------------------+
|(<)                                              |  Back (16, 8) 56
| .-----.  +-----------------------------------+  |
|( Emma  ) | ribbon: empty                     |  |  Emma listening while they sing
|(  147  ) +-----------------------------------+  |
| '-----'                                         |  A from y 259
|  .---------. .---------. .---------.            |  board (31.5, 264) 312 × 140: 100 × 67,
|  | {drop}  | | {pond}  | | {stop}  |            |    6 apart, at x 31.5 137.5 243.5;
|  |[d|r|o|p]| |[ | | | ]| |[s|t|o|p]|            |    pictures 36 at (x + 32, y + 3)
|  '---------' '---------' '---------'            |
|  .---------. .---------. .---------.            |  row 2 at y 337: prop, spot, trot
|  |   <))   | |   <))   | |   <))   |            |    (no picture: the listen mark)
|  |[ | | | ]| |[ | | | ]| |[ | | | ]|            |
|  '---------' '---------' '---------'            |
|   (s)     (t)     (o)    [    ]                 |  seats y 416, 70, at x 35.5 113.5 191.5
| (4)===o=======o=======o=======o====             |    269.5: "s ... t ... o", never judged
|       ( ) (d) (n) (p)                           |  log (19.5, 478) 336 × 24, 3.5 from A's
|         (r) (s) (t)                             |    sides; "4" (19.5, 474) 32; o a socket
+-------------------------------------------------+  meadow (63.5, 510) 248 × 120, 4 + 3
```

```
PHONE LANDSCAPE 667×375 (S5), the hint's four sounds
round o b d l n p r (N 5): drop and pond found; slot 3 (blob) glows and was tapped:
/b/ ... /l/ ... /o/ ... /b/ ... "blob"
+---------------------------------------------------------------------------+
|(<)           |  ribbon (160, 56.2) 491 wide: empty                        |
|              +------------------------------------------------------------+
|                                                   .--------. .--------.   |  board (461, 151.1)
|  .------.   [    ] [    ] [    ] [    ]           | {drop} | | {pond} |   |    190 × 207: 92 × 65,
| ( Emma   ) (4)=o=====o=====o=====o===             |[d|r|o|p]|[p|o|n|d]|   |    6 apart, x 461 559,
| ( atten- )                                        '--------' '--------'   |    rows y 151.1 222.1
| ( tive-  )     (o) (b) (d) (l)                    *========* .--------.   |    293.1
| ( point- )       (n) (p) (r)                      *  <))   * |  <))   |   |  slot 3 blob glows;
| ( ing    )                                        *[ | | | ]*|[ | | | ]|   |    slot 4 plop
|  '------'                                         *========* '--------'   |
|                                                        .--------.         |  row 3: prop alone,
|                                                        |  <))   |         |    centred (510, 293.1)
|                                                        |[ | | | ]|         |
|                                                        '--------'         |
+---------------------------------------------------------------------------+
 block (160, 160.6) 296 × 188: seats 60 at x 176 244 312 380, the "4" (160, 208.6) 32;
 meadow (200, 244.6) 216 × 104, o b d l / n p r; gap 5; no critter lights while the hint sings
```

```
TABLET PORTRAIT 820×1180 (S1), the fill into its own slot
round a b c d l m p (N 4, Dave's pinned short-a round; b is the decoy): clap and lamp found;
she has just built "damp" (no picture): four tiles fly into slot 4, under its listen mark
+-----------------------------------------------------+
|(<)                                                  |  Back (16, 34.7) 74.7
| .--------.  +-------------------------------------+ |
|( Emma     ) | (Emma's "Damp." has ended)          | |  Emma idle at the fill
|(  idle    ) +-------------------------------------+ |
| '--------'                                          |  A from y 442.8
|          .---------------. .---------------.        |  board (214, 462.4) 392 × 288: 2 + 2
|          |    {clap}     | |    {lamp}     |        |    of 188 × 136, 16 apart, x 214 418;
|          |[c] [l] [a] [p]| |[l] [a] [m] [p]|        |    pictures 72 at (x + 58, y + 8)
|          '---------------' '---------------'        |
|          .---------------. .---------------.        |  row 2 at y 614.4: camp, damp
|          |      <))      | |      <))      |        |
|          |[ ] [ ] [ ] [ ]| |[d] [a] [m] [p]|        |  tiles leave at 0, 60, 120, 180 ms
|          '---------------' '-^---^---^---^-'        |
|     [d]       [a]       [m]       [p]               |  seats 110 at x 166 292 418 544, y 774.4
|   (4)====o=========o=========o=========o====        |  log (150, 876.4) 520 × 24; "4" 40
|          ( ) (b) (c) (d)                            |  meadow (210, 916.4) 400 × 192,
|            (l) (m) (p)                              |    a b c d / l m p
+-----------------------------------------------------+
```

```
TABLET LANDSCAPE 1180×820 (S1, b20), after the beat
round a c l m n p s (N 6): clap, lamp, camp, plan, slap found (5 of 6: complete); snap still findable;
New letters beside Back; no door (nothing rolls in after a four-letter round)
+------------------------------------------------------------------------------+
|(<) (✿)                                                                       |
| .------.   +-------------------------------------------------------------+   |
|( Emma   )  | ribbon (245.2, 112) 918.8 wide                              |   |
|( idle   )  +-------------------------------------------------------------+   |
| '------'                                          .-----------. .-----------.|  board (772, 279.5)
|                                                   |  {clap}   | |  {lamp}   ||    392 × 440: 2 columns
|  [    ] [    ] [    ] [    ]                      |[c|l|a|p]  | |[l|a|m|p]  ||    of 188 × 136, x 772
| (4)===o======o======o======o===                   '-----------' '-----------'|    976, rows y 279.5
|                                                   .-----------. .-----------.|    431.5 583.5
|      (a) (c) (l) (m)                              |   <))     | |   <))     ||  camp, plan
|        (n) (p) (s)                                |[c|a|m|p]  | |[p|l|a|n]  ||
|                                                   '-----------' '-----------'|
|                                                   .-----------. .-----------.|  slap found; snap
|                                                   |   <))     | |   <))     ||    empty, findable
|                                                   |[s|l|a|p]  | |[ | | | ]  ||
|                                                   '-----------' '-----------'|
+------------------------------------------------------------------------------+
 (✿) New letters (114.7, 10.7) 74.7. Block (245.2, 332.5) 520 × 334: seats 110 at x 261.2 387.2
 513.2 639.2, log (245.2, 434.5) 520 × 24, "4" (245.2, 426.5) 40; meadow (305.2, 474.5) 400 × 192;
 gap 6.8 to the board
```

```
PICKER, PHONE PORTRAIT 375×667                  PICKER, PHONE LANDSCAPE 667×375
+-------------------------------+               +------------------------------------------------+
|(<)                            |               |(<)          ribbon: empty                      |
| .-----.  [ribbon: empty]      |               |                                                |
|( Emma  ) idle, silent         |               | .-----.                                        |
| '-----'                       |               |( Emma  )       (3)=o====o====o==               |
|                               |  A from y 259 |( idle  )         ~~~~~~~~~~~~~~~               |
|                               |               |                (4)=o====o====o====o==          |
| (3)=o=====o=====o===          |  row 3        | '-----'          ~~~~~~~~~~~~~~~~~~~~          |
|   ~~~~~~~~~~~~~~~~~           |  (16, 359)    +------------------------------------------------+
| (4)=o=====o=====o=====o===    |  269.3 × 88    row 3 (244.9, 166.6) 253.2 × 88, row 4
|   ~~~~~~~~~~~~~~~~~~~~~~~     |  row 4           (244.9, 254.6) 321.2 × 88; discs at x 252.9;
|                               |  (16, 447)       bars 28 tall at y 196.6 and 284.6
|            (meadow)           |  343 × 88
|                               |                TABLETS: W and TL as § 5.2's table (bars 36,
+-------------------------------+                  discs 56, rows 123.2)
 discs (24, 383) and (24, 471), 40; bars 28 tall at y 389 and 477; ~~ the ground shadow.
 A log's row is its button; a tap on no log is the meadow and sends the wave (§ 5.3)
```

```
THE ROLL-IN, PHONE PORTRAIT 375×667, at U0 + 1200 (resting) and after U0 + 2800
round a b g h p t just complete (the critters-hunt seed, t-a-g built); the lap, "You did it!" and the burst are over
+-------------------------------------------------+      +--------------------------------+
|(<)                                              |      |(<) (✿) (4)                     |
| ( Emma, celebration )                           |      | Emma idle                      |
|  .-------. .-------. .-------.                  |      |  (board, unlocked;             |
|  | {bag} | | {bat} | | {hat} |   (row 1 of 3+3) |      |   pat still findable)          |
|  .===========================================.  | <--  |                                |
|  | (4)==o=======o=======o=======o====         |  |      |  (log "3" and the meadow)      |
|  '==========================================='  |      +--------------------------------+
|  ... the 3 log, the meadow, under it ...        |       (<) Back (16, 8); (✿) New letters
+-------------------------------------------------+         (88, 8) 56; (4) the door (160, 8) 56
 the slab (16, 423) 343 × 48 glided in from x 383 (1200 ms ease-out), dipped 4 pt with the sparkle;
 at U0 + 2300 it shrinks into the door over 500 ms, leaving only its "4" disc

  (x) a critter   ( ) the vowel's ringed burrow   [    ] an empty seat   o a socket on the log
  {drop} a slot's picture   <)) the listen mark   [d|r|o|p] found tiles   [ | | | ] empty sockets
  *==* the hint's glow   (4)=== the "4" disc on the log's end   (<) Back   (✿) New letters   (4) the door
```

---

## 8. Reduce Motion and VoiceOver (Dave 23 (D) item 11)

### 8.1 Reduce Motion

Lines, sounds and their times are unchanged; dragging still follows the finger.

| Motion                              | With Reduce Motion                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Picker press                        | A 150 ms dim (opacity 1 → 0.85 → 1) of the pressed log instead of the sink (the raft picker's, `raft-island-goal.md:385`)                                                                                       |
| The picker's wave                   | None: no hop on arrival or on a meadow tap (§ 5.3); the meadow tap does nothing                                                                                                                                 |
| Picker in and out, round in and out | Unchanged (already fades)                                                                                                                                                                                       |
| The roll-in                         | No glide, dip or flight, and no slab. At U0 + 1200 the door fades in at its rect (300 ms) with the sparkle; Emma `celebration`, then `idle` at U0 + 2300; New letters (200 ms fade) and the unlock at U0 + 2800 |
| The door's press                    | Kept, as New letters' (the clay disc's press has no Reduce Motion branch, `mapChrome.tsx:90-95`)                                                                                                                |
| The four-tile fill                  | No flight: the card fades out where it is (300 ms) and the four tiles fade in at the word's own slot (200 ms) (§ 15.9)                                                                                          |
| A partial or full run singing       | The singing light instead of the bounce (`play-place.md` § 3.7); the lean is kept                                                                                                                               |
| The burst                           | None (as Word Song)                                                                                                                                                                                             |

### 8.2 VoiceOver (labels only: Lily speaks none of them)

They go in `PLAY_LABELS` (`mobile/src/screens/play/playLines.ts:105-117`) beside `huntLog` ("Log, three letters", `:112`), so a language version swaps rows.

| Element                               | Label                                       | Role, activate                                               |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| The picker's "3" log (its row)        | "Log, three letters"                        | button; opens the three-letter round                         |
| The picker's "4" log (its row)        | "Log, four letters"                         | button; opens the four-letter round                          |
| A log's bar, sockets, disc and shadow | none (`accessible={false}`, inside its row) |                                                              |
| The meadow under the logs             | none (`accessible={false}`)                 |                                                              |
| The door                              | "Log, four letters" (`huntLogFour`, new)    | button; opens a fresh four-letter round                      |
| The log in a four-letter round        | "Log, four letters"                         | button; sings the seated critters, a partial run too (§ 4.1) |
| Slots, the glowing slot               | as § 15.9: "Word to find", the word, "Hint" | button                                                       |

- Picker focus order: "3", then "4". The roll-in announces nothing (as the beat, `critters-word-hunt.md:410`); the door becomes an element when it lands. No label states a count.

---

## 9. Assets, audio and spend (counts only; each spend is asked under its own popup later)

**Drawn in the app, $0:** the four-box slots, the four-seat log with its sockets and "4" disc, the picker's logs and their ground shadows, the arrival slab, the door. **Reused:** the poses `idle`, `listening`, `attentive-pointing`, `cheering`, `celebration` (`emmaPose.ts:24-32`); plink, sparkle and cheer (`playKit.ts:31-33`); "You did it!" and the burst; the 11 lesson pictures and their praise clips.

**New audio: 92 Lily lines, 504 input characters,** in one render, under its own spend popup, judged at the voice-QA ear test (Dave 23 (D), "Spend"). Caption "<W>.", input "<W>,":

- **The 82 four-letter targets** (410 characters), by vowel: a: flag hand lamp clap flap slap snap drag glad flat plan swam camp damp ramp band land sand. o: frog pond stop spot plot drop crop flop plop prop trot blob cost soft from. i: gift drip grip trip flip clip lift. u: drum plum club plug slug spun stun jump bump dump lump pump dust must rust just hunt gulp bulb. e: tent nest belt bend lend went sent rent bent dent best rest test vest west felt melt left step stem sled next text.
- **9 three-letter words** (36 characters): Act Add Ant Elf End Ill Its Odd Off.
- **1 open line** (58 characters): "Drag four letters up to the log. Can you make these words?"
- **Ear-test prediction** (Dave's): "From," may come back as the weak /frəm/; "Sent," and "Went," may run into a following silence.

**New pictures: 16, about $1.25** at $0.078 each (batch 18's rate, Dave (6)), one batch under its own popup and contact sheet, in the pack style, through `design/word-song/picture-manifest.json`'s `subject`, `avoid` and `distinctFrom` fields (e.g. _mug_, `:2746-2758`). Dave's rule: a thing a 6-9 learner names with that word, never a picture likelier to be named as another app word. Notes (Dave's three marked **D**; the rest are mine, for the manifest's author to sharpen):

| Word | Subject note                                                                                                                      | Must not read as (pack words in brackets)                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| sand | a heap of golden sand with a small toy spade in it                                                                                | a beach scene (_sun_), a sandcastle with a flag (_flag_)                        |
| ramp | a wooden ramp on a block, big in frame; a small ball part-way down shows the slope                                                | stairs, a slide, a plank alone (_log_)                                          |
| clap | two hands meeting mid-clap, small motion marks between them                                                                       | **D:** _hand_ (never one open hand)                                             |
| vest | a bright yellow hi-vis safety vest, sleeveless, open front, two silver reflective stripes, laid flat, no text or logo (Dave, Q23) | a coat or jacket (coat: no sleeves, hood, zip or buttons), a shirt, a waistcoat |
| sled | a wooden sled with red runners on snow, empty                                                                                     | a boat (_boat_), a tray (_tray_)                                                |
| clip | a chunky bright hair clip, drawn bold                                                                                             | a thin wire (thin lines fail at 36 pt, § 15.10), a pin (_pin_)                  |
| drip | a plain pipe end with three small drops falling into a puddle                                                                     | **D:** _tap_ or _drop_ (no handle or spout; not one big drop)                   |
| stop | a red octagonal sign on a pole, white rim, no letters                                                                             | a raised hand (_hand_); text in a picture                                       |
| drop | one big clear-blue water drop, alone                                                                                              | rain, a puddle, a dripping thing (_drip_)                                       |
| jump | a child in mid-air, arms up, small arcs under the feet                                                                            | a frog (_frog_), standing figures (_man_, _dad_)                                |
| pump | a bicycle hand pump, alone                                                                                                        | a bike (_bike_)                                                                 |
| plug | a chunky electric plug on a short curly cable                                                                                     | a wall socket alone                                                             |
| slug | a slug with no shell on plain ground                                                                                              | **D:** _snail_ (no shell, no spiral); a leaf under it (_leaf_)                  |
| bulb | one glowing light bulb, no shade or stand                                                                                         | _lamp_                                                                          |
| ant  | one big red ant, side view, six legs, three body parts                                                                            | _bug_, _bee_                                                                    |
| elf  | a small friendly elf with pointed ears and a green pointed hat                                                                    | _king_, _hat_                                                                   |

With the 11 lesson pictures, 25 of the 82 targets are pictured (Dave). **Optional, not now** (Dave): 5 phase-1 pictures (hog pup fin tin vet), about $0.39, only if device play shows listen slots stall.

---

## 10. Acceptance criteria (F1-F22)

### 10.1 Core (vitest, `packages/core`; Kevin; Dave 23 (D) item 12)

1. **F1.** For every vowel, every round `huntRounds(v, { length: 4 })` returns has 7 letters (the vowel, then 6 distinct consonants of the 17, a-z); its targets are exactly the `HUNT_FOUR_TARGETS` words those letters spell (the vowel once, a consonant at most twice), 4-6 of them, at least 2 with a bundled picture; at most 1 consonant is in no target; no `HUNT_RUDE_FOUR` word is spellable; no `HUNT_FOUR_UNDEALT` word is spellable (the 25 words with no clip, Q21); `extras` is empty. `huntDeal` never returns `last`'s letters, and the same seed gives the same round.
2. **F2.** `HUNT_FOUR_TARGETS` equals Dave's 82 (a 18, o 15, i 7, u 19, e 23); `HUNT_RUDE_FOUR` his printed 18; `HUNT_FOUR_UNDEALT` his 25; _hump_ is on none.
3. **F3.** With the 16 pictures bundled, each of Dave's 5 pinned fallbacks is a round by F1 with the targets § 1 lists. The rounds per vowel are a 56, o 51, i 2, u 125, e 86, with § 1's N splits (Dave's counts; Q21).
4. **F4.** `huntComplete` is false at N − 2 and true at N − 1 for N 4, 5 and 6, and stays true at N.
5. **F5.** `huntBoardOrder` in a four-letter round is the pictured targets a-z, then the rest a-z: o d n p r s t gives drop pond stop prop spot trot; a c l m n p s gives clap lamp camp plan slap snap.
6. **F6.** `huntOpenLengths()` is `[3]` until a learner's first three-letter round completes, then `[3, 4]`, written with the completing find, kept across restarts, never reverting. Learner B's stay `[3]`. A four-letter `HuntRecord` (7 letters) round-trips under the `"4"` key and leaves `"3"` untouched.
7. **F7.** _act add end ill its odd off_ are on `HUNT_FAMILIAR`; _ant_ and _elf_ are said words with a picture once bundled; none of the 9 is on `CRITTER_NOT_SAID`. Phase 1's H2/H3 counts are re-pinned to what the code then gives.
8. **F8.** A run of four: `'word'` for a `HUNT_FOUR_TARGETS` word, `'quiet'` for anything else; never `'picture'` or `'funny'`.
9. **F9.** `critterWordLine` exists for all 82 and the 9, caption "<W>."; the four-letter open line has the exact text of § 1; `critterPraise` returns the lesson clip for the 11 lesson words.

### 10.2 Native (jest, `mobile`; Devon)

10. **F10.** The four-letter scene equals § 2.4's 15 rows for N 6 (step, slot, board, log band, meadow, card) and passes the fit rule for N 4, 5 and 6. The meadow is 4 + 3 in round order.
11. **F11.** The four-letter log has 4 seats and 4 sockets, `critter-log-numeral` reads "4", and its label is "Log, four letters". No rendered text in a round contains a digit other than its length; no label or line states a count.
12. **F12.** With fake timers and audio: 1-3 seated make no sound for 5 s. A log tap sings them left to right, 300 ms apart; the gap across one empty middle seat is 900 ms (300 + 600), and each further empty middle seat adds 600; no outcome, clear or write follows, and the hint's run count is unchanged. Four seated sing 400 ms after the last seat change. A target: Emma's word line with its caption, the joy beat, its picture if it has one, its praise once per visit (the 11 only), then four tiles into its own slot at 0, 60, 120 and 180 ms and the shelf clearing 400 ms after the last lands. A non-target: one bounce together, no line, no boing, then the clear.
13. **F13.** In a four-letter round, `hunt-bonus` never renders, and no boing, tumble or non-word line plays, over any sequence of runs.
14. **F14.** An empty slot's tap plays its `critterWordLine` clip, sound only. The hint glows after 5 runs of four with no new target (or 45 s); its tap plays the four critters' windows in order, each 300 ms after the last ends, then the word clip 300 ms after the fourth; no critter's lit state changes; no ghost.
15. **F15.** At N − 1 the phase-1 beat plays in board order, with no roll-in and no door; New letters deals a fresh four-letter round.
16. **F16.** The picker: absent with `[3]`; with `[3, 4]` the game opens on it. `pickerScene` equals § 5.2's tables: each `hunt-pick-<n>` is at its log's button rect, with the bar and disc as listed, on P, L, W and TL; on all 16 viewports both buttons are inside `A` and at least 44 pt tall. Rendered: no slab, no `hunt-pick-<n>-face`, no text but the discs' numerals, n sockets on log n. A log tap opens that length's round (in progress, else fresh); a tap on `hunt-pick-meadow` opens nothing. Its open line plays on the first entry of that length in the visit and not on the second. Back from a round goes to the picker, and from the picker to the Play place. The picker plays nothing but the plink, on a log tap only. With fake timers: the wave starts 500 ms after the picker mounts (each log's hop 120 ms after the one above), and again on a meadow press-in, but not twice within 1200 ms; nothing moves after it with no touch for 30 s; a log's press-in cuts it.
17. **F17.** The roll-in, with fake timers: on a learner's first complete three-letter round, § 6.1's steps play once at their times, the door lands at § 6.2's rect and New letters enters after it. A door tap opens a fresh four-letter round. On the next completion, and on any later screen, there is no roll-in and no `hunt-open-four`. Back mid-roll-in goes to the picker, and the roll-in never replays.
18. **F18.** Reduce Motion (mocked): § 8.1's rows; no glide, flight, dip, bounce, burst or picker wave starts; lines and sounds keep their times.
19. **F19.** VoiceOver: § 8.2's labels and roles; each picker log's row is one element, in order "3" then "4"; its bar, sockets, disc and shadow, and the meadow, are not elements.

### 10.3 Device and E2E (Jessica first; phone P and L, iPad portrait and landscape; Emma muted for local runs)

20. **F20.** Maestro on the `critters-hunt` seed (a b g h p t, with bag, hat, bat and tap found, `critters-word-hunt.md:564`), learner with `[3]`: build t-a-g. The beat plays, the log glides in and becomes the door, New letters appears. Tap the door: a four-letter round with the "4" log, 7 critters and four-box slots, everything inside the play area on all four forms (screenshots). Back: the picker with two logs. Back: the Play place. Reopen: the picker.
21. **F21.** Maestro on a proposed `critters-hunt-four` seed (a b c d l m p, with clap and lamp found): seat c, a, p: nothing sings for 5 s; tap the log: "c ... a ... p", nothing else. Build c-a-m-p: it fills slot 3, and the beat plays (3 of 4). _damp_ stays findable. New letters: a fresh four-letter board.
22. **F22.** Thomas's eye on a phone and an iPad (§ 11): the four-box board, the picker, the roll-in and the door. His ear on the 92 lines is the render's own ear test.

---

## 11. Prediction and bounded convergence

- **Prediction (falsifiable, written before anyone sees it on a device):**
  - Thomas reads "four" from the board alone, before the log or the disc.
  - On the roll-in, Marian taps the door before New letters.
  - In four-letter rounds she builds the pictured words first and leaves the listen slots for last, as Dave predicted for phase 1. At least once she builds a three-letter word on the four-seat log (_pod_, _top_) and taps the log; she shows no upset when nothing happens.
  - The 12.4 pt tile letters on the 667 × 375 phone read; on the 1024 × 768 iPad in landscape Thomas calls the S4 slots small.
- **Bounded convergence.** **Tested:** the geometry, through the shipped `mathLayout`, `playArea` and `backRect` and a port of `huntSceneAt` and `huntSceneFits` (the method check reproduces phase 1's amended phone rows exactly); the round rules, by a Python port of Dave 23 (B)'s text, which reproduces all 5 of his pinned fallbacks and his a, i and u counts but not his o (52 vs 51) or e (101 vs 86) (Q21; answered by his undealt rule, which the core reproduces exactly); which pictures are bundled (11 of 27, by file, 2026-10-26); the open line's length (58). **Not tested:** anything on a device; every timing (no clip measured); whether the roll-in and door read as "a new game" to a child; whether the 600 ms rest reads as "a sound is missing"; whether a decoy confuses a 6-9 learner; Dave's own untested list (his port against Kevin's code, picture recognisability, known words that sit).

---

### 11.1 The picker polish (2026-10-27)

- **Prediction (written before Thomas sees it on a device):** on his iPad (1080 × 810) Thomas reads the two logs as the choice with nothing explained, and does not ask for a box or band back. If he finds fault, it is with the empty meadow around the pair ("too empty", "too low"), not with the logs. The lever is § 5.2's pitch (2.2 `D`, 123.2 on tablets); the pair is centred in `A`, which sits right of Emma's column. The one-socket step from "3" to "4" reads as "longer word, longer log" to him before anyone says so.
- **Bounded convergence.** **Tested:** the geometry on § 2.4's 15 viewports and his iPad, through the shipped `mathLayout`, `playArea`, `backRect` and `logSockets` (the method check reproduces the old slabs exactly, and his screenshot's slab edges at insets 0); the look, as HTML drawn to those rects with the shipped backdrop gradient, the real Emma and Fredoka (`tmp/picker-polish/`). **Not tested:** anything on a device; React Native's rendering of the ground shadow's `ellipse` gradient (the shipped pieces use `circle`); the wave's feel on a device, and whether a child taps the meadow at all; the roll-in's arrival slab (§ 6), which keeps its small green clay pill and was not redesigned here.

## 12. Amendments for the build PR

- `critters-word-hunt.md`: § 5.1's "(phase 2)" row (`:236`) → this spec § 6; § 6.3's log row → per length; H9 (`:470`) "renders '3'" → the round's length; H11 (`:474`) → its length. § 9 already points here (this PR).
- `play-place.md`: `:155` and `:539` (Back from the game goes to the Play place) → to the critters' picker with two lengths open; § 3.8's labels.
- `playLines.ts` `PLAY_LABELS`: `huntLogFour` "Log, four letters".
- `guidanceLines.ts`: the four-letter open line and the 91 word lines.

---

## 13. Open questions (numbered after `critters-word-hunt.md`'s Q1-Q18)

19. **Q19 (coordinator, Dave). The door** (Decision 7). The alternative is show-and-go: the log glides in, sparkles and glides out, and she finds "4" through Back → picker. That adds no new control, but the reward leaves the screen. I recommend the door.
20. **Q20 (Dave). The 600 ms rest** for an empty middle seat when she taps a partial run (Decision 8). It marks a missing sound without a word. Is a rest a judgement in disguise? If so, empty seats are skipped. **Answered (Dave):** keep it, additive: 900 ms across one empty middle seat (300 + 600), each further one adds 600 (§ 4.1, F12).
21. **Q21 (Dave, Kevin). Round counts.** My port of your written rules gives o 52 and e 101 where you have 51 and 86 (a, i and u match, and all 5 fallbacks reproduce). The e difference is all in six-target rounds (52 vs 37). Did your port have a rule the text does not? Kevin's test pins what the written rules give. **Answered (Dave):** yes: no round deals a letter set that spells one of the 25 words with no clip (`HUNT_FOUR_UNDEALT`, § 1 "Rejected", F1). With it the core gives his counts exactly (F3).
22. **Q22 (coordinator, Thomas). Two tight tablets:** the 1024 × 768 iPad in landscape takes the phone slot (S4), and 1180 × 820 keeps S1 with the board 5.2 pt from seat 4's drop zone. The levers are a tablet-only step between S3 and S4, or a 16 pt minimum gap (which drops 1180 × 820 and 1194 × 834 to S2). I recommend shipping as measured and looking on device.
23. **Q23 (Dave). _vest_:** in British English (Lily's voice) a vest is a sleeveless undershirt; in American English it is a waistcoat. Which picture names "vest" for a 6-9 learner, or should _vest_ go unpictured? **Answered (Dave):** a hi-vis safety vest, called a vest in both; § 9's row (the shipped picture).
24. **Q24 (Kevin). The open-lengths shape** inside `marian-tutor.critter-hunt.v1`: yours to pick (Dave 23 (B)); F6 is the contract. **Answered (Kevin):** `{ "3": HuntRecord, "4": HuntRecord, "open": [3, 4] }`, written by `saveHuntRecord(record, 3, { unlock: true })`; no `open` reads `[3]` (§ 1).
25. **Q25 (coordinator). Build order:** Kevin's core (F1-F9) and the two spends (render, pictures) before Devon's UI. Until the 14 four-letter pictures are bundled, few rounds have 2 pictures, so the UI cannot be checked against real deals.
26. **Q26 (Dave). Each length's open line once per visit** (Decision 6), rather than on every entry from the picker.
27. **Q27 (Dave, FYI). The picker shows no round state** (Decision 5): a round left half done looks the same as none.
28. **Q28 (Dave, FYI). The picker's wave** (§ 5.3, 2026-10-27): the logs hop in turn, top to bottom, once as the picker appears and again when a tap lands on no log. It is silent, the same for every log, never on a timer, and off with Reduce Motion. It answers a touch, so it stays inside the Play place's rail "every motion answers a touch or a line" (`play-place.md:178`). The coordinator's brief asked for "a gentle idle cue"; I did not make it repeat while she waits, because that would be a second motion with no touch behind it (the raft's bob is the only one). If you would rather it never ran on arrival, drop that one; the meadow tap alone still teaches where the buttons are.

---

## 14. Child-safety and dark-pattern check (the four-letter rounds only)

| Risk                    | Here                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A prize, a currency     | None. The unlock is a harder game, not a prize (Dave (3)); no star, badge, "new" mark or count anywhere                                                                                                                                                                  |
| Lures                   | The door is still, silent and child-tapped, shows once, and never returns; the picker shows no unfinished round (Decision 5) and never speaks; its wave answers a touch, moves every log alike and never repeats on its own (Q28); nothing outside the game mentions "4" |
| Forced difficulty       | None: she can always go back to 3, with no re-lock (Dave 23 (B))                                                                                                                                                                                                         |
| Variable reward         | None: the roll-in plays once per learner; the beat is the same every time                                                                                                                                                                                                |
| Untaught content judged | Clusters are relaxed (Dave (4)): a four-letter run is never judged a miss; a non-target sings and sits; only her taught vowels deal                                                                                                                                      |
| Failure feedback        | No boing, tumble or line in four-letter rounds; a partial run is never judged                                                                                                                                                                                            |
| Grind                   | 4-6 words, all but one, the hint                                                                                                                                                                                                                                         |
| Rude words              | No round's letters spell one of Dave's 18                                                                                                                                                                                                                                |
