import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * The ridge motif: a field of contour lines rising to the Summit M skyline
 * from `src/brand/marks.ts`, with the amber goal above the summit. Generated
 * deterministically at render time (no assets), drawn in once when motion is
 * on — see `.ridge` in globals.css — and rendered complete otherwise.
 */

const W = 800
const H = 600

// Summit M skyline on the 96-grid (see marks.ts), mapped into the viewBox.
const SKYLINE = [
  [16, 82],
  [33, 46],
  [46, 72],
  [61, 38],
  [80, 82],
] as const
const GOAL = [61, 17.5] as const
const mapX = (x: number) => 40 + x * 7.5
const mapY = (y: number) => 20 + y * 5.3
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

export const buildRidgePaths = (lines: number): string[] => {
  const paths: string[] = []
  for (let i = 0; i < lines; i++) {
    const t = Math.pow(i / Math.max(1, lines - 1), 1.25)
    const drop = i * 8.5
    const ys = blurred(Math.round(i * 0.9))
    const d = SAMPLES.map((X, j) => {
      const y = ys[j] * (1 - t) + FLOOR * t + drop
      return `${j === 0 ? 'M' : 'L'}${fmt(X)} ${fmt(y)}`
    }).join(' ')
    paths.push(d)
  }
  return paths
}

type Props = {
  className?: string
  /** Number of contour lines. */
  lines?: number
  /** Hide the amber goal (e.g. when used as a quiet divider). */
  goal?: boolean
}

export const Ridge: React.FC<Props> = ({ className, lines = 22, goal = true }) => {
  const paths = buildRidgePaths(lines)
  const [gx, gy] = [mapX(GOAL[0]), mapY(GOAL[1])]

  return (
    <svg
      aria-hidden="true"
      className={cn('ridge block', className)}
      fill="none"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((d, i) => (
        <path
          d={d}
          key={i}
          pathLength={1}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.92 - 0.72 * (i / Math.max(1, lines - 1))}
          strokeWidth={i === 0 ? 2 : 1}
          style={{ ['--i' as string]: i } as React.CSSProperties}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {goal && <circle className="ridge-goal" cx={gx} cy={gy} fill="var(--brand-accent)" r={11} />}
    </svg>
  )
}
