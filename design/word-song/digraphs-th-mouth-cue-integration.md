# digraphs-th mouth-position cue — integration spec + asset production

**Status:** Implementation-ready. The visual is an **Emma expression asset, MJ-generated** (Thomas's confirmed direction, 2026-05-14 — not a hand-authored SVG, not an abstract mouth diagram): a close-up of Emma's face showing the voiceless-/θ/ mouth shape, tongue-tip lightly between her teeth, manhwa/webtoon style. This spec defines where/when the cue displays, sizing + iPad safe-area, the audio pairing, accessibility, and the MJ prompt + production workflow. A developer (Devon/Kevin) wires the display logic against this spec in a follow-on PR, once Thomas has run the MJ generation and the asset lands at the path below.
**Asset path:** `public/assets/emma-th-mouth.svg` — follows the existing `emma-*.svg` convention (this is an Emma expression asset; it sits alongside `emma-idle.svg`, `emma-celebration.svg`, etc.). It is a **PNG-in-SVG embed** — the MJ render → `remove.bg` → base64-embedded into an SVG wrapper, exactly the technique the rest of the `emma-*.svg` family and the picture pack use. See §"Asset production" for the workflow.
**Authority:** `design/research/digraph-th-addendum.md` (Dave, 2026-05-14) — Recommendation 4 / §5b / §1d: the mouth-at-teeth visual is a **mandatory** element of the th introduction for Marian, not an enhancement (/θ/ has no L1 reference for a Tagalog-L1 learner; the /θ/→/t/ substitution is structural; Emma's TTS alone will not create a reliable /θ/ percept). Dave §5b: a *static* illustration is sufficient — it "does not need to be animated." The MJ render is a single static image; no animation in scope.
**Companion specs:** `design/word-song/digraphs-th-word-list.md` (§5 — the articulation scaffold gate; §6 planner constraint 4; §7 Q1 — the placement/scope question this spec answers), `design/word-song/digraphs-th-picture-pack-prompts.md` (finding 10 — flags the mouth cue as a 4th asset class outside the picture pack).
**Out of scope:** the 7 target-word pictures + 3 distractor pictures (picture-pack spec owns those); the planner/canon/wordPack wiring (Kevin); Emma's spoken opener text (word-list spec §4 owns the script — this spec only defines how the visual *pairs* with it).

---

## Goal

When Marian meets the voiceless-`th` tier, she sees Emma's face *showing her where the tongue goes* for the /θ/ sound — tongue-tip lightly between the teeth — at the same moment Emma says "th". It reads as Emma demonstrating the sound, not a diagram. This gives Marian the articulation anchor her Tagalog L1 cannot supply, so Emma's audio alone does not have to carry the new sound.

---

## User state entering this screen

The mouth cue surfaces inside **WordSong** (`route === 'literacy'`), on `digraphs-th-voiceless`-focus sessions. Two distinct moments, both already-established WordSong patterns the cue extends — it does **not** add a new screen or route.

- **First-encounter (lifetime-once):** Marian has just arrived in the th tier for the first time. She has completed the sh tier and the ch tier; the "two letters, one sound" concept is consolidated (it is **not** re-taught). What is new is the *articulation*. She hears Emma's first-encounter opener line and, per this spec, sees the Emma-mouth cue beside Emma's full-body pose during it.
- **Per-session reminder + persistent corner cue:** on every th-introduction session (while `digraphs-th-voiceless.state` is `intro` or `practicing`), a small persistent corner cue carries the `th` + Emma-mouth image for the whole session, exactly the way the word-list spec §6 constraint 4 describes the sh/ch digraph cue — except the th cue's picture is the **Emma-mouth image**, not a keyword picture. The cue is suppressed once the node flips to `mastered`.

---

## Visual layout

Two placements, one shared asset (`emma-th-mouth.svg`). Both are additive to the existing WordSong layout (`src/screens/WordSong/WordSong.tsx`) — no existing element moves.

### Placement A — first-encounter intro panel (lifetime-once, the load-bearing moment)

During the first-encounter opener line only, the Emma-mouth cue appears as a **panel beside Emma**, in the Emma + ribbon row (the flex row that today holds `word-song-emma` + `word-song-ribbon`). It sits between Emma and the ribbon, or below the ribbon on the same row — sized large enough to be the thing Marian looks at while Emma talks.

```
 ┌──────────────────────────────────────────────────────────┐
 │  [HUD: back · stardust · dots · streak]                   │  h-14, untouched
 ├──────────────────────────────────────────────────────────┤
 │                                                           │
 │   ╭───────╮     ╭────────────────╮   ╭───────────────╮    │
 │   │ Emma  │     │ emma-th-mouth  │   │  ribbon       │    │
 │   │ idle  │     │  Emma's face,  │   │  "th says a   │    │
 │   │ 26vh  │     │ tongue between │   │   special     │    │
 │   ╰───────╯     │  teeth + blow  │   │   sound..."   │    │
 │                 │   ~22vh sq.    │   ╰───────────────╯    │
 │                 │  "th" label    │                       │
 │                 ╰────────────────╯                       │
 │                                                           │
 │           (problem area held off-DOM during intro)        │
 └──────────────────────────────────────────────────────────┘
```

- **Size:** ~22vh square (`min(22vh, 40vw)` so it never crowds Emma's 26vh full-body pose on a narrow portrait width). The asset's `viewBox 0 0 200 200` wrapper scales cleanly to any box.
- **"th" label:** the consuming component renders the text `th` directly under the cue, in the WordSong display font (`font-display`, ~`text-3xl`, `text-ink`). The label is **not** baked into the asset (audio-first / text-mirror principle — text mirrors what Emma says, composed by the screen). Label is decorative-but-mirroring: `aria-hidden` on the text node; the asset's own `aria-label` carries the meaning for AT.
- **Thumb zone / safe area:** the intro panel is a passive display element — **no tap target**. It sits in the upper-mid band, well clear of the thumb-reachable lower third where chips live. It must stay inside the iPad portrait layout viewport (`1024×1366`); at `min(22vh,40vw)` beside a 26vh Emma and the ribbon it fits the row with margin. No element in this row is interactive during the intro, so there is no 44pt-target concern here.

### Placement B — persistent corner cue (whole th-session, while intro/practicing)

For the rest of every th-introduction session, the Emma-mouth cue shrinks to a small **corner cue** — the sh/ch tier's "small persistent visual cue in the screen corner" mechanism, with the Emma-mouth image as its picture.

```
 ┌──────────────────────────────────────────────────────────┐
 │  [HUD: back · stardust · dots · streak]      ╭─────────╮  │
 │                                              │ th  ◖◗  │  │  corner cue
 │                                              ╰─────────╯  │  ~64×88pt
 │              ╭───────╮   ╭──────────────╮                 │
 │              │ Emma  │   │  ribbon      │                 │
 │  ...         word card + letters + 3 chips ...            │
 └──────────────────────────────────────────────────────────┘
```

- **Position:** top-right, below the HUD strip (`word-song-hud` is `h-14`). Anchored `absolute`, `top` just under the HUD, `right` with ~12pt inset. Top-right is the corner the word-list spec's sh/ch cue convention uses and is the corner **furthest from** the thumb-reachable primary actions (chips, back-arrow).
- **Size:** ~64pt wide × ~88pt tall — a ~56pt image square + the `th` label beneath it. Small enough to be ambient, large enough that the tongue-between-teeth relationship still reads. **This is the size-legibility risk for an MJ Emma-face render** — see §"Asset production" → the MJ asset must be composed as a *tight crop on the mouth* (not a full face shrunk small) so the tongue detail survives at ~56pt.
- **Not a tap target.** Purely a reference cue. Because it is non-interactive, the 44pt minimum-touch-target rule does not apply; it must, however, **not overlap** any live target — the HUD's top-right today ends at the streak indicator, and the parent-gate corner long-press lives on the *Hub*, not WordSong, so the top-right of WordSong is free. Verify at integration time that the corner cue's box does not cover `word-song-streak`.
- **Safe area:** keep the cue inside the layout viewport with a ≥12pt inset from the right edge so it clears any iPad rounded-corner / status-area intrusion in standalone PWA mode.

### Asset content requirements

The final asset must satisfy these — they are what makes the cue *teach* (the MJ prompt in §"Asset production" is written to hit them):

- **The load-bearing element is the tongue tip lightly between Emma's upper and lower front teeth.** It must read unambiguously as "between" — not a smile, not a closed mouth, not a tongue that is merely *visible*. This is the one thing the asset exists to show; it is also the highest MJ-drift risk (see §"Asset production").
- **Emma's front teeth are visible** — at least upper and lower front teeth, so "between the teeth" has a referent.
- **Calm, warm expression** — Emma is gently demonstrating, not pulling a face. Friendly, not clinical; this is for an 8-year-old.
- **On-brand Emma** — same manhwa/webtoon style, same character, as the existing `emma-*.svg` family. The MJ prompt uses Omni Reference at strength ~100 to lock her look (see §"Asset production").
- **No text in the asset** — the `th` label is composed by the consuming component (audio-first / text-mirror principle).
- **Tight square crop on the mouth region** — must crop/scale cleanly into both a ~22vh intro panel and a ~56pt corner square without losing the tongue detail. Final wrapper is `viewBox 0 0 200 200` to match the `emma-*.svg` / picture-pack envelope.
- **Transparent background after `remove.bg`** — MJ output always has a background; the embedded PNG must be the background-removed cut so the cue reads on WordSong's cream wash.

---

## Copy / TTS script

This spec does **not** author Emma's lines — `digraphs-th-word-list.md` §4 owns the th opener script. This section defines only the **timing pairing** between the existing opener audio and the visual.

- **The pairing requirement (from Dave, §5b):** the mouth cue "must appear simultaneously with Emma saying 'th'." Implementation: the intro panel (Placement A) must be **mounted and fully visible before the first-encounter opener utterance begins playing** — not faded in mid-line. The simplest correct wiring is: render the intro panel as part of the intro-phase layout, then start the opener audio. Do not gate the panel's appearance on a `boundary` event for the word "th" — that is fragile (pre-recorded / Path-A boundary timing varies) and Dave's bar is "simultaneous", which "already on screen when the line starts" satisfies.
- **Within the word-list §4 opener**, the line that names the articulation (the "tongue between your teeth and blow" clause) is the one the cue illustrates. The whole panel stays up for the entire opener; it does not need to sync to that specific clause.
- **Corner cue (Placement B)** has no audio of its own — it is silent ambient reference for the rest of the session.
- **No th-specific SFX.** The cue is visual only; it rides on the existing opener audio.

---

## Motion

House motion vocabulary — spring physics, nothing sharp. Reduce-motion path collapses every spring to a short opacity fade (consistent with `MotionConfig reducedMotion="user"` at the App root and the `usePrefersReducedMotion` hook the WordSong screen already reads as `reducedMotion`).

### Placement A — intro panel

- **Trigger:** intro phase mounts (first-encounter only).
- **In:** `opacity 0 → 1`, `scale 0.9 → 1`. Spring `stiffness: 260, damping: 20` (the WordSong house spring — same config the `word-song-ribbon` uses, so the panel and the ribbon arrive with one coherent motion). Duration ~300 ms to settle.
- **Hold:** static for the duration of the opener. No looping/pulsing animation — the asset is a single static MJ render; do not animate it (an infinite-repeat pulse would read as "frantic" and pull focus from Emma's voice).
- **Out:** `opacity 1 → 0` over 200 ms as the screen transitions from the intro phase to the first problem (the problem area mounting is the existing `audioReady !== false` gate — the panel unmounts as that gate opens).
- **Reduce-motion:** `opacity 0 → 1` only, `duration: 0.2`, no scale.

### Placement B — corner cue

- **Trigger:** present for the whole th-session whenever `digraphs-th-voiceless.state` is `intro`/`practicing`.
- **In:** `opacity 0 → 1` over 200 ms on session mount. No scale, no spring — it is ambient chrome, it should not draw the eye when it appears.
- **Hold:** completely static. No pulse, no breathing, no motion of any kind.
- **Out:** none within a session — it persists until the screen unmounts.
- **Reduce-motion:** identical (the 200 ms opacity fade is not vestibular motion).

---

## States

- **Idle (th-session, post-intro):** corner cue (Placement B) visible top-right, static. Intro panel absent.
- **First-visit (lifetime-once first-encounter):** intro panel (Placement A) visible beside Emma during the opener; corner cue also present (it is a whole-session element). When the opener ends and the first problem mounts, the intro panel fades out; the corner cue remains.
- **Return-user, still in th tier (`intro`/`practicing`):** no intro panel (first-encounter already spent); corner cue (Placement B) present for the whole session. This is the per-session reminder the word-list spec §5 describes.
- **th tier mastered (`digraphs-th-voiceless.state === 'mastered'`):** neither placement renders. The cue is suppressed once the node flips to mastered — same as the sh/ch cue lifecycle.
- **Non-th session (any other focus node):** neither placement renders. The asset is th-tier-only.
- **Happy path / error path (correct / wrong chip tap):** the mouth cue is **inert** to answer outcomes. It does not react to a correct or a wrong tap — it is reference material, not feedback. "Never a red X" is unaffected: Emma still owns the correct/puzzled reaction; the corner cue just sits there. Do **not** wire the cue to pose state or to `problemState`.
- **Transition in:** see Motion → Placement A "In" / Placement B "In".
- **Transition out:** intro panel fades on intro→first-problem; corner cue unmounts with the screen.
- **Audio-not-ready window (`audioReady === false`):** the corner cue (Placement B) may render immediately — it has no audio dependency. The intro panel (Placement A) should appear with the intro layout; if the opener audio is still being fetched, the panel still shows (Marian sees the cue while the line is fetched, mirroring how the screen already keeps Emma's chrome mounted during the fetch gate). The panel must not be held off-DOM behind the `audioReady` gate — only the *problem area* is gated, per the existing comment in `WordSong.tsx`.

---

## Assets required

| Asset | Status | Notes |
|---|---|---|
| `public/assets/emma-th-mouth.svg` | **MJ-generated by Thomas, then `remove.bg`, then embedded.** Not yet produced — see §"Asset production". | An Emma expression asset (PNG-in-SVG embed), following the `emma-*.svg` naming + technique. Single shared asset for both placements — Placement A renders it large, Placement B renders it small. `viewBox 0 0 200 200` wrapper. |
| `th` text label | Composed by the consuming component. | Not an asset — rendered text in `font-display`, per the audio-first / text-mirror principle. `aria-hidden` (the asset carries the accessible label). |
| Emma poses | **Reuse.** | Emma's full-body pose stays `idle` during the th intro. The mouth cue is explicitly **not** an Emma *pose* — even though it depicts Emma's face, it is a static reference image, NOT added to the `EmmaPose` union and NOT resolved by `EmmaCharacter`'s `/assets/emma-${pose}.svg` pipeline. The consuming component references `emma-th-mouth.svg` by path directly. (Naming note: it uses the `emma-` prefix because it is an Emma-likeness asset and belongs visually with that family, but it is a plain `<img>`/`<image>` reference, not a pose-state.) |
| Backgrounds | **Reuse.** | WordSong's existing cream wash. The embedded PNG is background-removed so the cue reads on the cream ground. |
| SFX | **None.** | Visual-only cue. |

**Precache:** `public/assets/` SVGs are already covered by the Vite PWA `globPatterns` (`svg` is in the precache glob) — no `vite.config.ts` change is needed. The PNG-in-SVG embed will be ~50–250 KB (same order as the `emma-*.svg` family / picture pack), far under `maximumFileSizeToCacheInBytes` (8 MiB).

---

## Asset production — MJ Emma-face render (Thomas operates)

Thomas's confirmed direction: the cue is **Emma's face showing the voiceless-/θ/ mouth position, MJ/manhwa style**. Thomas runs the MJ Web workflow; this section gives him the one paste-ready prompt and the discrete production steps. **Do not hand the full step list as one block — this is one prompt, one 4-grid review, then the post-processing.**

### The MJ prompt (paste-ready, one prompt)

This is an Emma **character** asset, so it uses **Omni Reference at strength ~100** to match her existing look (per the `feedback_mj_omni_reference_strength_dial` memory: 100 to match existing Emma character assets). Set the 1:1 ratio in the MJ Web GUI dropdown — **no** `--v 6 --style raw --s --ar` parameters. No IP names. Style negatives only — **no** pack-wide `--no` block.

```
Soft pastel children's-book illustration, clean line art, warm friendly young woman teacher, close-up of her face, mouth gently open showing tongue tip lightly between upper and lower front teeth, calm encouraging expression. --no photorealistic, 3d render, text, watermark, wide smile, closed mouth, sharp teeth, scary expression
```

- Body: ~33 words (under the ≤40-word ceiling). `--no` list: 8 entries (under the ≤12 ceiling), style/safety negatives only.
- **Omni Reference:** attach Emma's canonical reference (e.g. `emma-idle` transparent source) at strength **~100** in the MJ Web GUI, so the generated face IS Emma, not a generic teacher. Without it the prompt will produce an on-style but off-character face.
- **The load-bearing 4-grid check:** on every 4-grid, the question is **"is the tongue tip clearly BETWEEN the upper and lower teeth?"** MJ drifts hard here — it tends to "pretty up" an open mouth into a smile, a closed mouth, or a tongue that is merely visible at the lip rather than *between the teeth*. If none of the 4 nail the tongue-between-teeth position, **regenerate — do not pick the least-bad.** This is the single highest-drift element of the whole th asset effort; budget for several iterations.
- **Composition note for the operator:** favour a grid result that is a **fairly tight crop on the lower face / mouth region** (not a wide full-portrait). The asset is shown as small as ~56pt in the corner cue (Placement B) — a wide portrait shrunk that small loses the tongue detail entirely. A tight mouth-region crop survives the shrink. If the strongest tongue-position result is a wide portrait, it can be cropped tighter in post before the `remove.bg` step.

### Production steps (after a 4-grid result is chosen)

1. **Upscale** the chosen image (U1–U4 in MJ Web).
2. **Download** the upscaled PNG (≥1024×1024).
3. **Crop** (if needed) to a tight square on the mouth region per the composition note above.
4. **Background removal — discrete, mandatory step.** MJ output **always** has a background. Drop the PNG into `bgclear.ai` (canonical per `removebg-tool-evaluation-2026-05-14.md`; fallback `remove.bg`) → transparent PNG. Verify a clean edge (no halo / fringe on the line art). **Never skip or assume MJ output is transparent.**
5. **Save** the transparent PNG into the Emma source tree at `design/references/character-emma/transparent/emma-th-mouth.png` (the `emma-*` transparent-cuts tier — committed to git, per the Emma-asset policy in `.claude/docs/emma-character-and-animation.md` §3a).
6. **Embed** the transparent PNG as base64 into the SVG wrapper at `public/assets/emma-th-mouth.svg` — the same PNG-in-SVG technique as the rest of the `emma-*.svg` family (`viewBox 0 0 200 200`, single `<image href="data:image/png;base64,...">`, plus the file-header comment block matching the `emma-idle.svg` style). This embed step is small and can be done by Devon as part of the wiring PR, or by Thomas after step 5 — whichever the orchestrator routes.

### Handoff

Once `public/assets/emma-th-mouth.svg` exists, the wiring PR (Devon/Kevin) implements Placements A + B against this spec's "Visual layout", "Motion", "States", and "Acceptance criteria" sections. The MJ generation (steps 1–4) is Thomas-only; steps 5–6 and the wiring are dev work.

---

## Acceptance criteria

Testable, checkbox-style — Jessica's spec targets these. (Per `feedback_progression_e2e_mandatory`, anything touching the th-tier progression flow pairs with a Jessica E2E spec; this cue is display-only and does not touch `mastery.ts` / `focusNode.ts`, but the `digraphs-th-voiceless.state` gating below is still worth an E2E assertion.)

### Asset

- [ ] `public/assets/emma-th-mouth.svg` exists, is a valid SVG with `viewBox="0 0 200 200"` and a non-empty `aria-label`, and embeds a background-removed PNG (no opaque background rectangle).
- [ ] The embedded image reads as **Emma** (on-character, via Omni Reference ~100), with her tongue tip clearly **between** her upper and lower front teeth — not a smile, not a closed mouth.
- [ ] The transparent source PNG is committed at `design/references/character-emma/transparent/emma-th-mouth.png`.

### Display — Placement A (intro panel)

- [ ] On a **first-encounter** th-tier session, an intro panel rendering `emma-th-mouth.svg` is in the DOM and visible **before** the first-encounter opener utterance starts playing.
- [ ] The intro panel is **not** held behind the `audioReady !== false` gate — it renders with the intro layout even while the opener audio is in flight.
- [ ] The intro panel unmounts (or is `opacity 0`) once the first problem's word card mounts.

### Display — Placement B (corner cue)

- [ ] On **every** th-tier session where `digraphs-th-voiceless.state` is `intro` or `practicing`, a corner cue rendering `emma-th-mouth.svg` is present top-right, below the HUD strip, for the whole session (including after the intro panel is gone).
- [ ] On a session where `digraphs-th-voiceless.state === 'mastered'`, **neither** placement renders.
- [ ] On a non-th-tier session (any other focus node), **neither** placement renders.
- [ ] The corner cue's bounding box is inside the iPad portrait layout viewport (`1024×1366`) with a ≥12pt right-edge inset, and does **not** overlap `word-song-streak` or any other interactive element. (Use `IPAD_PORTRAIT_VIEWPORT` per `testing-and-ci.md §4.0`.)
- [ ] At the corner-cue size (~56pt image square), the tongue-between-teeth relationship is still legible (not just a pink blob) — visual check on the chosen MJ crop.

### Behaviour / accessibility

- [ ] Neither placement is a tap target — `pointer-events` do not block anything behind them, and tapping the cue does nothing.
- [ ] The cue does **not** react to a correct or a wrong chip tap (it is inert to `problemState` / pose).
- [ ] Under iPad "Reduce Motion", both placements appear via a plain opacity fade — no scale, no spring, no pulse.
- [ ] The `th` text label is rendered by the component (not baked into the asset) and is `aria-hidden`; the asset's `aria-label` carries the meaning for AT.
- [ ] The asset is referenced by direct path, **not** added to the `EmmaPose` union or the `EmmaCharacter` pose pipeline.

---

## Open questions

Flag for Thomas (via Matt) — none are blockers for the wiring PR, but worth a quick taste call:

1. **Corner-cue exact position vs. the HUD streak indicator.** This spec places the corner cue top-right below the HUD. The HUD's top-right today holds `word-song-streak`. The cue sits *below* the HUD strip so they don't collide — but on a th-session with a hot streak, the streak indicator and the cue are vertically stacked in the same corner. If Thomas finds that crowded on a real iPad, the fallback is top-**left** below the HUD (the back-arrow is `h-14` HUD-level, so the left corner below it is also free). Top-right is the word-list spec's stated sh/ch convention, so I've kept it; flagging in case the streak-stack reads busy.
2. **Does the corner cue stay for the *whole* practicing band, or only the first N sessions?** The word-list spec §6 constraint 4 says the cue persists while `state` is `intro`/`practicing` — which could be many sessions. That matches the sh/ch convention and Dave's "per-session reminder while practicing" framing, so this spec follows it. But if Thomas wants the cue to retire earlier (e.g. once Marian is reliably above some accuracy bar within `practicing`), that is a planner/progress-gating decision beyond this display spec — would need its own ticket. Default: follow the spec'd `intro`/`practicing` gate.
3. **Corner-cue legibility is the MJ-render risk to watch.** An MJ Emma-*face* render shrunk to ~56pt is the one place this approach is fragile (vs. an abstract diagram, which shrinks more forgivingly). The §"Asset production" composition note (favour a tight mouth-region crop) is the mitigation, and the corner-cue legibility AC pins it — but if the chosen MJ result still loses the tongue detail at ~56pt, the fallback within Thomas's confirmed direction is to make the corner cue slightly larger (e.g. ~72pt) rather than abandon the Emma-face approach. Flagging so the wiring-PR dev knows the corner size has a little give if legibility testing demands it.
