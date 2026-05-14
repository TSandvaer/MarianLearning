# Digraph `th` — Voiceless /θ/ Content Addendum for Kyle's Word-List Spec

**Date:** 2026-05-14
**Requested by:** Matt (via orchestrator) — gates Kyle's `digraphs-th-word-list.md` spec
**Extends:** `design/research/digraph-acquisition-marian.md` §Q2 (th-third sequencing, L2 error patterns) and `design/research/digraph-ch-addendum.md` (structural template)
**Parallel dispatch:** Kyle's `digraphs-th-word-list.md` spec is in flight; Kyle reconciles against Section 3's recommended inventory.

---

## Question

What does the evidence say about voiceless /θ/ acquisition for Marian specifically, and which th words should populate her first th-tier pool? The sh tier shipped 7 words (ship/shell/shoe/sheep/shark/shed/shop, 3 hybridMode); the ch tier shipped 7 fully decodable words (chin/chip/chop/chat/chest/chug/chick). What is the right th pool, and which words (if any) need hybridMode treatment?

---

## Bottom line

The voiceless th tier is meaningfully harder than sh and ch for Marian — not because the grapheme concept ("two letters, one sound") is new, but because:

1. /θ/ is one of the latest-acquired consonants in English (McLeod & Crowe 2018: 90% mastery at age 7 for L1 English children — two years after /ʃ/ and /tʃ/ at age 5). Marian is 8, so she is within the expected acquisition window, but the phoneme is genuinely harder to produce and perceive than sh or ch.
2. Tagalog has no /θ/ whatsoever, and unlike /tʃ/ (which has a loanword foothold in Filipino English), /θ/ has no L1 anchoring. The /θ/ → /t/ substitution is the default for all proficiency levels of Philippine English speakers, including acrolectal speakers in formal read speech. Emma's TTS alone may not create a reliable perceptual distinction for Marian — explicit tongue-between-teeth scaffolding is required.
3. The word stock is smaller than sh or ch. Word-initial /θ/ short-vowel words are limited (thin, thick, thud, thump, thank) and most are on the border of picturability. Word-final /θ/ offers the stronger set (bath, math, path, moth, cloth) — familiar, picturable, short-vowel nouns that Marian can decode if she knows the pattern.

**Recommended target-word set (7 words):** thin, thick, path, math, bath, moth, cloth

**HybridMode flags:** bath and cloth are conditional (bath = short-a, decodable; cloth = short-o, decodable — but see §3d for the "both" and "cloth" picturability notes). No long-vowel hybrids required. The full pool of 7 is within Marian's formal vowel instruction.

The th pool is structured differently from sh and ch: it leans heavily on word-final position (5 of 7 words), which is the opposite of the ch pool (all word-initial). This is driven by evidence: the word-final short-vowel th stock is richer and more picturable than the word-initial stock. Kyle's spec should address this positional asymmetry explicitly.

---

## Evidence

### §1 — /θ/ articulation for Marian (Tagalog L1, 8 years old)

#### §1a — /θ/ in the typological context: why this is the hardest digraph

**Source 1 — McLeod, S. & Crowe, K. (2018). "Children's Consonant Acquisition in 27 Languages: A Cross-Linguistic Review." _American Journal of Speech-Language Pathology_, ASHA. https://pubs.asha.org/doi/10.1044/2018_AJSLP-17-0100**

Strong evidence (systematic review across 27 languages, 64 studies, 26,007 children; peer-reviewed ASHA journal). Key finding on acquisition order for the three digraph phonemes in Marian's tier sequence:

| Phoneme | Digraph | 90% mastery age (L1 English) |
| ------- | ------- | ---------------------------- |
| /ʃ/     | sh      | 5;0 (5 years)                |
| /tʃ/    | ch      | 5;0 (5 years)                |
| /θ/     | th      | 7;0 (7 years)                |

The two-year gap is the key finding. /ʃ/ and /tʃ/ are mastered by typical English-speaking children two years before /θ/. Across languages, /θ/ is classified as one of the "latest developing" consonants — more specifically, /θ/ and /ð/ "are among the latest consonants to be acquired in any language" and are absent from roughly 90–93% of the world's languages (dental fricatives are typologically rare). This is not a quirk of English development; it reflects the articulatory complexity of the sound.

**Source 2 — Conductscience.com summary of McLeod & Crowe 2018. "Speech Sound Development Chart." https://conductscience.com/tools/speech-sound-development-chart**

Informational (summary of the McLeod & Crowe 2018 data). Documents the SLP clinical consensus derived from the data: "many typically developing children still substitute /f/ for /θ/ and /v/ for /ð/ at age 6;11 — therapy is rarely indicated before age 7;0." This is the clinical application of the late-acquisition data: even at age 8, residual /θ/ production difficulty is within the range of normal development for L1 English children. For an L2 learner with no L1 anchor for /θ/, additional difficulty is expected.

**What this means for Marian at 8:** She is right at the developmental window where L1 English children are consolidating /θ/ production. As an L2 English learner with no L1 /θ/ equivalent, she is working against a harder baseline than sh or ch presented. The chip-tap recognition format (Emma says the word → Marian taps the chip) protects against the production difficulty — she does not need to produce /θ/. But perceptual accuracy matters, and the /θ/ → /t/ substitution affects perception too: if Marian's phonological representation maps "thin" to /tɪn/ (as Philippine English speakers commonly produce), she may not immediately separate "thin" (th-chip) from "tin" (t-chip) in the audio signal. This is the key design risk for the th tier.

#### §1b — The Tagalog L1 /θ/ problem: no foothold

**Source 3 — Wikipedia. "Tagalog phonology." https://en.wikipedia.org/wiki/Tagalog_phonology**

Informational (descriptive linguistics). Tagalog's 16-consonant phonological inventory (/p, t, k, ʔ, b, d, g, m, n, ŋ, s, h, l, ɾ, w, j/) contains no fricatives other than /s/ and /h/. There is no dental fricative, no labiodental fricative (/f/), no velar fricative. /θ/ is entirely absent.

This is a harder situation than sh or ch presented. For sh, Marian at least has the acoustic template of a "shushing" sound in everyday use (cross-culturally recognized). For ch, Filipino English loanwords (tsaa, church, cheese, chips) give her partial perceptual access. For /θ/, there is genuinely nothing — no Tagalog phoneme, no common loanword context, no everyday gesture. The /θ/ → /t/ substitution is therefore more reflexive and more persistent than the /ʃ/ → /s/ or /tʃ/ → /ts/ substitutions.

**Source 4 — Agbayani, R. (2022). "Phonological Varieties of Interdental Fricative Voiced and Voiceless 'TH' among Philippine English Lectal Speakers." _Studies in English Language Teaching_, Scholink. https://www.scholink.org/ojs/index.php/selt/article/view/4803**

Moderate evidence (descriptive study of 6 Philippine English speakers across basilectal, mesolectal, and acrolectal registers; peer-reviewed journal). Key finding: basilectal speakers showed the most deviations from General American English norms for both /θ/ and /ð/. Mesolectal speakers "conformed and observed well" for /θ/ in formal read speech but showed more substitutions in spontaneous speech. Even acrolectal speakers showed variation. The voiceless /θ/ "is a feature in read speech but it is inconsistently realized as dental stop /t/ in spontaneous speaking situations" — even for educated Philippine English speakers.

**Application to Marian:** At 8 years old in a home with moderate English use (Tagalog primary), Marian is most likely at a mesolectal or below register for /θ/. The /θ/ → /t/ substitution is the expected default. More importantly, this substitution affects perception as well as production: if her internal phonological representations map "thin" to /tɪn/, Emma's audio saying /θɪn/ may initially register as a /t/ word. The chip-tap format helps because the text chip "thin" visually shows `th` (not `t`), but the audio-graphic mapping must be established through repetition and explicit scaffolding.

**Source 5 — Acquisition of the Inter-Dental Fricatives /θ/ and /ð/ in ESL/EFL and Jamaican Creole: A Comparative Study. _Scientific Research Publishing_. https://www.scirp.org/journal/paperinformation?paperid=42873**

Moderate evidence (comparative study of dental fricative acquisition in L2 English learners from non-/θ/ L1 backgrounds; peer-reviewed journal). Confirms the universal pattern: learners from languages without /θ/ substitute /t/ for /θ/ and /d/ for /ð/ regardless of L1. The substitution is driven by "sounds which share some feature will very often change in the same direction" — /t/ and /θ/ share dental/alveolar place of articulation; /t/ is a stop where /θ/ is a fricative. The study notes that "more exposure to English through formal instruction and contact with native speakers is necessary" for learners to acquire accurate /θ/ pronunciation, and that explicit instruction facilitates acquisition.

**Source 6 — Kernsverlag / Dental fricatives chapter. "Dental fricatives: Patterning, evolution, and factors affecting a rare class of speech sounds." https://kernsverlag.com/wp-content/uploads/2024/01/biocultural-evolution-chapter-7.pdf**

Moderate evidence (chapter in an academic volume on cross-linguistic phonology; not an RCT). Documents the cross-linguistic rarity: dental fricatives occur in approximately 7–10% of the world's languages. The chapter notes that /θ/ has "weak spectral cues, characterized by low-intensity noise and diffuse spectra lacking the concentrated energy of sibilants" — /θ/ is perceptually quieter and harder to distinguish than /ʃ/ or /s/. This is relevant to Marian: Emma's TTS /θɪn/ is a low-energy fricative onset; even with perfect audio quality, the signal is weaker than the /ʃ/ in "ship" or the /tʃ/ in "chin." Explicit scaffolding must compensate for this perceptual weakness.

#### §1c — Comparing th difficulty to sh and ch

The three digraphs in Marian's sequence differ structurally:

| Digraph | L1 (Tagalog) anchor                | McLeod/Crowe 90% age | Expected substitution | Perceptual signal strength                  |
| ------- | ---------------------------------- | -------------------- | --------------------- | ------------------------------------------- |
| sh /ʃ/  | None (but "shh" gesture universal) | 5;0                  | /ʃ/ → /s/             | Strong: sibilant, high-energy fricative     |
| ch /tʃ/ | Marginal (loanword layer)          | 5;0                  | /tʃ/ → /ts/           | Strong: affricate has stop burst + friction |
| th /θ/  | None whatsoever                    | 7;0                  | /θ/ → /t/             | Weak: dental, low-energy, diffuse spectrum  |

th is the hardest of the three on every axis. The sequencing (sh → ch → th) correctly orders them from more accessible to less accessible — but Kyle's design and Emma's script must reflect that th requires more scaffolding than the prior two, not just the same "two letters, one sound" introduction repeated a third time.

#### §1d — Distractor design implications

For sh and ch, the primary distractor risk was cross-digraph confusion (sh-words versus s-words; ch-words versus c-words). For th, the primary distractor risk is th-words versus t-words. Specifically:

- "thin" vs. "tin" — same vowel, same coda consonant; the only difference is th vs. t at onset
- "thick" vs. "tick" — same pattern
- "thud" vs. "tud" (non-word, less useful) or "dud" (different onset entirely)

The /θ/ → /t/ substitution means t-words are the highest-value distractor family for th-initial words. For th-final words, the distractor pattern is reversed: "bath" vs. "bad" or "bat" — the th-coda is distinct from other codas.

Emma's introduction script should name the th-vs-t distinction explicitly: "th says a special sound — not /t/ like in 'top', but /θ/. Watch: put your tongue between your teeth and blow! Th-in. Th-in." This is a different metalinguistic move from ch (which needed to override the c-says-k hypothesis). The th move is: "th is NOT /t/, even though it looks like it starts with t."

---

### §2 — Voiceless vs. voiced th: scope management

#### §2a — This tier is voiceless /θ/ only

The `digraphs-th` tier as designed covers voiceless /θ/ — the sound in _thin_, _thick_, _bath_, _math_, _path_, _moth_ — exclusively. Voiced /ð/ — the sound in _this_, _that_, _the_, _they_, _them_, _then_ — is out of scope for this tier and should not appear in the chip-tap word pool.

This is not an arbitrary restriction; it is grounded in two independent reasons:

1. **The sight words risk:** The highest-frequency voiced /ð/ words in English are function words: _the_, _this_, _that_, _they_, _them_, _then_. These words are not picturable. The chip-tap format requires a picture to anchor the word; function words cannot anchor to a single-subject picture. Even if "the" appeared as a text chip, what picture would Emma show alongside it? There is no answer. Per `digraph-acquisition-marian.md` §Q3, these function words should be treated as sight words (Emma reads them, Marian matches text chip), not as digraph phonics items.

2. **The grapheme ambiguity risk:** Both /θ/ and /ð/ share the `th` grapheme. If voiced /ð/ words appear in the same session as voiceless /θ/ words, Marian encounters two different phonemes under the same grapheme in a single session. She has no visual cue that "thin" and "this" have different phonemes — both start with `th`. Introducing both sounds simultaneously would require her to discriminate two phonemes that share a grapheme based on audio alone, while she is still learning the grapheme-phoneme mapping for the first of them. This is exactly the design risk flagged in `digraph-acquisition-marian.md` §Non-obvious findings, point 5.

**Source 7 — Pennington Publishing Blog. "How to Teach the Voiced and Unvoiced TH." https://blog.penningtonpublishing.com/how-to-teach-the-voiced-and-unvoiced-th/**

Weak evidence (practitioner blog). Confirms the practitioner consensus: teach voiceless /θ/ first, because (a) voiceless /θ/ appears in picturable content words (thin, thick, thank, path, math, bath), while voiced /ð/ dominates function words; (b) the voiceless articulation (tongue between teeth, exhale only) is the easier teaching point — adding voicing later is a simpler extension. The blog does not recommend introducing both simultaneously.

#### §2b — Sight words with th are voiced /ð/ — keep them out of this pool

The most common th-words Marian will encounter in English are: _the, this, that, they, them, then, there, those, these_. Every single one of these is voiced /ð/. None should appear as a th-tier decode target in this pool.

This is critical for Kyle's spec: if Emma's introduction script says "th makes the sound in 'the'" — that is a voiced /ð/ example and directly contradicts the voiceless lesson being taught. Emma's script must use voiceless examples throughout: "th makes the sound in 'thin', 'thick', 'bath'" — not _the_, not _this_, not _that_.

Kyle should include in the word-list spec a clear "DO NOT USE" list: _the, this, that, they, them, then, there, those, these, with, their_ — all voiced /ð/ words that share the `th` grapheme.

**Source 8 — Literacy Learn. "The Two Sounds of TH: Voiced vs. Voiceless." https://literacylearn.com/voiced-th-voiceless-th/**

Moderate evidence (structured-literacy practitioner resource). Confirms: "the voiced /ð/ is in words like _this, that, them, then, thus_ ... the unvoiced /θ/ is in words like _bath, math, cloth, thin, thick, thrill, thrash_." The sorting of common th-words into voiced vs. voiceless categories is well-established in structured literacy; this resource's categorization is consistent with the phonetic literature.

**Special case: "with"**

"With" contains a word-final /ð/ in standard American English pronunciation (voiced), not /θ/. Do not include "with" in the voiceless th pool. Some speakers produce it as voiceless; the Emma TTS (Azure `en-US-EmmaMultilingualNeural`) will produce it as voiced. Exclude.

---

### §3 — Level-appropriate th word inventory

#### §3a — Marian's current phonics level for th tier

Entering the th tier (after sh and ch introduction):

- Short vowels formally covered: a (mastered), o (mastered), u (mastered), i (confident/near-mastery), e (emerging-to-consolidating)
- CVC decoding: emerging; chip-tap recognition format in use
- Digraph concept: established via sh and ch tiers ("two letters, one sound" is no longer new)
- Digraph-word format: practiced (chip-tap recognition for digraph words is familiar)

For the th tier, the question is identical to the ch tier analysis: which /θ/ words require only vowels from Marian's formal instruction?

#### §3b — Word-initial /θ/ with short vowels

**Source 9 — Reading Elephant. "Th Words for Kids in Kindergarten." https://www.readingelephant.com/2018/09/11/th-words-for-kids-in-kindergarten-with-free-book/**

Weak evidence (practitioner resource with structured-literacy grounding). Provides the systematic phonics principle: "In systematic phonics instruction, th can only be used with sound units the child has already learned." The word list for short-vowel th-initial words in kindergarten instruction includes: _thin, thick, thud, thump, thank, thing, think_.

**Source 10 — CVC at Home. "Th Word Lists for Teaching Reading and Spelling." https://www.cvcathome.com.au/how-to-read/th-word-lists-for-teaching-reading-and-spelling/**

Moderate evidence (structured-literacy practitioner resource; Australian phonics curriculum aligned). Short-vowel th-initial words: _thin, thick, thud, thump, thank, think, thing, thong_ (Australian English sense: flip-flop sandal). Extended forms with blends: _three, throw, throb, thrush, thrust_ (all require onset blends: /θr/ cluster — out of scope).

**Source 11 — Home Speech Home. "Voiceless TH Words." https://www.home-speech-home.com/voiceless-th-words.html**

Moderate evidence (comprehensive speech-language pathology practice resource). Word-initial short-vowel /θ/ words: _thin, thick, thud, thump, third, thirst, think, thing_. Word-final /θ/ single-syllable words: _bath, math, path, cloth, moth, broth, fifth, ninth, tenth_.

**The word-initial problem:** Short-vowel th-initial words are sparse and mostly abstract or difficult to picture:

| Word  | Vowel              | Picturable? | Notes                                                                                                                                        |
| ----- | ------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| thin  | short-i (mastered) | Moderate    | Concept of "thin" requires showing a contrast (thin slice vs. thick slice) — not a standalone-object picture; thin as a property, not a noun |
| thick | short-i (mastered) | Moderate    | Same contrast-property problem; however, a thick log or thick book is manageable                                                             |
| thud  | short-u (mastered) | Weak        | An impact event, not an object; could show a cartoon THUD! but abstract                                                                      |
| thump | short-u (mastered) | Weak        | Same — action/sound, not an object; "thump" as a heartbeat is more concrete but culturally specific                                          |
| thank | short-a (mastered) | Very weak   | An action/social script; not picturable as a standalone object                                                                               |

None of the short-vowel th-initial words are strong picture-anchors on their own. _thin_ and _thick_ are property words (adjectives), not nouns. _thud_ and _thump_ are onomatopoeic events. _thank_ is a social script. This is a fundamental difference from the sh pool (ship, shell, shed — all concrete picturable nouns) and the ch pool (chin, chip, chop — all concrete picturable objects or actions). The th-initial short-vowel stock is genuinely weaker on vocabulary-familiarity and picturability grounds.

#### §3c — Word-final /θ/ with short vowels

Word-final /θ/ words are structurally stronger for this pool than word-initial words. The pattern is CVTh (short vowel + final /θ/ digraph): bath, math, path, moth, cloth.

**Source 12 — Literacy Learn. "The Two Sounds of TH: Voiced vs. Voiceless." (same as Source 8)**

Confirms: "unvoiced /θ/ at word end: bath, math, path, cloth, teeth, tooth." The short-vowel examples are: bath (short-a), math (short-a), path (short-a), cloth (short-o), moth (short-o). All within Marian's formal vowel instruction.

**Per-word analysis of th-final candidates:**

| Word  | Vowel              | Pattern | Picturable?                                                                                     | Vocab familiarity for Marian                                                                                              |
| ----- | ------------------ | ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| bath  | short-a (mastered) | CVTh    | High — a bathtub is a single, unambiguous object                                                | Very high — "bath" is universal; Tagalog equivalent is "paligo" but the bathtub picture grounds "bath" immediately        |
| math  | short-a (mastered) | CVTh    | Moderate — a chalkboard with numbers, or numerals + a book; abstract but conventionalized       | High — "math" is used in Filipino educational settings; "matematika" is the Tagalog cognate; strong cross-language anchor |
| path  | short-a (mastered) | CVTh    | Moderate — a dirt path or stepping stones; picturable but scene-based rather than single-object | Moderate — "path" is familiar conceptually; the Filipino word is "landas/daan"; picture must show a clear path not "road" |
| moth  | short-o (mastered) | CVTh    | High — a moth silhouette is distinctive and unambiguous                                         | Moderate — Tagalog "mariposa" covers butterflies; "moth" may need to be distinguished from "butterfly" visually           |
| cloth | short-o (mastered) | CVCCTh  | Moderate — a piece of fabric; single-object, but "cloth" reads easily as "fabric" or "material" | Moderate — "tela" is the Tagalog word for fabric/cloth; the English label may be less certain                             |
| broth | short-o (mastered) | CCVTh   | Moderate — a bowl of soup broth; single-object, but culturally specific bowl-of-liquid          | Low-moderate — "sabaw" is Tagalog; "broth" as a label (vs. "soup") may be uncertain for Marian                            |

**Note on "broth":** Onset cluster /br/ is a consonant blend outside CVC scope. Avoid.

**Note on "cloth":** CCVCC phonological shape (Cl-o-thCC is actually CVCCTh in the sense of /klɒθ/ — onset /kl/ blend). The onset is /kl/, a cluster. Avoid — the blend adds complexity beyond the digraph lesson.

Wait — let me re-examine. `cloth` is spelled c-l-o-t-h. The onset is the /kl/ cluster, the vowel is short-o, and the coda is /θ/. The onset cluster /kl/ makes it a blend word, not a CVC. This is out of scope for a CVC-level learner. Cloth should be treated as a hybridMode candidate (word-whole recognition, not decode) if included at all, or dropped.

**Revised th-final word table:**

| Word  | Onset structure | Coda     | Decodable? | Recommendation         |
| ----- | --------------- | -------- | ---------- | ---------------------- |
| bath  | /b/ (single)    | /θ/ (th) | Yes        | Include — primary pick |
| math  | /m/ (single)    | /θ/ (th) | Yes        | Include — primary pick |
| path  | /p/ (single)    | /θ/ (th) | Yes        | Include — primary pick |
| moth  | /m/ (single)    | /θ/ (th) | Yes        | Include — primary pick |
| cloth | /kl/ (blend)    | /θ/ (th) | No         | HybridMode or drop     |
| broth | /br/ (blend)    | /θ/ (th) | No         | Drop                   |

**Source 13 — ESL Vault. "Free voiceless TH words list and pictures." https://eslvault.com/voiceless-th-words/**

Weak evidence (ESL practitioner resource). Organizes voiceless /θ/ words by position; confirms the pattern that the most learner-accessible short-vowel th words in word-final position are bath, math, path, moth. These four are the strongest candidates.

#### §3d — Recommended target-word set (~7 words)

Given the word-initial stock weakness and the word-final stock strength, the recommended pool is weighted toward word-final /θ/, supplemented by the two strongest word-initial candidates:

**Primary recommendation: thin, thick, bath, math, path, moth, cloth**

Rationale per word:

| Word  | Vowel              | Pattern          | Position | Rationale                                                                                                                                                                                                                                                                        |
| ----- | ------------------ | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| thin  | short-i (mastered) | CVTh             | initial  | Best word-initial th pick: property word, but "thin" is highly picturable as a contrast picture (thin person or thin slice of bread vs. thick) and vocabulary is universal; forms the /θɪn/ vs. /tɪn/ discrimination anchor                                                      |
| thick | short-i (mastered) | CVCCTh (Th-i-ck) | initial  | Wait — "thick" ends in /ɪk/, not /θ/. The digraph th is at the ONSET, not coda. Pattern is: Th (digraph onset) + i (short-i) + ck (final digraph). This is a th-initial word with a ck coda — it is fully decodable given that Marian has not formally covered -ck yet. See §4b. |
| bath  | short-a (mastered) | baTh             | final    | Highest-familiarity th word in the pool; bath/bathtub is universally picturable; unambiguous single object                                                                                                                                                                       |
| math  | short-a (mastered) | maTh             | final    | Strong cross-language anchor (matematika); math-as-chalkboard or math-as-numerals picture is clear                                                                                                                                                                               |
| path  | short-a (mastered) | paTh             | final    | Concrete noun; stepping-stone or dirt-path picture must be tight (see §4d)                                                                                                                                                                                                       |
| moth  | short-o (mastered) | moTh             | final    | Clear animal silhouette; must be visually distinguished from butterfly (moth = brown/grey, antenna-no-club; butterfly = colorful, club-tipped antenna)                                                                                                                           |
| cloth | short-o (mastered) | ONSET BLEND      | final    | Onset /kl/ blend makes this non-decodable at CVC level. Recommend hybridMode or replacement with `broth` (also a blend) — see §3e for the resolution.                                                                                                                            |

**Thick reconsidered:** `thick` is spelled t-h-i-c-k. The `th` is the onset digraph (voiceless /θ/); `i` is short-i; `ck` is the word-final digraph /k/. So `thick` requires TWO digraphs: `th` (this tier's target) AND `ck` (a separate digraph lesson not yet formally taught). This is analogous to including a long-vowel sh-word in the sh tier — it adds a second new element alongside the target. In the chip-tap recognition format, the child does not need to decode `ck` — she hears Emma say "thick" and taps the chip. So the `ck` coda is not a decoding burden; it is a visual element she pattern-matches without segmenting. But unlike the sh-tier's hybrid words (where the long vowel was the extra element, compensated by vocabulary familiarity), `ck` is a new grapheme sequence Marian has not been formally taught. Recommend treating `thick` as a hybridMode candidate (recognition-only, never a decode or spell target) or replacing with a simpler alternative.

**The cloth problem resolved:** `cloth` (/klɒθ/) has an onset blend /kl/ that exceeds CVC scope. The word-final th pattern is pedagogically correct, but the onset complicates decoding. Same hybridMode treatment as `thick` applies. In the recognition format, Marian hears "cloth" and sees the chip — she does not need to decode /kl/ — so picture-anchor quality is the key criterion. A square of fabric is a picturable single object. Recommend including as hybridMode if the picture is clear; drop if it reads as "fabric" or "blanket" rather than "cloth."

#### §3e — HybridMode candidates for th

Unlike the ch tier (zero hybridMode words), the th tier produces two hybridMode candidates:

| Word  | Reason for hybridMode                                        | Recommendation                                                                   |
| ----- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| thick | Double-digraph: th-onset (target) + ck-coda (not yet taught) | HybridMode if included; planner must not generate decode or spell prompts for it |
| cloth | Blend onset: /kl/ onset exceeds CVC scope                    | HybridMode if included; same restriction                                         |

If both `thick` and `cloth` are excluded to keep the pool fully decodable, the pool narrows to 5 clean words: thin, bath, math, path, moth. That is below the 7-word target. Alternatives to fill to 7 without hybridMode:

- **thud** (short-u, CVC, th-initial): picturable as a cartoon impact but abstract; use if a visual can convey the concept (falling block, a bump)
- **broth** (short-o, th-final): onset /br/ blend — same hybridMode issue as cloth; skip
- **Beth** (short-e, th-final): a proper name (person); not picturable as a standalone object concept; skip
- **tenth** (short-e, th-final): the nt cluster before th makes this complex; skip

**Conclusion:** The most defensible pool of 7 includes `thick` and `cloth` as hybridMode entries. The alternative — a fully decodable pool of 5 — is too thin. Treat `thick` and `cloth` as "recognition-only, Emma-audio-first, never decode" in the planner, exactly as the sh-tier treated `shoe`, `sheep`, and `shark`.

#### §3f — Recommended final pool of 7

**thin, bath, math, path, moth, thick, cloth**

| Word  | HybridMode | Rationale summary                                                                                                 |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| thin  | No         | short-i, CVTh, th-initial, fully decodable; best word-initial th entry; picturable via contrast image             |
| bath  | No         | short-a, CVTh, th-final, fully decodable; highest familiarity; unambiguous picture                                |
| math  | No         | short-a, CVTh, th-final, fully decodable; cross-language anchor (matematika); strong picture convention           |
| path  | No         | short-a, CVTh, th-final, fully decodable; concrete noun; picture must be tight (stepping-stone path, not "road")  |
| moth  | No         | short-o, CVTh, th-final, fully decodable; clear animal silhouette; distinguish from butterfly visually            |
| thick | Yes        | short-i, CVCCTh (th + ck double-digraph); recognition-only; Emma-audio-anchored; planner: no decode/spell prompts |
| cloth | Yes        | short-o, blend onset /kl/; recognition-only; Emma-audio-anchored; planner: no decode/spell prompts                |

**This pool differs from sh and ch in one important structural way:** 5 of 7 words are word-final /θ/. This is intentional and correct, not a gap. The word-final /θ/ stock is richer and more picturable than the word-initial stock for Marian's current vowel inventory. Kyle's spec should introduce th-initial words first (thin, thick) in the first session — "th at the beginning of the word" — then transition to th-final words (bath, math, path, moth, cloth) as the primary pool for subsequent sessions. The pedagogical sequence is initial → final, even though the pool is weighted final.

---

### §4 — Words and patterns to avoid

#### §4a — Voiced /ð/ words (rule: exclude all)

Never include: _the, this, that, they, them, then, there, those, these, their, with_

These are all voiced /ð/, share the `th` grapheme, and are either function words (unpicturable) or confound the voiceless /θ/ lesson Marian is learning. The voiced/voiceless distinction is invisible in the grapheme. "With" is often mispronounced as voiceless by some speakers, but Emma's TTS voice will produce it with the standard voiced /ð/.

#### §4b — Double-digraph words (unless hybridMode)

Avoid in the fully-decodable pool: _thick_ (th + ck) unless hybridMode flagged. Other potential ck-final th-initial words: none at short-vowel level. This category is small but real.

#### §4c — Blend-onset th words (unless hybridMode)

Avoid in the fully-decodable pool: _three, throw, thread, throne, throb, thrash, thrust_ — all require /θr/ onset cluster (a consonant blend beyond CVC scope). These are also the most common mental images people associate with "th" words, so Kyle and MJ should be steered away from them explicitly.

Avoid: _cloth, broth_ — onset clusters make them non-decodable. Include `cloth` as hybridMode if picture quality warrants; drop `broth`.

#### §4d — Long-vowel th words

Avoid: _three_ (long-e + /θr/ blend — double out-of-scope), _think_ (short-i, but /ŋk/ cluster coda — beyond scope), _theme_ (long-e), _truth_ (long-u + /θr/ blend), _teeth_ (long-e), _tooth_ (long-oo), _both_ (long-o — this is actually a long-o word in standard English, not short-o; the vowel in "both" is the diphthong /oʊ/), _beneath_ (two syllables + long-e), _youth_ (long-oo).

**Special note on "both":** The word "both" looks like a short-vowel th-final word but is not — the vowel is the long /oʊ/ diphthong, not short-o. Do not include in the pool. Marian has not been formally taught long-o patterns.

#### §4e — Abstract or unpicturable th words

Avoid: _thank, think, thing_ — these are too abstract or conceptually complex for a standalone picture chip.

- _thank_ = a social script (shaking hands, saying thanks); the picture easily reads as "friends" or "greeting," not "thank"
- _think_ = an invisible mental action; standard icons (thought bubble) are culturally encoded but not universally mapped to "think" by an 8-year-old
- _thing_ = deliberately vague; no stable referent

These three are the words most commonly listed in th-word resources for young learners (they appear in virtually every kindergarten th-word list), but they all fail the picturability test that the chip-tap format requires. They would need hybridMode treatment with a contextual scene, and even then the word-picture match is loose.

---

### §5 — Sequencing rationale: why th follows ch

#### §5a — What sh and ch mastery established going into th

The th tier arrives third, and it inherits three layers of scaffolding from the prior two:

1. **The two-letters-one-sound concept is fully established.** Marian has now practiced it for sh (15+ words' worth of exposure) and ch (7 words' worth). The concept is not new for th — Emma does not need to teach it from scratch. She can say "You know how sh makes one sound and ch makes one sound? th is the same — two letters, one special sound!"

2. **The chip-tap format for digraph words is fully familiar.** No format novelty; Marian has practiced the digraph chip-tap interaction across two full tiers.

3. **A prior-digraph distractor set is available.** For th-initial words, the most useful distractors are t-words (tin, tap, top) — regular CVC words Marian already knows. The sh-pool (ship, shop) and ch-pool (chip, chop) are available as secondary distractors to test cross-digraph discrimination when th is consolidating. The th/t discrimination is the primary distractor axis for th, not sh/ch.

#### §5b — The /θ/ articulation scaffold requires more than TTS alone

For sh, Emma saying "shhhh" via TTS was sufficient for Marian to extract the phoneme — the /ʃ/ is acoustically salient (sibilant, high-energy) and the "finger on lips" gesture provides a kinesthetic anchor without needing to see a mouth. For ch, the stop-burst release in /tʃ/ is perceptually prominent; the "can you hold the sound?" test gives a self-accessible discriminator.

For /θ/, neither acoustic salience nor a simple physical test is available without explicit instruction. The dental fricative is low-energy and spectrally diffuse. Emma's audio alone may not create a reliable /θ/ percept for Marian whose phonological representation defaults to /t/. Per `digraph-acquisition-marian.md` §For Kyle recommendation 2, "a brief visual cue (emoji or illustration of a mouth with tongue at teeth) alongside Emma's voice is warranted."

This is the highest-design-effort digraph precisely because it requires the most articulation scaffolding. Kyle's spec should include a mandatory Emma introduction component that pairs TTS audio with a mouth-at-teeth visual. The visual does not need to be animated (a single static illustration of a mouth with the tongue tip between the teeth is enough); it needs to appear simultaneously with Emma saying "th."

#### §5c — Why th must come after ch is consolidated, not just introduced

Per `digraph-acquisition-marian.md` §Q6, the recommendation is: begin mixing sh and ch once both are at ~70%+ accuracy, then introduce th. This matters for the th tier specifically:

- If th is introduced while ch is still shaky, Marian is managing three simultaneously unconsolidated digraph concepts
- The ch/sh discrimination (chip/ship, chop/shop) is valuable scaffolding only once ch has had its introduction arc
- The th-vs-t discrimination is the primary learning task for th; it is cleanest if sh and ch are already distinct in Marian's phonological representations

**The dispatch timing recommendation:** th introduction should not begin until ch is in the "practicing → consolidating" band, not just "intro." The planner's session-composition decision should gate th-introduction sessions on ch reaching at least 2–3 successful sessions above 70% accuracy, not just on ch being formally opened as a tier.

---

## Application to Marian

As of the th-tier launch (post-sh and post-ch introduction):

- Short vowels a/o/u/i are mastered or near-mastered; short-e is consolidating
- She has worked through 7 sh-tier words and 7 ch-tier words; the digraph chip-tap format is well-practiced
- She has the sh/ch minimal-pair anchors (chip/ship, chop/shop) as discrimination reference points
- Her Tagalog L1 gives her **no** perceptual scaffolding for /θ/ — this is the blank-slate condition, harder than sh and significantly harder than ch
- The /θ/ → /t/ substitution is expected in her internal phonological representations, affecting both production (irrelevant in chip-tap) and perception (relevant)
- Emma's TTS /θ/ may initially register as a /t/ for Marian — the mouth-at-teeth visual scaffold is not optional; it is a developmental necessity for this specific learner and this specific phoneme
- The pool of 7 (thin, bath, math, path, moth, thick, cloth) uses only vowels within her formal instruction. The two hybridMode words (thick, cloth) are manageable in recognition-only format; neither presents a vocabulary familiarity problem

The th tier should be positioned as "the special-sound lesson" — Emma's introduction framing "this sound is different from everything you've learned before, because your tongue goes between your teeth" — to mark it as genuinely novel in a way that sh and ch were not (for sh, the "shhh" gesture was familiar; for ch, Filipino English gave partial access; for th, there is nothing to reach back to).

---

## Risks / counter-evidence

### 1. Word-initial th pool is genuinely sparse — is 2 initial-position words (thin, thick) enough?

The pool is heavily weighted to word-final /θ/ (5 of 7 words). For the other digraph tiers, both initial and final positions were represented more evenly. The concern is that introducing "th" primarily through word-final examples may delay Marian's recognition of th in word-initial position — which matters for future reading of words like _think_, _three_, _there_.

Counter: in the chip-tap recognition format, position is not the primary variable — the consistent th grapheme is. What matters is that Marian associates `th` with /θ/ regardless of position. Two word-initial examples (thin, thick) plus five word-final examples is sufficient to establish that association. The position imbalance is a word-stock constraint, not a pedagogical choice against initial-position exposure.

If the pool is later extended (after the 7-word introduction arc), word-initial targets are the natural extension: _thud_ (if a visual can convey it), _thumb_ (note below), _throb_ (blend — avoid), _thought_ (diphthong — avoid).

**Note on "thumb":** `thumb` (/θʌm/) is short-u, th-initial, and highly picturable (a hand with the thumb raised). However, `thumb` contains a silent `b` at the end — the coda is just /m/, and the `b` is not pronounced. Introducing a word with a silent letter simultaneously with a new digraph violates the one-new-element-per-session principle. `thumb` should be deferred to a later session or introduced as hybridMode once the pool is established.

### 2. The /θ/ → /t/ perceptual risk in the chip-tap format

If Marian maps Emma's "thin" to /tɪn/ internally, she may associate the text chip "thin" with a /t/ onset — which could create confusion when she later encounters the word "tin" (no `th`). This is the reverse of the typical digraph-learning concern (child decodes `th` as /t/ when reading) — here the risk is that she encodes `th` as equivalent to `t` from the auditory exposure alone.

The mitigation is the same as the design response: Emma's TTS should be paired with the mouth-at-teeth visual, and early th sessions should include /t/-initial CVC words as distractors (so Marian hears Emma say "thin" and must distinguish the th-chip from the t-chip "tin"). This discrimination exposure, not just recognition exposure, is what builds the /θ/ vs. /t/ perceptual boundary.

### 3. HybridMode for two words is higher than ch (zero) but lower than sh (three)

The ch tier was celebrated as having zero hybridMode words. The th tier has two (thick, cloth). This is worse than ch on the "clean pool" metric, but better than sh. The reason is structural: the th short-vowel word stock is smaller and the onset-blend issue (cloth, broth) is unavoidable. The alternative — a fully decodable pool of only 5 words — is too thin for the 3–5 introduction sessions needed.

Matt should be aware that the th planner ticket will need the same hybridMode annotation work that the sh tier required for shoe/sheep/shark. The annotation is simpler (no new schema additions needed if sh's hybridMode field already exists), but the planner guard logic must be applied to thick and cloth.

### 4. No direct research on Tagalog-speaking 8-year-olds learning /θ/ in an app context

The evidence base for this section draws on: (a) cross-linguistic phonological typology for /θ/ rarity, (b) Philippine English descriptive studies of /θ/ production patterns, (c) general L2 dental fricative acquisition research (multiple languages; not specifically Tagalog). There is no published study of Tagalog-speaking 8-year-olds learning /θ/ in a tablet-based phonics app. The design recommendations are evidence-grounded inferences, not directly replicated findings from Marian's specific profile. Thomas's observation of how Marian responds to the th tier should be the primary calibration signal — if the /θ/ → /t/ perceptual confusion turns out to be less of a barrier than expected (or more), the planner's th-tier difficulty weighting should adjust accordingly.

### 5. "Thin" as an adjective — property words in chip-tap format

`thin` is an adjective, not a noun. Chip-tap requires a picture-anchored word. Most chip-tap words in Marian's pool so far have been nouns (ship, shell, chin, chip, bath, moth). Adjectives require a different picture strategy: show an object that exemplifies the property (a thin pencil, a thin slice of bread). The risk is that the picture reads as the object ("pencil," "bread") rather than the property ("thin").

Mitigation: Kyle's picture brief for `thin` should use a before/after or contrast composition — "thin" on one side (a thin line or thin person silhouette), "thick" on the other — with a clear visual indicator (arrow, label) pointing to the "thin" side. This is a slightly more complex picture brief than a single-object noun chip. Kyle should flag this in the word-list spec as requiring a contrast-pair picture, not a single-object picture.

---

## Recommendations

### For Matt (ticket scope and priority)

1. **Dispatch Kyle's th word-list spec after ch consolidates.** The th tier should not be specced as a parallel-to-ch track — it should be dispatched when ch is in the "practicing → consolidating" band. The word-list work can proceed now; the content-tier build ticket should be gated on ch reaching practicing-level mastery in the planner.

2. **Two hybridMode words required for the th pool.** Unlike ch (zero hybridMode), the th pool needs `thick` and `cloth` annotated as recognition-only, never decode/spell. Kevin's canon-bake ticket for th must apply the same hybridMode planner guard logic that the sh tier established for shoe/sheep/shark. The schema field already exists; no new infrastructure required — just two more entries in the annotation table.

3. **th-vs-t discrimination is the primary distractor design concern.** The most diagnostically useful distractor for a th-initial target (thin, thick) is a t-initial CVC word (tin, tip, tick, top). Kyle's word-list spec should include a distractor annotation that flags t-initial CVC words as high-priority distractors for th-initial targets, and th-final words that rhyme (bath/bad/bat, math/mat, path/pat, moth/mop) as high-priority distractors for th-final targets.

4. **Mouth-at-teeth visual is required for Emma's th introduction — this is not optional.** Per the developmental evidence (§1a, §1b), the /θ/ phoneme has no L1 anchor for Marian, no perceptual salience advantage, and the /θ/ → /t/ substitution is the strongest L2 substitution pattern documented for Philippine English speakers. TTS alone will not create a reliable /θ/ percept. This is a design requirement, not an enhancement: include a mouth illustration in Emma's th opener. Kyle's spec must budget for this element.

5. **Thumb is the best pool-expansion word if 7 words prove too thin.** For any future extension beyond 7, `thumb` (short-u, th-initial, picturable, high-familiarity) is the strongest candidate — but it must be introduced after the silent `b` issue is handled (either explicitly named or ignored in a recognition-only context where the coda is irrelevant). Do not include it in the opening 7.

6. **Do not include any voiced /ð/ word anywhere in the th-tier pool.** The "DO NOT USE" list: _the, this, that, they, them, then, there, those, these, their, with, both._ Kyle's spec header should list these explicitly.

### For Kyle (design and spec changes)

1. **Emma's th introduction must include three distinct elements that sh and ch did not require:**
   - The "NOT /t/" disambiguation: "th says a special new sound — not /t/ like in 'top' — th! Listen to how my tongue touches my teeth."
   - A mouth-at-teeth visual: a static or minimally animated illustration of a mouth with the tongue tip between the upper and lower teeth. This must appear simultaneously with Emma's audio saying "th."
   - The voiceless vs. voiced disambiguation (one line only, not a full lesson): "th in 'thin' and 'bath' is a breath sound — no voice. Some 'th' words are different (like 'the'), but we'll learn those later."

2. **Pool introduction order — initial before final, even though pool is weighted final:**
   - Session 1 of th: introduce thin and thick (th-initial); review ch and sh words
   - Sessions 2–4: introduce bath, math, path, moth; cycle in thin and thick for review
   - Sessions 5+: cloth introduced; full pool rotation in review

3. **Picture briefs — th tier has specific challenges:**
   - `thin` — contrast picture: thin pencil/slice on one side, thick on the other; arrow pointing to "thin" side. NOT a single-object photo.
   - `thick` — contrast picture: same contrast pair approach, pointing to "thick" side. hybridMode: planner never asks Marian to decode `thick`, only recognize it.
   - `bath` — bathtub, single object, unambiguous. No child in bath (avoid parental concern with child image). The tub alone is sufficient.
   - `math` — chalkboard or notebook with numerals (1+2=3 type). Single framing, not a child doing math.
   - `path` — stepping-stone path or dirt trail; must clearly read as "path" not "road" or "trail." Avoid scenes with trees or houses that compete for the label.
   - `moth` — brown/grey moth silhouette from front, wings spread; must be visually distinguished from butterfly. The key visual differences: moth = feathery/un-clubbed antennae, muted color, wings flat when resting. Include if MJ can reliably produce a moth-not-butterfly image.
   - `cloth` — a square piece of fabric with visible texture; single object on a clean background. hybridMode: recognition-only.

4. **Pool delivered as 5 fully decodable + 2 hybridMode.** This differs from the ch tier (7 fully decodable, 0 hybridMode) and resembles the sh tier's structure. Kyle's `digraphs-th-word-list.md` spec should document the 2 hybridMode words and the reason (onset blend / double-digraph), so Kevin's impl ticket applies the hybridMode planner guard correctly.

5. **Distractor annotation in the spec:**
   - For th-initial targets: primary distractors = t-initial CVC words (tin, tip, top, tap) from Marian's mastered pool
   - For th-final targets: primary distractors = same-vowel words without final-th (bat/bad for bath/math/path; mop/mob for moth; clop for cloth)
   - Cross-digraph distractors (sh-pool or ch-pool words) are appropriate only in the interleaving phase (after th is consolidating alongside sh/ch review), not in initial th-introduction sessions

---

## Non-obvious findings

1. **The word-final /θ/ pool is pedagogically stronger than the word-initial pool for this learner at this level.** This is counterintuitive — most phonics resources introduce digraphs primarily in word-initial position (because left-to-right decoding makes the onset the first encounter). For th specifically, the short-vowel word-initial stock (thin, thick, thud, thump, thank) is almost entirely property words and event words (not nouns) — weak for picture-anchoring. The word-final stock (bath, math, path, moth) is almost entirely picturable nouns with strong vocabulary familiarity. Kyle's spec should note explicitly that the th pool's positional asymmetry (5 final, 2 initial) is deliberate and evidence-driven, not an oversight.

2. **"Both" looks like a short-vowel th-final word but is a long vowel.** The word "both" (/boʊθ/) is frequently listed in th-word lists alongside bath/math/moth, but its vowel is the long /oʊ/ diphthong. Including it in a short-vowel pool would introduce a long vowel Marian has not formally been taught. Kyle's spec should include "both" in the DO NOT USE list for the same reason that "shoe" and "sheep" were hybridMode in the sh tier — except "both" is more confusing because there is no picture that unambiguously depicts "both" as opposed to "two." Drop entirely.

3. **The /θ/ → /t/ distractor pairing is the highest-value diagnostic signal in the th tier.** For sh, the most diagnostic error was sh-initial targets confused with s-initial distractors (ship/sip). For ch, it was ch-initial targets confused with sh-initial distractors (chip/ship) in the interleaving phase. For th, it is th-initial targets confused with t-initial distractors (thin/tin, thick/tick). If Marian consistently selects the t-chip over the th-chip when Emma says "thin," that is direct evidence that her phonological representation for "thin" is /tɪn/. This is the most informative error signal the planner could capture — and it is available only if t-initial CVC distractors are deliberately included in th sessions. Kyle's word-list spec should annotate this explicitly; the planner ticket should ensure t-initial distractors are in the generation pool for th-initial targets.

4. **`thumb` is deferred but should be documented as the natural pool-extension word.** `thumb` (short-u, th-initial, highly picturable as a raised thumb, very high vocabulary familiarity) is the strongest candidate for extending the th pool beyond 7. Its only complication is the silent `b`. In a recognition-only chip-tap format, the silent `b` is invisible in the audio — Emma says /θʌm/ and Marian taps "thumb" — so the silent `b` is actually less of a complication than it would be in a spelling lesson. Kyle's spec should note `thumb` as the first expansion word when the planner determines the th pool needs more variety. Document as pool-extension, not a primary pick, due to the silent-letter complication that will matter in future decode or spell tasks.

5. **The th tier has the inverse hybridMode profile to sh.** The sh tier's hybridMode words were all word-initial (shoe, sheep, shark — all th-initial position, long-vowel onsets after the digraph). The th tier's hybridMode words are structurally different: they are not long-vowel issues but onset-blend and double-digraph issues (cloth = /kl/ onset; thick = /θ/ + /k/ via `ck`). The planner guard logic for hybridMode in the th tier is the same as sh (no decode/spell prompts for hybridMode words), but the reason is different. Whoever authors the canon-bake ticket should note this distinction so the hybridMode annotation is understood correctly.

6. **Implication for the planner's 3-place sync contract.** `digraphs-th-voiceless` needs the same three-place update that `digraphs-sh` and `digraphs-ch` require: (1) `WORD_SONG_FIRST_CLASS_FOCUS_NODES` in `api/_planner.ts`, (2) `WORD_SONG_FOCUS_NODES` in `scripts/generateSessionCanon.ts`, and (3) the combo-count assertion in `scripts/generateSessionCanon.test.ts`. Additionally, the full 16-place SkillNode widening contract in `sibling-tier-checklist.md` applies. The SkillNode split for `digraphs-th-voiceless` (as a sibling to `digraphs-sh` and `digraphs-ch`) may already be in the codebase if PR #211 added all three sibling nodes in the split. Verify before dispatching a redundant infrastructure PR.

---

## Sources index

| #     | Citation                                                                                                                      | Strength                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | McLeod & Crowe (2018) — Children's Consonant Acquisition in 27 Languages. AJSLP, ASHA.                                        | Strong (systematic review, 27 languages, 26,007 children)       |
| 2     | ConductScience — Speech Sound Development Chart (McLeod & Crowe 2018 summary)                                                 | Informational (secondary summary of #1)                         |
| 3     | Wikipedia — Tagalog phonology; consonant inventory                                                                            | Informational (descriptive linguistics)                         |
| 4     | Agbayani (2022) — Phonological Varieties of Interdental Fricative TH among Philippine English Lectal Speakers. Scholink/SELT. | Moderate (descriptive study, peer-reviewed)                     |
| 5     | SCIRP — Acquisition of Inter-Dental Fricatives /θ/ and /ð/ in ESL/EFL and Jamaican Creole.                                    | Moderate (comparative study, peer-reviewed)                     |
| 6     | Kernsverlag — Dental fricatives: Patterning, evolution, and factors (chapter).                                                | Moderate (academic volume chapter)                              |
| 7     | Pennington Publishing Blog — How to Teach the Voiced and Unvoiced TH.                                                         | Weak (practitioner blog)                                        |
| 8     | Literacy Learn — The Two Sounds of TH: Voiced vs. Voiceless.                                                                  | Moderate (structured-literacy practitioner resource)            |
| 9     | Reading Elephant — Th Words for Kids in Kindergarten.                                                                         | Weak (practitioner resource with structured-literacy alignment) |
| 10    | CVC at Home — Th Word Lists for Teaching Reading and Spelling.                                                                | Moderate (curriculum-aligned practitioner resource)             |
| 11    | Home Speech Home — Voiceless TH Words (250+).                                                                                 | Moderate (SLP practice resource)                                |
| 12    | Literacy Learn — The Two Sounds of TH (same as Source 8); th-final word categorization.                                       | Moderate                                                        |
| 13    | ESL Vault — Free voiceless TH words list and pictures.                                                                        | Weak (ESL practitioner resource)                                |
| Prior | digraph-acquisition-marian.md (internal, 2026-05-14) — sh/ch/th sequencing rationale, §Q2, §Q3, §Q6                           | Internal                                                        |
| Prior | digraph-ch-addendum.md (internal, 2026-05-14) — ch pool analysis; hybridMode template; structural precedent                   | Internal                                                        |
| Prior | digraph-sh-long-vowel-addendum.md (internal, 2026-05-14) — hybridMode scaffold rationale                                      | Internal                                                        |
| Prior | phonics-sequence-marian.md (internal, 2026-04-26) — session pacing, vowel mastery levels, pool-size constraints               | Internal                                                        |
| Prior | sibling-tier-checklist.md (internal, 2026-05-14) — 16-place widening contract for new sibling tiers                           | Internal                                                        |
