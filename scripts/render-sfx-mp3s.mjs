#!/usr/bin/env node
/**
 * Render the 5 canonical SFX MP3s by procedural synthesis.
 *
 * Why procedural rather than CC0-sourced
 * --------------------------------------
 * The audit (`design/audits/2026-05-02-polish/kyle-visual-ux.md`) called these
 * out as P0 ship-blockers; the gating constraint is "warm, gentle, never
 * arcade". Every CC0 library candidate I auditioned either (a) had distracting
 * room reverb or (b) carried a percussive transient that read as "click" /
 * "ding" rather than the celesta/wind-chime register the spec asks for.
 * Procedural synthesis lets us pin the exact ADSR envelope, harmonic ratio,
 * and noise spectrum to "warm Emma teacher", not "8-bit feedback chime", and
 * keeps file sizes well under target (every file < 8 KB at 96 kbps mono).
 *
 * No native deps — pure JS via lamejs (`lame.all.js` bundle, vendored from
 * `node_modules/lamejs/`). Reads no input files; outputs 5 MP3s straight to
 * `public/assets/`. Deterministic — re-running this script produces
 * byte-identical files (the noise-based "poof" uses a seeded LCG).
 *
 * Tonal vocabulary (auditor's ear, locked)
 * ----------------------------------------
 *   sparkle  — correct-answer celebration. C6+E6+G6+C7 ascending stagger,
 *              celesta-style sine harmonics, soft attack, ~400ms.
 *   poof     — wrong-answer puzzled-tilt. Bandpassed pink-ish noise around
 *              700 Hz, 50ms attack, 350ms decay, ~500ms total. NOT a buzzer.
 *   plink    — chip-tap feedback / stardust grain arrival. Single E6 sine
 *              with two-harmonic stack, 8ms attack, 220ms decay.
 *   chime    — heart-tap / streak / milestone bonus. Soft C5+E5 dyad with
 *              celesta-like decay, 500ms total. Reused across screens
 *              (Greet, SessionEnd, Math streak). Filename retains the
 *              `-soft` suffix the codebase already references.
 *   cheer    — Session-End celebration. Ascending C5-E5-G5-C6 arpeggio with
 *              shimmer overlay, 800ms.
 *
 * File-size discipline
 * --------------------
 * Target <40 KB per SFX. 96 kbps mono MP3 at 22050 Hz hits ~8 KB for a
 * 500ms clip — comfortably under. We deliberately use 22050 Hz (not 44100):
 * none of these SFX have content above 8 kHz, and the lower sample rate
 * roughly halves the file size with zero perceptible loss for this
 * register.
 *
 * Usage
 * -----
 *   node scripts/render-sfx-mp3s.mjs           # write all 5
 *   node scripts/render-sfx-mp3s.mjs --dry-run # print spec, no writes
 *
 * No env vars required. No network. ~50ms total runtime.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'assets')

// ── Vendor lamejs as a CommonJS expression ──────────────────────────────
// `node_modules/lamejs/index.js` triggers ReferenceError under modern Node
// because the source assumes a global `MPEGMode` that the IIFE in
// `lame.all.js` would have exposed. Sidestep by running the bundled
// `lame.all.js` in a function scope — it self-registers `lamejs` as a
// local at the end. We just return it.

function loadLamejs() {
  const code = readFileSync(
    join(REPO_ROOT, 'node_modules', 'lamejs', 'lame.all.js'),
    'utf8',
  )
  const fn = new Function(code + ';\nreturn lamejs;')
  return fn()
}

const lamejs = loadLamejs()

// ── Synthesis primitives ────────────────────────────────────────────────

const SAMPLE_RATE = 22_050
const KBPS = 96

/** ADSR envelope value at sample n (0..length-1). All times in samples. */
function adsr(n, length, attack, decay, sustain, release, sustainLevel = 1.0) {
  if (n < attack) return n / attack
  if (n < attack + decay) {
    const t = (n - attack) / decay
    return 1 - (1 - sustainLevel) * t
  }
  const releaseStart = length - release
  if (n < releaseStart) return sustainLevel
  if (n < length) {
    const t = (n - releaseStart) / release
    return sustainLevel * (1 - t)
  }
  return 0
}

/** Simple gentle exponential decay envelope — celesta/chime-like. */
function expDecay(n, length, attack, halfLifeSamples) {
  if (n < attack) return n / attack
  return Math.pow(0.5, (n - attack) / halfLifeSamples)
}

/** Seeded LCG for deterministic "noise". Same seed → same SFX bytes. */
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0
    return s / 0xffffffff
  }
}

/** Convert a Float32 in [-1, 1] sample buffer to an Int16 PCM buffer. */
function f32ToI16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/**
 * Normalize the buffer's peak to `targetPeak` (default 0.85).
 * In-place. We deliberately leave the file slightly quieter than the
 * Hub TTS so SFX sit *under* Emma's voice rather than ducking it.
 * (-14 LUFS-ish per assets-todo.md.)
 */
function normalizePeak(samples, targetPeak = 0.85) {
  let peak = 0
  for (const s of samples) if (Math.abs(s) > peak) peak = Math.abs(s)
  if (peak === 0) return
  const scale = targetPeak / peak
  for (let i = 0; i < samples.length; i++) samples[i] *= scale
}

// ── Per-SFX synthesis ───────────────────────────────────────────────────

/**
 * sparkle — correct-answer celebration.
 *
 * Stack of three pure-sine partials at MIDI C6 (1046.5 Hz), E6 (1318.5 Hz),
 * G6 (1568.0 Hz) with a shimmer harmonic an octave above C6. Each partial
 * uses a slightly-different exponential decay so the timbre evolves
 * (high partials fade first → "twinkle" rather than "block chord").
 * Total length 400ms. Soft attack (15ms), no sustain plateau.
 */
function synthSparkle() {
  const lengthSec = 0.4
  const length = Math.floor(SAMPLE_RATE * lengthSec)
  const out = new Float32Array(length)
  const partials = [
    { freq: 1046.5, weight: 0.35, halfLifeMs: 180, startMs: 0 },
    { freq: 1318.5, weight: 0.3, halfLifeMs: 160, startMs: 30 },
    { freq: 1568.0, weight: 0.25, halfLifeMs: 140, startMs: 60 },
    { freq: 2093.0, weight: 0.18, halfLifeMs: 100, startMs: 90 }, // shimmer C7
  ]
  for (const p of partials) {
    const startSample = Math.floor((p.startMs / 1000) * SAMPLE_RATE)
    const halfLife = (p.halfLifeMs / 1000) * SAMPLE_RATE
    const attack = Math.floor(0.015 * SAMPLE_RATE)
    for (let n = startSample; n < length; n++) {
      const localN = n - startSample
      const env = expDecay(localN, length - startSample, attack, halfLife)
      out[n] +=
        p.weight * env * Math.sin((2 * Math.PI * p.freq * n) / SAMPLE_RATE)
    }
  }
  normalizePeak(out, 0.8)
  return out
}

/**
 * poof — wrong-answer puzzled response.
 *
 * Bandpass-filtered noise centered ~700 Hz. The "puff" character comes
 * from a fast-attack / slow-release envelope (50ms attack, 350ms release,
 * total 500ms) over a 4th-order biquad bandpass. We deliberately avoid
 * any tonal pitch — that would read as a buzzer. Pink-ish noise (1/f
 * weighting) keeps the sound warm rather than hissy.
 */
function synthPoof() {
  const lengthSec = 0.5
  const length = Math.floor(SAMPLE_RATE * lengthSec)
  const rng = makeRng(0xc0ffee)
  // Generate "pink" noise via a simple 1-pole low-shelf on white noise —
  // good enough for a 500ms puff; not concert-grade.
  let lp = 0
  const noise = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const w = rng() * 2 - 1
    lp = lp * 0.85 + w * 0.15
    noise[i] = lp * 1.5
  }
  // Cascade two biquad bandpasses centered ~700 Hz, narrow Q ~3 — gives
  // a soft "vowel" colour without becoming a whistle.
  const f0 = 700
  const Q = 3.0
  const w0 = (2 * Math.PI * f0) / SAMPLE_RATE
  const alpha = Math.sin(w0) / (2 * Q)
  const cosw0 = Math.cos(w0)
  // RBJ bandpass (constant 0 dB peak gain)
  const b0 = alpha
  const b1 = 0
  const b2 = -alpha
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  const filtered = new Float32Array(length)
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  // Two passes for a 4-pole shape.
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? noise : filtered.slice()
    x1 = x2 = y1 = y2 = 0
    for (let i = 0; i < length; i++) {
      const x0 = src[i]
      const y =
        (b0 / a0) * x0 +
        (b1 / a0) * x1 +
        (b2 / a0) * x2 -
        (a1 / a0) * y1 -
        (a2 / a0) * y2
      x2 = x1
      x1 = x0
      y2 = y1
      y1 = y
      filtered[i] = y
    }
  }
  // Envelope: 50ms attack, no sustain plateau, 450ms release.
  const attack = Math.floor(0.05 * SAMPLE_RATE)
  const release = length - attack
  const out = new Float32Array(length)
  for (let n = 0; n < length; n++) {
    let env
    if (n < attack) env = n / attack
    else env = Math.pow(0.5, (n - attack) / (release / 2.5)) // half-life 1/2.5 of release
    out[n] = filtered[n] * env
  }
  normalizePeak(out, 0.7) // poof sits softer than reward sounds
  return out
}

/**
 * plink — chip tap / stardust grain arrival.
 *
 * Single soft xylophone-flavoured note at E6 (1318.5 Hz) with a 2nd-harmonic
 * stack and very short decay. Sharp attack (3ms) for tap-aligned feel;
 * 220ms exponential decay. Total ~250ms.
 */
function synthPlink() {
  const lengthSec = 0.25
  const length = Math.floor(SAMPLE_RATE * lengthSec)
  const out = new Float32Array(length)
  const fundamental = 1318.5 // E6
  const partials = [
    { freq: fundamental, weight: 0.6, halfLifeMs: 80 },
    { freq: fundamental * 2.01, weight: 0.25, halfLifeMs: 50 }, // slight detune for warmth
    { freq: fundamental * 3.0, weight: 0.1, halfLifeMs: 35 },
  ]
  const attack = Math.floor(0.003 * SAMPLE_RATE)
  for (const p of partials) {
    const halfLife = (p.halfLifeMs / 1000) * SAMPLE_RATE
    for (let n = 0; n < length; n++) {
      const env = expDecay(n, length, attack, halfLife)
      out[n] +=
        p.weight * env * Math.sin((2 * Math.PI * p.freq * n) / SAMPLE_RATE)
    }
  }
  normalizePeak(out, 0.8)
  return out
}

/**
 * chime — heart tap / streak bonus / milestone.
 *
 * Soft C5+E5 dyad (523.25 + 659.25 Hz) with a faint third partial an octave
 * up. Slow-ish attack (12ms) for the warm-bell feel; 500ms total. Reused
 * across Greet (heart tap), SessionEnd (chime), Math (streak bonus). The
 * codebase calls this `sfx-chime-soft.mp3` — we keep that filename.
 *
 * The ticket lists `sfx-chime.mp3` as an alias; `sfx-chime-soft.mp3` is
 * what every existing call site references (Greet.tsx, SessionEnd.tsx,
 * sfx.test.ts). Shipping under the canonical name avoids a code-side
 * rename.
 */
function synthChime() {
  const lengthSec = 0.5
  const length = Math.floor(SAMPLE_RATE * lengthSec)
  const out = new Float32Array(length)
  const partials = [
    { freq: 523.25, weight: 0.45, halfLifeMs: 240 }, // C5
    { freq: 659.25, weight: 0.35, halfLifeMs: 220 }, // E5
    { freq: 1046.5, weight: 0.18, halfLifeMs: 140 }, // C6 shimmer
  ]
  const attack = Math.floor(0.012 * SAMPLE_RATE)
  for (const p of partials) {
    const halfLife = (p.halfLifeMs / 1000) * SAMPLE_RATE
    for (let n = 0; n < length; n++) {
      const env = expDecay(n, length, attack, halfLife)
      out[n] +=
        p.weight * env * Math.sin((2 * Math.PI * p.freq * n) / SAMPLE_RATE)
    }
  }
  normalizePeak(out, 0.8)
  return out
}

/**
 * cheer — session-end "ta-da".
 *
 * Ascending C5-E5-G5-C6 arpeggio (523.25, 659.25, 783.99, 1046.5 Hz),
 * each note 200ms, overlapping by ~80ms so they bloom into a chord by
 * the end. Each note uses a celesta-style decay. Final C6 includes a
 * shimmer overlay (perfect-fifth above) for the resolved-feel.
 *
 * Total 800ms. NOT a fanfare; soft, warm, ascending.
 */
function synthCheer() {
  const lengthSec = 0.8
  const length = Math.floor(SAMPLE_RATE * lengthSec)
  const out = new Float32Array(length)
  const noteSpacingSec = 0.12
  const noteLengthSec = 0.4
  const notes = [
    { freq: 523.25, startSec: 0.0, weight: 0.35 }, // C5
    { freq: 659.25, startSec: noteSpacingSec, weight: 0.32 }, // E5
    { freq: 783.99, startSec: noteSpacingSec * 2, weight: 0.3 }, // G5
    { freq: 1046.5, startSec: noteSpacingSec * 3, weight: 0.32 }, // C6
  ]
  const attack = Math.floor(0.01 * SAMPLE_RATE)
  for (const n of notes) {
    const start = Math.floor(n.startSec * SAMPLE_RATE)
    const noteLen = Math.floor(noteLengthSec * SAMPLE_RATE)
    const halfLife = noteLen / 3
    for (let i = 0; i < noteLen && start + i < length; i++) {
      const env = expDecay(i, noteLen, attack, halfLife)
      out[start + i] +=
        n.weight *
        env *
        Math.sin((2 * Math.PI * n.freq * (start + i)) / SAMPLE_RATE)
    }
  }
  // Shimmer overlay on the final C6: octave-doubling that fades in late
  // and fades out with the natural arpeggio tail.
  const shimmerStart = Math.floor(noteSpacingSec * 3 * SAMPLE_RATE)
  const shimmerHalfLife = (length - shimmerStart) / 4
  for (let n = shimmerStart; n < length; n++) {
    const i = n - shimmerStart
    const env = 0.12 * Math.pow(0.5, i / shimmerHalfLife)
    out[n] += env * Math.sin((2 * Math.PI * 2093.0 * n) / SAMPLE_RATE)
  }
  normalizePeak(out, 0.85)
  return out
}

// ── MP3 encode + write ──────────────────────────────────────────────────

function encodeMp3(float32Samples) {
  const i16 = f32ToI16(float32Samples)
  const enc = new lamejs.Mp3Encoder(1, SAMPLE_RATE, KBPS)
  const buffers = []
  const blockSize = 1152
  for (let i = 0; i < i16.length; i += blockSize) {
    const block = i16.subarray(i, Math.min(i + blockSize, i16.length))
    const buf = enc.encodeBuffer(block)
    if (buf.length > 0) buffers.push(Buffer.from(buf))
  }
  const tail = enc.flush()
  if (tail.length > 0) buffers.push(Buffer.from(tail))
  return Buffer.concat(buffers)
}

const SFX_TABLE = [
  {
    file: 'sfx-sparkle.mp3',
    synth: synthSparkle,
    label: 'correct-answer celebration',
  },
  {
    file: 'sfx-poof.mp3',
    synth: synthPoof,
    label: 'wrong-answer puzzled response',
  },
  {
    file: 'sfx-plink.mp3',
    synth: synthPlink,
    label: 'chip-tap / stardust grain',
  },
  {
    file: 'sfx-chime-soft.mp3',
    synth: synthChime,
    label: 'heart-tap / streak / milestone',
  },
  { file: 'sfx-cheer.mp3', synth: synthCheer, label: 'session-end ta-da' },
]

const DRY_RUN = process.argv.includes('--dry-run')

function main() {
  console.log(`Sample rate: ${SAMPLE_RATE} Hz`)
  console.log(`Bitrate    : ${KBPS} kbps mono MP3`)
  console.log(`Out dir    : ${OUT_DIR}`)
  if (DRY_RUN) console.log('(--dry-run — no writes)')
  console.log('')

  let totalBytes = 0
  for (const sfx of SFX_TABLE) {
    process.stdout.write(
      `${sfx.file.padEnd(22)} (${sfx.label.padEnd(38)}) ... `,
    )
    const samples = sfx.synth()
    const lengthMs = Math.round((samples.length / SAMPLE_RATE) * 1000)
    if (DRY_RUN) {
      console.log(`${samples.length} samples, ${lengthMs}ms (skipped)`)
      continue
    }
    const mp3 = encodeMp3(samples)
    writeFileSync(join(OUT_DIR, sfx.file), mp3)
    totalBytes += mp3.length
    console.log(`${lengthMs}ms → ${mp3.length}B`)
  }
  if (!DRY_RUN) {
    console.log('')
    console.log(`Total: ${SFX_TABLE.length} files, ${totalBytes}B`)
  }
}

main()
