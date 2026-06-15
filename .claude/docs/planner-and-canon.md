# Planner and canon backend

What this doc covers: the Vercel serverless backend under `MarianLearning/api/` — the `/api/claude` request handler, the Haiku-driven session planner, the Azure TTS render pipeline, the build-time canon prebake, the rate limiter, the in-memory session cache, and the Anthropic billing surface that ties them together. Browser-side audio playback (Howler, IndexedDB caching, Path A wiring) lives in `audio-system.md` and is cited here only as the consumer of the response shape.

## Vercel functions layout

Every file in `MarianLearning/api/` is a serverless function or its private helper. Vercel routes `api/<name>.ts` to `/api/<name>`; files prefixed with `_` are private modules (Vercel does not expose them as HTTP routes — see [api/\_types.ts:7](MarianLearning/api/_types.ts#L7)).

Active routes:

- **`/api/claude`** — the only HTTP entrypoint ([api/claude.ts](MarianLearning/api/claude.ts)). Handles `session-start` (renders TTS for a supplied plan OR generates a new plan via Haiku + renders TTS), and stubs `stumble-explanation` + `session-end`.

Private helpers:

- [api/\_types.ts](MarianLearning/api/_types.ts) — wire shapes shared between server and browser
- [api/\_planner.ts](MarianLearning/api/_planner.ts) — Haiku call + JSON parsing
- [api/\_plannerWordList.ts](MarianLearning/api/_plannerWordList.ts) — Word Song target/distractor/novel-probe word lists
- [api/\_session.ts](MarianLearning/api/_session.ts) — fan-out TTS render orchestration
- [api/\_tts.ts](MarianLearning/api/_tts.ts) — Azure Speech REST client + SSML builder
- [api/\_canon.ts](MarianLearning/api/_canon.ts) — prebuilt canon read API
- [api/\_rateLimit.ts](MarianLearning/api/_rateLimit.ts) — per-IP token bucket
- [api/\_sessionCache.ts](MarianLearning/api/_sessionCache.ts) — in-memory TTL cache

### Runtime constraint

**Never set `export const config = { runtime: 'nodejs' }` in `/api/*.ts`.** PR #34 attempted this; production 500'd cold-start. The function runs on Vercel's Node runtime by default. Adding the export breaks the dispatch shape.

The actual cold-start fix from PR #34 round 3 ([api/claude.ts:115](MarianLearning/api/claude.ts#L115)) is a runtime assertion: `assertNodeRuntime()` throws at module load if `globalThis.process.versions.node` is missing. Caveat — this only catches hybrid runtimes; on a pure Edge runtime, `Buffer`/`process.env` accesses inside `_tts.ts` would fail before this check ever ran. The assertion exists as a defensive marker.

The `default export` is `{ fetch: handler }` — NOT a bare async function. This shape forces `@vercel/node` to route the Web `Request`/`Response` codepath instead of the legacy `(IncomingMessage, ServerResponse)` fallback. See `project_vercel_runtime_config.md` memory.

### ESM resolution constraint

With `"type": "module"` in package.json, Vercel's `@vercel/node` builder emits ESM, and Node ESM strict-resolution requires explicit `.js` extensions on relative imports. Every `api/*.ts` file imports siblings as `'./_types.js'` etc., never `'./_types'`. TypeScript with `moduleResolution: "bundler"` resolves the `.js` suffix back to the `.ts` source for type-checking; vitest tolerates it via Vite's bundler resolution. See PR #34 round 3 commentary at [api/claude.ts:26](MarianLearning/api/claude.ts#L26).

## Request handler — `/api/claude`

[api/claude.ts](MarianLearning/api/claude.ts) is the single HTTP entrypoint. The exported `handler(request, overrides?)` ([api/claude.ts:444](MarianLearning/api/claude.ts#L444)) is what tests import directly; production hits `default.fetch`.

### Request shape

`POST /api/claude` with body `{ kind, payload }`:

- `kind: 'session-start'` — three sub-branches:
  1. `payload.plan` present → render TTS for the supplied plan (legacy v1 client path; bypasses rate limit + canon)
  2. `payload.track` present → call Haiku to generate a plan, then render TTS (the live track-based path)
  3. neither → legacy stub `{ ok: true, kind, stub: true }`
- `kind: 'stumble-explanation'` — stub today; ticket pending
- `kind: 'session-end'` — stub today; ticket pending

`isClaudeRequest` ([api/\_types.ts:115](MarianLearning/api/_types.ts#L115)) is the strict input validator. Strict-rejects extra-typed but malformed bodies.

### Track-based payload

[api/claude.ts:193](MarianLearning/api/claude.ts#L193) — `TrackPayload`:

```ts
{ track: 'math' | 'word-song',
  level: number,        // 1..9 integer
  childName: string,    // 1..64 chars
  progress?: {
    focusNode?: string,           // optional skill-tree node hint
    recentSuccessRate?: number | null,  // 0..1 or null
    isGraduationSession?: boolean,      // generalization probe
    leitner?: { a: number; b: number; op: '+' | '-' | '*'; box: 1|2|3|4|5 }[],
    slowFacts?: { fact: { a: number; b: number; op: '+' | '-' | '*' }; attempts: number; correctRate: number; medianLatencyMs: number }[],
  } }
```

`extractTrackPayload` ([api/claude.ts:246](MarianLearning/api/claude.ts#L246)) soft-validates. Malformed sub-fields under `progress` are silently dropped (the planner falls back); cross-track `focusNode` (e.g. `track: 'math'` + `focusNode: 'cvc-words'`) is hard-rejected by the planner downstream.

**`leitner` (M4 — ticket 86c9pwgc8)**: optional flat list of `{a, b, op, box}` ready for the planner directive. Browser ships only when non-empty (`App.tsx#readProgressHintsForTrack` gates on `progress.mathFactsLeitner` having ≥1 item). Server validates via `parseLeitnerHint`: each item must have integer `a`/`b` in `[0, 99]`, `op ∈ {+,-,*}`, integer `box` in `[1, 5]`; any malformed item drops the whole array (better to under-direct than skew priority). Length cap 60. **Non-empty leitner BYPASSES both canon and the in-memory cache** — same posture as `isGraduationSession`, because canon is keyed on `(track, level, focusNode)` only and a cached non-Leitner-aware plan would defeat the box-1 weighting. Empty / absent leitner stays on the canon-served free path.

**`slowFacts` (M4.x — accurate-but-slow surfacing)**: optional flat list of facts Marian answers correctly but slowly (≥80% correct, median latency ≥5 s — the finger-counting canary per Dave's research). Derived browser-side by `buildSlowFactSessionHint(progress)` in [`src/lib/progress/slowFacts.ts`](MarianLearning/src/lib/progress/slowFacts.ts) by walking session history (computed on-read, not stored). Browser ships only when non-empty; `App.tsx#readProgressHintsForTrack` maps empty result to `undefined` so the wire field is omitted entirely. Each item carries `{fact, attempts, correctRate, medianLatencyMs}` — verbose by design so the planner directive composes human-readable bullet copy without re-deriving stats. **Non-empty `slowFacts` BYPASSES both canon and the in-memory cache** — same posture as `leitner` and `isGraduationSession`. Leitner and slow-fact directives can co-fire and are mutually exclusive by predicate construction (Leitner targets low-correctness box-1 facts; slow-fact targets ≥80%-correct-but-slow facts). Full derivation logic + threshold constants: `progress-and-persistence.md` § "Slow-fact directive (M4.x — accurate-but-slow surfacing)".

### Track-based branch order of operations

Inside the `session-start` + `track` branch, the handler runs in this order ([api/claude.ts:543](MarianLearning/api/claude.ts#L543)):

1. **Canon lookup** — [api/\_canon.ts](MarianLearning/api/_canon.ts) `getCanonEntry({ track, level, focusNode })`. Hit short-circuits the entire pipeline; bills nothing. Skipped when `isGraduationSession === true` (graduation runs need fresh planner output) OR `leitner` is non-empty (M4 ticket 86c9pwgc8) OR `slowFacts` is non-empty (M4.x) — both directives require fresh planner output.
2. **In-memory session cache** — [api/\_sessionCache.ts](MarianLearning/api/_sessionCache.ts) keyed on `(track | level | childName | focusNode)`. 5-minute TTL, max 16 entries. Skipped when `isGraduationSession === true` OR `leitner` is non-empty OR `slowFacts` is non-empty.
3. **Rate limit gate** — [api/\_rateLimit.ts](MarianLearning/api/_rateLimit.ts), per-IP, 6 requests / 60 s. Returns 429 with `Retry-After` header on block.
4. **`generateSessionStartResponse`** — combined Haiku planner + Azure TTS render ([api/\_planner.ts:410](MarianLearning/api/_planner.ts#L410)). Successful response is cached (skipped for graduation, Leitner-active, or slowFacts-active), then returned.

Error mapping:

- `PlannerError` with `code: 'config-missing'` → 500 `config-missing`
- Other `PlannerError` → 502 `planner-failed`
- Other exception (TTS pipeline bug, base64 encoder, etc.) → 502 `tts-failed`

All 5xx responses log `[api/claude] planner-failed` or `[api/claude] tts-failed` with structured `{ message, stack }` payloads to Vercel logs. Never logs the request body, payload, or provider headers.

### CORS

`buildAllowedOrigins()` ([api/claude.ts:135](MarianLearning/api/claude.ts#L135)) — origins are `http://localhost:5173` + `https://${VERCEL_URL}` + comma-separated `CLAUDE_API_EXTRA_ORIGINS`. `Origin` header must match an allowed origin or no `Access-Control-Allow-Origin` is set.

## Session planner

[api/\_planner.ts](MarianLearning/api/_planner.ts) is the one-call-per-session-start surface for Haiku.

### Model

`PLANNER_MODEL_ID = 'claude-haiku-4-5-20251001'` ([\_planner.ts:236](MarianLearning/api/_planner.ts#L236)) — pinned, never `claude-haiku-latest`. Model swaps are deliberate code changes per CLAUDE.md and `feedback_run_vitest_before_merge.md`.

`max_tokens: 4000` ([\_planner.ts:302](MarianLearning/api/_planner.ts#L302)) — sized for the worst case (8 problems × 5 utterances + 19 Session-End utterances ≈ 59 utterances; `two-digit-addsub` reads spell out two-digit numbers). 2000 was shown to truncate by ticket `86c9kwhbc`.

### Prompt structure

System prompt is two cached blocks ([\_planner.ts:488](MarianLearning/api/_planner.ts#L488)):

1. `SYSTEM_PREAMBLE` ([\_planner.ts:626](MarianLearning/api/_planner.ts#L626)) — Marian profile, output JSON contract, Session-End utterance contract (1 opener + 11 recap + 6 streak + 1 goodbye = 19 entries, plus 8 × 5 problem utterances = 59 total).
2. `MATH_TRACK_GUIDE` ([\_planner.ts:662](MarianLearning/api/_planner.ts#L662)) or `WORD_SONG_TRACK_GUIDE` ([\_planner.ts:708](MarianLearning/api/_planner.ts#L708)) — track-specific curriculum and per-utterance templates. Carries `cache_control: { type: 'ephemeral' }`.

Caveat at [\_planner.ts:24](MarianLearning/api/_planner.ts#L24): the prompt is ~600 tokens, well below Haiku 4.5's 4096-token minimum cacheable prefix, so the cache marker is a no-op today. It's left as a forward-compatible breakpoint for when curriculum levels 2–9 push the prompt past 4096 tokens.

The user message is built per-call by `buildUserMessage` ([\_planner.ts:552](MarianLearning/api/_planner.ts#L552)) — it carries the volatile inputs (track label, level, focus node, recent score line, optional graduation directive, escaped child name) and the "JSON only — no surrounding prose, no markdown fences" instruction.

#### MATH_TRACK_GUIDE insertion-order discipline

**Invariant:** focus-node directive blocks inside `MATH_TRACK_GUIDE` are ordered to match `MATH_NODES_IN_ORDER` (the project's skill-tree ordering, declared in [`src/lib/progress/focusNode.ts`](MarianLearning/src/lib/progress/focusNode.ts)). The same convention holds for `WORD_SONG_TRACK_GUIDE` against `WORD_SONG_NODES_IN_ORDER`.

**Why:** the directive body is long (~2-3000 lines as of Wave 6) and reviewers scan it locally — they jump to the focus-node-under-review and read the surrounding directive blocks for context (cap rules, band tags, drift-guards). Tree-order grouping lets readers locate any focus-node's directive in O(skill-tree-proximity) time. Append-at-end would force O(filesize) navigation for every review and make the surrounding-context reading pattern impossible.

**Rule when adding a new focus-node directive:** insert the new block **between its tree-order siblings**, NOT at the end of `MATH_TRACK_GUIDE`. There is no automated guard — it is a manual authoring + reviewer discipline, and a misordered insert is invisible to typecheck / canon-lint / composition-lint. Reviewers should spot-check the insertion point against `MATH_NODES_IN_ORDER` when reviewing any directive-addition PR.

**Concrete reference:** Dave's Wave 6A directive for `two-digit-addsub-with-regroup` (PR #314, 2026-05-23) was correctly inserted at `api/_planner.ts` line ~1306, between the `two-digit-addsub-no-regroup` directive block (~line 1188) and the `skip-counting` directive block (~line 1408) — matching the skill-tree ordering `... → two-digit-addsub-no-regroup → two-digit-addsub-with-regroup → skip-counting → ...`.

### Focus-node taxonomy

`VALID_MATH_FOCUS_NODES` ([\_planner.ts:120](MarianLearning/api/_planner.ts#L120)) — 10 entries:

```
number-recog, add-to-10, add-to-20, sub-to-10, sub-to-20,
two-digit-addsub, skip-counting, mult-2-5-10, mult-3-4, mult-6-9
```

`VALID_WORD_SONG_FOCUS_NODES` ([\_planner.ts:133](MarianLearning/api/_planner.ts#L133)) — 8 entries:

```
letter-names, letter-sounds, blending-cv, cvc-words,
cvc-words-short-o, digraphs, sight-words, simple-sentences
```

`WORD_SONG_FIRST_CLASS_FOCUS_NODES` ([\_planner.ts:520](MarianLearning/api/_planner.ts#L520)) — the subset the planner emits first-class content for:

```
blending-cv, cvc-words, cvc-words-short-o, digraphs-sh
```

**3-place sync contract** — adding a new word-song tier to first-class planner support requires three updates that must move together in the same PR: (1) `WORD_SONG_FIRST_CLASS_FOCUS_NODES` in `api/_planner.ts`, (2) the `WORD_SONG_FOCUS_NODES` iteration set in `scripts/generateSessionCanon.ts` (`activeCombos()`), and (3) the combo-count assertion in `scripts/generateSessionCanon.test.ts`. Missing any one either silently skips the new canon combo at runtime or breaks the canon-count regression. `digraphs-sh` shipped first-class post-2026-05-14 (PR #220 wordPack + #223 planner/canon).

`effectiveFocusNode` — for word-song, valid-but-untuned nodes fall back to `blending-cv` content as a stub. As of 2026-06-13 the only stub-fallback node is the bare `digraphs` generic parent: `letter-sounds`, `sight-words`, and `simple-sentences` are all in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` ([\_planner.ts:761](MarianLearning/api/_planner.ts#L761)) and emit first-class content (the older "untuned stub" framing for those three is stale). Math honours caller-supplied focusNode verbatim. Cross-track focus nodes are hard-rejected upstream by `generateSessionPlan`.

**First-class membership is load-bearing for AUDIO correctness, not just canon generation (Devon NOF, PR #423).** The `effectiveFocusNode → tierFilter` chain feeds `substituteSentenceGap` ([\_tts.ts:951](MarianLearning/api/_tts.ts#L951)), which replaces the `___` cloze gap token with the spoken word "blank" — but ONLY when `tierFilter === 'simple-sentences'` (it early-returns the text unchanged otherwise). If `simple-sentences` were absent from `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, the bake would route to `blending-cv`, `tierFilter` would be `'blending-cv'`, and the substitution would never fire — Azure would voice the literal underscores or silence at the gap, with **no visible error** anywhere in the pipeline. This extends the silent-demote trap ([[project_content_tier_ships_6_surfaces]]) into the audio domain. **Rule:** when a tier's correct audio requires a TTS-time text transform keyed on `tierFilter` (a gap substitution, a tier-scoped phoneme/prosody override), verify the tier's focus node is in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` before treating the tier as shipped — canon-only membership is insufficient.

These lists are duplicated against `src/lib/progress/types.ts` because `api/` runs under a server-only tsconfig — pinning enforced by unit tests.

### Word lists

[api/\_plannerWordList.ts](MarianLearning/api/_plannerWordList.ts) lifts the embedded prompt copy out of the planner so the system prompt stays scannable:

- `WORD_SONG_TARGET_WORDS_FOR_PROMPT` — 14 short-a CVC words (`cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van`)
- `WORD_SONG_TARGET_WORDS_SHORT_O` — 8 short-o words (`dog, mop, log, pot, box, fox, mom, hot`), locked 2026-05-04
- `WORD_SONG_DISTRACTOR_HINTS` — rhyme-family clustering hints for distractor selection
- `WORD_SONG_NOVEL_PROBE_WORDS` — 4 novel short-a words (`nap, rat, map, tap`) used only on graduation sessions

Alignment contract: every word here MUST exist in `src/screens/WordSong/wordPack.ts` with `isTarget: true` plus a `TARGET_PAIRINGS` row. Drift would crash the chip render. Enforced by code review + smoke tests in `claude.test.ts` and `plannerRoundTrip.test.ts`.

### Wire shape is utterance-only — invariant

**The `PlannerPlan` wire shape carries only `{id, label, utterances: Array<{id, text}>}`.** It is **utterance-only by design**. Any planner directive of the form "tag each problem with X" must either:

1. **Bake X into the utterance text** as a soft narrative hint (e.g. the EASY/MEDIUM/HARD band tags inlined in the sub-to-10 FACT POOL are a hint to Haiku's compositional attention, never an emission), **OR**
2. **Propose a wire widening BEFORE the directive lands** — typed extension to `PlannerPlan` + `isPlannerPlan` validator + canon-adapter changes + screen-side adapter changes + parser test fixtures. ~150-200 LOC across 6 files plus a canon re-bake of all 10 tiers.

The deliberate utterance-only discipline keeps audio bytes + plan validation symmetric: every utterance has both validation-side metadata (id + text on `plan.utterances`) and audio-side payload (id + text + base64 on `utterances`); structured per-problem tags would break that symmetry and force a parallel validation path.

**Three incidents have surfaced this gap** (each a directive promising what the wire cannot carry — Haiku emits the field, the canon adapter / browser parser silently discards it):

- **Devon NOF #1 from PR #241** (sub-to-10 render-time fix). The `distractorClass` field on `MathProblem` was treated as planner-emitted; investigation showed it was always render-derived.
- **Kevin NOF #1 from PR #240** (sub-to-10 content). The DISTRACTOR-CLASS HINT block asked Haiku to tag each P4-P8 problem; emissions were ignored downstream.
- **The 2026-05-16 directive reword** (this rule's documentation prompt). The DISTRACTOR-CLASS HINT block was deleted; `Math.tsx`'s deterministic default at `Math.tsx:2559-2560` already handled the trap selection, and the prompt's attention budget could be spent on more load-bearing rules.

**Authoring check.** When writing a new directive, ask: _does this rule require Haiku to emit a per-problem field beyond `{id, text}` (or beyond the existing optional fields on `MathProblem` / `WordProblem` that are sourced from utterance parsing, e.g. `op` from the read template)?_ If yes, choose (1) or (2) above; do NOT write the rule as if the field is part of the wire.

**Drift-guard shape for these locks** (refined Kevin NOF #2 from PR #264, 2026-05-16 — Option A doc-coherence fix). The cheap lock is a planner-system-prompt drift-guard test, but its **shape depends on the regression class you're locking out**:

- **Header-shaped bans** stay simple: `expect(systemText).not.toContain('<UNIQUE BLOCK HEADER>')` — e.g. `'DISTRACTOR-CLASS HINT'`, `'GRADUATION SESSION'`, `'SLOW-FACT DIRECTIVE'`, `'LEITNER PRIORITY DIRECTIVE'`, `'SHORT-U FIRST-ENCOUNTER SCAFFOLDING'`. These are uniquely-shaped block titles that won't trip on documentary prose.
- **Name-shaped bans (JS identifiers) need instruction-anchored regex.** A bare `not.toContain('<fieldName>')` is over-broad: a future doc-coherence pass may legitimately name the field while making explicit it's NOT planner-emitted (e.g. Option A for `distractorClass`). Use anchors that target the failure mode — Haiku-instruction phrasing — directly:
  ```ts
  expect(systemText).not.toMatch(/emit\s+<fieldName>/i)
  expect(systemText).not.toMatch(/tag\s+each\s+problem\s+with\s+<fieldName>/i)
  expect(systemText).not.toMatch(/set\s+<fieldName>\s+(to|on)/i)
  expect(systemText).not.toMatch(/include\s+<fieldName>/i)
  ```
- **MAY-mention-MUST-qualify pattern** for fields the directive may legitimately reference as documentary explanation but not as emission instructions:
  ```ts
  if (systemText.includes('<fieldName>')) {
    expect(systemText).toMatch(/<fieldName>[^.]*<QUALIFIER>/i)
  }
  ```
  The `[^.]*` enforces same-sentence proximity to the qualifier (e.g. `RENDER-TIME`, `client-side`, `NOT planner-emitted`). This locks framing without forbidding the identifier.

Reference implementation: `api/_planner.test.ts` "the sub-to-10 directive does NOT instruct Haiku to emit distractorClass" test — grep by the test NAME, not line number; the file grows fast (block was at 3289-3332 post-PR #264, verified at 4035-4078 on 2026-06-11 during the W10.4 review). Pattern generalizes to any future render-time-only field added to `MathProblem` / `WordProblem` (e.g. hypothetical `distractorPool`, `distractorTier`). Same staleness caution applies to `scripts/compositionLint.ts` line refs: the sub-to-20 path binding moved 3893 → 4917-4921; the durable greps are the exported rule/function names (`SUB_TO_TWENTY_RULES`, `lintSubToTwentyComposition`, `resolveTierBinding`).

### Canon-lint scope is text-encoding hygiene ONLY — composition rules are bake-time-only

[`scripts/canonLint.ts`](MarianLearning/scripts/canonLint.ts) catches **text-encoding** failures only — non-ASCII codepoints (em-dash mojibake, unicode IPA), slash-IPA notation (`/p/-/ɪ/-/g/`), and angle-bracket SSML-like tokens. It is wired both at bake-time (in `bakeOne`, throws `CanonLintError`) and as a CI gate (`npm run canon:lint` against `public/canon/**/*.json`).

**Composition rules** (per-tier cap counts, pool membership, slot-band distribution, P1-P3 gentle-ramp constraints, dual-exposure bans, etc.) are enforced **ONLY by Haiku's self-checks at bake time** — the inline `[BAND/category]` fact tags, the `*_SELF-CHECK` blocks in `_planner.ts` directives, the per-tier "rules apply IN ORDER" enumerations. A re-bake that passes `canon:lint` can still violate composition rules; canon-lint will not catch a 3rd HARD/general fact or a 2nd doubles-halving fact in a session.

**Two consecutive composition-rule violations** on the sub-to-10 directive (PR #244 series, 2026-05-16): the first bake placed 4 HARD-band facts at P5-P8 (cap=2); the second bake placed 2 doubles-halving facts at P2 + P3 (cap=1). Both bakes passed `canon:lint`. Devon's REQUEST_CHANGES caught the second failure. The sharpening path is documented in `[[feedback_haiku_directive_sharpening]]` — explicit `*_SELF-CHECK` negative-anchor blocks mirroring the established pattern, paired with **manual rule verification before commit**.

**The mechanical gate (sub-to-10 today; extensible).** [`scripts/compositionLint.ts`](MarianLearning/scripts/compositionLint.ts) (shipped in PR #245, 2026-05-16) mechanises the verification protocol below. It runs at bake time inside `generateSessionCanon.ts` (gated to `track==='math' && focusNode==='sub-to-10'`; throws before write) AND as a CI gate via `npm run canon:lint` (chains text-encoding lint + composition lint). 56 unit tests pin each violation class. The hard-coded `SUB_TO_TEN_POOL` (16 facts) + `SUB_TO_TEN_RULES` cap/band config are canonical-by-permitted (what the directive allows), not canonical-by-emitted (what the current bake happens to use) — a re-bake that legitimately surfaces a different in-pool fact still passes. Migration to a per-tier config-driven shape (Approach B) is contained at the `TierLintBinding` boundary.

**Manual verification protocol** (still applicable for tiers without a composition-lint binding yet, and as a backstop when extending rules; generalises to any tier with composition rules):

1. Extract the 8 facts from the baked canon (`.utterances[id$=".read"]` — top-level utterances; the wire's `plan` field is `unknown`-typed and not the validated surface).
2. Classify each by category against the FACT POOL.
3. Count: doubles ≤ 1, generals ≤ 2, take-from-10 ≤ 2, subtract-zero ≤ 1, subtract-self ≤ 1, subtract-one ≤ 1, subtract-two ≤ 1.
4. Verify band-by-slot: P1-P3 EASY-only, P4+ MEDIUM/HARD, P5+ for HARD.
5. Verify pool membership: every fact in the 16-fact list.
6. No duplicate `(a, b)` pairs.
7. At least one take-from-10 fact in P4-P8.

If any rule fails, **re-roll** — do not ship. For sub-to-10 the lint catches all of these mechanically; for new tiers without a lint binding yet, manual verification is the gate until a binding is added.

**Why the self-check blocks aren't enough on their own** (Kevin NOF #1 + Devon NOF #1, PR #244 fix-up consensus). The `*_SELF-CHECK` negative-anchor blocks in `_planner.ts` directives are **psychological framing on a stochastic generator**, not runtime counters. They ingest forbidden-pair enumerations and bias Haiku's compositional attention away from violations during the single generation pass — but there is no inner loop that counts-then-rejects. Under attention pressure (long directive, near-token-limit, unusual seed) a bake can still violate. The pattern is the **strongest prophylactic** available short of deterministic lint, and validates [[feedback_haiku_directive_sharpening]] pattern #5 (DOUBLES-CAP SELF-CHECK), but is never a hard guarantee — which is why `compositionLint` is the deterministic backstop now wired into both bake-time and CI.

**Annotation-style switches must audit which old annotations were structurally load-bearing on Haiku attention** (Kevin NOF #1, PR #253 sub-to-10 pool-widening). When adopting a new fact-annotation style in the directive (e.g. switching from per-fact category prefixes like `[BAND/category]` to a different shape like `(a+b=N IN/OOR/ALIAS)`), the old annotations may have been carrying compositional load Haiku was tacitly relying on. Stripping them can silently weaken cap awareness. PR #253's first 2 bakes violated subtract-one + general caps before the SUBTRACT-ONE-CAP + SUBTRACT-TWO-CAP SELF-CHECK blocks were added to compensate.

**Practical rule when sharpening directive notation:**

- Don't just substitute new annotation in place of old.
- For each old annotation you're dropping, identify what cap / band / pool constraint it was implicitly enforcing.
- Add an explicit negative-anchor SELF-CHECK block for any constraint that previously rode on the old annotation but is no longer surfaced by the new one.
- Bake-then-inspect cycle 1-2 may still violate — expect to iterate, don't ship the first bake.

This is a meta-pattern over [[feedback_haiku_directive_sharpening]]: each individual pattern (DOUBLES-CAP, SUBTRACT-ONE-CAP, etc.) is reactive to a specific violation; the meta-pattern is proactive — audit BEFORE the bake, not after the violation surfaces.

**Haiku has a strong "doubles" prior under sharpened add-to-10 directive** (Kevin NOF #1, PR #266 add-to-10 re-bake, 2026-05-16). When PR #259's sharpened SESSION COMPOSITION RULES activated via re-bake, attempts 1 + 2 both produced the full doubles trifecta (`2+2`, `3+3`, `4+4`) violating the doubles ≤ 2 category cap (the cap rule sits AFTER placement rules in the directive). The composition-lint gate caught both pre-disk; attempt 3 cleared on Haiku non-determinism alone — not on directive correctness. Mechanism: Haiku leans on doubles as "safest" picks under a tightened P1-P3 EASY-only ban, and the cap rule positioned after placement rules loses attention. **Future directive iteration should apply [[feedback_haiku_directive_sharpening]] pattern #3** (per-rule self-check anchored against attention-budget-shift) — either hoist the doubles cap earlier in the directive, or add a "you have N doubles already, you cannot pick another" inline self-check at fact-selection time. Track as add-to-10-specific follow-up; sub-to-10 doesn't exhibit this prior because its doubles facts are structurally rare in EASY band.

**Composition-lint output is structured and inline-printed by `bakeOne`** (Kevin NOF #3, PR #266, 2026-05-16). When `compositionLint` rejects a bake, `bakeOne` renders `CompositionLintError.violations[]` (rule, slot, factId, message) directly to stdout in the format `[category-cap] slot=* Category "doubles" cap is 2; canon has 3 (slots P2, P5, P6; facts 2+2, 3+3, 4+4)`. **No need to inspect the canon JSON to diagnose** — the violation report names rule + slots + facts inline. Speeds the bake-iterate-bake cycle materially.

**Drift-guard tests extend to RULE identity (PR #256, 2026-05-16).** Beyond the 56 violation-class unit tests, `scripts/compositionLint.test.ts` now holds two drift-guard `describe` blocks: one for `SUB_TO_TEN_POOL` (PR #246) and one for `SUB_TO_TEN_RULES.bandAllowedSlots` (PR #256). Both use a mirror constant + runtime prose parser + 2-sided equality structure. See `testing-and-ci.md` §6 "Composition drift-guard tests" for the full recipe, the intentional parser regex brittleness NOF (do NOT "harmonize" the prose at `api/_planner.ts:963` vs `:966` — the asymmetry is the alarm wire), the mutation-test recipe, the sibling-literals disambiguation gotcha, and the add-to-10 forward-extension target.

**Block-scoped count assertions must slice `systemText` to the tier's directive block (Kevin NOF #4 on PR #330, Devon-validated, 2026-05-23).** When a drift-guard test counts tokens inside a per-tier directive (e.g. `<self-check>` tag count, `<rule band="hard">` annotation count, FORBIDDEN-anchor mention count), **slice `systemText` to the tier's block via the next-tier-header sentinel** (e.g. `'- add-to-20:'` for add-to-10, `'- two-digit-addsub'` for sub-to-20) before running the count. Otherwise sibling-tier annotations leak into the count — every other tier in `MATH_TRACK_GUIDE` and `WORD_SONG_TRACK_GUIDE` carries its own `<self-check>` / `<rule>` tags, so a global count fails to drift-guard the specific block. Pattern lives at `api/_planner.test.ts` `addToTenStart`/`addToTwentyStart` indices in the PR #330 Pattern 3 test. This generalizes to ANY future per-tier drift-guard counting block-scoped tokens.

### Planner ↔ parser contract

The browser parser (`src/screens/WordSong/plannerWire.ts`) and the planner prompt MUST stay in sync. The contract: **always widen the browser parser BEFORE widening the planner.** Bundling the two caused a P0 on word-song (PR #117 → #118) — the planner emitted `cvc.*` ids the parser didn't accept.

Lock: utterance ids ALWAYS use the `word.` prefix regardless of focus node. The content-type discriminant lives on the read-line template (`Tap the X.` vs `Read the X.`), NOT the id namespace ([\_planner.ts:701](MarianLearning/api/_planner.ts#L701) commentary).

See `project_planner_parser_contract.md` memory entry.

### Parser tier-widening sequence — `Math/planFromServer.ts` (Devon NOF on PR #287 + Kevin NOF, 2026-05-21)

The math-track read-line parser (`src/screens/Math/planFromServer.ts`) has a sibling rule to the WordSong wire contract: **every tier crossing into a wider operand or chip-range space must widen the parser BEFORE the canon ships**. Three precedents:

1. **sub-to-10 (cycle 1)** — introduced `correct = 0` (subtract-self facts). Parser already accepted; `pickDistractors` `minAnswer` defaulted to `0` for `op === '-'`.
2. **add-to-20 / sub-to-20 (cycle 3)** — introduced teens (11–20). Parser widening came in two halves: Kevin Wave 2 canon-rebake required the planner directive AND the parser to accept teen number words. Cross-PR split was load-bearing.
3. **two-digit-addsub (cycle 4)** — introduced hyphenated number words (`"thirty-one"`) AND chip-range ceiling > 20. Devon shipped this as **Wave 3** (PR #287) BEFORE Kevin's Wave 2 (canon rebake + binding). Two-PR split was structurally required:
   - `NUMBER_WORDS` extended with round-decade entries (twenty, thirty, …, ninety).
   - Compositional `wordToNumber(word)` decoder splits on `-`, looks up each part. Handles "thirty-one" → 31 by composing tens + units.
   - Read-line regexes widened from `[a-z]+` to `[a-z-]+`.
   - `ANSWER_RANGE_MAX_TWO_DIGIT = 99` constant added to `distractors.ts:chipMaxAnswerForCorrects` as a third tier branch.

**The pattern:** if a tier's directive will emit any of (a) new operand words, (b) hyphenated numerals, (c) wider chip-range, or (d) new read-line phrasing — ship a parser-widening PR FIRST. The canon-rebake PR depends on the parser accepting the new shape. Reverse order ships canon that production-side falls into silent static (per `audio-system.md` Path A silent-demote rule when `mathSessionPlanFromServer` throws).

**Detection rule:** when reviewing any tier-shipping wave, audit the planner directive at `api/_planner.ts:<focusNode-block>` against the parser's accepted vocabulary. If the directive emits any token the parser doesn't accept, a Wave 3 (parser) PR is required.

**Sibling failure mode — Planner directive vs canon read-line template divergence (Kevin NOF on PR #287).** Even after widening the parser, the planner directive can still produce read-lines the parser rejects if the directive's per-op templates aren't pinned. Example surfaced 2026-05-21: `two-digit-addsub` canon contains `"Twenty-eight minus three. How many?"` but `subMinusMatch` requires `"How many are left?"`. The planner directive at `api/_planner.ts:1176-1177` had NO explicit subtraction template, so Haiku improvised the wrong phrasing. Fix path: pin the subtraction template in the directive (matching `sub-to-10` / `sub-to-20`) AND add a `compositionLint` rule asserting subtraction reads match `/how many are left\?$/i`. This is a tier-shipping bake-time check, NOT a parser concern.

**Directive-prose canon-state claims must be empirically verified (Kevin NOF on PR #293, 2026-05-22).** When a directive's cap-justification prose cites "current canon ships with X facts of category Y" or similar empirical claims about canon state, **verify against the actual JSON before embedding the claim**. The wrong-state framing can propagate silently: spec author cites unverified state → directive prose embeds it verbatim → reviewer NOF surfaces the discrepancy → cleanup PR follows. PR #293 surfaced that the two-digit-addsub directive's "current canon ships with all THREE round-ten anchors (20+3, 30+5, 40+2 at P1, P3, P7)" claim was never empirically accurate — neither pre-rebake (commit `0bbdc30`, only `20+3` at P1) nor post-rebake (PR #292, same single anchor) ever had three. Kyle's spec §1.4 inherited the wrong framing; the directive carried it through. **Fix pattern:** reframe cap-justification prose around the empirical Haiku **saturation-prior** (the real failure mode the cap prevents, observable across many bakes) rather than a per-canon snapshot that can drift. Cap value itself + FORBIDDEN-pair negative anchors are unchanged — only the descriptive framing moves. This pattern is sibling to the directive vs canon read-line template divergence above; both are forms of "directive prose claims a state the canon doesn't honour."

**Sibling-check methodology — search by wrong-claim phrase (Devon NOF on PR #295, 2026-05-22).** When fixing a canon-state claim in one location, the same wrong-state framing often propagates across sibling locations: directive prose (`api/_planner.ts`), spec markdown (`design/math/*.md`), AND lint code-comments (`scripts/compositionLint.ts`) can all carry the same empirically-inaccurate claim. **Search pattern:** grep for the specific wrong-claim phrases (e.g. `"ships 3 round-ten-anchor"`, `"current canon"`, `"the canon ships"`) across all three surfaces — directive / spec / lint comments — before declaring the cleanup complete. Each surface needs its own PR (different file scope = different reviewer pattern); PR #293 + PR #295 + Kevin followup `86c9xunvq` instantiated this 3-surface sweep for the two-digit-addsub round-ten-anchor framing. Add the wrong-claim phrase to the "Detection rule for reviewers" inventory whenever a new canon-state-claim NOF surfaces — the phrases are the load-bearing search terms.

**User-visible symptom — silent wrong-tier misrender (Jessica NOF on PR #290, 2026-05-22).** When a tier's committed canon parses cleanly for `+` but throws `PlanFromServerError` for `-` (or vice versa) due to the template-divergence above, the user-facing behaviour is NOT "no math screen" — it is **silent wrong-tier misrender**. Pipeline: `mathSessionPlanFromServer` throws → `App.tsx` catches the rejection → `prepareMathPathA` rejects → screen falls into `pickStaticSessionPlan()` → static rotation for any non-`add-to-20` focus is the `add-to-10` add-only rotation (`op: '+'` only, `correct ∈ [3,10]`). Net: a child whose `focusNode` is `two-digit-addsub` sees four single-digit `+` facts on the chip row — looks plausible, no visible error, but it's the WRONG TIER's data. For E2E specs the symptom is identical to `failNetwork: true` static-fallback per `testing-and-ci.md §4.2`'s `failNetwork` tier-asymmetry warning, and the same range/operator detection rule applies. The diagnostic: if your tier-focused spec asserts on tier-specific content and you see add-to-10 single-digit `+` shapes in the chip row, **inspect the canon's read-line templates against the parser's expected vocabulary** before concluding "canon missing" — the silent demote masks the parse failure. The `two-digit-addsub` instance was caught by `e2e/two-digit-addsub.spec.ts` tests 1, 2, 5, 9 on PR #290; latent in production because focus is `locked` in `defaults.ts`.

### JSON parse safety

Haiku 4.5 wraps JSON in ```json fences despite the prompt forbidding it. `stripMarkdownFence`([_planner.ts:441](MarianLearning/api/_planner.ts#L441)) unwraps three shapes: language-tagged fence, plain fence, no fence. Anchored regex — a torn fence inside the body falls through to the original string and lets`JSON.parse` surface the real error.

`isPlannerPlan` ([\_planner.ts:465](MarianLearning/api/_planner.ts#L465)) is the structural validator (id + label + utterances array of `{ id, text }`). Anything else throws `PlannerError('invalid-response')`.

### Planner errors

`PlannerError` ([\_planner.ts:223](MarianLearning/api/_planner.ts#L223)) carries one of four codes:

- `config-missing` — `ANTHROPIC_API_KEY` not set
- `invalid-request` — unknown track or cross-track focus node
- `invalid-response` — model returned non-JSON or wrong shape
- `upstream-error` — SDK throw (truncated to first 200 chars; SDK error messages may contain headers, so we never propagate raw)

### Cost note

[\_planner.ts:46](MarianLearning/api/_planner.ts#L46) — sanity-check, not a contract. Haiku 4.5 at $1/$5 per 1M tokens, plus Azure TTS within the F0/S0 budget, lands ~$0.0022 per session start. At 10 sessions/day = ~$0.66/month. The per-IP rate limit (`6 requests / 60 s`) caps a leaked-share-link blast radius.

## TTS rendering — Azure Speech REST

[api/\_tts.ts](MarianLearning/api/_tts.ts) is the Azure Speech REST client.

### History

- Initial Path A used the Edge Read-Aloud WSS protocol (`wss://speech.platform.bing.com/...`). The handshake timed out at 8 s on every Vercel cold/warm invocation — likely Vercel egress IPs were on a Microsoft block-list. Structural failure, not tunable.
- Plan B (ticket `86c9gvgjk`) swapped to Azure Speech REST (`https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`). Same wire shape exposed to callers; plain HTTPS; $0/month within F0 free tier.
- Phase 3a (ticket `86c9hjnq1`, 2026-04-28) swapped voice from `en-US-AnaNeural` to `en-US-EmmaMultilingualNeural`. Audit branch (PR #96) A/B confirmed Ana's prosody predictor produces metallic question intonation regardless of SSML strategy; Emma multilingual produces natural prosody on the same SSML body.
- Tier upgraded F0 → S0 on 2026-05-01 (per `project_tts_provider_decision.md` memory).

See `project_tts_provider_decision.md` memory entry.

### Endpoint contract

`buildAzureEndpoint(region)` ([\_tts.ts:112](MarianLearning/api/_tts.ts#L112)) — `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`.

Request:

- Method: `POST`
- Headers:
  - `Ocp-Apim-Subscription-Key: {AZURE_SPEECH_KEY}`
  - `Content-Type: application/ssml+xml`
  - `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`
  - `User-Agent: marian-tutor/1.0 (+marian-learning.vercel.app)`
- Body: SSML built by `buildSsmlBody` ([\_tts.ts:368](MarianLearning/api/_tts.ts#L368))

Response: `audio/mpeg` bytes. Returned to caller as `Uint8Array`.

Default per-utterance timeout: 8 000 ms ([\_tts.ts:61](MarianLearning/api/_tts.ts#L61)) via `AbortController`.

Env vars required: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`. Read at synthesize-time, not module-load, so missing config fails per request (clear error in Vercel logs) rather than masking as `FUNCTION_INVOCATION_FAILED`.

### SSML construction

The body has three layers, all wrapped by `buildSsmlBody`:

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-EmmaMultilingualNeural">
    <prosody pitch="+0Hz" rate="-10%" volume="+0%">
      {renderSsmlInnerText(text)}
    </prosody>
  </voice>
</speak>
```

`renderSsmlInnerText` ([\_tts.ts:309](MarianLearning/api/_tts.ts#L309)) handles two transforms:

1. **Question prosody** (ticket `86c9gxup4`) — text ending in `?` gets its trailing clause wrapped in `<break time="250ms"/><prosody pitch="+8%" rate="-5%">...</prosody>`. The `<break>` resets the prosody predictor; the inner `<prosody>` raises pitch and slows slightly to force rising question intonation. Wrapping `<emphasis>` alone proved insufficient on AnaNeural's "Three plus two. How many?" patterns.
2. **Phoneme overrides** (ticket `86c9kj2um`) — `applyPhonemeOverrides` ([\_tts.ts:227](MarianLearning/api/_tts.ts#L227)) wraps whole-word matches in `<phoneme alphabet="ipa" ph="...">word</phoneme>`. Currently only `four → /fɔːr/` is in the table ([\_tts.ts:194](MarianLearning/api/_tts.ts#L194)) — Emma multilingual was selecting the homophone "for" /fɚ/ realization. `\b(four)\b` regex ensures "fourteen", "fourth" are unaffected. Case is preserved verbatim inside the tag for log readability.

Per ticket `86c9kj2um` notes: `two → /tuː/` was tried for symmetry but Emma multilingual ignored that IPA value, so it stays out. Defensive wrapping of words the voice handles correctly can degrade pronunciation — see `project_audio_phoneme_overrides.md` memory.

**Per-line render fixes + the early-return trap (voice-QA #446 / PR #448).** On top of the two general transforms above, specific session-end utterances get bespoke per-line renders matched by exact text shape — `renderRecapFourStars` ("You earned four stars!") and `renderStreakFourRow` ("Four in a row! Wow!") apply a stress-lift + `fɔːə` / `ɹəʊ` IPA inside a whole-line rate envelope (fixing en-GB-Olivia's de-stressed "four" and the /raʊ/-argument vs /roʊ/-line homograph on "row"). **The trap:** `renderSsmlInnerText` early-returns per `tierFilter` (there's a `letter-sounds` branch). Session-end `recap.*` / `streak.*` lines are **byte-shared across all 24 tier files**, and their voice-QA itemId is owned by whichever tier sorts first in the dedup — `letter-sounds` — so those bytes render under `tierFilter='letter-sounds'`. Any text-shape-gated fix for them MUST run **before** the `letter-sounds` early-return, or it never reaches the flagged bytes; the obvious placement (after the early-return, next to the other render helpers) silently misses.

`escapeSsml` ([\_tts.ts:117](MarianLearning/api/_tts.ts#L117)) escapes the five XML metacharacters; applied to all four prosody attributes (defense in depth — today they come from the hardcoded config) and to plain text segments outside phoneme markup.

### Retry / backoff

Transient Azure failures retry per `BackoffPolicy` ([\_tts.ts:421](MarianLearning/api/_tts.ts#L421)):

- `maxAttempts: 5`, `baseDelayMs: 200`, `maxDelayMs: 3000`, `jitterMs: 50`
- 429 with `Retry-After` header: parse via `parseRetryAfterMs` ([\_tts.ts:479](MarianLearning/api/_tts.ts#L479)); honour both seconds form and HTTP-date form, capped at `maxDelayMs`
- 429 without `Retry-After`: exponential schedule with jitter
- 5xx: single retry with exponential cadence; subsequent 5xx propagate
- Other 4xx: terminal, no retry
- Network throw: propagate (timeout owned by `AbortController`)

Worst case: ~6 s wall time across 5 retries (200 + 400 + 800 + 1600 + 3000), bounded by per-utterance timeout. Sized against ticket `86c9kjdh2` after production session-start was 100% failing on the first 429 from F0.

### Error mapping

`describeAzureFailure(status, bodyHint)` ([\_tts.ts:382](MarianLearning/api/_tts.ts#L382)):

- 401 / 403 → `tts auth failed: check AZURE_SPEECH_KEY`
- 429 → `tts rate limited`
- 5xx → `tts upstream error: Azure returned 5xx`
- Other → generic `tts http error`

The Azure key is never echoed in the error message. Body hint is truncated to 200 chars.

### Render diagnostic logging

[\_tts.ts:694](MarianLearning/api/_tts.ts#L694) — every synthesize call (suppressed under `NODE_ENV === 'test'`) logs to Vercel:

```js
{
  event: 'tts-render',
  voice, rate, pitch,
  ssmlLength, ssmlPreview: body.slice(0, 200),
  ssmlSha256: createHash('sha256').update(body).digest('hex'),
}
```

Lets Vercel logs correlate "client played silently" iPad capture with the SSML the server rendered. No PII — every input is non-user content from the static session plan.

## Session render orchestration

[api/\_session.ts](MarianLearning/api/_session.ts) walks a planner-returned plan, fans out TTS renders, and assembles the wire-shape `SessionStartResponse`.

`renderSessionAudio(plan, opts?)` ([\_session.ts:112](MarianLearning/api/_session.ts#L112)):

1. `extractUtteranceTexts(plan)` ([\_session.ts:77](MarianLearning/api/_session.ts#L77)) — pulls `{ id, text }` from `plan.utterances`. Plan stays opaque to this module otherwise.
2. Concurrency-limited fan-out (default 6 workers) — workers pull from a shared index. No `p-limit` dependency; the inline pool is small enough.
3. Per-utterance synth via `synth(req, opts)` defaulting to `synthesizeUtterance` from `_tts.ts`.
4. Each successful render: `{ id, text, audio: { kind: 'inline', base64, mime: 'audio/mpeg' } }`.
5. Failed renders: recorded in a `failures` array (logged as `[api/_session] tts-utterance-failed`) and SKIPPED. The slot in the result array is left empty.

**Soft-fail semantics** (ticket `86c9kjdh2`) — a per-utterance failure is recorded and the worker pool keeps draining. Even 0/N rendered utterances returns 200 OK with an empty array. The browser handles missing utterance ids by falling back to silent caption-only for that phrase. Pre-86c9kjdh2 behaviour was "any utterance failure tanks the whole session"; the current behaviour localises blast radius.

A summary log fires when ANY utterance fails: `[api/_session] tts-partial { total, failed, rendered }`.

## Canon — build-time prebake

[api/\_canon.ts](MarianLearning/api/_canon.ts) reads pre-baked session-start blobs at request time. [scripts/generateSessionCanon.ts](MarianLearning/scripts/generateSessionCanon.ts) produces them at build time.

### Why

Cold-start `/api/claude session-start` was 10–12 s on prod (Anthropic Haiku call + 40–59 sequential Azure TTS renders). Ticket `86c9kwhbc` (D — pre-baked session canon) targets <500 ms cold-start by pre-rendering every active `(track, level, focusNode)` combo as a static JSON blob with base64 audio inlined.

### File layout

`MarianLearning/public/canon/<track>/level-<n>/<focusNode>.json`:

- `math/level-1/{add-to-10,add-to-20,sub-to-10,sub-to-20,two-digit-addsub,skip-counting,mult-2-5-10,mult-3-4,mult-6-9,number-recog}.json` (10 combos)
- `word-song/level-1/{blending-cv,cvc-words,cvc-words-short-o,cvc-words-short-u,cvc-words-short-i,cvc-words-short-e,digraphs-sh}.json` (7 combos — short-u shipped in PR #174, short-i in PR #192, short-e in PR #208, digraphs-sh in PR #223)

Total: 17 combos, ~1.2 MB JSON each. `activeCombos()` in [generateSessionCanon.ts](MarianLearning/scripts/generateSessionCanon.ts) is the canonical source — when widening a new tier's first-class planner support, the combo lands in the iteration set by virtue of being in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (planner side) and the matching canon entry in the union.

### Wire→disk seam: `canonFileTierFor` (post PR #309, 2026-05-22)

`canonFileTierFor(focusNode)` in [api/\_canon.ts](MarianLearning/api/_canon.ts) is the **single mapping function** between the runtime `SkillNode` literal on the wire and the canon-file tier identifier on disk. Both `canonCacheKey` and `canonFilePath` (the only canon-path constructors) route through it; the bake script (`scripts/generateSessionCanon.ts`) imports `canonFilePath` from `api/_canon.js` and writes via it, so generator + reader cannot disagree on naming.

Today the mapping is the identity for every focus node EXCEPT `two-digit-addsub-no-regroup`, which maps to the disk tier `two-digit-addsub` (the legacy file kept stable across the PR #308 SkillNode split). See `skill-trees-and-content.md` § "Canon-file-name vs SkillNode-literal — dual identifier surface" for the rationale.

**Future SkillNode renames that need to keep canon-file disk naming stable should extend `canonFileTierFor` rather than add a parallel mapping in another module.** A parallel mapping would let generator and reader silently diverge. Audit grep before any "rename a SkillNode but keep the canon file" PR: confirm there is still ONLY one mapping function across `api/` + `scripts/`. As of PR #309, `canonFileTierFor` is referenced once (its declaration in `api/_canon.ts`) and called from two sites (`canonCacheKey`, `canonFilePath`, both in the same file); every other appearance is documentation.

### Wire envelope shape

Every canon JSON on disk is a `SessionStartResponse` ([api/\_types.ts:72](MarianLearning/api/_types.ts#L72)) — the same shape the live `/api/claude` handler returns. The envelope is four top-level keys:

```ts
interface SessionStartResponse {
  ok: true // literal true; canon writes only successful renders
  kind: 'session-start' // literal; discriminates from stub responses
  plan: PlannerPlan // see below — id + label + utterances list (flat, no audio)
  utterances: Utterance[] // 59 items typically; carries id + text + inline base64 MP3
}

interface PlannerPlan {
  id: string // e.g. "word-song-cvc-short-e-level-1"
  label: string // human-readable, e.g. "CVC Words Short-E (Level 1)"
  utterances: Array<{ id: string; text: string }> // FLAT, no audio bytes
}

interface Utterance {
  id: string // matches plan.utterances[*].id by content
  text: string // matches plan.utterances[*].text by content
  audio: { kind: 'inline'; base64: string; mime: 'audio/mpeg' }
}
```

**The flat `plan.utterances` field and the audio-bearing `utterances` field carry the same `id` and `text` content.** The split exists because the screen-side adapters (`mathSessionPlanFromWire`, `wordSongSessionPlanFromServer`) walk the audio-free plan to validate structure (8 problems × 5 slots, every utterance id matches `<track>.p<N>.<slot>`) and then look up audio bytes from the parallel `utterances` array by id. Validation lives on the plan; bytes live on `utterances`.

**Confirm shape by spot-checking an on-disk file** ([public/canon/word-song/level-1/cvc-words-short-e.json](MarianLearning/public/canon/word-song/level-1/cvc-words-short-e.json) is a quick sample). The first ~2 KB of any canon JSON reads:

```
{"ok":true,"kind":"session-start","plan":{"id":"...","label":"...","utterances":[{"id":"word.p1.read","text":"Read the bed."}, ...]},"utterances":[{"id":"word.p1.read","text":"Read the bed.","audio":{"kind":"inline","base64":"...","mime":"audio/mpeg"}}, ...]}
```

The big-bytes payload (~99% of file size) is the base64 MP3s in the second `utterances` array; the inner `plan.utterances` adds ~3-4 KB.

**Type guard at runtime.** [`isSessionStartResponse`](MarianLearning/api/_types.ts#L126) in `_types.ts` validates the four-key envelope plus per-utterance shape (`isUtterance` checks `audio.kind === 'inline'`, `audio.mime === 'audio/mpeg'`, base64 is a string). It does NOT validate the inner `plan.utterances` array — that's loosely typed as `unknown` on the wire shape because the planner schema is a separate concern, validated by `isPlannerPlan` ([\_planner.ts:465](MarianLearning/api/_planner.ts#L465)) when the live pipeline reads Haiku's output. Canon read path only re-validates the envelope; if the plan substructure is malformed in a committed canon JSON it'll surface as a parser throw inside the screen-side adapter, NOT at canon read.

**Out-of-namespace ids** (e.g. `session.end.opener`, `session.end.recap.q1`, etc.) live in `utterances` but are SKIPPED by the per-screen plan parsers — they get loaded into the singleton howl-map for cross-screen consumption (SessionEnd reads them via `playSessionUtterance`) but don't belong in the nested per-problem plan. See `skill-trees-and-content.md` "Math `planFromServer`" for the skip-not-throw rule.

### Why `public/`

Vercel includes `public/` in the function bundle by default for the Node runtime. The path doubles as a static asset path, but the browser does not read canon directly — function only. Reusing `public/` avoids hand-rolling a new bundling rule.

### Read API

`getCanonEntry(key, canonRoot?)` ([\_canon.ts:153](MarianLearning/api/_canon.ts#L153)) — synchronous file read + JSON parse + `isSessionStartResponse` shape check. All failures (missing file, parse error, shape mismatch, permission error) return `null`; the handler treats `null` as "fall through to live planner". Module-singleton in-memory cache avoids re-parsing on warm hits.

`canonFilePath(root, key)` ([\_canon.ts:131](MarianLearning/api/_canon.ts#L131)) — exported for the generator script to share with the reader, ensuring naming can never disagree.

`DEFAULT_CANON_ROOT` ([\_canon.ts:95](MarianLearning/api/_canon.ts#L95)) resolves `import.meta.url` + `'../public/canon'`. On Vercel the function runs from `/var/task/api/`; the relative path resolves to `/var/task/public/canon/` after the build copy.

### Generator script

Run via `npm run canon:regen` (or `npx tsx scripts/generateSessionCanon.ts`). Iterates `activeCombos()` ([generateSessionCanon.ts:199](MarianLearning/scripts/generateSessionCanon.ts#L199)) — same MATH_FOCUS_NODES + WORD_SONG_FOCUS_NODES lists pinned by `scripts/generateSessionCanon.test.ts` against the planner constants.

Flags:

- `--force` — regen even if file exists (default is incremental)
- `--dry-run` — plan only, no Anthropic / Azure calls
- `--child Marian` — defaults to "Marian"; AC #3 of the ticket bakes the name into utterance text
- `--out public/canon` — defaults; multi-child support would write to `public/canon-<name>`
- `--require-keys` — hard-fail on missing `ANTHROPIC_API_KEY`/`AZURE_SPEECH_KEY` (manual regen flow). Default is soft-fail with warning (Vercel build path, so a fresh clone builds without secrets).

Calls `generateSessionStartResponse` ([\_planner.ts:410](MarianLearning/api/_planner.ts#L410)) — the same callable the live HTTP handler uses, so live and canon share one code path. 250 ms sleep between combos to be polite against Azure rate ceilings.

Cost: 13 combos × (1 Haiku call + ~59 Azure TTS calls) per regen. Cents per full regen.

**Anthropic 529 overload — bake-attempt counting is not equivalent to directive-quality measurement (Kevin NOF on PR #292, 2026-05-22).** The Anthropic API can return sustained `overloaded_error` (HTTP 529) for ~25 minutes — well past the SDK's built-in retry budget. During such windows, a single bake invocation looks like it "failed" even though the directive is fine and the same directive would have succeeded on attempt 1 against a healthy upstream. This matters when counting bake attempts for `[[feedback_haiku_directive_sharpening]]` Patterns 1-6 calibration: 4+ "attempts" caused by 529s ≠ 4+ directive-quality failures. Diagnostic: if the script error is `upstream-error` or HTTP 529 (not a `composition-lint` violation or a `PlannerError('invalid-response')`), the bake never reached Haiku — retry the command verbatim after waiting; do NOT re-tighten the directive. Verified empirically on PR #292: ~7-8 retries at increasing backoff over ~25 min, then a clean attempt-1 bake the moment Anthropic recovered. **Future hardening candidate:** a `--retry-bake N` flag on `generateSessionCanon.ts` that catches `upstream-error` (separate from the SDK's per-request retry) and waits N seconds before retrying the bake pipeline.

### Regen cadence

**Only regen when prompts/word-list change.** The canon JSON is committed to the repo (PR #136, 2026-05-02). Production runtime serves canon from CDN; it does not depend on a successful prebuild against Anthropic/Azure. Workflow:

1. Edit prompt copy in `_planner.ts`, word list in `_plannerWordList.ts`, or voice config in `_session.ts`
2. `npm run canon:regen` locally (requires `.env.local` with both keys)
3. Commit the JSON diff in the same PR as the source change

**Worktree canon-bake prerequisites.** Fresh git worktrees do NOT inherit the main workspace's `.env.local` or `node_modules/` — they share the git object store only. Before running `canon:regen` (or `npx tsx scripts/generateSessionCanon.ts --require-keys`) in a worktree, two steps are mandatory: (a) `yarn install --frozen-lockfile`, and (b) copy `.env.local` from the main workspace root into the worktree root. Missing the copy produces a misleading `config-missing: ANTHROPIC_API_KEY not set` runtime error — not a file-not-found — because the script reads env vars at runtime. Always include both steps in any dispatch brief that asks a sub-agent to bake canon from a worktree.

Bake locally so a Vercel build with empty Anthropic balance still ships the canon. See `project_canon_commit_strategy.md` memory.

**Incremental-by-default trick** (verified 2026-05-10 by Kevin during PR #192 short-i opener work): the script is incremental without `--force`. For a single-tier update, **delete just the target JSON** (e.g. `rm public/canon/word-song/level-1/cvc-words-short-i.json`) then run `npx tsx scripts/generateSessionCanon.ts --require-keys`. Only the deleted combo re-bakes — ~25s vs several minutes for a full `--force` regen. Use this for tier-specific updates (opener additions, single-pool wording tweaks); reserve `--force` for cross-cutting prompt changes that touch every combo (e.g. `WORD_SONG_TRACK_GUIDE` body changes that ripple all word-song combos).

**Cache key is file-existence, NOT prompt hash** (Kevin NOF #3 + Devon NOF #1, PR #259, 2026-05-16). The incremental skip at `scripts/generateSessionCanon.ts:420` and `:492` uses `existsSync(canonFilePath(...))` as the cache filter — there is no prompt-hash check, no "directive changed, regenerate" signal. Operational consequences:

- A directive prose change (e.g. PR #259 lifting `SESSION COMPOSITION RULES` for add-to-10 into `MATH_TRACK_GUIDE`) is **invisible to the prebuild**. `yarn build` reports `canon up-to-date — nothing to bake.` even when the in-prompt instructions Haiku would now receive have materially changed.
- Re-bake fires only when (a) `--force` is passed, or (b) the target canon JSON is deleted from disk. Both are explicit operator actions.
- **Per-tier rebake recipe — prefer option (b) for single-tier scope** (Kevin NOF #2, PR #266, 2026-05-16). `npm run canon:regen` invokes the script with `--force` and rebakes ALL ~18 combos (~30 min Azure latency + Anthropic spend across the full grid). For a single tier's directive activation, the cheaper recipe is: `rm public/canon/<track>/level-1/<focusNode>.json` then `npx tsx scripts/generateSessionCanon.ts` (incremental, no flag — the existsSync filter at `:420`+`:492` skips files still on disk). Naturally retry-safe: if the bake errors mid-flight, no JSON is written for the deleted target (the compositionLint gate aborts before `writeFileSync`) — re-running the same command is idempotent. Confirmed on PR #266 (add-to-10 single-tier re-bake post-#259).
- The compositionLint backstop catches **violation drift** at bake-time (when a re-bake eventually happens), but drift in the _non-violating-but-still-better_ direction — where a sharpened directive would have produced more pedagogically aligned canon — is invisible until someone deliberately re-bakes.
- This is by design (see `project_canon_commit_strategy.md` memory: bake-on-prompt-change is a manual operator decision, not an automatic CI action). It keeps CI cheap and never burns Anthropic credits without explicit intent.
- **Future option:** if directive changes should auto-trigger re-bake, the script would need a prompt-hash check (hash the `MATH_TRACK_GUIDE` body for the relevant combo, compare against a sidecar manifest, re-bake on mismatch). Currently no such mechanism exists.

**Recovery from a failed incremental regen:** the `rm` step is not staged — git tracks the delete only after `git add`. If regen fails for any reason (network drop / `ConnectionRefused`, Anthropic credit exhaustion, syntax error in the planner directive), the working tree has missing JSONs but the deletes are recoverable cleanly:

```sh
git restore public/canon/word-song/level-1/*.json   # restore all word-song level-1
git restore public/canon/word-song/level-1/cvc-words-short-i.json   # or single tier
```

Then diagnose the root cause (check API balance, fix the planner edit, restore network) and re-run the regen. The incremental script will skip JSONs that already exist, so there's no risk of double-baking the surviving files.

**Spec-layer drift on re-bake — run the literal-pin grep before committing the JSON diff.** Re-baking can reorder pool slots even when the new facts are commutatively equivalent (e.g. `2+1=3` ↔ `1+2=3`). The `canon:lint` + `compositionLint` gates check **canon → directive** compliance; they do NOT check that existing E2E spec literals still match the new canon. Before committing a re-baked JSON diff, grep `e2e/` for OLD-fact literal references (`toHaveText('<old_operand>')`, `<old_a> + <old_b>`) and update or refactor any hits in the same PR. Full failure-mode write-up + fix patterns + inventory-audit flag in [`testing-and-ci.md`](./testing-and-ci.md) §6 "Canon-content-coupled E2E spec drift" (PR #266, 2026-05-16).

**Sequencing rule — commit planner edits BEFORE regen:** the workflow above (edit → regen → commit JSON diff) should be reordered for resilience: **(1) commit (or at least `git add`) the planner-prompt / word-list / voice-config change first**, **(2) then run regen**, **(3) then commit the JSON diff in a follow-up commit or amend**. The planner edit is the slow-to-reconstruct work; the regen is ~2 min and costs cents of Haiku. A mid-flight failure should only lose the cheap step. Recipe-level corollary of the `feedback_agent_commit_early` memory ("background agents die silently; commit after each milestone"). Confirmed failure mode 2026-05-11 (Kevin, ticket `86c9qkf2w` celebration-prosody-A1 first dispatch): agent ran `rm` on all 5 word-song level-1 JSONs, then Anthropic API hit `ConnectionRefused` mid-bake (home internet drop); agent process died at 57 tool uses with no commit, no remote backup, no canon output — orchestrator recovered via external `git status` diagnosis on the worktree + agent resume via SendMessage by UUID.

### Azure TTS renders are NOT byte-deterministic across separate bake calls (2026-06-11 audit)

Two utterances with the same `text` field baked in **different** `canon:regen` invocations may produce **different MP3 bytes** even when the SSML body, voice, and prosody settings are identical. This is empirically observed, not a guarantee of Azure's behaviour.

**Empirical finding (2026-06-11 audit of `public/canon/**`).\*\* The committed canon set contains 1,358 raw utterances spanning 629 unique text strings and 632 unique audio hashes. Of the 629 unique texts, 3 carry more than one distinct audio hash — each divergence originates from a separate bake invocation. The remaining 626 duplicate texts (same text appearing in multiple canon files) are byte-identical within a single bake run, because the pipeline reuses renders within a run.

**Implications for tooling and testing:**

- **Hash identity = same render; hash divergence across bakes = normal.** Do not treat a different audio hash for the same text as a regression signal — it may simply reflect a different bake run.
- **Within one bake run, identical text → identical bytes.** It is safe to deduplicate MP3 bytes by text within a single run; cross-bake dedup is unreliable.
- **`text` field is the stable identity; bytes are ephemeral across bakes.** Any hash-keyed verdict store (e.g. `vqa-verdicts` keyed by utterance hash) will auto-flip affected items to `needs-retest` status after a re-bake even when no text changed — this is intended behaviour, not a bug. Re-baking changes the hash for at least some utterances.
- **Cross-bake byte-equality is not a safe "nothing changed" signal.** A re-bake that touches a single tier can produce non-identical bytes for unchanged utterances in other tiers; use the `text` field, not byte hashes, to assert "same content."

The 1,358 / 629 / 632 counts are a 2026-06-11 snapshot; they grow as new tiers ship.

### SSML behaviour on en-GB-OliviaNeural + targeted re-render tooling (voice-QA fix cycle, PR #375, 2026-06-11)

Empirical findings from the first voice-QA fix cycle (149 targeted re-renders), each verified independently by the author (byte-diff re-renders) and the cross-reviewer:

- **Olivia ignores `<emphasis>` but honours `<prosody>`.** An `<emphasis level="strong">` wrap produced byte-identical audio on re-render; switching the same fix to `<prosody rate>` changed the bytes. Same class as the earlier parked `two → /tuː/` override the voice ignored. For any stress/de-stress fix on this voice, reach for `<prosody>` (or an IPA `<phoneme>`), never `<emphasis>`.
- **Voice-QA dedup groups split on SSML, not just text.** Identical `text` rendered through different SSML paths (e.g. the letter-sounds bake's prepend-break vs the math bake's plain render) produces different bytes → separate dedup groups on the voice-QA page. "Same text" ≠ "same group" whenever the render path differs.
- **`letter-sounds-audit.json` renders under tierFilter `'letter-sounds'`** (per `bakeLetterSoundsPinned.ts`), not its own basename — any per-tier SSML logic keyed on tier name must special-case it or the letter-sounds mnemonic overrides silently don't fire for the audit file.
- **`scripts/revoiceCanonTargeted.ts`** is the targeted re-render tool: give it flagged utterance ids, it expands to all dedup-group members by audio hash across the 23 canon files and re-renders ONLY those entries (with `--dry` to preview the plan). Use it for ear-test-driven fixes; full `canon:regen` re-renders the world and invalidates the entire voice-QA baseline.
- **SSML fixes must live in `renderSsmlInnerText` (api/\_tts.ts), not in one-off scripts** — that keeps them production-coherent: a future full re-bake reproduces the fixes instead of silently reverting them.

#### Round-2 SSML refinements (PR #382 + #384, 2026-06-12)

Empirical findings from the round-2 fix cycle (6 genuine fails after phantom triage; see round-N triage in `testing-and-ci.md` §4.4.2):

- **Length-marked IPA consonants are honoured by Olivia.** `vːə` (long-V onset) was accepted; the IPA length mark `ː` is a reliable lever for consonant extension on `en-GB-OliviaNeural`.
- **`vvv` scratchiness is onset loudness, not voicing.** The percept is an abrupt amplitude peak on the /v/ onset, not a voicing artefact. Fix: `SCRATCHY_PROSODY_BY_MNEMONIC['vvv']` in `api/_tts.ts` uses `{ rate: '-20%', volume: '-12%' }` — slower onset + volume reduction. The shared `SCRATCHY_PROSODY_RATE = '-12%'` (rate-only) covers `aaa`/`ooo` (round-1 shape, kept byte-identical); per-mnemonic entries in `SCRATCHY_PROSODY_BY_MNEMONIC` override when present.
- **Prosody `pitch` is the stress-restoration lever.** Raising pitch restores the word-stress contour when a `<prosody rate>` wrap inadvertently de-stresses. Confirmed on `"four"` / `"for"` — pitch `+12%` restored natural stress; `"four"` was already clear in sentence-final position and only needed pitch help mid-sentence.
- **`<emphasis>` has no effect on this voice** (round-1 finding, re-confirmed round-2). Reach for `<prosody>` or `<phoneme>` exclusively.

#### Text-shape-gated SSML helpers silently die when canon text changes (voice-QA round 5, 2026-06-12)

Some SSML helpers in `api/_tts.ts` are gated on **exact utterance-text equality** — e.g. `renderFourSubjectHint` opens with `if (text !== 'Look. Four comes after three.') return null`. When a planner-directive or canon text edit changes the live utterance (W12's PR #413 dropped the `'Look.'` carrier, making the live text `'Four comes after three.'` on `math.p6.hint2`), the helper silently returns `null` and its treatment never fires — no error, no lint, normal-looking render. The only detection surface is an ear-test hearing the pronunciation regress.

**Audit rule:** whenever a directive or canon `text` changes, grep `api/_tts.ts` for `text ===` / `text !==` / `text.startsWith(` gates and confirm each literal still matches the live text. Fix shape (PR #418, pending merge): re-gate on the live text and keep the legacy literal defensively.

**Sibling gotcha — "still failing" can mean stale bytes, not a missing override.** Round 5's `streak.4` "row" fail needed zero code: the `row → /rəʊ/` entry already existed in `PHONEME_OVERRIDES` (ticket 86ca7u3gr); the committed clip bytes simply predated it. Before writing a new override for a voice-QA fail, check whether the override already exists and the clip just needs a targeted re-render.

#### `revoiceCanonTargeted.ts` — `--ids` subset flag

`scripts/revoiceCanonTargeted.ts` accepts `--ids a#b,c#d` (space-separated value) or `--ids=x,y` (equals form) to override the default `FAIL_ITEM_IDS` constant with an explicit subset of utterance ids. Combine with `--dry` to preview the dedup-expansion plan (which canon files + how many entries would be re-rendered) before spending Azure budget.

**Blast-radius discipline:** same-day re-renders of utterances whose SSML is unchanged produce byte-identical MP3s within one bake run. However, cross-bake byte-identity is not guaranteed. Omit `--ids` only when re-rendering the full `FAIL_ITEM_IDS` baseline; for targeted round-N fixes, always pass `--ids` with only the genuinely-changed utterance ids to minimize voice-QA hash churn on unchanged items.

### Voice-QA chunked-report JSON reassembly

Voice-QA round reports arrive as a series of comments on the report's GitHub issue, each headed `<!-- voice-qa-report part i/N -->` and wrapping a slice of one JSON document in a fenced code block. Two traps, both hit live on issue #377 (2026-06-11):

1. **Adaptive fence length.** The fence is sized to exceed any backtick run in the payload — read the opening fence's length and match the same length on close. Never hardcode three backticks.
2. **Chunks split at fixed ~60 KB byte offsets, NOT line boundaries.** The split can land mid-string (observed: inside an `audioHash` value — `SyntaxError: Bad control character in string literal at position 59950`).

**Reassembly algorithm (validated round-2):** per chunk, strip the header line + opening/closing fence lines, strip at most ONE trailing `\r`, then concatenate chunks in part order with an **empty separator** — never `'\n'`. A newline join inserts a control character into whichever string literal straddles the boundary; an empty join byte-exactly reconstructs the producer's serialisation. Parse the result as one JSON document.

### Tier-specific opener pattern (canonical)

**Authoring note for the `WORD_SONG_TRACK_GUIDE` template literal in [`api/_planner.ts`](MarianLearning/api/_planner.ts)**: the entire directive block is a single tagged-template-literal string, so **backticks inside the block terminate the literal** — `` `ɪ` `` or `` `ih` `` for emphasis will produce esbuild errors like `Expected ";" but found "ɪ"`. Use straight quotes (`'ɪ'`, `"ih"`) inside the block. Confirmed authoring trip 2026-05-10 during PR #192's history-note addition.

When adding a lifetime-first-encounter scaffolding line for a new tier (e.g. PR #174 short-u `/ks/` opener for `box`/`fox`; PR #192 short-i `/ɪ/` opener), three load-bearing edits are mechanically symmetric across openers:

1. **Add the new node to `FIRST_ENCOUNTER_GATED_NODES`** in [`api/_firstEncounterGate.ts`](MarianLearning/api/_firstEncounterGate.ts). This is the lifetime-once gate — `Progress.lifetimeFirstEncounters` records that Marian has seen the opener once; subsequent sessions get the rewrite-to-no-opener branch.
2. **Add the directive block to `WORD_SONG_TRACK_GUIDE`** in [`api/_planner.ts`](MarianLearning/api/_planner.ts). Block format: a clearly-delimited "SHORT-X FIRST-ENCOUNTER SCAFFOLDING" header + the line text + Emma render notes (rate, etc.). Pair with a directive drift-guard test in `_planner.test.ts` that pins the block exists.
3. **Re-bake the target tier's canon JSON** via the incremental trick above. Commit the JSON diff in the same PR. The opener line surfaces as utterance index 0 of the focus-tier session canon.

If the line text uses SSML phoneme overrides for pronunciation control (e.g. `<phoneme alphabet="ipa" ph="ɪ">ih</phoneme>`), use the `PHONEME_OVERRIDES` injection seam in [`api/_tts.ts`](MarianLearning/api/_tts.ts) rather than raw SSML in the canon `text`. Reasoning per Kevin's PR #192 dispatch: keeps `escapeSsml` safe-by-default for all content text; new entries are content-narrow tokens (e.g. `ih`, `ee`) that never appear as standalone words outside the relevant tier copy. **Add boundary-guard unit tests** in `_tts.test.ts` for any other-tier words that contain the wrap target as a substring (e.g. `ee` wrap → guards for `feed`, `speedy`).

**CRITICAL — do NOT add an anchor / chip word to global `PHONEME_OVERRIDES`.** The wrap fires on EVERY utterance containing the word, not just the opener. Confirmed regression in PR #192 (2026-05-10): adding `pig: 'pɪɡ'` caused per-correct micro-celebrations like "Yes! Pig.", "Let's look. Pig.", "This one is pig." to sound robotic / gibberish — the forced-phoneme prosody blends OK at slow instructional reading prosody but fights Azure's faster cheerful celebration cadence. Substring boundary guards (`pigeon`, `pigsty`) are not sufficient; the failure mode is **same-word leakage into other prosodic contexts within the same tier**, not substring leakage. Three options for an anchor word that needs IPA control ONLY in the opener:

1. **Accept Azure's default lexicon** for the standalone word in non-opener contexts. For common English words (`pig`, `cat`, `box`), Azure's lexicon is empirically fine — the IPA wrap was defensive, not load-bearing. **Default to this option** unless ear-test reveals a real Azure mispronunciation. The opener line's contrast scaffolding (e.g. `<phoneme ph="ɪ">ih</phoneme>` + `<phoneme ph="iː">ee</phoneme>`) carries the discrimination; the standalone anchor word doesn't need wrapping.
2. **Per-utterance-id override map** (Devon's longer-term primitive — backlog candidate `86c9qahq7`-adjacent). Shape: `{ 'session.start.opener.short-i': { pig: 'pɪɡ' } }`. Cleaner scoping, more invasive change.
3. **Raw SSML in the canon text** for the one utterance that needs it. Bypasses `applyPhonemeOverrides` entirely; trades the safe-by-default `escapeSsml` posture for explicit per-utterance markup.

**Canon text must be naturally pronounceable English.** Canon `text` fields are plain strings sent to Azure TTS. Any character that's not a normal English word gets rendered literally: forward slashes (`/`) become "slash", unicode IPA characters (`ɪ`, `ɛ`, etc.) get vocalized as the character name (or silent — depends on Azure's lexicon for unknown unicode). Confirmed regression in PR #192 (2026-05-10): canon text `"Like pig: /p/-/ɪ/-/g/."` rendered as Emma saying "slash p slash dash slash IH slash dash slash g slash" — the author intended SSML breakdown notation but the canon stored the plain-text form. **Phonetic breakdown notation (`/p/-/ɪ/-/g/`) works in writing but not in canon text.** Two valid alternatives:

1. **Use natural-English phonetic approximations** as separate words: e.g. `"puh, ih, guh"` — each token is pronounceable on its own. Common phonics-textbook convention. The `ih` token still honours its IPA wrap via PHONEME_OVERRIDES.
2. **Drop the per-token breakdown entirely** and rely on the higher-level contrast scaffolding (e.g. `"Listen — short i says ih, not ee. Like pig — listen: pig."` — Dave's Option B). Trade-off: loses the explicit segmentation; preserves the load-bearing /ɪ/-vs-/iː/ contrast.

Raw SSML in canon text would also work but requires bypassing `escapeSsml` for that specific utterance (invasive pipeline change — not done as of 2026-05-10). Until that lands, treat canon text as "plain English, no notation".

**Stick to ASCII-7 punctuation** — no em-dashes (`—`), en-dashes (`–`), curly quotes (`"` `"`), or any other unicode punctuation in canon text. The pipeline silently mojibake's some unicode punctuation in transit to Azure: confirmed regression in PR #192 (2026-05-10, third fix iteration) — em-dash (`—`, U+2014, UTF-8 bytes `E2 80 94`) was vocalized by Azure as `â€"` (the classic UTF-8 → Windows-1252 → UTF-8 double-encoding signature), producing "asesinati"-shaped gibberish in the rendered MP3.

**Refined root cause (Kevin's PR #192 diagnostic, 2026-05-10):** the canon JSON on disk holds the **correct UTF-8 em-dash** — the corruption is NOT in the bake-script or canon-write path. It happens in transit to Azure: the SSML POST sets `Content-Type: application/ssml+xml` **without `charset=utf-8`**. When the charset is unspecified, Azure's server may decode the bytes per its default (Windows-1252 / ISO-8859-1) before re-encoding internally — producing the exact mojibake pattern observed. **Fix shipped in PR #195** (3 Azure-API surfaces: `api/_tts.ts` + `scripts/render-greet-mp3s.mjs` + `scripts/render-hub-mp3s.mjs`).

**Empirical finding from Devon's live-Azure validation (PR #195 review):** the bug is **host/instance-variable** on Azure's side — Devon's live round-trip from `.env.local` returned byte-identical MP3 output for em-dash payload regardless of whether the charset header was present. The charset fix is therefore **necessary but not sufficient**: Azure may still mojibake on some load-balancer instances even with `; charset=utf-8` set. The wire-byte regression tests in `api/_tts.test.ts` (8 tests under `describe('synthesizeUtterance unicode-punctuation round-trip (86c9qhr91)')`) pin what bytes leave the box — the half of the round-trip we control. The canon-lint ASCII-7 rule (PR #193) stays as the primary gate; the charset fix is defense-in-depth.

**Audit status:** as of PR #194 (2026-05-10), the full canon set is **audit-clean** — `npm run canon:lint` reports `15 files, 0 violations` with an empty baseline. Historical context: PR #193 (Devon) added the lint and surfaced one shipped corrupt utterance — `cvc-words-short-u.json :: session.end.opener` carried both a U+2014 em-dash and a U+028C IPA `ʌ` character + slash-IPA notation `/s/ /ʌ/ /n/`, which Marian had been hearing as "slash s slash slash UH slash slash n slash" gibberish since PR #174. PR #194 (Kevin) re-baked with ASCII-only equivalent. The lint baseline is now the ratchet; any future regression fails CI.

Until the charset header fix ships AND a re-bake confirms cleanup, **all canon text must be ASCII-7 only** (commas, periods, colons, semicolons, hyphens, apostrophe, parentheses). A bake-time lint that fails on any non-ASCII codepoint in `text` fields would catch this category before ear-test cost — tracked in ticket `86c9qhr9k`. Same lint would also catch the `/p/-/ɪ/-/g/` slash-notation gibberish from PR #192's second fix iteration.

**Bake-time lint enforces this rule** (ticket `86c9qhr9k`, 2026-05-10). The script [`scripts/canonLint.ts`](MarianLearning/scripts/canonLint.ts) walks every utterance `text` field and rejects three failure-mode classes:

1. **`non-ascii`** — any codepoint > 127 (em-dash, en-dash, curly quotes, IPA chars, mojibake byte sequences like `â€`).
2. **`slash-ipa`** — phonetic-breakdown notation `/p/-/ɪ/-/g/`, `/s/ /ʌ/ /n/`. Author intent is "speak the phonemes"; canon stores plain text so Azure says "slash p slash...". Use natural-English approximations (`puh, ih, guh`) or drop the per-token breakdown.
3. **`angle-tag`** — any `<...>` substring (looks-like-SSML markup, HTML-entity-shaped tokens). SSML injection is a separate seam (`PHONEME_OVERRIDES` in `_tts.ts`); raw inline markup in canon `text` would be SSML-escaped and vocalized as `&lt;phoneme...&gt;`.

The lint runs in two places:

- **Bake-time gate** in [`scripts/generateSessionCanon.ts::bakeOne`](MarianLearning/scripts/generateSessionCanon.ts): every successful render is linted before write; violation throws `CanonLintError` and the corrupt JSON never reaches `public/canon/`. `--lint-warn` downgrades to warn-only for prompt-iteration dev cycles (CI never sets it).
- **CI gate** via `npm run canon:lint` in [`.github/workflows/e2e.yml`](MarianLearning/.github/workflows/e2e.yml), placed before the Playwright browser install so a corrupt-canon PR fails the cheap node-only step (~2s) instead of waiting on the full e2e run. Also runs locally as `yarn canon:lint` for a fast committed-canon audit.

Initial-audit finding (2026-05-10): one shipped corrupt utterance — `cvc-words-short-u.json::session.end.opener` carries both an em-dash (U+2014, NOT mojibake'd this time — round-trip preserved the codepoint) and a slash-IPA notation `/s/ /ʌ/ /n/` with the unicode `ʌ`. This shipped silently because the Session-End opener only fires after a full session completes, so per-tier ear-tests of read-line / chip flows would not surface it. Re-bake of this canon entry is filed as a separate cleanup ticket per ticket `86c9qhr9k` scope rules (lint reports, doesn't repair).

**Empirical IPA-outcomes taxonomy** (three classes observed against `en-US-EmmaMultilingualNeural` as of 2026-05-10):

1. **Voice ignores the IPA tag entirely** — the parked `<phoneme ph="tuː">two</phoneme>` case. Azure renders the visible word ("two") via the lexicon and silently drops the `ph=` instruction. No way to force the IPA from the prompt side; the only fix is to switch voices or accept the lexicon. Memory: `project_audio_phoneme_overrides`.
2. **Voice honours the IPA cleanly** — the `<phoneme ph="fɔːr">four</phoneme>` case (PR #115). Azure renders the supplied IPA and the result blends naturally across all utterance types (read, celebration, recap). Use this class as the empirical default expectation when adding a new override.
3. **Voice honours the IPA but the result clashes with surrounding prosody** — the `<phoneme ph="pɪɡ">pig</phoneme>` case (PR #192, reverted same-day). Azure renders the supplied IPA correctly, but the forced phoneme chain blends OK at slow instructional read prosody and robotically at fast cheerful celebration prosody. Same wrap, two contexts, two outcomes — Azure's prosody picker is the variable. **The "test-listen ALL utterance types, not just the one you authored for"** rule falls out of this class: an opener-line ear-test alone would not have caught the celebration regression. Class-3 empirical confirmation is what motivates the "don't add chip/anchor words to global PHONEME_OVERRIDES" rule above.

**Inline IPA wraps mid-English-sentence sound unintelligible** (Thomas's PR #192 ear-test #4, 2026-05-10/11). Confirmed across THREE successive fix iterations: even with all bake-pipeline corruption fixed (charset, em-dash, slash-IPA notation), the opener `"Listen. Short i says ih, not ee. Like pig. Listen: pig."` with `ih`/`ee` IPA-wrapped renders as gibberish to a listener — Thomas heard "listen, short i sesinati... pig listen pig". Mechanism: Azure faithfully renders `<phoneme ph="ɪ">` and `<phoneme ph="iː">` as bare vowel sounds with no consonant transitions. Bare /ɪ/ and /iː/ sandwiched inside fast English speech ("says-/ɪ/-not-/iː/") smush together into a continuous vowel stream that English-listening parsers can't segment into recognizable words. **The IPA wrap mechanism that works in isolation ("Listen to this sound: /ɪ/") does NOT work inline mid-sentence.** This is distinct from the class-3 prosody clash: it's not about Azure picking the wrong contour; it's about the phonetic content itself lacking enough acoustic structure to register as intelligible mid-sentence content. **Implication for future opener authoring:** if you need to teach a phonetic contrast, either (a) put each phoneme in its own isolated utterance with framing pauses, OR (b) drop the IPA wraps and let Azure's lexicon render the spelled-token approximation (e.g. say "ih" as the letters or as a grunt — imprecise but intelligible). Inline IPA wraps in flowing prose are a dead end in this pipeline.

**The failure mode is orthography-independent** (Thomas's iPad ear-test on PR #198 preview, 2026-05-11). PR #194's "fix" for `cvc-words-short-u :: session.end.opener` replaced slash-IPA notation (`/s/ /ʌ/ /n/`) with English-letter approximations (`Sss, uh, nnn.`), reasoning that Azure was vocalizing the slashes literally. Lint passes (ASCII-7, no slashes, no IPA chars); Marian still hears gibberish — Thomas heard "sayan nssr" coming from `"Sss, uh, nnn."`. Azure renders phoneme-demonstration tokens as syllabic noise in ANY orthography: bare-vowel IPA, slash-IPA, OR English-letter spellouts all share the same failure mode. The mechanism is acoustic structure (or lack thereof), not notation. **Generalization:** any text designed to "demonstrate a sound segment mid-sentence" is broken via Azure regardless of how it's spelled. The "switch from IPA to English letters" intuition does NOT rescue the pattern. Phoneme teaching must move to a different surface entirely (isolated utterance with framing pauses, separate intro screen, parent-mediated cue card) — see ticket `86c9qkbvk` (Dave phonetic-teaching v2 design).

**Template-structural prosody clip — independent of IPA wraps** (Devon's celebration-prosody audit, PR #196, 2026-05-10). The `"Yes! [Word]."` celebration template triggers Azure's clipped declarative-tag intonation **regardless of phoneme class** — the audit overturned an initial hypothesis that final stops (`/d/`, `/g/`, `/p/`) were the at-risk class; measured durations across 32 CVC celebrations showed the clip is template-driven, not consonant-driven. Same word in `Read the [word].` / `Let's look. [Word].` / `This one is [word].` renders naturally; only the `Yes! [Word].` shape clips. Voice-level intonation is a black box with no exposed knob — fix surface is **wording**, not voice tuning. Recommended template per the audit: `"Yes! That's a [word]."` (matches the empirically-fine `Read the [word].` 3-syllable function-word ramp). Per-word exception for relational/mass nouns (`mom`/`dad`/`jam`) which can't take an indefinite article — fall back to `"Yes! [Word]!"`. Full inventory + reasoning at [`design/audio-celebration-prosody-audit-2026-05-10.md`](MarianLearning/design/audio-celebration-prosody-audit-2026-05-10.md). **Generalization for future template authoring:** check terminal punctuation + clause structure + lexical content shape before assuming Azure will render naturally; the contour selection is driven by all three.

**Celebration-template grammatical exception list — cross-tier accumulator** (`api/_planner.ts` ~lines 1306-1314). The recommended celebration template `"Yes! That's a [word]."` (from the PR #196 audit above) is grammatically broken for words that cannot take the indefinite article `"a"` — they fall back to a bare `"Yes! [Word]!"` via a hard-coded exception array in the planner. The list accretes a new entry each time a content tier introduces such a word. As of the digraphs-th tier (2026-05-14) it holds 9 entries:

| Word            | Tier                  | Why                                                                 |
| --------------- | --------------------- | ------------------------------------------------------------------- |
| `mom`, `dad`    | short-a / short-o CVC | Relational nouns — "a mom" is unnatural in child-directed speech    |
| `jam`, `gum`    | short-a / short-u CVC | Mass nouns                                                          |
| `hot`           | short-o CVC           | Adjective                                                           |
| `egg`           | short-e CVC           | Vowel-initial — needs "an", not "a" (template is hard-coded to "a") |
| `thin`, `thick` | digraphs-th           | Adjectives                                                          |
| `math`          | digraphs-th           | Mass / non-count noun                                               |

**Pre-check rule for new tiers.** Before a new content tier's spec finalises its word pool, evaluate every target word: _can it take "a [word]" naturally in `"Yes! That's a [word]."`?_ Adjectives, mass/non-count nouns, relational nouns, and vowel-initial count nouns must be flagged and added to the exception array **in the same PR** as the planner directive for that tier. There is no automated guard — it is a manual spec-author + reviewer step, and a missed word ships grammatically-broken celebration audio (`"Yes! That's a hot."`) that no ear-test catches because celebration utterances only fire on correct answers mid-session. Worth adding to the `sibling-tier-checklist.md` per-tier checklist when a tier introduces any such word.

**Test-listen is a Thomas-only gate** for opener PRs. Per Dave's `short-i-opener-phrasing` research and PR #192's structural orchestration limitation: agents can verify rendered SSML markup but cannot ear-test the Azure-rendered output. Opener tickets should pre-stage the Vercel-preview-URL ear-test as an explicit acceptance criterion + document the fallback SSML form (e.g. whole-word IPA wrap on the anchor word) so a one-line text edit + canon re-bake is the recovery path if test-listen reveals robotic prosody. See `feedback_pr_review_routing` for the orchestrator workflow when handing back PRs with ear-test ACs.

> **Provenance note — `short-i-opener-phrasing.md`.** Dave's short-i opener phrasing research (`design/research/short-i-opener-phrasing.md`) was authored 2026-05-10 but sat untracked in the working tree for a month before being committed 2026-06-11 (branch `chore/rd-research-chain-fixes`, same PR as this note). The file was present on disk and correct throughout, but a fresh checkout in that window would not have contained it. This is the same research-citation-chain failure mode documented in `skill-trees-and-content.md` § "Speed-feedback UX — locked ruling (source file provenance)": a Dave research file must be committed before or with any spec or doc that cites it as locked authority.

### Graduation-session bypass

When `isGraduationSession === true`, both canon AND in-memory cache are bypassed ([api/claude.ts:568](MarianLearning/api/claude.ts#L568) and [api/claude.ts:606](MarianLearning/api/claude.ts#L606)). Graduation runs need fresh planner output (the directive supplies an additional novel-pool the canon JSON doesn't carry); caching a graduation response under the standard key would leak novel words into a non-graduation session and shred the dual-gate accounting.

### Per-vowel letter-sounds bypass (Wave 9 — PR #359)

**Two vowel vocabularies — do not conflate.** The planner directive (Haiku-facing user message) uses **bare-IPA** (`ɒ ʌ ɪ ɛ`); the progress field, canon `bakeMetadata`, response envelope, and `SessionHistoryEntry.currentTargetVowel` all use **slash-LETTER** (`/o/ /u/ /i/ /e/`). Two maps in `api/_planner.ts` bridge them: `SLASH_VOWEL_TO_IPA` (progress→directive) and `IPA_TO_LETTER_VOWEL` (the `CURRENT TARGET VOWEL: /<vowel>/` envelope line → history stamp). The envelope field is slash-LETTER so the browser stamps `currentTargetVowel` **verbatim**, closing the session-end write loop with no client-side IPA table. Mixing the two forms is a silent bug — both are valid strings, no type error.

**Bypass predicate keys on non-fallback state, not field-presence.** Unlike `leitner`/`slowFacts` (bypass on non-empty), letter-sounds bypasses canon + cache only when `letterSoundsVowelStates` is **beyond all-`'intro'`**. All-intro derives `/o/` = the baked default, so it stays canon-served — preserving the cost ceiling on the first-ever letter-sounds session. Bypass fires only once a vowel has advanced, forcing a live Haiku run that can target the specific vowel.

| Signal                    | Bypass trigger                                  |
| ------------------------- | ----------------------------------------------- |
| `isGraduationSession`     | flag true                                       |
| `leitner` / `slowFacts`   | array non-empty                                 |
| `letterSoundsVowelStates` | **any vowel beyond all-`intro`** (not presence) |

**Canon `bakeMetadata.perVowelTrackingActive: true`** was added to `letter-sounds.json` as a one-line additive field (W9.3) — metadata only, no utterance/audio re-bake. Runtime behaviour is driven by `progress`, not this flag.

## Rate limiter

[api/\_rateLimit.ts](MarianLearning/api/_rateLimit.ts) — sliding-window deque, per-IP, in-memory.

`createRateLimiter({ limit: 6, windowMs: 60_000 })` ([api/claude.ts:331](MarianLearning/api/claude.ts#L331)) — 6 requests / 60 s. Calibrated for "kid spams F5 / brother runs the iPad in a loop" without inconveniencing legitimate disrupted-and-restarted sessions.

`check(key, nowMs)` is the entire surface. The check IS the record — if `allowed: true`, the timestamp is already counted toward the bucket. On block, returns `retryAfterSec` derived from when the oldest in-window entry will fall out (`Math.ceil(msUntilFree / 1000)`).

### Limitations (acknowledged, by design)

- Cold container = empty bucket. Determined attacker can defeat. Threat model is "8-year-old's iPad in a tight loop", not professional adversary.
- One Vercel deployment may have several warm instances behind the LB. Effective per-IP limit is `limit × instance_count`. Adequate as a soft guardrail.
- Source IP comes from `x-forwarded-for` (leftmost) → `x-real-ip` → `'unknown'` fallback ([api/claude.ts:356](MarianLearning/api/claude.ts#L356)). Unknowables share one bucket — conservative over-throttle.

If this app ever became multi-tenant, swap to Redis-backed.

## Session cache

[api/\_sessionCache.ts](MarianLearning/api/_sessionCache.ts) — module-scoped Map, 5-minute TTL, max 16 entries.

`buildSessionCacheKey({ track, level, childName, focusNode? })` ([\_sessionCache.ts:82](MarianLearning/api/_sessionCache.ts#L82)) — pipe-joined, escapes literal `|` chars in childName/focusNode. Keyed on `(track | level | childName | focusNode)`. `recentSuccessRate` is NOT in the key — continuously variable, would shred hit rate; the planner uses it as a soft hint, not a hard branch.

`get` returns a deep-cloned response so callers can't mutate the cache entry. JSON round-trip is the simplest correct approach (response is plain data). `set` deletes-then-inserts on existing keys (LRU-on-write); evicts expired entries first, then oldest-by-insertion-order if at cap.

Worst-case memory: ~3 KB per utterance × 60 utterances × 16 entries ≈ ~3 MB. Well under Vercel's function memory budget.

After D (canon-first), this cache only catches canon-misses that recur within a single function-instance lifetime — e.g. a future Marian focus node not yet in canon, or a staging deploy where canon hasn't been regen'd yet.

## Anthropic billing surface

Pre-paid, no auto-reload. When the balance hits zero:

- **All builds fail** — the `prebuild` step runs `scripts/generateSessionCanon.ts`. Without Anthropic credit, the script either soft-fails with a warning (default, build still ships without canon) or hard-fails (`--require-keys`). Today the npm `prebuild` script omits `--require-keys` so a fresh clone of the repo can build without secrets.
- **Production runtime survives** — canon is on CDN. As long as the committed JSON files cover the active focus nodes, session-start serves from canon and bills nothing on Anthropic. The fallback live-pipeline code path also bills nothing if the request never hits it.
- **New focus nodes / prompt changes** — these require a fresh `canon:regen` run (which requires Anthropic balance). The `[api/claude] canon-miss` log line ([api/claude.ts:619](MarianLearning/api/claude.ts#L619)) surfaces uncovered combos; if production shows misses for combos we expected to bake, the generator needs a re-run or the combo set needs extending.

Manual top-up required at the Anthropic console. See `project_anthropic_billing_constraint.md` and `project_canon_commit_strategy.md` memory entries.

## API testing

Test files sit alongside the modules: `_tts.test.ts`, `_planner.test.ts`, `_canon.test.ts`, `_rateLimit.test.ts`, `_session.test.ts`, `_sessionCache.test.ts`, `claude.test.ts`.

### Vitest environment

Server-only modules carry `@vitest-environment node` at the top of the test file (e.g. [api/\_tts.test.ts:1](MarianLearning/api/_tts.test.ts#L1) and [api/claude.test.ts:1](MarianLearning/api/claude.test.ts#L1)) so they run in Node, never jsdom.

### Mocking pattern for Claude calls

[api/claude.test.ts](MarianLearning/api/claude.test.ts) exercises the handler directly via the named `handler` export, passing `HandlerOverrides` ([api/claude.ts:404](MarianLearning/api/claude.ts#L404)):

- `anthropicClient` — a stubbed `PlannerAnthropicClient` returning a fixed plan body. `makeStubAnthropicClient(responseText, capture)` ([api/claude.test.ts:41](MarianLearning/api/claude.test.ts#L41)) captures the SDK args so tests can assert prompt shape.
- `rateLimiter` — fresh `createRateLimiter` per test for isolation.
- `sessionCache` — fresh `createSessionCache` per test.
- `now` — pinned clock for windowing tests.
- `getCanonEntry` — stubbed for canon-hit/miss tests without touching the filesystem.

The TTS render is mocked via `vi.mock('./_session.js', ...)` at the top of `claude.test.ts` so the handler picks up a deterministic `renderSessionAudio` fake. **The mock specifier MUST match the source import specifier exactly** — handler imports `'./_session.js'`, mock keys on `'./_session.js'`.

### Vitest is not run by Vercel CI

Vercel only runs `vite build`. Vitest must be run locally before merging — `npx vitest run`. See `feedback_run_vitest_before_merge.md` memory entry. Playwright e2e runs via GitHub Actions; wait for `COMPLETED + SUCCESS` before merging UX-visible PRs (`feedback_wait_for_ci_before_merge.md`).

## Cross-references

- `audio-system.md` — browser-side Howler + IndexedDB + Path A wiring
- `MarianLearning/design/audio-architecture.md` — design rationale for Howler + MP3 over Web Speech
- `project_tts_provider_decision.md` memory — Azure Speech REST locked 2026-04-26; Emma multilingual locked 2026-04-28; F0 → S0 upgrade 2026-05-01
- `project_audio_phoneme_overrides.md` memory — IPA override pattern + `four` lock-in
- `project_planner_parser_contract.md` memory — widen browser parser BEFORE widening planner
- `project_canon_commit_strategy.md` memory — canon committed to repo; only regen on prompt change
- `project_anthropic_billing_constraint.md` memory — pre-paid, build-fail mode, runtime survives
- `project_vercel_runtime_config.md` memory — never override `runtime: 'nodejs'`
- `feedback_run_vitest_before_merge.md` memory — Vercel CI doesn't run tests
- `feedback_wait_for_ci_before_merge.md` memory — wait for Playwright COMPLETED + SUCCESS
