'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SearchIcon } from 'lucide-react'

import type { Header as HeaderType } from '@/payload-types'

import { cn } from '@/utilities/ui'
import { isActive, resolveHref } from './resolveHref'

export const HeaderNav: React.FC<{ className?: string; data: HeaderType }> = ({
  className,
  data,
}) => {
  const navItems = data?.navItems || []
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className={cn('items-center gap-x-6 text-[0.9rem] font-medium', className)}
    >
      {navItems.map(({ link }, i) => {
        const href = resolveHref(link)
        if (!href) return null
        const active = isActive(href, pathname)
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className="link-line py-1 text-current"
            href={href}
            key={i}
            {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
          >
            {link.label}
          </Link>
        )
      })}
      <Link
        aria-label="Search"
        className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-[2px] transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.06]"
        href="/search"
      >
        <SearchIcon aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
      </Link>
    </nav>
  )
}
