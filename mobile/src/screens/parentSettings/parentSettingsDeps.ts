/**
 * Everything Parent Settings reads, writes and sends, behind one seam
 * (the web's `ParentSettingsStorage`). Production wires core's storage
 * adapter (expo-sqlite via `bootNative`), core's cloud sync, expo-clipboard
 * and the system share sheet; tests inject fakes.
 *
 * The two network calls take the screen's lifetime signal: a push or a
 * restore still in flight is aborted when the screen unmounts.
 */
import { adoptDeviceIdAfterRead } from '@marian/core/parentSettings/cloudBackup'
import {
  getOrCreateDeviceId,
  loadProgress,
  pushProgressToCloud,
  reconcileWithCloud,
  saveProgress,
  writeStoredDeviceId,
  type Progress,
  type PushResult,
  type ReconcileOutcome,
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
  pushNow: (progress: Progress, signal: AbortSignal) => Promise<PushResult>
  /**
   * Reconcile against `uuid`, then adopt it as this device's ID (unless
   * the read failed): `adoptDeviceIdAfterRead`.
   */
  restoreFromDeviceId: (
    uuid: string,
    signal: AbortSignal,
  ) => Promise<ReconcileOutcome>
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

export const DEFAULT_PARENT_SETTINGS_DEPS: ParentSettingsDeps = {
  load: loadProgress,
  save: saveProgress,
  loadSessionHistory: () => readSessionHistory(),
  writeClipboard,
  share,
  getDeviceId: () => getOrCreateDeviceId(),
  pushNow: (progress, signal) =>
    pushProgressToCloud(getOrCreateDeviceId(), progress, {
      fetchImpl: abortableFetch(globalThis.fetch, signal),
    }),
  restoreFromDeviceId: (uuid, signal) =>
    adoptDeviceIdAfterRead(uuid, {
      writeDeviceId: writeStoredDeviceId,
      loadLocal: loadProgress,
      reconcile: (id, local) =>
        reconcileWithCloud(id, local, {
          fetchImpl: abortableFetch(globalThis.fetch, signal),
        }),
    }),
}
