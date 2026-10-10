import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as vectors from './vectors'
import { VECTOR_SOURCES } from './vectors'

const webAssets = resolve(__dirname, '..', '..', '..', 'public', 'assets')

/** The same normalisation the copies were made with. */
function stripped(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n')
}

describe('inline vector copies of the web SVGs', () => {
  it.each(Object.entries(VECTOR_SOURCES))(
    '%s matches public/assets/%s',
    (name, file) => {
      const web = readFileSync(resolve(webAssets, file), 'utf8')
      const copy = (vectors as Record<string, unknown>)[name]
      expect(copy).toBe(stripped(web))
    },
  )
})
