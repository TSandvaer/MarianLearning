/**
 * @vitest-environment node
 *
 * The every-step Maestro sweep's per-step verdict
 * (`scripts/maestroSweepVerdict.ts`, `mobile/maestro/run.sh --sweep`).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { QA_STEPS } from '@marian/core/debug/stepProgress'
import {
  EXPECTED_FAIL_FILE,
  classifyStep,
  parseApiLog,
  parseExpectedFail,
  type StepEvidence,
  type SweepApiRecord,
} from './maestroSweepVerdict.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Lines in the shape Expo CLI prints a device's console to Metro's log.
const JUMP = (node: string) => ` LOG  [qaStep] jumped to "${node}"`
const READY = (label: string, id: string) =>
  ` LOG  [audio] ${label} ready (${id})`
const FALLBACK = (label: string, why: string) =>
  ` LOG  [audio] ${label} unavailable, silent fallback: ${why}`
/** `mobile/src/session/localSession.ts`'s row: `<kind> <focus>`. */
const LOCAL = (world: string, kindAndFocus: string) =>
  ` LOG  [audio] session-local ${world} 3 ms ${kindAndFocus}, 76 utterances`

function req(
  track: string,
  focusNode: string | null,
  status = 200,
  source: SweepApiRecord['source'] = 'canon-hit',
): SweepApiRecord {
  return { kind: 'session-start', track, focusNode, status, source }
}

function evidence(over: Partial<StepEvidence>): StepEvidence {
  return {
    node: 'add-to-20',
    world: 'math',
    expectedFail: false,
    flowPassed: true,
    metroLog: [
      JUMP('add-to-20'),
      READY('math-session', 'add-to-20-balanced-intro'),
    ].join('\n'),
    apiRecords: [req('math', 'add-to-20')],
    ...over,
  }
}

describe('classifyStep', () => {
  it('PASS: jumped, asked for the step, played the server plan, flow green', () => {
    expect(classifyStep(evidence({}))).toEqual({
      verdict: 'PASS',
      detail: 'server plan add-to-20-balanced-intro',
    })
  })

  it('PASS for a Word Song step reads the word-song-session lines', () => {
    const result = classifyStep(
      evidence({
        node: 'digraphs-sh',
        world: 'word-song',
        metroLog: [
          JUMP('digraphs-sh'),
          READY('word-song-session', 'digraphs-sh-intro'),
        ].join('\n'),
        apiRecords: [req('word-song', 'digraphs-sh')],
      }),
    )
    expect(result).toEqual({
      verdict: 'PASS',
      detail: 'server plan digraphs-sh-intro',
    })
  })

  it('ignores the other world: a Hub prefetch of Math on a Word Song step', () => {
    const result = classifyStep(
      evidence({
        node: 'cvc-words',
        world: 'word-song',
        metroLog: [
          JUMP('cvc-words'),
          READY('word-song-session', 'cvc-words-balanced'),
        ].join('\n'),
        apiRecords: [req('math', 'add-to-10'), req('word-song', 'cvc-words')],
      }),
    )
    expect(result.verdict).toBe('PASS')
  })

  it('FAIL on the silent fallback of a step that should work', () => {
    const result = classifyStep(
      evidence({
        metroLog: [
          JUMP('add-to-20'),
          FALLBACK('math-session', 'session-start returned 502'),
        ].join('\n'),
      }),
    )
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'silent fallback: session-start returned 502',
    })
  })

  it('FAIL when the session asked for another step', () => {
    const result = classifyStep(
      evidence({ apiRecords: [req('math', 'add-to-10')] }),
    )
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'session-start asked for add-to-10, not add-to-20',
    })
  })

  it('FAIL when the session-start named no focus node', () => {
    const result = classifyStep(evidence({ apiRecords: [req('math', null)] }))
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'session-start asked for (none), not add-to-20',
    })
  })

  it('FAIL when no session-start reached the API for the world', () => {
    const result = classifyStep(
      evidence({ apiRecords: [req('word-song', 'cvc-words')] }),
    )
    expect(result.verdict).toBe('FAIL')
    expect(result.detail).toBe(
      'no math session-start reached the sweep API or was built on the device',
    )
  })

  it('PASS for a session built on the device: no request reaches the API', () => {
    const result = classifyStep(
      evidence({
        metroLog: [
          JUMP('add-to-20'),
          LOCAL('math', 'canon add-to-20'),
          READY('math-session', 'add-to-20-balanced-intro'),
        ].join('\n'),
        apiRecords: [],
      }),
    )
    expect(result).toEqual({
      verdict: 'PASS',
      detail: 'device plan add-to-20-balanced-intro',
    })
  })

  it('FAIL when the device built another step, and ignores the other world', () => {
    const result = classifyStep(
      evidence({
        metroLog: [
          JUMP('add-to-20'),
          LOCAL('word-song', 'canon cvc-words'),
          LOCAL('math', 'canon add-to-10'),
          READY('math-session', 'add-to-10-balanced-intro'),
        ].join('\n'),
        apiRecords: [],
      }),
    )
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'session-start asked for add-to-10, not add-to-20',
    })
  })

  it('FAIL when the qaStep jump is not in the log (the flag did not apply)', () => {
    const result = classifyStep(
      evidence({
        metroLog: READY('math-session', 'add-to-20-balanced-intro'),
      }),
    )
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'no [qaStep] jump to add-to-20 in Metro log',
    })
  })

  it('FAIL on an ERROR line (console.error or a red box), quoting the first', () => {
    const result = classifyStep(
      evidence({
        metroLog: [
          JUMP('add-to-20'),
          READY('math-session', 'add-to-20-balanced-intro'),
          ' ERROR  TypeError: undefined is not a function',
          ' ERROR  second one',
        ].join('\n'),
      }),
    )
    expect(result).toEqual({
      verdict: 'FAIL',
      detail:
        '2 ERROR line(s) in Metro log, first: TypeError: undefined is not a function',
    })
  })

  it('does not count a WARN or a LOG that mentions "error" as an ERROR', () => {
    const result = classifyStep(
      evidence({
        metroLog: [
          JUMP('add-to-20'),
          ' WARN  something deprecated',
          ' LOG  [audio] note: no error here',
          READY('math-session', 'add-to-20-balanced-intro'),
        ].join('\n'),
      }),
    )
    expect(result.verdict).toBe('PASS')
  })

  it('FAIL when the Maestro flow failed (crash, stuck screen, red box)', () => {
    const result = classifyStep(evidence({ flowPassed: false }))
    expect(result).toEqual({
      verdict: 'FAIL',
      detail:
        'Maestro flow failed (crash, red box or a screen that never came)',
    })
  })

  it('FAIL when the session never settled', () => {
    const result = classifyStep(evidence({ metroLog: JUMP('add-to-20') }))
    expect(result).toEqual({
      verdict: 'FAIL',
      detail: 'math session never settled (no ready / fallback line)',
    })
  })

  it('lists every problem, flow failure first', () => {
    const result = classifyStep(
      evidence({
        flowPassed: false,
        metroLog: FALLBACK('math-session', 'boom'),
        apiRecords: [req('math', 'add-to-10')],
      }),
    )
    expect(result.verdict).toBe('FAIL')
    expect(result.detail.split('; ')).toEqual([
      'Maestro flow failed (crash, red box or a screen that never came)',
      'no [qaStep] jump to add-to-20 in Metro log',
      'session-start asked for add-to-10, not add-to-20',
      'silent fallback: boom',
    ])
  })

  describe('expected-fail steps', () => {
    const XFAIL_LOG = [
      JUMP('skip-counting'),
      FALLBACK(
        'math-session',
        'math read line "Two, four, six. What is next?" did not match any known math read template',
      ),
    ].join('\n')

    it('XFAIL: the API served the step, the app fell back, nothing else wrong', () => {
      const result = classifyStep(
        evidence({
          node: 'skip-counting',
          expectedFail: true,
          metroLog: XFAIL_LOG,
          apiRecords: [req('math', 'skip-counting')],
        }),
      )
      expect(result).toEqual({
        verdict: 'XFAIL',
        detail:
          'silent fallback: math read line "Two, four, six. What is next?" did not match any known math read template',
      })
    })

    it('XPASS when an expected-fail step plays its server plan (goes red)', () => {
      const result = classifyStep(
        evidence({
          node: 'mult-3-4',
          expectedFail: true,
          metroLog: [
            JUMP('mult-3-4'),
            READY('math-session', 'mult-3-4-level-1'),
          ].join('\n'),
          apiRecords: [req('math', 'mult-3-4')],
        }),
      )
      expect(result).toEqual({
        verdict: 'XPASS',
        detail:
          'server plan mult-3-4-level-1 (expected to fail: take it off mobile/maestro/sweep/expected-fail.txt)',
      })
    })

    it('FAIL, not XFAIL, when the fallback came from the API failing', () => {
      // The known gap is "the server answers, the app can't read it". A
      // 5xx (or no answer) is a different failure.
      const result = classifyStep(
        evidence({
          node: 'skip-counting',
          expectedFail: true,
          metroLog: XFAIL_LOG,
          apiRecords: [req('math', 'skip-counting', 502, 'canon-miss')],
        }),
      )
      expect(result.verdict).toBe('FAIL')
      expect(result.detail).toContain(
        'the sweep API did not serve skip-counting (502, canon-miss)',
      )
    })

    it('FAIL, not XFAIL, when anything beyond the fallback went wrong', () => {
      const result = classifyStep(
        evidence({
          node: 'skip-counting',
          expectedFail: true,
          flowPassed: false,
          metroLog: XFAIL_LOG,
          apiRecords: [req('math', 'skip-counting')],
        }),
      )
      expect(result.verdict).toBe('FAIL')
      expect(result.detail.split('; ')[0]).toBe(
        'Maestro flow failed (crash, red box or a screen that never came)',
      )
    })
  })
})

describe('parseApiLog', () => {
  it('reads one JSON record per line and skips blank lines', () => {
    const other: SweepApiRecord = {
      kind: 'stumble-explanation',
      track: null,
      focusNode: null,
      status: 200,
      source: 'none',
    }
    const text = [
      JSON.stringify(req('math', 'add-to-20')),
      '',
      JSON.stringify(other),
      '',
    ].join('\n')
    expect(parseApiLog(text)).toEqual([req('math', 'add-to-20'), other])
  })

  it('throws on a line that is not JSON, naming the line', () => {
    const text = `${JSON.stringify(req('math', 'add-to-20'))}\nnot json`
    expect(() => parseApiLog(text)).toThrow(/line 2/)
  })

  it('throws on a record with a missing field, naming the line', () => {
    expect(() => parseApiLog('{"kind":"session-start"}')).toThrow(/line 1/)
  })
})

describe('parseExpectedFail', () => {
  const steps = ['skip-counting', 'mult-2-5-10', 'add-to-10']

  it('reads one step per line, ignoring comments and blank lines', () => {
    const text = '# known gaps\n\nskip-counting\nmult-2-5-10  # Devon\n'
    expect(parseExpectedFail(text, steps)).toEqual(
      new Set(['skip-counting', 'mult-2-5-10']),
    )
  })

  it('throws on a name that is not a step (a typo would hide a failure)', () => {
    expect(() => parseExpectedFail('skip-countin\n', steps)).toThrow(
      /"skip-countin" is not a step/,
    )
  })

  it('the committed list names only real steps', () => {
    const text = readFileSync(join(ROOT, EXPECTED_FAIL_FILE), 'utf8')
    const names = QA_STEPS.map((s) => s.node)
    expect(() => parseExpectedFail(text, names)).not.toThrow()
  })
})
