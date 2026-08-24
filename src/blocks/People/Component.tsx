import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { PeopleBlockType } from '@/payload-types'
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

/** The people roll: a portrait grid with hairlines and a quiet no-photo state. */
export const PeopleBlockComponent: React.FC<PeopleBlockType> = async ({ heading, intro }) => {
  const payload = await getPayload({ config: configPromise })

  const people = await payload.find({
    collection: 'people',
    depth: 1,
    limit: 24,
    pagination: false,
    sort: 'order',
  })

  const docs = people.docs

  if (docs.length === 0) return null

  return (
    <div className="container">
      <SectionHead heading={heading} intro={intro} />

      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
        {docs.map((person, i) => (
          <li
            className="flex flex-col gap-3"
            data-reveal
            key={person.id}
            style={{ transitionDelay: `${(i % 4) * 60}ms` }}
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
            {person.bio && (
              <p className="text-sm leading-relaxed text-muted-foreground">{person.bio}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
