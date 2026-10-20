/**
 * Parent Settings' learner cards (learner profiles § 3.1).
 *
 * - **Learners** (first): one row per learner in add order (their 40 pt
 *   disc, their name or "No name" in grey), the playing one marked
 *   "Playing now". A row tap makes that learner the one playing; every
 *   section below re-reads theirs. "+ Add a learner" and "Add from a code"
 *   are hidden at 4 learners.
 * - **The selected learner** (the one playing): Name (saves on keyboard
 *   Done, 1–24 characters), Picture (the 8 avatars; another learner's are
 *   at 30% and can't be tapped), Where to start (one row per world: their
 *   current land), Remove (hidden with 1 learner).
 */
import {
  AVATAR_IDS,
  LEARNER_NAME_MAX,
  MAX_LEARNERS,
  currentLand,
  isValidLearnerName,
  type AvatarId,
  type LearnerEntry,
} from '@marian/core/learners'
import type { MasteryTrack, Progress } from '@marian/core/progress'
import { forwardRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { AvatarDisc } from '../picker/AvatarDisc'
import {
  Card,
  PsButton,
  RowDivider,
  StatusSlot,
  type StatusLine,
} from './controls'
import {
  LEARNERS_COPY,
  landLabel,
  learnerHeading,
  removeLabel,
} from './learnerCopy'
import {
  BODY_FONT_MAX,
  MIN_TARGET,
  RADIUS,
  slate,
  type,
  white,
} from './psTheme'

const ROW_DISC = 40
const PICTURE_DISC = 44
const TAKEN_OPACITY = 0.3
const WORLDS: readonly MasteryTrack[] = ['math', 'word-song']

export interface LearnersCardProps {
  learners: readonly LearnerEntry[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onAddFromCode: () => void
  status: StatusLine | null
  statusSeq: number
}

export function LearnersCard({
  learners,
  activeId,
  onSelect,
  onAdd,
  onAddFromCode,
  status,
  statusSeq,
}: LearnersCardProps) {
  const full = learners.length >= MAX_LEARNERS
  return (
    <View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={[type.heading, styles.cardHeading]}
      >
        {LEARNERS_COPY.heading}
      </Text>
      <Card padded={false} testID="ps-learners">
        {learners.map((l, i) => {
          const playing = l.id === activeId
          return (
            <View key={l.id}>
              {i > 0 && <RowDivider />}
              <Pressable
                testID={`ps-learner-row-${l.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: playing }}
                onPress={() => onSelect(l.id)}
                style={({ pressed }) => [
                  styles.learnerRow,
                  pressed && styles.rowPressed,
                ]}
              >
                <AvatarDisc
                  avatarId={l.avatarId}
                  size={ROW_DISC}
                  testID={`ps-learner-avatar-${l.id}`}
                />
                <Text
                  testID={`ps-learner-name-${l.id}`}
                  maxFontSizeMultiplier={BODY_FONT_MAX}
                  numberOfLines={1}
                  style={[
                    type.rowLabel,
                    styles.learnerName,
                    l.name === '' && styles.noName,
                  ]}
                >
                  {l.name === '' ? LEARNERS_COPY.noName : l.name}
                </Text>
                {playing ? (
                  <Text
                    testID={`ps-learner-playing-${l.id}`}
                    maxFontSizeMultiplier={BODY_FONT_MAX}
                    style={styles.playing}
                  >
                    {LEARNERS_COPY.playingNow}
                  </Text>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </Pressable>
            </View>
          )
        })}
      </Card>
      {!full && (
        <View style={styles.addButtons}>
          <PsButton
            testID="ps-learners-add"
            label={LEARNERS_COPY.add}
            variant="secondary"
            minWidth={0}
            onPress={onAdd}
          />
          <PsButton
            testID="ps-learners-add-code"
            label={LEARNERS_COPY.addFromCode}
            variant="secondary"
            minWidth={0}
            onPress={onAddFromCode}
          />
        </View>
      )}
      <StatusSlot testID="ps-learners-status" status={status} seq={statusSeq} />
    </View>
  )
}

/** The 8 pictures; the ones in `taken` are dimmed and can't be tapped. */
export function PicturePicker({
  value,
  taken,
  onPick,
  testIDPrefix,
}: {
  value: AvatarId
  taken: ReadonlySet<AvatarId>
  onPick: (id: AvatarId) => void
  testIDPrefix: string
}) {
  return (
    <View style={styles.pictures}>
      {AVATAR_IDS.map((id) => {
        const isTaken = taken.has(id)
        const selected = id === value
        return (
          <Pressable
            key={id}
            testID={`${testIDPrefix}-${id}`}
            accessibilityRole="button"
            accessibilityLabel={id}
            accessibilityState={{ selected, disabled: isTaken }}
            disabled={isTaken}
            onPress={() => onPick(id)}
            style={[
              styles.picture,
              selected && styles.pictureSelected,
              isTaken && { opacity: TAKEN_OPACITY },
            ]}
          >
            <AvatarDisc avatarId={id} size={PICTURE_DISC} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** A name field: 1–24 characters, § 3.2's set. */
export const NameField = forwardRef<
  TextInput,
  {
    value: string
    onChangeText: (text: string) => void
    onDone?: () => void
    testID: string
    autoFocus?: boolean
  }
>(function NameField({ value, onChangeText, onDone, testID, autoFocus }, ref) {
  return (
    <TextInput
      ref={ref}
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      // Keyboard Done ends editing too: one save either way.
      onEndEditing={onDone}
      autoFocus={autoFocus}
      maxLength={LEARNER_NAME_MAX}
      autoCapitalize="words"
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
      returnKeyType="done"
      maxFontSizeMultiplier={BODY_FONT_MAX}
      style={[type.value, styles.field]}
    />
  )
})

export interface SelectedLearnerCardProps {
  learner: LearnerEntry
  learners: readonly LearnerEntry[]
  progress: Progress
  /** A valid new name (Done on the keyboard). */
  onRename: (name: string) => void
  onPicture: (id: AvatarId) => void
  /** A world's Where to start row: App opens its land list. */
  onStartRow: (world: MasteryTrack) => void
  onRemove: () => void
  /** Add from a code with no name: their Name field takes the focus. */
  focusName: boolean
}

export function SelectedLearnerCard({
  learner,
  learners,
  progress,
  onRename,
  onPicture,
  onStartRow,
  onRemove,
  focusName,
}: SelectedLearnerCardProps) {
  const [name, setName] = useState(learner.name)
  // A stored name that changed (a rename saved) replaces the field's.
  const [stored, setStored] = useState(learner.name)
  if (stored !== learner.name) {
    setStored(learner.name)
    setName(learner.name)
  }
  const save = () => {
    if (name.trim() === learner.name) return
    if (isValidLearnerName(name)) onRename(name)
    else setName(learner.name)
  }
  const taken = new Set(
    learners.filter((l) => l.id !== learner.id).map((l) => l.avatarId),
  )
  return (
    <View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={BODY_FONT_MAX}
        style={[type.heading, styles.cardHeading]}
      >
        {learnerHeading(learner.name)}
      </Text>
      <Card padded testID="ps-learner-card">
        <Text maxFontSizeMultiplier={BODY_FONT_MAX} style={type.fieldLabel}>
          {LEARNERS_COPY.name}
        </Text>
        <NameField
          testID="ps-learner-name"
          value={name}
          onChangeText={setName}
          onDone={save}
          autoFocus={focusName}
        />
        <Text
          maxFontSizeMultiplier={BODY_FONT_MAX}
          style={[type.fieldLabel, styles.fieldGap]}
        >
          {LEARNERS_COPY.picture}
        </Text>
        <PicturePicker
          value={learner.avatarId}
          taken={taken}
          onPick={(id) => id !== learner.avatarId && onPicture(id)}
          testIDPrefix="ps-learner-picture"
        />
        <Text
          maxFontSizeMultiplier={BODY_FONT_MAX}
          style={[type.fieldLabel, styles.fieldGap]}
        >
          {LEARNERS_COPY.whereToStart}
        </Text>
        <View style={styles.startRows}>
          {WORLDS.map((world) => (
            <Pressable
              key={world}
              testID={`ps-learner-start-${world}`}
              accessibilityRole="button"
              onPress={() => onStartRow(world)}
              style={({ pressed }) => [
                styles.startRow,
                pressed && styles.rowPressed,
              ]}
            >
              <Text
                maxFontSizeMultiplier={BODY_FONT_MAX}
                style={[type.rowLabel, styles.startWorld]}
              >
                {LEARNERS_COPY.worlds[world]}
              </Text>
              <Text
                testID={`ps-learner-start-${world}-land`}
                maxFontSizeMultiplier={BODY_FONT_MAX}
                numberOfLines={1}
                style={[type.value, styles.startLand]}
              >
                {landLabel(currentLand(progress, world))}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
        {learners.length > 1 && (
          <View style={styles.remove}>
            <PsButton
              testID="ps-learner-remove"
              label={removeLabel(learner.name)}
              variant="secondary"
              minWidth={0}
              onPress={onRemove}
            />
          </View>
        )}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  cardHeading: { marginBottom: 8 },
  learnerRow: {
    minHeight: MIN_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: white,
  },
  rowPressed: { backgroundColor: slate[50] },
  learnerName: { flex: 1, minWidth: 0 },
  noName: { color: slate[400] },
  playing: { fontSize: 12, fontWeight: '600', color: slate[700] },
  chevron: { fontSize: 22, color: slate[400] },
  addButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  pictures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  picture: {
    width: MIN_TARGET + 8,
    height: MIN_TARGET + 8,
    borderRadius: (MIN_TARGET + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pictureSelected: { borderColor: slate[700] },
  field: {
    marginTop: 4,
    minHeight: MIN_TARGET,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: slate[300],
    borderRadius: RADIUS,
    backgroundColor: white,
  },
  fieldGap: { marginTop: 16 },
  startRows: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: slate[200],
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  startRow: {
    minHeight: MIN_TARGET,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: white,
  },
  startWorld: { flexShrink: 0 },
  startLand: { flex: 1, minWidth: 0, textAlign: 'right' },
  remove: { marginTop: 20, alignItems: 'flex-start' },
})
