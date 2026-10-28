/**
 * Letter critters, the game around its rounds (`design/native/critters-four-letter.md`
 * § 5): before blending sounds the free meadow, from it the word hunt
 * (`LetterCritters.tsx`). While only "3" is open the game is the
 * three-letter round, and Back goes to the Play place, as phase 1 shipped.
 * Once "4" is open (her first complete three-letter round, `critterHunt.ts`)
 * the game opens on the length picker: two logs in the meadow, "3" over "4".
 * A log tap plinks and, about 200 ms after the release, that length's round
 * fades in, in progress or fresh; Back from a round fades back to the
 * picker, silent, keeping the round; Back from the picker goes to the Play
 * place. The picker never speaks and shows no round's state.
 *
 * It holds what a visit shares across its rounds: the gate (read once),
 * each length's open line (its first entry only, Decision 6), the praise
 * once a visit, and the drag hint's retirement at her first full run.
 */
import {
  huntOpenLengths,
  type HuntLength,
} from '@marian/core/games/critterHunt'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { TapClipPlayer } from '../../audio/tapClip'
import { LengthPicker, PICK_AFTER_MS } from './HuntLengths'
import { newCrittersVisit, readCrittersGate } from './crittersVisit'
import { LetterCritters } from './LetterCritters'
import { pickerScene } from './playGeometry'
import type { GameKit } from './playKit'
import { PLAY_LABELS } from './playLines'

/** § 5.3: the picker and a round cross-fade, 200 ms each. */
export const CRITTERS_SWAP_MS = 200

const PICKER_LABELS = {
  3: PLAY_LABELS.huntLog,
  4: PLAY_LABELS.huntLogFour,
} as const
const PICKER_TITLES = {
  3: PLAY_LABELS.huntTitle,
  4: PLAY_LABELS.huntTitleFour,
} as const

type CrittersView =
  | { kind: 'picker'; key: number }
  | { kind: 'round'; length: HuntLength; fresh: boolean; key: number }

type NextView =
  | { kind: 'picker' }
  | { kind: 'round'; length: HuntLength; fresh: boolean }

export interface CrittersGameProps {
  kit: GameKit
  /** Test seams, as `LetterCritters`'s. */
  sounds?: TapClipPlayer
  words?: readonly string[]
  hunt?: boolean
}

export function CrittersGame({ kit, sounds, words, hunt }: CrittersGameProps) {
  const [gate] = useState(() => readCrittersGate(hunt))
  const [visit] = useState(newCrittersVisit)
  const [view, setView] = useState<CrittersView>(() =>
    gate.hunt !== null && huntOpenLengths().includes(4)
      ? { kind: 'picker', key: 0 }
      : { kind: 'round', length: 3, fresh: false, key: 0 },
  )
  const viewRef = useRef(view)
  const pickingRef = useRef(false)

  /** Any line is cut and Emma idles; the next view fades in. */
  const go = (next: NextView) => {
    kit.cutLine()
    kit.setPose('idle')
    pickingRef.current = false
    const v = { ...next, key: viewRef.current.key + 1 }
    viewRef.current = v
    setView(v)
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })

  // § 5.1: Back from a round goes to the picker once "4" is open (it may
  // have opened in this very round, the roll-in's); else to the Play place.
  useEffect(() => {
    kit.setBack(() => {
      if (gate.hunt === null || viewRef.current.kind !== 'round') return false
      if (!huntOpenLengths().includes(4)) return false
      goRef.current({ kind: 'picker' })
      return true
    })
    return () => kit.setBack(null)
    // The frame's `setBack` is fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** § 5.3: a log tap plinks; about 200 ms on, that length's round. */
  const onPick = (length: 3 | 4) => {
    if (pickingRef.current) return
    pickingRef.current = true
    kit.sfx.plink.play()
    kit.later(() => {
      if (viewRef.current.kind === 'picker') {
        goRef.current({ kind: 'round', length, fresh: false })
      }
    }, PICK_AFTER_MS)
  }

  /** § 6.2: the door opens a fresh four-letter round. */
  const onOpenFour = () => go({ kind: 'round', length: 4, fresh: true })

  const swap = {
    entering: view.key > 0 ? FadeIn.duration(CRITTERS_SWAP_MS) : undefined,
    exiting: FadeOut.duration(CRITTERS_SWAP_MS),
  }
  return (
    <Animated.View
      key={view.key}
      {...swap}
      pointerEvents="box-none"
      style={styles.fill}
    >
      {view.kind === 'picker' ? (
        <LengthPicker
          scene={pickerScene(kit.area, kit.tablet, kit.landscape)}
          tablet={kit.tablet}
          reducedMotion={kit.reducedMotion}
          labels={PICKER_LABELS}
          titles={PICKER_TITLES}
          onPick={onPick}
        />
      ) : (
        <LetterCritters
          kit={kit}
          sounds={sounds}
          words={words}
          gate={gate}
          visit={visit}
          length={view.length}
          freshDeal={view.fresh}
          onOpenFour={gate.hunt !== null ? onOpenFour : undefined}
        />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
})
