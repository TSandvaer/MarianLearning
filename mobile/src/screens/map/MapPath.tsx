/**
 * The path region (web `map-path` in `src/screens/Map/MapScreen.tsx`):
 * one tinted clay band per land (land 1 at the bottom), stepping stones,
 * land pills, the current stop's glow, Emma's badge, the gates and the
 * stops, in the web's stacking order. Laid out by core's `layoutMap` on
 * the virtual region `pathFrame` picks, then scaled into the real one, so
 * every piece shrinks together.
 */
import {
  badgeLands,
  emmaBadge,
  GATE_TAP,
  layoutMap,
} from '@marian/core/map/mapLayout'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { pathFrame, type MapScreenLayout } from '../../layout/mapLayout'
import { LandPill, MapBand } from './mapChrome'
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
  const { visit, view, pose, wiggles, tapStop, tapGate } = state
  const { model } = view
  const { path } = layout
  const rooms = badgeLands(model, visit.alsoBadged).size
  const frame = pathFrame(path, layout.landscape, model.lands.length, rooms)
  const geo = useMemo(
    () => layoutMap(model, frame.width, frame.height, visit.alsoBadged),
    [model, frame.width, frame.height, visit.alsoBadged],
  )
  const emmaStop = geo.stops.find((s) => s.node === view.emmaNode)
  const emmaBox = emmaStop ? emmaBadge(emmaStop) : null
  const currentStop = model.complete
    ? undefined
    : geo.stops.find((s) => s.node === model.current)
  const ready = frame.width > 0 && frame.height > 0

  return (
    <View
      testID="map-path"
      style={[
        styles.abs,
        { left: path.x, top: path.y, width: path.width, height: path.height },
      ]}
    >
      {ready && (
        <View
          style={[
            styles.abs,
            styles.frame,
            {
              width: frame.width,
              height: frame.height,
              transform: [{ scale: frame.scale }],
            },
          ]}
        >
          {geo.bands.map((band, i) => (
            <MapBand
              key={band.land}
              index={i}
              land={band.land}
              top={band.top}
              height={band.height}
              faded={view.fadedLand === band.land}
            />
          ))}
          {geo.stones.map((st, i) => (
            <StoneView key={i} index={i} x={st.x} y={st.y} walked={st.walked} />
          ))}
          {geo.pills.map((p) => (
            <LandPill
              key={p.land}
              world={visit.world}
              land={p.land}
              side={p.side}
              top={p.top}
              showNumber={model.showLandNumber}
            />
          ))}
          {currentStop && (
            <CurrentGlow
              x={currentStop.x}
              y={currentStop.y}
              size={currentStop.size}
              reducedMotion={reducedMotion}
            />
          )}
          {emmaBox && (
            <MapEmmaBadge
              node={view.emmaNode}
              left={emmaBox.left}
              top={emmaBox.top}
              size={emmaBox.size}
              height={emmaBox.height}
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
                x={g.x}
                y={g.y}
                size={GATE_TAP}
                swinging={view.swingingLand === g.land}
                reducedMotion={reducedMotion}
                onPress={() => tapGate(land)}
              />
            )
          })}
          {model.lands.flatMap((land) =>
            land.stops.map((stop) => {
              const pos = geo.stops.find((s) => s.node === stop.node)!
              return (
                <MapStopView
                  key={stop.node}
                  stop={stop}
                  x={pos.x}
                  y={pos.y}
                  size={pos.size}
                  reducedMotion={reducedMotion}
                  bloom={view.bloomNode === stop.node}
                  popping={view.poppingNode === stop.node}
                  wiggle={wiggles[stop.node] ?? 0}
                  onPress={() => tapStop(stop)}
                />
              )
            }),
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  frame: { left: 0, top: 0, transformOrigin: '0 0' },
})
