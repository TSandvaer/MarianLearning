# Screen 3 — Math (Number Garden: sums to 10)

**Audience:** Devon (impl ticket `86c9grn33`), Kevin (review), Jessica (QA), Thomas (taste).
**Author:** Kyle (UX) — ticket `86c9grn9c`.
**Status:** Spec — implementation blocked on this PR merging.
**Surface:** iPad portrait PWA, home-screen installed.
**Scope:** First arithmetic surface. Sums to 10 only. Eight problems per session. Stardust HUD + streak indicator + audio Path A integration.

This file is the canonical spec for the Math screen. Session-1 covers _problem #1 only_ as part of the
first-run walkthrough; everything else (problems 2–8, streaks, stardust accumulation, distractor rule)
lives here. `design/session-1.md`'s Screen 3 section delegates to this file from Session 2 onward.

---

## Goal

Marian completes eight sums-to-10 problems in a single session, banking stardust per correct answer,
without ever feeling judged on a wrong answer. The session reinforces the addition facts she _almost_
has automatic (her diagnostic flagged 100% finger reliance) by showing visual groups + numerals
side-by-side every problem, so the symbolic and the concrete keep meeting.

**This is not** a speed drill, a streak-based pressure mechanic, or an assessment. It's eight gentle
moments with Melody where she gets to be right a lot.

---

## User state entering this screen

Two paths in:

1. **Session 1 path** — she just tapped the heart on Greet (Screen 2). Melody's
   `layoutId="melody"` shared element shrinks her into the Math screen's upper-left. Background
   cross-fades clouds → garden over 500ms. Audio context already gesture-unlocked by the heart tap
   (Howler is hot).
2. **Session 2+ path** — she launched from home-screen, splash auto-advanced, no Greet. The first
   tap into Math _is_ the audio-unlock gesture. `useAudioUnlockGate` handles this — see
   §"Implementation pointers".

Both paths land on the same screen. Melody is in upper-left, idle/breathing. Problem #1 is already
mounted but TTS hasn't fired yet (gated on unlock).

---

## Visual layout

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 5     ●●●○○○○○         ✦ 3            |  <- HUD strip, 56pt tall
|  stardust   problem dots   streak        |
|                                          |
|  ~ pastel garden background ~            |
|                                          |
|  ( Melody     +-------------------+      |
|    upper-     | "How many?"       |      |  <- ribbon, 88% width
|    left,      |  (caption ribbon) |      |
|    ~30vh )    +-------------------+      |
|                                          |
|                                          |
|              3   +   2   =   ?           |  <- 96pt numerals
|                                          |
|         🌸 🌸 🌸    +    🌸 🌸           |  <- visual groups, 64pt
|                                          |
|                                          |
|   +----------+  +----------+  +--------+ |
|   |    4     |  |    5     |  |   6    | |  <- 3 answer chips, 88pt
|   +----------+  +----------+  +--------+ |     thumb-zone bottom 25%
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

**Vertical rhythm (top → bottom, portrait iPad ~1024pt tall):**

| Band                | Height       | Contents                                              |
| ------------------- | ------------ | ----------------------------------------------------- |
| Safe-area top       | env inset    | —                                                     |
| HUD strip           | 56pt         | Stardust counter (left), problem dots (center), streak indicator (right) |
| Melody + ribbon     | ~30vh        | Melody upper-left at ~30vh tall; ribbon to her right  |
| Problem display     | ~22vh        | Numerals row (96pt) + visual-groups row (~64pt)       |
| Spacer              | ~8vh         | Breathing room — non-negotiable; do not collapse      |
| Answer chips row    | ~14vh        | 3 chips, 88×88pt, 32pt gaps                           |
| Safe-area bottom    | env inset    | —                                                     |

**Thumb zone:** the answer chip row sits in the bottom ~25% of the viewport (above safe-area
inset). Marian holds the iPad in her lap or props it on a table; either way her thumbs reach the
chip row without stretching. Per CLAUDE.md global convention, all primary touch targets stay in
the bottom 60%; chips are well within.

**HUD strip details:**

- **Stardust counter (left, 16pt from edge):** small `star-filled.svg` glyph + count.
  Font: display, 32pt. Animates +1 on correct (see §Stardust treatment).
- **Problem dots (center):** 8 small dots, 12pt each, 8pt gaps. Filled (current/completed) vs.
  outlined (upcoming). Current problem dot has a soft ring around it. Read-only — not tappable.
- **Streak indicator (right, 16pt from edge):** sparkle glyph + count (per locked decision in
  §Stardust treatment → "Streak indicator visual"). Only visible when `streak ≥ 2` — a streak of
  1 is just "she got one right", not a streak yet.

The HUD strip is intentionally _quiet_. No animations except the per-event +1 stardust pop and the
streak appearing/disappearing. Marian's eye should land on the problem, not the HUD.

---

## Distractor policy (sums to 10)

**Locked rule (Dave-signed, PR #35):**

> **Adaptive 2-tier off-by-one.** Problems 1–3: gentle ramp distractors (clearly wrong, e.g.
> for `3 + 2 = 5`, show `3` and `10`). Problems 4–8: off-by-one trap distractors (e.g. `4` and
> `6`). Always 3 chips total: 1 correct + 2 distractors. Correct chip position randomised per
> problem.

**Why:** Marian's April 2026 diagnostic flagged off-by-one finger-counting errors as her primary
miscount pattern. Adjacent-number distractors are pedagogically the right surface to drill against
— but using them on her _first_ problems of a session risks a sour opening. The 3-problem warm-up
ramp gives her three banked wins before the trap distractors arrive, so by problem 4 she's
calibrated to the exercise and the off-by-one cost is "oops, retry with Melody's hint" rather than
"the app ambushed me."

**Rationale (locked per Dave's research memo `design/research/math-distractor-and-streak-decisions.md`,
PR #35):** Three warm-up items is the evidence-supported minimum before introducing tight
discriminations for an 8-year-old who is still procedurally dependent and entering a novel digital
context. Convergent support from:

- **Siegler's overlapping-waves model** (Erikson Institute draft, 2016) — children this age fluidly
  shift between retrieval and counting strategies across sessions; the first problems of a session
  carry higher procedural-error risk because the child has not yet settled into the session's
  cognitive rhythm.
- **Mammarella et al. (2023, Annals NYAS)** — wrong answers early in a problem set produce
  measurably elevated state anxiety that persists across subsequent items; effect is stronger for
  grades 1–3 and for low-automaticity learners. Three successful completions provide a meaningful
  buffer past the session-onset anxiety window.
- **McNeil et al. (2025, Psychological Science in the Public Interest)** — practice sessions should
  begin with easy, clear-cut items as warm-up calibration before diagnostic-quality items arrive.

The cost of the change is one fewer off-by-one diagnostic problem per session (5 instead of 6),
which is still sufficient signal for spaced repetition. The benefit is a measurably lower
probability of session-opening discouragement during Marian's first 5–10 sessions in the app.

**Candidate rules considered and rejected:**

| Rule                    | Why rejected                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Always off-by-one       | Punishing on problem 1; no gentle ramp.                                               |
| Always swap-of-digits   | Distractors like `32` for `3 + 2 = ?` look like "what is that even" — confusing, not pedagogical. |
| Random-in-range (1–10)  | Pedagogically random — doesn't target Marian's actual error pattern; sometimes too easy, sometimes too hard. |
| Always gentle ramp      | Never confronts the actual miscount pattern — wastes the Math surface on softballs.   |

**Constraint set the rule must satisfy** (lock these regardless of which rule wins):

1. Distractors must be in range `[1, 10]` (the problem space — no `0`, no `>10`).
2. Distractors must be _distinct from each other_ and from the correct answer.
3. **Off-by-one variant:** distractors are `correct - 1` and `correct + 1`, clamped to `[1, 10]`.
   For `1 + 1 = 2`, that's `1` and `3` (both still > 0). For `4 + 6 = 10`, that's `9` and `11` →
   `11` is out of range, so substitute the next-nearest in-range non-correct number → `9` and `8`.
4. **Gentle ramp variant:** distractors are at least 2 away from the correct answer in either
   direction, biased toward the extremes of the range. For `3 + 2 = 5`, that's `1` and `10` (or
   `2` and `9`, etc.). The implementation can pick deterministically per problem ID.

**Implementation note:** in `distractors.ts`, `pickTier(problemIndex)` must use
`problemIndex <= 3 ? 'gentle' : 'offByOne'` (i.e. `pickTier <= 3`, not `pickTier <= 2`). The cutoff
is locked at 3; do not parameterise. See §"Implementation pointers" for the full code shape.

---

## Stardust treatment

Stardust is the session reward currency. v1 keeps it dead simple — it accumulates across sessions
and Melody acknowledges milestones; **no unlock loop in v1** (see §"Inline answers to Matt's
ambiguities" item 4).

**When awarded:**

- **+1 stardust per correct answer**, awarded on the _first_ tap (no stardust for the
  retry-and-eventually-get-it path — that's a hint outcome, not a clean win).
- **+1 bonus stardust per streak threshold:** at streak 3, streak 5, and streak 8. So a clean
  8-for-8 session = 8 (per-correct) + 3 (bonuses at 3/5/8) = 11 stardust.
- **No stardust for wrong answers, partial credit, or "Try again?" recoveries.** Stardust is a
  positive signal only — never a "consolation prize" that dilutes the win.

**Animation pattern (per +1 stardust):**

1. **Burst from chip:** when the correct chip is tapped, 6 small `sparkle-particle.svg` elements
   emit from the chip centre, springing outward (`{ stiffness: 120, damping: 18 }`), fading over
   600ms. Same particle component as Session-1 Screen 5.
2. **Float-to-counter:** _one_ of those particles is special — it's the "stardust grain". It
   peels off the burst at 200ms and animates on a curved Bezier path to the HUD stardust counter.
   Total flight ~700ms. On arrival:
3. **Counter pop:** the stardust counter number scales `1 → 1.25 → 1` over 250ms (`spring,
   stiffness 300, damping 16`) and the count increments. Tiny gold flash behind the number for
   200ms.

For the streak-bonus stardust (problem 3, 5, 8 of a clean run), a _second_ grain peels off ~200ms
after the first, with a gentle additional chime. Marian sees two grains float up and the counter
ticks twice. The streak indicator also pops at the same moment.

**Persistence:**

- localStorage key: `marian-tutor.stardust.v1`
- Schema: `{ "total": <number>, "lastUpdatedAt": <ISO string>, "schemaVersion": 1 }`
- Read on Math screen mount; write after every increment _and_ on session end. Atomic — no
  partial-write races (the writes are synchronous setItem calls).
- The `schemaVersion` field exists so v2's unlock loop (if we add one) can migrate cleanly.
- **No streak persistence** — streak is per-session only and resets to 0 on session end. This is
  deliberate (see §Wrong-answer policy / §Inline answers item 3).

**Display location:**

- Top-left of the HUD strip. Always visible when on the Math screen. Hidden during transition in
  (fades in with the rest of the screen) and transition out (fades out together).
- During the burst+float animation, the HUD counter glows softly (`box-shadow` pulse at
  `--sparkle` colour, 600ms) so Marian's eye is drawn there as the grain arrives.

**Visual treatment:**

- Stardust glyph: the existing `sparkle-particle.svg` rendered at 24pt, fill `--sparkle`
  (`#FFD966`).
- Number: display font, 32pt, `--ink`. No leading zeros, no comma separators. Marian won't
  reach 1000+ stardust this year.
- Min display value: `0`. Hide the count entirely if it's the very first session and total is
  still 0 _at screen mount_? No — show "★ 0". Sets the expectation that something accumulates.

**Streak indicator visual — locked: sparkle, not flame (per Dave's research memo, PR #35):**

The HUD streak indicator (top-right) renders the existing `sparkle-particle.svg` at **32pt** (one
size larger than the stardust counter glyph at 24pt to read as a separate, slightly more
celebratory mark) with a **gold pulse** animation behind it on streak-threshold ticks (`box-shadow`
pulse at `--sparkle` `#FFD966`, 600ms, single fire — not a loop). Format: `[sparkle] 3`. Number
in the same display font / 32pt / `--ink` as the stardust counter so the right-side mark visually
parallels the left-side stardust counter without competing for emphasis.

**No new flame asset is authored.** The previously-flagged `icon-flame.svg` is dropped from the
required-assets list (see §Assets required note).

**Rationale (Dave, PR #35):** flame glyphs carry urgency / danger connotations in most cultural
contexts, and the cognitive-emotional priming effects of iconography are documented at
early-elementary ages (Nummenmaa et al., 2014, on embodied emotion and symbol processing). A soft
sparkle is on-brand for Melody and avoids the "don't lose your streak!" pressure framing that
CLAUDE.md explicitly bans. The sparkle reads as "you're on a roll" rather than "watch out, this
could burn out" — which is the exact emotional tone the anti-dark-pattern audit requires of this
mark. **Do not substitute a flame asset without a fresh Dave consult.**

---

## Wrong-answer policy

Per CLAUDE.md non-negotiable: **never a red X.** This section locks the visual + audio + state
machine for a wrong tap.

**State transitions on wrong tap:**

1. Tapped chip does a soft horizontal shake: `x: [0, -6, 6, -4, 4, 0]` over 400ms. **No colour
   change.** The chip stays at its normal fill.
2. Melody sprite swaps from `melody-idle.svg` → `melody-puzzled.svg` (asset confirmed present at
   `public/assets/melody-puzzled.svg`, 6 KB). Cross-fade through `AnimatePresence` (no `wait`
   mode — same pattern as Greet's idle↔happy swap), 200ms.
3. SFX: `sfx-poof.mp3` plays. Soft, breathy, ~500ms. **NOT a buzzer.** (Asset blocked on Thomas
   per `assets-todo.md`; until it lands, `createSfx` will warn-once and `play()` is a silent no-op
   — that's the right failure mode, silence is better than a stand-in tone.)
4. TTS re-prompt fires from the per-problem pre-rendered audio bundle (see §Audio integration).
   Line: **"Hmm... try again?"** Caption ribbon mirrors word-by-word.
5. After TTS completes, Melody returns to `melody-idle.svg` (cross-fade back, 200ms).
6. **Distractor stays available.** All 3 chips remain tappable. The correct chip is _not_
   highlighted, _not_ glowed, _not_ outlined. Marian must commit to a re-tap.

**Streak break (Matt's flagged ambiguity #3 — addressed inline):**

When a wrong answer breaks an active streak (`streak ≥ 2`), the streak indicator on the HUD does
NOT shake, flash, glow red, or otherwise punish. Instead:

- Streak indicator gently fades to opacity 0 over 400ms (the count was last shown as `✦ 3` —
  it just quietly leaves).
- Internal `streak` state resets to 0.
- No SFX dedicated to the streak break. The puzzle-poof is the only audio.
- No TTS reference to the streak ("oh no, you lost your streak!" is exactly the pattern we're
  refusing — that's manipulative for an 8-year-old).
- Caption ribbon never shows streak-related copy.

The intent: the streak indicator is a quiet "you're on a roll" signal, not a "don't break me!"
pressure mechanic. When it breaks, it just _leaves_. Marian's focus stays on the problem and
Melody's puzzled-tilt. If the orchestrator later builds a meta-screen that shows "best streak
this week", it can read the streak count from session state — but it should never show that on
the live problem screen.

**After 2 wrong attempts on the same problem — hint state:**

**Locked at 2 wrongs (not 1) per Dave's research memo (PR #35).** Mastery-learning rationale:
triggering a hint after only 1 wrong attempt removes the self-correction opportunity, which is
where real learning happens for a child building automaticity. Hattie & Timperley (2007) on
feedback timing shows the effect size for "error + self-correction" exceeds "error + immediate
correction." For Marian — at 100% finger reliance and still consolidating addition facts — the
chance to notice her own miscount and re-tap is the high-value moment. Hint after 2 protects that
moment; hint after 1 short-circuits it. **Do not lower this threshold without a fresh Dave consult.**

Same as Session-1 Screen 3 (lines 323–330). Flower groups pulse one at a time with TTS narration:

- "Look. Three..." (3-flower group pulses, each flower scales `1 → 1.1 → 1` in sequence, 150ms each)
- "...and two more." (2-flower group pulses)
- "How many now?"

After hint plays, all chips remain tappable.

**After 3 wrong attempts (hint didn't land):**

Correct chip shimmers (`box-shadow` glow at `--my-rose`, 800ms loop), Melody says **"This one is
five."** (or the actual correct value), all other chips dim to opacity 0.6, correct chip is the
only tappable. Tapping it: standard happy-path animation but **no stardust awarded** (this is a
guided completion, not an earned win). Streak does NOT increment.

**No wrong-answer counter is displayed anywhere.** Marian doesn't see "you got 3 wrong on this
problem". Internal state machine tracks attempts to gate the hint/guided flows; nothing surfaces.

---

## Audio integration contract (Path A)

Every utterance Math needs at session-start, listed so the Vercel function pre-renders them via
`api/_tts.ts` and ships them inline in the session JSON. Voice config is canonical from
`design/audio-architecture.md` §"Voice configuration" — `en-US-AnaNeural`, rate `-10%`, default
pitch, MP3 mono 24kHz ~48kbps. Do not deviate per-utterance.

**Per-problem utterances (8 problems × 4 lines = 32 audio assets per session):**

| `id` template          | Sample text (problem `3 + 2 = 5`) | When played                              | SSML rate | SSML pitch | Notes                                                                                 |
| ---------------------- | --------------------------------- | ---------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------------------- |
| `math.p{N}.read`       | "Three plus two. How many?"       | Screen entry / problem reveal complete   | `-10%`    | default    | The problem read-aloud. `{N}` is 1–8.                                                 |
| `math.p{N}.correct`    | "Yes! Five!"                      | Correct chip tapped                      | `-10%`    | default    | Number is the actual answer. Generated per-problem; do not template at runtime.       |
| `math.p{N}.reprompt`   | "Hmm... try again?"               | Wrong chip tapped (1st or 2nd attempt)   | `-10%`    | default    | Same text every problem — but render per-problem so each problem's bundle is self-contained. Reuse via `LINE_TEXT_TO_KEY`-style map if Devon prefers, but the bundle ships all 8 for cache-locality and to dodge any "missing utterance" dropouts. |
| `math.p{N}.hint`       | "Look. Three. And two more. How many now?" | After 2 wrong attempts on this problem | `-12%`  | default    | Slightly slower for the hint. Generated with the actual numerals for this problem.    |

**Optional — only if 3rd-strike guided completion fires:**

| `id` template          | Sample text                  | When played                       | SSML rate | SSML pitch |
| ---------------------- | ---------------------------- | --------------------------------- | --------- | ---------- |
| `math.p{N}.giveAnswer` | "This one is five."          | After 3 wrong attempts            | `-10%`    | default    |

**Total per-problem audio:** 4 lines × 8 problems = **32 utterances** baseline, +8 if we always
pre-render the giveAnswer fallback (recommend yes — predictable bundle size, ~120 KB extra at
~15 KB/utterance). **Total Math audio per session: ~40 utterances ≈ 600 KB inline base64.** Within
the 4.5 MB Vercel response cap budget noted in audio-architecture.md.

**SFX (NOT pre-rendered via TTS — these are static MP3s on disk, played via Howler):**

| `id`                  | File                     | When played                          | Status                                 |
| --------------------- | ------------------------ | ------------------------------------ | -------------------------------------- |
| `sfx.chime`           | `sfx-chime-soft.mp3`     | Reused — already in Greet            | Blocked on Thomas (assets-todo.md)     |
| `sfx.sparkle`         | `sfx-sparkle.mp3`        | Correct answer celebration           | Not yet authored — flagged             |
| `sfx.poof`            | `sfx-poof.mp3`           | Wrong answer puzzled-tilt response   | Not yet authored — flagged             |
| `sfx.stardust-grain`  | `sfx-plink.mp3`          | Stardust grain arrives at HUD counter| Reuse the Session-5 plink (gentle, short) |
| `sfx.streak-bonus`    | `sfx-sparkle.mp3` (reuse)| Streak threshold bonus stardust pop  | Reuse — distinct chord not worth a new asset for v1 |

**Audio dispatch sequence on chip tap (correct):**

```
t=0ms     : chip tap registered
t=0ms     : sessionAudio.playUtterance('math.p{N}.correct')  ← inside tap handler synchronously
t=0ms     : sfx.sparkle.play()  ← also synchronous, gesture-aligned
t=0-400ms : chip celebration animation (scale + sparkle burst)
t=200ms   : stardust grain peels off, begins float-to-counter
t=900ms   : grain arrives at counter, sfx.stardust-grain.play(), counter pops, total++
t=900ms   : if streak threshold hit (3/5/8): sfx.streak-bonus.play(), 2nd grain spawns
t=1200ms  : Melody returns to idle
t=1200ms  : auto-advance to next problem (or session-end if N=8)
```

**Audio dispatch sequence on chip tap (wrong):**

```
t=0ms     : chip tap registered
t=0ms     : sessionAudio.playUtterance('math.p{N}.reprompt')  ← inside tap handler synchronously
t=0ms     : sfx.poof.play()  ← also synchronous
t=0-400ms : chip shake animation
t=0-200ms : Melody cross-fade idle → puzzled
t=400-1500ms : "Hmm... try again?" plays; caption ticks word-by-word (linear timer per Path A)
t=1500ms  : caption full; Melody cross-fade puzzled → idle
              (NB: if attempt count is now 2, schedule the hint utterance to play
               after a 600ms beat instead of returning to idle)
```

**Caption rendering:** identical pattern to Greet — render `Utterance.text` via the Path A
`onWordTick` callback. Use the same word-by-word reveal as `greet-caption-word` (each word a
`<m.span>` with `data-revealed` toggling opacity 0→1 on its tick). Spec line in audio-architecture
§"Adding audio to a new screen" item 4 is the contract.

---

## States

### Idle (per-problem)

Problem displayed, chips waiting for tap, Melody idle/breathing in upper-left, caption ribbon
showing the just-spoken read-aloud line (full reveal, no animation), HUD strip steady.

### Happy path (correct first attempt)

Per the chip-tap-correct sequence in §Audio integration contract. After auto-advance:
- HUD: stardust +1 (animated), streak +1 (HUD streak indicator pops in if it was 0→1, or pops
  if it was already visible)
- Problem dot: current dot animates `filled-with-ring` → `filled-no-ring`; next dot animates
  `outlined` → `outlined-with-ring`.
- Cross-stagger: current problem's symbolic+visual+chips fade out (200ms reverse stagger), next
  problem's same fades in (300ms forward stagger). Melody stays put (`layoutId="melody"`).

### Happy path (correct after 1 or 2 wrong attempts)

Same chip-tap-correct sequence — **with one difference: still award stardust** (1 wrong tap is
within tolerance, the win is still earned). After 2 wrongs + correct: still award stardust.
The stardust withhold ONLY applies after the 3rd-strike guided completion fires.

Streak: any wrong attempt on the current problem resets streak to 0 _at the moment of the wrong
tap_. So even if she gets it right after 1 wrong, streak does not increment for this problem.
This is the rule: streak = "consecutive clean wins", not "consecutive eventually-correct".

### Wrong path (1st or 2nd attempt)

Per §Wrong-answer policy. Streak break (if active) per §"Streak break" subsection.

### Hint state (after 2 wrong)

Per §Wrong-answer policy. Plays the `math.p{N}.hint` utterance with the flower-group pulse
choreography. After hint, return to Idle (chips tappable, no auto-advance).

### Guided completion (after 3 wrong)

Per §Wrong-answer policy. Plays `math.p{N}.giveAnswer`. Correct chip is the only tappable.
Tap → standard happy-path visuals minus stardust + streak.

### Empty / first visit

This screen has no empty state per se — the session-start Claude call always returns 8 problems.
**If session JSON is malformed or missing utterances** (Path A bug surface): Melody plays
`melody-puzzled.svg` pose, no TTS, no auto-advance. Devon should log the error to console and
the orchestrator surfaces a "something went wrong, try again later" recovery — which is _not_
this spec's responsibility. Flag in §Open questions.

### Transition in

- From Greet (Session 1): Melody `layoutId="melody"` shrinks + repositions to upper-left over
  500ms with spring `{ stiffness: 180, damping: 22 }`. Background cross-fades clouds → garden
  over 500ms. HUD strip fades in over 300ms (delayed 200ms after layout settles).
- From Splash (Session 2+): same Math screen mounts. Melody enters via the same wake-tap
  pattern as Greet (audio-unlock gate; see §Implementation pointers).

### Transition out (per problem)

- Reverse stagger described in Happy path → 200ms.
- HUD streak/stardust pop animations finish before the next problem's elements start their
  forward stagger (sequencing: pop → 100ms beat → next reveal).

### Transition out (session end, problem 8 complete)

Out of scope of this spec — handled by ticket `86c9grnjd` ("what comes after problem 8?"). This
screen's contract: emit an `onSessionComplete({ totalCorrect, totalStardust, finalStreak })`
callback. Whoever owns Session-end builds the next surface.

---

## Assets required

Already in repo (no new authoring required for this spec):

| Asset                       | Used for                                             | Size       |
| --------------------------- | ---------------------------------------------------- | ---------- |
| `melody-idle.svg`           | Melody idle/breathing in upper-left                  | 6 KB ✅    |
| `melody-happy.svg`          | Correct-answer ear-wiggle pose                       | 6 KB ✅    |
| `melody-puzzled.svg`        | Wrong-answer puzzled-tilt pose                       | 6 KB ✅    |
| `melody-cheering.svg`       | NOT used in this screen — reserved for Session-end   | 7 KB ✅    |

Required, not yet authored (already on `assets-todo.md` follow-up list — flag to Thomas via Matt):

| Asset                       | Used for                                             | Target size | Notes                                    |
| --------------------------- | ---------------------------------------------------- | ----------- | ---------------------------------------- |
| `bg-garden.svg`             | Math screen background                               | <20 KB      | Pastel meadow, no hard edges             |
| `flower-glyph.svg`          | Visual-group flowers in problem display              | <3 KB       | Render via React component, not 5 copies |
| `sparkle-particle.svg`      | Celebration burst + stardust grain + HUD streak indicator (32pt) | <1 KB | Single shape, reused across all three uses (per locked decision in §Stardust treatment) |
| `star-filled.svg`           | HUD stardust counter glyph                           | <2 KB       | Same as Session-end jar star             |
| `sfx-sparkle.mp3`           | Correct-answer chime                                 | ~6 KB       | Soft shimmer, 400ms                      |
| `sfx-poof.mp3`              | Wrong-answer gentle response                         | ~8 KB       | Soft breathy poof, 500ms — NOT a buzzer  |
| `sfx-plink.mp3`             | Stardust grain arrival                               | ~5 KB       | Reused from Session-5 jar                |
| `sfx-chime-soft.mp3`        | (Reused from Greet)                                  | ~8 KB       | Already on assets-todo                   |

**TTS audio:** generated server-side at session-start. ~40 inline base64 MP3s per session, ~600 KB.
No static authored assets needed.

**Numerals + operators:** rendered as text in the SF Pro Rounded display font per global
conventions. No image assets.

**Problem dots + chip backgrounds:** CSS shapes (border-radius circles + filled rects). No image
assets.

---

## Inline answers to Matt's flagged ambiguities

### #3 — Streak break behaviour

Resolved in §Wrong-answer policy → "Streak break" subsection. Summary:

- Streak indicator fades out gently over 400ms when a wrong tap drops the streak.
- No SFX, no TTS, no shake, no colour shift, no copy.
- Internal `streak` state resets to 0; never persisted across sessions; never re-displayed
  retroactively.

The principle: streak is a quiet pat-on-the-back signal, not a pressure mechanic. When it breaks
it leaves quietly. Anti-dark-pattern explicit.

### #4 — Stardust ceiling / unlock

**v1 recommendation: simple counter, no unlock loop.** Stardust accumulates in localStorage,
displays on the HUD strip during Math sessions, and that's it. No "spend stardust on cosmetics",
no "hit 50 stardust to unlock a new background", no notifications, no progression UI.

**Rationale:**

- Building an unlock loop = building a meta-screen (item gallery, "you unlocked X!" celebration,
  inventory persistence). That's a separate spec and a separate week of work. Out of scope of
  ticket `86c9grn9c` and `86c9grn33`.
- More importantly, an unlock loop pushes us close to the variable-ratio territory CLAUDE.md
  explicitly bans. Even a fixed-threshold unlock ("at 50 stardust you get X") creates a
  "must-collect" loop that a tired 8-year-old shouldn't be navigating.
- The simple counter still does the work: Marian sees the number tick up per correct answer,
  feels the burst-and-float animation, and leaves the session with a number that's bigger than
  when she started. That's enough motivation for this surface; we don't need a slot machine.

**v2 recommendation (out of scope of this spec, flag to Matt for backlog):** if we ever add an
unlock loop, design it with three guardrails:

1. **Predictable, not variable.** Every milestone unlock is at a fixed integer (e.g. 25, 50, 100).
   Marian should know what's coming next and when.
2. **Generous, not gated.** Unlocks should feel "I get something today" not "I'm 3 short of
   something". If the screen ever shows "X to unlock", reconsider.
3. **Cosmetic only, not functional.** Unlocks reskin Melody (different ribbon colour, different
   background), they never give her more problems / harder problems / longer sessions. The core
   experience never changes per stardust count.

**Schema is forward-compatible:** the localStorage key `marian-tutor.stardust.v1` includes
`schemaVersion: 1` so v2 migration is a single-version-bump operation. We're not painting into a
corner.

**Action:** lock v1 = simple counter. Open a v2 ticket if/when Matt + Thomas decide an unlock loop
is worth the design work.

---

## Out of scope

Explicitly NOT covered by this spec, with the ticket that owns each:

- **Subtraction screen** — separate ticket (TBD, follows Math impl)
- **2-digit arithmetic** — backlog, post-August
- **Multiplication** — backlog, post-August
- **Anything beyond sums-to-10 in v1** — diagnostic placed Marian here; expansion is a future spec
- **Session-end transition (problem 8 → reward / next surface)** — ticket `86c9grnjd` ("what comes
  after problem 8?")
- **Mid-session interrupt and resume** (Marian closes the PWA mid-session) — ticket `86c9grnjf`
  ("what if Marian closes the PWA?")
- **Stardust unlock loop / cosmetic gallery** — flagged for v2, no ticket yet
- **Streak persistence across sessions** — explicitly rejected in v1; revisit only if Thomas
  wants a "best streak this week" parental-dashboard surface (no current ticket)
- **Speech-recognition input** ("say the answer out loud") — v3, no ticket
- **Animations on Melody's mouth/eyes** — out of scope per Session-1 implementation note. Pose
  swaps only.

---

## Implementation pointers (for Devon, ticket `86c9grn33`)

**File layout:**

```
src/screens/Math/
├── Math.tsx                  # Top-level screen component (mirrors src/screens/Greet.tsx pattern)
├── MathHud.tsx               # HUD strip (stardust counter, problem dots, streak indicator)
├── ProblemDisplay.tsx        # Numerals row + visual-groups row
├── AnswerChips.tsx           # 3-chip row, randomised correct position per problem
├── distractors.ts            # Pure functions: pickDistractors(correct, problemIndex) → [d1, d2]
├── stardust.ts               # localStorage read/write helpers; schema versioning
└── mathSequence.ts           # Per-problem state machine (mirrors greetSequence.ts pattern)
```

**Reuse, do not re-derive:**

- **Audio unlock gesture gate:** reuse `useAudioUnlockGate` from `src/lib/audio/useAudioUnlockGate.ts`.
  Same wake-tap pattern as Greet for Session 2+ entries (where Math is the first audible screen).
  Watchdog window: use the default 1500ms (Howler-era; same as Greet post-PR-#25).
- **Howler + linear-tick caption sync:** the `sessionAudio` module (Path A, ticket `86c9gr385`)
  exposes the same `onPlay` + `onWordTick` shape as `preRecorded`. Build the caption renderer as
  a near-copy of `Greet.tsx`'s `renderCaption` function — same `<m.span>` per-word, same
  `data-revealed` toggle, same `text-[2.4rem]` size for legibility floor.
- **Cross-fade Melody pose swap:** AnimatePresence with the default (non-`wait`) mode, exactly
  the pattern in Greet at lines 921–960. `key={pose}` on the `<m.img>`, src
  `/assets/melody-${pose}.svg`. No mouth animation.
- **Spring presets:** import the existing constants if Greet exports them, else mirror values:
  - HUD pop: `{ type: 'spring', stiffness: 300, damping: 16 }`
  - Chip celebration: `{ type: 'spring', stiffness: 300, damping: 18 }`
  - Stardust grain flight: `{ type: 'spring', stiffness: 120, damping: 18 }`
  - Melody layout transition (greet→math): `{ type: 'spring', stiffness: 180, damping: 22 }`
- **`LazyMotion` + `m`:** same as everywhere else. 4.6 KB budget already paid; do not import
  bare `motion`.
- **`MotionConfig reducedMotion="user"`:** already global at app root. For the per-screen
  reduced-motion branch (skipping infinite-loop animations like the chip celebration sparkle
  burst), copy `usePrefersReducedMotion` from `Greet.tsx` — or factor it out to
  `src/lib/usePrefersReducedMotion.ts` if Devon prefers a shared hook (Kyle would prefer; that's
  Devon's call on whether the refactor is in scope of this ticket).

**Distractor rule lives in `src/screens/Math/distractors.ts`:**

```typescript
export type DistractorTier = 'gentle' | 'offByOne'

export function pickTier(problemIndex: number): DistractorTier {
  // Problems 1-3: gentle ramp. Problems 4-8: off-by-one trap.
  // Cutoff locked at 3 per Dave's research memo (PR #35) — Siegler overlapping-waves
  // + Mammarella 2023 + McNeil 2025. Do not parameterise.
  return problemIndex <= 3 ? 'gentle' : 'offByOne'
}

export function pickDistractors(
  correct: number,        // the right answer, 0-10
  problemIndex: number,   // 1-8
): [number, number] {
  const tier = pickTier(problemIndex)
  // ... rules per §Distractor policy constraint set
}
```

Pure functions, fully unit-testable. Test cases for both tiers + the clamp-to-range edge cases
(`1 + 1 = 2` → gentle ramp can't go below 1; `4 + 6 = 10` → off-by-one can't go above 10).

**localStorage key for stardust: `marian-tutor.stardust.v1` — locked here.** Schema in
§Stardust treatment. Read/write helpers in `src/screens/Math/stardust.ts`. Wrap in try/catch
(localStorage can throw on private-browsing iOS; defensive default to in-memory state if so).

**Concrete → visual → abstract progression:** Marian is at the concrete end (100% finger
reliance per diagnostic). For sums to 10 in this screen:

- **Symbolic (`3 + 2 = ?`)** is at the top — exposes her to the abstract notation.
- **Visual groups (🌸🌸🌸 + 🌸🌸)** sit directly under the symbolic — concrete representation
  she can count if she needs to.

**Optional finger-counting helper visual (out of v1 implementation, but design the affordance
for v2):** if Marian taps Melody during a problem, Melody's hand shows the addends as
fingers held up (3 fingers, then 2 fingers). Out of scope for v1; do not implement now. Worth
calling out so the layout doesn't preclude it — leave Melody's upper-left slot tappable in
principle. **For v1: Melody is non-interactive on this screen.**

**Test seams (mirror Greet's pattern):**

- `Math` component takes `playUtteranceFn?: PlayUtteranceFn` prop, defaulting to the live
  `sessionAudio.playUtterance`. Tests inject a fake.
- `Math` component takes `chime?: Sfx`, `poof?: Sfx`, `sparkle?: Sfx` props for SFX injection.
- Stardust reads/writes thread through a `storage?: StorageAdapter` prop with localStorage as
  default, in-memory mock for tests.

**Touch-target validation:** chips are 88×88pt with 32pt gaps. Comfortably above the global
60×60pt floor. Devon: add the chips to the dev-only touch-target debug overlay (the one Kevin
built per Session-1 implementation note line 701).

**Performance sanity:**

- AnimatePresence with up to 6 sparkle particles + 1 stardust grain = 7 elements simultaneously
  animating per correct tap. Fine.
- 8 problem dots in HUD = 8 always-mounted divs. Fine.
- Per-problem cross-stagger fade = ~6 elements (3 chips + 3 problem display rows). Fine.
- No lists, no virtualization needed.

---

## Acceptance criteria (Jessica)

Functional:

- [ ] Session 1 entry: Math screen renders 1 problem (`3 + 2 = ?`) per Session-1 spec
- [ ] Session 2+ entry: Math screen renders 8 problems sequentially, all from the session JSON
- [ ] Each problem displays: symbolic line at 96pt, visual-groups row at 64pt flowers, 3 answer chips at 88pt
- [ ] Distractor rule: problems 1–3 use gentle-ramp distractors; problems 4–8 use off-by-one distractors (per `distractors.ts`)
- [ ] Correct chip position randomised per problem
- [ ] Distractors satisfy the constraint set (in range [1,10], distinct, clamp-on-overflow)
- [ ] HUD: stardust counter visible, problem dots visible, streak indicator hidden until streak ≥ 2
- [ ] Stardust persists in localStorage at key `marian-tutor.stardust.v1` with `schemaVersion: 1`
- [ ] Stardust +1 per correct first-attempt; no stardust on retry-eventually-correct or guided completion
- [ ] Streak bonus stardust at threshold 3, 5, 8 (clean run)
- [ ] Streak resets to 0 on any wrong tap; streak indicator fades out over 400ms when breaking from ≥2

Audio:

- [ ] Per-problem read-aloud (`math.p{N}.read`) plays on screen entry, after problem reveal stagger completes
- [ ] Caption ribbon mirrors TTS word-by-word via Path A `onWordTick`
- [ ] Correct chip tap triggers `math.p{N}.correct` synchronously inside the tap handler
- [ ] Wrong chip tap triggers `math.p{N}.reprompt` synchronously inside the tap handler
- [ ] After 2 wrong on same problem, hint TTS (`math.p{N}.hint`) plays with flower-group pulse choreography
- [ ] After 3 wrong, guided-completion TTS (`math.p{N}.giveAnswer`) plays + correct chip is highlighted
- [ ] All TTS routed through `sessionAudio.playUtterance`, never `lib/tts.speak()`

Anti-dark-pattern:

- [ ] No red colour appears anywhere on a wrong answer
- [ ] No "X" glyph or "wrong" text appears anywhere
- [ ] No wrong-answer counter is displayed
- [ ] No streak-related copy appears in TTS or captions ("don't lose your streak!" etc.)
- [ ] No "you lost your streak" SFX, animation, or TTS fires when streak breaks
- [ ] No share / leaderboard / social UI exists on this screen
- [ ] No "watch ad" or IAP affordance exists

Touch + accessibility:

- [ ] All touch targets ≥ 60pt in smallest dimension; chips at 88pt
- [ ] Chip-to-chip spacing ≥ 16pt (we ship 32pt)
- [ ] Chips remain tappable during TTS playback (no UI lock on audio)
- [ ] With Reduce Motion: sparkle particles don't drift, chip shake collapses to opacity flash, Melody pose-swap is direct (no cross-fade), HUD pop is opacity-only

iPad PWA:

- [ ] On iPad Safari deployed PWA install: first audio call from Math (Session 2+ first-tap) fires within 1.5s of tap; if not, audio-unlock gate surfaces ring per useAudioUnlockGate contract
- [ ] No audio dropouts mid-session
- [ ] No empty caption ribbon if `Utterance.text` arrives with audio (matches Greet shouldShowRibbon guard)

---

## Open questions (need Thomas / Dave)

> **Note on numbering:** items 1, 4, and 5 from the original list have been resolved by Dave's
> research memo (PR #35) and locked into the spec body — distractor cutoff into §Distractor policy,
> sparkle-vs-flame into §Stardust treatment → "Streak indicator visual", hint threshold into
> §Wrong-answer policy. The remaining items below retain their original numbering for traceability.

2. **Streak threshold values (3, 5, 8):** I picked these as feel-right milestones for an 8-problem session. Alternative: 4 and 8 (cleaner halves). Or 3, 6, 8. Want Thomas's taste call. **Default until decided:** ship `[3, 5, 8]`. (Dave's memo, PR #35, supports keeping `[3, 5, 8]` from a reinforcement-schedule standpoint but flags this as a Thomas taste call rather than a developmental requirement.)

3. **Stardust per session math:** clean 8-for-8 = 11 stardust (8 + 3 bonuses). One wrong on problem 1 (no streak bonuses possible until streak rebuild) = ~7 stardust. Is that ratio right, or do we want bonuses to feel rarer / more rewarded? **Default:** ship as specified.

6. **Session JSON failure recovery:** if the orchestrator delivers a malformed session (missing utterances, bad distractor data), Math currently shows Melody's puzzled-tilt and stalls. Should there be a graceful "let's try again later" surface, or is this entirely the orchestrator's responsibility to detect upstream? **Default:** orchestrator owns it. Math fails closed (puzzled + stall) — better than crashing.

7. **Melody interactivity:** v1 keeps Melody non-interactive on this screen. The finger-counting affordance (tap Melody → she shows the addends as fingers) is a v2 idea. Confirming v1 = non-interactive is the right call. **Default:** non-interactive in v1.

---

## Anti-dark-pattern audit (this screen)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] No variable-ratio reward — every correct answer earns the same +1 stardust; streak bonuses fire at fixed predictable thresholds (3/5/8). No randomness.
- [x] No streak shame — broken streak fades out quietly, no SFX, no TTS, no copy. Streak indicator hidden entirely until streak ≥ 2 so a "streak of 1" isn't a thing to lose.
- [x] No fake urgency — no countdown timers, no "session ends in X seconds", no "limited time" anything.
- [x] No social pressure — no leaderboards, no share buttons, no "Marian beat 67% of kids her age" comparisons.
- [x] No infinite content — exactly 8 problems, then session ends. No "one more!" loop.
- [x] No dark patterns on exit — exit handled by session-end (out of scope here); on _this_ screen there is no "are you sure?" friction blocking forward motion.
- [x] No surprise costs — no IAP, no "buy more stardust", no monetization UI of any kind.
- [x] Wrong answers are never punished — unlimited retries within the per-problem state machine, hint after 2, guided completion after 3.

---

## Provenance

- Brief: ClickUp ticket `86c9grn9c` (high priority, week-3, blocks Math impl `86c9grn33`).
- Dave-locked decisions follow-up: ClickUp ticket `86c9gt449` (week-3, follow-up).
- Audio architecture canonical reference: `design/audio-architecture.md` (PR #27).
- Greet implementation pattern reference: `src/screens/Greet.tsx`, `src/lib/audio/useAudioUnlockGate.ts`, `src/lib/audio/preRecorded.ts`.
- Session-1 walkthrough (single-problem version): `design/session-1.md` § "Screen 3 — Math Exercise".
- Diagnostic data informing distractor rule: `build a tutor AI app with investigation and analysis.md`, project memory `project_diagnostic_results.md`.
- Dave's research memo on distractor cutoff, hint threshold, and streak-indicator iconography: `design/research/math-distractor-and-streak-decisions.md` (PR #35).
