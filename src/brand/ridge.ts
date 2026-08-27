/**
 * Canonical geometry for the ridge motif.
 *
 * This module is the single source of truth, mirroring `src/brand/marks.ts`:
 * the React component in `src/components/Ridge` and the imagery generator in
 * `scripts/generate-seed-imagery.ts` both render from these definitions, so
 * the ridge on the site and the exported files can never drift apart.
 *
 * The motif is a field of contour lines rising to the Summit M skyline, with
 * the amber goal above the summit. It is generated deterministically — there
 * are no assets and no randomness — so the same geometry can be drawn at any
 * size, in the browser or into a bitmap.
 */

/** The drawing surface every path below is expressed in. */
export const W = 800
export const H = 600

/** Summit M skyline on the 96-grid (see marks.ts), mapped into the viewBox. */
const SKYLINE = [
  [16, 82],
  [33, 46],
  [46, 72],
  [61, 38],
  [80, 82],
] as const

/** The amber goal, floating clear above the summit. */
export const GOAL = [61, 17.5] as const

export const mapX = (x: number) => 40 + x * 7.5
export const mapY = (y: number) => 20 + y * 5.3

const FLOOR = mapY(82)

const skylineAt = (X: number): number => {
  const pts = SKYLINE.map(([x, y]) => [mapX(x), mapY(y)] as const)
  if (X <= pts[0][0]) return FLOOR
  if (X >= pts[pts.length - 1][0]) return FLOOR
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    if (X >= x0 && X <= x1) {
      const t = (X - x0) / (x1 - x0)
      return y0 + (y1 - y0) * t
    }
  }
  return FLOOR
}

const STEP = 5
const SAMPLES = Array.from({ length: W / STEP + 1 }, (_, i) => i * STEP)
const BASE = SAMPLES.map(skylineAt)

const blurred = (radius: number): number[] => {
  if (radius <= 0) return BASE
  return BASE.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(BASE.length - 1, Math.max(0, i + k))
      sum += BASE[j]
      n++
    }
    return sum / n
  })
}

const fmt = (n: number) => Math.round(n * 10) / 10

/** Vertical distance between successive contour lines, in viewBox units. */
export const LINE_DROP = 8.5

/**
 * The most lines that still fit inside the viewBox. Beyond this the lowest
 * contours fall past `H` and are clipped, which reads as a flat hatch rather
 * than as a receding field — fine where the motif deliberately runs off the
 * bottom edge, wrong where its full depth is meant to be visible.
 */
export const MAX_UNCLIPPED_LINES = Math.floor((H - FLOOR) / LINE_DROP)

export const buildRidgePaths = (lines: number): string[] => {
  const paths: string[] = []
  for (let i = 0; i < lines; i++) {
    const t = Math.pow(i / Math.max(1, lines - 1), 1.25)
    const drop = i * LINE_DROP
    const ys = blurred(Math.round(i * 0.9))
    const d = SAMPLES.map((X, j) => {
      const y = ys[j] * (1 - t) + FLOOR * t + drop
      return `${j === 0 ? 'M' : 'L'}${fmt(X)} ${fmt(y)}`
    }).join(' ')
    paths.push(d)
  }
  return paths
}

/** Stroke opacity for the nth of `lines` contours — the field fades as it recedes. */
export const strokeOpacityAt = (i: number, lines: number) =>
  0.92 - 0.72 * (i / Math.max(1, lines - 1))

/**
 * A viewBox window of the given aspect ratio that contains the whole 800x600
 * composition. The motif is never cropped and never stretched — the window
 * simply gains ground on whichever axis is short. `bias` slides the content
 * within that spare room: 0 centres it, -1 pushes it flush to the left/top
 * edge, +1 flush to the right/bottom.
 */
export const windowFor = (
  aspect: number,
  bias = 0,
): { x: number; y: number; width: number; height: number } => {
  if (aspect >= W / H) {
    const width = H * aspect
    return { x: ((W - width) / 2) * (1 + bias), y: 0, width, height: H }
  }
  const height = W / aspect
  return { x: 0, y: ((H - height) / 2) * (1 + bias), width: W, height }
}

interface RidgeSVGOptions {
  width: number
  height: number
  /** Solid ground colour. Flat by design — a gradient this large posterises. */
  ground: string
  /** Contour stroke colour. */
  stroke: string
  /** Amber goal colour; omit to draw the ridge without it. */
  accent?: string
  lines?: number
  /** Weight of a contour line in *output* pixels, so it reads the same at any
   *  export size. The horizon line is drawn heavier. */
  strokePx?: number
  /** Overall opacity of the contour field against the ground. */
  fieldOpacity?: number
  /** Slides the composition within the spare ground — see `windowFor`. */
  bias?: number
}

/**
 * A standalone SVG document of the ridge on a solid ground — the form the
 * imagery generator rasterises. Mirrors `markSVG` in the brand generator.
 */
export const ridgeSVG = ({
  width,
  height,
  ground,
  stroke,
  accent,
  lines = MAX_UNCLIPPED_LINES,
  strokePx = 2.4,
  fieldOpacity = 1,
  bias = 0,
}: RidgeSVGOptions): string => {
  const view = windowFor(width / height, bias)
  // viewBox units per output pixel, so stroke weights can be given in pixels
  const unit = view.width / width
  const strokeWidth = fmt(strokePx * unit)

  const paths = buildRidgePaths(lines)
    .map(
      (d, i) =>
        `    <path d="${d}" stroke-opacity="${fmt(strokeOpacityAt(i, lines))}" stroke-width="${
          i === 0 ? fmt(strokeWidth * 1.75) : strokeWidth
        }"/>`,
    )
    .join('\n')

  const goal = accent
    ? `\n  <circle cx="${fmt(mapX(GOAL[0]))}" cy="${fmt(mapY(GOAL[1]))}" r="11" fill="${accent}"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${fmt(
    view.x,
  )} ${fmt(view.y)} ${fmt(view.width)} ${fmt(view.height)}">
  <rect x="${fmt(view.x)}" y="${fmt(view.y)}" width="${fmt(view.width)}" height="${fmt(
    view.height,
  )}" fill="${ground}"/>
  <g fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="${fieldOpacity}">
${paths}
  </g>${goal}
</svg>
`
}
