/**
 * Player-kind detection (ticket 86c9hjnn8 follow-up).
 *
 * Math/WordSong read this when emitting `play-utterance-dispatch` rows
 * to the audioCtxLog. Tells us whether the function reference the
 * screen is about to invoke is the real Path A player (returned by
 * `prepareMathPathA` / `prepareWordSongPathA`, tagged with
 * `__playerKind = 'real'`) or the in-screen `defaultPlayUtterance`
 * silent fallback (no tag).
 *
 * Why a tag-based check rather than reference equality
 * ----------------------------------------------------
 * Math.tsx receives `playUtterance` via prop and falls back to
 * `defaultPlayUtterance` when `undefined`. A reference-equality check
 * (`fn === defaultPlayUtterance`) means the diagnostic helper would
 * have to import each screen's local default — which would be
 * brittle (the screen could re-create the default on every render via
 * `useCallback`) and would couple the debug module to every screen's
 * private fallback. A tag attached at the Path A factory level is
 * the cleaner story: the screen reads its own prop reference and
 * asks "is this tagged as real?".
 */

/** A function reference optionally tagged with `__playerKind`. The Path A
 *  factories attach `'real'`. The in-screen silent fallback never sets
 *  the field, so an untagged value reads as `'silent-fallback'`. */
export interface PlayerKindTagged {
  __playerKind?: 'real'
}

/** Read the player kind from a function reference. The argument is the
 *  function the screen is about to invoke; the diagnostic system can
 *  emit a `play-utterance-dispatch` row with the result. Returns
 *  `'silent-fallback'` for any untagged or undefined input — the
 *  screen's `playUtterance = defaultPlayUtterance` default falls into
 *  this bucket. */
export function getPlayerKind(
  fn: ((...args: never[]) => unknown) | undefined,
): 'real' | 'silent-fallback' {
  if (!fn) return 'silent-fallback'
  const tagged = fn as PlayerKindTagged
  return tagged.__playerKind === 'real' ? 'real' : 'silent-fallback'
}
