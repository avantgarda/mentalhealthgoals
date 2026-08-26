import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { PeopleBlockType, Person, Workstream } from '@/payload-types'
import { Media } from '@/components/Media'
import { SectionHead } from '@/components/SectionHead'

const HONORIFICS = new Set([
  'prof',
  'prof.',
  'professor',
  'dr',
  'dr.',
  'sir',
  'dame',
  'mr',
  'ms',
  'mrs',
])

/** Initials for the no-portrait state, skipping honorifics. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part && !HONORIFICS.has(part.toLowerCase()))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/** Sections of the team, in the order they appear on the page. */
const GROUPS = [
  {
    value: 'leadership',
    heading: 'Programme leadership',
    intro:
      'Setting the strategic direction of the programme and representing it across the UK and internationally.',
  },
  {
    value: 'digit',
    heading: 'DIGIT leadership',
    intro:
      'The Data and Digital Industry Alliance Team delivers the Alliance Management Team, Innovative Clinical Trials Hub and Lived Experience Industry Partnership.',
  },
  {
    value: 'delivery',
    heading: 'Delivery team',
    intro: 'The people industry and partners work with day to day.',
  },
  {
    value: 'collaborators',
    heading: 'Working with us',
    intro:
      'Cohort, data and digital leads across the UK whose work the programme builds on and with.',
  },
] as const

/** Stable anchor for a person, so their name can be linked from anywhere on the site. */
export const personAnchor = (name: string) =>
  name
    .toLowerCase()
    .replace(/prof\.?|dr\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const workstreamTitles = (person: Person): string[] =>
  (person.workstreams || [])
    .map((entry) => (typeof entry === 'object' ? (entry as Workstream).title : null))
    .filter((title): title is string => Boolean(title))

const PersonCard: React.FC<{ person: Person; index: number }> = ({ person, index }) => {
  const titles = workstreamTitles(person)

  return (
    <li
      className="flex scroll-mt-24 flex-col gap-3"
      data-reveal
      id={personAnchor(person.name)}
      style={{ transitionDelay: `${(index % 4) * 60}ms` }}
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-card">
        {person.photo && typeof person.photo === 'object' ? (
          <Media imgClassName="h-full w-full object-cover" resource={person.photo} />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-end p-4 font-display text-[2.6rem] leading-none text-muted-foreground/55"
          >
            {initials(person.name)}
          </div>
        )}
      </div>
      <div>
        <h3 className="font-display text-[1.2rem] leading-tight">{person.name}</h3>
        <p className="mt-1 text-sm font-medium leading-snug">{person.role}</p>
        <p className="eyebrow mt-1.5">{person.organisation}</p>
      </div>
      {person.bio && <p className="text-sm leading-relaxed text-muted-foreground">{person.bio}</p>}
      {titles.length > 0 && (
        <p className="mt-auto pt-1 text-xs text-muted-foreground">{titles.join(' · ')}</p>
      )}
    </li>
  )
}

/** The team, in sections: leadership, workstream leads, alliance team, collaborators. */
export const PeopleBlockComponent: React.FC<PeopleBlockType> = async ({ heading, intro }) => {
  const payload = await getPayload({ config: configPromise })

  const people = await payload.find({
    collection: 'people',
    depth: 1,
    limit: 60,
    pagination: false,
    sort: 'order',
  })

  const docs = people.docs

  if (docs.length === 0) return null

  const firstPopulated = GROUPS.find((group) =>
    docs.some((person) => person.group === group.value),
  )?.value

  return (
    <div className="container flex flex-col gap-16 lg:gap-20">
      {(heading || intro) && <SectionHead heading={heading} intro={intro} />}

      {GROUPS.map((group) => {
        const members = docs.filter((person) => person.group === group.value)
        if (members.length === 0) return null

        // The first section sits right under the page-frame rule, so it does
        // not draw a second one.
        const isFirst = !heading && !intro && group.value === firstPopulated

        return (
          <section key={group.value}>
            <SectionHead flush={isFirst} heading={group.heading} intro={group.intro} />
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
              {members.map((person, index) => (
                <PersonCard index={index} key={person.id} person={person} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
