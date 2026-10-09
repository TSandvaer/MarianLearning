// NativeWind PROBE (throwaway branch): mount N styled cells, time mount ->
// root onLayout, remount RUNS times, log each run to Metro.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

const nowMs = (): number =>
  (globalThis as { performance?: { now(): number } }).performance?.now() ??
  Date.now()
const N = 600
const RUNS = 12
const MODE = process.env.EXPO_PUBLIC_STYLE_BENCH_MODE ?? 'stylesheet'
const LABEL = process.env.EXPO_PUBLIC_STYLE_BENCH_LABEL ?? '?'

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF5F0' },
  cell: {
    margin: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFC0CB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  text: { fontSize: 12, color: '#3D2B3D', textAlign: 'center' },
})

function Cells() {
  const cells = []
  for (let i = 0; i < N; i++) {
    cells.push(
      MODE === 'classname' ? (
        <View
          key={i}
          className="m-0.5 items-center rounded-xl border-[3px] border-my-pink bg-white px-1.5 py-1"
        >
          <Text className="text-center text-xs text-ink">{i}</Text>
        </View>
      ) : (
        <View key={i} style={s.cell}>
          <Text style={s.text}>{i}</Text>
        </View>
      ),
    )
  }
  return <>{cells}</>
}

export function StyleBench() {
  // Alternate: an empty screen for 500 ms, then the N cells; time each
  // mount from the render that adds them to the root's onLayout.
  const [step, setStep] = useState(0)
  const t0 = useRef(0)
  const results = useRef<number[]>([])
  const run = Math.floor(step / 2)
  const mounted = step % 2 === 1
  if (mounted) t0.current = nowMs()
  useEffect(() => {
    if (!mounted && run < RUNS) {
      const id = setTimeout(() => setStep((x) => x + 1), 500)
      return () => clearTimeout(id)
    }
    if (run >= RUNS) {
      const r = results.current.slice(1) // drop the cold first run
      const sorted = [...r].sort((a, b) => a - b)
      const msg = `[style-bench] label=${LABEL} mode=${MODE} n=${N} runs=${JSON.stringify(results.current.map((x) => Math.round(x)))} median(warm)=${Math.round(sorted[Math.floor(sorted.length / 2)])}`
      console.log(msg)
      void fetch(`http://127.0.0.1:8499/?${encodeURIComponent(msg)}`).catch(
        () => {},
      )
    }
    return undefined
  }, [mounted, run])
  if (!mounted || run >= RUNS) return <View style={s.root} />
  return (
    <View
      key={run}
      style={s.root}
      onLayout={() => {
        results.current.push(nowMs() - t0.current)
        setTimeout(() => setStep((x) => x + 1), 300)
      }}
    >
      <Cells />
    </View>
  )
}
