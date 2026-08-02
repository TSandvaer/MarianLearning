# Quality bars — Marian Tutor (Thomas-confirmed)

Thomas's **standing quality bars** — the things he holds the app to that aren't derivable from a
ticket or a spec. This file converts the _reactive_ taste-memory (bars learned after an ear-test
reject) into a _proactive_ artifact the orchestrator reads BEFORE a taste-sensitive dispatch, so the
bar is named up front. Maintained by the `/name-the-bar` skill; referenced by
`CLAUDE.md § Predict-Before-Soak + bounded convergence`.

> **Seed provenance (2026-08-02):** the rows below are **seeded from the project memory index**
> (`MEMORY.md`) and `CLAUDE.md`, each citing the source it came from. They were learned reactively
> over the project's life; this file is where future bars get _confirmed up front_ instead.
> ⚠ **Seeded rows are not the same as freshly-confirmed rows** — each is marked `seeded` until Thomas
> confirms or corrects it through a `/name-the-bar` popup, at which point the Source cell gains the
> confirmation date.

## How to use

- **Before a voice/visual/feel/first-of-class dispatch:** find the bar(s) that apply to the surface,
  paste them into the dispatch brief, and predict against them in the Self-Test Report.
- **When an ear-test corrects a bar:** update the row here AND the cited memory; note the date.
- **When WRITING or AMENDING a bar — state what its check returns on an instance that should FAIL it.**
  A check that runs only on the passing case measures **presence, not discrimination**: it cannot catch
  a thing that is technically present and useless. (Imported discipline from Far-Horizon's
  `team/quality-bars.md`, where three evasions survived to review because bar #10 was never asked this.)
- **Row shape:** `Bar` — the one-line standard | `Surfaces` — where it applies | `Source` — memory slug
  / date / status.
- **When a bar outgrows its row, MOVE the overflow into a `## Bar N — <topic>` appendix — never trim
  it.** The row keeps the one-line standard + a `see § Bar N` pointer; the PR body carries a
  completeness ledger (every clause removed from the row → the subsection it now lives in) so the move
  is reviewable rather than a silent trim.

## Bars

| #   | Bar (the standard)                                                                                                                                                                                                                                                                                                | Surfaces                                              | Source                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Emma speaks **British English (en-GB)** — `en-GB-OliviaNeural` is the standard voice. A voice swap must **preserve the utterance text exactly** (`revoiceCanon.ts`); re-voicing is never an excuse to reword.                                                                                                     | all TTS, canon bake, any voice change                 | `[[feedback_prefer_british_voice]]` (PR #356) · **seeded**                                                                                         |
| 2   | Audio is judged on **REAL baked canon played in the production frame** — never a synthetic preview, never a bare render outside the app. Build a per-cell audition page that plays the actual baked clip, and badge the changed cells. Thomas is the ear gate.                                                    | voice QA, phoneme/SSML changes, re-renders            | `[[feedback_audio_audition_page_pattern]]`, `[[project_voice_qa_system]]` · **seeded**                                                             |
| 3   | Phoneme TTS overrides are **per-class, never blanket** — defensively wrapping unaffected words degrades them. A rule that fixes stops must not be applied to fricatives; verify each class independently on the shipped surface.                                                                                  | SSML, `<phoneme>` overrides, blend/letter-sound clips | `[[project_audio_phoneme_overrides]]`, `[[reference_blend_isolated_phoneme_per_class_tts]]` · **seeded**                                           |
| 4   | **Never a red X.** Emma reacts _in character_ — head-tilt-and-smile on correct, head-tilt + hand-on-chin on puzzled. This principle is **invariant**; no error state may regress it.                                                                                                                              | every wrong-answer path, all feedback UI              | `CLAUDE.md` § Design principles · **seeded, invariant**                                                                                            |
| 5   | Distractors are gated on **7–9-year-old error-pattern fit FIRST**, mechanical correctness second. A mechanically-valid distractor that no real 8-year-old would pick is a defect, not a pass.                                                                                                                     | math + word distractor generation                     | `[[feedback_distractor_class_pedagogical_gates_mechanical]]` · **seeded**                                                                          |
| 6   | **Objective invariants are proven by a Playwright spec, not by Thomas.** Anything mechanically checkable (mastery transitions, focus-node picks, gate firing, state shape) ships with a failing-first E2E spec. Thomas's attention is reserved for subjective feel, real-iOS Safari, and real-Marian observation. | all progression / state-machine work                  | `[[feedback_jessica_first_for_objective_gates]]`, `[[feedback_progression_e2e_mandatory]]`, `[[feedback_thomas_only_when_essential]]` · **seeded** |
| 7   | **Never make Thomas the domain expert.** Pedagogy, content sequencing, UX and audio-direction questions route to a specialist persona (Dave / Kyle) which returns **ONE team recommendation** — never an option menu handed to Thomas to adjudicate.                                                              | every dispatch that surfaces a domain question        | `[[feedback_no_sponsor_as_expert]]` · **seeded**                                                                                                   |
| 8   | When a fiddly subjective target stalls (~2 failed attempts), give Thomas a **direct-manipulation instrument** (audition page, A/B compare, picker, slider) so he dials it himself — don't grind blind iterations.                                                                                                 | any stalled taste-gated tuning                        | user-global § "Build an instrument instead of grinding", composes with `/unstick` · **seeded**                                                     |

## Confirmation log

Append one line per `/name-the-bar` run: date, bar # touched, what Thomas confirmed / corrected /
rejected. A run that produces zero inferences is a valid outcome and needs no entry.

<!-- 2026-08-02 — file seeded from MEMORY.md + CLAUDE.md during the Far-Horizon alignment pass. No bar
     has been through a /name-the-bar confirmation popup yet; all 8 rows are marked `seeded`. -->
