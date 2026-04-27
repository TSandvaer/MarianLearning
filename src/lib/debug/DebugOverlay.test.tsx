import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DebugOverlay from './DebugOverlay'
import { isDebugEnabled } from './isDebugEnabled'
import {
  _resetForTests,
  recordAudioCtxEvent,
  recordGateState,
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
      recordSpeakAttempt('Hi! I am Melody.', 'queued')
    })
    expect(screen.getByTestId('debug-overlay-speak')).toHaveTextContent(
      'queued: "Hi! I am Melody."',
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
})
