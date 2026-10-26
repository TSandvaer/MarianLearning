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
9. **Last synced shows this device's last successful cloud sync, in local date and time,** not the web's last-session time as a UTC ISO string (§ 4, § 5).
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

| Device (insets)       | Column | Card inner | Form    | Header |
| --------------------- | ------ | ---------- | ------- | ------ |
| 375×667               | 343    | 301        | compact | 56     |
| 390×844 (t47 b34)     | 358    | 316        | compact | 56     |
| 430×932 (t59 b34)     | 398    | 356        | compact | 56     |
| 667×375               | 635    | 593        | wide    | 56     |
| 844×390 (l47 r47 b21) | 718    | 676        | wide    | 56     |
| 744×1133 (t24 b20)    | 696    | 654        | wide    | 72     |
| 820×1180 (t24 b20)    | 720    | 678        | wide    | 72     |
| 1180×820 (b20)        | 720    | 678        | wide    | 72     |

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

## 3. Backup

- **Layout, every form:** the heading and description (web), then a button row 12 below: **[Copy] [Share…]**, gap 12, left-aligned, then the status slot (§ 5).
- **The JSON is built at tap time,** so `exportedAtISO` is the moment of the copy or share. The envelope is the web's: `{ kind: 'marian-tutor.backup', version: 1, exportedAtISO, progress, sessionHistory }`, 2-space indent, `sessionHistory: null` when the read throws.
- **Copy:** `Clipboard.setStringAsync(json)` from **`expo-clipboard`**, a new dependency (`npx expo install expo-clipboard`). It ships in Expo Go SDK 57 (docs.expo.dev, "Included in Expo Go"), so the Expo Go device checks keep working; a development build needs a rebuild. Resolves → "Copied to clipboard."; rejects → "Couldn't copy — use Share instead." (§ 7).
- **Share… replaces the `<textarea>`.** `Share.share({ message: json, title: 'Marian Tutor backup' }, { subject: 'Marian Tutor backup', anchor: <the button's node> })` from `react-native`: no new dependency. `anchor` (iOS) points the iPad popover at the button. A dismissed sheet shows nothing; a rejected call shows "Couldn't share.".
- **Why:** the textarea was a fallback for a failed clipboard call in an iOS PWA. Natively, `setStringAsync` "always resolves to `true`" on iOS and Android (expo-clipboard docs), so that fallback has nothing left to catch. A selectable text box nested in the page scroll would fight the page for the drag on a phone. The share sheet goes straight to where the description tells the parent to put the backup: Notes, Mail, Files.

## 4. Cloud backup

```
Cloud backup                                         compact differences:
Marian's progress is also saved to the cloud…        - Copy moves up onto the
                                                       "Device ID" label row
Device ID                                            - the ID box is full width
[ 3f2a9c1e-…  (mono 12, one line, selectable) ] [Copy]
Copied to clipboard.                       ← slot    - Restore goes under the
                                                       field, right-aligned, 8 below
Last synced                              [Push now]
11 Oct 2026, 14:32
                                     Synced. ← slot, right-aligned
Restore from device ID
[ paste UUID here                    ]  [ Restore ]
That doesn't look like a device ID…        ← slot
```

Blocks are 16 apart (web `mt-4`); field label → box 4 (web `mt-1`).

**Device ID:**

- Box: height 44, slate-50 fill, 1 pt slate-300 border, radius 6, padding 12, text centred vertically. `selectable`, so a long-press gives the system Copy, the manual path the error line names. "(unavailable)" when empty, with Copy disabled (web).
- Fit: 36 characters of 12 pt Menlo are 260 pt wide (advance 0.602 em). The compact box's text width at the floor is 301 − 2 − 24 = 275, so the ID never wraps. Wide: box = card inner − 12 − 64.
- Compact: the label row is 44 tall, "Device ID" on the left (centred vertically) and Copy on the right; the box sits 4 below at full width.

**Last synced and Push now:**

- Value left, Push now right (`minWidth` 112), in every form. Push calls the web seam (`pushProgressToCloud(getOrCreateDeviceId(), progress)`). While sending, the label is "Sending…" and the button is disabled. Statuses, web strings: "Synced.", "Couldn't reach the server.", "Cloud sync isn't configured." (a build without `EXPO_PUBLIC_PROGRESS_API_SECRET`).
- **Local time.** `formatLastSynced(iso)`: `new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`. `null` → "Never" (web); an unparseable value, or a throw → the raw string. The web prints the UTC ISO string, which in Denmark reads one or two hours off.
- **The value is this device's last successful cloud sync** (native departure, Thomas 2026-10-13: the web shows `profile.lastPlayedISO`, so on his iPhone Push now said "Synced." and the row didn't move). A sync counts when the device and its cloud copy agree after a cloud call (a push the server accepts, or a launch reconcile or Restore that read the cloud and installed, pushed or found it equal), and its time is stored under its own device-local key, `marian-tutor:last-sync`, outside the Progress blob, so it never syncs or restores to another device.

**Restore from device ID:**

- Field: height 44, white, 1 pt slate-300 border (focused slate-500, invalid amber-700), radius 6, padding 12, mono 12 slate-800, placeholder "paste UUID here" in slate-400. Props: `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`, `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"`, `keyboardType` `'ascii-capable'` (iOS) / `'visible-password'` (Android, which drops the suggestion strip), `returnKeyType="go"`; `onSubmitEditing` = a Restore tap.
- **Paste through the field's own system paste** (long-press → Paste, or the iPad keyboard's shortcut bar). **No Paste button:** reading the clipboard from a button (`getStringAsync`) triggers iOS's paste-permission prompt, and the system paste in a field doesn't.
- Wide: field (flex 1) + 12 + Restore, as on the web. Compact: the field takes the full width (275 pt of text: a whole UUID), and Restore sits under it, right-aligned, 8 below.
- **A Restore tap, in order:**
  1. `trimmed = input.trim()`. Not `isValidUuid(trimmed)` → the web's invalid-format line, and the field border turns amber. No alert.
  2. `trimmed.toLowerCase() === deviceId.toLowerCase()` → "That's this device's own ID." No alert, no write.
  3. `Keyboard.dismiss()`, then `Alert.alert('Restore from that device?', 'This device will use that ID from now on. The newer progress of the two devices is kept, and the older one is replaced.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress }])`. Cancel changes nothing and keeps the text. Restore runs the web flow: "Restoring…" (disabled), `restoreFromDeviceId(trimmed)`, then the outcome line, the new device ID, and the refreshed progress (the banner and rows re-render from it).
- Editing the field clears the invalid-format and own-ID lines (web clears invalid-format). An outcome line stays until the next edit or Restore (web).
- **Why the alert:** natively, this field is how a second device takes over her progress (Phase 5 gives the native app a fresh device ID), so it will be used for real. Both results are hard to undo: this device's old ID is shown nowhere after the switch, and the older blob is replaced (this device's, or the cloud copy under that ID when this device's is newer). The web does it in one tap. A system alert costs one more tap and needs no layout. The own-ID check exists because Copy and Restore sit a few centimetres apart on the same screen.

**Keyboard:**

- `ScrollView` props: `keyboardShouldPersistTaps="handled"`, so the first tap on Restore (or any control) while the keyboard is up acts, instead of only closing the keyboard (the RN default). `keyboardDismissMode`: `'interactive'` (iOS), `'on-drag'` (Android).
- **No `KeyboardAvoidingView`.** On `keyboardWillShow` / `keyboardWillChangeFrame` (iOS) and `keyboardDidShow` (Android), set the content's extra bottom padding to `max(0, keyboardHeight − S.bottom)`. If the restore field is focused, scroll to `y = max(0, blockBottom − (keyboardTop − headerBottom − 16))`: `blockBottom` is the restore block's bottom (status slot included) in content coordinates, from `onLayout`; `keyboardTop` is `endCoordinates.screenY`; `headerBottom` is S.y + the header height. Animated, unless Reduce Motion is on. On hide, remove the padding.
- **Why:** one measured height and one padding rule behave the same on both platforms, where `KeyboardAvoidingView` needs a per-platform `behavior` and resizes the whole screen. Budget at the landscape floor: the header (56) and the wide restore block (label 16 + 4 + field 44 + slot 20 = 84) need 140 pt, which leaves 235 pt for the keyboard. That keyboard height is not measured here; the device check covers it.

## 5. Status lines and timing

| Status         | Where                                    | Strings                                                                                            | Lasts                          |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| Backup         | under Copy / Share…, left                | Copied to clipboard. / Couldn't copy — use Share instead. / Couldn't share.                        | 2.4 s                          |
| Device ID copy | under the ID box, left                   | Copied to clipboard. / Couldn't copy — select the text and copy manually.                          | 2.4 s                          |
| Push           | under the Last synced row, right-aligned | Synced. / Couldn't reach the server. / Cloud sync isn't configured.                                | 2.4 s                          |
| Restore        | under the restore row, left              | invalid-format and outcome lines (web `restoreOutcomeMessage`), own ID, Restore failed ({reason}). | until the next edit or Restore |

- **2400 ms from the latest tap.** A repeat tap inside the window restarts the timer and re-announces the line (key the line by a tap counter). Web: the timer runs from the first tap only (its effect depends on the state value, which a repeat doesn't change), and the Backup status never clears at all: it has no reset effect, although the comment above `copyState` says it resets. Native follows that comment and the two sibling statuses.
- **Reserved slots:** each status line reserves 4 + 16 pt from mount, so nothing below it moves when a status shows or clears. A two-line status (some restore outcomes in compact) grows its slot; it is the last item in its block.
- Fade in and out over 150 ms (`FadeIn` / `FadeOut`); with Reduce Motion, no fade. Announce: `accessibilityLiveRegion="polite"` (Android), `AccessibilityInfo.announceForAccessibility(text)` (iOS).
- Timers are cleared on unmount. A push or restore that resolves after Done is ignored by the UI. Its storage writes still land, as on the web.

## 6. Entry, exit, audio, App wiring

- **Entry:** the 3 s press on Emma on the Hub (`onParentLongPress`, already wired, hub-native § 4). Unchanged, and no feedback during the hold: it is a hidden gate, as on the web.
- **Parental gate: out of scope.** The 3 s hold is the only gate in this phase. A store-compliant parental gate (Apple Kids Category, Google Designed for Families) is Phase 6 (`design/react-native-migration-plan.md` § Phase 6).
- **Enter:** the root `entering={FadeIn.duration(200)}` (Reduce Motion: none). App stops rendering `EmmaStage` on this route (`route !== 'map' && route !== 'parent-settings'`); her stage's `FadeOut(STAGE_EXIT_MS)` (200) plays over the fade-in. Today App still draws her over the placeholder.
- **Done** (`testID="parent-settings-done"`): `Keyboard.dismiss()`, then `onExit` → `navigate('hub')`. There is no exit animation and nothing to save: every change saved when it was made (web). Emma remounts on the Hub with `entrance='fade'` (App reads it at mount).
- **The Hub on return follows its normal rule (web parity):** quiet if it unmounted less than 30 s ago (`RAPID_REMOUNT_MS`), else its guidance lines play. Parent Settings does **not** call `markHubUnmount` on leave (the map does). After a longer stay, Emma tells Marian what's next as the device is handed back.
- **Android back = Done** (a `BackHandler` returning `true`). With the keyboard up, the system closes the keyboard first. **No iOS edge swipe** (map-native § 7).
- **Audio:** the screen plays nothing: no SFX on any control (web). On mount it calls `releaseAudioSession()` (`mobile/src/audio/lifecycle.ts`, already used on backgrounding). That completes greet-math-native § 3's "later, also on silent screens such as ParentSettings". On iOS, expo-audio deactivates the session with `.notifyOthersOnDeactivation` (expo `sdk-57` `ios/AudioModule.swift`, `setIsAudioActive`), so music that Emma's lines paused can resume while the parent is here. It also pauses every player, but none is playing: the Hub cancels its line at unmount, which runs before this screen's mount effect. Since expo-audio 58 (iOS), the release also makes every `play()` a no-op until `setIsAudioActiveAsync(true)` (`ios/AudioModule.swift` `audioEnabled`), so the screen holds the release through `quietAudioSession()` and every way out (Done, Android back, the QA jump) awaits the re-enable before it leaves; the lifecycle does the same on a return from the background, and skips it while this screen is up. Android: a no-op (lifecycle header).
- **Progress after leaving:** no App wiring. The Hub reads progress at mount, so a changed setting or a restore shows at once, and `take()`'s key check (`sessionPrefetch.ts`) discards a prefetch made under an older focus.
- **Status bar:** stays hidden (App-wide `<StatusBar hidden />`).

## 7. Copy changes

The web keeps its strings (UI freeze). Native changes these, and only these:

1. **Both threshold descriptions.** Web: "How many in-a-row sessions Marian needs at this success rate before a skill counts as mastered." Native: **"How many sessions at this success rate Marian needs before a skill counts as mastered. They don't have to be in a row."** Core counts good days, or good sessions with fresh-day mastery off, "in any order" (`packages/core/src/progress/mastery.ts`, `applyMasteryRule` doc; Emma's Path decision 1).
2. **The footnote is generated.** The web hardcodes "math threshold 95% / 3 sessions, word-song threshold 90% / 3 sessions, level hidden". Core's defaults are 87.5 % / 3 on both tracks and `showLevelToMarian: true`. A pure `defaultsFootnote(DEFAULT_PARENT_SETTINGS)` builds the line with the segments' preset labels. With today's defaults it reads exactly: **"Defaults: auto-promote on, fresh-day mastery on, math threshold 88% / 3 sessions, word-song threshold 88% / 3 sessions, level shown, mode picker off, cross-vowel mixing on (active after all three short-vowel CVC tiers master)."**
3. **New strings:** "Share…"; "Couldn't copy — use Share instead." (the web line points at the textarea, which is gone); "Couldn't share."; "That's this device's own ID."; the alert in § 4; the share title and subject "Marian Tutor backup".

## 8. Web → native translations

**Logic is shared, not re-ported** (the hub-native § 6 precedent; a refactor, which the freeze allows). Move the screen's pure parts to `packages/core/src/parentSettings/parentSettingsModel.ts` (`@marian/core/parentSettings/parentSettingsModel`) and have the web import them back: `applySettingsPatch(progress, patch)`, `confirmPendingPromotion(progress)`, `buildBackupJson(progress, sessionHistory, exportedAtISO)`, `restoreOutcomeMessage(outcome)`, `presetLabel(preset)`, `presetId(preset)` and `presetIndexFor(value, track)`. `defaultsFootnote` and `formatLastSynced` stay native, because the web keeps its strings. The native screen keeps the web's `ParentSettingsStorage` seam (load, save, loadSessionHistory, writeClipboard, getDeviceId, pushNow, restoreFromDeviceId) plus `share`, so the component tests port.

| Web                                             | Native                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `<main>`, `max-w-3xl`, `env(safe-area-inset-*)` | Root View, fixed header, `ScrollView`, `parentSettingsLayout` (§ 1)                   |
| `<button role="switch">` drawn pill             | `Switch` inside a row `Pressable` (§ 2)                                               |
| `role="radiogroup"` buttons                     | Drawn segmented control, 44 pt (§ 2)                                                  |
| `navigator.clipboard.writeText`                 | `expo-clipboard` `setStringAsync` (§ 3)                                               |
| `<textarea readOnly>` + select-all on click     | Share… (§ 3)                                                                          |
| `<code class="select-all">`                     | `<Text selectable>` (§ 4)                                                             |
| `<input type="text">`                           | `TextInput` with the § 4 props                                                        |
| `window.setTimeout` resets                      | `setTimeout`, restarted per tap, cleared on unmount (§ 5)                             |
| `hover:` / `focus:ring`                         | Pressed colours (§ 2); no hover, no focus ring                                        |
| `data-testid`, `data-value`, `data-selected`, … | `testID` with the same names; state through `accessibilityState` and the visible text |

## Acceptance criteria

**Unit and component tests (CI):**

- [ ] `parentSettingsLayout` reproduces § 1's sizes table, and returns `compact` at 820×1180 with fontScale 1.3.
- [ ] `defaultsFootnote(DEFAULT_PARENT_SETTINGS)` equals § 7's string. `formatLastSynced(null)` is "Never"; an unparseable value comes back unchanged.
- [ ] The web's ParentSettings tests stay green with the logic moved to core (`npx vitest run`).
- [ ] Component test: a Progress with `pendingPromotion` and `autoPromote: false` shows the banner with the skill's label; Confirm promotion hides it and saves the doc with that node `mastered`. (No debug seed reaches this state, so it is not in the device check.)
- [ ] Component test: a second Copy tap 1 s after the first keeps "Copied to clipboard." until 2.4 s after the second.

**Device check (Thomas's devices, as for every Phase 3 screen; each item is seen or heard on the device):**

- [ ] On the Hub, a 3 s press on Emma opens Parent Settings: Emma fades out, the screen is slate on white in the system font, and nothing plays.
- [ ] 375×667 portrait: both thresholds and the session-mode control sit under their text at full width; the device ID is on one line and not cut off; Done stays at the top while you scroll to Cloud backup.
- [ ] Phone landscape: every control sits to the right of its text; nothing is under the notch or the home indicator; slate reaches every edge, with no cream strip.
- [ ] Tablet, both orientations: one centred column, controls on the right, the web's look.
- [ ] Tapping a toggle's label flips it; tapping the switch itself flips it once; a scroll that starts on a row flips nothing.
- [ ] "Show level to Marian" off → Done → the Hub cards show no land number; on again → the numbers return.
- [ ] Math threshold → 95% / 3 → Done → back in with the 3 s press: 95% / 3 is still selected and Word Song is unchanged (88% / 3 on a fresh install).
- [ ] The footnote reads "…math threshold 88% / 3 sessions, word-song threshold 88% / 3 sessions, level shown…".
- [ ] Backup → Copy: "Copied to clipboard." shows, then clears about 2.4 s later. Pasted into Notes, the text starts with `{` and contains `"kind": "marian-tutor.backup"`.
- [ ] Backup → Share…: the share sheet opens (on the iPad, a popover pointing at Share…); Notes saves the same JSON; dismissing the sheet shows no status.
- [ ] Device ID → Copy: "Copied to clipboard.", then it clears; pasted elsewhere, it matches the 36 characters on screen. A long-press on the ID offers the system Copy.
- [ ] Push now: "Sending…" on a greyed button of unchanged width, then "Synced." on the right, clearing after about 2.4 s. "Last synced" shows the current local date and time at once.
- [ ] "Last synced" shows the local date and time of this device's last successful sync, or "Never" until the first one. In a build without the progress secret nothing changes it, and Push now says "Cloud sync isn't configured."
- [ ] Phone portrait and landscape, tap the restore field: no suggestion bar and no auto-capital; the field, its status line and Restore are above the keyboard. Type "abc" and tap Restore once with the keyboard still up: the amber "doesn't look like a device ID" line shows and no alert. Editing the text clears it.
- [ ] Paste this device's own ID → Restore: "That's this device's own ID." and no alert.
- [ ] Phone that has never played a session: copy the iPad's device ID, paste it into the phone's field with the system Paste, tap Restore → the alert → Cancel: nothing changes. Again → Restore: "Restoring…", then "Restored Marian's progress from that device."; the phone's Device ID now shows the iPad's; Done → the phone's Hub shows the iPad's flowers and land numbers.
- [ ] Rotating with the restore field focused keeps the keyboard and the text, and the field stays above the keyboard.
- [ ] Android back → the Hub. With the keyboard open, the first back closes the keyboard.
- [ ] iOS, music playing in Music: the Hub's line pauses it; opening Parent Settings lets it resume; after 30 s or more here, Done → the Hub's line pauses it again.
- [ ] System text size at its largest standard step: the controls go under their text on the tablet too, nothing is clipped, and the header text stays the same size.

## Open questions

None for Thomas. He checks the PR on his devices, as for every Phase 3 screen (`team/DECISIONS.md` 2026-10-09). The native screen departs from the web in eleven places: the fixed header, compact stacking, the row-wide native Switch, Share… in place of the textarea, the restore alert and the own-ID check, the screen-owned keyboard handling, the per-tap 2.4 s timer (with the Backup status clearing), Last synced as this device's last successful sync in local time, two corrected strings and the generated footnote, the audio-session release, and 44 pt touch targets (the web's are 32–36 px). None touches anything Marian sees or hears, so no Dave consult is needed. The system font, and no Emma on this screen, are the web's own choices, not departures.
