#!/usr/bin/env tsx
/**
 * Canon-bake validation lint.
 *
 * Ticket 86c9qhr9k.
 *
 * What
 * ----
 * Scans every utterance `text` field in a baked SessionStartResponse (or
 * a directory of canon JSON files on disk) and reports characters /
 * tokens that don't render cleanly as Azure TTS input.
 *
 * Three failure-mode classes (all surfaced from PR #192's ear-test
 * iterations on 2026-05-10):
 *
 *   1. **non-ASCII codepoints** — em-dash (`—`), en-dash (`–`),
 *      curly quotes (`"` `"`), unicode IPA chars (`ɪ`, `ɛ`, `ʌ`, ...).
 *      Two reasons to reject:
 *      - The bake-pipeline encoding bug (separate ticket 86c9qhr91)
 *        silently mojibake's some unicode punctuation: em-dash UTF-8
 *        bytes `E2 80 94` round-tripped through PR #192's bake as
 *        `â€"` (UTF-8 → CP1252 → UTF-8 double-encoding signature).
 *        Azure faithfully vocalizes `â€"` as letters → "asesinati"-
 *        shaped gibberish.
 *      - Even when the bake pipeline preserves the codepoint, Azure
 *        renders unfamiliar unicode as the character name (or skips
 *        silently). `/ʌ/` reads as "slash UH slash".
 *
 *   2. **slash-IPA notation** — `/p/-/ɪ/-/g/`, `/s/ /ʌ/ /n/`. The
 *      author intended phonetic-breakdown notation; canon stores plain
 *      text, so Azure says "slash p slash dash slash IH slash dash
 *      slash g slash". Rule pattern catches `/letter+/` shapes.
 *
 *   3. **angle-bracket SSML-like notation** — `<phoneme...>`,
 *      `<break/>`, HTML-entity-shaped tokens. Canon `text` is sent
 *      escaped through `escapeSsml`, so any `<...>` substring would
 *      end up vocalized as "less-than..." (or just garbled). SSML
 *      injection is a separate seam (`PHONEME_OVERRIDES` in `_tts.ts`),
 *      not raw inline markup.
 *
 * Surfaces
 * --------
 *   - **Bake-time gate**: `lintCanonResponse(response)` is called from
 *     `generateSessionCanon.ts::bakeOne` after each successful render.
 *     A violation throws `CanonLintError`, fails the bake, and prevents
 *     the corrupt JSON from reaching disk. Behind `--lint-warn` the
 *     bake script downgrades to warn-only (use during prompt-iteration
 *     dev cycles only).
 *
 *   - **CI gate**: `npm run canon:lint` (this script's CLI mode) walks
 *     every committed `public/canon/**\/*.json` and exits non-zero on
 *     any violation. Wired into `.github/workflows/e2e.yml` so PR pushes
 *     surface canon corruption before e2e even starts (~2-second job).
 *
 *   - **Audit mode**: `--report` prints every violation with file path,
 *     utterance id, the offending text, and the codepoint table. Use
 *     for triaging existing corruption when prompts change.
 *
 * What it does NOT do
 * -------------------
 *   - Render audio. Lint operates on `text` only — base64 audio is
 *     opaque. (A separate audit could detect silent / corrupt MP3s by
 *     decoding length, but that's out of scope here.)
 *   - Allow-list legitimate unicode. Per ticket scope: ASCII-7 only.
 *     Future allow-list opt-in if a real need surfaces.
 *   - Re-bake corrupt entries. The lint REPORTS; cleanup is a separate
 *     ticket once the audit is reviewed.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { SessionStartResponse, Utterance } from '../api/_types.js'
import { isSessionStartResponse } from '../api/_types.js'

// ── rule kinds + error type ──────────────────────────────────────────────

export type LintRule = 'non-ascii' | 'slash-ipa' | 'angle-tag'

/**
 * One detected violation against a single utterance.
 *
 * Multiple rules can fire on the same text — e.g. `/ʌ/` triggers BOTH
 * `non-ascii` (the IPA char) AND `slash-ipa` (the bracket notation). We
 * surface them as separate `LintViolation` entries so a fix-then-recheck
 * loop sees full coverage on each pass.
 */
export interface LintViolation {
  rule: LintRule
  /** Stable utterance id (e.g. `math.p1.read`, `session.end.opener`). */
  utteranceId: string
  /** The full offending text — verbatim, for the human triaging. */
  text: string
  /** A short evidence snippet: the matched substring + a few chars context. */
  match: string
  /** For `non-ascii`, list of unique non-ASCII codepoints found.
   *  Empty for the other rules (the regex match IS the evidence). */
  nonAsciiCodepoints?: string[]
}

export class CanonLintError extends Error {
  readonly violations: readonly LintViolation[]
  constructor(violations: readonly LintViolation[]) {
    super(
      `Canon lint failed: ${violations.length} violation(s). First: ` +
        `[${violations[0]!.rule}] ${violations[0]!.utteranceId} — ` +
        `${JSON.stringify(violations[0]!.text)}`,
    )
    this.name = 'CanonLintError'
    this.violations = violations
  }
}

// ── rule patterns ────────────────────────────────────────────────────────
//
// Each rule is a single regex tested against the utterance text. Anchor-
// less regex on purpose — `RegExp.prototype.test` is the cheap path; we
// only fall through to `match()` when we already know the rule fires
// (for the `match` snippet and codepoint table).
//
// Rule 1 — non-ASCII: any codepoint > 127. Exhaustive by construction;
// catches em-dash (U+2014), en-dash (U+2013), curly quotes (U+2018-U+201D),
// unicode IPA (U+0250–U+02AF), mojibake byte sequences (â€" lives in
// U+00C2 / U+0080), and any future surprise.
const RE_NON_ASCII = /[^\x00-\x7F]/

// Rule 2 — slash-IPA: forward-slash-letter+-forward-slash. Letter set is
// ASCII a–z plus the IPA phoneme symbols actually observed in PR #192's
// failure modes (`/p/-/ɪ/-/g/`, `/s/ /ʌ/ /n/`). Note the IPA chars in
// this set are themselves non-ASCII — they ALSO trip rule 1. That's
// intentional: rule 2 surfaces the SHAPE of the corruption (so the fix
// is "drop the slash notation" not "find a different IPA char"); rule 1
// surfaces the codepoint inventory.
//
// Pattern is bounded to two letters minimum to avoid matching common
// English with embedded slashes (e.g. dates `1/2/2026` — note: dates
// aren't valid English-words anyway, but a single-letter token like
// `a/b` would false-fire on a one-letter slash).
//
// Includes the most common IPA phonemes:
//   - vowels: ɪ ɛ ə æ ʌ ɔ ʊ ʃ
//   - length: ː
//   - other: θ ð ŋ ʒ ɡ ɚ
const RE_SLASH_IPA = /\/[a-zA-Zɪɛəæʌɔʊʃθðŋʒɡɚː]+\//

// Rule 3 — angle-bracket: any `<...>` substring. Bounded to non-`<>` interior
// to avoid catching things like "less than 5 < x > 0" (which itself isn't
// English anyway — but the bound makes the rule's intent precise: tag-shaped
// markup, not arithmetic). False positives on prose like "<unrealistic>"
// would still fire — that's fine; canon text shouldn't carry those either.
const RE_ANGLE = /<[^<>]*>/

// ── core API ─────────────────────────────────────────────────────────────

/**
 * Lint a single utterance's text. Pure function — no I/O.
 *
 * Returns one `LintViolation` per rule that fires (so a single text can
 * produce up to three entries). Returns an empty array for clean text.
 */
export function lintUtteranceText(
  utteranceId: string,
  text: string,
): LintViolation[] {
  const violations: LintViolation[] = []

  if (RE_NON_ASCII.test(text)) {
    const codepoints = collectNonAsciiCodepoints(text)
    const match = firstMatchSnippet(text, RE_NON_ASCII, 12)
    violations.push({
      rule: 'non-ascii',
      utteranceId,
      text,
      match,
      nonAsciiCodepoints: codepoints,
    })
  }

  if (RE_SLASH_IPA.test(text)) {
    const match = firstMatchSnippet(text, RE_SLASH_IPA, 12)
    violations.push({
      rule: 'slash-ipa',
      utteranceId,
      text,
      match,
    })
  }

  if (RE_ANGLE.test(text)) {
    const match = firstMatchSnippet(text, RE_ANGLE, 12)
    violations.push({
      rule: 'angle-tag',
      utteranceId,
      text,
      match,
    })
  }

  return violations
}

/**
 * Lint every utterance in a baked SessionStartResponse. Returns ALL
 * violations across every utterance — does not stop at the first
 * failure (so the bake author sees the full picture in one pass).
 */
export function lintCanonResponse(
  response: Pick<SessionStartResponse, 'utterances'>,
): LintViolation[] {
  const out: LintViolation[] = []
  for (const u of response.utterances) {
    if (!isUtteranceWithText(u)) continue
    out.push(...lintUtteranceText(u.id, u.text))
  }
  return out
}

/**
 * Lint helper that throws CanonLintError if there are any violations.
 * Intended for the bake-time integration point — the throw aborts the
 * bake and stops the corrupt JSON from reaching disk.
 */
export function assertCanonResponseClean(
  response: Pick<SessionStartResponse, 'utterances'>,
): void {
  const violations = lintCanonResponse(response)
  if (violations.length > 0) {
    throw new CanonLintError(violations)
  }
}

// ── disk walker (CI mode) ────────────────────────────────────────────────

export interface CanonFileFinding {
  /** Repo-relative posix-shaped path for log readability. */
  filePath: string
  violations: LintViolation[]
}

/**
 * Baseline entry — one previously-known violation that's accepted as
 * "ship-it for now" and explicitly tracked for cleanup elsewhere. Any
 * violation matching all three fields (filePath + utteranceId + rule)
 * is reclassified from `findings` to `baselineFindings` and does NOT
 * cause CLI exit 1.
 */
export interface BaselineEntry {
  filePath: string
  utteranceId: string
  rule: LintRule
}

export interface RunLintResult {
  filesScanned: number
  /** Count of violations that are NOT in the baseline. CI fails on > 0. */
  totalViolations: number
  /** Count of violations that ARE in the baseline. Reported but tolerated. */
  baselineViolations: number
  /** Per-file groupings of NEW (non-baseline) violations. */
  findings: CanonFileFinding[]
  /** Per-file groupings of baseline-accepted violations. */
  baselineFindings: CanonFileFinding[]
  /** Files that couldn't be parsed (reported separately from rule
   *  violations — a malformed canon JSON is its own kind of failure). */
  unparseable: { filePath: string; reason: string }[]
}

function violationMatchesBaseline(
  filePath: string,
  v: LintViolation,
  baseline: readonly BaselineEntry[],
): boolean {
  for (const b of baseline) {
    if (
      b.filePath === filePath &&
      b.utteranceId === v.utteranceId &&
      b.rule === v.rule
    ) {
      return true
    }
  }
  return false
}

/**
 * Walk a canon root directory, parse every `*.json` under it, and lint
 * each one. Returns the aggregate result without throwing — the CLI
 * driver decides whether to exit non-zero based on the result.
 *
 * Baseline behaviour: violations in `baseline` are reclassified to
 * `baselineFindings` and excluded from `totalViolations`. CI fails on
 * `totalViolations > 0` but tolerates baseline-tracked corruption — the
 * compromise that lets us land the lint without first re-baking historical
 * canons (separate cleanup ticket per ticket 86c9qhr9k OOS rules).
 */
export function runCanonLint(
  canonRoot: string,
  baseline: readonly BaselineEntry[] = [],
): RunLintResult {
  const result: RunLintResult = {
    filesScanned: 0,
    totalViolations: 0,
    baselineViolations: 0,
    findings: [],
    baselineFindings: [],
    unparseable: [],
  }

  if (!existsSync(canonRoot)) {
    return result
  }

  const files = collectJsonFiles(canonRoot)
  for (const absPath of files) {
    result.filesScanned++
    const filePath = toPosixRelative(canonRoot, absPath)

    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(absPath, 'utf8'))
    } catch (err) {
      result.unparseable.push({
        filePath,
        reason: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    if (!isSessionStartResponse(parsed)) {
      result.unparseable.push({
        filePath,
        reason: 'not a SessionStartResponse',
      })
      continue
    }

    const violations = lintCanonResponse(parsed)
    if (violations.length === 0) continue

    // Partition into new vs baseline.
    const newViolations: LintViolation[] = []
    const baselineMatches: LintViolation[] = []
    for (const v of violations) {
      if (violationMatchesBaseline(filePath, v, baseline)) {
        baselineMatches.push(v)
      } else {
        newViolations.push(v)
      }
    }
    if (newViolations.length > 0) {
      result.findings.push({ filePath, violations: newViolations })
      result.totalViolations += newViolations.length
    }
    if (baselineMatches.length > 0) {
      result.baselineFindings.push({
        filePath,
        violations: baselineMatches,
      })
      result.baselineViolations += baselineMatches.length
    }
  }

  return result
}

/**
 * Load a baseline JSON file. Returns an empty list if the file is
 * missing or empty (no baseline = CI fails on any violation, as you'd
 * expect on a clean repo).
 */
export function loadBaseline(path: string): BaselineEntry[] {
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!Array.isArray(raw)) return []
    const out: BaselineEntry[] = []
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as BaselineEntry).filePath === 'string' &&
        typeof (item as BaselineEntry).utteranceId === 'string' &&
        typeof (item as BaselineEntry).rule === 'string'
      ) {
        out.push(item as BaselineEntry)
      }
    }
    return out
  } catch {
    return []
  }
}

/**
 * Format a `RunLintResult` as a human-readable report. Used by the CLI
 * and by anyone wanting to surface findings in a PR comment.
 */
export function formatLintReport(result: RunLintResult): string {
  const lines: string[] = []
  lines.push('Canon lint report')
  lines.push('=================')
  lines.push(`files scanned:       ${result.filesScanned}`)
  lines.push(`new violations:      ${result.totalViolations}`)
  lines.push(`baseline violations: ${result.baselineViolations}`)
  lines.push(`unparseable:         ${result.unparseable.length}`)
  lines.push('')

  if (result.unparseable.length > 0) {
    lines.push('Unparseable files:')
    for (const u of result.unparseable) {
      lines.push(`  - ${u.filePath}: ${u.reason}`)
    }
    lines.push('')
  }

  if (result.findings.length > 0) {
    lines.push('NEW violations (CI gate — must fix):')
    for (const f of result.findings) {
      lines.push(`[${f.filePath}]`)
      for (const v of f.violations) {
        lines.push(`  ${formatViolationLine(v)}`)
        lines.push(`    text: ${JSON.stringify(v.text)}`)
      }
    }
    lines.push('')
  }

  if (result.baselineFindings.length > 0) {
    lines.push(
      'Baseline-tolerated violations (tracked in scripts/canon-lint-baseline.json — cleanup is a separate ticket):',
    )
    for (const f of result.baselineFindings) {
      lines.push(`[${f.filePath}]`)
      for (const v of f.violations) {
        lines.push(`  ${formatViolationLine(v)}`)
        lines.push(`    text: ${JSON.stringify(v.text)}`)
      }
    }
    lines.push('')
  }

  if (
    result.findings.length === 0 &&
    result.baselineFindings.length === 0 &&
    result.unparseable.length === 0
  ) {
    lines.push('No rule violations.')
  }

  return lines.join('\n')
}

function formatViolationLine(v: LintViolation): string {
  const cps = v.nonAsciiCodepoints?.length
    ? ` (codepoints: ${v.nonAsciiCodepoints.join(', ')})`
    : ''
  return `- ${v.rule}  id=${v.utteranceId}  match=${JSON.stringify(v.match)}${cps}`
}

// ── helpers ──────────────────────────────────────────────────────────────

function isUtteranceWithText(value: unknown): value is Utterance {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.text === 'string'
}

function collectNonAsciiCodepoints(text: string): string[] {
  const seen = new Set<string>()
  for (const c of text) {
    const cp = c.codePointAt(0)
    if (cp !== undefined && cp > 127) {
      const hex = cp.toString(16).toUpperCase().padStart(4, '0')
      seen.add(`${c} (U+${hex})`)
    }
  }
  return Array.from(seen)
}

function firstMatchSnippet(text: string, re: RegExp, context: number): string {
  const m = re.exec(text)
  if (!m) return ''
  const start = Math.max(0, m.index - context)
  const end = Math.min(text.length, m.index + m[0].length + context)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet = snippet + '…'
  // The leading/trailing ellipsis here is itself non-ASCII — but the
  // snippet is for log/report display, not for re-running the lint
  // against. (The lint scans `text`, not `match`.)
  return snippet
}

function collectJsonFiles(root: string): string[] {
  const out: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(abs)
      } else if (entry.isFile() && abs.endsWith('.json')) {
        out.push(abs)
      }
    }
  }
  // Stable order for reproducible reports.
  out.sort()
  return out
}

function toPosixRelative(root: string, abs: string): string {
  const rel = relative(dirname(root), abs)
  return rel.split(sep).join('/')
}

// ── CLI entry ────────────────────────────────────────────────────────────

interface CliArgs {
  root: string
  baselinePath: string
  report: boolean
  /** Strict mode: ignore the baseline entirely; any violation fails. Use
   *  on cleanup PRs that drain the baseline. */
  strict: boolean
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  // Default root: <repo>/public/canon, mirroring the bake-script default.
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = join(here, '..')
  const args: CliArgs = {
    root: join(repoRoot, 'public', 'canon'),
    baselinePath: join(here, 'canon-lint-baseline.json'),
    report: false,
    strict: false,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && typeof argv[i + 1] === 'string') {
      args.root = argv[i + 1]!
      i++
    } else if (argv[i] === '--baseline' && typeof argv[i + 1] === 'string') {
      args.baselinePath = argv[i + 1]!
      i++
    } else if (argv[i] === '--report') {
      args.report = true
    } else if (argv[i] === '--strict') {
      args.strict = true
    }
  }
  return args
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2))
  const baseline = args.strict ? [] : loadBaseline(args.baselinePath)
  const result = runCanonLint(args.root, baseline)

  // CI gate: ANY new (non-baseline) violation OR unparseable file fails.
  // Baseline-tolerated violations still print but don't fail the build.
  const hasFailures =
    result.totalViolations > 0 || result.unparseable.length > 0

  // Always print the summary; print the full report when --report is set
  // OR when there are any findings (new OR baseline) so CI logs surface
  // both classes without requiring the flag.
  const hasAnyFinding =
    result.findings.length > 0 ||
    result.baselineFindings.length > 0 ||
    result.unparseable.length > 0

  if (args.report || hasAnyFinding) {
    console.log(formatLintReport(result))
  } else {
    console.log(`canon lint clean: ${result.filesScanned} files, 0 violations.`)
  }

  process.exit(hasFailures ? 1 : 0)
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  main()
}
