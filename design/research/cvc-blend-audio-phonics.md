# CVC Blend Audio — Phonics Guardrails for Re-render

## Question

The current `renderBlendInnerText` implementation voices each grapheme as a bare IPA phoneme
(`<phoneme alphabet="ipa" ph="k">c</phoneme>`) with 250 ms breaks between graphemes and a -12%
prosody rate. All ~37 clips were ear-tested as FAIL: isolated stop consonants (/k/, /b/, /p/, /t/,
/d/, /g/) render as a scratch or glottal burst with no perceptible phoneme value. What is the
phonically honest set of candidate re-render approaches, and which is ranked highest for a child
at Marian's blending stage?

## Bottom line

Pure isolated stop consonants are **inherently unreliable in neural TTS** — the same failure that
makes teachers avoid "kuh"/"buh" applies in reverse: there is no vowel for the synthesis model to
coarticulate against, so the output is artefact, not phoneme. The most defensible re-render is
**vowel-supported stops** (add a brief, very soft /ə/ carrier on each stop consonant only), which
mirrors the "lightly-released" teacher model used in every major en-GB synthetic phonics programme.
Schwa is only acceptable in this constrained, intentionally-brief form — not as a habitual
"syllabification" of consonants. Connected or near-connected delivery (very tight inter-phoneme
gaps, ≤150 ms) is strongly preferred over the current 250 ms choppy gaps, because research shows
segmented phonation causes children to forget the initial phoneme before they can blend.

## Evidence

- **Gonzalez-Frey, S. M. & Ehri, L. C. (2021).** "Connected Phonation Is More Effective than
  Segmented Phonation for Teaching Beginning Readers to Decode Unfamiliar Words." *Scientific
  Studies of Reading*, 25(3), 272–285.
  [ERIC abstract](https://eric.ed.gov/?id=EJ1295469) |
  [Tandfonline](https://www.tandfonline.com/doi/abs/10.1080/10888438.2020.1776290)
  — RCT with kindergartners (M age 5.6). The segmented group (pauses between phonemes: "sss -- aaa
  -- nnn") performed significantly worse than the connected group (no pauses: "sssaaannn") on
  decoding transfer. Error analysis showed segmented delivery caused children to *forget the initial
  phoneme* before synthesising the word. **Strong evidence** (published RCT in a flagship reading
  journal; directly relevant to the current 250 ms inter-grapheme gap).

- **Monster Phonics / Letters and Sounds practitioner consensus (UK SSP sector).** "Pure sounds in
  phonics." [Monster Phonics](https://monsterphonics.com/the-importance-of-pure-sounds-in-phonics/)
  — Uniform practitioner consensus across UK SSP programmes (Letters and Sounds 2007, Jolly
  Phonics, Read Write Inc.): consonants must be voiced without adding schwa *habitually*, because
  "kuh-a-tuh" will never blend to "cat". Thousands of UK classrooms run on this principle.
  **Moderate evidence** (practitioner consensus, not a controlled study, but extremely consistent
  across independent programmes and corroborated by the Gonzalez-Frey/Ehri mechanism).

- **Reading Advice Hub, "Stop Sounds vs. Continuous Sounds in Phonics."**
  [thereadingadvicehub.com](https://thereadingadvicehub.com/continuous-sounds-and-stop-sounds-in-phonics/)
  — Articulates the stop/continuant distinction clearly: continuous sounds (f, v, s, m, n, l, r)
  can be stretched; stop sounds (b, k, d, g, p, t) cannot be prolonged without artefact. Key line:
  "Teachers should not try to *extend* stop sounds when teaching blending because this adds the
  schwa which makes it more difficult for children to identify the words." **Weak** (practitioner
  explainer, no primary data) but consistent with the RCT mechanism above.

- **Collaborative Classroom, "The Power of Continuous Blending."**
  [collaborativeclassroom.org](https://www.collaborativeclassroom.org/blog/the-power-of-continuous-blending-using-connected-phonation-to-support-decoding/)
  — Distinguishes continuous from stop sounds; notes "skills from connected phonation transfer to
  support decoding of words beginning with stop sounds" even though connected phonation is harder
  to model for stops. Supports a hybrid strategy: use continuous starts to build the schema, then
  generalise. **Weak** (secondary commentary), but supports the candidate ranking below.

- **Tagalog phonology baseline.** [Wikipedia: Tagalog phonology](https://en.wikipedia.org/wiki/Tagalog_phonology)
  — Tagalog has the same set of stops as English (/p/, /t/, /k/, /b/, /d/, /g/), so Marian's L1
  already has correct stop articulation categories. Her challenge is not perceiving the stops (they
  are not foreign phonemes) but hearing them in *isolation* — which is the TTS rendering problem,
  not a phonemic awareness gap. Nine English phonemes absent from Tagalog include /v/, /z/, /ʃ/,
  /tʃ/ — none of which appear in the current CVC short-a/o pool. **Relevant context**, not a
  controlled study.

- **Five from Five, "Blending and Segmenting."** [fivefromfive.com.au](https://fivefromfive.com.au/phonics-teaching/essential-principles-of-systematic-and-explicit-phonics-instruction/blending-and-segmenting/)
  — Australian evidence-synthesis: "start with words that have only two phonemes and begin with
  *continuous* sounds; stop sounds require careful teaching and considerable practice." Confirms the
  continuant-first ordering and that stops require extra support. **Moderate** (systematic evidence
  synthesis, though not a meta-analysis).

## Application to Marian

Marian is at the **CVC-emerging** stage (diagnostic April 2026: CV confident, CVC emerging). This
is exactly the stage where the Gonzalez-Frey/Ehri findings apply most sharply — she is building the
blending schema, not automating it, so inter-phoneme gaps are actively harmful to her ability to
hold the initial consonant in working memory while she processes the vowel.

Her Tagalog L1 gives her correct stop articulations perceptually — she *knows* what /k/ sounds like
in a word. What she cannot do is hear a TTS scratch and map it to /k/. The current FAIL clips give
her no phoneme to bind to.

For continuants (f, v, s, m, n, l), the pure IPA phoneme approach *does* work in neural TTS
(continuants are periodic signals that the vocoder can sustain). The problem is specifically the
stops: /b/, /k/, /p/, /g/, /d/, /t/.

The short-a word pool (cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van) has
stop consonants in onset **and** coda positions in most words, so there is no workaround by word
selection. The stops must be rendered correctly.

## Risks / counter-evidence

- The schwa-carrier approach (see Candidate A below) risks **over-exaggerating** the carrier if the
  prosody rate is too slow or the carrier duration is wrong — turning a lightly-released /k/ into a
  salient "kuh" that Marian internalises as the sound. The acceptance criterion must be stringent:
  the carrier must be barely perceptible, not a voiced syllable.
- There is limited controlled evidence on *TTS-delivered* phonics blending specifically. The
  Gonzalez-Frey/Ehri study used live teacher delivery. It is reasonable to assume the mechanism
  (working-memory load from inter-phoneme pauses) transfers to audio playback, but this is an
  extrapolation.
- Connected phonation is hardest to model for words that *start* with a stop. In the CVC pool,
  onset stops (cat, bat, cap, can, bag, dad) are the majority pattern. This limits how much a
  "stretch the first sound" strategy can help, and pushes us toward the vowel-supported approach.
- If Azure OliviaNeural does not support the `<phoneme>` tag cleanly for en-GB (there is one
  documented mispronunciation report for a different neural voice on isolated words), the vowel
  support approach may need to be delivered as **orthographic text** with prosody control rather
  than IPA tags. The audition page should test both paths.

## Recommendations

### Four phonically-valid candidates, ranked

**A — Vowel-supported stops, continuants pure (RECOMMENDED)**

Consonant-by-consonant delivery but stops receive a minimal attached vowel: `/k/` is rendered as
`<phoneme ph="kə">c</phoneme>` (lightly-released /kə/) while continuants remain pure
(`<phoneme ph="æ">a</phoneme>` for the vowel, `<phoneme ph="t">t</phoneme>` for a coda stop also
gets the same treatment). Inter-phoneme break shrinks to 150 ms (tighter than current 250 ms, per
the Gonzalez-Frey/Ehri evidence that longer gaps impair blending). Prosody rate: -20% (slower than
current -12% to give Marian time to hear each phoneme clearly, compensating for the tighter gaps).

*Why ranked first:* Models what every en-GB SSP teacher actually does — a "clipped release" for
stops rather than a held pure stop. Preserves the pedagogic structure (segmented → whole word).
Continuants stay pure (no distortion risk). The schwa carrier is present only where perceptually
necessary. Whole-word pronunciation afterward is natural, so the blended model is still heard.

*Risk:* Carrier /ə/ must be very brief. If the synthesis renders it as a full syllable, the word
becomes "kuh-æ-tuh ... cat" which is the pedagogic anti-pattern. The audition page acceptance
criterion must gate on this.

**B — Connected phonation on continuants, break-before-stop**

For words starting with a continuant (fan, man, van, jam), render the opening continuant as a
stretched IPA phoneme with NO leading break (starts immediately), then join it toward the vowel with
a very short 80 ms break: `<phoneme ph="f">f</phoneme><break time="80ms"/>`. For words starting
with a stop (cat, bat, cap, can, tag, dad, bag, hat, mat), fall back to Candidate A (vowel-
supported). Overall rate: -20%.

*Why ranked second:* Maximally faithful to the evidence for continuous-onset words. For the ~50%
of words in the pool that start with stops, it degrades to Candidate A. The asymmetry is a
complexity cost for the developer but not a pedagogic problem for Marian (she hears the right
thing in both cases).

*Risk:* Two code paths instead of one; potential for word-specific per-word tuning to grow unbounded.

**C — Grapheme–letter name as carrier**

Instead of IPA phonemes, render each grapheme as its *letter name in isolation* at very reduced
pitch: "See - ay - tee ... cat". This is NOT phonically authentic — letter names ≠ phonemes — but
it at least produces clean, perceptible audio. Some phonics apps use this as a scaffold for very
early readers before pure phoneme awareness is established.

*Why ranked third:* It works acoustically (letter names are full syllables, TTS handles them
perfectly), but it teaches the wrong mapping. A child who hears "see-ay-tee" cannot generalise to
reading "sock" or "sun" — the letter name /si:/ is not the phoneme /s/. At Marian's current stage
(CVC emerging, consonant sounds already mastered) this would actually regress her phoneme-grapheme
understanding.

*Not recommended unless A and B both fail audition.* If used, must be paired with an explicit
"now let's put it together" spoken word and a clear visual distinction from the phoneme-teaching
screens.

**D — Whole-word natural delivery only (drop segmented blend)**

Remove the per-grapheme segmentation entirely. Emma says the whole word twice — once slowly, once
at natural rate — with a 500 ms gap: `<prosody rate="-25%">cat</prosody><break time="500ms"/>cat`.
This is not a blending model; it is a whole-word scaffolding model. Pedagogically, it gives no
support for letter-sound synthesis, but it produces clean audio every time.

*Why ranked fourth:* The blending sequence exists specifically to teach Marian to decode novel
words by sounding out. Removing it removes the teaching move. However, if three rounds of A/B/C
audition all fail Thomas's ear test, this is the fallback that guarantees the feature does not
actively harm audio quality or produce student confusion from scratch artefacts.

### What to AVOID

**The current approach — bare IPA stop consonant in isolation.** Neural TTS voices (including
en-GB-OliviaNeural) cannot cleanly articulate a stop consonant that has no vowel context. The model
has no coarticulation signal to anchor the stop release, producing either a glottal artefact or
silence. This is not a configuration issue that better SSML will fix within the same approach.
Every candidate above takes a fundamentally different strategy.

**Extended schwa as habitual syllabification** ("kuh - æ - tuh ... cat" with full syllable weight
on each carrier). This is the anti-pattern Letters and Sounds, Jolly Phonics, and all UK SSP
programmes specifically warn against. Marian would hear three syllables and try to blend three
syllables — the word she assembles will not be "cat."

### Acceptance criteria for the audition page

Thomas should judge each candidate clip against these questions:

1. **Stop consonants: perceptible?** Can you clearly hear a /k/ (or /b/ or /t/) rather than a
   click, scratch, or silence?
2. **Stops: clean or "syllabified"?** Is the stop sound noticeably attached to a vowel ("kuh") or
   does it feel clipped and brief? If it sounds like "kuh" as a full syllable, reject.
3. **Continuants: distorted?** Do /f/, /s/, /m/, /n/ sound natural or buzzy/scratchy?
4. **Pace: holding together?** Does the sequence of sounds feel like it is leading toward the
   whole word, or does it feel so choppy that each sound is an isolated event?
5. **Whole-word resolution: clean?** Is the blended word after the break clear and natural?

Candidate A passes if stops are criterion-1 YES and criterion-2 "clipped". It fails if criterion-2
is "full syllable". Candidate B passes on the same criteria; note which specific words pass and
which fall back.

### For Kevin / the implementation

The audition page should present 4 clips per word (one per candidate, same word) so Thomas can
A/B/C/D within a word. Priority words for audition: **cat** (stop onset, stop coda), **fan**
(continuant onset, continuant coda), **bag** (stop onset, stop coda), **man** (continuant onset,
continuant coda). These four cover both onset types and show whether the continuant/stop asymmetry
in Candidate B is perceptible.

Rate and break constants to try for Candidate A: `BLEND_GRAPHEME_BREAK_MS = 150`,
`BLEND_RATE = '-20%'`, stops get `ph="<stop>ə"` with `<prosody pitch="-10%">` wrapper on the
stop phoneme to de-emphasise the carrier.
