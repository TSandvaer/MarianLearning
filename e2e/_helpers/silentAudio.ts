/**
 * Silent e2e audio — local Playwright runs must not play Emma out loud.
 *
 * Two layers, both off when `E2E_AUDIBLE=1` (for when you want to listen):
 *
 *   1. Chromium: `--mute-audio` (see `chromiumMuteArgs` below, wired in
 *      `playwright.config.ts`).
 *   2. Every browser (WebKit has no mute flag): a context init script that
 *      silences OUTPUT without touching timing or events —
 *        - WebAudio: `AudioNode.prototype.connect` routes any connection to
 *          a real-time context's destination through a per-context
 *          GainNode with gain 0 (which itself feeds the destination, so the
 *          graph still renders and `currentTime` / `onended` advance as
 *          before).
 *        - HTML5 media: `muted` is forced true before every `play()`, and the
 *          `muted` setter cannot turn it back off. Neither Playwright
 *          Chromium nor WebKit gates unmuted `play()` on a gesture (probed
 *          with a silent clip, 1.59.1), so muting changes no play/reject
 *          outcome.
 *      Howler `play`/`end` events, durations and the caption walks run
 *      exactly as before; only the speaker output is zero.
 *
 * Why an instrumentation hook and not a fixture: all 68 specs import `test`
 * straight from `@playwright/test`, so there is no shared fixture to hang
 * an `addInitScript` on. Playwright re-loads `playwright.config.ts` in every
 * worker, and the config calls `installSilentAudio()`, which registers a
 * listener on the `playwright-core` client instrumentation (the same seam
 * Playwright's own trace recorder uses) and adds the init script to every
 * new BrowserContext before any page exists. `_instrumentation` is
 * internal: if a Playwright upgrade drops it we warn, and
 * `e2e/silent-audio.spec.ts` fails, so the suite cannot go loud silently.
 *
 * The page exposes `window.__e2eSilentAudio` for that guard spec.
 */

import { createRequire } from 'node:module'
import type { BrowserContext } from '@playwright/test'

export const E2E_AUDIBLE = process.env.E2E_AUDIBLE === '1'

/** Chromium launch args: muted unless E2E_AUDIBLE=1. */
export const chromiumMuteArgs: string[] = E2E_AUDIBLE ? [] : ['--mute-audio']

/** Shape of `window.__e2eSilentAudio` (read by the guard spec). */
export interface SilentAudioProbe {
  /** The zero-gain node per real-time AudioContext. */
  gains: GainNode[]
  /** Connections re-routed from a destination to a zero-gain node. */
  routed: number
  /** Media elements `play()` was called on. */
  media: HTMLMediaElement[]
}

/** Runs in the page, before any app script. */
function silenceAudio(): void {
  const w = window as Window & { __e2eSilentAudio?: SilentAudioProbe }
  if (w.__e2eSilentAudio) return
  const probe: SilentAudioProbe = { gains: [], routed: 0, media: [] }
  w.__e2eSilentAudio = probe

  if (typeof AudioNode !== 'undefined') {
    const connect = AudioNode.prototype.connect as (
      this: AudioNode,
      ...args: unknown[]
    ) => unknown
    const disconnect = AudioNode.prototype.disconnect as (
      this: AudioNode,
      ...args: unknown[]
    ) => unknown
    const zero = new WeakMap<BaseAudioContext, GainNode>()
    const isLiveDestination = (n: unknown): n is AudioDestinationNode =>
      typeof AudioDestinationNode !== 'undefined' &&
      n instanceof AudioDestinationNode &&
      !(
        typeof OfflineAudioContext !== 'undefined' &&
        n.context instanceof OfflineAudioContext
      )
    const zeroGainFor = (dest: AudioDestinationNode): GainNode => {
      let g = zero.get(dest.context)
      if (!g) {
        g = dest.context.createGain()
        g.gain.value = 0
        connect.call(g, dest)
        zero.set(dest.context, g)
        probe.gains.push(g)
      }
      return g
    }
    AudioNode.prototype.connect = function (
      this: AudioNode,
      dest: unknown,
      ...rest: unknown[]
    ) {
      if (isLiveDestination(dest)) {
        connect.call(this, zeroGainFor(dest), ...rest)
        probe.routed += 1
        return dest // connect() returns its destination node
      }
      return connect.call(this, dest, ...rest)
    } as typeof AudioNode.prototype.connect
    AudioNode.prototype.disconnect = function (
      this: AudioNode,
      ...args: unknown[]
    ) {
      if (isLiveDestination(args[0])) {
        return disconnect.call(this, zeroGainFor(args[0]), ...args.slice(1))
      }
      return disconnect.call(this, ...args)
    } as typeof AudioNode.prototype.disconnect
  }

  if (typeof HTMLMediaElement !== 'undefined') {
    const proto = HTMLMediaElement.prototype
    const mutedDesc = Object.getOwnPropertyDescriptor(proto, 'muted')
    if (mutedDesc?.set && mutedDesc.get) {
      const setMuted = mutedDesc.set
      Object.defineProperty(proto, 'muted', {
        ...mutedDesc,
        set(this: HTMLMediaElement) {
          setMuted.call(this, true)
        },
      })
      const play = proto.play
      proto.play = function (this: HTMLMediaElement) {
        setMuted.call(this, true)
        if (!probe.media.includes(this)) probe.media.push(this)
        return play.call(this)
      }
    }
  }
}

interface ContextListener {
  runAfterCreateBrowserContext(context: BrowserContext): Promise<void>
}
interface Instrumented {
  _instrumentation?: { addListener(l: ContextListener): void }
}

let installed = false

/** Add the silencing init script to every BrowserContext this process
 *  creates. Called from `playwright.config.ts`; no-op with E2E_AUDIBLE=1. */
export function installSilentAudio(): void {
  if (E2E_AUDIBLE || installed) return
  installed = true
  // The same `playwright-core` instance Playwright's `playwright` fixture
  // returns (it is a plain `require('playwright-core')`).
  const core = createRequire(import.meta.url)('playwright-core') as Instrumented
  if (!core._instrumentation) {
    console.warn(
      '[silentAudio] playwright-core has no _instrumentation; WebKit e2e audio will NOT be muted (e2e/silent-audio.spec.ts will fail).',
    )
    return
  }
  core._instrumentation.addListener({
    async runAfterCreateBrowserContext(context) {
      await context.addInitScript(silenceAudio)
    },
  })
}
