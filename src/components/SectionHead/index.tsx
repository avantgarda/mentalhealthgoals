import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * Opens a section: a heavy ink rule (the "chapter" boundary — rows within
 * lists keep the 1px hairline), then heading left and intro right on the grid.
 */
export const SectionHead: React.FC<{
  className?: string
  heading?: string | null
  intro?: string | null
}> = ({ className, heading, intro }) => {
  if (!heading && !intro) return null

  return (
    <div
      className={cn(
        'mb-8 grid grid-cols-1 gap-4 border-t-2 border-foreground pt-5 lg:mb-10 lg:grid-cols-12 lg:gap-x-10',
        className,
      )}
    >
      {heading && (
        <h2 className="display-2 lg:col-span-6" data-reveal>
          {heading}
        </h2>
      )}
      {intro && (
        <p className="lede lg:col-span-5 lg:col-start-8 lg:self-end" data-reveal>
          {intro}
        </p>
      )}
    </div>
  )
}
