# Testing and CI

## What this doc covers

The Marian Tutor app has two test runners (vitest for unit/component, Playwright for browser e2e) and two CI workflows (Playwright e2e on every push/PR, post-deploy smoke on every push to `main`). This doc captures how to run each layer locally, how the CI workflows fit together, the e2e helper modules and the gotchas in each one, the canon-aware testing rule, the pre-commit hooks, the per-spec contracts in `e2e/`, and the test-discipline memories the orchestrator enforces. Anything below the test layer (what the screens actually do, what the audio system asserts, what progress shape persists) is out of scope and lives in sibling docs.

---

## 1. Vitest — unit and component tests

The unit and component test runner is **Vitest**, configured in [vite.config.ts:104–124](MarianLearning/vite.config.ts#L104).

### 1.1 Configuration

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  css: false,
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.{idea,git,cache,output,temp}/**',
    'e2e/**',     // critical — keeps Playwright specs out of the jsdom runner
  ],
  coverage: { provider: 'v8', reporter: ['text', 'html'] },
}
```

The `e2e/**` exclude is **load-bearing**. Playwright specs use `.spec.ts` (same suffix Vitest defaults to picking up); without the exclude, `vitest run` tries to import `@playwright/test`'s test fixture API in jsdom and crashes. Run e2e via `yarn e2e` (Playwright runner) instead.

### 1.2 How to run

| Command              | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `npx vitest run`     | Run the entire unit suite once (CI-equivalent).         |
| `yarn test`          | Same as above (`"test": "vitest run"` in package.json). |
| `yarn test:watch`    | Vitest watch mode.                                      |
| `yarn test:coverage` | One-shot run with v8 coverage report.                   |

**Counts on `main` at `68dca10`: ~1420 unit/component tests passing.** The harness picks up co-located `*.test.ts` and `*.test.tsx` files alongside the implementations they cover (e.g. `Hub.test.tsx` next to `Hub.tsx`, `emmaPose.test.ts` next to `emmaPose.ts`, etc.).

### 1.3 Vitest IS in CI (as of 2026-05-22)

The Playwright workflow runs `yarn test` (== `vitest run`) as a step in the same job, **before** the Playwright browser install and e2e suite. This was added in `kevin/ci-vitest-gate` (2026-05-22, retro action 2) to close the trust-the-author gap that let all 11 Waves 3+4 PRs ship without a CI-enforced vitest run — the "I claimed 2597 PASS but didn't actually run it" failure mode.

The step lives in [.github/workflows/e2e.yml](MarianLearning/.github/workflows/e2e.yml) between the canon-lint step and the Playwright browser cache step. It fires fast (~2 min on cold-cache CI runner) so a vitest regression fails the cheap node-only portion of the workflow before the expensive browser install + 35-min e2e budget kicks in. The `yarn test` invocation matches the local script in `package.json` so authors running locally exercise the exact same command CI runs.

The pre-commit hook (§5) still runs `tsc --noEmit` and `lint-staged` — type errors + lint violations are caught at commit time. CI vitest is the regression gate; pre-commit is the early-feedback gate. The orchestrator's `feedback_run_vitest_before_merge` memory rule is now redundant for the CI signal (vitest can no longer be skipped at merge) but remains relevant as the "catch it locally before pushing" early-feedback discipline.

Baseline on `main` post-Wave 4: **2597 passed / 5 todo / 1 skipped** (87 test files). Future PRs that drop below this count without explanation should be flagged in review.

### 1.4 Test setup

[src/test/setup.ts](MarianLearning/src/test/setup.ts) wires the standard testing-library matchers, jsdom polyfills, and `fake-indexeddb` for localStorage / IndexedDB-adjacent code paths. `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` are the core component-test API.

---

## 2. Playwright — e2e browser tests

The e2e runner is **Playwright**, configured in [playwright.config.ts](MarianLearning/playwright.config.ts).

### 2.1 Why Playwright (not Cypress)

Native **WebKit** (Safari engine) ships with the runner. The PWA target is iPad Safari standalone, so WebKit-engine coverage is non-negotiable; Cypress is Chromium-only.

### 2.2 Browser matrix

Two projects: **chromium** + **webkit**. Both pinned to iPad Pro portrait viewport `1024 × 1366` (the manifest pins `orientation: portrait-primary` so landscape isn't a target). Touch emulation is on for both — Hub long-press hooks need it.

Firefox is intentionally NOT in v1 — Marian's device matrix is iPad first, desktop second; Firefox engine has no Safari signal.

**WebKit headless has no `AudioContext`.** This means audio-dependent tests skip on webkit: the read-aloud effect's `getHowlerRunning()` predicate stays `false` forever and chips never enable. Specs that don't need read-aloud completion run on both browsers (typically tests 1–2 of a spec); specs that need read-aloud to fire (everything from "the first chip becomes tappable" onward) are chromium-only. Real iPad Safari is unaffected — it has a working `AudioContext` post-gesture.

### 2.3 How to run

| Command                                                      | Purpose                                           |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `yarn e2e`                                                   | Run the entire suite (`playwright test`).         |
| `yarn e2e:ui`                                                | Interactive Playwright UI mode.                   |
| `yarn e2e:install`                                           | First-time install of chromium + webkit binaries. |
| `yarn e2e -- e2e/<file>.spec.ts --workers=1 --reporter=list` | Run one spec serially with line-level output.     |

The `--workers=1 --reporter=list` form is the canonical "I'm debugging one spec, give me readable output" recipe. The default reporter on local is `list`; on CI it's `[github, list]`.

### 2.4 Web server: `vite preview` against the production build

```ts
webServer: {
  command: 'yarn build && yarn preview --host 127.0.0.1 --port 4173 --strictPort',
  url: 'http://127.0.0.1:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 3 * 60 * 1000,
}
```

Tests run against the SAME artefact Vercel serves on a real prod hit. This is closer to what Marian actually loads than `vite dev`. The build step adds ~30s on a cold cache; the timeout is 3 min.

### 2.5 Mock strategy for `/api/claude`

Tests intercept at the Playwright route level (see `e2e/_helpers/mockClaude.ts`). Real Anthropic + Azure pipeline is **never hit** during e2e — keeps the suite deterministic and does not consume the prod budget.

### 2.6 Other config notes

- `timeout: 90_000` per test (vs the 30s default) — math-session walk-throughs take ~30s on the silent caption fallback path.
- `expect.timeout: 10_000` — most assertions converge well under this; a higher ceiling hides slow expectations more than it helps.
- `retries: 2` on CI, `0` locally. Cross-screen audio races sometimes need a flake guard — flag any flake hit so the underlying race gets a regression ticket.
- `workers: 2` on CI to keep memory predictable on GH Actions runners.
- `forbidOnly: !!process.env.CI` — CI fails if `.only` is left in a spec.
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'off'`.
- `contextOptions.reducedMotion: 'no-preference'` so Framer Motion runs the full animation timeline. The reduce-motion path has its own dedicated coverage in unit tests.

### 2.4.1 Port 4173 collision in parallel worktree runs

`playwright.config.ts` hard-pins port 4173 via `--strictPort`. When two worktrees each spawn `vite preview` on the same machine (e.g. two background agents running `yarn e2e` concurrently), `reuseExistingServer: !CI` (true locally, false on CI) causes the second invocation to silently reuse the FIRST worktree's server.

**The silent-reuse failure mode is the dangerous one.** Playwright's health-check hits the already-running server, gets a 200, and declares the web server ready. Tests 1–3 pass against the foreign worktree's build. When the sibling worktree's process ends, the shared `vite preview` exits, and test 4 onward hits `ERR_CONNECTION_REFUSED` — the failure looks like a mid-suite regression, not an infra collision.

**Diagnostic pattern:** if `ERR_CONNECTION_REFUSED` fires starting at a specific test number (not test 1), and the preceding tests passed cleanly, suspect a foreign-server-died collision before suspecting a code regression. Verified 2026-05-13 during PR #208 fix work.

**Mitigation:**

- Run e2e in at most one worktree at a time on the same machine (current policy).
- Alternative: per-worktree port offset in `playwright.config.ts` derived from a `PLAYWRIGHT_PORT` env var, updating `webServer.url` and `--port` flag together.

On CI (`process.env.CI === 'true'`), `reuseExistingServer` is `false` so the second `--strictPort` bind hard-fails immediately rather than silently reusing — this collision only occurs in local multi-worktree workflows.

**Dispatch-density implication:** at most one `yarn e2e` run (Jessica's spec dispatch OR a reviewer running the full suite) across all worktrees simultaneously. Vitest (`yarn test`) is port-free and unaffected — multiple vitest runs in parallel are safe. See `orchestration-concurrency.md` §1.2.

### 2.4.2 Per-role worktree gotchas

Two recoverable errors surface routinely when a reviewing agent (or any second worker) needs read-only access to a branch that another worktree already has checked out. Both came up during the PR #308 cross-review setup (2026-05-22); flagging here so future setups skip the friction.

**(a) Cannot check out the same branch in two worktrees.** Per the per-role-persistent-worktrees pattern (memory `feedback_per_role_persistent_worktrees.md`), seven sibling worktrees under `C:/Trunk/PRIVATE/` (matt / kyle / kevin / devon / jessica / dave / orch) each track their own working branch. If Kevin's worktree already has `kevin/wave-5-skill-node-split` checked out, attempting the same checkout in Devon's worktree fails with:

```
fatal: 'kevin/wave-5-skill-node-split' is already used by worktree at 'C:/Trunk/PRIVATE/MarianLearning-kevin-wt'
```

**Pattern for read-only review access:** detach-fetch the remote ref instead of checking out the named branch:

```bash
git fetch origin <branch-name>
git checkout --detach origin/<branch-name>
```

The detached HEAD reads identically for review purposes (running `npx vitest run`, `npm run canon:lint`, inspecting files) and never conflicts with the sibling worktree's working state.

**(b) MarianLearning worktrees are flat, not nested.** The project root `C:/Trunk/PRIVATE/MARIAN-TUTOR/` contains a `MarianLearning/` subdirectory holding the actual repo (per §7's "Agent-tool `isolation: \"worktree\"` does NOT work in this project" note — the project root is not itself a git repo). The per-role worktrees (e.g. `C:/Trunk/PRIVATE/MarianLearning-devon-wt/`) are the **flat equivalent**: the worktree root contents directly mirror the `MarianLearning/` contents of the project root. There is no nested `MarianLearning/` inside a per-role worktree.

Running `cd <worktree>/MarianLearning` will fail with `No such file or directory`. Pattern: cd into the worktree root directly to run `npx vitest run`, `npm run canon:lint`, `npx playwright test`, etc.

---

## 3. CI workflows

Two GitHub Actions workflows live at [.github/workflows/](MarianLearning/.github/workflows/).

### 3.1 `e2e.yml` — fast-gate + Playwright on PR + push to main

[.github/workflows/e2e.yml](MarianLearning/.github/workflows/e2e.yml). Runs on every `pull_request` to `main` and every `push` to `main` (post-merge regression coverage). **Feature-branch pushes do NOT fire e2e** — that path was dropped in PR #187 (2026-05-09, ticket `86c9qaxv1`) to halve workflow cost. If you need a CI signal on a feature branch before opening a PR, open a draft PR.

**Two-job structure (PR #311, commit `28c17af`, 2026-05-23).** The single Playwright-included job was split into two:

| Job         | Budget                                  | Steps                                                                     | Purpose                                                                         |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `fast-gate` | `timeout-minutes: 10` (target ~3-5 min) | `yarn typecheck` → `yarn lint` → `yarn canon:lint` → `yarn test` (vitest) | Cheap fast-fail signals; runs first                                             |
| `e2e`       | `timeout-minutes: 35`                   | Playwright install + `yarn e2e` (Chromium + WebKit)                       | Gated by `needs: fast-gate` — no Playwright runner allocated if fast-gate fails |

The serialized `needs: fast-gate` shape (not parallel-no-needs) is deliberate: it saves Playwright runner-minutes on cheap-failure PRs and frees concurrency slots for sibling PRs, at the cost of ~3-5 min added latency on green-fast-gate PRs. PR #311's body documents the runtime-impact table. Adds `yarn typecheck` and `yarn lint` (ESLint) as CI-enforced gates for the first time — closes the same soft-gate gap class as the vitest gate (2026-05-22 retro Action 4). Mitigates the "conclude 'hung' from a single status-check" misdiagnosis pattern from `decisions-while-away.md` — a fast-gate failure now surfaces in 3-5 min before the orchestrator would consider escalating.

```yaml
timeout-minutes: 35
```

The budget is now 35 min — bumped 25 → 35 in `kevin/playwright-workflow-timeout-bump` (PR #281, 2026-05-17) after PR #279 (4 new sub-to-20 tests) cancelled at exactly 25 min on both attempts, and Jessica's PR #275 hit the cap once + completed on rerun. Prior bump 15 → 25 landed in `infra/86c9nc67b-e2e-timeout-bump` (2026-05-09) after PR #168's e2e run capped at 15 min on two consecutive attempts despite the underlying specs passing locally. Earlier bump 5 → 15 happened during the cvc-words-short-o regression spec landing. Cold-cache runs (no Playwright browser cache, no yarn cache) drove the historical cap pressure on slower runners; the 10-min 25 → 35 headroom restores comfortable budget for the current suite size (sub-to-20 + add-to-20 specs in flight) without splitting the chromium/webkit jobs.

Steps:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with `node-version: 20`, `cache: yarn`.
3. `yarn install --frozen-lockfile`.
4. `actions/cache@v4` for `~/.cache/ms-playwright`, keyed on `package.json` hash. Bump key when the `@playwright/test` version bumps so stale caches don't pin outdated browser bundles.
5. `npx playwright install --with-deps chromium webkit` — `--with-deps` pulls the system libraries (libgbm, libnss3, etc.) Chromium / WebKit need on Ubuntu. On a cache HIT this is a no-op for the binaries.
6. `yarn e2e` with `CI=true` — triggers the 2-retry / 2-worker / `[github, list]` reporter shape.
7. Always-upload `playwright-report/` (7-day retention).
8. On failure, also upload `test-results/` traces + screenshots (7-day retention).

**Trigger shape (post-PR #187, 2026-05-09).** Each PR push fires e2e ONCE on the `pull_request` event. Each merge to `main` fires e2e ONCE on the `push` event for post-merge regression coverage. The previous configuration fired e2e twice per PR push (once on `push` matching feature-branch globs, once on `pull_request`); that was the cost driver behind today's $5.71/day spend during high-PR-volume sessions, which is why feature-branch globs were dropped.

**CANCELLED + SUCCESS for the same check.** Concurrency cancel-in-progress is still normal — when a new push lands while CI is mid-run, the older run is cancelled and the newer run runs to completion. CI surfaces both: the cancelled one and the successful one.

**Discriminating timeout-cancel from concurrency-cancel from external-cancel.** `gh run list` and `gh pr view --json statusCheckRollup` both surface `conclusion=cancelled` for THREE distinct causes — and they look identical in list output:

| Cause                      | What happened                                                                             | Correct response                       |
| -------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| **Timeout hit**            | Run elapsed ≥ `timeout-minutes` boundary                                                  | Budget bump on `e2e.yml`               |
| **Concurrency cancel**     | New push landed while run was mid-flight; `cancel-in-progress: true` killed the older run | Normal — no action needed              |
| **External / user cancel** | Someone clicked "Cancel" in the Actions UI, or the billing stop-usage gate fired          | Investigate billing or operator action |

**Diagnostic — compute elapsed time before escalating.** When you see `conclusion=cancelled`, compute `elapsed = updatedAt − createdAt` and compare against the `timeout-minutes` value in `.github/workflows/e2e.yml` (currently 35):

| elapsed vs budget                                                                         | interpretation                                                                                 |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| elapsed ≈ budget (within ~1 min)                                                          | **Timeout hit.** Suite ran too long. Fix: bump `timeout-minutes` (next natural step: 35 → 50). |
| elapsed << budget (seconds to a few minutes) AND a sibling push exists on the same branch | **Concurrency cancel.** Normal. Confirm via `gh run list --branch <branch> --workflow e2e`.    |
| elapsed << budget AND no sibling push                                                     | External cancel (rare) or billing stop-usage gate. Check Actions billing.                      |

**Concrete precedent (PR #304, 2026-05-22).** Session-save file recorded two "cancellations without orchestrator action" on Jessica's failing-first E2E PR. Empirical check via `gh run view`: first run 14:30:20 → 15:02:54 = **32m34s**; second run 15:45:04 → 16:20:26 = **35m22s**. Both ended at the 35-min budget boundary — `timeout-minutes` hits, not external cancels. A 30-min orchestrator investigation merely confirmed the budget is tight; the actual fix is a `timeout-minutes` bump.

**`gh` stale-cache caveat for in-flight or just-completed runs.** `gh run list` and `gh pr view --json statusCheckRollup` cache results on the CLI side (memory rule `[[feedback_gh_pr_checks_stale_cache]]`). For a run that is currently in progress or recently completed, fetch fresh state via the REST API:

```bash
gh api repos/TSandvaer/MarianLearning/actions/runs/<run_id> --jq '{status, conclusion, run_started_at, updated_at}'
```

The `updated_at` field from the REST response is authoritative for elapsed-time math. Do NOT compute elapsed time from `gh run list` timestamps when the run is recent — the list view may lag by minutes.

**Session-resume runtime claims need empirical check.** Wall-clock time since a PR was opened is NOT the same as Actions run duration. A session-save file that records "runs took 2.5h" may mean the PR sat open for 2.5h while two sequential 32-min runs completed — not that either run took 2.5h. Always fetch fresh durations via `gh run view <id> --json createdAt,updatedAt` before treating a CI runtime claim as a mystery. Observed 2026-05-22 — save file claimed "2.5h runtimes" on PRs #302/#303; empirical check showed `32m16s` and `32m06s` respectively, single SUCCESS run each.

**Cost / billing context.** Private repos on personal accounts are billed at $0.008/min Linux. e2e averages ~12 min × 1 run/push, so each PR push is ~$0.10 of metered Actions usage. After free-tier minutes are exhausted, the personal-account default Actions budget is **$0** (creates a stop-usage gate); set a real budget in Settings → Billing → Budgets and alerts → Actions to allow Actions to run.

### 3.2 `post-deploy-smoke.yml` — production smoke on push to `main`

[.github/workflows/post-deploy-smoke.yml](MarianLearning/.github/workflows/post-deploy-smoke.yml). Runs after every push to `main` (i.e. after Vercel auto-deploys main to production at https://marian-learning.vercel.app).

Polls the production `/api/claude` endpoint until it stops returning the previous deploy's response (up to 5 min — Vercel cold-starts can take 30-60s after a push), then runs the smoke assertions in `scripts/post-deploy-smoke.sh`.

Why this exists: PR #28 caused `FUNCTION_INVOCATION_FAILED` at cold-start due to a bad Vercel runtime config export. Unit tests passed because the bad export was inert when imported in Vitest — only Vercel rejected it. The only place this regression class is observable is against the actually-deployed function. Memory rule `project_vercel_runtime_config.md` codifies "never add `export const config = { runtime: 'nodejs' }` to `/api/*.ts`" as the rule the smoke test is the safety net for.

`workflow_dispatch` lets the workflow run manually against an arbitrary base URL — useful for smoking a preview deploy.

### 3.3 Vercel deploy

The Vercel deploy itself is NOT a GitHub Actions workflow — it's a Vercel-side integration:

- Production at https://marian-learning.vercel.app/, auto-deploys on push to `main`.
- PR previews per branch.
- `gh pr merge --auto` is **disabled at the repo level** — see memory `reference_pwa_asset_size_limits.md`.
- Windows yarn `build` has a known EPERM workaround (PR-level documentation; the Linux runner doesn't hit it).

Memory `reference_deploy.md` is the canonical reference.

### 3.3.1 Vercel CDN cache lag for large base64-embedded SVG assets

After a Vercel deploy (production or PR preview) reports **ready**, the CDN may serve the **prior commit's** content for large static assets for **5–15 minutes**. Particularly affected: the base64-embedded SVGs under `public/assets/` (~492 KB to ~3.1 MB each). Vercel's deploy-status page shows the build as green within 1–2 minutes; CDN edge nodes propagate behind that signal.

**Failure mode this enables.** An agent that calls `WebFetch` on a preview URL — e.g. as part of the `emma-character-and-animation.md` §3b "Crop verification" procedure — within ~15 min of the commit push receives the OLD SVG content with no error: `200 OK`, syntactically valid SVG, no visible cache-miss signal. The agent then reads the prior commit's `<image>` offsets, concludes "no error," and issues a confident-but-stale visual-pass report. Observed on PR #235 (2026-05-14): commit `93f8bdd` pushed at 07:00 UTC, Vercel deploy ready at 07:01 UTC, `WebFetch` still returning the old SVG content 8+ minutes later.

**Process implications:**

- For verification steps that fetch large SVG assets, **wait ≥ 15 min after the deploy-ready signal** before fetching. When in doubt, sleep longer rather than retry sooner.
- When opening the preview in a real browser, always **hard-reload** (Ctrl / Cmd + Shift + R) — a normal reload returns the browser-cached page on top of the CDN-cached page.
- Validate freshness by comparing a **known-changed value** in the fetched SVG (e.g. the new `x`/`y` offset on the `<image>` element, the file size in bytes, or a base64 fragment unique to the new commit) against what you expect from the commit. Do NOT rely on the deploy-ready signal alone.
- When an asset fetch returns content that _looks_ plausibly correct but matches the prior commit byte-for-byte, **suspect CDN lag before suspecting a code error.**

**Adjacent gotcha — SVG XML validity.** A different but equally silent failure mode for SVG assets is XML malformation (commonly: `--` double-hyphen inside `<!-- ... -->` comment blocks, which the spec forbids). The browser shows a parser-error page instead of the asset; visual-pass verification by an agent reading the SVG source + analyzing the source PNG will silently pass while no pixels are rendered. See `emma-character-and-animation.md` §3b "Step 0 — XML validity check" for the gate and the named `--`-in-comments trap (observed PR #235, commits `93f8bdd` → `eb4a702`).

### 3.3.2 Vacuous CI on asset-only PRs — green ≠ valid

**The failure mode.** A PR that commits a new file under `public/assets/` — SVG, image, font, audio — but does **not** wire that asset into any rendered screen will produce a **green Playwright CI even if the asset is completely broken.** Playwright loads app screens; if no screen references the new asset, the asset is never fetched, never parsed, never rendered. CI passes vacuously.

**Observed on PR #235 (2026-05-15).** Commit `93f8bdd` shipped `emma-th-mouth.svg` with XML-malformed comments (`--` inside `<!-- ... -->`, forbidden by spec). Browsers refused to parse it; `python -c "import xml.etree.ElementTree as ET; ET.parse(...)"` confirmed invalidity. Playwright nonetheless returned **success** — `emma-th-mouth.svg` isn't wired into any screen yet (the wiring PR is a separate ticket). The malformation only surfaced when Thomas opened the file directly in a browser.

**Scope.** Any asset-only PR is affected. Also applies when the wiring exists but is gated behind a route or feature flag that no e2e spec visits.

**Validity gates that actually work for asset-only PRs:**

| Gate                                                                                                         | When it fires                             | What it catches                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local XML parse (SVGs) — `xmllint --noout` / `python -c "import xml.etree.ElementTree as ET; ET.parse(...)"` | Before push                               | Any structural XML malformation (double-hyphen comments, unclosed tags, malformed attributes) — see `emma-character-and-animation.md` §3b "Step 0" |
| Visual inspection at the Vercel preview (open the asset URL directly)                                        | After deploy, ≥ 15 min CDN lag per §3.3.1 | Render failures, crop misalignment, wrong-background bleed — see `emma-character-and-animation.md` §3b "Crop verification"                         |
| The wiring PR's own CI                                                                                       | When a screen first references the asset  | Real e2e validation — Playwright fetches the asset; render failures surface as test failures                                                       |

**Process implication for `feedback_wait_for_ci_before_merge`.** The wait-for-green-CI rule remains procedurally correct for asset-only PRs — never merge red CI. But green CI on an asset-only PR must NOT be read as evidence the asset is valid. Run the local-validation gate before opening the PR, and frame the PR description as "CI green (vacuous — asset not yet wired); validated locally via `xmllint` + visual preview check."

---

## 4. E2E helpers — `e2e/_helpers/`

Three helper modules. All are minor in line-count but load-bearing for spec semantics.

### 4.0 `iPadViewport.ts` — iPad-portrait layout viewport constant (ticket 86c9q7tpu)

[e2e/\_helpers/iPadViewport.ts](MarianLearning/e2e/_helpers/iPadViewport.ts). Exports `IPAD_PORTRAIT_VIEWPORT = { width: 1024, height: 1366 }` — mirrors the `IPAD_PRO_PORTRAIT` constant in [`playwright.config.ts`](MarianLearning/playwright.config.ts). Both projects (chromium + webkit) already render at this viewport by default; the helper formalises it for layout-fit specs that need to read the constant explicitly at the assertion site.

**When to use it.** Any spec that asserts on viewport-relative layout — "row stays inside viewport", "chip stays above the fold", "Emma's body doesn't clip" — should `setViewportSize(IPAD_PORTRAIT_VIEWPORT)` and read `IPAD_PORTRAIT_VIEWPORT.width` directly in the assertion. Don't hardcode 1024 / 1366 magic numbers in spec bodies; if the project ever ships an iPad mini target, the constant changes once.

**Why this pattern matters.** Per `feedback_jessica_first_for_objective_gates.md`: numeric bounds + layout invariants + round-trip data integrity = Jessica's specs (NOT Thomas iPad-smoke). The flower-row overflow on PR #166 (math-visual-groups spilling past the right edge for sums ≥ 14) was a textbook routing miss — that's a viewport-width regression, not a Safari-specific behaviour. Any browser at 1024×1366 with the same content would have failed.

**Pattern for layout-fit specs:**

```ts
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'

await page.setViewportSize({
  width: IPAD_PORTRAIT_VIEWPORT.width,
  height: IPAD_PORTRAIT_VIEWPORT.height,
})

const rect = await page.getByTestId('layout-row').boundingBox()
expect(rect, 'boundingBox null').not.toBeNull()
const right = rect!.x + rect!.width
expect(right).toBeLessThanOrEqual(IPAD_PORTRAIT_VIEWPORT.width)
expect(rect!.x).toBeGreaterThanOrEqual(0)
```

Playwright's `boundingBox()` returns `{ x, y, width, height }` (NOT `{ left, right, top, bottom }`) in CSS pixels relative to the layout viewport — directly comparable to `viewport.width`. Derive `right = x + width` for the right-edge assertion. DPR / physical pixels are not in scope; Marian sees the layout viewport.

The first spec built on this helper is [`e2e/add-to-20-flower-row-fit.spec.ts`](MarianLearning/e2e/add-to-20-flower-row-fit.spec.ts) (ticket 86c9q7tpu).

### 4.1 `seedStorage.ts` — localStorage seeding

[e2e/\_helpers/seedStorage.ts](MarianLearning/e2e/_helpers/seedStorage.ts). Seeds the two persisted blobs the app reads at mount:

- `marian-tutor:progress:v1` — `Progress` document.
- `marian-tutor.session-history.v1` — Hub stats / session count.

**Critical**: seeding happens via `page.addInitScript` BEFORE the first navigation so the App's first render observes the right state. Setting localStorage after `goto()` is too late — the App's mount-time reads have already fired.

#### Exports

| Symbol                                                 | Purpose                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROGRESS_STORAGE_KEY`                                 | `'marian-tutor:progress:v1'`                                                                                                                                        |
| `SESSION_HISTORY_STORAGE_KEY`                          | `'marian-tutor.session-history.v1'`                                                                                                                                 |
| `buildSeedProgress(opts)`                              | Returns a `Progress` object the spec can install. Defaults to the diagnostic baseline; takes `skillLevelOverrides`, `history`, `lastPlayedISO`, `masteryThreshold`. |
| `buildSeedSessionHistory(opts)`                        | Returns a `SessionHistoryV2` blob defaulting to "returning user with 5 sessions and 12 cumulative stardust" (skips first-ever Greet path on Splash advance).        |
| `seedLocalStorage(page, { progress, sessionHistory })` | Installs both via `addInitScript`.                                                                                                                                  |
| `readProgressFromPage(page)`                           | Reads `marian-tutor:progress:v1` back out (used by mastery-promotion spec to assert post-session skillLevels).                                                      |
| `readSessionHistoryFromPage(page)`                     | Reads `marian-tutor.session-history.v1` back out.                                                                                                                   |
| `forceHowlerUnlock(page)`                              | TEST SEAM — directly resumes `Howler.ctx`, sidestepping the gesture-unlock chain (see §4.1.2).                                                                      |

#### 4.1.1 `DEFAULT_SKILL_LEVELS` mirrors `SKILL_NODES`

The internal `DEFAULT_SKILL_LEVELS` constant at [seedStorage.ts:39–58](MarianLearning/e2e/_helpers/seedStorage.ts#L39) MUST mirror the `SKILL_NODES` set in [src/lib/progress/guards.ts:19–40](MarianLearning/src/lib/progress/guards.ts#L19).

Why: the persisted `Progress` document is type-guarded at load time. If `seedStorage` writes a doc whose `skillLevels` is missing a key (e.g. a newly-added node), the guard rejects the whole blob and the app silently reverts to defaults. The seeded test state effectively never lands.

This was **PR #151's e2e fixture bug**: the new `cvc-words-short-o` node was added to `SKILL_NODES` but not to `DEFAULT_SKILL_LEVELS` in seedStorage. The short-o spec's seeded state was rejected by the guard, the app fell back to defaults, and the spec silently asserted against the wrong starting state. See `project_pickup_2026_05_05_*` session memory entries for the post-mortem.

**Rule**: when adding a new skill node to `SKILL_NODES`, **always update `DEFAULT_SKILL_LEVELS` in `seedStorage.ts` in the same PR**. Both mirror to the canonical 18-node literacy + math tree at `2026-05-06`.

#### 4.1.1a Failing-first spec primitives — typing contract (2026-05-13)

Two `seedStorage` typing details are load-bearing when authoring failing-first specs for new progression flows (per `feedback_progression_e2e_mandatory`):

1. **`skillLevelOverrides` is `Record<string, string>`, not `Partial<SkillLevels>`.** `buildSeedProgress` accepts overrides typed as a loose `Record<string, string>` so callers don't need to import the `SkillLevel` union — but this means TypeScript will NOT catch a misspelled node key or invalid level string at the call site. Always cross-check override keys against the canonical `SkillNode` union in `types.ts`. The looser shape is intentional and load-bearing: it lets a failing-first spec seed a node literal that doesn't yet exist in the union (because the canon-wire PR adding it hasn't merged yet). Tightening to `Partial<SkillLevels>` would prevent failing-first specs from seeding not-yet-shipped node keys and break the dispatch model that lets specs precede implementation.

2. **`isSkillLevels` accepts extra keys silently.** The runtime guard at [`src/lib/progress/guards.ts:55-64`](MarianLearning/src/lib/progress/guards.ts#L55) walks `SKILL_NODES` and asserts every required key is present with a valid `SkillLevel`, but does NOT reject extra keys on the blob. Extra keys round-trip through `loadProgress` → `saveProgress` silently. This is what lets a seeded spec's state carrying a future node key survive load/save. If a future "strict guard" change adds `Object.keys(v).every(k => SKILL_NODES.has(k))`, failing-first specs that seed not-yet-canonical nodes will have their state rejected by `loadProgress` and silently revert to defaults — the spec passes green for the wrong reason. **Defend both looser shapes in code review.** Verified 2026-05-13 during PR #206 (Jessica's failing-first short-e E2E spec).

#### 4.1.1b Failing-first E2E timeout sizing rule (2026-05-14)

Failing-first specs that exercise a full progression flow are systematically vulnerable to Playwright's default 90s per-test budget — and the failure mode is silent while the spec is RED.

**Mechanism.** A failing-first spec is authored to fail at an early assertion before the not-yet-shipped behaviour lands (e.g. asserting `skillLevels['cvc-words-short-e'] === 'mastered'` while the node doesn't yet exist). Playwright bails on the first failing expectation, so the spec returns in well under 90s on the RED side — even if a full RED→GREEN walk-through would take several minutes. When the implementation PR lands and flips the spec to GREEN, every prior early-exit step now passes and the test runs to completion for the first time. That completion-run is what blows the 90s budget. CI then reports a timeout, which is indistinguishable at first glance from a real regression in the just-merged PR.

**Concrete example.** PR #206 (Jessica's failing-first short-e progression spec) ran four sessions × ~50s wall time each = ~200s of real walk-through. Playwright's default 90s budget killed the test on its first GREEN run post-#208. Fix was `test.setTimeout(240_000)` at the spec head — ~200s walk-through + ~40s headroom.

**Sizing rule.** For any E2E spec that exercises a full progression flow (multiple complete sessions through mastery), estimate `sessions × wall_time + ≥30s headroom` at authoring time and call `test.setTimeout(<estimate>_000)` in the spec head. Per-session wall time on the silent-caption-walk fallback path (CI's default for chip-enablement) is ~30–50s — measure on one full GREEN run if available, otherwise default to 60s × sessions as a conservative ceiling.

#### 4.1.1c `buildSeedProgress.history` carries the full `SessionHistoryEntry` shape (ticket 86c9xaybc, 2026-05-22)

`SeedProgressOptions.history` accepts a properly-typed `SessionHistoryEntry`-shaped entry. Every additive optional field on the production schema is supported natively:

- `latencyMs?: ReadonlyArray<number>` — M4 Leitner latency capture (PR #167)
- `mathFacts?: ReadonlyArray<{ a, b, op }>` — paired per-problem fact (PR #164 follow-up)
- `perProblemAnswerValue?: ReadonlyArray<number | null>` — math first-tap chip value (PR #286)
- `perProblemAnswerWord?: ReadonlyArray<string | null>` — word-song first-tap chip word (PR #286)
- `novelPoolSuccessRate?: number` — graduation-session novel-pool accuracy (cvc-words)

Use the typed helper directly — no spread / hand-built Progress doc needed:

```ts
const progress = buildSeedProgress({
  skillLevelOverrides: { 'add-to-10': 'practicing' },
  history: [
    {
      dateISO: '2026-05-20T10:00:00.000Z',
      skillFocus: ['add-to-10'],
      successRate: 1,
      latencyMs: [5500, 5700, 5800],
      mathFacts: [{ a: 4, b: 2, op: '+' }],
    },
  ],
})
```

Arrays are deep-copied on the way in, so `as const` and frozen inputs round-trip safely. The helper-side type uses `ReadonlyArray<>` on every array field for the same reason.

**For other Progress-level fields** (e.g. `profile.subitisingScaffoldSessionsObserved`, custom-shaped `mathFactsLeitner.items`, `lifetimeFirstEncounters` non-trivial overrides, `pendingPromotion`), the raw-spread workaround pattern still applies as a stopgap until that field gets the same treatment — file a follow-up ticket once 2+ specs hit the same raw-spread shape on a Progress-level field. The 3-precedent threshold (latencyMs / mathFacts / perProblemAnswerValue+Word) that triggered the `history` widening is the canonical pattern.

**Historical context (pre-widening).** The raw-spread workaround originally read:

```ts
const progress = {
  ...buildSeedProgress({ skillLevelOverrides: {...} }),
  profile: {
    ...buildSeedProgress().profile,
    subitisingScaffoldSessionsObserved: 3,
  },
}
```

…and the three `SessionHistoryEntry` precedents that drove the widening were `latencyMs` (slow-fact directive injection spec, PR #167 follow-up), `mathFacts` (paired in the same path), and `perProblemAnswerValue` / `perProblemAnswerWord` (Jessica's back-compat seed test in PR #288). The widening PR (`86c9xaybc`) migrated `slow-fact-directive-injection.spec.ts`, `sub-to-10-slow-fact-warmup.spec.ts`, and `schema-answer-value.spec.ts` off the raw-spread.

**TypeScript widening note — "tightening that costs nothing" (Kevin NOF #2, PR #294, 2026-05-22).** The widening also tightened `skillFocus` from `string[]` to `ReadonlyArray<SkillNode>`. Every existing caller passes literal node strings (`'add-to-10'`, `'cvc-words'`, etc.) in array-literal position, so TypeScript's contextual typing narrows them at the callsite — zero caller-side changes needed across ~20 specs. **Generalisable pattern when widening helpers:** if every existing caller uses literal-typed values in array/object literals, you can tighten the type without touching callers. A caller passing a `let skillFocus: string[]` variable would need `as SkillNode[]` opt-out, but no such caller exists in the e2e tree today. Worth checking for similar tightening opportunities on future helper widenings before assuming the widening is purely additive.

**Detection rule for code review:** any new `e2e/*.spec.ts` that calls `buildSeedProgress` AND spreads its return value to inject a _Progress-level_ field is a candidate to flag for native widening. Don't block the spec PR on it; file a follow-up ticket. (Spec-level `history` entries no longer need the spread — they go through `SeedProgressOptions.history` directly.)

**Why the default isn't enough.** The 90s ceiling at [playwright.config.ts](MarianLearning/playwright.config.ts) is sized for single-session golden-path specs (one Math session, one Hub-to-Math flow). Multi-session progression walks exceed it by construction. The config-level number stays at 90s because raising it globally would mask non-progression slow paths.

**Failure-mode taxonomy when a progression spec is added without explicit `test.setTimeout`:**

| State                           | Observed                               | Misdiagnosis risk                                                 |
| ------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Spec lands RED (pre-impl)       | Passes in <90s — early-exit happy path | None — the spec is doing its job.                                 |
| Impl PR merges, spec runs GREEN | Times out at 90s                       | High — looks like a regression in the impl PR, not a budget miss. |

The misdiagnosis risk is the actual cost: a budget timeout post-merge gets triaged as "the implementation broke something" before anyone notices the spec just needs a higher ceiling. The rule "set the timeout at authoring time" front-loads the fix to when the spec author has the wall-time number in their head.

#### 4.1.1d Failing-first checklist — trivially-green trap with `failNetwork` + operator/range assertions (Jessica NOF, PR #275, 2026-05-17)

When verifying that a new test is RED on base (pre-fix state) and the test uses `installClaudeMock(page, { failNetwork: true })` AND asserts on `op`, operand range, or answer range:

1. Check what `pickStaticSessionPlan` returns for the test's `focusNode`. For any focus that is NOT `add-to-20`, the static plan is add-to-10 rotation (`op: '+'`, `correct ∈ [3,10]`).
2. If the assertion is satisfiable against that add-to-10 plan, the test will be **trivially-green from authoring onwards** — passing on base, passing post-fix, never a real RED lever. This is a spec defect, not a flake. The fix is either to replace `failNetwork: true` with the tier's canon-serving mock (so the assertion exercises real canon state) or to change the assertion to a progression-only one that is genuinely focus-agnostic.
3. A test that passes trivially under `failNetwork` proves nothing about whether the rebaked canon functions end-to-end. "Test X is GREEN post-merge" is only meaningful if the mock is serving real tier canon bytes — not the add-to-10 static fallback. Triggered 2026-05-17 on PR #275 (Jessica's sub-to-20 E2E): Test 3 passed trivially under add-to-10 fallback, was classified as "RED on base + GREEN post-fix," but was not validating sub-to-20 behaviour at all.

#### 4.1.1e Negative-membership trivially-green trap — excluded value-set excludes all plausible fallback ranges (Devon NOF, PR #279, 2026-05-17)

A sibling of §4.1.1d. The trap fires when a spec asserts the **absence** of a value (`tenCount === 0`, "value 10 NOT in chip row") under `installClaudeMock(page, { failNetwork: true })` AND that excluded value sits outside every plausible static-fallback range. Such an assertion is **structurally trivially-green under mutation**: even if the focus-aware logic the spec claims to gate were stripped to a no-op, the static-fallback rotation (per §4.1.2 / §4.1.1d) would still not emit the excluded value — because the value lives outside its operand/answer range entirely, not because any cross-tier OOS protection fired.

**Concrete instance (PR #279, 2026-05-17).** Test 4 in `e2e/sub-to-20.spec.ts` asserts `tenCount === 0` to verify cross-tier OOS protection on `sub-to-10`. Under `failNetwork: true`, `pickStaticSessionPlan` returns the add-to-10 rotation (`op: '+'`, `correct ∈ [3, 10]`, summands typically ≤ 7). The value `10` essentially never appears in the chip row of that rotation regardless of whether the cross-tier OOS gate is wired or stubbed to no-op. The negative-membership assertion passes whether the production code is correct or broken — it is **invisible to mutation testing**.

**Fix pattern — positive discriminator via captured request body.** Replace the negative-membership chip-row assertion with a positive assertion against the outgoing `/api/claude` POST body (the served-canon envelope):

```ts
const requests: Request[] = []
await page.route('**/api/claude', async (route, request) => {
  requests.push(request)
  await route.fulfill({
    status: 200,
    body: JSON.stringify(canonicalSubToTenSessionResponse()),
  })
})
// ... drive the flow ...
const body = JSON.parse(requests.at(-1)!.postData()!)
expect(body.skillFocus).toBe('sub-to-10') // positive discriminator
```

This shifts the assertion from "the bad value did not render" (provable for the wrong reason) to "the request shape proves the cross-tier gate fired" (provable only when the gate fired). The pattern mirrors the directive-injection specs documented at the end of §4.1.2 — the captured POST body landed at route-handler entry, ahead of any downstream silent-demote.

**Detection rule for spec authors.** Before writing `expect(...).toBe(0)` / `expect(getByText('<value>')).not.toBeVisible()` / equivalent negative-membership assertions under `failNetwork: true`: ask "Does the excluded value appear in `pickStaticSessionPlan`'s range for the fallback focus (add-to-10: `op: '+'`, `correct ∈ [3, 10]`)?" If no, the assertion is trivially-green under any production state and proves nothing. Re-cast as a positive discriminator on a captured artefact (request body, persisted Progress, data-attribute) instead.

**Detection rule for reviewers.** When reviewing a spec that combines `failNetwork: true` with `.toBe(0)`, `not.toBeVisible()`, `not.toContain`, or `toHaveCount(0)` on a content-or-chip locator: ask the author to demonstrate the assertion fails under a one-line mutation that strips the production logic the spec claims to gate. If the assertion still passes under mutation, the negative-membership trap is firing.

**Defensive pairing rules for the captured-request pattern (Devon NOF on PR #283, 2026-05-21).** The `requests.at(-1)!.postData()!` shape works in the happy path but throws a confusing `Cannot read property 'postData' of undefined` when no request was captured at all (e.g. the flow short-circuited before the network call). Surface the failure mode loudly:

```ts
import type { Request } from '@playwright/test'

const requests: Request[] = []
await page.route('**/api/claude', async (route, request) => {
  requests.push(request)
  await route.fulfill({
    status: 200,
    body: JSON.stringify(canonicalAddToTwentySessionResponse()),
  })
})
// ... drive the flow ...
const mathRequest = requests.find((r) => {
  const payload = JSON.parse(r.postData() ?? '{}')
  return payload.track === 'math'
})
expect(mathRequest).toBeDefined() // loud-fail gate before destructuring
const payload = JSON.parse(mathRequest!.postData() ?? '{}')
expect(payload.progress.focusNode).toBe('add-to-20')
```

Three load-bearing micro-patterns:

1. **`import type { Request } from '@playwright/test'`** is required when calling `postData()` on captured requests. The DOM `Request` type lacks `postData`; without the import the spec compiles against the wrong type and `postData()` is a missing-method error at runtime.
2. **`r.postData() ?? '{}'`** prevents a `JSON.parse(null)` throw when a request has no body. Pair with the `toBeDefined()` gate so silent-empty doesn't masquerade as a successful match.
3. **`expect(mathRequest).toBeDefined()` BEFORE destructuring `mathRequest.postData()`** — without this guard, a missing request produces a confusing destructuring TypeError; with it, the test fails loudly as "no math request captured" pointing directly at the production short-circuit.

Validated on PR #283 (Jessica's add-to-20 defense-in-depth spec) — Test 4 uses this exact pattern to detect Class B (dropped-carry) distractors via captured-body `focusNode === 'add-to-20'` as a second positive discriminator on top of structural-equality of the chip row.

#### 4.1.1f Positive-predicate-too-lax trivially-green trap — pool-category predicate matches wrong-tier static-fallback data (Jessica NOF, PR #290, 2026-05-22)

The mirror of §4.1.1e on the **positive-predicate** side. The trap fires when a spec asserts the **presence** of a value-class via a categorical predicate (e.g. "at least one chip is a near-boundary-no-cross fact") AND the predicate's range is so lax it also pattern-matches the static-fallback wrong-tier rotation that fires under any silent demote (per §4.1.2 / §4.2 / the silent wrong-tier misrender note in `planner-and-canon.md`).

**Concrete instance (PR #290, 2026-05-22).** First draft of `isNearBoundaryNoCross` for the `two-digit-addsub` spec defined the predicate as `(a % 10) + b === 9` for `+`. Intent: catch facts like `21 + 8 = 29` where the ones-digit sum is exactly 9 (just-under-borrow). But the predicate omitted any pool-shape gate on `a`, so the single-digit fact `4 + 5 = 9` (which the static-fallback `add-to-10` rotation emits when `two-digit-addsub` canon fails to parse, per the "silent wrong-tier misrender" pattern in `planner-and-canon.md`) **also satisfies** `(4 % 10) + 5 === 9`. Result: the test passed against the static fallback's `4+5=9` chip just as it would have passed against the real `21+8=29` — trivially-green on the wrong-tier data with no visible signal.

**Fix pattern — pool-shape gate on the predicate.** Add an explicit range gate on the operand(s) that pin the predicate to the spec's tier shape:

```ts
// Wrong — matches add-to-10 fallback data accidentally
const isNearBoundaryNoCross = (a: number, b: number, op: Op): boolean =>
  op === '+' && (a % 10) + b === 9

// Right — pool-shape gated to two-digit-addsub
const isNearBoundaryNoCross = (a: number, b: number, op: Op): boolean =>
  op === '+' && a >= 10 && (a % 10) + b === 9
```

The `a >= 10` clause is the discriminator: it costs nothing on real two-digit-addsub canon, and it locks out the single-digit `add-to-10` fallback rotation that the silent demote would otherwise feed the spec.

**Detection rule for spec authors.** Before writing a positive predicate that counts pool members of a category: ask "does this predicate accept ANY fact from `pickStaticSessionPlan`'s add-to-10 fallback rotation (`op: '+'`, `a + b ∈ [3, 10]`, `a, b ∈ [1, 9]`)?" If yes, add a pool-shape gate (operand range, op-mix, chip-range ceiling) that filters out the fallback. The gate is structurally cheap and converts the predicate from "matches whatever happens to render" to "matches only the tier's pool."

**Detection rule for reviewers.** When reviewing a spec with positive predicates of the form `(a % 10) + b === N` or `a + b === N` or similar arithmetic-shape predicates: mentally substitute the add-to-10 rotation's typical facts (1+2, 2+3, 3+4, 4+5, …, 9+1) into the predicate. If any match without a tier-shape gate, flag for tightening.

**Relationship to §4.1.1d / §4.1.1e.** §4.1.1d was `failNetwork` + wrong-tier static-fallback satisfying op/range assertions. §4.1.1e was negative-membership assertions trivially-green because the excluded value lives outside fallback ranges. §4.1.1f closes the family: positive-predicate assertions trivially-green because the predicate's _categorical shape_ matches fallback data even when the _tier-specific operands_ don't. All three traps share the same root cause — the spec exercises the silent-demote fallback path without realising it.

**Beneficial sibling — incidentally-RED-on-base via fallback range overlap (Devon NOF on PR #290, 2026-05-22).** The mirror image of the trap, and a useful failure-class signal: **per-problem structural invariants that hold ONLY on the tier's compliant pool can incidentally fail on the add-to-10 static-fallback rotation when the fallback's range overlaps the invariant's boundary.** Example: the two-digit-addsub no-regroup invariant requires `(a % 10) + (b % 10) ≤ 9` per problem. The add-to-10 fallback emits facts like `6 + 4 = 10` where units sum equals 10 — incidentally violating the invariant. Result: the structural-invariant assertion goes RED-on-base via fallback overlap, not via tier-shape match. This is **not a trap** — the RED-on-base flips to GREEN once the tier's compliant canon ships (the rebake guarantees units ≤ 9), so the invariant earns its regression-lock status. Worth recognising as a load-bearing lever when designing failing-first specs: pick invariants whose `mathy boundary` overlaps with the add-to-10 fallback's range (1-9 / sum 3-10), not invariants disjoint from it.

**Transitional spec consistency under SkillNode-split / canon-rename split-PR sequencing (PR #308, 2026-05-22).** When a tier ships its SkillNode split (PR A) ahead of its canon rebake + binding activation (PR B) — see [`skill-trees-and-content.md`](skill-trees-and-content.md) § "Canon-file-name vs SkillNode-literal" for the two-digit-addsub instance — the e2e spec straddles the gap. The pattern observed in [`e2e/two-digit-addsub.spec.ts`](MarianLearning/e2e/two-digit-addsub.spec.ts) post-PR-#308: the mock serves the legacy-named canon file regardless of which sibling literal the focusNode resolves to, and on-wire assertions read the new `-no-regroup` literal. This is internally consistent for the PR A landed-state: the planner still emits legacy canon-file-name content, the disk canon is legacy-named, but the SkillNode-on-wire is the new sibling. When PR B lands and activates the binding, the spec needs a **focus-aware mock refactor** — both the canon key the mock serves AND the on-wire SkillNode literal will become the new sibling identifiers, and the mock has to track which sibling the focusNode picker chose. Dispatch brief for the PR-B follow-up should call out the spec refactor explicitly.

#### 4.1.1g Failing-first spec shipped ahead of its activator = RED-on-main CI blocker for all sibling PRs (PR #304 / Wave 5, 2026-05-22)

A failing-first spec merged to `main` _ahead_ of its activator PR — even when force-merged via `gh pr merge --admin` — leaves the spec RED on main for as long as the activator is pending. Every subsequent PR's CI inherits the failure: the spec runs, fails, and reports RED in `gh pr checks` for every sibling branch, blocking all merge work until the activator lands.

**Symptom amplifier — Playwright suite runtime inflation.** Failing-first specs that use `test.setTimeout(240_000)` per §4.1.1b (multi-session progression walks) burn their full per-test budget waiting for the not-yet-shipped behaviour before failing. For Jessica's #304 spec on main HEAD `261cb59` post-force-merge: 3 tests × 240s = ~12 minutes of just-the-RED-waits, on top of the rest of the suite, pushing total Playwright runtime from ~32 min to past the 35-min `timeout-minutes` budget. The pre-merge CI cancels on PR #304 (2× at `32m34s` and `35m22s`) were the inflation symptom, not the cause. See §3.1 "Discriminating timeout-cancel from concurrency-cancel" for the diagnostic when the cancels surface mid-CI.

**Diagnostic before force-merging a failing-first spec.** Before `gh pr merge --admin --squash` on a failing-first spec, run the spec locally against the merge result:

```bash
git fetch origin && git checkout origin/main
npx playwright test --project=chromium <new-spec.spec.ts> --reporter=list
```

If RED → either (a) wait for the activator PR to be ready and paired-merge, or (b) ship a same-turn interim mitigation PR (`test.fixme` wrapper, see below) to keep main green, or (c) revert and re-merge paired. Force-merging without one of these creates a RED-on-main CI blocker for every sibling PR until the activator lands.

**Interim mitigation pattern — `test.fixme` wrapper PR.** When the spec must ship now but the activator is in-flight (e.g. wave timing pressure), the smallest fix is a one-file PR that wraps each top-level `test('...')` declaration in `test.fixme('...')` plus a banner comment block pointing to the activator's ticket:

```ts
// ╭────────────────────────────────────────────────────────────────────────╮
// │ test.fixme INTERIM — pending <activator-PR/ticket> binding activation │
// │ Restore `test('...')` (remove `.fixme`) when <activator-PR> lands.    │
// ╰────────────────────────────────────────────────────────────────────────╯
```

Playwright reports `test.fixme`'d tests as `skipped` with exit code 0, so CI returns to GREEN immediately. The wrapper PR is a single-file edit (3 `test` → `test.fixme` rewrites + banner); cross-review is light. When the activator merges, ship a follow-up PR that removes the wrappers + banner — can be a paired-merge with the activator if the same author owns both.

**Calibration rule.** Force-merging a failing-first spec ahead of its activator should be the exception, not the default. Default discipline per `[[feedback_progression_e2e_mandatory]]` is paired-merge at activator-readiness. The `test.fixme` mitigation lane is the escape valve when the spec is needed on main NOW for some other reason (spec-author handoff, sprint cadence pressure) and the activator can't catch up same-day.

**Banner-citation hygiene under split-PR sequencing (PR #305, Wave 5, 2026-05-22).** The `<activator-PR/ticket>` placeholder in the banner template above must resolve to the PR that _enables removal of the `.fixme`_ — i.e. the canon-rebake / wiring / binding-activation PR whose merge flips the spec from RED to GREEN. NOT the epic family, NOT an infrastructure prerequisite, NOT the spec-defining ticket itself. Under the split-PR pattern (PR A = lint infra / spec / failing-first test; PR B = canon rebake / binding activation, per §6 "Lint-infra split-PR pattern requires a `lintBeforeRebake` failing test"), the banner cites **PR B's ticket, never PR A's**. A future restorer reading the banner expects to land on the PR that, once merged, makes the `.fixme → test` revert safe — landing on PR A instead (which may have _already_ merged ahead of PR B) costs the restorer a re-investigation and risks a premature revert that re-RED's main. The same symmetry applies to any failing-first spec parked ahead of any activator: cite the activator, not the spec's epic, not the spec's own ticket, not any infra prerequisite that ships earlier in the chain.

#### 4.1.2 `forceHowlerUnlock` — the gesture-unlock test seam

Production reality: `AudioContext` starts `suspended`. The first user gesture inside a chain that touches Howler unlocks it. In Marian's iPad PWA flow, that gesture is the Greet wake-tap (first-ever launch) or — for returning users — an empirical tap somewhere on Hub that Howler's document-level click listener catches.

In Playwright headless Chromium / WebKit the auto-unlock chain is brittle: Howler's `click` listener only installs after the first `new Howl(...)` is constructed (which happens during the math fetch resolution), and the user's tap on Hub may have already fired by then. The result is `Howler.ctx.state === 'suspended'`, the read-aloud effect's `getHowlerRunning() === false` short-circuit holds, and chips never become enabled.

`forceHowlerUnlock` sidesteps the gesture chain by directly resuming `Howler.ctx` from the page context. It's the equivalent of "the gesture chain succeeded" without paying the gesture-routing complexity in the harness.

**Production NEVER calls this** — production relies on the real gesture chain. The helper is a TEST SEAM to bridge the headless-browser gap. WebKit headless gets a stub-shape `Howler.ctx = { state: 'running' }` because it doesn't expose `AudioContext` at all.

Memory rule `feedback_ipad_first_gesture_testing.md` is the related discipline: when testing real gesture-unlock paths (the "real iPad gesture-unlock e2e" follow-up), the first user gesture must BE the flow under test, not a warmup tap that consumes the unlock event silently.

**`forceHowlerUnlock` silently demotes ANY canonical-MP3 fixture path to the static-fallback plan — not just real Azure canon, but also silent-placeholder MP3 bytes served by the default `installClaudeMock`.** Empirically widened 2026-05-16 (Jessica's PR #239 audit). Its WebKit stub-shape `Howler.ctx = { state: 'running' }` is not a real `AudioContext`, so when a test serves _any_ canonical-fixture bytes — whether real canon via `installDigraphsChClaudeMock` / `installCvcWordsClaudeMock` / `installCvcWordsShortOClaudeMock` / any canon-bytes mock, OR the silent-placeholder `SUQzBA...` blob in `canonicalSessionResponses.ts` served by the default `installClaudeMock` — the MP3 nodes throw `Failed to execute 'connect' on 'AudioNode'` during decode → `prepareWordSongPathA` / `prepareMathPathA` rejects → the screen **silently falls back to `pickStaticWordSongPlan()` / `pickStaticMathPlan()`**, masking any regression and making any content-pinning assertion unsatisfiable. The earlier narrower phrasing ("real canon bytes") understated the failure surface: the silent-placeholder MP3 also fails decode under the stub-ctx, and any spec that PINS canon-specific content (specific addends, specific words, specific utterance text) silently runs against the static fallback instead. The decision rule is therefore:

- **If the spec asserts on canon-specific content** (specific addends like `1 + 1`, specific words like `bat`/`pot`, specific utterance text): drop `forceHowlerUnlock`, add `skipOnWebkitHeadless(testInfo)`, and add a canon-landed gate (`await expect(page.getByTestId('math-addend-a')).toHaveText('X')` or `data-read-aloud-played === 'true'`) before the chip-walk starts. The genuine gesture-unlock chain plus the canon-landed gate is the correct pattern — see `digraphs-ch-content.spec.ts` test 3 (and test 4 after the PR #226 fix, 2026-05-14) and `cvc-words-sub-to-10-content.spec.ts` (PR #239, 2026-05-15).
- **If the spec asserts only on content-agnostic state** (request body shape, persisted `Progress` doc shape, wire fields like `data-read-aloud-played`, gesture-unlock booleans, timing/latency windows, layout bounding boxes, content-derivation patterns that read whatever addends/words render and compare them to a sibling element's data attribute): `forceHowlerUnlock` is harmless — the demote substitutes one plan for another, but the assertions don't pin the plan's content. May be retained. This category includes the 9 specs audited 2026-05-16 (PR drained without changes): `backgrounding-mid-session`, `cold-mount-math-fetch-in-flight`, `add-to-20-flower-row-fit`, `dot-card-affordance`, `latency-band-invariant`, `mastery-promotion`, `path-a-fetch-abort-rapid-route-bounce`, `progression-mastery-loop`, `hub-to-math` — all use `failNetwork: true` OR derive their assertions from rendered DOM rather than pinning canon content. **Follow-up audit 2026-05-16** extended this list with two directive-injection specs that pin the outgoing `/api/claude` POST body, not rendered content: `leitner-directive-injection.spec.ts` (5 tests asserting `payload.progress.leitner` shape — exact `{a,b,op,box}` quadruples from the seeded fixture, count, omission on empty box / first-launch) and `slow-fact-directive-injection.spec.ts` (2 tests asserting `payload.progress.slowFacts` shape — exact `{fact, attempts, correctRate, medianLatencyMs}` from the seeded history, omission on greenfield Marian). Both install a custom local route handler that mirrors `canonicalMathSessionResponse()` and `requests.push(request)` BEFORE `route.fulfill` returns, so the captured POST body is unaffected by any downstream decode failure — the silent demote substitutes the static math plan but the wire assertion landed during the route handler entry. Classified NO-FIX-NEEDED, same content-derivation safety as the audit-9.

Pairs with the §6 corollary ("the GREEN-side mock must serve real tier canon, never `failNetwork`").

**Caption-length canon-landed gates are necessary-but-not-sufficient when no downstream structural discriminator exists (Devon NOF on PR #290, 2026-05-22).** A common canon-landed gate pattern is `await expect(page.getByTestId('math-caption')).toHaveText(/.+/)` (caption has any text). This works fine for specs whose _downstream assertions_ themselves discriminate canon-vs-fallback content (e.g. structural per-problem invariants, captured request body shape, or rendered chip-row arithmetic predicates with pool-shape gates per `§4.1.1f`). But for specs that gate on canon-landed and then assert on a single artifact with no canon-vs-fallback discrimination (e.g. "assert the math-caption text contains 'How many'" — true of both canon AND fallback), the caption-length gate silently passes under the silent-demote fallback. **Rule:** prefer stronger gates (`data-read-aloud-played === 'true'`, or `await expect(page.getByTestId('math-addend-a')).toHaveText('<expected-canon-digit>')`) when the downstream assertion lacks an internal canon-vs-fallback discriminator. Caption-length suffices when the spec's subsequent assertions themselves prove the canon landed.

**DOM-presence-only specs should NOT include `forceHowlerUnlock`.** When a spec asserts only that elements appear or are absent across progression states — no chip taps, no audio path exercised, no `data-read-aloud-played` gate — `forceHowlerUnlock` is both unnecessary (the audio gate never blocks the DOM assertions) and undesirable coupling (it pulls audio infrastructure plus the real-canon incompatibility above into a spec class that has nothing to do with audio). The correct pattern is the same as for any non-audio spec: seed localStorage, navigate, assert DOM. Rule of thumb: if the spec contains no chip taps and no `data-read-aloud-played` assertions, omit `forceHowlerUnlock`. Reference: `e2e/digraphs-th-mouth-cue-display.spec.ts` (PR #236) — 4-state DOM-presence spec that correctly omits it throughout. Together with the rule above: `forceHowlerUnlock` belongs on `failNetwork`-silent-path specs and NO other spec class.

**The canonical "schema-plumbing without canon-content" harness — `forceHowlerUnlock` + `failNetwork: true` (Jessica NOF on PR #288, Devon-confirmed, 2026-05-21).** A distinct spec class with two precedents now: `latency-band-invariant.spec.ts` (PR #1) and `schema-answer-value.spec.ts` (PR #288). The pattern targets a per-problem capture that fires at the chip-tap site **regardless of plan content** — refs like `perProblemAnswerValue` / `perProblemAnswerWord` / `latencyMs` populate identically against the static-fallback plan or the canon plan, because the latch-write happens at the user gesture, not from the canon payload. So the spec can skip the canon-bytes machinery entirely:

- `failNetwork: true` aborts the `/api/claude` route → screen falls into `pickStaticMathPlan()` / `pickStaticWordSongPlan()` → 4-chip math / 3-chip word-song surface still renders with proper `data-correct`/`data-value`/`data-word` attributes.
- `forceHowlerUnlock` brings the gesture-unlock state up so chips become enabled without paying the canon decode chain.
- The chip-tap → ref-write → SessionEnd → localStorage pipeline exercises end-to-end against the static plan.

**Decision rule:** if your spec asserts a per-problem field that's written at the chip-tap site (latency, answer value, answer word, first-tap correct) and NOT pinned to canon-specific content (specific addends, specific words, specific utterance text), reach for `failNetwork: true` + `forceHowlerUnlock`. If your spec needs canon-specific content, you're in the canon-bytes-mock class — see the rule above this one.

**`forceHowlerUnlock` is poison for CANON-SERVED WordSong content specs (W11-03 finding, PR #390 review cycle, 2026-06-12).** When a WordSong spec serves real canon (not `failNetwork`), `forceHowlerUnlock` races the eager 59-howl `buildHowls` in `sessionAudio.ts` and throws `Failed to execute 'connect' on 'AudioNode'` → `prepareWordSongPathA` throws → App silently falls back to the CVC static plan. The spec then asserts against the WRONG render (picture card instead of the tier's real content) and fails for a phantom reason. The passing canon-served content specs (`digraphs-sh-content.spec.ts` test 3 etc.) deliberately omit `forceHowlerUnlock` — follow that pattern. Diagnostic fingerprint: a `connect()` console error + a CVC-fallback render in a spec that expected tier-specific content. Related trap: a payload-only assertion (request body + on-disk canon) stays GREEN through this silent demote — only a rendered-plan assertion (`data-target-word` / content-type on the DOM) catches it.

**Distinct from `failNetwork`-silent-path content-agnostic specs.** Those (the audit-9 listed above) happen to use `failNetwork` because they assert on rendered DOM derivation, not on canon-tap-side captures. The schema-plumbing class is narrower: it specifically asserts on `SessionHistoryEntry` shape after a session. Both classes are content-agnostic; only one is gesture-driven.

#### 4.1.3 Spec-authoring lessons — absence assertions, chip-walk constraints, sub-to-10 DOM seams

Three load-bearing rules surfaced from the sub-to-10 wave (PRs #239 + #242, 2026-05-16). All three sit upstream of `forceHowlerUnlock` (§4.1.2) and the canon-aware testing rule (§6) — get these right at spec-authoring time or the spec is wrong before it ever runs.

**Static absence vs transient absence — choose the polling primitive that matches the element's lifecycle.** Two complementary patterns:

- **Transient absence** (element mounts then unmounts under its own timer — e.g. the dot-card overlay's 1.1 s natural unmount): use a snapshot read at the moment the assertion is meaningful, not a polling expectation. `await locator.getAttribute('data-foo').then(v => expect(v).toBe(...))` catches the moment-in-time state; `await expect(locator).toHaveAttribute(...)` polls and absorbs the unmount, passing for the wrong reason. Reference: original `dot-card-suppression` spec design.
- **Static absence** (element NEVER mounts under the condition — e.g. `math-visual-groups` on `op === '-'`, which is a JSX-conditional guard at [Math.tsx:2218](MarianLearning/src/screens/Math/Math.tsx#L2218), not an attribute-toggled visibility flag): use `await expect(locator).toHaveCount(0)`. Polling is correct here because there is no transient window — the element either exists or it does not, for the entire problem's lifetime. Reference: `sub-to-10-dot-card-suppression.spec.ts` test 1 (op:'-' case, post-PR #242 fix).

**Sub-to-10 DOM-seam caveat — `data-flowers-visible` only lives on the `op === '+'` branch.** The `data-flowers-visible` attribute (and its `flowersVisible` React state) is only emitted on the addition branch of `Math.tsx`. Subtraction suppression is implemented by JSX conditional element absence at [Math.tsx:2218](MarianLearning/src/screens/Math/Math.tsx#L2218), NOT by toggling the attribute to `'false'`. A future spec that reaches for `data-flowers-visible` to assert sub-to-10 invisibility will read `null` and either misinterpret it or write a polling assertion that hangs. **Rule:** for op:'-' invisibility checks on `math-visual-groups`, assert `await expect(locator).toHaveCount(0)`; do NOT read `data-flowers-visible` — the attribute does not exist on the suppressed branch.

**Multi-problem chip-walk specs require real canon bytes, not silent-placeholder MP3s.** A spec that walks past P1 (chip taps from P1 → P2 → P3 → ...) using the default `installClaudeMock` (silent-placeholder MP3 fixture in `canonicalSessionResponses.ts`) AND `forceHowlerUnlock` is structurally guaranteed to hang on the second chip enable. The mechanism: chip on P1 enables via the static-fallback rotation that the `forceHowlerUnlock` demote triggered (per §4.1.2 — the demote fires on silent placeholders too, not just real Azure canon), the spec walks one step successfully, then chip-walk hangs because the demoted plan's next-problem chips never enable in chromium-headless under the stub-ctx. The pattern looks tempting (small fixtures, no canon bake required) but is incompatible. **Rule:** specs that walk past P1 must use a real-canon-bytes mock (`installCvcWordsClaudeMock` / `installCvcWordsShortOClaudeMock` / `installDigraphsChClaudeMock` / equivalent), drop `forceHowlerUnlock`, add `skipOnWebkitHeadless(testInfo)`, and gate the chip walk on a canon-landed predicate (`data-read-aloud-played === 'true'`). If a Class-2-eligible subtraction at P4 is needed and no canon variant covers it, bake a canon variant — though PR #263 demonstrated that the existing PR #253 widened canon (P4=`8-2=6`, Class-2-eligible by `a+b=10 IN`) was sufficient to re-enable `sub-to-10-distractor-class-2.spec.ts` tests 1 + 3 without baking a new variant; verify against current canon before assuming a bake is needed.

Three of the four broken tests Jessica audited in PR #239 hit the chip-walk pattern; all four shared the same `forceHowlerUnlock` + silent-placeholder root cause that the empirical-widening note at the end of §4.1.2 documents.

**Chip-walk gate: use `data-problem-index` (0-based) DOM attribute, NOT `waitForTimeout`** (Jessica NOF #1, PR #263, 2026-05-16). A bare `waitForTimeout(1500)` after a chip-tap races the celebrate-animation → next-problem transition under post-PR-#253 canon runtime — the spec advances "successfully" but reads chip values from the wrong problem. The proper gate is the `data-problem-index` attribute on `[data-testid="math"]` ([Math.tsx:1928](MarianLearning/src/screens/Math/Math.tsx#L1928)). **The attribute is 0-based** while spec helpers use 1-based problem numbers — P1 renders as `"0"`, P4 as `"3"`. Any new chip-walk spec must convert (use `String(i - 1)` if `i` is the 1-based problem number, or `String(i)` if `i` is already the 0-based loop var). The previous `waitForTimeout` pattern silently absorbed this off-by-one; switching to the DOM gate exposes it. Reference: `e2e/sub-to-10-distractor-class-2.spec.ts` `readChipValuesAtProblem` post-PR #263.

**Canon-path resolution happens at module-load via `process.cwd()`** (Devon NOF #3, PR #263 review, 2026-05-16). When a spec reads canon JSON for fixture data (the `readMathCanon()` pattern in `sub-to-10-distractor-class-2.spec.ts`), constants like `SUB_TO_TEN_CANON_PATH` and `ADD_TO_TEN_CANON_PATH` resolve at **import time**, not test time, via `path.join(process.cwd(), 'public', 'canon', ...)`. This works because Playwright runs from the worktree root, but future spec authors copying the pattern should be aware: if the test runner ever invokes from a non-root directory, the path resolves incorrectly. The on-demand wrapper (`readMathCanon()` reading at test time via `JSON.parse(readFileSync(...))`) throws loudly on path mismatch, which is the correct mitigation — prefer the wrapper to module-scope `JSON.parse` of canon bytes.

#### 4.1.4 `storage.test.ts` schema-floor-coverage test (PR #159)

Co-located unit test in `src/lib/progress/storage.test.ts` enumerates every key in `defaultProgress().skillLevels` and asserts each defaults to `'locked'` when the loaded blob has an empty `skillLevels: {}`. This is the CI gate for **`SCHEMA_FLOOR_NODES` in `defaults.ts`** — the third sync point of the **five-place** widening contract (see `progress-and-persistence.md` § "Five sync points when widening `SkillNode`"). PR #160 added the fifth sync point (`cloudSync.ts`'s install-time defaulter mirror); the five-place rule is the current shape.

When adding a new `SkillNode`:

1. Update the union in `types.ts`.
2. Add the literal to `SKILL_NODES` in `guards.ts`.
3. Add the literal to `SCHEMA_FLOOR_NODES` in `defaults.ts` — the schema-floor-coverage test fails here first if missed.
4. Add the literal to `DEFAULT_SKILL_LEVELS` in `e2e/_helpers/seedStorage.ts` — e2e specs fail at seed-time if missed (the production read-path defaulter is NOT in the seed path).
5. Update `cloudSync.ts`'s private `withDefaultedSkillLevels` mirror so cloud-installed blobs default new keys identically to locally-loaded blobs. The `cloudSync.test.ts` `withDefaultedSkillLevels parity` case catches drift here.

**Load-ordering invariant**: `withDefaultedSkillLevels` MUST run before `isProgressV1` in BOTH the `loadProgress` pipeline AND `cloudSync.ts`'s install path; same ordering as `withDefaultedSettings`. If reversed, the strict guard rejects under-keyed blobs before the defaulter can fill them.

#### 4.1.5 `toHaveCount()` counts hidden DOM nodes, not visible ones (PR #363, 2026-06-11)

Playwright's `locator.toHaveCount(N)` counts **every DOM node** matching the selector — including nodes hidden via the `[hidden]` attribute or `display:none`. It is a **DOM census, not a visual census**. When an implementation hides filtered-out rows rather than removing them from the DOM, `toHaveCount(1)` on a filtered list can receive the full unfiltered count.

**Empirical instance (PR #363 voice-qa page cross-review, 2026-06-11).** The `voice-qa.html` page hides non-matching rows via `[hidden]`; a filter that selects one item from 654 leaves 653 hidden rows and 1 visible row in the DOM. An assertion `expect(page.locator('[data-testid^="vqa-item-"]')).toHaveCount(1)` received 654 — matching every row, hidden or not.

**Fix patterns:**

1. **`:visible` pseudo-class filter** — `page.locator('[data-testid^="vqa-item-"]:visible')` restricts to Playwright's own visibility definition (not `[hidden]`, not `display:none`, not zero dimensions).
2. **`locator.filter({ visible: true })`** — `page.locator('[data-testid^="vqa-item-"]').filter({ visible: true })` — Playwright-idiomatic equivalent of the above.
3. **`toBeVisible()` / `toBeHidden()` per row** — for count-1 cases, assert the single expected row `toBeVisible()` and spot-check a hidden sibling with `toBeHidden()` to confirm the implementation hides rather than removes.

**Detection rule for authors and reviewers.** Before writing `toHaveCount(N)` on a selector that matches filterable rows, ask: does the implementation **remove** filtered rows from the DOM (safe for `toHaveCount`) or **hide** them via attribute/style (requires `:visible`)? Inspect the relevant HTML/React source for `hidden`, `display: none`, or a conditional `style` toggle. When in doubt, use `:visible` — it is a strict superset of what `toHaveCount` checks and never over-counts hidden nodes.

#### 4.1.6 Multi-problem chip-walk specs need REAL canon bytes — not `forceHowlerUnlock` (W10.5, PR #368, 2026-06-11)

**The seam split.** In chromium headless, tests that assert only on the **first problem (Q1)** run fine with silent-MP3 mocks — they never depend on audio completing. Any test that **crosses a problem boundary via a chip tap** depends on the read-aloud→chip-enable audio gate releasing, which requires audio that actually decodes and ends. The deciding question is "does this test advance past Q1 via a chip tap?", not "what feature is under test?" — one spec can legitimately mix both mock strategies (W10.5's Tests 1/2/3/5/6 use silent-MP3; only Test 4's Q1→Q2→Q3 walk uses real canon).

**The correct seam:** serve the real on-disk canon JSON verbatim (e.g. `installSubToTenCanonClaudeMock` returning `public/canon/math/level-1/sub-to-10.json` — the `sub-to-10-distractor-class-2.spec.ts` pattern). Real Azure-rendered MP3s decode cleanly in headless chromium, so the chip gate releases naturally across the walk.

**`forceHowlerUnlock` is the WRONG seam here** (empirically hit in the W10.5 fix cycle): its stubbed ctx breaks real-bytes decode → silent demote to the static add-to-10 (`op:'+'`) fallback → the feature under test never mounts → the assertion is structurally unsatisfiable. See §4.1.2's silent-demote caveat. Symptom signature: the feature's Q1 assertion passes but the walk stalls at `toBeEnabled()` with chips stuck `disabled`.

**Mechanical hygiene from the same cycle:**

- **Overlay-and-restore leaves untracked files.** The "overlay another branch's `src/` into this worktree, build, run, restore" workflow (`git checkout origin/<branch> -- src/` … `git checkout -- src/`) restores tracked files only — the other branch's NEW files survive as untracked cruft and need an explicit `rm`. Always end with `git status` and verify only the intended file is in the commit.
- **`netstat` TIME_WAIT entries on :4173 are not a live server.** Only a `LISTENING` bind blocks `vite preview --strictPort`; post-run TIME_WAIT drain is harmless. Filter for `LISTENING` when running the §2.4.1 stale-preview check.

### 4.2 `mockClaude.ts` — `/api/claude` route handler

[e2e/\_helpers/mockClaude.ts](MarianLearning/e2e/_helpers/mockClaude.ts). Routes all `/api/claude` requests away from the real Anthropic + Azure function.

`installClaudeMock(page, options?)` registers the route handler in `beforeEach`. Options:

| Option             | Default                            | Purpose                                                                                                                      |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `mathResponse`     | `canonicalMathSessionResponse`     | Override the math session-start response.                                                                                    |
| `wordSongResponse` | `canonicalWordSongSessionResponse` | Override the word-song response.                                                                                             |
| `failNetwork`      | `false`                            | Force `route.abort('failed')`. App.tsx catches the rejection and Math falls through to its silent caption-walk default.      |
| `delayMs`          | `0`                                | Hold the route in flight before fulfilling/aborting. Lets specs observe the `audioReady=false` window before the gate flips. |

> **`failNetwork` tier-asymmetry warning.** When `failNetwork: true` is set, the app falls through to `pickStaticSessionPlan` (`src/screens/Math/sessionPlans.ts:424-434`). That function has an `add-to-20`-specific rotation for `focusNode === 'add-to-20'` but falls through to the **add-to-10 rotation** for every other focus node — `op: '+'` only, `correct ∈ [3,10]`. Any spec that asserts on `op`, operand range, or focus-keyed content while using `failNetwork: true` for a non-`add-to-20` focus is asserting against the wrong tier's data. See §6 "`failNetwork` + structural assertion + wrong-tier static fallback" for the full failure-class write-up and the detection rule.

The handler routes by `body.kind` (only `'session-start'` is supported today — stumble-explanation / session-end aren't called from browser yet) and by `body.payload.track` (`'word-song'` → wordSong response, anything else → math response).

Unrecognised request shapes return `400 invalid-body` with a loud error message rather than a quiet pass-through, so an unintended live hit cannot pass silently.

CORS preflight (`OPTIONS`) is fulfilled with `204` mirroring the production function's shape, so the browser doesn't drop the body of the real POST that follows.

There are also sibling specialised mocks for the cvc-words flows:

- `installCvcWordsClaudeMock` — returns the bytes of `public/canon/word-song/level-1/cvc-words.json` (short-a).
- `installCvcWordsShortOClaudeMock` — sibling for short-o, returns `cvc-words-short-o.json`.

These specialised mocks exist because reusing `installClaudeMock` would return the canonical short-a fixture for every word-song request and mask the short-o regression (and vice versa). Both also expose **request capture** so specs can assert the planner contract on `focusNode` (which the shared helper doesn't).

#### 4.2.2 Re-installing `installClaudeMock` inside a test overrides the `beforeEach` mock (Jessica NOF, PR #265, 2026-05-16)

Playwright's `page.route()` handlers are first-match-wins on registration order. Calling `installClaudeMock(page, {...})` a second time inside a test body — after the `beforeEach` has already installed the default mock — registers a new handler that takes precedence for the rest of that test. This is the cleanest way to override a single test's Claude response shape without writing a custom-payload sibling helper:

```ts
test.beforeEach(async ({ page }) => {
  await installClaudeMock(page) // default canonical mock
})

test('out-of-scope addends suppress scaffold', async ({ page }) => {
  // Override the default for THIS test only — first-match-wins
  await installClaudeMock(page, {
    mathResponse: customOutOfScopeMathResponse,
  })
  await page.goto('/')
  // ...
})
```

PR #265's tests 2, 4, 5 use this pattern to override the canonical EASY-band response with HARD-band or sub-band shapes. Cleaner than authoring 5 different sibling mocks for 5 one-off shapes.

**Don't try to "uninstall" the previous mock** — there's no `page.unroute(/api/claude/)` call needed; the second `route()` registration is sufficient. Just stack a fresh `installClaudeMock` call with the desired override.

#### 4.2.3 Focus-aware multi-canon mock pattern — first instance, await third adopter before promoting (Jessica NOF #1, PR #279, 2026-05-17)

`e2e/sub-to-20.spec.ts` introduces `installFocusAwareMathCanonClaudeMock(page)` — a one-`beforeEach`-install mock that serves **two different canon JSONs** from a single route handler, keyed on `payload.progress.focusNode`. The pattern is a generalisation of the sibling `installCvcWordsClaudeMock` / `installCvcWordsShortOClaudeMock` pair, but instead of two separate installs requiring per-test setup discipline, a single install routes by focus-node at request time.

**Why one install rather than two.** Playwright's `page.route()` is first-match-wins on registration order (see §4.2.2). Stacking two `installXxxClaudeMock` calls in a `beforeEach` would make the first-registered handler shadow the second for all requests — the second focus's canon would never be served. The focus-aware mock pattern collapses both serving paths into a single handler that branches internally on `payload.progress.focusNode`, eliminating the registration-order pitfall for specs that span a cross-tier focus-switch.

**Promotion rule.** This is the **first** instance of the pattern in the suite. **Do NOT promote to `e2e/_helpers/` yet** — wait for a third adopter (a second tier pair that needs cross-focus canon serving) before extracting a shared helper. Two instances is coincidence; three is a pattern worth naming and abstracting. The CvcWords sibling-helper precedent (`installCvcWordsClaudeMock` + `installCvcWordsShortOClaudeMock`) lived as two parallel mocks for ~2 weeks before the second-install pitfall surfaced in PR #265 (see §4.2.2). For now, copy-paste-adapt `installFocusAwareMathCanonClaudeMock` inline in any new spec that needs the same shape, and surface a follow-up NOF when the third instance appears.

#### 4.3 Additive testid wrapper pattern via `display:contents` (Devon NOF, PR #268, 2026-05-16)

**The coordination problem.** When a new e2e spec needs a new testid on an element that already ships a different testid (used by other specs), there are two paths:

1. **Rename** the existing testid → must update every other spec referencing it in the same PR (blast radius)
2. **Additive** — add the new testid alongside the existing one → minimal blast radius, both selectors continue to resolve

PR #268 shipped the additive pattern via a `display:contents` wrapper-span:

```tsx
{
  showScaffold && (
    <span
      data-testid="subitising-scaffold-dot-card"
      style={{ display: 'contents' }}
    >
      <DotCardOverlay {...dotCardProps} />{' '}
      {/* keeps its existing math-dot-card testid */}
    </span>
  )
}
```

**Why `display:contents`.** The wrapper carries the new testid for Playwright's `getByTestId()` to find, but `display:contents` makes the wrapper itself layout-invisible: its children render exactly as if the wrapper weren't there. Zero layout regression on the inner primitive (no extra block/inline-block wrapper, no flex/grid child position shift, no z-index/stacking-context introduction). Both selectors resolve correctly: `getByTestId('subitising-scaffold-dot-card')` finds the wrapper, `getByTestId('math-dot-card')` finds the existing inner primitive.

**When to reach for this.** Any time a feature gate needs an e2e testid that:

- Already exists with a different name on a reusable primitive that other specs depend on
- Should NOT be renamed (renaming forces a multi-spec coordination PR)
- Conditionally renders (so the new testid only mounts when the feature is gate-active, while the inner primitive may mount unconditionally for other consumers)

**Prefer the wrapper over multiple-testid-on-one-element.** React's `data-testid` is a single string attribute; setting multiple testids on one DOM node requires composite string conventions or non-standard `data-*` proliferation. The wrapper keeps each testid on its own element with no convention overhead.

### 4.4 Standalone `public/*.html` pages — a distinct e2e target class (PR #361/#362/#363, 2026-06-11)

Some pages live in `public/` as standalone HTML files outside the React bundle: `letter-sounds-test.html`, `offline.html`, and `voice-qa.html` (introduced as the voice-QA audit tool in PR #361). These pages are **not part of the Vite build graph, App.tsx, or the PWA precache manifest** — they are static pages served directly by `vite preview` as-is.

**The main-app helpers do NOT apply to standalone pages.** `seedLocalStorage` / `seedStorage.ts` seeds `marian-tutor:progress:v1` and `marian-tutor.session-history.v1` — keys that `App.tsx` reads at mount. Standalone pages have their own localStorage schemas; `voice-qa.html` uses `vqa-verdicts` and `vqa-secret`. `installClaudeMock` / `forceHowlerUnlock` are equally inapplicable — these pages don't load the app bundle.

**Spec pattern for standalone pages.** Seed the page's own keys before navigation via `page.addInitScript`, then navigate directly to the page's URL:

```ts
await page.addInitScript(() => {
  localStorage.setItem('vqa-secret', 'test-secret')
  localStorage.setItem('vqa-verdicts', JSON.stringify({}))
})
await page.goto('/voice-qa.html')
```

Intercept the page's own endpoints (not `/api/claude`) via `page.route()` with handlers matching the page's actual fetch targets. The first precedent spec is `e2e/voice-qa-page.spec.ts` (PR #361).

**Do not apply the main-app canon-serving mocks** (`installCvcWordsClaudeMock`, `installFocusAwareMathCanonClaudeMock`, etc.) to standalone-page specs — they route `/api/claude`, which these pages may not call.

**WebKit needs a far larger timing budget than chromium on hash-heavy pages — and WebKit is the engine that matters.** The voice-qa page's 632-item SHA-256 hash loop exceeds Playwright's default 10 s `expect` timeout on WebKit (observed stuck at "Hashing canon — 11/23 files" at the 10 s mark, PR #361 fix cycle 2026-06-11) while chromium ran the same spec 6/6 green in 27 s. Chromium-only verification would have shipped a spec that is red on WebKit — the iPad-Safari surrogate, i.e. the actual target device engine. Any spec change touching `voice-qa.html` (or future hash-heavy standalone pages) must be verified with `--project=webkit`, never chromium-only.

**Gate on the footer before any count assertion (hash-then-render race).** The voice-qa page appends rows incrementally (canon groups → Greet → Hub) and writes the footer (`data-testid="vqa-render-count"`) LAST — a bare `rows.count()` after `goto()` races the hash loop and reads 0 even on chromium. The precedent spec's `waitForPageReady()` helper (45 s budget, gates on the footer) is called after every `goto`/`reload`; reuse the pattern for any sibling QA page that hashes-then-renders.

#### 4.4.1 Service-worker bypass for voice-QA (`bypassServiceWorker`, PR #382, 2026-06-12)

**Root cause of SW-staleness on voice-qa.html.** Workbox `precacheAndRoute` in the app's SW strips query parameters from request URLs before matching the precache manifest. Adding `?v=<hash>` or `Cache-Control: no-store` to a fetch defeats the HTTP cache but not the SW precache — the SW intercepts the request, strips the query param, and serves the precached (stale) entry regardless. Canon JSON files are **not** in the SW precache manifest (only `**/*.{js,css,html,png,svg,webmanifest,woff,woff2,ico,mp3}` per `vite.config.ts`), so a stale-MP3 + fresh-canon split is the SW staleness signature: canon content is always fresh (SW never caches it); MP3 bytes served by the SW can be stale even after a deploy.

**The bypass mechanism** (in `public/voice-qa.html`):

1. `bypassServiceWorker()` runs before `main()` — unregisters all SW registrations, deletes all caches.
2. Sets `sessionStorage['vqa-sw-bypassed'] = '1'` BEFORE triggering the reload — the reloaded page reads this flag and skips straight to `main()`, avoiding a bypass loop.
3. `hadSomethingToClear` early-out: if there are no registrations, no cache keys, and no active SW controller, returns `false` (no reload) so a clean browser load is not penalised with a wasted round-trip.
4. After reload, `main()` runs without an active SW; all fetches hit the network and receive fresh bytes.

The bypass is scoped to the voice-QA page tab session only. The app's SW re-registers normally on the app's own next load (`voice-qa.html` and the main app are on different navigation contexts).

**Bootstrapping limitation (proven round-3, issue #387, 2026-06-11).** `voice-qa.html` is itself in the SW precache manifest (`html` is in `globPatterns`), so a device whose SW predates the bypass serves the OLD page — without the bypass code — and the bypass never runs. The fix cannot deploy through the very SW it is meant to clear. Round-3 evidence: the 24 MP3-backed verdicts carried round-1 `decidedAt` timestamps and round-1 hashes even after #382 deployed. Recovery on an already-stale device: open the QA page in a **private/incognito tab** (no SW controls it), or close-and-reopen the standalone PWA twice (browser updates the SW script in the background on navigation; the new precache activates on the following launch). Once one fresh page load executes the bypass, the device self-heals for subsequent normal loads.

**Spec:** `e2e/voice-qa-sw-bypass.spec.ts` covers the bypass flow end-to-end.

#### 4.4.2 Round-N stale-verdict triage method

Voice-QA "fail" items from round N may be **phantom fails** — verdicts recorded against bytes that are no longer what production serves (stale SW-served audio, or a verdict that predates the fix entirely).

**Triage signal — two fields to compare per fail item:**

| Field                 | Where it lives                       | Test                                                                                                                               |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `decidedAt`           | verdict object in the round-N report | Earlier than the fix-PR merge time? → verdict tested pre-fix bytes → phantom                                                       |
| `audioHash` (verdict) | same verdict object                  | Matches current-main hash for that utterance? → genuine fail against current bytes; does NOT match → phantom (re-test, no new fix) |

A verdict is a genuine regression only when BOTH signals are clear: decided after the fix merged AND hash-matching current-main bytes.

**Round-2 empirical result (issue #377, 2026-06-11):** 24 of 30 round-2 "fails" were phantoms — their verdicts were decided 14:34–14:51Z against pre-fix bytes (the SW-precache staleness in §4.4.1 was the amplifier). Only 6 were genuine current-byte failures, fixed in PR #384. Run this triage BEFORE filing fix tickets; round 2's original tickets were both re-scoped after the triage.

#### 4.4.3 Static-HTML verification gotchas

Two gotchas discovered during the voice-QA round-2 fix cycle:

1. **`WebFetch` drops inline `<script>` content.** When fetching a static HTML page via the `WebFetch` tool, inline script blocks are stripped from the returned content — only the HTML skeleton survives. To verify inline JS behaviour (e.g. whether `bypassServiceWorker` runs before `main()`), use `curl` against the raw file and grep the bytes directly:

   ```sh
   curl -s http://localhost:4173/voice-qa.html | grep -c 'bypassServiceWorker'
   ```

   `WebFetch` is suitable for verifying HTML structure and attribute presence; not for verifying inline JS logic.

2. **Vercel injects `vercel.live/feedback/feedback.js` into preview HTML.** PR preview builds receive exactly one extra `<script>` tag injected by Vercel's feedback widget. A byte-hash of the HTML will never match the local or production build. Expect exactly one extra line (the injected script tag) when diffing preview HTML against the canonical source (normalise with `tr -d '\r'`) — this is not a build error.

### 4.2.1 Count-based assertions on `/api/claude` must filter by track (post 86c9pr4h9)

After PR #162 (ticket `86c9pr4h9`) added the Word Song pre-warm at Hub mount, **Hub mount fires BOTH math and word-song POSTs to `/api/claude`** (math from the existing greet-or-math kick effect that was already running pre-Hub; word-song from the new Hub-anchored kick effect). Any unit/component test that counts `/api/claude` calls across a Hub-touching flow MUST filter on `JSON.parse(init.body).payload.track` to avoid silently double-counting.

Pattern (applied in `App.test.tsx`'s rapid-bounce latch-leak regression):

```ts
const mathCalls = fetchMock.mock.calls.filter(([_url, init]) => {
  const body = JSON.parse((init as RequestInit).body as string)
  return body.payload?.track === 'math'
})
expect(mathCalls).toHaveLength(N)
```

Without the filter, the test passes for the wrong reason as soon as it crosses Hub. This applies to `App.test.tsx` and any new pre-warm regression tests; e2e specs use `mockClaude.ts`'s built-in `body.payload.track` routing and aren't affected.

---

## 5. Pre-commit hooks (Husky + lint-staged)

[.husky/pre-commit](MarianLearning/.husky/pre-commit):

```sh
#!/usr/bin/env sh
yarn typecheck
yarn lint-staged
```

Two checks fire on every commit:

1. **`yarn typecheck`** — `tsc -b --noEmit`. Catches TypeScript errors before they reach CI.
2. **`yarn lint-staged`** — driven by the `lint-staged` block in [package.json](MarianLearning/package.json):
   - `*.{ts,tsx}` → `eslint --fix` + `prettier --write`.
   - `*.{js,mjs,cjs,json,css,md,html}` → `prettier --write` only.

The hook does NOT run `vitest` or e2e — those are author/dispatcher responsibility (see §1.3).

**Gotcha — `prettier --write` rewrites the WHOLE staged file, inflating markdown diffs.** Several `design/` docs are prettier-dirty on `main` (emphasis style, table alignment). Touch one line of such a file and the hook normalizes the entire file at commit time — a 9-line hand-edit can land as a 73/55 diff (observed: PR #401, `design/math/add-to-20-content.md`, 2026-06-12). Reviewers and the orchestrator's diff eyeballing must not read diff size as scope on markdown PRs — verify the intended lines via a targeted grep of the diff instead (e.g. `gh pr diff <n> | grep '^+' | grep <distinctive-token>`). The normalization is one-time per file; once committed, the file stays `prettier --check` clean.

**Never skip hooks** — `--no-verify` is forbidden by the orchestrator's git-safety protocol unless the user explicitly requests it. If a hook fails, fix the underlying issue and create a NEW commit; never `--amend` after a failure.

**Gotcha — `'tsc' is not recognized` on a commit in the main worktree.** After heavy per-ticket worktree usage, the _main_ worktree's `node_modules` can be left incomplete (worktrees get their own `yarn install`; the main checkout is easy to forget). The pre-commit hook then fails on `yarn typecheck` with `'tsc' is not recognized as an internal or external command` — even for a docs-only commit, because the hook runs `tsc` unconditionally. Fix: `yarn install --frozen-lockfile` in the main worktree, then re-commit. This bit a `design/research/*.md` commit on 2026-05-14.

**Gotcha — empty `node_modules` in a worktree-isolated agent's checkout.** When a sub-agent is dispatched with `isolation: "worktree"` (the Agent-tool worktree mode), its checkout directory starts with an **empty `node_modules/`** — git worktrees share `.git/` but each gets a fresh working-tree directory and Yarn does not auto-install into it. Only `.vite/` is present (via the shared Vite cache). The first `git commit` then fails immediately because Husky runs `yarn typecheck` + `yarn lint-staged`, which resolve `tsc` / `eslint` / `prettier` from `node_modules/.bin/` — and none of those exist. The agent reports a hook failure and cannot make progress.

**Fix:** run `yarn install --prefer-offline` inside the worktree as Step 0 — before any edit or `git commit`. `--prefer-offline` uses the local Yarn cache and completes in seconds rather than hitting the registry. **Every dispatch brief targeting a worktree-isolated agent that will commit must include this as a pre-commit step.** Observed on PR #236 (Devon, digraphs-th wiring, 2026-05-15) — the pattern recurs on every fresh worktree dispatch, not a one-off.

**Gotcha — the Agent-tool `isolation: "worktree"` mode does NOT work in this project (structural).** The Agent tool's built-in worktree isolation runs `git worktree add` from the **session's project root** (`c:/Trunk/PRIVATE/MARIAN-TUTOR/`). That directory contains `.claude/` config + `AWAY-QUEUE.md` + `MarianLearning/` — but it is **not itself a git repository**; the actual git repo is the `MarianLearning/` subdirectory. The Agent tool aborts immediately with:

```
Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured.
Configure WorktreeCreate/WorktreeRemove hooks in settings.json to use worktree isolation with other VCS systems.
```

This is **structural, not transient** — every dispatch in this project that passes `isolation: "worktree"` will fail with the same error. **Never use `isolation: "worktree"` in this project.** (Per the §7.5 incident below, the old advice was "always pass it" — that advice predates the move to the nested-repo project layout and is now wrong; see §7.5's exception callout for the correction.)

**Replacement pattern — dispatch without isolation, brief the agent to self-create the worktree as Step 0:**

```sh
cd c:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning
git fetch origin
git worktree add .claude/worktrees/<ticket-slug> -b <branch-name> origin/main
cd .claude/worktrees/<ticket-slug>
yarn install --prefer-offline   # mandatory — see "empty node_modules" gotcha above
```

The per-ticket worktree-directory convention (`.claude/worktrees/<slug>` inside `MarianLearning/`) is unchanged; only the creation mechanism shifts from "Agent-tool isolation" to "agent does it itself." This is identical to what persona-spawn agents have always done. First surfaced 2026-05-15 dispatching Kyle on the digraphs-th polish bundle.

---

## 6. Canon-aware testing

**The canon is committed to the repo** (PR #136, 2026-05-02). When a prompt template or word list changes:

1. Run `npm run canon:regen` locally — calls `tsx scripts/generateSessionCanon.ts --force`. Charges the user's Anthropic balance.
2. Commit the JSON diff in `public/canon/` in the same PR as the prompt change.

Tests should NEVER regenerate canon ad-hoc. They read from the committed `public/canon/*.json` files. The `prebuild` hook in `package.json` runs `tsx scripts/generateSessionCanon.ts` (without `--force`) — this is a sanity check that doesn't re-render unchanged content; it doesn't drain Anthropic credits on every CI build.

Why this matters for tests:

- **Real Azure-rendered MP3s decode cleanly** in headless Chromium / WebKit. A hand-rolled silent-base64 MP3 decodes flakily; Howler's `loaderror` fires before `play`, `prepareWordSongPathA` rejects, and the App falls back to the static plan ("Tap the X."). That MASKS the very regression the spec exists to catch.
- The cvc-words specs use real canon bytes via the specialised mocks — see §4.2.

Memory: `project_canon_commit_strategy.md` and `project_anthropic_billing_constraint.md`. The latter notes that when the Anthropic balance is empty, ALL builds fail at the `prebuild` step (canon prebuild) BUT production runtime survives via the CDN-cached canon. Manual top-up is required to unstick CI; production users see no impact during the outage.

### Composition drift-guard tests — POOL identity (PR #246) and RULE identity (PR #256)

[`scripts/compositionLint.test.ts`](MarianLearning/scripts/compositionLint.test.ts) contains two drift-guard test families beyond the 56 violation-class unit tests: one guards **POOL identity** (which facts are in scope) and one guards **RULE identity** (what the band-slot constraints say). Both use a hybrid **mirror + runtime-parser + 2-sided equality** structure.

**POOL drift-guard (PR #246).** Guards `SUB_TO_TEN_POOL` against directive prose drift. The test holds a mirror constant `EXPECTED_POOL_FROM_DIRECTIVE`, parses the pool from the directive literal at runtime, and asserts mirror ↔ data AND mirror ↔ parsed. A third sanity test verifies the parser throws when expected directive statements are absent.

**RULE drift-guard (PR #256, 2026-05-16).** Extends the same pattern to `SUB_TO_TEN_RULES.bandAllowedSlots`. Three tests in `describe('SUB_TO_TEN_RULES.bandAllowedSlots drift-guard against directive prose')` sit immediately after the PR #246 POOL block. Mirror constant: `EXPECTED_BAND_SLOTS_FROM_DIRECTIVE`. Runtime parser: `parseDirectiveBandSlots(MATH_TRACK_GUIDE)` extracts three statements from the directive prose at `api/_planner.ts:960-966`. Assertions: mirror ↔ data, mirror ↔ parsed prose, parser-throws-on-missing.

**Parser regex brittleness is intentional (Devon NOF #1, PR #256).** The `r3b` regex uses a one-character discriminator (`appear` vs `appears` + trailing `only`) to distinguish the rule statement at line 966 from the NEGATIVE ANCHOR reminder at line 963. **By design** — if a future editor "harmonizes" the two sentences to share phrasing, the parser-throws test fires loudly. Do NOT "fix" the deliberate prose asymmetry between those two lines; it is the alarm wire.

**Sibling example — add-to-10 parser (Devon NOF #2, PR #257).** The same "discriminator-wedge" pattern is applied in `parseAddToTenBandSlotsFromSpec`: each of the three regex uses a unique one-feature anchor — `any slot` for EASY, terminal `.` for MEDIUM, trailing `only` for HARD. If a future spec editor harmonises EASY's bullet to "allowed at P1-P8" (dropping "any slot"), the parser throws loudly. Treat any cross-band prose harmonisation in `design/math/*-content.md` as an alarm wire and verify the drift-guard test still distinguishes the three statements before committing.

**Mutation-test recipe (validated by Kevin + Devon, PR #256).** To verify the drift-guard is load-bearing:

1. In `scripts/compositionLint.ts`, flip `SUB_TO_TEN_RULES.bandAllowedSlots.EASY` from `[1, 2, 3]` to `[1, 2, 3, 4, 5, 6, 7, 8]` (replicates the PR #255 pre-fix state).
2. Run `npx vitest run scripts/compositionLint.test.ts`.
3. Expect failure with a deep-equality diff explicitly naming the EASY band as the discrepant key.
4. Restore the original array.

**Sibling-literals gotcha.** Two `EASY: [1, 2, 3, ...]` literals exist in `compositionLint.ts` — one at line ~359 (sub-to-10) and one at line ~676 (add-to-10). Edit-tool exact-match mutations targeting just one of them need additional context from the surrounding struct (e.g. `bandAllowedSlots: {` for sub-to-10) to disambiguate; a bare `EASY: [1, 2, 3]` match is ambiguous and will hit the wrong target or refuse.

**Windows mutation-test trap — never use `(Get-Content file) | Set-Content file` (Kevin NOF #2, PR #278, 2026-05-17).** The PowerShell pipeline `(Get-Content x) | Set-Content x` re-writes every line through PowerShell's default text encoder, which on Windows converts every LF to CRLF. A one-character mutation test for a drift-guard (e.g. flipping `[1, 2, 3]` to `[1, 2, 3, 4]`) produces a **154 KB whole-file diff** instead of a 1-character diff — the intended mutation is buried in line-ending noise, prettier rewrites the file on re-stage, and the test/rollback cycle becomes near-impossible to reason about.

**Safe alternatives (in order of preference):**

1. **Use the `Edit` tool** — surgical, single-line, no encoding pass. The default choice for mutation tests.
2. **`sed -i 's/OLD/NEW/' file` via Git Bash** — POSIX byte-level edit, preserves LF.
3. **LF-preserving PowerShell**: `[System.IO.File]::WriteAllText('path', ((Get-Content -Raw 'path') -replace 'OLD','NEW'), [Text.UTF8Encoding]::new($false))`. Verbose but works when Edit/sed aren't available.

After a mutation, ALWAYS verify the staged diff size matches the intended change (`git diff --stat <file>` should show ≤ a handful of lines) before running the test. A large diff means the encoding-rewrite trap fired and the mutation result is invalid regardless of test outcome.

**Add-to-10 RULE drift-guard shipped (PR #257, 2026-05-16).** `ADD_TO_TEN_RULES.bandAllowedSlots` now has a sibling drift-guard at `scripts/compositionLint.test.ts` using `parseAddToTenBandSlotsFromBulletProse` (renamed from `parseAddToTenBandSlotsFromSpec` in the dual-source rename PR). The add-to-10 directive prose has a different shape than sub-to-10's slot-led statements — add-to-10 uses band-led bullets (`- EASY (sum 3-5): allowed at any slot P1-P8`) — so the parser is structurally distinct, not a copy-paste. Each regex anchors on a unique one-feature discriminator (`any slot` for EASY / terminal `.` for MEDIUM / trailing `only` for HARD), continuing the brittleness-is-the-alarm-wire pattern.

**Per-spec-author parser convention — do NOT share a bullet-prose parser across tiers (Kevin NOF #1, PR #278, 2026-05-17; extended Kevin NOF #4, PR #291, 2026-05-22).** Spec authors are not converging on a single bullet-prose shape. As of 2026-05-22 four tiers ship four structurally different conventions:

| Tier             | Spec author    | Bullet shape                                                 | Range semantics                     | Dash                                 | Op column                    |
| ---------------- | -------------- | ------------------------------------------------------------ | ----------------------------------- | ------------------------------------ | ---------------------------- |
| sub-to-10        | (early)        | slot-led statements in prose                                 | n/a                                 | hyphen `-`                           | n/a (implied `-`)            |
| add-to-10        | (early)        | `- BAND (sum N-M): allowed at any slot P1-P8`                | **sum-range**                       | hyphen `-`                           | n/a (implied `+`)            |
| add-to-20        | Kyle (PR #278) | `- BAND (#N–M): ...`                                         | **row-range** (problem-index range) | **EN-DASH `–` (U+2013)**             | n/a (implied `+`)            |
| two-digit-addsub | Kyle (PR #285) | table-row format with explicit `\| + \|` or `\| − \|` column | **per-row** (each row is one fact)  | both `-` and `−` (U+2212 minus sign) | **YES — explicit OP COLUMN** |

Existing `parseAddToTenBandSlotsFromBulletProse` does NOT match Kyle's add-to-20 spec — both the dash codepoint and the range semantics differ. Kevin shipped a dedicated `parseAddToTwentyBandSlotsFromSpec` in PR #278 with a `[–-]` character class to tolerate either dash, and per-band one-feature discriminators continuing the brittleness-is-the-alarm-wire convention.

**Mixed-op tiers introduce OP-as-fact-identity (Kevin NOF #4 + #5, PR #291, 2026-05-22).** When a tier mixes `+` and `-` (two-digit-addsub is the first; future borrow/carry tiers will be the second / third), op is part of fact identity — `25-3` and `22+3` are distinct triples and dual-exposure forbids their co-occurrence. The parser's `ParsedFact` shape must extend from `{ a, b }` (op-implied) to `{ a, b, op }` (op-explicit). Kevin introduced `ParsedTwoDigitFact` as a tier-local extension in PR #291; **once a second mixed-op tier ships, promote to a shared `ParsedMixedOpFact` in the lint module**. Until then, copy-adapt per tier — the 3-precedent rule (per `§4.2.3`) applies.

**Spec markdown table parsing — dedupe by row# for "restate" pattern (Kevin NOF #1, PR #291, 2026-05-22).** Kyle's two-digit-addsub spec §1.1 introduces a "restate fact #N" pattern where a row appears twice in the markdown — first as the EXCLUDED constraint-correction example, second as the INCLUDED replacement, with prose between them. A naive `matchAll` regex pulls both occurrences → wrong row count (31 instead of 30, 37 instead of 36 with the conditional sub-table). **Fix pattern:** parse all rows into `Map<rowNum, row>` keeping the LAST occurrence per row#, then sort + emit by row#. Generalises to any future spec that uses "restate" semantics in a markdown table. Pair with **`\s*\|` (NOT `\s+\|`) between fact-close-backtick and the next pipe** — per-table-block whitespace conventions diverge within a single spec file (two-digit-addsub's main pool table uses backtick-space-space-pipe while its conditional sub-table drops the space). Permissive whitespace parsing prevents silent table-block drops.

**Decision rule for future tier drift-guards.** When a new tier spec lands, **do NOT attempt to extend an existing parser** — write a dedicated `parseXxxBandSlotsFromSpec` keyed to that tier's bullet shape, and have it `extractTierBlock(prose, '<tier>')` first. Defensive patterns:

- Use `[–-]` (or `[–-]`) wherever a hyphen appears in the bullet header — spec authors mix EN-DASH and ASCII hyphen freely; relying on one is a future-breakage source.
- Anchor each per-band regex on a unique one-feature discriminator (continuing the PR #256 / PR #257 pattern). The drift-guard's load-bearing alarm is the parser-throws-on-missing test, not deep-equality of parsed shapes.
- Verify whether the range is sum-range vs row-range vs slot-range before pattern-matching — these are not interchangeable and a copy-paste parser will silently parse the wrong numbers.

A future "unified bullet-prose grammar across all tiers" effort could collapse this divergence, but until that lands, the cheapest defense is per-tier dedicated parsers.

### Tier-block scoping for multi-tier drift-guards (PR #259, 2026-05-16)

Once a second tier gets a `SESSION COMPOSITION RULES` block in `MATH_TRACK_GUIDE`, drift-guard parsers MUST scope to the right tier-block before parsing — otherwise first-match regex behavior can silently parse the wrong tier's rules. PR #259 introduced `extractTierBlock(prose, tier)` in `scripts/compositionLint.test.ts` to slice `MATH_TRACK_GUIDE` at top-level `- <tier>:` bullets via lookahead-bounded substring.

**Why this matters (silent-bug history).** Pre-PR #259, the sub-to-10 drift-guard's parser used a first-match regex against the whole `MATH_TRACK_GUIDE`. Pre-PR, only sub-to-10 had a composition-rules block, so first-match was always sub-to-10 by coincidence. PR #259 added an add-to-10 block earlier in the prose; first-match would have started parsing add-to-10's block instead. The PARSED VALUES happened to be identical (both blocks share `EASY: P1-P3 [conceptually], MEDIUM: P4-P8, HARD: P5-P8`), so the sub-to-10 assertion _would have continued passing coincidentally_ — a silent semantic bug. `extractTierBlock` is the load-bearing fix; if a future tier (sub-to-20, add-to-20, mult-6-9) gets its own composition block with different band slots, the coincidence dissolves and an unguarded test starts failing for the wrong reason.

**`extractTierBlock` edge cases verified:**

- Top-level `- <tier>:` anchor with `escapeRegex` on the tier name.
- Lookahead bounds at next top-level `- <tier>:` bullet.
- Falls through to end-of-string for the LAST tier in the prose (no closing delimiter).
- Throws a clear error when the tier header is missing.

**Latent caller-side note (Devon NOF #2 from PR #259):** if `extractTierBlock` is ever called for `mult-6-9` (currently the last tier in `MATH_TRACK_GUIDE`), the `nextRe` lookahead would match `- read:` inside the Per-problem utterance template at `api/_planner.ts:1030` rather than another tier header. Benign today because the parsers key on `BAND (sum N-M):` bullets, but a one-line caller-side comment would prevent future surprise.

**Forward-extension protocol.** Any future tier composition-rules lift (sub-to-20, etc.) should: (1) add the new SESSION COMPOSITION RULES block to `MATH_TRACK_GUIDE`, (2) add a dedicated parser following the dual-source bullet-prose pattern, (3) `extractTierBlock(prose, '<new-tier>')` before parsing, (4) add the parser-throws-on-missing sanity test mirroring the sibling guards.

**Split-PR pattern when canon pre-exists in violation (Kevin NOF #5, PR #273, 2026-05-17).** If the new tier's canon ALREADY exists on `main` (baked at some point pre-spec-ratification) AND violates the rules the new lint will enforce, splitting the work avoids CI deadlock:

- **PR 1 — lint infra only.** Ships POOL + RULES + parser + violation-class definitions + drift-guards. Wires `lintXxxComposition` as an EXPORTED function but does NOT wire it into `bakeOne` / `resolveTierBinding` / `runCompositionLint` dispatch / `CompositionFileFinding` union for the new tier. Leaves a deferred test marker (e.g. `expect(resolveTierBinding('xxx')).toBeNull()`) flagging the deferred work. CI passes because the broken canon is never lint-checked.
- **PR 2 — canon rebake + binding activation.** Wholesale replaces the canon JSON via the per-tier rebake recipe (see `planner-and-canon.md §"Per-tier rebake recipe"`), un-defers the binding (`resolveTierBinding` + dispatch + union all gain the new tier), flips the deferred marker (e.g. → `expect(resolveTierBinding('xxx')).toBe('xxx')`). After this PR, the lint runs at bake-time + CI for the new tier.

Why split rather than landing both in one PR: a single PR would either ship with red CI (lint catches the pre-existing canon violations) or ship without the lint wired (defeats the point). The split lets the infra land green and the rebake land green sequentially. PR #273 (sub-to-20 lint infra) + follow-up ticket `86c9utet9` (sub-to-20 rebake) instantiated this pattern; future tiers with pre-existing canon should follow the same split.

**PR B always needs a 3-line `runCompositionLint` disk-walker test update (Kevin NOF #3, PR #278, 2026-05-17).** PR A ships the lint infra with the new tier's canon JSON deferred from disk-walk lint coverage; PR B activates it. Three mechanical edits in `scripts/compositionLint.test.ts`'s `runCompositionLint` disk-walker test are required in EVERY PR B and form part of its definition-of-done:

1. Move the new tier's `.json` path out of the OOS-list and into the in-scope `writeCanon` block (so the disk walker now lints it).
2. Bump `filesLinted` by +1 in the post-walk assertion.
3. Bump `filesSkipped` by -1 in the post-walk assertion.

**Variant — PR-A didn't preemptively stage the OOS write (Kevin NOF #5, PR #292, 2026-05-22).** When PR A's lint infra ships without putting the new tier's `.json` path into the OOS-list at all (because PR A's disk-walker test doesn't need to track the deferred file's existence), PR B adds a NEW in-scope write rather than moving an existing OOS entry. The effect on counts is identical (+1 `filesLinted`) but `filesSkipped` may not decrement — the file simply enters the in-scope set fresh. The split-PR pattern works either way; PR-B authors should grep the disk-walker test for the new tier's filename first and adapt the count update accordingly. PR #292 (two-digit-addsub) instantiated the new-write variant; PR #280 (add-to-20) instantiated the OOS→in-scope-move variant.

**Op-discriminator cross-product rejection tests — per-tier definition-of-done (Kevin NOF #2, PR #293, 2026-05-22).** Every parser that anchors on a **trailing-phrase op discriminator** (e.g. `+` reads end in `"How many?"` while `-` reads end in `"How many are left?"`) needs BOTH directions of the cross-product as load-bearing alarm wires:

- Wrong-op + correct-trailing-phrase → expect null (e.g. `-` read with bare `"How many?"`)
- Correct-op + wrong-trailing-phrase → expect null (e.g. `+` read with `"How many are left?"`)

Until PR #293, only `parseTwoDigitAddsubReadLine` had one direction of this coverage. The pattern is systematically applicable: any parser keyed on a wire-side trailing-phrase discriminator can drift in either direction if either leg is missing. Rule for new tier parsers: ship both rejection tests in the same PR as the parser itself. PR #293 added 5 such tests across `parseSubToTenReadLine` (2 — `minus` and `take away` variants), `parseAddToTenReadLine`, `parseSubToTwentyReadLine`, `parseAddToTwentyReadLine`, and `parseTwoDigitAddsubReadLine` (inverse-direction).

**PR A author convention — leave a breadcrumb comment** at the deferred test marker (e.g. `// PR B activates: see testing-and-ci.md §6 "Split-PR pattern" 3-line update`) so the PR B author finds the disk-walker test without grepping. PR #278 instantiated this convention; future split-PR pairs should follow.

**`CompositionRule` union extension required even for inactive lint exports (Kevin NOF #8, PR #291, 2026-05-22).** A subtle TypeScript-side definition-of-done for any new tier's lint module: the `CompositionRule` discriminated-union in `scripts/compositionLint.ts` must be extended with the new tier's rule-name literals (`op-mix`, `p1-is-plus`, `dual-exposure`, `diagnostic-coverage`, etc.) **even when the lint binding is inactive**. The reason is type-narrowing: the exported `lintXxxComposition` fn returns `CompositionRule[]`, and without the literals in the central union TS rejects the function's return type. Sibling lints will never emit the new rule names — but the compiler doesn't know that. Add to PR A's definition-of-done checklist.

> **§6 drift-class taxonomy.** Three failure classes share the same surface: an E2E spec breaks or passes trivially after a production change that introduced no real regression. The distinguishing signal is in how the locator behaves:
>
> | Class                                   | Trigger                                                                                | Diagnostic signal                                                                                       |
> | --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
> | Canon-content-coupled                   | Canon JSON re-bake shifts pool ordering                                                | Locator FOUND; assertion fails on content (expected-vs-received mismatch)                               |
> | Chip-input-coupled                      | New `pickDistractors` arg violates range under `failNetwork`                           | Math screen NEVER MOUNTS; locator-not-found timeout                                                     |
> | `failNetwork` + structural + wrong-tier | Static fallback is add-to-10; spec asserts op/range for a different tier               | Test trivially-green or deterministically-red; no content mismatch                                      |
> | Chip-row content for OOS gate           | `gentleDistractors` extreme-of-range is a legitimate distractor                        | E2E false-positive on `getByText('<extreme>')` regardless of OOS-gate state                             |
> | Prose-template-coupled                  | `MATH_TRACK_GUIDE` read-line directive template re-worded (e.g. "minus" → "take away") | Substring-pin assertion silently no longer matches; underlying behaviour unchanged; no failure surfaces |

### Canon-content-coupled E2E spec drift (PR #266, 2026-05-16)

**Failure mode.** When a canon JSON is re-baked (e.g. to activate a tighter `SESSION COMPOSITION RULES` directive), the pool slot ordering can shift even when the fact set is semantically equivalent. Any E2E spec assertion that pins a _literal canon fact value_ — addend text, problem ordering, specific operand strings — breaks on the reorder even though no production regression was introduced.

**Concrete instance.** PR #266 re-baked `public/canon/math/level-1/add-to-10.json` to activate the PR #259 SESSION COMPOSITION RULES directive. EASY-band P1 swapped from `2+1=3` (OLD) to `1+2=3` (NEW) — commutatively equivalent. `e2e/sub-to-10-distractor-class-2.spec.ts:644-670` failed because it asserted the OLD canon operand order literally:

```ts
// Canon-landed addend gate (PR #242 precedent). Canon P1 is
// `2 + 1 = 3` — wait for those operands before walking chips.
await expect(page.getByTestId('math-addend-a')).toHaveText('2', {
  timeout: 15_000,
})
await expect(page.getByTestId('math-addend-b')).toHaveText('1', {
  timeout: 15_000,
})
```

addend-a resolved to `"1"` post-rebake; the literal `'2'` assertion failed. **Second occurrence of this class** — the first was the inline comment at `:666` referencing old canon P1 during the sub-to-10 wave. Assume more candidates across the e2e set.

**Why the lint pipeline doesn't catch this.** `canon:lint` asserts text hygiene; `compositionLint` asserts **canon → directive** (does the baked canon comply with directive rules?). Neither asserts **spec → canon** (do existing spec literals still match the current canon?). The bake is well-gated; the spec layer is not.

**Pre-merge defensive grep — append to every canon-changing PR dispatch brief.** Before approving or merging any PR that re-bakes a canon JSON, grep `e2e/` for literal canon fact references using the OLD-fact strings:

```sh
# Run from MarianLearning/. Substitute the actual OLD operands being displaced.
# Example for an add-to-10 re-bake that changes P1 from 2+1 to 1+2:
rg "toHaveText\('2'\)|2 \+ 1|2\+1" e2e/
```

Any hit on an OLD-fact literal inside a `toHaveText(...)` or string-equality assertion is a spec that needs updating in the same PR as the canon diff.

**Fix patterns (prefer in order):**

1. **Convert to a structural / fact-equivalence assertion when possible** — assert _that_ a digit rendered, not _which_ digit:
   ```ts
   await expect(page.getByTestId('math-addend-a')).toHaveText(/^\d+$/, {
     timeout: 15_000,
   })
   ```
2. **Derive operands from the canon JSON at test runtime** when the spec genuinely needs to gate on a specific problem:
   ```ts
   const canon = JSON.parse(
     fs.readFileSync('public/canon/math/level-1/add-to-10.json', 'utf-8'),
   )
   const p1AddendA =
     /* extract from canon utterances or problem array */
     await expect(page.getByTestId('math-addend-a')).toHaveText(p1AddendA, {
       timeout: 15_000,
     })
   ```
   This couples the spec to the canon file rather than a hardcoded string — re-bake updates the source of truth, test follows automatically.
3. **Literal-pin with explicit canon-dependency comment** — only when (1) and (2) are infeasible. Mark the dependency so the next re-bake author knows to update:
   ```ts
   // Canon-literal gate: pins specific P1 operands from the committed
   // add-to-10 canon. If re-baked, update this to match new P1 operands.
   // See testing-and-ci.md §6 "Canon-content-coupled E2E spec drift".
   await expect(page.getByTestId('math-addend-a')).toHaveText('1', {
     timeout: 15_000,
   })
   ```

**Inventory audit flag.** A one-time `rg` sweep of `e2e/` for `toHaveText\('\d'` (literal digit assertions on chip / addend / answer) against the current committed canon would surface the full population of at-risk assertions. Not yet run as of 2026-05-16; schedule alongside the next canon re-bake wave.

### Chip-input-coupled drift via render-time `pickDistractors` widening (Devon NOF, PR #272, 2026-05-17)

**Sibling failure class to canon-content-coupled drift above.** Same family — E2E specs break on a render-time change — but a DIFFERENT trigger and a DIFFERENT diagnostic signal:

- **Canon-content-coupled drift** (above): canon JSON re-bake changes the literal fact rendered; specs that pin `toHaveText('<value>')` fail with expected-vs-received mismatches. The locator FINDS the element; the assertion fails on content.
- **Chip-input-coupled drift** (this entry): a new optional arg to `pickDistractors` (e.g. `minAnswer`) routed through a focus-node-keyed gate at the chip-build site VIOLATES `pickDistractors`'s pre-existing range invariants when the actual rendered plan diverges from the focus node (e.g. static-fallback rotation under `failNetwork:true` returns add-to-10 problems while focus is `sub-to-20`). The throw crashes React → blank screen → `getByTestId('<screen>')` is element-not-found. **The locator FAILS TO BE VISIBLE; there is no expected-vs-received mismatch.**

**Concrete instance (PR #272).** Devon threaded `minAnswer = 10` at `Math.tsx:2774` gated only on `focusNode === 'sub-to-20'`. The static-plan fallback (`pickStaticSessionPlan`, fires under `failNetwork:true` or canon outage) has no sub-to-20-specific rotation — it returned add-to-10 problems (`correct ∈ [3, 10]`, `maxAnswer = 10`). When `pickDistractors` was called with `maxAnswer=10, minAnswer=10`, the range-guard `maxAnswer < minAnswer + 2` triggered a throw, React caught the exception, the Math screen never mounted. `e2e/progression-mastery-loop.spec.ts:131` (helper `runOneMathSession`'s `getByTestId('math')` gate) timed out on element-not-visible at the failing test line 342.

**Why this misleads.** The error message (`toBeVisible() failed, element(s) not found`) looks like a routing / navigation bug. The instinct is to investigate Hub-to-Math navigation, Splash-to-Hub timing, or the gesture-unlock chain. The actual fix is in the chip-pipeline guards 6 layers downstream.

**Mitigation pattern (the fix Devon shipped).** When threading focus-node-derived constraints into `pickDistractors` or any other chip-build path, **gate on the actual `problem` shape (`op`, `correct`-range), not just `focusNode`** — because:

1. The static-fallback rotation is op-keyed (or otherwise problem-shaped), not focus-node-keyed.
2. The canon outage / `failNetwork:true` path renders WHATEVER `pickStaticSessionPlan` returns, regardless of focus.
3. The focus-node identifier alone is not a reliable predicate for what the renderer actually sees.

Devon's `Math.tsx:2783` after fix:

```ts
const minAnswer =
  focusNode === 'sub-to-20' && problem.op === '-' && problem.correct >= 10
    ? 10
    : undefined
```

Three gates AND'd: focus + op-shape + correct-range. The static-fallback add-to-10 problems no longer trigger the `minAnswer=10` path even when focus is sub-to-20.

**Diagnostic recipe when this class is suspected.**

1. Failing test calls `runOneMathSession` (or any helper that opens the Math screen) and the failure is `getByTestId('math').toBeVisible()` not-found, NOT a content mismatch.
2. The PR's diff includes a NEW optional arg to `pickDistractors` (or sibling chip-build function) routed through a focus-node-gated branch.
3. Run the failing test with `--debug` and watch for a React error boundary or console exception during the Math screen mount.
4. If the screen never paints, the bug is in the chip-build pipeline guard, NOT in navigation.

**Out-of-scope for this entry.** Whether `pickStaticSessionPlan` SHOULD have a sub-to-20-specific rotation is a separate design question (probably yes, once sub-to-20 is Marian's active tier). The lesson here is "until the static fallback diverges in lockstep with focus-node-derived chip args, gate on `problem` shape."

### `failNetwork` + structural assertion + wrong-tier static fallback (Jessica NOF, PR #275, 2026-05-17)

**Third sibling failure class.** Joins the two entries above. Same surface — a spec believed to be asserting against real behaviour passes trivially or fails for the wrong reason — but a different trigger:

- **Canon-content-coupled drift**: spec pins a literal fact value; re-bake shifts pool ordering; assertion fails with an expected-vs-received mismatch.
- **Chip-input-coupled drift**: a new `pickDistractors` arg violates range invariants under `failNetwork`; chip-build throws; Math screen never mounts; locator-not-found timeout.
- **`failNetwork` + structural assertion + wrong-tier static fallback** (this entry): the spec author uses `installClaudeMock(page, { failNetwork: true })` reasoning their assertions are "structural" (operator, operand range — not literal canon fact values). The miss: `pickStaticSessionPlan` is tier-asymmetric. It has an `add-to-20`-specific rotation for `focusNode === 'add-to-20'` and falls through to the **add-to-10 rotation** for every other focus node (`sessionPlans.ts:424-434`). An assertion that `op === '-'` or `correct >= 10` is structurally unsatisfiable against an add-to-10 static plan and will either trivially-green (wrong-tier plan coincidentally satisfies the assertion) or deterministically-red (it can't).

**Concrete instance (PR #275, 2026-05-17).** Jessica's `e2e/sub-to-20.spec.ts` used `installClaudeMock(page, { failNetwork: true })` in `beforeEach`. Tests 1, 2, 4 assert on sub-to-20-specific behaviour (`op: '-'`, `correct >= 10`, cross-tier focus-switch content). The static fallback returns add-to-10 problems (`op: '+'`, `correct ∈ [3,10]`) — structurally unsatisfiable. Tests 1, 2, 4 must re-fixme. Test 3 (no-borrow) "passes" because its assertion happens to be satisfiable against `op: '+'` — trivially-green, NOT evidence that the rebaked sub-to-20 canon functions end-to-end.

**Detection rule for spec authors.** Before using `installClaudeMock(page, { failNetwork: true })` in a spec that asserts on `op`, operand/answer range, or focus-keyed cross-tier content: ask "Can `pickStaticSessionPlan` produce the asserted property for my focus node?" For any focus that is NOT `add-to-20`, the static plan is add-to-10 rotation — `op: '+'` only, `correct ∈ [3,10]`. If the assertion requires `op: '-'` or `correct >= 10`, `failNetwork` is unsafe. Use the tier's canon-serving mock instead (parallel to `installCvcWordsClaudeMock`).

**The one safe `failNetwork` use-case.** Progression-only specs — assertions on navigation, screen mounting, XP award, mastery advancement, session-end routing — are focus-agnostic and safe, because `pickStaticSessionPlan`'s wrong-tier content doesn't affect the progression layer. See the "Corollary" at the end of §6 for the canonical phrasing.

**Follow-on lesson — even with a CORRECT served-canon mock, chip-row CONTENT assertions are unsound for cross-tier OOS gates (Jessica NOF #2, PR #279, 2026-05-17).** Once the served-canon mock issue above is fixed, the obvious next step is "assert no chips show the out-of-scope value at the chip-row layer" (e.g. for op:`-` tiers, assert `getByText('10')` is not present in the chip row when out-of-scope-protection is active). This assertion is **structurally unsound**: `gentleDistractors(correct=0, minAnswer=0, maxAnswer=10)` legitimately returns `10` as the extreme of the allowed range. The chip-row content includes `10` for non-Class-B reasons, and the OOS assertion false-positives on a behaviour that has nothing to do with the gate it claims to be testing.

**Two-place test pattern.** Split the gate into the layer it actually lives at:

- **E2E layer**: assert the **served-canon STRUCTURAL ENVELOPE** — operator, correct-answer range, focus-node — NOT the rendered chip-row contents. The envelope is what the network mock controls and what cross-tier OOS protection actually gates on.
- **Unit layer (`gentleDistractors.test.ts` or sibling)**: assert direct Class-B-fire — given `correct, minAnswer, maxAnswer`, does the function return out-of-range distractors? This is where the chip-content question belongs because the function output is the chip pool before render.

**Detection rule for reviewers.** When reviewing a cross-tier OOS gate E2E spec, grep the assertion body for `getByText`, `getByRole('button'`, or chip-row content matchers — any hit is a flag to ask "could `gentleDistractors`'s extreme-of-range return value satisfy this regardless of the gate?" If yes, the assertion belongs in the unit layer and the E2E layer should switch to a served-canon envelope assertion.

The §6 drift-class taxonomy callout above now has a fourth row capturing this class (chip-row content assertions for OOS gates).

### Prose-template-coupled E2E spec drift — directive re-templating silently weakens substring assertions (Devon NOF, PR #279, 2026-05-17)

**Fifth sibling failure class.** Joins canon-content-coupled, chip-input-coupled, `failNetwork`+structural+wrong-tier, and chip-row-OOS-gate above. Trigger: an E2E spec asserts that a specific substring appears (or does not appear) in the read-aloud line / utterance text, holding the substring in a constant coupled to the directive prose in `MATH_TRACK_GUIDE`. Later, the directive template is re-worded (`"<a> minus <b>"` → `"<a> take away <b>"`, or capitalisation tweaked, or word order shuffled) for pedagogical / pronunciation reasons. **The substring constant silently no longer matches anything.** The assertion stops checking what it claims to check; nothing fails.

**Diagnostic signal — HARDEST to detect of the five classes.** Unlike the four siblings above, NO test failure surfaces. The substring is no longer present, so `.not.toContain` is trivially-green; `.toContain` would surface, but the more common authoring pattern is the negative-membership "FORBIDDEN strings absent from read-line" check, which is exactly the case that goes silent. The behaviour the spec was meant to gate may itself be regressed or correct — the spec has lost its ability to tell either way. Only mutation testing of the production behaviour itself (rather than the substring constant) surfaces the gap.

**Concrete instance (PR #279).** Test 3 of `e2e/sub-to-20.spec.ts` asserts that read-aloud directive prose for sub-to-20 borrow problems does NOT contain any of `FORBIDDEN_BORROW_READ_SUBSTRINGS`. The constant was authored against the read-line template `"<minuend> minus <subtrahend>"` at the time of writing. If `MATH_TRACK_GUIDE`'s per-problem utterance template at `api/_planner.ts:1030+` is re-templated (e.g. `"minus"` → `"take away"`, or any other minus-phrasing change for younger-reader accessibility), the FORBIDDEN substring constants no longer appear in any read-line whether the production gate fires or not — the assertion silently weakens to a tautology.

**Mitigation patterns (in order of preference):**

1. **Runtime derivation from the source-of-truth.** Read the template literal from `MATH_TRACK_GUIDE` at test time and derive the substring set programmatically. The spec couples to the directive's _structure_, not a frozen copy of its text:

   ```ts
   import { MATH_TRACK_GUIDE } from '../api/_planner'
   const readLineTemplate = extractReadLineTemplate(
     MATH_TRACK_GUIDE,
     'sub-to-20',
   )
   const expectedConnector = readLineTemplate.match(
     /<minuend>\s+(\S+)\s+<subtrahend>/,
   )![1]
   // assertion now follows whatever connector the directive declares
   ```

2. **Structural predicate on the rendered DOM.** Assert _that_ the read-line rendered with the expected operand wiring (`<minuend>` `data-role="minuend"`, `<subtrahend>` `data-role="subtrahend"`) and a non-empty connector between them — without pinning the connector's literal text:

   ```ts
   await expect(page.locator('[data-role="minuend"]')).toHaveText('15')
   await expect(page.locator('[data-role="subtrahend"]')).toHaveText('7')
   await expect(page.locator('[data-role="connector"]')).not.toBeEmpty()
   ```

3. **Literal-pin with a load-bearing `// SYNC WITH:` comment** — only when (1) and (2) are infeasible. Mark the dependency so the next directive editor finds the spec:
   ```ts
   // SYNC WITH: MATH_TRACK_GUIDE read-line template for sub-to-20 borrow
   //   in api/_planner.ts (search "<minuend> minus <subtrahend>").
   //   If the template's connector changes, update this constant.
   //   See testing-and-ci.md §6 "Prose-template-coupled E2E spec drift".
   const FORBIDDEN_BORROW_READ_SUBSTRINGS = ['minus' /* ... */]
   ```

**Distinguishing from the four existing classes:**

| Class                                   | Trigger surface                                                 | Failure mode                                                  | Catchable by                                     |
| --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Canon-content-coupled                   | Canon JSON value change                                         | Loud `toHaveText` mismatch                                    | CI test failure                                  |
| Chip-input-coupled                      | New `pickDistractors` arg + focus-only gate                     | Math screen never mounts; locator timeout                     | CI test failure                                  |
| `failNetwork` + structural + wrong-tier | Static fallback is add-to-10 for non-add-to-20 focus            | Trivially-green OR deterministically-red                      | Mutation test of focus-aware logic               |
| Chip-row OOS gate                       | `gentleDistractors` extreme-of-range is a legitimate distractor | E2E false-positive on `getByText('<extreme>')`                | Unit test of `gentleDistractors`                 |
| **Prose-template-coupled** (this entry) | **Directive template re-worded in `MATH_TRACK_GUIDE`**          | **NO failure surfaces; substring assertion silently weakens** | **Mutation test of production behaviour itself** |

**Pre-merge defensive grep — append to every PR dispatch brief that touches `MATH_TRACK_GUIDE` read-line / utterance templates.** Before approving any PR that re-words read-line directive prose, grep `e2e/` for substring constants likely coupled to the OLD template:

```sh
# Run from MarianLearning/. Substitute the words being re-templated.
# Example for a "minus" → "take away" re-template:
rg "FORBIDDEN.*minus|toContain\(['\"]minus['\"]\)|not\.toContain\(['\"]minus['\"]\)" e2e/
```

Any hit is a spec whose substring constants need updating in the same PR as the directive change — or, preferably, refactoring to mitigation pattern (1) or (2).

**Detection rule for reviewers.** When reviewing a PR diff that includes a `MATH_TRACK_GUIDE` read-line / per-problem utterance template change: explicitly ask "what E2E specs hold substring constants coupled to the OLD template, and have they been updated?" Default to running the defensive grep above before approving. The §6 drift-class taxonomy callout near the head of this section has been extended with a fifth row capturing this class.

### Failing-first specs for content tiers whose SkillNode infra already shipped

When a content tier is added on top of SkillNode infrastructure that **already merged separately** (the digraph-split pattern — `digraphs-sh` / `digraphs-ch` / `sight-words` all got their node literals + `WORD_SONG_NODES_IN_ORDER` slot + `intro→practicing` plumbing in PR #211 _before_ any of them shipped content), a failing-first E2E spec must make its RED signal a **content assertion, not a progression assertion**. The progression plumbing is already green on `main` — the picker lands on the node, the session logs the right `skillFocus`, the intro-pass advances it — so a progression-only assertion _passes green pre-merge_ and gives false confidence. The real RED signal is that the planner stub-falls-through to `blending-cv` content (the new tier isn't yet in `WORD_SONG_FIRST_CLASS_FOCUS_NODES`), so assert that the first target word is actually in the new tier's pool. Confirmed on PR #226 (digraphs-ch E2E, 2026-05-14): three tests fail at the missing canon `ENOENT`, but the `intro→practicing` test fails on its content-half assertion — not on the transition itself, which already works.

**Corollary — the GREEN-side mock must serve real tier canon, never `failNetwork`.** A spec that asserts on _which words rendered_ cannot use `installClaudeMock(page, { failNetwork: true })`: the network-fail path drops the planner response entirely, so the screen runs `pickStaticWordSongPlan()` whose targets are hardcoded short-a CVC words (`cat`/`mat`/`cap`…) — never the new tier's pool. Any content assertion against that path is **structurally unsatisfiable** (deterministic fail, not a flake). `failNetwork` is fine for progression-only specs; content specs must use the tier's canon-serving mock (e.g. `installDigraphsChClaudeMock`). Bit PR #226's test 4 (2026-05-14) — it folded a progression assertion into the content spec and reached for the progression-sibling's `failNetwork` mock.

### Lint-infra split-PR pattern requires a `lintBeforeRebake` failing test (2026-05-22)

When new canon-lint infrastructure ships via the split-PR pattern (PR A = lint code + deferred marker; PR B = canon rebake + binding activation), PR A MUST include a **`lintBeforeRebake` failing-test fixture** that runs the new lint function against the _pre-rebake_ canon and asserts it FAILS. PR B then re-runs the same lint against the _post-rebake_ canon and asserts it PASSES. The red-then-green transition is the evidentiary "the binding was needed" record.

**Why:** Set 2026-05-22 after Wave-3+4 retro Pattern G. Wave 4's PR #291 (lint infra) → PR #292 (canon rebake + binding activation) went **green-on-base → green-on-activation** because PR #291's deferred marker was `.toBeNull()` on `resolveTierBinding` (testing the off-state), not a fixture exercising the new lint rule against the still-non-compliant pre-rebake canon. By the time PR #292 ran the new lint, the canon was already rebaked + compliant, so the lint immediately passed. There was no falsifiable moment where the new rule visibly caught the old canon being out-of-spec.

This is structurally different from Jessica's failing-first discipline (`[[feedback_progression_e2e_mandatory]]`), where 5+ test assertions are empirically RED on base before the impl PR lands. The lint split-PR pattern needs the same red-then-green falsification record.

**Pattern (PR A):**

```ts
// scripts/compositionLint.test.ts — lintBeforeRebake fixture
describe('lintTwoDigitAddsubComposition — applied to pre-rebake canon', () => {
  it('flags the existing canon as out-of-spec (the reason this lint exists)', async () => {
    const preRebakeCanon = await readPreRebakeCanon('two-digit-addsub') // helper that reads the OLD JSON snapshot or git-blob
    const violations = lintTwoDigitAddsubComposition(preRebakeCanon)
    expect(violations).toHaveLength(N) // exact count, not >0
    expect(violations.map((v) => v.code)).toContain('THE_NEW_RULE_CODE')
  })
})
```

**Pattern (PR B):**

```ts
// re-run the same lint against post-rebake canon — assert clean
it('clean after Wave 4 rebake', async () => {
  const postRebakeCanon = await readCanon('two-digit-addsub')
  const violations = lintTwoDigitAddsubComposition(postRebakeCanon)
  expect(violations).toEqual([])
})
```

**Pre-rebake snapshot strategy:**

- **Best:** commit the pre-rebake canon JSON to a fixture path (e.g. `scripts/__fixtures__/two-digit-addsub.pre-wave-4.json`) in PR A. This survives future rebakes — the lint runs against the frozen snapshot, not against whatever canon currently lives in `public/canon/`. Self-contained and time-traveler-friendly.
- **Acceptable:** read the canon JSON from a specific git SHA via `git show <pre-rebake-sha>:public/canon/...`. Brittle if the SHA gets garbage-collected, but cheap to set up.
- **Avoid:** asserting on a synthetic in-memory canon that never lived in production. The whole point is to prove the lint catches _real_ drift.

**When this rule does NOT apply:**

- Lint rule that's purely a positive-direction assertion (e.g. "every problem has a `correct` field") — there's no pre-rebake-non-compliant canon to test against; the field either exists or doesn't.
- Lint rule on a brand-new tier whose canon is being authored fresh — no "pre-rebake" snapshot exists.
- Lint rule whose violation would be a syntactic / structural parse failure caught at canon-bake time anyway.

Apply this rule on any lint that targets a **semantic composition constraint** (saturation, ordering, distribution, balance) that an old canon could plausibly violate. `lintTwoDigitAddsubComposition` is the canonical example.

---

## 7. `gh pr merge` 504 — verify-don't-retry

When `gh pr merge` returns a 504 (Gateway Timeout), the merge often **succeeded server-side**. Run `gh pr view --json mergedAt` first to verify before retrying — retrying a successful merge causes a "branch already merged" 409 confusion that wastes triage time.

Memory: `reference_gh_pr_merge_504.md`.

## 7.1 Cross-review: fetch origin/main before computing PR diff stat

When a cross-review sub-agent (Devon reviews Kevin / Kevin reviews Devon, per `feedback_pr_review_routing` memory) operates in a worktree that predates a recent merge, `git diff main...pr-branch` against the **stale local main** will surface every commit landed on origin/main since the worktree was created — making a small PR look unmergeable-large. Devon hit this on PR #192 (2026-05-10): stale local main showed a 44-file/2407-insertion diff stat for what was actually a focused 9-file opener PR; cause was PR #190 (`d4b6974`) had merged ~2 hours earlier and the reviewer's worktree was created before that.

**Mitigation:** every cross-review dispatch should `git fetch origin main` (and ideally `git checkout main && git pull --ff-only` in the worktree) **before** computing diff stats or running compare-against-main commands. Or use `gh pr diff <num>` which always pulls from the GitHub server view rather than the local working tree. Add this as a step-0 in cross-review dispatch briefs, especially for PRs that stack on recent merges.

### The `codereview` skill silently degrades inside a sub-agent

The `codereview` skill fans out into parallel `Task`/Agent sub-agents (the change-focused + historical-context reviewers, then per-issue Haiku scorers). **`Task` is not available to a sub-agent** — so when a persona sub-agent (Devon/Kevin doing a cross-review) invokes `codereview`, the fan-out steps all fail and the agent has to complete the review inline with its own tools instead. It still produces a verdict, but slowly and without the skill's scoring structure. This was the root cause of a 53-min review on PR #228 (2026-05-14). **Every cross-review dispatch brief must say: "perform the code-review steps _inline_ with your own Read/Grep tools — do NOT invoke the `codereview` skill, its sub-agent fan-out fails inside a dispatched agent."**

## 7.1a `gh pr diff` shows the cumulative patch, not the net diff

`gh pr diff <num>` returns the **cumulative multi-commit patch** — the concatenation of every commit on the branch — NOT the net tree delta. On a multi-commit PR, a symbol that was **added in an early commit and removed in a later commit** still appears in the `+` lines as if it survived to HEAD.

**Concrete example (PR #96, 2026-05-14).** `HINT_TEXT` was added in commit 1 and removed in commit 3. `gh pr diff 96` showed `+HINT_TEXT`; the reviewer nearly flagged it as "added but unused." `git diff main...96-branch` (net diff) showed it absent.

**Rule.** Before filing an "added but unused" / "leftover symbol" review comment on a multi-commit PR, cross-check against the net diff: `git fetch origin && git diff origin/main...origin/<branch>` (three-dot — diffs the merge-base against the branch HEAD; two-dot `..` is _not_ the same and includes diverged main commits). If the symbol is absent from the three-dot diff, it was already cleaned up — don't raise it. This is a distinct trap from §7.1 (stale-local-`main` inflating diff _stats_); same family, different cause.

## 7.2 Git rebase: `--ours` / `--theirs` are inverted from merge

`git rebase` and `git merge` use OPPOSITE semantics for `--ours` and `--theirs` — empirically a recurring trip-hazard in dispatch briefs that prescribe conflict resolution.

| Operation                       | `--ours` means                                                             | `--theirs` means                                                |
| ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `git merge` / `git cherry-pick` | The current branch (your work).                                            | The commit being merged / cherry-picked.                        |
| `git rebase`                    | The rebase **target** (e.g. `origin/main`) — the base being replayed onto. | The commit being **replayed** — the work on the feature branch. |

The inversion is because `git rebase` mechanically checks out the target branch first and then replays each feature-branch commit on top, so from git's internal perspective the rebase target is the "current" (=`ours`) side at conflict time.

**Practical consequence in dispatch briefs.** When telling a sub-agent how to resolve a known rebase conflict, "take `--ours`" on a rebase means "discard the feature-branch's change at this hunk and keep origin/main's version" — almost certainly the opposite of what the dispatcher intended. Bit Kevin's dispatch briefs twice during the 2026-05-13 short-e ship arc rebases.

**Mitigation.** Do not pre-prescribe `--ours` / `--theirs` in rebase dispatch briefs without verifying which way the inversion lands for the specific operation. Prefer semantic guidance ("keep the feature-branch's planner additions on the canon-wire side; combine with main's celebration-prosody exceptions") over directional flags. When directional flags are essential, spell out which physical bytes survive: "keep the lines that read `WORD_SONG_TARGET_WORDS_SHORT_E` in the branch and discard main's empty stub" beats `--theirs`. Same rule applies to merge-tool prompts where the operation is ambiguous (the IDE may not echo whether it's invoking `git merge` or `git rebase --continue` under the hood).

---

## 7.3 Windows fresh-clone CRLF contamination (~89k phantom prettier errors)

On Windows, a fresh `git clone` with the default `core.autocrlf=true` converts all LF endings to CRLF across the working tree. Prettier treats LF as canonical, so `yarn lint` / lint-staged then reports **every line of every file as a violation** — typically ~89,000 errors on a clean clone of this repo.

**Symptom:** fresh Windows clone, first lint or commit attempt floods with `Delete ␍` / "Replace `⏎`" errors across nearly every file, while `git diff` shows no changes (git normalised on checkout). The sheer count (tens of thousands) is the diagnostic marker — real lint failures produce tens of errors at most.

**Fix (one-time per clone):**

```powershell
git config core.autocrlf false
git reset --hard HEAD
```

`git reset --hard` re-writes the working tree with LF endings; it is non-destructive here because the CRLF was git-generated, not authored. After it, `yarn lint` returns only real violations.

**Prevention:** set `git config --global core.autocrlf false` on any Windows machine used for this project before the first clone, and add it as Step 0 in any dispatch brief that asks a sub-agent to lint a freshly-cloned worktree. Verified 2026-05-14 during PR #223 review — the agent's initial `yarn lint` flood traced to exactly this.

---

## 7.4 Stale remote branch name → silent `git push` no-op

If a feature branch name **already exists on the remote** pointing at an unrelated commit (a leftover from a prior aborted attempt, a squash-merged-but-not-deleted branch, etc.), `git push -u origin <branch>` from a fresh local branch of the same name can report `[new branch]` yet push the _tracking-branch base commit_ rather than your work. `gh pr create` then fails with **"no commits between main and <branch>"** — the confusing part is the push _looked_ successful.

**Symptom:** push succeeds, `gh pr create` rejects with "no commits between". `git log origin/<branch>` shows your commits are absent; the remote ref points at `main`'s HEAD or some old commit.

**Recovery:**

1. Confirm the stale ref is not a live PR branch — `gh pr list --head <branch> --state all` before touching it.
2. Delete the stale remote ref: `git push origin --delete <branch>`.
3. Recreate from current `origin/main`, re-push.
4. **Verify before `gh pr create`:** `git diff --stat origin/main...origin/<branch>` must show your files. Make this a standard pre-`gh pr create` check.

Hit by Kyle on PR #225 (2026-05-14) — `feat/digraphs-ch-content-spec` pre-existed on the remote. Dispatch briefs that ask a sub-agent to push a new branch + open a PR should include the `git diff --stat origin/main...origin/<branch>` verification step.

---

## 7.5 Non-worktree-isolated sub-agents pollute local `main`

A sub-agent dispatched **without `isolation: worktree`** runs in the shared main checkout. If its brief says "create a feature branch and commit," a misstep (committing before the branch checkout, or an aborted-then-retried push) can leave its commit on the **local `main`** ref. The work still reaches the remote correctly via its PR branch, so nothing looks wrong — until that PR squash-merges and the orchestrator's `git pull --ff-only` on `main` fails with **"Not possible to fast-forward"**: local `main` now has a dangling sub-agent commit that diverges from the squash-merge on `origin/main`.

**Symptom:** `git pull --ff-only` on `main` reports diverging branches. `git log --oneline origin/main..main` shows one commit; `git log --oneline main..origin/main` shows the squash-merge of the _same logical work_.

**Recovery:**

1. Confirm the local-only commit is not on any remote ref: `git branch -r --contains <sha>` returns nothing.
2. Confirm its content is superseded — `git diff <local-sha> origin/main` (expect the squash-merge to fully represent it; a non-empty diff just means the merged PR was a later revision, which is still fine — `origin/main` is canonical).
3. `git reset --hard origin/main`. Untracked files are not touched.

**Prevention (UPDATED 2026-05-15) — `isolation: "worktree"` is now structurally broken in this project.** The original advice here was "always pass `isolation: "worktree"`," and that worked at the time. The project layout has since changed: the session root (`c:/Trunk/PRIVATE/MARIAN-TUTOR/`) is no longer a git repo — only the nested `MarianLearning/` subdir is — so the Agent tool's worktree mode aborts immediately with "not in a git repository." See §5 "the Agent-tool `isolation: \"worktree\"` mode does NOT work in this project" for the full diagnosis and the **replacement pattern**: dispatch without isolation, brief the agent to `cd MarianLearning && git worktree add .claude/worktrees/<slug> -b <branch> origin/main` themselves, then `yarn install --prefer-offline`. The pollution-prevention goal is unchanged — each agent still gets its own checkout — only the creation mechanism shifts. Hit 2026-05-14 — Kyle's spec agent (no isolation) left a superseded early draft on local `main`; the build-wave agents that followed used Agent-tool isolation and were unaffected — but that flag is no longer usable, so the self-setup snippet replaces it.

---

## 7.6 Absolute-path `Edit` escapes the worktree — even for isolated agents

`isolation: worktree` gives a sub-agent its own checkout under `.claude/worktrees/agent-<id>/`, but it does **not** sandbox the filesystem. The `Edit`/`Write` tools resolve whatever absolute path they're given — so an agent that edits `MarianLearning/api/_planner.ts` (the **main** workspace) instead of `.claude/worktrees/agent-<id>/api/_planner.ts` (its own copy) writes to the wrong checkout. The hazard compounds during parallel dispatch: the main `MarianLearning/` workspace is frequently checked out on **a sibling agent's branch** (whoever ran git there last), so a stray edit lands on top of another agent's in-progress work.

**Symptom:** an agent reports its change "didn't take" or a sibling agent sees unexplained working-tree changes. Caught on PR #228 (2026-05-14) — Kevin's first edit targeted the main workspace (then sitting on Devon's `feat/digraphs-ch-wordpack` branch); he reverted with `git checkout --` before staging, Devon's work was untouched.

**Prevention — put this in every worktree-isolated dispatch brief:** "You are in an isolated worktree. Every `Edit`/`Write` MUST use the full `.claude/worktrees/<your-id>/...` path. The main `MarianLearning/` workspace may be checked out on a sibling agent's branch — never edit it." Agents should `pwd` / confirm their worktree root before the first edit.

---

## 7.7 Cleaning up agent worktrees needs double-force (`-f -f`)

Auto-isolation worktrees under `.claude/worktrees/agent-<id>/` are created **locked** (lock reason: `claude agent agent-<id> (pid …)`). After the agent completes, the lock is stale but persists. `git worktree remove --force` (single `-f`) **fails** with `cannot remove a locked working tree` — you need **`git worktree remove -f -f`** (double force) to override the lock, then `git worktree prune`. Do this only once the worktree's branch is merged/dead. Confirmed 2026-05-14 cleaning up the digraphs-ch wave's agent worktrees — prior sessions had been leaving these for "manual rm later" because single-force didn't work.

---

## 8. The e2e spec set

Nine spec files in [e2e/](MarianLearning/e2e/):

### 8.1 Golden-path specs (audit P0.1, ticket 86c9kwnmx)

- **[hub-to-math.spec.ts](MarianLearning/e2e/hub-to-math.spec.ts)** — Hub mounts → Number Garden tap → Math mounts → first problem renders → first chip enables. Uses `failNetwork: true` so the silent-caption-walk fallback drives chip enablement (CI runners are mute).
- **[session-end-to-hub.spec.ts](MarianLearning/e2e/session-end-to-hub.spec.ts)** — 8/8 correct → SessionEnd → "All done!" CTA → Hub. Asserts `sessionCount` bumps 5→6, `longestStreakEver` reflects the streak, separate stardust adapter wrote a positive total. Does NOT pin exact stardust amount (formula has too much surface for a brittle exact value).
- **[mastery-promotion.spec.ts](MarianLearning/e2e/mastery-promotion.spec.ts)** — Full integration: seed `add-to-10: practicing` + 3 perfect cross-day sessions → run an 8/8 session → assert post-flip `add-to-10: mastered`, `add-to-20: intro`, `history.length: 4`. Catches in-flight P0.2 (focus-node propagation) / P0.3 (UTC vs local-day) regressions.

### 8.2 Race-bug specs (audit P1, ticket 86c9kxp3j)

- **[cold-mount-math-fetch-in-flight.spec.ts](MarianLearning/e2e/cold-mount-math-fetch-in-flight.spec.ts)** — Cold-mount Math while `/api/claude` is in flight. Pins the resolve-with-delay branch (PR #130 render gate) and the `failNetwork:true` reject branch. Doesn't pin addends to canonical fixture (Howler decode determines whether `mathPlan` gets set or stays null in headless audio).
- **[backgrounding-mid-session.spec.ts](MarianLearning/e2e/backgrounding-mid-session.spec.ts)** — `test.fixme` cases for `visibilitychange` / `pagehide`. Documents target behaviour (pause audio on hide, resume cleanly on show, no chip-advance fires while hidden) — flips live when the product fix lands. No production handler exists yet (verified via grep at spec-authoring time).
- **[multi-tab-same-key-desync.spec.ts](MarianLearning/e2e/multi-tab-same-key-desync.spec.ts)** — `test.fixme` cases for cross-tab `storage` event sync. No production handler exists yet.
- **[path-a-fetch-abort-rapid-route-bounce.spec.ts](MarianLearning/e2e/path-a-fetch-abort-rapid-route-bounce.spec.ts)** — Hub → Math (fetch in flight) → back-arrow → Hub → Number Garden again. Asserts the `mathFetchStartedRef` latch resets and the screen doesn't brick on a stale latch. Latch-leak fix landed in ticket 86c9kxtm5.

### 8.3 CVC-words regression specs

- **[cvc-words-regression.spec.ts](MarianLearning/e2e/cvc-words-regression.spec.ts)** — **11 tests** guarding PRs #135 (picker un-clamp + planner widen + canon + debug seeder), #142 (silent-text window 1500ms), #140 (Hub progress wire + projection + PromotionCelebration mutual-exclusion), #144 (Hub utterance cancel-on-tap). Test 10 includes the path-strip projection assertion; test 10b is the count-based mutual-exclusion check (`hub-emma` count is `0` when celebration visible, `1` when not).
- **[cvc-words-short-o-regression.spec.ts](MarianLearning/e2e/cvc-words-short-o-regression.spec.ts)** — **8 tests** mirroring the short-a coverage. Tests 1–7 mirror flow-level coverage (debug-seed routing, planner request shape, read-line caption, chip render, advance, 8-tap walk, focus persistence). **Test 8 is new** — locks the CURRENT same-vowel-only distractor policy from `design/word-song/short-o-pool-expansion.md` §8. Cross-vowel mixing is filed as ticket `86c9m3aek`; this assertion is a regression guard so future cross-vowel work explicitly OPTS in to mixing rather than letting it leak in silently.

#### 8.3.1 `test.skip` on webkit

Both cvc-words specs skip the read-aloud-dependent tests on webkit (test 3 onward). Tests 1–2 (debug-seed routing, planner request shape) run on both browsers because they don't depend on chips enabling.

> **Pool-extension sync rule:** every `VALID_*_WORDS` Set constant in a per-tier regression spec — and the spec's "Note on canon authority" docstring — must be widened in the same PR as the pool extension itself. See `skill-trees-and-content.md` § "Pool-extension sync points" for the full five-file checklist (`wordPack.ts`, planner list + canon, this spec's `VALID_*_WORDS`, this spec's docstring, and `POOL_EXTENSION_PENDING_CROSSVOWEL` on a/o/u tiers).

---

## 9. Test-discipline memory rules

The orchestrator enforces these rules; each is documented in detail in user auto-memory but worth naming here so contributors recognise the trigger phrases:

- **`feedback_run_vitest_before_merge.md`** — Vercel CI doesn't run vitest. Run `npx vitest run` locally before push.
- **`feedback_count_assertions_on_regression_tests.md`** — Use `.toEqual([item])` or `.toHaveBeenCalledTimes(N)`; never `.toContain` on regression tests. Count-based assertions catch the regression you're guarding against; `.toContain` is a smell because it passes whether the bug shipped or not.
- **`feedback_test_timing_vs_real_safari.md`** — Effect closure flags + deferred resolution = race. Be wary of `setTimeout(0)` in tests that exercise audio-state machines; real Safari's microtask ordering differs from jsdom and headless engines.
- **`feedback_playwright_disabled_button_click.md`** — `locator.click({ force: true })` only bypasses Playwright's actionability checks, not the DOM-level `disabled` attribute. Clicks on `<button disabled>` are no-ops even with `force: true`. Use a different selector path or wait for the button to enable.
- **`feedback_wait_for_ci_before_merge.md`** — Don't merge until the PR's e2e Playwright runs report COMPLETED + SUCCESS. Local vitest is necessary but not sufficient. Triggered by PR #137's red-merge incident 2026-05-04. **Caveat for asset-only PRs:** green CI on a PR that adds an asset without wiring it into a screen is _vacuous_ — Playwright never fetches the unwired asset, so CI cannot detect malformation. Supplement with local XML parse + Vercel preview inspection (see §3.3.2). **Caveat for canon-changing PRs:** before posting `APPROVE` on any PR whose diff touches `public/canon/`, confirm `gh pr checks <num>` shows the e2e Playwright run COMPLETED with conclusion `success` — not `in_progress`, `cancelled`, or `failure`. `canon:lint` + `vitest` passing is necessary but NOT sufficient: literal canon-content E2E assertions silently couple to the OLD pool ordering and only surface on Playwright. Triggered by PR #266 (2026-05-16) — cross-reviewer approved on canon JSON + vitest while Playwright still in flight; Playwright was the only gate that caught the spec-coupling failure. See §6 "Canon-content-coupled E2E spec drift" for the full pattern + defensive grep recipe.
- **Option-B (`test.fixme()`) reviewer-protocol: grep testids manually.** When reviewing a fixme'd failing-first spec, REVIEWER must verify each `getByTestId(...)` value the spec uses by grepping the render surface (e.g. `Math.tsx`, screen components). Playwright NEVER executes the locator while `test.fixme()` is active, so a misnamed testid hides behind the fixme veil and only surfaces at flip-PR time as locator-not-found. The spec's own local-run (4 SKIPPED chromium) is not a sufficient gate. Triggered 2026-05-17 on PR #271 (Jessica's sub-to-20 E2E): spec named `math-read-aloud-text` but canonical surface is `math-caption` (`Math.tsx:2273`). Devon caught it in cross-review. **Add to every Option-B failing-first spec review brief:** "Verify each `getByTestId(...)` value exists in the render surface via grep; report mismatches as CHANGES_REQUESTED before approving."
- **Option-B reviewer-protocol extension — grep `failNetwork` in fixme'd specs that assert on focus-keyed content.** When reviewing a fixme'd failing-first spec, also grep for `installClaudeMock(.*failNetwork.*true)` in the spec. If found, inspect every assertion and ask: "Is this assertion satisfiable against the add-to-10 static fallback that `pickStaticSessionPlan` returns for this focus?" If the spec asserts on `op`, operand range, or cross-tier content for a non-`add-to-20` focus, `failNetwork` is unsafe — flag as CHANGES_REQUESTED with a pointer to §6 "`failNetwork` + structural assertion + wrong-tier static fallback." This grep is mechanical (~30 seconds); add it as a step alongside the testid grep in every Option-B review brief. Triggered 2026-05-17 on PR #275: 3/4 tests re-fixme'd because the mock-harness mismatch was not caught at PR #271 review time.
- **`feedback_ipad_first_gesture_testing.md`** — When testing gesture-unlock paths, the first user gesture must BE the flow under test, not a warmup tap that consumes the unlock event silently.

The rule that most often catches subtle bugs is the count-based-assertion rule — `.toContain` looks innocent but a regression that adds the matching item to a longer list still passes.

---

## 10. CI signal interpretation

Patterns to recognise when triaging CI status:

| Signal                                                | Interpretation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One CANCELLED + one SUCCESS for `e2e` on the same SHA | Concurrency cancel-in-progress — newer push superseded older run. Normal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CANCELLED with **no sibling SUCCESS** on the same SHA | Likely the **35-min `timeout-minutes` cap** (was 25 pre-PR #281, 2026-05-17), not a concurrency cancel — cold-cache Playwright runs on a freshly-rebased head can hit the budget. Check the job's `startedAt`/`completedAt` span: ~35 min ⇒ timeout-cap (just `gh run rerun` it — warm cache usually fits); a short span with a newer run present ⇒ concurrency. Seen on PR #228 (2026-05-14, rebased head, pre-bump) and PR #279 (2026-05-17, post-bump trigger).                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Both CANCELLED                                        | Manual cancellation or workflow-level cancel — investigate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| FAILURE on `e2e` for a single browser project         | Often the WebKit headless `AudioContext` gap — re-read the spec to check if it should `skip` on webkit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| FAILURE on `post-deploy-smoke`                        | Production cold-start regression. Memory `project_vercel_runtime_config.md` is the most common cause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| FAILURE on PR but PASS on main                        | Likely a flake or a genuinely new regression — re-run before bisecting. CI retries are 2 already, so a third attempt rarely changes the verdict.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `gh pr merge` returns 504                             | Verify with `gh pr view --json mergedAt` first — server-side merge often succeeded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `in_progress` with elapsed time >> the 35-min cap     | Infra hang — the runner picked up the job, ran setup steps cleanly, then wedged on the actual test step with no further heartbeat. Distinct from the timeout-cap CANCELLED pattern (this row never auto-cancelled). **Diagnose with the FULL step timeline**, not just `updatedAt`: `gh run view <id> --json jobs --jq '.jobs[].steps[] \| {name, status, startedAt, completedAt}'`. The hang signal is "Run e2e suite" step `status=in_progress` with `startedAt` more than ~40 min ago AND elapsed wall-time >> 35 min. **Do NOT rely on `updatedAt` alone** — it only refreshes at step transitions, so a fresh healthy run also shows `updatedAt ≈ startedAt + few seconds`. Recovery: `gh run cancel <id>` → wait for `conclusion=cancelled` (a few seconds) → `gh run rerun <id>`. The rerun reuses the same run-id and starts a fresh job under it. Seen 2026-05-16 on PR #270 (3.5h wedge at "Run e2e suite"; setup steps clean). |

Memory rule `feedback_background_agent_notification_delay.md` notes that Task-notifications can be 20+ min late; in drain mode, poll `gh pr list` every 3-5 min rather than relying solely on the notification system.

**`gh run watch` is unreliable in this environment — do not depend on it.** Observed repeatedly (PRs #228, #226, 2026-05-14): `gh run watch <id> --exit-status` exits `1` _prematurely_ while the run is still `in_progress` — the watch tool gives up, the run is fine. An exit-1 from `gh run watch` is therefore NOT a signal that CI failed. To monitor a run to completion, **poll `gh run view <id> --json status,conclusion`** on a `ScheduleWakeup` tripwire (or the away-tick) instead — `conclusion` is empty until the run actually finishes, then `success`/`failure`/`cancelled`. Never merge or revert based on a `gh run watch` exit code alone; always confirm with `gh run view`.

---

## 11. Multi-agent worktree topology — per-role persistent worktrees

Adopted 2026-05-15 (canonical memory: `feedback_per_role_persistent_worktrees.md`). Supersedes the prior pattern where each agent self-created a worktree under `MarianLearning/.claude/worktrees/<slug>` per dispatch. This section complements the operational gotchas in §5 (empty `node_modules`, structurally-broken Agent-tool `isolation: "worktree"`) and the worktree-pitfall set in §7.5 / §7.6 / §7.7.

### 11.1 Topology — 7 sibling worktrees

Seven persistent worktrees live as siblings of the main checkout under `C:/Trunk/PRIVATE/`:

| Role            | Worktree path                                 | Idle branch    |
| --------------- | --------------------------------------------- | -------------- |
| Matt (lead)     | `C:/Trunk/PRIVATE/MarianLearning-matt-wt/`    | `matt/idle`    |
| Kyle (UX)       | `C:/Trunk/PRIVATE/MarianLearning-kyle-wt/`    | `kyle/idle`    |
| Kevin (dev)     | `C:/Trunk/PRIVATE/MarianLearning-kevin-wt/`   | `kevin/idle`   |
| Devon (dev)     | `C:/Trunk/PRIVATE/MarianLearning-devon-wt/`   | `devon/idle`   |
| Jessica (QA)    | `C:/Trunk/PRIVATE/MarianLearning-jessica-wt/` | `jessica/idle` |
| Dave (research) | `C:/Trunk/PRIVATE/MarianLearning-dave-wt/`    | `dave/idle`    |
| Orchestrator    | `C:/Trunk/PRIVATE/MarianLearning-orch-wt/`    | `orch/idle`    |

Each worktree parks on its `<role>/idle` branch (tracking `origin/main`) between tasks. The main checkout at `C:/Trunk/PRIVATE/MARIAN-TUTOR/MarianLearning` is the orchestrator survey checkout and is READ-ONLY — agents must not touch it.

### 11.2 Run-start invocation

Every persona dispatch begins with:

```bash
cd C:/Trunk/PRIVATE/MarianLearning-<role>-wt
git fetch origin
git checkout -B <role>/<task-name> origin/main
```

`-B` recreates the branch off fresh `origin/main` regardless of where the worktree was previously parked. Persona files + `TEAM.md` have been updated with this invocation — do NOT restate it in dispatch briefs; reference the persona-file rule instead.

### 11.3 Operational gotchas (inherited from the old pattern)

- **`.env.local` lives only in the canonical MarianLearning checkout.** Each role's worktree starts without `.env.local`; copy from the canonical checkout (`cp ../MARIAN-TUTOR/MarianLearning/.env.local .`) or symlink on first use if the role needs Azure/Anthropic credentials. QA/E2E work typically does not — `mockClaude.ts` intercepts all `/api/claude` calls (see §4.2).
- **`node_modules` is per-worktree.** First dispatch into a fresh worktree must run `yarn install --prefer-offline` before any `yarn typecheck` / commit / e2e. Pre-commit hooks fail without it (see §5 "empty `node_modules`" gotcha).
- **Vitest junction-resolution on Windows.** Symlinks (junctions) into `node_modules` from sibling worktrees confuse Vitest's module resolver. Don't symlink — install per-worktree.
- **Agent-tool `isolation: "worktree"` is structurally BROKEN here.** The session root (`C:/Trunk/PRIVATE/MARIAN-TUTOR/`) is not a git repo; only the nested `MarianLearning/` subdir is. Dispatch WITHOUT the isolation flag. The persistent role worktree already exists at dispatch — no Agent-tool worktree creation needed. See §5 for the full diagnosis and the structural error trace.

### 11.3.1 Cross-review branch-collision — `gh pr checkout` fallback

**Symptom:** Cross-reviewer (Devon) cannot `gh pr checkout 261 --repo TSandvaer/MarianLearning` if Kevin already has branch `refactor/...` checked out in his own worktree (`MarianLearning-kevin-wt`). Git worktrees enforce branch uniqueness across worktrees on the same repo — a branch checked out in one worktree cannot be re-checked-out in another.

**Fallback (Devon, PR #261 cross-review, 2026-05-16):**

```bash
cd C:/Trunk/PRIVATE/MarianLearning-devon-wt
git fetch origin pull/261/head:pr-261-review
git checkout pr-261-review
```

This fetches the PR head directly into a new local branch with a different name (e.g. `pr-261-review` instead of the author's branch name) — bypassing the worktree-uniqueness check. The reviewer's local branch is throwaway; on next idle return, `git checkout devon/idle && git pull --ff-only` restores the standard state.

**When to use:** Any cross-review where the author and reviewer use different role worktrees and the author still has their feature branch checked out at review time. Standard pattern in this project; bake into cross-review dispatch briefs going forward.

**Why not `git worktree remove` the author's worktree first:** that's destructive (would lose the author's local state, including any unpushed commits or WIP). The `git fetch refspec:newbranch` form is non-destructive and reviewer-local.

### 11.3.2 Code-trace substitute for spec re-run when worktree-conflict-locked

§11.3.1 documents the `gh pr checkout` fallback for when another role's worktree owns the branch a reviewer needs. Even with the fallback, _running_ the spec under Playwright in a detached/throwaway-branch state is slow (full browser install warm-up + spec setup) and awkward — and for some assertion classes, unnecessary. For specs whose load-bearing assertion is a **simple structural check against a known producer** — `expect(seedDoc.someField).toBeDefined()`, `expect(rowArray).toEqual([...])`, `expect(payload.shape).toMatchObject({...})`, count-based `.toHaveCount(N)`, attribute-equality assertions — code-tracing the assertion against the producer is a deterministic, ~30-second substitute.

**Pattern:**

1. Read the spec; identify the load-bearing assertion (the one that _would_ fail if the implementation regressed).
2. Identify the producer — the module / function / writer site that emits the value the assertion reads. For seeded-state assertions, this is the seedStorage builder. For request-body assertions, this is the screen's `/api/claude` POST construction. For DOM-attribute assertions, this is the JSX site.
3. `Grep` for the producer's writer to confirm it emits the expected shape / value. Example: `Grep` for `payload.progress.leitner` writers in `src/screens/Math/` to verify the wire shape the spec asserts on.
4. If the producer's output structurally matches the spec's assertion, the spec will pass at runtime; no Playwright re-run needed.

**Scope and limits.** The substitute is correct for **structural / shape / presence / count** assertions. It is NOT a substitute for:

- Timing / latency assertions (band-invariant, debounce windows) — these require the runtime.
- Visual / layout assertions (bounding-box, viewport-fit) — require the browser layout engine.
- Audio-gate assertions (`data-read-aloud-played`, gesture-unlock state) — require the Howler runtime + audio context.
- Multi-step state-transition assertions where the failure could be in the transition machinery, not the producer.
- Assertions on values the producer mutates conditionally based on runtime input the code-trace can't model.

**When to reach for it.** Cross-review only — when the reviewer's worktree is conflict-locked and the assertion class is structural. For author-side validation, run the spec proper.

Reference precedent: PR #305 review (Wave 5, 2026-05-22) — the spec's load-bearing assertion was a `SessionHistoryEntry.perProblemDistractorClass` `.toBeDefined()` check; the reviewer code-traced `Math.tsx` for writers to `perProblemDistractorClass` (zero hits = RED-for-the-right-reason) and signed off without a full Playwright re-run.

### 11.4 Cross-references

- Memory: `feedback_per_role_persistent_worktrees.md` — canonical adoption record + supersession note for the old pattern.
- Memory: `feedback_worktree_isolation.md` — superseded 2026-05-15; old operational gotchas (the three above) remain accurate.
- Memory: `feedback_agent_isolation_worktree_broken.md` — structural diagnosis of the Agent-tool `isolation: "worktree"` flag in this project.
- §5 — pre-commit hooks and the `node_modules` / `isolation: "worktree"` gotchas as they manifest at commit time.
- §7.5 / §7.6 / §7.7 — historical worktree pitfalls (local-`main` pollution, absolute-path escapes, double-force cleanup).

---

## 12. Dispatch-sentinel Stop hook (orchestrator-only)

Authored 2026-05-15 (canonical memory: addendum on `feedback_agent_staleness.md` "STRUCTURAL ENFORCEMENT"). Structurally enforces the tripwire-pairing rule on background-agent dispatches; a behavioural rule alone was failing ~3× per session.

### 12.1 What it does

When the assistant ends a turn, the hook walks the latest contiguous assistant span in the transcript JSONL and counts:

- Number of `Agent({run_in_background: true})` tool_use blocks — "dispatches."
- Number of `ScheduleWakeup` tool_use blocks AND one-shot `CronCreate(recurring: false)` blocks — "tripwires."

If dispatches > tripwires, the hook BLOCKS the turn-end and instructs the orchestrator to add a tripwire before stopping. This is the structural backstop for `feedback_agent_staleness.md` — every background dispatch must be paired with a `ScheduleWakeup` at ~2× expected duration so a stale agent gets noticed even during active conversation.

### 12.2 Files

- `.claude/hooks/dispatch-sentinel-stop.sh` — bash wrapper; handles `stop_hook_active` re-entry and swallows Python errors silently.
- `.claude/hooks/dispatch-sentinel-stop.py` — JSONL detector. Walks backwards from the end until it hits a `user` entry, accumulating tool_use blocks from the latest assistant span.
- Registered in `.claude/settings.json` under `hooks.Stop[]` alongside `maintain-docs-stop.sh`.

### 12.3 Defensive failure mode

Any Python parse error, missing-transcript error, or unexpected JSONL shape causes the hook to `exit 0` silently. False-positive blocking (preventing a legitimate turn-end) would be much worse than missed-detection. The Python detector wraps every `json.loads` in `try/except json.JSONDecodeError` and skips malformed lines.

### 12.4 Scope — orchestrator-only

This hook fires on every Stop event in every session that has the project's `.claude/settings.json` loaded. In practice, **only the orchestrator session dispatches background Agents** — sub-agents (Jessica, Devon, Kevin, Kyle, Dave, Matt) don't spawn nested background agents. Persona sub-agents will never trigger the dispatch-counted branch; the hook is a no-op for them.

Documented here so a future sub-agent that sees the hook in `.claude/settings.json` doesn't get confused about whether it applies to them. It does not.

### 12.5 Cross-references

- Memory: `feedback_agent_staleness.md` — the behavioural rule the hook structurally enforces; the addendum at the end of that entry pins the structural backstop.
- Memory: `feedback_no_idle_no_stale_agents.md` — adjacent orchestration discipline.

---

## Cross-references

- Memory: `feedback_run_vitest_before_merge.md` — the pre-push vitest rule.
- Memory: `feedback_count_assertions_on_regression_tests.md` — `.toEqual` vs `.toContain`.
- Memory: `feedback_test_timing_vs_real_safari.md` — effect-closure race detection.
- Memory: `feedback_playwright_disabled_button_click.md` — `force: true` doesn't bypass `disabled`.
- Memory: `feedback_wait_for_ci_before_merge.md` — wait for green Playwright before merging.
- Memory: `feedback_ipad_first_gesture_testing.md` — first-gesture test discipline.
- Memory: `reference_gh_pr_merge_504.md` — verify before retrying merge.
- Memory: `project_canon_commit_strategy.md` — canon committed, regenerate locally.
- Memory: `project_anthropic_billing_constraint.md` — empty balance fails CI builds, prod survives.
- Memory: `project_vercel_runtime_config.md` — never `runtime: 'nodejs'` in `/api/*.ts`.
- Memory: `reference_deploy.md` — Vercel auto-deploy.
- Memory: `reference_pwa_asset_size_limits.md` — `gh pr merge --auto` disabled, Windows yarn EPERM workaround.
- Memory: `feedback_background_agent_notification_delay.md` — poll `gh pr list` in drain mode.
- Source: [vite.config.ts](MarianLearning/vite.config.ts) — Vitest configuration.
- Source: [playwright.config.ts](MarianLearning/playwright.config.ts) — Playwright configuration.
- Source: [e2e/\_helpers/seedStorage.ts](MarianLearning/e2e/_helpers/seedStorage.ts) — localStorage seeding + `forceHowlerUnlock`.
- Source: [e2e/\_helpers/mockClaude.ts](MarianLearning/e2e/_helpers/mockClaude.ts) — `/api/claude` route handler.
- Source: [.github/workflows/e2e.yml](MarianLearning/.github/workflows/e2e.yml) — Playwright CI workflow.
- Source: [.github/workflows/post-deploy-smoke.yml](MarianLearning/.github/workflows/post-deploy-smoke.yml) — production smoke workflow.
- Source: [.husky/pre-commit](MarianLearning/.husky/pre-commit) — pre-commit hook.
- Source: [src/lib/progress/guards.ts](MarianLearning/src/lib/progress/guards.ts) — `SKILL_NODES` set that `seedStorage.ts` mirrors.
- Sibling doc: `architecture-overview.md` (Agent A) — app entry + route state machine.
- Sibling doc: `audio-system.md` (Agent B) — Howler / Path-A / gesture-unlock production path.
- Sibling doc: `progress-and-persistence.md` (Agent C) — `Progress` document shape, mastery rule, what tests assert about progress.
