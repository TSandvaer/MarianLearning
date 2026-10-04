# Voice migration: Emma from Azure Olivia to ElevenLabs Lily

Status: **plan, not started** (2026-10-04).

## Why

Isolated phonics sounds never came out reliably on Azure. Getting them right took 8 ear-gated blend passes, 4–6 voice-QA rounds, and per-class SSML workarounds in `api/_tts.ts` (`PHONEME_OVERRIDES`, `SCRATCHY_PROSODY_BY_MNEMONIC`, `BLEND_GRAPHEME_IPA`, `BLEND_FRICATIVE_ONSET_IPA`). The production Azure resource also rejects the bake-time markup, which forced two render paths.

In a two-round ear-test bake-off on 2026-10-04 (pick page in `tmp/bakeoff/`), **ElevenLabs `eleven_v4` with the voice Lily (`pFZP5JQG7iQjIQuC4Bku`) won 40 of 40 rows** against production Azure clips with identical text:

- 16 rows: the 8 hardest isolated sounds (v, w, f, s, t, th, sh, j), each in two sentences.
- 10 rows: CVC blends.
- 14 rows: everyday Emma lines (greeting, prompts, praise, maths, an explanation, goodbye).

Phonics sounds were sent as inline IPA (`/vː/`, `/θː/`, `/dʒ/`) with no SSML workarounds. Emma moves to Lily completely; moving only her phonics would make her sound like two people.

## Measured scope

- Canon: 1,716 utterances in 25 session JSON files, **760 unique texts, 14,784 unique characters** (ElevenLabs bills per character).
- Bundled MP3s: 4 greet lines (`scripts/render-greet-mp3s.mjs`) and 18 hub lines (`scripts/render-hub-mp3s.mjs`).
- One live render path: graduation `cvc-words` sessions skip the canon and call TTS at request time (`api/claude.ts`, graduation bypass around line 797).

## Phases

1. **ElevenLabs adapter behind the existing seam.**
   - Add an ElevenLabs backend for `synthesizeUtterance`, configured for Lily and `eleven_v4`. Choose an MP3 output format close to today's 24 kHz / 48 kbps so the canon stays roughly its current ~33 MB.
   - Replace the SSML phoneme tables with one IPA map. Mnemonics such as `vvv` become `/vː/`, and blends such as `v - a - n ... van` become `/vː/ - /æ/ - /n/ ... van`.
   - The IPA goes only into the TTS input. Canon `text` and on-screen captions stay unchanged.
   - Unit tests for the mapping.
2. **The remaining ~35 sounds.** Audition every other letter sound, the vowels a/e/i/o/u, and the digraphs ch and sh on the pick page, in production sentences, and lock the IPA for each.
3. **Wording change.**
   - The confirm line becomes `Yes. X says <sound>.`, replacing `Yes. X says it. <sound>?` (an Azure workaround that makes Lily drift to "vuh").
   - Digraph prompts become `Which two letters say …?` and `Yes. T and H say … together.`.
   - This changes canon text, so the planner prompt, canon, browser parser and e2e specs change together, per the content-tier checklist.
4. **Re-voice.**
   - Re-render all 760 unique canon texts, plus the greet and hub MP3s, with text byte-identical (`scripts/revoiceCanon.ts` pattern).
   - Render once, ear-test, and re-take only the clips that are flagged.
5. **Live path.** Point the graduation `cvc-words` render at ElevenLabs. This needs `ELEVENLABS_API_KEY` in Vercel's environment variables, which you set.
6. **Re-test and ship.**
   - Every clip's hash changes, so all items on `/voice-qa.html` go back to needs-retest. Run the full ear-test.
   - Bump the service worker `CACHE_VERSION` so the iPad picks up the new audio.
   - Release with `yarn release`.
   - Remove the unused Azure code paths in a follow-up.

## Cost

- One take of the canon plus greet and hub is about 15–16k characters. Two takes of everything is about 32k.
- The Starter plan's 40,000 credits cover a single pass plus re-takes. A full two-take pass, plus the 35-sound audition, plus the live path in production, probably needs the Creator plan ($22/mo) for the migration month. This is an estimate; check the balance before Phase 4.

## Risks and open questions

- **Takes vary.** Every ElevenLabs render is slightly different. In round 2 you picked the second take in every row; it's unverified whether that was a real difference or column habit. The plan uses render once, ear-test, re-take flagged.
- **No SSML breaks on v4.** Pauses that today rely on `<break>` (e.g. the 300 ms before a sound) must come from punctuation, or from splicing in an audio tool (the bake-off built a spliced variant, but it was never judged).
- **Vendor and model maturity.** `eleven_v4` is new. Pin `model_id` explicitly; the key lacks `models_read` anyway.
- **Live latency and rate limits** for the graduation path are untested.
- **Soft-g** ("gem", "gel") was wrong on Azure. Re-check it with Lily.
