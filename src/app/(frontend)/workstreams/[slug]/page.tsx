import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Link from 'next/link'

import { PartnerGroup } from '@/components/PartnerLogo'
import { getCachedPartners } from '@/utilities/getPartners'

import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { LinkifyEntities } from '@/utilities/linkifyEntities'
import { personAnchor } from '@/utilities/personAnchor'

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

/** People related to this workstream, for the team section. */
const queryWorkstreamPeople = cache(async ({ id }: { id: number }) => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'people',
    depth: 0,
    limit: 20,
    pagination: false,
    sort: 'order',
    where: { workstreams: { in: [id] } },
  })
  return result.docs
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

  const {
    number,
    title,
    summary,
    description,
    deliveredBy,
    boundaryStatement,
    partners,
    resources,
  } = workstream
  // The workstream query runs at depth 0, so `partners` arrives as IDs — and
  // raising the depth far enough to reach each partner's logo would pull the
  // whole graph for every workstream page. Resolve them from the cached
  // partner list instead, which the footer has already warmed, keeping the
  // seeded order rather than the relationship's.
  const partnerIds = new Set(
    (partners ?? []).map((p) => (typeof p === 'object' && p !== null ? p.id : p)),
  )
  const workstreamPartners = partnerIds.size
    ? (await getCachedPartners()).filter((p) => partnerIds.has(p.id))
    : []
  const all = await queryAllWorkstreams()
  const team = await queryWorkstreamPeople({ id: workstream.id })
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
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Delivered by</span>
              {/* Institutions stay as text, deliberately. A workstream's
                  delivery list is a set of co-equal institutions, and we only
                  hold cleared artwork for one of them — showing King's as a
                  logo above four plain university names would invent a
                  hierarchy the programme does not claim. Logos belong where
                  the set is complete: the footer band and curated rows. */}
              <ul className="flex flex-col gap-1 text-sm leading-snug">
                {deliveredBy
                  .split('·')
                  .map((institution) => institution.trim())
                  .filter(Boolean)
                  .map((institution) => (
                    <li key={institution}>{institution}</li>
                  ))}
              </ul>
            </div>
            {resources && resources.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Links</span>
                <ul className="flex flex-col text-sm leading-snug">
                  {resources.map((resource) => (
                    <li key={resource.id || resource.url}>
                      <a
                        className="link-line inline-block py-1"
                        href={resource.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {resource.label}
                        <span aria-hidden="true"> ↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                <LinkifyEntities text={description} />
              </p>
            )}

            {workstreamPartners.length > 0 && (
              <div className="partner-plate border-y border-border px-5 py-6" data-reveal>
                <PartnerGroup label="Delivered with" partners={workstreamPartners} size="compact" />
              </div>
            )}

            {SECTIONS.map((s) => (
              <PointList heading={s.heading} id={s.id} key={s.id} points={workstream[s.key]} />
            ))}

            {team.length > 0 && (
              <section className="scroll-mt-8 border-t-2 border-foreground pt-5" id="team">
                <h2 className="display-2 mb-6">Who leads this workstream</h2>
                <ul className="border-t border-border">
                  {team.map((person) => (
                    <li
                      className="grid grid-cols-1 gap-1 border-b border-border py-4 md:grid-cols-12 md:gap-x-8"
                      data-reveal
                      key={person.id}
                    >
                      <div className="md:col-span-5">
                        <p className="font-display text-[1.15rem] leading-tight">
                          <Link
                            className="link-line inline-block py-1"
                            href={`/people#${personAnchor(person.name)}`}
                          >
                            {person.name}
                          </Link>
                        </p>
                      </div>
                      <p className="text-[0.95rem] leading-snug md:col-span-4">{person.role}</p>
                      <p className="eyebrow md:col-span-3 md:text-right">{person.organisation}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  <Link className="link-line" href="/people">
                    See the full team
                  </Link>
                </p>
              </section>
            )}

            {next && next.slug !== workstream.slug && (
              <div className="border-t border-border pt-8" data-reveal>
                <p className="eyebrow mb-3">Next workstream</p>
                <Link
                  className="group flex items-baseline justify-between gap-4 pr-1 font-display text-[1.5rem] leading-tight lg:pr-4"
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
