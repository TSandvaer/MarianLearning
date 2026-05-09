/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Commit SHA injection for the diagnostic instrumentation pass
 * (ticket 86c9hjnn8 follow-up). The build resolves the SHA from
 * Vercel's `VERCEL_GIT_COMMIT_SHA` env var (set automatically on every
 * Vercel deployment) or from the explicit `VITE_COMMIT_SHA` override
 * if a caller wants to pin a value. When neither is set we emit
 * `'unknown'` — the iPad debug overlay reads this to detect "Thomas
 * loaded a stale service-worker bundle" without requiring any pretty
 * formatting or git introspection.
 *
 * Defined here (not via `loadEnv`) because we want this to flow into
 * `import.meta.env.VITE_COMMIT_SHA` at build time even when the
 * variable is named `VERCEL_GIT_COMMIT_SHA` upstream — the rename
 * happens in this config, not in the Vercel project settings.
 */
const commitSha =
  process.env.VITE_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(commitSha),
  },
  plugins: [
    react(),
    VitePWA({
      // injectManifest gives us full control of the SW file; the precache
      // manifest is injected into src/pwa/sw.ts at build time. See AC.
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectRegister: false, // we register manually in src/pwa/registerServiceWorker.ts
      registerType: 'autoUpdate',
      includeAssets: [
        'offline.html',
        'icons/apple-touch-icon-180x180.png',
        'icons/apple-touch-icon-167x167.png',
        'icons/apple-touch-icon-152x152.png',
        'icons/apple-touch-icon-120x120.png',
      ],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Marian Tutor',
        short_name: 'Marian',
        description: 'A personal learning companion for Marian.',
        lang: 'en',
        // Melody pink — placeholder, Kyle owns the final value (86c9gkm42)
        theme_color: '#f85a93',
        background_color: '#fff5f8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Precache HTML, JS, CSS, PNG, SVG, webmanifest, plus MP3s for the
        // pre-recorded Greet voice lines (ticket 86c9gqprh). The Greet
        // audio is gateway-critical — the screen can't progress until line
        // 1 plays, so we want it ready offline-first rather than paying
        // network latency on a freshly-installed PWA.
        globPatterns: [
          '**/*.{js,css,html,png,svg,webmanifest,woff,woff2,ico,mp3}',
        ],
        // PER-FILE precache gate (NOT cumulative). Workbox excludes any
        // single asset larger than this from the precache manifest; total
        // precache size has no cap here — it's bounded only by browser
        // quota at install time.
        //
        // Lifted from default 2 MiB → 4 MiB (PR #104, Emma assets) → 8 MiB
        // (this ticket, 86c9qa7uh) so the upscaled Emma SVGs (~2.5-3.3 MB
        // each at 2000x2000 PNG-in-SVG, ticket 86c9kww0z) fit comfortably
        // with headroom for future asset additions. Picture-pack SVGs
        // (~73-414 KB each at 500x500 PNG-in-SVG via scripts/embed-pictures.ts)
        // are nowhere near the cap and don't drive this value.
        //
        // Cumulative-size concerns (PWA install footprint as the picture
        // pack grows across short-i / short-e / future tiers) do NOT
        // interact with this setting. Build-time precache-size signal is
        // surfaced in the `vite-plugin-pwa` build output ("precache N
        // entries (X KiB)"); review that figure when adding new asset
        // families. As of this writing, with 34 picture-pack SVGs +
        // Emma + audio, the precache totals ~30 MiB — well under typical
        // installed-PWA quotas on iPad Safari.
        //
        // Future polish-backlog options to slim individual assets:
        // zopfli/oxipng re-encode, WebP-in-SVG, or vector re-trace.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Vitest's default include picks up `**/*.spec.ts`. The Playwright e2e
    // suite under `e2e/` uses `.spec.ts` too — exclude those files so
    // `vitest run` doesn't try to import Playwright tests in jsdom (which
    // would crash on `@playwright/test`'s test fixture API). Run e2e via
    // `yarn e2e` (Playwright runner) instead.
    //
    // Narrowed from `e2e/**` to `e2e/**/*.spec.ts` in ticket 86c9qa0kq so
    // helper-level `.test.ts` files under `e2e/_helpers/` (which exercise
    // pure-function helpers consumed by the Playwright specs) can be
    // picked up by vitest. Playwright's runner only ever consumes
    // `.spec.ts`, so this stays a clean two-runner split.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'e2e/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
