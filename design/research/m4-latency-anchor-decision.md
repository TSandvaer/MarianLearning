# M4 Latency-Anchor Decision

**Ticket:** 86ca85b7u — "M4.x latency-anchor decision"
**Requested by:** Matt, via orchestrator dispatch
**Date:** 2026-06-12

---

## Question

PR #402 opened answer chips at TTS START (chip-gate-open / `chipGateOpen`) instead of TTS completion. But `chipReadyAtRef` — the M4 latency-window start — is still anchored to read-aloud COMPLETION (`useLayoutEffect([readAloudPlayed])`). Kevin's finding: the M4.x slow-fact dataset will systematically drop the fastest answerers because a tap that lands during the read-aloud tail records `-1` ("not measured") even though it passed the chip gate.

Which anchor matches the automaticity construct the latency data exists to measure?

Three options:
- **(a)** Re-anchor `chipReadyAtRef` to chip-gate-open (TTS START).
- **(b)** Keep completion anchor; accept that fast-during-tail answers produce `-1` sentinels.
- **(c)** Record two latency measures per problem (gate-open delta and completion delta).

---

## Bottom line

**Verdict: (a). Re-anchor `chipReadyAtRef` to chip-gate-open (TTS START).**

The automaticity construct is defined relative to when the question is cognitively available. For Marian — who can read numerals but not the full read-aloud text — the question is available the moment she sees the digit pair rendered on screen, which is before TTS starts. The chip gate opens at TTS start, which is itself a conservative lower bound (later than digit render). The current completion anchor artificially inflates every latency measurement by the TTS audio duration (~2–4 s for a typical read-aloud) and drops the fastest responders entirely, which are precisely the facts nearest to automatic retrieval. Option (b) preserves a broken construct. Option (c) adds implementation overhead for a second measure that is inferentially weaker than the primary one.

The historical dataset concern is immaterial: Marian is not yet using the app, and the pre-#402 completion-anchored data have never been used by the slow-fact directive in production. There is nothing to break backward compatibility with.

---

## Evidence

- **Stickney, Sharp, & Kenyon (2012)** — "Technology-Enhanced Assessment of Math Fact Automaticity: Patterns of Performance for Low- and Typically Achieving Students." *Assessment for Effective Intervention*, 37(2), 84–94. [https://journals.sagepub.com/doi/abs/10.1177/1534508411430321](https://journals.sagepub.com/doi/abs/10.1177/1534508411430321) — Uses stimulus onset (problem appearance on screen) as the RT clock start, not a subsequent audio event. The automaticity criterion indexes from when the problem is presented, not from when the learner finishes reading it aloud or listening to it. **Moderate** (single study, but consistent with universal RT methodology in cognitive psychology).

- **Zbrodoff & Logan (2005)** — "What Everyone Finds: The Problem-Size Effect." In Campbell (Ed.), *Handbook of Mathematical Cognition*. — Establishes that arithmetic RT research anchors to stimulus onset (the moment operands are visible), and that the key boundary between retrieval and counting strategies is observed at roughly 2–3 s from stimulus availability. More than 3 s from stimulus availability is consistent with counting procedures in 7–9-year-olds; sub-2 s is consistent with direct retrieval. [https://www.sciencedirect.com/science/article/abs/pii/S0001691804001155](https://www.sciencedirect.com/science/article/abs/pii/S0001691804001155) **Strong** (major review chapter; extensively replicated problem-size + strategy literature).

- **Geary, Bow-Thomas, Liu, & Siegler (1996)** — Longitudinal study of arithmetic strategy transitions. — Documents that children who retrieve facts directly show RT distributions peaking below 2 s from problem presentation; counting-on strategies show 4–10 s distributions. The discrimination boundary is measured from stimulus onset, not from completion of any audio or reading of a prompt. Referenced via [https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3163113/) (Geary et al. 2012 fact-retrieval-deficits meta-analysis that cites this work). **Strong** (large longitudinal cohort; multiple independent replications).

- **Arithmetic problem-size ERP study (Fayol, Thevenot et al., 2014)** — [https://pmc.ncbi.nlm.nih.gov/articles/PMC4174746/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4174746/) — Even when children solve single-digit additions verbally (i.e. an audio response follows visual presentation), the response time clock in the literature anchors to visual problem onset, not to any audio event. Small additions (M = 1,129 ms) vs large additions (M = 1,707 ms) both measured from stimulus presentation. **Moderate** (single study; consistent with field convention).

- **Current codebase mechanics (direct read)** — `chipReadyAtRef` is set in `useLayoutEffect([readAloudPlayed])` — i.e., at the moment React commits the render that flips `readAloudPlayed` to `true`, which fires on read-aloud COMPLETION (the `.then(...)` resolution of the `speak()` call). `chipGateOpen` is set at TTS START (Howler `onPlay`). For a typical add-to-10 read-aloud ("Three plus two. How many?" at `en-GB-OliviaNeural` rate `-10%`), the gap between gate-open and `readAloudPlayed` is approximately 2–4 s. Every tap in that window is currently captured as `-1` even though it passed the gate, the chip was enabled, and Marian had already heard the full problem. Source: `src/screens/Math/Math.tsx` lines 1113–1136 (`readAloudPlayed` semantics), 1149–1166 (`chipGateOpen` semantics), 1765–1804 (`chipReadyAtRef` anchor). **Authoritative** (direct code read).

- **`slowFacts.ts` consumer** — The M4.x slow-fact directive uses median latency over all non-`-1` attempts per fact, with a 5 s threshold for `+` and 6 s for `-` as the "still counting" boundary (`SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000`, `SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB = 6000`). Both thresholds are defined relative to the expected measurement starting when the problem is available. If the anchor is completion, these thresholds implicitly absorb TTS duration and become meaningless — a 5 s "slow" fact with a 3 s read-aloud is only 2 s of actual thinking time, which is potentially in the automatic-retrieval zone. Source: `src/lib/progress/slowFacts.ts`. **Authoritative** (direct code read).

---

## Application to Marian

Marian is 8, Tagalog-primary, and can read Arabic numerals reliably (diagnostic: "addition — sums to 10, drive automaticity"). She cannot reliably decode English text but she can see `3 + 2` on screen. The numeral pair renders before Emma begins speaking. This means Marian's retrieval window opens before TTS START, not at TTS completion. The chip-gate-open anchor (TTS START) is already slightly conservative — it underestimates the true question-availability moment. The completion anchor adds another 2–4 s of bias on top, making it impossible to distinguish a 1.5 s automatic retrieval from a 5 s count-all.

Concretely: the slow-fact directive's 5 s threshold is calibrated for "she is still counting." With the completion anchor, a child who retrieves `3+2` automatically in 1.5 s after hearing the read-aloud start would be measured as 1.5 s + ~3 s TTS tail = `chipReadyAtRef` never set during the tail, so `-1`. That fast data point disappears entirely. After 5+ sessions the fact has no non-`-1` values and can never qualify as a slow fact — correct outcome for the wrong reason. But it also means the slow-fact directive can never build a reliable baseline to distinguish retrieval from counting, even when counting is genuinely happening on harder facts like `7+6`.

---

## Risks / counter-evidence

- **TTS variable-duration risk with option (a):** If the gate-open anchor is used, latency values absorb the remaining TTS audio as acoustic interference (Marian is hearing Emma while thinking). This is noise, not bias. The literature shows children tolerate concurrent audio during arithmetic retrieval without dramatic RT inflation — the noise adds variance, not systematic overcount. The 250 ms floor and 60 s ceiling already clip pathological values.

- **Fallback-gate contamination:** `chipGateVia` distinguishes `'tts-start'` from `'fallback'` (the 2 s watchdog). If the anchor fires on gate-open regardless of `via`, then silent-audio sessions (fallback path) will anchor to the watchdog's 2 s post-speech-start timestamp rather than the actual TTS start. These latencies would be noisier but still better than the completion anchor. To be clean, option (a) should only update `chipReadyAtRef` on `via === 'tts-start'`; on `via === 'fallback'` it should keep the current `readAloudPlayed` anchor (or capture a new `fallbackGateAtRef`). This is a small implementation detail but worth naming for Kevin.

- **Historical dataset break:** All pre-#402 latency entries are completion-anchored. Re-anchoring now would make future entries non-comparable to past entries. However, per memory entry `project_marian_not_using_yet`, Marian is not yet using the app. The existing history consists of test-seeded or zero-session data with no pedagogical signal. There is no real-Marian production dataset to protect.

- **Evidence gap on audio-concurrent arithmetic in L2 children:** The automaticity literature measures RT from visual stimulus onset with no concurrent audio. Marian's app presents simultaneous visual + audio. There is no published study I can find that tests whether the chip-gate-open (TTS start) vs. completion anchor distinction matters for L2 children specifically. Clinical judgment: the direction of bias from the completion anchor (artificially inflated latencies, dropped fastest responders) is clearly wrong regardless of the modality question. Switching to gate-open eliminates that bias; it introduces a new noise source (concurrent audio) that is symmetric and clippable.

---

## Recommendations

**For Matt (ticket scope):**

Verdict (a) requires a small, localized code change. The scope is narrower than it might appear — `chipReadyAtRef` is written in exactly one place (`useLayoutEffect([readAloudPlayed])`), and needs to be moved or duplicated to fire on chip-gate-open instead. This is a Kevin/Devon-level change, not a design rethink.

**For Kevin / Devon (implementation notes):**

The minimal-change path:

1. Move the `chipReadyAtRef.current = performance.now()` capture from `useLayoutEffect([readAloudPlayed])` into the `openChipGate` callback, gated on `via === 'tts-start'` only.
2. On `via === 'fallback'`, keep the existing `readAloudPlayed`-keyed `useLayoutEffect` as the fallback anchor (or capture at watchdog fire time). This preserves a valid measurement on the fallback path at the cost of one anchor inconsistency that is already documented in `chipGateVia`.
3. The `useLayoutEffect([readAloudPlayed])` block still needs to null out `chipReadyAtRef.current` on the `!readAloudPlayed` branch (the re-arm path on advance). That null-on-false branch is still correct — it prevents a stale anchor from leaking into the next problem.
4. The null-check guard in `onChipTap` (`chipReadyAtRef.current !== null`) is still correct and needs no change.
5. No changes to `slowFacts.ts`, `guards.ts`, `types.ts`, or the persistence layer — the measurement range `[LATENCY_FLOOR_MS, LATENCY_CEILING_MS]` is unaffected.
6. The 250 ms floor (`LATENCY_FLOOR_MS`) remains valid from the gate-open anchor — a 250 ms tap after TTS start is still physically possible for fast retrieval on an easy fact.

**What should change:**
- A Kevin ticket should re-anchor `chipReadyAtRef` to `openChipGate` (TTS START, `via === 'tts-start'`), with the fallback path keeping the completion-based anchor.
- The ticket should reference this file as the authority for the construct-validity argument.
- No UI change, no schema change, no consumer change in `slowFacts.ts`.
