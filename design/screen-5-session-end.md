# Screen 5 — Session End (Math)

**Audience:** Devon + Kevin (impl), Jessica (QA), Thomas (taste).
**Author:** Kyle (UX) — ticket `86c9grnjd`.
**Status:** Spec — implementation blocked on this PR merging.
**Surface:** iPad portrait PWA, home-screen installed.
**Scope:** What happens after problem 8 of an 8-problem Math session. The "completed clean run" path
only — mid-session abandonment lives in sibling ticket `86c9grnjf`.

This file is the canonical spec for the Session-End screen following a Math session. Session-1's
Screen 5 (`design/session-1.md` lines 466–576) is the first-run miniature version (3 stars from 3
moments); from Session 2 onward this file owns the surface. The Math screen
(`design/screen-3-math.md`) hands off to this screen via the
`onSessionComplete({ totalCorrect, totalStardust, finalStreak })` callback contract noted at
screen-3-math.md:411.

---

## Goal

Marian finishes 8 problems and gets a calm, predictable closing moment with Melody: a count of the
stardust she earned, a quiet acknowledgement of her best in-session streak, a warm goodbye, and one
single way to leave. The screen reinforces "you did the thing" without ever quantifying her wrongs,
ranking her against a past self, or dangling a "come back tomorrow or lose X" threat.

**This is not** a results screen, a report card, an upsell, or a streak-pressure mechanic. It's the
end of a visit with a friend who is glad she came.

---

## User state entering this screen

She just tapped the correct chip on problem 8 of the Math session. The Math screen fired
`onSessionComplete({ totalCorrect, totalStardust, finalStreak })` — that callback wires straight
into this screen's mount. The audio context is already gesture-unlocked (last tap was within 1.2s).
The Path A `sessionAudio` cache is hot.

Two state sources arrive with her:

| Field           | Type   | Range | Source                                     |
| --------------- | ------ | ----- | ------------------------------------------ |
| `totalCorrect`  | number | 0–8   | Math screen's per-session correct count    |
| `totalStardust` | number | 0–11  | Math screen's per-session stardust earned  |
| `finalStreak`   | number | 0–8   | Longest streak she hit during this session |

Notes on bounds:

- `totalStardust` max of 11 = 8 (one per correct) + 3 (streak bonuses at 3/5/8). Per
  screen-3-math.md §"Stardust treatment".
- `finalStreak` is the longest streak she reached at any point, not necessarily her final-three
  state. So if she went 5-in-a-row then missed problem 6 then got 7+8 right, `finalStreak === 5`,
  not 2.
- `totalCorrect` is informational here; this screen never displays it numerically (see §Wrong-answer
  recap policy).

---

## Visual layout

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ~ twilight wash background ~            |  <- cream → soft lavender + stars
|                                          |
|                                          |
|        ( Melody — celebrating )          |  <- centered, ~50vh, larger
|         arms up, ears wiggling           |     than problem-screen size
|                                          |
|     ✨   ✨   ✨   ✨   ✨   ✨          |  <- stardust burst on entry
|                                          |
|                                          |
|       +----------------------+           |
|       |  "You did it!"       |           |  <- speech ribbon, word-by-word
|       +----------------------+           |
|                                          |
|                                          |
|              ★  11                       |  <- session-stardust counter
|         (animated tick-up)               |     32pt glyph + 64pt numeral
|                                          |
|                                          |
|       ~ 🔥 5 in a row! ~                 |  <- streak summary (only if
|         (only if finalStreak ≥ 3)        |     finalStreak ≥ 3; else hidden)
|                                          |
|                                          |
|                                          |
|              [ ✓ All done! ]             |  <- single CTA, 88×220pt,
|                                          |     thumb-zone bottom 22%
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

**Vertical rhythm (top → bottom, portrait iPad ~1024pt tall):**

| Band             | Height    | Contents                                                      |
| ---------------- | --------- | ------------------------------------------------------------- |
| Safe-area top    | env inset | —                                                             |
| Background wash  | full      | `bg-twilight.svg` (or filtered `bg-clouds.svg` per Open Q #2) |
| Melody + ribbon  | ~38vh     | Melody centered horizontally, ribbon below her                |
| Session stardust | ~14vh     | `★` glyph at 32pt + numeral at 64pt, centered                 |
| Streak summary   | ~10vh     | Conditional band — fixed-height even if hidden, no reflow     |
| Spacer           | ~8vh      | Breathing room — non-negotiable                               |
| CTA "All done!"  | ~12vh     | Single 88pt-tall × ~220pt-wide pill, centered                 |
| Safe-area bottom | env inset | —                                                             |

**Thumb zone:** the "All done!" CTA sits in the bottom ~22% of the viewport, well within the
global bottom-60% rule from CLAUDE.md. Single primary action; no secondary actions on this screen
by design.

**Why no HUD strip:** the Math screen's HUD (problem dots, in-session stardust counter, streak
flame) does NOT carry across to this screen. Session-end is a "the run is over" surface — showing
the in-session HUD here would imply more problems are coming. The session-stardust display in this
spec is a celebration moment, not a counter.

**Why CTA is text-bearing ("All done!") instead of icon-only:** the CLAUDE.md non-negotiable says
"icons and numbers carry the UI" and "minimal reading required". The check-glyph alone (✓) is
ambiguous in this context — "All done" could be read as "Are you all done?" (a question) or "I am
all done!" (a declaration). The text disambiguates AND provides one more passive-reading exposure
moment. Melody also says "All done!" via TTS so the text mirrors her speech per the audio-first
convention. The check glyph is the visual anchor; the text is the affordance label. **If Thomas
prefers icon-only here for visual purity, swap to a large house glyph + drop the text — Melody's
TTS still does the work.**

---

## Copy / TTS script

Lines play in order with ~400ms natural pauses, mirroring Greet's cadence. Caption ribbon
mirrors word-by-word via Path A `onWordTick`.

| t (s) | Line                                           | Visible event                                            |
| ----- | ---------------------------------------------- | -------------------------------------------------------- |
| 0.0   | "You did it!"                                  | Melody arms-up celebrate; first stardust particles burst |
| 1.4   | "You earned eleven stars!"                     | Stardust counter ticks up from 0 → `totalStardust`       |
| 3.4   | _(if `finalStreak ≥ 3`)_ "Five in a row! Wow!" | Streak summary band fades in                             |
| 5.0   | "See you soon."                                | CTA "All done!" appears                                  |

**Word-count check (against 200-word cap):** `you, did, it, earned, eleven, stars, in, a, row, wow,
see, soon, all, done` — 14 unique. All within cap. Numbers 0–11 are on the locked numeric allow-list
per Session-1 vocabulary policy.

**Numeric ranges in TTS:**

- "You earned `<N>` stars!" — N can be 0 to 11. Pre-render all 12 variants per the audio contract
  below. (See Open Q #4 on whether to use concatenation or per-N pre-rendered.)
- "`<N>` in a row! Wow!" — N can be 3 to 8. Pre-render 6 variants. (Streak summary only fires for
  N ≥ 3, so 3, 4, 5, 6, 7, 8.)

**Edge case — zero stardust:** if Marian somehow reaches session-end with `totalStardust === 0`
(only possible via 8 guided-completion fall-throughs — every single problem hit the 3-strike floor),
the line still plays as **"You did it!"** and **"See you soon."** — we _skip_ the "You earned zero
stars" line entirely. Saying "You earned zero stars!" with the same ear-wiggle cheer reads as either
mockery or a glitch. Silence is honest here; she still completed the session, that's what we
celebrate. **Pre-render `session.end.recap.0` anyway** so the bundle shape is uniform; we just
don't dispatch it.

**Edge case — singular vs plural ("one star" vs "two stars"):** for `totalStardust === 1` use
**"You earned one star!"** (singular). For 0, 2–11 use the plural form. The pre-rendered bundle
ships both — `session.end.recap.1` is the singular variant; all others use plural.

**Edge case — singular streak:** `finalStreak === 1` cannot trigger the streak line per the ≥ 3
threshold, so no singular handling needed. (`finalStreak === 2` also doesn't trigger; the threshold
matches Math's "streak indicator hidden until streak ≥ 2" rule and adds one more — we celebrate the
streak summary at 3+ because that's a meaningful run, not just "got two right in a row".)

**On "All done" tap:** soft chime SFX (`sfx-chime-soft.mp3`, reused), 300ms fade-out, screen
behaviour per §"What 'All done' does" (Open Q #1 — recommend Option C).

---

## Audio integration contract (Path A)

Every utterance Session-End needs at session-start, listed so the Vercel function pre-renders them
via `api/_tts.ts` and ships them inline in the session JSON. Voice config is canonical from
`design/audio-architecture.md` §"Voice configuration" — `en-US-AnaNeural`, rate `-10%`, default
pitch, MP3 mono 24kHz ~48kbps.

**Fixed lines (always pre-rendered, always shipped):**

| `id`                  | Sample text     | When played                                          | SSML rate | SSML pitch | Notes                                                                                                                  |
| --------------------- | --------------- | ---------------------------------------------------- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `session.end.opener`  | "You did it!"   | Screen entry                                         | `-10%`    | default    | Same text every session — but render per-session for cache locality (matches Math reprompt pattern, screen-3-math:285) |
| `session.end.goodbye` | "See you soon." | After streak band (or after recap if no streak band) | `-10%`    | default    | Same text every session.                                                                                               |

**Recap line — pre-rendered variants (12 total, one always dispatched):**

| `id`                   | Sample text                 | When played                  | SSML rate | SSML pitch | Notes                                            |
| ---------------------- | --------------------------- | ---------------------------- | --------- | ---------- | ------------------------------------------------ |
| `session.end.recap.0`  | _(not dispatched — silent)_ | n/a                          | `-10%`    | default    | Pre-rendered for bundle uniformity; never played |
| `session.end.recap.1`  | "You earned one star!"      | After opener if stardust = 1 | `-10%`    | default    | Singular form                                    |
| `session.end.recap.2`  | "You earned two stars!"     | After opener if stardust = 2 | `-10%`    | default    | Plural, etc.                                     |
| `session.end.recap.3`  | "You earned three stars!"   | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.4`  | "You earned four stars!"    | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.5`  | "You earned five stars!"    | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.6`  | "You earned six stars!"     | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.7`  | "You earned seven stars!"   | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.8`  | "You earned eight stars!"   | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.9`  | "You earned nine stars!"    | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.10` | "You earned ten stars!"     | …                            | `-10%`    | default    |                                                  |
| `session.end.recap.11` | "You earned eleven stars!"  | …                            | `-10%`    | default    |                                                  |

**Streak line — pre-rendered variants (6 total, conditionally dispatched):**

| `id`                   | Sample text            | When played            | SSML rate | SSML pitch |
| ---------------------- | ---------------------- | ---------------------- | --------- | ---------- |
| `session.end.streak.3` | "Three in a row! Wow!" | If `finalStreak === 3` | `-10%`    | default    |
| `session.end.streak.4` | "Four in a row! Wow!"  | If `finalStreak === 4` | `-10%`    | default    |
| `session.end.streak.5` | "Five in a row! Wow!"  | If `finalStreak === 5` | `-10%`    | default    |
| `session.end.streak.6` | "Six in a row! Wow!"   | If `finalStreak === 6` | `-10%`    | default    |
| `session.end.streak.7` | "Seven in a row! Wow!" | If `finalStreak === 7` | `-10%`    | default    |
| `session.end.streak.8` | "Eight in a row! Wow!" | If `finalStreak === 8` | `-10%`    | default    |

**Total Session-End audio per session:** 2 fixed + 12 recap variants + 6 streak variants = **20
utterances**. At ~15 KB/utterance, that's ~300 KB inline base64. Combined with Math's ~600 KB
(screen-3-math.md:296), session payload is ~900 KB — comfortably within the 4.5 MB Vercel response
cap.

**Why pre-render all variants instead of templating at runtime:** Path A's whole architectural point
is that audio is rendered server-side at session-start so the client never depends on Web Speech or
runtime synthesis. Concatenation ("You earned" + `<N>` + "stars") would require client-side audio
splicing, which adds complexity and a new failure mode. Pre-rendering 18 variants costs ~270 KB
and zero new code paths. (Alternative strategies are the subject of Open Q #4.)

**SFX (NOT pre-rendered via TTS — static MP3s on disk via Howler):**

| `id`                 | File                 | When played                              | Status                               |
| -------------------- | -------------------- | ---------------------------------------- | ------------------------------------ |
| `sfx.chime`          | `sfx-chime-soft.mp3` | "All done!" tap                          | Reused — already in Greet            |
| `sfx.sparkle`        | `sfx-sparkle.mp3`    | Stardust burst on screen entry           | Reused from Math (screen-3-math:303) |
| `sfx.stardust-grain` | `sfx-plink.mp3`      | Per-tick during stardust counter tick-up | Reused from Math (screen-3-math:306) |
| `sfx.cheer`          | `sfx-cheer.mp3`      | Soft "ta-da" chord under "You did it!"   | Not yet authored — flagged           |

**Audio dispatch sequence on screen mount:**

```
t=0ms     : screen mounts; sessionAudio.playUtterance('session.end.opener')   ← dispatched in mount effect
t=0ms     : sfx.cheer.play()   ← gentle ta-da chord under the opener line
t=0ms     : sfx.sparkle.play() ← stardust particle burst SFX
t=0-800ms : "You did it!" plays; caption ticks word-by-word
t=0-1200ms: ~20 sparkle particles spring outward from Melody, fade over 1.2s
t=1400ms  : sessionAudio.playUtterance('session.end.recap.<N>')  ← N = totalStardust; skipped if N=0
t=1400-3200ms : "You earned <N> stars!" plays; counter ticks up from 0 → N over the line duration
t=1400-3200ms : sfx.stardust-grain.play() per integer tick (e.g. 11 plinks staggered across the tick-up)
t=3400ms  : if finalStreak >= 3: sessionAudio.playUtterance('session.end.streak.<N>')
              ← else skip to t=5000ms below
t=3400-4800ms : "<N> in a row! Wow!" plays; streak band fades in over 400ms then settles
t=5000ms  : sessionAudio.playUtterance('session.end.goodbye')
t=5000-6200ms : "See you soon." plays
t=6200ms  : "All done!" CTA scales in from 0.9 → 1 (spring), settles
t=6200ms+ : screen sits idle indefinitely; no nag, no auto-advance
```

**Audio dispatch sequence on "All done!" tap:**

```
t=0ms     : tap registered
t=0ms     : sfx.chime.play()   ← synchronous
t=0ms     : cancelPreRecorded() / sessionAudio.cancel()  ← if any utterance still playing, stop it cleanly
t=0-300ms : screen fades to splash (per Open Q #1 recommendation, Option C)
```

**Caption rendering:** identical to Math (screen-3-math.md:337–340). Render `Utterance.text` via
the Path A `onWordTick` callback; each word is a `<m.span>` with `data-revealed` toggling opacity
0→1 on its tick. Same `text-[2.4rem]` size for legibility floor.

**Audio gate:** Marian's last tap (the correct chip on problem 8) was within ~1.2s of this screen
mounting, so the audio context is already unlocked from that gesture. **`useAudioUnlockGate` is
NOT required on this screen** — there's no non-interactive transition into Session-End. If the
session-start utterance dispatch fails for some other reason (e.g., `loaderror` on a missing MP3),
the orchestrator's GBUG-7 path applies — Melody pose stays at `melody-celebrating`, no TTS, captions
empty, and the "All done!" CTA still appears at t=6200 via a fallback timer (see §States →
"Audio failure" below).

---

## What "All done!" does

**Open question for Thomas (#1):** three options. Recommendation is **Option C**.

| Option | Behaviour                                                                                                                           | Pro                                                                                                                                                                                  | Con                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Hard exit — programmatically close the PWA                                                                                          | Cleanest "session is over" semantic                                                                                                                                                  | iOS PWAs cannot programmatically close themselves; would require Marian to swipe-up to home — same as doing nothing. **Not actually possible on the target device.** |
| B      | Return to a hub/menu screen                                                                                                         | Future-proof for multi-tree (Math + Word Song)                                                                                                                                       | Hub screen does not exist yet — would balloon scope into a separate spec + impl ticket. v1 has no hub.                                                               |
| C      | Show a static "Come back soon!" splash with sleeping Melody, no further actions. PWA stays open; Marian closes it via iPad gesture. | Minimal scope; reuses existing assets (`melody-sleepy` is already on the assets-todo list for Session-1 deferred work, see session-1.md:550); no new screens; quiet, predictable end | "Come back soon!" copy could read as soft FOMO if not careful — must phrase as warm closure, not as a hook. See sub-spec below.                                      |

**Recommended for v1: Option C — "Come back soon!" splash.**

Sub-spec for the Option C post-tap state (call it "Sleep splash"):

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ~ twilight wash, slightly dimmer ~      |
|                                          |
|                                          |
|     ( Melody — sleepy, eyes closed )     |  <- ~40vh, centered
|                                          |
|                                          |
|       +-----------------------+          |
|       | "Come back soon."     |          |  <- text only; NO TTS plays
|       +-----------------------+          |
|                                          |
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

- **No TTS on the sleep splash.** Melody just rests. Audio playing here would defeat the "we're
  done" message. The text is on-screen so it serves the passive-reading exposure principle but
  Melody's voice is silent.
- **No further interactions.** Tapping anywhere does nothing. Marian closes via the iPad home
  gesture or just walks away.
- **No "Tap to start a new session!" affordance.** This would be exactly the dark-pattern trap
  CLAUDE.md guards against — re-engagement nudges. We are explicitly NOT inviting another session
  from this screen.
- **Background dims slightly (cream → soft-twilight at ~85% brightness) over the 300ms fade-in.**
  Visual cue that we're winding down.

**Asset implication for Option C:** needs `melody-sleepy.svg`. This was deferred in Session-1 spec
(session-1.md:550 calls it "deferred — not used in Session 1 happy path. Build in parallel for the
'Come back soon!' post-home state. Out of scope for this spec's AC.") — Session-End makes it
load-bearing. **Asset gap surfaced; flag to Thomas via Matt for art queue.**

If Option A is chosen by Thomas: replace the Sleep splash with a single fade-to-black over 300ms
and stop. (PWA cannot actually close itself; this is functionally identical to Option C minus the
sleeping Melody — strictly worse because there's no closure visual.)

If Option B is chosen by Thomas: this spec stops being self-contained — the Hub screen needs its
own spec ticket and that work blocks Session-End from being implemented. Recommend opening the Hub
ticket as a follow-up before Session-End hits Devon's queue.

---

## localStorage updates at session end

Session-End is the canonical write moment for cross-session progress state. Math's per-session
state (`marian-tutor.stardust.v1`) already updates on every increment and on session-end
(screen-3-math.md:189). This screen's responsibility is the cross-session aggregate state.

**New schema — `marian-tutor.session-history.v1`:**

```typescript
type SessionHistoryV1 = {
  schemaVersion: 1
  /** Total sessions completed (any tree). Increments by 1 per Session-End screen reached. */
  sessionCount: number
  /** ISO-8601 timestamp of the most-recently-completed session. */
  lastSessionCompletedAt: string
  /** Longest single-session streak ever recorded. Only updated if current finalStreak > stored value. */
  longestStreakEver: number
  /** Cumulative stardust across all sessions ever. Mirror of marian-tutor.stardust.v1.total
   *  but written here for atomicity-on-session-end (see "Coordination" below). */
  cumulativeStardust: number
}
```

**Default if key absent (first session ever completed):**

```typescript
{
  schemaVersion: 1,
  sessionCount: 0,
  lastSessionCompletedAt: '',         // sentinel — never read as a date when sessionCount === 0
  longestStreakEver: 0,
  cumulativeStardust: 0,
}
```

**Write sequence on Session-End mount:**

1. Read current `marian-tutor.session-history.v1` (default if absent).
2. Read current `marian-tutor.stardust.v1` (default if absent — set by Math screen earlier in the
   session).
3. Compute the new history record:
   ```typescript
   const next: SessionHistoryV1 = {
     schemaVersion: 1,
     sessionCount: prev.sessionCount + 1,
     lastSessionCompletedAt: new Date().toISOString(),
     longestStreakEver: Math.max(prev.longestStreakEver, finalStreak),
     cumulativeStardust: stardustState.total, // stardust state already includes this session's gains
   }
   ```
4. Write `marian-tutor.session-history.v1` synchronously (`localStorage.setItem`).
5. Wrap in try/catch — localStorage can throw on private-browsing iOS; defensive default is to skip
   the write and continue (the screen still functions; just no progress persistence). Log to
   console; do not surface to Marian.

**Coordination with `marian-tutor.stardust.v1`:**

- Math owns `marian-tutor.stardust.v1`. Session-End reads it (to get `cumulativeStardust`) and
  mirrors `total` into the history record. **Session-End does NOT write to the stardust key** —
  that's Math's contract.
- The mirror exists so that if `stardust.v1` is ever cleared independently (e.g., a future "reset
  progress" affordance), the history record retains the cumulative figure for any analytics or
  recovery surface. Two sources of truth, but `stardust.v1` wins for the live counter.

**What is NOT persisted (deliberately):**

- **Per-session breakdown.** No "session 1: 11 stardust, session 2: 8 stardust" log. v1 has no
  surface to display this and persisting it invites a parental dashboard scope creep we have
  rejected.
- **Wrong-answer counts.** Ever. Per CLAUDE.md "never a red X" and the wrong-answer recap policy
  below.
- **Per-problem timing.** Out of scope; would invite a "speed" framing that contradicts "Marian is
  building automaticity, not chasing a clock".
- **In-session streak.** Only `longestStreakEver` aggregate is persisted; the per-session streak
  state from Math resets to 0 at session end per screen-3-math.md:190.

**Schema versioning:** the `schemaVersion: 1` field is the same migration hook pattern as
`stardust.v1`. v2 of this schema (if/when we add per-session breakdowns or unlock-loop state) is a
single-version-bump migration.

---

## Wrong-answer recap policy

**Decision: count and celebrate the corrects implicitly via stardust; do NOT mention wrongs at
all.** This is locked.

**Rationale (Dave research memo principle, math-distractor-and-streak-decisions.md:42):**

> Children who experience a wrong answer early in a problem set show measurably elevated state
> anxiety that persists across subsequent items in the same session. The effect is stronger for
> younger children (grades 1–3) and for children who have low automaticity.

The same psychophysiological window logic extends to session-end framing. Enumerating misses
("you got 2 wrong!") at the closing moment turns the wrap-up into a graded report card and re-
elevates anxiety state that the closing chime is supposed to lower. Sources 4 (Mammarella et al.)
and 9 (Garon-Carrier et al., on bidirectional motivation/achievement) both support celebrate-the-
wins as the dominant framing for early-elementary practice contexts.

**What this means concretely:**

- The recap line is **"You earned `<N>` stars!"** — N is `totalStardust`, which already encodes
  the wins (one per clean correct + bonuses). N is never `totalCorrect` or "8 of 10 correct".
- The streak line celebrates her best run, not her broken runs. If she got 5 in a row then missed
  problem 6 then got 7 and 8 right, the streak line is "Five in a row! Wow!" — the miss and the
  recovery are silent.
- **No "you only need X more next time" copy. Ever.** That's the gap-framing pattern children's-
  app dark-pattern research explicitly warns against (math-distractor-and-streak-decisions.md:80,
  Bahar et al. citation).
- **No "great job — better than last time!" comparison copy.** Comparing past-Marian to present-
  Marian is the same competitive frame, just with herself as the opponent. Not in v1.
- **No emoji-grade or visual scoreboard** (no "★★★☆☆" out of 5 visualisation, no percentage, no
  bar chart).

**Internal state machine still tracks wrongs** — the Math screen needs them for the hint/guided-
completion threshold logic and the orchestrator may want them for end-of-session Claude calls
(progress model update per CLAUDE.md architecture). They just never surface to Marian on this
screen.

**Edge case — zero stardust earned:** per the §"Copy / TTS script" edge case above, the recap line
is skipped entirely. The opener and goodbye still play. We never say "you earned zero stars" with
Melody's celebration voice — that reads as a joke at her expense.

---

## States

### Idle (post-mount, all dispatch complete)

Default state after t=6200ms. Melody in `melody-celebrating` pose, slow ear-wiggle on a 4s loop
(very gentle — see Motion). Stardust counter shows `<N>`. Streak band visible iff `finalStreak ≥ 3`.
"All done!" CTA visible and tappable. Caption ribbon empty (last line's reveal complete then
ribbon fades to neutral).

No nag, no auto-advance, no re-prompt. Marian can sit on this screen as long as she wants. (If
she walks away, the screen sits indefinitely until she taps "All done!" or closes the PWA. iOS will
eventually background-suspend the tab; that's fine.)

### Happy path (default — she sees this screen)

Per the audio dispatch sequence above. ~6.2 seconds from mount to fully-settled idle.

### "All done!" tap

Per the audio dispatch sequence above. Chime + 300ms fade-out → Sleep splash (Option C
recommendation).

### Audio failure (orchestrator's GBUG-7 path, plus screen-local fallback)

If the session-start utterance bundle is malformed (e.g., `session.end.opener` MP3 missing or
fails to load):

- Melody pose stays at `melody-celebrating` with a static (no ear-wiggle) idle.
- TTS does not play; caption ribbon stays empty.
- Stardust counter still ticks up (uses local state, no audio dependency) — at a 1.8s linear
  duration matching the recap line's typical length.
- Streak band still shows iff `finalStreak ≥ 3` (uses local state).
- **Fallback timer: "All done!" CTA appears at t=4000ms** (vs. t=6200 in the happy-audio path).
  This guarantees Marian can leave the screen even with no audio. Implemented as a `setTimeout`
  armed on mount that's cancelled if `session.end.goodbye` `onPlay` fires normally.
- Devon should also log the audio failure to the console for diagnostic surfacing via the
  `?debug=1` overlay (per audio-architecture.md → "Failure modes" table).

### Error path

Not applicable — there are no inputs to get wrong on this screen. The only interaction is the
"All done!" CTA, which has no failure case beyond the standard audio-context unlock check
(handled by the chime SFX being gesture-aligned).

### Empty / first visit

The first time Marian completes a Math session, this is her first Session-End screen. The Session-1
spec (session-1.md:466–576) shows a 3-stars-from-3-moments miniature version after a 2-problem
first-run, which is a separate surface. The first 8-problem session is **the first time this
spec's screen mounts**. No special "first time" treatment — the screen's design assumes she's seen
similar shapes before (Session-1's reward + teaser). If she has not (i.e., she somehow skipped
Session-1), the surface is still self-explanatory: Melody cheers, a number ticks up, a button at
the bottom.

**Note on Session-1's "tomorrow teaser" (silhouette of fox):** that teaser is a Session-1-only
flourish (session-1.md:555). This spec (Session-2+ Session-End) does NOT carry the teaser forward,
because:

1. v1 has no proper "next session preview" engine — Session-1's fox is hand-picked as the next
   Word Song word; for Session-2+, the next session's content is generated by the next session-
   start Claude call and isn't known yet.
2. A teaser surface in v1 would either be vague ("more learning tomorrow!" — no real preview) or
   would force a synchronous Claude call to peek at the next session, which is wasteful.
3. Teasers cross into the dangerous territory of "come back tomorrow or miss out". Without
   careful framing they're a soft-FOMO trap.

When/if v2 builds a proper next-session preview engine, design the teaser then with explicit
anti-FOMO copy. Out of scope here.

### Transition in

- From Math (post-problem-8 happy path): Math's last problem's chips fade out (200ms), Math
  background cross-fades from `bg-garden.svg` to `bg-twilight.svg` over 600ms. Melody
  `layoutId="melody"` re-sizes from upper-left small to centered larger via spring
  `{ stiffness: 180, damping: 20 }` over ~700ms. Math's HUD strip fades out over 300ms (delayed
  to start at the same moment as the bg cross-fade).
- This screen mounts on Math's `onSessionComplete` callback. Math owns the cross-fade; Session-End
  mounts with all elements at opacity 0 and animates them in per the dispatch sequence.

### Transition out

- On "All done!" tap: 300ms fade to Sleep splash (per Option C recommendation). Melody's
  `layoutId` does NOT carry to the Sleep splash — the sleeping pose is a separate `<m.img>` that
  cross-fades in. (Carrying the layoutId would cause a visible "Melody slides position" moment
  during the swap, which feels unsettled.)

---

## Motion

| Element                       | Trigger                       | Spring / duration                                                                                   | Reduce-Motion fallback                                                                        |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Background cross-fade         | Math `onSessionComplete`      | 600ms `ease: "easeOut"`                                                                             | Same — fades are fine for Reduce Motion                                                       |
| Melody re-size + center       | Math `onSessionComplete`      | spring `{ stiffness: 180, damping: 20 }`, ~700ms                                                    | Direct teleport (no spring); opacity fade only                                                |
| Stardust burst (on entry)     | Mount, t=0                    | 20 `sparkle-particle.svg`, spring `{ stiffness: 120, damping: 18 }`, fade over 1.2s                 | No drift — particles render static for 800ms then fade                                        |
| Speech ribbon scale-in        | First TTS `onPlay`            | spring `{ stiffness: 260, damping: 20 }`, ~300ms                                                    | Direct opacity fade-in over 200ms                                                             |
| Caption word reveal           | Path A `onWordTick`           | per-word opacity 0→1 over 100ms                                                                     | Same — opacity reveals are fine                                                               |
| Stardust counter tick-up      | After opener, t=1400          | Numeric tween 0 → N over the recap utterance duration (~1.8s); per-tick `sfx.stardust-grain.play()` | Counter jumps to N instantly with one chime; no per-tick plinks (otherwise it sounds frantic) |
| Counter pop on each tick      | Per-tick                      | scale `1 → 1.05 → 1` over 150ms                                                                     | No pop                                                                                        |
| Streak band fade-in           | After streak utterance starts | opacity 0→1 + `y: 12 → 0` over 400ms                                                                | Opacity only, no y-shift                                                                      |
| Melody ear-wiggle (idle loop) | Settled state                 | sprite swap to `melody-happy` for 600ms every 4s                                                    | No swap; static `melody-celebrating` pose                                                     |
| "All done!" CTA scale-in      | After goodbye utterance       | spring `{ stiffness: 300, damping: 16 }`, ~400ms                                                    | Opacity fade-in over 200ms                                                                    |
| "All done!" CTA tap           | Tap                           | scale `1 → 0.95 → 1` over 200ms; chime SFX                                                          | Same                                                                                          |
| Screen fade-out               | Post-tap                      | Opacity 1 → 0 over 300ms                                                                            | Same                                                                                          |

**Reduce-Motion handling:** copy `usePrefersReducedMotion` from `Greet.tsx` (or use the shared
hook if Devon factors it out per screen-3-math.md:561). Same global `MotionConfig
reducedMotion="user"` covers infinite loops; the per-element fallbacks above are the explicit
absences spec'd here.

**No infinite loops EXCEPT:**

- Melody ear-wiggle every 4s — this is a calm idle loop, not a hype loop. Disabled with Reduce
  Motion.
- No background drift (twilight bg is static — different from Session-1's cloud drift).

**Performance sanity:**

- 20 sparkle particles in AnimatePresence simultaneously animating on entry. Single moment, then
  they unmount. Fine.
- Counter tick-up: a single numeric state with per-tick re-render. 11 ticks over 1.8s = ~6
  re-renders per second. Trivial.
- Streak band fade-in: single element. Trivial.
- No lists, no virtualisation needed.

---

## Assets required

Already in repo (no new authoring required for this spec):

| Asset                  | Used for                       | Size     |
| ---------------------- | ------------------------------ | -------- |
| `sparkle-particle.svg` | Stardust burst on entry        | <1 KB ✅ |
| `star-filled.svg`      | Session-stardust counter glyph | <2 KB ✅ |
| `sfx-chime-soft.mp3`   | "All done!" tap                | ~8 KB ✅ |

Already on `assets-todo.md` follow-up list (shared with Math screen — no new request from this
spec):

| Asset               | Used for                                     | Status                                                                                |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `bg-twilight.svg`   | Session-End background wash                  | On assets-todo (Session-1 deferred); see Open Q #2 about merging with `bg-clouds.svg` |
| `sfx-sparkle.mp3`   | Stardust burst SFX (reused from Math)        | On assets-todo (Math)                                                                 |
| `sfx-plink.mp3`     | Stardust counter per-tick (reused from Math) | On assets-todo (Math)                                                                 |
| `melody-sleepy.svg` | Sleep splash (post-"All done!" state)        | On assets-todo (Session-1 deferred); **load-bearing for Option C**                    |

**NEW asset gaps surfaced by this spec (flag to Thomas via Matt for art queue):**

| Asset                    | Used for                                      | Target size | Notes                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `melody-celebrating.svg` | Melody centered pose for Session-End opener   | 6–8 KB      | Arms up, ears wiggling, big smile. Distinct from `melody-happy.svg` (which is the ear-wiggle/correct-answer pose) — celebrating is the bigger, more "I'm proud of you" pose. **NEW — flag to Thomas.**                 |
| `sfx-cheer.mp3`          | Soft "ta-da" chord under "You did it!" opener | ~12 KB      | Gentle, not a game-show fanfare. Same constraint as Session-1 spec line 558. **NEW — flag to Thomas (Session-1 already requested it under the same name, but it's not yet on `assets-todo.md` per my read; confirm).** |

**Why not reuse `melody-happy.svg` for the celebrate pose:** `melody-happy` is the per-correct-
answer ear-wiggle pose (small, in-place reaction). Session-End's pose is a sustained celebration
moment — Melody is centred, larger, and the pose conveys "you did the whole thing", not "you got
that one right". Reusing the smaller pose for the bigger moment under-celebrates the surface and
breaks the visual hierarchy that says "this is the closing".

**TTS audio:** generated server-side at session-start. ~20 inline base64 MP3s per session, ~300 KB.
No static authored assets needed.

**Numerals:** stardust counter rendered as text in SF Pro Rounded display font per global
conventions. No image asset.

---

## Inline answers to Matt's flagged ambiguities

### #5 — Mid-session-end edge cases (link to `86c9grnjf`)

**This spec covers ONLY the "completed all 8 problems" path.** Mid-session abandonment (Marian
closes the PWA after problem 4 of 8) is owned by sibling ticket `86c9grnjf` ("what if Marian
closes the PWA?") which I understand is being dispatched to a parallel Kyle agent.

**My recommendation for `86c9grnjf`'s scope (forwarded as a courtesy, NOT this spec's contract):**

- On next launch after a mid-session close, do NOT show this Session-End screen for the
  abandoned session — she didn't reach the end, the celebration would be hollow.
- Instead, that ticket should design either (a) a clean "fresh start" path (new session JSON,
  problem 1 of 8 of a new session), or (b) a "resume where you left off" path (load the in-flight
  session JSON, jump to problem 5). The decision between (a) and (b) is a Thomas call belonging
  to that ticket.
- localStorage write contract: Math should write a `marian-tutor.session-in-progress.v1` key
  per-problem during the session, which `86c9grnjf` reads on launch to detect abandonment. THIS
  spec does NOT define that key — that's `86c9grnjf`'s shape to lock.
- This spec's `marian-tutor.session-history.v1` writes ONLY on Session-End mount, i.e., only on
  clean completion. An abandoned session never increments `sessionCount` or
  `lastSessionCompletedAt`. That's correct behaviour: history reflects completed sessions.

The two specs intersect only at the localStorage layer; otherwise they're independent surfaces.

### #6 — Wrong-answer accumulator behavior

Resolved in §Wrong-answer recap policy → "Decision: count and celebrate the corrects implicitly via
stardust; do NOT mention wrongs at all." Locked. Cited Dave research memo principle (Mammarella et
al. 2023 + Garon-Carrier et al. 2016).

---

## Out of scope

Explicitly NOT covered by this spec, with the ticket that owns each:

- **Per-problem replay** — no "tap to redo problem 4" affordance; future v2 if the parental side
  ever wants it. No ticket.
- **Parental dashboard** — no "Marian's progress this week" surface for parents. Future v2/v3. No
  ticket. (Out-of-scope reminder: per CLAUDE.md, Marian's iPad has no parental account; this is a
  single-user app.)
- **Sharing (social, AirDrop, screenshot prompt)** — no share affordances anywhere on this surface
  (or anywhere in the app per CLAUDE.md non-negotiables). Confirmed.
- **Multi-session aggregation visualisations** — no "you've earned 47 stardust this week!" chart,
  no calendar heatmap, no "best session ever" leaderboard. Stays in the localStorage layer; no
  surface displays it in v1.
- **Mid-session resume / abandonment recovery** — ticket `86c9grnjf`. See §Inline answers item #5.
- **Hub / menu screen** — does not exist in v1. If Thomas chooses Option B for the "All done!"
  CTA, the Hub becomes a new spec ticket and blocks this spec's impl. See Open Q #1.
- **Word Song Session-End** — this spec is the Math Session-End. Word Song will need its own
  Session-End spec (likely a near-copy of this with vocabulary swaps), or this spec gets
  generalised when the Word Song screen lands. No ticket for Word Song Session-End yet — flag for
  Matt's backlog.
- **Mixed Math + Word Song session-end (when sessions interleave both trees per CLAUDE.md)** —
  out of scope here; v1 ships Math-only sessions first per Marian's diagnostic priority.
- **Stardust unlock loop / cosmetic gallery** — flagged for v2 in screen-3-math.md:483. This spec
  does not surface unlock progress (see Open Q #3).
- **Streak persistence display** — `longestStreakEver` is persisted but never displayed on this
  screen. If a future "best ever" surface wants to show it, that's a separate spec.
- **Animations on Melody's mouth/eyes** — out of scope per Session-1 implementation note. Pose
  swaps only.
- **Voice input ("say goodbye to Melody!")** — v3, no ticket.

---

## Implementation pointers (for Devon)

**File layout:**

```
src/screens/SessionEnd/
├── SessionEnd.tsx              # Top-level screen (mirrors src/screens/Math/Math.tsx pattern)
├── StardustCounter.tsx         # Animated 0 → N tick-up display
├── StreakBand.tsx              # Conditional band, only renders if finalStreak >= 3
├── SleepSplash.tsx             # Post-"All done!" sleeping Melody surface (Option C)
├── sessionHistory.ts           # localStorage read/write helpers; schema versioning
└── sessionEndSequence.ts       # Per-step state machine (mirrors greetSequence.ts pattern)
```

**Reuse, do not re-derive:**

- **Path A `sessionAudio.playUtterance`:** same as Math (screen-3-math.md:540–542). Do not import
  `lib/tts.speak()` or `preRecorded.playGreetLine()` — neither is right for this screen.
- **Caption renderer:** copy from Math (which copies from Greet). Same `<m.span>` per-word with
  `data-revealed` toggle, same `text-[2.4rem]` size.
- **Melody cross-fade swap:** AnimatePresence default mode, `key={pose}` on `<m.img>`,
  src `/assets/melody-${pose}.svg`. For this screen, only pose changes are
  `celebrating` ↔ `happy` (during the 4s ear-wiggle idle loop). Sleep splash uses `sleepy` pose.
- **`useAudioUnlockGate`:** NOT needed on this screen (last gesture was within 1.2s — see
  §"Audio integration contract → Audio gate"). Do not import.
- **Spring presets:** match Math's table where applicable (screen-3-math.md:551–555). Specifically:
  - Melody re-size on transition-in: `{ stiffness: 180, damping: 20 }` (matches
    screen-3-math.md:554's transition value, slightly less damped here for the "growing into
    celebration" feel)
  - Stardust burst particles: `{ stiffness: 120, damping: 18 }` (matches Math's stardust grain)
  - Speech ribbon scale-in: `{ stiffness: 260, damping: 20 }` (matches Greet's ribbon scale-in
    spec from session-1.md:160)
  - "All done!" CTA scale-in: `{ stiffness: 300, damping: 16 }` (matches Math HUD pop)
- **`LazyMotion` + `m`:** same as everywhere else. 4.6 KB budget already paid; do not import bare
  `motion`.
- **`MotionConfig reducedMotion="user"`:** already global at app root.

**Dispatch contract from Math:**

```typescript
// In src/screens/Math/Math.tsx (already specified at screen-3-math.md:411):
type SessionCompletePayload = {
  totalCorrect: number // 0-8
  totalStardust: number // 0-11
  finalStreak: number // 0-8 (longest streak reached this session, not necessarily current)
}

type MathProps = {
  // ...existing props
  onSessionComplete: (payload: SessionCompletePayload) => void
}
```

Devon: when wiring SessionEnd into the app, Math's `onSessionComplete` should switch the route
state to render `<SessionEnd payload={...} />`. The cross-fade transition is owned by Math's
unmount + SessionEnd's mount (with shared bg cross-fade time).

**localStorage helpers in `src/screens/SessionEnd/sessionHistory.ts`:**

```typescript
export type SessionHistoryV1 = {
  schemaVersion: 1
  sessionCount: number
  lastSessionCompletedAt: string // ISO string; '' sentinel when sessionCount === 0
  longestStreakEver: number
  cumulativeStardust: number
}

export function readSessionHistory(): SessionHistoryV1 {
  /* with try/catch + default */
}
export function writeSessionHistory(next: SessionHistoryV1): void {
  /* with try/catch */
}
export function recordSessionEnd(
  finalStreak: number,
  cumulativeStardust: number,
): SessionHistoryV1 {
  /* read → compute next → write → return next */
}
```

Pure functions, fully unit-testable. Test cases for: first-ever session (default → record),
subsequent session (read → increment → write), `longestStreakEver` only increases (never
decreases), localStorage-throws path (fallback to in-memory state).

**Test seams (mirror Math + Greet patterns):**

- `SessionEnd` component takes `playUtteranceFn?: PlayUtteranceFn` prop, defaulting to live
  `sessionAudio.playUtterance`. Tests inject a fake.
- `SessionEnd` takes `chime?: Sfx`, `cheer?: Sfx`, `sparkle?: Sfx`, `plink?: Sfx` props for SFX
  injection.
- Session-history reads/writes thread through a `storage?: StorageAdapter` prop with localStorage
  default, in-memory mock for tests.
- Date for `lastSessionCompletedAt` threads through a `now?: () => Date` prop, defaulting to
  `() => new Date()`. Lets tests assert deterministic ISO strings.

**Touch-target validation:** "All done!" CTA is 88pt tall × ~220pt wide. Comfortably above the
60×60pt floor. Devon: add it to the dev-only touch-target debug overlay (Kevin's overlay per
Session-1 implementation note line 701 / screen-3-math.md:613).

**Performance sanity:**

- 20 sparkle particles in AnimatePresence at one moment on entry. Same pattern as Session-1
  Screen 5 (session-1.md:522). Fine.
- Counter tick-up: ~11 re-renders over 1.8s. Trivial.
- Sleep splash is a single static surface. Trivial.

**Accessibility:**

- Caption ribbon stays at ≥ 28pt per global typography rules (session-1.md:16).
- "All done!" CTA text at ≥ 28pt; the pill itself is 88pt tall so the text has plenty of vertical
  space.
- The Sleep splash text "Come back soon." at 28pt; stays on-screen until iPad backgrounds the
  PWA, so Marian (or any passing adult) can read it without time pressure.

---

## Acceptance criteria (Jessica)

Functional:

- [ ] Screen mounts when Math fires `onSessionComplete({ totalCorrect, totalStardust, finalStreak })`
- [ ] Background cross-fades from `bg-garden.svg` (Math) to `bg-twilight.svg` over 600ms
- [ ] Melody re-sizes from upper-left small to centered larger via spring; uses `melody-celebrating.svg`
- [ ] Stardust burst plays on entry (~20 particles, fade over 1.2s)
- [ ] Speech ribbon shows opener line "You did it!" word-by-word via Path A `onWordTick`
- [ ] Stardust counter ticks up from 0 to `totalStardust` over the recap utterance duration; each tick plinks
- [ ] If `totalStardust === 0`, recap utterance is skipped entirely; counter stays at 0
- [ ] Singular form ("one star") used iff `totalStardust === 1`; plural ("stars") used otherwise
- [ ] Streak band visible iff `finalStreak >= 3`; correct numeric variant fires (e.g. "Five in a row! Wow!")
- [ ] Goodbye utterance "See you soon." plays after streak band (or after recap if no streak)
- [ ] "All done!" CTA appears only after goodbye utterance settles (~6.2s on happy-audio path)
- [ ] Tapping "All done!" plays chime SFX, fades to Sleep splash over 300ms
- [ ] Sleep splash shows `melody-sleepy.svg` + "Come back soon." text; NO TTS plays on Sleep splash
- [ ] Sleep splash has zero interactive elements (no taps do anything)
- [ ] Screen sits idle indefinitely if "All done!" not tapped — no auto-advance, no nag

Audio:

- [ ] All TTS routed through `sessionAudio.playUtterance`, never `lib/tts.speak()` or `preRecorded.playGreetLine()`
- [ ] Pre-rendered utterance bundle includes: 1 opener + 12 recap variants (0–11) + 6 streak variants (3–8) + 1 goodbye = 20 utterances per session
- [ ] If audio bundle fails (`loaderror` on opener), fallback timer still surfaces "All done!" CTA at t=4000ms
- [ ] Cancellable mid-playback: tapping "All done!" before the goodbye utterance finishes cancels playback cleanly (no audio bleed into Sleep splash)

State persistence:

- [ ] On screen mount, `marian-tutor.session-history.v1` is written with `schemaVersion: 1`
- [ ] `sessionCount` increments by exactly 1 per Session-End mount
- [ ] `lastSessionCompletedAt` set to current ISO string
- [ ] `longestStreakEver` updates iff `finalStreak > prev.longestStreakEver`
- [ ] `cumulativeStardust` mirrors `marian-tutor.stardust.v1.total` value
- [ ] localStorage write wrapped in try/catch; private-browsing iOS does not crash the screen

Anti-dark-pattern:

- [ ] `totalCorrect` value never appears anywhere on the screen (numeric or otherwise)
- [ ] No "you got X wrong" copy in any TTS, caption, or visual
- [ ] No "X% correct" or grade-style framing
- [ ] No comparative copy ("better than last time", "your best ever", "X more next time")
- [ ] No countdown timer, no "session ends in X" copy
- [ ] No share, leaderboard, or social UI
- [ ] No "watch ad" or IAP affordance
- [ ] No "tap to start a new session" affordance on either Session-End or Sleep splash
- [ ] Sleep splash copy is "Come back soon." (warm closure), NOT "Don't forget to come back tomorrow!" (FOMO)
- [ ] No teaser of "tomorrow's word" or "tomorrow's problem" (different from Session-1's first-run-only fox teaser)

Touch + accessibility:

- [ ] "All done!" CTA touch target is 88pt tall × ≥ 220pt wide; well above 60×60pt floor
- [ ] Caption text ≥ 28pt
- [ ] Stardust counter numeral at 64pt, glyph at 32pt
- [ ] CTA text at ≥ 28pt
- [ ] Sleep splash text at ≥ 28pt
- [ ] With Reduce Motion: Melody re-size is opacity-only (no spring), particles are static then fade, counter jumps to N (no per-tick pop), streak band fades opacity-only (no y-shift), CTA fades in (no spring scale)

iPad PWA:

- [ ] Audio context already unlocked on screen entry (Math's last tap was the gesture); no `useAudioUnlockGate` ring should appear
- [ ] No audio dropouts mid-playback (opener → recap → streak → goodbye plays cleanly through)
- [ ] Sleep splash persists indefinitely; iPad backgrounds the tab eventually without crash
- [ ] If Marian closes the PWA on the Sleep splash, next launch starts fresh from Splash (no resume from Sleep splash)

---

## Open questions (need Thomas)

1. **"All done!" CTA destination — Option A / B / C.** Hard exit (impossible on iPad PWA), return to a hub (no hub exists in v1; balloons scope), or static "Come back soon!" sleep splash (recommended). **Default until decided:** Option C (Sleep splash with `melody-sleepy` + "Come back soon." text, no TTS, no further interactions). If Thomas picks B, this spec needs a sibling Hub spec before impl.

2. **Celebration message rotation vs. static.** Currently the opener is always "You did it!" and the goodbye is always "See you soon." — every session, identical. Alternative: ship 3–4 pre-rendered variants for each (e.g. opener: "You did it!" / "Great job!" / "Way to go!") and rotate per session deterministically (modulo `sessionCount`). **Pro of rotation:** less repetitive over weeks. **Con:** 6–8 more pre-rendered utterances per session bundle (~120 KB extra) and Marian may bond more strongly with the predictable line ("Melody always says 'You did it!'" — character signature). **Recommendation:** ship static "You did it!" + "See you soon." for v1; revisit rotation in v2 if it feels stale to Marian after 30+ sessions. **Default:** static.

3. **Stardust unlock loop on this surface.** CLAUDE.md mentions "unlocks" as part of gamification. Math screen-3-math.md §"Inline answers item #4" explicitly defers the unlock loop to v2 (no surface, no spec, no impl). Confirming Session-End ALSO has no unlock surface in v1 — the cumulative stardust is persisted but never displayed as "X more to unlock Y!". If Thomas wants any unlock progress indicator on this screen, that becomes its own scope item AND requires a v2 unlock-loop spec to land first. **Default:** no unlock surface in v1; cumulative stardust silently accumulates in localStorage.

4. **Audio recap interpolation strategy.** Three choices for the "You earned `<N>` stars!" line:
   - **(a)** Pre-render all 12 variants per session (current spec recommendation; ~180 KB).
   - **(b)** Concatenate pre-rendered "You earned" + per-N number + "stars" client-side via Howler sprite splicing or sequential plays (~30 KB total but gluing audio cleanly is hard; risk of awkward gaps; new code path).
   - **(c)** Live-synthesise via Web Speech at session-end (would re-introduce the dependency we explicitly rejected in audio-architecture.md; not viable).
   - **Recommendation:** (a). Bundle cost is fine, no new code paths, matches Math's per-problem-N pattern (screen-3-math.md:285). **Default:** (a).

5. **Sleep splash text — bilingual question.** "Come back soon." is English-only per CLAUDE.md "strict English-only" non-negotiable. Confirming this is not the spot to add Tagalog ("babalik ka soon!") even though the sleep splash is the most read-without-Melody moment in the session. **Default:** English only, locked. (Flagging because the strict policy is easy to accidentally cross on a "warm closure" surface; want explicit confirmation no exception is being made here.)

6. **Should `melody-celebrating` differ from `melody-happy` at all, or is reusing `melody-happy` (the per-correct ear-wiggle pose) acceptable for v1?** I argued in §Assets that they should be visually distinct (small-reaction vs sustained-celebration). If Thomas thinks the asset budget is tighter than I'm modeling, we can ship v1 reusing `melody-happy` here and author `melody-celebrating` only when art queue has bandwidth — that's a one-line `src` swap when the new asset lands. **Default until decided:** request `melody-celebrating` as a new asset; reuse `melody-happy` as the temporary stand-in if the art queue can't deliver before Devon's impl PR.

7. **Goodbye-line cadence.** Current spec runs goodbye at t=5000ms after streak band finishes (or skipping the streak gap). Total settled time is ~6.2s. Is that too fast (feels rushed)? Too slow (Marian's attention drifts)? **Default until decided:** ship at the spec'd timing; iterate based on Marian's first-week observation. (Flagging because a 6-second close-out is fundamentally a vibes call and Thomas owns vibes.)

---

## Anti-dark-pattern audit (this screen)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] No variable-ratio reward — every Session-End shows the same number of stardust she earned, in the same animated form, every time. No surprises, no random bonuses.
- [x] No streak shame — the streak summary celebrates the longest run she hit; broken-mid-session streaks are silent (the "she missed problem 6 then got 7+8" case still celebrates the 5-in-a-row she had earlier). Streak band is hidden entirely if `finalStreak < 3` so a low streak isn't a thing to feel bad about.
- [x] No fake urgency — "See you soon." is warm. NOT "Come back in 23 hours or lose your streak!" Sleep splash also says "Come back soon." (warm closure), NOT "Don't forget about Melody!" (FOMO).
- [x] No social pressure — no leaderboards, no share, no "X% of kids her age finished a session today".
- [x] No infinite content — exactly one closing surface, then Sleep splash, then nothing. No "tap here for a bonus problem!" loop.
- [x] No dark patterns on exit — single CTA, no friction-on-exit dialog, no "are you sure?" gate.
- [x] No surprise costs — no IAP, no "buy more stardust", no monetization UI of any kind.
- [x] Wrong answers are never enumerated — `totalCorrect` is received as data but never displayed; recap line celebrates stardust earned, never "X right out of 8".
- [x] No re-engagement nudge — Sleep splash has zero interactivity; nothing to tap, nothing to invite the next session, no "come back tomorrow!" CTA. Marian closes the PWA when she's done; the app does not chase her.

---

## Provenance

- Brief: ClickUp ticket `86c9grnjd` (normal priority, week-3).
- Math handoff contract: `design/screen-3-math.md` (locked at PR #38, commit `8a2e477`).
- Audio architecture canonical reference: `design/audio-architecture.md` (PR #27).
- Session-1 walkthrough (mini Session-End — 3 stars from 3 moments): `design/session-1.md` § "Screen 5 — Reward + End-of-Session Teaser".
- Greet implementation pattern reference: `src/screens/Greet.tsx`, `src/lib/audio/useAudioUnlockGate.ts`, `src/lib/audio/preRecorded.ts`.
- Wrong-answer-recap policy evidence: `design/research/math-distractor-and-streak-decisions.md` (Mammarella et al. 2023, Garon-Carrier et al. 2016).
- Sibling spec (mid-session abandonment, NOT covered here): ticket `86c9grnjf`.
