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

/**
 * A blend line split into its graphemes and its whole word, or null when
 * the text is not a blend ("f - a - n ... fan" → `["f","a","n"]`, `"fan"`).
 * Accepts the separators `buildBlendHighlightSteps` does.
 */
function parseBlend(
  blendText: string,
): { graphemes: string[]; word: string } | null {
  const match = blendText.trim().match(/^(.+?)\s*(?:\.{3}|…)\s*([A-Za-z]+)$/)
  if (!match) return null
  const graphemes = match[1]!.split(/\s+(?:-+|—)\s+/).map((g) => g.trim())
  if (graphemes.some((g) => !/^[A-Za-z]+$/.test(g))) return null
  return { graphemes, word: match[2]! }
}

/**
 * The word a blend line ends on: "f - a - n ... fan" → `'fan'`; null when
 * the text is not a blend. Real blending's two reads don't name the word,
 * so the parser takes the target from here (`design/native/real-blending.md`
 * § 8).
 */
export function blendTargetWord(blendText: string): string | null {
  return parseBlend(blendText)?.word ?? null
}

/** Do a blend line's graphemes spell its word ("c - a - t ... hat": no)? */
export function blendSpellsItsWord(blendText: string): boolean {
  const blend = parseBlend(blendText)
  return (
    blend !== null &&
    blend.graphemes.join('').toLowerCase() === blend.word.toLowerCase()
  )
}

/**
 * The sounds of a blend line without its word, for the caption while Emma
 * says only the sounds: "f - a - n ... fan" → `'f - a - n'`. A line's
 * caption ends fully revealed, so captioning the blend line itself would
 * print the word at the cut (§ 4). A text that is not a blend is returned
 * as it is.
 */
export function blendSoundsText(blendText: string): string {
  const blend = parseBlend(blendText)
  return blend === null ? blendText : blend.graphemes.join(' - ')
}
