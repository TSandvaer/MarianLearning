# Screen Hub — Landing / Skill-Tree Picker

**Audience:** Devon (impl, ticket TBD), Kevin (review), Jessica (QA), Thomas (taste).
**Author:** Marian Tutor design persona — ticket `86c9hab6y`.
**Status:** Spec — draft. Implementation blocked on this PR merging and Thomas approval.
**Surface:** iPad portrait PWA, home-screen installed.
**Scope:** Landing screen reached on app-open (Session 2+), reached after Session-End "All done!" tap (once Devon flips the route per ticket `86c9gugm7`), and reached when Marian taps Back from a content screen mid-session. Replaces the Sleep splash as the post-session destination once shipped.

This file is the canonical spec for the Hub screen. Hub is **not** the Session 1 first-run path —
that's Greet (`design/session-1.md` § "Screen 2"). Greet remains a one-time onboarding moment
before any Hub ever renders. From Session 2 onward, Hub is the home of the app: every launch and
every session-end lands here.

> **Dave's research integrated.** The developmental memo at
> `design/research/hub-navigation-research-86c9hab6y.md` (landed 2026-04-27) is integrated
> throughout this spec. Five research-grounded calls: (1) two-tile symmetric picker with a
> soft guided default — Bao & Lam's relational-autonomy finding (Melody can suggest without
> undermining); (2) **day-streak** is shown only when active and **silently resets to 0** on
> missed days — never a broken-streak state, ever (Kahneman & Tversky loss-aversion);
> (3) skill tree rendered as a **linear path with glowing icon nodes**, not a dot row, not a
> graph (Tversky 2011, Cowan 2016 working memory); (4) parent gate is a **2-second corner
> long-press**, not a tap pattern (PMC 2020 child gesture study); (5) welcome line uses an
> 80/20 stable-anchor model with rapid-re-mount suppression — entry-path variants from the
> orchestration brief survive but nest inside the anchor model.

---

## Goal

When Marian opens the app or finishes a session, she lands on a calm picker where she can choose
between Number Garden (math) and Word Song (literacy), see her stardust quietly accumulating, and
get a warm "hi, you're back" moment from Melody. The screen makes "what to do next" unambiguous
in one tap, and makes "I'm done for today" trivial (just close the iPad — the screen sits quietly
without nagging).

**This is not** a dashboard, a settings menu, a quest log, a daily-streak prompt, or a "Marian's
progress this week" report. It's a friend's front porch.

---

## User state entering this screen

Three paths in:

1. **App-open path (Session 2+).** Marian taps the Melody home-screen icon. PWA cold-launches,
   Splash auto-advances per `design/session-1.md` § "Screen 1 — Splash / Launch" (1500ms warm /
   up to 3000ms cold), then Hub mounts. Audio context **not yet unlocked** — Splash is silent
   and the Hub mount is a non-interactive transition. `useAudioUnlockGate` applies.
2. **Session-End "All done!" path (post `86c9gugm7` route flip).** Marian tapped "All done!" on
   Session-End. Sleep splash is no longer the destination once that ticket lands; the route
   target switches to Hub. Audio context **already unlocked** (the "All done!" tap was the
   gesture).
3. **Mid-skill back path.** Marian taps the back affordance from inside Math or Word Song
   mid-session. (Back affordance does not exist in v1 today — adding it is one of this spec's
   asks; see §"Mid-skill exit contract".) Audio context already unlocked.

Hub does not care which path she took for its core layout — Melody greets, the two skill-tree
nodes are present, the parent-area corner is present (or hidden, per Open Q #1). The only
difference is the welcome-back greeting flavour, covered in §"Melody welcome-back greeting".

---

## Visual layout

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 47                                    |  <- HUD: stardust total (left);
|  cumulative                              |     invisible parent-gate zone
|                                          |     (top-right 96×96, no glyph)
|  ~ pastel sky-meadow background ~        |
|                                          |
|  ( Melody — idle/breathing,              |
|    centred upper, ~22vh )                |
|                                          |
|       +-----------------------+          |
|       | "Hi! Try Word Song?"  |          |  <- speech ribbon, word-by-word
|       +-----------------------+          |
|                                          |
|                                          |
|   +------------------+  +-------------+  |
|   |   🌸 🌼 🌷       |  |  ♪ ♫ ♬      |  |  <- 2 skill-tree nodes, each
|   |                  |  |             |  |     ~280pt × 280pt, 28pt gap
|   |  Number Garden   |  |  Word Song  |  |     suggested node has soft
|   |  ✓─✓─★(glow)─🔒─🔒|  |  ✓─★─🔒─🔒─🔒|  |     2pt rose ring border
|   +------------------+  +-------------+  |
|                                          |
|                                          |
|              ★ 5    🔥 4                 |  <- recent stats strip:
|         today's session  day streak      |     hides unless something
|                                          |     positive to say
|        [safe area bottom]                |
+------------------------------------------+
```

**Vertical rhythm (top → bottom, portrait iPad ~1024pt tall):**

| Band               | Height    | Contents                                                                           |
| ------------------ | --------- | ---------------------------------------------------------------------------------- |
| Safe-area top      | env inset | —                                                                                  |
| HUD strip          | 56pt      | Cumulative stardust counter (left); invisible 96×96pt parent-gate zone (top-right) |
| Background         | full      | `bg-meadow.svg` — pastel sky + meadow horizon, no hard edges                       |
| Melody + ribbon    | ~22vh     | Melody centred-upper at ~22vh; ribbon below her                                    |
| Spacer             | ~6vh      | Breathing room                                                                     |
| Skill-tree picker  | ~36vh     | 2 nodes side-by-side, each 280×280pt, 28pt centre gap                              |
| Recent-stats strip | ~8vh      | Conditional band (hidden if no session within ~24h); fixed-height slot             |
| Safe-area bottom   | env inset | —                                                                                  |

**Thumb zone.** The skill-tree picker nodes sit centred vertically around the 60–75% region of
the viewport — well within the bottom-60% thumb-reach rule from CLAUDE.md and inside the
ergonomic sweet spot for iPad-in-lap. Both nodes are 280×280pt — comfortably larger than the
88pt floor mandated for primary actions; this is intentional, the picker is the load-bearing
choice on this screen and the nodes deserve to feel like "places", not "buttons".

**HUD — what the cumulative stardust counter is.** Top-left of the HUD strip shows the
**all-time** stardust total — `marian-tutor.session-history.v1.cumulativeStardust`. This is the
running total across every session Marian has ever completed. It is **not** the in-session
stardust counter (that one only exists during Math/Word Song play). The Hub HUD is the only
v1 surface that displays the cumulative figure to Marian.

**HUD — parent-area gate (invisible).** Top-right corner has a 96×96pt long-press zone with
**no visible glyph or affordance** in v1 (Dave-locked; see §"Parent area"). The cumulative
stardust counter is left-anchored, so this corner is otherwise empty visually. The long-press
handler is mounted; gesture detection is verified via QA but no Marian-facing UI changes.

**Why two nodes, not three or more.** v1 has exactly two skill trees per CLAUDE.md ("Number
Garden" and "Word Song"). Adding placeholder "coming soon" nodes for future trees would be
clutter and a soft promise we can't budget against. When v2 introduces a third tree, this layout
re-flows to a 3-up grid; the spec for that lives with that ticket.

**Soft guided default — Melody's nudge.** Per Dave's memo (Q1, citing Ryan & Deci's
Self-Determination Theory and Bao & Lam's finding that relational warmth preserves autonomy
even under guidance), Melody softly suggests one of the two trees on each visit. The
suggestion is a visual nudge on one node + an audio mention from Melody — never a forced
sequence, both nodes always tappable.

**Suggestion algorithm (deterministic, no ML, no random):**

1. **If today's session has not yet touched a tree**, suggest that tree. (Marian opened the
   app, did Number Garden, then closed; on next Hub visit later that day, suggest Word Song.)
2. **If both trees have been touched today**, no suggestion — both nodes are equal.
3. **If neither has been touched today** (first session of the day), suggest the tree she did
   _less_ of yesterday by stardust earned. Tie-break: alternate from the prior day's
   suggestion target (so suggestion alternates day-to-day on a balanced practice cadence).
4. **Anti-nag cap:** if Marian has overridden the same suggestion direction 3 days in a row
   (consistently picks the non-suggested tree), suspend suggestions for 2 days. After the cool-down
   the algorithm resumes; if she keeps overriding, suspend again. (Per Dave's appendix:
   "do not nag.")

**Visual treatment of the suggested node:**

- A soft 2pt ring at `--my-rose` around the card border, 80% opacity.
- A subtle glow shimmer (one cycle on Hub mount, then settled — no infinite loop).
- The non-suggested node is otherwise visually identical (no dimming, no badging).

**Audio treatment.** Melody's welcome-back line is the audio carrier of the suggestion. The
"first time today" variant becomes context-aware: instead of the static "Hi! What today?",
the suggestion-aware variant is "Hi! Try Word Song?" or "Hi! Try Number Garden?" — soft
question form, never imperative. (See §"Melody welcome-back greeting" → Suggestion-aware
variants below.)

**Persistence.** Suggestion state lives in `marian-tutor.session-history.v1` (or v2 per the
schema bump in §"localStorage updates required"). Two new fields:

```typescript
type SessionHistoryV2 = {
  // ...existing fields
  /** Trees touched today, keyed by ISO yyyy-mm-dd. Cleared lazily when the
   *  date rolls over. */
  todayTreesTouched: {
    date: string
    trees: Array<'number-garden' | 'word-song'>
  }
  /** Most recent suggestion direction; used for tie-break alternation. */
  lastSuggestion: 'number-garden' | 'word-song' | null
  /** Consecutive overrides of the same suggestion direction. Cap at 3
   *  triggers cool-down. */
  consecutiveOverrides: number
}
```

This adds two more fields to the schema bump in §"localStorage updates required" — the
`lastSessionStardust` field becomes one of three additions, all under the same v2 migration.

**Why no menu/settings sidebar, no nav rail, no tabs.** Hub is two tappable pictures and a
greeting. Anything more is dashboard-shaped, which is the wrong vibe for an 8-year-old's home
screen. The parent area is the only "settings" surface and lives behind a deliberate gate.

---

## Skill-tree picker — node design

Each node is a **place card**: a soft-rounded card showing the tree's signature visual
(flowers for Number Garden, music notes for Word Song), the tree name as text under the visual,
and a **linear path strip** at the card bottom showing 3–5 stage icons in physical order.

```
+----------------------------------+
|                                  |
|       🌸 🌼 🌷                   |  <- 3 flower glyphs, 64pt, gentle tilt
|                                  |
|                                  |
|         Number Garden            |  <- 28pt SF Pro Rounded display
|                                  |
|     ✓ ─ ✓ ─ ★(glow) ─ 🔒 ─ 🔒    |  <- 5-icon path strip (28pt icons,
|                                  |     12pt connector dashes)
+----------------------------------+
       ↑ 280pt sq, 32pt radius
```

### Stage path — Dave-grounded design

Per Dave's memo (Q3, citing Tversky 2011 on diagrammatic reasoning + Cowan 2016 on age-8
working memory at 5–6 items + NNGroup on hidden-affordance discovery), the skill ladder is
rendered as a **linear path of icon nodes**, not a dot row and not a graph:

- **Spatial ordering does the work.** Left-to-right reading order encodes "earlier → later"
  without requiring schema comprehension. Marian doesn't need to learn a tree-graph convention
  to read this.
- **Icons carry meaning, not text.** No stage labels under the icons (she's reading-emergent;
  text would be invisible to her). Icons are the affordance. Melody's TTS names the
  current-stage on Hub mount via the welcome line (see §"Melody welcome-back greeting →
  Suggestion-aware variants" — the suggestion line names the tree, and the implicit
  understanding that "the glowing icon is what we'll do" carries the rest).
- **Visible window: 5 nodes max.** Fits Cowan's working-memory capacity bound for the age.
  Nodes earlier than "current minus 1" and later than "current plus 3" are not shown on this
  card — the visible window slides as Marian progresses.
- **Glow + lock convention.** Pre-existing iconography from games — children at 8 already
  read "glowing thing = act on this" and "padlock = not yet." No new schema learning required.

### Icon states

| State                 | Visual                                                                                                                         | Meaning                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Mastered**          | `✓` solid 28pt at `--my-rose`, white-cream interior fill                                                                       | Stage mastered per orchestrator's progress model             |
| **In-progress**       | Stage's signature mini-icon (e.g. `+` for add-to-10, `Aa` for letter-sounds) at `--my-pink-50`, no glow                        | Some sessions touched, not yet mastered                      |
| **Current — next-up** | Stage's mini-icon at full saturation + soft 2pt outer glow ring at `--my-rose`, single-cycle shimmer on Hub mount then settled | The stage tonight's session will mostly focus on             |
| **Locked (future)**   | `🔒` (or padlock SVG) at `--my-pink-30`, opacity 0.6                                                                           | Stage not yet reached; not tappable; no "how to unlock" copy |
| **Connector**         | 12pt dashed line `—` between icons, color matches the _earlier_ node's state                                                   | Reinforces the path / temporal ordering                      |

Per Dave's memo: **no text labels on the path icons.** The text-free convention reduces
working-memory load and respects Marian's reading-emergent level. Tapping an individual icon
does nothing — the _whole node_ is the tap target. The path strip is informative-only.

### Sliding window — which 5 stages render

For each tree, render this slice:

```
[current_index - 1]  [current_index]  [current_index + 1]  [current_index + 2]  [current_index + 3]
```

Edge cases:

- **Marian is on stage 0** (first-ever stage): show 0, 1, 2, 3, 4 (no leftward slot — visually
  treat the leftmost icon as the start; no "before this" connector).
- **Marian is on the last stage**: show last-4, last-3, last-2, last-1, last; rightmost is the
  current/glowing node. No "and more!" trailing glyph in v1.
- **Number Garden** has ~10 stages (per CLAUDE.md: number recog → add to 10 → ... → x6-9).
  **Word Song** has ~7 stages. The sliding window handles both honestly; we never show a
  whole-tree visualisation, just the local 5-window.

**Why no whole-tree map, no branching graph.** Per Dave's Tversky citation: graph schema
comprehension requires explicit instruction. We don't have that. A linear sliding window
honours the v1 progression (locked linear per CLAUDE.md, no branching choices in v1) without
asking Marian to read a diagram convention.

**Why no "skill complete!" celebration on the Hub.** Stage transitions happen at session-end,
not at Hub-view. Hub just renders the current state — celebrations live in the session
end-screen if/when a stage rolls over (out of scope for v1; flag as v2 enhancement).

### Locked vs unlocked nodes

In v1, **both nodes are always unlocked from the first session** — Marian needs both math and
literacy daily, gating one behind the other would be punishing. The locked-node visual is
spec'd here defensively for v2+, when a future tree might be locked behind a stardust threshold
or a stage-of-prior-tree threshold:

| State                     | Visual treatment                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unlocked (v1 default)** | Full colour, gentle 4s breathing scale loop (1.0 → 1.02 → 1.0), tappable                                                                                                                                                                                                                                                                          |
| **Locked (v2+)**          | Desaturated to 60%, no breathing loop, padlock glyph in top-right of card, tap shows a single line "Coming soon!" with no further detail. **Never** show "earn 47 more stardust to unlock" — that's the gap-framing dark pattern Mammarella et al. (cited in `design/research/math-distractor-and-streak-decisions.md`) explicitly warns against. |

**Defer to v2.** No locked node ships in v1.

### Tap behaviour

Tap on a node:

1. Synchronous SFX: `sfx.chime-soft.mp3` (reused).
2. Synchronous TTS dispatch: `hub.enter.<tree>` utterance (e.g. "Number Garden!" or "Word Song!").
3. Card scales `1 → 0.96 → 1.04 → 1` over 350ms (a tiny "press and bloom" spring).
4. Card-specific signature visual blooms: flowers gently expand outward by ~12pt, then fade as
   the screen transitions; or music notes float upward.
5. Background cross-fade begins at +200ms: `bg-meadow.svg` → `bg-garden.svg` (Number Garden) or
   `bg-meadow.svg` → `bg-song.svg` (Word Song), 600ms.
6. At +600ms: the relevant content screen mounts. Melody `layoutId="melody"` re-anchors from
   centred-upper to upper-left small via spring `{ stiffness: 180, damping: 22 }`, ~500ms.
7. Hub unmounts as part of the cross-fade.

**No confirmation dialog.** Tapping a node commits — there is no "Are you sure?" The
Math/Word Song screens are themselves reversible (Marian can back out of a session, see
§"Mid-skill exit contract"), so the picker tap doesn't need to be guarded.

**No tutorial overlay.** First-Hub-visit (post-Session-1) does not show a coach-mark, an arrow,
or a "tap one to start!" hint. Melody's spoken line ("Hi! What today?") and the visible nodes
are sufficient affordance for an 8-year-old. Tutorials-on-top-of-tutorials read as condescension.

---

## Session stats

What surfaces, what stays in localStorage:

### Always visible

| Element                   | Source                                                      | Where                   | Why                                                                   |
| ------------------------- | ----------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| Cumulative stardust total | `session-history.v1.cumulativeStardust`                     | HUD top-left            | She earned this; it should always be present, not hidden behind a tap |
| Per-tree stage path strip | Tree progress model (see §"Skill-tree picker → Stage path") | Inside each picker node | Wayfinding — "where am I in this tree?"                               |

### Conditionally visible — recent-stats strip

A single bottom band that only renders if it has something positive to say. Per Dave's memo
(Q2, citing Kahneman & Tversky's Prospect Theory and the dark-pattern review on streak
shame), **the strip never displays a broken-streak state, never a "your streak is gone"
copy, never a 0-streak.**

```
              ★ 5    🔥 4
        today's session   day streak
```

| Element                       | Source                                                                                                | Visible when                                                                                    | Notes                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Today's session stardust      | Last session's `totalStardust` (new field on `session-history.v1`; see §"localStorage updates" below) | `now() - lastSessionCompletedAt < 24h`                                                          | Reads as "what we did together earlier today"                                                      |
| Day streak (consecutive days) | New field `dayStreak` (see §"localStorage updates" below)                                             | Visible **only** when `dayStreak >= 1` AND last-session-was-today OR last-session-was-yesterday | Per Dave: positive-only. Silently resets to 0 on missed-day; never displays "0" or "streak broken" |

If neither value qualifies (first-ever Hub visit, missed multi-day return), the strip is hidden
entirely and the spacer above it expands to fill the slot. **Layout does not reflow** — the
band's slot is fixed-height, just rendered empty.

### Day-streak computation rules (Dave-locked)

The day-streak is the count of consecutive calendar days on which Marian completed at least
one session. Recipe:

```typescript
function computeDayStreak(history: SessionHistoryV2, now: Date): number {
  const last = parseISO(history.lastSessionCompletedAt)
  const daysSinceLast = differenceInCalendarDays(now, last)
  if (daysSinceLast === 0) return history.dayStreak // already counted today
  if (daysSinceLast === 1) return history.dayStreak + 1 // continues; bumped on next session-end
  return 0 // missed a day; silent reset
}
```

**Crucial rule: the strip-visibility check happens BEFORE the silent reset is rendered.**
If `daysSinceLast >= 2`, the streak silently resets to 0 internally AND the strip simply
hides — Marian never sees "Day streak: 0" or "Streak broken." She just sees a Hub with no
strip, identical to a first-ever-Hub visit. The reset is a quiet bookkeeping operation, not
a UX event.

**Per Dave's memo Q2 verbatim:** "If a day is missed, the day-streak simply resets silently
to 0 when she next returns, with Melody's 'welcome back' being neutral-positive, not
punitive."

**The day-streak is a Hub-only surface.** Session-End does NOT display day-streak (Session-End
already shows in-session streak). The two streaks are different concepts and never co-display.

### Best-streak-ever — moved to parent area v2

Previously this section displayed `longestStreakEver` on the Hub strip. Per Dave's appendix
("Q2 — Against the positive-only streak recommendation"), the appropriate venue for
best-streak-ever and missed-day data is **the parent area, not the child UI**. Thomas can
see the historical record; Marian sees only what's currently positive.

For v1, `longestStreakEver` continues to persist via `session-history.v1` (Session-End writes
it per `screen-5-session-end.md:469`) but is **not displayed anywhere on Hub** in v1. It's
reserved for the v2 parent-area detailed-stats view.

### Never visible on Hub (intentionally) — Dave-reinforced

- **Session count** ("47 sessions completed!"). Persisted, never displayed. Reads as a chore log.
- **Wrong-answer counts.** Per CLAUDE.md "never a red X" — wrongs never surface anywhere, including
  here. (Already excluded from `session-history.v1`.)
- **Per-session breakdown.** No "Session 1: 11 stars, Session 2: 8 stars" history list. No
  surface in v1 needs it; persisting + displaying invites comparison framing.
- **Best-streak-ever** (`longestStreakEver`). Per Dave's memo: parent-area-only data, never
  child-facing. v2 surfaces it; v1 silently persists.
- **Day-streak when zero or broken.** Per Dave: "never display 'streak broken,' never send a
  'you broke your streak' notification." Day-streak is rendered iff `dayStreak >= 1` AND the
  last session was today or yesterday.
- **Calendar / streak heatmap.** No "you played 4 days last week" visualisation. Even positive
  framing ("4-day streak!") becomes a guilt trigger on day 5 if she misses one. Per Dave:
  parent-area v2 data, not child UI.
- **Time-spent.** No "you've practised for 2h 14m this week" stat. Speed/duration is the wrong
  frame for Marian's automaticity work.
- **Comparative copy** ("better than yesterday!", "almost your best!"). Never. Same rule as
  Session-End's wrong-answer recap policy.

### localStorage updates required — `session-history.v2`

Hub introduces four new fields to `session-history`, justifying a single v1 → v2 schema bump:

```typescript
type SessionHistoryV2 = {
  schemaVersion: 2
  // --- v1 fields, unchanged ---
  sessionCount: number
  lastSessionCompletedAt: string
  longestStreakEver: number // persists; not displayed in v1 (parent-area v2)
  cumulativeStardust: number
  // --- new in v2 ---
  /** Stardust earned in the most recent session. Mirror of the
   *  `totalStardust` payload from the originating Session-End mount. */
  lastSessionStardust: number
  /** Consecutive-days streak. Bumped at Session-End if the last session was
   *  yesterday; left alone if the last session was today; silently reset to 0
   *  if any further days passed. */
  dayStreak: number
  /** Trees touched today, keyed by ISO yyyy-mm-dd. Cleared lazily when the
   *  date rolls over (read-time cleanup). Drives the soft-suggestion algorithm. */
  todayTreesTouched: {
    date: string
    trees: Array<'number-garden' | 'word-song'>
  }
  /** Most recent suggestion direction; used for tie-break alternation. */
  lastSuggestion: 'number-garden' | 'word-song' | null
  /** Consecutive overrides of the same suggestion direction. Cap at 3 triggers
   *  the 2-day suggestion cool-down (per Dave's anti-nag appendix). */
  consecutiveOverrides: number
}
```

**Schema migration.** Single version bump from v1 to v2. The migration in
`src/screens/SessionEnd/sessionHistory.ts` reads v1 (or empty), promotes to v2 by adding the
five new fields with defaults:

```typescript
function migrateV1toV2(prev: SessionHistoryV1): SessionHistoryV2 {
  return {
    ...prev,
    schemaVersion: 2,
    lastSessionStardust: 0,
    dayStreak: 0,
    todayTreesTouched: { date: '', trees: [] },
    lastSuggestion: null,
    consecutiveOverrides: 0,
  }
}
```

The migration runs lazily: if `readSessionHistory()` finds `schemaVersion === 1`, it migrates
in-memory and writes the v2 shape on the next `writeSessionHistory()` call (no separate
migration run on app launch).

**Write moments:**

- `lastSessionStardust` — written at Session-End by `recordSessionEnd()`, sourced from
  `marian-tutor.stardust.v1.total - prev.cumulativeStardust` (or directly from the
  `totalStardust` payload — same value).
- `dayStreak` — written at Session-End by `recordSessionEnd()` per the
  `computeDayStreak` recipe in §"Day-streak computation rules".
- `todayTreesTouched` — written when a content screen mounts via the orchestrator's
  session-start path (Math or Word Song first problem; the touched-tree is appended). Stale
  entries (date < today) are cleared on the next read.
- `lastSuggestion`, `consecutiveOverrides` — written when Hub mounts, after computing the
  suggestion target and detecting whether the previous suggestion was overridden by
  Marian's last node-tap.

---

## Parent area

**Recommendation: defer to v2. Ship Hub v1 with the parent-area gate visible but disabled.**

### Why defer

1. **Marian uses her own iPad.** Per CLAUDE.md the device is single-user; there is no "switch to
   parent" use case in normal play. A parent area that's only used by Thomas occasionally
   (and that Marian must know not to enter) creates a discoverability risk for an 8-year-old
   who may explore the icon out of curiosity.
2. **The settings v1 wants are minimal.** Volume control belongs at the OS level (iPad side
   buttons). Language toggle is forbidden by the strict English-only non-negotiable. "Reset
   progress" is the most likely v1 control, but resetting is a destructive operation that needs
   careful confirmation flow — too much surface for v1.
3. **Detailed-stats viewing for parents** is a real future need but blocks on a session-history
   schema that supports it (per-session breakdown not currently persisted; see §"Session stats →
   Never visible"). That's a v2 work-item, not a v1 polish.
4. **The visible-but-disabled gate** keeps the spatial reservation for v2 without committing
   scope now. When v2 lands, it slots into the existing corner without a layout reflow.

### What ships in v1

**No visible glyph.** Per Dave's memo (Q4, citing NNGroup on hidden-affordance discoverability
for ages 6–8), the v1 parent-gate is a **completely invisible 2-second corner long-press
target**. There is no visible ⚙ icon, no badge, no tooltip — nothing in Marian's normal play
zone (centre-lower screen) and nothing in the corners that would invite curious tap-tap
exploration.

The invisible target is a 96×96pt zone in the top-right corner of the HUD strip (above the
play-zone the children's-UX research identifies as "natural"). Long-press behaviour:

1. **t < 2000ms** — no visible feedback. The press is silently accumulating duration.
2. **t = 2000ms** — long-press completes. In v1 this is a no-op: no modal opens, no audio
   plays, no Melody line. The gesture is detected and _registered_ in a dev-only console log
   for QA verification (so Jessica can confirm the gate fires correctly), but no parent-area
   surface exists yet to navigate to.
3. **Tap-only or short-press in the same zone** — does nothing. The zone is silent under
   short interactions; only sustained 2-second contact triggers anything.

**Why no v1 visible feedback even on long-press completion.** Until the v2 parent area exists
to enter, surfacing "you found the gate!" feedback would either (a) show Marian a modal she
can't actually use (confusing) or (b) reveal the gate's location (defeats v2's gating model).
The dev-only console log lets Devon and Jessica verify the gesture handler without exposing
the gate to Marian.

**Why no visible glyph at all in v1.** The previous draft proposed a visible ⚙ that shook
on tap. Dave's memo flags this as a child-anxiety risk ("what does that mean? did I do
something wrong?") AND a discoverability risk ("any visible affordance will be tapped within a
session by a curious 8-year-old"). The cleaner approach is no visible affordance — the gate is
"invisible to the child by design, discoverable to parents via one-time disclosure." Per
Dave's appendix Q4 mitigation: at PWA install time, Thomas sees a one-time card explaining
"Press and hold the top-right corner of the Hub for 2 seconds to access parent settings."

**Spatial reservation for v2.** The 96×96pt corner zone is reserved at the layout level; v2's
parent area mounts via the same long-press handler. v2 may or may not add a visible glyph at
that point — Dave's memo argues for keeping it invisible permanently (since accidentally-tapped
gates are a known child-app failure mode), but that's a v2 design decision.

### Long-press detection — Devon's contract (v1)

```typescript
// In src/screens/Hub/Hub.tsx (or a hook):
function useParentGateLongPress(onComplete: () => void) {
  const timerRef = useRef<number | null>(null)
  const startedRef = useRef<number | null>(null)

  const handlePointerDown = (e: PointerEvent) => {
    if (!isInCornerZone(e.clientX, e.clientY)) return
    startedRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      console.log('[Hub] parent-gate long-press detected (v1 no-op)')
      onComplete()
      startedRef.current = null
    }, 2000)
  }

  const handlePointerUp = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startedRef.current = null
  }

  // Cancel on pointermove that drifts outside the zone (drag-out)
  const handlePointerMove = (e: PointerEvent) => {
    if (startedRef.current !== null && !isInCornerZone(e.clientX, e.clientY)) {
      handlePointerUp()
    }
  }
  // ...
}
```

`isInCornerZone` resolves to a 96×96pt rect anchored at the top-right safe-area inset. The
zone overlaps with no other tap targets — the cumulative-stardust counter is left-anchored;
no Hub controls live in the top-right.

> **Note for Thomas.** This represents a meaningful change from the orchestration brief's
> "long-press / multi-tap" framing — Dave's memo specifically rejected the multi-tap
> mechanism (children memorise patterns; observable + repeatable). The 2-second corner
> long-press is the research-grounded choice. The orchestration brief left the mechanism
> open; Dave closed it. If Thomas prefers a different gating mechanism, flag in Open Q #1.

### What v2 should include (sketch, not spec)

When v2 builds the actual parent area:

| Control             | Spec-needed                                              | Notes                                                                                    |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Volume slider       | Probably not — iPad side buttons cover this              | Skip unless Thomas insists                                                               |
| Language toggle     | **No** — strict English-only is a project non-negotiable | Never ship                                                                               |
| Reset progress      | Yes, with double-confirm                                 | "Are you sure?" → "This will erase Marian's stars" → typed confirmation or 3-second hold |
| View detailed stats | Yes                                                      | Requires per-session breakdown schema first                                              |
| Disable parent gate | Probably not — gate is entry, not toggle                 | —                                                                                        |
| Sound on/off        | Maybe                                                    | Useful for "library mode" but iOS mute switch covers it                                  |

### Gating mechanism — locked

**Dave-locked: 2-second corner long-press in an invisible top-right zone.** Already the v1
mechanism (per §"What ships in v1" above); v2 just navigates to a real parent area on
gate-completion instead of being a no-op.

Mechanisms considered and rejected per Dave's memo Q4:

| Mechanism                                  | Verdict             | Reason                                                                                                                                                                              |
| ------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2s corner long-press, invisible target** | **Accept (locked)** | NNGroup: hidden affordances near-undiscoverable by 6–8 age band. PMC 2020: tap-and-hold gestures non-default for children. Outside Marian's natural play zone. No reading required. |
| 3-tap or N-tap pattern on visible glyph    | Reject              | Dave: "Marian will memorise a pattern she observes." Tap cadences are within child's natural exploration pattern.                                                                   |
| Math-question gate ("What is 47 + 38?")    | Reject              | Documented bypass mode (TechTimes 2019, YouTube Kids); Marian is learning addition in this exact app. Insulting to her too.                                                         |
| Hidden URL parameter                       | Reject              | Parents forget; one-time disclosure won't stick.                                                                                                                                    |
| Multi-finger gesture (3-finger swipe)      | Reject              | Outside iOS gesture vocabulary parents would naturally try; high friction for Thomas's actual use.                                                                                  |

**One-time parent disclosure:** at PWA install (or first launch via the home-screen icon),
the orchestrator surfaces a one-time card to Thomas reading "Press and hold the top-right
corner of the Hub for 2 seconds to access parent settings." This card is shown ONCE — its
"seen" state lives in `localStorage` under a separate key (`marian-tutor.parent-disclosure-seen`)
and never re-shows. The disclosure surface is deferred to the v2 parent-area implementation
ticket; v1 just reserves the long-press handler.

This whole gating section is **v2 scope for the actual area implementation** — for v1, the
long-press just no-ops with a console log per §"What ships in v1".

### Parent thumb-zone

When the parent area exists (v2), it's an adult-hands surface — different ergonomics than the
child-oriented bottom-60% rule. Adult thumbs reach the top of an iPad fine when held normally;
the parent area can use the full viewport without the bottom-60% constraint. v1 doesn't ship
the area; this is a v2 design note.

---

## Melody welcome-back greeting

Melody is centred-upper (~22vh) in idle/breathing pose on Hub mount. She speaks one short line
that varies by entry path. Per Dave's memo (Q5, citing T-TAC ODU on classroom routines and
PMC 2021 on the Goldilocks-effect of intermediate predictability), the greeting follows an
80/20 stable-anchor model nested inside the entry-path framework.

### Greeting model

The brief's entry-path framing and Dave's 80/20 stable-anchor model **converge**, not conflict:

- The **anchor** (consistent, predictable) is the entry-path-determined line — same line every
  time Marian enters Hub via that path. This is the predictability that lowers session-start
  anxiety and gives passive-vocab repetition for Marian's L2 English exposure.
- The **rotation** (Goldilocks novelty) only fires on the high-frequency app-open paths and
  draws from a small pool of variants. Low-frequency paths (first-ever Hub, Session-End
  return) are anchor-only — repetition there reinforces the "this is what coming back to
  Melody sounds like" ritual.

### Variants

| Entry path                                                                   | Anchor line (80%)        | Rotation pool (20%)                                      | Melody pose                               |
| ---------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| **First-ever Hub visit**                                                     | "Hi again!"              | _none_ — anchor-only                                     | idle → small ear-wiggle on "Hi"           |
| **App-open, no suggestion** (both trees touched today, or no preference yet) | "Hi! What today?"        | "Hi! Look who's here!" • "Hi! Ready?" • "Hello, friend!" | idle, gentle eye-blink                    |
| **App-open, suggestion = Number Garden**                                     | "Hi! Try Number Garden?" | "Hi! Number Garden today?" • "Hello! Want some flowers?" | idle, paw lifts toward Number Garden node |
| **App-open, suggestion = Word Song**                                         | "Hi! Try Word Song?"     | "Hi! Word Song today?" • "Hello! Want some music?"       | idle, paw lifts toward Word Song node     |
| **App-open, < 6h since last session**                                        | "Back so soon!"          | "Hi again!" • "You're back!"                             | idle, brief tilt                          |
| **From Session-End "All done!"**                                             | "Pick again?"            | _none_ — anchor-only                                     | idle, neutral                             |
| **From mid-skill back tap**                                                  | "Pick what's next."      | _none_ — anchor-only                                     | idle, neutral                             |

**Selection algorithm (deterministic + weighted random):**

```typescript
function pickGreeting(path: EntryPath, history: SessionHistoryV2): GreetingId {
  const variants = GREETING_TABLE[path]
  const anchor = variants.anchor
  const rotation = variants.rotation
  if (rotation.length === 0) return anchor
  // 80% anchor, 20% spread evenly across rotation pool
  const r = pseudoRandom(history.sessionCount) // session-count-keyed; deterministic per session
  if (r < 0.8) return anchor
  const i = Math.floor(((r - 0.8) / 0.2) * rotation.length)
  return rotation[Math.min(i, rotation.length - 1)]
}
```

`pseudoRandom` is a session-count-keyed seed (not a true random) so a given session's greeting
is deterministic — Devon can unit-test the variant selection without mocking randomness.

### Rapid-re-mount suppression

Per Dave's memo Q5 verbatim: "Suppress the greeting on rapid re-mounts (if the child returns
to Hub within 30 seconds of leaving, Melody is already visible in idle pose — no re-greeting)."

If Hub mounts within 30 seconds of an unmount (tracked via `sessionStorage` with a timestamp
key), no welcome line plays. Melody is already in idle pose; the screen just renders. This
covers the case where Marian taps a node, immediately taps back, and is now back on Hub.

### Suggestion-aware lines and the soft-guided default

The "suggestion" lines (e.g., "Hi! Try Number Garden?") implement the soft guided-default
from §"Skill-tree picker → Soft guided default". Per Dave's memo Q1 + Bao & Lam's
relational-autonomy finding: a trusted character can suggest without undermining autonomy,
provided the suggestion is offered as a question, the alternative remains fully tappable, and
no nag follows. All three are honoured here.

**Why Melody offers the suggestion verbally (not just visually).** Marian is reading-emergent;
a visual ring around a node may register as decorative without the audio cue saying "this is
the one I'm thinking of." Melody's line names the suggested tree explicitly so the visual
nudge is interpreted correctly.

### Why these specific lines

"It's so nice to see you again!" or "I missed you so much!" cross into the "creepy parasocial"
trap that the brief explicitly flags. Melody is warm because she's there and present, not
because she performs longing. Eight-year-old Marian will form a parasocial bond with Melody
whether we want it or not (this is age-typical); the design choice is to let the bond be
lightweight, not to lean on it.

### Vocab check

New words across all variants: `again`, `today`, `back`, `soon`, `pick`, `what's`, `next`,
`look`, `who's`, `here`, `ready`, `hello`, `friend`, `try`, `flowers`, `music`, `you're`.
All within or near the 200-word cap (most already in Greet/Math/Word-Song vocabulary).
Numbers not invoked here. Tagalog absent.

### Tag-onto-Greet

Session 1 already says "Hi! I'm Melody." in Greet. The Hub's "Hi again!" anchor for first-ever
Hub visit intentionally echoes that opener so first-Hub feels like a continuation, not a fresh
start. This is the only intentional callback to Greet's exact phrasing.

### Audio dispatch on Hub mount

```
t=0ms     : Hub mounts; useAudioUnlockGate ring shown if context not unlocked
t=on-tap  : (only if gate was active) gate dismisses, dispatch starts
t=0ms     : sessionAudio.playUtterance('hub.welcome.<variant>')
t=0-1200ms: Melody speaks line; caption ribbon ticks word-by-word
t=1200ms  : ribbon settled; Melody returns to idle
t=1200ms+ : screen sits idle indefinitely; no auto-advance
```

For the **app-open path**, audio is gated on first user gesture (Marian's tap somewhere on the
screen — anywhere counts, including a node tap which advances directly to that tree). The
welcome-back line is **cancelled** if she taps a node before it finishes — same pattern as
Greet's heart-during-line-4 rule (`design/decisions/greet-edge-cases.md` Edge case 1):

> The skill-tree node is interactive the moment Hub mounts. A tap during the welcome-back
> line is honoured: the line is cancelled mid-utterance via `cancelPreRecorded()` /
> `sessionAudio.cancel()`, the node-tap chime fires, screen advances within ~600ms.

For the **Session-End → Hub path** and the **mid-skill back path**, the audio context is
already hot — the welcome-back line plays immediately without a gate.

---

## Navigation contract

Three questions the brief asks, with locked answers:

### Q1: First-launch — Splash → Greet → Hub, or Splash → Hub directly?

**Locked: Splash → Greet → (first session, ends with Session-End) → Hub.**

Greet is a **once-ever** moment for an 8-year-old who has never met Melody. After Session 1
completes and Session-End fires, the next launch goes Splash → Hub — Greet is never re-shown
on subsequent launches.

The marker for "Greet has been seen" is `marian-tutor.session-history.v1.sessionCount >= 1`
(per Session-End writing on completion). Splash branches:

```
Splash auto-advance
   │
   ▼
read marian-tutor.session-history.v1
   │
   ├─ sessionCount === 0  → Greet (first-run path)
   └─ sessionCount >= 1   → Hub
```

**Why not Splash → Hub directly with a "tap Melody to meet her" Greet variant inside Hub?**
Because Greet's whole shape (full-screen Melody, line-by-line intro, the heart tap) is wrong
for a "node on a Hub" surface. Greet earns its full screen on first run; collapsing it would
shortchange the introduction.

**What if Marian skips Greet** (e.g., orchestrator state corrupted, `sessionCount` stuck at 0
forever)? Hub is self-explanatory enough that a Greet-skipped first visit still works — Melody
on screen, two picker nodes, audio gate. She'll figure it out. The risk is low and the recovery
path (clearing localStorage to re-trigger Greet) is in the parent area's v2 scope.

### Q2: Returning user — app-open lands on Hub?

**Locked: yes.** Splash → Hub for any launch with `sessionCount >= 1`. Hub is the single home
of the app from Session 2 onward.

### Q3: Mid-skill exit — tapping back returns to Hub?

**Locked: yes — adding the back affordance is part of this spec's scope.**

Currently neither Math nor Word Song has a back affordance. Mid-session, Marian's only exit
is closing the PWA. With Hub shipping, the right exit is "back to Hub" so she can pick the
other tree or just leave.

**Back affordance design:**

- Top-left corner of Math/Word Song HUD strip: a 28pt **left-arrow glyph** (28×28pt visible,
  56pt touch zone — same ergonomics as the parent gate).
- Tap behaviour:
  1. Synchronous SFX: `sfx.chime-soft.mp3` (reused, same as Hub-node-tap chime).
  2. Cancel any in-flight TTS via `sessionAudio.cancel()`.
  3. **Persist resume state** via `marian-tutor.session-progress.v1` per the
     `design/mid-session-resume.md` schema — Marian can resume this session if she returns
     within the stale-session window (~30 min per that spec).
  4. 300ms cross-fade to Hub. Melody `layoutId="melody"` re-anchors from upper-left small to
     centred-upper via spring `{ stiffness: 180, damping: 22 }`, ~500ms.
  5. Hub's welcome-back greeting variant is "Pick what's next." (per §"Melody welcome-back
     greeting" mid-skill back path).
- **No "Are you sure?" dialog.** Mid-session-resume covers the "what if she didn't mean to
  leave?" case — if she taps a node back into the same tree within 30 min, she resumes from
  where she was. The back tap is reversible at the orchestrator layer.

**Why a back arrow, not a "home" glyph.** Marian is not yet reading "home" reliably; an arrow
is universally understood as "go back". A house glyph would be cuter but requires a paired
tooltip explanation that we don't ship.

**Coordinator with `mid-session-resume.md`.** That spec assumes Marian closes the PWA as the
abandonment signal. Adding a back affordance creates a **second** abandonment vector:

- Closing the PWA mid-session: persists progress per `mid-session-resume.md` § "State
  persistence", relaunch reads stale-session policy.
- Tapping back to Hub mid-session: also persists the same progress; Hub is just an in-app
  destination instead of an app close. **Resume policy is identical** — if she taps the same
  tree's node within 30 min, she resumes; if she picks the other tree, the in-flight session
  is invalidated (you can't resume Math while playing Word Song; the cross-tree session model
  doesn't support it in v1).

**Decision needed for cross-tree pick after back-out:**

- **(a)** Picking the other tree silently invalidates the in-flight Math session. She loses
  the ~4 problems she did. Stardust earned in those problems is still hers (Math writes
  `stardust.v1` per-problem); the session-history record just never lands.
- **(b)** Picking the other tree shows a confirmation: "Switch to Word Song? Your Number
  Garden trip will start over." This is the only confirmation dialog the v1 spec proposes,
  and it's age-inappropriate (reads as a guilt trap for an 8-year-old who just wants to do
  something different).
- **(c)** Picking the other tree resumes-then-pivots: it auto-finishes the current Math
  session by treating the in-flight problems as "completed" with a partial Session-End, then
  enters Word Song fresh. Logically clean but the partial Session-End is a ghost surface
  Marian never sees ("you did it!" with 4 problems' worth of stardust feels off).

**Recommendation: (a).** Silent invalidation. The in-flight session is best-effort; mid-session
resume is the warm path; cross-tree switch is a "fresh start" that doesn't punish her for
changing her mind. Stardust earned is still hers via the per-problem `stardust.v1` write
moment, so the cost of (a) is just "this session won't show in her history" — trivial.

### Q4 (implicit): Session-End → Hub flip — when does it happen?

Per ticket `86c9hab6y`: Session-End's "All done!" CTA currently routes to Sleep splash. After
Hub ships and Thomas approves, Devon flips the route in a one-line change: Session-End's
`onAllDoneTap` callback dispatches to Hub mount instead of Sleep-splash mount. Both are
SessionEnd-internal route states; the flip is trivial.

**What happens to Sleep splash?** Sleep splash is **deprecated** the moment Hub ships as the
post-session destination. Devon can either:

- **(a)** Delete `SleepSplash.tsx` outright in the same PR that flips the route. No more dead
  code.
- **(b)** Keep `SleepSplash.tsx` for a release as a dark-launch fallback (feature-flag the
  Hub route). Defensive but adds flag-management surface.

**Recommendation: (a).** The flip is reversible from git; the dark-launch flag is overhead.

---

## Audio integration contract (Path A)

Hub mounts and plays one welcome-back utterance + reacts to up to two node-tap utterances. Net
audio per Hub visit is small.

**Question: when are Hub utterances pre-rendered?** Three plausible moments:

1. **Bundled with the next session's audio** at session-start — but Hub is _between_ sessions,
   so this requires a session-start call we don't currently make.
2. **Pre-rendered at app-build-time** as static MP3s, like Greet — but the welcome-back lines
   vary by entry path and time-of-day, all 5 variants are needed.
3. **Pre-rendered at the previous Session-End**, bundled in the same Vercel call that renders
   Session-End's audio.

**Recommendation: (2) — static pre-rendered MP3s.** All Hub welcome lines + node-tap lines
are fixed strings, never varying per-session, never personalised. They belong with Greet's
pre-recorded bundle in `public/assets/audio/hub/`, not Path A.

**Anchor lines (always pre-rendered):**

| `id`                            | File                                | Sample text              | When played                               |
| ------------------------------- | ----------------------------------- | ------------------------ | ----------------------------------------- |
| `hub.welcome.first-again`       | `hub-welcome-first-again.mp3`       | "Hi again!"              | First-ever Hub visit (post-Session-1)     |
| `hub.welcome.what-today`        | `hub-welcome-what-today.mp3`        | "Hi! What today?"        | App-open, no suggestion, anchor 80% slot  |
| `hub.welcome.try-number-garden` | `hub-welcome-try-number-garden.mp3` | "Hi! Try Number Garden?" | App-open, suggestion = Number Garden, 80% |
| `hub.welcome.try-word-song`     | `hub-welcome-try-word-song.mp3`     | "Hi! Try Word Song?"     | App-open, suggestion = Word Song, 80%     |
| `hub.welcome.back-soon`         | `hub-welcome-back-soon.mp3`         | "Back so soon!"          | App-open, < 6h since last session, 80%    |
| `hub.welcome.pick-again`        | `hub-welcome-pick-again.mp3`        | "Pick again?"            | From Session-End "All done!"              |
| `hub.welcome.pick-next`         | `hub-welcome-pick-next.mp3`         | "Pick what's next."      | From mid-skill back tap                   |
| `hub.enter.number-garden`       | `hub-enter-number-garden.mp3`       | "Number Garden!"         | Number Garden node tap                    |
| `hub.enter.word-song`           | `hub-enter-word-song.mp3`           | "Word Song!"             | Word Song node tap                        |

**Rotation-pool variants (the 20% novelty):**

| `id`                                  | Sample text                 | Used when                                      |
| ------------------------------------- | --------------------------- | ---------------------------------------------- |
| `hub.welcome.what-today.alt-1`        | "Hi! Look who's here!"      | App-open, no suggestion, rotation slot         |
| `hub.welcome.what-today.alt-2`        | "Hi! Ready?"                | App-open, no suggestion, rotation slot         |
| `hub.welcome.what-today.alt-3`        | "Hello, friend!"            | App-open, no suggestion, rotation slot         |
| `hub.welcome.try-number-garden.alt-1` | "Hi! Number Garden today?"  | App-open, suggestion = Number Garden, rotation |
| `hub.welcome.try-number-garden.alt-2` | "Hello! Want some flowers?" | App-open, suggestion = Number Garden, rotation |
| `hub.welcome.try-word-song.alt-1`     | "Hi! Word Song today?"      | App-open, suggestion = Word Song, rotation     |
| `hub.welcome.try-word-song.alt-2`     | "Hello! Want some music?"   | App-open, suggestion = Word Song, rotation     |
| `hub.welcome.back-soon.alt-1`         | "Hi again!"                 | App-open, < 6h, rotation                       |
| `hub.welcome.back-soon.alt-2`         | "You're back!"              | App-open, < 6h, rotation                       |

**Total: 9 anchor + 9 rotation + 2 node-enter = 20 MP3s**, ~12 KB each ≈ ~240 KB added to the
precache bundle. Still small against the 4.5 MB Vercel response cap and well under typical
PWA precache budgets. Voice config canonical: `en-US-AnaNeural`, rate `-10%`, default pitch.

**Why static MP3s, not Path A.** Hub is a navigation surface, not a content surface. The lines
never change per-session; pre-rendering them once at build-time + caching via the PWA service
worker is strictly simpler than threading them through the session-start Claude call.

**SFX (reused — no new authoring):**

| `id`          | File                 | When played                                                 | Status                |
| ------------- | -------------------- | ----------------------------------------------------------- | --------------------- |
| `sfx.chime`   | `sfx-chime-soft.mp3` | Node tap; back-arrow tap                                    | Reused (Greet, Math)  |
| `sfx.sparkle` | `sfx-sparkle.mp3`    | Optional cumulative-stardust delta on entry — see Open Q #2 | Reused (Math correct) |

The parent-gate long-press in v1 is **silent** (per Dave's no-feedback-until-v2 rule). No SFX
plays on long-press completion in v1; the dev-only console log is the only signal.

**Optional ambient SFX — cumulative-stardust delta on entry.** When Hub mounts, if
`cumulativeStardust > previousHubVisitCumulativeStardust` (i.e. she earned more stardust since
the last Hub view), play a single soft `sfx.sparkle` and pulse the HUD counter once.
**Recommendation: skip in v1.** Too easy to over-engineer; the counter just shows the value,
no animation needed beyond mount fade-in. Flagged as Open Q #2.

**Audio dispatch sequence on Hub mount (gesture already unlocked — Session-End or back path):**

```
t=0ms     : Hub mounts
t=check   : if rapid-remount-within-30s suppression fires → skip welcome line, no audio,
            screen renders Melody in idle pose, no ribbon caption
t=0ms     : preRecorded.playHubLine(<variant>)  ← only if not suppressed
t=0-1200ms: welcome-back line plays; caption ticks word-by-word
t=1200ms  : ribbon settled; screen sits idle
```

**Audio dispatch sequence on Hub mount (gesture not yet unlocked — app-open path):**

```
t=0ms     : Hub mounts; useAudioUnlockGate ring overlays
t=0ms     : welcome-back line NOT played yet (gesture-gated)
t=tap     : Marian taps anywhere on Hub
t=tap+0ms : gate dismisses; preRecorded.playHubLine(<variant>) fires
t=tap+0ms : if the tap was on a node, sfx.chime plays AND node-tap dispatch begins,
            cancelling the welcome-back line in-flight (per the heart-during-line-4 rule)
t=tap+0ms : if the tap was elsewhere, welcome-back plays uninterrupted
```

**Audio dispatch sequence on node tap:**

```
t=0ms     : node tap registered
t=0ms     : preRecorded.playHubLine('hub.enter.<tree>')
t=0ms     : sfx.chime.play()
t=0ms     : sessionAudio.cancel() / cancelPreRecorded() if welcome-back still playing
t=0-350ms : node press-and-bloom animation
t=200ms   : background cross-fade begins (meadow → garden or song)
t=600ms   : content screen mounts; Hub unmounts
```

**Caption rendering:** identical pattern to Greet — render `Utterance.text` via
the pre-recorded line's word-by-word reveal. Same `<m.span>` per-word with `data-revealed`
toggle, same `text-[2.4rem]` size.

**Audio gate:**

- App-open path: `useAudioUnlockGate` required. Wake-tap pattern is the gesture.
- Session-End → Hub path: NOT required (gesture was within ~1.2s).
- Mid-skill back tap path: NOT required (gesture was within ~1.2s).

---

## States

### Idle (post-mount, settled)

Default state. Melody centred-upper in `melody-idle.svg`, slow 4s breathing scale. Ribbon
empty (welcome-back line settled then ribbon fades to neutral). Both nodes visible, breathing
loop active. HUD strip steady. Recent-stats strip visible iff thresholds met.

No nag, no auto-advance, no re-prompt. Marian can sit on Hub indefinitely.

### App-open (gesture-not-yet-unlocked)

Hub renders fully but `useAudioUnlockGate` ring overlays (per Greet's wake-state pattern). On
any tap (anywhere), gate dismisses. If the tap landed on a node, the node-tap path runs (welcome
line is briefly cancelled in favour of the node-tap line). If elsewhere, welcome-back line
plays from t=0.

### Returning-user-with-stats

Default Idle state, plus the recent-stats strip visible at the bottom showing today's session
stardust + best streak (if `longestStreakEver >= 3`).

### First-ever-Hub state

Same as Idle but the recent-stats strip is hidden (no thresholds met yet). Welcome line is
"Hi again!" instead of "Hi! What today?". Both nodes show all-outlined dots (no stages mastered
yet). The "next-up" ring is on the _first_ dot of _each_ tree.

### Node tap → transition out

Per the node-tap audio dispatch sequence above. 600ms cross-fade out; Hub unmounts after
content screen has mounted.

### Parent-gate long-press (v1: no-op)

The 96×96pt invisible top-right zone listens for a 2-second sustained press:

- **Press starts** (`pointerdown` inside zone): silent timer starts. No visible feedback.
- **Press drifts out of zone** (`pointermove` exits): timer cancelled silently.
- **Press lifts before 2000ms** (`pointerup`): timer cancelled silently.
- **Press completes 2000ms in-zone**: dev-only `console.log('[Hub] parent-gate long-press
detected (v1 no-op)')` fires. **No UI change.** No audio. No Melody reaction. Hub stays in
  Idle. (v2 navigates to a real parent area at this moment.)

No state recorded; gesture detection is event-only, no persistence. Marian-facing surface is
identical regardless of whether she happened to long-press the corner — by design, per Dave's
discoverability research.

### Background-resume during Hub

If `document.visibilityState` flips to hidden while Hub is mounted, then back to visible:

- **No state reset.** Hub is a navigation surface with no in-flight content; there's nothing to
  reset.
- **No re-greet.** The welcome-back line does not replay on resume — that would be a nag pattern.
- **Re-arm `useAudioUnlockGate`** if the audio context was suspended during background.
  First tap on resume re-unlocks per the standard wake-tap.
- **Mid-utterance suspension cancels cleanly** via the same visibility handler in Greet
  (`design/decisions/greet-edge-cases.md` Edge case 2). The line is dropped; on resume Marian
  sees Hub idle. No restart.

### Audio failure (welcome-back MP3 missing or fails to load)

- Melody pose stays at `melody-idle` with the static breathing loop.
- Ribbon stays empty (no caption, since no utterance played).
- Nodes are still tappable; the screen is still functional.
- Devon should log the audio failure to console for `?debug=1` overlay surfacing.

### Empty / first-visit edge case

If somehow Hub mounts with `sessionCount === 0` but the Splash router didn't catch it (a corrupt
state path), Hub still functions — both nodes are tappable, the welcome line plays "Hi again!"
(treating it as first-ever). This is a fail-soft default; the right fix lives in the Splash
router's branch logic.

### Transition in (each path)

| From                          | Visuals                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splash (app-open)**         | Splash logo fades out 250ms → Hub fades in 300ms with `bg-meadow.svg` static; Melody appears at centred-upper position from t=0 (no slide-in — she's "already there"); welcome-back line gated on first tap                                                                                                                                                                                                   |
| **Session-End ("All done!")** | Session-End fades out 300ms; Hub fades in 300ms with cross-fade `bg-twilight.svg` → `bg-meadow.svg` (twilight back to morning meadow — emotional shift from "winding down" to "fresh start"); Melody `layoutId="melody"` carries from centred-larger Session-End position to centred-upper Hub position via spring `{ stiffness: 180, damping: 22 }`, ~500ms; welcome line plays immediately (gesture is hot) |
| **Mid-skill back tap**        | Math/Word Song fades out 300ms; Hub fades in 300ms with cross-fade `bg-garden.svg` or `bg-song.svg` → `bg-meadow.svg`; Melody `layoutId="melody"` carries from upper-left small to centred-upper via spring `{ stiffness: 180, damping: 22 }`, ~500ms; welcome line plays immediately                                                                                                                         |

### Transition out

Per the node-tap audio dispatch sequence above (600ms cross-fade). Same shape regardless of
which tree she chose.

---

## Motion

| Element                                                    | Trigger                     | Spring / duration                                                                                      | Reduce-Motion fallback               |
| ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Background fade-in                                         | Hub mount                   | 300ms `ease: "easeOut"`                                                                                | Same                                 |
| Melody layout-id arrival                                   | From Session-End / back tap | spring `{ stiffness: 180, damping: 22 }`, ~500ms                                                       | Direct teleport; opacity fade only   |
| Speech ribbon scale-in                                     | First TTS `onPlay`          | spring `{ stiffness: 260, damping: 20 }`, ~300ms                                                       | Direct opacity fade-in over 200ms    |
| Caption word reveal                                        | Per-word `onWordTick`       | per-word opacity 0→1 over 100ms                                                                        | Same                                 |
| Skill-tree node breathing loop                             | Idle, while node visible    | `scale: 1 → 1.02 → 1`, 4s, `repeat: Infinity`, `repeatType: 'mirror'`, `ease: "easeInOut"`             | No loop — node static at scale 1     |
| Skill-tree node tap (press-and-bloom)                      | Tap                         | `scale: 1 → 0.96 → 1.04 → 1` over 350ms via spring `{ stiffness: 260, damping: 20 }`                   | Direct scale tween 1 → 1, no bounce  |
| Node signature visual bloom (flowers expand / notes float) | Tap                         | `scale: 1 → 1.15`, `opacity: 1 → 0` over 600ms                                                         | Static — no bloom, just opacity fade |
| HUD stardust counter mount-in                              | Hub mount                   | opacity 0→1 over 200ms (delayed 100ms after bg)                                                        | Same                                 |
| Suggestion ring on suggested node                          | Hub mount                   | opacity 0→0.8 + single shimmer cycle (`opacity 0.8 → 1 → 0.8`) over 600ms, then settled at 0.8         | Static at 0.8 opacity, no shimmer    |
| Path-strip current-node glow                               | Hub mount                   | single shimmer cycle on the current-stage icon (opacity 0.85 → 1 → 0.85) over 800ms, then settled at 1 | Static at 1, no shimmer              |
| Recent-stats strip fade-in                                 | Hub mount, conditional      | opacity 0→1 over 300ms (delayed 400ms after bg)                                                        | Same                                 |

**No infinite loops EXCEPT** the node breathing loop (4s). That's a calm presence-loop, not a
hype loop — disabled with Reduce Motion.

**No background drift** on `bg-meadow.svg`. The meadow is static.

**Spring presets** match the existing screen specs:

- `{ stiffness: 180, damping: 22 }` for Melody re-anchoring (matches Math/Session-End transition).
- `{ stiffness: 260, damping: 20 }` for ribbon and node bounce (matches Greet ribbon, Math chip).

**Reduce-Motion handling:** copy `usePrefersReducedMotion` from the shared hook (see
`design/screen-3-math.md` § Implementation pointers). Same global `MotionConfig
reducedMotion="user"` covers infinite loops; per-element fallbacks above are explicit.

**Performance sanity:**

- 2 nodes with scale loops + 1 ribbon + Melody pose. Trivial.
- No lists, no virtualisation, no per-frame updates.

---

## Assets required

Already in repo (no new authoring required for this spec):

| Asset                  | Used for                                                             | Size     |
| ---------------------- | -------------------------------------------------------------------- | -------- |
| `melody-idle.svg`      | Melody centred-upper idle/breathing pose                             | 6 KB ✅  |
| `star-filled.svg`      | HUD cumulative stardust counter glyph                                | <2 KB ✅ |
| `sparkle-particle.svg` | Optional ambient cumulative-delta pulse (Open Q #2 — recommend skip) | <1 KB ✅ |
| `sfx-chime-soft.mp3`   | Node tap; back-arrow tap                                             | ~8 KB ✅ |
| `sfx-sparkle.mp3`      | (Optional, deferred per Open Q #2)                                   | ~6 KB ✅ |

NEW assets required (flag to Thomas via Matt for art queue):

| Asset                      | Used for                                                   | Target size | Notes                                                                     |
| -------------------------- | ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `bg-meadow.svg`            | Hub background                                             | <20 KB      | Pastel sky + meadow horizon, no hard edges. Reads as "fresh morning"      |
| `node-card-frame.svg`      | Skill-tree node card chrome                                | <3 KB       | Soft-rounded card outline; reused for both Number Garden + Word Song      |
| `node-flowers.svg`         | Number Garden node signature visual                        | <3 KB       | 3 flower glyphs, 64pt; reuses palette of Math's `flower-glyph.svg`        |
| `node-music-notes.svg`     | Word Song node signature visual                            | <3 KB       | 3 music notes (♪ ♫ ♬), 64pt; new shape, gentle tilt                       |
| `arrow-back.svg`           | Mid-skill back affordance (top-left of Math/Word Song HUD) | <1 KB       | 28pt left-pointing arrow                                                  |
| `stage-icon-add.svg`       | Number Garden path-strip "add" stage icon                  | <1 KB       | Small `+` glyph, 28pt; reuse Math's existing `+` rendering if extractable |
| `stage-icon-subtract.svg`  | Number Garden path-strip "subtract" stage icon             | <1 KB       | Small `−` glyph, 28pt                                                     |
| `stage-icon-multiply.svg`  | Number Garden path-strip "multiply" stage icon             | <1 KB       | Small `×` glyph, 28pt                                                     |
| `stage-icon-letter.svg`    | Word Song path-strip "letter sounds" stage icon            | <1 KB       | Small `Aa` glyph, 28pt                                                    |
| `stage-icon-blend.svg`     | Word Song path-strip "blending" stage icon                 | <1 KB       | Small "Ca" glyph (showing 2-letter blend), 28pt                           |
| `stage-icon-cvc.svg`       | Word Song path-strip "CVC" stage icon                      | <1 KB       | Small "Cat" mini-text, 28pt                                               |
| `stage-icon-checkmark.svg` | Path-strip "mastered" indicator                            | <1 KB       | 28pt checkmark; reuse Greet's heart-completed glyph if compatible         |
| `stage-icon-padlock.svg`   | Path-strip "locked" indicator                              | <1 KB       | 28pt padlock; reuse Math's stardust unlock-loop glyph if existing         |

**No gear/settings glyph asset needed** — per Dave's research, the parent gate is invisible
(no visible affordance) in v1.

**Pre-recorded audio (NEW — to be authored via the same Azure TTS pipeline as Greet's lines):**
20 MP3s total — 9 anchor lines (always pre-rendered), 9 rotation-pool variants, 2 node-enter
chime lines. See §"Audio integration contract → Anchor lines" and "Rotation-pool variants"
tables for the full manifest. Approximate per-file size ~12 KB; total precache add ~240 KB.

**Numerals + glyphs:** rendered as text/SVG inline. No bitmap assets.

---

## Anti-dark-pattern audit (this screen)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] **No variable-ratio reward.** Hub never spawns surprise stardust on entry. Cumulative
      stardust is a passive count, not a randomised drop.
- [x] **No streak shame.** No "you missed yesterday!" copy. No grayed-out calendar dots. No
      "your streak is 0" line. Day-streak is rendered only when ≥ 1 AND the last session was
      today/yesterday; silent reset on missed days (Dave-locked, citing Kahneman & Tversky
      Prospect Theory). `longestStreakEver` is parent-area v2 data, never Marian-facing.
- [x] **No fake urgency.** No countdown timer. No "Melody is waiting!" notification badge. No
      "play before midnight!" copy.
- [x] **No social pressure.** No leaderboard. No "X kids her age are playing now!" No share
      affordances. Single-user app, single-user surface.
- [x] **No infinite content.** Two nodes, one parent gate. Three taps total. No scroll. No
      "more activities!" CTA. No discovery loop.
- [x] **No re-engagement nudge.** Hub does not push toward starting a session. The welcome line
      asks "What today?" (open question, not "tap Number Garden now!"). If Marian sits on Hub
      and walks away, the screen sits silently — no escalating nag, no second prompt.
- [x] **No streak guilt on entry.** Hub mounts the same way regardless of whether she was here
      yesterday or two weeks ago. Time-since-last only affects the welcome-line variant
      ("Back so soon!" vs "Hi! What today?") — both warm; neither shaming. Day-streak band
      hides silently when broken; no acknowledgement of the break.
- [x] **No surprise costs.** No IAP, no ads, no monetisation surface.
- [x] **No comparative framing.** No "you've earned more than last week!", no "your best
      session ever!", no progress percentages.
- [x] **No tutorial-on-tutorial.** No coach-mark, no "Tap one of the cards to start!" overlay.
      Affordances stand on their own.
- [x] **Wrong answers are never enumerated** anywhere on Hub (no surface displays per-tree
      wrong-answer counts, no "you got 47/63 right this week" stat).
- [x] **Parent area is opt-in by gesture pattern, not a child-trap.** Dave-locked 2-second
      corner long-press (invisible target) keeps the surface near-undiscoverable by an 8-year-
      old's natural tap exploration while remaining accessible to a parent who has been told
      where it is. No visible glyph in v1; v1 long-press is a no-op (dev-only console log).
- [x] **Audio-first, text-mirror.** Welcome-back line spoken via pre-rendered MP3; ribbon
      mirrors word-by-word for passive reading exposure. No text-only UI on the load-bearing
      path.
- [x] **Never a red X / never a soft no on initiative.** Tapping a node always commits — there
      is no disabled-while-speaking state per the Greet edge-case rule (`design/decisions/greet-
    edge-cases.md` Edge case 1).
- [x] **Soft suggestion respects autonomy.** The guided-default is a question, not an
      imperative; the alternative node is fully tappable and visually equal (no dimming);
      override-detection caps suggestion at 3 days running and triggers a 2-day suspension to
      prevent nag (Dave-locked, citing Ryan & Deci SDT and Bao & Lam relational autonomy).

---

## Acceptance criteria (Jessica)

Functional:

- [ ] Hub mounts after Splash auto-advance when `marian-tutor.session-history.v1.sessionCount >= 1`
- [ ] Hub mounts after Session-End "All done!" tap once Devon flips the route per `86c9gugm7`
- [ ] Hub mounts after a back-arrow tap from Math or Word Song
- [ ] Splash → Greet flow remains intact for `sessionCount === 0` (first-ever launch)
- [ ] Both skill-tree nodes (Number Garden, Word Song) are visible and tappable from Hub mount
- [ ] Tapping Number Garden plays `sfx.chime` + `hub.enter.number-garden` line, cross-fades to
      Math screen within 600ms, with Melody `layoutId` carrying smoothly
- [ ] Tapping Word Song plays `sfx.chime` + `hub.enter.word-song` line, cross-fades to Word Song
      screen within 600ms, with Melody `layoutId` carrying smoothly
- [ ] Stage path strip inside each node renders 5 icons in linear order: mastered (✓),
      in-progress (mini-icon), current (mini-icon + glow ring), locked (🔒)
- [ ] Sliding window: visible 5 stages center on the current node (current ± 1 behind, +3 ahead)
- [ ] No text labels appear on the path-strip icons
- [ ] HUD top-left shows cumulative stardust total from `session-history.v2.cumulativeStardust`
- [ ] HUD top-right has NO visible glyph; the 96×96pt long-press zone is mounted but invisible
- [ ] Tapping the top-right zone (short tap) does nothing — no audio, no animation, no log
- [ ] 2-second sustained press in the top-right zone fires a dev-only console log (v1 no-op)
- [ ] Recent-stats strip shows today's-session stardust iff `now() - lastSessionCompletedAt < 24h`
- [ ] Recent-stats strip shows day-streak iff `dayStreak >= 1` AND last session was today or
      yesterday
- [ ] Recent-stats strip NEVER displays "broken streak", "0-streak", or any negative state
- [ ] `longestStreakEver` is persisted but NOT displayed anywhere on Hub in v1
- [ ] Recent-stats strip is hidden (slot reserved, no reflow) if neither value qualifies
- [ ] Welcome line follows the 80/20 anchor + variant pool model per the §"Greeting model" table
- [ ] Suggestion algorithm: if today no tree touched yet AND yesterday's pattern indicates a
      tree, the welcome line + node ring nudge toward that tree
- [ ] Suggestion suspended for 2 days after 3 consecutive overrides of the same direction
- [ ] Suggested node has a soft 2pt rose ring; non-suggested node has no ring; both fully tappable
- [ ] Rapid-remount suppression: if Hub mounts within 30s of unmount, no welcome line plays
- [ ] Tapping a node before welcome-back line finishes cancels the line cleanly (no audio bleed)

Audio:

- [ ] All 20 Hub MP3s precached via service worker, played via `preRecorded.playHubLine()` (NOT
      Path A `sessionAudio.playUtterance`)
- [ ] Greeting selection is deterministic per `sessionCount` (same session count → same variant);
      80% land on anchor, 20% spread evenly across rotation pool
- [ ] App-open path triggers `useAudioUnlockGate`; Session-End and back-tap paths do not
- [ ] If welcome-back MP3 fails to load, screen still renders + nodes still tappable; failure
      logged to console for `?debug=1` overlay
- [ ] No node-tap chime double-fires (e.g. on stray pointermove → pointerup); same multi-event
      regression guard as Greet/Math
- [ ] Background-resume during Hub does not replay the welcome-back line; mid-utterance
      suspension cancels cleanly per the Greet edge-case pattern

State persistence:

- [ ] `session-history.v2` schema ships with five new fields: `lastSessionStardust`,
      `dayStreak`, `todayTreesTouched`, `lastSuggestion`, `consecutiveOverrides`
- [ ] v1 → v2 migration: existing v1 records read cleanly; defaults applied for new fields;
      next write persists v2 shape
- [ ] `dayStreak` increments at Session-End iff last session was yesterday; left alone iff
      today; silently resets to 0 iff `daysSinceLast >= 2`
- [ ] `todayTreesTouched.date` rolled over lazily on read when the calendar date has advanced
- [ ] `session-progress.v1` resume contract from `mid-session-resume.md` honoured: if Marian
      taps the same tree's node within the stale-session window after a back-out, she resumes
      the in-flight session
- [ ] If she taps the _other_ tree's node after a back-out, the in-flight session is silently
      invalidated; her per-problem stardust gains are preserved (per recommendation (a) in
      §"Mid-skill exit contract")

Anti-dark-pattern:

- [ ] No "you got X wrong" or "X% correct" copy in any TTS, caption, or visual
- [ ] Day-streak is the ONLY streak surface, displayed only when ≥ 1 AND last session was
      today/yesterday; never displays "0", never displays "broken"
- [ ] `longestStreakEver` is never visible to Marian on Hub (parent-area v2 only)
- [ ] No "tap to start a new session!" persistent CTA
- [ ] No notification badge, no countdown timer
- [ ] No "Marian's progress this week" report or visualisation on Hub
- [ ] No leaderboard, no share affordance
- [ ] No "watch ad" or IAP affordance
- [ ] No comparative framing ("better than yesterday!", "almost your best!")
- [ ] Suggestion (when present) is offered as a question via Melody's voice + a soft visual
      ring; non-suggested node remains fully tappable; choosing the non-suggested tree never
      surfaces any negative reaction
- [ ] Override-detection: if Marian rejects the same suggestion 3 days running, suggestions
      pause for 2 days (no nag escalation)

Touch + accessibility:

- [ ] Each skill-tree node is ≥ 280×280pt — well above 88pt floor for primary actions
- [ ] Parent-gate long-press zone is 96×96pt anchored at top-right safe-area inset
- [ ] Back-arrow on Math/Word Song HUD has 56pt expanded touch zone (28pt visible)
- [ ] Caption text ≥ 28pt
- [ ] Tree names ("Number Garden", "Word Song") at ≥ 28pt
- [ ] Stardust counter numeral at ≥ 28pt
- [ ] Path-strip stage icons at 28pt visible, 44pt hit-zone (informative only — taps are no-op)
- [ ] With Reduce Motion: node breathing loop disabled, suggestion-ring shimmer disabled,
      path-strip glow shimmer disabled, ribbon springs collapse to fades, Melody layout-id
      transitions teleport-with-fade

iPad PWA:

- [ ] Audio context unlock gate ring appears on app-open path; does NOT appear on Session-End
      or back-tap paths
- [ ] No audio dropouts mid-playback (welcome-back line plays cleanly through, or cancels
      cleanly on node tap)
- [ ] PWA precache budget includes 20 new Hub MP3s + 12 new SVG assets; total < 350 KB net add
- [ ] Hub mounts within 300ms post-splash on a warm cache; within 800ms on cold cache
- [ ] Background-resume during Hub: no crash, no replay, audio gate re-arms if context
      suspended

---

## Open questions (need Thomas)

1. **Parent-gate mechanism — confirm Dave's locked recommendation.** Dave's research closes the
   "long-press vs multi-tap" question with a 2-second corner long-press in an invisible top-
   right zone, no visible glyph in v1. The orchestration brief left this open between long-press
   and multi-tap; Dave's evidence (NNGroup, PMC 2020, the YouTube Kids math-gate failure case)
   converges on long-press. **Recommendation:** lock as Dave specified. **Confirm with Thomas:**
   any preference for surfacing the gate visually (e.g., a tiny dot) for parent
   discoverability vs. relying on the one-time disclosure card at install. Default: no visible
   affordance; rely on disclosure card.

2. **Cumulative-stardust delta animation on Hub mount.** When she returns to Hub with new
   stardust earned since last visit, do we softly pulse the counter + play one
   `sfx.sparkle`? **Pro:** "your stars grew" reads as quietly affirming. **Con:** every visit
   becomes a tiny variable-reward moment; and we'd need to track
   `previousHubVisitCumulativeStardust` (one new localStorage field). **Recommendation:**
   skip in v1. Default: no delta animation; counter just shows the current value with a
   simple mount fade-in.

3. **Soft-suggestion algorithm — confirm tie-break and cool-down.** Dave's memo locks the
   _principle_ of a soft guided default. The specific algorithm in §"Suggestion algorithm" is
   my proposal:
   - First-of-day suggests the tree she did less of yesterday (by stardust).
   - 3-consecutive-override → 2-day suspension.
   - Tie-break alternates from prior suggestion direction.

   These specifics are not directly Dave-supported; they're a sensible operationalisation. Open
   for Thomas: do the cool-down thresholds match Marian's actual practice cadence
   expectations? Should the cool-down be longer (3 days?) given that Marian's preferences may
   shift slowly? **Default:** ship as spec'd, observe Marian's first-month behaviour, tune
   based on data.

4. **Mid-skill back affordance: ship in v1 alongside Hub, or defer to a follow-up ticket?**
   The Hub is most useful when there's a way to leave a session mid-flight. Without back
   arrows on Math/Word Song, Hub is reached only via Session-End or app-relaunch. **Defer
   risk:** Marian feels trapped in a 16-problem mixed session if she just wants to switch.
   **Recommendation:** ship the back arrow alongside Hub in the same impl PR — it's a small
   UI add per screen and the resume orchestrator already handles the persistence. Open Q for
   Thomas: do you want the back-arrow scope inside this Hub spec's impl ticket, or as a
   sibling ticket? My vote: same impl PR (smaller diff overall).

5. **Cross-tree pick after back-out — silent invalidation vs. confirm dialog.** Per
   §"Mid-skill exit contract": three options laid out. **Recommendation: (a)** silent
   invalidation. Per-problem stardust is already preserved via `stardust.v1`; the only loss is
   the session-history record. Need Thomas to confirm Marian won't be surprised by "I was
   doing math but switching tells me Word Song is fresh problem 1, what happened?" My read:
   she won't be — kids age 8 are good at "I changed my mind" mental models.

6. **Tree-flavoured node-tap chime variants.** Default uses the same `sfx.chime-soft.mp3` for
   both nodes. **Alternative:** ship a Number-Garden-flavoured chime (warm low-mid tones, like
   a gentle bell) and a Word-Song-flavoured chime (high light tones, like a music-box note).
   **Pro:** the audio reinforces the tree identity. **Con:** new SFX authoring ask, +2 files.
   **Recommendation:** v1 reuses the same chime; v2 considers tree-flavoured variants.

7. **Sleep splash deletion timing.** When the Session-End → Hub route flip lands, does Devon
   delete `SleepSplash.tsx` in the same PR (recommended) or feature-flag the route for a
   dark-launch period? **Recommendation:** delete in the same PR. The route flip is reversible
   from git; the flag adds maintenance overhead.

8. **Greet skip / re-show condition.** Hub spec assumes Greet shows iff `sessionCount === 0`.
   Some parent-area v2 features (e.g., "reset progress") would zero the session count and
   re-trigger Greet. Is that the desired behaviour, or should Greet be one-and-done forever
   regardless of progress reset? **Recommendation:** re-trigger Greet on full progress reset;
   it's a meaningful "fresh start" moment and the only Greet-skip vector is Marian/Thomas
   intentionally clearing storage. **Defer to v2's parent-area spec.**

9. **Stage icon authoring — generic vs. tree-themed.** The path strip needs ~7 stage icons
   (add, subtract, multiply for Number Garden; letter, blend, CVC for Word Song; checkmark
   and padlock as states). **Recommendation:** generic glyphs (`+`, `−`, `×`, `Aa`, `Ca`,
   `Cat` mini-text) — fast to author, semantically obvious. **Alternative:** tree-themed
   (a flower bud → bloom → fruit progression for math; musical note → phrase → song for
   literacy). Themed is prettier but adds 7 SVG authoring tasks. Default: generic. Open Q
   for Thomas: priority tradeoff between art polish and ship velocity.

10. **Hub layout in landscape orientation.** Spec is portrait-first per project conventions.
    Does Hub need a landscape variant? Marian uses iPad in portrait per CLAUDE.md device note.
    **Recommendation:** portrait-only; lock orientation per existing global pattern. No
    landscape variant in v1.

11. **Anchor-line vocabulary expansion review.** Per Vocab check, the welcome lines introduce
    ~17 new English words (not counting numbers). All within reach for the 200-word cap, but
    this is a substantial bump on a single screen. Default ships as-is — the words are simple
    and Marian gets repeated exposure (each word said in many sessions). Open Q: should we
    trim the rotation pool aggressively (ship just the anchor lines for v1, add rotation in
    v2) to keep the vocab-cap headroom? Default: ship full rotation; revisit if cap pressure
    surfaces from other screens.

---

## Out of scope

Explicitly NOT covered by this spec, with the ticket that owns each:

- **Parent area implementation** — visible-but-disabled glyph in v1; full implementation
  (volume control, reset progress, detailed stats viewer) deferred to v2. No ticket yet.
- **Cosmetic stardust unlock loop** — flagged for v2 in `design/screen-3-math.md` § "Inline
  answers item #4". This spec does not surface unlock progress. Cumulative stardust is shown
  as a counter, not as "X more to unlock Y!".
- **Session-history v2 schema (per-session breakdown, time-spent, etc.)** — required for
  detailed parent-area stats. Out of v1 scope.
- **Multi-tree v2+ (third skill tree)** — when a third tree lands, the picker reflows from
  2-up to 3-up. Spec lives with that ticket.
- **Tree-locked nodes (e.g., "Word Song unlocks after 3 Number Garden stages")** — defensive
  visual treatment is sketched in §"Skill-tree picker → Locked vs unlocked nodes" but no
  v1 node ships locked.
- **Skill-tree map / branching visualisation** — v1 ships linear path strips only (5-node
  sliding window per tree); richer branching maps are v2+ if needed.
- **Parental dashboard / progress reports** — out of scope per CLAUDE.md (single-user app);
  the parent area v2 may surface a minimal stats view but never a "report".
- **Notifications / re-engagement nudges** — never. PWA push is not added.
- **Hub-level achievements / badges** — never. Stardust is the only reward currency.
- **Calendar / streak heatmap** — never. See anti-dark-pattern audit.
- **Voice input on Hub ("say which tree!")** — v3, no ticket.
- **Hub for landscape orientation** — out of scope; portrait-locked.

---

## Implementation pointers (for Devon)

**File layout:**

```
src/screens/Hub/
├── Hub.tsx                          # Top-level screen
├── HubHud.tsx                       # Cumulative stardust + invisible parent-gate zone
├── SkillTreeNode.tsx                # Reusable node card (Number Garden + Word Song)
├── SkillTreePathStrip.tsx           # 5-icon linear path strip inside each node
├── stageIcons.tsx                   # Per-stage icon mapping for both trees
├── RecentStatsStrip.tsx             # Conditional bottom band
├── useParentGateLongPress.ts        # v1 invisible 2s corner long-press hook (no-op on complete)
├── useRapidRemountSuppression.ts    # 30s sessionStorage-keyed welcome-suppression hook
├── hubGreeting.ts                   # Variant selection (entry path + 80/20 anchor + suggestion)
├── hubSuggestion.ts                 # Soft guided-default algorithm (today's trees, override cap)
├── dayStreak.ts                     # `computeDayStreak()` + write helpers
└── hubLines.ts                      # MP3 manifest + `playHubLine()` helper

public/assets/audio/hub/
├── hub-welcome-first-again.mp3
├── hub-welcome-what-today.mp3
├── hub-welcome-what-today.alt-1.mp3
├── hub-welcome-what-today.alt-2.mp3
├── hub-welcome-what-today.alt-3.mp3
├── hub-welcome-try-number-garden.mp3
├── hub-welcome-try-number-garden.alt-1.mp3
├── hub-welcome-try-number-garden.alt-2.mp3
├── hub-welcome-try-word-song.mp3
├── hub-welcome-try-word-song.alt-1.mp3
├── hub-welcome-try-word-song.alt-2.mp3
├── hub-welcome-back-soon.mp3
├── hub-welcome-back-soon.alt-1.mp3
├── hub-welcome-back-soon.alt-2.mp3
├── hub-welcome-pick-again.mp3
├── hub-welcome-pick-next.mp3
├── hub-enter-number-garden.mp3
└── hub-enter-word-song.mp3
```

**Reuse, do not re-derive:**

- **Pre-recorded line player:** extend `src/lib/audio/preRecorded.ts` with a `playHubLine(id)`
  helper alongside the existing `playGreetLine()`. Same Howler-backed pattern, same precache
  via service worker.
- **`useAudioUnlockGate`:** required on the app-open path. Reuse the existing hook from
  `src/lib/audio/useAudioUnlockGate.ts`.
- **Caption renderer:** copy from Math/Greet (same `<m.span>` per-word with `data-revealed`
  toggle, same `text-[2.4rem]` size).
- **Melody pose component:** reuse `src/components/Melody/Melody.tsx` (or wherever the shared
  `<m.img>` with `layoutId="melody"` lives) — do not inline a fresh `<img>`.
- **`LazyMotion` + `m`:** same as everywhere else. 4.6 KB budget already paid; do not import
  bare `motion`.
- **`MotionConfig reducedMotion="user"`:** already global at app root.
- **Spring presets:** match existing screens where applicable.

**Routing:**

```typescript
// In App.tsx (or wherever the top-level route state lives):
type RouteState =
  | { kind: 'splash' }
  | { kind: 'greet' }
  | { kind: 'hub' }
  | { kind: 'math' }
  | { kind: 'word-song' }
  | { kind: 'session-end'; payload: SessionCompletePayload }

// On Splash auto-advance, branch:
function nextAfterSplash(): RouteState {
  const history = readSessionHistory()
  if (history.sessionCount === 0) return { kind: 'greet' }
  return { kind: 'hub' }
}

// On Hub node tap:
function onSkillTreeNodeTap(tree: 'number-garden' | 'word-song'): RouteState {
  return tree === 'number-garden' ? { kind: 'math' } : { kind: 'word-song' }
}

// On Math/Word-Song back-arrow tap:
function onBackToHub(): RouteState {
  // (resume state is persisted by the originating screen's pagehide-style handler)
  return { kind: 'hub' }
}

// On Session-End "All done!" tap (post-flip):
function onAllDoneTap(): RouteState {
  return { kind: 'hub' } // was { kind: 'sleep-splash' } pre-flip
}
```

**Test seams (mirror Math + Greet patterns):**

- `Hub` component takes `playLineFn?: PlayLineFn` prop, defaulting to live `preRecorded.playHubLine`.
- `Hub` takes `chime?: Sfx`, `sparkle?: Sfx` props for SFX injection.
- `Hub` takes `now?: () => Date` prop, defaulting to `() => new Date()` — for deterministic
  greeting-variant tests.
- `Hub` takes `historyAdapter?: StorageAdapter` for session-history reads.
- Skill-tree node taps thread through `onSkillTreeNodeTap?: (tree) => void` for integration tests.

**Touch-target validation:** add nodes + parent-gate + back-arrow to the dev-only touch-target
debug overlay (Kevin's overlay per session-1.md:701).

**Performance sanity:**

- 2 nodes with breathing loops + 1 ribbon + 1 Melody pose. Trivial.
- HUD = 2 small elements. Trivial.
- Recent-stats strip = 0–2 small elements. Trivial.

**Accessibility:**

- Caption ribbon stays at ≥ 28pt.
- Tree names at ≥ 28pt.
- Stardust counter numeral at ≥ 28pt; glyph at ≥ 24pt.
- Reduce-Motion: per the §Motion table.

---

## Provenance

- Brief: ClickUp ticket `86c9hab6y` (normal priority, week-4-5).
- Sibling ticket cross-reference: `86c9gugm7` (Session-End CTA destination decision; Hub is
  the post-flip target).
- Session-End contract (currently routes to Sleep splash): `design/screen-5-session-end.md`
  (locked at PR for ticket `86c9grnjd`).
- Math handoff for `layoutId="melody"` and HUD stardust patterns:
  `design/screen-3-math.md` (locked at PR #38, commit `8a2e477`).
- Word Song handoff for shared HUD + stardust counter:
  `design/screen-4-word-song.md` (locked at PR #61).
- Mid-session resume integration: `design/mid-session-resume.md` (ticket `86c9grnjf`).
- Audio architecture canonical reference: `design/audio-architecture.md` (PR #27).
- Greet edge-case patterns informing tap-during-line and background-resume handling:
  `design/decisions/greet-edge-cases.md` (ticket `86c9gpqux`).
- Session-1 walkthrough providing Greet's once-ever shape: `design/session-1.md`.
- Anti-dark-pattern principles: CLAUDE.md non-negotiables.
- Dave's research memo, integrated throughout this spec:
  `design/research/hub-navigation-research-86c9hab6y.md` (landed 2026-04-27, alongside this
  spec).
- Citations from Dave's memo informing locked decisions:
  - **Q1 picker** — Ryan & Deci (2020) SDT; Bao & Lam (2008) relational autonomy in
    elementary children; Zelazo (2025) executive function maturation.
  - **Q2 streak** — Kahneman & Tversky (1979) Prospect Theory loss aversion;
    Garon-Carrier et al. (2016) intrinsic motivation and elementary math achievement.
  - **Q3 path metaphor** — Tversky (2011) diagrammatic reasoning; Cowan (2016) age-8
    working memory capacity; NNGroup on hidden-affordance discovery for ages 6–8.
  - **Q4 parent gate** — PMC (2020) child touchscreen gestures; YouTube Kids math-gate
    bypass case study; NNGroup on age-8 affordance discovery.
  - **Q5 greeting** — T-TAC ODU classroom-routines synthesis; PMC (2021) Goldilocks-
    effect on intermediate predictability; L2 acquisition repetition-learning literature.
