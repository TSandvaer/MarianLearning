/**
 * The frozen web app keeps its silent fallback for Number Garden steps 1 and
 * 8–11.
 *
 * Core's math parser gained opt-in number-recognition, skip-count and
 * multiplication kinds for the native app (`mathSessionPlanFromServer(plan,
 * { extendedKinds: true })`). The web caller, `prepareMathPathA`, does not
 * opt in, so the committed canon for those five steps must still fail rehydration here with the same error
 * as before — which is what sends App.tsx to the static plan with silent
 * captions. A served canon file is a whole `SessionStartResponse`, so it is
 * fed to the caller as the `/api/claude` response body.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { prepareMathPathA } from './mathPathA'

const CANON_DIR = join(process.cwd(), 'public', 'canon', 'math', 'level-1')

function canonResponse(node: string): Response {
  return new Response(readFileSync(join(CANON_DIR, `${node}.json`), 'utf8'), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ARGS = { level: 1, childName: 'Marian', sessionId: 'canon-fallback' }

function deps(node: string) {
  return {
    fetch: vi.fn(async () =>
      canonResponse(node),
    ) as unknown as typeof globalThis.fetch,
    loadSessionAudio: vi.fn(async () => new Map()),
    playSessionUtterance: vi.fn(async () => {}),
  }
}

describe('prepareMathPathA — steps 1 and 8–11 canon still fall back on the web', () => {
  it.each([
    ['number-recog', 'Tap the one.'],
    ['skip-counting', 'Two, four, six, eight. What is next?'],
    ['mult-2-5-10', 'Two times two. How many?'],
    ['mult-3-4', 'Two times three. How many?'],
    ['mult-6-9', 'Six times two. How many?'],
  ])(
    '%s rejects invalid-response with the pre-existing parser error',
    async (node, p1Read) => {
      const d = deps(node)
      await expect(prepareMathPathA(ARGS, d)).rejects.toMatchObject({
        code: 'invalid-response',
        message:
          `Path A plan rehydration failed: math read line "${p1Read}" did ` +
          'not match any known math read template (addition "<W> plus <W>. ' +
          'How many?"; subtraction "<W> minus <W>. How many are left?"; ' +
          'subtraction first-session "<W> take away <W>. How many are left?")',
      })
      // Rejected before any session audio is registered.
      expect(d.loadSessionAudio).toHaveBeenCalledTimes(0)
    },
  )

  it('control: an arithmetic canon file still rehydrates, with no kind tag', async () => {
    const d = deps('add-to-10')
    const prepared = await prepareMathPathA(ARGS, d)
    expect(prepared.plan.problems).toHaveLength(8)
    expect(prepared.plan.problems.every((p) => !('kind' in p))).toBe(true)
    expect(d.loadSessionAudio).toHaveBeenCalledTimes(1)
  })
})
