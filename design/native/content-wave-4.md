# Content wave 4: more and less, bee words, car words, sheep stories (native)

**Status:** spec only. Thomas said go on 2026-10-18 ("go with next content wave from daves roadmap", quoted in the roadmap addendum's status line). Nothing is built, rendered or generated until Thomas approves § 13.

**Scope:** `@marian/core`, the native app, canon, the pack manifest and the scene manifest. The web is frozen: a new read throws there and the web plays its silent static plan (`content-wave-1.md` § 1.9). Rules follow `content-wave-3.md` (#595) unless stated.

**Source:** Dave's addendum "content wave 4" in `design/research/content-roadmap-after-path-ends.md` (PR #605, open while this was written). Number Garden step 15 (§ 2 here), Word Song steps 19–21 (§ 3–§ 6).

**Out of scope:** code, renders, generation and test runs. Also out: zeros and "one hundred" as a start (the first hundreds deepening), regrouping, three-digit + three-digit, _or_ and _er/ir/ur_, vowel teams ai/ay and oa (Dave: wave 5).

## Goal

Marian adds and takes away whole hundreds and whole tens in her head, reads 16 new words with the vowel teams ee/ea and ar, and reads stories with those words where the question word changes from story to story.

## User state entering

- **More and less:** she has mastered hundreds. The Map plays "You learned hundreds! Now you can do more and less!".
- **Bee words:** she has mastered bug stories. The Map plays "A new land! Land 8: Words and stories!". Car words follow bee words, sheep stories follow car words.
- **She finished a world before this build:** wave 1's load rule (K13) opens the new step on launch, with no new code.
- **No guard change.** The progress guard reads any whole number from 0 up since #597 (`packages/core/src/progress/guards.ts:209-222`, Dave's state check), and the largest answer here is 853.

## Decisions

- **K1.** Step 15 is `hundreds-addsub`, spoken "more and less", the 2nd stop of Number Garden land 5 "Hundreds".
- **K2.** It widens hundreds' `'more'` kind to 2–4 hundreds or 2–4 tens, added or taken away. `PlaceValueStage` is reused unchanged in look. The one new motion is the lift-out. The number tag's pill carries the change ("+200", "−30"), and moving blocks carry no pills of their own.
- **K3.** Bee words and car words are land-6-format steps: rows in `BIG_WORDS_STEPS`, served as `cvc-word`. Dave's 8 words and traps, my gentle pairs (§ 3.2, § 4.2).
- **K4.** **Chip rows are per step for these steps.** _sheep_ and _shark_ already have sh-step rows in `TARGET_PAIRINGS`, which is keyed by word (`wordPack.ts:2053-2054`). A bee-words or car-words problem takes its own step's row, and the sh step keeps its rows (§ 5).
- **K5.** Sheep stories use wave 3's format exactly: one canon file of 8 stories, with the question word mixed (§ 6).
- **K6.** A new Word Song land 8, "Words and stories", holds bee words, car words and sheep stories. Land 7 is full of its own kind.
- **K7.** 17 new pack pictures (the 16 targets and _ship_) and 8 scenes (§ 9). The scenes use the new pictures as references, so they are generated after Thomas approves the bee and car contact sheets.
- **K8.** No Leitner fact for step 15, so it has no warm-up hearts (as hundreds). Sheep-story blocks are never warm-up hearts (`STORY_NODES` widens). Mastered blocks of all four steps join reviews.

Mastery, the fast track, the pace guard, reviews, peeks and Map replays behave as on the siblings. No timer, currency, streak or loss mechanic.

## 1. Steps, lands, names and path art

| Step              | After         | Land, stop                       | Spoken name   | Verb | Recap phrase    | Canon file                             |
| ----------------- | ------------- | -------------------------------- | ------------- | ---- | --------------- | -------------------------------------- |
| `hundreds-addsub` | `hundreds`    | NG 5 Hundreds, 2/2               | more and less | are  | more and less   | `math/level-1/hundreds-addsub.json`    |
| `bee-words`       | `bug-stories` | WS 8 Words and stories (new) 1/3 | bee words     | are  | reading words   | `word-song/level-1/bee-words.json`     |
| `car-words`       | `bee-words`   | WS 8, 2/3                        | car words     | are  | reading words   | `word-song/level-1/car-words.json`     |
| `sheep-stories`   | `car-words`   | WS 8, 3/3                        | sheep stories | are  | reading stories | `word-song/level-1/sheep-stories.json` |

- **`LANDS`** (`packages/core/src/progress/lands.ts`): land 5 becomes `nodes: ['hundreds', 'hundreds-addsub']` (its comment at :47 already says step 15 joins it), and a new `{ world: 'word-song', number: 8, name: 'Words and stories', nodes: ['bee-words', 'car-words', 'sheep-stories'] }` follows land 7.
- **Why these names:** "more and less" is the step's own question ("What is two hundred more?" / "… less?"), so it costs no word beyond _less_. Bee, car and sheep are step words with clear pictures, and none is a stop yet (the star is `sight-words`' stop, `friendlyNodeName.ts:173`). "Words and stories" uses only words in use and says what the land holds.
- **The id** follows `two-digit-addsub-*`: the step adds and takes away.

**Map fit (hand-computed, not measured).**

- **Number Garden** keeps 5 lands; land 5 gains a 2nd stop. The shipped bars hold the build to it.
- **Word Song portrait:** 8 lands > `PORTRAIT_FIT_LANDS = 6` (`packages/core/src/map/mapLayout.ts:323`), so the path scrolls on portrait, opened on the current stop, exactly as it does with 7 lands today (`mobile/src/layout/mapScreenLayout.ts:235-247`, wave 3's T6). Each land adds `LANDSCAPE_BAND + BAND_GAP` = 136 + 40 = 176 virtual px (`mapLayout.ts:294`, `:28`, `:303-311`), about 176 × s pt more scroll (s = min(1, pane width / 820)). No new code.
- **Word Song tablet landscape (prediction):** from `landscapeNeed` with the TL pane (safe height − 16) and wave 1's insets (t24 b20), 8 lands fit at 1180×820 (scale 0.499, Emma in 1 land; 0.469 during an unlock beat). At 1133×744 they drop just under `MAP_MIN_SCALE = 0.45` (`mapScreenLayout.ts:45`): 0.449 and 0.422, so that form starts to scroll, on the existing scroll path. 7 lands fit there today (0.507 / 0.474). The build's `mapScreenLayout.test.ts` confirms or corrects these numbers (T6).

**Path art: 5 clay pieces** (wave 1 § 5.4's pipeline; no digits, letters or signs):

| Id                | Subject                                                                                                                       | Must not look like                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `hundreds-addsub` | A seesaw: a warm-brown plank on a round rose pivot, tipped down at the left, a small stack of soft pink blocks on the low end | the hundred-flat (`hundreds`), the bundle of ten sticks (`two-digit-addsub-no-regroup`)   |
| `bee-words`       | A honeybee: a round golden body with two brown stripes, two small cream wings, a gentle smile                                 | the beehive (`land-ng-4`), the ladybird (`bug-stories`), the yellow chick (`digraphs-ch`) |
| `car-words`       | A toy car: a rounded rose-red body, two windows, two black wheels                                                             | the toy train (`land-ws-6`), the ship (`digraphs-sh`)                                     |
| `sheep-stories`   | A sheep: a round cream fleece of soft curls, a dark grey face, ears and four short legs                                       | the cream hen (`hen-stories`), a cloud                                                    |
| `land-ws-8`       | A windmill: a round cream tower, a rose-pink cap and door, four warm-brown sails                                              | the beehive (`land-ng-4`), the puppet theatre (`land-ws-7`), the house (`ui-house`)       |

`PATH_ART_SET` + 4 step ids; `LandArtId` + `'land-ws-8'` (`packages/core/src/emmasPath/pathArt.ts:27-39`). The land subjects in use are listed in `design/emmas-path/emmas-path-spec.md` § 5.3 plus waves 1–3 (toy train, apple tree, puppet theatre).

## 2. NG step 15: more and less (`hundreds-addsub`)

### 2.1 The step

After `hundreds` in `MATH_TREE` and `MATH_NODES_IN_ORDER`, default `'locked'`. The same 8 canon problems every session (§ 2.7). The math preset for mastery, fast track, pace guard, peek and replay (secure = 8/8 on the first tap).

### 2.2 What she sees

P1, phone portrait (375×667), after the read has dropped the two flats in:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ● ◉ ○ ○ ○ ○ ○ ○            |
| (Emma) | Two hundred and | |
| (147 ) | thirty-five.    | |
|        | What is two     | |
|        | hundred more?   | |
|        [235] (+200)        |  number tag + pill, from the first frame
|  ▦▦▦▦        ▮▮▮    ▪▪▪   |  4 flats now (2 + the 2 that dropped)
|  ▦▦▦▦        ▮▮▮    ▪▪    |
|   (?)        (3)    (5)    |  the changed tray's tag is "?"
| [435]     [635]    [835]   |  chips
+----------------------------+
```

- **From the first frame:** the start blocks, the number tag with the start number, its pill ("+200", "+30", "−200", "−30"), and the tray tags. The unchanged trays' tags show their digits. **The changed tray's tag shows "?"** until her right tap or the given answer (Dave's assumption, D1).
- **Pills:** "+" or "−" (U+2212, the sign the take-away equations already draw, `mobile/src/screens/math/Math.tsx:1630`), then the change in digits. Digits are language-free (M5), and there is still no "=".
- Layout, glyphs, tags and placement are hundreds' (`content-wave-3.md` § 3.2).

### 2.3 Layout and sizes

`extendedMathLayout(viewport, 'place-value')` as hundreds. The canon's largest counts at any point are 7 flats (P3's answer, P7's start), 6 rods (P4's answer, P7's and P8's starts) and 8 cubes (P8): hundreds' maxima, so § 3.3's u, widths and heights stand unchanged on all four forms. Pills "+200" and "−30" have the same character counts as "+100" and "+10", so the tag row fits. Reads are 49–56 characters, inside hundreds' 46–60 slot (P keeps `maxLines={4}`).

### 2.4 Beats, problem by problem

- **Lead** (scored P1, forward sessions until mastered): "More and less!". The number tag's pill pulses on the word tick "More" and again on "less". 400 ms, then the read.
- **Read:** the number tag pulses on the first word tick, the pill on the change word ("hundred", "thirty", "forty").
  - **P1–P3 (adding) and P6 (the first taking away):** the change blocks move on the word tick "more" or "less": they drop into their tray, or lift out of it.
  - **P4, P5, P7, P8:** nothing moves during the read. She works from the tag and the pill (fading, M10).
  - Chips open on `onPlay`, as today.
- **Wrong 1, 2:** "Hmm... try again?", poof, shake, `puzzled-tilt`. The picture doesn't change.
- **Hints** (600 ms after the 2nd wrong's reprompt):
  1. "Look at the hundreds." / "Look at the tens.": the changed tray ripples.
  2. "Two more hundreds." / "Take away three tens.": the change blocks drop in or lift out. On P1–P3 and P6 they have already moved, so the tray ripples instead.
  3. The read's question again ("What is two hundred more?"): the number tag and its pill pulse.
- **giveAnswer** (3rd wrong): the "?" tag fills with sharing's 4 pt `colors.myRose` ring; blocks that haven't moved move at once; the guided tap plays the correct moment.
- **Correct** ("Yes! Four hundred and thirty-five!"): blocks that haven't moved move fast; the "?" tag ticks to its digit; the number tag ticks to the answer as its pill fades, so "235 +200" never shows beside the answer. Burst, sparkle, plink, `celebration`; 250 ms exit.

### 2.5 Motion brief (Reanimated; Reduce Motion in brackets)

- **Drop-in (many blocks):** hundreds' added-block motion per block (starts 40 pt above its tray, spring 220 / 18), `BUILD_STAGGER_MS` (90 ms, `PlaceValueStage.tsx:74`) apart, **without per-block pills**: the number tag's pill says the change. On a fast right tap: spring 300 / 22. [200 ms crossfade per block.]
- **Lift-out (new):** the blocks placed last leave first (the top of the fan, the rightmost rods, the top cubes of the last column), 90 ms apart. Each rises 24 pt (tablet 32) and fades out over 250 ms, `EASE_OUT`. The blocks that stay never move, so nothing reflows. On a fast right tap: 150 ms. [200 ms fade, no rise.]
- **Tag tick, tag fill, ripple, pulse:** hundreds' (§ 3.5).
- One shared value per block via `withDelay`, at most 18 (P7: 765 is 18 blocks). Rotation mid-move lands every block in its end state. No new sounds.

### 2.6 Data model, parser, chips, session end

**Widen `MoreProblem`** (`packages/core/src/math/extendedProblems.ts:233-245`). Exact names, for Kevin's core PR and Devon's stage PR:

```ts
export interface MoreProblem {
  kind: 'more'
  index: number
  start: number // three digits, no zero
  step: 10 | 100 // the place that changes (unchanged meaning)
  count: 1 | 2 | 3 | 4 // new: how many tens or hundreds; hundreds' P6–P8 are 1
  direction: 'more' | 'less' // new: hundreds' P6–P8 are 'more'
  correct: number // start ± count × step
}
```

**Read template** (`matchMoreRead`, `packages/core/src/math/planFromServer.ts:870-899`, regex at :874): `<number>. What is <change> (more|less)?`, where `<change>` is _ten_, _twenty_, _thirty_, _forty_, _one hundred_, _two hundred_, _three hundred_ or _four hundred_.

- **Valid when:** start and answer have three digits and no zero; the changed digit stays in 1–9 (no regrouping); the answer is in 100–999. This contains today's rule for hundreds' P6–P8.
- **Disjoint:** no other read ends "more?" or "less?" (no committed canon line contains _less_, `jq` over `public/canon/*/level-1/*.json`, 2026-10-18).
- **Per file** (the splice lint, not the parser): `hundreds` holds count 1, 'more' only; `hundreds-addsub` holds count 2–4.
- Before merge, all 8 `math.p*.read` lines parse.

**Chips** (`hundredsDistractors`, `packages/core/src/math/extendedDistractors.ts:227-274`): a `'more'` problem with count 1 and 'more' keeps hundreds' rule (`'wrong-place'`: the other two of +1, +10, +100). Any other `'more'` problem:

- **P1–P3, `'gentle'`:** the answer's hundreds digit + 2 and + 4 (− 2 and − 4 above 5), hundreds' gentle rule.
- **P4–P8, two traps:**
  - **First:** `'wrong-place'` when adding (the same count in the next place down: a tens change is made in the ones, a hundreds change in the tens), or `'wrong-op'` when taking away (she added: start + count × step). A `'wrong-op'` value with a zero digit, a regroup or a value outside 100–999 is replaced by `'wrong-place'` (P8: 408 → 364).
  - **Second:** `'digit-swap'`, the answer's tens and ones swapped (M6, M9).
- **Recorded class** (`perProblemDistractorClass`): the first trap's, so P4, P5, P8 `'wrong-place'` and P6, P7 `'wrong-op'`. The tapped value tells which chip she took. `HundredsOfferedClass` (`:68-72`) gains `'wrong-op'`.
- All three chips differ, in 100–999. Shuffled by `buildExtendedChipOrder`, as today.

**Session end:** `perProblemCorrect`, `latencyMs`, `perProblemAnswerValue` (3-digit) and `perProblemDistractorClass` as hundreds; no `mathFacts`, no Leitner outcome; `CANON_MATH_FACTS['hundreds-addsub']` = 8 nulls.

### 2.7 Canon (binding: the splice writes exactly this)

Dave's suggested canon, checked against his rules (no zero in any start or answer; all digits of each start and answer differ; no regrouping; maxima 7 / 6 / 8; three different chips in 100–999).

| P   | Read (characters)                                               | Answer | Change | Blocks move | Chips (correct first) | Class       |
| --- | --------------------------------------------------------------- | ------ | ------ | ----------- | --------------------- | ----------- |
| 1   | "Two hundred and thirty-five. What is two hundred more?" (54)   | 435    | +200   | on the read | 435, 635, 835         | gentle      |
| 2   | "Three hundred and twenty-four. What is thirty more?" (51)      | 354    | +30    | on the read | 354, 554, 754         | gentle      |
| 3   | "Four hundred and twenty-six. What is three hundred more?" (56) | 726    | +300   | on the read | 726, 526, 326         | gentle      |
| 4   | "Five hundred and thirty-two. What is thirty more?" (49)        | 562    | +30    | at hint 2   | 562, 535, 526         | wrong-place |
| 5   | "Two hundred and forty-five. What is four hundred more?" (54)   | 645    | +400   | at hint 2   | 645, 285, 654         | wrong-place |
| 6   | "Six hundred and fifty-three. What is two hundred less?" (54)   | 453    | −200   | on the read | 453, 853, 435         | wrong-op    |
| 7   | "Seven hundred and sixty-five. What is thirty less?" (50)       | 735    | −30    | at hint 2   | 735, 795, 753         | wrong-op    |
| 8   | "Three hundred and sixty-eight. What is forty less?" (50)       | 328    | −40    | at hint 2   | 328, 364, 382         | wrong-place |

- **Per problem:** correct "Yes! <answer in words>!" (32–36 characters); giveAnswer "This one is <answer in words>." (39–43); reprompt "Hmm... try again?" (reused); hint1 "Look at the hundreds." / "Look at the tens." (reused); hint2 "<Count> more hundreds." / "<Count> more tens." / "Take away <count> hundreds." / "Take away <count> tens." (16–23); hint3 = the read's question (19–27). Recap "You worked on more and less today!" (34).
- **Why this order:** adding first, and the opening three move their blocks (the concrete model, M10, M11). P4 is the first problem worked from the tag alone. P6 is the first taking away, so it moves its blocks once. The hundreds and tens changes alternate, so she reads which place changes.
- **The digit swap** is the slip a Danish inner voice predicts: "fem hundrede og toogtres" (562) says the 2 before the 6 (Dave's example, his own Danish, not a cited source).

## 3. WS step 19: bee words (`bee-words`)

### 3.1 The step

- **SkillNode `bee-words`**, after `bug-stories` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`. Default `'locked'`.
- **Format:** `cvc-word` as land 6 has it: "Read the bee.", the word card with its letter row, three picture chips, the 1500 ms silent beat, the chip gate, the hint "Let's look. Bee.", the given answer. No blend clip.
- **8 words**, served from canon in this order every session. P1–P3 play the gentle pair, P4–P8 the trap pair; every row carries both, because a review moves blocks.
- **ee and ea both say E's name** (/iː/), taught together as UFLI lesson 85 does (Dave's R6). Every word takes "Yes! That's a <word>.".

### 3.2 Word list and chip pairs (canon order)

| P   | Word  | Team | Category | Gentle (P1–P3) | Trap (P4–P8) | Why the trap (Dave)                                  |
| --- | ----- | ---- | -------- | -------------- | ------------ | ---------------------------------------------------- |
| 1   | bee   | ee   | animal   | cup, fan       | bed, tree    | bed: the short word she reads; tree: the same ee     |
| 2   | tree  | ee   | nature   | dog, cap       | tent, bee    | tent: t and a short e                                |
| 3   | leaf  | ea   | nature   | box, hat       | leg, seal    | leg: the short word; seal: the same ea               |
| 4   | sheep | ee   | animal   | pot, map       | ship, jeep   | **ship: R8's contrast** (a new picture); jeep: rhyme |
| 5   | jeep  | ee   | vehicle  | pig, sun       | jet, sheep   | jet: the short word                                  |
| 6   | seal  | ea   | animal   | mop, cap       | sun, seed    | sun: s and a short vowel; seed: read to the end      |
| 7   | peach | ea   | food     | dog, bus       | pen, leaf    | pen: the short word                                  |
| 8   | seed  | ee   | nature   | cat, cup       | sock, seal   | sock: s and a short vowel                            |

- **Gentle pairs** follow the CVC rule: another category, another first sound, another vowel letter (none has an e). Categories are the pack's (`wordPack.ts`: cup `vessel`, fan `household`, pot `kitchen`, sun `celestial`…).
- **Phoneme tags:** _sheep_ carries `phoneme: '/ʃ/'` (`wordPack.ts:817-824`), and `pickDistractors` throws if a tagged distractor has another phoneme (`wordDistractors.ts:160-181`). Its chips are _ship_ (`/ʃ/`), and _jeep_, _pot_, _map_ (untagged).
- **`BigWordRow.vowel`** is `'e'` for every row (the team's first letter, which says its name).
- **Reserves** if a picture fails twice: _bean_, _beach_ (Dave). A swap changes a row, so it goes back through Dave.
- **Kept out** (Dave): _queen_, _wheel_, _feet_, _teeth_, _cheese_, _tea_, _sweet_.

### 3.3 Intro lead

"Two letters, one sound!" (duck words' text, reused, so no render) plays before P1's silent beat in every forward session until mastered. It reuses duck words' cue: the word's last two cells light together (`'ending-pair'`, `mobile/src/screens/wordSong/introSpotlight.ts:34-38`, `:79-80`). On P1, _bee_, the last two cells are the team. Then the 1500 ms silent beat, then "Read the bee.".

- **Lint:** P1 of each step must end in its team (_bee_, _car_), or the cue lights the wrong cells.
- No cue on the hint (duck words' rule): the letters pulse silently and "Let's look. Bee." plays.

## 4. WS step 20: car words (`car-words`)

### 4.1 The step

As § 3.1, after `bee-words`. **ar says /ɑː/**, and the r changes the vowel (UFLI lesson 77). Lily is British, so _car_ is /kɑː/ with no r sound (`content-wave-1.md:299`).

### 4.2 Word list and chip pairs (canon order)

| P   | Word  | Category  | Gentle (P1–P3) | Trap (P4–P8) | Why the trap (Dave)                               |
| --- | ----- | --------- | -------------- | ------------ | ------------------------------------------------- |
| 1   | car   | vehicle   | dog, pen       | cat, star    | cat: the short word; star: rhyme                  |
| 2   | star  | celestial | hen, cup       | sun, car     | sun: s and a short vowel; car: rhyme              |
| 3   | barn  | structure | fox, pen       | bag, harp    | bag: the short word; harp: the same ar            |
| 4   | cart  | vehicle   | sun, hen       | cat, car     | **cat: cart without the r**; car: read to the end |
| 5   | shark | animal    | pot, bed       | ship, star   | ship: sh and a short vowel; star: the same ar     |
| 6   | scarf | clothing  | dog, bun       | sack, shark  | sack: s and a short a                             |
| 7   | card  | object    | pig, hen       | cap, cart    | **cart: only the last letter differs**            |
| 8   | harp  | object    | fox, bus       | hat, barn    | hat: the short word; barn: the same ar            |

- **Gentle pairs:** as § 3.2, with no a in any of them, and no c or k sound for _car_, _cart_ and _card_.
- **Phoneme tags:** _shark_ carries `/ʃ/` (`wordPack.ts:827-833`); its chips are _ship_ (`/ʃ/`), and _star_, _pot_, _bed_ (untagged).
- **`BigWordCategory`** (`bigWordsSteps.ts:33-44`) gains `'celestial'` (_star_; the pack's _sun_ is `celestial` already). `BigWordRow.vowel` is `'a'` for every row.
- **Never put _bath_ in a car-words trio** (the British /ɑː/, wave 2 § 3.2). **Reserves:** _dart_, _yarn_ (weak: British says "wool"). **Kept out** (Dave): _jar_, _arm_, _farm_, _park_, _tart_.

### 4.3 Intro lead

As § 3.3: "Two letters, one sound!" with the `'ending-pair'` cue; on P1, _car_, the last two cells are a r. In Lily's British English "ar" is one sound, so the line is literally true.

## 5. Per-step chip rows (K4)

**The problem.** `pickDistractors` looks a pair up by word only (`TARGET_PAIRINGS[target.word]`, `packages/core/src/wordSong/wordDistractors.ts:128-129`), and `buildWordChipOrder` has no step (`wordChips.ts:43-54`; `wordRound.ts:260`). _sheep_ and _shark_ already have rows for the sh step: `sheep: { gentle: ['shark', 'shoe'], trap: ['ship', 'shell'] }` and `shark: { gentle: ['ship', 'sheep'], trap: ['shoe', 'shell'] }` (`wordPack.ts:2053-2054`).

- If bee words used that row, sheep's trio would hold _shoe_ and _shell_, which have no pictures, so the problem would draw as written words (`word-song-native.md:200`).
- The land-6 rows are spread into `TARGET_PAIRINGS` by word (`wordPack.ts:2167-2175`). Spreading the new rows the same way would silently overwrite the sh step's two rows.
- The same goes for the pack entries: `sheep` and `shark` already exist (`wordPack.ts:817`, `:827`), and the land-6 spread (`:1148-1158`) would add a second entry for each.

**The rule:**

- **A land-6-format problem carries its own step's row.** The canon adapter attaches the `BIG_WORDS_STEPS` row of the plan's step, and a review keeps it, because it copies the block. `pickDistractors` uses a supplied row instead of the matrix lookup, with every check unchanged (forbidden pairs, distinctness, phoneme). Kevin picks the mechanism; a row on the problem is what holds through reviews.
- **The `TARGET_PAIRINGS` spread skips words that already have a row** (_sheep_, _shark_), and the pack-entry spread skips words that already have an entry. The sh step keeps its rows, its entries, the `/ʃ/` tags and `hybridMode` (planner-only, `api/_plannerWordList.ts`).
- **AC:** a bee-words P4 deals sheep, ship, jeep; the sh step's P5 still deals sheep, ship, shell (§ 12).

## 6. WS step 21: sheep stories (`sheep-stories`)

### 6.1 The step

- **SkillNode `sheep-stories`**, after `car-words`. Default `'locked'`. The Word Song preset (secure = 8/8 on the first tap); no graduation gate.
- **Format: wave 3's exactly** (`content-wave-3.md` § 4.2–§ 4.6): `StoryCard`, decode first, the reading beat (1500 ms a word, 12–21 s), look-back, word taps and the first-card tap cue, the 2nd-wrong read, the scene only after the answer.
- **The one new thing:** the question word changes from story to story. P1–P3 are Who, What, Where, one each, with gentle chips. P4–P8 mix them, in the order What, Who, Where, Who, What, so no two problems in a row ask the same word after P3.
- **Lead:** "Read the story. Who, what or where?" (Dave's; every word is in use: _or_ is in the Hub's "Or pick …" line).
- **Data:** `StoryNode` (`packages/core/src/wordSong/littleStories.ts:15`) gains `'sheep-stories'`; `STORY_NODES` gains it, so warm-ups skip its blocks. Ids `'sheep-1'` … `'sheep-8'`; scenes `mobile/assets/scenes/story-sheep-<n>.webp`. `LittleStory.prep` (`:36-40`) is set on every Where row, not only bug stories. The parser, `littleStoryForText` and the correct-line regex are unchanged.

### 6.2 The 8 stories (binding: the splice writes exactly this)

Each problem also has "Hmm... try again?" (reused) and "This one is the <answer>." (21–22 characters). Correct lines: "Yes! The <answer>!", or "Yes! <In/On> the <answer>!" for Where (14–17). Recap: "You worked on reading stories today!" (reused). Each row: story (characters) → question (characters) → **answer** / wrong chips.

1. "The sheep sat in the jeep. It has a peach." (42) → "Who sat in the jeep?" (20) → **sheep** / jeep, peach
2. "The sheep ran to the barn. A harp is in the barn." (49) → "What is in the barn?" (20) → **harp** / sheep, barn
3. "The sheep has a leaf. It hid in the cart." (41) → "Where is the sheep?" (19) → **cart** (In) / sheep, leaf
4. "The bee has a seed. The sheep has a card." (41) → "What does the bee have?" (23) → **seed** / card, bee
5. "The seal sat on a rock. The sheep ran to the tree." (50) → "Who sat on a rock?" (18) → **seal** / sheep, rock
6. "The sheep sat in the car. The bee is on the tree." (49) → "Where is the bee?" (17) → **tree** (On) / car, sheep
7. "The sheep and the shark sat on the ship. The shark got a peach." (63) → "Who got a peach?" (16) → **shark** / sheep, ship
8. "The sheep has a scarf and a card. A star is on the cart." (56) → "What is on the cart?" (20) → **star** / scarf, card

**Rules** (a splice lint checks them; my scratch check found no breach, 2026-10-18):

- **Taught words only** (wave 3's D2): a target of a Word Song canon file (the 16 new targets once their files exist; _sheep_, _shark_, _ship_ are already sh-step targets), a word read in the sight-words or simple-sentences canon, or _and_, _got_, _hid_ (`scripts/spliceContentWave3Canon.ts:139-169`). No plurals, no -s or -ed endings.
  - **The -ed check needs _seed_ added** to its exemptions, which are _bed_, _shed_ and _red_ today (`spliceContentWave3Canon.ts:189`).
- **Shape:** 2 sentences, 10–14 words; the two 14-word stories sit at P7 and P8. _It_ is always the animal of the sentence before (1, 3). No _she_: in wave 3 _she_ is always the hen.
- **Bee and car words:** every story uses at least 2 of the 16, the sheep is in every story, and each of the 16 appears at least once.
- **Chips:** all three are in the story and have a pack picture, and no trio holds a `FORBIDDEN_PAIRS` pair, old or new (§ 7). Kinds: Who → an animal, What → an object, Where → a place.
  - **P1–P3:** both wrong chips are another kind than the question asks.
  - **P4–P8:** at least one wrong chip is the same kind, so she must read who did what. Story 5 and story 7 are answered by a friend, not the sheep. Story 8 has two same-kind wrong chips, the hardest trio, last.
- **Questions ≤ 23 characters** (the ribbon slot, wave 3 § 4.3).
- **Dave's examples:** example 1 is story 1 verbatim. Example 2 is dropped: it has no sheep, and "What does the seal have?" is 24 characters. Example 3 is dropped: in "A star is on it." the _it_ could be the sheep or the barn (D9).
- **New story words:** 17 (sheep, jeep, peach, barn, harp, leaf, cart, bee, seed, card, seal, tree, car, shark, ship, scarf, star), so `STORY_WORDS` goes from 54 to 71.

## 7. New forbidden pairs

Dave's candidates, added to `FORBIDDEN_PAIRS` (`wordPack.ts:1663`) before the rows are coded: bee–bug, tree–pine, seed–nut, seed–egg, peach–plum, sheep–dog, sheep–pig, sheep–cat, jeep–van, jeep–bus, jeep–car, car–van, car–bus, barn–tent, scarf–belt, card–gift, seal–shark (17). Dave's jar–jam waits for _jar_.

No trio in § 3.2, § 4.2 or § 6.2 contains a forbidden pair, old or new, and every chip word has a picture after § 9 (scratch script, 2026-10-18, not committed).

## 8. Copy / TTS script

### 8.1 Every new spoken line

Canon lines are in § 2.7, § 3.2, § 4.2 and § 6.2.

**Guidance** (`createManifestLinePlayer('session-guide', …)`):

- `guide.session.intro.<node>`: "More and less!" (14) and "Read the story. Who, what or where?" (35). Bee and car words reuse "Two letters, one sound!" (0).
- `guide.session.peek-open.<node>` "Let's look at <name>!" (28 / 24 / 24 / 28); `peek-close` "<Name> are for later. You will learn it!" (47 / 43 / 43 / 47), in the order more and less / bee / car / sheep.
- `guide.session.replay-open.<node>` "Let's play <name> again!" (31 / 27 / 27 / 31); `replay-close` "You know <name>!" (23 / 19 / 19 / 23).
- `guide.story.word.<word>`: 17 clips, 87 characters (§ 6.2's new story words).

**One-word clips are sent to Lily as "Word,"**, and the caption keeps "Word." (`.claude/docs/audio-system.md:65`: "Sat." came back as "Saturday" in #599).

- Today `renderGuidanceLinesLily.ts` sends each line's `text` as it is (`:56-62`, `:85-86`), so the 17 new clips need an input that differs from their caption.
- The 54 shipped clips keep their committed MP3s. Their take-picker picks sit in `tmp/revoice-cache` under the "Word." text, so switching every clip to "Word," would re-bill all 54 and lose the picks.

**Path** (`PATH_LINES`, generated from the names; baked count + 23):

- `path.open` "Here is your path! You are on <name>." (44 / 40 / 40 / 44); `path.stop` "<Name>." (14 / 10 / 10 / 14).
- `path.locked.next` "<Name>! First, <previous>. Then this!" (42 / 41 / 39 / 43); `end.bud` "Look! A new flower for <name>!" (37 / 33 / 33 / 37); `end.unlock` "You learned <previous>! Now you can do <name>!" (51 / 50 / 48 / 52). Previous: hundreds, bug stories, bee words, car words.
- Land 8: "Land 8: Words and stories." (26), "A new land! Land 8: Words and stories!" (38), "A new land: Words and stories!" (30).

**Total: 185 distinct new texts, 4,557 Lily characters.**

| Surface                 | Texts | Characters |
| ----------------------- | ----- | ---------- |
| guidance (peeks, leads) | 10    | 333        |
| replay                  | 8     | 200        |
| path                    | 23    | 816        |
| story-word clips        | 17    | 87         |
| canon `hundreds-addsub` | 39    | 1,349      |
| canon `bee-words`       | 28    | 469        |
| canon `car-words`       | 28    | 469        |
| canon `sheep-stories`   | 32    | 834        |

- **How it was counted:** a scratch script (2026-10-18, not committed) generated every text from this spec and compared it with every `text` in `public/canon/*/level-1/*.json`, the literals in `guidanceLines.ts` and the 54 wave-3 story-word clips. Repeats inside the wave count once.
- **Reused, not billed:** "Hmm... try again?", "Look at the hundreds.", "Look at the tens.", "Two letters, one sound!", both recaps (reading words, reading stories), every `session.end.*` line, and the sh step's 8 lines for _sheep_ and _shark_ ("Read the sheep.", "Yes! That's a sheep.", "Let's look. Sheep.", "This one is sheep.", and shark's 4), which are word for word the bee and car lines.
- **The bill holds only if the bake de-duplicates on exact text** (`revoiceCanonLily.ts` does, as wave 3 relied on); `--dry-run` prints the real number first.
- **Canon is spliced, not Haiku-baked:** `scripts/spliceContentWave4Canon.ts` writes the four files from § 2.7, `BIG_WORDS_STEPS` and `LITTLE_STORIES`; the four nodes join `PENDING_CANON_NODES`. Render: `renderGuidanceLinesLily.ts`, `renderPathLinesLily.ts`, `revoiceCanonLily.ts --unrendered`.

**Prediction for the ear test** (bar 2; Predict-Before-Soak):

- The eight ar words come out British, with no r: "cah", "stah", "bahn", "caht", "shahk", "scahf", "cahd", "hahp".
- "What is two hundred less?" falls at its end, as a wh-question does, with no rise on _less_.
- "Take away two hundreds." keeps its plural s.
- "Read the story. Who, what or where?" pauses at both commas, and _where_ rises.
- None of the 17 "Word," clips expands into a longer word: screened by speech length (`audio-system.md:65`), no clip stands out from the other 16 by 0.1 s or more.

**Bounded convergence:** I rendered and ear-tested nothing. The counts come from a scratch script and the map numbers from a hand calculation. **Not predicted:** whether Lily stresses _less_ or _hundred_ in "two hundred less", and how long _peach_ and _sheep_ hold their /iː/.

### 8.2 Vocabulary check (the ~200-word cap)

- **1 new core word:** _less_ (no committed canon or guidance line contains it, 2026-10-18). _more_, _hundred(s)_, _take_, _away_, _who_, _what_, _where_, _or_, _does_, _have_, _words_, _stories_ are in use. About 176 → 177 (Dave's count).
- The 16 bee and car words are targets; _ship_ is an sh-step target. All ASCII-7 except the on-screen "−", which is never spoken.

## 9. Pictures: 17 words and 8 scenes (OpenAI)

**17 new pack pictures:** the 16 targets and _ship_ (sheep's trap). None is in `mobile/assets/pictures/` (89 WebPs, `ls` 2026-10-18) or in `design/word-song/picture-manifest.json` (89 entries). Every other chip is an existing picture. _ship_, _sheep_ and _shark_ also give the sh step its first pictures (D8).

**Cost**, at the rates the ledgers record (read in the tools worktree on 2026-10-18; the ledgers are gitignored, `.gitignore:63`):

- **Words:** $0.0776 a call (90 calls, $0.0774–0.0781 each, n = 2), so 17 × $0.0776 ≈ **$1.32**. Wave 2's 16 words cost $1.24 with no retakes.
- **Scenes:** $0.127 with 3 references, $0.143 with 4 (28 wave-3 calls). § 9.2 has 3 three-reference and 5 four-reference scenes, ≈ **$1.10**.
- **Total ≈ $2.42**, or about **$3.01** with a second round on 4 words (seed, peach, card, harp: +$0.31) and 2 scenes (sheep-7, sheep-8: +$0.29). Dave's ~$2.60 used $0.10 a word and $0.11 a scene. Wave 3's scene estimate used the same $0.11 and came in at $3.73 for 28 calls, so the ledger rate is the one to trust. `--dry-run` prints the real figure.
- **If a word fails its second round, stop and tell Matt;** a swap goes back through Dave (reserves in § 3.2 and § 4.2).
- **Don't append to either manifest before T4:** the generator reads the whole file.

### 9.1 The 17 manifest entries (batches 11 and 12, riskiest first)

Entries `{ word, tier, batch, subject, avoid, distinctFrom }`. Batch 11 holds the bee words and _ship_ (tier `digraphs-sh`); batch 12 the car words.

| Batch | Word  | Subject                                                                                                                                              | Avoid                                                                       |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 11    | seed  | One big sunflower seed on its own, drawn large: a teardrop shape with dark-grey and cream stripes along its length.                                  | a sprout or a plant; a pile of seeds; a round brown nut; a plain egg        |
| 11    | peach | One round peach with a soft orange-pink blush, a crease down one side and a short brown stem, no leaf.                                               | a plum (purple); a red apple; a cut half with a stone; a bite               |
| 11    | ship  | A small sailing ship in side view: a warm-brown wooden hull, one tall mast with two cream sails and a small rose flag, on a thin line of blue water. | a rowing boat with no sails; big waves; people; marks on the flag           |
| 11    | leaf  | One big green leaf: an oval with a pointed tip, a centre vein and side veins, and a short stem.                                                      | a branch or a tree; several leaves; a feather                               |
| 11    | seal  | A grey seal lying on its tummy, head up: round dark eyes, whiskers, two front flippers.                                                              | a ball on its nose; a fin like a shark's; water splashes                    |
| 11    | jeep  | An open-top jeep in side view: a sturdy green body, a flat bonnet, a spare wheel on the back and two big black tyres.                                | a roof; a van, a bus or a car shape; a driver; jeepney paint or words       |
| 11    | sheep | A fluffy sheep in side view: a round cream fleece of soft curls, a dark-grey face and ears, and four thin dark legs.                                 | a goat's horns or beard; a lamb with its mother; a dog; a cloud shape       |
| 11    | tree  | One round leafy tree: a brown trunk and a big round green crown.                                                                                     | a pointed pine; fruit (the apple-tree land art); a forest                   |
| 11    | bee   | One honeybee seen from above at a slight angle: a round golden body with three brown stripes, two clear wings and short antennae.                    | a beehive; a ladybird or a beetle; a big smiling face; flowers              |
| 12    | card  | One folded greeting card standing open: cream, with a big rose-red heart on the front.                                                               | a wrapped present or a bow; an envelope; letters or numbers; a playing card |
| 12    | harp  | A small golden harp in side view: a curved wooden frame in a rough triangle and about eight thin strings.                                            | a person playing it; a guitar or a lyre; music notes                        |
| 12    | scarf | One knitted scarf in soft rose with cream stripes, lying in a loose S curve, with a short fringe at both ends.                                       | a person wearing it; a buckle like a belt; a flat mat; a towel              |
| 12    | cart  | A wooden hand cart in side view: an open box of warm-brown planks, two big spoked wheels and two long handles.                                       | a horse or a person pulling it; a shopping trolley; a car; a load           |
| 12    | barn  | A red farm barn in front view: a tall pointed roof, a big double door with white diagonal braces and a small round window above it.                  | a house with a chimney; a tent; animals or a farmer; a silo                 |
| 12    | star  | One plump five-pointed star with soft rounded points, warm gold.                                                                                     | rays or a face like the sun picture; a starfish; several stars; a sky       |
| 12    | shark | A grey shark in side view: a pointed nose, a tall back fin, a white tummy and a closed, gently smiling mouth.                                        | sharp teeth or blood; a dolphin; whiskers; water splashes                   |
| 12    | car   | A small rose-red car in side view: a rounded roof, two windows and two black tyres.                                                                  | a long van or bus body; an open top like the jeep; a driver; a number plate |

**`distinctFrom`** (the manifest's rule, `design/word-song/picture-manifest.md:18`: forbidden partners first, then trio mates A–Z; pack words only). It counts the 16 new rows and the sh step's rows for ship, sheep and shark, whose targets become pictured:

- **seed:** egg, nut; cat, cup, seal, sock, sun · **peach:** plum; bus, dog, leaf, pen · **ship:** tub; jeep, shark, sheep, sip, star
- **leaf:** box, hat, leg, peach, pen, seal · **seal:** shark; cap, leaf, leg, mop, seed, sock, sun · **jeep:** bus, car, van; jet, pig, sheep, ship, sun
- **sheep:** cat, dog, pig; jeep, jet, map, pot, shark, ship, sip · **tree:** pine; bed, bee, cap, dog, tent · **bee:** bug; bed, cup, fan, tent, tree
- **card:** gift; cap, cart, hen, pig · **harp:** bag, barn, bus, fox, hat · **scarf:** belt; bun, dog, sack, shark
- **cart:** cap, car, card, cat, hen, sun · **barn:** tent; bag, fox, harp, hat, pen · **star:** car, cat, cup, hen, shark, ship, sun
- **shark:** seal; bed, pot, sack, scarf, sheep, ship, star · **car:** bus, jeep, van; cart, cat, dog, pen, star, sun

**Symmetry edits to existing entries** (forbidden partners first):

- **belt:** scarf · **bug:** bee · **egg:** seed · **gift:** card · **nut:** seed · **pine:** tree · **plum:** peach · **tub:** ship · **van:** car, jeep
- **bus:** car, jeep (forbidden); harp, peach · **cat:** sheep (forbidden); car, cart, seed, star · **dog:** sheep (forbidden); car, peach, scarf, tree
- **pig:** sheep (forbidden); card, jeep · **tent:** barn (forbidden); bee, tree
- bag: barn, harp · bed: bee, shark, tree · box: leaf · bun: scarf · cap: card, cart, seal, tree · cup: bee, seed, star · fan: bee · fox: barn, harp
- hat: barn, harp, leaf · hen: card, cart, star · jet: jeep, sheep · leg: leaf, seal · map: sheep · mop: seal · pen: barn, car, leaf, peach
- pot: shark, sheep · sack: scarf, shark · sip: sheep, ship · sock: seal, seed · sun: car, cart, jeep, seal, seed, star

`picture-manifest.md` gets the tiers `bee-words`, `car-words` and `digraphs-sh`, and batches 11 and 12; the build check's word set grows from 89 to 106.

### 9.2 The 8 scenes (`generatePackPictures.ts --scenes`)

Appended to `design/word-song/scene-manifest.json` as tier `sheep-stories`, batch 4, with wave 3's `SCENE_RULES` and the approved pack PNG of each `refs` word (≤ 4). Output: `mobile/assets/scenes/story-sheep-<n>.webp`, 600 px, with a contact sheet for Thomas.

- **sheep-1** [sheep, jeep, peach]: The sheep sitting in the open-top jeep, a peach on the seat beside it. _Avoid:_ a driver.
- **sheep-2** [sheep, barn, harp]: The sheep running to the red barn; through its open doors, a small harp inside. _Avoid:_ other farm animals.
- **sheep-3** [sheep, leaf, cart]: The wooden hand cart; the sheep hiding in it, peeking over the side, holding a green leaf. _Avoid:_ a horse or a person.
- **sheep-4** [bee, seed, sheep, card]: The bee holding a big striped seed; beside it, the sheep holding an open card. _Avoid:_ flowers; the bee with the card.
- **sheep-5** [seal, rock, sheep, tree]: The seal lying on a grey rock in front; behind, the sheep running to a round tree. _Avoid:_ water; the sheep on the rock.
- **sheep-6** [sheep, car, bee, tree]: The sheep sitting in the rose-red car; beside it, the bee on a round tree. _Avoid:_ the bee in the car.
- **sheep-7** [sheep, shark, ship, peach]: The sheep and the shark sitting side by side on the deck of the small sailing ship; the shark holds a peach. _Avoid:_ the shark in the water; the sheep with the peach.
- **sheep-8** [sheep, star, scarf, card]: A wooden hand cart with a gold star on it; beside it, the sheep in a rose scarf, holding an open card. _Avoid:_ the star in the sky; the sheep on the cart.

**Riskiest, a second round expected:** sheep-7 (a shark out of the water) and sheep-8 (the cart comes from the text alone, because the 4-reference limit goes to the chips). If a scene fails twice, the step still ships: a missing scene shows the answer's pack picture (wave 3 § 4.2).

The 5 clay pieces (§ 1) are made as the clay set was, with Thomas's tool.

## 10. States and edge cases

- **Error path:** poof, shake, `puzzled-tilt`, "Hmm... try again?"; hints at 2 wrongs, the given answer at 3. Never a red X.
- **First visit:** the land beat (Word Song), then the lead before P1 of each forward session until mastery.
- **Peek:** P1–P3 with opener and closer, no lead, nothing written. More and less: the blocks move on the read (P1–P3 always do). Bee words: bee, tree, leaf. Car words: car, star, barn. Sheep stories: a story runs in full, with the reveal.
- **Review, replay:** the canon blocks in full. A bee or car block keeps its own step's chip row (§ 5). Story blocks never as hearts.
- **Background, rotation:** as hundreds and wave 3's stories; a lift-out in flight lands in its end state.
- **Missing assets:** a missing pack picture draws the problem as written words (the shipped fallback); a missing scene shows the answer's picture; a missing word clip lights the word silently.
- **Ship order:** `yarn release` before the device check (the server learns the four nodes then). No guard prerequisite this wave.

## 11. Wiring checklist (Kevin, Devon)

- **`sibling-tier-checklist.md`:** all four nodes rows 1–10 and 12; the three Word Song nodes also row 11 and rows 13–15; `hundreds-addsub` instead `VALID_MATH_FOCUS_NODES` and `MATH_FOCUS_NODES`; row 16 skipped (the web is frozen). From "does not cover": the math read template (8/8), `CANON_FILES` in `public/voice-qa.html` (+4 stems; the list is hard-coded at :641), the committed canon, e2e seeds ending at `hundreds` or `bug-stories`.
- **Names:** `STAGE_SPOKEN_NAMES`, `STAGE_SPOKEN_NAME_VERBS`, `FRIENDLY_NODE_NAMES`, the recap list in `api/_planner.ts`, `scripts/recapFocusCopy.ts`.
- **Map, lines:** `LANDS` (land 5 + 1 node, + land 8), `PATH_LINES` (+23 baked), `PATH_ART_SET` (+4), `LandArtId` (+1), `GUIDANCE_LINES`: peeks 8, leads 4, replays 8, story words 17, so ids 221 → 258.
  - `guidanceLines.test.ts:54-56` asserts one text per id (221 = 221). Bee and car words share duck words' lead text, so after this wave texts = 256 while ids and srcs = 258.
- **Math:** `MoreProblem` `count` and `direction`, the widened template, `hundredsDistractors` and `hundredsOfferedClass` for § 2.6, `HundredsOfferedClass` + `'wrong-op'`, `CANON_MATH_FACTS`. `PlaceValueStage`: many-block drops without pills, the lift-out, "−" pills, the "?" tag on the changed tray, the lead's pill pulses.
- **Word Song:** `BIG_WORDS_STEPS` + 2 steps, 16 rows (`BigWordsStep`, `BIG_WORDS_STEP_IDS`); `BigWordCategory` + `'celestial'`; § 5's per-step rows and the two spread skips; `wordPack.ts` + 14 entries (not sheep or shark), 17 `FORBIDDEN_PAIRS`; `_plannerWordList.ts`, `bigWordsCanonCheck.ts`; `introSpotlight.ts` `PATTERNS` + the two leads as `'ending-pair'`; `wordDistractors.test.ts`' CVC-axis treatment for the new rows.
- **Stories:** `StoryNode`, `STORY_NODES`, 8 `LITTLE_STORIES` rows (a `sheep` row builder), `storyMarks.generated.ts`, the scene registry, the "Word," render input for the 17 new clips (§ 8.1).
- **Canon, pictures:** `spliceContentWave4Canon.ts` (with the _seed_ exemption, § 6.2), `PENDING_CANON_NODES` + 4, both manifests after T4.
- **Unchanged on purpose:** `isLeitnerDirectiveActive`, `MULTIPLICATION_FOCUS_NODES`, `MIX_SOURCE_STEPS`, `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES`, the celebration exceptions, the sh step's `TARGET_PAIRINGS` rows and entries, `EXTENDED_ANSWER_MAX`, the progress guard.

## 12. Acceptance criteria

**Core (vitest):**

1. P1 parses to `{ kind: 'more', start: 235, step: 100, count: 2, direction: 'more', correct: 435 }`; P7 to `{ start: 765, step: 10, count: 3, direction: 'less', correct: 735 }`. Hundreds' P6 still parses with `count: 1, direction: 'more'`. Rejected: "Two hundred and thirty-five. What is fifty more?" (not a change word), "Three hundred and forty-two. What is forty less?" (302, a zero in the answer), "Three hundred and twenty-four. What is thirty less?" (regroups), "Eight hundred and twelve. What is two hundred more?" (past 999), "Two hundred and four. What is ten more?" (a zero in the start). Without `extendedKinds` it throws.
2. `hundreds-addsub.json` equals § 2.7 (8/8 parse); `hundredsDistractors` returns § 2.7's chips and classes; hundreds' chips are unchanged.
3. A more-and-less session-end write has no `mathFacts`, keeps the 3-digit taps, records § 2.7's classes and loads back.
4. `BIG_WORDS_STEPS['bee-words']` and `['car-words']` equal § 3.2 and § 4.2; no trio holds a forbidden pair; the 17 pairs exist; every picture key resolves through native `pictureAsset`.
5. **Per-step rows:** a bee-words P4 deals sheep, ship, jeep and a car-words P5 deals shark, ship, star; the sh step's P5 still deals sheep, ship, shell and its P6 shark, shoe, shell; a review block keeps its step's row; `getWordEntry('sheep')` still has `phoneme: '/ʃ/'`.
6. `LITTLE_STORIES` holds § 6.2's 8 rows and passes the lint (taught words, shape, chips, prep on Where rows); `sheep-stories.json` parses 8/8; `STORY_WORDS` has 71 words.
7. `pickWarmupBlocks` never returns a sheep-story block.
8. 5 Number Garden lands (land 5 with 2 nodes), 8 Word Song lands; `GUIDANCE_LINES` and `PATH_LINES` hold § 8.1's texts; baked path lines + 23; spoken names unique.
9. `hundreds` mastered, no `hundreds-addsub` key → `'intro'`; `bug-stories` mastered, no new keys → `bee-words: 'intro'`, the other two `'locked'`.

**Native (jest):**

10. More and less P1: two flats drop in on the tick of "more", 90 ms apart, with no pill of their own; the "+200" pill is up from the first frame; the hundreds tag reads "?" and the tens and ones tags 3 and 5; a right tap ticks the tag to 4 and the number tag to 435 as its pill fades.
11. P6: two flats lift out on "less"; P7: nothing moves on the read, and hint 2 lifts three rods; the given answer moves the blocks at once and rings the "?" tag.
12. Bee words and car words P1: the lead lights the last two cells together; no lead on P2–P8, in reviews, peeks or hearts.
13. Sheep stories P1–P8 follow wave 3's story ACs (beat, look-back, wrongs, reveal, word taps); the lead plays once before P1; Reduce Motion gives § 2.5's bracketed forms.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP`):

14. Each new step: Emma speaks every line; at 375×667 and 667×375 nothing leaves its rect; the lift-out reads as blocks going away, not a glitch; bee and car words show three pictures on every problem.
15. Map at 375×667, 744×1133, 820×1180 portrait and 1133×744, 1180×820 landscape: 5 and 8 lands, no overlaps, the current stop in view on open, scrolling where § 1 predicts.
16. The sh step, played from the QA picker after the pictures land: P8 (ship) shows three pictures, the other problems written words (D8).

## 13. Thomas decides

- **T1. Names:** "more and less" (id `hundreds-addsub`), "bee words", "car words", "sheep stories"; "Land 8: Words and stories". Recommendation: approve.
- **T2. Lily budget (§ 8.1):** 185 texts, **4,557 characters**, chiefly the two leads ("More and less!", "Read the story. Who, what or where?"), the "Take away two hundreds." hint form and 17 one-word clips sent as "Word,". Recommendation: approve.
- **T3. 5 clay pieces (§ 1):** a seesaw, a bee, a toy car, a sheep, a windmill. The look is judged when they are made. Recommendation: approve the subjects.
- **T4. Picture spend (§ 9):** 17 pictures and 8 scenes, about **$2.42**, about **$3.01** with retakes, after an OpenAI top-up if the balance needs one. Recommendation: approve; the scenes come only after the bee and car contact sheets are approved.
- **T5. Dave's check at land 7:** does she answer the story questions on her first tap? If she often doesn't, sheep stories play in question-word stretches: canon order 1, 5, 7 (Who), 2, 4, 8 (What), 3, 6 (Where). Only the splice order changes. Recommendation: build mixed now and reorder only on the check.
- **T6. Map:** 8 Word Song lands scroll on portrait (the shipped rule), and the 1133×744 landscape form is predicted to start scrolling too. Recommendation: approve now, so a failed bar doesn't stall the build.

## 14. Pedagogy assumptions for Dave (D1…)

- **D1.** More and less: the start number, its pill and the unchanged trays' digits show from the first frame, and the changed tray's tag shows "?" until her answer (your assumption, kept). The lead is "More and less!", with the pill pulsing on both words.
- **D2.** Fading as you set it: the blocks move on the read in P1–P3 and P6, at hint 2 otherwise. The hint ladder: "Look at the tens." → "Three more tens." / "Take away three tens." (the blocks move) → the question again. _Take away_ is already in the take-away canon ("Take away three. How many now?").
- **D3.** Chips: the second trap is always the digit swap; "wrong place" is the next place down (tens → ones, hundreds → tens); the recorded class is the first trap's.
- **D4.** The "−" in the pill is the first minus in the place-value steps (the take-away equations already show it).
- **D5.** The 16 gentle pairs in § 3.2 and § 4.2 are mine, by the CVC rule (another category, first sound and vowel letter); your traps are verbatim.
- **D6.** Bee and car words reuse "Two letters, one sound!" with duck words' last-two-cells cue on P1 only, and no cue on the hint.
- **D7.** _sheep_ and _shark_ keep their sh-step chips in the sh step and take your rows in bee and car words (§ 5).
- **D8.** Once _ship_, _sheep_ and _shark_ have pictures, two sh-step trios are fully pictured: ship's trap trio (ship, sip, sheep; P8 in a forward session) and shark's gentle trio (shark, ship, sheep; only when a review puts shark at P1–P3). Those problems become picture problems; the rest stay written words (`word-song-native.md:200`). Recommendation: accept, since the sh step was designed for pictures (`:209`).
- **D9.** The 8 sheep stories are mine (§ 6.2): your example 1 verbatim; example 2 out (no sheep, and its question is 24 characters); example 3 out (its _it_ could be the sheep or the barn). P4–P8 run What, Who, Where, Who, What. No _she_.
- **D10.** Story 8 has two same-kind wrong chips (star / scarf, card), the hardest trio, placed last.
