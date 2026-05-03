/**
 * "Tap to continue" affordance — fallback when iOS audio recovery
 * needs a user gesture but Marian hasn't tapped on her own.
 *
 * Ticket 86c9kxtmu (PR #137 round 2). When Marian backgrounds the PWA
 * mid-session and the visibility-recovery gate marks pending (iOS
 * handed us suspended/interrupted on the visible edge), the audio
 * cannot resume until a user gesture fires. The chip-tap / hub-node
 * tap path covers the common case — Marian comes back and immediately
 * taps something on screen. But if she just stares at the silent UI
 * (the audio queue is full of one read-aloud waiting to drain), we
 * need a visible affordance that says "tap anywhere to continue".
 *
 * Visual shape
 * ------------
 * Re-uses Greet's wake-tap ring shape verbatim per the brief. A
 * full-screen invisible tap target (so any tap anywhere unsticks) with
 * a centred breathing ring + finger-tap icon on top of a dimmed
 * scrim. The scrim doesn't go fully opaque — Marian still sees the
 * Math/Word Song surface behind so context is preserved.
 *
 * When it shows
 * -------------
 * Subscribes to `pendingResumeGate`'s affordance state. Renders only
 * when the state is `'awaiting-tap'` — i.e. the visible edge marked
 * pending AND the 3 s fallback timer elapsed without a real gesture
 * draining the queue. The `'pending'` state is silent (the affordance
 * doesn't flash up during the brief common-case window where Marian
 * tapped within a few hundred ms of returning).
 *
 * Tap handling
 * ------------
 * `onPointerDown` is the gesture iOS associates the audio resume with.
 * We call `drainOnGesture(resume, unlock)` synchronously from the
 * pointerdown handler so the resume + silent buffer fires inside the
 * gesture's tick. The drain clears the gate to `'idle'`, the
 * subscription un-renders the affordance, and the queued utterance
 * plays.
 */

import { useEffect, useState } from 'react'
import { LazyMotion, MotionConfig, domAnimation, m } from 'motion/react'

import {
  drainOnGesture,
  getPendingResumeAffordanceState,
  subscribePendingResumeGate,
  type PendingResumeAffordanceState,
} from '../lib/audio/pendingResumeGate'
import {
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from '../lib/audio/howlerContext'

export interface PendingResumeAffordanceProps {
  /**
   * Test seam — override the resume + unlock fns. Production omits;
   * the real howlerContext helpers run.
   */
  resumeFn?: () => void
  unlockFn?: () => void
}

export function PendingResumeAffordance({
  resumeFn,
  unlockFn,
}: PendingResumeAffordanceProps): React.ReactElement | null {
  const [state, setState] = useState<PendingResumeAffordanceState>(() =>
    getPendingResumeAffordanceState(),
  )

  useEffect(() => {
    return subscribePendingResumeGate(setState)
  }, [])

  if (state !== 'awaiting-tap') return null

  const handleTap = (): void => {
    drainOnGesture(
      resumeFn ?? resumeHowlerContextOnGesture,
      unlockFn ?? unlockIosAudioSession,
    )
  }

  // The motion wrappers here mirror App's LazyMotion wrapper around
  // every screen — when this affordance is the only thing rendered
  // outside the AnimatePresence (on Hub-route), we still want the
  // ring's breathing-pulse to honour the user's reduce-motion
  // preference.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          data-testid="pending-resume-affordance"
          role="button"
          tabIndex={0}
          aria-label="Tap to continue"
          onPointerDown={handleTap}
          // Keyboard fallback for parents using bluetooth keyboards on
          // the iPad — Space / Enter dispatches the same drain. iOS
          // Safari translates the keyboard event to a synthetic
          // pointer-like activation that satisfies the gesture
          // requirement.
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              handleTap()
            }
          }}
          className="
            fixed inset-0 z-[100]
            flex items-center justify-center
            bg-black/35
            cursor-pointer
            touch-manipulation
          "
        >
          <m.div
            initial={{ scale: 0.92, opacity: 0.8 }}
            animate={{
              scale: [0.92, 1.04, 0.92],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="
              flex h-32 w-32 items-center justify-center
              rounded-full
              border-4 border-white/85
              bg-white/15
              shadow-[0_0_24px_rgba(255,255,255,0.35)]
            "
          >
            <span className="text-5xl" aria-hidden="true">
              ☝️
            </span>
          </m.div>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  )
}
