'use client'

import React, { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { Header as HeaderType } from '@/payload-types'

import { isActive, resolveHref } from './resolveHref'

/**
 * Disclosure menu for small screens: a single button that reveals the
 * navigation as a full-width ruled list beneath the header. Closes on Escape
 * and whenever the route changes.
 */
export const MobileMenu: React.FC<{ data: HeaderType }> = ({ data }) => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const navItems = data?.navItems || []

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-[2px] px-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-current hover:bg-foreground/[0.06]"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span aria-hidden="true" className="relative block h-3 w-5">
          <span
            className={[
              'absolute left-0 top-0 block h-px w-5 bg-current transition-transform duration-[var(--dur-ui)]',
              open ? 'translate-y-[5.5px] rotate-45' : '',
            ].join(' ')}
          />
          <span
            className={[
              'absolute left-0 top-[5.5px] block h-px w-5 bg-current transition-opacity duration-[var(--dur-ui)]',
              open ? 'opacity-0' : '',
            ].join(' ')}
          />
          <span
            className={[
              'absolute left-0 top-[11px] block h-px w-5 bg-current transition-transform duration-[var(--dur-ui)]',
              open ? '-translate-y-[5.5px] -rotate-45' : '',
            ].join(' ')}
          />
        </span>
        {open ? 'Close' : 'Menu'}
      </button>

      <div
        className="absolute inset-x-0 top-full z-30 border-y border-border bg-background text-foreground shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)]"
        hidden={!open}
        id={panelId}
      >
        <nav aria-label="Main navigation (mobile)" className="container py-2">
          <ul className="flex flex-col divide-y divide-border">
            {navItems.map(({ link }, i) => {
              const href = resolveHref(link)
              if (!href) return null
              const active = isActive(href, pathname)
              return (
                <li key={i}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className="group flex items-baseline justify-between gap-4 py-3.5 font-display text-[1.35rem] leading-tight"
                    href={href}
                  >
                    <span>{link.label}</span>
                    <span
                      aria-hidden="true"
                      className={[
                        'arrow font-sans text-base',
                        active ? 'text-brand-accent-text' : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {active ? '●' : '→'}
                    </span>
                  </Link>
                </li>
              )
            })}
            <li>
              <Link
                className="flex items-center justify-between gap-4 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground"
                href="/search"
              >
                Search the site
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
