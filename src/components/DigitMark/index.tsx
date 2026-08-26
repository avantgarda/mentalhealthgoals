import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * The DIGIT mark — four outer nodes linked to a central hub, redrawn from the
 * team's own logo in the site's line language so it sits in the petrol
 * identity rather than fighting it. Strokes inherit `currentColor`.
 */
export const DigitMark: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => {
  const nodes = [
    [16, 16],
    [64, 16],
    [16, 64],
    [64, 64],
  ] as const

  return (
    <svg
      aria-hidden={title ? undefined : 'true'}
      className={cn('shrink-0', className)}
      fill="none"
      role={title ? 'img' : undefined}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {/* square edges */}
      <path
        d="M16 16 H64 M16 64 H64 M16 16 V64 M64 16 V64"
        stroke="currentColor"
        strokeWidth={2.5}
      />
      {/* spokes to the hub */}
      <path
        d="M16 16 L40 40 M64 16 L40 40 M16 64 L40 40 M64 64 L40 40"
        stroke="currentColor"
        strokeWidth={2.5}
      />
      {/* nodes, punched out so the lines read as passing behind them */}
      {nodes.map(([cx, cy]) => (
        <circle cx={cx} cy={cy} fill="var(--background)" key={`${cx}-${cy}`} r={7.5} />
      ))}
      {nodes.map(([cx, cy]) => (
        <circle
          cx={cx}
          cy={cy}
          key={`ring-${cx}-${cy}`}
          r={7.5}
          stroke="currentColor"
          strokeWidth={2.5}
        />
      ))}
      <circle cx={40} cy={40} fill="var(--background)" r={9} />
      <circle cx={40} cy={40} r={9} stroke="currentColor" strokeWidth={2.5} />
    </svg>
  )
}
