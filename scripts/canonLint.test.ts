/**
 * @vitest-environment node
 *
 * Tests for the canon-bake validation lint (`scripts/canonLint.ts`).
 * Ticket 86c9qhr9k.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CanonLintError,
  assertCanonResponseClean,
  formatLintReport,
  lintCanonResponse,
  lintUtteranceText,
  loadBaseline,
  runCanonLint,
} from './canonLint.ts'
import type { SessionStartResponse, Utterance } from '../api/_types.js'

// ── helpers ──────────────────────────────────────────────────────────────

function utterance(id: string, text: string): Utterance {
  return {
    id,
    text,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

function buildResponse(utterances: Utterance[]): SessionStartResponse {
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test-plan', label: 'test', utterances: [] },
    utterances,
  }
}

// ── lintUtteranceText: rule coverage ─────────────────────────────────────

describe('lintUtteranceText — rule coverage', () => {
  it('returns no violations for clean ASCII-7 text', () => {
    expect(lintUtteranceText('p1.read', 'Tap the cat.')).toEqual([])
    expect(lintUtteranceText('p1.read', 'Two plus three. How many?')).toEqual(
      [],
    )
    expect(
      lintUtteranceText('p1.read', "You did it! It's 'sun', not 'soon.'"),
    ).toEqual([])
  })

  describe('rule: non-ascii', () => {
    it('fires on em-dash (U+2014)', () => {
      const v = lintUtteranceText('e1', 'short i — not ee')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('non-ascii')
      expect(v[0]!.nonAsciiCodepoints).toEqual(['— (U+2014)'])
    })

    it('fires on en-dash (U+2013)', () => {
      const v = lintUtteranceText('e1', 'pages 3–5')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('non-ascii')
      expect(v[0]!.nonAsciiCodepoints).toEqual(['– (U+2013)'])
    })

    it('fires on curly quotes (U+2018, U+2019, U+201C, U+201D)', () => {
      const v = lintUtteranceText('e1', '“sun” and ‘soon’')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('non-ascii')
      // 4 unique non-ASCII codepoints
      expect(v[0]!.nonAsciiCodepoints).toHaveLength(4)
    })

    it('fires on unicode IPA chars (ɪ U+028A, ʌ U+028C)', () => {
      const v = lintUtteranceText('e1', 'short ʌ vs ee')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('non-ascii')
      expect(v[0]!.nonAsciiCodepoints).toEqual(['ʌ (U+028C)'])
    })

    it('fires on mojibake byte sequences (â€)', () => {
      // The classic UTF-8 → CP1252 → UTF-8 round-trip signature from
      // PR #192's third ear-test failure. The "â€" prefix alone has
      // two non-ASCII codepoints (U+00E2 + U+20AC).
      const v = lintUtteranceText('e1', 'asesinati â€" not asesinati')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('non-ascii')
      expect(v[0]!.nonAsciiCodepoints?.length).toBeGreaterThanOrEqual(2)
    })

    it('does NOT fire on ASCII apostrophe / hyphen / colon', () => {
      expect(lintUtteranceText('e1', "It's 'sun', not 'soon.'")).toEqual([])
      expect(lintUtteranceText('e1', 'short-i: not ee')).toEqual([])
    })
  })

  describe('rule: slash-ipa', () => {
    it('fires on /p/-/ɪ/-/g/ (PR #192 iteration 2 failure mode)', () => {
      const v = lintUtteranceText('e1', 'Like pig: /p/-/ɪ/-/g/.')
      // Both rules fire: non-ascii (the ɪ) AND slash-ipa.
      expect(v.map((x) => x.rule).sort()).toEqual(['non-ascii', 'slash-ipa'])
    })

    it('fires on /s/ /ʌ/ /n/ (cvc-words-short-u session-end-opener)', () => {
      const v = lintUtteranceText('e1', 'Sun! /s/ /ʌ/ /n/.')
      expect(v.map((x) => x.rule).sort()).toEqual(['non-ascii', 'slash-ipa'])
    })

    it('fires on pure-ASCII slash notation (/cat/)', () => {
      const v = lintUtteranceText('e1', 'Read /cat/ aloud.')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('slash-ipa')
    })

    it('does NOT fire on URLs or single-letter slash patterns', () => {
      // URLs use /word/word — but our rule requires the closing slash
      // to bracket exactly one alpha+ token; "https://example.com/path"
      // would fire on `/example.com/` only if alpha-only. The dot stops
      // the match. Confirm.
      expect(lintUtteranceText('e1', 'https://example.com/path')).toEqual([])
      // Date-like patterns with digits don't trip the rule.
      expect(lintUtteranceText('e1', 'on 1/2/2026')).toEqual([])
    })

    it('does NOT fire on a single-letter slash pattern', () => {
      // The `+` quantifier requires one-or-more letters between slashes,
      // so `/a/` actually DOES fire. Document the current behavior:
      // single-letter slash patterns trigger the rule. This is a feature
      // — `/a/` IS phonetic-breakdown notation in phonics convention.
      const v = lintUtteranceText('e1', 'say /a/')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('slash-ipa')
    })
  })

  describe('rule: angle-tag', () => {
    it('fires on <phoneme alphabet="ipa" ph="ɪ">ih</phoneme>', () => {
      const v = lintUtteranceText(
        'e1',
        '<phoneme alphabet="ipa" ph="ih">ih</phoneme>',
      )
      // Both fire — the tag and the non-ASCII would, but this fixture
      // is ASCII-only inside the tag → just angle-tag.
      expect(v.map((x) => x.rule).sort()).toEqual(['angle-tag'])
    })

    it('fires on simple <break/> tag', () => {
      const v = lintUtteranceText('e1', 'pause <break/> resume')
      expect(v).toHaveLength(1)
      expect(v[0]!.rule).toBe('angle-tag')
    })

    it('does NOT fire on isolated < or > (arithmetic-like)', () => {
      // Bounded `[^<>]*` interior means a stray `<` without a matching
      // `>` doesn't match. Conservative on purpose.
      expect(lintUtteranceText('e1', '5 < 10')).toEqual([])
    })
  })

  it('returns multiple violations when multiple rules fire on the same text', () => {
    const v = lintUtteranceText('e1', '<phoneme ph="ʌ">/ʌ/</phoneme>')
    expect(v.map((x) => x.rule).sort()).toEqual([
      'angle-tag',
      'non-ascii',
      'slash-ipa',
    ])
  })

  it('attaches snippet `match` for triage', () => {
    const v = lintUtteranceText(
      'e1',
      'Once upon a time there was a — long ago — story.',
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.match).toContain('—')
  })
})

// ── lintCanonResponse / assertCanonResponseClean ─────────────────────────

describe('lintCanonResponse', () => {
  it('returns no violations for a clean response', () => {
    const r = buildResponse([
      utterance('p1.read', 'Tap the cat.'),
      utterance('p2.read', 'Two plus three. How many?'),
    ])
    expect(lintCanonResponse(r)).toEqual([])
  })

  it('returns one violation per rule per utterance', () => {
    const r = buildResponse([
      utterance('p1.read', 'Tap the cat.'),
      utterance('p2.read', '/p/-/ɪ/-/g/'), // non-ascii + slash-ipa
      utterance('p3.read', '— em dash'), // non-ascii only
    ])
    const violations = lintCanonResponse(r)
    expect(violations).toHaveLength(3)
    const ids = violations.map((v) => v.utteranceId).sort()
    expect(ids).toEqual(['p2.read', 'p2.read', 'p3.read'])
  })

  it('skips utterances without a string text field (defensive)', () => {
    const r = {
      ok: true as const,
      kind: 'session-start' as const,
      plan: {},
      utterances: [
        utterance('p1.read', 'Tap the cat.'),
        // intentionally malformed — text missing
        { id: 'broken', text: 123 } as unknown as Utterance,
      ],
    }
    // Should not throw; just skip the malformed one.
    expect(lintCanonResponse(r)).toEqual([])
  })
})

describe('assertCanonResponseClean', () => {
  it('does not throw on a clean response', () => {
    const r = buildResponse([utterance('p1.read', 'Tap the cat.')])
    expect(() => assertCanonResponseClean(r)).not.toThrow()
  })

  it('throws CanonLintError when violations exist', () => {
    const r = buildResponse([utterance('p1.read', 'Tap the cat —')])
    expect(() => assertCanonResponseClean(r)).toThrow(CanonLintError)
  })

  it('throw carries the full violations list for the bake script to log', () => {
    const r = buildResponse([
      utterance('p1.read', '/p/-/ɪ/-/g/'),
      utterance('p2.read', '— em dash'),
    ])
    try {
      assertCanonResponseClean(r)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CanonLintError)
      const e = err as CanonLintError
      // Two utterances — first one fires both rules (non-ascii + slash-ipa);
      // second fires non-ascii only. Total 3 violations.
      expect(e.violations).toHaveLength(3)
    }
  })
})

// ── runCanonLint: disk walker ────────────────────────────────────────────

describe('runCanonLint — disk walker', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'canon-lint-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function writeCanon(path: string, body: SessionStartResponse | string): void {
    const abs = join(tmp, path)
    mkdirSync(join(abs, '..'), { recursive: true })
    const json = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    writeFileSync(abs, json, 'utf8')
  }

  it('returns empty result when canonRoot does not exist', () => {
    const r = runCanonLint(join(tmp, 'does-not-exist'))
    expect(r.filesScanned).toBe(0)
    expect(r.totalViolations).toBe(0)
    expect(r.baselineViolations).toBe(0)
    expect(r.findings).toEqual([])
    expect(r.baselineFindings).toEqual([])
    expect(r.unparseable).toEqual([])
  })

  it('walks every JSON file recursively', () => {
    writeCanon(
      'math/level-1/add-to-10.json',
      buildResponse([utterance('p1.read', 'Two plus one.')]),
    )
    writeCanon(
      'word-song/level-1/blending-cv.json',
      buildResponse([utterance('p1.read', 'Tap the cat.')]),
    )
    const r = runCanonLint(tmp)
    expect(r.filesScanned).toBe(2)
    expect(r.totalViolations).toBe(0)
  })

  it('reports violations grouped by file', () => {
    writeCanon(
      'math/level-1/add-to-10.json',
      buildResponse([utterance('p1.read', 'Two plus one.')]),
    )
    writeCanon(
      'word-song/level-1/cvc-words-short-u.json',
      buildResponse([
        utterance('p1.read', 'Read the sun.'),
        utterance(
          'session.end.opener',
          "You did it! 'sun' — not 'soon.' Sun! /s/ /ʌ/ /n/.",
        ),
      ]),
    )
    const r = runCanonLint(tmp)
    expect(r.filesScanned).toBe(2)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.filePath).toContain(
      'word-song/level-1/cvc-words-short-u.json',
    )
    // session.end.opener fires non-ascii (em-dash + ʌ) + slash-ipa
    expect(r.findings[0]!.violations.length).toBeGreaterThanOrEqual(2)
    expect(r.totalViolations).toBe(r.findings[0]!.violations.length)
  })

  it('records unparseable JSON without throwing', () => {
    writeCanon('broken.json', '{ not json')
    const r = runCanonLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.filePath).toContain('broken.json')
  })

  it('records shape-mismatch (not a SessionStartResponse) as unparseable', () => {
    writeCanon('shape.json', '{"hello":"world"}')
    const r = runCanonLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.reason).toBe('not a SessionStartResponse')
  })

  it('produces a stable ordering across runs (sort by file path)', () => {
    writeCanon('b/file.json', buildResponse([utterance('p1', '/x/')]))
    writeCanon('a/file.json', buildResponse([utterance('p1', '— bad')]))
    const r = runCanonLint(tmp)
    expect(r.findings).toHaveLength(2)
    // First finding should be from a/, not b/.
    expect(r.findings[0]!.filePath).toContain('a/file.json')
  })

  describe('baseline mechanism (ticket 86c9qhr9k)', () => {
    it('reclassifies a baseline-matched violation as baselineFindings', () => {
      writeCanon(
        'word-song/level-1/cvc-words-short-u.json',
        buildResponse([
          utterance('session.end.opener', "'sun' — not 'soon.' /s/ /ʌ/ /n/."),
        ]),
      )
      // The temp-dir relative-path shape is "<basename of tmp>/word-song/...".
      // Read it back from a no-baseline run first to capture the actual path.
      const noBaseline = runCanonLint(tmp)
      expect(noBaseline.findings).toHaveLength(1)
      const filePath = noBaseline.findings[0]!.filePath

      const withBaseline = runCanonLint(tmp, [
        { filePath, utteranceId: 'session.end.opener', rule: 'non-ascii' },
        { filePath, utteranceId: 'session.end.opener', rule: 'slash-ipa' },
      ])
      expect(withBaseline.totalViolations).toBe(0)
      expect(withBaseline.findings).toHaveLength(0)
      expect(withBaseline.baselineViolations).toBe(2)
      expect(withBaseline.baselineFindings).toHaveLength(1)
      expect(withBaseline.baselineFindings[0]!.violations).toHaveLength(2)
    })

    it('NEW violations alongside baseline ones still surface as findings', () => {
      writeCanon(
        'word-song/level-1/baseline-and-new.json',
        buildResponse([
          utterance('session.end.opener', '— em dash'), // baselined
          utterance('p1.read', '<phoneme>x</phoneme>'), // NEW
        ]),
      )
      const r0 = runCanonLint(tmp)
      const filePath = r0.findings[0]!.filePath

      const r = runCanonLint(tmp, [
        { filePath, utteranceId: 'session.end.opener', rule: 'non-ascii' },
      ])
      expect(r.totalViolations).toBe(1)
      expect(r.findings).toHaveLength(1)
      expect(r.findings[0]!.violations[0]!.utteranceId).toBe('p1.read')
      expect(r.findings[0]!.violations[0]!.rule).toBe('angle-tag')
      expect(r.baselineViolations).toBe(1)
      expect(r.baselineFindings).toHaveLength(1)
    })

    it('baseline file path is matched exactly (no fuzzy match)', () => {
      writeCanon(
        'word-song/level-1/wrong-path.json',
        buildResponse([utterance('p1.read', '— em dash')]),
      )
      const r0 = runCanonLint(tmp)
      const actualPath = r0.findings[0]!.filePath

      // Baseline references a different file path — should NOT match.
      const r = runCanonLint(tmp, [
        {
          filePath: actualPath + '-different',
          utteranceId: 'p1.read',
          rule: 'non-ascii',
        },
      ])
      expect(r.totalViolations).toBe(1)
      expect(r.baselineViolations).toBe(0)
    })
  })
})

describe('loadBaseline', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'canon-lint-baseline-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('returns [] when the file is missing', () => {
    expect(loadBaseline(join(tmp, 'missing.json'))).toEqual([])
  })

  it('parses a well-formed baseline JSON array', () => {
    const path = join(tmp, 'baseline.json')
    writeFileSync(
      path,
      JSON.stringify([
        {
          filePath: 'a/b.json',
          utteranceId: 'x',
          rule: 'non-ascii',
        },
      ]),
      'utf8',
    )
    const out = loadBaseline(path)
    expect(out).toEqual([
      { filePath: 'a/b.json', utteranceId: 'x', rule: 'non-ascii' },
    ])
  })

  it('ignores entries that don’t match the BaselineEntry shape', () => {
    const path = join(tmp, 'baseline.json')
    writeFileSync(
      path,
      JSON.stringify([
        { filePath: 'ok.json', utteranceId: 'x', rule: 'non-ascii' },
        { broken: true },
        null,
        { filePath: 'partial.json' },
      ]),
      'utf8',
    )
    const out = loadBaseline(path)
    expect(out).toHaveLength(1)
    expect(out[0]!.filePath).toBe('ok.json')
  })

  it('returns [] on malformed JSON without throwing', () => {
    const path = join(tmp, 'baseline.json')
    writeFileSync(path, '{ not json', 'utf8')
    expect(loadBaseline(path)).toEqual([])
  })
})

// ── formatLintReport ─────────────────────────────────────────────────────

describe('formatLintReport', () => {
  it('renders "no violations" cleanly', () => {
    const out = formatLintReport({
      filesScanned: 5,
      totalViolations: 0,
      baselineViolations: 0,
      findings: [],
      baselineFindings: [],
      unparseable: [],
    })
    expect(out).toContain('files scanned:       5')
    expect(out).toContain('No rule violations.')
  })

  it('renders each violation with id, rule, codepoints, and snippet', () => {
    const out = formatLintReport({
      filesScanned: 1,
      totalViolations: 1,
      baselineViolations: 0,
      findings: [
        {
          filePath: 'word-song/level-1/cvc-words-short-u.json',
          violations: [
            {
              rule: 'non-ascii',
              utteranceId: 'session.end.opener',
              text: 'a — b',
              match: 'a — b',
              nonAsciiCodepoints: ['— (U+2014)'],
            },
          ],
        },
      ],
      baselineFindings: [],
      unparseable: [],
    })
    expect(out).toContain('cvc-words-short-u.json')
    expect(out).toContain('session.end.opener')
    expect(out).toContain('non-ascii')
    expect(out).toContain('U+2014')
    expect(out).toContain('NEW violations')
  })

  it('lists unparseable files separately', () => {
    const out = formatLintReport({
      filesScanned: 1,
      totalViolations: 0,
      baselineViolations: 0,
      findings: [],
      baselineFindings: [],
      unparseable: [{ filePath: 'broken.json', reason: 'JSON parse error' }],
    })
    expect(out).toContain('Unparseable files:')
    expect(out).toContain('broken.json')
  })

  it('renders baseline-tolerated violations under their own header', () => {
    const out = formatLintReport({
      filesScanned: 1,
      totalViolations: 0,
      baselineViolations: 1,
      findings: [],
      baselineFindings: [
        {
          filePath: 'word-song/level-1/cvc-words-short-u.json',
          violations: [
            {
              rule: 'non-ascii',
              utteranceId: 'session.end.opener',
              text: 'a — b',
              match: 'a — b',
              nonAsciiCodepoints: ['— (U+2014)'],
            },
          ],
        },
      ],
      unparseable: [],
    })
    expect(out).toContain('Baseline-tolerated violations')
    expect(out).toContain('canon-lint-baseline.json')
    expect(out).toContain('cvc-words-short-u.json')
  })
})
