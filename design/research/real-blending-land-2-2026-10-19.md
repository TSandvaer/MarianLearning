# Word Song land 2: a real blending land with two stops

**Date:** 2026-10-19
**For:** the coordinator, relayed to Thomas; Kevin and Devon for the build.
**Status:** research and spec only, docs only. One team recommendation: child psychology plus a short UX section in Kyle's spec format (I could not message him).
**Trigger:** Thomas, 2026-10-19, on the Word Song map: "Why is blending sounds all alone in the lane?" and "i just seem silly to have a whole land for 1 stop". #627 (`design/research/word-song-land-2-2026-10-19.md`, open) found that the Blending stop never blends. Thomas then approved (popup) "Yes, propose it": make the Blending stop really blend.
**Who this plans for:** any learner of about 6 to 9 (`CLAUDE.md` "Users" line). Marian is one user. A Danish version is planned, so all copy is in tables (§ 9).

---

## Question

How do we make land 2 "Blending" teach blending, with two stops, so that no land number changes and no learner loses progress?

## Bottom line

**Land 2 keeps its name and number and gets two stops. Both use short-a words, and both hide the picture until the learner answers.**

1. **Stop 1, `blending-cv` "blending sounds" (made real): Emma says the sounds, you find the word.** She says "Listen." and then the word's three sounds, "f… a… n", as each letter lights up. The learner taps the picture of the word.
2. **Stop 2, `sounding-out` "sounding out" (new): you make the sounds, you find the word.** Emma asks "What is it?". The learner taps the letters to hear each sound, joins them, and taps the picture. Emma says no sound until the 2nd wrong tap.

- **Migration:** a learner whose `blending-cv` is already mastered gets `sounding-out` stored as **mastered** on load. That learner is never sent back and never sees a new locked stop behind them.
- **Cost:** 31 new Lily texts, **773 characters** as counted (about 812 as sent, § 9). $0 for pictures. One clay piece.
- **Size:** **M** in total: Kevin M (core, canon, parser, migration, lines), Devon M (two flows and the picture reveal).

---

## State check (read in code, 2026-10-19)

- **Land 2 has one stop:** `{ world: 'word-song', number: 2, name: 'Blending', nodes: ['blending-cv'] }` (`packages/core/src/progress/lands.ts:61`).
- **Today's stop is a listening test.**
  - Its read is "Tap the <word>." (`public/canon/word-song/level-1/blending-cv.json`: cat, bag, hat, dad, van, can, man, jam).
  - The planner describes it as "Marian hears the word spoken and taps the matching picture chip" (`api/_planner.ts:2389-2391`) and forbids a blend slot on it (`api/_planner.ts:1634`).
- **The picture gives the answer away.** The card draws the target's picture above its letters from the first frame (`mobile/src/screens/wordSong/WordStage.tsx:163`). One chip shows the same picture. So a learner can answer by matching two pictures, without listening and without reading.
  - cvc-words does the same, and its read also says the word ("Read the hat."). That is land 3 and outside this note. It does mean no stop on the path so far needs blending to answer.
- **The blend clips exist and are ear-approved.** There are 40 clips, 8 each for short a, o, u, i and e ("c - a - t ... cat"). Each holds three sounds with at least 301 ms of silence between them, then the word (`design/native/word-song-native.md:154`).
  - Today they play only as cvc-words' 2nd-wrong hint (`word-song-native.md:187`) and as letter tap-to-hear.
  - The app uses a clip only on `cvc-word` problems (`mobile/src/screens/wordSong/WordSong.tsx:351`) and only with exactly 4 measured segments (`mobile/src/audio/blendMarks.ts:36`).
  - They render through `renderElevenLabsBlend` with the per-grapheme IPA map (`api/_tts_elevenlabs.ts:81`, `:126`). `.claude/docs/audio-system.md` and its Azure SSML map are older than the switch to Lily.
- **Short-a words with a pack picture (18):**
  - **With a blend clip (8):** hat, fan, man, van, cat, bag, pan, tag. These are exactly cvc-words' canon.
  - **Without one (10):** bat, can, cap, dad, jam, mat, nap, rat, map, tap.
  - **nap, rat, map and tap are the graduation probes** (`api/_plannerWordList.ts:524-529`). They must stay novel for the cvc-words novel-word gate, so neither stop uses them.
- **Chip pairs exist** for the 14 short-a words that aren't probes (`packages/core/src/wordSong/wordPack.ts:1867-1880`). The forbidden pairs that touch them are cap–hat, man–dad and rug–mat (`:1680`, `:1681`, `:1690`).
- **The picker takes the first step that isn't mastered** (`packages/core/src/progress/focusNode.ts:197`). A missing key is filled `'locked'`, or `'intro'` when the step before it is mastered (K13, `design/native/content-wave-1.md` § 5.3). Neither is safe for a step inserted before where a learner already is (§ 7).
- **Map:** the height depends on the number of lands (`landscapeNeed`, `packages/core/src/map/mapLayout.ts:303`). The width depends on the widest land (`:193`, Words, 5 stops). Land 2 going from 1 stop to 2 changes neither.

---

## Evidence

- **Ehri, Nunes, Willows, Schuster, Yaghoub-Zadeh & Shanahan (2001)**, "Phonemic awareness instruction helps children learn to read: Evidence from the National Reading Panel's meta-analysis", _Reading Research Quarterly_ 36(3):250–287. Findings as summarised on the NRP findings page, https://www.nichd.nih.gov/publications/pubs/nrp/findings:
  - The most effective training involved "explicitly and systematically teaching children to manipulate phonemes with letters".
  - Instruction worked best when it focused "on one or two types of phoneme manipulations rather than multiple types".
  - Strength: strong (meta-analysis). I read the NRP summary, not the paper.
  - _Use:_ both stops show the letters and light each one as its sound plays. The whole land does one manipulation, blending.
- **Gonzalez-Frey & Ehri (2021)**, "Connected Phonation Is More Effective than Segmented Phonation for Teaching Beginning Readers to Decode Unfamiliar Words", _Scientific Studies of Reading_ 25(3):272–285, https://eric.ed.gov/?id=EJ1295469.
  - Participants were kindergartners (mean age 5.6) who knew letter sounds but could not decode.
  - Connected training ("sssaaannn") beat segmented training ("sss -- aaa -- nnn"), including on a transfer task with stop consonants.
  - The error analysis: "breaking between phonemes caused students to forget initial phonemes during blending".
  - Strength: strong design (randomised), one study. I read the ERIC abstract.
  - _Use:_ continuant-onset words come first in both stops (§ 5). During the sounds each letter **stays lit** once it has played, so the first sound is still in view when the last one ends. It also counts against reusing our segmented clips (Risks).
- **Share (1995)**, "Phonological recoding and self-teaching: sine qua non of reading acquisition", _Cognition_ 55(2):151–218, https://pubmed.ncbi.nlm.nih.gov/7789090/.
  - Each successful decoding of a new word is a chance to learn its spelling. Decoding is the self-teaching mechanism.
  - Strength: moderate (theory with a review of evidence). I read the abstract.
  - _Use:_ stop 2 mostly uses words the learner hasn't met (bat, mat, can, cap, dad, jam), and it leaves the graduation probes novel.
- **Torcasio & Sweller (2010)**, "The use of illustrations when learning to read: A cognitive load theory approach", _Applied Cognitive Psychology_, https://doi.org/10.1002/acp.1577.
  - Three experiments with beginning-reading material:
    - Reading improved more with no illustrations than with informative ones (experiment 1).
    - It improved more with uninformative illustrations than with informative ones (experiment 2).
    - Uninformative illustrations and none did not differ (experiment 3).
  - The authors read informative pictures as redundant: an extraneous load that interferes with learning to read.
  - Strength: moderate. I saw a repository summary of the abstract, not the paper.
  - _Use:_ the picture appears on the card only after the answer. The word–picture link (vocabulary) is kept but comes after the decoding.
- **Samuels (1967)**, "Attentional process in reading: The effect of pictures on the acquisition of reading responses", _Journal of Educational Psychology_ 58:337–342.
  - A picture shown with a new word slowed learning of the word, because the child used the picture as the cue.
  - Strength: weak and contested. Montare et al. failed to replicate it; I saw secondary sources only.
  - _Use:_ supports Torcasio & Sweller; not relied on alone.
- **Continuant sounds first** (Five from Five; UK synthetic-phonics practice), already cited in `design/research/cvc-blend-audio-phonics.md`. Strength: moderate (practitioner synthesis). This order also ships as `reorderContinuantOnsetFirst` in the planner.

## Application to learners (multi-user)

- **Why two stops and not one:** stop 1 is blending with support (Emma makes the sounds). Stop 2 hands the job to the learner: they make the sounds from the letters. That is the move cvc-words assumes. Gradual release is my judgment, not a cited result. Each stop does one thing, which fits Ehri et al.'s one-or-two-skills finding.
- **Why not a two-sound stop 1 ("c… a…"):** short vowels don't end English words, so a two-sound consonant-vowel word needs a long vowel the learner hasn't been taught. The pack's two-sound pictures are _egg_ (short e, vowel first), _bee_ and, in British English, _car_ (vowels taught much later). Both stops are therefore three sounds. They differ in who makes the sounds, not in how many there are.
- **A 6-year-old just past letter sounds:** gets the blending the land promises, with Emma's voice first and then their own taps. Short a, the first vowel taught (`design/research/phonics-sequence-marian.md` § Q1), is the only vowel.
- **A fluent 8–9-year-old:** passes each stop in 2 days on the fast track (`design/native/fast-track-native.md`). That is 2 more days than today for a new learner. A learner already past land 2 loses nothing (§ 7).
- **L2 learners:** the words stay concrete and picturable, and the picture still arrives, after the answer. f and v never share a trio (van's trap pair is fan and man, so van sits at a gentle position).

## Risks / counter-evidence

- **The clips are segmented, and the evidence favours connected sounds** (Gonzalez-Frey & Ehri). I keep them for three reasons:
  - They are ear-approved, and blends took many ear-test rounds to converge (`design/research/cvc-blend-audio-phonics*.md`).
  - Tap-to-hear needs the silences to cut each sound.
  - A connected re-render is a new audio surface with no approved form.
  - The lights that stay on are the mitigation.
  - **Signal to revisit:** learners who master stop 1's continuant words (P1–P4) but miss the stop-onset words (P5–P8) on the first tap across sessions.
- **The same 8 words every session** (canon) can be learned by heart. Trap chips (rhyme or same start, § 5) keep attention on the letters even then.
- **Stop 2 can be guessed.** The learner can tap a picture without tapping any letter. The traps make guessing a 1-in-3 bet, and mastery needs 8/8 on the first tap on two days.
- **Stop 1 reuses cvc-words' 8 words**, so land 3's first step repeats them. That is acceptable: a learner's first decoding is then on words they have heard blended. Land 3 itself is out of scope.

## Recommendation

Build § 1–§ 10 below as one wave: one SkillNode, a new format for an existing one, a migration rule, and no new pictures. Thomas decides T1–T5 (§ 12) before the render.

---

# UX spec (Kyle's format)

## Goal

The learner joins three heard sounds into a word (stop 1), then makes the sounds from the letters and joins them (stop 2), before reading words in land 3.

## User state entering

- **Stop 1:** letter sounds mastered. The Map plays "You learned letter sounds! Now you can do blending sounds!" (shipped).
- **Stop 2:** blending sounds mastered. The Map plays the new "You learned blending sounds! Now you can do sounding out!".
- **cvc-words:** sounding out mastered. Land 3's gate beat is unchanged ("A new land! Land 3: Words!").
- **A learner past land 2 when the build lands:** `sounding-out` is stored as mastered on load (§ 7). Nothing plays.

## 1. Steps, land, names, path art

| Step                     | After           | Land, stop         | Spoken name            | Verb | Recap phrase    | Canon file                                      |
| ------------------------ | --------------- | ------------------ | ---------------------- | ---- | --------------- | ----------------------------------------------- |
| `blending-cv` (reformat) | `letter-sounds` | WS 2 Blending, 1/2 | blending sounds (kept) | is   | blending sounds | `word-song/level-1/blending-cv.json` (replaced) |
| `sounding-out` (new)     | `blending-cv`   | WS 2 Blending, 2/2 | sounding out           | is   | sounding out    | `word-song/level-1/sounding-out.json`           |

- **`LANDS`:** land 2 becomes `nodes: ['blending-cv', 'sounding-out']`. No land number or land name changes.
- **"sounding out":** the phrase teachers and parents use ("sound it out"), so it is a strategy a learner can name. It adds two spoken words, _sounding_ and _out_ (neither is in any shipped line; text scan, 2026-10-19). This is T1.
- **Clay piece `sounding-out`:** a small toy xylophone, three bars in a row (rose, cream, green) and one wooden mallet: tap each bar, hear each sound. Must not look like the ear with sound waves (`letter-sounds`), the two puzzle pieces (`blending-cv`), the abacus (`add-two-digit`, wave 5), or the harp or drum pictures. `PATH_ART_SET` + 1 (T3).

## 2. What the learner sees

Phone portrait (375×667), stop 1, P1, during the sounds:

```
+----------------------------+
| [<]           ✦3 (★ 12)    |
| ◉ ○ ○ ○ ○ ○ ○ ○            |
| (Emma) | f... a...       | |   caption walks with the sounds
| (147 ) |                 | |
|                            |
|        f   a   n           |   'letters' card, NO picture yet;
|        ▔   ▔               |   f and a lit (rose spotlight), n dark
| [fan]    [dog]    [bus]    |   picture chips, closed until the sounds end
+----------------------------+
```

- **The card is the letter row alone**: the shipped `letters` card, today the fallback for words without art. The target's picture is not drawn until the right tap (or the given answer). It then springs in above the letters (the picture's entrance, 260/16), and the card becomes the shipped picture card.
- Chips are pictures (the shipped `picture` face). Layout, sizes and the phone-landscape chip column are `word-song-native.md` § 2–§ 3, unchanged.
- **Stop 2** looks the same, with no letter lit when the card appears.

## 3. Beats, problem by problem

**Stop 1, blending sounds (P1–P8):**

- **Lead** (P1, forward sessions until mastered): "The sounds make a word!" Then 400 ms, then the read.
- **Read:** "Listen." Then 300 ms, then the problem's blend clip **from its start to `segments[2].off + 80 ms`**: the three sounds, not the word. Letter k lights at `segments[k].on − 40 ms` and **stays lit**. All three fade at the cut (200 ms). Emma is `attentive-pointing`. The chips open when the sounds end.
- **After the read:** a letter tap plays its own sound (shipped tap-to-hear). Letters are inert while Emma speaks.
- **Wrong 1:** "Hmm... try again?", poof, shake, `puzzled-tilt`.
- **Wrong 2 (hint, 600 ms after the reprompt):** the **whole** clip, "f… a… n… fan". The shipped highlight lights one letter at a time and all on the word. Emma models the join.
- **Wrong 3:** "This one is fan." and the guided glow. The picture springs in when the guided tap lands.
- **Correct:** the picture springs in, every letter lights (the whole-word beat), "Yes! That's a fan.", burst, sparkle, plink, `celebration`. Once shown, a tap on the picture says the word (the clip's word segment, shipped).

**Stop 2, sounding out (P1–P8):**

- **Lead** (P1, forward sessions until mastered): "Tap the letters. Hear the sounds!" The letters pulse once each, left to right, 150 ms apart (the letter-entrance stagger, scale 1 → 1.2 → 1) [the spotlight lights each in turn, no scale].
- **Read:** "What is it?" The chips open when it ends. There is no silent beat: the read never says the word, so there is nothing for a beat to protect.
- **Letters:** each tap plays its sound, from the card's first frame. They are inert while Emma speaks. A tap is not a move; nothing is recorded.
- **Wrong 1:** "Hmm... try again?" (as above).
- **Wrong 2 (hint):** stop 1's read support: the three sounds, cut before the word, with the lights staying on. The learner still does the join.
- **Wrong 3, correct:** as stop 1, with "This one is mat." / "Yes! That's a mat." (dad and jam keep the shipped "Yes! Dad!" / "Yes! Jam!").

**Never a red X:** every wrong path is the shipped poof, shake and `puzzled-tilt`. No timer, no speed signal.

## 4. Motion brief (Reanimated; Reduce Motion in brackets)

- **Lights that stay on:** the shipped `lit[k]` 0 → 1 (120 ms) with its pulse, without the "letter before it → 0" step during a stop-1 read or a stop-2 hint [no pulse].
- **Picture reveal:** scale 0 → 1, spring 260/16, opacity with it [200 ms fade]. The letter row moves down to make room (the picture card's 8 pt gap, `withTiming`, 200 ms) [no slide; the row jumps].
- **Lead sweep (stop 2):** the existing entrance stagger, replayed [spotlight only].
- No other new motion.

## 5. Words, chips and canon order (binding)

All chips come from the shipped `TARGET_PAIRINGS` (`wordPack.ts:1867-1880`): gentle on P1–P3, trap on P4–P8. No new rows, no new forbidden pairs. Every target and chip has a pack picture.

**Stop 1 (`blending-cv`):** continuant onsets first, then stops.

| P   | Word | Chips (correct first) | Class  | Blend clip |
| --- | ---- | --------------------- | ------ | ---------- |
| 1   | fan  | fan, dog, bus         | gentle | shipped    |
| 2   | man  | man, cup, log         | gentle | shipped    |
| 3   | van  | van, pen, cup         | gentle | shipped    |
| 4   | hat  | hat, cat, bag         | trap   | shipped    |
| 5   | cat  | cat, bat, cap         | trap   | shipped    |
| 6   | bag  | bag, tag, bat         | trap   | shipped    |
| 7   | pan  | pan, fan, man         | trap   | shipped    |
| 8   | tag  | tag, bag, bat         | trap   | shipped    |

**Stop 2 (`sounding-out`):** two known words while the learner learns the taps, then six they haven't met.

| P   | Word | Chips (correct first) | Class  | Blend clip |
| --- | ---- | --------------------- | ------ | ---------- |
| 1   | fan  | fan, dog, bus         | gentle | shipped    |
| 2   | man  | man, cup, log         | gentle | shipped    |
| 3   | mat  | mat, pen, dog         | gentle | **new**    |
| 4   | bat  | bat, cat, hat         | trap   | **new**    |
| 5   | can  | can, fan, man         | trap   | **new**    |
| 6   | cap  | cap, cat, bag         | trap   | **new**    |
| 7   | dad  | dad, bag, bat         | trap   | **new**    |
| 8   | jam  | jam, bag, pan         | trap   | **new**    |

- **Why these traps:** a rhyme trap (bat: cat, hat; can: fan, man) is decided by the first sound. A same-start trap (cap: cat) is decided by the last. Either way the learner needs all three sounds.
- **Checked:** no trio holds cap–hat, man–dad or rug–mat. No f/v pair. No graduation probe anywhere. dad's picture (a dad holding his daughter's hand) never sits beside man.

## 6. Data model, parser, session end

- **SkillNode `'sounding-out'`**, after `blending-cv` in `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER`; `cvc-words`' prerequisite becomes it. Default `'locked'`. Word Song preset (secure = 8/8 on the first tap); no graduation gate.
- **Two content types** (exact names, so Kevin's core PR and Devon's native PR match; core lands first):
  - `'listen-blend'`: read "Listen.".
  - `'sound-out'`: read "What is it?".
  - Neither read names a word, so **the target comes from the problem's `blend` slot**, which both types require. A problem without it is rejected.
  - "Tap the <word>." stays as the `blending-cv` type for the stub fallback and the frozen web.
- **The blend clip** plays for these two types too (widen `blendOf`, `WordSong.tsx:351`). Tap-to-hear works on the `letters` card when marks exist.
- **Canon is spliced, not Haiku-baked:** a splice script writes both files from § 5 and § 9. `sounding-out` joins `PENDING_CANON_NODES`. The server reuses audio by exact text (`getCanonAudioIndex`), so stop 1's 8 blends reuse cvc-words' bytes and their marks match.
- **Session end:** as every Word Song step (`perProblemCorrect`, `targetWords`, `perProblemAnswerWord`). Recap "You worked on blending sounds today!" (shipped) and "You worked on sounding out today!" (new).

## 7. Migration (binding)

**Rule:** in both read-path defaulters (`withDefaultedSkillLevels`, `packages/core/src/progress/storage.ts:190`, and its copy in `progress/cloudSync.ts`):

- When `sounding-out` is **missing** and the stored `blending-cv` is `'mastered'`, fill **`'mastered'`**. This overrides K13's `'intro'` for this one key.
- When it is missing otherwise, fill `'locked'`. It opens when `blending-cv` masters, through the normal unlock.
- A stored key is never touched.

**Why mastered and not skipped:** `SkillLevel` has no skipped state (`types.ts:127`), and adding one touches every reader of levels. Both other fills harm the learner:

- **`'intro'`** puts the picker on stop 2, a stop behind where the learner is. Their map marker moves back.
- **`'locked'`** strands them: a locked step is not mastered, so the picker lands on it, and a locked step never opens.

**What a migrated learner sees:** land 2 shows two done stops, with no beat and no unlock line. Their current step, Hub card and land number are unchanged, and progress only grows. They can still play stop 2 from the map (replay). Its blocks may come up in reviews, which is harmless for a learner who reads.

**Also:**

- A learner **on** `blending-cv` keeps its level and days. Their next sessions are the new format.
- Each learner's doc gets the rule on load (learner profiles, #615). So do an imported backup and the e2e seeds.
- **e2e and debug seeds** that list every key explicitly must set `sounding-out` wherever they set `blending-cv` (`'mastered'` with it). A seed that names it `'locked'` behind a mastered `blending-cv` would trap the picker.

## 8. States and edge cases

- **Peek:** P1–P3 with the shipped opener and closer. Nothing is written.
- **Review, replay, warm-up:** canon blocks keep their own type, so a stop-1 block plays the sounds wherever it runs.
- **Missing clip or marks** (static plan, a byte mismatch): stop 1 reads the hint line ("Let's look. Fan.") in place of the sounds, so the problem stays answerable. Stop 2's 2nd wrong plays the hint line. A letter tap only pulses.
- **Background, rotation:** as `word-song-native.md` § 8. A cut clip stops at its cut point when resumed.
- **Web:** frozen. A new read throws there, and the web plays its static plan (`content-wave-1.md` § 1.9).

## 9. Copy / TTS script (every new spoken line)

Counted with a scratch script on 2026-10-19 (not committed). It compared every candidate with every canon `text`, every `GUIDANCE_LINES` text and input, and every `PATH_LINES` text on `main` at a01b5f5, matching exact strings only. That is 1,181 canon texts, 258 guidance lines and 646 path lines; existing texts are reused and not billed.

| Surface              | Line id / slot                     | Text                                                                                                                  | Chars |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| guidance             | `guide.session.intro.blending-cv`  | The sounds make a word!                                                                                               | 23    |
| guidance             | `guide.session.intro.sounding-out` | Tap the letters. Hear the sounds!                                                                                     | 33    |
| guidance             | `peek-open.sounding-out`           | Let's look at sounding out!                                                                                           | 27    |
| guidance             | `peek-close.sounding-out`          | Sounding out is for later. You will learn it!                                                                         | 45    |
| guidance             | `replay-open.sounding-out`         | Let's play sounding out again!                                                                                        | 30    |
| guidance             | `replay-close.sounding-out`        | You know sounding out!                                                                                                | 22    |
| canon `blending-cv`  | `word.p1–8.read`                   | Listen.                                                                                                               | 7     |
| canon `sounding-out` | `word.p1–8.read`                   | What is it?                                                                                                           | 11    |
| canon `sounding-out` | `session.end.recap.focus`          | You worked on sounding out today!                                                                                     | 33    |
| canon `sounding-out` | correct, P3 / P4 / P6              | Yes! That's a mat. / … a bat. / … a cap.                                                                              | 54    |
| canon `sounding-out` | hint, P3 / P4 / P6                 | Let's look. Mat. / Bat. / Cap.                                                                                        | 48    |
| canon `sounding-out` | giveAnswer, P3 / P4 / P6           | This one is mat. / bat. / cap.                                                                                        | 48    |
| canon `sounding-out` | blend, P3–P8                       | m - a - t ... mat · b - a - t ... bat · c - a - n ... can · c - a - p ... cap · d - a - d ... dad · j - a - m ... jam | 102   |
| path                 | `path.open.sounding-out`           | Here is your path! You are on sounding out.                                                                           | 43    |
| path                 | `path.stop.sounding-out`           | Sounding out.                                                                                                         | 13    |
| path                 | `path.locked.next.sounding-out`    | Sounding out! First, blending sounds. Then this!                                                                      | 48    |
| path                 | `end.bud.sounding-out`             | Look! A new flower for sounding out!                                                                                  | 36    |
| path                 | `end.unlock.sounding-out`          | You learned blending sounds! Now you can do sounding out!                                                             | 57    |
| path (changed)       | `path.locked.next.cvc-words`       | Cat words! First, sounding out. Then this!                                                                            | 42    |
| path (changed)       | `end.unlock.cvc-words`             | You learned sounding out! Now you can do cat words!                                                                   | 51    |

- **Total: 31 texts, 773 characters** (guidance 180, canon 303, path 290).
  - **As sent:** blends go to Lily as IPA ("/b/ - /æ/ - /t/ ... bat", `renderElevenLabsBlend`), which is 141 characters for the six, so the bill is about **812**.
  - The two locked-next lines use the "; then this!" render input (`content-wave-5.md` § 9.1), at the same length.
- **Reused, not billed:** "Hmm... try again?", all of stop 1's correct, hint, giveAnswer and blend lines, fan and man's lines in stop 2, can, dad and jam's hint and giveAnswer, "Yes! Dad!", "Yes! Jam!", "You worked on blending sounds today!" and the session-end set.
- **Retired:** the old cvc-words locked-next and unlock lines ("… First, blending sounds. …"). Locked-later lines are deferred (`src: null`), so they cost nothing.
- **Prediction (before the ear test):**
  - The six new blends sound like the 40 shipped ones: b, k, d and p carry a light release, never "buh"; _mat_ and _jam_ hold /mː/; _jam_'s /dʒ/ is not "zh".
  - **Machine check:** `export-assets` finds exactly 4 segments in all 6 new clips, because each sound is followed by ≥ 300 ms of silence. Fewer than 6 marks means a retake.
  - "Listen." falls; "What is it?" rises.
- **Bounded convergence:** I rendered nothing. I did not test whether a 6-year-old holds three segmented sounds; that is the Risks signal, read on learners, not by ear.
- **Vocabulary:** two new spoken words, _sounding_ and _out_ (T1). Every other word is in use.
- **Language versions:** every spoken and written word is in this table, canon JSON, `GUIDANCE_LINES`, `PATH_LINES` or `LANDS`. Blend clips and their marks are per language, and the marks are generated per clip, so a Danish land 2 needs its own word list and clips but no new mechanism.

## 10. Wiring checklist and split

**Kevin (core, server, canon, renders), M:**

- **`sibling-tier-checklist.md` rows for `sounding-out`**, from "does not cover":
  - `CANON_FILES` in `public/voice-qa.html` (+1 stem), and `EXPECTED_CANON_UNIQUE` (+18 canon texts).
  - The committed canon. `WORD_SONG_GRADUATION_GATED_NODES` stays `cvc-words` only.
- **Names:** `STAGE_SPOKEN_NAMES`, verbs, `FRIENDLY_NODE_NAMES`, the Hub labels, the recap list in `api/_planner.ts`, `scripts/recapFocusCopy.ts`.
- **Map and lines:** `LANDS` land 2 (+1 node), `PATH_LINES` (+5 baked, 2 changed, plus deferred locked-later lines that aren't baked), `GUIDANCE_LINES` (+2 leads, +4 peek/replay), `PATH_ART_SET` (+1).
- **Parser:** the two read templates, the target from `blend`, `blend` required for both types.
- **Migration:** § 7 in both defaulters.
- **Splice script:** writes both canon files.
- **Renders:** `renderGuidanceLinesLily.ts`, `renderPathLinesLily.ts`, `revoiceCanonLily.ts --unrendered` (`--dry-run` first), then `npm run export-assets` (+6 blend marks).

**Devon (native), M:**

- The two read flows (§ 3): a blend clip cut at `segments[2].off + 80 ms`, and the stop-1 hint as the whole clip.
- Lights that stay on.
- The `letters` card with picture chips and the reveal on the answer.
- The stop-2 lead sweep (a new `introSpotlight` pattern).
- Widen `blendOf` and tap-to-hear to the two types.
- Jest tests for the ACs below.

**Jessica:** e2e seeds (§ 7) and the map spec's word-stop count (+1; 23 on `main`, `packages/core/src/map/mapModel.test.ts:61`).

## 11. Acceptance criteria

**Core (vitest):**

1. Both canon files parse 8/8, with targets and chips as § 5. A problem of either type without `blend` is rejected.
2. Migration: a doc with `blending-cv: 'mastered'` and no `sounding-out` loads with it `'mastered'`, and the picker still returns the stored current step. A doc with `blending-cv: 'practicing'` loads with it `'locked'`. A stored value is never changed.
3. At a session end, `blending-cv` mastering takes `sounding-out` from `'locked'` to `'intro'`, and `sounding-out` mastering takes `cvc-words` to `'intro'`.
4. The Word Song land count is unchanged, and land 2 holds 2 nodes. `PATH_LINES` and `GUIDANCE_LINES` hold § 9's texts.

**Native (jest):**

5. Stop 1 P1: "Listen.", then the clip plays and stops at `segments[2].off + 80`. f, a and n light and stay lit until the cut. The chips open after. No picture on the card.
6. Stop 1 2nd wrong: the whole clip plays with one letter lit at a time. A right tap reveals the picture and plays "Yes! That's a fan.".
7. Stop 2 P3: "What is it?". A tap on m plays segment 0 of `m - a - t ... mat`. 2nd wrong: three sounds and no word.

**Device:**

8. A 375×667 and 667×375 pass of both stops: the picture springs in without overlapping the letters. Reduce Motion gives the bracketed forms.

## 12. Thomas decides

- **T1. Name:** stop 2 is "sounding out" (`sounding-out`). It adds the spoken words _sounding_ and _out_. Stop 1 stays "blending sounds"; land 2 stays "Land 2: Blending".
- **T2. Lily budget:** 31 texts, 773 characters as counted, about 812 as sent. **Approve up to 1,000**, so that one retake round on the six blends fits. `--dry-run` prints the real figure before any spend.
- **T3. Clay piece:** a toy xylophone with three bars and a mallet (§ 1).
- **T4. Migration:** a learner who has mastered blending sounds gets sounding out marked done. They are never sent back, and they can replay it from the map.
- **T5. The look:** in both stops the card shows letters only, and the picture appears on the right tap. This is the land's one visible change, and it is judged on device.

**No picture spend:** every target and chip already has a pack picture ($0).
