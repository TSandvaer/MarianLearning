# Map: tap a stop to play (native)

**Ask (Thomas, 2026-10-17, verbatim):** "if i click on an island that is unlocked on the map it should jump in to (number garden for example) and start the questions".

**Changes:** `map-native.md` § 6 (an open, mastered or current stop says its name) and § 7 (the return). **Keeps:** `fast-track-native.md` § 6 (later stops peek). Pedagogy is pending Dave (D1–D5).

## Goal

A tap on a stop she has reached starts that step's questions straight away. The Map becomes a second door into the session, next to the Hub card.

## User state entering

She is on a world's Map, after the open line or a peek, with no unlock beat running. She taps a stop that is current or mastered.

## 1. What each tap does

| Tapped                                                | Today                    | New                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Current stop**                                      | says its name            | **Starts the session the Hub card would start for this world** (`sessionPlanKind`): forward with its warm-up, or the review when today's flower sleeps (D1). |
| **Mastered stop** (every stop before the current one) | says its name            | **Starts a replay of that step** (D2, D3): its own problems, with the opener "Let's play <name> again!".                                                     |
| **A later stop** (open or locked)                     | peek                     | **Unchanged:** a 3-problem peek that writes nothing.                                                                                                         |
| **Gate**                                              | "Land {n}: {land name}." | Unchanged.                                                                                                                                                   |
| **Complete world**                                    | says its name            | Every stop is mastered, so every tap is a replay. The last stop is that step's replay too, not the Hub's complete-world session.                             |

- **"Island" = a stop.** The stops are the round stickers on the path that she taps; a land isn't a playable unit. Open question Q1.
- **A stop's name now plays only through the session.** The current-stop session opens as from the Hub (warm-up "Remember this one?", the step intro, or the read). A replay opens with "Let's play <name> again!", which names the stop she chose. On the Map itself the tap says nothing.

## 2. The transition (Map → session)

1. **Press-in:** the stop's sticker scales 1 → 0.94 (120 ms, `PRESS_MS`, the Home button's timing). It starts on release (`Pressable` `onPress`), so a drag that scrolls the pane in phone landscape never starts a session.
2. **Release:** the line in flight is cut. The sticker pops 0.94 → 1.08 → 1 (spring 300 / 14). Every other stop, gate and Home tap is ignored from now on (the launch lock).
3. **About 200 ms after the release:** the route changes to Math or Word Song with that session's request. The Map fades out (its existing `FadeOut` 200 ms), and the session screen enters with its own existing entrance, unchanged.
4. **The request:** the current stop sends exactly what a Hub card tap sends. A replay sends the replay request (D2). The Hub's prefetch is used only when it matches the request; otherwise the screen shows `GettingReady` as for any cold start.
5. **The request fails** (network, 400, a bad plan): the session's existing fallback, the same as from the Hub. The Map never retries.

Reduce Motion: no press scale and no pop; a 200 ms fade. No haptics (`map-native.md` § 4).

## 3. Where Back and Session End go

The session remembers where it was started: a new `origin: 'hub' | 'map'` on the session route. Hub-started sessions are unchanged.

| From a Map-started session         | Goes to                       | The Map on arrival                                                                                                                                         |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back button, mid-session           | **The Map of the same world** | No line plays, the caption is empty, every stop is tappable (the peek return, `fast-track-native.md` § 6.4). Nothing is written (quitting writes nothing). |
| Session End, "All done", no unlock | **The Map of the same world** | No open line (Emma has just spoken). Today's new bud is already on its tray.                                                                               |
| Session End, "All done", unlock    | The Map (as today)            | The unlock beat plays, as today.                                                                                                                           |
| Map's Home                         | Hub (unchanged)               | —                                                                                                                                                          |

**Why back to the Map:** she left from there, so Back means "where I was". The Hub is one Home tap away.

## 4. Accidental taps

- **No confirm step.** Thomas asked for "jump in", and a confirm would need reading or a second, unexplained tap.
- **The protections:**
  - start on release, never on a drag (§ 2.1);
  - the launch lock (§ 2.2);
  - taps wait for the unlock beat's cheer (`map-native.md` § 4, unchanged);
  - a stop tap within 400 ms of the Map mounting is ignored, which catches the tail of the tap that opened the Map.
- **The cost of a mistake is one tap.** Back returns to the Map at once, and a session quit midway writes nothing.

## 5. Copy / TTS script

- **New:** one replay opener per step, `guide.session.replay.<node>`, kind `'session-replay'`, text **"Let's play <name> again!"**. `<name>` is `STAGE_SPOKEN_NAMES`, the same name the path lines use.
  - It plays in the opener slot (the review and peek opener mechanism: the stage stays empty, fades in at its end, and the read follows 400 ms later).
  - **30 lines** (every step can become mastered: 13 Number Garden, 17 Word Song), **916 characters** for Lily. Counted with a scratch script from today's `STAGE_SPOKEN_NAMES` on main.
  - Examples: "Let's play adding to ten again!", "Let's play cake words again!". The longest is "Let's play groups of two, five and ten again!" (45 characters).
- **New words:** none. _play_ and _again_ are in use ("Let's play the ones you know!", "Hmm... try again?").
- **Reused:** everything else. The current-stop session's lines are the Hub session's. Session End uses its existing lines (D4).
- **Not added:** no map-side line on a play tap.

## 6. States and edge cases

- **Current stop while today's flower sleeps:** the same as the Hub. A review, or same-step practice when the pool is empty (D1).
- **Current stop on a sleeping-flower day with the pace hold, the fast track or `crossDayEnforcement` off:** whatever `sessionPlanKind` and the Hub do today. The Map adds no rule.
- **Baseline stops** (`number-recog`, `letter-names`, mastered from the diagnostic): replayable like any mastered stop (D5).
- **A mastered stop tapped before today's first session:** allowed (D3).
- **The prefetch** (`hub-native.md` § 5) belongs to the Hub's suggested world. A Map tap in the other world, or on a replay, doesn't use it.
- **Mid-launch background:** the route change is already committed, so the session screen handles it as today.
- **Rotation during the press-in:** the tap still lands, because Pressable keeps it.

## 7. Acceptance criteria

**Jest (native):**

1. A tap on the current stop routes to that world's session with `origin: 'map'` and the same `sessionPlanKind` request the Hub card sends for the same progress.
2. A tap on a mastered stop routes with the replay request for that node (D2), and the session opens with `guide.session.replay.<node>`.
3. A tap on a later stop still starts a peek. A gate still says its land line.
4. **The launch lock:** a second tap within the launch ignores both stops and Home, and only one route change happens.
5. **Ignored taps:** a tap within 400 ms of the Map mounting, and a tap before the unlock beat's cheer.
6. Back from a Map-started session returns to the Map with no open line, and the persisted progress JSON is byte-identical to before the session.
7. "All done" after a Map-started session returns to the Map; with a pending unlock, the beat plays. Hub-started sessions still return to the Hub.
8. **Core:** `GUIDANCE_LINES` holds the 30 replay openers with the exact texts, and every `STAGE_SPOKEN_NAMES` key has one.

**Device (Expo Go, iPad portrait plus a phone in landscape):**

9. Number Garden Map → tap the current stop → the questions start, with no Hub in between. The stop pops on press, and the Map fades.
10. Tap a mastered stop → "Let's play <name> again!", then that step's first problem.
11. In phone landscape, a drag on the path pane scrolls without starting anything.
12. Back mid-session → the Map, silent. A finished session → the Map with the new bud.

## 8. Pending Dave (D-items, relayed by Matt)

- **D1. Current stop = the Hub card's session**, including the review when today's flower sleeps. It records exactly what that session records today.
- **D2. What a replay contains.** Proposal: the step's 8 canon problems, rotated by the session seed as reviews are, with no warm-up. Dave may prefer the review's Leitner-weighted pick from that one step.
- **D3. What a replay records, and the order.** Proposal: what a review records (`review-mode-and-warmup-native.md` § 7.6: Leitner and `lastPlayedISO` only). No history entry, so it can't earn a flower or a good day, and it never takes the day's "first session" from the warm-up. Allowed before today's forward session. The alternative is to open mastered stops only after today's flower (the "review-first order"). Dave's call.
- **D4. Replay Session End:** the practice-day end ("You practised hard! Good work!", the sleeping flower or the tray as it is). It never celebrates a new flower.
- **D5. Baseline steps are replayable from the Map,** although reviews never pick them.

## 9. Open question

- **Q1 (for Thomas, via Matt): "island" means a stop.** If he meant a land (a band or gate), say so: a gate tap would then start the land's current, or last mastered, step. Recommendation: stops, as specced.
