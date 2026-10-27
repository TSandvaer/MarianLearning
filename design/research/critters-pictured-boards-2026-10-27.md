# Critters pictured-only boards: Dave's ruling (2026-10-27), parts (A)-(D), and (E) of his digraph ruling

The ruling Dave returned by Orca dispatch on 2026-10-27 on Thomas's build-25 asks (pictured-only boards; 5- and 6-letter rounds), verbatim and whole: his summary, his preamble, (A) pictured-only boards, (B) no 5- or 6-letter rounds, (C) the spend, (D) "What Kyle must design next", his bounded convergence and his sources. It was `tmp/specs/dave-five-six-ruling.txt` in the main checkout, which git ignores. **Appended:** part (E) of his digraph ruling of the same evening (`tmp/specs/dave-digraph-ruling.txt`, also ignored), verbatim, because fog and dig join the pictured three-letter words by it; the rest of that ruling (the digraph critter, phase 3) is not committed here. Nothing else is changed; prettier may add blank lines and list indentation, and escape an asterisk (`\*`).

**Thomas, build 25 (2026-10-27), as the coordinator relayed him:** boards of pictured words only ("only letter combinations that make words that have images", as Dave quotes him in (A)), and longer words. He approved pictured-only boards and their content (15 Lily clips and 23 pictures, Devon's PR #714). (E) answers his later question about pictures for the words that have none.

**Specs that build from it:** `design/native/critters-word-hunt.md` § 16 and `design/native/critters-four-letter.md` § 15 (quoted there as "Dave 27 (A)" to "Dave 27 (E)").

---

SUMMARY. (A) Yes: every slot gets a picture in 3- and 4-letter rounds, by moving known words with no picture off the board into the extras rather than by Thomas's literal filter (that filter leaves 3-letter a 21 o 1 u 5 i 0 e 0 and 4-letter 0 for every vowel); with 8 new three-letter pictures, 14 voiceless plurals, crab and step it deals 3-letter a 182 o 76 u 127 i 6 e 82 and 4-letter a 110 o 29 u 38 i 0 e 19, for 15 Lily lines (75 characters) and 23 pictures (about $1.84). (B) No 5- or 6-letter rounds: one-vowel words whose every letter sings its own sound and that a child can name from a picture barely exist (6 letters: 8 words a child might know, none picturable; pictured 5-letter rounds: e 21, every other vowel 0), and 6 seats do not fit a phone; the way to longer words is digraph critters (sh ch th ng), a later phase gated on the digraph steps. Left for Kyle: the N-4 three-letter board, a place for the chip in four-letter rounds, the 36 pt check for the plural pictures, and no picker change beyond his polish.

RULING. E = cited or computed evidence, R = my reasoning. "Computed" means scratch scripts that were never saved to the repo: tsx over packages/core/src/games/critterHunt.ts and playPlace.ts at 4ccd7570 (the port reproduces the shipped huntRounds exactly: 3 letters a 203 o 83 u 61 i 53 e 39, 4 letters a 56 o 51 u 125 i 2 e 86), and Python over /usr/share/dict/words (Webster's 2nd) for 5 and 6 letters. "Dave (n)" = design/research/critters-word-hunt-2026-10-25.md; "Dave 23" = design/research/build23-games-2026-10-26.md and critters-four-letter-2026-10-26.md.

(A) PICTURED-ONLY BOARDS: YES, FOR 3 AND 4 LETTERS

What it does to the task:

- E: a pictured slot is the word-box (Elkonin) task: name the picture, say it slowly, find each sound's letter (Dave 23 (A), build23-games:44-46; Joseph 2000, summaries only). A listen slot is dictation of a heard word (build23-games:35).
- E: CLAUDE.md:44: "pair every word with picture for vocab".
- R: most unpictured targets are words a picture cannot carry, and an L2 learner may not know them as vocabulary: got let met set him did, and for four letters swam spun went sent felt left lend rent gulp stun. Dictating a word she does not know is spelling a sound string. Thomas does not like the listen boxes, and my build-23 prediction was that she would leave them for last (build23-games:70).
- Lost: those words as slots. They stay findable as extras, so discovery stays.

Thomas's literal rule ("only letter combinations that make words that have images"), counted with today's pictures and today's other rules (E, computed):

- 3 letters: a 21, o 1, u 5, i 0, e 0 (of 439).
- 4 letters: 0 for every vowel.
- So I do not rule it. I rule the board: every slot pictured.

The rule (for Kevin):

- 3 letters: targets are only the words with a bundled picture (critterHasPicture, playPlace.ts:547-550). A HUNT_FAMILIAR word with no picture becomes an extra: Emma says it, the joy beat plays, and it joins the chip, as an extra does today. N 4-8 (was 5-8). At most 3 extras (unchanged). At most 1 decoy consonant (was 0; R: with every slot pictured this is a spelling task, Dave 23 (B)'s reason for four letters). The quiet-word reject, NEVER_SAY and the probe guard are unchanged. Complete at N - 1 (3 of 4).
- 4 letters: targets are only the pictured words, N 4-6, at most 1 decoy. A clip word with no picture becomes an extra, at most 3, as in three-letter rounds. R: Dave 23 (B) let known words sit only because every slot showed its word; a word she heard on yesterday's board sitting silent now would read as "that didn't count" (Dave (1)). Rejects: HUNT_RUDE_FOUR plus clit (below), HUNT_FOUR_UNDEALT minus crab.
- No-picture slots no longer deal. The listen mark stays only as the missing-asset fallback (critters-word-hunt.md:623).
- The deal skips any of her vowels with 0 rounds at that length (four-letter i, below). Only if every one of her vowels has 0 does the fallback deal.

Rude filter (E, computed): the shipped short-i four-letter round i c f g l p t, which is also HUNT_FOUR_FALLBACK.i (critterHunt.ts:325), spells "clit". Add clit to HUNT_RUDE_FOUR. I also checked dong (4 short-o rounds), snot (3) and tosh (1), and leave them: nothing is said, and ding-dong is a bell.

Counts with today's pictures under this rule (E, computed):

- 3 letters: a 182, o 65, u 80, i 3, e 8.
- 4 letters: a 0, o 0, u 38, i 0, e 0. The 82 targets were picked as words that sing, not as nouns.

What the pools need, and the counts with it (E, computed):

- 3 letters: 8 new pictures for said words that already have clips: six ten red peg rod run dot tug. The rounds become a 182, o 76, u 127, i 6, e 82 (N splits: a {4: 96, 5: 49, 6: 27, 7: 9, 8: 1}, o {4: 47, 5: 8, 6: 20, 7: 1}, u {4: 53, 5: 60, 6: 11, 7: 2, 8: 1}, i {4: 6}, e {4: 70, 5: 10, 6: 2}). With the probe guard (a learner whose current step is cvc-words): a 33.
- Three-letter targets that are ever dealt:
  - a (22): ant bag bat cab can cap cat dad fan ham hat jam man map mat nap pad pan sad tag tap van
  - o (13): box cot dog dot fox hot log mom mop pop pot rod top
  - u (15): bug bun bus cup gum jug mud mug mum nut rug run sun tub tug
  - i (6): bib fig pig sip six wig
  - e (12): bed egg elf hen jet leg net peg pen red ten web
- 4 letters: 14 voiceless plurals of pack words (ants bats caps cats hats maps mats rats taps cots mops pots tops jets: new clips and pictures), crab (picture bundled, new clip), and a picture for step (its clip exists). The rounds become a 110, o 29, u 38, i 0, e 19 (N splits: a {4: 81, 5: 26, 6: 3}, o {4: 15, 5: 14}, u {4: 36, 5: 2}, e {4: 18, 5: 1}). Marian's a and o give 139.
- Four-letter targets that are ever dealt:
  - a (14): ants bats caps cats clap crab hand hats lamp maps mats rats sand taps
  - o (7): cots drop mops pond pots stop tops
  - u (7): bulb drum jump plug plum pump slug
  - e (5): jets nest step tent vest
  - i: none.
- Why plurals: E: Treiman & Cassar 1996 (J Exp Child Psychology 63, 141-170; abstract only): children spell final clusters differently when the two consonants span two morphemes ("tuned") than inside one ("brand"), from first-grade reading level; a 2008 study disputes it. R: cat + s is a gentler first final cluster than brand, its meaning is already known, the picture shows "more than one", and the fourth box shows that a fourth sound is there. Only voiceless plurals: dogs ends in /z/, so it still sits (Dave 23 (B), the has/his/was reason, playPlace.ts:328-331).
- Leave-one-out (computed): cups and nets add 0-1 rounds, so I left them out, and huts and nuts are never dealt. Pictured words never dealt under this rule: the lesson words flag frog gift belt, and ramp sled clip drip (R, not traced: the extras cap or the rejects). The cap of 3 binds hardest on e: with the 18-plural set, a cap of 6 gave e 41 against 19.
- Short i stays thin: 6 three-letter rounds, 0 four-letter. R: no other i word passes my naming rule (fin reads as shark or fish, tin as can, lip as lips, win as cup). The deal picks among her vowels, so she still gets rounds.
- I withdraw Dave 23's optional five (hog pup fin tin vet). By my own rule they read as pig, dog, shark or fish, can and doctor.
- Fallbacks (first round per vowel in my port; Kevin pins them): 3 letters a b f g h t (passes the probe guard), o b f m p x, u b c g j m, i b f g p w, e b d f g l; 4 letters a b c d n s t, o b c m p s t, u b c j l m p, e c j n p s t; i none. The critters-hunt debug seed (a b g h p t, seeds.ts:753) no longer deals (4 extras: gag gap pat tab), so the seed and seeds.hunt.test.ts must change.

(B) 5- AND 6-LETTER ROUNDS: NO, NOT IN THIS FORM

Pattern by pattern:

- CCVCC and CCCVC (one vowel, every letter its own sound). E, computed: the child-known pool is a: stamp stand strap scrap grand clamp cramp splat brand bland; o: frost stomp blond; i: crisp drift print split strip swift twist blimp; u: blunt clump crust grunt plump scrub slump stump stunt trust strum; e: blend crept slept spend spent swept. Out by Dave (4)'s BATH rule (R: I extended it from fast/last/past/raft without hearing Lily): plant grant slant blast craft draft graft grasp clasp. Out as rude: tramp, trump. Under the four-letter rules with 8 critters, listen slots allowed, the rounds are a 0, o 0, i 8, u 69, e 2. The picturable 5-letter pool is stamp plus the voiceless plurals of pictured four-letter words (lamps ramps drops clips gifts pumps belts nests tents vests steps): pictured-only rounds e 21 (all one family, belts nests tents vests steps), every other vowel 0. E: Bruck & Treiman 1990: children leave out a cluster's second consonant. Treiman 1991 (J Educ Psychology) is on initial clusters; I have only its citation, not its findings.
- CVCCC: none that a child knows, other than plurals and silent letters (tempt).
- Six letters (one vowel): E, computed: the whole dictionary gives 8 a child might know, strand prompt scrimp script splint sprint strict sculpt. None is picturable, so no round can hold 4.
- Two-syllable CVC+CVC (sunset, laptop, cobweb, hubcap): E: a round has one vowel and no vowel twin (critterHunt.ts:180-190), so they cannot be built. R: most two-syllable words reduce a vowel to schwa (button, lemon, wagon, magnet), so the critters would not sing them. The few that do and can be pictured (sunset, laptop, robin) cannot fill a board.
- -ing: two vowels in most words, and ng is a digraph.
- Digraphs: the only pattern that gives longer words with pictures. See the route below.

Seats (E, arithmetic, Dave (4)'s band 1.25c a seat + gaps + 32, critters-word-hunt-2026-10-25.md:61): 5 seats fit a phone in portrait (343) only at c <= 44.6 (today 56). 6 seats need c <= 36.1, under the 44 pt touch size (Kyle to confirm the minimum). A 5-box S4 slot is 124 wide (2 a row on a phone in portrait); a 6-box slot is 148.

Ruling: no 5- or 6-letter rounds, no 5- or 6-seat log, and no third log in the picker. R: the content is not there, and what is there can only be listen slots, which (A) removes.

The route to longer words (phase 3, not designed now; it needs its own ruling and counts when Thomas says yes):

- A digraph critter: one critter, two letters, one sound: sh, ch, th (voiceless), ng. A seat holds a sound, so a digraph fills one seat and one box. E: Elkonin practice puts a digraph in one box (Reading Rockets, Reading Universe; practice guidance, not trials).
- Not ck: c already sings /k/, so c-l-o-c and clock would sing the same. That is a spelling rule, like doubled letters (Dave (4)).
- Gate: each digraph from its own Word Song step, current or mastered, as the vowels are (Dave (1)): sh, ch and th from digraphs-sh, -ch and -th-voiceless (mastery.ts:189-191), ng from duck-words (mastery.ts:194; its pictures wing king ring are in the manifest's duck-words tier). E: Letters and Sounds teaches these four digraphs in Phase 3, before the adjacent consonants of Phase 4, which adds no new graphemes (school and vendor summaries, not the DfES text). Word Song keeps the same order. R: a digraph is a new letter-sound pair, so it waits for the path, as a vowel does. Clusters did not need to wait (Dave (4)).
- What it gives, picturable (\* = bundled today):
  - 3 sounds, 4-5 letters: fish dish chin chip ship* king* ring* wing* moth shed shop. Most are short i, which helps the thin vowel.
  - 4 sounds, 5 letters: swing\* sloth brush chest bench shelf.
  - 5 sounds, 6 letters, would need 5 seats: splash shrimp string spring.
- So "5-letter words" become real on the 4-seat log. "6-letter words" stay out on phones.
- Marian (on short o) gets none of this until digraphs-sh is current.

(C) SPEND, AS COUNTS (each under its own popup later; nothing is spent now)

New Lily lines: 15, 75 input characters. Caption "<W>.", input "<W>,", Dave (8)'s format:

- ants bats caps cats hats maps mats rats taps cots mops pots tops jets (14 × 5 = 70 characters)
- crab (5 characters)
- No new open line: "Can you make these words?" and "If they make a word, I'll say it!" both stay true.
- Ear-test prediction: the final /s/ of a plural may come out faint before the comma's pause, so listen for "Cat," against "Cats," on cats, hats, rats and bats.

New pictures: 23, about $1.84 at the brief's $0.08:

- 3 letters (8): six ten red peg rod run dot tug.
- 4 letters (15): the 14 plurals and step. Crab is bundled (mobile/assets/pictures/crab.webp).

Subject and avoid notes (my naming rule: a thing a 6-9 learner names with that word, never a picture likelier to be named as another app word):

- six: six round dots in two rows of three, one colour. No die (reads as dice), no numeral (a digit in a round breaks F11, critters-four-letter.md:537), no fingers (reads as hand).
- ten: ten dots in two rows of five, in six's style. No numeral, no fingers.
- red: a plain red paint splash. Not a heart, apple or ball, and not a shape that reads as blob.
- peg (hard): one wooden clothes peg, side view, spring visible. Not a pin or a clip (both pack words). "Clothespin" in US English; the tap settles it (build23-games:34).
- rod: a fishing rod with its reel and line. No fish, no person, not a plain stick.
- run: one child running, side view, mid-stride, one foot down. Not in the air (jump.webp is a child in mid-air, critters-four-letter.md:508), not hopping.
- dot: one big flat dot. Not red (reads as red), not yellow (reads as sun), not shaded like a ball.
- tug (hard): two children leaning back on a rope, a tug of war. May be named "pull"; the tap settles it.
- step: one wide stone step, side view. Not a staircase (reads as stairs), not a box.
- Plurals: exactly three of the singular's own pack object, in the singular's manifest subject and colours, identical and spaced apart. They must read as three at the phone's 36 pt box. Not a pile or a set. Hard: taps (must not read as a sink), mats (not a stack of towels), cots (not a nursery).

(B): $0 now. Digraph phase: not sized.
Withdrawn: Dave 23's optional five (hog pup fin tin vet).

(D) WHAT KYLE MUST DESIGN NEXT

1. The three-letter board at N 4 on all four forms: 2 + 2 in portrait, and 3 + (1 + chip) in landscape (critters-word-hunt.md:109-111). Confirm it passes the fit rule (:103). R: fewer slots than the measured N 5-8, so it should fit, but I did not measure it.
2. A place for the chip in four-letter rounds (at most 3 extras of four small tiles; S4 bx 16). E: on a phone in portrait the 4 + 3 meadow leaves 39.5 pt a side ((343 - 248) / 2 - 8), where three-letter rounds have 71.5 (critters-word-hunt.md:113). The scene has 10 pt spare (critters-four-letter.md:149). Landscape has the board's next cell only at N 5. If it cannot fit on every form, four-letter extras get Emma's word and the joy beat with no chip (R: the chip is a record; the reward is the joy beat).
3. The 36 pt check for the 15 new four-letter pictures and the 8 three-letter ones on the contact sheet, phones at S4 and S5 (both T 36). It matters most for the plurals: does "three" read?
4. The picker: nothing beyond his polish. Still two logs; no third length is coming.
5. Not now: the digraph critter (two letters on one body, one sound), its tile filling one box, and a meadow with one. Design it only when phase 3 is asked for.

For Kevin (core): the (A) rules above; clit onto HUNT_RUDE_FOUR; crab off HUNT_FOUR_UNDEALT; the 14 plurals and crab onto HUNT_FOUR_TARGETS; step and the plurals onto HUNT_FOUR_PICTURE_WORDS once bundled; the 8 three-letter words onto CRITTER_SAID_PICTURE_WORDS once bundled; the deal skipping a vowel with 0 rounds; new fallbacks; the debug seed. Until the 23 pictures are bundled, four-letter rounds deal u only, so the pictures land before the rule ships, or with it.

BOUNDED CONVERGENCE

- Tested: every count above, through the shipped core's word lists and a port of its deal (validated against huntRounds for both lengths); the 5- and 6-letter pools over Webster's 2nd; the clit/dong/snot/tosh check against the shipped rounds; the seed's new extras.
- Not tested: the probe guard on four letters (it does nothing there), or on three letters beyond short a; Lily's BATH vowel on each word (from Dave (4), not re-heard); whether three objects read at 36 pt; whether a familiar word moved to the chip reads as "didn't count"; whether boards of 4 make three-letter rounds too easy (Marian already finds the path easy). Watch item: if rounds go too fast, raise the decoys to 2 before removing pictures. Also not tested: the digraph phase's round counts; the N-4 fit; my port against Kevin's future code.

SOURCES (citations checked by web search, 2026-10-27; abstracts and summaries only)

- Treiman & Cassar 1996: https://profiles.wustl.edu/en/publications/effects-of-morphology-on-childrens-spelling-of-final-consonant-cl/
- Bruck & Treiman 1990: https://profiles.wustl.edu/en/publications/phonological-awareness-and-spelling-in-normal-children-and-dyslex/
- Treiman 1991 (citation only): https://independent.academia.edu/RTreiman
- Letters and Sounds Phase 4 (secondary sources): https://www.spellzone.com/curriculum/letters-and-sounds/phase-4.cfm
- Elkonin boxes (practice guidance): https://www.readingrockets.org/classroom/classroom-strategies/elkonin-boxes ; https://files.readinguniverse.org/PDFs/elkonin-boxes-consonant-digraphs-th-reading-universe.pdf
- Joseph 2000 and Cycowicz et al. 1997: as cited in design/research/critters-four-letter-2026-10-26.md:142-148

---

(E) PICTURES FOR THE UNPICTURED WORDS (Thomas's question)

The words:

- E: 64 HUNT_FAMILIAR words have no picture, even with (A)'s 8. 59 of them are slots today; lap hit mix not hum never deal.
- E: 56 HUNT_FOUR_TARGETS words have no picture, even with (A)'s spend.
- (A) already ends the mix Thomas saw: pictured-only slots move every one of these to the extras.
- (E) asks which can join the board with a picture.
- The 77 other said three-letter words are extras and never slots, so they need no picture.

The test is my naming rule, with action and adjective scenes allowed.

- E: the pack already has action and adjective scenes: hug, jump, sad, hot (picture-manifest.json), and (A)'s run is being made.
- R: an action is named in its -ing form ("digging"), and the tap supplies the word.

Can carry a picture:

- fog (hard): one bare tree and a fence fading into soft grey mist, no sun. Avoid white clouds in a blue sky (cloud), smoke from a chimney or fire (smoke), rain, a lamp post (lamp).
- dig: a child kneeling, digging a hole in dark-brown soil with a small metal garden trowel, a heap of earth beside it. Avoid golden sand or a red toy spade (sand.webp is exactly that), a dog digging (dog), a bucket.
- sit: a child sitting cross-legged on the floor, hands on knees, awake. Avoid a stool (stool.webp), a chair, a bed (bed), closed eyes (nap).

Counts with them (E, computed; (A)'s spend in):

- fog adds o 76 -> 92 (a slot in 18 rounds).
- dig adds i 6 -> 8 (2 rounds).
- sit adds 0: it is never a slot, so buy fog and dig only.
- Three letters become a 182, o 92, u 127, i 8, e 82.
- Four letters: no picturable word, so a 110, o 29, u 38, i 0, e 19 is unchanged.
- E (leverage): the words that would move short i (did +46, big +30, ill +29, dip +16) fail the naming rule. Short i's real gain is the digraph rounds (+57).

Cannot carry a picture (with the reason):

- Three letters:
  - a: act add and bad had ran sat (abstract or past). fat (named for the animal, and a body word). mad (named "angry"). lap pat wag (named for the cat or dog). wax (candle).
  - o: got job lot not odd off nod (abstract or no still picture). hog (pig). hop (jump.webp). jog (run).
  - u: but dug fun hum rub (abstract or no still picture). cut (scissors). pup (dog).
  - i: bit did hid him its fit (abstract). big (named for the object). dip lit fix mix rip tip (named for the object: strawberry, candle, toy, spoon, paper, pencil). fin (shark or fish). tin (can). win (cup, medal). hit (bat). hip (hand). lip (lips). ill (sick, bed). pit (seed).
  - e: end fed get let met set (abstract or past). men (man). pet (cat or dog). vet (doctor). wet (rain).
- Four letters:
  - a: band (music). camp (tent). flat (tyre, or a UK home). flap drag slap snap (named for the bird, bag, hand or crocodile; slap is a hit). damp glad land plan swam.
  - o: spot (dot). plop (drop). trot (horse). blob (slime). soft (pillow, kitten). cost crop flop from plot prop.
  - u: club (stick, bat). dump (bin). rust (nail). dust (cloth). bump (head). gulp (drink). hunt just lump must spun stun.
  - i: lift (most L2 learners say "elevator"; lifting a box is named "box"). flip grip trip (no still picture named so).
  - e: stem (flower). melt (ice cream). dent (can). bent (spoon). text (phone). test (paper). rest (sleep). left (arrow). bend best felt lend next rent sent went west.

Spend for (E): 2 pictures (fog, dig), about $0.16. 0 Lily clips: both are said words with clips (CRITTER_SAID_WORDS).

Devon's (A) work: no change.

- E: with fog and dig in, each of the 8 three-letter pictures still adds rounds: six i +3, ten e +33, red e +10, peg e +36, rod o +7, run u +16, dot o +5, tug u +35.
- The 14 plurals, step and crab are untouched by (E).
- dig must not reuse sand.webp's red toy spade.
