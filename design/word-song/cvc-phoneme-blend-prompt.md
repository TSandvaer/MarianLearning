# CVC Phoneme-Blend Prompt (2nd-wrong-tap) — Word Song

**Ticket:** 86c9qa6n3 (CVC review-mode MVP — Thomas greenlit MVP-first).
**Scope:** the single highest-value element of Dave's CVC review research — the
**second-miss phoneme-blend prompt**. On the 2nd wrong tap of a CVC word, Emma
models the phoneme blend ("c — a — t … cat") with synchronized letter-highlight
so Marian re-decodes the word herself. A correct re-decode after the prompt is an
orthographic-mapping event (Share self-teaching; Dave §E5, §E2).
**Persona owner:** Marian Tutor design persona. Implementation: Devon (render) +
Kevin (planner/canon-wire). **Design spec must precede impl.**
**Research basis:** `design/research/cvc-review-mode-marian.md` §E5 + Kyle-rec #1.

---

## Goal

When Marian taps a wrong picture chip twice on the same CVC word, Emma sounds the
word out grapheme-by-grapheme and then says it whole — giving Marian the decoding
tool to find the answer herself, never a failure signal — so her next tap is a
self-taught re-decode rather than a guess.

## User state entering this beat

Marian is on a `cvc-word` problem in Word Song (`"Read the <word>."`). She has
already:

- heard Emma read the line (after the 1500ms silent-text decode window),
- tapped a wrong picture chip **once** → got the existing gentle puzzled reaction
  ("Hmm... try again?" + poof + `puzzled-tilt` + shake), chips still tappable,
- tapped a wrong chip **a second time** on the same problem.

The picture of the target word is visible the whole time (semantic binding —
Dave §E4/§E8; the picture is the vocabulary verification mechanism for an L2
learner, not decoration).

---

## Where this slots into the existing state machine

This is **not a new screen** — it changes one beat inside `WordSong.tsx`'s
`handleWrongTap`. Today, the 2nd-wrong beat (`HINT_AFTER_WRONG_COUNT = 2`) fires a
generic `hint` utterance (`"Let's look. Cat."`) after a `HINT_DELAY_AFTER_WRONG_MS
= 600` beat, with the `attentive-pointing` pose and **no actual sound-out** — the
per-letter `phoneme-*.mp3` pipeline the old `screen-4-word-song.md` §"hint
choreography" assumed was **never wired** (LetterGlyph taps are visual-only; see
`WordSong.tsx` `LetterGlyph` JSDoc + screen-4 spec lines 1784–1789).

**The MVP replaces that empty 2nd-wrong `hint` beat with a real phoneme-blend
prompt.** The decode-it-yourself intent of the old `hint` is preserved; the
mechanism becomes a single Emma utterance that actually segments and blends the
word, with the letter-highlight driven off the utterance's own word-tick events
(no separate phoneme-MP3 pipeline needed).

### Trigger — exactly the 2nd wrong tap

| Wrong-tap count on this problem | Behaviour                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **1st wrong**                   | Existing gentle reaction — UNCHANGED. `reprompt` (`"Hmm... try again?"`), poof, `puzzled-tilt`, chip shake. Chips stay tappable.    |
| **2nd wrong**                   | **Phoneme-blend prompt** (this spec). Replaces the old generic `hint` at the same threshold. Chips stay tappable.                   |
| **3rd wrong**                   | Existing guided completion — UNCHANGED. `giveAnswer` (`"This one is cat."`), correct chip shimmers, only the correct chip resolves. |

State definition (anchor to existing synchronous gates so the rage-tap protections
hold — `handleWrongTap` already latches these refs):

- The blend prompt fires iff `nextWrongCount === BLEND_AFTER_WRONG_COUNT` (= the
  existing `HINT_AFTER_WRONG_COUNT`, value `2`) **and** `!blendPlayedRef.current`.
- `blendPlayedRef` is the rename/repurpose of the existing `hintPlayedRef` (it
  gates the same 2nd-wrong beat) — one latch, set synchronously the moment the 2nd
  wrong tap is counted, so 5 rapid finger-mashes on the same wrong chip queue
  exactly one blend prompt. Do **not** add a parallel ref; reuse the existing
  latch and its `repromptInFlightRef` cross-problem staleness guard verbatim.
- `BLEND_AFTER_WRONG_COUNT` < `GUIDED_AFTER_WRONG_COUNT` (2 < 3) must stay locked.
  Do not parameterise. Per Dave §E5 + the existing 2-wrong threshold lock (screen-4
  spec line 277 — Hattie & Timperley feedback-timing; the 1st wrong is Marian's
  self-correct window, so the blend waits for the 2nd).

This tier-targets `cvc-word` content only. `blending-cv`, `letter-names`,
`letter-sounds`, `sight-word`, `simple-sentence`, and digraph tiers keep their
existing 2nd-wrong `hint` beat (gate the new path on
`problem.contentType === 'cvc-word'`, mirroring the `isCvcWord` gate already used
for the silent-text window). A blend prompt only makes sense where the chip target
decodes phoneme-by-phoneme from a CVC grapheme string.

---

## Emma's blend modeling — how she voices it

Emma speaks **one utterance** (the new `blend` slot) whose text is the segmented
graphemes followed by the whole word. Example for `cat`:

```
c — a — t … cat
```

Voicing rules (Kevin wires these into the planner directive + TTS render; see
"Blend-audio utterances" below):

1. **Each grapheme is voiced as its PHONEME, not its letter name.** "c" → /k/,
   not "see"; "a" → /æ/, not "ay"; "t" → /t/. This reuses the existing
   letter-sounds IPA `<phoneme alphabet="ipa" ph="...">` machinery already in
   `api/_tts.ts` (the letter-sounds tier voices isolated phonemes this exact way,
   e.g. `<phoneme ph="m">mmm</phoneme>`). The blend prompt is the first CVC-tier
   consumer of that machinery.
2. **A short pause between each grapheme**, then a slightly longer pause before
   the whole word — the "…" beat where the blend resolves. Rendered as SSML
   `<break>` at TTS-synth time (same stored-text-plain / audio-shaped pattern as
   the simple-sentences `___`→"blank" substitution and the letter-sounds phoneme
   wraps): the stored `blend` canon text is the human-readable
   `"c — a — t … cat"`; the synth step segments on the em-dashes / ellipsis and
   injects `<break time="250ms"/>` between graphemes and `<break time="450ms"/>`
   before the whole word.
3. **The whole word at the end is voiced naturally** (not phoneme-wrapped) so
   Marian hears the blended target as one word — the self-teaching payload (Dave
   §E6: hearing the phoneme-blended form activates the decoding route).
4. Rate: `-12%` (slightly slower than the `-10%` house rate, matching the existing
   `hint` slot's slower register — this is a "let's slow down and sound it out"
   moment).

**Vocabulary-cap note:** the blend prompt adds NO new English words to Emma's
~200-word vocabulary — the graphemes are phonemes, and the whole word is the
target word already in the session. No framing words ("let's", "look") are spoken
in the MVP blend line; the segmentation itself carries the meaning and keeps the
line tight. (If Thomas's ear-test wants a soft lead-in, "Listen." is the only
candidate — flagged as Open Question Q1, not shipped by default.)

---

## Letter-highlight timing — synchronized to the blend

The CVC `cvc-word` problem already renders the word card with the picture above
and the letters below in `word-song-letters` (each letter an existing
`<LetterGlyph>`). During the blend prompt, **each grapheme highlights as Emma
sounds it, then the whole word highlights as she says it whole.**

Mechanism — reuse the existing word-tick seam, no new audio plumbing:

- The `blend` utterance text is tokenized by the same `text.split(/\s+/)` the
  caption ribbon uses, and `playUtterance` fires `onWordTick(wordIndex)` per token
  as the audio plays (real Path-A boundary events; synthetic 165wpm fallback when
  audio is silent — both already exist).
- **Token model.** Author the `blend` text so its whitespace tokens are exactly:
  `[grapheme₁, grapheme₂, grapheme₃, word]` → for `cat`, the tokens are
  `["c", "a", "t", "cat"]` (the em-dashes and ellipsis are rendered as separators,
  not tokens — they collapse in the split). So `onWordTick(0..2)` map 1:1 to the
  three `LetterGlyph` positions, and `onWordTick(3)` is the whole-word beat.
  Kevin must guarantee the canon `blend` text tokenizes to exactly
  `wordLength + 1` tokens (CVC = 4) — pin this in the planner round-trip test.
- A new `blendActiveLetterIndex` state (`number | null`, default `null`) is set
  from `onWordTick`: indices `0..wordLength-1` highlight that `LetterGlyph`;
  index `wordLength` (the whole-word token) clears the per-letter highlight and
  pulses **all** letters together once (the "blended" beat).
- `LetterGlyph` grows a `highlighted?: boolean` prop. Highlight visual = the
  existing tap-pulse styling reused (colour shift to `#FFB7C5` rose + `scale
[1,1.2,1]`), driven by the prop instead of the local tap state. This keeps the
  highlight visually identical to the already-shipped letter-tap affordance —
  Marian has seen this pulse before.

### Blend choreography timeline (for `cat`; per-grapheme cadence scales with the

TTS boundary events, these are nominal)

```
t=0ms      : 2nd wrong tap counted. poof + chip shake (existing).
             Emma pose → blend-modeling pose (see Poses below).
t=600ms    : BLEND_DELAY_AFTER_WRONG_MS beat (reuse HINT_DELAY_AFTER_WRONG_MS=600)
             so the poof/shake settles before the blend starts — UNCHANGED timing.
t=600ms    : speak('blend') begins. Caption ribbon mirrors "c — a — t … cat".
t≈600ms    : onWordTick(0) → letter[0] "c" highlights (rose pulse) as /k/ plays.
t≈+break   : onWordTick(1) → letter[1] "a" highlights as /æ/ plays.
t≈+break   : onWordTick(2) → letter[2] "t" highlights as /t/ plays.
t≈+break   : onWordTick(3) → per-letter highlight clears; ALL letters pulse once;
             picture gives a single gentle bob; Emma says "cat" whole.
t=onEnd    : blendActiveLetterIndex → null. Emma pose → idle. Chips tappable.
             Ribbon holds the fully-revealed blend text. NO auto-advance.
```

Reduce-motion: letter highlights are **colour-only** (no scale pulse), the
whole-word "all letters pulse" collapses to a colour flash, the picture bob is
skipped. The blend AUDIO + caption reveal still play (the silent-decode/phonics
value is a cognitive affordance, not a motion one — same reasoning as the
silent-text window's reduce-motion carve-out). Honour
`usePrefersReducedMotion()`.

---

## Emma's pose through the blend

Reuse the **`attentive-pointing`** pose (already the existing 2nd-wrong/hint pose,
already runtime-wired as of PR #434 Wave 14 Track B). Rationale: the wand carries
the direction (tilt 0°) toward the word card while Emma sounds it out — exactly the
"look here, let's sound it out together" affect. No new pose asset.

- On blend start (after the 600ms settle): `setPose('attentive-pointing')`.
- `POSE_HOLD_MS['attentive-pointing']` is `null` (never auto-returns) — the blend
  utterance's `.then()` (onEnd) clears it back to `idle`, **functional-updater
  guarded** (`prev === 'attentive-pointing' ? 'idle' : prev`) so a mid-blend
  correct/wrong tap that set `celebration`/`puzzled-tilt` is never clobbered.
  This mirrors the existing hint-beat pose clear exactly.
- The 1st-wrong beat keeps `puzzled-tilt` (UNCHANGED) — so Marian sees a clear
  two-step affect: 1st wrong = "hmm?" (puzzled, tilt RIGHT), 2nd wrong = "here,
  let's sound it out" (attentive, pointing at the card). Never a downward pitch,
  never a red X.

---

## The retry — what happens after the prompt

After the blend prompt's `onEnd`, Emma returns to `idle`, all chips are tappable,
the ribbon holds the revealed blend text. **No auto-advance, no answer given** —
Marian taps again.

- **Correct re-decode (the self-teaching win).** Standard correct path fires
  (`handleCorrectTap`): `celebration` pose (ear-tilt LEFT), sparkle burst, plink,
  HUD pop, auto-advance. **Stardust/streak treatment is UNCHANGED** — word-song
  grants no per-correct stardust (removed ticket 86c9kwvza), and a problem with
  any wrong tap is not a clean streak win (`isCleanWin = wrongCount === 0`), so the
  streak does not increment. That is correct and intended: the reward for the
  re-decode is the celebration sensory beat + advancing, not points. The
  orthographic-mapping event is the payload, per Dave §E5.
  - `perProblemCorrect` records `true` (word-song ever-correct semantics — the
    latch fires on correct resolution, so a wrong-then-correct retry counts toward
    the graduation split). UNCHANGED behaviour; called out so QA knows the blend
    path does not alter session accounting.
- **3rd wrong (blend didn't land).** Existing guided completion fires UNCHANGED —
  `giveAnswer` (`"This one is cat."`), correct chip shimmers (`guidedShimmer`),
  only the correct chip resolves the problem. Emma hands her the answer warmly.
  Still no red X.

---

## Picture role — stays visible throughout

The target word's picture (`word-song-word-picture`, 180pt) stays rendered and
unchanged through all three wrong beats and the blend prompt. It is the semantic
anchor that lets the orthographic mapping complete its meaning binding — for an L2
learner this is the verification layer that makes the decode meaningful (Dave §E4,
§E8: without the picture a correct decode of an unknown English word is a hollow
pronunciation-spelling unit). The whole-word beat gives the picture a single
gentle bob (reduce-motion: skipped) to bind "the sounds I just blended" → "this
picture" → "this word." The picture is never removed, dimmed, or swapped during
the blend.

---

## Visual layout (no new layout — annotated existing word card)

```
┌───────────────────────────────────────────────┐
│ HUD: ✦ stardust    • • • ◦ ◦ ◦ ◦ ◦    streak   │
├───────────────────────────────────────────────┤
│  [Emma: attentive-pointing,  ◀╮                │
│   wand toward card]           │ caption ribbon: │
│                               ╰ "c — a — t … cat"│  ← blend text,
│                                                 │     reveals word-by-word
│            ┌───────────┐                        │
│            │  PICTURE  │   ← stays visible,      │
│            │  (cat)    │     gentle bob on the   │
│            └───────────┘     whole-word beat     │
│                                                 │
│              c     a     t      ← LetterGlyphs;  │
│              ▲                    each highlights │
│           (rose pulse, in step    as Emma sounds  │
│            with the phoneme)      it; all pulse   │
│                                   on whole-word   │
│                                                 │
│        [pic A]    [pic B]    [pic C]   ← 3 chips, │
│         96×96      96×96      96×96      tappable │
└───────────────────────────────────────────────┘
```

Touch targets unchanged: 96×96pt chips, 24pt gaps (≥44pt HIG). The blend prompt
adds no new interactive element — letter highlight is presentation-only
(`LetterGlyph` taps remain the existing visual-only affordance).

---

## States

- **Idle (entering the problem):** word card + 3 chips, picture visible, letters
  un-highlighted, Emma `idle`/`listening` during read-aloud. Standard.
- **Happy path (correct, no/one wrong):** standard correct path — blend never
  fires. UNCHANGED.
- **1st wrong:** existing gentle puzzled reaction. UNCHANGED.
- **2nd wrong (this spec):** blend prompt — `attentive-pointing` pose, blend
  utterance, per-grapheme letter highlight, whole-word all-pulse + picture bob,
  return to idle, chips tappable, no auto-advance, no answer given.
- **Re-decode correct after blend:** standard celebration; advances; no streak
  increment, no stardust (word-song treatment). Self-teaching win.
- **3rd wrong:** existing guided completion. UNCHANGED.
- **Error / no audio:** if `speak('blend')` rejects (silent context, 404), the
  synthetic 165wpm caption-walk still ticks the tokens, so the letter highlights
  still sequence visually and the blend text still reveals — the prompt degrades
  to a captioned, visually-sequenced sound-out with no audio. No red X, no
  soft-lock (mirrors the existing `reportSpeechError` fail-open).
- **Transition in/out:** no route change. The blend is an in-problem beat;
  problem-advance on the eventual correct/give-answer clears
  `blendActiveLetterIndex`, the `blend` latch, and the pose via the existing
  `advanceToNext` reset block (add `blendActiveLetterIndex → null` and
  `blendPlayedRef → false` to that block alongside the existing resets).

---

## Assets required

### Reused — no new asset

| Asset                         | Role here                              | Status                                        |
| ----------------------------- | -------------------------------------- | --------------------------------------------- |
| `emma-attentive-pointing.svg` | Emma's pose during the blend           | Already shipped + runtime-wired (PR #434).    |
| `emma-puzzled-tilt.svg`       | 1st-wrong reaction (unchanged)         | Shipped.                                      |
| `emma-celebration.svg`        | Correct re-decode reaction (unchanged) | Shipped.                                      |
| `<LetterGlyph>`               | The highlighted letters                | Exists; grows a `highlighted?: boolean` prop. |
| `word-song-word-picture`      | Semantic anchor + whole-word bob       | Exists.                                       |
| `sfx-poof.mp3`                | 2nd-wrong poof (unchanged)             | Shipped.                                      |
| IPA `<phoneme>` TTS path      | Grapheme phoneme voicing               | Exists (letter-sounds tier).                  |

**No new SVG, no new SFX, no new pose.** The blend prompt is audio + reused
visuals only.

### New Emma blend-audio utterances (for Kevin — planner wire + bake)

A **new `blend` utterance slot** on `WordSongProblemUtterances` (the 6th slot,
alongside `read | correct | reprompt | hint | giveAnswer`). One `blend` utterance
**per CVC problem** in a session. Utterance id template: `word.p{N}.blend` (mirrors
the existing `word.p{N}.{slot}` family).

Canon `blend` text shape (stored plain; TTS synth segments + injects `<break>` +
IPA-phoneme-wraps each grapheme):

```
<grapheme₁> — <grapheme₂> — <grapheme₃> … <word>
```

Worked examples across the current CVC pools (short-a + short-o targets):

| Word | `blend` canon text | Tokens (must be wordLength+1) |
| ---- | ------------------ | ----------------------------- |
| cat  | `c — a — t … cat`  | `c a t cat` (4)               |
| hat  | `h — a — t … hat`  | 4                             |
| bag  | `b — a — g … bag`  | 4                             |
| man  | `m — a — n … man`  | 4                             |
| jam  | `j — a — m … jam`  | 4                             |
| van  | `v — a — n … van`  | 4                             |
| dog  | `d — o — g … dog`  | 4                             |
| mop  | `m — o — p … mop`  | 4                             |
| log  | `l — o — g … log`  | 4                             |
| pot  | `p — o — t … pot`  | 4                             |
| hot  | `h — o — t … hot`  | 4                             |
| mom  | `m — o — m … mom`  | 4                             |

**Two-phoneme-grapheme caveat — `box` / `fox`.** The `x` decodes as /ks/ (these are
C-V-CC, listed as short-o CVC by spelling). The blend must voice `x` as /ks/ as one
grapheme token, so the token count stays `4` (`b o x box`), not 5. Kevin: the IPA
wrap for the `x` grapheme is `<phoneme ph="ks">`. (This matches the existing
`box`/`fox` first-encounter scaffold already in the short-o spec — reuse that /ks/
treatment.) Author: `b — o — x … box` and `f — o — x … fox`.

**Volume of new utterances to bake:** 1 `blend` line × 8 problems = **8 new
utterances per CVC session bundle** (only on `cvc-word` problems; `blending-cv` and
other tiers emit no `blend`). Per-utterance size is comparable to the existing
`hint` line (~15–18 KB base64). Bake is a follow-up + Thomas ear-test (OOS here) —
the ear-test specifically checks the phoneme isolation reads cleanly (the
letter-sounds tier already proved Emma multilingual voices isolated phonemes
acceptably) and that the `<break>` cadence reads as "sounding out," not stilted.

**Kevin wire checklist (the contract surfaces a `blend` line must touch):**

1. `WordSongUtteranceSlot` union + `ALL_SLOTS` + `WordSongProblemUtterances` — add
   `blend` (`wordSessionPlans.ts`).
2. Planner directive in `WORD_SONG_TRACK_GUIDE` (`api/_planner.ts`) — instruct
   Haiku to emit a `blend` line per `cvc-word` problem in the
   `<g> — <g> — <g> … <word>` shape (and the /ks/ exception for `x` words).
3. Wire adapters — `wordSongSessionPlanToUtteranceSources` /
   `wordSongSessionPlanFromWire` round-trip the new id (`word.p{N}.blend`).
4. `planFromServer.ts` — the parser tolerates + carries the `blend` id (it is
   in-namespace, so it flows through; just ensure it is required for `cvc-word`).
5. TTS synth (`api/_tts.ts`) — segment the `blend` text on `—`/`…`, IPA-wrap each
   grapheme phoneme, inject `<break>`, leave the whole word natural. Rate `-12%`.
6. Canon rebake (`npm run canon:regen`) + commit the JSON diff (follow-up PR).
7. `plannerRoundTrip.test.ts` — pin: every `cvc-word` problem carries a `blend`,
   and the `blend` text tokenizes to exactly `target.word.length + 1` tokens
   (the `/ks/` words still count 4 because `x` is one grapheme token).

---

## Acceptance criteria (Jessica)

Testable, checkbox-style. The render-side criteria are e2e/unit-testable against
DOM seams; the audio criteria are pinned at the planner-round-trip + canon layer.

- [ ] On a `cvc-word` problem, the **1st** wrong tap fires the existing `reprompt`
      reaction only (poof + `puzzled-tilt` + shake); no blend prompt, no letter
      highlight sequence.
- [ ] On the **2nd** wrong tap of the same `cvc-word` problem, the blend prompt
      fires: Emma pose becomes `attentive-pointing` (`data-pose="attentive-pointing"`)
      and the `blend` utterance plays (caption ribbon shows the `c — a — t … cat`
      text).
- [ ] The blend prompt fires at `BLEND_AFTER_WRONG_COUNT = 2`, strictly before the
      `GUIDED_AFTER_WRONG_COUNT = 3` give-answer beat.
- [ ] Exactly **one** blend prompt is queued for 5 rapid wrong taps on the same
      chip (rage-tap latch via the reused 2nd-wrong ref — assert the `blend`
      utterance plays once).
- [ ] During the blend, each `LetterGlyph` highlights in sequence
      (`data-highlighted="true"` walks index 0→1→2 in step with `onWordTick`),
      then on the whole-word token all letters highlight together once.
- [ ] The target word's picture (`word-song-word-picture`) stays rendered and
      visible throughout all three wrong beats and the blend prompt (never removed
      or dimmed).
- [ ] After the blend `onEnd`, Emma returns to `idle`, all 3 chips are tappable
      (`disabled=false`), and there is **no** auto-advance and **no** answer given.
- [ ] A **correct** tap after the blend fires the standard celebration + advances;
      streak does **not** increment (any-wrong problem) and no per-correct stardust
      is granted (word-song treatment unchanged); `perProblemCorrect[i]` is `true`.
- [ ] A **3rd** wrong tap fires the existing guided completion (`giveAnswer` +
      correct-chip shimmer); UNCHANGED.
- [ ] No red X, no error sound beyond the existing soft poof, no downward head
      pitch, at any wrong beat.
- [ ] With Reduce Motion on: letter highlights are colour-only (no scale pulse),
      whole-word beat is a colour flash, picture bob is skipped; the blend audio +
      caption reveal still play.
- [ ] If `speak('blend')` rejects, the caption walks the blend tokens via the
      synthetic fallback and the letter highlights still sequence; no soft-lock, no
      red X.
- [ ] Non-CVC tiers (`blending-cv`, `letter-names`, `letter-sounds`, `sight-word`,
      `simple-sentence`, digraphs) do **not** fire the blend prompt on the 2nd
      wrong tap — they keep their existing `hint` beat.
- [ ] (Canon) Every `cvc-word` problem in a baked session bundle carries a
      `word.p{N}.blend` utterance whose text tokenizes to `target.word.length + 1`
      tokens (pinned in `plannerRoundTrip.test.ts`).

---

## Open questions (need Thomas)

- **Q1 — soft lead-in word.** The MVP blend line is bare segmentation
  (`c — a — t … cat`) with no framing word, to keep it tight and add zero
  vocabulary. Dave's research-doc example used a lead-in ("Let's hear it:
  /m/-/ɒ/-/p/… mop!"). Recommend shipping bare and adding **"Listen."** (the only
  in-cap candidate) ONLY if Thomas's ear-test finds the bare segmentation reads as
  abrupt. Decision: ship bare, ear-test, add "Listen." if needed.
- **Q2 — em-dash vs comma in the stored canon text.** Spec uses `—` / `…` as the
  segment/whole-word separators because they render cleanly in the caption ribbon
  and give the TTS synth an unambiguous split token. Confirm the caption ribbon
  renders `—` acceptably at the ribbon's font size on iPad (it should — it is the
  same `font-display`), else fall back to spaced dots. Devon to spot-check on the
  real preview; not a blocker.
- **Q3 — phoneme isolation ear-test.** The /k/, /æ/, /t/ etc. isolated phonemes
  must read cleanly on Emma multilingual at `-12%`. The letter-sounds tier already
  proved this works, but the `box`/`fox` `/ks/` grapheme is new — Thomas's bake
  ear-test should specifically confirm `/ks/` reads as a clean cluster, not a
  buzzy burst (the en-GB Olivia phoneme-softening prosody note in `api/_tts.ts`
  may need to apply here too — Kevin's call at wire time).

```

```
