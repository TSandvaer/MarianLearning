# Number Garden — `sub-to-20` content tier (no-borrow only, 22-fact pool, decade-anchor-miss distractor, op-parameterised slow-fact threshold)

**Status:** SPEC — implementation blocked on this PR merging. Kevin/Devon pick up impl after spec approval.
**Ticket:** TBD — orchestrator to file in ClickUp `list_id: 901523003843`. Kyle's MCP scope is read-only on ClickUp; ticket creation routed via orchestrator (per `[[feedback_clickup_forward_only_default]]`).
**Authority:** [`design/research/sub-to-20-pedagogical-sequence.md`](../research/sub-to-20-pedagogical-sequence.md) (Dave, 2026-05-16, PR #267) — the curriculum-side authority on fact ordering, band structure, distractor design, advancement gate, and `add-to-20`-parallel sequencing. This spec consumes Dave's note verbatim where it makes a call and formalises it for Kevin's planner / canon / `distractors.ts` work.
**Predecessor research (read for context):** [`design/research/sub-to-10-fact-sequencing-marian.md`](../research/sub-to-10-fact-sequencing-marian.md) (Dave, 2026-05-15 — the sub-to-10 precedent that established the gentle-ramp + dual-exposure shape); [`design/research/canon-pool-wrong-op-delivery.md`](../research/canon-pool-wrong-op-delivery.md) and [`design/research/canon-pool-wrong-op-delivery-followup-hard-general.md`](../research/canon-pool-wrong-op-delivery-followup-hard-general.md) (Dave, 2026-05-16 — the structural-redundancy posture for distractor-class delivery, ratified for sub-to-20 via Class B in this spec).
**Structural template:** [`design/math/sub-to-10-content.md`](./sub-to-10-content.md) (Kyle, 2026-05-15 / amended 2026-05-16). Same §0–§9 shape, cloned section-for-section.

**Thomas confirmation 2026-05-16:** `sub-to-20` is the next math tier to ship after the sub-to-10 wave settled (PRs #253 + #239 + #241). This spec is authored against Dave's research-note v1 with no Thomas-side overrides queued.

---

## 0. Why this spec, why now

- `sub-to-20` is the NEXT focus node on the Number Garden ladder after `sub-to-10`. `MATH_TRACK_GUIDE` in [`api/_planner.ts:1022`](../../api/_planner.ts#L1022) today carries only a one-line skeleton:
  ```
  - sub-to-20: subtraction within 20. read: same template; the answer may be 1-19.
  ```
  Haiku would hallucinate problems off this skeleton today — including borrow facts (e.g. `18-9=9`, `15-8=7`) that the v1 scope explicitly excludes. The planner needs a directive block on par with `add-to-10` / `sub-to-10` (with fact-pool guidance, band-by-slot mix rules, no-borrow FORBIDDEN markers, and read-line template).
- **Marian's April 2026 diagnostic:** "Subtraction — Within 15 confident, extend to 20 no-borrow." Sub-to-20 is precisely the tier the diagnostic flagged. She has CONCEPT and a counting-back strategy. The gap is RETRIEVAL automaticity for the 16-19 minuend zone, mirroring the gap `sub-to-10` was built to close.
- **Sub-to-10 shipped 2026-05-16** across PR #253 (spec amendment), #239 (planner + canon), #241 (render + parser). Sub-to-20 is the natural successor and Thomas confirmed it as next on the math ladder on 2026-05-16.
- **Dave's research note** (`sub-to-20-pedagogical-sequence.md`) is the curriculum-side authority. This spec consumes it verbatim where it makes a call.
- **Dave's verdict on visual scaffolding** (research note § 4.5): skip the CRA visual detour entirely (no ten-frame, no number-line overlay, no manipulative phase). The 4-chip recognition format IS the representational layer of CRA for a child with subtraction concept. Emma's read-aloud is the anchor. Net: this spec authors content for the existing Math chip-tap surface unchanged. No screen-layer redesign; no new UI primitives.
- **Dave's verdict on speed-feedback UX** (research note § 4.5, citing `speed-feedback-automaticity-marian.md`): NO speed-feedback UI. The slow-fact directive is a planner-side re-targeting tool. This spec formalises an op- AND tier-aware threshold; the UI is not touched.

**Scope of this spec:**

- The 22-fact ordered pool (§1) with band + category + decade-anchor-miss trap status + per-fact teaching note.
- The problem-mix rules for an 8-problem session drawn from the pool (§2).
- The three distractor classes for `sub-to-20`, including the NEW **decade-anchor miss distractor (Class B)** (§3).
- The read-line template + per-slot utterance templates (§4).
- The schema posture — `sub-to-20` reuses `MathFact { a, b, op: '-' }` with no new infrastructure (§5).
- The advancement gate (`sub-to-10 → sub-to-20`) — accuracy-only per Dave (§5).
- The dual-exposure rule (never pair a `-` fact with its `+` inverse in the same session) (§5).
- The op-parameterised slow-fact threshold REQUEST for `slowFacts.ts` extension (§5).
- The wire-up checklist for Kevin (§6).
- Acceptance criteria for Jessica's E2E + Kevin's vitest suites (§6).
- Open questions for Thomas's decision (§7).
- Tracked follow-ups (§8).

**Out-of-scope:**

- **Implementation.** This spec hands off to Kevin (planner directive + canon bake + `distractors.ts` Class B extension + `maxAnswer` widening) and Devon (render + parser widening).
- **Borrow facts.** Hard pedagogical line (Dave § 4.5). Facts where `ones-digit(minuend) < subtrahend` are FORBIDDEN in this pool — they belong in a future tier, not here. See §7.1 for the `18-9=9` carve-out question.
- **Two-digit subtraction** (`24-13`, `35-22`, etc). Belongs in `two-digit-addsub`, not here.
- **Negative results.** All pool results are ≥ 10 (every no-borrow teen-minuend single-digit-subtrahend produces a result in `[10, 18]`); negative results cannot arise from the v1 pool by construction.
- **Speed-feedback UX** — killed by `speed-feedback-automaticity-marian.md` and re-confirmed by Dave for sub-to-20.
- **CRA visual scaffolding** — Dave § 4.5 ruled out (ten-frame, number-line, manipulative phase).
- **Fact-family interleaving (mixed `+` and `-` in one session).** Dave § 1.2 supports it as the natural endpoint, but v1 keeps the same dual-exposure posture as sub-to-10: no `+/-` co-occurrence on the same operand triple within an 8-problem session.
- **Subitising-scaffold extension to subtraction.** Per `design/math/subitising-scaffold-content.md` §7.2 — open question, deferred to its own future sibling spec.
- **`add-to-20` re-spec.** `add-to-20` is currently a one-line directive in `_planner.ts`; widening it to the structured-pool shape is a separate ticket. This sub-to-20 spec does NOT depend on it.
- **Major `Math.tsx` UI redesign.** Subtraction renders through the existing chip-tap pipeline; the screen is operation-agnostic. Render-side changes are argument plumbing only (Class B in `distractors.ts`, `maxAnswer = 19` for sub-to-20 callers), already validated by the sub-to-10 precedent.

---

## 1. The 22-fact pool — ordered, banded, categorised, no-borrow only

The pool below is the union of facts Haiku may draw from for any `sub-to-20` session. The full no-borrow teen-minuend single-digit-subtrahend surface (the strict no-borrow definition: `11 ≤ a ≤ 19`, `1 ≤ b ≤ 9`, `ones-digit(a) ≥ b`) contains **45 ordered facts** with results in `[10, 18]`. The 22 below cover every difficulty band and conceptual category per Dave § 4.1–4.2.

> **No-borrow constraint reminder.** Every fact in this pool satisfies `ones-digit(minuend) ≥ subtrahend`. Concretely: `14-3=11` is no-borrow (`ones(14)=4 ≥ 3`); `14-7=7` is BORROW (`ones(14)=4 < 7`) and FORBIDDEN. Result range under this constraint is `[10, 18]` — every result has tens-digit `1`. See §7.1 for the `18-9=9` open question (Dave's research note flagged it by name as a HARD anchor but the strict no-borrow definition excludes it).

### 1.1 Pool table (LOCKED — Dave § 4.1–4.2 band structure; per-fact curation owned by Kyle per Dave § Risks #2)

Each fact is annotated with its decade-anchor-miss trap value (Class B § 3.3). `DEC` = the nearest multiple of 10 to the correct answer, computed as `Math.round(correct / 10) * 10`. **All pool results are in `[10, 18]`**, so `DEC = 10` or `DEC = 20` for every fact. `DEC = 10` is in-range and pedagogically salient (the decade anchor children mistakenly land on when counting back across the boundary, per Baroody 1984). `DEC = 20` is out of the `maxAnswer = 19` ceiling and silently downgrades to off-by-one at render time (Class A fallback) — same mechanic as the wrong-op OOR fallback in sub-to-10 §3.2.

| #   | Fact          | Band   | Category          | Class B trap (DEC) | Teaching note                                                                                                                                                                                                                                                                                              |
| --- | ------------- | ------ | ----------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `11 − 1 = 10` | easy   | subtract-one      | 10 (ALIAS — forbidden, downgrades to off-by-one) | Single-step count-back. Result `10` IS the decade — Class B aliases correct. Highest-confidence opener. (Dave § 4.2 EASY: "11−1=10 — subtract-one from a decade+1".)                                                                                                                                       |
| 2   | `12 − 2 = 10` | easy   | doubles-anchor    | 10 (ALIAS — forbidden, downgrades to off-by-one) | Doubles analog: Marian knows `2 + 2 = 4`; subtract-self structure at the teen level. Single-step count-back. Result anchors on the decade. (Dave § 4.2 EASY: "doubles analog at teen-level".)                                                                                                              |
| 3   | `13 − 3 = 10` | easy   | take-to-decade    | 10 (ALIAS — forbidden, downgrades to off-by-one) | Three-step count-back. Result lands exactly on the decade — the "take-to-decade" strategy made explicit. (Dave § 4.2 EASY: "take-to-decade".)                                                                                                                                                              |
| 4   | `12 − 1 = 11` | easy   | subtract-one      | 10 (IN — boundary, off-by-one secondary)         | Single-step count-back. Result `11` is off-by-one from the decade. Class B trap = 10 is `correct − 1`, which IS off-by-one — degenerate, downgrades to off-by-one with `c+1` (i.e. 12) as the secondary. **Selection caveat:** this fact's Class B trap collapses; pedagogical value rests on Class A only. |
| 5   | `13 − 2 = 11` | easy   | subtract-two      | 10 (IN — boundary, off-by-one secondary)         | Two-step count-back. Same Class B degeneration as #4 — trap = `correct − 1`, downgrades. Pedagogical value rests on Class A.                                                                                                                                                                               |
| 6   | `13 − 1 = 12` | easy   | subtract-one      | 10 (IN — separation 2)                           | Single-step count-back. Class B trap = 10, correct = 12 → 2-apart, clean Class B chip. First EASY fact with a non-degenerate Class B.                                                                                                                                                                      |
| 7   | `14 − 4 = 10` | medium | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Four-step count-back. Result-equals-decade anchor; Marian knows `4 + 4 = 8` from `add-to-10` doubles — the doubles-anchor link extends.                                                                                                                                                                    |
| 8   | `14 − 3 = 11` | medium | general           | 10 (IN — boundary, off-by-one secondary)         | Three-step count-back. Class B trap = 10, correct = 11 → degenerates.                                                                                                                                                                                                                                      |
| 9   | `14 − 2 = 12` | medium | subtract-two      | 10 (IN — separation 2)                           | Two-step count-back. Class B trap clean.                                                                                                                                                                                                                                                                   |
| 10  | `15 − 5 = 10` | medium | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Five-step count-back. Result-equals-decade anchor; Marian knows `5 + 5 = 10` from `add-to-10` sums-to-10 — the bridge mental model is right there. **Dave's research § 4.2 MEDIUM names this exemplar: "result = 10 (e.g. 14−4, 15−5, 16−6) — especially memorable and should be present in the pool".**   |
| 11  | `15 − 4 = 11` | medium | general           | 10 (IN — boundary, off-by-one secondary)         | Four-step count-back. Class B trap degenerates.                                                                                                                                                                                                                                                            |
| 12  | `15 − 3 = 12` | medium | subtract-three    | 10 (IN — separation 2)                           | Three-step count-back. Class B trap clean.                                                                                                                                                                                                                                                                 |
| 13  | `15 − 2 = 13` | medium | subtract-two      | 10 (IN — separation 3)                           | Two-step count-back. Class B trap clean and well-separated. The kind of "easy-looking" MEDIUM fact whose Class B miss (chip `10` chosen instead of `13`) reveals an inattentive decade-anchor lock.                                                                                                        |
| 14  | `16 − 6 = 10` | medium | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Six-step count-back. Result-equals-decade anchor; Marian knows `6 + 6 = 12` (`add-to-20` doubles, currently practicing). The doubles-link extends. **Dave § 4.2 MEDIUM names this exemplar.**                                                                                                              |
| 15  | `16 − 5 = 11` | medium | general           | 10 (IN — boundary, off-by-one secondary)         | Five-step count-back. Five steps is the threshold Dave § 4.2 calls "decade-anchor miss most relevant" — explicitly the canonical example. Class B trap degenerates (off-by-one secondary).                                                                                                                 |
| 16  | `16 − 4 = 12` | medium | general           | 10 (IN — separation 2)                           | Four-step count-back. Class B trap clean and pedagogically salient — chip `10` is the wrong-decade anchor; chip `12` is the correct result.                                                                                                                                                                |
| 17  | `17 − 7 = 10` | hard   | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Seven-step count-back. Result anchors on decade. High working-memory load (Dave § 4.2 HARD: 5–9-step count-backs strain WM).                                                                                                                                                                               |
| 18  | `17 − 5 = 12` | hard   | general           | 10 (IN — separation 2)                           | Five-step count-back. Class B trap clean. Dave's canonical "child anchors at 10 instead of counting through to the right answer" pattern.                                                                                                                                                                  |
| 19  | `18 − 8 = 10` | hard   | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Eight-step count-back. Result-equals-decade anchor; Marian knows `8 + 8 = 16` (`add-to-20` doubles). High WM load.                                                                                                                                                                                         |
| 20  | `18 − 6 = 12` | hard   | general           | 10 (IN — separation 2)                           | Six-step count-back. Class B trap clean. HARD-band example of clean separation.                                                                                                                                                                                                                            |
| 21  | `19 − 9 = 10` | hard   | take-to-decade    | 10 (ALIAS — forbidden, downgrades)               | Nine-step count-back; highest working-memory load in the no-borrow pool. Result-equals-decade anchor; Marian knows `9 + 9 = 18` (`add-to-20` doubles). **Highest-leverage no-borrow HARD fact** — anchors the 9-times-table pattern when multiplication arrives. (See §7.1 for the `18-9=9` carve-out question; this fact is the closest no-borrow analogue.) |
| 22  | `19 − 7 = 12` | hard   | general           | 10 (IN — separation 2)                           | Seven-step count-back. Class B trap clean. HARD-band complement to #18.                                                                                                                                                                                                                                    |

**Band counts:**

- `easy` — 6 facts (#1–6): subtract-one ×3 (#1, #4, #6), doubles-anchor ×1 (#2), take-to-decade ×1 (#3), subtract-two ×1 (#5).
- `medium` — 10 facts (#7–16): take-to-decade ×3 (#7, #10, #14), subtract-two ×2 (#9, #13), subtract-three ×1 (#12), general ×4 (#8, #11, #15, #16).
- `hard` — 6 facts (#17–22): take-to-decade ×3 (#17, #19, #21), general ×3 (#18, #20, #22).

**Category counts:** subtract-one ×3 · doubles-anchor ×1 · take-to-decade ×7 · subtract-two ×3 · subtract-three ×1 · general ×7. **Total: 22 facts.**

**Class-B-CLEAN (in-range, non-aliasing, non-degenerate) availability per band** — this is what makes §2.2's "≥2 Class B in P4–P8" rule structurally achievable post-curation:

- EASY: 1 fact with separation ≥ 2 (#6 `13-1=12`) — but EASY is restricted to P1–P3 (no Class B fires there per §2.1). **Effective contribution to P4–P8: 0.**
- MEDIUM: 4 facts with separation ≥ 2 — #9 `14-2=12`, #12 `15-3=12`, #13 `15-2=13`, #16 `16-4=12`. Category caps (§2.3) bind these: subtract-two ≤ 1 (so #9 and #13 compete), subtract-three ≤ 1 (#12), general ≤ 2 (#16 is the only MEDIUM/general CLEAN). **Maximum simultaneous MEDIUM CLEAN at P4–P8: 3 (one subtract-two + one subtract-three + one general).**
- HARD: 3 facts with separation ≥ 2 — #18 `17-5=12`, #20 `18-6=12`, #22 `19-7=12`. All three are HARD/general; under the `general` cap of 2, at most 2 can co-occur in a single session. **Maximum simultaneous HARD CLEAN at P4–P8: 2.**

**Maximum achievable Class-B-CLEAN count in P4–P8: 5** (1 MEDIUM/subtract-two CLEAN + 1 MEDIUM/subtract-three CLEAN + 1 MEDIUM/general CLEAN + 2 HARD/general CLEAN — assuming the MEDIUM and HARD `general` caps are kept separate, which they are: §2.3 caps `general ≤ 2` is summed across MEDIUM + HARD, so the MEDIUM/general CLEAN (#16) plus two HARD/general CLEAN (#18 + #20 or #18 + #22 or #20 + #22) is forbidden by the cap; **revised max is 4** — drop one of {MEDIUM/general CLEAN, one HARD/general CLEAN}).

**Practical cushion (post-cap-arithmetic):** at minimum **3 CLEAN Class B options always available** within category caps in any P4–P8 set — e.g. `{15-2=13 (subtract-two), 15-3=12 (subtract-three), 17-5=12 (HARD/general), 18-6=12 (HARD/general)}` minus whichever fact is replaced for the take-to-decade requirement (§2.3) is still ≥ 3 CLEAN. The ≥2 rule is reachable in every recent-score-band session. See §4.1 DISTRACTOR-COVERAGE SELF-CHECK for the Haiku directive that biases this selection.

### 1.2 Pool-composition cross-check

- **Answer range:** `[10, 18]`. **`correct ≥ 10` is a NEW value in the math chip range** — `sub-to-10` produced `[0, 9]` (correct = 0 was the widening); `add-to-20` produced `[11, 18]` (currently in flight). The chip-range ceiling for sub-to-20 callers must be `maxAnswer = 19` (matching `ANSWER_RANGE_MAX_TO_20 = 20` minus 1 for the implicit "correct ≤ 19" invariant — see §3 + §6.2). Kevin's `chipMaxAnswerForCorrects` already returns `ANSWER_RANGE_MAX_TO_20 = 20` when any correct ≥ 11; sub-to-20 inherits this widening without code change. **Verified against `src/screens/Math/distractors.ts:107-110`** (the existing widening predicate routes any `correct > 10` into the 20-ceiling tier). See §7.4 for the explicit verification request.
- **Minuend range:** `[11, 19]`. Every band represented.
- **Subtrahend range:** `[1, 9]`.
- **`MathFact` representation:** every pool fact maps cleanly to `{ a: minuend, b: subtrahend, op: '-' }` — see §5. No schema changes; reuses the `op: '-'` extension from sub-to-10 (PR #241).

### 1.3 Why these 22, not more

The 45-fact no-borrow surface contains many redundant facts (e.g. `15-1=14`, `16-1=15`, `17-1=16`, `18-1=17`, `19-1=18` all exemplify subtract-one across the teen range without adding pedagogical signal beyond what `13-1=12` already provides — and four of the five have decade-aliased Class B traps that degenerate to off-by-one anyway). The 22-fact curation:

1. **Covers every band Dave names** (EASY 11–13 / subs 1–3; MEDIUM 14–16 / subs 1–6; HARD 17–19 / subs 5–9).
2. **Prioritises the "result = 10" take-to-decade exemplars** Dave § 4.2 names by name — `14-4`, `15-5`, `16-6`, `17-7`, `18-8`, `19-9` are ALL in the pool (six of the 22). These are the memorable anchors children come to retrieve faster than any non-anchor MEDIUM/HARD fact.
3. **Includes a 3-fact subtract-one cluster** at low minuends for the EASY band gentle ramp (#1, #4, #6), mirroring how sub-to-10's EASY band had subtract-zero and subtract-self rules anchoring P1–P3.
4. **Includes ≥3 clean Class-B-IN facts per discriminate band** so the ≥2/5 P4–P8 Class B rule is always achievable under category caps (per §1.1 availability table).
5. **Trims redundant "single-step from teen minuend" facts** (e.g. `15-1`, `16-1`, `17-1`, `18-1`, `19-1` all collapse to the same pedagogical signal — "trivial single-step count-back"; only #6 `13-1=12` is included as the EASY exemplar).

Pool extensions beyond 22 are deferred (§8 follow-ups):

- **HARD/general widening** — once Marian's empirical data shows the HARD-band general cluster (#18, #20, #22) is fluent, widen to include `17-3=14`, `18-5=13`, `19-6=13`, etc. Tracked in §8.
- **18-9=9 / 17-8=9 / 15-7=8 / 13-5=8 etc. (the "result < 10" cluster)** — these are BORROW facts under the strict ones-digit-≥-subtrahend definition; they require a v2 spec that widens the no-borrow constraint to "result ≥ 0" (count-back-across-decade strategy). See §7.1.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 22-fact pool above. The mix obeys the warm-up + automaticity-targeting pattern established by `add-to-10` / `sub-to-10` and ratified by Dave § 4.3 for `sub-to-20`.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source              | Distractor class (§3)                          | Why                                                                                                                                                                                                                            |
| ------------- | ------------ | ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1            | gentle       | `easy` band only         | Class 0 — gentle (≥2 away, range extremes)     | Session opener. Same posture as sub-to-10. `GENTLE_RAMP_THROUGH = 3` cutoff preserved verbatim (Dave's 2026-04-25 anxiety-window evidence, ratified by Dave § 4.3 for sub-to-20). |
| P2            | gentle       | `easy` band only         | Class 0 — gentle                               | Calibration continues.                                                                                                                                                                                                         |
| P3            | gentle       | `easy` band only         | Class 0 — gentle                               | Three successful experiences before trap distractors arrive.                                                                                                                                                                   |
| P4            | discriminate | `medium` or `hard` band  | Class A — off-by-one **OR** Class B — decade-anchor miss | First diagnostic problem.                                                                                                                                                                                                      |
| P5            | discriminate | `medium` or `hard` band  | Class A or Class B                             | "                                                                                                                                                                                                                              |
| P6            | discriminate | `medium` or `hard` band  | Class A or Class B                             | "                                                                                                                                                                                                                              |
| P7            | discriminate | `medium` or `hard` band  | Class A or Class B                             | "                                                                                                                                                                                                                              |
| P8            | discriminate | `medium` or `hard` band  | Class A or Class B                             | Closer; full discriminative pressure.                                                                                                                                                                                          |

### 2.2 Discriminate-tier distractor mix (P4–P8)

Of the 5 discriminate problems (P4–P8), **at least 2 MUST carry the Class B (decade-anchor miss) distractor**. The remaining 3 may use Class A (off-by-one) OR Class B. Rationale: Dave § 3 / Class B names decade-anchor miss as the sub-to-20-specific error mode (no sub-to-10 analog exists); without a minimum, the renderer might silently downgrade every P4–P8 Class B attempt to off-by-one when traps alias or degenerate, leaving the new class effectively dead at render time.

**Enforcement is pool-side + render-side, NOT Haiku-emitted** (mirroring the sub-to-10 §13 post-ship correction — `planner-and-canon.md` § "Wire shape is utterance-only — invariant"). Concretely:

1. **Pool-side responsibility (this spec):** the 22-fact pool MUST contain enough MEDIUM- and HARD-band facts with non-aliasing, non-degenerate Class B traps (`DEC ∈ [minAnswer, maxAnswer]`, `DEC ≠ correct`, `DEC ≠ correct ± 1`) that, given §2.3 category caps and Haiku's P4–P8 selection, at least 2 Class-B-IN facts can land at P4–P8 in every session. **Achieved with structural redundancy by the §1.1 curation** — minimum 3 Class-B-IN options always available within category caps (per §1.1 availability table).
2. **Directive-side responsibility (Kevin's `_planner.ts` block, §4.1):** the FACT POOL is annotated with each fact's `DEC` value and IN/ALIAS/degenerate status; the directive includes a `DISTRACTOR-COVERAGE SELF-CHECK` that biases Haiku toward picking ≥2 Class-B-IN facts when filling P4–P8.
3. **Render-side responsibility (`distractors.ts`, §3.3):** every P4–P8 op:'-' problem attempts a Class B trap; the trap silently downgrades to Class A (off-by-one) when `DEC ∉ [minAnswer, maxAnswer]`, `DEC === correct`, or `DEC === correct ± 1` (degenerate). The "≥2 of 5" target is met by the pool+directive in tandem; the renderer applies the trap mechanically per problem.
4. **Future lint-side reinforcement (Kevin's `compositionLint.ts`, follow-up):** a new lint rule `class-b-coverage` MAY be added to `SUB_TO_TWENTY_RULES` (mirroring the proposed `wrong-op-coverage` rule from sub-to-10 §2.2 item 4) that asserts ≥2 of P4–P8 carry Class-B-IN-capable facts. Out of scope for the immediate spec PR; flagged in §8.

### 2.3 Band coverage rules

- **At least one `easy`-band fact MUST appear in P1–P3** (gentle ramp); always true by §2.1 because problems 1–3 draw exclusively from the `easy` band.
- **At least one `take-to-decade` fact (#3, #7, #10, #14, #17, #19, #21) MUST appear in P4–P8.** Highest-leverage facts; Dave § 4.2 explicitly names these as "especially memorable and should be present in the pool." Marian's future bridging-down-through-the-decade strategy for borrow facts (v2) depends on having retrieved these.
- **No more than ONE fact per category in a single session.** Avoids monotony. Practically: at most one subtract-one, one doubles-anchor, one subtract-two, one subtract-three; at most two take-to-decade (the category is small and high-value — relaxed cap); at most two `general`.
- **The dual-exposure rule applies** — never pair a `−` fact with its `+` inverse in the same session (forward-compatibility for the future fact-family interleaving session shape, per §5).
- **No duplicates within an 8-problem set** (same as sub-to-10).

### 2.4 Recent-score modulation

The user message ships a `recentSuccessRate` for the focus node. The directive (§4) instructs Haiku to use this hint as in sub-to-10:

- Low score (`< 0.5`) → favour `easy` band for the discriminate problems (substitute `easy` band facts for what would otherwise be `medium`/`hard`). Mirrors sub-to-10's confidence-preservation fallback.
- High score (`≥ 0.85`) → push into `hard` band for the discriminate problems; ensure ≥1 take-to-decade in P5–P8.
- Mid score or no data → balanced mix (default §2.1 distribution).

### 2.5 Leitner directive (forward-looking)

`sub-to-20` is **NOT** Leitner-active in v1. The Leitner gate in `_planner.ts:buildUserMessage` and `_planner.ts:isLeitnerActive` is currently scoped `track === 'math' && focusNode === 'add-to-10'`. A future Leitner widening to `sub-to-20` can use the same machinery. **Out of scope for this spec.** Kevin's wire-up checklist (§6) flags the gate scope as a TODO once the pool has accumulated 5+ sessions of latency + accuracy data.

### 2.6 Slow-fact directive (forward-looking, op- AND tier-aware threshold)

`sub-to-20` is **NOT** slow-fact-active in v1 (`buildSlowFactSessionHint` scope is `add-to-10` only). When it widens, the threshold for `op === '-'` AND focus node `sub-to-20` MUST be calibrated separately from `op === '-'` on `sub-to-10` — see §5. Sub-to-20 latency runs systematically higher than sub-to-10 latency at the same retrieval-confidence level because the facts are larger-minuend, multi-step count-backs (Geary et al. 2007). Kevin's wire-up checklist (§6) flags this.

---

## 3. Distractor design — three classes (gentle + off-by-one + NEW decade-anchor miss)

`sub-to-20` reuses the existing `pickDistractors(correct, problemIndex, maxAnswer, opts?)` API in [`src/screens/Math/distractors.ts`](../../src/screens/Math/distractors.ts) but EXTENDS it with a new third distractor class. The cutoff and gentle behaviour stay locked from Dave's 2026-04-25 consult; the off-by-one class is unchanged.

### 3.1 Class 0 — gentle (P1–P3) — unchanged from sub-to-10

Algorithm: two distractor values, each ≥2 away from `correct`, biased toward `[minAnswer, maxAnswer]` extremes. Already implemented in `distractors.ts:gentleDistractors`. **No code change for `sub-to-20`** — same algorithm fires on `op === '-'` problems for `problemIndex ∈ {1, 2, 3}` with `minAnswer = 10` and `maxAnswer = 19`.

**Range note for `sub-to-20`.** Sub-to-20 callers pass `minAnswer = 10` (since the pool produces results in `[10, 18]`; chip 9 and below add zero pedagogical signal and consume cognitive bandwidth on irrelevant distractors). Sub-to-20 callers pass `maxAnswer = 19` (matching the sub-to-10 ceiling 1-step into the next decade — sub-to-20 results don't exceed 18, but the gentle distractor's "range extreme" bias targets `maxAnswer` so a 19 chip is occasionally rendered as the "high extreme"). **See §7.4 for the open question on whether `maxAnswer = 19` is the right ceiling vs `maxAnswer = 20`.**

### 3.2 Class A — off-by-one — unchanged from sub-to-10

Algorithm: `[correct − 1, correct + 1]` clamped to `[minAnswer, maxAnswer]`. Already implemented in `distractors.ts:offByOneDistractors`. **No code change for `sub-to-20`** — same algorithm fires on `op === '-'` problems for `problemIndex ∈ [4, 8]` when Class B is unavailable / degenerate.

### 3.3 Class B — decade-anchor miss distractor — NEW for `sub-to-20`

**Definition.** For a subtraction problem `a − b = c` where `c ∈ [10, 18]`, the decade-anchor-miss distractor is the multiple of 10 nearest to `c` (excluding `c` itself):

```
DEC = Math.round(c / 10) * 10
```

For every pool result in `[10, 18]`, `DEC = 10` (rounds down because 10 ≤ c ≤ 18, midpoint 14.5 rounds to 10 for c ≤ 14 and to 20 for c ≥ 15 — actually `Math.round(14/10)=1, Math.round(15/10)=2`, so c ≤ 14 → DEC=10, c ≥ 15 → DEC=20). **In a strictly no-borrow pool, both 10 and 20 are possible Class B traps.** The decision tree below codifies which is rendered.

It targets the developmental error Dave § 3 / Class B names: when counting back across the decade boundary, children frequently misidentify which decade they land in (Baroody 1984; Fuson & Kwon 1992). For `15 − 6 = 9` (BORROW — not in v1 pool) the child counting back stops at the decade anchor 10 instead of continuing to 9. The pool's no-borrow facts produce results in `[10, 18]`, so the analogous error is the child stopping at the wrong decade anchor — either landing at 10 (when the true result is 12) or jumping to 20 (when the true result is 18).

**Class B formula (definitive, Kevin's implementation contract).**

```ts
function classBDistractor(
  correct: number,
  minAnswer: number,
  maxAnswer: number,
): number | null {
  // 1. Compute the nearest multiple of 10.
  const dec = Math.round(correct / 10) * 10
  // 2. Out-of-range → caller falls back to Class A.
  if (dec < minAnswer || dec > maxAnswer) return null
  // 3. Aliases correct (correct ∈ {10, 20}) → caller falls back to Class A.
  if (dec === correct) return null
  // 4. Aliases off-by-one secondary (correct ± 1 === dec) → caller falls back to Class A.
  //    Otherwise the chip pair {DEC, correct ± 1} would be {10, 10} when correct = 11.
  if (Math.abs(dec - correct) === 1) return null
  return dec
}
```

**Class B fallback (the question Dave § 3 / Class B explicitly deferred to Kyle).** When `classBDistractor` returns `null` (any of the three degeneration cases above), the caller falls back to **Class A (off-by-one)** — emitting `[correct − 1, correct + 1]` clamped. This is the same downgrade pattern as sub-to-10's wrong-op OOR fallback (§3.2 of sub-to-10). Concretely: when a problem is selected for Class B but the trap degenerates, the rendered chips are identical to a Class A problem (`{correct − 1, correct, correct + 1}` clamped). **Haiku's distractorClass hint is then misleading** for that specific problem — `distractors.ts` checks Class B fitness FIRST and silently downgrades.

**Combined-pair shape (Class B plus a second distractor).** For a Class B problem, the two distractors are:

| Slot      | Value                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trap      | `DEC` (the decade-anchor lure)                                                                                                                                                                                         |
| Secondary | The off-by-one near-miss on the OPPOSITE side from DEC. If `DEC < correct` (the common case: correct ≥ 12 → DEC = 10), secondary = `correct + 1`. If `DEC > correct` (correct ≥ 15 → DEC = 20), secondary = `correct − 1`. This biases the chip layout away from "DEC and secondary both on the same side of correct," which would make the discrimination too easy. |

**Worked examples (drawn from the 22-fact pool §1.1):**

- `#16 16 − 4 = 12`. `DEC = Math.round(12 / 10) * 10 = 10`. In range, not aliasing, not degenerate. Trap = `10`. Secondary = `correct + 1 = 13` (DEC < correct, so secondary opposite side). Chips `{10, 12, 13}` — the child who decade-anchored at 10 picks `10`; the child off-by-one in either direction picks `13`.
- `#21 19 − 9 = 10`. `DEC = 10`. **Aliases correct** → Class B returns `null`; falls back to Class A. Chips `{10, 11}` (off-by-one secondary on the only available side since `correct − 1 = 9 < minAnswer = 10`). The pool entry's annotation `ALIAS` calls this out — Class B fires zero times on this fact.
- `#15 16 − 5 = 11`. `DEC = 10`. Aliases off-by-one (`correct − 1 = 10 = DEC`) → Class B returns `null`; falls back to Class A. Chips `{10, 11, 12}`. Pool annotation `boundary, off-by-one secondary` calls this out.
- `#13 15 − 2 = 13`. `DEC = 10`. In range, not aliasing, separation 3. Trap = `10`. Secondary = `correct + 1 = 14`. Chips `{10, 13, 14}` — clean three-way separation, the kind of fact where Class B genuinely fires.
- `#19 18 − 8 = 10`. `DEC = 10`. Aliases correct → Class B returns `null`. Same as #21.

**Scope.** Class B is conditional on `focusNode === 'sub-to-20' && problemIndex >= 4`. Never fires for P1–P3 (gentle ramp). Never fires for `sub-to-10` (the sub-to-10 pool's results are in `[0, 9]`; `DEC = 0` for results 0–4 and `DEC = 10` for 5–9 — but `DEC = 10` is the chip-range ceiling, not a sub-to-10 error mode; sub-to-10 keeps its Class A + wrong-op pair unchanged). Never fires for `op === '+'`.

**Sub-to-10 ↔ sub-to-20 wrong-op decision.** Dave § 3 / Class C explicitly REJECTED wrong-operation as a sub-to-20 class because the wrong-op value (`a + b`) is almost always out of range at teen-minuend scale (e.g. `17-8=9` → wrong-op `17+8=25` ≫ `maxAnswer = 19`). **Sub-to-20 v1 does NOT use Class 2 (wrong-op).** Sub-to-10 keeps its wrong-op class as-is (PR #241 wiring unchanged).

### 3.4 Distractor-class field — render-side ONLY (continues sub-to-10's post-ship correction)

Per `planner-and-canon.md` § "Wire shape is utterance-only — invariant" and the sub-to-10 §3.4 post-ship correction: the `MathProblem.distractorClass` field is render-derived, not planner-emitted. For sub-to-20, `Math.tsx` sets `distractorClass: 'decade-anchor'` for every op:'-' P4–P8 problem where the focus node is `sub-to-20`; `pickDistractors` then silently downgrades to off-by-one when the trap fails the §3.3 formula's degenerate-case checks.

**Type widening.** The current `distractorClass` union is `'off-by-one' | 'wrong-op'`. Sub-to-20 adds `'decade-anchor'`:

```ts
distractorClass?: 'off-by-one' | 'wrong-op' | 'decade-anchor'
```

The `PickDistractorsOpts.distractorClass` field in [`distractors.ts:159`](../../src/screens/Math/distractors.ts#L159) widens identically.

### 3.5 Class B is sub-to-20-specific — `sub-to-10` and `add-to-*` are explicitly UNCHANGED

Class B fires only when the focus node is `sub-to-20` AND problem index ≥ 4 AND op = `-`. No retroactive effect on the sub-to-10 wiring (PR #241); no effect on `add-to-10` / `add-to-20`. The `wrongOpDistractors` function in `distractors.ts` continues to fire for sub-to-10 P4–P8 problems exactly as today.

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `sub-to-20` block

Replace the one-line skeleton in [`api/_planner.ts:1022`](../../api/_planner.ts#L1022) with the directive block below. The block follows the same shape as sub-to-10's expanded directive plus the sub-to-20-specific Class B guidance.

### 4.1 Block text (literal — Kevin's copy)

> ```
> - sub-to-20: subtraction with minuend in [11, 19] and subtrahend in [1, 9] and result in [10, 18]. NO BORROW — the ones-digit of the minuend MUST be ≥ subtrahend. read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seventeen minus five. How many are left?"
>
>   NO-BORROW SELF-CHECK (apply before emitting every problem): for chosen (minuend a, subtrahend b), COMPUTE ones-digit(a) = a mod 10 and CONFIRM that ones-digit(a) >= b. If ones-digit(a) < b, the problem is a BORROW fact and is FORBIDDEN; reject and pick another from the pool. Worked example: 14-3=11 is no-borrow (ones-digit(14)=4 >= 3 → OK). 14-7=7 is BORROW (ones-digit(14)=4 < 7 → FORBIDDEN). 18-9=9 is BORROW (ones-digit(18)=8 < 9 → FORBIDDEN). The pool below has been pre-filtered; this self-check is a defense-in-depth assertion against drift.
>
>   FACT POOL (22 facts; pick exactly 8 distinct facts from this pool per session, no duplicates):
>   Each fact is annotated with [BAND/category] and DEC = the decade-anchor-miss trap value used at render time. ALIAS means the trap aliases the correct answer (forbidden, downgrades to off-by-one). BOUNDARY means the trap is off-by-one from correct (degenerate, downgrades). CLEAN means the trap is in range, distinct from correct, and ≥2 separation (a usable Class B distractor).
>   - Easy band (P1-P3 only, no Class B fires here):
>     · 11-1=10  [EASY/subtract-one]    (DEC=10 ALIAS)
>     · 12-2=10  [EASY/doubles-anchor]  (DEC=10 ALIAS)
>     · 13-3=10  [EASY/take-to-decade]  (DEC=10 ALIAS)
>     · 12-1=11  [EASY/subtract-one]    (DEC=10 BOUNDARY — degenerate, downgrades)
>     · 13-2=11  [EASY/subtract-two]    (DEC=10 BOUNDARY — degenerate, downgrades)
>     · 13-1=12  [EASY/subtract-one]    (DEC=10 CLEAN — separation 2)
>   - Medium band (P4-P8 eligible):
>     · 14-4=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
>     · 14-3=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
>     · 14-2=12  [MEDIUM/subtract-two]   (DEC=10 CLEAN — separation 2)
>     · 15-5=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
>     · 15-4=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
>     · 15-3=12  [MEDIUM/subtract-three] (DEC=10 CLEAN — separation 2)
>     · 15-2=13  [MEDIUM/subtract-two]   (DEC=10 CLEAN — separation 3)
>     · 16-6=10  [MEDIUM/take-to-decade] (DEC=10 ALIAS)
>     · 16-5=11  [MEDIUM/general]        (DEC=10 BOUNDARY — degenerate)
>     · 16-4=12  [MEDIUM/general]        (DEC=10 CLEAN — separation 2)
>   - Hard band (P5-P8 eligible):
>     · 17-7=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
>     · 17-5=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
>     · 18-8=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
>     · 18-6=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
>     · 19-9=10  [HARD/take-to-decade]   (DEC=10 ALIAS)
>     · 19-7=12  [HARD/general]          (DEC=10 CLEAN — separation 2)
>   POOL-MEMBERSHIP SELF-CHECK: before emitting each problem, verify the chosen (a, b) pair appears verbatim above. The 22 listed pairs are the ONLY allowed facts. Common BORROW candidates to REJECT (NOT in the pool, all violate the NO-BORROW SELF-CHECK above): 11-2, 11-3, ... 11-9; 12-3, 12-4, ... 12-9; 13-4, ... 13-9; 14-5, 14-6, 14-7, 14-8, 14-9; 15-6, 15-7, 15-8, 15-9; 16-7, 16-8, 16-9; 17-8, 17-9; 18-9. NOTE that 19-9=10 IS in the pool (ones-digit(19) = 9 ≥ 9 = subtrahend → no-borrow). Also REJECT any pair where ones-digit(a) ≥ b but the pair is simply outside the 22-fact curation (e.g. 15-1=14, 16-2=14, 19-5=14 — valid no-borrow facts that are not in the v1 pool).
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window; no Class B fires yet.
>   2. NEGATIVE ANCHOR — P1, P2, P3 PLACEMENT BANS (any one of these is a hard rule violation):
>      · DO NOT place any MEDIUM-band fact at P1, P2, or P3. MEDIUM-band only appears at P4 or later.
>      · DO NOT place any HARD-band fact at P1, P2, or P3. HARD-band only appears at P5 or later.
>      · The ONLY facts allowed at P1, P2, P3 are: 11-1, 12-2, 13-3, 12-1, 13-2, 13-1.
>   3. Problems 4-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) → bias toward medium; high score (>= 0.85) → push toward hard with ≥1 take-to-decade in P5-P8; mid score → balanced.
>   4. At least one take-to-decade fact MUST appear in P4-P8 (drawn from: 14-4, 15-5, 16-6, 17-7, 18-8, 19-9). Highest-leverage facts; Dave § 4.2 names these as memorable anchors.
>   5. DUAL-EXPOSURE RULE: never pair a subtraction fact and its addition inverse in the same session. E.g. if 16-4=12 is included, 4+12=16 (or 12+4=16) is FORBIDDEN. This rule is forward-compatible with future add-to-20 / sub-to-20 fact-family interleaving.
>   6. NO duplicate facts within the 8-problem set.
>   7. Category caps (across the 8-problem session): at most one each of subtract-one, doubles-anchor, subtract-two, subtract-three; at most two of take-to-decade (high-value, relaxed cap); at most two of general.
>
>   DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8): the render pipeline (src/screens/Math/Math.tsx) attempts a Class B (decade-anchor miss) trap on every op:'-' P4-P8 problem when focusNode === 'sub-to-20', and silently downgrades to Class A (off-by-one) when the trap aliases correct, aliases off-by-one, or falls out of [minAnswer, maxAnswer]. To deliver ≥2 in-range Class B traps across P4-P8 (Kyle's spec target), bias the P4-P8 selection toward CLEAN-annotated facts above. CLEAN-annotated MEDIUM facts: 14-2, 15-3, 15-2, 16-4 (any one each of subtract-two and subtract-three; subtract-two cap is ≤1 so 14-2 and 15-2 compete; general cap is ≤2 so 16-4 can co-occur with at most one other general). CLEAN-annotated HARD/general facts: 17-5, 18-6, 19-7 (any two — the general cap of 2 lets two co-occur). NEGATIVE ANCHOR: it is FORBIDDEN to fill P4-P8 entirely with ALIAS- or BOUNDARY-annotated facts when ≥2 CLEAN-annotated facts (from any band combination) are still available within category caps. Before finalising the 5-problem P4-P8 set, count the CLEAN-annotated facts in the set; if it is < 2 AND ≥2 CLEAN-annotated facts are still available within category caps, SWAP an ALIAS/BOUNDARY fact for a CLEAN one. Maximum achievable CLEAN-count in P4-P8 is 5 (one MEDIUM/subtract-two CLEAN + one MEDIUM/subtract-three CLEAN + one MEDIUM/general CLEAN + two HARD/general CLEAN).
>
>   PROSODY: numbers are spelled out as words ("ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"). Capitalize the first word of each sentence. The "minus" template renders cleanly on en-US-EmmaMultilingualNeural rate -10% for all teen values; no SSML overrides required. **Do NOT verbally decompose the minuend** (e.g. do NOT say "ten and seven, minus five" or "ten plus seven minus five") — per Dave § 2 (L2 context note), verbal decomposition adds L2 cognitive load without pedagogical benefit. Emma says the numeral name plainly.
> ```

> **Note on "take away" framing.** Dave's research note does NOT mandate a first-session "take away" variant for sub-to-20. Marian has already seen the "minus" framing throughout sub-to-10 by the time she reaches sub-to-20; introducing a phrasing variant at sub-to-20 onset would re-litigate the same cognitive-load concern Dave § Q2 (sub-to-10) flagged. **Sub-to-20 uses the "minus" template from session 1.** No first-encounter gate entry needed in `FIRST_ENCOUNTER_GATED_NODES`. See §7.2 for the open question — Thomas can re-open if he wants a "take away" warmup for sub-to-20 too.

### 4.2 Per-slot utterance templates

| Slot         | Template                                                                | Example for `15 − 3 = 12`                  | Notes                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `read`       | `"<minuend> minus <subtrahend>. How many are left?"`                    | `"Fifteen minus three. How many are left?"` | "are left" framing follows sub-to-10 §4 (concrete-removal mental model).                                                                               |
| `correct`    | `"Yes! <answer>!"`                                                      | `"Yes! Twelve!"`                            | Number-celebration template; same shape as sub-to-10.                                                                                                  |
| `reprompt`   | `"Hmm... try again?"` (verbatim)                                        | `"Hmm... try again?"`                       | Locked phrasing — do NOT vary.                                                                                                                         |
| `hint`       | `"Look. <minuend>. Take away <subtrahend>. How many now?"`              | `"Look. Fifteen. Take away three. How many now?"` | Mirrors sub-to-10's hint structure. Uses "take away" framing in the hint (concrete-removal scaffold), regardless of the "minus" read-line. |
| `giveAnswer` | `"This one is <answer>."`                                               | `"This one is twelve."`                     | Locked.                                                                                                                                                |

**Teen-number prosody.** All results land in `[10, 18]`. The Azure Emma multilingual voice renders "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen" cleanly at rate -10% (validated already by `add-to-20` which uses the same range). No SSML overrides required.

### 4.3 First-encounter scaffolding gate — NOT REQUIRED for sub-to-20

Per §4.1 directive note: sub-to-20 uses the "minus" template from session 1 onwards. **No entry added to `FIRST_ENCOUNTER_GATED_NODES`.** If Thomas later requests a "take away" warmup (§7.2 open question), this section + §6.4 wire-up gain a sub-to-20 gate entry mirroring the sub-to-10 pattern.

---

## 5. Schema posture, advancement gate, dual-exposure rule, slow-fact request

### 5.1 Schema posture — `MathFact` reuse, no new infrastructure

`sub-to-20` introduces NO new TypeScript types. Every fact uses the existing `MathFact` shape with `op: '-'` (inherited from sub-to-10 wire-up PR #241).

**Wire-shape changes (small).**

1. `MathProblem.distractorClass` union widens to include `'decade-anchor'` (§3.4).
2. `PickDistractorsOpts.distractorClass` union widens identically.

**Browser parser adapter.** No change. [`planFromServer.ts`](../../src/screens/Math/planFromServer.ts) already widened for the `"X minus Y. How many are left?"` template in PR #241; teen-minuend reads parse against the same regex without modification. **One verification:** confirm `NUMBER_WORDS` contains entries for `eleven`-`nineteen` (it does — it was widened to 20 for `add-to-20`; verified in `planFromServer.ts:84-104`). See §6.1.

**`distractors.ts` extension.**

1. Add `'decade-anchor'` to `PickDistractorsOpts.distractorClass` union.
2. Add `decadeAnchorDistractors(correct, minAnswer, maxAnswer)` internal function implementing the §3.3 formula.
3. Extend the dispatch in `pickDistractors` to route `op === '-' && distractorClass === 'decade-anchor'` (and the absence of `operands`, which Class B doesn't need) to `decadeAnchorDistractors`; fall back to `offByOneDistractors` on `null` return.

**`maxAnswer` widening for sub-to-20 callers.** `Math.tsx` invokes `pickDistractors` with `maxAnswer = chipMaxAnswerForCorrects(allCorrects)`. The existing `chipMaxAnswerForCorrects` returns `ANSWER_RANGE_MAX_TO_20 = 20` for any correct > 10 (verified `distractors.ts:107-110`). Sub-to-20 results are in `[10, 18]` so this widens automatically. **No code change required** — but Kevin must verify in §6.2 that the dispatch path threads correctly.

**No screen-side changes.** `Math.tsx` is operation-agnostic; chip-rendering and gesture handling consume `MathProblem` without inspecting `op` or `focusNode`. The audio path consumes `read` text verbatim; "minus" + teen-number renders cleanly without phoneme overrides (validated for `add-to-20` already).

### 5.2 Advancement gate — `sub-to-10 → sub-to-20` (ACCURACY ONLY)

Per the curriculum order in `MATH_TREE` and `MATH_NODES_IN_ORDER`, sub-to-20 sits AFTER sub-to-10. The advancement gate is `sub-to-10 → sub-to-20`. Dave § 4.4 frames the promotion as accuracy-only:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default threshold `95/3` locked 2026-05-02, ticket 86c9kwvy0; see `progress-and-persistence.md` § "Mastery rule").

**Explicitly NOT a gate:**

- ❌ Slow-fact list length. Dave § 4.4: "Holding Marian on sub-to-10 past 95% waiting for latency to drop is counterproductive — fact-family exposure via sub-to-20 is itself therapeutic for slow sub-to-10 retrieval." Same rationale as sub-to-10's promotion from add-to-20 (per `sub-to-10-content.md` §6).
- ❌ Latency median. Slow-fact directive is backend re-targeting, not promotion signal.

**Hard stop (parent / observation gate, NOT algorithmic):** standard `autoPromote: false` Parent Settings flag.

**Code implication.** NO code change to `applyMasteryRule` or `pickFocusNode`. The existing rule already promotes on accuracy alone. This spec affirms the existing behaviour is correct for the `sub-to-10 → sub-to-20` transition.

### 5.3 Dual-exposure rule — never pair a `-` fact with its `+` inverse in the same session

**Rule (LOCKED — Dave § 4.5, ratified verbatim from sub-to-10 §7).**

> Within an 8-problem `sub-to-20` session, no subtraction fact and its addition inverse may co-occur.

**Definition.** For a subtraction fact `a − b = c`, the addition inverses are `b + c = a` and `c + b = a`. Both orderings are FORBIDDEN in the same session as the subtraction fact.

**Examples:**

- ✅ Session contains `16 − 4 = 12`; `4 + 12 = 16` and `12 + 4 = 16` are both FORBIDDEN.
- ✅ Session contains `19 − 9 = 10`; `9 + 10 = 19` and `10 + 9 = 19` are both FORBIDDEN.

**V1 enforcement scope.** `sub-to-20` sessions are pure-subtraction in v1 (all 8 problems use `op === '-'`). Within a single 8-problem subtraction set, two `−` facts can be inverses of each other ONLY if they reference the same operand triple (e.g. `19 − 9 = 10` and `19 − 10 = 9`, but the latter has subtrahend 10 which is OUT of pool — so this collision can't arise). The dual-exposure rule applies to `−` ↔ `+` cross-operation pairing, which is vacuously satisfied in pure-`−` sessions. **Rule is forward-compatibility scaffolding** for the future mixed-operation session shape.

**Forward-compatibility.** Per Dave § 1.2 and McNeil et al. 2025, future spec MAY widen sub-to-20 sessions to interleave with add-to-20 fact-family practice (the "fact-family interleaving" shape). The dual-exposure rule must remain in force at that point.

### 5.4 Op- AND tier-aware slow-fact threshold — REQUEST for `slowFacts.ts`

**Out of scope for THIS spec to author** — flagged as a Kevin TODO for a separate PR (§6).

**Problem.** Today `slowFacts.ts:69` defines `SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000` — a global threshold. Sub-to-10's spec (§8) requested a flat 6000 ms threshold + 5-session warmup for `op === '-'` (decision locked Thomas 2026-05-15, sub-to-10 §11 Q2). **Sub-to-20 needs its own threshold parameterisation** because:

- Sub-to-20 facts involve teen-minuend count-backs (Geary et al. 2007 — RT systematically higher than sub-to-10 at the same retrieval-confidence level due to extra count-back steps).
- Applying sub-to-10's flat 6000 ms threshold to sub-to-20 cold-start would flood the slow-fact payload on early sub-to-20 sessions, defeating the canon-first fast-path (`planner-and-canon.md` § "Track-based payload" — non-empty `slowFacts` bypasses canon AND in-memory cache).

**Proposed shape — operation-AND-tier-aware threshold (RECOMMENDED for v1 of the slowFacts widening).**

| Operation | Focus node | Sessions on the node | Threshold (ms) |
| --------- | ---------- | -------------------- | -------------- |
| `+`       | any        | any                  | 5000           |
| `−`       | sub-to-10  | 1 – 4                | suppressed     |
| `−`       | sub-to-10  | 5 +                  | 6000           |
| `−`       | sub-to-20  | 1 – 4                | suppressed     |
| `−`       | sub-to-20  | 5 +                  | **7000**       |
| `*`       | any        | any                  | 5000 (placeholder — re-evaluate when multiplication tier ships) |

Sub-to-20's flat threshold is set 1000 ms higher than sub-to-10's because the count-back step count is systematically higher (Dave § 1.2 cites Geary et al. 2007 for the RT scaling). The 5-session warmup mirrors the sub-to-10 §11 Q2 decision pattern.

**Code-change shape.**

```ts
// slowFacts.ts — extend the threshold accessor with focus node
export function slowFactLatencyThresholdMs(
  op: '+' | '-' | '*',
  focusNode: string,
  nodeSessionCount: number,
): number | null {
  if (op !== '-') return SLOW_FACT_MIN_MEDIAN_LATENCY_MS // 5000
  if (focusNode !== 'sub-to-10' && focusNode !== 'sub-to-20') {
    return SLOW_FACT_MIN_MEDIAN_LATENCY_MS
  }
  if (nodeSessionCount < 5) return null // suppress
  if (focusNode === 'sub-to-10') return 6000
  if (focusNode === 'sub-to-20') return 7000
  return SLOW_FACT_MIN_MEDIAN_LATENCY_MS
}
```

**Out of scope here.** Kevin chooses. This spec FLAGS the requirement; the slowFacts widening is its own PR. Dependencies:

1. The slow-fact directive scope (`isSlowFactsActive` in [`_planner.ts:726`](../../api/_planner.ts#L726)) must widen to include `sub-to-10` first (sub-to-10's deferred-follow-up per its §9.7), then `sub-to-20`.
2. `buildSlowFactSessionHint` must take the focus-node argument so it can route through `slowFactLatencyThresholdMs(op, focusNode, ...)`.

**Suggested order.** Land sub-to-20 content + canon first (the current scope of this spec). Slow-fact widening lands in a follow-up after the sub-to-10 slow-fact PR ships (which is itself deferred until Marian generates ≥5 sub-to-10 sessions).

---

## 6. Wire-up checklist for Kevin / Devon

This is the ONLY actionable list for the implementing developers. Everything above is rationale + content; everything below is what changes in code.

> **Dependency order is load-bearing.** Per `project_planner_parser_contract.md`: widen the browser parser BEFORE widening the planner (already done in PR #241 for sub-to-10's "minus" + "take away" templates — sub-to-20 inherits the widened regex; **but the `decade-anchor` distractor union widening is sequenced AFTER the render-side type widening lands**). Items below are numbered in safe-merge order. **PR split locked at 2** per the sub-to-10 precedent (content + canon in PR 1; render in PR 2).

### 6.1 Parser verification (FIRST — should be a no-op confirmation, no code change expected)

- [ ] **`src/screens/Math/planFromServer.ts:NUMBER_WORDS`** — verify entries for `'eleven'`-`'nineteen'` are present. Likely already true (added for `add-to-20`); if missing, add. Sub-to-20 read-lines contain teen number words for both minuend and result.
- [ ] **`src/screens/Math/planFromServer.ts`** — verify the existing `"X minus Y. How many are left?"` regex parses sub-to-20 read-lines correctly (teen-minuend, single-digit-subtrahend). Add explicit fixtures for `19-9=10` and `11-1=10` (the extremes of the no-borrow pool) in `planFromServer.test.ts`.
- [ ] **`src/screens/Math/sessionPlans.ts:MathProblem.distractorClass`** — widen the union to include `'decade-anchor'`.
- [ ] **Tests** — `planFromServer.test.ts` gains read-template fixtures for sub-to-20 (5–6 fixtures across EASY/MEDIUM/HARD bands). Assert `op === '-'` after parse.
- [ ] **CI gate** — vitest passes locally (`npx vitest run` per `feedback_run_vitest_before_merge`).

### 6.2 Distractor extension (Class B — decade-anchor miss)

- [ ] **`src/screens/Math/distractors.ts:PickDistractorsOpts.distractorClass`** — widen the union to include `'decade-anchor'`.
- [ ] **`src/screens/Math/distractors.ts`** — add `decadeAnchorDistractors(correct, minAnswer, maxAnswer)` internal function implementing the §3.3 formula. Returns `[number, number] | null`. Null cases (degenerate / out-of-range / aliases-correct / aliases-off-by-one) downgrade to off-by-one at the call site.
- [ ] **`src/screens/Math/distractors.ts:pickDistractors`** — extend dispatch:
  ```ts
  const wantsDecadeAnchor =
    op === '-' &&
    opts?.distractorClass === 'decade-anchor'
  if (wantsDecadeAnchor) {
    const dec = decadeAnchorDistractors(correct, minAnswer, maxAnswer)
    if (dec !== null) return dec
    // Range / alias / degeneration — fall through to off-by-one (§3.3 fallback).
  }
  ```
- [ ] **`src/screens/Math/distractors.test.ts`** — pin every CLEAN-annotated pool fact (§1.1) against expected Class B chip outputs. Pin every ALIAS / BOUNDARY pool fact against the off-by-one fallback. Assert chip ordering: `{DEC, correct ± 1}` with the secondary on the opposite side from DEC per §3.3.
- [ ] **`src/screens/Math/Math.tsx`** — extend the P4–P8 distractor-class derivation: when `focusNode === 'sub-to-20'`, default `distractorClass = 'decade-anchor'`; when `'sub-to-10'`, default `distractorClass = 'wrong-op'` (existing PR #241 behaviour); when `'add-to-10'` / `'add-to-20'`, default `undefined` (existing behaviour). Pass through to `pickDistractors`.
- [ ] **`src/screens/Math/Math.tsx`** — verify the operator-glyph render shows `−` for sub-to-20 (PR #241 already wired this for sub-to-10; sub-to-20 should inherit since the dispatch is op-keyed). Sanity-check.
- [ ] **`src/screens/Math/sessionPlans.ts`** — verify `MathProblem.op` is required and threaded through static fallback plans (PR #241 already did this for sub-to-10; sanity-check sub-to-20's fallback path).

### 6.3 Planner directive — `MATH_TRACK_GUIDE` `sub-to-20` block

- [ ] **`api/_planner.ts:1022`** — replace the one-line skeleton with the 22-fact-pool directive in §4.1, including:
  - The NO-BORROW SELF-CHECK block with worked examples.
  - The 22-fact FACT POOL annotated with `[BAND/category]` + `DEC` + ALIAS/BOUNDARY/CLEAN status.
  - SESSION COMPOSITION RULES (1–7) per §4.1.
  - The DISTRACTOR-COVERAGE SELF-CHECK block (Class B coverage).
  - PROSODY block (teen-number rendering, no verbal decomposition).
- [ ] **`scripts/compositionLint.ts`** — add `SUB_TO_TWENTY_POOL` and `SUB_TO_TWENTY_RULES` configs mirroring the sub-to-10 pattern. Rule set:
  1. Pool membership — every fact must be one of the 22 `(a, b)` pairs in §1.1.
  2. Category caps: `subtract-one ≤ 1`, `doubles-anchor ≤ 1`, `subtract-two ≤ 1`, `subtract-three ≤ 1`, `take-to-decade ≤ 2`, `general ≤ 2`.
  3. Band-by-slot: P1–P3 EASY only (and EASY appears ONLY here); P4–P8 MEDIUM (P4-P8) + HARD (P5-P8); EASY FORBIDDEN at P4–P8.
  4. Take-to-decade coverage: ≥1 take-to-decade fact MUST appear in P4–P8.
  5. No duplicates.
- [ ] **`scripts/compositionLint.ts:resolveTierBinding`** — add a sub-to-20 branch routing to `SUB_TO_TWENTY_RULES`.
- [ ] **`scripts/compositionLint.test.ts`** — fixtures exercising the new pool entries + composition rules. Include positive tests: a baked plan picking `{16-4, 17-5}` at P4-P5 (two CLEAN HARD/MEDIUM facts) with take-to-decade at P6 passes lint. Include negative tests: a plan with `15-5` and `5+10=15` in the same session fails dual-exposure. A plan with three `take-to-decade` facts fails category cap.
- [ ] **`api/_planner.ts`** — verify the system-prompt JSON contract carries `op: '-'` in the emitted `MathProblem` shape (already true post-PR #241; sanity-check).
- [ ] **`api/_planner.test.ts`** — add a focused test: stub Haiku, feed back a `sub-to-20` plan, assert: (a) every problem has `op: '-'`; (b) every problem has `(a, b)` in the 22-fact pool; (c) every problem satisfies `ones-digit(a) ≥ b` (no-borrow); (d) at least one take-to-decade fact appears in P4–P8; (e) at least 2 of P4–P8 are CLEAN-annotated facts (#9, #12, #13, #16, #18, #20, #22); (f) no operand-triple co-occurs as `-` and `+` (dual-exposure); (g) category caps respected.

### 6.4 First-encounter gate — NOT REQUIRED for sub-to-20

Per §4.3: sub-to-20 uses the "minus" template from session 1. No entry added to `FIRST_ENCOUNTER_GATED_NODES`. The existing `_firstEncounterGate.test.ts` negative-assertion for the math nodes other than sub-to-10 remains TRUE for sub-to-20 (it was revised in PR #239 to per-node assertions; sub-to-20 stays in the not-gated set). **Sanity-check the test file lists sub-to-20 as not-gated.**

If §7.2 re-opens this (Thomas requests a "take away" warmup), this section + §6.3 directive variant gain a sub-to-20 gate entry.

### 6.5 Canon prebake

- [ ] **`scripts/generateSessionCanon.ts:activeCombos()`** — confirm `sub-to-20` is in `MATH_FOCUS_NODES` iteration set. Should already be (the iteration typically covers all `VALID_MATH_FOCUS_NODES`); verify and add if missing.
- [ ] **`npm run canon:regen`** — incremental regen for `sub-to-20` only:
  ```
  rm public/canon/math/level-1/sub-to-20.json
  cp .env.local <worktree>/.env.local           # canon-bake needs the keys
  yarn install --frozen-lockfile               # worktree needs node_modules
  npx tsx scripts/generateSessionCanon.ts --require-keys
  ```
  Per `planner-and-canon.md` § "Incremental-by-default trick". Bake produces ~25s of work and ~$0.005 of Haiku + Azure spend. Commit the JSON diff in the same PR.
- [ ] **Canon-lint gate** — `npm run canon:lint` must pass (text-encoding + composition lint chained). Composition lint will exercise the new `SUB_TO_TWENTY_RULES`.
- [ ] **Post-bake Class-B-coverage spot-check** — `cat public/canon/math/level-1/sub-to-20.json | jq '.utterances[] | select(.id | test("^math\\.p[4-8]\\.read$"))'` then walk each `read` text, compute `correct` and `DEC`, count facts where `DEC ∈ [10, 19] && DEC !== correct && Math.abs(DEC − correct) >= 2`. Assert count ≥ 2. (This check belongs in `compositionLint.ts` long-term, per §8 follow-up.)
- [ ] **`scripts/generateSessionCanon.test.ts`** — combo-count regression should auto-pick sub-to-20 if it's in the iteration set; if pinned explicitly, bump.

### 6.6 Mastery / focus-node picker — NO CHANGE

Per the existing curriculum order (locked in sub-to-10 §11 Q1, Thomas 2026-05-15): `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → ...`. NO CHANGE to `MATH_TREE` in [`src/lib/progress/mastery.ts`](../../src/lib/progress/mastery.ts) or `MATH_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts`](../../src/lib/progress/focusNode.ts). The promotion rule applies as-is.

- [ ] **`src/lib/progress/defaults.ts:DEFAULT_SKILL_LEVELS`** — check the current default for `'sub-to-20'`. Marian's April 2026 diagnostic says "extend to 20 no-borrow" — she has not drilled this tier. The default should be `'practicing'` (not `'mastered'`), mirroring the sub-to-10 Q3 decision (Thomas 2026-05-15, sub-to-10 §9.6). **Sanity-check the current value and flip if needed.** If already `'practicing'`, no change.

### 6.7 Slow-fact widening — DEFERRED FOLLOW-UP

- [ ] **(FOLLOW-UP PR)** Implement op- AND tier-aware threshold in `slowFacts.ts` per §5.4. NOT in this PR. Depends on sub-to-10's slow-fact follow-up landing first.

### 6.8 Test coverage minimums

- [ ] Unit: parser (every pool fact's read-line parses with correct `op`), distractors (every CLEAN pool fact × Class B; every ALIAS/BOUNDARY pool fact × Class A fallback), planner stub (composition rules #1–7 from §4.1 enforced), composition lint (sub-to-20 pool + caps + band-by-slot).
- [ ] E2E (Jessica): Per `feedback_progression_e2e_mandatory` — `sub-to-20` is the next math focus node and shipping it touches no progression-state-machine files in this PR (no `mastery.ts` / `focusNode.ts` / `firstEncounterGate.ts` / `parentSettings.ts` changes if sub-to-20 isn't first-encounter-gated). **Verify with Matt at dispatch time whether an E2E spec is required.** If yes, Jessica authors `e2e/sub-to-20-composition.spec.ts` covering: (a) seeded `sub-to-20` focus node renders 8 problems from the 22-fact pool; (b) all problems are no-borrow; (c) at least one take-to-decade fact appears in P4-P8; (d) chip values for at least 2 of P4-P8 problems include `10` (the Class B trap).
- [ ] Self-test report on the PR per `feedback_self_test_report`: AC walkthrough + side-effect inventory.

### 6.9 Docs

- [ ] **`.claude/docs/skill-trees-and-content.md`** — append a "Math distractors — Class B (decade-anchor miss) for `sub-to-20`" subsection. Document the algorithm + scope (sub-to-20 only, P4–P8 only). Note that sub-to-10 keeps Class 2 (wrong-op); add-to-10 / add-to-20 remain unchanged.
- [ ] **`.claude/docs/progress-and-persistence.md`** — under "Mastery rule" or "Focus-node picker", extend the existing sub-to-10 footnote: "Promotion is accuracy-only for sub-to-10 → sub-to-20 as well; do NOT introduce a slow-fact-list-length gate (Dave's sub-to-20 research § 4.4 confirms the same fact-family-exposure rationale)."

---

## Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite.

- [ ] **AC1**: The 22-fact pool (§1.1) is faithfully encoded in `MATH_TRACK_GUIDE`'s `sub-to-20` block AND in `scripts/compositionLint.ts:SUB_TO_TWENTY_POOL` (vitest snapshot on the directive block; planner-test asserts pool membership; compositionLint drift-guard catches any mismatch).
- [ ] **AC2**: Every Haiku-generated `sub-to-20` plan composition rule from §4.1 holds: P1–P3 from `easy` band, ≥1 take-to-decade fact in P4–P8, no duplicates, no operand-triple `−`/`+` co-occurrence within the 8-problem set, category caps respected, EVERY problem satisfies `ones-digit(a) ≥ b` (no-borrow).
- [ ] **AC3**: Class B distractors fire correctly at render time: every P4–P8 op:'-' problem with `focusNode === 'sub-to-20'` attempts a Class B trap (`DEC = nearest multiple of 10`); the trap renders when in range, not aliasing correct, and not aliasing off-by-one; ALIAS / BOUNDARY / OOR cases silently downgrade to Class A (off-by-one). At least 2 of the 5 P4–P8 problems in any canon-baked session deliver Class B chips when the §4.1 DISTRACTOR-COVERAGE SELF-CHECK is honoured.
- [ ] **AC4**: All teen-number chip values render and play correctly. Emma says "Yes! Twelve!", "Yes! Fifteen!", etc. naturally on the cheerful celebration prosody. No SSML overrides required for any chip value in `[10, 19]`.
- [ ] **AC5**: Read-line parser accepts sub-to-20 read templates with teen minuends and tags problems with `op: '-'`; existing sub-to-10 and add-to-10 / add-to-20 templates continue to parse correctly.
- [ ] **AC6**: Advancement gate — `sub-to-10 → sub-to-20` fires on accuracy threshold alone, NOT influenced by slow-fact list length. Verified via existing mastery tests; no new gate added.
- [ ] **AC7**: Dual-exposure rule — within any single 8-problem session, no operand triple appears in both `+` and `-` forms. Vacuously true in v1 (pure-`−` sessions); covered by the planner test enumerating all 8 problems.
- [ ] **AC8**: Slow-fact directive remains DISABLED for `sub-to-20` in v1 (`isSlowFactsActive` predicate unchanged); the §5.4 op- AND tier-aware threshold lands in a follow-up PR.
- [ ] **AC9**: Canon JSON `public/canon/math/level-1/sub-to-20.json` baked and committed. Canon-lint passes (ASCII-7, no slash-IPA, no angle tags, composition rules satisfied). File parses via `isSessionStartResponse`.
- [ ] **AC10**: `distractorClass: 'decade-anchor'` type union widening lands in `MathProblem`, `PickDistractorsOpts`, and `distractors.ts` dispatch.

---

## 7. Open questions for Thomas

These are decision-stack items the spec cannot self-resolve. Orchestrator routes to Thomas.

### 7.1 `18-9=9` and the no-borrow definition — the strict-vs-loose interpretation question

**The tension.** Dave's research note has an internal contradiction that propagated into the ticket:

- Dave § 4.1 ("Pool boundary"): "ones-digit of the minuend is ≥ the subtrahend (no borrowing). Result ≥ 2." — the **strict procedural** no-borrow definition.
- Dave § 4.2 (HARD band): "minuend 17–19, subtrahend 5–9 (results 8–14)." — and Dave's NOF #4 explicitly names `18-9=9` as the highest-leverage HARD fact.

Under the strict procedural definition, `18-9=9` requires borrowing (`ones-digit(18) = 8 < 9`) and is FORBIDDEN. Under a looser definition (count-back-across-decade, "result ≥ 0"), `18-9=9` is allowed and is the canonical decade-crossing teaching target.

**What this spec does in the absence of a Thomas decision.** Honour the ticket's explicit instruction:

> "No-borrow only: minuend 11-19, subtrahend 1-9, ones-digit(min) ≥ sub, result ≥ 2"

Result: `18-9=9`, `17-8=9`, `15-7=8`, `13-5=8`, `19-9=10` (wait — `19-9=10` IS no-borrow since `ones(19)=9 ≥ 9` — included in pool as #21), and similar count-back-across-decade facts are FORBIDDEN under v1. The "highest-leverage no-borrow fact" honour goes to `19-9=10` instead (#21 in the pool).

**The decision Thomas must make.** Two options:

- **Option A (this spec's default, conservative):** Keep the strict procedural definition. Sub-to-20 v1 ships with the 22-fact no-borrow pool. The count-back-across-decade facts (`18-9=9`, `17-8=9`, etc.) belong in a v2 spec ("sub-to-20-with-bridge") that introduces the decade-crossing strategy explicitly as a new pedagogical layer. Aligns with Dave § 4.5 explicit out-of-scope ruling ("borrow facts. Out. The no-borrow constraint is a hard pedagogical line.").
- **Option B (re-open):** Widen the no-borrow definition to "count-back-across-decade allowed when result ≥ 0". Sub-to-20 v1 includes `18-9=9`, `17-8=9`, etc. as HARD-band facts. The pool grows from 22 to ~32. The Class B distractor formula is unaffected (still `Math.round(correct / 10) * 10`); the renderer auto-handles results in `[0, 9]` because `chipMaxAnswerForCorrects` would still return `ANSWER_RANGE_MAX_TO_20 = 20` (any correct ≥ 11 already widens, and the new facts have correct ∈ [0, 9] so the existing `ANSWER_RANGE_MAX = 10` ceiling applies — but mixing the two ceilings within one session needs careful thought; **flagging as the load-bearing risk of Option B**).

**Recommendation.** Option A. Strict-definition pool ships v1, with the explicit understanding that `18-9=9` and its cluster are the FIRST candidates for a v2 widening once the no-borrow tier is established. Dave's research note Section 4.5 explicitly out-of-scopes this; the v1 ship is consistent with that ruling. Re-open at v2 spec time.

### 7.2 `take away` framing — should sub-to-20 inherit sub-to-10's first-session variant?

Sub-to-10 ships with a first-session "take away" warmup that flips to "minus" on session 2+ (sub-to-10 §4.3 + §11 Q4, Thomas 2026-05-15). Sub-to-20 currently ships **without** the variant — sub-to-20 §4.3 defaults to "minus" from session 1.

**Pedagogical argument for variant.** Dave's sub-to-10 § Q2 rationale ("take away framing matches Marian's mental model from counting back; physical removal is the concrete mental anchor") arguably extends to sub-to-20 — the counting-back-from-teen-minuend strategy is identical in mental model, just with a longer count.

**Pedagogical argument against variant.** By the time Marian reaches sub-to-20, she has had ≥ N sub-to-10 sessions where session 1 was "take away" and sessions 2+ were "minus". She has now internalised the "minus" framing. Introducing a fresh first-session variant at sub-to-20 onset re-litigates the same cognitive-load tradeoff Dave Q2 flagged for sub-to-10 — but with weaker payoff (she already has the concrete-removal mental model anchored).

**Recommendation.** No variant for sub-to-20 v1. Re-open at v2 spec time if real-Marian iPad ear-test on the first sub-to-20 session reveals an issue.

### 7.3 Parallel `add-to-20` / `sub-to-20` sequencing — counterintuitive but McNeil-supported

Per Dave § 1.2 and McNeil et al. (2025): addition and subtraction in the same number range should be **parallel acquisition targets**, not sequential. Practically: Marian will advance to `sub-to-20` while `add-to-20` is still at `practicing`. The `MATH_TREE` puts them sequentially (add-to-20 → sub-to-10 → sub-to-20), but Dave's research says the interleaving is therapeutic for both operations.

**What this means for Thomas.** When Marian's progress hits "sub-to-10 mastered" she will advance to `sub-to-20` even though `add-to-20` is still `practicing`. Sub-to-20 sessions will produce fact-family benefit for add-to-20 retrieval via the inverse pathway. This is correct per the research but counterintuitive from a "finish one thing before moving to the next" perspective.

**Recommendation.** Surface this proactively at spec-merge time so Thomas is not surprised when Marian's iPad shows sub-to-20 problems while add-to-20 is still incomplete in the path-strip. If Thomas wants different sequencing (sub-to-20 gated on `add-to-20: mastered`), the `MATH_TREE` would need re-wiring — a progression-state-machine change requiring a paired failing-first E2E spec per `feedback_progression_e2e_mandatory`. **This spec does NOT propose that change**; it inherits the existing tree per sub-to-10 §11 Q1.

### 7.4 `maxAnswer` ceiling for sub-to-20 — 19 or 20?

The pool produces results in `[10, 18]`. The Class B trap `DEC = 10` is always in `[minAnswer, maxAnswer]`. For Class A (off-by-one), `correct + 1` at correct = 18 yields chip 19. So a chip of 19 is rendered. **Question:** is the implicit ceiling `maxAnswer = 19` (matching the pool's `correct + 1` boundary) or `maxAnswer = 20` (matching `ANSWER_RANGE_MAX_TO_20`)?

Today `chipMaxAnswerForCorrects` returns `ANSWER_RANGE_MAX_TO_20 = 20` for any correct ≥ 11 (`distractors.ts:107-110`). Sub-to-20 callers inherit `maxAnswer = 20`. Class A renders `correct + 1 = 19` chip at maximum; Class B renders `DEC = 10` chip. The 20-chip can render as a gentle-extreme but never as a Class A near-miss.

**Recommendation.** Inherit `ANSWER_RANGE_MAX_TO_20 = 20` from the existing widening predicate. No code change; just verify in §6.2 that the dispatch threads correctly. If Thomas wants a narrower sub-to-20-specific ceiling of `maxAnswer = 19` (so the 20-chip never appears), that's a tiny `chipMaxAnswerForCorrects` extension — flag in §8 follow-ups.

### 7.5 Slow-fact threshold confirmation — 7000 ms for sub-to-20 vs 6000 ms for sub-to-10?

Sub-to-10 ships with a flat 6000 ms threshold + 5-session warmup for `op === '-'` (sub-to-10 §11 Q2, Thomas 2026-05-15). §5.4 of this spec proposes 7000 ms + 5-session warmup for sub-to-20, on the rationale that teen-minuend count-backs run systematically slower (Geary et al. 2007).

**Question.** Confirm the 7000 ms threshold or push back to a different number (5000? 6500? unify with sub-to-10 at 6000?). Without empirical sub-to-20 latency data, the threshold is speculative. Calibrate once Marian has generated ≥10 sub-to-20 sessions and the latency profile is visible.

**Recommendation.** Lock 7000 ms tentatively. Retune in the slow-fact follow-up PR (deferred per §6.7). This is not blocking the content-tier ship.

---

## 8. Tracked follow-ups (post-merge)

What this spec implies for code (Kevin / Devon) and content (canon). PR split per §6: PR 1 = content + canon; PR 2 = render.

**PR 1 — content + canon (Kevin):**

- `api/_planner.ts:1022` — `MATH_TRACK_GUIDE` `sub-to-20` block expanded to 22-fact pool with annotations + DISTRACTOR-COVERAGE SELF-CHECK (per §4.1).
- `scripts/compositionLint.ts` — new `SUB_TO_TWENTY_POOL` + `SUB_TO_TWENTY_RULES`; new branch in `resolveTierBinding`.
- `scripts/compositionLint.test.ts` — fixtures for the new pool entries + rules.
- `public/canon/math/level-1/sub-to-20.json` — new canon, baked via `npm run canon:regen` per §6.5; ~1.2 MB; 59 utterances at 8 problems × 5 slots + 19 Session-End.
- `src/lib/progress/defaults.ts` — sanity-check `'sub-to-20'` is `'practicing'` (flip if `'mastered'`, mirroring sub-to-10 §9.6).
- `api/_planner.test.ts` — sub-to-20 plan composition tests (§6.3).

**PR 2 — render + types (Kevin):**

- `src/screens/Math/distractors.ts` — `PickDistractorsOpts.distractorClass` union widens to include `'decade-anchor'`; new `decadeAnchorDistractors` internal function; `pickDistractors` dispatch extended (§6.2).
- `src/screens/Math/distractors.test.ts` — Class B tests + ALIAS/BOUNDARY fallback tests.
- `src/screens/Math/sessionPlans.ts` — `MathProblem.distractorClass` union widens identically.
- `src/screens/Math/Math.tsx` — derive `distractorClass = 'decade-anchor'` for sub-to-20 P4–P8 problems; pass through.
- `src/screens/Math/planFromServer.ts` — verify `eleven`–`nineteen` `NUMBER_WORDS` entries; add fixtures for sub-to-20 read-lines (§6.1).

**Test changes:**

- PR 1: `_planner.test.ts` sub-to-20 plan composition tests; `compositionLint.test.ts` fixtures.
- PR 2: `planFromServer.test.ts` sub-to-20 parser fixtures; `distractors.test.ts` Class B + fallback tests.
- Cross-PR (Jessica E2E): `e2e/sub-to-20-composition.spec.ts` (only if §6.8 confirms requirement at dispatch).

**Doc changes:**

- `.claude/docs/skill-trees-and-content.md` — Class B subsection added (post-merge; `maintain-docs` may auto-route).
- `.claude/docs/progress-and-persistence.md` — promotion-gate footnote extended for sub-to-10 → sub-to-20.

**Out of both PRs' scope (follow-up):**

- `src/lib/progress/slowFacts.ts` — flat 7000 ms + 5-session warmup for `op === '-' && focusNode === 'sub-to-20'` (§5.4). `_planner.ts:isSlowFactsActive` widening to include `sub-to-20`. Lands after sub-to-10's slow-fact follow-up ships.
- `scripts/compositionLint.ts` — `class-b-coverage` lint rule asserting ≥2 of P4–P8 are CLEAN-annotated facts (§2.2 item 4).
- v2 spec: `sub-to-20-with-bridge` widening the no-borrow definition to allow count-back-across-decade facts (`18-9=9` cluster) per §7.1 Option B.
- `chipMaxAnswerForCorrects` extension to a sub-to-20-specific `maxAnswer = 19` if §7.4 re-opens.
- Subitising-scaffold extension to sub-to-20 EASY band per `subitising-scaffold-content.md` §7.2 (a separate sibling spec).

---

## 9. Cross-references

- **Dave's sub-to-20 research** — `design/research/sub-to-20-pedagogical-sequence.md` (canonical authority for this spec).
- **Dave's sub-to-10 research** — `design/research/sub-to-10-fact-sequencing-marian.md` (the precedent that established the gentle-ramp + dual-exposure + accuracy-only-advancement shape).
- **Dave's wrong-op-delivery research** — `design/research/canon-pool-wrong-op-delivery.md` + `canon-pool-wrong-op-delivery-followup-hard-general.md` (the structural-redundancy posture for distractor-class delivery, ratified for Class B coverage here).
- **Dave's speed-feedback research** — `design/research/speed-feedback-automaticity-marian.md` (verdict: no speed-feedback UI; slow-fact directive is a backend re-targeting tool).
- **Dave's distractor research** — `design/research/math-distractor-and-streak-decisions.md` (gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Precedent content spec** — `design/math/sub-to-10-content.md` (structural model; cloned section-for-section here).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md`.
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md`.
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md`.
- **Memory: planner-parser contract** — `project_planner_parser_contract.md` (widen parser BEFORE planner — sub-to-20 inherits the post-PR-#241 parser; no widening needed here).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (Jessica E2E spec required at dispatch time for any progression-state-machine PR; sub-to-20 v1 likely does NOT touch progression files — confirm at dispatch).
- **Memory: distractor class pedagogical gates mechanical** — `feedback_distractor_class_pedagogical_gates_mechanical` (the lens applied to Class B decision in §3.3).
- **Memory: Haiku directive sharpening** — `feedback_haiku_directive_sharpening` (validated patterns for inline-band-tagging + per-rule self-checks + negative anchors; applied throughout §4.1).
