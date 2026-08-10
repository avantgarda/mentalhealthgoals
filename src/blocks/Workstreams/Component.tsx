import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

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
  })

  const docs = workstreams.docs

  if (docs.length === 0) return null

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
            <div key={ws.id} className="py-10 grid gap-4 md:grid-cols-12">
              <div className="md:col-span-1">
                <span className="font-display text-3xl text-brand-accent-text">
                  {String(ws.number).padStart(2, '0')}
                </span>
              </div>
              <div className="md:col-span-7 flex flex-col gap-3">
                <h3 className="text-2xl font-semibold">{ws.title}</h3>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((ws) => (
            <div
              key={ws.id}
              className="rounded-xl border border-border bg-card p-7 flex flex-col gap-3"
            >
              <span className="font-display text-2xl text-brand-accent-text">
                {String(ws.number).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-semibold leading-snug">{ws.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{ws.summary}</p>
              <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border">
                {ws.deliveredBy}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
