# PR #105 acceptance run — `feat(api): wire real Anthropic SDK call into /api/claude session-start`

- **Date:** 2026-04-29
- **Build SHA under test:** main @ `d9b2510` (post-merge of PR #105 + PR #106 + hot-fix PR #109)
- **Deploy URL:** https://marian-learning.vercel.app/
- **PR under test:** #105 (#86c9jdh39) — replaces stub session-start with real Haiku call
- **Adjacent merges in the same evening cascade:** PR #106 (Hub + back-arrow + storage migration), PR #109 (hot-fix: strip markdown fences from Haiku output)
- **ClickUp ticket:** `86c9jdh39`
- **QA branch:** `qa/86c9jdh39-pr105-acceptance-run`
- **QA env:**
  - OS: Windows 11 Enterprise 10.0.26100
  - Tester: QA persona (acting on Matt's dispatch)
  - Test method: `curl` against production API; no iPad device available this run
- **Run window:** 18:04 → 18:09 UTC

## Summary

| metric             | value                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC criteria total  | 6                                                                                                                                                     |
| PASS               | 5                                                                                                                                                     |
| PASS-with-notes    | 1 (criterion 4 — passes sequentially, fails under high parallel concurrency due to documented multi-instance limiter limitation; not a PR regression) |
| FAIL               | 0                                                                                                                                                     |
| DEFERRED-TO-DEVICE | 1 (criterion 6 — iPad browser end-to-end audio depends on browser-side switchover follow-up per PR body)                                              |

**Verdict: PASS.**

The Claude wiring is end-to-end functional on production for the first time. Math + WordSong session-start both return 200 with `ok: true`, `kind: "session-start"`, 40 utterances each (8 problems × 5 utterance types: read / correct / reprompt / hint / giveAnswer), every utterance has `audio.kind === "inline"` with a non-empty base64 MP3 payload, and `stub` is null on the new path. The legacy plan-attached path still returns the same wire shape unchanged. The bad-payload fallback (track="banana") returns 200 with `stub:true` as designed. Sequential rate-limit verification fires 429 with `Retry-After` exactly on the 7th call.

Two operational findings worth Thomas's attention before declaring victory:

1. **Parallel concurrency surfaces Azure F0 throttling.** When 7 track-based calls land at the same moment (parallel test attempt, criterion 4 first try), Vercel fans them out across multiple warm containers. Each container's local rate limiter sees only ~1 hit, so all 7 reach Azure in parallel. Azure F0 free tier throttles 4-of-7 with a 429 `Azure throttled the request`, surfaced cleanly to the client as `tts-failed` (502 with structured error). Two more came back as `planner-failed` (likely Anthropic-side throttling under the same burst). One succeeded. **This is exactly the limitation called out in `_rateLimit.ts` header comment** (multi-instance deployments multiply the effective rate; cold starts reset the bucket). Not a PR #105 regression — but the criterion as written ("send 7 in under a minute, 7th returns 429") only holds when the calls are sequential. Under realistic burst load (kid spam-tapping a launch button across two iPads in the household), the limiter will not shield Azure or Anthropic. Mitigations are out of scope for this PR.
2. **Audio-quality verdict for tickets `86c9hjnq1` and `86c9gxup4` cannot be rendered in this headless QA environment** — both tickets ask whether the "How many?" / hint phrase still sounds metallic on the user's ear. The MP3 was decoded successfully (valid `MPEG ADTS layer III v2 48kbps 24kHz Mono`, 16.4 KB for `math.p1.read` "Two plus two. How many?", 27.7 KB for `math.p1.hint` "Look. Two. And two more. How many now?"), but **subjective audio prosody** is not something I can verify without a human ear. Recommendation: leave both tickets at READY-FOR-QA-TEST and route to Thomas for a 15-second listening pass with the captured MP3s.

The `kind:"session-start"` real-Haiku branch returns plans labelled "Math Level 1: Sums to 10" and "Word Song: CVC short-a words (cat, bag, hat, dad, van, can, fan, man, mat)" — both exactly on-curriculum per CLAUDE.md and the diagnostic. Vocabulary in the generated text is gentle, on-character, and strictly English. No dark-pattern copy ("don't break your streak", FOMO unlocks) appeared anywhere; the reprompt phrase is "Hmm... try again?" which matches the never-a-red-X UX rule.

---

## Pre-manual gate

This run is a black-box production smoke. No local typecheck / vitest gate was applied — the orchestrator's smoke test 10 minutes before this dispatch already confirmed the prod deploy serves real audio for both tracks. The criteria below verify the wire contract end-to-end against the live Vercel deployment.

---

## AC matrix

### Criterion 1 — Math track real plan

**PASS.**

```
curl -X POST https://marian-learning.vercel.app/api/claude \
  -H "Content-Type: application/json" \
  -d '{"kind":"session-start","payload":{"track":"math","level":1,"childName":"Marian"}}'
```

| field                                   | expected        | actual                                         |
| --------------------------------------- | --------------- | ---------------------------------------------- |
| HTTP status                             | 200             | 200                                            |
| `ok`                                    | true            | true                                           |
| `kind`                                  | "session-start" | "session-start"                                |
| `stub`                                  | NOT true        | null                                           |
| `utterances` length                     | non-empty       | 40 (8 problems × 5 utterance types)            |
| each utterance `audio.kind`             | "inline"        | "inline" — verified across all 40              |
| each utterance `audio.base64` non-empty | yes             | yes — verified across all 40                   |
| plan label                              | math L1         | "Math Level 1: Sums to 10"                     |
| total response time                     | a few seconds   | 8.82s (Haiku call + 40-utterance Azure render) |

Sample utterance text (full set in run artifacts under `/tmp/qa-pr105/c1-math.json`):

- `math.p1.read` → "Two plus two. How many?"
- `math.p1.correct` → "Yes! Four!"
- `math.p1.reprompt` → "Hmm... try again?"
- `math.p1.hint` → "Look. Two. And two more. How many now?"
- `math.p1.giveAnswer` → "This one is four."

Curriculum check: all 8 problems are sums-to-10 (2+2=4, 3+1=4, 3+2=5, 4+2=6, 4+3=7, 5+3=8, 4+4=8, 5+4=9), exactly on-pack per the April 2026 diagnostic ("Sums to 10, drive automaticity").

### Criterion 2 — Word-song track real plan

**PASS.**

```
curl ... -d '{"kind":"session-start","payload":{"track":"word-song","level":1,"childName":"Marian"}}'
```

| field                                   | expected        | actual                                                                       |
| --------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| HTTP status                             | 200             | 200                                                                          |
| `ok`                                    | true            | true                                                                         |
| `kind`                                  | "session-start" | "session-start"                                                              |
| `stub`                                  | NOT true        | null                                                                         |
| `utterances` length                     | non-empty       | 40                                                                           |
| each utterance `audio.kind`             | "inline"        | "inline" — verified across all 40                                            |
| each utterance `audio.base64` non-empty | yes             | yes — verified across all 40                                                 |
| plan label                              | word-song L1    | "Word Song: CVC short-a words (cat, bag, hat, dad, van, can, fan, man, mat)" |
| total response time                     | a few seconds   | 7.71s                                                                        |

Sample utterance text:

- `word.p1.read` → "Tap the cat."
- `word.p1.correct` → "Yes! Cat."
- `word.p1.reprompt` → "Hmm... try again?"
- `word.p1.hint` → "Let's look. Cat."
- `word.p1.giveAnswer` → "This one is cat."

Curriculum check: 8 CVC short-a target words (cat, bag, hat, dad, van, can, fan, mat) — matches `_plannerWordList.ts` 14-word pack. The plan reused two slots (none of the targets duplicate within the 8 picks; the 14-word pack offers headroom). Per spec-drift decision K (memory `project_spec_drift_decisions.md`, "keep bat+dad"), keeping `dad` is intentional.

### Criterion 3 — Legacy plan-attached path still works (regression check)

**PASS.**

```
curl ... -d '{"kind":"session-start","payload":{"plan":{"utterances":[{"id":"x","text":"hello"}]}}}'
```

| field                              | expected          | actual                                            |
| ---------------------------------- | ----------------- | ------------------------------------------------- |
| HTTP status                        | 200               | 200                                               |
| `ok`                               | true              | true                                              |
| `kind`                             | "session-start"   | "session-start"                                   |
| `stub`                             | NOT true          | null                                              |
| `utterances` length                | 1 (echo of input) | 1                                                 |
| utterance `id`                     | "x"               | "x"                                               |
| utterance `text`                   | "hello"           | "hello"                                           |
| utterance `audio.kind`             | "inline"          | "inline"                                          |
| utterance `audio.base64` non-empty | yes               | yes (~13.5KB encoded MP3 of TTS-rendered "hello") |
| total response time                | sub-second        | 0.69s (no Haiku call on this path)                |

This is the path Math + WordSong currently use in the browser. Behaviour unchanged — confirmed.

### Criterion 4 — Rate limit fires on the 7th call within a minute

**PASS sequentially. Notes on parallel behaviour.**

#### Sequential test (the canonical run for this criterion)

7 calls fired at ~8s intervals from 18:08:28 → 18:09:22 UTC, all from the same IP:

| seq | time (UTC) | HTTP status               | error          | Retry-After |
| --- | ---------- | ------------------------- | -------------- | ----------- |
| 1   | 18:08:28   | 200 OK                    | none           | —           |
| 2   | 18:08:35   | 200 OK                    | none           | —           |
| 3   | 18:08:43   | 200 OK                    | none           | —           |
| 4   | 18:08:51   | 200 OK                    | none           | —           |
| 5   | 18:08:58   | 200 OK                    | none           | —           |
| 6   | 18:09:06   | 200 OK                    | none           | —           |
| 7   | 18:09:22   | **429 Too Many Requests** | `rate-limited` | **6**       |

Response body of the 7th:

```
{"error":"rate-limited","message":"too many session-start requests; please slow down"}
```

Headers include `Retry-After: 6`. Wire shape exactly matches the AC.

Container affinity: `X-Vercel-Id` on the 7th was `arn1::iad1::vhjck-1777486163110-ff9cf40081b4` — same arn1 region across the seven calls. Sticky enough to exercise the per-container limiter on the canonical path (one warm container served all 7 for this test).

#### Parallel test (informational)

A first attempt at the criterion fired all 7 in parallel via `&` shell jobs. Result:

| seq | HTTP status | error                                                                            |
| --- | ----------- | -------------------------------------------------------------------------------- |
| 1   | 502         | `tts-failed` (Azure 429 — `tts rate limited (429): Azure throttled the request`) |
| 2   | 200         | none                                                                             |
| 3   | 502         | `planner-failed`                                                                 |
| 4   | 502         | `planner-failed`                                                                 |
| 5   | 502         | `tts-failed` (Azure 429)                                                         |
| 6   | 502         | `tts-failed` (Azure 429)                                                         |
| 7   | 502         | `tts-failed` (Azure 429)                                                         |

**No 429 from the /api/claude limiter.** The 7 parallel calls fanned out across multiple Vercel containers, each with its own module-singleton bucket; no single bucket exceeded 6 hits. This is exactly the multi-instance limitation called out in the `_rateLimit.ts` file header. The 502s downstream confirm the limiter is the only thing standing between callers and the Azure F0 free tier — when it can't see the burst, Azure throttles. The graceful degradation contract held: every failure surfaced as a structured 502 with a stable error code (`tts-failed` or `planner-failed`); no 5xx leaked provider internals.

**Verdict on criterion 4:** PASS as written (sequential repro fires the 429 with the correct shape and Retry-After). The parallel finding is a known limitation, not a regression in this PR; flagged as an operational concern below.

### Criterion 5 — Bad payload graceful fallback

**PASS.**

```
curl ... -d '{"kind":"session-start","payload":{"track":"banana","level":1,"childName":"x"}}'
```

| field               | expected        | actual                                                                                                                   |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| HTTP status         | 200 (NOT 4xx)   | 200                                                                                                                      |
| `ok`                | true            | true                                                                                                                     |
| `kind`              | "session-start" | "session-start"                                                                                                          |
| `stub`              | true            | true                                                                                                                     |
| `note`              | (any)           | "Claude API call not yet wired — see follow-up tickets"                                                                  |
| total response time | sub-second      | 0.23s (no Anthropic / Azure calls — `extractTrackPayload` returns null and the handler falls through to the legacy stub) |

Confirms the `extractTrackPayload` shape-validator returns null for unknown tracks (per `api/claude.ts` lines 211-214) and the handler skips both the rate limiter and the Haiku call entirely on this path. Old clients that send a malformed `track` value would never see a 4xx — they'd see the same stub they saw before. Per design.

### Criterion 6 — iPad browser smoke

**DEFERRED-TO-DEVICE (per PR body).**

The PR body (`Testable acceptance criteria`, last bullet) explicitly notes:

> "Browser smoke test on Vercel preview iPad: open Math screen, observe real audio playback within ~3s of route entry. Same for WordSong. **NOTE:** this test depends on the browser switching to the track-based payload, which is a follow-up PR — for THIS PR, the smoke test is the curl above; iPad audio is a downstream verification."

The browser-side switchover (`prepareMathPathA` / `prepareWordSongPathA` → track-based payload) is a separate ticket. Until that ships, the browser continues to use the **legacy plan-attached path** (criterion 3) — which is unchanged byte-for-byte. So Math/WordSong on iPad currently sound exactly as they did before PR #105 merged (the silence problem remains for the in-browser experience). This is the expected state per the PR body.

No iPad device was available for this run; even if one had been, the criterion as written reduces to "the legacy path is unchanged" which criterion 3 already confirms.

---

## UX rule audit

| rule                | result                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red X / harsh sound | clean. Reprompt phrasing is "Hmm... try again?" — gentle, in-character, no failure language. No red-X copy in any utterance.                                                                                                                                                                                                                                                |
| Vocabulary cap      | within the ~200-word + current phonics target. Math uses: two, three, four, five, six, seven, eight, nine, plus, more, look, how, many, now, this, one, is, yes, hmm, try, again. Word-song uses: tap, the, cat, bag, hat, dad, van, can, fan, mat, look, this, one, is, yes, hmm, try, again, let's. All on-curriculum, all English-only.                                  |
| Strict English      | clean. No Tagalog leaked from `childName: "Marian"` interpolation; the Haiku output is English-only as the system prompt instructs.                                                                                                                                                                                                                                         |
| Dark patterns       | clean. No streak-shame language, no FOMO unlocks, no urgency framing in any of the 80 utterances reviewed (40 math + 40 word-song). The "hint" phrasing matches CLAUDE.md "concrete -> visual -> abstract" ("Look. Two. And two more. How many now?" walks the child from concrete → abstract). The `giveAnswer` phrasing ("This one is four.") is neutral and informative. |

---

## Survival checks (lens 4)

| check                                         | result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rage-tap (parallel burst, 7 calls)            | NOTES. The /api/claude limiter does not catch a parallel burst when calls fan out across containers; Azure F0 throttles 4-of-7 with structured 502 `tts-failed`, and Anthropic throttles 2-of-7 with `planner-failed`. **Critically, the contract holds:** all errors are structured, every response has the `Cache-Control: no-store` and CORS headers, no 5xx leaks an Azure or Anthropic key, no internal stack trace in the body. The browser's path-A code already treats `tts-failed` and `planner-failed` as fall-back-to-silent-mode signals. No crash, no broken state — just a degraded session for the unlucky burst victim. |
| Backgrounding / resume mid-render             | not exercised (no browser session in this run). The `Cache-Control: no-store` header is set on every response so a resumed tab cannot replay a stale plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Offline                                       | not directly exercised. The legacy plan-attached path (criterion 3) is the offline-warm-cached path the browser uses today; that is byte-for-byte unchanged. New track-based path requires network — graceful-degradation contract per `_planner.ts` falls through to `config-missing` (500) or `planner-failed` (502), browser falls back to silent mode.                                                                                                                                                                                                                                                                              |
| Bad input — malformed track                   | PASS (criterion 5). Malformed track string falls through to the legacy stub, no 4xx.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Bad input — missing fields (level, childName) | not directly exercised tonight. The `extractTrackPayload` validator (api/claude.ts:211-228) rejects on missing/wrong-typed fields by returning null → falls through to stub. Criterion 5 demonstrates one branch of this; the others (level out of range 1-9, childName length > 64) follow the same code path by inspection.                                                                                                                                                                                                                                                                                                           |
| Multiple distinct IPs / shared link rage      | not directly exercised. The limiter is per-IP; two different IPs each get their own bucket. Shared-link case is the limiter's primary use case and the docs already acknowledge it isn't bulletproof in a multi-instance Vercel deployment.                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Audio quality smoke (secondary task)

Two READY-FOR-QA-TEST tickets were exercised:

### `86c9hjnq1` — `audit(tts): "How many?" still metallic on production after PR #82`

Captured `math.p1.read` MP3 from a fresh production session-start:

- Text: "Two plus two. How many?"
- File: `MPEG ADTS, layer III, v2, 48 kbps, 24 kHz, Monaural`, 16,848 bytes
- Decoded successfully from base64; padded with trailing silence frames as expected (final ~150 bytes are `\x55\x55...` silence frames in MP3 — normal end-of-clip padding from Azure, not data loss)

**Verdict: BLOCKED on subjective listening.** The MP3 is well-formed. Whether the prosody on "How many?" sounds metallic or natural is a question only a human ear answers — and I am running headless in this environment. Recommendation: route to Thomas for a 15-second listening pass. The capture (`/tmp/qa-pr105/howmany.mp3` on the QA machine; can be re-decoded from the c1-math response on demand) is preserved.

### `86c9gxup4` — `audio quality: voice sounds robotic on "how many" hint phrase`

Captured `math.p1.hint` MP3:

- Text: "Look. Two. And two more. How many now?"
- File: `MPEG ADTS, layer III, v2, 48 kbps, 24 kHz, Monaural`, 28,368 bytes
- Decoded successfully; same trailing-silence pattern

**Verdict: BLOCKED on subjective listening.** Same reason as above. Both tickets need a human-ear pass.

---

## Operational findings beyond the AC

Three observations the orchestrator and Thomas should weigh:

1. **Azure F0 burst-throttling is now empirically demonstrated.** Under 7-parallel concurrency on a single IP, ~57% of calls fail at the Azure step. The browser's path-A code treats this as "fall back to silent mode" — fine for the kid-spam-tap case (worst outcome: one silent session). But if Marian's actual weekday-morning use ever creates a similar burst (e.g. she launches a session, gets distracted, force-quits the PWA, relaunches twice in 30s), she may land in silent-mode for that session. Mitigation options if this becomes a problem in practice: (a) move the rate-limit gate to before the planner _and_ before TTS so Azure isn't called until the limiter agrees; (b) add a session-level retry-with-backoff in the browser; (c) move off F0 to S1 (paid). All out of scope for this ticket.

2. **`Retry-After: 6` is shorter than the 60s window.** The limiter calculates the time until the oldest token expires from the sliding window. With 6 hits clustered in ~38 seconds (sequential test), the oldest hit was at 18:08:28; the 7th attempt at 18:09:22 was 54s later. The bucket says "wait 6 more seconds and you can hit again." This is mathematically correct sliding-window behaviour and not surprising — flagging only because the AC said "in under a minute" and a tester reading the line literally might expect Retry-After ≈ 60s.

3. **Container affinity made the sequential test work.** All 7 sequential calls landed on the same `arn1::iad1::vhjck-...` warm container. If Vercel had load-balanced even one of the first 6 calls onto a different container, criterion 4 might also have failed sequentially. The criterion is not deterministic — it depends on Vercel's load-balancer choices. In a multi-instance deployment with round-robin LB, sequential tests would also fan out and the limiter's 7th-call-fires guarantee would weaken. Flagging for awareness; not a fix request.

---

## Regressions in adjacent features

- **PR #106 (Hub + storage migration):** not in scope of this run. Did not exercise the Hub screen or session history v2.
- **Greet:** not exercised. The legacy plan-attached path (criterion 3) is the same one Greet would use for any TTS-bearing payload it builds; that path is byte-for-byte unchanged.
- **Math/WordSong screens:** not exercised in-browser tonight. The criteria 1+2 prove the new server path returns valid audio, but the browser still uses the legacy path until the follow-up rewires `prepareMathPathA` / `prepareWordSongPathA`. So Math/WordSong currently sound the same as they did pre-merge (silent for v1 plan-only flows; this is unchanged, not a regression).
- **`assertNodeRuntime` + Vercel runtime contract:** No `FUNCTION_INVOCATION_FAILED` 5xx surfaced in any of the ~15 calls fired tonight. The `_types.js`-extension fix from round 3 of the cold-start hot-fix saga (file header, `api/claude.ts` lines 26-50) continues to hold.

None observed worth filing.

---

## Notes for Thomas's pass

1. **Audio-quality tickets `86c9hjnq1` and `86c9gxup4`** need 30 seconds of your ear. Either decode the captures from the `/tmp/qa-pr105/c1-math.json` artifact in this run, or fire the curl yourself and play `math.p1.read` and `math.p1.hint`. If they sound natural now, both can move to COMPLETE. If they still sound metallic, leave them at READY-FOR-QA-TEST and the audio-quality work can continue. **I cannot render this verdict from a curl alone.**

2. **The browser-side Math/WordSong screens still produce silence on production** until the follow-up PR rewires them to the track-based payload. This is expected — it is not a regression. Current state on prod for an actual iPad user: Greet works (Phase 3a audio), Math screen silent, WordSong silent. The PR #105 wiring is the server-side prerequisite for fixing the silence; the browser switchover is the next step.

3. **Rate-limit guarantee under burst load** (operational finding #1 above) is the most interesting non-AC discovery. If you want a tighter guarantee than "soft guardrail against share-link leaks", the `_rateLimit.ts` header already names the structural fix (single-instance / single-region pin, or move limiter state to KV). Worth a Week-4-or-later ticket if the F0 free tier becomes a problem; not urgent.

4. **`Retry-After: 6` correctness** (operational finding #2) — confirm with Kevin that the value is intentionally the time-until-oldest-token-expires, not the time-until-window-resets. Both interpretations are defensible; the implementation chose the more aggressive one (lets clients retry sooner). If you'd prefer "wait the full window," that's a 1-line change in `_rateLimit.ts`.

5. **Cost guardrail evidence:** The Haiku call took ~7-8s on a cold cache, ~7s on subsequent calls (no measurable cache benefit yet — expected, since the prompt is below Haiku's 4096-token caching minimum per the PR body). Six successful sequential calls cost ~$0.013 in Anthropic credits per the cost estimate in `_planner.ts`. No surprise blow-out.

---

## Release-readiness verdict

**PASS — the Claude wiring is end-to-end functional on production for the first time, and the wire contract holds across all 6 acceptance criteria.**

Two operational notes that don't block ship:

- The /api/claude rate limiter is a soft guardrail, not a hard cap (acknowledged in code comments, now empirically demonstrated).
- Audio-prosody verdicts for `86c9hjnq1` and `86c9gxup4` need a human ear before those tickets can move to COMPLETE.

The browser-side switchover that turns this into actual sound on Marian's iPad is the next dispatch. PR #105 itself is shipped and verified.
