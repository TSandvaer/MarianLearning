# Practice variety without the live planner: pool sizes and picker rules

Date: 2026-10-23. Author role: child psychologist (research only). The engineering cost, meaning clips, bake time and storage, is sized separately in `design/native/no-claude-sizing.md` (Kevin, branch `kevin/no-claude-sizing`). This note gives only the pedagogical minimums that sizing should use.

## Question

For a store release with no Claude API, every session is built on the device from a baked pool per step. For any learner of about 6-9, three things need answering:

- How big must each step's pool be?
- What rules must the on-device picker follow so that practice stays effective and does not feel repeated?
- What does the device lose compared with the live planner?

## Bottom line

- **The repetition problem is the pool, not the missing planner.** Today each step bakes one 8-problem plan. The live planner ran in only four cases: the cat-words check, add-to-10 Leitner hints, slow-fact hints and the letter-sounds vowel (`api/claude.ts:912-975`, `api/_planner.ts:705-729`). Every other session replays the same 8 problems in the same order.
- **Pool sizes.** Closed fact steps need their whole fact set (Leitner can only schedule facts it can reach). Open number steps need ≥24 problems, which is 3 sessions × 8, the mastery minimum. Decoding word steps need ≥12 words, so that consecutive sessions share at most half their words.
- **Totals:** Number Garden **366** (today 136), Word Song **425** (today 212).
- **Picker.** It must be deterministic and per learner. It picks the least-recently-seen items, caps new and fragile items per session, never repeats an order, and promotes a Leitner fact at most once per day.
- **The cat-words check** needs 6 unpractised probe words with a pass at 5 of 6, plus a disjoint second set for a retake. That means 12 probe words in reserve. The fixed set of 4 is not enough.
- **Losing the planner costs almost nothing for learning.** All the planner's composition rules are deterministic, and the device can enforce them more strictly than Haiku did.

## Ground truth (this repo, 2026-10-23, main `59a767b6`)

- **Canon.** Each canon file holds exactly 8 problems (`public/canon/math/level-1/*.json` 17 files, `public/canon/word-song/level-1/*.json` 28 files). `letter-sounds-audit.json` is an audit plan (12 problems), not a step. Within a file some read lines repeat:
  - `letter-sounds` asks /o/ twice.
  - The three digraph files each repeat one word (chin, ship, thin).
  - `blending-cv` uses the **same 8 words** as `cvc-words` (hat fan man van cat bag pan tag), so by the time a learner reaches cat words she has already heard and picked every one of them.
- **Planner lists, larger than canon:**
  - add-to-10: 44 facts (`api/_planner.ts:1691`)
  - add-to-20, sub-to-10, sub-to-20: 22 each (`:1775`, `:1857`, `:1914`)
  - two-digit no-regroup: 36 (`:2001`); with-regroup: 30 (`:2117`)
  - short o/u/i/e: 11/11/8/9 words (`api/_plannerWordList.ts:66,89,117,159`)
  - sight words: 20 (`:399`); simple sentences: 40 (`:610`)
- **Planner lists, same as canon.** The eight big-words steps' planner list *is* the 8 canon words (`packages/core/src/wordSong/bigWordsSteps.ts`, `bigWordsOf`). There the planner could only reorder.
- **Canon-only steps, the same every session by design:** div-share, hundreds, hundreds-addsub, hundreds-zeros, add-two-digit, sounding-out and the five story steps (`api/_planner.ts:170-186`, `:191-197`, `:220-238`).
- **Mastery.** A step is mastered on 3 good days at ≥87.5% (`packages/core/src/progress/parentSettings.ts:64-65`). With cross-day enforcement off, 3 good *sessions* count, which allows mastery in one afternoon. The default is on (`:95`); Marian's device has it off.
- **Marian's backup** (`tmp/marian-backup.json`, aggregates only):
  - 30 sessions over 4 days, 19 of them on 2026-10-23. **All 30 scored 100%.**
  - In 7 of the 9 steps she played, every session of that step had the identical sequence. That includes cat words: 6 sessions on 2026-10-23, all the same 8 words in the same order.
  - The cat-words check never fired (`cvcGraduationSessionFired: false`).
  - Leitner box: 47 facts, all + and −. By box: 1: 3, 2: 8, 3: 22, 4: 9, 5: 5. At export, 6 were due.
  - Of the 28 facts she first met on 2026-10-23, **17 were in box 3 or 4 by that evening.** Today a fact promotes on every first-tap-correct answer, due or not (`packages/core/src/sessionEnd/progressHistory.ts:653-659`).
- **What already exists on device.** The device already picks canon blocks for the review, warm-up and times-mix sessions (`packages/core/src/progress/reviewPlan.ts:1-25`). That picker is the natural home for the rules below.

## 1. Pool size per step

"Today" counts the distinct items in the step's canon file. "Recommended" is the minimum number of distinct items, each a problem with its baked lines. "Closed" means the content is a finite set the learner must fully master. "Open" means the items are samples of a procedure or skill.

Three rules give the sizes:

- **Closed fact sets:** the whole set at the step's level, so the Leitner box can bring every fact in.
- **Open number steps:** 24 = 3 sessions × 8. A learner then meets no repeat before the 3-good-day mastery minimum.
- **Decoding word steps:** 12. With least-recently-read picking, two consecutive sessions share 16 − N words: 4 of 8 at N = 12. Each word is then read about twice over 3 sessions, which supports word memory (Nation et al. 2007). It also clears the cross-vowel spec's floor of 11 per tier (`packages/core/src/progress/mastery.ts:1087-1089`).

### Number Garden

| Step | Today | Planner list | Recommended | Closed/open | Why |
|---|---|---|---|---|---|
| number-recog | 8 | 1-10 (`_planner.ts:1688`) | 10 | closed | All ten numerals. Today's file never asks 8 or 10. |
| add-to-10 | 8 | 44 | 44 | closed | The full fact set. A make-ten item is the same fact asked as a missing number. |
| add-to-20 | 8 | 22 | 22 | closed (app level) | The vetted pool. Missing-number items reuse the same facts. |
| sub-to-10 | 8 | 22 | 22 | closed | Vetted pool. |
| sub-to-20 | 8 | 22 | 22 | closed | Vetted pool. |
| two-digit-addsub-no-regroup (`two-digit-addsub.json`) | 8 | 36 | 36 | bounded | Vetted pool. The lint already checks it (`scripts/compositionLint.ts:2204`). |
| two-digit-addsub-with-regroup | 8 | 30 | 30 | bounded | Vetted pool (`compositionLint.ts:3337`). |
| skip-counting | 8 | rule only (`:2213`) | 24 | closed per stride | 8 sequences per stride (2s, 5s, 10s), varying length. |
| mult-2-5-10 | 8 | rule only | 15 | closed | Tables 2, 5, 10 × 1-5, the canon's range (products ≤ 20). |
| mult-3-4 | 8 | rule only | 12 | closed | {3,4} × {2..5}, both orders. Contains all 8 canon facts. |
| mult-6-9 | 8 | rule only | 16 | closed | {6..9} × {2..5}. The canon covers only ×2 and ×3. |
| mult-mix | 8 | composed from blocks (`wire/types.ts:186-191`) | 0 extra | closed | Draws from the three tables' 43. All 8 of its own canon facts are in that union. |
| div-share | 8 | fixed 8 (`:2218`) | 17 | closed | 2-5 plates, 2-6 each, pile ≤ 20 (the canon's range). |
| hundreds | 8 | none (canon-only) | 24 | open | 3 fresh sessions to mastery. |
| hundreds-addsub | 8 | none | 24 | open | As above. |
| hundreds-zeros | 8 | none | 24 | open | As above. |
| add-two-digit | 8 | none | 24 | open | As above. |
| **Total** | **136** | | **366** | | |

### Word Song

| Step | Today | Planner list | Recommended | Closed/open | Why |
|---|---|---|---|---|---|
| letter-names | 8 | 52 glyphs (`compositionLint.ts:4661`) | 52 | closed | Upper and lower case of all 26. |
| letter-sounds | 7 | 19 (`wordSong/letterSoundsPool.ts`) | 19 | closed (v1 set) | 14 consonants and 5 short vowels. Each vowel needs ≥2 blocks so the target-vowel rule can run on device. |
| blending-cv | 8 | stub | 12 | open | Short-a CVC words with pictures. Never a cat-words probe word. |
| sounding-out | 8 | none (canon-only) | 12 | open | As above. |
| cvc-words (cat words) | 8 | 14 + 4 probes | 26 | open | The existing 14-word pack plus 12 probe words held out (§2.4). |
| cvc-words-short-o | 8 | 11 | 12 | open | Overlap rule. |
| cvc-words-short-u | 8 | 11 | 12 | open | As above. |
| cvc-words-short-i | 8 | 8 | 12 | open | As above. |
| cvc-words-short-e | 8 | 9 | 12 | open | As above. |
| digraphs-sh | 7 | 7 | 12 | open | As above. |
| digraphs-ch | 7 | 7 | 12 | open | As above. |
| digraphs-th-voiceless | 7 | 7 | 12 | open (few picturable words) | If fewer than 12 short-vowel th words can be pictured, accept 10 and fill slots with sh/ch review words. |
| sight-words | 8 | 20 | 20 | closed (the app's list) | Whole-word memory items, cumulative. |
| simple-sentences | 8 | 40 | 24 | open | Must include the 9 scene sentences (3 gentle slots per session × 3 sessions). The 40 already written cover it. |
| duck, crab, tent, cake, bee, car, snail, moon words | 8 each | 8 each (= canon) | 12 each = 96 | open | Overlap rule. Today the planner could only reorder these 8. |
| fox, hen, bug, sheep, goat stories | 8 each | none (canon-only) | 16 each = 80 | open | 8 stories × 2 questions each (see below). |
| **Total** | **212** | | **425** | | |

**Stories.** Re-reading the same story is fine: guided repeated reading improves word recognition, fluency and comprehension (NRP 2000). The *question* must change, or the answer comes from memory. Two questions per story doubles the problems without new scene art.

## 2. Picker rules (on device, per learner)

### 2.1 All steps

1. **Size and repeats.** 8 problems per session, no item twice in a session. Never the same items in the same order as that learner's previous session of the step. Marian replayed one sequence 6 times in a day.
2. **Least recently seen first.** Rank the step's pool by when *this learner* last saw each item, then take the 8 lowest. Same-day replays prefer items not yet seen today.
3. **Keep each step's ramp.** Easy items go in slots 1-3, trap-band items in slots 4-8 (the existing per-step designs). Also keep the continuant-onset-first order for CVC words (`api/_planner.ts:244`).
4. **Hard constraints.** The planner prompt's composition rules become hard checks on the device, using the same caps that `scripts/compositionLint.ts` enforces: category caps, dual-exposure, and the b/d share for letters. Haiku broke these caps in practice (`api/_planner.ts:1715`, `:1809`). Code will not.
5. **Per-learner state.** Keep a per-learner seen-record for each item (last day, count, last result). The app is multi-user, so nothing is keyed to one child.

### 2.2 Math facts (Leitner)

1. **Slots 1-3:** facts the learner answers reliably (box ≥3, easy band).
2. **Slots 4-8, in this order:**
   1. Due box-1 and box-2 facts, at most 3. This is the existing cap (`packages/core/src/progress/leitner.ts:245`), from `design/research/leitner-interval-tuning-marian.md` §6.
   2. At most 2 new facts from the step's pool. Few unknowns among known items gives the best retention (MacQuarrie et al. 2002, incremental rehearsal).
   3. Due box 3-5 facts, the most overdue first.
   4. If slots remain, not-yet-due facts from the lowest box. At least 3 of the 8 are always known facts.
3. **No fact twice in a session.** As a judgment call (no study), I would also not put a fact's turnaround (3+4 and 4+3), or its missing-number twin, in the same session, because the second gives away the first.
4. **Spacing.**
   - A fact promotes at most once per calendar day, and only when it was due. A correct answer on a fact that is not due keeps its box.
   - A wrong answer still sends it to box 1.
   - Why: today 17 of Marian's 28 new facts reached box 3-4 in one afternoon. The box intervals (3 and 7 days, `leitner.ts:125-133`) then treat that massed practice as if it were spaced, and keep those facts out of review for up to a week. Massed repetition gives less retention than the same number of spaced repetitions (Cepeda et al. 2006).
5. **Warm-up stays as built.** The first session of the day opens with up to 2 overdue facts from earlier steps (`reviewPlan.ts`).

### 2.3 Words

1. **Overlap.** Least-recently-read words first. At most 4 of 8 targets also appeared in the learner's previous session of the step; a pool of 12 makes this automatic. Never the same order, and never the same word in the same slot.
2. **Repeats across sessions are allowed and useful.** A word may come back in consecutive sessions, because more exposures build word memory (Nation et al. 2007). A word read wrongly last session comes back first in the next one.
3. **New words in decoding steps are welcome, not rationed.** Reading words never seen before *is* the skill. Practising on varied words improved first graders' reading of new words (Apfelbaum et al. 2013).
   - Session 1 of a step: all 8 words are new.
   - Later sessions: at least 2 never-read words, while any remain.
4. **Sight words are memory items, so ration them:** 1-2 new words per session among known ones (incremental rehearsal). A word leaves rotation after it has been read right on 3 separate days.
5. **Interleaving.**
   - From the short-o step on, slots 4-8 carry 1-2 words from earlier vowel steps. The existing `crossVowelMixingEnabled` setting covers this. The point is that the learner must look at the vowel, and mixed practice roughly doubled children's next-day scores (Taylor & Rohrer 2010).
   - The same applies to the digraphs (sh, ch and th mixed) and the big-words land.
6. **Pictures.** The existing distractor rules (`FORBIDDEN_PAIRS`, `TARGET_PAIRINGS`) apply unchanged.

### 2.4 The cat-words generalisation check

**Today.** There are 4 fixed probe words, nap, rat, map and tap (`packages/core/src/wordSong/novelProbeWords.ts:12`). The pass threshold is 80% (`mastery.ts:119`), so with 2-4 probe words a pass means every probe word right.

**How reliable each design is.** Chance of passing, binomial, by the learner's true accuracy on new words. These are my own calculations.

| Probe design | 50% (a guesser) | 60% | 75% | 90% (a decoder) |
|---|---|---|---|---|
| 3 words, 3/3 | 0.12 | 0.22 | 0.42 | 0.73 |
| 4 words, 4/4 (today) | 0.06 | 0.13 | 0.32 | 0.66 |
| **6 words, ≥5/6** | 0.11 | 0.23 | 0.53 | **0.89** |
| 8 words, ≥7/8 | 0.04 | 0.11 | 0.37 | 0.81 |

With 4 words, **one real decoder in three fails**, and a failed check holds a learner back on a step she can do. Six words passed at 5 of 6 (83%, still ≥ the 80% threshold) lets 89% of decoders through and 11% of guessers.

**Recommendation:**

- Use 6 probe words across two consecutive check sessions: 3 probe words and 5 practised words each, which feels like today's sessions.
- A retake uses a **disjoint** set of 6, so reserve **12 probe words** per learner track.

**Is one fixed set enough for many learners?** Sharing the list across learners is fine: each learner meets the words fresh. It falls short for three other reasons:

1. 4 items are too few for a reliable decision (the table above).
2. A failed attempt uses up the words.
3. A probe word stops being unpractised as soon as the learner meets it anywhere. nap, rat, map and tap are all said-picture words in the Play place's Letter Critters game (`packages/core/src/games/playPlace.ts:304-313`) and in its CVC word list (`:231`).

So the picker must draw each learner's probes from the reserve, skipping any word that learner has already met in any step or game. Building the check on the device also removes its dependence on a planner run, which is why it never fired for Marian.

## 3. What on-device selection cannot give, and whether it matters

1. **The planner barely ran.** It was skipped for all but the four cases above. In practice the live planner supplied almost none of the variety, as Marian's 7-of-9 identical steps show. **No learning loss.**
2. **Rule-following moves to code and gets better.** Every planner rule is deterministic text and can be ported as code:
   - category caps
   - the Leitner weighting (`isLeitnerDirectiveActive`)
   - slow facts
   - the letter-sounds target vowel (`deriveCurrentTargetVowel`)
   - the continuant-onset order
   - the probe mix

   The hints are already deterministic templates (`api/_planner.ts:2224-2226`). Code enforces the caps every time, where Haiku sometimes broke them (`:1715`). **A gain.**
3. **New items beyond the pool are lost.** An LLM can invent new number problems. It could never invent new words, because words need pictures and every word list was fixed. Without runtime voice, a new number problem has no Emma audio either. So the baked pool sets the ceiling, as it did in practice. **Matters only through pool size, which §1 covers.**
4. **Fresh wording of Emma's chatter and praise is lost.** I know of no evidence that varied praise wording changes learning. It may change how the app feels, which is for your ear. A few baked variants per line type would cover it. **Minor.**
5. **The stumble explanation is lost.** The server accepts `stumble-explanation` and `session-end` (`api/claude.ts:750`), but I found no call site in `mobile/` or `src/`. The 3-step hint ladder and the reveal stay, and progress is already computed on device (`progress/mastery.ts`). **Nothing lost** that the app uses today.

## Risks and counter-evidence

- **Single studies.**
  - Apfelbaum et al. (2013) is one large classroom study (224 first graders) on vowel learning. A later adult lab study found the reverse, which the authors attribute to the children's prior school phonics.
  - Taylor & Rohrer (2010) is mathematics with fourth graders. A 2019 meta-analysis found the interleaving effect positive but small and design-dependent.
  - The incremental-rehearsal evidence taught vocabulary words (Esperanto), not decodable words. That is why I apply it to sight words and facts, not to decoding steps.
- **The probe numbers are a model.** They assume probe words of equal difficulty, scored independently. Real words differ, so treat the pass rates as approximate.
- **Expect lower first scores.** A bigger, mixed pool will at first pull scores below today's 100%. That is expected: mixed practice lowers practice scores while raising later test scores (Taylor & Rohrer 2010). Mastery may take a session or two longer, and that time is real practice. A run of 100% sessions on one repeated plan does not measure decoding or retrieval.
- **Where the sizes come from.** The open-step size of 24 and the word size of 12 come from the mastery rule and the overlap arithmetic above, not from a study that measured pool size.
- **Picturability** may cap th words (and possibly other steps) below 12. That is your picture-pack call.

## Recommendations

1. Bake the pools in the two tables: Number Garden 366, Word Song 425. Order: cat words with its 12-word probe reserve first, then the short-vowel and big-words steps, then the open number steps.
2. Extend the existing on-device block picker (`reviewPlan.ts`) to forward sessions, using rules 2.1-2.4 per learner.
3. Change Leitner promotion to at most once per day and only when due (rule 2.2.4).
4. Exclude probe words from every other step and from the Play place for learners who have not yet passed the check.

## Sources

- Apfelbaum, K. S., Hazeltine, E., & McMurray, B. (2013). Statistical learning in reading: Variability in irrelevant letters helps children learn phonics skills. *Developmental Psychology*, 49, 1348-1365. doi:10.1037/a0029839. https://iro.uiowa.edu/esploro/outputs/journalArticle/Statistical-Learning-in-Reading-Variability-in/9984070786302771. **Moderate.**
- Taylor, K., & Rohrer, D. (2010). The effects of interleaved practice. *Applied Cognitive Psychology*, 24, 837-848. doi:10.1002/acp.1598. https://digitalcommons.usf.edu/psy_facpub/1760/. **Moderate.**
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3), 354-380. https://www.yorku.ca/ncepeda/publications/CPVWR2006.html (URL as cited in `design/research/cvc-review-mode-mechanic.md:46`). **Strong** (meta-analysis).
- MacQuarrie, L. L., Tucker, J. A., Burns, M. K., & Hartman, B. (2002). Comparison of retention rates using traditional, drill sandwich, and incremental rehearsal flash card methods. *School Psychology Review*, 31(4), 584-595. https://experts.umn.edu/en/publications/comparison-of-retention-rates-using-traditional-drill-sandwich-an/. **Moderate.**
- Nation, K., Angell, P., & Castles, A. (2007). Orthographic learning via self-teaching in children learning to read English: Effects of exposure, durability, and context. *Journal of Experimental Child Psychology*, 96, 71-84. doi:10.1016/j.jecp.2006.06.004. https://researchers.mq.edu.au/en/publications/orthographic-learning-via-self-teaching-in-children-learning-to-r/. **Moderate.**
- Share, D. L. (1999). Phonological recoding and orthographic learning: A direct test of the self-teaching hypothesis. *Journal of Experimental Child Psychology*, 72(2), 95-129. https://cris.haifa.ac.il/en/publications/phonological-recoding-and-orthographic-learning-a-direct-test-of-/. **Moderate.**
- National Reading Panel (2000). Report, chapter 3: Fluency. https://www.nichd.nih.gov/sites/default/files/publications/pubs/nrp/Documents/ch3.pdf. **Strong** (meta-analysis), but it covers *guided oral* repeated reading, so the fit to app stories is partial.
- In repo: `design/research/leitner-interval-tuning-marian.md` (interval and per-session cap) and `design/native/review-mode-and-warmup-native.md` (the on-device block picker).
