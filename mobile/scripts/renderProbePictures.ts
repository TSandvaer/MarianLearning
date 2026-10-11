/**
 * Prints `{ <key>: <svg markup> }` for the four novel-probe pictures, as
 * the web draws them (`src/screens/WordSong/wordPictures.tsx`, inline SVG
 * placeholders). `export-assets.mjs` runs it through the root `tsx` and
 * bakes each one to a 500 px WebP (design/native/word-song-native.md § 7).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NOVEL_PROBE_WORDS } from '../../packages/core/src/wordSong/novelProbeWords'
import { WordPicture } from '../../src/screens/WordSong/wordPictures'

const out: Record<string, string> = {}
for (const key of NOVEL_PROBE_WORDS) {
  out[key] = renderToStaticMarkup(
    createElement(WordPicture, { pictureKey: key }),
  )
}
process.stdout.write(JSON.stringify(out))
