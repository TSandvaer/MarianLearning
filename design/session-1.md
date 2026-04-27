# Session 1 — First-Run Walkthrough

**Audience:** Kevin + Devon (implementers), Jessica (QA)
**Author:** Kyle (UX)
**Surface:** iPad portrait PWA, home-screen installed
**Scope:** First-ever session — splash → greet → 1 math problem → 1 literacy problem → reward/teaser
**Session length target:** 4–6 minutes (first-run only; later sessions run the full 10–15 min)

> **Updated 2026-04-25** with Thomas decisions on Q1 / Q2 / Q4 (phoneme audio budget, CSS-filter twilight, gentle-ramp distractors). Original Q3 / Q5 / Q6 / Q7 / Q8 remain as non-blocking TODOs at the bottom.
>
> **Updated 2026-04-25 (Kyle, ticket `86c9gp99a`)** to resolve the iPad Safari TTS gesture-gate bug. Greet now requires a single tap-anywhere to wake Melody up; Splash retains its no-skip behavior. See **Foundational Decisions → iPad Safari audio constraint** below and the rewritten Screen 2 entry/intro states.

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
- **TTS captions:** every Melody line is mirrored as on-screen text in a speech-ribbon below/beside her, **revealed word-by-word synced to TTS `boundary` events** (passive reading exposure). If `boundary` events don't fire (Safari quirk — common on iPad, our primary device), fall back to a **synthetic word-paced reveal at configurable WPM** (default 165, derived from Melody's `rate: 0.9`). See implementation notes for full fallback contract.
- **No red X, ever.** Wrong answers trigger puzzled-tilt + "poof" SFX + retry — see Error Path in each exercise screen.
- **No streak/XP counter is visible in Session 1.** First-run is about meeting Melody, not earning points.
- **iPad Safari audio constraint (read this before designing any screen with TTS).** iPad Safari blocks `speechSynthesis.speak()` and any new `Audio` / `Howl` playback until the current execution context has received a user gesture (tap, touchend, click, keydown). The unlock is **per-app-session**, not per-utterance — once any user gesture has run synchronously alongside an audio call, the context stays unlocked for the rest of the session. **Implication for design:** every session must contain a gesture before its first audio cue. Session 1 places that gesture on Screen 2 (see **Screen 2 → Wake state**). Future surfaces (Math, Word Song, Reward, returning-user greeting) inherit the unlocked context for the rest of the session and do not need their own gate. **Caveat for long-idle sessions:** if Marian backgrounds the PWA and returns after the OS has aggressively suspended audio (observed on iPadOS after >~5 min background), the context may relock. Treat the next screen mount as a soft re-gate: if `speechSynthesis.speak()` returns without firing `onstart` within 250ms, surface the same "tap Melody to wake her up" affordance used on Screen 2 in-place. Implementation contract for Kevin/Devon under Implementation Notes.

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
- **First visit (cold cache):** if critical assets (Melody's idle expression SVG, intro TTS audio if pre-generated) aren't ready at 1500ms, extend splash up to **3000ms max**, then force-advance even if assets are mid-load (show Melody's idle frame even if her happy/puzzled expression assets haven't loaded yet).
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

Splash just faded. She's seen the Melody wordmark. Cream background is already present from Screen 1. **Audio context is locked** (no user gesture has occurred yet) — Melody cannot speak until Marian taps. See Wake state below.

## Visual layout

```
WAKE STATE (pre-tap, audio locked)         INTRO STATE (post-tap, audio unlocked)
+----------------------------------+       +----------------------------------+
|        [safe area top]           |       |        [safe area top]           |
|                                  |       |                                  |
|         ~ sky pattern ~          |       |         ~ sky pattern ~          |
|                                  |       |                                  |
|        ( ( Melody - idle ) )     |       |      ( Melody - idle / smile )   |
|         soft pink ready ring     |       |                                  |
|         pulses around her        |       |   +-------------------------+    |
|                                  |       |   |  "Hi! I'm Melody."      |    |
|         (entire viewport         |       |   |  (captions mirror TTS)  |    |
|          is the tap target)      |       |   +-------------------------+    |
|                                  |       |                                  |
|                                  |       |        [ PINK HEART BUTTON ]     |
|                                  |       |         (appears at line 3)      |
|                                  |       |                                  |
|        [safe area bottom]        |       |        [safe area bottom]        |
+----------------------------------+       +----------------------------------+
```

- Background: `bg-clouds.svg` — soft cream-to-pink wash with 3 stylized clouds, fades in over 600ms.
- Melody: centered horizontally, fills ~60% of viewport height, bottom-aligned to speech ribbon.
- Speech ribbon: white rounded rect (`border-radius: 24pt`), 88% viewport width, 16pt pink border, soft shadow. Centered under Melody. **Hidden during Wake state.**
- Primary CTA: giant pink heart button, 88pt tall × 120pt wide, centered in bottom thumb zone (bottom 20% of viewport). Icon-only — **no text label.** Melody tells her what it does via TTS. **Hidden during Wake state.**
- **Ready ring (Wake state only):** a soft pink concentric ring (`--my-pink` at 40% alpha, 6pt stroke) drawn around Melody's silhouette, ~24pt outside her bounding circle. Pulses opacity 0.4 → 0.9 → 0.4 over 1.4s, `repeat: Infinity`. Purely visual cue that Melody is "waiting to be greeted." Disappears the instant a tap is detected. **The ring itself is not the touch target** — see below.
- **Wake-state tap target:** the _entire viewport_ (full safe-area rect, behind everything else) is a transparent tap surface. Any tap anywhere unlocks audio and starts the intro sequence. No icon affordance required because the full screen is hot — and Melody being visibly idle + the ready ring carry the "I'm waiting for you" read. Rationale under Open Questions / Foundational Decisions.

## Copy / TTS script

**Wake state (pre-tap):** silent. Melody is on-screen idle with the ready ring; no TTS, no SFX. **Do not call `speak()` here** — iPad Safari will silently reject it and the line will be lost.

**Intro state (post-tap):** Melody speaks the lines below. `t = 0.0s` is **the moment of the unlocking tap.** Lines separated by ~400ms natural pauses.

1. **(0.0s)** "Hi!" _(ear-wiggle cue on this word; fired in the same synchronous tap handler that unlocks audio — see Implementation Notes)_
2. **(0.8s)** "I'm Melody."
3. **(2.2s)** "It's so nice to meet you."
4. **(4.0s)** "Tap the heart when you're ready."

**Word-count check (against 200-word cap):** `hi, i'm, melody, it's, so, nice, to, meet, you, tap, the, heart, when, you're, ready` — 15 unique words. All within cap. "Melody" is the character name (always allowed).

On-screen text: exact TTS transcript, revealed word-by-word in the speech ribbon. Ribbon does not appear until line 1 starts.

## Motion

- **Clouds bg:** fades in 0→1 opacity over 600ms, `ease: "easeOut"`. Very subtle horizontal drift (`x: [0, 10, 0]` over 20s, `repeat: Infinity`) — slow enough to feel alive, not frantic. Disabled if `prefers-reduced-motion`.
- **Melody entrance (Wake state, on screen mount):** slides in from off-screen bottom-left.
  ```
  initial={{ x: -120, y: 60, opacity: 0 }}
  animate={{ x: 0, y: 0, opacity: 1 }}
  transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.3 }}
  ```
  Total entrance ~700ms. Spring settles without bounce-past (damping 22 keeps it calm, not cartoonish). She lands in idle pose and **breathes**: `scale: [1, 1.05, 1]` over 2.4s, `repeat: Infinity`, `ease: "easeInOut"`. Reads as clearly alive at iPad viewport scale — earlier draft used `1.015` which Dave's consult flagged as too subtle to perceive (would read as frozen by 4–5s on a child's first look).
- **Ready ring (Wake state):** scales in 0.9 → 1 + opacity 0 → 0.4 with 200ms ease-out, **starting at +900ms** (after Melody settles). Then opacity-pulses 0.4 → 0.9 → 0.4 over 1.4s, `repeat: Infinity`. Disabled if `prefers-reduced-motion` (held at static 0.5 opacity).
- **Wake → Intro transition (on first tap):** ring scales out + fades over 250ms; same tap synchronously dispatches `speak(line1)` (see Implementation Notes for the exact handler shape). Melody's breathing loop continues uninterrupted.
- **Ear-wiggle** on "Hi!" word boundary: expression swap `melody-idle.svg` → `melody-happy.svg` for 600ms, then back. Cross-faded via Framer Motion `AnimatePresence` (200ms opacity overlap), matching the locked pattern from session-1.md §Assets footnote and screen-3-math.md:257.
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

- **Wake (pre-tap, audio locked):** Melody is on-screen in idle pose, breathing. Ready ring pulses around her. Speech ribbon hidden. Heart button hidden. No TTS, no SFX. Full viewport is a transparent tap target.
- **Wake re-prompt (no tap for 8s):** A small finger-tap icon (48pt, `--my-rose` fill, `--ink` outline) fades in centered on the ready ring (`opacity: 0 → 1` over 300ms) and pulses once (`scale: 1 → 1.1 → 1` over 600ms). Simultaneously, Melody plays a single ear-wiggle wave (expression swap to `melody-happy.svg` for 600ms via `AnimatePresence` cross-fade, then back to idle). Icon fades out 2.5s after pulse completes (`opacity: 1 → 0` over 400ms). Ring continues pulsing. **No TTS** (still locked). This is the _only_ re-prompt; the screen sits indefinitely without further prompts. Rationale (Dave's 2026-04-25 consult, citations in PR #15 history): research-backed sustained-attention ranges put 8s at the upper bound for an 8-year-old's "screen is alive" tolerance on a low-arousal screen. The ear-wiggle communicates "I'm alive"; the finger-tap icon communicates "tap here" — both are needed because, alone, neither does the affordance work for a low-literacy child. One nudge, then patience — no nag loop.
- **Intro (post-tap, audio unlocked):** full greeting sequence plays. Heart button appears at ~4s mark (after line 3 completes) and pulses gently.
- **Heart tapped (happy path):** heart does a single quick squish (`scale: [1, 1.15, 0.95, 1]` over 250ms), soft chime SFX, then transition out to Screen 3.
- **No heart tap for 20 seconds (post-intro, after line 4 finishes):** Melody re-prompts once — "Tap the heart when you're ready." (reuses existing line, no new TTS generation needed). **Does not re-prompt again** — if she walks away, that's fine. No nag loop. **This timer is independent of the Wake re-prompt timer; it starts only after line 4 completes.**
- **Error path:** not applicable (nothing to get wrong).
- **Return user:** Not applicable in Session 1. (Note for later: from Session 2 on, this screen is skipped and she lands directly on the home/session-start screen. Flag for Matt. **The audio-unlock gesture still has to happen somewhere on the new entry screen** — Session 2+ greeting design needs to inherit this constraint.)
- **Transition out:** Melody waves (ear-wiggle expression — `melody-happy.svg`) while background cross-fades to Number Garden scene. Melody's position persists across screens — she's the constant.

## Assets required

- `melody-idle.svg` — Melody smiling, neutral pose. Vector — scales infinitely; no @2x/@3x raster needed. ~6 KB on disk (PR #16/#10).
- `melody-happy.svg` — ear-wiggle pose (ears slightly up/angled). ~6 KB. **Reused for the Wake re-prompt wave at 8s.**
- `icon-finger-tap.svg` — **NEW.** Small finger-tap icon used in the Wake re-prompt. ~2 KB target. Soft-pink fill (`--my-rose`) on `--ink` outline, child-friendly proportions (rounded fingertip, no realistic detailing). Designed to read at 48pt on iPad viewport. May ship inline in the Greet component instead of as a standalone file if Devon prefers — visual outcome is identical. Author: Kyle (or Devon if inline).
- `bg-clouds.svg` — cream/pink cloud background. **NEW.** Target <15 KB.
- `heart-button.svg` — pink heart icon, filled. Target <4 KB.
- **Ready ring** — render as a pure CSS/SVG element inline (concentric circle, `--my-pink` 40% alpha, 6pt stroke, no fill). **No asset file needed**; this is a one-line component. Documenting here so it doesn't get forgotten in implementation. If it ends up wanting heart/flower garnish (e.g., 3 small hearts orbiting the ring), that's an added asset request — flag in PR review and route to ticket `86c9gp979` (Melody character asset redo) so it lands in the same bundle Thomas is reviewing. **Default for Session 1: plain ring, no garnish.**
- `sfx-chime-soft.mp3` — soft single chime, 400ms, ~8 KB. Used on heart tap.
- TTS lines 1–4 generated live via Web Speech API. **No audio file needed.** (Optionally: pre-generate + cache for v2 if voice consistency matters.) **Critical:** line 1's `speak()` call must be synchronous within the tap handler that unlocks audio — see Implementation Notes.

## Acceptance criteria

- [ ] Background clouds fade in over 600ms
- [ ] Melody slides in from bottom-left with spring, landing position center, then enters a subtle breathing loop
- [ ] **Wake state:** ready ring appears around Melody at +900ms after mount and pulses 0.4 → 0.9 → 0.4 over 1.4s on infinite loop
- [ ] **Wake state:** no TTS is queued or attempted; `speechSynthesis.speak()` is NOT called before the user tap. Verify by inspecting the speech-synthesis queue — it must be empty until first tap
- [ ] **Wake state:** the entire viewport (within safe-area insets) is a single tap target; tapping any pixel transitions to Intro state
- [ ] **Wake re-prompt:** at 8s of no tap, a finger-tap icon (48pt, `--my-rose` fill, `--ink` outline) fades in centered on the ready ring (`opacity: 0 → 1` over 300ms), pulses once (`scale: 1 → 1.1 → 1` over 600ms), then fades out 2.5s later (`opacity: 1 → 0` over 400ms). Simultaneously Melody plays a single ear-wiggle wave (expression swap to `melody-happy.svg` via `AnimatePresence` cross-fade for 600ms). Triggers exactly once. No TTS during this re-prompt
- [ ] **Wake state tap target is full viewport:** taps register on any pixel inside the safe-area rect — Melody, ring, icon, blank cream space all behave identically as the gesture-unlock trigger
- [ ] **Wake → Intro transition:** the same synchronous tap handler that unlocks audio also calls `speechSynthesis.speak(line1Utterance)`. Confirm via `onstart` firing within 250ms of the tap event on iPad Safari
- [ ] **Intro state:** ring fades out over 250ms, speech ribbon scales in, Melody's 4 TTS lines play in order with ~400ms gaps, total ~5–6s from tap
- [ ] Ear-wiggle triggers on the word "Hi!"
- [ ] Caption text appears word-by-word in sync with TTS boundary events; if boundary events do not fire, falls back to synthetic word-paced reveal at the configured WPM (default 165), still word-by-word
- [ ] Heart button does NOT appear until line 3 completes
- [ ] Heart button pulses gently after appearing
- [ ] Tapping heart plays chime SFX, animates squish, transitions to Screen 3 within 400ms
- [ ] If no heart tap occurs for 20s **after line 4 completes**, Melody re-prompts once and only once with line 4's text. The 20s timer starts at line-4-end, not at screen mount
- [ ] No text is shown that Melody doesn't also say
- [ ] With Reduce Motion enabled, Melody fades in instead of sliding; no cloud drift; no heart bob; ready ring is held at static 0.5 opacity (no pulse)
- [ ] Caption text is legible at arm's length (≥28pt)
- [ ] **Verified on iPad Safari (deployed PWA install):** Melody's first TTS line ("Hi!") fires audibly within 250ms of the user's first tap. No silent rejection. No empty-caption-ribbon failure mode

---

# Screen 3 — Math Exercise (Number Garden: sums to 10)

> **Note:** Session 1 contains _one_ math problem (`3 + 2 = ?`) as part of the first-run
> walkthrough. The full Math screen — 8 problems, stardust HUD, streak indicator, distractor
> rule, Path A audio integration — is specified standalone in
> [`design/screen-3-math.md`](./screen-3-math.md). From Session 2 onward, that file is canonical;
> this section covers only the first-run subset. Implementation ticket: `86c9grn33`.

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
|   [ 3 ]  [ 5 ]  [ 10 ]          |  <- 3 answer chips, thumb zone
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
- Answer chips: 3 circular buttons at bottom, 88×88pt each, 32pt between them. **One correct (5), two distractors (3 and 10 — clearly wrong, no off-by-one bait).** Chip order: correct answer in a randomized position.

**Why `3 + 2`:** It was the first problem on her diagnostic and she got it right (fingers, but right). Starting with a win she's already had = psychological safety. Future sessions pull from a weighted pool.

**Why distractors `3` and `10` on the very first problem (gentle ramp):** Her April 2026 diagnostic flagged off-by-one finger-counting miscounts (4/6-style), so adjacent-number distractors are pedagogically useful — but using them on her _debut_ problem risks a sour first impression. Per Thomas (2026-04-25): problem #1 uses the gentle ramp (`3`, `10` — clearly wrong, low confusion), and the off-by-one trap distractors (`4`/`6`-style) **start at problem #3** once she's banked two wins. Out of scope for this spec since Session 1 only contains one math problem; flagged here so the session-generator code follows the same rule from Session 2 onward.

## Copy / TTS script

1. **(0.0s)** "Let's count!" _(as screen enters)_
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
- **Melody:** expression swap to ear-wiggle + cheering pose (`melody-happy.svg`) via `AnimatePresence` cross-fade. 600ms, then back to idle.
- **SFX:** soft chime (`sfx-chime-soft.mp3` reused from Screen 2) + gentle sparkle shimmer (`sfx-sparkle.mp3`, ~400ms).
- **TTS:** "Yes! Five." — 2 words, within cap.
- **Caption:** `5` highlights in gold on the problem line, replacing the `?`.
- **Auto-advance:** 1.2s after correct answer, transition to Screen 4.

### Error path (wrong — she taps `3` or `10`)

- **NEVER a red X. NEVER a "wrong" text callout.**
- **Chip animation:** tapped chip does a soft shake (`x: [0, -6, 6, -4, 4, 0]` over 400ms). No color change. Chip remains available.
- **Melody:** expression swap to puzzled-tilt pose (`melody-puzzled.svg` — head tilted ~15°, ears slightly down) via `AnimatePresence` cross-fade. Held for 1.5s.
- **SFX:** gentle "poof" (`sfx-poof.mp3` — soft breathy sound, ~500ms, NOT a buzzer).
- **TTS:** "Hmm... try again?" — 3 words, within cap.
- **Caption:** mirrors TTS. After TTS completes, Melody returns to idle. All three chips remain tappable. No counter, no "strike" tracker.
- **After 2 wrong attempts on the same problem:** Melody offers a hint — see below.

### Hint state (after 2 wrong)

- Flower groups gently pulse one group at a time: first the 3-flower group pulses (count emphasized visually), then the 2-flower group. Accompanied by TTS:
  - "Look. Three..." _(3-flower group pulses, each flower scales 1→1.1→1 in sequence, 150ms each)_
  - "...and two more." _(2-flower group pulses same way)_
  - "How many now?"
- Words: `look, three, and, two, more, how, many, now` — 8 unique, all within cap.
- After hint plays, chips remain tappable. If she gets it wrong again, Melody just highlights the correct chip with a shimmer and Melody says "This one is five." — generous, not punitive. We'd rather she learn the pattern than grind.

### Empty / first visit

This IS the first visit. No empty state.

### Transition in / out

- **In:** background cross-fade + Melody layout shift (see Motion).
- **Out (after correct):** problem + chips fade out in reverse stagger (200ms total). Background cross-fades to Screen 4. Melody layoutId persists.

## Assets required

- `melody-idle.svg`, `melody-happy.svg` — reused from Screen 2.
- `melody-puzzled.svg` — puzzled-tilt pose. **NEW.** Vector; ~6 KB on disk.
- `bg-garden.svg` — pastel meadow. **NEW.** <20 KB.
- `flower-glyph.svg` — single stylized flower for visual groups. <3 KB. Use `<use>` or React component to render multiples; **do not ship 5 copies of the same SVG.**
- `sparkle-particle.svg` — small 4-point star for celebration bursts. <1 KB.
- Numerals rendered as text in the chosen display font, not as images.
- `sfx-sparkle.mp3` — light shimmer, 400ms, ~6 KB. **NEW.**
- `sfx-poof.mp3` — soft breathy "poof", 500ms, ~8 KB. **NEW.** Must be gentle — no cartoonish "wah wah."
- TTS lines generated live.

## Acceptance criteria

- [ ] Problem `3 + 2 = ?` renders with numerals at 96pt and 5 flower glyphs (3 + 2) as visual groups
- [ ] Three answer chips render at 88×88pt with 32pt gaps; chip values are `3`, `5`, `10`; correct answer `5` randomly placed
- [ ] Melody TTS "Let's count! Three plus two, how many?" plays on screen entry
- [ ] Tapping `5` triggers: chip sparkle, Melody ear-wiggle, chime + sparkle SFX, TTS "Yes! Five.", 1.2s auto-advance
- [ ] Tapping `3` or `10` triggers: chip shake (no color change), Melody puzzled-tilt, poof SFX, TTS "Hmm, try again?" — chips remain tappable
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
- Picture: `pic-dog.svg` — friendly Sanrio-style illustrated dog (vector, style-consistent with Melody). Lives at `public/assets/pictures/pic-dog.svg`.
- Letters: `d`, `o`, `g` in 96pt, spaced ~48pt apart. Each letter is tappable — tapping it plays that letter's sound alone.
- Speaker button: circular, 72pt, teal accent (`#8EDCE6`). Tapping plays "d... o... g... dog!" (sound-by-sound, then blended).
- Primary actions at bottom:
  - **Again** (paw-print icon, 72pt) — replays the full sound sequence. **Disabled (non-interactive, visually de-emphasized) until the intro sound sequence completes** (i.e., until line 5 "You try!" finishes at ~6.0s). See States and Motion for the disabled→enabled transition. We keep it visually present but greyed rather than hiding it entirely — the layout stays stable and Marian sees the affordance ahead of time, but it can't steal a tap during the intro. Per Dave's audit (2026-04-25): reduces simultaneous interactive zones during the model-building moment from 7 to 6.
  - **Got it** (checkmark icon in soft pink circle, 88pt) — advances. Larger than "Again" because it's the primary path. Also disabled during the intro sound sequence (same window as "Again") — Marian shouldn't be able to skip past Melody before Melody has finished speaking.

**Input model:** passive. She doesn't have to select an answer — this is a **listen + repeat exercise**. Speech recognition is v3. For v1, she just listens, optionally taps letters, and taps "Got it" when she feels ready. We trust her.

## Copy / TTS script

1. **(0.0s on entry)** "Look!" _(picture bounces in)_ — TTS
2. **(1.0s)** "A dog." — TTS
3. **(2.0s–4.0s)** **TTS is silent for the sound-out.** Pre-recorded phonemes play in sequence: `phoneme-d.mp3` → `phoneme-o-short.mp3` → `phoneme-g.mp3`, each with its letter's visual highlight, ~600ms between onsets (~200ms gap between files). **Do not queue a TTS utterance for this segment.** Per Dave's audit (2026-04-25): TTS narrating "D... O... G." over the phoneme files would put two near-simultaneous audio streams on the same perceptual channel — Mayer's redundancy principle. The phoneme files own this moment.
4. **(4.2s)** "Dog!" _(all three letters glow together, picture bounces once)_ — TTS resumes
5. **(5.5s)** "You try!" _(speaker button gets a hint-pulse)_ — TTS

**Word-count check:** `look, a, dog, you, try` — 5 unique TTS words (down from 8; `d`, `o`, `g` are no longer spoken via TTS, only via phoneme files). All within cap. Target phonics word `dog` is session-locked.

**On letter tap:** plays just that letter's pre-recorded phoneme — "/d/", "/ŏ/", "/g/". (Phonemes, not letter names. Web Speech API can't cleanly produce isolated phonemes; per Thomas (2026-04-25), we ship pre-recorded phoneme audio files. See Assets and Implementation notes.)

**On speaker tap:** replays lines 3–4 ("D... O... G... Dog!").

**On "Again" tap:** replays full sequence from line 2.

**On "Got it" tap:** Melody says "Nice!" → advances to Screen 5.

## Motion

- **Entrance:** bg cross-fades, Melody layoutId transitions to upper-left. Picture `initial={{ scale: 0, opacity: 0 }}`, spring `{ stiffness: 260, damping: 16 }` — slight bounce on land. Letters stagger in after picture, 150ms offset each.
- **Letter highlight during line 3 (sound-out, phoneme-only audio):** each letter pulses `scale: [1, 1.2, 1]` over 400ms as its **pre-recorded phoneme** plays. Color shifts from `--ink` to `--my-rose` during the pulse, then back. Sequence the three phoneme audio files back-to-back with ~200ms gaps. **No TTS plays during this segment** — the phoneme files are the only audio. The visual highlight is triggered off the phoneme file's `play` event, not a TTS boundary, so the visual and audio are tightly coupled.
- **Blend moment (line 4):** all three letters simultaneously scale 1→1.15→1 and picture does a happy bob. Feels like the word "clicks."
- **Speaker hint-pulse:** gentle 2-beat pulse loop (`scale: [1, 1.08, 1]`) when line 5 finishes, stops after first user tap anywhere.
- **"Again" + "Got it" enable transition:** at intro completion (~6.0s, after "You try!" TTS finishes), both buttons fade from disabled state (opacity 0.35, `pointer-events: none`, `aria-disabled="true"`) to enabled state (opacity 1, interactive) over 300ms. No bounce, no scale — just an opacity ramp so the change reads as "now ready" rather than "new thing." Disabled state styling: same icons and shapes as enabled, just at 0.35 opacity with no `whileTap` response. **Do not grey out via filter or desaturation** — opacity preserves the icon's color identity so Marian can still recognize what each button is.
- **Letter tap feedback:** single letter pulses + its sound plays. Other letters stay calm.
- **"Got it" tap:** checkmark scales 1→1.2→0.9→1 with a happy chime, then transition to Screen 5.

## States

### Intro (0.0s – ~6.0s)

Picture + letters + speaker + buttons all rendered, but **"Again" and "Got it" are visibly disabled** (opacity 0.35, non-interactive). Speaker is visible and tappable throughout — tapping it during the intro interrupts the current sequence and replays from line 2. Letters are tappable throughout (their phonemes play on demand without disrupting the intro).

### Idle (post-intro, ~6.0s onward)

Picture + letters + speaker + buttons all present and fully interactive. "Again" and "Got it" have ramped to opacity 1. Speaker pulses after intro completes.

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

- `melody-idle.svg`, `melody-happy.svg` — reused.
- `bg-song.svg` — music-notes wash. **NEW.** <20 KB.
- `pic-dog.svg` — Sanrio-style illustrated dog. **SHIPPED.** SVG vector at `public/assets/pictures/pic-dog.svg`, ~4.4 KB on disk. Scales cleanly at 96pt (chip) and 180pt+ (word card). All future CVC word pictures will also be SVG per Thomas (2026-04-27).
- `icon-speaker.svg` — simple speaker. <3 KB.
- `icon-paw.svg` — pawprint for "Again" button. <3 KB.
- `icon-check.svg` — checkmark. <2 KB.
- `sfx-chime-soft.mp3`, `sfx-sparkle.mp3` — reused.
- **Phoneme audio files (pre-recorded).** Session 1 needs 3: `phoneme-d.mp3`, `phoneme-o-short.mp3`, `phoneme-g.mp3`. Each ~4 KB, ~250–400ms. Used on letter tap and during the sound-out sequence (lines 3–4). The full literacy track will need ~26 phoneme files over time; budget approved at ~100 KB total of the 200 KB asset budget (Thomas 2026-04-25). Voice should match Melody's TTS register as closely as possible (warm, female, mid-pitch). Sourcing TBD by Matt — flag if a voice actor session is needed vs. an existing phonics audio library.
- Sentence-level TTS (Melody's narration around the phonemes) generated live via Web Speech API as before.

## Acceptance criteria

- [ ] Picture of dog renders at ~320pt square, centered horizontally
- [ ] Letters `d`, `o`, `g` render in 96pt with ~48pt spacing
- [ ] Each letter is tappable and plays that letter's **pre-recorded phoneme** (`phoneme-d.mp3`, `phoneme-o-short.mp3`, `phoneme-g.mp3`) when tapped — not Web Speech API output
- [ ] Speaker button plays full sound-out sequence when tapped (three pre-recorded phonemes in order, ~200ms gaps, then live-TTS "Dog!")
- [ ] "Again" button replays full sequence including Melody's intro
- [ ] "Got it" button (at 88pt, larger than "Again") advances to Screen 5
- [ ] During intro playback, letters highlight in sequence (`d` then `o` then `g`, then all three at blend)
- [ ] **No TTS utterance is queued or playing during the sound-out segment (line 3, ~2.0s–4.0s).** The only audio in this window is the three pre-recorded phoneme files. Verify by inspecting the TTS queue and confirming silence on the speech-synthesis side during phoneme playback.
- [ ] **"Again" and "Got it" buttons are disabled (opacity 0.35, `pointer-events: none`, `aria-disabled="true"`) from screen mount until the intro sound sequence completes (~6.0s, after "You try!" TTS finishes). They fade to opacity 1 and become interactive over a 300ms transition. Tapping them during the disabled window has no effect.**
- [ ] Speaker button and individual letters remain tappable throughout (including during intro)
- [ ] No "wrong answer" state exists on this screen
- [ ] All touch targets ≥60pt
- [ ] Speaker hint-pulse stops after any user interaction
- [ ] With Reduce Motion on, letter highlights are color-only (no scale pulse), picture fades in without bounce, "Again"/"Got it" enable as an instant opacity swap (no fade)

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

- Background: transitions from song-scene → soft twilight. **Twilight is not a separate asset** — it's `bg-song.svg` (the previous screen's background) with a runtime CSS filter applied (per Thomas 2026-04-25). Starting recipe: `filter: hue-rotate(220deg) brightness(0.75) saturate(1.1);` applied to the background layer. Tune to taste during implementation; the values approximate the cream → twilight wash the original spec called for. Subtle stars fade in over the filtered base. Net result: 4 visual moods, 3 background assets, zero extra bytes.
- Melody: centered, cheering pose (ears up, arms if rigged / hands up). Larger than on problem screens.
- **Stardust jar:** visual glass jar with 3 star icons dropping in one at a time. Each star represents a completed moment (greeting, math, literacy = 3). **No score, no point total, no percentage.**
- **Teaser:** a small "Tomorrow: [silhouette of a short-o friend]" teaser card — e.g., a fox silhouette for short-o word `fox`. Gentle, not a cliffhanger. Fades in after the main celebration.
- **Exit:** single home icon button. Tapping it closes the PWA gracefully (or returns to home/splash state — **see Open Questions** re: what "home" means for a single-user PWA).

## Copy / TTS script

1. **(0.0s)** "You did it!" _(Melody cheers, first star drops)_
2. **(1.2s)** "One..." _(star 2 drops)_
3. **(1.8s)** "Two..." _(star 3 drops)_
4. **(2.4s)** "Three stars!" _(all three glow)_
5. **(4.0s)** "See you next time." _(teaser fades in with soft silhouette)_
6. **(5.5s)** "Bye for now!" _(Melody waves)_

**Word-count check:** `you, did, it, one, two, three, stars, see, next, time, bye, for, now` — 13 unique words. All within cap.

**On "Home" tap:** no TTS — just a soft chime, fade to splash/closed state.

## Motion

- **Entrance:** background filter animates from `none` → `hue-rotate(220deg) brightness(0.75) saturate(1.1)` over 600ms (CSS transition on `filter`). Same `bg-song.svg` element stays mounted — only the filter changes, so this is effectively free. Melody grows in size via spring `{ stiffness: 180, damping: 20 }`. (Uses `layoutId="melody"`.)
- **Stardust particle burst:** 20–30 small `sparkle-particle.svg` elements emit from Melody's position, spring outward to random positions, then slowly drift up and fade over 3s. Use `AnimatePresence` with keyed particles. Stagger emission over 400ms for organic feel.
- **Stars into jar:** each star `initial={{ y: -80, opacity: 0, scale: 0.5 }}`, animates to its jar slot position with spring `{ stiffness: 200, damping: 18 }`. 600ms apart. Each landing triggers a soft "plink" SFX.
- **All-three-stars glow:** when star 3 lands, all three get a shared glow pulse (`boxShadow` or `filter: drop-shadow` animation) for 800ms.
- **Teaser card:** fades in from below (`y: 20 → 0`, opacity 0→1) with spring, 400ms, at line 5.
- **Melody wave:** expression swap to ear-wiggle on "Bye for now!" — reuses `melody-happy.svg`. `AnimatePresence` cross-fade as elsewhere.
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

- **In:** `bg-song.svg` filter animates to twilight recipe (no asset swap). Melody grows + re-centers.
- **Out:** on home tap, filter clears + fade to splash cream bg over 300ms.

## Assets required

- `melody-cheering.svg` — ears way up, happy. **NEW.** Vector; ~7 KB on disk.
- `melody-sleepy.png` — eyes closed, slight smile. **NEW** but **deferred** — not used in Session 1 happy path. Build in parallel for the "Come back soon!" post-home state. Out of scope for this spec's AC.
- ~~`bg-twilight.svg`~~ — **not shipped.** Twilight is `bg-song.svg` + CSS filter `hue-rotate(220deg) brightness(0.75) saturate(1.1)` per Thomas 2026-04-25. The starry overlay (small star elements fading in) is rendered in the foreground as DOM/SVG stars, not baked into a background asset.
- `star-overlay.svg` (or rendered as React component using `sparkle-particle.svg` instances) — small stars that fade in over the filtered twilight base. <2 KB if a separate asset.
- `sparkle-particle.svg` — reused from Screen 3.
- `star-filled.svg` — filled gold star for jar. <2 KB.
- `jar.svg` — glass jar outline. <4 KB.
- `silhouette-fox.svg` — soft silhouette of a fox (teaser for tomorrow's short-o word). <3 KB. (Or whatever the next word's subject is — picking `fox` because it's the obvious short-o picture follow-up to `dog`.)
- `icon-home.svg` — house icon. <3 KB.
- `sfx-plink.mp3` — soft star-drop sound, 300ms, ~5 KB. **NEW.**
- `sfx-cheer.mp3` — soft "ta-da" chord, 800ms, ~12 KB. **NEW.** Must be gentle, not a game-show fanfare.

## Acceptance criteria

- [ ] Background transitions from song-scene to twilight over 600ms via CSS `filter` animation (`hue-rotate(220deg) brightness(0.75) saturate(1.1)`) on `bg-song.svg` — no separate twilight asset is loaded
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

| Asset                                                | Use                         | Size target      | Format                             | Reuse across session |
| ---------------------------------------------------- | --------------------------- | ---------------- | ---------------------------------- | -------------------- |
| `melody-idle.svg`                                    | Default / neutral           | ~6 KB on disk    | SVG (vector)                       | S2, S3, S4           |
| `melody-happy.svg`                                   | Ear-wiggle / correct / wave | ~6 KB on disk    | SVG (vector)                       | S2, S3, S5           |
| `melody-puzzled.svg`                                 | Wrong answer, gentle tilt   | ~6 KB on disk    | SVG (vector)                       | S3                   |
| `melody-cheering.svg`                                | End-of-session celebration  | ~7 KB on disk    | SVG (vector)                       | S5                   |
| `melody-sleepy.png` (**deferred to post-Session-1**) | Post-exit / return screen   | TBD when shipped | TBD (likely SVG to match the rest) | —                    |

**Note:** Each expression ships as a separate SVG asset, swapped via React state and cross-faded with Framer Motion's `AnimatePresence` (`initial`/`animate`/`exit` opacity). Sprite sheets are out of scope — the project is vector-only and no sprite pipeline exists or is planned.

### Backgrounds (3 distinct assets, 4 visual moods)

| Asset           | Use                                                      | Size target | Format |
| --------------- | -------------------------------------------------------- | ----------- | ------ |
| `bg-clouds.svg` | Screen 2 — greeting                                      | <15 KB      | SVG    |
| `bg-garden.svg` | Screen 3 — math (Number Garden)                          | <20 KB      | SVG    |
| `bg-song.svg`   | Screen 4 — literacy (Word Song) — **also Screen 5 base** | <20 KB      | SVG    |

**Background count: 3 distinct assets, 4 visual moods.** Per Thomas 2026-04-25: Screen 5's twilight is derived at runtime from `bg-song.svg` via `filter: hue-rotate(220deg) brightness(0.75) saturate(1.1)`. Net result: visual variety of 4, asset payload of 3, zero extra bytes. CSS-filter recipe is a starting point — Kevin/Devon may tune values during implementation; if the tuned values diverge significantly from the starting recipe, note it in PR review so Kyle can confirm the mood still reads as "twilight" rather than "muddy."

### Icons / UI glyphs

| Asset                   | Use                          | Size   | Format     |
| ----------------------- | ---------------------------- | ------ | ---------- |
| `melody-logo.svg`       | Splash wordmark + heart logo | <8 KB  | SVG        |
| `heart-button.svg`      | Primary CTA on greeting      | <4 KB  | SVG        |
| `flower-glyph.svg`      | Math visual groups           | <3 KB  | SVG        |
| `sparkle-particle.svg`  | Celebration bursts           | <1 KB  | SVG        |
| `pic-dog.svg`           | Literacy picture             | ~4.4 KB | SVG       |
| `icon-speaker.svg`      | Speaker button               | <3 KB  | SVG        |
| `icon-paw.svg`          | "Again" button               | <3 KB  | SVG        |
| `icon-check.svg`        | "Got it" button              | <2 KB  | SVG        |
| `star-filled.svg`       | Jar stars                    | <2 KB  | SVG        |
| `jar.svg`               | Stardust jar                 | <4 KB  | SVG        |
| `silhouette-fox.svg`    | Tomorrow teaser              | <3 KB  | SVG        |
| `icon-home.svg`         | End-screen exit              | <3 KB  | SVG        |

### Sound effects

| Asset                | Use                             | Duration | Size   |
| -------------------- | ------------------------------- | -------- | ------ |
| `sfx-chime-soft.mp3` | Heart tap, got-it tap, home tap | 400ms    | ~8 KB  |
| `sfx-sparkle.mp3`    | Correct answer celebration      | 400ms    | ~6 KB  |
| `sfx-poof.mp3`       | Wrong answer gentle response    | 500ms    | ~8 KB  |
| `sfx-plink.mp3`      | Star dropping into jar          | 300ms    | ~5 KB  |
| `sfx-cheer.mp3`      | End-of-session ta-da            | 800ms    | ~12 KB |

**Total SFX payload: ~39 KB.** Preload at boot via Howler.

### Pre-recorded phoneme audio (per Thomas 2026-04-25)

Web Speech API can't reliably produce isolated phonemes (it pronounces letter names or mangles short vowels), and the literacy track depends on Marian hearing pure phonemes. Approved budget: **up to ~100 KB of the 200 KB asset budget** for the full phoneme library (~26 files across the literacy roadmap). Session 1 ships 3:

| Asset                 | Phoneme       | Duration target | Size target |
| --------------------- | ------------- | --------------- | ----------- |
| `phoneme-d.mp3`       | /d/           | ~250ms          | ~4 KB       |
| `phoneme-o-short.mp3` | /ŏ/ (short o) | ~350ms          | ~4 KB       |
| `phoneme-g.mp3`       | /g/           | ~250ms          | ~4 KB       |

**Session 1 phoneme payload: ~12 KB** of the ~100 KB phoneme allocation.

Voice direction: warm, female-leaning, mid-pitch — should feel like the same person Melody's TTS sounds like. Pure phoneme (no schwa appended): /d/ not /duh/, /g/ not /guh/. Sourcing decision (voice actor session vs. licensed phonics audio library) is Matt's call — flag if it needs Thomas. Preload alongside SFX via Howler.

### TTS (sentence-level Melody narration)

- Generated live via Web Speech API for all of Melody's spoken sentences. **Phonemes are NOT generated by TTS** — they're pre-recorded files (see above).
- Voice preference: `en-US` female-leaning (queried from `speechSynthesis.getVoices()`, preferred list: "Samantha", "Allison", "Ava"). Fallback: first `en-US` voice with `gender === 'female'` or default if not available.
- Rate: 0.9. Pitch: 1.1. Volume: 1.0.

---

## Vocabulary check (whole session, deduplicated)

All words Melody says in Session 1:

> a, and, bye, count, d, did, dog, for, g, happy (internal, not spoken), heart, hi, how, hmm, i'm, it, it's, let's, look, many, meet, melody, more, next, nice, now, o, one, plus, ready, see, so, stars, tap, the, three, time, to, try, two, when, yes, you, you're, you try

Unique count: **~40 words**, well within the 200-word cap.

**Potentially out-of-cap / flagged words** (asking for Thomas via Matt):

- **None** — all words used are standard common-English kid vocabulary.

**Phonemes (letter sounds)** — `/d/`, `/ŏ/`, `/g/` — not words. Shipped as **pre-recorded audio files** per Thomas 2026-04-25 (Web Speech API can't cleanly produce isolated phonemes). See Pre-recorded phoneme audio table above.

---

## Resolved decisions (Thomas, 2026-04-25)

These were originally open questions on this spec; they are now baked into the body above. Listed here as a paper trail.

1. **~~Phonemes vs letter names~~ — RESOLVED.** Pre-record phoneme audio files. Up to ~100 KB of the 200 KB asset budget approved for the full phoneme library. Session 1 ships 3 files (`phoneme-d.mp3`, `phoneme-o-short.mp3`, `phoneme-g.mp3`). Web Speech API handles only sentence-level Melody narration. See Screen 4 Assets and the Pre-recorded phoneme audio table.

2. **~~Background count: 3 or 4?~~ — RESOLVED.** Ship 3 PNG/SVG backgrounds. Twilight is derived at runtime from `bg-song.svg` via `filter: hue-rotate(220deg) brightness(0.75) saturate(1.1)`. 4 visual moods, 3 assets, zero extra bytes. Recipe values are a starting point; Kevin/Devon may tune.

3. **~~Math distractor choice~~ — RESOLVED.** Gentle ramp on problem #1: distractors `3` and `10` (clearly wrong, no off-by-one bait). Off-by-one trap distractors (`4`/`6`-style targeting Marian's documented diagnostic miscount pattern) start at problem #3 once she's banked two wins. Out of scope here since Session 1 has only one math problem; flagged so the future session generator follows the rule.

---

## Open TODOs (non-blocking)

The 5 non-blocking items from the original spec. Two I'm answering myself; three remain queued.

1. **"Home" tap behavior on iPad PWA — RESOLVED (Kyle, no Thomas needed).** Return to splash/neutral state. Simple, predictable, and the `melody-sleepy` "Come back soon!" path is already deferred to post-Session-1 along with that asset. Spec body already reflects the recommendation; this just confirms it's the chosen path. If Thomas later wants the sleepy variant, it's a small follow-up.

2. **Return-user flow on Screen 2 — RESOLVED (Kyle, no Thomas needed).** Confirmed: this spec is Session 1 only. From Session 2 onward, Melody knows Marian and the greeting changes. Matt to open a follow-up ticket for the returning-user greeting spec; reuse of `melody-idle` / `melody-happy` / the cloud bg / heart CTA pattern should make it cheap.

3. **TTS voice stability — TODO (recommend revisiting at Session 4–5 milestone).** iPad Web Speech voices can shift between iOS updates and Melody's voice identity matters for bonding. With phoneme files now pre-recorded for the literacy track, the natural next move is pre-recording or ElevenLabs-generating Melody's most-repeated sentences (greeting, "Yes!", "Hmm, try again?", "You did it!"). Estimated ~30 sentences across all sessions. Suggest scoping after a few sessions ship and we know which lines Marian actually hears most. Non-blocking; Matt to pick the right moment.

4. **PWA install moment — TODO (separate ticket).** This spec covers what happens _after_ the home-screen install. The install prompt / "Add to Home Screen" instruction flow is a separate ticket per the AC ("first-run flow only"). Recommendation, unchanged: a 1-screen pre-install instructional card (iPad-specific: "Tap share → Add to Home Screen") delivered once from the Vercel URL before home-screen launch. Matt to open the ticket when ready; could touch the `pwa-manifest-generator` skill for manifest specifics.

5. **Reduced data mode / slow network — TODO (recommend answering during Kevin/Devon's first integration spike).** Splash has a 3000ms cold-cache cap. If assets genuinely can't load on first launch, fallback is still TBD. Recommendation, unchanged: ship Melody idle + one background as inline SVGs in the initial HTML so we always have _something_ to show. Hard to answer without measuring real bundle cost — best to revisit once the build pipeline exists. Non-blocking for design; flagging so Matt has it on the engineering side.

---

## Implementation notes for Kevin & Devon

- **iPad Safari audio unlock (Screen 2 Wake → Intro).** The first audio call of the session MUST be inside the synchronous body of a user-gesture handler (`onPointerDown`, `onTouchEnd`, or `onClick` on the Wake-state tap surface). Do not `await` anything before calling `speak()` / `Howl.play()` — async gaps break the gesture-context association on Safari. Concrete pattern:
  ```ts
  function handleWakeTap() {
    // Synchronous, in the same call frame as the gesture:
    const u = new SpeechSynthesisUtterance('Hi!')
    u.rate = 0.9
    u.pitch = 1.1
    u.onstart = () => setIntroState('speaking')
    u.onend = () => queueLine2()
    speechSynthesis.speak(u)
    // Also kick a silent Howl to unlock the WebAudio context for SFX:
    silentUnlockHowl.play()
    setWakeState('intro')
  }
  ```
  Do NOT call `speak()` from a `useEffect`, a `setTimeout`, or after a `Promise` resolution — Safari treats those as a fresh execution context and rejects the call silently. Subsequent `speak()` calls (lines 2–4) can happen in async handlers (`onend` callbacks, timers) — once the context is unlocked it stays unlocked for the session.
- **Soft re-gate for relock-after-background.** On every screen mount that calls `speak()`, attach a 250ms timeout: if `onstart` doesn't fire, assume the audio context relocked (iPadOS suspended it during a long background) and surface the same Wake-state ring + tap-anywhere affordance in-place. Reuse the Screen 2 ring component. Treat this as a quiet recovery, not an error state — no copy, no animation beyond the ring. Implementation can ship behind a feature flag for v1 if it adds risk; document the flag in the PR.
- **First-utterance retry contract (Dave's 2026-04-25 consult).** Specifically for the _first_ `speak(line1)` call right after the Wake tap on Screen 2: iOS Safari occasionally doesn't honour the gesture-context association on the very first call (rare; observed inconsistently across iPadOS minor versions). If the Wake-tap's `speak(line1)` does not fire `onstart` within **2 seconds**, do NOT immediately fall back to the soft re-gate above. Instead: silently mark the unlock as pending, and on the _next_ user interaction within the same session (the heart button tap is itself a gesture-bearing handler), retry `speak(line1)` with a _fresh_ `SpeechSynthesisUtterance` synchronously inside that handler. No copy shown to Marian — she experiences a slightly delayed Melody, not an error. If the retry also fails (extremely rare), only then fall back to the soft re-gate pattern above. Acceptance test: simulate by mocking `speechSynthesis.speak` to no-op once, then confirm the next user interaction successfully fires `onstart`.
- **Framer Motion setup:** wrap `<App>` in `<LazyMotion features={domAnimation}>` + `<MotionConfig reducedMotion="user">`. Use `<m.div>` everywhere, NOT `<motion.div>`, to stay in the 4.6 KB budget.
- **Shared Melody element across screens:** use `layoutId="melody"` on Melody's wrapper in Screens 2–5 so her position transitions animate for free. Keep her in a single component that re-parents via React state, not unmount/remount.
- **AnimatePresence gotcha:** AnimatePresence must wrap the conditional, not be wrapped by it. Applies to particles, transitions between screens, and the teaser card.
- **Caption word reveal:** primary path uses `SpeechSynthesisUtterance.onboundary` to advance the highlighted word in lockstep with TTS. iPad Safari frequently omits `onboundary`, and Safari is Marian's primary device — treat the fallback as the _main_ path, not an edge case. Fallback: on `onstart`, begin a synthetic word-paced reveal at a configurable WPM (default **165 wpm**, derived from Melody's `rate: 0.9` × ~183 baseline wpm). Reveal one word at a time on a `setInterval(60_000 / wpm)` tick; clear on `onend`/`onerror`. Rationale: per-word visual reinforcement is the passive-reading-exposure value the audio-first / text-mirror principle is optimizing for, and Marian is CVC-emerging — losing word-by-word pacing on the primary device would be a real regression. Acceptable desync: ±1 word from audio is fine; if drift exceeds 2 words the captioner should snap to `onend` and reveal the remainder. Do not block playback on boundaries either way.
- **Preload SFX on boot:** `Howl` instances for all 5 SFX created at app init, not on-demand (first-tap latency kills the feel).
- **Preload phoneme audio on boot:** same Howler pattern as SFX. Session 1 needs the 3 short-o phonemes (`phoneme-d.mp3`, `phoneme-o-short.mp3`, `phoneme-g.mp3`) loaded before Screen 4. They're tiny (~12 KB total) and tap-latency-sensitive — letter-tap → phoneme playback should feel instant.
- **Twilight filter (Screen 5):** apply CSS `filter` to the background element on screen entry; animate via CSS transition (`transition: filter 600ms ease-out`), not Framer Motion. Filter animations on a single DOM property are GPU-accelerated and don't need motion-library overhead.
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
