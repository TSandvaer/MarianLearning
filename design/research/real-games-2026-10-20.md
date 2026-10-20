# Real games, not practice in a nicer frame (2026-10-20)

## Question

Thomas, 2026-10-20, after playing the shipped mini-game A, "Fill the flower bed" (PR #635), verbatim: "the flowerbed (10) you just made is not really a game, it really belongs on the path in my oppinion. games should be seperate from path islands and exist outside the path (you should not be looking at the path when you select a game in either number garden or word song. a game is something fun (not just like any step on the path). I dont really have any good ideas maybe you can come up with some ideas?"

Four questions:

1. What makes play **fun** for a 6-9 learner, as opposed to practice in a nicer frame?
2. Which of my guard rails in `engagement-and-mini-games-2026-10-19.md` (§ 3, from #620) still hold, and which were too tight for real games?
3. Where do games live, outside the path? How does a child get there and back, how long does a game session last, and how do games relate to the learning?
4. Where does "Fill the flower bed" belong now?

**Scope.** The app is multi-user: any learner of about 6-9. Nothing here depends on one child's school, language or history. **Labels:** **[evidence]** is a cited source. **[my reasoning]** is my own judgement, with no single study behind it.

## Bottom line

1. **Thomas is right, and my rails caused it.** The flower bed asks the lesson's own question ("Seven and what make ten?") with the lesson's three chips. The child decides nothing except the answer, and nothing can surprise her. Play is fun when the child **decides something that matters**, **the outcome is uncertain**, **something surprising or funny can happen**, and **what she makes or does stays hers**.
2. **Keep the rails that protect the child:** no currency, no prizes, no streaks, no lures, Emma never pushes games, lessons are never the price of games, games never feed lesson progress, and no maths or letter answer is ever timed. **Relax the rails that made it a drill:** allow funny, instantly-retryable failure in the game world, things that move, toy state that the game keeps, open play with natural stopping points instead of fixed 6-move rounds, light content or no content at all, and more character and humour.
3. **One shared Play place, reached from Home, never from a Map.** Aim for about 5-10 minutes of play in a sitting, with natural stopping points and no clock shown to the child. Games may be pure fun. Where they use numbers or letters, the content is **material to play with**, not a question to pass, and any judged item comes from current or mastered steps.
4. **Fill the flower bed becomes a practice variant inside add-to-10.** The ten-frame bed becomes the picture for the lesson's missing-number problems. It is scored like every other lesson problem. The Map door and the separate game route are retired. It does not become a new path step.

---

## 1. What makes play fun at 6-9

### Why the flower bed is not a game

- **What the child does [read from the spec].** The bed shows _g_ flowers. Emma asks "Seven and what make ten?". The child taps one of three missing-number chips. Six beds, then back to the Map (`design/native/mini-game-flower-bed.md` § 2.1, § 2.4). The lesson already asks the same missing-number question, with its three canon items 7+3, 6+4 and 8+2 (P4, P6, P8 of `public/canon/math/level-1/add-to-10.json`).
- **What the child cannot do [my reasoning].** She cannot choose a goal, try a different way, make something happen that Emma did not ask for, or be surprised. There is one right tap and nothing else to touch. Every source of fun below is missing.
- **My #620 rails removed each of them.** "No fail state" plus "no timer" plus "fixed short rounds" plus "content from current and mastered steps only" plus "little decoration" leaves only a question with a fixed answer. "The answer is the move" (Habgood & Ainsworth 2011) was the right idea, but a chip tap is not a move. As I recall the study, the intrinsic version of _Zombie Division_ was a full adventure game: the maths chose the attack, inside a world with movement and enemies. I did not re-check that detail today. We kept the integration and dropped the game.

### The ingredients of fun

| Ingredient                                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                       | What it means here                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agency:** the child decides what to do, how, and in what order                           | **[evidence]** Ryan, Rigby & Przybylski (2006), four studies of game players: felt autonomy and competence predicted enjoyment and wanting to play again. Adults and older players, so indirect for 6-9. Malone & Lepper (1987) list _control_ (choice, contingency, power) as a core motivator. Patall et al. (2008), meta-analysis: choice raises intrinsic motivation, more so in children. | Many right ways to do it. "Fill the raft so it floats" has dozens of answers; "Seven and what make ten?" has one.                                                                                    |
| **An uncertain outcome, often a goal the child sets herself**                              | **[evidence]** Malone (1981), from studies of what made computer games fun: challenge depends on goals whose outcome is uncertain. Theory built from observation, not an experiment.                                                                                                                                                                                                           | The uncertainty must come from the **game** (aim, balance, chance, a build that might wobble), not from content she has not been taught.                                                             |
| **Surprise and curiosity:** things worth poking at                                         | **[evidence]** Stahl & Feigenson (2015): 11-month-olds learned more about objects that broke their expectations, and chose to explore and test them. Infants, so indirect. Malone (1981) names sensory and cognitive curiosity. Bonawitz et al. (2011): preschoolers who were _taught_ one function of a toy explored less and found less than children who were not told.                     | Emma should not narrate the single right action. Hidden reactions (tap the cloud, it rains; tap the frog twice, it burps) reward poking. Telling the child exactly what to do removes the discovery. |
| **Physical play:** dragging, stacking, throwing, things that tumble and bounce             | **[evidence]** Link, Moeller, Huber, Fischer & Nuerk (2013): first graders who placed numbers by walking on a floor number line gained more than with the same task without whole-body movement. Moderate, one study. Malone (1981): sensory curiosity.                                                                                                                                        | On an iPad: direct manipulation with simple physics. Objects that fall, roll and balance. Big targets still apply.                                                                                   |
| **Playful failure:** it goes wrong in a funny way, and it is clearly the child's own doing | **[evidence]** Juul (2009), a study of players: failure makes players rethink the game, which adds to it, and players _prefer_ to feel responsible for their failures. Game-studies research with adults.                                                                                                                                                                                      | The tower topples, the raft tips and the animals splash, the bunny lands in the pond. Laughter, instant retry, nothing lost. This is not a red X: it is the world reacting, not a judge marking.     |
| **Making and keeping:** something I built stays                                            | **[evidence, weak]** Resnick (2017), _Lifelong Kindergarten_: projects and play as the core of creative learning. A practitioner book from 30 years of Media Lab work, not trials. **[my reasoning]** A thing that stays because the child _made_ it is ownership; a thing that stays because she _earned_ it is currency. Only the first is allowed.                                          | A garden, a zoo or a town she builds and finds again next time. Never bought, never lost.                                                                                                            |
| **Humour and character**                                                                   | **[my reasoning]** I did not check a study for this. Malone (1981) names _fantasy_ and separates fantasy tied to the skill from fantasy glued onto it.                                                                                                                                                                                                                                         | Emma can be silly: she builds a cat with three legs and the child fixes it; she loses at the board game and pulls a face. Children this age love catching an adult's mistake.                        |
| **Toy-like open play:** no goal at all                                                     | **[evidence]** Zosh et al. (2017), LEGO Foundation review: playful learning is joyful, meaningful, actively engaging, iterative and socially interactive. Weisberg et al. (2016): _guided play_, a prepared space with a learning goal the child is gently steered toward, works across a range of content. Reviews.                                                                           | Some of the Play place can be a toy: tap letters to make sounds and music, plant whatever and however you like. No round, no end.                                                                    |
| **Playing with someone**                                                                   | **[evidence]** Hirsh-Pasek et al. (2015) and Zosh et al. (2017) both list social interaction as a pillar. Malone & Lepper (1987): cooperation and competition.                                                                                                                                                                                                                                 | A board game against Emma, or two learners or a parent on one iPad. No leaderboards (see § 2).                                                                                                       |

### A useful counter-finding

- **Fun does not predict learning [evidence].** Sim, MacFarlane & Read (2006) tested three educational software products with 25 children aged 7-8. Children could tell fun, usability and learning apart. Fun and usability went together; learning did not track either.
- **Wouters et al. (2013)** (cited in #620): serious games were _not_ more motivating than conventional instruction overall.
- **What this means [my reasoning].** Games do not need to justify themselves as better teaching, and should not try to. The path carries the learning. A game's job is to be fun, keep the app a place the child likes, and give known content a second, lighter life. That frees the games from the lesson's rules.

### A test for every game idea [my reasoning]

1. **Would a child play it with the numbers or letters taken out?** If not, it is a quiz in costume.
2. **Does the child decide anything besides the answer?**
3. **Can something surprising or funny happen?**
4. **Is there a way to do it that Emma did not tell her?**

Fill the flower bed fails all four.

---

## 2. The #620 guard rails, revisited against fun

### Hold: these protect the child, not the drill

| Rail                                                                                           | Why it stays                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No currency, no prizes, no stardust earned or spent in games, no shop**                      | Deci, Koestner & Ryan (1999): expected tangible rewards lower interest. Holds for games too. The game is the reward.                                                                                            |
| **No variable prizes, no mystery boxes, no loot**                                              | A slot machine with a cartoon on it. A chance roll that only decides a hop (the board game below) is fine; a chance roll that pays a prize is not.                                                              |
| **No streaks, no "come back tomorrow", nothing lost by staying away**                          | Radesky et al. (2022) on lures in children's apps; the ICO nudge standard.                                                                                                                                      |
| **Emma never suggests a game, a break or "one more"**; the Hub suggestion stays on the lesson  | The lesson stays the first door.                                                                                                                                                                                |
| **Lessons are never the price of games**                                                       | Lepper, Sagotsky, Dafoe & Greene (1982): an activity framed as the means to another gets discounted. The fallback in #620 § 3 (games open after the day's first finished session) stays documented and unbuilt. |
| **Games never write lesson progress**: no flowers, mastery, Leitner moves, stardust or history | One progress rule. Games must not be the easy route to flowers.                                                                                                                                                 |
| **No maths or letter answer is ever timed**; no countdown and no clock on screen               | `speed-feedback-automaticity-marian.md`. Speed pressure blocks the working memory a counting child needs.                                                                                                       |
| **No comparison between learners**: no leaderboard, no "your brother scored more"              | Multi-user app. Playing together on one iPad is different from being ranked.                                                                                                                                    |
| **Audio-first; no reading needed outside the reading games; touch targets fit 6-9**            | Project principles.                                                                                                                                                                                             |
| **Never a red X; Emma reacts in character**                                                    | Project principle. See "no fail state" below for what changes around it.                                                                                                                                        |

### Relax: these made it a drill

| #620 rail                                          | Relax to                                                                                                                                                                                                                                                                                    | The line it must not cross                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"No fail state"**                                | **Playful, physical failure in the game world.** The raft tips because it is too heavy; the tower falls; the bunny lands in the pond. A wrong amount may cause the funny outcome, because that is informative feedback in the world's own terms (Juul 2009).                                | **No lives, no "game over", no lost items, no score that drops.** Retry is instant. Nothing is marked wrong; Emma laughs _with_ her, never at her. Never a red X or a buzzer.                                                      |
| **"No timer, nothing that floats away"**           | **Things may move.** A fish swims by, a ball rolls, a frog hops when tapped. Timing may be part of a _motor_ action (tap when the frog is on the pad).                                                                                                                                      | **No countdown, no visible clock, no timed fact recall.** A missed moving thing comes back; it never escapes for good. Speed never earns more.                                                                                     |
| **"Writes nothing"**                               | **A game may keep its own toy state per learner:** the garden she planted, the animals in her zoo, the town she built. Stored apart from progress.                                                                                                                                          | **Never lesson progress or stardust.** Kept things are never bought, never decay, never lost. Show what she has, never a meter of what is missing ("3 of 20 found") [my reasoning: an empty-slot collection is a completion lure]. |
| **"Content from current and mastered steps only"** | **Content is material, not a test.** A game may use numbers and letters as things to play with, and some games may have no content at all. Any item the game _judges_ still comes from current or mastered steps. Unjudged exposure (Emma names "sh" when the child taps the ship) is fine. | **Never judge a later step's content.** A game must not quietly teach or test what the path has not taught.                                                                                                                        |
| **"Fixed short rounds (6-10 moves, 1-3 minutes)"** | **Open play with natural stopping points:** the raft reaches the island, the tower touches the balloon, the board game reaches the carrot. A toy has no end at all.                                                                                                                         | **No autoplay into the next round, no "one more?" line, no score to beat.** Natural stopping points come every few minutes.                                                                                                        |
| **"Little decoration"**                            | **Character, humour and animation are allowed in games**, because fun is the point. The seductive-detail risk (Rey 2012) is about learning, and games are not the learning surface.                                                                                                         | **Lesson screens stay plain.** Game art never leaks into lessons.                                                                                                                                                                  |
| **"The answer is the move"**                       | **Keep the idea, sharpen it:** the content is the material of a move with a consequence (loading weight, stacking rods, joining letters), not a question with chips.                                                                                                                        | **A prompt plus three chips is a lesson, not a game.** It belongs on the path.                                                                                                                                                     |
| **"One side door per world, on the Map"**          | Replaced by § 3.                                                                                                                                                                                                                                                                            | Games never sit on a Map or a path island.                                                                                                                                                                                         |

---

## 3. A Play place outside the path

### One shared place, not one per world

**Recommendation: one Play place, reached from Home.** [my reasoning]

- Thomas wants games apart from the path. A door per world puts a game back on that world's Map.
- Some of the best ideas have both kinds of content or none (the letter music toy, the board game against Emma). A shared place does not force each game into a world.
- One place is one surface to design, test and translate. The planned Danish version swaps the content and keeps the games.
- Inside, games can still be grouped: number games, letter games and toys. That is a layout call for Kyle.

### Getting there and back

- **From Home (the Hub):** a Play tile or door, clearly separate from the two worlds and smaller than them. Emma's suggestion stays on the lesson; she never points at Play.
- **No Map is on screen** at any point on the way in, inside, or on the way out. Thomas: "you should not be looking at the path when you select a game".
- **Back:** one always-visible back control returns to the Play place; from there one more tap returns Home. A game's natural stopping point returns to the Play place, never into another round.
- **Open from the start.** A toy needs no unlock. A content game shows when its content exists for this learner (for example, the raft game when add-to-10 is current). No padlocks and no "new game!" calls (#620 § 3 stands).

### How long

- **Target about 5-10 minutes of play in a sitting**, beside a 10-15 minute lesson [my reasoning; I found no study that sets a ratio].
- **Structure, not a clock:** natural stopping points every few minutes, no autoplay, no "again?". The child does not see a play timer.
- **Optional parent limit [my reasoning].** If Thomas wants one, a Parent Settings play limit that is off by default. When it is reached, Emma waves goodbye at the next stopping point ("The animals are sleepy now. See you next time!"). No countdown is ever shown. The ICO code supports nudges that help, such as break prompts.
- **Watch, as in #620 § 4:** lessons on most days she plays, and lessons at least about two-thirds of app time over a week. If games displace lessons, turn on the documented fallback.

### How games relate to the learning

- **Games are for fun first.** They do not need to teach more than the path. Fun does not predict learning (Sim et al. 2006), and the path is the learning.
- **Three kinds, all allowed:**
  1. **Toys, no content:** open play, no goal.
  2. **Light content:** numbers and letters as material (weights, rods, sounds). Judged items from current or mastered steps only. This is where known facts get a second, lighter life: retrieval without a test.
  3. **Never:** the lesson's question format in a new costume.
- **Why mastered content for the judged parts [my reasoning].** A game's challenge should come from the game: balance, aim, chance, building. If the challenge comes from untaught content, the child meets a hard maths problem without the lesson's hints, and the fun becomes a test she can fail.
- **Games may read Leitner, never write it** (#620 § 3 stands). A game may pick due facts to use more often.

### Game ideas

Each idea names its fun ingredients and its content. Kyle sketches; these are briefs, not specs. Names are placeholders.

1. **Raft crossing (sums to 10, later 20).** Animals wait on the shore, each with a number of spots or a weight from 1 to 9. The raft carries 10. She drags animals on in any combination. Too many and the raft sinks a little, wobbles, and dumps them in the water with a splash; she tries again. Exactly 10 and Emma pushes off to the island, where the animals do something silly.
   - _Fun:_ agency (many right answers), playful failure, physics, humour.
   - _Content:_ bonds to 10 and to 20, made by choice rather than asked for.
2. **Tower to the balloon (number rods).** Rods of length 1-10 (one block per unit, coloured). A balloon floats at height N. She stacks rods in any order; a tall wobbly tower can topple. Touch the balloon and it pops into confetti.
   - _Fun:_ building, physics, many solutions, surprise.
   - _Content:_ composing a number from parts, and later the teens as 10 + _n_.
3. **Bunny race against Emma (linear board game, from #620).** A 1-20 path. Each player spins 1-3 and hops. Emma plays too, makes funny moves, and sometimes wins. She asks "Where will you land?" only now and then, not on every hop.
   - _Fun:_ chance, a real opponent, humour, playing together. Two learners or a parent can play on one iPad.
   - _Content:_ counting on, number-line position (Siegler & Ramani 2008, 2009).
   - _Check:_ the spinner only decides the hop. It never pays a prize.
4. **Letter critters (blending as play).** Letters she knows are little creatures. Drag two or three together and they sing their sounds, then the word. A real word pops out its picture (s-u-n: the sun rises and shines). A non-word makes a funny noise and Emma giggles ("Tup? That's not a word! Tup, tup!").
   - _Fun:_ open play, surprise, humour; a non-word is a joke, not a failure.
   - _Content:_ letter sounds and blending, only letters from her current and mastered steps. The sounds must reuse the project's tuned phoneme renders; Thomas's ear is the gate (#620 § 3, Robot talk).
5. **Emma's mix-up (catch the mistake).** Emma builds things wrong on purpose: a ladybird with 3 spots on one wing and 4 on the other, a picture labelled "dog" that shows a cat, a cake with too many candles. The child taps what is wrong and fixes it; Emma acts surprised and thanks her.
   - _Fun:_ role reversal, humour, the child as the expert.
   - _Content:_ doubles, counting, word-picture match, from mastered steps.
6. **Sound piano (toy, no goal).** Letter keys play their sounds; tapping a picture plays its word. She can make silly songs. No round, no end, no judgement.
   - _Fun:_ toy-like open play, sound.
   - _Content:_ exposure only, nothing judged.

Rejected for the same reasons as #620: decorating with stardust (currency), bubble pop and fact races (timed recall), memory card-flip (trains visual memory, not content).

---

## 4. Where "Fill the flower bed" belongs now

**Recommendation: a practice variant inside add-to-10.** The ten-frame bed becomes the picture for the add-to-10 lesson's missing-number problems ("Seven and what make ten?", P4, P6, P8), in place of or beside the counting row. It is answered and scored exactly like every other lesson problem. The Map play door and the separate game route are retired.

Why this option:

- **It is lesson content already.** Same question, same chips, same canon items. Thomas: "it really belongs on the path".
- **Not a new path step.** A new step adds a mastery gate, slows a learner who is already "too easy" on add-to-10 (#620 § 1), and touches the 14-16 places in `.claude/docs/sibling-tier-checklist.md` for content the step already teaches.
- **Not retired.** The bed gives the bond to ten a structured picture: the empty holes _are_ the missing part. The lesson already uses ten-frames for 6-10 elsewhere (`ScaffoldFlash.tsx`, `TakeAwayRow.tsx`), so it fits [my reasoning that the structure helps more than the row; I did not check a source for ten-frames today]. The art and the drawing code exist.
- **What happens to its parts** is Kyle's and the developers' call. In outline: the bed art and `FlowerBed.tsx` move into the lesson's missing-number visual; the play door, the `'game'` route and the game-only lines go; whether some `guide.game.bed.*` renders can serve the lesson is an audio question for the team.

---

## 5. Only Thomas can answer

1. **Which of the six ideas sound fun to you?** A child's reaction is the real test; pick two to sketch first. My lean: Raft crossing (numbers) and Letter critters (letters).
2. **One shared Play place from Home (recommended), or a Play place per world, still off the Map?**
3. **A parent play limit in Parent Settings, off by default: yes or no?**

## Risks and counter-evidence

- **Most fun evidence is from other ages.** Malone (1981) and Ryan et al. (2006) studied older players; Stahl & Feigenson (2015) studied infants; Bonawitz et al. (2011) studied preschoolers. The direction transfers to 6-9; the strength does not.
- **Fun and learning come apart** (Sim et al. 2006). That is the reason to keep the path as the learning surface, not a reason to make games drills.
- **Physics and open play cost more to build and to test** than a chip tap. One good game beats four drills.
- **Kept toy state can drift toward collecting.** Watch for "I need to get all of them". If it shows up, remove the visible gaps.
- **Playful failure can still upset some children.** Watch for tears or giving up in a game (#620 § 4 warning signs). If it happens, make the failure gentler and funnier, not absent.
- **Every time target and the "test for every game idea" are my judgement.** I found no study that sets them.

## Sources

| #   | Citation                                                                                                                                                                                                                                                                                                              | Strength                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Malone, T. W. (1981). Toward a theory of intrinsically motivating instruction. _Cognitive Science_, 5(4), 333-369. https://cdgr.ucsb.edu/node/768                                                                                                                                                                     | Theory from observation of games; abstract and summaries read                    |
| 2   | Malone, T. W., & Lepper, M. R. (1987). Making learning fun: A taxonomy of intrinsic motivations for learning. In R. E. Snow & M. J. Farr (Eds.), _Aptitude, Learning, and Instruction_, Vol. 3. Erlbaum. https://karlkapp.com/motivation-and-games-motivational-theories-for-instructional-games/                     | Theory; read via secondary summaries                                             |
| 3   | Ryan, R. M., Rigby, C. S., & Przybylski, A. (2006). The motivational pull of video games: A self-determination theory approach. _Motivation and Emotion_, 30(4), 347-363. https://doi.org/10.1007/s11031-006-9051-8                                                                                                   | Moderate (four studies; not children)                                            |
| 4   | Juul, J. (2009). Fear of failing? The many meanings of difficulty in video games. In _The Video Game Theory Reader 2_ (pp. 237-252). Routledge. https://jesperjuul.net/text/fearoffailing/                                                                                                                            | Weak-moderate (game studies, adult players)                                      |
| 5   | Stahl, A. E., & Feigenson, L. (2015). Observing the unexpected enhances infants' learning and exploration. _Science_, 348, 91-94. https://pmc.ncbi.nlm.nih.gov/articles/PMC5861377                                                                                                                                    | Moderate (experiments, N = 110 infants; indirect for 6-9)                        |
| 6   | Bonawitz, E., Shafto, P., Gweon, H., Goodman, N. D., Spelke, E., & Schulz, L. (2011). The double-edged sword of pedagogy: Instruction limits spontaneous exploration and discovery. _Cognition_, 120(3), 322-330. https://pmc.ncbi.nlm.nih.gov/articles/PMC3369499                                                    | Moderate (experiments, preschoolers)                                             |
| 7   | Link, T., Moeller, K., Huber, S., Fischer, U., & Nuerk, H.-C. (2013). Walk the number line: An embodied training of numerical concepts. _Trends in Neuroscience and Education_, 2(2), 74-84. https://doi.org/10.1016/j.tine.2013.06.005                                                                               | Moderate (one training study, first graders; abstract read)                      |
| 8   | Zosh, J. M., Hopkins, E. J., Jensen, H., Liu, C., Neale, D., Hirsh-Pasek, K., Solis, S. L., & Whitebread, D. (2017). _Learning through play: A review of the evidence_. The LEGO Foundation. https://www.readkong.com/page/learning-through-play-a-review-of-the-evidence-3151331                                     | Review (funded by LEGO Foundation; five characteristics confirmed from contents) |
| 9   | Weisberg, D. S., Hirsh-Pasek, K., Golinkoff, R. M., Kittredge, A. K., & Klahr, D. (2016). Guided play: Principles and practices. _Current Directions in Psychological Science_, 25(3), 177-182. https://doi.org/10.1177/0963721416645512                                                                              | Review                                                                           |
| 10  | Resnick, M. (2017). _Lifelong Kindergarten: Cultivating Creativity through Projects, Passion, Peers, and Play_. MIT Press. https://www.media.mit.edu/publications/lifelong-kindergarten-cultivating-creativity-through-projects-passion-peers-and-play/                                                               | Weak (practitioner book)                                                         |
| 11  | Sim, G., MacFarlane, S., & Read, J. C. (2006). All work and no play: Measuring fun, usability, and learning in software for children. _Computers & Education_, 46(3), 235-248. https://doi.org/10.1016/j.compedu.2005.11.021                                                                                          | Moderate-weak (N = 25, ages 7-8; abstract read)                                  |
| 12  | Habgood & Ainsworth (2011); Wouters et al. (2013); Hirsh-Pasek et al. (2015); Deci, Koestner & Ryan (1999); Patall, Cooper & Robinson (2008); Lepper et al. (1982); Radesky et al. (2022); ICO Age Appropriate Design Code; Rey (2012); Siegler & Ramani (2008, 2009): see `engagement-and-mini-games-2026-10-19.md`. | As cited there                                                                   |
