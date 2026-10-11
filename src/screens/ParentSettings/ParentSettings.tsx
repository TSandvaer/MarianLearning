/**
 * Screen — Parent Settings (M2.5 — ticket 86c9kpjc7).
 *
 * Hidden parent-only surface reached via the 3-second long-press on
 * Hub character art. Renders one row per setting with a control:
 *  - autoPromote: toggle
 *  - sessionModePicker: two-way segmented (off | on)
 *  - masteryThreshold: TWO three-way segmented controls — one for
 *    math (default 95/3), one for word-song (default 90/3). Presets:
 *    80/2 | 90/3 | 95/3 (ticket 86c9kwvy0).
 *  - crossDayEnforcement: toggle
 *  - showLevelToMarian: toggle (Hub card land number; default on)
 *
 * Save-on-change (no explicit save button) — every control writes the
 * updated Progress through `saveProgress()` immediately. The "Done"
 * button at the top calls back to the orchestrator to leave the
 * screen; no save is required at exit.
 *
 * Visual contract
 * ---------------
 * Plain, parent-styled. Slate text on white, system font, no Marian-
 * themed art. The point is "this is obviously not a Marian screen" so
 * there's no chance Marian thinks she opened a hidden game-mode.
 *
 * No setting is consumed yet — wiring lands in M3 (mastery), M4
 * (Leitner / session mode), M5 (level visibility). This screen only
 * persists the values.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react'
import {
  MASTERY_THRESHOLD_PRESETS,
  defaultProgress,
  getOrCreateDeviceId,
  getSettings,
  loadProgress,
  pushProgressToCloud,
  saveProgress,
  type MasteryThreshold,
  type MasteryTrackKey,
  type ParentSettings,
  type Progress,
  type ReconcileOutcome,
} from '@marian/core/progress'
import { labelForSkillNode } from '@marian/core/hub/progressProjection'
import {
  readSessionHistory,
  type SessionHistoryV2,
} from '@marian/core/sessionEnd/sessionHistory'
import {
  STATUS_RESET_MS,
  adoptDeviceId,
  canSubmitRestore,
  copyStatusResets,
  parseRestoreInput,
  progressAfterRestore,
  pushStatusResets,
  restoreFailureReason,
  restoreStatusAfterEdit,
  restoreStatusTag,
  type CopyStatus,
  type PushStatus,
  type RestoreStatus,
} from '@marian/core/parentSettings/cloudBackup'
import {
  BACKUP_COPY,
  CLOUD_BACKUP_COPY,
  COPY_STATUS_COPY,
  DEFAULTS_FOOTNOTE,
  HEADER_COPY,
  MASTERY_ROW_DESCRIPTION,
  MASTERY_ROW_LABELS,
  PENDING_PROMOTION_COPY,
  PUSH_STATUS_COPY,
  SESSION_MODE_ROW_COPY,
  TOGGLE_ROW_COPY,
  restoreFailedMessage,
} from '@marian/core/parentSettings/copy'
import {
  SESSION_MODE_OPTIONS,
  SETTINGS_ROWS,
  applySettingsPatch,
  buildBackupJson,
  confirmPendingPromotion,
  masteryPatch,
  masteryRowId,
  pendingPromotionToConfirm,
  presetId,
  presetIndexFor,
  presetLabel,
  restoreOutcomeMessage,
  safelyReadSessionHistory,
  togglePatch,
  type ParentSettingsPatch,
  type SegmentedOption,
} from '@marian/core/parentSettings/parentSettingsModel'

// ── Public types ────────────────────────────────────────────────────────

export interface ParentSettingsProps {
  /** Fires when the parent taps "Done" — orchestrator routes back to Hub. */
  onExit?: () => void
  /**
   * Test seam: replace the storage read/write pair so tests don't
   * touch real localStorage. The default uses the project's
   * `loadProgress()` / `saveProgress()` from `lib/progress`.
   */
  storage?: ParentSettingsStorage
}

export interface ParentSettingsStorage {
  load: () => Progress | null
  save: (p: Progress) => void
  /**
   * Read the persisted session-history blob (Hub stats / streak /
   * sessionCount). Optional test seam for the Backup section
   * (ticket 86c9pkfth) — production defaults to
   * `readSessionHistory()` from `screens/SessionEnd/sessionHistory.ts`.
   */
  loadSessionHistory?: () => SessionHistoryV2
  /**
   * Write text to the OS clipboard. Optional test seam — production
   * defaults to `navigator.clipboard.writeText`. Returning a Promise
   * lets the screen surface success/failure UI.
   */
  writeClipboard?: (text: string) => Promise<void>
  /**
   * Cloud-sync test seams (ticket 86c9pkfyu). All optional — production
   * defaults to the canonical helpers from `lib/progress`.
   *
   * `getDeviceId` returns the persisted device UUID (or generates one).
   * `pushNow` POSTs the current progress to /api/progress immediately.
   * `restoreFromDeviceId` writes the supplied UUID to localStorage and
   *   runs a reconcile that pulls that device's blob.
   */
  getDeviceId?: () => string
  pushNow?: (progress: Progress) => Promise<'sent' | 'failed' | 'skipped'>
  restoreFromDeviceId?: (uuid: string) => Promise<ReconcileOutcome>
}

const DEFAULT_STORAGE: ParentSettingsStorage = {
  load: loadProgress,
  save: saveProgress,
  loadSessionHistory: () => readSessionHistory(),
  writeClipboard: async (text: string): Promise<void> => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text)
      return
    }
    throw new Error('clipboard-unavailable')
  },
  getDeviceId: () => getOrCreateDeviceId(),
  pushNow: (progress: Progress) =>
    pushProgressToCloud(getOrCreateDeviceId(), progress),
  // Install the new device id, then reconcile against it. The
  // cloud-newer branch installs the cloud blob and the helper returns
  // the structured outcome the UI uses to refresh.
  restoreFromDeviceId: (uuid: string) => adoptDeviceId(uuid),
}

// ── Component ────────────────────────────────────────────────────────────

export default function ParentSettings({
  onExit,
  storage = DEFAULT_STORAGE,
}: ParentSettingsProps): ReactElement {
  /**
   * Read once on mount. The screen owns the in-memory copy; every
   * control update writes through to localStorage immediately AND
   * updates this state so the rendered controls stay in sync without
   * a re-mount.
   *
   * If no document exists yet (first run / private mode), seed with
   * a fresh defaultProgress() so saves still work — getSettings()
   * yields the same defaults shown in the UI.
   */
  const [progress, setProgress] = useState<Progress>(() => {
    const loaded = storage.load()
    return loaded ?? defaultProgress()
  })

  const settings: ParentSettings = useMemo(
    () => getSettings(progress),
    [progress],
  )

  /**
   * Apply a settings patch and write through. Always merges OVER the
   * fully-defaulted current settings so a sparse patch doesn't drop
   * keys.
   *
   * `masteryThreshold` is a per-track map (ticket 86c9kwvy0); the
   * patch carries a `Partial<PerTrackMasteryThreshold>` so a control
   * can update one track at a time. Missing tracks are preserved
   * from the current value.
   */
  const update = useCallback(
    (patch: ParentSettingsPatch) => {
      setProgress((prev) => {
        const updated = applySettingsPatch(prev, patch)
        storage.save(updated)
        return updated
      })
    },
    [storage],
  )

  /**
   * Confirm the queued `pendingPromotion` (M3 audit follow-up, ticket
   * 86c9kwnkw). Applies the promotion via `applyMasteryRule()` against a
   * temporarily-`autoPromote=true` view of the document — the rule's
   * "auto-promote re-entry" branch picks up the queued node, marks it
   * `'mastered'`, unlocks the downstream node, and clears the field.
   *
   * After the apply, we restore the parent's actual `autoPromote`
   * preference. Side effect: any FRESH promotion that the rule would
   * have queued in the same call is also applied (unlikely — it requires
   * a second node to qualify on the current history). That's acceptable;
   * the alternative (carrying the parent's autoPromote=false and
   * synthesising a single-node mutation) duplicates the rule's logic.
   */
  /**
   * Backup section state (ticket 86c9pkfth) — escape hatch for parents
   * to copy Marian's full progress + session-history JSON to clipboard.
   * Pairs with the upcoming cloud-sync ticket (T2).
   *
   * `copyState` is a minimal three-value FSM: `'idle' | 'copied' | 'error'`.
   * The `copied`/`error` states reset to `'idle'` after a short timer
   * so a parent who taps multiple times sees fresh feedback. We don't
   * surface the error reason inline — clipboard rejection on iOS PWA
   * is one of "permission-denied", "no-clipboard-API", or "writeText
   * threw"; none of which a parent can act on. The textarea always
   * shows the live JSON so they can manually select-and-copy as a
   * fallback path.
   */
  const [copyState, setCopyState] = useState<CopyStatus>('idle')

  // Read both blobs at render time so the textarea reflects the current
  // persisted state, including in-session writes from the controls above.
  // The versioned envelope is core's (`buildBackupJson`).
  const backupJson = useMemo(
    () =>
      buildBackupJson(
        progress,
        storage.loadSessionHistory
          ? safelyReadSessionHistory(storage.loadSessionHistory)
          : null,
        new Date().toISOString(),
      ),
    [progress, storage],
  )

  const handleCopyBackup = useCallback(() => {
    const writeClipboard = storage.writeClipboard
    if (!writeClipboard) {
      setCopyState('error')
      return
    }
    void writeClipboard(backupJson).then(
      () => {
        setCopyState('copied')
      },
      () => {
        setCopyState('error')
      },
    )
  }, [backupJson, storage])

  const handleConfirmPromotion = useCallback(() => {
    setProgress((prev) => {
      const restored = confirmPendingPromotion(prev)
      if (restored === prev) return prev
      storage.save(restored)
      return restored
    })
  }, [storage])

  // ── Cloud Backup section state (ticket 86c9pkfyu) ─────────────────────
  //
  // Read the device id once on mount. The default seam falls back to
  // `getOrCreateDeviceId()` which generates a fresh UUID if none is
  // stored — that matches the rest of the app's behaviour, so even if a
  // parent opens Settings before the boot reconcile fired they see the
  // device id.
  const [deviceId, setDeviceId] = useState<string>(() => {
    if (storage.getDeviceId) return storage.getDeviceId()
    return ''
  })
  const [deviceIdCopyState, setDeviceIdCopyState] = useState<CopyStatus>('idle')
  const [pushState, setPushState] = useState<PushStatus>('idle')
  const [restoreInput, setRestoreInput] = useState('')
  const [restoreState, setRestoreState] = useState<RestoreStatus>({
    kind: 'idle',
  })

  // The Last-synced timestamp is `progress.profile.lastPlayedISO`. The
  // session-end fire-and-forget POST stamps this exact value before
  // pushing, so the value here matches what the cloud holds for
  // successful syncs. For never-synced devices it's null.
  const lastSyncedISO = progress.profile.lastPlayedISO

  // The pending-promotion banner's node (null: no banner).
  const pendingNode = pendingPromotionToConfirm(progress)

  // Reset state badges after a short while so a parent who taps
  // multiple times always sees fresh feedback.
  useEffect(() => {
    if (pushStatusResets(pushState)) {
      const handle = window.setTimeout(
        () => setPushState('idle'),
        STATUS_RESET_MS,
      )
      return () => window.clearTimeout(handle)
    }
    return undefined
  }, [pushState])

  useEffect(() => {
    if (copyStatusResets(deviceIdCopyState)) {
      const handle = window.setTimeout(
        () => setDeviceIdCopyState('idle'),
        STATUS_RESET_MS,
      )
      return () => window.clearTimeout(handle)
    }
    return undefined
  }, [deviceIdCopyState])

  const handleCopyDeviceId = useCallback(() => {
    const writeClipboard = storage.writeClipboard
    if (!writeClipboard) {
      setDeviceIdCopyState('error')
      return
    }
    void writeClipboard(deviceId).then(
      () => setDeviceIdCopyState('copied'),
      () => setDeviceIdCopyState('error'),
    )
  }, [deviceId, storage])

  const handlePushNow = useCallback(() => {
    const pushNow = storage.pushNow
    if (!pushNow) {
      setPushState('skipped')
      return
    }
    setPushState('sending')
    void pushNow(progress).then(
      (result) => setPushState(result),
      () => setPushState('failed'),
    )
  }, [progress, storage])

  const handleRestoreFromDeviceId = useCallback(() => {
    const trimmed = parseRestoreInput(restoreInput)
    if (trimmed === null) {
      setRestoreState({ kind: 'invalid-format' })
      return
    }
    const restoreFn = storage.restoreFromDeviceId
    if (!restoreFn) {
      setRestoreState({
        kind: 'restore-failed',
        reason: 'restore-not-configured',
      })
      return
    }
    setRestoreState({ kind: 'restoring' })
    void restoreFn(trimmed).then(
      (outcome) => {
        setRestoreState({ kind: 'restored', outcome })
        setDeviceId(trimmed)
        // Refresh the in-memory progress copy: the installed blob, or a
        // re-read of storage in case it changed anyway.
        const fresh = progressAfterRestore(outcome, () => storage.load())
        if (fresh !== null) setProgress(fresh)
      },
      (err: unknown) => {
        setRestoreState({
          kind: 'restore-failed',
          reason: restoreFailureReason(err),
        })
      },
    )
  }, [restoreInput, storage])

  return (
    <main
      data-testid="parent-settings"
      className="
        min-h-full w-full
        bg-slate-50 text-slate-900
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        font-body
      "
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header — deliberately drab. No Emma, no pastel. */}
        <header className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {HEADER_COPY.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {HEADER_COPY.subtitle}
            </p>
          </div>
          <button
            type="button"
            data-testid="parent-settings-done"
            onClick={onExit}
            className="
              rounded-md border border-slate-300 bg-white px-4 py-2
              text-sm font-medium text-slate-700
              hover:bg-slate-100
              focus:outline-none focus:ring-2 focus:ring-slate-400
            "
          >
            {HEADER_COPY.done}
          </button>
        </header>

        {/* Pending-promotion banner (M3 audit follow-up, ticket 86c9kwnkw).
            Surfaced ONLY when auto-promote is off AND the engine has queued
            a node. When auto-promote is on the engine applies promotions
            silently and `pendingPromotion` is never written, so this banner
            stays hidden in the default flow. */}
        {pendingNode !== null && (
          <section
            data-testid="parent-settings-pending-promotion"
            data-node={pendingNode}
            className="
              mb-6 rounded-md border border-emerald-300 bg-emerald-50 p-4
            "
          >
            <h2 className="text-base font-semibold text-emerald-900">
              {PENDING_PROMOTION_COPY.heading}
            </h2>
            <p className="mt-1 text-sm text-emerald-900/80">
              {PENDING_PROMOTION_COPY.before}
              <span
                data-testid="parent-settings-pending-promotion-label"
                className="font-medium"
              >
                {labelForSkillNode(pendingNode)}
              </span>
              {PENDING_PROMOTION_COPY.after}
            </p>
            <button
              type="button"
              data-testid="parent-settings-confirm-promotion"
              onClick={handleConfirmPromotion}
              className="
                mt-3 rounded-md border border-emerald-700 bg-emerald-700
                px-4 py-2 text-sm font-medium text-white
                hover:bg-emerald-800
                focus:outline-none focus:ring-2 focus:ring-emerald-500
              "
            >
              {PENDING_PROMOTION_COPY.confirm}
            </button>
          </section>
        )}

        <div
          data-testid="parent-settings-rows"
          className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white"
        >
          {SETTINGS_ROWS.map((row) => {
            switch (row.kind) {
              case 'toggle':
                return (
                  <ToggleRow
                    key={row.id}
                    id={row.id}
                    label={TOGGLE_ROW_COPY[row.id].label}
                    description={TOGGLE_ROW_COPY[row.id].description}
                    value={settings[row.id]}
                    onChange={(v) => update(togglePatch(row.id, v))}
                  />
                )
              case 'session-mode':
                return (
                  <SegmentedRow
                    key={row.id}
                    id={row.id}
                    label={SESSION_MODE_ROW_COPY.label}
                    description={SESSION_MODE_ROW_COPY.description}
                    value={settings.sessionModePicker}
                    options={SESSION_MODE_OPTIONS}
                    onChange={(v) => update({ sessionModePicker: v })}
                  />
                )
              case 'mastery':
                return (
                  <MasteryThresholdRow
                    key={row.id}
                    track={row.track}
                    value={settings.masteryThreshold[row.track]}
                    onChange={(v) => update(masteryPatch(row.track, v))}
                  />
                )
            }
          })}
        </div>

        <p className="mt-6 text-xs text-slate-400">{DEFAULTS_FOOTNOTE}</p>

        {/* Backup section (ticket 86c9pkfth — escape hatch for cloud-sync).
            Read-only JSON view + Copy button. Parents can paste the JSON
            into a notes app / email-to-self as a manual backup until the
            cloud-sync ticket lands. The textarea is selectable as a
            fallback path if the Copy button's clipboard call fails (iOS
            PWA permission edge cases). */}
        <section
          data-testid="parent-settings-backup"
          className="mt-8 rounded-md border border-slate-200 bg-white p-5"
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800">
                {BACKUP_COPY.heading}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{BACKUP_COPY.body}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                data-testid="parent-settings-backup-copy"
                onClick={handleCopyBackup}
                className="
                  rounded-md border border-slate-700 bg-slate-700 px-4 py-2
                  text-sm font-medium text-white
                  hover:bg-slate-800
                  focus:outline-none focus:ring-2 focus:ring-slate-400
                "
              >
                {BACKUP_COPY.copy}
              </button>
              {copyState === 'copied' && (
                <span
                  data-testid="parent-settings-backup-status"
                  data-status="copied"
                  className="text-xs text-emerald-700"
                >
                  {COPY_STATUS_COPY.copied}
                </span>
              )}
              {copyState === 'error' && (
                <span
                  data-testid="parent-settings-backup-status"
                  data-status="error"
                  className="text-xs text-amber-700"
                >
                  {COPY_STATUS_COPY.error}
                </span>
              )}
            </div>
          </div>
          <textarea
            data-testid="parent-settings-backup-json"
            readOnly
            spellCheck={false}
            value={backupJson}
            onClick={(e) => {
              // Convenience: tapping the textarea selects everything
              // so the parent can OS-copy as a fallback. Doesn't
              // interfere with manual range selection — onClick fires
              // on a click-without-drag.
              ;(e.currentTarget as HTMLTextAreaElement).select()
            }}
            aria-label={BACKUP_COPY.jsonLabel}
            className="
              h-48 w-full rounded-md border border-slate-300 bg-slate-50 p-3
              font-mono text-xs text-slate-700
              focus:outline-none focus:ring-2 focus:ring-slate-400
            "
          />
        </section>

        {/* Cloud Backup section (ticket 86c9pkfyu — durable off-device
            backup keyed by per-device UUID). Three pieces:
              1. Device ID display + Copy button + last-synced timestamp
              2. "Push now" — manual fire of the same POST that
                 session-end runs automatically
              3. "Restore from device ID" — paste a UUID from another
                 device, validate, run reconcile to pull that device's
                 cloud blob locally */}
        <section
          data-testid="parent-settings-cloud-backup"
          className="mt-8 rounded-md border border-slate-200 bg-white p-5"
        >
          <div className="mb-3 min-w-0">
            <h2 className="text-base font-semibold text-slate-800">
              {CLOUD_BACKUP_COPY.heading}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {CLOUD_BACKUP_COPY.body}
            </p>
          </div>

          {/* Device ID row */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600">
              {CLOUD_BACKUP_COPY.deviceIdLabel}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <code
                data-testid="parent-settings-cloud-device-id"
                className="
                  flex-1 select-all rounded-md border border-slate-300
                  bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700
                "
              >
                {deviceId || CLOUD_BACKUP_COPY.deviceIdUnavailable}
              </code>
              <button
                type="button"
                data-testid="parent-settings-cloud-copy-device-id"
                onClick={handleCopyDeviceId}
                className="
                  shrink-0 rounded-md border border-slate-700 bg-slate-700 px-3
                  py-2 text-sm font-medium text-white
                  hover:bg-slate-800
                  focus:outline-none focus:ring-2 focus:ring-slate-400
                  disabled:bg-slate-300 disabled:text-slate-500
                "
                disabled={!deviceId}
              >
                {CLOUD_BACKUP_COPY.copy}
              </button>
            </div>
            {deviceIdCopyState === 'copied' && (
              <p
                data-testid="parent-settings-cloud-device-id-status"
                data-status="copied"
                className="mt-1 text-xs text-emerald-700"
              >
                {COPY_STATUS_COPY.copied}
              </p>
            )}
            {deviceIdCopyState === 'error' && (
              <p
                data-testid="parent-settings-cloud-device-id-status"
                data-status="error"
                className="mt-1 text-xs text-amber-700"
              >
                {COPY_STATUS_COPY.error}
              </p>
            )}
          </div>

          {/* Last-synced + Push now row */}
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-600">
                {CLOUD_BACKUP_COPY.lastSyncedLabel}
              </label>
              <p
                data-testid="parent-settings-cloud-last-synced"
                className="mt-1 text-sm text-slate-700"
              >
                {lastSyncedISO ?? CLOUD_BACKUP_COPY.neverSynced}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                data-testid="parent-settings-cloud-push-now"
                onClick={handlePushNow}
                disabled={pushState === 'sending'}
                className="
                  rounded-md border border-slate-700 bg-slate-700 px-3 py-2
                  text-sm font-medium text-white
                  hover:bg-slate-800
                  focus:outline-none focus:ring-2 focus:ring-slate-400
                  disabled:bg-slate-300 disabled:text-slate-500
                "
              >
                {pushState === 'sending'
                  ? CLOUD_BACKUP_COPY.pushSending
                  : CLOUD_BACKUP_COPY.pushNow}
              </button>
              {pushState === 'sent' && (
                <span
                  data-testid="parent-settings-cloud-push-status"
                  data-status="sent"
                  className="text-xs text-emerald-700"
                >
                  {PUSH_STATUS_COPY.sent}
                </span>
              )}
              {pushState === 'failed' && (
                <span
                  data-testid="parent-settings-cloud-push-status"
                  data-status="failed"
                  className="text-xs text-amber-700"
                >
                  {PUSH_STATUS_COPY.failed}
                </span>
              )}
              {pushState === 'skipped' && (
                <span
                  data-testid="parent-settings-cloud-push-status"
                  data-status="skipped"
                  className="text-xs text-slate-500"
                >
                  {PUSH_STATUS_COPY.skipped}
                </span>
              )}
            </div>
          </div>

          {/* Restore-from-device-id row */}
          <div className="mt-4">
            <label
              htmlFor="parent-settings-cloud-restore-input"
              className="block text-xs font-medium text-slate-600"
            >
              {CLOUD_BACKUP_COPY.restoreLabel}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="parent-settings-cloud-restore-input"
                data-testid="parent-settings-cloud-restore-input"
                type="text"
                spellCheck={false}
                autoComplete="off"
                value={restoreInput}
                onChange={(e) => {
                  setRestoreInput(e.currentTarget.value)
                  setRestoreState(restoreStatusAfterEdit)
                }}
                placeholder={CLOUD_BACKUP_COPY.restorePlaceholder}
                aria-invalid={restoreState.kind === 'invalid-format'}
                className="
                  flex-1 rounded-md border border-slate-300 bg-white px-3 py-2
                  font-mono text-xs text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-slate-400
                "
              />
              <button
                type="button"
                data-testid="parent-settings-cloud-restore-submit"
                onClick={handleRestoreFromDeviceId}
                disabled={!canSubmitRestore(restoreInput, restoreState)}
                className="
                  shrink-0 rounded-md border border-slate-700 bg-slate-700 px-3
                  py-2 text-sm font-medium text-white
                  hover:bg-slate-800
                  focus:outline-none focus:ring-2 focus:ring-slate-400
                  disabled:bg-slate-300 disabled:text-slate-500
                "
              >
                {restoreState.kind === 'restoring'
                  ? CLOUD_BACKUP_COPY.restoring
                  : CLOUD_BACKUP_COPY.restore}
              </button>
            </div>
            {restoreState.kind === 'invalid-format' && (
              <p
                data-testid="parent-settings-cloud-restore-status"
                data-status={restoreStatusTag(restoreState) ?? undefined}
                className="mt-1 text-xs text-amber-700"
              >
                {CLOUD_BACKUP_COPY.invalidFormat}
              </p>
            )}
            {restoreState.kind === 'restored' && (
              <p
                data-testid="parent-settings-cloud-restore-status"
                data-status={restoreStatusTag(restoreState) ?? undefined}
                className="mt-1 text-xs text-emerald-700"
              >
                {restoreOutcomeMessage(restoreState.outcome)}
              </p>
            )}
            {restoreState.kind === 'restore-failed' && (
              <p
                data-testid="parent-settings-cloud-restore-status"
                data-status={restoreStatusTag(restoreState) ?? undefined}
                className="mt-1 text-xs text-amber-700"
              >
                {restoreFailedMessage(restoreState.reason)}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

// ── Row components ──────────────────────────────────────────────────────

interface RowFrameProps {
  id: string
  label: string
  description: string
  control: ReactElement
}

function RowFrame({
  id,
  label,
  description,
  control,
}: RowFrameProps): ReactElement {
  return (
    <div
      data-testid="parent-settings-row"
      data-row-id={id}
      className="flex items-start justify-between gap-6 px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={`parent-settings-${id}`}
          className="block text-base font-medium text-slate-800"
        >
          {label}
        </label>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex shrink-0 items-center">{control}</div>
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
}

function ToggleRow({
  id,
  label,
  description,
  value,
  onChange,
}: ToggleRowProps): ReactElement {
  return (
    <RowFrame
      id={id}
      label={label}
      description={description}
      control={
        <button
          type="button"
          role="switch"
          id={`parent-settings-${id}`}
          data-testid={`parent-settings-toggle-${id}`}
          data-value={value ? 'on' : 'off'}
          aria-checked={value}
          onClick={() => onChange(!value)}
          className={[
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-slate-400',
            value ? 'bg-slate-700' : 'bg-slate-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              value ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      }
    />
  )
}

interface SegmentedRowProps<T extends string> {
  id: string
  label: string
  description: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (next: T) => void
}

function SegmentedRow<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: SegmentedRowProps<T>): ReactElement {
  return (
    <RowFrame
      id={id}
      label={label}
      description={description}
      control={
        <div
          role="radiogroup"
          aria-label={label}
          data-testid={`parent-settings-segmented-${id}`}
          className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`parent-settings-segmented-${id}-${opt.value}`}
                data-selected={selected ? 'true' : 'false'}
                onClick={() => onChange(opt.value)}
                className={[
                  'px-3 py-1.5 text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset',
                  selected
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      }
    />
  )
}

// ── Mastery threshold row ───────────────────────────────────────────────

interface MasteryThresholdRowProps {
  track: MasteryTrackKey
  value: MasteryThreshold
  onChange: (next: MasteryThreshold) => void
}

function MasteryThresholdRow({
  track,
  value,
  onChange,
}: MasteryThresholdRowProps): ReactElement {
  /**
   * Match the current value to a preset by exact equality. If somehow
   * none match (a future schema-shape that didn't propagate to the UI),
   * fall back to the per-track default for THIS track so the control
   * still has SOMETHING selected — matches the Thomas-locked default.
   */
  const presetIndex = useMemo(
    () => presetIndexFor(value, track),
    [value, track],
  )

  const label = MASTERY_ROW_LABELS[track]
  const rowId = masteryRowId(track)

  return (
    <RowFrame
      id={rowId}
      label={label}
      description={MASTERY_ROW_DESCRIPTION}
      control={
        <div
          role="radiogroup"
          aria-label={label}
          data-testid={`parent-settings-segmented-${rowId}`}
          data-track={track}
          data-percent={value.percent}
          data-sessions={value.sessions}
          className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {MASTERY_THRESHOLD_PRESETS.map((preset, i) => {
            const selected = i === presetIndex
            const id = presetId(preset)
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`parent-settings-segmented-${rowId}-${id}`}
                data-selected={selected ? 'true' : 'false'}
                data-percent={preset.percent}
                data-sessions={preset.sessions}
                onClick={() => onChange({ ...preset })}
                className={[
                  'px-3 py-1.5 text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset',
                  selected
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {presetLabel(preset)}
              </button>
            )
          })}
        </div>
      }
    />
  )
}
