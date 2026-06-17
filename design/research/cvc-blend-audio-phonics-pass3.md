# CVC Blend Audio — Pass-3 Phonics Ruling: /f/, /s/, /dʒ/, /w/

## Question

Pass-2 audition (PR #470) resolved four classes but left four unresolved: **/f/** (Thomas: "she should say 'æf' or 'aef'"), **/s/** (Thomas: "she says 'soe'; she should say 'es' or 'æs'"), **/dʒ/** (no alternative offered by Thomas), **/w/** (Thomas: "deep voice is closest"). For each class: is the proposed candidate pedagogically sound, and what is the exact render spec to audition?

---

## Bottom line

- **/f/ and /s/**: Leading-vowel isolation ("æf", "es") is pedagogically **acceptable at Marian's stage** — not the synthetic-phonics ideal, but not harmful for CVC blending of familiar words. Use **"ef"** (orthographic, no IPA) for /f/ and **"es"** (orthographic) for /s/ as the audition text. Both are letter names already in Marian's lexicon, the vowel before the consonant is the cue that helps children extract the trailing phoneme, and crucially neither ending-consonant will be swallowed by Azure the way trailing schwa was.
- **/dʒ/**: Audition one short candidate ("juh" at a slower rate with lower pitch) before flooring. The affricate is the hardest English onset for TTS isolation; if that candidate fails, FLOOR it — "jam" words get whole-word-only, same as "van".
- **/w/**: Audition a lower-pitch render of "wuh" (orthographic, no IPA) at `pitch="-20%"` relative to the outer prosody envelope. Thomas heard the deepest candidate as "closest"; the acoustic reason is real. If that fails, FLOOR.

---

## Ruling 1 — Leading-vowel fricatives: pedagogical acceptability for CVC blending

### The phonics-ideal position

Systematic synthetic phonics programmes (Letters and Sounds UK 2007, Jolly Phonics, Read Write Inc.) teach phoneme-leads: the pure sound /f/ with no attached vowel, not the letter name "ef". The principle is that children must hear the raw phoneme to blend, and letter names can interfere — if a child internalises "ef" as the sound of F, she may decode "fan" as "ef-a-n" and fail to collapse it.

### Why this position is too strict for Marian's situation here

That principle governs the **initial teaching** of letter-sound correspondences in Reception/Year 1 classrooms. Marian is not in that phase. From her April 2026 diagnostic:

- Consonant sounds are **mastered** — she knows /f/ and /s/ as phonemes already.
- She is in the **CVC-emerging** blending stage, not the letter-sound introduction stage.
- The blend hint is a **2nd-wrong-tap scaffold**, not the primary instruction surface.

The pedagogic risk of letter-name confusion (teaching "ef" = the sound of F) is only active when letter-sound correspondence is being introduced. For a child who already has that mapping, hearing "ef" in a blend hint does not install a new, wrong mapping — she already knows /f/ is /f/. What she hears in "ef" is: /ɛ/ + /f/ = an acoustically clean /f/ at the end, with a vowel preceding it to give the neural synth something to coarticulate against.

### The Treiman VC-name research

Treiman et al. (2009, *Journal of School Psychology* / *Journal of Experimental Child Psychology*) showed that vowel-consonant letter names (F = "ef", S = "es", L = "el", M = "em") are **harder for preschoolers to use as a letter-sound cue than consonant-vowel names** (B = "bee", D = "dee") — because the target phoneme is at the end, not the beginning. Children ages 3–4 without explicit instruction often cannot extract /f/ from "ef" spontaneously.

Critically: with explicit instruction pairing the name with the sound, VC-name letters were learned nearly as well as CV-name letters (Piasta, Purpura & Wagner 2010, PMC2978809). Marian has had that explicit instruction — she knows /f/. The "ef" cue is not confusing her; it is giving Azure a clean articulatory frame.

### Ruling

**Leading-vowel isolation is acceptable here, under three conditions:**

1. The child already has phoneme-grapheme correspondence for the target sound (Marian does).
2. The scaffold is a hint, not the primary instruction (it is — 2nd wrong tap only).
3. The render ends clearly on the consonant, not on a prolonged vowel (enforced by choosing ending consonants and avoiding extra schwa after).

The risk of installing the wrong mapping has passed. The practical benefit — giving Azure TTS a vowel to coarticulate against, producing a clean audible fricative — outweighs the theoretical concern.

### Exact strings to audition for /f/ and /s/

Do **not** use IPA tags for these. Azure renders orthographic letter names reliably; IPA isolated fricatives may suffer the same "soe" artifact that already failed. Use plain orthographic text as the inner content, wrapped in the standard blend prosody envelope.

---

## Per-class ruling table

| Class | Recommendation | Audition inner-text (blend slot, per phoneme) | SSML prosody wrapper | Rationale |
|-------|---------------|-----------------------------------------------|---------------------|-----------|
| **/f/** | Candidate: audition "ef" | `ef` (plain orthographic, no IPA) | `<prosody rate="-20%">ef</prosody><break time="150ms"/>` before the vowel phoneme | Letter name VC structure; /f/ at end is acoustically clean in Azure; matches Thomas's "æf" intent; avoid IPA which produced "soe"-type artifacts for /s/ |
| **/s/** | Candidate: audition "es" | `es` (plain orthographic, no IPA) | `<prosody rate="-20%">es</prosody><break time="150ms"/>` | Same VC-name logic; "soe" = trailing-schwa artifact from bare /s/ IPA; "es" gives the synth /ɛ/ + /s/ = clean fricative ending; matches Thomas's "es" / "æs" intent |
| **/dʒ/** | Candidate first, then FLOOR if rejected | `juh` (plain orthographic) | `<prosody rate="-30%" pitch="-15%">juh</prosody><break time="150ms"/>` | Affricate is stop + fricative; cannot be sustained like a continuant; "juh" is the lightest articulable form; lower pitch reduces the buzz; slower rate gives more onset time. If rejected: FLOOR — jam/jug get whole-word only |
| **/w/** | Candidate first, then FLOOR if rejected | `wuh` (plain orthographic) | `<prosody rate="-25%" pitch="-20%">wuh</prosody><break time="150ms"/>` | Thomas said "deep voice is closest" — lower pitch is the empirical signal to pursue; glides require a vowel for TTS coarticulation; orthographic "wuh" gives the synth a minimal /ʊ/ carrier. If rejected: FLOOR — web/wig get whole-word only |

**FLOOR consequence for /dʒ/ and /w/:** any CVC word whose onset is in a floored class skips the per-phoneme segmentation entirely and plays the whole word only in the blend slot. For the current short-a pool, affected words are: **jam** (/dʒ/), **web/wig** (/w/, not in short-a but planned for short-e/short-i). The short-a pool loss is one word (jam). This is acceptable — whole-word delivery is Candidate D from pass-1, rated "not harmful, just not a segmented blending model."

---

## Audition build notes for Devon

All four candidates share the same slot position in the blend string: the **onset phoneme** before the vowel. The rest of the blend sequence (vowel phoneme, coda phoneme, break, whole word) stays as currently shipped for the stop-control words. Devon should build audition clips for:

**Priority words per class:**

| Class | Audition words | Why |
|-------|----------------|-----|
| /f/ | fan, fox | Thomas's exact verdicts; onset /f/ |
| /s/ | sip, sun | Thomas's exact verdicts; onset /s/ |
| /dʒ/ | jam | Only /dʒ/-onset word in short-a pool |
| /w/ | web, wig | Thomas's exact verdicts (short-e planned) |

**Candidate spec per class** (what goes in `blendAuditionVariants.ts`):

```
/f/ candidate:
  onset_text: "ef"
  onset_ssml: <prosody rate="-20%">ef</prosody>
  break_after_onset: 150ms
  note: "plain orthographic; no IPA"

/s/ candidate:
  onset_text: "es"
  onset_ssml: <prosody rate="-20%">es</prosody>
  break_after_onset: 150ms
  note: "plain orthographic; no IPA; kills the trailing-schwa artifact"

/dʒ/ candidate:
  onset_text: "juh"
  onset_ssml: <prosody rate="-30%" pitch="-15%">juh</prosody>
  break_after_onset: 150ms
  note: "slower rate + lower pitch; affricate needs time and lower register"

/w/ candidate:
  onset_text: "wuh"
  onset_ssml: <prosody rate="-25%" pitch="-20%">wuh</prosody>
  break_after_onset: 150ms
  note: "lower pitch per Thomas's 'deep voice closest'; minimal vowel carrier"
```

The outer prosody envelope for the full blend line stays at `rate="-12%"` as currently shipped for stops. The per-phoneme prosody wrappers above are INNER to the outer envelope — Devon should nest them as `<prosody rate="-12%">...<prosody rate="-20%">ef</prosody>...</prosody>` or adjust the outer to match.

---

## Acceptance criteria for Thomas's ear (pass-3 audition)

For **each class**, accept if:

- The onset sound is **identifiable** as /f/, /s/, /dʒ/, or /w/ respectively — not a buzz, click, or silence.
- For /f/ and /s/: the vowel before the consonant ("ef", "es") does not sound like a full syllable competing with the target vowel in the word. Marian should hear it as: "ef... a... t... fan", not "EF - a - t - fan" where "ef" has equal weight to "a".
- The whole word at the end sounds natural.
- For /dʒ/ and /w/: the onset is identifiable even if slightly voiced ("juh" should sound like the beginning of "jam" with a brief trailing vowel; "wuh" should sound like the beginning of "web").

Reject (→ FLOOR) if:

- The class sounds worse than just playing the whole word.
- The onset cannot be identified as the target phoneme.
- Marian would likely hear a noise event rather than a phoneme.

---

## Evidence

- **Treiman, R. et al. (2009).** "Learning letter names and sounds: Effects of instruction, letter type, and phonological processing skill." *Journal of Experimental Child Psychology*, 105(4), 324–344. [PMC2978809](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978809) — VC letter names (F="ef", S="es") are harder for children to use as cues to phonemes than CV names (B="bee"), BUT combined name-and-sound instruction produces near-equivalent learning. The /f/ sound cue at the end of "ef" is usable when children have explicit phoneme knowledge. **Moderate evidence** (multiple-study program, sample sizes 80–120, preschool age 3–4; Marian is older with stronger phoneme knowledge, so the finding applies a fortiori).

- **Piasta, S. B., Purpura, D. J., & Wagner, R. K. (2010).** "Fostering alphabet knowledge development: A comparison of two instructional approaches." *Reading and Writing*, 23(6), 659–676. — Instruction combining letter names and sounds outperformed sound-only instruction for VC-name letters. Evidence that VC-name knowledge, once established, does not interfere with phoneme mapping. **Moderate evidence** (RCT, kindergarten, N=58).

- **Shanahan, T. (2019).** "Letter Names or Sounds First?" *Shanahan on Literacy* blog. [shanahanonliteracy.com](https://www.shanahanonliteracy.com/blog/letter-names-or-sounds-first-you-might-be-surprised-by-the-answer) — Expert synthesis: confusions from letter names "are short lived and don't outweigh the supports the letter names provide." Supports the position that for a child who has mastered letter sounds, letter names in a scaffold context are not harmful. **Weak** (expert opinion, not a controlled study).

- **Letters and Sounds UK (2007) / Jolly Phonics / Read Write Inc.** — Converging UK SSP practitioner consensus: teach phoneme-leads for initial letter-sound acquisition, not letter names. Cited here as the counter-position. **Moderate-to-strong** practitioner consensus but applies to initial instruction, not to a scaffold for a child who already has phoneme knowledge.

- **Gonzalez-Frey & Ehri (2021).** "Connected Phonation Is More Effective than Segmented Phonation." *Scientific Studies of Reading*, 25(3). [Tandfonline](https://www.tandfonline.com/doi/abs/10.1080/10888438.2020.1776290) — 150ms inter-phoneme break retained from pass-1 ruling; also supports keeping the carrier vowel minimal so the phoneme sequence stays perceptually connected toward the whole word.

- **Azure SSML documentation (2026).** Pitch attribute via `<prosody pitch="-20%">` is supported as a relative percentage below baseline; TTS treats it as a suggestion and clamps unsupported extremes. The `-15%` and `-20%` values for /dʒ/ and /w/ are within normal operating range for neural voices. [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice)

---

## Risks / counter-evidence

- **VC-name cue extraction risk.** Even for a child who knows /f/, the "ef" render places the phoneme at the END of a two-phoneme sequence. If Azure renders "ef" with falling intonation, the /f/ may be partially devoiced and hard to perceive. Thomas's ear test is the gate; accept only if /f/ is perceptually salient.
- **"es" vs "æs" vs "ɛs".** Thomas proposed "es" or "æs". Orthographic "es" in an en-GB voice will likely render as /ɛs/ (British vowel, similar to "bed") rather than /æs/ (closer to "bat"). This is fine — both give a clean /s/ ending. There is no need to use IPA to target /æ/ vs /ɛ/ — the /s/ is what matters, not the exact vowel preceding it.
- **/dʒ/ is genuinely hard.** The affricate is a composite stop + fricative. Even in human teacher phonics demos, /dʒ/ in isolation is controversial — some UK SSP programmes say it cannot be produced cleanly without the schwa ("juh") and accept it. If "juh" at lower pitch still sounds like "dʒuh" (full syllable "juh" with weight), FLOOR is the right call. Do not attempt IPA phoneme tags for /dʒ/ — they have a higher risk of synthesis failure than orthographic.
- **/w/ glide is voice-dependent.** En-GB-OliviaNeural is a relatively high-pitched voice. Lowering pitch by 20% relative may not be sufficient to produce the perceptual "deepness" Thomas preferred. There is no way to know without audition. If the candidate is rejected, FLOOR is correct — /w/ glide isolation has no clean articulatory path in neural TTS.
- **Nesting prosody elements.** Inner `<prosody>` rate/pitch overrides interact with the outer prosody envelope. Devon should verify that `rate="-30%"` inside `rate="-12%"` compound-applies rather than overrides, or adjust accordingly.

---

## Recommendations

1. **Build the pass-3 audition page with 4 classes × priority words** as specified in the table above (Devon task). Each word gets 2 clips: the candidate spec and whole-word-only (the FLOOR baseline to compare against).
2. **Thomas gates on perceptibility, not aesthetics.** The question for each clip is "can you hear what phoneme this is?" not "does it sound exactly like a teacher saying it?"
3. **/f/ and /s/**: if either class is accepted, update `blendAuditionVariants.ts` with orthographic onset text (no IPA) and the `-20%` rate wrapper. These are high-probability accepts given Thomas's explicit proposals.
4. **/dʒ/ and /w/**: if either is rejected, FLOOR immediately — the whole-word fallback is not a loss for Marian at this blending stage (she still hears the target word clearly).
5. After pass-3 ear test, Devon bakes the final blend spec: stops (shipped), /h/ (fric-rel, shipped), /v/ (FLOOR), /f/ (pass-3 result), /s/ (pass-3 result), /dʒ/ (pass-3 result), /w/ (pass-3 result). Splice-only into existing canon; do not re-draw problem content.

---

## Non-obvious findings

- **VC letter-name structure is a TTS trick, not a pedagogy regression.** The key insight is that Thomas's "æf"/"es" proposals work not because they are phonically ideal, but because they give the neural synth a vowel to coarticulate against. The same thing is true of the stop schwa-release used in pass-1. This pattern — leading or trailing minimal vowel as a coarticulation anchor — should be the default strategy for any isolated consonant that fails in Azure en-GB-OliviaNeural. Stop → trailing schwa; fricative → leading vowel (VC letter name); affricate and glide → audition then FLOOR.
- **Orthographic over IPA for short isolated tokens.** The "soe" artifact for bare /s/ IPA suggests that Azure's phoneme lookup for single-character IPA strings inside very short `<phoneme>` elements applies a default vowel differently than phoneme-in-word context. Orthographic text that renders to a well-known English syllable (letter name, "juh", "wuh") is more predictable than IPA for single-consonant isolation. This should be the default strategy for all future phoneme audition work in this project.
- **The FLOOR class is pedagogically adequate.** A floored onset class produces whole-word delivery, which is Candidate D from pass-1. For an 8-year-old at Marian's blending stage, hearing the whole word clearly (without a preceding phoneme sequence) is not regressive — it still scaffolds decoding by providing a clear acoustic target. The blend feature's value is in the phoneme-by-phoneme sequence for the onset + vowel + coda; flooring one class degrades the feature for those words but does not harm the child.
