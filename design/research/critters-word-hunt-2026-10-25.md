# Letter critters word hunt: Dave's ruling (2026-10-25)

The text of the ruling Dave returned by Orca dispatch on 2026-10-25, verbatim. It was `tmp/specs/dave-wordhunt-ruling.txt` in the main checkout, which git ignores; prettier added only blank lines and list indentation. `design/native/critters-word-hunt.md` cites it as "Dave (n)" by the section numbers below. Line numbers in it are at `origin/devon/critters-mom-words` cb4d108b unless it says otherwise.

SUMMARY. I designed the Letter Critters word hunt: each round deals 6 critters (1 of her vowels + 5 consonants) whose 5-8 findable words fill visible slots, and the round is complete at all but one, which is Thomas's 95% rounded down for these sizes; the round ends in a fixed celebration, and her first complete 3-letter round opens 4-letter rounds (7 critters, 4 seats). Found: phase 1 needs 0 new Lily lines and 4 new pictures (about $0.31), because a scratch script over the word lists finds 184 clean rounds with no new audio; phase 2 needs 118 Lily lines (642 input characters) and 16 pictures (about $1.25); owl becomes a quiet text-only word that no round deals, because its letters don't sing "owl". Left for Kyle: the slot row, the log numeral, the length picker, the completion beat, the "new letters" control and the vowel's empty burrow (list at the end); left for me when phase 2 is built: the list of 4-letter words a child knows that the critter sounds don't spell.

RULING. E = cited or computed evidence, R = my reasoning. "Computed" means a scratch script (not committed) over playPlace.ts at origin/devon/critters-mom-words cb4d108b. Line numbers are at that commit.

(1) THE ROUND

- Gate. The hunt replaces the free meadow once blending-cv is current or mastered: the gate critterFunnyOpen already uses (playPlace.ts:384, :392-394). Before that, the toy meadow stays as it is. R: a hunt asks her to blend, so before blending is taught the toy stays a toy.
- Letters. 6 critters: 1 vowel + 5 consonants. The vowel is one of her taught short vowels: a from blending-cv, then o, u, i, e from cvc-words-short-o/u/i/e, each once current or mastered. E: my rail "judged items from current or mastered steps" (design/research/real-games-2026-10-20.md:88). Each round picks one of her vowels and is never the same letter set as her last round. Marian has a and o (from Kevin's read of her 2026-10-25 backup: cvc-words mastered, short o current; I did not read the backup myself).
- The vowel has no twin in a round. Consonants keep their twins, so dad, mom and pop still work. E (computed): with the vowel twin, the doubled-vowel words (see/bee/too quiet, pee/poo/wee never-say) leave 7 short-o and 12 short-e rounds; without it, 27 and 21. R: every round word has one vowel.
- Which words count.
  - TARGETS: every word the 6 letters spell that is (a) one of the 45 picture words, (b) one of the said words with a picture (playPlace.ts:355-372, plus mum, mug, sad, mud and hug once their pictures land), or (c) on a new pinned familiar list of 68 words: bad fat had lap mad pat ran sad sat wag wax and get let men met pet red set ten wet fed vet big bit did dig dip fin fit fix hid him hip hit lip lit mix pit rip sit six tin tip win dot fog got hop hog job jog lot nod not but cut dug fun hug hum mud mug mum pup rub run tug.
  - EXTRAS: the other said words the letters spell (the rare ones: dab, gag, cob, nun and so on). Emma says them and the joy beat plays, as today. They show as a bonus beside the slots, are never required, and nothing says how many exist. R: a 6-9 learner finds these only by trying, so making them targets is a grind.
  - QUIET words (CRITTER_NOT_SAID, playPlace.ts:282-328) never count, because Emma would fill a slot without saying the word. So the deal rejects any letter set that spells a quiet word: in a round, a word she knows never just sits there. R: once there is a target, a real word that sits quietly reads as "that didn't count".
  - NEVER-SAY words stay buildable, inert and uncounted, as now.
- Size. 5-8 targets, at least 3 of them with a picture, at most 3 extras, and every consonant used by at least one target. Drawn by draw-and-accept, with pinned fallback rounds per vowel, as raftShore does (playPlace.ts:139-147). E (computed): phase 1 has 184 rounds (a 45, e 21, i 30, o 27, u 61); with phase 2's 9 new said words, 439 (a 203, e 39, i 53, o 83, u 61).
- Probe guard. While cvc-words is current but not mastered, the deal rejects letter sets that spell any of the 8 probe-reserve words (map nap rat ham cab rag ram pad, novelProbeWords.ts:27-36). R: probeReserve.ts:30-52 ranks a word she has met below a new one, and the hunt would use up the check's fresh words. That leaves 11 short-a rounds in phase 1 and 95 in phase 2. Marian is past this point.
- Same rules for every learner; only the vowels follow her steps.
- 95% (Thomas). Complete at floor(0.95 x N) found targets, which is N-1 for every allowed size: 4 of 5, 5 of 6, 6 of 7, 7 of 8. R: rounded up, 95% would mean "all" at these sizes and lose its point. No round is smaller than 5, so no round needs every word. The rest stay findable after the reward (3).

(2) FINDING

- A new target first plays its outcome as it does today (the reward ruling stands: joy beat, and a picture word's praise on its first build in a visit). Then its letters become tiles (vowels pink, consonants honey, as the critters) in the next empty slot, filled left to right in find order. Its picture sits on the slot if it has one. Tapping a slot replays the word.
- What is left is shown by the empty slots alone: one per unfound target, each made of X empty boxes (seats in miniature). There is no "3 of 7" numeral, and Emma never says how many are left.
- Extras: a small bonus chip beside the slot row. No empty place for it, no gap.
- A repeat find plays its outcome (joy beat, no praise, per the once-per-visit rule) and its slot wiggles. No fill, no line.
- Hint. After 5 runs of three in a row with no new target, or 45 s with no drag (R: numbers to tune on device), one empty slot glows. Tapping it plays the word of a target she has not found: a picture word's blend clip, a said word's Emma clip, with its picture ghosted if it has one. One hint at a time, no line, no audio. E: this turns the hunt into spelling a word she heard; Cunningham & Cunningham (1992), "Making Words", The Reading Teacher 46(2), describe spelling and decoding as drawing on the same phonological knowledge. Making Words is the classroom form of this game: a few letters, every word they make. It is practitioner evidence, not a trial.
- Non-words: 3-letter rounds as now (boing, funny lines); 4-letter rounds see (4).

(3) THE REWARD

- Completion beat, with 0 new audio, the same every time (R: predictable, never a random or every-Nth prize):
  1. The completing find's own outcome ends.
  2. Emma takes `celebration`.
  3. Each found word lights in find order and plays its own word (a picture word plays the word part of its blend clip).
  4. Emma says "You did it!", sfx.cheer plays, and the Word Song burst plays over the slots. "You did it!" is bundled canon, Word Song's session.end.opener (canonAudioRegistry.ts:1575), and needs the same canon-text seam the praise clips need (playKit.ts:56).
     It takes about 8-10 s.
- Unlock. Her first complete round of a length makes the next length's log (4 seats, "4") roll in after the beat. This is the reward Thomas asked for. E: Deci, Koestner & Ryan (1999) found that positive feedback raised intrinsic motivation and expected tangible rewards lowered it. R: the unlock informs her about her competence; it is a harder game, not a prize.
- After the beat the board stays and the last slot is still findable: finding it fills the slot with its usual outcome and no second celebration. A child-tapped "new letters" control appears, beside Back. Nothing starts the next round on its own and no "one more?" line plays (real-games :89; AC C8 holds, since "You did it!" uses none of its words).
- Collection. The round's board is the collection. There is no cross-round word book, total, round counter, star, stardust, sticker or badge. Nothing on the Hub, the Play tile, the Map or Session End mentions the hunt or an unfinished round. For the hunt only, this supersedes my "never a meter of what is missing" (real-games :87) and the reward ruling's "no collection or 'words found'", by Thomas's call. Everything else in both still holds.
- Never: a failure state, lives, a lost find (leaving keeps them), a timer, a clock, a speed bonus, a streak, a daily round, a comparison between learners, a re-lock, or a forced length (she can go back to 3).
- Not a grind: small rounds, all-but-one, the hint, a natural stop at completion, and a free choice of length. Watch on device: if she shows "I must get them all" distress at the last slot, or the hunt displaces lessons (lessons under about two-thirds of app time over a week, real-games :116-119), remove the empty slots and keep the celebration (real-games :183).

(4) PROGRESSION 3 -> 4 -> 5

- 4-letter rounds open on her first complete 3-letter round (Thomas's rule), and stay open. R: one round is enough; requiring more makes the unlock a grind, and the path, not the game, carries mastery.
- Which 4-letter words. CCVC and CVCC words in which every letter sings its own critter sound, with a short vowel from her steps. Excluded: ck, ng, sh, ch, th, doubled letters, r-controlled vowels, silent e, wa/al, ld after o, the British BATH vowel (Lily says fast, last, past and raft with /a:/), and words needing k, y or z. Not sight words (R: a sight word is read whole, and the critters spell sounds).
  E: adjacent consonants come straight after CVC in Letters and Sounds Phase 4 (CVCC and CCVC, no new graphemes; checked only through teaching-site summaries).
  In Word Song, crab-words and tent-words come far later (mastery.ts:179-207). R: that is acceptable because the critters sing every sound, so the blend is modelled, not tested, and a 4-letter non-word never boings. I relax my rail (real-games :88) for consonant clusters only; vowels still follow her steps.
- 108 targets (exact texts under SPEND). 12 of them are lesson words with a bundled picture and praise clip (flag, crab, hand, lamp, tent, nest, belt, gift, frog, pond, drum, plum; for example "Yes! That's a flag." at canonAudioRegistry.ts:1395). desk is out, because k is not one of the 22 critter letters (abcdefghijlmnoprstuvwx).
- Rounds: 7 critters (1 vowel + 6 consonants), 4-7 targets, at least 1 with a picture. E (computed, before the known-quiet filter below): a 72, e 88, i 12, o 29, u 36.
- The log. A 4th seat; the log is 4 x 1.25c + 3g + 32 = 336 pt on a phone in portrait, against an A width of 343: it fits with 3.5 pt a side (play-place.md:451, :198). It sings only when all 4 seats are full. A partial run sings only when she taps the log, and is never judged or cleared.
- Sounds. The critters sing the shipped letter windows (play-place § 3.4), so there are no new sound renders. No 4-letter blend clip exists: the crab-words and tent-words canon has no .blend lines.
- The word. Emma says a whole-word Lily clip ("Flag.") for all 108, the lesson words included, then the joy beat. A lesson word's first build in a visit also plays its praise clip, as a 3-letter picture word does.
- Every other 4-letter run (a non-word or a rarer real word) sings and sits quietly. R: no 4-letter list can hold every word a child knows, and a real word is never a mistake (D5).
- So the deal must reject letter sets that spell a 4-letter word she may know whose sounds don't spell it. I draw that list when phase 2 is built. Starter, not complete: bold cold fold gold hold mold sold told bolt colt most post host both wasp want wand swan swap salt malt halt calf half palm calm fast last past mast vast raft gasp rasp pint mind find bind wind wild mild girl bird word worm farm card hard park part born corn fork horn torn form burn turn hurt curl fern herb blew grew crew drew flew stew slow glow snow flow grow crow blow brow plow claw draw.
- 5 letters: phase 3, not designed now; it opens on a complete 4-letter round. It needs:
  - 5 seats: 5 x 70 + 4 x 8 + 32 = 414 pt, which does not fit a 343 pt phone in portrait at today's seat size;
  - 8 critters;
  - CCVCC and CCCVC words (stamp, frost, twist, strap, split, scrub), all with new clips and pictures. Word Song has no 5-letter lesson word whose letters each sing their own sound (brick, clock, swing, chick, chest, thick, cloth, shell, sheep and shark all have a digraph).

(5) VISIBLE "X-LETTER WORDS", WITHOUT READING

- The log has X seats, so the length is the toy itself.
- A numeral X is carved on the log's end; she reads numbers.
- Every slot is X boxes.
- With more than one length open, the game opens on a picker of logs: 3 seats with "3", 4 seats with "4". No text.
- Emma's open line names the number. Today: "Drag three letters up to the log. If they make a word, I'll say it!" Phase 2 adds "Drag four letters up to the log. If they make a word, I'll say it!"

(6) owl AND THOMAS'S LIST

- owl goes onto CRITTER_REAL_WORDS and CRITTER_NOT_SAID. o-w sings /ɒ/ /w/, not owl: the same reason as cow, how and low on my 2026-10-25 list. It stops tumbling (it sings and sits), no round deals letters that spell it, and it gets no clip and no picture. Thomas expected it to count. My ruling is that it does not, because Emma would say a word the critters did not sing.
- E (computed): a sweep of /usr/share/dict/words for one-vowel 3-letter words over the 22 letters that are not on the list found more words a child knows that tumble today:
  - Sounds don't spell them (quiet in every phase): own, old, arm, art, ash, who, flu.
  - Sounds spell them: act, add, ant, elf, end, ill, its, odd, off. Quiet in phase 1, then said words and targets in phase 2.
    All 17 are text-only in phase 1.
- Pictures:
  - mug and sad get new pack pictures. mug must not read as cup, which is a picture word.
  - mum reuses mom.webp (0 spend; it then joins the said words with a picture).
  - wax, pat and fun stay without a picture. R: wax would read as candle, pat as dog, and fun has no picture.
  - mud and hug are new too (familiar targets) in phase 1; ant and elf in phase 2.
  - owl gets none.
- Count: 4 new pictures in phase 1 and 16 in phase 2 (ant, elf and 14 four-letter words: trap sand vest sled crib swim clip stop drop jump pump plug slug bulb), 20 in all. At batch 18's rate ($0.39 for 5, so $0.078 each): about $0.31, $1.25 and $1.56.

(7) PERSISTENCE

- Per learner, through the learner-scoped store, local, written on each new find and on each unlock:
  - the open lengths;
  - per length, the current round's letters and its found words in find order.
    A complete round is replaced by a fresh deal when she next opens that length or taps "new letters". Nothing else is kept: no totals, no round history, no times.
- It is toy state, never lesson progress: no mastery, Leitner, stardust, history or streak (real-games :75, :87). Kevin chooses the key. It changes Decision 4 (play-place.md:34) and AC N5. The seen-record write in critterSeen.ts is unchanged.
- Back mid-round: the same board, with no line about it. The praise-once set and the hints last for the visit only.

(8) SPEND

- Phase 1, the 3-letter hunt:
  - Lily: 0 new lines. "You did it!", the praise clips, the said words and the open line are all bundled.
  - Pictures: 4 (mug, sad, mud, hug), about $0.31; mum reuses mom.webp.
  - Text only: 17 words onto CRITTER_REAL_WORDS and CRITTER_NOT_SAID, the 68-word familiar list, and the hunt rules.
- Phase 2, 4-letter rounds and the 9 honest words: 118 Lily lines, 642 input characters:
  - 108 four-letter words, caption "<W>.", input "<W>," (540 characters):
    - a: crab flag hand lamp clap flap slap snap trap grab drag glad flat plan swam camp damp ramp band land sand
    - e: tent nest belt bend lend mend send went sent rent bent dent best rest test vest west help held felt melt left step stem sled next text
    - i: gift drip grip trip slip flip clip snip spin twin grin swim crib list mist fist lift mint hint limp film
    - o: frog pond stop spot plot slot drop crop flop plop prop trot blob lost cost soft from
    - u: drum plum club plug slug snug stub spun stun jump bump dump lump pump hump dust must rust just hunt gulp bulb
  - 9 three-letter words: Act, Add, Ant, Elf, End, Ill, Its, Odd, Off (36 characters).
  - 1 open line: "Drag four letters up to the log. If they make a word, I'll say it!" (66 characters).
  - Pictures: 16, about $1.25.
  - Text only: my known-quiet 4-letter list.
  - Ear-test prediction: "From," may come back as the weak /frəm/ (it is a function word); "Sent," and "Went," may run together with a following silence. Untested: whether the 4 letter windows in a row sound like one word being built.
- Phase 3, 5 letters: not sized.

KYLE MUST DESIGN NEXT

1. The slot row on all four forms (phone P and L, tablet P and L): 5-8 slots (4-7 for 4 letters) of X boxes each, the tile fill and picture thumbnail, the bonus chip, and the hint glow. Phone landscape is the tight one: A is 216.4 pt high (play-place.md:198-199), though 6-7 critters take 1 row there instead of 2.
2. The numeral on the log's end, and the 4-seat log (3.5 pt to spare a side on a phone in portrait).
3. The length picker of logs, and how a round in progress looks there (no count).
4. The completion beat: the lap of found words, "You did it!", the burst, the new log rolling in, and the board after it (the last slot still findable).
5. The "new letters" control: its look, and that it appears only after completion.
6. The vowel's burrow while the vowel sits on the log (no twin).
7. Reduce Motion and VoiceOver labels for the slots, the picker and the beat (labels only, never spoken).
