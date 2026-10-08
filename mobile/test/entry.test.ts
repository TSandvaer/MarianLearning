/**
 * The storage must be installed before anything reads it: `index.ts`
 * imports the platform boot first, and `App` (which reads storage on its
 * first render) only after it. Same pin as the web's
 * `src/platform/web.test.ts` on `App.tsx`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

it('index.ts imports ./src/platform/boot first', () => {
  const entry = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
  const imports = entry.match(/^import\b.*$/gm) ?? []
  expect(imports[0]).toBe("import './src/platform/boot'")
  expect(imports.findIndex((line) => line.includes('./src/App'))).toBe(
    imports.length - 1,
  )
})

it('package.json points Expo at index.ts', () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { main?: string }
  expect(pkg.main).toBe('index.ts')
})
