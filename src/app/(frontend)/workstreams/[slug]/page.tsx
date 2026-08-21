import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const workstreams = await payload.find({
    collection: 'workstreams',
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: false,
    select: { slug: true },
  })

  return workstreams.docs.filter((doc) => Boolean(doc.slug)).map(({ slug }) => ({ slug }))
}

type Args = {
  params: Promise<{ slug?: string }>
}

const queryWorkstreamBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'workstreams',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: false,
    where: { slug: { equals: slug } },
  })

  return result.docs?.[0] || null
})

/** Section of bulleted points — renders nothing when the list is empty. */
const PointList: React.FC<{
  heading: string
  points?: { point?: string | null; id?: string | null }[] | null
}> = ({ heading, points }) => {
  if (!points || points.length === 0) return null

  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-semibold mb-6">{heading}</h2>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {points.map((entry, i) => (
          <li key={entry.id || i} className="py-4 flex gap-4">
            <span
              aria-hidden="true"
              className="font-display text-sm text-brand-accent-text shrink-0 pt-0.5 tabular-nums"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="leading-relaxed">{entry.point}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function WorkstreamPage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const workstream = await queryWorkstreamBySlug({ slug: decodeURIComponent(slug) })

  if (!workstream) notFound()

  const { number, title, summary, description, deliveredBy, boundaryStatement } = workstream

  return (
    <article className="pt-16 pb-24">
      <div className="container flex flex-col gap-14">
        <header className="max-w-3xl flex flex-col gap-5">
          <Link
            className="text-sm text-muted-foreground hover:text-foreground w-fit"
            href="/workstreams"
          >
            ← All workstreams
          </Link>

          <span className="font-display text-4xl text-brand-accent-text">
            {String(number).padStart(2, '0')}
          </span>

          <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-balance">{title}</h1>

          {summary && (
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{summary}</p>
          )}

          {boundaryStatement && (
            <p className="whitespace-pre-line border-l-2 border-brand-accent-text pl-5 text-lg leading-relaxed">
              {boundaryStatement}
            </p>
          )}

          <div className="pt-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground block mb-1">
              Delivered by
            </span>
            <span className="text-sm">{deliveredBy}</span>
          </div>
        </header>

        {description && (
          <div className="max-w-3xl">
            <p className="text-muted-foreground leading-relaxed">{description}</p>
          </div>
        )}

        <div className="max-w-3xl flex flex-col gap-14">
          <PointList heading="Primary focus" points={workstream.primaryFocus} />
          <PointList heading="Key questions &amp; challenges" points={workstream.keyQuestions} />
          <PointList
            heading="How this differs from other infrastructure"
            points={workstream.differentiators}
          />
        </div>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const workstream = await queryWorkstreamBySlug({ slug: decodeURIComponent(slug) })

  if (!workstream) return {}

  const title = `${workstream.title} | Mental Health Goals Programme`

  return {
    title,
    description: workstream.summary,
    openGraph: mergeOpenGraph({
      title,
      description: workstream.summary || '',
      url: `/workstreams/${workstream.slug}`,
    }),
  }
}
