# Screen 4 — Word Song (CVC short-a)

**Audience:** Devon (impl ticket TBD), Kevin (review), Jessica (QA), Thomas (taste).
**Author:** Marian Tutor design persona.
**Status:** Spec — draft. Implementation blocked on this PR merging.
**Surface:** iPad portrait PWA, home-screen installed.
**Scope:** First standalone literacy surface. Eight-problem CVC-short-a session. Picture-discrimination input model. Stardust HUD + streak indicator + audio Path A integration. Pairs structurally with `screen-3-math.md`; the two screens form one mixed Math+Word-Song session in the v1 sequencer.

This file is the canonical spec for the Word Song screen. Session-1's Screen 4 (`design/session-1.md` lines 376–522) covers the listen-only first-run moment with the word `dog`; from Session 2 onward, this file owns the surface and replaces the listen-only model with an active discrimination task. The two specs are intentionally different shapes — see §"Why this differs from Session-1's Word Song" for the rationale.

> **Phonics-sequence dependency:** Dave's research memo on Marian's phonics ladder is expected at `design/research/phonics-sequence-marian.md`. At time of authoring, that file has not landed. This spec ships with the **diagnostic-grounded default** (short-a CVC for v1, with the o → u → e → i progression locked in `CLAUDE.md`'s diagnostic summary). Open Questions item #1 flags the slot Dave's memo will fill when it arrives.

---

## Goal

Marian completes eight short-a CVC discrimination problems in a single session, banking stardust per correct answer, without ever feeling judged on a wrong answer. The session reinforces the CVC reading pattern she has *just begun* to decode (per April 2026 diagnostic — she read `cat` and `dog` cold) by pairing every word with a picture, so the symbolic letters and the concrete object keep meeting on the same screen, every problem.

**This is not** a phonics drill, a speed exercise, an assessment, or a vocabulary test. Vocabulary is Marian's actual bottleneck per the diagnostic ("decoded 'sun' but didn't know the word"); this screen lets her *grow* vocabulary through repeated picture-word-audio pairings, while *practising* decoding as a side effect. Eight gentle moments where she gets to read a word and recognise its meaning.

---

## User state entering this screen

Two paths in (mirrors the Math screen):

1. **Mixed-session path (v1 default)** — she just finished a Math problem. The orchestrator's session sequencer hands off Math → Word Song mid-session (interleaved problems, see §Out of scope on the interleaving cadence). Melody's `layoutId="melody"` shared element re-anchors to the Word Song screen's upper-left. Background cross-fades garden → song-scene over 500ms. Audio context already gesture-unlocked (Howler is hot).
2. **Standalone Word Song entry path (Session 2+ literacy-only run)** — she launched from home-screen, splash auto-advanced, no Greet, no preceding Math. The first tap into Word Song *is* the audio-unlock gesture. `useAudioUnlockGate` handles this — see §Implementation pointers.

Both paths land on the same screen. Melody is in upper-left, idle/breathing. Problem #1 is already mounted but TTS hasn't fired yet (gated on unlock).

---

## Why this differs from Session-1's Word Song

Session-1's `dog` screen is a **listen-only** exposure moment — picture + letters + sound-out, no wrong answer possible, "Got it" tap to advance. That shape was right for first-run because Marian had never met Melody and the goal was a low-stakes "this is what reading sounds like" moment.

For an 8-problem standalone session, listen-only would not earn the eight visits. Marian needs an **active discrimination** to:

- Bank wins (no input = no "I did it" feeling).
- Justify stardust + streak (rewards require a choice).
- Match the Math screen's shell so the cross-screen mental model is consistent (both screens: read/listen → tap one of three chips → reward or gentle retry).
- Surface comprehension errors *visibly* so Melody's hint can repair them (vocabulary is the bottleneck per diagnostic; without an input we can't tell when Marian doesn't know what `cat` means).

The discrimination is **picture-side**, not letter-side: Melody says the word, Marian taps the matching picture. Rationale in §Input model.

---

## Input model

**Locked: Marian taps the picture chip that matches the word Melody reads.**

Each problem displays:

- **One word card** (the CVC word in 96pt letters, with its picture above it — tightly coupled).
- **Three picture chips** at the bottom thumb zone — one matches the word card, two are distractors (see §Distractor policy).

Melody reads the word aloud once on screen entry; the word card and its picture are present from t=0. Marian taps a picture chip.

### Why picture-side, not letter-side

Three input shapes were on the table:

| Input shape | Pedagogical target | Why rejected / accepted |
| --- | --- | --- |
| **Tap matching picture** (locked) | Word comprehension + decoding-meets-meaning | Marian's bottleneck is vocab, not decoding. Picture discrimination *is* the comprehension check. Decoding gets practised passively (the word card is right there). |
| Tap matching letter (initial vowel) | Vowel discrimination | Rejected for v1. Short-a is already mastered per diagnostic — would be a softball. Re-evaluate when the screen pivots to short-o (the first new vowel). Flagged in Open Questions #2. |
| Tap matching letter (any letter from 3 options) | Letter recognition | Rejected outright. She has the alphabet mastered (b/d confusion aside). Wastes the surface. |

**The locked choice respects Marian's diagnostic.** From `project_diagnostic_results.md` (April 2026): *"CVC decoding emerging — read 'cat' and 'dog' cold. Vocabulary is the bottleneck, not decoding — decoded 'sun' but didn't know the word."* Picture discrimination is the surface that drills the actual gap.

### Why not "tap the word that matches the picture"

The inverse layout — show one picture, three word cards as chips — was considered and rejected for v1. Reading three CVC words to discriminate is too high a load when she's still building automaticity on a single CVC word. It also forces her to decode the *distractor* words to confirm they're wrong, which means we'd need distractor words she can also decode — a constraint that bottlenecks the curriculum. Picture-side input lets the distractors be pictures of *anything in her vocabulary*, not just CVC short-a vocabulary.

Flagged for v3+ as an "advanced" mode once CVC reading is automatic.

### Word card composition

Each word card is composed of three elements stacked vertically:

```
   [ picture, ~180pt square ]
              ↓
       c   a   t          <-- letters in 96pt, ~32pt apart
              ↑
     [optional: tap-to-hear speaker icon, 56pt]
```

The picture sits **above** the letters (not below) so Marian's eye lands on the picture first — meaning leads, decoding follows. This mirrors how children's picture books are typically composed and matches the diagnostic insight that her path into the word goes meaning → letters, not letters → meaning. Confirmed against `mobile-app-design` skill guidance on visual-hierarchy for early readers.

**Letters are tappable.** Tapping a letter on the word card plays its **pre-recorded phoneme** (per the existing phoneme audio pipeline established in Session-1 Screen 4, lines 503–504 of `session-1.md`). No "right or wrong" judgment on letter taps — purely an exploration affordance. Letter taps are independent of the answer-chip task.

**Speaker icon on the word card is optional in the v1 build.** Tapping it replays Melody's word reading. If shipping in v1 adds significant scope, defer to v2 — it's a "nice to have", not load-bearing. Default for spec: ship it. Flagged as a potential trim in §Implementation pointers if Devon scopes it out.

---

## Visual layout

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 5     ●●●○○○○○         ✦ 3            |  <- HUD strip, 56pt tall (same as Math)
|  stardust   problem dots   streak        |
|                                          |
|  ~ pastel song-scene background ~        |
|                                          |
|  ( Melody     +-------------------+      |
|    upper-     | "Tap the cat."    |      |  <- ribbon, 88% width
|    left,      |  (caption ribbon) |      |
|    ~26vh )    +-------------------+      |
|                                          |
|         [ word picture, 180pt ]          |  <- picture above letters
|                                          |
|              c   a   t                   |  <- 96pt letters
|                                          |
|              ◔ tap-to-hear               |  <- optional speaker, 56pt
|                                          |
|                                          |
|  +----------+ +----------+ +----------+  |
|  |   🐱    | |   🐶    | |   🦊    |  |  <- 3 picture chips, 96pt sq
|  +----------+ +----------+ +----------+  |     thumb-zone bottom 22%
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

**Vertical rhythm (top → bottom, portrait iPad ~1024pt tall):**

| Band              | Height    | Contents                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------ |
| Safe-area top     | env inset | —                                                                        |
| HUD strip         | 56pt      | Stardust counter (left), problem dots (center), streak indicator (right) |
| Melody + ribbon   | ~26vh     | Melody upper-left at ~26vh tall (slightly smaller than Math's 30vh — see below); ribbon to her right |
| Word card         | ~28vh     | Picture (180pt) + letters (96pt) + optional speaker (56pt)               |
| Spacer            | ~6vh      | Breathing room                                                           |
| Picture chips row | ~16vh     | 3 chips, 96×96pt, 24pt gaps                                              |
| Safe-area bottom  | env inset | —                                                                        |

**Why Melody is 26vh here, not Math's 30vh:** the word card is the visual anchor of this screen and needs ~28vh to comfortably hold a 180pt picture *plus* 96pt letters *plus* the optional speaker. Math's 22vh problem-display band is tighter because numerals don't need a picture above them. Shaving 4vh off Melody's slot keeps the same total layout budget. She's still clearly present in upper-left, just a touch smaller. **Layout shift between Math and Word Song is handled by `layoutId="melody"`** — Framer Motion will spring her between sizes/positions automatically.

**Picture chips are 96×96pt** (vs Math's 88×88pt circular chips). Square, not circular, to give the picture inside more usable area. 24pt gaps between chips (Math uses 32pt) — tighter, but still well above the 16pt minimum from `mobile-app-design`'s touch-target spacing rule. The narrower gap is necessary to fit three 96pt squares plus 2×24pt gaps plus side margins inside an iPad-portrait viewport (~744pt usable wide). Verified math: 3×96 + 2×24 = 336pt content width, leaving ~204pt total side margin (~102pt each), comfortable.

**Thumb zone:** picture chips sit in the bottom ~22% of the viewport (above safe-area inset). Same thumb-reach analysis as Math — Marian holds the iPad in lap or props it; chip row is reachable without stretching. Per CLAUDE.md global convention all primary touch targets stay in the bottom 60%; chips are well within.

**HUD strip:** **identical to Math's HUD strip** — same stardust counter (left), problem dots (center, 8 dots for 8 problems), streak indicator (right, hidden until streak ≥ 2). Copy `MathHud.tsx` wholesale into a shared `SessionHud.tsx` if it doesn't exist yet, or import it directly. The HUD's concept of "session" is shared between Math and Word Song — see §Stardust treatment for the cross-screen accumulation rule.

---

## Distractor policy (CVC short-a, picture-discrimination)

**Locked rule (subject to Dave-memo confirmation when it lands):**

> **Adaptive 2-tier semantic ramp.** Problems 1–3: clearly-different distractors (different category, different vowel sound, easy reject). Problems 4–8: closer distractors (same category OR same vowel sound, harder reject). Always 3 picture chips total: 1 correct + 2 distractors. Correct chip position randomised per problem.

**Why a tiered ramp:** the same Mammarella-2023 + Siegler + McNeil arguments that justify Math's gentle-ramp tier (per `screen-3-math.md` §Distractor policy) apply to Word Song. Three banked wins before the harder discriminations arrive lets Marian calibrate to the screen's interaction model and protects the session-onset anxiety window. The Math memo's evidence base translates directly — picture discrimination is structurally analogous to numeric discrimination as a 3-chip choose-the-right task.

### Tier definitions for Word Song

**Gentle tier (problems 1–3):**

- Distractors are objects from clearly different categories and clearly different sounds.
- For target word `cat`: distractors might be `bus` (vehicle, /b/) and `sun` (celestial, /s/). Two of the three pictures are obviously not animals; the cat is the only animal, the only `c-` start, the only short-a vowel. Easy reject.
- Distractors should be from Marian's **known vocabulary** (per diagnostic — she recognised `cat`, `dog`, `sun` cold; nouns from her likely Tagalog-mediated picture-book vocabulary). The point of gentle tier is not to test obscure vocabulary; it's to give her three banked wins.

**Trap tier (problems 4–8):**

- Distractors share *one* meaningful axis with the correct word: same category, OR same starting consonant, OR same vowel sound, OR same ending consonant.
- For target word `cat`: distractors might be `bat` (rhymes — same vowel + same ending) and `cap` (alliteration + same vowel — different ending). Marian must read the *whole* word to disambiguate, not just the picture or the first letter.
- This is the pedagogically valuable surface — it's where decoding precision matters and where the picture-letter pairing earns its keep.

**Constraint set the rule must satisfy** (lock these regardless of which rule wins):

1. Distractor pictures must be from Marian's **established vocabulary** (i.e. words she can recognise as objects). The picture pool is the vocabulary her parent has confirmed she knows from prior reading exposure (Tagalog and English picture books). Owner: Thomas + Matt curate the picture library; flag in Open Questions #4.
2. All three picture chips must be **visually distinct enough at 96pt** that the picture is the discrimination, not the chip layout. No two chips with similar silhouettes (e.g. `cat` vs `dog` at small size — both four-legged silhouettes). Owner: Kyle reviews chip-trio renders against a checklist before each problem ships. **Concrete check:** in any problem's chip trio, no two SVG silhouettes may share a primary mass-and-pose silhouette as visually rendered at 96pt. If two chips both read as "small four-legged animal in side profile" the problem fails the silhouette check and one picture is replaced. Verifiable by Kyle eyeballing the trio at iPad-portrait scale; no automated test in v1.
3. Distractors must be **distinct from each other** (no `cat` with two distractor copies of `bat`).
4. The correct word's CVC structure must match the session's vowel target (v1 = short-a). Distractor *words* don't have to be CVC short-a; what matters is their *picture* is recognisable.
5. **Picture style is consistent** — same illustrated style, same line weight, same palette. A real photograph of a cat next to a stylised illustration of a bat would foreground the style mismatch as the discrimination cue, not the meaning. Owner: Thomas/Matt for asset commissioning.

**Implementation note:** in `wordDistractors.ts`, `pickTier(problemIndex)` mirrors the Math screen's `pickTier`:

```typescript
export function pickTier(problemIndex: number): DistractorTier {
  return problemIndex <= 3 ? 'gentle' : 'trap'
}
```

The cutoff is locked at 3, parallel to Math. Do not parameterise.

**Candidate rules considered and rejected:**

| Rule                             | Why rejected                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Always trap tier                 | Punishing on problem 1; same anxiety-window argument as Math.                                                        |
| Random pool of any 3 pictures    | Pedagogically random — wastes the "hard discrimination" surface on accidentally-easy problems.                       |
| Letter-overlap distractors only  | Surface-level — doesn't pressure-test comprehension at all. She could pattern-match on the first letter and skip the meaning. |
| Visual-similarity distractors    | Tests *visual recognition*, not reading. Wastes the screen on a non-pedagogical task.                                |

---

## Stardust treatment

**v1 = simple counter, accumulating across both Math and Word Song surfaces.** Same key, same schema, same animation, same anti-dark-pattern guardrails as the Math spec.

### Cross-screen accumulation (locked)

Stardust is **shared between Math and Word Song within a single session and across sessions**. The v1 sequencer interleaves problems from both trees into one mixed ~15-min flow (see `CLAUDE.md` §Architecture: *"Sessions mix both trees in one ~15-min flow"*). Marian sees one stardust counter all session, ticking up per correct answer regardless of whether the problem is math or literacy.

**localStorage key: `marian-tutor.stardust.v1`** — same key as Math. Same schema (`{ total, lastUpdatedAt, schemaVersion: 1 }`). Same in-memory fallback for private-browsing iOS.

**Why shared, not separate trees:** two counters would imply two leaderboards in Marian's head — *"am I better at math or reading?"* — and that's exactly the comparative framing CLAUDE.md's anti-dark-pattern audit refuses. One number, one Melody, one session. The trees are pedagogically distinct (different drill content, different mastery ladders) but the reward layer is unified. If we ever add a parental-dashboard surface, it can break the count out by tree internally; the kid-facing UI stays unified.

### Award rules (mirror Math)

- **+1 stardust per correct answer**, awarded on the *first* tap (no stardust for retry-and-eventually-correct — that's a hint outcome, not a clean win).
- **+1 bonus stardust per streak threshold:** at streak 3, streak 5, and streak 8. **Streak counts across Math + Word Song problems within the same session** (see §Streak treatment).
- **No stardust for wrong answers, partial credit, or "try again" recoveries.**

A clean 8-for-8 Word Song run = 8 + 3 = **11 stardust** (same ceiling as Math). A clean mixed 16-problem session (8 Math + 8 Word Song, interleaved) = 16 + (bonuses at 3/5/8) = **19 stardust** if streaks fire on the unified count. The interleaving cadence and the unified-vs-per-tree streak threshold values are out of scope for this spec — flagged in Open Questions #6 and tracked at the orchestrator/sequencer level.

### Animation pattern (per +1 stardust)

**Identical to Math.** Burst from chip → float-to-counter grain → counter pop. Same particle component, same timings, same SFX (`sfx-sparkle.mp3` + `sfx-plink.mp3` on counter arrival). Reuse the Math screen's `StardustBurst` component and pass it the chip's bounding rect — no new component authored for Word Song.

**Streak-bonus second grain:** same as Math (200ms after first grain, gentle additional chime via `sfx-sparkle.mp3` reuse).

### Persistence

Same as Math. Read on Word Song screen mount (or session start if Word Song is the entry surface), write after every increment AND on session end. Atomic synchronous setItem calls. `schemaVersion: 1`.

### Display location

Top-left of the HUD strip. Identical visual treatment to Math (24pt sparkle glyph + 32pt numeral, gold flash on increment). The HUD is shared between Math and Word Song — see §Implementation pointers for the component-reuse guidance.

---

## Streak treatment

**Locked: streak counts unbroken-correct-on-first-tap across Math + Word Song within a single session.**

- Same threshold values as Math: bonuses at 3, 5, 8 (default until Thomas weighs in on Open Question #5).
- Same hidden-until-≥2 rule.
- Same fade-out-on-break behaviour (400ms opacity fade, no SFX, no TTS, no copy).
- Same per-session reset.

**Why unified across trees:** same argument as the unified stardust counter. Two streaks would imply Marian's juggling two parallel "don't break my streak!" pressure mechanics, which compounds the dark-pattern risk we're explicitly avoiding. One streak, one warmth signal, breaks quietly.

**Streak indicator visual:** identical to Math — `sparkle-particle.svg` at 32pt, gold pulse on threshold ticks. **Same locked decision against the flame asset** per Dave's PR #35 memo (cited at `screen-3-math.md` §Stardust treatment → "Streak indicator visual"). Do not substitute a flame.

---

## Wrong-answer policy

Per CLAUDE.md non-negotiable: **never a red X.** Mirror Math's wrong-answer policy almost line-for-line, with one literacy-specific adjustment for the hint state.

### State transitions on wrong tap

1. Tapped picture chip does a soft horizontal shake: `x: [0, -6, 6, -4, 4, 0]` over 400ms. **No colour change, no border ring, no overlay.** The chip stays at its normal fill.
2. Melody's expression swaps from `melody-idle.svg` → `melody-puzzled.svg`. Cross-fade through `AnimatePresence` (no `wait` mode, same as Greet/Math), 200ms.
3. SFX: `sfx-poof.mp3` plays. Soft, breathy, ~500ms. **NOT a buzzer.** (Same asset as Math's wrong-answer SFX. Blocked on Thomas per `assets-todo.md`; until it lands, `createSfx` warn-once and silent no-op.)
4. TTS re-prompt fires from the per-problem pre-rendered audio bundle. Line: **"Hmm... try again?"** (identical phrasing to Math — same word in Marian's vocabulary cap, same emotional register, same reuse-friendly bundle). Caption ribbon mirrors word-by-word.
5. After TTS completes, Melody returns to `melody-idle.svg` (cross-fade back, 200ms).
6. **All three chips remain tappable.** No correct-chip highlight, no glow, no outline. Marian must commit to a re-tap.

### Streak break

Identical to Math (`screen-3-math.md` §Wrong-answer policy → "Streak break"):

- Streak indicator gently fades to opacity 0 over 400ms.
- Internal `streak` state resets to 0.
- No dedicated SFX, no TTS, no copy.
- Streak indicator never reappears retroactively.

The unified streak (across Math + Word Song) means a wrong tap on a Word Song problem can break a streak built up across both trees. That's intentional — the streak's promise is *"clean wins, both kinds, in a row"*. Breaking it on either side is the same pat-on-the-back leaving quietly.

### After 2 wrong attempts on the same problem — hint state

**Locked at 2 wrongs (not 1) per Dave's research memo on Math** (cited at `screen-3-math.md` §Wrong-answer policy). Hattie & Timperley (2007) feedback-timing argument applies identically here: the chance to self-correct on a CVC discrimination is the high-value moment, and a hint after 1 wrong short-circuits that learning. Do not lower this threshold without a fresh Dave consult.

**Hint choreography for Word Song (this is the literacy-specific adjustment):**

The hint plays **the word card's letters in sequence**, each letter highlighting and playing its pre-recorded phoneme, then the picture pulses and Melody says the word in full. This is the same pattern as Session-1 Screen 4's lines 3–4 sound-out, repurposed as a hint instead of an intro:

```
t=0ms      : Melody's puzzled-tilt holds; "Let's look." TTS plays
t=600ms    : letter `c` scales 1→1.2→1, color shifts ink→rose, plays /k/
t=1200ms   : letter `a` does the same, plays /a/
t=1800ms   : letter `t` does the same, plays /t/
t=2400ms   : all three letters scale 1→1.15→1 simultaneously; picture bobs
t=2400ms   : Melody says "Cat." (TTS, full word)
t=3300ms   : Melody returns to idle; chips remain tappable
```

**Why a sound-out hint, not "show me the right chip" hint:** the wrong-answer state already told Marian "that's not it"; the hint should give her the tool to find the right answer herself, not hand it to her. Sounding out the word card matches her learning ladder (CVC blending, picture-word pairing) and reuses pedagogy that's already working for her per Session-1's design.

**Word-count check on hint TTS:** `let's, look, cat` (the word changes per problem) — 3 words plus the target word. Within the 200-word cap. Reuse `let's` and `look` from Math's hint copy for shared bundle.

### After 3 wrong attempts (hint didn't land)

**Guided completion — picture-side:**

- Correct picture chip shimmers (`box-shadow` glow at `--my-rose`, 800ms loop).
- All other chips dim to opacity 0.6.
- Correct chip is the only tappable.
- Melody says **"This one is cat."** (or the actual correct word). Word-count: `this, one, is` plus target. All within cap, reuses Math's `giveAnswer` phrasing for bundle parity.
- Tapping correct chip: standard happy-path animation but **no stardust awarded, no streak increment** (this is a guided completion, not an earned win — same rule as Math).

**No wrong-answer counter is displayed anywhere.** Internal state machine tracks attempts to gate hint/guided flows; nothing surfaces.

---

## Audio integration contract (Path A)

Every utterance Word Song needs at session-start, listed so the Vercel function pre-renders them via `api/_tts.ts` and ships them inline in the session JSON. Voice config is canonical from `design/audio-architecture.md` §"Voice configuration" — `en-US-AnaNeural`, rate `-10%`, default pitch, MP3 mono 24kHz ~48kbps. Do not deviate per-utterance.

### Per-problem utterances (8 problems × 4 lines = 32 audio assets per session)

| `id` template          | Sample text (problem word `cat`)               | When played                            | SSML rate | SSML pitch | Notes                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------- | -------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `word.p{N}.read`       | "Tap the cat."                                 | Screen entry / problem reveal complete | `-10%`    | default    | The instruction. `{N}` is 1–8. Word changes per problem.                                                                                                                       |
| `word.p{N}.correct`    | "Yes! Cat."                                    | Correct chip tapped                    | `-10%`    | default    | Word is the actual target. Generated per-problem; do not template at runtime.                                                                                                  |
| `word.p{N}.reprompt`   | "Hmm... try again?"                            | Wrong chip tapped (1st or 2nd attempt) | `-10%`    | default    | Same text every problem. Render per-problem so each problem's bundle is self-contained — but the Vercel function may dedupe identical strings across the bundle if it's safe. |
| `word.p{N}.hint`       | "Let's look. Cat."                             | After 2 wrong attempts on this problem | `-12%`    | default    | Slightly slower for the hint. Generated with the actual target word. The phoneme files (see §Phoneme audio) play *between* this utterance's words at the timestamps in §Wrong-answer policy hint choreography. |

### Optional — only if 3rd-strike guided completion fires

| `id` template            | Sample text         | When played            | SSML rate | SSML pitch |
| ------------------------ | ------------------- | ---------------------- | --------- | ---------- |
| `word.p{N}.giveAnswer`   | "This one is cat."  | After 3 wrong attempts | `-10%`    | default    |

### Phoneme audio (NOT pre-rendered via TTS — these are static MP3s on disk, played via Howler)

Word Song's hint state needs phoneme audio for each letter in the target word. The phoneme audio pipeline is established in Session-1 Screen 4 (see `session-1.md` lines 503–504) — pre-recorded MP3s at `public/assets/audio/phonemes/`, ~4 KB each, ~250–400ms.

**v1 short-a phoneme inventory (the letters that can appear in short-a CVC words):**

| Phoneme file              | Letter | Used in CVC short-a words           | Status                                                                              |
| ------------------------- | ------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `phoneme-a-short.mp3`     | a      | All short-a words (`cat`, `bat`, …) | Not yet authored — flag for asset pipeline                                          |
| `phoneme-b.mp3`           | b      | `bat`, `bag`, `bad`                 | Not yet authored                                                                    |
| `phoneme-c.mp3` (`/k/`)   | c      | `cat`, `cap`, `can`                 | Not yet authored                                                                    |
| `phoneme-d.mp3`           | d      | `dad`                               | Already on Session-1 list                                                           |
| `phoneme-f.mp3`           | f      | `fan`, `fat`                        | Not yet authored                                                                    |
| `phoneme-g.mp3`           | g      | `bag`, `tag`                        | Already on Session-1 list                                                           |
| `phoneme-h.mp3`           | h      | `hat`, `had`                        | Not yet authored                                                                    |
| `phoneme-j.mp3`           | j      | `jam`                               | Not yet authored                                                                    |
| `phoneme-m.mp3`           | m      | `mat`, `man`                        | Not yet authored                                                                    |
| `phoneme-n.mp3`           | n      | `can`, `fan`, `man`                 | Not yet authored                                                                    |
| `phoneme-p.mp3`           | p      | `cap`, `tap`, `nap`                 | Not yet authored                                                                    |
| `phoneme-r.mp3`           | r      | `ram`, `rat`                        | Not yet authored                                                                    |
| `phoneme-s.mp3`           | s      | `sat`, `sad`                        | Not yet authored                                                                    |
| `phoneme-t.mp3`           | t      | `cat`, `bat`, `hat`, `tap`          | Not yet authored                                                                    |

**Total: ~14 new phoneme files to author for v1 short-a coverage** (~56 KB total). Voice should match Melody's TTS register (warm, female, mid-pitch, identical to `en-US-AnaNeural` voice). Sourcing approach is open (voice actor session vs existing phonics audio library); flag to Matt for the asset pipeline call. **Authored once, reused across all literacy sessions** — the per-letter phoneme is invariant.

### SFX (NOT pre-rendered via TTS — static MP3s on disk, played via Howler)

| `id`                 | File                      | When played                           | Status                                              |
| -------------------- | ------------------------- | ------------------------------------- | --------------------------------------------------- |
| `sfx.chime`          | `sfx-chime-soft.mp3`      | Reused — already in Greet             | Already on assets-todo                              |
| `sfx.sparkle`        | `sfx-sparkle.mp3`         | Correct answer celebration            | Reuse from Math (already on assets-todo)            |
| `sfx.poof`           | `sfx-poof.mp3`            | Wrong answer puzzled-tilt response    | Reuse from Math (already on assets-todo)            |
| `sfx.stardust-grain` | `sfx-plink.mp3`           | Stardust grain arrives at HUD counter | Reuse from Session-5 jar                            |
| `sfx.streak-bonus`   | `sfx-sparkle.mp3` (reuse) | Streak threshold bonus stardust pop   | Reuse — same call as Math                           |

**Word Song introduces no new SFX in v1.** Every SFX is shared with Math/Greet/Session-end.

### Total per-session audio budget

- TTS utterances: 4 lines × 8 problems = 32, +8 if always pre-render `giveAnswer` (recommend yes). **40 utterances ≈ 600 KB inline base64.**
- Phoneme files: ~14 cached on first PWA install (one-time ~56 KB).
- SFX: 0 new (all shared with other surfaces).

**Per-session JSON payload from Word Song = ~600 KB inline base64**, identical envelope size to Math. A mixed Math + Word Song session = ~1.2 MB session JSON. Within the 4.5 MB Vercel response cap.

### Audio dispatch sequence on chip tap (correct)

```
t=0ms     : chip tap registered
t=0ms     : sessionAudio.playUtterance('word.p{N}.correct')  ← inside tap handler synchronously
t=0ms     : sfx.sparkle.play()  ← also synchronous, gesture-aligned
t=0-400ms : chip celebration animation (scale + sparkle burst)
t=200ms   : stardust grain peels off, begins float-to-counter
t=900ms   : grain arrives at counter, sfx.stardust-grain.play(), counter pops, total++
t=900ms   : if streak threshold hit (3/5/8): sfx.streak-bonus.play(), 2nd grain spawns
t=1200ms  : Melody returns to idle
t=1200ms  : auto-advance to next problem (or session-end if N=8 and Word Song is the last surface in the session)
```

### Audio dispatch sequence on chip tap (wrong)

```
t=0ms        : chip tap registered
t=0ms        : sessionAudio.playUtterance('word.p{N}.reprompt')  ← inside tap handler synchronously
t=0ms        : sfx.poof.play()  ← also synchronous
t=0-400ms    : chip shake animation
t=0-200ms    : Melody cross-fade idle → puzzled
t=400-1500ms : "Hmm... try again?" plays; caption ticks word-by-word
t=1500ms     : caption full; Melody cross-fade puzzled → idle
                (NB: if attempt count is now 2, schedule the hint utterance to play
                 after a 600ms beat — see §Wrong-answer policy hint choreography)
```

### Audio dispatch sequence on letter tap (word card)

```
t=0ms     : letter tap registered (letter `c`, `a`, or `t` for target `cat`)
t=0ms     : phonemeAudio.play('phoneme-{letter}.mp3')  ← Howler call, synchronous
t=0-400ms : tapped letter scales 1→1.2→1, color shifts ink→rose then back
t=400ms   : letter returns to idle; no Melody reaction; no stardust
```

Letter taps are independent of the answer-chip task — no streak break, no attempt count, no Melody reaction. Pure exploration affordance.

### Audio dispatch sequence on speaker icon tap (word card, optional v1)

```
t=0ms : speaker tap registered
t=0ms : sessionAudio.playUtterance('word.p{N}.read')  ← replays the same line as screen-entry
        (no chip animation, no Melody reaction beyond ambient breathing)
```

**Caption rendering:** identical pattern to Math/Greet — render `Utterance.text` via Path A's `onWordTick` callback. Same word-by-word reveal, same `<m.span>` per-word with `data-revealed` toggle, same `text-[2.4rem]` legibility floor.

---

## Motion

**Reuses Math's motion vocabulary wherever possible.** New choreography is documented inline; everything else is "same as Math" by reference.

### Screen entrance (from Math handoff or splash)

- Background cross-fades garden → song-scene over 500ms (same crossfade timing as Greet → Math).
- Melody `layoutId="melody"` springs from previous size/position to upper-left at ~26vh, spring `{ stiffness: 180, damping: 22 }`.
- HUD strip carries across (no fade — same component instance, same state). If entering from splash (no prior HUD), HUD fades in over 300ms delayed 200ms.

### Problem reveal stagger

- Word card components stagger in: picture first, then letters, then optional speaker icon.
- Picture: `initial={{ scale: 0, opacity: 0 }}`, spring `{ stiffness: 260, damping: 16 }` — slight bounce on land. Same spring as Session-1 Screen 4's picture.
- Letters: stagger in 150ms apart, each `initial={{ scale: 0, opacity: 0 }}`, spring `{ stiffness: 300, damping: 18 }`.
- Speaker icon: fades in last (`opacity: 0 → 1` over 200ms, no scale).
- Picture chips: appear together, 300ms after word card stagger completes. Spring in from `y: 40, opacity: 0`.

Total reveal ~1.4s before Melody's `word.p{N}.read` line plays.

### Chip interactions

- **whileTap:** `scale: 0.92` (same as Math).
- **No whileHover** on iPad.
- **Correct chip celebration:** scale to 1.15, fill flash with `--sparkle` overlay (50% alpha), back to 1. 400ms total. Sparkle particle burst from chip centre, 6 particles, spring `{ stiffness: 120, damping: 18 }`, fade over 600ms — **identical to Math's StardustBurst pattern.**
- **Stardust grain float:** identical to Math.
- **Wrong chip shake:** `x: [0, -6, 6, -4, 4, 0]` over 400ms, no colour change.

### Melody pose swaps

- Idle ↔ puzzled (wrong) ↔ happy (correct/cheering): `AnimatePresence` cross-fade, 200ms, no `wait` mode. Identical to Math.

### Letter tap feedback

- Tapped letter: `scale: [1, 1.2, 1]` over 400ms, color `--ink → --my-rose → --ink`.
- Other letters stay calm (no sympathetic animation).

### Hint state choreography

Per timeline in §Wrong-answer policy. Each letter highlight is a `scale: [1, 1.2, 1]` + colour shift, triggered by the corresponding phoneme audio file's Howler `onPlay` callback (so the visual is tightly coupled to the audio). The blend moment (all letters scaling simultaneously) is triggered after the third phoneme finishes; the picture bob fires at the same beat.

### Reduced-motion branch

- Picture: fades in without scale.
- Letters: appear instantly (no stagger).
- Chip celebration: opacity flash instead of scale + particle burst.
- Stardust grain: appears at counter directly (no flight).
- Melody pose swap: instant (no cross-fade).
- HUD pop: opacity-only.
- Hint state letter highlight: colour-only (no scale).
- Picture bob on hint blend: skipped.

Same `usePrefersReducedMotion` hook as Math (per Math spec §Implementation pointers).

---

## States

### Idle (per-problem)

Word card displayed (picture + letters + optional speaker), 3 picture chips waiting for tap, Melody idle/breathing in upper-left, caption ribbon showing the just-spoken read-aloud line ("Tap the cat." in full reveal), HUD strip steady.

### Happy path (correct first attempt)

Per the chip-tap-correct sequence in §Audio integration contract. After auto-advance:

- HUD: stardust +1 (animated), streak +1 (HUD streak indicator pops in if it was 0→1, or pops if already visible).
- Problem dot: current dot animates `filled-with-ring` → `filled-no-ring`; next dot animates `outlined` → `outlined-with-ring`.
- Cross-stagger: current problem's word card + chips fade out (200ms reverse stagger), next problem's same fades in (300ms forward stagger). Melody stays put (`layoutId="melody"`).

### Happy path (correct after 1 or 2 wrong attempts)

Same chip-tap-correct sequence — **with one difference: still award stardust** (1 wrong tap is within tolerance, the win is still earned). After 2 wrongs + correct: still award stardust. The stardust withhold ONLY applies after the 3rd-strike guided completion fires.

Streak: any wrong attempt on the current problem resets streak to 0 *at the moment of the wrong tap*. So even if she gets it right after 1 wrong, streak does not increment for this problem.

### Wrong path (1st or 2nd attempt)

Per §Wrong-answer policy. Streak break (if active) per §"Streak break" subsection. Ribbon caption updates to `"Hmm... try again?"`.

### Hint state (after 2 wrong)

Per §Wrong-answer policy → "Hint choreography for Word Song". Plays the `word.p{N}.hint` utterance with the letter-by-letter sound-out + blend choreography. After hint, return to Idle (chips tappable, no auto-advance, ribbon caption holds the hint text fully revealed).

### Guided completion (after 3 wrong)

Per §Wrong-answer policy → "After 3 wrong attempts". Plays `word.p{N}.giveAnswer`. Correct chip is the only tappable. Tap → standard happy-path visuals minus stardust + streak.

### Letter-tap state

Single letter on the word card pulses + plays its phoneme. No effect on attempt count, streak, or Melody. Independent exploration.

### Speaker-tap state (if shipped in v1)

Replays `word.p{N}.read`. Caption ribbon re-runs the word-by-word reveal. No effect on attempt count, streak, or chip state.

### Empty / first visit

This screen has no empty state per se — the session-start Claude call always returns 8 problems with their per-problem audio bundle. **If session JSON is malformed or missing utterances/phonemes** (Path A bug surface): Melody plays `melody-puzzled.svg` pose, no TTS, no auto-advance. Devon should log the error to console and the orchestrator surfaces a "something went wrong, try again later" recovery — NOT this spec's responsibility. Same fail-closed contract as Math.

### Transition in

- From Math (mixed-session): Melody `layoutId="melody"` springs from Math's upper-left to Word Song's upper-left (same anchor zone, slight size adjustment 30vh → 26vh). Background cross-fades garden → song-scene over 500ms. HUD persists in place — no fade.
- From splash (Word-Song-first standalone session): same Word Song screen mounts. Audio-unlock gate fires per §Implementation pointers; once unlocked, problem reveal stagger begins.

### Transition out (per problem)

- Reverse stagger (chips fade first, word card after, 200ms total).
- HUD streak/stardust pop animations finish before the next problem's elements start their forward stagger (sequencing: pop → 100ms beat → next reveal).

### Transition out (session end, problem 8 complete)

Out of scope of this spec — handled by ticket `86c9grnjd` ("what comes after problem 8?", currently scoped to Math but the contract should generalise). This screen's contract: emit an `onSessionComplete({ totalCorrect, totalStardust, finalStreak, surface: 'word-song' })` callback. Whoever owns Session-end consumes it.

**Note for Session-end maintainer:** the existing Session-end spec (`screen-5-session-end.md`) is Math-flavoured (says "Math problem 8") in its `User state entering this screen` section. When Word Song handoff lands, that section needs a generalising tweak — flag as a follow-up; not in scope of this spec to edit.

---

## Assets required

### Already in repo (no new authoring required)

| Asset                  | Used for                                            | Size        |
| ---------------------- | --------------------------------------------------- | ----------- |
| `melody-idle.svg`      | Melody idle/breathing in upper-left                 | 6 KB        |
| `melody-happy.svg`     | Correct-answer ear-wiggle pose                      | 6 KB        |
| `melody-puzzled.svg`   | Wrong-answer puzzled-tilt pose                      | 6 KB        |
| `sparkle-particle.svg` | Celebration burst + stardust grain + HUD streak     | <1 KB       |
| `star-filled.svg`      | HUD stardust counter glyph                          | <2 KB       |
| `sfx-chime-soft.mp3`   | Correct-answer base chime                           | ~8 KB       |
| `sfx-sparkle.mp3`      | Correct-answer celebration                          | ~6 KB       |
| `sfx-poof.mp3`         | Wrong-answer gentle response                        | ~8 KB       |
| `sfx-plink.mp3`        | Stardust grain arrival                              | ~5 KB       |

(All assets in this table are subject to the `assets-todo.md` block on Thomas — same status as the equivalent rows in Math's spec. Word Song does not change the blocking surface, it just consumes what Math/Greet already requested.)

### Required, not yet authored — Word Song-specific (NEW asset list)

| Asset                          | Used for                                                                | Target size | Notes                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-song.svg`                  | Word Song screen background                                             | <20 KB      | Soft wash with 3–4 stylized music notes floating, pastel. Already on Session-1 Screen 4 list.                                                                                                                  |
| `icon-speaker.svg`             | Tap-to-hear speaker on word card                                        | <3 KB       | Already on Session-1 Screen 4 list. Optional in v1; Devon may scope out.                                                                                                                                       |
| **CVC short-a picture pack**   | Picture chips + word card pictures                                      | <30 KB each | **NEW**, ~12–16 illustrations needed for v1 (target words + distractors). See §Open Questions #4 for sourcing/curation. Style-consistent with Melody — illustrated, not photographic, line-coherent palette.   |
| `phoneme-*.mp3` (~14 files)    | Letter-tap phoneme playback + hint state sound-out                      | ~4 KB each  | Listed in §Audio integration contract → "Phoneme audio". Voice-matched to `en-US-AnaNeural`. Authored once, reused for all literacy sessions. Sourcing call lives with Matt — flag for asset pipeline.         |

### TTS audio

Generated server-side at session-start. ~40 inline base64 MP3s per session, ~600 KB. No static authored assets needed.

### Asset reuse summary

- **Melody expressions:** all reused, no new poses needed. (`melody-cheering.svg` is reserved for Session-end and not used on this screen.)
- **HUD glyphs:** all reused from Math.
- **SFX:** all reused. **Word Song authors zero new SFX in v1.**
- **Background:** new (`bg-song.svg`, already on shared todo).
- **Picture pack:** new and substantial — the only material new asset commitment for Word Song.
- **Phoneme files:** new but invariant across sessions; one-time author cost.

---

## Acceptance criteria (Jessica)

### Functional

- [ ] Session 1 entry (mixed): Word Song screen renders 1 problem per Session-1 spec — distinct from this spec's 8-problem flow, and that's fine
- [ ] Session 2+ standalone entry: Word Song screen renders 8 problems sequentially, all from the session JSON
- [ ] Each problem displays: word card with picture (180pt) + letters (96pt, ~32pt apart) + optional speaker icon (56pt); 3 picture chips at 96×96pt with 24pt gaps
- [ ] Distractor rule: problems 1–3 use gentle-tier distractors; problems 4–8 use trap-tier distractors (per `wordDistractors.ts`)
- [ ] Correct chip position randomised per problem
- [ ] Distractors satisfy the constraint set (Marian-known vocabulary, visually distinct silhouettes at 96pt, distinct from each other, picture style consistent across the trio)
- [ ] HUD: stardust counter visible, problem dots visible, streak indicator hidden until streak ≥ 2 — same component as Math
- [ ] Stardust persists in localStorage at key `marian-tutor.stardust.v1` with `schemaVersion: 1` (shared with Math)
- [ ] Stardust +1 per correct first-attempt; no stardust on retry-eventually-correct or guided completion
- [ ] Streak bonus stardust at threshold 3, 5, 8 (clean run, unified across Math + Word Song within a session)
- [ ] Streak resets to 0 on any wrong tap; streak indicator fades out over 400ms when breaking from ≥2

### Audio

- [ ] Per-problem read-aloud (`word.p{N}.read`) plays on screen entry, after problem reveal stagger completes (~1.4s)
- [ ] Caption ribbon mirrors TTS word-by-word via Path A `onWordTick`
- [ ] Correct chip tap triggers `word.p{N}.correct` synchronously inside the tap handler
- [ ] Wrong chip tap triggers `word.p{N}.reprompt` synchronously inside the tap handler
- [ ] Letter tap on word card triggers the corresponding `phoneme-{letter}.mp3` synchronously inside the tap handler — **not Web Speech API output**
- [ ] Speaker icon tap (if shipped) replays `word.p{N}.read` synchronously
- [ ] After 2 wrong on same problem, hint TTS (`word.p{N}.hint`) plays with the letter-by-letter sound-out + blend choreography defined in §Wrong-answer policy
- [ ] During the hint sound-out, each letter highlight is triggered off the corresponding phoneme MP3's `play` event (visual tightly coupled to audio), not a TTS boundary
- [ ] After 3 wrong, guided-completion TTS (`word.p{N}.giveAnswer`) plays + correct chip is highlighted with a 800ms loop shimmer
- [ ] All TTS routed through `sessionAudio.playUtterance`, never `lib/tts.speak()`
- [ ] All phoneme audio routed through Howler, never Web Speech

### Anti-dark-pattern

- [ ] No red colour appears anywhere on a wrong answer
- [ ] No "X" glyph or "wrong" text appears anywhere
- [ ] No wrong-answer counter is displayed
- [ ] No streak-related copy appears in TTS or captions
- [ ] No "you lost your streak" SFX, animation, or TTS fires when streak breaks
- [ ] No share / leaderboard / social UI exists on this screen
- [ ] No "watch ad" or IAP affordance exists
- [ ] No timer / countdown / "session ends in X" UI exists
- [ ] No stardust spend / unlock prompt / inventory UI on this screen (v1 stardust is counter-only)
- [ ] No comparison to past performance ("you got 6 right last time!") anywhere

### Touch + accessibility

- [ ] All touch targets ≥ 60pt in smallest dimension; chips at 96pt; speaker icon at 56pt; letters tappable at 96pt with adequate spacing (per `mobile-app-design` skill checklist)
- [ ] Chip-to-chip spacing ≥ 16pt (we ship 24pt — verified above 16pt floor)
- [ ] Picture chips remain tappable during TTS playback (no UI lock on audio)
- [ ] Letter taps remain available during TTS playback (independent exploration affordance)
- [ ] With Reduce Motion: sparkle particles don't drift, chip shake collapses to opacity flash, Melody pose-swap is direct (no cross-fade), HUD pop is opacity-only, picture entrance is fade-only (no scale bounce), letter-tap highlight is colour-only (no scale), hint state letter highlights are colour-only

### iPad PWA

- [ ] On iPad Safari deployed PWA install: first audio call from Word Song (Session 2+ standalone first-tap) fires within 1.5s of tap; if not, audio-unlock gate surfaces ring per `useAudioUnlockGate` contract
- [ ] No audio dropouts mid-session (TTS or phoneme files)
- [ ] No empty caption ribbon if `Utterance.text` arrives with audio (matches Greet shouldShowRibbon guard)
- [ ] Picture chips render at native pixel density on iPad (vector or 2x raster); no blurring at 96pt chip size

### Visual integrity (silhouette check)

- [ ] For every shipped problem, no two picture chips in the trio share a primary silhouette at 96pt — Kyle-reviewed before each problem set ships (curation gate, not automated test)
- [ ] All picture chips in a problem render in the same illustration style (line weight, palette, level of stylization)

---

## Implementation pointers (for Devon)

### File layout

```
src/screens/WordSong/
├── WordSong.tsx              # Top-level screen component
├── WordCard.tsx              # Picture + letters + optional speaker (the problem display)
├── PictureChips.tsx          # 3-chip row, randomised correct position per problem
├── wordDistractors.ts        # Pure functions: pickDistractors(targetWord, problemIndex) → [pic1, pic2]
├── wordSequence.ts           # Per-problem state machine (mirrors mathSequence.ts)
└── phonemeAudio.ts           # Howler wrapper for phoneme MP3s, keyed by letter
```

Stardust + HUD logic should be extracted to a shared module if not already done by the Math impl:

```
src/screens/_shared/
├── SessionHud.tsx            # Stardust + problem dots + streak indicator (shared Math/Word Song)
├── stardust.ts               # localStorage R/W (shared Math/Word Song; key `marian-tutor.stardust.v1`)
└── streak.ts                 # Streak state + threshold helpers
```

If Math hasn't extracted these yet (per Math spec §Implementation pointers, Math has `MathHud.tsx` and `stardust.ts` local to the Math screen), Devon should refactor as part of this ticket. **The HUD must be the same component instance across Math and Word Song** to keep counter state continuous when the orchestrator sequences Math → Word Song mid-session. If refactoring is out of scope, flag back to Matt — the alternative is duplicating component code, which we should avoid.

### Reuse, do not re-derive

- **Audio unlock gate:** reuse `useAudioUnlockGate` from `src/lib/audio/useAudioUnlockGate.ts` for Session 2+ standalone Word Song entry. Watchdog window: default 1500ms.
- **Howler + linear-tick caption sync:** the `sessionAudio` module exposes `onPlay` + `onWordTick`. Build the caption renderer as a near-copy of `Greet.tsx`'s / `Math.tsx`'s `renderCaption` — same `<m.span>` per-word with `data-revealed` toggle, same `text-[2.4rem]` size for legibility floor.
- **Cross-fade Melody pose swap:** AnimatePresence with default (non-`wait`) mode. `key={pose}` on `<m.img>`, src `/assets/melody-${pose}.svg`. No mouth animation.
- **Spring presets:** import constants if Math exports them, else mirror values:
  - HUD pop: `{ type: 'spring', stiffness: 300, damping: 16 }`
  - Chip celebration: `{ type: 'spring', stiffness: 300, damping: 18 }`
  - Stardust grain flight: `{ type: 'spring', stiffness: 120, damping: 18 }`
  - Picture entrance: `{ type: 'spring', stiffness: 260, damping: 16 }` (slight bounce on land)
  - Letter entrance: `{ type: 'spring', stiffness: 300, damping: 18 }`
  - Melody layout transition: `{ type: 'spring', stiffness: 180, damping: 22 }`
- **`LazyMotion` + `m`:** same as everywhere else. 4.6 KB budget already paid; do not import bare `motion`.
- **`MotionConfig reducedMotion="user"`:** already global at app root. For per-screen reduced-motion branches, use the `usePrefersReducedMotion` hook (whether shared or per-screen, mirror Math's choice).

### Distractor rule lives in `src/screens/WordSong/wordDistractors.ts`

```typescript
export type DistractorTier = 'gentle' | 'trap'

export function pickTier(problemIndex: number): DistractorTier {
  // Problems 1-3: gentle ramp. Problems 4-8: trap. Cutoff locked at 3 — mirrors Math.
  return problemIndex <= 3 ? 'gentle' : 'trap'
}

export function pickDistractors(
  target: WordEntry,           // { word: string, picture: PictureRef, vowel: 'a' | 'o' | ..., category: string }
  problemIndex: number,
  pool: WordEntry[],           // the curated picture library (see §Open Questions #4)
): [WordEntry, WordEntry] {
  const tier = pickTier(problemIndex)
  // Gentle: picks from `pool` filtered to different category AND different starting consonant AND different vowel.
  // Trap:   picks from `pool` filtered to share at least one of: category, starting consonant, vowel, ending consonant.
  // Both tiers must satisfy the constraint set in §Distractor policy.
}
```

Pure functions, fully unit-testable. Test cases for both tiers + edge cases (e.g. when the gentle tier filter yields fewer than 2 candidates, fall back to "next-most-different" candidates).

### Phoneme audio module

```typescript
// src/screens/WordSong/phonemeAudio.ts

const PHONEMES: Record<string, Howl> = {
  // Lazy-init on first request; each Howl wraps `/assets/audio/phonemes/phoneme-{letter}.mp3`
}

export function playPhoneme(letter: string): Promise<void> {
  // Returns a promise that resolves on the Howler `onend` event,
  // so the hint-state sound-out can sequence reliably.
}
```

Cache the `Howl` instances in a module-level map; lazy-init on first play. No need for IndexedDB caching — the phoneme MP3s are bundled in PWA precache (per `audio-architecture.md` §"Caching strategy" — same pattern as Greet's bundled MP3s; add `mp3` glob entries for `public/assets/audio/phonemes/*.mp3`).

### localStorage key for stardust: `marian-tutor.stardust.v1` — shared with Math

If Math's implementation has already shipped, **import the existing reader/writer** rather than re-creating. If Word Song ships first, write the helper expecting Math to consume the same key.

### Concrete → visual → abstract progression

Marian is at the concrete end for literacy too — vocabulary bottleneck means meaning has to lead. For CVC short-a in this screen:

- **Picture (concrete)** sits at the top of the word card — meaning leads.
- **Letters (symbolic)** sit below — exposes her to the abstract notation while the picture provides the meaning anchor.
- **Picture chips (concrete)** are the discrimination surface — she answers in the concrete domain.

This is consistent with Math's "symbolic at top, visual groups below" *inverted* — but the inversion is intentional. Math's visual groups exist to *support* a symbolic problem (because the bottleneck is computational fluency, not meaning). Word Song's letters exist to *support* a meaning-first picture (because the bottleneck is vocabulary, not letter recognition). Different bottleneck, different ordering.

### Test seams (mirror Greet's / Math's pattern)

- `WordSong` component takes `playUtteranceFn?: PlayUtteranceFn` prop, defaulting to live `sessionAudio.playUtterance`. Tests inject a fake.
- `WordSong` component takes `playPhonemeFn?: PlayPhonemeFn` prop for phoneme audio injection.
- `WordSong` component takes `chime?: Sfx`, `poof?: Sfx`, `sparkle?: Sfx` props for SFX injection.
- Stardust reads/writes thread through a `storage?: StorageAdapter` prop with localStorage as default, in-memory mock for tests.

### Touch-target validation

Picture chips at 96×96pt with 24pt gaps. Letters at 96pt height (the SVG glyph) with ~32pt spacing — letter touch hit-area should extend with a `padding` of at least 8pt on each side to reach the 60pt floor (rendered glyph + padding). Devon: add the chips and letter hit-areas to the dev-only touch-target debug overlay (the one Kevin built per Session-1 implementation note).

### Performance sanity

- AnimatePresence with up to 6 sparkle particles + 1 stardust grain = 7 elements simultaneously animating per correct tap. Same as Math.
- 8 problem dots in HUD = 8 always-mounted divs. Same as Math.
- Per-problem cross-stagger fade = ~7 elements (3 chips + word card components). Slightly more than Math's 6 but still trivial.
- Phoneme MP3 cache: 14 `Howl` instances at peak. Each ~4 KB on disk + Howler runtime overhead; no memory pressure expected on iPad Air target.
- Picture chip SVGs: rendered as `<img src=".../picture-cat.svg">` or inlined `<svg>`, Devon's choice. If picture pack ends up as PNG (per Session-1 Screen 4's Thomas note), use `<img>` with explicit width/height to avoid layout shift.

### Optional v1 trim: speaker icon

If shipping the speaker icon adds material scope, defer it. **Caveat:** without the speaker icon, Marian has no in-screen way to replay the word read-aloud once Melody's initial line is done — the only replay surface would be the per-letter phoneme taps, which sound out the word piece-by-piece, not as a whole. Recommend keeping the speaker icon in v1 even if it adds scope; flag back to Matt if Devon hits implementation friction.

---

## Out of scope

Explicitly NOT covered by this spec, with the ticket that owns each (where one exists):

- **Short-o, short-u, short-e, short-i CVC sessions** — same screen shape, different vowel and different word pool. Not in v1; tracked in CLAUDE.md's literacy ladder. Future-iteration ticket TBD when v1 short-a ships and proves stable.
- **Digraphs (sh / ch / th)** — backlog.
- **Sight words** — backlog. Diagnostic flagged "not tested; introduce gradually" — no v1 design work.
- **Simple sentences** — backlog.
- **"Tap the word that matches the picture" inverse layout** — flagged for v3+ once CVC reading is automatic.
- **Speech-recognition input** ("say the word out loud") — v3+, no ticket.
- **Animations on Melody's mouth/eyes** — out of scope per Session-1 implementation note. Pose swaps only.
- **Mid-session interrupt and resume** — sibling ticket `86c9grnjf`.
- **Session-end transition (problem 8 → reward / next surface)** — ticket `86c9grnjd`. **Note:** that spec currently reads as Math-flavoured; needs a small generalising edit when this Word Song spec lands. Flag, not in scope here.
- **Stardust unlock loop / cosmetic gallery** — flagged for v2 in Math's spec; same v2 deferral applies here.
- **Streak persistence across sessions** — explicitly rejected in v1 (per Math's locked decision).
- **Curating the CVC short-a picture library** — sourcing/commissioning the ~12–16 illustrations is a parallel asset-pipeline workstream owned by Matt + Thomas. This spec lists the requirement; it doesn't author the pictures.
- **Defining the canonical word list for v1 short-a sessions** — see Open Questions #3. The session generator will draw from a curated list when one exists; until then, this spec assumes the diagnostic-anchored seed words `cat` and `dog`-with-short-a-confirmation as Problem #1 candidates per the same "win-on-debut" principle Math uses.

---

## Anti-dark-pattern audit (this screen)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] No variable-ratio reward — every correct answer earns the same +1 stardust; streak bonuses fire at fixed predictable thresholds (3/5/8). No randomness.
- [x] No streak shame — broken streak fades out quietly, no SFX, no TTS, no copy. Streak indicator hidden entirely until streak ≥ 2 so a "streak of 1" isn't a thing to lose.
- [x] No fake urgency — no countdown timers, no "session ends in X seconds", no "limited time" anything.
- [x] No social pressure — no leaderboards, no share buttons, no comparisons.
- [x] No infinite content — exactly 8 problems, then session ends. No "one more!" loop.
- [x] No dark patterns on exit — exit handled by session-end (out of scope here); on *this* screen there is no "are you sure?" friction blocking forward motion.
- [x] No surprise costs — no IAP, no "buy more stardust", no monetization UI of any kind.
- [x] Wrong answers are never punished — unlimited retries within the per-problem state machine, hint after 2, guided completion after 3.
- [x] No vocabulary shame — wrong answer never says "you don't know what 'cat' means". The puzzled-tilt + "Hmm... try again?" is meaning-neutral.
- [x] No reading-speed pressure — no timer on the word card, no "you took N seconds" feedback. The word stays on screen until she taps a chip, however long that takes.

---

## Open questions (need Thomas / Dave / Matt)

> **Note on numbering:** new spec, all questions numbered fresh. Questions inherited verbatim from Math's spec (where the same answer applies to both surfaces) are flagged as such.

### #1 — Phonics sequence confirmation (waiting on Dave)

This spec assumes v1 = short-a CVC, with progression o → u → e → i in subsequent vowel sessions, per `CLAUDE.md`'s diagnostic summary and Marian's April 2026 results (short-a mastered, short-i stumbled). **Dave's research memo at `design/research/phonics-sequence-marian.md` will confirm or refine this ladder when it lands.** If Dave's recommendation diverges (e.g. introducing digraphs earlier, mixing short-a and short-i in v1, etc.), this spec needs a revision before implementation. **Default until Dave's memo lands:** ship with v1 = short-a CVC. **Owner:** Dave (memo), then Matt (decide whether spec needs update or amendment).

### #2 — When the screen pivots to short-o, does the input model change?

The picture-discrimination model is right for short-a (Marian's mastered vowel — the discrimination is the *vocabulary* check, not the *vowel* check). When the screen pivots to short-o (her first new vowel), the pedagogical surface shifts: vowel discrimination becomes load-bearing. Should the short-o version of this screen swap to a "tap matching letter (initial vowel)" input model? Or keep the picture-discrimination model with vowel-confusable distractors (e.g. for `dog`: distractors `dig`, `bag`)? **Default until decided:** keep picture-discrimination for v1 short-a; revisit before short-o session ships. **Owner:** Thomas + Dave.

### #3 — Canonical CVC short-a word list for v1

This spec doesn't author the word list. Candidate v1 pool (8–12 words, all CVC short-a, all in Marian's likely vocabulary):

`cat, bat, hat, mat, can, fan, man, pan, bag, tag, sad, dad`

Plus distractor-only pictures (don't need to be CVC short-a, just need to be in her vocab):

`bus, sun, dog, fox, cup, pen, log, pot`

**Owner:** Thomas (taste / curriculum) + Matt (curates against Marian's actual vocab; Thomas's daughter, his call). Default: ship with the candidate list above unless Thomas swaps in a curated version before implementation.

### #4 — Picture-asset sourcing pipeline

~12–16 illustrations needed for v1, with consistent style, style-matched to Melody. Two paths:

- **Commission:** hire an illustrator for a one-time pack. Highest quality, longest lead time, costs money.
- **Curate from existing libraries:** find a free/licensed illustrated noun set with consistent style (e.g. open-licensed children's-book illustration packs). Faster, cheaper, lower bar.

**Owner:** Matt (decision), Thomas (taste sign-off on whatever Matt brings). Default: spec ships agnostic to source; the picture pack is a blocker for impl, not for spec merge.

### #5 — Streak threshold values (3, 5, 8) — inherited from Math (Math Open Q #2)

Math's spec carries the same open question about whether `[3, 5, 8]` is the right milestone trio. Word Song inherits whatever Thomas decides. **Default:** match Math at `[3, 5, 8]`.

### #6 — Mixed-session streak threshold values

If streaks count across both Math and Word Song problems within a session (per §Streak treatment), and a session is ~16 problems (8 + 8), should the bonus thresholds shift to match the longer total length? E.g. `[3, 6, 12]` instead of `[3, 5, 8]`? Or stay at `[3, 5, 8]` (so bonuses fire more frequently in mixed sessions)?

Trade-off: lower thresholds = more frequent dopamine hits = closer to slot-machine territory; higher thresholds = rarer rewards but more anti-dark-pattern. **Default:** stay at `[3, 5, 8]` — predictable, generous, and the Anti-dark-pattern audit prefers more-but-smaller-bonuses to fewer-but-bigger ones (the latter pattern is closer to "near miss" mechanics). **Owner:** Thomas, possibly with a Dave review.

### #7 — Speaker icon on word card — ship in v1 or defer?

Optional in v1 per §Visual layout. Without it, Marian can't replay the word read-aloud once Melody's initial line is done. With it, she can — at the cost of a slightly more complex word card. **Default:** ship in v1; defer only if implementation friction emerges. **Owner:** Devon (scope call), then Matt if it gets cut.

### #8 — Session JSON failure recovery — inherited from Math (Math Open Q #4)

Same fail-closed contract as Math: orchestrator owns malformed-session detection; this screen surfaces puzzled-tilt + stall on bad data. Confirming the parity. **Default:** orchestrator owns it. **Owner:** Thomas (architecture call).

### #9 — Letter-tap independence vs. attempt counting

Letter taps are spec'd as independent of the answer-chip task — no streak break, no attempt count, no Melody reaction. Is that right, or should excessive letter-tapping (e.g. 10+ before tapping a chip) signal "she's stuck" and proactively trigger the hint? **Default:** keep independent in v1. The hint trigger remains "2 wrong chip taps". Re-evaluate once we have telemetry from Marian's actual usage. **Owner:** Thomas / Dave.

---

## Provenance

- Brief: orchestrator dispatch (overnight design batch, 2026-04-26), draft spec.
- Math screen pattern reference: `design/screen-3-math.md` (the structural sibling).
- Session-1 Word Song listen-only reference: `design/session-1.md` lines 376–522.
- Audio architecture canonical reference: `design/audio-architecture.md`.
- Diagnostic data informing input-model + distractor rule: `CLAUDE.md` §"Marian's current levels" + project memory `project_diagnostic_results.md` (April 2026).
- Phonics-sequence research dependency (pending): `design/research/phonics-sequence-marian.md` (Dave, in flight).
- Locked Dave research relied on (cited not duplicated): `design/research/math-distractor-and-streak-decisions.md` (PR #35) — the gentle-ramp / hint-after-2 / sparkle-not-flame decisions translate directly to this surface.
