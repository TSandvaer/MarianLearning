/**
 * Screen 2 — Greet (stub).
 *
 * Real implementation lives on Ticket B (`86c9gnhez`). This stub only exists
 * so the route hand-off from Splash has a destination — when Ticket B lands,
 * this file becomes the real Greet component without touching App.tsx.
 *
 * Cream background is intentional: spec line 79 says the cream bg "stays as
 * background for Screen 2 (shared layout — no hard cut)". Keeping it here so
 * the splash → greet visual continuity is real even with a placeholder body.
 */
export default function Greet() {
  return (
    <main
      data-testid="greet-stub"
      className="
        flex h-full w-full items-center justify-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
      "
    >
      <p className="text-2xl font-medium">Greet (TBD)</p>
    </main>
  )
}
