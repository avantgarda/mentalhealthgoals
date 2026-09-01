'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { Page } from '@/payload-types'

import { Button } from '@/components/ui/button'

/**
 * A bar that follows the visitor down a long page.
 *
 * The Forum page runs to nearly six screens on desktop and over eight on a
 * phone, and its only call to action sat 84% of the way down — so a visitor
 * had no way to act until they had scrolled past the entire agenda. This keeps
 * the ask in reach without putting it in the way.
 *
 * It stays out of the way in three ways: it waits until the hero has scrolled
 * past, it steps aside when the page reaches its own closing call to action
 * (`data-cta-band`) so the same ask is never on screen twice, and it can be
 * dismissed for the rest of the session.
 */
const DISMISS_EVENT = 'mhg:sticky-cta-dismissed'

/** Dismissals made this page load, so the bar still closes where a browser
 *  refuses sessionStorage (private windows, blocked site data). */
const dismissedThisLoad = new Set<string>()

const isDismissed = (key: string): boolean => {
  if (dismissedThisLoad.has(key)) return true
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

const subscribeToDismissal = (onChange: () => void) => {
  window.addEventListener(DISMISS_EVENT, onChange)
  return () => window.removeEventListener(DISMISS_EVENT, onChange)
}

export const StickyCta: React.FC<NonNullable<Page['stickyCta']>> = ({
  enabled,
  href,
  label,
  message,
}) => {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const [past, setPast] = useState(false)
  const [askIsOnScreen, setAtClosingCta] = useState(false)

  const storageKey = `sticky-cta-dismissed:${pathname}`

  // Dismissal is per page and per session: a visitor who waves it away on the
  // Forum page should not lose it everywhere, or forever. Read through
  // useSyncExternalStore so the server renders it closed and the first client
  // frame is already correct — the same shape the motion toggle uses.
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => isDismissed(storageKey),
    () => true,
  )

  const dismiss = useCallback(() => {
    dismissedThisLoad.add(storageKey)
    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // Nothing to do: the in-memory set already closed it for this load.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }, [storageKey])

  useEffect(() => {
    if (!enabled) return

    const evaluate = () => {
      // Nothing to follow the visitor down on a page that barely scrolls.
      setPast(
        document.documentElement.scrollHeight > window.innerHeight * 1.6 &&
          window.scrollY > window.innerHeight * 0.5,
      )
    }

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        evaluate()
      })
    }

    // Synchronously, not through the throttle: a page restored mid-scroll
    // should not wait on a frame that a backgrounded tab never paints.
    evaluate()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !('IntersectionObserver' in window)) return

    // Stand down while the ask is already in front of the visitor: the page's
    // own closing CTA band, and — when the bar points at an anchor on this
    // page — the block it points at. Asking someone to go somewhere they are
    // already standing is just clutter.
    const targets = new Set(document.querySelectorAll('[data-cta-band]'))
    if (href?.startsWith('#')) {
      const destination = document.getElementById(href.slice(1))
      if (destination) targets.add(destination)
    }
    if (targets.size === 0) return

    const seen = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target)
          else seen.delete(entry.target)
        }
        setAtClosingCta(seen.size > 0)
      },
      { threshold: 0.1 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [enabled, href])

  const visible = Boolean(enabled && href && label && past && !askIsOnScreen && !dismissed)

  // Publishes its own height so anchor jumps and focus moves clear the bar —
  // WCAG 2.2 SC 2.4.11, Focus Not Obscured.
  useEffect(() => {
    const root = document.documentElement
    if (!visible) {
      root.style.removeProperty('--sticky-cta-h')
      return
    }
    const publish = () => {
      root.style.setProperty('--sticky-cta-h', `${ref.current?.offsetHeight ?? 0}px`)
    }
    publish()
    window.addEventListener('resize', publish)
    return () => {
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--sticky-cta-h')
    }
  }, [visible])

  if (!enabled || !href || !label) return null

  return (
    <div
      aria-label="Page call to action"
      className={[
        'fixed inset-x-0 bottom-0 z-40 transition-transform duration-[var(--dur-ui)] ease-[var(--ease-out)]',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      data-sticky-cta
      data-visible={visible ? '' : undefined}
      // Off-screen it must not be a tab stop either.
      inert={!visible}
      ref={ref}
      role="complementary"
    >
      <div className="border-t border-white/15 bg-brand-deep text-white" data-theme="dark">
        <div className="container flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5 lg:py-3.5">
          {/* Narrow: the message takes its own line and is clamped, so a long
              one cannot grow the bar until it swallows the page. Wide: it
              shares the line with the button. */}
          {message && (
            <p className="line-clamp-2 w-full text-[0.9rem] leading-snug text-white/85 sm:line-clamp-none sm:w-auto sm:min-w-0 sm:flex-1">
              {message}
            </p>
          )}
          <div className="flex w-full shrink-0 items-center justify-between gap-1 sm:w-auto sm:justify-end">
            <Button asChild size="sm">
              <Link href={href}>{label}</Link>
            </Button>
            <button
              aria-label="Dismiss this bar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] text-lg leading-none text-white/60 transition-colors duration-[var(--dur-ui)] hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              onClick={dismiss}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
