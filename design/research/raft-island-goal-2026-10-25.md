# Raft crossing island goal + level up: Dave's ruling (2026-10-25)

The text of the ruling Dave returned by Orca dispatch on 2026-10-25, verbatim. It was `tmp/specs/dave-raft-island-ruling.txt` in the main checkout, which git ignores; prettier added only blank lines and list indentation. `design/native/raft-island-goal.md` cites it as "Dave (n)" by the section numbers below. Line numbers in it are at `main` 2cdfa910 unless it says otherwise. Thomas chose phase 1 by popup on 2026-10-25 ("Yes, phase 1": the islands, the party, the 20 raft).

SUMMARY. I designed the raft's island goal: each raft has its own island with nine homes, one per animal kind (bee 1 to pig 9), shown as silhouettes with their weight tags; a kind's first landing fills its home, every shore is guaranteed a load that can bring a missing kind, and the ninth kind sets off a party that ends the trip and opens a wider 8-seat raft for 20 with its own island. A raft for 100 follows only when the path reaches two-digit adding. Found: the party needs 0 new audio ("You did it!" from the lesson clips plus the shipped "What a party on the island!", which moves off the ordinary trip end), phase 1 needs 12 Lily lines (124 input characters) and $0 art, and a scratch simulation shows the guarantee cuts filling an island from a median of 10-11 crossings (worst 49-51) to 6-8 (worst 13-18); separately, the raft's splash sound has never landed, so its funny failure is silent today. Left for Kyle: the nine homes on both islands (a phone in landscape fits only 8 at today's size), the fill and party beats, the 8-seat 20 raft and where its target numeral sits, the raft picker, and the trip end without its line; the 100 raft is not designed.

RULING. E = cited or computed evidence, R = my reasoning. "Computed" means an inline node script (run with node -e, never saved), porting raftLoads, raftShore and raftRefill from packages/core/src/games/playPlace.ts:84-185 at this branch's HEAD 2cdfa910 (main). Its two child models (one picks a random load, the other the load with the most missing kinds) are models, not a study. Line numbers are at 2cdfa910.

(1) THE ISLAND GOAL

- What fills: kinds, not animals. Each raft's island has 9 homes, one per kind (weights 1-9, RAFT_ANIMALS playPlace.ts:64-74). R: a count of animals has no end and no shape. Nine kinds is a set she can see is complete, and it fits:
  E (hand-computed from islandSpot, mobile/src/screens/play/playGeometry.ts:221-235, with A from play-place.md:198-201): at today's 0.5 a the island holds 10 cells on a phone in portrait (5 x 2 in the 205.8 x 90.2 mound), 8 in landscape (2 x 4 in 108 x 173.1), 16 on a tablet in portrait and 21 in landscape. So a phone in landscape is 1 short (Kyle, below). At 0.45 a (28.8 pt), 3 x 3 fits: 3 x 28.8 + 2 x 4 + 8 = 102.4, which is under 108.
- How it shows, without reading:
  - The 9 homes sit in fixed places, bee to pig. Each is a little sand nest with the kind's silhouette (its shipped pack picture tinted in the app, $0) and its cream weight tag with the numeral, as on the shore (play-place.md:255).
  - A home fills when that kind first lands: from then on the animal sits there in colour.
  - There is no count, no "5 of 9" and no bar, and Emma never says how many are left (as in the hunt, Dave (2)).
  - R: the tag on an empty home makes the goal a number. "The 9 is missing" means a load with a 9, which is 9 + 1: the bond she is practising.
- A crossing that brings a new kind: the scene and its line play as today. Then the animals walk to their homes in weight order. Each new kind's home fills: the silhouette becomes the animal, with the shipped sparkle (0.55) and the correct-tap burst from that home. No line. Two new kinds in one crossing fill 300 ms apart.
- A crossing that brings only kinds already home: the scene and line as today. Then each animal hops into its own home and the home wiggles once (the hunt's repeat-find wiggle, Dave (2)). No fill, no sparkle, no line, and nothing that says "already".
- The shore guarantee (new). While the island lacks a kind, every shore (the first and each refill) has at least one load that brings a missing kind. raftShore and raftRefill (playPlace.ts:139-185) add this to their accept test; the fallback seeds the missing kind w and 10 - w.
  E (computed, 5,000 seeds per cell, crossings to fill the 10 island, random-load child / most-missing child):
  - without the guarantee: median 11 / 10, 90th percentile 19 / 18, worst 51 / 49;
  - with it: median 8 / 6, 90th 11 / 7, worst 18 / 13.
    R: without it, the last kind (often the pig, whose only load is 9 + 1) is a wait on luck. A prize paid by a chance roll is the line my rail draws (design/research/real-games-2026-10-20.md:71). With the guarantee, every crossing can bring a new kind and she decides whether it does.
    At 3 crossings a trip that is about 2-3 trips of 1.5-3.5 min each (play-place.md:316): the first party falls within one or two sittings, against my 5-10 min target for a sitting (real-games :116, my judgement).
- Persistence, per learner: the learner-scoped store, local only. Per raft (10, 20), it keeps the set of kinds home, written when a kind first lands home (on arrival). Back mid-crossing loses only a crossing that never landed.
  - Nothing else is kept: no crossing counts, no trips, no shores, no totals, no times. Which rafts are open is derived from the islands (3), not stored.
  - It is toy state, never progress: no mastery, Leitner, stardust, history, streak or sync (real-games :87).
  - Kevin picks the key, beside the hunt's (HuntRecord, design/native/critters-word-hunt.md:49).
  - It changes Decision 4 (play-place.md:34) and AC N5 (:744) for the raft, as H21 does for the hunt (critters-word-hunt.md:473): a raft visit writes only that key, once per new kind.

(2) THE PARTY

- When: the ninth kind's home fills. It is the same beat every time and has 0 new audio. It follows the hunt's beat (critters-word-hunt.md:217-231):
  1. P0 = the last fill ends. Touch locks (Back stays live). Emma takes celebration.
  2. P0 + 300: the lap. The nine homes hop once each, bee to pig, 120 ms apart, with today's 300 ms island hop arc (play-place.md:301).
  3. Then Emma takes cheering and says "You did it!": Word Song's session.end.opener, the bundled clip keyed by that text (mobile/src/audio/canonAudioRegistry.ts:1575), through the canon-text seam the praise clips use (mobile/src/screens/play/playLines.ts:57), as the hunt does.
  4. At its end: sfx.cheer and the burst over the island, and all nine dance together (the shipped dance scene, play-place.md:311).
  5. Then "What a party on the island!" (guide.play.raft.close, shipped, packages/core/src/emmasPath/guidanceLines.ts:424). From now on that line plays only here.
  6. At its end + 800 ms: the reveal (3), when a raft opens.
     R: about 8-10 s, estimated and not measured.
- After it. The party ends the trip, on whatever crossing it falls; the raft does not go back for that trip's remaining crossings. R: the fullest moment is the natural stop (real-games :89).
  - The game then shows the raft picker (4), with the new raft docked. It is silent and waits for ever: she taps a raft to start a new trip, or Back to leave.
  - Nothing starts on its own and no line asks. AC C8 holds: neither line has "again", "next", "more" or "round".
- One party per island, ever. A full island stays full: what she built is never lost and never decays (real-games :87). It is never emptied and never has a second party.
  - Trips to a full island are ordinary: the scene, then each animal hops into its home and the home wiggles.
  - R: emptying it for another party would turn a finished set into a treadmill of the same nine.
- The ordinary trip end (the third crossing, no party): today's island bounce, Emma waving, no line, then back (4).
  - R: today every trip ends on "What a party on the island!" (RaftCrossing.tsx:374-381). With the homes on screen, that would call an island with empty homes a party and spend the party's line before the party.
  - It changes play-place.md:304 and ACs N8 and V5.
  - Developer note: RaftCrossing.tsx:378-380 runs kit.done from the close line's end, so the bounce must run it instead.

  > **Superseded 2026-10-26 (an editor's note, not Dave's text):** there is no ordinary trip end any more (Dave's build-23 ruling (C), `build23-games-2026-10-26.md`).

(3) LEVEL UP

- What opens the 20 raft: a full 10 island, and nothing else, for every learner who has the raft (add-to-10 current or mastered, playPlace.ts:24). It does not wait for add-to-20, and no step opens it without the island: one door. It stays open (no re-lock).
  - E: Thomas's pick, "the party opens a raft for 20".
  - R: my rail says anything a game judges comes from current or mastered steps (real-games :88). I relax it for the 20 raft, as I relaxed it for clusters in the hunt (Dave (4)), on one condition: every 20 shore holds a "ten and ten" load, two animals that make ten and two more that make ten. A learner on adding to ten can then always reach 20 with facts she has. The flag and the spoken total carry the rest (D1, play-place.md:825), and 9 + 9 + 2 and the like wait for whoever finds them.
- The reveal is the party's step 6. The 20 raft glides in and docks beside the 10 raft, its target showing, with a sparkle; no line and no glow loop. After that nothing announces it anywhere: no Hub, Play tile, Map or Session End line and no "new" (play-place.md:64).
- The 20 raft:
  - Target 20. The same nine animals, weights 1-9: no new animals, so the kinds stay nine.
  - Shore of 6. The shore band on a phone in landscape holds 3 rows of 64 in 216.4 (play-place.md:264); 8 animals would need 4 rows, 256 pt.
  - Draw: two bonds to ten, (a, 10 - a) and (b, 10 - b), plus 2 more weights in 1-9. Accept when the shore has at least 2 loads to 20 and at least one ten-and-ten load, plus the missing-kind guarantee.
  - Fallback: CANON_SHORE 7, 3, 6, 4, 8, 2 (playPlace.ts:76), which has 3 loads to 20 (computed: 7+3+6+4, 7+3+8+2, 6+4+8+2). When the missing kind is not in it, it is swapped in with its partner to ten.
    E (computed, 20,000 shores, my draw above):
  - loads to 20: median 3, 10th percentile 2, 90th 5;
  - of all loads, 75 % have 4 animals, 19 % have 3 and 6 % have 5; 43 % of shores also hold a 3-animal load.
  - With the guarantee, the 20 island fills in a median of 5 / 4 crossings, 90th 7 / 5, worst 11 / 7 (3,000 seeds).
- Deck: 8 seats, 4 x 2, at 0.7 a. Using play-place.md:257's formula, it is 221.2 x 119.6 on phones and 333.2 x 175.6 on tablets. It fits: 221.2 is under the 235.7 water on a phone in landscape (play-place.md:264), and the deck's height is unchanged. R: a bigger raft for a bigger number reads without words, and it seats a 5-animal load plus a newcomer.
- Its own island: the 20 raft lands on its own island with its own nine homes (drawn, a different shape or colour; Kyle), filled the same way, with the same party. R: the 10 island is full when the 20 opens, and the 20 island is the door to the next raft.
- Too heavy past 20: wobble and splash as today. Totals 1-19 are spoken.
- Stuck newcomer, widened: its weight is gap - s, where s is a sum the waiting animals can make and gap - s is 1-9, so 20 is reachable again. With a gap of 9 or less that is today's rule (s = 0, play-place.md:289). R.
- Target visible:
  - A fixed numeral of the raft's target, "10" or "20", painted on the raft itself, on both rafts. Kyle picks the place (the front log, or a pennant above the flag).
  - It always shows, never changes during a trip, and is the same mark in the picker.
  - The flag keeps the running total, blank at 0 (D1 CONFIRM, play-place.md:825).
  - R: one numeral that changes and one that never does; the target on the total's flag would make one sign mean two things.
  - The open line also names it: "The raft can carry twenty!".
- Larger numbers:
  - No 15. R: ten and twenty are the bonds the adding steps use; 15 is just another 2-3 animal sum.
  - Phase 2: a raft for 100. It carries the same nine animals tagged 10-90, which is the 10 raft's bonds times ten (30 + 70), on 6 seats. It opens on a full 20 island AND two-digit-addsub-no-regroup current or mastered (MATH_TREE, packages/core/src/progress/mastery.ts:140).
    R: here I keep the step rail. Tens to 100 is place value, and the path first adds tens and ones in that step (E: public/canon/math/level-1/two-digit-addsub.json, math.p1.read "Twenty plus three. How many?").
    Before that step a full 20 island simply stays full. When she reaches it, the 100 raft is in the picker with no arrival beat.
  - Beyond 100: nothing. Subtraction is not a raft; the path carries on.

(4) TRIP AND GOAL TOGETHER

- A trip is still one visit of up to 3 crossings (RAFT_CROSSINGS, playPlace.ts:56) from a fresh shore. It ends at the third crossing or at the party, whichever comes first.

  > **Superseded 2026-10-26 (an editor's note, not Dave's text):** Dave's build-23 ruling (C) (`build23-games-2026-10-26.md`) removes the cap: "ends at the third crossing or at the party, whichever comes first" becomes "ends at the party", and a trip also ends when she taps Back. See `design/native/raft-island-goal.md` § 6.

- The island carries over between trips (1). The shore, the crossing count and the stuck counter do not.
- Back mid-trip: the island keeps every kind that has landed.
- With one raft open the game starts on its shore, as today, and a trip end goes to the Play place (play-place.md:305).
- With two or more open, the game opens on a picker of the docked rafts, each with its target and its island's homes (filled or empty, no count). Tapping one starts its trip with its open line, and a trip end returns to the picker. Back from the picker goes to the Play place. R: a trip ends on the screen it started from.

(5) WHAT STAYS, AND THE SAFEGUARDS' INTENT

- Stays: the shore of 6 and drag or tap; the flag total and Emma's total line; the sinking deck; the wobble, the splash, "Too heavy!", the paddle home and the shake; the stuck newcomer (D4); "Ten! Off we go!" with Emma waving and the rowing oar; the four silly scenes and "Hee hee! Silly animals!"; numerals, not dots; no timers or clocks; no lives, score or lost animals; the Reduce Motion fades.
- Collection is now explicit, by Thomas's call, as for the hunt. For the raft only, the homes and the unlock supersede my "never a meter of what is missing" (real-games :87), the § 1.6 rows "no unlock" (play-place.md:168) and "none kept" (:177), and Decision 4 (:34). Everything else holds:
  - no currency, stardust, streak, score or prize;
  - no lures: no line, badge or glow on the Hub, Play tile, Map or Session End about an island, a missing kind or a new raft;
  - Emma never suggests the raft;
  - no timer and no ranking;
  - no failure, lost animal, re-lock or decay;
  - free choice of raft: she can always go back to 10.
- Not a grind: nine kinds per raft, a shore that can always bring a new kind, a natural stop at the party, and one party per island.
- Watch on device: "I must get the pig" distress, or the raft displacing lessons (lessons under about two-thirds of app time over a week, real-games :119). If either shows, remove the silhouettes, so the homes show only what she has, and keep the party (real-games :183).
- E: the splash sound never landed. public/assets/ and mobile/assets/audio/sfx/ hold only cheer, chime-soft, plink, poof and sparkle, and createSfx plays nothing until the files land (mobile/src/screens/play/playKit.ts:11-19). So the raft's funny failure and the cannonball scene are silent today. R: sourcing it (T5, play-place.md:815) is the cheapest excitement in this game and needs no design.

(6) SPEND

Phase 1 (the islands, the party, the 20 raft):

- Lily: 12 new lines, 124 input characters.
  - "The raft can carry twenty!" (26).
  - "Twenty! Off we go!" (18).
  - Totals 10-19: captions "Ten!" ... "Nineteen!", inputs "Ten," "Eleven," "Twelve," "Thirteen," "Fourteen," "Fifteen," "Sixteen," "Seventeen," "Eighteen," "Nineteen," (80), per the one-word rule (play-place.md:660).
  - E: "Thirteen." to "Nineteen." exist as lesson clips (canonAudioRegistry.ts:749, 191, 73, 646, 613, 62, 423: the two-digit lessons' hint2 answers). "Ten.", "Eleven." and "Twelve." do not.
  - R: I render all ten fresh, so "Nine! Ten! Eleven! ... Thirteen!" is one voice set; mixing in the lessons' answers risks a rejected ear test to save 62 characters.
  - The party, the picker and the trip end need 0 lines; the trip end loses one.
- Art: $0. The silhouettes are the shipped pictures tinted in the app. The 20 raft, its numeral and both islands are drawn in the app (play-place.md:708). No new animals and no party scene art: the party uses the shipped poses and scenes. The ui-raft tile is unchanged.
- Ear-test prediction: each total comes back under 1 s and falling, and "Ten," is the likeliest to come back clipped or rising. Untested: whether a total after every boarding tires on a 20 raft that takes 3-5 boardings, against 2-3 on the 10.

Phase 2 (the 100 raft, when a learner reaches two-digit-addsub-no-regroup; not designed now):

- 10 Lily lines, 104 characters: "The raft can carry a hundred!" (29), "A hundred! Off we go!" (21), and totals "Twenty," "Thirty," "Forty," "Fifty," "Sixty," "Seventy," "Eighty," "Ninety," (54). "Ten," comes from phase 1.
- Art: $0.

(7) KYLE MUST DESIGN NEXT

1. The nine homes on both islands, on all four forms: the order (bee to pig), silhouette and tag, the filled look, where a crossing's scene plays and the walk home. A phone in landscape packs only 8 at 0.5 a (playGeometry.ts:221-235), so 9 need about 0.45 a or a wider island band.
2. The fill beat and the repeat wiggle, with their Reduce Motion fades.
3. The party (lap, dance of nine, the two lines, the burst), its Reduce Motion version, and the next raft's docking.
4. The 20 raft: the 8-seat deck, how far it sinks toward 20, and the target numeral's place on both rafts (not on the total flag). The 20 island's drawn look.
5. The raft picker: the docked rafts with targets and island homes (no count), on all four forms. Side by side the two decks need 407.6 pt (170.4 + 221.2 + 16): that fits a phone in landscape's A (491 wide); on a phone in portrait (343 wide) stack them (255 pt in 376). Also: entering, a trip end into it, and Back.
6. The ordinary trip end without its line: bounce, wave, timing.
7. VoiceOver labels (labels only, never spoken): a home ("Pig, home" or "Pig home, empty"), each raft ("Raft for twenty"), the picker.
8. With Kevin: the AC changes, N5 (one key's writes), N8 and V5 (the close line only at the party), a C2-style test for the 20 shore and both guarantees, and N7a for the widened newcomer.
