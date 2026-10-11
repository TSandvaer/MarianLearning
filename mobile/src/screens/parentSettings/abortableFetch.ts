/**
 * A `fetch` that also gives up when `signal` aborts. Core's cloud-sync
 * helpers take a `fetchImpl` but no signal; Parent Settings passes this
 * so a push or restore still in flight is aborted when the screen
 * unmounts (core reports it as a failed / cloud-error result, which the
 * unmounted screen ignores).
 *
 * A request that already carries its own signal (core's 3 s GET timeout)
 * aborts on whichever fires first. React Native's Hermes has no
 * `AbortSignal.any`, hence the hand-merge.
 */
export function abortableFetch(
  base: typeof fetch,
  signal: AbortSignal,
): typeof fetch {
  const wrapped = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (signal.aborted) return Promise.reject(abortError())
    const own = init?.signal ?? null
    if (own === null) return base(input, { ...init, signal })

    const merged = new AbortController()
    const abort = () => merged.abort()
    if (own.aborted) merged.abort()
    own.addEventListener('abort', abort)
    signal.addEventListener('abort', abort)
    const detach = () => {
      own.removeEventListener('abort', abort)
      signal.removeEventListener('abort', abort)
    }
    return base(input, { ...init, signal: merged.signal }).then(
      (res) => {
        detach()
        return res
      },
      (err: unknown) => {
        detach()
        throw err
      },
    )
  }
  return wrapped as typeof fetch
}

function abortError(): Error {
  const err = new Error('Aborted')
  err.name = 'AbortError'
  return err
}
