# Wave 12 — Three-hint utterances (math hint scaffolding)

**Anchor ticket:** [86ca7uryr](https://app.clickup.com/t/86ca7uryr) — "[Dave->Kyle] Polish-audit rec (c): Math hints as three discrete utterances (hint1/hint2/hint3)"
**Sponsor decision:** Thomas, 2026-06-12 (sponsor-questions-walkthrough). Wave 12 = three-hint utterances, chosen over stop-for-now impl (86ca7urx1) and the simple-sentences tier. Canon-schema cost accepted.
**Pedagogy gate:** Dave PROCEED (with scope constraint) — ticket comment, 2026-06-12. Evidence: worked-example effect (Renkl 1997, strong), 8yo working-memory ceiling 3-4 chunks (Cowan 2016, strong), L2 processing-speed (Krashen 1985, practitioner). Two-slot minimum-viable fallback documented.
**Status:** DRAFT for sponsor/plan review. Tickets below are PROPOSED — orchestrator creates them after review. Do not dispatch yet.

---

## 1. What this wave does

Split the single Math `hint` utterance into three discrete escalating utterances `hint1` / `hint2` / `hint3`, so the after-2-wrong scaffold ramps one cognitive sub-step at a time instead of delivering all three steps in a single audio burst. This resolves a **live spec/planner inconsistency** (see section 2) and is the right developmental call for a finger-counting L2 learner (Dave's ruling).

**Scope is math-track only.** Word Song also carries a single `hint` slot (`src/screens/WordSong/wordSessionPlans.ts:89`, planner directives in `WORD_SONG_TRACK_GUIDE`), but Dave's ruling, the rec source, and the spec choreography are all math-specific (flower-group pulse). Word-song three-hint is explicitly out-of-scope for Wave 12 — file as a separate future ticket if ever wanted.

---

## 2. The spec/planner inconsistency this wave closes (grounded)

The Math spec already describes the hint as a **three-beat choreography**, but the data shape, planner, parser, and consumer all carry a **single** hint utterance. The animation choreography literally cannot sync to sub-steps because there is only one audio clip.

Concrete, from this worktree (matt/wave-12-plan off origin/main):

- **Spec three-beat hint choreography:** design/screen-3-math.md:297-303 — "Flower groups pulse one at a time with TTS narration: 'Look. Three...' (3-flower group pulses) / '...and two more.' (2-flower group pulses) / 'How many now?'". Three distinct narration beats, each synced to a distinct animation event.
- **Spec audio contract emits ONE hint utterance:** design/screen-3-math.md:331 — table row "math.p{N}.hint | 'Look. Three. And two more. How many now?' | After 2 wrong attempts". One utterance ID per problem; all three beats collapsed into one clip.
- **Data shape single hint field:** src/screens/Math/sessionPlans.ts:138 (MathProblemUtterances.hint: string), slot union MathUtteranceSlot at sessionPlans.ts:95-98 includes a single 'hint', and ALL_SLOTS at sessionPlans.ts:121-127 lists read | correct | reprompt | hint | giveAnswer.
- **Planner emits one hint line per problem:** api/_planner.ts:1287 ("exactly 5 utterances with these slot names: read, correct, reprompt, hint, giveAnswer") and per-tier templates e.g. _planner.ts:1370, :1449, :1815.
- **Parser hard-codes the 5-slot set:** src/screens/Math/planFromServer.ts:62-67 (ALL_SLOTS) and the id regex src/screens/Math/planFromServer.ts:358 (/^math\.p(\d+)\.(read|correct|reprompt|hint|giveAnswer)$/).
- **Consumer single speak() call:** src/screens/Math/Math.tsx:1906 (void speak(problem.utterances.hint)), gated after 2 wrongs (Math.tsx:1868-1872).

**The inconsistency, stated:** the spec's animation intent (section Hint state, screen-3-math.md:421-424 — "Plays the math.p{N}.hint utterance with the flower-group pulse choreography") presupposes three narration beats that the single-utterance plan cannot provide. The choreography either fires against a single blocking clip (beats 2 and 3 have no audio anchor) or has been silently never wired to sub-step audio. **Closing this inconsistency is an explicit AC** (see W12-02 + W12-04).

---

## 3. Canon impact (re-bake vs preserved; voice-QA blast radius)

### 3.1 What gets re-baked

Math hint utterances exist in **11 committed canon files** under public/canon/math/level-1/ (verified via git ls-files public/canon/math/):

add-to-10, add-to-20, mult-2-5-10, mult-3-4, mult-6-9, number-recog, skip-counting, sub-to-10, sub-to-20, two-digit-addsub-with-regroup, two-digit-addsub

Each file carries **8 math.p<N>.hint utterances** (verified: grep for the hint id returns 8 per file in the audio-side utterances array, plus 8 duplicates in the opaque plan skeleton — 176 raw matches across 11 files = 88 distinct audio-side hint utterances). Re-baking replaces each single hint with three (hint1/hint2/hint3), i.e. **88 hint clips -> 264 hint clips** across the math track.

### 3.2 What is preserved (targeted re-render strategy — RECOMMENDED to minimize blast radius)

The non-hint utterances — read, correct, reprompt, giveAnswer, and the 19 session.end.* utterances (each file has 59 total utterances; add-to-10 confirmed) — **do not change text and must NOT be re-rendered.** Their SHA-256 audio hashes are the voice-QA baseline (a protected asset). The re-bake must be **surgical**: regenerate ONLY the hint slots, leaving every other clip's bytes byte-identical.

Two ways to bound the blast radius; recommend **(A)**:

- **(A) Hint-only targeted re-render (RECOMMENDED).** Use the existing targeted re-render path (scripts/revoiceCanonTargeted.ts exists for exactly this) to regenerate only math.p<N>.hint1/2/3 and remove the legacy math.p<N>.hint. Every non-hint clip retains its committed bytes -> its voice-QA hash is unchanged -> its verdict is **preserved**. Blast radius confined to hint items only.
- **(B) Full math re-bake.** npm run canon:regen for the math track re-renders all 59 utterances per file. Even if text is identical, a fresh Azure render can produce a different byte stream -> different SHA -> **every** math item flips to needs-retest. Far larger voice-QA debt. **Avoid unless (A) is infeasible.**

### 3.3 Voice-QA interaction (the protected baseline)

Voice-QA keys each item as <file-stem>#<utteranceId> and tracks status by SHA-256 audio hash (public/voice-qa.html:1222,1390; status file public/voice-qa-status.json). The full item universe (654 items, per project_voice_qa_system memory) is enumerated dynamically by the page from the live canon; voice-qa-status.json records only the changed/needs-retest delta (currently 9 items).

**Blast radius under strategy (A):**
- The 88 existing math.p<N>.hint items are **deleted** (the id no longer exists in canon) -> they drop out of the item set.
- 264 new math.p<N>.hint1/2/3 items are **created** with no prior verdict -> all 264 are needs-retest by construction.
- **Net new voice-QA debt: 264 hint clips to ear-test.** Zero collateral on read/correct/reprompt/giveAnswer/session-end (they keep their hashes).

**Under strategy (B):** all other math utterances flip to needs-retest on top of the 264 — multiple-hundred extra clips for zero pedagogical gain. This is the asset-protection argument for (A).

**Voice-QA is a hard gate on this wave's canon PR** (project_voice_qa_system memory — "gates all audio re-renders"). Thomas is the ear-test gate for the new hint clips (utterance-text change -> sponsor ear-test per feedback_jessica_audio_visual_gate_narrowed). This is the wave's primary sponsor-gate throttle point (see section 6).

---

## 4. Sequencing (Pattern A — type/parser author lands first)

The planner<->parser contract is **non-negotiable**: widen the browser parser BEFORE the planner emits the new shape (project_planner_parser_contract; P0 precedent PR #117 -> #118). The slot-set is a shared type (MathUtteranceSlot) consumed by parser, plan shape, adapters, and consumer — this is a **type chain**, so Pattern A applies: the slot-type + parser author lands FIRST, on main; consumers (planner directive, then canon, then Math.tsx choreography) dispatch against merged vocabulary.

**Backward-compat is mandatory through the transition:** the parser must accept BOTH legacy hint AND new hint1/hint2/hint3 so committed canon does not break the moment the parser PR lands but before the re-bake. Dave's ruling calls this out explicitly.

Merge order (each gated on the prior landing on main):

1. **W12-01 (parser + slot-type widening)** — lands first. Parser accepts both shapes. Genuinely blocks 02/03/04.
2. **W12-02 (Math.tsx consumer + choreography)** — develops in parallel with 01 against the named-vocabulary contract, but merges after 01 (imports the widened slot type). Wires hint1 -> hint2 -> hint3 to the three animation beats.
3. **W12-03 (planner directive)** — emits three-slot hints for new sessions. Merges after 01 (needs parser to accept the new ids). Independent of 02's render code.
4. **W12-04 (canon re-bake + voice-QA)** — merges last. Replaces single hint clips with three-slot sets via targeted re-render (strategy A). Sponsor ear-test gate.

---

## 5. Named parallel tracks

| Track | Owner (assignee_recommendation) | Tickets | Parallelism |
| ----- | ------------------------------- | ------- | ----------- |
| Pedagogy / spec ruling | Dave (done) + Kyle (spec update) | spec edit folded into W12-02 | Dave ruling already landed (ticket comment). Kyle spec reconciliation fires immediately, parallel to everything — read-only against shared state. |
| Parser + slot type | Kevin (API/parser/type-chain root) | W12-01 | Round 1. Must land first. |
| Failing-first E2E spec | Jessica | W12-05 | Round 1 — authored RED before W12-01/02/04 dispatch; the spec is the spec. Parallel to W12-01 (test-only). |
| Render + choreography | Devon (UI/animation/Framer Motion) | W12-02 | Round 2 — parallel to W12-03; merges after W12-01. |
| Planner directive | Kevin (planner directive owner) | W12-03 | Round 2 — parallel to W12-02; merges after W12-01. |
| Canon re-bake + voice-QA | Kevin (bake) + Thomas (ear gate) | W12-04 | Round 3 — last; gated on 01+03 + sponsor ear-test. |

**What genuinely runs in parallel:** Round 1 — Kyle spec reconciliation + Kevin W12-01 (parser) + Jessica W12-05 (failing-first E2E) fire together (spec + test are read-only/test-only against shared state; parser is the type-chain root). Round 2 — Devon W12-02 + Kevin W12-03 run in parallel against W12-01's merged vocabulary (different files: Math.tsx vs _planner.ts). Round 3 — W12-04 alone.

**What is strictly sequenced:** W12-01 -> {W12-02, W12-03} -> W12-04. Parser-first and canon-last are both hard rules. Cross-review pairing holds (Kevin<->Devon); W12-01 and W12-03 are both Kevin-authored, so Devon reviews both; W12-02 is Devon-authored, so Kevin reviews it. Jessica's W12-05 spec is reviewed by the free dev (Devon, since Kevin owns two impl tickets).

**Concurrency note:** at most one yarn e2e run across worktrees (port 4173, orchestration-concurrency.md section 1.2) — Jessica's spec dispatch and any reviewer full-suite run must not overlap.

---

## 6. Sponsor-gate throttle

This wave has a **sponsor ear-test gate** on W12-04 (264 new hint clips, utterance-text change). Per feedback_dispatch_density_vs_gate + orchestration-concurrency.md section 2: fan out to 3-5 through Rounds 1-2 (CI-gated), then throttle to 1-2 at Round 3 where Thomas is the gate. Do not coast at low density before Round 3 — Rounds 1-2 are CI-gated and should run at full width.

The animation-feel of the three-beat choreography (W12-02) may surface a subjective-feel call (does the pulse-then-speak cadence feel right). Devon owns objective layout/timing; if a subjective disagreement survives Devon's design-review, it routes to Thomas (feedback_jessica_audio_visual_gate_narrowed).

---

## 7. Proposed tickets (dispatch contracts)

Note: per project_dispatch_contract, each block goes verbatim into the ClickUp ticket body AND the dispatch prompt. Jessica's W12-05 failing-first test is authored before W12-01/02/04 dev dispatch — the test is the spec.

### W12-01 — Parser + slot-type widening (math three-hint)

- **Owner:** Kevin | **Reviewer:** Devon | **Round:** 1 (lands first — type-chain root)
- **Goal:** Widen MathUtteranceSlot and the math read-line parser to accept hint1/hint2/hint3 alongside legacy hint, so committed canon keeps working through the transition (planner<->parser contract — parser first).
- **Acceptance criteria:**
  1. MathUtteranceSlot (src/screens/Math/sessionPlans.ts:95) gains hint1 | hint2 | hint3; legacy hint retained.
  2. MathProblemUtterances (sessionPlans.ts:130) gains hint1/hint2/hint3: string; hint retained (legacy/back-compat).
  3. The parseMathUtteranceId regex (src/screens/Math/planFromServer.ts:358) accepts (read|correct|reprompt|hint|hint1|hint2|hint3|giveAnswer).
  4. ALL_SLOTS handling tolerates a problem that has EITHER legacy hint OR the hint1/2/3 triple — not requiring both. Define the back-compat predicate: a problem is valid if it has read+correct+reprompt+giveAnswer AND (hint OR all of hint1/hint2/hint3).
  5. Unit tests pin: legacy-only canon parses; three-hint canon parses; mixed/partial-triple (e.g. hint1 only, no hint2) throws a clear missing-slot error.
- **Out-of-scope:** planner directive changes; canon re-bake; Math.tsx render wiring; word-song.
- **Done-when test:** vitest run on src/screens/Math/planFromServer.test.ts green with new cases covering (legacy hint), (hint1+hint2+hint3), (partial-triple throws). Plus W12-05's RED parser-shape assertion now resolvable.
- **Files-in-play:** src/screens/Math/sessionPlans.ts, src/screens/Math/planFromServer.ts, src/screens/Math/planFromServer.test.ts, src/screens/Math/sessionPlans.test.ts.

### W12-02 — Math.tsx consumer + three-beat choreography

- **Owner:** Devon | **Reviewer:** Kevin | **Round:** 2 (merges after W12-01)
- **Goal:** Wire the three hint utterances to the three animation beats the spec already describes (screen-3-math.md:297-303), replacing the single speak(problem.utterances.hint) at Math.tsx:1906. hint1 syncs to the group-A pulse, hint2 to the group-A quantity highlight, hint3 to the group-B addition + question. Falls back to legacy single hint if the triple is absent.
- **Acceptance criteria:**
  1. After 2 wrongs, the hint sequence plays hint1 -> hint2 -> hint3 in order, each gated to play after the prior resolves (sequential, not overlapping), preserving the existing HINT_DELAY_AFTER_WRONG_MS beat before hint1.
  2. The flower-group pulse choreography (screen-3-math.md:299-301) is synced to the sub-step utterances (group-A pulse on hint1/hint2, group-B on hint3) — closes the spec/planner inconsistency (section 2). This is the explicit inconsistency-closure AC.
  3. Back-compat: if a problem carries only legacy hint, behaviour is unchanged (single utterance + existing choreography).
  4. Hint trigger timing (after 2 wrongs), giveAnswer after 3 wrongs, and never-a-red-X are unchanged.
- **Out-of-scope:** parser/type changes (W12-01); planner (W12-03); canon (W12-04); changing the 2-wrong/3-wrong thresholds.
- **Done-when test:** component test in Math.test.tsx driving 2 wrong taps asserts three speak calls in hint1/hint2/hint3 order; a legacy-hint fixture asserts a single speak. W12-05 E2E three-beat assertion green.
- **Files-in-play:** src/screens/Math/Math.tsx, src/screens/Math/Math.test.tsx, design/screen-3-math.md (reconcile the audio-contract table row 331 to three IDs — fold the Kyle spec edit here).

### W12-03 — Planner directive (emit three-slot hints)

- **Owner:** Kevin | **Reviewer:** Devon | **Round:** 2 (merges after W12-01; parallel to W12-02)
- **Goal:** Update MATH_TRACK_GUIDE so Haiku emits three hint utterances per problem (math.p<N>.hint1/2/3) instead of one math.p<N>.hint, with per-step templates that map to the three sub-steps. Maintain MATH_TRACK_GUIDE insertion-order discipline; update the "exactly 5 utterances" contract prose at _planner.ts:1287 to the new slot count.
- **Acceptance criteria:**
  1. _planner.ts:1287 slot contract updated (read, correct, reprompt, hint1, hint2, hint3, giveAnswer) — and the SYSTEM_PREAMBLE utterance-count math (currently 8x5=40 problem utterances + 19 session-end) updated to 8x7=56 + 19; verify max_tokens headroom (_planner.ts:302, currently 4000) still covers the worst case.
  2. Per-tier hint templates split into hint1 (attention-direction, e.g. "Look at the flowers."), hint2 (quantity-A, e.g. "Three flowers."), hint3 (add + question, e.g. "And two more. How many?") for add tiers; "take away" framing for subtract tiers (preserve the existing scaffold-framing rule at _planner.ts:1506,1582,1694,1796).
  3. Round-trip test (plannerRoundTrip.test.ts / claude.test.ts) proves a generated plan parses through W12-01's widened parser with three hint ids per problem.
  4. Drift-guard: a planner-system-prompt test asserts the directive instructs three hint slots (header-shaped, per the SELF-CHECK drift-guard convention).
- **Out-of-scope:** canon re-bake (W12-04 — directive change without re-bake leaves committed canon on legacy hint, which is valid under W12-01 back-compat); parser; render; word-song.
- **Done-when test:** vitest run on api/_planner.test.ts api/claude.test.ts green; round-trip emits + parses three-slot hints.
- **Files-in-play:** api/_planner.ts, api/_planner.test.ts, api/claude.test.ts, e2e/fixtures/canonicalSessionResponses.ts (the fixture at :112 emits the math hint id — widen to three; feeds multiple sub-to-10 specs).

### W12-04 — Canon re-bake (targeted) + voice-QA

- **Owner:** Kevin (bake) | **Reviewer:** Devon | **Ear gate:** Thomas | **Round:** 3 (last)
- **Goal:** Re-bake math canon hint slots ONLY — replace 88 math.p<N>.hint clips with 264 math.p<N>.hint1/2/3 clips via targeted re-render (strategy A, section 3.2), preserving every non-hint clip's bytes (read/correct/reprompt/giveAnswer/session-end) so their voice-QA verdicts survive.
- **Acceptance criteria:**
  1. All 11 math canon files (public/canon/math/level-1/) carry math.p<N>.hint1/2/3 and NO legacy math.p<N>.hint.
  2. Byte-preservation proof: a diff/script verifies every non-hint utterance's base64 is byte-identical to pre-re-bake (the voice-QA baseline protection — quote the verifying command output in the PR body per feedback_canon_state_empirical_verification).
  3. canon:lint + composition-lint green; canon parses through the production planner->parser path.
  4. Voice-QA page enumerates the 264 new hint items as needs-retest; Thomas ear-tests them. PR does NOT merge until ear-test passes (project_voice_qa_system gate).
- **Out-of-scope:** word-song canon; any non-hint math utterance; voice swaps.
- **Done-when test:** byte-preservation script exits 0 (non-hint clips unchanged); canon:lint green; voice-QA delta = exactly the 264 hint items, zero collateral; Thomas ear-test PASS recorded on the PR.
- **Files-in-play:** the 11 math canon JSON files, scripts/revoiceCanonTargeted.ts (or generateSessionCanon.ts if the targeted path needs extension), public/voice-qa-status.json.

### W12-05 — Failing-first E2E spec (authored first)

- **Owner:** Jessica | **Reviewer:** Devon | **Round:** 1 (RED before dev dispatch — the spec is the spec)
- **Goal:** A failing-first Playwright spec that drives a math session to 2 wrongs on one problem and asserts three discrete hint utterances fire in order (hint1 -> hint2 -> hint3), with the flower-group pulse synced. RED on main (single hint today), GREEN after W12-02 + W12-04.
- **Acceptance criteria:**
  1. Spec seeds a math focus, mocks /api/claude with a three-hint canon fixture (positive discriminator — capture the served-canon envelope, NOT failNetwork static fallback, per the testing-and-ci.md section 4.1.1d/e trivially-green traps).
  2. Drives 2 wrong taps; asserts hint1, hint2, hint3 play in order (via caption-text sequence or audio-event ordering on the chromium AudioContext path).
  3. Asserts the legacy single-hint path still works under a legacy-hint fixture (back-compat).
  4. test.setTimeout sized for the full walk-through (multi-step hint sequence; size per testing-and-ci.md section 4.1.1b — measure one GREEN run or default 60s/session + headroom).
- **Out-of-scope:** implementation (W12-01/02/03/04); word-song.
- **Done-when test:** spec is RED on origin/main at authoring (proven RED with a path that CAN be made green — not a route-abort, per feedback_failing_first_must_prove_green); flips GREEN after W12-02 + W12-04 merge.
- **Files-in-play:** e2e/math-three-hint.spec.ts (new), e2e/fixtures/canonicalSessionResponses.ts (three-hint fixture builder), e2e/_helpers/seedStorage.ts (if a new seed shape is needed).

---

## 8. Risks

1. **Voice-QA debt (264 new clips) is the biggest risk.** Strategy A (targeted re-render) bounds it to hint clips only; strategy B (full re-bake) would balloon it. Mitigation: mandate strategy A; W12-04 AC #2 requires byte-preservation proof on non-hint clips. Thomas's ear-test of 264 clips is the throughput bottleneck — sequence W12-04 last and expect a sponsor-gated pause (precedent: 13-day British-voice ear-test window, orchestration-concurrency.md section 2).
2. **max_tokens headroom.** Going 5->7 slots per problem raises worst-case utterance count 40->56 problem utterances. W12-03 AC #1 requires verifying _planner.ts:302 (4000) still covers it; if not, a bump is in-scope for W12-03 (precedent: ticket 86c9kwhbc raised 2000->4000 for truncation).
3. **Back-compat predicate correctness.** The parser must accept legacy-only AND three-hint, but reject a partial triple. A loose predicate (accept hint1 without hint2/hint3) would silently render a broken hint sequence. W12-01 AC #5 pins the partial-triple-throws case.
4. **Choreography sync is partly subjective.** The pulse-then-speak cadence (W12-02) may need a Thomas feel-check if Devon can't resolve it objectively. Low-probability but routes to sponsor if it surfaces.
5. **Two Kevin-authored impl tickets (W12-01, W12-03) in one wave.** Devon reviews both, serializing two reviews on Devon's worktree. Acceptable (Round-2 throughput is parser-gated anyway); flagged so the orchestrator doesn't stack a third review on Devon concurrently.

---

## 9. Minimum-viable fallback (Dave's two-slot option)

If the full three-slot re-bake doesn't fit the wave budget, Dave's ruling permits a two-slot version: hint1 = attention-direction ("Look at the flowers."), hint2 = existing composite hint. This halves the re-bake cost (88 -> 176 clips instead of 264) and gets "most of the benefit." If adopted, W12-01's slot union still adds hint1/hint2/hint3 (forward-compat) but W12-03/04 emit only hint1+hint2. Decision deferred to sponsor at plan review — default recommendation is full three-slot (strongest developmental case; the re-bake mechanics are identical, only the clip count differs).
