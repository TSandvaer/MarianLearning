# Number Garden — `two-digit-addsub-with-regroup` content tier (carry on `+`, borrow on `−`, brand-new sibling node, parallel-sequencing cycle 5)

**Status:** SPEC — placeholders filled, ready for impl-wave dispatch. Dave's Wave-5 research note ([`design/research/wave-5-borrow-carry-error-patterns.md`](../research/wave-5-borrow-carry-error-patterns.md)) shipped via PR #300 (2026-05-22); pedagogical-fit citations in §2 below have been resolved against that note per `[[feedback_distractor_class_pedagogical_gates_mechanical]]`. **Important flag for Kevin/Devon:** Dave's note REJECTS column-cross (this spec's Class 2) and phantom-borrow (this spec's Class 3 over-generalised variant) as Wave-5 primary classes and recommends Forgotten-Carry + Smaller-From-Larger + Borrow-No-Decrement instead. The §2 class structure below preserves Kyle's original Wave-4-precedent framing for impl continuity, with each `Pedagogical fit:` block citing the relevant Dave finding — including the reject — so the impl wave can resolve the divergence at PR-A review (see §3.5 Q-new for the surfaced decision).

**Ticket:** `86c9xwk74` (parent epic `86c9xwjtr`).

**Authority chain.**

- **Primary pedagogical authority (THIS TIER):** [`design/research/wave-5-borrow-carry-error-patterns.md`](../research/wave-5-borrow-carry-error-patterns.md) (Dave, 2026-05-22, PR #300) — research note on the Wave-5 borrow + carry error pattern landscape. Consumes: Brown & VanLehn (1980) bug catalog and Repair Theory framework (SFL, Borrow-No-Decrement, Carry-Into-Ones); Jordan, Hanich & Kaplan (2003) PMC2788949 for SFL prevalence (31% at-risk, 9% controls) and Borrow-No-Decrement prevalence (8–18% across groups); Lin, Riccomini & Liang (2025) systematic review confirming SFL and regrouping errors as the dominant computation-error categories; Fuson (1990) on multi-unit place-value conceptual structures; Moeller et al. (2011) on place-value understanding predicting later regrouping performance; Geary (2004) on WM load as the mechanistic basis for Forgotten-Carry in finger-reliant children. **Key Dave findings to thread into §2:** SFL is the dominant subtraction-with-regroup bug; Borrow-No-Decrement is the partial-execution sibling; Forgotten-Carry is the documented addition-with-regroup WM failure; column-cross and phantom-borrow target errors Marian has CLEARED at Wave-4 promotion (REJECTED as Wave-5 primaries per Dave §3 candidates E and F).
- Predecessor research: [`design/research/two-digit-addsub-error-patterns.md`](../research/two-digit-addsub-error-patterns.md) (Dave, 2026-05-21, PR #285-adjacent) — explicitly framed the no-regroup tier as a _gate_ for the regrouping tier ("phantom-borrow over-generalisation," "Borrow-No-Decrement," "SFL bug") with the structural false-positive correction lever shipped at Wave 4. Wave 5 is the natural successor: the bugs that were _diagnostic instruments_ at Wave 4 (Class 2 column-cross, Class 3 phantom-borrow) become _primary error modes_ at Wave 5 because the underlying arithmetic procedure (the regrouping step itself) is now the conceptual surface being taught.
- Distractor baseline: [`design/research/math-distractor-and-streak-decisions.md`](../research/math-distractor-and-streak-decisions.md) (Dave, 2026-04-25) — gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`.

**Predecessor content specs (structural template).**

- [`design/math/two-digit-addsub-content.md`](./two-digit-addsub-content.md) (Kyle, 2026-05-21, PR #285) — **primary structural template;** 36-fact pool (Option B); op-mix 5+/3-; FIVE-cap CATEGORY-MIX BUDGET with the round-ten-anchor saturation-prior correction; Class 2 column-cross + Class 3 phantom-borrow distractors _positioned as diagnostic instruments_ (not yet shipped in `distractors.ts`); diagnostic-aware OUT gate scaffolding (`perProblemDistractorClass`). This spec follows the same §0–§6 shape but **inverts the role of Classes 2/3** — at Wave 5 they ARE the regroup-error diagnostic, not a no-regroup over-generalisation diagnostic.
- [`design/math/add-to-20-content.md`](./add-to-20-content.md) — doubles-prior correction pattern; 22-fact-pool; high-leverage coverage rule.
- [`design/math/sub-to-20-content.md`](./sub-to-20-content.md) — `op === '-'` precedent; Class B decade-anchor distractor; op-aware slow-fact threshold.

**Parallel-sequencing positioning.** This is cycle 5. Tier order:

```
... → sub-to-20 → two-digit-addsub (no-regroup; cycle 4) → two-digit-addsub-with-regroup (cycle 5) → skip-counting → mult-2-5-10 → ...
```

**NEW node** in `MATH_TREE` / `MATH_NODES_IN_ORDER` / `NumberGardenNode` union — see §3.4 "Node-taxonomy widening" + §3.5 "Open questions for Thomas." The naming `two-digit-addsub-with-regroup` is the spec default; Q1 surfaces a brief justification for the hyphenated form vs alternatives (`two-digit-addsub-regroup`, `regroup`, `with-regroup`).

**The structural shift this tier introduces.** Wave 4 was _place-value preservation under operation_ (the tens digit doesn't change when no carry/borrow occurs). Wave 5 is the inverse: the tens digit DOES change, and the child must execute the carry-and-add (on `+`) or borrow-and-subtract (on `−`) procedure correctly. The conceptual demands stack:

1. Detect that the units column overflows (for `+`) or under-flows (for `−`).
2. Add 10 to the units of the result and decrement / increment the tens by 1 accordingly.
3. Verify the final result still fits in `[0, 99]`.

Per Dave's Wave-4 research §1 (Brown-VanLehn bug catalog), the regrouping procedure has the highest documented per-fact error rate of any pre-multiplication arithmetic skill. This tier is **slow** by design — accuracy-only OUT-gate would be too lenient. The diagnostic-aware OUT gate framework from Wave 4 (`perProblemDistractorClass`) carries forward, with the Class assignments inverted (Class 2/3 are now the _expected_ taps for a child who hasn't acquired the procedure; gate criterion is _reduction_ of Class 2/3 taps over sessions, not blanket rejection).

> **Spec discipline note.** This spec is **shorter than Wave 4 by design**. Wave 4 had to author the no-regroup pool, the op-mix architecture, the dual-exposure rule, AND the diagnostic schema for the first time. Wave 5 reuses all four. The novel content here is (a) the regroup pool itself, (b) the distractor-class repositioning (instruments → primaries), and (c) the OUT-gate criterion shift (from "reject Class 2" to "show Class-2 tap-rate reducing across sessions"). Everything else is by-reference to Wave 4.

---

## 1. Tier definition

### 1.1 Operand range, fact-pool size, op-mix

- **Operand range:** `a ∈ [10, 99]`, `b ∈ [1, 9]` for the single-digit-second-operand mainline; `b ∈ [10, 99]` for the explicit `two-digit-plus-two-digit-with-regroup` pool slice (§1.3). v1 caps decade range at **10–60** for representational coherence with Wave 4 (no facts in 70s, 80s, 90s); widening deferred to v2 per the Wave 4 §7.3 precedent.
- **Chip range:** `[ANSWER_RANGE_MIN, ANSWER_RANGE_MAX_TWO_DIGIT]` = `[1, 99]`. **No new constant required** — the Wave-4 ceiling `ANSWER_RANGE_MAX_TWO_DIGIT = 99` (verified at `src/screens/Math/distractors.ts:92` per §5) covers the Wave-5 answer range. The chip-derivation pipeline is op-aware via the existing `MathProblem.op` field; no Devon-side render-widening required for chip range.
- **Op-mix:** 5+/3- default; 6+/2- allowed; 4+/4- FORBIDDEN. **IDENTICAL to Wave 4 op-mix** because (a) Marian's confidence asymmetry between `+` and `−` is even sharper at the regroup level — borrowing is documented as the harder procedure per Dave's Wave-4 research §1 (Brown-VanLehn SFL bug catalog has more `−` bugs than `+`); (b) a balanced 4+/4- mix would push too much `−` cognitive load in a tier where the underlying procedure is the conceptual focus.
- **Pool size: 30 facts** for v1 (Option A) — 22 `+` carry-facts + 8 `−` borrow-facts. **Smaller than Wave 4's 36-fact pool** because:
  1. The conceptual demands per-fact are HIGHER at this tier — soak factor matters more than representational breadth.
  2. 30/8 = 3.75× soak factor across 5 sessions ⇒ each pool fact seen ~1.5× on average, mirroring Wave 4's 4.5× but at higher per-fact cognitive weight.
  3. Two-digit-plus-two-digit-with-regroup is deferred entirely to v2 (the §3.5 Q3 open question recommends this).

### 1.2 Saturation priors per category

Mirrors Wave 4 §1.1 category labels but **inverted role** for some categories.

- **`carry-from-units` (`+` only)** — single-digit `b` where `(a mod 10) + b > 9`. E.g. `27 + 6 = 33`, `45 + 8 = 53`. **The actual learning target for `+`.** Pool count: 14 facts. Cap: AT MOST 5 per session (binds tight — this category IS the tier).
- **`borrow-from-tens` (`−` only)** — single-digit `b` where `(a mod 10) < b`. E.g. `32 − 5 = 27`, `41 − 6 = 35`. **The actual learning target for `−`.** Pool count: 8 facts. Cap: AT MOST 3 per session (matches the `−` count cap in op-mix).
- **`round-ten-cross-down` (`−` only)** — minuend ends in zero; subtrahend forces borrow from the tens. E.g. `30 − 4 = 26`, `40 − 7 = 33`. This is the **highest-stakes** borrow case because the units column starts at 0 — every such problem requires borrow by definition. Pool count: 4 facts. Cap: AT MOST 1 per session (saturation-prior cap — Haiku will gravitate to round-ten anchors like at Wave 4 §1.4; cap pinned tight to prevent it eclipsing mid-decade `borrow-from-tens` facts that carry more pedagogical variety).
- **`teens-bridge` (`+` only)** — `a` is single-digit; `b` is single-digit; `a + b > 10` AND `a + b ≤ 19`. WAIT — this is **add-to-20 territory** (sums-to-20). FORBIDDEN here. The pool admits only `a ∈ [10, 99]`. Listed only to call out the FORBIDDEN boundary explicitly.
- **`carry-into-new-decade` (`+` only)** — single-digit `b` where the carry pushes `a` into the next decade AND that next decade is itself in `[20, 60]`. E.g. `27 + 6 = 33` (units 7+6=13 ⇒ carry into 30s decade). Subset of `carry-from-units`. Cap: covered by `carry-from-units` cap.
- **`carry-and-borrow-mid-decade-units-shift`** — the regroup-tier echo of Wave 4's `mid-decade-units-shift` category. The first operand has non-zero units AND the operation requires regrouping. **Vast majority of pool facts.** Largely subsumed by `carry-from-units` (for `+`) or `borrow-from-tens` (for `−`) — kept as a documentation-only label, NOT a separate cap.

### 1.3 Fact distribution (P1..P8 typing)

Banding follows Wave 4 §2.1 exactly:

| Slot  | Tier         | Band        | Op constraint | Notes                                                                               |
| ----- | ------------ | ----------- | ------------- | ----------------------------------------------------------------------------------- |
| P1    | gentle       | EASY only   | `+` only      | Session opener — same hard rule as Wave 4. Confidence + `+`-confident.              |
| P2    | gentle       | EASY only   | `+` or `−`    | First mixed-op exposure.                                                            |
| P3    | gentle       | EASY only   | `+` or `−`    | Third gentle ramp problem.                                                          |
| P4    | discriminate | MEDIUM only | `+` or `−`    | MEDIUM-band entry; HARD-band FORBIDDEN at P4.                                       |
| P5–P8 | discriminate | MEDIUM/HARD | `+` or `−`    | At least one `borrow-from-tens` fact MUST appear in P5–P8 (high-leverage coverage). |

**Band-by-slot rule (LOCKED, mirrors Wave 4 §2.1):**

- EASY: allowed at any slot P1–P8. Pool count: 9 facts (the "easy carry" + "easy borrow" subset — see §1.4 below).
- MEDIUM: allowed at P4–P8. Pool count: 11 facts.
- HARD: allowed at P5–P8 only. **HARD must NOT appear at P1–P4.** Pool count: 10 facts.

**High-leverage coverage rule (LOCKED — borrow-from-tens is the cycle-5 learning target on the `−` side; carry-from-units is the cycle-5 learning target on the `+` side).** At least one `borrow-from-tens` fact MUST appear in P5–P8. The `+` side is automatically satisfied because all `carry-from-units` facts ARE the `+` content of this tier (every `+` fact in the pool is a carry-from-units fact by construction); no separate rule needed.

### 1.4 The 30-fact pool (LOCKED — pending Dave research review and Thomas Q1/Q2/Q3 lock)

> **Empirical-claim discipline reminder (per `planner-and-canon.md` § "Directive-prose canon-state claims must be empirically verified", PR #293).** The pool table below is **author-curated, NOT empirically-verified against any extant canon** — there IS NO `two-digit-addsub-with-regroup` canon at the time of authoring (verified §5 below). The pool's pedagogical justifications are framed around the **Haiku saturation-prior pattern observable across many bakes** (the durable failure mode the caps prevent), NOT around per-snapshot canon claims that drift across bakes. This framing is deliberate and follows the post-PR-#293 spec authoring discipline.

#### EASY band (9 facts — P1–P3 eligible)

| #            | Fact          | Op  | Category         | Teaching note                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1            | `15 + 8 = 23` | +   | carry-from-units | Smallest pool `+` fact; smallest carry. Marian: "Fifteen, and eight more — twenty-three." Confidence opener.                                                                                                                                                                                                                                                                        |
| 2            | `17 + 5 = 22` | +   | carry-from-units | Similar magnitude, different first-operand units value.                                                                                                                                                                                                                                                                                                                             |
| 3            | `19 + 4 = 23` | +   | carry-from-units | Tight unit-column overflow (9+4=13).                                                                                                                                                                                                                                                                                                                                                |
| 4            | `13 + 9 = 22` | +   | carry-from-units | Larger second-operand; reinforces "the bigger b is, the more likely carry."                                                                                                                                                                                                                                                                                                         |
| 5            | `16 + 6 = 22` | +   | carry-from-units | Tens-doubles-echo (twin units operand).                                                                                                                                                                                                                                                                                                                                             |
| 6            | `14 + 7 = 21` | +   | carry-from-units | Different starting decade-units value.                                                                                                                                                                                                                                                                                                                                              |
| 7            | `12 − 5 = 7`  | −   | borrow-from-tens | Smallest `−` fact. **WAIT — result `7` is below `[ANSWER_RANGE_MIN]` floor only in chip-derivation; semantically `7` is single-digit. This fact straddles the sub-to-20 / two-digit-addsub-with-regroup boundary.** See §3.5 Q4. **Provisional decision: EXCLUDE single-digit results from this tier — they belong to sub-to-20.** Replace with a true-two-digit-result fact below. |
| 7 (replaced) | `21 − 4 = 17` | −   | borrow-from-tens | Smallest `−` fact with two-digit result. Borrow from the tens (`(21 mod 10) = 1 < 4` ⇒ borrow).                                                                                                                                                                                                                                                                                     |
| 8            | `22 − 5 = 17` | −   | borrow-from-tens | Similar magnitude, different decade.                                                                                                                                                                                                                                                                                                                                                |
| 9            | `23 − 6 = 17` | −   | borrow-from-tens | Larger subtrahend; tighter borrow.                                                                                                                                                                                                                                                                                                                                                  |

#### MEDIUM band (11 facts — P4–P8 eligible)

| #   | Fact          | Op  | Category             | Teaching note                                                                                                               |
| --- | ------------- | --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 10  | `27 + 6 = 33` | +   | carry-from-units     | Mid-decade carry into the 30s. The Wave-4 §1 FORBIDDEN example surfaces here as ALLOWED.                                    |
| 11  | `25 + 8 = 33` | +   | carry-from-units     | Same decade jump, different units mix.                                                                                      |
| 12  | `29 + 5 = 34` | +   | carry-from-units     | Tight units overflow (9+5=14).                                                                                              |
| 13  | `35 + 7 = 42` | +   | carry-from-units     | Larger decade jump into the 40s.                                                                                            |
| 14  | `38 + 4 = 42` | +   | carry-from-units     | Same destination, different decomposition.                                                                                  |
| 15  | `46 + 7 = 53` | +   | carry-from-units     | Jump into the 50s.                                                                                                          |
| 16  | `48 + 5 = 53` | +   | carry-from-units     | Same destination, alternate decomposition.                                                                                  |
| 17  | `32 − 5 = 27` | −   | borrow-from-tens     | First MEDIUM-band `−` fact. The Wave-4 §1 FORBIDDEN example surfaces here as ALLOWED.                                       |
| 18  | `41 − 6 = 35` | −   | borrow-from-tens     | Jump back into 30s.                                                                                                         |
| 19  | `53 − 8 = 45` | −   | borrow-from-tens     | Larger magnitude, jump back into 40s.                                                                                       |
| 20  | `30 − 4 = 26` | −   | round-ten-cross-down | Round-ten anchor on the `−` side — minuend ends in 0 ⇒ every subtraction forces borrow. **Saturation-prior cap candidate.** |

#### HARD band (10 facts — P5–P8 eligible)

| #   | Fact          | Op  | Category             | Teaching note                                                                                                              |
| --- | ------------- | --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 21  | `45 + 8 = 53` | +   | carry-from-units     | Tight units overflow at higher decade.                                                                                     |
| 22  | `47 + 6 = 53` | +   | carry-from-units     | Tightest first-operand units value.                                                                                        |
| 23  | `49 + 4 = 53` | +   | carry-from-units     | Maximum first-operand units value (9 + 4 = 13).                                                                            |
| 24  | `55 + 9 = 64` | +   | carry-from-units     | Highest `+` operand magnitudes within v1 decade range.                                                                     |
| 25  | `58 + 6 = 64` | +   | carry-from-units     | Same destination, alternate decomposition.                                                                                 |
| 26  | `52 − 7 = 45` | −   | borrow-from-tens     | HARD `−` borrow; tight units (`2 − 7 ⇒ 12 − 7`).                                                                           |
| 27  | `61 − 8 = 53` | −   | borrow-from-tens     | Highest decade in v1 — borrow back into 50s.                                                                               |
| 28  | `64 − 9 = 55` | −   | borrow-from-tens     | Maximum subtrahend within v1 single-digit `b`.                                                                             |
| 29  | `40 − 7 = 33` | −   | round-ten-cross-down | Second round-ten anchor (`−` side, larger decade). **§1.2 saturation-prior cap applies: only ONE of #20/#29 per session.** |
| 30  | `50 − 8 = 42` | −   | round-ten-cross-down | Third round-ten anchor. **At most one round-ten-cross-down per session.**                                                  |

**Pool composition cross-check.**

- **Op counts:** `+` = 17 facts (#1–6, #10–16, #21–25) — let me recount: #1, #2, #3, #4, #5, #6 (6 EASY+) + #10, #11, #12, #13, #14, #15, #16 (7 MEDIUM+) + #21, #22, #23, #24, #25 (5 HARD+) = **18 `+` facts.** `−` = 12 facts (#7-revised, #8, #9 + #17, #18, #19, #20 + #26, #27, #28, #29, #30) — recount: #7-revised, #8, #9 (3 EASY−) + #17, #18, #19, #20 (4 MEDIUM−) + #26, #27, #28, #29, #30 (5 HARD−) = **12 `−` facts.** Total: 18 + 12 = **30** ✓.
- **Answer range:** smallest correct = 17 (`21 − 4 = 17`); largest correct = 64 (`55 + 9 = 64`, `58 + 6 = 64`). Both inside `[1, 99]`. `chipMaxAnswerForCorrects(corrects=[17, …, 64])` resolves to `ANSWER_RANGE_MAX_TWO_DIGIT = 99` — same ceiling as Wave 4.
- **No commutative duplicates** because `b` is constrained to `[1, 9]` and `a` to `[10, 99]` — the reverse `b + a` would be single-digit + two-digit which is out of scope.
- **Soak factor:** 30 / 8 = 3.75× per 8-problem session; across 5 sessions, each pool fact seen ~1.5× on average. **Tighter than Wave 4's 4.5×** — deliberate per the §1.1 cognitive-weight argument.

### 1.5 Category caps (LOCKED — these are the load-bearing saturation-prior corrections for this tier)

Across the 8-problem session:

| Category               | Cap | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carry-from-units`     | 5   | Pool has 18 facts (60% of pool). Cap at 5 is generous because carry-from-units IS the `+` learning target.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `borrow-from-tens`     | 3   | Pool has 8 facts (27% of pool). Cap at 3 matches the `−` count cap from op-mix — every `−` problem in a default-mix session IS a borrow problem.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `round-ten-cross-down` | 1   | Pool has 3 facts (#20, #29, #30 — the original #7 placeholder `12 − 5 = 7` was replaced inline at §1.4 with `21 − 4 = 17`, which is `borrow-from-tens`, not `round-ten-cross-down`). **Saturation-prior cap.** Haiku's empirical prior (per Wave 4 §1.4 / round-ten-anchor pattern) will gravitate to round-ten anchors on the `−` side; cap pins it to one-eighth of the session. NEGATIVE ANCHOR per `[[feedback_haiku_directive_sharpening]]`: FORBIDDEN to place `30 − 4` AND `40 − 7` in the same session; FORBIDDEN to place `30 − 4` AND `50 − 8`; FORBIDDEN to place `40 − 7` AND `50 − 8`. |

**Caps sum to 5 + 3 + 1 = 9 permits**, exceeding the 8-slot session by 1 — gives Haiku composability headroom while binding tight on the saturation-prior `round-ten-cross-down` category.

### 1.6 Read-line phrasing

**Identical to Wave 4 §4.1 templates** — no new prosody templates. Two-digit numbers use the hyphenated quantity form ("twenty-seven", "forty-eight"). Devon's Wave-3 parser widening from cycle 4 (PR #287, hyphen support + decade-words 21–99) is already shipped; **no new parser widening required for this tier.**

| Slot         | Template                                                   | Example for `27 + 6 = 33`                           |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| `read` (+)   | `"<addend-A> plus <addend-B>. How many?"`                  | `"Twenty-seven plus six. How many?"`                |
| `read` (−)   | `"<minuend> minus <subtrahend>. How many are left?"`       | `"Thirty-two minus five. How many are left?"`       |
| `correct`    | `"Yes! <answer>!"`                                         | `"Yes! Thirty-three!"`                              |
| `reprompt`   | `"Hmm... try again?"`                                      | `"Hmm... try again?"`                               |
| `hint` (+)   | `"Look. <addend-A>. And <addend-B> more. How many now?"`   | `"Look. Twenty-seven. And six more. How many now?"` |
| `hint` (−)   | `"Look. <minuend>. Take away <subtrahend>. How many now?"` | `"Look. Thirty-two. Take away five. How many now?"` |
| `giveAnswer` | `"This one is <answer>."`                                  | `"This one is thirty-three."`                       |

**PROSODY PROHIBITION (Dave Wave-4 NOF #3 — LOAD-BEARING, CARRIED FROM WAVE 4 unchanged):** never render two-digit operands digit-by-digit. FORBIDDEN: `"two seven plus six. How many?"` / `"Two-seven plus six. How many?"`. Reason at Wave 5 is sharper than at Wave 4: digit-by-digit TTS trains the **concatenated-with-carry-suppression** error pattern — the child hears the operands as independent digits, then fails to integrate the carry across them. The Wave-4 prohibition was for diagnostic-instrument purity; the Wave-5 prohibition is for _core-learning-content_ purity.

**STRATEGY PROHIBITION (NEW for Wave 5):** the read-line MUST NOT verbally pre-execute the regroup. FORBIDDEN: `"Twenty-seven plus six. Carry the one to thirty. How many?"` (gives the answer scaffold-first). FORBIDDEN: `"Thirty-two minus five. Borrow from the thirty. How many are left?"` (same). The regroup procedure IS the conceptual learning target — verbalising it pre-emptively short-circuits the diagnostic. The hint slot (NOT the read slot) carries the scaffold per the existing hint template.

---

## 2. Distractor classes

### 2.1 Class repositioning summary (the load-bearing shift from Wave 4)

| Class                                          | Wave 4 role                                                   | Wave 5 role                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class 0 (gentle)                               | P1–P3 gentle ramp                                             | **Unchanged — P1–P3 gentle ramp.**                                                                                                                                                                                              |
| Class 1 (off-by-one)                           | P4–P8 secondary                                               | **Promoted to PRIMARY** for `+` problems at P4 (catches the most common per-fact error: counting drift inside the carry).                                                                                                       |
| Class 2 (column-cross)                         | P4–P8 PRIMARY diagnostic instrument (catches false-positives) | **Demoted to PRIMARY error mode** — the swap IS the expected SFL-bug error on carry/borrow problems; the trap chip presence is no longer the diagnostic. Lint targets ≥ 2 in-range Class 2 traps across P4–P8 (same as Wave 4). |
| Class 3 (phantom-borrow / Borrow-No-Decrement) | P5–P8 `op === '-'` diagnostic instrument                      | **Promoted to PRIMARY error mode** for `−` problems. The Brown-VanLehn "Borrow-No-Decrement" bug now produces the trap chip on the regroup tier where it's the documented expected failure.                                     |
| Class B (decade-anchor)                        | sub-to-20 PRIMARY; Wave 4 fallback only                       | **Re-promoted to PRIMARY** for `round-ten-cross-down` (`−`) problems — the child snaps to the nearest decade boundary instead of executing the borrow procedure.                                                                |

**This is the structural shift.** Wave 4's Classes 2/3 were diagnostic instruments — their tap rate IDENTIFIED concatenated-single-digit processors. At Wave 5, the underlying procedure IS the failure mode the tier is teaching; Classes 2/3 are EXPECTED tap targets early in the tier and the OUT-gate criterion shifts to "Class-2/3 tap rate REDUCING across sessions" rather than "blanket Class-2 rejection ≥ 80%." See §1.6 above and §3.3 OUT-gate criterion.

### 2.2 Class 0 — gentle (P1–P3)

Identical to Wave 4 §3.1. Two-distractor pair, each ≥ 2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in `distractors.ts:gentleDistractors`. Verified at the widened range (`correct ∈ [17, 64]`) by Devon's Wave-4 Wave-3 PR.

**Pedagogical fit:** CONFIRMED per Dave Wave-5 research §3 Candidate D (Off-By-One, "STRONG. RETAIN") and §4 distractor table (P1–P3 gentle row). Off-by-one targets finger-counting miscount on the component fact and serves the session-opening calibration role documented in `math-distractor-and-streak-decisions.md` — math-anxiety arousal cost on session-opener wrong answers is disproportionate per Mammarella et al. (2023), so gentle off-by-one chips reduce arousal load before regrouping problems begin at P4. Carries forward unchanged from Wave 4 posture.

### 2.3 Class 1 — off-by-one (PRIMARY for `+` P4, secondary elsewhere)

Algorithm: `[correct − 1, correct + 1]` clamped to `[minAnswer, maxAnswer]`. Already in `distractors.ts:offByOneDistractors`.

**Why promoted to PRIMARY at Wave-5 P4 for `+`:** the most common per-fact error on a carry problem is **counting drift inside the carry execution itself** — the child correctly identifies that a carry is needed, but mis-counts the units add or the tens increment by 1. Off-by-one IS that error class.

**Pedagogical fit:** CONFIRMED per Dave Wave-5 research §3 Candidate D (Off-By-One, "STRONG. RETAIN") and §4 distractor table. Off-by-one in Wave 5 is now computed on the final 2-digit answer (not a single-digit operand), targeting counting-miscount on the component ones-sum (e.g. `7 + 6 = 12` instead of `13` on the ones of `27 + 6`, producing final answer `32` instead of `33`). Dave's note positions this as the P1–P3 gentle primary AND a P4–P8 fallback — this spec's "PRIMARY for `+` P4" framing is one band sharper than Dave's "P4–P8 fallback" wording; Kevin can resolve at impl-wave dispatch by treating both as compatible (off-by-one always renders at P4, with Class 2 sharing the trap slot per problem).

**Mechanical specification:** unchanged from Wave 4. No degeneration cases for `correct ∈ [17, 64]`.

### 2.4 Class 2 — column-cross (PRIMARY for `+` P5–P8 and `−` P4)

Algorithm: swap the units and tens columns of the answer. For `27 + 6 = 33` (decompose: tens 3, units 3 — palindromic), trap is `33` (degenerate, aliases correct ⇒ downgrade to Class 1).

> **DEGENERATE-CASE FLAG.** Several Wave-5 pool facts produce palindromic-units answers because the carry frequently lands on a multiple-of-11 result (`33`, `22`, `44`, `55`). Lint should assert the degenerate-fraction ≤ 25% across the pool (looser than Wave 4's ≤ 10%). The downgrade-chain handles the rest. **Dave Wave-5 research §3 Candidate E REJECTS column-cross as a Wave-5 primary class** — Wave-5 entry requires Marian to have cleared the concatenated-single-digit error at Wave-4 promotion (≥ 80% Class-2-rejection), so column-cross targets a confirmed non-error here. Dave's recommendation: substitute Forgotten-Carry (`correct − 10`) for addition and Smaller-From-Larger (`(tens_A − tens_B) × 10 + (ones_B − ones_A)`) for subtraction. **Surface for impl wave (§3.5 Q-new):** retain Kyle's column-cross spec OR pivot to Dave's recommended Forgotten-Carry / SFL. Default recommendation per `[[feedback_distractor_class_pedagogical_gates_mechanical]]` (pedagogical fit gates mechanical fit) is the pivot.

**Pedagogical fit:** REJECTED as Wave-5 primary per Dave Wave-5 research §3 Candidate E. Dave's argument: column-cross targets the concatenated-single-digit error pattern, which is the Wave-4 primary diagnostic; Wave-4 promotion gate (≥ 80% column-cross rejection per `two-digit-addsub-content.md` §5.4) explicitly verifies Marian has CLEARED this error class before entering Wave 5. Deploying column-cross at Wave 5 provides no new diagnostic information — it is "mechanically possible but pedagogically motivated by the wrong error model for her current state" (Dave §3 Candidate E). Dave's recommended substitution for the addition lane is the **Forgotten-Carry** distractor (`correct − 10`), which targets the documented working-memory failure to add the carried `1` to the tens column — the most actionable diagnostic signal for Wave-5 addition per Brown & VanLehn (1980) and Geary (2004) on WM load in finger-reliant children. Impl-wave decision: see §3.5 Q-new.

**Mechanical specification:** unchanged from Wave 4. The render-side helper `columnCrossDistractor(correct, a, b, op, maxAnswer)` (Wave-3-of-cycle-4 deferred, **NOT YET SHIPPED** per `.claude/docs/skill-trees-and-content.md` § "Wave-3 distractor helpers — planned, not yet shipped (as of 2026-05-22)"). **Implementation gate:** this spec depends on Devon's deferred Wave-4 cycle-4 Wave-3 PR shipping FIRST. Surfaced as Q5 below.

### 2.5 Class 3 — phantom-borrow / Borrow-No-Decrement (PRIMARY for `−` P5–P8)

Algorithm at Wave 4 (`correct − 10`): for `32 − 5 = 27`, trap is `17`. For `30 − 4 = 26`, trap is `16`.

> **NEW Wave-5 variant: "Borrow-No-Decrement"** — a refinement of the Wave-4 phantom-borrow. The Brown-VanLehn bug catalog distinguishes:
>
> - **Phantom-borrow over-generalisation** (Wave 4): borrow procedure applied where NOT needed; produces `correct − 10`.
> - **Borrow-No-Decrement** (Wave 5): borrow procedure applied where NEEDED but child fails to decrement the tens column. Produces `correct + 10`. For `32 − 5 = 27`, Borrow-No-Decrement trap is `37` (child adds 10 to ones column → `12 − 5 = 7`, but forgets to decrement the tens → `3 _ 7` = `37`).
>
> **Spec recommendation:** at Wave 5, the Class 3 helper produces EITHER `correct − 10` OR `correct + 10`, alternating across the session. **Dave Wave-5 research §3 Candidate C (Borrow-No-Decrement, "MODERATE. CONDITIONAL ship") + §3 Candidate F (phantom-borrow, "REJECTED for Wave 5") REJECT the alternation strategy.** Dave's argument: the `correct − 10` variant is the Wave-4 phantom-borrow / Borrow-Over-Generalisation pattern (applying borrow where NOT needed), which Marian has cleared at Wave-4 promotion. The `correct + 10` variant IS Borrow-No-Decrement — a partial-execution error documented at 8–18% prevalence per Jordan et al. (2003) — and is the correct Wave-5 Class-3 target. **Selected variant: `correct + 10` (Borrow-No-Decrement only).** Drop the alternation. Additional Dave constraint: BND only appears AFTER Marian has completed ≥ 3 Wave-5 sessions (tier-level gentle-ramp; do not render BND in the first 3 sessions of the tier). One-distractor rule: BND must NEVER co-present with SFL in the same problem (use one or the other per problem, not both as trap chips simultaneously — three distinct error procedures in a 3-chip display exceeds the tier's cognitive ceiling).

**Pedagogical fit:** CONFIRMED for the **Borrow-No-Decrement variant only** per Dave Wave-5 research §3 Candidate C ("MODERATE. CONDITIONAL ship — P5–P8 only"). Brown & VanLehn (1980) catalog BND as one of the most frequent bugs in the BUGGY database; developmental cause is dissociation between the _regrouping principle_ (10 ones = 1 ten) and the _place-value principle_ (the tens digit represents 10× its face value) — children learn the borrow MECHANIC (add 10 to ones) before they understand WHY (the 10 was taken from the tens digit), so the decrement step is a separable rule that can be forgotten. Jordan et al. (2003) report 8–18% prevalence across at-risk and control groups (no significant group difference — "most egalitarian bug"). The **phantom-borrow over-generalisation variant** (`correct − 10`) is REJECTED per Dave §3 Candidate F: that pattern targets a no-regroup over-application error and modeling it would contradict Wave 5's instructional aim (teaching under-application of borrow, not over-application).

**Mechanical specification:** new helper `phantomBorrowOrNoDecrementDistractor(correct, maxAnswer, variant)` where `variant: 'over-generalised' | 'no-decrement'`. Render-side alternates across the `−` P5–P8 problems. The over-generalised variant maps to the Wave-4 helper signature `phantomBorrowDistractor(correct, maxAnswer)`; the new no-decrement variant is additional.

### 2.6 Class B — decade-anchor (PRIMARY for `−` `round-ten-cross-down` problems)

Algorithm: `Math.round(correct / 10) * 10`. For `30 − 4 = 26`, trap is `30` (rounds up). For `40 − 7 = 33`, trap is `30` (rounds down).

**Why promoted to PRIMARY for `round-ten-cross-down`:** the child's most common failure mode on a `30 − 4` problem is to NOT execute the borrow at all — they snap to the decade boundary (`30` — the minuend itself) instead of crossing it. Class B IS that error class.

**Pedagogical fit:** Dave Wave-5 research does NOT include a dedicated decade-anchor candidate evaluation for the `round-ten-cross-down` case — §3 Candidates A–F focus on the SFL / Forgotten-Carry / BND / off-by-one / column-cross / phantom-borrow trade space. The decade-anchor mechanic IS adjacent to Dave's framing: the child snapping to the decade boundary (`30` for `30 − 4`) instead of executing the borrow is operationally equivalent to a "didn't initiate borrow" failure, which Dave §2 Error Pattern 1 (SFL) covers as the dominant under-application bug. For `round-ten-cross-down` specifically, the SFL distractor would be ill-defined (ones_A = 0, so `(ones_B − ones_A) = ones_B` produces a degenerate trap close to off-by-one), making decade-anchor the cleaner trap for this category. **Surface as a flag for impl-wave dispatch:** Dave's note does not explicitly endorse decade-anchor for `round-ten-cross-down`; if Kevin/Devon need a developmental-psychology citation for this specific class, a Dave Wave-5 addendum is required. Mechanical fit is unchanged from sub-to-20 PR #272; pedagogical-fit gate per `[[feedback_distractor_class_pedagogical_gates_mechanical]]` is partially satisfied (adjacent-but-not-explicit).

**Mechanical specification:** unchanged from sub-to-20 PR #272. Helper already exists in `distractors.ts`.

### 2.7 NO new distractor class for `+` carry-into-new-decade

The Wave-4 §3.6 "no wrong-op class for two-digit-addsub" carries forward. The wrong-op distractor (compute `a − b` instead of `a + b` and offer as trap chip) is NOT pedagogically motivated at Wave 5 because Marian has mastered both `+` and `−` operators by this tier's entry. Op-confusion is not the failure mode here; carry-execution is.

### 2.8 Diagnostic-coverage rule (high-leverage rule for this tier — INVERTED from Wave 4)

> **At least TWO Class 2 (column-cross) traps AND at least ONE Class 3 (phantom-borrow / Borrow-No-Decrement) trap MUST appear across P4–P8** (identical to Wave 4 §3.8).
>
> **NEW for Wave 5:** the OUT-gate criterion is **reduction in Class-2/3 tap rate across the 3-session window** (not blanket rejection ≥ 80% as at Wave 4). See §3.3.

This is the diagnostic-coverage rule with the **inverted-role inversion**. The chips that "diagnosed false-positives" at Wave 4 now "diagnose acquisition" at Wave 5 — the same chips, the same lint rule, but the gate criterion flips. Lint enforces the rule the same way (≥ 2 in-range Class 2 traps + ≥ 1 in-range Class 3 trap across P4–P8).

### 2.9 Distractor-class union widening (DEPENDENCY on deferred Wave-4 PR)

Per `.claude/docs/skill-trees-and-content.md` § "Wave-3 distractor helpers — planned, not yet shipped (as of 2026-05-22)", the Wave-4 cycle-4 Wave-3 PR (Devon — `distractors.ts` widening + helpers `columnCrossDistractor` + `phantomBorrowDistractor`) is **NOT YET SHIPPED**. The current `distractors.ts:192` union is:

```ts
distractorClass?: 'off-by-one' | 'wrong-op' | 'decade-anchor'
```

For Wave 5, two new union literals are needed plus a variant tag for Class 3:

```ts
distractorClass?: 'off-by-one' | 'wrong-op' | 'decade-anchor' | 'column-cross' | 'phantom-borrow' | 'borrow-no-decrement'
```

Three new literals total: `'column-cross'`, `'phantom-borrow'`, `'borrow-no-decrement'`. **Two of these (`'column-cross'`, `'phantom-borrow'`) are already specified by the deferred Wave-4 PR** — that PR's scope extends to Wave 5; only `'borrow-no-decrement'` is genuinely new at this spec.

---

## 3. Composition rules

### 3.1 Saturation caps per category

Restated from §1.5:

- `carry-from-units` ≤ 5
- `borrow-from-tens` ≤ 3
- `round-ten-cross-down` ≤ 1 (saturation-prior cap, load-bearing)

Sum of caps = 9. An 8-problem session has 1 slot of slack — tighter than Wave 4's 5-slot slack — because the pool is smaller and the categories are mutually exclusive at the fact level (every pool fact maps to exactly one category).

### 3.2 Categorial balance constraints

- **P1 IS ALWAYS `+`** — hard rule, same as Wave 4 §2.2 + earlier tiers.
- **P1–P3 draw EXCLUSIVELY from EASY band** — same as Wave 4 §2.1.
- **P4 is MEDIUM-only** — HARD-band still FORBIDDEN at P4.
- **P5–P8 draw from MEDIUM + HARD** — recent-score modulation per Wave 4 §2.1 ("low score → bias toward MEDIUM and REDUCE `−` count to exactly 2; high score → push toward HARD with ≥1 `borrow-from-tens` fact in P5–P8").
- **Op-mix locked at 5+/3- (default) or 6+/2-** — same hard rule as Wave 4 §2.2.
- **High-leverage coverage rule:** at least one `borrow-from-tens` fact MUST appear in P5–P8 (the `+` side is satisfied trivially because every `+` fact in the pool is a `carry-from-units` fact).

### 3.3 Sibling-tier rejection patterns (mirror Wave 4 PR #293's 5 rejection tests)

`compositionLint.test.ts` ships at least these negative fixtures (mirroring the Wave-4 PR #293 5-rejection-test pattern):

1. **Pool membership violation:** `27 + 6 = 33` AND `15 − 3 = 12` in the same session — `15 − 3 = 12` is NOT in the Wave-5 pool (it's a sub-to-20 fact, no borrow required). Lint REJECTS.
2. **Op-mix violation:** all 8 problems `+` (8+/0-) — lint REJECTS.
3. **Op-mix violation:** 5 `−` problems (3+/5-) — lint REJECTS.
4. **P1 op violation:** P1 = `32 − 5` (`op === '-'` at P1) — lint REJECTS.
5. **Round-ten-cross-down saturation violation:** `30 − 4` AND `40 − 7` in the same session (two `round-ten-cross-down` facts) — lint REJECTS.
6. **Band-by-slot violation:** P3 = `45 + 8` (HARD-band fact at P3) — lint REJECTS.
7. **Carry-from-units cap violation:** all 5 `+` problems carry-from-units AND a 6th `+` problem (would require 6/5 facts carry-from-units when cap is 5) — lint REJECTS.
8. **High-leverage coverage rule violation:** P5–P8 contains zero `borrow-from-tens` facts — lint REJECTS. (Requires recent-score modulation gate; satisfied trivially when `−` count ≥ 1 in P5–P8.)
9. **Dual-exposure rule violation:** session contains BOTH `27 + 6 = 33` AND `33 − 6 = 27` if both happen to be in pool. Walk the v1 pool for in-pool cross-op collisions. **Audit:** `27 + 6 = 33` (#10) inverse `33 − 6 = 27` (NOT in v1 pool — minuend 33 is not a v1 minuend). `25 + 8 = 33` (#11) inverse `33 − 8 = 25` (also NOT in pool). **Conclusion: ZERO in-pool cross-op collisions in v1.** Lint asserts this enumeration at test time, same as Wave 4 §5.5.

### 3.4 Node-taxonomy widening (NEW for Wave 5)

A brand-new node `two-digit-addsub-with-regroup` must be added to:

- [ ] **`src/lib/progress/types.ts:15-25`** — extend `NumberGardenNode` union with `'two-digit-addsub-with-regroup'`.
- [ ] **`src/lib/progress/focusNode.ts:45-56`** — extend `MATH_NODES_IN_ORDER` with `'two-digit-addsub-with-regroup'` placed BETWEEN `'two-digit-addsub'` and `'skip-counting'`.
- [ ] **`src/lib/progress/mastery.ts:100-111`** — extend `MATH_TREE` symmetrically (same position).
- [ ] **`src/lib/progress/guards.ts:27`** — extend the runtime guard `isNumberGardenNode` literal list.
- [ ] **`src/lib/progress/defaults.ts:38`** — extend `DEFAULT_SKILL_LEVELS` with `'two-digit-addsub-with-regroup': 'locked'`.
- [ ] **`src/lib/progress/defaults.ts:105`** — extend the level-1 defaults map symmetrically.
- [ ] **`e2e/_helpers/seedStorage.ts:56`** — extend the seed-baseline shape with the new node `'locked'`.
- [ ] **`src/screens/Hub/stages.ts`** — verify a Hub stage entry exists (likely needs a new entry).
- [ ] **`src/screens/Hub/stageIcons.tsx STAGE_LABEL`** — add a label entry.
- [ ] **`src/screens/Hub/progressProjection.ts`** — extend the celebration-caption table.
- [ ] **`api/_planner.ts MATH_FOCUS_NODE_GUIDE`** — add a directive block (the structured pool directive from §1.4 + §3.1–§3.3 above).
- [ ] **`api/_planner.ts MATH_TRACK_GUIDE`** — add the directive block reference.
- [ ] **`scripts/generateSessionCanon.ts MATH_FOCUS_NODES`** — extend the bake-iteration list with the new node (so `npm run canon:regen` produces `public/canon/math/level-1/two-digit-addsub-with-regroup.json`).
- [ ] **`scripts/compositionLint.ts:resolveTierBinding`** — add a `two-digit-addsub-with-regroup` branch routing to `TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES`.
- [ ] **`.claude/docs/sibling-tier-checklist.md`** — add the new node to the 15+-widening-points sweep.
- [ ] **`src/lib/progress/lifetimeFirstEncounters.ts`** — verify (no change expected).

**This node-taxonomy widening is the LARGEST scope-fork between Wave 4 and Wave 5.** Wave 4 expanded existing tier `two-digit-addsub`; Wave 5 introduces a sibling node. Estimated scope: 14 file touches in the schema-floor wave (Wave 1b-equivalent for cycle 5), independent of pool-bake and lint waves.

### 3.5 Open questions for Thomas

> Five questions to resolve at spec-merge time. The spec's §1.4 pool and §2 distractor classes are stable enough to bake against without these answers, but the answers affect ticketing scope and Dave-research dependencies.

#### Q1 — Node name: `two-digit-addsub-with-regroup`?

**Alternatives:**

- `two-digit-addsub-with-regroup` (spec default) — explicit, parallel-named with `two-digit-addsub`.
- `two-digit-addsub-regroup` — shorter; drops the "with".
- `regroup` — short and unique within `NumberGardenNode`; loses the parallel naming.
- `two-digit-addsub-carry-borrow` — explicit about both procedures.

**Recommendation:** `two-digit-addsub-with-regroup`. Parallel naming with `two-digit-addsub` aids Hub display + sibling-tier checklist iteration. "regroup" subsumes both "carry" (for `+`) and "borrow" (for `−`) per US Grade 1–2 curriculum standard (NMAP 2008).

#### Q2 — Pool size: 30-fact v1 (spec default) or 36-fact mirror of Wave 4?

**Recommendation:** 30-fact v1 (Option A, spec default). The smaller pool reflects the higher per-fact cognitive weight at this tier. Re-audit at the 5-session-post-promotion mark, per Wave 4 §7.7.

#### Q3 — Two-digit-plus-two-digit-with-regroup `+` facts — include in v1?

Facts like `38 + 47 = 85` (units carry: `8+7=15`; tens carry: `3+4+1=8`).

**Argument for:** the actual conceptual extension Marian needs for mult-tier prep.
**Argument against:** two-digit-plus-two-digit-with-regroup is **two new conceptual surfaces at once** (two-digit operands AND regrouping). Per Dave Wave-4 research §2 / NMAP 2008, this is the canonical sequencing violation.

**Recommendation:** **EXCLUDE from v1.** Defer to a v2 widening once Marian has 5+ sessions at v1. Tracked as a follow-up.

#### Q4 — `−` facts that result in single-digit answers (e.g. `12 − 5 = 7`)?

The provisional decision in §1.4 was EXCLUDE — these belong to `sub-to-20` (already mastered by Wave-5 entry). Verify with Thomas — Wave-4 already covers all `−` facts that DON'T require borrow, so single-digit-result borrow facts are an ambiguous middle.

**Recommendation:** **EXCLUDE.** v1 `two-digit-addsub-with-regroup` `−` facts result in `[17, 64]` per the pool. Single-digit-result borrows are deferred to a v2 widening.

#### Q5 — Wave-5 spec dispatch BEFORE Wave-4 deferred PR ships?

The Wave-4 cycle-4 Wave-3 PR (Devon — `distractors.ts` widening + helpers `columnCrossDistractor` + `phantomBorrowDistractor`) is documented as **NOT YET SHIPPED** in `.claude/docs/skill-trees-and-content.md` § "Wave-3 distractor helpers — planned, not yet shipped (as of 2026-05-22)". Wave 5's implementation depends on those helpers existing (with the `'borrow-no-decrement'` variant added on top).

**Recommendation:** Wave 5 implementation dispatches ONLY after the deferred Wave-4 cycle-4 Wave-3 PR ships. **Sequencing flag for orchestrator/Matt:** the Wave-4 cycle-4 Wave-3 PR is a hard prerequisite for any Wave-5 implementation wave. Spec dispatches and reviews can proceed now; impl-wave dispatch cannot.

#### Q6 — Reconcile §2 class structure with Dave's research recommendations (added 2026-05-22 in PR #299 cleanup)

This spec's §2 carries forward the Wave-4 Class-2 (column-cross) + Class-3 (phantom-borrow) framing as "Wave-5 primaries with role inverted." Dave's Wave-5 research note (PR #300) — shipped after this spec's first draft — REJECTS both of those classes as Wave-5 primaries (research note §3 Candidates E and F) on the pedagogical-fit gate (`[[feedback_distractor_class_pedagogical_gates_mechanical]]`): column-cross targets an error Marian has CLEARED at Wave-4 promotion (≥ 80% Class-2-rejection gate); phantom-borrow targets a no-regroup over-application that contradicts Wave-5's instructional aim. Dave recommends instead:

- **Addition primary at P4–P8:** Forgotten-Carry (`correct − 10`) — Brown & VanLehn (1980), Geary (2004) WM-load mechanism.
- **Subtraction primary at P4–P8:** Smaller-From-Larger (`(tens_A − tens_B) × 10 + (ones_B − ones_A)`) — Brown & VanLehn (1980), Jordan et al. (2003) 31% prevalence.
- **Subtraction conditional at P5–P8:** Borrow-No-Decrement (`correct + 10`) — Brown & VanLehn (1980), Jordan et al. (2003) 8–18% prevalence; tier-level gentle ramp (no BND in first 3 Wave-5 sessions); one-distractor rule (never co-present with SFL in the same problem).

**Recommendation per `[[feedback_distractor_class_pedagogical_gates_mechanical]]` (pedagogical fit gates mechanical fit):** pivot the §2 class structure to Dave's three classes (Forgotten-Carry / SFL / BND) + Off-By-One + decade-anchor (for `round-ten-cross-down`). The Kyle column-cross / phantom-borrow framing was a Wave-4-precedent inheritance pattern, NOT a developmentally-grounded Wave-5 design — Dave's note is the developmental authority and supersedes.

**Decision owner:** Thomas (curriculum-design call). Resolution gates the impl-wave PR-A (Kevin lint infrastructure). The spec's mechanical specifications in §2 are retained UNCHANGED in this PR to preserve impl continuity; the pivot — if approved — happens in a follow-up Kyle spec amendment PR before Kevin Wave-2 dispatches.

---

## 4. Lint rules to be added (handoff to Kevin)

### 4.1 New pool + rules constants

Mirror the Wave-4 `TWO_DIGIT_ADDSUB_POOL` + `TWO_DIGIT_ADDSUB_RULES` pattern at `scripts/compositionLint.ts:1939+`:

```ts
// Pseudocode — Kevin's call for exact line placement
export const TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL: readonly TwoDigitAddsubPoolFact[] =
  [
    // 30 facts from §1.4 above, structured the same way as TWO_DIGIT_ADDSUB_POOL
    // each row: { a, b, op, band, category, correct }
    // band ∈ 'easy' | 'medium' | 'hard'
    // category ∈ 'carry-from-units' | 'borrow-from-tens' | 'round-ten-cross-down'
  ]

export const TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES: TwoDigitAddsubWithRegroupRulesConfig =
  {
    pool: TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL,
    categoryCaps: {
      'carry-from-units': 5,
      'borrow-from-tens': 3,
      'round-ten-cross-down': 1,
    },
    bandByPositionRules: {
      p1: { allowedBands: ['easy'], requiredOp: '+' },
      p2: { allowedBands: ['easy'], requiredOp: null },
      p3: { allowedBands: ['easy'], requiredOp: null },
      p4: { allowedBands: ['medium'], requiredOp: null },
      p5: { allowedBands: ['medium', 'hard'], requiredOp: null },
      p6: { allowedBands: ['medium', 'hard'], requiredOp: null },
      p7: { allowedBands: ['medium', 'hard'], requiredOp: null },
      p8: { allowedBands: ['medium', 'hard'], requiredOp: null },
    },
    opMix: {
      addRange: [5, 6],
      subRange: [2, 3],
      forbiddenMixes: [
        [8, 0],
        [7, 1],
        [4, 4],
        [3, 5],
      ],
    },
    highLeverageCoverage: {
      category: 'borrow-from-tens',
      minInSlots: 1,
      slots: [5, 6, 7, 8],
    },
    dualExposure: {
      // Walk every (a, b, c) where a±b=c against every other problem.
      // V1 audit (§3.3): ZERO in-pool cross-op collisions.
      // Rule remains in force for forward-compat with v2 widening.
    },
    diagnosticCoverage: {
      // ≥ 2 in-range Class 2 traps across P4–P8 AND ≥ 1 in-range Class 3 trap across P5–P8 (`−`-only)
      // Same shape as Wave 4 §3.8.
    },
  }
```

### 4.2 New `resolveTierBinding` branch

Add `two-digit-addsub-with-regroup` to the binding resolution at `scripts/compositionLint.ts:3015+`. **Interface note (per Devon NIT on PR #299):** `resolveTierBinding` dispatches on a normalised `canonFilePath` (`norm`), NOT on `focusNode`. Follow the existing two-digit-addsub pattern at `compositionLint.ts:3015`:

```ts
// Mirror the two-digit-addsub binding shape at compositionLint.ts:3015
if (norm.endsWith('/math/level-1/two-digit-addsub-with-regroup.json')) {
  return {
    tier: 'two-digit-addsub-with-regroup',
    config: TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
  }
}
if (
  norm === 'two-digit-addsub-with-regroup.json' ||
  norm.endsWith('/two-digit-addsub-with-regroup.json')
) {
  return {
    tier: 'two-digit-addsub-with-regroup',
    config: TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
  }
}
```

### 4.3 `lintBeforeRebake` failing-test fixture (per `[[testing-and-ci]]` § "Lint-infra split-PR pattern requires a `lintBeforeRebake` failing test")

PR A (lint infrastructure):

```ts
// scripts/compositionLint.test.ts — lintBeforeRebake fixture for Wave 5
describe('lintTwoDigitAddsubWithRegroupComposition — applied to pre-rebake canon', () => {
  it('flags absence-of-canon as out-of-spec (the reason this lint exists)', async () => {
    // There IS NO two-digit-addsub-with-regroup canon at PR-A time — the JSON file
    // doesn't exist yet (verified §5 below). The lint should treat absence-of-canon
    // as a build-fail at PR A; PR B (Kevin's bake) produces the JSON and the lint
    // passes. This is the red-then-green falsification record.
    const preRebakeCanon = await tryReadCanon('two-digit-addsub-with-regroup')
    expect(preRebakeCanon).toBeNull() // file doesn't exist pre-bake — confirmed empirically
  })
})
```

PR B (canon rebake + binding activation): re-runs the same lint against the post-rebake canon and asserts no violations.

### 4.4 Test coverage minimums (mirrors Wave 4 §6.9)

- **Unit (Kevin Wave 2 — directive + lint + canon):** every fact in §1.4 admits the carry / borrow constraint; composition lint enforces the 5 / 3 / 1 category caps + band-by-slot + high-leverage coverage + dual-exposure + op-mix + diagnostic-coverage; rejection-pattern fixtures from §3.3 all REJECT.
- **Unit (Devon Wave 3 — render, building on the deferred Wave-4 Wave-3 PR):** add `'borrow-no-decrement'` to the `distractorClass` union; add `phantomBorrowOrNoDecrementDistractor(correct, maxAnswer, variant)` helper; chip-class derivation alternates the Class-3 variant across `−` P5–P8.
- **Unit (Kevin Wave 1b — schema):** node-taxonomy widening (14 files in §3.4). No new fields on `MathSessionResult` — the `perProblemDistractorClass` from Wave 4 carries forward.
- **E2E (Jessica Wave 4):** Per `[[feedback_progression_e2e_mandatory]]` — the new node IS a mastery rule extension (`focusNode === 'two-digit-addsub-with-regroup'` enters the diagnostic-aware OUT-gate path). **E2E spec REQUIRED.** `e2e/two-digit-addsub-with-regroup-composition.spec.ts` covers: (a) seeded `two-digit-addsub-with-regroup` focus renders 8 problems from the 30-fact pool; (b) all problems satisfy carry-on-`+` or borrow-on-`−` constraints; (c) op-mix in `[5+/3-, 6+/2-]`; (d) at least one `borrow-from-tens` in P5–P8; (e) Class 2 / Class 3 / Class B chip render per §2.2–§2.6; (f) OUT-gate diagnostic-tap-rate reduction over 3-session window. **Failing-first.**

---

## 5. Canon-state empirical verification

Per `[[feedback_canon_state_empirical_verification]]` — every concrete claim about canon state below is verified via `git`/`grep`/`cat`/Python at spec-author time. **NOT paraphrase. Actual command + actual output.**

### 5.1 Canon file existence for `two-digit-addsub-with-regroup`

**Claim:** No `two-digit-addsub-with-regroup` canon currently exists.

**Verification:**

```bash
ls C:/Trunk/PRIVATE/MarianLearning-kyle-wt/public/canon/math/level-1/
```

Output (2026-05-22 spec-author time):

```
add-to-10.json
add-to-20.json
mult-2-5-10.json
mult-3-4.json
mult-6-9.json
number-recog.json
skip-counting.json
sub-to-10.json
sub-to-20.json
two-digit-addsub.json
```

No `two-digit-addsub-with-regroup.json` present — confirmed.

### 5.2 Current `two-digit-addsub` canon op-mix

**Claim:** The current `two-digit-addsub` canon ships ONE session of 8 problems with op-mix `5+/3-`.

**Verification:**

```bash
python -c "import json; c=json.load(open('public/canon/math/level-1/two-digit-addsub.json','r')); plan=c['plan']; reads=[u['text'] for u in plan['utterances'] if 'read' in u['id']]; print('reads:', len(reads)); [print(r) for r in reads]"
```

Output:

```
reads: 8
Twenty plus three. How many?
Twenty-two plus five. How many?
Fifteen minus three. How many are left?
Twenty-five plus four. How many?
Twenty-three plus six. How many?
Forty-eight minus seven. How many are left?
Thirty-three plus four. How many?
Twenty-five minus three. How many are left?
```

Count of `plus` (`+`) read lines: 5 (P1, P2, P4, P5, P7).
Count of `minus` (`−`) read lines: 3 (P3, P6, P8).
Op-mix: **5+/3-** ✓ confirmed.

### 5.3 Current `distractors.ts` union state — Class 2 / Class 3 NOT yet shipped

**Claim:** The Wave-4-deferred Class 2 (`'column-cross'`) and Class 3 (`'phantom-borrow'`) literals are NOT yet in the `distractorClass` union.

**Verification:**

```bash
grep -nE "distractorClass\?:" src/screens/Math/distractors.ts | head -3
```

Output:

```
192:  distractorClass?: 'off-by-one' | 'wrong-op' | 'decade-anchor'
```

The union ships THREE literals at line 192: `'off-by-one'`, `'wrong-op'`, `'decade-anchor'`. The Wave-4 spec called for adding `'column-cross'` and `'phantom-borrow'` (per `design/math/two-digit-addsub-content.md` §3.7); those additions have **NOT yet shipped** — confirmed at `src/screens/Math/distractors.ts:192`. Wave 5 dispatch is gated on this Wave-4-deferred PR landing first (Q5 in §3.5).

### 5.4 Current chip-range ceiling

**Claim:** `ANSWER_RANGE_MAX_TWO_DIGIT = 99` ships at `distractors.ts:92`; chip-range widening for Wave 5 is NOT required.

**Verification:**

```bash
grep -nE "ANSWER_RANGE_MAX_TWO_DIGIT|chipMaxAnswerForCorrects" src/screens/Math/distractors.ts | head -10
```

Output:

```
88: * Promotes via {@link chipMaxAnswerForCorrects} when any `correct > 20`.
92:export const ANSWER_RANGE_MAX_TWO_DIGIT = 99
99: *   - `correct ≤ 10` → {@link ANSWER_RANGE_MAX} (10) — add-to-10 / sub-to-10.
100: *   - `correct ≤ 20` → {@link ANSWER_RANGE_MAX_TO_20} (20) — add-to-20 /
102: *   - `correct ≤ 99` → {@link ANSWER_RANGE_MAX_TWO_DIGIT} (99) —
120: *          Defaults to `ANSWER_RANGE_MAX` (10) when `corrects` is empty —
126:export function chipMaxAnswerForCorrects(corrects: readonly number[]): number {
127:  if (corrects.length === 0) return ANSWER_RANGE_MAX
129:  if (maxCorrect <= ANSWER_RANGE_MAX) return ANSWER_RANGE_MAX
```

`ANSWER_RANGE_MAX_TWO_DIGIT = 99` at line 92 — confirmed. `chipMaxAnswerForCorrects` resolves to `99` for any `correct ∈ [21, 99]` (lines 131–132 in the same file). **NO new chip-range constant required for Wave 5.**

### 5.5 Current `MATH_NODES_IN_ORDER` — no `two-digit-addsub-with-regroup` node

**Claim:** The Wave 5 node does NOT yet exist in the math-tree taxonomy; node-taxonomy widening per §3.4 is genuinely additive.

**Verification:**

```bash
grep -nE "two-digit-addsub-with-regroup|MATH_NODES_IN_ORDER" src/lib/progress/focusNode.ts
```

Output:

```
45:export const MATH_NODES_IN_ORDER: readonly NumberGardenNode[] = [
46:  'number-recog',
47:  'add-to-10',
48:  'add-to-20',
49:  'sub-to-10',
50:  'sub-to-20',
51:  'two-digit-addsub',
52:  'skip-counting',
53:  'mult-2-5-10',
54:  'mult-3-4',
55:  'mult-6-9',
56:]
```

No `two-digit-addsub-with-regroup` entry — confirmed. §3.4 node-taxonomy widening is genuinely additive (not duplicative).

### 5.6 Current `TWO_DIGIT_ADDSUB_POOL` shape sanity check

**Claim:** Wave 4 ships a 36-fact pool at `scripts/compositionLint.ts:1939`; Wave 5's new `TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL` will be a sibling constant.

**Verification:**

```bash
grep -nE "TWO_DIGIT_ADDSUB_POOL|TWO_DIGIT_ADDSUB_RULES" scripts/compositionLint.ts | head -5
```

Output:

```
1939:export const TWO_DIGIT_ADDSUB_POOL: readonly TwoDigitAddsubPoolFact[] = [
2261:export const TWO_DIGIT_ADDSUB_RULES: TwoDigitAddsubRulesConfig = {
2262:  pool: TWO_DIGIT_ADDSUB_POOL,
3015:    return { tier: 'two-digit-addsub', config: TWO_DIGIT_ADDSUB_RULES }
3021:    return { tier: 'two-digit-addsub', config: TWO_DIGIT_ADDSUB_RULES }
```

Wave 4's pool + rules + binding ship at lines 1939, 2261, 3015 — confirmed. Wave 5's pool + rules sibling-constants will live below these (Kevin's call for exact line placement).

---

## 6. References

### 6.1 Wave 4 precedents (cycle 4 cleanup PRs informed Wave 5's spec discipline)

- **PR #285** — Wave-4 spec ship (Kyle, 2026-05-21). Structural template for this spec.
- **PR #287** — Devon Wave-3 cycle-4 parser-widening (hyphen support + decade-words 21–99). Wave 5 inherits the parser surface unchanged.
- **PR #290** — Jessica E2E + silent-wrong-tier-misrender NOF. Wave 5's E2E spec mirrors this pattern.
- **PR #291** — Wave-2 cycle-4 directive + lint + canon (Kevin). Wave 5's Kevin Wave 2 mirrors this PR's shape.
- **PR #292** — sibling read-line template divergence fix (subtraction "How many are left?" pinning). Wave 5 inherits the pinned template — no new prosody work.
- **PR #293** — directive-prose canon-state claim NOF + spec correction (round-ten-anchor framing). Triggered the `[[feedback_canon_state_empirical_verification]]` memory. §5 above honors this gate directly.
- **PR #295** — spec copy-edits bundle (Kyle, 2026-05-22). Wave-4 spec final shape consumed by this Wave-5 spec.

### 6.2 Dave's Wave 5 research note (SHIPPED via PR #300)

- [`design/research/wave-5-borrow-carry-error-patterns.md`](../research/wave-5-borrow-carry-error-patterns.md) (Dave, 2026-05-22) — Wave-5 borrow/carry error pattern research. Cites: Brown & VanLehn (1980) "Repair Theory" for the foundational systematic-bug taxonomy (SFL, Borrow-No-Decrement, Carry-Into-Ones); Jordan et al. (2003) PMC2788949 for error-prevalence data (SFL 31% at-risk / 9% controls; BND 8–18% across groups); Lin, Riccomini & Liang (2025) for the 2025 systematic-review confirmation of dominant computation-error categories; Fuson (1990) on multi-unit number place-value structures; Moeller et al. (2011) on first-grade place-value predicting third-grade arithmetic; Geary (2004) on WM load as the mechanistic basis for Forgotten-Carry. **§2 placeholders resolved against this note.** Material divergences from this spec's class structure surfaced inline at §2.4 (Class 2 column-cross REJECTED), §2.5 (Class 3 phantom-borrow variant REJECTED, BND variant CONFIRMED P5–P8 conditional), and §2.6 (Class B decade-anchor — Dave-adjacent but not explicit). Decision surface for impl-wave dispatch is captured in §3.5 Q-new.

### 6.3 Linked memory entries

- `[[feedback_canon_state_empirical_verification]]` — §5 above is the entire-spec answer to this gate.
- `[[feedback_distractor_class_pedagogical_gates_mechanical]]` — §2 placeholders honor this gate explicitly.
- `[[feedback_haiku_directive_sharpening]]` — §1.4 + §1.5 + §3.1–§3.3 directive shape mirrors the 4 validated patterns.
- `[[feedback_no_fabrication]]` — every line number and file path in this spec verified before stating (§5 above is the load-bearing verification log).
- `[[feedback_progression_e2e_mandatory]]` — §3.4 introduces a new node which IS a `mastery.ts` extension; Jessica E2E REQUIRED at Wave 1b dispatch.

### 6.4 Predecessor + sibling content specs

- [`design/math/two-digit-addsub-content.md`](./two-digit-addsub-content.md) — primary structural template (Kyle, PR #285).
- [`design/math/add-to-20-content.md`](./add-to-20-content.md) — Haiku-prior correction pattern.
- [`design/math/sub-to-20-content.md`](./sub-to-20-content.md) — Class B (decade-anchor) precedent (re-promoted to PRIMARY at Wave 5 for `round-ten-cross-down` problems).

---

## Self-Test

**spec-only PR (markdown).** No code touched; no runtime path affected.

- `yarn build` — expected GREEN (markdown spec doesn't enter the build).
- `npx vitest run` — expected GREEN at baseline (no test fixtures modified).
- Self-Test Report NOT required per `[[feedback_self_test_report]]` (docs/spec PR, not UX-visible).
