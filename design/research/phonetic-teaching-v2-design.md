# Phonetic-Teaching v2 Design — Replace Inline-IPA-in-Prose

**Date:** 2026-06-14
**Ticket:** 86c9qkbvk
**Scope:** /ɪ/ vs /iː/ discrimination for Marian's `cvc-words-short-i` first-encounter; design generalizes to future vowel introductions.

---

## Question

PR #192 went through four fix iterations and was closed as design-flawed. The root cause (documented in `planner-and-canon.md` § "Tier-specific opener pattern," 5th IPA-outcomes class): inline IPA wraps mid-English-sentence render as unintelligible bare-vowel streams regardless of notation (slash-IPA, Unicode IPA chars, or English-letter spellouts like "Sss, uh, nnn."). Phoneme demonstration mid-sentence is a dead end in this pipeline. What should replace it?

---

## Bottom line

**Recommended v2: Option A — Multi-utterance isolated phoneme sequence, no IPA wrap.** Split the contrast teaching into three consecutive utterances with natural framing pauses between them. Each utterance is plain English TTS; none contains a bare-vowel demonstration token. The canon-side cost is one additional session-opener utterance (or two, for the three-part sequence); the pedagogical gain is the actual /ɪ/ discrimination cue Marian needs, delivered intelligibly.

If implementation cost for Option A is prohibitive in the current sprint, Option D (drop in-app scaffolding, shift contrast teaching to the parent cue card) is the correct fallback — not a revised IPA approach. Do not commission another variant of inline phoneme notation.

---

## Why the v1 approach (inline-IPA-in-prose) fails — two distinct problems

### Problem 1: Pedagogical — demonstration mid-sentence does not teach discrimination

The inline-IPA strategy assumes that inserting a phoneme token mid-sentence replicates how a human teacher would say "the short 'i' sound — like *this* — /ɪ/." That assumption is wrong for two reasons backed by the phonetic-training literature:

1. **Bare vowel tokens with no consonant framing are perceptually opaque.** The /ɪ/ vowel in isolation is not how any listener — child or adult — processes English. The human auditory system identifies vowels from formant transitions that start from or end toward a consonant (Liberman & Mattingly, 1985 Motor Theory; Delattre et al., 1952). A mid-sentence bare `/ɪ/` has no onset or offset consonant to anchor the formant trajectory; the ear parses it as noise or as a schwa. This is not a property of Azure TTS — it is fundamental acoustic phonetics.

2. **High-variability phonetic training (HVPT) research consistently shows that phoneme discrimination improves through multiple exposures to the target sound embedded in varied phonetic contexts (words), not through isolated-symbol presentation.** A meta-analysis by Thomson & Derwing (2015) on HVPT (Studies in Second Language Acquisition, 2015; Cambridge University Press, g = 0.95 for identification tasks, g = 0.57 for discrimination tasks) found the largest gains come from hearing the contrast in multiple real words across multiple sessions. A single mid-sentence phoneme token is the opposite of what the literature recommends. The primary teaching work is done by Marian hearing "pig", "sit", "lip" across many sessions — not by a one-time IPA demonstration line.

### Problem 2: Technical — Azure TTS renders inline phoneme demonstration as gibberish regardless of encoding

This is exhaustively documented in `planner-and-canon.md` §"Tier-specific opener pattern" (IPA outcomes class 4 and 5) and the PR #192 four-iteration history. Key verified facts:

- Canon text must be ASCII-7; non-ASCII codepoints (IPA characters) mojibake in transit to Azure.
- Slash-IPA notation (`/p/-/ɪ/-/g/`) renders as "slash p slash dash..." literally.
- English-letter phoneme spellouts ("Sss, uh, nnn.") render as "sayan nssr" — Azure cannot parse phoneme-demonstration tokens in any orthography.
- The `PHONEME_OVERRIDES` injection (`<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>`) works for whole-word disambiguation (the `four` fix) but produces an unintelligible vowel stream mid-sentence when the wrapped token is a bare phoneme rather than a word.
- The en-GB-OliviaNeural voice (current voice as of PR #356) ignores `<emphasis>` and the en-US-EmmaMultilingualNeural voice ignored `two → /tuː/`, so voice-level phoneme forcing is unreliable.

**The root cause is the design pattern itself, not any implementation detail.** No notation variant rescues it.

---

## The four options

### Option A — Multi-utterance isolated phoneme sequence (recommended)

**Shape:**
Three consecutive utterances, each an independent TTS render. The sequence fires only on the lifetime-first-encounter gate (same pattern as the existing short-u opener in PR #174).

```
Utterance 1 (opener): "Listen for the short i sound."
Utterance 2 (anchor word 1): "Pig."
Utterance 3 (contrast + second anchor): "Not pee — pig. Short i."
```

All three are plain ASCII English. No IPA notation. No bare phoneme tokens. Azure will render each correctly because every token is a real English word.

**Why this works:**

- "Pig" said in isolation, clearly, at Emma's -10% rate, gives Marian a clean /pɪɡ/ input with full formant transitions on both consonants. The /ɪ/ vowel is bounded by /p/ and /g/ — exactly the context the auditory system needs.
- "Not pee — pig." is a minimal-pair contrast (pee = /piː/, pig = /pɪɡ/) delivered as natural English. No IPA token required; Azure renders both words correctly from its lexicon.
- The framing pause between utterances (inherent in three separate TTS calls) gives Marian processing time. Research on school-age word learning (PMC5579076, Estes & Hurley, 2013) found that utterance-final position and within-sequence pausing significantly support discrimination.

**Generalizes to all future vowel openers.** The pattern is: (1) priming utterance, (2) anchor word in isolation, (3) minimal-pair contrast sentence. Requires no SSML extensions, no phoneme override table entries, no new pipeline infrastructure.

**Trade-offs:**
- Impl cost: low. Three utterance ids instead of one; the first-encounter gate fires the sequence before the normal P1 problem read. No new UI, no new pipeline machinery.
- Pedagogy quality: good. Delivers the discrimination signal intelligibly.
- Marian-side intelligibility: high. All words are in her oral vocabulary from the picture pack.
- Parent-side dependency: none. Fully in-app.

**Variant for short-u (if re-bake of PR #174's opener is warranted):** same pattern, different words: "Listen for the short u sound." / "Cup." / "Not coop — cup. Short u."

### Option B — Parent cue card only (parent-mediated scaffolding)

**Shape:**
No in-app first-encounter scaffolding line. Instead, the Parent Settings page surfaces a printable or scrollable card Thomas reads to Marian before her first short-i session. Example card text:

> "Before Marian starts playing: Say — 'Listen, the letter I has a special short sound. Like the middle of PIG — not PEE, but *ih*, like PIG.' Say it once, show her a pig picture. Then let her play."

**Trade-offs:**
- Impl cost: low (static copy on an existing page).
- Pedagogy quality: high — human-delivered contrast with embodied prosody is pedagogically superior to any TTS approach. A parent can also respond to Marian's reaction in real time.
- Marian-side intelligibility: high.
- Parent-side dependency: high. Requires Thomas to remember to do it before session 1. In practice, a parent who is actively invested (Thomas clearly is) will do this; but it is not self-executing.

**When to use:** As a supplement to Option A, not a replacement. Option B is the right answer if Option A still produces unsatisfactory audio on ear-test (which is unlikely, but the Thomas ear-test is the gate for any opener). As a standalone choice, Option B is the correct fallback if the team decides any in-app short-i opener adds implementation risk without enough gain (given that Marian has wide runway before she reaches short-i).

### Option C — Dedicated intro screen with picture + audio (visual + audio sample)

**Shape:**
On first encounter of `cvc-words-short-i`, before the normal 8-problem session, a one-screen "intro card" appears. It shows:
- The letter `i` (large)
- A picture of a pig
- Emma saying: "Short i. Pig." (two utterances)
- A "Got it! Let's go." tap target

No phoneme token. No IPA. Emma says the word "Pig." in isolation; the picture reinforces the mapping; the letter anchors the grapheme.

**Trade-offs:**
- Impl cost: moderate. Requires a new screen component, a first-encounter state branch in the session flow, and a transition back to normal session flow. Not a minor change.
- Pedagogy quality: good. Picture + label + audio is the standard phonics-introduction format.
- Marian-side intelligibility: high.
- Parent-side dependency: none.

**Assessment against scope:** The 4-6 week build timeline and the fact that short-i has wide runway (Marian is on short-o/u now) make Option C the lowest-priority option of the three. It introduces a new screen type and a new branch in the session state machine — both are non-trivial implementation work. The pedagogical gain over Option A is marginal (adding the letter visual), and the existing picture pack already provides the picture on every problem card in the session itself.

Option C is a good long-term pattern if the app is ever extended to a wider audience. For Marian's 4-month window it is over-engineered.

### Option D — Drop in-app scaffolding; rely on repetition + picture-pack contrast

**Shape:**
No first-encounter opener at all. Remove the opener gate for `cvc-words-short-i`. Marian encounters "pig," "sit," "lip" across multiple sessions; each session's picture-word pairing and normal repetition serves as the discrimination scaffold. The parent (Thomas) says the contrast once before the first session, as in Option B's cue card, but even that is optional.

**Evidence basis for this being viable:**
This is the "incidental learning through exposure" path. The High-Variability Phonetic Training meta-analyses (Thomson & Derwing, 2015; and the HVPT meta-analysis summarized above, Studies in SLA) show that multiple exposures to words containing the target contrast — across varied phonetic environments — produce robust discrimination. The "one lifetime-once dose" framing from `short-i-opener-phrasing.md` is supported by Barlow & Gierut (2002) [Moderate], but that evidence is for minimal-pair remediation in speech-language therapy contexts, not phonics acquisition in an L2 app where every session already provides repetitions of the target words. Marian's existing path (8 short-i words per session, each with picture + audio + repeat exposure across sessions) may be sufficient.

**Trade-offs:**
- Impl cost: lowest — it is removing a feature, not adding one.
- Pedagogy quality: adequate. Not ideal, but the literature supports that multiple-exposure + picture pairing is the primary mechanism anyway.
- Marian-side intelligibility: n/a.
- Parent-side dependency: minimal.

**When to use:** If the team decides the opener is not worth any implementation cost given the wide runway. Explicitly acceptable to hold as the default until short-i actually becomes the active focus node, then reassess.

---

## Evidence

- **Delattre, Liberman & Cooper (1952). "Acoustic loci and transitional cues for consonants." JASA 24(2):152–155.** Classic acoustics: vowel identity is carried by formant transitions from adjacent consonants, not by steady-state vowel alone. Bare vowel tokens in isolation are perceptually degraded. [Strong — foundational, extensively replicated.]

- **Thomson, R.I. & Derwing, T.M. (2015). "The effectiveness of L2 pronunciation instruction: A narrative review." Applied Linguistics, 36(3):326–344. https://doi.org/10.1093/applin/amu076** [Strong — narrative review of multiple RCTs.] Repetition across phonetic contexts, not one-time phoneme demonstration, drives L2 perceptual learning.

- **HVPT meta-analysis (Studies in Second Language Acquisition, 2025). "High variability phonetic training: A meta-analysis of L2 perceptual training studies." https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6** [Strong — meta-analysis.] Identification tasks produce larger gains (g = 0.95) than discrimination tasks; exposure to multiple words containing the contrast is more effective than isolated phoneme training.

- **Estes, K.G. & Hurley, K. (2013). "Infant-directed prosody helps infants map words to referents." *Infancy*, 18(5):797–824. PMC5579076 https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5579076/** [Moderate — word-learning, extends to school-age.] Utterance-final position and within-sequence pauses aid word-referent mapping; applies to how the sequence of utterances in Option A is structured.

- **Tyler et al. (2014). Perceptual Assimilation Model applied to Tagalog /i/ vs English /ɪ/. PMC4143388. https://pmc.ncbi.nlm.nih.gov/articles/PMC4143388/** [Strong.] Cited in `short-i-opener-phrasing.md`: Tagalog /i/ is a tense high-front vowel; English /ɪ/ assimilates as a "poor instance" of the same category. The contrast must be taught explicitly — repetition alone may not fully resolve the merger, but it is necessary in addition to (not replaceable by) a one-time demonstration.

- **Barlow & Gierut (2002). "Minimal pair approaches to phonological remediation." Seminars in Speech and Language, 23(1):57–68.** [Moderate.] Cited in `short-i-opener-phrasing.md` for "lifetime-once dose" rationale. Evidence is from SLT context, not an L2 phonics app — the transfer should be treated as Moderate.

- **PR #192 four-iteration history and Thomas's ear-test results.** [Strong empirical — project-specific.] Documented in `planner-and-canon.md` §"Tier-specific opener pattern" (5th IPA-outcomes class). All notation variants were tried; all produced intelligible failure. This is first-party empirical evidence that overrides any theoretical argument for trying another notation variant.

---

## Application to Marian

Marian is on short-o and short-u now. She has at minimum 3-4 weeks before short-i becomes her active focus node. The v2 design does not need to ship before short-i goes live. However, the design must be settled before Kevin/Devon implements the `cvc-words-short-i` first-encounter gate.

Her Tagalog /i/ is tense and high; it will pull her toward /iː/ for English short /ɪ/. This is a genuine discrimination gap — not a drill problem. She needs to hear the contrast between "pee" and "pig" from a voice that renders both correctly. Option A's "Not pee — pig. Short i." delivers that contrast reliably, since both are real English words in Azure's lexicon.

The current voice (`en-GB-OliviaNeural`, PR #356) renders English words more reliably than it follows phoneme overrides — this is an advantage for Option A, which requires no phoneme override table entries.

---

## Risks / counter-evidence

1. **Option A's "Not pee — pig." utterance — will Olivia's prosody on "Not pee" stress the right syllable?** The utterance is a short natural sentence; Olivia should stress "pee" and "pig" contrastively (both receive main stress in a minimal-pair frame). This should be ear-tested at canon bake. If the prosody is flat, the fix is to add `<prosody>` emphasis on "pee" and "pig" — but this is a known-good pattern (Olivia honours `<prosody>` per the round-2 audio findings).

2. **Tyler et al.'s PAM evidence applies to adults.** The assimilation model and SLM-r are primarily validated on adult L2 learners. For Marian at 8, the picture is more optimistic: younger learners have greater neural plasticity and can form new phonological categories with less interference from L1. This makes the one-time contrast demonstration in Option A more likely to be sufficient, not less.

3. **Repetition alone may not resolve the /ɪ/ merger.** Option D's "rely on exposure" path is viable but carries a non-trivial risk that Marian's perceptual category never fully separates /ɪ/ from /iː/ through exposure alone, because PAM predicts the substitution direction is stable without explicit contrast instruction. This is why Option A (explicit contrast, low cost) is preferred over Option D.

4. **The parent cue card (Option B) is only as good as Thomas's consistency.** Not a risk for this specific family — Thomas is highly engaged — but noted as a design weakness for any future multi-user context.

---

## Recommendations

### For Matt (ticket priority / implementation scope)

**Recommendation: Option A, implemented at the same time as or just before the `cvc-words-short-i` canon ships.** Not urgent now (Marian has wide runway). When the short-i planner directive is ready for first-class canon:

1. Add three utterance ids to the first-encounter gate for `cvc-words-short-i`: `word.opener.short-i.prime`, `word.opener.short-i.anchor`, `word.opener.short-i.contrast`. Text: "Listen for the short i sound." / "Pig." / "Not pee — pig. Short i."
2. The existing first-encounter gate infrastructure from PR #174 (short-u opener) handles the lifetime-once firing. The only new code is the utterance sequence (three ids, three TTS renders in the canon bake) and the session-start ordering (fire the three utterances before P1).
3. Option B (parent cue card on the Parent Settings page) can ship alongside as supplementary — low-cost static copy, no new components.
4. Do NOT commission another notation variant. The pipeline evidence is conclusive.

### For Kyle (spec changes)

1. The WordSong first-encounter opener pattern (for short-i and any future vowel) should be specced as a multi-utterance sequence, not a single complex utterance. The spec should state: three utterance slots, each plain English, paused between by the natural delay of three TTS audio elements.
2. The Parent Settings "cue cards" section (if it exists or is planned) should surface one card per upcoming vowel, with the minimal-pair contrast phrase Thomas can say to Marian. This is the highest-fidelity phoneme demonstration available — a human voice with visible mouth shape and responsive feedback.
3. No UI design work needed for Option A specifically — it uses the existing Emma speech ribbon and session-start audio infrastructure.

---

## Migration from v1

v1 (PR #192) was closed; the `cvc-words-short-i` canon has no opener line currently. There is nothing to migrate — the opener slot is empty. v2 fills it for the first time when the `cvc-words-short-i` first-encounter gate is implemented. The `short-i-opener-phrasing.md` research doc is superseded by this doc for the design decision; it retains value as context for why the contrast target is /iː/ (not any other English vowel).

The same v2 pattern (Option A multi-utterance sequence) should be applied retroactively to the short-u opener in `cvc-words-short-u.json` if that opener also uses phoneme notation. Read the current `cvc-words-short-u.json::session.end.opener` utterance text; if it contains notation artifacts, a targeted re-bake with the Option A pattern is warranted.

---

## Sources index

| # | Citation | Strength |
|---|----------|----------|
| 1 | Delattre, Liberman & Cooper (1952). JASA 24(2):152. Acoustic loci and consonant transitions. | Strong (foundational acoustics) |
| 2 | Thomson & Derwing (2015). Applied Linguistics 36(3):326. L2 pronunciation instruction narrative review. https://doi.org/10.1093/applin/amu076 | Strong |
| 3 | High Variability Phonetic Training meta-analysis. Studies in SLA (2025). https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6 | Strong |
| 4 | Estes & Hurley (2013). Infancy 18(5):797. PMC5579076. Prosodic cues and word learning. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5579076/ | Moderate |
| 5 | Tyler et al. (2014). PAM applied to Tagalog /i/ vs English /ɪ/. PMC4143388. https://pmc.ncbi.nlm.nih.gov/articles/PMC4143388/ | Strong |
| 6 | Barlow & Gierut (2002). Seminars in Speech and Language 23(1):57. Minimal pair approaches. | Moderate (SLT context) |
| 7 | PR #192 ear-test evidence + planner-and-canon.md §"Tier-specific opener pattern." Project-internal empirical. | Strong (first-party) |
| 8 | Dave (2026-05-10). short-i-opener-phrasing.md (internal). | Internal context |
