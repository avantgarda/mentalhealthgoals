import * as React from 'react'

/**
 * A field's share of the row.
 *
 * The form builder stores width as a percentage. Rendered as a flex basis
 * (rather than a max-width on a stacked block) two 50% fields actually sit
 * side by side, and anything narrower than half falls back to a full row on
 * small screens where pairing would crush both.
 */
export const Width: React.FC<{
  children: React.ReactNode
  className?: string
  width?: number | string
}> = ({ children, className, width }) => {
  const share = typeof width === 'string' ? Number(width) : width
  const paired = typeof share === 'number' && Number.isFinite(share) && share < 100

  return (
    <div
      className={[
        'flex min-w-0 flex-col gap-2',
        paired ? 'w-full sm:w-[calc(50%-0.625rem)]' : 'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
