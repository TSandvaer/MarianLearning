/**
 * Parent Settings' screen-lifetime hooks.
 *
 * `useTransientStatus`: a status that falls back to idle
 * `STATUS_RESET_MS` after it was last set
 * (`design/native/parent-settings-native.md` § 5). Setting it again, even
 * to the same value, restarts the clock and bumps `seq`, so a repeat tap
 * gets its full 2.4 s and its line re-announces. The timer dies with the
 * screen.
 *
 * `useLifetime`: the screen's abort signal, aborted on unmount. Network
 * calls take it; a result that arrives after Done is ignored.
 */
import { STATUS_RESET_MS } from '@marian/core/parentSettings/cloudBackup'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface TransientStatus<T extends string> {
  value: T
  /** Bumped on every set: key the status line by it. */
  seq: number
  set: (value: T) => void
}

export function useTransientStatus<T extends string>(
  idle: T,
  resets: (value: T) => boolean,
): TransientStatus<T> {
  const [state, setState] = useState<{ value: T; seq: number }>({
    value: idle,
    seq: 0,
  })
  useEffect(() => {
    if (!resets(state.value)) return undefined
    const handle = setTimeout(
      () => setState((s) => (s === state ? { value: idle, seq: s.seq } : s)),
      STATUS_RESET_MS,
    )
    return () => clearTimeout(handle)
  }, [state, idle, resets])
  const set = useCallback(
    (value: T) => setState((s) => ({ value, seq: s.seq + 1 })),
    [],
  )
  return { value: state.value, seq: state.seq, set }
}

/** A getter for the screen's lifetime signal (aborted on unmount). */
export function useLifetime(): () => AbortSignal {
  const ref = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    ref.current = controller
    return () => controller.abort()
  }, [])
  return useCallback(() => {
    ref.current ??= new AbortController()
    return ref.current.signal
  }, [])
}
