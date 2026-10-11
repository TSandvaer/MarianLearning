# Map (Emma's Path): native UX calls

**Scope:** React Native Phase 3, the Map port (after the Hub, before Word Song). The reference is the live web Map in `src/screens/Map/` (frozen): the clay map (R3, #509), Emma's head-and-shoulders badge and the iPad-landscape fit (#522), and the unlock beat (Emma's Path 9/10, #504). The logic is already in core (`@marian/core/map/*`: `buildMapModel`, `layoutMap`, `landscapeScale`, `openLine` / `stopLine` / `gateLine`, `unlockTimeline`, `persistUnlockCelebrated`). The audio is already in `mobile/src/audio` (`createPathLinePlayer`, `createSfx`), and every map line and SFX is bundled. Anything not named here behaves as the web Map does. Conventions follow `design/native/hub-native.md` and `greet-math-native.md`: Fredoka, the 375×667 / 667×375 phone floor, and "tablet" means a shorter side of 600 pt or more.

**Stale docs:** `.claude/docs/screens-and-flows.md` has no Map section, and `design/emmas-path/emmas-path-spec.md` § 3 (72 pt stops, standing Emma, a rotateY gate) predates the clay rebuild and the badge. The code is the reference.

## 1. Four forms, one scale rule

| Form   | When             | Composition                                                                     |
| ------ | ---------------- | ------------------------------------------------------------------------------- |
| **W**  | tablet portrait  | The web portrait, 1:1: header row, path, caption row                            |
| **P**  | phone portrait   | Header row, path, 4-line caption slot. Never scrolls                            |
| **L**  | phone landscape  | Home rail on the left, a path pane that scrolls, 2-line caption across the base |
| **TL** | tablet landscape | The web landscape with a 350 pt column                                          |

**The path scales as one picture.** Core's `layoutMap` works in web px ("virtual px"). Native draws every path value × `s`: positions, sizes, radii, shadows, sparkle radii and hop heights. Don't use `transform: scale` (the web's `LandscapeFrame`), so hit areas stay real-size.

- **Portrait (W, P):** `s = min(1, pane.w / 820)`, then `layoutMap(model, pane.w / s, pane.h / s, alsoBadged)`. 820 is the web's iPad width. Below it the map shrinks as a whole rather than squeezing the stops together (at 744 pt the web lets a Word Song current stop overlap its neighbour). Floor: s = 0.457.
- **Landscape (L, TL):** `fit = landscapeScale(lands, pane.h, rooms)` (the web's rule) and `s = max(MAP_MIN_SCALE, fit)`, with `MAP_MIN_SCALE = 0.45`.
  - fit ≥ 0.45: the path fits the pane, with virtual height `pane.h / s − LANDSCAPE_TRAY_ROOM` (web).
  - fit < 0.45: the pane **scrolls** vertically. Content height = `landscapeNeed(lands, rooms) × 0.45`, virtual height = `landscapeNeed − LANDSCAPE_TRAY_ROOM`. Add `landscapeNeed` to core `map/mapLayout.ts`: it is the `need` inside `landscapeScale`, which then calls it. The web is unchanged.
- **Decision: only phone landscape scrolls.** Fitting 4–5 lands into a 271 pt pane would give 24–29 pt stops and a 25 pt Emma. At 0.45 the phone-landscape map is the same size as the phone-portrait one. Tablets and phone portrait never scroll, so the whole path stays one glance (spec § 0) on the devices where Marian plays.

**Hit areas.** Every stop and gate is at least 44×44 pt: its box plus `hitSlop = max(0, (44 − box) / 2)` on each side. At the floors the slop needed (≤ 2.2 pt) is less than half the narrowest gap between two stops (10.1 pt, Word Song, P). The current stop's bottom slop also covers its bud tray, which sits inside the stop's button on the web. Home is 56×56 on phones and 96×96 on tablets.

**Sizes.** Measured with core's own `layoutMap` / `landscapeScale` (a scratch script, not committed), worst case over every current step. Word Song is the smaller world on every device (pt):

| Device (insets)    | Form | s     | Stop | Current | Emma badge | Scroll                          |
| ------------------ | ---- | ----- | ---- | ------- | ---------- | ------------------------------- |
| 375×667            | P    | 0.457 | 40.2 | 48.5    | 42.1       | no                              |
| 430×932 (t59 b34)  | P    | 0.524 | 51.9 | 62.4    | 48.2       | no                              |
| 667×375            | L    | 0.45  | 39.6 | 47.7    | 41.4       | 448 pt content in 271 (NG: 369) |
| 820×1180 (t24 b20) | W    | 1     | 88   | 106     | 92         | no (= web)                      |
| 744×1133 (t24 b20) | W    | 0.907 | 79.8 | 96.2    | 83.5       | no                              |
| 1180×820 (b20)     | TL   | 0.787 | 69.3 | 83.4    | 72.4       | no                              |
| 1133×744 (b20)     | TL   | 0.711 | 62.5 | 75.3    | 65.4       | no                              |

## 2. Chrome per form

```
P  portrait (375×667 floor)           L  landscape (667×375 floor)
+------------------------------+      +----------------------------------------------+
| (⌂)    Number Garden         |      | (⌂) |  path pane, scrolls ↕                  |
|------------------------------|      |     |  ~~ land 3 ~~~~~~~~~~~~~~~~~ [arch] ~~ |
|  path, s = 0.457, no scroll  |      |     |      (badge)                           |
|  land 5 (top) … land 1       |      |     |  ~~ ( ) (◎) ( ) ( ) ~~ land 2 ~~~~~~~~ |
|       (badge)                |      |     |          tray                          |
|   ( ) (◎) ( ) ( ) ( )        |      |     |  ~~ land 1 ~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|       tray                   |      +-----+----------------------------------------+
|------------------------------|      | [🔊 caption: 2-line slot, full width       ] |
| [🔊 caption: 4-line slot   ] |      +----------------------------------------------+
+------------------------------+        (◎) current stop   (⌂) Home, 56×56
```

`S` = the safe rect.

**P (phone portrait):**

- Home 56×56 at (S.x + 16, S.y + 8): the web button with every value × 7/12, rounded (house art 40 pt).
- Title: Fredoka 700, 28 pt (web 52, shadow stack × 28/52), centred on S's width and on the Home button's height. Measured: "Number Garden" is 206 pt wide at 28 pt, which leaves it 12.5 pt clear of the Home button at 375.
- Caption slot: x S.x + 16, width S.w − 32, height **124** (4 lines: 4 × 22 × 1.18 + 2 × 10), bottom 16 above S's bottom. The slab is centred vertically in the slot (web `items-center`). The slot is reserved from mount, so the path never moves.
- Caption metrics are Session End's phone `ClayCaption` metrics: 22 pt, line height 1.18, padding 16/10, radius 32, speaker 28, gap 10.
- **Why 4 lines:** measured in WebKit with Fredoka 600 at 22 pt in the floor's 273 pt text width, the 266 map lines wrap to 1–3 lines, except for one 4-line line ("You learned groups of two, five and ten! Now you can do groups of three and four!").
- Pane: the full safe width, from Home's bottom + 8 to the slot top − 8. Floor: 375 × 447.

**L (phone landscape):**

- Rail: Home 56×56 at (S.x + 16, S.y + 8), with nothing under it. **No title in L.** The height goes to the path and the width to the caption. The stop pictures and land pills already show which world it is.
- Caption slot: x S.x + 16 to S.right − 16, height **72** (2 lines), bottom 16 above S's bottom. Measured: at the floor's 565 pt text width, every line fits in 2 lines.
- Pane: x S.x + 88 to S.right − 16, y S.y + 8 to the slot top − 8. Floor: 563 × 271.
- **Why not the web's left column:** Word Song's 5-stop land needs 767 virtual px (2 × 190 inset + 4 × 96.8), so a map at 0.45 needs a pane of at least 345 pt. That leaves the column 274 pt, and the caption 5 lines of 2–3 words each. A bottom slab reads in 1–2 natural lines.
- **Scroll:**
  - Vertical `ScrollView`, scroll indicator on, `flashScrollIndicators()` once after the first offset is set. No snapping, normal bounce.
  - Opening offset, not animated: centre the focus box (the top of Emma's badge down to the current stop's centre + 1 × its size, which covers the bud tray), clamped to the content. When the path is complete, the focus box is the last stop. Set it with `scrollTo({ y, animated: false })` in `onContentSizeChange`, because the `contentOffset` prop is iOS-only.
  - During an unlock beat the focus box is the union of both stops' boxes (measured: ≤ 238 pt at 0.45, so it fits in 271), and `scrollEnabled` is false until `cheer` (§ 4).
  - Rotating into L recomputes the offset. Nothing is remembered between visits.

**TL (tablet landscape): the web landscape, with a wider column.**

- Column: x S.x + 16, width **350**. The web uses `minmax(230px, 24vw)`, which is 283 pt on a 1180 pt iPad. TL is height-bound, so the extra width costs the path nothing. At 283 pt the 28 pt caption runs to 9 lines of about 2 words (measured); at 350 pt (246 pt text width) it takes ≤ 5.
- Home 96 at (S.x + 24, S.y + 14) (web). Title 52 pt, centred in the column, top S.y + 124 (web `pt-[124px]`). "Number Garden" wraps to 2 lines (377 pt > 350); "Word Song" fits on one.
- Caption slot: the column's width, height **192** (5 × 33.6 + 2 × 12), bottom 24 above S's bottom (web `pb-6`). The slab sits at the slot's bottom (web `items-end`). Metrics are the web map's: 28 pt, line height 1.2, padding 26/12, radius 40, speaker 38, gap 14, min height 80.
- Pane: x S.x + 390 to S.right − 16, y S.y + 8 to S.bottom − 8 (web `my-2`).

**W (tablet portrait): the web portrait, 1:1.** Header 124 pt: Home 96 at (S.x + 24, S.y + 14), title 52 pt centred. Caption row 128 pt, with the slab S.w − 80 wide and centred (2 lines at most, measured at 636 and 560 pt text widths). The pane is the full width between them.

**Every form:** the web's gradient `linear-gradient(#cdeeff 0, #e6f6ff 9%, #d9f0c2 14%, #cde8b0 100%)` fills the whole screen, safe areas included.

**New file:** `mobile/src/layout/mapScreenLayout.ts`, beside `hubLayout.ts`:

- `mapScreenLayout(viewport)` returns the form, Home, title (`null` in L), the caption slot and its metrics, and the pane.
- `mapPathScale(pane, model, alsoBadged, landscape)` returns `{ s, virtualW, virtualH, contentH, scrolls }`.

Unit tests pin the sizes table above.
