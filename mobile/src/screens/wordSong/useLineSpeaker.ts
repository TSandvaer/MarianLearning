/**
 * Emma's lines on Word Song and the caption they drive (web WordSong's
 * `speak`): the ribbon shows the line from its first sound, reveals it
 * word by word with the ticks, and ends fully shown. Never rejects: a line
 * that fails or is replaced just ends (the web logs and carries on).
 *
 * Per-line hooks: `onWordTick` (the web's blend highlight fallback),
 * `onTime` (the clip's clock, for the marks-driven blend) and `revealAt`
 * (the caption follows the marks instead of the even ticks: each grapheme
 * appears at its mark, word-song-native.md § 5).
 *
 * A replaced line never touches the newer line's caption (`generation`).
 * `speaking` is true while any line is in flight (letters and the picture
 * are inert then, § 4).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { recordAudio } from '../../audio'
import type {
  PlayWordSongUtteranceFn,
  PlayWordSongUtteranceOptions,
} from './wordSongTypes'

export interface Caption {
  text: string
  revealed: number
  visible: boolean
  /** Bumped per line: the ribbon re-enters for a new line. */
  generation: number
}

const EMPTY: Caption = { text: '', revealed: 0, visible: false, generation: 0 }

export interface SpeakHooks {
  onWordTick?: (wordIndex: number) => void
  onTime?: (ms: number) => void
  revealAt?: (ms: number) => number
  /** Another player for this line (the session guide's lines). */
  play?: PlayWordSongUtteranceFn
}

export interface LineSpeaker {
  caption: Caption
  speaking: boolean
  speak: (text: string, hooks?: SpeakHooks) => Promise<void>
  clearCaption: () => void
  /** Lines started and not ended yet. */
  linesInFlight: RefObject<number>
  unmounted: RefObject<boolean>
}

export function useLineSpeaker(
  playRef: RefObject<PlayWordSongUtteranceFn>,
): LineSpeaker {
  const [caption, setCaption] = useState<Caption>(EMPTY)
  const [speaking, setSpeaking] = useState(false)
  const generationRef = useRef(0)
  const linesInFlight = useRef(0)
  const unmounted = useRef(false)

  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
    }
  }, [])

  const speak = useCallback<LineSpeaker['speak']>(
    async (text, hooks) => {
      const myLine = ++generationRef.current
      setCaption({ text, revealed: 0, visible: false, generation: myLine })
      const words = text.split(/\s+/).filter(Boolean).length
      const mine = () => !unmounted.current && myLine === generationRef.current
      const reveal = (n: number) =>
        setCaption((c) => (n > c.revealed ? { ...c, revealed: n } : c))
      const opts: PlayWordSongUtteranceOptions = {
        onPlay: () => {
          if (mine()) setCaption((c) => ({ ...c, visible: true }))
        },
        onWordTick: (i) => {
          if (!mine()) return
          if (!hooks?.revealAt) reveal(i + 1)
          hooks?.onWordTick?.(i)
        },
        onTime: (ms) => {
          if (!mine()) return
          if (hooks?.revealAt) reveal(hooks.revealAt(ms))
          hooks?.onTime?.(ms)
        },
      }
      linesInFlight.current += 1
      setSpeaking(true)
      try {
        await (hooks?.play ?? playRef.current)(text, opts)
      } catch (err) {
        recordAudio({
          kind: 'note',
          label: 'word-song',
          detail: `line ended early (${err instanceof Error ? err.message : String(err)}): "${text}"`,
        })
      } finally {
        linesInFlight.current -= 1
        if (!unmounted.current && linesInFlight.current === 0) {
          setSpeaking(false)
        }
        if (mine()) {
          setCaption((c) => ({ ...c, visible: true, revealed: words }))
        }
      }
    },
    [playRef],
  )

  const clearCaption = useCallback(() => {
    generationRef.current += 1
    setCaption({ ...EMPTY, generation: generationRef.current })
  }, [])

  return { caption, speaking, speak, clearCaption, linesInFlight, unmounted }
}
