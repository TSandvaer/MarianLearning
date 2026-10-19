/**
 * Parent Settings with learner profiles (`design/native/learner-profiles.md`
 * § 3, ACs 34–37), on core's real learner list over an in-memory store:
 * selecting a learner (the sections re-read and are bound to them, X2),
 * adding one (names, pictures, lands, D5's naming step, § 3.3's lines),
 * Where to start with its alert, Remove with Dave's warning, the copy that
 * names the learner, and what Done reports.
 */
import {
  setCloudSyncAuthSecretSource,
  setCloudSyncSuccessListener,
  setKeyValueStore,
} from '@marian/core'
import {
  LEARNERS_STORAGE_KEY,
  activeLearner,
  boundLearner,
  ensureLearnerList,
  installedLearnerList,
  recordLastSyncForSyncId,
  resetLearnersForTests,
  type AddFromBackupOutcome,
  type LearnerEntry,
} from '@marian/core/learners'
import { getKeyValueStore } from '@marian/core/platform/keyValueStore'
import {
  DEFAULT_PARENT_SETTINGS,
  defaultProgress,
  type Progress,
} from '@marian/core/progress'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { flushPromises, PHONE } from '../../../test/parentSettingsHarness'
import { ParentSettings } from './ParentSettings'

const MARIAN_ID = '5f3c2a10-8b1e-4c2d-9a7f-1e2d3c4b5a69'
const SAM_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const CODE = '0b8f3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

function entry(
  id: string,
  name: string,
  avatarId: LearnerEntry['avatarId'],
  legacySlot: boolean,
): LearnerEntry {
  return {
    id,
    name,
    avatarId,
    language: 'en',
    legacySlot,
    start: legacySlot ? 'legacy-default' : { math: 1, wordSong: 1 },
    createdAtISO: '2026-10-19T00:00:00.000Z',
  }
}

const MARIAN = entry(MARIAN_ID, 'Marian', 'fox', true)
const SAM = entry(SAM_ID, 'Sam', 'owl', false)

let raw: Map<string, string>

/** Install a device holding `learners` (the first playing), with docs. */
function device(
  learners: readonly LearnerEntry[] = [MARIAN, SAM],
  docs: Partial<Record<string, Progress>> = {},
): void {
  raw = new Map()
  raw.set(
    LEARNERS_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      learners,
      activeLearnerId: learners[0]!.id,
    }),
  )
  setKeyValueStore({
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => {
      raw.set(k, v)
    },
    removeItem: (k) => {
      raw.delete(k)
    },
    keys: () => [...raw.keys()],
  })
  ensureLearnerList()
  for (const l of learners) {
    const doc = docs[l.id]
    if (doc) boundLearner(l).save(doc)
  }
}

function snapshot(): Map<string, string> {
  return new Map(raw)
}

/** The keys whose bytes changed (or appeared, or went) since `before`. */
function changedKeys(before: Map<string, string>): string[] {
  const keys = new Set([...before.keys(), ...raw.keys()])
  return [...keys].filter((k) => before.get(k) !== raw.get(k)).sort()
}

let alert: jest.SpyInstance
function alertButtons(): AlertButton[] {
  return alert.mock.calls.at(-1)![2] as AlertButton[]
}
async function answerAlert(label: string): Promise<void> {
  await act(async () => {
    alertButtons()
      .find((b) => b.text === label)!
      .onPress?.()
  })
}

async function mount(
  props: Partial<Parameters<typeof ParentSettings>[0]> = {},
) {
  const onExit = jest.fn()
  await render(
    <ParentSettings
      layout={PHONE}
      onExit={onExit}
      releaseAudio={() => {}}
      {...props}
    />,
  )
  return { onExit }
}

const switchValue = (id: string) =>
  screen.getByTestId(`parent-settings-switch-${id}`, {
    includeHiddenElements: true,
  }).props.value as boolean

beforeEach(() => {
  jest.useFakeTimers()
  resetLearnersForTests()
  setCloudSyncAuthSecretSource(() => undefined)
  setCloudSyncSuccessListener(null)
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  ;(globalThis.fetch as jest.Mock).mockReset()
  ;(globalThis.fetch as jest.Mock).mockImplementation(() =>
    Promise.reject(new TypeError('offline')),
  )
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('AC 34: selecting a learner', () => {
  it('lists the learners in add order; a row tap moves "Playing now" and every section re-reads', async () => {
    device([MARIAN, SAM], {
      [SAM_ID]: {
        ...defaultProgress('Sam'),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          showLevelToMarian: false,
        },
      },
    })
    await mount()
    expect(
      screen
        .getAllByTestId(/^ps-learner-row-/)
        .map((r) => String(r.props.testID)),
    ).toEqual([`ps-learner-row-${MARIAN_ID}`, `ps-learner-row-${SAM_ID}`])
    expect(
      screen.getByTestId(`ps-learner-playing-${MARIAN_ID}`),
    ).toHaveTextContent('Playing now')
    expect(switchValue('showLevelToMarian')).toBe(true)

    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    expect(activeLearner()?.id).toBe(SAM_ID)
    expect(screen.queryByTestId(`ps-learner-playing-${MARIAN_ID}`)).toBeNull()
    expect(screen.getByTestId(`ps-learner-playing-${SAM_ID}`)).toBeOnTheScreen()
    expect(switchValue('showLevelToMarian')).toBe(false)
    expect(screen.getByTestId('ps-learner-name').props.value).toBe('Sam')
  })

  it('X2: a toggle after the row tap changes only B’s keys', async () => {
    device([MARIAN, SAM], {
      [MARIAN_ID]: defaultProgress('Marian'),
      [SAM_ID]: {
        ...defaultProgress('Sam'),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          showLevelToMarian: false,
        },
      },
    })
    await mount()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    const before = snapshot()
    await fireEvent.press(
      screen.getByTestId('parent-settings-toggle-autoPromote'),
    )
    expect(changedKeys(before)).toEqual([`marian-tutor:progress:v1:${SAM_ID}`])
    const sam = JSON.parse(raw.get(`marian-tutor:progress:v1:${SAM_ID}`)!)
    expect(sam.parentSettings.autoPromote).toBe(false)
    // Saved from Sam's copy, never Marian's.
    expect(sam.parentSettings.showLevelToMarian).toBe(false)
    expect(sam.profile.childName).toBe('Sam')
  })

  it('X2: Push now sends B’s doc to B’s sync ID', async () => {
    device([MARIAN, SAM], {
      [MARIAN_ID]: defaultProgress('Marian'),
      [SAM_ID]: defaultProgress('Sam'),
    })
    setCloudSyncAuthSecretSource(() => 'secret')
    // As native boot wires it (native.ts).
    setCloudSyncSuccessListener((syncId) => recordLastSyncForSyncId(syncId))
    ;(globalThis.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({}) }),
    )
    await mount()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    await fireEvent.press(screen.getByTestId('parent-settings-cloud-push-now'))
    await flushPromises()
    const samSyncId = raw.get(`marian-tutor:device-id:${SAM_ID}`)
    expect(samSyncId).toMatch(/^[0-9a-f-]{36}$/)
    expect(samSyncId).not.toBe(raw.get('marian-tutor:device-id'))
    expect(
      screen.getByTestId('parent-settings-cloud-device-id').props.children,
    ).toBe(samSyncId)
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls.at(-1)!
    const body = JSON.parse(String(init.body))
    expect(body.deviceId).toBe(samSyncId)
    expect(body.blob.profile.childName).toBe('Sam')
    expect(body.blob.learner).toMatchObject({
      syncId: samSyncId,
      avatarId: 'owl',
      language: 'en',
    })
    // Last synced is Sam's, not Marian's.
    expect(raw.has(`marian-tutor:last-sync:${SAM_ID}`)).toBe(true)
    expect(raw.has('marian-tutor:last-sync')).toBe(false)
  })

  it('an in-flight Push now is aborted by a row tap', async () => {
    device()
    setCloudSyncAuthSecretSource(() => 'secret')
    let signal: AbortSignal | undefined
    ;(globalThis.fetch as jest.Mock).mockImplementation(
      (_url: string, init: { signal?: AbortSignal }) => {
        signal = init.signal
        return new Promise(() => {})
      },
    )
    await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-cloud-push-now'))
    expect(signal?.aborted).toBe(false)
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    expect(signal?.aborted).toBe(true)
  })

  it('an in-flight Restore is aborted by a row tap', async () => {
    device()
    setCloudSyncAuthSecretSource(() => 'secret')
    let signal: AbortSignal | undefined
    ;(globalThis.fetch as jest.Mock).mockImplementation(
      (_url: string, init: { signal?: AbortSignal }) => {
        signal = init.signal
        return new Promise(() => {})
      },
    )
    await mount()
    await fireEvent.changeText(
      screen.getByTestId('parent-settings-cloud-restore-input'),
      CODE,
    )
    await fireEvent.press(
      screen.getByTestId('parent-settings-cloud-restore-submit'),
    )
    await answerAlert('Restore')
    expect(signal?.aborted).toBe(false)
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    expect(signal?.aborted).toBe(true)
  })
})

describe('AC 35: adding a learner', () => {
  it('enforces 1–24 characters and unique pictures, offers the lands, and adds the new learner as the one playing', async () => {
    device()
    await mount()
    await fireEvent.press(screen.getByTestId('ps-learners-add'))
    expect(screen.getByTestId('ps-add-sheet')).toBeOnTheScreen()
    const submit = () => screen.getByTestId('ps-add-submit')
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true })
    await fireEvent.changeText(screen.getByTestId('ps-add-name'), '   ')
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true })
    expect(screen.getByTestId('ps-add-name').props.maxLength).toBe(24)
    // Fox and owl are taken; the first free one (lion) is preselected.
    for (const taken of ['fox', 'owl']) {
      expect(
        screen.getByTestId(`ps-add-picture-${taken}`).props.accessibilityState,
      ).toMatchObject({ disabled: true })
    }
    expect(
      screen.getByTestId('ps-add-picture-lion').props.accessibilityState,
    ).toMatchObject({ selected: true })
    // The lands: Number Garden 1–5, Word Song 1–8, land 1 by default.
    for (let n = 1; n <= 5; n++)
      expect(screen.getByTestId(`ps-add-land-math-${n}`)).toBeOnTheScreen()
    for (let n = 1; n <= 8; n++)
      expect(screen.getByTestId(`ps-add-land-word-song-${n}`)).toBeOnTheScreen()
    expect(screen.queryByTestId('ps-add-land-math-6')).toBeNull()
    expect(
      screen.getByTestId('ps-add-land-math-1').props.accessibilityState,
    ).toMatchObject({ selected: true })
    expect(screen.getByTestId('ps-add-land-math-3')).toHaveTextContent(
      'Land 3: Big numbers',
    )

    await fireEvent.changeText(screen.getByTestId('ps-add-name'), ' Ana ')
    await fireEvent.press(screen.getByTestId('ps-add-picture-frog'))
    await fireEvent.press(screen.getByTestId('ps-add-land-math-3'))
    expect(submit().props.accessibilityState).toMatchObject({ disabled: false })
    await fireEvent.press(submit())

    const list = installedLearnerList()!
    expect(list.learners).toHaveLength(3)
    const ana = list.learners[2]!
    expect(ana).toMatchObject({
      name: 'Ana',
      avatarId: 'frog',
      start: { math: 3, wordSong: 1 },
      legacySlot: false,
    })
    expect(list.activeLearnerId).toBe(ana.id)
    expect(screen.queryByTestId('ps-add-sheet')).toBeNull()
    expect(screen.getByTestId('ps-learners-status')).toHaveTextContent(
      'Added Ana.',
    )
    expect(screen.getByTestId(`ps-learner-playing-${ana.id}`)).toBeOnTheScreen()
  })

  it('hides both add buttons at 4 learners', async () => {
    device([
      MARIAN,
      SAM,
      entry('2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c', 'Ana', 'frog', false),
      entry('3c4d5e6f-7081-4b92-8c3d-4e5f6a7b8c9d', 'Leo', 'bear', false),
    ])
    await mount()
    expect(screen.queryByTestId('ps-learners-add')).toBeNull()
    expect(screen.queryByTestId('ps-learners-add-code')).toBeNull()
  })

  it('D5: with an unnamed learner 1, Add asks for their name first and writes both names', async () => {
    device([{ ...MARIAN, name: '' }])
    await mount()
    expect(
      screen.getByTestId(`ps-learner-name-${MARIAN_ID}`),
    ).toHaveTextContent('No name')
    await fireEvent.press(screen.getByTestId('ps-learners-add'))
    expect(screen.getByTestId('ps-add-first-name-step')).toHaveTextContent(
      /Name the first learner/,
    )
    await fireEvent.changeText(screen.getByTestId('ps-add-name'), 'Sam')
    expect(
      screen.getByTestId('ps-add-submit').props.accessibilityState,
    ).toMatchObject({ disabled: true })
    await fireEvent.changeText(screen.getByTestId('ps-add-first-name'), 'Mia')
    await fireEvent.press(screen.getByTestId('ps-add-submit'))
    const names = installedLearnerList()!.learners.map((l) => l.name)
    expect(names).toEqual(['Mia', 'Sam'])
  })

  it('D5: Add from a code asks for learner 1’s name first too', async () => {
    device([{ ...MARIAN, name: '' }])
    const add = jest.fn(
      async (): Promise<AddFromBackupOutcome> => ({ kind: 'not-found' }),
    )
    await mount({ addFromBackup: add })
    await fireEvent.press(screen.getByTestId('ps-learners-add-code'))
    expect(screen.getByTestId('ps-code-first-name-step')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByTestId('ps-code-input'), CODE)
    expect(
      screen.getByTestId('ps-code-submit').props.accessibilityState,
    ).toMatchObject({ disabled: true })
    await fireEvent.changeText(screen.getByTestId('ps-code-first-name'), 'Mia')
    await fireEvent.press(screen.getByTestId('ps-code-submit'))
    await flushPromises()
    expect(add).toHaveBeenCalledWith(CODE, expect.anything())
    expect(installedLearnerList()!.learners[0]!.name).toBe('Mia')
    // The code was refused, but the name stays written: the cards show it.
    await fireEvent.press(screen.getByTestId('ps-code-sheet-close'))
    expect(
      screen.getByTestId(`ps-learner-name-${MARIAN_ID}`),
    ).toHaveTextContent('Mia')
    expect(screen.getByTestId('ps-learner-name').props.value).toBe('Mia')
    await fireEvent.press(screen.getByTestId('ps-learners-add-code'))
    expect(screen.queryByTestId('ps-code-first-name-step')).toBeNull()
  })

  it.each<[string, AddFromBackupOutcome, string]>([
    [
      'the code is a learner here already',
      { kind: 'already-here', learner: SAM },
      "That's Sam, already on this device.",
    ],
    [
      'the record names another code',
      { kind: 'other-learner-record' },
      "That backup holds another learner's progress.",
    ],
    ['no record', { kind: 'not-found' }, 'No progress found for that code.'],
    [
      'the record fails the guard',
      { kind: 'rejected' },
      "That backup can't be opened on this version of the app.",
    ],
    [
      'a network error',
      { kind: 'error', reason: 'network-error' },
      'Restore failed (network-error).',
    ],
  ])('§ 3.3: %s → its line', async (_case, outcome, line) => {
    device()
    await mount({ addFromBackup: async () => outcome })
    await fireEvent.press(screen.getByTestId('ps-learners-add-code'))
    await fireEvent.changeText(screen.getByTestId('ps-code-input'), CODE)
    await fireEvent.press(screen.getByTestId('ps-code-submit'))
    await flushPromises()
    expect(screen.getByTestId('ps-code-status')).toHaveTextContent(line)
    expect(installedLearnerList()!.learners).toHaveLength(2)
  })

  it('§ 3.3: a record found → "Added <name>."; with an empty name, their Name field takes the focus', async () => {
    device()
    const added: LearnerEntry = entry(
      '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c',
      'Ana',
      'frog',
      false,
    )
    await mount({
      addFromBackup: async () => {
        // What core does on a found record: a new learner, playing.
        const list = installedLearnerList()!
        const { saveLearnerList } = jest.requireActual(
          '@marian/core/learners',
        ) as typeof import('@marian/core/learners')
        saveLearnerList({
          ...list,
          learners: [...list.learners, added],
          activeLearnerId: added.id,
        })
        return { kind: 'added', learner: added }
      },
    })
    await fireEvent.press(screen.getByTestId('ps-learners-add-code'))
    await fireEvent.changeText(screen.getByTestId('ps-code-input'), CODE)
    await fireEvent.press(screen.getByTestId('ps-code-submit'))
    await flushPromises()
    expect(screen.queryByTestId('ps-code-sheet')).toBeNull()
    expect(screen.getByTestId('ps-learners-status')).toHaveTextContent(
      'Added Ana.',
    )
    expect(
      screen.getByTestId(`ps-learner-playing-${added.id}`),
    ).toBeOnTheScreen()
  })
})

describe('AC 36: Where to start', () => {
  it('shows each world’s current land; another land asks first; Cancel writes nothing; Change moves the learner', async () => {
    device([MARIAN, SAM], { [MARIAN_ID]: defaultProgress('Marian') })
    await mount()
    // Marian's diagnostic: add-to-10 practicing (land 2), letter-sounds (land 1).
    expect(screen.getByTestId('ps-learner-start-math-land')).toHaveTextContent(
      'Land 2: Adding & taking away',
    )
    expect(
      screen.getByTestId('ps-learner-start-word-song-land'),
    ).toHaveTextContent('Land 1: Letters')

    await fireEvent.press(screen.getByTestId('ps-learner-start-math'))
    expect(screen.getByTestId('ps-start-sheet')).toBeOnTheScreen()
    const before = snapshot()
    await fireEvent.press(screen.getByTestId('ps-start-land-math-3'))
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0]![0]).toBe('Start Marian at Big numbers?')
    expect(alert.mock.calls[0]![1]).toBe(
      'Steps before this land count as learned. This land and the ones after it start again. Stars and streak stay.',
    )
    expect(alertButtons().map((b) => b.text)).toEqual(['Cancel', 'Change'])
    await answerAlert('Cancel')
    expect(changedKeys(before)).toEqual([])

    await answerAlert('Change')
    expect(changedKeys(before)).toEqual(
      [LEARNERS_STORAGE_KEY, 'marian-tutor:progress:v1'].sort(),
    )
    const doc = JSON.parse(raw.get('marian-tutor:progress:v1')!)
    expect(doc.skillLevels['sub-to-20']).toBe('mastered')
    expect(doc.skillLevels['two-digit-addsub-no-regroup']).toBe('intro')
    expect(installedLearnerList()!.learners[0]!.start).toMatchObject({
      math: 3,
    })
    expect(screen.queryByTestId('ps-start-sheet')).toBeNull()
    expect(screen.getByTestId('ps-learner-start-math-land')).toHaveTextContent(
      'Land 3: Big numbers',
    )
  })

  it('a toggle after a move keeps the move (the sections re-read the doc)', async () => {
    device([MARIAN, SAM], { [MARIAN_ID]: defaultProgress('Marian') })
    await mount()
    await fireEvent.press(screen.getByTestId('ps-learner-start-math'))
    await fireEvent.press(screen.getByTestId('ps-start-land-math-3'))
    await answerAlert('Change')
    await fireEvent.press(
      screen.getByTestId('parent-settings-toggle-autoPromote'),
    )
    const doc = JSON.parse(raw.get('marian-tutor:progress:v1')!)
    expect(doc.skillLevels['two-digit-addsub-no-regroup']).toBe('intro')
    expect(doc.parentSettings.autoPromote).toBe(false)
  })
})

describe('AC 37: Remove, copy and Done', () => {
  it('the Remove alert says what does not come back; Remove deletes that learner', async () => {
    device([MARIAN, SAM], { [SAM_ID]: defaultProgress('Sam') })
    await mount()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    await fireEvent.press(screen.getByTestId('ps-learner-remove'))
    expect(alert.mock.calls[0]![0]).toBe('Remove Sam?')
    expect(alert.mock.calls[0]![1]).toBe(
      'This deletes their progress on this device. Their backup code brings back their progress, but not their stars or streak: those are not in the backup and will not come back.',
    )
    expect(alertButtons().map((b) => [b.text, b.style])).toEqual([
      ['Cancel', 'cancel'],
      ['Remove', 'destructive'],
    ])
    await answerAlert('Remove')
    expect(installedLearnerList()!.learners.map((l) => l.id)).toEqual([
      MARIAN_ID,
    ])
    expect(raw.has(`marian-tutor:progress:v1:${SAM_ID}`)).toBe(false)
    // One learner left: no Remove.
    expect(screen.queryByTestId('ps-learner-remove')).toBeNull()
  })

  it('parent copy names the selected learner, with they/their', async () => {
    device()
    await mount()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    expect(screen.getByText('Show level to Sam')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Advance Sam to the next skill once they meet the mastery threshold.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/^Sam's progress is also saved to the cloud/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Backup code')).toBeOnTheScreen()
    // Only the Learners card still lists Marian; Sam's sections never do.
    for (const id of [
      'ps-learner-card',
      'parent-settings-rows',
      'parent-settings-backup',
      'parent-settings-cloud-backup',
    ]) {
      expect(
        within(screen.getByTestId(id)).queryAllByText(/Marian|\bshe\b|\bher\b/),
      ).toEqual([])
    }
  })

  it('an unnamed learner reads "this child"', async () => {
    device([{ ...MARIAN, name: '' }])
    await mount()
    expect(screen.getByText('Show level to this child')).toBeOnTheScreen()
  })

  it('Done reports what changed: nothing → the Hub; another learner playing → the picker', async () => {
    device()
    const first = await mount()
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(first.onExit).toHaveBeenCalledWith({
      learnersChanged: false,
      playingDocMoved: false,
    })
    await screen.unmount()

    const second = await mount()
    await fireEvent.press(screen.getByTestId(`ps-learner-row-${SAM_ID}`))
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(second.onExit).toHaveBeenCalledWith({
      learnersChanged: true,
      playingDocMoved: false,
    })
  })

  it('a rename alone is not a change of learners', async () => {
    device()
    const h = await mount()
    await fireEvent.changeText(screen.getByTestId('ps-learner-name'), 'Mari')
    await fireEvent(screen.getByTestId('ps-learner-name'), 'endEditing')
    expect(installedLearnerList()!.learners[0]!.name).toBe('Mari')
    await fireEvent.press(screen.getByTestId('parent-settings-done'))
    expect(h.onExit).toHaveBeenCalledWith({
      learnersChanged: false,
      playingDocMoved: false,
    })
  })

  it('no learner list (a failed boot): today’s screen, no learner cards', async () => {
    setKeyValueStore(getKeyValueStore())
    resetLearnersForTests()
    await mount()
    expect(screen.queryByTestId('ps-learners')).toBeNull()
    expect(screen.queryByTestId('ps-learner-card')).toBeNull()
    expect(screen.getByTestId('parent-settings-rows')).toBeOnTheScreen()
  })
})
