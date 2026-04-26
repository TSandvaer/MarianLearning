/**
 * End-to-end Path A integration test stub for the Math screen.
 *
 * Why this is a stub
 * ------------------
 * Ticket 86c9gumhp item #5 asks for an end-to-end contract for AC rows
 * 10/11/12 of qa/math-screen.md:
 *   - Row 10: per-problem read-aloud plays on screen entry; caption ribbon
 *     mirrors TTS word-by-word via `onWordTick`.
 *   - Row 11: first chip-tap unlocks the audio context via the 1.5s gate.
 *   - Row 12: first session utterance is audible after wake-tap on
 *     installed iPad PWA.
 *
 * Rows 10 + 11 are already covered at the unit / contract level by
 * `src/lib/audio/mathPathA.test.ts` (15 tests covering the 5 error codes +
 * the silent-default fallback) and `src/screens/Math/Math.test.tsx`
 * (caption tick contract via `makePlayHarness`). The spec layer this stub
 * is meant to lock down is the App-level wiring — `App.tsx`'s `useEffect`
 * keyed on `route === 'math'` calling `prepareMathPathA(plan, plan.id)`,
 * passing the resulting `playUtterance` to `<Math>`, and unloading on
 * unmount.
 *
 * Row 12 is iPad-only by design — jsdom can't reproduce iOS Safari's
 * "no audio without a real gesture" gating, so a unit test there would
 * always pass against a fake gate that doesn't model real hardware. That
 * row stays Thomas's territory; we don't simulate it.
 *
 * What this file currently asserts
 * --------------------------------
 * Nothing executable — the cases are `it.todo` placeholders so the
 * contract surface is visible in the test file even before the test
 * bodies land. Each todo names the exact behaviour to assert and links
 * to the QA matrix row it covers.
 *
 * When does this become real?
 * ---------------------------
 * - Row 10 / 11 App-level wiring stub: when we have a clean way to mount
 *   App.tsx in jsdom with `fetch` mocked to return a synthetic
 *   `SessionStartResponse`. That would require a fake `Howler` constructor
 *   (we already stub `createSfx`; the howl-loading path uses a different
 *   constructor) and a stable `mathPlay` injection. Sized at ~30 minutes
 *   when the harness is in place; the contract-level assertions below
 *   already cover the unit surface.
 * - Row 12: stays iPad-only forever. Thomas's pass on the installed PWA
 *   is the binding test; we do not stub it.
 *
 * Why a separate file
 * -------------------
 * `mathPathA.test.ts` is the unit-level coverage of the adapter itself
 * (request shape, response handling, error codes). This file is the
 * place to lock the App→Math wiring contract so a future "let me move
 * the wiring out of App.tsx" refactor has a visible regression target.
 * Keeping the two files separate also keeps the unit-test feedback loop
 * fast — this stub will eventually pull in App.tsx's full module graph,
 * which is heavier than the adapter unit test.
 */

import { describe, it } from 'vitest'

describe.todo(
  'Math screen Path A end-to-end integration (stub — ticket 86c9gumhp item #5)',
  () => {
    it.todo(
      'AC row 10: route === "math" triggers prepareMathPathA(plan, plan.id) and the returned playUtterance reaches <Math> as a prop',
    )

    it.todo(
      'AC row 10: caption ribbon ticks word-by-word in render via onWordTick on the live Path A playUtterance (not just the silent default)',
    )

    it.todo(
      'AC row 10: a tts-failed response leaves Math with no playUtterance prop (falls back to silent-but-captioned default; no error chime, no nag copy)',
    )

    it.todo(
      'AC row 11: first chip-tap routes through useAudioUnlockGate.wrapSpeak, then audioUnlocked=true short-circuits subsequent taps',
    )

    it.todo(
      'AC row 11: AbortController fires on route-leave and unloadSessionAudio releases howls on Math unmount',
    )

    // Row 12 (first utterance audible after wake-tap on installed iPad PWA)
    // is intentionally NOT included as a todo — it's iPad-only and stays
    // Thomas's verdict per the design rationale in this file's header.
  },
)
