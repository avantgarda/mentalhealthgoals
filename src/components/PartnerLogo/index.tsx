import type { Media, Partner } from '@/payload-types'

import React from 'react'

import { cn } from '@/utilities/ui'
import { getMediaUrl } from '@/utilities/getMediaUrl'

type Size = 'regular' | 'compact'

/**
 * Standard logo height in px per size; individual partners scale from here.
 * Sized so a wordmark's smallest type is still readable rather than merely
 * recognisable — a partner shown too small to read is worse than a name.
 */
const HEIGHT: Record<Size, number> = { regular: 60, compact: 42 }

const isMedia = (logo: Partner['logo']): logo is Media =>
  typeof logo === 'object' && logo !== null && 'url' in logo

/**
 * One partner, either as its logo or — when no logo has been cleared for use —
 * as a typographic lockup of its name. Both forms sit on the same baseline row
 * and carry the same link, so a row mixing the two still reads as one set.
 *
 * Logos are plain <img>s on purpose: partner artwork is small and often SVG,
 * which the image optimiser would either refuse or rasterise. Width and
 * height are set from the stored file so nothing shifts as they load.
 */
export const PartnerLogo: React.FC<{
  className?: string
  partner: Partner
  size?: Size
}> = ({ className, partner, size = 'regular' }) => {
  const { logo, logoScale, name, showNameWithLogo, strapline, url } = partner
  const height = Math.round(HEIGHT[size] * (logoScale || 1))
  const media = isMedia(logo) ? logo : null
  const width =
    media?.width && media?.height ? Math.round((height * media.width) / media.height) : undefined
  const label = strapline ? `${name} — ${strapline}` : name

  const inner = media ? (
    <span className="flex items-center gap-3">
      {/* A plain <img>, deliberately: partner artwork is small and often SVG,
          which next/image will not optimise — it would either refuse the file
          or rasterise a vector that is already smaller than any derivative. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={showNameWithLogo ? '' : label}
        // The hover/focus dim lives on the artwork alone: applied to the whole
        // link it also dimmed the strapline, dropping it under the 4.5:1 AA
        // minimum in the one state a keyboard user depends on.
        className="block w-auto max-w-[14rem] object-contain transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
        decoding="async"
        height={height}
        loading="lazy"
        src={getMediaUrl(media.url, media.updatedAt)}
        style={{ height }}
        width={width}
      />
      {showNameWithLogo && (
        <span
          className={cn(
            'font-display leading-none text-foreground',
            size === 'compact' ? 'text-[1.05rem]' : 'text-[1.35rem]',
          )}
        >
          {name}
        </span>
      )}
    </span>
  ) : (
    <span className="flex flex-col gap-0.5">
      <span
        className={cn(
          'font-display leading-tight text-foreground',
          size === 'compact' ? 'text-[1.05rem]' : 'text-[1.35rem]',
        )}
      >
        {name}
      </span>
      {strapline && <span className="eyebrow !normal-case !tracking-[0.06em]">{strapline}</span>}
    </span>
  )

  const classes = cn('group inline-flex items-center', className)

  if (!url) return <span className={classes}>{inner}</span>

  // Only an outbound link leaves the site — a partner pointing at one of our
  // own pages (DIGIT → /about) should not open a new tab or announce one.
  const external = /^https?:\/\//i.test(url)

  return (
    <a
      className={classes}
      href={url}
      {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
    >
      {inner}
      {/* Only ever add what is not already announced. The name is in `alt`
          when the logo stands alone and visible when it is not, so this
          carries the strapline and the new-tab notice at most — and the
          strapline only in the branch whose `alt` was deliberately empty. */}
      {((media && showNameWithLogo && strapline) || external) && (
        <span className="sr-only">
          {media && showNameWithLogo && strapline ? ` — ${strapline}` : ''}
          {external ? ' (opens in a new tab)' : ''}
        </span>
      )}
    </a>
  )
}

/** A labelled group of partners on one baseline row. */
export const PartnerGroup: React.FC<{
  className?: string
  label?: string | null
  partners: Partner[]
  size?: Size
}> = ({ className, label, partners, size = 'regular' }) => {
  if (partners.length === 0) return null
  // "Funded by" versus "Delivered by" is the whole point of the band, so the
  // label has to name the list programmatically, not just sit above it.
  const labelId = label ? `partners-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {label && (
        <p className="eyebrow" id={labelId}>
          {label}
        </p>
      )}
      <ul
        aria-labelledby={labelId}
        className={cn(
          'm-0 flex list-none flex-wrap items-center p-0',
          size === 'compact' ? 'gap-x-8 gap-y-4' : 'gap-x-12 gap-y-6',
        )}
      >
        {partners.map((partner) => (
          <li className="m-0 p-0" key={partner.id}>
            <PartnerLogo partner={partner} size={size} />
          </li>
        ))}
      </ul>
    </div>
  )
}
