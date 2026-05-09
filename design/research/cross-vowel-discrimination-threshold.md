# Cross-Vowel Discrimination Threshold

**Ticket:** `86c9q9er0`
**Origin:** `cross-vowel-mix-spec.md` §8 Q4

---

## Key Recommendations (Executive Summary)

1. **Per-aggregate mastery (all three CVC tiers at 90/3) is developmentally sufficient as a cross-vowel mixing gate.** No per-vowel novel-pool pre-gate is needed. The three-tier mastery requirement is already a rigorous generalization hurdle; a separate graduation-style novel-pool probe per vowel adds scope cost without proportionate developmental benefit.

2. **The /æ/-/ʌ/ contrast (short-a vs short-u) is the highest-risk cross-vowel pair for Tagalog L1 learners.** Both vowels are perceptually pulled toward Tagalog /a/. The cross-vowel chip session format will surface this difficulty within the first 2–3 cross-vowel sessions; per-session accuracy logging is the appropriate detection mechanism.

3. **The cross-vowel chip task is itself a generalization probe.** Presenting novel minimal pairs across vowels (hat/hot/hut, bag/bog/bug) immediately tests whether phoneme boundaries transfer across contexts. Failure-mode detection via per-session accuracy tracking (with the `parentSettings.crossVowelMixingEnabled` safety toggle) is the right safeguard — not a pre-gate.

**Verdict:** [INFERRED] The v1 per-aggregate gate in `cross-vowel-mix-spec.md` §8 Q2 is correct. No spec change needed.

---

## Section 1: Literature Review — Cross-Phoneme Discrimination in Early Bilingual L1-Tagalog Learners

### 1.1 Tagalog phonology and the English short-vowel system

Tagalog has a 5-vowel inventory: /a/, /ɛ/, /i/, /ɔ/, /u/. Critically:

- Tagalog /u/ is a long-oo [uː], not English /ʌ/. English short-u (/ʌ/) has no Tagalog equivalent.
- Tagalog /a/ is low-central [a], which sits perceptually between English /æ/ (short-a) and /ʌ/ (short-u). Both English vowels can be heard as the single Tagalog /a/ category.
- Tagalog /ɛ/ approximates English short-e, reducing (but not eliminating) confusion there.
- Tagalog /ɔ/ approximates English short-o, reducing (but not eliminating) confusion there.

This maps directly onto the Word Song vowel sequence (a → o → u → e → i). The two vowels that share a Tagalog perceptual magnet — /æ/ and /ʌ/ — are the first and third in Marian's sequence. They will be the last pair standing when cross-vowel mixing first fires.

[INFERRED — derived from standard Tagalog phonological descriptions cross-referenced with phonics-sequence-marian.md §2; no published study on Tagalog 8-year-olds learning English short vowels via chip-tap was located.]

### 1.2 L2 phoneme discrimination — the perceptual learning literature

**Best available evidence:** Saito, K. (2022). "What characterizes high-variability phonetic training? Revisiting the effect of variability on second language speech perception acquisition." _Language Learning_, 72(3), 679–718. [STRONG — meta-analysis, 79 studies, Hedges g = 0.92]

- HVPT (multiple talkers, variable contexts, immediate feedback) produces large gains in L2 phoneme discrimination including vowel contrasts.
- Effect sizes for vowel contrasts (g ≈ 0.85) are smaller than consonant contrasts (g ≈ 1.05) but still large.
- Generalization to novel stimuli and untrained words IS the norm in HVPT — it is the core theoretical claim of the paradigm and is supported by the meta-analytic data.

Implication for Marian: trained phoneme categories for /æ/, /ɔ/, /ʌ/ should generalize to novel CVC words, especially when training context varies (picture-labeled chips vary the word set session to session). [INFERRED — HVPT findings are from adult L2 learners; child transfer rates are less certain.]

**Critical caution:** Brekelmans, G., Evans, E., & Wonnacott, E. (2025). "Training Child Learners on Nonnative Vowel Contrasts." _Language Learning_, 75(1). DOI: 10.1111/lang.12677. [MODERATE — RCT, 7–8-year-old Dutch children learning English vowel contrasts]

- Children aged 7–8 showed within-session improvement on trained vowel pairs during a 4-week computer-based phonetic training program.
- Post-training generalization to untrained stimuli was **limited** — particularly in the first weeks; it increased with training duration.
- Key take-away for gate design: children at 7–8 do NOT automatically generalize trained phoneme distinctions to novel words immediately after mastering the trained set. Generalization is a lagged outcome that accumulates with continued exposure.

This finding is the strongest caution in this review. It argues NOT for a per-vowel pre-gate, but for **continued within-session monitoring** after cross-vowel mixing fires. If Marian's session accuracy falls below threshold across two consecutive cross-vowel sessions, the `parentSettings.crossVowelMixingEnabled` toggle gives Thomas a manual off-ramp while we wait for generalization to solidify.

### 1.3 Developmental readiness at age 8 for cross-category phoneme work

**Source:** Cardenas-Hagan, E. (2020). _Literacy Foundations for English Learners_. Paul H. Brookes Publishing. [STRONG — practitioner consensus grounded in NRP review; cited as Source 13 in phonics-sequence-marian.md]

- ELL children who have consolidated a phoneme in their L2 at the word level are ready for contrastive minimal-pair work with other phonemes in the same phonetic space — but "consolidated" means more than recognition; it means the child can reliably segment and produce the sound in familiar words.
- Mastery at 90% over 3 sessions is a reasonable operational proxy for "consolidated" — it aligns with mastery-based instruction benchmarks in the systematic phonics literature.

**Source:** Reading Universe / Really Great Reading (2024). "Teaching English Short Vowels to English Language Learners." [MODERATE — practitioner consensus, ELL-specific; cited as Source 4 in phonics-sequence-marian.md]

- Recommends introducing contrastive vowel pairs (illustrated word pairs with contrasting vowel sounds + explicit meaning-alongside-phoneme instruction) once the first vowel in a contrast pair is consolidated.
- Does NOT recommend waiting for all vowels in a contrast set to be consolidated before introducing any pairwise contrast — meaning the threshold question is about the contrast pair, not the full set.

This is the one source that could be read as supporting an earlier gate (per-consolidated-pair rather than per-aggregate). I address why I still recommend per-aggregate in Section 3.

**Source:** Snow, C.E., Burns, M.S., & Griffin, P. (Eds.) (1998). _Preventing Reading Difficulties in Young Children_. National Research Council, National Academies Press. [STRONG — foundational NRP-adjacent review; multiple chapters on phoneme awareness in L2 contexts]

- By age 7–8, typically developing children can use metalinguistic awareness to attend to phoneme contrasts explicitly when the task scaffolds attention (pictures, feedback, short trials).
- The chip-tap format in Word Song (picture + audio + selection) provides this scaffolding directly.

### 1.4 Summary of lit review findings

| Finding                                                             | Confidence                    | Implication                                                                     |
| ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Tagalog /a/ perceptually captures both English /æ/ and /ʌ/          | [INFERRED]                    | /æ/-/ʌ/ is highest-risk pair; monitor post-gate                                 |
| L2 vowel phoneme training generalizes to novel stimuli in adults    | [STRONG — HVPT meta]          | Cross-vowel chips will surface real transfer, not memorized pairs               |
| Children 7–8 show limited immediate post-training generalization    | [MODERATE — Brekelmans 2025]  | Expect early errors in cross-vowel; don't treat as gate failure                 |
| 90/3 mastery = reasonable proxy for "consolidated" phoneme          | [MODERATE — Brookes/NRP]      | Per-aggregate gate is operationally sound                                       |
| Contrastive pair work is appropriate after first vowel consolidates | [MODERATE — Reading Universe] | Could support per-pair gate, but per-aggregate is more conservative and simpler |

---

## Section 2: Per-Aggregate vs Per-Vowel Novel-Pool Gate Comparison

### 2.1 Gate A — Per-aggregate mastery (v1 spec, current lock)

**Trigger condition:** `cvc-words`, `cvc-words-short-o`, and `cvc-words-short-u` are all `'mastered'`.

**What mastery means at 90/3:** The child has answered correctly on ≥90% of trials across ≥3 independent sessions on each vowel tier. This is ~24–30+ trials per vowel across multiple days.

**Predicate shape (recommendation):**

```ts
const CVC_CROSS_VOWEL_NODES = new Set<WordSongNode>([
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
])

function crossVowelMixingEnabled(
  progress: Progress,
  focusNode: WordSongNode,
  parentSettings: ParentSettings,
): boolean {
  const sl = progress.skillLevels
  return (
    CVC_CROSS_VOWEL_NODES.has(focusNode) &&
    sl['cvc-words'] === 'mastered' &&
    sl['cvc-words-short-o'] === 'mastered' &&
    sl['cvc-words-short-u'] === 'mastered' &&
    (parentSettings.crossVowelMixingEnabled ?? true)
  )
}
```

**Scope cost:** Low. This is the v1 spec. No additional graduation-session machinery, no novel-pool tracking fields, no extra session types.

**Developmental cost:** Low. The 90/3 gate is already three independent mastery achievements. The child will have seen each vowel in ≥3 sessions before cross-vowel mixing fires — that's meaningful within-category exposure.

**Risk:** Mastery on within-vowel trials does not guarantee cross-vowel discrimination. Brekelmans (2025) shows generalization lags. The first cross-vowel sessions may show higher error rates on /æ/-/ʌ/ pairs specifically.

### 2.2 Gate B — Per-vowel novel-pool pre-gate (alternative)

**Trigger condition:** Each of the three CVC tiers additionally completes a graduation-style novel-pool session (≥80% on 5 fresh words not in the training pool) before cross-vowel mixing fires.

**Predicate shape (hypothetical):**

```ts
function crossVowelMixingEnabled(
  progress: Progress,
  focusNode: WordSongNode,
  parentSettings: ParentSettings,
): boolean {
  const sl = progress.skillLevels
  const sh = progress.sessionHistory
  const hasNovelProbe = (node: WordSongNode) =>
    sh.some(
      (s) =>
        s.node === node &&
        s.isNovelProbeSession &&
        s.novelPoolSuccessRate >= NOVEL_POOL_THRESHOLD,
    )
  return (
    CVC_CROSS_VOWEL_NODES.has(focusNode) &&
    sl['cvc-words'] === 'mastered' &&
    hasNovelProbe('cvc-words') &&
    sl['cvc-words-short-o'] === 'mastered' &&
    hasNovelProbe('cvc-words-short-o') &&
    sl['cvc-words-short-u'] === 'mastered' &&
    hasNovelProbe('cvc-words-short-u') &&
    (parentSettings.crossVowelMixingEnabled ?? true)
  )
}
```

**Scope cost:** High. Requires:

- 3 graduation-session types (novel-pool probe sessions for each CVC tier)
- `isNovelProbeSession` flag on `SessionHistoryEntry` (schema change)
- Expanded novel word pools for short-o and short-u (the graduation gate for `cvc-words` already has a novel pool; short-o and short-u do not)
- Additional planner logic to detect "graduation pending" for two new node types
- Canon bypass posture for three probe session types

**Developmental justification:** The Brekelmans (2025) finding of limited post-training generalization is the strongest argument for this gate. However:

- The gate fires AFTER the probe, not before it — so if Marian would fail the probe, she's gated on more within-vowel practice. This is correct behavior.
- But the same failure-mode detection already happens inside the cross-vowel session itself: if Marian gets /æ/-/ʌ/ pairs wrong in her first cross-vowel sessions, Thomas sees it via session accuracy, and the toggle gives him the off-ramp.
- The novel-pool probe for short-o and short-u would need content that doesn't exist yet and would require Midjourney + pipeline work on top of the scope cost.

**Risk:** Adds ~2–4 weeks of build scope for a gate that the per-session accuracy monitoring achieves with less machinery.

### 2.3 Cost-vs-risk table

| Dimension                   | Gate A (per-aggregate)                        | Gate B (per-vowel novel-pool)                |
| --------------------------- | --------------------------------------------- | -------------------------------------------- |
| Build scope                 | 0 (already v1 spec)                           | ~2–4 weeks additional                        |
| Developmental rigor         | 90/3 × 3 tiers                                | 90/3 × 3 tiers + novel probe × 3             |
| Failure-mode detection      | Per-session accuracy + parent toggle          | Novel probe pre-gates + per-session accuracy |
| Risk if generalization lags | First cross-vowel sessions harder; detectable | Lower pre-gate risk; same in-session risk    |
| Content requirement         | Current word pool sufficient                  | Expanded novel pools for short-o and short-u |

---

## Section 3: Verdict + Confidence + Predicate Shape Pin

**Verdict:** [INFERRED] Gate A (per-aggregate mastery) is the appropriate threshold for v1. The v1 `cross-vowel-mix-spec.md` §8 Q2 lock stands. No per-vowel novel-pool pre-gate is needed for the first cross-vowel implementation.

**Confidence label: [INFERRED]**

Rationale: The verdict rests on (a) the operational strength of 90/3 mastery as a consolidation proxy [MODERATE evidence], (b) the HVPT meta-analysis showing that phoneme training does generalize to novel stimuli [STRONG evidence, but in adults], and (c) the judgment that per-session accuracy monitoring is a functionally equivalent failure-mode detector at lower scope cost [INFERRED — no direct study compares the two gate designs for 8-year-olds]. A STRONG rating would require an RCT comparing gate designs for child L2 learners, which does not exist.

**Predicate shape pin for `mastery.ts`:**

The recommended function is reproduced from Section 2.1 above. Key invariants:

- Set membership check on `focusNode` prevents cross-vowel mixing firing during non-CVC-word sessions.
- All three `=== 'mastered'` checks are ANDed — no cross-vowel mixing unless all three tiers pass 90/3.
- `parentSettings.crossVowelMixingEnabled ?? true` preserves the parent toggle as a hard off switch.
- No `sessionHistory` traversal required — the predicate stays O(1).
- Mirror the `isGraduationSessionPending` pattern for planner-bypass: when `crossVowelMixingEnabled` returns true, the session bypasses canon and Leitner.

**No schema changes needed.** The `SessionHistoryEntry` shape does not need a new field for this gate. If failure-mode tracking is added later (Section 4), a `crossVowelAccuracy` field on `SessionHistoryEntry` would be the right extension point — but that is a future PR, not a gate requirement.

---

## Section 4: Failure-Mode Analysis

### 4.1 Failure mode 1: Marian conflates /æ/ and /ʌ/ immediately on cross-vowel activation

**Mechanism:** Both vowels pull toward Tagalog /a/. When hat and hut appear as distractors for each other in the chip set, Marian may treat them as homophones.

**Detection:** Per-session accuracy on cross-vowel sessions. The planner should log pair-level accuracy (hat-vs-hut correct / total hat-vs-hut presentations) separately from within-vowel accuracy. If Thomas observes 2+ consecutive sessions with <70% accuracy on /æ/-/ʌ/ pairs, the toggle off-ramp is the correct response.

**Mitigation already in spec:** `FORBIDDEN_PAIRS` prevents same-initial-consonant pairings that compound phonemic difficulty. `hat/hot/hut` would be presented across sessions, not all three as distractors simultaneously in a single trial. The chip-tap format presents one target + 3 distractors — cross-vowel distractors are introduced gradually as session count increases.

### 4.2 Failure mode 2: Mastery on same-vowel trials is memorization, not phoneme knowledge

**Mechanism:** With an 11-word short-u pool and 8-word short-o pool, Marian may recognize the words by picture without decoding the vowel phoneme. The cross-vowel session is the diagnostic that exposes this.

**Detection:** High same-vowel accuracy + low cross-vowel accuracy = memorization signal. This is the primary reason cross-vowel mixing is valuable — it is itself the generalization probe that catches this failure.

**Mitigation:** No gate change needed. The cross-vowel session failing gracefully (returning Marian to same-vowel practice with the toggle off) is the correct behavioral response. The FORBIDDEN_PAIRS mechanism and the pool-expansion work (short-u PR #170) both reduce the memorization risk.

### 4.3 Failure mode 3: Cross-vowel gate fires too late (short-i and short-e not yet shipped)

**Mechanism:** When short-i and short-e are added, the `CVC_CROSS_VOWEL_NODES` set must expand to include them. If the predicate is not updated, cross-vowel sessions may miss the highest-discriminability pairs (/ɛ/-/ɪ/).

**Mitigation:** The predicate uses an explicit Set constant, not a dynamic query. When short-i and short-e nodes are added, Kevin or Devon must update `CVC_CROSS_VOWEL_NODES`. This is a deliberate change point, not a bug surface — the explicit Set makes the dependency visible.

### 4.4 Failure mode 4: `parentSettings.crossVowelMixingEnabled` defaults to `true` when field is absent

**Mechanism:** Old `ParentSettings` objects in localStorage do not have `crossVowelMixingEnabled`. The `?? true` default ensures cross-vowel mixing fires when the field is absent — which is the correct behavior for returning users who have met the mastery gate before the field is added.

**Mitigation:** `?? true` is the right default. No migration needed. The toggle is a parent-facing opt-out, not an opt-in.

---

## Risks / Counter-Evidence

1. **Brekelmans (2025) is the sharpest caution in this review.** Dutch 7–8-year-olds showed limited post-training generalization in the short term. If Marian's cross-vowel accuracy is poor in early sessions, this is the expected developmental pattern — NOT necessarily a gate design failure. The risk is that Thomas interprets early cross-vowel difficulty as evidence the gate fired too early and turns off the feature permanently, when the correct response is to continue at lower mix-in density and let generalization accumulate.

   Mitigation recommendation for Kyle: design the cross-vowel session introduction screen to set Thomas's expectations: "Emma is now mixing vowel sounds — some mistakes early on are normal and expected."

2. **HVPT meta-analysis is in adults.** The generalization evidence is strong for adult L2 learners; child data is thinner. Brekelmans (2025) is the best child-specific RCT and it is cautionary. A pure adult-extrapolation would be overconfident.

3. **The 8-word short-o pool is small.** Mastery on 8 words is a lower ceiling than mastery on 14 short-a words. The 90/3 threshold compensates somewhat (more sessions required), but a 3-session window on 8 words is still ~24 item presentations — enough to expose a memorization shortcut.

   Mitigation: the short-o pool should expand before cross-vowel mixing ships. This is a scope note for Matt, not a gate change.

4. **No Tagalog-English child vowel training literature located.** The Tagalog-specific phonological analysis in Section 1.1 is derived from adult contrastive analysis and phonics-sequence-marian.md's prior literature search, not from a direct study of Filipino child L2 English learners. The /æ/-/ʌ/ risk assessment is [INFERRED], not [STRONG].

---

## Recommendations

### For Matt (ticket priority / scope)

1. **Close `86c9q9er0` with verdict: per-aggregate gate (v1 spec) confirmed.** No spec change needed. The predicate shape in Section 3 is the implementation target for the cross-vowel mastery predicate.

2. **Open a follow-on scope note:** before cross-vowel mixing ships, ensure the short-o word pool expands from 8 to at least 11 words (matching short-u). Mastery on 8 words is a tighter ceiling. This is a content task, not a gate redesign.

3. **Instrument pair-level accuracy in cross-vowel sessions** (low scope, high diagnostic value). Log correct/total for each cross-vowel contrast pair (a-vs-o, a-vs-u, o-vs-u). This data will tell us within 2 weeks of launch whether the /æ/-/ʌ/ pair is as problematic as predicted.

4. **Do NOT add per-vowel novel-pool pre-gates.** The scope cost (Section 2.2) is not justified by the developmental evidence. The cross-vowel session is itself the generalization probe.

### For Kyle (design changes)

1. **Add a one-time parent-facing onboarding message when cross-vowel mixing first fires.** Text suggestion: "Emma is now mixing different vowel sounds in the same session — hat, hot, and hut might all appear. Some mistakes early on are completely normal. Marian is doing something genuinely hard." This sets Thomas's expectations and prevents premature use of the toggle.

2. **Design for graceful degradation, not hard failure.** If Marian's cross-vowel session accuracy falls below threshold, Emma's reaction should be the standard "puzzled" pose — not a new error state. The `parentSettings.crossVowelMixingEnabled` toggle is the parent-facing escape valve; the in-session experience should not signal regression.

3. **Consider introducing cross-vowel pairs in an explicit 2-vowel phase before a 3-vowel phase.** First cross-vowel sessions: a-vs-o only (Tagalog-closest pair, lowest risk). After 3 sessions of a-vs-o above threshold: add a-vs-u (highest-risk pair). After 3 more sessions: full 3-vowel mixing. This graduated introduction is within scope of the v1 spec and does not require a gate change — it is a planner-side session-composition decision.

---

## Sources Index

| #   | Source                                                                                                                                                                 | Strength                                            | Relevance                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Saito, K. (2022). "What characterizes high-variability phonetic training?" _Language Learning_, 72(3), 679–718.                                                        | [STRONG] — meta-analysis, 79 studies                | HVPT generalization to novel stimuli, effect sizes for vowel contrasts      |
| 2   | Brekelmans, G., Evans, E., & Wonnacott, E. (2025). "Training Child Learners on Nonnative Vowel Contrasts." _Language Learning_, 75(1). DOI: 10.1111/lang.12677         | [MODERATE] — RCT, 7–8-year-olds                     | Limited post-training generalization in child L2 learners; key caution      |
| 3   | Cardenas-Hagan, E. (2020). _Literacy Foundations for English Learners_. Paul H. Brookes Publishing.                                                                    | [STRONG] — practitioner consensus, NRP-grounded     | ELL pacing; "consolidated" phoneme as prerequisite for contrastive work     |
| 4   | Reading Universe / Really Great Reading (2024). "Teaching English Short Vowels to English Language Learners." readingrockets.org                                       | [MODERATE] — practitioner consensus, ELL-specific   | Illustrated word pairs with contrastive vowel sounds; timing recommendation |
| 5   | Snow, C.E., Burns, M.S., & Griffin, P. (Eds.) (1998). _Preventing Reading Difficulties in Young Children_. National Research Council.                                  | [STRONG] — foundational NRP-adjacent review         | Metalinguistic awareness at 7–8; scaffolded phoneme attention               |
| 6   | Flege, J.E. (1995). "Second language speech learning: Theory, findings, and problems." In W. Strange (Ed.), _Speech Perception and Linguistic Experience_. York Press. | [STRONG] — foundational L2 speech perception theory | Perceptual Assimilation Model; L1 categories capture L2 phones              |
| 7   | phonics-sequence-marian.md (internal; cites Sources 1–14 including NRP, Brookes, Colorín Colorado, Reading Universe)                                                   | [Internal]                                          | Tagalog phonology mapping; vowel sequence rationale; /ʌ/ as highest-risk    |
| 8   | cvc-words-developmental-review.md (internal; §4 Option A novel probe words)                                                                                            | [Internal]                                          | Existing mastery-threshold analysis; graduation gate precedent              |
| 9   | cross-vowel-mix-spec.md §8 Q2/Q4 (internal; PR #171)                                                                                                                   | [Internal]                                          | Gate design lock; this ticket's origin question                             |
