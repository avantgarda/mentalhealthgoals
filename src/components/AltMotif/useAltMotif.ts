'use client'
import { useSyncExternalStore } from 'react'

/**
 * The pre-launch joke, behind a key sequence rather than a setting.
 *
 * Named for what it is structurally — the alternative hero motif — rather than
 * for what it draws, because the module path becomes a chunk name and the
 * chunk name is visible in the network panel of anybody who opens one.
 *
 * Nothing about this reaches the CMS or the database, and nothing about it
 * reaches anybody else: it lives in the visitor's own tab, so there is no
 * switch that can be left on before launch and no row that has to be checked
 * before announcing the site. Showing a colleague means telling them the
 * sequence, which is the better half of the joke anyway.
 *
 * Left, right, left, right, then the name. It began as the Konami code, but
 * the up and down arrows scroll the page, so entering it meant watching the
 * hero jump about — and the whole point is to watch the hero. Left and right
 * move nothing here: the page has no horizontal overflow, which the motif's
 * own end-to-end test asserts. Enter it again to put the ridge back.
 */
const SEQUENCE = [
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'f',
  'r',
  'e',
  'u',
  'd',
] as const

const STORAGE_KEY = 'mhg:motif'

/** Typing into a field is typing, not a cheat code. */
const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return (
    el.isContentEditable ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT'
  )
}

/* An external store rather than component state. The value is a property of the
   tab, not of any one component, and reading it is a side effect the server
   cannot perform — which is exactly the shape `useSyncExternalStore` exists
   for. It also means the first client snapshot is already correct, so a tab
   that has the motif on does not render the ridge for a frame first. */
let active = false
let matched = 0
const listeners = new Set<() => void>()

const remember = (on: boolean) => {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, 'b')
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private windows and blocked site data: not being able to remember it is
    // survivable, and it still works for this page.
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
    matched = 0
    return
  }

  const key = event.key.toLowerCase()
  // A wrong key does not always reset to nothing: it may itself be the start of
  // a fresh attempt, which matters when the sequence repeats a key and when
  // somebody fumbles the first press.
  matched = key === SEQUENCE[matched] ? matched + 1 : key === SEQUENCE[0] ? 1 : 0
  if (matched < SEQUENCE.length) return

  matched = 0
  active = !active
  remember(active)
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    try {
      active = window.sessionStorage.getItem(STORAGE_KEY) === 'b'
    } catch {
      active = false
    }
    document.addEventListener('keydown', onKeyDown)
  }
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) document.removeEventListener('keydown', onKeyDown)
  }
}

const getSnapshot = (): boolean => active

/** The server has no idea what this tab has been told. */
const getServerSnapshot = (): boolean => false

export const useAltMotif = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
