# Character — Emma (manhwa/webtoon teacher)

**Audience:** asset author, Devon (impl), Kevin (Phase 3a parallel), Jessica (QA), Thomas (taste).
**Author:** Marian Tutor design persona — Phase 3b visual pivot.
**Status:** Spec — draft. No ticket assigned yet; orchestrator spins one out from this PR.
**Surface:** Replaces `melody-*.svg` character art across every screen. Pure design deliverable; no code changes in this PR.
**Phase 3a (Kevin) ships in parallel:** voice swap (`AnaNeural` → `EmmaMultilingualNeural`), Greet MP3s re-rendered, in-app captions updated, `CACHE_VERSION` bump. **Phase 3b impl waits for 3a to merge.**

Thomas-approved 2026-04-28 ("manhwa/webtoon + teacher sounds awesome"); locked attributes are in memory file `project_character_pivot_emma_2026_04_28.md`. This spec turns those attributes into something the asset author can draw and Devon can swap in.

---

## Goal

Replace the bunny mascot with an original human teacher whose visual identity carries the same warmth as Melody, but who (1) is IP-clean, (2) reads as "teacher / older sister" not "mascot", and (3) phonetically matches the new Emma TTS voice. Tone, session shape, audio-first discipline, anti-dark-pattern rules: all unchanged.

---

## 1. Character bible — Emma

**Identity, one line:** Emma is the calm, observant teacher who shows up for ten minutes a day, never raises her voice, and is genuinely happy to see you.

**Visual age 25–30.** Old enough that "teacher" reads on first look; young enough that "older sister you'd want to spend a Saturday with" reads on second. Marian (8) should feel looked-up-to, never monitored.

**Voice register:** warm, calm, encouraging, never saccharine. Short clear sentences within the 200-word vocab cap. Questions over imperatives ("Try Word Song?" not "Do Word Song."). Acknowledges effort, not performance ("Let's look at this one." not "You got it wrong."). Never apologises _for_ Marian, never apologises _to_ Marian unprompted.

**Voice she is NOT:** chirpy mascot, drill-sergeant, fawning, longing.

**World/backstory (lightweight, never surfaced as in-app copy):** Emma teaches in the small village school the app already implies through "Number Garden" / "Word Song" / "stardust". She uses a wand-pointer because that's how teachers in this school point at slates — not because she's casting spells. No further world-building.

**In-character vs out-of-character (asset-author + Dave reference, NOT a copy deck):**

| In-character        | Out-of-character                  |
| ------------------- | --------------------------------- |
| "Hi! What today?"   | "Hey there, learner!"             |
| "Try Word Song?"    | "You should really do Word Song." |
| "Hmm... try again?" | "That's not right."               |
| "Yes! Five!"        | "GREAT JOB! You're a genius!"     |
| "Bye for now!"      | "Don't leave me!"                 |

The pattern: short, present-tense, declarative or gently interrogative, never emotionally weighted toward Marian's effort. Canonical copy decks live in each screen spec; this section is tone reference only.

**CLAUDE.md principles inherited:** never punish initiative (Emma cuts off if Marian taps before she finishes); no nag loops (one re-prompt then quiet); audio-first text-mirror; never a red X (puzzled is curious, never disappointed).

**Dave-validated 2026-04-28** (ticket `86c9hjnq1`, PR #97 merged). Developmental fit confirmed for warm-but-not-clingy, age-appropriate authority, no parasocial creepiness. Body-language constraints folded into §6.1.

---

## 2. Visual spec

### 2.1 Style anchors

- **Korean manhwa / webtoon, slice-of-life subgenre.** Clean digital lineart (1.5–2 px stroke at iPad render), softer than anime, naturalistic body proportions, expressive emotion peaks at the face.
- **NOT** anime (too sharp), chibi (infantile), institutional uniform (authoritarian), Disney 3D, Pixar facial proportions, shonen, mecha, romance-novel cover.
- **Tonal sibling:** Studio Ghibli's calm-observant-kind warmth.

### 2.2 Palette (extends existing `--my-*` tokens)

The world palette (`--my-rose`, `--my-pink-50`, `--my-cream`, etc.) and all `bg-*.svg` backgrounds stay. Emma is a re-skin of the character only.

New tokens to add to `tailwind.config.js` + `index.css`:

| Token                    | Hex       | Use                                                                                                                                                      |
| ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--emma-skin`            | `#F5DCC9` | Face, hands, neck                                                                                                                                        |
| `--emma-skin-shadow`     | `#E8C4A8` | Cheek/jaw shadow (one-stop, no gradient stack)                                                                                                           |
| `--emma-hair`            | `#5C3F31` | Soft dark brown                                                                                                                                          |
| `--emma-hair-highlight`  | `#8B6650` | Single highlight band on crown                                                                                                                           |
| `--emma-cardigan`        | `#F0CDB8` | Peach cardigan main fill                                                                                                                                 |
| `--emma-cardigan-shadow` | `#D9AC93` | Cardigan shadow side                                                                                                                                     |
| `--emma-skirt`           | `#d1805c` | Warm terracotta skirt — **canonical per shipped render** (was mauve `#C8AAB8` until 2026-06-14; reconciled to shipped per Thomas) (alt: jeans `#9DA8B8`) |
| `--emma-blouse`          | `#FFF6EE` | Cream undershirt                                                                                                                                         |
| `--emma-blush`           | `#F4A8A8` | Cheek blush — celebration pose only                                                                                                                      |
| `--emma-eye`             | `#3E2818` | Iris (warm dark brown — NOT black; black reads anime)                                                                                                    |
| `--emma-mouth`           | `#C77A7A` | Mouth fill (soft rose, NOT bright red)                                                                                                                   |

**SVG-friendly shading rule.** Each colour zone has its base + at most one shadow companion. No multi-stop linear gradients except the optional hair-highlight band. Codebase ships SVG-only per `project_pic_dog_svg.md`; respect that.

### 2.3 Full-body reference (idle pose)

```
viewBox 240 × 360 (full body, scales to 60vh on Greet, ~30vh on Math/Word Song, 22vh on Hub)
viewBox 240 × 240 (head + shoulders + cardigan top + wand tip — for upper-left small renderings)

           ╭───── hair (medium-length, soft natural waves)
           │      parted slightly off-centre
           │      optional small bow on LEFT side, ~16pt, --my-rose
       ┌───┴───┐
       │ round │
       │ face  │  ← face/head ratio ~1:1.1
       │ ◉ ◉   │     large warm eyes (~18% face height each)
       │  ─    │     2-stroke L-nose, no nostrils
       │  ◡    │     small mouth, soft rose, gentle parabola
       └───┬───┘
         neck (~1/4 head-height)
       ┌───┴───────┐
       │ cardigan  │  ← peach over cream blouse, V-collar visible
       │  ✦ wand   │  ← LEFT hand holds wand-pointer (so when Emma
       │  pointer  │     renders upper-left of screen, wand naturally
       │           │     points right INTO problem area)
       └───┬───────┘
         skirt (knee-length, mauve-pink) OR jeans
           │
       ┌───┴───┐
       │ flats │ (cream)
       └───────┘

Proportions: ~6.5 heads (manhwa softening of 8-head adult).
Pivot for breathing/tilt animations: bottom-centre of head bbox (transform-origin: 50% 25%).
```

**Annotations.**

- **Wand in LEFT hand at idle.** Load-bearing — when Emma is upper-left on Math/Word Song, wand points naturally into the problem area. Also makes the `attentive-pointing` pose work (raises wand to 45° toward problem).
- **Bow on LEFT side, optional accessory.** Single, ~16pt, `--my-rose`. Reads as hair tie, not Sanrio ribbon. Use sparingly per Thomas's "overaccessorising drifts back to mascot territory."
- **No glasses, ever.** Thomas-locked 2026-04-28 (Decision 1 = A): bow only. Glasses are not authored in v1 and are not a v2 alt skin — drop entirely. Rationale: glasses read older / more authoritative and over-correct away from older-sister warmth.
- **Modesty + age-appropriate.** Cardigan closed enough that no skin shows below collarbone. Skirt knee-length minimum. No high-heels, no makeup detail, no figure-emphasising silhouette. Hair styled to read soft-natural, not "feminine performance".
- **No bunny ears in any pose, ever.**

### 2.4 Face close-up — emotion legibility

Manhwa carries 90% of emotion at the face. Locked attributes (Thomas):

- **Eye shape:** rounded almond, top lid arcs ~30°, bottom ~10° (top-heavier reads warm, not surprised). Iris fills ~70% of opening, single cream catchlight upper-right (position invariant across expressions). 3 short upper-lash strokes per eye, no lower lashes.
- **Eye spacing:** ~one-eye-width apart.
- **Mouth (per state):** idle = small parabola arc; celebration = open soft "o" + 3 visible upper teeth max; puzzled = **open small "oh"** (per Dave §6 permitted-state, supersedes earlier "closed asymmetric" draft) — narrow oval ~6pt tall × 4pt wide, no teeth visible, soft rose fill; listening = closed narrower than idle; sleepy = closed slight downward parabola (relaxed, not sad).
- **Eyebrows (per state):** idle = relaxed neutral; celebration = slight crinkle-up at outer corners; puzzled = **both** brows raised in curiosity (NOT one-up-asymmetric; NOT raised-with-downward-head-tilt — that composite is forbidden per Dave §6); listening = neutral with optional 1pt inner-end lift (attentive); sleepy = relaxed.
- **Nose:** 2-stroke L-shape, no nostrils, no shading. Same across all expressions.

### 2.5 Expression beats — 6 mandatory + 2 optional

| #         | Filename                      | Use                                                | Visual delta from idle                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Replaces                                                                |
| --------- | ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1         | `emma-idle.svg`               | Default / breathing                                | Baseline. Eyes neutral. Closed-mouth parabola. Wand vertical at L hand.                                                                                                                                                                                                                                                                                                                                                                                                    | `melody-idle.svg`                                                       |
| 2         | `emma-listening.svg`          | Mid-caption-reveal (Marian listening to TTS)       | Top lid drops 1pt; mouth narrower; slight 2° head turn toward viewer.                                                                                                                                                                                                                                                                                                                                                                                                      | NEW (no Melody equivalent)                                              |
| 3         | `emma-celebration.svg`        | Correct-answer reaction                            | Eyes brighter (catchlight 1.2×). Mouth open soft "o" + 3 upper teeth. Cheek blush ~6pt. R hand raised palm-up at shoulder, small "yes!" gesture. Head tilted ~5°.                                                                                                                                                                                                                                                                                                          | `melody-happy.svg`                                                      |
| 4         | `emma-puzzled-tilt.svg`       | Wrong-answer reaction                              | **Both** brows raised ~3pt in curiosity (not one-up-asymmetric). Mouth open small "oh" (~6×4pt oval, no teeth). R hand to chin (loose fist, thumb against jaw). Head tilted **sideways** ~10° (NOT down — downward tilt is forbidden per Dave §6). **Eyes track the problem area, NOT the viewer** (gaze direction set by where the problem renders relative to Emma; on Math/Word Song where Emma sits upper-left, gaze drops 8–12° down-right toward the problem chips). | `melody-puzzled.svg`                                                    |
| 5         | `emma-attentive-pointing.svg` | Hint state (Math/Word Song after 2 wrong)          | Idle face but L wand-pointer raised to ~45° toward right of frame. Eyes tracking wand tip. Slight forward lean.                                                                                                                                                                                                                                                                                                                                                            | NEW — Melody had no equivalent                                          |
| 6         | `emma-sleepy.svg`             | End-of-session / Sleep splash                      | Eyes closed (single arc per eye). Closed-mouth gentle smile. Head tilted ~8° to side, ~10° forward. Wand lowered/held loosely.                                                                                                                                                                                                                                                                                                                                             | `melody-sleepy.svg` (was deferred per `assets-todo.md`; never authored) |
| 7 _(opt)_ | `emma-cheering.svg`           | Session-End big celebration only — NOT per-problem | BOTH hands raised palms-out at shoulder height, mouth fully open soft smile, head straight, catchlight 1.5×.                                                                                                                                                                                                                                                                                                                                                               | `melody-cheering.svg`                                                   |
| 8 _(opt)_ | `emma-waving.svg`             | Session-End "Bye for now!" wave                    | R hand raised to head-height palm-out, fingers spread; mouth gentle smile.                                                                                                                                                                                                                                                                                                                                                                                                 | (Melody re-used `melody-happy.svg` for waves)                           |

**Asset author note on #5.** The wand becomes the literal pointer for Math's hint-state flower-group pulse — strictly stronger than Melody's "sit there in idle" hint posture.

**Three-quarter / side profile views are not shipped in v1.** Author front view at the two viewBoxes only. Use 3/4 sketches as scratch work if it helps your own consistency.

---

## 3. Animation re-mapping

Existing animations were authored for a bunny. Emma needs new motion vocabulary for ear-related beats; everything else stays.

### 3.1 What stays unchanged

Wake-state ready ring; breathing scale loop (1.0 → 1.02 → 1.0, 4s); `layoutId="emma"` shared-element transitions (just the string changes from `"melody"`); `prefers-reduced-motion` branches; `AnimatePresence` cross-fade pose-swap mechanism.

### 3.2 Ear-wiggle on correct → head-tilt-and-smile

**Decision: head-tilt + sparkle particles.** Not raise-hand-and-smile.

**Why head-tilt over hand-raise.** Auto-advance window after correct is 600ms → 1200ms (per `screen-3-math.md`). A new hand-raise gesture needs ~1200ms total to read clearly, which crowds the advance. Head-tilt is a single property animation (rotateZ) layered on the existing pose-swap; near-zero bundle cost. The hand-raise IS in the destination pose (`emma-celebration.svg`'s "yes!" gesture), not as the animation. Sparkle particles (already in `screen-3-math.md` §Stardust) carry the "magical correctness" affordance.

**Devon target:**

```typescript
<AnimatePresence>
  <m.img
    key={pose}
    layoutId="emma"
    src={`/assets/emma-${pose}.svg`}
    alt="Emma"
    initial={{ opacity: 0, rotateZ: 0 }}
    animate={{
      opacity: 1,
      rotateZ: TILT_BY_POSE[pose] ?? 0,
    }}
    exit={{ opacity: 0 }}
    transition={{
      opacity: { duration: prefersReducedMotion ? 0 : 0.2 },
      rotateZ: prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 },
    }}
    style={{ transformOrigin: '50% 25%' }}
  />
</AnimatePresence>
```

`transform-origin: 50% 25%` makes the head tilt while shoulders stay (biologically natural).

Auto-return-to-idle after 600ms (matches Melody's existing ear-wiggle window).

### 3.3 Puzzled-tilt on wrong → sideways head-tilt + hand-on-chin + open "oh"

Aligned with Dave's permitted wrong-answer state per §6: sideways head tilt + open "oh" mouth + brows raised in curiosity + **eyes on the problem, not the viewer**. Same `AnimatePresence` shape as 3.2. Differences from celebration:

- **Direction (sideways, not down):** puzzled `rotateZ: +10` (tilts RIGHT — purely sideways, no Y-axis nod); celebration `rotateZ: -6` (tilts LEFT). Visual contrast lets Marian read the two states at a glance from upper-left. **Critical: do NOT animate any downward head pitch** — `rotateX` stays at 0; downward-tilt-with-upward-gaze is on Dave's forbidden list (reads as judging).
- **Spring softer:** stiffness 220 vs 260. Reads "considering" not "excited".
- **Hand-on-chin is in the SVG, not animated.** Pose swap carries it. Hand reads "thinking", not "tsk-tsk" — loose fist, thumb against jaw, never index-finger-wag.
- **Gaze direction is in the SVG, not animated.** Eyes drawn looking toward problem area (down-right from Emma's upper-left perch). No tap-tracking or viewer-tracking.
- **Hold:** 1500ms (matches Melody's existing puzzled hold per `screen-3-math.md`).

### 3.4 Attentive-pointing during hint state (NEW)

Math's hint state today: Melody sits idle while flower groups pulse + TTS narrates. Emma's wand-pointer makes this stronger.

```typescript
// On 2nd wrong attempt, when math.p{N}.hint plays:
setPose('attentive-pointing')
// Existing flower-pulse choreography from screen-3-math.md runs unchanged.
// Auto-return on hint TTS onEnd (driven by audio, not a fixed timer).
```

`rotateZ: 0` — wand carries direction, no tilt. The wand at 45° in the SVG is static; nothing to suppress under reduce-motion.

### 3.5 Idle breathing — re-author for Emma's frame

Same 4s scale loop applied to Emma. Pivot at `transform-origin: 50% 100%` (so character rises from feet, not centre). 2% scale reads as chest rise on Emma's cardigan silhouette — biologically appropriate.

### 3.6 Splash entrance + Greet entrance — unchanged motion

Splash shows a wordmark, not the character; Phase 3a updates the wordmark to "Emma" via SVG text edit. No animation change. Greet's character-slides-in-from-bottom-left animation stays identical (same spring `{ stiffness: 180, damping: 22 }`, same 900ms hold before ring appears) — different SVG, same motion.

### 3.7 Bundle / motion budget

LazyMotion 4.6 KB iPad budget: not breached. Cross-fade pose swap, breathing loop, `layoutId` transitions all already paid. The only net additions are `rotateZ` per-pose (~0.05 KB) and `transformOrigin` style — negligible.

---

## 4. Asset list

All filenames final. Devon renames per §7; asset author authors content under the new names.

### 4.1 Character SVGs

| Filename                         | viewBox | File-size budget          |
| -------------------------------- | ------- | ------------------------- |
| `emma-idle.svg`                  | 240×360 | 8 KB                      |
| `emma-listening.svg`             | 240×360 | 8 KB                      |
| `emma-celebration.svg`           | 240×360 | 9 KB (+hand+blush detail) |
| `emma-puzzled-tilt.svg`          | 240×360 | 9 KB (+hand-on-chin)      |
| `emma-attentive-pointing.svg`    | 240×360 | 9 KB (+wand at 45°)       |
| `emma-sleepy.svg`                | 240×360 | 8 KB                      |
| `emma-cheering.svg` _(optional)_ | 240×360 | 9 KB                      |
| `emma-waving.svg` _(optional)_   | 240×360 | 8 KB                      |

Budget rationale: Melody SVGs ship at 6 KB; Emma is more complex (human face vs simple bunny) — +2 KB headroom per asset. Run through SVGO with codebase default config.

**Total mandatory bundle: ~51 KB.** With optionals: ~68 KB. Within PWA precache budget.

### 4.2 Wordmark / logo

`emma-logo.svg` — splash wordmark + small heart icon. **Phase 3a (Kevin) is shipping this in parallel.** Likely a one-line text edit on the existing logo SVG; coordinate with Kevin's PR. Don't re-author the heart.

### 4.3 Hub SVG queue (ticket `86c9j53yx`)

`screen-hub.md` §"Assets required" lists **12 distinct SVGs** (1 bg + 1 frame + 2 node visuals + 1 arrow + 7 stage icons), not 19 (the brief miscounts; see Open Q #3). All 12 are world-art / glyph-icons — none are character-art. **The Hub queue is not blocked on Emma's character style** — author in parallel.

| Filename                   | Use                                  | Style                                                  |
| -------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `bg-meadow.svg`            | Hub background                       | Pastel sky + meadow horizon. Style-agnostic.           |
| `node-card-frame.svg`      | Skill-tree node card chrome          | Soft-rounded card outline. Style-agnostic.             |
| `node-flowers.svg`         | Number Garden node signature         | 3 flower glyphs in `--my-rose` family. Style-agnostic. |
| `node-music-notes.svg`     | Word Song node signature             | 3 music notes (♪ ♫ ♬). Style-agnostic.                 |
| `arrow-back.svg`           | Mid-skill back affordance            | 28pt left arrow. Style-agnostic.                       |
| `stage-icon-add.svg`       | Math path-strip "add"                | Small `+`.                                             |
| `stage-icon-subtract.svg`  | Math path-strip "subtract"           | Small `−`.                                             |
| `stage-icon-multiply.svg`  | Math path-strip "multiply"           | Small `×`.                                             |
| `stage-icon-letter.svg`    | Word Song path-strip "letter sounds" | Small `Aa`.                                            |
| `stage-icon-blend.svg`     | Word Song path-strip "blending"      | Small "Ca".                                            |
| `stage-icon-cvc.svg`       | Word Song path-strip "CVC"           | Small "Cat".                                           |
| `stage-icon-checkmark.svg` | Path-strip "mastered"                | 28pt checkmark.                                        |
| `stage-icon-padlock.svg`   | Path-strip "locked"                  | 28pt padlock.                                          |

(13 above — Open Q #3 reconciles against the brief's "12" or "19" framing.)

**Style for the 12/13 Hub icons:** match existing Melody-world icon aesthetic (`star-filled.svg`, `flower-glyph.svg`, `sparkle-particle.svg`) — soft pastels, simple geometry, no shadow stacks. Emma doesn't change that. **Don't author tree-themed alternatives** (Hub spec Open Q #9 option B is deferred to Thomas).

### 4.4 Props

Wand-pointer is **embedded in each Emma pose SVG** — not a separate asset. Position is part of the pose. Open-book alternate prop is **not authored in v1** (locked memory listed it as alternative; we ship the wand).

### 4.5 What's NOT changing

All `bg-*.svg` backgrounds; `sparkle-particle.svg`, `star-filled.svg`, `flower-glyph.svg`, `heart-button.svg`, `icon-finger-tap.svg`; all CVC-word picture SVGs; all `sfx-*.mp3`; all Math/Word Song/Hub TTS audio (Phase 3a covers Greet's "I'm Emma" line).

### 4.6 Asset-author directives

- Original artwork only — no traced/copied geometry from any copyrighted source.
- Hand-authored or vector-tool-generated; no raster-traced output.
- Single `<svg>` root, single viewBox per file. Run through SVGO before shipping.
- No external CSS/font references; no raster textures or `<image>` tags.
- Gradients only on the optional hair-highlight band (single linear, two stops). Everything else flat fill + at most one shadow companion.

---

## 5. Animation hooks contract (Devon)

### 5.1 Pose state machine

Same shape as Math.tsx today (line 263).

```typescript
type EmmaPose =
  | 'idle'
  | 'listening'
  | 'celebration'
  | 'puzzled'
  | 'attentive-pointing'
  | 'sleepy'
  | 'cheering'
  | 'waving' // optional, Session-End only

const [pose, setPose] = useState<EmmaPose>('idle')
```

Per-screen allowed subsets:

| Screen          | Allowed poses                                                             |
| --------------- | ------------------------------------------------------------------------- |
| Splash          | (no character — wordmark only)                                            |
| Greet           | `idle`, `celebration` (on "Hi!" word boundary), `waving` (transition out) |
| Math, Word Song | `idle`, `listening`, `celebration`, `puzzled`, `attentive-pointing`       |
| Hub             | `idle`, `celebration` (first-ever line first-word boundary)               |
| Session-End     | `idle`, `cheering`, `waving`, `sleepy`                                    |

### 5.2 Tilt + hold mappings

Devon imports from a shared `src/lib/character/emmaPose.ts`:

```typescript
export const TILT_BY_POSE: Record<EmmaPose, number> = {
  idle: 0,
  listening: 2, // tiny lean toward ribbon
  celebration: -6, // tilt LEFT
  puzzled: 10, // tilt RIGHT
  'attentive-pointing': 0, // wand carries direction
  sleepy: 8, // gentle forward-and-down
  cheering: 0,
  waving: 0,
}

export const POSE_HOLD_MS: Record<EmmaPose, number | null> = {
  idle: null, // never auto-returns
  listening: null, // returns on audio onEnd
  celebration: 600, // matches existing ear-wiggle window
  puzzled: 1500, // matches existing puzzled hold
  'attentive-pointing': null, // returns on hint TTS onEnd
  sleepy: null, // sticky on Session-End
  cheering: 1200, // "you did it!" line duration
  waving: 1500, // "Bye for now!" line duration
}
```

### 5.3 Canonical pose-swap snippet

Same shape every screen — see §3.2 above. The only per-screen variation is the `data-testid` (per §7.5). `layoutId="emma"` is identical everywhere.

---

## 6. Anti-dark-pattern audit

Per CLAUDE.md non-negotiables, confirmed honoured by Emma:

- [x] **Emma never frowns.** `emma-puzzled-tilt.svg` is curious, not disappointed. Both brows raised in curiosity (not lowered, not asymmetric); mouth open small "oh" (not a frown arc, not pursed); head tilted purely sideways (never downward); eyes on the problem, never on the viewer. Hand-on-chin reads "thinking", not "tsk-tsk".
- [x] **Celebration is warm, not over-the-top.** Eyes brighter (not huge), one hand palm-up (NOT both arms up — that's reserved for Session-End `cheering`). 6° head tilt, not a bouncing scale-up. Reads "yes, that's right" not "OMG AMAZING JOB".
- [x] **Ear-wiggle replacement is not condescending.** Head-tilt-and-smile is age-mirroring (an attentive friend nodding) rather than performance-rewarding.
- [x] **No teacher-authority body language.** No arms-crossed, no finger-wagging, no hand-on-hip, no eye-roll. `rotateZ` capped at 10° (any more reads as exasperated).
- [x] **No "I missed you" / "I'm here for you" lines.** Banned in §1; design-of-character not just copy.
- [x] **No teacher-authority body markers.** No glasses (locked-out per §2.3), no clipboard, no red pen, no chalkboard pose. Wand-pointer reads "this is how teachers in this world point at problems", not "this is the stick I tap your knuckles with."
- [x] **No fake-attention manipulation.** No eye-tracking that follows tap position. No animated mouth lip-sync (same rule as Melody — pose swap only, no per-frame mouth motion).
- [x] **No gendered-performance manipulation.** Cardigan + skirt OR jeans (asset-author choice). No high-heels, no makeup detail, no figure-emphasising silhouette. Hair soft-natural, not "feminine performance". Bow optional, single, small (~16pt).

### 6.1 Dave's body-language checklist (verbatim — load-bearing)

Dave's developmental research at `design/research/character-emma-developmental-fit-86c9hjnq1.md` §Q5 identifies a forbidden list and a permitted wrong-answer state. Both are quoted verbatim below; asset author and QA treat them as binding.

**Forbidden body-language states — Emma must NEVER appear in any of these in any pose, frame, or animation:**

- Folded or crossed arms (dominance / closed-off signal)
- Head tilted **downward with eyes looking up** (evaluative, "I'm judging you" signal)
- Pursed or pressed lips (suppressed disappointment)
- Slow, deliberate nodding without a smile (performative patience — reads as controlled disapproval)
- Hands on hips (authority assertion)
- A soft sigh even without a frown (defeat / disappointment signal)
- Raised eyebrow combined with downward head tilt (the "I'm disappointed in you" composite signal)
- Pointing at the viewer (Marian) — Emma points at the problem, never at the viewer

**Permitted wrong-answer state — Emma's `puzzled-tilt` pose conforms to this exactly:**

- **Sideways** head tilt (never downward)
- Open small "oh" mouth (curious, not pursed, not frowning)
- Brows raised in genuine **curiosity** (not furrowed in concern, not lowered, not the disappointed composite)
- Eyes on **the problem, not the viewer** — the gaze direction is set in-SVG, not animated

### 6.2 Audit checklist (Jessica QA gate)

- [x] `emma-puzzled-tilt.svg` matches §6.1 permitted state on all four points (sideways tilt, open "oh", brows raised, gaze on problem)
- [x] No pose in the asset set matches any §6.1 forbidden state — explicitly verified across all 6 mandatory + 2 optional poses
- [x] `attentive-pointing` wand points at the problem area (down-right from Emma's upper-left perch on Math/Word Song); wand never points at the viewer's gaze line
- [x] `celebration` and `cheering` raised-hand gestures are palm-out / palm-up — never index-finger pointing
- [x] No animation introduces downward head pitch (`rotateX`) — all rotation is `rotateZ` only, capped at ±10°
- [x] No animation introduces a sigh-shaped scale-down on the body (no Y-axis squash)

---

## 7. Migration plan (Devon)

**Order: Phase 3a (Kevin) merges → this spec merges → asset author ships SVGs → Devon impl PR.**

### 7.1 File renames

```
public/assets/melody-idle.svg      → emma-idle.svg              (re-author content)
public/assets/melody-happy.svg     → emma-celebration.svg       (re-author; SEMANTIC rename — see note)
public/assets/melody-puzzled.svg   → emma-puzzled-tilt.svg      (re-author)
public/assets/melody-cheering.svg  → emma-cheering.svg          (re-author)
public/assets/melody-logo.svg      → emma-logo.svg              (Phase 3a likely already renamed; coordinate)

NEW (no Melody equivalent):
emma-listening.svg
emma-attentive-pointing.svg
emma-sleepy.svg
emma-waving.svg                                                 (optional)
```

**Semantic-rename note.** `melody-happy.svg` was reused for both correct-answer reactions AND waves (per `session-1.md`). Splitting into `emma-celebration` (correct) + `emma-waving` (goodbye) cleans this up. Devon: trace every consumer of `melody-happy.svg` and route to the appropriate Emma pose.

### 7.2 Component updates

There is **no `src/components/Melody.tsx`** — Melody is rendered inline in each screen as `<m.img src={\`/assets/melody-${pose}.svg\`}>`. The brief's component-rename framing doesn't apply directly. Devon updates inline templates per file:

| File                                     | Changes                                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/Greet.tsx`                  | `melody-${pose}` → `emma-${pose}`; `alt="Melody"` → `alt="Emma"`; `layoutId="melody"` → `layoutId="emma"`; `data-testid` updates per §7.5 |
| `src/screens/Math/Math.tsx`              | Same; also rename `MelodyPose` type → `EmmaPose` (Math.tsx:263)                                                                           |
| `src/screens/WordSong/WordSong.tsx`      | Same                                                                                                                                      |
| `src/screens/SessionEnd/SessionEnd.tsx`  | Same; `melody-cheering.svg` → `emma-cheering.svg` (line 505)                                                                              |
| `src/screens/SessionEnd/SleepSplash.tsx` | Same                                                                                                                                      |
| `src/screens/Splash.tsx`                 | If references `melody-logo.svg`, update to `emma-logo.svg` (Phase 3a may handle; verify)                                                  |

**Pose-name remap.** Existing `MelodyPose = 'idle' | 'happy' | 'puzzled'`. Migrate to full `EmmaPose` per §5.1. Every existing `setPose('happy')` → `setPose('celebration')`. `setPose('puzzled')` stays. New poses are net-additions — existing call sites don't reference them yet.

### 7.3 New shared module

Devon creates `src/lib/character/emmaPose.ts` exporting `TILT_BY_POSE` + `POSE_HOLD_MS` per §5.2. Each screen imports. (Melody had no equivalent — both were inlined.)

### 7.4 layoutId migration — coordination critical

`layoutId="melody"` is used in **every screen transition** (Greet → Math, Math ↔ Word Song, content ↔ Hub, SessionEnd ↔ Hub). All instances must change to `layoutId="emma"` in **the same commit** — Framer Motion only matches strings exactly; a half-renamed app breaks shared-element transitions. Search-and-replace across `src/`; verify with `grep -r 'layoutId=' src/` showing only `"emma"` after.

### 7.5 Test impact — testid renames

Tests assert specific `data-testid` strings. Find/replace per file:

| File                                         | Old testid           | New testid         |
| -------------------------------------------- | -------------------- | ------------------ |
| `src/screens/Greet.test.tsx`                 | `greet-melody-slot`  | `greet-emma-slot`  |
| `src/screens/Greet.test.tsx`                 | `greet-melody`       | `greet-emma`       |
| `src/screens/Math/Math.test.tsx`             | `math-melody`        | `math-emma`        |
| `src/screens/WordSong/WordSong.test.tsx`     | `word-song-melody`   | `word-song-emma`   |
| `src/screens/SessionEnd/SessionEnd.test.tsx` | `session-end-melody` | `session-end-emma` |

**`alt="Melody"` text:** no test currently asserts via `getByAltText` containing "melody" (verified by grep). One-direction code change.

**Caption text mentioning Melody:** Phase 3a (Kevin) handles all Greet caption updates. Math/Word Song/Hub captions don't reference the character's name (verified). Phase 3b doesn't touch captions.

### 7.6 Cache invalidation

Phase 3a bumps `CACHE_VERSION` 2 → 3 in `src/lib/audio/sessionAudio.ts` (audio cache). Phase 3b's path change (`/assets/melody-*.svg` → `/assets/emma-*.svg`) is itself cache-busting for visuals, but Devon should still bump a visual cache version on the SW precache manifest if one exists in `src/pwa/`. If no equivalent field exists, the path change suffices — add a code comment for future debugging.

### 7.7 Rollback path

Keep the Phase 3b PR in a single commit (or easily-revertible chain) until Marian has played with it for a week. If she rejects Emma visually, revert SVG renames + component string edits (Phase 3a's voice + name changes stay — those are independently graded). If she rejects "Emma" entirely, both phases revert. Mitigation: Thomas pre-screens the asset author's first Emma sketch before commitment to all 6 poses.

---

## 8. Acceptance criteria (Jessica)

**Asset existence:**

- [ ] All 6 mandatory Emma SVGs at `public/assets/emma-{idle,listening,celebration,puzzled-tilt,attentive-pointing,sleepy}.svg`
- [ ] Each ≤ file-size budget per §4.1; passes SVGO default config
- [ ] No `melody-*.svg` files remain in `public/assets/` post-migration
- [ ] `emma-logo.svg` present (Phase 3a or 3b)

**Visual taste check (Thomas-led; Jessica flags):**

- [ ] Reads as manhwa/webtoon teacher — not anime, chibi, Disney 3D
- [ ] Reads as age 25–30
- [ ] Modern casual outfit (cardigan + skirt OR jeans), not institutional uniform
- [ ] Wand-pointer in LEFT hand at idle
- [ ] Hair medium-length, soft natural waves or simple ponytail; brown / dark brown / soft black
- [ ] Palette: warm browns, peach, soft pink, cream — no saturated primaries
- [ ] No bunny ears anywhere

**Functional correctness (animation):**

- [ ] Correct-chip tap: pose swaps idle → celebration with `rotateZ: -6`, holds 600ms, returns to idle
- [ ] Wrong-chip tap: pose swaps idle → puzzled with `rotateZ: +10`, holds 1500ms, returns to idle
- [ ] Hint state (after 2 wrong): pose swaps to `attentive-pointing` concurrent with flower-group pulse, returns to idle on hint TTS onEnd
- [ ] Idle breathing scale loop runs (1.0 → 1.02 → 1.0 over 4s)
- [ ] All `layoutId="emma"` shared-element transitions work across screen boundaries
- [ ] With Reduce Motion: pose-swap direct (no cross-fade), `rotateZ` collapses to 0; pose still reads correctly via SVG alone

**Anti-dark-pattern:**

- [ ] Emma never frowns (puzzled mouth = open small "oh", not arched-down, not pursed)
- [ ] Puzzled-tilt pose conforms to §6.1 permitted state: sideways tilt, open "oh", brows raised in curiosity, gaze on problem not viewer
- [ ] No pose matches any §6.1 forbidden state (folded arms, downward-tilt-with-upward-gaze, pursed lips, hands on hips, slow-nod-without-smile, sigh, raised-brow-with-downward-tilt composite, pointing at viewer)
- [ ] No red colour on any wrong state (CLAUDE.md non-negotiable)
- [ ] No teacher-authority gestures (arms crossed, finger wag, hand-on-hip) in any pose
- [ ] No "I missed you" / "I'm here for you" copy anywhere

**Test suite:**

- [ ] All `*-melody` testids renamed to `*-emma` per §7.5
- [ ] All tests pass on `yarn test`
- [ ] No grep-able `Melody` in `src/` post-migration (case-insensitive; explicit historical comments OK, no live references)

**Cross-cutting:**

- [ ] PWA service-worker precache successfully fetches all new Emma SVGs on first launch post-deploy
- [ ] iPad Safari deployed PWA: Emma renders crisp at every render size — no blur, pixelation, or clipped wand on Math/Word Song upper-left small renderings

---

## 9. Open questions

1. ~~**Pending Dave's input.**~~ **Resolved 2026-04-28 (Dave, ticket `86c9hjnq1`, PR #97 merged):** developmental validation complete. Forbidden + permitted body-language lists incorporated verbatim into §6.1; puzzled-tilt pose realigned in §2.4, §2.5, §3.3 to match Dave's permitted wrong-answer state.

2. ~~**Bow + glasses combo — Thomas taste call.**~~ **Resolved 2026-04-28 (Thomas, Decision 1 = A):** bow only; glasses dropped entirely (not v1, not v2). No further action.

3. **Hub SVG count — 12 or 19?** Brief says "19 SVGs queued under `86c9j53yx`". `screen-hub.md` §"Assets required" lists 12 (1 bg + 1 frame + 2 node visuals + 1 arrow + 7 stage icons; this spec's table shows 13 because checkmark + padlock are listed separately under stage icons). The "19" likely conflates 12 + 7 tree-themed alternatives (Hub spec Open Q #9 option B). **Default in this spec:** author the 12-13. Reconcile count via Matt → Thomas.

4. **Hub idle-decay → sleepy?** Should Emma drift to `sleepy` after long Hub idle (e.g., 90s)? **Default: no.** Hub is the front porch, not the bedroom. Emma stays in idle. v2 follow-up if Thomas wants.

5. **Emma's voice prosody calibration.** Phase 3a's voice swap may surface prosody artefacts the Melody copy didn't. After 3a ships, listen to captured audio on Marian's iPad — propose copy tweaks within the 200-word vocab cap if any line reads odd. **Default:** assume 3a QA covers this; revisit only if her sessions reveal an issue.

6. **Asset author identification.** This spec's "asset author" is unowned in the orchestration model. Per `assets-todo.md` pattern, Thomas (or whoever runs the next asset pass) likely owns it. **Flag for orchestrator:** spin out an Emma-character-asset ticket assigned to Thomas, or to whoever the project's SVG-authoring resource is.

---

## 10. Out of scope

Owned by other tickets / specs:

- **Voice / TTS audio re-render** — Phase 3a (Kevin); CLAUDE.md + `api/_tts.ts` voice swap + Greet MP3s + caption text + cache bump.
- **Hub screen layout / mechanics / parent gate** — `screen-hub.md` (PR #94, ticket `86c9hab6y`).
- **Hub implementation** — ticket `86c9j53ra`; unblocks once Emma assets ship.
- **CVC word picture pack** — `design/word-song-picture-pack.md`.
- **Background re-author** — backgrounds are world-art, don't change with Emma.
- **Parent area v2** — flagged in `screen-hub.md`.
- **Mid-skill back affordance** — `screen-hub.md` §"Mid-skill exit contract"; `arrow-back.svg` icon is character-agnostic.
- **Lip-sync animation on Emma's mouth** — explicit non-goal (same rule as Melody: pose swap only).
- **Walking / locomotion** — Emma is always seen sitting/standing static; no walk cycle in v1.
- **Side-profile / 3-quarter Emma assets** — not used in v1.

---

## 11. Provenance

- **Brief:** Phase 3b dispatch from orchestrator, 2026-04-28.
- **Locked decision source:** memory file `project_character_pivot_emma_2026_04_28.md` (Thomas-approved 2026-04-28).
- **Sibling Phase 3a (Kevin):** voice swap + caption + CLAUDE.md + cache bump. No file overlap.
- **Hub spec dependency:** `design/screen-hub.md` (PR #94).
- **Math/Word Song animation patterns:** `design/screen-3-math.md`, `design/screen-4-word-song.md` — re-mapped above.
- **Greet edge-case patterns:** `design/decisions/greet-edge-cases.md` — "never punish initiative" pattern inherited.
- **Hub research:** `design/research/hub-navigation-research-86c9hab6y.md` (Dave, PR #79).
- **Asset format lock:** memory `project_pic_dog_svg.md` — SVG-only.
- **Diagnostic context:** `build a tutor AI app with investigation and analysis.md` — Marian's L2 + reading-emergent context informs Emma's tone simplicity.

---

**No ticket assigned yet — orchestrator will spin one out from this PR.**

---

## 12. Phase 3b status — what shipped vs what's outstanding

**Update authored 2026-05-01 under ticket `86c9kwh66` (Phase 3b documentation closure).** The ticket below the original spec was issued, implemented, and merged. This footer captures the resulting state for future readers.

### Shipped on `main` 2026-04-29 (PR #104, commit `861bb0a`, ticket `86c9jccp7`)

- All 8 Emma SVG slots filled at `public/assets/emma-{idle,listening,celebration,puzzled-tilt,attentive-pointing,sleepy,cheering,waving}.svg` (PR #103 + PR #107 + commit `0591415`).
- `emma-logo.svg` splash wordmark.
- App code migration per §7: `melody-*` → `emma-*` paths, `alt`, `layoutId`, `data-testid`, pose-name remap (`'happy'` → `'celebration'`, `'puzzled'` → `'puzzled-tilt'`).
- Shared module `src/lib/character/emmaPose.ts` exporting `EmmaPose`, `TILT_BY_POSE`, `POSE_HOLD_MS` per §5.2.
- Legacy `melody-*.svg` assets deleted (commit `af3b0b9`).
- `MELODY_VOICE_CONFIG` → `EMMA_VOICE_CONFIG` rename (commit `95241b6`).

### Outstanding — captured in `design/character/` (this PR)

- **Tilt + breathing animation choreography from §3.2-§3.5 not yet wired.** `TILT_BY_POSE` is exported but no screen consumes it. Captured in `design/character/motion-brief.md`.
- **Asset fidelity gap.** Shipped SVGs are PNG-in-SVG wrappers (~150-220 KB each), 22× over the §4.1 8-9 KB vector-SVG budget. Captured in `design/character/asset-fidelity-followup.md`.
- **Reference-style citations and pose catalogue** (named in the Phase 3b dispatch but never landed as discrete documents). Captured in `design/character/reference-styles.md` + `design/character/expressions/README.md`.

### Stale `CLAUDE.md` line

The project root `CLAUDE.md` includes the line "_Phase 3b (visual pivot to manhwa-style art) is in design via Kyle and will land separately. Until Phase 3b, the character visually remains the bunny — audio + text say "Emma" while visuals still show Melody. This mismatch is temporary and known._" This is **stale** as of 2026-04-29 — the bunny is gone visually. Recommend Matt routes a one-line `CLAUDE.md` edit through Thomas to drop that paragraph. Tracked in `design/character/README.md` §"Outstanding decisions for Thomas".
