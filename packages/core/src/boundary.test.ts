/**
 * The package boundary of `@marian/core`, enforced in CI.
 *
 * tsconfig's missing DOM lib catches browser APIs, but not an import that
 * reaches back into the web app (`src/`) or the server (`api/`): such a
 * file would type-check fine and quietly drag web or server code into the
 * React Native bundle. This test fails on any import that leaves
 * packages/core/src, and on any runtime dependency (core has none).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const CORE_SRC = resolve(process.cwd(), 'packages/core/src')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Statement-anchored, so prose and string fixtures that happen to say
 *  "from '…'" don't count: `import … from`, `export … from` (multi-line),
 *  side-effect `import '…'`, `import('…')`, `vi.mock('…')`. */
const SPECIFIERS = [
  /^\s*(?:import|export)\b[^'"=()]*?\bfrom\s*['"]([^'"\n]+)['"]/gm,
  /^\s*import\s*['"]([^'"\n]+)['"]/gm,
  /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bvi\.mock\(\s*['"]([^'"\n]+)['"]/g,
]

function specifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return SPECIFIERS.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]!))
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file)
/** Test-only Node built-ins (fixture/asset existence checks). */
const TEST_ONLY_BARE = new Set(['vitest', 'fs', 'path', 'node:fs', 'node:path'])

// This file's own comments quote the patterns, so it is not scanned.
const files = walk(CORE_SRC).filter((f) => !f.endsWith('boundary.test.ts'))

describe('@marian/core package boundary', () => {
  it('finds the core sources', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('no relative import leaves packages/core/src', () => {
    const escapes: string[] = []
    for (const file of files) {
      for (const spec of specifiers(file)) {
        if (!spec.startsWith('.')) continue
        const target = resolve(dirname(file), spec)
        if (target !== CORE_SRC && !target.startsWith(CORE_SRC + sep)) {
          escapes.push(`${relative(CORE_SRC, file)} -> ${spec}`)
        }
      }
    }
    expect(escapes).toEqual([])
  })

  it('has no runtime package dependencies (tests may use vitest + node:fs/path)', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const spec of specifiers(file)) {
        if (spec.startsWith('.')) continue
        if (isTest(file) && TEST_ONLY_BARE.has(spec)) continue
        offenders.push(`${relative(CORE_SRC, file)} -> ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
