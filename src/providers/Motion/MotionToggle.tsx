'use client'

import React, { useSyncExternalStore } from 'react'

import { isMotionPreference, motionLocalStorageKey, type MotionPreference } from './shared'

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => observer.disconnect()
}

const getSnapshot = (): MotionPreference | null => {
  const current = document.documentElement.getAttribute('data-motion')
  return isMotionPreference(current) ? current : 'on'
}

const getServerSnapshot = (): MotionPreference | null => null

/**
 * Footer control for switching animation on or off. Mirrors the theme
 * selector: the choice is stored in localStorage and applied as
 * `data-motion` on <html>, which every animation in the stylesheet keys off.
 * The attribute itself is the source of truth (set before paint by
 * InitMotion), so the control simply reflects it.
 */
export const MotionToggle: React.FC = () => {
  const motion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = () => {
    const next: MotionPreference = motion === 'off' ? 'on' : 'off'
    document.documentElement.setAttribute('data-motion', next)
    window.localStorage.setItem(motionLocalStorageKey, next)
  }

  const isOn = motion !== 'off'

  return (
    <button
      aria-pressed={isOn}
      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-inherit hover:text-white"
      onClick={toggle}
      type="button"
    >
      <span>Motion</span>
      <span
        aria-hidden="true"
        className="relative inline-block h-4 w-7 border border-current"
        data-state={isOn ? 'on' : 'off'}
      >
        <span
          className={[
            'absolute top-[2px] h-[10px] w-[10px] bg-current transition-[left] duration-200',
            isOn ? 'left-[14px]' : 'left-[2px]',
          ].join(' ')}
        />
      </span>
      <span className="min-w-[2ch]">{motion === null ? '' : isOn ? 'On' : 'Off'}</span>
    </button>
  )
}
