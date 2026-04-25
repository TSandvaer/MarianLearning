import { m } from 'motion/react'

/**
 * Screen 3 — Math (Number Garden) STUB.
 *
 * The real math screen is a future ticket (Week 3). This stub exists so the
 * Greet → Math hand-off (heart tap) has a destination — when the Number
 * Garden ticket lands it'll replace this file without touching App.tsx.
 *
 * Same pattern Devon used for the Greet stub during Splash development:
 * minimal markup, identical safe-area handling, and crucially the
 * `layoutId="melody"` wrapper so the shared-element transition from Greet
 * (per spec line 696) has somewhere to land.
 *
 * Anything beyond "Melody is here, screen exists" is out of scope.
 */
export default function Math() {
  return (
    <main
      data-testid="math-stub"
      className="
        relative flex h-full w-full flex-col items-center justify-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
      "
    >
      <m.img
        layoutId="melody"
        src="/assets/melody-idle.svg"
        alt="Melody"
        draggable={false}
        className="h-[40vh] w-auto select-none"
      />
      <p className="mt-8 text-2xl font-medium">Number Garden (TBD)</p>
    </main>
  )
}
