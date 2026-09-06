import type { Media, Partner } from '@/payload-types'

import React from 'react'

import { cn } from '@/utilities/ui'
import { getMediaUrl } from '@/utilities/getMediaUrl'

/**
 * Standard logo height in px. Individual partners scale from here so a row
 * balances by visual mass rather than by height: a wide wordmark and a square
 * mark set to the same height do not look the same size. See the note on
 * `logoScale` in the Partners collection.
 *
 * One size for every surface, deliberately. Logo rows all sit in a content
 * column — the band, a page row, a workstream body, an article — so a partner
 * is the same size wherever a reader meets it.
 */
const HEIGHT = 72

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
}> = ({ className, partner }) => {
  const { logo, logoScale, name, showNameWithLogo, strapline, url } = partner
  const height = Math.round(HEIGHT * (logoScale || 1))
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
        // Sized from the mark it sits beside, not fixed: a mark-only partner is
        // a lockup of two parts, and they have to grow together or the name
        // shrinks away as the mark gets bigger.
        <span
          // A bold sans, not our display serif: this text stands in for the
          // partner's own wordmark, so it should read as their identity — and
          // DIGIT sets its name exactly this way on the capabilities database.
          className="font-sans font-bold leading-none tracking-tight text-foreground"
          style={{ fontSize: Math.round(height * 0.34) }}
        >
          {name}
        </span>
      )}
    </span>
  ) : (
    <span className="flex flex-col gap-0.5">
      <span className="font-display text-[1.35rem] leading-tight text-foreground">{name}</span>
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
}> = ({ className, label, partners }) => {
  if (partners.length === 0) return null
  // "Funded by" versus "Delivered by" is the whole point of the band, so the
  // label has to name the list programmatically, not just sit above it.
  const labelId = label ? `partners-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {label && (
        // A touch larger than a standard eyebrow: this label is doing real
        // work — "Funded by" versus "Delivered by" is the whole claim — and at
        // the default size it sat too quietly under a row of full-size logos.
        <p className="eyebrow !text-[0.78rem]" id={labelId}>
          {label}
        </p>
      )}
      <ul
        aria-labelledby={labelId}
        className="m-0 flex list-none flex-wrap items-center gap-x-12 gap-y-6 p-0"
      >
        {partners.map((partner) => (
          <li className="m-0 p-0" key={partner.id}>
            <PartnerLogo partner={partner} />
          </li>
        ))}
      </ul>
    </div>
  )
}
