/**
 * CVC phoneme-blend prompt — letter-highlight token mapping (ticket
 * 86c9qa6n3). Pure module: no React, no I/O, no side effects.
 *
 * Why this lives here (not inline in WordSong.tsx)
 * ------------------------------------------------
 * The mapping is a pure function worth unit-testing in isolation, and
 * WordSong.tsx is a `react-refresh/only-export-components` file (it may only
 * export the component). Extracting the helper keeps it testable without
 * tripping the lint rule — same pattern as `wordDistractors.ts` /
 * `planFromServer.ts` sitting alongside the screen.
 *
 * What it does
 * ------------
 * The `blend` utterance ("c - a - t ... cat") drives a per-letter highlight
 * off its own `onWordTick` events. But the caption tokenizer (`speak` does
 * `text.split(/\s+/)`) does NOT collapse the segmentation separators — the
 * raw token stream for the ASCII-7 stored form is
 * `["c","-","a","-","t","...","cat"]` (the `-` / `...` are their own tokens).
 * So a naive "tick index === letter index" mapping would be off.
 *
 * `buildBlendHighlightSteps` returns, per raw token index, the
 * `blendActiveLetterIndex` to set at that tick (or `undefined` to leave the
 * highlight unchanged — separator tokens). The grapheme tokens map to letter
 * positions `0..wordLength-1`; the trailing whole-word token maps to
 * `wordLength` (the "all letters pulse" whole-word beat).
 *
 * Tokenizer-robust: it does NOT assume the separators collapse, and it
 * accepts BOTH the lint-clean ASCII form (`-` / `...`) and Kyle's spec
 * em-dash / ellipsis form (`—` / `…`) defensively.
 */

/** A raw blend token that is a SEGMENTATION SEPARATOR, not a grapheme/word.
 *  Matches ASCII hyphen run (`-`, `--`), ASCII ellipsis (`..`, `...`), or the
 *  unicode em-dash / ellipsis (Kyle's spec form). */
const BLEND_SEPARATOR = /^(?:-+|\.{2,}|—|…)$/

/**
 * Map each whitespace-token index of a `blend` utterance to the
 * `blendActiveLetterIndex` it should produce, or `undefined` for a separator
 * token (no highlight change).
 *
 * @param blendText the stored blend utterance text, e.g. `"c - a - t ... cat"`.
 * @param word the target word, e.g. `"cat"` (`"box"` for the `/ks/` case).
 *   Its `length` is the whole-word beat index AND the per-letter clamp.
 * @returns an array indexed by raw `\s+`-token index; each entry is the
 *   `blendActiveLetterIndex` to set at that tick, or `undefined` to skip.
 */
export function buildBlendHighlightSteps(
  blendText: string,
  word: string,
): (number | undefined)[] {
  const rawTokens = blendText.split(/\s+/).filter(Boolean)
  // Content (non-separator) tokens in order: the leading ones are graphemes,
  // the LAST is the whole word.
  const contentIndices: number[] = []
  rawTokens.forEach((tok, i) => {
    if (!BLEND_SEPARATOR.test(tok)) contentIndices.push(i)
  })

  const steps: (number | undefined)[] = rawTokens.map(() => undefined)
  const wholeWordBeat = word.length
  contentIndices.forEach((rawIdx, contentPos) => {
    const isWholeWord = contentPos === contentIndices.length - 1
    // The final content token → whole-word beat (all letters pulse). Earlier
    // content tokens → their positional letter index, clamped to the
    // available letters (defensive against a grapheme-count mismatch, e.g. a
    // `/ks/` blend whose grapheme tokens number word.length, not more).
    steps[rawIdx] = isWholeWord
      ? wholeWordBeat
      : Math.min(contentPos, Math.max(0, wholeWordBeat - 1))
  })
  return steps
}
