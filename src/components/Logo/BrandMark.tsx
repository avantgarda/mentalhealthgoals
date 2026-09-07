import clsx from 'clsx'
import React from 'react'

import {
  DEFAULT_LOGO_VARIANT,
  MARK_HEIGHT,
  MARKS,
  markElements,
  markViewBox,
  markWidth,
  type LogoVariant,
} from '@/brand/marks'

interface Props {
  className?: string
  variant?: LogoVariant
  /** Rendered as the accessible name; omit for decorative use alongside the wordmark. */
  title?: string
  /**
   * Explicit pixel height. Width follows the mark's own aspect ratio. Use where
   * utility classes are unavailable, e.g. the admin panel.
   */
  size?: number
  /** Draw the simplified small-size glyph instead of the full mark. */
  compact?: boolean
}

/**
 * The programme mark on its own. Form strokes inherit `currentColor` so the
 * mark follows the surrounding text colour in light and dark themes; the goal
 * is always brand amber.
 *
 * Wide marks keep their aspect ratio: style with a height and `w-auto`, or
 * pass `size`, rather than forcing a square box.
 */
export const BrandMark: React.FC<Props> = ({
  className,
  variant = DEFAULT_LOGO_VARIANT,
  title,
  size,
  compact = false,
}) => {
  const resolved: LogoVariant = variant in MARKS ? variant : DEFAULT_LOGO_VARIANT
  const mode = compact ? 'compact' : 'full'
  const aspect = markWidth(resolved, mode) / MARK_HEIGHT

  return (
    <svg
      className={clsx('shrink-0', className)}
      viewBox={markViewBox(resolved, mode)}
      fill="none"
      height={size}
      width={size === undefined ? undefined : Math.round(size * aspect)}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {title ? <title>{title}</title> : null}
      {markElements(resolved, mode).map((el, i) => {
        const color = el.role === 'form' ? 'currentColor' : 'var(--brand-accent, #CE7A3B)'

        if (el.kind === 'path') {
          return (
            <path
              d={el.d}
              fill="none"
              key={i}
              stroke={color}
              strokeLinecap={el.linecap}
              strokeLinejoin={el.linejoin}
              strokeOpacity={el.opacity}
              strokeWidth={el.strokeWidth}
            />
          )
        }

        if (el.strokeWidth) {
          return (
            <circle
              cx={el.cx}
              cy={el.cy}
              fill="none"
              key={i}
              r={el.r}
              stroke={color}
              strokeOpacity={el.opacity}
              strokeWidth={el.strokeWidth}
            />
          )
        }

        return (
          <circle cx={el.cx} cy={el.cy} fill={color} fillOpacity={el.opacity} key={i} r={el.r} />
        )
      })}
    </svg>
  )
}
