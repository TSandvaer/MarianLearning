# Marian Tutor

Personal learning PWA for Marian. React + Vite + TypeScript + Tailwind, Claude
via a Vercel function, progress in localStorage.

## Scripts

| Command                             | What it does                               |
| ----------------------------------- | ------------------------------------------ |
| `yarn dev`                          | Vite dev server at http://localhost:5173   |
| `yarn build`                        | Type-check + production build into `dist/` |
| `yarn preview`                      | Serve the production build locally         |
| `yarn lint`                         | ESLint                                     |
| `yarn format` / `yarn format:check` | Prettier                                   |
| `yarn typecheck`                    | `tsc -b --noEmit`                          |
| `yarn test`                         | Vitest (single run)                        |
| `yarn test:watch`                   | Vitest in watch mode                       |
| `yarn test:coverage`                | Vitest with V8 coverage                    |

## Layout

```
api/
  claude.ts            Vercel function — Anthropic proxy (stub in 86c9gkm0c)
  _types.ts            shared request/response types (private — leading _)
src/
  App.tsx              app root
  Hello.tsx            scaffold hello page (replaced in W2)
  main.tsx             React + SW registration entry
  index.css            Tailwind entry
  lib/
    claude/
      client.ts        callClaude() — browser-side wrapper around /api/claude
  pwa/
    registerServiceWorker.ts   manual SW registration (prod only)
    sw.ts                      Workbox SW (injectManifest source)
  test/
    setup.ts           Vitest + RTL setup
public/
  icons/               app + apple-touch icons (placeholder)
  splash/              iPad portrait splash screens (placeholder)
  offline.html         offline fallback page
```

## Environment

Copy `.env.example` to `.env.local`. Two halves:

- `VITE_CLAUDE_API_ENDPOINT` — browser-side. Default `/api/claude`. Only
  override for unusual local setups.
- `ANTHROPIC_API_KEY` — **server-side only**. Read by the `/api/claude`
  Vercel function from `process.env`. **Never** prefix with `VITE_` and
  **never** read it from `src/`. The browser bundle must not contain it.

In production, set `ANTHROPIC_API_KEY` in the Vercel dashboard
(Project Settings -> Environment Variables) for Production / Preview /
Development as appropriate. Do not commit a populated `.env.local`.

## Local development with the API function

`yarn dev` runs only the Vite dev server — it cannot serve the `/api/*`
function. To exercise the Claude endpoint locally, use the Vercel CLI:

```sh
# one-time
npm i -g vercel
vercel link        # links the directory to the Vercel project

# every run
vercel dev         # serves Vite on :3000 and the /api/* functions together
```

`vercel dev` reads `.env.local` automatically, so a populated
`ANTHROPIC_API_KEY` line is enough — no Vercel-side config needed for local
work. The function returns a stub payload until follow-up tickets wire the
real prompt.

## PWA install (iPad)

1. `yarn build && yarn preview`
2. Open the preview URL in Safari on the iPad.
3. Share sheet -> Add to Home Screen.
4. Launch from the home icon; the app should open full-screen in portrait.

The manifest lives at `/manifest.webmanifest`. Icons and splashes in
`public/icons/` and `public/splash/` are solid-color placeholders; Kyle
replaces them in ticket 86c9gkm42.

## Git hooks

Husky runs `yarn typecheck` and `lint-staged` on commit. Never use
`--no-verify`; fix the cause.

## ESM resolution in `api/`

`package.json` declares `"type": "module"`, so the deployed `claude.js`
(compiled from `api/claude.ts`) is ESM. **Every relative import inside
`api/*.ts` MUST end in an explicit `.js` extension** — e.g.
`from './_types.js'`, not `from './_types'`. Same rule applies to
`vi.mock('./_session.js', ...)` calls in `api/*.test.ts`.

Why: Node ESM strict-resolution at the Vercel runtime does not resolve
bare specifiers; it throws `ERR_MODULE_NOT_FOUND` at module-load and
Vercel surfaces that as `FUNCTION_INVOCATION_FAILED` (HTTP 500) on every
request. TypeScript bundler-resolution and Vitest both forgive bare
specifiers, so unit tests pass green, type-check passes, lint passes —
and prod is dead. We learned this the hard way (PR #36 closed the loop
after three hot-fix rounds; see `memory/project_vercel_runtime_config.md`).

`yarn lint` enforces this via the custom rule
`marian-api/require-js-extension` (defined in
`eslint-rules/require-js-extension.js`, scoped to `api/**/*.ts` only).
The `.js` suffix resolves back to the matching `.ts` source under
`moduleResolution: "bundler"` for type-check + Vitest, so one canonical
spelling works in dev, test, and prod.

The rule does NOT apply to `src/**` — Vite bundles those files for the
browser and the strict-resolution constraint does not apply.
