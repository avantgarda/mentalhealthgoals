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
  /**
   * Where the drawing sits when its box is wider than 4:3. `right` presses it
   * against the box's right edge — the hero anchors that edge just past the
   * viewport, so the floor lines always run off screen while the summit stays
   * fully in view. `center` for symmetric placements.
   */
  align?: 'center' | 'right'
  /**
   * Dissolve the contours into the ground at their left edge instead of
   * stopping at one. Only the wide hero placement wants this: there the
   * drawing is cut by the copy's column rather than by anything in the
   * drawing, and a hard vertical edge announces the crop. Placements that end
   * on their own geometry (the mobile horizon, the 404) do not.
   */
  fadeLeft?: boolean
}

/* Only the wide hero fades, and a page carries one of those, so fixed ids are
   safe and keep this component renderable on the server. */
const FADE_GRADIENT_ID = 'ridge-fade-gradient'
const FADE_MASK_ID = 'ridge-fade-mask'

export const Ridge: React.FC<Props> = ({
  className,
  lines = 22,
  goal = true,
  fit = 'surface',
  align = 'center',
  fadeLeft = false,
}) => {
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
      preserveAspectRatio={align === 'right' ? 'xMaxYMid meet' : 'xMidYMid meet'}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {fadeLeft && (
        <defs>
          {/* The ramp is in the mask rect's own bounding box, so it follows
              the drawing through `preserveAspectRatio` scaling rather than
              being pinned to user units. Opaque by 30% of the width: the
              summit and its shoulders are never touched, only the long floor
              contours running out to the left. */}
          <linearGradient id={FADE_GRADIENT_ID} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask
            height={box.height}
            id={FADE_MASK_ID}
            maskUnits="userSpaceOnUse"
            width={box.width}
            x={box.x}
            y={box.y}
          >
            <rect
              fill={`url(#${FADE_GRADIENT_ID})`}
              height={box.height}
              width={box.width}
              x={box.x}
              y={box.y}
            />
          </mask>
        </defs>
      )}
      {/* The mask sits on the group and the draw-in clip on each path, so the
          two never contend for the same property. */}
      <g mask={fadeLeft ? `url(#${FADE_MASK_ID})` : undefined}>
        {paths.map((d, i) => (
          <path
            d={d}
            key={i}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={strokeOpacityAt(i, lines)}
            strokeWidth={i === 0 ? 2 : 1}
            style={{ ['--i' as string]: i } as React.CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {/* Outside the mask: the goal is the one thing that must never fade. */}
      {goal && <circle className="ridge-goal" cx={gx} cy={gy} fill="var(--brand-accent)" r={11} />}
    </svg>
  )
}
