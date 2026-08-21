export const motionLocalStorageKey = 'payload-motion'

export type MotionPreference = 'on' | 'off'

export const isMotionPreference = (value: unknown): value is MotionPreference =>
  value === 'on' || value === 'off'
