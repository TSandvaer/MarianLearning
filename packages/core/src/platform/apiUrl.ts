/**
 * Base URL for the Vercel functions under `/api/*`.
 *
 * The web app is served from the same origin as its functions, so the
 * default base is empty and `apiUrl('/api/claude')` stays the relative
 * `/api/claude`. A native app has no origin; it calls `setApiBase` with
 * the deployment URL at boot (e.g. `https://marian-learning.vercel.app`).
 */
let apiBase = ''

/** Set the absolute origin the API lives on. `''` restores relative URLs. */
export function setApiBase(base: string): void {
  apiBase = base.replace(/\/+$/, '')
}

/** Resolve an API path (`/api/claude`) against the configured base. */
export function apiUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`
  return `${apiBase}${normalised}`
}
