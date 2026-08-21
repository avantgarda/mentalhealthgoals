import React from 'react'

import type { StatsBlock as StatsBlockProps } from '@/payload-types'

import { CountUp } from './CountUp'

/** "By the numbers": large serif numerals set inline between hairlines — no tiles. */
export const StatsBlockComponent: React.FC<StatsBlockProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  const cols = Math.min(items.length, 4)

  return (
    <div className="container">
      <ul
        className="grid grid-cols-1 border-t border-border sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={{ ['--cols' as string]: cols } as React.CSSProperties}
      >
        {items.map((item, i) => {
          return (
            <li
              className="flex flex-col gap-3 border-b border-border py-8 sm:border-b-0 sm:border-r sm:py-10 sm:pr-8 sm:last:border-r-0 sm:[&:not(:first-child)]:pl-8"
              data-reveal
              key={i}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span className="numeral text-[clamp(3rem,6vw,5.25rem)] text-foreground">
                <CountUp value={item.value} />
              </span>
              <span className="text-base font-medium leading-snug">{item.label}</span>
              {item.sublabel && (
                <span className="text-sm text-muted-foreground">{item.sublabel}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
