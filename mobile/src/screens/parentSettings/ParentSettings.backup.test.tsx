/**
 * Native Parent Settings: Backup (Copy / Share…) and the device-ID copy
 * and Push now statuses (`design/native/parent-settings-native.md`
 * §§ 3–5): JSON built at tap time, 2.4 s from the latest tap, late
 * results ignored after unmount.
 */
import type { PushResult } from '@marian/core/progress'
import { defaultProgress } from '@marian/core/progress'
import { fireEvent, screen } from '@testing-library/react-native'
import {
  advance,
  deferred,
  DEVICE_ID,
  fakeDeps,
  flat,
  flushPromises,
  mount,
} from '../../../test/parentSettingsHarness'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

const status = (id: string) => screen.queryByTestId(id)?.props.children

describe('Backup', () => {
  it('Copy writes the versioned JSON, then "Copied to clipboard." clears after 2.4 s', async () => {
    const h = await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-backup-copy'))
    await flushPromises()
    const json = JSON.parse(String(h.mocks.writeClipboard.mock.calls[0]![0]))
    expect(json).toMatchObject({
      kind: 'marian-tutor.backup',
      version: 1,
      sessionHistory: { sessionCount: 5 },
    })
    expect(Object.keys(json)).toEqual([
      'kind',
      'version',
      'exportedAtISO',
      'progress',
      'sessionHistory',
    ])
    expect(status('parent-settings-backup-status')).toBe('Copied to clipboard.')
    await advance(2399)
    expect(status('parent-settings-backup-status')).toBe('Copied to clipboard.')
    await advance(1)
    expect(status('parent-settings-backup-status')).toBeUndefined()
  })

  it('a second Copy 1 s after the first keeps the line until 2.4 s after the second', async () => {
    await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-backup-copy'))
    await flushPromises()
    await advance(1000)
    await fireEvent.press(screen.getByTestId('parent-settings-backup-copy'))
    await flushPromises()
    await advance(2399)
    expect(status('parent-settings-backup-status')).toBe('Copied to clipboard.')
    await advance(1)
    expect(status('parent-settings-backup-status')).toBeUndefined()
  })

  it('a refused copy points at Share', async () => {
    const fake = fakeDeps()
    fake.mocks.writeClipboard.mockRejectedValueOnce(new Error('denied'))
    await mount(fake)
    await fireEvent.press(screen.getByTestId('parent-settings-backup-copy'))
    await flushPromises()
    expect(status('parent-settings-backup-status')).toBe(
      "Couldn't copy — use Share instead.",
    )
  })

  it('Share… opens the sheet with the same JSON; a dismissed sheet shows nothing', async () => {
    const h = await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-backup-share'))
    await flushPromises()
    expect(h.mocks.share).toHaveBeenCalledTimes(1)
    const [text] = h.mocks.share.mock.calls[0]!
    expect(JSON.parse(String(text)).kind).toBe('marian-tutor.backup')
    expect(screen.queryByTestId('parent-settings-backup-status')).toBeNull()
  })

  it('a sheet that fails to open says so', async () => {
    const fake = fakeDeps()
    fake.mocks.share.mockRejectedValueOnce(new Error('no sheet'))
    await mount(fake)
    await fireEvent.press(screen.getByTestId('parent-settings-backup-share'))
    await flushPromises()
    expect(status('parent-settings-backup-status')).toBe("Couldn't share.")
  })
})

describe('Device ID', () => {
  it('shows the stored ID on one unscaled line, copies it, and the line clears', async () => {
    const h = await mount()
    const id = screen.getByTestId('parent-settings-cloud-device-id')
    expect(id.props.children).toBe(DEVICE_ID)
    expect(id.props).toMatchObject({
      selectable: true,
      allowFontScaling: false,
      numberOfLines: 1,
    })
    await fireEvent.press(
      screen.getByTestId('parent-settings-cloud-copy-device-id'),
    )
    await flushPromises()
    expect(h.mocks.writeClipboard).toHaveBeenCalledWith(DEVICE_ID)
    expect(status('parent-settings-cloud-device-id-status')).toBe(
      'Copied to clipboard.',
    )
    await advance(2400)
    expect(status('parent-settings-cloud-device-id-status')).toBeUndefined()
  })
})

describe('Last synced and Push now', () => {
  it('"Never" before any session', async () => {
    await mount()
    expect(status('parent-settings-cloud-last-synced')).toBe('Never')
  })

  it('shows a played session in local time, not the ISO string', async () => {
    const doc = defaultProgress()
    doc.profile.lastPlayedISO = '2026-10-11T12:32:00.000Z'
    await mount(fakeDeps(doc))
    const shown = String(status('parent-settings-cloud-last-synced'))
    expect(shown).not.toBe('2026-10-11T12:32:00.000Z')
    expect(shown).toContain('2026')
  })

  it('"Sending…" on a disabled button, then "Synced." on the right for 2.4 s', async () => {
    const fake = fakeDeps()
    const push = deferred<PushResult>()
    fake.mocks.pushNow.mockReturnValueOnce(push.promise)
    await mount(fake)
    await fireEvent.press(screen.getByTestId('parent-settings-cloud-push-now'))
    const button = screen.getByTestId('parent-settings-cloud-push-now')
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })
    expect(screen.getByText('Sending…')).toBeOnTheScreen()
    expect(flat(button.props.style).minWidth).toBe(112)
    const signal = fake.mocks.pushNow.mock.calls[0]![1]
    expect(signal.aborted).toBe(false)
    push.resolve('sent')
    await flushPromises()
    const line = screen.getByTestId('parent-settings-cloud-push-status')
    expect(line.props.children).toBe('Synced.')
    expect(flat(line.props.style).textAlign).toBe('right')
    await advance(2400)
    expect(screen.queryByTestId('parent-settings-cloud-push-status')).toBeNull()
  })

  it.each<[PushResult | 'reject', string]>([
    ['skipped', "Cloud sync isn't configured."],
    ['failed', "Couldn't reach the server."],
    ['reject', "Couldn't reach the server."],
  ])('push %s → %s', async (result, text) => {
    const fake = fakeDeps()
    if (result === 'reject') {
      fake.mocks.pushNow.mockRejectedValueOnce(new Error('x'))
    } else fake.mocks.pushNow.mockResolvedValueOnce(result)
    await mount(fake)
    await fireEvent.press(screen.getByTestId('parent-settings-cloud-push-now'))
    await flushPromises()
    expect(status('parent-settings-cloud-push-status')).toBe(text)
  })

  it('leaving mid-push aborts the request and ignores its result', async () => {
    const fake = fakeDeps()
    const push = deferred<PushResult>()
    fake.mocks.pushNow.mockReturnValueOnce(push.promise)
    const h = await mount(fake)
    await fireEvent.press(screen.getByTestId('parent-settings-cloud-push-now'))
    const signal = fake.mocks.pushNow.mock.calls[0]![1]
    await h.unmount()
    expect(signal.aborted).toBe(true)
    push.resolve('sent')
    await flushPromises()
    await advance(3000)
  })
})
