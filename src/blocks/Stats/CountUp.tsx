'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Renders the final value on the server; when motion is on, counts up once
 * the element scrolls into view. Non-numeric values are rendered verbatim.
 */
export const CountUp: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.documentElement.getAttribute('data-motion') !== 'on') return

    const match = value.match(/^([^\d]*)([\d][\d,]*(?:\.\d+)?)(.*)$/)
    if (!match) return
    const [, prefix, num, suffix] = match
    const target = parseFloat(num.replace(/,/g, ''))
    if (!Number.isFinite(target)) return
    const decimals = (num.split('.')[1] || '').length
    const useGrouping = num.includes(',')
    const fmt = (n: number) =>
      prefix +
      n.toLocaleString('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping,
      }) +
      suffix

    let raf = 0
    const run = () => {
      const start = performance.now()
      const duration = 900
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(fmt(target * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
        else setDisplay(value)
      }
      setDisplay(fmt(0))
      raf = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          run()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value])

  return (
    <span className="tabular-nums" ref={ref}>
      {display}
    </span>
  )
}
