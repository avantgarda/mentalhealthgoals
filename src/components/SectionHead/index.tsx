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
  /** Drop the chapter rule where one already sits directly above. */
  flush?: boolean
}> = ({ className, heading, intro, flush }) => {
  if (!heading && !intro) return null

  return (
    <div
      className={cn(
        'mb-8 grid grid-cols-1 gap-4 lg:mb-10 lg:grid-cols-12 lg:gap-x-10',
        flush ? 'pt-1' : 'chapter-rule border-t-2 border-foreground pt-5',
        className,
      )}
    >
      {heading && (
        <h2 className="display-2 lg:col-span-6" data-reveal>
          {heading}
        </h2>
      )}
      {intro && (
        <p
          // The intro sits beside the heading and settles on its baseline. On
          // its own there is no heading to sit beside, so it takes the reading
          // column from the left rather than floating two thirds across.
          className={cn(
            'lede',
            heading ? 'lg:col-span-5 lg:col-start-8 lg:self-end' : 'lg:col-span-8',
          )}
          data-reveal
        >
          {intro}
        </p>
      )}
    </div>
  )
}
