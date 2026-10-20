/**
 * Parent Settings' three learner sheets (learner profiles §§ 3.1–3.3),
 * over the screen like the QA step picker: plain system UI, slate on white.
 *
 * - **Add a learner** (§ 3.2): a name (1–24 characters), a picture (the
 *   first free one preselected; taken ones dimmed), where to start in each
 *   world (land 1 by default), then [Add].
 * - **Add from a code** (§ 3.3): a backup code, then [Add]; core checks
 *   the code against this device's learners before any call and installs
 *   the record as a new learner, never over one. Its six outcomes show
 *   their lines.
 * - **Where to start** (§ 3.1): a world's lands; the caller asks before it
 *   moves the learner.
 *
 * Both add sheets begin with "Name the first learner" when learner 1 has
 * no name (a fresh install, D5), and [Add] then writes both names.
 */
import {
  AVATAR_IDS,
  addLearner,
  addLearnerFromBackup,
  isValidLearnerName,
  renameLearner,
  type AddFromBackupOutcome,
  type AvatarId,
  type LearnerEntry,
} from '@marian/core/learners'
import { parseRestoreInput } from '@marian/core/parentSettings/cloudBackup'
import { restoreFailedMessage } from '@marian/core/parentSettings/copy'
import type { MasteryTrack } from '@marian/core/progress'
import { landsOf, type Land } from '@marian/core/progress/lands'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { ParentSettingsLayout } from '../../layout/parentSettingsLayout'
import { FILL } from '../../theme'
import { AvatarDisc } from '../picker/AvatarDisc'
import { abortableFetch } from './abortableFetch'
import { Card, PsButton, StatusSlot, type StatusLine } from './controls'
import { NameField, PicturePicker } from './LearnerCards'
import { LEARNERS_COPY, addFromCodeLine, landLabel } from './learnerCopy'
import {
  BODY_FONT_MAX,
  HEADER_FONT_MAX,
  MIN_TARGET,
  MONO,
  RADIUS,
  slate,
  type,
  white,
} from './psTheme'

const FIRST_DISC = 40
const WORLDS: readonly MasteryTrack[] = ['math', 'word-song']

function SheetFrame({
  testID,
  title,
  layout,
  onClose,
  children,
}: {
  testID: string
  title: string
  layout: ParentSettingsLayout
  onClose: () => void
  children: ReactNode
}) {
  const column = { marginLeft: layout.column.x, width: layout.column.width }
  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.header, { paddingTop: layout.safeTop }]}>
        <View
          style={[styles.headerRow, column, { height: layout.headerHeight }]}
        >
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={HEADER_FONT_MAX}
            numberOfLines={1}
            style={[styles.title, { fontSize: layout.titleSize }]}
          >
            {title}
          </Text>
          <PsButton
            testID={`${testID}-close`}
            label={LEARNERS_COPY.close}
            variant="secondary"
            minWidth={72}
            maxFontSizeMultiplier={HEADER_FONT_MAX}
            onPress={onClose}
          />
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: layout.contentPadTop,
          paddingBottom: layout.contentPadBottom,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={column}>{children}</View>
      </ScrollView>
    </View>
  )
}

function Label({ text, first }: { text: string; first?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={BODY_FONT_MAX}
      style={[type.fieldLabel, !first && styles.fieldGap]}
    >
      {text}
    </Text>
  )
}

/** § 3.2 step 0: learner 1's disc and a Name field. */
function FirstLearnerStep({
  first,
  value,
  onChange,
  testID,
}: {
  first: LearnerEntry
  value: string
  onChange: (text: string) => void
  testID: string
}) {
  return (
    <Card padded testID={`${testID}-step`}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={type.heading}
      >
        {LEARNERS_COPY.firstLearner}
      </Text>
      <View style={styles.firstRow}>
        <AvatarDisc avatarId={first.avatarId} size={FIRST_DISC} />
        <View style={styles.firstField}>
          <NameField testID={testID} value={value} onChangeText={onChange} />
        </View>
      </View>
    </Card>
  )
}

/** One world's lands as a pick list. */
function LandList({
  world,
  value,
  onPick,
  testIDPrefix,
}: {
  world: MasteryTrack
  value: number
  onPick: (land: Land) => void
  testIDPrefix: string
}) {
  return (
    <View style={styles.lands}>
      {landsOf(world).map((land, i) => {
        const selected = land.number === value
        return (
          <Pressable
            key={land.number}
            testID={`${testIDPrefix}-${world}-${land.number}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onPick(land)}
            style={({ pressed }) => [
              styles.land,
              i > 0 && styles.landDivider,
              pressed && styles.rowPressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={BODY_FONT_MAX}
              style={[type.rowLabel, styles.landText]}
            >
              {landLabel(land)}
            </Text>
            {selected && (
              <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={styles.marker}>
                ✓
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Add a learner ───────────────────────────────────────────────────────

export interface AddLearnerSheetProps {
  layout: ParentSettingsLayout
  learners: readonly LearnerEntry[]
  onAdded: (learner: LearnerEntry) => void
  onClose: () => void
}

export function AddLearnerSheet({
  layout,
  learners,
  onAdded,
  onClose,
}: AddLearnerSheetProps) {
  const [first] = useState<LearnerEntry | null>(() =>
    learners[0] !== undefined && learners[0].name === '' ? learners[0] : null,
  )
  const [firstName, setFirstName] = useState('')
  const [name, setName] = useState('')
  const taken = new Set<AvatarId>(learners.map((l) => l.avatarId))
  const [avatarId, setAvatarId] = useState<AvatarId>(
    () => AVATAR_IDS.find((a) => !taken.has(a)) ?? 'fox',
  )
  const [start, setStart] = useState({ math: 1, wordSong: 1 })
  const valid =
    isValidLearnerName(name) &&
    !taken.has(avatarId) &&
    (first === null || isValidLearnerName(firstName))

  const add = () => {
    if (!valid) return
    if (first !== null) renameLearner(first.id, firstName)
    onAdded(addLearner({ name, avatarId, start }))
  }

  return (
    <SheetFrame
      testID="ps-add-sheet"
      title={LEARNERS_COPY.addTitle}
      layout={layout}
      onClose={onClose}
    >
      {first !== null && (
        <View style={styles.block}>
          <FirstLearnerStep
            first={first}
            value={firstName}
            onChange={setFirstName}
            testID="ps-add-first-name"
          />
        </View>
      )}
      <Card padded testID="ps-add-card">
        <Label text={LEARNERS_COPY.name} first />
        <NameField testID="ps-add-name" value={name} onChangeText={setName} />
        <Label text={LEARNERS_COPY.picture} />
        <PicturePicker
          value={avatarId}
          taken={taken}
          onPick={setAvatarId}
          testIDPrefix="ps-add-picture"
        />
        <Label text={LEARNERS_COPY.whereToStart} />
        {WORLDS.map((world) => (
          <View key={world} style={styles.world}>
            <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.value}>
              {LEARNERS_COPY.worlds[world]}
            </Text>
            <LandList
              world={world}
              value={world === 'math' ? start.math : start.wordSong}
              onPick={(land) =>
                setStart((s) =>
                  world === 'math'
                    ? { ...s, math: land.number }
                    : { ...s, wordSong: land.number },
                )
              }
              testIDPrefix="ps-add-land"
            />
          </View>
        ))}
        <View style={styles.submit}>
          <PsButton
            testID="ps-add-submit"
            label={LEARNERS_COPY.addButton}
            variant="primary"
            minWidth={96}
            disabled={!valid}
            onPress={add}
          />
        </View>
      </Card>
    </SheetFrame>
  )
}

// ── Add from a code ─────────────────────────────────────────────────────

export type AddFromBackupFn = (
  code: string,
  signal: AbortSignal,
) => Promise<AddFromBackupOutcome>

const addFromBackup: AddFromBackupFn = (code, signal) =>
  addLearnerFromBackup(code, {
    fetchImpl: abortableFetch(globalThis.fetch, signal),
  })

export interface AddFromCodeSheetProps {
  layout: ParentSettingsLayout
  learners: readonly LearnerEntry[]
  onAdded: (learner: LearnerEntry) => void
  /** Learner 1 was named (D5): written before the read, whatever it finds. */
  onRenamed: () => void
  onClose: () => void
  /** Test seam: core's `addLearnerFromBackup` over the network. */
  add?: AddFromBackupFn
}

export function AddFromCodeSheet({
  layout,
  learners,
  onAdded,
  onRenamed,
  onClose,
  add = addFromBackup,
}: AddFromCodeSheetProps) {
  const [first] = useState<LearnerEntry | null>(() =>
    learners[0] !== undefined && learners[0].name === '' ? learners[0] : null,
  )
  const [firstName, setFirstName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    line: StatusLine | null
    seq: number
  }>({ line: null, seq: 0 })
  // Closing the sheet aborts a read in flight; a late answer is ignored.
  const lifetime = useRef(new AbortController())
  useEffect(() => {
    const controller = lifetime.current
    return () => controller.abort()
  }, [])

  const uuid = parseRestoreInput(code)
  const canSubmit =
    uuid !== null && !busy && (first === null || isValidLearnerName(firstName))

  const submit = () => {
    if (!canSubmit || uuid === null) return
    if (first !== null) {
      renameLearner(first.id, firstName)
      onRenamed()
    }
    const signal = lifetime.current.signal
    setBusy(true)
    const show = (line: StatusLine) =>
      setStatus((s) => ({ line, seq: s.seq + 1 }))
    add(uuid, signal).then(
      (outcome) => {
        if (signal.aborted) return
        setBusy(false)
        if (outcome.kind === 'added') onAdded(outcome.learner)
        else show(addFromCodeLine(outcome))
      },
      (err: unknown) => {
        if (signal.aborted) return
        setBusy(false)
        show({
          tone: 'error',
          text: restoreFailedMessage(
            err instanceof Error ? err.message : String(err),
          ),
        })
      },
    )
  }

  return (
    <SheetFrame
      testID="ps-code-sheet"
      title={LEARNERS_COPY.codeTitle}
      layout={layout}
      onClose={onClose}
    >
      {first !== null && (
        <View style={styles.block}>
          <FirstLearnerStep
            first={first}
            value={firstName}
            onChange={setFirstName}
            testID="ps-code-first-name"
          />
        </View>
      )}
      <Card padded testID="ps-code-card">
        <Label text={LEARNERS_COPY.backupCode} first />
        <TextInput
          testID="ps-code-input"
          value={code}
          onChangeText={(text) => {
            setCode(text)
            if (status.line !== null) setStatus((s) => ({ ...s, line: null }))
          }}
          onSubmitEditing={submit}
          placeholder={LEARNERS_COPY.codePlaceholder}
          placeholderTextColor={slate[400]}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          keyboardType="ascii-capable"
          returnKeyType="go"
          allowFontScaling={false}
          style={[type.value, styles.field, styles.mono]}
        />
        <View style={styles.submit}>
          <PsButton
            testID="ps-code-submit"
            label={LEARNERS_COPY.addButton}
            variant="primary"
            minWidth={96}
            disabled={!canSubmit}
            onPress={submit}
          />
        </View>
        <StatusSlot
          testID="ps-code-status"
          status={status.line}
          seq={status.seq}
        />
      </Card>
    </SheetFrame>
  )
}

// ── Where to start ──────────────────────────────────────────────────────

export interface StartSheetProps {
  layout: ParentSettingsLayout
  world: MasteryTrack
  /** The learner's current land in this world. */
  current: number
  onPick: (land: Land) => void
  onClose: () => void
}

export function StartSheet({
  layout,
  world,
  current,
  onPick,
  onClose,
}: StartSheetProps) {
  return (
    <SheetFrame
      testID="ps-start-sheet"
      title={`${LEARNERS_COPY.whereToStart}: ${LEARNERS_COPY.worlds[world]}`}
      layout={layout}
      onClose={onClose}
    >
      <Card padded={false} testID="ps-start-lands">
        <LandList
          world={world}
          value={current}
          onPick={onPick}
          testIDPrefix="ps-start-land"
        />
      </Card>
    </SheetFrame>
  )
}

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: slate[50] },
  header: {
    backgroundColor: slate[50],
    borderBottomWidth: 1,
    borderBottomColor: slate[200],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, minWidth: 0, fontWeight: '600', color: slate[900] },
  scroll: { flex: 1 },
  block: { marginBottom: 24 },
  firstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  firstField: { flex: 1, minWidth: 0 },
  fieldGap: { marginTop: 16 },
  field: {
    marginTop: 4,
    minHeight: MIN_TARGET,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: slate[300],
    borderRadius: RADIUS,
    backgroundColor: white,
  },
  mono: { fontFamily: MONO },
  world: { marginTop: 8 },
  lands: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: slate[200],
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  land: {
    minHeight: MIN_TARGET,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: white,
  },
  landDivider: { borderTopWidth: 1, borderTopColor: slate[200] },
  landText: { flex: 1, minWidth: 0 },
  rowPressed: { backgroundColor: slate[50] },
  marker: { fontSize: 12, fontWeight: '600', color: slate[700] },
  submit: { marginTop: 20, alignItems: 'flex-start' },
})
