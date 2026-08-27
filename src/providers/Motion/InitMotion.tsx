import Script from 'next/script'
import React from 'react'

import { motionLocalStorageKey } from './shared'

/**
 * Resolves the motion preference before first paint so animated elements never
 * flash. Explicit choice (footer toggle) wins; otherwise the OS
 * `prefers-reduced-motion` setting decides. Without JavaScript the attribute is
 * never set, and the stylesheet treats that as "everything visible, nothing
 * animated" — content is never hidden behind a reveal that cannot run.
 */
export const InitMotion: React.FC = () => {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    var motion = 'on'
    try {
      var preference = window.localStorage.getItem('${motionLocalStorageKey}')
      if (preference === 'on' || preference === 'off') {
        motion = preference
      } else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        motion = 'off'
      }
    } catch (e) {}
    document.documentElement.setAttribute('data-motion', motion)
  })();
  `,
      }}
      id="motion-script"
      strategy="beforeInteractive"
    />
  )
}
