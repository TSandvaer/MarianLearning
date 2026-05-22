# Architecture Overview

What this doc covers: the top-level shape of the Marian Tutor PWA — entry points, the route state machine, App-level providers, the first-launch vs. returning-user branches, dependency stack, and the build pipeline. Per-screen behaviour lives in [`screens-and-flows.md`](./screens-and-flows.md); audio, progress, and content systems each have their own doc — see Cross-references at the bottom.

## Entry points

- [`MarianLearning/src/main.tsx`](MarianLearning/src/main.tsx) — bootstraps `<StrictMode><App /></StrictMode>` into `#root` and registers the Workbox-generated service worker via [`MarianLearning/src/pwa/registerServiceWorker.ts`](MarianLearning/src/pwa/registerServiceWorker.ts). 15 lines, no surprises.
- [`MarianLearning/src/App.tsx`](MarianLearning/src/App.tsx) — single source of truth for the route state machine, audio pre-warm gates, Path A fetch lifecycle, and prop wiring into screens. ~1000 lines.

Two side-effects run at module load, **before** the React tree imports:

- [`disableHowlerAutoSuspend()`](MarianLearning/src/App.tsx#L93) — flips `Howler.autoSuspend = false`. Defends against the iPad 30-second audio-context decay bug (Phase-8 of ticket 86c9gvd0y). Module-load timing is essential: the Greet chime would fire before a `useEffect` could install the flag.
- [`maybeApplyDebugSeed()`](MarianLearning/src/App.tsx#L103) — applies `?debug=1&seed=<value>` localStorage seeds before any `useState(loadProgress)` initializer. See [`MarianLearning/src/lib/debug/debugSeed.ts`](MarianLearning/src/lib/debug/debugSeed.ts).

## Route state machine

Routes are typed in [`MarianLearning/src/router/route.ts`](MarianLearning/src/router/route.ts):

```
splash | greet | hub | math | literacy | session-end | reward | parent-settings
```

`FIRST_ROUTE = 'splash'`. The app deliberately does **not** use react-router; routes are addressed only by in-app state, no URLs (rationale documented in [`route.ts`](MarianLearning/src/router/route.ts#L1-L13)).

Initial route resolution: [`getInitialRoute()`](MarianLearning/src/App.tsx#L112-L133) honours an optional `?route=<name>` query param for QA deep-launches; otherwise falls back to `FIRST_ROUTE`.

### Route transition handlers

All handlers live as `useCallback` on [`App`](MarianLearning/src/App.tsx#L219). They are the _only_ path through which `setRoute` is called.

| Handler                       | File:line                                               | Routes from → to                                                               | Notes                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleSplashAdvance`         | [App.tsx:290-308](MarianLearning/src/App.tsx#L290-L308) | `splash` → `greet` (sessionCount === 0) or `splash` → `hub` (sessionCount ≥ 1) | Branches on [`nextAfterSplash()`](MarianLearning/src/App.tsx#L148-L155). Sets `hubEntryPath` to `'app-open'` or `'app-open-recent'` (within 6 h of last completed session). |
| `handleGreetAdvance`          | [App.tsx:316-318](MarianLearning/src/App.tsx#L316-L318) | `greet` → `math`                                                               | First-launch fixed sequence — Greet always lands on Math, never Hub. See [`design/session-1.md`](MarianLearning/design/session-1.md).                                       |
| `handleHubPickTree`           | [App.tsx:331-341](MarianLearning/src/App.tsx#L331-L341) | `hub` → `math` (number-garden) or `hub` → `literacy` (word-song)               | Calls `markTreeTouched(...)` to write `todayTreesTouched` so tomorrow's suggestion alternates.                                                                              |
| `handleHubCharacterLongPress` | [App.tsx:354-356](MarianLearning/src/App.tsx#L354-L356) | `hub` → `parent-settings`                                                      | Triggered after the 3-second Emma long-press.                                                                                                                               |
| `handleParentSettingsExit`    | [App.tsx:359-362](MarianLearning/src/App.tsx#L359-L362) | `parent-settings` → `hub`                                                      | Sets `hubEntryPath = 'mid-skill-back'`.                                                                                                                                     |
| `handleBackToHub`             | [App.tsx:368-371](MarianLearning/src/App.tsx#L368-L371) | `math`/`literacy` → `hub`                                                      | Mid-skill back-arrow. Sets `hubEntryPath = 'mid-skill-back'`.                                                                                                               |
| `handleMathComplete`          | [App.tsx:398-412](MarianLearning/src/App.tsx#L398-L412) | `math` → `session-end`                                                         | Captures `MathSessionResult` into `sessionEndPayload` with `surface: 'math'`.                                                                                               |
| `handleWordSongComplete`      | [App.tsx:414-432](MarianLearning/src/App.tsx#L414-L432) | `literacy` → `session-end`                                                     | Captures `WordSongSessionResult`, forwards `perProblemCorrect` + `targetWords` for the graduation gate.                                                                     |
| `handleSessionEndAllDone`     | [App.tsx:379-382](MarianLearning/src/App.tsx#L379-L382) | `session-end` → `hub`                                                          | Sets `hubEntryPath = 'session-end'`.                                                                                                                                        |

### First-launch sequence

Wired through `handleGreetAdvance` at [App.tsx:316-318](MarianLearning/src/App.tsx#L316-L318):

```
Splash → Greet → Math → SessionEnd → Hub
```

Greet is **once-ever**; the [`nextAfterSplash()`](MarianLearning/src/App.tsx#L148-L155) splash router branches on persisted `sessionCount` and never re-shows Greet on subsequent launches. The literacy + reward stops in the original "Splash → Greet → Math → Literacy → Reward → Hub" pipeline collapsed into the Math → SessionEnd → Hub flow once SessionEnd absorbed the celebration role.

### Returning-user flow

`splash → hub` via [`nextAfterSplash()`](MarianLearning/src/App.tsx#L148-L155) when `sessionCount >= 1`. Hub's entry path becomes `'app-open-recent'` if last completion was within ~6 h (drives a "Back so soon!" greeting variant) or `'app-open'` otherwise.

Storage source: [`MarianLearning/src/screens/SessionEnd/sessionHistory.ts`](MarianLearning/src/screens/SessionEnd/sessionHistory.ts) under key `marian-tutor.session-history.v1` (lazy v1 → v2 migration on read).

## App-level providers and global wiring

Inside [`App`'s render](MarianLearning/src/App.tsx#L941-L1015):

- `<LazyMotion features={domAnimation} strict>` — Framer Motion's lazy-feature shell. Every screen uses `<m.*>` (lowercase) so per-screen mounts don't pay the LazyMotion init cost.
- `<MotionConfig reducedMotion="user">` — honours iPadOS "Reduce Motion" globally; springs collapse to fades and infinite-repeat pulses freeze.
- `<AnimatePresence mode="wait">` — owns screen mount/unmount choreography. Each route renders one screen with a stable `key`.
- `<DebugOverlay>` — gated on `?debug=1`, persists across screen transitions (sits **outside** AnimatePresence). See [`MarianLearning/src/lib/debug/DebugOverlay.tsx`](MarianLearning/src/lib/debug/DebugOverlay.tsx).
- `<PendingResumeAffordance>` — iPad PWA visibility-recovery "tap to continue" affordance. Mounted outside AnimatePresence so a backgrounded mid-transition session still gets it. See [`MarianLearning/src/components/PendingResumeAffordance.tsx`](MarianLearning/src/components/PendingResumeAffordance.tsx).

The app does **not** wrap children in a HowlerContext. The audio system is a module-level singleton — see `audio-system.md`. Lifecycle hooks like [`useHowlerSuspendOnHide()`](MarianLearning/src/App.tsx#L228) install a single document-level listener at the App root.

## Audio pre-warm lifecycle (App-owned)

App owns two parallel Path A audio fetch lifecycles — one for Math, one for Word Song. Each has:

- A fallback static plan ([`mathFallbackPlan`](MarianLearning/src/App.tsx#L516-L519), [`wordSongFallbackPlan`](MarianLearning/src/App.tsx#L802-L805)) — `useMemo([])`-stable, used until the server plan resolves.
- A server-derived plan in state (`mathPlan`, `wordSongPlan`).
- A live `playUtterance` function in state (`mathPlay`, `wordSongPlay`).
- A once-per-session latch (`mathFetchStartedRef`, `wordSongFetchStartedRef`) and an abort controller ref.
- An audio-ready gate boolean (`mathAudioReady`, `wordSongAudioReady`) flipped on resolve OR reject.

Math fetch kicks on `route === 'greet' || route === 'math'` — see [App.tsx:607-712](MarianLearning/src/App.tsx#L607-L712). Starting on Greet's mount gives the network ~8-15 s while Marian taps through the 4-line intro.

Word Song fetch kicks on `route === 'hub' || route === 'literacy'` (ticket 86c9pr4h9). Hub is the chosen pre-warm anchor because every Word Song entry passes through Hub first — returning users land Splash → Hub directly, and first-launch users reach Hub via Greet → Math → SessionEnd → Hub before any literacy attempt. Pre-86c9pr4h9 the kick fired only on `literacy`, which made Marian wait the full cold render (Haiku call + 8× Azure TTS renders + canon lookup) AFTER the route flip; on real iPad signal (Marian, 2026-05-08) this was a noticeable wait Math did not have.

Tear-down effects ([math: 740-792](MarianLearning/src/App.tsx#L740-L792), word-song leave-effect) deliberately keep audio alive through `route === 'session-end'` because SessionEnd's celebration utterances share the same howl-singleton; unloading on `math → session-end` would brick the goodbye sequence (ticket 86c9kj2u6). The Word Song leave-effect ALSO excepts `route === 'hub'` (added in 86c9pr4h9) so the `splash → hub` pre-warm fetch survives the route flip — without that exception the kick-effect and leave-effect would fire in the same commit and the leave-effect would abort the just-started fetch.

The post-Word-Song-session teardown that the prior leave-effect drove on `literacy → hub` is now driven imperatively from `handleSessionEndAllDone` (when `sessionEndPayload?.surface === 'word-song'`) and `handleBackToHub` (when `route === 'literacy'`). The leave-effect remains the safety net for any other exit (e.g., `hub → parent-settings`). The teardown body is wired through `tearDownWordSongAudioRef` — declared early in the component body and assigned inside an effect that runs after the word-song refs/state are declared, satisfying React 19's `react-hooks/refs` rule that bars ref mutation during render.

Read more in `audio-system.md` (how pre-warm + `playUtterance` actually fetch + decode audio) and `planner-and-canon.md` (what the server returns).

## Progress hint piping

[`readProgressHintsForTrack()`](MarianLearning/src/App.tsx#L175-L203) reads `loadProgress()` once per session-start fetch and ships `{ focusNode, recentSuccessRate, isGraduationSession }` into both `prepareMathPathA` and `prepareWordSongPathA` payloads. The server uses these to target the right curriculum slice; on a first-run / no-storage path, all three stay `undefined` and the server falls back to its level-1 default focus node.

`isGraduationSession` only matters for word-song today (it's how the planner decides whether to mix in 2-3 novel short-a probe words). See `progress-and-persistence.md` and `planner-and-canon.md` for the full handshake.

### Session-start derived-state blocks in the word-song kick-effect

Beyond `readProgressHintsForTrack()`, the Word Song kick-effect (the `route === 'hub' || route === 'literacy'` effect that fires the pre-warm fetch) also computes **session-start derived state** that must be frozen at fetch time and passed as props into `<WordSong>`. Each new digraph tier with its own visual cue adds one such block. As of PR #236 (digraphs-th mouth-cue wiring), two blocks live inside the kick-effect:

1. **`crossVowelMixing`** ([App.tsx:1148-1162](MarianLearning/src/App.tsx#L1148-L1162)) — reads a `wordSongProgress` snapshot from `loadProgress()` to compute `crossVowelMixingActive` and `focusIsCvcTier`.
2. **`thProgress`** (PR #236) — a second `loadProgress()` call inside the same effect tick, used to extract the `digraphs-th-voiceless` node's `SkillLevel` and compute the `thFirstEncounter` boolean.

Both calls are synchronous on the same localStorage snapshot in the same effect tick, so they are consistent. But as the digraph family grows, each new tier adds another redundant read.

**Refactor trigger:** if a third session-start derived-state block is added (e.g. for the sh/ch corner-cue), refactor the block scopes to share a single `loadProgress()` snapshot declared at the top of the kick-effect body, with each derived block reading from the shared snapshot. The pattern stays correct at 2 blocks; at 3+ the N-redundant-reads code smell outweighs the "one block per feature" clarity benefit.

## Hub progress projection

Hub re-reads progress on every entry into `route === 'hub'` ([App.tsx:262-277](MarianLearning/src/App.tsx#L262-L277)) so a Session-End → Hub flip picks up any freshly-saved promotion state. The snapshot flows through [`projectHubTreeProgress(...)`](MarianLearning/src/screens/Hub/progressProjection.ts) into the `progress` and `pendingPromotion` props.

## Dependency stack

Pinned in [`MarianLearning/package.json`](MarianLearning/package.json):

| Dep                                                    | Version      | Notes                                                                                                                    |
| ------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `react` / `react-dom`                                  | ^19.2        | React 19 (`StrictMode`-aware effects).                                                                                   |
| `vite`                                                 | ^7.0         | Build + dev server.                                                                                                      |
| `tailwindcss`                                          | ^3.4         | Styling. Custom palette tokens: `my-cream`, `my-pink`, `my-rose`, `ink`, `sparkle`.                                      |
| `motion`                                               | ^12          | Framer Motion. **Imports always from `motion/react`** (not `framer-motion`). Use lowercase `<m.*>` under `<LazyMotion>`. |
| `howler`                                               | ^2.2         | Sole audio backend. See `audio-system.md`.                                                                               |
| `@anthropic-ai/sdk`                                    | ^0.91        | Server-side only — invoked from `api/*.ts` Vercel functions. **Never imported from `src/`** (would leak the API key).    |
| `vite-plugin-pwa` + `workbox-build` / `workbox-window` | ^1.2 / ^7.4  | InjectManifest service worker. SW source at [`MarianLearning/src/pwa/sw.ts`](MarianLearning/src/pwa/sw.ts).              |
| `vitest` + `@playwright/test`                          | ^3.0 / ^1.49 | Unit + e2e respectively.                                                                                                 |

The full devDeps + script wiring is in [`MarianLearning/package.json`](MarianLearning/package.json).

## Build pipeline

From [`MarianLearning/package.json`](MarianLearning/package.json#L6-L25):

```
prebuild → tsx scripts/generateSessionCanon.ts
build    → tsc -b && vite build
```

`prebuild` runs the canon-baker [`MarianLearning/scripts/generateSessionCanon.ts`](MarianLearning/scripts/generateSessionCanon.ts). The committed canon JSON lives in the repo so Vercel builds never need to call Anthropic — see auto-memory `project_canon_commit_strategy.md` (PR #136, 2026-05-02). Re-bake locally with `npm run canon:regen` only when prompts change; commit the JSON diff alongside.

Auxiliary scripts in [`MarianLearning/scripts/`](MarianLearning/scripts/):

- `generateSessionCanon.ts` — bakes the canon JSON for both tracks.
- `render-greet-mp3s.mjs` — renders the 4 Greet lines via Azure Speech REST.
- `render-hub-mp3s.mjs` — renders the 18-line Hub welcome-back manifest.
- `render-sfx-mp3s.mjs` — renders SFX (chime, sparkle, plink, poof).
- `post-deploy-smoke.sh` — Vercel post-deploy smoke check.

## Vite + PWA config

[`MarianLearning/vite.config.ts`](MarianLearning/vite.config.ts):

- Build target `es2020`, sourcemaps on.
- `injectManifest` SW strategy with source at [`src/pwa/sw.ts`](MarianLearning/src/pwa/sw.ts).
- `maximumFileSizeToCacheInBytes: 8 * 1024 * 1024` (8 MiB) — bumped from the 2 MiB default to fit the upscaled PNG-in-SVG Emma assets (originally raised to 4 MiB, lifted to 8 MiB in ticket 86c9qa7uh). See [vite.config.ts:112](MarianLearning/vite.config.ts#L112) and auto-memory `reference_pwa_asset_size_limits.md`.
- `globPatterns` precaches JS/CSS/HTML/PNG/SVG/webmanifest/woff(2)/ico/**mp3**. The Greet MP3s are gateway-critical — precached so a fresh PWA install can play offline-first.
- `VITE_COMMIT_SHA` defined from `VERCEL_GIT_COMMIT_SHA` ([vite.config.ts:21-28](MarianLearning/vite.config.ts#L21-L28)) so the debug overlay can show the deployed bundle SHA.
- Vitest config (`test: { environment: 'jsdom', exclude: ['e2e/**', ...] }`) — Playwright e2e is run via `yarn e2e`, not vitest.

### `injectManifest` — rebase conflict magnet

The `injectManifest` block is a **recurring rebase conflict magnet**. Three keys are each edited by separate, independent workstreams:

| Key                             | Edited by                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `maximumFileSizeToCacheInBytes` | Asset-size lifts (Emma SVG upscales, picture-pack additions)                                   |
| `globIgnores`                   | Cache-scope changes (QA-only dirs excluded from precache, e.g. `audio-samples/**` from PR #96) |
| `globPatterns`                  | Precache-scope changes (new file types added to the offline manifest)                          |

The keys are **independent and additive** — a conflict here means both sides touched _different_ keys at the same small object. The correct resolution is always a **union of both sides**; never pick one side wholesale (that silently drops the other workstream's intent — e.g. discarding a `globIgnores` entry re-bloats every installed PWA with QA artifacts; discarding a `maximumFileSizeToCacheInBytes` bump drops an asset past the cache cap). Confirmed on PR #96 (2026-05-14), flagged independently by both the rebaser and the reviewer. **Any rebase dispatch brief for a branch touching `vite.config.ts` should pre-warn: "if `injectManifest` conflicts, take the union of both sides."** Pair with `testing-and-ci.md §7.2` (rebase `--ours`/`--theirs` inversion).

## tsconfig structure

Composite project with four leaves rooted at [`MarianLearning/tsconfig.json`](MarianLearning/tsconfig.json):

| Config                                                    | Includes                              | Notes                                                                                  |
| --------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| [`tsconfig.app.json`](MarianLearning/tsconfig.app.json)   | `src/**` (incl. tests)                | DOM + WebWorker libs. `react-jsx`. Strict + `verbatimModuleSyntax`.                    |
| [`tsconfig.api.json`](MarianLearning/tsconfig.api.json)   | `api/**`, `scripts/**`                | Node types, no DOM. Vercel runtime resolves `Request`/`Response` via `@types/node 24`. |
| [`tsconfig.e2e.json`](MarianLearning/tsconfig.e2e.json)   | `e2e/**`                              | Playwright test sources.                                                               |
| [`tsconfig.node.json`](MarianLearning/tsconfig.node.json) | Node-only build configs (Vite, etc.). |                                                                                        |

No path aliases configured — imports are relative throughout (`'../../lib/audio'` style).

## Cross-references

- [`screens-and-flows.md`](./screens-and-flows.md) — per-screen contracts, state inputs, and ACs.
- `audio-system.md` — Howler singletons, Path A pre-recorded MP3 + Azure Speech REST, gesture-unlock gate, iOS visibility-recovery affordance.
- `planner-and-canon.md` — `/api/claude` shape, canon bake/commit, session plan rehydration.
- `progress-and-persistence.md` — Progress doc shape, mastery rule, Leitner, localStorage keys.
- `skill-trees-and-content.md` — Number Garden + Word Song stage taxonomies, distractor algorithms, word/picture packs.
- `emma-character-and-animation.md` — EmmaCharacter component, pose system, motion patterns.
- `testing-and-ci.md` — vitest + Playwright patterns, e2e helpers, CI flow.
