# Greet (+ Splash) and Math: native UX calls

**Scope:** React Native Phase 3, first slice (Thomas approved 2026-10-09). Four calls for Devon's Greet port and the Math port after it. Anything not named here follows the web specs `design/session-1.md` (Screens 1–2) and `design/screen-3-math.md`. **The tablet follows the web layout.** Tablet means a shorter side of 600 pt or more (`isTablet`, `mobile/src/layout/layout.ts:58-59`). § 4 is phone-only.

## 1. Wake tap: keep it

**Decision:** keep the Wake state. Emma slides in and breathes, the ready ring appears, and nothing plays until Marian taps. The spike's 1 s auto-start is dropped.

**Why:** Greet runs once in her life (sessionCount 0, never re-shown), and only line 4 is ever replayed. Auto-start plays whether or not she is looking. On a first launch an adult may open the app and hand the device over, so "Hi! I'm Emma." can play to nobody. With the tap, the introduction starts when she is there, and she gets her first cause and effect: she taps, and Emma says hi. The whole screen is the target, so she can't miss it, and the 8 s nudge Dave already reviewed still applies.

- Same as the web: full safe-area tap target, ring at +900 ms, one 8 s nudge (finger icon + ear-wiggle, no TTS), Reduce Motion handled as in the web spec.
- The tap starts line 0 ("Hi!") at once, with no 1 s delay. Target: `onPlay` ≤ 250 ms after the tap.
- Drop the web's unlock machinery: the 6 s first-utterance retry and the ring re-arm on relock. A line that fails to start goes down the engine's start-timeout path (PR #528): its caption walks and the sequence continues.

## 2. Caption font: Fredoka on both platforms

**Decision:** Fredoka on iOS and Android for every text on these screens. No per-platform font.

**Why:** Marian will use her iPad and a phone (plan, audience decision 2026-10-08), so the same word should look the same on both. Fredoka draws a single-storey **a** (see "many" in the spike's Math caption), the shape children are taught to write. SF Pro Rounded draws a double-storey **a**. A beginning reader shouldn't meet two shapes of one letter depending on which device she picked up. Fredoka is also already the web's clay-redesign face (`font-clay`: chips, HUD), and a bundled font breaks lines the same way everywhere, so one set of layout numbers works.

| Text              | Weight | Tablet (web) | Phone portrait     | Phone landscape    |
| ----------------- | ------ | ------------ | ------------------ | ------------------ |
| Greet caption     | 600    | 38.4         | 26                 | 26                 |
| Math caption      | 600    | 25.6         | 22                 | 22                 |
| Equation numerals | 700    | 96           | 72                 | 56                 |
| Chip numeral      | 600    | 52           | 0.45 × chip height | 0.45 × chip height |

The phone sizes are smaller in points but look about the same size, because a phone is held closer than an iPad. No caption goes below 22 pt.

## 3. Between Emma's lines: hold the audio session

**Decision:** hold the session. Create voice players with `keepAudioSessionActive: true`, so other audio on the device stays paused while Emma's screens are up. Release it with `setIsAudioActiveAsync(false)` only when the app goes to the background (later, also on silent screens such as ParentSettings). Both names are in expo-audio 57.0.5 (`build/Audio.types.d.ts:106-118`). The option is **iOS-only**. On Android, check whether audio focus is given up between lines; if it is, hold it the same way.

**Why:** pumping is the worst of both options. The music stutters back and is cut off again: every ~400 ms in Greet, and in Math across whole thinking pauses, where it would return while she counts and stop again at "Yes! Three!". Marian hears Emma's voice in a second language, and the sounds she has to tell apart (short vowels, number words) are easiest to hear with nothing else playing. For the family the rule works like a video app: open the app and the music on that device pauses; leave the app and the music can come back. Music on another device in the room isn't affected either way. With `interruptionMode: 'doNotMix'` (`mobile/src/audio/lifecycle.ts:39`) the other audio pauses rather than ducks.

## 4. Phone layouts

**Design floor:** 375×667 pt portrait and 667×375 landscape (iPhone SE), plus a home-indicator inset where there is one. The spike's Android reference is 411×914 dp (`emulator.log`: 1080x2400 at 420 dpi).

| Target       | Phone minimum hit area | Spacing               | May it shrink?                         |
| ------------ | ---------------------- | --------------------- | -------------------------------------- |
| Wake surface | whole safe area        | —                     | —                                      |
| Heart        | 120×88                 | —                     | **No.** Tablet keeps the web's 160×117 |
| Answer chip  | 72×72 (88 preferred)   | ≥ 16 pt between chips | 88 → 72, **never below 72**            |
| Back arrow   | 56×56 disc             | ≥ 16 pt to any target | **No** (56 pt clay disc, as web)       |

**Why 72:** a phone has about 153–163 pt per inch. 72 pt there is 11–12 mm, which is the same physical size as the project's 60 pt floor on a 264-ppi iPad (≈ 11.5 mm, `session-1.md` § Global conventions).

**Must not shrink:** the targets above, the 16 pt gaps, counting dots below 20 pt, captions below 22 pt, numerals below 56 pt. **May shrink:** Emma, the numerals (96 → 72 → 56), HUD pills and beads (they are not targets), padding (16 → 8), ribbon width. **Never hidden:** the back arrow, the ribbon while Emma speaks, the dots.

```
GREET  portrait                    landscape
+------------------------+   +-----------------------------------------+
|       ( Emma  )        |   |   ( Emma      ) |                       |
|       ( flex 1,)       |   |   ( 85% safe  ) |  +-----------------+  |
|       ( ≤ 60% h)       |   |   ( height,   ) |  | caption 26 pt   |  |
| +--------------------+ |   |   ( centred,  ) |  +-----------------+  |
| | caption 26 pt,     | |   |   ( wake ring ) |       <heart>         |
| | 2-line slot        | |   |                 |       120×88          |
| +--------------------+ |   +-----------------------------------------+
|        <heart>         |    left half: Emma; right half: ribbon + heart,
|  120×88, bottom edge   |    centred together vertically (web grid)
|  32 pt above safe btm  |
+------------------------+
```

- Portrait: Emma takes the leftover height, capped at 60% of the safe height; any remainder is split evenly above Emma and between the ribbon and the heart. This replaces the empty band between ribbon and heart in the spike's Android screenshot 03.
- Both orientations: the layout reserves a 2-line ribbon slot from the start. The visible ribbon grows downward from the slot's fixed top, so Emma and the heart never move when a line wraps.

```
MATH  portrait                       landscape
+------------------------------+  +---------------------------------------------+
| [<]              ✦3 (★ 12)   |  | [<]      | ● ● ◉ ○ ○ ○ ○ ○      ✦3 (★ 12)    |
|       ● ● ◉ ○ ○ ○ ○ ○        |  |          | +--------------------------+     |
| (Emma ) +------------------+ |  | ( Emma ) | | One plus two. How many?  |     |
| (22% h) | One plus two.    | |  | ( col  ) | +--------------------------+     |
| (≥120 ) | How many?        | |  | ( 24% w) |       1 + 2 = ?    (56 pt)       |
|         +------------------+ |  |          |       ●   ● ●      (24 pt)       |
|        1 + 2 = ?   (72 pt)   |  |          |   [ 10 ]  [ 1 ]  [ 3 ]  (72)     |
|        ●   ● ●     (24 pt)   |  +---------------------------------------------+
|   [ 10 ]   [ 1 ]   [ 3 ]     |
|   88 pt, 32 above safe btm   |
+------------------------------+
```

- **Portrait HUD has two rows** on a phone. Row 1: back, then streak and stardust on the right. Row 2: problem beads at 12/14/16 pt (web 18/22/24). The web's one-row HUD is ~450 pt wide (its bead track alone is ~232 pt), and the floor gives 343 pt of content width.
- Portrait: chips are anchored to the bottom (thumb zone), and the equation + dots block sits centred between the ribbon and the chips.
- Landscape: Emma's column is clamp(120, 24% of safe width, 200) pt. The back arrow is at the top of that column with Emma below it. The HUD is one 44 pt row across the right pane.
- Landscape height budget, worst case (dots in two rows): 8+44+8+50+12+60+8+48+16+72+16 = **342 pt**, which fits 375 minus a home-indicator inset.
- **Chip size** = clamp(72, the largest size that fits n chips with 16 pt gaps in width and height, 88). This holds for 3 or 4 chips on the 343 pt floor.
- **Counting dots:** 24 pt when the total is 10 or less, 20 pt above 10. A group that doesn't fit on one row wraps into rows of 5 (fives can be seen at a glance) rather than shrinking. Gaps are 8 pt inside a group and 24 pt between groups.
- No app chrome may overlap the ribbon. The round gear in the spike screenshots is not app code: `git grep` finds no gear in the spike's `mobile/`. _Hypothesis:_ it is Expo Go's dev-tools button.

**Splash:** silent, no skip, the cream `#FFF5F0` that already matches the OS launch screen (`mobile/app.json` `backgroundColor`), so there is no white flash from the OS splash to Splash to Greet.

## Acceptance criteria (Jessica, on device)

- [ ] Cold first launch: no audio before the first tap. A tap anywhere in the safe area starts "Hi!" within 250 ms. If there's no tap for 8 s, the nudge fires once.
- [ ] Greet ribbon: hidden until line 1 starts. After line 4 it keeps showing "Tap the heart when you're ready." while the heart waits (web renders `activeLine`). In the spike's Android screenshots 03 and 04 the ribbon is blank after all four lines.
- [ ] Rotating mid-Greet: Emma springs to her new frame. Audio, caption text, the Wake/intro state and the 20 s re-prompt timer all carry on; nothing restarts.
- [ ] Every text on Greet and Math renders in Fredoka on iOS and Android, at the sizes in § 2.
- [ ] With music playing in another app on the same device: it pauses at Emma's first line and stays paused between lines and through Math thinking time. After backgrounding the app, the session is released.
- [ ] Phone, both orientations, on a 375×667 device: the heart is ≥ 120×88, chips are ≥ 72×72 with ≥ 16 pt gaps, back is 56×56. Nothing is clipped and nothing overlaps the ribbon.
- [ ] Math with a total > 10 on a phone: the dots are ≥ 20 pt and a group wraps into rows of 5. They never shrink below 20 pt.
- [ ] Tablet (shorter side ≥ 600 pt): the layout matches the web Greet and Math.

## Open questions

None for Thomas. No new Dave consult is needed: call 1 reuses his reviewed Wake design, and calls 2–4 are platform calls. Marian's phone model is still open (plan § Open questions). It doesn't block, because the layouts are built to the 375×667 floor.
