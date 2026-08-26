import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

import type { WorkstreamsBlockType } from '@/payload-types'
import { SectionHead } from '@/components/SectionHead'

/**
 * The six workstreams as a numbered index: number · title · one line ·
 * delivered by. The "detailed" style shows the longer description; "cards"
 * (the name is kept for the CMS) shows the summary.
 */
export const WorkstreamsBlockComponent: React.FC<WorkstreamsBlockType> = async ({
  heading,
  intro,
  style,
}) => {
  const payload = await getPayload({ config: configPromise })

  const workstreams = await payload.find({
    collection: 'workstreams',
    depth: 0,
    limit: 12,
    pagination: false,
    sort: 'number',
    overrideAccess: false,
  })

  const docs = workstreams.docs

  if (docs.length === 0) return null

  // Keep heading levels sequential: with a block heading (h2) the rows sit at
  // h3; without one (e.g. the workstreams listing page, under its h1) at h2.
  const RowHeading: 'h2' | 'h3' = heading ? 'h3' : 'h2'
  const detailed = style === 'detailed'

  return (
    <div className="container">
      <SectionHead heading={heading} intro={intro} />

      <ol className="border-t border-border">
        {docs.map((ws, i) => (
          <li data-reveal key={ws.id} style={{ transitionDelay: `${Math.min(i, 6) * 50}ms` }}>
            <Link
              className="group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-border py-6 transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.03] lg:grid-cols-12 lg:gap-x-8 lg:py-7"
              href={`/workstreams/${ws.slug}`}
            >
              <span
                aria-hidden="true"
                className="pt-1.5 font-mono text-xs tabular-nums text-muted-foreground transition-colors duration-[var(--dur-ui)] group-hover:text-brand-accent-text lg:col-span-1"
              >
                {String(ws.number).padStart(2, '0')}
              </span>
              <div className="lg:col-span-4">
                <RowHeading className="display-3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                  {ws.title}
                </RowHeading>
              </div>
              <p className="col-start-2 text-[0.95rem] leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-6">
                {detailed ? ws.description || ws.summary : ws.summary}
              </p>
              <div className="col-start-2 flex flex-col gap-1 lg:col-span-3 lg:col-start-10 lg:items-end lg:pr-4 lg:text-right">
                <span className="eyebrow">Delivered by</span>
                <span className="text-sm leading-snug">{ws.deliveredBy}</span>
                <span aria-hidden="true" className="arrow mt-1 text-muted-foreground">
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
