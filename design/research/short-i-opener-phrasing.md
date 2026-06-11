# Short-/ɪ/ First-Encounter Opener: Phrasing and SSML Annotation

**Date:** 2026-05-10
**Context:** Ticket `86c9qdp1q` (Kevin) — lifetime-first-encounter gate + opener line for `cvc-words-short-i`, mirroring the PR #174 `/ks/` pattern. This note pins the recommended line text, SSML phoneme markup, anchor word choice, and 2 alternatives with trade-off rationale.

---

## Question

What exact line should Emma speak on Marian's very first `cvc-words-short-i` session, and does the Azure `en-US-EmmaMultilingualNeural` voice need SSML phoneme overrides to render it correctly?

---

## Bottom line

**Primary recommendation:**

> "Listen — short i says _ih_. Not 'ee' — just _ih_. Like pig: /p/-/ɪ/-/g/."

- ~10 seconds spoken at -10% rate. 19 words; well inside the 25-word ceiling.
- Contrast target is long /iː/ (the "ee" Marian already knows from Filipino-school English and CVC-tier ambient exposure), not a Tagalog category — her Tagalog /i/ IS /iː/, so the contrast is functionally the same.
- Anchor word: `pig` (most familiar from the picture pack, easiest CVC frame for Marian).
- SSML required: wrap the isolated `ih` tokens and the IPA breakdown to prevent Emma from reading "ih" as a filler syllable or rendering /ɪ/ as /iː/.

---

## SSML annotation (primary recommendation)

```xml
Listen — short i says
<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>.
Not <phoneme alphabet="ipa" ph="iː">ee</phoneme> —
just <phoneme alphabet="ipa" ph="ɪ">ih</phoneme>.
Like pig:
<phoneme alphabet="ipa" ph="p">p</phoneme>-<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>-<phoneme alphabet="ipa" ph="ɡ">g</phoneme>.
```

**Why each override:**

- `ih` (isolated, twice) — without markup, Emma may read "ih" as a hesitation schwa (/ə/) or conflate it with /iː/ (the neural prosody predictor has no sentence context to anchor the short vowel). The IPA tag `/ɪ/` forces the lax high-front quality.
- `ee` (the contrast target) — Emma should produce a clean, slightly lengthened /iː/ here so the quality contrast is audible. Without the tag, the word "ee" may be read as a letter-name or produce unpredictable stress. Explicit `/iː/` is safer.
- The phoneme breakdown `/p/-/ɪ/-/g/` — isolated letter tokens risk unstressed schwa insertion (`/pə/-/ɪ/-/gə/`). Wrapping each with its IPA value forces clear consonant + vowel quality.

**Azure IPA support confirmation:** The Azure SSML phonetic sets documentation confirms `/ɪ/` is supported for `en-US` voices (SAPI: `ih`, VisemeID: 6, example words: "if," "fill"). The `<phoneme alphabet="ipa" ph="ɪ">` element is the correct wrapper form. Source: [Microsoft Learn — SSML Phonetic Sets](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets).

**Caveat inherited from project pattern (`project_audio_phoneme_overrides.md`):** Defensive wrapping of words the voice handles correctly can degrade prosody. The `ee` and isolated `ih` tokens are genuinely ambiguous without context — these overrides are non-defensive. The phoneme breakdown is borrowed from the PR #174 `/ks/` pattern, which confirmed the Azure phoneme element works for segmental breakdowns.

---

## Anchor word: `pig`

`pig` is the right anchor. Rationale:

1. It is the first word in the ship pool and the most picture-supported (Midjourney pack already produced the pig asset — Marian will have seen it if any session preview occurred).
2. /p/ and /g/ are both stops present in Tagalog with near-identical place-of-articulation; the consonant frame is maximally familiar, so the vowel is the only new element to attend to.
3. `/p/-/ɪ/-/g/` has no minimal-pair hazard: the closest alternative reading is "pee-g" (not a word) or "pug" (not in pool) — neither will confuse.
4. Short practitioner consensus note: SpeechBlubs (2024) warns that medial-vowel words like `pig` are harder for phoneme isolation than word-initial vowel words — but this is a first-encounter opener, not an isolation exercise. Emma is modeling the breakdown, not asking Marian to produce it. Medial-position `pig` is fine for modeling.

---

## Alternatives

### Option B — Minimal (no phoneme breakdown)

> "Listen — short i says _ih_, not _ee_. Like pig — listen: pig."

~8 seconds. 13 words.

**Trade-off:** Drops the `/p/-/ɪ/-/g/` segmental breakdown. Appropriate if Kevin determines the SSML phoneme breakdown sequence causes prosody artifacts in the baked audio (test-listen at canon-bake time). The contrast is preserved; the segmental drill is omitted. Emma's warm recitation of "pig" models the vowel without the segmental overhead. Choose this if the breakdown sounds mechanical.

**SSML annotation (Option B):**

```xml
Listen — short i says
<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>,
not <phoneme alphabet="ipa" ph="iː">ee</phoneme>.
Like <phoneme alphabet="ipa" ph="pɪɡ">pig</phoneme> — listen:
<phoneme alphabet="ipa" ph="pɪɡ">pig</phoneme>.
```

The whole-word IPA tag `/pɪɡ/` on "pig" is lighter than the three-token breakdown and lets Emma's prosody predictor handle the word naturally while guaranteeing the vowel quality.

### Option C — Mouth-shape cue variant

> "Short i is a quick sound — _ih_. Not 'ee.' Smile a little and say it short: _ih_. Pig!"

~10 seconds. 20 words.

**Trade-off:** Replaces the segmental breakdown with the articulation cue from `phonics-sequence-marian.md` §Application ("short /i/ makes you smile"). Phonics research notes that mouth-shape mnemonics ("smile" for /ɪ/) are useful articulation anchors — but they are most powerful when Emma can display a corresponding animation, which the current EmmaPose state machine does not yet wire to opener lines. Without the visual, the "smile" instruction is audio-only and loses some force. Recommended only if Kyle has confirmed Emma's happy-smile pose can be triggered during the opener utterance.

**SSML annotation (Option C):**

```xml
Short i is a quick sound —
<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>.
Not <phoneme alphabet="ipa" ph="iː">ee</phoneme>.
Smile a little and say it short:
<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>. Pig!
```

---

## Evidence basis (brief — full citations in `phonics-sequence-marian.md` and `short-u-minimal-pair-and-future-vowel-openers.md`)

- **Tagalog /i/ vs. English /ɪ/:** Tagalog has /i/ (high front tense), not /ɪ/ (high front lax). Under the Perceptual Assimilation Model (Best, 1995; Tyler et al., 2014 — PMC4143388 [Strong]) and SLM-r (Flege, 2021 [Strong]), Tagalog-primary learners hear /ɪ/ as a poorer instance of their /i/ — "Category-Goodness assimilation." The substitution direction is /iː/ for /ɪ/, not /ɛ/ or any other category. Contrasting against /iː/ directly targets the predicted error.
- **Lifetime-once dose:** Supported by Barlow & Gierut (2002) — "three to five word pairs make permanent changes in a child's phonological system" [Moderate]; Deci et al. (1999) meta-analysis [Strong] on repeated-remediation cost; `short-u-minimal-pair-and-future-vowel-openers.md` §2 [internal, cited evidence]. No new evidence warrants a different dose for /ɪ/.
- **SSML `/ɪ/` support:** Azure SSML phonetic sets [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets) confirms IPA `/ɪ/` is supported for en-US (Moderate — documentation, not an independent benchmark).

---

## Risks

1. **Azure neural prosody override unpredictability.** The existing project note (`project_audio_phoneme_overrides.md`) confirms that `two → /tuː/` was tried and Emma ignored the IPA value. The isolated `ih` → `/ɪ/` override is more defensible (the token is genuinely ambiguous), but Kevin should test-listen to the baked canon audio before shipping. If the phoneme tag degrades prosody, fall back to Option B (whole-word tag on "pig").
2. **No Tagalog-child-specific RCT on /i/–/ɪ/ contrast.** All claims about substitution direction are inferred from PAM/SLM-r applied to the five-vowel-system parallel. Direction is well-supported theoretically; dose and word-pair specifics are inferred, not empirically pinned.
3. **EmmaPose wiring gap for Option C.** The smile articulation cue in Option C is audio-only unless Kyle wires the opener to Emma's happy pose. Without the visual, it may confuse Marian ("smile while saying what?"). Keep Option C as a Kyle-optional enhancement, not the default.

---

## Recommendations

**For Kevin (ticket `86c9qdp1q`):**

1. Use the primary recommendation text and SSML as the default canon line.
2. Test-listen to the baked audio after `npm run canon:regen` — specifically check: (a) does the isolated "ih" sound like /ɪ/ or schwa or /iː/?; (b) does the breakdown sound natural or robotic? If (b) sounds robotic, switch to Option B SSML (whole-word `/pɪɡ/` tag instead of three-token breakdown).
3. The opener fires exactly once per device lifetime (`lifetimeFirstEncounters['cvc-words-short-i']`), same gate as the PR #174 `/ks/` pattern.
4. Do NOT add a `cvc-words-short-i` opener line to the short-u canon or any other tier's session; the gate and line are strictly scoped to `cvc-words-short-i` first-encounter.

**For Kyle (if Option C is considered):** Wire Emma's happy-smile pose to fire during the "smile a little" instruction before adopting Option C. Without the visual, Option C's articulation cue is incomplete.

---

## Sources

| #   | Citation                                                                                                                                                                                                                                  | Strength            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Microsoft Learn. "SSML Phonetic Sets — en-US." https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets                                                                                               | Documentation       |
| 2   | Tyler, M.D. et al. (2014). "Perceptual assimilation and discrimination of non-native vowel contrasts." PMC4143388. https://pmc.ncbi.nlm.nih.gov/articles/PMC4143388/                                                                      | Strong              |
| 3   | Flege, J.E. (2021). "The Revised Speech Learning Model (SLM-r)." Cambridge University Press. https://www.cambridge.org/core/books/abs/second-language-speech-learning/revised-speech-learning-model-slmr/7A720FCB65B653B00C766A436908B1A7 | Strong              |
| 4   | Barlow, J.A. & Gierut, J.A. (2002). "Minimal pair approaches to phonological remediation." _Seminars in Speech and Language_, 23(1), 57–68.                                                                                               | Moderate            |
| 5   | SpeechBlubs (2024). "Mastering Short 'I' Words for Kids." https://speechblubs.com/blog/mastering-short-i-words-for-kids-a-parents-essential-guide                                                                                         | Weak (practitioner) |
| 6   | phonics-sequence-marian.md (internal, 2026-04-26)                                                                                                                                                                                         | Internal            |
| 7   | short-u-minimal-pair-and-future-vowel-openers.md (internal, 2026-05-09)                                                                                                                                                                   | Internal            |
