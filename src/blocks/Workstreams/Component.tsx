import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

import type { Workstream, WorkstreamsBlockType } from '@/payload-types'
import { SectionHead } from '@/components/SectionHead'
import { DigitMark } from '@/components/DigitMark'

/** Umbrella teams that bracket a run of workstreams in the index. */
const UMBRELLAS: Record<string, { name: string; expansion: string; note: string }> = {
  digit: {
    name: 'DIGIT',
    expansion: 'Data and Digital Industry Alliance Team',
    note: 'Delivered together from King’s College London as the programme’s industry-facing team.',
  },
}

/**
 * The six workstreams as a numbered index. Workstreams sharing an umbrella
 * team (DIGIT) are bracketed together with a labelled band, so the structure
 * of the programme is visible without changing the numbering.
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

  // Group consecutive workstreams that share an umbrella team.
  const runs: { umbrella: string | null; items: Workstream[] }[] = []
  for (const ws of docs) {
    const umbrella = ws.group ?? null
    const last = runs[runs.length - 1]
    if (last && last.umbrella === umbrella) last.items.push(ws)
    else runs.push({ umbrella, items: [ws] })
  }

  const row = (ws: Workstream, i: number) => (
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
  )

  return (
    <div className="container">
      <SectionHead heading={heading} intro={intro} />

      <div className="border-t border-border">
        {runs.map((run, runIndex) => {
          const umbrella = run.umbrella ? UMBRELLAS[run.umbrella] : null

          if (!umbrella) {
            return <ol key={runIndex}>{run.items.map((ws, i) => row(ws, i))}</ol>
          }

          return (
            <section
              className="border-l-2 border-primary/50 bg-primary/[0.04] pl-4 lg:pl-6"
              key={runIndex}
            >
              <div className="flex items-start gap-4 py-4" data-reveal>
                <DigitMark className="mt-0.5 h-9 w-9 text-primary" />
                <div className="flex flex-col gap-1">
                  <p className="eyebrow !text-brand-accent-text">
                    {umbrella.name} — {umbrella.expansion}
                  </p>
                  <p className="text-sm text-muted-foreground">{umbrella.note}</p>
                </div>
              </div>
              <ol>{run.items.map((ws, i) => row(ws, i))}</ol>
            </section>
          )
        })}
      </div>
    </div>
  )
}
