# Emma — expression sheet catalogue

**Audience:** Devon (impl reference), Jessica (QA), future asset author (vector trace pass).
**Author:** Marian Tutor design persona — Phase 3b dispatch (ticket `86c9kwh66`).
**Status:** Reference catalogue. The 8 SVG slots are filled in `public/assets/`; this file maps each one to its emotional intent, screen mapping, and motion/audio companion.

**Source-of-truth visual deltas:** [`../../character-emma.md`](../../character-emma.md) §2.4 (face close-up) + §2.5 (expression beats table). This file is the screen-mapping cross-reference; the bible is the visual spec.

---

## The 8 slots

All 8 filenames are final and shipped. Devon and Jessica reference these by filename; asset author re-traces under the same names.

| # | Filename | Emotional intent | Screen consumer(s) | Motion companion | Audio companion |
| --- | --- | --- | --- | --- | --- |
| 1 | `emma-idle.svg` | Calm baseline. "I'm here, paying attention." | All character-bearing screens | Idle breathing (4s scale loop, `motion-brief.md` §5) | None |
| 2 | `emma-listening.svg` | "I'm reading this to you and listening to your tap." | Math, Word Song (caption reveal) — wiring deferred per `motion-brief.md` §4 | Tilt: rotateZ +2 (very small lean toward ribbon) | Caption reveal TTS (mid-utterance state) |
| 3 | `emma-celebration.svg` | "Yes, that's right." Warm, not over-the-top. | Math (correct tap), Word Song (correct tap), Greet (on "Hi!" word boundary) | Tilt: rotateZ -6 with spring `{stiffness:200, damping:22}` (softened from 260/20 per iPad feedback, ticket 86c9kxmqb); 600ms hold | `sfx-sparkle.mp3` + `sfx-plink.mp3` + `problem.utterances.correct` TTS |
| 4 | `emma-puzzled-tilt.svg` | "Hmm, let's look at that one again together." Curious, never disappointed. | Math (wrong tap), Word Song (wrong tap) | Tilt: rotateZ +10 with softer spring `{stiffness:220, damping:20}`; 1500ms hold | `sfx-poof.mp3` + `problem.utterances.reprompt` TTS |
| 5 | `emma-attentive-pointing.svg` | "Look here with me." Wand pointing into the problem area. | Math hint state (after 2 wrong) — wiring deferred per `motion-brief.md` §3 | rotateZ 0 (wand carries direction) | Hint TTS (variable length) + flower-group pulse |
| 6 | `emma-sleepy.svg` | "Good session — I'm winding down too." | SessionEnd's `SleepSplash.tsx` | Static (no animation; sleepy is a sticky end-state) | Silent — no TTS on SleepSplash |
| 7 | `emma-cheering.svg` | "You did it!" Big celebration, session-end only. | SessionEnd | Static (pose carries the gesture) | Session-end "all done" TTS |
| 8 | `emma-waving.svg` | "Bye for now." | SessionEnd transition out | Static | Session-end goodbye TTS |

**Plus the wordmark:**

| Filename | Use | Screen |
| --- | --- | --- |
| `emma-logo.svg` | Splash wordmark | `Splash.tsx` (line 101) |

---

## Emotional vocabulary discipline

Each pose is reserved for the emotional beat noted above. Crossing them muddles Marian's read of where she is in the session.

**Reserved-for-Session-End:** `cheering`, `waving`, `sleepy`. Never fire these from Math/Word Song problem reactions — `cheering` would over-reward a single correct answer, `sleepy` would read as "I'm bored of you", `waving` would read as "we're done early". Specifically, `cheering` is "session done well, both arms up"; `celebration` is "this one problem was right". The split is intentional and was lost in the legacy Melody asset set (one `melody-happy.svg` reused for both); Phase 3b restored it.

**Reserved-for-listening:** `listening` is the only pose that fires _during_ a TTS reveal (not after a tap, not before a tap — _during_). If wired (see `motion-brief.md` §4), it returns to idle on TTS `onEnd`. If not wired, idle covers the entire reveal.

**Reserved-for-correct/wrong:** `celebration` and `puzzled-tilt`. Auto-return to idle after their hold windows; never sticky.

**The default:** `idle`. Anywhere a pose isn't explicitly chosen, it's `idle`. This is the breathing-and-watching baseline — the only pose Marian sees most of the session.

---

## Screen-by-screen mapping

### Splash (`src/screens/Splash.tsx`)
- **Pose used:** None (wordmark only via `emma-logo.svg`)
- **Emma not present.** This is the title-card screen.

### Greet (`src/screens/Greet.tsx`)
- **Poses used:** `idle`, `celebration` (briefly, on "Hi!" word boundary)
- **Pose state machine:** `useState<'idle' | 'celebration'>('idle')` — narrower than the full union because Greet doesn't use the wider beats
- **Entrance choreography:** slide-in-from-bottom-left with spring; see Greet.tsx:1193 (independent of pose choreography)
- **Exit:** AnimatePresence cross-fade out as Greet hands off to Hub or content

### Hub (`src/screens/Hub/Hub.tsx`)
- **Poses used:** `idle` only
- **Static pose.** Hub is the front porch — Emma is centred-upper, ~22vh, watching Marian decide. No reactive beats.
- **Long-press parent gate:** the Emma image is the long-press target (3s hold → parent settings). The pose doesn't change during the hold; the affordance is silent (no progress ring on Emma — see Hub.tsx for the long-press wiring).

### Math (`src/screens/Math/Math.tsx`)
- **Poses used:** `idle`, `celebration`, `puzzled-tilt`. (`listening` and `attentive-pointing` are slot-ready but not yet wired.)
- **Pose-swap triggers:** `handleCorrectTap` line 1067, `handleWrongTap` line 946, problem advance line 905
- **Position on screen:** upper-left, ~26vh; ribbon to the right. The wand-direction logic (Emma's wand in LEFT hand, on her LEFT, points naturally DOWN-RIGHT into the problem chips below) is in-SVG, not animated.

### Word Song (`src/screens/WordSong/WordSong.tsx`)
- **Poses used:** Same set as Math
- **Pose-swap triggers:** Same shape as Math; setPose calls at lines 680, 725, 864, etc.
- **Position on screen:** upper-left, ~26vh; ribbon to the right. Identical pattern to Math.

### Session End (`src/screens/SessionEnd/SessionEnd.tsx`)
- **Pose used:** `cheering` only (rendered directly via `src="/assets/emma-cheering.svg"`, no pose state machine on this screen)
- **Centred, ~40vh.** Reserved for the session-complete moment.

### Sleep Splash (`src/screens/SessionEnd/SleepSplash.tsx`)
- **Pose used:** `sleepy` only (rendered directly via `src="/assets/emma-sleepy.svg"`)
- **Centred, ~40vh.** No TTS on this screen — Emma rests, "Come back soon." text card below.

---

## Composition rules across poses (consistency)

The 8 poses must share the same character — Marian must read them as the same person, not a wardrobe-changing model. Per `character-emma.md` §2.3:

- **Hair:** medium-length soft natural waves OR simple low ponytail; warm dark brown (#5C3F31 / `--emma-hair`); single optional small bow on LEFT side, ~16pt, soft pink. The bow is either present in all poses or absent in all poses — pick one and lock.
- **Outfit:** peach cardigan over cream blouse + knee-length mauve-pink skirt OR jeans. Same outfit in every pose. No wardrobe-change between moods.
- **Wand-pointer:** in LEFT hand at her side in `idle`, `listening`, `celebration`, `puzzled-tilt`, `sleepy`. Raised to 45° in `attentive-pointing`. Held loosely or above head in `cheering`. Lowered in `waving`. Always present — wand is not optional.
- **Skin tone:** consistent (`--emma-skin` #F5DCC9 fill, `--emma-skin-shadow` #E8C4A8 single-stop shadow companion).
- **Eye design:** identical eye shape across poses; what changes is the eyelid arc (open in idle/celebration/puzzled, dropped 1pt in listening, fully closed single-arc in sleepy). Iris colour identical (`--emma-eye` #3E2818). Catchlight position identical (upper-right, single cream highlight) — what varies is brightness (1.0× idle, 1.2× celebration, 1.5× cheering).
- **Mouth design:** soft-rose fill (`--emma-mouth` #C77A7A) across all poses. Shape varies per pose per `character-emma.md` §2.4.
- **Pose-to-pose silhouette stability:** Marian should read "same person sat down for ten minutes" not "8 different drawings of someone teacher-shaped". The strongest enforcement of this is to author the 8 poses in a single illustrator session from a single character reference (see `character-emma-ai-prompts.md` §4 — "pick ONE tool and stick with it" is the same rule applied to AI generation).

---

## Anti-pose audit (Jessica QA gate)

Per `character-emma.md` §6.1 (Dave's verbatim forbidden list), Jessica checks every shipped Emma SVG against the following — **none of the 8 poses may match any of these states**:

- Folded or crossed arms
- Head tilted **downward with eyes looking up**
- Pursed or pressed lips
- Slow, deliberate nodding without a smile (motion-only check)
- Hands on hips
- Soft sigh body language (slumped shoulders, scale-down)
- Raised eyebrow combined with downward head tilt (the "I'm disappointed in you" composite)
- Pointing at the viewer (Marian) — Emma's pointing always goes _into_ the scene, never at the camera

The current shipping assets pass this audit per Thomas's 2026-04-29 review (the PR #103 + #107 + #104 chain went through).

---

## What this folder is NOT

- **Not the canonical bible.** That's `character-emma.md`. Read it for proportions, palette, eye/mouth design language, anti-dark-pattern reasoning.
- **Not the AI prompt sheet.** That's `character-emma-ai-prompts.md`. Read it for re-generation directions per pose.
- **Not vector SVG drafts.** The 8 SVGs in `public/assets/emma-*.svg` are the canonical assets (currently as PNG-in-SVG wrappers — see `../asset-fidelity-followup.md`). Authoring a parallel "draft" set in this folder would invite drift.

---

## Provenance

- **Phase 3b implementation PR:** #104 (commit `861bb0a`, 2026-04-29).
- **7-pose initial drop:** PR #103.
- **`emma-sleepy.svg` separate drop:** PR #107.
- **Bible source-of-truth:** `design/character-emma.md` (PR #98).
