import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className } = props

  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <svg
        aria-hidden="true"
        className="h-9 w-9 shrink-0"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
        <circle cx="20" cy="20" r="10.5" stroke="currentColor" strokeWidth="2.5" opacity="0.55" />
        <circle cx="20" cy="20" r="4" fill="var(--brand-accent, #d98a4d)" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight whitespace-nowrap">
          Mental Health Goals
        </span>
        <span className="text-[0.62rem] font-sans font-medium uppercase tracking-[0.22em] opacity-75 mt-1">
          National Programme
        </span>
      </span>
    </span>
  )
}
