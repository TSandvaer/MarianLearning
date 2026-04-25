/**
 * Word-by-word boundary event hook for the Melody TTS pipeline.
 *
 * Two paths cover the matrix of Web Speech API behaviour we see in the wild:
 *
 *   1. Native: SpeechSynthesisUtterance.onboundary fires once per word with
 *      charIndex + charLength. Most desktop Chrome/Edge engines do this.
 *
 *   2. Fallback: iPad Safari (WebKit) is uneven — sometimes onboundary fires
 *      only on sentence boundaries, sometimes never. If we don't see a real
 *      onboundary within ~250ms of onstart, we synthesize word events from
 *      the utterance's text at a configurable WPM cadence.
 *
 *   3. Hybrid: occasionally onboundary fires for the first few words then
 *      goes silent. We track the last native event timestamp and rearm
 *      fallback if the gap exceeds threshold.
 *
 * The module owns per-utterance state in a WeakMap so multiple subscribers
 * share one set of engine handlers and no listeners leak.
 */

export interface BoundaryEvent {
  /** Zero-based word index within the utterance text. */
  wordIndex: number
  /** The actual word string (with attached punctuation). */
  word: string
  /** Character offset of the word's first character within the original text. */
  charIndex: number
}

export interface BoundarySubscribeOptions {
  /**
   * Words per minute used by the Safari fallback. Default 165 — slightly
   * slower than typical speech to match Melody's `rate: 0.9` in tts.ts.
   * Values <= 0 are clamped to the default.
   */
  wpm?: number
}

type Callback = (event: BoundaryEvent) => void

interface ParsedWord {
  word: string
  charIndex: number
}

/** Time we wait after onstart before deciding the engine is silent. */
const FALLBACK_ARM_MS = 250
/** If two consecutive native boundaries are more than this apart, assume the engine quit. */
const FALLBACK_RESUME_MS = 250

const DEFAULT_WPM = 165

interface Registry {
  parsed: ParsedWord[]
  callbacks: Set<Callback>
  /** Highest word index already delivered to subscribers. -1 if none. */
  delivered: number
  /** True once any handler (native or fallback) has been attached. */
  installed: boolean
  /** True once teardown has run; further work is a no-op. */
  disposed: boolean
  /**
   * Watchdog timer that re-arms fallback if no native onboundary arrives
   * within FALLBACK_RESUME_MS. Reset every time a native event fires.
   */
  watchdogTimer: ReturnType<typeof setTimeout> | null
  fallbackInterval: ReturnType<typeof setInterval> | null
  /** Effective ms-per-word for fallback. */
  fallbackPeriodMs: number
  /** Tear down all timers + handlers. Idempotent. */
  teardown: () => void
}

const registries = new WeakMap<SpeechSynthesisUtterance, Registry>()

/**
 * Tokenise an utterance into (word, charIndex) pairs. Whitespace splits;
 * punctuation stays attached to its word, matching the way real Web Speech
 * engines report boundaries.
 */
function parseWords(text: string): ParsedWord[] {
  const out: ParsedWord[] = []
  const re = /\S+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    out.push({ word: match[0], charIndex: match.index })
  }
  return out
}

/**
 * Find the parsed word matching a native boundary's charIndex. The engine
 * sometimes reports an offset slightly inside a word (e.g. start of trailing
 * punctuation) — we pick the word whose range contains charIndex, falling
 * back to nearest-by-start if nothing strictly contains it.
 */
function findWordIndex(parsed: ParsedWord[], charIndex: number): number {
  for (let i = 0; i < parsed.length; i++) {
    const start = parsed[i].charIndex
    const end = start + parsed[i].word.length
    if (charIndex >= start && charIndex < end) return i
  }
  // Nearest-start fallback: largest start <= charIndex.
  let best = -1
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].charIndex <= charIndex) best = i
    else break
  }
  return best
}

function fanOut(registry: Registry, event: BoundaryEvent): void {
  // Snapshot to avoid mutation-during-iteration if a callback unsubscribes.
  const callbacks = Array.from(registry.callbacks)
  for (const cb of callbacks) {
    try {
      cb(event)
    } catch (err) {
      // Don't let one bad subscriber poison the others. Log and move on.

      console.error('boundary subscriber threw', err)
    }
  }
}

function emitWord(registry: Registry, wordIndex: number): void {
  if (registry.disposed) return
  if (wordIndex <= registry.delivered) return
  if (wordIndex < 0 || wordIndex >= registry.parsed.length) return
  const parsed = registry.parsed[wordIndex]
  registry.delivered = wordIndex
  fanOut(registry, {
    wordIndex,
    word: parsed.word,
    charIndex: parsed.charIndex,
  })
}

function startFallback(registry: Registry): void {
  if (registry.disposed) return
  if (registry.fallbackInterval !== null) return
  if (registry.parsed.length === 0) return
  if (registry.delivered >= registry.parsed.length - 1) return

  // Fire the next undelivered word immediately so caption reveal does not
  // hang on whatever the previous gap was.
  emitWord(registry, registry.delivered + 1)

  if (registry.delivered >= registry.parsed.length - 1) return

  registry.fallbackInterval = setInterval(() => {
    if (registry.disposed) return
    const next = registry.delivered + 1
    emitWord(registry, next)
    if (registry.delivered >= registry.parsed.length - 1) {
      stopFallbackInterval(registry)
    }
  }, registry.fallbackPeriodMs)
}

function stopFallbackInterval(registry: Registry): void {
  if (registry.fallbackInterval !== null) {
    clearInterval(registry.fallbackInterval)
    registry.fallbackInterval = null
  }
}

function clearWatchdog(registry: Registry): void {
  if (registry.watchdogTimer !== null) {
    clearTimeout(registry.watchdogTimer)
    registry.watchdogTimer = null
  }
}

/**
 * Arm (or re-arm) the watchdog. If no native onboundary fires within the
 * window, kick off the fallback interval. Used both at onstart (initial
 * arming) and after every native onboundary (hybrid recovery).
 */
function armWatchdog(registry: Registry, ms: number): void {
  if (registry.disposed) return
  clearWatchdog(registry)
  registry.watchdogTimer = setTimeout(() => {
    registry.watchdogTimer = null
    if (registry.disposed) return
    startFallback(registry)
  }, ms)
}

function stopFallback(registry: Registry): void {
  clearWatchdog(registry)
  stopFallbackInterval(registry)
}

function clampWpm(wpm: number | undefined): number {
  if (typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm <= 0) {
    return DEFAULT_WPM
  }
  return wpm
}

function ensureRegistry(
  utterance: SpeechSynthesisUtterance,
  options: BoundarySubscribeOptions,
): Registry {
  const existing = registries.get(utterance)
  if (existing) return existing

  const wpm = clampWpm(options.wpm)
  // Floor rather than round so the cadence is never *slower* than requested
  // (off-by-one ms feels safer on the captioning side than off-by-one slow).
  const fallbackPeriodMs = Math.max(1, Math.floor(60_000 / wpm))

  const registry: Registry = {
    parsed: parseWords(utterance.text ?? ''),
    callbacks: new Set(),
    delivered: -1,
    installed: false,
    disposed: false,
    watchdogTimer: null,
    fallbackInterval: null,
    fallbackPeriodMs,
    teardown: () => {
      if (registry.disposed) return
      registry.disposed = true
      stopFallback(registry)
      registry.callbacks.clear()
      registries.delete(utterance)
    },
  }

  installHandlers(utterance, registry)
  registries.set(utterance, registry)
  return registry
}

/**
 * Wire onstart/onboundary/onend/onerror so they drive the registry. We
 * preserve any handler the caller (e.g. `speak()`) already attached and
 * invoke it after our logic. Setters set later by other code WILL clobber
 * us; callers must call `subscribeToBoundary` after their own wiring, or
 * use the SpeakOptions.onBoundary surface in tts.ts which sequences this
 * for them.
 */
function installHandlers(
  utterance: SpeechSynthesisUtterance,
  registry: Registry,
): void {
  if (registry.installed) return
  registry.installed = true

  const prevOnStart = utterance.onstart
  const prevOnBoundary = utterance.onboundary
  const prevOnEnd = utterance.onend
  const prevOnError = utterance.onerror

  utterance.onstart = function (this: SpeechSynthesisUtterance, ev) {
    if (!registry.disposed) {
      // Arm fallback after the initial grace window. Every native onboundary
      // that arrives will reset this same watchdog (hybrid recovery).
      armWatchdog(registry, FALLBACK_ARM_MS)
    }
    prevOnStart?.call(this, ev)
  }

  utterance.onboundary = function (this: SpeechSynthesisUtterance, ev) {
    if (!registry.disposed) {
      const evAny = ev as unknown as { name?: string; charIndex: number }
      // Engine vendors disagree on whether `name` is set; default to 'word'
      // when missing, which is the common case.
      const name = evAny.name ?? 'word'
      if (name === 'word') {
        // Engine just talked. Stop the fallback interval — the engine drives
        // cadence — but keep the watchdog so we re-arm if it goes silent.
        stopFallbackInterval(registry)
        armWatchdog(registry, FALLBACK_RESUME_MS)
        const idx = findWordIndex(registry.parsed, evAny.charIndex)
        if (idx >= 0) emitWord(registry, idx)
      }
    }
    prevOnBoundary?.call(this, ev)
  }

  utterance.onend = function (this: SpeechSynthesisUtterance, ev) {
    registry.teardown()
    prevOnEnd?.call(this, ev)
  }

  utterance.onerror = function (
    this: SpeechSynthesisUtterance,
    ev: SpeechSynthesisErrorEvent,
  ) {
    registry.teardown()
    prevOnError?.call(this, ev)
  }
}

/**
 * Subscribe to per-word boundary events for a `SpeechSynthesisUtterance`.
 *
 * The first subscription per utterance attaches the engine handlers; later
 * subscriptions just join the fan-out. Returning the unsubscribe handle
 * also tears down handlers if it's the last subscriber — so if a caller
 * subscribes and then never speaks the utterance, no listeners leak.
 *
 * Use this **after** any other handler wiring (e.g. inside `speak()` after
 * `onend`/`onerror` are set) so we can chain rather than be clobbered.
 */
export function subscribeToBoundary(
  utterance: SpeechSynthesisUtterance,
  callback: Callback,
  options: BoundarySubscribeOptions = {},
): () => void {
  const registry = ensureRegistry(utterance, options)
  registry.callbacks.add(callback)

  let unsubscribed = false
  return () => {
    if (unsubscribed) return
    unsubscribed = true
    registry.callbacks.delete(callback)
    if (registry.callbacks.size === 0 && !registry.disposed) {
      // No subscribers left. Stop driving fallback timers; leave engine
      // handlers in place so any caller who Set onend later still works.
      stopFallback(registry)
      registry.disposed = true
      registries.delete(utterance)
    }
  }
}
