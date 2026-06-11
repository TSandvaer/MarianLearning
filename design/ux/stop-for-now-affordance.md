# Stop-for-now affordance

**Author:** Marian Tutor design persona — ticket `86ca7urx1`.
**Consumers:** Kevin / Devon (impl), Jessica (QA), Thomas (taste, via Matt).
**Status:** Spec — implementable. Markdown-only PR.
**Surface:** iPad portrait PWA, home-screen installed. Math (`route === 'math'`) + Word Song (`route === 'literacy'`).
**Pedagogy gate:** Dave PROCEED ruling 2026-06-11 (ticket comment). His five binding constraints are restated in §0 and traced through every section.

This file is the canonical spec for a **voluntary mid-session "I want to stop now" affordance**. It is the deliberate follow-up to `design/mid-session-resume.md`, which explicitly scoped this out ("Session pause / explicit 'save and quit' UI … no in-app affordance for it" — that doc §"Out of scope"). It does **not** change the resume contract, the full-completion SessionEnd, or any progression semantics beyond the one new recording path flagged for Kevin in §6.

---

## 0. Dave's binding constraints (developmental-psychology ruling)

Every one of these is load-bearing. The spec traces each to the section that satisfies it.

| #   | Constraint                                                                                               | Satisfied in                       |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| C1  | Available **from problem 3 onward** (not before).                                                        | §3 (gate), §7 (states), §8 (AC)    |
| C2  | Emma's reaction is **non-punitive** — no disappointment, no guilt ("never a red X" extends to quitting). | §5 (TTS), §10 (dark-pattern audit) |
| C3  | Routes to a **partial-credit Session End** (stardust for completed problems), NOT a raw return to Hub.   | §4, §6                             |
| C4  | **Low visual prominence** — must not compete with problem UI or invite habitual tapping.                 | §2 (placement / treatment)         |
| C5  | **NO confirmation dialog** — one tap stops; a dialog is friction-as-dark-pattern.                        | §3 (one-tap), §10                  |

---

## 1. Goal

Give Marian a calm, one-tap way to end a session early when she's done for the day — and have Emma treat that choice exactly as warmly as finishing all eight problems. She keeps the stardust she earned, lands on a celebratory (not consolation) Session End, and never sees a "are you sure?" or a "you didn't finish" beat.

**This is not** a back-button to the Hub. The existing top-left HUD back-arrow (`data-testid="math-back-to-hub"` / `data-testid="wordsong-back-to-hub"`) returns to Hub silently with no celebration and no stardust beat. This affordance is different: it ends the session **the same way finishing does**, on the Session End screen, with partial credit. See §11 for the relationship between the two controls (one open question for Thomas).

---

## 2. Placement + visual treatment per screen

Constraint C4 (low prominence, no habitual-tap invitation) drives every choice here. The control is a **small "stop" pill anchored bottom-centre, inside the safe-area inset, below the answer chips' thumb arc** — deliberately NOT in the HUD next to the back-arrow (two exit controls side-by-side reads as an exit toolbar and invites tapping), and NOT in a corner thumb-rest where an idle thumb lands.

### 2.1 Shared treatment (Math + Word Song identical)

```
                          [ problem area / chips ]

         ( bottom thumb arc — primary answer chips live here )

                    ┌─────────────────────────┐
                    │   ▢  Stop for now        │   <- stop pill, bottom-centre
                    └─────────────────────────┘
                          [ safe-area bottom inset ]
```

| Property          | Value                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anchor            | Horizontally centred; bottom edge = safe-area-inset-bottom + 8pt.                                                                                                                            |
| Visible pill size | 132pt wide × 40pt tall, fully-rounded (`border-radius: 20pt`).                                                                                                                               |
| Touch target      | The `<button>` element is **132pt × 56pt** (vertical padding extends the hit-zone above the visible pill to clear the 44pt iOS-HIG floor with margin). Visible art stays 40pt tall.          |
| Fill / stroke     | No fill. 1.5pt stroke in `text-my-rose` at **45% opacity**. Label + glyph in `text-my-rose` at 60% opacity. This is the lowest-contrast interactive element on either screen by design (C4). |
| Glyph             | A small rounded "stop" square (filled rounded-rect, 14pt, same rose-60%), left of the label. NOT an X, NOT a door, NOT a power symbol — see §9 rationale.                                    |
| Label             | "Stop for now" — 17pt, weight 500. Text mirrors nothing Emma says on this screen; it is a read-target for an adult-or-Marian glance, consistent with text-mirror principle.                  |
| Below the chips   | The pill sits **below** the lowest answer chip's bottom edge with ≥ 16pt clearance, so a mis-aimed chip tap never lands on it and vice-versa.                                                |

### 2.2 Per-screen notes

- **Math** (`Math.tsx`): chips are a 2×2 grid (4 chips). The pill clears the grid's bottom row by ≥ 16pt. Anchor the pill in the same root flex column that holds the HUD + problem area; it is the last child, pinned bottom.
- **Word Song** (`WordSong.tsx`): chips are a 3-wide picture row. Same anchor rule; clear the picture-chip row's bottom edge by ≥ 16pt. Word Song's chips are taller (pictures), so verify the pill still clears the safe area on the shortest supported iPad portrait height (see §8 AC).

### 2.3 Entrance / dormancy (ties to C1 + C4)

- The pill does **not exist in the DOM** during problems 1 and 2 (C1 — not before problem 3). It is not rendered-but-hidden; it is not mounted. This guarantees it cannot be tapped early and removes it from the layout entirely for the first two problems.
- On problem 3's chip-reveal, the pill **fades in** (opacity 0 → 1, 250ms, no slide, no spring — a quiet appearance, not an arrival beat) **after** the problem's read-aloud + chip stagger have settled, so it never competes with the active problem entrance (C4). Suggested delay: pill fade-in starts at `chip-stagger-complete + 200ms`.
- Once mounted (problem 3 onward) it stays mounted for the rest of the session, including during puzzled-tilt / retry beats. It is never disabled mid-problem — an 8-year-old who decides to stop should not have to wait for a beat to clear (C5 spirit).

---

## 3. Interaction (one tap, no dialog)

```
Marian taps "Stop for now"  (only possible on problem ≥ 3)
        │
        ├─ synchronously cancel in-flight session audio (cancelSessionAudio())
        ├─ Emma → puzzled-tilt? NO. Emma → a gentle acknowledging beat (§5). Pose: `idle`→ soft nod, see §5.2
        ├─ build a PARTIAL SessionEndPayload from current session state (§4)
        └─ route to `session-end`  (NO confirmation dialog — C5)
```

- **One tap is terminal.** No "are you sure?", no second pill, no hold-to-confirm, no countdown. The tap immediately begins the stop transition (C5).
- **Gate (C1):** the tap handler is only reachable when `problemIndex >= 2` (0-based; problem 3 = index 2). Because the pill isn't mounted before then (§2.3), this is belt-and-braces, not the primary gate.
- **Audio cleanup:** mirror the existing back-arrow's `cancelSessionAudio()` call (Math.tsx back-arrow handler, `data-testid="math-back-to-hub"`) so no TTS bleeds into Session End.
- **Double-tap safety:** latch the handler so a fast double-tap fires the stop exactly once (reuse the once-latch pattern already used for `onSessionComplete`).

---

## 4. The partial-credit SessionEnd payload

The stop path reuses the **existing** `onSessionComplete` / `SessionEndPayload` contract — it does NOT add a new route or a new screen. The screen emits a normal payload built from **what Marian actually completed**, and Session End celebrates it unchanged. This keeps Session End's phase machine, audio, and persistence identical to a full completion (C3 — "routes to a partial-credit Session End", reusing the real one).

### 4.1 What the payload carries on a stop

`SessionEndPayload` is defined at `src/screens/SessionEnd/SessionEnd.tsx` (`interface SessionEndPayload`). On a stop, the screen fills it from session-to-date state:

| Field                                               | Value on stop                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totalCorrect`                                      | Count of problems **already settled correct** before the stop. Not 8.                                                                                          |
| `totalStardust` (math)                              | Math's running in-session stardust (already persisted per-correct to `marian-tutor.stardust.v1`) — i.e. exactly what she earned so far.                        |
| `earnedThisSession`                                 | Same in-session earned count math already tracks.                                                                                                              |
| `finalStreak`                                       | The streak value as of the stop.                                                                                                                               |
| `surface`                                           | `'math'` or `'word-song'` per screen, unchanged.                                                                                                               |
| `perProblemCorrect`, `latencyMs`, `mathFacts`, etc. | **Truncated to settled problems only** — the arrays carry entries for problems Marian actually reached, NOT 8 padded slots. See §6 + Kevin open-question Q-K1. |

### 4.2 Word Song stardust on a partial stop — flagged, do NOT guess (Kevin Q-K2)

Word Song's stardust model is **per-session-end flat bonus**, not per-correct: `WORDSONG_SESSION_END_BONUS` (`+5`) is granted inside SessionEnd's mount effect via `grantWordSongCompletionBonus`, and `earnedThisSession` is always `0` for word-song (per `.claude/docs/screens-and-flows.md` §WordSong). That bonus is a **completion** bonus.

**Design intent (C3 — "stardust for completed problems"):** a partial Word Song stop should NOT grant the full completion bonus as if she finished — that would make stopping and finishing identical in reward, which (a) violates "stardust for completed problems" and (b) creates a perverse equal-reward-for-less mechanic. But it must ALSO never be punitive (C2) — zero stardust on a partial stop reads as a penalty.

**Recommendation (for Kevin to confirm mechanically):** on a partial Word Song stop, grant a **pro-rated** bonus = `round(WORDSONG_SESSION_END_BONUS × settledCorrect / 8)`, floored at `+1` if `settledCorrect >= 1`, and `0` only if she stopped having gotten nothing right (in which case the recap line is skipped per §5.3, so "0 stars" is never spoken — no penalty surfaced). This is a **progress-model decision, not a pure UX one** — see §6 Q-K2. **Do not invent the exact arithmetic in code without Kevin's sign-off; flag it.**

---

## 5. Emma's reaction (TTS + pose)

Constraint C2: non-punitive, no disappointment, no guilt. Emma treats stopping as a perfectly good choice — the same warmth as finishing.

### 5.1 The stop-acknowledgement line (new utterance — flag to Thomas's ear-gate)

One short line plays as the stop transition begins, BEFORE the route flip to Session End, so it bridges the two screens warmly:

> **"Okay! Good work today."**

- **Vocabulary check (against ~200-word cap):** `okay, good, work, today` — 4 words. `okay`, `good`, `work`, `today` are all already in Emma's inventory (`today` appears in Hub's "What today?"; `good`/`work` are core). **No new vocabulary.** Within cap.
- **This is a NEW utterance TEXT** (`session.stop.ack`) and therefore a **canon / audio addition that must pass Thomas's downstream ear-gate** before it ships — utterance-text changes route to the ear-gate per the audio-QA convention. Flag in the handoff to Matt. The line is intentionally a near-twin of Session End's opener ("You did it!") in warmth, but worded for the "she chose to stop" moment rather than the "she finished" moment.
- **Why a bridge line and not silence:** stopping in silence reads as the app sulking. A warm one-liner makes the choice feel acknowledged and approved (C2). It is short enough not to delay the Session End celebration.
- **SSML:** rate `-10%`, default pitch — house Emma voice config, identical to other session utterances.

### 5.2 Pose

- On the stop tap: Emma holds `idle` and plays a **single gentle nod** — reuse the breathing-loop spring vocabulary (house spring `stiffness 260, damping 20`), a one-shot `rotateZ` `[0, 3, 0]` over ~400ms reading as a small "okay, got it" acknowledgement. **Do NOT use `puzzled-tilt`** (that's the wrong-answer affect — stopping is not a mistake, C2) and **do NOT use a downward pitch** (forbidden — reads as judging, per `emma-character-and-animation.md` §2).
- Then the normal Session End mount takes over: Emma's existing `emma-cheering.svg` "You did it!" beat plays as usual (C3 — the partial Session End is the real celebratory Session End).
- Reduce-motion: the nod collapses to no rotation (consistent with `EmmaCharacter`'s reduce-motion path); the SVG/pose still swaps so the affect still reads.

### 5.3 Recap line on a partial / zero stop (reuse existing edge-case behaviour)

Session End already handles the "0 stardust" case correctly: it **skips** the "You earned … stars" recap line entirely and plays only opener + goodbye (per `design/screen-5-session-end.md` §"Edge case — saying 'You earned zero stars' reads as either sarcasm or a scold"). A partial stop with 0 earned therefore inherits the right non-punitive behaviour for free (C2). A partial stop with ≥ 1 earned plays the normal "You earned N star(s)!" recap with the partial N — no new copy needed.

---

## 6. Progress-model implications — flagged for Kevin, NOT invented here

A stopped session is a real session that should record honestly without polluting the mastery signal. The exact recording semantics are **progress-model decisions Kevin owns** — this spec flags the questions and gives a recommended default, but does not invent the semantics (per the brief).

The relevant write path is `recordProgressOnSessionEnd` (`src/screens/SessionEnd/progressHistory.ts`), which runs in SessionEnd's mount effect and writes a `SessionHistoryEntry` + runs `applyMasteryRule`. A `SessionHistoryEntry.successRate` is `correct / 8` for normal sessions (per `.claude/docs/progress-and-persistence.md` §SessionHistoryEntry).

### Open questions for Kevin (do not guess; route via Matt)

- **Q-K1 — `successRate` denominator on a partial stop.** If a stop at problem 4 records `correct / 8`, a strong partial session looks like a failure to the mastery rule (3/3 correct then stop = `successRate 0.375`), which could wrongly **block** promotion. Recommended default: record `successRate = settledCorrect / settledCount` (denominator = problems actually attempted), so a stopped session reflects her real accuracy over what she did. **But** this changes what the mastery rule consumes — Kevin must confirm whether a partial session should count toward the 3-session mastery window at all, or be **excluded from mastery accounting** (recommended: a partial/stopped session is recorded for history but flagged so `applyMasteryRule` does NOT count it toward `masteryThreshold[track].sessions` — stopping early is not evidence of mastery OR non-mastery). The cleanest mechanism is likely a new optional flag on the entry (e.g. `partial?: boolean`) that the mastery filter skips; Kevin owns whether that flag exists and how the rule reads it.

- **Q-K2 — Word Song partial stardust arithmetic.** Per §4.2 — the pro-rated bonus formula is a progress/economy decision. Kevin confirms the exact arithmetic and where it's applied (it must NOT be the unconditional `grantWordSongCompletionBonus` path, which assumes completion).

- **Q-K3 — array truncation vs padding.** Whether the per-problem arrays (`perProblemCorrect`, `latencyMs`, `mathFacts`, `perProblemDistractorClass`, etc.) ship truncated-to-settled or padded-to-8 with sentinels. The four-ref lockstep pattern in Math.tsx (per `.claude/docs/screens-and-flows.md` §Math) already supports non-8 lengths defensively, so truncation is likely cleanest, but the downstream guards (`guards.ts`) and Leitner promotion path must tolerate short arrays. Kevin confirms.

- **Q-K4 — mid-session-resume interaction.** `design/mid-session-resume.md` persists `marian-tutor.session-progress.v1` and clears it on session-end. A stop is a session-end, so it MUST clear that key (and `marian-tutor.session-plan.v1`) and call `clearSessionAudio(sessionId)` — otherwise a stopped session would be offered as a resume candidate next launch. Recommended: the stop path runs the **same** session-progress cleanup that full completion runs. Kevin confirms the cleanup hook fires on the partial path.

**None of Q-K1…Q-K4 block the UX/visual/copy work** — placement, treatment, pose, and the bridge line are fully specified above and implementable now. The progress-recording semantics are a parallel track Kevin resolves.

---

## 7. States

- **Idle (problems 1–2):** pill NOT mounted. No exit affordance except the existing HUD back-arrow.
- **Available (problems 3–8):** pill mounted, bottom-centre, low-contrast, tappable. Stays mounted across correct/wrong/retry beats. Never disabled.
- **Stop tap (happy path = the only path):** synchronous `cancelSessionAudio()` → `session.stop.ack` line + Emma single-nod → partial `SessionEndPayload` built → route to `session-end`. No dialog.
- **Error path:** there is no "wrong" here — stopping is a valid choice, never a red X, never a puzzled-tilt (C2). The only failure mode is a build-payload exception; if `cancelSessionAudio()` throws it is swallowed best-effort (mirror back-arrow), and the route flip still proceeds.
- **First-visit / return-user:** identical — the pill's presence depends only on `problemIndex >= 2`, not on session count.
- **Transition out:** Emma's nod (≤ 400ms) overlaps the route flip; Session End mounts and runs its normal opener → recap (skipped if 0) → goodbye → CTA sequence. No special partial-mode visual on Session End — it is the real Session End.
- **Reduce-motion:** pill fade-in still plays (opacity is not vestibular motion); Emma's nod collapses to no rotation.

---

## 8. Acceptance criteria (Jessica)

### Placement + prominence (C4)

- [ ] On Math problems 1 and 2, no element with the stop pill's test id exists in the DOM
- [ ] On Math problem 3 onward, a `data-testid="math-stop-for-now"` button is present, bottom-centre, inside the safe-area bottom inset
- [ ] On Word Song problem 3 onward, a `data-testid="wordsong-stop-for-now"` button is present, same placement
- [ ] The stop button's hit-zone is ≥ 44pt tall (measured: 56pt) and ≥ 88pt wide (measured: 132pt)
- [ ] The stop pill's bottom edge clears the lowest answer chip by ≥ 16pt on both screens, at the shortest supported iPad portrait viewport
- [ ] The stop pill's interactive contrast is visibly lower than the answer chips and the HUD back-arrow (it is the lowest-contrast interactive element on screen)

### Gate (C1)

- [ ] The stop pill cannot be tapped on problems 1 or 2 (not mounted)
- [ ] The stop pill appears at problem 3 and remains for problems 3–8

### One-tap, no dialog (C5)

- [ ] Tapping the stop pill does NOT open any confirmation dialog, modal, or second-tap prompt
- [ ] A single tap routes to `session-end` (route becomes `'session-end'`)
- [ ] A fast double-tap fires the stop exactly once (no double Session End mount)
- [ ] In-flight session audio is cancelled on the stop tap (no TTS bleed into Session End)

### Partial-credit Session End (C3)

- [ ] After a stop at problem 4 with 3 correct, Session End shows the **partial** stardust she earned (not the full-completion amount)
- [ ] After a stop with ≥ 1 stardust earned, the "You earned N star(s)!" recap plays with the partial N
- [ ] After a stop with 0 stardust earned, the recap line is skipped (opener + goodbye only) — "You earned zero stars" is never spoken
- [ ] Session End's opener / goodbye / CTA sequence is identical to a full-completion session
- [ ] On a stop, `marian-tutor.session-progress.v1` and `marian-tutor.session-plan.v1` are cleared and `clearSessionAudio(sessionId)` runs (a stopped session is not offered as a resume candidate next launch)

### Emma reaction (C2 — non-punitive)

- [ ] On the stop tap, Emma plays the `session.stop.ack` line ("Okay! Good work today.")
- [ ] Emma does NOT enter `puzzled-tilt` and does NOT pitch downward on a stop
- [ ] No disappointment, guilt, "you didn't finish", "are you sure you want to leave", or "come back" copy appears in any TTS, caption, or visual on the stop path
- [ ] With Reduce Motion on, Emma's nod has no rotation but the line + Session End still play

### Progress recording (gated on §6 Kevin answers — Jessica writes these once Q-K1…Q-K4 land)

- [ ] (Pending Q-K1) A partial/stopped session does not wrongly block OR wrongly grant mastery promotion
- [ ] (Pending Q-K3) Downstream guards + Leitner promotion tolerate truncated per-problem arrays

---

## 9. Assets required

| Asset                        | New?                                            | Notes                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stop pill (button + glyph)   | New — but **CSS/SVG inline**, no authored asset | Rounded-rect stroke pill + 14pt rounded-square glyph, both inline in the screen JSX (like the existing back-arrow's inline `<svg>`). No new file in `public/assets/`.                                                       |
| `session.stop.ack` utterance | **New TTS** (canon/audio)                       | "Okay! Good work today." — rate `-10%`, default pitch. **Routes to Thomas's ear-gate.** Rendered server-side at session-start alongside other session utterances, OR pre-baked into canon — Kevin/audio's call on pipeline. |
| Emma poses                   | Reused                                          | `emma-idle.svg` (nod), then `emma-cheering.svg` for the Session End beat. No new pose, no new SVG.                                                                                                                          |
| SFX                          | None new                                        | The stop tap uses no dedicated SFX; Session End's own opener sparkle SFX carries the celebratory beat. (A stop "click" SFX would read as a UI-confirm chrome sound, off-tone for this app — deliberately omitted.)          |

**Glyph rationale (why a rounded stop-square, not an X / door / power icon):** an X reads as "wrong/cancel/error" — forbidden tone (C2, never-a-red-X). A door/exit-running-figure reads as "escape", framing stopping as fleeing. A power symbol reads as a device control. A soft rounded square is the universal "stop" affordance (media-player vocabulary an 8-year-old already knows from video) with zero negative valence.

---

## 10. Dark-pattern self-audit

Per CLAUDE.md non-negotiables + Dave's constraints. Each item confirmed absent.

- [x] **No confirmation friction (C5).** One tap stops. No "are you sure?", no hold-to-confirm, no double-tap gate, no "you'll lose your progress!" scare. A dialog here would be friction-as-dark-pattern — making the _exit_ harder than the _stay_. Explicitly forbidden.
- [x] **No guilt / streak-shame / disappointment (C2).** Emma's line is approving ("Okay! Good work today."). No "you didn't finish", no "Emma will miss you", no anthropomorphic guilt, no "your streak is at risk if you leave". The streak value at stop is recorded as-is; stopping does not "break" it punitively.
- [x] **No equal-reward-for-less perverse incentive.** Partial stop grants partial stardust (C3, §4.2) — stopping early is never as rewarding as finishing, so the mechanic doesn't accidentally train "tap stop to farm the completion bonus". (This is the inverse dark-pattern to guard against: a too-generous stop reward.)
- [x] **No penalty for stopping (C2).** Equally, stopping never _subtracts_ stardust, never lowers a level, never demotes a Leitner fact as if she got it wrong. Unattempted problems are simply not counted (§6 Q-K1) — not scored as wrong.
- [x] **No fake urgency.** No countdown, no "session expires in N", no "finish before the timer".
- [x] **No habitual-tap invitation (C4).** The control is the lowest-contrast interactive element, bottom-centre away from the thumb-rest and away from the answer chips, absent for the first two problems. It does not pulse, shimmer, or animate to attract attention.
- [x] **No social pressure / comparison / sharing.** None present.
- [x] **No surprise cost / IAP / unlock-to-stop.** Stopping is free and always available (problem 3+).
- [x] **Symmetric exits.** Stopping and finishing both land on the same warm Session End. Neither path is dark-patterned to be easier or harder than the other — finishing isn't coerced, stopping isn't punished.

---

## 11. Open questions (need Thomas, via Matt)

1. **Relationship to the existing HUD back-arrow (Thomas — taste call).** Both Math and Word Song already render a top-left back-arrow (`data-testid="math-back-to-hub"` / `wordsong-back-to-hub`) that returns to Hub **silently with no celebration and no stardust beat** (`onRequestExit` → `App.tsx#handleBackToHub`). After this spec ships, Marian has two exit controls with different behaviours:
   - Back-arrow (top-left): silent, raw return to Hub, no Session End, no stardust recap.
   - Stop-for-now pill (bottom-centre, problem 3+): warm, partial-credit Session End with stardust.

   Having two exits with divergent reward behaviour is a potential confusion/inconsistency. **Three options for Thomas:**
   - **(a) Keep both as-specced** — back-arrow = quick bail (e.g. wrong tree, parent intervened), stop-pill = "I'm done for today". Distinct intents, distinct treatments. (Recommended — they serve genuinely different moments, and the back-arrow predates problem 3 so it covers the "tapped the wrong tree" case the stop-pill can't.)
   - **(b) Route the back-arrow through the same partial-credit Session End** — unify so every voluntary exit gives partial credit. Simpler mental model, but loses the cheap "oops wrong tree, get me out" escape and adds a celebration to a non-celebratory moment.
   - **(c) Remove the back-arrow entirely on problem 3+** once the stop-pill is present, leaving the back-arrow only for problems 1–2. Single exit per phase.

   This is a subjective-feel call (which exits exist and what they reward) — routed to Thomas, not auto-decided.

2. **Pill copy wording (Thomas — taste).** "Stop for now" vs "I'm done" vs "All done for today". "Stop for now" is recommended (warm, reversible-sounding, not final). Confirm.

---

## 12. Provenance

- Brief: ClickUp ticket `86ca7urx1`. Dave PROCEED ruling (ticket comment, 2026-06-11) — five constraints restated in §0.
- Sibling spec (this is the deliberate follow-up to its scoped-out "Session pause" item): `design/mid-session-resume.md` §"Out of scope".
- Session End canonical reference: `design/screen-5-session-end.md` (opener/recap/goodbye copy + the 0-stardust skip edge case).
- Payload contract: `src/screens/SessionEnd/SessionEnd.tsx` (`interface SessionEndPayload`).
- Progress write path: `src/screens/SessionEnd/progressHistory.ts` (`recordProgressOnSessionEnd`).
- Existing exit affordance grounding: `src/screens/Math/Math.tsx` (`data-testid="math-back-to-hub"`, `onRequestExit` block) + `src/screens/WordSong/WordSong.tsx` (matching block).
- Emma reaction / never-a-red-X: `.claude/docs/emma-character-and-animation.md` §10, §2, §4.
- Word Song stardust model + Session End phase machine: `.claude/docs/screens-and-flows.md` §WordSong, §SessionEnd.
