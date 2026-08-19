import clsx from 'clsx'
import React from 'react'

import { DEFAULT_LOGO_VARIANT, MARKS, MARK_VIEWBOX, type LogoVariant } from '@/brand/marks'

interface Props {
  className?: string
  variant?: LogoVariant
  /** Rendered as the accessible name; omit for decorative use alongside the wordmark. */
  title?: string
  /** Explicit pixel size. Use where utility classes are unavailable, e.g. the admin panel. */
  size?: number
}

/**
 * The programme mark on its own. Form strokes inherit `currentColor` so the
 * mark follows the surrounding text colour in light and dark themes; the goal
 * is always brand amber.
 */
export const BrandMark: React.FC<Props> = ({
  className,
  variant = DEFAULT_LOGO_VARIANT,
  title,
  size,
}) => {
  const mark = MARKS[variant] ?? MARKS[DEFAULT_LOGO_VARIANT]

  return (
    <svg
      className={clsx('shrink-0', className)}
      viewBox={MARK_VIEWBOX}
      fill="none"
      height={size}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {title ? <title>{title}</title> : null}
      {mark.elements.map((el, i) => {
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
