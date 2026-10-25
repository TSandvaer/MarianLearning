# The Bunny race: Dave's ruling (2026-10-25)

The text of the ruling Dave returned by Orca dispatch on 2026-10-25, verbatim. It was `tmp/specs/dave-bunny-race-ruling.txt` in the main checkout, which git ignores; prettier added only blank lines and list indentation. `design/native/bunny-race.md` quotes it as "Dave (n)" by its section numbers. Thomas approved phase 1 by popup the same day ("Yes, phase 1"). Its line numbers are at `main` 2cdfa910, as it says.

SUMMARY. I ruled on the bunny race: a 1-20 path for every learner with progress (it opens at number-recog), drawn as two rows of 10 (1 at bottom left, 11 directly above 1, Laski & Siegler's layout), with a 1-3 spinner; the child hops her own bunny, one tap per hop, and the voice names each square she lands on ("Eight! Nine! Ten!", never "one, two, three"); Emma races her own bunny from her usual place, the child always starts, and Emma's funny moves (a one-hop-too-many count trick the child can catch, at most one nap a race, silly hops) tilt the odds openly so the child wins about 61-74% of races (computed). I found: no ladders or slides (they break the number-equals-distance link and act as a score that drops); a loss is safe because the race is luck, Emma says so ("Lucky me!"), and every race ends with the child's own arrival beat; "Where will you land?" comes on her 2nd turn and every 3rd turn after, and a wrong guess just sinks quietly; phase 1 needs 11 new Lily lines (253 characters) plus the 10 teen numbers (80 characters) shared with the raft island, about $0.78 of pack art and no new sfx; a level up to a 10x10 hundred board (spinner 1-5) opens on her first arrival, never on a win, because the spinner decides a win. Left: Kyle's list in (6), and phase 2's 80 number words (905 characters) once Thomas approves it.

RULING. E = cited or computed evidence, R = my reasoning. "Computed" = inline node -e race simulations (200,000 races each, never saved): spins uniform 1..max, child first, a spin past the end stops on the end. Line numbers are at main 2cdfa910. L&S = Laski & Siegler (2014), "Learning from number board games: You learn what you encode", Developmental Psychology, doi 10.1037/a0034321 (online 2013); I read the full text. Moderate evidence: one experiment, N = 42 kindergartners.

(1) WHO SEES IT, WHAT CONTENT

- Opens at number-recog, MATH_TREE[0] (packages/core/src/progress/mastery.ts:129). New PlayGameId 'bunny' in PLAY_GAMES (packages/core/src/games/playPlace.ts:19-28). E: this is the critters' rule (design/native/play-place.md:57): every learner with progress has it, and null progress gives none. The default profile has number-recog mastered and add-to-10 practicing (packages/core/src/progress/defaults.ts:174-175), so it opens on day 1, like the raft. "Open from the start" (design/research/real-games-2026-10-20.md:112).
- Content: counting on 1-3 squares along a numbered line. The only thing ever judged is "which square is N ahead" (a square to tap, by counting squares), never a numeral to name or a sum to recall. Numbers 11-20 are material: shown and spoken, never asked. E: rail real-games:88. number-recog teaches numerals 1..10 (packages/core/src/math/extendedProblems.ts:21), and counting 1-3 squares sits inside it. R: so 11-20 does not need add-to-20.
- Path 1-20. E: Siegler & Ramani's board was 1-10, "arranged in equal-size squares progressing from left to right" (as L&S describe it; Siegler & Ramani 2008, Developmental Science 11(5) 655-661; 2009, J. Educational Psychology 101(3) 545-560, preschoolers). L&S's kindergartners learned on 1-100. R: our learners are 6-9, older than both groups. On 1-10 the race is too short (computed: median 5 child turns).
- Layout: two rows of 10, left to right in both, 1 at bottom left, 11 directly above 1, 20 (the carrot) at top right; equal squares; 10 and 20 a shade deeper. Never a snake, spiral, circle or winding path. E: L&S's board had "1 in the leftmost bottom square, 11 directly above 1, 21 directly above 11", chosen over Chutes and Ladders, which "snakes around", to show base 10, and its colour "deepened every two rows" as a magnitude cue. Circular boards produced little learning (Siegler & Ramani 2009, as cited in L&S). R: one straight row of 20 gives 24.5 pt squares on a phone in landscape and 17 pt in portrait (A is 491 and 343 wide, play-place.md:198-199), too small for numerals; two rows give 49 and 34 pt. And it is the bottom of the later 100 board.
- Spinner 1-3: three equal sectors, each with its numeral and 1-3 dots. The spin number is not spoken. R: 1-3 dots read at a glance. Saying "three" just before "eight, nine, ten" mixes the hop count into the square names, which is the count-from-1 habit.
- THE CORE, counting on: on every hop of every bunny, the voice names the square it lands on. E: L&S's count-on group ("children on 17 who spun a 2 said '18, 19'") cut their number-line error from 20% to 14% (d 0.86) and raised count-on accuracy from 25% to 54% (d 1.10). The count-from-1 group did not change (21% to 20%; 23% to 23%). Siegler & Ramani's games also "required [children] to say the names of the numbers in the squares as they moved" (quoted in L&S).
- She hops herself: one tap on her bunny is one hop; after the spin's number of hops, more taps make it wiggle. A tap during a hop is held (at most one), so each name finishes before the next hop. R: her taps are the one-to-one count; the name is what she encodes. L&S's experimenter helped children who could not count on; the voice plays that role here.
- Following her Number Garden steps: phase 1 reads nothing but opensAt, and reads and writes no Leitner. R: counting on by small steps is the bridge between counting all and recall that her add-to-10 lessons need (her profile: 100% finger reliance, CLAUDE.md). The same path suits every step from number-recog to add-to-20, because the challenge is the race, not the numbers. Bigger numbers come in phase 2 (4).
- Spinner 1-6 later: no. The 100 board uses 1-5, L&S's own spinner. R: 1-3 on 100 squares is about 50 turns each.

(2) ONE RACE

- Setup: two bunnies on a start meadow before square 1, hers and Emma's. Emma stays at layout.emma (play-place.md:190) and plays her bunny from there. R: a hopping Emma is new Emma art, as with the raft's T4 (play-place.md:814).
- Turn: the child spins (tap), about 1 s, a plain ease-out stop: no slow-down at a border, no "almost" wobble. E: near misses raise the urge to keep playing (Clark et al. 2009, Neuron 61(3) 481-490; from memory, not re-read). She hops. About 500 ms after her last name, Emma's spinner spins by itself and her bunny hops at the same pace, with names. No timer anywhere: the game waits for the child forever.
- The end: a spin that would pass 20 stops on 20. R: needing an exact landing makes the end a wait on luck.
- "Where will you land?":
  - When: on her 2nd turn, then every 3rd (5, 8, 11). Never on a spin that reaches 20, and never on Emma's turns. That is about 3 a race (computed: median 10 child turns, 10th percentile 8, 90th 11). Deterministic, so it can be tested. In 2-player mode, the same rule per player.
  - What she does: after the stop, Emma (attentive-pointing) asks. Every square ahead of her bunny shows as tappable, not only the reachable three (R: lighting three gives the answer away). She taps one and a small marker in her bunny's colour stands on it; another tap moves it. Then she hops as on any turn. She can skip the question by hopping straight away: no line, nothing lost. R: an invitation, not a gate (real-games:88).
  - Match: when her bunny lands on the marker, the marker pops (sparkle 0.55 and the correct-tap burst from that square), Emma takes cheering and says "You knew it!".
  - Miss: the bunny lands where its hops end, and the square is named as always. The marker sinks into the grass over 300 ms, with no sound, line or pose. Never "oops", "not quite" or "try again"; no red, X, buzzer or poof (play-place.md:215). R: the gap between the marker and the bunny is the world's own feedback (Juul 2009, real-games:41). A guess never changes any movement.
- Emma's moves (shipped poses, packages/core/src/character/emmaPose.ts:24-32, 'sleepy' included, art at mobile/assets/emma/sleepy.webp):
  - Silly hops, no effect: on about 1 in 4 of her turns, one hop is a somersault, a bump onto her bottom or an ear-spin. No line. R: humour (real-games:43).
  - The count trick: on about 1 in 4 of her turns, from her 2nd, at least 3 of her turns apart, and never when the extra hop would reach 20. Her bunny hops one too many, and every square is still named correctly (spin 3 from 7: "Eight! Nine! Ten! Eleven!"). Emma: "Hee hee! Did I count right?".
    - If the child taps Emma's bunny, it hops back one square and names it ("Ten!") with sfx-boing, and Emma goes puzzled-tilt, then cheering: "Oops! You caught me!".
    - If she spins instead, the extra square stays, with no line.
    - A tap on Emma's bunny when there was no trick: it wiggles, nothing more.
    - E: children of 3-5 can judge a puppet's counting errors (the error-detection paradigm of Gelman & Meck 1983, Cognition 13, 343-359; read via secondary summaries). R: children this age love catching an adult's mistake (real-games:43). The number names stay right; only the one-to-one count is broken, so she never hears a wrong number sequence.
  - The nap: at most once a race, a 1-in-8 chance on each of her turns from her 2nd. Instead of spinning, Emma goes 'sleepy' and her bunny curls up (Zzz drawn) for about 2 s; then "Oh! I fell asleep!", and her turn is over.
  - How Emma wins and loses: one fair spinner for both, no hidden fixing. E (computed): if the child starts and Emma has no funny moves, the child wins 60.6%. With the trick and one nap, she wins 61.4% if she never catches the trick, 67.6% if she catches half and 73.5% if she catches all. With the trick alone, caught half the time: 53.7%. R: Emma wins about 1 race in 3, by luck, and the child's catches move the odds a little toward her.
- Ladders and slides: none, and no extra that moves a bunny. E: the board is like "the first row of Chutes and Ladders", and it works because "it takes twice as many physical movements and roughly twice as much time to move one's token from the origin to 6 as to 3", and children "say and hear twice as many number words" (L&S, on Siegler & Booth's analysis). R: a ladder from 4 to 14 moves ten numbers in one move, and a slide moves her back, which breaks that link. A slide is also "a score that drops" (real-games:85). Allowed: landing reactions that move nobody (a flower opens, a hedgehog peeks), Kyle's call, no lines (surprise, real-games:39).
- The spinner pays nothing: no special sectors, star squares, bonus spins, extra hops or lucky squares (real-games:71, :144).

(3) TWO PLAYERS, ONE iPad

- The game opens on a picker of two pictures, no text: her bunny and Emma's bunny, or two bunnies. One tap. Phase 1 remembers nothing.
- Player 1 is the playing learner (whose Play place it is). Player 2 is whoever sits with her, a sibling or a parent. The game asks, reads and writes nothing about player 2. Bunnies differ by colour only, and nobody is named. E: design/native/learner-profiles.md:425-426 (no leaderboard; Emma never mentions another child).
- Turns alternate. Player 1 starts the first race of a visit, then the starter alternates within the visit (held in memory). E (computed): the starter wins 60.6% on the 20 path, so alternating evens it out over a visit.
- Emma has no bunny then. She is the host from her place: the open line, the prompts on each player's turns, the arrival lines, the close. No trick or nap. R: with three racers each child waits two turns, and the funny moves belong to the game against Emma.
- A parent: E: in L&S the games were played "with the experimenter", who helped with the counting. R: a parent naming squares with her recreates that setting. The game has no parent text.

(4) WINNING, LOSING, THE STOP, PROGRESSION

- She arrives first: her bunny munches the carrot. Emma takes celebration and says "You got there first!", with sfx.cheer and the burst at the carrot. Emma's bunny flops over laughing, then hops in to share. Then "What a race!".
- Emma arrives first: her bunny munches, and Emma takes cheering: "Lucky me! Now hop yours to the carrot!". The child goes on with only her own turns until she arrives. Then "You did it!" (the bundled canon clip, mobile/src/audio/canonAudioRegistry.ts:1575, through the praise clips' canon seam, mobile/src/screens/play/playLines.ts:53-58), sfx.cheer and the burst, both bunnies munching, and "What a race!".
- Why a loss is safe: E: in attribution theory, failure put down to luck (external, unstable, not controllable) does not lower expectations or self-worth the way failure put down to ability does (Weiner 1985, Psychological Review 92(4) 548-573; from memory, not re-read). Here the race is luck, Emma says so, the child still reaches the carrot with the same beat, and nothing is recorded. Emma never says she won or the child lost: C8 already bans "win" (play-place.md:734). E: L&S played every game "until both players reached 100".
- Two players: the first to arrive gets "You got there first!"; the other plays on alone to "You did it!"; then "What a race!".
- Natural stop: "What a race!" goes back to the start picker, silently; Back goes to the Play place. Nothing starts on its own, and no line says again or one more (real-games:89). A race is about 10 turns each (computed). R: about 2-3 min, not measured.
- Thomas's asks, against my safeguards:
  - Visible goal: the carrot on 20, always on screen. Fits.
  - Rewards: the arrival beats, "You knew it!" and catching Emma. Each answers something she did, and none is paid by the spinner. No stardust, counted carrots, trophies or win tally. R: a tally of wins in a game of luck is a luck meter.
  - Level up (phase 2): the 100 board opens on her first arrival on the 20 path, never on a win. R: a level paid by a win is a prize paid by the spinner, the line real-games:71 draws. Arrival is guaranteed in every race, so the board opens after her first race; it is a harder game, not a prize, like the hunt's unlock (design/research/critters-word-hunt-2026-10-25.md:41). It stays open, and she can go back to 20. It is kept per learner as one toy-state flag (the 100 board is open), never as progress (real-games:87). For this game only it changes Decision 4 (play-place.md:34) and N5 (:744), as the hunt and the raft island do.
  - The 100 board: 10x10, 1 at bottom left, 11 above 1, 100 at top right, spinner 1-5: L&S's own board and spinner. No path step gates it. R: it still judges only counting squares, and counting to 100 is a kindergarten goal (Common Core K.CC.A.1, "Count to 100 by ones and by tens"; from memory). The raft for 100 waits for two-digit adding (in-flight raft ruling) because the raft judges sums of tens.
  - E (computed): the 100 board takes a median of 32 child turns (10th percentile 30, 90th 35), about 3 times the 20 path. L&S's two games to 100 took 19-25 min a session. R: that is long for one sitting, so it is her choice. Retune Emma there: with today's rates the child wins only 56.6% (computed).
- Watch on device: tears or quitting after a loss → raise the nap to 1 in 6 (the child then wins 69.8% when she catches half the tricks, computed). Prompts that annoy → every 4th turn. Lessons still about two-thirds of app time (real-games:119).

(5) SPEND

- Lily, phase 1, kind 'play': 11 new lines. I found none of these texts in guidanceLines.ts or public/canon (grep):
  1. "Race my bunny to the carrot! Spin, then hop!" (44)
  2. "Race to the carrot! Spin, then hop!" (35, two players)
  3. "Where will you land?" (20)
  4. "You knew it!" (12)
  5. "Hee hee! Did I count right?" (27)
  6. "Oops! You caught me!" (20)
  7. "Oh! I fell asleep!" (18)
  8. "You got there first!" (20)
  9. "Lucky me! Now hop yours to the carrot!" (38)
  10. "What a race!" (12)
  11. Square 20: caption "Twenty!", input "Twenty," (7)
  - 253 characters. C8 holds: no again, next, more, round, win, fast or "not a word".
- Squares 1-9: captions "One!" to "Nine!", inputs "One," to "Nine,". These are the raft totals (packages/core/src/emmasPath/guidanceLines.ts:293-301; public/assets/audio/path/guide-play-raft-total-1.mp3 to -9.mp3), so 0 characters: the dry run bills only uncached inputs (play-place.md:636), as "Six," was reused (:660).
- Squares 10-19: inputs "Ten," to "Nineteen," (80 characters). These are the same 10 inputs as the raft island's totals (in flight, tmp/specs/dave-raft-island-ruling.txt (6) in the main checkout, not on main). Whichever renders first pays; the other pays 0. Phase 1 is 253 characters, or 333 if the bunny renders first. "You did it!" is bundled: 0.
- Ear-test prediction: "Twenty," comes back falling and under 1 s. "Hee hee!" is read as words, /hiː hiː/, like the raft's (play-place.md:667). "Where will you land?" rises on "land". Untested: whether one name per hop sounds like counting rather than separate shouts, and whether "Lucky me!" sounds playful, not smug.
- Art (pack generator, clay, 2 variants each, $0.078 an image, critters-word-hunt-2026-10-25.md:86): her bunny, player 2's bunny, Emma's bunny (with a mark of Emma's, Kyle), the carrot and the ui-bunny tile. That is 5 subjects, 10 images, about $0.78. Cheaper: one bunny, with three scarf colours tinted in the app: 3 subjects, about $0.47. R: for 6-9, whole-body colours tell the turns apart better. No rabbit, bunny or carrot picture exists today (mobile/assets/pictures). $0: the path, squares, spinner, marker, Zzz and meadow (drawn in the app), and Emma (shipped poses).
- Sfx: none required. Shipped and reused: plink, sparkle and cheer (mobile/assets/audio/sfx/ holds only cheer, chime-soft, plink, poof and sparkle). The trick's hop-back uses sfx-boing, which has never landed (mobile/src/screens/play/playKit.ts:18), so it is silent until it does (play-place.md:719). Optional, sourced like T5, cost unknown: a short spinner whirr and a soft snore. Never the poof.
- Phases:
  - Phase 1: the 20 path, against Emma and for two players, writing nothing. 11 lines (253 or 333 characters), about $0.78 of art.
  - Phase 2: the 100 board, its one flag and a board choice in the picker. 80 number words, "Twenty-one," to "Ninety-nine," plus "One hundred,", 905 characters (computed). The open lines are reused (the carrot sits on 100). $0 art. Emma's handicap retuned.
  - Never: ladders, slides, spinner prizes, a win tally.
- Developer constants (names are Kevin's to pick): 20 squares; spinner 1-3; the child starts (vs Emma); the prompt on child turns 2, 5, 8, 11; trick 1/4, from Emma's 2nd turn, at least 3 of her turns apart, never reaching 20; nap 1/8, once, from her 2nd turn; silly hop 1/4; Math.random in the app, seeded in tests; zero writes in phase 1 (N5 holds).

(6) WHAT KYLE MUST DESIGN NEXT

1. The 20 path on all four forms inside A (play-place.md:198-201): two rows of 10 with 11 above 1, numerals, the decade tint, the start meadow, the carrot, square sizes, and two bunnies sharing a square.
2. The three bunnies: look and colours, Emma's mark, the hop arc and pace (one name per hop), the hop from 10 up to 11, the silly hops, the nap, the hop-back and the munch; a cue for whose turn it is.
3. The spinner: sectors with numeral and dots, a place in thumb reach, a turn colour, and a spin with no tease.
4. The guess: how squares show they can be tapped, the marker, the match pop and the quiet sink.
5. The beats: first arrival, "Lucky me!" and her solo finish, "You did it!", the shared carrot, "What a race!", and the way back to the picker.
6. The start picker (against Emma, or two bunnies), and phase 2's board choice.
7. The third Play-place tile (ui-bunny) and the shelf: play-place.md:146 says a third game turns the tiles into rows per kind. It must fit the restyle in flight.
8. Reduce Motion (fades) and VoiceOver labels (never spoken): squares ("Square seven"), bunnies, the spinner ("Spinner, three").
9. Later, phase 2: the 10x10 board on all four forms. A on a phone in landscape is 216.4 pt high, so each of the 10 rows gets 21.6 pt.
