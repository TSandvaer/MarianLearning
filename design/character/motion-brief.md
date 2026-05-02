# Motion brief — Emma pose-to-pose transitions

**Audience:** Devon (impl).
**Author:** Marian Tutor design persona — Phase 3b dispatch (ticket `86c9kwh66`).
**Status:** Implementation brief. No code in this PR. Devon spins out a follow-up ticket from §"Implementation order" below.
**Source-of-truth bible:** [`design/character-emma.md`](../character-emma.md) §3 ("Animation re-mapping") and §5 ("Animation hooks contract").
**Existing module:** [`src/lib/character/emmaPose.ts`](../../src/lib/character/emmaPose.ts) — exports `EmmaPose`, `TILT_BY_POSE`, `POSE_HOLD_MS`. **`TILT_BY_POSE` is currently NOT consumed by any screen**; this brief closes that gap.

---

## Goal

Wire Emma's pose-to-pose transitions so a correct answer feels like a small warm head-tilt-and-smile, a wrong answer feels like a curious sideways tilt, and the hint state visibly directs Marian's attention. Today's app cross-fades pose SVGs on opacity only; the choreography spec'd in `character-emma.md` §3.2-§3.3 (`rotateZ`, spring physics, transform-origin) is not wired.

What Marian feels today: pose swap is correct (right pose at right time) but flat. What Marian feels after this brief lands: same pose timing, plus a 600ms sideways head tilt with spring physics that reads as "yes" or "hmm" through the body, not just the face.

---

## Audit — what's already wired vs missing

### Already wired on `main`

| Behaviour | Location | Status |
| --- | --- | --- |
| `setPose('idle' \| 'celebration' \| 'puzzled-tilt')` state machine | `src/screens/Math/Math.tsx`, `src/screens/WordSong/WordSong.tsx`, `src/screens/Greet.tsx` | ✅ |
| `AnimatePresence` + `key={pose}` cross-fade on opacity | All four screens above | ✅ |
| `layoutId="emma"` shared-element transition between screens | All character-bearing screens | ✅ |
| Auto-return to idle after celebration / puzzled-tilt holds | Math (line 1152) + WordSong | ✅ (timing matches `POSE_HOLD_MS` values; not actually imported from the module — duplicated as inline literals) |
| `prefers-reduced-motion` branches | All character-bearing screens | ✅ |
| `emmaPose.ts` exports `EmmaPose`, `TILT_BY_POSE`, `POSE_HOLD_MS` | `src/lib/character/emmaPose.ts` | ✅ (module exists, types imported, but tilt/hold values not consumed at runtime) |

### Missing — what this brief is for

| Behaviour | Spec source | Why it matters |
| --- | --- | --- |
| `rotateZ: -6` on celebration with spring `{ stiffness: 260, damping: 20 }` | `character-emma.md` §3.2 + §5.2 | Carries the "yes!" affect through Emma's body, not just the swap-in pose. Without it, the pose change is legible but flat. |
| `rotateZ: +10` on puzzled-tilt with softer spring `{ stiffness: 220, damping: 20 }` | `character-emma.md` §3.3 + §5.2 | Curiosity reads through motion; without it, puzzled is a pose change that doesn't move. |
| `transform-origin: 50% 25%` on the `<m.img>` so head tilts and shoulders stay | `character-emma.md` §3.2 | Biologically natural — without it, the whole image rotates around its centre and the tilt looks like a falling-over animation. |
| Idle breathing scale loop (1.0 → 1.02 → 1.0 over 4s) with `transform-origin: 50% 100%` | `character-emma.md` §3.5 | "Alive, not portrait" — the only thing that signals Marian-is-being-watched between problems. Currently absent; Emma sits still. |
| `attentive-pointing` swap during Math hint state (after 2 wrong) | `character-emma.md` §3.4 | The wand pointing into the problem area is the strongest hint-state affordance. Today the hint plays via TTS + flower-pulse only; Emma sits in idle. |
| `listening` pose during caption reveal | `character-emma.md` §5.1 | Tiny — top eyelid drop + 2° tilt — but signals "I'm paying attention while I read this to you". Currently Emma stays in idle through caption reveals. |

### Deliberately deferred / out-of-scope

- **`cheering`, `waving`** — Session-End uses `emma-cheering.svg` directly; no pose-state machine. Fine for v1; Session-End is a one-shot "you did it" beat, not a stateful screen.
- **Lip-sync mouth animation.** Explicit non-goal per `character-emma.md` §6 — pose swap only, no per-frame mouth motion.
- **Hover/tap micro-animations on Emma.** Emma is not interactive (the Hub long-press is a parent-gate, not a character interaction).
- **Walking / locomotion / scene-change animations.** Emma is always seen sitting/standing static. `layoutId="emma"` handles screen-to-screen morph.

---

## The choreography in detail

### 1. Correct-answer reaction — `idle` → `celebration` → `idle`

**Trigger:** `handleCorrectTap` in Math.tsx:1067 (and WordSong equivalent).

**Sequence:**

```
T+0ms       sparkleInstance.play() + plinkInstance.play()  (already wired)
T+0ms       setPose('celebration')                          (already wired)
T+0ms       <m.img> swaps src to emma-celebration.svg      (already wired via AnimatePresence)
T+0ms       <m.img> animates rotateZ: 0 → -6 with spring   (NEW — this brief)
            { type: 'spring', stiffness: 260, damping: 20 }
T+0..400ms  spring settles to rotateZ: -6                  (NEW)
T+0..600ms  speak(problem.utterances.correct) plays         (already wired)
T+~600ms    speak resolves; setPose('idle')                 (already wired)
            <m.img> swaps src to emma-idle.svg              (already wired)
            rotateZ animates -6 → 0 with same spring        (NEW)
T+~800ms    auto-advance fires (gated on min-dwell + speak) (already wired)
```

**Spring config rationale.** `{ stiffness: 260, damping: 20 }` reads as a small confident bounce — under-damped enough to feel alive, not so under-damped that it overshoots and oscillates. This is also the project's house spring (used on Math ribbon scale-in, line 1490) — keeping the same spring across the app gives Marian a coherent motion vocabulary.

**Why a spring, not a tween.** A 200ms cubic-bezier `easeOut` reads as "the animation finished" — declarative. A spring reads as "the head settled there" — biological. The 8-year-old user reads biological motion as warmth.

**Auto-return-to-idle.** Already wired at Math.tsx:1152 (`setTimeout(... , 0)` after speak resolves). The `rotateZ` animation back to 0 is automatic via Framer Motion's `animate={{ rotateZ: TILT_BY_POSE[pose] }}` driven by the `pose` state — when state flips to `idle`, the animate value flips to 0 and the spring carries it home.

### 2. Wrong-answer reaction — `idle` → `puzzled-tilt` → `idle`

**Trigger:** `handleWrongTap` in Math.tsx:946 (and WordSong equivalent).

**Sequence:**

```
T+0ms       poofInstance.play() + setShakingChip(...)     (already wired)
T+0ms       setPose('puzzled-tilt')                        (already wired)
T+0ms       <m.img> swaps src to emma-puzzled-tilt.svg    (already wired)
T+0ms       <m.img> animates rotateZ: 0 → +10 with        (NEW — this brief)
            softer spring { stiffness: 220, damping: 20 }
T+0..500ms  spring settles to rotateZ: +10                (NEW — slightly slower than celebration)
T+~500ms    speak(problem.utterances.reprompt) plays      (already wired)
T+~1500ms   pose hold elapses; setPose('idle')            (already wired)
            rotateZ animates +10 → 0 with same softer spring (NEW)
```

**Spring config rationale — softer than celebration.** Stiffness 220 vs 260. 18% softer carries "considering" not "excited". On iPad the difference is small but legible — the puzzled tilt arrives with a hair more lag, reads as a thought rather than a reaction.

**Direction discipline.** Celebration tilts LEFT (`rotateZ: -6`); puzzled tilts RIGHT (`rotateZ: +10`). From Emma's upper-left perch on Math/Word Song, Marian reads the two states at a glance from the direction alone — no cognitive parse of the face needed.

**Critical: never `rotateX`, never downward pitch.** Per `character-emma.md` §6.1 and Dave's developmental constraints, downward head tilt with eyes-up is a forbidden body-language composite (reads as judging). Implementation rule: **only animate `rotateZ`, never `rotateX` or `rotateY`**. ESLint-style guardrail: any future PR that adds `rotateX` or `rotateY` to an Emma `<m.img>` should be flagged in code review.

### 3. Hint state — `idle` → `attentive-pointing` → `idle`

**Trigger:** Math hint state, after 2 wrong attempts on the same problem. Today the hint state in Math.tsx fires `hintPlayedRef.current = true` and plays the hint TTS; the flower-pulse is in the math-board choreography. Emma sits in idle through the entire beat — there's no `setPose('attentive-pointing')` call.

**Sequence to wire:**

```
T+0ms       2nd wrong tap detected; hint sequence triggered  (already wired)
T+~500ms    handleWrongTap's puzzled-tilt hold completes      (already wired)
T+~500ms    Hint TTS starts playing                            (already wired)
T+~500ms    setPose('attentive-pointing')                      (NEW — this brief)
            <m.img> swaps src to emma-attentive-pointing.svg   (NEW)
            rotateZ stays at 0 (wand carries direction)        (already in TILT_BY_POSE)
T+~500..N   Hint TTS plays; flower groups pulse                (already wired)
T+N         Hint TTS resolves (variable length); setPose('idle') (NEW — wired to onEnd)
            <m.img> swaps src back to emma-idle.svg            (NEW)
```

**Wiring detail.** `attentive-pointing` is **not** auto-returned via `POSE_HOLD_MS` (the value is `null`). Devon must hook the pose-clear to the hint TTS's `onEnd` resolution — same pattern as the listening pose's onEnd resolution. Failing to clear leaves Emma stuck pointing at thin air after the hint finishes.

**Bundle cost.** Zero — `emma-attentive-pointing.svg` is already shipped at `public/assets/emma-attentive-pointing.svg`. The wand at 45° is in the SVG, no additional motion to wire.

### 4. Listening pose — `idle` → `listening` → `idle`

**Trigger:** Mid-caption reveal (when TTS is reading and the caption ribbon is revealing word-by-word).

**Sequence:**

```
T+0ms      Caption reveal starts; TTS playing       (already wired)
T+0ms      setPose('listening')                     (NEW)
           <m.img> swaps to emma-listening.svg       (NEW)
           rotateZ: +2 (tiny lean toward ribbon)     (NEW)
T+0..N     Caption reveals + TTS plays              (already wired)
T+N        TTS onEnd; setPose('idle')                (NEW)
```

**Caveat — measure first, decide second.** This is the lowest-leverage of the four. Cross-fading SVGs on every caption reveal in Math + WordSong is 16 swaps per session at minimum. If the swap is invisible at iPad framerate (small `rotateZ`, near-identical pose), it may not be worth the per-swap cost. **Recommend Devon ships items 1, 2, 3 first, then evaluates whether listening adds anything.** If Emma in idle through caption reveal already feels alive (because of breathing — see #5), skip this pose entirely.

### 5. Idle breathing — continuous scale loop on the idle pose

**Trigger:** Mounted whenever `pose === 'idle'`.

**Spec:**

```typescript
// On the same <m.img> that renders Emma
animate={{
  rotateZ: TILT_BY_POSE[pose] ?? 0,
  scale: pose === 'idle' ? [1, 1.02, 1] : 1,
}}
transition={{
  rotateZ: { type: 'spring', stiffness: pose === 'puzzled-tilt' ? 220 : 260, damping: 20 },
  scale: pose === 'idle'
    ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0 },
}}
style={{ transformOrigin: '50% 100%' }}  // breathing pivots from feet
```

**Pivot conflict — important.** Tilt wants `transform-origin: 50% 25%` (head pivot). Breathing wants `transform-origin: 50% 100%` (rise from feet). These are mutually exclusive on a single CSS transform-origin.

**Resolution:** ship breathing with `50% 100%` (feet pivot), and let tilt happen around feet too. The visual difference between head-pivot tilt and feet-pivot tilt at ±6° to ±10° is small (< 4 px head displacement at the iPad render size). Verify on a real iPad — if feet-pivot tilt reads as "leaning over" rather than "head tilting", switch tilt to head-pivot during the tilt animation only and skip breathing during non-idle poses (which is fine because non-idle poses are short).

**Reduce-motion.** Breathing collapses to `scale: 1`; tilt collapses to `rotateZ: 0`. Pose swap still happens (different SVG renders), just instant.

---

## Canonical implementation snippet

This is what the `<m.img>` block in Math.tsx (lines 1455-1469) and WordSong.tsx (lines 1209-1218) and Greet.tsx (lines 1184-1206) and Hub.tsx (lines 419-430) becomes after this brief lands. Same shape every screen except for the `data-testid`.

```typescript
import { TILT_BY_POSE } from '@/lib/character/emmaPose'

const TILT_SPRING_BY_POSE: Record<EmmaPose, { stiffness: number; damping: number }> = {
  idle: { stiffness: 260, damping: 20 },
  listening: { stiffness: 260, damping: 20 },
  celebration: { stiffness: 260, damping: 20 },
  'puzzled-tilt': { stiffness: 220, damping: 20 },  // softer — "considering"
  'attentive-pointing': { stiffness: 260, damping: 20 },
  sleepy: { stiffness: 260, damping: 20 },
  cheering: { stiffness: 260, damping: 20 },
  waving: { stiffness: 260, damping: 20 },
}

<AnimatePresence initial={false}>
  <m.img
    layoutId="emma"
    key={pose}
    data-testid="math-emma"  // or screen-specific equivalent
    data-pose={pose}
    src={`/assets/emma-${pose}.svg`}
    alt="Emma"
    draggable={false}
    className="h-[26vh] w-auto select-none"
    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, rotateZ: 0 }}
    animate={{
      opacity: 1,
      rotateZ: reducedMotion ? 0 : TILT_BY_POSE[pose] ?? 0,
      scale: pose === 'idle' && !reducedMotion ? [1, 1.02, 1] : 1,
    }}
    exit={{ opacity: 0, transition: { duration: 0.15 } }}
    transition={{
      opacity: { duration: 0.2 },
      rotateZ: reducedMotion
        ? { duration: 0 }
        : { type: 'spring', ...TILT_SPRING_BY_POSE[pose] },
      scale:
        pose === 'idle' && !reducedMotion
          ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0 },
    }}
    style={{ transformOrigin: '50% 100%' }}
  />
</AnimatePresence>
```

**Devon notes:**

- `TILT_SPRING_BY_POSE` could live in `emmaPose.ts` next to `TILT_BY_POSE`. Recommend: yes, same module.
- The `scale: pose === 'idle' ? [1, 1.02, 1] : 1` keyframe array gives Framer Motion the breathing loop. The `repeat: Infinity` only kicks in for idle.
- Reduce-motion path: rotateZ collapsed to 0, breathing to 1. Pose still reads correctly via the SVG — the SVG carries the tilt visually in `puzzled-tilt`'s artwork (head drawn already tilted) regardless of the runtime rotateZ.
- The `opacity` transition stays at 200ms — that's the existing pose-swap cross-fade; don't change it.

---

## Bundle / motion budget

LazyMotion 4.6 KB iPad budget per `motion` skill — already paid for the existing `<AnimatePresence>` + `<m.img>` shape. This brief adds:

- `rotateZ` per-pose — ~0.05 KB (spring physics already imported as part of the `motion` package's `animations` import)
- `transformOrigin` style — negligible
- `scale` keyframe array for breathing — negligible

**Net add:** < 0.1 KB. Within budget.

---

## Implementation order

Recommend Devon spins out a single follow-up ticket and ships in this order. Each step is independently mergeable.

1. **Add `TILT_SPRING_BY_POSE` to `emmaPose.ts`.** Pure additive change.
2. **Wire celebration tilt + breathing on Math.tsx + WordSong.tsx.** This is items 1 + 5 from the choreography section. Highest-leverage warmth gain.
3. **Test on real iPad.** Verify (a) feet-pivot tilt doesn't read as "leaning over"; (b) breathing scale 1.02 is visible without being distracting. Adjust pivot or scale-amount if needed before continuing.
4. **Wire puzzled-tilt with softer spring.** Item 2.
5. **Wire `attentive-pointing` for Math hint state.** Item 3 — the highest single-feature gain after #2.
6. **Decide whether to wire `listening` pose** based on whether breathing already gives Marian enough "alive". If yes, skip; the design budget is "make her feel alive", and over-animating dilutes the celebration / puzzled beats.
7. **Greet entrance** stays unchanged — the slide-in-from-bottom-left is its own choreography (see Greet.tsx:1193) and shouldn't be entangled with the pose-swap brief above.

---

## Acceptance criteria (testable)

Inherits `character-emma.md` §8 "Functional correctness (animation)" boxes. Devon's PR closes:

- [ ] Correct-chip tap: pose swaps idle → celebration; rotateZ animates 0 → -6 with spring (stiffness 260, damping 20); holds 600ms; rotateZ animates back to 0; pose returns to idle. Verifiable by inspecting `<m.img>` `style.transform` over time in DevTools, or by Playwright snapshot.
- [ ] Wrong-chip tap: pose swaps idle → puzzled-tilt; rotateZ animates 0 → +10 with softer spring (stiffness 220, damping 20); holds 1500ms; returns to idle.
- [ ] Hint state (after 2 wrong on Math): pose swaps to `attentive-pointing` concurrent with flower-group pulse; returns to idle on hint TTS `onEnd`.
- [ ] Idle breathing: `<m.img>` scale animates `[1, 1.02, 1]` over 4s, repeats infinitely while pose is `'idle'`, halts on non-idle poses.
- [ ] All `layoutId="emma"` shared-element transitions still work across screen boundaries (regression check — none of the above should break the layoutId morph).
- [ ] With `prefers-reduced-motion` enabled: pose swap is instant (no cross-fade beyond the 200ms opacity); rotateZ collapses to 0; breathing collapses to scale 1. Pose still reads correctly because the puzzled-tilt SVG is drawn with the tilt baked in.
- [ ] No `rotateX` or `rotateY` introduced anywhere on the Emma `<m.img>` (forbidden per Dave §6.1).

**Anti-dark-pattern check** (Jessica QA gate, inherits from `character-emma.md` §6.2):

- [ ] Puzzled-tilt rotateZ is `+10` only — never combined with downward `rotateX` motion (the disappointed-teacher composite is forbidden).
- [ ] Celebration rotateZ is `-6` — small, warm, not a bouncy 360° spin or a scale-up.
- [ ] No pose introduces a sigh-shaped scale-down on the body (no `scale` value < 1 on Y-axis).

---

## Open questions

1. **Pivot conflict (head-tilt vs feet-breathing) on the same transform-origin.** Recommended resolution above is "feet-pivot wins; verify on iPad". If verification fails, fallback is to switch transform-origin per-pose (head for tilted poses, feet for idle). Devon's call after iPad measurement.
2. **Listening pose ship-or-skip.** Captured above; default is "ship items 1-4 first, then re-evaluate".
3. **Should `POSE_HOLD_MS` values from `emmaPose.ts` actually be consumed?** Today Math.tsx and WordSong.tsx duplicate the 600ms / 1500ms values inline. Devon could refactor to import from the module — pure cleanup, no behaviour change. Recommend yes during the same PR; small enough to bundle without scope creep.

---

## Provenance

- **Bible:** `design/character-emma.md` §3 ("Animation re-mapping") + §5 ("Animation hooks contract") + §6.1 (Dave's body-language constraints).
- **Existing module:** `src/lib/character/emmaPose.ts` (PR #104).
- **Phase 3b implementation PR (already merged):** #104 (commit `861bb0a`, 2026-04-29).
- **Motion patterns reference:** `motion` skill — LazyMotion + spring physics + reduce-motion.
- **iPad rendering reference:** `mobile-app-design` skill — touch-zone safety unaffected (Emma is not interactive on Math/Word Song).
