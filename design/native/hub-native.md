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
- **No parent-gate corner** (§ 7). The Hub has three targets: the two cards and the two map buttons inside them.

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
- Column: from safe left + 16 to the left card − 24. Floor: 262 pt. Wider phones give the extra width to the column (iPhone 14, 844×390 with 47 pt side insets: s 0.494, column 304).
- Bubble: the full column width, 3-line slot (100 pt), tail on top pointing up.
- Emma: `E = min(1.25 × column, safe h − 16 − 100 − 12)`, centred on the column. She may be wider than the column: her figure fills only the middle 35% of the art (x ≈ 0.33–0.68 of `idle.webp`), and the transparent sides pass under the left card. Floor: E = 247.
- Emma + 12 + bubble slot are centred together vertically in the safe height.

## 3. Tablet layouts

**W (tablet portrait) = the web stage, 1:1.** Stage width `= min(safe w, safe h × 820/1180)`, aspect 820:1180, centred horizontally, top-aligned at the safe top, with `u = stage width / 820`. Every web position is reference px × u: Emma's frame (200, −6, 520×520), the light (250, 40, 420×420), the bubble (26, 120, width 330, padding 14/18, radius 34, Fredoka 600 30u, line height 1.15, tail on the right toward Emma), the cards (x 24 and 418, y 470, 378×672, so s = u). The bubble keeps the web's behaviour: no reserved slot, it grows down from y 120 (nothing sits under it until the cards at 470). The gradient fills the side gutters, as `.hub-clay` does.

**L (tablet landscape)** is the same formula as phone landscape with tablet values: caption **30 pt** (the web's 30u at u = 1), line height 34.5, padding 14/18, so the 3-line slot is **132 pt**; `colMin = 350` (314 pt inner width keeps every line to 3 lines at 30 pt). s is capped at 1, never larger than the web card.

| Tablet landscape example (status bar hidden) | s    | Cards     | Column | Emma |
| -------------------------------------------- | ---- | --------- | ------ | ---- |
| iPad Air 11", 1180×820 (bottom inset 20)     | 1.0  | 378 × 672 | 352    | 440  |
| iPad 10.2", 1080×810 (no insets)             | 0.87 | 329 × 585 | 350    | 437  |

Check: the 1180 row's vertical sum is 8 + 28 + 672 + 14 + 8 = 730 ≤ 800, so s = 1 fits; the 1080 row is width-bound.

## 4. Emma on the Hub

_(pending)_

## 5. Audio and session

_(pending)_

## 6. Web → native translations

_(pending)_

## 7. Not ported

_(pending)_

## Acceptance criteria (Jessica, on device)

_(pending)_

## Open questions

_(pending)_
