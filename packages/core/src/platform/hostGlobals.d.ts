/**
 * The host globals `@marian/core` may use, and nothing more.
 *
 * Core's tsconfig has no DOM lib, so a browser API in core is a compile
 * error. The globals below are the exceptions: both hosts (browsers and
 * React Native / Hermes) provide them. Declared minimally, only with the
 * members core actually calls.
 *
 * Only this file's own tsconfig (`packages/core/tsconfig.json`) sees it.
 * When the web app or the API compiles core, the DOM / Node typings
 * supply the full versions instead.
 *
 * Before adding a global here, check React Native provides it.
 */

interface Console {
  log(...data: unknown[]): void
  info(...data: unknown[]): void
  warn(...data: unknown[]): void
  error(...data: unknown[]): void
  debug(...data: unknown[]): void
}
declare const console: Console

declare function setTimeout(handler: () => void, timeout?: number): number
declare function clearTimeout(handle: number | undefined): void

interface AbortSignal {
  readonly aborted: boolean
}
declare class AbortController {
  readonly signal: AbortSignal
  abort(): void
}

interface Response {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}
interface RequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}
declare function fetch(input: string, init?: RequestInit): Promise<Response>
