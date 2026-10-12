import { abortableFetch } from './abortableFetch'

type Init = Parameters<typeof fetch>[1]

/** A fetch that settles only when its signal aborts (or never). */
function hangingFetch() {
  const calls: Init[] = []
  const impl = jest.fn((_input: unknown, init?: Init) => {
    calls.push(init)
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        reject(err)
      })
    })
  })
  return { impl: impl as unknown as typeof fetch, calls, mock: impl }
}

it('passes the screen signal through when the request has none', async () => {
  const f = hangingFetch()
  const screen = new AbortController()
  const p = abortableFetch(f.impl, screen.signal)('https://x/api', {
    method: 'POST',
  })
  expect(f.calls[0]).toMatchObject({ method: 'POST', signal: screen.signal })
  screen.abort()
  await expect(p).rejects.toMatchObject({ name: 'AbortError' })
})

it("aborts on the screen signal even when the request has its own (core's timeout)", async () => {
  const f = hangingFetch()
  const screen = new AbortController()
  const timeout = new AbortController()
  const p = abortableFetch(f.impl, screen.signal)('https://x/api', {
    signal: timeout.signal,
  })
  screen.abort()
  await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  expect(timeout.signal.aborted).toBe(false)
})

it("aborts on the request's own signal too", async () => {
  const f = hangingFetch()
  const screen = new AbortController()
  const timeout = new AbortController()
  const p = abortableFetch(f.impl, screen.signal)('https://x/api', {
    signal: timeout.signal,
  })
  timeout.abort()
  await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  expect(screen.signal.aborted).toBe(false)
})

it('never starts a request once the screen is gone', async () => {
  const f = hangingFetch()
  const screen = new AbortController()
  screen.abort()
  await expect(
    abortableFetch(f.impl, screen.signal)('https://x/api'),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(f.mock).not.toHaveBeenCalled()
})

it('resolves with the response and detaches its listeners', async () => {
  const res = { ok: true, status: 200 } as Response
  const base = jest.fn(async () => res) as unknown as typeof fetch
  const screen = new AbortController()
  const timeout = new AbortController()
  const remove = jest.spyOn(screen.signal, 'removeEventListener')
  await expect(
    abortableFetch(base, screen.signal)('https://x/api', {
      signal: timeout.signal,
    }),
  ).resolves.toBe(res)
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
})
