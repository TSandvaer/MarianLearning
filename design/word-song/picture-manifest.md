# Word Song picture manifest (gpt-image-2.5-flare redo)

## Goal

Every Word Song picture is redrawn in one style. Thomas moved the pack from Midjourney to OpenAI gpt-image-2.5-flare on 2026-10-16. Devon's generator reads [`picture-manifest.json`](./picture-manifest.json). The style comes from 3 anchor images (hen, sack, wing), so the manifest only says **what** each picture shows.

## What the file holds

A JSON array of 89 objects, in generation order:

| Field          | Meaning                                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `word`         | The picture key and file stem (`hen` → `mobile/assets/pictures/hen.webp`).                                                                                                                                  |
| `tier`         | `short-a`, `short-o`, `short-u`, `short-i`, `short-e` (by the word's vowel in `wordPack.ts`), or the wave-1 or wave-2 step: `duck-words`, `crab-words`, `tent-words`, `cake-words`.                         |
| `batch`        | 1–10 (table below).                                                                                                                                                                                         |
| `subject`      | One sentence: the object, its pose or view, and its colours. No style words.                                                                                                                                |
| `avoid`        | What this picture must not look like: its look-alikes, plus the drifts the old prompt sheets recorded for this word.                                                                                        |
| `distinctFrom` | Every pack word it shares a picture trio with or forms a `FORBIDDEN_PAIRS` entry with. Forbidden partners come first, then trio mates A–Z. The relation is symmetric: if `a` lists `b`, then `b` lists `a`. |

## Sources

- **`word` (89).** The 57 keys come from `ls mobile/assets/pictures` (2026-10-16). The 16 wave-1 words come from `BIG_WORDS_STEPS` in `packages/core/src/wordSong/bigWordsSteps.ts` on PR #575 (`devon/ws-wave-1`), which matches [`content-wave-1.md`](../native/content-wave-1.md) § 3.2, § 4.2 and § 8. The 16 wave-2 words (tent and cake words) and their entries are [`content-wave-2.md`](../native/content-wave-2.md) § 7, verbatim, with § 7's symmetry edits to their partners.
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
  - Partners without a picture are left out. That drops `ship–tub`, `chest–box` and `bath–box`.
  - The lists run long for the old gentle distractors (dog 37, sun 34, cup 31). If the script can only use a few, take the head of the list, because forbidden partners come first.
  - **If PR #575's matrix changes before it merges, rebuild this field for the 16 words and their partners.**

## Batches

Eight batches, by tier, with wave 1 last. Within a batch, the riskiest words come first. "Risky" means one of three things: a thin shape that can vanish at 96 pt or in background removal, a forbidden or look-alike pair, or a subject that failed or drifted in the Midjourney rounds.

| Batch | Tier       | Count | Order                                       |
| ----- | ---------- | ----- | ------------------------------------------- |
| 1     | short-a    | 9     | dad man hat cap rat map mat cat bat         |
| 2     | short-a    | 9     | nap tap tag bag pan van fan can jam         |
| 3     | short-o    | 11    | mom hot pot pop mop cot dog box top log fox |
| 4     | short-u    | 11    | tub cup jug gum rug nut bun bus sun bug hut |
| 5     | short-i    | 8     | pin sip lid fig pig wig bin bib             |
| 6     | short-e    | 9     | net web egg leg pen gem hen bed jet         |
| 7     | duck-words | 8     | wing sack rock lock king ring sock duck     |
| 8     | crab-words | 8     | clock swing brick drum plum flag frog crab  |
| 9     | tent-words | 8     | pond desk belt nest gift lamp hand tent     |
| 10    | cake-words | 8     | pine tube cape rope bone cake kite bike     |

Short-a is split so that each look-alike group lands in the same batch and can be reviewed side by side: man/dad, cap/hat, map/mat, and rat/cat/bat in batch 1. Batches 7 and 8 keep `content-wave-1.md` § 8's risk order, and batches 9 and 10 keep `content-wave-2.md` § 7's (riskiest first).

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

The reverse case: map–mat and rat–bat DO share live trios, as the trap pairs of `map` and `rat`. `probe-word-picture-pack.md` § 3 proposed both as forbidden pairs, but they never landed in the code. Those four pictures carry batch 1's heaviest load.

## Assumed in the script, not repeated per word

These rules come from `picture-pack-style-anchor.md` § 3.7: one subject, no scene, no text or letters, no faces on objects, and no drop shadow. If the script doesn't add them to every prompt, it should.

## How it was checked

1. The build step throws unless:
   - the word set equals the 57 `ls` keys plus the 32 `BIG_WORDS_STEPS` words exactly (73 before content wave 2, 89 after);
   - every 57-word `tier` matches `getWordEntry(word).vowel`.
2. After commit, `python3 -c "json.load(...)"` parsed the file and returned 89 entries and 89 unique words, with the batch and tier counts above.
3. Every `distinctFrom` entry is a pack word, never the word itself, and every link is symmetric (re-checked over all 89 for content wave 2).

## Open questions

- **For Thomas: the simple-sentence scenes.** The 8 WebPs in `mobile/assets/scenes/` (cat-sat-mat, cat-sat-prep, dog-ran, dog-ran-in, man-ran, see-dog, she-has-bag, he-can-see) are in the old Midjourney picture-book style. They show the cat, the dog, a man and a bag. After the redo they won't match those word pictures. Should they be redrawn in the new style? Each scene needs its own brief, so they are not in this manifest.
- **For Matt: the web copy.** The PWA has its own copy of the old pack in `public/assets/pictures/` (53 SVGs). Does it get the new pictures, or stay frozen while Marian uses the native app?
- Not listed: Emma's poses and the path art (the clay set, `content-wave-1.md` § 5.4). Each has its own style, not the picture pack's.
