# Engagement and side mini-games (2026-10-19)

## Question

Thomas, 2026-10-19 (verbatim): "Marian have just emerged herself in the app on my ipad. This is the first time i feel she wants to start. The peaking of other subjects (lands/island) is a big help to not make her bored. the level she is on (level2) is actually too easy even though she is still counting on her hands for questions like 3+2. I wonder how we can make the app 'Not boring' for children (but we are a long way she really likes it and I can see the joy in her when she answers correctly and gets gratified by emma). I have some thought about adding some mini games for casual fun on the side of the 'Numbers garden' and 'Word song' paths."

Four questions, one recommendation each:

1. A step is "too easy" while she still counts 3+2 on her fingers. What does that mean for a 6-9 learner, and what should the app do?
2. What keeps 6-9 year olds engaged without dark patterns, and what backfires? Which shipped features already do the right thing?
3. Should side mini-games exist? If yes, what must they be, how do they connect to the paths, how long may a child play them, and which games fit each world?
4. What must hold true, and how would we know it is working?

**Scope.** The app is multi-user: any learner of about 6-9. Marian is one of them and the trigger for this note. Nothing here depends on one child's school or language. **Labels:** **[evidence]** is a cited source. **[my reasoning]** is my own judgement, with no single study behind it.

## Bottom line

1. **"Too easy" with fingers on 3+2** means she _knows how_ to add but does not yet _know the facts by heart_. Let accuracy move her on (the fast track, as shipped). Spaced review and strategy play then turn counting into recall. Never add a clock, and never link fingers to "not yet".
2. **What keeps children this age going:** challenge that is the right size, real choice, informational feedback from a warm character, the same content in varied forms, and glimpses of what comes next. **What backfires:** expected prizes, "do this to earn that" rules, lures to stay, timers, and decoration that competes with the content. The shipped app already does most of the first list.
3. **Yes to mini-games, as practice in play form.** They use the same taught facts and words, come in short rounds with a fixed end, and have no timer, no fail state and no currency. They count toward nothing. A game opens as soon as the step it practises is current or mastered, and it is never locked behind a lesson or given as a reward for one. Four ideas per world follow, and three ideas are rejected.
4. **Signals Thomas can see without testing his child:** who starts the session, whether lessons still happen most days, the mix between lessons and games, how hard stopping is, and whether fingers fade on their own over weeks.

---

## 1. "Too easy" while finger-counting 3+2

### Recommendation

**Treat "too easy" as a pacing signal, not a fluency signal.** Let accuracy move the learner forward, as the fast track already does. Let spaced review, the warm-up and the mini-games of § 3 do the counting-to-recall work after she has moved on. Nothing slows her down because of fingers. Nothing speeds her up with a clock.

### What it means

- **Two kinds of "knowing" [my reasoning, grounded below].**
  - _Knowing how:_ she can solve 3+2 every time, by counting.
  - _Knowing by heart:_ she retrieves 5 without counting.
  - At 8 she has the first and not yet the second. "Too easy" is the first one saturating: the same items, solved by the same routine, with no new demand.
- **Fingers at 8 are a scaffold on its way out, not a deficit [evidence].**
  - Poletti et al. (2025) found finger counting trains addition, and children who later dropped their fingers on their own outperformed children who never used them.
  - The link between finger use and skill turns around at about 8-9. The transition happens through accumulated retrieval experience, not by removing the scaffold. (`speed-feedback-automaticity-marian.md` Source 7.)
- **Derived-fact strategies predict recall better than counting does [evidence].**
  - In Gaidoschik's (2012) longitudinal study of 139 first graders, children who used derived facts on a task by mid-grade-1 later retrieved that task's answer from memory more often than children still counting on. One example of a derived fact: 4+4 = 8, so 4+5 = 9.
  - The classrooms in the study did not teach the strategies on purpose.
  - Doubles, +1 and make-ten are the levers.
- **Under-challenge costs more than mild struggle [evidence].**
  - Baker, D'Mello, Rodrigo & Graesser (2010) observed students in three learning environments, in the Philippines and the USA. Boredom was the most persistent state, and it was linked to poorer learning and to "gaming the system". Frustration was less persistent and less harmful.
  - Wilson et al. (2019) give a computational argument that learning is fastest at about 85% accuracy. This is a model of simple tasks, not a child study, and the lead author has warned against reading it as a grade target. It only supports the direction: a learner at about 100% is below the useful challenge.
- **Hypothesis:** "level 2" is Marian's second Number Garden stop, _adding to ten_. `number-recog` is mastered in the diagnostic baseline (`packages/core/src/progress/defaults.ts`), and 3+2 matches it. Its canon opens 1+2, 2+2, 3+2 (`public/canon/math/level-1/add-to-10.json`, p1-p3). Thomas to confirm (§ 5).
- **Variety is thinnest exactly here [read from the spec].**
  - The same-day mixed review stays off until a step beyond the baseline is mastered. For maths, that step is `add-to-10` (`design/native/review-mode-and-warmup-native.md`, "With the default profile").
  - A learner on her first real maths step therefore meets one step's facts and nothing else. The only exception is the warm-up, which draws on the same facts.

### What the app should do

- **Pacing.** Keep the fast track as shipped (`design/native/fast-track-native.md`): 8/8 on the first tap on 2 separate days finishes a step. Keep Recommendation 7 of `speed-feedback-automaticity-marian.md`: latency is never a promotion gate. Moving on to add-to-20 and making tens is _part of the treatment_ for slow add-to-10 facts, because those steps reuse them.
- **Retrieval after moving on.** The warm-up (Leitner-due facts, the current step included) and, once add-to-10 is mastered, the mixed review keep these facts coming back across days. This is spaced retrieval, which is what turns counting into recall (`speed-feedback-automaticity-marian.md` Source 5).
- **Mixed review.** Unchanged. It turns on by itself after her first non-baseline mastery, which also ends the "one step only" stretch above.
- **Peeks.** Keep them as they are. Thomas reports they are the thing that stops her being bored (§ 2 explains why).
- **Strategy talk, never finger talk.**
  - Emma may name a _trick_ ("Four and four is eight. One more is nine!") in the mini-games of § 3, and later in hints if Kyle wants.
  - She praises the noticing ("You saw the double!"), never the speed.
  - No line mentions fingers, says "try without counting", or ties counting to "not yet". The fast-track spec's framing rule stands: Emma notices growth, not speed.
- **No speed signal.** As locked: no timer, no "fast", no chip colour, no haptic urgency (`speed-feedback-automaticity-marian.md` Recommendation 1). This holds in the mini-games too.

---

## 2. Engagement without dark patterns

### Recommendation

**Build engagement from five sources only:** right-sized challenge, real choice, informational feedback, variety of the same content, and curiosity glimpses. **Ban four things:** expected prizes, earn-to-play contingencies, lures to stay or return, and time pressure. Measure every new feature against both lists before it ships.

### What works for 6-9 year olds

| Source                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         | Already shipped                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Competence feedback:** "you got it", from someone who cares | **Deci, Koestner & Ryan (1999)**, 128 studies. Verbal, informational feedback did not harm intrinsic motivation, while expected tangible rewards did. Strong. **Hirsh-Pasek et al. (2015)** list four pillars of learning apps: active ("minds-on", not just tapping), engaged (not distracted), meaningful, and socially interactive. Review.                                                                   | Emma's reactions (a head tilt and a smile on a right answer, a puzzled look and never a red X on a wrong one). Stars per right answer. The fast track's "You know this! All your flowers grew!"                                                                                                                                                         |
| **Right-sized challenge**                                     | **Baker et al. (2010)**: boredom persists and hurts more than frustration. Moderate (observational, 3 environments). **Wilson et al. (2019)**: the 85% model. Theoretical.                                                                                                                                                                                                                                       | The fast track (#568) and the ≤ 5/8 pace guard.                                                                                                                                                                                                                                                                                                         |
| **Choice / autonomy**                                         | **Patall, Cooper & Robinson (2008)**, 41 studies. Choice raised intrinsic motivation, effort and perceived competence, more so for children and with 2-4 options. Strong.                                                                                                                                                                                                                                        | Two worlds, both always open, with one suggested. Map tap-to-play: the current stop plays and a mastered stop replays (#592).                                                                                                                                                                                                                           |
| **Curiosity:** a glimpse of what is next                      | **Loewenstein (1994)**: curiosity comes from noticing a gap in what one knows, and it needs some knowledge to start from. Review / theory.                                                                                                                                                                                                                                                                       | The Map peek (#568): 3 problems of any later stop, recorded nowhere. **My reasoning:** this is why Thomas sees peeks help. A peek opens a small gap ("there is more, and I almost know it") and closes it at once, with no lock that nags and no prize. Its rules — no caps, no glowing padlocks, no "come back" — keep curiosity from becoming a lure. |
| **Variety of the same content**                               | **Taylor & Rohrer (2010)**: mixed practice roughly doubled children's next-day scores (cited in `review-mode-and-warmup-native.md`). Moderate. **Hamari, Koivisto & Sarsa (2014)** name novelty effects as one of three recurring caveats in gamification studies. **Rodrigues et al. (2022)** saw a gamification effect dip after about 4 weeks and partly recover (756 university students). Moderate, adults. | The mixed review and the daily warm-up (#566). New lands and steps arrive with each content wave.                                                                                                                                                                                                                                                       |
| **Narrative / journey**                                       | **Clark, Tanner-Smith & Killingsworth (2016)**, K-16 meta-analysis. Games beat non-game instruction (g = 0.33), and the effect varied with game mechanics and with visual and narrative features. Simple visuals were as good as or better than complex ones (per the authors' own commentary). I found no strong evidence that a story layer itself raises learning.                                            | The lands and islands of the Map. Keep the journey **light**: it orients and motivates, and the content does the teaching.                                                                                                                                                                                                                              |

### What backfires

- **Expected tangible rewards [evidence, strong].**
  - Deci et al. (1999): completion-contingent rewards lowered free-choice interest (d = -0.36), and so did performance-contingent ones (d = -0.28).
  - The classic preschool study is Lepper, Greene & Nisbett (1973): children who expected a reward for drawing later drew less on their own.
  - **Stardust stays feedback, never currency.** I found no shop or spend anywhere in `packages/core/src` or `mobile/src` (grep, 2026-10-19). Keep it that way (`guidance-layer-2026-10-06.md` Recommendation 3).
- **"Do this to earn that" [evidence, moderate].** Lepper, Sagotsky, Dafoe & Greene (1982) ran three studies with young children. One activity was presented as the way to earn a second activity that the children had liked equally at the start. The children showed "some tendency to discount interest in the activity presented as a means" (abstract). The effect is modest, but it bears directly on § 3: **lessons must never be the price of games**, or lessons become the chore.
- **Lures and nagging [evidence, moderate].**
  - Radesky et al. (2022) coded manipulative design in about 4 of 5 apps used by 3-5 year olds. Their examples include "come back tomorrow and get a dragon" and characters pressing idle children to keep playing.
  - The UK ICO Age Appropriate Design Code has a "nudge techniques" standard against nudging children to spend more time on a service. The code also endorses nudges that help, such as break prompts. I read summaries of the code, not its current text.
- **Time pressure [evidence, strong].** See `speed-feedback-automaticity-marian.md`. Visible speed pressure blocks the working memory a counting child needs.
- **Decoration that competes with content [evidence, moderate-strong].** Rey (2012) meta-analysed the "seductive detail" effect: interesting but irrelevant material lowered retention and transfer. Secondary sources report small-to-medium effects, larger for visual details. I did not read the paper's own figures. Mini-games are the place where this risk is highest.
- **Variable prize schedules and loss mechanics [my reasoning].** Spins that pay prizes, mystery boxes, and streaks that can be lost turn play into a slot machine or a debt. The project already locks fixed thresholds and "never lost" progress (`math-distractor-and-streak-decisions.md`, `guidance-layer-2026-10-06.md`). The same rule covers games.

---

## 3. Side mini-games

### Recommendation

**Yes, build them, as the same taught content in play form.** Concretely:

- each game uses only the facts and words of steps that are **current or mastered**;
- it plays in **fixed short rounds**, with **no timer, no fail state, no currency and no streak**;
- it **counts toward nothing**;
- it is **open as soon as its step is reached**, never locked behind or paid for by a lesson;
- and it is **one side door per world**, which Emma never suggests.

### Why they should exist

- **Practice that _is_ the game teaches; practice glued onto a game does not [evidence, moderate].**
  - Habgood & Ainsworth (2011) built _Zombie Division_, a maths game for 7-11 year olds, in two versions. In the _intrinsic_ version, the maths was the game mechanic. In the _extrinsic_ version, the same maths came as quiz questions between game levels.
  - Study 1 (N = 58) gave fixed time: the intrinsic version produced more learning. Study 2 (N = 16) gave free choice: children played the intrinsic version about **7 times longer**.
  - Cutting & Iacovides (2022) ran a pre-registered study (N = 210) on an abstract learning task. The intrinsic version again produced more learning, but they attribute the gain to attention, not motivation. I could not confirm the participants' ages.
  - Either way, the design rule is the same: **the answer must be the move.**
- **Games work best beside instruction, not instead of it [evidence, strong].**
  - Wouters, van Nimwegen, van Oostendorp & van der Spek (2013), 77 studies: serious games beat conventional instruction for learning (d = 0.29) and retention (d = 0.36). They were **not** more motivating overall.
  - Gains were larger when games _supplemented_ other instruction and when play ran over several sessions.
  - That is exactly the "on the side of the paths" position Thomas proposes.
- **Specific play forms with evidence [evidence].**
  - _Linear number board games._ Siegler & Ramani (2008, 2009): about four 15-20 minute sessions of a numbered linear board game improved low-income preschoolers' number knowledge. Circular or colour-only boards did not. These children are younger than ours, so the evidence for 6-9 is indirect.
  - _Word Building._ McCandliss, Beck, Sandak & Perfetti (2003): the children changed one letter at a time to move through chains of minimal pairs (e.g. _sat → sap → tap → top_). Struggling readers past grade 1 gained more in decoding, comprehension and phonological awareness than a randomised control group.
  - _Phonemic awareness with letters._ Ehri et al. (2001), National Reading Panel meta-analysis: phonemic-awareness teaching worked better with letters than without. Secondary sources report about twice the effect size; I did not check the exact figure.
- **They fill the variety gap of § 1 [my reasoning].** A learner on her first real step has no mixed review yet. A game that plays add-to-10 as ten-frames and doubles brings the same facts back in a new form, without adding steps or speed.

### What every game must be (guard rails)

| Rule                                                                                                                                        | Why                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content from current and mastered steps only**, never later ones                                                                          | Untaught content in a no-fail game either teaches without scaffolds or quietly fails. The Map peek is the one place for later steps. [my reasoning] |
| **The answer is the move** (intrinsic integration)                                                                                          | Habgood & Ainsworth (2011). No quiz-then-reward split.                                                                                              |
| **No timer, no countdown, nothing that floats away or runs out**                                                                            | `speed-feedback-automaticity-marian.md`. A bubble that escapes is a timer.                                                                          |
| **No fail state, never a red X.** A wrong move does nothing or gently undoes, and Emma reacts in character                                  | Project principle. A constraint (a bed that cannot overfill) is not a fail.                                                                         |
| **No currency, no prizes, no stardust, no unlockables, no streak**                                                                          | Deci et al. (1999). The game is the reward.                                                                                                         |
| **Fixed short rounds** (about 6-10 moves, roughly 1-3 minutes) with a clear end, then back to the world                                     | No autoplay, no "one more?" and no score to beat (Radesky et al. 2022; the ICO nudge standard). [the lengths are my reasoning]                      |
| **Audio-first, picture-first**: Emma says every prompt, no reading is needed except in the reading games, and those use mastered words only | Audio-first project principle, for non-readers and L2 learners.                                                                                     |
| **Touch fit for 6-9:** big targets, tap rather than precise drag where possible                                                             | Hand back to Kyle for sizes.                                                                                                                        |
| **Little decoration**: art supports the move, with no idle animations competing for attention                                               | Rey (2012); Clark et al. (2016) on simple visuals.                                                                                                  |
| **Per learner, no comparisons**: no leaderboard and no "your sister scored more"                                                            | Multi-user app (`design/native/learner-profiles.md`, PR #615, open). Social comparison is a pressure mechanic. [my reasoning]                       |

### How they connect to the paths

- **Unlocking.** A game appears when the step it practises becomes _current_ (so Marian gets Number Garden games now, not after add-to-10 is mastered). After that it draws on every current and mastered step of its world. There is no extra unlock beat, no padlock teaser, and no "new game!" line pulling her away from a session. Kyle decides whether the door shows its locked games at all. My lean is no: show only what is open.
- **Always available, not gated by today's lesson [evidence: Lepper et al. 1982].** "Finish your lesson to play" makes the lesson the means and the game the end, and lessons get discounted.
  - **Documented fallback, not built:** if Thomas sees games _displacing_ lessons (see § 4), the door opens after the day's first _finished_ session in that world, whatever the score. Emma frames it as the order of the day ("First our garden, then play!"), never as earning.
  - This is the same shape as the replay guard in `map-tap-to-play.md` D4.
- **Counted toward nothing.**
  - No flower, good day, secure day, pace guard, stardust or history entry.
  - **Leitner: read-only at most.** A game may pick due or slow facts to show more often, but it never promotes or demotes a box.
  - Why: one progress rule stays one rule (`guidance-layer-2026-10-06.md`). Games must not become the easy route to flowers. And accuracy in a different format is not comparable to the lesson's first tap. [my reasoning]
- **Placement.** One side door per world, smaller than the lesson card. The Hub's suggestion stays on the lesson, and Emma never suggests a game, a "break" or "more play". The exact surface (Hub card corner, the Map, a land) is Kyle's call.

### How long, compared with lessons

- **Recommendation [my reasoning; I found no study that sets a ratio]:** no visible cap and no countdown, because a visible cap is itself a timer and a loss. Use structure instead:
  - fixed rounds with a clear end and no auto-next;
  - Emma never invites another round;
  - lessons are the first door.
- **Target to watch, not enforce:** over a week, lessons stay at least about two-thirds of app time, and a lesson happens on most days she plays. If games pass that, use the fallback above.
- Lessons are already 10-15 minutes, so a few 2-minute rounds on the side keep a whole sitting near 15-20 minutes.

### Game ideas

Each idea names the step it practises and what it trains. Kyle sketches; these are pedagogical briefs, not specs.

#### Number Garden

1. **Fill the flower bed (make ten).**
   - **Steps:** add-to-10, then making tens.
   - **Play:** a ten-frame bed shows, for example, 7 flowers. Emma: "Seven flowers. Plant more to make ten!" She taps empty holes, and the bed blooms when it is full.
   - **No fail:** the bed cannot overfill; a tap on a full bed does nothing.
   - **Trains:** the missing-addend facts already in canon ("Seven and what make ten?", p4/p6/p8) and the ten-frame structure that lets a child see 7 without counting it. Later rounds use a double ten-frame for teens.
2. **Mirror bugs (doubles and near doubles).**
   - **Steps:** add-to-10, then add-to-20.
   - **Play:** a ladybird has spots on one wing. She taps the mirror, the other wing fills, and Emma asks "How many spots now?" Later rounds add one more spot: "Four and four is eight. One more?"
   - **Trains:** the derived-fact route of Gaidoschik (2012). This is the best single game for the "fingers on 3+2" learner, because it gives her a fact to reason from instead of a count.
3. **Bunny hop path (linear number game).**
   - **Steps:** numbers, add-to-10, add-to-20, later big numbers.
   - **Play:** a numbered path, 1-20 at first and later in tens. A spinner shows 1-3 dots, the bunny is on 6, and Emma asks "Hop three. Where will he land?" She taps the square and the bunny hops. The round ends at the carrot.
   - **Trains:** counting on and number-line position (Siegler & Ramani 2008, 2009).
   - **Check:** the spinner only picks the hop size. It must never pay a prize.
4. **Seesaw (make it level).**
   - **Steps:** add-to-10, add-to-20, then the take-away steps.
   - **Play:** 6 pebbles sit on one side and 4 on the other. She drops pebbles on the light side until the seesaw is level.
   - **Trains:** "=" as "the same as", and missing addends.
   - **Note:** I did not verify a source for this one; it is my reasoning that it fits.

#### Word Song

1. **Sound baskets (sort by sound).**
   - **Steps:** letter sounds, CVC words, then digraphs.
   - **Play:** Emma names a picture, and she drops it into the basket whose letter matches its first sound. Later rounds sort by the middle vowel (a vs o).
   - **Trains:** phonemic awareness _with letters_ (Ehri et al. 2001), and the cross-vowel discrimination the project already teaches (`cross-vowel-discrimination-threshold.md`).
2. **Robot talk (oral blending).**
   - **Steps:** blending, then CVC words.
   - **Play:** Emma's robot voice says /s/ … /u/ … /n/, and she taps the matching picture out of 3.
   - **Fit:** no reading at all, so it works for the youngest and for L2 learners.
   - **Audio check:** the robot sounds must reuse the project's tuned phoneme renders (`api/_tts.ts`, e.g. `BLEND_GRAPHEME_IPA`), not new isolated sounds. Thomas's ear is the gate.
3. **Magic letter (Word Building).**
   - **Steps:** CVC words, then digraphs.
   - **Play:** a picture-word, _cat_. Emma: "Make it hat!" Three letter tiles are offered. She swaps the first letter, and the picture changes to a hat. Later rounds change the last letter, then the vowel.
   - **Trains:** attention to every letter position (McCandliss et al. 2003).
   - **Rule:** every word in a chain must be a word she has met and a word with a picture (the project's picture-pairing rule).
4. **Feed the animals (read and match).**
   - **Steps:** CVC words, then the sight-word and story steps.
   - **Play:** three animals hold word cards (mastered words only). Emma says "Who has _dog_?", and she taps the card. Later rounds use a short sentence and two pictures.
   - **Fit:** this is the one reading game, so it only opens once a word step is mastered, not merely current.

#### Rejected: they pull time away from learning

- **Decorating a garden or dressing Emma with stardust.** Currency, plus decoration with no content (Deci et al. 1999; Rey 2012).
- **Bubble pop, fact races, anything that floats away.** A timer in disguise.
- **Memory card-flip (concentration).** It mostly trains visual memory, not facts or sounds, and it fails often by design. [my reasoning]

**Language note [my reasoning].** The mechanics (fill, mirror, hop, level, sort, blend, swap, match) are language-neutral. The Word Song content is English phonics, so the planned Danish version would swap the content, not the games.

---

## 4. What must hold, and how we would know

### Recommendation

**Watch a small set of everyday signals for 2-3 weeks after the games ship. Act on patterns, not single days.** Nothing here asks Thomas to set up a test. He reports what he already sees.

### Must hold (Jessica can check these on device)

- A game writes nothing to progress (the progress JSON is byte-identical before and after, as for the peek and the replay), and no stardust is granted.
- No game has a timer, a countdown, or something that runs out or escapes.
- Every item comes from a current or mastered step.
- A round ends on its own and returns to the world. No auto-next, and no Emma line invites another round.
- No game shows on the Hub as a suggestion. Emma's suggestion stays on the lesson.

### Good signs (Thomas)

- **She starts on her own:** she asks for the iPad to "do Emma", or opens a lesson without being told.
- **Lessons still happen** on most days she plays, and she usually finishes them.
- **Games are the side:** most sittings are mostly lessons, with games before or after.
- **Fingers fade on their own over weeks:** small sums answered without counting, at her pace, with no one asking. Expect weeks, not days.
- **She talks strategy:** "four and four, then one more", "it's a double".
- **Joy stays tied to answers and to Emma**, as Thomas sees now, not to prizes. She does not ask what stardust "buys".

### Warning signs, and the response

| Signal                                                                 | Likely meaning                        | Response                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| She goes to games first and skips the lesson on most days for a week   | Games displace learning               | Turn on the fallback of § 3: games open after the day's first finished session                                                                                                                                                                        |
| Upset or a struggle when the iPad has to stop, getting worse over time | A compulsion pattern starting         | Look for whatever lures her and remove it. Domoff et al. (2019) built a parent-report measure of problematic media use from the DSM-5 gaming-disorder criteria, which include distress when the device is taken away and failed attempts to cut down. |
| She replays one easy game round after round and avoids harder ones     | Comfort-seeking, the game is too easy | Fine in small doses. If it lasts, that game's content should lean on the current step                                                                                                                                                                 |
| "Too easy" or "boring" again in lessons                                | Pacing                                | Check the step's flowers; the fast track should be moving her. Report to the team                                                                                                                                                                     |
| Frustration or tears in a game                                         | Content above her level               | Check that the game draws only from current and mastered steps                                                                                                                                                                                        |

---

## 5. Only Thomas can answer

1. **Is "level 2" the second Number Garden stop, _adding to ten_?** (Hypothesis in § 1.)
2. **Which Parent Settings preset is the iPad on now (80% / 2 or the 88% / 3 default), and how many flowers are on that step's tray?** On 80% / 2 she moves on after 2 good days whether or not the fast track fires. If she has been on the step for many days, the problem is not "too easy" but a missed bar. She may be getting most answers right, but not 8/8 on the first tap.
3. **Values call: games always open (recommended), or only after the day's first finished lesson (the fallback)?**
4. **Does she usually play with him nearby?** Co-use changes how hard stopping is and how much the social pillar is already covered. This is context for reading the signals, not a design input.

## Risks and counter-evidence

- **Intrinsic integration is contested.** The Cutting & Iacovides replication keeps the learning gain but drops the motivation explanation. A Carleton master's thesis ("Revisiting the Intrinsic Integration Hypothesis") reports the extrinsic version gaining more. I read only a search summary of the thesis. The rule "the answer is the move" survives because both versions of the argument favour it for attention, but the size of the benefit is uncertain.
- **Games were not more motivating in general** (Wouters et al. 2013). Mini-games are not a cure for boredom on their own. Pacing (§ 1) does more.
- **Novelty fades** (Hamari et al. 2014; Rodrigues et al. 2022, adults). Expect the games' pull to drop after a few weeks. That is fine if the lessons still carry the learning.
- **Most game evidence is from other ages.** The board games come from preschoolers, Word Building from struggling readers past grade 1, and the 85% rule from a computational model. The direction transfers to 6-9; the exact numbers do not.
- **Every time ratio and round length in this note is my judgement.** I found no study that sets them.

## Sources

| #   | Citation                                                                                                                                                                                                                                                                                                                                                                                | Strength                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Habgood, M. P. J., & Ainsworth, S. E. (2011). Motivating children to learn effectively: Exploring the value of intrinsic integration in educational games. _Journal of the Learning Sciences_, 20(2), 169-206. https://shura.shu.ac.uk/3556/                                                                                                                                            | Moderate (two small studies, ages 7-11)                                 |
| 2   | Cutting, J., & Iacovides, I. (2022). Learning by doing: Intrinsic integration directs attention to increase learning in games. _Proc. ACM Hum.-Comput. Interact._ (CHI PLAY). https://eprints.whiterose.ac.uk/189921                                                                                                                                                                    | Moderate (pre-registered, N = 210; ages not confirmed)                  |
| 3   | Wouters, P., van Nimwegen, C., van Oostendorp, H., & van der Spek, E. D. (2013). A meta-analysis of the cognitive and motivational effects of serious games. _Journal of Educational Psychology_, 105(2), 249-265. https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/                                                     | Strong (meta-analysis)                                                  |
| 4   | Clark, D. B., Tanner-Smith, E. E., & Killingsworth, S. S. (2016). Digital games, design, and learning: A systematic review and meta-analysis. _Review of Educational Research_, 86(1), 79-122. https://docs.opendeved.net/lib/YHX5ZVR8                                                                                                                                                  | Strong (meta-analysis)                                                  |
| 5   | Hirsh-Pasek, K., Zosh, J. M., Golinkoff, R. M., Gray, J. H., Robb, M. B., & Kaufman, J. (2015). Putting education in "educational" apps. _Psychological Science in the Public Interest_, 16(1), 3-34. https://www.psychologicalscience.org/publications/educational-apps.html                                                                                                           | Review (framework)                                                      |
| 6   | Deci, E. L., Koestner, R., & Ryan, R. M. (1999). _Psychological Bulletin_, 125(6), 627-668. (Also cited in `guidance-layer-2026-10-06.md`.)                                                                                                                                                                                                                                             | Strong (meta-analysis, 128 studies)                                     |
| 7   | Lepper, M. R., Greene, D., & Nisbett, R. E. (1973). _JPSP_, 28, 129-137. https://www.researchgate.net/publication/281453299                                                                                                                                                                                                                                                             | Moderate (classic experiment, preschoolers)                             |
| 8   | Lepper, M. R., Sagotsky, G., Dafoe, J. L., & Greene, D. (1982). Consequences of superfluous social constraints. _JPSP_, 42(1), 51-65. https://www.researchgate.net/publication/232599057                                                                                                                                                                                                | Moderate (three studies; abstract read, full text not machine-readable) |
| 9   | Patall, E. A., Cooper, H., & Robinson, J. C. (2008). _Psychological Bulletin_, 134(2), 270-300. (Also in `guidance-layer-2026-10-06.md`.)                                                                                                                                                                                                                                               | Strong (meta-analysis)                                                  |
| 10  | Radesky, J., et al. (2022). Prevalence and characteristics of manipulative design in mobile applications used by children. _JAMA Network Open_. https://pmc.ncbi.nlm.nih.gov/articles/PMC9206186/                                                                                                                                                                                       | Moderate (coding study)                                                 |
| 11  | UK Information Commissioner's Office. _Age Appropriate Design Code_, "nudge techniques" standard. Read via summaries: https://saferinternet.org.uk/blog/icos-age-appropriate-design-code                                                                                                                                                                                                | Regulatory guidance                                                     |
| 12  | Baker, R. S. J. d., D'Mello, S. K., Rodrigo, M. M. T., & Graesser, A. C. (2010). Better to be frustrated than bored. _International Journal of Human-Computer Studies_, 68(4), 223-241. https://research.ateneo.edu/en/publications/better-to-be-frustrated-than-bored-the-incidence-persistence-and-/                                                                                  | Moderate (observational, 3 environments)                                |
| 13  | Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The Eighty Five Percent Rule for optimal learning. _Nature Communications_, 10, 4646. https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579                                                                                                                                                                                 | Theoretical (computational)                                             |
| 14  | Loewenstein, G. (1994). The psychology of curiosity: A review and reinterpretation. _Psychological Bulletin_, 116(1), 75-98. https://stafforini.com/works/loewenstein-1994-psychology-curiosity-review/                                                                                                                                                                                 | Review / theory                                                         |
| 15  | Hamari, J., Koivisto, J., & Sarsa, H. (2014). Does gamification work? _Proc. 47th HICSS_. https://research.aalto.fi/fi/publications/does-gamification-work-a-literature-review-of-empirical-studies-o/                                                                                                                                                                                  | Review (adults)                                                         |
| 16  | Rodrigues, L., et al. (2022). Gamification suffers from the novelty effect but benefits from the familiarization effect. _IJETHE_, 19, 13. https://doi.org/10.1186/s41239-021-00314-6                                                                                                                                                                                                   | Moderate (longitudinal, university students)                            |
| 17  | Rey, G. D. (2012). A review of research and a meta-analysis of the seductive detail effect. _Educational Research Review_, 7(3), 216-237. https://doi.org/10.1016/j.edurev.2012.05.003                                                                                                                                                                                                  | Strong (meta-analysis; effect sizes read via secondary sources)         |
| 18  | Gaidoschik, M. (2012). First-graders' development of calculation strategies: How deriving facts helps automatize facts. _Journal für Mathematik-Didaktik_, 33(2), 287-315. https://doi.org/10.1007/s13138-012-0038-6                                                                                                                                                                    | Moderate (longitudinal, N = 139)                                        |
| 19  | Siegler, R. S., & Ramani, G. B. (2008). Playing linear numerical board games promotes low-income children's numerical development. _Developmental Science_, 11(5), 655-661. https://pubmed.ncbi.nlm.nih.gov/18801120/                                                                                                                                                                   | Moderate (experiment, preschoolers)                                     |
| 20  | Siegler, R. S., & Ramani, G. B. (2009). Playing linear number board games, but not circular ones, improves low-income preschoolers' numerical understanding. _Journal of Educational Psychology_, 101(3), 545. https://ies.ed.gov/ncee/wwc/study/78079                                                                                                                                  | Moderate (experiment, N = 88 preschoolers)                              |
| 21  | McCandliss, B., Beck, I. L., Sandak, R., & Perfetti, C. (2003). Focusing attention on decoding for children with poor reading skills: Design and preliminary tests of the Word Building intervention. _Scientific Studies of Reading_, 7(1), 75-104. https://sites.pitt.edu/~perfetti/PDF/Focusing%20attention%20decoding%20children%20with%20poor%20reading-%20MCandlis%20et%20al..pdf | Moderate (randomised control)                                           |
| 22  | Ehri, L. C., Nunes, S. R., Willows, D. M., et al. (2001). Phonemic awareness instruction helps children learn to read. _Reading Research Quarterly_, 36(3), 250-287. https://www.proquest.com/docview/212125469                                                                                                                                                                         | Strong (meta-analysis, 52 studies)                                      |
| 23  | Domoff, S. E., et al. (2019). Development and validation of the Problematic Media Use Measure. _Psychology of Popular Media Culture_, 8(1), 2-11. https://doi.org/10.1037/ppm0000163                                                                                                                                                                                                    | Moderate (measure validation)                                           |
| 24  | Poletti et al. (2025), McNeil et al. (2025), Codding et al. (2011): see `speed-feedback-automaticity-marian.md`. Taylor & Rohrer (2010): see `review-mode-and-warmup-native.md`.                                                                                                                                                                                                        | As cited there                                                          |
