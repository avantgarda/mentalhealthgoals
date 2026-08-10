import React from 'react'

import type { StatsBlock as StatsBlockProps } from '@/payload-types'

export const StatsBlockComponent: React.FC<StatsBlockProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  return (
    <div className="container">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          return (
            <div
              key={i}
              className="rounded-xl border border-border bg-card px-8 py-10 flex flex-col gap-2"
            >
              <span className="font-display text-5xl font-semibold text-brand-accent-text tracking-tight">
                {item.value}
              </span>
              <span className="text-base font-medium">{item.label}</span>
              {item.sublabel && (
                <span className="text-sm text-muted-foreground">{item.sublabel}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
