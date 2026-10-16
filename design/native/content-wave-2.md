# Content wave 2: sharing, tent words, cake words (native)

**Status:** spec only. Thomas, 2026-10-16: "Spec wave 2 now, build later". Nothing is built, rendered or generated until Thomas approves this spec (§ 11).

**Scope:** `@marian/core`, the native app (`mobile/`) and canon. The web is frozen: like wave 1's new kinds, a sharing read throws there and the web falls back to its silent static plan (`content-wave-1.md` § 1.9). The format model is `design/native/content-wave-1.md` (#574): its rules apply here unless this spec says otherwise. Code is anchored by names, not line numbers.

**Source:** `design/research/content-roadmap-after-path-ends.md` (Dave, #569), § 1 rows 16–17 and § 2 step 13, in his order:

| Item | Dave's working name | What                                               | Here |
| ---- | ------------------- | -------------------------------------------------- | ---- |
| NG-C | sharing             | division as equal shares; the only new interaction | § 2  |
| WS-C | jump words          | end blends (two sounds after the vowel)            | § 3  |
| WS-D | cake words          | magic e, with Emma's intro "The e is quiet…"       | § 4  |

**Out of scope:** code, renders, picture generation and test runs. Also out: "How many plates?" (§ 2.8), little stories (unless T5 moves them up), and the four times-mix facts wave 1 left open (6×5–9×5, `content-wave-1.md` § 2.2). They are not in Thomas's wave-2 scope.

## Goal

Marian learns to share a number of flowers out equally, and Word Song gains 16 new picture words that practise end blends and magic e.

## User state entering

- **Sharing:** she has mastered "all the groups" (`mult-mix`). The Map plays "You learned all the groups! Now you can do sharing!".
- **Tent words:** she has mastered crab words. **Cake words:** she has mastered tent words.
- **She finished a world before this build:** wave 1's load rule opens the new step on launch, and the Map plays its unlock beat (`content-wave-1.md` § 5.3, K13). It is generic, so nothing new is needed.

## Decisions

| #   | Call                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | **Sharing asks one question only: "How many on each plate?"** "How many plates?" comes later, because it needs its own picture: the plates are its answer, so they can't be on screen from the start (§ 2.8).                                                                                                      |
| K2  | **The read is Dave's: "Twelve flowers, three plates. How many on each plate?".** The screen shows a pile of 12 flowers with a "12" tag and 3 empty plates with "?" tags. There is no equation and no division sign in this step; the digits sit on the tags (§ 2.2).                                               |
| K3  | **Flowers are dealt one at a time, one for each plate in turn** ("one for you, one for you"). P1–P3 deal on their own after the read (the concrete model, every session). On P4–P8 the deal waits for the hints, and a right answer plays it fast as proof (§ 2.4).                                                |
| K4  | **Range: 2–5 plates, 2–6 on each plate, at most 20 flowers.** The plates are wave 1's (`GroupsRow`, at most 5). P1–P3 use 2 plates; on P4–P8 the plate count is never the answer (§ 2.7).                                                                                                                          |
| K5  | **Chips are `pickDistractors` as it is, with ceiling M = 10.** P1–P3 gentle, P4–P8 off-by-one (§ 2.6, D4).                                                                                                                                                                                                         |
| K6  | **A sharing problem records no Leitner fact**, as skip counting doesn't. Its time includes the deal, so it would mark × facts slow (§ 2.6, D5).                                                                                                                                                                    |
| K7  | **Spoken names: "sharing", "tent words", "cake words".** Not "jump words": _jump_ is an action, so it can't be a picture word ("Yes! That's a jump." breaks, the reason wave 1 dropped _swim_), and every word step is named after its stop picture (§ 1).                                                         |
| K8  | **Sharing is the 5th stop of land 4, Groups. Tent and cake words are the 3rd and 4th stops of land 6, Big words.** Wave 1 planned both placements (`content-wave-1.md` § 5.1). There are no new lands and no new land emblems.                                                                                     |
| K9  | **Exactly 8 words per Word Song step, in canon order** (wave 1's K9). All 16 targets are new pictures. Every chip partner is an existing picture, so the pack grows by 16 and no more (§ 7).                                                                                                                       |
| K10 | **Traps test the new letters.** Tent words: Dave's twin where it has a picture (nest / net), otherwise the same start (hand / hat, belt / bed, pond / pot, desk / duck). Cake words: the short twin she already knows (cape / cap, pine / pin, tube / tub), otherwise a short word with the same start (§ 3, § 4). |
| K11 | **One lead line per new step** before scored P1, in every forward session until mastered (wave 1's § 6.1 mechanism): "Let's share the flowers!", "Read to the end!", "The E is quiet. It makes the A say its name."                                                                                                |
| K12 | **A "quiet E" cue on cake-words cards:** during the lead, and on the 2nd-wrong hint of every cake-words card, the e cell dims and the vowel cell lights. It never shows from reveal (§ 4.3, D8).                                                                                                                   |

Mastery, the fast track, the pace guard, reviews, warm-ups and the Map peek work on the new steps as on their siblings. Nothing in this wave adds a timer, a currency, a streak or a loss mechanic.

## 1. Steps, lands, names and path art

| Step (`SkillNode`) | After        | Land, stop            | Spoken name | Verb | Recap phrase (`FRIENDLY_NODE_NAMES`) | Canon file                          |
| ------------------ | ------------ | --------------------- | ----------- | ---- | ------------------------------------ | ----------------------------------- |
| `div-share`        | `mult-mix`   | 4 Groups, 5th of 5    | sharing     | is   | sharing                              | `math/level-1/div-share.json`       |
| `tent-words`       | `crab-words` | 6 Big words, 3rd of 4 | tent words  | are  | reading words                        | `word-song/level-1/tent-words.json` |
| `cake-words`       | `tent-words` | 6 Big words, 4th of 4 | cake words  | are  | reading words                        | `word-song/level-1/cake-words.json` |

- **Why these names:** "sharing" is the word the step teaches, and it names the activity, like "skip counting". _tent_ and _cake_ are step words with clear pictures, and neither picture is on the path yet.
- **`LANDS`:** land 4 gets `'div-share'` at the end, and land 6 gets `'tent-words'` and `'cake-words'`. Groups then has 5 stops, the most a land has today (Word Song land 3). Big words has 4.
- **Map fit:** this spec makes no new layout measurement (no test runs). Wave 1's bars hold the build to it (`content-wave-1.md` § 5.2: core `mapModel.test.ts`, native `mapScreenLayout.test.ts`, no stop overlap, hit area ≥ 44 pt), plus the device check in § 10.

**Path art: 3 clay pieces** (subjects only; the same pipeline and style reference as wave 1 § 5.4; no digits, letters or signs):

| Id           | Subject                                                                                        | Must not look like                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `div-share`  | Two clay plates side by side, each holding three round sweets (one red, one yellow, one green) | the fruit basket (`mult-mix`), the egg box (`add-to-20`), the clovers (`mult-3-4`) |
| `tent-words` | A clay camping tent, a soft orange triangle with its door flap tied open                       | a house (the back button), the block tower (`land-ws-1`)                           |
| `cake-words` | A clay round cake with pink icing and one red cherry on top, no candles                        | the egg box (`add-to-20`); candles would bring numbers                             |

`PATH_ART_SET` gets the three ids. `pathArt.test.ts` fails until the files exist.
