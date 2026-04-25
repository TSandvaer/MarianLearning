# Audio architecture

How Melody talks. Why we don't use Web Speech. How to add audio to new screens.

This document is the canonical reference for the audio/voice system. It captures decisions
that were expensive to learn and cheap to forget. Read it before touching anything in
`src/lib/audio/*`, `src/lib/tts/*`, `api/_tts.ts`, or any screen that plays audio.

---

## TL;DR

- **Voice:** Microsoft's `en-US-AnaNeural` (Cartoon/Cute child female), rate `-10%`, default pitch.
- **Greet's 4 fixed lines:** pre-recorded MP3s shipped in `public/assets/audio/greet/`, played by Howler.
- **Everything else (Math, Word Song, all dynamic content):** generated server-side at session-start
  via Microsoft's free Azure TTS endpoint (the same backend `edge-tts` uses), embedded as base64
  MP3 in the session JSON, cached client-side in IndexedDB, played by Howler.
- **Web Speech API (`speechSynthesis.speak()`): not used.** The journey explains why.
- **Caption sync:** linear timer based on `audio.duration() / wordCount`. Good enough.
- **Gesture unlock:** required on iPad; the wake-tap pattern in `useAudioUnlockGate` handles it
  for any screen that plays audio after a non-interactive transition.

---

## The journey — why we don't use Web Speech

Five rounds of bug investigation under ticket `86c9gp99a` proved that iPad Safari's
`speechSynthesis` is unfit for the kids-app audio path. The whole audit trail is in ClickUp;
this section is the condensed version so future contributors don't repeat the experiment.

### What we tried (rounds 1–5)

| Round | PR | Hypothesis | Outcome |
|---|---|---|---|
| 1–2 | #18, #21 | Add gesture-unlock + multi-event handlers to satisfy iOS user-gesture requirement | Events still didn't reach the engine on iPad |
| 3 | #22 | Add Web Speech workarounds (cancel-before-speak, voice priming, `?debug=1` overlay) | iPad showed `taps: 0`, `speak: none` — events not even reaching the React handlers |
| 4 | #23 | `pointer-events: none` on the decorative melody-slot so taps reach the button beneath; raw-event shadow recording for diagnosis | Event-layer fixed. Taps now reach React. Speech still flaky. |
| 5 | #24 | Light-girl voice profile + watchdog tuning (2s → 5s) + multi-synthetic-event regression guard | Tap registers → `speak() queued` → `synth speaking=false` 12+ seconds later → gate relocks. iPad silently rejects the utterance. After 4–5 retries one finally fires. |

The smoking gun was on round 5. With `?debug=1` overlay live, a single tap produced this:

```
synth speaking=false pending=false paused=false
voices count=186 lang=ar-001
gate relock
speak [17:15:03.577] queued: "Hi!"
taps (1)
[17:15:03.576] pointerdown → greet-wake-tap-target
raw events (1)
[17:15:03.574] pointerdown → greet-wake-tap-target
```

`speak()` was called within 3 ms of the tap. Twelve seconds later, the engine still reported
`speaking=false`. No `onstart`, no `onerror`, no `onend`. **iOS WebKit had silently
dropped the utterance.** This is documented behaviour ("first-speak unreliability" on iOS) and
is not fixable from the app layer. After iPad eventually accepts one utterance, all subsequent
speech in the same session works — but Marian (age 8) is not going to spam-tap five times to
unlock her tutor.

### What we kept from the journey

Five rounds of work weren't wasted. Each one shipped a piece of infrastructure we still use:

- **PR #15 / #18 — gesture-unlock pattern.** `useAudioUnlockGate` survives. Howler also requires
  a user gesture to unlock the audio context on iOS, so the wake-tap UX is still load-bearing.
- **PR #22 / #23 — `?debug=1` overlay.** `DebugOverlay` survives. Diagnostic surface for any
  future audio bug. (Note: `last speak` row currently only reports for the dead Web Speech path;
  ticket `86c9gr444` extends it to the new pipeline.)
- **PR #23 — `pointer-events: none` on `greet-melody-slot`.** Survives. Pure CSS hit-testing
  fix; was the actual cause of round-3's "events don't even fire" — not Web Speech specific.
- **PR #24 — multi-synthetic-event regression guard.** Survives. iPad fires three synthetic
  events per physical tap; the guard collapses them so a single physical tap dispatches one
  audio call.

### The pivot

After round 5, the call was clear: Greet's lines are fixed (never change session-to-session).
Pre-recorded audio bypasses every iPad first-speak failure mode. Howler.js plays an MP3
reliably on iPad once the audio context is gesture-unlocked. We swapped Greet's engine in
PR #25 (Plan B, ticket `86c9gqprh`) and Marian's first iPad pass succeeded on a single tap.

That left a second problem: Math and Word Song generate dynamic content (Marian's specific
problems vary per session). Pre-recording them at build time isn't practical. So we extended
the pattern: **server-side TTS at session-start**, generating audio for every utterance in
the same Vercel call that already runs Claude. Same voice, same engine, same reliability.
That's Path A (ticket `86c9gr385`).

---

## Architecture

### Two audio surfaces, one voice

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Frontend (React PWA)                        │
│                                                                      │
│  ┌──────────────────────────┐   ┌─────────────────────────────────┐  │
│  │  Greet (4 fixed lines)   │   │  Math, Word Song, future        │  │
│  │                          │   │  (dynamic content)              │  │
│  │  preRecorded.ts          │   │  sessionAudio.ts                │  │
│  │   ↓                      │   │   ↓                             │  │
│  │  Howler.Howl ←—— PWA     │   │  Howler.Howl ←—— IndexedDB      │  │
│  │   precache               │   │   cache                         │  │
│  │   (4 MP3s, ~56 KB)       │   │   (per-session, base64→blob)    │  │
│  └──────────────────────────┘   └─────────────────────────────────┘  │
│                                          ↑                           │
│                                          │ session JSON              │
│                                          │ (utterances + base64 MP3) │
└──────────────────────────────────────────│───────────────────────────┘
                                           │
                                           │ HTTP
                                           ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       Vercel function (api/claude)                   │
│                                                                      │
│      Claude API ──────► session plan ──────► api/_tts.ts             │
│                          (text)               (parallel TTS calls)   │
│                                                ↓                     │
│                                        Microsoft free Azure TTS      │
│                                        en-US-AnaNeural -10%          │
│                                                ↓                     │
│                              merged session JSON ─► response         │
└──────────────────────────────────────────────────────────────────────┘
```

### Module boundaries

| Module | Purpose | Used by |
|---|---|---|
| `src/lib/audio/preRecorded.ts` | Howler wrapper for bundled-asset MP3s | Greet only |
| `src/lib/audio/sessionAudio.ts` | Howler wrapper for session-supplied base64 audio + IndexedDB cache | Math, Word Song, all future dynamic content |
| `src/lib/audio/useAudioUnlockGate.ts` | Wake-tap pattern; gesture unlock state machine | Any screen that plays audio after a non-interactive transition |
| `src/lib/tts/*` | Web Speech engine (Greet's old path) | **Dead.** Kept in tree post-Path-A for safety; deletion follow-up planned once Math + Word Song are on the new pipeline. |
| `api/_tts.ts` | Node Azure TTS wrapper (Vercel-side) | `api/claude.ts` only |
| `api/_session.ts` | Session generation + TTS merge orchestrator | `api/claude.ts` only |

### Session JSON shape (post-Path-A)

```typescript
type Utterance = {
  text: string             // for caption rendering + accessibility
  audio: AudioRef
}

type AudioRef =
  | { kind: 'inline'; base64: string; mime: 'audio/mpeg' }
  // Future: { kind: 'url'; href: string } if we ever need CDN-hosted audio
```

Every dynamic spoken string in a session response is an `Utterance`. Frontend pairs the
text (for captions) with the audio (for playback) at consume time.

### Caching strategy

- **Greet's bundled MP3s:** PWA service worker precaches all four (`vite.config.ts` glob
  includes `mp3`). Available offline after first PWA install. Total: 4 entries / ~56 KB.
- **Session audio:** stored in IndexedDB keyed by session ID. Howler consumes via blob URLs.
  Cleared on session end. Quota-aware fallback if IndexedDB unavailable (rare on iPad PWA;
  the fallback is to keep the base64 in memory for the session lifetime).

---

## Voice configuration

Single source of truth for voice settings:

```
Voice ID:    en-US-AnaNeural    (Microsoft Cartoon/Cute child female)
Rate:        -10%               (slightly slow for English-learning child)
Pitch:       default             (voice is already child-coded; cranking adds artificial
                                  chipmunk effect)
Format:      MP3 mono 24 kHz ~48 kbps
```

Greet's four MP3s were generated with this command (documented in `preRecorded.ts`):

```bash
python -m edge_tts \
  --voice en-US-AnaNeural \
  --rate=-10% \
  --text "Hi!" \
  --write-media greet-01-hi.mp3
```

The Vercel function uses the same voice/rate via the underlying Azure TTS endpoint
(no Python in production; `edge-tts` is just our local CLI for static asset generation).

If we ever change the voice, we re-generate Greet's bundled MP3s with the new edge-tts
config AND update the Vercel function's TTS config — both surfaces must match.

---

## Adding audio to a new screen

If your screen has **dynamic content** (text varies per session — math problems, phonics
words generated by Claude), do this:

1. In your session-generation request, ensure the Claude prompt produces every speakable
   string as a discrete field in the response JSON.
2. The Vercel function will automatically pair each speakable string with its audio
   (server-side TTS happens transparently).
3. In your screen, use `sessionAudio.playUtterance(id)` — never `lib/tts.speak()`.
4. For captions, render the `Utterance.text` synchronously with `sessionAudio`'s
   `onWordTick` callback (linear timer, same pattern as `preRecorded`).
5. Use `useAudioUnlockGate` if your screen is reached without a prior user gesture
   (i.e., not via a tap/click). If the user already tapped to get to your screen, audio
   is unlocked and you can play immediately.

If your screen has **fixed onboarding content** (4–10 short lines, never change like Greet),
you have a choice:
- Easiest: add to the session-generation pipeline (above) — slight session-start cost,
  but consistent with everything else.
- More work, faster runtime: pre-record at build time (use `edge-tts` CLI with the same
  voice config), drop into `public/assets/audio/<screen>/`, extend `preRecorded.ts` with
  a new key namespace. Justified only for the entry experience (Greet); avoid otherwise.

**Never use Web Speech (`speechSynthesis`) for any new screen.** It's untested with the
wider app, and we have evidence it's unreliable on the target device.

---

## Failure modes and what to do

| Symptom | Likely cause | Where to look |
|---|---|---|
| Audio plays but caption is out of sync | Linear timer drift or word-count mismatch | `preRecorded.ts` / `sessionAudio.ts` `onWordTick` logic; check `LINE_TEXT_TO_KEY` map |
| First-tap audio doesn't fire on iPad | Gesture-unlock failed; audio context locked | `useAudioUnlockGate` state in `?debug=1` overlay; should transition `idle → pending → unlocked` |
| Audio fires but no caption | `Utterance.text` not piped through to UI | Screen-level wiring; check the screen passes `text` to its caption component |
| Greet's voice differs from Math's voice | Either Vercel TTS config drifted from edge-tts CLI config, OR re-recording happened with different settings | Check `api/_tts.ts` voice/rate constants vs `preRecorded.ts` regen comment |
| Single MP3 fails to load → silent halt | `loaderror` rejection swallowed; orchestrator doesn't fall back | Tracked in ticket `86c9gr43t` (GBUG-7). Fix wires rejection through to `useAudioUnlockGate`'s relock pathway |
| Session JSON payload too large | Too many utterances × ~15 KB each | Inspect the session response size; CDN variant of `AudioRef` is the future-proof escape hatch (not implemented) |
| iPad PWA quota exceeded | IndexedDB cache bloat across many sessions | `sessionAudio` clears on session-end; check the cleanup hook fires |

---

## Cost and limits

- **Greet bundle:** ~56 KB total in PWA precache. Free.
- **Per-session audio:** ~600 KB for an 8-problem Math session (8 problems × 5 utterances ×
  ~15 KB MP3). Comfortable margin under Vercel's 4.5 MB response cap and within reasonable
  IndexedDB quotas.
- **Vercel function execution:** Claude call + parallel edge-tts/Azure calls must complete
  in 10s. Parallel TTS dispatch is what keeps this within budget.
- **Microsoft Azure TTS endpoint:** free tier, no API key required for the endpoint
  `edge-tts` uses (we hit it directly from Node).

---

## What we deferred / what's unfinished

- **Web Speech module deletion** (`src/lib/tts/*`) — kept in tree post-Path-A for safety
  until Math + Word Song are confirmed working on the new pipeline. Follow-up ticket TBD.
- **Spec drift in `design/session-1.md`** — `86c9gr43a` (Kyle, low) — language still
  references Web Speech in places.
- **GBUG-7 silent-halt** — `86c9gr43t` (Devon, high) — pre-existing risk; one bad MP3
  silently halts the sequence. Fix bundles a build-time MP3 integrity guard.
- **Debug overlay extension** — `86c9gr444` (Devon, low) — `?debug=1`'s `last speak` row
  currently only reports for the dead Web Speech path. Wire it to `preRecorded` /
  `sessionAudio` for full diagnostic coverage.
- **CDN-hosted audio** (`AudioRef.kind === 'url'`) — not implemented. Inline base64 is
  fine for current session sizes; revisit if sessions grow much beyond 1 MB.

---

## Provenance

- Plan B (Greet's bundled MP3s): ticket `86c9gqprh`, PR #25 (`00b824f`).
- Path A (server-side session TTS): ticket `86c9gr385`, PR pending.
- Web Speech investigation (5 rounds): ticket `86c9gp99a`, PRs #18 / #21 / #22 / #23 / #24.
- Jessica's QA validation of Plan B: PR #26 (`647be7b`), `qa/greet-regression.md`.

When the Path A PR merges, update this document's Architecture section with the actual
exported API surface and any deviations from the plan above.
