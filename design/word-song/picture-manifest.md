# Word Song picture manifest (gpt-image-2.5-flare redo)

## Goal

Every Word Song picture is redrawn in one style. Thomas moved the pack from Midjourney to OpenAI gpt-image-2.5-flare on 2026-10-16. Devon's generator reads [`picture-manifest.json`](./picture-manifest.json). The style comes from 3 anchor images (hen, sack, wing), so the manifest only says **what** each picture shows.

## What the file holds

A JSON array of 179 objects, in generation order:

| Field          | Meaning                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `word`         | The picture key and file stem (`hen` → `mobile/assets/pictures/hen.webp`).                                                                                                                                                                                                                                                                                                                       |
| `tier`         | `short-a`, `short-o`, `short-u`, `short-i`, `short-e` (by the word's vowel in `wordPack.ts`), or the wave step: `duck-words`, `crab-words` (wave 1), `tent-words`, `cake-words` (wave 2), `bee-words`, `car-words` (wave 4), `snail-words`, `moon-words` (wave 5). `ship`, `fish`, `shed` and `shop` are `digraphs-sh`; `chip` and `chest` are `digraphs-ch`; `moth` is `digraphs-th-voiceless`. |
| `batch`        | 1–14 and 18–22 (table below).                                                                                                                                                                                                                                                                                                                                                                    |
| `subject`      | One sentence: the object, its pose or view, and its colours. No style words.                                                                                                                                                                                                                                                                                                                     |
| `avoid`        | What this picture must not look like: its look-alikes, plus the drifts the old prompt sheets recorded for this word.                                                                                                                                                                                                                                                                             |
| `distinctFrom` | Every pack word it shares a picture trio with or forms a `FORBIDDEN_PAIRS` entry with. Forbidden partners come first, then trio mates A–Z. The relation is symmetric: if `a` lists `b`, then `b` lists `a`.                                                                                                                                                                                      |

## Sources

- **`word` (122).** The 57 keys come from `ls mobile/assets/pictures` (2026-10-16). The 16 wave-1 words come from `BIG_WORDS_STEPS` in `packages/core/src/wordSong/bigWordsSteps.ts` on PR #575 (`devon/ws-wave-1`), which matches [`content-wave-1.md`](../native/content-wave-1.md) § 3.2, § 4.2 and § 8. The 16 wave-2 words (tent and cake words) and their entries are [`content-wave-2.md`](../native/content-wave-2.md) § 7, verbatim, with § 7's symmetry edits to their partners. The 17 wave-4 words (the bee and car words, and _ship_) and their entries are [`content-wave-4.md`](../native/content-wave-4.md) § 9.1, verbatim, with § 9.1's symmetry edits to their partners. The 16 wave-5 words (the snail and moon words) and their entries are [`content-wave-5.md`](../native/content-wave-5.md) § 10.1, verbatim, with § 10.1's symmetry edits to their partners. The 5 probe-reserve words (ham, cab, rag, ram, pad: Dave's ruling of 2026-10-24, `design/research/no-claude-variety-2026-10-23.md` § 2.4) are batch 18, written for the reserve PR, with their symmetry edits and rat's new forbidden partners (cat, bat). The 4 word hunt words (mug, sad, mud, hug: Dave's ruling of 2026-10-25, `design/research/critters-word-hunt-2026-10-25.md` § 6) are batch 19, written for the hunt's build PR, with their look-alikes as `distinctFrom` and the symmetric edits to those partners (cup, jug, man, mom, sun, log, pond, rock, dad). The 16 four-letter critter words (sand, ramp, clap, vest, sled, clip, drip, stop, drop, jump, pump, plug, slug, bulb, plus the three-letter ant and elf: Dave's ruling of 2026-10-26, `design/research/critters-four-letter-2026-10-26.md`, "New pictures") are batch 20, written for the four-letter content PR, with their look-alikes as `distinctFrom` and the symmetric edits to those partners (flag, mud, sun, log, hand, coat, boat, tray, pin, tap, dad, frog, man, bike, leaf, snail, lamp, bee, bug, hat, king). The 23 pictured-board words (six, ten, red, peg, rod, run, dot, tug, step and the 14 voiceless plurals ants, bats, caps, cats, hats, maps, mats, rats, taps, cots, mops, pots, tops, jets: Dave's ruling of 2026-10-27, (A) and (C)) are batch 21, written for the pictured-boards content PR from (C)'s subject and avoid notes, with their look-alikes as `distinctFrom` and the symmetric edits to those partners (hat, cap, rat, map, mat, cat, bat, tap, pot, mop, cot, top, jet, ant, box, rock, log, pin, clip, jump). The 9 digraph-critter words (fish, shed, shop, chip, moth, sing, chest: Dave's digraph-critter ruling of 2026-10-27, (D); fog and dig: (E)) are batch 22, written for the digraph content PR from (D)'s and (E)'s subject and avoid notes, with their look-alikes and their two in-batch `FORBIDDEN_PAIRS` partners (shed and shop, chip and chest) as `distinctFrom`, and the symmetric edits to the other partners (shark, hut, barn, tent, bag, lamp, jump, box, sand, dog).
- **`subject` and `avoid`.** Each word's recognition cue and negatives come from its prompt sheet:
  - short-a, plus the old distractors bus, sun, dog, fox, cup, pen, log and pot: [`picture-pack-prompts.md`](./picture-pack-prompts.md) § 1–§ 2
  - nap, rat, map, tap: [`probe-word-picture-pack.md`](./probe-word-picture-pack.md) § 1 and § 3
  - short-o: [`short-o-picture-pack-prompts.md`](./short-o-picture-pack-prompts.md) and [`short-o-picture-pack-extension-prompts.md`](./short-o-picture-pack-extension-prompts.md)
  - short-u: [`short-u-picture-pack-prompts.md`](./short-u-picture-pack-prompts.md)
  - short-i: [`short-i-picture-pack-prompts.md`](./short-i-picture-pack-prompts.md)
  - short-e: [`mj-prompts-paste-ready-2026-05-10.md`](./mj-prompts-paste-ready-2026-05-10.md) (the v7 prompts that were used)
  - wave 1: `content-wave-1.md` § 8

  Where a sheet offered a choice (lid or no lid, which colour), I took the option the shipped WebP shows, unless that option breaks a look-alike rule (next section). I checked the shipped WebPs on a contact sheet of all 57 on 2026-10-16.

- **`distinctFrom`.** Built mechanically from PR #575's `wordPack.ts`, which is `origin/main`'s plus the wave-1 rows, with no other diffs.
  - It uses `FORBIDDEN_PAIRS` (with the 14 wave-1 pairs of `content-wave-1.md` § 4.5), `TARGET_PAIRINGS` and `TARGET_PAIRINGS_CROSSVOWEL`. Cross-vowel mixing is a live parent setting on native.
  - A trio is a row's target plus its gentle pair or its trap pair. Only rows whose target is one of the 73 count. The 54 sight-word, simple-sentence and digraph rows have no pictured target.
  - Partners without a picture are left out. That drops `chest–box` and `bath–box`; `ship–tub` dropped too until content wave 4 pictured _ship_.
  - Content wave 4 adds `FORBIDDEN_PAIRS` entries (`content-wave-4.md` § 7) and counts the sh step's rows for _ship_, _sheep_ and _shark_, whose targets now have pictures.
  - Content wave 5 adds 21 `FORBIDDEN_PAIRS` entries (`content-wave-5.md` § 8).
  - The lists run long for the old gentle distractors (dog 37, sun 34, cup 31). If the script can only use a few, take the head of the list, because forbidden partners come first.
  - **If PR #575's matrix changes before it merges, rebuild this field for the 16 words and their partners.**

## Batches

Nineteen batches, by tier, with the wave steps last. Within a batch, the riskiest words come first. "Risky" means one of three things: a thin shape that can vanish at 96 pt or in background removal, a forbidden or look-alike pair, or a subject that failed or drifted in the Midjourney rounds.

| Batch | Tier                                                                          | Count | Order                                                                                                      |
| ----- | ----------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| 1     | short-a                                                                       | 9     | dad man hat cap rat map mat cat bat                                                                        |
| 2     | short-a                                                                       | 9     | nap tap tag bag pan van fan can jam                                                                        |
| 3     | short-o                                                                       | 11    | mom hot pot pop mop cot dog box top log fox                                                                |
| 4     | short-u                                                                       | 11    | tub cup jug gum rug nut bun bus sun bug hut                                                                |
| 5     | short-i                                                                       | 8     | pin sip lid fig pig wig bin bib                                                                            |
| 6     | short-e                                                                       | 9     | net web egg leg pen gem hen bed jet                                                                        |
| 7     | duck-words                                                                    | 8     | wing sack rock lock king ring sock duck                                                                    |
| 8     | crab-words                                                                    | 8     | clock swing brick drum plum flag frog crab                                                                 |
| 9     | tent-words                                                                    | 8     | pond desk belt nest gift lamp hand tent                                                                    |
| 10    | cake-words                                                                    | 8     | pine tube cape rope bone cake kite bike                                                                    |
| 11    | bee-words, digraphs-sh                                                        | 9     | seed peach ship leaf seal jeep sheep tree bee                                                              |
| 12    | car-words                                                                     | 8     | card harp scarf cart barn star shark car                                                                   |
| 13    | snail-words                                                                   | 8     | train goat loaf chain tray snail coat boat                                                                 |
| 14    | moon-words                                                                    | 8     | roof hoop stool tooth moon broom boot spoon                                                                |
| 18    | short-a                                                                       | 5     | ham cab rag ram pad                                                                                        |
| 19    | short-u, short-a                                                              | 4     | mug sad mud hug                                                                                            |
| 20    | tent-words, crab-words, short-a, short-e                                      | 16    | sand ramp clap vest sled clip drip stop drop jump pump plug slug bulb ant elf                              |
| 21    | short-i, short-e, short-o, short-u, crab-words, tent-words                    | 23    | six ten red peg rod run dot tug step ants bats caps cats hats maps mats rats taps cots mops pots tops jets |
| 22    | digraphs-sh, digraphs-ch, digraphs-th-voiceless, duck-words, short-o, short-i | 9     | fish shed shop chip moth sing chest fog dig                                                                |

Short-a is split so that each look-alike group lands in the same batch and can be reviewed side by side: man/dad, cap/hat, map/mat, and rat/cat/bat in batch 1. Batches 7 and 8 keep `content-wave-1.md` § 8's risk order, batches 9 and 10 keep `content-wave-2.md` § 7's (riskiest first), batches 11 and 12 keep `content-wave-4.md` § 9.1's, and batches 13 and 14 keep `content-wave-5.md` § 10.1's (riskiest first). Batch 18 is the probe reserve's five new words (15–17 are the avatar, flower-bed and Play place art manifests). Thomas picked ham v1, cab v1, rag v1, ram v2 and pad v1 (2026-10-24). Batch 19 is the Letter critters word hunt's four new pictures (Dave's ruling of 2026-10-25, `design/research/critters-word-hunt-2026-10-25.md` § 6): mug must not read as cup, sad as sun or a grown-up, mud as a heap, hug as mom or dad. Thomas picked mug v1, sad v1, mud v1 and hug v1 (2026-10-25). Batch 20 is the four-letter rounds' 14 new pictures plus ant and elf (Dave's ruling of 2026-10-26): clap must not read as hand, drip as tap or drop, slug as snail, and vest is a hi-vis vest, not a coat. Ramp and clap were drawn a second time (v3, v4) after their first two read as a seesaw and as praying hands. Thomas picked v1 for sand, vest, sled, clip, drip, stop, drop, jump, pump, plug, slug, bulb, ant and elf, and v3 for ramp and clap (2026-10-26). Batch 21 is the pictured-only boards' 23 pictures (Dave's ruling of 2026-10-27, (A) and (C)): six and ten are dots with no numeral, die or fingers; red is a paint splash; dot is not red, yellow or shaded; run is not in the air; step is one step, not stairs; and each plural is exactly three of its singular's own picture, spaced apart (taps not a sink, mats not towels, cots not a nursery). Step was drawn a second time (v2, v3). Thomas picked v1 for the other 22 and v3 for step (2026-10-27). Batch 22 is the digraph critters' 7 pictures and fog and dig (Dave's digraph-critter ruling of 2026-10-27, (D) and (E)): fish is not a shark or in a bowl; shed is dark-brown planks, not the hut or the red barn; shop carries no letters; chip is one crisp, not a packet or a coin; moth is not a butterfly; sing is not jumping or running; chest is a domed treasure chest, not the box; fog is mist, not a cloud or smoke; dig is soil and a metal trowel, not sand's red spade. One take each. Thomas kept all nine (2026-10-28).

The anchors hen, sack and wing are in the manifest so that the count is 73. If an anchor image is already the final picture, the script can skip that word.

## Deliberate changes from the shipped pictures

- **nap, rat, map, tap:** first real pictures. The shipped WebPs are flat outline icons, not pack art. nap keeps the shipped moon but drops any "Zzz", because the pack allows no letters in pictures.
- **mat:** no fringe. Fringe is how `rug` reads, and rug–mat is a forbidden pair. The shipped mat has a fringe.
- **pot:** no lid. The shipped pot wears the same knobbed lid as `lid`, and the short-o sheet's own default is no lid.
- **net:** a loose mesh hangs from the hoop. The shipped net reads as a tennis racket.
- **gum:** a stick, half out of its wrapper. The shipped picture reads as butter or soap, and the short-u sheet's own fallback is the half-unwrapped stick.
- **bed vs cot:** the bed gets a headboard and a blanket, and the cot stays low and bare. The two sheets describe nearly the same bed.
- **man vs dad:** man's T-shirt is peach and dad's is beige. The single-figure vs two-figure split still carries the read.

## Look-alikes the code does not pair

These pairs never share a trio, so the code doesn't pair them. The `avoid` fields guard them anyway, because Marian sees every picture: pin–pop (a ball on a stick), cot–bed, pot–lid, mop–wig, and nap with bed and cot.

The reverse case: map–mat DOES share a live trio, as `map`'s trap pair. `probe-word-picture-pack.md` § 3 proposed it as a forbidden pair, but it never landed in the code. rat–bat and rat–cat are forbidden pairs since the probe reserve (rat's trap pair is now mat and hat).

## Assumed in the script, not repeated per word

These rules come from `picture-pack-style-anchor.md` § 3.7: one subject, no scene, no text or letters, no faces on objects, and no drop shadow. If the script doesn't add them to every prompt, it should.

## How it was checked

1. The build step throws unless:
   - the word set equals the 57 `ls` keys plus the 32 `BIG_WORDS_STEPS` words exactly, plus the 17 words of `content-wave-4.md` § 9.1 and the 16 of `content-wave-5.md` § 10.1 (73 before content wave 2, 89 after it, 106 after content wave 4, 122 after content wave 5), plus the 5 probe-reserve words (127), plus the word hunt's 4 (131), plus the four-letter rounds' 16 (147);
   - every 57-word `tier` matches `getWordEntry(word).vowel`.
2. After commit, `python3 -c "json.load(...)"` parsed the file and returned 147 entries and 147 unique words, with the batch and tier counts above.
3. Every `distinctFrom` entry is a pack word, never the word itself, and every link is symmetric (re-checked over all 89 for content wave 2, over all 106 for content wave 4, over all 122 for content wave 5, over all 127 for the probe reserve, over all 131 for the word hunt, and over all 147 for the four-letter rounds, with every `FORBIDDEN_PAIRS` pair of two pictured words linked).

## Open questions

- **For Thomas: the simple-sentence scenes.** The 8 WebPs in `mobile/assets/scenes/` (cat-sat-mat, cat-sat-prep, dog-ran, dog-ran-in, man-ran, see-dog, she-has-bag, he-can-see) are in the old Midjourney picture-book style. They show the cat, the dog, a man and a bag. After the redo they won't match those word pictures. Should they be redrawn in the new style? Each scene needs its own brief, so they are not in this manifest.
- **For Matt: the web copy.** The PWA has its own copy of the old pack in `public/assets/pictures/` (53 SVGs). Does it get the new pictures, or stay frozen while Marian uses the native app?
- Not listed: Emma's poses and the path art (the clay set, `content-wave-1.md` § 5.4). Each has its own style, not the picture pack's.
