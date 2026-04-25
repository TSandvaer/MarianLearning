# Session 1 — First-Run Walkthrough

**Audience:** Kevin + Devon (implementers), Jessica (QA)
**Author:** Kyle (UX)
**Surface:** iPad portrait PWA, home-screen installed
**Scope:** First-ever session — splash → greet → 1 math problem → 1 literacy problem → reward/teaser
**Session length target:** 4–6 minutes (first-run only; later sessions run the full 10–15 min)

---

## Global conventions (apply to every screen)

- **Portrait orientation only** (`orientation: portrait` in manifest). Lock via CSS `screen.orientation.lock('portrait')` on install-launch; fallback to portrait-only layout.
- **Safe areas:** honor `env(safe-area-inset-*)`. All primary touch targets live in the **bottom 60%** of the viewport (thumb-reachable when iPad is held in lap or propped).
- **Touch targets:** minimum **60×60pt** for this app (iOS HIG says 44pt; we oversize for an 8-year-old). Spacing ≥ 16pt between any two tappable targets.
- **Typography:** body 20pt, instructional text 28pt, problem numerals 96pt. System font stack (`-apple-system, SF Pro Rounded, "SF Pro", sans-serif`). We want the rounded variant if available — reads warmer.
- **Color tokens (Melody palette):**
  - `--my-pink`: `#FFC0CB` (hood / accents)
  - `--my-cream`: `#FFF5F0` (default background wash)
  - `--my-rose`: `#F48FB1` (primary button fill)
  - `--ink`: `#3D2B3D` (text — soft aubergine, never pure black)
  - `--sparkle`: `#FFD966` (stardust, celebration)
  - No reds. No browns. No grey that reads as "disabled."
- **Motion library:** Framer Motion via `LazyMotion` + `m` component (4.6 KB budget). Global `MotionConfig reducedMotion="user"` at app root — if Marian's iPad has Reduce Motion on, springs collapse to short fades.
- **Audio stack:** Web Speech API for Melody's TTS (`en-US`, female voice preference, rate 0.9, pitch 1.1). Howler.js for SFX. Preload all SFX at app boot; TTS is generated on demand.
- **TTS captions:** every Melody line is mirrored as on-screen text in a speech-ribbon below/beside her, **revealed word-by-word synced to TTS `boundary` events** (passive reading exposure). If `boundary` events don't fire (Safari quirk), fall back to full-line reveal on `start` event.
- **No red X, ever.** Wrong answers trigger puzzled-tilt + "poof" SFX + retry — see Error Path in each exercise screen.
- **No streak/XP counter is visible in Session 1.** First-run is about meeting Melody, not earning points.

---

# Screen 1 — Splash / Launch

## Goal
Give Marian a 1.5-second "the app is waking up" moment that loads assets without feeling like a loading screen.

## User state entering this screen
She tapped the **Melody** icon on her iPad home screen. PWA launches full-screen (no Safari chrome).

## Visual layout

```
+----------------------------------+
|        [safe area top]           |
|                                  |
|                                  |
|                                  |
|         ( Melody logo )          |  <- centered, 240pt wide
|         "Melody"                 |  <- wordmark under logo, 32pt
|                                  |
|         ooo  (dots pulsing)      |  <- 3 pink dots, stagger
|                                  |
|                                  |
|        [safe area bottom]        |
+----------------------------------+
```

- Background: `--my-cream` with a very subtle radial gradient to `--my-pink` at 10% opacity. Static — no looping animation on splash.
- No "tap to continue" — auto-advances.
- No version string, no build hash. This is Marian's screen, not a dev screen.

## Copy / TTS script

**None.** Splash is silent. Audio starts on Screen 2.

On-screen text: **"Melody"** (wordmark only).

## Motion

- Logo: `initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}` with spring `{ stiffness: 180, damping: 18 }`. ~400ms.
- Dots: three `m.div` children in a `motion.div` parent with `variants` + `staggerChildren: 0.15`. Each dot pulses opacity 0.4 → 1 → 0.4 on a 1.2s loop (`repeat: Infinity, repeatType: "mirror"`).
- Auto-advance to Screen 2 after **1500ms** (fixed timer, independent of asset load — assets should be preloaded from service worker cache on 2nd+ launch).

## States

- **Idle / first visit:** as described. Lasts 1500ms then transitions.
- **First visit (cold cache):** if critical assets (Melody idle sprite, intro TTS audio if pre-generated) aren't ready at 1500ms, extend splash up to **3000ms max**, then force-advance even if assets are mid-load (show Melody's idle frame even if her animation sprite hasn't loaded).
- **Return user (not applicable in Session 1 by definition — but reuse this screen):** same splash, no change.
- **Transition out:** logo + dots fade out over 250ms (`opacity: 0`, `ease: "easeOut"`), cream background stays as background for Screen 2 (shared layout — no hard cut).

## Assets required

- `melody-logo.svg` — wordmark + heart icon. Vector, ~8 KB target. **NEW asset.**
- No SFX. No TTS.

## Acceptance criteria

- [ ] On PWA launch from home screen, splash appears full-screen with no Safari chrome visible
- [ ] Splash shows for 1500ms on warm cache, up to 3000ms on cold cache, then auto-advances
- [ ] No "skip" or "tap to continue" affordance exists
- [ ] Logo scale-in spring animation plays once on mount
- [ ] Three dots pulse in stagger sequence
- [ ] If device has "Reduce Motion" on, dots show as static and logo fades in without scale
- [ ] No text other than the "Melody" wordmark is displayed
- [ ] No audio plays on this screen

---

# Screen 2 — First Greeting (Meet Melody)

## Goal
Marian meets Melody for the first time. Melody does not know her name. Warm, short, ends with a single forward action.

## User state entering this screen
Splash just faded. She's seen the Melody wordmark. Cream background is already present from Screen 1.

## Visual layout

```
+----------------------------------+
|        [safe area top]           |
|                                  |
|         ~ sky pattern ~          |  <- soft cloud bg fades in
|                                  |
|      ( Melody - idle / smile )   |  <- 60% of viewport height
|                                  |  <- slides in from bottom-left
|                                  |
|   +-------------------------+    |
|   |  "Hi! I'm Melody."      |    |  <- speech ribbon, word-by-word
|   |  (captions mirror TTS)  |    |
|   +-------------------------+    |
|                                  |
|                                  |
|        [ PINK HEART BUTTON ]     |  <- thumb zone, 88pt tall
|         (appears at line 3)      |
|                                  |
|        [safe area bottom]        |
+----------------------------------+
```

- Background: `bg-clouds.svg` — soft cream-to-pink wash with 3 stylized clouds, fades in over 600ms.
- Melody: centered horizontally, fills ~60% of viewport height, bottom-aligned to speech ribbon.
- Speech ribbon: white rounded rect (`border-radius: 24pt`), 88% viewport width, 16pt pink border, soft shadow. Centered under Melody.
- Primary CTA: giant pink heart button, 88pt tall × 120pt wide, centered in bottom thumb zone (bottom 20% of viewport). Icon-only — **no text label.** Melody tells her what it does via TTS.

## Copy / TTS script

Melody speaks on first appearance. Lines separated by ~400ms natural pauses.

1. **(0.0s)** "Hi!" *(ear-wiggle cue on this word)*
2. **(0.8s)** "I'm Melody."
3. **(2.2s)** "It's so nice to meet you."
4. **(4.0s)** "Tap the heart when you're ready."

**Word-count check (against 200-word cap):** `hi, i'm, melody, it's, so, nice, to, meet, you, tap, the, heart, when, you're, ready` — 15 unique words. All within cap. "Melody" is the character name (always allowed).

On-screen text: exact TTS transcript, revealed word-by-word in the speech ribbon.

## Motion

- **Clouds bg:** fades in 0→1 opacity over 600ms, `ease: "easeOut"`. Very subtle horizontal drift (`x: [0, 10, 0]` over 20s, `repeat: Infinity`) — slow enough to feel alive, not frantic. Disabled if `prefers-reduced-motion`.
- **Melody entrance:** slides in from off-screen bottom-left.
  ```
  initial={{ x: -120, y: 60, opacity: 0 }}
  animate={{ x: 0, y: 0, opacity: 1 }}
  transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.3 }}
  ```
  Total entrance ~700ms. Spring settles without bounce-past (damping 22 keeps it calm, not cartoonish).
- **Ear-wiggle** on "Hi!" word boundary: sprite swap idle → happy for 600ms, then back. If no sprite system, CSS rotation of ear layer `rotate: [0, -8, 6, 0]` over 500ms.
- **Speech ribbon:** scales in from 0.9 → 1 on first TTS `start` event, spring `{ stiffness: 260, damping: 20 }`.
- **Caption word reveal:** each word fades in with `opacity: 0 → 1` over 150ms, synced to TTS `boundary` events. Previous words stay visible.
- **Heart button:** does NOT appear until Melody's line 3 finishes. Then:
  ```
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", stiffness: 300, damping: 15 }}
  ```
  After settling, idle bob: `y: [0, -6, 0]` over 2s loop, `repeat: Infinity`. Spring-like, never sharp.

## States

- **Idle / first visit:** full greeting sequence plays. Heart button appears at ~4s mark and pulses gently.
- **Heart tapped (happy path):** heart does a single quick squish (`scale: [1, 1.15, 0.95, 1]` over 250ms), soft chime SFX, then transition out to Screen 3.
- **No tap for 20 seconds:** Melody re-prompts once — "Tap the heart when you're ready." (reuses existing line, no new TTS generation needed). **Does not re-prompt again** — if she walks away, that's fine. No nag loop.
- **Error path:** not applicable (nothing to get wrong).
- **Return user:** Not applicable in Session 1. (Note for later: from Session 2 on, this screen is skipped and she lands directly on the home/session-start screen. Flag for Matt.)
- **Transition out:** Melody waves (ear-wiggle sprite) while background cross-fades to Number Garden scene. Melody's position persists across screens — she's the constant.

## Assets required

- `melody-idle.png` (or sprite) — Melody smiling, neutral pose. **2x and 3x for Retina.** Target 800×800px @2x. ~80 KB PNG or ~20 KB WebP.
- `melody-happy.png` — ear-wiggle pose (ears slightly up/angled). Same dims. ~80 KB.
- `bg-clouds.svg` — cream/pink cloud background. **NEW.** Target <15 KB.
- `heart-button.svg` — pink heart icon, filled. Target <4 KB.
- `sfx-chime-soft.mp3` — soft single chime, 400ms, ~8 KB. Used on heart tap.
- TTS lines 1–4 generated live via Web Speech API. **No audio file needed.** (Optionally: pre-generate + cache for v2 if voice consistency matters.)

## Acceptance criteria

- [ ] Background clouds fade in over 600ms
- [ ] Melody slides in from bottom-left with spring, landing position center
- [ ] Melody's 4 TTS lines play in order with ~400ms gaps, total ~5–6s
- [ ] Ear-wiggle triggers on the word "Hi!"
- [ ] Caption text appears word-by-word in sync with TTS boundary events (or full-line on start if boundaries unavailable)
- [ ] Heart button does NOT appear until line 3 completes
- [ ] Heart button pulses gently after appearing
- [ ] Tapping heart plays chime SFX, animates squish, transitions to Screen 3 within 400ms
- [ ] If no tap occurs for 20s, Melody re-prompts once and only once
- [ ] No text is shown that Melody doesn't also say
- [ ] With Reduce Motion enabled, Melody fades in instead of sliding; no cloud drift; no heart bob
- [ ] Caption text is legible at arm's length (≥28pt)

---

# Screen 3 — Math Exercise (Number Garden: sums to 10)

## Goal
Give Marian one gentle, winnable math problem that matches her diagnosed level (sums to 10). Visual groups carry the concept.

## User state entering this screen
She just tapped the heart. Melody is with her in a new background — garden scene.

## Visual layout

```
+----------------------------------+
|        [safe area top]           |
|                                  |
|  ~ garden background ~           |  <- soft pastel garden
|                                  |
|     ( Melody - idle )            |  <- smaller, upper-left corner
|      +---------------+           |
|      | "How many?"   |           |  <- ribbon, under Melody
|      +---------------+           |
|                                  |
|       3    +    ?                |  <- huge numerals + operator
|                                  |
|    (flower)(flower)(flower)      |  <- 3 visual-group flowers
|         +                        |
|    (flower)(flower)              |  <- 2 visual-group flowers
|       = ?                        |
|                                  |
|   [ 4 ]  [ 5 ]  [ 6 ]           |  <- 3 answer chips, thumb zone
|                                  |
|        [safe area bottom]        |
+----------------------------------+
```

- Background: `bg-garden.svg` — pastel meadow with soft flower shapes, no hard edges.
- Melody: shrinks to ~30% height, upper-left. She's a companion now, not the star.
- Problem: `3 + 2 = ?` rendered as:
  - Symbolic line: `3 + 2` in 96pt numerals
  - Visual line: 3 flower glyphs, plus sign, 2 flower glyphs. Each flower ~64pt.
  - A large `?` under `=` in 96pt
- Answer chips: 3 circular buttons at bottom, 88×88pt each, 32pt between them. **One correct (5), two distractors (4 and 6 — adjacent numbers, the kind of off-by-one errors she made in diagnostic).** Chip order: correct answer in a randomized position.

**Why `3 + 2`:** It was the first problem on her diagnostic and she got it right (fingers, but right). Starting with a win she's already had = psychological safety. Future sessions pull from a weighted pool.

## Copy / TTS script

1. **(0.0s)** "Let's count!" *(as screen enters)*
2. **(1.2s)** "Three... plus two... how many?"

**Word-count check:** `let's, count, three, plus, two, how, many` — 7 unique words. All within cap. (Numbers 0–10 are on the locked allow-list.)

On-screen: `3 + 2 = ?` — symbolic only. No English words for the problem itself.

## Motion

- **Screen entrance:** background cross-fades from clouds → garden over 500ms. Melody shrinks + moves to upper-left corner via `layout` + spring `{ stiffness: 180, damping: 22 }`. Framer Motion `layoutId="melody"` shared between screens = free smooth transition.
- **Problem reveal:** stagger. `3` appears, then `+`, then `2`, then flower groups, then `= ?`. Each item: `initial={{ scale: 0, opacity: 0 }}`, spring `{ stiffness: 300, damping: 18 }`, `delay` offset by 120ms per item. Total reveal ~1s.
- **Flower bounce:** flowers do one subtle `y: [0, -4, 0]` bob when they appear. Feels alive.
- **Answer chips:** appear together, 300ms after problem reveal completes. Spring in from `y: 40, opacity: 0`.
- **Chip hover/press (whileTap):** `scale: 0.92`. No whileHover on iPad (no hover).
- **Correct answer tap:** see Happy Path below.
- **Wrong answer tap:** see Error Path below.

## States

### Idle
Problem displayed, Melody idle, chips waiting.

### Happy path (correct — she taps `5`)
- **Chip animation:** tapped chip scales to 1.15, fills with sparkle yellow (`--sparkle`), then scales back to 1. 400ms total.
- **Sparkles:** 8 small star particles burst from the chip, spring outward with `{ stiffness: 120, damping: 18 }`, fade out over 800ms. (Use `AnimatePresence` with `initial/animate/exit`, keyed particles.)
- **Melody:** sprite swap to ear-wiggle + cheering pose. 600ms, then back to idle.
- **SFX:** soft chime (`sfx-chime-soft.mp3` reused from Screen 2) + gentle sparkle shimmer (`sfx-sparkle.mp3`, ~400ms).
- **TTS:** "Yes! Five." — 2 words, within cap.
- **Caption:** `5` highlights in gold on the problem line, replacing the `?`.
- **Auto-advance:** 1.2s after correct answer, transition to Screen 4.

### Error path (wrong — she taps `4` or `6`)
- **NEVER a red X. NEVER a "wrong" text callout.**
- **Chip animation:** tapped chip does a soft shake (`x: [0, -6, 6, -4, 4, 0]` over 400ms). No color change. Chip remains available.
- **Melody:** sprite swap to puzzled-tilt pose (head tilted ~15°, ears slightly down). Held for 1.5s.
- **SFX:** gentle "poof" (`sfx-poof.mp3` — soft breathy sound, ~500ms, NOT a buzzer).
- **TTS:** "Hmm... try again?" — 3 words, within cap.
- **Caption:** mirrors TTS. After TTS completes, Melody returns to idle. All three chips remain tappable. No counter, no "strike" tracker.
- **After 2 wrong attempts on the same problem:** Melody offers a hint — see below.

### Hint state (after 2 wrong)
- Flower groups gently pulse one group at a time: first the 3-flower group pulses (count emphasized visually), then the 2-flower group. Accompanied by TTS:
  - "Look. Three..." *(3-flower group pulses, each flower scales 1→1.1→1 in sequence, 150ms each)*
  - "...and two more." *(2-flower group pulses same way)*
  - "How many now?"
- Words: `look, three, and, two, more, how, many, now` — 8 unique, all within cap.
- After hint plays, chips remain tappable. If she gets it wrong again, Melody just highlights the correct chip with a shimmer and Melody says "This one is five." — generous, not punitive. We'd rather she learn the pattern than grind.

### Empty / first visit
This IS the first visit. No empty state.

### Transition in / out
- **In:** background cross-fade + Melody layout shift (see Motion).
- **Out (after correct):** problem + chips fade out in reverse stagger (200ms total). Background cross-fades to Screen 4. Melody layoutId persists.

## Assets required

- `melody-idle.png`, `melody-happy.png` — reused from Screen 2.
- `melody-puzzled.png` — puzzled-tilt pose. **NEW.** 800×800 @2x, ~80 KB.
- `bg-garden.svg` — pastel meadow. **NEW.** <20 KB.
- `flower-glyph.svg` — single stylized flower for visual groups. <3 KB. Use `<use>` or React component to render multiples; **do not ship 5 copies of the same SVG.**
- `sparkle-particle.svg` — small 4-point star for celebration bursts. <1 KB.
- Numerals rendered as text in the chosen display font, not as images.
- `sfx-sparkle.mp3` — light shimmer, 400ms, ~6 KB. **NEW.**
- `sfx-poof.mp3` — soft breathy "poof", 500ms, ~8 KB. **NEW.** Must be gentle — no cartoonish "wah wah."
- TTS lines generated live.

## Acceptance criteria

- [ ] Problem `3 + 2 = ?` renders with numerals at 96pt and 5 flower glyphs (3 + 2) as visual groups
- [ ] Three answer chips render at 88×88pt with 32pt gaps, correct answer `5` randomly placed
- [ ] Melody TTS "Let's count! Three plus two, how many?" plays on screen entry
- [ ] Tapping `5` triggers: chip sparkle, Melody ear-wiggle, chime + sparkle SFX, TTS "Yes! Five.", 1.2s auto-advance
- [ ] Tapping `4` or `6` triggers: chip shake (no color change), Melody puzzled-tilt, poof SFX, TTS "Hmm, try again?" — chips remain tappable
- [ ] After 2 wrong attempts, hint state plays: flower groups pulse in sequence with TTS narration
- [ ] After 3 wrong attempts, correct chip shimmers and Melody says "This one is five."
- [ ] No red color appears anywhere on wrong answer
- [ ] No "X" glyph or "wrong" text appears anywhere
- [ ] No wrong-answer counter is displayed
- [ ] All touch targets are ≥60pt in smallest dimension
- [ ] Chips remain tappable during TTS playback (don't lock the UI on audio)

---

# Screen 4 — Literacy Exercise (Word Song: short-o CVC)

## Goal
Give Marian one short-o CVC decoding moment with picture support. Short `o` is the first vowel after her mastered `a`, and the word pairs with a picture so decoding builds vocab.

**Chosen word: `dog`**
- She already read `dog` correctly on the diagnostic → starting win, same principle as the math side.
- Short-o sound — the first new vowel on her learning ladder.
- Universally recognizable picture.
- 3 letters, all consonants/vowels she has mastered sounds for (`d`, `o`, `g`).

## User state entering this screen
She just got a math problem right. Melody cheered. Transition cross-faded from garden to a new scene.

## Visual layout

```
+----------------------------------+
|        [safe area top]           |
|                                  |
|  ~ song scene bg ~               |  <- soft musical-notes bg
|                                  |
|     ( Melody - idle )            |  <- upper-left, same layoutId
|      +---------------+           |
|      | "Read this!"  |           |
|      +---------------+           |
|                                  |
|         [ BIG PICTURE ]          |  <- illustrated dog, 320pt sq
|                                  |
|         d    o    g              |  <- letters, 96pt each, spaced
|                                  |
|   [ speaker icon - tap to hear ] |  <- 72pt round button
|    melody says each sound + blend|
|                                  |
|   [ 🐾 ]     [ ✓ ]              |  <- "again" + "got it" buttons
|                                  |
|        [safe area bottom]        |
+----------------------------------+
```

- Background: `bg-song.svg` — soft wash with 3–4 stylized music notes floating. Pastel, not kindergarten-bright.
- Picture: `pic-dog.svg` or `pic-dog.png` — friendly illustrated dog (not photo; style-consistent with Melody).
- Letters: `d`, `o`, `g` in 96pt, spaced ~48pt apart. Each letter is tappable — tapping it plays that letter's sound alone.
- Speaker button: circular, 72pt, teal accent (`#8EDCE6`). Tapping plays "d... o... g... dog!" (sound-by-sound, then blended).
- Primary actions at bottom:
  - **Again** (paw-print icon, 72pt) — replays the full sound sequence.
  - **Got it** (checkmark icon in soft pink circle, 88pt) — advances. Larger than "Again" because it's the primary path.

**Input model:** passive. She doesn't have to select an answer — this is a **listen + repeat exercise**. Speech recognition is v3. For v1, she just listens, optionally taps letters, and taps "Got it" when she feels ready. We trust her.

## Copy / TTS script

1. **(0.0s on entry)** "Look!" *(picture bounces in)*
2. **(1.0s)** "A dog."
3. **(2.0s)** "D... O... G."  *(each letter highlighted in turn, 600ms between)*
4. **(4.2s)** "Dog!" *(all three letters glow together, picture bounces once)*
5. **(5.5s)** "You try!" *(speaker button gets a hint-pulse)*

**Word-count check:** `look, a, dog, d, o, g, you, try` — 8 unique words. All within cap. Target phonics word `dog` is session-locked.

**On letter tap:** TTS says just that letter's sound — "/d/", "/ŏ/", "/g/". (Phonemes, not letter names. Web Speech API doesn't do phonemes well — **see Open Questions.**)

**On speaker tap:** replays lines 3–4 ("D... O... G... Dog!").

**On "Again" tap:** replays full sequence from line 2.

**On "Got it" tap:** Melody says "Nice!" → advances to Screen 5.

## Motion

- **Entrance:** bg cross-fades, Melody layoutId transitions to upper-left. Picture `initial={{ scale: 0, opacity: 0 }}`, spring `{ stiffness: 260, damping: 16 }` — slight bounce on land. Letters stagger in after picture, 150ms offset each.
- **Letter highlight during line 3:** each letter pulses `scale: [1, 1.2, 1]` over 400ms as its sound plays. Color shifts from `--ink` to `--my-rose` during the pulse, then back.
- **Blend moment (line 4):** all three letters simultaneously scale 1→1.15→1 and picture does a happy bob. Feels like the word "clicks."
- **Speaker hint-pulse:** gentle 2-beat pulse loop (`scale: [1, 1.08, 1]`) when line 5 finishes, stops after first user tap anywhere.
- **Letter tap feedback:** single letter pulses + its sound plays. Other letters stay calm.
- **"Got it" tap:** checkmark scales 1→1.2→0.9→1 with a happy chime, then transition to Screen 5.

## States

### Idle
Picture + letters + speaker + buttons all present. Speaker pulses after intro completes.

### Happy path (she taps "Got it")
- Checkmark animates, chime plays, Melody says "Nice!" (1 word, within cap), screen transitions to Screen 5.

### "Again" path
- Full sequence replays. No limit on replays — she can do it as many times as she wants. This is practice, not a test.

### Letter-tap path
- Single letter sound plays. No "correct/incorrect" judgment — any letter tap is fine. This reinforces sound-letter mapping.

### Error path
- **Not applicable in v1.** This is a listen/absorb exercise with no wrong answer.
- If we later add a decoding check (e.g., "tap the dog"), we'd design an error state then. For Session 1 — no error path.

### Empty / first visit
- Same as Idle. First visit IS the design.

### Transition in / out
- **In:** bg cross-fade, Melody layout shift. Picture + letters stagger in (~1s total before first TTS line).
- **Out:** letters + picture fade out in reverse (200ms), bg cross-fades to Screen 5 (reward).

## Assets required

- `melody-idle.png`, `melody-happy.png` — reused.
- `bg-song.svg` — music-notes wash. **NEW.** <20 KB.
- `pic-dog.svg` or `pic-dog.png` — illustrated dog. **NEW.** 640×640 @2x target, <30 KB.
  - **Note to Thomas via Matt:** if going PNG for style warmth, budget for a future CVC word library — we'll need ~30 CVC-word pictures over time (dog, pot, top, log, fox, etc. through short-o/u/e/i ladder). Flag for v2 asset pipeline.
- `icon-speaker.svg` — simple speaker. <3 KB.
- `icon-paw.svg` — pawprint for "Again" button. <3 KB.
- `icon-check.svg` — checkmark. <2 KB.
- `sfx-chime-soft.mp3`, `sfx-sparkle.mp3` — reused.
- TTS generated live. Per-letter sounds are the risky bit — see Open Questions.

## Acceptance criteria

- [ ] Picture of dog renders at ~320pt square, centered horizontally
- [ ] Letters `d`, `o`, `g` render in 96pt with ~48pt spacing
- [ ] Each letter is tappable and plays that letter's sound when tapped
- [ ] Speaker button plays full sound-out sequence when tapped
- [ ] "Again" button replays full TTS sequence including Melody's intro
- [ ] "Got it" button (at 88pt, larger than "Again") advances to Screen 5
- [ ] During intro playback, letters highlight in sequence (`d` then `o` then `g`, then all three at blend)
- [ ] No "wrong answer" state exists on this screen
- [ ] All touch targets ≥60pt
- [ ] Speaker hint-pulse stops after any user interaction
- [ ] With Reduce Motion on, letter highlights are color-only (no scale pulse), picture fades in without bounce

---

# Screen 5 — Reward + End-of-Session Teaser

## Goal
End on a high note. Give Marian **stardust** (reward) + show her something she can look forward to tomorrow. No pressure, no streak, no "don't break your streak" copy.

## User state entering this screen
She completed one math problem and one literacy moment. ~3–4 minutes in.

## Visual layout

```
+----------------------------------+
|        [safe area top]           |
|                                  |
|  ~ night sky + stars bg ~        |  <- cream → soft twilight
|                                  |
|                                  |
|     ( Melody - cheering )        |  <- centered, 50% viewport h
|                                  |
|   ✨  ✨  ✨  ✨  ✨               |  <- stardust particles, drift
|                                  |
|    +------------------------+    |
|    | "You did it!"          |    |  <- ribbon caption
|    +------------------------+    |
|                                  |
|    [   ★ ★ ★  stardust jar  ]   |  <- visual jar fills with 3 ★
|                                  |
|     ~ soft "next time..." teaser |  <- fades in at end
|                                  |
|      [ home icon ]               |  <- single exit, 72pt
|                                  |
|        [safe area bottom]        |
+----------------------------------+
```

- Background: transitions from garden → soft twilight (cream + pink + pale lavender). Subtle stars fade in.
- Melody: centered, cheering pose (ears up, arms if rigged / hands up). Larger than on problem screens.
- **Stardust jar:** visual glass jar with 3 star icons dropping in one at a time. Each star represents a completed moment (greeting, math, literacy = 3). **No score, no point total, no percentage.**
- **Teaser:** a small "Tomorrow: [silhouette of a short-o friend]" teaser card — e.g., a fox silhouette for short-o word `fox`. Gentle, not a cliffhanger. Fades in after the main celebration.
- **Exit:** single home icon button. Tapping it closes the PWA gracefully (or returns to home/splash state — **see Open Questions** re: what "home" means for a single-user PWA).

## Copy / TTS script

1. **(0.0s)** "You did it!" *(Melody cheers, first star drops)*
2. **(1.2s)** "One..." *(star 2 drops)*
3. **(1.8s)** "Two..." *(star 3 drops)*
4. **(2.4s)** "Three stars!" *(all three glow)*
5. **(4.0s)** "See you next time." *(teaser fades in with soft silhouette)*
6. **(5.5s)** "Bye for now!" *(Melody waves)*

**Word-count check:** `you, did, it, one, two, three, stars, see, next, time, bye, for, now` — 13 unique words. All within cap.

**On "Home" tap:** no TTS — just a soft chime, fade to splash/closed state.

## Motion

- **Entrance:** background cross-fades from song scene to twilight over 600ms. Melody grows in size via spring `{ stiffness: 180, damping: 20 }`. (Uses `layoutId="melody"`.)
- **Stardust particle burst:** 20–30 small `sparkle-particle.svg` elements emit from Melody's position, spring outward to random positions, then slowly drift up and fade over 3s. Use `AnimatePresence` with keyed particles. Stagger emission over 400ms for organic feel.
- **Stars into jar:** each star `initial={{ y: -80, opacity: 0, scale: 0.5 }}`, animates to its jar slot position with spring `{ stiffness: 200, damping: 18 }`. 600ms apart. Each landing triggers a soft "plink" SFX.
- **All-three-stars glow:** when star 3 lands, all three get a shared glow pulse (`boxShadow` or `filter: drop-shadow` animation) for 800ms.
- **Teaser card:** fades in from below (`y: 20 → 0`, opacity 0→1) with spring, 400ms, at line 5.
- **Melody wave:** sprite swap to ear-wiggle on "Bye for now!" — same asset as happy.
- **Home button:** appears last, 500ms after final line, gentle scale-in.

## States

### Happy path (default — she sees this screen)
As described.

### "Home" tap
- Chime SFX, 300ms fade to black or back to splash. PWA can't programmatically close itself on iOS — we either return to splash state (clean) or show a static "Come back soon!" screen with Melody sleeping. **Recommend: return to splash state** so the next launch starts fresh.

### Error path
Not applicable — no inputs to get wrong.

### Empty / first visit
This IS first visit. Only Session 1 shows 3 stars from 3 moments; future sessions will show more and the jar visual scales accordingly — out of scope for this spec.

### Transition in / out
- **In:** song-scene → twilight cross-fade. Melody grows + re-centers.
- **Out:** on home tap, fade to splash cream bg over 300ms.

## Assets required

- `melody-cheering.png` — ears way up, happy. **NEW.** 800×800 @2x, ~80 KB.
- `melody-sleepy.png` — eyes closed, slight smile. **NEW** but **deferred** — not used in Session 1 happy path. Build in parallel for the "Come back soon!" post-home state. Out of scope for this spec's AC.
- `bg-twilight.svg` — cream/pink/lavender wash with subtle stars. **NEW.** <25 KB.
- `sparkle-particle.svg` — reused from Screen 3.
- `star-filled.svg` — filled gold star for jar. <2 KB.
- `jar.svg` — glass jar outline. <4 KB.
- `silhouette-fox.svg` — soft silhouette of a fox (teaser for tomorrow's short-o word). <3 KB. (Or whatever the next word's subject is — picking `fox` because it's the obvious short-o picture follow-up to `dog`.)
- `icon-home.svg` — house icon. <3 KB.
- `sfx-plink.mp3` — soft star-drop sound, 300ms, ~5 KB. **NEW.**
- `sfx-cheer.mp3` — soft "ta-da" chord, 800ms, ~12 KB. **NEW.** Must be gentle, not a game-show fanfare.

## Acceptance criteria

- [ ] Background cross-fades from song-scene to twilight over 600ms
- [ ] Melody appears in cheering pose, scaled larger than on problem screens
- [ ] 3 stardust particles burst from Melody's position
- [ ] 3 stars drop into the jar, one per TTS line ("One... Two... Three stars!")
- [ ] Each star-landing plays a "plink" SFX
- [ ] When star 3 lands, all three glow together
- [ ] Teaser card fades in at ~4s with fox silhouette and "See you next time." TTS
- [ ] Home button appears last and is clearly the only forward action
- [ ] Tapping Home plays chime + fades to splash state
- [ ] No numeric score, XP counter, percentage, streak, or "keep your streak!" copy appears
- [ ] No "share" or social prompt appears
- [ ] No "watch ad" or monetization UI appears (this should be true everywhere but worth stating)
- [ ] With Reduce Motion on: particles don't drift (static), stars fade in instead of dropping, Melody doesn't scale

---

## Anti-dark-pattern audit (whole session)

Per the non-negotiables, confirmed absent from this spec:

- [x] No variable-ratio reward — every correct answer gets the same consistent sparkle + chime. Every session ends with stars equal to exercises completed. Predictable.
- [x] No streak shame — no streak UI exists in Session 1. (Longer-term: if we add streaks, they must never show a broken streak as "loss." Flag for later design.)
- [x] No fake urgency — "See you next time" is warm, not "Come back in 23 hours or lose your streak!"
- [x] No social pressure — no friends, leaderboards, share buttons.
- [x] No infinite content — the session has a definite end; no "one more!" loops.
- [x] No dark patterns on exit — home button is prominent and never hidden, no confirmation dialog on exit.
- [x] No surprise costs — this is a family-local PWA, no IAP, but confirmed the UI has no currency-buy affordances either.
- [x] Wrong answers are never punished — unlimited retries, graceful hints, correct answer shown generously after 3 tries.

---

## Full asset enumeration (deduplicated, with sizes/formats)

### Character expressions (Melody)
| Asset | Use | Size target | Format | Reuse across session |
|---|---|---|---|---|
| `melody-idle.png` | Default / neutral | 800×800 @2x, ~80 KB | PNG (WebP fallback) | S2, S3, S4 |
| `melody-happy.png` | Ear-wiggle / correct / wave | 800×800 @2x, ~80 KB | PNG | S2, S3, S5 |
| `melody-puzzled.png` | Wrong answer, gentle tilt | 800×800 @2x, ~80 KB | PNG | S3 |
| `melody-cheering.png` | End-of-session celebration | 800×800 @2x, ~80 KB | PNG | S5 |
| `melody-sleepy.png` (**deferred to post-Session-1**) | Post-exit / return screen | 800×800 @2x, ~80 KB | PNG | — |

**Note:** sprites only needed if animating between states with CSS/sprite sheet. If each expression is a separate image swapped via React state + `AnimatePresence` cross-fade, no sprite system required. **Recommend: separate images, cross-fade in AnimatePresence — simpler to ship.**

### Backgrounds (3 total in Session 1, per constraint)
| Asset | Use | Size target | Format |
|---|---|---|---|
| `bg-clouds.svg` | Screen 2 — greeting | <15 KB | SVG |
| `bg-garden.svg` | Screen 3 — math (Number Garden) | <20 KB | SVG |
| `bg-song.svg` | Screen 4 — literacy (Word Song) | <20 KB | SVG |
| `bg-twilight.svg` | Screen 5 — reward | <25 KB | SVG |

**Background count: 4.** This exceeds the "3 backgrounds v1" budget from CLAUDE.md by one. **Flag for Thomas:** either we fold twilight into clouds (share assets, just change tint via CSS filter), or accept 4. Recommendation: share `bg-clouds.svg` base and apply CSS `filter: hue-rotate()` + `opacity` layer for twilight. Saves a background and keeps us at 3 distinct assets. See Open Questions.

### Icons / UI glyphs
| Asset | Use | Size | Format |
|---|---|---|---|
| `melody-logo.svg` | Splash wordmark + heart logo | <8 KB | SVG |
| `heart-button.svg` | Primary CTA on greeting | <4 KB | SVG |
| `flower-glyph.svg` | Math visual groups | <3 KB | SVG |
| `sparkle-particle.svg` | Celebration bursts | <1 KB | SVG |
| `pic-dog.svg` or `.png` | Literacy picture | <30 KB | SVG or PNG |
| `icon-speaker.svg` | Speaker button | <3 KB | SVG |
| `icon-paw.svg` | "Again" button | <3 KB | SVG |
| `icon-check.svg` | "Got it" button | <2 KB | SVG |
| `star-filled.svg` | Jar stars | <2 KB | SVG |
| `jar.svg` | Stardust jar | <4 KB | SVG |
| `silhouette-fox.svg` | Tomorrow teaser | <3 KB | SVG |
| `icon-home.svg` | End-screen exit | <3 KB | SVG |

### Sound effects
| Asset | Use | Duration | Size |
|---|---|---|---|
| `sfx-chime-soft.mp3` | Heart tap, got-it tap, home tap | 400ms | ~8 KB |
| `sfx-sparkle.mp3` | Correct answer celebration | 400ms | ~6 KB |
| `sfx-poof.mp3` | Wrong answer gentle response | 500ms | ~8 KB |
| `sfx-plink.mp3` | Star dropping into jar | 300ms | ~5 KB |
| `sfx-cheer.mp3` | End-of-session ta-da | 800ms | ~12 KB |

**Total SFX payload: ~39 KB.** Preload at boot via Howler.

### TTS
- Generated live via Web Speech API. No audio asset files required for v1.
- Voice preference: `en-US` female-leaning (queried from `speechSynthesis.getVoices()`, preferred list: "Samantha", "Allison", "Ava"). Fallback: first `en-US` voice with `gender === 'female'` or default if not available.
- Rate: 0.9. Pitch: 1.1. Volume: 1.0.

---

## Vocabulary check (whole session, deduplicated)

All words Melody says in Session 1:

> a, and, bye, count, d, did, dog, for, g, happy (internal, not spoken), heart, hi, how, hmm, i'm, it, it's, let's, look, many, meet, melody, more, next, nice, now, o, one, plus, ready, see, so, stars, tap, the, three, time, to, try, two, when, yes, you, you're, you try

Unique count: **~40 words**, well within the 200-word cap.

**Potentially out-of-cap / flagged words** (asking for Thomas via Matt):
- **None** — all words used are standard common-English kid vocabulary.

**Phonemes (letter sounds)** — `/d/`, `/ŏ/`, `/g/` — not words but flagged separately: Web Speech API can't cleanly produce phonemes. See Open Questions.

---

## Open questions (need Thomas via Matt)

1. **Phonemes vs letter names.** Web Speech API cannot reliably produce isolated phonemes like `/ŏ/` or `/d/` — it says letter names or struggles. Options:
   - **(a)** Pre-record phoneme audio files (one-time voice cost, highest quality)
   - **(b)** Use letter names for v1 and accept a pedagogical compromise on Screen 4
   - **(c)** Use ElevenLabs phoneme tags early (was scoped for v2)
   - **Recommendation:** (a) — 26 phoneme audio files, maybe 4 KB each = ~100 KB total. Worth it; phonics is the whole point of Word Song. Needs Thomas sign-off on the time/budget.

2. **Background count: 3 or 4?** CLAUDE.md says 3 backgrounds v1. I've specified 4 (clouds, garden, song, twilight). Proposal: merge clouds+twilight via CSS filter on the same base SVG → effective count 3 distinct assets. Confirm this is acceptable, or drop twilight and reuse clouds with a warmer tint for Screen 5.

3. **"Home" tap behavior on iPad PWA.** iOS doesn't let a PWA close itself. Options:
   - Return to splash/neutral state (recommended, clean)
   - Show a "Come back soon!" static screen with `melody-sleepy` (requires the deferred asset)
   - Do nothing (just a "quiet" state — she can close via iPad gesture)
   - **Recommendation:** return to splash. Simple, predictable.

4. **Math distractor choice.** I chose `4` and `6` as off-by-one distractors because her diagnostic showed finger-counting off-by-one errors. Is targeting her specific error pattern on the *first ever* problem feeling like a trap, or the right teaching move? Could alternatively use `3` and `10` — more obviously wrong, lower chance of real confusion. Preference?

5. **TTS voice stability.** iPad's Web Speech voices can differ between updates. For Session 1 we accept whatever's available, but longer-term Melody's voice identity matters a lot for bonding. When do we move to pre-recorded / ElevenLabs? (Non-blocking for Session 1; flagging so it's on the roadmap.)

6. **Return-user flow on Screen 2.** From Session 2 onward, Melody *will* know Marian. The greeting copy/flow changes. That's a separate spec. Confirming this ticket is Session 1 only, and Matt will open a follow-up for returning-user greeting.

7. **PWA install moment.** This spec covers what happens *after* install. The install prompt / "Add to Home Screen" instruction flow is a separate ticket per the AC ("first-run flow only"). Flagging so we don't drop it. Recommendation: a 1-screen pre-install instructional card (iPad-specific: "Tap share → Add to Home Screen") delivered once from the Vercel URL before home-screen launch ever happens.

8. **Reduced data mode / slow network.** Splash has a 3000ms cold-cache cap. If assets genuinely can't load (e.g., first launch ever, no network), what's the fallback? Recommendation: ship Melody idle + one background as inline SVGs in the initial HTML so we always have *something* to show. Confirm this is acceptable bundle cost.

---

## Implementation notes for Kevin & Devon

- **Framer Motion setup:** wrap `<App>` in `<LazyMotion features={domAnimation}>` + `<MotionConfig reducedMotion="user">`. Use `<m.div>` everywhere, NOT `<motion.div>`, to stay in the 4.6 KB budget.
- **Shared Melody element across screens:** use `layoutId="melody"` on Melody's wrapper in Screens 2–5 so her position transitions animate for free. Keep her in a single component that re-parents via React state, not unmount/remount.
- **AnimatePresence gotcha:** AnimatePresence must wrap the conditional, not be wrapped by it. Applies to particles, transitions between screens, and the teaser card.
- **Caption word reveal:** use the `SpeechSynthesisUtterance.onboundary` event. If it doesn't fire (Safari sometimes skips it), fall back to `onstart` + full text reveal. Don't block on boundaries.
- **Preload SFX on boot:** `Howl` instances for all 5 SFX created at app init, not on-demand (first-tap latency kills the feel).
- **No animations on Melody's mouth/eyes in v1.** Just pose swaps. Real facial animation is out of scope.
- **Touch target debug overlay:** add a dev-only overlay toggle that draws 60×60pt bounding boxes around every tappable element, so Jessica can verify sizing visually.

---

## Out of scope for this spec (for Matt's backlog)

- Returning-user greeting (Session 2+)
- PWA install instruction flow (pre-install)
- Session mid-length (6–8 problems vs Session 1's 2 problems)
- Dark mode / night mode
- Parental dashboard
- Voice recording for phonics (v3)
- Multi-user (siblings)
- Any art direction beyond asset list — final art is ticket 86c9gkm42
