/**
 * Parent Settings, native (`design/native/parent-settings-native.md`;
 * web reference `src/screens/ParentSettings/ParentSettings.tsx`, frozen).
 *
 * The parent's screen behind Emma's 3 s press on the Hub: slate on white
 * in the system font, no Emma, no sound. A fixed header keeps Done on
 * screen over one scrolling column: the pending-promotion banner, seven
 * setting rows, the defaults footnote, Backup and Cloud backup.
 *
 * Save-on-change, as on the web: every control writes the next Progress
 * through `deps.save` at once. Nothing is written on mount (the device ID
 * read creates one only if none is stored, idempotently), so re-entry and
 * the QA route are safe. On mount the held iOS audio session is released
 * (§ 6). Done and Android back → Hub. The screen handles the keyboard
 * itself (§ 4): bottom padding plus scroll-into-view for the restore field.
 *
 * Debug only: with `onQaJump` (App passes it only when the debug launch
 * flag is on) a "QA: jump to a step" row ends the column and opens the
 * step picker (`./QaStepPicker.tsx`) over the screen; Android back closes
 * the picker first.
 *
 * Learner profiles (§ 3): with a learner list installed the column opens
 * with the Learners card and the playing learner's card (name, picture,
 * Where to start, Remove), over three sheets (add, add from a code, a
 * world's lands). A row tap makes that learner the one playing. Today's
 * sections below are rendered per learner (X2): keyed by the playing
 * learner's id, so a row tap remounts them, drops the previous learner's
 * copy and aborts an in-flight Push now or Restore, and built on that
 * learner's bound deps (`learnerParentSettingsDeps`), so a save, Push now
 * or Restore can only reach their keys and sync ID. Done reports what
 * changed (`ParentSettingsExit`): App opens the picker when the learners
 * or the playing learner changed.
 */
import { currentStepOf } from '@marian/core/hub/hubCardModel'
import { HEADER_COPY } from '@marian/core/parentSettings/copy'
import {
  applySettingsPatch,
  confirmPendingPromotion,
  pendingPromotionToConfirm,
  type ParentSettingsPatch,
} from '@marian/core/parentSettings/parentSettingsModel'
import {
  getSettings,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import type { Land } from '@marian/core/progress/lands'
import {
  activateLearner,
  currentLand,
  installedLearnerList,
  learnerStartProgress,
  removeLearner,
  renameLearner,
  setLearnerAvatar,
  setLearnerStart,
  startProgressForActive,
  type AvatarId,
  type LearnerEntry,
  type LearnerList,
} from '@marian/core/learners'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Alert,
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent,
} from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import { releaseAudioSession } from '../../audio/lifecycle'
import type { ParentSettingsLayout } from '../../layout/parentSettingsLayout'
import { FILL } from '../../theme'
import { BackupSection } from './BackupSection'
import { CloudBackupSection } from './CloudBackupSection'
import { PsButton, type StatusLine } from './controls'
import { LearnersCard, SelectedLearnerCard } from './LearnerCards'
import {
  LEARNERS_COPY,
  addedLine,
  learnerSettingsCopy,
  removeAlertTitle,
  startAlertTitle,
} from './learnerCopy'
import {
  AddFromCodeSheet,
  AddLearnerSheet,
  StartSheet,
  type AddFromBackupFn,
} from './LearnerSheets'
import {
  DEFAULT_PARENT_SETTINGS_DEPS,
  learnerParentSettingsDeps,
  type ParentSettingsDeps,
} from './parentSettingsDeps'
import { HEADER_FONT_MAX, slate } from './psTheme'
import { QaStepPicker, QaStepRow } from './QaStepPicker'
import { SettingsCard } from './SettingsCard'
import { useLifetime } from './useTransientStatus'

export const PARENT_SETTINGS_ENTER_MS = 200
/** Restore block bottom → keyboard top, at least. */
const KEYBOARD_GAP = 16

/** What this visit changed, for App's route on Done (learner profiles § 3.1). */
export interface ParentSettingsExit {
  /** A learner was added or removed, or another learner plays now. */
  learnersChanged: boolean
  /** The playing learner's start moved (Where to start). */
  playingDocMoved: boolean
}

export interface ParentSettingsProps {
  layout: ParentSettingsLayout
  /** Done / Android back: App routes to the Hub (or the picker). */
  onExit: (exit?: ParentSettingsExit) => void
  /**
   * Fixed deps for every section (tests). Unset with a learner list
   * installed: each learner's own (`learnerParentSettingsDeps`).
   */
  deps?: ParentSettingsDeps
  /** Test seam: one learner's deps (default: their bound deps). */
  depsFor?: (learner: LearnerEntry) => ParentSettingsDeps
  /** Test seam: Add from a code's read. */
  addFromBackup?: AddFromBackupFn
  /** Test seam: releases the held iOS audio session on mount. */
  releaseAudio?: () => void
  /**
   * Debug only: shows the QA step picker. Called after a jump (or the
   * reset to the real start) was written; App restarts on the Hub.
   */
  onQaJump?: () => void
}

/** The learner list in use, or null with none installed (or fixed deps). */
function readList(fixedDeps: boolean): LearnerList | null {
  return fixedDeps ? null : installedLearnerList()
}

function sameLearners(a: LearnerList | null, b: LearnerList | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.activeLearnerId === b.activeLearnerId &&
    a.learners.length === b.learners.length &&
    a.learners.every((l, i) => l.id === b.learners[i]!.id)
  )
}

type Sheet =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'code' }
  | { kind: 'start'; world: MasteryTrack; current: number }
  | {
      kind: 'qa'
      current: Record<MasteryTrack, ReturnType<typeof currentStepOf>>
    }

export function ParentSettings({
  layout,
  onExit,
  deps: fixedDeps,
  depsFor = learnerParentSettingsDeps,
  addFromBackup,
  releaseAudio = releaseAudioSession,
  onQaJump,
}: ParentSettingsProps) {
  const reducedMotion = useReducedMotion()
  // The list at entry, to tell App on Done what this visit changed.
  const [entryList] = useState(() => readList(fixedDeps !== undefined))
  const [list, setList] = useState(entryList)
  const refreshList = useCallback(
    () => setList(readList(fixedDeps !== undefined)),
    [fixedDeps],
  )
  const playing =
    list?.learners.find((l) => l.id === list.activeLearnerId) ?? null
  const deps = useMemo(
    () =>
      fixedDeps ??
      (playing !== null ? depsFor(playing) : DEFAULT_PARENT_SETTINGS_DEPS),
    // One set per learner: a rename or a picture keeps their deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixedDeps, depsFor, playing?.id],
  )
  // A re-read of the sections' copy of the doc (after a move or a rename).
  const [docVersion, setDocVersion] = useState(0)
  const movedPlaying = useRef(false)
  const [learnersLine, setLearnersLine] = useState<{
    line: StatusLine | null
    seq: number
  }>({ line: null, seq: 0 })
  const [focusName, setFocusName] = useState(false)

  // § 6: this screen plays nothing; let music Emma paused resume.
  useEffect(() => {
    releaseAudio()
  }, [releaseAudio])

  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' })
  const leaving = useRef(false)
  const done = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    Keyboard.dismiss()
    onExit({
      learnersChanged: !sameLearners(
        entryList,
        readList(fixedDeps !== undefined),
      ),
      playingDocMoved: movedPlaying.current,
    })
  }, [onExit, entryList, fixedDeps])
  const back = useCallback(() => {
    if (sheet.kind !== 'none') setSheet({ kind: 'none' })
    else done()
  }, [sheet, done])
  const doneRef = useRef(back)
  useEffect(() => {
    doneRef.current = back
  })
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      doneRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // ── Learners (§ 3) ──────────────────────────────────────────────────
  const selectLearner = (id: string) => {
    if (list === null || id === list.activeLearnerId) return
    Keyboard.dismiss()
    activateLearner(id)
    setFocusName(false)
    setLearnersLine((s) => ({ line: null, seq: s.seq + 1 }))
    refreshList()
  }
  const added = (learner: LearnerEntry) => {
    setSheet({ kind: 'none' })
    refreshList()
    // A learner added from a code with no name: their Name field first.
    setFocusName(learner.name === '')
    setLearnersLine((s) => ({
      line: { tone: 'ok', text: addedLine(learner.name) },
      seq: s.seq + 1,
    }))
  }
  const renamed = () => {
    refreshList()
    setDocVersion((v) => v + 1)
  }
  const rename = (name: string) => {
    if (playing === null) return
    renameLearner(playing.id, name)
    renamed()
  }
  const picture = (avatarId: AvatarId) => {
    if (playing === null) return
    setLearnerAvatar(playing.id, avatarId)
    refreshList()
    setDocVersion((v) => v + 1)
  }
  const openStart = (world: MasteryTrack) => {
    if (playing === null) return
    Keyboard.dismiss()
    const doc = deps.load() ?? learnerStartProgress(playing)
    setSheet({ kind: 'start', world, current: currentLand(doc, world).number })
  }
  const pickStart = (world: MasteryTrack, current: number, land: Land) => {
    if (playing === null) return
    if (land.number === current) return setSheet({ kind: 'none' })
    Alert.alert(
      startAlertTitle(playing.name, land),
      LEARNERS_COPY.startAlertBody,
      [
        { text: LEARNERS_COPY.cancel, style: 'cancel' },
        {
          text: LEARNERS_COPY.change,
          onPress: () => {
            setLearnerStart(playing.id, world, land.number)
            movedPlaying.current = true
            setSheet({ kind: 'none' })
            refreshList()
            setDocVersion((v) => v + 1)
          },
        },
      ],
    )
  }
  const remove = () => {
    if (playing === null) return
    Keyboard.dismiss()
    Alert.alert(removeAlertTitle(playing.name), LEARNERS_COPY.removeAlertBody, [
      { text: LEARNERS_COPY.cancel, style: 'cancel' },
      {
        text: LEARNERS_COPY.remove,
        style: 'destructive',
        onPress: () => {
          if (!removeLearner(playing.id)) return
          setFocusName(false)
          refreshList()
        },
      },
    ])
  }

  // ── Keyboard (§ 4) ──────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null)
  const [keyboardPad, setKeyboardPad] = useState(0)
  const columnY = useRef(0)
  const cloudY = useRef(0)
  const restoreBottomInCard = useRef(0)
  const restoreFocused = useRef(false)
  const live = useRef({ layout, reducedMotion })
  useEffect(() => {
    live.current = { layout, reducedMotion }
  })
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const { layout: l, reducedMotion: still } = live.current
      const { height, screenY } = e.endCoordinates
      // iOS also reports the hide as a frame change, to off-screen.
      if (height <= 0 || screenY >= Dimensions.get('window').height) {
        setKeyboardPad(0)
        return
      }
      setKeyboardPad(Math.max(0, height - l.safeBottom))
      if (!restoreFocused.current) return
      const blockBottom =
        columnY.current + cloudY.current + restoreBottomInCard.current
      const headerBottom = l.safeTop + l.headerHeight
      const y = Math.max(
        0,
        blockBottom - (screenY - headerBottom - KEYBOARD_GAP),
      )
      // After the padding lands, so the content is tall enough.
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y, animated: !still }),
      )
    }
    const hide = () => setKeyboardPad(0)
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShow),
            Keyboard.addListener('keyboardWillChangeFrame', onShow),
            Keyboard.addListener('keyboardWillHide', hide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onShow),
            Keyboard.addListener('keyboardDidHide', hide),
          ]
    return () => subs.forEach((s) => s.remove())
  }, [])

  const openQa = () => {
    Keyboard.dismiss()
    const doc = deps.load() ?? startProgressForActive()
    setSheet({
      kind: 'qa',
      current: {
        math: currentStepOf(doc, 'math'),
        'word-song': currentStepOf(doc, 'word-song'),
      },
    })
  }

  const column = { marginLeft: layout.column.x, width: layout.column.width }
  const closeSheet = () => setSheet({ kind: 'none' })
  return (
    <Animated.View
      testID="parent-settings"
      entering={
        reducedMotion ? undefined : FadeIn.duration(PARENT_SETTINGS_ENTER_MS)
      }
      style={styles.root}
    >
      <View
        // The bar is `headerHeight` tall under the safe top; the 1 pt
        // border sits below it.
        style={[styles.header, { paddingTop: layout.safeTop }]}
      >
        <View
          style={[styles.headerRow, column, { height: layout.headerHeight }]}
        >
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={HEADER_FONT_MAX}
              numberOfLines={1}
              style={[styles.title, { fontSize: layout.titleSize }]}
            >
              {HEADER_COPY.title}
            </Text>
            <Text
              maxFontSizeMultiplier={HEADER_FONT_MAX}
              numberOfLines={1}
              style={[styles.subtitle, { fontSize: layout.subtitleSize }]}
            >
              {HEADER_COPY.subtitle}
            </Text>
          </View>
          <PsButton
            testID="parent-settings-done"
            label={HEADER_COPY.done}
            variant="secondary"
            minWidth={72}
            maxFontSizeMultiplier={HEADER_FONT_MAX}
            onPress={done}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        testID="parent-settings-scroll"
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: layout.contentPadTop,
          paddingBottom: layout.contentPadBottom + keyboardPad,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View
          testID="parent-settings-column"
          style={column}
          onLayout={(e) => {
            columnY.current = e.nativeEvent.layout.y
          }}
        >
          {list !== null && playing !== null && (
            <View style={styles.learners}>
              <LearnersCard
                learners={list.learners}
                activeId={playing.id}
                onSelect={selectLearner}
                onAdd={() => {
                  Keyboard.dismiss()
                  setSheet({ kind: 'add' })
                }}
                onAddFromCode={() => {
                  Keyboard.dismiss()
                  setSheet({ kind: 'code' })
                }}
                status={learnersLine.line}
                statusSeq={learnersLine.seq}
              />
            </View>
          )}
          <LearnerSections
            // Per learner (X2): a row tap remounts every section below.
            key={playing?.id ?? 'device'}
            deps={deps}
            learner={playing}
            learners={list?.learners ?? []}
            docVersion={docVersion}
            compact={layout.compact}
            focusName={focusName}
            onRename={rename}
            onPicture={picture}
            onStartRow={openStart}
            onRemove={remove}
            onCloudY={(y) => {
              cloudY.current = y
            }}
            onRestoreBottom={(bottom) => {
              restoreBottomInCard.current = bottom
            }}
            onRestoreFocusChange={(focused) => {
              restoreFocused.current = focused
            }}
            qaRow={
              onQaJump && (
                <View style={styles.section}>
                  <QaStepRow onPress={openQa} />
                </View>
              )
            }
          />
        </View>
      </ScrollView>
      {onQaJump && sheet.kind === 'qa' && (
        <QaStepPicker
          layout={layout}
          current={sheet.current}
          onClose={closeSheet}
          onJumped={onQaJump}
          copy={learnerSettingsCopy(
            playing?.name ??
              (deps.load() ?? startProgressForActive()).profile.childName,
          )}
        />
      )}
      {sheet.kind === 'add' && list !== null && (
        <AddLearnerSheet
          layout={layout}
          learners={list.learners}
          onAdded={added}
          onClose={closeSheet}
        />
      )}
      {sheet.kind === 'code' && list !== null && (
        <AddFromCodeSheet
          layout={layout}
          learners={list.learners}
          onAdded={added}
          // A refused code keeps learner 1's new name: the cards show it.
          onRenamed={renamed}
          onClose={closeSheet}
          add={addFromBackup}
        />
      )}
      {sheet.kind === 'start' && (
        <StartSheet
          layout={layout}
          world={sheet.world}
          current={sheet.current}
          onPick={(land) => pickStart(sheet.world, sheet.current, land)}
          onClose={closeSheet}
        />
      )}
    </Animated.View>
  )
}

interface LearnerSectionsProps {
  deps: ParentSettingsDeps
  /** The learner playing, or null with no list (today's screen). */
  learner: LearnerEntry | null
  learners: readonly LearnerEntry[]
  /** Bumped after a learner-card write: the doc is read again. */
  docVersion: number
  compact: boolean
  focusName: boolean
  onRename: (name: string) => void
  onPicture: (id: AvatarId) => void
  onStartRow: (world: MasteryTrack) => void
  onRemove: () => void
  onCloudY: (y: number) => void
  onRestoreBottom: (bottomInCard: number) => void
  onRestoreFocusChange: (focused: boolean) => void
  qaRow: ReactNode
}

/**
 * One learner's sections: their card, the setting rows, Backup and Cloud
 * backup, on their deps only. Keyed by learner, so its doc copy and its
 * in-flight requests never outlive a switch.
 */
function LearnerSections({
  deps,
  learner,
  learners,
  docVersion,
  compact,
  focusName,
  onRename,
  onPicture,
  onStartRow,
  onRemove,
  onCloudY,
  onRestoreBottom,
  onRestoreFocusChange,
  qaRow,
}: LearnerSectionsProps) {
  // Read once (and again after a learner-card write); every control
  // writes through and updates this copy.
  const [progress, setProgress] = useState<Progress>(
    () => deps.load() ?? startProgressForActive(),
  )
  const readVersion = useRef(docVersion)
  useEffect(() => {
    if (readVersion.current === docVersion) return
    readVersion.current = docVersion
    setProgress(deps.load() ?? startProgressForActive())
  }, [docVersion, deps])
  const settings = useMemo(() => getSettings(progress), [progress])
  const copy = useMemo(
    () => learnerSettingsCopy(learner?.name ?? progress.profile.childName),
    [learner?.name, progress.profile.childName],
  )
  // Aborted when this learner's sections go: Done, or a row tap.
  const lifetime = useLifetime()
  const alive = useCallback(() => !lifetime().aborted, [lifetime])

  const patch = useCallback(
    (p: ParentSettingsPatch) =>
      setProgress((prev) => {
        const next = applySettingsPatch(prev, p)
        deps.save(next)
        return next
      }),
    [deps],
  )
  const confirmPromotion = useCallback(
    () =>
      setProgress((prev) => {
        const next = confirmPendingPromotion(prev)
        if (next === prev) return prev
        deps.save(next)
        return next
      }),
    [deps],
  )

  return (
    <>
      {learner !== null && (
        <View style={styles.learners}>
          <SelectedLearnerCard
            learner={learner}
            learners={learners}
            progress={progress}
            onRename={onRename}
            onPicture={onPicture}
            onStartRow={onStartRow}
            onRemove={onRemove}
            focusName={focusName}
          />
        </View>
      )}
      <SettingsCard
        settings={settings}
        pendingNode={pendingPromotionToConfirm(progress)}
        compact={compact}
        onPatch={patch}
        onConfirmPromotion={confirmPromotion}
        copy={copy}
      />
      <View style={styles.section}>
        <BackupSection
          progress={progress}
          deps={deps}
          alive={alive}
          copy={copy}
        />
      </View>
      <View
        testID="parent-settings-cloud-wrap"
        style={styles.section}
        onLayout={(e) => onCloudY(e.nativeEvent.layout.y)}
      >
        <CloudBackupSection
          progress={progress}
          onProgress={setProgress}
          deps={deps}
          lifetime={lifetime}
          compact={compact}
          onRestoreBottom={onRestoreBottom}
          onRestoreFocusChange={onRestoreFocusChange}
          copy={copy}
        />
      </View>
      {qaRow}
    </>
  )
}

const styles = StyleSheet.create({
  // Slate fills every edge, safe areas included: no cream strip.
  root: { ...FILL, backgroundColor: slate[50] },
  header: {
    backgroundColor: slate[50],
    borderBottomWidth: 1,
    borderBottomColor: slate[200],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontWeight: '600', color: slate[900] },
  subtitle: { fontWeight: '400', color: slate[500] },
  scroll: { flex: 1 },
  section: { marginTop: 32 },
  learners: { marginBottom: 32 },
})
