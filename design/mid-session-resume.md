# Mid-session interrupt and resume

**Audience:** Devon (impl, ticket TBD — follows Math `86c9grn33`), Kevin (review), Jessica (QA), Thomas (taste).
**Author:** Kyle (UX) — ticket `86c9grnjf`.
**Status:** Spec — implementation blocked on this PR merging.
**Surface:** iPad portrait PWA, home-screen installed.
**Scope:** What happens when Marian closes the PWA mid-problem during an 8-problem Math session and re-opens later. Cold-launch resume UX, persisted state schema, audio-cache validity check, and the stale-session policy that decides resume-vs-fresh.

This file is the canonical spec for mid-session interrupt and resume on the Math screen. It does
**not** cover the post-problem-8 session-end transition (sibling ticket `86c9grnjd`,
`design/session-end.md`) and it does **not** cover Word Song or any other future surface (resume
contract is shaped to extend, but the v1 implementation only wires Math).

---

## Goal

If Marian closes the Melody PWA halfway through a Math session, when she comes back the app picks
up exactly where she left off — same problems, same stardust, same streak — without making her
re-do work she already did and without making her feel like she "lost" anything. If she's been
gone long enough that the session feels like yesterday, we quietly start fresh and don't make a
big deal about the abandonment.

**This is not** a "resume" feature she has to discover, configure, or opt into. It's the default
behaviour. From her point of view she just opened Melody and Melody knew what they were doing.

---

## User state entering this surface

Marian taps the Melody home-screen icon. PWA cold-launches, splash plays per Session-1 Screen 1
(1500ms warm cache, up to 3000ms cold). The decision tree this spec governs runs **between
splash auto-advance and the first problem render**:

```
splash (1500–3000ms)
   │
   ▼
read marian-tutor.session-progress.v1 from localStorage
   │
   ├─ no record / record.completed === true            → fresh session (Greet → Math)
   ├─ record present, lastActiveAt < 30 min ago        → RESUME path (this spec)
   └─ record present, lastActiveAt ≥ 30 min ago        → stale; discard, fresh session
```

Splash is silent and identical regardless. The branching happens behind it; Marian sees no
loading flicker between splash and the first audible screen.

---

## Interrupt scenarios

The full surface of "Marian's session got cut" is broader than just "she closed the tab." Each
scenario gets the same recovery contract — that's the point — but they differ in detection and
in whether any in-flight audio needs cleanup. Devon should design the resume orchestrator
against this matrix, not against any single scenario.

| # | Scenario | Detection mechanism | Expected behaviour | Recovery contract |
|---|----------|--------------------|--------------------|-------------------|
| 1 | Marian closes the PWA tab / swipes the app away | `visibilitychange` → `document.visibilityState === 'hidden'`, then `pagehide` | Persist progress on `pagehide` (best-effort; iOS may not run async work past visibility change). On next cold-launch: read state, branch per stale policy. | Persisted via `pagehide` → on relaunch enter resume flow if state present and fresh. |
| 2 | PWA backgrounded > N minutes (iOS suspends) | `visibilitychange` to `hidden` while session active; iOS may freeze the JS context with no further events fired before suspend. | Persist progress on the same `visibilitychange` → `hidden` transition (don't wait for `pagehide`, which iOS skips on suspend). On wake: if `visibilityState` flips back to `visible` within the same JS context, just re-arm audio gate (see scenario 4). If the context was killed and the app re-mounts, treat as cold-launch resume. | Same persisted state powers both wake-in-place and cold-launch-rehydrate. |
| 3 | Network drops mid-utterance (audio stops mid-word) | Howler `playerror` / `loaderror` on the in-flight Howl; `navigator.onLine === false` on next play attempt. | This is **not** an interrupt for resume purposes — the session is still "live" in memory. Math screen handles it locally: stop caption ticker, leave Melody at the last frame, surface `useAudioUnlockGate` ring on the next user gesture so she can re-tap to retry. Persisted state is unchanged. **Note:** post-Path-A, audio is local-cached in IndexedDB so true "network drop mid-utterance" should be rare — the failure mode looks more like "blob URL revoked under us" or "Howler context died." | No state change. Math screen retries via gesture. Out of this spec's scope; flagged here so we don't accidentally treat audio failure as "session abandoned." |
| 4 | Device sleep / lock (Marian closes the iPad cover) | `visibilitychange` → `hidden`. Often followed by no `pagehide` if she wakes the device within a few minutes. | Persist on `hidden`. On `visibilitychange` → `visible` within same JS context: do NOT replay the in-flight problem yet; wait for a tap. The iOS audio context may have soft-locked during sleep — re-arm `useAudioUnlockGate` with the soft-regate watchdog (250ms per `useAudioUnlockGate.ts` lines 30–35). First tap re-runs the current problem's `math.p{N}.read` utterance from the start. | If JS context survived: in-place wake. If it didn't (longer sleep, iOS killed the context): cold-launch resume per stale-session policy. |
| 5 | Browser/PWA crash | No detection from inside the dead context. Detected on next launch as "state present, but no clean `pagehide` ran." | Treat as cold-launch resume. The persisted state is the last `requestIdleCallback`-flushed snapshot (see §State persistence: write cadence). Worst-case data loss is one problem's wrong-attempt count; everything else is journaled per-problem. | Same as scenario 1's recovery, just without the `pagehide` write. The journal cadence is what saves us. |
| 6 | Marian taps home screen / accidentally swipes up | Same as scenario 1 (visibility → hidden, app dismissed). On iPad PWAs swiping up exits to home screen. | Same as scenario 1. | Same as scenario 1. |

**Cross-scenario invariants:**

- The persisted state schema is identical regardless of how the interrupt happened. The
  orchestrator does not need to know "she crashed" vs "she closed the tab" — it just reads the
  state and branches on `lastActiveAt`.
- We never show a modal asking "do you want to resume?" That would burden Marian with a decision
  she shouldn't have to make. The stale-session policy decides for her.
- We never block on persistence completing. Writes are best-effort; a failed write means worst-case
  she loses one problem's worth of progress, which is acceptable.

---

## State to persist

The full schema lives in localStorage under the key **`marian-tutor.session-progress.v1`**. This is
**locked here** as the canonical key — coordinate with Math screen's `marian-tutor.stardust.v1` and
sibling Session-end's `marian-tutor.session-history.v1`. Three keys, three concerns, no overlap:

| Key | Owner spec | Lifecycle | Concern |
|---|---|---|---|
| `marian-tutor.stardust.v1` | `screen-3-math.md` | Lifetime — never cleared | Cumulative stardust counter across all sessions |
| `marian-tutor.session-progress.v1` | This spec | Per-session — cleared on session-end | In-flight session state for resume |
| `marian-tutor.session-history.v1` | `session-end.md` (sibling ticket `86c9grnjd`) | Append-only history | Completed-session log (for parent review later) |

**Schema for `marian-tutor.session-progress.v1`:**

```typescript
type SessionProgressV1 = {
  schemaVersion: 1
  /** UUID generated at session-start; identical to the sessionId used as
   *  the IndexedDB cache key in sessionAudio.ts. Resume uses this to
   *  re-attach to the cached audio bundle. */
  sessionId: string
  /** ISO timestamp when the session was first generated (server response). */
  sessionStartedAt: string
  /** ISO timestamp updated on every state mutation. Drives stale-session decision. */
  lastActiveAt: string
  /** Always 'math' in v1. Future: 'word-song', 'mixed', etc. */
  surface: 'math'
  /** Total problems in the session (8 for Math v1). Snapshot, not derived from
   *  the session JSON, so a malformed JSON on resume can't desync the dot count. */
  totalProblems: number
  /** 1-indexed. Index of the problem Marian is currently on. If she completed
   *  problem 4 cleanly and the auto-advance fired but she closed the app before
   *  problem 5's read-aloud finished, this is 5. */
  currentProblemIndex: number
  /** Per-problem state for problems already touched. Sparse — only has entries
   *  for problems she's at least seen. */
  problemStates: Record<number, ProblemState>
  /** Stardust earned IN THIS SESSION ONLY. Separate from cumulative
   *  marian-tutor.stardust.v1; lets us replay the exact in-session count if
   *  she resumes. Cumulative was already incremented at the time of the win. */
  sessionStardust: number
  /** Streak count carried into the current problem. Same definition as
   *  screen-3-math.md §Stardust treatment: consecutive clean wins. */
  streak: number
  /** True once problem N (totalProblems) is settled and onSessionComplete has fired.
   *  Used by the cold-launch decision tree to skip the resume branch entirely. */
  completed: boolean
}

type ProblemState = {
  /** Number of wrong taps recorded BEFORE the current attempt. Used by the
   *  Math screen to gate hint (after 2) and guided completion (after 3).
   *  Reset to 0 on resume — she shouldn't be punished for the interrupt. */
  wrongAttempts: number
  /** Whether the hint TTS played for this problem. Survives interrupt so we
   *  don't re-show a hint she already saw. */
  hintShown: boolean
  /** Whether the giveAnswer / guided-completion fallback fired. */
  guidedCompletionShown: boolean
  /** Set when she finally answered correctly (clean or after retries). */
  correct: boolean
  /** Whether stardust was awarded for this problem. False for guided-completion
   *  wins (per screen-3-math.md §Stardust treatment). */
  stardustAwarded: boolean
}
```

**Write cadence:**

- **On every state mutation** the Math screen makes (chip tap correct, chip tap wrong, hint
  shown, problem auto-advance, etc.), the orchestrator updates the in-memory `SessionProgressV1`
  and calls `localStorage.setItem` synchronously. localStorage writes on iPad Safari are sub-ms
  for payloads this size; no need to defer.
- **`lastActiveAt` ticks on every mutation** — even reading the same field unchanged. This is
  what keeps the stale-session timer fresh while she's actively playing.
- **On `visibilitychange` → `hidden` and on `pagehide`**, do one final synchronous write. Safe
  no-op if nothing changed. This is belt-and-braces for scenarios 1, 2, 4, 6.
- **No idle/throttled writes** — the payload is small (<2 KB even for a fully-played session) and
  the synchronous write is cheaper than the bookkeeping.

**Defensive read on cold-launch:**

```typescript
function readSessionProgress(): SessionProgressV1 | null {
  try {
    const raw = localStorage.getItem('marian-tutor.session-progress.v1')
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidSessionProgressV1(parsed)) return null
    return parsed
  } catch {
    return null
  }
}
```

If read fails for any reason (private-browsing iOS, JSON corruption, schema mismatch), return
`null` and start fresh. Never crash the cold-launch on a bad persisted record.

**Schema versioning:** the `schemaVersion: 1` field exists so a future `v2` (e.g., when Word Song
joins and `surface` becomes a discriminated union, or when we add per-utterance audio-replay state)
can migrate cleanly. v2 implementation pattern: read both keys, prefer `v2`, migrate `v1` →
`v2` on read if present, then write `v2` and delete `v1`. Out of scope for this ticket.

---

## Stale-session policy

**Recommended threshold: 30 minutes.** If `Date.now() - Date.parse(record.lastActiveAt) >= 30 * 60 * 1000`,
the persisted session is stale; discard it and start a fresh session. Otherwise resume.

**Rationale:**

- **Long enough to handle real-world interruptions:** a parent calling Marian for lunch, a
  bathroom break, a "quick check on the dog", a school pickup that ran long. 30 minutes covers
  the realistic "she meant to come back" window without requiring her to remember she was
  mid-session.
- **Short enough to feel like "today":** if she comes back after an hour, the cognitive context
  is gone — she won't remember which problem she was on, what flowers were on screen, what she
  was about to tap. Better to start fresh than to drop her into the middle of something she's
  already mentally let go of.
- **Discourages cliff-hangers:** if she's interrupted at problem 3 and the session waits for
  her overnight, then she resumes at 7am the next day, the resumed session is no longer the
  thing it was when she walked away. The 30-minute cap makes "resume" honestly mean "still the
  same play session."
- **Below the iOS PWA suspension window:** iPadOS aggressively suspends backgrounded PWA audio
  contexts at around 5 minutes; full memory eviction follows in tens of minutes. 30 is a
  natural ceiling that aligns with "the JS context is probably dead anyway."

**Dave-consult flag (Open Question §1).** 30 minutes is Kyle's default based on developmental
and product-shape reasoning above. The right number for an 8-year-old's attention/memory
chunking might be different — Dave should weigh in. **Until Dave responds, ship 30.** It's a
single constant in the orchestrator (`STALE_SESSION_MS`); a one-line change if he wants
shorter/longer.

**Edge case — clock skew:** if `lastActiveAt` is in the future (system clock changed), treat as
stale and start fresh. Don't trust an in-the-future timestamp.

**Edge case — `record.completed === true`:** discard regardless of age. A completed session is
not a resume candidate; she beat it.

---

## Mid-problem behaviour on resume

When the cold-launch decision tree picks the resume branch, this is exactly what Marian sees and
hears:

1. **Splash auto-advances** per Session-1 Screen 1. No change.
2. **Math screen mounts directly** — Greet is skipped on resume. Marian has already met Melody
   today; replaying the greeting would be confusing ("why is she saying hi again?").
3. **Background fades in** as `bg-garden.svg` (Math's background). No clouds → garden cross-fade
   on resume — there's no clouds screen to come from.
4. **Melody enters** in her upper-left position directly (no `layoutId` shrink animation on
   resume — she didn't transition from anywhere). Pose: `melody-idle.svg`, breathing loop.
5. **HUD strip fades in** showing:
   - Stardust counter: cumulative `marian-tutor.stardust.v1` total (NOT just session — see Open
     Question §4 for the contrary option, but default is cumulative for consistency with the
     in-session display contract).
   - Problem dots: filled for completed (per `problemStates[i].correct === true`), outlined for
     upcoming, current dot has the soft ring.
   - Streak indicator: visible iff persisted `streak >= 2`, showing the persisted value.
6. **Resume callout caption** appears in the speech ribbon, brief and warm:
   - **"Welcome back!"** plays as TTS (see §Audio integration: resume utterances).
   - Caption ribbon mirrors word-by-word per Path A `onWordTick`.
7. **A second line follows after a 600ms beat:**
   - **"Let's keep going."** plays as TTS.
8. **Heart-tap affordance appears** in the bottom thumb zone (reuse `heart-button.svg` from
   Session-1 Screen 2, sized identically at 88pt tall × 120pt wide). Marian must tap it to
   continue. **Do not auto-start the resumed problem's audio** — iPad audio unlock requires a
   user gesture, and the heart-tap is the cleanest gesture-aligned re-entry point.
9. **On heart tap:**
   - Soft chime SFX (`sfx-chime-soft.mp3`).
   - Heart squish animation (250ms, identical to Session-1).
   - Heart fades out.
   - **Replay the current problem's `math.p{N}.read` utterance from the start.** Marian's
     working memory was interrupted; she needs the read-aloud again to re-anchor.
   - Caption ribbon ticks word-by-word with the read-aloud.
   - Problem display + answer chips do their normal staggered reveal in parallel with the
     read-aloud (per Math screen's standard problem entry).
10. **From here forward, the Math screen behaves identically to a non-resumed session.**

**Per-problem state on resume:**

| Field | Behaviour on resume |
|---|---|
| `wrongAttempts` | **Reset to 0** for the current problem. She shouldn't be penalised for the interrupt — the interruption itself is not a "wrong tap." |
| `hintShown` | **Preserved.** If she saw the hint before the interrupt, do not auto-replay it. The hint state machine still arms after 2 wrongs as normal; the persisted `hintShown` only affects whether the hint plays again unprompted. (It doesn't, in this design — hints only fire on the 2-wrong threshold mid-session.) |
| `guidedCompletionShown` | **Preserved.** Same logic. |
| `stardustAwarded` | **Preserved** for prior problems. The current problem's value is still false until she answers correctly. |
| `correct` | **Preserved** for prior problems. Current problem's value is false until she answers. |
| `sessionStardust` | **Preserved.** The HUD shows cumulative stardust per Open Question §4, but internal session-stardust accumulator is needed to re-evaluate the streak-bonus thresholds (3, 5, 8) without double-awarding. |
| `streak` | **Preserved.** The interrupt does not break the streak. (Dave-consult flag — Open Question §3. If Dave says interrupts SHOULD break streak, change this default.) |

**Why preserve streak across interrupt (default):**

- The streak indicator is a quiet "you're on a roll" pat-on-the-back per `screen-3-math.md`'s
  anti-dark-pattern audit. Breaking it on a non-Marian-caused event (parent called her away,
  iPad suspended itself) would be exactly the streak-shame pattern we're avoiding.
- The interrupt is structurally different from a wrong tap. A wrong tap is a Marian-action that
  reset the streak per the established rule. An interrupt is the world acting on her, not her
  acting on the problem.
- **Dave-consult:** an 8-year-old might or might not feel the same way — she might genuinely
  feel like the streak "should have" broken when she came back the next day. Dave to weigh in;
  default behaviour is preserve.

---

## Audio cache validity

Path A's audio bundle is generated at session-start by the Vercel function and shipped inline as
base64 MP3 in the session JSON. The `sessionAudio.ts` module persists these to IndexedDB under
key `sessionId` (matching this spec's `SessionProgressV1.sessionId`). On resume, we want to
replay from cache — no re-render via `/api/claude`, no extra network round-trip.

**Resume audio bring-up sequence:**

```
1. Read session-progress.v1 from localStorage          → got sessionId, currentProblemIndex
2. Decide: stale? → if stale, drop; clearSessionAudio(sessionId); generate fresh session
   Otherwise:
3. Reconstruct utterance list from the session JSON cached alongside progress (see below)
4. sessionAudio.loadSessionAudio(sessionId, utterances)
   ├─ IDB cache hit  → existing base64 → build Howls → return
   └─ IDB cache miss → fall back to inline base64 from utterance objects → build Howls → return
                       (caller decides how it got the utterance objects; see below)
5. Render Math screen with currentProblemIndex
6. Wait for heart tap
7. On heart tap: sessionAudio.playSessionUtterance(`math.p${N}.read`)
```

**Where do the utterance objects come from on resume?** The Vercel session response is a single
JSON blob containing both the problem set and the utterance list. We need that blob accessible
on cold-launch. Two options, recommend **Option B**:

- **Option A — Persist the full session JSON in localStorage too.** Adds a third localStorage
  key `marian-tutor.session-plan.v1` storing the raw response. Simple, but ~600 KB JSON pushes
  localStorage's ~5 MB iPad budget and is wasteful given the audio is already in IDB.
- **Option B — Persist just the lightweight session plan in localStorage; let `sessionAudio`
  rehydrate from IDB on its own.** Add a `marian-tutor.session-plan.v1` localStorage key
  storing only the non-audio parts of the session: problem set (numerals, distractors, correct
  answers) plus the utterance metadata (id, text, mime — but NOT the base64). On resume:
  - If IDB has the session's audio bundle → load utterances with empty `audio.base64` (audio
    comes from cache).
  - If IDB does NOT have it (cache evicted; quota; manual clear; PWA data wipe) → fall back to
    the network: re-call the Vercel `/api/claude` endpoint with `{ sessionId, regenerateAudio: true }`
    and a hint that this is a resume rehydrate (the prompt should re-emit the same problem set
    using the persisted seed; if that's not feasible, accept that distractors might be re-rolled
    but problem operands stay the same — flagged for §Open Questions §5).

**Option B chosen.** Lighter localStorage footprint, single source of truth (IDB) for audio,
graceful fallback when cache is gone.

**Schema for `marian-tutor.session-plan.v1` (companion to `session-progress.v1`):**

```typescript
type SessionPlanV1 = {
  schemaVersion: 1
  sessionId: string
  surface: 'math'
  problems: MathProblemSpec[]   // 8 entries; same shape api/_session.ts emits
  utteranceMetadata: Array<{
    id: string                  // e.g. 'math.p3.read'
    text: string                // for caption rendering
    mime: 'audio/mpeg'
    // base64 deliberately omitted — IDB owns it
  }>
}
```

This is a third locked localStorage key. Updated `coordinate with` table:

| Key | Owner spec | Lifecycle | Concern |
|---|---|---|---|
| `marian-tutor.stardust.v1` | `screen-3-math.md` | Lifetime — never cleared | Cumulative stardust counter |
| `marian-tutor.session-progress.v1` | This spec | Per-session — cleared on session-end | In-flight session state for resume |
| `marian-tutor.session-plan.v1` | This spec | Per-session — cleared on session-end | Lightweight session plan (no audio base64) for cache-miss recovery |
| `marian-tutor.session-history.v1` | `session-end.md` (`86c9grnjd`) | Append-only history | Completed-session log |

**Cache-miss recovery flow (IDB cleared but progress + plan present):**

```
sessionAudio.loadSessionAudio(sessionId, utterancesWithEmptyBase64)
   │
   └─ buildHowls() detects all base64 strings are empty
      │
      ├─ logs warning, calls onCacheMiss callback (new sessionAudio surface? or
      │  caller checks IDB before calling?)
      └─ orchestrator catches → POST /api/claude { sessionId, mode: 'rehydrate' }
         │
         ├─ Vercel returns same session JSON shape, audio inline
         ├─ orchestrator calls sessionAudio.loadSessionAudio again with full payload
         └─ proceeds to step 5 of bring-up sequence above
```

**Quota-exceeded fallback (per audio-architecture.md):** if IDB write fails on session-start
because of quota, the in-memory base64 keeps the live session working but evaporates on cold-
launch. On the next cold-launch resume attempt, IDB has nothing → cache-miss recovery flow
runs → fresh server fetch. Behaviour: Marian sees a slightly longer "thinking" beat after
heart-tap (the rehydrate fetch). Acceptable for a rare edge case.

**Cache-miss recovery timing:** if the rehydrate POST takes > 1500ms, surface a soft "thinking"
indicator (Melody pose: idle, with a single small breathing pulse on a sparkle particle near
her ear — gentle, not a spinner). At 5000ms, fall back to fresh-session (discard
`session-progress.v1` and `session-plan.v1`, run the standard fresh-session flow). Network
failures are rare on home wifi but we shouldn't strand Marian staring at a heart-tap that
won't load.

---

## UX surface on resume — what Marian sees

### Visual layout (resume entry — happens between splash and first problem)

```
+------------------------------------------+
|        [safe area top]                   |
|                                          |
|  ★ 14    ●●●●○○○○        🔥 3            |  <- HUD strip, persisted state visible
|                                          |
|  ~ pastel garden background ~            |
|                                          |
|  ( Melody     +-------------------+      |
|    upper-     | "Welcome back!"   |      |  <- ribbon, resume callout
|    left,      |                   |      |
|    ~30vh )    +-------------------+      |
|                                          |
|                                          |  <- problem display NOT mounted yet
|                                          |     (waits for heart tap)
|                                          |
|                                          |
|                                          |
|         [ PINK HEART BUTTON ]            |  <- thumb zone, 88×120pt
|         (reused from Greet)              |
|                                          |
|        [safe area bottom]                |
+------------------------------------------+
```

### Visual layout (after heart tap — transitions to standard Math problem state)

Identical to `screen-3-math.md` §Visual layout. Heart fades, problem display + chips do their
standard staggered reveal in parallel with the `math.p{N}.read` utterance.

### Cold-launch decision branches Marian sees

| Decision | First audible line | Visual cue |
|---|---|---|
| Fresh session (no record, or stale, or completed) | Greet's "Hi!" → standard Greet → Math | Standard Session-1 flow per `session-1.md` |
| Resume (record present, fresh) | "Welcome back!" → "Let's keep going." (after heart tap: `math.p{N}.read`) | HUD shows progress dots filled for completed problems; problem N is the current dot with the ring |

**No "would you like to resume?" dialog.** Per the cross-scenario invariants, we never make
Marian decide.

### What Marian does NOT see on resume

- No "you were interrupted!" callout. The interrupt is invisible from her side.
- No "you have N problems left" copy. The HUD problem-dots already convey that visually.
- No "you've earned X stardust this session so far" callout. The HUD counter shows the live
  cumulative number.
- No "your streak is still alive!" or "your streak survived the break!" copy. The streak
  indicator just is what it is.
- No timestamp ("you last played 8 minutes ago"). Adults like that; an 8-year-old doesn't read it.

---

## Audio integration: resume utterances

Two new utterances to add to the Path A bundle on session-start. These are session-agnostic
(content doesn't depend on which problem she's on) but should be rendered server-side at
session-start so they're available in the cache from day one.

| `id` | Sample text | When played | SSML rate | SSML pitch | Notes |
|---|---|---|---|---|---|
| `meta.welcomeBack` | "Welcome back!" | Resume entry, before heart tap | `-10%` | default | Plays unprompted on resume mount. Marian doesn't need to tap to hear this — but audio context may not be unlocked yet, so this utterance must be wrapped in `useAudioUnlockGate.wrapSpeak()`. If the engine rejects (cold context), the gate ring surfaces and her tap on the heart triggers the retry that includes this line. |
| `meta.keepGoing` | "Let's keep going." | 600ms after `meta.welcomeBack` ends | `-10%` | default | Same gate-handling. Caption appears after Welcome Back's caption finishes. |

**Word-count check** against the 200-word vocabulary cap:
`welcome, back, let's, keep, going` — 5 unique words. `welcome` and `keep` and `going` are
**new** (not in Session-1's ~40-word inventory). Within cap. Added to the global session
inventory; flag to Thomas via Matt for sign-off on the new words being in-character for Melody.

**Bundle cost:** 2 utterances × ~15 KB each = **+30 KB per session JSON.** Negligible against
the existing ~600 KB Math budget.

**Open question §2 — is this welcome-line worth the bundle cost on EVERY session?** Answer:
yes. Bundle cost is trivial. Every session might be a resume-from-stale (in which case the
utterance is unused but cheaply ignored). The alternative — render it on-demand at resume time
— requires a network round-trip on cold-launch and adds latency to the warmest moment of the
flow. Always-bundled wins.

**Reuses existing SFX:** `sfx-chime-soft.mp3` for the heart tap (already on assets-todo). No
new SFX authoring needed for resume.

---

## States (resume orchestrator)

### Idle (decision phase, ~50ms after splash auto-advance)

`readSessionProgress()` and `readSessionPlan()` run. Both reads are synchronous localStorage
calls. Decision tree branches per §"User state entering this surface".

### Resume — pre-heart-tap

Math screen mounted with HUD restored from persisted state, Melody in upper-left idle pose,
welcome-back utterances queued/played, heart button visible in thumb zone. Awaiting tap.

### Resume — post-heart-tap

Standard Math screen problem state per `screen-3-math.md` §States. The current problem index
is `currentProblemIndex` from persisted state; everything before it is presented as
already-completed in the HUD dots.

### Resume — audio cache miss (rare)

Heart-tap fires. Orchestrator detects empty audio in `sessionAudio.loadSessionAudio` result.
Surfaces "thinking" indicator (gentle sparkle pulse near Melody's ear, NOT a spinner) for up
to 1500ms. Triggers `/api/claude` rehydrate POST. On success: standard post-heart-tap state.
On 5000ms timeout or POST failure: fall through to fresh-session entry, discarding both
localStorage keys.

### Stale-session detection — fresh-session entry

Persisted record discarded. `clearSessionAudio(sessionId)` called for the discarded session.
Standard fresh-session flow runs (Greet → Math, generated server-side). No callout to Marian
that her old session was discarded.

### Completed-session detection

`record.completed === true` — record discarded silently. Standard fresh-session flow runs.

### Empty / first visit

No persisted record. Fresh-session flow runs. This is identical to today's behaviour pre-this-
spec. The resume orchestrator is a transparent passthrough when there's no state to act on.

### Transition in (resume entry)

Background fades in from cream (splash) → garden over 500ms. Melody scales in from `{ scale:
0.95, opacity: 0 }` → `{ scale: 1, opacity: 1 }` with spring `{ stiffness: 200, damping: 20 }`,
landing in upper-left position. HUD strip fades in over 300ms after Melody settles. Speech
ribbon scales in (`{ stiffness: 260, damping: 20 }`) when `meta.welcomeBack` starts. Heart
button scales in from `{ scale: 0, opacity: 0 }` with spring `{ stiffness: 300, damping: 15 }`
after `meta.keepGoing` completes (~3000ms after mount in normal flow).

### Transition out (heart tap → first problem)

Heart squishes (250ms) and fades. Speech ribbon empties (caption lines fade individually,
200ms each). Problem display + answer chips begin their standard staggered reveal at the same
time `math.p{N}.read` starts.

---

## Assets required

Reused from existing specs (no new authoring):

| Asset | Source | Purpose on resume |
|---|---|---|
| `melody-idle.svg` | Already in repo | Default pose throughout resume entry |
| `bg-garden.svg` | `screen-3-math.md` (assets-todo) | Math background |
| `heart-button.svg` | Session-1 Screen 2 | Resume continue affordance |
| `sfx-chime-soft.mp3` | Greet (already on assets-todo) | Heart tap SFX |
| `star-filled.svg` | `screen-3-math.md` | HUD stardust glyph (persisted total) |
| `icon-flame.svg` (or sparkle alternative per Math §Open Question §4) | `screen-3-math.md` | HUD streak indicator (persisted streak) |
| `flower-glyph.svg`, `sparkle-particle.svg` | `screen-3-math.md` | Standard Math problem assets, used post-heart-tap |

**No new visual assets required for this spec.** Resume reuses Math + Greet's existing kit.

**New audio (TTS, generated server-side):**

| Asset | Generated by | Cost |
|---|---|---|
| `meta.welcomeBack` utterance | Vercel `api/_tts.ts` at session-start | +15 KB inline base64 / session JSON |
| `meta.keepGoing` utterance | Vercel `api/_tts.ts` at session-start | +15 KB inline base64 / session JSON |

Total: **+30 KB / session JSON.** Within Vercel 4.5 MB response cap.

**No new static SFX** — heart-tap chime is reused.

---

## Acceptance criteria (Jessica)

### Persistence

- [ ] On every Math screen state mutation (chip tap correct, chip tap wrong, hint shown, problem auto-advance, session start), `marian-tutor.session-progress.v1` is updated synchronously
- [ ] `lastActiveAt` timestamp updates on every mutation, ISO format
- [ ] On `visibilitychange` to `hidden` and on `pagehide`, a final synchronous write happens
- [ ] `marian-tutor.session-plan.v1` is written once on session-start and not mutated thereafter
- [ ] On session-end (problem 8 settled OR fresh-session start that discards a stale record), both keys are removed from localStorage and `sessionAudio.clearSessionAudio(sessionId)` is called
- [ ] Both schemas include `schemaVersion: 1` field
- [ ] Bad/corrupt persisted records are detected on read and treated as "no record"

### Cold-launch decision tree

- [ ] If no `session-progress.v1` record exists: standard fresh-session flow (Greet → Math)
- [ ] If `record.completed === true`: standard fresh-session flow (record silently discarded)
- [ ] If `Date.now() - Date.parse(record.lastActiveAt) >= 30 * 60 * 1000`: standard fresh-session flow, both keys discarded, audio cache cleared
- [ ] If `record.lastActiveAt` is in the future (clock skew): treated as stale, fresh flow
- [ ] If record is fresh and incomplete: resume flow per §UX surface
- [ ] No "would you like to resume?" dialog appears in any scenario

### Resume entry UX

- [ ] On resume, Greet is skipped — Math screen mounts directly after splash
- [ ] Background fades in to `bg-garden.svg` (no clouds → garden cross-fade, since no clouds)
- [ ] Melody appears in upper-left idle pose (no `layoutId` shrink animation)
- [ ] HUD strip restores: cumulative stardust counter, problem dots reflecting `problemStates[i].correct`, current dot has ring on `currentProblemIndex`, streak indicator visible iff persisted `streak >= 2`
- [ ] `meta.welcomeBack` TTS plays unprompted (wrapped in `useAudioUnlockGate.wrapSpeak`); caption ribbon mirrors word-by-word
- [ ] After 600ms beat, `meta.keepGoing` TTS plays; caption appended
- [ ] Heart button appears at 88×120pt in bottom thumb zone after `meta.keepGoing` completes
- [ ] No problem display or answer chips render until heart is tapped

### Mid-problem behaviour on resume

- [ ] Heart tap triggers chime SFX, heart squish (250ms), heart fade-out
- [ ] Heart tap triggers `math.p{N}.read` utterance from the start (not resumed mid-utterance)
- [ ] Problem display + answer chips do standard staggered reveal in parallel with read-aloud
- [ ] Current problem's `wrongAttempts` is reset to 0 (interrupt is not penalising)
- [ ] Current problem's `hintShown` and `guidedCompletionShown` are preserved (no auto-replay)
- [ ] Prior problems' `stardustAwarded` and `correct` are preserved
- [ ] `streak` counter is preserved across the interrupt (does not reset to 0)
- [ ] After heart-tap, Math screen behaves identically to non-resumed sessions

### Audio cache validity

- [ ] On resume, `sessionAudio.loadSessionAudio(sessionId, utterances)` is called with persisted sessionId
- [ ] If IDB cache hit: audio plays from cache; no `/api/claude` call
- [ ] If IDB cache miss with progress + plan present: rehydrate POST to `/api/claude` fires; soft "thinking" indicator surfaces if rehydrate > 1500ms
- [ ] If rehydrate succeeds: standard post-heart-tap flow with rehydrated audio
- [ ] If rehydrate fails or > 5000ms: fall through to fresh-session, both localStorage keys cleared
- [ ] Quota-exceeded write at session-start does NOT crash the live session

### Interrupt scenarios (matrix)

- [ ] Tab close (scenario 1): `pagehide` fires final write; cold-launch resume works
- [ ] Background > 5 min (scenario 2): `visibilitychange` → `hidden` fires write; on cold-launch resume, audio context re-arms via `useAudioUnlockGate` soft-regate (250ms watchdog)
- [ ] Wake-in-place from short background (scenario 4 short): `visibilitychange` → `visible`, no replay until next user gesture, gate ring surfaces if needed
- [ ] Cold-launch from killed context (scenarios 1, 2 long, 4 long, 5, 6): same resume flow regardless of cause
- [ ] Network drop mid-utterance (scenario 3): NOT treated as interrupt; Math screen handles locally; persisted state unchanged

### Anti-dark-pattern

- [ ] No "you've been gone for X" copy or visualisation
- [ ] No "don't lose your progress!" callout
- [ ] No "your streak is in danger!" copy
- [ ] No "would you like to resume?" friction modal
- [ ] No nag re-prompt if she doesn't tap the heart within N seconds (single welcome-back, no second prompt)
- [ ] Streak break does NOT happen across an interrupt (subject to Open Question §3)

### iPad PWA

- [ ] On a real iPad PWA install: closing the app mid-session-problem-3, reopening within 30 min, results in resume entry showing problem-3 dot with ring, heart-tap returns her to a re-read of problem-3
- [ ] Closing mid-session, reopening after 31+ min, results in fresh Greet flow with no callout
- [ ] Persisted writes via `pagehide` succeed on iPad Safari PWA (vs the documented "iOS doesn't run async work past visibility change" issue — final write must be synchronous)

---

## Out of scope

Explicitly NOT covered by this spec, with the ticket that owns each:

- **Session-end transition** (problem 8 → reward / next surface) — `86c9grnjd` (`design/session-end.md`).
- **Multi-device sync** (start session on iPad, finish on phone). v1 is single-device only. No
  account, no cloud sync, no QR-code-handoff. Future ticket if/when Marian gets a second device.
- **Cross-session resume of older sessions.** Once a new session starts (fresh OR resume that
  ages out), the previous incomplete session is gone. There is no "session library" to pick
  from. Future ticket if parental dashboard wants this.
- **Replay-old-sessions feature** (parental review of completed sessions). The
  `marian-tutor.session-history.v1` log exists for this future surface but no UI consumes it
  in v1. Owned by sibling ticket `86c9grnjd` for the write side; read-side UI is separate
  future work.
- **Save-to-cloud / account login.** Family-local PWA only.
- **Word Song resume.** This spec's schema accommodates `surface: 'word-song'` for forward
  compatibility but the v1 implementation only wires Math. When Word Song joins, extend
  `surface` to a discriminated union and add per-surface state.
- **Mid-problem audio resume** (replay an utterance from the timestamp where it stopped). On
  resume we always replay the current problem's `math.p{N}.read` from the start. Mid-utterance
  resume is engineering complexity for negligible UX gain — Marian's working memory benefits
  more from a clean re-read.
- **Session pause / explicit "save and quit" UI.** No pause button exists. Closing the PWA is
  the pause action; there is no in-app affordance for it. (Future ticket if parents request.)
- **Notification on stale-session cleanup** (e.g. "Your last session was discarded because it
  was over 30 minutes ago"). Silent discard is the default and the right call.
- **Telemetry / analytics on resume usage.** No collection in v1. If we ever want to know "how
  often does Marian use resume", that's a separate spec with its own privacy/storage decisions.

---

## Implementation pointers (for Devon, ticket TBD)

**File layout (proposed):**

```
src/screens/Math/
├── (existing files per screen-3-math.md)
├── sessionProgress.ts           # localStorage read/write helpers; schema versioning
├── sessionPlan.ts               # localStorage read/write for the plan companion
├── resumeOrchestrator.ts        # Cold-launch decision tree + scenario dispatch
└── visibilityHandlers.ts        # visibilitychange + pagehide listeners; final-write logic
```

**Key contracts:**

```typescript
// sessionProgress.ts
export const STORAGE_KEY = 'marian-tutor.session-progress.v1'
export const STALE_SESSION_MS = 30 * 60 * 1000  // 30 min — Dave-consult Open Q §1
export function readSessionProgress(): SessionProgressV1 | null
export function writeSessionProgress(state: SessionProgressV1): void
export function clearSessionProgress(): void
export function isStale(record: SessionProgressV1, now: number = Date.now()): boolean

// resumeOrchestrator.ts
export type ColdLaunchDecision =
  | { kind: 'fresh' }
  | { kind: 'resume'; progress: SessionProgressV1; plan: SessionPlanV1 }
export function decideColdLaunch(now: number = Date.now()): ColdLaunchDecision
```

**Reuse, do not re-derive:**

- **`useAudioUnlockGate`** — wrap both `meta.welcomeBack` and `meta.keepGoing` plays in
  `gate.wrapSpeak()`. The watchdog handles the cold-context first-utterance miss; the heart-tap
  is the natural retry gesture.
- **`sessionAudio.loadSessionAudio` + `playSessionUtterance`** — already designed for resume:
  the `loadSessionAudio` early-return path (lines 305–308 of `sessionAudio.ts`) handles
  same-session reload, and the IDB cache (lines 126–226) handles cold-launch rehydrate.
- **HUD components from `screen-3-math.md`** — no new HUD work; restore from persisted state on
  resume mount, then operate normally.
- **Heart button styling** — reuse Greet's heart implementation directly; same pose, same
  spring, same hit-target.

**Things to be careful about:**

- **`pagehide` and iOS PWA reality.** iOS Safari is documented to limit what runs after
  visibility change; async writes can be lost. Keep the final-write 100% synchronous, no
  awaits, no microtasks. Test on real iPad before signing off this AC.
- **localStorage write atomicity.** `setItem` is synchronous and atomic for a single key, but
  if you write progress then plan in two separate calls, a crash between them leaves an
  inconsistent state. Mitigation: write progress FIRST (it's the source of truth), plan SECOND
  (it's the helper); on cold-launch, if progress is missing or invalid, ignore plan
  regardless. Single-direction dependency.
- **Sparse `problemStates`.** The map only has entries for problems she's touched. The HUD
  must render outlined dots for indices not in the map; don't crash on missing keys.
- **Heart-tap audio gate vs. unprompted welcome-back.** Order matters. The unprompted
  `meta.welcomeBack` plays before any user gesture. iPad may reject it. The gate ring should
  surface on the welcome-back's watchdog expiry, NOT on the heart button (the heart's already
  visible by the time the gate would show). Treat the heart as the gesture that retries the
  welcome-back utterance through `dispatchGesture()` if relock occurred.
- **Session JSON re-fetch on cache miss.** The Vercel `/api/claude` endpoint may not currently
  support a "rehydrate same sessionId" mode. Confirm with Kevin/Devon whether this needs an
  API change or if a fresh session is acceptable when cache misses (Open Question §5). If
  fresh-session-on-miss is acceptable, simplify the flow: on IDB miss, just discard everything
  and run fresh.

**Test seams:**

- `decideColdLaunch` takes `now` parameter for time-travel tests.
- `resumeOrchestrator` takes `storage?: StorageAdapter` for in-memory mock.
- `visibilityHandlers` accepts a `documentLike` param for jsdom-friendly tests.
- All localStorage operations wrapped in try/catch; tests assert quota-exceeded and corrupted-JSON
  paths return `null` cleanly.

---

## Open questions (need Thomas / Dave)

1. **Stale-session threshold (Dave consult — flag to orchestrator for routing).** 30 minutes
   is Kyle's default for an 8-year-old based on developmental and product reasoning. Dave's
   sign-off would lock it. If he says shorter (15? 20?) or longer (45? 60?), one-line change in
   `STALE_SESSION_MS`. **Default until Dave responds: 30 min.** Non-blocking on impl.

2. **Bundle cost of `meta.welcomeBack` + `meta.keepGoing` on every session.** They cost ~30 KB
   inline base64 per session JSON, played only when the session is a resume. Default
   recommendation is ship them on every session (always-bundled simpler than on-demand;
   negligible cost; no cold-launch network call needed). Confirm Thomas is okay with that.

3. **Streak preservation across interrupt (Dave consult).** This spec defaults to "interrupt
   does NOT break streak" — the interrupt is structurally different from a wrong tap, and
   streak-shame on a non-Marian-caused event is anti-pattern. But an 8-year-old's intuition
   might disagree (she might feel the streak "should have" reset overnight). Dave to weigh in.
   **Default until Dave responds: preserve streak across interrupt.**

4. **Cumulative stardust display on cold-launch resume.** Default: show cumulative total
   (matching the in-session display contract from `screen-3-math.md` §Stardust treatment). The
   contrary option is to show only the in-session count earned so far this session. Showing
   cumulative is consistent with the rest of the surface; showing in-session is more accurate
   to "how did this session go." Recommend cumulative; flag for Thomas's call.

5. **`/api/claude` rehydrate endpoint shape.** This spec assumes the Vercel function can be
   asked to re-emit the same session JSON given a `sessionId` (perhaps with a stored seed for
   the Claude prompt so the problem set is identical). If that's not the case, options are:
   (a) build the rehydrate endpoint, (b) accept that cache-miss = fresh-session-fallback (the
   simpler choice). Recommend (b) for v1: cache-miss is rare, and a fresh fallback is
   acceptable for that edge case. Lock with Kevin/Devon.

6. **Pre-emptive cache eviction policy.** Currently the IDB cache is keyed per-session and
   only cleared on session-end. If Marian completes 100 sessions over months, the IDB store
   accumulates 100 sessions' worth of audio (60 MB). iPad's IDB quota is generous but not
   infinite. Should we evict completed-and-archived session bundles after N days? Out of scope
   for this spec but flag for backlog. **Default for v1: no eviction policy; revisit if quota
   becomes an issue in QA.**

7. **What if the persisted plan and progress disagree?** Edge case: progress says
   `currentProblemIndex: 5` but plan only has 4 problems. This shouldn't happen (both written
   atomically per session-start) but defensive: validate plan length >= currentProblemIndex on
   read; if not, treat as corrupted, discard both, fresh-session. Confirm this is the right
   conservative posture.

---

## Anti-dark-pattern audit (this surface)

Per CLAUDE.md non-negotiables, confirmed absent from this spec:

- [x] No variable-ratio reward — resume entry plays the same two utterances every time, with no
      randomness or surprise mechanic. The heart-tap behaves identically to its Session-1 use.
- [x] No streak shame — interrupt does not break streak (default, subject to Dave consult); when
      streak does break (via a wrong tap mid-resumed-session), behaviour is the standard quiet-
      fade per `screen-3-math.md` §Streak break.
- [x] No fake urgency — no "hurry back!" copy, no "X minutes until your session expires" timer,
      no "your progress will be lost in N seconds" pressure. Stale cleanup is silent.
- [x] No social pressure — no "you'll let Melody down if you don't come back" anthropomorphic
      guilt, no comparison to other kids, no share affordance.
- [x] No infinite content — resume always re-enters the same finite 8-problem session.
- [x] No dark patterns on exit — there is no in-app exit affordance to dark-pattern; the iPad
      home button / swipe is the exit mechanism and it just works.
- [x] No surprise costs — no IAP, no "unlock to resume" gating, no monetization.
- [x] Wrong answers are never punished, including the "wrong" of being interrupted — no
      penalty stardust loss, no progress reduction, no apology copy demanded from Marian.

---

## Provenance

- Brief: ClickUp ticket `86c9grnjf` (normal priority, week-3, follows Math impl `86c9grn33`).
- Math screen canonical reference: `design/screen-3-math.md` (PR #38, commit `8a2e477`).
- Audio architecture canonical reference: `design/audio-architecture.md`.
- Path A frontend surface: `src/lib/audio/sessionAudio.ts` (Path A, sibling worktrees;
  pending merge to `main` per audio-architecture.md "Path A PR pending" note).
- Sibling spec running in parallel: ticket `86c9grnjd` (`design/session-end.md`).
- Audio gate hook: `src/lib/audio/useAudioUnlockGate.ts`.
- Session-1 first-run walkthrough: `design/session-1.md`.
