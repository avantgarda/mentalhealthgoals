'use client'
import React from 'react'

import { cn } from '@/utilities/ui'
import { ARTWORK } from './artwork'

/**
 * The pre-launch joke motif: Sigmund Freud drop-kicking a brain through a set
 * of rugby posts, in place of the contour ridge on the home page hero. Armed
 * by the key sequence in `useAltMotif`.
 *
 * The artwork is not a file on the server: it is inlined into `./artwork`, and
 * the hero pulls this module in through `next/dynamic`. So there is no URL to
 * guess, nothing under `public/` to fetch, and no request of any kind until
 * somebody enters the sequence — the chunk carries the bytes with it. The
 * module path is deliberately dull for the same reason, since a chunk name is
 * visible to anyone who opens a network panel.
 *
 * ## How the artwork was made
 *
 * It comes from a generated 1254px square with a transparent background. Two things were done to it. The two motion trails are their own
 * connected components — they touch neither the figure, the posts nor the ball
 * — so they were labelled and repainted in the cream the artwork already uses
 * for the posts and the ball (rgb 247,242,228); as drawn they were the same
 * near-black as the suit and vanished into the petrol ground. It was then
 * downsampled to 900px with lanczos3, which supersamples the supplied cut —
 * partial alpha on only 0.6% of pixels, a hard edge — smooth on the way down.
 *
 * The figure is mostly dark suit, which the hero swallows whole, so it sits on
 * a soft radial glow. The glow is sized `closest-side` and fully transparent by
 * 88% of that radius, which is what keeps the square it is painted on from
 * showing its own straight edges.
 */
const ALT = 'Sigmund Freud drop-kicking a brain through a set of rugby posts'

export const AltMotif: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('alt-motif flex w-full items-center justify-center', className)}>
    {/* Square, and never larger than the box it is given — so the drawing is
        whole at every width. The ridge it replaces is allowed to run off the
        right of the screen because a ridge is a landscape; a figure that is
        cut in half is just a mistake.
        The height cap is the other half of that: `aspect-square` takes its
        height from its width, and a wide column in a short hero would push the
        square straight out through the top and bottom. `58vh` keeps it inside
        the hero's own `min-h-[76vh]` with room for the padding. */}
    <div
      className={cn(
        'alt-motif-plate relative aspect-square w-full max-w-[min(100%,58vh)]',
        'bg-[radial-gradient(circle_closest-side,#0d2831_0%,#06202a_45%,rgba(0,17,23,0)_88%)]',
      )}
    >
      {/* A plain img, not `next/image`: there is nothing for the optimiser to
          do to a data URI, and routing one through it would put the artwork
          back on a public URL, which is the whole point of inlining it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={ALT}
        className="absolute inset-0 h-full w-full object-contain"
        decoding="async"
        draggable={false}
        src={ARTWORK}
      />
    </div>
  </div>
)

export default AltMotif
