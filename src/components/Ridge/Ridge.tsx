import React from 'react'

import {
  buildRidgePaths,
  contentBounds,
  GOAL,
  H,
  mapX,
  mapY,
  strokeOpacityAt,
  W,
} from '@/brand/ridge'
import { cn } from '@/utilities/ui'

/**
 * The ridge motif: a field of contour lines rising to the Summit M skyline,
 * with the amber goal above the summit. Geometry comes from `src/brand/ridge.ts`
 * — the same module the imagery generator renders from — so the motif on the
 * page and the exported files cannot drift apart. Drawn in once when motion is
 * on (see `.ridge` in globals.css) and rendered complete otherwise.
 */

type Props = {
  className?: string
  /** Number of contour lines. Past `MAX_UNCLIPPED_LINES` the lowest contours
   *  fall outside the viewBox — right where the motif runs off the bottom of
   *  a tall panel, wrong where its full depth should be visible. */
  lines?: number
  /** Hide the amber goal (e.g. when used as a quiet divider). */
  goal?: boolean
  /**
   * `surface` keeps the full 800x600 drawing surface, so the motif has sky
   * above it — right when it fills a tall panel beside the copy.
   * `content` trims the viewBox to the ink, so a standalone motif is only as
   * tall as it needs to be.
   */
  fit?: 'surface' | 'content'
}

export const Ridge: React.FC<Props> = ({ className, lines = 22, goal = true, fit = 'surface' }) => {
  const paths = buildRidgePaths(lines)
  const [gx, gy] = [mapX(GOAL[0]), mapY(GOAL[1])]
  const box =
    fit === 'content' ? contentBounds(lines, { goal }) : { x: 0, y: 0, width: W, height: H }

  return (
    <svg
      aria-hidden="true"
      className={cn('ridge block', className)}
      fill="none"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
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
          strokeOpacity={strokeOpacityAt(i, lines)}
          strokeWidth={i === 0 ? 2 : 1}
          style={{ ['--i' as string]: i } as React.CSSProperties}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {goal && <circle className="ridge-goal" cx={gx} cy={gy} fill="var(--brand-accent)" r={11} />}
    </svg>
  )
}
