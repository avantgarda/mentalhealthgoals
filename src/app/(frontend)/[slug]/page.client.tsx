'use client'
import React from 'react'

/**
 * Nothing to do on mount.
 *
 * This used to claim `light` for the header on every CMS page, which put it in
 * a race with the high-impact hero claiming `dark` on the same page — the home
 * page ran both, and whichever effect landed last won. A client-side
 * navigation could therefore paint a light, opaque bar over the dark hero, and
 * because that state carried `data-theme="light"` the server-side rescue rule
 * in globals.css could not correct it.
 *
 * The header now resets itself to null on every navigation and only a hero
 * overrides it, so the page has nothing to say here. Kept as a component
 * because the route renders it and it may need client-side work again.
 */
const PageClient: React.FC = () => {
  return <React.Fragment />
}

export default PageClient
