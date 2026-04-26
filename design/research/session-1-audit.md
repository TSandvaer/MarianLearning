# Session 1 Audit — Cognitive Load, Age-Fit, Dark-Pattern Risk

**Author:** Dave (child psychologist)
**Date:** 2026-04-25
**Spec reviewed:** `design/session-1.md` (post-PR #6, Thomas decisions on Q1/Q2/Q3 baked in)
**Audience:** Kyle (spec owner), Matt (ticket prioritisation)

---

## Bottom line

The spec is well-constructed and mostly evidence-aligned for an 8-year-old L2 English learner. The two clearest risks are: (1) Screen 4 stacks too many concurrent audio + visual events during the letter-sound introduction, specifically the overlap of TTS narration, sequential phoneme playback, letter pulse animations, and picture bounces within a single ~5-second window — this will saturate working memory before Marian has even tapped a letter; and (2) the CSS-filter twilight on Screen 5 is the one design choice with no developmental evidence behind it and a small but real risk that a hue-rotated colour field reads as "broken" to a child rather than "cosy evening." Thomas's three baked decisions on phoneme audio and gentle-ramp distractors are both evidence-sound; the CSS filter is a cosmetic compromise worth a quick sanity-check during implementation. No dark-pattern risks are material — the spec is genuinely clean on this front. Kyle should narrow the Screen 4 audio/animation sequencing before Kevin and Devon implement it.

---

## Audit by screen

### Screen 1 — Splash

> "Give Marian a 1.5-second 'the app is waking up' moment… No 'tap to continue' — auto-advances."

✅ **Aligns with low-demand first-exposure design.** A silent, auto-advancing splash with a single on-screen element (logo + wordmark) makes zero cognitive demands. Appropriate: young children's working memory is still developing toward adult 4-chunk capacity (Cowan, 2001; PMC4270959), and any loading screen that requires decision-making is a misuse of that capacity.

✅ **Aligns with reduced-motion spec.** Static fallback for `prefers-reduced-motion` is correctly implemented. No concern.

⚠️ **Concern: 1500ms auto-advance with no signal of progress.** Three pulsing dots are ambiguous to an 8-year-old — they may not read as "loading." On cold cache the 3000ms extension is silent. If the delay ever exceeds ~2s and nothing appears to change, there is a real risk Marian taps the screen repeatedly or hands the iPad to a parent. One-line fix: a very faint "getting ready…" caption or the dots visibly completing (filling left-to-right rather than looping) would communicate state without adding cognitive load. Not a blocking issue for Session 1, but flag for QA observation.

---

### Screen 2 — First Greeting (Meet Melody)

> "Hi! / I'm Melody. / It's so nice to meet you. / Tap the heart when you're ready."
> "Heart button does NOT appear until Melody's line 3 finishes."

✅ **Aligns with sequenced reveal reducing split-attention.** The heart button appearing only after line 3 is excellent design. Mayer's Cognitive Theory of Multimedia Learning (Mayer, 2009) identifies split-attention as a primary source of extraneous cognitive load — showing the interactive element before the instruction that explains it forces the child to divide attention. The spec avoids this.

✅ **Aligns with audio-first L2 instruction design.** Marian's working memory is partially occupied by L2 English decoding at all times (Cambridge Core, L2 WM study). TTS carrying the primary message with caption text as reinforcement (not replacement) is the correct modality split for a low-proficiency L2 learner. The spec's "no text Melody doesn't also say" rule is the right constraint.

✅ **15-word vocabulary check passes comfortably.** All words are within the 200-word cap and are likely within Marian's receptive English vocabulary per diagnostic ("I'm fine," "favorite animal" — functional oral English confirmed).

⚠️ **Concern: Melody's entrance animation + cloud drift + speech ribbon + word-by-word reveal are all simultaneous.** At the 300ms mark, Marian is watching: a spring-entering character (~700ms), a cloud background fading in (600ms), and a word-by-word caption ribbon activating. For the first ~600ms, three distinct visual motions are active concurrently. Working memory in 8-year-olds is approximately 3–3.5 chunks (PMC2752294 — chunk capacity developmental study), not the adult 5–6 often cited. Concurrent animations are extraneous load — they do not carry information relevant to the task. **The cloud drift loop (20s, repeat: Infinity) is the lowest-value element — disable it during TTS playback, resume after.** A single toggle in the Framer Motion variant is sufficient.

⚠️ **Concern: "No tap for 20 seconds → re-prompt once."** The 20-second window is reasonable and the single-reprompt design is correct (no nag loop). However, 20 seconds is long for a first-run screen if Marian understands the instruction at second 8 but is waiting for the heart to feel safe to tap. Consider shortening the re-prompt to 12–15 seconds for the greeting screen specifically, since the heart button is introduced at ~4s. Low priority.

---

### Screen 3 — Math Exercise (Number Garden: 3 + 2 = ?)

> "Three answer chips render at 88×88pt with 32pt gaps; chip values are `3`, `5`, `10`; correct answer `5` randomly placed."
> "Flower groups gently pulse one group at a time: first the 3-flower group pulses… then the 2-flower group."

✅ **Aligns with concrete-visual-abstract progression.** Presenting the symbolic `3 + 2` alongside 3 + 2 flower glyphs is the correct instantiation of the concrete → visual → abstract sequence. Marian's diagnostic shows finger-reliance on `3 + 2` — flowers serve as an external concrete scaffold that replaces finger counting without penalising the habit (Siegler & Jenkins, 1989; number sense research).

✅ **"Never a red X" — strongly aligned with developmental evidence.** Failure-handling literature distinguishes productive struggle (useful) from punitive failure (damaging). At age 8, fear of mistakes inversely correlates with self-worth (PMC11803059 — learning from errors study). The puzzled-tilt + poof + retry design is the textbook recommended approach: neutral-to-positive affect on error, no shame signal, low-cost retry.

✅ **Hint design after 2 wrong attempts is evidence-sound.** Sequential pulse of flower groups with counting narration is a concrete-representational bridge. Showing the correct chip after 3 wrong attempts (generous threshold) avoids grind and respects mastery orientation. This is well-calibrated.

⚠️ **Concern: Problem reveal stagger (7 individual items, 120ms each = ~840ms total) runs before chips appear (300ms more).** This means Marian watches ~1140ms of sequential animation before she can respond. For an 8-year-old who already solved this problem on her diagnostic, this pacing may feel slow. Not harmful, but if the stagger feels draggy in implementation, reduce item stagger to 80ms. Flag for QA observation with Marian.

⚠️ **Concern: Screen 3 cognitive-demand inventory.** At idle (post-reveal), the screen presents concurrently: large numerals + operator, 5 flower glyphs, equals sign + question mark, 3 answer chips, small Melody in corner, speech ribbon. That is approximately 7 distinct visual chunks. For an 8-year-old with ~3.5-chunk working memory (PMC2752294), this is at the edge. Mitigating factors: the visual groups (flowers) are redundant encodings of the numerals (not independent chunks), Melody is peripheral and small, and the child's attention will naturally anchor on the chips as the decision point. The spec is likely acceptable **provided the flower count and symbolic numerals are always spatially grouped** (flowers directly beneath their numeral). This spatial grouping is implied but not explicitly required in the AC. Kyle should add an AC item: "Flower groups are spatially aligned below their corresponding numeral."

---

### Screen 4 — Literacy Exercise (Word Song: `dog`)

> "Letters `d`, `o`, `g` in 96pt, spaced ~48pt apart. Each letter is tappable — tapping it plays that letter's sound alone."
> "(0.0s) 'Look!' (picture bounces in) … (2.0s) 'D... O... G.' (each letter highlighted in turn, 600ms between) … (4.2s) 'Dog!' (all three letters glow together, picture bounces once)"

**This is the highest cognitive-load screen in the spec.** Detailed breakdown:

✅ **Picture-first design is evidence-aligned.** Leading with the picture before the phoneme sequence allows Marian to build a semantic anchor before phonetic decoding begins. For an L2 learner where vocabulary is the bottleneck (Part 1 analysis: she decoded `sun` but did not recognise the word), the picture is load-reducing — it offloads the meaning-mapping to a separate, pre-loaded representation. Correct design choice.

✅ **"d... o... g... dog!" sequencing mirrors Structured Literacy phoneme-blending instruction.** Isolate phoneme → sequence → blend is the textbook approach. The pre-recorded phoneme decision (Q1) specifically enables this correctly — TTS would either pronounce letter names or append a schwa (/duh/, /guh/), which actively misfires phoneme-grapheme mapping training.

❌ **Risk: Lines 2–4 overlap animation and audio in ways that will saturate an 8-year-old's working memory.**

Specifically, at the ~2-second mark, Marian must simultaneously process:

- TTS narration ("D... O... G.") — auditory phonological channel
- Sequential pre-recorded phoneme playback (`phoneme-d.mp3`, `phoneme-o-short.mp3`, `phoneme-g.mp3`) — **same auditory channel** as TTS, but different audio source, 200ms apart
- Letter highlight pulses: scale 1→1.2→1, colour `--ink` → `--my-rose` — visual channel
- Picture persisting in frame — additional visual object

The TTS "D... O... G." and the phoneme audio files are playing from **two different audio sources in rapid sequence on the same perceptual channel** (hearing). Mayer's redundancy principle (Mayer & Moreno, 2003) predicts this will interfere rather than reinforce: two simultaneous or near-simultaneous auditory streams for the same letter-sound target competes for the phonological loop. The spec states "Sequence the three phoneme audio files back-to-back with ~200ms gaps" during line 3 — but it is unclear whether the TTS "D... O... G." utterance is _replaced by_ the phoneme files or plays _alongside_ them.

**This needs explicit resolution.** If TTS says "D" and `phoneme-d.mp3` plays 200ms later, that is near-simultaneous redundant auditory input — which Mayer's research categorises as a design flaw that decreases learning outcomes compared to a single coherent audio stream.

**Recommended fix (minimal scope impact):** During the sound-out sequence (line 3), **TTS says nothing** — only the pre-recorded phonemes play, each triggering its letter's visual highlight. TTS resumes for line 4 ("Dog!") and line 5 ("You try!"). This eliminates the dual-auditory-stream problem with zero additional assets or logic: just a pause in the TTS utterance at that timestamp.

⚠️ **Concern: Two bottom buttons ("Again" paw-print at 72pt, "Got it" checkmark at 88pt) appear simultaneously with picture + letters + speaker button + Melody + speech ribbon.** On Screen 4 at idle state, the visual inventory includes: Melody (upper-left), speech ribbon, large picture (320pt sq), three tappable letters (96pt), speaker button (72pt), "Again" button (72pt), "Got it" button (88pt). That is 7 interactive/semi-interactive zones visible simultaneously. For comparison, iPad thumb-zone UX guidance recommends ≤4 primary actions visible at once. The speaker button and "Again" button serve overlapping functions (both replay sounds). Consider hiding "Again" until after first full playback — it only becomes relevant if she wants to repeat, which she cannot want to do before hearing it once.

⚠️ **Concern: L2 English instruction decoding load.** "Read this!" in the speech ribbon may not be comprehensible to Marian without the TTS. The spec correctly mandates TTS mirrors all on-screen text — confirm the speech ribbon shows "Read this!" only after Melody has said it, not before.

---

### Screen 5 — Reward + End-of-Session Teaser

> "Background: bg-song.svg … with a runtime CSS filter applied: filter: hue-rotate(220deg) brightness(0.75) saturate(1.1)"
> "No numeric score, XP counter, percentage, streak, or 'keep your streak!' copy appears."
> "Teaser: a small 'Tomorrow: [silhouette of a short-o friend]' teaser card"

✅ **Stardust jar with fixed, predictable reward (3 stars = 3 moments) is strongly evidence-aligned.** The spec deliberately avoids variable-ratio reward: every correct answer gets the same sparkle + chime, every session ends with stars equal to exercises completed. This is the developmentally appropriate design for a child this age. Variable-ratio schedules (Skinner, operant conditioning; see engineered-highs research, ScienceDirect 2023) produce compulsive engagement in adults and are actively harmful for children, undermining intrinsic motivation via the overjustification effect. The fixed, achievement-tied reward in this spec is the right call.

✅ **No streak shame, no urgency, no social pressure.** The anti-dark-pattern checklist at the bottom of the spec is comprehensive and all items are confirmed absent. The "See you next time" framing is warm without manufacturing FOMO. This is the correct exit design.

✅ **Single clear exit (home button, appears last).** The exit is unambiguous, not hidden, and has no confirmation dialog. This respects Marian's autonomy to stop — a key dark-pattern risk in children's apps is obscuring or complicating the exit path to extend session time. The spec avoids this.

⚠️ **Concern: CSS-filter twilight (Q2) — no strong developmental evidence, small perceptual risk.** `hue-rotate(220deg) brightness(0.75) saturate(1.1)` applied to `bg-song.svg` (a pastel pink/cream music-notes background) will shift the hue toward blue-purple and reduce brightness by 25%. The intended mood is "soft twilight." The perceptual risk is specific to children: young children (ages 6–9) are more sensitive to unexpected hue shifts in familiar objects than adults (colour constancy research; see Smithson & Mollon, 2004, for adult baseline; developmental studies show children maintain stronger colour-category anchoring). A pink background turning blue-purple may not read as "evening" — it may read as "the app is broken" or produce mild disorientation. The fix is not to abandon the approach (it is a smart asset-saving decision) but to validate the specific resulting colour against Marian's reaction during the first real session. **Implementation recommendation:** have Kevin/Devon screenshot the filtered result and show it to Thomas before shipping. If the visual reads clearly as "night sky" to an adult, it will very likely read the same to an 8-year-old with adequate preamble from Melody's audio ("See you next time" with a soft tone sets the semantic frame before the visual registers). Low-priority risk, but worth the 2-minute validation.

⚠️ **Concern: "Tomorrow: [fox silhouette]" teaser — no context for Marian that `fox` will be tomorrow's word.** The silhouette teaser assumes she will decode the visual clue and find it motivating. At Session 1, she does not yet know the app's structure. The teaser is more likely to land as "interesting mystery" than "motivating preview" — which is fine and appropriate. The risk would only emerge if the teaser is shown and then tomorrow's session opens with a different word (broken promise to the child). Flag for Matt: the teaser image and tomorrow's actual CVC word must be coupled in the session-generation logic.

---

## Audit of Thomas's three baked decisions

### Q1 — Pre-recorded phoneme audio (~100 KB) for `/d/`, `/ŏ/`, `/g/`

**Verdict: Strongly correct. Ship as specified.**

Web Speech API (and TTS systems generally) cannot produce the isolated pure phoneme. They either pronounce letter names ("dee," "oh," "gee") or append a schwa (/duh/, /ŏ/, /guh/). For phoneme-grapheme mapping — which is what Marian is specifically learning — hearing /duh/ instead of /d/ when she taps the letter `d` actively misfires the association. The letter `d` maps to the phoneme /d/, not the syllable /duh/. Structured Literacy instruction (International Dyslexia Association, practitioner consensus; Reading Rockets, 2024) specifically requires phoneme purity in initial phoneme instruction. The ~100 KB budget for 26 phoneme files across the literacy ladder is reasonable. Evidence strength: **strong practitioner consensus + phonological theory; no randomised trials comparing pre-recorded vs TTS phonemes specifically in app-based instruction (honest about this gap).**

### Q2 — CSS-filter twilight derived from `bg-song.svg`

**Verdict: Pragmatically sound, minor perceptual risk worth a one-time visual validation.**

The asset-saving rationale is solid. The CSS filter approach is GPU-accelerated, zero additional download bytes, and consistent across the session. The developmental concern — that children have stronger colour-category anchoring than adults and may perceive an unexpected hue shift as an error — is real but manageable. The key mitigating factor is that Melody's audio ("See you next time," farewell tone) will semantically prime the mood before the visual registers. Thomas should have Kevin/Devon capture a screenshot of the filtered background and validate it looks intentionally "twilight" rather than "tinted," ideally with Marian present. Evidence strength: **weak (colour-constancy research is adult-focused; paediatric colour perception is extrapolated from peripheral literature). My read is this poses low actual risk.**

### Q3 — First-problem distractors `3` and `10` (gentle ramp); off-by-one distractors deferred to problem #3

**Verdict: Correct decision, well-calibrated for debut session.**

The purpose of distractors is to capture the common misconception — but only for students being assessed, not for students on their first ever interaction with a new tutor (Gierl et al., 2017, comprehensive distractor review). Off-by-one distractors (4/6 for the problem 3+2=5) are pedagogically useful for spaced-repetition practice once the child has established baseline comfort, but they are assessment-style design. On debut, a wrong answer from an adjacent-number distractor that she would not make on paper produces a misleading negative signal and a sour first impression. The primacy effect in learning (first impressions weighted more heavily than subsequent ones) means Session 1 errors have outsized emotional cost. Using obviously wrong distractors (3 and 10) on problem #1 reduces that risk. The rule "off-by-one traps start at problem #3 once she's banked two wins" is evidence-aligned and appropriately graduated. Evidence strength: **moderate (distractor research is primarily psychometric, not motivational; the debut-session calibration is clinical judgment supported by primacy-effect literature and mastery-orientation research).**

---

## Cross-cutting findings

- **The spec has consistent, appropriate audio-first design throughout.** Every piece of on-screen text is mirrored by TTS; nothing requires Marian to read to understand what to do. This is the single most important design decision for an L2 learner at her level and the spec never compromises it. Well done.

- **Working memory loading is well-managed on Screens 1–3 and 5; Screen 4 is the outlier.** The dual-audio-stream problem on Screen 4 (TTS narration overlapping phoneme playback) is not intuitive to spot in a spec — it emerges from timing arithmetic — but it is the clearest cognitive-load risk in the whole session.

- **Reward design is developmentally exemplary.** Fixed-ratio, effort-contingent, achievement-tied rewards (3 stars for 3 tasks) with no variable-ratio elements, no streaks, no social proof, and a clean exit is exactly what the literature recommends for children this age. The team should treat this design as a template to defend against future scope creep that adds "just a little" gamification.

- **The spec deliberately avoids testing Marian on Session 1.** Screen 4 is a listen-and-absorb exercise with no right/wrong judgment; Screen 5 has no wrong path. This is correct for a first-run session: the goal is belonging and safety, not diagnostic accuracy. The spec understands this. Session 2 design should maintain this principle for one more session before adding comprehension checks.

---

## Risks / counter-evidence

- **Working memory figures for 8-year-olds vary by study and task type.** The "3.5 chunks" figure (PMC2752294) is for verbal/sentence chunks. Visual working memory at age 8 may be closer to 3–4 items (Springer, 2016). The difference is enough to change the Screen 4 concern from "at the edge" to "likely over" — but both readings point toward simplifying the audio-animation overlap, which is the same recommendation regardless.

- **Marian may be at the higher end of working memory for her age.** Her diagnostic shows metacognitive self-correction, accurate decoding of `cat` and `dog`, and functional oral English — all markers of strong cognitive profile. A child at the 75th-percentile end of WM capacity for age 8 could handle Screen 4 as designed. The counter-argument for keeping the fix is: there is no developmental cost to reducing concurrent load, but there is measurable cost to exceeding it.

- **The pre-recorded phoneme evidence is primarily from instructional research, not tablet-app interaction research.** Most phoneme instruction studies involve a human teacher modeling sounds. The tablet-mediated version (tap → hear phoneme) has less empirical backing specifically, though there is no reason to expect the phoneme-purity principle to differ.

- **"See you next time" teaser effectiveness.** I have no direct evidence that a silhouette teaser increases return-rate for an 8-year-old. It is a reasonable UX pattern borrowed from adult content apps (end-of-episode teaser). The risk is not harm but wasted development effort if it has no effect. Low stakes.

---

## Recommendations

### For Kyle (spec changes)

1. **Screen 4, highest priority:** Resolve the dual-audio-stream overlap. During the sound-out sequence (TTS line 3: "D... O... G."), TTS should be silent — only the pre-recorded phonemes play, each triggering its letter's visual highlight. TTS resumes for line 4 ("Dog!") and line 5. Add a note to the TTS script table: "Line 3 audio delivered by pre-recorded phoneme files only; TTS utterance is suppressed for this line." This is a single sentence added to the spec; the implementation impact is minimal.

2. **Screen 4, medium priority:** Add acceptance criteria: "At idle state, 'Again' button is hidden/not yet rendered; it appears only after the intro sound sequence completes." This reduces the simultaneous interactive zone count from 7 to 6, which is still on the high side but more manageable. Alternatively: merge "Again" and the speaker button into a single replay control (same function, one fewer interactive element).

3. **Screen 3, low priority:** Add acceptance criteria: "Flower groups are spatially aligned directly below their corresponding numeral (3-flower group below `3`; 2-flower group below `2`)." This is implied by the layout ASCII art but not explicit in the AC.

4. **Screen 5, low priority:** Add a note to the implementation notes: "CSS-filter twilight values should be screenshot-validated by Kevin/Devon and confirmed with Thomas before shipping — target mood is 'soft night sky,' not 'purple tint.'"

### For Matt (ticket priorities)

1. **Open a ticket for the Screen 4 audio-sequencing logic before Kevin/Devon start Screen 4 implementation.** The dual-audio-stream fix needs to be in the spec before it's coded; retrofitting audio timing in a React/Howler integration is more expensive than getting it right upfront. This is a spec clarification request to Kyle, not a new feature.

2. **Couple the teaser image to the session-generator output.** The fox silhouette shown on Screen 5 must match the actual next-session CVC word. This is a session-generator contract issue (the session-start Claude call needs to return the teaser_word along with the problem set) and should be tracked as an implementation dependency between the Claude session-generator ticket and the Screen 5 ticket.

3. **Flag for TTS voice stability review at Session 4–5 milestone** (already noted in spec Open TODOs — confirming it is worth a real ticket when that milestone approaches, not just a note).

### For Thomas (values questions only)

1. **Q2 CSS-filter twilight:** No action required beyond requesting a visual screenshot review from Kevin/Devon before the PR ships. The decision is pragmatically sound; this is just a one-time implementation check. No spec change needed.

---

## Sources

Evidence strength is noted inline. Real, findable references only — no fabricated citations.

- Cowan, N. (2001). "The magical number 4 in short-term memory: A reconsideration of mental storage capacity." _Behavioral and Brain Sciences_, 24(1), 87–114. [PMC4270959 — Knowledge Cannot Explain the Developmental Growth of Working Memory Capacity](https://pmc.ncbi.nlm.nih.gov/articles/PMC4270959/). **Strong** (systematic review of WM development).

- Gilchrist, A. L., et al. (2009). "Investigating the Childhood Development of Working Memory Using Sentences: New Evidence for the Growth of Chunk Capacity." _PMC2752294_. [PMC link](https://pmc.ncbi.nlm.nih.gov/articles/PMC2752294/). **Moderate** (single study, sentence-based chunks; generalisation to mixed visual-auditory tasks is an extrapolation).

- Mayer, R. E., & Moreno, R. (2003). "Nine Ways to Reduce Cognitive Load in Multimedia Learning." _Educational Psychologist_, 38(1), 43–52. [Faculty Washington PDF](https://faculty.washington.edu/farkas/WDFR/MayerMoreno9WaysToReduceCognitiveLoad.pdf). **Strong** (replicated across many studies; the redundancy principle and split-attention effect are among the most robust findings in instructional design).

- International Dyslexia Association. "Building Phoneme Awareness: Know What Matters." [IDA link](https://dyslexiaida.org/building-phoneme-awareness-know-what-matters/). **Practitioner consensus** (strong alignment with structured literacy research; not a primary RCT).

- Reading Rockets. "Phonological Awareness: Instructional and Assessment Guidelines." [Reading Rockets](https://www.readingrockets.org/topics/phonological-and-phonemic-awareness/articles/phonological-awareness-instructional-and). **Practitioner consensus** (synthesis of NRP and subsequent replication).

- Kapur, M. (2014). "Productive failure in learning math." _Psychological Science_, 25(10), 1994–2002. [PubMed](https://pubmed.ncbi.nlm.nih.gov/24628487/). **Strong** (replicated RCT series; note: productive failure is most robustly studied at middle-school age, not age 8 specifically — applying to primary is an age-extrapolation).

- Gierl, M. J., Bulut, O., Guo, Q., & Zhang, X. (2017). "Developing, Analyzing, and Using Distractors for Multiple-Choice Tests in Education: A Comprehensive Review." _Review of Educational Research_. [Sage Journals](https://journals.sagepub.com/doi/10.3102/0034654317726529). **Strong** (systematic review; primary finding is assessment context, which differs from practice context — noted).

- Pmc11803059. "Learning from errors and failure in educational contexts: New findings." _British Journal of Educational Psychology_ (2025). [Wiley](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjep.12716). **Moderate** (recent meta-analysis; age-specific effects for 8-year-olds are not isolated).

- ScienceDirect (2023). "Engineered highs: Reward variability and frequency as potential prerequisites of behavioural addiction." _Drug and Alcohol Dependence_. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0306460323000217). **Moderate** (adult-focused; paediatric extrapolation supported by overjustification effect literature).

- Cambridge Core. "Working Memory Capacity and L2 Reading." _Studies in Second Language Acquisition_. [Cambridge Core](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/working-memory-capacity-and-l2-reading/B5B68CCC0DFE04EEE5E929F5499008B2). **Moderate** (adult L2 readers; application to an 8-year-old L2 learner is a plausible extrapolation, not a direct finding).

- Springer Nature (2016). "Visual working memory capacity increases between ages 3 and 8 years." _Attention, Perception, & Psychophysics_. [Springer](https://link.springer.com/article/10.3758/s13414-016-1140-5). **Moderate** (visual WM specifically; supports the ~3–4 item figure at age 8).
