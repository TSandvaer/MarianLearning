# Number Garden — `sub-to-10` content tier (22-fact pool, wrong-operation distractor, op-parameterized slow-fact threshold)

**Status:** APPROVED with all open questions locked (Thomas, 2026-05-15). **AMENDED 2026-05-16** to widen the fact pool from 16 to 20 in response to Dave's wrong-op-delivery research (`design/research/canon-pool-wrong-op-delivery.md`, PR #247). The amendment adds 4 MEDIUM-band facts (`8-1=7`, `7-1=6`, `8-2=6`, `6-2=4`) whose wrong-op traps (`a+b`) are IN-range (`≤ 10`); without them, no MEDIUM- or HARD-band fact in the original pool produced an in-range wrong-op trap, making the §2.2 "≥2 of P4-P8 carry wrong-op" rule structurally unsatisfiable. **FURTHER AMENDED 2026-05-16** (this PR) to widen the pool from 20 to 22 facts by adding 2 HARD/general facts (`7-3=4`, `6-4=2`, both trap=10 IN-range) per Dave's follow-up research (`design/research/canon-pool-wrong-op-delivery-followup-hard-general.md`, PR #250); this thickens the previously-thin "just-barely-achievable" P4-P8 in-range cushion to structural redundancy — wrong-op coverage is now sourceable from HARD/general alone (under the `general` cap of 2) OR from the HARD+MEDIUM combination. Also fixes Devon's §1.2 minuend-range NIT (`[6, 10]` → `[5, 10]`; `5-5=0` has minuend 5). See §13 post-ship correction block.
**Ticket:** TBD — Matt to file. This spec lands the design-side content for the FIRST subtraction tier in Number Garden. PR split locked at 2 (content + canon in PR 1; render + parser in PR 2).
**Authority:** `design/research/sub-to-10-fact-sequencing-marian.md` (Dave, 2026-05-15) — the curriculum-side authority on fact ordering, distractor design, dual-exposure rule, advancement gate, and op-specific slow-fact threshold. This spec consumes Dave's note verbatim where it makes a call and formalises it for Kevin's planner / canon / `distractors.ts` work.
**Predecessor research (read for context):** `design/research/math-distractor-and-streak-decisions.md` (Dave, 2026-04-25 — the gentle / off-by-one cutoff at problem 3); `design/research/add-to-10-counting-to-recall.md` (Dave, 2026-04-29 — Marian's finger-counting profile); `design/research/speed-feedback-automaticity-marian.md` (Dave, 2026-05-15 — verdict: NO speed-feedback UX; the slow-fact directive is a backend re-targeting tool, not a UI signal).
**Structural predecessor (precedent shape, cloned section-for-section):** `design/word-song/digraphs-th-word-list.md` (Kyle, 2026-05-14) — the most recently shipped content-tier spec. This is the first MATH content-tier spec; we mirror the word-song shape because Kevin already reads against it.

---

## 0. Why this spec, why now

- `sub-to-10` is the NEXT focus node on the Number Garden ladder after `add-to-10` (the only first-class math tier today). `MATH_TRACK_GUIDE` in [`api/_planner.ts`](../../api/_planner.ts) carries only a one-line skeleton for `sub-to-10`:
  ```
  - sub-to-10: subtraction with both operands and answer in 1-10. read: "<A> minus <B>. How many?" e.g. "Seven minus three. How many?"
  ```
  Haiku would hallucinate problems off this skeleton today. The planner needs a directive block on par with `add-to-10`'s (with fact-pool guidance, mix rules, and read-line template).
- Marian's April 2026 diagnostic: subtraction within 15 confident. She has the CONCEPT and a counting-back strategy. The gap is RETRIEVAL automaticity — the same gap as `add-to-10`. This tier exists to drill the retrieval pathway, NOT to teach the concept.
- Dave's research note (`sub-to-10-fact-sequencing-marian.md`) is the curriculum-side authority. This spec consumes it.
- **Dave's verdict on visual scaffolding** (`sub-to-10-fact-sequencing-marian.md` § Q2 / § Recommendations): **skip the CRA visual detour entirely.** The 4-chip recognition format IS the representational layer of CRA for a child with subtraction concept. Emma's read-aloud is the anchor. No ten-frame, no manipulatives, no number-line render. Net: this spec authors content for the existing Math chip-tap surface unchanged. No screen work; no UI primitives.
- **Dave's verdict on speed-feedback UX** (`speed-feedback-automaticity-marian.md`): NO speed-feedback UI. The slow-fact directive is a planner-side re-targeting tool. This spec formalises an op-specific threshold; the UI is not touched.

**Scope of this spec:**

- The 22-fact ordered pool (§1) with band + category + wrong-op trap status + per-fact teaching note (originally 16; widened to 20 on 2026-05-16 per Dave's `canon-pool-wrong-op-delivery.md` research, PR #247; further widened to 22 on 2026-05-16 per Dave's `canon-pool-wrong-op-delivery-followup-hard-general.md`, PR #250 — adds 2 HARD/general IN-range facts).
- The problem-mix rules for an 8-problem session drawn from the pool (§2).
- The two distractor classes for `sub-to-10`, including the NEW **wrong-operation distractor** (§3).
- The read-line template + per-slot utterance templates (§4).
- The schema posture — sub-to-10 reuses `MathFact { a, b, op: '-' }` with no new infrastructure (§5).
- The advancement gate (`add-to-20 → sub-to-10` promotion per the locked curriculum order) — accuracy-only per Dave (§6).
- The dual-exposure rule (never pair a `-` fact with its `+` inverse in the same session) (§7).
- The op-parameterized slow-fact threshold REQUEST for `slowFacts.ts` (§8).
- The wire-up checklist for Kevin (§9).
- The locked Thomas decisions on Q1 (curriculum order), Q2 (slow-fact threshold shape), Q3 (chip-range widening), Q4 (first-session framing) plus the locked PR split (§11).

**Out-of-scope:**

- **Implementation.** This spec hands off to Kevin (planner directive + canon bake + distractors extension + slowFacts parameterization).
- **`sub-to-20`** — a separate future tier, not specced here.
- **Speed-feedback UX** — killed by Dave's `speed-feedback-automaticity-marian.md`. No streak-fade-on-slow, no timer, no orange/yellow chip, no haptic.
- **CRA visual scaffolding** — Dave § Q2 ruled out (ten-frame, number-line, manipulative phase). The chip-tap is the representational layer.
- **Fact-family interleaving (mixed `+` and `-` in one session)** — Dave § Application supports it as a future direction (per McNeil et al. 2025) but the dual-exposure rule (§7) is the conservative posture for v1: do NOT pair a `-` problem and its `+` inverse in the same 8-problem session. A future spec can widen this once `sub-to-10` is established.
- **Major `Math.tsx` UI redesign.** Subtraction renders through the existing chip-tap pipeline; the screen is operation-agnostic. The PR-2 changes Kevin makes are argument plumbing (`op`, `distractorClass`, `minAnswer` through to `pickDistractors`) and the operator-glyph render (− vs + in the problem display); no layout, no new UI primitives, no new states.
- **Two-digit-numerals SSML.** The `[1, 10]` answer range stays within Azure's clean single-digit lexicon; no `<phoneme>` overrides needed.

---

## 1. The 22-fact pool — ordered, banded, categorised

The pool below is the union of facts Haiku may draw from for any `sub-to-10` session. The full single-digit subtraction surface with answers in `[0, 10]` contains 55 ordered pairs; the 22 below cover each difficulty band and conceptual category without redundancy (Dave § "Concrete fact ordering" + Dave's 2026-05-16 wrong-op-delivery research + Dave's 2026-05-16 HARD/general follow-up). **All 22 are pool-eligible; the per-session mix rules (§2) drive how Haiku composes the 8 problems.**

### 1.1 Pool table (LOCKED — Dave § "Concrete fact ordering", AMENDED 2026-05-16 per Dave § "Pool-widening candidates" in `canon-pool-wrong-op-delivery.md`; FURTHER AMENDED 2026-05-16 with 2 HARD/general additions per Dave's `canon-pool-wrong-op-delivery-followup-hard-general.md`)

| #   | Fact         | Band   | Category      | Wrong-op trap (a+b) | Teaching note (per-fact, where non-obvious)                                                                                                                                                                                                                         |
| --- | ------------ | ------ | ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `5 − 5 = 0`  | easy   | subtract-self | 10 (IN — boundary, but EASY-band → only P1-P3) | `n − n = 0` rule. No counting — rule-application only. Among the fastest retrievals; baseline confidence-builder.                                                                                                                                                   |
| 2   | `8 − 8 = 0`  | easy   | subtract-self | 16 (OOR)            | Repeats the rule with a larger `n`; confirms generality. Do NOT drill both subtract-self facts in the same session — one per session is sufficient (§2.3).                                                                                                          |
| 3   | `7 − 0 = 7`  | easy   | subtract-zero | 7 (alias of correct → forbidden for wrong-op; §3.2 same-value-collision rule) | `n − 0 = n` rule (identity). No counting; rule-application only.                                                                                                                                                                                                    |
| 4   | `9 − 0 = 9`  | easy   | subtract-zero | 9 (alias → forbidden) | Repeats the rule. Same one-per-session guidance as `subtract-self`.                                                                                                                                                                                                 |
| 5   | `10 − 5 = 5` | easy   | doubles       | 15 (OOR)            | Doubles halving. Highly memorable; Marian knows `5 + 5 = 10` from `add-to-10`. Single-step finger-count.                                                                                                                                                            |
| 6   | `8 − 4 = 4`  | easy   | doubles       | 12 (OOR)            | Doubles halving. Marian knows `4 + 4 = 8`.                                                                                                                                                                                                                          |
| 7   | `6 − 3 = 3`  | easy   | doubles       | 9 (IN — but EASY-band → only P1-P3) | Doubles halving. Marian knows `3 + 3 = 6`.                                                                                                                                                                                                                          |
| 8   | `9 − 1 = 8`  | easy   | subtract-one  | 10 (IN — boundary, EASY-band → only P1-P3) | Count back one step; same scaffold as `n + 1` in addition. Easiest non-rule fact.                                                                                                                                                                                   |
| 9   | `10 − 1 = 9` | medium | subtract-one  | 11 (OOR)            | Count back one step; bridges the decade (anchor for take-from-10).                                                                                                                                                                                                  |
| 10  | `8 − 1 = 7`  | medium | subtract-one  | **9 (IN)**          | **Added 2026-05-16 per Dave § "Pool-widening candidates" Candidate 1.** Count back one step; extends the subtract-one chain. Cleanest pedagogical signal among MEDIUM/HARD candidates: trap=9, correct=7, off-by-one secondary=8 → chips `{7, 8, 9}` (3-way separation, no collisions). Subtract-one is Marian's most reliable category (Robinson et al. 2013 — 65-73% identity-principle correct). |
| 11  | `7 − 1 = 6`  | medium | subtract-one  | **8 (IN)**          | **Added 2026-05-16 per Dave § "Pool-widening candidates" Candidate 4 (optional 4th).** Subtract-one variety; trap=8 differs from #10's trap=9 so cross-session repetition feels less identical. Note: subtract-one cap is still ≤1 per session (§2.3) — facts #8, #9, #10, #11 compete for one slot. |
| 12  | `10 − 2 = 8` | medium | subtract-two  | 12 (OOR)            | Count back two steps. Wrong-op lure (`10 + 2 = 12`) falls outside `[0, 10]`, so at render time the trap delivers via the off-by-one fallback (§3.2 "Out-of-range wrong-op fallback"). For an IN-range subtract-two alternative with the same wrong-op lure shape, see fact #13 (`8-2=6`, trap=10) and fact #14 (`6-2=4`, trap=8). |
| 13  | `8 − 2 = 6`  | medium | subtract-two  | **10 (IN — boundary)** | **Added 2026-05-16 per Dave § "Pool-widening candidates" Candidate 2.** Highest-salience wrong-op lure in the pool — trap=10 is the "makes ten" anchor Marian knows deeply from `add-to-10`. A child who adds instead of subtracts lands confidently on 10. Trap 4-apart from correct (6) → strong discriminate signal. |
| 14  | `6 − 2 = 4`  | medium | subtract-two  | **8 (IN)**          | **Added 2026-05-16 per Dave § "Pool-widening candidates" Candidate 3.** Subtract-two with lower minuend; useful when recent-score is mid-range and the take-from-10 slot is filled by #15 or #16. Trap 4-apart from correct → strong discriminate. Note: subtract-two cap is ≤1 per session (§2.3) — facts #12, #13, #14 compete for one slot. |
| 15  | `10 − 3 = 7` | medium | take-from-10  | 13 (OOR)            | Bridges through 10; highest-leverage facts. The make-10 mental model `add-to-20` will later depend on lives here.                                                                                                                                                   |
| 16  | `10 − 7 = 3` | medium | take-from-10  | 17 (OOR)            | Inverse of `7 + 3 = 10`. Expose deliberately to build the fact-family link — but **NEVER in the same session as `7 + 3 = 10`** (§7 dual-exposure rule).                                                                                                             |
| 17  | `9 − 4 = 5`  | hard   | general       | 13 (OOR)            | No obvious shortcut; count-back or derive from `10 − 5`. Where retrieval gains will appear last.                                                                                                                                                                    |
| 18  | `8 − 3 = 5`  | hard   | general       | 11 (OOR)            | No obvious shortcut; count-back. Wrong-op lure `11` is out of range (`maxAnswer=10`) → fall back to off-by-one (§3.2).                                                                                                                                              |
| 19  | `7 − 4 = 3`  | hard   | general       | 11 (OOR)            | Often confused with `7 − 3 = 4` (the Robinson-2013 wrong-direction-of-compensation error). The off-by-one distractor is load-bearing here.                                                                                                                          |
| 20  | `9 − 6 = 3`  | hard   | general       | 15 (OOR)            | Hardest in the pool. Subtrahend is large, not a clean anchor. Final-band fact.                                                                                                                                                                                      |
| 21  | `7 − 3 = 4`  | hard   | general       | **10 (IN — boundary)** | **Added 2026-05-16 per Dave's HARD/general follow-up paper (`canon-pool-wrong-op-delivery-followup-hard-general.md`).** Same cognitive load as #18 `8-3=5` (b=3, no doubles-halving anchor; Baroody 2006 general tier). Trap=10 is the strongest "makes-ten" wrong-op lure in the pool — Marian's deepest add-to-10 anchor. Correct (4) vs trap (10) separated by 6. Robinson-2013 wrong-direction-of-compensation error named here specifically. |
| 22  | `6 − 4 = 2`  | hard   | general       | **10 (IN — boundary)** | **Added 2026-05-16 per Dave's HARD/general follow-up paper.** Same cognitive load as #19 `7-4=3` (subtrahend b=4, count-back from low minuend, no anchor). Trap=10 again — correct (2) vs trap (10) separated by 8, the widest discriminate signal in the pool. **Subtrahend-repeat caution:** shares b=4 with #19; Haiku may pick both under the `general` cap of 2 — acceptable but produces a session with two b=4 facts (mild monotony, manageable). |

**Band counts (post-amendment):**

- `easy` — 8 facts (#1–8): subtract-self ×2, subtract-zero ×2, doubles ×3, subtract-one ×1.
- `medium` — 8 facts (#9–16): subtract-one ×3, subtract-two ×3, take-from-10 ×2.
- `hard` — 6 facts (#17–22): general ×6.

**Category counts:** subtract-self ×2 · subtract-zero ×2 · doubles ×3 · subtract-one ×4 · subtract-two ×3 · take-from-10 ×2 · general ×6. **Total: 22 facts.**

**In-range wrong-op (a+b ≤ 10) availability per band (this is what makes §2.2's ≥2/5 rule structurally redundant post-2026-05-16 HARD/general amendment):**

- EASY: 3 facts with usable in-range traps (#1 `5-5` boundary, #7 `6-3`, #8 `9-1` boundary) — but EASY band is restricted to P1-P3 (no traps fire there per §2.1). **Effective contribution to P4-P8 wrong-op delivery: 0.**
- MEDIUM: 4 facts with usable in-range traps (#10 `8-1=7` trap=9, #11 `7-1=6` trap=8, #13 `8-2=6` trap=10, #14 `6-2=4` trap=8).
- HARD: 2 facts with usable in-range traps (#21 `7-3=4` trap=10, #22 `6-4=2` trap=10). **NEW post-2026-05-16 HARD/general amendment.** Both carry the highest-salience "makes-ten" lure. No competing category caps within HARD/general beyond the `general` cap of 2 (§2.3); both can co-occur in P4-P8 in a single session.

**Selection-cap interaction (post-2026-05-16 HARD/general amendment).** Of the 4 MEDIUM in-range facts, only 2 can co-occur in a single session under category caps (≤1 subtract-one across #10/#11; ≤1 subtract-two across #13/#14). Of the 2 HARD/general in-range facts, both can co-occur (subject only to the `general` cap of 2). The §2.2 ≥2/5 wrong-op-in-P4-P8 rule is therefore **structurally redundant** — achievable from HARD/general alone (#21 + #22 fill the `general` cap and deliver 2 in-range traps), OR from HARD+MEDIUM combo (e.g. #21 + #10), OR from MEDIUM alone (#10/#11 + #13/#14). The maximum achievable in-range count in P4-P8 is now 4 (1 subtract-one IN + 1 subtract-two IN + 2 general IN), up from 2 pre-HARD-amendment. See §4.1 "DISTRACTOR-COVERAGE SELF-CHECK" for the directive that biases this selection.

### 1.2 Pool-composition cross-check

- **Answer range**: `[0, 9]`. Two facts (#1, #2) have `correct = 0`; the rest `correct ∈ [2, 9]` (post-HARD/general amendment — #22 `6-4=2` introduces correct=2 alongside the existing #3 `7-0=7`, etc.). **`correct = 0` is a NEW value in the math chip range** — `add-to-10` never produced `0` as a correct answer. Kevin's wire-up must confirm `ANSWER_RANGE_MIN = 1` in [`distractors.ts`](../../src/screens/Math/distractors.ts) is widened to `0` for `op === '-'` problems, OR the two subtract-self facts (#1, #2) are excluded from any session where the chip range can't be widened. See §3.3 + §9.
- **Minuend range**: `[5, 10]`. The most common minuend is `10` (#5, #9, #12, #15, #16 — five facts), reflecting the take-from-10 emphasis Dave calls out. Minimum minuend is `5` (#1 `5 − 5 = 0`). The 2026-05-16 MEDIUM amendment added minuends 6, 7, 8 (existing in EASY band already) into the MEDIUM band; the 2026-05-16 HARD/general amendment adds minuends 6, 7 into the HARD band (#21 `7-3=4`, #22 `6-4=2`).
- **Subtrahend range**: `[0, 8]`.
- **`MathFact` representation**: every pool fact maps cleanly to `{ a: minuend, b: subtrahend, op: '-' }` — see §5.

### 1.3 Why these 22, not more

The 55-fact full surface contains many redundant facts (e.g. `5 − 1 = 4`, `4 − 1 = 3`, `3 − 1 = 2` all exemplify the subtract-one category without adding pedagogical signal beyond what `8 − 1 = 7` already provides). The 22-fact pool covers every difficulty band and category at a depth that supports Leitner box-aware re-targeting once latency + accuracy data accumulates.

The 2026-05-16 MEDIUM amendment grew the pool from 16 to 20 to fix a structural defect in the original 16: every MEDIUM- and HARD-band fact had `a + b ≥ 11`, making the wrong-op trap (`a + b`) out-of-range and forcing every P4-P8 wrong-op attempt to silently downgrade to off-by-one at render time (per §3.2). The four added facts (`8-1=7`, `7-1=6`, `8-2=6`, `6-2=4`) are the smallest set of MEDIUM-band candidates that delivers in-range wrong-op traps under the §2.3 category caps; see Dave's `canon-pool-wrong-op-delivery.md` § "Recommendation" for the full evidence chain.

The 2026-05-16 HARD/general follow-up amendment grew the pool from 20 to 22 to close the wrong-op-coverage cushion that the MEDIUM-only amendment left thin. Per Dave's follow-up paper `design/research/canon-pool-wrong-op-delivery-followup-hard-general.md` (PR #250), the five flagged HARD/general candidates with `a + b ≤ 10` were audited against Baroody's three-tier difficulty framework. Two ADOPTED to HARD/general — `7-3=4` (trap=10) and `6-4=2` (trap=10) — both carry the strongest "makes-ten" wrong-op lure and same cognitive load signature as the existing HARD facts #18 `8-3=5` and #19 `7-4=3`. Three REJECTED — `5-3=2` (bridgeable via think-addition, trap=8 weaker), `4-3=1` (near-trivially easy for HARD band, trap=7 not salient), `5-4=1` (near-zero difficulty profile, not retrieval-hard). Net effect: HARD/general grows from 4 to 6 facts; the `general` cap of 2 per session is unchanged, so per-session problem counts are unaffected; the trap=10 sub-cluster (`8-3`, `7-3`, `7-4`, `6-4`) is now structurally coherent.

Pool extensions beyond 22 are deferred:

- **More `general`-band facts** (Dave's original Section 12 risk note) — Marian-data-driven extension once she generates ≥10 `sub-to-10` sessions.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 22-fact pool above (post-2026-05-16 MEDIUM + HARD/general amendments; was 16 pre-amendment, 20 post-MEDIUM-amendment). The mix obeys the warm-up + automaticity-targeting pattern established by `add-to-10` and tightened by Dave's research for `sub-to-10`.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source             | Distractor class (§3)                          | Why                                                                                                                                                                                                                            |
| ------------- | ------------ | ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1            | gentle       | `easy` band only        | Class 0 — gentle (≥2 away, range extremes)     | Session opener. Dave § Application: "problems 1–3 should use well-spaced distractors regardless of how easy the fact itself is, to allow context calibration before tight discriminations begin." Same posture as `add-to-10`. |
| P2            | gentle       | `easy` band only        | Class 0 — gentle                               | Calibration continues.                                                                                                                                                                                                         |
| P3            | gentle       | `easy` band only        | Class 0 — gentle                               | Marian has had 3 successful experiences before the trap distractors arrive — preserves the post-Dave `GENTLE_RAMP_THROUGH = 3` cutoff exactly.                                                                                 |
| P4            | discriminate | `medium` or `hard` band | Class 1 — off-by-one **OR** Class 2 — wrong-op | First diagnostic problem. Distractor class chosen randomly between Class 1 and Class 2.                                                                                                                                        |
| P5            | discriminate | `medium` or `hard` band | Class 1 or Class 2                             | "                                                                                                                                                                                                                              |
| P6            | discriminate | `medium` or `hard` band | Class 1 or Class 2                             | "                                                                                                                                                                                                                              |
| P7            | discriminate | `medium` or `hard` band | Class 1 or Class 2                             | "                                                                                                                                                                                                                              |
| P8            | discriminate | `medium` or `hard` band | Class 1 or Class 2                             | Closer; full discriminative pressure.                                                                                                                                                                                          |

### 2.2 Discriminate-tier distractor mix (P4–P8)

Of the 5 discriminate problems (P4–P8), **at least 2 MUST carry the wrong-operation distractor** (Class 2 — §3.2). The remaining 3 may use Class 1 (off-by-one) OR Class 2. Rationale: Dave § Q4 / Recommendations names the wrong-operation lure as the higher-leverage trap for `sub-to-10`; without an explicit minimum, the renderer would treat every P4-P8 op:'-' problem as a wrong-op attempt but silently downgrade most/all to off-by-one when traps fall out-of-range.

**Enforcement is render-side, NOT Haiku-emitted** (per §13 post-ship correction, 2026-05-16). The wire shape is utterance-only (per `planner-and-canon.md` § "Wire shape is utterance-only — invariant"); Haiku cannot tag per-problem `distractorClass` on the wire. Instead:

1. **Pool-side responsibility (this spec):** the 22-fact pool MUST contain enough MEDIUM- and HARD-band facts with in-range wrong-op traps (`a + b ≤ 10`, `a + b ≠ c`) that, given the §2.3 category caps and Haiku's P4-P8 selection, at least 2 in-range facts can land at P4-P8 in every session. **Achieved with structural redundancy by the 2026-05-16 amendments (MEDIUM + HARD/general)** — the target is reachable from HARD/general alone (#21 `7-3=4` + #22 `6-4=2` together exhaust the `general` cap of 2 and deliver 2 in-range traps) OR from HARD+MEDIUM combo OR from MEDIUM alone (#10/#11 + #13/#14); see §1.1 "In-range wrong-op availability per band" + "Selection-cap interaction."
2. **Directive-side responsibility (Kevin's `_planner.ts` block, §4.1):** the FACT POOL is annotated with each fact's `a+b` value and IN/OOR status; the directive includes a `DISTRACTOR-COVERAGE SELF-CHECK` that biases Haiku toward picking ≥2 in-range MEDIUM facts when filling P4-P8. This is a soft prophylactic, not a hard guarantee (per `planner-and-canon.md` § "Why the self-check blocks aren't enough on their own").
3. **Render-side responsibility (`distractors.ts`, §3.2):** every P4-P8 op:'-' problem attempts a wrong-op trap; the trap silently downgrades to off-by-one when OOR or aliasing the correct answer. The "≥2 of 5" target is met by the pool+directive in tandem; the renderer applies the trap mechanically per problem.
4. **Future lint-side reinforcement (Kevin's `compositionLint.ts`, follow-up):** a new lint rule `wrong-op-coverage` MAY be added to `SUB_TO_TEN_RULES` that asserts ≥2 of P4-P8 carry IN-range wrong-op-capable facts (i.e. fact `(a, b)` with `a + b ≤ 10` and `a + b ≠ a - b`). This would mechanically reject bakes that miss the target. **Out of scope for the immediate pool-widening PR; flagged for Kevin's follow-up.**

The previous wording ("Haiku is asked to TAG each P4–P8 problem with a `distractorClass: 'off-by-one' | 'wrong-op'` hint") is **superseded** by the §13 post-ship correction. The `MathProblem.distractorClass` field is kept as a forward-compat seam only.

### 2.3 Band coverage rules

- **At least one `easy`-band fact MUST appear in P1–P3** (gentle ramp); always true by §2.1 because problems 1–3 draw exclusively from the `easy` band.
- **At least one `take-from-10` fact (category #11–12) MUST appear in P4–P8.** Highest-leverage facts; Marian's future `add-to-20` make-10 mental model depends on them (Dave § "Haiku session design rules" #2).
- **No more than ONE fact per category in a single session.** Avoids 3-doubles-in-a-row monotony. Practically: at most one subtract-self, one subtract-zero, one doubles, one subtract-one, one subtract-two, two take-from-10 (the category is small and high-value — relaxed cap), and up to two `general`.
- **The dual-exposure rule (§7) applies** — never pair a `-` fact with its `+` inverse in the same session.
- **No duplicates within an 8-problem set** (same as `add-to-10`).

### 2.4 Recent-score modulation

The user message ships a `recentSuccessRate` for the focus node (§"Progress hint piping" in `architecture-overview.md`). The directive (§4) instructs Haiku to use this hint as in `add-to-10`:

- Low score (`< 0.5`) → favour `easy` band for the discriminate problems (substitute `easy` band facts for what would otherwise be `medium`/`hard`).
- High score (`≥ 0.85`) → push into `hard` band for the discriminate problems.
- Mid score or no data → balanced mix (default §2.1 distribution).

### 2.5 Leitner directive (forward-looking)

`sub-to-10` is **NOT** Leitner-active in v1. The Leitner gate in `_planner.ts:buildUserMessage` and `_planner.ts:isLeitnerActive` is currently scoped `track === 'math' && focusNode === 'add-to-10'`. A future Leitner widening to `sub-to-10` can use the same machinery (boxes 1–5, same prompt format). **Out of scope for this spec.** Kevin's wire-up checklist (§9) flags the gate scope as a TODO once the pool has accumulated 5+ sessions of latency + accuracy data.

### 2.6 Slow-fact directive (forward-looking, op-parameterized)

`sub-to-10` is **NOT** slow-fact-active in v1 (`buildSlowFactSessionHint` scope is `add-to-10` only). When it widens, the threshold for `op === '-'` MUST be calibrated separately from `op === '+'` — see §8. Kevin's wire-up checklist (§9) flags this.

---

## 3. Distractor design — three classes (gentle + off-by-one + NEW wrong-operation)

`sub-to-10` reuses the existing `pickDistractors(correct, problemIndex, maxAnswer)` API in [`src/screens/Math/distractors.ts`](../../src/screens/Math/distractors.ts) but EXTENDS it with a new third distractor class. The cutoff and gentle behaviour stay locked from Dave's 2026-04-25 consult.

### 3.1 Class 0 — gentle (P1–P3) — unchanged from `add-to-10`

Algorithm: two distractor values, each ≥2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in [`distractors.ts:gentleDistractors`](../../src/screens/Math/distractors.ts). **No code change for `sub-to-10`** — same algorithm fires on `op === '-'` problems for `problemIndex ∈ {1, 2, 3}`.

**One range adjustment** — see §3.3: `gentleDistractors` may need `ANSWER_RANGE_MIN = 0` for `op === '-'` sessions if pool facts #1 / #2 (correct = 0) are ever drawn. Kevin's call.

### 3.2 Class 2 — wrong-operation distractor — NEW for `sub-to-10`

**Definition.** For a subtraction problem `a − b = c`, the wrong-operation distractor is `a + b` (the addition answer using the same operand pair). It targets the cognitive error Dave names as "applying the wrong operation" — the most impactful real-world confusion for subtraction (Dave § Q4: "the more impactful distractor to add is the **wrong-operation distractor**").

**Worked examples (post-2026-05-16 amendments — MEDIUM + HARD/general, drawn from the 22-fact pool §1.1):**

- `10 − 2 = 8` (#12), wrong-op distractor = `10 + 2 = 12`. **12 is out of range** (`maxAnswer = 10`). See "Out-of-range wrong-op fallback" below — renders as off-by-one `{7, 8, 9}` or `{6, 7, 8}`.
- `8 − 1 = 7` (#10, AMENDED-IN), wrong-op distractor = `9`. In range. Off-by-one secondary = `8` (correct + 1). Chips `{7, 8, 9}` — clean 3-way separation.
- `8 − 2 = 6` (#13, AMENDED-IN), wrong-op distractor = `10`. In range — boundary value. Off-by-one secondary = `5` or `7`. Chips `{5, 6, 10}` or `{6, 7, 10}` — the "makes ten" lure is the highest-salience trap in the pool.
- `6 − 2 = 4` (#14, AMENDED-IN), wrong-op distractor = `8`. In range. Off-by-one secondary = `3` or `5`. Chips `{3, 4, 8}` or `{4, 5, 8}` — trap is 4-apart from correct.
- `7 − 1 = 6` (#11, AMENDED-IN, optional 4th), wrong-op distractor = `8`. In range. Off-by-one secondary = `5` or `7`. Chips `{5, 6, 8}` or `{6, 7, 8}` — clean.
- `9 − 1 = 8` (#8, EASY band — fires only at P1-P3 where wrong-op is NEVER applied per §2.1; included for completeness, NOT a P4-P8 contributor).
- `6 − 3 = 3` (#7, EASY band — same caveat).

**Scope.** Class 2 is conditional on `op === '-' && problemIndex >= 4`. Never fires for P1–P3 (gentle ramp). Never fires for `op === '+'` (addition has no equivalent meaningful "wrong-operation" lure within the `[1, 10]` range — the inverse would be `a − b`, often negative; see §3.6).

**Combined-pair shape (Class 2 plus a second distractor).**

For a Class-2 problem, the two distractors are:

| Slot      | Value                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Trap      | `a + b` (the wrong-operation lure)                                                                                         |
| Secondary | The off-by-one near-miss (`c - 1` if in range, else `c + 1` if in range — `pickDistractors`'s off-by-one fallback applies) |

**Out-of-range wrong-op fallback.** If `a + b > maxAnswer` (e.g. `10 − 2 = 8` → wrong-op `12` out of range when `maxAnswer = 10`), fall back to a second off-by-one distractor. So `10 − 2 = 8` renders chips `{6, 8, 9}` (correct `8`, off-by-ones `7` and `9`, but `7` is in range so the fallback is the same `{7, 9}` off-by-one pair). Concretely: when wrong-op is OOR, the problem renders identically to a Class-1 off-by-one problem. **Haiku's distractorClass hint is then misleading** — `distractors.ts` must check range-fitness FIRST and silently downgrade to Class 1.

**Alias-collision check.** If the wrong-op value coincides with the off-by-one value (e.g. `correct + 1 === a + b`), the wrong-op pair degenerates to a single distinct distractor. Walk further on the off-by-one side: substitute `c - 2` (next-nearest in-range). Pool inspection: this collision never occurs for any pool fact in §1 because `a + b - c = 2 * b`, and for the pool no fact has `b = 0` (subtract-zero has `a + b = a` and `c = a`, so the collision is `correct === wrong-op` — see next paragraph for that case).

**Same-value collision (wrong-op aliases correct itself).** Only the subtract-zero facts (#3 `7 − 0 = 7`, #4 `9 − 0 = 9`) trigger this: wrong-op `7 + 0 = 7` equals correct `7`. In this case, Class 2 is **forbidden** for the problem — Haiku is instructed to use Class 1 (off-by-one) for subtract-zero facts. The two distractors degenerate to `{c-1, c+1}` clamped. **Already handled by the §2.3 rule "no subtract-zero in P4–P8 if a Class-2 distractor is forced"** — see directive in §4.2.

### 3.3 Answer range — widening `ANSWER_RANGE_MIN` to support `correct = 0`

Two pool facts produce `correct = 0`: #1 (`5 − 5`) and #2 (`8 − 8`). Today `ANSWER_RANGE_MIN = 1` in [`distractors.ts:58`](../../src/screens/Math/distractors.ts#L58). Kevin's wire-up has two options:

| Option | Behaviour                                                                                                              | Trade-off                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A      | Widen `ANSWER_RANGE_MIN` to `0` for `op === '-'` problems only (operation-parameterized minimum, mirrors `maxAnswer`). | Cleanest. Subtract-self / subtract-zero facts work end-to-end. `0` becomes a valid chip value.                        |
| B      | Keep `ANSWER_RANGE_MIN = 1`; exclude pool facts #1, #2 from any session that needs distractor generation.              | Easier code change but Dave's pool is incomplete. Removes the rule-based identity facts that anchor the easiest band. |

**Spec recommendation: Option A.** The rule-based identity facts (`n − n = 0`, `n − 0 = n`) are pedagogically high-value (Dave § Source 3 — Robinson 2013: Identity principle is the easiest derived-fact strategy, used correctly by 65–73% of children). Removing them drops the easiest band from 8 facts to 6 and forfeits the highest-confidence opener facts in the pool.

**Concrete change.** Add an optional parameter `minAnswer: number` to `pickDistractors`, default `ANSWER_RANGE_MIN`. For `op === '-'` callers, pass `0`. `gentleDistractors` and `offByOneDistractors` honour the new lower bound. Tests pin both bounds.

### 3.4 Distractor-class field — render-side ONLY (post-2026-05-16 correction)

**Historical context (pre-2026-05-16):** the original spec claimed Haiku would emit `distractorClass` per discriminate problem on the wire. **SUPERSEDED** — per `planner-and-canon.md` § "Wire shape is utterance-only — invariant", the `PlannerPlan` wire shape is utterance-only and cannot carry per-problem structured tags. Haiku emissions of `distractorClass` are silently discarded by the canon adapter and parsers.

**Current behaviour:** the `distractorClass` field on `MathProblem` is render-derived, not planner-emitted. `Math.tsx:2559-2560` sets `distractorClass: 'wrong-op'` for every op:'-' P4-P8 problem deterministically; `pickDistractors` then silently downgrades to off-by-one when the trap is OOR or aliases the correct answer (§3.2). The field is kept on the shape as a forward-compat seam in case a future wire widening (typed extension to `PlannerPlan` per `planner-and-canon.md`) ever enables planner emission. Wire shape:

```ts
// MathProblem (browser shape). `op` is required and sourced from the read template parse;
// `distractorClass` is RENDER-DERIVED, not parsed from the wire, and is present only on P4-P8
// op:'-' problems in the runtime React state after Math.tsx sets it.
interface MathProblem {
  index: number
  addendA: number // minuend when op === '-'
  addendB: number // subtrahend when op === '-'
  op: '+' | '-' // REQUIRED on every math problem; sourced from read template ("plus" vs "minus"/"take away")
  correct: number
  distractorClass?: 'off-by-one' | 'wrong-op' // RENDER-DERIVED — set by Math.tsx, never by planner
  utterances: MathProblemUtterances
}
```

The flat wire `read` text disambiguates op (`"… minus …"` / `"… take away …"` vs `"… plus …"`); the `planFromServer.ts` adapter widens its regex branch (see §9 "Parser widening"). `op` is the ONLY new field actually crossing the wire; `distractorClass` does not.

### 3.6 Class 2 is sub-tier-only — `add-to-10` is explicitly UNCHANGED

For symmetry, consider: `3 + 5 = 8`, wrong-op = `3 − 5 = -2`. Negative numbers are out of any chip range. Even if the absolute value (`2`) is used, it lacks the pedagogical hook (no shared error pattern in addition-direction confusion at this age, per Dave § Q4). Class 2 is `sub-to-10`-and-future-sub-tiers only. **`add-to-10` continues to use Classes 0 and 1 only — no code change for `add-to-10`.**

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `sub-to-10` block

Replace the one-line skeleton in [`api/_planner.ts:920`](../../api/_planner.ts#L920) with the directive block below. The block follows the same shape as `add-to-10`'s expanded directive ("Prefer bridge-through-5..." etc.) plus the sub-tier-specific guidance.

### 4.1 Block text (literal — Kevin's copy)

> ```
> - sub-to-10: subtraction with both operands in [0, 10] and answer in [0, 10]. read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seven minus three. How many are left?"
>
>   FIRST-SESSION READ-LINE — on the very first session on this node (lifetimeFirstEncounters['sub-to-10'] not yet set), use the warmer phrasing: "<minuend> take away <subtrahend>. How many are left?" e.g. "Eight take away three. How many are left?" This frames subtraction as physical removal, which matches Marian's mental model from counting back. Subsequent sessions revert to the "minus" template. Emma's voice config is unchanged — the SSML and prosody pipeline does not change for this tier.
>
>   FACT POOL (22 facts; pick exactly 8 distinct facts from this pool per session, no duplicates):
>   Each fact is annotated with [BAND/category] and (a+b) = the wrong-op trap value used at render time. IN means the trap is ≤ 10 (a usable in-range wrong-op distractor); OOR means the trap is > 10 (silently downgrades to off-by-one at render time per design/math/sub-to-10-content.md §3.2); ALIAS means the trap aliases the correct answer (forbidden, downgrades).
>   - Easy band — rule-application / single-step (P1-P3 only, no wrong-op fires here):
>     · 5-5=0   [EASY/subtract-self]   (a+b=10 IN — boundary)
>     · 8-8=0   [EASY/subtract-self]   (a+b=16 OOR)
>     · 7-0=7   [EASY/subtract-zero]   (a+b=7 ALIAS — forbidden)
>     · 9-0=9   [EASY/subtract-zero]   (a+b=9 ALIAS — forbidden)
>     · 10-5=5  [EASY/doubles]         (a+b=15 OOR)
>     · 8-4=4   [EASY/doubles]         (a+b=12 OOR)
>     · 6-3=3   [EASY/doubles]         (a+b=9 IN)
>     · 9-1=8   [EASY/subtract-one]    (a+b=10 IN — boundary)
>   - Medium band — counting back / bridges (P4-P8 eligible):
>     · 10-1=9  [MEDIUM/subtract-one]  (a+b=11 OOR)
>     · 8-1=7   [MEDIUM/subtract-one]  (a+b=9 IN)   ← AMENDED 2026-05-16 (Dave wrong-op research)
>     · 7-1=6   [MEDIUM/subtract-one]  (a+b=8 IN)   ← AMENDED 2026-05-16 (Dave wrong-op research)
>     · 10-2=8  [MEDIUM/subtract-two]  (a+b=12 OOR)
>     · 8-2=6   [MEDIUM/subtract-two]  (a+b=10 IN — boundary, strongest "makes ten" lure) ← AMENDED 2026-05-16
>     · 6-2=4   [MEDIUM/subtract-two]  (a+b=8 IN)   ← AMENDED 2026-05-16 (Dave wrong-op research)
>     · 10-3=7  [MEDIUM/take-from-10]  (a+b=13 OOR)
>     · 10-7=3  [MEDIUM/take-from-10]  (a+b=17 OOR)
>   - Hard band — general (P5-P8 eligible; mixed IN/OOR — two facts deliver in-range wrong-op traps):
>     · 9-4=5   [HARD/general]         (a+b=13 OOR)
>     · 8-3=5   [HARD/general]         (a+b=11 OOR)
>     · 7-4=3   [HARD/general]         (a+b=11 OOR)
>     · 9-6=3   [HARD/general]         (a+b=15 OOR)
>     · 7-3=4   [HARD/general]         (a+b=10 IN — boundary, strongest "makes ten" lure) ← AMENDED 2026-05-16 (Dave HARD/general follow-up)
>     · 6-4=2   [HARD/general]         (a+b=10 IN — boundary, widest correct-vs-trap separation in pool) ← AMENDED 2026-05-16 (Dave HARD/general follow-up)
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window; no traps yet.
>   2. Problems 4-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) → bias toward medium; high score (>= 0.85) → bias toward hard; mid score → balanced.
>   3. At least one take-from-10 fact (10-3 or 10-7) MUST appear somewhere in problems 4-8.
>   4. DUAL-EXPOSURE RULE: never pair a subtraction fact and its addition inverse in the same session. E.g. if 10-7=3 is included, 7+3=10 (or 3+7=10) is FORBIDDEN. This rule is forward-compatible — when Marian later moves to mixed add+sub sessions, this rule remains in force per Dave's research on inverse-principle interference.
>   5. NO duplicate facts within the 8-problem set.
>   6. Category cap: at most one each of subtract-self, subtract-zero, doubles, subtract-one, subtract-two; at most two of take-from-10; at most two of general.
>
>   DISTRACTOR-COVERAGE SELF-CHECK (for problems 4-8 — replaces the prior DISTRACTOR-CLASS HINT block, which assumed Haiku could tag per-problem distractorClass on the wire; per planner-and-canon.md § "Wire shape is utterance-only — invariant" the wire is utterance-only, so distractor selection is render-side per design/math/sub-to-10-content.md §3.2):
>   The render pipeline (src/screens/Math/Math.tsx) attempts a wrong-op trap (a+b) on every op:'-' P4-P8 problem and silently downgrades to off-by-one when the trap is OOR or aliases the correct answer. To deliver ≥2 in-range wrong-op traps across P4-P8 (Kyle's spec target), bias the P4-P8 selection toward facts annotated "IN" above. IN-annotated MEDIUM facts: 8-1, 7-1, 8-2, 6-2 (any one subtract-one and any one subtract-two — category caps still binding). IN-annotated HARD/general facts: 7-3, 6-4 (the `general` cap of 2 lets BOTH co-occur in one session). NEGATIVE ANCHOR: it is FORBIDDEN to fill P4-P8 entirely with OOR facts when ≥2 IN-annotated facts (from any band combination) are still available; before finalising the 5-problem P4-P8 set, count the IN-annotated facts in the set and if it is < 2 AND ≥ 2 IN-annotated facts are still available within category caps, SWAP one OOR fact for an IN-annotated one. Category caps are still binding: if you pick 8-1=7 (subtract-one IN), you may not also pick 10-1=9 or 7-1=6; if you pick 8-2=6 or 6-2=4 (subtract-two IN), you may not also pick 10-2=8. The maximum achievable IN-count in P4-P8 is 4 — one MEDIUM/subtract-one IN-fact, one MEDIUM/subtract-two IN-fact, AND both HARD/general IN-facts (7-3 + 6-4). The ≥2 target is structurally achievable from HARD/general alone (7-3 + 6-4) under the `general` cap, so even MEDIUM-light high-recent-score sessions meet the target. Aim for ≥2 IN; do not artificially cap at 2 if more IN-facts fit within category caps and other rules.
>
>   PROSODY: numbers are spelled out as words ("zero", "one", "two", ... "ten"). Capitalize the first word of each sentence. The "minus" / "take away" template renders cleanly on `en-US-EmmaMultilingualNeural` rate -10%; no SSML overrides required for any value in [0, 10].
> ```

### 4.2 Per-slot utterance templates

The 5-slot per-problem utterance shape is unchanged from `add-to-10` (`read`, `correct`, `reprompt`, `hint`, `giveAnswer`). Slot-by-slot:

| Slot         | Template                                                                                                                                 | Example for `10 − 2 = 8`                    | Notes                                                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`       | `"<minuend> minus <subtrahend>. How many are left?"` _(first-session of node: `"<minuend> take away <subtrahend>. How many are left?"`)_ | `"Ten minus two. How many are left?"`       | "are left" framing follows Dave § Q2 (concrete-removal mental model).                                                                                                                          |
| `correct`    | `"Yes! <answer>!"` (same as `add-to-10`)                                                                                                 | `"Yes! Eight!"`                             | **Article-led variant NOT applicable** — math celebration template differs from word-song's `"Yes! That's a <word>."`; the math correct is bare number-celebration. No bang-fallback list.     |
| `reprompt`   | `"Hmm... try again?"` (verbatim, same as `add-to-10`)                                                                                    | `"Hmm... try again?"`                       | Locked phrasing — do NOT vary.                                                                                                                                                                 |
| `hint`       | `"Look. <minuend>. Take away <subtrahend>. How many now?"`                                                                               | `"Look. Ten. Take away two. How many now?"` | Mirrors `add-to-10`'s "Look. Three. And two more. How many now?" structure. Uses "take away" framing in the hint regardless of read-line variant (the hint is a scaffold, not a primary read). |
| `giveAnswer` | `"This one is <answer>."` (same as `add-to-10`)                                                                                          | `"This one is eight."`                      | Locked.                                                                                                                                                                                        |

**`correct = 0` celebration form.** For subtract-self facts (#1, #2), the correct line is `"Yes! Zero!"`. The word "zero" reads cleanly on `en-US-EmmaMultilingualNeural` — no SSML override required.

### 4.3 First-encounter scaffolding gate

Per `architecture-overview.md` §"Session-start derived-state blocks" and `api/_firstEncounterGate.ts:FIRST_ENCOUNTER_GATED_NODES`, the math node `sub-to-10` needs to be added to the gated set so the `read`-line variant ("take away" on first session, "minus" subsequent) is driven by `Progress.lifetimeFirstEncounters['sub-to-10']`.

**Current state of the gate.** `FIRST_ENCOUNTER_GATED_NODES` in [`api/_firstEncounterGate.ts`](../../api/_firstEncounterGate.ts) today contains ONLY `'cvc-words-short-o'`. No math node is yet in the gated set — `sub-to-10` is the FIRST math node to enter the first-encounter-gating system. The unit test `getFirstEncounterGatedNodes › does NOT include any math focus nodes` at [`_firstEncounterGate.test.ts:99-110`](../../api/_firstEncounterGate.test.ts#L99-L110) is a NEGATIVE-assertion guard (`expect(gated).not.toContain(mathNode)`) — it currently passes because no math node is gated. Adding `'sub-to-10'` to `FIRST_ENCOUNTER_GATED_NODES` will break this test; Kevin's wire-up must revise it (see §9.4).

**Behaviour:**

- Session 1 on this node (`lifetimeFirstEncounters['sub-to-10'] === undefined`): use `"<minuend> take away <subtrahend>. How many are left?"`.
- Sessions 2+: use `"<minuend> minus <subtrahend>. How many are left?"`.

The gate fires once-per-lifetime (the existing `Progress.lifetimeFirstEncounters` semantics). The gate flag is set AT session-start when the planner emits the variant; subsequent sessions read the flag and skip the variant. No retroactive flip.

**Why the gate.** Dave § Q2 / Recommendations: "the 'take away' phrasing is conceptually grounded and maps onto physical removal, which is the mental model Marian uses when counting back. This is a copy decision for Kyle/Kevin, not a full representational detour." Limiting it to the first session avoids the cognitive load of a phrasing-variability signal across the tier; the "minus" phrasing aligns with how subtraction is named in standard practice and how she'll encounter it long-term.

---

## 5. Schema posture — `MathFact` reuse, `op: '-'`, NO new infrastructure

`sub-to-10` introduces NO new TypeScript types. Every fact uses the existing [`MathFact`](../../src/lib/progress/types.ts) shape:

```ts
interface MathFact {
  a: number // minuend for op === '-'
  b: number // subtrahend for op === '-'
  op: '+' | '-' | '*' // '-' for sub-to-10
}
```

**Wire-shape changes.** The on-the-wire `MathProblem` shape (server → browser) needs:

1. A required `op: '+' | '-'` field on every problem. Today `MathProblem` infers `op = '+'` because `add-to-10` is the only first-class math tier. Widening to include `op` is mechanical; the field is REQUIRED on `sub-to-10` problems. Make the field REQUIRED on all math problems (default `'+'` for `add-to-10` to preserve backwards compatibility on canon and the static fallback) so callers cannot forget to set it. See §9 "Wire-shape widening".
2. An optional `distractorClass?: 'off-by-one' | 'wrong-op'` field on `MathProblem` (§3.4). Only present on `sub-to-10` P4–P8; absent on `add-to-10` problems entirely.

**Browser parser adapter.** [`planFromServer.ts:parseReadAddends`](../../src/screens/Math/planFromServer.ts) is anchored to `"X plus Y. How many?"`. The widening regex must accept `"X minus Y. How many are left?"` and `"X take away Y. How many are left?"` and tag the parsed problem with `op: '-'`. Per `project_planner_parser_contract.md` memory: **widen the browser parser BEFORE widening the planner.** Sequencing in Kevin's PR matters — see §9.

**No `slowFacts.ts` changes for v1.** The op-parameterized threshold (§8) is a separate task gated on `sub-to-10` being added to the slow-fact directive scope. v1 ships content + canon only; slow-fact widening lands in a follow-up.

**No screen-side changes.** `Math.tsx` is operation-agnostic; chip-rendering and gesture handling consume `MathProblem` without inspecting `op`. The audio path consumes `read` text verbatim; "minus" / "take away" speak naturally with the Emma voice without phoneme overrides.

---

## 6. Advancement gate — `add-to-20 → sub-to-10` (ACCURACY ONLY)

Per the locked curriculum order (§11 Q1), `sub-to-10` sits AFTER `add-to-20` in the tree. The advancement gate is therefore `add-to-20 → sub-to-10`, not `add-to-10 → sub-to-10`. Dave's research note frames the promotion as accuracy-only regardless of which addition tier is the predecessor; the rule applies the same way:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default threshold `95/3` locked 2026-05-02, ticket 86c9kwvy0; see `progress-and-persistence.md` § "Mastery rule").

**Explicitly NOT a gate:**

- ❌ Slow-fact list length. Even if Marian's predecessor-node slow-fact list is large, she advances to `sub-to-10` once accuracy holds. **Dave § Recommendations / Risks: holding her on the predecessor past 95% waiting for latency to drop is _developmentally backwards_ for this transition — fact-family exposure via `sub-to-10` is itself part of the treatment for slow upstream addition facts (McNeil et al. 2025).** The rationale Dave originally framed against `add-to-10 → sub-to-10` applies equally to `add-to-20 → sub-to-10`: subtraction practice tightens addition-fact retrieval via the inverse-principle.
- ❌ Latency median. The slow-fact directive is a backend re-targeting tool; it does NOT inform promotion (Dave's `speed-feedback-automaticity-marian.md` § Recommendation 7).

**Hard stop (parent / observation gate, NOT algorithmic):** Dave § Q6 — do NOT advance if Marian shows emotional distress signals (session abandonment, repeated retries with no improvement). This is a Thomas / parent observation lever, exercised via the existing Parent Settings `autoPromote: false` flag.

**Code implication.** NO code change to `applyMasteryRule` or `pickFocusNode`. The existing rule already promotes on accuracy alone. This spec affirms the existing behaviour is correct for the `add-to-20 → sub-to-10` transition and documents the rationale.

**Rationale to capture in `.claude/docs/progress-and-persistence.md`.** Per Dave's research note "Non-obvious findings" #3: any future code path that gates promotion on "slow-fact list is short" would be developmentally backwards for this specific transition. Worth documenting in `progress-and-persistence.md` § "Focus-node picker" as a "DO NOT gate on slow-fact list length" footnote. This is a documentation update flagged for `maintain-docs` routing — not a Kevin task.

---

## 7. Dual-exposure rule — never pair a `-` fact with its `+` inverse in the same session

**Rule (LOCKED — Dave § Q3 / Recommendations / Risks).**

> Within an 8-problem `sub-to-10` session, no subtraction fact and its addition inverse may co-occur.

**Definition.** For a subtraction fact `a − b = c`, the addition inverses are `b + c = a` and `c + b = a`. **Both** orderings are forbidden in the same session as the subtraction fact.

**Examples:**

- ✅ Session contains `10 − 7 = 3`; `7 + 3 = 10` is FORBIDDEN; `3 + 7 = 10` is FORBIDDEN.
- ✅ Session contains `8 − 3 = 5`; `3 + 5 = 8` is FORBIDDEN; `5 + 3 = 8` is FORBIDDEN.
- ✅ Session contains `5 − 5 = 0`; `0 + 5 = 5` is FORBIDDEN; `5 + 0 = 5` is FORBIDDEN.

**V1 enforcement scope.** `sub-to-10` sessions are pure-subtraction in v1 (per `MATH_TRACK_GUIDE` `sub-to-10` block — all 8 problems use `op === '-'`). Within a single 8-problem subtraction set, two `−` facts can be inverses of each other ONLY if they reference the same operand triple (e.g. `10 − 7 = 3` and `10 − 3 = 7`) — these are NOT forbidden (different operand pairs, same triple). The dual-exposure rule applies to `−` ↔ `+` cross-operation pairing, not `−` ↔ `−`.

**Forward-compatibility.** When future spec widens the planner to mixed-operation sessions (sometimes referred to as fact-family interleaving), the dual-exposure rule MUST remain in force. The directive block in §4.1 (rule #4) is forward-compatible — the prohibition is on operand-triple co-occurrence regardless of where the `+` problem comes from.

**Enforcement layer.** Single source of truth is the planner directive (§4.1 rule #4). Haiku enforces; the parser does NOT re-validate (parsing dual-exposure across operations would require both `+` and `-` parser branches to coordinate, and the v1 pool is pure-`−` so there's nothing to coordinate against).

---

## 8. Op-parameterized slow-fact threshold — REQUEST for Kevin's `slowFacts.ts`

**Out of scope for THIS spec to author** — flagged here as a Kevin TODO for a separate PR (§9).

**Problem.** Today [`src/lib/progress/slowFacts.ts:69`](../../src/lib/progress/slowFacts.ts#L69) defines `SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000` — a single global threshold. Per Dave § Source 6 (Geary et al. 2007), subtraction retrieval mean RT in 2nd graders is _systematically_ higher than addition RT for comparable facts because subtraction lacks the rehearsal scaffolding addition gets from counting-on. Applying the same 5 s threshold to `op === '-'` will flood the slow-fact payload on early `sub-to-10` sessions (every new subtraction fact will look slow), defeating the canon-first fast-path because non-empty slowFacts bypasses canon AND the in-memory cache (`planner-and-canon.md` § "Track-based payload" — `slowFacts` bypass posture).

**Proposed shape — operation-parameterized + tenure-aware threshold.** Per Dave's "Non-obvious findings" #1:

| Operation | Sessions on the node | Threshold (ms)                                                    |
| --------- | -------------------- | ----------------------------------------------------------------- |
| `+`       | any                  | `5000`                                                            |
| `−`       | 1 – 10               | `7000`                                                            |
| `−`       | 11 – 20              | `6000`                                                            |
| `−`       | 21 +                 | `5000`                                                            |
| `*`       | any                  | `5000` (placeholder — re-evaluate when multiplication tier ships) |

The session-tenure count is `progress.history.filter(e => e.skillFocus.includes('sub-to-10')).length` evaluated at slow-fact-build time.

**Alternative simpler shape (RECOMMENDED for v1 of the slowFacts widening).** Suppress the slow-fact directive entirely for the first 5 `sub-to-10` sessions (treat the node as "new tier, baseline phase") and only engage it once `progress.history` for the node has ≥ 5 entries — then apply a flat `op === '-' → 6000 ms` threshold. This is simpler than the 3-band tenure ladder above and still avoids the cold-start flood. **Kevin's call between the 3-band ladder and the flat threshold + 5-session warmup.**

**Code-change shape.**

```ts
// slowFacts.ts — add operation-aware threshold accessor
export function slowFactLatencyThresholdMs(
  op: '+' | '-' | '*',
  nodeSessionCount: number,
): number {
  if (op !== '-') return SLOW_FACT_MIN_MEDIAN_LATENCY_MS // 5000
  if (nodeSessionCount < 10) return 7000
  if (nodeSessionCount < 20) return 6000
  return SLOW_FACT_MIN_MEDIAN_LATENCY_MS
}
```

Or for the recommended simpler shape:

```ts
const SUB_SLOW_FACT_WARMUP_SESSIONS = 5
const SUB_SLOW_FACT_THRESHOLD_MS = 6000
// inside buildSlowFactSessionHint, after the per-fact aggregation pass:
if (sessionCountForFocusNode < SUB_SLOW_FACT_WARMUP_SESSIONS) return []
```

**Out of scope here.** Kevin chooses. This spec FLAGS the requirement; the slowFacts widening is its own PR. Dependencies:

1. The slow-fact directive scope (`isSlowFactsActive` in [`_planner.ts:726`](../../api/_planner.ts#L726)) must widen to include `sub-to-10` BEFORE the threshold change matters.
2. The `buildSlowFactSessionHint` function must take the focus-node argument so it can count node-tenure (today it doesn't — it scans the whole `progress.history` for add-to-10 entries via `isAddToTenEntry`).

**Suggested order.** Land sub-to-10 content + canon first (the current scope of this spec). Slow-fact widening lands in a follow-up after Marian has generated 5+ `sub-to-10` sessions and the latency profile can be sanity-checked against the proposed threshold.

---

## 9. Wire-up checklist for Kevin

This is the ONLY actionable list for the implementing developer. Everything above is rationale + content; everything below is what changes in code.

> **Dependency order is load-bearing.** Per `project_planner_parser_contract.md`: widen the browser parser BEFORE widening the planner. Items below are numbered in safe-merge order.

### 9.1 Parser widening (FIRST — must land before any planner widening)

- [ ] **`src/screens/Math/planFromServer.ts` — HARD REQUIREMENT — add `"zero": 0` to `NUMBER_WORDS`.** Today [`planFromServer.ts:84-104`](../../src/screens/Math/planFromServer.ts#L84-L104) maps `"one"` → `1` through `"twenty"` → `20`. It does NOT contain `"zero"`. Sub-to-10 facts #3 (`7 − 0 = 7`) and #4 (`9 − 0 = 9`) produce read-lines containing the word "zero" ("seven minus zero is seven", "nine minus zero is nine"); the parser routes numeric tokens through `NUMBER_WORDS` and will throw `PlanFromServerError` on these facts without the entry. **Kevin MUST add `"zero": 0` to `NUMBER_WORDS` in this PR.** Devon's audit of the live source confirms the gap.
- [ ] **`src/screens/Math/planFromServer.ts`** — widen the regex / parse path to accept the `sub-to-10` read templates and tag parsed problems with `op: '-'`:
  - Match `"<minuend-word> minus <subtrahend-word>. How many are left?"`
  - Match `"<minuend-word> take away <subtrahend-word>. How many are left?"` (first-session variant)
  - Keep matching the existing `"<addend-A-word> plus <addend-B-word>. How many?"` template — tag with `op: '+'`.
- [ ] **`src/screens/Math/sessionPlans.ts`** — add `op: '+' | '-'` to `MathProblem` (REQUIRED). Default `'+'` for all existing fallback plans. Add `distractorClass?: 'off-by-one' | 'wrong-op'` (OPTIONAL).
- [ ] **`src/screens/Math/planFromServer.ts`** — pass `op` through into the rehydrated `MathSessionPlan`.
- [ ] **Tests** — `planFromServer.test.ts` gains read-template fixtures for `sub-to-10`: both "minus" and "take away" variants. Include explicit fixtures for `7 - 0 = 7` and `9 - 0 = 9` (the subtract-zero pool facts that require the new `"zero"` entry — parse failure here is the regression Devon flagged). Assert `op === '-'` after parse.
- [ ] **CI gate** — vitest passes locally (`npx vitest run` per `feedback_run_vitest_before_merge`).

### 9.2 Distractor extension

- [ ] **`src/screens/Math/distractors.ts`** — extend `pickDistractors(correct, problemIndex, maxAnswer, opts?)` with:
  - Optional `op?: '+' | '-'` (default `'+'`).
  - Optional `minAnswer?: number` (default `ANSWER_RANGE_MIN`). For `op === '-'` callers, pass `0`.
  - Optional `distractorClass?: 'off-by-one' | 'wrong-op'` (Haiku's hint, soft signal).
  - New `wrongOpDistractors(correct, a, b, problemIndex, [minAnswer, maxAnswer])` internal function:
    - Computes `a + b` as the trap.
    - Pairs with `correct ± 1` as the secondary (off-by-one fallback per §3.2).
    - Falls back to Class 1 (`offByOneDistractors`) when `a + b > maxAnswer` (out-of-range trap) OR `a + b === correct` (subtract-zero alias).
  - Dispatch logic: P1–P3 → `gentleDistractors`; P4+ with `op === '-'` AND `distractorClass === 'wrong-op'` (or fallback round-robin) → `wrongOpDistractors`; P4+ otherwise → `offByOneDistractors`.
- [ ] **`src/screens/Math/distractors.test.ts`** — pin every pool fact (§1.1) against expected distractor outputs for both Classes 1 and 2. Pin the alias / OOR fallbacks. Pin the gentle ramp on subtract-self facts (correct = 0) confirms `minAnswer = 0` widening works.
- [ ] **Wire `op` + `distractorClass` through the screen.** `Math.tsx` invokes `pickDistractors` with the new args. No render logic changes; just argument plumbing.

### 9.3 Planner directive — `MATH_TRACK_GUIDE` `sub-to-10` block

- [ ] **`api/_planner.ts:920`** (post-2026-05-16 MEDIUM + HARD/general amendments) — replace the directive block with the 22-fact-pool version in §4.1, including the new IN/OOR/ALIAS annotations and the DISTRACTOR-COVERAGE SELF-CHECK block (replaces the prior DISTRACTOR-CLASS HINT block per §13 post-ship correction). HARD-band block must include the 2 new HARD/general IN-facts (`7-3=4`, `6-4=2`).
- [ ] **`scripts/compositionLint.ts:SUB_TO_TEN_POOL`** (post-2026-05-16 MEDIUM + HARD/general amendments) — widen the const to 22 facts matching §1.1. Adds the 4 MEDIUM facts (`8-1`, `7-1`, `8-2`, `6-2`) AND the 2 HARD/general facts (`7-3`, `6-4`). The drift-guard test from PR #246 will fail until the lint matches the directive.
- [ ] **`scripts/compositionLint.ts:SUB_TO_TEN_RULES.categoryCaps`** — verify caps stay at `subtract-one: 1, subtract-two: 1, general: 2` (pool grew but session caps did not). No change expected; sanity-check.
- [ ] **`scripts/compositionLint.test.ts`** — update fixtures to exercise the new pool entries. Add a positive test: a baked plan picking `{8-1, 8-2}` at P4-P5 with the take-from-10 elsewhere passes the lint. Add a HARD/general positive test: a baked plan picking `{7-3, 6-4}` at P4-P5 (filling the `general` cap) with the take-from-10 elsewhere passes the lint. Add a wrong-op-coverage helper test (optional, per §2.2 item 4): count P4-P8 facts with `a+b ≤ 10 && a+b !== correct`; assert ≥ 2 in the baked canon.
- [ ] **`api/_planner.ts`** — verify the system-prompt JSON contract carries `op` in the emitted `MathProblem` shape. The `distractorClass` field is kept on the wire shape as a forward-compat seam only (per §13 post-ship correction); do NOT re-add a "Haiku must tag distractorClass" directive (`planner-and-canon.md` § "Wire shape is utterance-only — invariant").
- [ ] **`api/_planner.test.ts`** — add a focused test: stub Haiku, feed back a `sub-to-10` plan, assert: (a) every problem has `op: '-'`; (b) at least one take-from-10 fact appears in P4-P8; (c) at least 2 of P4-P8 are IN-annotated facts (i.e. `(a, b) ∈ {(8, 1), (7, 1), (8, 2), (6, 2), (7, 3), (6, 4)}` — MEDIUM IN-set ∪ HARD/general IN-set, post-2026-05-16 HARD/general amendment); (d) no operand-triple co-occurs as `-` and `+` (dual-exposure).
- [ ] **`api/_planner.ts:effectiveFocusNode`** — confirm `sub-to-10` is NOT in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (it's math, not word-song; just sanity-check no off-by-one mistake). Math honours caller-supplied focusNode verbatim; no change needed there.

### 9.4 First-encounter gate

- [ ] **`api/_firstEncounterGate.ts`** — add `'sub-to-10'` to `FIRST_ENCOUNTER_GATED_NODES`. Today the set contains only `'cvc-words-short-o'`; `sub-to-10` is the FIRST math node to enter first-encounter gating.
- [ ] **`api/_planner.ts:buildUserMessage`** — wire the first-encounter check into the user-message construction so the read-line variant is selected per session (`"take away"` on first-encounter, `"minus"` otherwise).
- [ ] **`api/_firstEncounterGate.test.ts:99-110`** — REVISE OR REPLACE the existing negative-assertion test `'does NOT include any math focus nodes'`. That test enumerates `['add-to-10', 'add-to-20', 'sub-to-10', 'sub-to-20', 'two-digit-addsub']` and asserts NONE are gated — adding `'sub-to-10'` to the set will make it fail. The current test was a design statement ("math nodes are not first-encounter-gated") that remains true for every math node EXCEPT `sub-to-10`. Replace with per-node assertions:
  - `expect(getFirstEncounterGatedNodes()).toContain('sub-to-10')` — the new gated math node.
  - For each of `'add-to-10'`, `'add-to-20'`, `'sub-to-20'`, `'two-digit-addsub'`: `expect(getFirstEncounterGatedNodes()).not.toContain(mathNode)` — these remain non-gated.
    Keep the existing pass-through and rewrite-case suites unchanged; only the `getFirstEncounterGatedNodes` describe block needs the per-node split.

### 9.5 Canon prebake

- [ ] **`scripts/generateSessionCanon.ts:activeCombos()`** — confirm `sub-to-10` is in `MATH_FOCUS_NODES` iteration set. It SHOULD already be (the iteration set typically covers all `VALID_MATH_FOCUS_NODES`); verify and add if missing.
- [ ] **`npm run canon:regen`** — incremental regen for `sub-to-10` only (REQUIRED post-2026-05-16 pool widening — Haiku will likely select different facts from the new 22-fact pool, especially in P4-P8 where the 2 HARD/general IN-facts may now be selected):
  ```
  rm public/canon/math/level-1/sub-to-10.json
  cp .env.local <worktree>/.env.local           # canon-bake needs the keys
  yarn install --frozen-lockfile               # worktree needs node_modules
  npx tsx scripts/generateSessionCanon.ts --require-keys
  ```
  Per `planner-and-canon.md` § "Incremental-by-default trick". Bake produces ~25s of work and ~$0.005 of Haiku + Azure spend. Commit the JSON diff in the same PR.
- [ ] **Canon-lint gate** — `npm run canon:lint` must pass (chains text-encoding lint + composition lint). Text encoding: ASCII-7 only, no slash-IPA, no angle tags. Composition: 22-fact pool membership, band-by-slot, category caps, take-from-10 coverage, no duplicates. Both layers run at bake time inside `generateSessionCanon.ts` and at CI gate.
- [ ] **Post-bake wrong-op spot-check** — `cat public/canon/math/level-1/sub-to-10.json | jq '.utterances[] | select(.id | test("^math\\.p[4-8]\\.read$"))'` then walk each `read` text, compute `a + b`, count facts where `a+b ≤ 10 && a+b !== a-b`. Assert count ≥ 2. If < 2, bake is non-compliant with §2.2 — re-roll. (This check belongs in `compositionLint.ts` long-term, per §9.3 follow-up.)
- [ ] **`scripts/generateSessionCanon.test.ts`** — the combo-count regression assertion should pick up `sub-to-10` automatically if it's already in the iteration set; if the test pins the count explicitly, bump.

### 9.6 Mastery / focus-node picker — NO CHANGE

Per §11 Q1 (Thomas, 2026-05-15): **leave the tree alone.** Existing curriculum order is `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → ...`; that's the order that ships.

- [ ] **`src/lib/progress/mastery.ts`** — NO CHANGE to `MATH_TREE`.
- [ ] **`src/lib/progress/focusNode.ts`** — NO CHANGE to `MATH_NODES_IN_ORDER`.
- [ ] **`applyMasteryRule` / `pickFocusNode`** — NO CODE CHANGE. The promotion rule applies as-is.
- [ ] **`src/lib/progress/defaults.ts:93`** — **HARD REQUIREMENT** — flip `'sub-to-10': 'mastered'` to `'sub-to-10': 'practicing'` in `DEFAULT_SKILL_LEVELS`. Marian's April 2026 diagnostic marked subtraction-within-15 as confident, so the existing default is `'mastered'` — but Dave's research treats `sub-to-10` as a retrieval-automaticity tier (the same gap as `add-to-10`), and leaving it `'mastered'` means a fresh Marian would never see `sub-to-10` problems. Devon's PR #238 review flagged this; Thomas confirmed the flip 2026-05-15. Note: this only affects greenfield boots; existing Marian localStorage state is unaffected (her live blob is what it is).

### 9.7 Slow-fact widening — DEFERRED FOLLOW-UP

- [ ] **(FOLLOW-UP PR)** Implement op-parameterized threshold in `slowFacts.ts` per §8. Two design choices on the table; Kevin picks. NOT in this PR.

### 9.8 Test coverage minimums

- [ ] Unit: parser (every pool fact's read-line parses with correct `op`), distractors (every pool fact × both classes), planner stub (composition rules #1-6 from §4.1 enforced).
- [ ] E2E (Jessica): Per `feedback_progression_e2e_mandatory` — any PR touching `mastery.ts` / `focusNode.ts` / `firstEncounterGate.ts` / `parentSettings.ts` requires a failing-first E2E spec. Kevin's PR touches `_firstEncounterGate.ts` for the read-line variant gate — Jessica must author an E2E spec at `e2e/sub-to-10-first-encounter.spec.ts` covering: (a) first-session read-line is "take away"; (b) second session is "minus"; (c) the `lifetimeFirstEncounters['sub-to-10']` flag flips at session-start, not session-end. **DISPATCH-TIME REQUIREMENT** — must be paired with the implementation PR, not a follow-up.
- [ ] Self-test report on the PR per `feedback_self_test_report`: AC walkthrough + side-effect inventory.

### 9.9 Docs

- [ ] **`.claude/docs/skill-trees-and-content.md`** — append a "Math distractors — Class 2 (wrong-operation) for `sub-to-10`" subsection under "Math distractors". Document the algorithm + scope (sub tier only, P4-P8 only). Note that `add-to-10` is unchanged.
- [ ] **`.claude/docs/progress-and-persistence.md`** — under "Mastery rule" or "Focus-node picker", add a footnote: "Promotion is accuracy-only; do NOT introduce a slow-fact-list-length gate for `add-to-10 → sub-to-10` (Dave's research confirms fact-family exposure via the next tier is itself therapeutic for slow upstream facts; gating on slow-list-shortness would be developmentally backwards)."

---

## 10. Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite.

- [ ] **AC1**: The 22-fact pool (post 2026-05-16 MEDIUM + HARD/general amendments) is faithfully encoded in `MATH_TRACK_GUIDE`'s `sub-to-10` block AND in `scripts/compositionLint.ts:SUB_TO_TEN_POOL` (vitest snapshot on the directive block; planner-test asserts pool membership; compositionLint drift-guard from PR #246 catches any mismatch between directive and lint).
- [ ] **AC2**: Every Haiku-generated `sub-to-10` plan composition rule from §4.1 holds: P1-P3 from `easy` band, ≥1 take-from-10 in P4-P8, no duplicates, no operand-triple `−`/`+` co-occurrence within the 8-problem set, category caps respected. **The ≥2-wrong-op-in-P4-P8 target is now a pool-side + directive-side responsibility (per §2.2 post-2026-05-16 wording); see AC4 for the render-side verification.**
- [ ] **AC3**: First-encounter gate — session 1 on `sub-to-10` uses "take away"; sessions 2+ use "minus". Verified via E2E with seeded `lifetimeFirstEncounters`.
- [ ] **AC4**: Class 2 distractors fire correctly at render time: every P4-P8 op:'-' problem attempts a wrong-op trap (a+b) in `Math.tsx:2559-2560`; the trap renders when in range and `a+b ≠ correct`; OOR cases silently downgrade to Class 1 (off-by-one); subtract-zero same-value collisions silently downgrade to Class 1. **Post-pool-widening (2026-05-16, MEDIUM + HARD/general amendments): at least 2 of the 5 P4-P8 problems in any canon-baked session deliver in-range wrong-op chips when the §4.1 DISTRACTOR-COVERAGE SELF-CHECK is honoured; with HARD/general additions the target is structurally redundant (sourceable from HARD/general alone OR HARD+MEDIUM combo OR MEDIUM alone). Verifiable via a vitest snapshot on the baked `sub-to-10.json` — count P4-P8 facts whose `(a+b) ≤ 10 && a+b !== correct`; assert ≥ 2.**
- [ ] **AC5**: `correct = 0` chip values render and play correctly (subtract-self facts #1, #2). Emma says "Yes! Zero!" naturally on the cheerful celebration prosody.
- [ ] **AC6**: Read-line parser accepts both `sub-to-10` templates and tags problems with `op: '-'`; existing `add-to-10` "X plus Y. How many?" continues to parse with `op: '+'`.
- [ ] **AC7**: Canon JSON `public/canon/math/level-1/sub-to-10.json` baked and committed. Canon-lint passes (ASCII-7, no slash-IPA, no angle tags). File parses via `isSessionStartResponse`.
- [ ] **AC8**: Advancement gate — `add-to-20 → sub-to-10` (the curriculum-order slot per §9.6, decision locked §11 Q1) fires on accuracy threshold alone, NOT influenced by slow-fact list length. Verified via existing mastery tests; no new gate added.
- [ ] **AC9**: Dual-exposure rule — within any single 8-problem session, no operand triple appears in both `+` and `-` forms. Today vacuously true because v1 sessions are pure-`−`; covered by the planner test enumerating all 8 problems.
- [ ] **AC10**: Slow-fact directive remains DISABLED for `sub-to-10` in v1 (`isSlowFactsActive` predicate unchanged — gated on `focusNode === 'add-to-10'`); the §8 op-parameterized threshold lands in a follow-up PR.
- [ ] **AC11**: `op` field is required on every `MathProblem` emitted by the planner. Backwards compatibility — existing `add-to-10` canon entries can be lazily migrated by `planFromServer.ts` (default `'+'` when absent) so a stale-canon `add-to-10` doesn't break.

---

## 11. Decisions locked (Thomas, 2026-05-15)

The four questions originally surfaced as open are now resolved. The spec is the contract for Kevin's implementation; the section below records the decisions and rationale so Kevin doesn't have to re-derive them.

**Q1 — Curriculum order: insert `sub-to-10` between `add-to-10` and `add-to-20`, or leave it after `add-to-20`?**

**DECIDED: Option A — leave the tree alone.** Tree stays `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → ...`. NO changes to `MATH_TREE` in [`src/lib/progress/mastery.ts`](../../src/lib/progress/mastery.ts) or `MATH_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts`](../../src/lib/progress/focusNode.ts).

Rationale: A re-ordering would be a progression-state-machine change that per `feedback_progression_e2e_mandatory` requires a paired failing-first E2E spec at dispatch time, and would carry the risk of stale `Progress` blobs landing on a node out of expected order. Dave's "next on the curriculum ladder" framing is satisfied by interpretation ("next _subtraction_ node," which is unambiguously `sub-to-10`); no pedagogical signal forces re-ordering. Ship `sub-to-10` in its existing slot after `add-to-20`; revisit ordering only if real-Marian data signals a need.

**Q2 — Slow-fact threshold implementation: tenure-banded ladder vs. flat warmup-then-threshold?**

**DECIDED: flat 6000 ms + 5-session warmup for `op === '-'`.** Kevin implements the simpler shape from §8 ("Alternative simpler shape"); the 3-band tenure ladder is dropped.

Rationale: There is no empirical `sub-to-10` latency data yet against which to calibrate a 3-band ladder, so the ladder's threshold cliffs (7000 → 6000 → 5000) are speculative. A flat 6000 ms threshold gated by a 5-session warmup avoids the cold-start flood (per `planner-and-canon.md` § "Track-based payload" — non-empty `slowFacts` bypasses canon AND the in-memory cache, which would otherwise tank the canon-first fast-path) while keeping the implementation surface narrow. Retune once Marian has generated ≥ 10 `sub-to-10` sessions and the latency profile is visible in production data. This work remains a follow-up PR (not in this PR's scope per §9.7).

**Q3 — Widen `ANSWER_RANGE_MIN` to 0 for `op === '-'`, or drop subtract-self / subtract-zero facts from the pool?**

**DECIDED: widen `ANSWER_RANGE_MIN` to 0 for `op === '-'`** (Option A per §3.3). Kevin's wire-up MUST also add `"zero"` to the `NUMBER_WORDS` map in [`src/screens/Math/planFromServer.ts`](../../src/screens/Math/planFromServer.ts) — see §9.1 HARD REQUIREMENT (Devon's audit dependency).

Rationale: The rule-based identity facts (`n − n = 0`, `n − 0 = n`) are pedagogically the easiest band (Dave § Source 3 — Robinson 2013: 65–73% of children apply the Identity principle correctly). Dropping facts #1, #2, #3, #4 from the pool would forfeit the highest-confidence opener facts and trim the easy band from 8 to 4. `Math.tsx` is already changing in PR 2 for the operator glyph + `op` plumbing, so adding `minAnswer` to `pickDistractors` lands cleanly in that PR. Future subtraction tiers will need `0`-chip support too; getting it in place now avoids a re-litigation.

**Q4 — First-session "take away" framing — single-session gate or persistent through intro phase?**

**DECIDED: single-session-only** (the spec default — see §4.3). The "take away" phrasing fires once on the first session over the lifetime of `sub-to-10`; sessions 2+ use "minus".

Rationale: Dave § Q2 explicitly scopes the recommendation to "the very first session." Persisting "take away" across the whole intro phase would introduce phrasing variability across the tier — a cognitive load signal Marian doesn't need once she's seen subtraction once. The "minus" template aligns with how subtraction is named in standard practice and how she'll encounter it long-term. Re-open only if Thomas's iPad ear-test post-merge signals a problem.

**PR split.** **DECIDED: 2-PR per Kevin's recommendation.**

- **PR 1 (this content tier):** planner directive (§4.1), `MATH_TRACK_GUIDE` block, first-encounter gate wiring + test revision (§9.4), `NUMBER_WORDS` zero entry (§9.1 hard requirement), canon prebake (§9.5).
- **PR 2 (Math.tsx render):** `op` field on `MathProblem` wire shape, parser widening for "minus" / "take away" templates (§9.1), `distractors.ts` extension with Class 2 (§9.2 + §3.2), `Math.tsx` argument plumbing, operator-glyph render.

Sequencing follows `project_planner_parser_contract.md`: PR 1's planner widening lands AFTER PR 2's parser widening. The canon bake in PR 1 produces "minus" / "take away" read-lines; if PR 2 hasn't landed yet, the browser parser would throw on those lines. Recommended merge order is PR 2 first (parser-ready browser), THEN PR 1 (planner emits the new content). If Kevin needs PR 1 to land first for canon-bake reasons, the canon's "minus" / "take away" reads are dormant until PR 2 ships; the static fallback plan still works.

---

## 12. Risks / counter-evidence

- **The wrong-operation distractor risks being too easy if the trap value is far from `correct`.** For `8 − 4 = 4`, wrong-op `12` is OOR → falls back to off-by-one anyway. For `9 − 1 = 8`, wrong-op `10` is only `correct + 2` — close enough to be a meaningful trap. For `10 − 7 = 3`, wrong-op `17` is OOR. **Post-2026-05-16 amendments (MEDIUM + HARD/general): 6 of the 14 MEDIUM/HARD facts have in-range wrong-op values (4 newly-added MEDIUM facts: `8-1=7` trap=9, `7-1=6` trap=8, `8-2=6` trap=10, `6-2=4` trap=8; 2 newly-added HARD/general facts: `7-3=4` trap=10, `6-4=2` trap=10). The remaining 8 MEDIUM/HARD facts (4 original HARD/general + 4 original `10-*` MEDIUM) have OOR traps and silently downgrade to off-by-one at render time.** Per Dave § Recommendations the wrong-op trap remains valuable for the in-range half; the OOR half doesn't make things worse, just doesn't add the new trap class.

- **The ≥2/5 wrong-op-in-P4-P8 target is structurally REDUNDANT post-2026-05-16 HARD/general amendment.** With the post-amendment pool, the maximum in-range count in P4-P8 is 4 — one MEDIUM/subtract-one IN-fact (`8-1` or `7-1`) AND one MEDIUM/subtract-two IN-fact (`8-2` or `6-2`) AND both HARD/general IN-facts (`7-3` + `6-4`, which together fill the `general` cap of 2). The ≥2 target is achievable from HARD/general alone (7-3 + 6-4 under the `general` cap), OR from MEDIUM alone (any one subtract-one IN + any one subtract-two IN), OR from any HARD+MEDIUM combination. **The structural cushion is now redundant rather than thin.** Even a high-recent-score session biased heavily toward HARD picks meets the target without leaning on MEDIUM in-range selections. The directive's NEGATIVE-ANCHOR self-check (§4.1) remains as a soft prophylactic against pathological Haiku selections that skip every IN-annotated fact, but the safeguard no longer rests on a 2-fact knife-edge.

- **The dual-exposure rule could be over-restrictive once Marian masters `sub-to-10` and we want to interleave `+`/`-` sessions** (per McNeil et al. 2025, fact-family interleaving is _therapeutic_ for both operations). The rule as worded (§7) applies WITHIN a session, not across sessions. Cross-session interleaving is unaffected; only same-session inverse-pair co-occurrence is forbidden. The spec's intent is preserved even when mixed-operation sessions ship in a future tier.

- **Pool size of 22 (post-amendments) may still be thin once Marian advances past the easy band.** With 8 easy facts, 8 medium, 6 hard, late-tier sessions could hit the same 6-fact `hard` band repeatedly. The 2026-05-16 amendments widened MEDIUM (+4) and HARD (+2) but did not increase EASY. A future HARD-band extension (more `general`-band facts beyond the trap=10 sub-cluster, if Marian-data signals saturation) is the natural next step; tracked in §9.7 as a follow-up PR. NOT a blocker for v1. **Subtrahend-repeat caution within HARD/general:** facts #19 `7-4=3` and #22 `6-4=2` share b=4. Under the `general` cap of 2 they can co-occur; a Haiku-compliance note in the directive flags this as a mild monotony risk (managed via §4.1 Composition rule #6, not a hard cap).

- **`correct = 0` SSML/audio risk.** Tested mentally only — "Yes! Zero!" should render fine on Emma multilingual. **Real ear-test pending** (post-merge by Thomas on the Vercel preview); spec assumes default Azure prosody handles "zero" cleanly. Fallback: per `planner-and-canon.md` § "Empirical IPA-outcomes taxonomy", the default-Azure-lexicon-is-fine option (Option 1) is the right posture unless ear-test reveals an issue.

- **Curriculum order locked (no reorder).** Thomas decided 2026-05-15 to leave the tree alone (§11 Q1). Marian sees `sub-to-10` after `add-to-20`. If a future ear-test or real-Marian observation suggests she'd benefit from seeing subtraction earlier in the curriculum, a `MATH_TREE` reorder is a progression-state-machine change that per `feedback_progression_e2e_mandatory` requires a paired failing-first E2E spec at dispatch time.

---

## 13. Side-effects inventory

What this spec implies for code (Kevin) and content (canon). PR split per §11: PR 1 = content + canon; PR 2 = render + parser.

**PR 1 — content + canon (Kevin):**

- `api/_planner.ts` — `MATH_TRACK_GUIDE` `sub-to-10` block expanded to 22-fact pool with IN/OOR/ALIAS annotations + DISTRACTOR-COVERAGE SELF-CHECK block (per §4.1 post-2026-05-16 MEDIUM + HARD/general amendments).
- `scripts/compositionLint.ts` — `SUB_TO_TEN_POOL` widened from 16 to 22 facts matching §1.1 (adds `8-1`, `7-1`, `8-2`, `6-2` to MEDIUM band; adds `7-3`, `6-4` to HARD band). `SUB_TO_TEN_RULES` category caps unchanged. Drift-guard from PR #246 will fail until both ends match. **Sequencing note:** this spec change ships SPEC-ONLY (no `compositionLint.ts` edit in the PR carrying this amendment); Kevin's downstream widening to 22 facts is sequenced after spec PR merges. Canon + planner directive widening will also wait on the Kevin update.
- `scripts/compositionLint.test.ts` — fixtures updated for the new pool entries.
- `api/_firstEncounterGate.ts` — `'sub-to-10'` added to `FIRST_ENCOUNTER_GATED_NODES` (first math node in the set).
- `api/_firstEncounterGate.test.ts:99-110` — REVISE the `'does NOT include any math focus nodes'` negative-assertion test to per-node assertions: `sub-to-10` IS gated; the other math nodes (`add-to-10`, `add-to-20`, `sub-to-20`, `two-digit-addsub`) are NOT gated. See §9.4.
- `api/_planner.ts:buildUserMessage` — first-encounter check wired into user-message construction for read-line variant.
- `src/lib/progress/defaults.ts:93` — HARD REQUIREMENT — flip `'sub-to-10': 'mastered'` to `'sub-to-10': 'practicing'` in `DEFAULT_SKILL_LEVELS`. Decision locked Thomas 2026-05-15 (see §9.6 + §11 Q1 rationale).
- `public/canon/math/level-1/sub-to-10.json` — new canon, baked via `npm run canon:regen` per §9.5; ~1.2 MB; 59 utterances at 8 problems × 5 slots + 19 Session-End. **Post-2026-05-16 amendments (MEDIUM + HARD/general): bake will likely select different P4-P8 facts than the prior 16- or 20-fact canon — expect 1-2 of `{8-1, 7-1, 8-2, 6-2}` (MEDIUM IN-fact) AND/OR 1-2 of `{7-3, 6-4}` (HARD/general IN-fact) to appear in P4-P8 per session.**

**PR 2 — render + parser (Kevin):**

- `src/screens/Math/planFromServer.ts` — HARD REQUIREMENT — add `"zero": 0` to `NUMBER_WORDS` (Devon's audit, §9.1). Widen the regex / parse path to accept `"X minus Y. How many are left?"` and `"X take away Y. How many are left?"`; emit `op: '-'`. Keep matching the existing `"X plus Y. How many?"` template — tag with `op: '+'`.
- `src/screens/Math/sessionPlans.ts` — `MathProblem` gains required `op: '+' | '-'` field + optional `distractorClass?: 'off-by-one' | 'wrong-op'`.
- `src/screens/Math/distractors.ts` — `pickDistractors` signature extended; new `wrongOpDistractors` function; `ANSWER_RANGE_MIN` parameterized to 0 for `op === '-'` (per §3.3 Option A locked Q3).
- `src/screens/Math/Math.tsx` — argument plumbing (`op`, `distractorClass`, `minAnswer` through to `pickDistractors`) + operator-glyph render (− vs +).

> **Post-ship correction (2026-05-16, prior PR — distractor-class directive reword).** AC4 wrong-op rate is implemented at render time in `Math.tsx:2559-2560` (deterministic default: every `op:'-'` P4-P8 problem attempts `'wrong-op'`; `pickDistractors` silently downgrades to off-by-one when the trap is OOR or aliases the correct answer), NOT via planner emission. The original PR-2 wire plan above (and the §4 "Haiku is asked to TAG each P4-P8 problem with `distractorClass`" framing) is superseded — the `PlannerPlan` wire shape is utterance-only and cannot carry per-problem structured tags. The `MathProblem.distractorClass` field is kept as a forward-compat seam only. The planner directive was reworded in this PR (commit `4129963`) after research confirmed the historical Haiku emissions were silently discarded by the canon adapter and parsers (Devon NOF #1 PR #241, Kevin NOF #1 PR #240).

> **Post-ship correction (2026-05-16, prior PR — 20-fact pool widening).** Kevin's NOF #2 from PR #241 (forwarded by Devon's render review) surfaced that the prior post-ship correction above closed the directive loop but left a deeper pool-side defect: the original 16-fact pool's MEDIUM and HARD bands had ZERO facts whose wrong-op trap (`a + b`) was in-range, so every P4-P8 wrong-op attempt at render time silently downgraded to off-by-one — making §2.2's "≥2 of P4-P8 carry wrong-op" rule structurally unsatisfiable, not just stochastically risky. Dave's `canon-pool-wrong-op-delivery.md` paper (PR #247, 2026-05-16) audited the pool, identified candidate MEDIUM-band additions, and recommended `8-1=7`, `8-2=6`, `6-2=4` (with optional 4th `7-1=6`). Kyle audited Dave's recommendation against this spec and ACCEPTED it with the optional 4th included — the 2026-05-16 spec amendment widens §1.1 from 16 to 20 facts, annotates each fact with its `a+b` IN/OOR/ALIAS status, and adds a `DISTRACTOR-COVERAGE SELF-CHECK` block to the §4.1 directive that biases Haiku toward in-range MEDIUM selections in P4-P8. Downstream: Kevin updates `_planner.ts` directive's FACT POOL to mirror §4.1; Kevin widens `SUB_TO_TEN_POOL` in `scripts/compositionLint.ts` to match; Kevin re-bakes `sub-to-10.json`. The drift-guard test from PR #246 catches any mismatch.

> **Post-ship correction (2026-05-16, this PR — 22-fact pool widening with HARD/general additions, plus §1.2 minuend-range NIT).** Two follow-on changes from PR #249 review and Dave's HARD/general follow-up paper, bundled into one SPEC-ONLY PR:
>
> 1. **§1.2 minuend-range NIT (Devon).** Devon's PR #249 review flagged that §1.2 reported minuend range as `[6, 10]`, but #1 `5 − 5 = 0` has minuend 5. Corrected to `[5, 10]` — one-character fix.
>
> 2. **HARD/general pool additions (Dave).** PR #249's §1.3 had flagged five HARD/general candidates with `a+b ≤ 10` for Dave-side pedagogical evaluation. Dave's follow-up paper `canon-pool-wrong-op-delivery-followup-hard-general.md` (PR #250, 2026-05-16) audited all five against Baroody's three-tier framework. Verdict: ADOPT `7-3=4` (trap=10) and `6-4=2` (trap=10) — same cognitive load as existing HARD facts #18/#19, strongest "makes-ten" wrong-op lure in the pool; REJECT `5-3=2`, `4-3=1`, `5-4=1` (bridgeable via think-addition / trap not salient / near-zero-difficulty profile — would dilute HARD band identity). Pool widens 20 → 22; HARD/general grows 4 → 6; `general` cap unchanged (still 2 per session). Trap=10 sub-cluster (`8-3`, `7-3`, `7-4`, `6-4`) is now structurally coherent. The previously-flagged §12 "just-barely-achievable" thin-cushion caveat is retired — the ≥2/5 wrong-op-in-P4-P8 target is now structurally redundant (achievable from HARD/general alone OR HARD+MEDIUM combo OR MEDIUM alone). Downstream: Kevin widens `SUB_TO_TEN_POOL` in `scripts/compositionLint.ts` from 20 to 22 facts (adds `7-3`, `6-4`); Kevin updates `_planner.ts` directive's HARD-band block to mirror §4.1; Kevin re-bakes `sub-to-10.json`. Sequenced AFTER this spec-only PR merges — orchestrator routes.

**Test changes:**

- PR 1: `_planner.test.ts` `sub-to-10` plan composition tests; revised `_firstEncounterGate.test.ts` per-node assertions.
- PR 2: `planFromServer.test.ts` `sub-to-10` parser fixtures including `7 − 0 = 7` and `9 − 0 = 9` (the "zero" entries Devon flagged); `distractors.test.ts` Class-2 wrong-op tests + subtract-self / subtract-zero edge cases.
- Cross-PR (Jessica E2E, dispatch-time pairing per `feedback_progression_e2e_mandatory`): `e2e/sub-to-10-first-encounter.spec.ts` for read-line variant gate. Must pair with PR 1 since PR 1 touches `_firstEncounterGate.ts`.

**Doc changes:**

- `.claude/docs/skill-trees-and-content.md` — Math distractors Class 2 subsection added (post-merge, `maintain-docs` may auto-route).
- `.claude/docs/progress-and-persistence.md` — promotion-gate footnote added.

**Out of both PRs' scope (follow-up):**

- `src/lib/progress/slowFacts.ts` — flat 6000 ms + 5-session warmup for `op === '-'` (§8, decision locked Q2). `_planner.ts:isSlowFactsActive` widening to include `sub-to-10`. Lands once Marian has generated ≥ 10 `sub-to-10` sessions.

---

## 14. Cross-references

- **Dave's research** — `design/research/sub-to-10-fact-sequencing-marian.md` (canonical authority). Read for the full evidence chain.
- **Dave's add-to-10 research** — `design/research/add-to-10-counting-to-recall.md` (Marian's finger-counting profile).
- **Dave's speed-feedback research** — `design/research/speed-feedback-automaticity-marian.md` (verdict: no speed-feedback UI; slow-fact directive is a backend re-targeting tool).
- **Dave's distractor research** — `design/research/math-distractor-and-streak-decisions.md` (gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Precedent content spec** — `design/word-song/digraphs-th-word-list.md` (structural model; cloned section-for-section here).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md`.
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md`.
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md`.
- **Memory: planner-parser contract** — `project_planner_parser_contract.md` (widen parser BEFORE planner — §9.1 enforces).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (Jessica E2E spec required at dispatch time for any progression-state-machine PR).
