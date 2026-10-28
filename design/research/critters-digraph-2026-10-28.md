# Critters digraph critters: Dave's ruling, parts (A)-(D) (dated 2026-10-27, committed 2026-10-28)

The ruling Dave returned by Orca dispatch on the evening of 2026-10-27 on the digraph critters (Thomas: longer critter words), verbatim: his summary, his preamble, (A) the digraph critter, (B) gating and placement, (C) word lists, (D) spend and "What Kyle must design", his bounded convergence and his sources. It was `tmp/specs/dave-digraph-ruling.txt` in the main checkout, which git ignores. **Left out:** his part (E) (pictures for the unpictured words, Thomas's question), which is already committed verbatim in `design/research/critters-pictured-boards-2026-10-27.md`. The summary and preamble still name it, as he wrote them. Nothing else is changed; prettier may add blank lines and list indentation, pad table columns, and escape an asterisk or an underscore (`\*`, `\_`).

**Thomas, as the coordinator relayed him:** longer critter words, and the digraph phase approved ("yes spend and start", "yes spend digraphs"). The content (D) counts is merged (#719, 95c2589d: 17 Lily clips and 9 pictures).

**Spec that builds from it:** `design/native/critters-digraph.md` (quoted there as "Dave D (A)" to "Dave D (D)").

---

SUMMARY. (A)-(D): a digraph critter is one honey critter with two letters and a sound bar on its belly. It sings one sound and fills one seat and one box. It opens with its own Word Song step (sh, ch, th from digraphs-sh/-ch/-th-voiceless, ng from duck-words), and at most one is on a board. It deals 122 three-seat rounds (sh o 28 i 23 e 15, ch i 10, th o 22, ng i 24), which carry 4-letter words, but only 22 four-seat rounds (ch e, all with chest), because few 5-letter digraph words can be pictured. The spend is 9 pictures (about $0.72) and 17 Lily lines (13 words, 66 characters; 4 sound-source blends, 99 input characters). (E): of the 120 unpictured three- and four-letter target words, only fog and dig can carry a picture that a 6-9 learner names with that word and that adds rounds (three-letter o 76 -> 92, i 6 -> 8). sit can also be pictured but adds 0 rounds. No four-letter word can. So (E) costs 2 pictures and 0 clips, and Devon's 23 pictures and 15 clips stay as they are.

RULING. E = cited or computed evidence, R = my reasoning. "Computed" = scratch scripts never saved to the repo: tsx over packages/core/src/games/critterHunt.ts and playPlace.ts at 4ccd7570. The port reproduces the shipped huntRounds exactly (3 letters a 203 o 83 u 61 i 53 e 39; 4 letters a 56 o 51 u 125 i 2 e 86). It also reproduces my 2026-10-27 (A) counts exactly: 3 letters a 182 o 65 u 80 i 3 e 8 with today's pictures and a 182 o 76 u 127 i 6 e 82 with the 8 new; 4 letters a 0 o 0 u 38 i 0 e 0 today and a 110 o 29 u 38 i 0 e 19 with the spend. Digraph counts below assume (A)'s 23 pictures and 15 clips have landed and (E)'s fog and dig are pictured. Without (E): 108 three-seat rounds. Without (A)'s spend: 76 + 8. "Five-six" = my ruling of 2026-10-27 (tmp/specs/dave-five-six-ruling.txt).

(A) THE DIGRAPH CRITTER

Look (for Kyle):

- One critter: one body of size c, one pair of eyes, one pair of feet, one burrow, one seat.
- Consonant honey with the consonant ledge (play-place.md:455). It is a consonant sound.
- Its two letters sit side by side, lower case, on its belly.
- Under the pair runs a short bar in the letter colour.
  - E: the UK "sound buttons" convention marks a single-letter grapheme with a dot and a digraph with one line or bar (school and vendor guides, not trials; sources below).
  - E: beginning readers asked to tap the sounds of a word may tap once per letter and so overshoot on digraph words (Applied Psycholinguistics, "Effects of digraphs and pseudowords on phonemic segmentation in young children"; abstract snippet only, authors and year not verified).
  - R: one body, one seat and one box against two letters is the lesson. The bar says "one sound" without a word.
- How it differs from s + h in the meadow:
  - s and h are two bodies that sing /s/ then /h/.
  - sh is one body that sings /ʃ/.
  - It is never drawn as two critters touching.

Its sound:

- E: no existing clip can be reused. No canon text in public/canon holds an isolated sh, ch, th or ng.
  - The only near miss is the th hint sentence ("Th is a special new sound...", digraphs-th-voiceless.json word.p1.hint), a sentence that cannot be cut.
  - The lesson clips are whole words ("Read the ship.").
- E: a critter's sound is a window cut from a measured blend clip (CRITTER_SOUND_SOURCE, playPlace.ts:642; letterSound in LetterCritters.tsx).
  - A blend clip must have 4 segments (blendMarks.ts:36): three sounds and the word.
  - A three-sound digraph word fits that exactly.
- Rule: four new Lily blend clips, used as sound sources only.
  - "sh - i - p ... ship": sh, index 0.
  - "ch - i - p ... chip": ch, index 0.
  - "th - i - n ... thin": th, index 0. R: an onset /θ/ before a vowel is clearer than a final one.
  - "r - i - ng ... ring": ng, index 2. ng starts no English word, the g/x rule of CRITTER_SOUND_SOURCE.
- Render code: BLEND_GRAPHEME_IPA (api/\_tts_elevenlabs.ts:81-110) has no sh, ch, th or ng.
  - E: parseBlendText (api/\_tts.ts:1284) already splits "sh - i - p" into sh, i, p.
  - E: renderElevenLabsBlend returns null (plain text) for a grapheme with no IPA.
  - Add sh ʃː, ch tʃ, th θː, as LETTER_SOUND_IPA already maps shhh, chuh, ththth (:74-76). E: no baked clip uses those three, so none has been ear-tested on Lily.
  - Add ng ŋ: new, with no entry anywhere. The ear test decides held or not.
  - Then export the marks as for any blend.
- Ear-test prediction (written before any render):
  - /θ/ may come back as /f/ or with a /t/ burst.
  - /ŋ/ may come back as /n/ or /ŋɡ/.
  - /tʃ/ may gain a vowel ("chuh").
  - /ʃ/ should be clean.
- No twin is needed (no target uses one twice). R: it pops a twin like any consonant, for one rule.

s and h on the same board as sh:

- Rule: a round never holds both letters of its own digraph as single critters: s with h on an sh board, c with h on ch, t with h on th, n with g on ng. One of them alone is allowed.
- R: with both singles, she can spell ship correctly as s-h-i-p. At four seats it sings four wrong sounds and sits. At three seats s-h-i boings. Either way the game tells her that the spelling she was taught is wrong.
- R: one single alone gives a minimal pair with a picture on each side, which is good practice. E computed: sip and ship are both slots in 7 sh-i rounds, and wig and wing share ng-i rounds.
- Cost (E, computed): 4 rounds (sh-o 29 -> 28, th-o 25 -> 22 with this rule against none).

th is voiceless only:

- E: the path teaches only digraphs-th-voiceless (mastery.ts:191). There is no voiced-th step in LITERACY_TREE (mastery.ts:179-206).
- E: design/research/digraph-acquisition-marian.md:57-87 defers voiced /ð/, which lives in function words.
- Words whose th is voiced (that than this them then thus with) are quiet. They join the three-seat reject list, as has/his/was do (playPlace.ts:330).

For Kevin (core), E:

- critterRun keys on string length (playPlace.ts:581). It must key on the number of critters: sh-i-p is a run of three, and s-h-i-p is a run of four, never "ship".
- Spellability (critterHunt.ts:190) and the decoy check (:250, w.includes(l)) work on characters. With units, "ship".includes("s") would wrongly count a single s as used.
- A round's letters array holds "sh" as one entry, a-z among the consonants. isHuntRecord's count (1 + consonants) is unchanged.

(B) GATING AND PLACEMENT

Opening:

- Each digraph deals once its step is current or mastered (currentOrMastered, playPlace.ts:35), as the vowels do (huntVowels, critterHunt.ts:110):
  - sh: digraphs-sh (mastery.ts:189)
  - ch: digraphs-ch (:190)
  - th: digraphs-th-voiceless (:191)
  - ng: duck-words (:194)
- E: the current step is the first unmastered step (hubCardModel.ts:100-107). So a learner on digraphs-sh has mastered every CVC step, and all five vowels deal.
- E: ng opens only after sh, ch and th are mastered.
- E: Marian, on short o, gets none of this yet.

Lengths:

- A seat holds a sound, so a digraph word goes where its sounds fit.
  - Three sounds: three seats and three boxes. ship fills [sh][i][p]. These are 4-letter words on the three-seat log.
  - Four sounds: four seats. chest fills [ch][e][s][t]. A 5-letter word.
- The numeral disc counts seats.
- The open line "Drag three letters up to the log..." stays. R: she drags three critters; the line plays once a visit; and a new line would need a word outside Emma's core list. Watch: if she counts letters aloud and is puzzled, revisit.

The deal:

1. Pick uniformly among "plain" and each of her open digraphs that has rounds at this length for at least one of her vowels.
   - With sh open, half her three-seat rounds have sh.
   - With all four open, a fifth are plain.
2. Pick uniformly among her vowels with rounds for that pick.
3. Pick uniformly among those rounds, never her last round's letters.

- The plain rounds are (A) of five-six, unchanged.

A digraph round:

- Three seats: 6 critters (the vowel, the digraph, 4 single consonants). Four seats: 7 critters (the vowel, the digraph, 5 singles).
- At most one digraph critter.
  - E, computed (without (E)'s pictures): rounds with two digraphs add 40 three-seat rounds and 0 four-seat rounds.
  - R: one new grapheme a board.
- At least one target uses the digraph. R: it is never the decoy.
- Plain words follow (A) as they stand: pictured-only slots, N 4-8 (three seats) or 4-6 (four seats), at most 1 decoy, at most 3 extras, complete at N - 1.
- The pair rule from (A) above applies.
- The reject lists in (C) apply.
- A three-seat digraph run on no list boings, as any non-word. A four-seat one sits.
- Pairs with 0 rounds never deal.
  - Three seats: sh a/u; ch a/o/u/e; th a/u/i/e; ng a/o/u/e.
  - Four seats: everything but ch-e.

Praise and hint:

- E: the lesson praise clips are bundled: "Yes! That's a ship." and the same for shed, shop, chip, moth, ring, wing and chest (canonAudioRegistry.ts, 3 matches each). Those 8 targets get their praise as the 11 four-letter lesson words do (critterPraise, playPlace.ts).
- fish and sing get no praise (said words with a picture).
- The hint plays each critter's sound and then the word clip, as for any target without a blend clip. The new sound windows make that work.
- Board order: the digraph targets are band 1 (pictured), not picture words.

(C) WORD LISTS (pictured only)

Targets, three seats (9; \* = picture bundled today):

- sh: ship\* fish shed shop
- ch: chip
- th: moth
- ng: ring* wing* sing
- E: the leave-one-out says every one earns its place. Without it the three-seat total falls by: ship 20, fish 10, shed 15, shop 28, chip 10, moth 22, ring 3, wing 17, sing 13.

Targets, four seats (1): chest.

Extras (said, a clip, no picture): shin shot wish. E: these are the only digraph extras any round deals.

Three-seat rejects (a round that spells one never deals):

- Quiet (they sing wrong): that than this them then thus with (voiced th); bath path (the BATH rule of five-six); both (GOAT vowel); push bush (/ʊ/); wash (/ɒ/); chef (/ʃ/); itch (tch); chew show thaw (like new, low, saw).
- Rude: shit shat shag gash tush dong bong wang dung thug meth chav.
- Known, with no clip: bash cash dash mash rash dish shut rush hush chat chop chug much such rich inch chin thin math thud bang fang gang hang rang sang long song hung lung rung sung.
  - E: no dealt round spells any of these. So rejecting them changes no count (checked), and they need no clip.
  - If one ever moves to a target, it needs a picture and a clip.

Four-seat rejects:

- Rude: shits shags bitch (b-i-t-ch).
- Known, with no clip: bench shelf brush ships chips swing crash flash smash trash fresh crush lunch punch bunch munch pinch chimp sting bring stung swung.
- Everything else sits (Dave 23's rule): shell and chess (doubled), witch and match (tch), shirt (r), thumb (silent b), sloth (GOAT), wings and rings (/z/).

Why so few targets (R, with E):

- My naming rule (five-six): a picture a 6-9 learner names with that word, never one likelier to be named as another pack word. It removes:
  - chin (face), dish (bowl), chop (axe), cash (money), cloth (rag, a pack picture)
  - fang (tooth, a pack picture), chimp (monkey), punch (hand), trash (bin)
  - shrub (bush), sting (bee), finch (bird)
- Also out: king (no k critter); bath and path (BATH vowel); thumb (silent b).
- At four seats, the plain pictured four-letter words for i, o and a are too few. So ships, chips, shelf, bench, swing and brush never reach 4 targets.
  - E: each adds 0 rounds, and brush 1.
  - E: with a floor of 3 targets the four-seat total is still only ch-e 72, sh-u 6, sh-e 1.
- Six-letter words need two digraphs (length, thrush, thrash). They cannot be built with one digraph a board, and none can be pictured.

Round counts (E, computed):

| Seats | Digraph | Vowel | Rounds | N (targets): rounds     | Rounds with a decoy |
| ----- | ------- | ----- | ------ | ----------------------- | ------------------- |
| 3     | sh      | o     | 28     | 4: 5, 5: 13, 6: 8, 7: 2 | 11                  |
| 3     | sh      | i     | 23     | 4: 20, 5: 3             | 12                  |
| 3     | sh      | e     | 15     | 4: 15                   | 0                   |
| 3     | ch      | i     | 10     | 4: 10                   | 0                   |
| 3     | th      | o     | 22     | 4: 7, 5: 5, 6: 8, 7: 2  | 8                   |
| 3     | ng      | i     | 24     | 4: 23, 5: 1             | 0                   |
| 4     | ch      | e     | 22     | 4: 19, 5: 3             | 12                  |

- Three-seat total: 122. Short i gains 57 rounds, against 8 plain ones.
- Every pair has 0, 1, 2 or 3 extras.
- How often each digraph target is a slot:
  - shop 28 of 28; ship 23 of 23; fish 13 of 23; shed 15 of 15; chip 10 of 10; moth 22 of 22
  - wing 18, sing 14, ring 3 of 24
  - chest 22 of 22

Fallbacks (the first round in my port; Kevin pins them):

| Seats | Digraph | Vowel | Letters        | Targets              | Extras       |
| ----- | ------- | ----- | -------------- | -------------------- | ------------ |
| 3     | sh      | o     | o sh b f p x   | box fox pop shop     | bob off      |
| 3     | sh      | i     | i sh b c n p   | bib bin pin ship     | nib nip shin |
| 3     | sh      | e     | e sh b d g l   | bed egg leg shed     | beg led      |
| 3     | ch      | i     | i ch b f g p   | bib chip fig pig     | big fib gig  |
| 3     | th      | o     | o th c d m t   | cot dot mom moth     | cod odd tot  |
| 3     | ng      | i     | i ng b f g w   | bib fig wig wing     | big fib gig  |
| 4     | ch      | e     | e ch c j n s t | chest jets nest tent | sent test    |

(D) SPEND (counts only; each asked under its own popup) AND KYLE

Pictures: 7 for the digraphs (fish shed shop chip moth sing chest) and 2 for (E) (fog dig): 9, about $0.72 at $0.08.

- fish: one fish in side view, one plain colour, eye, fins and tail clear. Avoid a bowl (bowl), a shark (the pack's shark.webp), water scenery.
- shed (hard): a small garden shed of dark-brown vertical planks, one sloping roof, a plank door, a small window, a garden spade leaning by it. Avoid cream walls and a pointed roof (hut.webp, a pack word), a chimney (house), red (barn.webp).
- shop (hard): a small shop front with a striped flat awning and a big window of loaves or fruit. Avoid any letters or a sign with words, a chimney (house), a pointed striped roof (tent).
- chip (hard): one golden potato crisp, round and slightly wavy. Avoid a pile or a packet (bag, a pack word), a cookie, a coin. Learners in the UK may say "crisp"; the tap settles it (build23-games:34).
- moth (hard): one moth from above, wings flat, soft brown-grey, fuzzy body, feathery antennae. Avoid bright butterfly colours or club-tipped antennae (butterfly), a lamp (lamp, a pack word), flowers.
- sing: a child singing, three-quarter view, mouth open, two music notes floating out. Avoid a microphone, an instrument, a bird, a child in mid-air (jump.webp), a child running (run).
- chest (hard): a wooden treasure chest, domed lid open, metal bands, a few gold coins. Avoid cardboard or a flat lid (box.webp), a chest of drawers, a body.
- fog and dig: see (E).

New Lily lines (17):

- 13 word lines: caption "<W>.", input "<W>," (Dave (8)'s format).
  - ship fish shed shop chip moth ring wing sing shin shot wish chest, 66 input characters.
  - Prediction: "Moth," may lose its final /θ/ before the pause, as the plural /s/ might; "Ring," may end in /ɡ/.
- 4 sound-source blends (see (A)): 76 caption characters; 99 input characters in the IPA form "/ʃː/ - /ɪ/ - /p/ ... ship".
- 0 praise lines (8 reused), 0 open lines.

What Kyle must design:

1. The digraph critter: two letters and the bar on a c body. Size the label so both letters read at the smallest c (48, phone landscape). R: two letters at 0.5c is about 26 pt in a 48 body, not measured.
2. Its tile in a slot box: two letters and the bar in one box at the smallest b, which is 20 (S5, four-box on 667 x 375; 0.62 b = 12.4 pt each). The tile is honey, like other consonants.
3. Its tile in the bonus chip: bx 16 on phones, about 10 pt letters. Shrink-to-fit is acceptable.
4. The seat: unchanged.
5. The fill: one tile per critter, so ship flies three tiles.
6. The fit on all four forms: the layout does not change (6 and 7 critters, 3- and 4-box slots, critters-word-hunt.md:103 fit rule). Kyle confirms only that the label and tile read at the smallest sizes, phone portrait and landscape, tablet portrait and landscape.
7. A VoiceOver label for the critter (e.g. "Letters s h, one sound"). Lily speaks none.
8. The 36 pt contact-sheet check for the 9 new pictures.
9. Not needed: a new numeral, a new open line, a picker change, a 5-seat log.

For Kevin (core):

- The deal, the lists and the pair rule above.
- critterRun by critter count; spellability and the decoy check by units.
- The 4 sources in CRITTER_SOUND_SOURCE; the BLEND_GRAPHEME_IPA entries.
- The 8 lesson words onto the praise list.
- fish, shed, shop, chip, moth, sing and chest, and (E)'s fog and dig, onto the picture lists once bundled.
- The fallbacks above.

BOUNDED CONVERGENCE

- Tested:
  - every count above, through the shipped core's lists and a port validated against huntRounds and against the five-six (A) counts
  - the pair rule's cost
  - that the undealt lists change no count
  - each picture's leave-one-out
  - the canon search for isolated digraph clips
  - the bundled praise clips
- Not tested:
  - Lily's /θ/, /ŋ/, /tʃ/ and /ʃ/ on the new blends (the ear test decides)
  - whether two letters and a bar read at c 48, b 20 and bx 16 (Kyle)
  - whether shed, shop, chip, moth, chest and fog are named as I predict at 36 pt (the contact sheet)
  - whether "three letters" in the open line confuses on a digraph board
  - whether a 20 % plain share is too little once all four digraphs open
  - BATH and GOAT on Lily for bath, path and sloth (inherited, not heard)
  - my port against Kevin's future code
- Watch: if she drags s then h towards a box on a board with sh, that would show the bar is not doing its job.

SOURCES (checked by web search 2026-10-27; guides and abstracts only)

- Sound buttons, dot and bar: https://www.twinkl.co.uk/homework-help/phonics/phonics-sounds/what-are-sound-buttons-and-bars ; https://www.clickvieweducation.com/blog/teaching-ideas/sound-buttons-phonics ; https://www.teachstarter.com/au/blog/what-are-sound-buttons-a-teachers-guide/
- Digraph overshoot in phoneme tapping (abstract snippet; authors and year not verified): https://cambridge.org/core/journals/applied-psycholinguistics/article/effects-of-digraphs-and-pseudowords-on-phonemic-segmentation-in-young-children/06A7968719639B07B92903B39608BCAD
- Elkonin boxes with a digraph in one box: as cited in five-six (Reading Rockets; Reading Universe th PDF).
