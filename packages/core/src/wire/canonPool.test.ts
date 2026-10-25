/**
 * A canon file holds the step's served session (problems 1–8 and the
 * `session.end.*` lines) and its pool (problems 9..N, no-Claude plan phase
 * 5a, `design/native/no-claude-sizing.md` § 2 "How a pool grows").
 * `servedCanon` is what the server serves and what the device's canon
 * session copies: the file without its pool.
 */
import { describe, expect, it } from 'vitest'
import {
  SERVED_CANON_PROBLEMS,
  canonProblemOf,
  hasCanonPool,
  isCanonPoolLineId,
  servedCanon,
} from './canonPool.js'

const line = (id: string) => ({ id, text: id })
const doc = (ids: readonly string[]) => ({
  ok: true,
  kind: 'session-start',
  plan: { id: 'x', label: 'X', utterances: ids.map(line) },
  utterances: ids.map((id) => ({ ...line(id), audio: { base64: id } })),
})

describe('canonProblemOf', () => {
  it('reads the problem of a math line, null for the rest', () => {
    expect(canonProblemOf('math.p1.read')).toBe(1)
    expect(canonProblemOf('math.p53.giveAnswer')).toBe(53)
    expect(canonProblemOf('word.p12.blend')).toBeNull()
    expect(canonProblemOf('session.end.recap.3')).toBeNull()
    expect(canonProblemOf('math.w1.read')).toBeNull()
    expect(canonProblemOf('mathp9.read')).toBeNull()
  })
})

describe('servedCanon', () => {
  it('serves problems 1..8', () => {
    expect(SERVED_CANON_PROBLEMS).toBe(8)
  })

  it('drops the pool (p9+) from the plan and the spoken lines, in order', () => {
    const full = doc([
      'math.p1.read',
      'math.p8.giveAnswer',
      'math.p9.read',
      'math.p10.correct',
      'math.p53.giveAnswer',
      'session.end.opener',
    ])
    const served = servedCanon(full)
    const kept = ['math.p1.read', 'math.p8.giveAnswer', 'session.end.opener']
    expect(served).toEqual(doc(kept))
    expect(hasCanonPool(full)).toBe(true)
    expect(hasCanonPool(served)).toBe(false)
    // The file itself is untouched.
    expect(full.utterances).toHaveLength(6)
  })

  it('never takes a word line for pool: letter-sounds-audit serves word.p1..p12', () => {
    expect(isCanonPoolLineId('math.p9.read')).toBe(true)
    for (const id of ['word.p9.read', 'word.p12.correct', 'word.p40.blend'])
      expect(isCanonPoolLineId(id), id).toBe(false)
    const audit = doc(['word.p1.read', 'word.p9.read', 'word.p12.correct'])
    expect(hasCanonPool(audit)).toBe(false)
    expect(servedCanon(audit)).toBe(audit)
  })

  it('returns a file with no pool as it is, the same object', () => {
    const plain = doc(['math.p1.read', 'word.p8.read', 'session.end.goodbye'])
    expect(servedCanon(plain)).toBe(plain)
    expect(hasCanonPool(plain)).toBe(false)
  })

  it('leaves a plan it cannot read alone and still drops pool lines', () => {
    const odd = { ...doc(['math.p9.read', 'math.p2.read']), plan: null }
    expect(servedCanon(odd)).toEqual({
      ...odd,
      utterances: [
        {
          id: 'math.p2.read',
          text: 'math.p2.read',
          audio: { base64: 'math.p2.read' },
        },
      ],
    })
  })
})
