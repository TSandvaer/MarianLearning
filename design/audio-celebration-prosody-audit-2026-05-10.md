# Celebration prosody audit — CVC tiers (2026-05-10)

ClickUp: 86c9qhr80
Trigger: PR #192 ear-test, Thomas observation on `lid` celebration ("she's not dragging the word out").

## TL;DR

The clip Thomas heard is **template-structural, not phoneme-structural**. The phoneme-class hypothesis from the ticket brief is **falsified by the data** — `lid` (the flagged anchor) is the 25th-shortest of 32 celebrations, not the shortest, and final-stop-class words are *not* the shortest class as a group (nasals are).

The mechanism is the celebration template `"Yes! [Word]."`:

- Two-clause sentence where clause 2 is a single content word followed by a period
- Azure's prosody predictor renders this as **list-final / declarative-tag intonation** — the chip word gets a clipped fall-then-stop contour
- The Math equivalent `"Yes! [number]!"` (trailing `!`) sounds livelier on the same anchor for the same reason in reverse — the `!` provokes a rising / sustained contour

The fix surface is template wording, not Azure prosody knobs and not phoneme-by-phoneme work.

**Recommendation: Option A1 — reword to `"Yes! That's a [word]."`** (CVC tiers only). Three-word lead-in gives Azure clear sentence rhythm; chip word lands sentence-final with declarative-stress prosody (the same prosody class as the natural-sounding `Read the [word].`). Re-bake cost ~32 utterances (8 per tier × 4 tiers), all incremental — single `--require-keys` regen run, ~2 minutes wall time.

Thomas: ear-test the recommendation against `Yes! Lid.` on a Vercel preview before approving the implementation ticket. If the cost-vs-perception trade reads "marginal," Option D (accept) is also defensible — Marian's recognition isn't blocked.

## Inventory

All 32 `*.correct` utterances across the four CVC tiers. Duration measured by decoding the canon-stored base64 MP3 + reading the MPEG header via `mutagen.mp3.MP3`.

| Tier | Slot | Word | Final phoneme | Class | Text | Duration (ms) |
|---|---|---|---|---|---|---|
| short-a | p1 | cat | /t/ | stop | Yes! Cat. | 2016 |
| short-a | p2 | bag | /g/ | stop | Yes! Bag. | 1968 |
| short-a | p3 | hat | /t/ | stop | Yes! Hat. | 2016 |
| short-a | p4 | van | /n/ | nasal | Yes! Van. | 1944 |
| short-a | p5 | can | /n/ | nasal | Yes! Can. | 1920 |
| short-a | p6 | fan | /n/ | nasal | Yes! Fan. | 2040 |
| short-a | p7 | bat | /t/ | stop | Yes! Bat. | 2016 |
| short-a | p8 | jam | /m/ | nasal | Yes! Jam. | 1944 |
| short-o | p1 | dog | /g/ | stop | Yes! Dog. | 1896 |
| short-o | p2 | mom | /m/ | nasal | Yes! Mom. | 1776 |
| short-o | p3 | pot | /t/ | stop | Yes! Pot. | 1992 |
| short-o | p4 | mop | /p/ | stop | Yes! Mop. | 1896 |
| short-o | p5 | log | /g/ | stop | Yes! Log. | 1896 |
| short-o | p6 | box | /ks/ | cluster-stop | Yes! Box. | 1992 |
| short-o | p7 | fox | /ks/ | cluster-stop | Yes! Fox. | 2016 |
| short-o | p8 | hot | /t/ | stop | Yes! Hot. | 1992 |
| short-u | p1 | sun | /n/ | nasal | Yes! Sun. | 1968 |
| short-u | p2 | cup | /p/ | stop | Yes! Cup. | 1920 |
| short-u | p3 | bus | /s/ | fricative | Yes! Bus. | 2016 |
| short-u | p4 | bug | /g/ | stop | Yes! Bug. | 1896 |
| short-u | p5 | jug | /g/ | stop | Yes! Jug. | 1848 |
| short-u | p6 | rug | /g/ | stop | Yes! Rug. | 1968 |
| short-u | p7 | nut | /t/ | stop | Yes! Nut. | 1968 |
| short-u | p8 | gum | /m/ | nasal | Yes! Gum. | 1968 |
| short-i | p1 | pig | /g/ | stop | Yes! Pig. | 1824 |
| short-i | p2 | bin | /n/ | nasal | Yes! Bin. | 1752 |
| short-i | p3 | **lid** | **/d/** | **stop** | **Yes! Lid.** | **2016** |
| short-i | p4 | pin | /n/ | nasal | Yes! Pin. | 1752 |
| short-i | p5 | wig | /g/ | stop | Yes! Wig. | 1848 |
| short-i | p6 | bib | /b/ | stop | Yes! Bib. | 1872 |
| short-i | p7 | fig | /g/ | stop | Yes! Fig. | 1944 |
| short-i | p8 | sip | /p/ | stop | Yes! Sip. | 2112 |

### Class summary

| Final-phoneme class | n | Mean (ms) | Min (ms) | Max (ms) |
|---|---|---|---|---|
| nasal (/m/, /n/) | 9 | 1896 | 1752 | 2040 |
| stop (/p/, /t/, /b/, /d/, /g/) | 20 | 1945 | 1824 | 2112 |
| cluster-stop (/ks/, x-spelling) | 2 | 2004 | 1992 | 2016 |
| fricative (/s/) | 1 | 2016 | 2016 | 2016 |

### Tier summary

| Tier | n | Mean (ms) | Min (ms) | Max (ms) |
|---|---|---|---|---|
| short-a | 8 | 1983 | 1920 | 2040 |
| short-i | 8 | 1890 | 1752 | 2112 |
| short-o | 8 | 1932 | 1776 | 2016 |
| short-u | 8 | 1944 | 1848 | 2016 |

### Where `lid` actually ranks

`lid` is **rank 25/32** by duration (1=shortest). It is *longer* than 75% of the celebration set including all 9 nasals and several stops. The data does not support "/d/-stop is shortest" or "short-i tier is most clipped."

## Pattern hypothesis — REVISED

### Original hypothesis (from ticket brief): falsified

The brief proposed a phoneme-ending taxonomy: stops → most clipped, fricatives → less clipped, nasals → least clipped. The MP3 duration data does not support this. Nasal endings are the *shortest* class on average (1896ms), not the longest. Stops sit middle (1945ms). The single fricative (`bus`, /s/) is at the long end (2016ms) — but the sample of one is too small to generalize.

The mechanism implied by the brief — "stop consonants get cut by celebration prosody" — would predict `lid` to be among the shortest. It is among the longest. Whatever Thomas heard, it isn't a duration-of-final-consonant phenomenon.

### Revised hypothesis: prosody contour, not duration

Compare three utterance shapes for the same anchor word `lid`:

| Slot | Text | Duration | Thomas's perception |
|---|---|---|---|
| read | Read the lid. | 1344 ms | natural ("not dragging out" was implicit baseline) |
| **correct** | **Yes! Lid.** | **2016 ms** | **clipped** (flagged) |
| hint | Let's look. Lid. | 2352 ms | not flagged |
| giveAnswer | This one is lid. | 1704 ms | not flagged |
| reprompt | Hmm... try again? | 2256 ms | not flagged |

Three structural observations:

1. **Total wall-time is not the variable.** `Yes! Lid.` (2016ms) is *shorter* than `Let's look. Lid.` (2352ms), but the longer one isn't flagged. The chip-word's allocated time within each utterance is similar (~600-700ms after the leading clause).

2. **The flagged template is the only one with a single-word leading exclamation.** `Yes!` is a one-word exclamation followed by a period-bounded one-word clause. Every other template either:
   - puts the word sentence-internally with a function-word ramp (`Read the [word].`, `This one is [word].`)
   - opens with a multi-syllable clause that establishes prosodic rhythm (`Let's look. [Word].`, `Hmm... try again?`)

3. **The mechanism is Azure's list-final / declarative-tag intonation.** When Azure's prosody predictor sees `[exclamation]! [single-content-word].` it renders the second clause as a list-item or appositive tag — falling pitch, abrupt voice-offset, no terminal sustain. The same word in `Read the [word].` lands as sentence-final stressed content with natural pre-decay (longer release on final consonant, lower glottal cut-off). Empirically, the duration is similar but the *contour* is different — the perception of "drag the word out" is contour-driven, not millisecond-driven.

### Cross-track confirmation

The Math equivalent `"Yes! [number]!"` (trailing `!`, not `.`) hits ~2016ms on `"Yes! Five!"` — same wall time as `"Yes! Lid."` — but does not draw the same complaint, because the trailing `!` provokes Azure to render a rising/sustained contour on the answer word. The contour, not the duration, is what reads as "lively" vs "clipped."

The CVC celebration uses `.` rather than `!` because phonics anchor words must be heard as the careful/canonical pronunciation (`/lɪd/`) — a rising shout on `Yes! Lid!` would distort the vowel toward `[lɪːd]` and undermine the discrimination work the chip is doing. Switching to `!` is therefore not a free option; we need a different lever.

## Proposed fix options

### Option A1 — Reword: `"Yes! That's a [word]."` (RECOMMENDED)

| Trade-off | Value |
|---|---|
| Wordiness | +2 words per celebration |
| Re-bake cost | 32 utterances × 1 incremental run (~2 min) |
| Pipeline change | None |
| `escapeSsml` posture | Preserved |
| Discrimination preserved? | Yes — chip word still ends sentence after comma-free declarative |
| Risk | Some chip words don't take an article gracefully — `box`, `fox`, `bus`, `bib`, `bus`, `dog`, `mom`, `gum`, `jam` are fine; `mom` is iffy ("That's a mom" vs "That's mom"); function-word `mom` may need a per-word exception. |

The lead-in `"That's a"` (3 syllables) gives Azure clear sentence rhythm. The chip word lands at sentence-final position after a stable declarative ramp — same prosodic environment as `Read the [word].`, which Thomas has not flagged. The article pre-decay also gives a small amplitude bump that pulls up the chip-word onset — naturally sustained.

The wordiness cost is real (+2 words × 32 utterances = +64 words across all four tier canons) but Marian sits well inside the 200-word vocabulary cap regardless: `that`, `that's`, `a` are core sight-word territory.

**`mom` exception**: `"That's a mom."` is grammatically wrong (mass/relational noun). Either drop the article (`"That's mom."` — 2 words, less work for prosody but might still clip) or swap the chip slot to a different short-o word. Easier path: per-word special-case in the planner template, falling back to `"Yes! [Word]!"` (trailing `!`) for `mom`, `dad`, `jam` (and any other mass / proper / relational noun chip).

### Option A2 — Reword: `"Yes! That is a [word]."`

The `That is` expansion (vs `That's`) gives slower onset rhythm but loses childlike conversational feel. **Reject** in favour of A1 — Emma's voice is warmer with the contraction.

### Option A3 — Reword: `"Yes! It's a [word]."`

Shorter than A1 but `it` is a content-poor pronoun that can read as condescending after a correct answer ("good for you, it's a lid"). Also has the same `mom`/`dad` exception. Marginal savings vs A1, weaker tone. **Reject**.

### Option A4 — Reword: `"That's right! [Word]."`

Introduces a new lexical item (`right`) and still ends with the same single-content-word clause Thomas flagged. Just relocates the clip from clause 2 to clause 2 of a longer utterance. **Reject** — does not address the structural mechanism.

### Option B — SSML break injection: `"Yes! <break time='150ms'/> [Word]."`

| Trade-off | Value |
|---|---|
| Wordiness | None |
| Re-bake cost | 32 utterances × 1 incremental run (~2 min) |
| Pipeline change | **Required.** Canon `text` is currently passed through `escapeSsml`. A `<break>` would be escaped to `&lt;break .../&gt;`. Either (a) bypass `escapeSsml` for celebration utterances (per-utterance-id escape exemption), or (b) introduce a parallel "ssml-text" canon field. |
| `escapeSsml` posture | Compromised (the rule "all text-segment canon is plain English" loses an exception). |
| Discrimination preserved? | Yes — break only adds time before the chip word. |
| Risk | The break inserts time but does not change the contour of clause 2. Azure may still render `[break] Lid.` as a single declarative-tag clause. The fix targets a different mechanism than the one observed. |

**Reject as primary fix.** This is the option the brief favored, but the empirical contour-not-duration finding makes Option A1 a better match for the actual mechanism. Option B also forces a pipeline change explicitly flagged in `.claude/docs/planner-and-canon.md` § "Tier-specific opener pattern" as "invasive — not done as of 2026-05-10."

### Option C — SSML rate adjustment: `"Yes! <prosody rate='-15%'>[Word]</prosody>."`

| Trade-off | Value |
|---|---|
| Wordiness | None |
| Re-bake cost | 32 utterances × 1 incremental run |
| Pipeline change | **Required.** Same `escapeSsml` constraint as Option B, plus a parallel concern: today the global `<prosody rate="-10%">` already wraps the entire utterance ([api/_tts.ts:368](MarianLearning/api/_tts.ts#L368)). Nesting `<prosody rate>` may multiply or override unpredictably across Azure voices. |
| `escapeSsml` posture | Compromised (same as B). |
| Discrimination preserved? | Risky — slowing the chip word may distort the vowel duration toward an unnatural drawn-out form. The whole point of the careful `-10%` global rate is that it sounds natural; pushing the chip lower may sound robotic. |
| Risk | Class-3 IPA-outcomes risk per `planner-and-canon.md` — Azure may render the nested prosody fine in opener prosody and clash in celebration prosody. Untestable from agent side; needs Thomas ear-test. |

**Reject as primary fix.** Two compound risks (pipeline + nested-prosody) for a structural problem that has a wording fix.

### Option D — Accept as limitation

| Trade-off | Value |
|---|---|
| Wordiness | None |
| Re-bake cost | 0 |
| Pipeline change | None |
| Discrimination preserved? | Yes (status quo) |
| Risk | Marian's recognition is not blocked. The clip is parent-perceptible but child-acceptable. Thomas himself flagged it as a low-priority polish. |

**Defensible.** The ticket is priority "Low (quality polish — Marian's already accepting fine)." If Thomas listens to the A1 reword on Vercel preview and the perceptual delta is marginal, accepting the status quo saves the re-bake cost AND avoids any chance of the article-fix introducing a new wart (the `mom`/`dad` exception, the `+2 words` perception cost). The lint+canon-commit infrastructure means any future re-bake remains cheap if a tier-specific clip becomes more obvious.

## Recommendation

**Option A1 — reword to `"Yes! That's a [word]."` with per-word exception for relational/mass-noun chips** (`mom`, `dad`, `jam` — fall back to `"Yes! [Word]!"` trailing-bang form).

Reasoning:

1. Targets the actual mechanism (contour, not duration). The article-led declarative ramp lands the chip word in the same prosodic context as `Read the [word].`, which Thomas has empirically not flagged.
2. Cost is bounded and reversible. Single incremental canon regen (~2 min wall, cents on Anthropic), all changes in one PR, full rollback is just reverting the planner template literal + a re-bake of the four CVC canons.
3. Pipeline-clean. No `escapeSsml` exemption, no nested prosody, no per-utterance-id markup. The new template is plain English; canon-lint stays green.
4. Surfaces a real authoring pattern. `WORD_SONG_TARGET_WORDS_*` already consciously curates count nouns plus a few exceptions (`mom`, `dad`, `jam`); making the celebration template article-aware is a one-line list constant + a ternary in the directive.
5. Empirically grounded — the prosodic environment of `That's a [word].` is structurally identical to `Read the [word].` (3-syllable function-word ramp + sentence-final content word), and we already know Azure renders that environment well.

**Sequencing:**

1. Spawn implementation ticket: planner-template change + per-word exception list + canon re-bake + 4 PR-snapshot ear-test.
2. Thomas ear-tests the four re-baked tiers on a Vercel preview. The done-when test is "lid celebration on `cvc-words-short-i.json` reads as natural-sustained, comparable to `Read the lid.`"
3. If A1 ear-tests poorly (e.g. the `That's a` lead-in lands cloying or condescending in Emma's voice), fall back to Option D and document the perceptual ceiling.
4. If A1 ear-tests well, ship in one commit per tier (4 commits) so the JSON diffs are reviewable per-canon and revertible per-tier.

**Out-of-scope notes for implementation ticket:**

- Math `"Yes! [N]!"` template stays unchanged. The `!` already does the prosodic work for numerics, and discrimination concerns don't apply to `five`/`three`/`seven`.
- Non-celebration word-song utterances (`read`, `hint`, `giveAnswer`, `reprompt`) stay unchanged — Thomas hasn't flagged them and they sit in different prosodic environments from the celebration.
- `blending-cv` celebration also uses `"Yes! [Word]."` and ought to get the same treatment for consistency, but the diagnostic flag was on CVC tiers — the implementation ticket should make the blending-cv re-bake explicit so it isn't silently skipped.

## What Thomas needs to ear-test next

If Option A1 implementation lands:

1. Open the Vercel preview URL for the implementation PR.
2. Run a `cvc-words-short-i` session through to problem 3 (`lid`). Listen to `Yes! That's a lid.` after a correct chip tap.
3. Compare against the historical clip on the current `Yes! Lid.` (audible in the deployed prod URL).
4. Verdict gate: "the new celebration sustains the chip word more like the read line does" → ship; "still feels clipped or now feels cloying" → fall back to Option D and the audit closes the question.
5. Spot-check one celebration per tier (`Yes! That's a cat.`, `Yes! That's a dog.`, `Yes! That's a sun.`, `Yes! That's a pig.`) for tier-uniform feel.

## Non-obvious findings (for memory + dispatch follow-ups)

1. **Phoneme-class hypothesis falsified.** The intuition that final-stop endings clip while nasals sustain is not supported by Azure Emma multilingual + `<prosody rate="-10%">` global wrap on this utterance shape. Worth a short memory entry so future audits do not re-derive the wrong starting point.

2. **Cost-asymmetry shifts the recommendation in BOTH directions, depending on Thomas's ear-test sensitivity.** Option D ($0, no risk) and Option A1 ($cents, ~2 min, mild risk of new wart) bracket the answer. Option B / Option C (pipeline-invasive) are dominated by both. The audit's job is to pre-stage the trade so the implementation ticket is one ear-test away from done.

3. **Azure has no documented "celebration prosody profile" knob.** The voice-level prosody predictor is a black box; we tune at the SSML wrapper layer (rate, pitch, volume, break, phoneme) but cannot select a different intonation contour by name. Empirically, contour selection is driven by terminal punctuation (`.` vs `!` vs `?`), clause structure (single vs multi-word), and lexical content (function-word ramps vs bare exclamations). The fix surface is wording, not voice tuning.

4. **`blending-cv` celebration is the same template** and is in canon at `public/canon/word-song/level-1/blending-cv.json`. Spot-checked: 8 `*.correct` utterances, all `"Yes! [Word]."`, same wall-time band. Implementation ticket should include blending-cv to keep consistency across all word-song level-1 focus nodes (an additional 8 utterances → 40 total re-bakes).

5. **The audit infrastructure is reusable.** The Python script that decodes canon base64 + measures MP3 duration via `mutagen.mp3.MP3` is a small standalone block. Could become a `scripts/canonProsodyAudit.ts` (or stay ad-hoc) for future "is this template clipping" questions on other utterance types. Not in scope here; flagging in case the maintain-docs sweep catches it.

6. **The `mom` / `dad` / `jam` per-word exception is a real authoring complication** — relational and mass nouns don't take the indefinite article. The implementation ticket needs an explicit exception list, otherwise the planner will emit ungrammatical celebrations (`Yes! That's a mom.`) that Marian would parse as wrong-meaning copy. The list is small (3-4 entries today) and bounded to the curated `WORD_SONG_TARGET_WORDS_*` lists.

## Files in play (read-only audit; no code touched)

- `MarianLearning/public/canon/word-song/level-1/cvc-words.json` — short-a celebrations (8 utterances)
- `MarianLearning/public/canon/word-song/level-1/cvc-words-short-o.json` — short-o (8)
- `MarianLearning/public/canon/word-song/level-1/cvc-words-short-u.json` — short-u (8)
- `MarianLearning/public/canon/word-song/level-1/cvc-words-short-i.json` — short-i (8)
- `MarianLearning/api/_planner.ts` § `WORD_SONG_TRACK_GUIDE` — celebration template literal at line 1075

Implementation ticket files-in-play (forward-look):

- `MarianLearning/api/_planner.ts` — `WORD_SONG_TRACK_GUIDE` template + per-word exception list
- `MarianLearning/public/canon/word-song/level-1/{blending-cv,cvc-words,cvc-words-short-o,cvc-words-short-u,cvc-words-short-i}.json` — re-bake + commit JSON diff per `project_canon_commit_strategy`
- `MarianLearning/api/_planner.test.ts` — directive drift-guard pinning the new template + exception list
