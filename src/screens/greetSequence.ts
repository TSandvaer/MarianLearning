/**
 * Greet (Screen 2) TTS sequence orchestrator.
 *
 * Spec: design/session-1.md §"Screen 2 — First Greeting (Meet Melody)" — see
 * (the session-1 spec heading still uses the legacy "Meet Melody" phrasing;
 * the Phase 3a + 3b character pivot to Emma updates the in-app copy/audio,
 * but the session-1 spec heading is retained for historical traceability.)
 *
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
 *  - If a `speak()` call rejects, we stop the sequence and call `onLineError`
 *    (when provided) with the failed line index and the underlying error.
 *    We do NOT auto-retry — the caller decides what to do (relock the gate,
 *    skip and advance, surface UI, etc.). Pre-86c9gr43t we silently swallowed
 *    the rejection, which produced the GBUG-7 silent-halt: an orchestrator-
 *    layer change ago, the catch ate the error and the heart never appeared.
 *    Now the caller gets the signal and can drive the recovery story.
 */

/**
 * Word-boundary event the orchestrator surfaces to the screen. Drives
 * Greet's caption-reveal animation and the "Hi!" ear-wiggle.
 *
 * Provenance: the shape was originally defined in `lib/tts/boundary.ts`
 * for the Web Speech API path, where it carried real `SpeechSynthesisUtterance`
 * boundary metadata (charIndex was meaningful, word came from native
 * onboundary). When the audio pipeline pivoted to Path A — pre-rendered
 * MP3s through Howler (`lib/audio/preRecorded`) — the engine started
 * emitting only `onWordTick(wordIndex)`, and Greet's playLineAdapter
 * synthesises the full event from `text.split(/\s+/)`. The `charIndex`
 * field is now always 0 under Path A; it stays in the shape so any
 * future caller wanting native byte offsets has a stable contract to
 * extend.
 *
 * Relocated from `lib/tts` (ticket 86c9h3c57) so this module no longer
 * depends on the dead Web Speech tree — that's a precursor to deleting
 * `src/lib/tts/` outright (86c9grn3n).
 */
export interface BoundaryEvent {
  /** Zero-based word index within the current line. */
  wordIndex: number
  /** The actual word string (with attached punctuation). */
  word: string
  /** Character offset of the word's first character. Always 0 under Path A. */
  charIndex: number
}

/**
 * The four lines Emma says on Screen 2. Single source of truth — both the
 * speech engine and the caption ribbon read from this array, so there is no
 * drift between what's spoken and what's shown (AC: "no text shown that
 * Emma doesn't also say").
 *
 * Phase 3a (ticket 86c9hjnq1, 2026-04-28): the second line was renamed from
 * "I'm Melody." to "I'm Emma." as part of the character pivot away from
 * Sanrio IP. Both the spoken audio (re-rendered with the Emma multilingual
 * voice) and the caption ribbon now say "Emma".
 *
 * Phase 3b (ticket 86c9jccp7, 2026-04-29): the corresponding
 * `GreetLineKey` is now `'imEmma'` and the MP3 filename is
 * `greet-02-im-emma.mp3`. The Phase-3a text/key mismatch is resolved.
 */
export const GREET_LINES = [
  'Hi!',
  "I'm Emma.",
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
   * Fires when the audio engine actually starts. Used by Greet to clear
   * the audio-unlock-gate watchdog.
   */
  onStart?: () => void
}

/**
 * Subset of the audio `speak` contract we depend on. Declared locally so
 * tests can inject a fake without depending on browser audio APIs.
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
  /**
   * Called when a `speak()` rejects (Howler `loaderror`, `playerror`, or any
   * other terminal failure). The sequence is halted — no further lines are
   * queued. The caller decides recovery (relock the gate, skip + advance,
   * etc.); the orchestrator deliberately stays opinion-free.
   *
   * Provenance: ticket 86c9gr43t (GBUG-7). Before this hook existed, the
   * `.catch` swallowed the rejection silently and the heart never appeared
   * on a Howler load failure. Now the caller (Greet) maps the signal onto
   * the gate's `reportSpeechError` + `registerRetry` pair so Marian sees
   * the relock ring instead of a frozen Emma.
   *
   * `onComplete` will NOT fire when a line errors. Cancellations are still
   * silent (no rejection forwarded) — distinguished from genuine errors by
   * the orchestrator's internal `cancelled` flag.
   */
  onLineError?: (index: number, err: Error) => void
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
   * Kick off the sequence at `fromIndex` (defaults to 0). MUST be called
   * synchronously inside a user gesture handler on iPad Safari — see the
   * audio-unlock note in design/session-1.md → Implementation notes.
   * Calling `start()` more than once is a no-op (the orchestrator already
   * running its sequence).
   *
   * Refactored 2026-04-25 (ticket 86c9gp99a): previously the sequence
   * auto-started inside `runGreetSequence`. The auto-start was incompatible
   * with iPad Safari's per-execution-context gesture gate — the very first
   * `speak()` was being silently rejected because it ran in the screen
   * mount's effect tick rather than inside the tap handler. The Greet
   * component now constructs the handle on mount and invokes `start()`
   * inside its synchronous Wake-tap handler.
   *
   * `fromIndex` (added in ticket 86c9gr43t): supports the relock-and-retry
   * path. When a mid-sequence MP3 fails, Greet builds a fresh sequence and
   * calls `start(failedIndex)` so Marian retries the failed line rather
   * than re-hearing every earlier line. Out-of-range indices (`< 0` or
   * `>= GREET_LINES.length`) are treated as 0 and length-1 respectively;
   * the orchestrator never throws on a bad seed. Anything non-finite
   * (NaN, ±Infinity, or non-numeric junk passed via a typed-any cast)
   * collapses to 0 — same "never crash the gesture handler" rule.
   */
  start: (fromIndex?: number) => void
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
      .catch((err: unknown) => {
        // Cancellations stay silent — the caller invoked cancel() on
        // purpose (unmount, heart-tap mid-line, etc.) and we don't want
        // to surface that as an error. Distinguishable from genuine
        // engine failures via the orchestrator's `cancelled` flag.
        if (cancelled) return
        // We do NOT advance the sequence — but we DO surface the error
        // so the caller can route it (typically: gate.reportSpeechError
        // + registerRetry to give Marian a tappable ring instead of a
        // silent halt). Pre-86c9gr43t this catch was an empty body and
        // the screen got stuck.
        const error =
          err instanceof Error ? err : new Error(String(err ?? 'unknown'))
        opts.onLineError?.(index, error)
      })
  }

  return {
    start(fromIndex = 0): void {
      if (started || cancelled) return
      started = true
      // Clamp to a valid line index. We deliberately don't throw on a bad
      // seed — callers might pass `failedIndex` from an unrelated context
      // and a hard error in the gesture handler would be worse than a
      // graceful no-op restart at line 0 (or the final line).
      //
      // Number.isFinite gate (added in PR #29 round-2 review): without it,
      // Math.min(NaN, n) returns NaN, which then slips past speakLine's
      // `index >= GREET_LINES.length` guard (NaN >= n is always false) and
      // calls opts.speak(GREET_LINES[NaN]) — i.e. speak(undefined). The
      // production playLineAdapter throws on undefined text, which would
      // re-introduce the silent-halt this whole ticket was meant to kill.
      // Anything not finite (NaN, ±Infinity, non-numeric junk via a typed
      // any-cast) collapses to 0 — the safe default the JSDoc promises.
      const seed = Number.isFinite(fromIndex)
        ? Math.max(0, Math.min(fromIndex, GREET_LINES.length - 1))
        : 0
      speakLine(seed)
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
