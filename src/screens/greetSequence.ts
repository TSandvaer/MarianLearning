/**
 * Greet (Screen 2) TTS sequence orchestrator.
 *
 * Spec: design/session-1.md §"Screen 2 — First Greeting (Meet Melody)" — see
 * the four lines + ~400ms gaps in the Copy/TTS script (lines 142–145), plus
 * the AC bullets at line 192–203.
 *
 * Why this lives in its own module
 * --------------------------------
 *  - The orchestration (which line to speak, when the heart appears, when to
 *    re-prompt, when to advance) is pure timing logic. Putting it here means
 *    we can unit-test the whole story without rendering a tree.
 *  - The Greet component then becomes a thin wrapper that wires this state
 *    machine into Framer Motion + the TTS utility.
 *
 * Contract
 * --------
 *  - `runGreetSequence` speaks GREET_LINES[0..3] in order, gapping LINE_GAP_MS
 *    between them, calling the supplied hooks at each state-machine boundary.
 *  - It is cancellation-safe: callers receive a `cancel()` that stops any
 *    in-flight speech and prevents pending lines from being queued.
 *  - If a `speak()` call rejects (e.g. user navigated away → cancel(); engine
 *    error), we stop the sequence; we do NOT auto-retry.
 */

import type { BoundaryEvent } from '../lib/tts'

/**
 * The four lines Melody says on Screen 2. Single source of truth — both the
 * speech engine and the caption ribbon read from this array, so there is no
 * drift between what's spoken and what's shown (AC: "no text shown that
 * Melody doesn't also say").
 */
export const GREET_LINES = [
  'Hi!',
  "I'm Melody.",
  "It's so nice to meet you.",
  "Tap the heart when you're ready.",
] as const

/**
 * Index of the line whose completion should reveal the heart CTA. Line 3
 * ("It's so nice to meet you.") per spec line 197.
 */
export const HEART_REVEAL_AFTER_LINE_INDEX = 2

/** Gap between consecutive lines, per spec line 140. */
export const LINE_GAP_MS = 400

/**
 * After 20s with no heart-tap we re-prompt once. Spec line 200.
 */
export const REPROMPT_AFTER_MS = 20_000

/**
 * The re-prompt line. Spec line 176 explicitly reuses line 4, so we replay
 * GREET_LINES[3] rather than introducing a fresh string ("no new TTS
 * generation needed").
 */
export const REPROMPT_LINE_INDEX = 3

export interface SpeakLikeOptions {
  rate?: number
  pitch?: number
  volume?: number
  onBoundary?: (event: BoundaryEvent) => void
  boundaryWPM?: number
  /**
   * Fires when the speech engine actually starts. Used by Greet to clear
   * the audio-unlock-gate watchdog. Forwarded to `lib/tts.speak()`.
   */
  onStart?: () => void
}

/**
 * Subset of `lib/tts`'s `speak` we depend on. Declared locally so tests can
 * inject a fake without dragging in jsdom's missing speechSynthesis.
 */
export type SpeakFn = (text: string, opts?: SpeakLikeOptions) => Promise<void>

export interface GreetSequenceHooks {
  /** Called the moment we kick off speaking line `index` (before its first word). */
  onLineStart?: (index: number) => void
  /** Called for every word boundary inside the currently-speaking line. */
  onWordBoundary?: (lineIndex: number, event: BoundaryEvent) => void
  /** Called after line `index` resolves naturally (not on cancel). */
  onLineEnd?: (index: number) => void
  /** Called once after the heart-reveal line completes — heart should appear. */
  onHeartReady?: () => void
  /** Called once when the entire 4-line greeting completes naturally. */
  onComplete?: () => void
  /**
   * Called when the FIRST line's TTS engine actually starts speaking. Used
   * by Greet to clear the iPad-Safari gesture-gate watchdog. Only fires for
   * line 0; subsequent lines are unlocked by definition.
   */
  onLine0Start?: () => void
}

export interface GreetSequenceOptions extends GreetSequenceHooks {
  speak: SpeakFn
  /** Test seam for setTimeout — defaults to window.setTimeout. */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam for clearTimeout — defaults to window.clearTimeout. */
  cancelSchedule?: (handle: unknown) => void
  /**
   * Test seam: override the boundary WPM forwarded to speak(). The TTS
   * utility already defaults this to 165; we expose it here for spec
   * conformance tests.
   */
  boundaryWPM?: number
}

export interface GreetSequenceHandle {
  /**
   * Kick off line 0 ("Hi!"). MUST be called synchronously inside a user
   * gesture handler on iPad Safari — see the audio-unlock note in
   * design/session-1.md → Implementation notes. Calling `start()` more than
   * once is a no-op (the orchestrator already running its sequence).
   *
   * Refactored 2026-04-25 (ticket 86c9gp99a): previously the sequence
   * auto-started inside `runGreetSequence`. The auto-start was incompatible
   * with iPad Safari's per-execution-context gesture gate — the very first
   * `speak()` was being silently rejected because it ran in the screen
   * mount's effect tick rather than inside the tap handler. The Greet
   * component now constructs the handle on mount and invokes `start()`
   * inside its synchronous Wake-tap handler.
   */
  start: () => void
  /**
   * Cancel the sequence: any in-flight `speak()` is left to its own cancel
   * (callers should also call tts.cancel() to silence the engine), and no
   * further lines will be queued.
   */
  cancel: () => void
}

/**
 * Build the four-line greet orchestrator. **Returns immediately without
 * speaking** — call `start()` on the handle (synchronously, inside a user
 * gesture) to actually kick off line 0.
 */
export function runGreetSequence(
  opts: GreetSequenceOptions,
): GreetSequenceHandle {
  const schedule = opts.schedule ?? ((cb, ms) => window.setTimeout(cb, ms))
  const cancelSchedule =
    opts.cancelSchedule ?? ((h) => window.clearTimeout(h as number))

  let started = false
  let cancelled = false
  let pendingHandle: unknown = null

  const stopPending = () => {
    if (pendingHandle !== null) {
      cancelSchedule(pendingHandle)
      pendingHandle = null
    }
  }

  const speakLine = (index: number): void => {
    if (cancelled) return
    if (index >= GREET_LINES.length) {
      opts.onComplete?.()
      return
    }
    opts.onLineStart?.(index)
    // We *synchronously* invoke speak() so the very first call (index === 0)
    // sits inside the same JS tick as the user-gesture handler that called
    // start(). Awaiting the returned promise still works for line ordering;
    // the synchronous dispatch is what iPad Safari's audio unlock cares about.
    const speakPromise = opts.speak(GREET_LINES[index], {
      boundaryWPM: opts.boundaryWPM,
      onBoundary: (event) => {
        if (cancelled) return
        opts.onWordBoundary?.(index, event)
      },
      onStart:
        index === 0
          ? () => {
              if (cancelled) return
              opts.onLine0Start?.()
            }
          : undefined,
    })

    speakPromise
      .then(() => {
        if (cancelled) return
        opts.onLineEnd?.(index)
        if (index === HEART_REVEAL_AFTER_LINE_INDEX) {
          opts.onHeartReady?.()
        }
        if (index === GREET_LINES.length - 1) {
          opts.onComplete?.()
          return
        }
        pendingHandle = schedule(() => {
          pendingHandle = null
          speakLine(index + 1)
        }, LINE_GAP_MS)
      })
      .catch(() => {
        // Cancellation or engine error — bail. We do NOT advance.
      })
  }

  return {
    start(): void {
      if (started || cancelled) return
      started = true
      speakLine(0)
    },
    cancel(): void {
      if (cancelled) return
      cancelled = true
      stopPending()
    },
  }
}

/**
 * Re-prompt: speak GREET_LINES[REPROMPT_LINE_INDEX] once. Returns a handle so
 * the caller can cancel if Marian taps mid-prompt.
 */
export function speakReprompt(opts: {
  speak: SpeakFn
  onBoundary?: (event: BoundaryEvent) => void
  boundaryWPM?: number
}): Promise<void> {
  return opts
    .speak(GREET_LINES[REPROMPT_LINE_INDEX], {
      boundaryWPM: opts.boundaryWPM,
      onBoundary: opts.onBoundary,
    })
    .catch(() => {
      // Engine cancelled or errored — same swallow policy as the main run.
    })
}
