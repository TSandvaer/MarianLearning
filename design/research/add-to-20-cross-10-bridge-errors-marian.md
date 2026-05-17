# Add-to-20: Cross-10-Bridge Error Patterns (Marian-specific)

**Ticket:** Follow-up to PR #276 (`add-to-20-content.md`) — Kyle §7.6 gap surface
**Date:** 2026-05-17
**Requested by:** Orchestrator dispatch, following Kyle's explicit research gap flag in `design/math/add-to-20-content.md` §7.4 and §7.6.

---

## Question

Kyle's `add-to-20-content.md` §7.6 identifies three unresolved gaps:
1. Cross-10-bridge error patterns in 7-9-year-olds doing mental addition — what are the documented error modes on problems like `8 + 5 = ?`?
2. Whether the "dropped-carry" distractor (Class B candidate in §7.4) is a real error pattern or a speculative inference.
3. Whether commutative pairs (`8 + 5` / `5 + 8`) are distinct retrieval facts or order-irrelevant.
4. Whether the doubles cap of 2 per session is pedagogically defensible.

The broader question: do Kyle's §7.4 (REJECT Class B) and §1.4 (doubles cap = 2, no `general` bucket) hold up under the research, or should amendments go back before Kevin implements?

---

## Bottom line

**§7.4 Class B rejected: CONFIRM REJECT.** The dropped-carry error as proposed — `8 + 5 → 10` or `8 + 5 → 12` as a chip trap — conflates a written-carry procedural error (multi-digit addition) with an oral/mental bridge-step error (single-digit cross-10). The literature documents the mental cross-10 error mode as off-by-one in the bridge step, not as a discrete "stop at 10." Kyle's Class 1 (off-by-one) already covers this. A Class B chip targeting `10` would be pedagogically appropriate only for a small subset of facts (sums 11–13) and is implausible as a trap for the HARD band (sums 15–18). The reject stands.

**A distinct error pattern not in Kyle's spec is worth tracking: wrong-by-5 (finger-boundary error).** Domahs et al. (2008) documented that finger-counting children produce errors displaced by exactly 5 from the correct answer at a reliably elevated rate on cross-10-bridge problems. For Marian at 100% finger reliance, this means `8 + 5 = 8` (dropping one hand) or `8 + 5 = 18` (over-counting one hand) are plausible systematic errors. This is not a basis for a new distractor class in v1 — the effect size and mechanism do not support a dedicated chip — but it should inform Emma's `giveAnswer` and `reprompt` copy if Marian answers wrong by exactly 5.

**§1.4 doubles cap: CONFIRM — 2 is defensible, with one calibration note.** Doubles (tie problems) are genuinely earlier-retrieval-fluent than cross-10-bridge facts. The tier-aware 2-cap is the correct correction for Haiku's prior. However: the 2-cap should not apply uniformly across all session bands — doubling down on doubles in the EASY-only session start (P1-P3) is fine because EASY facts include only one double (`6+6`). The 2-cap becomes the actual constraint at P4-P8 where `7+7`, `8+8`, `9+9` compete. No code change needed; the cap already works this way.

**§1.3 commutative pairs: CONFIRM as distinct facts.** Children in the 7-9 age range show an operand-order effect for addition problems before retrieval is established: larger-operand-first (`8 + 5`) is solved more accurately and faster than smaller-operand-first (`5 + 8`). Once retrieval is established, the effect collapses. For Marian at 100% finger reliance (counting-on dominant), the two orderings produce distinct cognitive experiences and should be practiced separately. Kyle's decision to include both commutative forms is correct.

---

## §1 — Cross-10-bridge error taxonomy (7-9yo, finger-counter profile)

### 1.1 Conceptual backdrop: why decade-crossing is categorically harder

Addition problems with sums that cross a decade boundary (supercomplements in the cognitive arithmetic literature) impose a qualitatively different cognitive load than those that do not. A non-crossing fact like `3 + 4 = 7` can be solved with a single count-on procedure: start at 3, count on 4. A crossing fact like `8 + 5 = 13` involves a two-phase procedure: (a) count up to 10 (2 steps), (b) continue past 10 (3 more steps), while simultaneously tracking both a step counter and the threshold. The Philosophical Transactions paper (Domahs et al. / Schuch et al., 2025, "Decade effects in mental addition," Royal Society B, https://royalsocietypublishing.org/doi/10.1098/rstb.2024.0220) confirms in adults that decade-crossing problems are systematically slower and more error-prone than non-crossing problems — and this effect is larger for children still using procedural strategies.

For a child using the count-on-from-the-larger procedure (the "min" strategy), `8 + 5` means: hold 8, count on 9, 10, 11, 12, 13 — five counting steps, with a decade boundary after step 2. The error opportunities multiply with step count (Geary et al., 2004; Baroody, 1984). This is the cognitive mechanism behind every error pattern below.

### 1.2 Error pattern 1: Off-by-one in the bridge step (most prevalent)

**Description.** The child completes the count-on correctly except for miscounting by one step at or near the decade boundary. Common manifestations:
- `8 + 5 = 12` (stopped one step early)
- `8 + 5 = 14` (counted one step too many)

**Mechanism.** The decade boundary at 10 creates a natural "stopping point" that some children respond to by hesitating, losing a count, or re-starting a sub-count. The error is not "stopping at 10" as a final answer; it is stopping at the wrong count relative to 10.

**Evidence.** Robinson, Ninowski, & Gray (2013, Frontiers in Human Neuroscience, PMC3880841) documented neighbor errors (off-by-one in the compensating direction) as the modal procedural error in subtraction across ages 6-7. The finding generalises to addition: the most common procedural error is a single step miscounted, not a conceptual failure to cross the decade. Geary et al. (2004, Journal of Experimental Child Psychology, 88(2), 121-151) showed that counting-on errors for complex addition problems are predominantly ±1 from the correct answer, arising from miscount during execution of the min procedure. The effect increases with the number of counting steps, which for cross-10-bridge facts is 3-7 steps for the facts in Kyle's MEDIUM and HARD bands.

**Frequency estimate.** Geary et al. (2004) found error rates on "complex" addition (their `16 + 8` type problems) of approximately 10-20% per trial for normally-achieving first graders still using counting strategies, compared to 1-3% for simple (within-10) addition. For a child at Marian's profile (100% finger reliance, entering the transition zone), error rates on HARD-band cross-10 facts are expected in the 15-25% range at session onset.

**Kyle's Class 1 (off-by-one) is the correct covering class for this error.** This is already in the spec. CONFIRM.

**Evidence strength: Strong** (multiple replicated controlled studies, converging across subtraction and addition research; Geary et al. 2004, Robinson et al. 2013).

### 1.3 Error pattern 2: Strategy-substitution miscounting (prevalent, distinct from pure off-by-one)

**Description.** The child begins counting on from the smaller addend rather than the larger, increases step count, and miscounts. For `5 + 8`, a child using the non-min strategy (count on from the first addend, 5) must count 8 steps rather than 5. At step 6 or 7, during the decade-crossing, a misstep produces an error of 2-3 from the correct answer.

**Mechanism.** The min strategy (count on from the larger addend) is learned progressively; younger/less-experienced children default to counting from the first-named addend. For `5 + 8`, non-min counting produces errors systematically further from the correct answer than min-procedure errors, because more steps = more error opportunities.

**Evidence.** Groen & Parkman (1972) established the min model and its developmental emergence in first-graders. Carpenter & Moser (1984, Journal for Research in Mathematics Education, 15(2), 179-206; cited in ResearchGate) documented that first-graders shift from "counting all" through "count-on-from-first" to "count-on-from-larger (min)" over the course of grades 1-2, but that many children at the start of grade 2 are still using non-min strategies on some problems. The operand-order effect (larger-first is solved faster; see §4) is the empirical trace of this developmental pattern.

**Significance for Kyle's pool.** This error is more prevalent on commutative pairs where the smaller addend is named first (`5 + 8`, `3 + 9`, `2 + 9`). These are in Kyle's pool precisely to practice both orderings. The error mode here is off-by-2 or off-by-3, which a strict off-by-one chip does not capture. However, adding a wider-off distractor specifically for small-addend-first facts would complicate the chip design without strong enough evidence justification. The off-by-one chip is the best single coverage for this error type.

**Evidence strength: Strong** (Groen & Parkman foundational; Carpenter & Moser 1984 longitudinal; widely replicated developmental progression).

### 1.4 Error pattern 3: Make-ten-bridge incomplete (moderate prevalence, finger-counter-specific)

**Description.** The child successfully decomposes one addend to reach 10 (bridging step 1) but then fails to add the remaining amount (bridging step 2). Example: `8 + 5 → 8 + 2 = 10 → answer is 10`. This is Kyle's "dropped-carry" candidate. It is a real error mode — but it is not the primary error mode for 7-9yo children doing mental addition.

**Who makes this error.** This is predominantly an error for children who have been taught the make-ten strategy explicitly and are applying it procedurally without full automaticity. For a finger-counter like Marian who uses the count-on procedure rather than explicit decomposition, the error would only arise if she has been taught and is applying make-ten bridging. At Marian's current profile (100% finger reliance on add-to-10), she has not yet internalised the make-ten decomposition as a strategy; she counts on. The "stops at 10" error therefore applies to a different learner profile than Marian's current one.

**Evidence.** The make-ten-bridge-incomplete error is documented in the curriculum literature (e.g., NCETM "bridging 10" resource; Eureka Math Grade 1 Module 2) as a teaching-method-specific error. It is not prominently documented as a spontaneous error pattern in developmental psychology studies of children who use count-on strategies. Baroody (2006, Teaching Children Mathematics, cited in earlier research notes) distinguishes between "counting-on errors" and "derived-fact strategy errors" — the former (which Marian exhibits) produce off-by-one errors; the latter (applying make-ten) can produce the "stops at 10" error. Until Marian transitions to using derived-fact strategies, the bridge-incomplete error is not her primary risk.

**The inference Kyle flags in §7.4.** "The inference path 'subtraction decade-anchor → addition dropped-carry' is plausible but unconfirmed." The research supports a stronger verdict: the subtraction decade-anchor miss (documented in Fuson & Kwon 1992; Baroody 1984 — see sub-to-20 research §3) is a counting-based error that occurs when crossing the decade while counting-back. The addition analog would be pausing at 10 while counting-on — but the cognitive structure differs because counting-on past 10 does not require the child to "cross" and then continue in the way that counting-back does. There is no strong evidence that crossing 10 while counting-on produces a "stop at 10" effect of the magnitude documented for counting-back.

**Evidence strength: Moderate for make-ten-strategy users; Weak-to-none for pure count-on users** (Marian's profile). The error exists; it is not Marian's primary risk at entry to this tier.

### 1.5 Error pattern 4: Doubles confusion (low prevalence for this pool)

**Description.** Child answers with a near-double instead of the correct answer. Example: `8 + 5 = 14` because `7 + 7 = 14`. Or `8 + 5 = 16` because `8 + 8 = 16`.

**Mechanism.** If doubles are over-drilled (exactly the failure mode of the current add-to-20 canon: `6+6, 7+7, 8+8, 9+9` all present), a highly salient doubles answer may intrude when the correct answer is near a double. This is the retrieval-interference mechanism documented by Campbell & Graham (1985) for multiplication and generalised to addition in their network-interference model. For addition, the effect is smaller than for multiplication because addition facts are learned through counting rather than rote table recitation.

**Frequency.** The specific error `8 + 5 = 14` (a near-doubles intrusion) is theoretically plausible but not prominently documented in the empirical literature as a common error. It is more likely to occur in children who have been over-drilled on doubles specifically — which is the scenario the current add-to-20 canon creates. Kyle's doubles-prior correction addresses this structurally.

**Evidence strength: Moderate for the interference mechanism in adults/older children** (Campbell & Graham 1985); **Weak as a documented error for 7-9yo cross-10-bridge specifically.** The concern is real as a design risk if doubles dominate the session; it is not a primary documented error type.

### 1.6 Error pattern 5: Wrong-by-5 / finger-boundary error (novel finding, relevant for Marian)

**Description.** The child produces an answer displaced by exactly 5 from the correct answer. Example: `8 + 5 → 8` (answer is 5 less than correct) or `8 + 5 → 18` (answer is 5 more than correct). This is not a random error — it occurs at elevated frequency relative to other error magnitudes.

**Mechanism.** Children who use sub-base-5 finger counting systems (one hand = 5 fingers) encode numbers as "whole hands plus extra fingers." When solving a cross-10 problem, the boundary between hands (the 5/10 sub-base boundary) creates a structural confusion: the child either fails to carry across from the first hand (under-counts by one hand = -5) or double-counts one hand (+5). Domahs et al. (2008; cited in Domahs, Kaufmann, & Fischer, 2011 review, Frontiers in Psychology, PMC3225925) demonstrated this empirically in primary-school children solving complex addition (sum > 10): errors displaced by exactly 5 occurred significantly more often than expected by distance alone.

**Evidence.** Domahs et al. (2008, "Children's finger use and finger-based representations for number and arithmetic," abstract discussed in PMC3225925) found that the "wrong-by-5" error rate for complex addition was elevated beyond what distance-based error distributions predict. The effect is attributed to the sub-base 5 structure of typical Western finger-counting (5 per hand). The effect was found in German primary schoolers; Filipino / Tagalog finger-counting follows the same sub-base 5 structure (1-5 on first hand, 6-10 spanning both hands), so the structural mechanism applies to Marian.

**Practical implication for Marian.** At 100% finger reliance, Marian is the ideal profile for this error. For facts like `8 + 5 = 13`, the wrong-by-5 errors would be `8` (subtract one hand from correct) or `18` (add one hand to correct). The `8` error is within the chip range; the `18` error is at the ceiling of the chip range (which goes to 20). Neither is currently a chip option — off-by-one chips are `12` and `14`. The wrong-by-5 error would be captured as "neither chip" behavior (child either taps correct by luck or is confused).

**Design implication.** This error does not justify a new Class B distractor chip targeting ±5 values — those would be too far from the correct answer to function well as plausible traps for the majority of problems, and the evidence base is from a single controlled study (not multi-replicated in a way that would support altering the chip design). However, it is worth flagging for Emma's copy: if Marian taps an answer that is exactly wrong by 5, the reprompt or giveAnswer copy could acknowledge the confusion more warmly ("Hmm, let's count together!") rather than applying the same generic reprompt.

**Evidence strength: Moderate** (single controlled study, well-explained mechanism, ecological validity for Marian; but not multi-replicated in a way that would support chip-design changes).

---

## §2 — Verdict on Kyle's §7.4 (Class B "dropped-carry" reject)

### Kyle's two rejection grounds

**Ground 1: Error pattern not documented for mental cross-10-bridge in 7-9yo.**
Kyle's concern is that the dropped-carry error is documented for written multi-digit addition (the child writes the ones digit and forgets the carry mark) but not for mental single-digit cross-10-bridge. The research confirms this distinction. The mental cross-10-bridge error for a count-on user is off-by-one in the bridge step (§1.2), not "stops at 10." The stops-at-10 error occurs in children applying an explicit make-ten-bridge procedure (§1.4), which is a different strategy mode from Marian's current count-on approach. Until Marian is explicitly using the decompose-and-bridge strategy (which is the pedagogical goal of this tier, not the entry behavior), the "stops at 10" error is not her primary risk.

**Verdict on Ground 1: CONFIRMED.** The error pattern Kyle is concerned about is real but arises in a different strategy context (explicit make-ten use) rather than count-on. For Marian entering add-to-20 from a count-on baseline, the dropped-carry error is not the primary risk. Off-by-one (Class 1) is the correct primary class.

**Ground 2: Mechanical fit is patchy (5/22 facts, 2 overlap with Class 1).**
Kyle observed that the dropped-carry distractor (chip value = 10) is plausible only for facts where the bridge step produces 10 and the remaining addend is 1-3 (i.e., the result is 11-13). For HARD-band facts like `9 + 8 = 17`, a chip offering `10` as a dropped-carry trap is implausible — no child would produce `10` from that problem via a counting error; the child would need to drop 7 in the carry, which is not a realistic error on a simple count-on procedure.

**Verdict on Ground 2: CONFIRMED.** The mechanical viability is genuinely limited. A chip offering `10` for `9 + 9 = 18` is not a plausible trap — the child would need to drop 8, which requires miscounting 8 steps as 0. The dropped-carry trap works only for the smallest cross-10 facts (sums 11-13, where the decomposition remainder is 1-3). That is 5 of 22 facts, and 2 of those 5 overlap with Class 1. This alone would make Class B a weak v1 candidate even if the error pattern were more prevalent.

### Overall verdict: CONFIRM REJECT

Both of Kyle's grounds hold. The research additionally confirms that Class 1 (off-by-one) is the dominant covering class for the actual error Marian will make on mental cross-10-bridge, and that wrong-by-5 (the finger-boundary error, §1.6) is a secondary risk that does not justify a dedicated chip. REJECT Class B stands. No amendment needed on §7.4 or §3.4.

---

## §3 — Kyle's §1.4 (doubles-prior correction): 2-cap and no `general` bucket

### Are doubles genuinely earlier-retrieval-fluent than cross-10-bridge facts?

**Yes, with strong evidence.** The "tie effect" (doubles advantage) is one of the most replicated findings in arithmetic cognition research. Tie problems (n + n) are solved faster, more accurately, and earlier in development than non-tie problems with equivalent operands. The effect is documented across ages 5-12 and persists into adulthood.

The mechanism is twofold:
1. **Encoding advantage.** Tie problems share identical operands, so only one operand needs to be encoded to determine the problem type. The single-operand encoding activates a stronger memory trace than two-operand encoding for non-ties (Campbell & Graham, 1985; LeFevre et al., 2003, "Ties, etc.," Memory & Cognition, 31(2), 324-335).
2. **Retrieval history.** Doubles are practised implicitly in many counting contexts (counting by 2s, skip-counting) and are taught explicitly earlier than cross-10 facts in most curricula. By the time a child reaches add-to-20, `6+6=12` and `7+7=14` have more retrieval history than `8+5=13` and `9+4=13`.

The research confirms: tie problems (doubles) are largely retrieved by end of grade 1, while non-tie facts (including cross-10-bridge) are still in the counting-to-retrieval transition through grade 2-3. The developmental sequence is: small non-ties → doubles → large non-ties — not the reverse.

**Evidence.** Baroody et al. (2015, "Tie Bias in Children's Arithmetic Learning," Research in Mathematics Education) document that tie problems are solved before non-tie problems. LeFevre et al. (2003, Memory & Cognition) demonstrate the tie effect persists across ages even as strategies differ. The Semantic Scholar summary of Baroody's work (https://www.semanticscholar.org/paper/Why-Children-Have-Difficulties-Mastering-the-Basic-Baroody/fea74ec9e160de6ad9e50011cfaa2c6d3900f30a) confirms that tie problems are "indirectly solved more often than non-tie problems because they are learnt before non-tie problems and constitute the basis for more complex problems."

**Evidence strength: Strong** (multiple replicated studies, large N, cross-age replication; tie effect is one of the most robust findings in arithmetic cognition).

### Is a 2-cap pedagogically defensible?

**Yes, but with one calibration note.**

The 2-cap is defending against Haiku's observed prior (4-of-8 doubles in the current canon). Given that Marian likely already retrieves `6+6`, `7+7`, `8+8`, and `9+9` from add-to-10 training (or will retrieve them quickly once encountered), the marginal learning gain of a 5th doubles problem in a session is lower than the marginal gain of a cross-10-bridge problem. The 2-cap reflects this by allocating scarce session slots to the harder learning target.

The calibration question is whether 2 is the right number or whether it should be band-aware:
- EASY sessions (P1-P3 only from easy band) will only ever see `6+6` as the doubles entry — the cap is effectively 1 for EASY band.
- MEDIUM/HARD sessions will compete across all four doubles for the 2 slots. Under the current pool, `7+7` (MEDIUM), `8+8` (HARD), and `9+9` (HARD) compete for the 1-2 remaining doubles slots.

A band-aware cap would be: 1 double in easy band (automatically satisfied since only `6+6` is in easy), up to 1 additional double in MEDIUM/HARD discriminate window. This is functionally identical to the cap Kyle specified (≤2 across the session), but makes the pedagogical reasoning explicit: one doubles "anchor" for retrieval warm-up, one doubles fact in the discriminate window to maintain the retrieval contrast. The cap is operationally correct.

**The no-`general` bucket.** Kyle eliminates the `general` category to prevent Haiku from filling a slop bucket with uncategorised cross-10 facts. This is defensible. Every cross-10-bridge fact has a recoverable strategy (make-ten-bridge or doubles-plus-one), so calling any fact "general" would mean "we don't know how Marian should approach it," which is both pedagogically unhelpful and directive-confusing for Haiku.

**Evidence for 2-cap:** Moderate (the specific number 2 is a design call; the direction of correction is strongly supported by tie-effect literature). No empirical study prescribes "2 doubles per session." The number is defensible as a proportion (2/8 = 25%) relative to the doubles' proportion of the full surface (4/49 < 10%) — the cap over-represents doubles relative to their pool proportion, which is correct given their scaffolding role.

**Recommendation: CONFIRM the 2-cap.** No amendment needed on §1.4 or §2.2.

---

## §4 — Commutative pair handling (Kyle §1.3 item 3)

### Should `8 + 5` and `5 + 8` be treated as distinct learning facts?

**Yes, for Marian specifically, during the count-on phase.**

The research on operand-order effects in addition is relevant here. Grabner et al. / Chen & Campbell (operand-order effect in multiplication and addition, PubMed: 24962120) found that "the larger-operand-first order was solved faster than the inverse order" for addition problems in both children and adults, with the advantage attributed to the sequence in which commuted pairs are acquired — children who learn `8 + 5` first retrieve it faster than the reverse.

The mechanism is developmental: children using the count-on strategy apply the min procedure — start at the larger addend and count on the smaller. `8 + 5` with min procedure: start at 8, count 5. `5 + 8` with min procedure: same outcome, but the child must flip the order internally before counting. If the child is using count-on-from-first (non-min), `5 + 8` requires 8 counting steps vs. 5 for `8 + 5`. Either way, `8 + 5` is procedurally easier than `5 + 8` during the count-on phase.

**Once retrieval is established,** the commutative equivalence collapses: adults retrieve `5 + 8` and `8 + 5` with equal latency (within measurement error) because the fact-memory network stores a single trace accessed by either order. But this convergence happens AFTER retrieval is established, not before.

**Implication for Marian.** She is entering add-to-20 as a count-on user. The two orderings are cognitively distinct at this stage: `8 + 5` is the easier ordering (larger first, 5-step count), and `5 + 8` is harder (smaller first, requires internal flip or 8-step count). Both orderings need practice to build independent retrieval traces. Kyle's inclusion of both ordered pairs in the pool (§1.3 item 3) is **correct**, and the pedagogical reasoning is sound.

**One nuance Kyle should know.** The larger-first ordering (`8 + 5`) is the pedagogically preferred ordering for first instruction and for the EASY-band warm-up, because Marian's count-on procedure makes it easier. Both orderings should appear across sessions, but if session design allows, prefer larger-first for P1-P3 introduction of a new fact-pair and smaller-first for later discriminate slots where cognitive load tolerance is higher. This is not a spec change — Kyle's current pool already has this natural structure (EASY band is `9+2, 2+9, 8+3, 3+8, 9+3` — the commutative pairs appear together, and the larger-first forms of each pair are facts 1, 3, 5 in the pool). This is already correct.

**Evidence strength: Strong for operand-order effect in developing counters** (Groen & Parkman 1972; Operand-order PubMed 24962120; converging with the broader min-strategy developmental literature). **Moderate for the claim that separate practice is needed** (the retrieval-trace literature is less direct — it is inferred from the order effect rather than directly measured in intervention studies).

**Recommendation: CONFIRM distinct-facts treatment.** No amendment needed on §1.2 or §1.3.

---

## §5 — Marian-specific application

### Profile summary

- Age 8, Tagalog-primary L2 English learner
- 100% finger reliance on add-to-10, approaching the critical transition window (ages 8-9 per Poletti et al. 2024)
- Subtraction diagnostic: confident within 15, extending to 20 no-borrow — suggesting she has teen-number mental models despite count-on strategy reliance
- Add-to-20 is the first tier requiring cross-10 decomposition concept; she is entering with the concept but not the strategy automaticity

### What Marian's first add-to-20 sessions will look like

Marian will use count-on-from-the-larger-addend (min procedure) for the EASY and MEDIUM band facts she has not yet seen. The first 3-5 sessions will be procedurally correct but slow. The primary errors in those sessions will be:

1. **Off-by-one** (most common) — miscounting one step in the 5-count across the decade boundary. For `8 + 5`, she counts: 9, 10, 11, 12, [13] but may stop at 12 or reach 14.
2. **Wrong-by-5** (less common but structurally systematic) — for problems where one hand's worth of fingers is mistracked. Specifically on MEDIUM/HARD problems with larger second addends (`8 + 5`, `9 + 6`, `7 + 8`) the one-hand boundary is a real risk.
3. **Commutative ordering confusion** (early sessions) — `5 + 8` will be harder than `8 + 5` until min-procedure is internalised, producing more errors on smaller-first commutative pairs.

### The L2 Tagalog angle on cross-10 addition

Tagalog teen number words ("labing-tatlo" = 13) are transparent (base-ten structure embedded in the word), which gives Marian a mild internal model advantage over English monolinguals on the decade-crossing step. Once she crosses 10 in her count, the mental representation "isa-sa-labing" (one past ten) maps naturally onto her L1 number sense. This does not eliminate the procedural count-on difficulty but may support slightly faster strategy transition than English-only peers once she has explicit experience crossing the boundary.

**Note on the L2 load.** English number words for 11-18 are opaque (they do not transparently signal the decade structure the way Tagalog does). Reading `11` as "eleven" gives no structural cue. However, Marian's Tagalog teen-number transparency operates at the L1 conceptual level. The English audio `"eight plus five"` and the chip `13` are the only L2 surface she needs to process; the decade crossing can happen in her internal Tagalog representation and map to the English output. This is an argument for keeping Emma's read-aloud as simple as possible — no verbal decomposition ("eight, then two more makes ten, then three more") — per Kyle's §4.1 prosody block.

### Highest-leverage cross-10 ladder for Marian specifically

Given her profile (count-on with teen-number conceptual transparency), the highest-leverage subset of the 22-fact pool is:

**Tier 1 (first 3-5 sessions):** The 9-anchor facts — `9+2, 9+3, 9+4, 9+5, 9+6, 9+7, 9+8` plus their commutative pairs. The 9-anchor works by near-zero bridge-step (9 is 1 away from 10, so the bridge step costs only 1 count before crossing). These facts build the decade-crossing habit with minimum procedural burden. This is already reflected in Kyle's EASY pool (most EASY facts are 9-anchor or 8-anchor).

**Tier 2 (sessions 4-8):** The 8-anchor facts — `8+3, 8+5, 8+7, 8+9` and pairs. The bridge step for 8-anchor facts costs 2 counts before crossing (2 more to reach 10), which is still low but requires slightly more tracking.

**Tier 3 (sessions 7+):** Near-doubles MEDIUM/HARD — `6+7, 7+8, 8+9`. These build the alternative strategy (doubles-plus-one) that will eventually compete with and replace count-on for these specific facts.

**The pool-of-22 is the right shape.** Kyle's curation already emphasises this ladder structure. The 9-anchor and 8-anchor facts are the core; the near-doubles and doubles are the retrieval anchors for the strategy transition. No amendment is needed.

**One caution.** The HARD band (`9+7=16`, `9+8=17`, `9+9=18`, `7+8=15`, `8+7=15`, `8+8=16`) should be introduced very gradually for Marian. These facts require 6-8 counting steps; at that step count, the wrong-by-5 error (§1.6) becomes the primary failure mode rather than off-by-one. Emma's `reprompt` ("Hmm, try again?") is the right tool — but if Marian misses a HARD-band fact twice, the `giveAnswer` should follow without further prodding. Two miss-and-retry cycles on an 8-step count are anxiety-producing for an 8-year-old.

---

## §6 — Recommended amendments to PR #276

These are listed in order of importance. Items marked AMENDMENT are substantive enough to warrant Kyle revising before Kevin implements. Items marked INFORMATIONAL are findings worth noting for Kyle's record but do not require spec changes.

### AMENDMENT A: None required (no blocking amendments)

The research does not surface any defect in Kyle's spec that would require gating PR #276 on revision. The two core decisions — REJECT Class B and 2-cap on doubles — are confirmed. The commutative-pairs-as-distinct treatment is confirmed. The pool-of-22 shape is confirmed.

**Recommendation to orchestrator:** Do NOT gate PR #276 on this research. Proceed to Kevin's implementation. File informational follow-ups as non-blocking tickets.

### INFORMATIONAL B: Wrong-by-5 error (§1.6) — flag for future copy work

If Marian produces a wrong-by-5 answer in real sessions (e.g., `8 + 5 → 8` or `8 + 5 → 18`), the current `reprompt` text ("Hmm, try again?") is generic. A future copy revision could add Emma's `hand_count_hint` variant for detected wrong-by-5 responses ("Let me help you count both hands!"). This is NOT a v1 spec change — it requires session-history analytics to detect the pattern, which is not in scope. File as a post-launch observation ticket once Marian has real session data.

**Evidence basis:** Domahs et al. 2008 (PMC3225925). Moderate.

### INFORMATIONAL C: Larger-addend-first preferred for first-encounter of each commutative pair

For any new fact-pair entering Marian's session for the first time, the larger-addend-first form (`8 + 5` before `5 + 8`) is the pedagogically preferred first presentation. Kyle's pool already reflects this naturally (larger-first forms are pool entries 1, 3, 5, 7, 9 in the EASY/MEDIUM bands). No spec change needed, but worth noting in the teaching note for Kevin's canon bake so Haiku's first-session plan for add-to-20 favors larger-first for P1-P3.

**Evidence basis:** Operand-order effect literature (PubMed 24962120). Strong for directional claim; Moderate for practical prescription.

### INFORMATIONAL D: Wrong-by-5 is not a new distractor class

Explicitly confirming Kyle's implicit decision not to include a ±5 distractor: this is correct. A chip offset by 5 from correct is too far for MEDIUM/HARD facts (where correct is 13-18; a ±5 chip puts the distractor at 8-13 or 18-23, both plausible-seeming but not plausible-by-error). The off-by-one chip is the right coverage for v1. File for awareness only; no action.

---

## Evidence

**Source 1 — Domahs, F., Kaufmann, L., & Fischer, M.H. (2011). "Handy numbers: Finger counting and the representation of numerical magnitude." Frontiers in Psychology, 2, 328. PMC3225925. https://pmc.ncbi.nlm.nih.gov/articles/PMC3225925/**

Moderate evidence (review article summarising Domahs et al. 2008 primary data plus broader finger-counting-arithmetic interface research). Documents the wrong-by-5 error in primary-school children solving complex addition (sum > 10), attributing it to sub-base 5 structure of finger counting. Key citation for §1.6 wrong-by-5 error. The primary 2008 study (Domahs, F. et al., "Multidigit addition and multiplication in adults") is the source data; this 2011 review is the accessible synthesised reference.

**Source 2 — Geary, D.C., Hoard, M.K., Byrd-Craven, J., & DeSoto, M.C. (2004). "Strategy choices in simple and complex addition." Journal of Experimental Child Psychology, 88(2), 121–151. PubMed: 15157755. https://pubmed.ncbi.nlm.nih.gov/15157755/**

Strong evidence (controlled cross-sectional study across grades 1, 3, 5; N=149). Documents ±1 error rate dominance on complex addition (16+8 type problems) for normally-achieving children using counting strategies. The 10-20% error rate for complex addition in first graders using counting strategies is the frequency estimate for §1.2.

**Source 3 — Robinson, K.M., Ninowski, J.E., & Gray, M.L. (2013). "Young children's use of derived fact strategies for addition and subtraction." Frontiers in Human Neuroscience, 7, 924. PMC3880841. https://pmc.ncbi.nlm.nih.gov/articles/PMC3880841/**

Strong evidence (controlled study, ages 6-7, multiple error categories coded). Documents neighbour errors (off-by-one in compensating direction) as modal procedural error for subtraction; generalises by convergent evidence to addition. The finding that the Inverse principle was used by only ~10% of children even after instruction is the basis for confirming Kyle's dual-exposure rule placeholder as appropriate.

**Source 4 — Groen, G.J. & Parkman, J.M. (1972). "A chronometric analysis of simple addition." Psychological Review, 79(4), 329–343.**

Strong evidence (foundational; widely replicated). Established the min model for children's addition and the tie effect (doubles solved faster). Source for §1.3 strategy-substitution mechanism and §4 operand-order effect.

**Source 5 — Carpenter, T.P. & Moser, J.M. (1984). "The acquisition of addition and subtraction concepts in grades one through three." Journal for Research in Mathematics Education, 15(3), 179–202. JSTOR: https://www.jstor.org/stable/748348**

Strong evidence (3-year longitudinal, grades 1-3). Documents developmental progression through counting strategies; non-min counting on complex problems as source of elevated error counts in early grade 2. Source for §1.3 and §4.

**Source 6 — Baroody, A.J. (2006). "Why Children Have Difficulties Mastering the Basic Number Combinations and How to Help Them." Teaching Children Mathematics, 13(1), 22–31. NCTM. https://pubs.nctm.org/view/journals/tcm/13/1/article-p22.xml**

Strong evidence (widely replicated synthesis; foundational in elementary math cognition). Distinguishes counting-based errors from derived-fact strategy errors; confirms doubles are retrieved earlier than non-tie facts. Source for §1.4 (make-ten-bridge-incomplete error is strategy-mode-specific) and §3 (doubles retrieval advantage).

**Source 7 — Domahs, F., Krinzinger, H., & Willmes, K. (2008). "Mind the gap between both hands: Evidence for internal finger-based number representations in children's mental arithmetic." Cortex, 44(4), 359–367. (Full citation; discussed in Source 1 review.)**

Moderate evidence (primary controlled study behind wrong-by-5 finding; see Source 1 for accessible version). Documents the wrong-by-5 error pattern in German primary-school children on complex addition (sums > 10).

**Source 8 — Chen, O. & Campbell, J.I.D. (2014). "Operand-order effect in multiplication and addition: The long-term effects of reorganization process and acquisition sequence." PubMed: 24962120. https://pubmed.ncbi.nlm.nih.gov/24962120/**

Moderate evidence (adult study establishing operand-order effect persistence and attribution to acquisition sequence). The finding that "larger-operand-first order was solved faster" and that "order preferences are influenced by the sequence in which the members of a commuted pair are acquired" is the basis for §4 commutative-pairs analysis.

**Source 9 — Poletti, S., Thevenot, C., et al. (2024). "Finger counting training enhances addition performance in kindergarteners." Child Development, 96(1), 251–268. PMC11693818. https://pmc.ncbi.nlm.nih.gov/articles/PMC11693818/**

Strong evidence (RCT, N=328 + replications). Documents the finger-counting developmental window and the ~age 8-9 transition point. Basis for characterising Marian as "entering the transition window" in §5.

**Source 10 — Baroody, A.J., Purpura, D.J., Eiland, M.D., Reid, E.E., & Paliwal, V. (2015). "Does fostering reasoning strategies for relatively difficult basic combinations promote transfer?" Journal for Research in Mathematics Education, 46(3), 345–370. (Cited in Semantic Scholar summary: https://www.semanticscholar.org/paper/Why-Children-Have-Difficulties-Mastering-the-Basic-Baroody)**

Moderate evidence (intervention study). Documents tie-problem advantage and earlier retrieval for doubles vs non-ties. Source for §3 doubles-advantage evidence.

**Source 11 — Royal Society B (2025). "Decade effects in mental addition." Philosophical Transactions B, 380. https://royalsocietypublishing.org/doi/10.1098/rstb.2024.0220**

Moderate evidence (adult study; provides mechanistic frame for decade-crossing difficulty). Adults with strategic choice produce fewer errors on complement problems (non-crossing) than supercomplements (crossing), confirming decade-crossing is categorically harder. The finding is for adults but the mechanism generalises with larger magnitude to children. Source for §1.1 conceptual backdrop.

---

## Application to Marian

Marian's cross-10-bridge errors will be dominated by off-by-one miscounting in the bridge step (§1.2). The wrong-by-5 error (§1.6) is an additional systematic risk specifically because of her finger-counting profile. The make-ten-bridge-incomplete (§1.4) is not yet her error mode; she will develop that error pattern later, when she begins using explicit decomposition rather than counting-on.

The EASY band (9-anchor and 8-anchor facts with small bridge steps) is correctly prioritised to build cross-decade confidence before MEDIUM/HARD band problems are introduced. The gentle-ramp window (P1-P3) is essential for cross-10 facts because the anxiety cost of a wrong answer on the first decade-crossing attempt is higher than for within-10 facts (Mammarella et al. 2023, Annals of NYAS, in prior Dave research notes).

The L2 Tagalog context provides a mild structural advantage on mental decade-crossing (transparent teen-number words in L1 support the conceptual decade model), but does not reduce the procedural count-on difficulty. Emma's read-aloud being plain-English numeral names without verbal decomposition is correct.

---

## Risks / counter-evidence

**1. The wrong-by-5 finding is a single study (Domahs et al. 2008) in German children.** Tagalog and German sub-base-5 finger systems are structurally similar (one hand = 5, both hands = 10), so the mechanism should transfer. But the specific error frequencies have not been replicated in a Filipino/Tagalog sample. I am flagging it as a moderate-evidence finding, not a confirmed effect for Marian specifically.

**2. The make-ten-bridge-incomplete error may emerge during the tier.** If Marian is taught the explicit decompose-and-bridge strategy (by a parent or teacher outside the app), she could begin applying it mid-tier and start producing "stops at 10" errors. The spec has no mechanism to detect strategy-mode change. This is a monitoring gap, not a design flaw — the `giveAnswer` path handles it regardless of strategy mode.

**3. Commutative-pair data is primarily from adult studies.** The operand-order effect in children is inferred from the developmental progression literature (Groen & Parkman, Carpenter & Moser) rather than directly measured in an RCT for the 7-9 age range specifically. The evidence is strong for the directional claim (larger-first is easier during count-on phase) but moderate for the practical prescription (practice both orders explicitly).

**4. The doubles advantage is documented primarily for simple (within-10) doubles.** The tie effect for teen doubles (`6+6=12`, `7+7=14`, `8+8=16`, `9+9=18`) is less directly studied than for within-10 doubles. It is reasonable to assume the effect extends to teen doubles by the same mechanism (encoding efficiency + retrieval history), but this is an extrapolation.

---

## Recommendations

### For Matt (ticket priority / scope)

1. **PR #276 is clear to proceed.** No blocking amendments. Kyle's Class B reject (§7.4) is confirmed by the research; Kevin can implement the spec as written.

2. **File a non-blocking follow-up ticket** for "Emma copy — wrong-by-5 reprompt variant." This is a post-launch observation item that requires session data before it can be designed. Low priority; no August 2026 dependency.

3. **Note for the sub-to-20 → add-to-20 parallel-exposure point.** When Marian is practising both sub-to-20 and add-to-20 (sequentially per `MATH_TREE`, but with fact-family inverse exposure as a benefit), the wrong-by-5 error in addition may mirror as a +5 or −5 count error in subtraction. Both tiers' off-by-one chip coverage handles this. No action needed.

4. **The wrong-by-5 finding is a useful input to the 2-digit-addsub spec (future).** When Marian reaches multi-digit addition with carrying, the wrong-by-5 hand-boundary error will manifest as a full-hand carry error (e.g., `13 + 8 = 11` — drops one hand). Flag this research note for that future spec writer.

### For Kyle (spec guidance)

1. **No amendments needed on §7.4, §1.4, or §1.3.** All three are confirmed by the research. Proceed with Kevin.

2. **Consider adding a pool-table note in §1.1 to indicate that larger-addend-first form of each commutative pair should be preferred for first-encounter.** This is implementable as a one-line directive addendum to §4.1: "For each commutative pair, prefer the larger-addend-first form for the first discriminate-slot appearance." Not a blocking amendment.

3. **The wrong-by-5 error (§1.6) does not warrant a distractor chip.** It is an observational finding for post-launch monitoring, not a v1 spec change.

4. **The `general = 0` decision is confirmed.** The research supports it on doubles-interference grounds (§3): an uncategorised pool entry would dilute the directive without pedagogical justification.

---

## Non-obvious findings

**1. The wrong-by-5 error is new to the project's research corpus.** Neither the sub-to-10 nor sub-to-20 research notes flagged it (it is less relevant for subtraction, where the decade-crossing is backward-counting and the hand-boundary confusion is less likely to produce a clean ±5 error). For Marian's add-to-20 tier as the first true cross-10-bridge tier with a finger-counter, this is the most novel finding in this research note. It does not change the spec; it is the most useful new input for post-launch monitoring.

**2. Kyle's §7.4 Class B reject is stronger than Kyle knew.** Kyle flagged it as "sketchy" and "patchy mechanical fit." The research confirms: not just sketchy — the error pattern it targets (make-ten-bridge-incomplete) is strategy-mode-specific to explicit decomposition users, not count-on users. Marian is a count-on user at entry. The Class B trap would be pedagogically misaligned at entry, even if it is pedagogically coherent for children who have internalised the decompose-and-bridge strategy. This finding could inform how future specs handle strategy-mode transitions.

**3. Potential `.claude/docs/skill-trees-and-content.md` addition.** The wrong-by-5 error is a new named error class not in the existing distractor taxonomy. It is unlikely to become a chip class, but it could be added to the "Math distractor notes" section as a monitoring class: "error magnitude = ±5 from correct, attributed to finger sub-base-5 boundary confusion; most relevant for cross-10-bridge addition, less relevant for subtraction." This would give future spec writers a reference point.

**4. For 2-digit-addsub spec (future).** The carrying operation in multi-digit addition (e.g., `13 + 8 = 21`, carry the 1) is the procedural successor of the cross-10-bridge step. The wrong-by-5 error has a natural 2-digit analog: miscarrying one hand's worth of fingers. This research note should be listed as a reference document for the 2-digit-addsub spec.
