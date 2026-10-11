/**
 * Session End's foreground, drawn from state (`SessionEnd.tsx` owns the
 * write and the beats): the clay panel (stars, step picture, flower tray,
 * "N of 3", today's flower), the buttons, and Emma's caption slot.
 * Web markup: `src/screens/SessionEnd/SessionEnd.tsx` render.
 */
import type {
  FlowerSlot,
  SessionEndGuidance,
} from '@marian/core/sessionEnd/sessionEndGuidance'
import { StyleSheet, View } from 'react-native'
import { PathImage } from '../../components/PathImage'
import type { SessionEndLayout } from '../../layout/sessionEndLayout'
import { ClayButton, ClayCaption } from './clayParts'
import { FlowerTray } from './FlowerTray'
import { AgainIcon, CheckIcon } from './glyphs'
import { CountBadge, NewFlower, Stars, type FlowerStage } from './panelParts'

export type { FlowerStage }

export interface SessionEndViewProps {
  layout: SessionEndLayout
  guidance: SessionEndGuidance | null
  phase: string
  totalCorrect: number
  caption: string
  showCta: boolean
  /** Today's flower in the air, or null. */
  flower: FlowerStage | null
  /** Today's flower is in its slot. */
  landed: boolean
  flight: { x: number; y: number; scale: number } | null
  reducedMotion: boolean
  onAllDone: () => void
  onAgain?: () => void
}

export function SessionEndView({
  layout,
  guidance: g,
  phase,
  totalCorrect,
  caption,
  showCta,
  flower,
  landed,
  flight,
  reducedMotion,
  onAllDone,
  onAgain,
}: SessionEndViewProps) {
  const { panel, inner, button: b } = layout
  const flowerDay = g?.newSlot != null
  const slots: readonly FlowerSlot[] =
    g === null ? [] : landed || !flowerDay ? g.slotsAfter : g.slotsBefore
  const notYet = g?.day === 'not-yet'
  const k = layout.panelSlab / 14

  return (
    <>
      <View
        testID="session-end-panel"
        // Test seam: the kind of day and the beat on screen.
        nativeID={`${g?.day ?? 'pending'}:${phase}`}
        style={[
          styles.panel,
          {
            left: panel.x,
            top: panel.y,
            width: panel.width,
            height: panel.height,
            borderRadius: layout.panelRadius,
            boxShadow: `inset 0 ${5 * k}px 0 #ffffff, 0 ${layout.panelSlab}px 0 #d9bb94, 0 ${26 * k}px ${36 * k}px rgba(60, 30, 10, 0.2)`,
          },
        ]}
      >
        <Stars
          count={totalCorrect}
          stars={inner.stars}
          reducedMotion={reducedMotion}
        />
        {g !== null && (
          <>
            <View
              style={[
                styles.abs,
                styles.step,
                { left: inner.step.x, top: inner.step.y },
              ]}
            >
              <PathImage
                id={g.node}
                px={inner.step.width}
                testID={`session-end-step-${g.node}`}
              />
            </View>
            <FlowerTray
              world={g.world}
              slots={slots}
              inner={inner}
              popSlot={landed ? g.newSlot : null}
              reducedMotion={reducedMotion}
            />
          </>
        )}
        {landed && g?.countText != null && (
          <CountBadge
            text={g.countText}
            rect={inner.count.rect}
            font={inner.count.font}
            reducedMotion={reducedMotion}
          />
        )}
        {flower !== null && flight !== null && (
          <NewFlower
            stage={flower}
            rect={inner.newFlower}
            flight={flight}
            reducedMotion={reducedMotion}
          />
        )}
      </View>

      <View
        style={[
          styles.row,
          {
            left: layout.buttons.x,
            top: layout.buttons.y,
            width: layout.buttons.width,
            height: layout.buttons.height,
            gap: b.gap,
          },
        ]}
      >
        {showCta && notYet && onAgain && (
          <ClayButton
            testID="session-end-again"
            label="Again"
            variant="go"
            width={b.widths.again}
            metrics={b}
            icon={<AgainIcon size={b.icon} />}
            text="Again"
            reducedMotion={reducedMotion}
            onPress={onAgain}
          />
        )}
        {showCta && (
          <ClayButton
            key={notYet ? 'home' : 'all-done'}
            testID="session-end-cta"
            label={notYet ? 'Home' : 'All done!'}
            variant={notYet ? 'alt' : 'go'}
            width={
              notYet
                ? onAgain
                  ? b.widths.homeWithAgain
                  : b.widths.homeAlone
                : b.widths.allDone
            }
            metrics={b}
            icon={
              notYet ? (
                <PathImage id="ui-house" px={b.icon} />
              ) : (
                <CheckIcon size={b.icon} />
              )
            }
            text={notYet ? 'Home' : 'All done'}
            reducedMotion={reducedMotion}
            onPress={onAllDone}
          />
        )}
      </View>

      {/* Emma's spoken line, in a slot under the buttons that always holds
          two lines, so no line can cover a button (web #521). */}
      <View
        style={[
          styles.captionSlot,
          {
            left: layout.captionSlot.x,
            top: layout.captionSlot.y,
            width: layout.captionSlot.width,
            height: layout.captionSlot.height,
          },
        ]}
      >
        {caption.length > 0 && (
          <ClayCaption text={caption} metrics={layout.caption} />
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  panel: {
    position: 'absolute',
    backgroundColor: '#fbefdf',
    experimental_backgroundImage: 'linear-gradient(170deg, #fffaf2, #f6e4cc)',
  },
  step: { filter: 'drop-shadow(0px 5px 3px rgba(60, 30, 10, 0.25))' },
  row: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionSlot: {
    position: 'absolute',
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
})
