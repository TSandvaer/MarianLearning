# Real blending: Word Song land 2, two stops (native)

**Status:** spec only. Thomas approved Dave's plan by popup on 2026-10-19 (§ 16): T1 stop 2 is "sounding out", T2 Lily up to 1,000 characters, T3 a xylophone clay piece, T4 the migration, T5 letters only until the right tap.

**Source:** Dave's research note, PR #628, `design/research/real-blending-land-2-2026-10-19.md` on `origin/dave/real-blending` (1397a8f). His § 1–§ 12 are the plan. This spec makes them buildable, and the changes it makes are listed under Decisions with their reasons.

**Scope:** `@marian/core` (a SkillNode, two content types, the parser, a migration rule), the server lists, canon (a splice, no Haiku bake), the native Word Song screen, one clay piece. The web is frozen: the two new reads throw there and the web plays its silent static plan (`content-wave-1.md` § 1.9).

**Who it is for:** any learner of about 6 to 9 who has learned letter sounds (`CLAUDE.md` "Users" line). Marian is one user. Nothing here depends on one learner's school, language or history. A Danish version is planned, so every spoken and written word is in a table (§ 11, § 12).

**Out of scope:** code, renders, the clay generation, test runs. Also out: land 3 (cvc-words keeps its picture card and "Read the <word>."), connected (unsegmented) blend clips, and the planner's Haiku prompt (§ 7).

## Goal

The learner joins three heard sounds into a word (stop 1), then makes the sounds from the letters and joins them (stop 2), before reading words in land 3.

## User state entering

- **Stop 1 (`blending-cv`):** letter sounds mastered. The Map plays the shipped "You learned letter sounds! Now you can do blending sounds!" and the land-2 beat.
- **Stop 2 (`sounding-out`):** blending sounds mastered. The Map plays the new "You learned blending sounds! Now you can do sounding out!".
- **cvc-words:** sounding out mastered. Its unlock line changes (§ 11); land 3's beat is unchanged.
- **A learner on `blending-cv` when the build lands** keeps its level and good days. Their next session is the new format, opened by its lead.
- **A learner past land 2 when the build lands** has `sounding-out` stored as mastered on load. Nothing plays and their current step doesn't move (§ 9).

## Decisions

Approved by Thomas (§ 16): the names, the budget, the clay subject, the migration, the look. Dave's design stands except for these changes, each needed to build it:

1. **The migration also marks the stop celebrated, and repairs one older-build case.** The Map's unlock beat fires for any open step missing from `unlocksCelebrated`, a mastered one included (`packages/core/src/progress/pathBeats.ts:76-94`). So, without the mark, a migrated learner would hear "You learned blending sounds! Now you can do sounding out!" at their next Word Song session end (`App.tsx:488` opens the Map on a pending unlock). A stored `'locked'` behind a mastered `blending-cv` is also filled `'mastered'`: only a build without the step can write that pair, and it would strand the learner (§ 9).
2. **One defaulter, not two.** `cloudSync.ts` imports `withDefaultedSkillLevels` from `storage.ts` (`cloudSync.ts:53-58`, called at `:538`), and its comment says the local load and the cloud install "run this one function" (`storage.ts:187-188`). Dave and `content-wave-1.md` § 5.3 say "its copy". There is one edit.
3. **"What is it?" is routed before the story parser.** The native app parses with `littleStories: true` (`mobile/src/session/wordSongSession.ts:72`), and the story read pattern `/^(Who|What|Where)\b[^?]*\?$/` (`packages/core/src/wordSong/planFromServer.ts:323`) matches "What is it?". The story branch runs first (`:515`). It would reject the problem on its correct line, and that fails the whole plan into the silent fallback. The two new reads sit behind a native-only option and are checked first (§ 8).
4. **`blending-cv` joins `PENDING_CANON_NODES` too.** It is a bake target today (`scripts/generateSessionCanon.ts:334-337`), so a `--force` bake would overwrite the spliced file with Haiku's "Tap the <word>." (`combosToBakeFor`, `:427-438`).
5. **Stop 2's lead reuses crab words' spotlight.** Dave asked for a new left-to-right sweep. `introSpotlight.ts` already has it as `'left-to-right'`: cells light 150 ms apart with the lit pulse, and all at once under Reduce Motion (`mobile/src/screens/wordSong/introSpotlight.ts:15-17`). That is one map entry and no new pattern.
6. **The letters don't move at the reveal.** The picture's slot is kept empty from the first frame, and the picture springs into it. Dave slid the letter row down 200 ms. Keeping the row still means the letters the learner just decoded stay where their eyes are. It also means no new motion: the picture's shipped entrance is the reveal (§ 5).
7. **The revealed picture is inert.** A solved card closes its taps (`tapsOpen = readAloudPlayed && !problemState.resolved && !speaking`, `mobile/src/screens/wordSong/WordSong.tsx:1091`), so Dave's "a tap on the picture says the word" never applies after the answer. The word–picture link is "Yes! That's a fan." over the picture.
8. **"Listen." goes to Lily as "Listen,"** under the one-word rule (`.claude/docs/audio-system.md:65`). Canon lines have no input field, so `renderElevenLabsText` gets a one-entry map (§ 11).
9. **Ship order: devices first, then `yarn release`.** This build changes a shipped step's canon. After the release an older build meets "Listen." and can't parse it (§ 10).
10. **The map size doesn't change, but lands 3 and up are mirrored** (§ 2). Dave's "changes neither" holds for size, not direction.

## 1. Steps, land, names, path art

| Step                       | After           | Land, stop         | Spoken name     | Verb | Recap phrase    | Hub label       | Canon file                                      |
| -------------------------- | --------------- | ------------------ | --------------- | ---- | --------------- | --------------- | ----------------------------------------------- |
| `blending-cv` (new format) | `letter-sounds` | WS 2 Blending, 1/2 | blending sounds | is   | blending sounds | blending sounds | `word-song/level-1/blending-cv.json` (replaced) |
| `sounding-out` (new)       | `blending-cv`   | WS 2 Blending, 2/2 | sounding out    | is   | sounding out    | sounding out    | `word-song/level-1/sounding-out.json` (new)     |

- **`LANDS`** (`packages/core/src/progress/lands.ts:61`): land 2 becomes `{ world: 'word-song', number: 2, name: 'Blending', nodes: ['blending-cv', 'sounding-out'] }`. No land number or land name changes.
- **`cvc-words`' tree predecessor** becomes `sounding-out` (`LITERACY_TREE`, `mastery.ts:176`; `WORD_SONG_NODES_IN_ORDER`, `focusNode.ts:126`).
- **"sounding out"** is what teachers and parents call it ("sound it out"), so a learner can name the strategy. It adds two spoken words, _sounding_ and _out_ (T1).
- **The id** names the act, as `letter-sounds` does. `blending-cv` keeps its id, so no stored key moves.

**Clay piece** (`content-wave-1.md` § 5.4's pipeline: source PNG → `scripts/build-path-art.ts` → `public/assets/path/sounding-out-256.webp` and `-512.webp` → `npm run export-assets` in `mobile/` for the `-muted` and `-locked` copies; no letters, digits or signs):

| Id             | Subject                                                                                                                                                                                  | Must not look like                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sounding-out` | A small toy xylophone: a warm-brown wooden frame holding three bars in a row (rose, cream, green, longest on the left), and one wooden mallet with a round rose head resting across them | the ear with sound waves (`letter-sounds`), the two puzzle pieces (`blending-cv`), the two joined notes (`land-ws-2`), the block tower (`land-ws-1`), the abacus (`add-two-digit`, wave 5), the harp and drum pack pictures |

Three bars stand for the three sounds, and the mallet for the learner's own taps. Subjects in use: `design/emmas-path/emmas-path-spec.md` § 5.2–§ 5.3, `content-wave-5.md` § 1; harp and drum are pack pictures (`mobile/assets/pictures/harp.webp`, `drum.webp`). Made as the clay set was, with Thomas's tool and `blending-cv`'s piece as the style reference (T3). `PATH_ART_SET` + 1 (`packages/core/src/emmasPath/pathArt.ts:55`); `pathArt.test.ts` fails until both files exist.

## 2. Map fit: land 2 with two stops

- **Size: unchanged.** The height comes from the land count (`landscapeNeed`, `packages/core/src/map/mapLayout.ts:303-311`), which stays 8 (9 if wave 5's #617 merges first). The stop spacing comes from the widest land (`:193`), which is Words with 5 stops. So the stop size, band height and scroll rules on all five checked viewports are as today.
- **Direction: lands 3 and up are mirrored.** The path is a serpentine, and a one-stop land doesn't turn (`:246-247`, `:260`). Today land 2's one stop sits at the right edge and land 3 enters from the right. With two stops, land 2 runs from right to left: `blending-cv` at the right edge, `sounding-out` at the left (`xOf('right', k, 2)`, `:223-228`). Land 3 then starts on the left. Every Word Song land from 3 up is drawn mirrored, and its gate and land pill move to the other side. Nothing is added or resized, and Number Garden is untouched.
- **What the learner notices:** a returning learner's path from land 3 up runs the other way, and their current stop is scrolled into view on open (shipped). No line refers to left or right.
- **Tests:** the Word Song stop counts in `packages/core/src/map/mapModel.test.ts:66` gain one in land 2 (23 stops on `main` at a01b5f5 → 24). Any layout test that pins Word Song stop x positions flips with them. That is the change, not a regression.

## 3. What the learner sees

The card is the shipped picture card with the picture unmounted until the answer. The letter row sits where the picture card puts it (P, 8 pt, the row), and the P × P slot above it is empty: nothing is drawn there, no outline and no "?". Chips are the shipped picture chips. Sizes are `word-song-native.md` § 2: P = 160 / letters 72 (phone portrait), 130 / 56 (phone landscape, 109 with a home indicator), 180 / 96 (tablet).

`{fan}` = the fan picture. `[f]` = a lit letter (rose spotlight behind the dark glyph).

**Phone portrait 375×667, stop 1 P1, during the sounds:**

```
+------------------------------+
| [<]            ✦3 (★ 12)     |
| ◉ ○ ○ ○ ○ ○ ○ ○              |
| (Emma ) +------------------+ |
| (147  ) | f - a            | |  caption walks with the sounds;
| point-  |                  | |  never shows the word
| ing     +------------------+ |
|                              |
|        (160 × 160 slot,      |  empty: nothing drawn
|         nothing drawn)       |
|                              |
|        [f]  [a]   n   (72)   |  f, a lit and held; n not yet
|  {fan}    {dog}    {bus}     |  103 pt picture chips, closed
+------------------------------+
```

**Phone portrait 375×667, stop 1 P1, after the right tap:**

```
+------------------------------+
| [<]            ✦3 (★ 12)     |
| ◉ ○ ○ ○ ○ ○ ○ ○              |
| (Emma ) +------------------+ |
| (147  ) | Yes! That's a    | |
| celeb-  | fan.             | |
| ration  +------------------+ |
|       +------------+         |
|       |   {fan}    |         |  springs into the slot (260 / 16)
|       |    160     |         |
|       +------------+         |
|        [f]  [a]  [n]         |  all three lit; the row has not moved
|  {fan}*   {dog}    {bus}     |  * sparkle burst on the tapped chip
+------------------------------+
```

**Phone landscape 667×375, stop 2 P3 (mat), after "What is it?", the learner has tapped m:**

```
+-----------------------------------------------------+
| [<]      | ● ● ◉ ○ ○ ○ ○ ○        ✦3 (★ 12) | {mat}  |
|          | +-------------------------------+ |  104   |
| ( Emma ) | | What is it?                   | |        |
| ( col  ) | +-------------------------------+ | {pen}  |
| ( 160  ) |     (130 × 130 slot, empty)       |  104   |
|          |                                   |        |
|          |        [m]   a   t    (56)        | {dog}  |
+-----------------------------------------------------+
```

m is lit for its sound (at least `TAP_LIGHT_MIN_MS` = 400, `WordSong.tsx:210`), then dark. The chip column is shuffled as shipped. The table order in § 6 is correct-first, not screen order.

**iPad portrait 820×1180, stop 2 P5 (can), after the right tap:**

```
+----------------------------------------------+
| [<]   ● ● ● ● ◉ ○ ○ ○           ✦3 (★ 12)    |
|                                              |
|  ( Emma )  +-----------------------------+   |
|  ( 26vh )  | Yes! That's a can.          |   |
|            +-----------------------------+   |
|                 +----------------+           |
|                 |     {can}      |           |  180 pt
|                 |                |           |
|                 +----------------+           |
|                  [c]   [a]   [n]   (96)      |
|                                              |
|     {fan}          {can}*         {man}      |  112 pt chips, 24 pt gaps
+----------------------------------------------+
```

**iPad landscape 1180×820, stop 1 P5 (cat), during the sounds:**

```
+----------------------------------------------------------------+
| [<]   ● ● ● ● ◉ ○ ○ ○                          ✦3 (★ 12)       |
|  ( Emma  )  +---------------------------------------------+    |
|  ( point-)  | c - a                                       |    |
|  (  ing  )  +---------------------------------------------+    |
|                        (180 × 180 slot, empty)                 |
|                                                                |
|                        [c]   [a]    t    (96)                  |
|          {bat}            {cap}             {cat}              |  closed
+----------------------------------------------------------------+
```

The worst-case tablet stage (iPad mini landscape 1133×744) fits the card at 300 of 325 pt (`word-song-native.md` § 2). The empty slot is part of that 300, so nothing new needs room.

## 4. Beats, problem by problem

Shipped rules hold unless named: the chips open when the read ends; a wrong tap gets poof, shake, `puzzled-tilt` and "Hmm... try again?"; the 2nd wrong's prompt starts 600 ms after the reprompt ends; the 3rd wrong gives the answer with the guided glow, and only that chip stays tappable; the advance comes after max(1.2 s, "Yes!") with a 4 s ceiling (`word-song-native.md` § 5, `WordSong.tsx:1-20`). Letters are inert while Emma speaks and once the problem is solved. No timer, no speed signal. **Never a red X.**

**Stop 1, `blending-cv` (`'listen-blend'`): Emma says the sounds, you find the word.**

| Beat                                      | She hears                                                                             | She sees                                                                                                                                                                | Emma                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Lead (scored P1, forward, until mastered) | "The sounds make a word!", then 400 ms                                                | the card (letters, empty slot); no spotlight                                                                                                                            | as for every lead    |
| Read                                      | "Listen.", then 300 ms                                                                | caption "Listen."                                                                                                                                                       | `listening`          |
| The sounds                                | the blend clip from 0 to `soundsCutMs` = `segments[2][1]` + 80 ms: "f… a… n", no word | letter k lights at `segments[k][0]` − 40 ms and **stays lit**; caption "f - a - n" revealed on the same marks; at the cut all three go dark (200 ms) and the chips open | `attentive-pointing` |
| Waiting                                   | a letter tap plays its own sound (shipped tap-to-hear)                                | the tapped letter lights for its sound                                                                                                                                  | idle                 |
| Wrong 1                                   | "Hmm... try again?"                                                                   | poof, shake                                                                                                                                                             | `puzzled-tilt`       |
| Wrong 2                                   | the **whole** clip, "f - a - n ... fan"                                               | one letter lit at a time, all three on the word (shipped `litAt`)                                                                                                       | `attentive-pointing` |
| Wrong 3                                   | "This one is fan."                                                                    | the guided glow on the fan chip                                                                                                                                         | as shipped           |
| Right (or the guided tap)                 | sparkle + plink, "Yes! That's a fan."                                                 | the picture springs into its slot; all three letters lit until the advance                                                                                              | `celebration`        |

**Stop 2, `sounding-out` (`'sound-out'`): you make the sounds, you find the word.**

| Beat                                      | She hears                                                 | She sees                                                                                                                         | Emma                 |
| ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Lead (scored P1, forward, until mastered) | "Tap the letters. Hear the sounds!", then 400 ms          | crab words' spotlight: cell k lights k × 150 ms after the line starts, with the lit pulse; all go dark 200 ms after it ends      | as for every lead    |
| Read                                      | "What is it?"                                             | caption "What is it?"; the chips open when it ends. No silent beat: the read never says the word, so there is nothing to protect | `listening`          |
| Letters                                   | each tap plays that letter's sound                        | the tapped letter lights. Live from the card's first frame whenever Emma is silent. A tap is not a move and is not recorded      | idle                 |
| Wrong 1                                   | "Hmm... try again?"                                       | poof, shake                                                                                                                      | `puzzled-tilt`       |
| Wrong 2                                   | the sounds, cut before the word: "m… a… t"                | stop 1's read support: lights held, caption "m - a - t", dark at the cut. The learner still does the join                        | `attentive-pointing` |
| Wrong 3                                   | "This one is mat."                                        | the guided glow                                                                                                                  | as shipped           |
| Right (or the guided tap)                 | "Yes! That's a mat." (dad, jam: "Yes! Dad!", "Yes! Jam!") | the picture springs in; all letters lit                                                                                          | `celebration`        |

- **Reviews, replays, peeks and warm-ups** play each block in its own type's beats, with no lead.
- **The caption of the sounds is never the blend line.** A line's caption ends fully revealed (`useLineSpeaker.ts`, the `finally` block), so playing the blend text as a line would print "fan" at the cut. The sounds' caption is `blendSoundsText(blend)` ("f - a - n").

## 5. Motion brief (Reanimated; Reduce Motion in brackets)

No new motion.

- **Lights that stay on:** `LetterRow`'s existing `spotlight` prop (per-letter delays, `LetterRow.tsx` header) set from the marks: letter k joins at its mark with the shipped 120 ms fade-in and lit pulse (1 → 1.2 → 1, 400 ms). At the cut the prop clears and the row's 200 ms end fade runs (`fadeOutMs`). [No pulse; the spotlight still shows.]
- **Picture reveal:** mount the picture's `TapTarget` at the answer. Its shipped entrance is the reveal: scale 0 → 1 on a 260 / 16 spring, opacity 0 → 1 over 150 ms (`WordStage.tsx`, `TapTarget`). The letter row does not move. [A 200 ms fade, no scale: also the shipped entrance.]
- **Stop 2's lead:** `'left-to-right'` (`introSpotlight.ts:36`). [All at once, no pulse.]
- **The correct moment:** all letters lit (`lit = word.length`) until the advance, plus the shipped burst, sparkle and plink.

## 6. Canon (binding: the splice writes exactly this)

`scripts/spliceRealBlendingCanon.ts` writes both files. Every problem has the shipped five slots plus `blend`; every reprompt is "Hmm... try again?". Chips are not in canon: the deal gives them by position from the shipped `TARGET_PAIRINGS` (`packages/core/src/wordSong/wordPack.ts:1867-1880`), gentle on P1–P3, trap on P4–P8 (`wordDistractors.ts:63-76`). The chips column is what the deal must produce. No new pairing rows, no new forbidden pairs, and every target and chip has a pack picture (`mobile/assets/pictures/*.webp`).

**Stop 1, `blending-cv.json`** (plan id `blending-cv-level-1` and label kept). Continuant onsets first (f, m, v, h), then stops. The 8 words are cvc-words' canon, so all 8 blends reuse cvc-words' bytes and marks.

| P   | read    | blend             | correct            | hint             | giveAnswer       | Chips (correct first) | Tier   |
| --- | ------- | ----------------- | ------------------ | ---------------- | ---------------- | --------------------- | ------ |
| 1   | Listen. | f - a - n ... fan | Yes! That's a fan. | Let's look. Fan. | This one is fan. | fan, dog, bus         | gentle |
| 2   | Listen. | m - a - n ... man | Yes! That's a man. | Let's look. Man. | This one is man. | man, cup, log         | gentle |
| 3   | Listen. | v - a - n ... van | Yes! That's a van. | Let's look. Van. | This one is van. | van, pen, cup         | gentle |
| 4   | Listen. | h - a - t ... hat | Yes! That's a hat. | Let's look. Hat. | This one is hat. | hat, cat, bag         | trap   |
| 5   | Listen. | c - a - t ... cat | Yes! That's a cat. | Let's look. Cat. | This one is cat. | cat, bat, cap         | trap   |
| 6   | Listen. | b - a - g ... bag | Yes! That's a bag. | Let's look. Bag. | This one is bag. | bag, tag, bat         | trap   |
| 7   | Listen. | p - a - n ... pan | Yes! That's a pan. | Let's look. Pan. | This one is pan. | pan, fan, man         | trap   |
| 8   | Listen. | t - a - g ... tag | Yes! That's a tag. | Let's look. Tag. | This one is tag. | tag, bag, bat         | trap   |

`session.end.*`: the shipped file's block, copied verbatim (recap "You worked on blending sounds today!").

**Stop 2, `sounding-out.json`** (plan id `sounding-out-level-1`, label `Word Song Sounding Out Level 1`). Two words the learner knows from stop 1 while they learn the taps, then six new ones. mat, bat, can, cap, dad and jam are in no stop-1 or cvc-words problem.

| P   | read        | blend             | correct            | hint             | giveAnswer       | Chips (correct first) | Tier   |
| --- | ----------- | ----------------- | ------------------ | ---------------- | ---------------- | --------------------- | ------ |
| 1   | What is it? | f - a - n ... fan | Yes! That's a fan. | Let's look. Fan. | This one is fan. | fan, dog, bus         | gentle |
| 2   | What is it? | m - a - n ... man | Yes! That's a man. | Let's look. Man. | This one is man. | man, cup, log         | gentle |
| 3   | What is it? | m - a - t ... mat | Yes! That's a mat. | Let's look. Mat. | This one is mat. | mat, pen, dog         | gentle |
| 4   | What is it? | b - a - t ... bat | Yes! That's a bat. | Let's look. Bat. | This one is bat. | bat, cat, hat         | trap   |
| 5   | What is it? | c - a - n ... can | Yes! That's a can. | Let's look. Can. | This one is can. | can, fan, man         | trap   |
| 6   | What is it? | c - a - p ... cap | Yes! That's a cap. | Let's look. Cap. | This one is cap. | cap, cat, bag         | trap   |
| 7   | What is it? | d - a - d ... dad | Yes! Dad!          | Let's look. Dad. | This one is dad. | dad, bag, bat         | trap   |
| 8   | What is it? | j - a - m ... jam | Yes! Jam!          | Let's look. Jam. | This one is jam. | jam, bag, pan         | trap   |

`session.end.*`: stop 1's block with recap "You worked on sounding out today!".

**Splice lints (fail the script):**

- Every blend has the planner's CVC shape, "<g1> - <g2> - <g3> ... <word>": ASCII only, wordLength + 1 tokens, letters in spelling order (`api/_planner.ts:3538-3575`).
- Every problem's five lines name its blend's word. No word of `WORD_SONG_NOVEL_PROBE_WORDS` (nap, rat, map, tap; `api/_plannerWordList.ts:524-529`) appears as a target or chip.
- No dealt trio holds a `FORBIDDEN_PAIRS` pair (cap–hat, man–dad, rug–mat are the ones near these words, `wordPack.ts:1680`, `:1681`, `:1690`); f and v never share a trio.
- **Audio:** the index of existing bytes is built from every Word Song canon file **before either file is written**, keyed by `renderElevenLabsText(text, tier)` like wave 4's splice (`scripts/spliceContentWave4Canon.ts:93-145`). The old `blending-cv.json`'s "Yes! Dad!", "Let's look. Can." and the rest carry into `sounding-out.json` with their bytes. A new text gets `base64: ''` until the render.
- Idempotent: a second run, also after the render, writes the same bytes.

## 7. Reuse vs new

- **Blend clips:** the 8 short-a cvc-words clips and their marks are reused as they are. They are ear-approved, and each holds 3 sounds with at least 301 ms of silence, then the word (`design/native/word-song-native.md:154`). **New:** 6 clips, mat, bat, can, cap, dad and jam.
- **Blend render:** Lily's per-grapheme IPA map, `BLEND_GRAPHEME_IPA`, through `renderElevenLabsBlend` (`api/_tts_elevenlabs.ts:81`, `:126`). Every grapheme the 6 need has an entry (m mː, a æ, t, b, c k, n, p, d, j dʒ). Nothing new.
- **The per-class phoneme SSML map is not used.** It is the Azure path (`api/_tts.ts`; `.claude/docs/planner-and-canon.md:622`), live only under the opt-in `TTS_PROVIDER=azure` (`api/_session.ts:140-160`). `.claude/docs/audio-system.md` holds no blend map.
- **The CVC phoneme-blend prompt** (`api/_planner.ts:3538-3575`): its text shape is the splice's lint (§ 6). The prompt itself is unchanged: these files are spliced, and `blending-cv`'s live path (a canon miss only) keeps "Tap the <word>." with 5 slots, which the parser still reads as the listening type.
- **Blend marks:** `npm run export-assets` measures the new clips the shipped way (`mobile/scripts/export-assets.mjs:294-333`). **New:** 6 entries in `blendMarks.generated.ts`.
- **Tap-to-hear, the whole-clip 2nd wrong, `litAt`:** shipped (`WordSong.tsx` `onLetterPress`, `playSecondWrong`; `mobile/src/audio/blendMarks.ts`), widened to the two types through `usesBlendClip` (§ 8).
- **The cut:** built from the shipped `TAP_TAIL_MS` = 80 and `MARK_LEAD_MS` = 40 (`blendMarks.ts:25-27`). **New:** `soundsCutMs(segments)`.
- **Pictures:** the pack has all 14 targets and the 5 gentle chips (`mobile/assets/pictures/`). $0.
- **Card, chips, entrance, lights, lead sweep:** `WordStage`'s picture card, `TapTarget`'s entrance, `LetterRow`'s `spotlight`, crab words' `'left-to-right'`. **New:** the picture's mount waits for the answer.
- **Lines:** 43 existing texts plus the session-end set are reused (§ 11). **New:** 31 texts, 773 characters.
- **Path art:** **new**, 1 clay piece.

## 8. Data model, parser, session end

**Vocabulary contract** (exact names, so Kevin's core PR and Devon's native PR match; core merges first):

| Name                                                              | Where                                                                        | What                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'sounding-out'`                                                  | `WordSongNode` (`packages/core/src/progress/types.ts`)                       | the SkillNode                                                                                                                                                                 |
| `'listen-blend'`, `'sound-out'`                                   | `WordSongContentType` (`packages/core/src/wordSong/wordSessionPlans.ts:247`) | stop 1's and stop 2's problems                                                                                                                                                |
| `LISTEN_BLEND_READ = 'Listen.'`, `SOUND_OUT_READ = 'What is it?'` | `planFromServer.ts`, exported                                                | the two reads, matched as exact strings                                                                                                                                       |
| `blendReads?: boolean`                                            | `WordSongPlanFromServerOptions` (`planFromServer.ts:411`)                    | accept the two reads. Native only, as `littleStories` (`:420-425`)                                                                                                            |
| `blendTargetWord(blend)`, `blendSoundsText(blend)`                | `packages/core/src/wordSong/blendHighlight.ts`                               | "f - a - n ... fan" → `'fan'` (null when not a blend), and → `'f - a - n'`                                                                                                    |
| `usesBlendClip(contentType)`                                      | `packages/core/src/wordSong/wordRound.ts`                                    | true for `'cvc-word'`, `'listen-blend'`, `'sound-out'`; replaces the `=== 'cvc-word'` tests in `secondWrongPrompt` (`:180-192`) and native `blendOf` (`WordSong.tsx:350-357`) |
| `hidesPictureUntilAnswer(contentType)`                            | `wordRound.ts`                                                               | true for the two new types only                                                                                                                                               |
| `{ kind: 'sounds'; text: string }`                                | `SecondWrongPrompt` (`wordRound.ts`)                                         | `'sound-out'`'s 2nd wrong (text = the blend line; native plays it cut). `'listen-blend'` returns the shipped `{ kind: 'blend' }`                                              |
| `soundsCutMs(segments)`                                           | `mobile/src/audio/blendMarks.ts`                                             | `segments[2][1] + TAP_TAIL_MS`                                                                                                                                                |

**Parser** (`problemFromBucket`, `planFromServer.ts:497`):

- With `blendReads`, the two exact reads are checked **first**, before the little-story branch (`:515`). The read gives the type, and the target comes from the blend slot, which is then required: `blendTargetWord(blend)` must be in `TARGET_WORD_SET` (`:390`) and the blend's grapheme tokens must spell it. Otherwise it is a `PlanFromServerError`: a missing blend, "c - a - t ... hat", a word that is not a target.
- Without `blendReads` (the web), neither read matches a template, the parse throws and the web plays its static plan.
- `NATIVE_PARSE` (`mobile/src/session/wordSongSession.ts:72`) and the peek's options (`mobile/src/session/peekSession.ts:124`) add `blendReads: true`. The review, forward and warm-up parses all spread `NATIVE_PARSE` (`:153-170`), so they get it too.
- "Tap the <word>." stays the `'blending-cv'` type for a canon miss and the frozen web.
- Before merge, both committed files parse 8/8 with the native options.

**Core round:** `wordCardFor` and `chipFaceFor` need no change (both default to the picture card and picture chips, `wordRound.ts:42-70`), and `readAloudDelayMs` gives 0 for both (`:90-93`). The native stage reads `hidesPictureUntilAnswer` and leaves the picture unmounted while the problem is unsolved. `crossVowel` is false for both steps: neither is in `CVC_CROSS_VOWEL_NODES`.

**SkillNode:** default `'locked'`. The Word Song mastery preset with the fast track (secure = 8/8 on the first tap on two days, `fast-track-native.md` P1–P3), the pace guard, peek and replay. No graduation gate (`WORD_SONG_GRADUATION_GATED_NODES` stays `cvc-words` only). No first-encounter gate.

**Session end:** as every Word Song step (`perProblemCorrect`, `targetWords`, `perProblemAnswerWord`, `firstTapCorrect`). Recaps: "You worked on blending sounds today!" (shipped) and "You worked on sounding out today!". `contentType` is never persisted, so nothing new is stored.

## 9. Migration (binding)

**Rule**, in `withDefaultedSkillLevels` (`packages/core/src/progress/storage.ts:190`). It is the one function the local load and the cloud install both run (Decision 2), so a restored backup, Add from a code and every learner's own doc get it too.

| Stored `blending-cv` | Stored `sounding-out` | Result                                                                                                |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `'mastered'`         | missing               | `'mastered'`, and `'sounding-out'` appended to `unlocksCelebrated` when that list exists and lacks it |
| `'mastered'`         | `'locked'`            | the same (the older-build repair, below)                                                              |
| anything else        | missing               | `'locked'` (the floor). It opens to `'intro'` when `blending-cv` masters, through the normal unlock   |
| any                  | any other value       | untouched                                                                                             |

- **This overrides K13** (`storage.ts:271-277`, `content-wave-1.md` § 5.3) for this key. K13 would fill `'intro'`, and the picker takes the first step that isn't mastered (`focusNode.ts:196-197`). That `'intro'` would pull a learner on cat words or beyond back to land 2 and move their map marker back.
- **Why not `'locked'`:** a locked step isn't mastered, so the picker stops on it, and the mastery rule never opens a step whose predecessor is already mastered (K13's reason). The learner is stranded.
- **Why not a "skipped" level:** `SkillLevel` has four values (`types.ts:127`), and a fifth touches every reader of levels.
- **The celebrated mark:** the Map celebrates the first open step missing from the list (`pathBeats.ts:76-94`), and a session end with a pending unlock opens the Map (`mobile/src/App.tsx:488`). Without the mark, a migrated learner would hear stop 2's unlock line at their next Word Song session end. A doc with no list gets none: an absent list means "nothing pending", and the next session-end write seeds it from the open steps (`seedUnlocksCelebrated`, `:57-59`).
- **This is the defaulter's one write to a stored key.** Its comment (`storage.ts:171`) says it fills only missing keys, so the comment gains this exception and its reason.

**The #597 lesson (older builds).** #597 named the failure chain: a build whose guard rejects the cloud doc gets `cloud-blob-rejected`, and its stale doc then overwrites the cloud copy (`design/native/learner-profiles.md` § 4.7). For this build:

- **No guard prerequisite.** An older guard requires only the steps it knows and lets extra `skillLevels` keys through (`guards.ts:122-131`, `:383-399`). Its load and save keep them (`storage.ts:282-290`). Step names in history, good days, secure days and `unlocksCelebrated` are checked as strings only. So a doc carrying `sounding-out` is never rejected, never stripped, and no overwrite chain starts.
- **The case that does break, and the repair.** Two devices on different builds share one cloud copy. Device A (this build) syncs `blending-cv: 'practicing'`, `sounding-out: 'locked'`. Device B (older) masters blending sounds; its tree has no `sounding-out`, so it opens cat words and carries `'locked'` along. A loads `'mastered'` + `'locked'` and the picker would stop on a step that never opens. This build never writes that pair itself: its mastery rule opens `sounding-out` in the same write that masters `blending-cv` (`mastery.ts:312-317`, `:478-480`; AC 6). So the pair means "progressed on a build without the step", which is T4's case, and gets T4's answer.
- **A learner B moved past while A had opened the step** (`'intro'`) is sent to sounding out on A. They haven't done it, so that is correct and nothing is repaired.
- **Ship order** is in § 10.

**Learner profiles.** #615 (the spec) is merged; #622 (PR A, core) is open at a01b5f5. Whichever merges first:

- Each learner's doc lives under its own key (`marian-tutor:progress:v1:<id>`) and loads through the same `loadProgress` chain via the scoped store (`learner-profiles.md` § 4.2, § 4.4). So the rule runs per learner with no profiles code.
- Start docs come from the land table (`placeAtStep` in `packages/core/src/learners/startDoc.ts` on `origin/kevin/profiles-a`). A learner placed at Word Song land 3 or later gets `sounding-out: 'mastered'`, and one placed at land 2 gets `blending-cv: 'intro'` with `sounding-out: 'locked'`, with no edit.
- If #622 is on `main` when the build starts, AC 11 applies. If this build lands first, #622's rebase only meets tests that enumerate Word Song steps.

**Seeds:**

- **e2e** (`e2e/_helpers/seedStorage.ts`): `DEFAULT_SKILL_LEVELS` (`:141`) gains `'sounding-out': 'locked'`. `buildSeedProgress` (`:246`) mirrors the rule: when the merged levels have `blending-cv: 'mastered'` and the overrides don't name `sounding-out`, it writes `'mastered'`. Without that, the 19 specs that seed `blending-cv: 'mastered'` would store `'locked'` behind it and trap the picker.
- **Debug seeds** (`packages/core/src/debug/seeds.ts`): the 12 recipes with `'blending-cv': 'mastered'` gain `'sounding-out': 'mastered'`. They patch over the stored doc or the defaults (`applySkillLevelsPatch`, `:726-745`), where `sounding-out` is `'locked'`.
- **`progressAtStep` / the QA jump** (`packages/core/src/debug/stepProgress.ts`) walks the step order, so it needs no edit.

## 10. States and edge cases

- **Peek** (sounding out from the Map while on blending sounds): P1–P3 with the shipped opener and closer, no lead, nothing written.
- **Review, replay, warm-up:** blocks are copied with every slot, `blend` included (`copyBlock`, `api/_review.ts:139-155`). A stop-1 block plays the sounds wherever it runs, and a stop-2 block asks "What is it?". The tier follows the block's position in the session (shipped).
- **Missing clip or marks** (a static plan, a byte mismatch):
  - Stop 1 plays "Listen." and then the hint line ("Let's look. Fan.") in place of the sounds, so the problem stays answerable as a listening problem.
  - Stop 2's 2nd wrong plays the hint line.
  - A letter tap only lights.
- **The guided tap** reveals the picture like a right tap; the problem is not counted correct (shipped).
- **Background, rotation:** as `word-song-native.md` § 8. The voice channel parks and resumes a line (#528), so sounds hidden midway resume where they stopped, still end at the cut, and the held lights follow the voice's clock. On a rotation nothing replays, lit letters stay lit, and the empty slot takes the new form's P.
- **Web:** frozen. The two reads throw there and the web plays its silent static plan (§ 8).
- **Ship order (Decision 9):**
  1. A TestFlight build with this client on every device first. It still reads today's "Tap the <word>." canon.
  2. Then `yarn release` the same day. The server learns `sounding-out` then.
  - Between the two, a learner who masters blending sounds and opens sounding out gets the silent fallback (the server doesn't know the step yet).
  - After the release, a device still on an older build gets the silent fallback on blending sounds. **Predicted** from the parser (no template matches "Listen.") and `wordSongSession.ts:314`'s silent fallback; not reproduced.

## 11. Copy / TTS script (every new spoken line)

All copy lives in canon JSON, `GUIDANCE_LINES`, `PATH_LINES`, `STAGE_SPOKEN_NAMES`, `FRIENDLY_NODE_NAMES` and `LANDS`, never in layout.

| Surface              | Line id / slot                            | Text                                                         | Chars | Sent to Lily as                                       |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------ | ----- | ----------------------------------------------------- |
| guidance             | `guide.session.intro.blending-cv`         | The sounds make a word!                                      | 23    | text                                                  |
| guidance             | `guide.session.intro.sounding-out`        | Tap the letters. Hear the sounds!                            | 33    | text                                                  |
| guidance             | `guide.session.peek-open.sounding-out`    | Let's look at sounding out!                                  | 27    | text                                                  |
| guidance             | `guide.session.peek-close.sounding-out`   | Sounding out is for later. You will learn it!                | 45    | text                                                  |
| guidance             | `guide.session.replay-open.sounding-out`  | Let's play sounding out again!                               | 30    | text                                                  |
| guidance             | `guide.session.replay-close.sounding-out` | You know sounding out!                                       | 22    | text                                                  |
| canon `blending-cv`  | `word.p1–p8.read`                         | Listen.                                                      | 7     | Listen, (7)                                           |
| canon `sounding-out` | `word.p1–p8.read`                         | What is it?                                                  | 11    | text                                                  |
| canon `sounding-out` | `session.end.recap.focus`                 | You worked on sounding out today!                            | 33    | text                                                  |
| canon `sounding-out` | correct P3, P4, P6                        | Yes! That's a mat. / Yes! That's a bat. / Yes! That's a cap. | 54    | text                                                  |
| canon `sounding-out` | hint P3, P4, P6                           | Let's look. Mat. / Let's look. Bat. / Let's look. Cap.       | 48    | text                                                  |
| canon `sounding-out` | giveAnswer P3, P4, P6                     | This one is mat. / This one is bat. / This one is cap.       | 48    | text                                                  |
| canon `sounding-out` | blend P3–P8                               | the six blends below                                         | 102   | IPA, 141                                              |
| path                 | `path.open.sounding-out`                  | Here is your path! You are on sounding out.                  | 43    | text                                                  |
| path                 | `path.stop.sounding-out`                  | Sounding out.                                                | 13    | text (two words: not the one-word rule)               |
| path                 | `path.locked.next.sounding-out`           | Sounding out! First, blending sounds. Then this!             | 48    | Sounding out! First, blending sounds; then this! (48) |
| path                 | `end.bud.sounding-out`                    | Look! A new flower for sounding out!                         | 36    | text                                                  |
| path                 | `end.unlock.sounding-out`                 | You learned blending sounds! Now you can do sounding out!    | 57    | text                                                  |
| path (text changed)  | `path.locked.next.cvc-words`              | Cat words! First, sounding out. Then this!                   | 42    | Cat words! First, sounding out; then this! (42)       |
| path (text changed)  | `end.unlock.cvc-words`                    | You learned sounding out! Now you can do cat words!          | 51    | text                                                  |

**The six new blends** (stop 2, P3–P8), as written in canon and as sent to Lily:

| P   | Canon text (chars)     | Sent to Lily (chars)           |
| --- | ---------------------- | ------------------------------ |
| 3   | m - a - t ... mat (17) | /mː/ - /æ/ - /t/ ... mat (24)  |
| 4   | b - a - t ... bat (17) | /b/ - /æ/ - /t/ ... bat (23)   |
| 5   | c - a - n ... can (17) | /k/ - /æ/ - /n/ ... can (23)   |
| 6   | c - a - p ... cap (17) | /k/ - /æ/ - /p/ ... cap (23)   |
| 7   | d - a - d ... dad (17) | /d/ - /æ/ - /d/ ... dad (23)   |
| 8   | j - a - m ... jam (17) | /dʒ/ - /æ/ - /mː/ ... jam (25) |

**Total: 31 new texts, 773 characters; 812 as sent** (the six blends go as IPA: 141 for 102). T2's cap is 1,000, which leaves 188 for retakes.

| Surface                 | Texts | Characters | As sent |
| ----------------------- | ----- | ---------- | ------- |
| guidance                | 6     | 180        | 180     |
| canon `blending-cv`     | 1     | 7          | 7       |
| canon `sounding-out`    | 17    | 296        | 335     |
| path (5 new, 2 changed) | 7     | 290        | 290     |

- **How it was counted:** a scratch script (2026-10-19, not committed) on `main` at a01b5f5. It compared every text above with every canon `text` (1,182 distinct across `public/canon/**/*.json`), every `GUIDANCE_LINES` text and input (258 ids) and every `PATH_LINES` text (646 lines, 223 baked), on exact strings only. The as-sent figures are `renderElevenLabsText`'s output. The count agrees with Dave's (31, 773, about 812).
- **Reused, not billed:** "Hmm... try again?"; all 8 of stop 1's correct, hint, giveAnswer and blend lines (cvc-words' bytes); fan's and man's lines in stop 2; can's, dad's and jam's correct, hint and giveAnswer ("Yes! That's a can.", "Yes! Dad!", "Yes! Jam!", and so on, from the shipped `blending-cv.json`); "You worked on blending sounds today!" and the session-end set.
- **The one-word rule.** "Listen." is the wave's one one-word input. It goes to Lily as "Listen," with the caption kept as "Listen." (`.claude/docs/audio-system.md:65`). Canon lines have no input field, so `renderElevenLabsText` (`api/_tts_elevenlabs.ts:144`) checks a one-entry map, `CANON_TEXT_INPUTS = { 'Listen.': 'Listen,' }`, before anything else. The bake (`revoiceCanonLily.ts:109`), the splice's audio index and the server's canon index (`api/_canon.ts:286-330`) all key by that function, so they agree. No shipped text is in the map, so nothing rendered re-renders. This is the same principle as wave 5's `LINE_INPUTS` (#621).
- **The "; then this!" inputs** use wave 5's path-line `input` field and `THEN_THIS_INPUT_STEPS` (#621, open). Both lines have no clip in their new text, so neither re-renders anything already approved.
- **Deferred lines cost nothing:** the step adds 28 `locked-later` and `gate-locked` lines that name sounding out, all with `src: null` (`DEFERRED_PATH_LINE_KINDS`, `pathLines.ts:65-68`). Baked path lines go 223 → 228 and all path lines 646 → 679. Guidance ids go 258 → 264, and texts 256 → 262. These are on a01b5f5; add wave 5's own if it merges first.
- **Retired:** the 8 "Tap the <word>." canon clips (only `blending-cv.json` holds them) and the old texts of the two changed cvc-words path lines.
- **Render** (credentialed: the tools worktree):
  1. `scripts/renderGuidanceLinesLily.ts`, `scripts/renderPathLinesLily.ts`.
  2. `npx tsx scripts/revoiceCanonLily.ts --unrendered --dry-run`. It must print about 335 + 7 canon characters before any spend.
  3. Then without `--dry-run`.
  4. Then `npm run export-assets` and `npm run export-audio` in `mobile/`.

**Prediction for the ear test** (Predict-Before-Soak; send only `?filter=new` on `/voice-qa.html`):

- The six new blends sound like the 40 shipped ones. b, k, d and p carry a light release and are never "buh". _mat_ and _jam_ hold /mː/. _jam_'s /dʒ/ is not "zh".
- **Machine check:** `export-assets` finds exactly 4 segments in all 6 new clips. Fewer than 6 new `BLEND_MARKS` entries means a retake.
- "Listen," falls. "What is it?" rises.
- "Let's look. Cap." says _cap_, never "captain" or "capital". Screened by speech length: no new hint stands out from the 11 shipped short-a "Let's look. <Word>." clips (cvc-words' 8 and can, dad, jam) by 0.1 s or more.
- No "; then this!" line comes back scratchy on its first take.

**Bounded convergence:** I rendered and ear-tested nothing. The counts are from a scratch script and the map facts are read from code, not drawn. **Not tested:**

- whether a 6-year-old holds three segmented sounds (Dave's risk signal, read on learners);
- whether the empty slot reads as "a picture is coming" or as a broken card (T5, the device check);
- how the mirrored map looks to a returning learner.

**Vocabulary (the ~200-word cap):** two new spoken words, _sounding_ and _out_ (T1). "Listen", "what", "is", "it", "tap", "letters", "hear", "sounds", "make", "word" and the six targets are already spoken (committed canon and guidance lines, 2026-10-19).

## 12. Language-version readiness

A Danish version is planned (`CLAUDE.md` "Users" line). Nothing here blocks a second language:

- **Every spoken or written word** is in a table above: canon JSON, `GUIDANCE_LINES`, `PATH_LINES`, `STAGE_SPOKEN_NAMES`, `FRIENDLY_NODE_NAMES`, `LANDS`, the Hub labels. Layout draws letters from the target word, and the clay piece has no letters.
- **The two reads are exact strings in one place** (`LISTEN_BLEND_READ`, `SOUND_OUT_READ`). A second language adds its own pair, or a structured wire field; the target already comes from the blend, not from the read's words.
- **Blend clips and marks are per language,** and the marks are measured per clip. A Danish land 2 needs its own word list and clips, but no new mechanism. The blend shape ("<g> - <g> - <g> ... <word>") and the IPA map are English-specific today, as every shipped blend is.

## 13. Wiring checklist

**`sibling-tier-checklist.md` rows for `sounding-out`:**

| #   | Site                                                                         | Edit                                                                                      |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `WordSongNode` (`packages/core/src/progress/types.ts`)                       | + `'sounding-out'`                                                                        |
| 2   | `WORD_SONG_NODES_IN_ORDER` (`focusNode.ts:126`)                              | after `'blending-cv'`                                                                     |
| 3   | `LITERACY_TREE` (`mastery.ts:176`)                                           | after `'blending-cv'`                                                                     |
| 4   | `SKILL_NODES` (`guards.ts:21`)                                               | +1                                                                                        |
| 5   | `SCHEMA_FLOOR_NODES` (`defaults.ts:88`)                                      | after `'blending-cv'`                                                                     |
| 6   | `DEFAULT_SKILL_LEVELS` (`defaults.ts:166`)                                   | `'locked'`                                                                                |
| 7–8 | `WordSongStageId`, `WORD_SONG_STAGES` (`packages/core/src/hub/stages.ts`)    | after `'blending-cv'`                                                                     |
| 9   | `STAGE_LABEL` (`src/screens/Hub/stageIcons.tsx`, frozen web, typecheck only) | `'mat'`                                                                                   |
| 10  | `WORD_SONG_LABELS` (`packages/core/src/hub/progressProjection.ts:122`)       | `'sounding out'`                                                                          |
| 11  | `e2e/_helpers/wordSongNodesInOrder.ts`                                       | union + order                                                                             |
| 12  | `e2e/_helpers/seedStorage.ts`                                                | `'locked'` + the mirror rule (§ 9)                                                        |
| 13  | `VALID_WORD_SONG_FOCUS_NODES` (`api/_planner.ts:181`)                        | +1                                                                                        |
| 14  | `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts:1073`)                 | **not added.** Served from committed canon like the story steps; a miss falls to the stub |
| 15  | `WORD_SONG_FOCUS_NODES` (`scripts/generateSessionCanon.ts:334`)              | +1, and `PENDING_CANON_NODES` (`:407`) + `'sounding-out'` + `'blending-cv'` (Decision 4)  |
| 16  | `src/lib/debug/debugSeed.ts` (web)                                           | skipped: the web is frozen                                                                |

**From "does not cover":** `CANON_FILES` in `public/voice-qa.html` (`:644`) + `['word-song', 'sounding-out']`. Its `EXPECTED_CANON_UNIQUE` (`:643`) is computed from the committed files at the render commit, with a comment line like its neighbours. Predicted delta: +18 new clips − 8 retired "Tap the <word>." clips = +10. `WORD_SONG_GRADUATION_GATED_NODES`, `CVC_CROSS_VOWEL_NODES`, `FIRST_ENCOUNTER_GATED_NODES` and `substituteSentenceGap` stay unchanged.

**Names:** `STAGE_SPOKEN_NAMES` (`friendlyNodeName.ts:146`) "sounding out"; `STAGE_SPOKEN_NAME_VERBS` (`:210`) `'is'`; `FRIENDLY_NODE_NAMES` (`:57`) "sounding out"; the planner's recap list (`api/_planner.ts:1644`) gains `sounding-out -> "sounding out"`; `scripts/recapFocusCopy.ts` (`:50` is blending-cv's row) gains its row.

**Map and lines:** `LANDS` land 2; `SESSION_INTRO_TEXTS` (`guidanceLines.ts:279`) + `'blending-cv'` and `'sounding-out'` (§ 11); peek and replay lines come from the names; `PATH_LINES` from the names, plus `THEN_THIS_INPUT_STEPS` + `'sounding-out'`, `'cvc-words'`; `PATH_ART_SET` + 1; `PATTERNS` (`introSpotlight.ts:36`) + `'guide.session.intro.sounding-out': 'left-to-right'`.

## 14. Build split

**Kevin (core, server, canon, renders), M. Lands first.**

1. The SkillNode rows (§ 13), names, `LANDS`, guidance and path lines, `PATH_ART_SET` and the art files when the clay piece exists.
2. § 8's core vocabulary: the two types, `blendReads`, the exact-read route before stories, `blendTargetWord`, `blendSoundsText`, `usesBlendClip`, `hidesPictureUntilAnswer`, `SecondWrongPrompt`'s `'sounds'`.
3. § 9: the rule, the celebrated mark, the comment, the e2e seed helper and the 12 debug seeds.
4. `scripts/spliceRealBlendingCanon.ts` with § 6's lints; both canon files; `PENDING_CANON_NODES`; `CANON_TEXT_INPUTS`; voice-QA.
5. Renders and marks (§ 11), in the tools worktree; `mapModel.test.ts`' count.
6. Vitest ACs 1–11.

**Devon (native flows + reveal), M. Branches from Kevin's merge.**

1. `blendReads` in `NATIVE_PARSE` and the peek's options; `blendOf` on `usesBlendClip`; `soundsCutMs`.
2. Stop 1's read: "Listen.", 300 ms, the cut sounds as an Emma line with the held lights (`spotlight` from the marks), the caption `blendSoundsText`, the chips opening at the cut.
3. Stop 2's 2nd wrong: the same cut sounds. Stop 1's 2nd wrong: the shipped whole-clip path.
4. `WordStage`: the picture slot kept empty while `hidesPictureUntilAnswer` and unsolved, then the picture mounted at the answer; all letters lit on the right tap.
5. The intro pattern entry.
6. Jest ACs 12–17.

**Thomas:** the device check (ACs 18–20) and the ear test; the clay piece (T3).

## 15. Acceptance criteria

**Core (vitest):**

1. With `{ littleStories: true, blendReads: true }`:
   - `blending-cv.json` parses 8/8 as `'listen-blend'`: fan, man, van, hat, cat, bag, pan, tag.
   - `sounding-out.json` parses 8/8 as `'sound-out'`: fan, man, mat, bat, can, cap, dad, jam.
   - "What is it?" never routes to `'little-story'`, and the four story files still parse as stories.
   - Without `blendReads`, both files throw.
2. Rejected (`PlanFromServerError`): a "Listen." or "What is it?" problem with no `blend`; a blend "c - a - t ... hat"; a blend whose word is not a target. "Tap the cat." still parses as `'blending-cv'`.
3. The deal gives § 6's chips for all 16 problems: gentle on P1–P3, trap on P4–P8. No trio holds a `FORBIDDEN_PAIRS` pair, f and v never share one, and no probe word appears.
4. `usesBlendClip` is true for `'cvc-word'`, `'listen-blend'` and `'sound-out'` only. `hidesPictureUntilAnswer` is true for the two new types only. `readAloudDelayMs` is 0 for both.
   - `secondWrongPrompt`: `'listen-blend'` → `{ kind: 'blend', text: <blend> }`; `'sound-out'` → `{ kind: 'sounds', text: <blend> }`.
   - `blendSoundsText('f - a - n ... fan')` → `'f - a - n'`; `blendTargetWord` → `'fan'`.
5. Migration, through both `loadProgress` and the cloud install:
   - (a) `blending-cv: 'mastered'`, no `sounding-out`, a list without it → `'mastered'`, and the list gains `'sounding-out'`. `pendingUnlock(…, 'word-song')` is null, and the picker returns the same step as before the load.
   - (b) `'mastered'` + a stored `'locked'` → the same as (a).
   - (c) `blending-cv: 'practicing'`, no key → `'locked'`.
   - (d) `'mastered'` + `'intro'` or `'practicing'` → untouched.
   - (e) no list → none created.
6. Mastery: a session end that masters `blending-cv` takes `sounding-out` `'locked'` → `'intro'` in the same write, and one that masters `sounding-out` takes `cvc-words` `'locked'` → `'intro'`.
7. Land 2 holds `['blending-cv', 'sounding-out']`, and the Word Song land count is unchanged. Map stops in land 2: 2.
   - `GUIDANCE_LINES`: 258 → 264 ids. `PATH_LINES`: 646 → 679, baked 223 → 228 (on a01b5f5; plus wave 5's if merged first).
   - § 11's texts and inputs are present, and the two cvc-words lines carry their new text. Spoken names are unique.
8. The splice is idempotent, and both files equal § 6.
   - Stop 1's 8 blends carry exactly `cvc-words.json`'s bytes. Every reused text carries its source's bytes, and new texts are empty until the render.
   - `PENDING_CANON_NODES` holds both steps, and a `--force` bake skips both.
9. `renderElevenLabsText('Listen.')` → `'Listen,'`. Every other committed canon text's request is unchanged (a before/after snapshot of all requests). The six new blends render to § 11's IPA.
10. `buildSeedProgress({ skillLevelOverrides: { 'blending-cv': 'mastered' } })` stores `sounding-out: 'mastered'`, and every debug seed's picker lands where it did before the build.
11. _(if #622 is on `main`)_ A learner doc under a suffixed key gets the rule through the scoped store. `learnerStartProgress` at Word Song land 3 gives `sounding-out: 'mastered'`, and at land 2 `'locked'`.

**Native (jest):**

12. **Stop 1 P1** (fan, a marks fixture), forward:
    - Order: the lead, 400 ms, "Listen.", 300 ms, then the clip, which stops at `segments[2][1]` + 80.
    - f, a and n each join the lit set at their mark − 40 and stay lit until the cut.
    - The caption ends as "f - a - n" and never contains "fan".
    - The chips stay closed until the cut, and `word-song-word-picture` is not mounted.
13. **Stop 1, wrong twice:** the reprompt, then 600 ms later the whole clip, one letter lit at a time and all three on the word. A right tap mounts the picture, lights all three letters and plays "Yes! That's a fan.". The letter row's y is the same before and after.
14. **Stop 2 P3** (mat):
    - "What is it?" with no lead; the chips open at its end.
    - A tap on m plays segment 0's window of "m - a - t ... mat" and lights m. Letters are inert while a line plays.
    - The 2nd wrong plays the sounds cut before the word, with lights held and the caption "m - a - t".
    - The 3rd wrong plays "This one is mat." with the guided glow; the guided tap reveals the picture and is not counted correct.
15. **Leads:**
    - Stop 2's P1 lead lights the cells at 0, 150 and 300 ms; Reduce Motion lights them at once with no pulse.
    - Stop 1's lead lights nothing.
    - No lead plays on P2–P8, in reviews, peeks, replays or warm-ups.
16. **Without marks:** stop 1 plays "Listen." then "Let's look. Fan." and opens the chips; stop 2's 2nd wrong plays the hint line; letter taps only light. A review mixing a stop-1 block, a stop-2 block and a cvc-words block plays each in its own beats.
17. **Reduce Motion:** the picture fades in over 200 ms with no scale, and the lights have no pulse.

**Device** (Expo Go, `EXPO_PUBLIC_QA_STEP=blending-cv`, then `sounding-out`):

18. Both stops at 375×667, 667×375, 820×1180 and 1180×820:
    - Emma speaks every line.
    - The chips stay closed during the sounds.
    - The empty slot reads as space, not a broken card.
    - The picture lands in its slot without moving or covering the letters.
19. The Map at 375×667, 744×1133, 820×1180, 1133×744 and 1180×820: land 2 shows two stops; lands 3 and up run mirrored with no overlaps; the current stop is in view on open.
20. **A device whose learner is past land 2** (a real doc, before and after install):
    - The Map shows land 2 with two done stops.
    - No unlock beat plays on the Map or after the next Word Song session.
    - The current step, the Hub card and the land number are unchanged.

## 16. Thomas decided

Approved by popup, 2026-10-19, as written in Dave's § 12:

- **T1. Name:** stop 2 is "sounding out" (`sounding-out`), adding _sounding_ and _out_. Stop 1 stays "blending sounds", and land 2 stays "Land 2: Blending". **Approved.**
- **T2. Lily budget:** 31 texts, 773 characters, about 812 as sent. **Approved up to 1,000**, so one retake round on the six blends fits. This spec's count is 812 as sent (§ 11), and `--dry-run` prints the real figure before any spend.
- **T3. Clay piece:** a toy xylophone with three bars and a mallet (§ 1). **Approved.** The look is judged when it is made.
- **T4. Migration:** a learner with blending sounds mastered and no `sounding-out` key gets `sounding-out` filled `'mastered'`. This overrides K13's `'intro'` for this key. **Approved.** § 9 applies the same answer to the older-build pair (`'locked'` behind a mastered `blending-cv`) and adds the celebrated mark, which is what makes "nothing plays" true.
- **T5. The look:** both stops show the letters only, and the picture appears on the right tap, judged on device. **Approved.**
  - **Prediction for the device check:** at 375×667 the card before the answer shows the letter row at the stage's bottom edge with the 160 pt slot empty above it.
  - The picture grows into the slot from its centre in under half a second, while the letters stay still.
  - The empty slot reads as "something will appear here", not as a missing picture.
  - If it reads as broken, the fallback is Dave's centred row with the 200 ms slide (§ 4 of his UX section). That costs one motion and no other change.

## 17. D-items for Dave (pedagogy, read-only)

- **D1.** Stop 2's lead lights the letters left to right with the lit pulse (crab words' cue), and all at once under Reduce Motion. Your bracket asked for "each in turn, no scale". The shipped cue saves a pattern, and Reduce Motion users still see which letters to tap.
- **D2.** The revealed picture can't be tapped, because the problem is solved and advances (Decision 7). The word–picture link is "Yes! That's a mat." over the picture. Your § 3 had a picture tap saying the word.
- **D3.** The older-build pair: a learner who mastered blending sounds on a build without sounding out (stored `'locked'`) is treated as T4's migrated learner (`'mastered'`) and is not sent to sounding out (§ 9).
- **D4.** During the sounds the ribbon shows the letters, hyphenated ("f - a - n"), as the shipped 2nd-wrong blend caption does, and never the word.

## 18. K-items for Kevin (confirm in code before building)

- **K1.** "What is it?" matches the story read pattern (`planFromServer.ts:323`), and the native parses with stories on (`wordSongSession.ts:72`). The exact reads go before the story branch (`:515`), behind `blendReads`. Is any other parse site, beyond `NATIVE_PARSE`, the peek and the warm-up, missing the option?
- **K2.** `blending-cv` into `PENDING_CANON_NODES`, so a `--force` bake can't rewrite the spliced file (`generateSessionCanon.ts:427-438`).
- **K3.** The migration is one edit in `withDefaultedSkillLevels`: the `'locked'` repair, the `unlocksCelebrated` append, and the exception in the "fills only missing keys" comment. Confirm the cloud install keeps the appended list through `mergeUnlocksCelebrated` (`cloudSync.ts`, `installCloudBlob`).
- **K4.** `CANON_TEXT_INPUTS` inside `renderElevenLabsText`: confirm the server's canon audio index (`api/_canon.ts:286-330`) and the splice key by it, so "Listen." finds its bytes at runtime and no shipped request changes (AC 9).
- **K5.** The path `input` field: if #621 is merged, add `'sounding-out'` and `'cvc-words'` to `THEN_THIS_INPUT_STEPS`. If not, introduce the field with #621's names (`input`, `THEN_THIS_INPUT_STEPS`, `LINE_INPUTS`) so the second mover's rebase is mechanical.
- **K6.** Seeds: the `buildSeedProgress` mirror rule and the 12 debug seeds. Run the 19 e2e specs that seed `blending-cv: 'mastered'`.
- **K7.** `EXPECTED_CANON_UNIQUE`: predicted +10 (§ 13), computed from the committed files at the render commit.
- **K8.** Tests that pin the old "Tap the <word>." canon: `planFromServer.test.ts` reads sample plans and `canonLint.test.ts` writes temp fixtures (both unaffected as far as read). Any test that reads the committed `blending-cv.json` changes with it by design.
