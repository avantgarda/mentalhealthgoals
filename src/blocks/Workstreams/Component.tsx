import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

import type { Workstream, WorkstreamsBlockType } from '@/payload-types'
import { SectionHead } from '@/components/SectionHead'
import { DIGIT, workstreamHierarchy, type WorkstreamEntry } from '@/utilities/workstreamHierarchy'

export const WorkstreamsBlockComponent: React.FC<WorkstreamsBlockType> = async ({
  heading,
  intro,
  style,
}) => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'workstreams',
    depth: 0,
    limit: 100,
    pagination: false,
    sort: 'number',
    overrideAccess: false,
  })
  const groups = workstreamHierarchy(docs)
  if (!groups.length) return null

  const RowHeading = heading ? 'h3' : 'h2'
  const StrandHeading = heading ? 'h4' : 'h3'
  const detailed = style === 'detailed'

  const row = (entry: WorkstreamEntry<Workstream>) => {
    const ws = entry.doc!
    const Heading = entry.kind === 'strand' ? StrandHeading : RowHeading
    return (
      <li key={entry.href}>
        <Link
          className="group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-border px-4 py-6 transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.03] lg:grid-cols-12 lg:gap-x-8 lg:px-6 lg:py-7"
          href={entry.href}
        >
          <span
            aria-hidden="true"
            className="pt-1.5 font-mono text-xs tabular-nums text-brand-accent-text lg:col-span-1"
          >
            {entry.label}
          </span>
          <div className="lg:col-span-4">
            <Heading className="display-3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
              {ws.title}
            </Heading>
          </div>
          <p className="col-start-2 text-[1rem] leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-6">
            {detailed ? ws.description || ws.summary : ws.summary}
          </p>
          <div className="col-start-2 flex flex-col gap-1 lg:col-span-3 lg:col-start-10 lg:items-end lg:text-right">
            <span className="eyebrow">Delivered by</span>
            <span className="text-[0.95rem] leading-snug">{ws.deliveredBy}</span>
            <span aria-hidden="true" className="arrow mt-1 text-muted-foreground">
              →
            </span>
          </div>
        </Link>
      </li>
    )
  }

  return (
    <div className="container">
      <SectionHead heading={heading} intro={intro} />
      <ol className="border-t border-foreground" aria-label="National workstreams">
        {groups.map((entry) =>
          entry.doc ? (
            row(entry)
          ) : (
            <li key={entry.href} className="border-b border-foreground pb-2">
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 px-4 py-6 lg:grid-cols-12 lg:gap-x-8 lg:px-6 lg:py-7">
                <span
                  aria-hidden="true"
                  className="pt-1.5 font-mono text-xs tabular-nums text-brand-accent-text lg:col-span-1"
                >
                  {entry.label}
                </span>
                <div className="lg:col-span-11">
                  <RowHeading className="display-3">
                    <Link className="link-line" href={entry.href}>
                      {entry.title}
                    </Link>
                  </RowHeading>
                  <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                    {DIGIT.note}
                  </p>
                </div>
              </div>
              <ol
                className="ml-4 border-l-2 border-brand-accent sm:ml-12 lg:ml-24 [&>li:last-child>a]:border-b-0"
                aria-label="DIGIT strands"
              >
                {entry.children.map(row)}
              </ol>
            </li>
          ),
        )}
      </ol>
    </div>
  )
}
