/// <reference types="vite/client" />

/**
 * Build-time environment variables exposed to the browser bundle.
 *
 * `VITE_COMMIT_SHA` is injected by `vite.config.ts` from Vercel's
 * `VERCEL_GIT_COMMIT_SHA` (or an explicit `VITE_COMMIT_SHA` override).
 * Defaults to `'unknown'` when neither is set during the build —
 * see ticket 86c9hjnn8 follow-up for the diagnostic-bundle rationale.
 */
interface ImportMetaEnv {
  readonly VITE_COMMIT_SHA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
