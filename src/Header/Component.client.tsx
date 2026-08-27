'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import type { BrandSettings } from '@/brand/getBrand'
import { HeaderNav } from './Nav'
import { MobileMenu } from './Nav/MobileMenu'

interface HeaderClientProps {
  brand: BrandSettings
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ brand, data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  return (
    <header
      className={[
        'relative z-20',
        // When rendered over a dark hero, the header needs its own dark background on
        // small screens where the hero does not extend up behind it
        theme === 'dark'
          ? 'bg-brand-deep lg:bg-transparent'
          : 'border-b border-border/70 bg-background',
      ].join(' ')}
      {...(theme ? { 'data-theme': theme } : {})}
    >
      <div className="container flex h-[4.25rem] items-center justify-between gap-6 text-foreground lg:h-[4.75rem]">
        <Link href="/" className="shrink-0" aria-label="Mental Health Goals — home">
          <Logo
            loading="eager"
            priority="high"
            showTagline={brand.showTagline}
            variant={brand.variant}
          />
        </Link>
        <HeaderNav className="hidden lg:flex" data={data} />
        <MobileMenu data={data} />
      </div>
    </header>
  )
}
