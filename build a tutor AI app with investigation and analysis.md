# Building a Tutor AI App for Marian — Investigation & Analysis

**Date:** 2026-04-23
**Child:** Marian, age 8
**Languages:** Tagalog (primary, home), some English, Danish school starting August 2026
**Goal:** Reach 3rd-grade math readiness + basic English literacy by August (~3–4 months)
**Character theme:** My Melody (Sanrio)
**Device:** Her own iPad
**Language policy:** Strict English-only
**Build timeline:** 4–6 weeks part-time (evenings + weekends)

---

## Table of contents

1. [Initial question and first recommendation](#1-initial-question-and-first-recommendation)
2. [Shift to a Claude Code skill](#2-shift-to-a-claude-code-skill)
3. [Interactive site concept](#3-interactive-site-concept)
4. [Final theme and scope set](#4-final-theme-and-scope-set)
5. [Math diagnostic](#5-math-diagnostic)
6. [Math diagnostic — analysis](#6-math-diagnostic--analysis)
7. [Context correction (mom helping)](#7-context-correction-mom-helping)
8. [Literacy diagnostic](#8-literacy-diagnostic)
9. [Literacy diagnostic — results and analysis](#9-literacy-diagnostic--results-and-analysis)
10. [Paper practice plan (10 min/day)](#10-paper-practice-plan-10-mindaily)
11. [Next steps](#11-next-steps)

---

## 1. Initial question and first recommendation

**User's situation:** 8-year-old daughter below 3rd grade level in math (addition, subtraction, multiplication). School starts in August. Could a Claude-powered adaptive learning app work?

**Recommendation:**

Yes, very feasible — Claude's Danish/English multilingual ability is strong, and adaptive tutoring is a good fit for the API. Main tradeoff: building a polished app usually takes longer than 3 months. Proposed split:

- Use an existing app (Matematikfessor, Khan Academy Kids, RegneRaketten) for daily drill _starting immediately_.
- Build a lightweight Claude-powered companion for what off-the-shelf apps do poorly: adaptive explanation, themed word problems, identifying where she's stuck.

**Key design principles proposed:**

- Don't call Claude for every problem (cost + latency). Generate problem batches ahead, grade locally.
- Diagnostic session first — find her actual ceiling before drilling.
- Spaced repetition (Leitner box) on math facts, not random drill.
- Short sessions (10–15 min), strong gamification.
- Concrete → visual → abstract progression, especially for multiplication.
- TTS for listening support.

---

## 2. Shift to a Claude Code skill

**User:** What if it were just a Claude Code skill and she used the command prompt?

**Recommendation:** Yes, a skill is a great prototype path. Claude itself _is_ the adaptive engine — the skill just tells Claude how to behave and where to read/write progress.

**Minimum pieces:**

- A skill file at `~/.claude/skills/math-tutor.md` defining tone, session shape, and skill progression
- A progress JSON file — current level, mastered facts, weak facts, recent mistakes
- A session shape — greet, pick 8 problems (review + stretch + spaced mistakes), present one at a time, save progress
- A skill ladder — add-to-10 → add-to-20 → 2-digit no-carry → 2-digit carry → subtraction mirror → ×2/×5/×10 → ×3/×4 → ×6–9

**Real limits flagged:** Terminal is flat — no sounds, animations, color-pop. Paper actually has the edge on tactile joy. Typing is slow for an 8-year-old. Claude Code is a dev tool.

**Honest read:** Skill is an upgrade over paper for the _adaptive_ part (Claude knows where she's stuck, explains patiently). It's a downgrade for the _fun_ part. Best use: paper for tactile stuff, skill for targeted drill.

---

## 3. Interactive site concept

**User:** How would an interactive site themed with unicorns work, using Claude to be adaptive and conversational?

**Recommendation:** A themed site is much better for stickiness than a terminal. The "conversation with a unicorn friend" framing solves "feels like homework."

**What a session feels like:**

She opens the site. A unicorn (Stella) is waiting, mid-animation, speech bubble saying _"Sidsel! You're back! I'm baking cupcakes for the rainbow dragons and I need help counting…"_. Problems arrive as _scenarios_, not bare arithmetic. She types the answer, Stella reacts in character — happy ear-wiggle on correct, puzzled tilt on wrong, never a red X. Between problems Stella chats briefly. Ends with stardust, unlocking the next background, teaser for tomorrow.

**Claude is the brain, not the mouth — the critical architecture:**

- **One Claude call at session start** returns a full session plan as JSON: 8 problems, 10 bits of pre-written chatter, pre-canned explanations for common wrong answers, end-of-session message. ~3 seconds once, then session runs instantly from the blob.
- **One Claude call on real stumbles** — when she's wrong _and_ the pre-canned explanation didn't land. Claude sees her attempts and writes a fresh explanation with concrete imagery. The highest-value Claude moment.
- **One Claude call at session end** updates the progress model.

Net: ~3 Claude calls per session, no latency in the fun path. Haiku for session generation, Sonnet for stumble explanations.

**The adaptive layer:**

```json
{
  "level": 3,
  "mastered": ["add_to_10", "add_to_20"],
  "in_progress": { "add_with_carry": { "seen": 24, "right": 18 } },
  "recent_mistakes": [{ "problem": "27+15", "answer": "32", "date": "..." }],
  "streak_days": 4,
  "unlocked_backgrounds": ["meadow", "cave"]
}
```

Claude reads this at session start, weights problems 40% review / 40% current / 20% stretch, surfaces recent mistakes via spaced repetition, writes back the updated version. localStorage is fine — no database needed.

**Stack proposed:**

- React + Vite + Tailwind
- Framer Motion for expression changes + celebration animations
- Web Speech API (TTS) for Stella to read problems aloud
- Howler.js for soft chime on correct, gentle poof on wrong
- Claude API via tiny Cloudflare Worker / Vercel Function (never from browser)
- 4–6 character expressions + 3–4 backgrounds — reuse with animation goes a long way

---

## 4. Final theme and scope set

**User's reply with key context:**

- Daughter's name: **Marian**
- Not fluent in English, needs alphabet/phonics/words too
- Character: **Melody** (she loves Melody → confirmed My Melody, Sanrio)
- 4–6 weeks polished, evenings + weekends
- iPad, strict English-only

**Reading constraint reshaped everything:**

- **Audio-first, not text-first.** Melody _speaks_ every instruction via TTS. Text on screen mirrors what Melody says for passive exposure.
- **Icons and numbers do heavy lifting.** A math problem is `3 + 4 = ?` rendered big with visual groups. Minimal reading required.
- **Claude's register drops hard.** System prompt caps Melody's vocabulary to ~200 core English words + target phonics words for current session.
- **No English word problems yet** — numeric + visual only until reading catches up.

**Two skill trees, one session:**

**Melody's Number Garden (math):** Number recog → add to 10 → add to 20 → subtract to 10 → subtract to 20 → 2-digit ± → skip counting → ×2/×5/×10 → ×3/×4 → ×6–9

**Melody's Word Song (literacy):** Letter names → letter sounds (consonants → short vowels) → blending (CV) → CVC words → digraphs (sh/ch/th) → sight words → simple sentences

**4–6 week scope budget (ruthlessly):**

- Week 1 — Architecture, Melody art (4–6 expressions + 3 backgrounds), Claude API integration, skill state JSON, TTS wired
- Week 2 — Math mode MVP end-to-end: Claude generates, UI runs, progress saves
- Week 3 — **Ship to Marian.** Ugly but working. Literacy mode: letters + sounds
- Week 4 — Phonics blending + CVC
- Week 5 — Gamification: stardust, streaks, Sanrio friends unlocks, sparkle animations
- Week 6 — Audio polish, bug fixes, deploy (Vercel + shared-secret URL)

**Cut from scope:** accounts, multi-user, mobile app wrapper (it's a PWA), speech recognition, analytics beyond the progress file.

---

## 5. Math diagnostic

20 problems, easy → hard within each skill, designed to find her ceiling.

### Addition (9)

1. 3 + 2 =
2. 6 + 4 = _(makes 10)_
3. 7 + 5 = _(sum past 10)_
4. 9 + 8 = _(bigger sum past 10)_
5. 13 + 5 = _(2-digit + 1-digit, no carry)_
6. 24 + 13 = _(2-digit + 2-digit, no carry)_
7. 28 + 6 = _(2-digit + 1-digit, with carry)_
8. 36 + 27 = _(2-digit + 2-digit, with carry)_
9. 4 + 3 + 2 = _(three numbers)_

### Subtraction (8)

10. 5 − 2 =
11. 9 − 4 = _(within 10)_
12. 10 − 3 =
13. 15 − 4 = _(teens, no borrow)_
14. 14 − 6 = _(teens, with borrow)_
15. 20 − 7 =
16. 38 − 15 =
17. 45 − 18 =

### Multiplication concept (3)

18. 2 + 2 + 2 = _(repeated addition)_
19. 3 × 2 = _(can she read ×)_
20. 4 × 5 =

**What to watch for:** right/wrong, _how_ she solved it (fingers / head / tally / instant recall), and roughly how long.

---

## 6. Math diagnostic — analysis

### Marian's results

```
3+2 = 5,  over 10s, fingers ✓
6+4 = 10 (first 9 wrong), over 10s, fingers
7+5 = 12 (first 13 wrong), long, fingers
9+8 = 17 (first 18 wrong), long, fingers
5-2 = 3, instant, fingers ✓
9-4 = 5, instant, fingers ✓
10-3 = 7, instant, fingers ✓
15-4 = 11, long, fingers ✓
1+1+1 = 3, instant, fingers ✓
2+2+1, over 10s, fingers
3×2 = 6, long with little help, fingers
            — said "3 times 2" immediately but took long to figure out calculation
```

### Read

**Conceptually fine.** Every answer was correct (after self-correction). She understood × immediately. Metacognitive self-check present.

**Bottleneck is automaticity, not concepts.** 100% finger-reliance, including for `3+2`. The off-by-one errors on `6+4`, `7+5`, `9+8` are finger-counting mechanics, not math errors.

**Key observations:**

- Sums to 10: fluent with fingers, needs speed
- Sums past 10: **not yet in her toolkit** (consistent wrong first try, off by one)
- Subtraction within 15: fluent
- Multiplication concept: latent — she understood "3 times 2" but needed a strategy

### Starting levels set

- Addition — Level 1 (sums to 10), drive automaticity before teens
- Subtraction — Level 2 (within 15 confident), extend to 20 without borrowing
- Multiplication — Level 0 (repeated addition concept, no × symbol yet)

### Teaching implications

1. **Kill finger-counting gradually.** Timed drills in small doses — "how many can you do in 60 seconds?" not pressure. Reward finger-free answers extra.
2. **"Make 10" bridge strategy.** Teach `7+5 = 7+3+2 = 10+2 = 12` explicitly once number bonds are instant.
3. **Subitization practice** (recognizing dot patterns 1–6 instantly).
4. **Start multiplication with skip counting + repeated addition**, not symbols. ×2 and ×10 first (doubling + append zero are the intuitive patterns), then ×5 (half of ×10).

---

## 7. Context correction (mom helping)

**User added:** Mom helped her a little after each wrong answer — told her it was wrong and nudged her to recalculate.

**Revised read:** Her independent first-try ceiling is sums to 10, not to 20. Self-correction credit was overstated — it was mom prompting, not her own metacognition (still good — she _can_ fix with a nudge, but it's a different skill).

**Changes to plan:**

- Addition starting level drops one rung — full automaticity on sums to 10 _first_, then "make 10" bridge
- Number bonds to 10 becomes the single most important paper drill
- For future diagnostics, capture first-unaided answer vs after-nudge separately

---

## 8. Literacy diagnostic

20 items across 4 skills.

### Part 1 — Listening comprehension (3)

1. "Hello! How are you today?"
2. "Can you point to something blue?"
3. "What is your favorite animal?"

### Part 2 — Letter names (7)

4. M (upper, common)
5. S
6. A (vowel)
7. t (lower, harder)
8. p
9. Q (less common)
10. b (easily confused with d)

### Part 3 — Letter sounds (5)

11. m → /m/
12. s → /s/
13. a → short /æ/
14. t → /t/
15. i → short /ɪ/

### Part 4 — Blending (2)

16. /m/ + /a/ → "ma"
17. /i/ + /s/ → "is"

### Part 5 — Reading CVC (3)

18. cat
19. sun
20. dog

---

## 9. Literacy diagnostic — results and analysis

### Marian's results

```
1. "How are you?" → "I'm fine" ✓ understood
2. point to blue → answered "no", didn't understand "point to" until explained
3. favorite animal → "hmm cat" ✓
4. M → perfect ✓
5. S → perfect ✓
6. A → perfect ✓
7. t → perfect ✓
8. p → perfect ✓
9. Q → perfect ✓
10. b → confused with d
11. m sound → perfect ✓
12. s sound → perfect ✓
13. a sound → perfect ✓ (struggled with handwriting legibility)
14. t sound → perfect ✓
15. i sound → hard for her
16. m + a → perfect ✓
17. n + o → perfect; i + s → trouble with /i/ sound
18. cat → perfect ✓
19. sun → didn't know the word but nearly decoded (u pronounced more like "oo")
20. dog → perfect ✓
```

### Crucial new context

**Marian speaks Tagalog, not Danish** (mom is Filipino; dad is Danish; she's entering Danish school in August). All answers given in English — her functional English is better than the "not fluent" framing suggested.

### Revised read — I was underestimating her

- **Oral English works.** Answered "I'm fine," understood "favorite animal." Only missed "point to" because of the specific verb phrase. **Melody does _not_ need baby-talk.** Simple natural kid English is fine; constraint is "don't assume specific verbs/idioms, explain with gestures/pictures."
- **Alphabet essentially mastered.** b/d flip is universal at 8, not a reading problem.
- **Phonics consonants solid.**
- **Short vowels are the weak spot.** Short _a_ mastered; short _i_ stumbled. Expect _e/o/u_ similar to _i_. Teaching the short-vowel ladder is the highest-leverage lever.
- **CVC decoding emerging.** Read `cat` and `dog` cold. On `sun` she basically decoded correctly but didn't know what _sun_ meant. **Vocabulary is the bottleneck, not decoding** — every CVC word needs a picture + audio so decoding builds vocab simultaneously.

**Why Tagalog matters:** Tagalog has nearly perfectly phonetic orthography using Latin alphabet. Her decoding skills transfer naturally — that's why she's reading CVC words better than expected.

### Updated starting levels (both trees)

**Math (Number Garden)**

- Addition: sums to 10, automaticity focus; "Make 10" bridge once number bonds instant
- Subtraction: within 15 confident; extend to 20 no-borrow
- Multiplication: repeated-addition concept with visual groups, no × yet

**Literacy (Word Song)**

- Alphabet: quick refresh on b/d only
- Consonant sounds: review mode (mastered)
- **Short vowels: the focus** — walk the ladder _o → u → e → i_ with CVC word families
- Blending: CV confident; push CVC
- CVC reading: emerging — every word paired with picture + Melody saying it
- Sight words: not tested; introduce gradually (the, and, is, a)

---

## 10. Paper practice plan (10 min/day)

Produced as a printable PDF at `C:\Users\538252\Documents\marian-practice\marian-practice.pdf` (10 pages, A4, My Melody pink theme).

### Structure

- **5 min math** + **5 min literacy** daily
- Same routine every day, different vowel every week

### Math block (5 min)

**Fixed order:**

1. **Number bonds drill — 2 min.** Deck 1 flashcards (1+9, 2+8, 3+7, 4+6, 5+5 and reverse-style "2+?=10"). Goal: under 5 seconds each, no fingers, two days in a row → promote to "make 10" bridge.
2. **Day-of-week variant — 2 min:**
   - Mon/Wed/Fri — Doubles deck (2+2 through 10+10)
   - Tue/Thu — Near-doubles (3+4, 4+5, 5+6, 6+7, 7+8, 8+9)
   - Sat — Mixed: 5 bonds + 5 doubles
   - Sun — Light: count things in the house
3. **Skip counting out loud — 1 min.** 2s to 20, 5s to 50, 10s to 100.

### Literacy block (5 min)

**Fixed structure, vowel rotates weekly:**

| Week | Vowel                                                   | Word families           |
| ---- | ------------------------------------------------------- | ----------------------- |
| 1    | short **a** (warmup — mastered)                         | -at, -an, -ag           |
| 2    | short **o**                                             | -op, -og, -ox, -ot      |
| 3    | short **u**                                             | -ug, -un, -up, -ut      |
| 4    | short **e**, then short **i** (hardest, saved for last) | -ed, -en, -ig, -it, -in |

**Daily routine within the week:**

1. **Sound warmup — 30 sec.** "Melody's sound of the week is /o/... ooo." Find 2 things in the room with that sound.
2. **Word family reading — 3 min.** Write 5–6 words from the family. She reads each, sounding out. **Draw a picture or act it out for every word** — vocab-building is the key.
3. **Mystery word — 1 min.** One unseen word from the family. Decode together. Show meaning.
4. **Silly sentence — 30 sec.** "The fat cat sat on a bat." Say fast, say slow, giggle, done.

### Flashcard decks (prepared once)

- Deck 1 — Number bonds to 10 (10 cards)
- Deck 2 — Doubles (9 cards)

Formatted in the PDF as cut-out cards with dashed borders, 6 per page.

### Tracker

30 boxes, one star/sticker per completed day. 7 stars in a row = small reward of her choice.

### Rules for grown-ups

- Keep it to 10 minutes. Stop on a high note.
- Push gently on math _speed_, not accuracy (she's already accurate).
- Accept slow decoding for reading — sounding out _is_ the skill.
- Bad day → 2 minutes and stop. Consistency > intensity.
- Ignore b/d mix-up. Self-resolves.

---

## 11. Next steps

**Short term (starting now):**

Run the paper plan for ~4 weeks, report back with:

- What she loved / what bored her
- Where she got stuck
- Surprises (good or bad)

**After 3–4 days of paper practice:** Quick check-in to tune the plan if needed.

**When app build starts (parallel with continued paper):**

1. **Concrete design artifacts** — progress JSON schema, Melody system prompt, walkthrough of session 1 on screen. "See the shape before any code."
2. **Week-by-week build backlog** — mapped to the 4–6 week budget.
3. **"Bridge to 10" problem set** for paper use once Deck 1 is automatic.

### Key design decisions locked

- Character: **My Melody** (Sanrio pink bunny, heart/flower/music motifs, music notes as reward currency)
- Device: **iPad** (PWA, home-screen install)
- Language: **Strict English-only** (no Tagalog/Danish bridging)
- Architecture: **Claude is the brain, not the mouth** — session-start generation, stumble explanations, session-end updates. Pre-generated chatter for flow.
- Budget: **4–6 weeks part-time**, ship rough at week 2–3, iterate with real usage.
- Two parallel trees: **Number Garden + Word Song**, mixed in single ~15-min sessions.

### Starting rung summary

| Skill            | Level                                            |
| ---------------- | ------------------------------------------------ |
| Addition         | Sums to 10, drive automaticity                   |
| Subtraction      | Within 15 confident, extend to 20 no-borrow      |
| Multiplication   | Repeated addition concept, no × symbol           |
| Alphabet         | Mastered (minor b/d)                             |
| Consonant sounds | Mastered                                         |
| Short vowels     | Short _a_ mastered; teach _o → u → e → i_        |
| Blending         | CV confident, push CVC                           |
| CVC reading      | Emerging; pair every word with picture for vocab |
| Sight words      | Not tested; introduce gradually                  |

### Open questions (for later)

- Should "bridge to 10" problems come as a supplementary flashcard deck or wait for the app?
- TTS polish — Web Speech API for v1, ElevenLabs for v2?
- Speech recognition for phonics practice — v3 feature, skip for now
- Multi-user support (siblings) — skip v1, easy to add later
- Deployment: Vercel with shared-secret URL, or just run locally for the family?
