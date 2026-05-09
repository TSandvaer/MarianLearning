/**
 * Playwright configuration — Marian Tutor e2e harness.
 *
 * Ticket 86c9kwnmx (P0.1 from the 2026-05-02 polish audit).
 *
 * Why Playwright (not Cypress): native WebKit (Safari engine) ships with
 * the runner. The PWA target is iPad Safari standalone, so WebKit-engine
 * coverage is non-negotiable; Cypress is Chromium-only.
 *
 * Why two projects (Chromium + WebKit): Chromium is the cheap regression
 * detector for cross-screen state machines; WebKit is the iPad-engine
 * surrogate. Firefox is intentionally NOT in v1 — Marian's device matrix
 * is iPad first, desktop second; Firefox engine has no Safari signal.
 *
 * Viewport: iPad Pro portrait 1024×1366. Manifest pins
 * `orientation: portrait-primary`, so landscape isn't a target.
 *
 * Web server: `vite preview` against the production build. Runs the SAME
 * artefact Vercel serves on a real prod hit; this is closer to what
 * Marian actually loads than `vite dev`.
 *
 * Mock strategy for /api/claude: tests intercept at the Playwright route
 * level (see `e2e/_helpers/mockClaude.ts`). Real Anthropic + Azure
 * pipeline is never hit during e2e — keeps the suite deterministic and
 * does not consume the prod budget.
 */

import { defineConfig, devices } from '@playwright/test'

const IPAD_PRO_PORTRAIT = { width: 1024, height: 1366 }

export default defineConfig({
  testDir: './e2e',
  // Two-runner invariant: vitest owns `.test.ts`, Playwright owns
  // `.spec.ts`. Without this restriction, Playwright's default
  // `testMatch` picks up unit-test files under `e2e/_helpers/` (e.g.
  // `slidingWindow.test.ts`, ticket 86c9qa0kq) and crashes on Vitest's
  // `expect` extending Playwright's matcher symbol
  // (`TypeError: Cannot redefine property: Symbol($$jest-matchers-object)`).
  // Mirrors the symmetric narrowing applied to vitest's `exclude` in
  // `vite.config.ts`.
  testMatch: '**/*.spec.ts',
  // Per-test timeout. The math-session walk-through specs take ~30 s
  // wall-time on the silent caption fallback path (8 problems × ~2 s
  // read + ~1.5 s advance = ~28 s, plus session-end ~5 s). Bump above
  // the 30 s default with comfort for WebKit + slow CI.
  timeout: 90_000,
  expect: {
    // Default `expect` timeout. Most assertions converge well under
    // this; a higher ceiling hides slow expectations more than it
    // helps. 10 s matches the per-locator timeouts the specs use
    // explicitly so behaviour is consistent whether or not the spec
    // passes a custom value.
    timeout: 10_000,
  },
  // Each spec is independent; allow parallel execution within a project.
  fullyParallel: true,
  // Fail the suite if a test calls `.only` — guards against accidentally
  // shipping a focused spec.
  forbidOnly: !!process.env.CI,
  // Local: 0. CI: 2. Cross-screen audio races sometimes need a flake guard
  // until we widen e2e coverage; flag any flake we hit so the underlying
  // race gets a regression ticket.
  retries: process.env.CI ? 2 : 0,
  // Limit workers in CI to keep memory predictable on GH Actions runners.
  workers: process.env.CI ? 2 : undefined,
  // Reporter: GitHub Actions annotations + a list reporter for local terms.
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Trace every retry — invaluable for debugging cross-screen audio
    // races that don't repro outside the harness.
    trace: 'on-first-retry',
    // Screenshot on failure only; keeps `e2e-results/` lean.
    screenshot: 'only-on-failure',
    // Video off — adds disk + CPU; we have traces.
    video: 'off',
    // Honor reduced-motion: 'no-preference' so Framer Motion runs the
    // full animation timeline. The reduce-motion path has its own
    // dedicated coverage in `tests/qa/`. Set on contextOptions so it
    // is forwarded to the BrowserContext.
    contextOptions: {
      reducedMotion: 'no-preference',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: IPAD_PRO_PORTRAIT,
        // Touch-emulation matters for the Hub long-press hooks and the
        // chip-tap rage-test in v2 specs.
        hasTouch: true,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: IPAD_PRO_PORTRAIT,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Build first — `preview` requires `dist/`. Tests against the prod
    // bundle (closer to what Marian actually loads than `vite dev`).
    command:
      'yarn build && yarn preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    // The build step adds ~30s on a cold cache; allow up to 3 min.
    timeout: 3 * 60 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    // Bake a deterministic test secret into the bundle so cloud-sync
    // e2e specs always exercise the wired code path. Vite reads
    // `import.meta.env.VITE_*` at build time; without this, CI builds
    // produce a bundle where `readAuthSecret()` returns null, every
    // cloud-sync helper short-circuits to "skipped" /
    // "auth-not-configured", and the conflict spec's strict
    // `expect(mock.gets).toHaveLength(1)` fails because the App
    // never makes a request. Local dev workstations with a populated
    // `.env.local` masked this — CI doesn't have `.env.local`. PR #182
    // CI run on `ba175d1` surfaced this as 10/10 cloud-sync test
    // failures.
    //
    // Value is intentionally non-secret (it's just a marker that the
    // browser bundle has SOME bearer token to ship); the e2e mock
    // route handler in `cloudSyncFixtures.ts` accepts any non-empty
    // Authorization header. Safe to commit.
    //
    // `process.env.VITE_PROGRESS_API_SECRET ?? '...'` lets a developer
    // with a real `.env.local` keep their existing flow; the explicit
    // assignment is only the CI/greenfield default.
    env: {
      VITE_PROGRESS_API_SECRET:
        process.env.VITE_PROGRESS_API_SECRET ?? 'e2e-test-secret',
    },
  },
})
