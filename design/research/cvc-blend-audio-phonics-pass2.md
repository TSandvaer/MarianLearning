# CVC Blend Audio — Phonics Pass 2: Remaining Fails After Stop Fix

## Question

Candidate f (lightly-released stops: /kə/, /bə/ etc.) fixed the stop consonant class. Voice-QA report
#467 (14 blend fails) shows the **continuants and glides** still scratch. Specifically: **h** (hat/hen/hot),
**f** (fan/fig/fox), **s** (sip/sun), **v** (van), **j /dʒ/** (jam/jet/jug), **w** (web/wig — heard as
"U not W"). This note characterises each class, decides fixable vs voice-floor, and ranks candidate
render approaches to audition.

Stops are already solved. This note does not re-litigate them.

## Bottom line

**Fricatives f, s, h:** Elongation ("fff", "sss", "hhh") is the phonics-standard method — continuants
are periodic signals a neural vocoder can sustain, and elongation is what every UK SSP programme (Jolly
Phonics, Read Write Inc., Letters and Sounds) prescribes. These should be fixable via longer IPA phoneme
or orthographic repetition in SSML. Audition before committing.

**Glide /w/:** Glides cannot be truly elongated without drifting toward a vowel. In isolation /w/ needs
a brief vowel offglide to be perceptible — render as "wuh" (orthographic) at a slowed rate rather than
a bare IPA `<phoneme>`. The "U not W" failure is a known consequence of bare glide rendering; the fix is
a minimal vowel support, same principle as the stop fix but lighter.

**Affricate /dʒ/ (j):** Affricates are stop + fricative in sequence; they cannot be elongated as a unit.
In isolation /dʒ/ behaves like a stop on its release-onset — render with a very short vowel support
("juh", parallel to the stop fix), not elongation. The fricative tail is already perceptible if the stop
onset is clean.

**Voiced fricative /v/:** /v/ is confirmed at voice-floor on en-GB-OliviaNeural from the letter-sounds
audit (word.p2 "vvv scratchy"). Tagalog has no native /v/ phoneme (/v/ enters only through loanwords),
so Marian's L1 does not give her a perceptual anchor for this sound. Both factors argue for accepting
/v/ as floor and routing any "v" blend clip to the whole-word-only (Candidate D) fallback.

## Evidence

### Fricatives as continuants — elongation is pedagogically correct

- **Reading Advice Hub, "Continuous Sounds and Stop Sounds in Phonics."**
  [thereadingadvicehub.com](https://thereadingadvicehub.com/continuous-sounds-and-stop-sounds-in-phonics/)
  — Distinguishes continuous sounds (/f/, /v/, /s/, /m/, /n/, /l/, /r/ and the digraphs /sh/, /th/, /ng/)
  from stops. Explicitly lists /h/, /w/, /y/ as continuants that are "trickier to extend without
  distorting." Continuants CAN be stretched; stops cannot be prolonged without schwa artefact. The article
  cites John Walker on the pedagogic value of stretching continuous sounds so children can "hear and
  identify the sound." **Moderate evidence** (practitioner source, but represents uniform SSP consensus
  across UK programmes).

- **Speech and Language Kids, "Teaching Long Sounds."**
  [speechandlanguagekids.com](https://www.speechandlanguagekids.com/teaching-long-sounds/)
  — Speech-language pathology source: fricatives (/f/, /v/, /s/, /z/, /sh/, /th/) are "long sounds" that
  "can be stretched and held." Explicit instruction to have students hold the sound (e.g., feel the air
  stream on their hand for /f/). Confirms that /f/ and /v/ share the same place of articulation but /f/
  is voiceless and /v/ voiced; /v/ is noted as harder to isolate cleanly. **Moderate evidence** (SLP
  practitioner guidance).

- **Relay Graduate School "Science of Teaching Reading — Consonant Phonemes."**
  [relay.libguides.com](https://relay.libguides.com/science-of-teaching-reading-resource-guide/consonant-phonemes)
  — Confirms stops as "sounds we cannot hold" vs fricatives as sustainable; classifies /w/ and /y/ as
  glides/semivowels with "unobstructed, frictionless airflow" — technically distinct from fricatives but
  still technically continuant in production. **Weak** (reference guide, not primary research).

- **Dyslexia Classroom, "What in the World is a Fricative?"**
  [thedyslexiaclassroom.com](https://www.thedyslexiaclassroom.com/blog/what-in-the-world-is-a-fricative)
  — Confirms /f/ and /v/ are labiodental fricatives; stresses keeping sounds "in their purest form in
  isolation"; recommends immediate word-level practice for fricatives. No elongation contraindication
  for these phonemes. **Weak** (practitioner explainer).

### The /h/ phoneme — fixable, but tricky to elongate

/h/ is a voiceless glottal fricative: airflow passes through a nearly-open vocal tract with very little
turbulence compared to /f/ or /s/. The Reading Advice Hub notes it is among the continuants that are
"trickier to extend without distorting." In isolation, a prolonged /h/ sounds like exaggerated breathing;
the sound is mainly perceptible through the vowel transition that follows it. For Marian: Tagalog has
/h/ as a native phoneme (MultiCSD Tagalog data: /p, t, k, ʔ, b, d, g, m, n, ŋ, s, h, l, ɾ, w, j/ are
the native consonants), so she already has the perceptual category. The problem is TTS rendering, not
L1 gap. A short orthographic "hhh" or IPA `<phoneme ph="h">h</phoneme>` at slower rate is worth
auditioning; but if it renders as a breath artefact, the fallback is a minimal vowel support ("huh")
parallel to the stop fix.

### Affricates /dʒ/ — stop-onset, fricative tail

- **Dyslexia Classroom, "What in the World are Affricates?"**
  [thedyslexiaclassroom.com](https://www.thedyslexiaclassroom.com/blog/what-in-the-world-are-affricates)
  — "Sounds that begin as a stop and release into a fricative — making them feel like a blend of two
  sounds, even though they function as single phonemes." /dʒ/ (j) and /tʃ/ (ch). The article emphasises
  multisensory practice within words; no elongation is possible because the stop-onset component cannot
  be sustained. **Moderate evidence** (specialist dyslexia educator; well-aligned with phonetic
  literature on affricates).

- Phonetic consensus (Wikipedia "Voiced postalveolar affricate"): /dʒ/ = voiced alveolar stop /d/ +
  palato-alveolar fricative /ʒ/. Because it starts as a stop, the same issue as stop consonants applies
  to its onset: no coarticulation anchor, same artefact risk. The fricative tail /ʒ/ is perceptible once
  the stop releases cleanly.

### Glide /w/ — not a true fricative, needs vowel support

/w/ is a voiced labio-velar approximant (glide/semivowel). It is not strictly a fricative: the vocal
tract is almost as open as for a vowel. The reason "web" was heard as "U not W" is that a bare /w/ in
isolation, without a following vowel to transition into, sounds indistinguishable from the /uː/ vowel
— the glide's defining feature IS the rapid formant transition from [u]-like position into the following
vowel. With no following vowel (as in a pause-delimited blend slot), the TTS renders the starting
position of the glide as a held vowel.

- **Red Cat Reading, "Phonics Letter W Sound."**
  [redcatreading.com](https://www.redcatreading.com/phonics-letter-w-sound/)
  — Teaching guidance: form tight O-shaped lips and then "make the w sound with vocal cords" — the
  O-shape + voice-on IS the /w/ onset; the instruction implicitly calls for a brief schwa-like vowel
  release to distinguish from /uː/. **Weak** (practitioner page), but consistent with the phonetic
  mechanism.

- Reading Advice Hub (above) classifies /w/ as a continuant that is "trickier to extend without
  distorting" — consistent with the L-position/vowel-like character described above.

For Marian: Tagalog has native /w/ (confirmed: MultiCSD data above), so the L1 perceptual category is
present. She knows what /w/ sounds like in words; she just cannot perceive a bare glide without a vowel
target.

### /v/ — voice-floor confirmation and L1 gap

- **MultiCSD Tagalog phonology data** and **Segment Substitution in Philippine English (CUHK, Yao 2010)**
  [se.cuhk.edu.hk](https://www1.se.cuhk.edu.hk/~hccl/publications/pub/10Mingxing.pdf) — Tagalog's native
  consonant inventory does NOT include /v/. /v/ enters only through Spanish/English loanwords; native
  words substitute /b/ for /v/ at the phonological level. This means Marian has no established
  perceptual category for /v/ from L1 and is likely to hear a scratchy /v/ as /b/ or noise. **Moderate
  evidence** (linguistic description + attested substitution pattern in Philippine English).

- **Voice-QA #467 / letter-sounds audit word.p2:** en-GB-OliviaNeural is documented as producing a
  scratchy /v/ in isolation ("vvv scratchy" — this is the existing voice-floor note from the project).
  This is not a render-strategy problem; it is a characteristic of this neural voice's voicing model for
  the labiodental fricative with no vowel context. **Direct empirical observation on this project.**

Both factors converge: /v/ is floor.

## Application to Marian

Marian's L1 (Tagalog) already has /h/, /s/, /w/, and /f/ as established phonemes or phonetically
adjacent sounds. The TTS failure on these is a rendering problem, not a perceptual gap — she will
recognise the correct sound if the render is clean.

/v/ is a genuine L1 gap: Tagalog does not have native /v/; Filipino English speakers substitute /b/ for
/v/ at the phonological level. A scratchy /v/ from TTS gives Marian nothing to anchor to — she is
simultaneously being asked to perceive a novel phoneme through degraded audio. That is double jeopardy.
Accept /v/ as floor.

/dʒ/ (j): Tagalog's native inventory includes /dʒ/ only through loanwords (consistent with MultiCSD
data listing it as absent). However, Marian's English exposure at age 8 likely gives her a working
perceptual category from vocabulary ("jam", "jug" are common words). The problem is TTS rendering of
the stop-onset in isolation, same mechanism as the stop fix. Treat as an affricate requiring vowel
support, not as a perceptual gap.

## Risks / counter-evidence

- **Elongation of /h/ risks breath-sound artefact.** Unlike /f/ and /s/ which have clear spectral
  signatures even in isolation, /h/ at high energy levels just sounds like breathing. If OliviaNeural
  renders prolonged /h/ as an aspirate breath (no clear voiceless fricative spectrum), the perceptible
  signal collapses. Audition required before committing to elongation for /h/.
- **No controlled evidence on TTS-delivered phonics for continuants specifically.** The Gonzalez-Frey
  /Ehri (2021) RCT (cited in Pass 1) was live teacher delivery. Transfer to neural TTS audio is
  reasonable but extrapolated.
- **Orthographic repetition ("fff", "sss") vs IPA `<phoneme>` tags:** Azure SSML phoneme tag quality
  for isolated fricatives in en-GB locale is not well-documented publicly. Orthographic repetition
  ("fff", "sss") is a simpler, more audition-predictable strategy and should be tested first before
  relying on IPA phoneme tags in isolation.
- **/w/ vowel support creates a "wuh" syllable.** This is the same risk as the stop fix — the carrier
  must be light and brief. Acceptance criterion: does it sound closer to "wuh ... web" or to the natural
  /w/ onset of the word "web" said slowly? The former is acceptable; a heavy "WUH ... web" is not.

## Recommendations

### By phoneme class

#### Voiceless fricatives: /f/ (fan/fox/fig), /s/ (sip/sun)

**Top approach: orthographic elongation ("fff", "sss") in the phoneme slot.**

Use the literal text `fff` or `sss` (3–4 repeated characters) inside a `<prosody rate="-20%">` wrapper
with NO `<phoneme>` tag. Repeated characters force the vocoder into sustained fricative production;
neural voices handle this better than bare IPA isolated phonemes because they have a phonetic context
to coarticulate against (the following character is the same phoneme, not a break/silence).

If orthographic repetition produces quality output, use it. If the output is unnatural, then try
`<phoneme alphabet="ipa" ph="ffff">f</phoneme>` (extended IPA duration via character repetition in the
ph attribute — a lesser-documented trick that some Azure voices honour for continuants).

**Do NOT use:** single-character IPA `<phoneme ph="f">f</phoneme>` in isolation (same class of failure
as the stop phoneme: model needs sustained signal to avoid clipping). Do not add a vowel support (schwa)
for /f/ and /s/ — these fricatives are clean continuants that do not need it.

Ranking for audition:

1. `fff` / `sss` orthographic + `<prosody rate="-20%">`
2. `<phoneme alphabet="ipa" ph="ffff">f</phoneme>` (extended IPA)
3. Light vowel support `fə` / `sə` ONLY if 1 and 2 both fail ear-test

#### Glottal fricative: /h/ (hat/hen/hot)

**Top approach: short orthographic "hhh" at reduced rate, then audition.**

/h/ has much lower spectral energy than /f/ and /s/. Orthographic `hhh` is the first candidate; if it
renders as clear breath aspiration (perceptibly "h" not a generic breath), accept it. If it renders as a
neutral breath artefact, fall back to a light vowel support "huh" (identical principle to the stop fix:
brief, barely-perceptible schwa carrier). Acceptance criterion: Thomas should hear a clear /h/ onset
rather than generic breath or silence.

Ranking for audition:

1. `hhh` + `<prosody rate="-20%">`
2. `<phoneme alphabet="ipa" ph="h">h</phoneme>` (standard IPA, test for clarity)
3. "huh" minimal vowel support (fallback parallel to stop fix)

**What to avoid:** prolonged "hhhhhh" (5+ chars) — likely renders as sustained breathing rather than
phoneme. Keep to 3 repetitions.

#### Glide: /w/ (web/wig)

**Top approach: minimal vowel support "wuh" as orthographic text.**

The "U not W" failure is structural: a bare glide with no vowel target collapses to its vowel-onset
position. The fix is the same principle used for stops: a brief, de-emphasised vowel support. Render
the /w/ phoneme slot as the text "wuh" (not IPA, not "w" alone) inside a `<prosody rate="-20%" pitch="-10%">` wrapper to keep the schwa subordinate.

IPA `<phoneme alphabet="ipa" ph="w">w</phoneme>` will likely reproduce the same "U" artefact because
the model has no coarticulation target.

Ranking for audition:

1. `"wuh"` orthographic + `<prosody rate="-20%" pitch="-10%">`
2. `<phoneme alphabet="ipa" ph="wʌ">w</phoneme>` (IPA glide + schwa target)
3. NOT: bare `<phoneme ph="w">w</phoneme>` (structurally the same as the failing render)

**What to avoid:** any strategy that delivers bare /w/ with a long inter-phoneme break — the glide
literally cannot exist in isolation without a vowel context.

#### Affricate: /dʒ/ (jam/jet/jug)

**Top approach: minimal vowel support "juh" — same principle as the stop fix.**

/dʒ/ has a stop onset (/d/) that cannot be elongated. The stop-onset is the failing component in the
current render. The fricative tail /ʒ/ adds a small amount of perceptible signal after the release, but
only if the onset is clean. Use the same solution as the stop fix: minimal orthographic "juh" with
`<prosody rate="-20%" pitch="-10%">` wrapper to keep the schwa brief.

IPA `<phoneme alphabet="ipa" ph="dʒ">j</phoneme>` in isolation will produce the same stop-artefact as
the pre-fix stop consonants; do not use.

Ranking for audition:

1. `"juh"` orthographic + `<prosody rate="-20%" pitch="-10%">`
2. `<phoneme alphabet="ipa" ph="dʒʌ">j</phoneme>` (IPA affricate + schwa)
3. Whole-word-only fallback (Candidate D from Pass 1) if 1 and 2 fail

**What to avoid:** elongation attempts ("jjj") — the stop onset means you are just delaying the same
artefact, not solving it.

#### Voiced fricative: /v/ (van)

**Accept as voice-floor. Do not chase further.**

en-GB-OliviaNeural produces a scratchy /v/ in isolation — confirmed by voice-QA. Tagalog has no native
/v/ phoneme, adding a perceptual-gap layer on top of the TTS floor. There is no render strategy that
solves a voice-characteristic limit from the app layer.

**Action for "van" (and any other /v/-onset word):** Route the blend slot to Candidate D (whole-word
slow delivery) rather than per-phoneme segmentation. Emma says "van" twice — once slowly, once at
natural rate. This is the same fallback already prescribed in Pass 1. Flag "van" in the audition page
as "D-only" so Thomas is not evaluating it on the same rubric as the fixable phonemes.

### Summary table

| Phoneme class | Exemplar words | Fixable? | Top candidate | Floor fallback |
|---|---|---|---|---|
| Voiceless fricative | fan, sip, fox, sun | Yes | Orthographic elongation: `fff`, `sss` | Light `fə`/`sə` (last resort) |
| Glottal fricative | hat, hen, hot | Likely yes | Orthographic `hhh` + audition | "huh" vowel support |
| Voiced fricative | van | NO — floor | — | Whole-word-only (Candidate D) |
| Glide | web, wig | Yes (with support) | "wuh" orthographic + pitch-down | Not applicable |
| Affricate | jam, jet, jug | Yes (with support) | "juh" orthographic + pitch-down | Whole-word-only if fails |

### What the audition page should test

The existing audition-page pattern (per-cell, badge-changed-cells, one-pass A/B) applies. For each
remaining-fail word:

- Column A: top candidate render (see table)
- Column B: fallback render (vowel-support or whole-word)
- Column C: Candidate D whole-word-only baseline

Thomas accepts A or B per word; C is always acceptable as a floor.

Accept criterion: "sounds like the phoneme I am trying to teach, at a volume and duration a child can hear clearly." Reject criterion: "scratchy, breathing, or 'U' — phoneme unrecognisable."

### For Kevin / implementation

- Orthographic repetition (`fff`, `sss`, `hhh`) does NOT require changing the `<phoneme>` machinery —
  it is a text substitution in the blend-slot text before passing to `buildSsmlBody`. Simpler to ship
  than IPA tag changes.
- Vowel-support slots ("wuh", "juh", "huh" if needed) follow the same SSML pattern as the existing
  stop fix: wrap in `<prosody rate="-20%" pitch="-10%">` to suppress the carrier.
- "van" blend slot: add a per-word routing table in `renderBlendInnerText` — if `phoneme` is in
  `BLEND_FLOOR_PHONEMES` (initially just `/v/`), emit the Candidate D whole-word render instead.

## Non-obvious findings

- **Tagalog has native /h/ and /w/.** Marian's L1 difficulty is TTS rendering only for these two
  phonemes, not a perceptual gap. This makes them higher-priority to fix correctly than /v/.
- **/v/ is the only phoneme in the remaining fail set that is BOTH a TTS floor AND a Tagalog L1
  absence.** This double jeopardy strongly argues for accepting it as floor rather than investing
  further audition rounds.
- **The "U not W" failure is structurally predictable from glide phonetics.** Glides' acoustic
  signature IS a rapid formant transition; without the following vowel to transition into, the TTS
  has no choice but to render the starting vowel-like configuration. This is not an Azure bug — it
  is a property of glide phonology. Any bare-glide IPA render will reproduce it.
- **/dʒ/ belongs with the stops for render purposes, not with the fricatives.** The stop-onset makes
  elongation inapplicable; the fix is the same family as the stop fix already shipped. This classification
  prevents the implementation team from accidentally applying the "fff"-style elongation to "j" words.
- **Orthographic repetition ("fff") as a SSML strategy is under-documented but empirically more reliable
  than bare isolated IPA phonemes for continuants.** Neural TTS vocoders optimise for natural speech
  and handle sustained identical phoneme sequences better than bare isolated phoneme tags (which were
  designed for whole-word disambiguation, not sub-phoneme isolation). No peer-reviewed source confirms
  this; it is a practitioner-grounded inference from the known vocoder architecture.
