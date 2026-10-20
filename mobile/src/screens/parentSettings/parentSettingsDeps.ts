/**
 * Everything Parent Settings reads, writes and sends, behind one seam
 * (the web's `ParentSettingsStorage`). Production wires core's storage
 * adapter (expo-sqlite via `bootNative`), core's cloud sync, expo-clipboard
 * and the system share sheet; tests inject fakes.
 *
 * The two network calls take the screen's lifetime signal: a push or a
 * restore still in flight is aborted when the screen unmounts.
 *
 * With learner profiles the screen's sections take one learner's deps
 * (`learnerParentSettingsDeps`, § 3.1 X2): load, save, the backup code,
 * Last synced, Push now and Restore reach only that learner's keys and
 * sync ID, whoever plays by the time a request answers.
 */
import {
  activeLearner,
  boundLearner,
  learnerScopedStore,
  restoreLearnerFromCode,
  type LearnerEntry,
  type LearnerRestoreOutcome,
} from '@marian/core/learners'
import {
  getKeyValueStore,
  withKeyValueStore,
} from '@marian/core/platform/keyValueStore'
import { adoptDeviceIdAfterRead } from '@marian/core/parentSettings/cloudBackup'
import {
  getOrCreateDeviceId,
  loadProgress,
  pushProgressToCloud,
  readLastSyncISO,
  reconcileWithCloud,
  saveProgress,
  writeStoredDeviceId,
  type Progress,
  type PushResult,
} from '@marian/core/progress'
import {
  readSessionHistory,
  type SessionHistoryV2,
} from '@marian/core/sessionEnd/sessionHistory'
import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'
import { abortableFetch } from './abortableFetch'
import { NATIVE_COPY } from './nativeCopy'

export interface ParentSettingsDeps {
  load: () => Progress | null
  save: (p: Progress) => void
  loadSessionHistory: () => SessionHistoryV2
  /** Rejects when the clipboard refused the text. */
  writeClipboard: (text: string) => Promise<void>
  /**
   * Opens the system share sheet with the text. Resolves whether it was
   * shared or dismissed; rejects when the sheet could not open. `anchor`
   * (a native view tag) points the iPad popover at the Share button.
   */
  share: (text: string, anchor: number | null) => Promise<void>
  /** The persisted device ID (generated and stored on first call). */
  getDeviceId: () => string
  /**
   * This device's last successful cloud sync (ISO), or null: "Last synced"
   * (`@marian/core/progress/lastSync`). The cloud helpers record it, so
   * the screen re-reads it after Push now and Restore.
   */
  readLastSync: () => string | null
  pushNow: (progress: Progress, signal: AbortSignal) => Promise<PushResult>
  /**
   * Reconcile against `uuid`, then adopt it as this device's ID (unless
   * the read failed or that device's copy was rejected):
   * `adoptDeviceIdAfterRead`, bound to the learner playing
   * (`restoreLearnerFromCode`, learner profiles § 3.4), which also
   * refuses a code another learner here holds (`code-held`) and a record
   * that holds another learner's doc (`cloud-learner-mismatch`).
   */
  restoreFromDeviceId: (
    uuid: string,
    signal: AbortSignal,
  ) => Promise<LearnerRestoreOutcome>
}

async function writeClipboard(text: string): Promise<void> {
  const ok = await Clipboard.setStringAsync(text)
  if (!ok) throw new Error('clipboard-unavailable')
}

async function share(text: string, anchor: number | null): Promise<void> {
  await Share.share(
    { message: text, title: NATIVE_COPY.shareTitle },
    { subject: NATIVE_COPY.shareTitle, anchor: anchor ?? undefined },
  )
}

/**
 * One learner's deps (learner profiles § 3.1, X2), on `boundLearner`: a
 * toggle saves into their progress key, Push now sends their doc to their
 * sync ID, and Restore adopts the code as theirs, even if another learner
 * plays by the time it answers (K3).
 */
export function learnerParentSettingsDeps(
  entry: LearnerEntry,
): ParentSettingsDeps {
  const io = boundLearner(entry)
  const scoped = () => {
    const installed = getKeyValueStore()
    return installed === null ? null : learnerScopedStore(installed, entry)
  }
  return {
    load: io.load,
    save: io.save,
    loadSessionHistory: () => {
      const store = scoped()
      return store === null ? readSessionHistory() : readSessionHistory(store)
    },
    writeClipboard,
    share,
    getDeviceId: io.syncId,
    readLastSync: () => withKeyValueStore(scoped(), readLastSyncISO),
    pushNow: (progress, signal) =>
      pushProgressToCloud(io.syncId(), progress, {
        fetchImpl: abortableFetch(globalThis.fetch, signal),
      }),
    restoreFromDeviceId: (uuid, signal) =>
      restoreLearnerFromCode(entry, uuid, {
        fetchImpl: abortableFetch(globalThis.fetch, signal),
      }),
  }
}

export const DEFAULT_PARENT_SETTINGS_DEPS: ParentSettingsDeps = {
  load: loadProgress,
  save: saveProgress,
  loadSessionHistory: () => readSessionHistory(),
  writeClipboard,
  share,
  getDeviceId: () => getOrCreateDeviceId(),
  readLastSync: readLastSyncISO,
  pushNow: (progress, signal) =>
    pushProgressToCloud(getOrCreateDeviceId(), progress, {
      fetchImpl: abortableFetch(globalThis.fetch, signal),
    }),
  restoreFromDeviceId: (uuid, signal) => {
    const fetchImpl = abortableFetch(globalThis.fetch, signal)
    const learner = activeLearner()
    if (learner !== null) {
      return restoreLearnerFromCode(learner, uuid, { fetchImpl })
    }
    // No learner list (a boot whose migration failed): today's restore.
    return adoptDeviceIdAfterRead(uuid, {
      writeDeviceId: writeStoredDeviceId,
      loadLocal: loadProgress,
      reconcile: (id, local) => reconcileWithCloud(id, local, { fetchImpl }),
    })
  },
}
