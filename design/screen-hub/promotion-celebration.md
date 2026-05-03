# Hub — Promotion Celebration Moment

**Audience:** Kevin (impl, ticket `86c9kwnkw`), Jessica (QA), Thomas (taste — copy pick).
**Status:** Spec — draft for v1 implementation.
**Surface:** iPad portrait PWA. Triggered on Hub mount.
**Source-of-truth parents:** `design/screen-hub.md` (canonical Hub spec) and the audit
finding in `design/audits/2026-05-02-polish/kyle-visual-ux.md` § P0 ("Hub does not consume
real progress; promotion is invisible") and § P1 ("No mastery-promotion celebration moment").

---

## Goal

When Marian crosses a mastery threshold and the engine has written
`progress.pendingPromotion` to localStorage, her **next** Hub mount plays a brief, warm
"you did it" beat — Emma in `celebration` pose, a single short audio line, a sparkle
burst targeted at the now-mastered cell on the relevant path-strip — and then settles into
the normal Hub idle state. She has crossed a threshold she earned; the screen
acknowledges it once and moves on.

**This is not** an overlay modal, an interruption screen, an "are you proud?" survey, a
streak prompt, or a multi-tap ceremony. It is a 2-second beat **on top of** the normal
Hub render, after which Hub is just Hub.

---

## User state entering this screen

Marian completed a session yesterday or earlier today. At session-end,
`applyMasteryRule()` evaluated the just-finished session against the per-track threshold
in `parentSettings.masteryThreshold` and qualified one node for promotion — typically
because the consecutive-session and percent-correct conditions were both met
(`src/lib/progress/mastery.ts` § "applyMasteryRule"). Because `autoPromote` is the v1
default `false` (parent-confirmed model), the engine wrote `progress.pendingPromotion =
<node>` and did **not** mutate `skillLevels`. The promotion is queued but not yet applied.

She now opens the app or arrives at Hub via Session-End → Hub flip; Hub mounts; this is
the **first Hub mount since `pendingPromotion` was written**.

She does not know any of this. From her side: she opens the app like every other day,
and the screen warmly notices. That's the entire UX for v1.

---

## Trigger conditions (precise contract for Kevin)

The celebration fires **once** when **all** of the following are true at Hub mount:

1. `progress.pendingPromotion` is non-null (a `SkillNode` value per
   `src/lib/progress/types.ts`).
2. The current Hub mount has not already played a celebration for this exact node value
   in this mount lifetime (a single ref-flag, scoped to the mounted Hub instance — same
   one-shot pattern the welcome-back greeting uses via `greetingDispatchedRef`).
3. The mount has cleared rapid-remount suppression (`useRapidRemountSuppression` returned
   `false`). On a suppressed mount, the celebration is **also** suppressed — same rule as
   the welcome-back line. We do not surface a celebration when Marian has just bounced
   in and out of Hub.
4. The audio gate is unlocked. On `app-open` paths the celebration waits behind the
   first user gesture (same gate as the welcome-back line — see `screen-hub.md` §
   "Audio dispatch sequence on Hub mount (gesture not yet unlocked — app-open path)").

**Clear contract.** After the celebration plays through (or is cancelled by a node-tap
or by audio failure — see § "Cancellation"), Kevin clears `progress.pendingPromotion`
via `clearPendingPromotion(progress)` (or the equivalent helper Kevin lands as part of
ticket `86c9kwnkw`). Kyle's spec does not prescribe the storage call shape — Kevin owns
the data layer; the spec only requires that the field is cleared **after** the
celebration has been **dispatched** (not after it has finished — failure modes still
clear, so the screen never re-celebrates the same node on the next mount).

**Fires AT MOST ONCE per promoted node.** Per CLAUDE.md "no dark patterns": the
celebration is not a recurring "you're a winner" loop. After it plays, the field clears,
and a subsequent Hub revisit of the same session window will not retrigger it. The next
celebration fires only when a **new** `pendingPromotion` is written by the next mastery
qualification.

**Multiple promotions on the same session-end.** Per
`src/lib/progress/types.ts` § `pendingPromotion` doc-comment: the mastery engine itself
already serializes promotions — only one node sits in `pendingPromotion` at a time, with
the earliest-in-tree-order winning. v1 inherits this: the celebration plays once for the
single queued node. If a follow-up session-end qualifies another node, that one will
celebrate on the **next** Hub mount after **its** session-end. v1 never double-celebrates
in a single mount. (No design work needed here — the data layer already enforces
single-promotion-at-a-time.)

---

## Visual moment — choreography

Total duration target: **≤2.5s** from Hub mount to "celebration settled, normal Hub
idle." This is a beat, not a screen. Marian must not feel stuck waiting to play.

### Timeline (Hub mount = t=0)

```
t=0ms      Hub mounts. Background, HUD, path-strip, nodes all render at full opacity
           per the standard Hub mount path. Emma renders in `idle` pose by default.
t=0ms      Celebration controller checks pendingPromotion + suppression. If qualified:
             - Sets internal state `celebrating = true`
             - Schedules pose flip for next frame
             - Welcome-back greeting dispatch is SUPPRESSED for this mount
               (see § "Side-effect inventory" below).
t=80ms     Emma pose flips: `idle` → `celebration`. The EmmaCharacter component
           already encodes the celebration tilt keyframes
           (CELEBRATION_TILT_KEYFRAMES via TILT_SPRING_BY_POSE.celebration =
           { stiffness: 220, damping: 22 }). The pose-swap inherits that motion
           for free; this spec adds nothing on top of it.
t=120ms    Sparkle burst begins on the path-strip cell that maps to the promoted node.
           See § "Sparkle particle burst" for spec.
t=180ms    Audio line dispatches via `playHubLine('hub.celebrate.<id>')`.
             - Caption ribbon scales in (spring { stiffness: 260, damping: 20 },
               ~300ms — same as welcome-back ribbon).
             - Caption words reveal at TTS word-tick rate (or 165 wpm fallback).
t=~1200ms  Audio line resolves (typical: ~3 words × ~330ms ≈ 1000ms speech +
           200ms ribbon scale-in). Ribbon stays visible at full opacity for 800ms
           after the last word resolves, then fades over 300ms (same as welcome-back).
t=~1500ms  Sparkles complete their lifetime and fade out.
t=~1800ms  Emma pose returns: `celebration` → `idle` via the same component-level
           pose transition. The EmmaCharacter component's intrinsic spring carries
           her back; no extra config from this spec.
t=~2300ms  Ribbon has finished its 300ms post-line fade.
t=~2500ms  Hub is in standard idle state. `celebrating` flag clears.
           pendingPromotion has been cleared in storage at t=180ms (the moment
           dispatch fires; failure during playback does not re-celebrate).
```

### Sparkle particle burst

Reuses the existing `sfx.sparkle` audio file plus a fresh visual particle component.
Particle visuals are CSS/SVG; no new asset binary needed (matches the existing
`SparkleGlyph` pattern).

| Property                        | Value                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Origin point                    | Centre of the path-strip cell that represents `pendingPromotion`'s node on the relevant tree    |
| Particle count                  | **8 sparkles** (Cowan working-memory cap respected; "celebratory" without overwhelm)             |
| Distribution                    | Even radial spray over a ~140° arc fanning upward (-70° to +70° from vertical), randomised polar offset ±8pt |
| Particle visual                 | Reuse `SparkleGlyph` SVG (the 4-point star already used in HUD); 12pt initial size               |
| Per-particle motion             | Spring `{ stiffness: 180, damping: 14 }`; translateY -64pt to -120pt (random per particle); translateX ±32pt random; scale 0.6 → 1.2 → 0.4; opacity 0 → 1 → 0 |
| Per-particle lifetime           | 1200ms                                                                                           |
| Stagger between particle starts | 30ms (so the burst fans out, not all at once)                                                    |
| Total burst duration            | 8 × 30ms stagger + 1200ms last-particle lifetime ≈ **1440ms**                                    |
| Color from Hub palette          | 4 sparkles `--my-rose` (`#E91E63`); 4 sparkles `--my-yellow` (`#FFD966`) — matches the HUD's existing rose+yellow pairing on the cumulative-stardust glyph |

**No infinite loops.** The burst fires once, fades, gone. No "shimmer forever" rim, no
periodic re-burst. Per `screen-hub.md` § Motion: "no infinite loops EXCEPT the node
breathing loop."

**Targeting.** The sparkle origin attaches to the path-strip cell whose `data-stage`
matches the **node before promotion** — i.e. the cell that just transitioned from
"current" to "mastered". Kevin already has the cells in the DOM with
`data-testid="hub-path-strip-cell"` + `data-stage="<stageId>"` (see
`Hub.tsx:621–646`); the celebration controller does a `querySelector` on the relevant
strip and origins the burst to its bounding rect centre. **The relevant tree** is the
tree the promoted node belongs to (Kevin's `nodeToTree(node)` helper or equivalent —
data-shape question, not design).

**v1 path-strip behaviour during celebration.** The path-strip itself does **not**
animate the icon's locked → unlocked or current → mastered transition in v1. The cell
state is computed from `currentIndex` at mount time and rendered statically in its
post-promotion state. The sparkle burst **on top of** the cell carries the celebratory
signal. (Animating the cell-state transition itself — fade-cross between `<StageIcon
kind="current">` and `<StageIcon kind="mastered">` — is a v2 polish; flagged in § "Out
of scope".)

### Reduced-motion fallback

When `prefers-reduced-motion: reduce`:

- **No sparkle particles.** Replace with a soft glow halo on the same path-strip cell:
  a 24pt outer-ring `box-shadow` ring at `--my-rose` 60% opacity, fading in over 400ms,
  holding for 1000ms, fading out over 400ms. Total 1800ms — same beat-length, no motion
  parallax.
- **Emma pose still flips** — the EmmaCharacter component already disables the
  rotateZ tilt keyframes under reduced-motion (`data-wiggling="false"` per
  `EmmaCharacter.test.tsx:156`). Pose still changes; she just doesn't bounce.
- **Caption ribbon still appears**, with the standard reduced-motion ribbon fallback
  already specced in `screen-hub.md` § Motion (direct opacity fade-in over 200ms).
- **Audio line still plays.** TTS is not reduced-motion-gated.

The signal is preserved, the agitation is removed. Same celebratory beat, different
sensory palette.

### Cancellation

If Marian taps a node **during** the celebration window (before t=2500ms):

1. `cancelledRef` flips to `true` (same flag the welcome-back line uses).
2. The celebration audio line is cut (caption stops revealing further words).
3. Sparkle particles complete their in-flight animations naturally — they're cheap and
   short, and yanking them mid-flight reads worse than letting them finish.
4. Emma pose-swaps directly to the node-tap transition path per the existing
   `screen-hub.md` § "Audio dispatch sequence on node tap" (her layout-id will
   re-anchor as part of the route change).
5. `pendingPromotion` was already cleared at t=180ms when the celebration dispatched,
   so the next Hub mount will not re-celebrate.

This matches the existing welcome-back-cancel-on-tap pattern. Kevin reuses
`cancelledRef`; no new cancellation primitive.

---

## Audio line

### Format

- **One single utterance per celebration** — short, ~3-6 words, within Marian's ~200-word
  vocabulary cap per CLAUDE.md.
- **Three variants** for novelty: one anchor (80% weight) + two rotation alts (10% each).
  Same 80/20 cadence Hub welcome-back lines use (`hubLines.ts` §
  "pickHubGreeting"). Variant pick uses the same `pseudoRandom(seed)` helper, seeded on
  `progress.history.length` so the variant for a given session is deterministic +
  test-friendly.
- **Render new MP3s** via the existing render pipeline
  (`scripts/render-greet-mp3s.mjs`) using the canonical `en-US-EmmaMultilingualNeural`
  rate `-10%` voice config. **Do not reuse `hub.welcome.*` lines** — the welcome-back
  set is conversational ("Hi! What today?"); the celebration set needs a distinctly
  warmer / brighter affective register. Reusing welcome lines would muddy the signal.
- **File naming** matches the existing convention in `public/assets/audio/hub/`:

| Line ID                       | File                                | Rotation slot |
| ----------------------------- | ----------------------------------- | ------------- |
| `hub.celebrate.you-did-it`    | `hub-celebrate-you-did-it.mp3`      | Anchor (80%)  |
| `hub.celebrate.look-new`      | `hub-celebrate-look-new.mp3`        | Alt (10%)     |
| `hub.celebrate.so-proud`      | `hub-celebrate-so-proud.mp3`        | Alt (10%)     |

(Kevin: the `HubLineId` type union in `hubLines.ts` will need three new entries +
manifest rows. Add the `HUB_LINES` rows + extend the `HubLineId` union, same shape as
the existing entries. The audio binaries themselves are a separate asset-render
ticket — your PR can land with silent placeholders that fall through to the 165-wpm
caption walk, identical to the welcome-back v1 mocking pattern documented in
`hubLines.ts` v1 mocking comment.)

### Audio dispatch sequence

Identical shape to the welcome-back dispatch sequence in `screen-hub.md` §
"Audio integration contract" — the celebration line plays through `playHubLine(id,
opts)` with `onWordTick` driving the caption reveal. No new player module.

**Sequencing with welcome-back.** When the celebration fires, the welcome-back line is
**suppressed entirely** for this mount. Reasoning:

- Two consecutive ribbon lines on top of each other within the first 2 seconds reads
  as chatter, not warmth.
- The celebration line carries the emotional weight of "Emma noticed you're back AND
  you levelled up" — that subsumes the welcome-back beat for this one mount.
- The next Hub mount (no pending promotion) returns to the standard welcome-back
  rotation. The omission is a single-mount adaptation, not a permanent change.

Kevin's contract: when `celebrating === true` and the celebration line dispatches, set
`greetingDispatchedRef.current = true` **before** the welcome-back useEffect runs (or
short-circuit the useEffect on a `celebrating` flag — Kevin's call). The point is: only
one ribbon line plays this mount, and it's the celebration line.

---

## Copy options for the celebration line — **3 picks for Thomas**

Kyle's recommended rank order (1 = preferred). All within the 200-word vocabulary cap;
all 3-4 syllables for short cadence; all warm-affirming without being patronising.
Per CLAUDE.md "Emma is gentle, warm, playful, patient. Never teacher-ish, never
condescending."

### Option A — recommended

| Line ID                       | Text             | Word count | Notes                                                                                                                         |
| ----------------------------- | ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `hub.celebrate.you-did-it`    | "You did it!"    | 3 words    | Pure affirmation. "Did" is past-tense, anchored to her actual completed work — not "you're amazing!" (judgemental) or "great job!" (teacher-ish). |
| `hub.celebrate.look-new`      | "Look! Something new!" | 3 words    | Discovery framing — invites attention to the path-strip / sparkle without naming the specific node. Builds wonder.            |
| `hub.celebrate.so-proud`      | "I'm so proud!"  | 3 words    | Relational warmth — Emma takes part. Bao & Lam (cited in Hub research) flagged relational scaffolding as autonomy-preserving. |

**Vocabulary cap check:** all 9 distinct words — `you`, `did`, `it`, `look`, `something`,
`new`, `I'm`, `so`, `proud` — sit comfortably inside the 200-word core list. None are
phonics-target words (so they don't compete with literacy-tree decoding work).

### Option B — alternative set (if Thomas wants different affective register)

| Line ID                          | Text              | Word count | Notes                                                       |
| -------------------------------- | ----------------- | ---------- | ----------------------------------------------------------- |
| `hub.celebrate.wow-look`         | "Wow! Look!"      | 2 words    | Pure surprise / wonder. Shortest possible.                  |
| `hub.celebrate.you-grew`         | "You grew!"       | 2 words    | Growth metaphor. "Grew" is fine vocab; concept is abstract though — may not land for an 8yo. |
| `hub.celebrate.new-thing`        | "A new thing!"    | 3 words    | Object-oriented framing — emphasises the unlocked content.  |

### Option C — minimalist (Dave-aligned)

| Line ID                          | Text              | Word count | Notes                                                       |
| -------------------------------- | ----------------- | ---------- | ----------------------------------------------------------- |
| `hub.celebrate.yay`              | "Yay!"            | 1 word     | Single warm vocalization. Lowest cognitive load.             |
| `hub.celebrate.you-did`          | "You did it!"     | 3 words    | (Same as Option A anchor.)                                  |
| `hub.celebrate.look`             | "Look!"           | 1 word     | Pure pointing.                                              |

**Kyle's recommendation:** **Option A**. It's specific enough to feel earned ("you did
it" = something real happened), warm enough to feel relational ("I'm so proud"), and
exploratory enough to invite path-strip attention ("look! something new!") without
naming a specific node Marian may not yet have language for. It keeps the
generic-celebration framing locked while gesturing at the just-changed cell.

---

## Per-node specificity — **explicitly out of scope for v1**

A future version may tailor copy and visuals per promoted node:

- "You unlocked **add to twenty**!" — naming the new skill.
- The sparkle burst could subtly emphasise the relevant section of the path-strip
  (e.g. ripple along to the new "current" cell after the burst on the now-mastered
  cell).
- Emma's pose could vary by tree — celebration on Number Garden vs a music-themed
  variant on Word Song.

**v1 ships a single generic celebration, identical regardless of which node was
promoted.** Reasons:

- 17 distinct skill nodes × 3 line variants each = 51 new MP3s to render. Disproportionate
  to the v1 scope.
- "You unlocked add to twenty!" requires Marian to have decoded the node's name — at
  her current level the name is opaque audio, not meaningful copy.
- The generic line + sparkle + Emma pose are sufficient signal for "something good
  just happened to your progress." Per Dave's hub-research memo: an 8yo reads
  "glowing thing changed" + "Emma is happy" as a coherent emotional event without
  needing the specific naming.

**Kevin: do not generalise the implementation to per-node copy.** Hardcode the
three generic lines + the 80/20 variant pick. When v2 lands per-node copy, that's a
spec ticket of its own; the celebration controller will be rewritten to consume a
node-keyed line table rather than the flat 3-line one.

---

## Side-effect inventory — what about Hub does (and does not) change during the celebration

| Hub element                                    | Celebration mount behaviour                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome-back greeting (`hub.welcome.*`)        | **Suppressed for this mount.** Returns next mount when `pendingPromotion === undefined`. (See § "Audio dispatch sequence" above.)                                                                              |
| Caption ribbon                                 | Carries the celebration line instead of the welcome-back line. Same component, same word-by-word reveal, same scale-in spring.                                                                                |
| Path-strip                                     | Renders in **post-promotion state** at mount time. The just-mastered cell shows the `mastered` glyph; the next cell is now `current`. **No animated transition** between states in v1 — sparkle burst overlays the just-mastered cell to carry the signal. |
| Cumulative stardust counter                    | **Shows the new total at mount.** No count-up animation, no pulse, no incremental tick. The number simply renders at its current value, identical to a non-celebration mount. (The counter already increments on session-end at the Session-End screen; Hub just reflects state.) |
| Recent-stats strip (today's session, day streak) | Renders normally per its existing visibility rules. Not suppressed by the celebration. Sits below the celebration beat in the layout; doesn't visually compete because the burst is upper-on-the-path-strip and the strip is below the picker tiles. |
| Suggestion ring on the soft-suggested node     | Renders normally. Suggestion is independent of celebration — Marian may have just mastered an `add-to-10` cell while today's suggestion is `word-song`; both surface together cleanly.                          |
| Emma's character long-press / parent-gate      | Both still bound, both still functional. Long-pressing Emma during the celebration cancels per § "Cancellation" and routes to ParentSettings via the existing handler. Long-pressing the corner zone fires its v1 no-op log. |
| Background, HUD, safe-area insets              | All identical to a normal Hub mount. The celebration is purely additive.                                                                                                                                       |
| Skill-tree node breathing loop                 | Continues normally. Both nodes still tappable throughout the celebration; tapping cancels per § "Cancellation".                                                                                                |

**Crucial: the celebration does NOT block interaction.** Both nodes remain tappable
throughout the 2.5s window. Marian can tap a tree to start a session at any time during
the burst — the celebration is interruptible by design. We do not gate her entry to play.

---

## Visual layout sketch

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 47                                    |  <- HUD unchanged
|                                          |
|        ( Emma — celebration pose )       |  <- pose flipped at t=80ms
|                                          |
|       +-----------------------+          |
|       | "You did it!"         |          |  <- celebration line ribbon
|       +-----------------------+          |     (replaces welcome-back)
|                                          |
|                                          |
|   +------------------+  +-------------+  |
|   |   🌸 🌼 🌷       |  |  ♪ ♫ ♬      |  |
|   |                  |  |             |  |
|   |  Number Garden   |  |  Word Song  |  |
|   |  ✓─✓─✓─★(glow)─🔒|  |  ✓─★─🔒─🔒─🔒|  |
|   |          ↑       |  |             |  |
|   |       sparkles!  |  |             |  |  <- 8 sparkles fan from
|   |       ✦  ✧  ✦    |  |             |  |     the just-mastered cell
|   |       ✧    ✦  ✧  |  |             |  |     of the relevant tree
|   +------------------+  +-------------+  |     (here: the third ✓)
|                                          |
|              ★ 5    🔥 4                 |  <- recent-stats unchanged
|         today's session  day streak      |
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

(In this sketch: the promoted node was `add-to-20` on Number Garden — the third
mastered check now shows; the sparkle burst origins on it; the next cell is the new
"current" with its glow. Word Song is unchanged because the promotion happened on the
Number Garden tree.)

---

## Acceptance criteria (Jessica + Kevin)

Each is a checkbox; all must pass for the v1 celebration to be considered shipped.

### Trigger

- [ ] When `progress.pendingPromotion` is non-null at Hub mount, the celebration
      controller activates.
- [ ] When `progress.pendingPromotion` is null/undefined at Hub mount, **no
      celebration plays**; Hub renders the standard welcome-back greeting.
- [ ] On a rapid-remount-suppressed Hub mount (within 30s of last unmount), the
      celebration is **also** suppressed; `pendingPromotion` is **NOT cleared**
      (it carries forward to the next non-suppressed mount, where it plays normally).
- [ ] On the `app-open` path with the audio gate not yet unlocked, the celebration
      waits behind the first user gesture, identical to the welcome-back gate.

### Single-fire

- [ ] After the celebration dispatches, `progress.pendingPromotion` is cleared in
      localStorage **once**.
- [ ] A subsequent Hub mount within the same session window (no new promotion has
      been written) does **NOT** replay the celebration.
- [ ] If Marian dismisses the celebration mid-burst by tapping a node, the next Hub
      revisit (e.g. after that session ends and a non-promoting session-end runs) does
      not replay the celebration for the same node.
- [ ] If a new `pendingPromotion` is written by a subsequent session-end, the
      celebration fires on the next Hub mount as a fresh event.

### Visual

- [ ] Pose flip + sparkle burst + audio line **all dispatch within 200ms of Hub mount**
      (worst-case audio fetch latency notwithstanding — the dispatch trigger is
      synchronous; audio playback may resolve over the following ~1200ms).
- [ ] Total celebration beat completes within **2500ms** of Hub mount on a typical
      iPad (no audio failure, no reduced-motion).
- [ ] The sparkle burst origins on the path-strip cell whose `data-stage` matches the
      promoted node, on the relevant tree.
- [ ] The path-strip renders the just-mastered cell with its `mastered` glyph and the
      next cell with the `current` glow at mount — **before** the sparkles begin.
- [ ] Both skill-tree nodes remain tappable throughout the celebration; tap cancels
      cleanly per § "Cancellation" and dispatches the standard node-tap audio +
      transition.

### Reduced motion

- [ ] When `prefers-reduced-motion: reduce` is set: no particle animation; the soft
      glow halo replaces the burst; Emma's pose still flips but her tilt keyframes
      are bypassed (per the existing EmmaCharacter component behaviour); ribbon
      fades in (no scale spring).
- [ ] Audio line still plays under reduced-motion.

### Audio

- [ ] Exactly one ribbon line is rendered per celebration mount — never two.
- [ ] The welcome-back line is suppressed when the celebration fires (verified via
      `data-testid="hub-ribbon"` showing the celebration text, not a `hub.welcome.*`
      text).
- [ ] On audio failure (MP3 404 / playback rejected): the caption-walk fallback
      reveals the celebration line at 165 wpm; the rest of the celebration (pose,
      sparkles, ribbon) plays normally; `pendingPromotion` is still cleared.
- [ ] Variant pick is deterministic for a given seed — `pseudoRandom(seed)` with
      `seed = progress.history.length` produces the same line ID across re-renders
      of the same Hub mount.

### Side-effects

- [ ] Cumulative stardust counter renders the current value at mount; **no count-up
      animation** triggers as part of the celebration.
- [ ] Recent-stats strip renders normally — not suppressed.
- [ ] Suggestion ring on the soft-suggested node renders normally.
- [ ] Path-strip in v1 does **not** animate its cell-state transitions; static render
      at the post-promotion state is the v1 contract.

### Data layer (Kevin's lane — Kyle calls these out so Jessica can verify the contract)

- [ ] `progress.pendingPromotion` is set by the mastery engine at session-end (already
      shipped in M3 — verified separately).
- [ ] Hub reads `progress.pendingPromotion` at mount via the new `progress` prop wired
      through App.tsx (ticket `86c9kwnkw` data-wiring).
- [ ] Hub clears `progress.pendingPromotion` exactly once after the celebration
      dispatches.

---

## Open questions (need Thomas)

1. **Copy pick.** Three options A / B / C in § "Copy options". Kyle's recommendation:
   **Option A** (anchor: "You did it!"). Thomas to confirm pick before MP3 render.
2. **Sparkle palette confirmation.** Spec uses 4 rose + 4 yellow sparkles to match
   the HUD glyph. Acceptable if Thomas wants pure rose (matching the speech-ribbon
   border) or a brighter "celebration only" palette like rose + cream + a pop of mint.
   Default: ship rose+yellow per § "Sparkle particle burst" unless Thomas overrides.
3. **(Out-of-band)** Should the v2 per-node celebration spec be opened as a follow-up
   ticket now, or wait until v1 is in front of Marian? Kyle's preference: wait. Marian's
   actual reaction to v1 informs the v2 scope better than a-priori spec writing.

---

## Out of scope (v1)

- **Per-node copy and visual treatment** of the celebration. Documented in §
  "Per-node specificity".
- **Animated cell-state transition** on the path-strip (current → mastered cross-fade,
  locked → current unlock). v1 renders the cell statically in post-promotion state and
  uses sparkles to carry the signal. Future polish ticket: animate the cell glyph
  swap during the celebration window (e.g. `<StageIcon kind="current">` cross-fades
  to `<StageIcon kind="mastered">` over 400ms at t=120ms, simultaneous with the
  sparkle burst).
- **Multi-promotion choreography.** The mastery engine already serializes promotions
  to one node at a time; if/when that changes (v2 batch promotion), a separate spec
  will define how to celebrate multiple nodes in one mount.
- **Cumulative-stardust count-up animation.** Mentioned in the Hub spec as Open Q #2;
  remains deferred to a separate polish ticket and is **not** coupled to this
  celebration.
- **Haptics.** Listed in the polish audit as a P1 ticket of its own. When the
  haptics utility lands, the celebration is a natural caller (subtle 40ms pulse on
  the burst origin) — but this spec doesn't ship haptics and Kevin doesn't need to
  wire them.
- **Per-tree pose variants** (Word Song celebration vs Number Garden celebration). v1
  uses `pose="celebration"` in both cases.
- **Confetti / bigger particle effects.** The 8-sparkle burst is deliberately
  restrained. Per CLAUDE.md anti-dark-pattern stance: celebration is generous +
  predictable, not Vegas.

---

## Implementation pointers (for Kevin)

These are pointers, not prescriptions — Kevin owns the React shape.

- **Hook location.** A `useHubPromotionCelebration({ progress, mounted, onClear })`
  hook in `src/screens/Hub/` mirrors the existing `useRapidRemountSuppression` /
  `useParentGateLongPress` shape. The hook reads `progress.pendingPromotion`, maps it
  to a tree + path-strip cell selector, picks the variant via `pseudoRandom`, and
  exposes:
  - `celebrating: boolean` — for the welcome-back useEffect to short-circuit on.
  - `lineId: HubLineId | null` — feeds `playLine(lineId, ...)`.
  - `cellSelector: string | null` — for the sparkle-burst component to query.
  - `dispatch(): void` — fires the burst + audio + pose + ribbon, then calls
    `onClear()` to clear `pendingPromotion`.
- **EmmaCharacter pose prop.** Already accepts `pose="celebration"`. Hub currently
  hardcodes `pose="idle"` (Hub.tsx:430). Kevin: gate that on `celebrating`:
  `pose={celebrating ? 'celebration' : 'idle'}`.
- **Sparkle component.** New file `src/screens/Hub/CelebrationSparkles.tsx`. Takes
  origin coords (`{ x, y }` in viewport pixels), renders the 8 `<m.span>` particles
  with the per-particle motion config in § "Sparkle particle burst". Mounts when
  `celebrating === true` and origin is non-null; unmounts on `AnimatePresence` exit
  after the longest particle's 1200ms lifetime + 30ms × 7 stagger ≈ 1410ms.
- **Path-strip cell origin lookup.** Inside the hook, after layout, do a
  `document.querySelector('[data-tree="<tree>"][data-stage="<stageId>"]')` and read
  `getBoundingClientRect()` once. Memoise. (DOM-querying from a hook is acceptable
  here — we're reading a layout origin, not subscribing to anything.)
- **Test seam.** Same shape as Hub's existing `playLineFn` test seam: `celebrationCellLookup?:
  () => DOMRect | null` so Hub.test.tsx can inject a fake bounding rect without
  needing real layout.
- **No new motion config** for Emma's pose flip. The EmmaCharacter component already
  encodes `TILT_SPRING_BY_POSE.celebration = { stiffness: 220, damping: 22 }` and
  `CELEBRATION_TILT_KEYFRAMES`. Kevin: just pass the pose prop. Do **not** add
  per-pose motion config in the Hub layer; that's the EmmaCharacter component's
  responsibility.

---

## Provenance

- Audit finding source: `design/audits/2026-05-02-polish/kyle-visual-ux.md`
  P0 "Hub does not consume real progress; promotion is invisible" + P1 "No
  mastery-promotion celebration moment".
- Data contract source: `src/lib/progress/types.ts` § `pendingPromotion`,
  `src/lib/progress/mastery.ts` § `applyMasteryRule`.
- Hub canonical spec: `design/screen-hub.md` (audio integration contract, motion
  config, side-effect inventory all inherited from there).
- Character pose pipeline: `src/components/EmmaCharacter.tsx` —
  `celebration` pose, `CELEBRATION_TILT_KEYFRAMES`, `TILT_SPRING_BY_POSE`.
- Audio render pipeline: `scripts/render-greet-mp3s.mjs` (existing) — same
  pipeline produces the three new `hub-celebrate-*.mp3` files.
- Author: Marian Tutor design persona, ticket `86c9kwnkw` companion design spec.
