'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Once-only scroll reveals. Elements opt in with `data-reveal`; when they
 * enter the viewport they receive `is-in` and the stylesheet fades them up.
 *
 * The stylesheet only hides `[data-reveal]` elements while
 * `html[data-motion="on"]` — so with motion off, reduced motion, or no
 * JavaScript at all, everything is simply visible. No content is ever gated
 * behind this observer.
 */
export const RevealObserver: React.FC = () => {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    const targets = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'))

    if (root.getAttribute('data-motion') !== 'on' || !('IntersectionObserver' in window)) {
      targets().forEach((el) => el.classList.add('is-in'))
      return
    }

    // Anything already on screen is shown immediately (no flash), and only
    // then does the stylesheet start hiding the not-yet-seen elements.
    const viewportBottom = window.innerHeight * 0.92
    targets().forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.top < viewportBottom && rect.bottom > 0) el.classList.add('is-in')
    })
    root.classList.add('js-reveal')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.02 },
    )

    targets().forEach((el) => observer.observe(el))

    // If motion is switched off while the page is open, show everything at once.
    const attrs = new MutationObserver(() => {
      if (root.getAttribute('data-motion') !== 'on') {
        targets().forEach((el) => el.classList.add('is-in'))
      }
    })
    attrs.observe(root, { attributes: true, attributeFilter: ['data-motion'] })

    return () => {
      observer.disconnect()
      attrs.disconnect()
    }
  }, [pathname])

  return null
}
