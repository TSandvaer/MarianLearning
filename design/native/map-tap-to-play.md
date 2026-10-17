# Map: tap a stop to play (native)

**Ask (Thomas, 2026-10-17, verbatim):** "if i click on an island that is unlocked on the map it should jump in to (number garden for example) and start the questions".

**Changes:** `map-native.md` § 6 (an open, mastered or current stop says its name) and § 7 (the return).

**Keeps:** `fast-track-native.md` § 6, where later stops peek. The replay of a mastered stop reuses the peek's rules (§ 6.5).

**Pedagogy:** Dave confirmed D1–D4 on 2026-10-17 (§ 8).

## Goal

A tap on a stop she has reached starts its questions straight away. The Map becomes a second door into the session, next to the Hub card.

## User state entering

She is on a world's Map, after the open line or a peek, with no unlock beat running. She taps a stop that is current or mastered.

## 1. What each tap does

- **Current stop:** it starts **exactly the Hub card's session** for that world, through the same `sessionPlanKind` call (D1):
  - warm-up hearts if this is her first session in that world today;
  - a review if today's flower is asleep;
  - otherwise the scored 8.
  - It records what that session records today. There is no map line; the session opens as it does from the Hub.
- **Mastered stop** (every stop before the current one): it starts a **replay** under the peek's rules (D2, § 3).
  - That step's 8 canon problems, with "Let's play <name> again!" first and "You know <name>!" at the end.
  - It writes nothing, then returns to the Map.
- **A later stop** (open or locked): a 3-problem peek, unchanged.
- **A gate:** its land line, unchanged.
- **A complete world:** every stop is mastered, so every tap is a replay.
- **"Island" = a stop** (Q1).

There is **no gate on replays** (D3): a stop that only sometimes plays would be unpredictable.

## 2. The transition (Map → session)

1. **Press-in:** the sticker scales 1 → 0.94 (120 ms, `PRESS_MS`). The start fires on release (`Pressable` `onPress`), so a drag that scrolls the phone-landscape pane never starts anything.
2. **Release:** the line in flight is cut, and the sticker pops 0.94 → 1.08 → 1 (spring 300 / 14). The **launch lock** starts: every stop, gate and Home tap is ignored until the route changes.
3. **About 200 ms after the release:** the route changes to Math or Word Song. The Map fades out (its `FadeOut` 200 ms), and the screen enters with its own existing entrance.
4. **Request:**
   - The current stop sends exactly the Hub card's request. The Hub's prefetch is used only when it matches; otherwise the screen shows `GettingReady`.
   - A replay sends the replay request (§ 3).
5. **Failure:**
   - The current stop gets the session's existing fallback, as from the Hub.
   - A replay gets the peek's failure path: the stop's name line plays (`path.stop.<node>`), and taps resume.

Reduce Motion: no press scale and no pop; a 200 ms fade. No haptics.

## 3. The replay (mastered stop), under the peek's rules

- **Request:** a new `replay?: { node }` on the session-start track payload. It runs on the peek's responder in `api/_review.ts`: step 0, before the canon lookup, the session cache and the rate limiter.
  - It copies that step's canon problems 1–8 with their baked audio, in canon order, and returns plan id `replay-<track>`.
  - No Anthropic call, no TTS, no cache write. A bad node returns 400.
- **Screen:** Math or Word Song gets `peek: true` (the peek's HUD):
  - the back button and an 8-bead track;
  - no stardust pill, no streak, no warm-up;
  - subitising scaffolds and cross-vowel off.
- **Opener:** `guide.session.replay-open.<node>`, "Let's play <name> again!", plays in the peek opener's slot. The stage fades in at its end, and the read follows 400 ms later.
- **Problems** run as in a peek: right, wrong, the hint at 2 wrongs and the given answer at 3. Never a red X.
- **Close:** when problem 8 resolves, 400 ms → `guide.session.replay-close.<node>`, "You know <name>!" → 400 ms → back to the Map. **No Session End.**
- **Writes nothing** (`fast-track-native.md` § 6.5): no history, flower, good or secure day, pace guard, Leitner, stardust or streak. The persisted progress JSON is byte-identical before and after. The next real session still gets its warm-up (D3).

## 4. Where Back and the end go

The session route gets `origin: 'hub' | 'map'`. Hub-started sessions don't change.

- **Back, mid-session (any Map start):**
  - It returns to the Map of the same world at once.
  - No line plays, and every stop is tappable (the peek return, § 6.4).
  - Nothing is written.
- **Current-stop session, Session End's "All done":**
  - It returns to the Map of the same world, with no open line, because Emma has just spoken. Today's new bud is on its tray.
  - A pending unlock plays its beat, as today.
- **Replay end:** it returns to the Map after the closer (§ 3), the same quiet arrival.
- **Map's Home** still goes to the Hub.

**Why the Map:** she left from there, and the Hub is one Home tap away.

## 5. Accidental taps

- **No confirm step.** Thomas asked to "jump in", and a confirm would need reading or a second, unexplained tap.
- **The protections:**
  - start on release, never on a drag;
  - the launch lock;
  - taps wait for the unlock beat's cheer (unchanged);
  - a stop tap within 400 ms of the Map mounting is ignored.
- **A mistake costs one tap.** Back returns at once, and a quit session or a replay writes nothing.

## 6. New lines (for Thomas, T1)

Both sets cover the 30 steps of `STAGE_SPOKEN_NAMES` (13 Number Garden, 17 Word Song), because every step can become mastered. `<name>` is the stop's spoken name, and the kinds are `'session-replay-open'` and `'session-replay-close'`.

| Set                                 | Template                   | Lines  | Lily characters |
| ----------------------------------- | -------------------------- | ------ | --------------- |
| `guide.session.replay-open.<node>`  | "Let's play <name> again!" | 30     | 916             |
| `guide.session.replay-close.<node>` | "You know <name>!"         | 30     | 676             |
| **Total**                           |                            | **60** | **1,592**       |

- **The 30 names:** numbers; adding to ten; adding to twenty; taking away to ten; taking away to twenty; big numbers; making tens; skip counting; groups of two, five and ten; groups of three and four; big groups; all the groups; sharing; letter names; letter sounds; blending sounds; cat, dog, sun, pig, bed, ship, chick, thumb and star words; reading sentences; duck, crab, tent and cake words.
- **Range:** the shortest is "You know numbers!" and the longest "Let's play groups of two, five and ten again!" (45 characters).
- **New words:** none. _play_, _again_ and _know_ are in use ("Let's play the ones you know!", "Hmm... try again?").
- **How it was counted:** a scratch script over `STAGE_SPOKEN_NAMES` on main, 2026-10-17.
- **Framing (D4):** the replay closer praises what she knows. No Emma line anywhere suggests a replay.

## 7. Acceptance criteria

**Jest:**

1. A current-stop tap routes with `origin: 'map'` and the same `sessionPlanKind` result the Hub card produces for the same progress.
2. **A mastered-stop tap** sends `replay: { node }`:
   - The screen runs 8 problems with the opener and closer of § 6, then routes to the Map. No Session End mounts.
   - The progress JSON is byte-identical before and after. No stardust is granted.
3. Later stops still peek, and gates still say their land.
4. **The launch lock:** taps during a launch change nothing, and exactly one route change happens.
5. **Ignored taps:** within 400 ms of mount, and before the unlock beat's cheer.
6. Back from either Map start returns to the Map silently. "All done" after a current-stop session returns to the Map, or plays the pending unlock beat. Hub starts still return to the Hub.
7. **Server:** a `replay` request returns `replay-<track>` with the canon's P1–P8 texts and audio, and makes no Anthropic or TTS call. A bad node returns 400.
8. **Core:** `GUIDANCE_LINES` holds both 30-line sets with the exact texts, one per `STAGE_SPOKEN_NAMES` key.

**Device (iPad portrait, phone landscape):**

9. Tap Number Garden's current stop: the questions start, with no Hub between. The stop pops, and the Map fades.
10. **Tap a mastered stop:**
    - "Let's play <name> again!", then 8 problems, with no stardust pill.
    - Then "You know <name>!" and the Map, with no Session End.
11. In phone landscape, a drag on the path scrolls without starting anything.

## 8. Pedagogy (Dave, confirmed 2026-10-17)

- **D1. The current stop is exactly the Hub's session**, through the same `sessionPlanKind` call: warm-up hearts on the day's first session, a review if today's flower is asleep, otherwise the scored 8.
- **D2. A mastered stop runs that step's 8 canon problems under peek rules.**
  - Nothing records: no history, flower, good or secure day, pace guard, Leitner, stardust or streak.
  - No stardust pill and no Session End.
  - Emma closes with "You know <name>!", and she returns to the Map.
- **D3. Nothing is bypassed, and there is no gate.** A replay writes no history, so the next real session still gets its warm-up.
- **D4. The avoidance guard:**
  - A replay never pays more than the current step: zero stardust, and flowers only from the current step.
  - No caps, countdowns or badges, and Emma never suggests a replay.
  - **Documented option, not built:** if Thomas later sees her replaying instead of doing her flower step, mastered stops play only after today's flower (`earnedToday`, #565 D1). A mastered-stop tap before that would say its name, as today.

## 9. Open questions (for Thomas, via Matt)

- **T1. The 60 lines in § 6.** Recommendation: approve the two templates.
- **Q1. "Island" = a stop.** If he meant a land, a gate tap would start that land's current or last mastered step. Recommendation: stops, as specced.
