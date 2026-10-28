/**
 * Raft crossing, the game around its trips (raft-island-goal § 5): with
 * one raft open the game is the 10 raft's trip, and Back goes to the Play
 * place, as before. Once the 10 island is full the 20 raft is open too,
 * and the game opens on the raft picker; a pond tap plinks and, about
 * 200 ms after the release, that raft's trip fades in at a fresh shore;
 * Back from a trip fades back to the picker, silent; Back from the picker
 * goes to the Play place. A trip ends on the screen it started from.
 *
 * It holds the learner's island record for the visit (read once, written
 * at each kind's first landing, I7) and runs the 10 island party's reveal
 * (§ 3.2): the picker fades in with the 10 pond, the 20 pond fades in and
 * its raft glides up and docks with the sparkle, then touch unlocks.
 */
import {
  islandHome,
  openRafts,
  loadIslandRecord,
  saveIslandRecord,
  type IslandRecord,
} from '@marian/core/games/raftIsland'
import type { RaftTarget, RaftWeight } from '@marian/core/games/playPlace'
import { loadProgress } from '@marian/core/progress'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { raftPicker } from './playGeometry'
import type { GameKit } from './playKit'
import { RaftCrossing } from './RaftCrossing'
import {
  RaftPicker,
  REDUCED_REVEAL_DOCK_AT_MS,
  REVEAL_DOCK_AT_MS,
  REVEAL_POND_AT_MS,
  REVEAL_UNLOCK_GAP_MS,
  type RevealPhase,
} from './RaftPicker'

/** § 5.3: the picker and a trip cross-fade, 200 ms each. */
export const RAFT_SWAP_MS = 200
/** § 5.3: a pond's trip about 200 ms after the release. */
export const RAFT_PICK_AFTER_MS = 200

type RaftView =
  | { kind: 'picker'; key: number; reveal: boolean }
  | { kind: 'trip'; target: RaftTarget; key: number; fromPicker: boolean }

type NextView =
  | { kind: 'picker'; reveal: boolean }
  | { kind: 'trip'; target: RaftTarget; fromPicker: boolean }

/**
 * The rafts open for the playing learner (`openRafts`). The game opens
 * only from the raft's tile, so an unreadable progress reads as the 10
 * raft.
 */
function readOpenRafts(record: IslandRecord): RaftTarget[] {
  let open: RaftTarget[] = []
  try {
    open = openRafts(loadProgress(), record)
  } catch {
    // The 10 raft.
  }
  return open.length > 0 ? open : [10]
}

export interface RaftGameProps {
  kit: GameKit
  /** Test seam: the first trip's first shore. */
  shore?: readonly number[]
}

export function RaftGame({ kit, shore }: RaftGameProps) {
  const [record, setRecord] = useState<IslandRecord>(loadIslandRecord)
  const recordRef = useRef(record)
  const [view, setView] = useState<RaftView>(() =>
    readOpenRafts(record).length > 1
      ? { kind: 'picker', key: 0, reveal: false }
      : { kind: 'trip', target: 10, key: 0, fromPicker: false },
  )
  const viewRef = useRef(view)
  const pickingRef = useRef(false)
  const shoreRef = useRef(shore)
  const [reveal, setReveal] = useState<RevealPhase>('none')
  const revealRef = useRef(0)

  /** Any line is cut and Emma idles; the next view fades in. */
  const go = (next: NextView) => {
    kit.cutLine()
    kit.setPose('idle')
    pickingRef.current = false
    revealRef.current += 1
    const v = { ...next, key: viewRef.current.key + 1 }
    viewRef.current = v
    setView(v)
    setReveal(next.kind === 'picker' && next.reveal ? 'hidden' : 'none')
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })

  // § 5.1: Back from a trip goes to the picker when it started there; from
  // the picker (and every other trip), to the Play place.
  useEffect(() => {
    kit.setBack(() => {
      const v = viewRef.current
      if (v.kind !== 'trip' || !v.fromPicker) return false
      goRef.current({ kind: 'picker', reveal: false })
      return true
    })
    return () => kit.setBack(null)
    // The frame's `setBack` is fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // § 3.2: the reveal, from R0 (the picker's fade-in). Touch stays locked
  // until it ends; Back stays live.
  useEffect(() => {
    if (view.kind !== 'picker' || !view.reveal) return
    const token = revealRef.current
    const step = (fn: () => void, ms: number) =>
      kit.advance(() => {
        if (revealRef.current === token) fn()
      }, ms)
    const dockAt = kit.reducedMotion
      ? REDUCED_REVEAL_DOCK_AT_MS
      : REVEAL_DOCK_AT_MS
    step(() => setReveal('glide'), REVEAL_POND_AT_MS)
    step(() => {
      setReveal('docked')
      kit.sfx.sparkle.play()
      kit.setPose('celebration')
    }, dockAt)
    step(() => {
      setReveal('none')
      kit.setPose('idle')
    }, dockAt + REVEAL_UNLOCK_GAP_MS)
    // A new view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.key])

  // § 5.3: a rotation jumps a reveal in flight to its end.
  const frameRef = useRef(kit.cancelKey)
  useEffect(() => {
    const area = kit.cancelKey.split('|')[0]
    const was = frameRef.current.split('|')[0]
    frameRef.current = kit.cancelKey
    if (area === was || reveal === 'none') return
    revealRef.current += 1
    setReveal('none')
    kit.setPose('idle')
    // The frame's layout and the reveal's phase only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit.cancelKey, reveal])

  /** A kind's first landing on `target`'s island: written at once (I7). */
  const onFill = (target: RaftTarget, weight: RaftWeight) => {
    const next = islandHome(recordRef.current, target, weight)
    if (next === recordRef.current) return
    recordRef.current = next
    setRecord(next)
    saveIslandRecord(next)
  }

  /** § 5.3: a pond tap plinks; about 200 ms on, that raft's trip. */
  const onPick = (target: RaftTarget) => {
    if (pickingRef.current || reveal !== 'none') return
    pickingRef.current = true
    kit.sfx.plink.play()
    kit.later(() => {
      if (viewRef.current.kind === 'picker') {
        goRef.current({ kind: 'trip', target, fromPicker: true })
      }
    }, RAFT_PICK_AFTER_MS)
  }

  /** § 3.1's last step: the 10 island's reveal, or back to the picker. */
  const onPartyEnd = (target: RaftTarget) =>
    go({ kind: 'picker', reveal: target === 10 })

  const firstShore = () => {
    const s = shoreRef.current
    shoreRef.current = undefined
    return s
  }

  const swap = {
    entering: view.key > 0 ? FadeIn.duration(RAFT_SWAP_MS) : undefined,
    exiting: FadeOut.duration(RAFT_SWAP_MS),
  }
  return (
    <Animated.View
      key={view.key}
      {...swap}
      pointerEvents="box-none"
      style={styles.fill}
    >
      {view.kind === 'picker' ? (
        <RaftPicker
          ponds={raftPicker(kit.area, kit.tablet, kit.landscape, [10, 20])}
          record={record}
          tablet={kit.tablet}
          reducedMotion={kit.reducedMotion}
          frameKey={kit.cancelKey}
          reveal={reveal}
          locked={reveal !== 'none'}
          onPick={onPick}
        />
      ) : (
        <TripOnce
          kit={kit}
          target={view.target}
          homes={record[view.target]}
          shore={firstShore}
          onFill={(w) => onFill(view.target, w)}
          onPartyEnd={() => onPartyEnd(view.target)}
        />
      )}
    </Animated.View>
  )
}

/** A trip, taking the first shore once as it mounts. */
function TripOnce({
  shore,
  ...props
}: {
  kit: GameKit
  target: RaftTarget
  homes: readonly RaftWeight[]
  shore: () => readonly number[] | undefined
  onFill: (w: RaftWeight) => void
  onPartyEnd: () => void
}) {
  const [first] = useState(shore)
  return <RaftCrossing {...props} shore={first} />
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
})
