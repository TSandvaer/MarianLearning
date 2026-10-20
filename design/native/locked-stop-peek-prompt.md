# Locked-stop peek prompt (native)

**Scope:** `@marian/core` (two guidance lines) and the native Map (`mobile/src/screens/map/`, `mobile/src/layout/mapScreenLayout.ts`). The web is frozen. The peek itself (`fast-track-native.md` § 6.2–6.5) does not change.

**Thomas, 2026-10-20 (verbatim):** "I think the peaking need to be tweaked. I would like emma to say the name of the stop and that it is locked, then ask if you want to try it out and present a button."

## Goal

Today a tap on a later stop starts its peek at once (`fast-track-native.md` E1, § 6.1; `stopTapAction` → `'peek'` → `useMapVisit.startPeek`). After this change:

1. Emma names the stop and says it is locked.
2. She asks "Want to try it?", and a button appears.
3. A tap on the button starts the same peek as today. Any other tap, or waiting, starts nothing.

## User state entering

The child is on the Map (from the Hub's map button, Session End's "All done", or back from a peek, replay or session). She taps a stop after her current one. It is pale and wears a padlock (`map-native.md` § 3, the locked sticker). She may be exploring alone, without a parent.

## 1. Which taps change

| Tap                                                    | Today                  | After                                                                           |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------- |
| Later stop, **locked** (`state: 'locked'`, peekable)   | Peek starts            | **Prompt** (§ 2): name + "This one is locked. Want to try it?" + button         |
| Later stop, **open** (`state: 'open'`, peekable; rare) | Peek starts            | **Prompt** (§ 2) without the locked sentence: name + "Want to try it?" + button |
| Current stop                                           | Starts the Hub session | Unchanged                                                                       |
| Mastered stop                                          | Replay                 | Unchanged                                                                       |
| Gate                                                   | Its land line          | Unchanged (it also closes an open prompt, § 4)                                  |

- **Why the open case too:** `isPeekableStop` also admits a later stop that is not locked (for example after a parent sets a level). It must not say "locked", but it should behave like its neighbours. One rule for every peek: Emma asks first.
- **No new map rule in core:** `stopTapAction` still returns `'peek'`. Only what the native tap does with `'peek'` changes.

## 2. The prompt

```
tap locked stop
  └─ line in flight cut
     ├─ caption: "<Name>. This one is locked. Want to try it?"   (from t = 0)
     ├─ clip 1: path.stop.<node>             "<Name>."          (shipped, baked)
     │    └─ 250 ms
     ├─ clip 2: guide.map.peek-ask.locked     "This one is locked. Want to try it?"
     │    └─ the button fades in as clip 2 starts
     └─ silence. The button stays until a tap elsewhere, Home, or back.
```

- **Clip 1 is the shipped name line** `path.stop.<node>` ("Moon words."). All 42 later steps have it baked (16 Number Garden, 26 Word Song, checked against `public/assets/audio/path/` on 2026-10-20).
- **Clip 2 is one new shared line** for every stop (§ 3). It names nothing, so it is not a name + carrier splice inside one sentence. It is two whole sentences played back to back.
- **The 250 ms gap** matches the beat between two separate sentences. T1 asks Thomas to hear the pair.
- **Caption:** one slab with both sentences, shown from the tap (the map shows a whole line at once, `map-native.md` § 6). It is keyed `peek-ask.<node>`, so a second stop's prompt re-enters it.
- **Button timing:** it fades in when clip 2 starts (about 1 s after the tap), so it arrives with the question that explains it. If clip 1 fails or has no file, the button appears when clip 2 would start (the player resolves at once, `PathLinePlayer.play`).
- **Emma:** her badge stays in its rest pose. There is no poof, wiggle, pointing tilt or padlock motion (E2, `fast-track-native.md` § 9).
- **Sequencing guard:** `PathLinePlayer.play` also resolves when it is cancelled. Clip 2 and the button start only if this prompt is still the open one (a token or ref per prompt, like `peekRef`).

### 2.1 Why not reuse the `path.locked.*` lines

`path.locked.next.<node>` ("Moon words! First, snail words. Then this!") is baked for all 42 later steps, and was the obvious candidate. The team recommends against it:

- It never says "locked", which is what Thomas asked for.
- It is only true for the stop right after the current one. For a stop two or more ahead it names the wrong step (`stopLine` uses the `later` form there).
- Its `later` form, `path.locked.later.<stop>.<current>` ("<Name>! Not yet. First, <step>."), is 111 lines and was never rendered (`DEFERRED_PATH_LINE_KINDS`, `src: null`).
- "First, snail words" points her at another step, and then "Want to try it?" points her at this one. That is two directions in one breath.

The name line plus one shared line says exactly Thomas's two facts, works for every stop, and costs one short render.

## 3. Copy / TTS script

Both lines go in `GUIDANCE_LINES` (`packages/core/src/emmasPath/guidanceLines.ts`) and play from `pathLineSrc(id)` through the map's player (`createPathLinePlayer(…, 'map')` takes a guidance line as is).

| ID                          | Kind                  | Text                                  | Where it plays                        | Lily characters |
| --------------------------- | --------------------- | ------------------------------------- | ------------------------------------- | --------------- |
| `guide.map.peek-ask.locked` | `map-peek-ask-locked` | "This one is locked. Want to try it?" | Map, after a locked later stop's name | 35              |
| `guide.map.peek-ask`        | `map-peek-ask`        | "Want to try it?"                     | Map, after an open later stop's name  | 15              |
| **Total**                   |                       |                                       |                                       | **50**          |

- **Reused, not new:** `path.stop.<node>` for the name (42 lines, all baked). The peek's opener and closer (`guide.session.peek-open/close.<step>`) are unchanged.
- **One shared line, not 42:** a per-stop whole line ("Moon words are locked. Want to try it?") would be 42 renders and need each name's verb. The shared line plus the name line says the same thing.
- **"This one", not "it is":** "Cat words. It is locked." stumbles on plural names. "This one" refers to the stop she tapped and needs no verb agreement. "this one" is already common in Emma's speech.
- **Vocabulary** (scan of `PATH_LINES`, `GUIDANCE_LINES` and `public/canon/*/level-1/*.json` texts, 2026-10-20):
  - **locked** is new; it is Thomas's word and names the padlock she sees.
  - **want** is in "Both flowers are sleeping. Want to practise more?", which is the same question shape. **try** is in "Hmm... try again?".
- **Render:** `scripts/renderGuidanceLinesLily.ts`, then `npm run export-audio` in `mobile/`, then add both to the guide list in `public/voice-qa.html`. No special Lily input is expected.
- **Prediction for the soak (falsifiable):** "This one is locked. Want to try it?" lands at about 2.2–2.6 s with a clear rising "try it?". "Want to try it?" is about 1.0–1.3 s. Neither trips the 3.5 s flag. The 250 ms gap after a name line sounds like one sentence ending and a new one starting, not like a stitched clip.
- **Not tested by that prediction:** how the pair sounds after the longest name ("Groups of two, five and ten."). T1 includes that pair.

**Button label (accessibility only; nothing is printed on the button):**

| Where                | Text     |
| -------------------- | -------- |
| `accessibilityLabel` | "Try it" |

**Danish version:** the 3 strings above (2 lines, 1 label) are the whole new copy. The name comes from the existing name lines, so a Danish version adds 2 renders and 1 label, plus whatever its own name lines need.

## 4. The button

**Look:** a round green clay button: `ClayButton`'s `go` palette (the "All done" green: face `#7fd364 → #5cb945`, slab `#3f8a2e`), its slab, highlight and press sink (9 pt × size / 112 over 120 ms).

- **Face:** the tapped stop's sticker in full colour (`PathImage` with the stop's id, 70 % of the button), with a small white play triangle in a green disc at its lower right (28 % of the button).
- **No text** on the face: the caption already says "Want to try it?", and the sticker says which stop.
- **Why full colour:** the button is the way in. The pale locked copy stays on the map.

**Size and place** (the caption slot is reserved from mount, so the path never moves):

| Form                      | Button    | Where                                                                                                                 | Caption slab                    |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **P** (phone portrait)    | 72 × 72   | Right end of the caption slot (124 tall), vertically centred                                                          | The slot's width minus 72 + 10  |
| **L** (phone landscape)   | 72 × 72   | Right end of the caption slot (72 tall)                                                                               | The slot's width minus 72 + 10  |
| **W** (tablet portrait)   | 112 × 112 | Right end of the caption slot (128 tall), vertically centred                                                          | The slot's width minus 112 + 14 |
| **TL** (tablet landscape) | 112 × 112 | The left column, centred, its bottom 24 pt above the caption slot (the column is free between the title and the slot) | Unchanged                       |

```
P (375×667)                         W (iPad portrait)
| path …                       |    | path …                                        |
|------------------------------|    |-----------------------------------------------|
| [🔊 Moon words. This  ] (🌙▶)|    | [🔊 Moon words. This one is locked.  ]  (🌙▶) |
| [  one is locked. Want]      |    | [   Want to try it?                  ]        |
| [  to try it?         ]      |    |-----------------------------------------------|
```

- **Fit check (an estimate, not a measurement):** P with the button gives the caption about 191 pt of text width at 22 pt. The longest prompt, "Groups of two, five and ten. This one is locked. Want to try it?" (64 characters), should take 4 lines, which is the slot's limit. AC 9 measures it. If it overflows at 375×667, the prompt caption drops to 20 pt in P only.
- **Hit area:** the visible button, at least 72 × 72 on phones, so no slop is needed. It sits in the caption row, never over the path, so it never covers a stop.
- **Motion:** fade in, 200 ms, `EASE_OUT`, plus y 8 → 0 (the caption's entrance). Out: fade 150 ms. Reduce Motion: the fade only.
- **Press:** the press sink, then on release the button fades out and `startPeek(stop, peek)` runs exactly as today (the line is cut, the request goes out, stop and gate taps wait, Home cancels).

## 5. Saying no, and waiting

| What she does                            | What happens                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Taps the button                          | The peek starts (§ 4), unchanged from today's tap.                                                                      |
| Taps the **same** stop again             | The prompt restarts (both clips, the button hides and re-appears with clip 2). A second tap is never a "yes".           |
| Taps **another later** stop              | That stop's prompt replaces this one.                                                                                   |
| Taps the current stop or a mastered stop | The prompt closes and that tap does what it does today (session or replay).                                             |
| Taps a gate                              | The prompt closes and the gate says its land.                                                                           |
| Taps empty map (path pane, not a stop)   | The prompt closes silently. The line in flight is cut and the caption clears.                                           |
| Home                                     | Hub, as today.                                                                                                          |
| Android back                             | Closes the prompt (the platform's "close the open thing first"). A second back goes to the Hub as today.                |
| Waits                                    | Nothing. Emma does not repeat the question, nothing pulses or counts down, and the button stays until one of the above. |

- **No re-ask and no timeout:** a repeated question or a timer would be pressure to say yes, which E2 rules out ("Emma never asks her to keep playing or to come back").
- **Closing writes nothing,** like the peek.

## 6. Edge cases

- **A tap during the unlock beat, the launch lock or a peek request:** ignored as today (`ignoredBecause`). No prompt opens.
- **A tap within `MAP_TAP_ARM_MS` of mount:** ignored as today.
- **The peek fails** after the button: today's failure path (`path.stop.<node>` plays and taps resume). The prompt does not come back by itself.
- **Back from a peek** (`quietReturn`): the map opens quiet and no prompt is open.
- **The app goes to the background with a prompt open:** the line parks and resumes as today (#528). The button stays.
- **Phone landscape scroll:** the button is in the caption row, outside the scrolling pane, so it never scrolls away. Scrolling the pane does not close the prompt.
- **A complete world:** no later stops, so no prompt.
- **Map tap-to-play § 5 said "No confirm step"** for the current and mastered stops, because a confirm "would need reading or a second, unexplained tap". Those stops keep no confirm. Here the second tap is explained by Emma's spoken question, and nothing needs reading.

## 7. Build split (Devon)

One build PR after the render, or two small ones. Order: lines first, so the ear test runs while the Map work is built.

1. **Core + audio (PR A):** the two lines and kinds in `GUIDANCE_LINES`, a `peekAskLine(stop): GuidanceLine` helper (locked → `peek-ask.locked`, open → `peek-ask`), the Lily render (50 characters), `npm run export-audio`, and the voice-QA list. Thomas's ear test (T1) gates PR B's device check, not its build.
2. **Native Map (PR B):**
   - `useMapVisit`: a `prompt` state (`{ node } | null`) and `openPrompt(stop)`, which plays the two clips with the per-prompt guard and reveals the button at clip 2. `tapStop`'s `'peek'` branch opens the prompt instead of `startPeek`. A new `tapPeekButton()` calls `startPeek`. `tapGate`, other stop taps, a pane tap and Android back close it.
   - `mapScreenLayout`: a `peekButton: Rect` per form and the narrowed caption slot while a prompt is open (§ 4).
   - `MapScreen` / `mapChrome`: the round button (`ClayButton` look, round, sticker face) with `testID="map-peek-button"`.
   - `mapTapLog`: the path `'peek'` becomes `'peek-ask'`, and the button logs `'peek'`.

## 8. Acceptance criteria

**Jest (core):**

1. `GUIDANCE_LINES` holds `guide.map.peek-ask.locked` = "This one is locked. Want to try it?" and `guide.map.peek-ask` = "Want to try it?", with the kinds of § 3 and `src = pathLineSrc(id)`.
2. `peekAskLine` returns the locked line for a locked stop and the plain one for an open later stop.
3. `stopTapAction` is unchanged (the existing tests still pass untouched).

**Jest (native, `MapScreen.peek.test.tsx` and `useMapVisit`):**

4. A tap on a locked later stop plays `path.stop.<node>` and then `guide.map.peek-ask.locked`, in that order. No peek request goes out, and the caption reads "<Name>. This one is locked. Want to try it?".
5. `map-peek-button` is absent until clip 2 starts, and present after.
6. Pressing the button starts exactly today's peek: the line is cut, `onPeek(node, signal)` is called once, and a stop tap while it is out is ignored.
7. A tap on another stop, a gate or the empty pane, or Android back, closes the prompt (button gone, no `onPeek`). A tap on the same stop restarts the prompt and never calls `onPeek`.
8. Cancelling during clip 1 (any close) never starts clip 2 and never shows the button.
9. **Layout:** at 375×667, 667×375, 820×1180 and 1180×820, the button rect is inside the safe rect, overlaps no stop's hit area and no caption text. At 375×667 the prompt for `mult-2-5-10` ("Groups of two, five and ten. …") fits its slab without clipping.
10. With no taps for 30 s after the prompt, nothing else plays and the button is still there.
11. The persisted progress JSON is byte-identical after a prompt that was closed without a peek.

**Device (iPhone + iPad, both orientations):**

12. Tap a locked stop: Emma says its name, then "This one is locked. Want to try it?", and the button appears as she asks. The button tap opens the peek, which plays as before (opener, 3 problems, closer, back to the Map).
13. Tap a locked stop, then tap empty map: the prompt closes, nothing starts.
14. The button shows the tapped stop's sticker and is reachable with a thumb in every form. Nothing on the map moves when it appears.

## 9. For Thomas (T-items)

- **T1. The lines.** Team recommendation: approve as written.
  1. "This one is locked. Want to try it?" (after the stop's name, for example "Moon words." + 250 ms + this line)
  2. "Want to try it?" (the same, for a later stop that is open; rare)
  - Ear test on `/voice-qa.html` after the render, including the pair after the longest name, "Groups of two, five and ten."
- **T2. The button look.** Team recommendation: a round green clay button (the "All done" green) with the tapped stop's sticker and a small white play triangle, no text, at the right end of the caption row (tablet landscape: in the left column above the caption). 72 pt on phones, 112 pt on tablets.

## 10. For Dave (D-items)

- **D1.** Is a confirm step right for a 6–9-year-old exploring the Map alone, given that the question is spoken and the button shows the stop's own picture?
- **D2.** Does asking first dampen curiosity compared with today's tap-and-go? Today's tap-to-play spec (§ 5) rejected a confirm for her own and finished stops; this one is only for stops she has not reached.
- **D3.** Does "This one is locked" followed by "Want to try it?" teach that a lock means nothing? The peek's closer ("<Name> is for later. You will learn it!") is the team's answer; we would like his read.
