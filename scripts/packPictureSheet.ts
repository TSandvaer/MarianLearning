/**
 * Contact sheet for one batch of generated pack pictures: one row per word,
 * the current pack picture first, then each variant, all on the pack's cream
 * so transparent edges read the way they will in the app.
 */

import { existsSync } from 'node:fs'
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'

export interface SheetRow {
  word: string
  tier: string
  distinctFrom: string[]
  /** Absolute path of the current pack picture, or null if none ships yet. */
  currentPath: string | null
  /** Absolute paths for v1..vK; null where that variant is not on disk. */
  variantPaths: (string | null)[]
}

const CELL = 256
const GAP = 16
const LABEL_W = 240
const CAPTION_H = 30
const HEADER_H = 72
const ROW_H = CELL + CAPTION_H + GAP
const CREAM = '#FFF6EE'
const INK = '#2B2B2B'
const MUTED = '#8A8A8A'
const FONT = 'Helvetica, Arial, sans-serif'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

async function cellImage(path: string | null): Promise<Buffer | null> {
  if (path === null || !existsSync(path)) return null
  try {
    return await sharp(path)
      .resize(CELL, CELL, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

export async function buildContactSheet(
  batch: number,
  rows: SheetRow[],
): Promise<Buffer> {
  const variantCount = Math.max(1, ...rows.map((r) => r.variantPaths.length))
  const cols = 1 + variantCount // current + variants
  const width = GAP + LABEL_W + cols * (CELL + GAP)
  const height = HEADER_H + rows.length * ROW_H + GAP

  const svg: string[] = []
  const overlays: OverlayOptions[] = []

  svg.push(
    `<text x="${GAP}" y="34" font-family="${FONT}" font-size="26" font-weight="bold" fill="${INK}">Batch ${batch} · ${rows.length} word(s)</text>`,
    `<text x="${GAP}" y="58" font-family="${FONT}" font-size="15" fill="${MUTED}">Pick with: npx tsx scripts/generatePackPictures.ts --pick word=v1,word=v2</text>`,
  )

  for (const [ri, row] of rows.entries()) {
    const top = HEADER_H + ri * ROW_H
    svg.push(
      `<text x="${GAP}" y="${top + 44}" font-family="${FONT}" font-size="34" font-weight="bold" fill="${INK}">${esc(row.word)}</text>`,
      `<text x="${GAP}" y="${top + 72}" font-family="${FONT}" font-size="15" fill="${MUTED}">tier: ${esc(row.tier)}</text>`,
    )
    if (row.distinctFrom.length > 0) {
      svg.push(
        `<text x="${GAP}" y="${top + 96}" font-family="${FONT}" font-size="15" fill="${MUTED}">not like: ${esc(truncate(row.distinctFrom.join(', '), 26))}</text>`,
      )
    }

    const cells: { label: string; path: string | null; missing: string }[] = [
      {
        label: 'current',
        path: row.currentPath,
        missing: 'no current picture',
      },
      ...Array.from({ length: variantCount }, (_, k) => ({
        label: `${row.word} = v${k + 1}`,
        path: row.variantPaths[k] ?? null,
        missing: 'not generated',
      })),
    ]

    for (const [ci, cell] of cells.entries()) {
      const left = GAP + LABEL_W + ci * (CELL + GAP)
      svg.push(
        `<rect x="${left}" y="${top}" width="${CELL}" height="${CELL}" rx="8" fill="${CREAM}"/>`,
        `<text x="${left + CELL / 2}" y="${top + CELL + 22}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="${ci === 0 ? 'normal' : 'bold'}" fill="${ci === 0 ? MUTED : INK}">${esc(cell.label)}</text>`,
      )
      const img = await cellImage(cell.path)
      if (img) {
        overlays.push({ input: img, left, top })
      } else {
        svg.push(
          `<text x="${left + CELL / 2}" y="${top + CELL / 2}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="${MUTED}">${esc(cell.missing)}</text>`,
        )
      }
    }
  }

  const layer = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg.join('')}</svg>`,
  )

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: layer, left: 0, top: 0 }, ...overlays])
    .png()
    .toBuffer()
}
