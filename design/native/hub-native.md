# Hub: native UX calls

**Scope:** React Native Phase 3, the Hub port (after Session End, before the Map). The reference is the live web Hub in `src/screens/Hub/` (frozen): clay world cards (Redesign R2, direction A "Toy Box", #510) with guidance G1 (Emma names one next action, one card glows, flower slots, sleeping flowers; #516, #517, #519). The rules are in `team/DECISIONS.md` 2026-10-06 "Guidance layer approved; stars are feedback only". Anything not named here behaves as the web Hub does. Conventions follow `design/native/greet-math-native.md`: Fredoka everywhere, the 375×667 / 667×375 phone floor, tablet means a shorter side of 600 pt or more (`isTablet`, `mobile/src/layout/layout.ts`).

**Stale docs:** the Hub sections of `.claude/docs/screens-and-flows.md` (path-strip, PromotionCelebration) and `emma-character-and-animation.md` §§ 6–7 (Hub idle ↔ celebration) describe the Hub before #510. The code is the reference.

## 1. Three compositions

| Form                                 | Composition                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Tablet portrait                      | **W**: the web stage, 1:1 (§ 3)                                            |
| Phone portrait                       | **P**: Emma top centre, bubble under her, cards side by side at the bottom |
| Phone landscape and tablet landscape | **L**: Emma and bubble in a left column, cards side by side on the right   |

**Decision: tablet landscape does not pillarbox.** The web fits its 820×1180 portrait stage into iPad landscape (`hubClay.css` `.hub-stage`, `width: min(…)`). On a 1180×820 iPad that makes the stage 556 pt wide, the caption 20 pt and the cards 256 pt wide, and over half the screen is just the gradient. L gives web-size cards (s = 1) and the web's 30 pt caption on the device Marian uses most.

**Rules for all three:**

- **Cards stay side by side**, same size, the other card never dimmed. This follows "two equal doors" (`team/DECISIONS.md` 2026-10-06, real-art check).
- **A card scales as one picture.** Everything inside it uses the web's card-relative reference px (378×672, `HubPathCard.tsx` + `hubClay.css`) × `s = cardWidth / 378`. There are two exceptions: the map button's hit area is never below 56×56 (its visual stays at 118s), and the title stays ≥ 22 pt (52s at the phone floor s = 0.43 is 22.5 pt). The land-pill numeral (32s, 13.8 pt at the floor) may shrink, like the Math HUD pills.
- **A card needs room outside its box:** 28s above it (crown 18s + bob 10s), 14s on each side (suggested ring) and 14s below (solid shadow). The layouts below reserve that room.
- **No parent-gate corner** (§ 7). The Hub has four visible targets (the two cards and the map button inside each) plus Emma's hidden long-press (§ 4).

## 2. Phone layouts

```
P  portrait (375×667 floor)          L  landscape (667×375 floor)
+------------------------------+     +----------------------------------------------+
|                              |     |  ( Emma 247 )  |   ~~crown~~   ~~crown~~      |
|        (  Emma 204  )        |     |  (          )  |  +---------+  +---------+    |
|        ( idle, warm )        |     |  (          )  |  | Number  |  |  Word   |    |
|        (   light    )        |     |  +----------+  |  | Garden  |  |  Song   |    |
|  +----------^-------------+  |     |  | bubble   |  |  | (big    |  | (big    |    |
|  | bubble, 22 pt, 3-line  |  |     |  | 22 pt,   |  |  | sticker)|  | sticker)|    |
|  | slot, full width       |  |     |  | 3 lines  |  |  | ✿ ✿ ○ ⊙ |  | ✿ ○ ○ ⊙ |    |
|  +------------------------+  |     |  +----------+  |  +---------+  +---------+    |
|   ~~crown~~    ~~crown~~     |     +----------------------------------------------+
|  +-----------+ +-----------+ |       column ≥ 262 pt | cards 166.5 × 296 (s = 0.44)
|  |  Number   | |   Word    | |
|  |  Garden   | |   Song    | |     ⊙ = map button (hit area ≥ 56×56)
|  | (sticker) | | (sticker) | |     ✿ = flower slot (grown / sleeping / empty)
|  | ✿ ✿ ○  ⊙  | | ✿ ○ ○  ⊙  | |
|  +-----------+ +-----------+ |
|   24 pt above the safe btm   |
+------------------------------+
```

**P (phone portrait):**

- Content width `W = safe width − 32`. Card width `cw = (W − 16) / 2`, `s = cw / 378`, card height `672s`. Floor: cw 163.5, s 0.4325, height 290.6.
- **The cards are anchored to the bottom** (thumb zone): the card box bottom sits 24 pt above the safe bottom, and their 14s solid shadow (6 pt) falls inside that margin. The gap between the cards is **16 pt** (not 16s), as for the Math chips.
- **Bubble slot:** full width `W`, 3 lines reserved: 3 × 25.3 (22 pt, line height 1.15) + 2 × 12 vertical padding = **100 pt**, with 16 pt horizontal padding. The slot is reserved from mount, so the cards and Emma never move when a line starts, wraps or ends. The bubble grows down from the slot's top. Measured in Fredoka 600 at 22 pt with the ribbon's 0.4 em word gap: the longest guidance line wraps to 3 lines at the floor's 311 pt inner width.
- **Emma** is square and centred: `E = clamp(120, available, 0.4 × safe height)`. `available` = card top − 28s − 16 − 100 − 12 − (safe top + 8). Floor: E = 204. If the cap leaves room over, split it evenly above Emma and between the bubble and the cards (Greet's rule).
- Emma → bubble gap: 12 pt. The bubble's tail sits in it, pointing up at her (§ 6).

**L (phone landscape):**

- `colMin = 262` (230 pt inner width keeps every guidance line to 3 lines at 22 pt, + 2 × 16 padding).
- `s = min(1, (safe h − 16) / 714, (safe w − colMin − 72) / 756)`. Here 714 = 28 + 672 + 14 (a card and its outside room, × s), 756 = two cards, and 72 = 16 left + 24 column gap + 16 card gap + 16 right. The left card's ring (14s) fits in the 24 pt column gap. Floor: s = 0.4405, cards 166.5 × 296.
- Cards: the right card's box edge is 16 pt from the safe right edge, gap 16 pt, box bottom `8 + 14s` above the safe bottom.
- Column: from safe left + 16 to the left card − 24. Floor: 262 pt. Wider phones give the extra width to the column (example: 844×390 with 47 pt side insets and a 21 pt bottom inset gives s 0.494, column 304).
- Bubble: the full column width, 3-line slot (100 pt), tail on top pointing up.
- Emma: `E = min(1.25 × column, safe h − 16 − 100 − 12)`, centred on the column. She may be wider than the column: her figure fills only the middle 35% of the art (x ≈ 0.33–0.68 of `idle.webp`), and the transparent sides pass under the left card. Floor: E = 247.
- Emma + 12 + bubble slot are centred together vertically in the safe height.

## 3. Tablet layouts

**W (tablet portrait) = the web stage, 1:1.** Stage width `= min(safe w, safe h × 820/1180)`, aspect 820:1180, centred horizontally, top-aligned at the safe top, with `u = stage width / 820`. Every web position is reference px × u: Emma's frame (200, −6, 520×520), the light (250, 40, 420×420), the bubble (26, 120, width 330, padding 14/18, radius 34, Fredoka 600 30u, line height 1.15, tail on the right toward Emma), the cards (x 24 and 418, y 470, 378×672, so s = u). The bubble keeps the web's behaviour: no reserved slot, it grows down from y 120 (nothing sits under it until the cards at 470). The gradient fills the side gutters, as `.hub-clay` does.

**L (tablet landscape)** is the same formula as phone landscape with tablet values: caption **30 pt** (the web's 30u at u = 1), line height 34.5, padding 14/18, so the 3-line slot is **132 pt**; `colMin = 350` (314 pt inner width keeps every line to 3 lines at 30 pt). s is capped at 1, never larger than the web card.

| Tablet landscape (example insets)        | s    | Cards     | Column | Emma |
| ---------------------------------------- | ---- | --------- | ------ | ---- |
| iPad Air 11", 1180×820 (bottom inset 20) | 1.0  | 378 × 672 | 352    | 440  |
| iPad 10.2", 1080×810 (no insets)         | 0.87 | 329 × 585 | 350    | 437  |

Check: the 1180 row's vertical sum is 8 + 28 + 672 + 14 + 8 = 730 ≤ 800, so s = 1 fits; the 1080 row is width-bound.

## 4. Emma on the Hub

- **Pose: `idle`, always**, with the character motion (1.02 breath over 4 s, pivot at her feet). App already passes this (`mobile/src/App.tsx`: `pose={route === 'math' ? mathPose : 'idle'}`).
- **No celebration on the Hub.** Unlock celebrations moved to the map (Emma's Path 9/10, `src/screens/Hub/Hub.tsx:212-214`), so the `PromotionCelebration` overlay and the idle ↔ celebration swap are not ported. There is no sleepy pose either: the web passes `pose="idle"` even when both flowers sleep.
- **Entrance:** when the Hub is the first screen after Splash (a returning launch), Emma **fades in** (opacity 0 → 1, 250 ms ease-out, the web's `.hub-emma-band` entrance). There is no slide-in: that is Greet's once-only arrival, and on a return she is already there. From any other route she springs from her last frame (EmmaStage's layout spring, 220/22). EmmaStage picks `entering` at mount: fade if the first route after Splash is `hub`, else the Greet slide-in.
- **Warm light** (web `.hub-emma-light`): a disc in the Hub's background layer at Emma's frame E, offset (0.096E, 0.088E), size 0.808E, `radial-gradient(circle at 50% 45%, rgba(255,236,190,.85) 0, rgba(255,224,160,.4) 40%, rgba(255,214,140,0) 70%)`. It fades in with the Hub (300 ms), so Emma lands on it when she springs in.
- **Shadow: baked, not filtered.** The web draws `drop-shadow(0 10u 10u rgba(90,50,20,.28)) drop-shadow(0 0 18u rgba(255,210,140,.35))` on her image, which carries Thomas's "soft contact shadow" (`team/DECISIONS.md` 2026-10-06). iOS cannot filter images (RN `filter` supports only `brightness` and `opacity` on iOS), and an alpha-following `shadow*` on a layer that breathes would be redrawn offscreen every frame. Instead, `mobile/scripts/export-assets.mjs` writes **`emma/idle-shadow.webp`**: the idle art's alpha on the same 1024 canvas, drawn twice (1u = 1024/520 ≈ 1.97 px; CSS blur radius r = Gaussian σ r/2):
  - `rgba(90,50,20,.28)`, offset y +20 px, σ 10 px;
  - `rgba(255,210,140,.35)`, no offset, σ 18 px.

  EmmaStage draws it under the pose image, inside the breathing view (so it breathes with her), only while `route === 'hub'`, with a 200 ms fade. One idle silhouette is enough because the Hub is the only screen where her pose never changes.

- **Parent long-press (3 s → `parent-settings`).** EmmaStage has `pointerEvents: 'none'`, so the Hub renders a transparent `Pressable` over Emma's frame: `onLongPress` with `delayLongPress={3000}`, no `onPress`, no visual feedback (it is a hidden gate, as on the web). Draw order in the foreground layer: the long-press target, then the bubble (`pointerEvents: 'none'`), then the cards, so a card wins anywhere they overlap. Tap-and-release does nothing.

## 5. Audio and session

**Decision: no first-tap gate. Emma speaks on mount, on every entry path.** The web waits for a tap on app-open (`needsGesture`) only because iOS WebAudio needs a gesture to unlock; native audio needs no unlock (Phase 0 exit criterion, `team/DECISIONS.md` 2026-10-08). Greet keeps its wake tap (greet-math-native § 1) because the introduction plays once in her life and might play to nobody. A Hub line is guidance that the screen also carries: the card glows and the bubble keeps the line. A tap gate would make her tap once just to hear "Let's grow a flower". So drop `handleFirstTap`, `gestureUnlocked`, the `handleNodePress` pointer-down ordering and the `drainOnGesture` / `unlockIosAudioSession` calls.

- **Lines:** port `pickGuidanceLines` as is: the wake-up line first ("Your flower(s) woke up!"), then one next action, with a 1200 ms gap (`LINE_GAP_MS`). The first line starts at mount. Play them through `createManifestLinePlayer('hub-guide', …)` with the G3 recordings (`@marian/core/emmasPath/guidanceLines`; all 8 `guide-hub-*.mp3` are bundled in `mobile/assets/audio/path/`). A line without a clip walks its caption at 165 wpm (the player contract).
- **Bubble:** it appears on the first word tick. Between two lines it hides and re-enters with the next line (web `showRibbon` + `key={currentLine}`). After the last line it keeps showing that line for the rest of the visit. With no line (rapid remount, nothing to say) there is no bubble, and the P/L slot stays empty sky.
- **Rapid remount (30 s, no lines):** kept, with an in-memory module timestamp in place of `sessionStorage`. Both last as long as the app process, so a cold start greets again.
- **Card tap:** in the press handler, in this order: `cancelActive()` on the guidance player, the suggestion-outcome history write (`recordSuggestionOutcome`), then `onPickTree`. The voice channel would also cut the line when Math's first line starts, but that can be seconds later, and the tap must silence her at once. No SFX on a card tap (web parity).
- **Map tap:** the plink (`sfx-plink`, volume 0.3, one module-level `createSfx` like the web), cancel the line, route to `map` (a placeholder until the Map port).
- **Unmount:** `cancelActive()` + `unload()` on the guidance player.
- **Background → foreground:** the voice channel parks the line and resumes it where it stopped (PR #528). No Hub code, no replay.
- **Audio session:** held, as greet-math-native § 3 says (`doNotMix`). Opening the app onto the Hub pauses other music on the device at Emma's first line.
- **Session prefetch:** on Hub mount, App calls `sessionPrefetcher.prefetch` for the glowing world, with the web's mapping (`hubSessionPrefetch.ts`: `null` → Word Song). The card tap calls `take()`. Until Word Song is ported, only a Number Garden suggestion prefetches. This is what lets Math start without its getting-ready wait after a tap.

## 6. Web → native translations

**Logic is shared, not re-ported.** Move the pure parts of `src/screens/Hub/hubGuidance.ts` (`GUIDANCE_LINES` texts, `pickGuidanceLines`, `suggestWorld`, `flowerWakeFor`, `read/writeFlowerWake`) and `hubSuggestion.ts` into `@marian/core/hub/`, and have the web import them back. That is a refactor, not a web UI change, so the freeze allows it. The Howler player stays in the web file. `buildHubCardModel` is already in core.

| Web                                                                                                                         | Native                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.hub-stage` size container, `--u` = 1/820 of the stage                                                                     | JS numbers: stage `u` (W) and card `s`, from a new `mobile/src/layout/hubLayout.ts` (beside `greetLayout.ts` / `mathLayout.ts`). It replaces the placeholder `hubLayout` in `layout.ts`.                                                                     |
| Card: `role="button"`, `onClick`, Enter/Space, `:focus-visible` ring, `cursor`                                              | `Pressable` `onPress` (fires on release, so sliding off cancels), `accessibilityRole="button"`, labels "Number Garden" / "Word Song" / "Number Garden map". No hover, no focus ring.                                                                         |
| `.is-down`: card +8u, shadow 14u → 6u, 120 ms                                                                               | The **face** moves +8s (`withTiming`, 120 ms) and swaps to the pressed shadow at press-in. The Pressable's box stays still.                                                                                                                                  |
| Map `:active`: +7u, shadow → `0 2u 0`                                                                                       | The same, on the map button's pressed state.                                                                                                                                                                                                                 |
| Suggested bob: `translate 0 → −10u → 0`, 2.2 s ease-in-out, 2 runs                                                          | `withRepeat(withSequence(…), 2)` on the face's `translateY`, from mount. Once per mount; a rotation doesn't restart it.                                                                                                                                      |
| Suggested ring `::after`: inset −14u, `0 0 0 6u #fff3a8, 0 0 36u 14u rgba(255,210,63,.8)`, opacity 1 → .65, 2.2 s, infinite | A transparent View in the face at inset −14s with that `boxShadow` (outset shadows draw outside the box only), and a looping opacity.                                                                                                                        |
| `.hub-glow` box-shadow pulse, 2.4 s                                                                                         | Two stacked glow Views (rest and peak shadow); the peak layer's opacity loops 0 ↔ 1 over 2.4 s. Reanimated can't interpolate a shadow string.                                                                                                                |
| `.hub-spark` (scale .5, opacity .4, 1.8 s, delays 0 / 0.7 s), `.hub-zz` (−6u, opacity .6, 2.4 s)                            | Reanimated loops, same values.                                                                                                                                                                                                                               |
| Wake: bud `scale .6, rotate −10°, opacity .4 → 1`, 0.8 s `cubic-bezier(.34,1.56,.64,1)`, delay 0.5 s                        | `withDelay(500, withTiming(…, { duration: 800, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }))`, once per mount.                                                                                                                                              |
| `linear-gradient` / `radial-gradient`, `box-shadow` (incl. `inset`)                                                         | `experimental_backgroundImage` and `boxShadow` strings, as Math already does; px = reference × s (or × u).                                                                                                                                                   |
| Title `text-shadow` stack                                                                                                   | Three stacked `Text` layers: dark extrusion at +6s, light rim at +2s, the face on top. The bottom layer carries one `textShadow` (0, 10s, radius 10s, `rgba(0,0,0,.25)`). Fredoka 700, 52s, line height 0.98.                                                |
| `filter: saturate(.55) brightness(1.04)` on the "next" sticker                                                              | **Baked**, because iOS can't saturate. `export-assets.mjs` writes a `-muted` copy of every 256 px path image (sharp `modulate({ saturation: 0.55, brightness: 1.04 })`).                                                                                     |
| `filter: drop-shadow` on stickers, lock, buds, map icon                                                                     | iOS: `shadow*` props on a background-less wrapper, which follows the image's alpha. Android: `filter: [{ dropShadow }]` (Android 12+; older versions show none). Values = web × s. Tradeoff: if the bob stutters on an iPad, bake these too.                 |
| Bubble tail `clip-path: polygon`                                                                                            | A react-native-svg triangle in `#fff8ee`. W: right side, pointing at Emma (web 34u × 30u, top 34u). P/L: top centre, pointing up, 28 × 14 pt.                                                                                                                |
| `.hub-bubble` clay slab                                                                                                     | Reuse `CaptionRibbon` with the clay style (Math's `clayRibbon` pattern) and a new `color` prop (`#6b3f1f`). W: the web values × u. P/L: radius 28, `inset 0 3px 0 #fff, 0 6px 0 #e3c6a6, 0 10px 16px rgba(60,30,10,.2)`. The word fade is the shared 150 ms. |
| Moon SVG with radial gradient                                                                                               | react-native-svg, as Splash does.                                                                                                                                                                                                                            |
| `.hub-clay` gutters + `.hub-garden` backdrop                                                                                | One full-screen background View: the `.hub-clay` bands over the whole screen. The 6 garden blobs go at stage coordinates in W, and at the same fractions of the screen (x/820, y/1180) in P and L.                                                           |
| `@media (prefers-reduced-motion)`                                                                                           | `useReducedMotion()`: the glow, spark, zz, wake, bob and ring loops stop (ring at full opacity, buds shown open). Press feedback stays. Emma stops breathing (EmmaStage).                                                                                    |

## 7. Not ported

- **The 96×96 parent-gate corner.** The web's handler is a v1 no-op (`src/App.tsx` `handleHubParentGate`), and on a phone the corner would sit over the bubble or a card. Emma's 3 s long-press is the parent entrance.
- **`PromotionCelebration`** and its idle ↔ celebration swap (retired from the web Hub, § 4).
- **The first-tap gate machinery** (§ 5).
- **`useStorageSync`** (cross-tab `storage` events): one app, one process.
- **Keyboard activation and the focus ring.**

## Acceptance criteria (Jessica, on device)

- [ ] Returning launch (sessionCount ≥ 1): Splash → Hub. Emma fades in with no slide-in, and her first line starts with no tap, `onPlay` ≤ 500 ms after the Hub mounts.
- [ ] For the same Progress doc and day, the native Hub picks the same lines, suggested card and flower-slot states as the web Hub. This is a unit test over the shared core helpers (§ 6).
- [ ] Bubble: hidden until the first word. Between two lines it re-enters with the next line, and after the last line it keeps showing that line. On a return within 30 s: no line and no bubble.
- [ ] A card tap while Emma speaks silences her at once and routes to Number Garden / Word Song. No Hub line is heard on the next screen.
- [ ] Map tap: the plink plays, Emma goes silent, and the route goes to `map`. A card tap plays no SFX.
- [ ] A 3 s press on Emma opens Parent Settings. A tap or a 2 s press on Emma does nothing, and a long press on a card never opens it.
- [ ] Suggested card: the ring breathes, the face bobs twice and then rests. The other card is the same size, not dimmed, and both start a session.
- [ ] A flower earned today shows as a closed bud with moon and z. One day later (`dayOffset` +1), the bud opens once, with "Your flower woke up!". On the next visit it is open, with no wake animation and no wake line.
- [ ] 375×667, portrait and landscape: cards ≥ 163×290 (P) / ≥ 166×296 (L) with a 16 pt gap, map hit areas ≥ 56×56, caption 22 pt, titles ≥ 22 pt, every guidance line in ≤ 3 lines. Nothing is clipped and nothing overlaps the bubble.
- [ ] Tablet portrait matches the web Hub at the same size. Tablet landscape on 1180×820: cards side by side at 378×672, caption 30 pt, no pillarbox.
- [ ] Rotating mid-line: Emma springs to her new frame, the line and caption carry on, and the bob and wake animations don't restart.
- [ ] Reduce Motion on: no bob, ring pulse, glow pulse, sparks, z or wake animation; the ring shows and the buds show open; press feedback still works; Emma doesn't breathe.
- [ ] iOS and Android both show Emma's baked shadow and warm light, and the muted "next" sticker.
- [ ] Number Garden glowing, network up, ≥ 10 s on the Hub: tapping it shows Math without the getting-ready state.
- [ ] Backgrounding the app mid-line and returning: the line resumes where it stopped and is not replayed.

## Open questions

None for Thomas. Thomas checks the PR on his devices, as for every Phase 3 screen (`team/DECISIONS.md` 2026-10-09). Tablet landscape is the one place the native Hub departs from the web. It rearranges approved pieces with no new art or styling, so it gets that same device check rather than a mockup round (bar 12). No Dave consult is needed: no motivation mechanic, line or reward changes. Every line, glow and flower rule is the approved G1 layer, unchanged.
