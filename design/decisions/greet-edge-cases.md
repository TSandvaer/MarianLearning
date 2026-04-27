# Greet edge cases — design decisions

**Ticket:** `86c9gpqux`
**Surface:** `src/screens/Greet.tsx`, supporting `design/session-1.md` § "Screen 2 — First Greeting (Meet Melody)"
**Status:** Decided. Spec amendments + spinout impl ticket described at the bottom.
**Source:** Surfaced by Jessica's run `qa/runs/greet-2026-04-25-3d8664f.md` (rows "Heart tap during line 4 (before re-prompt arms)" and "Background / resume mid-Intro (audio playing)" in the Survival-checks table).

---

## Context

PR #18 / `3d8664f` shipped the Wake → Intro state machine and the post-line-4 heart re-prompt. Two behaviours were never explicitly specified, and the implementation chose defaults that QA could not validate against any rule:

1. What happens if Marian taps the heart **while line 4 is still being spoken** (i.e. after the heart has appeared at end-of-line-3 but before line 4 has finished)?
2. What happens if iPadOS suspends the PWA mid-Intro (Marian opens another app, the iPad screen sleeps, a phone call interrupts) and then resumes — possibly seconds, possibly minutes later?

The original ticket framed (2) around `speechSynthesis`. That framing is dated: post-PR #25 / `86c9gqprh`, Greet's audio is pre-recorded MP3s played via Howler.js (see `design/audio-architecture.md`). The relevant question today is "how does Howler behave on iPad PWA resume mid-sequence" — a different problem with a cleaner answer.

Both decisions ladder back to four CLAUDE.md principles:

- **Audio-first, text-mirror** — Melody's voice is the load-bearing instruction channel; cutting it off carries cost.
- **Never punish initiative** — adjacent to "never a red X". Disabling the heart while line 4 plays would feel like a soft "no" to a child who's clearly understood.
- **Short attention spans** — an 8-year-old should not have to wait through a re-spoken intro because she stepped away for 20 seconds.
- **No nag loops** — recovery from any interruption must end on a single re-prompt at most, never a forced restart that loops.

---

## Edge case 1 — Heart tap during line 4

### Rule

**The heart is interactive the moment it appears (end of line 3). A tap during line 4's playback is honoured: line 4 is cancelled mid-utterance via `cancelPreRecorded()`, ear-wiggle fires, chime plays, screen advances to Math within 400 ms.**

This is the behaviour the implementation already ships. We are codifying it as the rule, not changing it.

### Rationale

1. **Marian has demonstrated comprehension.** The heart appears precisely because line 3 ("It's so nice to meet you.") has just finished. Line 4 ("Tap the heart when you're ready.") is reinforcement, not new information. If she taps during line 4, she has read or guessed the affordance from the heart's visual presence + Melody's earlier framing — she does not need the full sentence to commit to the action. Cutting line 4 short rewards that initiative.

2. **Disabling the heart would feel like a soft "no".** Greying or de-activating the heart for ~1.5 s while line 4 plays creates a small, repeating "the bunny says wait" experience. For a child who is Tagalog-primary and reading-emerging, "the heart looks ready but won't take my tap" is exactly the wrong signal. The CLAUDE.md "never a red X" principle has a corollary: never a soft no on a primary action when the user has plainly understood the goal. An 8-year-old's tap on a freshly-appeared, animating heart is a clear "I am ready"; the app should believe her.

3. **The cut-off is sonically gentle.** `cancelPreRecorded()` stops the Howl synchronously and the chime (~400 ms) plus ear-wiggle (600 ms) layer immediately on top. From Marian's ear, line 4 fades into "ding! [advance]". There is no harsh edit, no "Tap the hea—" stutter that an 8-year-old would register as a glitch.

4. **The pattern matches every other primary action in the app.** Math chips remain tappable during their TTS narration (`session-1.md` line 372); Word Song letter-tap remains responsive while the prompt is being read. A heart that gates on "wait until I finish talking" would be an inconsistency.

5. **Cost of the alternative is real.** A disabled-while-speaking heart adds a state to the component (`heart: ready | speaking | tappable`), a visual treatment for the disabled state (which we have explicitly committed to NOT designing — no greys-as-disabled per the global token policy), and a window in which Marian's first attempt silently fails. None of those buy us a child-perceptible benefit.

### Spec amendment

Append to `design/session-1.md` § Screen 2 → States → "Heart tapped (happy path)":

> **Heart tapped during line 4 (still playing):** identical happy-path behaviour. The in-flight line-4 audio is cancelled synchronously (`cancelPreRecorded()`), ear-wiggle + chime + advance fire on the same 400 ms transition. The heart is **never disabled while audio is playing**; visual presence implies tappability.

Append to the AC checklist:

- [ ] Tapping the heart during line-4 playback cancels line 4 mid-utterance and advances within 400 ms — same handler path as a post-line-4 tap. No visual or audio "wait" state appears.

### Acceptance for QA

Jessica's existing row "Heart tap during line 4 (before re-prompt arms)" in `qa/greet-regression.md` survival checks already exercises this. With the rule documented, the row's status moves from PASS-with-flag to plain PASS.

---

## Edge case 2 — Background / resume mid-Intro

### Rule

**On any visibility-loss event during the Intro state (`document.hidden === true` via `visibilitychange`, OR `pagehide`, OR Howler `Howler.ctx.state === 'interrupted'`), the screen cancels the current sequence, returns to a "soft Wake" state on resume, and starts the Intro fresh from line 0 on the next tap.**

Concretely, on visibility loss mid-Intro:

1. Cancel the in-flight Howl via `cancelPreRecorded()`.
2. Cancel the running `runGreetSequence` handle (`sequenceRef.current?.cancel()`).
3. Cancel pending timers: the wake re-prompt (already cleared on entry to Intro), the post-line-4 20 s re-prompt, the heart-squish advance timer if pre-tap.
4. Reset state to wake-equivalent: `screenState = 'wake'`, `revealedByLine = [0,0,0,0]`, `activeLine = 0`, `heartReady = false`, `pose = 'idle'`, `repromptUsedRef = false`. The 8 s Wake re-prompt **does not re-arm** on resume — Marian has already seen the screen come alive once; a second nudge after returning would read as nagging.
5. The Wake-state ring + full-viewport tap target reappear (re-uses existing `screenState === 'wake'` rendering branch). Any tap restarts Intro from line 0 via the standard `handleWakeTap` path (which already rebuilds the sequence and is the iPad gesture-unlock contract).

If the resume happens **post-line-4 / heart visible** (i.e. Marian was idle on the heart and stepped away), apply a narrower rule: **do not restart**. Cancel any in-flight chime, keep the heart visible and tappable, and re-arm the post-line-4 20 s re-prompt timer with a fresh window. Line 4 itself does not re-speak unless that 20 s timer fires — same contract as the existing `repromptUsedRef` guard, but the ref is **reset** on resume so the one-shot re-prompt is again available.

### Why "restart from line 0", not "resume mid-line" and not "skip to heart"

| Option | Verdict | Reason |
|---|---|---|
| Resume mid-utterance (browser default, what ships today) | Reject | Howler on iPad PWA resume from background is non-deterministic. Three observed paths: (a) the Howl finishes silently with no `onend`, leaving the sequence orchestrator stuck; (b) the Howl restarts the line from the top; (c) `Howler.ctx` is in `interrupted` state and `play()` queues but never fires. None of these read as intentional behaviour to a child; they read as "the bunny is broken." Even the best case (resume mid-line) drops Marian into the middle of a sentence with no caption-reveal lead-in. |
| Resume from line N+1 (skip the line that was interrupted) | Reject | Captions for line N would be partially revealed and frozen mid-line. Re-speaking the next line on top of that visual state is incoherent. Also requires bookkeeping (which line was active at suspension, was it past first-word boundary) that buys nothing. |
| Skip to heart (treat resume as a "she got the gist") | Reject | Marian may have backgrounded after 0.3 s, before Melody said anything intelligible. Skipping to the heart with no greeting at all violates the audio-first principle. The heart's affordance assumes the bunny has introduced herself. |
| **Restart from line 0** | **Accept** | Deterministic. Unambiguous. Re-uses the existing Wake → Intro pathway end-to-end (no new code path, no new state). Greeting is short (~5–6 s); restarting it is not punitive. Most importantly: it requires a **tap to resume**, which is the same gesture-unlock contract iPad demands anyway. We get correctness and audio-unlock-on-resume in one mechanism. |
| Restart silently (auto-play line 0 on resume without a tap) | Reject | iPad Safari will reject the `play()` call — there's been no fresh user gesture in this execution context after backgrounding. We'd silently fail to a frozen screen. The Wake-state ring is the right affordance. |

### Why the post-line-4 case is different

Once the heart is visible, the screen is in a *waiting-for-her* state, not a *talking-to-her* state. Cancelling and restarting from line 0 in that case would punish her for stepping away after the introduction completed normally. The rule mirrors the existing 20 s post-line-4 re-prompt contract: she's allowed to take her time, the bunny is patient, one nudge then quiet. Resuming with the heart still ready is the warm choice.

### Why the 8 s Wake re-prompt does not re-arm on resume

It already fired (or had its window cancelled) on the original mount. Re-arming it would mean: she taps to enter Intro, backgrounds, returns, sees the soft Wake ring, and 8 s later gets the finger-tap-icon nudge a second time. That reads as the bunny growing impatient, which violates the no-nag-loop principle. Better to sit quietly with the ring pulsing — Marian knows what to do; she just left for a minute.

### Detection: visibility events, not Howler-internal

Listen on `document.addEventListener('visibilitychange', ...)` checking `document.hidden`. Also listen for `pagehide` for the iPadOS edge case where `visibilitychange` doesn't fire (full PWA backgrounding under memory pressure). Do NOT key off `Howler.ctx.state === 'interrupted'` directly — that state is observed unreliably on iPad and lags the user-perceived suspension by hundreds of ms. Visibility events are synchronous to the OS-level transition and are the correct seam.

The existing `Howler.autoSuspend = false` (App.tsx) keeps Howler's own 30-s idle suspend out of the picture for the gentler "Marian paused for 45 s with the screen on" case. The visibility-driven reset only triggers on actual OS-level backgrounding, which is what we want.

### Spec amendment

Append to `design/session-1.md` § Screen 2 → States, between "No heart tap for 20 seconds" and "Error path":

> **Background-resume during Intro:** If `document.visibilityState` flips to `hidden` (or `pagehide` fires) while Intro audio is playing, the screen cancels the in-flight line and the running sequence, resets to the Wake state without re-arming the 8 s Wake re-prompt, and waits for a fresh tap. The next tap restarts the Intro from line 0 via the standard Wake-tap handler. **Background-resume after line 4 (heart visible, no tap yet):** the screen does NOT restart. The heart remains visible and tappable on resume; the post-line-4 20 s re-prompt timer is re-armed with a fresh window and the one-shot guard is reset so Melody can still re-speak line 4 once. Line 4 itself does not re-play on resume unless that 20 s timer fires.

Append to the AC checklist:

- [ ] If `document.hidden` becomes `true` (or `pagehide` fires) during Intro lines 1–4, the screen returns to Wake state on resume; tapping restarts Intro from line 0; the 8 s Wake re-prompt does NOT re-arm.
- [ ] If backgrounding happens after line 4 has finished and the heart is visible, the heart remains visible and tappable on resume; the 20 s heart re-prompt timer re-arms with a fresh window; line 4 does not re-speak immediately.
- [ ] On resume, no audio plays without a fresh user gesture (the Wake-tap is the gesture; a chime / line auto-play would violate iPad's gesture-unlock contract).

### Acceptance for QA

Jessica's existing row "Background / resume mid-Intro (audio playing)" moves from NOTES (spec-silent) to a checkable PASS once Devon ships the visibility handler. The row should be split into two: mid-Intro (lines 1–4 active) and post-line-4 (heart visible). The matrix can keep both as DEFERRED-TO-DEVICE for the iPad-actual verdict, but jsdom-level coverage of the state-machine reset is achievable in unit tests.

---

## Spinout: implementation ticket for Devon

> **Title:** `feat(greet): visibility-driven Intro reset on background-resume (#86c9gpqux)`
>
> **Body:** Wire a `document.visibilitychange` + `pagehide` listener in `Greet.tsx` that, when the document becomes hidden during `screenState === 'intro'` AND the heart is not yet ready, cancels the in-flight pre-recorded line via `cancelPreRecorded()`, cancels `sequenceRef.current`, clears all timers (wake-icon, post-line-4 re-prompt, advance), and resets state: `screenState='wake'`, `activeLine=0`, `revealedByLine=[0,0,0,0]`, `heartReady=false`, `pose='idle'`, `repromptUsedRef.current=false`, `wakeIconRepromptUsedRef.current=true` (sticky — do NOT re-arm the 8 s Wake re-prompt on resume). When hidden during `intro` AND `heartReady === true`, take the narrower branch: cancel any in-flight chime/audio, keep heart visible, reset `repromptUsedRef.current=false`, and re-arm the post-line-4 20 s timer via the existing `scheduleReprompt()`. The visibility listener should be a no-op when `screenState === 'wake'` (we're already in the desired state). Add unit tests that fire `visibilitychange` events at each of the four lines, at heart-visible-pre-tap, and at heart-tapped-mid-advance (no-op expected — the advance timer should win the race or be cleared cleanly). No behaviour change for Edge Case 1 — the heart-tap-during-line-4 path is already correct; the spec amendment is doc-only and does not need a code ticket.
>
> **Spec references:** `design/session-1.md` § Screen 2 → States (amended), `design/decisions/greet-edge-cases.md` § Edge case 2.
>
> **Risk:** low — additive listener; existing happy paths untouched. Per-tap audio-context resume kicks in App.tsx are unaffected.
