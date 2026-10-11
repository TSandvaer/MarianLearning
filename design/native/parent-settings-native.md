# Parent Settings: native UX calls

**Scope:** React Native Phase 3, the last screen (after Word Song, #543). The reference is the live web screen `src/screens/ParentSettings/ParentSettings.tsx` (frozen): a pending-promotion banner, seven setting rows, a defaults footnote, Backup and Cloud backup. Anything not named here behaves as the web screen does, and every string is the web's, word for word, unless § 7 names it. Conventions follow `design/native/hub-native.md`: the 375×667 / 667×375 phone floor, and "tablet" means a shorter side of 600 pt or more (`isTablet`, `mobile/src/layout/layout.ts`).

**Not a Marian screen.** This is the one native screen that does not follow greet-math-native § 2 (Fredoka everywhere). That call is about Marian reading the same letter shapes on both devices. Marian never reads this screen, and the web's point is "this is obviously not a Marian screen" (`ParentSettings.tsx` header). So: system font, slate on white, no Emma, no sound, no motion beyond a fade.

**Stale docs:** `.claude/docs/screens-and-flows.md` § ParentSettings lists five rows, presets `80/2 | 90/3 | 95/3`, a math default of 95/3 and a Word Song default of 90/3, and no Cloud backup section. The code has seven rows (plus `crossVowelMixingEnabled`), and core's presets are `80/2 | 87.5/3 | 95/3`, with 87.5/3 the default for both tracks since 2026-10-05 (`packages/core/src/progress/parentSettings.ts`). The middle segment therefore reads "88% / 3" (`Math.round(87.5)`). The code is the reference.

## Decisions

1. **One scrolling column, at most 720 pt wide, under a fixed header** that keeps Done on screen (§ 1).
2. **Compact form:** on phone portrait, or when the text is large, the segmented controls go under their text. Everything else stays inline (§ 1, § 2).
3. **Toggles are the native `Switch`, and the whole row is the target** (§ 2).
4. **Segmented controls are drawn, 44 pt tall** (§ 2).
5. **Backup:** Copy uses `expo-clipboard`, and a Share… button (the system share sheet) replaces the JSON `<textarea>` (§ 3).
6. **Restore asks once, in a system alert,** before it switches the device ID. Pasting this device's own ID is caught inline (§ 4).
7. **The screen handles the keyboard itself:** bottom padding plus scroll-into-view, and taps reach Restore while the keyboard is up (§ 4).
8. **Every transient status lasts 2.4 s from the latest tap, and each status line has a reserved slot** (§ 5).
9. **Last synced shows local date and time,** not a UTC ISO string (§ 5).
10. **Done and Android back → Hub. No Emma stage on this route. The iOS audio session is released on entry** (§ 6).
11. **Two web strings that core contradicts are corrected, and the defaults footnote is generated from core** (§ 7).

## 1. Layout

| Form        | When                                       | Composition                                                    |
| ----------- | ------------------------------------------ | -------------------------------------------------------------- |
| **Compact** | card inner width < 520, or fontScale > 1.2 | Fixed header; segmented controls stacked under their text      |
| **Wide**    | otherwise                                  | Fixed header; every control inline on the right (the web rows) |

`S` = the safe rect. `pad` = 16 on phones, 24 on a tablet.

- **Column:** width `min(720, S.w − 2 × pad)`, centred in S. 720 is the web's `max-w-3xl` (768) minus its `px-6`. Each card has a 1 pt border and 20 pt padding, so **card inner = column − 42**.
- **Compact threshold, 520:** a three-segment control (242) + the 24 pt gap + a text column of at least 254. `fontScale` comes from `useWindowDimensions()`. Above 1.2, inline segments no longer fit their labels, so the screen goes compact on every device.
- **Header, fixed (not scrolled):** height **56** on phones and **72** on a tablet, plus S.y. Background slate-50 with a 1 pt slate-200 bottom border, full-bleed. The title and subtitle are left-aligned at the column's x and Done is right-aligned at the column's right edge, both centred vertically in the bar. **Why fixed:** on a phone the content runs to several screens, and the web's scrolling header would leave Done at the top while the parent is in Cloud backup at the bottom. A fixed bar with Done on the right is the iOS convention for a settings sheet. (Thumb reach is Marian's rule; a parent can reach the top.)
- **Scroll:** one vertical `ScrollView` from the header's bottom to the screen's bottom. Content padding: top 20 (phones) / 32 (tablet), bottom 32 + S.bottom. Scroll indicator on, normal bounce, `contentInsetAdjustmentBehavior="never"` (the screen sets its own insets), and the keyboard props in § 4.
- **Background:** slate-50 `#F8FAFC` fills the whole screen, safe areas included. The App root's cream must not show at any edge.
- **Order (web):** the pending-promotion banner (when shown), 24 below it the settings card (7 rows), 24 below that the footnote, 32 below that Backup, then 32 below that Cloud backup.
- **Rotation:** the layout recomputes from the viewport. Screen state (inputs, statuses, the restore field and its focus) lives in the component and survives; nothing remounts on a rotation.

```
P  portrait, 375×667 (compact)        L  landscape, 667×375 (wide)
+--------------------------------+    +-----------------------------------------------+
| Parent settings         [Done] |    | Parent settings                        [Done] |
| Changes save automatically.    |    | Changes save automatically.                   |
|================================|    |===============================================|
| +----------------------------+ |    | +-------------------------------------------+ |
| | Auto-promote on        (●) | |    | | Auto-promote on mastery              (●)  | |
| | mastery                    | |    | | Advance Marian to the next skill…         | |
| | Advance Marian to the …    | |    | |-------------------------------------------| |
| |----------------------------| |    | | Session-mode picker        [ Off | On ]   | |
| | Math threshold             | |    | | Off: the engine picks…                    | |
| | How many sessions at this  | |    | |-------------------------------------------| |
| | success rate Marian needs… | |    | | Math threshold  [80% / 2|88% / 3|95% / 3] | |
| | [80% / 2|88% / 3|95% / 3 ] | |    | | How many sessions at this success rate…   | |
| |----------------------------| |    |      ↕ scrolls under the fixed header         |
|      ↕ scrolls under the header|    +-----------------------------------------------+
+--------------------------------+      (●) = Switch; [ | ] = drawn segmented control
```

**Sizes** (by hand from the rules above):

| Device (insets)          | Column | Card inner | Form    | Header |
| ------------------------ | ------ | ---------- | ------- | ------ |
| 375×667                  | 343    | 301        | compact | 56     |
| 390×844 (t47 b34)        | 358    | 316        | compact | 56     |
| 430×932 (t59 b34)        | 398    | 356        | compact | 56     |
| 667×375                  | 635    | 593        | wide    | 56     |
| 844×390 (l47 r47 b21)    | 718    | 676        | wide    | 56     |
| 744×1133 (t24 b20)       | 696    | 654        | wide    | 72     |
| 820×1180, 1180×820 (b20) | 720    | 678        | wide    | 72     |

**New file:** `mobile/src/layout/parentSettingsLayout.ts`, beside `wordSongLayout.ts`. `parentSettingsLayout(viewport, fontScale)` returns `{ tablet, compact, headerHeight, column: { x, width }, cardInner, contentPadTop }`. Unit tests pin the table above, plus `compact === true` at 820×1180 with fontScale 1.3. The screen does not use `layoutForRoute`: there is no Emma frame (§ 6).

## 2. Controls

**Type** (system font: omit `fontFamily`; monospace is `Platform.select({ ios: 'Menlo', android: 'monospace' })`). Text scales with the system text size, capped by `maxFontSizeMultiplier`: **1.5** for body text, **1.2** for the header (so the bar stays 56 / 72). The device ID and the restore field are a code to compare, not prose: `allowFontScaling={false}`, `numberOfLines={1}`.

| Text                         | Size / weight / line height      | Colour                                                                 |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Header title                 | 20 phones, 24 tablet / 600       | slate-900 `#0F172A`                                                    |
| Header subtitle              | 13 phones, 14 tablet / 400       | slate-500 `#64748B`                                                    |
| Row label, section heading   | 16 / 500 (heading 600) / 21      | slate-800 `#1E293B`                                                    |
| Row and section description  | 14 / 400 / 20, 4 below the label | slate-500                                                              |
| Field label ("Device ID", …) | 12 / 500 / 16                    | slate-600 `#475569`                                                    |
| Last synced value            | 14 / 400 / 20                    | slate-700 `#334155`                                                    |
| Device ID, restore field     | 12 mono / 400                    | slate-700 (field: slate-800)                                           |
| Status line                  | 12 / 400 / 16                    | emerald-700 `#047857` ok, amber-700 `#B45309` error, slate-500 neutral |
| Footnote                     | 12 / 400 / 16                    | slate-400 `#94A3B8` (web)                                              |
| Button and segment label     | 14 / 500                         | per button below                                                       |

**Rows** (the web's `RowFrame`): padding 16 vertical, 20 horizontal; 1 pt slate-200 dividers; the card is white with a 1 pt slate-200 border and radius 6. Wide: text on the left (flex 1) and the control on the right, top-aligned, gap 24. Compact: toggles keep that shape with a 16 gap; segmented controls go under the text, 12 below the description, at the full card inner width.

**Toggle rows: the native `Switch`.**

- `trackColor={{ false: '#CBD5E1', true: '#334155' }}` (slate-300 / slate-700, the web's colours), `ios_backgroundColor="#CBD5E1"`, `thumbColor="#FFFFFF"` (Android). Platform size (iOS 51×31).
- **The whole row is one `Pressable` that toggles it.** The `Switch` sits in a `View` with `pointerEvents="none"`, so there is one handler and no double toggle. The web gets the same effect from `<label htmlFor>`. The hit area is the row: at least 53 pt tall, usually 90+. A scroll that starts on a row cancels the press (ScrollView takes the touch).
- Pressed row: background slate-50 while pressed. The thumb's slide is the OS animation.
- Accessibility: the row has `accessibilityRole="switch"`, `accessibilityState={{ checked }}`, the label as `accessibilityLabel` and the description as `accessibilityHint`. The `Switch` is hidden from accessibility (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`).
- **Why native:** VoiceOver, TalkBack and the platform look come free, with no animation code. A system switch also says "settings", which is the point of this screen. The colours keep the web's slate.

**Segmented controls: drawn.**

- A row of `Pressable` segments in a View with a 1 pt slate-300 border, radius 6, `overflow: 'hidden'`. No dividers (web). **Height 44.** Selected: slate-700 fill, white label. Unselected: white, slate-700 label; pressed: slate-100.
- Wide: each segment `minWidth` 80 (threshold) / 72 (session mode), `paddingHorizontal` 8, so the controls are 242 / 146 pt wide, right-aligned. Compact: the segments share the card inner width equally (at the floor, 99.7 and 149.5 pt).
- Labels: `Off` / `On`, and `${Math.round(p.percent * 100)}% / ${p.sessions}` → `80% / 2`, `88% / 3`, `95% / 3` (web). The selected preset is matched exactly, with the per-track default as the fallback (web `presetIndex`).
- Accessibility: the group has `accessibilityRole="radiogroup"` and the row label; each segment has `accessibilityRole="radio"` and `accessibilityState={{ selected }}`.
- **Why drawn:** the system segmented control's height is fixed by iOS below the 44 pt floor, Android has no native one, and it would be a new dependency. Two labels and three short ones are simple to draw identically on both platforms.

**Buttons.** All are `Pressable`, radius 6, 1 pt border, `minHeight` 44, `paddingHorizontal` 16, label 14 / 500, centred.

| Style     | Used by                      | Rest                               | Pressed               | Disabled                           |
| --------- | ---------------------------- | ---------------------------------- | --------------------- | ---------------------------------- |
| Primary   | Copy (×2), Push now, Restore | slate-700 fill + border, white     | slate-800             | slate-300 fill + border, slate-500 |
| Secondary | Done, Share…                 | white, slate-300 border, slate-700 | slate-100             | —                                  |
| Confirm   | Confirm promotion            | emerald-700 `#047857`, white       | emerald-800 `#065F46` | —                                  |

`minWidth`: 64 for Copy and Share…, 72 for Done, **112 for Push now and Restore**, so the button doesn't change width when its label becomes "Sending…" / "Restoring…".

**Pending-promotion banner** (web, unchanged in content): emerald-50 `#ECFDF5`, 1 pt emerald-300 `#6EE7B7` border, radius 6, padding 16. Heading 16 / 600 emerald-900 `#064E3B`; text 14 / 20 in emerald-900 at 0.8 opacity; the Confirm button 12 below. Shown only when `pendingPromotion` is set and auto-promote is off (web).

**Footnote:** 12 pt slate-400, the column's width, text from § 7.
