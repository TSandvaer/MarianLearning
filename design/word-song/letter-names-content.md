# Word Song — letter-names content/pedagogy spec (Wave 7 Track A, Tier A1)

**Ticket:** `86c9y4960` — A1, Wave 7 Track A, "letter-names content/pedagogy spec (Kyle)". Epic `86c9y494c`.
**Status:** Draft for sponsor review / Dave hand-off.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #211 (digraph-tier sibling split — the sibling-tier infrastructure this spec relies on already exists); short-i / short-e / short-u / short-o pool-expansion specs (structural template); `design/research/phonics-sequence-marian.md` (anchor for sequencing).
**Companion specs (downstream):** A2 `letter-names` Haiku directive (Dave), A3 canon bake + planner wiring + optional lint binding (Kevin), A4 failing-first E2E (Jessica). Tier-A5 `letter-sounds` spec is being authored in parallel and consumes some of the same Marian-current-level context — that spec is the bridge from glyph recognition (this tier) to phoneme recognition (next tier).

---

## 0. Why this spec, why now

`letter-names` is the **first** literacy tier in `WORD_SONG_NODES_IN_ORDER` (`MarianLearning/src/lib/progress/focusNode.ts:66`) and the **only one** that ships before Marian encounters any decoding load. Today it is in `VALID_WORD_SONG_FOCUS_NODES` (`api/_planner.ts:154-171`) but absent from `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts:650-661`), so `effectiveFocusNode` falls it through to the `blending-cv` stub. Anyone who lands on the `letter-names` node today sees `"Tap the cat."` content with the short-a CVC picture pack — accidentally fine, but not what the tier name promises.

Two structural facts make this spec materially **lighter** than the short-vowel tier specs and motivate writing it as cleanly as the audit allows rather than over-engineering it:

1. **Marian's alphabet is mastered with minor b/d confusion.** Per `CLAUDE.md` § "Marian's current levels": _"Alphabet | Mastered (minor b/d confusion)."_ This tier is **review mode by design**, not novel acquisition. From Marian's perspective, an 8-problem session should be a fast cruise — most items at ≥95% accuracy on first response, with a small concentrated lift on the b/d/p/q confusion class.
2. **No picture-pack assets are needed.** Letter-name recognition is glyph recognition (does Marian map the shape `A` to the spoken name "ay"?), not vocabulary scaffolding. The chip is the letter itself; no `picture-{word}.svg` pipeline applies. This makes the tier **bake-once-and-leave** — zero MJ generation cost, zero `wordPack.ts` `WordEntry` work, zero picture-pack budget impact.

`letter-names` also serves a **tree-completeness** purpose: until it is first-class, the picker (`pickFocusNode` in `MarianLearning/src/lib/progress/focusNode.ts`) silently routes any user whose `letter-names` is the lowest non-mastered node to the `blending-cv` content instead. That is a graceful-degradation behaviour, but it means the tier exists in name only. Wave 7 Track A's job is to make the tier **render its own content** so the progression line `letter-names → letter-sounds → blending-cv → cvc-words → …` is honest end-to-end.

**Scope of this spec:** per-letter prompt template, the 8-problem pool composition rule (which letters per session, uppercase/lowercase mix, alphabetical vs. random, gentle/trap band by letter-shape confusion class), distractor strategy (which letters serve as gentle vs. trap distractors per target), render contract (3 chips per problem, letter glyphs not pictures), session-shape acceptance criteria, mastery rule.

**Out of scope** (explicit; mirrors the ticket Out-of-scope list):

- TTS phoneme handling — that lives in Tier A5 (`letter-sounds`) which is being authored in parallel.
- Sight-words and simple-sentences — Wave 8.
- Cross-vowel anything — this is the alphabet tier; no vowel-tier coupling.
- Picture-pack pipeline — letter glyphs only; no pictures.
- `SkillNode`-widening checklist (the 14-16 points in `.claude/docs/sibling-tier-checklist.md`) — `letter-names` is already in the `WordSongNode` union and `LITERACY_TREE` / `WORD_SONG_NODES_IN_ORDER` constants. Per the ticket non-obvious context: _"The letter-names tier does NOT need to widen WordSongNode (it's already in the union); the 15-place sibling-tier checklist applies only to brand-new sibling nodes."_ The pool-extension five-point checklist in `skill-trees-and-content.md` also does not apply — there is no `wordPack.ts TARGET_WORDS` entry, no `TARGET_PAIRINGS` row, no `VALID_*_WORDS` Set; the canon JSON is the source of truth on its own for this tier.

---

## 1. Letter coverage and pool composition

### 1.1. The 26-letter pool

The full pool is the **26 letters of the English alphabet**: `A B C D E F G H I J K L M N O P Q R S T U V W X Y Z` (uppercase) and `a b c d e f g h i j k l m n o p q r s t u v w x y z` (lowercase). All 26 letter names are in active vocabulary for an alphabet-mastered 8-year-old — see Marian's diagnostic, summarized in `phonics-sequence-marian.md` and `CLAUDE.md`.

There is **no case-only restriction in v1** — both uppercase and lowercase glyphs are eligible targets and distractors. The same letter (e.g. `A` and `a`) is treated as **two distinct chips** when displayed, but **the same target letter-name** when spoken (`"Tap the letter A."` accepts a tap on either `A` or `a` per the same-name rule below — but for v1 simplicity, we lock case-match at the chip level; see §1.3).

### 1.2. The b/d/p/q confusion class (load-bearing)

Per `CLAUDE.md` current-levels and per the April-2026 diagnostic surface, Marian's **single residual letter-recognition confusion is the b/d/p/q quartet** — four glyphs that share a circle-and-stick topology and differ only in stick-orientation. This is developmentally normal at age 8 (per `phonics-sequence-marian.md` § "The b/d confusion": _"normal at 8 years old, is present in the majority of children this age regardless of L1, and self-resolves with reading exposure over 6–12 months"_) and does not require targeted intervention beyond what the existing CVC word lists provide.

But this tier — letter-name recognition — is **the one place where the b/d/p/q confusion is the literal subject of the assessment**. A b/d/p/q chip can be deliberately included in the trap window (problems 4–8) so the tier surfaces Marian's actual residual confusion rather than running 8 trivial-grade items.

The **b/d/p/q confusion class** is the load-bearing pedagogical concept for this tier. The pool composition rule below leans on it.

### 1.3. Pool composition rule — 8 problems per session

Each Word Song letter-names session emits **8 problems**, matching the Math + CVC-tier session shape. Composition:

| Slot                | Tier                      | Letter class                                                            | Notes                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–3 (gentle window) | gentle                    | **Visually distinct letters** (the "clean glyph" pool — see §1.4 below) | 3 quick wins to open the session. Marian sees `M, S, T, A` etc. — letters with unique silhouettes that cannot be confused with any other letter.                                                                                                                                                                                                             |
| 4–5 (mid-tier)      | gentle-to-trap transition | **Mixed pool** — at least 1 trap-class target                           | Begin introducing one b/d/p/q confusion-class target around problem 4. The transition mirrors the Math tier's `GENTLE_RAMP_THROUGH = 3` cutoff.                                                                                                                                                                                                              |
| 6–8 (trap window)   | trap                      | **b/d/p/q confusion-class targets preferred, but not mandatory**        | Problems 6–8 actively probe the b/d/p/q confusion. At least **1 of these 3 problems** must have a b/d/p/q target; the cap of **≤2 of 8 problems may be from the b/d/p/q class** prevents the session from feeling like a remediation drill. The remaining 1–2 trap slots use other moderately-similar glyph pairs (e.g. `O ↔ Q`, `I ↔ l`, `m ↔ n`, `u ↔ v`). |

**Hard constraints on the composition (Haiku directive must enforce):**

- **Exactly 8 problems per session.** Same as every other tier.
- **No letter appears more than once as a target across the 8 problems.** (Distractors may repeat across problems — there are only 26 letters and a 8-problem session has 8 × 3 = 24 chip slots; some chip-repetition is unavoidable. But the **target** of each problem must be unique within the session.)
- **At least 1 target from the b/d/p/q confusion class.** This is the "ensure the tier does its job" anchor. Composition is meaningless if every session is 8 gentle items.
- **At most 2 targets from the b/d/p/q confusion class.** Cap prevents over-drilling the confusion. Marian's CVC tiers handle b/d residue naturally via word-context; this tier surfaces it once or twice per session, not constantly.
- **At least 4 gentle-class targets** (problems 1–3 fully + at least 1 of problems 4–5). Maintains the session's overall "review mode" feel for an alphabet-mastered learner.
- **Mixed case across the 8 targets:** at least 2 uppercase targets AND at least 2 lowercase targets. Pure-case sessions break the implicit promise that the tier covers both glyph systems.

### 1.4. Letter-shape bands (the "glyph confusion taxonomy")

To make the gentle/trap distinction operationally crisp for the Haiku directive (and for the optional compositionLint binding Kevin may add per A3), letters are grouped into named confusion-shape bands. **A target in band X may not have a distractor from band X unless the band is explicitly the "trap pair" being probed in this problem.**

| Band ID                                        | Members (uppercase / lowercase)                                                                                                                                                  | Notes                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **CIRCLE-STICK** (the load-bearing trap class) | `b, d, p, q`                                                                                                                                                                     | The Marian-specific residual confusion. Lowercase only — uppercase `B, D, P, Q` are visually distinct and do not belong here.                  |
| **MIRROR-LATERAL**                             | `b/d`, `p/q`, `M/W`, `N/Z` (uppercase), `n/u`, `m/w`                                                                                                                             | Glyphs that are mirror/rotation pairs of each other. Subset overlap with CIRCLE-STICK on the b/d, p/q pairs.                                   |
| **CIRCLE-FAMILY**                              | `O, o, Q, 0` (zero excluded — we never emit digits), `C, c, G`                                                                                                                   | Round-bodied glyphs. Used for trap-tier when probing `O ↔ Q` specifically.                                                                     |
| **VERTICAL-STICK**                             | `I, l, 1` (digit excluded), `i, j, t`                                                                                                                                            | Tall-thin glyphs. `I ↔ l` is the classic font-collapse risk; mitigate at the render layer (§4) by picking a font that disambiguates these two. |
| **CURVED-OPEN**                                | `C, c, G, U, u, n`                                                                                                                                                               | Open-on-one-side glyphs. Used for trap-tier pairs like `C ↔ G` or `u ↔ n`.                                                                     |
| **DOUBLE-HUMP**                                | `M, m, W, w, N, n`                                                                                                                                                               | Multi-stroke glyphs with repeated humps. `M ↔ W` is a rotation pair; `m ↔ n` is a hump-count pair.                                             |
| **CLEAN-GLYPH**                                | All letters NOT in any other band: `A, E, F, H, J, K, L, R, S, T, V, X, Y, Z` (uppercase) + `a, e, f, g, h, k, r, s, v, x, y, z` (lowercase, minus those already in other bands) | The "visually distinct" pool. Used for gentle-window targets and gentle-window distractors.                                                    |

Lowercase `b/d/p/q` appear in BOTH CIRCLE-STICK and MIRROR-LATERAL — both labels are valid; CIRCLE-STICK is the operative label for trap-pair selection because it captures the specific Marian-diagnostic confusion class. MIRROR-LATERAL is documented for completeness and for the future case where the spec needs to talk about rotation-pair confusions in general (e.g. `M ↔ W` uppercase).

**Bands are not mutually exclusive at the letter level** (e.g. lowercase `m` is in MIRROR-LATERAL via `m/w` AND in DOUBLE-HUMP). The Haiku directive checks each band membership independently when selecting distractors; same-band overlap with the target is the trap signal.

### 1.5. Alphabetical-walk vs. random sampling

**Decision: pure random sampling with per-session uniqueness, NOT alphabetical walk.** Justification:

- An alphabetical walk (sessions covering A-H, I-P, Q-Z over three sessions) **would feel like rote drill** for an alphabet-mastered learner. The whole tier is review-mode; predictability removes the small interest the tier carries.
- Random sampling with the §1.3 composition constraints (gentle-class first, b/d/p/q in trap window, mixed case) gives Marian a **mixed but bounded** session — she does not know which 8 letters she will see, but the shape of the session is consistent.
- The Haiku planner's natural variance per session-start call already produces the random sampling; we lean on that rather than building deterministic-walk logic.
- For a re-bake or post-deploy data signal showing alphabetical bias is needed (e.g. Marian's actual session log reveals consistent letter-gap), the rule can be sharpened at re-bake time without re-spec work.

This is the only "alphabetical walk vs random" decision worth making here. Other tiers (CVC) use random-from-pool inherently because the pool is small (~8-14 words); the alphabet's 26 letters could in principle support a "walk" structure, but the pedagogical value at Marian's level does not warrant it.

---

## 2. Utterance template — the read line and the 8 utterance slots

### 2.1. Read-line template

**`"Tap the letter <LETTER>."`** — uppercase form `<LETTER>` is the **spoken letter name** (e.g. "A", "B", "C" — pronounced "ay", "bee", "see").

Examples:

- `"Tap the letter A."` (target chip: glyph `A`)
- `"Tap the letter b."` (target chip: glyph lowercase `b`; spoken as "bee" — same letter name as `B`)
- `"Tap the letter Q."` (target chip: glyph `Q`)

**Why the explicit `"the letter X."` framing, not just `"Tap the X."`** — the CVC-tier read line is `"Tap the cat."` where the noun is a thing. For letter-names, `"Tap the A."` reads as if A were a noun ("Tap the apple"-shape), which would be confusing to Marian whose English-comprehension floor still has some L2 friction. The phrase **"the letter A"** is unambiguous and matches how Emma frames letter-naming in everyday speech.

### 2.2. Case-spoken disambiguation

**Decision: letter-name is the same regardless of case.** Both `A` and `a` are spoken as "ay" by Emma — they are the same letter, two glyphs. So the read line `"Tap the letter A."` could in principle accept a tap on EITHER an uppercase `A` chip OR a lowercase `a` chip in the trio.

**Render contract resolution (v1 simplicity):** the **glyph case in the spoken read line is the case Marian must tap.** So `"Tap the letter A."` (uppercase target) requires tapping the uppercase `A` chip; `"Tap the letter b."` (lowercase target) requires tapping the lowercase `b` chip. The Haiku directive renders the read-line with the matching case **embedded in the target chip's text-rendering**, not in the spoken word. Emma's voice still says "ay" for both — the chip's visual case is the disambiguator.

This is the **single biggest open question** for sponsor and Dave review — see §7 Q1. If the answer flips to "case-insensitive tap accepted," the read-line text stays the same; only the click-handling logic in `Math.tsx` / WordSong screen widens to accept either case as the correct chip. The Haiku directive does not change.

### 2.3. The 8 utterance slots per problem

Mirroring the CVC-tier shape (`screens-and-flows.md` §"Math screen" + `skill-trees-and-content.md` §"Word session plans"), each problem emits 5 utterance slots:

| Slot         | Template                                                                                                                                         | Example (target = uppercase `M`) |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `read`       | `"Tap the letter <NAME>."`                                                                                                                       | `"Tap the letter M."`            |
| `correct`    | `"Yes! That's the letter <NAME>."`                                                                                                               | `"Yes! That's the letter M."`    |
| `reprompt`   | `"Hmm... try again?"` (verbatim across all problems and tiers, per the existing CVC canon — see `blending-cv.json` and `cvc-words-short-i.json`) | `"Hmm... try again?"`            |
| `hint`       | `"Let's look. <NAME>."`                                                                                                                          | `"Let's look. M."`               |
| `giveAnswer` | `"This one is the letter <NAME>."`                                                                                                               | `"This one is the letter M."`    |

Plus the standard session-end utterance bundle (`session.end.opener`, `session.end.recap.<N>`, `session.end.streak.<N>`) that every canon JSON ships — see `blending-cv.json` for the canonical session-end set. The Haiku directive must include the full session-end bundle on session-end calls; this is not letter-names-tier-specific.

**Utterance ID namespace:** `word.p<N>.<slot>` (canonical, same as every other Word Song tier — see `wordSongUtteranceId(problemIndex, slot)` in `wordSessionPlans.ts:115`). E.g. `word.p1.read`, `word.p1.correct`, `word.p1.hint`, `word.p1.giveAnswer`, `word.p1.reprompt` for problem 1.

### 2.4. Spelling vs. pronunciation in `<NAME>` substitution

In the read-line template, `<NAME>` is **the letter glyph as a single character** (e.g. `M`, `b`, `Q`) — not a phonetic spelling like "em" or "kyoo". Azure Speech (`en-US-EmmaMultilingualNeural` per `audio-system.md`) handles single-letter pronunciation correctly out of the box for the ASCII alphabet — `"the letter M"` is rendered as "the letter em" by the voice engine without SSML phoneme override. **The Haiku directive must NOT wrap individual letters in `<phoneme>` SSML tags** — per `project_audio_phoneme_overrides` memory, defensive SSML wrapping on unaffected words can degrade pronunciation. Letter-name pronunciation is the voice engine's native strength; trust it.

Exception flagged as §7 Q3: the letter `A` in isolation is sometimes pronounced "uh" (article) instead of "ay" (letter name) by some voice engines. If empirical post-bake testing reveals this drift, the targeted SSML wrap `<phoneme alphabet="ipa" ph="eɪ">A</phoneme>` is the fix — but apply ONLY to `A`, not to all letters. Same defensive principle as the "four" / sub-to-10 fix in `audio-system.md`. **Pre-bake assumption: no SSML wrapping needed.** Validate at A4 Jessica E2E spec.

---

## 3. Distractor classes and selection rules

### 3.1. Per-tier distractor rule

Each problem emits **3 chips** (1 target + 2 distractors), mirroring every other Word Song tier (`wordDistractors.ts:65` `GENTLE_RAMP_THROUGH = 3`).

| Tier           | Problems | Distractor rule                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gentle`       | 1–3      | Both distractors from **CLEAN-GLYPH** band, neither sharing the target's band. E.g. target = `M`, distractors = `S, T` (both clean-glyph, neither double-hump nor mirror-lateral).                                                                                                                                                                                                                   |
| `gentle-mixed` | 4–5      | One distractor from CLEAN-GLYPH (or any band the target is NOT in); the other may optionally be from a same-band-as-target neighbour (a soft trap). E.g. target = `b` (CIRCLE-STICK), distractors = `S` (clean) + `p` (CIRCLE-STICK, same-band soft trap).                                                                                                                                           |
| `trap`         | 6–8      | When target IS in CIRCLE-STICK (the b/d/p/q quartet), at least one distractor MUST be another CIRCLE-STICK member. E.g. target = `b`, distractors = `d, S` or `d, p`. When target is in another confusion band (CIRCLE-FAMILY, VERTICAL-STICK, etc.) and the target-band has ≥2 members, at least one distractor SHOULD be from the same band. Trap window's job is to surface the actual confusion. |

**Hard distinctness constraints (must hold for all 3 tiers, enforced by the Haiku directive and optionally by Kevin's lint binding):**

1. **All 3 chips are distinct letters.** No `[M, M, S]` trios. (Trivial; the Haiku directive's chip-pool sampler handles this naturally.)
2. **The target chip is among the 3 chips emitted.** (Trivial.)
3. **Chip case is consistent with the read-line case.** If the read line is `"Tap the letter M."` (uppercase), the target chip is uppercase `M`. Distractor chips may be either case — but at least one of the two distractors MUST share the target's case (to prevent the "obvious by case" cheat where the only uppercase chip in a lowercase-target trio is trivially-correct-by-case). See §3.2 for the case-mixing rule.
4. **No digit may appear as a chip.** The pool is letters only; never `0` for `O` or `1` for `I`. (Trivial; the Haiku directive's pool is the 26 letters × 2 cases = 52 glyphs, no digits.)
5. **No same-letter-different-case in the same trio.** Never `[A, a, S]` — same letter-name is the same letter, so an `A` and `a` together in one trio violates the distinctness rule at the letter-name level even though the glyphs are different. (See §7 Q1; if case-insensitive tap is adopted, this becomes a hard render-side constraint; if case-strict tap is adopted, this is still the right rule to avoid confusing Marian about whether the same-name pair counts as two choices.)

### 3.2. Case-mixing rule for distractors

For each problem, the chip case-mix MUST satisfy:

- **All 3 chips share the same case OR 2-of-3 share the case of the target.**
- **The target's case is the "majority case" of the trio.** A trio like `[M (upper, target), s (lower), T (upper)]` is acceptable: 2 uppercase including the target. A trio like `[M (upper, target), s (lower), t (lower)]` is rejected: the target is the only uppercase chip, which is a giveaway.

This prevents the "spot the odd-cased chip" shortcut where Marian could tap the chip whose case matches the read-line without actually reading the letter glyph.

### 3.3. Worked examples

| Tier         | Problem | Read line             | Target chip                                               | Distractor 1               | Distractor 2                      | Why                                                                                                                                                       |
| ------------ | ------- | --------------------- | --------------------------------------------------------- | -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gentle       | 1       | `"Tap the letter M."` | `M` (DOUBLE-HUMP)                                         | `S` (CLEAN)                | `T` (CLEAN)                       | Both distractors clean-glyph; no double-hump overlap with target.                                                                                         |
| gentle       | 2       | `"Tap the letter a."` | `a` (CLEAN lowercase)                                     | `r` (CLEAN lc)             | `k` (CLEAN lc)                    | All lowercase to match target case; all clean-glyph.                                                                                                      |
| gentle       | 3       | `"Tap the letter K."` | `K` (CLEAN upper)                                         | `H` (CLEAN upper)          | `R` (CLEAN upper)                 | Three clean-glyph uppercase; no shape confusion.                                                                                                          |
| gentle-mixed | 4       | `"Tap the letter b."` | `b` (CIRCLE-STICK lc)                                     | `S` (CLEAN upper)          | `d` (CIRCLE-STICK lc — soft trap) | Soft trap: one same-band distractor + one clean-glyph anchor. Mixed case acceptable per §3.2 because 2 of 3 chips are lowercase (target's case majority). |
| gentle-mixed | 5       | `"Tap the letter O."` | `O` (CIRCLE-FAMILY upper)                                 | `T` (CLEAN upper)          | `Q` (CIRCLE-FAMILY upper)         | Soft trap on circle-family.                                                                                                                               |
| trap         | 6       | `"Tap the letter p."` | `p` (CIRCLE-STICK lc)                                     | `q` (CIRCLE-STICK lc)      | `b` (CIRCLE-STICK lc)             | Full trap: target plus two same-band distractors. Probes Marian's b/d/p/q confusion directly. All lowercase, case-uniform.                                |
| trap         | 7       | `"Tap the letter W."` | `W` (DOUBLE-HUMP / MIRROR-LATERAL upper)                  | `M` (MIRROR-LATERAL upper) | `N` (DOUBLE-HUMP upper)           | Trap on rotation/mirror pair `W ↔ M` + hump-shape `W ↔ N`.                                                                                                |
| trap         | 8       | `"Tap the letter d."` | `d` (CIRCLE-STICK lc, second b/d/p/q target this session) | `b` (CIRCLE-STICK lc)      | `g` (CLEAN lc — anchor)           | Second b/d/p/q probe (within the cap of 2-per-session).                                                                                                   |

This is **one valid session shape** — there are many valid permutations. The Haiku directive's job is to sample within the §1.3 constraints, not to reproduce this exact session.

---

## 4. Visual / render contract (no picture pack)

### 4.1. Chip layout

Same 3-chip layout as every other Word Song tier (per `screen-4-word-song.md` and the CVC `wordPictures.tsx` consumer). Three chips in a horizontal row, target chip random-position within the trio per the existing `AnswerChips` position-randomisation.

**Chip content:** instead of a `picture-{word}.svg` rendered in the chip frame, the chip contains the **letter glyph rendered as text** in a chip-sized typographic frame. The chip frame, hit area, and spring-on-tap animation are **unchanged from the CVC-tier chip** — only the inner content swaps from `<img>` to `<span class="letter-glyph">`.

### 4.2. Glyph font and rendering

**Font selection — Kevin's call at A3 impl time, but recommendation here:** use a **simple sans-serif font that disambiguates `I` (uppercase i) from `l` (lowercase L) from `1` (digit one)**. The default iPad system font (San Francisco) does this passably but lowercase `l` and uppercase `I` collapse at small sizes. Recommended explicit choices:

- **Inter** (already in many React-Vite projects) — disambiguates `Il1` clearly with the dotted uppercase `I` variant.
- **Atkinson Hyperlegible** (open-source, dyslexia-friendly) — purpose-built to disambiguate similar glyphs including `b/d/p/q`. This is the **strong recommendation** for the letter-names tier specifically because the entire tier's job is glyph disambiguation; the font should not work against the pedagogy by introducing ambiguity.
- **Lexend** (also disambiguation-focused) — second-choice alternative.

**Critical anti-pattern:** do NOT use a stylised display font (cursive, decorative, hand-drawn) for letter-name chips. The chip glyph IS the assessment; if the font's stylisation introduces shapes Marian doesn't recognize as the same letter she sees in CVC tiers, the tier fails.

**Glyph size:** chip glyph occupies ~60-70% of the chip's inner height — comparable to the visual mass of a picture-pack SVG. Specific: chip frame is the existing CVC chip size (~96pt square per the existing iPad layout), glyph cap-height is ~64pt within that frame. Centred horizontally and vertically.

**Glyph colour:** **single dark colour** (recommend `#1F2937` slate-800 or the existing CVC text colour from the chip frame's text-rendering layer, whichever Devon's design-tokens map prefers). NO multi-colour glyphs, NO gradient fills, NO decorative outlines — the pedagogy demands the glyph be read as itself, not as a decorated object. Same principle as the FORBIDDEN_PAIRS rule in CVC: visual noise hurts the chip's read.

### 4.3. No picture-pack budget impact

**No new entries in `public/assets/pictures/`** for this tier. No MJ generation, no remove.bg pass, no `yarn embed-pictures` run. The Wave-7 picture-pack budget surface is unaffected by Tier A1. (Tier A5 `letter-sounds` similarly has no picture pack — see that parallel spec.)

This is a key reason this tier is **bake-once-and-leave**: the only artifact that ships is `public/canon/word-song/level-1/letter-names.json` plus the planner directive in `api/_planner.ts` plus the lone-literal addition to `WORD_SONG_FIRST_CLASS_FOCUS_NODES`.

### 4.4. Speech-ribbon caption walk (unchanged)

The speech-ribbon caption renders the spoken read line verbatim (per `emma-character-and-animation.md` § "speech-ribbon caption walk"). For Tier A1 that means the on-screen caption reads `"Tap the letter A."` while Emma speaks the same. No special caption handling needed.

---

## 5. Progression criteria

### 5.1. Session-by-session

Standard Word Song session shape: **8 problems, one session-end celebration.** No structural delta vs. CVC tiers.

A session is "complete" when all 8 problems have been attempted (regardless of accuracy). Same as every other tier — the `sessionEnd` event fires on problem-8 completion (per `screens-and-flows.md`).

### 5.2. Per-problem accuracy

Per the existing Word Song problem flow (per `audio-system.md` and the CVC tier behaviour):

- **First-tap correct** → `correct` utterance plays, Emma celebration animation, chip pulse, move to next problem.
- **First-tap wrong** → `reprompt` utterance plays, chip dim on the wrong tap, Marian tries again on the same problem.
- **Second-tap wrong** → `hint` utterance plays.
- **Third-tap wrong** → `giveAnswer` utterance plays, correct chip pulses, move to next problem (the "give up" branch).

**No tier-specific accuracy override** — letter-names uses the standard 3-attempts-then-give-answer flow.

### 5.3. Promotion to next tier

This tier's promotion to `letter-sounds` (the next-in-order Word Song node per `WORD_SONG_NODES_IN_ORDER`) follows the **standard mastery rule** (`mastery.ts` `applyMasteryRule`):

- **`intro → practicing`** transition: after the first session where this tier is the focus, regardless of accuracy.
- **`practicing → mastered`** transition: 90% accuracy across 3 cross-day-deduped sessions (per `mastery.ts` and the canonical 90/3 rule from `phonics-sequence-marian.md` §Q5).

No 2-session-gap rule like short-e's. No graduation-probe gate like cvc-words'. **Standard mastery rule applies verbatim.**

### 5.4. Realistic mastery timeline for Marian

Given Marian's alphabet-mastered diagnostic level, expected progression:

- **Session 1**: 7-8 of 8 correct on first tap. The b/d/p/q trap items (1-2 of them) are the only items at real risk. Result: `intro → practicing` flip.
- **Session 2-3**: 7-8 of 8 first-tap-correct again. Cumulative accuracy clears the 90% threshold across 3 sessions (3 sessions × 8 problems = 24 problems; 90% = 22 correct; Marian is plausibly at 21-24).
- **Session 3 or 4**: `practicing → mastered` flip — tier moves out of focus, picker walks to `letter-sounds`.

This is the **bake-once-and-leave** prediction: the tier exists in the curriculum, surfaces once or twice for Marian, masters quickly, and stays mastered.

**Risk: Marian repeatedly trips the b/d/p/q trap window such that her 3-session accuracy lands at 85-89% — JUST below the mastery cutoff.** Mitigation: the §1.3 hard constraint of "≤2 b/d/p/q targets per session" caps the maximum b/d/p/q exposure per session at 25% of items. Even if Marian got both b/d/p/q items wrong every session, her per-session accuracy would land at 6/8 = 75% — below the mastery threshold and the tier would stay in `practicing` indefinitely. This is BAD UX: Marian's actual ceiling on alphabet recognition is mastery-grade; b/d/p/q is a known developmental phase that self-resolves over 6-12 months per `phonics-sequence-marian.md`. We do not want the curriculum to permanently stick Marian on letter-names because of the one residual confusion.

**Mitigation decision (locked):** when computing mastery for `letter-names` specifically, **count b/d/p/q first-tap-wrong attempts as half-weight**. So a 6/8 session with both errors on b/d/p/q targets counts as 7/8 (= 87.5%) for mastery purposes. **Open as §7 Q2 for sponsor confirmation** — this is a per-tier accounting tweak that lives in `mastery.ts` and requires Kevin's impl-side work in A3 if accepted.

Alternative simpler mitigation that does not require code changes: **just let the §1.3 cap (≤2 b/d/p/q per session) do the work.** Marian's gentle-window + mid-tier slots (problems 1-5) are all clean-glyph or only-soft-trap; she will hit ≥5/8 just on those, and her b/d/p/q hit rate will likely be ≥50% (her residual confusion isn't 100% — it's "minor"). Expected per-session accuracy: 7/8 = 87.5% → 90% over 3 sessions if she gets even one b/d/p/q right in any of the 3 sessions. **This is the recommended default** — no `mastery.ts` change needed.

The half-weight option is the fallback if post-deploy data shows Marian sticking. Pre-bake assumption: standard mastery rule, §1.3 cap handles the risk.

---

## 6. Mastery rule (summary)

**Standard 90/3 cross-day-deduped rule** (no per-tier override in v1).

Implementation: lives in `mastery.ts` `applyMasteryRule` — already implemented for the existing tiers. No change required for Tier A1.

The half-weight b/d/p/q variant is an **open question** (§7 Q2); pre-bake recommendation is to NOT implement it and rely on the §1.3 composition cap.

---

## 7. Open questions for sponsor

These are the design choices that need Thomas's call before A2 (Dave's directive) is locked. None blocks A2 dispatch — Dave can write the directive with the recommendations here and these questions resolved either at PR review or before merge.

| #      | Question                                                                                                                                                                                                                                                                                                                 | Recommendation                                                                                                                                                       | Impact if flipped                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Case-strict tap or case-insensitive tap?** Read line is `"Tap the letter A."` — does tapping a lowercase `a` chip count as correct, or only uppercase `A`? Spec recommends case-strict for v1 simplicity (chip case matches read-line case verbatim).                                                                  | Case-strict. Chip case = read-line case.                                                                                                                             | If flipped to case-insensitive: A4 Jessica E2E spec must cover both-case-acceptance; the Haiku directive's chip-case rule (§3.2) widens; the read-line itself is unchanged. No canon re-bake needed if flipped post-ship. |
| **Q2** | **Half-weight b/d/p/q errors in mastery computation, or rely on the §1.3 cap?** Spec recommends relying on the cap (no `mastery.ts` change).                                                                                                                                                                             | Rely on §1.3 cap. Standard mastery rule.                                                                                                                             | If flipped to half-weight: Kevin's A3 impl adds a per-tier mastery-weight override in `mastery.ts`. Adds one branch to the mastery rule and one regression spec. Reversible.                                              |
| **Q3** | **Pre-emptive SSML `<phoneme>` wrap on the letter `A`?** Some voice engines pronounce isolated `A` as "uh" (article). Spec recommends NO pre-emptive wrap; validate at A4 Jessica E2E.                                                                                                                                   | No pre-emptive wrap. Add at re-bake only if A4 surfaces drift.                                                                                                       | If flipped: A2 Haiku directive includes the per-letter SSML wrap for `A` only (not all letters per the `audio-system.md` defensive-wrap caveat).                                                                          |
| **Q4** | **Font choice — Atkinson Hyperlegible, Inter, Lexend, or iPad system?** Spec recommends Atkinson Hyperlegible for the dedicated dyslexia-friendly disambiguation; Devon's design-tokens layer may have a different default.                                                                                              | Atkinson Hyperlegible (or whatever Devon's design-tokens map already loads if it's already disambiguating).                                                          | If flipped to system font: low risk for most letters; small risk on `Il1` and `b/d/p/q` rendering at chip size. Mitigable with explicit font-feature settings.                                                            |
| **Q5** | **Should the tier ship a "letter chant" session-end utterance** (`"You read the letters!"`) or use the standard `session.end.opener` (`"You did it!"`)? Spec recommends the standard utterance for consistency with other tiers.                                                                                         | Standard `session.end.opener`.                                                                                                                                       | Trivial to flip at re-bake.                                                                                                                                                                                               |
| **Q6** | **`compositionLint` binding for letter-names — yes or no?** A3 ticket flags this as optional ("only if Kyle's spec rule has mechanical structure to lint"). The §1.3 rule HAS mechanical structure (≥1 and ≤2 b/d/p/q targets per session, ≥4 gentle-class, ≥2 uppercase + ≥2 lowercase). Spec recommends YES — bind it. | YES, bind a `TierLintBinding` for letter-names mirroring sub-to-10's shape (per `feedback_haiku_directive_sharpening` Pattern 7 RULE_IDENTITY+SPEC+LINT triple-pin). | Adds 4 lint rules + ~10-15 unit tests to Kevin's A3 PR; pre-disk catch on Haiku drift. Reversible (can drop the binding post-ship if it produces false positives).                                                        |

---

## 8. Cross-tier concerns surfaced during authoring

These are observations made while drafting this spec that may have implications for adjacent tiers or for the planner architecture as a whole. None are blockers for A1.

1. **The `blending-cv` stub fallback masks the un-shipped state of `letter-names`, `letter-sounds`, `sight-words`, and `simple-sentences`.** Today, any user whose focus is one of these 4 tiers sees blending-cv content and a `console.log` (or equivalent) about the fallback. This is gracefully-degraded but not surfaced to telemetry, so we don't know how often Marian (or any future tester) lands on these tiers and silently gets short-a content. **Recommendation for future:** the stub fallback should emit a telemetry breadcrumb that gets counted in the session-end Claude call. Out of scope for A1; flag for Matt to triage as a Wave 8+ observability ticket.

2. **The lowercase `g` glyph has two common forms** — single-storey (the "modern" form, `ɡ`) and double-storey (the "traditional" typography form, `g`). Different fonts default to different forms. If Marian has learned only one form at school in Manila and the chip renders the other, she may not recognize it. **Recommendation:** §4.2's font choice (Atkinson Hyperlegible) uses the single-storey form, which is the more common school-instruction form for early literacy. **Open as a watch-item for A4 Jessica E2E** — if Atkinson Hyperlegible's `g` renders unexpectedly, the font may need a `font-feature-settings: "ss01"` override or a font swap.

3. **The b/d/p/q confusion class is Marian-specific.** A future user with no b/d/p/q residual confusion (or with a DIFFERENT residual confusion, e.g. `m/n` or `u/v`) would not benefit from the same §1.3 trap-window composition. The Haiku directive could in principle gate the trap-class on `progress.knownConfusions` if such a field existed. **It does not in v1.** Acceptable for Wave 7 — Marian is the only user. Flag as a future-tier consideration if the app generalizes.

4. **The `letter-names` tier is `intro` by default in `defaultProgress`** (per `defaults.ts` — I have not opened it, but the canonical state for any new user is the first node in `WORD_SONG_NODES_IN_ORDER` at `intro`). So the very-first Word Song session a new user (or a Marian-reset) does is letter-names. Today that session silently falls through to short-a CVC because of the `blending-cv` stub. **After A3 ships**, the first Word Song session a new user does will be **actual letter-name recognition** for the first time. This is a behaviour change on first-session UX that the A4 Jessica E2E spec should explicitly cover (per the ticket: _"a fresh user with `letter-names` as focusNode should reach the screen, hear the bake's first read, and the chip render uses the bake's letter pool (not the blending-cv stub)"_ — which is exactly this).

5. **`letter-sounds` (Tier A5) is the next-in-order tier and consumes the same Marian-current-level context.** Kyle is authoring both in parallel; they share the "alphabet mastered" anchor but diverge on the pedagogical lift (A1 = glyph recognition, A5 = phoneme association). They should ship as a pair — A4 + A8 Jessica E2E specs should cover both — but the canon JSONs and Haiku directives are independent and can land in either order. No blocking dependency between A1 and A5 (per the Wave 7 plan dependency graph).

6. **The pool-extension five-point checklist in `skill-trees-and-content.md` does NOT apply to this tier**, because there is no `wordPack.ts TARGET_WORDS` entry, no `TARGET_PAIRINGS` row, no `VALID_*_WORDS` Set in any E2E spec, no `POOL_EXTENSION_PENDING_CROSSVOWEL` entry. The canon JSON + planner directive + lint binding (if Q6 = yes) + `WORD_SONG_FIRST_CLASS_FOCUS_NODES` literal addition are the only file edits. A3 dispatch brief should be explicit about this to avoid the checklist-conflation trap flagged in `skill-trees-and-content.md` § "Do not confuse this pool-extension five-point checklist with the SkillNode-widening five-point checklist".

---

## 9. Cross-references

- Ticket `86c9y4960` (this spec), epic `86c9y494c` (Wave 7), parallel ticket `86c9y4XXX` (A5 `letter-sounds` spec — Kyle).
- Downstream tickets: A2 (Dave directive, fires when A1 merged), A3 (Kevin canon bake + lint + planner wiring, after A2 merged), A4 (Jessica failing-first E2E spec, parallel with A3).
- `design/word-song/short-i-pool-expansion.md` — structural template precedent.
- `design/word-song/short-e-pool-expansion.md` — structural template precedent.
- `design/word-song/digraphs-sh-word-list.md` — structural template precedent (digraph tier — sibling-node-first-class workflow).
- `design/research/phonics-sequence-marian.md` — b/d confusion (`§ "The b/d confusion"`), mastery rule (`§Q5`), Marian's current letter recognition (`CLAUDE.md` current-levels table is the source-of-truth pointer; the research doc consolidates the implications).
- `CLAUDE.md` — Marian's current levels (alphabet: mastered with minor b/d confusion).
- `.claude/docs/skill-trees-and-content.md` — Word Song tree promotion order, `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, stub-fallback behaviour, pool-extension vs `SkillNode`-widening checklist distinction.
- `.claude/docs/audio-system.md` — Azure TTS voice (`en-US-EmmaMultilingualNeural`), SSML phoneme override pattern (defensively scoped — see `project_audio_phoneme_overrides`).
- `.claude/docs/sibling-tier-checklist.md` — NOT applicable to this tier (per ticket non-obvious context); referenced here only to explicitly document non-application.
- `[[feedback_haiku_directive_sharpening]]` — Pattern 7 RULE_IDENTITY+SPEC+LINT triple-pin (informs §7 Q6).
- `[[feedback_distractor_class_pedagogical_gates_mechanical]]` — pedagogical-first audit for distractor classes (informs §3 distractor selection: b/d/p/q is the pedagogical-fit class, not a mechanically-derived one).
- `[[feedback_failing_first_must_prove_green]]` — A4 Jessica E2E spec must use canon-bytes mock per PR #283 pattern, not `failNetwork`.
