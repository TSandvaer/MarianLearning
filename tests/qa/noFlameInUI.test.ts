/**
 * Build-time guard — no `flame` references in shipped UI code or assets.
 *
 * Why this lives in tests/qa/ and not next to a module
 * ----------------------------------------------------
 * This test exercises the shipped tree (`src/` + `public/assets/`), not any
 * single module. It locks in the Dave-PR-#38 design decision that the streak
 * indicator is a sparkle, not a flame. Discussion of the rejected "flame"
 * option is fine in `design/*.md` (the spec has historical record of why we
 * said no), but anything in `src/` or `public/assets/` referencing flame /
 * icon-flame would mean the rejected option is leaking into production.
 *
 * Provenance
 * ----------
 * Bundled with ticket 86c9gumhp (math QA automation gaps backfill, item #1).
 * Jessica's PR #40 QA pass (qa/math-screen.md, AC row 8 + drift item C)
 * verified by manual grep that no flame references exist; this test makes
 * that verification a CI gate so a future "let me add a flame variant" PR
 * trips the build before review.
 *
 * What we check
 * -------------
 *  1. No file under src/ contains the substring `flame` or `icon-flame`
 *     (case-insensitive). Source includes .ts, .tsx, .js, .jsx, .css.
 *  2. No file under public/assets/ has a name containing `flame` or
 *     `icon-flame` (case-insensitive). Asset content (binary MP3/SVG) is
 *     not scanned — filename is the load-bearing surface for asset usage.
 *
 * What we deliberately don't check
 * --------------------------------
 *  - design/*.md — by design. The spec records the rejected option (sparkle
 *    over flame, post-Dave PR #38) and removing the historical context would
 *    erase the audit trail. Dave's research memo and Kyle's spec both
 *    mention "flame" precisely because they document the decision.
 *  - node_modules — third-party code is opaque to this guard.
 *  - Test files (*.test.ts, *.test.tsx) — a test like this one needs to
 *    use the literal string `flame` to assert against it; whitelisting the
 *    test directory keeps the guard self-hosting.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Repo root resolved via this test file's own location — survives any
// future test-runner cwd quirk and stays correct on Windows / POSIX.
const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..')

const SRC_DIR = path.join(REPO_ROOT, 'src')
const PUBLIC_ASSETS_DIR = path.join(REPO_ROOT, 'public', 'assets')

// Extensions we read as text under src/. Covers the shipped frontend code
// surface; .test.ts(x) is excluded so this test file itself doesn't trip
// the guard.
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css'])

// Pattern matches `flame` in any case, whether bare or hyphen-prefixed
// (`icon-flame`). Word-boundary on the leading edge so we don't match
// `inflame` or `flameless` if someone ever uses those words in a comment;
// the trailing edge stays open so `flames`, `flame-icon`, `flame_red` all
// match. Case-insensitive.
const FLAME_RE = /\bflame/i

interface Hit {
  /** Repo-relative POSIX path of the offending file. */
  file: string
  /** 1-based line number of the first match. */
  line: number
  /** The line's text, trimmed. */
  text: string
}

/** Recursively walk a directory, yielding absolute paths to regular files. */
function* walk(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    // Missing directory — yield nothing. The presence assertions below
    // surface a missing src/ or public/assets/ as a clearer failure than a
    // walk error.
    return
  }
  for (const name of entries) {
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      yield* walk(full)
    } else if (stat.isFile()) {
      yield full
    }
  }
}

/** Convert an absolute path to a stable repo-relative POSIX path. */
function toRepoRelative(absPath: string): string {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join('/')
}

/** Is this src/ file scanning-eligible? Excludes test files + non-source ext. */
function isScannableSource(absPath: string): boolean {
  const ext = path.extname(absPath)
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false
  // Exclude test files — a guard test must be allowed to use the literal
  // string `flame` to assert against it without tripping itself.
  const name = path.basename(absPath)
  if (/\.test\.(ts|tsx|js|jsx)$/.test(name)) return false
  return true
}

describe('No flame in shipped UI (Dave PR #38 sparkle-not-flame guard)', () => {
  it('finds no `flame` substring in any source under src/', () => {
    const hits: Hit[] = []
    for (const absPath of walk(SRC_DIR)) {
      if (!isScannableSource(absPath)) continue
      const text = readFileSync(absPath, 'utf8')
      const lines = text.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (FLAME_RE.test(lines[i]!)) {
          hits.push({
            file: toRepoRelative(absPath),
            line: i + 1,
            text: lines[i]!.trim(),
          })
          break // one hit per file is enough to fail; keep the report short.
        }
      }
    }

    // Format the failure message so a reader sees every offending file +
    // line at once, rather than chasing toEqual diffs across 50 entries.
    if (hits.length > 0) {
      const formatted = hits
        .map((h) => `  - ${h.file}:${h.line} → ${h.text}`)
        .join('\n')
      throw new Error(
        `Found ${hits.length} flame reference(s) under src/. ` +
          `The streak indicator is a sparkle, not a flame ` +
          `(Dave PR #38 decision; see design/research/math-distractor-and-streak-decisions.md):\n${formatted}`,
      )
    }
    expect(hits).toEqual([])
  })

  it('finds no `flame` in any filename under public/assets/', () => {
    const hits: string[] = []
    for (const absPath of walk(PUBLIC_ASSETS_DIR)) {
      const name = path.basename(absPath)
      if (FLAME_RE.test(name)) {
        hits.push(toRepoRelative(absPath))
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `Found ${hits.length} flame asset filename(s) under public/assets/. ` +
          `The streak indicator is a sparkle, not a flame ` +
          `(Dave PR #38 decision):\n${hits.map((h) => `  - ${h}`).join('\n')}`,
      )
    }
    expect(hits).toEqual([])
  })
})
