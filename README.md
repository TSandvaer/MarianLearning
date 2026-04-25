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
src/
  App.tsx              app root
  Hello.tsx            scaffold hello page (replaced in W2)
  main.tsx             React + SW registration entry
  index.css            Tailwind entry
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

Copy `.env.example` to `.env.local`. `VITE_CLAUDE_API_ENDPOINT` points at the
Vercel function that proxies Anthropic — the API key lives there, never in
the bundle.

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
