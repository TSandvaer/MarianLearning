/**
 * `composeSession` over a small synthetic canon: the branch rules the
 * golden test (`tests/noClaude/localSessionParity.test.ts`, the real
 * handler over the real canon) cannot see on today's canon.
 */
import { describe, expect, it } from 'vitest'
import {
  canonTextKey,
  composeSession,
  type CanonText,
  type CanonTextResolver,
} from './composeSession'

function step(node: string, opener = 'You did it!'): CanonText {
  const lines = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [
      { id: `math.p${n}.read`, text: `${node} ${n}?` },
      { id: `math.p${n}.correct`, text: `Yes ${n}!` },
    ]),
    { id: 'session.end.opener', text: opener },
    { id: 'session.end.recap', text: `${node} done.` },
  ]
  return {
    plan: { id: `${node}-1`, label: node, utterances: lines },
    utterances: lines,
  }
}

const CANON: Record<string, CanonText> = {
  'math/level-1/add-to-10': step('add-to-10'),
  'math/level-1/sub-to-10': step('sub-to-10', 'Take away, done!'),
  'math/level-1/two-digit-addsub': step('two-digit'),
  'word-song/level-1/cvc-words': {
    plan: { id: 'cvc', label: 'cvc', utterances: [] },
    utterances: [{ id: 'session.end.opener', text: 'You did it!' }],
  },
}
const resolve: CanonTextResolver = (key) => CANON[canonTextKey(key)] ?? null

const math = (progress?: Record<string, unknown>) => ({
  track: 'math',
  level: 1,
  childName: 'friend',
  ...(progress ? { progress } : {}),
})

const lineText = (out: ReturnType<typeof composeSession>, id: string) =>
  out.kind === 'local'
    ? out.session.utterances.find((u) => u.id === id)?.text
    : undefined

describe('composeSession', () => {
  it('a met gated step speaks the vanilla opener; its plan keeps its own', () => {
    const met = composeSession(
      math({ focusNode: 'sub-to-10', lifetimeFirstEncounters: ['sub-to-10'] }),
      resolve,
    )
    expect(lineText(met, 'session.end.opener')).toBe('You did it!')
    expect(met.kind === 'local' && met.session.plan).toBe(
      CANON['math/level-1/sub-to-10']!.plan,
    )
    const first = composeSession(math({ focusNode: 'sub-to-10' }), resolve)
    expect(lineText(first, 'session.end.opener')).toBe('Take away, done!')
  })

  it('the no-regroup step reads the old two-digit file', () => {
    const out = composeSession(
      math({ focusNode: 'two-digit-addsub-no-regroup' }),
      resolve,
    )
    expect(out.kind === 'local' && out.session.plan).toEqual(
      CANON['math/level-1/two-digit-addsub']!.plan,
    )
  })

  it('a session never shares a line with the canon it copies', () => {
    const out = composeSession(math({ focusNode: 'add-to-10' }), resolve)
    if (out.kind !== 'local') throw new Error(out.kind)
    out.session.utterances[0]!.text = 'changed'
    expect(CANON['math/level-1/add-to-10']!.utterances[0]!.text).toBe(
      'add-to-10 1?',
    )
  })

  it('reads the payload as JSON carries it', () => {
    // `undefined` keys vanish on the wire, so this is a plain forward
    // request, not a review or a client plan.
    const out = composeSession(
      {
        ...math({ focusNode: 'add-to-10' }),
        review: undefined,
        plan: undefined,
      },
      resolve,
    )
    expect(out.kind === 'local' && out.served).toBe('canon')
    expect(composeSession(undefined, resolve).kind).toBe('server')
  })

  it('says why it leaves a session to the server', () => {
    expect(
      composeSession(
        math({ leitner: [{ a: 3, b: 4, op: '+', box: 1 }] }),
        resolve,
      ),
    ).toEqual({ kind: 'server', reason: 'Leitner hint' })
    expect(composeSession(math({ focusNode: 'add-to-20' }), resolve)).toEqual({
      kind: 'server',
      reason: 'no canon for add-to-20',
    })
    expect(composeSession({ track: 'math', level: 1 }, resolve)).toEqual({
      kind: 'server',
      reason: 'no track payload',
    })
  })

  it('a review naming a step without canon is invalid, as the server 400s it', () => {
    const blocks = [1, 2, 3, 4, 5, 6, 7, 8].map((problem) => ({
      node: problem === 8 ? 'add-to-20' : 'add-to-10',
      problem,
    }))
    expect(composeSession({ ...math(), review: { blocks } }, resolve)).toEqual({
      kind: 'invalid',
      message: 'review must name 8 canon blocks',
    })
  })
})
