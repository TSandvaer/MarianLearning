/**
 * The Hub, the app's home from session 2 on: native port of the web Hub
 * (`src/screens/Hub/`: clay world cards, Redesign R2 #510, with Guidance
 * G1 #516/#517/#519; team/DECISIONS.md 2026-10-06), built to
 * `design/native/hub-native.md` and laid out by `../../layout/hubLayout.ts`.
 *
 * On mount the visit is decided once (core `planHubVisit`, shared with the
 * web): the two cards, the one glowing world, the flowers that wake and
 * Emma's lines. Emma speaks at once, on every entry path: native audio
 * needs no unlock, so the web's first-tap gate is gone (§ 5). Lines are
 * played in order with 1.2 s between them; the bubble appears with the
 * first word, re-enters with each line, and keeps the last line. A return
 * within 30 s says nothing.
 *
 * A card tap silences her at once, records the suggestion outcome and
 * hands the world to App; the map button plinks, silences her and opens
 * the map. A 3 s press on Emma (an invisible target over her frame) opens
 * Parent Settings. Emma herself is App's `EmmaStage` (idle, breathing,
 * with the baked shadow on this route).
 *
 * Not ported (§ 7): the parent-gate corner, PromotionCelebration, the
 * first-tap gate, cross-tab storage sync, keyboard focus.
 */
import {
  loadProgress,
  type MasteryTrack,
  type Progress,
} from '@marian/core/progress'
import { now as progressNow } from '@marian/core/progress/clock'
import {
  GUIDANCE_LINES,
  LINE_GAP_MS,
  readFlowerWake,
  writeFlowerWake,
} from '@marian/core/hub/hubGuidance'
import { recordSuggestionOutcome } from '@marian/core/hub/hubSuggestion'
import { planHubVisit, type HubVisit } from '@marian/core/hub/hubVisit'
import {
  emptySessionHistory,
  readSessionHistoryForToday,
  writeSessionHistory,
  type SessionHistoryV2,
  type SkillTreeId,
} from '@marian/core/sessionEnd/sessionHistory'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import type { HubLayout } from '../../layout/hubLayout'
import { FILL } from '../../theme'
import { HUB_ENTER_MS, HUB_EXIT_MS, HubBackdrop } from './HubBackdrop'
import { HubBubble } from './HubBubble'
import { HubCard } from './HubCard'
import {
  guidancePlayer,
  isRapidRemount,
  markHubUnmount,
  playPlink,
  type GuidancePlayer,
} from './hubAudio'

/** The hidden parent gate on Emma (web `useCharacterLongPress`). */
export const PARENT_LONG_PRESS_MS = 3000

export interface HubProps {
  layout: HubLayout
  /** A card tap: App starts that world. */
  onPickTree: (tree: SkillTreeId) => void
  /** A map button: App opens that world's map. */
  onOpenMap: (world: MasteryTrack) => void
  /** The 3 s press on Emma: App opens Parent Settings. */
  onParentLongPress: () => void
  /** Test seams. */
  player?: GuidancePlayer
  clock?: () => Date
  plink?: () => void
}

interface Mount {
  visit: HubVisit
  history: SessionHistoryV2
}

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

/** Everything the visit is decided from, read once. */
function readMount(clock: () => Date): Mount {
  const now = clock()
  const progress = safe<Progress | null>(loadProgress, null)
  const history = safe(
    () => readSessionHistoryForToday(now),
    emptySessionHistory(),
  )
  const visit = planHubVisit({
    progress,
    history,
    now,
    seenWake: readFlowerWake(),
    suppressed: isRapidRemount(Date.now()),
  })
  return { visit, history }
}

export function Hub({
  layout,
  onPickTree,
  onOpenMap,
  onParentLongPress,
  player: playerProp,
  clock = progressNow,
  plink = playPlink,
}: HubProps) {
  const reducedMotion = useReducedMotion()
  const [player] = useState<GuidancePlayer>(
    () => playerProp ?? guidancePlayer(),
  )
  const [{ visit, history }] = useState(() => readMount(clock))
  const [line, setLine] = useState({ index: 0, revealed: 0 })
  const stopLines = useRef<() => void>(() => player.cancelActive())
  const leavingRef = useRef(false)

  // The morning wake-up shows once: recorded at mount, so the next visit
  // (even a rapid remount) never replays it. No handoff payload: the
  // record only ever moves forward to the newest flower already shown.
  useEffect(() => {
    writeFlowerWake(visit.wake.next)
  }, [visit])

  // Emma's lines, once per mount, starting now (no tap gate).
  useEffect(() => {
    let stopped = false
    let gap: ReturnType<typeof setTimeout> | undefined
    stopLines.current = () => {
      stopped = true
      clearTimeout(gap)
      player.cancelActive()
    }
    const run = async () => {
      for (let i = 0; i < visit.lines.length; i++) {
        if (stopped) return
        if (i > 0) {
          await new Promise<void>((resolve) => {
            gap = setTimeout(resolve, LINE_GAP_MS)
          })
          if (stopped) return
        }
        setLine({ index: i, revealed: 0 })
        await player.playLine(visit.lines[i]!, {
          onWordTick: (w) => {
            if (!stopped) setLine({ index: i, revealed: w + 1 })
          },
        })
      }
    }
    void run()
    return () => {
      stopLines.current()
      player.unload()
      markHubUnmount(Date.now())
    }
  }, [player, visit])

  const pick = (tree: SkillTreeId) => {
    if (leavingRef.current) return
    leavingRef.current = true
    // Silence first, then the history write, then the route (§ 5).
    stopLines.current()
    writeSessionHistory({
      ...history,
      ...recordSuggestionOutcome(history, visit.suggestion),
    })
    onPickTree(tree)
  }

  const openMap = (world: MasteryTrack) => {
    if (leavingRef.current) return
    leavingRef.current = true
    plink()
    stopLines.current()
    onOpenMap(world)
  }

  const current = visit.lines[line.index] ?? null
  const { emma } = layout
  const cards = [
    { tree: 'number-garden', model: visit.numberGarden },
    { tree: 'word-song', model: visit.wordSong },
  ] as const

  return (
    <>
      <HubBackdrop layout={layout} />
      <Animated.View
        testID="hub"
        entering={FadeIn.duration(HUB_ENTER_MS)}
        exiting={FadeOut.duration(HUB_EXIT_MS)}
        style={styles.foreground}
      >
        {/* Draw order: Emma's long-press target, the bubble, the cards, so a
            card wins wherever they overlap. Tap-and-release does nothing. */}
        <Pressable
          testID="hub-emma-long-press"
          accessible={false}
          delayLongPress={PARENT_LONG_PRESS_MS}
          onLongPress={onParentLongPress}
          style={[
            styles.abs,
            {
              left: emma.x,
              top: emma.y,
              width: emma.width,
              height: emma.height,
            },
          ]}
        />
        {current !== null && line.revealed > 0 && (
          <HubBubble
            key={current}
            bubble={layout.bubble}
            text={GUIDANCE_LINES[current].text}
            revealedCount={line.revealed}
            lineKey={current}
          />
        )}
        {cards.map(({ tree, model }, i) => (
          <HubCard
            key={tree}
            tree={tree}
            model={model}
            rect={layout.cards[i]!}
            s={layout.s}
            suggested={visit.suggestion === tree}
            wakeSlots={visit.wake.wakeSlots[model.world] ?? []}
            reducedMotion={reducedMotion}
            onPress={() => pick(tree)}
            onOpenMap={() => openMap(model.world)}
          />
        ))}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  abs: { position: 'absolute' },
})
