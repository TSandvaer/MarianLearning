/**
 * The path pane (web `map-path`; map-native § 1): one tinted clay band per
 * land (land 1 at the bottom), stepping stones, land pills, the current
 * stop's glow, Emma's badge, the gates and the stops, in the web's draw
 * order. Core's `layoutMap` lays it out in virtual px; every value is
 * drawn × s (no `transform: scale`, so hit areas stay real-size).
 *
 * Phone landscape may scroll (`mapPathScale`), and so may a portrait world
 * of more than 6 lands (content wave 3 T6): a vertical ScrollView opened
 * on the focus box, not animated, with one indicator flash; no scrolling
 * until the unlock beat reaches Emma's line.
 */
import {
  emmaBadge,
  GATE_TAP,
  layoutMap,
  type StopLayout,
} from '@marian/core/map/mapLayout'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native'
import {
  focusBox,
  mapPathScale,
  openingOffset,
  type MapScreenLayout,
} from '../../layout/mapScreenLayout'
import { LandPill, MapBand } from './landParts'
import { MapEmmaBadge } from './MapEmmaBadge'
import { CurrentGlow, StoneView } from './mapFx'
import { MapGateView } from './MapGate'
import { MapStopView } from './MapStop'
import type { MapVisitState } from './useMapVisit'

export function MapPath({
  layout,
  state,
  reducedMotion,
}: {
  layout: MapScreenLayout
  state: MapVisitState
  reducedMotion: boolean
}) {
  const {
    visit,
    view,
    pose,
    wiggles,
    launching,
    launches,
    tapStop,
    tapGate,
    tapPane,
    debugLog,
  } = state
  const { model } = view
  const { pane } = layout
  const k = mapPathScale(pane, model, visit.alsoBadged, layout.landscape)
  const { s } = k
  const geo = useMemo(
    () => layoutMap(model, k.virtualW, k.virtualH, visit.alsoBadged),
    [model, k.virtualW, k.virtualH, visit.alsoBadged],
  )
  const stopAt = (node: string) => geo.stops.find((x) => x.node === node)
  const emmaStop = stopAt(view.emmaNode)
  const emmaBox = emmaStop ? emmaBadge(emmaStop) : null
  const currentStop = model.complete ? undefined : stopAt(model.current)
  // Debug only: where the path layer sits, so a stop's rect (path-layer
  // pt) maps to the tap's page point.
  useEffect(() => {
    debugLog?.(
      `[map-stop] pane=${Math.round(pane.x)},${Math.round(pane.y)} ${Math.round(pane.width)}x${Math.round(pane.height)} scrolls=${k.scrolls} s=${s.toFixed(3)}`,
    )
    // Once on mount (debug only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const layer = (
    <View
      style={[styles.layer, { width: pane.width, height: k.contentH }]}
      testID={k.scrolls ? 'map-path-scrolls' : 'map-path-fits'}
    >
      {/* Peek prompt § 5: a tap on the map outside every stop and gate
          closes an open prompt; stops and gates sit above it. */}
      <Pressable
        testID="map-pane-tap"
        accessible={false}
        onPress={tapPane}
        style={styles.fill}
      />
      {geo.bands.map((band, i) => (
        <MapBand
          key={band.land}
          index={i}
          land={band.land}
          top={band.top * s}
          height={band.height * s}
          s={s}
          faded={view.fadedLand === band.land}
          reducedMotion={reducedMotion}
        />
      ))}
      {geo.stones.map((st, i) => (
        <StoneView
          key={i}
          index={i}
          x={st.x * s}
          y={st.y * s}
          s={s}
          walked={st.walked}
        />
      ))}
      {geo.pills.map((p) => (
        <LandPill
          key={p.land}
          world={visit.world}
          land={p.land}
          side={p.side}
          top={p.top * s}
          s={s}
          showNumber={model.showLandNumber}
        />
      ))}
      {currentStop && (
        <CurrentGlow
          x={currentStop.x * s}
          y={currentStop.y * s}
          size={currentStop.size * s}
          s={s}
          reducedMotion={reducedMotion}
        />
      )}
      {emmaBox && (
        <MapEmmaBadge
          node={view.emmaNode}
          left={emmaBox.left * s}
          top={emmaBox.top * s}
          size={emmaBox.size * s}
          height={emmaBox.height * s}
          s={s}
          pose={pose}
          hopping={view.hopping}
          reducedMotion={reducedMotion}
        />
      )}
      {geo.gates.map((g) => {
        const land = model.lands.find((l) => l.number === g.land)!
        return (
          <MapGateView
            key={g.land}
            land={g.land}
            open={land.open}
            x={g.x * s}
            y={g.y * s}
            size={GATE_TAP * s}
            s={s}
            swinging={view.swingingLand === g.land}
            reducedMotion={reducedMotion}
            onPress={() => tapGate(land)}
          />
        )
      })}
      {model.lands.flatMap((land) =>
        land.stops.map((stop) => {
          const pos = stopAt(stop.node)!
          return (
            <MapStopView
              key={stop.node}
              stop={stop}
              x={pos.x * s}
              y={pos.y * s}
              size={pos.size * s}
              s={s}
              reducedMotion={reducedMotion}
              bloom={view.bloomNode === stop.node}
              popping={view.poppingNode === stop.node}
              wiggle={wiggles[stop.node] ?? 0}
              launches={launches(stop)}
              launching={launching === stop.node}
              onPress={(tap) => tapStop(stop, tap)}
              debugLog={debugLog}
            />
          )
        }),
      )}
    </View>
  )

  const rect = {
    left: pane.x,
    top: pane.y,
    width: pane.width,
    height: pane.height,
  }
  if (!k.scrolls) {
    return (
      <View testID="map-path" style={[styles.abs, rect]}>
        {layer}
      </View>
    )
  }
  // The focus: Emma and her stop (+ tray); on a beat, both stops.
  const nodes = visit.unlock
    ? [visit.unlock.mastered, visit.unlock.unlocked]
    : [model.current]
  const boxes = nodes
    .map(stopAt)
    .filter((x): x is StopLayout => x !== undefined)
    .map(focusBox)
  const offset = openingOffset(boxes, s, pane.height, k.contentH)
  return (
    <ScrollablePath
      key={`${pane.width}x${pane.height}`}
      rect={rect}
      offset={offset}
      locked={view.tapsWait}
    >
      {layer}
    </ScrollablePath>
  )
}

function ScrollablePath({
  rect,
  offset,
  locked,
  children,
}: {
  rect: { left: number; top: number; width: number; height: number }
  offset: number
  locked: boolean
  children: ReactNode
}) {
  const ref = useRef<ScrollViewInstance>(null)
  const opened = useRef(false)
  return (
    <ScrollView
      ref={ref}
      testID="map-path"
      style={[styles.abs, rect]}
      scrollEnabled={!locked}
      showsVerticalScrollIndicator
      onContentSizeChange={() => {
        if (opened.current) return
        opened.current = true
        ref.current?.scrollTo({ y: offset, animated: false })
        ref.current?.flashScrollIndicators()
      }}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  layer: { position: 'relative' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
