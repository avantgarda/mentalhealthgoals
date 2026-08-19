/**
 * Generates the complete static asset set for every logo variant into
 * `public/brand/<variant>/`.
 *
 * Geometry comes from `src/brand/marks.ts` and colours from
 * `src/brand/tokens.ts`, so exported files can never drift from the marks
 * rendered on the site.
 *
 *   pnpm generate:brand
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { LOGO_VARIANTS, MARKS, markElementsToSVG, type LogoVariant } from '../src/brand/marks.js'
import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE } from '../src/brand/tokens.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_BRAND_DIR = path.resolve(dirname, '../public/brand')

const SERIF_STACK = "Fraunces, 'Iowan Old Style', 'Palatino Nova', Georgia, serif"
const SANS_STACK = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** A standalone SVG document containing just the mark. */
const markSVG = (
  variant: LogoVariant,
  colors: { form: string; accent: string },
  { size = 96, background }: { size?: number; background?: { fill: string; radius: number } } = {},
): string => {
  const bg = background
    ? `\n    <rect width="96" height="96" rx="${background.radius}" fill="${background.fill}"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-label="${MARKS[variant].label}">${bg}
    ${markElementsToSVG(variant, colors)}
</svg>
`
}

/**
 * Horizontal lockup: mark beside the two-line wordmark.
 *
 * Type is set as live text with a font stack rather than outlines — correct for
 * digital use where Fraunces is loaded. For print or third-party use, convert
 * the text to outlines first (see public/brand/README.md).
 */
const lockupHorizontalSVG = (
  variant: LogoVariant,
  colors: { form: string; accent: string; text: string },
): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="96" viewBox="0 0 520 96" role="img" aria-label="${BRAND_NAME} — ${BRAND_TAGLINE}">
  <g transform="translate(0 0)">
    ${markElementsToSVG(variant, colors)}
  </g>
  <text x="112" y="47" font-family="${SERIF_STACK}" font-size="30" font-weight="600" letter-spacing="-0.3" fill="${colors.text}">${BRAND_NAME}</text>
  <text x="113" y="68" font-family="${SANS_STACK}" font-size="11.5" font-weight="500" letter-spacing="2.6" fill="${colors.text}" opacity="0.75">${BRAND_TAGLINE.toUpperCase()}</text>
</svg>
`

/** Stacked lockup: mark above centred type, for square placements. */
const lockupStackedSVG = (
  variant: LogoVariant,
  colors: { form: string; accent: string; text: string },
): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" role="img" aria-label="${BRAND_NAME} — ${BRAND_TAGLINE}">
  <g transform="translate(152 0)">
    ${markElementsToSVG(variant, colors)}
  </g>
  <text x="200" y="146" text-anchor="middle" font-family="${SERIF_STACK}" font-size="30" font-weight="600" letter-spacing="-0.3" fill="${colors.text}">${BRAND_NAME}</text>
  <text x="200" y="171" text-anchor="middle" font-family="${SANS_STACK}" font-size="11.5" font-weight="500" letter-spacing="2.6" fill="${colors.text}" opacity="0.75">${BRAND_TAGLINE.toUpperCase()}</text>
</svg>
`

/** 1200x630 social card: deep ground, mark, name and descriptor. */
const ogSVG = (variant: LogoVariant): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BRAND_COLORS.deep}"/>
  <g transform="translate(96 150) scale(2.05)">
    ${markElementsToSVG(variant, { form: BRAND_COLORS.reversed, accent: BRAND_COLORS.amberOnDark })}
  </g>
  <text x="96" y="418" font-family="${SERIF_STACK}" font-size="76" font-weight="600" letter-spacing="-1.4" fill="${BRAND_COLORS.reversed}">${BRAND_NAME}</text>
  <text x="99" y="470" font-family="${SANS_STACK}" font-size="23" font-weight="500" letter-spacing="5" fill="${BRAND_COLORS.amberOnDark}">${BRAND_TAGLINE.toUpperCase()}</text>
  <text x="99" y="528" font-family="${SANS_STACK}" font-size="25" fill="${BRAND_COLORS.reversed}" opacity="0.72">A UK Government-backed national programme</text>
  <text x="99" y="562" font-family="${SANS_STACK}" font-size="25" fill="${BRAND_COLORS.reversed}" opacity="0.72">transforming mental health research</text>
</svg>
`

/**
 * Avatar: mark reversed out of a deep field, sized so nothing important is lost
 * when a platform crops it to a circle (content stays inside the inscribed circle).
 */
const avatarSVG = (variant: LogoVariant): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND_COLORS.deep}"/>
  <g transform="translate(88 88) scale(3.5)">
    ${markElementsToSVG(variant, { form: BRAND_COLORS.reversed, accent: BRAND_COLORS.amberOnDark })}
  </g>
</svg>
`

const png = async (svg: string, size: number, out: string): Promise<void> => {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
}

const writeVariant = async (variant: LogoVariant): Promise<string[]> => {
  const dir = path.join(PUBLIC_BRAND_DIR, variant)
  await fs.mkdir(dir, { recursive: true })

  const written: string[] = []
  const write = async (file: string, contents: string) => {
    await fs.writeFile(path.join(dir, file), contents, 'utf8')
    written.push(file)
  }

  const onLight = { form: BRAND_COLORS.petrol, accent: BRAND_COLORS.amber }
  const onDark = { form: BRAND_COLORS.reversed, accent: BRAND_COLORS.amberOnDark }

  // --- Vector masters -------------------------------------------------------
  await write('mark.svg', markSVG(variant, onLight))
  await write('mark-on-dark.svg', markSVG(variant, onDark))
  await write(
    'mark-mono-black.svg',
    markSVG(variant, { form: BRAND_COLORS.monoBlack, accent: BRAND_COLORS.monoBlack }),
  )
  await write(
    'mark-mono-white.svg',
    markSVG(variant, { form: BRAND_COLORS.monoWhite, accent: BRAND_COLORS.monoWhite }),
  )
  await write(
    'lockup-horizontal.svg',
    lockupHorizontalSVG(variant, { ...onLight, text: BRAND_COLORS.ink }),
  )
  await write(
    'lockup-horizontal-on-dark.svg',
    lockupHorizontalSVG(variant, { ...onDark, text: BRAND_COLORS.reversed }),
  )
  await write(
    'lockup-stacked.svg',
    lockupStackedSVG(variant, { ...onLight, text: BRAND_COLORS.ink }),
  )

  // Favicon master: mark reversed out of a rounded deep tile, which holds up
  // against both light and dark browser chrome far better than a bare mark.
  const faviconSvg = markSVG(variant, onDark, {
    background: { fill: BRAND_COLORS.deep, radius: 20 },
  })
  await write('favicon.svg', faviconSvg)

  // --- Raster exports -------------------------------------------------------
  const rasters: Array<[string, number]> = [
    ['favicon-16.png', 16],
    ['favicon-32.png', 32],
    ['favicon-48.png', 48],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]

  for (const [file, size] of rasters) {
    await png(faviconSvg, size, path.join(dir, file))
    written.push(file)
  }

  await sharp(Buffer.from(avatarSVG(variant)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, 'avatar-512.png'))
  written.push('avatar-512.png')

  await sharp(Buffer.from(ogSVG(variant)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, 'og.png'))
  written.push('og.png')

  // Transparent PNG of the plain mark, for slide decks and documents.
  await png(markSVG(variant, onLight), 512, path.join(dir, 'mark-512.png'))
  written.push('mark-512.png')
  await png(markSVG(variant, onDark), 512, path.join(dir, 'mark-on-dark-512.png'))
  written.push('mark-on-dark-512.png')

  return written
}

const README = `# MHGP brand assets

Generated by \`pnpm generate:brand\` from \`src/brand/marks.ts\`. **Do not edit these
files by hand** — change the geometry or colours at source and regenerate, or the
site and the exports will disagree.

One directory per logo variant. The variant in use across the site is set in the
Payload admin under **Globals → Brand & Logo**; the header, footer, browser tab
icon and social card all follow that setting.

## What is in each directory

| File | Use |
|---|---|
| \`mark.svg\` | Primary mark, petrol + amber, for light grounds |
| \`mark-on-dark.svg\` | Reversed mark for dark grounds |
| \`mark-mono-black.svg\` / \`mark-mono-white.svg\` | Single-colour versions for embroidery, engraving, faxable documents, and any partner template that demands one colour |
| \`lockup-horizontal.svg\` | Mark + wordmark, the default signature |
| \`lockup-horizontal-on-dark.svg\` | The same reversed |
| \`lockup-stacked.svg\` | Mark above wordmark, for square placements |
| \`favicon.svg\` | Rounded deep tile + reversed mark |
| \`favicon-16/32/48.png\` | Browser tabs and bookmarks |
| \`apple-touch-icon.png\` | 180 px, iOS home screen |
| \`icon-192.png\`, \`icon-512.png\` | PWA / Android |
| \`avatar-512.png\` | Social profile pictures — safe under a circular crop |
| \`og.png\` | 1200x630 social sharing card |
| \`mark-512.png\`, \`mark-on-dark-512.png\` | Transparent PNGs for slides and documents |

## Usage rules

- **Clear space**: keep free space equal to the height of the mark's amber goal
  on all sides of the lockup.
- **Minimum size**: lockup 140 px / 30 mm wide; mark alone 16 px / 8 mm.
- **Do not** rotate, recolour, stretch, add effects to, or reconstruct the marks.
- Over photography, use the reversed mark on a sufficiently dark area, or place
  the favicon tile version.

## Type in the lockups

The wordmark in the lockup SVGs is live text set in Fraunces with a serif
fallback. That is correct for the web, where the site loads Fraunces. Before
sending a lockup to a printer or an external partner, open it in a vector editor
and **convert the text to outlines** so it renders identically everywhere.
`

const run = async (): Promise<void> => {
  await fs.mkdir(PUBLIC_BRAND_DIR, { recursive: true })

  for (const variant of LOGO_VARIANTS) {
    const written = await writeVariant(variant)
    console.log(`${variant.padEnd(10)} ${written.length} files -> public/brand/${variant}/`)
  }

  await fs.writeFile(path.join(PUBLIC_BRAND_DIR, 'README.md'), README, 'utf8')
  console.log('README.md written')
  console.log('\nDone.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
