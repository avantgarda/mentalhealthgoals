import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

import type { WorkstreamsBlockType } from '@/payload-types'

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

  // Keep heading levels sequential: with a block heading (h2) the cards sit at
  // h3; without one (e.g. the workstreams listing page, under its h1) at h2.
  const CardHeading: 'h2' | 'h3' = heading ? 'h3' : 'h2'

  return (
    <div className="container">
      {(heading || intro) && (
        <div className="max-w-2xl mb-10">
          {heading && <h2 className="text-3xl md:text-4xl font-semibold mb-3">{heading}</h2>}
          {intro && <p className="text-muted-foreground text-lg leading-relaxed">{intro}</p>}
        </div>
      )}

      {style === 'detailed' ? (
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {docs.map((ws) => (
            <Link
              key={ws.id}
              href={`/workstreams/${ws.slug}`}
              className="py-10 grid gap-4 md:grid-cols-12 group hover:bg-card/60 transition-colors"
            >
              <div className="md:col-span-1">
                <span aria-hidden="true" className="font-display text-3xl text-brand-accent-text">
                  {String(ws.number).padStart(2, '0')}
                </span>
              </div>
              <div className="md:col-span-7 flex flex-col gap-3">
                <CardHeading className="text-2xl font-semibold group-hover:underline underline-offset-4">
                  {ws.title}
                </CardHeading>
                <p className="text-muted-foreground leading-relaxed">
                  {ws.description || ws.summary}
                </p>
              </div>
              <div className="md:col-span-4 md:pl-8">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground block mb-1">
                  Delivered by
                </span>
                <span className="text-sm">{ws.deliveredBy}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((ws) => (
            <Link
              key={ws.id}
              href={`/workstreams/${ws.slug}`}
              className="rounded-xl border border-border bg-card p-7 flex flex-col gap-3 group hover:border-brand-accent-text transition-colors"
            >
              <span aria-hidden="true" className="font-display text-2xl text-brand-accent-text">
                {String(ws.number).padStart(2, '0')}
              </span>
              <CardHeading className="text-lg font-semibold leading-snug group-hover:underline underline-offset-4">
                {ws.title}
              </CardHeading>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{ws.summary}</p>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                {ws.deliveredBy}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
