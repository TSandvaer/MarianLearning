# Screen 3 — Math: Subitising Dot-Pattern Prompt (sums ≤ 5)

**Audience:** Devon (impl), Kevin (review), Jessica (QA), Thomas (taste).
**Scope:** Add a brief dot-pattern visual flash before the flowers appear on `add-to-10` problems where both addends are ≤ 5. Subitising **affordance**, not flower replacement. Flowers stay; the dot-card adds a parallel recognition pathway.
**Status:** Spec — implementation blocked on this PR merging. Devon picks up impl after spec approval.
**Ticket:** `86c9pwghh`. Related research: [`design/research/add-to-10-counting-to-recall.md`](research/add-to-10-counting-to-recall.md) (Dave, PR #161). Related impl: Kevin's parallel Leitner M4 ticket `86c9pwgc8`.
**Anchor:** [`design/screen-3-math.md`](screen-3-math.md) is the canonical Math screen spec; this doc is a **layered addition**, NOT a replacement.

This spec defers entirely to `screen-3-math.md` for Math screen layout, distractor policy, audio integration contract, wrong-answer policy, stardust treatment, and AC base set. Only the dot-card overlay's placement, motion, audio, trigger, and accessibility touchpoints are specified here.

---

## Goal

Marian sees a 1-second dot-pattern flash above the flower display when she enters an `add-to-10` problem with both addends ≤ 5, and Emma reads the addends aloud over the flash. The visual gives her an instant subitising recognition (e.g. "three" + "two" as dot-card patterns) **before** the counting affordance (flowers) is available. The intent is to layer a recognition pathway alongside her existing counting pathway — not to replace counting.

**This is not** a replacement for flowers. It is not a separate screen. It is not a quiz on the dot pattern. It is a quiet additional cue that fires during the read-aloud window and disappears as the flowers appear, the same way a teacher might briefly hold up a dot-card before stepping aside to let the student work.

---

## User state entering this screen

Marian is in a normal Math session — either entry path documented in `screen-3-math.md` §"User state entering this screen". She has just landed on a problem (the per-problem entry stagger has begun). She is procedurally counting on most problems (per the April 2026 diagnostic and Marian's 2026-05-08 iPad signal — counting flowers on `3+2` and `6+4`).

The only difference this spec introduces: when the current problem's addends are both ≤ 5, a dot-pattern overlay appears briefly above the flower display while Emma reads the line. After the overlay fades, the flower display behaves exactly as today.

---

## Visual layout

**Anchor reference:** the existing Math screen layout in `screen-3-math.md` §"Visual layout". Vertical rhythm is unchanged; the dot-card occupies a position that is currently negative space between the symbolic line and the visual-groups (flower) row.

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 5     ●●●○○○○○         ✦ 3            |  HUD strip, 56pt
|                                          |
|  ( Emma     +-------------------+        |
|    upper-   | "Three and two —  |        |  caption ribbon
|    left )   |   how many?"      |        |
|             +-------------------+        |
|                                          |
|              3   +   2   =   ?           |  symbolic, 96pt
|                                          |
|         ┌───────┐    ┌───────┐           |  ◀── DOT-CARD ROW (NEW)
|         │ ●     │    │ ●     │           |     overlay slot, ~9vh tall
|         │   ●   │    │   ●   │           |     centred, fades in/out
|         │     ● │    └───────┘           |     "3" pattern  +  "2" pattern
|         └───────┘                        |
|                                          |
|         🌸 🌸 🌸    +    🌸 🌸           |  flowers, 64pt
|                                          |     (rendered IN PLACE,
|                                          |      no shift; see below)
|                                          |
|   ┌────────┐  ┌────────┐  ┌────────┐     |  3 chips, 88pt
|   │   4    │  │   5    │  │   6    │     |
|   └────────┘  └────────┘  └────────┘     |
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

### Where the dot-card sits

- **Position:** between the symbolic-line row and the visual-groups (flower) row, in the existing 24pt `gap-6` band that already separates them ([`Math.tsx:1732`](MarianLearning/src/screens/Math/Math.tsx#L1732)).
- **Layout strategy:** **absolutely positioned overlay**, NOT a flow-layout row. The dot-card is `position: absolute` within the existing `flex flex-col` problem-display container, anchored to the same horizontal axis as the flower row. It overlays the position the flowers will occupy; the flowers render in normal flow underneath at `opacity: 0` until the dot-card fades, at which point the flowers cross-fade in.
- **Why an overlay, not a flow row:** layout stability. If the dot-card occupied a flow-layout row, the flowers and chips would shift down ~9vh during the dot-card window and back up after — an unsettling "jump" Marian would see. An overlay keeps every other element pinned. The 8vh spacer above the chip row is non-negotiable in `screen-3-math.md` §"Vertical rhythm" — the overlay approach preserves it.
- **Width:** ~70% of the problem-display container, centred on the same vertical axis as the flowers. The two dot-patterns (one per addend) sit side-by-side with the same 24pt gap that separates the flower groups. A `+` glyph is **not** rendered between dot-patterns — the visual reads as "two groups", and adding a `+` symbol would duplicate the symbolic row above.
- **Height:** ~9vh tall (same approximate footprint as the flower-groups row at 64pt). Each individual dot-pattern is rendered in a square cell — see §"Visual style decision" below for cell dimensions.
- **z-index:** above the flower row, below the caption ribbon and HUD. The caption ribbon sits in its own band higher up on the screen; nothing competes for the dot-card's space.

### Layout-stability rule (load-bearing)

The flowers MUST remain in their existing position. The dot-card overlay MUST NOT push the flowers, the chips, or the symbolic row. The visual contract is "the flowers were already there; the dot-card briefly covered them". Devon: render the existing `<div data-testid="math-visual-groups">` unchanged, mount the dot-card overlay on a new `<m.div data-testid="math-dot-card">` with `position: absolute` inside the existing `mt-4 flex flex-1 flex-col items-center justify-center gap-6 px-4` container, and gate flower opacity on the dot-card's lifecycle.

### Safe area / thumb zone

No change from `screen-3-math.md` §"Visual layout" — the dot-card overlay sits in the upper half of the viewport, well above the chip thumb zone. The chips remain disabled during the dot-card window per `readAloudPlayed` gate ([`Math.tsx:1783`](MarianLearning/src/screens/Math/Math.tsx#L1783)) — no risk of accidental tap during the visual flash.

---

## Visual style decision — dice pips (Dave's source 6)

**Decision:** dice-pip patterns. Each addend renders as the canonical die face for that quantity, drawn at chip scale.

### Choices considered

| Style                                                     | Pro                                                                                                                                                                                                                                   | Con                                                                                                                                                                                                                       | Decision                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Dice pips** (canonical 1–5 die faces)                   | Universally recognised by 8-year-olds. Subitising research uses these. Reusable across all sums-≤-5 problems with zero authoring per problem. Two pips for `2`, three pips for `3` — culturally neutral, no Tagalog-English friction. | None at sums ≤ 5. Breaks at 6+ (a die has only 6 faces; six pips need a different arrangement).                                                                                                                           | **Selected.**                                                       |
| **Ten-frame** (5×2 grid, fill cells)                      | Precise — "two filled, three empty" reads as `2`. Strong pedagogical precedent in US grade-2 curricula.                                                                                                                               | Marian has not yet been exposed to ten-frames in any prior surface; this would be a new visual vocabulary alongside the new affordance. Two ten-frames side-by-side at small size are visually busier than two die faces. | Rejected — adds a new visual vocabulary on top of a new affordance. |
| **Random-arrangement subitising** (irregular dot scatter) | Honest to the original Clements subitising research; tests "true" pattern recognition.                                                                                                                                                | Inconsistent across problems — `3` looks different every time. For a child still building automaticity, inconsistency is noise. The recognition pathway we're trying to build benefits from a **stable** pattern.         | Rejected — inconsistency works against Marian.                      |

### Rationale (Dave's source 6, Clements via Hechinger 2023)

Dave's research deliverable §2 Intervention A cites Clements (Hechinger 2023, Made For Math) as the "moderate evidence" baseline for subitising as an automaticity accelerator. The mechanism is that recognising a small-quantity pattern at a glance creates an internal quantity image that can be **combined** rather than reconstructed. Dice pips are the most-common subitising stimulus in the practitioner literature for exactly this reason: they're the canonical 1–5 patterns, instantly recognisable, and stable.

The research does not specifically RCT dice pips vs. ten-frames vs. random arrangements (this is Dave's open-flag in his Risks §1). Given the choice has to be made, dice pips are the safest pick because:

1. **Cross-cultural recognisability.** Marian has likely seen dice in board-game contexts; ten-frames are a US-classroom artefact.
2. **Stability.** A `3`-pip pattern looks the same on every problem. Pattern recognition needs consistency to consolidate.
3. **Fits Marian's existing visual vocabulary.** No new abstract grid metaphor introduced; it's just dots.

Ten-frame can be added later as a polish enhancement if research signals it would help, but for v1 ship dice pips.

### Pip layout

Standard 6-sided die faces, 1 through 5:

```
   1          2          3            4            5

   ●         ●         ●         ●     ●       ●     ●
                                                  ●
                ●          ●                     ●     ●

                              ●     ●     ●     ●
```

Each dot-card cell is a `~80pt × 80pt` rounded-square (24pt radius), white fill, soft pink border (`--my-pink`), centred dots. Dots are 12pt diameter, ink-coloured (`--ink`). The pattern grid uses a fixed 3×3 cell layout with the dots positioned per the canonical die faces:

- `1` → centre cell
- `2` → top-left + bottom-right
- `3` → top-left + centre + bottom-right
- `4` → four corners
- `5` → four corners + centre

This matches the standard Western die layout. The 3×3 grid stays implicit in code (positions are hand-coded fractions of the cell, not a CSS grid) so layout is stable across browser zoom levels.

**Asset-light:** the dot-card is a small inline SVG component, NOT an authored asset. No new file in `public/assets/`. Devon writes a `<DotCard pips={n} />` component (see §"Assets required").

---

## Copy / TTS script

**Decision:** the existing `math.p{N}.read` line stays unchanged. **No new utterance is added.** Emma's read-aloud line for an in-scope problem (e.g. `3 + 2`) is the canonical `"Three plus two. How many?"` — same as today. The dot-card visual fires alongside this existing utterance.

### Why no new line

The brief asked whether Emma should say something like _"Three and two — how many?"_. The decision is **no**, and the rationale is grounded in three constraints:

1. **TTS pre-warm pattern (audio-system.md).** The Math session plan is canon-baked at build time. Adding a new per-problem utterance (`math.p{N}.subitise` or similar) bumps the canon JSON shape, requires a `npm run canon:regen` against Anthropic, and forces a `CACHE_VERSION` bump in `sessionAudio.ts` (currently `3`) so old cached blobs are evicted. That's a non-trivial impl cost for a pedagogical gain that is duplicative.
2. **The existing read line already names the addends.** _"Three plus two. How many?"_ contains both quantities Marian needs to subitise. Replacing "plus" with "and" buys nothing pedagogically — both words map to the same operation in her mental model — and doubles the audio bake.
3. **Cognitive-load risk.** Two simultaneous phonological streams (one read line + one subitising line over the same window) would compete for working-memory. Dave's research §3 (Mammarella et al., 2023) flags working-memory pressure as a state-anxiety driver at this age. One audio stream is enough.

The dot-card visual handles its own affordance silently. Emma's existing voice carries the addends; the dots show the patterns. Marian's brain does the merge.

**No copy decks change for this spec.** The existing `math.p{N}.read | correct | reprompt | hint | giveAnswer` lines (per `screen-3-math.md` §"Audio integration contract") are unchanged.

### Caption ribbon behaviour

Unchanged. The existing word-by-word caption reveal continues as today, mirroring the read-aloud line. The dot-card does NOT trigger a caption change.

---

## Motion

### Animation envelope (locked)

The dot-card flash is a **single short animation cycle** that runs alongside the existing per-problem entry stagger and the read-aloud:

```
t=0ms      : problem mount; per-problem entry stagger begins
t=0ms      : dot-card mounts at opacity:0, scale:0.92
t=0-200ms  : dot-card fade-in + scale-up to opacity:1, scale:1
             (spring: stiffness 220, damping 22 — same family as
              EmmaCharacter celebration; "arrives gently")
t=0ms      : Emma's read-aloud begins (existing speak() call)
t=200ms    : dot-card holds at full opacity for ~700ms
             (the hold IS the subitising window — Marian sees the
              patterns settled while Emma's voice names them)
t=900ms    : dot-card begins fade-out + scale-down to opacity:0,
             scale:0.92 (200ms tween, easeOut)
t=900ms    : flower row begins fade-in (opacity:0 → 1, 250ms tween)
             — cross-faded with the dot-card so the visual
             continuity is "the dot-card was here, now the flowers
             are here"
t=1100ms  : dot-card fully unmounted; flowers at opacity:1
t=~1500ms  : Emma's read-aloud completes (typical "Three plus two.
             How many?" runs ~1.6-1.8s at -10% rate per Azure
             render); chips become tappable per existing
             readAloudPlayed gate
```

**Total dot-card lifecycle:** 1100ms from mount to unmount. The read-aloud lifecycle is ~1.6-1.8s, so the dot-card fades before Emma finishes speaking — matching the spec's intent: the visual is a _brief recognition cue_, not a static label that lingers through the whole problem.

### Spring config

- **Fade-in:** spring `{ stiffness: 220, damping: 22 }`. Same family as `EmmaCharacter`'s celebration spring (`emmaPose.ts` `TILT_SPRING_BY_POSE.celebration`). Coheres motion vocabulary across the screen.
- **Fade-out:** tween `{ duration: 0.2, ease: 'easeOut' }`. A spring on fade-out would over-bounce and read as ambivalent; a tween reads as a clean exit.
- **Flower fade-in:** tween `{ duration: 0.25, ease: 'easeOut' }`. Slight overlap with dot-card fade-out (both run from t=900ms; flower takes 50ms longer) so the cross-fade reads continuous, not as two discrete events.

### Scale transform pivot

The dot-card scales from its centre (`transform-origin: 50% 50%`). At ±0.08 scale delta the centre-anchored scale doesn't visually drift, no layout impact.

### Reduced-motion path

When `usePrefersReducedMotion()` returns `true`:

- Skip the spring fade-in. Mount the dot-card at `opacity: 1, scale: 1` directly.
- Skip the scale transforms entirely.
- Hold for 1100ms at full opacity, then fade out via opacity-only tween (no scale).
- Flower fade-in via opacity-only tween.

Total visible duration is unchanged (1100ms). Marian-with-reduce-motion still gets the same recognition window; only the in/out flourishes are skipped. This matches `screen-3-math.md` §"AC: With Reduce Motion".

### Flower coordination

The flower-group row already exists in the DOM today, at `opacity: 1` always. The new behaviour:

- **Trigger condition met (in scope):** flowers mount at `opacity: 0`, hold at 0 from t=0 to t=900ms, fade in 0→1 from t=900ms to t=1150ms.
- **Trigger condition not met (out of scope, sums > 5 OR addend > 5):** flowers behave as today — `opacity: 1` from problem mount, no dot-card overlay, no fade.

The flower opacity is gated through a single boolean prop or className that the dot-card lifecycle drives. Devon: simplest impl is a state ref (`dotCardActiveRef`) on the problem container; flower opacity binds to it.

---

## Trigger condition — explicit logic

### The rule

```pseudocode
function shouldShowDotCard(problem, focusNode, parentSettings) {
  // Only fires on add-to-10 focus node — the only node where
  // sums-to-10 problems are generated. Other math nodes produce
  // different problem shapes (subtraction, two-digit, etc.) where
  // the dot-card affordance does not apply.
  if (focusNode !== 'add-to-10') return false

  // Both addends ≤ 5. NOT "sum ≤ 5" — sums up to 10 with one large
  // addend (e.g. 6+4) are out of scope per Dave's research § "Recommendation:
  // Add dot-pattern visual prompts for sums ≤ 5". Marian was observed
  // counting on 6+4 too, but the dice-pip vocabulary collapses at 6+
  // (a die only has 1-5 single-die faces) and Dave's recommendation
  // explicitly scopes the intervention to "sums ≤ 5" in build-cost-
  // efficient territory.
  if (problem.addendA > 5 || problem.addendB > 5) return false

  // Reduced-motion: dot-card still shows but with the simplified
  // opacity-only animation per §Motion. (NOT skipped on reduced-motion
  // — the recognition cue is the point; only the flourishes are
  // collapsed.)
  return true
}
```

**Important:** the rule is **both addends ≤ 5**, NOT **sum ≤ 5**. A sum of 5 with addends `5+0` would technically fit "sum ≤ 5" but `5+0` isn't in Marian's `add-to-10` problem space (per `_planner.ts` MATH_TRACK_GUIDE — addends are `≥ 1`). The "both addends ≤ 5" formulation is explicit and matches the dice-pip representation budget exactly.

### In-scope problem coverage (sample)

Out of the 8-problem `add-to-10` session, the typical canon plan has problems like `2+1, 3+2, 2+2, 4+3, 5+1, 4+4, 6+3, 5+5`. Of these:

| Problem | Addend A | Addend B | Both ≤ 5? | Dot-card fires?                           |
| ------- | -------- | -------- | --------- | ----------------------------------------- |
| `2+1`   | 2        | 1        | yes       | yes                                       |
| `3+2`   | 3        | 2        | yes       | **yes** ← Marian's observed counting case |
| `2+2`   | 2        | 2        | yes       | yes                                       |
| `4+3`   | 4        | 3        | yes       | yes                                       |
| `5+1`   | 5        | 1        | yes       | yes                                       |
| `4+4`   | 4        | 4        | yes       | yes                                       |
| `6+3`   | 6        | 3        | **no**    | no — out of scope                         |
| `5+5`   | 5        | 5        | yes       | yes                                       |

So roughly 7 of 8 typical problems fire the dot-card. The session contains a mix of in-scope and out-of-scope problems by design (the planner doesn't filter on this); the dot-card just fires when applicable, naturally.

### Why NOT trigger on Leitner box-1 facts

The brief asked whether the trigger should depend on Leitner box-1 state (i.e. fire only on facts Marian is least familiar with). **Decision: no.** The trigger is purely structural — addends ≤ 5 — for three reasons:

1. **Kevin's Leitner M4 ticket (`86c9pwgc8`) runs in parallel.** Coupling the dot-card to Leitner state means this spec's impl cannot ship until M4 ships. Dave's research ranks M4 as Priority 1 and dot-card as Priority 2; both are independent additive interventions and should ship independently.
2. **Subitising builds the recognition pathway whether or not the fact is in box-1.** Even on a fact Marian retrieves cleanly today (e.g. `2+1`), the dot-card reinforces the underlying quantity representation. There's no pedagogical loss to firing on familiar facts.
3. **Predictability.** A dot-card that fires inconsistently from problem to problem (because Leitner state is internal) would feel arbitrary to Marian. A dot-card that fires whenever the addends are ≤ 5 is a stable visual contract.

### Why NOT trigger on focusNode = `sub-to-10` later

Out of v1 scope. Subtraction has a different mental model (taking-away vs. combining); a single dot-card showing the minuend isn't directly informative about the difference. If subtraction ever gets a subitising affordance, it's a fresh design — see §"Out of scope".

---

## First-read vs retry

**Decision: dot-card appears ONLY on first presentation of the problem. It does NOT re-appear on retry, hint, or guided completion.**

### Per-problem dot-card state machine

```
problem-mount → DOT_VISIBLE (1100ms lifecycle) → DOT_DISMISSED (sticky)

  ↓ wrong tap → Emma puzzled, "Hmm... try again?" plays (per existing
                wrong-answer policy in screen-3-math.md). NO dot-card
                re-show. Flowers stay visible for the retry. Chips
                stay tappable.

  ↓ 2nd wrong → hint state (flower-group pulse choreography per
                existing screen-3-math.md). NO dot-card re-show.
                Flowers carry the hint visual.

  ↓ 3rd wrong → guided completion ("This one is five.") per existing
                screen-3-math.md. NO dot-card re-show.

  ↓ correct (any path) → advance to next problem; dot-card state
                resets for the new problem.
```

### Why one-shot

1. **The dot-card is a cue, not a hint.** Showing it again would dilute the existing hint mechanic (flower-group pulse with TTS narration). The existing hint is more pedagogically targeted at the failure mode (counting miscount); the dot-card is a recognition prompt that's most valuable when the brain is fresh on the problem.
2. **Layout stability on retry.** Re-showing the dot-card would mean re-hiding the flowers mid-retry, which is jarring after Marian has been examining them.
3. **Marian saw the patterns once already.** The recognition cue's job is done after the first presentation. Subsequent attempts are about counting + correction.

### What if Marian backgrounds the PWA mid-dot-card-flash?

Per `screen-3-math.md` §"Implementation pointers" + `pageHidden` handling at [`Math.tsx:1300`](MarianLearning/src/screens/Math/Math.tsx#L1300), the existing visibility lifecycle is preserved:

- If `useIsPageHidden()` flips to `true` during the dot-card window: pause the dot-card animation at its current state. Flowers stay at `opacity: 0` (since the dot-card hasn't dismissed). Read-aloud already pauses via the existing audio stack.
- On `visible` return: dot-card animation resumes from where it paused; flowers cross-fade in at the natural end of the dot-card lifecycle.
- On the pending-resume gate firing (per `pendingResumeGate.ts`): the dot-card lifecycle is paused; resume happens on the user's tap-to-continue gesture.

No special handling required from this spec — the existing visibility / pending-resume infrastructure picks it up. Devon: if the dot-card animation is implemented via Framer Motion's `<m.div>`, the visibility hook can pause via `whileInView` semantics or — more reliably — by binding the animate prop to a `pageHidden`-aware ref.

---

## States

The Math screen's existing state taxonomy in `screen-3-math.md` §"States" stays canonical. This spec adds one new sub-state:

### Dot-card visible (NEW, on in-scope problems)

- **Trigger:** problem mount where `shouldShowDotCard(problem, focusNode, parentSettings) === true`.
- **Visible elements:** dot-card overlay (two cells, dice pips per addend), flowers at `opacity: 0`.
- **Audio:** existing `math.p{N}.read` plays.
- **Chip state:** disabled (per existing `readAloudPlayed` gate; nothing changes).
- **Duration:** 1100ms (200ms in + 700ms hold + 200ms out + 250ms flower-in overlap).
- **Exit:** dot-card unmounts, flowers complete cross-fade-in. Idle (per-problem) state engages as today.

### Idle (per-problem) — modified flower opacity rule

Existing idle state in `screen-3-math.md` §"States" → "Idle (per-problem)". Modification:

- On in-scope problems: flowers display at `opacity: 1` AFTER the dot-card lifecycle completes. Same final visual state as today.
- On out-of-scope problems (addend > 5): flowers display at `opacity: 1` from problem mount. Identical to today's behaviour.

No other state changes. Wrong path, hint state, guided completion, transition in/out all behave per `screen-3-math.md`.

### Reduced-motion variant of dot-card visible

- Mount the dot-card at full opacity directly (no spring scale-in).
- Hold for 900ms (instead of 700ms; the lost in/out springs leave Marian seeing the same total recognition window).
- Fade out via opacity-only tween, 200ms.
- Flowers cross-fade in via opacity-only tween, 250ms.
- Total lifecycle 1150ms — within ±50ms of the full-motion variant.

---

## Assets required

### NEW (asset-light)

| Asset                                  | Used for                      | Author       | Size                                                    |
| -------------------------------------- | ----------------------------- | ------------ | ------------------------------------------------------- |
| `<DotCard pips={n} />` React component | Dot-pattern overlay rendering | Devon (impl) | ~1 KB inline-SVG primitives, NOT a separate `.svg` file |

The dot-card is a React component that renders an inline SVG with the canonical dice-pip pattern for `n ∈ {1, 2, 3, 4, 5}`. No new file in `public/assets/` is required. Following the same approach as `<FlowerGlyph>` and `<SparkleGlyph>` in [`Math.tsx:1879-1899`](MarianLearning/src/screens/Math/Math.tsx#L1879).

**Component shape (illustrative):**

```tsx
interface DotCardProps {
  pips: 1 | 2 | 3 | 4 | 5
  ariaLabel?: string // defaults to e.g. "three"
}

function DotCard({ pips, ariaLabel }: DotCardProps) {
  return (
    <div data-testid="math-dot-card-cell" data-pips={pips}>
      <svg
        viewBox="0 0 80 80"
        role="img"
        aria-label={ariaLabel ?? PIPS_TO_WORD[pips]}
      >
        {/* dot positions per canonical die face */}
      </svg>
    </div>
  )
}
```

The container component:

```tsx
interface DotCardOverlayProps {
  addendA: number
  addendB: number
  reducedMotion: boolean
  onComplete: () => void // fires when fade-out completes
}
```

renders two `<DotCard>` instances side-by-side and owns the lifecycle motion.

### REUSE (no change)

| Asset                                              | Notes                                                                                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<FlowerGroup>` / `<FlowerGlyph>`                  | Existing inline-SVG flower components ([`Math.tsx:1903`](MarianLearning/src/screens/Math/Math.tsx#L1903)). Modify only their opacity gating per the dot-card lifecycle; the components themselves are unchanged. |
| Math caption ribbon                                | Unchanged.                                                                                                                                                                                                       |
| Emma poses                                         | Unchanged.                                                                                                                                                                                                       |
| `math.p{N}.read` etc. utterances                   | Unchanged. No canon regen required.                                                                                                                                                                              |
| SFX (`sfx-sparkle`, `sfx-poof`, `sfx-plink`, etc.) | Unchanged — none fire on dot-card mount/dismiss. The dot-card is a silent visual cue; the audio belongs to Emma's read-aloud.                                                                                    |

### NOT required

- New TTS line — see §"Copy / TTS script".
- New `.svg` file — see above.
- New SFX — the dot-card is silent.
- New canon regen — utterances unchanged.
- New parent-settings field unless §"Accessibility notes" lands the optional flash-duration tunable (which is **deferred** to v2 per the conservatism call below).

---

## Accessibility notes

### Reduced motion

Honoured per §"Motion → Reduced-motion path". Dot-card still shows, but in/out flourishes are collapsed to opacity-only tweens. Marian-with-reduce-motion (or a parent who's enabled iPad Settings → Accessibility → Motion → Reduce Motion) still gets the recognition cue; the dot-card never animates with motion that would trigger vestibular discomfort.

### Page hidden / pending resume

Honoured via existing infrastructure — see §"First-read vs retry" → "What if Marian backgrounds…". The dot-card is paused by the same visibility hook that pauses the read-aloud. No new code path required for this; Devon: the dot-card animation just needs to bind to the existing `pageHidden`-aware refs that the read-aloud already uses.

### ARIA

- Each dot-card cell sets `role="img"` with `aria-label={n}` where `n` is the spelled English word ("three", "two") — matches the spelled form Emma is speaking.
- The container `<div data-testid="math-dot-card">` sets `aria-hidden="true"` to keep VoiceOver focus on the ribbon caption; the dot-card is **decorative** in screen-reader semantics. Marian-with-VoiceOver hears the read-aloud + the caption ribbon; the dot-card is parallel visual reinforcement she doesn't need narrated. (Note: this is hypothetical — Marian doesn't currently use VoiceOver; the ARIA is hygiene for future-proofing.)

### Flash-duration parent tunability — DEFERRED to v2

The brief asked whether the flash duration should be parent-tunable. **Decision: no, not in v1.**

**Rationale:**

1. **No data yet.** We don't know whether 1100ms is the right duration — that's an empirical question that depends on Marian's actual subitising fluency. Shipping a tunable before we know the right default risks parents picking a value that hurts learning.
2. **Adds parent-settings surface area.** The current `parentSettings` shape (M2.5, locked 2026-05-02 in `parentSettings.ts`) is five knobs. Adding a sixth is a non-trivial UI change in `ParentSettings.tsx` for a feature that may not need tuning at all.
3. **The reduced-motion preference already provides the binary toggle that matters.** Iff a parent finds the flash overstimulating, iPad Settings → Accessibility → Motion → Reduce Motion already collapses it.

**Path for v2 (out of scope of this spec):** if Thomas wants to add a tunable after Marian uses v1 for a few weeks, the shape would be a single new ParentSettings field `subitisingFlashDurationMs?: 700 | 1100 | 1500 | 'off'` with default `1100`. `'off'` would skip the dot-card entirely — the affordance becomes opt-in on parent's call. That's a follow-up ticket, not this one.

### Keyboard navigation

Math chips are the only interactive elements; they're already managed by the existing `disabled` gate on `readAloudPlayed`. The dot-card does NOT introduce any new interactive elements — there's nothing to focus, nothing to tab to.

### Colour contrast

Dot fill (`--ink`) on white cell background passes WCAG AA contrast at the 12pt dot size. Cell border (`--my-pink`) is decorative and not load-bearing on the affordance.

---

## Out-of-scope confirmation

This spec does **NOT** propose:

- ❌ **Removing flowers globally.** Flowers stay on every problem. The dot-card is additive. Per Dave's research §2 Intervention C and source 9 (Bouck 2018, CRA literature): pulling concrete affordances before per-fact retrieval is demonstrated is contraindicated.
- ❌ **Subitising for sums > 5 or addends > 5.** Out of scope per Dave's recommendation. The dice-pip vocabulary tops out at 5 per face; sums > 5 with one addend > 5 produce a single oversized pip cluster that defeats the subitising purpose. Future work could explore a different visual (10-frame, fingers, etc.) for the larger range; this spec doesn't.
- ❌ **Subitising on Word Song.** Out of scope. Word Song problems read CVC words, not quantities.
- ❌ **Subitising on multiplication, subtraction, two-digit.** Out of scope. Each math focus node has its own pedagogical surface; subitising is specifically tuned to the addends-of-small-quantities case in `add-to-10`.
- ❌ **Per-fact dot-card removal as Marian masters the fact.** Out of scope. The dot-card fires on every in-scope problem; per-fact dynamic suppression is a future complexity that depends on Leitner state (which is Kevin's M4 work). In v1 the dot-card is a stable structural prompt.
- ❌ **A countdown timer or speed celebration on the dot-card.** Out of scope per Dave's research §2 Intervention E (countdown timers contraindicated). The dot-card has its own predictable lifecycle; no timer surfaces.
- ❌ **Latency-aware trigger.** Out of scope. The brief noted Kevin's Leitner ticket may add per-fact latency capture; this spec deliberately doesn't depend on it.
- ❌ **A new TTS line.** Spec stays on the existing `math.p{N}.read` utterance. See §"Copy / TTS script".
- ❌ **Stardust delta on dot-card.** No new stardust mechanics. The dot-card is a learning affordance; rewards remain on correct chip taps per existing stardust treatment.

These constraints are pinned so future scope creep doesn't accidentally land here. Anything in the above list requires a fresh ticket.

---

## Acceptance criteria

Functional:

- [ ] On `add-to-10` focus node, when both addends ≤ 5, dot-card overlay mounts on problem entry with two cells (one per addend) showing canonical dice-pip patterns
- [ ] On `add-to-10` focus node, when either addend > 5, NO dot-card overlay mounts — flowers display from problem mount as today
- [ ] On other math focus nodes (`number-recog`, `sub-to-10`, `add-to-20`, `two-digit-addsub`, etc.), NO dot-card overlay mounts under any problem shape
- [ ] Dot-card cells render dice-pip patterns matching the canonical Western die layout for `n ∈ {1, 2, 3, 4, 5}`:
  - 1 → centre
  - 2 → top-left + bottom-right
  - 3 → top-left + centre + bottom-right
  - 4 → four corners
  - 5 → four corners + centre
- [ ] Dot-card overlay is `position: absolute` over the flower-row position; layout of symbolic row, chips, and HUD does NOT shift when the dot-card mounts or dismisses
- [ ] Dot-card lifecycle on full-motion: 200ms fade-in (spring 220/22, scale 0.92→1) + 700ms hold + 200ms fade-out (tween easeOut, scale 1→0.92)
- [ ] Flowers begin fade-in (250ms tween easeOut) at t=900ms, fully opaque at t=1150ms
- [ ] Dot-card unmounts at t=1100ms; on out-of-scope problems flowers display at opacity 1 from t=0
- [ ] Dot-card fires ONLY on first presentation of a problem; does NOT re-fire on wrong-tap retry, hint, or guided-completion

Audio integration:

- [ ] Existing `math.p{N}.read` utterance plays unchanged
- [ ] Caption ribbon reveal unchanged
- [ ] No new utterances added to canon
- [ ] No SFX fires on dot-card mount or dismiss
- [ ] Chip-tap audio (`math.p{N}.correct | reprompt | hint | giveAnswer`) unchanged

Reduced motion:

- [ ] When `usePrefersReducedMotion()` returns `true`: dot-card mounts at `opacity: 1, scale: 1` directly (no spring fade-in)
- [ ] Reduced-motion hold duration is 900ms (vs. 700ms full-motion); fade-out is 200ms opacity-only tween
- [ ] Total dot-card lifecycle on reduced-motion is 1100±50ms — same total visible window as full-motion
- [ ] Reduced-motion still shows the dot-card; the affordance is not skipped, only the flourishes

Page lifecycle:

- [ ] When `useIsPageHidden()` flips to true during dot-card window: dot-card animation pauses, flowers stay at opacity 0 (since dot-card hasn't dismissed)
- [ ] On page-visible return: dot-card animation resumes from current state; flowers cross-fade in at natural end of dot-card lifecycle
- [ ] Pending-resume gate firing during dot-card window: dot-card lifecycle pauses; resumes on user tap

Data integrity:

- [ ] Math screen `MathSessionResult` shape (`totalCorrect`, `totalStardust`, `finalStreak`, `earnedThisSession`) unchanged
- [ ] No new ParentSettings field required (flash-duration tunability deferred to v2)
- [ ] No new localStorage keys
- [ ] No new canon regen required (existing `add-to-10` canon JSON works as-is)

Test seams:

- [ ] `<DotCard pips={n} />` exposes `data-testid="math-dot-card-cell"` and `data-pips={n}` for unit testing
- [ ] Dot-card overlay container exposes `data-testid="math-dot-card"` for component-level testing
- [ ] Math screen exposes a way to assert dot-card visibility via DOM selector + count assertion (`document.querySelectorAll('[data-testid="math-dot-card-cell"]').length === 2` on in-scope problem; `=== 0` on out-of-scope)
- [ ] Devon: optional `__testDisableDotCard?: boolean` prop on `Math.tsx` to skip the dot-card lifecycle in unit tests that shouldn't pay the 1100ms wait — defaulting to `false` so e2e specs see real behaviour

iPad PWA:

- [ ] On iPad Safari deployed PWA install: dot-card mounts and animates without dropped frames at the 1100ms total lifecycle
- [ ] Dot-card does not introduce audio or layout glitches on cold-mount Math entry (Session 2+ first-tap path)
- [ ] On a mid-session interruption (phone call, Siri preempt) the dot-card lifecycle behaves per §"Page lifecycle" above

Anti-dark-pattern:

- [ ] Dot-card has no associated stardust, streak interaction, or score impact
- [ ] No "watch the dots!" or other prompts that pressure Marian to attend
- [ ] Dot-card on retry/hint paths is **absent** — Marian is not punished by losing the affordance and is not coaxed by re-showing it
- [ ] No timer / countdown on dot-card visibility

---

## Open questions for Devon (impl-specific)

1. **Existing dot-card SVG reuse possibility:** there's no existing dot-card SVG in `public/assets/` — does the project have any inline-SVG primitives Devon would want to reuse for the pip rendering, or is hand-rolling `<DotCard pips={n} />` from scratch (matching the `<FlowerGlyph>` / `<SparkleGlyph>` pattern at [`Math.tsx:1879-1929`](MarianLearning/src/screens/Math/Math.tsx#L1879)) the right path? Recommend the latter for consistency.

2. **Layout impl detail — flower opacity gating:** the simplest impl is a `dotCardActiveRef` on the problem container that drives a className/opacity prop on the existing `<div data-testid="math-visual-groups">`. Alternative: lift dot-card lifecycle into the existing per-problem state machine (`mathSequence.ts` if extracted, or inline). Devon's call. Spec doesn't constrain.

3. **Dot-card animation primitive:** Framer Motion `<m.div>` with `initial`/`animate`/`exit` props is the natural fit (consistent with `EmmaCharacter` and the chip celebration at [`Math.tsx:1837`](MarianLearning/src/screens/Math/Math.tsx#L1837)). `AnimatePresence` wrapping the dot-card to drive the unmount fade is the cleanest contract. Variant choice on Devon.

4. **Reduced-motion read:** Math already calls `usePrefersReducedMotion()` at [`Math.tsx:361`](MarianLearning/src/screens/Math/Math.tsx#L361). Reuse that hook value; don't introduce a second instance.

5. **Coordination with cold-mount audio gate:** `audioReady !== false` ([`Math.tsx:1729`](MarianLearning/src/screens/Math/Math.tsx#L1729)) gates the entire problem-display block (symbolic + flowers + chips). Dot-card should mount _inside_ that same gate — i.e. when `audioReady === false`, NEITHER the dot-card NOR the flowers render. Once the audio settles and `audioReady` flips to `true`, the dot-card mounts on the same render tick the rest of the problem display does. Devon: do not hoist the dot-card outside the `audioReady !== false` gate.

6. **`pageHidden` interaction with the dot-card timing:** the dot-card lifecycle is timer-driven (200/700/200ms windows). When `pageHidden` flips during the timer, naive `setTimeout` would still fire on the original schedule. Recommend: drive the dot-card via Framer Motion's animation engine (which respects browser tab pauses naturally) rather than imperative `setTimeout`. If Devon prefers `setTimeout` for orchestration, gate the timer setup on `!getIsPageHidden()` and clear/restart on visibility-change events — same pattern Math already uses for its other timed advances (e.g. [`Math.tsx:1300`](MarianLearning/src/screens/Math/Math.tsx#L1300)).

7. **Cross-coordination with Kevin's Leitner M4 (`86c9pwgc8`):** this spec's trigger is purely structural (addends ≤ 5). Kevin's M4 work introduces `mathFactsLeitner` reads in the planner; the trigger condition above does NOT depend on Leitner state. If Kevin's impl lands first, no integration work between the two PRs. If they land in either order, no merge conflict on the trigger logic.

8. **Test coverage:** unit-test `<DotCard>` for each `pips` value 1-5 (correct dot count and positions). Component-test `Math.tsx` with `addendA=3, addendB=2` (in-scope) for dot-card mount, lifecycle timing, flower fade-coordination. Component-test `Math.tsx` with `addendA=6, addendB=4` (out-of-scope) asserting `[data-testid="math-dot-card"]` is absent. e2e: extend `e2e/cold-mount-math-fetch-in-flight.spec.ts` (or add a new `e2e/dot-card-affordance.spec.ts`) with one in-scope and one out-of-scope problem assertion. Per `feedback_count_assertions_on_regression_tests.md` use count-based selectors (`expect(locator.count()).toBe(2)` for in-scope cells).

9. **Unit-test seams with `MotionConfig reducedMotion` overrides:** when testing reduced-motion lifecycle in vitest (jsdom), the global `MotionConfig reducedMotion="user"` honours `window.matchMedia('(prefers-reduced-motion: reduce)')`. The project's own `usePrefersReducedMotion` hook reads the same media query per-mount. Standard pattern: stub `matchMedia` in the test setup. Devon: there's nothing dot-card-specific here; the existing patterns work.

---

## Provenance

- Brief: ClickUp ticket `86c9pwghh` (subitising UX spec).
- Research anchor: `design/research/add-to-10-counting-to-recall.md` (Dave, PR #161). §2 Intervention A cites Clements via Hechinger 2023 + Made For Math as source 6 — moderate-evidence baseline for subitising as automaticity accelerator. §4 ROI ranks dot-card as **High** (priority 2 after Leitner M4).
- Anchor spec: `design/screen-3-math.md` (Kyle, ticket `86c9grn9c`) — canonical Math screen spec; this doc is a layered addition.
- Implementation reference: `MarianLearning/src/screens/Math/Math.tsx` § per-problem render block at lines 1700-1850.
- Audio-pipeline constraints: `.claude/docs/audio-system.md` (TTS pre-warm, canon contract, no live calls).
- Parallel work: Kevin's Leitner M4 ticket `86c9pwgc8` — dot-card trigger explicitly does NOT depend on Leitner state.
- Cross-vowel mode style precedent: `design/word-song/short-o-pool-expansion.md` § "Style anchor" — same reduced-motion + asset-light philosophy.
- Anti-dark-pattern audit: `screen-3-math.md` § "Anti-dark-pattern audit (this screen)" — the dot-card adds zero new pressure mechanics. No timer, no streak interaction, no stardust dependency.

---

## Anti-dark-pattern audit (this dot-card affordance)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] **No variable-ratio reward** — dot-card fires deterministically on in-scope problems; no randomness.
- [x] **No streak shame** — no streak interaction.
- [x] **No fake urgency** — no countdown on dot-card visibility; the 1100ms lifecycle is fixed and Emma's voice carries the whole problem regardless of whether Marian's eyes are on the dots.
- [x] **No social pressure** — no comparison, no leaderboard.
- [x] **No infinite content** — dot-card is per-problem, lasts 1100ms, dismisses.
- [x] **No surprise costs** — no IAP, no monetisation, no unlocks gated on dot-card use.
- [x] **Wrong answers unchanged** — the dot-card's one-shot rule means a wrong answer doesn't lose the dot-card "privilege"; Marian retries against the same flower display she's used to. Existing wrong-answer policy in `screen-3-math.md` is fully preserved.
- [x] **No "watch the dots!" pressure** — Emma doesn't reference the dots in any utterance. They appear, do their work or not, and dismiss. Marian is free to ignore them.

---

## Non-obvious findings to surface

For the `maintain-docs` Stop hook to consider promoting:

1. **Dice pips beat ten-frames for Marian's specific context.** Cross-cultural recognisability matters; ten-frames are a US-classroom artefact she hasn't been exposed to. Dice are universal. This is a Tagalog-primary L2 design-context insight worth retaining.
2. **The dot-card was deliberately decoupled from Leitner state.** Three independent reasons (parallelism with Kevin's M4, additive value on familiar facts, predictability). If a future spec proposes coupling them, it should re-justify against this list.
3. **No new TTS utterances were added.** This was a deliberate cost-avoidance call (canon regen + Anthropic credit) AND a pedagogical call (cognitive-load minimisation). Future spec authors should default to "reuse existing utterances" before adding new ones, given the canon-bake friction.
4. **Layout-stability rule:** absolute-positioned overlays preserve flow layout on iPad portrait. This is the right pattern for any future "brief decorative flash" affordance — Math, Word Song, or otherwise. Adding it as a flow-layout row would have shifted chips and broken the thumb-zone contract.
5. **Flash-duration parent tunability deferred to v2.** Surfacing this as a backlog item: if Marian's empirical signal suggests the duration is wrong, a `subitisingFlashDurationMs?: 700 | 1100 | 1500 | 'off'` ParentSettings field is the v2 shape. The `'off'` option doubles as the affordance kill switch — useful if a future Marian (older, fluent) doesn't need the cue.
6. **Dot-card vocabulary collapses at 6+.** A canonical die has 6 faces; six pips render as a 2×3 grid which is a different visual primitive than 1-5. If subitising is ever extended past sums-to-5, the rendering primitive changes — this is a v2 design boundary worth flagging.
