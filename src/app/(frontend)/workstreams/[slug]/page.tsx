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

const queryAllWorkstreams = cache(async () => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'workstreams',
    depth: 0,
    limit: 12,
    pagination: false,
    overrideAccess: false,
    sort: 'number',
    select: { slug: true, title: true, number: true },
  })
  return result.docs
})

type Points = { point?: string | null; id?: string | null }[] | null | undefined

const SECTIONS = [
  { id: 'primary-focus', heading: 'Primary focus', key: 'primaryFocus' },
  { id: 'key-questions', heading: 'Key questions & challenges', key: 'keyQuestions' },
  {
    id: 'differentiators',
    heading: 'How this differs from other infrastructure',
    key: 'differentiators',
  },
] as const

/** Section of numbered points as ruled rows — renders nothing when empty. */
const PointList: React.FC<{ heading: string; id: string; points?: Points }> = ({
  heading,
  id,
  points,
}) => {
  if (!points || points.length === 0) return null

  return (
    <section className="scroll-mt-8 border-t-2 border-foreground pt-5" id={id}>
      <h2 className="display-2 mb-6">{heading}</h2>
      <ol className="border-t border-border">
        {points.map((entry, i) => (
          <li
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-b border-border py-4"
            data-reveal
            key={entry.id || i}
            style={{ transitionDelay: `${Math.min(i, 6) * 40}ms` }}
          >
            <span
              aria-hidden="true"
              className="pt-1 font-mono text-xs tabular-nums text-muted-foreground"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="leading-relaxed">{entry.point}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default async function WorkstreamPage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const workstream = await queryWorkstreamBySlug({ slug: decodeURIComponent(slug) })

  if (!workstream) notFound()

  const { number, title, summary, description, deliveredBy, boundaryStatement } = workstream
  const all = await queryAllWorkstreams()
  const index = all.findIndex((w) => w.slug === workstream.slug)
  const next = index >= 0 ? all[(index + 1) % all.length] : null
  const sections = SECTIONS.filter((s) => (workstream[s.key]?.length ?? 0) > 0)

  return (
    <article className="pb-24 pt-10 lg:pt-16">
      <div className="container">
        {/* Frame */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 border-b-2 border-foreground pb-10 lg:grid-cols-12 lg:pb-14">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <Link className="eyebrow link-line w-fit hover:text-foreground" href="/workstreams">
              <span aria-hidden="true">← </span>All workstreams
            </Link>
            <span aria-hidden="true" className="numeral text-[3.5rem] text-brand-accent-text">
              {String(number).padStart(2, '0')}
            </span>
            <div className="flex flex-col gap-1">
              <span className="eyebrow">Delivered by</span>
              <span className="text-sm leading-snug">{deliveredBy}</span>
            </div>
          </div>

          <header className="flex flex-col gap-6 lg:col-span-9">
            <h1 className="display-1 max-w-[16ch]">{title}</h1>
            {summary && <p className="lede max-w-[44rem]">{summary}</p>}
          </header>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 pt-10 lg:grid-cols-12 lg:pt-14">
          <aside className="lg:col-span-3">
            {sections.length > 0 && (
              <nav
                aria-label="On this page"
                className="flex flex-col gap-3 border-t border-border pt-3 lg:sticky lg:top-8"
              >
                <p className="eyebrow">On this page</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        className="link-line text-muted-foreground hover:text-foreground"
                        href={`#${s.id}`}
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>

          <div className="flex flex-col gap-14 lg:col-span-8 lg:col-start-5">
            {boundaryStatement && (
              <blockquote
                className="m-0 whitespace-pre-line border-l-2 border-brand-accent pl-6 font-display text-[clamp(1.35rem,2vw,1.7rem)] italic leading-snug"
                data-reveal
              >
                {boundaryStatement}
              </blockquote>
            )}

            {description && (
              <p className="lede max-w-[66ch]" data-reveal>
                {description}
              </p>
            )}

            {SECTIONS.map((s) => (
              <PointList heading={s.heading} id={s.id} key={s.id} points={workstream[s.key]} />
            ))}

            {next && next.slug !== workstream.slug && (
              <div className="border-t border-border pt-8" data-reveal>
                <p className="eyebrow mb-3">Next workstream</p>
                <Link
                  className="group flex items-baseline justify-between gap-4 font-display text-[1.5rem] leading-tight"
                  href={`/workstreams/${next.slug}`}
                >
                  <span>
                    <span
                      aria-hidden="true"
                      className="mr-3 font-mono text-xs text-muted-foreground"
                    >
                      {String(next.number).padStart(2, '0')}
                    </span>
                    {next.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="arrow font-sans text-base text-muted-foreground"
                  >
                    →
                  </span>
                </Link>
              </div>
            )}
          </div>
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
