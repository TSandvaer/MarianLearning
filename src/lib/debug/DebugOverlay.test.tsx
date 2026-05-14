import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DebugOverlay from './DebugOverlay'
import { buildStateExportPayload } from './stateExport'
import { isDebugEnabled } from './isDebugEnabled'
import {
  _resetForTests,
  recordAudioCtxEvent,
  recordGateState,
  recordRawTapEvent,
  recordSpeakAttempt,
  recordSpeakStatus,
  recordTap,
} from './debugBus'

describe('isDebugEnabled', () => {
  it('returns true when ?debug=1 is in the URL', () => {
    const original = window.location.search
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '?debug=1' },
    })
    expect(isDebugEnabled()).toBe(true)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: original },
    })
  })

  it('returns false when ?debug=1 is absent', () => {
    const original = window.location.search
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '' },
    })
    expect(isDebugEnabled()).toBe(false)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: original },
    })
  })

  it('returns false when debug has any other value', () => {
    const original = window.location.search
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '?debug=true' },
    })
    expect(isDebugEnabled()).toBe(false)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: original },
    })
  })
})

describe('DebugOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetForTests()
  })

  it('mounts with gate + audio-ctx + speak + tap rows', () => {
    render(<DebugOverlay />)
    expect(screen.getByTestId('debug-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('debug-overlay-gate')).toBeInTheDocument()
    expect(screen.getByTestId('debug-overlay-audio-ctx')).toBeInTheDocument()
    expect(
      screen.getByTestId('debug-overlay-audio-ctx-events'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('debug-overlay-speak')).toBeInTheDocument()
    expect(screen.getByTestId('debug-overlay-taps')).toBeInTheDocument()
  })

  it('reflects audio-context state pushes and shows recent events newest-first', () => {
    render(<DebugOverlay />)
    expect(screen.getByTestId('debug-overlay-audio-ctx')).toHaveTextContent(
      '(no probe)',
    )

    act(() => {
      recordAudioCtxEvent({
        timestamp: 1,
        ctxState: 'running',
        cause: 'init',
      })
    })
    expect(screen.getByTestId('debug-overlay-audio-ctx')).toHaveTextContent(
      'running',
    )

    act(() => {
      recordAudioCtxEvent({
        timestamp: 2,
        ctxState: 'suspended',
        cause: 'statechange',
      })
      recordAudioCtxEvent({
        timestamp: 3,
        ctxState: 'suspended',
        cause: 'tap',
      })
    })

    expect(screen.getByTestId('debug-overlay-audio-ctx')).toHaveTextContent(
      'suspended',
    )
    const events = screen.getAllByTestId('debug-overlay-audio-ctx-event')
    // Newest-first: tap (3), statechange (2), init (1).
    expect(events[0]).toHaveTextContent('tap: suspended')
    expect(events[1]).toHaveTextContent('statechange: suspended')
    expect(events[2]).toHaveTextContent('init: running')
  })

  it('reflects gate-state pushes from the bus', () => {
    render(<DebugOverlay />)
    expect(screen.getByTestId('debug-overlay-gate')).toHaveTextContent(
      '(unmounted)',
    )

    act(() => {
      recordGateState('pending')
    })
    expect(screen.getByTestId('debug-overlay-gate')).toHaveTextContent(
      'pending',
    )

    act(() => {
      recordGateState('relock')
    })
    expect(screen.getByTestId('debug-overlay-gate')).toHaveTextContent('relock')
  })

  it('reflects speak attempts and status updates', () => {
    render(<DebugOverlay />)
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      '(none)',
    )

    act(() => {
      recordSpeakAttempt('Hi! I am Emma.', 'queued')
    })
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      'queued: "Hi! I am Emma."',
    )

    act(() => {
      recordSpeakStatus('started')
    })
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      'started:',
    )

    act(() => {
      recordSpeakStatus('errored', 'audio-busy')
    })
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      'errored:',
    )
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      'audio-busy',
    )
  })

  it('shows the most recent 5 tap events newest-first', () => {
    render(<DebugOverlay />)

    // Push 6 taps; only the most recent 5 should be visible.
    act(() => {
      recordTap('pointerdown', 'a')
      recordTap('touchend', 'b')
      recordTap('click', 'c')
      recordTap('pointerdown', 'd')
      recordTap('touchend', 'e')
      recordTap('click', 'f')
    })

    const taps = screen.getAllByTestId('debug-overlay-tap')
    expect(taps).toHaveLength(5)
    // Newest-first ordering: 'f' first, 'b' last.
    expect(taps[0]).toHaveTextContent('click → f')
    expect(taps[4]).toHaveTextContent('touchend → b')
  })

  it('shows the raw-events row with (none) when no raw events have been recorded', () => {
    render(<DebugOverlay />)
    const row = screen.getByTestId('debug-overlay-raw-events')
    expect(row).toBeInTheDocument()
    expect(row).toHaveTextContent('raw events (0)')
    expect(row).toHaveTextContent('(none)')
    expect(screen.queryAllByTestId('debug-overlay-raw-event')).toHaveLength(0)
  })

  it('renders a single raw event with its type and target', () => {
    render(<DebugOverlay />)
    act(() => {
      recordRawTapEvent('pointerdown', 'wake')
    })
    const events = screen.getAllByTestId('debug-overlay-raw-event')
    expect(events).toHaveLength(1)
    expect(events[0]).toHaveTextContent('pointerdown → wake')
    expect(screen.getByTestId('debug-overlay-raw-events')).toHaveTextContent(
      'raw events (1)',
    )
  })

  it('shows raw events newest-first and caps the displayed list at 8', () => {
    render(<DebugOverlay />)

    // Push 9 raw events; bus caps at MAX_RAW_EVENTS=8 so only the most
    // recent 8 should be visible. Render reverses for newest-first.
    act(() => {
      recordRawTapEvent('touchstart', 'a')
      recordRawTapEvent('touchend', 'b')
      recordRawTapEvent('pointerdown', 'c')
      recordRawTapEvent('click', 'd')
      recordRawTapEvent('touchstart', 'e')
      recordRawTapEvent('touchend', 'f')
      recordRawTapEvent('pointerdown', 'g')
      recordRawTapEvent('click', 'h')
      recordRawTapEvent('touchstart', 'i')
    })

    const events = screen.getAllByTestId('debug-overlay-raw-event')
    expect(events).toHaveLength(8)
    // Oldest ('a') was dropped by the bus. Newest ('i') renders first;
    // oldest surviving ('b') renders last.
    expect(events[0]).toHaveTextContent('touchstart → i')
    expect(events[7]).toHaveTextContent('touchend → b')
    expect(screen.getByTestId('debug-overlay-raw-events')).toHaveTextContent(
      'raw events (8)',
    )
  })

  it('truncates long speak text', () => {
    render(<DebugOverlay />)
    const long =
      'this is a very long greeting line that should be truncated by the overlay because nobody wants to read forty plus characters in a debug panel'
    act(() => {
      recordSpeakAttempt(long, 'queued')
    })
    const row = screen.getByTestId('debug-overlay-speak')
    // Truncated form ends with an ellipsis; full text never appears.
    expect(row).toHaveTextContent('…')
    expect(row).not.toHaveTextContent('debug panel')
  })

  it('renders aria-hidden so a screen reader never voices debug noise', () => {
    render(<DebugOverlay />)
    expect(screen.getByTestId('debug-overlay')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  describe('export log button', () => {
    it('only renders inside the debug overlay (which is itself ?debug=1-gated)', () => {
      // Sanity check: the export block is part of the overlay subtree, so
      // it inherits the App.tsx-level `?debug=1` mount guard. If the overlay
      // doesn't mount, neither does the button. This mirrors the
      // App.test.tsx coverage of the gating boundary.
      const { unmount } = render(<DebugOverlay />)
      expect(
        screen.getByTestId('debug-overlay-export-button'),
      ).toBeInTheDocument()
      unmount()
      // After unmount, no button anywhere.
      expect(
        screen.queryByTestId('debug-overlay-export-button'),
      ).not.toBeInTheDocument()
    })

    it('shows the live log entry count from the supplied reader', () => {
      render(
        <DebugOverlay
          readAudioCtxLogFn={() => [
            { timestamp: 1, ctxState: 'running', cause: 'init' },
            { timestamp: 2, ctxState: 'suspended', cause: 'statechange' },
          ]}
        />,
      )
      expect(screen.getByTestId('debug-overlay-export')).toHaveTextContent(
        'log entries: 2',
      )
    })

    it('reports zero entries when the buffer is empty / missing', () => {
      render(<DebugOverlay readAudioCtxLogFn={() => null} />)
      expect(screen.getByTestId('debug-overlay-export')).toHaveTextContent(
        'log entries: 0',
      )
    })

    it('reads from localStorage and writes the JSON payload to the clipboard on click', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      const writeClipboardFn = vi.fn().mockResolvedValue(undefined)
      const log = [
        { timestamp: 100, ctxState: 'running', cause: 'init' },
        {
          timestamp: 200,
          ctxState: 'suspended',
          cause: 'statechange',
        },
      ]

      render(
        <DebugOverlay
          readAudioCtxLogFn={() => log}
          writeClipboardFn={writeClipboardFn}
          nowFn={() => 1_700_000_000_000}
        />,
      )

      await user.click(screen.getByTestId('debug-overlay-export-button'))

      expect(writeClipboardFn).toHaveBeenCalledTimes(1)
      const payloadText = writeClipboardFn.mock.calls[0][0] as string
      const parsed = JSON.parse(payloadText)
      expect(parsed).toMatchObject({
        exportedAtMs: 1_700_000_000_000,
        storageKey: 'debug:audioCtxLog:v1',
        logEntryCount: 2,
        log,
      })
      expect(typeof parsed.userAgent).toBe('string')
      expect(typeof parsed.pageUrl).toBe('string')
      expect(typeof parsed.exportedAt).toBe('string')

      // Confirmation chip appears.
      await waitFor(() =>
        expect(
          screen.getByTestId('debug-overlay-export-confirm'),
        ).toHaveTextContent('Copied'),
      )
      // No fallback textarea on the success path.
      expect(
        screen.queryByTestId('debug-overlay-export-textarea'),
      ).not.toBeInTheDocument()
    })

    it('falls back to a readable textarea when clipboard rejects', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      const writeClipboardFn = vi
        .fn()
        .mockRejectedValue(new Error('NotAllowedError'))
      const log = [{ timestamp: 1, ctxState: 'suspended', cause: 'tap' }]

      render(
        <DebugOverlay
          readAudioCtxLogFn={() => log}
          writeClipboardFn={writeClipboardFn}
          nowFn={() => 1_700_000_000_000}
        />,
      )

      await user.click(screen.getByTestId('debug-overlay-export-button'))

      const textarea = await screen.findByTestId(
        'debug-overlay-export-textarea',
      )
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveAttribute('readonly')
      expect(textarea.tagName).toBe('TEXTAREA')

      const value = (textarea as HTMLTextAreaElement).value
      const parsed = JSON.parse(value)
      expect(parsed.logEntryCount).toBe(1)
      expect(parsed.log).toEqual(log)
      expect(parsed.storageKey).toBe('debug:audioCtxLog:v1')

      // Confirmation chip is NOT shown on the fallback path.
      expect(
        screen.queryByTestId('debug-overlay-export-confirm'),
      ).not.toBeInTheDocument()
    })

    it('falls back to the textarea when no clipboard API is available', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      // No writeClipboardFn prop AND no navigator.clipboard in jsdom by
      // default — exercises the "writer is null" branch.
      const originalClipboard = (
        navigator as unknown as { clipboard?: unknown }
      ).clipboard
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      })

      try {
        render(<DebugOverlay readAudioCtxLogFn={() => []} />)

        await user.click(screen.getByTestId('debug-overlay-export-button'))

        const textarea = await screen.findByTestId(
          'debug-overlay-export-textarea',
        )
        expect(textarea).toBeInTheDocument()
      } finally {
        if (originalClipboard === undefined) {
          delete (navigator as unknown as { clipboard?: unknown }).clipboard
        } else {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: originalClipboard,
          })
        }
      }
    })
  })

  describe('copy state button', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('renders the "Copy state" button in the overlay', () => {
      render(<DebugOverlay />)
      expect(
        screen.getByTestId('debug-overlay-copy-state-button'),
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('debug-overlay-copy-state-button'),
      ).toHaveTextContent('Copy state')
    })

    it('copies a JSON payload with progress + sessionHistory + deviceId on click', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()

      // Seed localStorage with known values.
      const progressBlob = {
        schemaVersion: 1,
        skillLevels: { 'cvc-words': 'practicing' },
        parentSettings: { crossDayEnforcement: false },
      }
      const sessionHistoryBlob = { schemaVersion: 2, sessionCount: 4 }
      localStorage.setItem(
        'marian-tutor:progress:v1',
        JSON.stringify(progressBlob),
      )
      localStorage.setItem(
        'marian-tutor.session-history.v1',
        JSON.stringify(sessionHistoryBlob),
      )
      localStorage.setItem('marian-tutor:device-id', 'test-device-uuid')

      const writeStateClipboardFn = vi.fn().mockResolvedValue(undefined)

      render(
        <DebugOverlay
          writeStateClipboardFn={writeStateClipboardFn}
          nowFn={() => 1_700_000_000_000}
        />,
      )

      await user.click(screen.getByTestId('debug-overlay-copy-state-button'))

      expect(writeStateClipboardFn).toHaveBeenCalledTimes(1)
      const payloadText = writeStateClipboardFn.mock.calls[0][0] as string
      const parsed = JSON.parse(payloadText)

      // Shape assertions — every field must be present and typed correctly.
      expect(typeof parsed.exportedAt).toBe('string')
      expect(typeof parsed.userAgent).toBe('string')
      expect(typeof parsed.pageUrl).toBe('string')
      expect(parsed.progress).toEqual(progressBlob)
      expect(parsed.sessionHistory).toEqual(sessionHistoryBlob)
      expect(parsed.deviceId).toBe('test-device-uuid')
    })

    it('flips button label to "Copied!" on success and resets after timeout', async () => {
      // Outer beforeEach already called vi.useFakeTimers(). Use real timers
      // here so the clipboard promise + React state updates flush naturally
      // via microtasks. Verify label change; then fake-advance to fire revert.
      // Because we restore with vi.useRealTimers() at the end of the outer
      // afterEach, we just need to use real timers for the async portion and
      // spy on the revert with a real waitFor.
      vi.useRealTimers()
      const user = userEvent.setup()
      const writeStateClipboardFn = vi.fn().mockResolvedValue(undefined)

      render(
        <DebugOverlay
          writeStateClipboardFn={writeStateClipboardFn}
          nowFn={() => 0}
        />,
      )

      await user.click(screen.getByTestId('debug-overlay-copy-state-button'))

      // Clipboard resolved — button should flip to "Copied!".
      await waitFor(() =>
        expect(
          screen.getByTestId('debug-overlay-copy-state-button'),
        ).toHaveTextContent('Copied!'),
      )

      // Wait for the 2000 ms revert. Real timers are in effect so this will
      // actually wait — capped with a generous timeout so CI is stable.
      await waitFor(
        () =>
          expect(
            screen.getByTestId('debug-overlay-copy-state-button'),
          ).toHaveTextContent('Copy state'),
        { timeout: 3000 },
      )
    })

    it('exports null for missing progress / sessionHistory keys', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      // localStorage is empty (beforeEach cleared it).
      const writeStateClipboardFn = vi.fn().mockResolvedValue(undefined)

      render(
        <DebugOverlay
          writeStateClipboardFn={writeStateClipboardFn}
          nowFn={() => 0}
        />,
      )

      await user.click(screen.getByTestId('debug-overlay-copy-state-button'))

      expect(writeStateClipboardFn).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(
        writeStateClipboardFn.mock.calls[0][0] as string,
      )
      expect(parsed.progress).toBeNull()
      expect(parsed.sessionHistory).toBeNull()
      expect(parsed.deviceId).toBeNull()
    })
  })

  describe('buildStateExportPayload', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('returns the correct shape with all three keys populated', () => {
      const progressBlob = { schemaVersion: 1 }
      localStorage.setItem(
        'marian-tutor:progress:v1',
        JSON.stringify(progressBlob),
      )
      localStorage.setItem('marian-tutor.session-history.v1', '{"count":1}')
      localStorage.setItem('marian-tutor:device-id', 'abc-123')

      const payload = buildStateExportPayload(1_700_000_000_000)

      expect(payload.exportedAt).toBe(new Date(1_700_000_000_000).toISOString())
      expect(payload.progress).toEqual(progressBlob)
      expect(payload.sessionHistory).toEqual({ count: 1 })
      expect(payload.deviceId).toBe('abc-123')
    })

    it('returns null for progress and sessionHistory when keys are absent', () => {
      const payload = buildStateExportPayload(0)
      expect(payload.progress).toBeNull()
      expect(payload.sessionHistory).toBeNull()
      expect(payload.deviceId).toBeNull()
    })
  })
})
