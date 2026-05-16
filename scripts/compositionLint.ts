#!/usr/bin/env tsx
/**
 * Composition-rule-spec lint for baked canon JSON.
 *
 * Mechanically validates the 8-problem set in each canon against per-tier
 * composition rules. Sits alongside `canonLint.ts` (text-encoding hygiene)
 * as a sibling check; the two run in series at bake-time and in CI.
 *
 * Why
 * ---
 * Haiku is a generative model. Even with sharpened directive prose (inline
 * `[BAND/category]` tags, per-rule self-checks, negative anchors), the
 * planner occasionally emits a canon that violates the composition rules
 * — too many doubles, too many HARD-band generals, a missing take-from-10
 * fact in the discriminate tier. PR #244 series surfaced 2 such violations
 * in 2 bakes that Devon caught by hand review. The text-encoding lint
 * (`canonLint.ts`) was clean both times — the bytes were valid, the
 * pedagogy was off.
 *
 * The future-test gap was called out in `planner-and-canon.md` and in
 * `feedback_haiku_directive_sharpening.md` memory pattern #5: a mechanical
 * backstop for the manual verification protocol. This file is that
 * backstop.
 *
 * Scope (first pass — sub-to-10 ONLY)
 * -----------------------------------
 * Hard-coded sub-to-10 rules as a single `subToTenRules` config. Migrating
 * to a per-tier `composition-rules.json` (Approach B) is the future
 * architecture once a 2nd tier ships rules. Don't over-engineer the first
 * pass — the rule shape becomes clearer with a 2nd data point.
 *
 * Other tiers (digraphs, cvc-words-short-*, add-to-10, add-to-20) have
 * their own composition rules but are out of scope here. File follow-up
 * tickets when they need backstops.
 *
 * Rules enforced (per `design/math/sub-to-10-content.md` §1.1 + §2.3)
 * ------------------------------------------------------------------
 *   1. Pool membership — every fact must be one of the 16 (a, b) pairs.
 *   2. Category caps:
 *        doubles-halving ≤ 1
 *        subtract-self   ≤ 1
 *        subtract-zero   ≤ 1
 *        subtract-one    ≤ 1
 *        subtract-two    ≤ 1
 *        take-from-10    ≤ 2  (high-value, relaxed cap)
 *        general         ≤ 2  (HARD cap)
 *   3. Band-by-slot:
 *        P1-P3: EASY only (gentle ramp).
 *        P5-P8: HARD allowed (general only here).  HARD MUST NOT appear at P1-P4.
 *   4. Take-from-10 coverage: ≥ 1 take-from-10 fact MUST appear in P4-P8.
 *   5. No duplicates: no (a, b) pair repeats within the 8-problem set.
 *
 * Surfaces
 * --------
 *   - **Bake-time gate**: `assertCompositionClean(canonId, plan)` is called
 *     from `generateSessionCanon.ts::bakeOne` AFTER the text-encoding lint
 *     passes. A violation throws `CompositionLintError`, fails the bake
 *     for that combo, and prevents the JSON from reaching disk.
 *
 *   - **CI gate**: `npm run canon:lint:composition` walks every committed
 *     `public/canon/**\/*.json`, picks up sub-to-10, and exits non-zero
 *     on any violation. Chained into `npm run canon:lint` so a single
 *     command runs both lints.
 *
 * What it does NOT do
 * -------------------
 *   - Lint tiers other than sub-to-10. Out of scope — file backlog.
 *   - Extract rules from `_planner.ts` directive prose programmatically.
 *     The directive is for Haiku; the rules in this lint are authored
 *     separately and clearly. Drift between the two is acceptable for
 *     now (the drift-guard tests on the directive prose cover that side).
 *   - Repair violations. The lint REPORTS; cleanup is a re-bake.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { SessionStartResponse } from '../api/_types.js'
import { isSessionStartResponse } from '../api/_types.js'

// ── rule kinds + error type ──────────────────────────────────────────────

export type CompositionRule =
  | 'pool-membership'
  | 'category-cap'
  | 'band-by-slot'
  | 'take-from-10-coverage'
  | 'no-duplicates'
  | 'unparseable-problem'

/**
 * One detected violation against a single problem (or whole-session in the
 * coverage case).
 */
export interface CompositionViolation {
  rule: CompositionRule
  /** 1-indexed problem slot (P1-P8). `null` for whole-session rules
   *  (take-from-10-coverage, certain category-cap cases). */
  problemIndex: number | null
  /** Human-readable detail — what went wrong, with the offending fact. */
  message: string
  /** The fact identifier (e.g. `"10-7"`) when the rule fires against a
   *  specific fact. `null` for whole-session rules. */
  factId: string | null
}

export class CompositionLintError extends Error {
  readonly violations: readonly CompositionViolation[]
  readonly canonId: string
  constructor(canonId: string, violations: readonly CompositionViolation[]) {
    super(
      `Composition lint failed for ${canonId}: ${violations.length} ` +
        `violation(s). First: [${violations[0]!.rule}] ` +
        `${violations[0]!.message}`,
    )
    this.name = 'CompositionLintError'
    this.canonId = canonId
    this.violations = violations
  }
}

// ── number-word parser (utterance text → fact pair) ──────────────────────
//
// Canon utterance text for sub-to-10 is either:
//   "<W> take away <W>. How many are left?"    (first-session)
//   "<W> minus <W>. How many are left?"        (later)
//
// We accept both. Anything else (e.g. addition `"<W> plus <W>. How many?"`)
// is rejected by the parser — sub-to-10 must be subtraction.

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

const RE_TAKE_AWAY =
  /^\s*([a-z]+)\s+take\s+away\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i
const RE_MINUS =
  /^\s*([a-z]+)\s+minus\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i

export interface ParsedFact {
  a: number
  b: number
}

/**
 * Parse a sub-to-10 read-line into `{ a, b }`. Returns null if the text
 * doesn't match either subtraction template or if a number word is
 * unrecognised. Pure; no I/O.
 *
 * Exported for tests + future tiers that share the parser.
 */
export function parseSubToTenReadLine(text: string): ParsedFact | null {
  const m = RE_TAKE_AWAY.exec(text) ?? RE_MINUS.exec(text)
  if (!m) return null
  const a = NUMBER_WORDS[m[1]!.toLowerCase()]
  const b = NUMBER_WORDS[m[2]!.toLowerCase()]
  if (a === undefined || b === undefined) return null
  return { a, b }
}

// ── sub-to-10 rule config (hard-coded for first pass) ────────────────────
//
// Per `design/math/sub-to-10-content.md` §1.1. Each fact carries its band
// + category tag. The pool is exhaustive — the planner directive
// (`api/_planner.ts:930`) lists exactly these 16 with inline `[BAND/cat]`
// tags. If the design spec widens the pool, update BOTH the directive and
// this config (and add a drift-guard test that asserts the two stay in sync
// — separate ticket).

export type SubToTenBand = 'EASY' | 'MEDIUM' | 'HARD'

export type SubToTenCategory =
  | 'subtract-self'
  | 'subtract-zero'
  | 'doubles-halving'
  | 'subtract-one'
  | 'subtract-two'
  | 'take-from-10'
  | 'general'

export interface SubToTenPoolFact {
  /** "a-b" string id, e.g. "10-7". Stable across runs. */
  id: string
  a: number
  b: number
  band: SubToTenBand
  category: SubToTenCategory
}

export const SUB_TO_TEN_POOL: readonly SubToTenPoolFact[] = [
  // EASY band (8 facts)
  { id: '5-5', a: 5, b: 5, band: 'EASY', category: 'subtract-self' },
  { id: '8-8', a: 8, b: 8, band: 'EASY', category: 'subtract-self' },
  { id: '7-0', a: 7, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '9-0', a: 9, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '10-5', a: 10, b: 5, band: 'EASY', category: 'doubles-halving' },
  { id: '8-4', a: 8, b: 4, band: 'EASY', category: 'doubles-halving' },
  { id: '6-3', a: 6, b: 3, band: 'EASY', category: 'doubles-halving' },
  { id: '9-1', a: 9, b: 1, band: 'EASY', category: 'subtract-one' },
  // MEDIUM band (4 facts)
  { id: '10-1', a: 10, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '10-2', a: 10, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '10-3', a: 10, b: 3, band: 'MEDIUM', category: 'take-from-10' },
  { id: '10-7', a: 10, b: 7, band: 'MEDIUM', category: 'take-from-10' },
  // HARD band (4 facts)
  { id: '9-4', a: 9, b: 4, band: 'HARD', category: 'general' },
  { id: '8-3', a: 8, b: 3, band: 'HARD', category: 'general' },
  { id: '7-4', a: 7, b: 4, band: 'HARD', category: 'general' },
  { id: '9-6', a: 9, b: 6, band: 'HARD', category: 'general' },
] as const

/** Tier rule config — what the lint enforces. Hard-coded for now; will
 *  generalise to per-tier JSON once a 2nd tier needs it. */
export interface SubToTenRulesConfig {
  pool: readonly SubToTenPoolFact[]
  categoryCaps: Record<SubToTenCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<SubToTenBand, readonly number[]>
  /** Whole-session minimum count of take-from-10 facts within P4-P8. */
  takeFromTenInP4ToP8Min: number
  totalProblems: number
}

export const SUB_TO_TEN_RULES: SubToTenRulesConfig = {
  pool: SUB_TO_TEN_POOL,
  categoryCaps: {
    'subtract-self': 1,
    'subtract-zero': 1,
    'doubles-halving': 1,
    'subtract-one': 1,
    'subtract-two': 1,
    'take-from-10': 2,
    general: 2,
  },
  bandAllowedSlots: {
    EASY: [1, 2, 3, 4, 5, 6, 7, 8],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  takeFromTenInP4ToP8Min: 1,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against sub-to-10 rules ────────────

interface ProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: SubToTenPoolFact | null
}

function extractProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): ProblemRow[] {
  // `math.p<N>.read` utterances carry the problem text. Sort by N so
  // we always walk P1-P8 in order regardless of array ordering.
  const re = /^math\.p(\d+)\.read$/
  const rows: ProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseSubToTenReadLine(u.text)
    const poolMatch = parsed
      ? (SUB_TO_TEN_POOL.find((f) => f.a === parsed.a && f.b === parsed.b) ??
        null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the sub-to-10 composition rules. Returns
 * ALL violations across the 8-problem set — does not stop at the first
 * (so a bake author sees the full picture in one pass).
 *
 * Pure; no I/O.
 */
export function lintSubToTenComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTenRulesConfig = SUB_TO_TEN_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `sub-to-10 read templates ("<W> take away <W>. How many are ` +
          `left?" or "<W> minus <W>. How many are left?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}-${p.parsed.b}=` +
          `${p.parsed.a - p.parsed.b} is NOT in the 16-fact sub-to-10 ` +
          `pool. See design/math/sub-to-10-content.md §1.1.`,
        factId: `${p.parsed.a}-${p.parsed.b}`,
      })
    }
  }

  // From here on, work with rows that successfully matched the pool —
  // the band-by-slot, category-cap, take-from-10, and dedupe checks all
  // depend on the band + category metadata.
  const matched = problems.filter(
    (p): p is ProblemRow & { poolMatch: SubToTenPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedRow = ProblemRow & { poolMatch: SubToTenPoolFact }
  const categoryCounts: Record<string, MatchedRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as SubToTenCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).`,
        factId: null,
      })
    }
  }

  // ── take-from-10 coverage pass (≥ 1 in P4-P8) ──
  const takeFromTenInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'take-from-10' && p.index >= 4,
  )
  if (takeFromTenInDiscriminate.length < config.takeFromTenInP4ToP8Min) {
    violations.push({
      rule: 'take-from-10-coverage',
      problemIndex: null,
      message:
        `At least ${config.takeFromTenInP4ToP8Min} take-from-10 fact(s) ` +
        `MUST appear in P4-P8 (highest-leverage category — Marian's ` +
        `future add-to-20 make-10 mental model depends on them). ` +
        `Canon has ${takeFromTenInDiscriminate.length}.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seen = new Map<string, ProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }
  for (const [factId, rows] of seen.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicates allowed within the 8-problem set.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/sub-to-10"`) used
 * only for the error message — the lint itself doesn't care.
 */
export function assertSubToTenCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTenRulesConfig = SUB_TO_TEN_RULES,
): void {
  const violations = lintSubToTenComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── tier dispatch: which canon files get composition-linted ──────────────
//
// First-pass scope is sub-to-10 only. The function returns a (potentially
// nil) rule config for the supplied canon-file path. Hard-coded matching
// for now; future tiers slot in here.

export type TierLintBinding = {
  tier: 'sub-to-10'
  config: SubToTenRulesConfig
} | null

/**
 * Resolve a canon file path to the tier rule config that should lint it.
 * Returns null for files outside scope (digraphs, cvc-words, add-to-10,
 * etc.) — those tiers have their own composition rules but are not
 * mechanically backstopped yet.
 *
 * The match is by file basename: the path layout is
 * `<root>/<track>/level-<n>/<focusNode>.json`. We key on `focusNode`.
 */
export function resolveTierBinding(canonFilePath: string): TierLintBinding {
  // Normalise to posix-ish so we can substring-match basename without sep
  // worries.
  const norm = canonFilePath.split(sep).join('/')
  if (norm.endsWith('/math/level-1/sub-to-10.json')) {
    return { tier: 'sub-to-10', config: SUB_TO_TEN_RULES }
  }
  // Also match a bare canon file id (e.g. "sub-to-10.json") for tests
  // that hand us non-rooted paths.
  if (norm === 'sub-to-10.json' || norm.endsWith('/sub-to-10.json')) {
    return { tier: 'sub-to-10', config: SUB_TO_TEN_RULES }
  }
  return null
}

// ── disk walker (CI mode) ────────────────────────────────────────────────

export interface CompositionFileFinding {
  /** Repo-relative posix-shaped path for log readability. */
  filePath: string
  tier: 'sub-to-10'
  violations: CompositionViolation[]
}

export interface RunCompositionLintResult {
  filesScanned: number
  filesLinted: number
  filesSkipped: number
  totalViolations: number
  findings: CompositionFileFinding[]
  unparseable: { filePath: string; reason: string }[]
}

/**
 * Walk a canon root, lint every in-scope tier file (currently only
 * sub-to-10), and return the aggregate result without throwing. The CLI
 * driver decides exit code based on the result.
 */
export function runCompositionLint(
  canonRoot: string,
): RunCompositionLintResult {
  const result: RunCompositionLintResult = {
    filesScanned: 0,
    filesLinted: 0,
    filesSkipped: 0,
    totalViolations: 0,
    findings: [],
    unparseable: [],
  }

  if (!existsSync(canonRoot)) {
    return result
  }

  const files = collectJsonFiles(canonRoot)
  for (const absPath of files) {
    result.filesScanned++
    const filePath = toPosixRelative(canonRoot, absPath)

    const binding = resolveTierBinding(filePath)
    if (binding === null) {
      result.filesSkipped++
      continue
    }

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

    result.filesLinted++

    // Source the 8 problem utterances. Per current canon shape they live
    // on the top-level `utterances` array. (We deliberately don't read
    // `plan.utterances` — the plan field is `unknown` on the wire type;
    // top-level `utterances` is the validated surface.)
    const violations = lintSubToTenComposition(
      parsed as SessionStartResponse,
      binding.config,
    )
    if (violations.length > 0) {
      result.findings.push({
        filePath,
        tier: binding.tier,
        violations,
      })
      result.totalViolations += violations.length
    }
  }

  return result
}

export function formatCompositionLintReport(
  result: RunCompositionLintResult,
): string {
  const lines: string[] = []
  lines.push('Composition lint report')
  lines.push('=======================')
  lines.push(`files scanned: ${result.filesScanned}`)
  lines.push(`files linted:  ${result.filesLinted}  (in-scope tiers)`)
  lines.push(`files skipped: ${result.filesSkipped}  (out-of-scope tiers)`)
  lines.push(`violations:    ${result.totalViolations}`)
  lines.push(`unparseable:   ${result.unparseable.length}`)
  lines.push('')

  if (result.unparseable.length > 0) {
    lines.push('Unparseable files:')
    for (const u of result.unparseable) {
      lines.push(`  - ${u.filePath}: ${u.reason}`)
    }
    lines.push('')
  }

  if (result.findings.length > 0) {
    lines.push('Composition violations (CI gate — must fix):')
    for (const f of result.findings) {
      lines.push(`[${f.filePath}] (tier: ${f.tier})`)
      for (const v of f.violations) {
        const slot = v.problemIndex === null ? '*' : `P${v.problemIndex}`
        lines.push(`  - ${v.rule}  slot=${slot}`)
        lines.push(`    ${v.message}`)
      }
    }
    lines.push('')
  }

  if (result.findings.length === 0 && result.unparseable.length === 0) {
    lines.push(
      `No composition violations across ${result.filesLinted} in-scope tier file(s).`,
    )
  }

  return lines.join('\n')
}

// ── helpers ──────────────────────────────────────────────────────────────

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
  report: boolean
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = join(here, '..')
  const args: CliArgs = {
    root: join(repoRoot, 'public', 'canon'),
    report: false,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && typeof argv[i + 1] === 'string') {
      args.root = argv[i + 1]!
      i++
    } else if (argv[i] === '--report') {
      args.report = true
    }
  }
  return args
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2))
  const result = runCompositionLint(args.root)

  const hasFailures =
    result.totalViolations > 0 || result.unparseable.length > 0

  const hasAnyFinding =
    result.findings.length > 0 || result.unparseable.length > 0

  if (args.report || hasAnyFinding) {
    console.log(formatCompositionLintReport(result))
  } else {
    console.log(
      `composition lint clean: ${result.filesLinted} in-scope file(s), ` +
        `0 violations.`,
    )
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
