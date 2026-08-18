import clsx from 'clsx'
import React from 'react'

import { BRAND_NAME, BRAND_TAGLINE } from '@/brand/tokens'
import { DEFAULT_LOGO_VARIANT, type LogoVariant } from '@/brand/marks'
import { BrandMark } from './BrandMark'

interface Props {
  className?: string
  /** Which mark to show. Set from the Brand global; falls back to the default. */
  variant?: LogoVariant
  /** Show the "National Programme" line beneath the name. */
  showTagline?: boolean
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className, variant = DEFAULT_LOGO_VARIANT, showTagline = true } = props

  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <BrandMark className="h-9 w-9" variant={variant} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight whitespace-nowrap">
          {BRAND_NAME}
        </span>
        {showTagline && (
          <span className="text-[0.62rem] font-sans font-medium uppercase tracking-[0.22em] opacity-75 mt-1">
            {BRAND_TAGLINE}
          </span>
        )}
      </span>
    </span>
  )
}
