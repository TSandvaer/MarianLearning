# Critters four-letter rounds: Dave's ruling (2026-10-26), parts (B) and (D)

The rest of the ruling Dave returned by Orca dispatch on 2026-10-26, verbatim: his preamble, (B) the four-letter rounds, (D) "Kyle next, and the spend" in full (items 1-5 for (A) as well as 6-12 for (B)), his bounded convergence and his sources. It was `tmp/specs/dave-build23-games-ruling.txt` in the main checkout, which git ignores. Its summary, (A) and (C) are already committed as `design/research/build23-games-2026-10-26.md`, so they are left out here. Nothing else is changed; prettier may add blank lines and list indentation, and escape an asterisk (`\*`).

**Thomas, build 23 (2026-10-26), as the coordinator relayed him:** "Critters dont advance to 4 letter words", and by popup "Start phase 2 spec now".

**Spec that builds from it:** `design/native/critters-four-letter.md` (quoted there as "Dave 23 (B)" and "Dave 23 (D) item n").

---

RULING. E = cited or computed evidence, R = my reasoning. "Computed" means a scratch script that was never saved to the repo: tsx over packages/core/src/games/critterHunt.ts and playPlace.ts at main fe366267 for phase 1, and a Python port of Dave (1)'s round rules for phase 2. Line numbers are at fe366267. "Dave (n)" is my ruling of 2026-10-25 (design/research/critters-word-hunt-2026-10-25.md); "Dave raft (n)" is design/research/raft-island-goal-2026-10-25.md.

(B) CRITTERS PHASE 2: FOUR-LETTER ROUNDS

Opening:

- Four-letter rounds open on her first complete three-letter round, at that round's beat. They stay open with no re-lock, and she can always go back to 3 (Dave (3), (4); Thomas's rule).
- The record gains the open lengths (Dave (7)); its value is by length, so "4" joins "3" (critters-word-hunt.md:547). Kevin picks the shape.
- Learners who finished rounds before this ships: no record of past completions exists. New letters replaces a complete round (critters-word-hunt.md:251), and HuntRecord holds only the current round. So "4" opens on their next complete three-letter round, with the roll-in. R: the reward lands on the round that earned it, and there is nothing to migrate. Thomas's test learner needs to finish one more round.

Which words: CCVC and CVCC words with one short vowel from her steps, where every letter sings its own sound. These are out:

- a_e and every word with two vowel letters. E: they cannot be built, because a round has one vowel and that vowel has no twin (critters-word-hunt.md:51, :137). The e critter also sings /ɛ/; it is never silent.
- Digraphs (sh, ch, th, wh), ck and ng. Two critters sing two sounds, so s-h sings /s/ /h/: the same reason owl is quiet (Dave (6)). A digraph needs a two-letter critter, which means a new mechanic and new sound renders. Not before digraphs-sh is current for her, and not designed now.
- Doubled letters (bell, hill, doll, miss). These are a spelling convention, not sounds (Dave (4)). They can be built, and they sit.
- Words with k, q, y or z: those are not critter letters (desk is out).

Tie to her steps:

- crab-words (CCVC) and tent-words (CVCC) are Word Song steps 16-17 (mastery.ts:195-196), after the digraphs, sight words and simple sentences. Marian is on short o.
- I keep Dave (4)'s relaxation for clusters: nothing judges a miss, since a four-letter non-board run sits with no boing. Only her taught vowels deal.
- E: children often leave out a cluster's second consonant when spelling (Bruck & Treiman 1990, Journal of Experimental Child Psychology, initial clusters). Many children treat a CVCC syllable as three sounds (Treiman, Zukowski & Richmond-Welty 1995, Cognition, final clusters).
- R: four seats and four boxes show that a fourth sound is there. "fog" for "frog" leaves a seat empty and never sings, and nothing calls it wrong.

The targets, exact: Dave (8)'s 108 minus hump (R: UK slang), then only the words a round actually deals (computed). 82 words, \* = pictured:

- a (18): flag* hand* lamp* clap* flap slap snap drag glad flat plan swam camp damp ramp* band land sand*
- o (15): frog* pond* stop* spot plot drop* crop flop plop prop trot blob cost soft from
- i (7): gift* drip* grip trip flip clip\* lift
- u (19): drum* plum* club plug* slug* spun stun jump* bump dump lump pump* dust must rust just hunt gulp bulb\*
- e (23): tent* nest* belt* bend lend went sent rent bent dent best rest test vest* west felt melt left step stem sled\* next text

Never dealt, so they get no clip: crab trap grab slot lost slip snip spin twin grin swim crib list mist fist mint hint limp film snug stub mend send help held.

A round:

- 7 critters: the vowel, then 6 consonants a-z.
- 4-6 targets, at least 2 of them with a picture.
- At most 1 consonant that is in no target. That decoy's twin pops as usual.
- Never her last round's letters.
- Never a letter set that spells a rude four-letter word: cunt shit piss twat slut crap turd damn hell butt slag prat bums tits cums fags gits guns.
- Complete at floor(0.95 × N), which is N − 1: 3 of 4, 4 of 5, 5 of 6.
- Why at most 6 (R plus arithmetic): a phone in portrait fits 3 four-box slots a row at S4 (3 × 102 + 2 × 6 = 318 ≤ 343, using the 102 width at critters-word-hunt.md:439), so 6 is 2 rows.

Counts (computed):

- Rounds per vowel: a 56, o 51, i 2, u 125, e 86. Marian (a, o): 107.
- Targets per round (N): a {4: 42, 5: 11, 6: 3}, o {4: 34, 5: 13, 6: 4}, i {4: 2}, u {4: 57, 5: 22, 6: 46}, e {4: 25, 5: 24, 6: 37}.
- Short i is thin (2 rounds). I accept that: the deal picks among her vowels, and i matters only past short i.
- Pinned fallbacks (computed rounds): a b c d l m p / o b c d n p r / i c f g l p t / u b c d g l p / e b c d l s t.

Why this changes Dave (4) (4-7 targets, at least 1 picture, every consonant used):

- With (A), the pictures carry the round, so at least 2 are pictured.
- A floor of 3 pictures leaves a 0, o 2 and i 0 rounds with Dave's 14 new pictures (computed).
- Requiring every consonant to be used leaves o 16 and i 2. Allowing one decoy triples o. R: a decoy suits a spelling task, where choosing the right letter is the skill.

Quiet words: I drop Dave (4)'s known-quiet list (gold, fish and the rest).

- With every slot showing its word, by picture or listen mark, the board names the goal. A four-letter run that is not on the board sings and sits, as every four-letter non-word already does (Dave (4)). It reads as "not one of these", not "that didn't count".
- Rarer words, doubled words and plurals (cats, dogs) sit too. R: an s is in most rounds, and with it a CVC word's plural is spellable in nearly every one, so rejecting plurals would mean no s in four-letter rounds. Voiced plurals such as dogs end in /z/, the has/his/was reason (playPlace.ts:299), so they would be quiet anyway.
- Only rude words shape the deal. Four-letter rounds have no extras and no bonus chip.
- Watch: if she builds a word she knows (cats, fish) and waits for Emma, or says "it didn't work", revisit this.

The run (Dave (4), unchanged):

- 4 seats on the log, about 336 pt on a phone in portrait with 3.5 pt a side, and the disc shows "4".
- A run sings only when all 4 seats are full. A partial run sings on a log tap and is never judged.
- A target: the critters sing, Emma says its whole-word clip ("Flag."), then the joy beat.
- A lesson word's first build in a visit also gets its praise clip (flag hand lamp tent nest belt gift frog pond drum plum, 11; "Yes! That's a flag.", canonAudioRegistry.ts:1395 per Dave (4)).
- No four-letter blend clip exists. E: crab-words and tent-words canon have 0 .blend lines (checked). So the hint is the four critter sounds in order, then the word, as in (A).5.

The length picker (Dave (5)):

- With two lengths open, the game opens on two logs: 3 seats with "3" and 4 seats with "4". No text, no count, no board preview, and it never speaks.
- A log tap opens that length's round, in progress or fresh.
- Back from a round goes to the picker, and Back from the picker to the Play place (R: the raft picker's rule, raft-island-goal.md:208).
- The four-seat log rolls in once, after the first complete three-letter round's beat and before New letters (critters-word-hunt.md:229), with the shipped sparkle and no line.

New audio (each is a Lily render; caption "<W>.", input "<W>,", Dave (8)'s format): 92 lines, 504 input characters.

- The 82 four-letter targets above (410 characters).
- 9 three-letter words, as Dave (6) and (8) planned: Act Add Ant Elf End Ill Its Odd Off (36 characters). They leave CRITTER_NOT_SAID. ant and elf get pictures; the other 7 join HUNT_FAMILIAR as targets. This widens the three-letter deals (Dave (1) counted 439 rounds with them; I did not recompute).
- 1 open line for four-letter rounds: "Drag four letters up to the log. Can you make these words?" (58 characters). R: the three-letter line's "If they make a word, I'll say it!" (guidanceLines.ts:314) is not true here, because a word that is not on the board sits.
- Ear-test prediction (Dave (8)): "From," may come back as the weak /frəm/, and "Sent," and "Went," may run into a following silence.

New pictures: 16, about $1.25 at $0.078 each (batch 18's rate, Dave (6)).

- The 14 four-letter ones: sand ramp clap vest sled clip drip stop drop jump pump plug slug bulb. With the 11 pack words, 25 of the 82 targets are pictured.
- Plus ant and elf.
- The rule (R, with Cycowicz 1997): a thing a 6-9 learner names with that word, never a picture likelier to be named as another app word. So: no crib (UK cot, a pack word), no camp (reads as tent), no fist (reads as hand), no spin (reads as top).
- Against Dave (6)'s 14: trap, crib and swim are out (never dealt, or misleading); ramp, clap and drip are in.
- Prompt notes (the manifest's avoid and distinctFrom fields, picture-manifest.json:2746-2758): clap must not read as hand; drip must not read as tap or drop; slug must not read as snail.

(D) KYLE NEXT, AND THE SPEND

For (A), phase 1, now (Kyle, then Devon; Kevin for the core order):

1. The pictured empty slot: a full-colour picture over empty boxes, and a filled slot that reads differently by its tiles.
   - Check that every pack picture reads at the phone S4 picture box's 32 pt. critters-word-hunt.md:492 lists this as untested, and the picture is now the cue. If any fails, phones need a bigger box, and § 2.4 must be measured again.
2. The listen mark for an unpictured target, and an empty slot that looks tappable with no line.
3. The board order; the fill flying into its own slot rather than the next empty one; the lap in board order; the Reduce Motion fade for that fill.
4. The hint: glow unchanged, ghost removed, and a tap plays the sounds, then the word.
5. VoiceOver: today an empty slot is "Empty word" with no role (critters-word-hunt.md:393; playLines.ts:113). It becomes a button that plays its word. The label must not spell the word.

For (B), phase 2:

6. The board of 4-6 four-box slots on all four forms (3 a row on a phone in portrait, 318 ≤ 343), and the 7-critter meadow (Q8, critters-word-hunt.md:439, :519).
7. The four-seat log with the "4" disc (about 336 pt on a phone in portrait, Dave (4)).
8. The roll-in of the four-seat log after the first complete three-letter round's beat.
9. The length picker: two logs, no text, no count, no preview, silent; Back from a round goes to the picker, Back from the picker to the Play place.
10. A four-letter round: no bonus chip, a partial run on the four-seat log, and the hint's four sounds.
11. Reduce Motion and VoiceOver for the picker and the roll-in ("Log, four letters").
12. For Kevin, in core:

- the length-4 round rules above, the rude list, and the open lengths in the record;
- the 9 three-letter words leave CRITTER_NOT_SAID (ant and elf pictured, 7 onto HUNT_FAMILIAR);
- hump is off the list.

Spend, as counts:

- (A): 0 Lily lines, 0 pictures, $0.
- (B): 92 Lily lines (504 input characters) in one render under its own spend popup, judged at the voice-QA ear test; 16 pictures, about $1.25, under their own popup and contact sheet.
- (C): $0.
- Optional, only if device play shows the listen slots stall: 5 pictures (hog pup fin tin vet), about $0.39.

Bounded convergence:

- Tested: the phase-1 numbers, through the real core code (the round counts reproduce critterHunt.ts:186, a 45 / e 21 / i 30 / o 27 / u 61); the phase-2 counts, by a Python port of Dave (1)'s rules.
- Not tested: the phase-2 port against Kevin's future code; any timing; picture recognisability at 32 pt; whether a decoy confuses a 6-9 learner; whether a known word that sits reads as "not on the board" to her; the open line's ear test.

Sources (citations checked by web search, 2026-10-26; abstracts and summaries only):

- Cycowicz et al. 1997: https://acnpsearch.tweb-dev.unibo.it/singlejournalindex/6601505
- Heung, Hiniker, Hong & Kientz 2018: https://ischool.uw.edu/news/2018/05/apps-children-should-emphasize-parent-and-child-choice-researchers-say
- Joseph 2000: https://scholarworks.wmich.edu/reading_horizons/vol41/iss2/4
- Bruck & Treiman 1990: https://profiles.wustl.edu/en/publications/phonological-awareness-and-spelling-in-normal-children-and-dyslex/
- Treiman, Zukowski & Richmond-Welty 1995: https://profiles.wustl.edu/en/publications/what-happened-to-the-n-of-sink-childrens-spellings-of-final-conso/
