# Danish version: implementation brief

Handoff from the analysis session of 2026-10-19 to the orchestrating session.
**Status: not started.** Start only when Thomas asks for Danish to be implemented.

- Full analysis (6 pages, for Thomas and the colleague): `design/danish/danish-language-analysis-2026-10-19.pdf`
- Measurements were taken at `main 5a749112` (wave 4 Number Garden, #608). Re-measure counts before quoting them in tickets; waves after that commit add lines.

## Goal

A language choice, Danish or English, in the app. A colleague of Thomas wants his Danish daughter to use it on his Apple ID and device via TestFlight. The CLAUDE.md line "Strict English-only in the app" predates this and needs amending when the work starts (Thomas, 2026-10-19: "im planning on creating a danish version").

## Findings from the code (at 5a749112)

| Area            | Today                                                                                                                                                                                                                                                                                                  | Danish needs                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Language layer  | None: no i18n library, no language field in app, server or audio keys                                                                                                                                                                                                                                  | One `language: 'en' \| 'da'` setting that Emma, captions, menus and the map follow                 |
| Child's name    | Emma never says "Marian" in audio. `'Marian'` is hard-coded in 9 session-request places in `mobile/src`, ~10 parent texts and the planner prompt (`api/_planner.ts:1599`). `defaultProgress(childName = 'Marian')` at `packages/core/src/progress/defaults.ts:257`; no screen sets `profile.childName` | A name field in Parent settings, used everywhere                                                   |
| App text        | ~1,000 lines in `packages/core`: 548 map lines (343 unvoiced), 226 guidance lines, 17 hub, 4 greet, 12 land names, step names for 35 steps, ~45 parent texts. Screens: ~30 inline texts, 42 accessibility labels                                                                                       | Danish version of each, looked up by language; Danish grammar helpers (is/are, "and", count words) |
| Canon           | 36 files, 2,440 utterances, 1,093 unique texts, 23,141 chars. Maths 15 files / 404 texts / 10,466 chars; Word Song 21 files / 709 texts / 13,074 chars. **The app regex-parses the English sentences to build problems** ("Nine plus two. How many?")                                                  | Keep English as structure; add Danish text + audio per utterance id (see Design)                   |
| Bundled audio   | 457 MP3s in `mobile/assets/audio` (10 MB), keyed by line id, no language segment                                                                                                                                                                                                                       | A `da/` set (~+10 MB)                                                                              |
| Voice           | ElevenLabs `eleven_v4`, voice Lily `pFZP5JQG7iQjIQuC4Bku`, `mp3_44100_64`, no `language_code` sent (`api/_tts_elevenlabs.ts:27-32,218-222`). Phonics via IPA in slashes; v4 has no SSML                                                                                                                | v4 lists Danish as supported; pick a Danish voice by bake-off                                      |
| Planner prompts | English-only, written for Marian: preamble 5.6k chars, maths guide 87.6k, reading guide 69.8k                                                                                                                                                                                                          | Not needed for Danish maths v1 (canon only)                                                        |
| Voice-QA        | ~1,545 rows keyed without language; `EXPECTED_CANON_UNIQUE = 1093` at `public/voice-qa.html:641`                                                                                                                                                                                                       | A language column so Danish verdicts don't overwrite English                                       |
| Progress        | Per device (random device id); Upstash backup keyed by it; rate limit per IP                                                                                                                                                                                                                           | Nothing: a second family's device is separate automatically                                        |

Number words: `NUMBER_WORDS` at `packages/core/src/math/planFromServer.ts:143` is English. Letter pool: `LETTER_GLYPH_POOL` at `packages/core/src/wordSong/planFromServer.ts:93`.

## Recommended design

1. **One setting** `language: 'en' | 'da'` in ParentSettings, plus the child-name field. Recommendation: fold both into the learner-profiles spec (Kyle + Kevin, Thomas said "Yes, design profiles" on 2026-10-19) rather than designing them twice; check that spec's state first.
2. **Maths as parallel text.** Each canon utterance keeps its English text (the parser input) and gains Danish text + Danish audio under the same id. No parser rewrite; progress is shared across languages, so switching keeps it.
3. **Language segment in every audio, canon and cache key**, e.g. `audio/da/path/...`.
4. **Danish v1 = canon only.** Live AI sessions (graduation, spaced review, slow-fact hints) fall back to pre-recorded sets in Danish. A live Danish path can come later (English live already takes ~15 s).
5. **Danish number-word table**: _enogtyve_ (21, ones first), _halvtreds_ (50), _firs_ (80) are irregular. Dave reviews the two-digit lines: spoken Danish says the ones first, written numbers put tens first.
6. **Danish reading world = a separate structured node set** with its own ids and progress, designed by Dave (æ ø å, letter sounds, _lydrette ord_, the ~120 _småord_, sentences, stories). Built from structured data, not parsed sentences, to avoid the 6-surface content-tier trap. Reuse pictures where meaning matches (kat/cat, sol/sun). Until it exists, the reading world shows "kommer snart" in Danish mode.

## Phases (team-day figures are estimates from this project's own pace)

| Phase                  | Work                                                                                                                                                                                                                              | Team days | Native-ear time            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------- |
| 0 Decide + audition    | Questions to the colleague (below); voice bake-off page: Lily-in-Danish vs 2-3 native Danish library voices on real Emma lines; early test of ~10 Danish letter sounds                                                            | 1-2       | ~1 h listening             |
| 1 Plumbing             | Setting + name field, text lookup by language, language in audio/canon/cache keys, voice-QA language column, tests in both languages. No Danish content                                                                           | 3-5       | review only                |
| 2 Danish maths + shell | Translate with a fixed glossary (404 maths texts, ~170 map/general lines, greet, hub, land names, parent + screen texts); native text check; voice ~17k chars; ear-test ~600 rows; reading world "kommer snart"; TestFlight build | 3-5       | ~600 rows + read-through   |
| 3 Danish reading       | Dave's spec; 6-8 content waves; Danish letter-sound tuning (highest risk); 60-120 pictures; ear-test ~900 rows                                                                                                                    | 10-20     | ~900 rows + contact sheets |

The PDF recommends shipping Phases 0-2 first, then decide on Phase 3 after seeing how she uses it and after the letter-sound test.

## Cash (estimates)

- ElevenLabs: Phases 0-2 ~35-40k chars with re-takes; Phase 3 ~50-60k. Pricing page read 2026-10-19: Starter $6/mo with 75k `eleven_v4` chars, Creator $22 with 275k, overage $0.08 per 1k. Concurrency on Starter: 3 (`api/_session.ts:161-165`).
- Claude Haiku translation + bakes: < $5. Pictures (OpenAI Flare, $0.078 each): $5-10 in Phase 3.
- Totals: Phases 0-2 $10-30; Phase 3 +$30-40. Running cost ~$0/month while Danish is canon-only.
- Ongoing: every future maths wave needs a Danish twin, roughly +30-50% per wave.

## Risks

- **Danish letter sounds on `eleven_v4` are untested.** English isolated sounds took 8 blend passes and 4-6 voice-QA rounds before ElevenLabs solved them. Test ~10 in Phase 0 before committing to Phase 3.
- **Native ear needed** for ~1,500 rows in total. Agree who listens (Thomas or the colleague) before Phase 2.
- **Child-level Danish**: literal translation reads adult. Fixed glossary + Haiku with a Danish word-cap rule + native review.
- **Less adaptive at first** (no live sessions in Danish v1).
- **Wrong target** for reading: depends on her age and whether she already reads Danish.

## Questions for the colleague (Phase 0)

- How old is she, which class, does she already read Danish?
- What should she get: maths, Danish reading, or English?
- Which iPad and iPadOS version?

If the goal is English, keeping the English reading world and adding Danish help lines later is smaller than a Danish reading world (with its own voice risk: Danish sentences containing English words).

## Getting her onto TestFlight

- Add the colleague in App Store Connect → TestFlight as an **external tester by email** (no access to Thomas's App Store Connect). The first build of each new version goes through Beta App Review, typically 24-48 h; later builds of that version reach him automatically. Builds expire after 90 days.
- He installs TestFlight under **his** Apple ID; she uses his device. TestFlight's terms don't allow under-13s to use it themselves.
- Same production server; release server changes with `yarn release` before the build that needs them. Her progress and first name will sit in the Upstash backup store; worth telling him.
- **EAS is on the Starter plan** (Thomas upgraded 2026-10-19; `npx eas-cli account:usage sandvaer --json` read on 2026-10-19 shows plan Starter, billing period 2026-10-19 to 2026-11-19, iOS concurrency 2). Starter is $19/month including $45 build credit (about 22 medium iOS builds), then $2 per medium iOS build. The Free-plan 15-build cap in the PDF no longer applies.
- Local builds remain possible (`npx eas-cli build --platform ios --profile production --local`, then `npx eas-cli submit --platform ios --path <file>.ipa`), but fastlane is not installed and a local build has never been run here.
