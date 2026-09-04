'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import type { BrandSettings } from '@/brand/getBrand'
import { HeaderNav } from './Nav'
import { MobileMenu } from './Nav/MobileMenu'

interface HeaderClientProps {
  brand: BrandSettings
  data: Header
}

/** Past this, the bar has earned the right to get out of the way. Short
 *  scrolls near the top should never hide it. */
const HIDE_BELOW = 220
/** Ignore the jitter of a trackpad settling, so the bar does not flicker. */
const DIRECTION_THRESHOLD = 6

export const HeaderClient: React.FC<HeaderClientProps> = ({ brand, data }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  const ref = useRef<HTMLElement>(null)
  const lastY = useRef(0)
  // Away from the top, so the bar's own ground appears instead of the hero's.
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // `null` has to travel too: it is how a page without a dark hero says "no
  // opinion", which lets the server-side rule in globals.css theme the header
  // instead. Ignoring it left the previous page's theme in place after a
  // client-side navigation.
  useEffect(() => {
    if (headerTheme !== theme) setTheme(headerTheme ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  // A fresh page starts at the top, and a client-side navigation does not fire
  // a scroll event — without this the bar could arrive already hidden.
  useEffect(() => {
    lastY.current = window.scrollY
    setScrolled(window.scrollY > 8)
    setHidden(false)
  }, [pathname])

  useEffect(() => {
    const evaluate = () => {
      const y = Math.max(window.scrollY, 0)
      const delta = y - lastY.current
      setScrolled(y > 8)

      // Hiding is motion. With the site's motion toggle off — or the operating
      // system asking for reduced motion — the bar simply stays put, which is
      // a perfectly good sticky header and never animates underneath anyone.
      const motion = document.documentElement.getAttribute('data-motion')
      const mayHide =
        motion === 'on' ||
        (motion === null && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

      if (!mayHide || y <= HIDE_BELOW) {
        setHidden(false)
      } else if (delta > DIRECTION_THRESHOLD) {
        setHidden(true)
      } else if (delta < -DIRECTION_THRESHOLD) {
        setHidden(false)
      }

      if (Math.abs(delta) > DIRECTION_THRESHOLD) lastY.current = y
    }

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        evaluate()
      })
    }

    evaluate()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Publishes its own height so an anchor jump or a focus move never lands
  // underneath the bar — WCAG 2.2 SC 2.4.11, the same contract the sticky
  // call-to-action honours from the other end of the screen.
  useEffect(() => {
    const root = document.documentElement
    const publish = () => {
      root.style.setProperty('--header-h', `${ref.current?.offsetHeight ?? 0}px`)
    }
    publish()
    window.addEventListener('resize', publish)
    return () => {
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--header-h')
    }
  }, [])

  // Tabbing into a hidden bar has to bring it back, or focus lands on a link
  // nobody can see.
  const reveal = useCallback(() => setHidden(false), [])

  // Transparent only while it is actually over the hero. Once the hero has
  // scrolled away the bar takes its own ground and drops the dark override, so
  // it follows the visitor's chosen site theme rather than forcing light.
  const overHero = theme === 'dark' && !scrolled

  return (
    <header
      className={[
        'sticky top-0 z-40 transition-transform duration-[var(--dur-ui)] ease-[var(--ease-out)]',
        hidden ? '-translate-y-full' : 'translate-y-0',
        // Opaque, not frosted: a translucent bar let the copy underneath ghost
        // through it, and blur is the wrong material for a flat, ruled page.
        overHero ? 'bg-brand-deep lg:bg-transparent' : 'border-b border-border/70 bg-background',
      ].join(' ')}
      data-stuck={scrolled ? '' : undefined}
      onFocus={reveal}
      ref={ref}
      {...(overHero ? { 'data-theme': 'dark' } : {})}
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
