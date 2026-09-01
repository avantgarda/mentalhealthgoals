/**
 * Generates the placeholder imagery the seed uploads into the Media library.
 *
 * Geometry comes from `src/brand/ridge.ts` and colours from
 * `src/brand/tokens.ts` — the same modules the site renders from — so the
 * imagery cannot drift from the identity in use.
 *
 * These are stand-ins for commissioned photography, not artwork in their own
 * right. They exist so the layouts have something honest in them before a
 * shoot happens, and so they can be swapped in the admin without touching code.
 *
 * They are rendered at 3840 wide — the largest width Next's optimizer will
 * ever request — so no screen receives an upscale. The earlier sets (1600,
 * then 2800) were being stretched ~1.4x on retina laptops, and interpolation
 * smears exactly what this artwork is made of: hairline strokes.
 *
 * Stroke weights are chosen for the WORST display, not the best: a DPR-1
 * screen shows these at half the master's pixels, and a 2.4px master stroke
 * lands there as 1.2 devices pixels — a line that is mostly anti-aliasing by
 * area, which reads as pixelation. 3.4px keeps it a hairline on retina
 * (~1.7 CSS px) while giving DPR-1 enough ink to hold an edge.
 *
 * No amber goal in any of these: they are used as cover-cropped backgrounds
 * (post heroes crop 3:2 to roughly 2:1, the og size crops to 1200x630), so
 * where the goal lands is luck — cut at the frame edge more often than not.
 * The goal appears only in the live svg heroes, where composition is
 * controlled. The grounds are flat: a
 * gradient at this size posterises into visible bands, and the contour field
 * is what carries the depth anyway.
 *
 *   pnpm generate:seed-imagery
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { MAX_UNCLIPPED_LINES, ridgeSVG } from '../src/brand/ridge.js'
import { BRAND_COLORS } from '../src/brand/tokens.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_DIR = path.resolve(dirname, '../src/endpoints/seed')

interface Asset {
  file: string
  width: number
  height: number
  /** Why this one exists and where it lands, for the log and for the reader. */
  note: string
  svg: string
}

const assets: Asset[] = [
  {
    file: 'mhg-hero.webp',
    width: 3840,
    height: 2160,
    note: 'full-bleed 16:9 — home CTA band and media blocks (mountain only, no goal)',
    svg: ridgeSVG({
      width: 3840,
      height: 2160,
      ground: BRAND_COLORS.deep,
      stroke: BRAND_COLORS.reversed,
      lines: MAX_UNCLIPPED_LINES,
      strokePx: 3.6,
      fieldOpacity: 0.68,
      // Pushed right, so the flat left third stays clear for overlaid type.
      bias: 0.55,
    }),
  },
  {
    file: 'mhg-card-teal.webp',
    width: 3840,
    height: 2560,
    note: '3:2 — post heroes and card art, the quieter of the two',
    svg: ridgeSVG({
      width: 3840,
      height: 2560,
      ground: BRAND_COLORS.petrol,
      stroke: BRAND_COLORS.reversed,
      lines: MAX_UNCLIPPED_LINES,
      strokePx: 3.4,
      fieldOpacity: 0.5,
      bias: -0.35,
    }),
  },
  {
    file: 'mhg-card-amber.webp',
    width: 3840,
    height: 2560,
    note: '3:2 — the Forum hero and card art, drawn in amber',
    svg: ridgeSVG({
      width: 3840,
      height: 2560,
      ground: BRAND_COLORS.deep,
      stroke: BRAND_COLORS.amberOnDark,
      lines: MAX_UNCLIPPED_LINES,
      strokePx: 3.4,
      fieldOpacity: 0.62,
      bias: 0.2,
    }),
  },
]

const run = async (): Promise<void> => {
  for (const { file, width, height, note, svg } of assets) {
    const out = path.join(SEED_DIR, file)
    await sharp(Buffer.from(svg), { density: 96 })
      .resize(width, height)
      // Near-lossless: these are flat colour and thin strokes, where WebP's
      // lossy mode smears the contour lines and bands the ground.
      .webp({ quality: 95, effort: 6 })
      .toFile(out)

    const { size } = await fs.stat(out)
    console.log(`  ${file.padEnd(20)} ${width}x${height}  ${(size / 1024).toFixed(0)}KB  — ${note}`)
  }

  console.log(`\n✓ Wrote ${assets.length} placeholder images to src/endpoints/seed`)
  console.log('  Run `pnpm seed` to load them, or re-upload them in Globals → Media.')
}

await run()
